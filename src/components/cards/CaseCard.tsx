import { Link } from 'react-router-dom';
import { Eye } from 'lucide-react';
import { useI18n } from '@/contexts/I18nContext';
import { totalCount, displayViews } from '@/lib/utils';
import InteractionButton from './InteractionButton';
import MediaFrame from './MediaFrame';
import type { CaseItem } from '@/types/types';

interface Props {
  item: CaseItem;
  liked?: boolean;
  favorited?: boolean;
  onLike?: () => void;
  onFavorite?: () => void;
}

/** 固定尺寸卡片：3:4 封面 + 固定高度内容区 + 固定高度互动栏，保证所有卡片长宽一致 */
export default function CaseCard({ item, liked, favorited, onLike, onFavorite }: Props) {
  const { lang } = useI18n();
  const title = lang === 'en' && item.title_en ? item.title_en : item.title;
  const summary = lang === 'en' && item.summary_en ? item.summary_en : item.summary;

  return (
    <article data-reveal className="magazine-card group flex h-full flex-col overflow-hidden">
      <Link to={`/cases/${item.id}`} className="block shrink-0">
        <MediaFrame src={item.cover_url} alt={title} />
      </Link>

      <div className="flex h-32 shrink-0 flex-col p-5">
        <Link to={`/cases/${item.id}`} className="block">
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
        </div>
        <span className="flex items-center gap-1 font-mono-label text-xs text-muted-foreground">
          <Eye className="h-3.5 w-3.5" />
          {displayViews(item.views, item.base_views, item.likes, item.base_likes, item.favorites, item.base_favorites)}
        </span>
      </div>
    </article>
  );
}
