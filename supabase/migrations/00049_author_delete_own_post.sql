-- 作者删除自己的帖子。
--
-- 为什么不是直接开一条 DELETE 策略：
-- 删掉帖子之后，content_submissions 里那条 approved 记录还指着一个
-- 已经不存在的 target_id。用户在「我的投稿」里还会看到它，点「申请修改」
-- 得到的是「读不到这条内容」——像个 bug。
-- 而作者按现行策略又删不掉自己 approved 的投稿记录（那是给管理员留的审核痕迹）。
--
-- 所以收口成一个函数：校验身份 → 删帖 → 顺手清掉该作者指向这条帖子的投稿记录。
-- 两步在同一个事务里，不会出现删一半的状态。
-- 评论有 ON DELETE CASCADE，跟着帖子一起走，这里不用管。

CREATE OR REPLACE FUNCTION public.delete_my_discussion_post(p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid    uuid := auth.uid();
  v_author uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION '请先登录';
  END IF;

  SELECT author_id INTO v_author FROM public.discussion_posts WHERE id = p_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION '帖子不存在或已被删除';
  END IF;

  -- 管理员也放行：后台将来要做帖子管理时能复用这个函数
  IF v_author IS DISTINCT FROM v_uid
     AND public.get_user_role(v_uid) IS DISTINCT FROM 'admin'::public.user_role THEN
    RAISE EXCEPTION '只能删除自己发布的帖子';
  END IF;

  -- 先清投稿记录再删帖：反过来的话中途失败会留下指向空目标的记录
  DELETE FROM public.content_submissions
  WHERE target_id = p_id
    AND kind = 'discussion_post'::public.submission_kind
    AND submitted_by = v_author;

  DELETE FROM public.discussion_posts WHERE id = p_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.delete_my_discussion_post(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.delete_my_discussion_post(uuid) TO authenticated;

COMMENT ON FUNCTION public.delete_my_discussion_post(uuid) IS
  '作者删除自己的帖子，同时清掉指向它的投稿记录。管理员也可调用。';
