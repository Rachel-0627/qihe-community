import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Heart, Eye, ExternalLink, Lock, Bookmark, KeyRound } from 'lucide-react';
import { useI18n } from '@/contexts/I18nContext';
import { useAuth } from '@/contexts/AuthContext';
import { fetchProjectById, fetchProjectContent, getUserInteractions, toggleInteractionV2, canAccessContent, ACCESS_LABELS, incrementContentView, getRemainingUnlockCount, unlockProjectWithFreeQuota } from '@/lib/api';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { totalCount } from '@/lib/utils';
import { injectHeadingIds } from '@/lib/contentHeadings';
import ChapterToc from '@/components/common/ChapterToc';
import CommentsSection from '@/components/common/CommentsSection';
import ShareDialog, { ShareButton } from '@/components/common/ShareDialog';
import type { ProjectItem, ContentAccess, UnlockCountResult } from '@/types/types';

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { t, lang } = useI18n();
  const { user, profile, refreshProfile } = useAuth();
  const navigate = useNavigate();

  const [item, setItem] = useState<ProjectItem | null>(null);
  // 正文与外链不随列表下发，解锁后单独向服务端索取
  const [content, setContent] = useState<{ zh: string; en: string; url: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [liked, setLiked] = useState(false);
  const [favorited, setFavorited] = useState(false);
  const [unlockDialogOpen, setUnlockDialogOpen] = useState(false);
  const [unlockCount, setUnlockCount] = useState<UnlockCountResult>({ total: 0, used: 0, remaining: 0 });
  const [unlockBusy, setUnlockBusy] = useState(false);
  const [posterOpen, setPosterOpen] = useState(false);

  const tier = profile?.member_tier || 'guest';

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    fetchProjectById(id)
      .then(setItem)
      .catch(() => toast.error(t('加载项目失败', 'Failed to load project')))
      .finally(() => setLoading(false));
  }, [id, t]);

  useEffect(() => {
    if (!id) return;
    incrementContentView('project', id)
      .then(() => setItem((prev) => prev ? { ...prev, views: prev.views + 1 } : prev))
      .catch(() => {});
  }, [id]);

  // 有权限时才去取正文；服务端会再判定一次，前端拿不到不该看的内容
  useEffect(() => {
    // 注意：不能用下方的 locked 变量 —— 它在组件后半段才声明，
    // 依赖数组在 render 期求值会撞上暂时性死区，这里用 tier 自行判定
    if (!id || !item || !canAccessContent(tier, item.access_level)) { setContent(null); return; }
    let cancelled = false;
    fetchProjectContent(id)
      .then((res) => {
        if (cancelled || !res.allowed) return;
        setContent({ zh: res.content || '', en: res.content_en || '', url: res.external_url || '' });
      })
      .catch(() => {
        if (!cancelled) toast.error(t('项目正文加载失败', 'Failed to load project content'));
      });
    return () => { cancelled = true; };
  }, [id, item, tier, t]);

  useEffect(() => {
    if (user && id) {
      getUserInteractions(user.id)
        .then((res) => { setLiked(res.like.has(id as string)); setFavorited(res.favorite.has(id as string)); })
        .catch(() => {});
    }
  }, [user, id]);

  const handleLike = useCallback(async () => {
    if (!user || !item) { toast.error(t('请先登录后再操作', 'Please sign in first')); return; }
    try {
      const res = await toggleInteractionV2(user.id, 'project', item.id, 'like');
      setLiked(res.action === 'added');
      setItem((prev) => prev ? { ...prev, likes: res.likes } : prev);
      if (res.action === 'added' && res.actor_xp > 0) {
        toast.success(t(`+${res.actor_xp} XP`, `+${res.actor_xp} XP`));
        refreshProfile().catch(() => {});
      }
    } catch { toast.error(t('操作失败', 'Action failed')); }
  }, [user, item, t, refreshProfile]);

  const handleFavorite = useCallback(async () => {
    if (!user || !item) { toast.error(t('请先登录后再操作', 'Please sign in first')); return; }
    try {
      const res = await toggleInteractionV2(user.id, 'project', item.id, 'favorite');
      setFavorited(res.action === 'added');
      setItem((prev) => prev ? { ...prev, favorites: res.favorites } : prev);
      if (res.action === 'added' && res.actor_xp > 0) {
        toast.success(t(`+${res.actor_xp} XP`, `+${res.actor_xp} XP`));
        refreshProfile().catch(() => {});
      }
    } catch { toast.error(t('操作失败', 'Action failed')); }
  }, [user, item, t, refreshProfile]);

  const loadUnlockCount = useCallback(async () => {
    if (!user) return;
    try {
      const res = await getRemainingUnlockCount();
      setUnlockCount(res);
    } catch { /* 静默失败 */ }
  }, [user]);

  const externalUrl = useMemo(() => normalizeExternalUrl(content?.url), [content?.url]);

  const title = lang === 'en' && item?.title_en ? item.title_en : (item?.title ?? '');
  const summary = lang === 'en' && item?.summary_en ? item.summary_en : (item?.summary ?? '');
  const scene = lang === 'en' && item?.scene_en ? item.scene_en : (item?.scene ?? '');
  const maturity = lang === 'en' && item?.maturity_en ? item.maturity_en : (item?.maturity ?? '');
  const rawContent = lang === 'en' && content?.en ? content.en : (content?.zh ?? '');
  const { html: processedContent, headings } = useMemo(() => injectHeadingIds(rawContent), [rawContent]);
  const accessLabel = item ? ACCESS_LABELS[item.access_level as ContentAccess] : undefined;
  const accessText = accessLabel ? (lang === 'en' ? accessLabel.en : accessLabel.zh) : '';
  const locked = item ? !canAccessContent(tier, item.access_level) : false;

  const openUnlockDialog = useCallback(async () => {
    if (!user) { toast.error(t('请先登录后再操作', 'Please sign in first')); return; }
    await loadUnlockCount();
    setUnlockDialogOpen(true);
  }, [user, loadUnlockCount, t]);

  const handleUnlock = useCallback(async () => {
    if (!user || !item) return;
    setUnlockBusy(true);
    try {
      const res = await unlockProjectWithFreeQuota(item.id);
      if (res.success) {
        toast.success(t('解锁成功', 'Unlocked successfully'));
        setUnlockDialogOpen(false);
        // 重新拉取正文
        const contentRes = await fetchProjectContent(item.id);
        if (contentRes.allowed) {
          setContent({ zh: contentRes.content || '', en: contentRes.content_en || '', url: contentRes.external_url || '' });
        }
        await loadUnlockCount();
      } else if (res.reason === 'no_quota') {
        toast.error(t('免费解锁次数已用完，升级等级可获取更多额度', 'Free unlocks used up. Upgrade to get more.'));
        await loadUnlockCount();
      } else if (res.reason === 'not_authenticated') {
        toast.error(t('请先登录后再操作', 'Please sign in first'));
      } else {
        toast.error(t('解锁失败，请稍后再试', 'Unlock failed'));
      }
    } catch {
      toast.error(t('解锁失败，请稍后再试', 'Unlock failed'));
    } finally {
      setUnlockBusy(false);
    }
  }, [user, item, loadUnlockCount, t]);

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
        <p className="editorial-label">{t('未找到项目', 'Project not found')}</p>
        <Button variant="outline" className="mt-6" onClick={() => navigate('/projects')}>{t('返回项目库', 'Back to Projects')}</Button>
      </div>
    );
  }

  return (
    <article className="mx-auto max-w-3xl px-4 py-10 md:px-8 md:py-16">
      <Link to="/projects" className="inline-flex items-center gap-1 font-mono-label text-xs uppercase tracking-wider text-muted-foreground hover:text-accent">
        <ArrowLeft className="h-3.5 w-3.5" />
        {t('返回项目库', 'Back to projects')}
      </Link>

      <header className="mt-8">
        <div className="flex flex-wrap items-center gap-2">
          <span className="editorial-label text-accent">{scene}</span>
          <span className="font-mono-label text-xs text-muted-foreground">· {maturity}</span>
          <span className="border border-border px-2 py-0.5 font-mono-label text-[10px] uppercase tracking-wider text-muted-foreground">
            {accessText}
          </span>
          {item.is_hot && (
            <span className="border border-accent bg-accent px-2 py-0.5 font-mono-label text-[10px] uppercase tracking-wider text-accent-foreground">
              {t('热门', 'Hot')}
            </span>
          )}
        </div>
        <h1 className="mt-3 font-display text-3xl font-medium leading-tight tracking-tight text-foreground text-balance md:text-4xl">{title}</h1>
        <p className="mt-4 text-base leading-relaxed text-muted-foreground text-pretty">{summary}</p>
        <div className="mt-6 flex items-center justify-between border-y border-border py-4">
          <div className="flex items-center gap-4">
            <button type="button" onClick={handleLike} className={`flex items-center gap-1.5 font-mono-label text-xs transition-colors ${liked ? 'text-accent' : 'text-muted-foreground hover:text-foreground'}`}>
              <Heart className={`h-4 w-4 ${liked ? 'fill-current' : ''}`} />{totalCount(item.likes, item.base_likes)}
            </button>
            <button type="button" onClick={handleFavorite} className={`flex items-center gap-1.5 font-mono-label text-xs transition-colors ${favorited ? 'text-accent' : 'text-muted-foreground hover:text-foreground'}`}>
              <Bookmark className={`h-4 w-4 ${favorited ? 'fill-current' : ''}`} />{totalCount(item.favorites, item.base_favorites)}
            </button>
            <span className="flex items-center gap-1.5 font-mono-label text-xs text-muted-foreground">
              <Eye className="h-4 w-4" />{totalCount(item.views, item.base_views)}
            </span>
          </div>
          {externalUrl && (
            <Button asChild variant="outline" size="sm" className="h-8 gap-1 border-border px-3 font-mono-label text-[10px] uppercase tracking-wider">
              <a href={externalUrl} target="_blank" rel="noreferrer">
                <ExternalLink className="h-3.5 w-3.5" />{t('访问项目', 'Visit project')}
              </a>
            </Button>
          )}
          <ShareButton onClick={() => setPosterOpen(true)} />
        </div>
      </header>

      {item.cover_url && (
        <div className="mt-8 overflow-hidden border border-border bg-card">
          <div className="bg-[#181a1e] p-2 md:p-[10px]">
            <img
              src={item.cover_url}
              alt={title}
              loading="lazy"
              className="w-full rounded-md border border-[rgba(235,234,227,.09)] object-cover brightness-[.9] saturate-[.9]"
            />
          </div>
        </div>
      )}

      {locked ? (
        <div className="mt-10 flex flex-col items-center gap-4 border border-border bg-muted/40 px-6 py-12 text-center">
          <Lock className="h-8 w-8 text-muted-foreground" />
          <p className="font-display text-lg text-foreground">{t('该项目需要更高会员等级', 'This project requires a higher member tier')}</p>
          <p className="max-w-md text-sm text-muted-foreground text-pretty">{t('升级会员或使用当前等级的免费解锁额度查看完整项目内容。', 'Upgrade your membership or use your free unlock quota for this level.')}</p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Button onClick={openUnlockDialog} className="gap-1.5 font-mono-label text-xs uppercase tracking-wider">
              <KeyRound className="h-3.5 w-3.5" />
              {t('使用免费额度解锁', 'Unlock with free quota')}
            </Button>
            <Link to="/benefits">
              <Button variant="outline" className="font-mono-label text-xs uppercase tracking-wider">{t('查看会员权益', 'View benefits')}</Button>
            </Link>
          </div>
        </div>
      ) : (
        <>
          <div className="relative mt-10">
            <div className="flex gap-12">
              <div className="min-w-0 flex-1">
                <div className="space-y-6">
                  <div
                    id="project-content"
                    className="project-content"
                    dangerouslySetInnerHTML={{ __html: processedContent }}
                  />
                  {item.video_url && (
                    <div className="aspect-video w-full overflow-hidden border border-border">
                      <video src={item.video_url} controls className="h-full w-full" />
                    </div>
                  )}
                </div>
              </div>
              <ChapterToc headings={headings} contentSelector="#project-content" className="w-56 shrink-0" />
            </div>
          </div>
          <CommentsSection />
        </>
      )}

      {/* 解锁确认弹窗 */}
      <Dialog open={unlockDialogOpen} onOpenChange={setUnlockDialogOpen}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display">{t('解锁付费项目', 'Unlock paid project')}</DialogTitle>
            <DialogDescription className="text-pretty">
              {t('确认使用一次免费解锁额度查看该项目完整内容？解锁后该项目将永久对你可见。', 'Use one free unlock quota to view the full content? This project will be permanently visible to you after unlocking.')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center justify-between border border-border bg-muted/30 px-4 py-3">
              <span className="font-mono-label text-xs uppercase tracking-wider text-muted-foreground">{t('当前等级免费额度', 'Current tier quota')}</span>
              <span className="font-display text-lg font-medium text-foreground">{unlockCount.total}</span>
            </div>
            <div className="flex items-center justify-between border border-border bg-muted/30 px-4 py-3">
              <span className="font-mono-label text-xs uppercase tracking-wider text-muted-foreground">{t('已使用', 'Used')}</span>
              <span className="font-display text-lg font-medium text-foreground">{unlockCount.used}</span>
            </div>
            <div className="flex items-center justify-between border border-border bg-muted/30 px-4 py-3">
              <span className="font-mono-label text-xs uppercase tracking-wider text-muted-foreground">{t('剩余', 'Remaining')}</span>
              <span className={`font-display text-lg font-medium ${unlockCount.remaining > 0 ? 'text-accent' : 'text-destructive'}`}>{unlockCount.remaining}</span>
            </div>
            {unlockCount.remaining === 0 ? (
              <div className="text-center text-sm text-muted-foreground text-pretty">
                {t('免费解锁次数已用完，提升等级可获得更多额度。', 'Free unlocks used up. Upgrade your level to get more.')}
              </div>
            ) : null}
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1 font-mono-label text-xs uppercase tracking-wider" onClick={() => setUnlockDialogOpen(false)} disabled={unlockBusy}>
                {t('取消', 'Cancel')}
              </Button>
              <Button className="flex-1 font-mono-label text-xs uppercase tracking-wider" onClick={handleUnlock} disabled={unlockBusy || unlockCount.remaining === 0}>
                {unlockBusy ? t('解锁中…', 'Unlocking…') : t('确认解锁', 'Confirm unlock')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <ShareDialog
        open={posterOpen}
        onOpenChange={setPosterOpen}
        title={title}
        shareUrl={`${typeof window !== 'undefined' ? window.location.origin : ''}/projects/${item.id}`}
      />
    </article>
  );
}

function normalizeExternalUrl(url?: string | null): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  // 如果用户输入的链接缺少协议，浏览器会把它当作相对路径，导致无法跳转。
  if (!/^https?:\/\//i.test(trimmed) && !trimmed.startsWith('/')) {
    return `https://${trimmed}`;
  }
  return trimmed;
}
