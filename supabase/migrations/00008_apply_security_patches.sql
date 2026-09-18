-- ============================================================
-- 安全加固合并脚本（P0-2 / P0-4 / P0-1 / P0-3 数据库部分）
-- ============================================================

-- P0-2 修复：普通用户可以自行修改 member_tier / xp / level 等特权字段
-- ① UPDATE 策略
DROP POLICY IF EXISTS "Users update own profile" ON public.profiles;
CREATE POLICY "Users update own profile"
ON public.profiles FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- ② 特权字段守卫触发器
CREATE OR REPLACE FUNCTION public.guard_profile_privileged_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF current_user <> 'authenticated' THEN
    RETURN NEW;
  END IF;

  IF public.get_user_role(auth.uid()) = 'admin'::public.user_role THEN
    RETURN NEW;
  END IF;

  NEW.id                 := OLD.id;
  NEW.email              := OLD.email;
  NEW.phone              := OLD.phone;
  NEW.username           := OLD.username;
  NEW.role               := OLD.role;
  NEW.member_tier        := OLD.member_tier;
  NEW.community_identity := OLD.community_identity;
  NEW.xp                 := OLD.xp;
  NEW.level              := OLD.level;
  NEW.created_at         := OLD.created_at;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_profile_privileged_fields ON public.profiles;
CREATE TRIGGER guard_profile_privileged_fields
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.guard_profile_privileged_fields();

-- P0-4 修复：签到 / 点赞函数信任前端传入的 user_id
-- ① 签到
CREATE OR REPLACE FUNCTION public.check_in(p_user_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_date date := current_date;
  v_reward integer;
  v_total_xp integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION '请先登录' USING ERRCODE = '28000';
  END IF;
  IF auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION '无权代替其他用户签到' USING ERRCODE = '42501';
  END IF;

  SELECT COALESCE(value::integer, 50) INTO v_reward
  FROM public.site_settings WHERE key = 'daily_checkin_xp';

  IF v_reward IS NULL THEN
    v_reward := 50;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.user_checkins
    WHERE user_id = p_user_id AND checkin_date = v_date
  ) THEN
    RETURN json_build_object('success', false, 'already_checked_in', true, 'xp_awarded', 0);
  END IF;

  INSERT INTO public.user_checkins (user_id, checkin_date, xp_awarded)
  VALUES (p_user_id, v_date, v_reward);

  UPDATE public.profiles
  SET xp = xp + v_reward
  WHERE id = p_user_id;

  PERFORM public.recalculate_user_level(p_user_id);

  SELECT xp INTO v_total_xp FROM public.profiles WHERE id = p_user_id;

  RETURN json_build_object('success', true, 'xp_awarded', v_reward, 'total_xp', v_total_xp);
END;
$$;

-- ② 点赞 / 收藏
CREATE OR REPLACE FUNCTION public.toggle_interaction_v2(
  p_user_id uuid,
  p_target_type text,
  p_target_id uuid,
  p_interaction text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_exists boolean;
  v_owner uuid;
  v_actor_xp integer := 0;
  v_owner_xp integer := 0;
  v_likes integer;
  v_favorites integer;
  v_action text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION '请先登录' USING ERRCODE = '28000';
  END IF;
  IF auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION '无权代替其他用户操作' USING ERRCODE = '42501';
  END IF;

  IF p_target_type NOT IN ('case', 'project') OR p_interaction NOT IN ('like', 'favorite') THEN
    RAISE EXCEPTION 'Invalid target_type or interaction';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.user_interactions
    WHERE user_id = p_user_id
      AND target_type = p_target_type
      AND target_id = p_target_id
      AND interaction = p_interaction
  ) INTO v_exists;

  IF p_target_type = 'project' THEN
    SELECT created_by INTO v_owner FROM public.projects WHERE id = p_target_id;
    IF p_interaction = 'like' THEN
      v_actor_xp := 1;
      v_owner_xp := 3;
    ELSIF p_interaction = 'favorite' THEN
      v_actor_xp := 1;
      v_owner_xp := 6;
    END IF;
  END IF;

  IF v_exists THEN
    DELETE FROM public.user_interactions
    WHERE user_id = p_user_id
      AND target_type = p_target_type
      AND target_id = p_target_id
      AND interaction = p_interaction;

    IF p_target_type = 'case' THEN
      IF p_interaction = 'like' THEN
        UPDATE public.cases SET likes = GREATEST(0, likes - 1) WHERE id = p_target_id;
      ELSE
        UPDATE public.cases SET favorites = GREATEST(0, favorites - 1) WHERE id = p_target_id;
      END IF;
    ELSIF p_target_type = 'project' THEN
      IF p_interaction = 'like' THEN
        UPDATE public.projects SET likes = GREATEST(0, likes - 1) WHERE id = p_target_id;
      ELSE
        UPDATE public.projects SET favorites = GREATEST(0, favorites - 1) WHERE id = p_target_id;
      END IF;
    END IF;

    v_action := 'removed';
    v_actor_xp := 0;
    v_owner_xp := 0;
  ELSE
    INSERT INTO public.user_interactions (user_id, target_type, target_id, interaction)
    VALUES (p_user_id, p_target_type, p_target_id, p_interaction);

    IF p_target_type = 'case' THEN
      IF p_interaction = 'like' THEN
        UPDATE public.cases SET likes = likes + 1 WHERE id = p_target_id;
      ELSE
        UPDATE public.cases SET favorites = favorites + 1 WHERE id = p_target_id;
      END IF;
    ELSIF p_target_type = 'project' THEN
      IF p_interaction = 'like' THEN
        UPDATE public.projects SET likes = likes + 1 WHERE id = p_target_id;
      ELSE
        UPDATE public.projects SET favorites = favorites + 1 WHERE id = p_target_id;
      END IF;
    END IF;

    v_action := 'added';

    IF v_actor_xp > 0 THEN
      UPDATE public.profiles SET xp = xp + v_actor_xp WHERE id = p_user_id;
      PERFORM public.recalculate_user_level(p_user_id);
    END IF;

    IF v_owner_xp > 0 AND v_owner IS NOT NULL AND v_owner <> p_user_id THEN
      UPDATE public.profiles SET xp = xp + v_owner_xp WHERE id = v_owner;
      PERFORM public.recalculate_user_level(v_owner);
    END IF;
  END IF;

  IF p_target_type = 'project' THEN
    SELECT likes, favorites INTO v_likes, v_favorites FROM public.projects WHERE id = p_target_id;
  ELSE
    SELECT likes, favorites INTO v_likes, v_favorites FROM public.cases WHERE id = p_target_id;
  END IF;

  RETURN json_build_object(
    'action', v_action,
    'actor_xp', v_actor_xp,
    'owner_xp', v_owner_xp,
    'likes', v_likes,
    'favorites', v_favorites
  );
END;
$$;

-- ③ 收回不必要的调用权限
REVOKE EXECUTE ON FUNCTION public.check_in(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.toggle_interaction_v2(uuid, text, uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.recalculate_user_level(uuid) FROM PUBLIC, anon, authenticated;

-- P0-1 修复（数据库部分）：AI 助手按用户限流
-- ① 用量表
CREATE TABLE IF NOT EXISTS public.ai_usage (
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  usage_date date NOT NULL DEFAULT current_date,
  used_count integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, usage_date)
);

ALTER TABLE public.ai_usage ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own ai usage" ON public.ai_usage;
CREATE POLICY "Users view own ai usage"
ON public.ai_usage FOR SELECT TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins view all ai usage" ON public.ai_usage;
CREATE POLICY "Admins view all ai usage"
ON public.ai_usage FOR SELECT TO authenticated
USING (public.get_user_role(auth.uid()) = 'admin'::public.user_role);

-- ② 每日上限
INSERT INTO public.site_settings (key, value) VALUES ('ai_daily_limit', '30')
ON CONFLICT (key) DO NOTHING;

-- ③ 扣额度函数
CREATE OR REPLACE FUNCTION public.consume_ai_quota(p_user_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_limit integer;
  v_count integer;
BEGIN
  SELECT COALESCE(value::integer, 30) INTO v_limit
  FROM public.site_settings WHERE key = 'ai_daily_limit';

  IF v_limit IS NULL THEN
    v_limit := 30;
  END IF;

  IF v_limit <= 0 THEN
    RETURN json_build_object('allowed', false, 'used', 0, 'limit', v_limit);
  END IF;

  INSERT INTO public.ai_usage AS u (user_id, usage_date, used_count, updated_at)
  VALUES (p_user_id, current_date, 1, now())
  ON CONFLICT (user_id, usage_date) DO UPDATE
    SET used_count = u.used_count + 1,
        updated_at = now()
    WHERE u.used_count < v_limit
  RETURNING u.used_count INTO v_count;

  IF v_count IS NULL THEN
    SELECT used_count INTO v_count
    FROM public.ai_usage
    WHERE user_id = p_user_id AND usage_date = current_date;

    RETURN json_build_object('allowed', false, 'used', COALESCE(v_count, 0), 'limit', v_limit);
  END IF;

  RETURN json_build_object('allowed', true, 'used', v_count, 'limit', v_limit);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.consume_ai_quota(uuid) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.consume_ai_quota(uuid) TO service_role;

-- P0-3 修复：付费项目内容在服务端做门禁
-- ① 收回表级 SELECT，改为按列授权
REVOKE SELECT ON public.projects FROM PUBLIC;
REVOKE SELECT ON public.projects FROM anon;
REVOKE SELECT ON public.projects FROM authenticated;

GRANT SELECT (
  id, title, title_en, summary, summary_en, cover_url, video_url,
  scene, scene_en, maturity, maturity_en, access_level,
  likes, views, favorites, is_hot, sort_order, created_at, created_by
) ON public.projects TO anon, authenticated;

GRANT SELECT ON public.projects TO service_role;

-- ② 取正文的唯一入口
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

GRANT EXECUTE ON FUNCTION public.get_project_content(uuid) TO anon, authenticated;