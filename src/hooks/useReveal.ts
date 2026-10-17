import { useEffect, useRef } from 'react';

interface RevealOptions {
  /**
   * 幅度更大的一档：位移更远、带一点缩放。首页在用。
   * 列表页保持默认的轻档，那里一屏好几十张卡，动静太大会晃眼。
   */
  bold?: boolean;
  /**
   * 内容是异步拿回来的时候，把加载状态传进来。
   * 否则 hook 只在挂载时扫一遍 DOM，那一刻卡片还没渲染出来，
   * 扫到空数组，动画永远不会触发。
   */
  deps?: readonly unknown[];
}

/** 进入视口时把 [data-reveal] 的元素推上来。容器拿 ref，子元素加 data-reveal。 */
export function useReveal<T extends HTMLElement = HTMLDivElement>(options: RevealOptions = {}) {
  const { bold = false, deps = [] } = options;
  const ref = useRef<T>(null);

  useEffect(() => {
    let ctx: { revert: () => void } | undefined;

    (async () => {
      const { gsap } = await import('gsap');
      const { ScrollTrigger } = await import('gsap/ScrollTrigger');
      gsap.registerPlugin(ScrollTrigger);

      const els = ref.current?.querySelectorAll<HTMLElement>('[data-reveal]');
      if (!els || els.length === 0) return;

      ctx = gsap.context(() => {
        // 系统开了「减少动态效果」就直接显示，不做位移。
        // 不加这个判断，晕动症用户会被整页的推拉搞得很难受。
        const mm = gsap.matchMedia();

        mm.add('(prefers-reduced-motion: reduce)', () => {
          gsap.set(els, { opacity: 1, y: 0, clearProps: 'transform' });
        });

        mm.add('(prefers-reduced-motion: no-preference)', () => {
          const dist = bold ? 48 : 16;
          const dur = bold ? 0.9 : 0.6;
          const gap = bold ? 0.08 : 0.06;
          const ease = bold ? 'expo.out' : 'power2.out';

          els.forEach((el) => {
            // 触发器挂在元素自己身上，不是挂在板块容器上。
            // 挂容器的话，容器顶边一探进视口整组就开始播，
            // 而那时候下面的卡片还在屏幕外，等滚到了动画早结束了。
            //
            // start 用 'top 85%'：元素自己的顶边进到视口 85% 的位置才开始，
            // 也就是真正露头之后才动，看得见。
            const rawDelay = Number(el.dataset.revealDelay);
            const rawY = Number(el.dataset.revealY);

            // 同一行里的卡片是一起进视口的，给个小错位才不至于整排一起弹。
            // 按「在父容器里排第几个」算，而不是按整个板块的序号——
            // 按板块算的话最后一张要等很久。
            const peers = el.parentElement
              ? [...el.parentElement.children].filter((n) => n instanceof HTMLElement && n.hasAttribute('data-reveal'))
              : [];
            const idx = Math.max(0, peers.indexOf(el));

            const delay = el.dataset.revealDelay && Number.isFinite(rawDelay) ? rawDelay : idx * gap;
            const y = el.dataset.revealY && Number.isFinite(rawY) ? rawY : dist;

            gsap.fromTo(
              el,
              { opacity: 0, y },
              {
                opacity: 1,
                y: 0,
                duration: dur,
                ease,
                delay,
                force3D: true,
                clearProps: 'willChange',
                scrollTrigger: { trigger: el, start: bold ? 'top 85%' : 'top 90%', once: true },
              },
            );
          });
        });
      }, ref);
    })();

    return () => ctx?.revert();
    // deps 由调用方给（异步内容到齐时重跑一次）
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bold, ...deps]);

  return ref;
}
