import { useRef } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';
import { useI18n } from '@/contexts/I18nContext';
import CommunityNetwork from './CommunityNetwork';

gsap.registerPlugin(useGSAP, ScrollTrigger);

export default function FlowingHero() {
  const { t, lang } = useI18n();
  const sectionRef = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const ctx = gsap.context(() => {
      if (prefersReduced) {
        gsap.set(['.hero-label', '.hero-title-line', '.hero-desc', '.hero-index'], { autoAlpha: 1, y: 0 });
        return;
      }
      const tl = gsap.timeline({ defaults: { ease: 'power2.out', duration: 0.8 } });

      tl.from('.hero-label', { y: 12, autoAlpha: 0, duration: 0.5 })
        .from('.hero-title-line', { y: 36, autoAlpha: 0, stagger: 0.12 }, '-=0.3')
        .from('.hero-desc', { y: 24, autoAlpha: 0 }, '-=0.5')
        .from('.hero-index', { y: 16, autoAlpha: 0 }, '-=0.4');
    }, sectionRef);

    return () => ctx.revert();
  }, { scope: sectionRef });

  return (
    <div ref={sectionRef}>
      <section className="relative overflow-hidden border-b border-border bg-[#090a0c]">
        {/* 克制网格背景 */}
        <div className="qihe-grid pointer-events-none absolute inset-0 z-0" aria-hidden="true" />
        {/* 右侧柔光氛围 */}
        <div
          className="pointer-events-none absolute right-[-160px] top-[3%] h-[760px] w-[760px] rounded-full opacity-50 blur-[150px]"
          style={{ background: 'rgba(196, 198, 202, .045)' }}
          aria-hidden="true"
        />

        <div className="relative z-10 mx-auto max-w-7xl px-4 md:px-8">
          <div className="grid min-h-[calc(100svh-80px)] grid-cols-1 items-center gap-8 py-12 md:grid-cols-[1.05fr_.95fr] md:gap-[4vw] md:py-[8vh]">
            {/* 左侧文案 */}
            <div className="hero-copy max-w-[750px]">
              <p className="hero-label mb-6 font-mono text-[10px] uppercase tracking-[0.19em] text-[#afb1b4]">
                QIHE COMMUNITY / AI BUILDERS NETWORK
              </p>
              <h1 className="font-display text-[clamp(49px,15vw,70px)] font-medium leading-[.94] tracking-[-.065em] text-[#ecebe7] md:text-[clamp(54px,6.7vw,102px)]">
                <span className="hero-title-line block">{t('探索 AI 的边界，', 'Explore the frontier of AI,')}</span>
                <span className="hero-title-line gradient-text block">{t('共建创新社区', 'build together')}</span>
              </h1>
              <p className="hero-desc mt-6 max-w-[610px] text-base leading-[1.8] text-[#999ca4] text-pretty md:text-[clamp(16px,1.35vw,19px)]">
                {t('一个面向 AI 爱好者、创作者与项目探索者的高端社区，汇聚前沿案例、项目与线下连接。', 'A premium community for AI enthusiasts, creators, and project explorers — gathering frontier cases, projects, and real-world connections.')}
              </p>
              <div className="hero-index mt-10 flex w-full max-w-[460px] gap-6 border-t border-border pt-5 font-mono text-[9px] uppercase tracking-[0.12em] text-[#5e626a]">
                <span className="text-[#afb1b4]">{lang === 'en' ? 'COMMUNITY SIGNAL / ONLINE' : 'COMMUNITY SIGNAL / ONLINE'}</span>
                <span>BEIJING · CHINA</span>
              </div>
            </div>

            {/* 右侧连接网络 */}
            <div className="hero-field relative h-[410px] w-full md:h-[600px]">
              <CommunityNetwork />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
