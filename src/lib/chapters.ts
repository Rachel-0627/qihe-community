/**
 * 章节永久编号（data-ch）。
 *
 * 「免费试看第 2、3 章」这种按序号记的做法有个静默的坑：正文里插入或删掉一章，
 * 序号就指向别的章节了，而且不报错——原本收费的内容会悄悄变免费。
 * 所以保存正文时给每个章节标题盖一个永久编号，免费名单记编号，
 * 章节怎么挪动、改标题都跟着走。
 *
 * 这里全部用字符串处理而不是 DOMParser：DOMParser 会把整段 HTML 重新序列化，
 * 相当于每次保存都顺手改写用户没动过的地方。这里只往标题标签里塞一个属性。
 *
 * 注意：切分规则必须与 00040 迁移里的 get_project_content 保持一致，
 * 一处改了另一处也要改，否则后台勾选的章节和前台放行的章节对不上。
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
 * 取出现的最高一级——写死成 h2 的话，全用 h1 的文章会被切出 0 章。
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
 * 没盖过编号的章节会被跳过——它们无法被指定为免费（保存一次即可补上）。
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
