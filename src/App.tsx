import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import IntersectObserver from '@/components/common/IntersectObserver';
import { Toaster } from '@/components/ui/sonner';
import { AuthProvider } from '@/contexts/AuthContext';
import { I18nProvider } from '@/contexts/I18nContext';
import { SiteSettingsProvider } from '@/contexts/SiteSettingsContext';
import { SiteContentProvider } from '@/contexts/SiteContentContext';
import MainLayout from '@/components/layouts/MainLayout';

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
            <Routes>
              {routes.map((route, index) => (
                <Route key={index} path={route.path} element={route.element} />
              ))}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
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
