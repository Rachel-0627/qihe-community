-- ============================================================
-- SECTION: SCHEMA
-- ============================================================

--
-- PostgreSQL database dump
--


-- Dumped from database version 17.6
-- Dumped by pg_dump version 17.6

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA IF NOT EXISTS "public";


--
-- Name: SCHEMA "public"; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA "public" IS 'standard public schema';


--
-- Name: pg_graphql; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";


--
-- Name: EXTENSION "pg_graphql"; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION "pg_graphql" IS 'pg_graphql: GraphQL support';


--
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";


--
-- Name: EXTENSION "pgcrypto"; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION "pgcrypto" IS 'cryptographic functions';


--
-- Name: supabase_vault; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";


--
-- Name: EXTENSION "supabase_vault"; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION "supabase_vault" IS 'Supabase Vault Extension';


--
-- Name: uuid-ossp; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";


--
-- Name: EXTENSION "uuid-ossp"; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION "uuid-ossp" IS 'generate universally unique identifiers (UUIDs)';


--
-- Name: community_identity; Type: TYPE; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typname = 'community_identity'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE TYPE "public"."community_identity" AS ENUM (
    'user',
    'creator',
    'builder',
    'contributor'
);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: content_access; Type: TYPE; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typname = 'content_access'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE TYPE "public"."content_access" AS ENUM (
    'free',
    'member',
    'pro',
    'private'
);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: member_tier; Type: TYPE; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typname = 'member_tier'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE TYPE "public"."member_tier" AS ENUM (
    'guest',
    'explorer',
    'member',
    'pro'
);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: user_role; Type: TYPE; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typname = 'user_role'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE TYPE "public"."user_role" AS ENUM (
    'user',
    'admin'
);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: cancel_event_registration("uuid"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE OR REPLACE FUNCTION "public"."cancel_event_registration"("p_event_id" "uuid") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


--
-- Name: check_in("uuid"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE OR REPLACE FUNCTION "public"."check_in"("p_user_id" "uuid") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


--
-- Name: consume_ai_quota("uuid"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE OR REPLACE FUNCTION "public"."consume_ai_quota"("p_user_id" "uuid") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


--
-- Name: decrement_event_registered("uuid"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE OR REPLACE FUNCTION "public"."decrement_event_registered"("event_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  UPDATE public.events SET registered = GREATEST(registered - 1, 0) WHERE id = event_id;
END; $$;


--
-- Name: get_project_content("uuid"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE OR REPLACE FUNCTION "public"."get_project_content"("p_project_id" "uuid") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


--
-- Name: get_remaining_unlock_count("uuid"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE OR REPLACE FUNCTION "public"."get_remaining_unlock_count"("p_user_id" "uuid" DEFAULT NULL::"uuid") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


--
-- Name: get_user_free_unlock_quota("uuid"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE OR REPLACE FUNCTION "public"."get_user_free_unlock_quota"("p_user_id" "uuid") RETURNS integer
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


--
-- Name: get_user_role("uuid"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE OR REPLACE FUNCTION "public"."get_user_role"("uid" "uuid") RETURNS "public"."user_role"
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$ SELECT role FROM public.profiles WHERE id = uid; $$;


--
-- Name: guard_profile_privileged_fields(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE OR REPLACE FUNCTION "public"."guard_profile_privileged_fields"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


--
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  INSERT INTO public.profiles (id, email, phone, role, username)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.phone,
    'user'::public.user_role,
    split_part(COALESCE(NEW.email, 'user'), '@', 1)
  );
  RETURN NEW;
END;
$$;


--
-- Name: increment_content_view("text", "uuid"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE OR REPLACE FUNCTION "public"."increment_content_view"("p_target_type" "text", "p_target_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


--
-- Name: increment_event_registered("uuid"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE OR REPLACE FUNCTION "public"."increment_event_registered"("event_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  UPDATE public.events SET registered = registered + 1 WHERE id = event_id;
END; $$;


--
-- Name: recalculate_user_level("uuid"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE OR REPLACE FUNCTION "public"."recalculate_user_level"("p_user_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  UPDATE public.profiles
  SET level = COALESCE((
    SELECT MAX(level) FROM public.level_config WHERE xp_threshold <= public.profiles.xp
  ), 1)
  WHERE id = p_user_id;
END;
$$;


--
-- Name: register_event("uuid", "text", "text", "text", "text"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE OR REPLACE FUNCTION "public"."register_event"("p_event_id" "uuid", "p_name" "text" DEFAULT ''::"text", "p_phone" "text" DEFAULT ''::"text", "p_wechat" "text" DEFAULT ''::"text", "p_note" "text" DEFAULT ''::"text") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


--
-- Name: toggle_interaction_v2("uuid", "text", "uuid", "text"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE OR REPLACE FUNCTION "public"."toggle_interaction_v2"("p_user_id" "uuid", "p_target_type" "text", "p_target_id" "uuid", "p_interaction" "text") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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

  -- 仅 projects 表有 created_by；cases/events 无作者归属，owner 为 NULL
  v_owner := NULL;
  IF p_target_type = 'project' THEN
    SELECT created_by INTO v_owner FROM public.projects WHERE id = p_target_id;
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


--
-- Name: unlock_project_with_free_quota("uuid"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE OR REPLACE FUNCTION "public"."unlock_project_with_free_quota"("p_project_id" "uuid") RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
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


SET default_tablespace = '';

SET default_table_access_method = "heap";

--
-- Name: ai_usage; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS "public"."ai_usage" (
    "user_id" "uuid" NOT NULL,
    "usage_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "used_count" integer DEFAULT 0 NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


--
-- Name: assistant_config; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS "public"."assistant_config" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "persona_name" "text" DEFAULT 'AI社区助手'::"text" NOT NULL,
    "persona_name_en" "text" DEFAULT 'AI Community Assistant'::"text" NOT NULL,
    "system_prompt" "text" DEFAULT ''::"text" NOT NULL,
    "system_prompt_en" "text" DEFAULT ''::"text" NOT NULL,
    "greeting" "text" DEFAULT ''::"text" NOT NULL,
    "greeting_en" "text" DEFAULT ''::"text" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


--
-- Name: cases; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS "public"."cases" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "title_en" "text" DEFAULT ''::"text" NOT NULL,
    "summary" "text" DEFAULT ''::"text" NOT NULL,
    "summary_en" "text" DEFAULT ''::"text" NOT NULL,
    "cover_url" "text" DEFAULT ''::"text" NOT NULL,
    "category_id" "uuid",
    "content" "text" DEFAULT '[]'::"jsonb" NOT NULL,
    "content_en" "text" DEFAULT '[]'::"jsonb" NOT NULL,
    "author" "text" DEFAULT ''::"text" NOT NULL,
    "author_en" "text" DEFAULT ''::"text" NOT NULL,
    "likes" integer DEFAULT 0 NOT NULL,
    "favorites" integer DEFAULT 0 NOT NULL,
    "views" integer DEFAULT 0 NOT NULL,
    "is_featured" boolean DEFAULT false NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "show_on_home" boolean DEFAULT true NOT NULL,
    "base_likes" integer DEFAULT 0 NOT NULL,
    "base_favorites" integer DEFAULT 0 NOT NULL,
    "base_views" integer DEFAULT 0 NOT NULL
);


--
-- Name: categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS "public"."categories" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "name_en" "text" DEFAULT ''::"text" NOT NULL,
    "slug" "text" NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "type" "text" DEFAULT 'case'::"text" NOT NULL
);


--
-- Name: event_filter_options; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS "public"."event_filter_options" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "group" "text" NOT NULL,
    "name" "text" NOT NULL,
    "name_en" "text" DEFAULT ''::"text" NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "event_filter_options_group_check" CHECK (("group" = ANY (ARRAY['city'::"text", 'theme'::"text"])))
);


--
-- Name: event_registrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS "public"."event_registrations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_id" "uuid" NOT NULL,
    "user_id" "uuid" DEFAULT "auth"."uid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "name" "text" DEFAULT ''::"text" NOT NULL,
    "phone" "text" DEFAULT ''::"text" NOT NULL,
    "wechat" "text" DEFAULT ''::"text" NOT NULL,
    "note" "text" DEFAULT ''::"text" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


--
-- Name: events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS "public"."events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "title_en" "text" DEFAULT ''::"text" NOT NULL,
    "summary" "text" DEFAULT ''::"text" NOT NULL,
    "summary_en" "text" DEFAULT ''::"text" NOT NULL,
    "cover_url" "text" DEFAULT ''::"text" NOT NULL,
    "city" "text" DEFAULT ''::"text" NOT NULL,
    "city_en" "text" DEFAULT ''::"text" NOT NULL,
    "theme" "text" DEFAULT ''::"text" NOT NULL,
    "theme_en" "text" DEFAULT ''::"text" NOT NULL,
    "location" "text" DEFAULT ''::"text" NOT NULL,
    "location_en" "text" DEFAULT ''::"text" NOT NULL,
    "event_date" timestamp with time zone DEFAULT "now"() NOT NULL,
    "capacity" integer DEFAULT 50 NOT NULL,
    "registered" integer DEFAULT 0 NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "show_on_home" boolean DEFAULT true NOT NULL,
    "likes" integer DEFAULT 0 NOT NULL,
    "favorites" integer DEFAULT 0 NOT NULL,
    "views" integer DEFAULT 0 NOT NULL,
    "base_likes" integer DEFAULT 0 NOT NULL,
    "base_favorites" integer DEFAULT 0 NOT NULL,
    "base_views" integer DEFAULT 0 NOT NULL
);


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS "public"."profiles" (
    "id" "uuid" NOT NULL,
    "email" "text",
    "phone" "text",
    "username" "text",
    "avatar_url" "text",
    "bio" "text",
    "role" "public"."user_role" DEFAULT 'user'::"public"."user_role" NOT NULL,
    "member_tier" "public"."member_tier" DEFAULT 'explorer'::"public"."member_tier" NOT NULL,
    "community_identity" "public"."community_identity" DEFAULT 'user'::"public"."community_identity" NOT NULL,
    "xp" integer DEFAULT 0 NOT NULL,
    "level" integer DEFAULT 1 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "nickname" "text"
);


--
-- Name: event_registration_export; Type: VIEW; Schema: public; Owner: -
--

CREATE OR REPLACE VIEW "public"."event_registration_export" AS
 SELECT "er"."id",
    "er"."event_id",
    "e"."title" AS "event_title",
    "e"."title_en" AS "event_title_en",
    "e"."event_date",
    "e"."city",
    "e"."theme",
    "er"."user_id",
    "p"."username",
    "p"."nickname",
    "p"."email",
    "er"."name",
    "er"."phone",
    "er"."wechat",
    "er"."note",
    "er"."created_at",
    "er"."updated_at"
   FROM (("public"."event_registrations" "er"
     JOIN "public"."events" "e" ON (("er"."event_id" = "e"."id")))
     JOIN "public"."profiles" "p" ON (("er"."user_id" = "p"."id")));


--
-- Name: knowledge_base; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS "public"."knowledge_base" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "content" "text" DEFAULT ''::"text" NOT NULL,
    "tags" "text" DEFAULT ''::"text" NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


--
-- Name: level_config; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS "public"."level_config" (
    "level" integer NOT NULL,
    "title" "text" NOT NULL,
    "title_en" "text" DEFAULT ''::"text" NOT NULL,
    "xp_threshold" integer DEFAULT 0 NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "free_unlock_count" integer DEFAULT 0 NOT NULL,
    CONSTRAINT "level_config_level_check" CHECK ((("level" >= 1) AND ("level" <= 10)))
);


--
-- Name: member_benefits; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS "public"."member_benefits" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tier" "public"."member_tier" NOT NULL,
    "benefit_key" "text" NOT NULL,
    "benefit_label" "text" NOT NULL,
    "benefit_label_en" "text" DEFAULT ''::"text" NOT NULL,
    "enabled" boolean DEFAULT true NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL
);


--
-- Name: project_filter_options; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS "public"."project_filter_options" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "group" "text" NOT NULL,
    "name" "text" NOT NULL,
    "name_en" "text" DEFAULT ''::"text" NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "is_featured" boolean DEFAULT false NOT NULL,
    CONSTRAINT "project_filter_options_group_check" CHECK (("group" = ANY (ARRAY['scene'::"text", 'maturity'::"text", 'category'::"text"])))
);


--
-- Name: projects; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS "public"."projects" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "title" "text" NOT NULL,
    "title_en" "text" DEFAULT ''::"text" NOT NULL,
    "summary" "text" DEFAULT ''::"text" NOT NULL,
    "summary_en" "text" DEFAULT ''::"text" NOT NULL,
    "cover_url" "text" DEFAULT ''::"text" NOT NULL,
    "content" "text" DEFAULT '[]'::"jsonb" NOT NULL,
    "content_en" "text" DEFAULT '[]'::"jsonb" NOT NULL,
    "video_url" "text" DEFAULT ''::"text" NOT NULL,
    "external_url" "text" DEFAULT ''::"text" NOT NULL,
    "scene" "text" DEFAULT '通用'::"text" NOT NULL,
    "scene_en" "text" DEFAULT 'General'::"text" NOT NULL,
    "maturity" "text" DEFAULT '概念'::"text" NOT NULL,
    "maturity_en" "text" DEFAULT 'Concept'::"text" NOT NULL,
    "access_level" "public"."content_access" DEFAULT 'free'::"public"."content_access" NOT NULL,
    "likes" integer DEFAULT 0 NOT NULL,
    "views" integer DEFAULT 0 NOT NULL,
    "is_hot" boolean DEFAULT false NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "favorites" integer DEFAULT 0 NOT NULL,
    "created_by" "uuid" DEFAULT "auth"."uid"(),
    "show_on_home" boolean DEFAULT true NOT NULL,
    "base_likes" integer DEFAULT 0 NOT NULL,
    "base_favorites" integer DEFAULT 0 NOT NULL,
    "base_views" integer DEFAULT 0 NOT NULL,
    "tech_stack" "text" DEFAULT ''::"text" NOT NULL,
    "tech_stack_en" "text" DEFAULT ''::"text" NOT NULL
);


--
-- Name: public_profiles; Type: VIEW; Schema: public; Owner: -
--

CREATE OR REPLACE VIEW "public"."public_profiles" AS
 SELECT "id",
    "username",
    "avatar_url",
    "bio",
    "member_tier",
    "community_identity",
    "level",
    "xp"
   FROM "public"."profiles";


--
-- Name: site_content; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS "public"."site_content" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "section" "text" NOT NULL,
    "key" "text" NOT NULL,
    "value" "text" DEFAULT ''::"text" NOT NULL,
    "value_en" "text" DEFAULT ''::"text" NOT NULL,
    "image_url" "text" DEFAULT ''::"text" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


--
-- Name: site_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS "public"."site_settings" (
    "key" "text" NOT NULL,
    "value" "text" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


--
-- Name: user_checkins; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS "public"."user_checkins" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "checkin_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "xp_awarded" integer DEFAULT 50 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


--
-- Name: user_interaction_xp_records; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS "public"."user_interaction_xp_records" (
    "user_id" "uuid" NOT NULL,
    "target_type" "text" NOT NULL,
    "target_id" "uuid" NOT NULL,
    "interaction" "text" NOT NULL,
    "awarded_date" "date" DEFAULT CURRENT_DATE NOT NULL,
    "actor_xp_awarded" boolean DEFAULT false NOT NULL,
    "owner_xp_awarded" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "user_interaction_xp_records_interaction_check" CHECK (("interaction" = ANY (ARRAY['like'::"text", 'favorite'::"text"]))),
    CONSTRAINT "user_interaction_xp_records_target_type_check" CHECK (("target_type" = ANY (ARRAY['case'::"text", 'project'::"text", 'event'::"text"])))
);


--
-- Name: user_interactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS "public"."user_interactions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" DEFAULT "auth"."uid"() NOT NULL,
    "target_type" "text" NOT NULL,
    "target_id" "uuid" NOT NULL,
    "interaction" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "user_interactions_interaction_check" CHECK (("interaction" = ANY (ARRAY['like'::"text", 'favorite'::"text"]))),
    CONSTRAINT "user_interactions_target_type_check" CHECK (("target_type" = ANY (ARRAY['case'::"text", 'project'::"text", 'event'::"text"])))
);


--
-- Name: user_unlock_records; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE IF NOT EXISTS "public"."user_unlock_records" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" DEFAULT "auth"."uid"() NOT NULL,
    "project_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


--
-- Name: ai_usage ai_usage_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'ai_usage_pkey'
      AND n.nspname = 'public'
      AND c.relname = 'ai_usage'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."ai_usage"
    ADD CONSTRAINT "ai_usage_pkey" PRIMARY KEY ("user_id", "usage_date");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: assistant_config assistant_config_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'assistant_config_pkey'
      AND n.nspname = 'public'
      AND c.relname = 'assistant_config'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."assistant_config"
    ADD CONSTRAINT "assistant_config_pkey" PRIMARY KEY ("id");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: cases cases_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'cases_pkey'
      AND n.nspname = 'public'
      AND c.relname = 'cases'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."cases"
    ADD CONSTRAINT "cases_pkey" PRIMARY KEY ("id");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: categories categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'categories_pkey'
      AND n.nspname = 'public'
      AND c.relname = 'categories'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."categories"
    ADD CONSTRAINT "categories_pkey" PRIMARY KEY ("id");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: categories categories_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'categories_slug_key'
      AND n.nspname = 'public'
      AND c.relname = 'categories'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."categories"
    ADD CONSTRAINT "categories_slug_key" UNIQUE ("slug");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: event_filter_options event_filter_options_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'event_filter_options_pkey'
      AND n.nspname = 'public'
      AND c.relname = 'event_filter_options'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."event_filter_options"
    ADD CONSTRAINT "event_filter_options_pkey" PRIMARY KEY ("id");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: event_registrations event_registrations_event_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'event_registrations_event_id_user_id_key'
      AND n.nspname = 'public'
      AND c.relname = 'event_registrations'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."event_registrations"
    ADD CONSTRAINT "event_registrations_event_id_user_id_key" UNIQUE ("event_id", "user_id");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: event_registrations event_registrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'event_registrations_pkey'
      AND n.nspname = 'public'
      AND c.relname = 'event_registrations'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."event_registrations"
    ADD CONSTRAINT "event_registrations_pkey" PRIMARY KEY ("id");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: events events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'events_pkey'
      AND n.nspname = 'public'
      AND c.relname = 'events'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."events"
    ADD CONSTRAINT "events_pkey" PRIMARY KEY ("id");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: knowledge_base knowledge_base_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'knowledge_base_pkey'
      AND n.nspname = 'public'
      AND c.relname = 'knowledge_base'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."knowledge_base"
    ADD CONSTRAINT "knowledge_base_pkey" PRIMARY KEY ("id");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: level_config level_config_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'level_config_pkey'
      AND n.nspname = 'public'
      AND c.relname = 'level_config'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."level_config"
    ADD CONSTRAINT "level_config_pkey" PRIMARY KEY ("level");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: member_benefits member_benefits_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'member_benefits_pkey'
      AND n.nspname = 'public'
      AND c.relname = 'member_benefits'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."member_benefits"
    ADD CONSTRAINT "member_benefits_pkey" PRIMARY KEY ("id");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: member_benefits member_benefits_tier_benefit_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'member_benefits_tier_benefit_key_key'
      AND n.nspname = 'public'
      AND c.relname = 'member_benefits'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."member_benefits"
    ADD CONSTRAINT "member_benefits_tier_benefit_key_key" UNIQUE ("tier", "benefit_key");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'profiles_pkey'
      AND n.nspname = 'public'
      AND c.relname = 'profiles'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_pkey" PRIMARY KEY ("id");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: profiles profiles_username_key; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'profiles_username_key'
      AND n.nspname = 'public'
      AND c.relname = 'profiles'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_username_key" UNIQUE ("username");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: project_filter_options project_filter_options_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'project_filter_options_pkey'
      AND n.nspname = 'public'
      AND c.relname = 'project_filter_options'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."project_filter_options"
    ADD CONSTRAINT "project_filter_options_pkey" PRIMARY KEY ("id");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: projects projects_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'projects_pkey'
      AND n.nspname = 'public'
      AND c.relname = 'projects'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."projects"
    ADD CONSTRAINT "projects_pkey" PRIMARY KEY ("id");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: site_content site_content_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'site_content_pkey'
      AND n.nspname = 'public'
      AND c.relname = 'site_content'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."site_content"
    ADD CONSTRAINT "site_content_pkey" PRIMARY KEY ("id");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: site_content site_content_section_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'site_content_section_key_key'
      AND n.nspname = 'public'
      AND c.relname = 'site_content'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."site_content"
    ADD CONSTRAINT "site_content_section_key_key" UNIQUE ("section", "key");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: site_settings site_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'site_settings_pkey'
      AND n.nspname = 'public'
      AND c.relname = 'site_settings'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."site_settings"
    ADD CONSTRAINT "site_settings_pkey" PRIMARY KEY ("key");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: user_checkins user_checkins_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'user_checkins_pkey'
      AND n.nspname = 'public'
      AND c.relname = 'user_checkins'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."user_checkins"
    ADD CONSTRAINT "user_checkins_pkey" PRIMARY KEY ("id");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: user_checkins user_checkins_user_id_checkin_date_key; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'user_checkins_user_id_checkin_date_key'
      AND n.nspname = 'public'
      AND c.relname = 'user_checkins'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."user_checkins"
    ADD CONSTRAINT "user_checkins_user_id_checkin_date_key" UNIQUE ("user_id", "checkin_date");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: user_interaction_xp_records user_interaction_xp_records_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'user_interaction_xp_records_pkey'
      AND n.nspname = 'public'
      AND c.relname = 'user_interaction_xp_records'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."user_interaction_xp_records"
    ADD CONSTRAINT "user_interaction_xp_records_pkey" PRIMARY KEY ("user_id", "target_type", "target_id", "interaction", "awarded_date");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: user_interactions user_interactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'user_interactions_pkey'
      AND n.nspname = 'public'
      AND c.relname = 'user_interactions'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."user_interactions"
    ADD CONSTRAINT "user_interactions_pkey" PRIMARY KEY ("id");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: user_interactions user_interactions_user_id_target_type_target_id_interaction_key; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'user_interactions_user_id_target_type_target_id_interaction_key'
      AND n.nspname = 'public'
      AND c.relname = 'user_interactions'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."user_interactions"
    ADD CONSTRAINT "user_interactions_user_id_target_type_target_id_interaction_key" UNIQUE ("user_id", "target_type", "target_id", "interaction");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: user_unlock_records user_unlock_records_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'user_unlock_records_pkey'
      AND n.nspname = 'public'
      AND c.relname = 'user_unlock_records'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."user_unlock_records"
    ADD CONSTRAINT "user_unlock_records_pkey" PRIMARY KEY ("id");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: user_unlock_records user_unlock_records_user_id_project_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'user_unlock_records_user_id_project_id_key'
      AND n.nspname = 'public'
      AND c.relname = 'user_unlock_records'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."user_unlock_records"
    ADD CONSTRAINT "user_unlock_records_user_id_project_id_key" UNIQUE ("user_id", "project_id");
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: idx_cases_home; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS "idx_cases_home" ON "public"."cases" USING "btree" ("show_on_home", "sort_order");


--
-- Name: idx_events_home; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS "idx_events_home" ON "public"."events" USING "btree" ("show_on_home", "sort_order");


--
-- Name: idx_projects_home; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX IF NOT EXISTS "idx_projects_home" ON "public"."projects" USING "btree" ("show_on_home", "sort_order");


--
-- Name: profiles guard_profile_privileged_fields; Type: TRIGGER; Schema: public; Owner: -
--

CREATE OR REPLACE TRIGGER "guard_profile_privileged_fields" BEFORE UPDATE ON "public"."profiles" FOR EACH ROW EXECUTE FUNCTION "public"."guard_profile_privileged_fields"();


--
-- Name: ai_usage ai_usage_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'ai_usage_user_id_fkey'
      AND n.nspname = 'public'
      AND c.relname = 'ai_usage'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."ai_usage"
    ADD CONSTRAINT "ai_usage_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: cases cases_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'cases_category_id_fkey'
      AND n.nspname = 'public'
      AND c.relname = 'cases'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."cases"
    ADD CONSTRAINT "cases_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE SET NULL;
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: event_registrations event_registrations_event_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'event_registrations_event_id_fkey'
      AND n.nspname = 'public'
      AND c.relname = 'event_registrations'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."event_registrations"
    ADD CONSTRAINT "event_registrations_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE CASCADE;
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: event_registrations event_registrations_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'event_registrations_user_id_fkey'
      AND n.nspname = 'public'
      AND c.relname = 'event_registrations'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."event_registrations"
    ADD CONSTRAINT "event_registrations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: profiles profiles_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'profiles_id_fkey'
      AND n.nspname = 'public'
      AND c.relname = 'profiles'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."profiles"
    ADD CONSTRAINT "profiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: projects projects_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'projects_created_by_fkey'
      AND n.nspname = 'public'
      AND c.relname = 'projects'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."projects"
    ADD CONSTRAINT "projects_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: user_checkins user_checkins_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'user_checkins_user_id_fkey'
      AND n.nspname = 'public'
      AND c.relname = 'user_checkins'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."user_checkins"
    ADD CONSTRAINT "user_checkins_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: user_interaction_xp_records user_interaction_xp_records_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'user_interaction_xp_records_user_id_fkey'
      AND n.nspname = 'public'
      AND c.relname = 'user_interaction_xp_records'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."user_interaction_xp_records"
    ADD CONSTRAINT "user_interaction_xp_records_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: user_interactions user_interactions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'user_interactions_user_id_fkey'
      AND n.nspname = 'public'
      AND c.relname = 'user_interactions'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."user_interactions"
    ADD CONSTRAINT "user_interactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: user_unlock_records user_unlock_records_project_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'user_unlock_records_project_id_fkey'
      AND n.nspname = 'public'
      AND c.relname = 'user_unlock_records'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."user_unlock_records"
    ADD CONSTRAINT "user_unlock_records_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE CASCADE;
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: user_unlock_records user_unlock_records_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname = 'user_unlock_records_user_id_fkey'
      AND n.nspname = 'public'
      AND c.relname = 'user_unlock_records'
  ) THEN
    EXECUTE $pg_schema_sql$
ALTER TABLE ONLY "public"."user_unlock_records"
    ADD CONSTRAINT "user_unlock_records_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: profiles Admins full access profiles; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Admins full access profiles'
      AND n.nspname = 'public'
      AND c.relname = 'profiles'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Admins full access profiles" ON "public"."profiles" TO "authenticated" USING (("public"."get_user_role"("auth"."uid"()) = 'admin'::"public"."user_role"));
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: assistant_config Admins manage assistant config; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Admins manage assistant config'
      AND n.nspname = 'public'
      AND c.relname = 'assistant_config'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Admins manage assistant config" ON "public"."assistant_config" TO "authenticated" USING (("public"."get_user_role"("auth"."uid"()) = 'admin'::"public"."user_role")) WITH CHECK (("public"."get_user_role"("auth"."uid"()) = 'admin'::"public"."user_role"));
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: cases Admins manage cases; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Admins manage cases'
      AND n.nspname = 'public'
      AND c.relname = 'cases'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Admins manage cases" ON "public"."cases" TO "authenticated" USING (("public"."get_user_role"("auth"."uid"()) = 'admin'::"public"."user_role")) WITH CHECK (("public"."get_user_role"("auth"."uid"()) = 'admin'::"public"."user_role"));
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: categories Admins manage categories; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Admins manage categories'
      AND n.nspname = 'public'
      AND c.relname = 'categories'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Admins manage categories" ON "public"."categories" TO "authenticated" USING (("public"."get_user_role"("auth"."uid"()) = 'admin'::"public"."user_role")) WITH CHECK (("public"."get_user_role"("auth"."uid"()) = 'admin'::"public"."user_role"));
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: user_checkins Admins manage checkins; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Admins manage checkins'
      AND n.nspname = 'public'
      AND c.relname = 'user_checkins'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Admins manage checkins" ON "public"."user_checkins" TO "authenticated" USING (("public"."get_user_role"("auth"."uid"()) = 'admin'::"public"."user_role")) WITH CHECK (("public"."get_user_role"("auth"."uid"()) = 'admin'::"public"."user_role"));
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: event_filter_options Admins manage event filter options; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Admins manage event filter options'
      AND n.nspname = 'public'
      AND c.relname = 'event_filter_options'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Admins manage event filter options" ON "public"."event_filter_options" TO "authenticated" USING (("public"."get_user_role"("auth"."uid"()) = 'admin'::"public"."user_role")) WITH CHECK (("public"."get_user_role"("auth"."uid"()) = 'admin'::"public"."user_role"));
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: events Admins manage events; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Admins manage events'
      AND n.nspname = 'public'
      AND c.relname = 'events'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Admins manage events" ON "public"."events" TO "authenticated" USING (("public"."get_user_role"("auth"."uid"()) = 'admin'::"public"."user_role")) WITH CHECK (("public"."get_user_role"("auth"."uid"()) = 'admin'::"public"."user_role"));
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: user_interaction_xp_records Admins manage interaction xp records; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Admins manage interaction xp records'
      AND n.nspname = 'public'
      AND c.relname = 'user_interaction_xp_records'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Admins manage interaction xp records" ON "public"."user_interaction_xp_records" TO "authenticated" USING (("public"."get_user_role"("auth"."uid"()) = 'admin'::"public"."user_role")) WITH CHECK (("public"."get_user_role"("auth"."uid"()) = 'admin'::"public"."user_role"));
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: user_interactions Admins manage interactions; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Admins manage interactions'
      AND n.nspname = 'public'
      AND c.relname = 'user_interactions'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Admins manage interactions" ON "public"."user_interactions" TO "authenticated" USING (("public"."get_user_role"("auth"."uid"()) = 'admin'::"public"."user_role")) WITH CHECK (("public"."get_user_role"("auth"."uid"()) = 'admin'::"public"."user_role"));
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: knowledge_base Admins manage knowledge base; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Admins manage knowledge base'
      AND n.nspname = 'public'
      AND c.relname = 'knowledge_base'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Admins manage knowledge base" ON "public"."knowledge_base" TO "authenticated" USING (("public"."get_user_role"("auth"."uid"()) = 'admin'::"public"."user_role")) WITH CHECK (("public"."get_user_role"("auth"."uid"()) = 'admin'::"public"."user_role"));
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: level_config Admins manage level config; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Admins manage level config'
      AND n.nspname = 'public'
      AND c.relname = 'level_config'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Admins manage level config" ON "public"."level_config" TO "authenticated" USING (("public"."get_user_role"("auth"."uid"()) = 'admin'::"public"."user_role")) WITH CHECK (("public"."get_user_role"("auth"."uid"()) = 'admin'::"public"."user_role"));
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: member_benefits Admins manage member benefits; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Admins manage member benefits'
      AND n.nspname = 'public'
      AND c.relname = 'member_benefits'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Admins manage member benefits" ON "public"."member_benefits" TO "authenticated" USING (("public"."get_user_role"("auth"."uid"()) = 'admin'::"public"."user_role")) WITH CHECK (("public"."get_user_role"("auth"."uid"()) = 'admin'::"public"."user_role"));
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: project_filter_options Admins manage project filter options; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Admins manage project filter options'
      AND n.nspname = 'public'
      AND c.relname = 'project_filter_options'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Admins manage project filter options" ON "public"."project_filter_options" TO "authenticated" USING (("public"."get_user_role"("auth"."uid"()) = 'admin'::"public"."user_role")) WITH CHECK (("public"."get_user_role"("auth"."uid"()) = 'admin'::"public"."user_role"));
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: projects Admins manage projects; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Admins manage projects'
      AND n.nspname = 'public'
      AND c.relname = 'projects'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Admins manage projects" ON "public"."projects" TO "authenticated" USING (("public"."get_user_role"("auth"."uid"()) = 'admin'::"public"."user_role")) WITH CHECK (("public"."get_user_role"("auth"."uid"()) = 'admin'::"public"."user_role"));
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: event_registrations Admins manage registrations; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Admins manage registrations'
      AND n.nspname = 'public'
      AND c.relname = 'event_registrations'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Admins manage registrations" ON "public"."event_registrations" TO "authenticated" USING (("public"."get_user_role"("auth"."uid"()) = 'admin'::"public"."user_role")) WITH CHECK (("public"."get_user_role"("auth"."uid"()) = 'admin'::"public"."user_role"));
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: site_content Admins manage site content; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Admins manage site content'
      AND n.nspname = 'public'
      AND c.relname = 'site_content'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Admins manage site content" ON "public"."site_content" TO "authenticated" USING (("public"."get_user_role"("auth"."uid"()) = 'admin'::"public"."user_role")) WITH CHECK (("public"."get_user_role"("auth"."uid"()) = 'admin'::"public"."user_role"));
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: site_settings Admins manage site settings; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Admins manage site settings'
      AND n.nspname = 'public'
      AND c.relname = 'site_settings'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Admins manage site settings" ON "public"."site_settings" TO "authenticated" USING (("public"."get_user_role"("auth"."uid"()) = 'admin'::"public"."user_role")) WITH CHECK (("public"."get_user_role"("auth"."uid"()) = 'admin'::"public"."user_role"));
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: user_unlock_records Admins manage unlock records; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Admins manage unlock records'
      AND n.nspname = 'public'
      AND c.relname = 'user_unlock_records'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Admins manage unlock records" ON "public"."user_unlock_records" TO "authenticated" USING (("public"."get_user_role"("auth"."uid"()) = 'admin'::"public"."user_role")) WITH CHECK (("public"."get_user_role"("auth"."uid"()) = 'admin'::"public"."user_role"));
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: ai_usage Admins view all ai usage; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Admins view all ai usage'
      AND n.nspname = 'public'
      AND c.relname = 'ai_usage'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Admins view all ai usage" ON "public"."ai_usage" FOR SELECT TO "authenticated" USING (("public"."get_user_role"("auth"."uid"()) = 'admin'::"public"."user_role"));
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: assistant_config Anyone view assistant config; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Anyone view assistant config'
      AND n.nspname = 'public'
      AND c.relname = 'assistant_config'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Anyone view assistant config" ON "public"."assistant_config" FOR SELECT TO "authenticated", "anon" USING (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: cases Anyone view cases; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Anyone view cases'
      AND n.nspname = 'public'
      AND c.relname = 'cases'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Anyone view cases" ON "public"."cases" FOR SELECT TO "authenticated", "anon" USING (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: categories Anyone view categories; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Anyone view categories'
      AND n.nspname = 'public'
      AND c.relname = 'categories'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Anyone view categories" ON "public"."categories" FOR SELECT TO "authenticated", "anon" USING (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: event_filter_options Anyone view event filter options; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Anyone view event filter options'
      AND n.nspname = 'public'
      AND c.relname = 'event_filter_options'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Anyone view event filter options" ON "public"."event_filter_options" FOR SELECT USING (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: events Anyone view events; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Anyone view events'
      AND n.nspname = 'public'
      AND c.relname = 'events'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Anyone view events" ON "public"."events" FOR SELECT TO "authenticated", "anon" USING (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: knowledge_base Anyone view knowledge base; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Anyone view knowledge base'
      AND n.nspname = 'public'
      AND c.relname = 'knowledge_base'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Anyone view knowledge base" ON "public"."knowledge_base" FOR SELECT TO "authenticated", "anon" USING (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: level_config Anyone view level config; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Anyone view level config'
      AND n.nspname = 'public'
      AND c.relname = 'level_config'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Anyone view level config" ON "public"."level_config" FOR SELECT TO "authenticated", "anon" USING (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: member_benefits Anyone view member benefits; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Anyone view member benefits'
      AND n.nspname = 'public'
      AND c.relname = 'member_benefits'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Anyone view member benefits" ON "public"."member_benefits" FOR SELECT TO "authenticated", "anon" USING (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: project_filter_options Anyone view project filter options; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Anyone view project filter options'
      AND n.nspname = 'public'
      AND c.relname = 'project_filter_options'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Anyone view project filter options" ON "public"."project_filter_options" FOR SELECT USING (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: projects Anyone view projects; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Anyone view projects'
      AND n.nspname = 'public'
      AND c.relname = 'projects'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Anyone view projects" ON "public"."projects" FOR SELECT TO "authenticated", "anon" USING (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: site_content Anyone view site content; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Anyone view site content'
      AND n.nspname = 'public'
      AND c.relname = 'site_content'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Anyone view site content" ON "public"."site_content" FOR SELECT TO "authenticated", "anon" USING (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: site_settings Anyone view site settings; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Anyone view site settings'
      AND n.nspname = 'public'
      AND c.relname = 'site_settings'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Anyone view site settings" ON "public"."site_settings" FOR SELECT USING (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: event_registrations Users cancel own registration; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Users cancel own registration'
      AND n.nspname = 'public'
      AND c.relname = 'event_registrations'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Users cancel own registration" ON "public"."event_registrations" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "user_id"));
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: user_interactions Users create interactions; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Users create interactions'
      AND n.nspname = 'public'
      AND c.relname = 'user_interactions'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Users create interactions" ON "public"."user_interactions" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: user_unlock_records Users create own unlock records; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Users create own unlock records'
      AND n.nspname = 'public'
      AND c.relname = 'user_unlock_records'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Users create own unlock records" ON "public"."user_unlock_records" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: user_interactions Users delete own interactions; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Users delete own interactions'
      AND n.nspname = 'public'
      AND c.relname = 'user_interactions'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Users delete own interactions" ON "public"."user_interactions" FOR DELETE TO "authenticated" USING (("auth"."uid"() = "user_id"));
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: event_registrations Users register events; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Users register events'
      AND n.nspname = 'public'
      AND c.relname = 'event_registrations'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Users register events" ON "public"."event_registrations" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "user_id"));
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: profiles Users update own profile; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Users update own profile'
      AND n.nspname = 'public'
      AND c.relname = 'profiles'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Users update own profile" ON "public"."profiles" FOR UPDATE TO "authenticated" USING (("auth"."uid"() = "id")) WITH CHECK (("auth"."uid"() = "id"));
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: ai_usage Users view own ai usage; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Users view own ai usage'
      AND n.nspname = 'public'
      AND c.relname = 'ai_usage'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Users view own ai usage" ON "public"."ai_usage" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: user_checkins Users view own checkins; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Users view own checkins'
      AND n.nspname = 'public'
      AND c.relname = 'user_checkins'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Users view own checkins" ON "public"."user_checkins" FOR SELECT USING (("auth"."uid"() = "user_id"));
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: user_interaction_xp_records Users view own interaction xp records; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Users view own interaction xp records'
      AND n.nspname = 'public'
      AND c.relname = 'user_interaction_xp_records'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Users view own interaction xp records" ON "public"."user_interaction_xp_records" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: user_interactions Users view own interactions; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Users view own interactions'
      AND n.nspname = 'public'
      AND c.relname = 'user_interactions'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Users view own interactions" ON "public"."user_interactions" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: profiles Users view own profile; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Users view own profile'
      AND n.nspname = 'public'
      AND c.relname = 'profiles'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Users view own profile" ON "public"."profiles" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "id"));
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: event_registrations Users view own registrations; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Users view own registrations'
      AND n.nspname = 'public'
      AND c.relname = 'event_registrations'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Users view own registrations" ON "public"."event_registrations" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: user_unlock_records Users view own unlock records; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Users view own unlock records'
      AND n.nspname = 'public'
      AND c.relname = 'user_unlock_records'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "Users view own unlock records" ON "public"."user_unlock_records" FOR SELECT TO "authenticated" USING (("auth"."uid"() = "user_id"));
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: ai_usage; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."ai_usage" ENABLE ROW LEVEL SECURITY;

--
-- Name: assistant_config; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."assistant_config" ENABLE ROW LEVEL SECURITY;

--
-- Name: cases; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."cases" ENABLE ROW LEVEL SECURITY;

--
-- Name: categories; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."categories" ENABLE ROW LEVEL SECURITY;

--
-- Name: event_filter_options; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."event_filter_options" ENABLE ROW LEVEL SECURITY;

--
-- Name: event_registrations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."event_registrations" ENABLE ROW LEVEL SECURITY;

--
-- Name: events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."events" ENABLE ROW LEVEL SECURITY;

--
-- Name: knowledge_base; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."knowledge_base" ENABLE ROW LEVEL SECURITY;

--
-- Name: level_config; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."level_config" ENABLE ROW LEVEL SECURITY;

--
-- Name: member_benefits; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."member_benefits" ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."profiles" ENABLE ROW LEVEL SECURITY;

--
-- Name: project_filter_options; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."project_filter_options" ENABLE ROW LEVEL SECURITY;

--
-- Name: projects; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."projects" ENABLE ROW LEVEL SECURITY;

--
-- Name: site_content; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."site_content" ENABLE ROW LEVEL SECURITY;

--
-- Name: site_settings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."site_settings" ENABLE ROW LEVEL SECURITY;

--
-- Name: user_checkins; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."user_checkins" ENABLE ROW LEVEL SECURITY;

--
-- Name: user_interaction_xp_records; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."user_interaction_xp_records" ENABLE ROW LEVEL SECURITY;

--
-- Name: user_interactions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."user_interactions" ENABLE ROW LEVEL SECURITY;

--
-- Name: user_unlock_records; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."user_unlock_records" ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--




-- ============================================================
-- SECTION: DIFF FILTER OBJECTS
-- ============================================================
-- Objects that match diff-filter.json but cannot be represented
-- precisely by pg_dump --filter.

-- auth.users trigger: on_auth_user_created
DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE NOT t.tgisinternal
      AND t.tgname = 'on_auth_user_created'
      AND n.nspname = 'auth'
      AND c.relname = 'users'
  ) THEN
    EXECUTE 'CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();';
  END IF;
END
$pg_schema_restore$;
-- policy: "Admins delete storage" on storage.objects
DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Admins delete storage'
      AND n.nspname = 'storage'
      AND c.relname = 'objects'
  ) THEN
    EXECUTE 'CREATE POLICY "Admins delete storage" ON storage.objects AS PERMISSIVE FOR DELETE TO authenticated USING ((public.get_user_role(auth.uid()) = ''admin''::public.user_role));';
  END IF;
END
$pg_schema_restore$;
-- policy: "Admins update storage" on storage.objects
DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Admins update storage'
      AND n.nspname = 'storage'
      AND c.relname = 'objects'
  ) THEN
    EXECUTE 'CREATE POLICY "Admins update storage" ON storage.objects AS PERMISSIVE FOR UPDATE TO authenticated USING ((public.get_user_role(auth.uid()) = ''admin''::public.user_role));';
  END IF;
END
$pg_schema_restore$;
-- policy: "Admins upload avatars" on storage.objects
DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Admins upload avatars'
      AND n.nspname = 'storage'
      AND c.relname = 'objects'
  ) THEN
    EXECUTE 'CREATE POLICY "Admins upload avatars" ON storage.objects AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (((bucket_id = ''avatars''::text) AND (public.get_user_role(auth.uid()) = ''admin''::public.user_role)));';
  END IF;
END
$pg_schema_restore$;
-- policy: "Admins upload covers" on storage.objects
DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Admins upload covers'
      AND n.nspname = 'storage'
      AND c.relname = 'objects'
  ) THEN
    EXECUTE 'CREATE POLICY "Admins upload covers" ON storage.objects AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (((bucket_id = ''covers''::text) AND (public.get_user_role(auth.uid()) = ''admin''::public.user_role)));';
  END IF;
END
$pg_schema_restore$;
-- policy: "Admins upload media" on storage.objects
DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Admins upload media'
      AND n.nspname = 'storage'
      AND c.relname = 'objects'
  ) THEN
    EXECUTE 'CREATE POLICY "Admins upload media" ON storage.objects AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (((bucket_id = ''media''::text) AND (public.get_user_role(auth.uid()) = ''admin''::public.user_role)));';
  END IF;
END
$pg_schema_restore$;
-- policy: "Allow authenticated delete own avatar" on storage.objects
DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Allow authenticated delete own avatar'
      AND n.nspname = 'storage'
      AND c.relname = 'objects'
  ) THEN
    EXECUTE 'CREATE POLICY "Allow authenticated delete own avatar" ON storage.objects AS PERMISSIVE FOR DELETE TO authenticated USING (((bucket_id = ''avatars''::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));';
  END IF;
END
$pg_schema_restore$;
-- policy: "Allow authenticated update own avatar" on storage.objects
DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Allow authenticated update own avatar'
      AND n.nspname = 'storage'
      AND c.relname = 'objects'
  ) THEN
    EXECUTE 'CREATE POLICY "Allow authenticated update own avatar" ON storage.objects AS PERMISSIVE FOR UPDATE TO authenticated USING (((bucket_id = ''avatars''::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));';
  END IF;
END
$pg_schema_restore$;
-- policy: "Allow authenticated upload own avatar" on storage.objects
DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Allow authenticated upload own avatar'
      AND n.nspname = 'storage'
      AND c.relname = 'objects'
  ) THEN
    EXECUTE 'CREATE POLICY "Allow authenticated upload own avatar" ON storage.objects AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (((bucket_id = ''avatars''::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));';
  END IF;
END
$pg_schema_restore$;
-- policy: "Allow public read avatars" on storage.objects
DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Allow public read avatars'
      AND n.nspname = 'storage'
      AND c.relname = 'objects'
  ) THEN
    EXECUTE 'CREATE POLICY "Allow public read avatars" ON storage.objects AS PERMISSIVE FOR SELECT TO PUBLIC USING ((bucket_id = ''avatars''::text));';
  END IF;
END
$pg_schema_restore$;
-- policy: "Public read avatars" on storage.objects
DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Public read avatars'
      AND n.nspname = 'storage'
      AND c.relname = 'objects'
  ) THEN
    EXECUTE 'CREATE POLICY "Public read avatars" ON storage.objects AS PERMISSIVE FOR SELECT TO anon, authenticated USING ((bucket_id = ''avatars''::text));';
  END IF;
END
$pg_schema_restore$;
-- policy: "Public read covers" on storage.objects
DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Public read covers'
      AND n.nspname = 'storage'
      AND c.relname = 'objects'
  ) THEN
    EXECUTE 'CREATE POLICY "Public read covers" ON storage.objects AS PERMISSIVE FOR SELECT TO anon, authenticated USING ((bucket_id = ''covers''::text));';
  END IF;
END
$pg_schema_restore$;
-- policy: "Public read media" on storage.objects
DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = 'Public read media'
      AND n.nspname = 'storage'
      AND c.relname = 'objects'
  ) THEN
    EXECUTE 'CREATE POLICY "Public read media" ON storage.objects AS PERMISSIVE FOR SELECT TO anon, authenticated USING ((bucket_id = ''media''::text));';
  END IF;
END
$pg_schema_restore$;

-- ============================================================
-- SECTION: STORAGE BUCKETS DATA
-- ============================================================

INSERT INTO "storage"."buckets" ("id", "name", "owner", "created_at", "updated_at", "public", "avif_autodetection", "file_size_limit", "allowed_mime_types", "owner_id", "type") VALUES ('avatars', 'avatars', NULL, '2026-08-20 06:09:26.873228+00', '2026-08-20 06:09:26.873228+00', 'true', 'false', NULL, NULL, NULL, 'STANDARD') ON CONFLICT ("id") DO UPDATE SET "name" = EXCLUDED."name", "owner" = EXCLUDED."owner", "created_at" = EXCLUDED."created_at", "updated_at" = EXCLUDED."updated_at", "public" = EXCLUDED."public", "avif_autodetection" = EXCLUDED."avif_autodetection", "file_size_limit" = EXCLUDED."file_size_limit", "allowed_mime_types" = EXCLUDED."allowed_mime_types", "owner_id" = EXCLUDED."owner_id", "type" = EXCLUDED."type";
INSERT INTO "storage"."buckets" ("id", "name", "owner", "created_at", "updated_at", "public", "avif_autodetection", "file_size_limit", "allowed_mime_types", "owner_id", "type") VALUES ('covers', 'covers', NULL, '2026-08-20 06:09:26.873228+00', '2026-08-20 06:09:26.873228+00', 'true', 'false', NULL, NULL, NULL, 'STANDARD') ON CONFLICT ("id") DO UPDATE SET "name" = EXCLUDED."name", "owner" = EXCLUDED."owner", "created_at" = EXCLUDED."created_at", "updated_at" = EXCLUDED."updated_at", "public" = EXCLUDED."public", "avif_autodetection" = EXCLUDED."avif_autodetection", "file_size_limit" = EXCLUDED."file_size_limit", "allowed_mime_types" = EXCLUDED."allowed_mime_types", "owner_id" = EXCLUDED."owner_id", "type" = EXCLUDED."type";
INSERT INTO "storage"."buckets" ("id", "name", "owner", "created_at", "updated_at", "public", "avif_autodetection", "file_size_limit", "allowed_mime_types", "owner_id", "type") VALUES ('media', 'media', NULL, '2026-08-20 06:09:26.873228+00', '2026-08-20 06:09:26.873228+00', 'true', 'false', NULL, NULL, NULL, 'STANDARD') ON CONFLICT ("id") DO UPDATE SET "name" = EXCLUDED."name", "owner" = EXCLUDED."owner", "created_at" = EXCLUDED."created_at", "updated_at" = EXCLUDED."updated_at", "public" = EXCLUDED."public", "avif_autodetection" = EXCLUDED."avif_autodetection", "file_size_limit" = EXCLUDED."file_size_limit", "allowed_mime_types" = EXCLUDED."allowed_mime_types", "owner_id" = EXCLUDED."owner_id", "type" = EXCLUDED."type";

-- ============================================================
-- SECTION: CRON JOBS
-- ============================================================
-- 用户自定义 pg_cron 任务。

