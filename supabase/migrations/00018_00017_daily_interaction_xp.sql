-- 经验值防刷：每日首次点赞/收藏才给经验值
CREATE TABLE public.user_interaction_xp_records (
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  target_type text NOT NULL CHECK (target_type IN ('case', 'project', 'event')),
  target_id uuid NOT NULL,
  interaction text NOT NULL CHECK (interaction IN ('like', 'favorite')),
  awarded_date date NOT NULL DEFAULT current_date,
  actor_xp_awarded boolean NOT NULL DEFAULT false,
  owner_xp_awarded boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, target_type, target_id, interaction, awarded_date)
);

ALTER TABLE public.user_interaction_xp_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own interaction xp records"
  ON public.user_interaction_xp_records
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins manage interaction xp records"
  ON public.user_interaction_xp_records
  FOR ALL TO authenticated
  USING (public.get_user_role(auth.uid()) = 'admin'::public.user_role)
  WITH CHECK (public.get_user_role(auth.uid()) = 'admin'::public.user_role);

-- 更新互动切换 RPC：加入每日经验值上限判定
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
  v_views integer;
  v_action text;
  v_today date := current_date;
  v_actor_awarded_today boolean;
  v_owner_awarded_today boolean;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION '请先登录' USING ERRCODE = '28000';
  END IF;
  IF auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION '无权代替其他用户操作' USING ERRCODE = '42501';
  END IF;

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

  IF p_target_type = 'project' THEN
    SELECT created_by INTO v_owner FROM public.projects WHERE id = p_target_id;
  ELSIF p_target_type = 'case' THEN
    v_owner := NULL; -- cases 表无 created_by
  ELSE
    -- events 表无 created_by，保持 NULL
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

    SELECT EXISTS(
      SELECT 1 FROM public.user_interaction_xp_records
      WHERE user_id = p_user_id
        AND interaction = p_interaction
        AND awarded_date = v_today
        AND actor_xp_awarded = true
    ) INTO v_actor_awarded_today;

    IF NOT v_actor_awarded_today THEN
      v_actor_xp := 1;
      UPDATE public.profiles SET xp = xp + v_actor_xp WHERE id = p_user_id;
      PERFORM public.recalculate_user_level(p_user_id);
    END IF;

    SELECT EXISTS(
      SELECT 1 FROM public.user_interaction_xp_records
      WHERE user_id = p_user_id
        AND target_type = p_target_type
        AND target_id = p_target_id
        AND interaction = p_interaction
        AND awarded_date = v_today
        AND owner_xp_awarded = true
    ) INTO v_owner_awarded_today;

    IF NOT v_owner_awarded_today AND v_owner IS NOT NULL AND v_owner <> p_user_id THEN
      IF p_interaction = 'like' THEN
        v_owner_xp := 3;
      ELSE
        v_owner_xp := 6;
      END IF;
      UPDATE public.profiles SET xp = xp + v_owner_xp WHERE id = v_owner;
      PERFORM public.recalculate_user_level(v_owner);
    END IF;

    INSERT INTO public.user_interaction_xp_records (
      user_id, target_type, target_id, interaction, awarded_date,
      actor_xp_awarded, owner_xp_awarded
    ) VALUES (
      p_user_id, p_target_type, p_target_id, p_interaction, v_today,
      v_actor_xp > 0, v_owner_xp > 0
    )
    ON CONFLICT (user_id, target_type, target_id, interaction, awarded_date)
    DO UPDATE SET
      actor_xp_awarded = public.user_interaction_xp_records.actor_xp_awarded OR (EXCLUDED.actor_xp_awarded),
      owner_xp_awarded = public.user_interaction_xp_records.owner_xp_awarded OR (EXCLUDED.owner_xp_awarded),
      created_at = now();
  END IF;

  IF p_target_type = 'project' THEN
    UPDATE public.projects SET views = GREATEST(views, likes + 1, favorites + 1) WHERE id = p_target_id;
    SELECT likes, favorites, views INTO v_likes, v_favorites, v_views FROM public.projects WHERE id = p_target_id;
  ELSIF p_target_type = 'case' THEN
    UPDATE public.cases SET views = GREATEST(views, likes + 1, favorites + 1) WHERE id = p_target_id;
    SELECT likes, favorites, views INTO v_likes, v_favorites, v_views FROM public.cases WHERE id = p_target_id;
  ELSE
    UPDATE public.events SET views = GREATEST(views, likes + 1, favorites + 1) WHERE id = p_target_id;
    SELECT likes, favorites, views INTO v_likes, v_favorites, v_views FROM public.events WHERE id = p_target_id;
  END IF;

  RETURN json_build_object(
    'action', v_action,
    'actor_xp', v_actor_xp,
    'owner_xp', v_owner_xp,
    'likes', v_likes,
    'favorites', v_favorites,
    'views', v_views
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.toggle_interaction_v2(uuid, text, uuid, text) TO authenticated;