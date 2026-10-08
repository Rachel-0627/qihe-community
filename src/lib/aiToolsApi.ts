// 工具栏目收录的站外 AI 工具。
//
// 社区只做收录与跳转，不托管也不代理这些工具。
// 普通访客只能读到已上架的条目，增删改由 RLS 限定为管理员。

import { supabase } from '@/db/supabase';
import type { AiTool } from '@/types/types';

const asArray = <T,>(data: unknown): T[] => (Array.isArray(data) ? (data as T[]) : []);

/** 前台用：只取已上架的 */
export async function fetchAiTools(): Promise<AiTool[]> {
  const { data, error } = await supabase
    .from('ai_tools')
    .select('*')
    .eq('is_visible', true)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })
    .limit(100);
  if (error) throw error;
  return asArray<AiTool>(data);
}

/** 后台用：含已下架的 */
export async function fetchAllAiTools(): Promise<AiTool[]> {
  const { data, error } = await supabase
    .from('ai_tools')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })
    .limit(200);
  if (error) throw error;
  return asArray<AiTool>(data);
}

export async function saveAiTool(item: Partial<AiTool>): Promise<void> {
  const payload = { ...item, updated_at: new Date().toISOString() };
  if (payload.id) {
    const { error } = await supabase.from('ai_tools').update(payload).eq('id', payload.id);
    if (error) throw error;
  } else {
    const { id: _omit, ...rest } = payload;
    const { error } = await supabase.from('ai_tools').insert(rest);
    if (error) throw error;
  }
}

export async function deleteAiTool(id: string): Promise<void> {
  const { error } = await supabase.from('ai_tools').delete().eq('id', id);
  if (error) throw error;
}
