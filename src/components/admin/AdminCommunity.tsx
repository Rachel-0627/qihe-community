import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/db/supabase';
import { useI18n } from '@/contexts/I18nContext';
import { Button } from '@/components/ui/button';

type Report = { id: string; target_kind: string; target_id: string; reason: string; status: string; created_at: string };
type Metrics = { profiles: number; discoverable: number; requests: number; accepted: number; acceptance_rate: number; discussions: number; interactions: number };

export default function AdminCommunity() {
  const { t } = useI18n();
  const [reports, setReports] = useState<Report[]>([]);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    setLoading(true);
    const [reportResult, metricResult] = await Promise.all([
      supabase.from('community_reports').select('id,target_kind,target_id,reason,status,created_at').order('created_at', { ascending: false }).limit(100),
      supabase.rpc('community_admin_metrics'),
    ]);
    if (reportResult.error || metricResult.error) toast.error(t('社区管理数据暂时无法读取。请确认数据库迁移已部署。', 'Could not load community data. Check whether the database migration is applied.'));
    setReports((reportResult.data ?? []) as Report[]);
    setMetrics((metricResult.data ?? null) as Metrics | null);
    setLoading(false);
  }, [t]);
  useEffect(() => { void load(); }, [load]);

  const setReportStatus = async (id: string, status: 'handled' | 'dismissed') => {
    const { error } = await supabase.from('community_reports').update({ status }).eq('id', id);
    if (error) { toast.error(t('更新举报状态失败', 'Could not update report')); return; }
    await load();
  };
  const togglePostHidden = async (targetId: string, hidden: boolean) => {
    const { error } = await supabase.from('discussion_posts').update({ is_hidden: hidden }).eq('id', targetId);
    if (error) { toast.error(t('帖子状态更新失败', 'Could not update discussion')); return; }
    toast.success(t(hidden ? '帖子已隐藏' : '帖子已恢复展示', hidden ? 'Discussion hidden' : 'Discussion restored'));
  };
  const pauseMember = async (targetId: string) => {
    const { error } = await supabase.rpc('admin_set_member_matching', { p_user: targetId, p_enabled: false });
    if (error) { toast.error(t('成员匹配状态更新失败', 'Could not update member status')); return; }
    toast.success(t('已暂停该成员匹配', 'Member matching paused'));
  };

  if (loading) return <p className="py-10 text-center text-sm text-muted-foreground">{t('正在读取社区管理信息…', 'Loading community data…')}</p>;
  return <div className="space-y-8">
    <section><h2 className="font-display text-xl">{t('社区运营数据', 'Community overview')}</h2>{metrics ? <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">{[
      [t('连接档案', 'Profiles'), metrics.profiles], [t('开启匹配', 'Discoverable'), metrics.discoverable], [t('连接申请', 'Requests'), metrics.requests], [t('已接受', 'Accepted'), metrics.accepted], [t('接受率', 'Acceptance rate'), `${metrics.acceptance_rate}%`], [t('讨论帖子', 'Discussions'), metrics.discussions], [t('讨论互动', 'Interactions'), metrics.interactions],
    ].map(([label, value]) => <div key={String(label)} className="border border-border p-4"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 font-display text-2xl">{value}</p></div>)}</div> : <p className="mt-3 text-sm text-muted-foreground">{t('统计需要先部署社区连接数据库迁移。', 'Metrics appear after the community migration is applied.')}</p>}</section>
    <section><div className="flex items-center justify-between"><h2 className="font-display text-xl">{t('内容与成员举报', 'Reports')}</h2><Button variant="outline" size="sm" onClick={() => void load()}>{t('刷新', 'Refresh')}</Button></div>{reports.length === 0 ? <p className="mt-4 text-sm text-muted-foreground">{t('目前没有待处理举报。', 'There are no reports to review.')}</p> : <div className="mt-3 divide-y divide-border">{reports.map((report) => <article key={report.id} className="py-4"><div className="flex flex-wrap items-center gap-2"><span className="rounded bg-muted px-2 py-1 text-xs">{report.target_kind}</span><span className="font-mono-label text-xs text-muted-foreground">{report.target_id}</span><span className="text-xs text-muted-foreground">{report.status} · {new Date(report.created_at).toLocaleDateString()}</span></div><p className="mt-2 text-sm">{report.reason}</p><div className="mt-3 flex flex-wrap gap-2">{report.target_kind === 'discussion' && <><Button size="sm" variant="outline" onClick={() => void togglePostHidden(report.target_id, true)}>{t('隐藏帖子', 'Hide discussion')}</Button><Button size="sm" variant="ghost" onClick={() => void togglePostHidden(report.target_id, false)}>{t('恢复帖子', 'Restore discussion')}</Button></>}{report.target_kind === 'member' && <Button size="sm" variant="outline" onClick={() => void pauseMember(report.target_id)}>{t('暂停成员匹配', 'Pause matching')}</Button>}<Button size="sm" onClick={() => void setReportStatus(report.id, 'handled')}>{t('标记已处理', 'Mark handled')}</Button><Button size="sm" variant="ghost" onClick={() => void setReportStatus(report.id, 'dismissed')}>{t('忽略', 'Dismiss')}</Button></div></article>)}</div>}</section>
  </div>;
}
