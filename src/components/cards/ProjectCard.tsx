import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, Share2, Pin } from 'lucide-react';
import { useI18n } from '@/contexts/I18nContext';
import { totalCount, displayViews } from '@/lib/utils';
import InteractionButton from './InteractionButton';
import MediaFrame from './MediaFrame';
import ShareDialog from '@/components/common/ShareDialog';
import type { ProjectItem } from '@/types/types';

interface Props {
  item: ProjectItem;
  liked?: boolean;
  favorited?: boolean;
  onLike?: () => void;
  onFavorite?: () => void;
}

/** 固定尺寸卡片：3:4 封面 + 固定高度内容区 + 固定高度互动栏，保证所有卡片长宽一致 */
const accessLevelLabel: Record<string, { zh: string; en: string; className: string }> = {
  free: { zh: '免费', en: 'Free', className: 'bg-primary/90 text-primary-foreground' },
  member: { zh: '会员', en: 'Member', className: 'bg-accent/90 text-accent-foreground' },
  pro: { zh: 'Pro', en: 'Pro', className: 'bg-[#ecebe7] text-[#0b0c0f]' },
  private: { zh: '专属', en: 'Private', className: 'bg-[#ecebe7] text-[#0b0c0f]' },
};

export default function ProjectCard({ item, liked, favorited, onLike, onFavorite }: Props) {
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const [posterOpen, setPosterOpen] = useState(false);
  const title = lang === 'en' && item.title_en ? item.title_en : item.title;
  const summary = lang === 'en' && item.summary_en ? item.summary_en : item.summary;
  const maturityLabel = lang === 'en' && item.maturity_en ? item.maturity_en : item.maturity;
  const access = accessLevelLabel[item.access_level] || accessLevelLabel.free;

  // 付费项目也放行进详情页。以前全文不可读，进去没意义所以弹窗拦下；
  // 现在详情页会显示完整目录和免费试看章节，拦住反而看不到试看。
  // 正文该扣的仍在数据库里扣，前端放行不等于放内容。
  const handleFooterClick = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    navigate(`/projects/${item.id}`);
  };

  return (
    <>
      <article data-reveal className="magazine-card group flex h-full flex-col overflow-hidden cursor-pointer">
        <Link to={`/projects/${item.id}`} className="flex flex-1 flex-col focus:outline-none">
          <div className="shrink-0">
            <MediaFrame src={item.cover_url} alt={title} />
          </div>

          <div className="flex h-32 shrink-0 flex-col p-5">
            <div className="pointer-events-none flex flex-wrap gap-1.5">
              {item.is_pinned && (
                <span className="flex items-center gap-1 rounded bg-accent px-2 py-0.5 font-mono-label text-[10px] uppercase tracking-wider text-accent-foreground shadow-sm">
                  <Pin className="h-2.5 w-2.5 fill-current" />
                  {lang === 'en' ? 'PINNED' : '置顶'}
                </span>
              )}
              <span className={`rounded px-2 py-0.5 font-mono-label text-[10px] uppercase tracking-wider ${access.className}`}>
                {lang === 'en' ? access.en : access.zh}
              </span>
              {maturityLabel && (
                <span className="rounded bg-[rgba(9,10,12,.72)] px-2 py-0.5 font-mono-label text-[10px] uppercase tracking-wider text-[#ecebe7] backdrop-blur-sm">
                  {maturityLabel}
                </span>
              )}
            </div>
            <h3 className="mt-2 line-clamp-2 font-display text-lg font-medium leading-snug text-foreground text-balance transition-colors group-hover:text-accent">
              {title}
            </h3>
            <p className="mt-2 line-clamp-1 text-sm leading-relaxed text-muted-foreground text-pretty">{summary}</p>
          </div>
        </Link>

        <div
          onClick={handleFooterClick}
          className="mt-auto flex h-12 shrink-0 items-center justify-between border-t border-border px-5"
        >
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
      </article>

      <ShareDialog
        open={posterOpen}
        onOpenChange={setPosterOpen}
        title={title}
        shareUrl={`${typeof window !== 'undefined' ? window.location.origin : ''}/projects/${item.id}`}
      />
    </>
  );
}
