// 分享讨论区：帖子与评论的读写。
//
// 帖子本身用户没有写权限 —— 发帖走 content_submissions 投稿审核，
// 管理员通过后由 review_submission() 落进 discussion_posts（见迁移 00043）。
// 这里只负责读帖子，以及评论的增删。
//
// 评论不审核，但作者和管理员都能删（软删，留痕）。

import { supabase } from '@/db/supabase';
import type { DiscussionPost, PostComment } from '@/types/types';

const asArray = <T,>(data: unknown): T[] => (Array.isArray(data) ? (data as T[]) : []);

/** 评论数用联表 count 现算，不存计数列——计数列迟早会和真实值对不上 */
const POST_COLUMNS = '*, post_comments(count)';

export async function fetchDiscussionPosts(): Promise<DiscussionPost[]> {
  const { data, error } = await supabase
    .from('discussion_posts')
    .select(POST_COLUMNS)
    .order('is_pinned', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) throw error;
  return asArray<DiscussionPost>(data);
}

export async function fetchDiscussionPostById(id: string): Promise<DiscussionPost | null> {
  const { data, error } = await supabase
    .from('discussion_posts')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return (data as DiscussionPost) ?? null;
}

/** 评论按时间正序：讨论要从头读，倒序读起来是乱的 */
export async function fetchPostComments(postId: string): Promise<PostComment[]> {
  const { data, error } = await supabase
    .from('post_comments')
    .select('*')
    .eq('post_id', postId)
    .order('created_at', { ascending: true })
    .limit(300);
  if (error) throw error;
  return asArray<PostComment>(data);
}

export async function addPostComment(postId: string, body: string): Promise<PostComment> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('请先登录后再评论');

  // author_name 不在这里传：数据库触发器会按 author_id 查真实昵称填进去，
  // 否则前端可以随便署别人的名字
  const { data, error } = await supabase
    .from('post_comments')
    .insert({ post_id: postId, author_id: user.id, body: body.trim() })
    .select()
    .single();
  if (error) throw error;
  return data as PostComment;
}

/** 软删。RLS 限定只有作者本人或管理员能改这一行 */
export async function deletePostComment(id: string): Promise<void> {
  const { error } = await supabase
    .from('post_comments')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

/** 列表里的评论数：联表 count 的形状是 [{ count: n }] */
export function commentCountOf(post: DiscussionPost): number {
  return post.post_comments?.[0]?.count ?? 0;
}
