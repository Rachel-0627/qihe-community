import { Skeleton } from '@/components/ui/skeleton';

/**
 * 懒加载页面下载中的占位。
 *
 * 刻意做得很轻：这一屏通常只存在几百毫秒，
 * 放转圈或者大段骨架反而让人觉得「卡了一下」。
 * 留出和正文相近的高度，避免加载完成时页面突然跳动。
 */
export default function RouteFallback() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-16 md:px-8 md:py-20" aria-busy="true">
      <span className="sr-only">页面加载中</span>
      <Skeleton className="h-8 w-1/3 bg-muted" />
      <Skeleton className="mt-4 h-4 w-2/3 bg-muted" />
      <div className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-56 w-full bg-muted" />
        ))}
      </div>
    </div>
  );
}
