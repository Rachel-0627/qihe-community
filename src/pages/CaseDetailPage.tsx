import { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Heart, Bookmark, Eye } from 'lucide-react';
import { useI18n } from '@/contexts/I18nContext';
import { useAuth } from '@/contexts/AuthContext';
import { fetchCaseById, getUserInteractions, toggleInteractionV2, incrementContentView } from '@/lib/api';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { totalCount } from '@/lib/utils';
import type { CaseItem, ContentBlock } from '@/types/types';

export default function CaseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { t, lang } = useI18n();
  const { user, refreshProfile } = useAuth();
  const navigate = useNavigate();

  const [item, setItem] = useState<CaseItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [liked, setLiked] = useState(false);
  const [favorited, setFavorited] = useState(false);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    fetchCaseById(id)
      .then(setItem)
      .catch(() => toast.error(t('加载案例失败', 'Failed to load case')))
      .finally(() => setLoading(false));
  }, [id, t]);

  useEffect(() => {
    if (!id) return;
    incrementContentView('case', id)
      .then(() => setItem((prev) => prev ? { ...prev, views: prev.views + 1 } : prev))
      .catch(() => {});
  }, [id]);

  useEffect(() => {
    if (user && id) {
      getUserInteractions(user.id).then((res) => {
        setLiked(res.like.has(id));
        setFavorited(res.favorite.has(id));
      }).catch(() => {});
    }
  }, [user, id]);

  const handleInteraction = useCallback(async (type: 'like' | 'favorite') => {
    if (!user || !item) { toast.error(t('请先登录后再操作', 'Please sign in first')); return; }
    const isActive = type === 'like' ? liked : favorited;
    try {
      const res = await toggleInteractionV2(user.id, 'case', item.id, type);
      if (type === 'like') setLiked(res.action === 'added');
      else setFavorited(res.action === 'added');
      setItem((prev) => prev ? { ...prev, likes: res.likes, favorites: res.favorites } : prev);
      if (res.actor_xp > 0) {
        refreshProfile().catch(() => {});
      }
    } catch { toast.error(t('操作失败', 'Action failed')); }
  }, [user, item, liked, favorited, t, refreshProfile]);

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12 md:px-8">
        <Skeleton className="h-6 w-20 bg-muted" />
        <Skeleton className="mt-6 h-10 w-3/4 bg-muted" />
        <Skeleton className="mt-8 aspect-[16/9] w-full bg-muted" />
      </div>
    );
  }

  if (!item) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-20 text-center md:px-8">
        <p className="editorial-label">{t('未找到案例', 'Case not found')}</p>
        <Button variant="outline" className="mt-6" onClick={() => navigate('/cases')}>{t('返回案例', 'Back to Cases')}</Button>
      </div>
    );
  }

  const title = lang === 'en' && item.title_en ? item.title_en : item.title;
  const summary = lang === 'en' && item.summary_en ? item.summary_en : item.summary;
  const author = lang === 'en' && item.author_en ? item.author_en : item.author;
  const category = item.categories ? (lang === 'en' && item.categories.name_en ? item.categories.name_en : item.categories.name) : null;
  const rawContent = lang === 'en' && item.content_en ? item.content_en : item.content;

  return (
    <article className="mx-auto max-w-3xl px-4 py-10 md:px-8 md:py-16">
      <Link to="/cases" className="inline-flex items-center gap-1 font-mono-label text-xs uppercase tracking-wider text-muted-foreground hover:text-accent">
        <ArrowLeft className="h-3.5 w-3.5" />
        {t('返回案例', 'Back to cases')}
      </Link>

      <header className="mt-8">
        {category && <p className="editorial-label text-accent">{category}</p>}
        <h1 className="mt-3 font-display text-3xl font-medium leading-tight tracking-tight text-foreground text-balance md:text-4xl">{title}</h1>
        <p className="mt-4 text-base leading-relaxed text-muted-foreground text-pretty">{summary}</p>
        <div className="mt-6 flex items-center justify-between border-y border-border py-4">
          <span className="font-mono-label text-xs text-muted-foreground">{author}</span>
          <div className="flex items-center gap-4">
            <button type="button" onClick={() => handleInteraction('like')} className={`flex items-center gap-1.5 font-mono-label text-xs transition-colors ${liked ? 'text-accent' : 'text-muted-foreground hover:text-foreground'}`}>
              <Heart className={`h-4 w-4 ${liked ? 'fill-current' : ''}`} />{totalCount(item.likes, item.base_likes)}
            </button>
            <button type="button" onClick={() => handleInteraction('favorite')} className={`flex items-center gap-1.5 font-mono-label text-xs transition-colors ${favorited ? 'text-accent' : 'text-muted-foreground hover:text-foreground'}`}>
              <Bookmark className={`h-4 w-4 ${favorited ? 'fill-current' : ''}`} />{totalCount(item.favorites, item.base_favorites)}
            </button>
            <span className="flex items-center gap-1.5 font-mono-label text-xs text-muted-foreground">
              <Eye className="h-4 w-4" />{totalCount(item.views, item.base_views)}
            </span>
          </div>
        </div>
      </header>

      {/* Document-style content */}
      <RichContent content={rawContent} />
    </article>
  );
}

function RichContent({ content }: { content: string | ContentBlock[] }) {
  if (typeof content === 'string') {
    if (!content.trim()) return null;
    return (
      <div
        className="prose prose-base max-w-none dark:prose-invert mt-10"
        dangerouslySetInnerHTML={{ __html: content }}
      />
    );
  }
  if (Array.isArray(content) && content.length > 0) {
    return (
      <div className="mt-10 space-y-6">
        {content.map((block, i) => <LegacyContentRenderer key={i} block={block} />)}
      </div>
    );
  }
  return null;
}

function LegacyContentRenderer({ block }: { block: ContentBlock }) {
  if (block.type === 'heading') {
    return <h2 className="font-display text-xl font-medium text-foreground text-balance">{block.text}</h2>;
  }
  if (block.type === 'paragraph') {
    return <p className="text-base leading-relaxed text-foreground/90 text-pretty">{block.text}</p>;
  }
  if (block.type === 'quote') {
    return (
      <blockquote className="border-l-2 border-accent bg-muted/50 px-5 py-4">
        <p className="font-display text-lg italic leading-relaxed text-foreground text-pretty">{block.text}</p>
      </blockquote>
    );
  }
  if (block.type === 'image') {
    return (
      <figure className="overflow-hidden border border-border bg-card">
        <div className="bg-[#181a1e] p-2 md:p-[10px]">
          {block.url && (
            <img
              src={block.url}
              alt={block.caption || ''}
              loading="lazy"
              className="w-full rounded-md border border-[rgba(235,234,227,.09)] object-cover brightness-[.9] saturate-[.9]"
            />
          )}
        </div>
        {block.caption && (
          <figcaption className="border-t border-border px-4 py-2 font-mono-label text-xs text-muted-foreground">{block.caption}</figcaption>
        )}
      </figure>
    );
  }
  return null;
}