import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { useI18n } from '@/contexts/I18nContext';

const PTS: [number, number, number][] = [
  [0.51, 0.49, 3.4], // 0 启禾中心
  [0.11, 0.24, 1.8], // 1 案例
  [0.88, 0.30, 1.7], // 2 项目库
  [0.15, 0.76, 1.8], // 3 城市组局
  [0.86, 0.78, 1.8], // 4 社区连接
  [0.32, 0.11, 1.1],
  [0.72, 0.13, 1.1],
  [0.29, 0.90, 1.1],
  [0.70, 0.89, 1.1],
  [0.51, 0.17, 1.0],
  [0.51, 0.83, 1.0],
  [0.24, 0.50, 1.0],
  [0.78, 0.52, 1.0],
];

const LINKS: [number, number][] = [
  [0, 1], [0, 2], [0, 3], [0, 4],
  [1, 5], [1, 11], [2, 6], [2, 12], [3, 7], [3, 11], [4, 8], [4, 12],
  [5, 9], [6, 9], [7, 10], [8, 10],
];

// 四条从启禾中心同时发出的流动光线，覆盖全部 12 个白色节点
const FLOW_PATHS: number[][] = [
  [0, 1, 11, 3, 7, 10],
  [0, 2, 12, 4, 8, 10],
  [0, 3, 11, 1, 5, 9],
  [0, 4, 12, 2, 6, 9],
];

const FLOW_DOTS = [
  { path: 0, speed: 0.00012, offset: 0 },
  { path: 1, speed: 0.00014, offset: 0 },
  { path: 2, speed: 0.00011, offset: 0.05 },
  { path: 3, speed: 0.00013, offset: 0.05 },
];

const LABELS = [
  { zh: '案例', en: 'Cases', sub: 'CASES / 08' },
  { zh: '项目库', en: 'Projects', sub: 'PROJECTS / 11' },
  { zh: '城市组局', en: 'Events', sub: 'EVENTS / 04' },
  { zh: '社区连接', en: 'Connections', sub: 'VIEWS / 43.5K' },
];

const NODE_POS = [
  '-left-[4%] top-[14%] md:left-[4%] md:top-[23%]',
  '-right-[4%] top-[18%] md:right-0 md:top-[29%]',
  '-left-[4%] bottom-[13%] md:left-[7%] md:bottom-[20%]',
  '-right-[4%] bottom-[11%] md:right-[3%] md:bottom-[17%]',
];

export default function CommunityNetwork() {
  const { t, lang } = useI18n();
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pointerRef = useRef({ x: 0.5, y: 0.5 });
  const ringRef = useRef<HTMLDivElement>(null);
  const coreRef = useRef<HTMLDivElement>(null);
  const labelsRef = useRef<HTMLDivElement>(null);
  const statusRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const stage = stageRef.current;
    const canvas = canvasRef.current;
    if (!stage || !canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let frame = 0;

    // 鼠标视差：用 quickTo 避免高频创建 tween
    const ringX = ringRef.current ? gsap.quickTo(ringRef.current, 'x', { duration: 0.6, ease: 'power2.out' }) : null;
    const ringY = ringRef.current ? gsap.quickTo(ringRef.current, 'y', { duration: 0.6, ease: 'power2.out' }) : null;
    const coreX = coreRef.current ? gsap.quickTo(coreRef.current, 'x', { duration: 0.5, ease: 'power2.out' }) : null;
    const coreY = coreRef.current ? gsap.quickTo(coreRef.current, 'y', { duration: 0.5, ease: 'power2.out' }) : null;
    const labelsX = labelsRef.current ? gsap.quickTo(labelsRef.current, 'x', { duration: 0.65, ease: 'power2.out' }) : null;
    const labelsY = labelsRef.current ? gsap.quickTo(labelsRef.current, 'y', { duration: 0.65, ease: 'power2.out' }) : null;
    const statusX = statusRef.current ? gsap.quickTo(statusRef.current, 'x', { duration: 0.45, ease: 'power2.out' }) : null;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = stage.getBoundingClientRect();
      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const getPathPoint = (path: number[], t: number, w: number, h: number) => {
      const segCount = path.length - 1;
      const segT = (t % 1) * segCount;
      const segIndex = Math.floor(segT);
      const localT = segT - segIndex;
      const a = path[segIndex];
      const b = path[segIndex + 1];
      const p = PTS[a];
      const q = PTS[b];
      return {
        x: p[0] * w + (q[0] - p[0]) * w * localT,
        y: p[1] * h + (q[1] - p[1]) * h * localT,
      };
    };

    const draw = (time = 0) => {
      const rect = stage.getBoundingClientRect();
      const w = rect.width;
      const h = rect.height;
      ctx.clearRect(0, 0, w, h);

      // 背景连线 — 电光紫微光
      LINKS.forEach(([a, b]) => {
        const p = PTS[a];
        const q = PTS[b];
        ctx.beginPath();
        ctx.moveTo(p[0] * w, p[1] * h);
        ctx.lineTo(q[0] * w, q[1] * h);
        ctx.strokeStyle = 'hsla(258, 90%, 66%, 0.18)';
        ctx.lineWidth = 1;
        ctx.stroke();
      });

      // 流动光点 — 电光紫到洋红渐变
      FLOW_DOTS.forEach((dot) => {
        const path = FLOW_PATHS[dot.path];
        const t = reduced ? dot.offset : (time * dot.speed + dot.offset) % 1;
        const { x, y } = getPathPoint(path, t, w, h);
        const g = ctx.createRadialGradient(x, y, 0, x, y, 14);
        g.addColorStop(0, 'hsla(258, 100%, 72%, 0.95)');
        g.addColorStop(0.5, 'hsla(320, 90%, 60%, 0.35)');
        g.addColorStop(1, 'hsla(258, 90%, 66%, 0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(x, y, 14, 0, Math.PI * 2);
        ctx.fill();
      });

      // 节点 — 中心高亮 + 外围电光紫/洋红脉冲
      const ptr = pointerRef.current;
      PTS.forEach(([x, y, s], i) => {
        const baseX = x * w + (ptr.x - 0.5) * (i % 2 ? 8 : -8);
        const baseY = y * h + (ptr.y - 0.5) * (i % 3 ? 6 : -6);
        const pulse = reduced ? 0 : Math.sin(time * 0.003 + i * 1.3) * 0.35;
        const radius = s * (1 + pulse * 0.25);
        const isCenter = i === 0;
        const color = isCenter ? 'hsla(258, 100%, 72%, 0.95)' : (i % 2 === 0 ? 'hsla(258, 90%, 66%, 0.85)' : 'hsla(320, 90%, 60%, 0.85)');

        // 外发光
        const glow = ctx.createRadialGradient(baseX, baseY, 0, baseX, baseY, radius * 4);
        glow.addColorStop(0, color.replace('0.85', '0.28').replace('0.95', '0.32'));
        glow.addColorStop(1, 'hsla(258, 90%, 66%, 0)');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(baseX, baseY, radius * 4, 0, Math.PI * 2);
        ctx.fill();

        // 实心节点
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(baseX, baseY, Math.max(1.5, radius), 0, Math.PI * 2);
        ctx.fill();
      });

      if (!reduced) frame = requestAnimationFrame(draw);
    };

    const handleMove = (e: PointerEvent) => {
      const rect = stage.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width;
      const y = (e.clientY - rect.top) / rect.height;
      pointerRef.current = { x, y };

      const dx = (x - 0.5) * 100; // percent-like offset base
      const dy = (y - 0.5) * 100;
      ringX?.(dx * -0.18);
      ringY?.(dy * -0.18);
      coreX?.(dx * -0.1);
      coreY?.(dy * -0.1);
      labelsX?.(dx * -0.28);
      labelsY?.(dy * -0.28);
      statusX?.(dx * -0.06);
    };

    const handleLeave = () => {
      pointerRef.current = { x: 0.5, y: 0.5 };
      ringX?.(0);
      ringY?.(0);
      coreX?.(0);
      coreY?.(0);
      labelsX?.(0);
      labelsY?.(0);
      statusX?.(0);
    };

    resize();
    draw();

    window.addEventListener('resize', resize);
    stage.addEventListener('pointermove', handleMove);
    stage.addEventListener('pointerleave', handleLeave);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', resize);
      stage.removeEventListener('pointermove', handleMove);
      stage.removeEventListener('pointerleave', handleLeave);
    };
  }, []);

  return (
    <div
      ref={stageRef}
      className="relative -mt-5 min-h-[410px] w-full scale-[.9] md:mt-0 md:min-h-[600px] md:scale-100"
      aria-label={t('启禾社区连接网络', 'Qihe community connection network')}
    >
      <canvas ref={canvasRef} className="absolute inset-0 block h-full w-full" aria-hidden="true" />

      <div className="absolute inset-0">
        {/* 圆环 */}
        <div ref={ringRef} className="network-ring absolute left-[51%] top-[49%] h-[235px] w-[235px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-primary/30 shadow-[0_0_0_64px_hsl(258_90%_66%_/_.04),0_0_0_128px_hsl(258_90%_66%_/_.02)] md:h-[320px] md:w-[320px]">
          <span className="absolute inset-[56px] rounded-full border border-primary/25" aria-hidden="true" />
          <span className="absolute -inset-[54px] animate-[spin_40s_linear_infinite] rounded-full border border-dashed border-primary/20 motion-reduce:animate-none" aria-hidden="true" />
        </div>

        {/* 中心核心 */}
        <div ref={coreRef} className="network-core absolute left-[51%] top-[49%] grid h-[96px] w-[96px] -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-primary/40 bg-card/90 shadow-[inset_0_0_36px_hsl(258_90%_66%_/_.12),0_0_40px_hsl(258_90%_66%_/_.18)] backdrop-blur-[15px] md:h-[118px] md:w-[118px]">
          <div className="text-center">
            <b className="block text-[23px] tracking-[.04em] text-foreground">{lang === 'en' ? 'Qihe' : '启禾'}</b>
            <small className="mt-[6px] block font-mono text-[7px] uppercase tracking-[.16em] text-muted-foreground">QI HE / 01</small>
          </div>
        </div>

        {/* 四个节点标签 */}
        <div ref={labelsRef} className="pointer-events-none absolute inset-0">
          {LABELS.map((n, i) => (
            <div key={n.zh} className={`network-label absolute min-w-[105px] border-l border-primary/40 bg-gradient-to-r from-primary/10 to-transparent p-[12px_13px] text-muted-foreground md:min-w-[124px] ${NODE_POS[i]}`}>
              <b className="block text-xs font-[550] text-foreground">{lang === 'en' ? n.en : n.zh}</b>
              <small className="mt-[5px] block font-mono text-[8px] uppercase tracking-[.12em] text-muted-foreground">{n.sub}</small>
            </div>
          ))}
        </div>

        {/* 状态条 */}
        <div ref={statusRef} className="network-status absolute bottom-[22px] left-1/2 -translate-x-1/2 whitespace-nowrap font-mono text-[8px] uppercase tracking-[.15em] text-muted-foreground">
          <span className="mr-[9px] inline-block h-[5px] w-[5px] rounded-full bg-primary shadow-[0_0_9px_hsl(258_90%_66%_/_1)]" />
          SYSTEM COORDINATES STABLE
        </div>
      </div>
    </div>
  );
}
