-- 将案例与项目的内容字段从 JSONB 数组改为 HTML 富文本字符串
ALTER TABLE public.cases
  ALTER COLUMN content TYPE text USING COALESCE(content::text, '');

ALTER TABLE public.cases
  ALTER COLUMN content_en TYPE text USING COALESCE(content_en::text, '');

ALTER TABLE public.projects
  ALTER COLUMN content TYPE text USING COALESCE(content::text, '');

ALTER TABLE public.projects
  ALTER COLUMN content_en TYPE text USING COALESCE(content_en::text, '');
