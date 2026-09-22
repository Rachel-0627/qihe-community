CREATE TABLE IF NOT EXISTS public.prompt_case_generations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt_case_id uuid NOT NULL REFERENCES public.prompt_cases(id) ON DELETE CASCADE,
  image_url text NOT NULL,
  prompt_text text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 索引：按案例查询历史
CREATE INDEX IF NOT EXISTS idx_prompt_case_generations_case_id ON public.prompt_case_generations(prompt_case_id);

-- RLS：任何人可查看/新增（工具页支持匿名使用）
ALTER TABLE public.prompt_case_generations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "任何人可查看生图历史" ON public.prompt_case_generations;
CREATE POLICY "任何人可查看生图历史"
  ON public.prompt_case_generations
  FOR SELECT
  TO public
  USING (true);

DROP POLICY IF EXISTS "任何人可新增生图历史" ON public.prompt_case_generations;
CREATE POLICY "任何人可新增生图历史"
  ON public.prompt_case_generations
  FOR INSERT
  TO public
  WITH CHECK (true);

-- 管理员可删除
DROP POLICY IF EXISTS "管理员可删除生图历史" ON public.prompt_case_generations;
CREATE POLICY "管理员可删除生图历史"
  ON public.prompt_case_generations
  FOR DELETE
  TO public
  USING ((auth.jwt() ->> 'role') = 'authenticated' AND EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
  ));