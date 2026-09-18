import { useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useI18n } from '@/contexts/I18nContext';
import { useSiteSettings } from '@/contexts/SiteSettingsContext';
import { useReveal } from '@/hooks/useReveal';

export default function BusinessCoopPage() {
  const { lang } = useI18n();
  const { businessCoop } = useSiteSettings();
  const revealRef = useReveal<HTMLDivElement>();

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  if (!businessCoop.visible) {
    return <Navigate to="/" replace />;
  }

  const content = lang === 'en' && businessCoop.contentEn
    ? businessCoop.contentEn
    : businessCoop.content;

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 md:px-8 md:py-16" ref={revealRef}>
      <div data-reveal className="border-b border-border pb-6">
        <p className="editorial-label text-accent">{lang === 'en' ? 'Business' : '商务与合作'}</p>
        <h1 className="mt-2 font-display text-3xl font-medium text-foreground text-balance md:text-4xl">
          {lang === 'en' ? 'Business & Cooperation' : '商务与合作'}
        </h1>
      </div>

      <div
        data-reveal
        className="prose prose-base mt-8 max-w-none dark:prose-invert"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: content }}
      />
    </div>
  );
}
