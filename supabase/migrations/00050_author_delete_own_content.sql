-- 作者删除自己发布的内容：案例、项目、帖子都支持。
--
-- 取代 00049 那个只管帖子的函数（在文件末尾删掉）。
--
-- 「是不是自己的」以 content_submissions 为准，不看正式表上的作者字段：
--   · cases.author 只是个展示用的名字字符串，不是用户 id，靠不住；
--   · 管理员在后台直接新建的内容没有投稿记录，本来也不该让普通用户删。
-- 所以判据是：存在一条 approved 的投稿记录，target_id 指向它、submitted_by 是你。
-- 这和「我的投稿」列表里能看到什么，是同一个口径。
--
-- 要顺手清掉的关联数据：
--   · content_submissions —— 不清的话列表里会留下指向空目标的记录
--   · user_interactions   —— 点赞收藏表是 target_type + target_id 的弱关联，
--                            没有外键，不清就是孤儿行，还会让计数虚高
--   · user_unlock_records —— 有外键级联，跟着项目一起走，不用管
--   · post_comments       —— 有外键级联，跟着帖子一起走，不用管

CREATE OR REPLACE FUNCTION public.delete_my_published_content(
  p_kind public.submission_kind,
  p_id   uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid     uuid := auth.uid();
  v_owner   uuid;
  v_isadmin boolean;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION '请先登录';
  END IF;

  v_isadmin := public.get_user_role(v_uid) = 'admin'::public.user_role;

  SELECT submitted_by INTO v_owner
  FROM public.content_submissions
  WHERE target_id = p_id
    AND kind = p_kind
    AND status = 'approved'::public.submission_status
  ORDER BY reviewed_at DESC NULLS LAST
  LIMIT 1;

  IF v_owner IS NULL AND NOT v_isadmin THEN
    RAISE EXCEPTION '这条内容不是通过你的投稿发布的，无法删除';
  END IF;
  IF v_owner IS DISTINCT FROM v_uid AND NOT v_isadmin THEN
    RAISE EXCEPTION '只能删除自己发布的内容';
  END IF;

  -- 先清关联，再删正文：反过来的话中途失败会留下指向空目标的记录
  DELETE FROM public.content_submissions
  WHERE target_id = p_id AND kind = p_kind;

  IF p_kind = 'case'::public.submission_kind THEN
    DELETE FROM public.user_interactions WHERE target_type = 'case' AND target_id = p_id;
    DELETE FROM public.cases WHERE id = p_id;
  ELSIF p_kind = 'project'::public.submission_kind THEN
    DELETE FROM public.user_interactions WHERE target_type = 'project' AND target_id = p_id;
    DELETE FROM public.projects WHERE id = p_id;
  ELSE
    DELETE FROM public.discussion_posts WHERE id = p_id;
  END IF;

  IF NOT FOUND THEN
    RAISE EXCEPTION '内容不存在或已被删除';
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.delete_my_published_content(public.submission_kind, uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.delete_my_published_content(public.submission_kind, uuid) TO authenticated;

COMMENT ON FUNCTION public.delete_my_published_content(public.submission_kind, uuid) IS
  '作者删除自己发布的案例/项目/帖子，同时清掉投稿记录与点赞收藏。管理员也可调用。';

-- 00049 的帖子专用版已被取代
DROP FUNCTION IF EXISTS public.delete_my_discussion_post(uuid);
