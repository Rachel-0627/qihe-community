import { cn } from '@/lib/utils';

interface MediaFrameProps {
  src?: string | null;
  alt: string;
  className?: string;
  aspectClass?: string;
  children?: React.ReactNode; // 用于叠加状态标签、锁标等
}

/**
 * 统一 Media Frame：为所有用户上传图片提供克制的深色画框。
 * 外层背景 #181A1E，内边距桌面 10px / 移动端 8px，
 * 图片 6px 圆角 + 细描边，默认降低亮度与饱和度，Hover 恢复。
 */
export default function MediaFrame({
  src,
  alt,
  className,
  aspectClass = 'aspect-[4/3]',
  children,
}: MediaFrameProps) {
  return (
    <div
      className={cn(
        'group relative overflow-hidden bg-[#181a1e] p-2 md:p-[10px]',
        'border-b border-[rgba(235,234,227,.075)]',
        aspectClass,
        className
      )}
    >
      {src ? (
        <img
          src={src}
          alt={alt}
          loading="lazy"
          className="h-full w-full rounded-md border border-[rgba(235,234,227,.09)] object-cover brightness-[.9] saturate-[.9] transition-[filter,transform] duration-500 ease-out group-hover:scale-[1.012] group-hover:brightness-100 group-hover:saturate-100"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center rounded-md border border-[rgba(235,234,227,.09)] bg-[#141519]">
          <span className="font-mono-label text-[10px] uppercase tracking-wider text-[#5e626a]">No Image</span>
        </div>
      )}
      {children}
    </div>
  );
}
