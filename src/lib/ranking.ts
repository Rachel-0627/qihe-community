import { totalCount } from '@/lib/utils';

/** 计算热度分所需的最小字段集 */
export interface RankableItem {
  likes?: number | null;
  favorites?: number | null;
  views?: number | null;
  base_likes?: number | null;
  base_favorites?: number | null;
  base_views?: number | null;
  created_at?: string | null;
}

/** 权重集中在这里，调整口径时只改这一处 */
export const HOT_WEIGHTS = {
  like: 3,
  favorite: 5,
  view: 0.2,
  /** 时间衰减半衰期（天）：发布满这么久，热度打对折。
   *  取 90 而非更短，是为了让名次尽量贴近用户看到的数字——
   *  衰减太猛会出现"数字高的反而排在后面"，又变成另一种"排序不对" */
  halfLifeDays: 90,
} as const;

/**
 * 内容热度分。
 *
 * 权重上收藏高于点赞——点赞是"看到了觉得不错"，收藏是"我还要回来看"，
 * 后者是强得多的价值信号；浏览权重压到很低，否则标题党最占便宜。
 *
 * 乘时间衰减，否则老内容会永远霸榜，新投稿没有出头机会。
 *
 * 计入 base_* 运营基数，因为卡片上显示的就是含基数的总数。
 * 若这里只用真实值，就会出现"卡片显示 57 赞、排行榜写 1 赞"的矛盾。
 */
export function hotScore(item: RankableItem, now = Date.now()): number {
  const likes = totalCount(item.likes, item.base_likes);
  const favorites = totalCount(item.favorites, item.base_favorites);
  const views = totalCount(item.views, item.base_views);

  const raw =
    likes * HOT_WEIGHTS.like +
    favorites * HOT_WEIGHTS.favorite +
    views * HOT_WEIGHTS.view;

  const created = item.created_at ? Date.parse(item.created_at) : NaN;
  if (!Number.isFinite(created)) return raw;

  const days = Math.max(0, (now - created) / 86400000);
  const decay = 1 / (1 + days / HOT_WEIGHTS.halfLifeDays);
  return raw * decay;
}

/** 按收藏总数排序用的取值（含运营基数） */
export function favoriteScore(item: RankableItem): number {
  return totalCount(item.favorites, item.base_favorites);
}

/**
 * 排序并截断。
 * 数据库没法直接按计算式排序，所以先取一批候选再在前端算分。
 */
export function rankBy<T extends RankableItem>(
  items: T[],
  dimension: 'latest' | 'hot' | 'favorite',
  limit = 8,
): T[] {
  const sorted = [...items];
  if (dimension === 'latest') {
    sorted.sort((a, b) => Date.parse(b.created_at ?? '') - Date.parse(a.created_at ?? ''));
  } else if (dimension === 'favorite') {
    sorted.sort((a, b) => favoriteScore(b) - favoriteScore(a));
  } else {
    const now = Date.now();
    sorted.sort((a, b) => hotScore(b, now) - hotScore(a, now));
  }
  return sorted.slice(0, limit);
}
