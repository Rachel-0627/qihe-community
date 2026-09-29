-- 修补 00040：收紧「引言免费」的条件
--
-- 00040 里引言无条件免费，有两种情况会漏内容：
--   1. 正文一个标题都没有 —— 整篇都被当成引言，付费全文直接发给未登录用户；
--   2. 唯一的标题在文章末尾 —— 前面一大段同样漏出去。
-- 这里加上「必须切出了章节」和「引言不超过 2000 字符」两个前提，失败时不给引言。
--
-- 只替换函数，不动 00040 建的列。

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
    -- 引言（第一个标题之前的部分）默认免费，但有两道闸：
    --   1. 必须真的切出了章节。一篇标题都没有的正文，整篇都会被当成「引言」，
    --      不设这道闸就等于把付费全文直接发给未登录用户。
    --   2. 引言本身不能太长。唯一的标题若在文章末尾，前面一大段同样会漏出去。
    -- 两个条件任一不满足就不给引言——页面上只剩付费提示，但不会漏内容。
    IF array_length(v_parts, 1) > 1 AND length(coalesce(v_parts[1], '')) <= 2000 THEN
      v_preview_zh := coalesce(v_parts[1], '');
    END IF;

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
  -- 对不上时英文就只剩引言——宁可少给，也不能猜着多给。
  v_tag := CASE WHEN strpos(coalesce(v_content_en, ''), '<h1') > 0 THEN 'h1' ELSE 'h2' END;
  v_parts := string_to_array(
    replace(coalesce(v_content_en, ''), '<' || v_tag, chr(1) || '<' || v_tag), chr(1));
  IF array_length(v_parts, 1) IS NOT NULL THEN
    IF array_length(v_parts, 1) > 1 AND length(coalesce(v_parts[1], '')) <= 2000 THEN
      v_preview_en := coalesce(v_parts[1], '');
    END IF;
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
