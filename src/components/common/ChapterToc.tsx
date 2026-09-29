import { useRef, useEffect, useState, useCallback } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { Lock } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ContentHeading } from '@/lib/contentHeadings';

gsap.registerPlugin(ScrollTrigger);

interface ChapterTocProps {
  headings: ContentHeading[];
  contentSelector: string;
  className?: string;
}

/** 优先按章节永久编号定位；旧正文没有编号，退回按标题 id */
function elementSelector(h: ContentHeading): string {
  return h.ch ? `[data-ch="${CSS.escape(h.ch)}"]` : `#${CSS.escape(h.id)}`;
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
        // 锁住的章节正文没下发，页面上没有对应元素
        if (h.locked) return;
        const el = document.querySelector(`${contentSelector} ${elementSelector(h)}`);
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

  const handleClick = useCallback((h: ContentHeading) => {
    const el = document.querySelector(`${contentSelector} ${elementSelector(h)}`);
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
                onClick={() => !h.locked && handleClick(h)}
                // 锁住的章节点了也跳不过去，做成不可点，避免「点了没反应」
                disabled={h.locked}
                className={cn(
                  'flex w-full items-start text-left text-sm transition-colors',
                  h.locked
                    ? 'cursor-default text-muted-foreground/60'
                    : 'hover:text-foreground',
                  activeId === h.id ? 'font-medium text-foreground' : 'text-muted-foreground'
                )}
              >
                {h.locked ? (
                  <Lock className="mr-2 mt-0.5 h-3 w-3 shrink-0" />
                ) : (
                  <span
                    className={cn(
                      'mr-2 mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full transition-colors',
                      activeId === h.id ? 'bg-accent' : 'bg-muted-foreground/40'
                    )}
                  />
                )}
                <span className="min-w-0">{h.text}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
}
