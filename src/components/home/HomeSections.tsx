import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { useI18n } from '@/contexts/I18nContext';
import { useAuth } from '@/contexts/AuthContext';
import { fetchHomeCases, fetchHomeProjects, fetchHomeEvents, canAccessContent, getUserInteractions, toggleInteractionV2 } from '@/lib/api';
import { toast } from 'sonner';
import { Skeleton } from '@/components/ui/skeleton';
import CaseCard from '@/components/cards/CaseCard';
import ProjectCard from '@/components/cards/ProjectCard';
import EventCard from '@/components/cards/EventCard';
import type { CaseItem, ProjectItem, EventItem } from '@/types/types';

/**
 * 首页内容区：把社区里真实存在的东西直接摆在首页，
 * 而不是只放一排「点这里去看」的导航卡。
 * 三个区块复用列表页已有的卡片组件，风格天然一致。
 */
export default function HomeSections() {
  const { t } = useI18n();
  const { user, profile, refreshProfile } = useAuth();
  const tier = profile?.member_tier || 'guest';

  const [cases, setCases] = useState<CaseItem[] | null>(null);
  const [projects, setProjects] = useState<ProjectItem[] | null>(null);
  const [events, setEvents] = useState<EventItem[] | null>(null);
  const [interactions, setInteractions] = useState<{ like: Set<string>; favorite: Set<string> }>({ like: new Set(), favorite: new Set() });

  useEffect(() => {
    // 三个板块各查各自的表，且只取后台勾选了「在首页展示」的内容。
    // 案例只可能来自 cases、项目只可能来自 projects、活动只可能来自 events，
    // 类别在结构上就不会串。
    fetchHomeCases().then(setCases).catch(() => setCases([]));
    fetchHomeProjects().then(setProjects).catch(() => setProjects([]));
    fetchHomeEvents().then(setEvents).catch(() => setEvents([]));
  }, []);

  useEffect(() => {
    if (user) getUserInteractions(user.id).then(setInteractions).catch(() => {});
    else setInteractions({ like: new Set(), favorite: new Set() });
  }, [user]);

  const handleInteraction = async (
    type: 'case' | 'project' | 'event',
    item: CaseItem | ProjectItem | EventItem,
    action: 'like' | 'favorite'
  ) => {
    if (!user) { toast.error(t('请先登录后再操作', 'Please sign in first')); return; }
    try {
      const res = await toggleInteractionV2(user.id, type, item.id, action);
      const update = (prev: CaseItem[] | ProjectItem[] | EventItem[] | null) => {
        if (!prev) return prev;
        return prev.map((i) => i.id === item.id ? { ...i, likes: res.likes, favorites: res.favorites, views: res.views } : i) as typeof prev;
      };
      if (type === 'case') setCases(update as (prev: CaseItem[] | null) => CaseItem[] | null);
      if (type === 'project') setProjects(update as (prev: ProjectItem[] | null) => ProjectItem[] | null);
      if (type === 'event') setEvents(update as (prev: EventItem[] | null) => EventItem[] | null);
      setInteractions((prev) => {
        const next = { like: new Set(prev.like), favorite: new Set(prev.favorite) };
        const set = next[action];
        if (res.action === 'added') set.add(item.id);
        else set.delete(item.id);
        return next;
      });
      if (res.action === 'added' && res.actor_xp > 0) {
        toast.success(t(`+${res.actor_xp} XP`, `+${res.actor_xp} XP`));
        refreshProfile().catch(() => {});
      }
    } catch { toast.error(t('操作失败', 'Action failed')); }
  };

  return (
    <>
      <Section title={t('热门项目', 'Trending Projects')} desc={t('正在发生的 AI 创业项目、工具与资源', 'AI startup projects, tools and resources in motion')} to="/projects">
        <Grid loading={projects === null} empty={projects?.length === 0}>
          {projects?.map((item) => (
            <ProjectCard
              key={item.id}
              item={item}
              locked={!canAccessContent(tier, item.access_level)}
              liked={interactions.like.has(item.id)}
              favorited={interactions.favorite.has(item.id)}
              onLike={() => handleInteraction('project', item, 'like')}
              onFavorite={() => handleInteraction('project', item, 'favorite')}
            />
          ))}
        </Grid>
      </Section>

      <Section title={t('精选案例', 'Featured Cases')} desc={t('社区成员的 AI 实践与深度拆解', 'Real AI practice and in-depth breakdowns from the community')} to="/cases" muted>
        <Grid loading={cases === null} empty={cases?.length === 0}>
          {cases?.map((item) => (
            <CaseCard
              key={item.id}
              item={item}
              liked={interactions.like.has(item.id)}
              favorited={interactions.favorite.has(item.id)}
              onLike={() => handleInteraction('case', item, 'like')}
              onFavorite={() => handleInteraction('case', item, 'favorite')}
            />
          ))}
        </Grid>
      </Section>

      <Section title={t('近期活动', 'Upcoming Events')} desc={t('线下沙龙、工作坊与创业者聚会', 'Offline salons, workshops and founder meetups')} to="/events">
        <Grid loading={events === null} empty={events?.length === 0}>
          {events?.map((item) => (
            <EventCard
              key={item.id}
              item={item}
              liked={interactions.like.has(item.id)}
              favorited={interactions.favorite.has(item.id)}
              onLike={() => handleInteraction('event', item, 'like')}
              onFavorite={() => handleInteraction('event', item, 'favorite')}
            />
          ))}
        </Grid>
      </Section>
    </>
  );
}

function Section({ title, desc, to, muted, children }: { title: string; desc: string; to: string; muted?: boolean; children: ReactNode }) {
  const { t } = useI18n();
  return (
    <section className={`border-b border-border ${muted ? 'bg-[#0c0d10]' : ''}`}>
      <div className="mx-auto max-w-7xl px-4 py-12 md:px-8 md:py-16">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="font-display text-2xl font-medium tracking-[-.035em] text-[#ecebe7] md:text-[34px]">{title}</h2>
            <p className="mt-2 max-w-xl text-base leading-[1.7] text-[#8d9098] text-pretty">{desc}</p>
          </div>
          <Link to={to} className="group inline-flex items-center gap-1.5 font-mono-label text-[11px] tracking-[0.08em] text-[#8c8f97] transition-colors hover:text-[#ecebe7]">
            {t('查看全部', 'View all')}
            <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>
        <div className="mt-8">{children}</div>
      </div>
    </section>
  );
}

function Grid({ loading, empty, children }: { loading: boolean; empty?: boolean; children: ReactNode }) {
  const { t } = useI18n();
  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="border border-border bg-card p-0">
            <Skeleton className="aspect-[4/3] w-full bg-muted" />
            <div className="flex h-32 flex-col justify-center p-5">
              <Skeleton className="h-5 w-3/4 bg-muted" />
              <Skeleton className="mt-2 h-4 w-full bg-muted" />
            </div>
            <div className="flex h-12 items-center border-t border-border px-5">
              <Skeleton className="h-3 w-1/2 bg-muted" />
            </div>
          </div>
        ))}
      </div>
    );
  }
  if (empty) {
    return (
      <p className="py-8 text-sm text-muted-foreground">
        {t('暂无内容 —— 请在后台编辑内容时打开「在首页展示」', 'Nothing here yet — enable "Show on homepage" when editing content in the admin')}
      </p>
    );
  }
  return <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">{children}</div>;
}
