import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Check, X, Lock, ArrowLeft, Award, Sparkles, User } from 'lucide-react';
import { useI18n } from '@/contexts/I18nContext';
import { useAuth } from '@/contexts/AuthContext';
import { useReveal } from '@/hooks/useReveal';
import { fetchMemberBenefits, fetchLevelConfig, TIER_LABELS } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import type { MemberBenefit, MemberTier, LevelConfig } from '@/types/types';

const TIERS: MemberTier[] = ['guest', 'explorer', 'member', 'pro'];

export default function BenefitsPage() {
  const { t, lang } = useI18n();
  const { profile } = useAuth();
  const revealRef = useReveal<HTMLDivElement>();

  const [benefits, setBenefits] = useState<MemberBenefit[]>([]);
  const [levels, setLevels] = useState<LevelConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const currentTier = profile?.member_tier || 'guest';

  useEffect(() => {
    Promise.all([fetchMemberBenefits(), fetchLevelConfig()])
      .then(([b, l]) => { setBenefits(b); setLevels(l); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Group benefits by benefit_key across tiers
  const benefitKeys = Array.from(new Set(benefits.map((b) => b.benefit_key)));
  const matrix = benefitKeys.map((key) => {
    const row = benefits.filter((b) => b.benefit_key === key);
    const label = row[0] ? (lang === 'en' && row[0].benefit_label_en ? row[0].benefit_label_en : row[0].benefit_label) : key;
    const cells = TIERS.map((tier) => row.find((r) => r.tier === tier));
    return { key, label, cells };
  });

  const currentBenefits = benefits.filter((b) => b.tier === currentTier && b.enabled);

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 md:px-8 md:py-16">
      <div className="flex items-center justify-between">
        <div>
          <p className="editorial-label text-accent">{t('我的权益', 'My Benefits')}</p>
          <h1 className="mt-2 font-display text-3xl font-medium tracking-tight text-foreground text-balance md:text-4xl">{t('会员权益与等级', 'Membership & Levels')}</h1>
        </div>
        <Button variant="outline" size="sm" asChild className="hidden font-mono-label text-xs sm:inline-flex">
          <Link to="/profile"><ArrowLeft className="mr-1 h-3.5 w-3.5" />{t('返回个人中心', 'Back to Profile')}</Link>
        </Button>
      </div>

      {profile ? (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatusCard icon={<User className="h-4 w-4" />} label={t('用户等级', 'User Level')} value={`Lv.${profile.level}`} />
          <StatusCard icon={<Award className="h-4 w-4" />} label={t('会员等级', 'Member Tier')} value={lang === 'en' ? TIER_LABELS[profile.member_tier].en : TIER_LABELS[profile.member_tier].zh} />
          <StatusCard icon={<Sparkles className="h-4 w-4" />} label={t('社区身份', 'Community Identity')} value={profile.community_identity} />
        </div>
      ) : (
        <div className="mt-6 flex items-center gap-3 border border-border bg-muted/40 p-5">
          <Lock className="h-5 w-5 shrink-0 text-muted-foreground" />
          <p className="text-sm text-muted-foreground text-pretty">{t('登录后即可查看你当前的等级与权益状态。', 'Sign in to view your current level and benefits.')}</p>
        </div>
      )}

      {/* XP rules */}
      <section className="mt-10">
        <h2 className="font-display text-xl font-medium">{t('经验值获取规则', 'XP Rules')}</h2>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <XpRule title={t('每日签到', 'Daily Check-in')} value={t('+10 XP', '+10 XP')} desc={t('每天首次进入网站并签到', 'Check in once per day')} />
          <XpRule title={t('点赞他人', 'Like others')} value={t('+1 XP', '+1 XP')} desc={t('为项目或案例点赞', 'Like a project or case')} />
          <XpRule title={t('收藏他人', 'Favorite others')} value={t('+1 XP', '+1 XP')} desc={t('收藏喜欢的项目或案例', 'Favorite a project or case')} />
          <XpRule title={t('被点赞', 'Got liked')} value={t('+3 XP', '+3 XP')} desc={t('自己的项目获得他人点赞', 'Your project gets liked')} />
          <XpRule title={t('被收藏', 'Got favorited')} value={t('+6 XP', '+6 XP')} desc={t('自己的项目获得他人收藏', 'Your project gets favorited')} />
        </div>
      </section>

      {/* Current unlocked benefits */}
      {profile && !loading && currentBenefits.length > 0 && (
        <section className="mt-10">
          <h2 className="font-display text-xl font-medium">{t('当前可用权益', 'Your Current Benefits')}</h2>
          <ul className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {currentBenefits.map((b) => (
              <li key={b.id} className="flex items-start gap-3 border border-border bg-card p-4">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                <span className="text-sm text-foreground">{lang === 'en' && b.benefit_label_en ? b.benefit_label_en : b.benefit_label}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Benefit matrix */}
      <section ref={revealRef} className="mt-10">
        <h2 className="font-display text-xl font-medium">{t('权益对照表', 'Benefit Matrix')}</h2>
        <div className="mt-4 w-full max-w-full overflow-x-auto border border-border bg-card">
          <table className="w-full min-w-[640px] border-collapse">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="whitespace-nowrap px-4 py-3 text-left font-mono-label text-xs uppercase tracking-wider text-muted-foreground">{t('权益', 'Benefit')}</th>
                {TIERS.map((tier) => (
                  <th key={tier} className={`whitespace-nowrap px-4 py-3 text-center font-mono-label text-xs uppercase tracking-wider ${currentTier === tier ? 'text-accent' : 'text-muted-foreground'}`}>
                    {lang === 'en' ? TIER_LABELS[tier].en : TIER_LABELS[tier].zh}
                    {currentTier === tier && <span className="ml-1 text-accent">●</span>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading
                ? Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="border-b border-border">
                      {Array.from({ length: 5 }).map((__, j) => <td key={j} className="px-4 py-3"><Skeleton className="h-4 w-full bg-muted" /></td>)}
                    </tr>
                  ))
                : matrix.map((row) => (
                    <tr key={row.key} className="border-b border-border last:border-0">
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-foreground">{row.label}</td>
                      {row.cells.map((cell, i) => (
                        <td key={i} className="whitespace-nowrap px-4 py-3 text-center">
                          {cell && cell.enabled ? (
                            <Check className="mx-auto h-4 w-4 text-accent" />
                          ) : (
                            <X className="mx-auto h-4 w-4 text-muted-foreground/40" />
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Level config visualization */}
      <section className="mt-14">
        <h2 className="font-display text-xl font-medium">{t('等级与 XP 阈值', 'Levels & XP Thresholds')}</h2>
        <p className="mt-2 font-mono-label text-xs text-muted-foreground">{t('XP 通过每日签到、点赞、收藏等行为累积，详见上方规则。', 'XP accumulates via daily check-ins, likes, and favorites. See the rules above.')}</p>
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {loading
            ? Array.from({ length: 10 }).map((_, i) => <Skeleton key={i} className="h-28 bg-muted" />)
            : levels.map((lv) => (
                <div key={lv.level} className="magazine-card flex h-full flex-col p-4">
                  <div className="flex items-center justify-between">
                    <span className="font-display text-2xl font-medium text-accent">Lv.{lv.level}</span>
                    {profile?.level === lv.level && <span className="font-mono-label text-[10px] text-accent">YOU</span>}
                  </div>
                  <p className="mt-2 text-sm font-medium text-foreground">{lang === 'en' ? lv.title_en : lv.title}</p>
                  <p className="mt-auto pt-3 font-mono-label text-xs text-muted-foreground">{lv.xp_threshold} XP</p>
                </div>
              ))}
        </div>
      </section>
    </div>
  );
}

function StatusCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="magazine-card flex items-center gap-4 p-5">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center bg-primary text-primary-foreground">{icon}</div>
      <div className="min-w-0">
        <p className="font-mono-label text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className="mt-0.5 truncate font-display text-xl font-medium text-foreground">{value}</p>
      </div>
    </div>
  );
}

function XpRule({ title, value, desc }: { title: string; value: string; desc: string }) {
  return (
    <div className="magazine-card flex flex-col p-4">
      <div className="flex items-center justify-between">
        <span className="font-mono-label text-xs uppercase tracking-wider text-muted-foreground">{title}</span>
        <span className="font-display text-xl font-medium text-accent">{value}</span>
      </div>
      <p className="mt-2 text-sm text-muted-foreground text-pretty">{desc}</p>
    </div>
  );
}