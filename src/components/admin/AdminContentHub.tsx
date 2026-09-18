import { useState } from 'react';
import { useI18n } from '@/contexts/I18nContext';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible';
import { FileText, FolderKanban, CalendarDays, Handshake, SlidersHorizontal, ChevronDown } from 'lucide-react';
import AdminCases from '@/components/admin/AdminCases';
import AdminProjects from '@/components/admin/AdminProjects';
import AdminEvents from '@/components/admin/AdminEvents';
import AdminBusinessCoop from '@/components/admin/AdminBusinessCoop';
import AdminCaseFilters from '@/components/admin/AdminCaseFilters';
import AdminProjectFilters from '@/components/admin/AdminProjectFilters';
import AdminEventFilters from '@/components/admin/AdminEventFilters';

/**
 * 内容管理（五大入口之一）：
 * 案例 / 项目库 / 城市组局 三个板块的内容编辑合并到一个入口，
 * 通过二级 Tab 切换；筛选配置以折叠面板内嵌在对应 Tab 里。
 */
export default function AdminContentHub() {
  const { t } = useI18n();
  const [section, setSection] = useState<'cases' | 'projects' | 'events' | 'business'>('cases');
  const [cfOpen, setCfOpen] = useState(false);
  const [pfOpen, setPfOpen] = useState(false);
  const [efOpen, setEfOpen] = useState(false);

  return (
    <div>
      <div>
        <p className="editorial-label text-accent">{t('内容管理', 'Content')}</p>
        <h2 className="mt-1 font-display text-xl font-medium">{t('案例 · 项目库 · 城市组局 · 商务与合作', 'Cases · Projects · Events · Business')}</h2>
      </div>

      <Tabs value={section} onValueChange={(v) => setSection(v as typeof section)} className="mt-6">
        <TabsList className="h-auto w-full flex-wrap justify-start gap-1 bg-muted/40 p-1">
          <TabsTrigger value="cases" className="gap-1.5 px-3 py-2 font-mono-label text-xs uppercase tracking-wider data-[state=active]:bg-card">
            <FileText className="h-3.5 w-3.5" />{t('案例', 'Cases')}
          </TabsTrigger>
          <TabsTrigger value="projects" className="gap-1.5 px-3 py-2 font-mono-label text-xs uppercase tracking-wider data-[state=active]:bg-card">
            <FolderKanban className="h-3.5 w-3.5" />{t('项目库', 'Projects')}
          </TabsTrigger>
          <TabsTrigger value="events" className="gap-1.5 px-3 py-2 font-mono-label text-xs uppercase tracking-wider data-[state=active]:bg-card">
            <CalendarDays className="h-3.5 w-3.5" />{t('城市组局', 'Events')}
          </TabsTrigger>
          <TabsTrigger value="business" className="gap-1.5 px-3 py-2 font-mono-label text-xs uppercase tracking-wider data-[state=active]:bg-card">
            <Handshake className="h-3.5 w-3.5" />{t('商务与合作', 'Business')}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="cases" className="mt-6">
          <Collapsible open={cfOpen} onOpenChange={setCfOpen} className="mb-6 border border-border bg-card">
            <CollapsibleTrigger className="flex w-full items-center justify-between px-4 py-3 font-mono-label text-xs uppercase tracking-wider text-muted-foreground transition-colors hover:text-foreground">
              <span className="flex items-center gap-1.5">
                <SlidersHorizontal className="h-3.5 w-3.5" />
                {t('案例分类配置', 'Case category options')}
              </span>
              <ChevronDown className={`h-4 w-4 transition-transform ${cfOpen ? 'rotate-180' : ''}`} />
            </CollapsibleTrigger>
            <CollapsibleContent className="border-t border-border px-4 py-4">
              <AdminCaseFilters />
            </CollapsibleContent>
          </Collapsible>
          <AdminCases />
        </TabsContent>

        <TabsContent value="projects" className="mt-6">
          <Collapsible open={pfOpen} onOpenChange={setPfOpen} className="mb-6 border border-border bg-card">
            <CollapsibleTrigger className="flex w-full items-center justify-between px-4 py-3 font-mono-label text-xs uppercase tracking-wider text-muted-foreground transition-colors hover:text-foreground">
              <span className="flex items-center gap-1.5">
                <SlidersHorizontal className="h-3.5 w-3.5" />
                {t('项目库筛选与类别配置', 'Project filter & category options')}
              </span>
              <ChevronDown className={`h-4 w-4 transition-transform ${pfOpen ? 'rotate-180' : ''}`} />
            </CollapsibleTrigger>
            <CollapsibleContent className="border-t border-border px-4 py-4">
              <AdminProjectFilters />
            </CollapsibleContent>
          </Collapsible>
          <AdminProjects />
        </TabsContent>

        <TabsContent value="events" className="mt-6">
          <Collapsible open={efOpen} onOpenChange={setEfOpen} className="mb-6 border border-border bg-card">
            <CollapsibleTrigger className="flex w-full items-center justify-between px-4 py-3 font-mono-label text-xs uppercase tracking-wider text-muted-foreground transition-colors hover:text-foreground">
              <span className="flex items-center gap-1.5">
                <SlidersHorizontal className="h-3.5 w-3.5" />
                {t('城市与主题筛选配置', 'City & theme filter options')}
              </span>
              <ChevronDown className={`h-4 w-4 transition-transform ${efOpen ? 'rotate-180' : ''}`} />
            </CollapsibleTrigger>
            <CollapsibleContent className="border-t border-border px-4 py-4">
              <AdminEventFilters />
            </CollapsibleContent>
          </Collapsible>
          <AdminEvents />
        </TabsContent>

        <TabsContent value="business" className="mt-6">
          <AdminBusinessCoop />
        </TabsContent>
      </Tabs>
    </div>
  );
}
