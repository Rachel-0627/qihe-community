// 用户投稿与管理员审核。
// 单独成文件而不是塞进 api.ts：那个文件已经 1099 行，是待拆清单的第一项。
//
// 数据流：用户写入 content_submissions（待审）→ 管理员调 review_submission()
// → 函数校验管理员身份后把内容落到 cases / projects。
// 普通用户全程没有写正式表的权限。

import { supabase } from '@/db/supabase';
import type {
  ContentSubmission,
  SubmissionKind,
  SubmissionPayload,
  SubmissionStatus,
} from '@/types/types';

const asArray = <T,>(data: unknown): T[] => (Array.isArray(data) ? (data as T[]) : []);

async function currentUserId(): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('请先登录后再投稿');
  return user.id;
}

/**
 * 新建投稿。
 * @param targetId 传入已发布内容的 id，表示这是一次「修改已发布内容」的申请；
 *                 审核通过时会覆盖那条内容，审核期间原文照常在线。
 */
export async function createSubmission(
  kind: SubmissionKind,
  payload: SubmissionPayload,
  targetId?: string | null,
): Promise<ContentSubmission> {
  const uid = await currentUserId();
  const { data, error } = await supabase
    .from('content_submissions')
    .insert({
      kind,
      payload,
      target_id: targetId ?? null,
      submitted_by: uid,
      status: 'pending',
    })
    .select()
    .single();
  if (error) throw error;
  return data as ContentSubmission;
}

/**
 * 修改自己尚未通过的投稿（含被驳回后改了重投）。
 * 状态会回到待审，并清掉上一次的驳回理由，避免用户改完还看到旧提示。
 */
export async function updateSubmission(
  id: string,
  payload: SubmissionPayload,
): Promise<ContentSubmission> {
  const { data, error } = await supabase
    .from('content_submissions')
    .update({ payload, status: 'pending', review_note: '' })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data as ContentSubmission;
}

/**
 * 撤回：收进草稿箱，不删。
 *
 * 之前撤回是直接 DELETE，用户写了半天的东西点一下就没了，也没有后悔余地。
 * 收进草稿箱后管理员的审核队列（只看 pending）照样看不到它。
 */
export async function withdrawToDraft(id: string): Promise<void> {
  const { error } = await supabase
    .from('content_submissions')
    .update({ status: 'draft' })
    .eq('id', id);
  if (error) throw error;
}

/** 草稿箱里的重新投出去。状态回到待审，顺带清掉上一次的退回理由。 */
export async function submitDraft(id: string): Promise<void> {
  const { error } = await supabase
    .from('content_submissions')
    .update({ status: 'pending', review_note: '' })
    .eq('id', id);
  if (error) throw error;
}

/** 彻底删除投稿。普通用户只能删自己未通过的（含草稿）；管理员可删任意记录。 */
export async function deleteSubmission(id: string): Promise<void> {
  const { error } = await supabase.from('content_submissions').delete().eq('id', id);
  if (error) throw error;
}

/** 我的投稿。RLS 已限定只能看到自己的，这里不用再加 where。 */
export async function fetchMySubmissions(): Promise<ContentSubmission[]> {
  const { data, error } = await supabase
    .from('content_submissions')
    .select('*')
    .order('submitted_at', { ascending: false });
  if (error) throw error;
  return asArray<ContentSubmission>(data);
}

export async function fetchSubmission(id: string): Promise<ContentSubmission | null> {
  const { data, error } = await supabase
    .from('content_submissions')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return (data as ContentSubmission) ?? null;
}

/** 后台审核列表。非管理员调用会因 RLS 拿到空数组，不会报错。 */
export async function fetchSubmissionsForReview(
  status?: SubmissionStatus,
): Promise<ContentSubmission[]> {
  let q = supabase
    .from('content_submissions')
    .select('*, submitter:profiles!content_submissions_submitted_by_fkey(nickname,username,avatar_url)')
    .order('submitted_at', { ascending: false });
  if (status) q = q.eq('status', status);
  const { data, error } = await q;
  if (error) throw error;
  return asArray<ContentSubmission>(data);
}

/** 待审数量，用于后台标签页上的红点。 */
export async function countPendingSubmissions(): Promise<number> {
  const { count, error } = await supabase
    .from('content_submissions')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'pending');
  if (error) throw error;
  return count ?? 0;
}

/**
 * 审核。通过时由数据库函数把内容写进正式表，这一步必须走函数，
 * 因为前台这个匿名/登录身份没有写 cases / projects 的权限。
 */
export async function reviewSubmission(
  id: string,
  approve: boolean,
  note = '',
): Promise<{ ok: boolean; status: string; content_id?: string }> {
  const { data, error } = await supabase.rpc('review_submission', {
    p_id: id,
    p_approve: approve,
    p_note: note,
  });
  if (error) throw error;
  return data as { ok: boolean; status: string; content_id?: string };
}

/**
 * 同一条已发布内容只保留一条待审的修改申请。
 *
 * 用户改了一次还没审，又想再改：这时应该覆盖那条待审记录，
 * 而不是再开一条。否则后台会看到两条互相覆盖的申请，
 * 先批哪条结果不一样。
 *
 * @returns 已存在的待审申请；没有则 null
 */
export async function findPendingEditFor(targetId: string): Promise<ContentSubmission | null> {
  const uid = await currentUserId();
  const { data, error } = await supabase
    .from('content_submissions')
    .select('*')
    .eq('target_id', targetId)
    .eq('submitted_by', uid)
    .eq('status', 'pending')
    .order('submitted_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data as ContentSubmission) ?? null;
}

/**
 * 读取一条已发布内容，用来预填「申请修改」的表单。
 *
 * 必须读正式表而不是当初那条投稿记录：内容发布后管理员可能在后台改过，
 * 拿旧的投稿去填，用户一提交就会把管理员的修改覆盖掉。
 *
 * 项目的正文有付费墙，只能走 get_project_content()，
 * 而且它按会员等级判断——作者自己等级不够时也读不到。
 * 这种情况返回 null，调用方要拦住提交，不能让用户在空表单上提交，
 * 那等于把已发布的内容清空。
 */
export async function fetchPublishedForEdit(
  kind: SubmissionKind,
  id: string,
): Promise<Record<string, string> | null> {
  const str = (v: unknown) => (typeof v === 'string' ? v : '');

  if (kind === 'case') {
    const { data, error } = await supabase
      .from('cases')
      .select('title,title_en,summary,summary_en,cover_url,video_url,category_id,content,content_en,author,author_en')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    const r = data as Record<string, unknown>;
    return Object.fromEntries(Object.keys(r).map((k) => [k, str(r[k])]));
  }

  if (kind === 'project') {
    const { data: base, error } = await supabase
      .from('projects')
      .select('title,title_en,summary,summary_en,cover_url,video_url,scene,scene_en,maturity,maturity_en,external_url,access_level')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    if (!base) return null;
    // 正文单独取：列级权限把 content 挡在付费墙后面
    const { data: body } = await supabase.rpc('get_project_content', { p_project_id: id });
    const b = (body ?? {}) as { allowed?: boolean; content?: string; content_en?: string };
    if (!b.allowed) return null;
    const r = base as Record<string, unknown>;
    return {
      ...Object.fromEntries(Object.keys(r).map((k) => [k, str(r[k])])),
      content: str(b.content),
      content_en: str(b.content_en),
    };
  }

  // 帖子表的正文字段叫 body 不叫 content，images 是数组不是字符串，
  // 都要按投稿 payload 的键名对齐，否则预填出来是空的
  const { data, error } = await supabase
    .from('discussion_posts')
    .select('title,body,cover_url,images')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const r = data as Record<string, unknown>;
  return {
    title: str(r.title),
    body: str(r.body),
    cover_url: str(r.cover_url),
    images: Array.isArray(r.images) ? JSON.stringify(r.images) : '[]',
  };
}

/**
 * 作者删除自己发布的内容（案例 / 项目 / 帖子）。
 *
 * 走数据库函数而不是直接 delete：删正文之外还要清掉投稿记录和点赞收藏。
 * 投稿记录不清，「我的投稿」里会留下指向空目标的条目；
 * 点赞收藏表是 target_type + target_id 的弱关联、没有外键，不清就是孤儿行。
 * 这几步放在同一个事务里，不会出现删一半的状态。
 */
export async function deleteMyPublishedContent(
  kind: SubmissionKind,
  targetId: string,
): Promise<void> {
  const { error } = await supabase.rpc('delete_my_published_content', {
    p_kind: kind,
    p_id: targetId,
  });
  if (error) throw error;
}
