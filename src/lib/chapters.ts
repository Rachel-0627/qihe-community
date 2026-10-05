/**
 * 章节永久编号（data-ch）。
 *
 * 免费名单记编号而非章节序号：插删或调序会使序号指向别的章节，且不报错。
 * 编号在保存正文时写入标题标签，随章节移动。
 *
 * 采用字符串处理而非 DOMParser：后者会重新序列化整段 HTML，
 * 等于改写用户未编辑的部分；此处只增加一个属性。
 *
 * 切分规则须与迁移 00040 的 get_project_content 一致，
 * 两处不同步会导致后台勾选的章节与前台放行的章节不符。
 */

export interface Chapter {
  /** 永久编号 */
  ch: string;
  /** 章节标题（纯文本） */
  text: string;
}

/**
 * 判断这篇正文用哪一级标题分章。
 *
 * 实际内容里两种写法都有：有的用 h1 分章、h2 分节，有的直接用 h2 分章。
 * 取出现的最高一级：写死成 h2 的话，全用 h1 的文章会被切出 0 章。
 */
export function topHeadingTag(html: string): 'h1' | 'h2' {
  return html.includes('<h1') ? 'h1' : 'h2';
}

function newChapterId(taken: Set<string>): string {
  let id = '';
  do {
    id = `ch-${Math.random().toString(36).slice(2, 8)}`;
  } while (taken.has(id));
  taken.add(id);
  return id;
}

/** 提取已有的编号，避免重复生成 */
function existingIds(html: string): Set<string> {
  const ids = new Set<string>();
  for (const m of html.matchAll(/data-ch="([^"]+)"/g)) ids.add(m[1]);
  return ids;
}

/**
 * 给每个章节标题盖编号，已有编号的不动。
 * 在保存正文时调用。
 */
export function stampChapters(html: string): string {
  if (!html) return html;
  const tag = topHeadingTag(html);
  const taken = existingIds(html);

  return html.replace(
    new RegExp(`<${tag}\\b([^>]*)>`, 'gi'),
    (whole, attrs: string) =>
      attrs.includes('data-ch=') ? whole : `<${tag}${attrs} data-ch="${newChapterId(taken)}">`,
  );
}

/**
 * 列出正文里的章节，供后台勾选免费试看用。
 * 没盖过编号的章节会被跳过：它们无法被指定为免费（保存一次即可补上）。
 */
export function listChapters(html: string): Chapter[] {
  if (!html) return [];
  const tag = topHeadingTag(html);
  const out: Chapter[] = [];

  for (const m of html.matchAll(new RegExp(`<${tag}\\b([^>]*)>([\\s\\S]*?)</${tag}>`, 'gi'))) {
    const ch = m[1].match(/data-ch="([^"]+)"/)?.[1];
    if (!ch) continue;
    const text = m[2].replace(/<[^>]+>/g, '').trim();
    out.push({ ch, text: text || '（无标题）' });
  }
  return out;
}

/** 还没盖编号的章节数。新写的章节需要扫描一次才能被勾选 */
export function countUnstamped(html: string): number {
  if (!html) return 0;
  const tag = topHeadingTag(html);
  let n = 0;
  for (const m of html.matchAll(new RegExp(`<${tag}\\b([^>]*)>`, 'gi'))) {
    if (!m[1].includes('data-ch=')) n += 1;
  }
  return n;
}
