-- 商务帖增加封面与配图
--
-- 正文仍然是纯文本，图片单独存一个数组，详情页排在正文前面。
-- 不改成富文本是有意的：商务板块是开放发帖，正文若变成用户提交的 HTML，
-- 详情页就得直接渲染它，多一个注入面。

ALTER TABLE public.business_posts
  ADD COLUMN IF NOT EXISTS cover_url text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS images    text[] NOT NULL DEFAULT '{}';


-- ── 审核函数：落库时带上封面与配图 ────────────────
-- 其余分支与 00043 完全一致，只动商务帖这一段。

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
      INSERT INTO public.business_posts (kind, title, body, cover_url, images, author_id, author_name, author_avatar)
      SELECT
        coalesce(nullif(s.payload->>'kind', ''), '其他'),
        coalesce(s.payload->>'title', ''),
        coalesce(s.payload->>'body', ''),
        coalesce(s.payload->>'cover_url', ''),
        -- payload 里是 json 数组，转成 text[]；没传就是空数组
        coalesce(
          (SELECT array_agg(value::text) FROM jsonb_array_elements_text(
             CASE WHEN jsonb_typeof(s.payload->'images') = 'array'
                  THEN s.payload->'images' ELSE '[]'::jsonb END) AS value),
          '{}'::text[]),
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
        cover_url  = coalesce(s.payload->>'cover_url', cover_url),
        images     = CASE WHEN jsonb_typeof(s.payload->'images') = 'array'
                          THEN coalesce((SELECT array_agg(value::text)
                                         FROM jsonb_array_elements_text(s.payload->'images') AS value),
                                        '{}'::text[])
                          ELSE images END,
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
