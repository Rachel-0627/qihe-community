-- 用户昵称
ALTER TABLE public.profiles ADD COLUMN nickname text;

-- 项目筛选项默认首页展示标记
ALTER TABLE public.project_filter_options ADD COLUMN is_featured boolean NOT NULL DEFAULT false;

-- 头像存储桶
INSERT INTO storage.buckets (id, name, public, avif_autodetection, file_size_limit, allowed_mime_types)
VALUES ('avatars', 'avatars', true, false, 1048576, ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/avif'])
ON CONFLICT (id) DO NOTHING;

-- 头像桶策略：公开读取
DROP POLICY IF EXISTS "Allow public read avatars" ON storage.objects;
CREATE POLICY "Allow public read avatars"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'avatars');

-- 头像桶策略：认证用户上传自己的头像
DROP POLICY IF EXISTS "Allow authenticated upload own avatar" ON storage.objects;
CREATE POLICY "Allow authenticated upload own avatar"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

-- 头像桶策略：认证用户更新自己的头像
DROP POLICY IF EXISTS "Allow authenticated update own avatar" ON storage.objects;
CREATE POLICY "Allow authenticated update own avatar"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

-- 头像桶策略：认证用户删除自己的头像
DROP POLICY IF EXISTS "Allow authenticated delete own avatar" ON storage.objects;
CREATE POLICY "Allow authenticated delete own avatar"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);