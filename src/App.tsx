import React, { Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import IntersectObserver from '@/components/common/IntersectObserver';
import { Toaster } from '@/components/ui/sonner';
import { AuthProvider } from '@/contexts/AuthContext';
import { I18nProvider } from '@/contexts/I18nContext';
import { SiteSettingsProvider } from '@/contexts/SiteSettingsContext';
import { SiteContentProvider } from '@/contexts/SiteContentContext';
import MainLayout from '@/components/layouts/MainLayout';
import RouteFallback from '@/components/common/RouteFallback';

import { routes } from './routes';

const App: React.FC = () => {
  return (
    <Router>
      <I18nProvider>
        <AuthProvider>
          <SiteSettingsProvider>
          <SiteContentProvider>
          <IntersectObserver />
          <MainLayout>
            {/* 懒加载的页面在加载那一瞬间没有内容可渲染，
                没有 Suspense 兜底会直接抛错。放在这一层：
                换页时只有内容区出骨架，顶栏和底栏不闪 */}
            <Suspense fallback={<RouteFallback />}>
              <Routes>
                {routes.map((route, index) => (
                  <Route key={index} path={route.path} element={route.element} />
                ))}
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Suspense>
          </MainLayout>
          <Toaster />
          </SiteContentProvider>
          </SiteSettingsProvider>
        </AuthProvider>
      </I18nProvider>
    </Router>
  );
};

export default App;
