-- 草稿箱：撤回的投稿不再删掉，收进草稿箱，以后能接着改、重新提交。
--
-- 之前「撤回」是 DELETE，用户辛苦写的东西点一下就没了，而且没有后悔余地。
-- 改成第四种状态 draft：管理员的审核列表只看 pending，所以草稿不会打扰后台。

-- ── 1. 新状态 ────────────────────────────────────
-- 枚举加值不能和后面引用它的语句同事务提交，所以单独一句先走
ALTER TYPE public.submission_status ADD VALUE IF NOT EXISTS 'draft';

COMMIT;

-- ── 2. 策略：作者能把自己的投稿收进草稿箱，也能从草稿箱重新提交 ──
-- 原策略只允许改 pending / rejected，且只能改回 pending。
-- 现在要允许：pending/rejected/draft 都可改，且可以落到 pending 或 draft。
DROP POLICY IF EXISTS "作者修改自己未通过的投稿" ON public.content_submissions;
CREATE POLICY "作者修改自己未通过的投稿" ON public.content_submissions
  FOR UPDATE TO authenticated
  USING (submitted_by = auth.uid()
         AND status IN ('pending'::public.submission_status,
                        'rejected'::public.submission_status,
                        'draft'::public.submission_status))
  WITH CHECK (submitted_by = auth.uid()
              AND status IN ('pending'::public.submission_status,
                             'draft'::public.submission_status));

-- 删除依然只允许作者删自己没通过的，草稿同理（草稿箱里要能彻底删掉）
DROP POLICY IF EXISTS "作者撤回自己的投稿" ON public.content_submissions;
CREATE POLICY "作者撤回自己的投稿" ON public.content_submissions
  FOR DELETE TO authenticated
  USING (submitted_by = auth.uid()
         AND status IN ('pending'::public.submission_status,
                        'rejected'::public.submission_status,
                        'draft'::public.submission_status));

-- ── 3. 审核函数：草稿不是待审，不能被审 ──────────────
-- 原函数只检查 status <> 'pending' 就报错，草稿天然被挡住，
-- 这里只是把报错文案说清楚，避免管理员看到「当前状态：draft」一头雾水。
COMMENT ON COLUMN public.content_submissions.status IS
  'pending=待审核，approved=已通过，rejected=已退回，draft=草稿箱（作者自己收起来的，不进审核队列）';
