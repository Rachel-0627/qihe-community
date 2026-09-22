import { useRef, useEffect, useState, useCallback } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { cn } from '@/lib/utils';
import type { ContentHeading } from '@/lib/contentHeadings';

gsap.registerPlugin(ScrollTrigger);

interface ChapterTocProps {
  headings: ContentHeading[];
  contentSelector: string;
  className?: string;
}

export default function ChapterToc({ headings, contentSelector, className }: ChapterTocProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const triggersRef = useRef<ScrollTrigger[]>([]);

  useEffect(() => {
    if (headings.length === 0) return;

    // 清理旧触发器
    triggersRef.current.forEach((st) => st.kill());
    triggersRef.current = [];

    const ctx = gsap.context(() => {
      headings.forEach((h) => {
        const el = document.querySelector(`${contentSelector} #${CSS.escape(h.id)}`);
        if (!el) return;
        const st = ScrollTrigger.create({
          trigger: el,
          start: 'top 45%',
          end: 'bottom 45%',
          onEnter: () => setActiveId(h.id),
          onEnterBack: () => setActiveId(h.id),
        });
        triggersRef.current.push(st);
      });
    });

    return () => {
      ctx.revert();
      triggersRef.current = [];
    };
  }, [headings, contentSelector]);

  const handleClick = useCallback((id: string) => {
    const el = document.querySelector(`${contentSelector} #${CSS.escape(id)}`);
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const offset = 80;
    const target = window.scrollY + rect.top - offset;
    window.scrollTo({ top: target, behavior: 'smooth' });
  }, [contentSelector]);

  if (headings.length === 0) return null;

  return (
    <nav className={cn('hidden xl:block', className)}>
      <div className="sticky top-24 max-h-[calc(100dvh-8rem)] overflow-y-auto border-l border-border pl-4">
        <p className="mb-3 font-mono-label text-xs uppercase tracking-wider text-muted-foreground">目录</p>
        <ul className="space-y-2">
          {headings.map((h) => (
            <li key={h.id} className={h.level === 3 ? 'pl-3' : ''}>
              <button
                type="button"
                onClick={() => handleClick(h.id)}
                className={cn(
                  'block text-left text-sm transition-colors hover:text-foreground',
                  activeId === h.id ? 'font-medium text-foreground' : 'text-muted-foreground'
                )}
              >
                <span
                  className={cn(
                    'mr-2 inline-block h-1.5 w-1.5 rounded-full transition-colors',
                    activeId === h.id ? 'bg-accent' : 'bg-muted-foreground/40'
                  )}
                />
                {h.text}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
}
