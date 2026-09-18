import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useI18n } from '@/contexts/I18nContext';
import { useAuth } from '@/contexts/AuthContext';
import { fetchMemberBenefits, fetchLevelConfig, saveMemberBenefit, saveLevelConfig, TIER_LABELS } from '@/lib/api';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Save } from 'lucide-react';
import type { MemberBenefit, MemberTier, LevelConfig } from '@/types/types';

const TIERS: MemberTier[] = ['guest', 'member', 'pro'];

/** 当前网站实际支持的权益条目。以这份定义为准，数据库里多余的旧数据不再显示。 */
const BENEFIT_DEFINITIONS: { key: string; label: string; labelEn: string; sort_order: number }[] = [
  { key: 'free_content', label: '免费内容', labelEn: 'Free content', sort_order: 1 },
  { key: 'free_projects', label: '免费项目', labelEn: 'Free projects', sort_order: 2 },
  { key: 'paid_projects', label: '付费项目', labelEn: 'Paid projects', sort_order: 3 },
  { key: 'coaching', label: '合作与陪跑服务', labelEn: 'Coaching & collaboration', sort_order: 4 },
];

const TEMP_ID_PREFIX = '__new__';

function makeTempId(key: string, tier: MemberTier) {
  return `${TEMP_ID_PREFIX}${key}__${tier}`;
}

function isTempId(id: string) {
  return id.startsWith(TEMP_ID_PREFIX);
}

function normalizeBenefits(list: MemberBenefit[]): MemberBenefit[] {
  const result: MemberBenefit[] = [];
  for (const def of BENEFIT_DEFINITIONS) {
    const row = list.filter((b) => b.benefit_key === def.key);
    const existingMap = new Map(row.map((r) => [r.tier, r]));
    for (const tier of TIERS) {
      const existing = existingMap.get(tier);
      if (existing) {
        result.push(existing);
      } else {
        // 用临时唯一 id 占位，避免多个缺失格子共享空 id 导致开关联动
        result.push({
          id: makeTempId(def.key, tier),
          tier,
          benefit_key: def.key,
          benefit_label: def.label,
          benefit_label_en: def.labelEn,
          enabled: false,
          sort_order: def.sort_order,
        });
      }
    }
  }
  return result;
}

export default function AdminBenefits() {
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const { profile } = useAuth();

  const [benefits, setBenefits] = useState<MemberBenefit[]>([]);
  const [levels, setLevels] = useState<LevelConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (profile && profile.role !== 'admin') { navigate('/', { replace: true }); return; }
    Promise.all([fetchMemberBenefits(), fetchLevelConfig()])
      .then(([b, l]) => {
        // 保证每个 benefit_key 对四个 tier 都有记录，缺失的自动生成可编辑开关
        const normalized = normalizeBenefits(b);
        setBenefits(normalized);
        setLevels(l);
      })
      .catch(() => toast.error(t('加载失败', 'Load failed')))
      .finally(() => setLoading(false));
  }, [profile, navigate, t]);

  const updateBenefit = (id: string, patch: Partial<MemberBenefit>) => {
    setBenefits((prev) => prev.map((b) => b.id === id ? { ...b, ...patch } : b));
  };

  const updateLevel = (level: number, patch: Partial<LevelConfig>) => {
    setLevels((prev) => prev.map((l) => l.level === level ? { ...l, ...patch } : l));
  };

  const handleSaveBenefits = useCallback(async () => {
    setSaving(true);
    try {
      for (const b of benefits) {
        // 临时 id 的行需要新建；有真实 id 的行直接更新
        const payload = isTempId(b.id) ? { ...b, id: '' } : b;
        await saveMemberBenefit(payload);
      }
      // 保存后重新拉取，补齐新增行的真实 id
      const refreshed = await fetchMemberBenefits();
      setBenefits(normalizeBenefits(refreshed));
      toast.success(t('权益配置已保存', 'Benefit config saved'));
    } catch { toast.error(t('保存失败', 'Save failed')); }
    finally { setSaving(false); }
  }, [benefits, t]);

  const handleSaveLevels = useCallback(async () => {
    setSaving(true);
    try {
      await saveLevelConfig(levels);
      toast.success(t('等级配置已保存', 'Level config saved'));
    } catch { toast.error(t('保存失败', 'Save failed')); }
    finally { setSaving(false); }
  }, [levels, t]);

  const benefitKeys = BENEFIT_DEFINITIONS.map((d) => d.key);

  return (
    <div className="space-y-12">
      {/* XP threshold visualization */}
      <section>
        <div className="flex items-center justify-between">
          <div>
            <p className="editorial-label">{t('XP 阈值配置', 'XP Thresholds')}</p>
            <h2 className="mt-1 font-display text-xl font-medium">{t('等级升级阈值可视化', 'Level-Up XP Thresholds')}</h2>
          </div>
          <Button onClick={handleSaveLevels} disabled={saving} className="gap-1.5 font-mono-label text-xs"><Save className="h-3.5 w-3.5" />{t('保存', 'Save')}</Button>
        </div>

        {loading ? (
          <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-5">{Array.from({ length: 10 }).map((_, i) => <div key={i} className="h-32 animate-pulse bg-muted" />)}</div>
        ) : (
          <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-5">
            {levels.map((lv) => (
              <div key={lv.level} className="magazine-card flex flex-col gap-3 p-4">
                <div className="flex items-center justify-between">
                  <span className="font-display text-xl font-medium text-accent">Lv.{lv.level}</span>
                </div>
                <div className="space-y-1.5">
                  <Label className="font-mono-label text-[10px] uppercase tracking-wider text-muted-foreground">{t('称号（中）', 'Title (ZH)')}</Label>
                  <Input value={lv.title} onChange={(e) => updateLevel(lv.level, { title: e.target.value })} className="h-8 px-2 text-sm" />
                </div>
                <div className="space-y-1.5">
                  <Label className="font-mono-label text-[10px] uppercase tracking-wider text-muted-foreground">{t('称号（英）', 'Title (EN)')}</Label>
                  <Input value={lv.title_en} onChange={(e) => updateLevel(lv.level, { title_en: e.target.value })} className="h-8 px-2 text-sm" />
                </div>
                <div className="space-y-1.5">
                  <Label className="font-mono-label text-[10px] uppercase tracking-wider text-muted-foreground">{t('XP 阈值', 'XP Threshold')}</Label>
                  <Input type="number" value={lv.xp_threshold} onChange={(e) => updateLevel(lv.level, { xp_threshold: Number(e.target.value) })} className="h-8 px-2 font-mono-label text-sm" />
                </div>
                <div className="space-y-1.5">
                  <Label className="font-mono-label text-[10px] uppercase tracking-wider text-muted-foreground">{t('免费解锁付费项目数', 'Free unlocks')}</Label>
                  <Input type="number" min={0} value={lv.free_unlock_count ?? 0} onChange={(e) => updateLevel(lv.level, { free_unlock_count: Math.max(0, Math.floor(Number(e.target.value) || 0)) })} className="h-8 px-2 font-mono-label text-sm" />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Member benefit matrix */}
      <section>
        <div className="flex items-center justify-between">
          <div>
            <p className="editorial-label">{t('会员权益矩阵', 'Member Benefit Matrix')}</p>
            <h2 className="mt-1 font-display text-xl font-medium">{t('配置各等级权益', 'Configure Tier Benefits')}</h2>
          </div>
          <Button onClick={handleSaveBenefits} disabled={saving} className="gap-1.5 font-mono-label text-xs"><Save className="h-3.5 w-3.5" />{t('保存', 'Save')}</Button>
        </div>

        <div className="mt-6 w-full max-w-full overflow-x-auto border border-border bg-card">
          <table className="w-full min-w-[640px] border-collapse">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="whitespace-nowrap px-4 py-3 text-left font-mono-label text-xs uppercase tracking-wider text-muted-foreground">{t('权益', 'Benefit')}</th>
                {TIERS.map((tier) => (
                  <th key={tier} className="whitespace-nowrap px-4 py-3 text-center font-mono-label text-xs uppercase tracking-wider text-muted-foreground">
                    {lang === 'en' ? TIER_LABELS[tier].en : TIER_LABELS[tier].zh}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {benefitKeys.map((key) => {
                const row = benefits.filter((b) => b.benefit_key === key);
                return (
                  <tr key={key} className="border-b border-border last:border-0">
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-foreground">
                      {(() => {
                        const def = BENEFIT_DEFINITIONS.find((d) => d.key === key);
                        if (lang === 'en' && def?.labelEn) return def.labelEn;
                        return def?.label ?? key;
                      })()}
                    </td>
                    {TIERS.map((tier) => {
                      const cell = row.find((r) => r.tier === tier);
                      if (!cell) return <td key={tier} className="whitespace-nowrap px-4 py-3 text-center" />;
                      return (
                        <td key={tier} className="whitespace-nowrap px-4 py-3 text-center">
                          <Switch
                            checked={cell.enabled}
                            onCheckedChange={(v) => updateBenefit(cell.id, { enabled: v })}
                          />
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}