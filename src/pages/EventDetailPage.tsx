import { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Heart, Bookmark, Eye, Calendar, MapPin, Users } from 'lucide-react';
import { useI18n } from '@/contexts/I18nContext';
import { useAuth } from '@/contexts/AuthContext';
import { fetchEventById, getUserInteractions, toggleInteractionV2, incrementContentView, registerEvent, cancelRegistration, getUserRegistrations } from '@/lib/api';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { totalCount } from '@/lib/utils';
import type { EventItem } from '@/types/types';

function formatDate(iso: string, lang: 'zh' | 'en') {
  const d = new Date(iso);
  const month =
    lang === 'en'
      ? ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getMonth()]
      : `${d.getMonth() + 1}月`;
  return `${d.getFullYear()} ${month} ${d.getDate()}, ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export default function EventDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { t, lang } = useI18n();
  const { user, refreshProfile } = useAuth();
  const navigate = useNavigate();

  const [item, setItem] = useState<EventItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [liked, setLiked] = useState(false);
  const [favorited, setFavorited] = useState(false);
  const [registered, setRegistered] = useState(false);
  const [busy, setBusy] = useState(false);
  const [registerDialogOpen, setRegisterDialogOpen] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '', wechat: '', note: '' });
  const [formError, setFormError] = useState('');

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    fetchEventById(id)
      .then(setItem)
      .catch(() => toast.error(t('加载活动失败', 'Failed to load event')))
      .finally(() => setLoading(false));
  }, [id, t]);

  useEffect(() => {
    if (!id) return;
    incrementContentView('event', id)
      .then(() => setItem((prev) => prev ? { ...prev, views: prev.views + 1 } : prev))
      .catch(() => {});
  }, [id]);

  useEffect(() => {
    if (user && id) {
      getUserInteractions(user.id)
        .then((res) => { setLiked(res.like.has(id)); setFavorited(res.favorite.has(id)); })
        .catch(() => {});
      getUserRegistrations(user.id)
        .then((ids) => setRegistered(ids.includes(id)))
        .catch(() => {});
    } else {
      setLiked(false);
      setFavorited(false);
      setRegistered(false);
    }
  }, [user, id]);

  const handleInteraction = useCallback(async (type: 'like' | 'favorite') => {
    if (!user || !item) { toast.error(t('请先登录后再操作', 'Please sign in to interact')); return; }
    try {
      const res = await toggleInteractionV2(user.id, 'event', item.id, type);
      if (type === 'like') setLiked(res.action === 'added');
      else setFavorited(res.action === 'added');
      setItem((prev) => prev ? { ...prev, likes: res.likes, favorites: res.favorites } : prev);
      if (res.action === 'added') {
        toast.success(type === 'like' ? t('已点赞', 'Liked') : t('已收藏', 'Favorited'));
        if (res.actor_xp > 0) {
          toast.success(t(`+${res.actor_xp} XP`, `+${res.actor_xp} XP`));
          refreshProfile().catch(() => {});
        }
      }
    } catch { toast.error(t('操作失败', 'Action failed')); }
  }, [user, item, t, refreshProfile]);

  const resetForm = useCallback(() => {
    setForm({ name: '', phone: '', wechat: '', note: '' });
    setFormError('');
  }, []);

  const openRegisterDialog = useCallback(() => {
    if (!user || !item) { toast.error(t('请先登录后再报名', 'Please sign in to register')); return; }
    resetForm();
    setRegisterDialogOpen(true);
  }, [user, item, resetForm, t]);

  const handleRegister = useCallback(async () => {
    if (!user || !item) { toast.error(t('请先登录后再报名', 'Please sign in to register')); return; }
    if (registered) {
      // 取消报名
      setBusy(true);
      try {
        const res = await cancelRegistration(item.id);
        if (typeof res.registered === 'number') {
          setItem((prev) => prev ? { ...prev, registered: res.registered as number } : prev);
        }
        if (!res.success) {
          if (res.reason === 'not_registered') {
            setRegistered(false);
            toast.error(t('你尚未报名该活动', 'You are not registered for this event'));
          } else {
            toast.error(t('活动不存在或已下线', 'Event not found'));
          }
          setBusy(false);
          return;
        }
        setRegistered(false);
        toast.success(t('已取消报名', 'Registration cancelled'));
      } catch {
        toast.error(t('取消报名失败', 'Cancellation failed'));
      } finally {
        setBusy(false);
      }
      return;
    }

    // 提交报名表单
    const trimmedName = form.name.trim();
    const trimmedPhone = form.phone.trim();
    const trimmedWechat = form.wechat.trim();
    if (!trimmedName) {
      setFormError(t('请填写姓名', 'Please enter your name'));
      return;
    }
    if (!trimmedPhone && !trimmedWechat) {
      setFormError(t('请至少填写电话或微信，方便活动方联系', 'Please enter phone or WeChat'));
      return;
    }
    setFormError('');
    setBusy(true);
    try {
      const res = await registerEvent(item.id, {
        name: trimmedName,
        phone: trimmedPhone,
        wechat: trimmedWechat,
        note: form.note.trim(),
      });
      if (typeof res.registered === 'number') {
        setItem((prev) => prev ? { ...prev, registered: res.registered as number } : prev);
      }
      if (!res.success) {
        if (res.reason === 'already_registered') {
          setRegistered(true);
          toast.error(t('你已报名该活动', 'You already registered'));
        } else if (res.reason === 'full') {
          toast.error(t('名额已满', 'This event is fully booked'));
        } else {
          toast.error(t('活动不存在或已下线', 'Event not found'));
        }
        setBusy(false);
        return;
      }
      setRegistered(true);
      setRegisterDialogOpen(false);
      resetForm();
      toast.success(t('报名成功', 'Registered successfully'));
    } catch {
      toast.error(t('报名失败，请稍后再试', 'Registration failed'));
    } finally {
      setBusy(false);
    }
  }, [user, item, registered, form, resetForm, t]);

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12 md:px-8">
        <Skeleton className="h-6 w-20 bg-muted" />
        <Skeleton className="mt-6 h-10 w-3/4 bg-muted" />
        <Skeleton className="mt-8 aspect-[4/3] w-full bg-muted" />
      </div>
    );
  }

  if (!item) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-20 text-center md:px-8">
        <p className="editorial-label">{t('未找到活动', 'Event not found')}</p>
        <Button variant="outline" className="mt-6" onClick={() => navigate('/events')}>{t('返回城市组局', 'Back to Events')}</Button>
      </div>
    );
  }

  const title = lang === 'en' && item.title_en ? item.title_en : item.title;
  const summary = lang === 'en' && item.summary_en ? item.summary_en : item.summary;
  const city = lang === 'en' && item.city_en ? item.city_en : item.city;
  const theme = lang === 'en' && item.theme_en ? item.theme_en : item.theme;
  const location = lang === 'en' && item.location_en ? item.location_en : item.location;
  const pct = item.capacity > 0 ? Math.min(100, Math.round((item.registered / item.capacity) * 100)) : 0;
  const full = item.registered >= item.capacity;

  return (
    <article className="mx-auto max-w-3xl px-4 py-10 md:px-8 md:py-16">
      <Link to="/events" className="inline-flex items-center gap-1 font-mono-label text-xs uppercase tracking-wider text-muted-foreground hover:text-accent">
        <ArrowLeft className="h-3.5 w-3.5" />
        {t('返回城市组局', 'Back to events')}
      </Link>

      <header className="mt-8">
        <div className="flex flex-wrap items-center gap-2">
          <span className="editorial-label text-accent">{city}</span>
          <span className="border border-border px-2 py-0.5 font-mono-label text-[10px] uppercase tracking-wider text-muted-foreground">{theme}</span>
        </div>
        <h1 className="mt-3 font-display text-3xl font-medium leading-tight tracking-tight text-foreground text-balance md:text-4xl">{title}</h1>
        <p className="mt-4 text-base leading-relaxed text-muted-foreground text-pretty">{summary}</p>
        <div className="mt-6 flex items-center justify-between border-y border-border py-4">
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

      <div className="mt-8 space-y-4 border border-border bg-card p-5">
        <div className="flex items-center gap-2 font-mono-label text-sm text-muted-foreground">
          <Calendar className="h-4 w-4 shrink-0" />
          {formatDate(item.event_date, lang)}
        </div>
        <div className="flex items-center gap-2 font-mono-label text-sm text-muted-foreground">
          <MapPin className="h-4 w-4 shrink-0" />
          {location}
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between font-mono-label text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" />{item.registered}/{item.capacity}</span>
            <span>{pct}%</span>
          </div>
          <Progress value={pct} className="h-1" />
        </div>
        <Button
          onClick={registered ? handleRegister : openRegisterDialog}
          disabled={busy || (!registered && full)}
          variant={registered ? 'outline' : 'default'}
          className="w-full font-mono-label text-xs uppercase tracking-wider"
        >
          {registered ? t('取消报名', 'Cancel registration') : full ? t('名额已满', 'Sold out') : t('立即报名', 'Register now')}
        </Button>
      </div>

      {/* 活动报名表单弹窗 */}
      <Dialog open={registerDialogOpen} onOpenChange={setRegisterDialogOpen}>
        <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display">{t('活动报名', 'Event Registration')}</DialogTitle>
            <DialogDescription className="text-pretty">
              {t('请填写真实信息，方便活动方与你联系。每个活动仅限报名一次。', 'Please fill in your real information so the organizer can reach you. Each event can only be registered once.')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="reg-name" className="font-mono-label text-xs uppercase tracking-wider text-muted-foreground">{t('姓名', 'Name')} *</Label>
              <Input id="reg-name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className="px-3" placeholder={t('你的姓名', 'Your name')} />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="reg-phone" className="font-mono-label text-xs uppercase tracking-wider text-muted-foreground">{t('电话', 'Phone')}</Label>
                <Input id="reg-phone" type="tel" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} className="px-3" placeholder={t('手机号码', 'Phone number')} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="reg-wechat" className="font-mono-label text-xs uppercase tracking-wider text-muted-foreground">{t('微信', 'WeChat')}</Label>
                <Input id="reg-wechat" value={form.wechat} onChange={(e) => setForm((f) => ({ ...f, wechat: e.target.value }))} className="px-3" placeholder={t('微信号', 'WeChat ID')} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="reg-note" className="font-mono-label text-xs uppercase tracking-wider text-muted-foreground">{t('备注', 'Note')}</Label>
              <Textarea id="reg-note" value={form.note} onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} className="px-3" rows={3} placeholder={t('其他需要说明的事项', 'Anything else')} />
            </div>
            {formError && <p className="text-sm text-destructive text-pretty">{formError}</p>}
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1 font-mono-label text-xs uppercase tracking-wider" onClick={() => setRegisterDialogOpen(false)} disabled={busy}>
                {t('取消', 'Cancel')}
              </Button>
              <Button className="flex-1 font-mono-label text-xs uppercase tracking-wider" onClick={handleRegister} disabled={busy}>
                {busy ? t('提交中…', 'Submitting…') : t('确认报名', 'Confirm')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </article>
  );
}
