-- 商务与合作 → 分享讨论区
--
-- 定位变了：不再是找商务合作，而是社区成员分享和讨论技术话题的地方。
-- 表名、枚举值、站点设置的键一起改掉 —— 表里还是 0 条数据、功能也没上线，
-- 这是改名成本最低的时候。留着 business_posts 这个名字，以后看到会以为是别的东西。
--
-- 同时去掉分类：帖量少的时候「需求/供给/招聘」这套分类是空的筛选器，
-- 反而让页面显得冷清。以后帖多了再加。

-- ── 表与枚举改名 ─────────────────────────────────
ALTER TABLE public.business_posts RENAME TO discussion_posts;
ALTER TABLE public.discussion_posts DROP COLUMN IF EXISTS kind;

-- 索引名不会跟着表名走，手动改一下，免得以后 EXPLAIN 里看到旧名字犯迷糊
ALTER INDEX IF EXISTS business_posts_created_idx RENAME TO discussion_posts_created_idx;

-- 枚举值可以原地改名，历史投稿记录里的值会跟着变，不用回填
ALTER TYPE public.submission_kind RENAME VALUE 'business_post' TO 'discussion_post';

-- ── 站点设置的键 ─────────────────────────────────
-- 这三个键控制板块的可见性和顶部说明，管理员在后台配过内容，
-- 直接改键名即可，值原样保留
UPDATE public.site_settings SET key = 'discuss_visible'    WHERE key = 'business_coop_visible';
UPDATE public.site_settings SET key = 'discuss_content'    WHERE key = 'business_coop_content';
UPDATE public.site_settings SET key = 'discuss_content_en' WHERE key = 'business_coop_content_en';
-- 导航栏的中英标签也是存在这里的
UPDATE public.site_settings SET key = 'nav_discuss'    WHERE key = 'nav_business';
UPDATE public.site_settings SET key = 'nav_discuss_en' WHERE key = 'nav_business_en';

-- ── 审核函数：跟着改表名、去掉 kind ────────────────
-- case / project 两个分支仍与 00039 一致，未作改动。

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

  ELSIF s.kind::text = 'discussion_post' THEN
    IF s.target_id IS NULL THEN
      INSERT INTO public.discussion_posts (title, body, cover_url, images, author_id, author_name, author_avatar)
      SELECT
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
      UPDATE public.discussion_posts SET
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
