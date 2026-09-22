import { useState, useEffect, useCallback } from 'react';
import { useI18n } from '@/contexts/I18nContext';
import { useSiteSettings } from '@/contexts/SiteSettingsContext';
import { fetchSiteSettings, saveSiteSetting } from '@/lib/api';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';

export default function AdminTools() {
  const { t } = useI18n();
  const { reload: reloadSiteSettings } = useSiteSettings();
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    fetchSiteSettings()
      .then((rows) => {
        const map: Record<string, string> = {};
        rows.forEach((r) => { map[r.key] = r.value; });
        setSettings({
          tools_visible: map.tools_visible ?? 'true',
        });
      })
      .catch(() => toast.error(t('加载失败', 'Load failed')))
      .finally(() => setLoading(false));
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  const handleSave = async (key: string, value: string) => {
    try {
      await saveSiteSetting({ key, value, updated_at: new Date().toISOString() });
      toast.success(t('保存成功', 'Saved successfully'));
      reloadSiteSettings();
    } catch {
      toast.error(t('保存失败', 'Save failed'));
    }
  };

  if (loading) {
    return <p className="text-sm text-muted-foreground">{t('加载中…', 'Loading…')}</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between border border-border bg-card p-4">
        <div className="space-y-0.5">
          <Label className="font-mono-label text-xs uppercase tracking-wider text-muted-foreground">{t('前台显示', 'Visible on site')}</Label>
          <p className="text-sm text-muted-foreground">{t('关闭后前台导航与页面入口将隐藏', 'Hide navigation and page entry when turned off')}</p>
        </div>
        <Switch
          checked={settings.tools_visible !== 'false'}
          onCheckedChange={(checked) => {
            const value = checked ? 'true' : 'false';
            setSettings((prev) => ({ ...prev, tools_visible: value }));
            handleSave('tools_visible', value);
          }}
        />
      </div>
      <p className="text-sm text-muted-foreground">{t('工具页内容现由「生图提示词案例库」自动承载。', 'Tools page content is now handled by the Image Prompt Case Library.')}</p>
    </div>
  );
}
