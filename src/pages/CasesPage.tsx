import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Flame, Clock, Bookmark } from 'lucide-react';
import { useI18n } from '@/contexts/I18nContext';
import { useAuth } from '@/contexts/AuthContext';
import { useReveal } from '@/hooks/useReveal';
import { fetchCategories, fetchCases, fetchCaseRanking, getUserInteractions, toggleInteractionV2 } from '@/lib/api';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';
import CaseCard from '@/components/cards/CaseCard';
import type { Category, CaseItem } from '@/types/types';

type RankDim = 'latest' | 'hot' | 'favorite';

export default function CasesPage() {
  const { t, lang } = useI18n();
  const { user, refreshProfile } = useAuth();
  const revealRef = useReveal<HTMLDivElement>();

  const [categories, setCategories] = useState<Category[]>([]);
  const [activeCat, setActiveCat] = useState<string | null>(null);
  const [cases, setCases] = useState<CaseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [rankDim, setRankDim] = useState<RankDim>('hot');
  const [ranking, setRanking] = useState<CaseItem[]>([]);
  const [interactions, setInteractions] = useState<{ like: Set<string>; favorite: Set<string> }>({ like: new Set(), favorite: new Set() });

  useEffect(() => {
    fetchCategories('case').then(setCategories).catch(() => {});
    loadCases(null);
    loadRanking('hot');
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (user) {
      getUserInteractions(user.id).then((res) => setInteractions(res)).catch(() => {});
    } else {
      setInteractions({ like: new Set(), favorite: new Set() });
    }
  }, [user]);

  const loadCases = useCallback((catId: string | null) => {
    setLoading(true);
    fetchCases(catId).then((data) => setCases(data)).catch(() => toast.error(t('加载案例失败', 'Failed to load cases'))).finally(() => setLoading(false));
  }, [t]);

  const loadRanking = useCallback((dim: RankDim) => {
    fetchCaseRanking(dim).then(setRanking).catch(() => {});
  }, []);

  const handleCatChange = (catId: string | null) => {
    setActiveCat(catId);
    loadCases(catId);
  };

  const handleRankChange = (dim: RankDim) => {
    setRankDim(dim);
    loadRanking(dim);
  };

  const handleInteraction = async (item: CaseItem, type: 'like' | 'favorite') => {
    if (!user) {
      toast.error(t('请先登录后再操作', 'Please sign in first'));
      return;
    }
    const isActive = interactions[type].has(item.id);
    try {
      const res = await toggleInteractionV2(user.id, 'case', item.id, type);
      setInteractions((prev) => {
        const next = { like: new Set(prev.like), favorite: new Set(prev.favorite) };
        if (isActive) next[type].delete(item.id);
        else next[type].add(item.id);
        return next;
      });
      setCases((prev) => prev.map((c) => c.id === item.id ? { ...c, likes: res.likes, favorites: res.favorites, views: res.views } : c));
      setRanking((prev) => prev.map((c) => c.id === item.id ? { ...c, likes: res.likes, favorites: res.favorites, views: res.views } : c));
      if (res.actor_xp > 0) {
        refreshProfile().catch(() => {});
      }
    } catch {
      toast.error(t('操作失败', 'Action failed'));
    }
  };

  const rankIcon = rankDim === 'hot' ? <Flame className="h-3.5 w-3.5" /> : rankDim === 'latest' ? <Clock className="h-3.5 w-3.5" /> : <Bookmark className="h-3.5 w-3.5" />;

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 md:px-8 md:py-16">
      <div className="max-w-2xl">
        <p className="editorial-label text-accent">{t('案例展示', 'Case Studies')}</p>
        <h1 className="mt-4 font-display text-3xl font-medium tracking-tight text-foreground text-balance md:text-5xl">{t('精选 AI 案例', 'Featured AI Cases')}</h1>
      </div>

      <div ref={revealRef} className="mt-10 grid grid-cols-1 gap-10 lg:grid-cols-[1fr_300px]">
        <div className="min-w-0">
          {/* Category filter */}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => handleCatChange(null)}
              className={`border px-3 py-1.5 font-mono-label text-xs uppercase tracking-wider transition-colors ${activeCat === null ? 'border-primary bg-primary text-primary-foreground' : 'border-border text-muted-foreground hover:text-foreground'}`}
            >
              {t('全部', 'All')}
            </button>
            {categories.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => handleCatChange(c.id)}
                className={`border px-3 py-1.5 font-mono-label text-xs uppercase tracking-wider transition-colors ${activeCat === c.id ? 'border-primary bg-primary text-primary-foreground' : 'border-border text-muted-foreground hover:text-foreground'}`}
              >
                {lang === 'en' ? c.name_en : c.name}
              </button>
            ))}
          </div>

          {/* Grid */}
          <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2">
            {loading
              ? Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="magazine-card p-0">
                    <Skeleton className="aspect-[4/3] w-full bg-muted" />
                    <div className="flex h-32 flex-col justify-center p-5">
                      <Skeleton className="h-5 w-3/4 bg-muted" />
                      <Skeleton className="mt-2 h-4 w-full bg-muted" />
                    </div>
                    <div className="flex h-12 items-center border-t border-border px-5">
                      <Skeleton className="h-3 w-1/2 bg-muted" />
                    </div>
                  </div>
                ))
              : cases.map((item) => (
                  <CaseCard
                    key={item.id}
                    item={item}
                    liked={interactions.like.has(item.id)}
                    favorited={interactions.favorite.has(item.id)}
                    onLike={() => handleInteraction(item, 'like')}
                    onFavorite={() => handleInteraction(item, 'favorite')}
                  />
                ))}
          </div>
        </div>

        {/* Ranking sidebar */}
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="magazine-card p-5">
            <h3 className="font-display text-xl font-medium">{t('排行榜', 'Leaderboard')}</h3>

            <div className="mt-4 flex gap-2">
              {(['hot', 'latest', 'favorite'] as RankDim[]).map((dim) => {
                const label = dim === 'hot' ? t('最热', 'Hot') : dim === 'latest' ? t('最新', 'Latest') : t('收藏', 'Saved');
                return (
                  <button
                    key={dim}
                    type="button"
                    onClick={() => handleRankChange(dim)}
                    className={`flex items-center gap-1 border px-2 py-1 font-mono-label text-[10px] uppercase tracking-wider transition-colors ${rankDim === dim ? 'border-accent text-accent' : 'border-border text-muted-foreground hover:text-foreground'}`}
                  >
                    {rankDim === dim && rankIcon}
                    {label}
                  </button>
                );
              })}
            </div>

            <ol className="mt-5 space-y-4">
              {ranking.map((item, i) => (
                <li key={item.id}>
                  <Link to={`/cases/${item.id}`} className="flex items-start gap-3 group">
                    <span className="font-display text-lg font-medium text-accent">{String(i + 1).padStart(2, '0')}</span>
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-2 text-sm leading-snug text-foreground transition-colors group-hover:text-accent">
                        {(lang === 'en' && item.title_en) ? item.title_en : item.title}
                      </p>
                      <div className="mt-1 flex items-center gap-3 font-mono-label text-[10px] text-muted-foreground">
                        <span>{rankDim === 'favorite' ? `♥ ${item.favorites}` : rankDim === 'latest' ? `${item.views} views` : `♥ ${item.likes}`}</span>
                      </div>
                    </div>
                  </Link>
                </li>
              ))}
            </ol>
          </div>
        </aside>
      </div>
    </div>
  );
}
