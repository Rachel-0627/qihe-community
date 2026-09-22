import type { ReactNode } from 'react';
import Header from './Header';
import Footer from './Footer';
import AIAssistant from '@/components/common/AIAssistant';
import { RouteGuard } from '@/components/common/RouteGuard';
import { AIAssistantProvider } from '@/contexts/AIAssistantContext';

export default function MainLayout({ children }: { children: ReactNode }) {
  return (
    // 本站为固定深色主题，显式添加 .dark 以激活 Tailwind 的 dark: 变体（如 dark:prose-invert）。
    <div className="dark flex min-h-screen w-full flex-col bg-background">
      <AIAssistantProvider>
        <Header />
        <main className="flex-1 min-w-0">
          {/* 路由守卫：未登录访问受保护页面时跳转登录页。
              放在这里而非 App.tsx，是因为 App.tsx 在秒哒里是只读的框架文件。 */}
          <RouteGuard>{children}</RouteGuard>
        </main>
        <Footer />
        <AIAssistant />
      </AIAssistantProvider>
    </div>
  );
}