import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Bookmark, MessageCircle, Pin, ThumbsUp, Flag } from 'lucide-react';
import { toast } from 'sonner';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useI18n } from '@/contexts/I18nContext';
import { commentCountOf, reactionCountOf, toggleDiscussionReaction } from '@/lib/discussionApi';
import { reportCommunityItem } from '@/lib/communityConnectionsApi';
import type { DiscussionPost } from '@/types/types';

function relativeTime(iso: string, en: boolean): string {
  const min = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return en ? 'just now' : '刚刚';
  if (min < 60) return en ? `${min}m ago` : `${min} 分钟前`;
  if (min < 1440) return en ? `${Math.floor(min / 60)}h ago` : `${Math.floor(min / 60)} 小时前`;
  if (min < 43200) return en ? `${Math.floor(min / 1440)}d ago` : `${Math.floor(min / 1440)} 天前`;
  return new Date(iso).toLocaleDateString(en ? 'en' : 'zh-CN');
}

export default function PostCard({ item, userId, liked = false, saved = false, onChanged }: {
  item: DiscussionPost; userId?: string; liked?: boolean; saved?: boolean; onChanged?: () => void;
}) {
  const { t, lang } = useI18n();
  const [busy, setBusy] = useState(false);
  const count = commentCountOf(item);
  const changeReaction = async (kind: 'like' | 'favorite', active: boolean) => {
    if (!userId) { toast.info(t('请先登录再进行互动', 'Sign in to interact')); return; }
    setBusy(true);
    try { await toggleDiscussionReaction(userId, item.id, kind, active); onChanged?.(); }
    catch { toast.error(t('操作失败，请稍后重试', 'Could not complete this action')); }
    finally { setBusy(false); }
  };
  const report = async () => {
    if (!userId) { toast.info(t('请先登录再举报', 'Sign in to report')); return; }
    const reason = window.prompt(t('请简要说明举报原因', 'Why are you reporting this post?'));
    if (!reason?.trim()) return;
    try { await reportCommunityItem(userId, 'discussion', item.id, reason); toast.success(t('已提交举报', 'Report submitted')); }
    catch { toast.error(t('举报暂时未能提交', 'Could not submit report')); }
  };

  return (
    <article className="border-b border-border py-5">
      <div className="flex flex-wrap items-center gap-2">
        {item.is_pinned && <span className="flex items-center gap-1 rounded border border-accent bg-accent px-1.5 py-0.5 font-mono-label text-[10px] tracking-wider text-accent-foreground"><Pin className="h-2.5 w-2.5 fill-current" />{t('置顶', 'Pinned')}</span>}
        <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{item.category || '随想交流'}</span>
        <Avatar className="h-6 w-6"><AvatarImage src={item.author_avatar || undefined} alt="" /><AvatarFallback className="text-[10px]">{(item.author_name || 'U').slice(0, 1)}</AvatarFallback></Avatar>
        <span className="font-mono-label text-xs text-muted-foreground">{item.author_name || t('匿名', 'Anonymous')} · {relativeTime(item.created_at, lang === 'en')}</span>
      </div>
      <Link to={`/discuss/${item.id}`} className="mt-3 block rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <div className="flex gap-4">
          <div className="min-w-0 flex-1">
            <h3 className="font-display text-lg font-medium text-foreground text-balance">{item.title}</h3>
            <p className="mt-1.5 line-clamp-2 whitespace-pre-line text-sm leading-relaxed text-muted-foreground text-pretty">{item.body}</p>
          </div>
          {item.cover_url && <img src={item.cover_url} alt="" loading="lazy" className="h-20 w-28 shrink-0 rounded-md border border-border object-cover" />}
        </div>
      </Link>
      <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
        <Link to={`/discuss/${item.id}`} className="inline-flex items-center gap-1.5 hover:text-foreground"><MessageCircle className="h-3.5 w-3.5" />{count} {t('条回应', 'replies')}</Link>
        <button type="button" disabled={busy} onClick={() => void changeReaction('like', liked)} aria-pressed={liked} className={`inline-flex items-center gap-1.5 transition-colors hover:text-accent ${liked ? 'text-accent' : ''}`}><ThumbsUp className="h-3.5 w-3.5" />{reactionCountOf(item)} {t('赞', 'likes')}</button>
        <button type="button" disabled={busy} onClick={() => void changeReaction('favorite', saved)} aria-pressed={saved} className={`inline-flex items-center gap-1.5 transition-colors hover:text-accent ${saved ? 'text-accent' : ''}`}><Bookmark className="h-3.5 w-3.5" />{t('收藏', 'Save')}</button>
        <button type="button" onClick={() => void report()} className="ml-auto inline-flex items-center gap-1 hover:text-destructive"><Flag className="h-3.5 w-3.5" />{t('举报', 'Report')}</button>
      </div>
    </article>
  );
}
