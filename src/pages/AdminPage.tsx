import { ArrowLeft, Inbox, LayoutDashboard, LayoutGrid, Menu, PenLine, Settings2, Sparkles, Users } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AdminAccounts from '@/components/admin/AdminAccounts';
import AdminAssistant from '@/components/admin/AdminAssistant';
import AdminBenefits from '@/components/admin/AdminBenefits';
import AdminContentHub from '@/components/admin/AdminContentHub';
import AdminCopywriting from '@/components/admin/AdminCopywriting';
import AdminOverview from '@/components/admin/AdminOverview';
import AdminSubmissions from '@/components/admin/AdminSubmissions';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { useAuth } from '@/contexts/AuthContext';
import { useI18n } from '@/contexts/I18nContext';

type TabKey = 'overview' | 'content' | 'submissions' | 'copywriting' | 'benefits' | 'assistant' | 'accounts';

/**
 * 后台按站长任务组织：工作台集中待办与快捷入口，其余模块负责具体维护。
 * 内容中心合并案例、项目、活动、广场和工具；页面装修统一全站设置与首页/页脚。
 */
export default function AdminPage() {
  const { t } = useI18n();
  const { user, profile, loading: authLoading, profileLoading, profileError, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<TabKey>('overview');
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/login', { replace: true });
    }
  }, [authLoading, user, navigate]);

  if (authLoading) {
    return <div className="py-24 text-center text-sm text-muted-foreground">{t('加载中…', 'Loading…')}</div>;
  }
  if (!user) return <div className="py-24 text-center text-sm text-muted-foreground">{t('请先登录后访问后台。', 'Please sign in to access the admin console.')}</div>;
  if (profileLoading) {
    return <div className="py-24 text-center text-sm text-muted-foreground">{t('正在读取用户资料…', 'Loading your profile…')}</div>;
  }
  if (profileError) {
    return (
      <div className="mx-auto max-w-xl py-24 text-center">
        <p role="alert" className="text-sm text-destructive">{t('读取用户资料失败，请检查网络后重试。', 'Could not load your profile. Check your connection and try again.')} {profileError.message}</p>
        <Button className="mt-4" onClick={() => void refreshProfile()}>{t('重试', 'Retry')}</Button>
      </div>
    );
  }
  if (!profile) {
    return (
      <div className="mx-auto max-w-xl py-24 text-center">
        <p role="status" className="text-sm text-muted-foreground">{t('未找到当前账号的用户资料，请重试或联系管理员。', 'No profile was found for this account. Retry or contact an administrator.')}</p>
        <Button className="mt-4" onClick={() => void refreshProfile()}>{t('重试', 'Retry')}</Button>
      </div>
    );
  }
  if (profile.role !== 'admin') {
    return (
      <div className="mx-auto max-w-xl py-24 text-center">
        <p role="alert" className="text-sm text-destructive">{t('当前账号没有管理员权限。', 'This account does not have administrator access.')}</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate('/')}>{t('返回前台', 'Back to site')}</Button>
      </div>
    );
  }

  const tabs: { key: TabKey; zh: string; en: string; icon: React.ReactNode }[] = [
    { key: 'overview', zh: '工作台', en: 'Overview', icon: <LayoutDashboard className="h-4 w-4" /> },
    { key: 'content', zh: '内容中心', en: 'Content', icon: <LayoutGrid className="h-4 w-4" /> },
    { key: 'submissions', zh: '投稿审核', en: 'Submissions', icon: <Inbox className="h-4 w-4" /> },
    { key: 'copywriting', zh: '页面装修', en: 'Site Appearance', icon: <PenLine className="h-4 w-4" /> },
    { key: 'benefits', zh: '会员与权益', en: 'Membership', icon: <Settings2 className="h-4 w-4" /> },
    { key: 'assistant', zh: '智能助手', en: 'AI Assistant', icon: <Sparkles className="h-4 w-4" /> },
    { key: 'accounts', zh: '账号管理', en: 'Accounts', icon: <Users className="h-4 w-4" /> },
  ];

  const renderTab = () => {
    switch (tab) {
      case 'overview': return <AdminOverview onNavigate={setTab} />;
      case 'content': return <AdminContentHub />;
      case 'submissions': return <AdminSubmissions />;
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
              <Button variant="outline" size="icon" className="lg:hidden"><Menu className="h-4 w-4" /></Button>
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
