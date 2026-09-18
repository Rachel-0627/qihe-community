import { useRef } from 'react';
import { gsap } from 'gsap';
import { Heart, Bookmark, type LucideIcon } from 'lucide-react';

interface InteractionButtonProps {
  type: 'like' | 'favorite';
  active: boolean;
  count: number | string;
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  className?: string;
}

const ICONS: Record<InteractionButtonProps['type'], LucideIcon> = {
  like: Heart,
  favorite: Bookmark,
};

/** 创建粒子动画：从图标中心向上方随机方向飘散 */
function spawnParticles(origin: HTMLElement, kind: 'like' | 'favorite') {
  const rect = origin.getBoundingClientRect();
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;
  const particleCount = 6;

  for (let i = 0; i < particleCount; i++) {
    const el = document.createElement('span');
    el.textContent = kind === 'like' ? '❤' : '★';
    el.style.position = 'fixed';
    el.style.left = `${centerX}px`;
    el.style.top = `${centerY}px`;
    el.style.fontSize = '12px';
    el.style.pointerEvents = 'none';
    el.style.zIndex = '9999';
    el.style.color = 'hsl(var(--accent))';
    document.body.appendChild(el);

    const angle = -Math.PI / 2 + (Math.random() - 0.5) * 1.2;
    const distance = 24 + Math.random() * 28;
    const endX = Math.cos(angle) * distance;
    const endY = Math.sin(angle) * distance;

    gsap.fromTo(
      el,
      { x: 0, y: 0, scale: 0.6, opacity: 1 },
      {
        x: endX,
        y: endY,
        scale: 0,
        opacity: 0,
        duration: 0.5 + Math.random() * 0.2,
        ease: 'power2.out',
        onComplete: () => el.remove(),
      }
    );
  }
}

export default function InteractionButton({ type, active, count, onClick, className = '' }: InteractionButtonProps) {
  const iconRef = useRef<HTMLSpanElement>(null);
  const Icon = ICONS[type];

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (!active && iconRef.current) {
      spawnParticles(iconRef.current, type);
    }
    if (iconRef.current) {
      gsap.fromTo(
        iconRef.current,
        { scale: 0.65 },
        { scale: 1, duration: 0.4, ease: 'back.out(2.2)' }
      );
    }
    onClick?.(e);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className={`flex items-center gap-1 font-mono-label text-xs transition-colors ${className}`}
    >
      <span ref={iconRef} className="inline-block">
        <Icon className={`h-3.5 w-3.5 ${active ? 'fill-current' : ''}`} />
      </span>
      {count}
    </button>
  );
}
