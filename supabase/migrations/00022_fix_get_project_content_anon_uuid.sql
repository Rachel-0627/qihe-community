-- 修复匿名访问 get_project_content 时 auth.uid() 返回 'anon' 字符串导致的 UUID 类型错误
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
  v_is_auth      boolean;
BEGIN
  SELECT access_level, content, content_en, external_url
    INTO v_access, v_content, v_content_en, v_external_url
  FROM public.projects
  WHERE id = p_project_id;

  IF NOT FOUND THEN
    RETURN json_build_object('allowed', false, 'reason', 'not_found');
  END IF;

  -- 仅当用户已登录（role = authenticated）时才查询 profiles，避免 'anon' 字符串被当作 UUID
  v_is_auth := COALESCE(auth.jwt() ->> 'role', 'anon') = 'authenticated';

  IF v_is_auth THEN
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
    IF NOT v_allowed AND v_is_auth THEN
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

GRANT EXECUTE ON FUNCTION public.get_project_content(uuid) TO anon, authenticated;