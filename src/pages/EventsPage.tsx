import { useState, useEffect, useCallback, useMemo } from 'react';
import { useI18n } from '@/contexts/I18nContext';
import { useAuth } from '@/contexts/AuthContext';
import { useReveal } from '@/hooks/useReveal';
import { fetchEvents, fetchEventFilterOptions, getUserInteractions, toggleInteractionV2 } from '@/lib/api';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';
import EventCard from '@/components/cards/EventCard';
import type { EventItem, EventFilterOption } from '@/types/types';

export default function EventsPage() {
  const { t, lang } = useI18n();
  const { user, refreshProfile } = useAuth();
  const revealRef = useReveal<HTMLDivElement>();

  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [city, setCity] = useState<string | null>(null);
  const [theme, setTheme] = useState<string | null>(null);
  const [filterOptions, setFilterOptions] = useState<EventFilterOption[]>([]);
  const [expandedGroup, setExpandedGroup] = useState<'city' | 'theme' | null>(null);
  const [liked, setLiked] = useState<Set<string>>(new Set());
  const [favorited, setFavorited] = useState<Set<string>>(new Set());
  const [busyId, setBusyId] = useState<string | null>(null);

  const cityOptions = filterOptions.filter((o) => o.group === 'city' && o.is_active);
  const themeOptions = filterOptions.filter((o) => o.group === 'theme' && o.is_active);
  const cityCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const ev of events) {
      counts[ev.city] = (counts[ev.city] || 0) + 1;
    }
    return counts;
  }, [events]);

  const load = useCallback(() => {
    setLoading(true);
    fetchEvents({ city: city ?? undefined, theme: theme ?? undefined })
      .then(setEvents)
      .catch(() => toast.error(t('加载活动失败', 'Failed to load events')))
      .finally(() => setLoading(false));
  }, [city, theme, t]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    fetchEventFilterOptions().then(setFilterOptions).catch(() => {});
  }, []);
  useEffect(() => {
    if (user) {
      getUserInteractions(user.id)
        .then((data) => { setLiked(data.like); setFavorited(data.favorite); })
        .catch(() => {});
    } else {
      setLiked(new Set());
      setFavorited(new Set());
    }
  }, [user]);

  const getOptionLabel = (name: string) => {
    const opt = filterOptions.find((o) => o.name === name);
    if (!opt) return name;
    return lang === 'en' && opt.name_en ? opt.name_en : opt.name;
  };

  const handleInteraction = async (item: EventItem, type: 'like' | 'favorite') => {
    if (!user) { toast.error(t('请先登录后再操作', 'Please sign in to interact')); return; }
    setBusyId(item.id);
    try {
      const res = await toggleInteractionV2(user.id, 'event', item.id, type);
      setEvents((prev) => prev.map((e) => e.id === item.id ? { ...e, likes: res.likes, favorites: res.favorites, views: res.views } : e));
      const set = type === 'like' ? setLiked : setFavorited;
      set((prev) => {
        const next = new Set(prev);
        if (res.action === 'added') next.add(item.id);
        else next.delete(item.id);
        return next;
      });
      if (res.action === 'added') {
        toast.success(type === 'like' ? t('已点赞', 'Liked') : t('已收藏', 'Favorited'));
        if (res.actor_xp > 0) {
          toast.success(t(`+${res.actor_xp} XP`, `+${res.actor_xp} XP`));
          refreshProfile().catch(() => {});
        }
      }
    } catch {
      toast.error(t('操作失败，请稍后再试', 'Interaction failed'));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 md:px-8 md:py-16">
      <div className="max-w-2xl">
        <p className="editorial-label text-accent">{t('城市组局', 'City Events')}</p>
        <h1 className="mt-4 font-display text-3xl font-medium tracking-tight text-foreground text-balance md:text-5xl">{t('线下 AI 连接', 'Real-World AI Connections')}</h1>
        <p className="mt-4 text-base leading-relaxed text-muted-foreground text-pretty">{t('按城市与主题发现线下活动，与本地 AI 社区面对面交流。', 'Discover offline events by city and theme, and meet your local AI community in person.')}</p>
      </div>

      {/* Filters */}
      <div className="mt-8 border-b border-border pb-6">
        <div className="flex flex-wrap gap-2">
          <GroupButton
            label={t('所在地', 'Location')}
            value={city ? getOptionLabel(city) : null}
            active={expandedGroup === 'city'}
            onClick={() => setExpandedGroup((g) => g === 'city' ? null : 'city')}
          />
          <GroupButton
            label={t('主题类型', 'Theme')}
            value={theme ? getOptionLabel(theme) : null}
            active={expandedGroup === 'theme'}
            onClick={() => setExpandedGroup((g) => g === 'theme' ? null : 'theme')}
          />
        </div>

        {expandedGroup === 'city' && (
          <div className="mt-4 border border-border bg-card p-4">
            <div className="mb-3 flex items-center gap-2">
              <span className="font-mono-label text-xs uppercase tracking-wider text-muted-foreground">{t('组局官排行榜', 'Event Host Rankings')}</span>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              <CityCard label={t('全部', 'All')} count={events.length} active={!city} onClick={() => setCity(null)} />
              {cityOptions.map((opt) => {
                const count = cityCounts[opt.name] || 0;
                return (
                  <CityCard
                    key={opt.id}
                    label={lang === 'en' && opt.name_en ? opt.name_en : opt.name}
                    count={count}
                    active={city === opt.name}
                    onClick={() => setCity(opt.name)}
                  />
                );
              })}
            </div>
          </div>
        )}
        {expandedGroup === 'theme' && (
          <div className="mt-4">
            <p className="mb-2 text-xs text-muted-foreground">{t('选择主题', 'Select theme')}</p>
            <div className="flex flex-wrap gap-2">
              <FilterChip label={t('全部', 'All')} active={!theme} onClick={() => setTheme(null)} />
              {themeOptions.map((opt) => (
                <FilterChip key={opt.id} label={lang === 'en' && opt.name_en ? opt.name_en : opt.name} active={theme === opt.name} onClick={() => setTheme(opt.name)} />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Grid */}
      <div ref={revealRef} className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {loading
          ? Array.from({ length: 3 }).map((_, i) => (
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
          : events.map((item) => (
              <EventCard
                key={item.id}
                item={item}
                liked={liked.has(item.id)}
                favorited={favorited.has(item.id)}
                onLike={() => handleInteraction(item, 'like')}
                onFavorite={() => handleInteraction(item, 'favorite')}
              />
            ))}
      </div>
    </div>
  );
}

function GroupButton({ label, value, active, onClick }: { label: string; value: string | null; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-2 border px-3 py-1.5 font-mono-label text-xs uppercase tracking-wider transition-colors ${active ? 'border-primary bg-primary text-primary-foreground' : 'border-border text-muted-foreground hover:text-foreground'}`}
    >
      {label}
      {value && (
        <span className={`border px-1.5 py-0.5 text-[10px] ${active ? 'border-primary-foreground/60 text-primary-foreground' : 'border-accent text-accent'}`}>
          {value}
        </span>
      )}
    </button>
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

function CityCard({ label, count, active, onClick }: { label: string; count: number; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center justify-between gap-2 border px-3 py-2 transition-colors ${active ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-background text-foreground hover:border-accent hover:text-accent'}`}
    >
      <span className="truncate font-mono-label text-xs uppercase tracking-wider">{label}</span>
      <span className={`font-display text-sm font-medium ${active ? 'text-primary-foreground' : 'text-accent'}`}>{count}</span>
    </button>
  );
}
