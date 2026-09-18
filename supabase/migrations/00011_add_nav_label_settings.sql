
-- 添加导航栏板块名称配置
INSERT INTO public.site_settings (key, value) VALUES
  ('nav_home', '首页'),
  ('nav_home_en', 'Home'),
  ('nav_cases', '案例'),
  ('nav_cases_en', 'Cases'),
  ('nav_projects', '项目库'),
  ('nav_projects_en', 'Projects'),
  ('nav_events', '城市组局'),
  ('nav_events_en', 'Events')
ON CONFLICT (key) DO NOTHING;
