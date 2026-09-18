import { useState, useRef, useCallback, useEffect } from 'react';
import { useI18n } from '@/contexts/I18nContext';

// Lightweight application pet — a minimal, tasteful CSS companion.
// It is draggable, reacts to clicks with a gentle sway, and shows a context bubble.
// (A full sprite-based pet can be generated via the pet-agent skill after user confirmation.)

const BUBBLES_ZH = ['在探索 AI 项目吗？', '看看左侧排行榜 ✦', '有想法就收藏起来吧', '保持好奇，保持克制'];
const BUBBLES_EN = ['Exploring AI projects?', 'Check the leaderboard ✦', 'Save what inspires you', 'Stay curious, stay restrained'];

export default function PetWidget() {
  const { t, lang } = useI18n();
  const [pos, setPos] = useState({ x: 24, y: window.innerHeight - 140 });
  const [bubble, setBubble] = useState<string | null>(null);
  const dragging = useRef(false);
  const offset = useRef({ x: 0, y: 0 });
  const bubbleTimer = useRef<number | null>(null);
  const lastTap = useRef(0);

  const showBubble = useCallback(
    (text: string) => {
      setBubble(text);
      if (bubbleTimer.current) window.clearTimeout(bubbleTimer.current);
      bubbleTimer.current = window.setTimeout(() => setBubble(null), 3500);
    },
    [],
  );

  const randomBubble = useCallback(() => {
    const arr = lang === 'zh' ? BUBBLES_ZH : BUBBLES_EN;
    showBubble(arr[Math.floor(Math.random() * arr.length)]);
  }, [lang, showBubble]);

  // Idle proactive bubble every ~45s
  useEffect(() => {
    const id = window.setInterval(randomBubble, 45000);
    return () => window.clearInterval(id);
  }, [randomBubble]);

  const onPointerDown = (e: React.PointerEvent) => {
    dragging.current = true;
    offset.current = { x: e.clientX - pos.x, y: e.clientY - pos.y };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging.current) return;
    const nx = Math.max(8, Math.min(window.innerWidth - 80, e.clientX - offset.current.x));
    const ny = Math.max(80, Math.min(window.innerHeight - 80, e.clientY - offset.current.y));
    setPos({ x: nx, y: ny });
  };

  const onPointerUp = (e: React.PointerEvent) => {
    dragging.current = false;
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
  };

  const onClick = () => {
    const now = Date.now();
    if (now - lastTap.current < 350) {
      randomBubble();
    } else {
      showBubble(t('嗨，需要帮助吗？', 'Hi, need any help?'));
    }
    lastTap.current = now;
  };

  return (
    <div
      className="fixed z-40 select-none"
      style={{ left: pos.x, top: pos.y }}
    >
      {bubble && (
        <div className="absolute bottom-16 left-1/2 -translate-x-1/2 whitespace-nowrap border border-border bg-card px-3 py-1.5 text-xs text-foreground shadow-hover">
          {bubble}
        </div>
      )}
      <button
        type="button"
        aria-label={t('应用宠物', 'App pet')}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onClick={onClick}
        className="group flex h-12 w-12 cursor-grab items-center justify-center rounded-full border border-border bg-card text-foreground shadow-card transition-transform duration-300 hover:scale-105 active:cursor-grabbing active:scale-95"
      >
        <svg viewBox="0 0 24 24" className="h-7 w-7 transition-transform duration-500 group-hover:-rotate-6" fill="none">
          <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.4" />
          <circle cx="9" cy="11" r="1.2" fill="currentColor" />
          <circle cx="15" cy="11" r="1.2" fill="currentColor" />
          <path d="M9 15c1.2 1 4.8 1 6 0" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  );
}