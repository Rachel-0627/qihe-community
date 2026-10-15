import { Cog, LayoutTemplate } from 'lucide-react';
import { useState } from 'react';
import AdminContent from '@/components/admin/AdminContent';
import AdminSiteSettings from '@/components/admin/AdminSiteSettings';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useI18n } from '@/contexts/I18nContext';

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
        <p className="editorial-label text-accent">{t('页面装修', 'Site Appearance')}</p>
        <h2 className="mt-1 font-display text-xl font-medium">{t('按访客看到的位置管理网站', 'Manage the site by what visitors see')}</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          {t('全站设置负责品牌、导航和规则；页面内容负责首页与页脚。每项内容只保留一个明确的编辑入口。', 'Global settings control branding, navigation, and rules. Page content controls the homepage and footer.')}
        </p>
      </div>

      <Tabs value={section} onValueChange={(v) => setSection(v as typeof section)} className="mt-6">
        <TabsList className="h-auto w-full flex-wrap justify-start gap-1 bg-muted/40 p-1">
          <TabsTrigger value="brand" className="gap-1.5 px-3 py-2 font-mono-label text-xs uppercase tracking-wider data-[state=active]:bg-card">
            <Cog className="h-3.5 w-3.5" />{t('全站设置', 'Global Settings')}
          </TabsTrigger>
          <TabsTrigger value="pages" className="gap-1.5 px-3 py-2 font-mono-label text-xs uppercase tracking-wider data-[state=active]:bg-card">
            <LayoutTemplate className="h-3.5 w-3.5" />{t('首页与页脚', 'Homepage & Footer')}
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
