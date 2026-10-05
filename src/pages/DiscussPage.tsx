import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { PenSquare } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useI18n } from '@/contexts/I18nContext';
import { useSiteSettings } from '@/contexts/SiteSettingsContext';
import { useReveal } from '@/hooks/useReveal';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import PostCard from '@/components/discuss/PostCard';
import { fetchDiscussionPosts } from '@/lib/discussionApi';
import type { DiscussionPost } from '@/types/types';

export default function DiscussPage() {
  const { t, lang } = useI18n();
  const { user } = useAuth();
  const { discuss } = useSiteSettings();
  const revealRef = useReveal<HTMLDivElement>();

  const [posts, setPosts] = useState<DiscussionPost[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { window.scrollTo({ top: 0, behavior: 'smooth' }); }, []);

  const load = useCallback(() => {
    setLoading(true);
    fetchDiscussionPosts()
      .then(setPosts)
      .catch(() => toast.error(t('帖子加载失败', 'Failed to load posts')))
      .finally(() => setLoading(false));
  }, [t]);

  useEffect(load, [load]);

  const content = lang === 'en' && discuss.contentEn ? discuss.contentEn : discuss.content;

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 md:px-8 md:py-16" ref={revealRef}>
      <div data-reveal className="border-b border-border pb-6">
        <p className="editorial-label text-accent">{lang === 'en' ? 'Discussion' : '分享讨论区'}</p>
        <h1 className="mt-2 font-display text-3xl font-medium text-foreground text-balance md:text-4xl">
          {lang === 'en' ? 'Share & Discuss' : '分享讨论区'}
        </h1>
      </div>

      {/* 后台可编辑的说明照旧保留：它是「规则」，下面的帖子是「内容」，两者不冲突 */}
      <div
        data-reveal
        className="project-content mt-8"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: content }}
      />

      <div data-reveal className="mt-12 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-8">
        {/* 未登录也显示，点了去登录页，这是这个板块最自然的注册入口 */}
        <Button asChild size="sm" className="gap-1.5 font-mono-label text-xs uppercase tracking-wider">
          <Link to={user ? '/submit/discuss' : '/login'}>
            <PenSquare className="h-3.5 w-3.5" />
            {t('发布', 'Post')}
          </Link>
        </Button>
      </div>

      <div className="mt-2">
        {loading ? (
          <div className="space-y-4 py-6">
            {[0, 1, 2].map((i) => <Skeleton key={i} className="h-24 w-full" />)}
          </div>
        ) : posts.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted-foreground">
            {t('还没有人发帖，来发第一条。', 'No posts yet — be the first.')}
          </p>
        ) : (
          posts.map((p) => <PostCard key={p.id} item={p} />)
        )}
      </div>
    </div>
  );
}
