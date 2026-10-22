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
-- Name: pg_net; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "pg_net" WITH SCHEMA "public";


--
-- Name: EXTENSION "pg_net"; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION "pg_net" IS 'Async HTTP';


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
-- Name: get_my_image_provider_config(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE OR REPLACE FUNCTION "public"."get_my_image_provider_config"() RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'vault', 'pg_temp'
    AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_rec record;
  v_has_key boolean := false;
  v_vault_name text;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT * INTO v_rec
  FROM public.user_image_providers
  WHERE user_id = v_user_id
  LIMIT 1;

  v_vault_name := 'IMAGE_GEN_API_KEY_' || v_user_id::text;
  
  SELECT EXISTS (
    SELECT 1 FROM vault.secrets WHERE name = v_vault_name
  ) INTO v_has_key;

  IF v_rec IS NULL AND NOT v_has_key THEN
    RETURN NULL;
  END IF;

  RETURN jsonb_build_object(
    'provider', coalesce(v_rec.provider, ''),
    'base_url', coalesce(v_rec.base_url, ''),
    'model', coalesce(v_rec.model, ''),
    'protocol', coalesce(v_rec.protocol, 'openai'),
    'default_size', coalesce(v_rec.default_size, '1024x1024'),
    'request_body_template', v_rec.request_body_template,
    'protocol_settings', v_rec.protocol_settings,
    'apiKeyConfigured', v_has_key,
    'has_api_key', v_has_key,
    'updated_at', v_rec.updated_at
  );
END;
$$;


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
-- Name: get_vault_secret("text"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE OR REPLACE FUNCTION "public"."get_vault_secret"("p_name" "text") RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'vault', 'pg_temp'
    AS $$
DECLARE
  v_secret text;
BEGIN
  SELECT decrypted_secret INTO v_secret
  FROM vault.decrypted_secrets
  WHERE name = p_name
  LIMIT 1;

  RETURN v_secret;
END;
$$;


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
-- Name: has_vault_secret("text"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE OR REPLACE FUNCTION "public"."has_vault_secret"("p_name" "text") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'vault', 'pg_temp'
    AS $$
DECLARE
  v_exists boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM vault.secrets WHERE name = p_name
  ) INTO v_exists;

  RETURN coalesce(v_exists, false);
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
-- Name: set_vault_secret("text", "text", "text"); Type: FUNCTION; Schema: public; Owner: -
--

CREATE OR REPLACE FUNCTION "public"."set_vault_secret"("p_name" "text", "p_secret" "text", "p_description" "text" DEFAULT ''::"text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'vault'
    AS $$
DECLARE
  v_id uuid;
BEGIN
  SELECT id INTO v_id FROM vault.secrets WHERE name = p_name LIMIT 1;
  IF v_id IS NOT NULL THEN
    PERFORM vault.update_secret(v_id, p_secret, p_name, p_description);
    RETURN v_id;
  ELSE
    RETURN vault.create_secret(p_secret, p_name, p_description);
  END IF;
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
-- Name: uid(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE OR REPLACE FUNCTION "public"."uid"() RETURNS "uuid"
    LANGUAGE "plpgsql" STABLE
    AS $_$
DECLARE
  sub_text text;
BEGIN
  sub_text := coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  );
  -- 如果 sub_text 为空、等于 'anon' 或者不符合 UUID 格式，安全返回 NULL
  IF sub_text IS NULL OR sub_text = 'anon' OR sub_text !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    RETURN NULL;
  END IF;
  RETURN sub_text::uuid;
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END;
$_$;


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
   …20024 tokens truncated…content; Type: POLICY; Schema: public; Owner: -
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
-- Name: prompt_case_filters; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."prompt_case_filters" ENABLE ROW LEVEL SECURITY;

--
-- Name: prompt_case_generations; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."prompt_case_generations" ENABLE ROW LEVEL SECURITY;

--
-- Name: prompt_cases; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."prompt_cases" ENABLE ROW LEVEL SECURITY;

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
-- Name: user_image_providers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE "public"."user_image_providers" ENABLE ROW LEVEL SECURITY;

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
-- Name: prompt_case_generations 任何人可新增生图历史; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = '任何人可新增生图历史'
      AND n.nspname = 'public'
      AND c.relname = 'prompt_case_generations'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "任何人可新增生图历史" ON "public"."prompt_case_generations" FOR INSERT WITH CHECK (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: prompt_case_generations 任何人可查看生图历史; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = '任何人可查看生图历史'
      AND n.nspname = 'public'
      AND c.relname = 'prompt_case_generations'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "任何人可查看生图历史" ON "public"."prompt_case_generations" FOR SELECT USING (true);
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: user_image_providers 用户删除自己的生图配置; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = '用户删除自己的生图配置'
      AND n.nspname = 'public'
      AND c.relname = 'user_image_providers'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "用户删除自己的生图配置" ON "public"."user_image_providers" FOR DELETE USING (("user_id" = "auth"."uid"()));
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: user_image_providers 用户新增自己的生图配置; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = '用户新增自己的生图配置'
      AND n.nspname = 'public'
      AND c.relname = 'user_image_providers'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "用户新增自己的生图配置" ON "public"."user_image_providers" FOR INSERT WITH CHECK (("user_id" = "auth"."uid"()));
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: user_image_providers 用户更新自己的生图配置; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = '用户更新自己的生图配置'
      AND n.nspname = 'public'
      AND c.relname = 'user_image_providers'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "用户更新自己的生图配置" ON "public"."user_image_providers" FOR UPDATE USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: user_image_providers 用户查看自己的生图配置; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = '用户查看自己的生图配置'
      AND n.nspname = 'public'
      AND c.relname = 'user_image_providers'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "用户查看自己的生图配置" ON "public"."user_image_providers" FOR SELECT USING (("user_id" = "auth"."uid"()));
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: prompt_case_generations 管理员可删除生图历史; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = '管理员可删除生图历史'
      AND n.nspname = 'public'
      AND c.relname = 'prompt_case_generations'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "管理员可删除生图历史" ON "public"."prompt_case_generations" FOR DELETE USING (((("auth"."jwt"() ->> 'role'::"text") = 'authenticated'::"text") AND (EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'admin'::"public"."user_role"))))));
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


--
-- Name: user_image_providers 管理员可查看全部生图配置; Type: POLICY; Schema: public; Owner: -
--

DO $pg_schema_restore$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policy pol
    JOIN pg_class c ON c.oid = pol.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE pol.polname = '管理员可查看全部生图配置'
      AND n.nspname = 'public'
      AND c.relname = 'user_image_providers'
  ) THEN
    EXECUTE $pg_schema_sql$
CREATE POLICY "管理员可查看全部生图配置" ON "public"."user_image_providers" FOR SELECT USING (((("auth"."jwt"() ->> 'role'::"text") = 'authenticated'::"text") AND (EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = "auth"."uid"()) AND ("profiles"."role" = 'admin'::"public"."user_role"))))));
$pg_schema_sql$;
  END IF;
END
$pg_schema_restore$;


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

