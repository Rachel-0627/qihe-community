-- 00016_add_unlock_records_and_enhance_event_registrations

-- 1. 为 level_config 添加免费解锁额度字段
ALTER TABLE public.level_config ADD COLUMN IF NOT EXISTS free_unlock_count integer NOT NULL DEFAULT 0;

-- 2. 创建用户付费项目解锁记录表
CREATE TABLE IF NOT EXISTS public.user_unlock_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, project_id)
);

ALTER TABLE public.user_unlock_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own unlock records" ON public.user_unlock_records
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users create own unlock records" ON public.user_unlock_records
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins manage unlock records" ON public.user_unlock_records
  FOR ALL TO authenticated USING (public.get_user_role(auth.uid()) = 'admin'::public.user_role)
  WITH CHECK (public.get_user_role(auth.uid()) = 'admin'::public.user_role);

-- 3. 创建免费解锁额度相关函数

-- 获取用户当前等级的免费解锁总额度
CREATE OR REPLACE FUNCTION public.get_user_free_unlock_quota(p_user_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_level integer;
  v_quota integer;
BEGIN
  SELECT level INTO v_level FROM public.profiles WHERE id = p_user_id;
  IF NOT FOUND OR v_level IS NULL THEN
    v_level := 1;
  END IF;
  SELECT free_unlock_count INTO v_quota FROM public.level_config WHERE level = v_level;
  IF NOT FOUND OR v_quota IS NULL THEN
    v_quota := 0;
  END IF;
  RETURN v_quota;
END;
$$;

-- 获取用户剩余免费解锁次数
CREATE OR REPLACE FUNCTION public.get_remaining_unlock_count(p_user_id uuid DEFAULT NULL)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id uuid := COALESCE(p_user_id, auth.uid());
  v_total integer;
  v_used integer;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN json_build_object('total', 0, 'used', 0, 'remaining', 0);
  END IF;
  v_total := public.get_user_free_unlock_quota(v_user_id);
  SELECT COUNT(*) INTO v_used FROM public.user_unlock_records WHERE user_id = v_user_id;
  RETURN json_build_object(
    'total', v_total,
    'used', v_used,
    'remaining', GREATEST(v_total - v_used, 0)
  );
END;
$$;

-- 使用免费额度解锁项目
CREATE OR REPLACE FUNCTION public.unlock_project_with_free_quota(p_project_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_access public.content_access;
  v_role public.user_role;
  v_tier public.member_tier;
  v_existing boolean;
  v_quota json;
  v_remaining integer;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'reason', 'not_authenticated');
  END IF;

  SELECT access_level INTO v_access FROM public.projects WHERE id = p_project_id;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'reason', 'not_found');
  END IF;

  -- 免费内容无需解锁
  IF v_access = 'free'::public.content_access THEN
    RETURN json_build_object('success', true, 'reason', 'free_content');
  END IF;

  -- 管理员直接放行
  SELECT role INTO v_role FROM public.profiles WHERE id = v_user_id;
  IF v_role = 'admin'::public.user_role THEN
    RETURN json_build_object('success', true, 'reason', 'admin');
  END IF;

  -- 检查用户等级本身是否有权限
  SELECT member_tier INTO v_tier FROM public.profiles WHERE id = v_user_id;
  IF v_access = 'member'::public.content_access AND v_tier IN ('member'::public.member_tier, 'pro'::public.member_tier) THEN
    RETURN json_build_object('success', true, 'reason', 'tier');
  END IF;
  IF v_access = 'pro'::public.content_access AND v_tier = 'pro'::public.member_tier THEN
    RETURN json_build_object('success', true, 'reason', 'tier');
  END IF;

  -- 检查是否已解锁
  SELECT EXISTS(SELECT 1 FROM public.user_unlock_records WHERE user_id = v_user_id AND project_id = p_project_id) INTO v_existing;
  IF v_existing THEN
    RETURN json_build_object('success', true, 'reason', 'already_unlocked');
  END IF;

  -- 检查剩余额度
  v_quota := public.get_remaining_unlock_count(v_user_id);
  v_remaining := (v_quota ->> 'remaining')::integer;
  IF v_remaining <= 0 THEN
    RETURN json_build_object('success', false, 'reason', 'no_quota');
  END IF;

  -- 扣除额度并记录
  INSERT INTO public.user_unlock_records (user_id, project_id) VALUES (v_user_id, p_project_id);

  RETURN json_build_object('success', true, 'reason', 'quota_used', 'remaining', v_remaining - 1);
END;
$$;

-- 修改 get_project_content：已解锁的付费内容也可以访问
CREATE OR REPLACE FUNCTION public.get_project_content(p_project_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_access       public.content_access;
  v_content      text;
  v_content_en   text;
  v_external_url text;
  v_tier         public.member_tier;
  v_role         public.user_role;
  v_unlocked     boolean;
  v_allowed      boolean;
BEGIN
  SELECT access_level, content, content_en, external_url
    INTO v_access, v_content, v_content_en, v_external_url
  FROM public.projects
  WHERE id = p_project_id;

  IF NOT FOUND THEN
    RETURN json_build_object('allowed', false, 'reason', 'not_found');
  END IF;

  IF auth.uid() IS NOT NULL THEN
    SELECT role, member_tier INTO v_role, v_tier
    FROM public.profiles WHERE id = auth.uid();
  END IF;

  IF v_role = 'admin'::public.user_role THEN
    v_allowed := true;
  ELSE
    v_tier := COALESCE(v_tier, 'guest'::public.member_tier);

    v_allowed := CASE v_access
      WHEN 'free'::public.content_access   THEN true
      WHEN 'member'::public.content_access THEN v_tier IN ('member'::public.member_tier, 'pro'::public.member_tier)
      WHEN 'pro'::public.content_access    THEN v_tier = 'pro'::public.member_tier
      ELSE false
    END;

    -- 如果用户已用免费额度解锁，也允许访问
    IF NOT v_allowed AND auth.uid() IS NOT NULL THEN
      SELECT EXISTS(SELECT 1 FROM public.user_unlock_records WHERE user_id = auth.uid() AND project_id = p_project_id) INTO v_unlocked;
      IF v_unlocked THEN
        v_allowed := true;
      END IF;
    END IF;
  END IF;

  IF NOT v_allowed THEN
    RETURN json_build_object('allowed', false, 'reason', 'insufficient_tier');
  END IF;

  RETURN json_build_object(
    'allowed', true,
    'content', v_content,
    'content_en', v_content_en,
    'external_url', v_external_url
  );
END;
$$;

-- 4. 增强活动报名表字段
ALTER TABLE public.event_registrations
  ADD COLUMN IF NOT EXISTS name text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS phone text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS wechat text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS note text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- 5. 创建/更新活动报名 RPC（支持报名表单字段）
CREATE OR REPLACE FUNCTION public.register_event(
  p_event_id uuid,
  p_name text DEFAULT '',
  p_phone text DEFAULT '',
  p_wechat text DEFAULT '',
  p_note text DEFAULT ''
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_event public.events%ROWTYPE;
  v_existing boolean;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'reason', 'not_authenticated');
  END IF;

  SELECT * INTO v_event FROM public.events WHERE id = p_event_id;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'reason', 'not_found');
  END IF;

  SELECT EXISTS(SELECT 1 FROM public.event_registrations WHERE event_id = p_event_id AND user_id = v_user_id) INTO v_existing;
  IF v_existing THEN
    RETURN json_build_object('success', false, 'reason', 'already_registered');
  END IF;

  IF v_event.capacity > 0 AND v_event.registered >= v_event.capacity THEN
    RETURN json_build_object('success', false, 'reason', 'full');
  END IF;

  INSERT INTO public.event_registrations (event_id, user_id, name, phone, wechat, note, updated_at)
  VALUES (p_event_id, v_user_id, p_name, p_phone, p_wechat, p_note, now());

  UPDATE public.events SET registered = registered + 1 WHERE id = p_event_id;

  RETURN json_build_object(
    'success', true,
    'registered', v_event.registered + 1,
    'capacity', v_event.capacity
  );
END;
$$;

-- 取消报名
CREATE OR REPLACE FUNCTION public.cancel_event_registration(p_event_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_event public.events%ROWTYPE;
  v_existing boolean;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN json_build_object('success', false, 'reason', 'not_authenticated');
  END IF;

  SELECT * INTO v_event FROM public.events WHERE id = p_event_id;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'reason', 'not_found');
  END IF;

  SELECT EXISTS(SELECT 1 FROM public.event_registrations WHERE event_id = p_event_id AND user_id = v_user_id) INTO v_existing;
  IF NOT v_existing THEN
    RETURN json_build_object('success', false, 'reason', 'not_registered');
  END IF;

  DELETE FROM public.event_registrations WHERE event_id = p_event_id AND user_id = v_user_id;
  UPDATE public.events SET registered = GREATEST(registered - 1, 0) WHERE id = p_event_id;

  RETURN json_build_object(
    'success', true,
    'registered', GREATEST(v_event.registered - 1, 0),
    'capacity', v_event.capacity
  );
END;
$$;

-- 6. 管理员导出报名人员视图
CREATE OR REPLACE VIEW public.event_registration_export AS
SELECT
  er.id,
  er.event_id,
  e.title AS event_title,
  e.title_en AS event_title_en,
  e.event_date,
  e.city,
  e.theme,
  er.user_id,
  p.username,
  p.nickname,
  p.email,
  er.name,
  er.phone,
  er.wechat,
  er.note,
  er.created_at,
  er.updated_at
FROM public.event_registrations er
JOIN public.events e ON er.event_id = e.id
JOIN public.profiles p ON er.user_id = p.id;

-- 7. 权限授权
GRANT EXECUTE ON FUNCTION public.get_remaining_unlock_count(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.unlock_project_with_free_quota(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_free_unlock_quota(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.register_event(uuid, text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_event_registration(uuid) TO authenticated;
GRANT SELECT ON public.event_registration_export TO authenticated;

