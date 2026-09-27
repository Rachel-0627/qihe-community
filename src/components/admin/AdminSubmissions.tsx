import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Check, X, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { fetchSubmissionsForReview, reviewSubmission } from '@/lib/submissionsApi';
import type { ContentSubmission, SubmissionStatus } from '@/types/types';

const TABS: { key: SubmissionStatus; label: string }[] = [
  { key: 'pending', label: '待审核' },
  { key: 'approved', label: '已通过' },
  { key: 'rejected', label: '已驳回' },
];

/** 后台投稿审核。通过时由数据库函数 review_submission() 落地到 cases / projects。 */
export default function AdminSubmissions() {
  const [tab, setTab] = useState<SubmissionStatus>('pending');
  const [items, setItems] = useState<ContentSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback((status: SubmissionStatus) => {
    setLoading(true);
    fetchSubmissionsForReview(status)
      .then(setItems)
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(tab); }, [tab, load]);

  const act = useCallback(async (s: ContentSubmission, approve: boolean) => {
    const note = (notes[s.id] || '').trim();
    if (!approve && !note) {
      toast.error('请填写驳回理由，用户需要知道该改什么');
      return;
    }
    setBusyId(s.id);
    try {
      await reviewSubmission(s.id, approve, note);
      toast.success(approve ? '已通过，内容已发布' : '已驳回');
      load(tab);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '操作失败');
    } finally {
      setBusyId(null);
    }
  }, [notes, tab, load]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        {TABS.map((x) => (
          <button
            key={x.key}
            onClick={() => setTab(x.key)}
            className={`rounded-full px-3.5 py-1.5 text-sm transition-colors ${
              tab === x.key ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {x.label}
          </button>
        ))}
      </div>

      {loading && <p className="text-sm text-muted-foreground">载入中…</p>}
      {!loading && items.length === 0 && (
        <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          没有{TABS.find((x) => x.key === tab)?.label}的投稿
        </p>
      )}

      {items.map((s) => {
        const open = openId === s.id;
        const who = s.submitter?.nickname || s.submitter?.username || '未知用户';
        return (
          <div key={s.id} className="rounded-lg border border-border bg-card/50">
            <div className="flex items-start justify-between gap-3 p-4">
              <div className="min-w-0">
                <p className="truncate font-medium">{s.payload?.title || '（无标题）'}</p>
                <p className="mt-1 font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                  {s.kind === 'case' ? '案例' : '项目'}
                  {s.target_id ? ' · 修改申请' : ' · 新投稿'}
                  {' · '}{who}
                  {' · '}{new Date(s.submitted_at).toLocaleString('zh-CN')}
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setOpenId(open ? null : s.id)}>
                {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                预览
              </Button>
            </div>

            {open && (
              <div className="border-t border-border p-4">
                {s.payload?.cover_url && (
                  <img src={s.payload.cover_url} alt="" className="mb-3 max-h-56 rounded object-cover" />
                )}
                {s.payload?.summary && (
                  <p className="mb-3 text-sm text-muted-foreground">{s.payload.summary}</p>
                )}
                {s.kind === 'project' && (
                  <dl className="mb-3 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
                    <div className="flex gap-2">
                      <dt className="text-muted-foreground">项目地址</dt>
                      <dd className="min-w-0 truncate">
                        {s.payload?.external_url
                          ? <a href={s.payload.external_url} target="_blank" rel="noreferrer noopener"
                               className="text-primary underline">{s.payload.external_url}</a>
                          : <span className="text-muted-foreground">（未填）</span>}
                      </dd>
                    </div>
                    <div className="flex gap-2">
                      <dt className="text-muted-foreground">场景 / 成熟度</dt>
                      <dd>{s.payload?.scene || '—'} · {s.payload?.maturity || '—'}</dd>
                    </div>
                  </dl>
                )}
                {/* 投稿正文是用户提交的 HTML，仅管理员在后台预览时渲染 */}
                <div
                  className="prose prose-invert max-w-none text-sm"
                  dangerouslySetInnerHTML={{ __html: s.payload?.content || '<p>（无正文）</p>' }}
                />
              </div>
            )}

            {s.status === 'pending' && (
              <div className="flex flex-col gap-2 border-t border-border p-4">
                <Textarea
                  rows={2}
                  placeholder="驳回理由（驳回必填，通过时可留空）"
                  value={notes[s.id] || ''}
                  onChange={(e) => setNotes((n) => ({ ...n, [s.id]: e.target.value }))}
                />
                <div className="flex items-center justify-end gap-2">
                  <Button variant="ghost" size="sm" disabled={busyId === s.id} onClick={() => act(s, false)}>
                    <X className="mr-1.5 h-4 w-4" />驳回
                  </Button>
                  <Button size="sm" disabled={busyId === s.id} onClick={() => act(s, true)}>
                    <Check className="mr-1.5 h-4 w-4" />
                    {busyId === s.id ? '处理中…' : '通过并发布'}
                  </Button>
                </div>
              </div>
            )}

            {s.status === 'rejected' && s.review_note && (
              <p className="border-t border-border px-4 py-3 text-sm text-muted-foreground">
                驳回理由：{s.review_note}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
