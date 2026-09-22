CREATE TABLE IF NOT EXISTS public.user_image_providers (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  provider text NOT NULL,
  base_url text NOT NULL,
  model text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- RLS：用户只能读写自己的配置
ALTER TABLE public.user_image_providers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "用户查看自己的生图配置" ON public.user_image_providers;
CREATE POLICY "用户查看自己的生图配置"
  ON public.user_image_providers
  FOR SELECT
  TO public
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "用户新增自己的生图配置" ON public.user_image_providers;
CREATE POLICY "用户新增自己的生图配置"
  ON public.user_image_providers
  FOR INSERT
  TO public
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "用户更新自己的生图配置" ON public.user_image_providers;
CREATE POLICY "用户更新自己的生图配置"
  ON public.user_image_providers
  FOR UPDATE
  TO public
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "用户删除自己的生图配置" ON public.user_image_providers;
CREATE POLICY "用户删除自己的生图配置"
  ON public.user_image_providers
  FOR DELETE
  TO public
  USING (user_id = auth.uid());

-- 管理员可查看全部（用于排查）
DROP POLICY IF EXISTS "管理员可查看全部生图配置" ON public.user_image_providers;
CREATE POLICY "管理员可查看全部生图配置"
  ON public.user_image_providers
  FOR SELECT
  TO public
  USING ((auth.jwt() ->> 'role') = 'authenticated' AND EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
  ));