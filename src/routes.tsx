import type { ReactNode } from 'react';
import HomePage from './pages/HomePage';
import CasesPage from './pages/CasesPage';
import ProjectsPage from './pages/ProjectsPage';
import EventsPage from './pages/EventsPage';
import LoginPage from './pages/LoginPage';
import ProfilePage from './pages/ProfilePage';
import BenefitsPage from './pages/BenefitsPage';
import CaseDetailPage from './pages/CaseDetailPage';
import AdminPage from './pages/AdminPage';
import ProjectDetailPage from './pages/ProjectDetailPage';
import EventDetailPage from './pages/EventDetailPage';
import TermsPage from './pages/TermsPage';
import PrivacyPage from './pages/PrivacyPage';
import BusinessCoopPage from './pages/BusinessCoopPage';
import ToolsPage from './pages/ToolsPage';
import ProfileImageProviderPage from './pages/ProfileImageProviderPage';

export interface RouteConfig {
  name: string;
  path: string;
  element: ReactNode;
  visible?: boolean;
  public?: boolean;
}

export const routes: RouteConfig[] = [
  { name: '首页', path: '/', element: <HomePage />, public: true },
  { name: '案例', path: '/cases', element: <CasesPage />, public: true },
  { name: '案例详情', path: '/cases/:id', element: <CaseDetailPage />, public: true },
  { name: '项目库', path: '/projects', element: <ProjectsPage />, public: true },
  { name: '项目详情', path: '/projects/:id', element: <ProjectDetailPage />, public: true },
  { name: '城市组局', path: '/events', element: <EventsPage />, public: true },
  { name: '活动详情', path: '/events/:id', element: <EventDetailPage />, public: true },
  { name: '商务与合作', path: '/business', element: <BusinessCoopPage />, public: true },
  { name: '工具', path: '/tools', element: <ToolsPage />, public: true },
  { name: '权益', path: '/benefits', element: <BenefitsPage />, public: true },
  { name: '登录', path: '/login', element: <LoginPage />, public: true },
  { name: '个人中心', path: '/profile', element: <ProfilePage /> },
  { name: '生图模型配置', path: '/profile/image-provider', element: <ProfileImageProviderPage /> },
  { name: '后台管理', path: '/admin', element: <AdminPage /> },
  { name: '用户协议', path: '/terms', element: <TermsPage />, public: true },
  { name: '隐私政策', path: '/privacy', element: <PrivacyPage />, public: true },
];
