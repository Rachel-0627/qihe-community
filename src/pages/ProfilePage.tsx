import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { LogOut, Heart, Bookmark, Calendar, Award, Sparkles, Settings, CheckCircle2, Camera, Pencil, KeyRound, TrendingUp, Cpu } from 'lucide-react';
import { useI18n } from '@/contexts/I18nContext';
import { useAuth } from '@/contexts/AuthContext';
import { useAIAssistant } from '@/contexts/AIAssistantContext';
import { useReveal } from '@/hooks/useReveal';
import { fetchLevelConfig, fetchEvents, getUserRegistrations, checkIn, fetchTodayCheckin, TIER_LABELS, uploadAvatar, getRemainingUnlockCount } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { toast } from 'sonner';
import type { LevelConfig, EventItem, UnlockCountResult } from '@/types/types';

export default function ProfilePage() {
  const { t, lang } = useI18n();
  const { user, profile, signOut, refreshProfile, updateProfile } = useAuth();
  const { setOpen: setAssistantOpen } = useAIAssistant();
  const navigate = useNavigate();
  const revealRef = useReveal<HTMLDivElement>();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [levels, setLevels] = useState<LevelConfig[]>([]);
  const [myEvents, setMyEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [unlockCount, setUnlockCount] = useState<UnlockCountResult>({ total: 0, used: 0, remaining: 0 });

  const [checkedIn, setCheckedIn] = useState(false);
  const [checkInLoading, setCheckInLoading] = useState(false);

  const [isEditing, setIsEditing] = useState(false);
  const [nickname, setNickname] = useState('');
  const [avatarLoading, setAvatarLoading] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);

  useEffect(() => {
    if (!user) { navigate('/login', { state: { from: '/profile' }, replace: true }); return; }
    Promise.all([fetchLevelConfig(), fetchEvents(), getRemainingUnlockCount()])
      .then(([l, ev, unlock]) => {
        setLevels(l);
        setUnlockCount(unlock);
        if (user) getUserRegistrations(user.id).then((ids) => {
          setMyEvents(ev.filter((e) => ids.includes(e.id)));
        }).catch(() => {});
      })
      .catch(() => {})
      .finally(() => setLoading(false));

    fetchTodayCheckin(user.id).then((row) => setCheckedIn(!!row)).catch(() => {});
  }, [user, navigate]);

  useEffect(() => {
    if (profile) setNickname(profile.nickname || '');
  }, [profile]);

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (!file.type.startsWith('image/')) {
      toast.error(t('请选择图片文件', 'Please select an image file'));
      return;
    }
    setAvatarLoading(true);
    try {
      const url = await uploadAvatar(user.id, file);
      await updateProfile({ avatar_url: url });
      toast.success(t('头像更新成功', 'Avatar updated'));
    } catch {
      toast.error(t('头像上传失败', 'Avatar upload failed'));
    } finally {
      setAvatarLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSaveProfile = async () => {
    if (!user) return;
    const trimmed = nickname.trim();
    if (!trimmed) {
      toast.error(t('昵称不能为空', 'Nickname cannot be empty'));
      return;
    }
    setProfileSaving(true);
    try {
      await updateProfile({ nickname: trimmed });
      setIsEditing(false);
      toast.success(t('昵称已保存', 'Nickname saved'));
    } catch {
      toast.error(t('保存失败', 'Save failed'));
    } finally {
      setProfileSaving(false);
    }
  };

  const handleCheckIn = async () => {
    if (!user || checkedIn || checkInLoading) return;
    setCheckInLoading(true);
    try {
      const result = await checkIn(user.id);
      if (result.success) {
        toast.success(t(`签到成功，获得 ${result.xp_awarded} XP`, `Check-in successful, +${result.xp_awarded} XP`));
        setCheckedIn(true);
        await refreshProfile();
      } else if (result.already_checked_in) {
        toast.info(t('今天已经签到过了', 'Already checked in today'));
        setCheckedIn(true);
      }
    } catch {
      toast.error(t('签到失败，请稍后再试', 'Check-in failed, please try again'));
    } finally {
      setCheckInLoading(false);
    }
  };

  if (!user || !profile) return null;

  const currentLevel = levels.find((l) => l.level === profile.level);
  const nextLevel = levels.find((l) => l.level === profile.level + 1);
  const prevThreshold = currentLevel?.xp_threshold ?? 0;
  const nextThreshold = nextLevel?.xp_threshold ?? profile.xp;
  const xpProgress = nextLevel ? Math.min(100, Math.round(((profile.xp - prevThreshold) / (nextThreshold - prevThreshold)) * 100)) : 100;
  const tierLabel = TIER_LABELS[profile.member_tier];

  const identityLabels: Record<string, { zh: string; en: string }> = {
    user: { zh: '用户', en: 'User' },
    creator: { zh: '创作者', en: 'Creator' },
    builder: { zh: '构建者', en: 'Builder' },
    contributor: { zh: '贡献者', en: 'Contributor' },
  };
  const identity = identityLabels[profile.community_identity];

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 md:px-8 md:py-16">
      <div className="flex items-center justify-between">
        <p className="editorial-label text-accent">{t('个人中心', 'Profile')}</p>
        <Button variant="ghost" size="sm" onClick={() => { signOut(); navigate('/'); }} className="font-mono-label text-xs text-muted-foreground hover:text-foreground">
          <LogOut className="mr-1 h-3.5 w-3.5" />
          {t('退出登录', 'Sign out')}
        </Button>
      </div>

      <div ref={revealRef} className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[320px_1fr]">
        {/* Profile card */}
        <div className="magazine-card flex h-full flex-col p-6">
          <div className="flex items-center gap-4">
            <div className="relative shrink-0">
              <Avatar className="h-16 w-16">
                <AvatarImage src={profile.avatar_url ?? undefined} alt={profile.nickname || profile.username || ''} />
                <AvatarFallback className="bg-primary text-xl font-medium text-primary-foreground">
                  {(profile.nickname || profile.username || 'U')[0].toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={avatarLoading}
                className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow-sm transition-colors hover:text-foreground disabled:opacity-50"
                aria-label={t('更换头像', 'Change avatar')}
              >
                <Camera className="h-3 w-3" />
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleAvatarChange}
                className="sr-only"
              />
            </div>
            <div className="min-w-0 flex-1">
              {isEditing ? (
                <div className="space-y-2">
                  <Label htmlFor="nickname" className="font-mono-label text-xs uppercase tracking-wider text-muted-foreground">{t('昵称', 'Nickname')}</Label>
                  <Input
                    id="nickname"
                    value={nickname}
                    onChange={(e) => setNickname(e.target.value)}
                    placeholder={t('输入昵称', 'Enter nickname')}
                    className="px-2 text-sm"
                  />
                </div>
              ) : (
                <>
                  <h1 className="font-display text-xl font-medium text-foreground truncate">{profile.nickname || profile.username}</h1>
                  <p className="mt-1 font-mono-label text-xs text-muted-foreground">{identity ? (lang === 'en' ? identity.en : identity.zh) : ''}</p>
                </>
              )}
            </div>
            <div className="shrink-0">
              {isEditing ? (
                <div className="flex gap-1">
                  <Button size="sm" className="font-mono-label text-xs" onClick={handleSaveProfile} disabled={profileSaving}>{t('保存', 'Save')}</Button>
                  <Button variant="outline" size="sm" className="font-mono-label text-xs" onClick={() => { setIsEditing(false); setNickname(profile.nickname || ''); }}>{t('取消', 'Cancel')}</Button>
                </div>
              ) : (
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setIsEditing(true)} aria-label={t('编辑昵称', 'Edit nickname')}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </div>

          <div className="mt-6 space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <span className="font-mono-label text-xs uppercase tracking-wider text-muted-foreground">{t('用户等级', 'User Level')}</span>
              <span className="font-display text-lg font-medium text-accent">Lv.{profile.level}</span>
            </div>
            <div className="flex items-center justify-between border-b border-border pb-3">
              <span className="font-mono-label text-xs uppercase tracking-wider text-muted-foreground">{t('会员等级', 'Member Tier')}</span>
              <span className="font-mono-label text-xs uppercase tracking-wider text-foreground">{lang === 'en' ? tierLabel.en : tierLabel.zh}</span>
            </div>
            <div className="flex items-center justify-between border-b border-border pb-3">
              <span className="font-mono-label text-xs uppercase tracking-wider text-muted-foreground">{t('社区身份', 'Community Identity')}</span>
              <span className="font-mono-label text-xs uppercase tracking-wider text-foreground">{identity ? (lang === 'en' ? identity.en : identity.zh) : ''}</span>
            </div>
          </div>

          {/* XP progress */}
          <div className="mt-auto pt-6">
            <div className="flex items-center justify-between font-mono-label text-xs text-muted-foreground">
              <span>{profile.xp} XP</span>
              <span>{nextLevel ? `${nextThreshold} XP` : t('满级', 'Max') }</span>
            </div>
            <Progress value={xpProgress} className="mt-2 h-1.5" />
            <p className="mt-2 text-xs text-muted-foreground text-pretty">
              {nextLevel ? t(`距离 Lv.${nextLevel.level} 还需 ${nextThreshold - profile.xp} XP`, `${nextThreshold - profile.xp} XP to Lv.${nextLevel.level}`) : t('已达最高等级', 'Maximum level reached')}
            </p>
            <Button
              onClick={handleCheckIn}
              disabled={checkedIn || checkInLoading}
              className="mt-4 w-full gap-1.5 font-mono-label text-xs uppercase tracking-wider"
            >
              {checkedIn ? <CheckCircle2 className="h-3.5 w-3.5" /> : null}
              {checkedIn ? t('今日已签到', 'Checked in today') : t('每日签到', 'Daily check-in')}
            </Button>
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-6 min-w-0">
          {/* Current level card */}
          <div className="magazine-card p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-accent" />
                <h2 className="font-display text-lg font-medium">{t('我的等级', 'My Level')}</h2>
              </div>
              <span className="font-display text-2xl font-medium text-accent">Lv.{profile.level}</span>
            </div>
            <div className="mt-4 flex items-center justify-between border-b border-border pb-4">
              <div>
                <p className="font-mono-label text-xs uppercase tracking-wider text-muted-foreground">{t('当前称号', 'Current Title')}</p>
                <p className="mt-1 font-display text-base font-medium text-foreground">{lang === 'en' && currentLevel?.title_en ? currentLevel.title_en : currentLevel?.title}</p>
              </div>
              <div className="text-right">
                <p className="font-mono-label text-xs uppercase tracking-wider text-muted-foreground">{t('会员等级', 'Member Tier')}</p>
                <p className="mt-1 font-mono-label text-xs uppercase tracking-wider text-foreground">{lang === 'en' ? tierLabel.en : tierLabel.zh}</p>
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <KeyRound className="h-4 w-4 text-muted-foreground" />
                <span className="font-mono-label text-xs uppercase tracking-wider text-muted-foreground">{t('剩余免费解锁次数', 'Free unlocks left')}</span>
              </div>
              <span className={`font-display text-lg font-medium ${unlockCount.remaining > 0 ? 'text-accent' : 'text-destructive'}`}>
                {unlockCount.remaining}
              </span>
            </div>
            <div className="mt-4">
              <div className="flex items-center justify-between font-mono-label text-xs text-muted-foreground">
                <span>{profile.xp} XP</span>
                <span>{nextLevel ? `${nextThreshold} XP` : t('满级', 'Max')}</span>
              </div>
              <Progress value={xpProgress} className="mt-2 h-1.5" />
              <p className="mt-2 text-xs text-muted-foreground text-pretty">
                {nextLevel ? t(`距离 Lv.${nextLevel.level} 还需 ${nextThreshold - profile.xp} XP`, `${nextThreshold - profile.xp} XP to Lv.${nextLevel.level}`) : t('已达最高等级', 'Maximum level reached')}
              </p>
            </div>
          </div>

          {/* Quick links */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <QuickLink icon={<Award className="h-4 w-4" />} label={t('我的权益', 'My Benefits')} to="/benefits" />
            <QuickLink icon={<Sparkles className="h-4 w-4" />} label={t('AI 助手', 'AI Assistant')} onClick={() => setAssistantOpen(true)} />
            <QuickLink icon={<Cpu className="h-4 w-4" />} label={t('生图配置', 'Image Gen Config')} to="/profile/image-provider" />
            {profile.role === 'admin' && <QuickLink icon={<Settings className="h-4 w-4" />} label={t('后台管理', 'Admin')} to="/admin" />}
          </div>

          {/* My events */}
          <div className="magazine-card p-6">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-accent" />
              <h2 className="font-display text-lg font-medium">{t('我报名的活动', 'My Events')}</h2>
            </div>
            {loading ? (
              <div className="mt-4 space-y-3">
                {Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-14 w-full bg-muted" />)}
              </div>
            ) : myEvents.length === 0 ? (
              <p className="mt-4 text-sm text-muted-foreground text-pretty">{t('你还没有报名任何活动。', 'You haven\'t registered for any events yet.')}</p>
            ) : (
              <ul className="mt-4 divide-y divide-border">
                {myEvents.map((e) => (
                  <li key={e.id} className="flex items-center justify-between py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">{lang === 'en' && e.title_en ? e.title_en : e.title}</p>
                      <p className="mt-0.5 font-mono-label text-xs text-muted-foreground">{lang === 'en' ? e.city_en : e.city} · {new Date(e.event_date).toLocaleDateString()}</p>
                    </div>
                    <span className="shrink-0 font-mono-label text-xs text-accent">{t('已报名', 'Registered')}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* XP rules */}
          <div className="border border-border bg-muted/40 p-4">
            <div className="flex items-center gap-2">
              <Heart className="h-4 w-4 shrink-0 text-muted-foreground" />
              <p className="font-mono-label text-xs uppercase tracking-wider text-muted-foreground">{t('经验值规则', 'XP Rules')}</p>
            </div>
            <p className="mt-2 text-xs text-muted-foreground text-pretty">
              {t('每日首次签到 +10、点赞作品 +1、收藏作品 +1；作品被他人点赞 +3、被收藏 +6。同一天内重复签到/点赞/收藏不再重复增加经验值。', 'Daily first check-in +10, like +1, favorite +1; got liked +3, got favorited +6. Repeated check-ins/likes/favorites on the same day will not add extra XP.')}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function QuickLink({ icon, label, to, onClick }: { icon: React.ReactNode; label: string; to?: string; onClick?: () => void }) {
  const className = 'magazine-card flex h-full flex-col gap-3 p-4 text-left transition-colors hover:text-accent';
  const content = (
    <>
      <span className="text-accent">{icon}</span>
      <span className="font-mono-label text-xs uppercase tracking-wider text-foreground">{label}</span>
    </>
  );
  if (to) {
    return (
      <Link to={to} className={className}>
        {content}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} className={className}>
      {content}
    </button>
  );
}