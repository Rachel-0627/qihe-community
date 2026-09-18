-- 调整默认签到 XP 为 10
UPDATE public.site_settings SET value = '10', updated_at = now() WHERE key = 'daily_checkin_xp';

-- 项目表新增收藏数与创建者字段
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS favorites integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

-- 为已有项目自动填充 created_by 为当前 admin 测试账号（如存在），否则保持 NULL
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.profiles WHERE username = 'xinyu123456') THEN
    UPDATE public.projects SET created_by = (SELECT id FROM public.profiles WHERE username = 'xinyu123456') WHERE created_by IS NULL;
  END IF;
END $$;

-- 新增项目时默认创建者为当前登录用户
ALTER TABLE public.projects ALTER COLUMN created_by SET DEFAULT auth.uid();

-- 统一互动切换 RPC：处理 case / project 的点赞与收藏
-- 规则：每日签到 +10；点赞他人 +1；收藏他人 +1；被点赞 +3；被收藏 +6
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
