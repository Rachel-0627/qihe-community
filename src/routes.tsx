import { Navigate, useParams } from 'react-router-dom';
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
import DiscussPage from './pages/DiscussPage';
import ToolsPage from './pages/ToolsPage';
import ProfileImageProviderPage from './pages/ProfileImageProviderPage';
import SubmitCasePage from './pages/SubmitCasePage';
import SubmitProjectPage from './pages/SubmitProjectPage';
import SubmitDiscussPostPage from './pages/SubmitDiscussPostPage';
import DiscussPostDetailPage from './pages/DiscussPostDetailPage';

export interface RouteConfig {
  name: string;
  path: string;
  element: ReactNode;
  visible?: boolean;
  public?: boolean;
}


/** 旧的 /business/<id> 链接要带着 id 跳到新路径。
 *  直接 <Navigate to="/discuss"> 会把 id 丢掉，点进来只会回到列表，
 *  看起来就像「点了没反应」。 */
function RedirectDiscussPost() {
  const { id } = useParams<{ id: string }>();
  return <Navigate to={id ? `/discuss/${id}` : '/discuss'} replace />;
}

export const routes: RouteConfig[] = [
  { name: '首页', path: '/', element: <HomePage />, public: true },
  { name: '案例', path: '/cases', element: <CasesPage />, public: true },
  { name: '案例详情', path: '/cases/:id', element: <CaseDetailPage />, public: true },
  { name: '项目库', path: '/projects', element: <ProjectsPage />, public: true },
  { name: '项目详情', path: '/projects/:id', element: <ProjectDetailPage />, public: true },
  { name: '城市组局', path: '/events', element: <EventsPage />, public: true },
  { name: '活动详情', path: '/events/:id', element: <EventDetailPage />, public: true },
  { name: '分享讨论区', path: '/discuss', element: <DiscussPage />, public: true },
  { name: '帖子详情', path: '/discuss/:id', element: <DiscussPostDetailPage />, public: true },
  // 板块原来叫「商务与合作」，旧链接可能已被收藏或分享出去，留个重定向
  { name: '旧商务页', path: '/business', element: <Navigate to="/discuss" replace />, public: true },
  { name: '旧商务帖', path: '/business/:id', element: <RedirectDiscussPost />, public: true },
  { name: '工具', path: '/tools', element: <ToolsPage />, public: true },
  { name: '权益', path: '/benefits', element: <BenefitsPage />, public: true },
  { name: '登录', path: '/login', element: <LoginPage />, public: true },
  { name: '发布案例', path: '/submit/case', element: <SubmitCasePage /> },
  { name: '发布项目', path: '/submit/project', element: <SubmitProjectPage /> },
  { name: '发布帖子', path: '/submit/discuss', element: <SubmitDiscussPostPage /> },
  { name: '个人中心', path: '/profile', element: <ProfilePage /> },
  { name: '生图模型配置', path: '/profile/image-provider', element: <ProfileImageProviderPage /> },
  { name: '后台管理', path: '/admin', element: <AdminPage /> },
  { name: '用户协议', path: '/terms', element: <TermsPage />, public: true },
  { name: '隐私政策', path: '/privacy', element: <PrivacyPage />, public: true },
];
