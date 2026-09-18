BEGIN;

-- 案例与项目表新增基础互动量字段
ALTER TABLE public.cases
  ADD COLUMN base_likes integer NOT NULL DEFAULT 0,
  ADD COLUMN base_favorites integer NOT NULL DEFAULT 0,
  ADD COLUMN base_views integer NOT NULL DEFAULT 0;

ALTER TABLE public.projects
  ADD COLUMN base_likes integer NOT NULL DEFAULT 0,
  ADD COLUMN base_favorites integer NOT NULL DEFAULT 0,
  ADD COLUMN base_views integer NOT NULL DEFAULT 0;

-- 活动表新增实际互动量与基础互动量字段
ALTER TABLE public.events
  ADD COLUMN likes integer NOT NULL DEFAULT 0,
  ADD COLUMN favorites integer NOT NULL DEFAULT 0,
  ADD COLUMN views integer NOT NULL DEFAULT 0,
  ADD COLUMN base_likes integer NOT NULL DEFAULT 0,
  ADD COLUMN base_favorites integer NOT NULL DEFAULT 0,
  ADD COLUMN base_views integer NOT NULL DEFAULT 0;

-- 扩展用户互动表，支持对活动点赞/收藏
ALTER TABLE public.user_interactions
  DROP CONSTRAINT user_interactions_target_type_check;

ALTER TABLE public.user_interactions
  ADD CONSTRAINT user_interactions_target_type_check
  CHECK (target_type IN ('case', 'project', 'event'));

-- 浏览量递增函数：案例 / 项目 / 活动
CREATE OR REPLACE FUNCTION public.increment_content_view(
  p_target_type text,
  p_target_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF p_target_type NOT IN ('case', 'project', 'event') THEN
    RAISE EXCEPTION 'Invalid target_type: %', p_target_type;
  END IF;

  IF p_target_type = 'case' THEN
    UPDATE public.cases SET views = views + 1 WHERE id = p_target_id;
  ELSIF p_target_type = 'project' THEN
    UPDATE public.projects SET views = views + 1 WHERE id = p_target_id;
  ELSE
    UPDATE public.events SET views = views + 1 WHERE id = p_target_id;
  END IF;
END;
$$;

-- 统一互动切换 RPC：支持 case / project / event
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
  IF p_target_type NOT IN ('case', 'project', 'event') OR p_interaction NOT IN ('like', 'favorite') THEN
    RAISE EXCEPTION 'Invalid target_type or interaction';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.user_interactions
    WHERE user_id = p_user_id
      AND target_type = p_target_type
      AND target_id = p_target_id
      AND interaction = p_interaction
  ) INTO v_exists;

  -- 项目创建者可获得 XP，活动暂无创建者字段，案例同理不奖励创建者 XP
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
    ELSE
      IF p_interaction = 'like' THEN
        UPDATE public.events SET likes = GREATEST(0, likes - 1) WHERE id = p_target_id;
      ELSE
        UPDATE public.events SET favorites = GREATEST(0, favorites - 1) WHERE id = p_target_id;
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
    ELSE
      IF p_interaction = 'like' THEN
        UPDATE public.events SET likes = likes + 1 WHERE id = p_target_id;
      ELSE
        UPDATE public.events SET favorites = favorites + 1 WHERE id = p_target_id;
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
  ELSIF p_target_type = 'case' THEN
    SELECT likes, favorites INTO v_likes, v_favorites FROM public.cases WHERE id = p_target_id;
  ELSE
    SELECT likes, favorites INTO v_likes, v_favorites FROM public.events WHERE id = p_target_id;
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

COMMIT;