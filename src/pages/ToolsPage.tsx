import { useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useI18n } from '@/contexts/I18nContext';
import { useSiteSettings } from '@/contexts/SiteSettingsContext';
import { useReveal } from '@/hooks/useReveal';
import PromptCaseLibrary from '@/components/tools/PromptCaseLibrary';

export default function ToolsPage() {
  const { lang } = useI18n();
  const { tools } = useSiteSettings();
  const revealRef = useReveal<HTMLDivElement>();

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  if (!tools.visible) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="mx-auto max-w-7xl px-4 pt-1 pb-8 md:px-8" ref={revealRef}>
      <div data-reveal>
        <div className="mb-2">
          <h2 className="font-display text-base font-medium text-foreground md:text-lg">
            {lang === 'en' ? 'Image Prompt Case Library' : '生图提示词案例库'}
          </h2>
          <p className="text-xs text-muted-foreground">
            {lang === 'en'
              ? 'Explore curated prompts by category, style and scene.'
              : '按分类、风格、场景筛选，发现优质生图提示词。'}
          </p>
        </div>
        <PromptCaseLibrary />
      </div>
    </div>
  );
}
