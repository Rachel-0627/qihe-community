import { supabase } from '@/db/supabase';

export const DISCUSSION_CATEGORIES = ['全部', '实践分享', '问题求助', '观点讨论', '合作需求', '随想交流'] as const;
export type DiscussionCategory = (typeof DISCUSSION_CATEGORIES)[number];

export interface ConnectionProfile {
  user_id: string;
  city: string;
  role_title: string;
  industry: string;
  introduction: string;
  homepage_url: string;
  ai_level: string;
  interests: string[];
  skills: string[];
  resources: string[];
  experience: string;
  current_project: string;
  exploring: string;
  current_needs: string[];
  seeking: string[];
  purposes: string[];
  communication: string;
  discoverable: boolean;
  accept_requests: boolean;
  show_city: boolean;
  show_capabilities: boolean;
  show_needs: boolean;
  open_to_local: boolean;
}

export interface ConnectionCandidate {
  user_id: string;
  nickname: string;
  avatar_url: string | null;
  role_title: string;
  industry: string;
  introduction: string;
  city: string;
  interests: string[];
  skills: string[];
  resources: string[];
  needs: string[];
  match_type: string;
  reasons: string[];
}

export interface ConnectionRequest {
  id: string;
  sender_id: string;
  recipient_id: string;
  purpose: string;
  message: string;
  status: string;
  created_at: string;
}

export async function fetchConnectionProfile(userId: string): Promise<ConnectionProfile | null> {
  const { data, error } = await supabase.from('connection_profiles').select('*').eq('user_id', userId).maybeSingle();
  if (error) throw error;
  return data as ConnectionProfile | null;
}

export async function saveConnectionProfile(profile: ConnectionProfile): Promise<void> {
  const { error } = await supabase.from('connection_profiles').upsert(profile, { onConflict: 'user_id' });
  if (error) throw error;
}

export async function fetchConnectionCandidates(type = '全部推荐'): Promise<ConnectionCandidate[]> {
  const { data, error } = await supabase.rpc('connection_candidates', { p_match_type: type, p_limit: 20, p_offset: 0 });
  if (error) throw error;
  return (Array.isArray(data) ? data : []) as ConnectionCandidate[];
}

export async function fetchConnectionRequests(userId: string): Promise<ConnectionRequest[]> {
  const { data, error } = await supabase.from('connection_requests').select('*')
    .or(`sender_id.eq.${userId},recipient_id.eq.${userId}`).order('created_at', { ascending: false }).limit(100);
  if (error) throw error;
  return (Array.isArray(data) ? data : []) as ConnectionRequest[];
}

export async function connectionRequestAction(action: string, values: { target?: string; request?: string; purpose?: string; message?: string } = {}): Promise<void> {
  const { error } = await supabase.rpc('connection_request_action', {
    p_action: action,
    p_target: values.target ?? null,
    p_request: values.request ?? null,
    p_purpose: values.purpose ?? '',
    p_message: values.message ?? '',
  });
  if (error) throw error;
}

export async function blockConnectionMember(userId: string, targetId: string): Promise<void> {
  const { error } = await supabase.from('connection_blocks').upsert({ blocker_id: userId, blocked_id: targetId }, { onConflict: 'blocker_id,blocked_id' });
  if (error) throw error;
}

export async function saveConnectionFeedback(userId: string, candidateId: string, feedback: 'hidden' | 'interested'): Promise<void> {
  const { error } = await supabase.from('connection_match_feedback').upsert({ user_id: userId, candidate_id: candidateId, feedback }, { onConflict: 'user_id,candidate_id' });
  if (error) throw error;
}

export async function fetchCommunityNotifications(userId: string) {
  const { data, error } = await supabase.from('community_notifications').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(50);
  if (error) throw error;
  return Array.isArray(data) ? data : [];
}

export async function markCommunityNotificationRead(id: string): Promise<void> {
  const { error } = await supabase.rpc('mark_community_notification_read', { p_id: id });
  if (error) throw error;
}

export async function saveConnectionContacts(userId: string, values: { wechat: string; email: string; other_contact: string; share_with_connections: boolean }): Promise<void> {
  const { error } = await supabase.from('connection_contacts').upsert({ user_id: userId, ...values }, { onConflict: 'user_id' });
  if (error) throw error;
}

export async function fetchConnectionContacts(userId: string) {
  const { data, error } = await supabase.from('connection_contacts').select('wechat,email,other_contact,share_with_connections').eq('user_id', userId).maybeSingle();
  if (error) throw error;
  return data as { wechat: string; email: string; other_contact: string; share_with_connections: boolean } | null;
}

export async function fetchSharedContact(userId: string) {
  const { data, error } = await supabase.rpc('connection_shared_contact', { p_user: userId });
  if (error) throw error;
  return data as { wechat: string; email: string; other_contact: string } | null;
}

export async function reportCommunityItem(userId: string, kind: 'discussion' | 'member' | 'connection', targetId: string, reason: string): Promise<void> {
  const { error } = await supabase.from('community_reports').insert({ reporter_id: userId, target_kind: kind, target_id: targetId, reason: reason.trim() });
  if (error) throw error;
}
