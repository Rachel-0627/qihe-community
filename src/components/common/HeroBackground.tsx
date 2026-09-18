import { useEffect, useRef } from 'react';

// Hero 背景：缓慢漂移的节点，靠近时自动连线、远离时断开 ——
// 「神经网络 / 知识图谱」的意象，呼应站点的 AI 定位。
//
// 用 Canvas 2D 而非 three.js：这个效果不需要 3D 管线，
// 2D 实现体积更小、启动更快，也不依赖 WebGL 上下文（部分环境拿不到）。

const ACCENT_RGB = '188, 190, 194'; // 克制银灰，与黑灰银主题一致
const LINK_DISTANCE = 160;         // 连线距离（CSS px）
const AREA_PER_NODE = 4200;        // 节点密度提升，保证视觉丰富度
const MIN_NODES = 45;
const MAX_NODES = 160;

export default function HeroBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    type Node = { x: number; y: number; vx: number; vy: number; r: number; pulse: number; pulseSpeed: number };
    let nodes: Node[] = [];
    let width = 0;
    let height = 0;
    let frame = 0;

    const layout = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      if (!width || !height) return false;

      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const count = Math.min(MAX_NODES, Math.max(MIN_NODES, Math.round((width * height) / AREA_PER_NODE)));
      nodes = Array.from({ length: count }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.22,
        vy: (Math.random() - 0.5) * 0.22,
        r: Math.random() * 2.5 + 2.0,
        pulse: Math.random() * Math.PI * 2,
        pulseSpeed: 0.02 + Math.random() * 0.02,
      }));
      return true;
    };

    const draw = () => {
      ctx.clearRect(0, 0, width, height);

      // 1. 画连线：降低透明度与线宽，形成轻盈细腻的浅色神经网络
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[i].x - nodes[j].x;
          const dy = nodes[i].y - nodes[j].y;
          const dist = Math.hypot(dx, dy);
          if (dist > LINK_DISTANCE) continue;

          const ratio = 1 - dist / LINK_DISTANCE;
          const alpha = ratio * 0.42; // 调浅：从 0.75 降到 0.42
          ctx.lineWidth = 0.75 + ratio * 0.6; // 调细：从 1.0~2.2 降到 0.75~1.35
          ctx.strokeStyle = `rgba(${ACCENT_RGB}, ${alpha})`;
          ctx.beginPath();
          ctx.moveTo(nodes[i].x, nodes[i].y);
          ctx.lineTo(nodes[j].x, nodes[j].y);
          ctx.stroke();
        }
      }

      // 2. 画节点外层微弱发光光晕 + 实体节点圆点（色值更浅更透）
      for (const n of nodes) {
        n.pulse += n.pulseSpeed;
        const currentR = n.r + Math.sin(n.pulse) * 0.4;

        // 发光外圈（更浅柔）
        ctx.fillStyle = `rgba(${ACCENT_RGB}, 0.12)`;
        ctx.beginPath();
        ctx.arc(n.x, n.y, currentR + 2.0, 0, Math.PI * 2);
        ctx.fill();

        // 核心实心圆点（从 0.95 降至 0.58）
        ctx.fillStyle = `rgba(${ACCENT_RGB}, 0.58)`;
        ctx.beginPath();
        ctx.arc(n.x, n.y, currentR, 0, Math.PI * 2);
        ctx.fill();
      }

      // 3. 左侧适度淡出，使文字衬底更干净轻透
      const fade = ctx.createLinearGradient(0, 0, width, 0);
      fade.addColorStop(0, 'rgba(0, 0, 0, 0.65)');
      fade.addColorStop(0.35, 'rgba(0, 0, 0, 0.25)');
      fade.addColorStop(0.7, 'rgba(0, 0, 0, 0)');
      ctx.globalCompositeOperation = 'destination-out';
      ctx.fillStyle = fade;
      ctx.fillRect(0, 0, width, height);
      ctx.globalCompositeOperation = 'source-over';
    };

    const tick = () => {
      for (const n of nodes) {
        n.x += n.vx;
        n.y += n.vy;
        // 从一侧移出后由另一侧移入，保持密度恒定
        if (n.x < -24) n.x = width + 24;
        else if (n.x > width + 24) n.x = -24;
        if (n.y < -24) n.y = height + 24;
        else if (n.y > height + 24) n.y = -24;
      }
      draw();
      frame = requestAnimationFrame(tick);
    };

    const start = () => {
      if (!layout()) return;
      cancelAnimationFrame(frame);
      if (prefersReducedMotion) draw();
      else frame = requestAnimationFrame(tick);
    };

    start();

    const observer = new ResizeObserver(() => start());
    observer.observe(canvas);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, []);

  return <canvas
      ref={canvasRef}
      // canvas 是替换元素，width:auto 时会用固有尺寸 300x150 而非被 inset-0 撑开，
      // 必须显式给 h-full w-full，否则整块背景只会画在左上角一小格里
      className="pointer-events-none absolute inset-0 z-0 block h-full w-full"
      aria-hidden="true"
    />;
}
