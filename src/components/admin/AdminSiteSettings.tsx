import type { LucideIcon } from 'lucide-react';
import {
  Check,
  CircleAlert,
  Compass,
  Loader2,
  Save,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/contexts/AuthContext';
import { useI18n } from '@/contexts/I18nContext';
import { useSiteSettings } from '@/contexts/SiteSettingsContext';
import { fetchSiteSettings, saveSiteSetting } from '@/lib/api';
import type { SiteSetting } from '@/types/types';

const DEFAULTS: Record<string, string> = {
  locked_project_dialog_title: '需要更高会员等级',
  locked_project_dialog_title_en: 'Higher membership required',
  locked_project_dialog_content: '该项目需要更高会员等级才能查看。升级会员以解锁全部项目内容，或使用当前等级的免费解锁额度。',
  locked_project_dialog_content_en: 'This project requires a higher membership tier. Upgrade to unlock all projects, or use your free unlock quota.',
  nav_discuss: '广场',
  nav_discuss_en: 'Plaza',
  nav_tools: '工具',
  nav_tools_en: 'Tools',
};

// 这些内容在「首页与页脚」或对应内容板块维护，避免同一内容出现两个编辑入口。
const HIDDEN_KEYS = new Set([
  'footer_tagline', 'footer_tagline_en', 'footer_copyright', 'footer_copyright_en',
  'discuss_content', 'discuss_content_en', 'tools_content', 'tools_content_en',
]);

interface SettingGroupDefinition {
  key: string;
  eyebrow: readonly [string, string];
  title: readonly [string, string];
  description: readonly [string, string];
  icon: LucideIcon;
  keys: readonly string[];
}

type RenderedSettingGroup = SettingGroupDefinition & { items: SiteSetting[] };

const SETTING_GROUPS: readonly SettingGroupDefinition[] = [
  {
    key: 'brand',
    eyebrow: ['品牌识别', 'Identity'],
    title: ['品牌与主导航', 'Brand & navigation'],
    description: ['管理访客在网站顶部看到的名称和栏目。', 'Manage the name and sections visitors see in the header.'],
    icon: Compass,
    keys: ['brand_name', 'nav_home', 'nav_cases', 'nav_projects', 'nav_events', 'nav_discuss', 'nav_tools'],
  },
  {
    key: 'features',
    eyebrow: ['开放范围', 'Availability'],
    title: ['板块开关', 'Section availability'],
    description: ['控制板块是否向访客开放，不再直接显示技术字段。', 'Control which sections are available to visitors.'],
    icon: SlidersHorizontal,
    keys: ['discuss_visible', 'tools_visible'],
  },
  {
    key: 'experience',
    eyebrow: ['使用规则', 'Experience'],
    title: ['成长与访问提示', 'Growth & access rules'],
    description: ['设置每日额度、成长奖励和受限内容提示。', 'Configure daily limits, growth rewards, and locked-content messages.'],
    icon: Sparkles,
    keys: ['ai_daily_limit', 'daily_checkin_xp', 'locked_project_dialog_title', 'locked_project_dialog_content'],
  },
  {
    key: 'legal',
    eyebrow: ['合规说明', 'Legal'],
    title: ['协议与隐私', 'Terms & privacy'],
    description: ['维护用户协议和隐私政策正文。', 'Maintain the terms of service and privacy policy.'],
    icon: ShieldCheck,
    keys: ['terms_content', 'privacy_content'],
  },
];

const SETTING_META: Record<string, { label: [string, string]; description: [string, string]; kind?: 'number' | 'switch' | 'textarea' }> = {
  ai_daily_limit: { label: ['AI 助手每日使用上限', 'Daily AI assistant limit'], description: ['每位用户每天最多可使用的次数。', 'Maximum uses per person each day.'], kind: 'number' },
  brand_name: { label: ['社区名称', 'Community name'], description: ['显示在网站顶部和品牌区域。', 'Shown in the header and brand areas.'] },
  daily_checkin_xp: { label: ['每日签到成长值', 'Daily check-in XP'], description: ['用户每日签到后获得的成长值。', 'XP awarded for a daily check-in.'], kind: 'number' },
  discuss_visible: { label: ['开放广场', 'Show plaza'], description: ['关闭后，访客将无法进入广场板块。', 'When off, visitors cannot access the plaza.'], kind: 'switch' },
  tools_visible: { label: ['开放工具板块', 'Show tools'], description: ['关闭后，访客将无法进入工具板块。', 'When off, visitors cannot access the tools section.'], kind: 'switch' },
  locked_project_dialog_title: { label: ['受限项目提示标题', 'Locked project title'], description: ['用户权限不足时看到的标题。', 'Shown when a user lacks access.'] },
  locked_project_dialog_content: { label: ['受限项目提示说明', 'Locked project message'], description: ['解释为什么无法查看，以及用户下一步可以做什么。', 'Explain why access is restricted and what to do next.'], kind: 'textarea' },
  nav_home: { label: ['首页栏目名称', 'Home label'], description: ['网站顶部首页入口的名称。', 'Header label for the homepage.'] },
  nav_cases: { label: ['案例栏目名称', 'Cases label'], description: ['网站顶部案例入口的名称。', 'Header label for cases.'] },
  nav_projects: { label: ['项目库栏目名称', 'Projects label'], description: ['网站顶部项目库入口的名称。', 'Header label for projects.'] },
  nav_events: { label: ['城市组局栏目名称', 'Events label'], description: ['网站顶部城市组局入口的名称。', 'Header label for events.'] },
  nav_discuss: { label: ['广场栏目名称', 'Plaza label'], description: ['网站顶部社区讨论入口的名称。', 'Header label for community discussion.'] },
  nav_tools: { label: ['工具栏目名称', 'Tools label'], description: ['网站顶部工具入口的名称。', 'Header label for tools.'] },
  privacy_content: { label: ['隐私政策正文', 'Privacy policy'], description: ['支持 Markdown 格式。', 'Markdown is supported.'], kind: 'textarea' },
  terms_content: { label: ['用户协议正文', 'Terms of service'], description: ['支持 Markdown 格式。', 'Markdown is supported.'], kind: 'textarea' },
};

export default function AdminSiteSettings() {
  const { t } = useI18n();
  const { profile } = useAuth();
  const { reload: reloadSiteSettings } = useSiteSettings();
  const [settings, setSettings] = useState<SiteSetting[]>([]);
  const [savedValues, setSavedValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await fetchSiteSettings();
      const map = new Map(rows.map((row) => [row.key, row]));
      const merged = [...rows];
      Object.entries(DEFAULTS).forEach(([key, value]) => {
        if (!map.has(key)) merged.push({ key, value, updated_at: new Date().toISOString() });
      });
      merged.sort((a, b) => a.key.localeCompare(b.key));
      setSettings(merged);
      setSavedValues(Object.fromEntries(merged.map((item) => [item.key, item.value])));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('加载失败', 'Load failed'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    if (profile && profile.role !== 'admin') return;
    void load();
  }, [profile, load]);

  const dirtyItems = useMemo(
    () => settings.filter((item) => savedValues[item.key] !== item.value),
    [settings, savedValues],
  );

  useEffect(() => {
    if (dirtyItems.length === 0) return;
    const warnBeforeLeaving = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', warnBeforeLeaving);
    return () => window.removeEventListener('beforeunload', warnBeforeLeaving);
  }, [dirtyItems.length]);

  const groupedSettings = useMemo(() => {
    const visible = settings.filter((item) => !item.key.endsWith('_en') && !HIDDEN_KEYS.has(item.key));
    const knownKeys = new Set<string>(SETTING_GROUPS.flatMap((group) => [...group.keys]));
    const groups: RenderedSettingGroup[] = SETTING_GROUPS.map((group) => ({
      ...group,
      items: group.keys.map((key) => visible.find((item) => item.key === key)).filter((item): item is SiteSetting => Boolean(item)),
    })).filter((group) => group.items.length > 0);
    const other = visible.filter((item) => !knownKeys.has(item.key));
    if (other.length > 0) {
      groups.push({
        key: 'other',
        eyebrow: ['其他设置', 'Other'],
        title: ['补充配置', 'Additional settings'],
        description: ['尚未归入以上板块的设置。', 'Settings not yet assigned to a section.'],
        icon: SlidersHorizontal,
        keys: [],
        items: other,
      });
    }
    return groups;
  }, [settings]);

  const handleChange = (key: string, value: string) => {
    setSettings((current) => current.map((item) => item.key === key ? { ...item, value } : item));
  };

  const handleSaveAll = async () => {
    if (dirtyItems.length === 0 || saving) return;
    setSaving(true);
    try {
      await Promise.all(dirtyItems.map((item) => saveSiteSetting(item)));
      setSavedValues(Object.fromEntries(settings.map((item) => [item.key, item.value])));
      setLastSavedAt(new Date());
      await reloadSiteSettings();
      toast.success(t(`已保存 ${dirtyItems.length} 项修改`, `Saved ${dirtyItems.length} changes`));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('保存失败', 'Save failed'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="py-16 text-center text-sm text-muted-foreground">{t('正在读取全站设置…', 'Loading global settings…')}</div>;
  }

  return (
    <div>
      <div className="sticky top-20 z-20 border border-border bg-background/95 p-4 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-background/85">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              {dirtyItems.length > 0 ? <CircleAlert className="h-4 w-4 text-accent" /> : <Check className="h-4 w-4 text-emerald-600" />}
              <p className="font-display text-base font-medium">
                {dirtyItems.length > 0
                  ? t(`${dirtyItems.length} 项修改尚未保存`, `${dirtyItems.length} unsaved changes`)
                  : t('当前内容已保存', 'Everything is saved')}
              </p>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {lastSavedAt
                ? t(`最近保存于 ${lastSavedAt.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}`, `Last saved at ${lastSavedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`)
                : t('修改完成后统一保存，无需逐项点击。', 'Save all changes together when you are ready.')}
            </p>
          </div>
          <Button onClick={handleSaveAll} disabled={dirtyItems.length === 0 || saving} className="gap-2 font-mono-label text-xs">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {saving ? t('保存中…', 'Saving…') : t('保存全部更改', 'Save all changes')}
          </Button>
        </div>
      </div>

      <div className="mt-6 space-y-6">
        {groupedSettings.map((group) => {
          const Icon = group.icon;
          return (
            <section key={group.key} className="border border-border bg-card">
              <div className="flex gap-4 border-b border-border bg-muted/20 p-5">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center border border-border bg-background text-accent">
                  <Icon className="h-4 w-4" />
                </span>
                <div>
                  <p className="font-mono-label text-[10px] uppercase tracking-[0.16em] text-accent">{t(group.eyebrow[0], group.eyebrow[1])}</p>
                  <h3 className="mt-1 font-display text-lg font-medium">{t(group.title[0], group.title[1])}</h3>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">{t(group.description[0], group.description[1])}</p>
                </div>
              </div>

              <div className="divide-y divide-border">
                {group.items.map((item) => (
                  <SettingField
                    key={item.key}
                    item={item}
                    dirty={savedValues[item.key] !== item.value}
                    onChange={handleChange}
                    t={t}
                  />
                ))}
              </div>
            </section>
          );
        })}
      </div>

      <div className="mt-6 border border-dashed border-border p-4 text-sm leading-6 text-muted-foreground">
        {t('首页主文案和页脚内容已统一放在“首页与页脚”中维护，避免同一内容在两个地方互相覆盖。', 'Homepage and footer copy are managed only under “Homepage & Footer” to prevent conflicting sources.')}
      </div>
    </div>
  );
}

function SettingField({
  item,
  dirty,
  onChange,
  t,
}: {
  item: SiteSetting;
  dirty: boolean;
  onChange: (key: string, value: string) => void;
  t: (zh: string, en: string) => string;
}) {
  const meta = SETTING_META[item.key] ?? {
    label: [friendlyKey(item.key), friendlyKey(item.key)] as [string, string],
    description: ['全站补充设置。', 'Additional global setting.'] as [string, string],
  };
  const fieldId = `site-setting-${item.key}`;

  return (
    <div className={`grid gap-4 p-5 transition-colors lg:grid-cols-[260px_1fr] ${dirty ? 'bg-accent/[0.045]' : ''}`}>
      <div>
        <div className="flex items-center gap-2">
          <Label htmlFor={fieldId} className="text-sm font-medium text-foreground">{t(meta.label[0], meta.label[1])}</Label>
          {dirty && <span className="font-mono-label text-[9px] uppercase tracking-wider text-accent">{t('已修改', 'Changed')}</span>}
        </div>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">{t(meta.description[0], meta.description[1])}</p>
      </div>

      {meta.kind === 'switch' ? (
        <div className="flex min-h-10 items-center justify-between border border-border bg-background px-3">
          <span className="text-sm text-muted-foreground">{item.value === 'true' ? t('已开放', 'Visible') : t('已关闭', 'Hidden')}</span>
          <Switch id={fieldId} checked={item.value === 'true'} onCheckedChange={(checked) => onChange(item.key, String(checked))} />
        </div>
      ) : meta.kind === 'textarea' ? (
        <Textarea
          id={fieldId}
          value={item.value}
          onChange={(event) => onChange(item.key, event.target.value)}
          rows={item.key.endsWith('_content') && !item.key.startsWith('locked_') ? 10 : 4}
          className="px-3 font-mono text-sm"
        />
      ) : (
        <Input
          id={fieldId}
          type={meta.kind === 'number' ? 'number' : 'text'}
          min={meta.kind === 'number' ? 0 : undefined}
          value={item.value}
          onChange={(event) => onChange(item.key, event.target.value)}
          className="px-3"
        />
      )}
    </div>
  );
}

function friendlyKey(key: string) {
  return key
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (character: string) => character.toUpperCase());
}
