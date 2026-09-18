import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useState, useMemo, useEffect } from 'react';
import { Menu, Globe, User, Award, LogOut, Settings } from 'lucide-react';
import { useI18n } from '@/contexts/I18nContext';
import { useAuth } from '@/contexts/AuthContext';
import { useSiteSettings } from '@/contexts/SiteSettingsContext';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from '@/components/ui/sheet';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

const DEFAULT_NAV_ITEMS = [
  { path: '/', key: 'nav_home' },
  { path: '/cases', key: 'nav_cases' },
  { path: '/projects', key: 'nav_projects' },
  { path: '/events', key: 'nav_events' },
  { path: '/business', key: 'nav_business' },
];

export default function Header() {
  const { t, lang, toggleLang } = useI18n();
  const { user, profile, signOut } = useAuth();
  const { brandName, brandNameEn, navLabels, businessCoop } = useSiteSettings();
  const location = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const navItems = useMemo(() => DEFAULT_NAV_ITEMS
    .filter((item) => item.path !== '/business' || businessCoop.visible)
    .map((item) => ({
      ...item,
      zh: navLabels[item.path]?.zh ?? (item.path === '/business' ? '商务与合作' : item.path),
      en: navLabels[item.path]?.en ?? (item.path === '/business' ? 'Business' : item.path),
    })), [navLabels, businessCoop.visible]);

  const isActive = (path: string) =>
    path === '/' ? location.pathname === '/' : location.pathname.startsWith(path);

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  return (
    <header
      className={`sticky top-0 z-40 w-full border-b transition-colors duration-300 ${
        scrolled
          ? 'border-border bg-[rgba(9,10,12,.88)] backdrop-blur-[22px]'
          : 'border-transparent bg-background/85 backdrop-blur-md'
      }`}
    >
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-4 md:px-8">
        <Link to="/" className="flex items-center shrink-0">
          <span className="font-display text-2xl font-semibold tracking-tight text-[#ecebe7]">{t(brandName, brandNameEn)}</span>
        </Link>

        <nav className="hidden md:flex items-center gap-8">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`font-mono-label text-base tracking-[0.02em] transition-colors hover:text-[#ecebe7] ${
                isActive(item.path) ? 'text-[#ecebe7]' : 'text-[#8d9098]'
              }`}
            >
              {t(item.zh, item.en)}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2 md:gap-3 shrink-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleLang}
            className="font-mono-label text-base gap-1.5 text-[#8d9098] hover:bg-transparent hover:text-[#ecebe7]"
          >
            <Globe className="h-3.5 w-3.5" />
            {lang === 'zh' ? 'EN' : '中'}
          </Button>

          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="secondary" size="sm" className="gap-1.5 font-mono-label text-base">
                  <Avatar className="h-5 w-5">
                    <AvatarImage src={profile?.avatar_url ?? undefined} alt={profile?.nickname || profile?.username || ''} />
                    <AvatarFallback className="bg-primary text-sm text-primary-foreground">
                      {(profile?.nickname || profile?.username || 'U')[0].toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span className="hidden sm:inline">{profile?.nickname || profile?.username || 'Me'}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem asChild>
                  <Link to="/profile" className="flex cursor-pointer items-center gap-2">
                    <User className="h-4 w-4" />{t('个人中心', 'Profile')}
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/benefits" className="flex cursor-pointer items-center gap-2">
                    <Award className="h-4 w-4" />{t('我的权益', 'My Benefits')}
                  </Link>
                </DropdownMenuItem>
                {profile?.role === 'admin' && (
                  <DropdownMenuItem asChild>
                    <Link to="/admin" className="flex cursor-pointer items-center gap-2">
                      <Settings className="h-4 w-4" />{t('后台管理', 'Admin')}
                    </Link>
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut} className="flex cursor-pointer items-center gap-2 text-muted-foreground">
                  <LogOut className="h-4 w-4" />{t('退出登录', 'Sign out')}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Link to="/login">
              <Button size="sm" className="font-mono-label text-base">
                {t('登录', 'Sign in')}
              </Button>
            </Link>
          )}

          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-72 bg-background">
              <SheetTitle className="font-display text-xl">{t('导航', 'Navigation')}</SheetTitle>
              <div className="mt-8 flex flex-col gap-1">
                {navItems.map((item) => (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setOpen(false)}
                    className={`flex min-h-12 items-center font-mono-label text-lg tracking-[0.02em] transition-colors ${
                      isActive(item.path) ? 'text-accent' : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {t(item.zh, item.en)}
                  </Link>
                ))}
                {profile?.role === 'admin' && (
                  <Link
                    to="/admin"
                    onClick={() => setOpen(false)}
                    className="flex min-h-12 items-center font-mono-label text-lg tracking-[0.02em] text-muted-foreground hover:text-foreground"
                  >
                    {t('后台管理', 'Admin')}
                  </Link>
                )}
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}