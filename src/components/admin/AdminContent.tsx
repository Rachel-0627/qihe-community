import { Check, CircleAlert, ExternalLink, Loader2, Save } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/contexts/AuthContext';
import { useI18n } from '@/contexts/I18nContext';
import { useSiteContent } from '@/contexts/SiteContentContext';
import { fetchSiteContent, saveSiteContent } from '@/lib/api';
import type { SiteContent } from '@/types/types';

const SECTION_META: Record<string, { eyebrow: [string, string]; title: [string, string]; description: [string, string] }> = {
  hero: {
    eyebrow: ['首页首屏', 'Homepage hero'],
    title: ['访客进入网站后最先看到的内容', 'The first content visitors see'],
    description: ['管理首页标题、介绍和主要行动按钮。', 'Manage the homepage title, introduction, and primary actions.'],
  },
  footer: {
    eyebrow: ['全站页脚', 'Site footer'],
    title: ['所有页面底部的品牌信息', 'Brand information shown on every page'],
    description: ['这里是页脚文案的唯一编辑入口。', 'This is the only place to edit footer copy.'],
  },
};

const CONTENT_LABELS: Record<string, [string, string]> = {
  'hero.title': ['首页主标题', 'Homepage title'],
  'hero.subtitle': ['首页介绍文字', 'Homepage introduction'],
  'hero.cta_primary': ['主要按钮文字', 'Primary button label'],
  'hero.cta_secondary': ['次要按钮文字', 'Secondary button label'],
  'footer.brand': ['页脚品牌名称', 'Footer brand name'],
  'footer.tagline': ['页脚品牌介绍', 'Footer brand tagline'],
  'footer.copyright': ['页脚版权信息', 'Footer copyright'],
};

export default function AdminContent() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { reload: reloadSiteContent } = useSiteContent();
  const [items, setItems] = useState<SiteContent[]>([]);
  const [savedSignatures, setSavedSignatures] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);

  useEffect(() => {
    if (profile && profile.role !== 'admin') {
      navigate('/', { replace: true });
      return;
    }
    fetchSiteContent()
      .then((rows) => {
        setItems(rows);
        setSavedSignatures(Object.fromEntries(rows.map((item) => [item.id, signatureFor(item)])));
      })
      .catch((error) => toast.error(error instanceof Error ? error.message : t('加载失败', 'Load failed')))
      .finally(() => setLoading(false));
  }, [profile, navigate, t]);

  const updateItem = (id: string, patch: Partial<SiteContent>) => {
    setItems((current) => current.map((item) => item.id === id ? { ...item, ...patch } : item));
  };

  const dirtyItems = useMemo(
    () => items.filter((item) => savedSignatures[item.id] !== signatureFor(item)),
    [items, savedSignatures],
  );

  useEffect(() => {
    if (dirtyItems.length === 0) return;
    const warnBeforeLeaving = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', warnBeforeLeaving);
    return () => window.removeEventListener('beforeunload', warnBeforeLeaving);
  }, [dirtyItems.length]);

  const handleSaveAll = useCallback(async () => {
    if (dirtyItems.length === 0 || saving) return;
    setSaving(true);
    try {
      await Promise.all(dirtyItems.map((item) => saveSiteContent(item)));
      await reloadSiteContent();
      setSavedSignatures(Object.fromEntries(items.map((item) => [item.id, signatureFor(item)])));
      setLastSavedAt(new Date());
      toast.success(t(`已保存 ${dirtyItems.length} 项修改，前台内容已同步`, `Saved ${dirtyItems.length} changes and updated the site`));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('保存失败', 'Save failed'));
    } finally {
      setSaving(false);
    }
  }, [dirtyItems, items, reloadSiteContent, saving, t]);

  const grouped = useMemo(() => items.reduce<Record<string, SiteContent[]>>((result, item) => {
    (result[item.section] ||= []).push(item);
    return result;
  }, {}), [items]);

  if (loading) {
    return <div className="py-16 text-center text-sm text-muted-foreground">{t('正在读取页面内容…', 'Loading page content…')}</div>;
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
                  ? t(`${dirtyItems.length} 项页面内容尚未保存`, `${dirtyItems.length} unsaved page changes`)
                  : t('页面内容已与前台同步', 'Page content is in sync')}
              </p>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {lastSavedAt
                ? t(`最近保存于 ${lastSavedAt.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}`, `Last saved at ${lastSavedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`)
                : t('修改后统一保存，保存成功会立即更新前台。', 'Save all changes together; the live site updates immediately.')}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" asChild className="gap-2 font-mono-label text-xs">
              <a href="/" target="_blank" rel="noreferrer">
                <ExternalLink className="h-4 w-4" />{t('查看前台', 'View site')}
              </a>
            </Button>
            <Button onClick={handleSaveAll} disabled={dirtyItems.length === 0 || saving} className="gap-2 font-mono-label text-xs">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {saving ? t('保存中…', 'Saving…') : t('保存全部更改', 'Save all changes')}
            </Button>
          </div>
        </div>
      </div>

      <div className="mt-6 space-y-8">
        {Object.entries(grouped).map(([section, rows]) => {
          const sectionMeta = SECTION_META[section] ?? {
            eyebrow: [section, section] as [string, string],
            title: ['页面内容', 'Page content'] as [string, string],
            description: ['管理访客在该区域看到的文字。', 'Manage the copy visitors see in this section.'] as [string, string],
          };
          return (
            <section key={section} className="border border-border bg-card">
              <div className="border-b border-border bg-muted/20 p-5">
                <p className="font-mono-label text-[10px] uppercase tracking-[0.16em] text-accent">{t(sectionMeta.eyebrow[0], sectionMeta.eyebrow[1])}</p>
                <h2 className="mt-1 font-display text-lg font-medium">{t(sectionMeta.title[0], sectionMeta.title[1])}</h2>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">{t(sectionMeta.description[0], sectionMeta.description[1])}</p>
              </div>

              <div className="divide-y divide-border">
                {rows.map((item) => {
                  const dirty = savedSignatures[item.id] !== signatureFor(item);
                  const labels = CONTENT_LABELS[`${item.section}.${item.key}`] ?? [item.key, item.key];
                  return (
                    <div key={item.id} className={`grid gap-4 p-5 transition-colors lg:grid-cols-[260px_1fr] ${dirty ? 'bg-accent/[0.045]' : ''}`}>
                      <div>
                        <div className="flex items-center gap-2">
                          <Label htmlFor={`site-content-${item.id}`} className="text-sm font-medium text-foreground">{t(labels[0], labels[1])}</Label>
                          {dirty && <span className="font-mono-label text-[9px] uppercase tracking-wider text-accent">{t('已修改', 'Changed')}</span>}
                        </div>
                        <p className="mt-1 text-xs leading-5 text-muted-foreground">{t('系统会根据中文内容自动补充英文版本。', 'The English version is generated from the Chinese copy.')}</p>
                      </div>
                      <div className="space-y-3">
                        {item.value.length > 60 ? (
                          <Textarea id={`site-content-${item.id}`} value={item.value} onChange={(event) => updateItem(item.id, { value: event.target.value })} className="px-3" rows={4} />
                        ) : (
                          <Input id={`site-content-${item.id}`} value={item.value} onChange={(event) => updateItem(item.id, { value: event.target.value })} className="px-3" />
                        )}
                        {item.image_url !== undefined && item.image_url !== null && (
                          <div className="space-y-1.5">
                            <Label htmlFor={`site-content-image-${item.id}`} className="text-xs text-muted-foreground">{t('配图地址（可选）', 'Image URL (optional)')}</Label>
                            <Input id={`site-content-image-${item.id}`} value={item.image_url} onChange={(event) => updateItem(item.id, { image_url: event.target.value })} className="px-3" />
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function signatureFor(item: SiteContent) {
  return JSON.stringify([item.value, item.image_url ?? '']);
}
