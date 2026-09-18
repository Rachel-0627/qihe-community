import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { routes } from '@/routes';

interface RouteGuardProps {
  children: React.ReactNode;
}

// System-level public routes (no need to register in routes.tsx)
const SYSTEM_PUBLIC_ROUTES = ['/login', '/403', '/404'];

// Derived from routes.tsx: all routes marked with public: true
const routePublicPaths = routes.filter(r => r.public).map(r => r.path);

const PUBLIC_ROUTES = [...SYSTEM_PUBLIC_ROUTES, ...routePublicPaths];
// 所有已登记的路由（含受保护的），用于识别「未知路径」
const KNOWN_ROUTES = [...SYSTEM_PUBLIC_ROUTES, ...routes.map(r => r.path)];

/**
 * 把路由模式转成正则。
 * 必须支持 /cases/:id 这类动态段 —— 只做精确比较的话，
 * /cases/abc-123 匹配不上 /cases/:id，游客点开详情页会被误踢到登录页。
 */
function patternToRegex(pattern: string) {
  const escaped = pattern
    .replace(/[.+?^${}()|[\]\\]/g, '\\$&') // 转义正则元字符，保留 : 与 *
    .replace(/:[^/]+/g, '[^/]+')           // :id → 任意单个路径段
    .replace(/\*/g, '.*');                 // *   → 任意内容
  return new RegExp('^' + escaped + '$');
}

function matchRoute(path: string, patterns: string[]) {
  return patterns.some(pattern => pattern === path || patternToRegex(pattern).test(path));
}

export function RouteGuard({ children }: RouteGuardProps) {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const isPublic = matchRoute(location.pathname, PUBLIC_ROUTES);
  const isKnown = matchRoute(location.pathname, KNOWN_ROUTES);

  // 未知路径不在这里拦截，交给 routes 里的 * 兜底处理，
  // 否则游客打错一个网址会被送去登录页，而不是回首页
  const needsAuth = isKnown && !isPublic;

  useEffect(() => {
    if (loading || !needsAuth) return;
    if (!user) {
      navigate('/login', { state: { from: location.pathname }, replace: true });
    }
  }, [user, loading, needsAuth, location.pathname, navigate]);

  // 只有受保护页面才需要等待鉴权结果。
  // 公开页面直接渲染 —— 否则首页每次加载都要整屏转圈等 session 返回。
  if (needsAuth && (loading || !user)) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return <>{children}</>;
}
