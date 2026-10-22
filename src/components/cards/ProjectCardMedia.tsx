import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useI18n } from '@/contexts/I18nContext';
import MediaFrame from './MediaFrame';

interface ProjectCardMediaProps {
  id: string;
  title: string;
  coverUrl?: string | null;
  galleryUrls?: string[] | null;
  videoUrl?: string | null;
}

export default function ProjectCardMedia({ id, title, coverUrl, galleryUrls, videoUrl }: ProjectCardMediaProps) {
  const { t } = useI18n();
  const images = galleryUrls?.filter(Boolean) ?? [];
  if (!images.length && coverUrl) images.push(coverUrl);
  const [activeIndex, setActiveIndex] = useState(0);
  const touchStartX = useRef<number | null>(null);
  const suppressClick = useRef(false);

  useEffect(() => {
    setActiveIndex(0);
  }, [id, images.length]);

  useEffect(() => {
    if (videoUrl || images.length < 2) return;
    const timer = window.setInterval(() => {
      setActiveIndex((index) => (index + 1) % images.length);
    }, 3500);
    return () => window.clearInterval(timer);
  }, [images.length, videoUrl]);

  const showImage = (index: number) => setActiveIndex((index + images.length) % images.length);
  const handleTouchEnd = (event: React.TouchEvent<HTMLDivElement>) => {
    const startX = touchStartX.current;
    touchStartX.current = null;
    if (startX === null || images.length < 2) return;
    const delta = event.changedTouches[0].clientX - startX;
    if (Math.abs(delta) < 40) return;
    suppressClick.current = true;
    showImage(activeIndex + (delta < 0 ? 1 : -1));
    window.setTimeout(() => { suppressClick.current = false; }, 500);
  };

  return (
    <div
      className="relative shrink-0 touch-pan-y"
      onTouchStart={(event) => { touchStartX.current = event.touches[0].clientX; }}
      onTouchEnd={handleTouchEnd}
      onClickCapture={(event) => {
        if (suppressClick.current) {
          event.preventDefault();
          event.stopPropagation();
        }
      }}
    >
      <Link to={`/projects/${id}`} className="block focus:outline-none">
        <MediaFrame
          src={videoUrl ? undefined : images[activeIndex]}
          videoSrc={videoUrl}
          alt={title}
        />
      </Link>
      {!videoUrl && images.length > 1 && (
        <div role="group" aria-label={t('项目图片轮播', 'Project image gallery')}>
          <button
            type="button"
            aria-label={t('上一张图片', 'Previous image')}
            onClick={(event) => { event.preventDefault(); event.stopPropagation(); showImage(activeIndex - 1); }}
            className="absolute left-4 top-1/2 z-10 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-background/85 text-foreground shadow transition hover:bg-background"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            aria-label={t('下一张图片', 'Next image')}
            onClick={(event) => { event.preventDefault(); event.stopPropagation(); showImage(activeIndex + 1); }}
            className="absolute right-4 top-1/2 z-10 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-background/85 text-foreground shadow transition hover:bg-background"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <div className="absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-background/75 px-2 py-1">
            {images.map((_, index) => (
              <button
                key={index}
                type="button"
                aria-label={t(`查看第 ${index + 1} 张图片`, `View image ${index + 1}`)}
                aria-pressed={index === activeIndex}
                onClick={(event) => { event.preventDefault(); event.stopPropagation(); showImage(index); }}
                className={`h-1.5 rounded-full transition-all ${index === activeIndex ? 'w-4 bg-accent' : 'w-1.5 bg-foreground/40'}`}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
