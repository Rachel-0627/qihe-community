-- 商务与合作：用户发帖 + 评论
--
-- 帖子走已有的投稿审核流程（content_submissions + review_submission），
-- 审核通过才会写进 business_posts，所以这张表里只有已发布的内容，
-- 不需要 status 列 —— 待审核的帖子在 content_submissions 里，
-- 「我的投稿」页面已经能看到。
--
-- 帖子里不存任何联系方式：交流只在评论区进行。

-- ── 枚举加一个值 ──────────────────────────────────
-- 注意：新枚举值在同一个事务里不能被引用（Postgres 限制），
-- 所以下面的函数体一律用 kind::text = 'business_post' 比较，
-- 而不是 kind = 'business_post'::submission_kind。
ALTER TYPE public.submission_kind ADD VALUE IF NOT EXISTS 'business_post';

-- ── 帖子 ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.business_posts (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- 供需分类。用 text + CHECK 而不是枚举：改动只要改约束，
  -- 加枚举值那套事务限制很烦
  kind       text NOT NULL DEFAULT '其他'
             CHECK (kind IN ('需求', '供给', '招聘', '其他')),
  title      text NOT NULL DEFAULT '',
  body       text NOT NULL DEFAULT '',
  author_id  uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  -- 作者昵称/头像冗余存一份：profiles 的 RLS 只让人看自己的，
  -- 未登录访客直接查作者信息会得到 0 行，帖子上就没名字了。
  -- 冗余的副作用反而对：用户以后改昵称，旧帖子仍显示当时的署名。
  author_name   text NOT NULL DEFAULT '',
  author_avatar text NOT NULL DEFAULT '',
  is_pinned  boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS business_posts_created_idx ON public.business_posts (is_pinned DESC, created_at DESC);

-- ── 评论 ─────────────────────────────────────────
-- 只绑帖子，不做通用的 target_type：现在只有这一处要用，
-- 以后真要给案例加评论再说，不提前造复杂度。
CREATE TABLE IF NOT EXISTS public.post_comments (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id    uuid NOT NULL REFERENCES public.business_posts(id) ON DELETE CASCADE,
  author_id  uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  author_name   text NOT NULL DEFAULT '',
  author_avatar text NOT NULL DEFAULT '',
  body       text NOT NULL,
  -- 软删：留痕，方便事后查是谁删的、删了什么
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS post_comments_post_idx ON public.post_comments (post_id, created_at);

-- 不存 comment_count：存了就会跟真实值对不上（漏更新、并发）。
-- 前端用 PostgREST 的 post_comments(count) 直接数，永远准。

-- ── 评论署名由触发器填 ────────────────────────────
-- 不让前端自己传 author_name：那样任何人都能以别人的名义发言。
-- 触发器以表属主身份执行，能越过 profiles 的 RLS 查到昵称。

CREATE OR REPLACE FUNCTION public.fill_comment_author()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
BEGIN
  SELECT coalesce(nullif(p.nickname, ''), p.username, '匿名'), coalesce(p.avatar_url, '')
    INTO NEW.author_name, NEW.author_avatar
  FROM public.profiles p WHERE p.id = NEW.author_id;

  IF NEW.author_name IS NULL OR NEW.author_name = '' THEN
    NEW.author_name := '匿名';
  END IF;
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS post_comments_fill_author ON public.post_comments;
CREATE TRIGGER post_comments_fill_author
  BEFORE INSERT ON public.post_comments
  FOR EACH ROW EXECUTE FUNCTION public.fill_comment_author();

-- ── 权限 ─────────────────────────────────────────
ALTER TABLE public.business_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_comments  ENABLE ROW LEVEL SECURITY;

-- 帖子：人人可读；写入只能通过审核函数（SECURITY DEFINER 绕过 RLS），
-- 所以这里不给任何人 INSERT
DROP POLICY IF EXISTS business_posts_read ON public.business_posts;
CREATE POLICY business_posts_read ON public.business_posts
  FOR SELECT USING (true);

DROP POLICY IF EXISTS business_posts_admin_write ON public.business_posts;
CREATE POLICY business_posts_admin_write ON public.business_posts
  FOR ALL TO authenticated
  USING (public.get_user_role(auth.uid()) = 'admin'::public.user_role)
  WITH CHECK (public.get_user_role(auth.uid()) = 'admin'::public.user_role);

-- 评论：没删的人人可读
DROP POLICY IF EXISTS post_comments_read ON public.post_comments;
CREATE POLICY post_comments_read ON public.post_comments
  FOR SELECT USING (deleted_at IS NULL);

-- 登录用户可以发评论，但只能以自己的身份发
DROP POLICY IF EXISTS post_comments_insert ON public.post_comments;
CREATE POLICY post_comments_insert ON public.post_comments
  FOR INSERT TO authenticated
  WITH CHECK (author_id = auth.uid());

-- 作者删自己的，管理员删所有的。用 UPDATE 打 deleted_at，不真删
DROP POLICY IF EXISTS post_comments_soft_delete ON public.post_comments;
CREATE POLICY post_comments_soft_delete ON public.post_comments
  FOR UPDATE TO authenticated
  USING (author_id = auth.uid() OR public.get_user_role(auth.uid()) = 'admin'::public.user_role)
  WITH CHECK (author_id = auth.uid() OR public.get_user_role(auth.uid()) = 'admin'::public.user_role);

GRANT SELECT ON public.business_posts TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.post_comments TO authenticated;
GRANT SELECT ON public.post_comments TO anon;

-- ── 审核函数：加商务帖分支 ─────────────────────────
-- 原函数的分支是「IF kind = 'case' ... ELSE 当作 project」。
-- 枚举一加新值，商务帖就会被悄悄插进 projects 表 —— 不报错，最难查的那种。
-- 这里改成三个显式分支 + 兜底 RAISE。case 与 project 的处理逻辑原样保留。
--
-- 所有判断都用 kind::text 比较：新加的枚举值在同一个事务里不能被引用。

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

  IF s.kind::text = 'case' THEN
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

  ELSIF s.kind::text = 'project' THEN
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

  ELSIF s.kind::text = 'business_post' THEN
    IF s.target_id IS NULL THEN
      INSERT INTO public.business_posts (kind, title, body, author_id, author_name, author_avatar)
      SELECT
        coalesce(nullif(s.payload->>'kind', ''), '其他'),
        coalesce(s.payload->>'title', ''),
        coalesce(s.payload->>'body', ''),
        s.submitted_by,
        coalesce(nullif(p.nickname, ''), p.username, '匿名'),
        coalesce(p.avatar_url, '')
      FROM public.profiles p WHERE p.id = s.submitted_by
      RETURNING id INTO v_new_id;
    ELSE
      UPDATE public.business_posts SET
        kind       = coalesce(nullif(s.payload->>'kind', ''), kind),
        title      = coalesce(s.payload->>'title', title),
        body       = coalesce(s.payload->>'body', body),
        updated_at = now()
        -- is_pinned 不跟随用户提交，只有管理员能置顶
      WHERE id = s.target_id
      RETURNING id INTO v_new_id;
    END IF;

  ELSE
    -- 兜底必须报错。原来这里是「其余一律当项目处理」，
    -- 只要给枚举加一个新值就会被悄悄插进项目表，不报错、不好查。
    RAISE EXCEPTION '未知的投稿类型：%', s.kind;
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
