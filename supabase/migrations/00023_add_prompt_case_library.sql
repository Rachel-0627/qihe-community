-- 生图提示词案例库：筛选维度表
CREATE TABLE IF NOT EXISTS public.prompt_case_filters (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  "group" text NOT NULL CHECK ("group" IN ('category','style','scene')),
  name text NOT NULL,
  name_en text NOT NULL DEFAULT '',
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- 生图提示词案例库：案例表
CREATE TABLE IF NOT EXISTS public.prompt_cases (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL DEFAULT '',
  title_en text NOT NULL DEFAULT '',
  prompt text NOT NULL DEFAULT '',
  prompt_en text NOT NULL DEFAULT '',
  cover_url text NOT NULL DEFAULT '',
  aspect_ratio text NOT NULL DEFAULT '4:3' CHECK (aspect_ratio IN ('3:4','4:3','9:16','16:9','2.35:1')),
  category_id uuid REFERENCES public.prompt_case_filters(id) ON DELETE SET NULL,
  style_id uuid REFERENCES public.prompt_case_filters(id) ON DELETE SET NULL,
  scene_id uuid REFERENCES public.prompt_case_filters(id) ON DELETE SET NULL,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- 初始分类维度
INSERT INTO public.prompt_case_filters ("group", name, name_en, sort_order) VALUES
('category', '全部', 'All', 0),
('category', 'UI 与界面', 'UI & Interface', 1),
('category', '图表与信息可视化', 'Charts & Data Visualization', 2),
('category', '海报与排版', 'Posters & Layout', 3),
('category', '商品与电商', 'Products & E-commerce', 4),
('category', '品牌与标志', 'Branding & Logo', 5),
('category', '建筑与空间', 'Architecture & Space', 6),
('category', '摄影与写实', 'Photography & Realism', 7),
('category', '插画与艺术', 'Illustration & Art', 8),
('category', '人物与角色', 'Characters & Roles', 9),
('category', '场景与叙事', 'Scenes & Narrative', 10),
('category', '历史与古风题材', 'History & Ancient Themes', 11),
('category', '文档与出版物', 'Documents & Publications', 12),
('category', '其他应用场景', 'Other Application Scenarios', 13)
ON CONFLICT DO NOTHING;

-- 初始风格维度
INSERT INTO public.prompt_case_filters ("group", name, name_en, sort_order) VALUES
('style', '全部', 'All', 0),
('style', '3D', '3D', 1),
('style', '建筑', 'Architecture', 2),
('style', '品牌', 'Branding', 3),
('style', '角色', 'Character', 4),
('style', '人物', 'People', 5),
('style', '图表', 'Charts', 6),
('style', '古典', 'Classical', 7),
('style', '文档', 'Documents', 8),
('style', '历史', 'Historical', 9),
('style', '插画', 'Illustration', 10),
('style', '信息图', 'Infographic', 11),
('style', '其他应用场景', 'Other Application Scenarios', 12),
('style', '摄影', 'Photography', 13),
('style', '海报', 'Poster', 14),
('style', '商品', 'Product', 15),
('style', '写实', 'Realistic', 16),
('style', '场景', 'Scene', 17),
('style', '界面', 'Interface', 18)
ON CONFLICT DO NOTHING;

-- 初始场景维度
INSERT INTO public.prompt_case_filters ("group", name, name_en, sort_order) VALUES
('scene', '全部', 'All', 0),
('scene', '创意', 'Creative', 1),
('scene', '科技', 'Technology', 2),
('scene', '商业', 'Business', 3),
('scene', '教育', 'Education', 4),
('scene', '社媒', 'Social Media', 5),
('scene', '时尚', 'Fashion', 6),
('scene', '食品饮品', 'Food & Beverage', 7),
('scene', '旅行', 'Travel', 8),
('scene', '叙事', 'Narrative', 9),
('scene', '历史', 'History', 10)
ON CONFLICT DO NOTHING;

-- RLS
ALTER TABLE public.prompt_case_filters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prompt_cases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone view prompt case filters" ON public.prompt_case_filters;
CREATE POLICY "Anyone view prompt case filters"
  ON public.prompt_case_filters FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Admins manage prompt case filters" ON public.prompt_case_filters;
CREATE POLICY "Admins manage prompt case filters"
  ON public.prompt_case_filters FOR ALL
  TO authenticated
  USING (get_user_role(uid()) = 'admin'::user_role)
  WITH CHECK (get_user_role(uid()) = 'admin'::user_role);

DROP POLICY IF EXISTS "Anyone view active prompt cases" ON public.prompt_cases;
CREATE POLICY "Anyone view active prompt cases"
  ON public.prompt_cases FOR SELECT
  USING (is_active = true);

DROP POLICY IF EXISTS "Admins manage prompt cases" ON public.prompt_cases;
CREATE POLICY "Admins manage prompt cases"
  ON public.prompt_cases FOR ALL
  TO authenticated
  USING (get_user_role(uid()) = 'admin'::user_role)
  WITH CHECK (get_user_role(uid()) = 'admin'::user_role);