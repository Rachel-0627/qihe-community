import { useState, useEffect, useCallback, useMemo } from 'react';
import { useI18n } from '@/contexts/I18nContext';
import { useAuth } from '@/contexts/AuthContext';
import { useSiteSettings } from '@/contexts/SiteSettingsContext';
import { fetchSiteSettings, saveSiteSetting } from '@/lib/api';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { SiteSetting } from '@/types/types';

// 需要 Textarea 大文本编辑的键
const TEXTAREA_KEYS = [
  'terms_content', 'privacy_content',
  'locked_project_dialog_content', 'locked_project_dialog_content_en',
  'footer_tagline', 'footer_tagline_en', 'footer_copyright', 'footer_copyright_en',
  'business_coop_content', 'business_coop_content_en',
];

// 版权/页脚 slogan 等单行短文本用更矮的编辑框
const COMPACT_TEXTAREA_KEYS = [
  'footer_tagline', 'footer_tagline_en', 'footer_copyright', 'footer_copyright_en',
];

// 导航栏板块名称键（成对出现）
const NAV_LABEL_PAIRS = [
  { zhKey: 'nav_home', enKey: 'nav_home_en', label: ['首页', 'Home'] },
  { zhKey: 'nav_cases', enKey: 'nav_cases_en', label: ['案例', 'Cases'] },
  { zhKey: 'nav_projects', enKey: 'nav_projects_en', label: ['项目库', 'Projects'] },
  { zhKey: 'nav_events', enKey: 'nav_events_en', label: ['城市组局', 'Events'] },
  { zhKey: 'nav_tools', enKey: 'nav_tools_en', label: ['工具', 'Tools'] },
];

export default function AdminSiteSettings() {
  const { t } = useI18n();
  const { profile } = useAuth();
  const { reload: reloadSiteSettings } = useSiteSettings();

  const [settings, setSettings] = useState<SiteSetting[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    fetchSiteSettings().then((rows) => {
      const map = new Map(rows.map((r) => [r.key, r]));
      // 若站点设置中不存在，则补充默认值，便于后台直接配置。
      const defaults: Record<string, string> = {
        locked_project_dialog_title: '需要更高会员等级',
        locked_project_dialog_title_en: 'Higher membership required',
        locked_project_dialog_content: '该项目需要更高会员等级才能查看。升级会员以解锁全部项目内容，或使用当前等级的免费解锁额度。',
        locked_project_dialog_content_en: 'This project requires a higher membership tier. Upgrade to unlock all projects, or use your free unlock quota.',
        footer_tagline: '高端 AI 项目社区 · 创新实验室 × 数字艺术展览',
        footer_tagline_en: 'Premium AI project community · Innovation lab × Digital art gallery',
        footer_copyright: '© 2026 AI 创业社区. 保留所有权利。',
        footer_copyright_en: '© 2026 AI Startup Community. All rights reserved.',
        nav_business: '商务与合作',
        nav_business_en: 'Business',
        nav_tools: '工具',
        nav_tools_en: 'Tools',
      };
      const merged: SiteSetting[] = [...rows];
      Object.entries(defaults).forEach(([key, value]) => {
        if (!map.has(key)) {
          merged.push({ key, value, updated_at: new Date().toISOString() });
        }
      });
      setSettings(merged.sort((a, b) => a.key.localeCompare(b.key)));
    }).catch(() => toast.error(t('加载失败', 'Load failed'))).finally(() => setLoading(false));
  }, [t]);

  useEffect(() => {
    if (profile && profile.role !== 'admin') return;
    load();
  }, [profile, load]);

  const handleChange = (key: string, value: string) => {
    setSettings((prev) => prev.map((s) => s.key === key ? { ...s, value } : s));
  };

  const handleSave = async (item: SiteSetting) => {
    try {
      await saveSiteSetting(item);
      toast.success(t('保存成功', 'Saved successfully'));
      reloadSiteSettings();
      load();
    } catch { toast.error(t('保存失败', 'Save failed')); }
  };

  return (
    <div>
      <div>
        <p className="editorial-label">{t('站点设置', 'Site Settings')}</p>
        <h2 className="mt-1 font-display text-xl font-medium">{t('全局参数配置', 'Global configuration')}</h2>
      </div>

      <div className="mt-6 space-y-4">
        {loading ? (
          <p className="text-sm text-muted-foreground">{t('加载中…', 'Loading…')}</p>
        ) : settings.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('暂无设置项', 'No settings')}</p>
        ) : settings.map((item) => (
          <div key={item.key} className="flex flex-col gap-3 border border-border bg-card p-4">
            <div className="flex-1 space-y-1.5">
              <Label className="font-mono-label text-xs uppercase tracking-wider text-muted-foreground">
                {labelFor(item.key, t)}
              </Label>
              {TEXTAREA_KEYS.includes(item.key) ? (
                <Textarea
                  value={item.value}
                  onChange={(e) => handleChange(item.key, e.target.value)}
                  className={`px-3 font-mono text-sm ${COMPACT_TEXTAREA_KEYS.includes(item.key) ? 'min-h-[80px]' : 'min-h-[160px]'}`}
                  placeholder={t('支持 Markdown 格式', 'Markdown supported')}
                />
              ) : (
                <Input value={item.value} onChange={(e) => handleChange(item.key, e.target.value)} className="px-3" />
              )}
            </div>
            <div className="flex justify-end">
              <Button onClick={() => handleSave(item)} className="font-mono-label text-xs uppercase tracking-wider">
                {t('保存', 'Save')}
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function labelFor(key: string, t: (zh: string, en: string) => string) {
  const labels: Record<string, [string, string]> = {
    daily_checkin_xp: ['每日签到 XP', 'Daily check-in XP'],
    ai_daily_limit: ['AI 助手每日上限（次/人）', 'AI assistant daily limit per user'],
    brand_name: ['品牌名（中文）', 'Brand name (Chinese)'],
    brand_name_en: ['品牌名（英文）', 'Brand name (English)'],
    terms_content: ['用户协议内容（Markdown）', 'Terms of service (Markdown)'],
    privacy_content: ['隐私政策内容（Markdown）', 'Privacy policy (Markdown)'],
    nav_home: ['导航：首页', 'Nav: Home'],
    nav_home_en: ['导航：首页（英文）', 'Nav: Home (English)'],
    nav_cases: ['导航：案例', 'Nav: Cases'],
    nav_cases_en: ['导航：案例（英文）', 'Nav: Cases (English)'],
    nav_projects: ['导航：项目库', 'Nav: Projects'],
    nav_projects_en: ['导航：项目库（英文）', 'Nav: Projects (English)'],
    nav_events: ['导航：城市组局', 'Nav: Events'],
    nav_events_en: ['导航：城市组局（英文）', 'Nav: Events (English)'],
    nav_business: ['导航：商务与合作', 'Nav: Business'],
    nav_business_en: ['导航：商务与合作（英文）', 'Nav: Business (English)'],
    nav_tools: ['导航：工具', 'Nav: Tools'],
    nav_tools_en: ['导航：工具（英文）', 'Nav: Tools (English)'],
    locked_project_dialog_title: ['无权益项目弹窗标题', 'Locked project dialog title'],
    locked_project_dialog_title_en: ['无权益项目弹窗标题（英文）', 'Locked project dialog title (English)'],
    locked_project_dialog_content: ['无权益项目弹窗内容', 'Locked project dialog content'],
    locked_project_dialog_content_en: ['无权益项目弹窗内容（英文）', 'Locked project dialog content (English)'],
    footer_tagline: ['页脚品牌描述', 'Footer brand tagline'],
    footer_tagline_en: ['页脚品牌描述（英文）', 'Footer brand tagline (English)'],
    footer_copyright: ['页脚版权信息', 'Footer copyright'],
    footer_copyright_en: ['页脚版权信息（英文）', 'Footer copyright (English)'],
  };
  const entry = labels[key];
  return entry ? t(entry[0], entry[1]) : key;
}
