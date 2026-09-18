import { useMemo } from 'react';
import { Helmet } from 'react-helmet-async';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { useI18n } from '@/contexts/I18nContext';
import { useSiteSettings } from '@/contexts/SiteSettingsContext';

export default function TermsPage() {
  const { t } = useI18n();
  const { brandName, termsContent } = useSiteSettings();

  const html = useMemo(() => {
    const raw = marked.parse(termsContent || '', { async: false }) as string;
    return DOMPurify.sanitize(raw);
  }, [termsContent]);

  const pageTitle = `${t('用户协议', 'Terms of Service')} - ${brandName || t('启禾社区', 'Qihe Community')}`;

  return (
    <main className="flex-1 bg-background">
      <Helmet>
        <title>{pageTitle}</title>
        <meta name="description" content={t('用户协议', 'Terms of Service')} />
      </Helmet>
      <div className="mx-auto max-w-3xl px-4 py-12 md:px-8 md:py-20">
        <h1 className="font-display text-3xl font-semibold tracking-tight text-foreground md:text-4xl text-balance">
          {t('用户协议', 'Terms of Service')}
        </h1>
        <div
          className="prose prose-neutral mt-8 max-w-none text-foreground dark:prose-invert"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </div>
    </main>
  );
}
