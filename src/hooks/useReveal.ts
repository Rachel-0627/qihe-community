import { useEffect, useRef } from 'react';

// Reveal-on-scroll hook using GSAP. Elements with [data-reveal] animate in.
export function useReveal<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T>(null);

  useEffect(() => {
    let ctx: { revert: () => void } | undefined;
    let cleanup: (() => void) | undefined;

    (async () => {
      const { gsap } = await import('gsap');
      const { ScrollTrigger } = await import('gsap/ScrollTrigger');
      gsap.registerPlugin(ScrollTrigger);

      const els = ref.current?.querySelectorAll<HTMLElement>('[data-reveal]');
      if (els && els.length > 0) {
        ctx = gsap.context(() => {
          gsap.fromTo(
            els,
            { opacity: 0, y: 16 },
            {
              opacity: 1,
              y: 0,
              duration: 0.6,
              ease: 'power2.out',
              stagger: 0.06,
              scrollTrigger: { trigger: ref.current, start: 'top 85%' },
            },
          );
        }, ref);
      }
    })();

    cleanup = () => {
      ctx?.revert();
    };
    return cleanup;
  }, []);

  return ref;
}