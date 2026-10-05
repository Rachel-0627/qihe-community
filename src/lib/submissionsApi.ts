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

/** 撤回投稿。已通过的删不掉（策略限制），前台也不该给入口。 */
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
