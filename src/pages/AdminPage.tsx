import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useI18n } from '@/contexts/I18nContext';
import { useAuth } from '@/contexts/AuthContext';
import { LayoutGrid, PenLine, Settings2, Sparkles, Users, ArrowLeft, Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from '@/components/ui/sheet';
import AdminContentHub from '@/components/admin/AdminContentHub';
import AdminCopywriting from '@/components/admin/AdminCopywriting';
import AdminBenefits from '@/components/admin/AdminBenefits';
import AdminAssistant from '@/components/admin/AdminAssistant';
import AdminAccounts from '@/components/admin/AdminAccounts';

type TabKey = 'content' | 'copywriting' | 'benefits' | 'assistant' | 'accounts';

/**
 * 后台管理：五大入口（内容管理 / 网站文案 / 权益管理 / 智能助手 / 账号管理）。
 * 原十个分散入口已合并：
 * - 内容管理 = 案例管理 + 项目管理 + 项目筛选 + 活动管理 + 活动筛选
 * - 网站文案 = 站点设置（品牌/导航/协议） + 站点内容（首页 Hero / 页脚）
 */
export default function AdminPage() {
  const { t } = useI18n();
  const { profile, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<TabKey>('content');
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (!authLoading && profile && profile.role !== 'admin') {
      navigate('/', { replace: true });
    }
  }, [authLoading, profile, navigate]);

  if (authLoading || !profile) {
    return <div className="py-24 text-center text-sm text-muted-foreground">{t('加载中…', 'Loading…')}</div>;
  }
  if (profile.role !== 'admin') return null;

  const tabs: { key: TabKey; zh: string; en: string; icon: React.ReactNode }[] = [
    { key: 'content', zh: '内容管理', en: 'Content', icon: <LayoutGrid className="h-4 w-4" /> },
    { key: 'copywriting', zh: '网站文案', en: 'Site Copywriting', icon: <PenLine className="h-4 w-4" /> },
    { key: 'benefits', zh: '权益管理', en: 'Benefits', icon: <Settings2 className="h-4 w-4" /> },
    { key: 'assistant', zh: '智能助手', en: 'AI Assistant', icon: <Sparkles className="h-4 w-4" /> },
    { key: 'accounts', zh: '账号管理', en: 'Accounts', icon: <Users className="h-4 w-4" /> },
  ];

  const renderTab = () => {
    switch (tab) {
      case 'content': return <AdminContentHub />;
      case 'copywriting': return <AdminCopywriting />;
      case 'benefits': return <AdminBenefits />;
      case 'assistant': return <AdminAssistant />;
      case 'accounts': return <AdminAccounts />;
    }
  };

  const NavItems = ({ onNavigate }: { onNavigate?: () => void }) => (
    <nav className="flex flex-col gap-1">
      {tabs.map((item) => (
        <button
          key={item.key}
          type="button"
          onClick={() => { setTab(item.key); onNavigate?.(); }}
          className={`flex min-h-12 items-center gap-3 px-3 font-mono-label text-xs uppercase tracking-wider transition-colors ${tab === item.key ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}
        >
          {item.icon}
          {t(item.zh, item.en)}
        </button>
      ))}
    </nav>
  );

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 md:px-8 md:py-12">
      <div className="flex items-center justify-between">
        <div>
          <p className="editorial-label text-accent">{t('后台管理', 'Admin')}</p>
          <h1 className="mt-1 font-display text-2xl font-medium md:text-3xl">{t('管理控制台', 'Management Console')}</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => navigate('/')} className="font-mono-label text-xs">
            <ArrowLeft className="mr-1 h-3.5 w-3.5" />{t('返回前台', 'Back to site')}
          </Button>
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon" className="md:hidden"><Menu className="h-4 w-4" /></Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 bg-sidebar">
              <SheetTitle className="font-display text-base">{t('管理导航', 'Admin Nav')}</SheetTitle>
              <div className="mt-6"><NavItems onNavigate={() => setMobileOpen(false)} /></div>
            </SheetContent>
          </Sheet>
        </div>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-[220px_1fr]">
        <aside className="hidden lg:block">
          <div className="lg:sticky lg:top-24">
            <NavItems />
          </div>
        </aside>
        <div className="min-w-0">{renderTab()}</div>
      </div>
    </div>
  );
}
