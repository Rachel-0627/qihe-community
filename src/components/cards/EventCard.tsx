import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Eye, Share2 } from 'lucide-react';
import { useI18n } from '@/contexts/I18nContext';
import { totalCount, displayViews } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import InteractionButton from './InteractionButton';
import MediaFrame from './MediaFrame';
import ShareDialog from '@/components/common/ShareDialog';
import type { EventItem } from '@/types/types';

interface Props {
  item: EventItem;
  liked?: boolean;
  favorited?: boolean;
  onLike?: () => void;
  onFavorite?: () => void;
}

/** 固定尺寸卡片：3:4 封面 + 固定高度内容区 + 固定高度互动栏，保证所有卡片长宽一致 */
type EventStatus = 'open' | 'full' | 'ended';

function getEventStatus(item: EventItem): EventStatus {
  const eventTime = new Date(item.event_date).getTime();
  const capacity = item.capacity ?? 0;
  const registered = item.registered ?? 0;
  if (eventTime < Date.now()) return 'ended';
  if (capacity > 0 && registered >= capacity) return 'full';
  return 'open';
}

export default function EventCard({ item, liked, favorited, onLike, onFavorite }: Props) {
  const { t, lang } = useI18n();
  const [posterOpen, setPosterOpen] = useState(false);
  const title = lang === 'en' && item.title_en ? item.title_en : item.title;
  const summary = lang === 'en' && item.summary_en ? item.summary_en : item.summary;
  const status = getEventStatus(item);

  const statusLabels: Record<EventStatus, { zh: string; en: string; variant: 'default' | 'destructive' | 'secondary' }> = {
    open: { zh: '报名中', en: 'Open', variant: 'default' },
    full: { zh: '已满员', en: 'Full', variant: 'destructive' },
    ended: { zh: '已结束', en: 'Ended', variant: 'secondary' },
  };
  const label = statusLabels[status];

  return (
    <article data-reveal className={`magazine-card group flex h-full flex-col overflow-hidden ${status === 'ended' ? 'opacity-80' : ''}`}>
      <Link to={`/events/${item.id}`} className="block shrink-0">
        <MediaFrame src={item.cover_url} alt={title}>
          <div className="absolute left-3 top-3">
            <Badge variant={label.variant} className="font-mono-label text-[10px] uppercase tracking-wider">
              {lang === 'en' ? label.en : label.zh}
            </Badge>
          </div>
        </MediaFrame>
      </Link>

      <div className="flex h-32 shrink-0 flex-col p-5">
        <Link to={`/events/${item.id}`} className="block">
          <h3 className="line-clamp-2 font-display text-lg font-medium leading-snug text-foreground text-balance transition-colors group-hover:text-accent">
            {title}
          </h3>
        </Link>
        <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-muted-foreground text-pretty">{summary}</p>
      </div>

      <div className="mt-auto flex h-12 shrink-0 items-center justify-between border-t border-border px-5">
        <div className="flex items-center gap-4">
          <InteractionButton
            type="like"
            active={!!liked}
            count={totalCount(item.likes, item.base_likes)}
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onLike?.(); }}
            className={liked ? 'text-accent' : 'text-muted-foreground hover:text-foreground'}
          />
          <InteractionButton
            type="favorite"
            active={!!favorited}
            count={totalCount(item.favorites, item.base_favorites)}
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onFavorite?.(); }}
            className={favorited ? 'text-accent' : 'text-muted-foreground hover:text-foreground'}
          />
          <button
            type="button"
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); setPosterOpen(true); }}
            className="flex items-center gap-1.5 font-mono-label text-xs text-muted-foreground hover:text-accent"
            aria-label={t('分享', 'Share')}
          >
            <Share2 className="h-3.5 w-3.5" />{t('分享', 'Share')}
          </button>
        </div>
        <span className="flex items-center gap-1 font-mono-label text-xs text-muted-foreground">
          <Eye className="h-3.5 w-3.5" />
          {displayViews(item.views, item.base_views, item.likes, item.base_likes, item.favorites, item.base_favorites)}
        </span>
      </div>

      <ShareDialog
        open={posterOpen}
        onOpenChange={setPosterOpen}
        title={title}
        shareUrl={`${typeof window !== 'undefined' ? window.location.origin : ''}/events/${item.id}`}
      />
    </article>
  );
}
