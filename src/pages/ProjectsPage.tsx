import { useState, useEffect, useCallback } from 'react';
import { useI18n } from '@/contexts/I18nContext';
import { useAuth } from '@/contexts/AuthContext';
import { useReveal } from '@/hooks/useReveal';
import { fetchProjects, getUserInteractions, toggleInteractionV2, canAccessContent, fetchProjectFilterOptions } from '@/lib/api';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';
import ProjectCard from '@/components/cards/ProjectCard';
import type { ProjectItem, ProjectFilterOption } from '@/types/types';

type FilterKey = 'scene' | 'hot' | 'maturity';

export default function ProjectsPage() {
  const { t, lang } = useI18n();
  const { user, profile, refreshProfile } = useAuth();
  const revealRef = useReveal<HTMLDivElement>();

  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<FilterKey>('scene');
  const [scene, setScene] = useState<string | null>(null);
  const [maturity, setMaturity] = useState<string | null>(null);
  const [hotOnly, setHotOnly] = useState(false);
  const [interactions, setInteractions] = useState<{ like: Set<string>; favorite: Set<string> }>({ like: new Set(), favorite: new Set() });
  const [filterOptions, setFilterOptions] = useState<ProjectFilterOption[]>([]);
  const [showAllFilters, setShowAllFilters] = useState(false);

  const tier = profile?.member_tier || 'guest';

  const load = useCallback(() => {
    setLoading(true);
    fetchProjects({ scene: activeFilter === 'scene' ? scene ?? undefined : undefined, maturity: activeFilter === 'maturity' ? maturity ?? undefined : undefined, hotOnly: activeFilter === 'hot' ? hotOnly : undefined })
      .then(setProjects)
      .catch(() => toast.error(t('加载项目失败', 'Failed to load projects')))
      .finally(() => setLoading(false));
  }, [activeFilter, scene, maturity, hotOnly, t]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (user) getUserInteractions(user.id).then(setInteractions).catch(() => {});
    else setInteractions({ like: new Set(), favorite: new Set() });
  }, [user]);
  useEffect(() => {
    fetchProjectFilterOptions().then(setFilterOptions).catch(() => {});
  }, []);
  useEffect(() => {
    setShowAllFilters(false);
  }, [activeFilter]);

  const activeOptions = filterOptions.filter((o) => o.group === (activeFilter === 'scene' ? 'scene' : 'maturity') && o.is_active);
  const featuredOptions = activeOptions.filter((o) => o.is_featured).slice(0, 5);
  const currentValue = activeFilter === 'scene' ? scene : maturity;
  const currentInFeatured = featuredOptions.some((o) => o.name === currentValue);
  const displayOptions = showAllFilters || !currentInFeatured ? activeOptions : featuredOptions;
  const hasHiddenOptions = activeOptions.length > featuredOptions.length;

  const getOptionLabel = (name: string) => {
    const opt = filterOptions.find((o) => o.name === name);
    if (!opt) return name;
    return lang === 'en' && opt.name_en ? opt.name_en : opt.name;
  };

  const handleInteraction = async (item: ProjectItem, type: 'like' | 'favorite') => {
    if (!user) { toast.error(t('请先登录后再操作', 'Please sign in first')); return; }
    const isActive = interactions[type].has(item.id);
    try {
      const res = await toggleInteractionV2(user.id, 'project', item.id, type);
      setInteractions((p) => {
        const n = { like: new Set(p.like), favorite: new Set(p.favorite) };
        if (isActive) n[type].delete(item.id);
        else n[type].add(item.id);
        return n;
      });
      setProjects((prev) => prev.map((p) => p.id === item.id ? { ...p, likes: res.likes, favorites: res.favorites, views: res.views } : p));
      if (res.action === 'added' && res.actor_xp > 0) {
        toast.success(t(`+${res.actor_xp} XP`, `+${res.actor_xp} XP`));
        refreshProfile().catch(() => {});
      }
    } catch { toast.error(t('操作失败', 'Action failed')); }
  };

  const filterTabs: [FilterKey, string, string][] = [
    ['scene', '应用场景', 'By Scene'],
    ['hot', '热门项目', 'Hot'],
    ['maturity', '成熟度', 'Maturity'],
  ];

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 md:px-8 md:py-16">
      <div className="max-w-2xl">
        <p className="editorial-label text-accent">{t('AI 项目库', 'AI Project Library')}</p>
        <h1 className="mt-4 font-display text-3xl font-medium tracking-tight text-foreground text-balance md:text-5xl">{t('前沿 AI 项目集合', 'A Collection of Frontier AI Projects')}</h1>
        <p className="mt-4 text-base leading-relaxed text-muted-foreground text-pretty">{t('按应用场景、热度与成熟度探索精选 AI 项目。', 'Explore curated AI projects by scene, popularity, and maturity.')}</p>
      </div>

      {/* Filter tabs */}
      <div className="mt-8 flex flex-wrap gap-2 border-b border-border pb-4">
        {filterTabs.map(([key, zh, en]) => (
          <button
            key={key}
            type="button"
            onClick={() => setActiveFilter(key)}
            className={`border px-4 py-2 font-mono-label text-xs uppercase tracking-wider transition-colors ${activeFilter === key ? 'border-primary bg-primary text-primary-foreground' : 'border-border text-muted-foreground hover:text-foreground'}`}
          >
            {t(zh, en)}
          </button>
        ))}
      </div>

      {/* Sub filters */}
      <div className="mt-4 flex flex-wrap gap-2">
        {(activeFilter === 'scene' || activeFilter === 'maturity') && (
          <>
            <FilterChip
              label={t('全部', 'All')}
              active={!currentValue}
              onClick={() => {
                if (activeFilter === 'scene') setScene(null); else setMaturity(null);
              }}
            />
            {displayOptions.map((opt) => {
              const isActive = currentValue === opt.name;
              return (
                <FilterChip
                  key={opt.id}
                  label={lang === 'en' && opt.name_en ? opt.name_en : opt.name}
                  active={isActive}
                  onClick={() => activeFilter === 'scene' ? setScene(opt.name) : setMaturity(opt.name)}
                />
              );
            })}
            {hasHiddenOptions && !showAllFilters && (
              <FilterChip
                label={t('全部', 'All')}
                active={false}
                onClick={() => setShowAllFilters(true)}
              />
            )}
          </>
        )}
        {activeFilter === 'hot' && (
          <FilterChip label={t('仅看热门', 'Hot only')} active={hotOnly} onClick={() => setHotOnly((v) => !v)} />
        )}
      </div>

      {/* Grid */}
      <div ref={revealRef} className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {loading
          ? Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="magazine-card">
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
          : projects.map((item) => (
              <ProjectCard
                key={item.id}
                item={item}
                locked={!canAccessContent(tier, item.access_level)}
                liked={interactions.like.has(item.id)}
                favorited={interactions.favorite.has(item.id)}
                onLike={() => handleInteraction(item, 'like')}
                onFavorite={() => handleInteraction(item, 'favorite')}
              />
            ))}
      </div>
    </div>
  );
}

function FilterChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`border px-3 py-1.5 font-mono-label text-xs uppercase tracking-wider transition-colors ${active ? 'border-accent text-accent' : 'border-border text-muted-foreground hover:text-foreground'}`}
    >
      {label}
    </button>
  );
}
