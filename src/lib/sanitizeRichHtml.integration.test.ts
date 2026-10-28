import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

describe('rich-text rendering boundaries', () => {
  it.each([
    ['../components/admin/AdminSubmissions.tsx', 'sanitizeRichHtml(s.payload?.content'],
    ['../pages/DiscussPage.tsx', 'sanitizeRichHtml(content)'],
    ['../components/editor/EditorPreview.tsx', 'sanitizeRichHtml(content)'],
    ['../pages/TermsPage.tsx', 'sanitizeRichHtml(raw)'],
    ['../pages/PrivacyPage.tsx', 'sanitizeRichHtml(raw)'],
  ])('%s sends injected HTML through the shared sanitizer', (path, call) => {
    const text = source(path);
    expect(text).toContain("from '@/lib/sanitizeRichHtml'");
    expect(text).toContain(call);
    expect(text).toContain('dangerouslySetInnerHTML');
  });

  it.each(['../pages/CaseDetailPage.tsx', '../pages/ProjectDetailPage.tsx'])(
    '%s sanitizes the raw body before generating heading ids',
    (path) => {
      const text = source(path);
      expect(text).toContain("from '@/lib/sanitizeRichHtml'");
      expect(text).toMatch(/injectHeadingIds\(sanitizeRichHtml\(rawContent\)\)/);
      expect(text).toContain('dangerouslySetInnerHTML');
    },
  );
});
