BEGIN;

-- projects 表曾通过列级权限白名单（gate_project_content.sql）收回全表 SELECT，
-- 迁移 00012 新增的 base_likes / base_favorites / base_views 未包含在白名单中，
-- 导致前台查询项目列表/统计时 403 permission denied。
-- 这里按原有白名单模式为三个新列补授 SELECT（只读，不含 content/external_url 等敏感列）。
GRANT SELECT (base_likes, base_favorites, base_views) ON TABLE public.projects TO anon, authenticated;

COMMIT;