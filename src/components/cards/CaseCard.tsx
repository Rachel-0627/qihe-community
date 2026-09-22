import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Eye, Share2, Pin } from 'lucide-react';
import { gsap } from 'gsap';
import { useGSAP } from '@gsap/react';
import { useI18n } from '@/contexts/I18nContext';
import { totalCount, displayViews } from '@/lib/utils';
import InteractionButton from './InteractionButton';
import MediaFrame from './MediaFrame';
import ShareDialog from '@/components/common/ShareDialog';
import type { CaseItem } from '@/types/types';

gsap.registerPlugin(useGSAP);

interface Props {
  item: CaseItem;
  liked?: boolean;
  favorited?: boolean;
  onLike?: () => void;
  onFavorite?: () => void;
}

/** 固定尺寸卡片：3:4 封面 + 固定高度内容区 + 固定高度互动栏，保证所有卡片长宽一致 */
export default function CaseCard({ item, liked, favorited, onLike, onFavorite }: Props) {
  const { t, lang } = useI18n();
  const [posterOpen, setPosterOpen] = useState(false);
  const title = lang === 'en' && item.title_en ? item.title_en : item.title;
  const summary = lang === 'en' && item.summary_en ? item.summary_en : item.summary;

  const cardRef = useRef<HTMLElement>(null);
  const glossRef = useRef<HTMLDivElement>(null);

  useGSAP((_, contextSafe) => {
    const card = cardRef.current;
    const gloss = glossRef.current;
    if (!card || !gloss || !contextSafe) return;

    const onEnter = contextSafe(() => {
      gsap.to(card, { boxShadow: '0 18px 40px hsl(258 90% 55% / 0.28)', duration: 0.35, overwrite: 'auto' });
      gsap.fromTo(gloss, { x: '-100%', opacity: 0 }, { x: '100%', opacity: 0.18, duration: 0.6, ease: 'power2.out' });
    });
    const onLeave = contextSafe(() => {
      gsap.to(card, { boxShadow: '0 1px 2px hsl(258 70% 30% / 0.25)', duration: 0.45, ease: 'power2.out', overwrite: 'auto' });
      gsap.to(gloss, { x: '100%', opacity: 0, duration: 0.3, ease: 'power2.in', overwrite: 'auto' });
    });

    card.addEventListener('mouseenter', onEnter);
    card.addEventListener('mouseleave', onLeave);
    return () => {
      card.removeEventListener('mouseenter', onEnter);
      card.removeEventListener('mouseleave', onLeave);
    };
  }, { scope: cardRef });

  return (
    <article ref={cardRef} data-reveal className="magazine-card group relative flex h-full flex-col overflow-hidden will-change-transform">
      <div ref={glossRef} className="pointer-events-none absolute inset-0 z-10 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent opacity-0" />
      {item.is_pinned && (
        <div className="absolute left-3 top-3 z-20 flex items-center gap-1 rounded bg-accent px-2 py-0.5 font-mono-label text-[10px] uppercase tracking-wider text-accent-foreground shadow-sm">
          <Pin className="h-2.5 w-2.5 fill-current" />
          {lang === 'en' ? 'PINNED' : '置顶'}
        </div>
      )}
      <Link to={`/cases/${item.id}`} className="block shrink-0">
        <MediaFrame src={item.cover_url} alt={title} />
      </Link>

      <div className="flex h-32 shrink-0 flex-col p-5">
        <Link to={`/cases/${item.id}`} className="block">
          <h3 className="line-clamp-2 font-display text-lg font-medium leading-snug text-foreground text-balance transition-colors group-hover:text-primary">
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
        shareUrl={`${typeof window !== 'undefined' ? window.location.origin : ''}/cases/${item.id}`}
      />
    </article>
  );
}
