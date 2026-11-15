import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, PenSquare, Search, UsersRound } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useI18n } from '@/contexts/I18nContext';
import { useSiteSettings } from '@/contexts/SiteSettingsContext';
import { useReveal } from '@/hooks/useReveal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import PostCard from '@/components/discuss/PostCard';
import { fetchDiscussionPosts, fetchUserDiscussionReactions } from '@/lib/discussionApi';
import { DISCUSSION_CATEGORIES } from '@/lib/communityConnectionsApi';
import { sanitizeRichHtml } from '@/lib/sanitizeRichHtml';
import CommunityConnections from '@/pages/community/CommunityConnections';
import type { DiscussionPost } from '@/types/types';

const CATEGORY_EN: Record<string, string> = {
  '全部': 'All', '实践分享': 'Practice', '问题求助': 'Questions', '观点讨论': 'Discussion', '合作需求': 'Collaboration', '随想交流': 'Open chat',
};

export default function DiscussPage() {
  const { t, lang } = useI18n();
  const { user } = useAuth();
  const { discuss } = useSiteSettings();
  const revealRef = useReveal<HTMLDivElement>();
  const [posts, setPosts] = useState<DiscussionPost[]>([]);
  const [reactions, setReactions] = useState<{ like: Set<string>; favorite: Set<string> }>({ like: new Set(), favorite: new Set() });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'discussion' | 'matching'>('discussion');
  const [category, setCategory] = useState<string>('全部');
  const [sort, setSort] = useState<'latest' | 'popular'>('latest');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [rows, userReactions] = await Promise.all([
        fetchDiscussionPosts(),
        user ? fetchUserDiscussionReactions(user.id) : Promise.resolve({ like: new Set<string>(), favorite: new Set<string>() }),
      ]);
      setPosts(rows);
      setReactions(userReactions);
    } catch {
      toast.error(t('内容加载失败，请稍后重试', 'Could not load content. Please retry.'));
    } finally { setLoading(false); }
  }, [user, t]);

  useEffect(() => { window.scrollTo({ top: 0, behavior: 'smooth' }); void load(); }, [load]);

  const filtered = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase();
    const result = posts.filter((post) => (category === '全部' || (post.category || '随想交流') === category)
      && (!needle || `${post.title} ${post.body} ${post.author_name}`.toLocaleLowerCase().includes(needle)));
    if (sort === 'popular') result.sort((a, b) => {
      const aScore = (a.likes_count ?? 0) * 2 + (a.post_comments?.[0]?.count ?? 0);
      const bScore = (b.likes_count ?? 0) * 2 + (b.post_comments?.[0]?.count ?? 0);
      return bScore - aScore || Date.parse(b.created_at) - Date.parse(a.created_at);
    });
    return result;
  }, [posts, category, search, sort]);
  const pageSize = 20;
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const visiblePosts = filtered.slice((page - 1) * pageSize, page * pageSize);
  const content = lang === 'en' && discuss.contentEn ? discuss.contentEn : discuss.content;
  const defaultContent = lang === 'en'
    ? '<p>Share what you have built, ask questions, and discuss with the community.</p>'
    : '<p>在这里分享你的实践、提出你的问题，和社区成员一起讨论。</p>';
  const hasCustomContent = content.trim() !== defaultContent;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 md:px-8 md:py-12" ref={revealRef}>
      <header data-reveal className="border-b border-border pb-6">
        <p className="editorial-label text-accent">{t('社区交流', 'COMMUNITY')}</p>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-medium text-foreground text-balance md:text-4xl">{t('交流与连接', 'Connect & Exchange')}</h1>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">{t('分享你的想法，找到同频的人，让更多可能在这里发生。', 'Share what you are working on and meet people who can help possibilities grow.')}</p>
          </div>
          <Button asChild size="sm" className="gap-1.5 font-mono-label text-xs uppercase tracking-wider">
            <Link to={user ? '/submit/discuss' : '/login'}><PenSquare className="h-3.5 w-3.5" />{t('发布讨论', 'Start a discussion')}</Link>
          </Button>
        </div>
        {activeTab === 'discussion' && hasCustomContent && <div className="project-content mt-5 max-w-3xl text-sm" dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(content) }} />}
      </header>

      <nav className="mt-6 flex gap-6 border-b border-border" aria-label={t('交流与连接栏目', 'Community sections')}>
        <button type="button" onClick={() => setActiveTab('discussion')} aria-current={activeTab === 'discussion' ? 'page' : undefined} className={`border-b-2 px-1 py-3 text-sm transition-colors ${activeTab === 'discussion' ? 'border-accent text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>{t('交流讨论', 'Discussions')}</button>
        <button type="button" onClick={() => setActiveTab('matching')} aria-current={activeTab === 'matching' ? 'page' : undefined} className={`border-b-2 px-1 py-3 text-sm transition-colors ${activeTab === 'matching' ? 'border-accent text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'}`}><UsersRound className="mr-1.5 inline h-4 w-4" />{t('成员匹配', 'Member matching')}</button>
        {user && <button type="button" onClick={() => setActiveTab('matching')} className="ml-auto inline-flex items-center gap-1 py-3 text-xs text-muted-foreground hover:text-accent"><Bell className="h-3.5 w-3.5" />{t('申请与通知', 'Requests & updates')}</button>}
      </nav>

      {activeTab === 'matching' ? <CommunityConnections /> : (
        <section className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1fr)_240px]">
          <div className="min-w-0">
            <div className="flex flex-col gap-3 border-b border-border pb-4 md:flex-row md:items-center md:justify-between">
              <div className="flex flex-wrap gap-2" role="group" aria-label={t('帖子分类', 'Post categories')}>
                {DISCUSSION_CATEGORIES.map((item) => <button key={item} type="button" onClick={() => { setCategory(item); setPage(1); }} aria-pressed={category === item} className={`rounded-full px-3 py-1.5 text-xs transition-colors ${category === item ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'}`}>{lang === 'en' ? CATEGORY_EN[item] : item}</button>)}
              </div>
              <div className="flex gap-2">
                <label className="relative min-w-0 flex-1 md:w-56">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder={t('搜索讨论', 'Search discussions')} className="pl-9" />
                </label>
                <select value={sort} onChange={(e) => setSort(e.target.value as 'latest' | 'popular')} className="h-10 rounded-md border border-input bg-background px-2 text-xs">
                  <option value="latest">{t('最新发布', 'Newest')}</option><option value="popular">{t('热门讨论', 'Popular')}</option>
                </select>
              </div>
            </div>

            {loading ? <div className="space-y-4 py-6">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-28 w-full" />)}</div>
              : visiblePosts.length === 0 ? <p className="py-16 text-center text-sm text-muted-foreground">{t('暂时没有符合条件的讨论。你可以发起第一条分享。', 'No discussions match yet. Start one for the community.')}</p>
                : visiblePosts.map((post) => <PostCard key={post.id} item={post} userId={user?.id} liked={reactions.like.has(post.id)} saved={reactions.favorite.has(post.id)} onChanged={() => void load()} />)}

            {!loading && pageCount > 1 && <div className="flex items-center justify-center gap-4 border-t border-border py-5 text-sm"><Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>{t('上一页', 'Previous')}</Button><span className="text-muted-foreground">{page} / {pageCount}</span><Button variant="outline" size="sm" disabled={page >= pageCount} onClick={() => setPage(page + 1)}>{t('下一页', 'Next')}</Button></div>}
          </div>

          <aside className="hidden lg:block">
            <div className="sticky top-24 border-l border-border pl-5">
              <p className="editorial-label text-accent">{t('社区交流', 'COMMUNITY')}</p>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{t('分享实践、提出问题，也可以在成员匹配中认识有共同方向的人。', 'Share practical work, ask for help, or meet people through member matching.')}</p>
              <button type="button" onClick={() => setActiveTab('matching')} className="mt-4 inline-flex items-center gap-2 text-sm text-accent hover:underline"><UsersRound className="h-4 w-4" />{t('浏览成员匹配', 'Explore member matching')}</button>
            </div>
          </aside>
        </section>
      )}
    </div>
  );
}
