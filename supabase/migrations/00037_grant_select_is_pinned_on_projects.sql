-- projects 表对 anon/authenticated 采用列级授权（保护 content 等付费列），
-- 新增的 is_pinned 列创建时未继承公开列的 SELECT 授权，导致前台查询 42501。
-- 对齐 is_hot/show_on_home 等公开列的授权范围，补上 SELECT：
GRANT SELECT (is_pinned) ON TABLE public.projects TO anon, authenticated;