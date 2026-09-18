import { useState } from 'react';
import { useI18n } from '@/contexts/I18nContext';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Cog, LayoutTemplate } from 'lucide-react';
import AdminSiteSettings from '@/components/admin/AdminSiteSettings';
import AdminContent from '@/components/admin/AdminContent';

/**
 * 网站文案（五大入口之一）：
 * 品牌与导航配置（AdminSiteSettings：站点名/Logo/导航标签/协议文案）
 * + 页面文案配置（AdminContent：首页 Hero / 页脚）统一在一个入口编辑。
 */
export default function AdminCopywriting() {
  const { t } = useI18n();
  const [section, setSection] = useState<'brand' | 'pages'>('brand');

  return (
    <div>
      <div>
        <p className="editorial-label text-accent">{t('网站文案', 'Site Copywriting')}</p>
        <h2 className="mt-1 font-display text-xl font-medium">{t('导航与全站文字', 'Navigation & site-wide copy')}</h2>
      </div>

      <Tabs value={section} onValueChange={(v) => setSection(v as typeof section)} className="mt-6">
        <TabsList className="h-auto w-full flex-wrap justify-start gap-1 bg-muted/40 p-1">
          <TabsTrigger value="brand" className="gap-1.5 px-3 py-2 font-mono-label text-xs uppercase tracking-wider data-[state=active]:bg-card">
            <Cog className="h-3.5 w-3.5" />{t('品牌与导航', 'Brand & Nav')}
          </TabsTrigger>
          <TabsTrigger value="pages" className="gap-1.5 px-3 py-2 font-mono-label text-xs uppercase tracking-wider data-[state=active]:bg-card">
            <LayoutTemplate className="h-3.5 w-3.5" />{t('页面文案', 'Page Copy')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="brand" className="mt-6">
          <AdminSiteSettings />
        </TabsContent>
        <TabsContent value="pages" className="mt-6">
          <AdminContent />
        </TabsContent>
      </Tabs>
    </div>
  );
}
