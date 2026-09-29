export interface ContentHeading {
  id: string;
  text: string;
  level: number;
  /** 章节永久编号，见 @/lib/chapters */
  ch?: string;
  /** 正文被付费墙扣下了，目录里只显示标题 */
  locked?: boolean;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-\u4e00-\u9fa5]/g, '')
    .slice(0, 40);
}

/**
 * 为 HTML 内容中的 h1/h2/h3 标题注入唯一 id，并提取目录结构。
 *
 * 为什么带上 h1：实际内容里有文章整篇用 h1 分章、一个 h2 都没有，
 * 只认 h2/h3 的话这类文章的目录是空的。
 * 返回 { html: 注入 id 后的 HTML, headings: 目录列表 }
 */
export function injectHeadingIds(html: string): { html: string; headings: ContentHeading[] } {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const headings: ContentHeading[] = [];
  const seen = new Set<string>();

  doc.querySelectorAll('h1, h2, h3').forEach((el) => {
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
    headings.push({
      id,
      text,
      // h1 与 h2 都视作「章」，同级不缩进
      level: el.tagName === 'H3' ? 3 : 2,
      ch: el.getAttribute('data-ch') ?? undefined,
    });
  });

  return { html: doc.body.innerHTML, headings };
}
