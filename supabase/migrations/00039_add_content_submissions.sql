-- 用户投稿 + 管理员审核
--
-- 设计要点：待审内容【不进】cases / projects，只存在 content_submissions 里。
-- 好处：正式表永远只有已发布内容，前台所有查询不用改；也不用动 projects 那套
-- 保护付费正文的列级权限（改那里风险很高）。
-- 「编辑已发布内容也要审」靠 target_id 实现：非空表示这条投稿是对某条已发布
-- 内容的修改，审核通过时覆盖过去。审核期间原文照常在线，不会下线。

CREATE TYPE public.submission_kind   AS ENUM ('case', 'project');
CREATE TYPE public.submission_status AS ENUM ('pending', 'approved', 'rejected');

CREATE TABLE IF NOT EXISTS public.content_submissions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind          public.submission_kind   NOT NULL,
  -- NULL = 新投稿；非 NULL = 修改已发布的这条内容
  target_id     uuid,
  -- 提交的字段内容。用 jsonb 存，正式表加字段时这里不用跟着改结构
  payload       jsonb NOT NULL DEFAULT '{}'::jsonb,
  status        public.submission_status NOT NULL DEFAULT 'pending',
  submitted_by  uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  submitted_at  timestamptz NOT NULL DEFAULT now(),
  reviewed_by   uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at   timestamptz,
  review_note   text NOT NULL DEFAULT '',
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_submissions_review
  ON public.content_submissions (status, submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_submissions_mine
  ON public.content_submissions (submitted_by, submitted_at DESC);

-- updated_at 自动维护
CREATE OR REPLACE FUNCTION public.touch_submission_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_submissions_updated_at ON public.content_submissions;
CREATE TRIGGER trg_submissions_updated_at
  BEFORE UPDATE ON public.content_submissions
  FOR EACH ROW EXECUTE FUNCTION public.touch_submission_updated_at();

-- ── 权限 ──────────────────────────────────────────────
-- 作者只能碰自己的，且改动限制在待审/已驳回状态；管理员看得到全部。
-- 匿名完全不可见。注意：这里没有给任何人写 cases / projects 的权限，
-- 落地只能through 下面那个受控函数。

ALTER TABLE public.content_submissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "作者查看自己的投稿" ON public.content_submissions;
CREATE POLICY "作者查看自己的投稿" ON public.content_submissions
  FOR SELECT TO authenticated
  USING (submitted_by = auth.uid());

DROP POLICY IF EXISTS "管理员查看全部投稿" ON public.content_submissions;
CREATE POLICY "管理员查看全部投稿" ON public.content_submissions
  FOR SELECT TO authenticated
  USING (public.get_user_role(auth.uid()) = 'admin'::public.user_role);

DROP POLICY IF EXISTS "作者提交投稿" ON public.content_submissions;
CREATE POLICY "作者提交投稿" ON public.content_submissions
  FOR INSERT TO authenticated
  WITH CHECK (submitted_by = auth.uid() AND status = 'pending'::public.submission_status);

-- 驳回后可以改了重投；已通过的不能再改（要改就新建一条 target_id 指向它的投稿）
DROP POLICY IF EXISTS "作者修改自己未通过的投稿" ON public.content_submissions;
CREATE POLICY "作者修改自己未通过的投稿" ON public.content_submissions
  FOR UPDATE TO authenticated
  USING (submitted_by = auth.uid()
         AND status IN ('pending'::public.submission_status, 'rejected'::public.submission_status))
  WITH CHECK (submitted_by = auth.uid()
              AND status = 'pending'::public.submission_status);

DROP POLICY IF EXISTS "作者撤回自己的投稿" ON public.content_submissions;
CREATE POLICY "作者撤回自己的投稿" ON public.content_submissions
  FOR DELETE TO authenticated
  USING (submitted_by = auth.uid()
         AND status IN ('pending'::public.submission_status, 'rejected'::public.submission_status));

DROP POLICY IF EXISTS "管理员管理全部投稿" ON public.content_submissions;
CREATE POLICY "管理员管理全部投稿" ON public.content_submissions
  FOR ALL TO authenticated
  USING (public.get_user_role(auth.uid()) = 'admin'::public.user_role)
  WITH CHECK (public.get_user_role(auth.uid()) = 'admin'::public.user_role);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.content_submissions TO authenticated;

-- ── 审核落地 ──────────────────────────────────────────
-- SECURITY DEFINER：普通用户没有写 cases/projects 的权限，只有这个函数能写，
-- 而函数第一件事就是校验调用者是管理员。
--
-- 字段白名单很关键：payload 是用户提交的，绝不能让它设置 is_featured、
-- base_likes 这类运营字段，projects 的 access_level 也强制为 free，
-- 否则用户能把自己的投稿标成付费内容。

CREATE OR REPLACE FUNCTION public.review_submission(
  p_id      uuid,
  p_approve boolean,
  p_note    text DEFAULT ''
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  s          public.content_submissions;
  v_admin    uuid := auth.uid();
  v_new_id   uuid;
BEGIN
  IF public.get_user_role(v_admin) IS DISTINCT FROM 'admin'::public.user_role THEN
    RAISE EXCEPTION '只有管理员可以审核投稿';
  END IF;

  SELECT * INTO s FROM public.content_submissions WHERE id = p_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION '投稿不存在';
  END IF;
  IF s.status <> 'pending'::public.submission_status THEN
    RAISE EXCEPTION '这条投稿已经处理过了（当前状态：%）', s.status;
  END IF;

  IF NOT p_approve THEN
    UPDATE public.content_submissions
    SET status = 'rejected', reviewed_by = v_admin, reviewed_at = now(), review_note = coalesce(p_note, '')
    WHERE id = p_id;
    RETURN jsonb_build_object('ok', true, 'status', 'rejected');
  END IF;

  IF s.kind = 'case'::public.submission_kind THEN
    IF s.target_id IS NULL THEN
      INSERT INTO public.cases (
        title, title_en, summary, summary_en, cover_url, video_url,
        category_id, content, content_en, author, author_en
      )
      SELECT
        coalesce(s.payload->>'title', ''),      coalesce(s.payload->>'title_en', ''),
        coalesce(s.payload->>'summary', ''),    coalesce(s.payload->>'summary_en', ''),
        coalesce(s.payload->>'cover_url', ''),  coalesce(s.payload->>'video_url', ''),
        nullif(s.payload->>'category_id', '')::uuid,
        coalesce(s.payload->>'content', ''),    coalesce(s.payload->>'content_en', ''),
        coalesce(s.payload->>'author', ''),     coalesce(s.payload->>'author_en', '')
      RETURNING id INTO v_new_id;
    ELSE
      UPDATE public.cases SET
        title       = coalesce(s.payload->>'title', title),
        title_en    = coalesce(s.payload->>'title_en', title_en),
        summary     = coalesce(s.payload->>'summary', summary),
        summary_en  = coalesce(s.payload->>'summary_en', summary_en),
        cover_url   = coalesce(s.payload->>'cover_url', cover_url),
        video_url   = coalesce(s.payload->>'video_url', video_url),
        category_id = coalesce(nullif(s.payload->>'category_id', '')::uuid, category_id),
        content     = coalesce(s.payload->>'content', content),
        content_en  = coalesce(s.payload->>'content_en', content_en),
        author      = coalesce(s.payload->>'author', author),
        author_en   = coalesce(s.payload->>'author_en', author_en)
      WHERE id = s.target_id
      RETURNING id INTO v_new_id;
    END IF;

  ELSE  -- project
    IF s.target_id IS NULL THEN
      INSERT INTO public.projects (
        title, title_en, summary, summary_en, cover_url, video_url,
        scene, scene_en, maturity, maturity_en,
        content, content_en, external_url, access_level, created_by
      )
      SELECT
        coalesce(s.payload->>'title', ''),      coalesce(s.payload->>'title_en', ''),
        coalesce(s.payload->>'summary', ''),    coalesce(s.payload->>'summary_en', ''),
        coalesce(s.payload->>'cover_url', ''),  coalesce(s.payload->>'video_url', ''),
        coalesce(s.payload->>'scene', ''),      coalesce(s.payload->>'scene_en', ''),
        coalesce(s.payload->>'maturity', ''),   coalesce(s.payload->>'maturity_en', ''),
        coalesce(s.payload->>'content', ''),    coalesce(s.payload->>'content_en', ''),
        coalesce(s.payload->>'external_url', ''),
        'free'::public.content_access,   -- 付费分级只能由管理员在后台改
        s.submitted_by
      RETURNING id INTO v_new_id;
    ELSE
      UPDATE public.projects SET
        title        = coalesce(s.payload->>'title', title),
        title_en     = coalesce(s.payload->>'title_en', title_en),
        summary      = coalesce(s.payload->>'summary', summary),
        summary_en   = coalesce(s.payload->>'summary_en', summary_en),
        cover_url    = coalesce(s.payload->>'cover_url', cover_url),
        video_url    = coalesce(s.payload->>'video_url', video_url),
        scene        = coalesce(s.payload->>'scene', scene),
        scene_en     = coalesce(s.payload->>'scene_en', scene_en),
        maturity     = coalesce(s.payload->>'maturity', maturity),
        maturity_en  = coalesce(s.payload->>'maturity_en', maturity_en),
        content      = coalesce(s.payload->>'content', content),
        content_en   = coalesce(s.payload->>'content_en', content_en),
        external_url = coalesce(s.payload->>'external_url', external_url)
        -- access_level 不跟随用户提交
      WHERE id = s.target_id
      RETURNING id INTO v_new_id;
    END IF;
  END IF;

  IF v_new_id IS NULL THEN
    RAISE EXCEPTION '目标内容不存在，可能已被删除';
  END IF;

  UPDATE public.content_submissions
  SET status = 'approved', reviewed_by = v_admin, reviewed_at = now(),
      review_note = coalesce(p_note, ''), target_id = v_new_id
  WHERE id = p_id;

  RETURN jsonb_build_object('ok', true, 'status', 'approved', 'content_id', v_new_id);
END;
$$;

REVOKE ALL ON FUNCTION public.review_submission(uuid, boolean, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.review_submission(uuid, boolean, text) TO authenticated;
