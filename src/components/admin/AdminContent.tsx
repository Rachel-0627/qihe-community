import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useI18n } from '@/contexts/I18nContext';
import { useAuth } from '@/contexts/AuthContext';
import { fetchSiteContent, saveSiteContent } from '@/lib/api';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Save } from 'lucide-react';
import type { SiteContent } from '@/types/types';

export default function AdminContent() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { profile } = useAuth();

  const [items, setItems] = useState<SiteContent[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);

  useEffect(() => {
    if (profile && profile.role !== 'admin') { navigate('/', { replace: true }); return; }
    fetchSiteContent().then(setItems).catch(() => toast.error(t('加载失败', 'Load failed'))).finally(() => setLoading(false));
  }, [profile, navigate, t]);

  const updateItem = (id: string, patch: Partial<SiteContent>) => {
    setItems((prev) => prev.map((i) => i.id === id ? { ...i, ...patch } : i));
  };

  const handleSave = useCallback(async (item: SiteContent) => {
    setSavingId(item.id);
    try {
      await saveSiteContent(item);
      toast.success(t('已保存', 'Saved'));
    } catch { toast.error(t('保存失败', 'Save failed')); }
    finally { setSavingId(null); }
  }, [t]);

  const grouped = items.reduce<Record<string, SiteContent[]>>((acc, item) => {
    (acc[item.section] ||= []).push(item);
    return acc;
  }, {});

  const sectionLabels: Record<string, { zh: string; en: string }> = {
    hero: { zh: '首页 Hero', en: 'Homepage Hero' },
    footer: { zh: '页脚', en: 'Footer' },
  };

  if (loading) return <div className="py-16 text-center text-sm text-muted-foreground">{t('加载中…', 'Loading…')}</div>;

  return (
    <div className="space-y-10">
      {Object.entries(grouped).map(([section, rows]) => (
        <section key={section}>
          <p className="editorial-label text-accent">{sectionLabels[section] ? (t(sectionLabels[section].zh, sectionLabels[section].en)) : section}</p>
          <h2 className="mt-1 font-display text-xl font-medium">{t('可编辑内容', 'Editable Content')}</h2>

          <div className="mt-6 space-y-4">
            {rows.map((item) => (
              <div key={item.id} className="magazine-card p-5">
                <div className="mb-3 flex items-center justify-between">
                  <span className="font-mono-label text-xs uppercase tracking-wider text-muted-foreground">{item.section}.{item.key}</span>
                  <Button onClick={() => handleSave(item)} disabled={savingId === item.id} size="sm" className="gap-1.5 font-mono-label text-[10px]">
                    <Save className="h-3 w-3" />{savingId === item.id ? t('保存中…', 'Saving…') : t('保存', 'Save')}
                  </Button>
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label className="font-mono-label text-[10px] uppercase tracking-wider text-muted-foreground">{t('内容（中）', 'Value (ZH)')}</Label>
                    {item.value.length > 60 ? (
                      <Textarea value={item.value} onChange={(e) => updateItem(item.id, { value: e.target.value })} className="px-3" rows={3} />
                    ) : (
                      <Input value={item.value} onChange={(e) => updateItem(item.id, { value: e.target.value })} className="px-3" />
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Label className="font-mono-label text-[10px] uppercase tracking-wider text-muted-foreground">{t('内容（英）', 'Value (EN)')}</Label>
                    {item.value_en.length > 60 ? (
                      <Textarea value={item.value_en} onChange={(e) => updateItem(item.id, { value_en: e.target.value })} className="px-3" rows={3} />
                    ) : (
                      <Input value={item.value_en} onChange={(e) => updateItem(item.id, { value_en: e.target.value })} className="px-3" />
                    )}
                  </div>
                </div>
                {item.image_url !== undefined && (
                  <div className="mt-4 space-y-1.5">
                    <Label className="font-mono-label text-[10px] uppercase tracking-wider text-muted-foreground">{t('图片 URL（可选）', 'Image URL (optional)')}</Label>
                    <Input value={item.image_url} onChange={(e) => updateItem(item.id, { image_url: e.target.value })} className="px-3" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}