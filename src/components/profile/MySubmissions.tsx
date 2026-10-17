import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { Clock, CheckCircle2, XCircle, Trash2, Pencil, Archive, Send } from 'lucide-react';
import { SUBMIT_KIND_META } from '@/components/common/SubmitTabs';
import { useI18n } from '@/contexts/I18nContext';
import { Button } from '@/components/ui/button';
import {
  deleteSubmission, fetchMySubmissions, withdrawToDraft, submitDraft,
  deleteMyPublishedContent,
} from '@/lib/submissionsApi';
import type { ContentSubmission, SubmissionKind, SubmissionStatus } from '@/types/types';

const STATUS_META: Record<SubmissionStatus, { zh: string; en: string; cls: string; Icon: typeof Clock }> = {
  pending:  { zh: '审核中', en: 'In review', cls: 'text-amber-400 border-amber-400/40 bg-amber-400/10', Icon: Clock },
  approved: { zh: '已通过', en: 'Approved',  cls: 'text-emerald-400 border-emerald-400/40 bg-emerald-400/10', Icon: CheckCircle2 },
  rejected: { zh: '未通过', en: 'Rejected',  cls: 'text-rose-400 border-rose-400/40 bg-rose-400/10', Icon: XCircle },
  // 草稿：作者自己收起来的，不在审核队列里
  draft:    { zh: '草稿箱', en: 'Draft',     cls: 'text-muted-foreground border-border bg-muted/40', Icon: Archive },
};

/** 个人中心的「我的投稿」。状态、驳回理由、改了重投、撤回都在这里。 */
export default function MySubmissions() {
  const { t, lang } = useI18n();
  const [items, setItems] = useState<ContentSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  /** 草稿箱单独分出来：它不是「投稿记录」，是还没投出去的东西，
      混在一起会让人以为草稿也在排队等审核 */
  const [box, setBox] = useState<'submissions' | 'draft'>('submissions');

  const load = useCallback(() => {
    setLoading(true);
    fetchMySubmissions()
      .then(setItems)
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(load, [load]);

  /** 撤回 = 收进草稿箱，不删。管理员的审核队列只看 pending，草稿不会打扰后台 */
  const handleWithdraw = useCallback(async (id: string) => {
    if (!window.confirm(t('撤回后这条会收进草稿箱，之后还能接着改、重新提交。确定撤回？',
                          'It will be moved to your drafts — you can edit and resubmit later. Withdraw?'))) return;
    try {
      await withdrawToDraft(id);
      toast.success(t('已收进草稿箱', 'Moved to drafts'));
      load();
    } catch (e) {
      // 数据库还不认 draft 这个状态时的专门提示。
      // 报「请重试」会让人一直重试，而重试一万次也不会成功
      const msg = e instanceof Error ? e.message : '';
      if (/draft|enum|invalid input value/i.test(msg)) {
        toast.error(t('草稿箱还没启用：数据库迁移 00048 尚未执行',
                      'Drafts not enabled yet: migration 00048 has not been run'));
        return;
      }
      toast.error(t('撤回失败，请重试', 'Failed to withdraw'));
    }
  }, [t, load]);

  /** 草稿箱里的重新投出去 */
  const handleSubmitDraft = useCallback(async (id: string) => {
    try {
      await submitDraft(id);
      toast.success(t('已提交，等待管理员审核', 'Submitted, pending review'));
      load();
    } catch {
      toast.error(t('提交失败，请重试', 'Failed to submit'));
    }
  }, [t, load]);

  /**
   * 删除自己发布的内容（案例 / 项目 / 帖子都支持）。
   *
   * 正文、投稿记录、点赞收藏在数据库函数里一次清掉；
   * 帖子的评论有外键级联，跟着一起走。没有回收站。
   */
  const handleDeletePublished = useCallback(async (kind: SubmissionKind, targetId: string, label: string) => {
    if (!window.confirm(t(
      `确定删除这${label}？连同它的点赞、收藏${kind === 'discussion_post' ? '和评论' : ''}一起删掉，无法恢复。`,
      'Delete this permanently? Likes, favorites and comments will be removed too. This cannot be undone.',
    ))) return;
    try {
      await deleteMyPublishedContent(kind, targetId);
      toast.success(t('已删除', 'Deleted'));
      load();
    } catch (e) {
      const msg = e instanceof Error ? e.message : '';
      if (/function|does not exist|schema cache/i.test(msg)) {
        toast.error(t('删除功能还没启用：数据库迁移 00050 尚未执行',
                      'Delete not enabled yet: migration 00050 has not been run'));
        return;
      }
      // 函数自己抛的中文提示（不是你发的、已被删等）直接透传，比「请重试」有用
      toast.error(msg && /[\u4e00-\u9fa5]/.test(msg) ? msg : t('删除失败，请重试', 'Failed to delete'));
    }
  }, [t, load]);

  /** 草稿箱里彻底删掉。这一步才是不可恢复的，所以单独确认一次 */
  const handleDelete = useCallback(async (id: string) => {
    if (!window.confirm(t('彻底删除这份草稿？删除后无法恢复。', 'Delete this draft permanently? This cannot be undone.'))) return;
    try {
      await deleteSubmission(id);
      toast.success(t('已删除', 'Deleted'));
      load();
    } catch {
      toast.error(t('删除失败，请重试', 'Failed to delete'));
    }
  }, [t, load]);

  if (loading) {
    return <p className="text-sm text-muted-foreground">{t('载入中…', 'Loading…')}</p>;
  }

  const drafts = items.filter((x) => x.status === 'draft');
  const submitted = items.filter((x) => x.status !== 'draft');
  const shown = box === 'draft' ? drafts : submitted;

  const Switcher = (
    <div className="mb-4 flex items-center gap-1 border-b border-border">
      {([
        ['submissions', t('投稿记录', 'Submissions'), submitted.length],
        ['draft', t('草稿箱', 'Drafts'), drafts.length],
      ] as const).map(([key, label, n]) => (
        <button
          key={key}
          type="button"
          onClick={() => setBox(key)}
          aria-pressed={box === key}
          className={`-mb-px border-b-2 px-3 py-2 text-sm transition-colors ${
            box === key
              ? 'border-accent font-medium text-foreground'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          {label}
          {n > 0 && <span className="ml-1.5 font-mono text-[11px] text-muted-foreground">{n}</span>}
        </button>
      ))}
    </div>
  );

  if (shown.length === 0) {
    return (
      <div>
        {Switcher}
        <div className="rounded-lg border border-dashed border-border p-6 text-center">
          <p className="text-sm text-muted-foreground">
            {box === 'draft'
              ? t('草稿箱是空的。撤回的投稿会收到这里，之后还能接着改。',
                  'No drafts. Withdrawn submissions land here and can be edited later.')
              : t('还没有投稿。', 'No submissions yet.')}
          </p>
          {box === 'submissions' && (
            <Button asChild variant="secondary" size="sm" className="mt-3">
              <Link to="/submit/case">{t('去发布', 'Publish something')}</Link>
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div>
      {Switcher}
    {/* 两列卡片：一行只放一条时右边全是空白，内容多了也翻得累。
        封面图单独放左边，扫列表时靠图比靠标题快 */}
    <ul className="grid grid-cols-1 gap-3 xl:grid-cols-2">
      {shown.map((s) => {
        const meta = STATUS_META[s.status];
        const title = s.payload?.title || t('（无标题）', '(untitled)');
        const kindMeta = SUBMIT_KIND_META[s.kind];
        const kindLabel = t(kindMeta.zh, kindMeta.en);
        const cover = typeof s.payload?.cover_url === 'string' ? s.payload.cover_url : '';
        // 只有审核通过的才有线上内容可跳；待审、退回、草稿都还没发布出去
        const viewHref = s.status === 'approved' && s.target_id
          ? `${kindMeta.viewBase}/${s.target_id}`
          : null;
        return (
          <li
            key={s.id}
            className="flex gap-3 rounded-lg border border-border bg-card/40 p-3 transition-colors hover:border-accent/40"
          >
            {/* 封面。没有封面的投稿用内容类型的首字占位，不留一个空洞 */}
            {/* 封面和标题本身就是跳转入口，不再单独放一个「查看已发布内容」按钮 */}
            <Thumb cover={cover} fallback={kindLabel.slice(0, 1)} href={viewHref} />

            <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                {viewHref ? (
                  <Link
                    to={viewHref}
                    className="line-clamp-2 font-medium leading-snug text-foreground transition-colors hover:text-accent"
                  >
                    {title}
                  </Link>
                ) : (
                  <p className="line-clamp-2 font-medium leading-snug text-foreground">{title}</p>
                )}
                <p className="mt-1.5 font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
                  {kindLabel}
                  {s.target_id && ` · ${t('修改申请', 'Edit request')}`}
                  {' · '}
                  {new Date(s.submitted_at).toLocaleDateString(lang === 'en' ? 'en-US' : 'zh-CN')}
                </p>
              </div>
              <span className={`flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] ${meta.cls}`}>
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

            {/* 草稿箱：接着改、投出去、或者彻底删掉 */}
            {s.status === 'draft' && (
              <div className="mt-2.5 flex flex-wrap items-center gap-1">
                <Button asChild size="sm" variant="secondary">
                  <Link to={`${kindMeta.submitTo}?resubmit=${s.id}`}>
                    <Pencil className="mr-1.5 h-3.5 w-3.5" />
                    {t('接着改', 'Continue editing')}
                  </Link>
                </Button>
                <Button size="sm" onClick={() => handleSubmitDraft(s.id)}>
                  <Send className="mr-1.5 h-3.5 w-3.5" />
                  {t('提交审核', 'Submit for review')}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => handleDelete(s.id)}>
                  <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                  {t('删除', 'Delete')}
                </Button>
              </div>
            )}

            {(s.status === 'rejected' || s.status === 'pending') && (
              <div className="mt-2.5 flex flex-wrap items-center gap-1">
                {/* 待审和被驳回都能改。待审改的是同一条记录（原地覆盖），
                    管理员最终审到的永远是最后一版，不会出现两条互相覆盖的投稿 */}
                <Button asChild size="sm" variant="secondary">
                  <Link to={`${kindMeta.submitTo}?resubmit=${s.id}`}>
                    <Pencil className="mr-1.5 h-3.5 w-3.5" />
                    {s.status === 'rejected'
                      ? t('修改后重新提交', 'Edit and resubmit')
                      : t('修改', 'Edit')}
                  </Link>
                </Button>
                <Button size="sm" variant="ghost" onClick={() => handleWithdraw(s.id)}>
                  <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                  {t('撤回', 'Withdraw')}
                </Button>
              </div>
            )}

            {s.status === 'approved' && s.target_id && (
              <div className="mt-2.5 flex flex-wrap items-center gap-1">
                {/* 申请修改：改动同样要过审，审核期间线上内容照常显示；
                    被驳回也只是不采纳这次修改，不影响已发布的那条 */}
                <Button asChild size="sm" variant="secondary">
                  <Link to={`${kindMeta.submitTo}?target=${s.target_id}`}>
                    <Pencil className="mr-1.5 h-3.5 w-3.5" />
                    {t('申请修改', 'Request edit')}
                  </Link>
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-rose-400 hover:bg-rose-400/10 hover:text-rose-300"
                  onClick={() => s.target_id && handleDeletePublished(s.kind, s.target_id, kindLabel)}
                >
                  <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                  {t('删除', 'Delete')}
                </Button>
              </div>
            )}
            </div>
          </li>
        );
      })}
    </ul>
    </div>
  );
}

/**
 * 投稿封面。已发布的可点进去看线上内容，没发布的只是个静态图。
 * 没有封面时用内容类型的首字占位，不留一个空洞。
 */
function Thumb({ cover, fallback, href }: { cover: string; fallback: string; href: string | null }) {
  const box = 'hidden h-[72px] w-[72px] shrink-0 overflow-hidden rounded bg-muted sm:block';
  const inner = cover ? (
    <img src={cover} alt="" loading="lazy" className="h-full w-full object-cover transition-transform duration-300 hover:scale-[1.04]" />
  ) : (
    <div className="flex h-full w-full items-center justify-center font-display text-lg text-muted-foreground">
      {fallback}
    </div>
  );
  if (!href) return <div className={box}>{inner}</div>;
  return <Link to={href} className={box}>{inner}</Link>;
}
