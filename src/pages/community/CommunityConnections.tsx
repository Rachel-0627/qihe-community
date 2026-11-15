import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useI18n } from '@/contexts/I18nContext';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  blockConnectionMember, connectionRequestAction, fetchCommunityNotifications, fetchConnectionContacts,
  fetchConnectionCandidates, fetchConnectionProfile, fetchConnectionRequests, fetchSharedContact,
  markCommunityNotificationRead, reportCommunityItem, saveConnectionContacts, saveConnectionFeedback,
  saveConnectionProfile,
} from '@/lib/communityConnectionsApi';
import type { ConnectionCandidate, ConnectionProfile, ConnectionRequest } from '@/lib/communityConnectionsApi';

const TAG_OPTIONS = ['AI Agent智能体', 'AI编程', 'AI工作流', 'AI知识库', 'AI产品设计', 'AI内容创作', 'AI营销', 'AI教育', '企业AI应用', '跨境电商', '自媒体运营', 'OPC一人公司', 'SaaS软件服务', '独立开发', '创业与投资', '自动化办公', '设计与视觉创意', '其他'];
const MATCH_TYPES = ['全部推荐', '兴趣同频', '能力互补', '供需匹配', '同城匹配'];
const PURPOSES = ['学习交流', '寻找同频伙伴', '寻找项目合作伙伴', '寻找创业合伙人', '商业合作', '资源互换', '寻找客户', '寻找服务商', '同城线下交流'];
const newProfile = (userId: string): ConnectionProfile => ({ user_id: userId, city: '', role_title: '', industry: '', introduction: '', homepage_url: '', ai_level: '', interests: [], skills: [], resources: [], experience: '', current_project: '', exploring: '', current_needs: [], seeking: [], purposes: [], communication: '线上交流', discoverable: false, accept_requests: true, show_city: false, show_capabilities: true, show_needs: false, open_to_local: false });
const parseTags = (value: string) => [...new Set(value.split(/[,，、\n]/).map((item) => item.trim()).filter(Boolean))].slice(0, 30);
const joinTags = (value: string[]) => value.join('、');

function TextField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="flex flex-col gap-1.5 text-sm"><span className="font-medium">{label}</span><Input value={value} onChange={(e) => onChange(e.target.value)} maxLength={300} /></label>;
}
function TagField({ label, value, onChange }: { label: string; value: string[]; onChange: (value: string[]) => void }) {
  return <label className="flex flex-col gap-1.5 text-sm"><span className="font-medium">{label}</span><Input value={joinTags(value)} onChange={(e) => onChange(parseTags(e.target.value))} placeholder="用顿号或逗号分隔" maxLength={600} /><span className="text-xs text-muted-foreground">{label === '兴趣方向' ? `可选方向：${TAG_OPTIONS.join('、')}` : '自定义标签，用顿号或逗号分隔'}</span></label>;
}

export default function CommunityConnections() {
  const { user, profile: accountProfile } = useAuth();
  const { t } = useI18n();
  const [profile, setProfile] = useState<ConnectionProfile | null>(null);
  const [candidates, setCandidates] = useState<ConnectionCandidate[]>([]);
  const [requests, setRequests] = useState<ConnectionRequest[]>([]);
  const [notifications, setNotifications] = useState<Record<string, unknown>[]>([]);
  const [filter, setFilter] = useState('全部推荐');
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [requestTarget, setRequestTarget] = useState<ConnectionCandidate | null>(null);
  const [requestPurpose, setRequestPurpose] = useState(PURPOSES[0]);
  const [requestMessage, setRequestMessage] = useState('');
  const [contacts, setContacts] = useState({ wechat: '', email: '', other_contact: '', share_with_connections: false });
  const [sharedContacts, setSharedContacts] = useState<Record<string, { wechat: string; email: string; other_contact: string } | null>>({});

  const refresh = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [myProfile, myRequests, myNotifications, myContacts] = await Promise.all([fetchConnectionProfile(user.id), fetchConnectionRequests(user.id), fetchCommunityNotifications(user.id), fetchConnectionContacts(user.id)]);
      const activeProfile = myProfile ?? { ...newProfile(user.id), introduction: accountProfile?.bio ?? '' };
      setProfile(activeProfile);
      setRequests(myRequests);
      setNotifications(myNotifications as Record<string, unknown>[]);
      if (myContacts) setContacts(myContacts);
      if (!myProfile) setEditing(true);
      if (myProfile?.discoverable) setCandidates(await fetchConnectionCandidates(filter));
      else setCandidates([]);
    } catch {
      toast.error(t('成员连接服务尚未就绪或暂时不可用，请稍后重试。', 'Member connections are unavailable right now. Please retry later.'));
    } finally { setLoading(false); }
  }, [user, accountProfile, filter, t]);
  useEffect(() => { void refresh(); }, [refresh]);

  const update = <K extends keyof ConnectionProfile>(key: K, value: ConnectionProfile[K]) => setProfile((p) => p ? { ...p, [key]: value } : p);
  const saveProfile = async () => {
    if (!profile) return;
    try { await saveConnectionProfile(profile); toast.success(t('连接档案已保存', 'Connection profile saved')); setEditing(false); await refresh(); }
    catch { toast.error(t('档案保存失败，请管理员先部署数据库迁移', 'Could not save profile. Ask the administrator to apply the database migration.')); }
  };
  const sendRequest = async () => {
    if (!requestTarget || !requestMessage.trim()) { toast.info(t('请写一段申请留言', 'Please add a short message')); return; }
    try { await connectionRequestAction('send', { target: requestTarget.user_id, purpose: requestPurpose, message: requestMessage }); toast.success(t('连接申请已发送', 'Connection request sent')); setRequestTarget(null); setRequestMessage(''); await refresh(); }
    catch { toast.error(t('申请暂时未能发送，请稍后再试', 'Could not send request. Please retry.')); }
  };
  const handleRequest = async (action: string, requestId: string) => {
    try { await connectionRequestAction(action, { request: requestId }); await refresh(); }
    catch { toast.error(t('操作失败，申请状态可能已变化', 'Action failed; the request may have changed')); }
  };
  const saveContacts = async () => {
    if (!user) return;
    try { await saveConnectionContacts(user.id, contacts); toast.success(t('联系方式设置已保存', 'Contact sharing settings saved')); }
    catch { toast.error(t('设置未能保存', 'Could not save contact settings')); }
  };
  const field = (label: string, value: string, key: keyof ConnectionProfile) => <TextField label={t(label, label)} value={value} onChange={(v) => update(key, v as never)} />;
  const multi = (label: string, value: string[], key: keyof ConnectionProfile) => <TagField label={t(label, label)} value={value} onChange={(v) => update(key, v as never)} />;
  const toggle = (label: string, key: keyof ConnectionProfile) => <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={Boolean(profile?.[key])} onChange={(e) => update(key, e.target.checked as never)} className="accent-primary" />{t(label, label)}</label>;

  if (!user) return <div className="py-16 text-center"><p className="text-muted-foreground">{t('登录后创建连接档案并查看成员推荐。', 'Sign in to create a profile and view member recommendations.')}</p><Button asChild className="mt-4"><a href="/login">{t('登录', 'Sign in')}</a></Button></div>;
  if (!profile) return <div role="status" className="py-12 text-center text-sm text-muted-foreground">{loading ? t('正在读取连接档案…', 'Loading your profile…') : t('暂时无法读取连接档案。', 'Could not load your connection profile.')}</div>;

  const pendingIncoming = requests.filter((r) => r.recipient_id === user.id && r.status === 'pending');
  const pendingOutgoing = requests.filter((r) => r.sender_id === user.id && r.status === 'pending');
  const connected = requests.filter((r) => r.status === 'accepted');
  const relationName = (id: string) => id === user.id ? t('我', 'Me') : id.slice(0, 8);

  return <div className="grid gap-8 py-6 lg:grid-cols-[minmax(0,1fr)_280px]">
    <main className="min-w-0">
      <section className="border-b border-border pb-6"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-display text-2xl">{t('成员匹配', 'Member matching')}</h2><p className="mt-1 text-sm text-muted-foreground">{t('以真实填写的信息寻找兴趣同频、能力互补与合作机会。', 'Find shared interests, complementary skills and collaboration opportunities.')}</p></div><Button variant="outline" size="sm" onClick={() => setEditing((v) => !v)}>{editing ? t('收起档案', 'Close profile') : t('编辑连接档案', 'Edit profile')}</Button></div></section>

      {editing && <section className="mt-6 rounded-md border border-border bg-card p-4 md:p-6"><h3 className="font-display text-xl">{t('我的连接档案', 'My connection profile')}</h3><p className="mt-1 text-xs text-muted-foreground">{t('沿用账号昵称和头像。只有开启成员匹配后，档案才用于推荐；联系方式始终单独授权。', 'Your account name and avatar are reused. Recommendations are off until you opt in. Contacts require separate consent.')}</p>
        <div className="mt-5 grid gap-4 md:grid-cols-2">{field('所在城市', profile.city, 'city')}{field('职业或身份', profile.role_title, 'role_title')}{field('所属行业', profile.industry, 'industry')}{field('个人主页或作品链接', profile.homepage_url, 'homepage_url')}
          <label className="flex flex-col gap-1.5 text-sm"><span className="font-medium">{t('AI实践水平', 'AI experience')}</span><select value={profile.ai_level} onChange={(e) => update('ai_level', e.target.value)} className="h-10 rounded-md border border-input bg-background px-3"><option value="">{t('请选择（选填）', 'Choose (optional)')}</option>{['AI入门者','AI日常使用者','AI应用实践者','AI产品开发者','AI创业者'].map((x) => <option key={x}>{x}</option>)}</select></label>
          <label className="flex flex-col gap-1.5 text-sm md:col-span-2"><span className="font-medium">{t('个人介绍', 'Introduction')}</span><Textarea value={profile.introduction} maxLength={600} rows={3} onChange={(e) => update('introduction', e.target.value)} /></label>
          {multi('兴趣方向', profile.interests, 'interests')}{multi('专业技能', profile.skills, 'skills')}{multi('能够提供的资源', profile.resources, 'resources')}{multi('正在寻找的能力或资源', profile.current_needs, 'current_needs')}{multi('希望认识的人', profile.seeking, 'seeking')}{multi('连接目的', profile.purposes, 'purposes')}
          {field('当前项目或正在做什么', profile.current_project, 'current_project')}{field('正在探索的方向', profile.exploring, 'exploring')}
          <label className="flex flex-col gap-1.5 text-sm md:col-span-2"><span className="font-medium">{t('相关实践经验', 'Relevant experience')}</span><Textarea value={profile.experience} maxLength={2000} rows={3} onChange={(e) => update('experience', e.target.value)} /></label>
          <label className="flex flex-col gap-1.5 text-sm"><span className="font-medium">{t('交流方式', 'Preferred communication')}</span><select value={profile.communication} onChange={(e) => update('communication', e.target.value)} className="h-10 rounded-md border border-input bg-background px-3">{['线上交流','线下交流','线上与线下均可'].map((x) => <option key={x}>{x}</option>)}</select></label>
        </div>
        <div className="mt-5 grid gap-3 border-t border-border pt-4 sm:grid-cols-2">{toggle('允许成员匹配（默认关闭）', 'discoverable')}{toggle('接收连接申请', 'accept_requests')}{toggle('公开所在城市', 'show_city')}{toggle('公开能力与资源', 'show_capabilities')}{toggle('公开当前需求', 'show_needs')}{toggle('愿意参与同城交流', 'open_to_local')}</div>
        <Button onClick={() => void saveProfile()} className="mt-5">{t('保存档案', 'Save profile')}</Button>
      </section>}

      {!editing && !profile.discoverable && <section className="mt-6 border border-border bg-card/60 p-6"><h3 className="font-display text-xl">{t('先完善你的连接档案', 'Set up your connection profile')}</h3><p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">{t('填写关注方向、能力和当前需求，并主动开启成员匹配。开启前，你不会出现在其他人的推荐中。', 'Share your interests, skills and needs, then opt in. Your profile stays out of recommendations until enabled.')}</p><Button onClick={() => setEditing(true)} className="mt-4">{t('创建连接档案', 'Create profile')}</Button></section>}

      {profile.discoverable && <section className="mt-6"><div className="flex flex-wrap items-center justify-between gap-3"><h3 className="font-display text-xl">{t('为你推荐', 'Recommended for you')}</h3><div className="flex flex-wrap gap-1.5">{MATCH_TYPES.map((kind) => <button key={kind} type="button" aria-pressed={filter === kind} onClick={() => setFilter(kind)} className={`rounded-full px-3 py-1.5 text-xs ${filter === kind ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>{t(kind, kind)}</button>)}</div></div>
        <p className="mt-2 text-xs text-muted-foreground">{t('推荐依据双方同意公开的信息、共同兴趣及供需关系生成，不展示虚构匹配分数。', 'Recommendations use opted-in profile details and real overlap. No fabricated match scores are shown.')}</p>
        {loading ? <p className="py-10 text-center text-sm text-muted-foreground">{t('正在寻找合适的成员…', 'Finding potential connections…')}</p> : candidates.length === 0 ? <div className="py-12 text-center"><p className="text-sm text-muted-foreground">{t('目前还没有符合条件的成员。资料完善后可再刷新看看。', 'No suitable members are available yet. Update your profile and check again later.')}</p><Button variant="outline" size="sm" className="mt-4" onClick={() => void refresh()}>{t('刷新推荐', 'Refresh')}</Button></div> : <div className="mt-3 divide-y divide-border">{candidates.map((candidate) => <article key={candidate.user_id} className="py-5"><div className="flex gap-3"><Avatar className="h-11 w-11"><AvatarImage src={candidate.avatar_url ?? undefined} /><AvatarFallback>{candidate.nickname.slice(0, 1)}</AvatarFallback></Avatar><div className="min-w-0 flex-1"><h4 className="font-medium">{candidate.nickname}</h4><p className="text-xs text-muted-foreground">{[candidate.role_title, candidate.industry, candidate.city].filter(Boolean).join(' · ') || t('社区成员', 'Community member')}</p><p className="mt-2 text-sm text-muted-foreground">{candidate.introduction}</p><div className="mt-2 flex flex-wrap gap-1.5"><span className="rounded bg-accent/10 px-2 py-1 text-xs text-accent">{t(candidate.match_type, candidate.match_type)}</span>{candidate.interests.map((tag) => <span key={tag} className="rounded bg-muted px-2 py-1 text-xs text-muted-foreground">{tag}</span>)}</div>
          {candidate.reasons.length > 0 && <p className="mt-3 text-sm">{t('推荐理由：', 'Why this match: ')}{candidate.reasons.join('；')}</p>}{candidate.skills.length > 0 && <p className="mt-2 text-xs text-muted-foreground">{t('能力：', 'Skills: ')}{candidate.skills.join('、')}</p>}{candidate.resources.length > 0 && <p className="mt-1 text-xs text-muted-foreground">{t('可提供：', 'Can offer: ')}{candidate.resources.join('、')}</p>}{candidate.needs.length > 0 && <p className="mt-1 text-xs text-muted-foreground">{t('正在寻找：', 'Looking for: ')}{candidate.needs.join('、')}</p>}
          <div className="mt-3 flex flex-wrap gap-2"><Button size="sm" onClick={() => { setRequestTarget(candidate); setRequestPurpose(PURPOSES[0]); }}>{t('建立连接', 'Connect')}</Button><Button size="sm" variant="ghost" onClick={async () => { try { await saveConnectionFeedback(user.id, candidate.user_id, 'hidden'); toast.success(t('已减少此类推荐', 'Recommendations updated')); await refresh(); } catch { toast.error(t('操作失败', 'Action failed')); } }}>{t('不感兴趣', 'Not interested')}</Button><Button size="sm" variant="ghost" onClick={async () => { const reason = window.prompt(t('请说明举报原因', 'Why are you reporting this member?')); if (reason?.trim()) try { await reportCommunityItem(user.id, 'member', candidate.user_id, reason); toast.success(t('已提交举报', 'Report submitted')); } catch { toast.error(t('举报失败', 'Report failed')); } }}>{t('举报', 'Report')}</Button></div>
        </div></div></article>)}</div>}
      </section>}

      <section className="mt-10 border-t border-border pt-6"><h3 className="font-display text-xl">{t('我的连接', 'My connections')}</h3><div className="mt-4 grid gap-6 md:grid-cols-2">
        <div><h4 className="text-sm font-medium">{t('收到的申请', 'Incoming')}</h4>{pendingIncoming.length ? pendingIncoming.map((r) => <div key={r.id} className="mt-3 border-b border-border pb-3 text-sm"><p>{t('成员', 'Member')} {r.sender_id.slice(0, 8)} · {r.purpose}</p><p className="mt-1 text-muted-foreground">{r.message}</p><div className="mt-2 flex gap-2"><Button size="sm" onClick={() => void handleRequest('accept', r.id)}>{t('接受', 'Accept')}</Button><Button size="sm" variant="outline" onClick={() => void handleRequest('reject', r.id)}>{t('拒绝', 'Decline')}</Button><Button size="sm" variant="ghost" onClick={async () => { try { await blockConnectionMember(user.id, r.sender_id); await handleRequest('reject', r.id); } catch { toast.error(t('屏蔽失败', 'Could not block member')); } }}>{t('屏蔽', 'Block')}</Button></div></div>) : <p className="mt-2 text-xs text-muted-foreground">{t('暂无待处理申请', 'No pending requests')}</p>}</div>
        <div><h4 className="text-sm font-medium">{t('发出的申请', 'Sent')}</h4>{pendingOutgoing.length ? pendingOutgoing.map((r) => <div key={r.id} className="mt-3 border-b border-border pb-3 text-sm">{r.recipient_id.slice(0, 8)} · {r.purpose}<Button size="sm" variant="ghost" className="ml-2" onClick={() => void handleRequest('withdraw', r.id)}>{t('撤回', 'Withdraw')}</Button></div>) : <p className="mt-2 text-xs text-muted-foreground">{t('暂无待处理申请', 'No pending requests')}</p>}</div>
      </div><div className="mt-6"><h4 className="text-sm font-medium">{t('已建立的连接', 'Connected members')}</h4>{connected.length ? <div className="mt-2 space-y-2">{connected.map((r) => { const other = r.sender_id === user.id ? r.recipient_id : r.sender_id; return <div key={r.id} className="rounded border border-border p-3 text-sm"><div className="flex flex-wrap items-center gap-2"><span>{other.slice(0, 8)}</span><Button size="sm" variant="outline" onClick={async () => { try { const data = await fetchSharedContact(other); setSharedContacts((items) => ({ ...items, [other]: data })); if (!data) toast.info(t('对方尚未授权共享联系方式', 'This member has not shared contact details')); } catch { toast.error(t('暂时无法读取联系方式', 'Could not access contact details')); } }}>{t('查看已授权联系方式', 'View shared contacts')}</Button><Button size="sm" variant="ghost" onClick={() => void handleRequest('end', r.id)}>{t('解除', 'Disconnect')}</Button></div>{sharedContacts[other] && <p className="mt-2 text-xs text-muted-foreground">{Object.entries(sharedContacts[other]).filter(([, value]) => value).map(([key, value]) => `${key}: ${value}`).join(' · ')}</p>}</div>; })}</div> : <p className="mt-2 text-xs text-muted-foreground">{t('建立连接后会显示在这里', 'Accepted connections will appear here')}</p>}</div></section>
    </main>

    <aside className="space-y-6"><section className="border-l border-border pl-4"><h3 className="font-display text-lg">{t('联系方式授权', 'Contact sharing')}</h3><p className="mt-2 text-xs leading-relaxed text-muted-foreground">{t('联系方式默认仅自己可见。已建立连接的成员只有在你主动授权时才能查看。撤回授权后平台不再展示。', 'Contacts are private by default. Connected members can view them only with consent. Revoke access at any time.')}</p><div className="mt-3 space-y-2"><Input placeholder={t('微信号（选填）', 'WeChat (optional)')} value={contacts.wechat} onChange={(e) => setContacts({ ...contacts, wechat: e.target.value })} /><Input placeholder={t('邮箱（选填）', 'Email (optional)')} value={contacts.email} onChange={(e) => setContacts({ ...contacts, email: e.target.value })} /><Input placeholder={t('其他联系方式（选填）', 'Other contact (optional)')} value={contacts.other_contact} onChange={(e) => setContacts({ ...contacts, other_contact: e.target.value })} /><label className="flex items-start gap-2 text-xs"><input type="checkbox" checked={contacts.share_with_connections} onChange={(e) => setContacts({ ...contacts, share_with_connections: e.target.checked })} className="mt-0.5 accent-primary" />{t('允许已建立连接的成员查看上述联系方式', 'Let connected members view these contacts')}</label><Button variant="outline" size="sm" onClick={() => void saveContacts()}>{t('保存授权设置', 'Save consent')}</Button></div></section>
      <section className="border-l border-border pl-4"><h3 className="font-display text-lg">{t('站内通知', 'Notifications')}</h3>{notifications.length ? <div className="mt-2 space-y-2">{notifications.slice(0, 8).map((n) => <button key={String(n.id)} type="button" onClick={async () => { try { await markCommunityNotificationRead(String(n.id)); await refresh(); } catch { /* migration may be pending */ } }} className={`block w-full border-b border-border py-2 text-left text-xs ${n.read_at ? 'text-muted-foreground' : 'text-foreground'}`}>{String(n.kind)} · {new Date(String(n.created_at)).toLocaleDateString()}</button>)}</div> : <p className="mt-2 text-xs text-muted-foreground">{t('暂无通知', 'No notifications')}</p>}</section>
    </aside>

    {requestTarget && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-labelledby="connect-dialog-title"><div className="w-full max-w-lg rounded-md border border-border bg-background p-5 shadow-xl"><h3 id="connect-dialog-title" className="font-display text-xl">{t('向', 'Connect with')} {requestTarget.nickname}</h3><label className="mt-4 flex flex-col gap-1.5 text-sm"><span>{t('连接目的', 'Purpose')}</span><select value={requestPurpose} onChange={(e) => setRequestPurpose(e.target.value)} className="h-10 rounded-md border border-input bg-background px-3">{PURPOSES.map((p) => <option key={p}>{p}</option>)}</select></label><label className="mt-4 flex flex-col gap-1.5 text-sm"><span>{t('申请留言', 'Message')}</span><Textarea rows={4} maxLength={500} value={requestMessage} onChange={(e) => setRequestMessage(e.target.value)} placeholder={t('简单介绍自己，以及希望如何交流或合作。', 'Introduce yourself and share what you hope to discuss or build.')} /></label><div className="mt-4 flex justify-end gap-2"><Button variant="ghost" onClick={() => setRequestTarget(null)}>{t('取消', 'Cancel')}</Button><Button onClick={() => void sendRequest()}>{t('发送申请', 'Send request')}</Button></div></div></div>}
  </div>;
}
