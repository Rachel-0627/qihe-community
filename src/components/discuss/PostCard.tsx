import { Link } from 'react-router-dom';
import { MessageCircle, Pin } from 'lucide-react';
import { commentCountOf } from '@/lib/discussionApi';
import type { DiscussionPost } from '@/types/types';

/** 相对时间：论坛式列表看「3 小时前」比看日期更有节奏感 */
function relativeTime(iso: string): string {
  const min = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return '刚刚';
  if (min < 60) return `${min} 分钟前`;
  if (min < 1440) return `${Math.floor(min / 60)} 小时前`;
  if (min < 43200) return `${Math.floor(min / 1440)} 天前`;
  return new Date(iso).toLocaleDateString('zh-CN');
}

export default function PostCard({ item }: { item: DiscussionPost }) {
  const count = commentCountOf(item);

  return (
    <Link to={`/discuss/${item.id}`} className="block border-b border-border py-5 transition-colors hover:bg-card/60">
      <div className="flex flex-wrap items-center gap-2">
        {item.is_pinned && (
          <span className="flex items-center gap-1 rounded border border-accent bg-accent px-1.5 py-0.5 font-mono-label text-[10px] uppercase tracking-wider text-accent-foreground">
            <Pin className="h-2.5 w-2.5 fill-current" />置顶
          </span>
        )}
        <span className="font-mono-label text-xs text-muted-foreground">
          {item.author_name || '匿名'} · {relativeTime(item.created_at)}
        </span>
      </div>

      <div className="mt-2 flex gap-4">
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-lg font-medium text-foreground text-balance">{item.title}</h3>
          {/* 正文是纯文本，截断交给 CSS，避免按字数切出半个词 */}
          <p className="mt-1.5 line-clamp-2 whitespace-pre-line text-sm leading-relaxed text-muted-foreground text-pretty">
            {item.body}
          </p>
        </div>
        {/* 有封面才占位；没有的话文字撑满，不留一块灰方块 */}
        {item.cover_url && (
          <img
            src={item.cover_url}
            alt=""
            loading="lazy"
            className="h-20 w-28 shrink-0 rounded-md border border-border object-cover"
          />
        )}
      </div>

      <div className="mt-3 flex items-center gap-1.5 font-mono-label text-xs text-muted-foreground">
        <MessageCircle className="h-3.5 w-3.5" />
        {count > 0 ? `${count} 条回应` : '还没有人回应'}
      </div>
    </Link>
  );
}
