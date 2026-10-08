import { useEffect } from 'react';
import { useI18n } from '@/contexts/I18nContext';
import { useReveal } from '@/hooks/useReveal';
import PromptCaseLibrary from '@/components/tools/PromptCaseLibrary';
import AiToolGrid from '@/components/tools/AiToolGrid';

export default function ToolsPage() {
  const { lang } = useI18n();
  const revealRef = useReveal<HTMLDivElement>();

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  return (
    <div className="mx-auto max-w-7xl px-4 pt-1 pb-8 md:px-8" ref={revealRef}>
      <div data-reveal className="mb-10">
        <div className="mb-3">
          <h2 className="font-display text-base font-medium text-foreground md:text-lg">
            {lang === 'en' ? 'Useful AI Tools' : '实用 AI 工具'}
          </h2>
          <p className="text-xs text-muted-foreground">
            {lang === 'en'
              ? 'Hand-picked, ready-to-use tools. Opens on the provider\u2019s own site.'
              : '精选可直接上手的工具，点击前往工具所在平台使用。'}
          </p>
        </div>
        <AiToolGrid />
      </div>

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
