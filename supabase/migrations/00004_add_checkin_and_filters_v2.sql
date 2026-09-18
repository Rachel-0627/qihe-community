-- 签到记录表
CREATE TABLE IF NOT EXISTS public.user_checkins (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  checkin_date date NOT NULL DEFAULT current_date,
  xp_awarded integer NOT NULL DEFAULT 50,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (user_id, checkin_date)
);

-- 项目库筛选配置
CREATE TABLE IF NOT EXISTS public.project_filter_options (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "group" text NOT NULL CHECK ("group" IN ('scene','maturity','category')),
  name text NOT NULL,
  name_en text NOT NULL DEFAULT '',
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- 城市组局筛选配置
CREATE TABLE IF NOT EXISTS public.event_filter_options (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "group" text NOT NULL CHECK ("group" IN ('city','theme')),
  name text NOT NULL,
  name_en text NOT NULL DEFAULT '',
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- 站点设置
CREATE TABLE IF NOT EXISTS public.site_settings (
  key text PRIMARY KEY,
  value text NOT NULL,
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

INSERT INTO public.site_settings (key, value) VALUES ('daily_checkin_xp', '50')
ON CONFLICT (key) DO NOTHING;

-- 初始项目库筛选选项
INSERT INTO public.project_filter_options ("group", name, name_en, sort_order) VALUES
('scene', '视觉创意', 'Visual Creativity', 1),
('scene', '效率工具', 'Productivity Tools', 2),
('scene', '商业应用', 'Business Applications', 3),
('scene', '教育科研', 'Education & Research', 4),
('scene', '内容创作', 'Content Creation', 5),
('maturity', '概念验证', 'Proof of Concept', 1),
('maturity', '研发中', 'In Development', 2),
('maturity', '成熟产品', 'Mature Product', 3),
('category', '视觉创意', 'Visual Creativity', 1),
('category', '效率工具', 'Productivity Tools', 2),
('category', '商业应用', 'Business Applications', 3),
('category', '教育科研', 'Education & Research', 4),
('category', '内容创作', 'Content Creation', 5)
ON CONFLICT DO NOTHING;

-- 初始城市组局筛选选项
INSERT INTO public.event_filter_options ("group", name, name_en, sort_order) VALUES
('city', '上海', 'Shanghai', 1),
('city', '北京', 'Beijing', 2),
('city', '深圳', 'Shenzhen', 3),
('city', '杭州', 'Hangzhou', 4),
('theme', '创业交流', 'Startup Exchange', 1),
('theme', '技术实践', 'Tech Practice', 2),
('theme', '社交聚会', 'Social Gathering', 3)
ON CONFLICT DO NOTHING;

-- 根据 XP 重新计算等级
CREATE OR REPLACE FUNCTION public.recalculate_user_level(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.profiles
  SET level = COALESCE((
    SELECT MAX(level) FROM public.level_config WHERE xp_threshold <= public.profiles.xp
  ), 1)
  WHERE id = p_user_id;
END;
$$;

-- 每日签到 RPC
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

-- RLS
ALTER TABLE public.user_checkins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_filter_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_filter_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

-- user_checkins
DROP POLICY IF EXISTS "Users view own checkins" ON public.user_checkins;
CREATE POLICY "Users view own checkins"
  ON public.user_checkins FOR SELECT
  USING (uid() = user_id);

DROP POLICY IF EXISTS "Admins manage checkins" ON public.user_checkins;
CREATE POLICY "Admins manage checkins"
  ON public.user_checkins FOR ALL
  TO authenticated
  USING (get_user_role(uid()) = 'admin'::user_role)
  WITH CHECK (get_user_role(uid()) = 'admin'::user_role);

-- project_filter_options
DROP POLICY IF EXISTS "Anyone view project filter options" ON public.project_filter_options;
CREATE POLICY "Anyone view project filter options"
  ON public.project_filter_options FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Admins manage project filter options" ON public.project_filter_options;
CREATE POLICY "Admins manage project filter options"
  ON public.project_filter_options FOR ALL
  TO authenticated
  USING (get_user_role(uid()) = 'admin'::user_role)
  WITH CHECK (get_user_role(uid()) = 'admin'::user_role);

-- event_filter_options
DROP POLICY IF EXISTS "Anyone view event filter options" ON public.event_filter_options;
CREATE POLICY "Anyone view event filter options"
  ON public.event_filter_options FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Admins manage event filter options" ON public.event_filter_options;
CREATE POLICY "Admins manage event filter options"
  ON public.event_filter_options FOR ALL
  TO authenticated
  USING (get_user_role(uid()) = 'admin'::user_role)
  WITH CHECK (get_user_role(uid()) = 'admin'::user_role);

-- site_settings
DROP POLICY IF EXISTS "Anyone view site settings" ON public.site_settings;
CREATE POLICY "Anyone view site settings"
  ON public.site_settings FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Admins manage site settings" ON public.site_settings;
CREATE POLICY "Admins manage site settings"
  ON public.site_settings FOR ALL
  TO authenticated
  USING (get_user_role(uid()) = 'admin'::user_role)
  WITH CHECK (get_user_role(uid()) = 'admin'::user_role);
