import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export type Params = Partial<
  Record<keyof URLSearchParams, string | number | null | undefined>
>;

export function createQueryString(
  params: Params,
  searchParams: URLSearchParams
) {
  const newSearchParams = new URLSearchParams(searchParams?.toString());

  for (const [key, value] of Object.entries(params)) {
    if (value === null || value === undefined) {
      newSearchParams.delete(key);
    } else {
      newSearchParams.set(key, String(value));
    }
  }

  return newSearchParams.toString();
}

export function formatDate(
  date: Date | string | number,
  opts: Intl.DateTimeFormatOptions = {}
) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: opts.month ?? "long",
    day: opts.day ?? "numeric",
    year: opts.year ?? "numeric",
    ...opts,
  }).format(new Date(date));
}

/** 基础数量 + 实际数量，用于前后台统一展示点赞/收藏/浏览量；未设置时按 0 兜底 */
export function totalCount(actual: number | null | undefined, base: number | null | undefined): number {
  return Math.max(0, (actual ?? 0) + (base ?? 0));
}

/** 确保浏览量 > max(点赞, 收藏)，用于卡片展示 */
export function displayViews(
  actualViews: number | null | undefined,
  baseViews: number | null | undefined,
  actualLikes: number | null | undefined,
  baseLikes: number | null | undefined,
  actualFavorites: number | null | undefined,
  baseFavorites: number | null | undefined,
): number {
  const views = totalCount(actualViews, baseViews);
  const likes = totalCount(actualLikes, baseLikes);
  const favorites = totalCount(actualFavorites, baseFavorites);
  return Math.max(views, likes + 1, favorites + 1);
}
