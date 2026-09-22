export interface ContentHeading {
  id: string;
  text: string;
  level: number;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-\u4e00-\u9fa5]/g, '')
    .slice(0, 40);
}

/**
 * 为 HTML 内容中的 h2/h3 标题注入唯一 id，并提取目录结构。
 * 返回 { html: 注入 id 后的 HTML, headings: 目录列表 }
 */
export function injectHeadingIds(html: string): { html: string; headings: ContentHeading[] } {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const headings: ContentHeading[] = [];
  const seen = new Set<string>();

  doc.querySelectorAll('h2, h3').forEach((el) => {
    const text = el.textContent?.trim() || '';
    if (!text) return;
    let baseId = slugify(text) || `heading-${headings.length}`;
    let id = baseId;
    let suffix = 1;
    while (seen.has(id)) {
      id = `${baseId}-${suffix}`;
      suffix += 1;
    }
    seen.add(id);
    el.id = id;
    headings.push({ id, text, level: el.tagName === 'H2' ? 2 : 3 });
  });

  return { html: doc.body.innerHTML, headings };
}
