import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { Clock, CheckCircle2, XCircle, Trash2, Pencil } from 'lucide-react';
import { useI18n } from '@/contexts/I18nContext';
import { Button } from '@/components/ui/button';
import { deleteSubmission, fetchMySubmissions } from '@/lib/submissionsApi';
import type { ContentSubmission, SubmissionStatus } from '@/types/types';

const STATUS_META: Record<SubmissionStatus, { zh: string; en: string; cls: string; Icon: typeof Clock }> = {
  pending:  { zh: '审核中', en: 'In review', cls: 'text-amber-400 border-amber-400/40 bg-amber-400/10', Icon: Clock },
  approved: { zh: '已通过', en: 'Approved',  cls: 'text-emerald-400 border-emerald-400/40 bg-emerald-400/10', Icon: CheckCircle2 },
  rejected: { zh: '未通过', en: 'Rejected',  cls: 'text-rose-400 border-rose-400/40 bg-rose-400/10', Icon: XCircle },
};

/** 个人中心的「我的投稿」。状态、驳回理由、改了重投、撤回都在这里。 */
export default function MySubmissions() {
  const { t, lang } = useI18n();
  const [items, setItems] = useState<ContentSubmission[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    fetchMySubmissions()
      .then(setItems)
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(load, [load]);

  const handleWithdraw = useCallback(async (id: string) => {
    if (!window.confirm(t('确定撤回这条投稿？撤回后无法恢复。', 'Withdraw this submission? This cannot be undone.'))) return;
    try {
      await deleteSubmission(id);
      toast.success(t('已撤回', 'Withdrawn'));
      load();
    } catch {
      toast.error(t('撤回失败，请重试', 'Failed to withdraw'));
    }
  }, [t, load]);

  if (loading) {
    return <p className="text-sm text-muted-foreground">{t('载入中…', 'Loading…')}</p>;
  }

  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border p-6 text-center">
        <p className="text-sm text-muted-foreground">
          {t('还没有投稿。', 'No submissions yet.')}
        </p>
        <Button asChild variant="secondary" size="sm" className="mt-3">
          <Link to="/submit/case">{t('去发布', 'Publish something')}</Link>
        </Button>
      </div>
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {items.map((s) => {
        const meta = STATUS_META[s.status];
        const title = s.payload?.title || t('（无标题）', '(untitled)');
        const kindLabel = s.kind === 'case' ? t('案例', 'Case') : t('项目', 'Project');
        return (
          <li key={s.id} className="rounded-lg border border-border bg-card/50 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-medium text-foreground">{title}</p>
                <p className="mt-1 font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                  {kindLabel}
                  {s.target_id && ` · ${t('修改申请', 'Edit request')}`}
                  {' · '}
                  {new Date(s.submitted_at).toLocaleDateString(lang === 'en' ? 'en-US' : 'zh-CN')}
                </p>
              </div>
              <span className={`flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-xs ${meta.cls}`}>
                <meta.Icon className="h-3 w-3" />
                {t(meta.zh, meta.en)}
              </span>
            </div>

            {/* 驳回理由要显眼，否则用户不知道该改什么 */}
            {s.status === 'rejected' && s.review_note && (
              <p className="mt-3 rounded border-l-2 border-rose-400/60 bg-rose-400/5 px-3 py-2 text-sm text-muted-foreground">
                <span className="text-rose-400">{t('未通过原因：', 'Reason: ')}</span>
                {s.review_note}
              </p>
            )}

            {(s.status === 'rejected' || s.status === 'pending') && (
              <div className="mt-3 flex items-center gap-2">
                {s.status === 'rejected' && (
                  <Button asChild size="sm" variant="secondary">
                    <Link to={`/submit/case?resubmit=${s.id}`}>
                      <Pencil className="mr-1.5 h-3.5 w-3.5" />
                      {t('修改后重新提交', 'Edit and resubmit')}
                    </Link>
                  </Button>
                )}
                <Button size="sm" variant="ghost" onClick={() => handleWithdraw(s.id)}>
                  <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                  {t('撤回', 'Withdraw')}
                </Button>
              </div>
            )}

            {s.status === 'approved' && s.target_id && (
              <Button asChild size="sm" variant="ghost" className="mt-3 px-0">
                <Link to={`/${s.kind === 'case' ? 'cases' : 'projects'}/${s.target_id}`}>
                  {t('查看已发布内容 →', 'View published →')}
                </Link>
              </Button>
            )}
          </li>
        );
      })}
    </ul>
  );
}
