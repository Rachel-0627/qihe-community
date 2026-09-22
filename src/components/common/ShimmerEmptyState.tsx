import { useEffect, useRef, type ReactNode } from 'react';
import { gsap } from 'gsap';
import { cn } from '@/lib/utils';

interface ShimmerEmptyStateProps {
  icon: ReactNode;
  title: string;
  description: string;
  action?: { label: string; onClick: () => void };
  className?: string;
}

export default function ShimmerEmptyState({ icon, title, description, action, className }: ShimmerEmptyStateProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    const ctx = gsap.context(() => {
      gsap.to('.shimmer-bar', {
        x: '100%',
        duration: 1.6,
        ease: 'power1.inOut',
        stagger: { each: 0.3, repeat: -1, repeatDelay: 0.4 },
      });
    }, ref);
    return () => ctx.revert();
  }, []);

  return (
    <div
      ref={ref}
      className={cn(
        'flex flex-col items-center justify-center overflow-hidden border border-dashed border-border bg-card px-6 py-12 text-center',
        className
      )}
    >
      <div className="relative flex h-20 w-20 items-center justify-center rounded-full border border-border bg-muted/50 text-muted-foreground">
        {icon}
        <div className="absolute inset-0 overflow-hidden rounded-full">
          <div className="shimmer-bar absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/10 to-transparent" />
        </div>
      </div>
      <h3 className="mt-5 font-display text-lg text-foreground">{title}</h3>
      <p className="mt-2 max-w-xs text-sm text-muted-foreground text-pretty">{description}</p>
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className="mt-5 border border-border px-4 py-2 font-mono-label text-xs uppercase tracking-wider text-foreground transition-colors hover:border-accent hover:text-accent"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
