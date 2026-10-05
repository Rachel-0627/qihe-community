-- 付费项目的免费试看章节。
-- 权限不够的用户可见全部章节标题，以及被指定为免费的那几章正文。
--
-- 切分在服务端完成：若把完整正文下发再由前端隐藏，开发者工具即可取得全文。
-- 免费名单按 data-ch 记录：章节序号会因插删或调序指向别的章节，且不报错。
-- data-ch 是保存正文时写入的永久编号，随章节移动。
-- 章节以正文中出现的最高一级标题界定：部分内容用 h1 分章，部分直接用 h2，
-- 固定按 h2 切分时，全篇使用 h1 的内容会切出 0 章。

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS preview_chapters text[] NOT NULL DEFAULT '{}';

-- 哪几章免费不是敏感信息，前台需要它来渲染目录上的锁
GRANT SELECT (preview_chapters) ON public.projects TO anon, authenticated;
GRANT UPDATE (preview_chapters), INSERT (preview_chapters) ON public.projects TO authenticated;

-- ── 取正文 ──────────────────────────────────────────
-- 权限判断逻辑与 00022 完全一致，未作改动；
-- 新增的是：无论有没有权限，都返回全量目录；没权限时返回试看片段。

CREATE OR REPLACE FUNCTION public.get_project_content(p_project_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_access       public.content_access;
  v_content      text;
  v_content_en   text;
  v_external_url text;
  v_preview_ids  text[];
  v_tier         public.member_tier;
  v_role         public.user_role;
  v_unlocked     boolean;
  v_allowed      boolean;
  v_is_auth      boolean;

  v_parts        text[];
  v_headings     jsonb := '[]'::jsonb;
  v_preview_zh   text := '';
  v_preview_en   text := '';
  v_tag          text;
  v_ch           text;
  v_title        text;
  v_free         boolean;
  i              int;
BEGIN
  SELECT access_level, content, content_en, external_url, coalesce(preview_chapters, '{}')
    INTO v_access, v_content, v_content_en, v_external_url, v_preview_ids
  FROM public.projects
  WHERE id = p_project_id;

  IF NOT FOUND THEN
    RETURN json_build_object('allowed', false, 'reason', 'not_found');
  END IF;

  -- 仅当用户已登录（role = authenticated）时才查 profiles，避免 'anon' 被当作 UUID
  v_is_auth := COALESCE(auth.jwt() ->> 'role', 'anon') = 'authenticated';

  IF v_is_auth THEN
    SELECT role, member_tier INTO v_role, v_tier
    FROM public.profiles WHERE id = auth.uid();
  END IF;

  IF v_role = 'admin'::public.user_role THEN
    v_allowed := true;
  ELSE
    v_tier := COALESCE(v_tier, 'guest'::public.member_tier);

    v_allowed := CASE v_access
      WHEN 'free'::public.content_access   THEN true
      WHEN 'member'::public.content_access THEN v_tier IN ('member'::public.member_tier, 'pro'::public.member_tier)
      WHEN 'pro'::public.content_access    THEN v_tier = 'pro'::public.member_tier
      ELSE false
    END;

    IF NOT v_allowed AND v_is_auth THEN
      SELECT EXISTS(
        SELECT 1 FROM public.user_unlock_records
        WHERE user_id = auth.uid() AND project_id = p_project_id
      ) INTO v_unlocked;
      IF v_unlocked THEN v_allowed := true; END IF;
    END IF;
  END IF;

  -- ── 目录：无论有没有权限都要给 ──
  -- 用 chr(1) 作分隔符切开，而不是正则 split：正则处理跨行 HTML 容易出错，
  -- 而 <h2 这个串在正文里不会有别的含义。
  -- 切完 v_parts[1] 是第一个 h2 之前的引言，其余每段对应一章。
  v_tag := CASE WHEN strpos(coalesce(v_content, ''), '<h1') > 0 THEN 'h1' ELSE 'h2' END;
  v_parts := string_to_array(
    replace(coalesce(v_content, ''), '<' || v_tag, chr(1) || '<' || v_tag), chr(1));

  IF array_length(v_parts, 1) IS NOT NULL THEN
    -- 引言部分始终免费：它是文章的开场，锁住它会让页面看起来像坏了
    v_preview_zh := coalesce(v_parts[1], '');

    FOR i IN 2 .. array_length(v_parts, 1) LOOP
      v_ch    := substring(v_parts[i] from 'data-ch="([^"]+)"');
      v_title := substring(v_parts[i] from '<' || v_tag || '[^>]*>(.*?)</' || v_tag || '>');
      v_title := btrim(regexp_replace(coalesce(v_title, ''), '<[^>]+>', '', 'g'));
      -- 没有 data-ch 的是旧正文（还没盖过章），无法被指定为免费
      v_free  := v_ch IS NOT NULL AND v_ch = ANY(v_preview_ids);

      IF v_free THEN
        v_preview_zh := v_preview_zh || v_parts[i];
      END IF;

      v_headings := v_headings || jsonb_build_object(
        'ch', v_ch,
        'text', v_title,
        -- 有权限时一律不锁
        'locked', (NOT v_allowed) AND (NOT v_free)
      );
    END LOOP;
  END IF;

  IF v_allowed THEN
    RETURN json_build_object(
      'allowed', true,
      'preview', false,
      'headings', v_headings,
      -- 给后台回填勾选状态用。不把这一列加进公共列清单，是为了避免
      -- 迁移没执行时整个项目列表查询直接 400（show_on_home 出过这个事故）
      'preview_chapters', to_jsonb(v_preview_ids),
      'content', v_content,
      'content_en', v_content_en,
      'external_url', v_external_url
    );
  END IF;

  -- ── 没权限：只给引言 + 免费章节 ──
  -- 英文正文单独切一遍。两套正文的 data-ch 未必对得上（各自独立编辑），
  -- 对不上时英文就只剩引言，宁可少给，也不能猜着多给。
  v_tag := CASE WHEN strpos(coalesce(v_content_en, ''), '<h1') > 0 THEN 'h1' ELSE 'h2' END;
  v_parts := string_to_array(
    replace(coalesce(v_content_en, ''), '<' || v_tag, chr(1) || '<' || v_tag), chr(1));
  IF array_length(v_parts, 1) IS NOT NULL THEN
    v_preview_en := coalesce(v_parts[1], '');
    FOR i IN 2 .. array_length(v_parts, 1) LOOP
      v_ch := substring(v_parts[i] from 'data-ch="([^"]+)"');
      IF v_ch IS NOT NULL AND v_ch = ANY(v_preview_ids) THEN
        v_preview_en := v_preview_en || v_parts[i];
      END IF;
    END LOOP;
  END IF;

  RETURN json_build_object(
    'allowed', false,
    'reason', 'insufficient_tier',
    'preview', true,
    'headings', v_headings,
    'content', v_preview_zh,
    'content_en', v_preview_en
    -- external_url 不给：那是付费内容的一部分
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_project_content(uuid) TO anon, authenticated;
