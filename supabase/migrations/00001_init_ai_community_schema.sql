-- ============ ENUMS ============
CREATE TYPE public.user_role AS ENUM ('user', 'admin');
CREATE TYPE public.member_tier AS ENUM ('guest', 'explorer', 'member', 'pro');
CREATE TYPE public.community_identity AS ENUM ('user', 'creator', 'builder', 'contributor');
CREATE TYPE public.content_access AS ENUM ('free', 'member', 'pro', 'private');

-- ============ PROFILES ============
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  phone text,
  username text UNIQUE,
  avatar_url text,
  bio text,
  role public.user_role NOT NULL DEFAULT 'user',
  member_tier public.member_tier NOT NULL DEFAULT 'explorer',
  community_identity public.community_identity NOT NULL DEFAULT 'user',
  xp integer NOT NULL DEFAULT 0,
  level integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- handle_new_user trigger
CREATE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
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

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- role helper
CREATE OR REPLACE FUNCTION public.get_user_role(uid uuid)
RETURNS public.user_role
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$ SELECT role FROM public.profiles WHERE id = uid; $$;

-- Profiles policies
CREATE POLICY "Admins full access profiles" ON public.profiles
  FOR ALL TO authenticated USING (public.get_user_role(auth.uid()) = 'admin'::public.user_role);
CREATE POLICY "Users view own profile" ON public.profiles
  FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users update own profile" ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id)
  WITH CHECK (role IS NOT DISTINCT FROM public.get_user_role(auth.uid()));

-- public view
CREATE VIEW public.public_profiles AS
  SELECT id, username, avatar_url, bio, member_tier, community_identity, level, xp FROM public.profiles;

-- ============ CATEGORIES (案例领域) ============
CREATE TABLE public.categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  name_en text NOT NULL DEFAULT '',
  slug text UNIQUE NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone view categories" ON public.categories FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Admins manage categories" ON public.categories FOR ALL TO authenticated
  USING (public.get_user_role(auth.uid()) = 'admin'::public.user_role)
  WITH CHECK (public.get_user_role(auth.uid()) = 'admin'::public.user_role);

-- ============ CASES (案例展示) ============
CREATE TABLE public.cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  title_en text NOT NULL DEFAULT '',
  summary text NOT NULL DEFAULT '',
  summary_en text NOT NULL DEFAULT '',
  cover_url text NOT NULL DEFAULT '',
  category_id uuid REFERENCES public.categories(id) ON DELETE SET NULL,
  content jsonb NOT NULL DEFAULT '[]'::jsonb,
  content_en jsonb NOT NULL DEFAULT '[]'::jsonb,
  author text NOT NULL DEFAULT '',
  author_en text NOT NULL DEFAULT '',
  likes integer NOT NULL DEFAULT 0,
  favorites integer NOT NULL DEFAULT 0,
  views integer NOT NULL DEFAULT 0,
  is_featured boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.cases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone view cases" ON public.cases FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Admins manage cases" ON public.cases FOR ALL TO authenticated
  USING (public.get_user_role(auth.uid()) = 'admin'::public.user_role)
  WITH CHECK (public.get_user_role(auth.uid()) = 'admin'::public.user_role);

-- ============ PROJECTS (AI项目库) ============
CREATE TABLE public.projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  title_en text NOT NULL DEFAULT '',
  summary text NOT NULL DEFAULT '',
  summary_en text NOT NULL DEFAULT '',
  cover_url text NOT NULL DEFAULT '',
  content jsonb NOT NULL DEFAULT '[]'::jsonb,
  content_en jsonb NOT NULL DEFAULT '[]'::jsonb,
  video_url text NOT NULL DEFAULT '',
  external_url text NOT NULL DEFAULT '',
  scene text NOT NULL DEFAULT '通用',
  scene_en text NOT NULL DEFAULT 'General',
  maturity text NOT NULL DEFAULT '概念',
  maturity_en text NOT NULL DEFAULT 'Concept',
  access_level public.content_access NOT NULL DEFAULT 'free',
  likes integer NOT NULL DEFAULT 0,
  views integer NOT NULL DEFAULT 0,
  is_hot boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone view projects" ON public.projects FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Admins manage projects" ON public.projects FOR ALL TO authenticated
  USING (public.get_user_role(auth.uid()) = 'admin'::public.user_role)
  WITH CHECK (public.get_user_role(auth.uid()) = 'admin'::public.user_role);

-- ============ EVENTS (城市组局) ============
CREATE TABLE public.events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  title_en text NOT NULL DEFAULT '',
  summary text NOT NULL DEFAULT '',
  summary_en text NOT NULL DEFAULT '',
  cover_url text NOT NULL DEFAULT '',
  city text NOT NULL DEFAULT '',
  city_en text NOT NULL DEFAULT '',
  theme text NOT NULL DEFAULT '',
  theme_en text NOT NULL DEFAULT '',
  location text NOT NULL DEFAULT '',
  location_en text NOT NULL DEFAULT '',
  event_date timestamptz NOT NULL DEFAULT now(),
  capacity integer NOT NULL DEFAULT 50,
  registered integer NOT NULL DEFAULT 0,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone view events" ON public.events FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Admins manage events" ON public.events FOR ALL TO authenticated
  USING (public.get_user_role(auth.uid()) = 'admin'::public.user_role)
  WITH CHECK (public.get_user_role(auth.uid()) = 'admin'::public.user_role);

-- ============ EVENT REGISTRATIONS ============
CREATE TABLE public.event_registrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(event_id, user_id)
);
ALTER TABLE public.event_registrations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own registrations" ON public.event_registrations
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users register events" ON public.event_registrations
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users cancel own registration" ON public.event_registrations
  FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins manage registrations" ON public.event_registrations
  FOR ALL TO authenticated USING (public.get_user_role(auth.uid()) = 'admin'::public.user_role)
  WITH CHECK (public.get_user_role(auth.uid()) = 'admin'::public.user_role);

-- ============ USER INTERACTIONS (likes/favorites) ============
CREATE TABLE public.user_interactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE CASCADE,
  target_type text NOT NULL CHECK (target_type IN ('case', 'project')),
  target_id uuid NOT NULL,
  interaction text NOT NULL CHECK (interaction IN ('like', 'favorite')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, target_type, target_id, interaction)
);
ALTER TABLE public.user_interactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own interactions" ON public.user_interactions
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users create interactions" ON public.user_interactions
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own interactions" ON public.user_interactions
  FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins manage interactions" ON public.user_interactions
  FOR ALL TO authenticated USING (public.get_user_role(auth.uid()) = 'admin'::public.user_role)
  WITH CHECK (public.get_user_role(auth.uid()) = 'admin'::public.user_role);

-- ============ SITE CONTENT (可编辑文字/图片元素) ============
CREATE TABLE public.site_content (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  section text NOT NULL,
  key text NOT NULL,
  value text NOT NULL DEFAULT '',
  value_en text NOT NULL DEFAULT '',
  image_url text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(section, key)
);
ALTER TABLE public.site_content ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone view site content" ON public.site_content FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Admins manage site content" ON public.site_content FOR ALL TO authenticated
  USING (public.get_user_role(auth.uid()) = 'admin'::public.user_role)
  WITH CHECK (public.get_user_role(auth.uid()) = 'admin'::public.user_role);

-- ============ LEVEL CONFIG (XP升级阈值可视化配置) ============
CREATE TABLE public.level_config (
  level integer PRIMARY KEY CHECK (level >= 1 AND level <= 10),
  title text NOT NULL,
  title_en text NOT NULL DEFAULT '',
  xp_threshold integer NOT NULL DEFAULT 0,
  sort_order integer NOT NULL DEFAULT 0
);
ALTER TABLE public.level_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone view level config" ON public.level_config FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Admins manage level config" ON public.level_config FOR ALL TO authenticated
  USING (public.get_user_role(auth.uid()) = 'admin'::public.user_role)
  WITH CHECK (public.get_user_role(auth.uid()) = 'admin'::public.user_role);

-- ============ MEMBER BENEFITS (会员权益可视化配置) ============
CREATE TABLE public.member_benefits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tier public.member_tier NOT NULL,
  benefit_key text NOT NULL,
  benefit_label text NOT NULL,
  benefit_label_en text NOT NULL DEFAULT '',
  enabled boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  UNIQUE(tier, benefit_key)
);
ALTER TABLE public.member_benefits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone view member benefits" ON public.member_benefits FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Admins manage member benefits" ON public.member_benefits FOR ALL TO authenticated
  USING (public.get_user_role(auth.uid()) = 'admin'::public.user_role)
  WITH CHECK (public.get_user_role(auth.uid()) = 'admin'::public.user_role);

-- ============ AI ASSISTANT CONFIG (人设) ============
CREATE TABLE public.assistant_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  persona_name text NOT NULL DEFAULT 'AI社区助手',
  persona_name_en text NOT NULL DEFAULT 'AI Community Assistant',
  system_prompt text NOT NULL DEFAULT '',
  system_prompt_en text NOT NULL DEFAULT '',
  greeting text NOT NULL DEFAULT '',
  greeting_en text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.assistant_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone view assistant config" ON public.assistant_config FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Admins manage assistant config" ON public.assistant_config FOR ALL TO authenticated
  USING (public.get_user_role(auth.uid()) = 'admin'::public.user_role)
  WITH CHECK (public.get_user_role(auth.uid()) = 'admin'::public.user_role);

-- ============ KNOWLEDGE BASE (助手知识库) ============
CREATE TABLE public.knowledge_base (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  content text NOT NULL DEFAULT '',
  tags text NOT NULL DEFAULT '',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.knowledge_base ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone view knowledge base" ON public.knowledge_base FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Admins manage knowledge base" ON public.knowledge_base FOR ALL TO authenticated
  USING (public.get_user_role(auth.uid()) = 'admin'::public.user_role)
  WITH CHECK (public.get_user_role(auth.uid()) = 'admin'::public.user_role);

-- ============ STORAGE BUCKETS ============
INSERT INTO storage.buckets (id, name, public) VALUES
  ('covers', 'covers', true),
  ('avatars', 'avatars', true),
  ('media', 'media', true);

CREATE POLICY "Public read covers" ON storage.objects FOR SELECT TO anon, authenticated USING (bucket_id = 'covers');
CREATE POLICY "Public read avatars" ON storage.objects FOR SELECT TO anon, authenticated USING (bucket_id = 'avatars');
CREATE POLICY "Public read media" ON storage.objects FOR SELECT TO anon, authenticated USING (bucket_id = 'media');
CREATE POLICY "Admins upload covers" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'covers' AND public.get_user_role(auth.uid()) = 'admin'::public.user_role);
CREATE POLICY "Admins upload avatars" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars' AND public.get_user_role(auth.uid()) = 'admin'::public.user_role);
CREATE POLICY "Admins upload media" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'media' AND public.get_user_role(auth.uid()) = 'admin'::public.user_role);
CREATE POLICY "Admins update storage" ON storage.objects FOR UPDATE TO authenticated
  USING (public.get_user_role(auth.uid()) = 'admin'::public.user_role);
CREATE POLICY "Admins delete storage" ON storage.objects FOR DELETE TO authenticated
  USING (public.get_user_role(auth.uid()) = 'admin'::public.user_role);