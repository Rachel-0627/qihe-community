-- 允许登录用户上传媒体文件
--
-- 迁移 00001 把 media 桶的上传限制成「仅管理员」，那时候确实只有管理员
-- 在后台传图。后来加了用户投稿（案例、项目、讨论帖），封面和配图走的是
-- 同一个桶，于是普通用户一传图就报 "new row violates row-level security policy"。
-- 这个缺陷从投稿功能上线起就存在，一直没暴露是因为测试时用的都是管理员账号。
--
-- 只放开 INSERT，不放开 UPDATE / DELETE：
-- 用户能传新文件，但覆盖不了、也删不掉别人已经传上去的。
-- 原有的管理员策略保留 —— 多条宽松策略之间是「或」的关系，不冲突。
--
-- 不按目录前缀再细分权限：media 桶本来就是公开可读的，
-- 限制路径并不增加实质安全性，反而每加一个新目录都要改策略。
-- 真正的防滥用手段是上传函数里的大小上限（50MB）和图片压缩。

DROP POLICY IF EXISTS "Users upload media" ON storage.objects;
CREATE POLICY "Users upload media" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'media');
