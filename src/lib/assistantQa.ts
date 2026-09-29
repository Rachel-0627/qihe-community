// 助手的固定问答匹配。
//
// 大模型还没接上（ai-assistant 这个 Edge Function 仍指向秒哒的网关），
// 所以先用后台「知识库」里的条目做本地问答：管理员在那里加一条，
// 助手就多会答一个问题，不需要改代码。
//
// 故意不做模糊/向量检索：条目数量是个位数，关键词命中就够了，
// 引入检索库反而让「为什么答非所问」变得难排查。

import type { KnowledgeItem } from '@/types/types';

/** 去掉标点和空格，中英文都转小写，便于比对 */
function normalize(text: string): string {
  return text.toLowerCase().replace(/[\s\p{P}\p{S}]+/gu, '');
}

/** 把标签串切开。后台里用逗号分隔，中英文逗号都可能出现 */
export function splitTags(tags: string): string[] {
  return tags.split(/[,，、|]/).map((s) => s.trim()).filter(Boolean);
}

/**
 * 给一条知识库条目打分。分数越高越可能是用户想问的。
 *
 * 权重：标题命中最重（用户多半是照着快捷问题点的或抄的标题），
 * 标签次之（管理员专门标的关键词），正文最轻（正文里偶然出现某个词
 * 不代表这条就是答案）。
 */
export function scoreItem(query: string, item: KnowledgeItem): number {
  const q = normalize(query);
  if (!q) return 0;

  const title = normalize(item.title);
  let score = 0;

  // 标题完全一致：几乎可以确定就是它
  if (title === q) return 1000;
  if (title.includes(q) || q.includes(title)) score += 60;

  for (const tag of splitTags(item.tags)) {
    const t = normalize(tag);
    if (t && q.includes(t)) score += 25;
  }

  // 正文只看是否包含整段提问，不逐字拆——逐字拆会让「的」「是」这类
  // 高频字把所有条目都匹配上
  if (q.length >= 3 && normalize(item.content).includes(q)) score += 10;

  // 标题与提问的措辞有多像。主要作用是打破标签平分时的僵局
  score += bigramOverlap(title, q) * 8;

  return score;
}

/**
 * 标题与提问的二字片段重合数。
 *
 * 只靠标签打分会出现平局：「我的投稿被驳回了」同时命中「投稿」和「驳回」
 * 两条不同条目的标签，各得 25 分，最后按顺序取前一条——答错。
 * 片段重合能区分「哪条更像在问这件事」：标题和提问共用的连续二字越多越像。
 *
 * 用二字而不是逐字：中文单字（的、是、内、容）太容易偶然重合。
 */
function bigramOverlap(a: string, b: string): number {
  const grams = (t: string) => {
    const set = new Set<string>();
    for (let i = 0; i + 2 <= t.length; i += 1) set.add(t.slice(i, i + 2));
    return set;
  };
  const ga = grams(a);
  let n = 0;
  for (const g of grams(b)) if (ga.has(g)) n += 1;
  return n;
}

/** 低于这个分数就算没答上来。宁可说「我不知道」，也别硬答一条不相干的 */
export const MATCH_THRESHOLD = 25;

export function findAnswer(query: string, items: KnowledgeItem[]): KnowledgeItem | null {
  let best: KnowledgeItem | null = null;
  let bestScore = 0;
  for (const item of items) {
    const s = scoreItem(query, item);
    if (s > bestScore) { bestScore = s; best = item; }
  }
  return bestScore >= MATCH_THRESHOLD ? best : null;
}
