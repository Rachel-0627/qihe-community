import { useGSAP } from '@gsap/react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useRef } from 'react';
import { useI18n } from '@/contexts/I18nContext';
import { useSiteContent } from '@/contexts/SiteContentContext';
import CommunityNetwork from './CommunityNetwork';

gsap.registerPlugin(useGSAP, ScrollTrigger);

export default function FlowingHero() {
  const { lang } = useI18n();
  const { c, status, reload } = useSiteContent();
  const sectionRef = useRef<HTMLDivElement>(null);

  // 首页文案只读取后台保存的记录，不维护可见的前端默认副本。
  const heroTitle = c('hero', 'title');
  // 后台可用换行精确控制版式；旧中文文案仍兼容按第一个逗号分行。
  const manualTitleLines = heroTitle.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const titleLines = manualTitleLines.length > 1
    ? manualTitleLines
    : lang === 'zh'
      ? heroTitle.split(/，|,\s*/).map((line) => line.trim()).filter(Boolean)
      : [heroTitle.trim()];
  const isLongEnglishTitle = lang === 'en' && heroTitle.trim().split(/\s+/).length > 10;
  const heroSubtitle = c('hero', 'subtitle');

  useGSAP(() => {
    if (status !== 'ready') return;
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const ctx = gsap.context(() => {
      if (prefersReduced) {
        gsap.set(['.hero-label', '.hero-title-line', '.hero-desc', '.hero-index'], { autoAlpha: 1, y: 0 });
        return;
      }
      // 与首页滚动进场使用一致的柔和收尾。
      const tl = gsap.timeline({ defaults: { ease: 'expo.out', duration: 0.9 } });

      tl.from('.hero-label', { y: 12, autoAlpha: 0, duration: 0.5 })
        .from('.hero-title-line', { y: 36, autoAlpha: 0, stagger: 0.12 }, '-=0.3')
        .from('.hero-desc', { y: 24, autoAlpha: 0 }, '-=0.5')
        .from('.hero-index', { y: 16, autoAlpha: 0 }, '-=0.4')
        .from('.network-ring', { scale: 0.75, autoAlpha: 0, duration: 0.9 }, '-=0.5')
        .from('.network-core', { scale: 0.4, autoAlpha: 0, duration: 0.7, ease: 'back.out(1.6)' }, '-=0.7')
        .from('.network-label', { y: 24, autoAlpha: 0, stagger: 0.1, duration: 0.55 }, '-=0.55')
        .from('.network-status', { y: 12, autoAlpha: 0, duration: 0.45 }, '-=0.35');
    }, sectionRef);

    return () => ctx.revert();
  }, { scope: sectionRef, dependencies: [status], revertOnUpdate: true });

  return (
    <div ref={sectionRef}>
      <section className="relative overflow-hidden border-b border-border bg-background">
        {/* 克制网格背景 */}
        <div className="qihe-grid pointer-events-none absolute inset-0 z-0" aria-hidden="true" />
        {/* 右侧电光紫氛围光 */}
        <div
          className="pointer-events-none absolute right-[-160px] top-[3%] h-[760px] w-[760px] rounded-full opacity-60 blur-[150px]"
          style={{ background: 'hsl(var(--primary) / .12)' }}
          aria-hidden="true"
        />

        <div className="relative z-10 mx-auto max-w-7xl px-4 md:px-8">
          <div className="grid min-h-[calc(100svh-80px)] grid-cols-1 items-center gap-8 py-12 lg:grid-cols-[1.12fr_.88fr] lg:gap-[3vw] lg:py-[8vh]">
            {/* 左侧文案 */}
            <div className="hero-copy max-w-[750px]">
              {status === 'loading' && (
                <div className="space-y-6" aria-label={lang === 'en' ? 'Loading homepage content' : '正在加载首页内容'} aria-busy="true">
                  <div className="h-3 w-48 animate-pulse rounded bg-muted" />
                  <div className="h-28 max-w-[620px] animate-pulse rounded bg-muted/70" />
                  <div className="h-12 max-w-[520px] animate-pulse rounded bg-muted/50" />
                </div>
              )}
              {status === 'error' && (
                <div role="alert" className="space-y-3 text-muted-foreground">
                  <p>{lang === 'en' ? 'Homepage content could not be loaded.' : '首页内容暂时无法加载。'}</p>
                  <button type="button" className="text-primary underline underline-offset-4" onClick={() => void reload()}>
                    {lang === 'en' ? 'Retry' : '重试'}
                  </button>
                </div>
              )}
              {status === 'ready' && <>
              <p className="hero-label mb-6 font-mono text-[10px] uppercase tracking-[0.19em] text-muted-foreground">
                QIHE COMMUNITY / AI BUILDERS NETWORK
              </p>
              <h1
                lang={lang === 'zh' ? 'zh-CN' : 'en'}
                className={`font-display font-medium text-balance text-foreground ${lang === 'en'
                  ? isLongEnglishTitle
                    ? 'text-[clamp(36px,8vw,52px)] leading-[1.02] tracking-[-.04em] lg:text-[clamp(40px,3.8vw,52px)]'
                    : 'text-[clamp(40px,9vw,64px)] leading-[.98] tracking-[-.045em] lg:text-[clamp(52px,5vw,76px)]'
                  : 'text-[clamp(32px,11vw,70px)] leading-[.94] tracking-[-.065em] md:text-[clamp(45px,5.9vw,75px)]'
                }`}
              >
                {titleLines.map((line, index) => (
                  <span key={`${line}-${index}`} className={`hero-title-line block ${index > 0 ? 'gradient-text' : ''}`}>{line}</span>
                ))}
              </h1>
              <p className="hero-desc mt-6 max-w-[610px] text-base leading-[1.8] text-muted-foreground text-pretty md:text-[clamp(16px,1.35vw,19px)]">
                {heroSubtitle}
              </p>
              <div className="hero-index mt-10 flex w-full max-w-[460px] gap-6 border-t border-border pt-5 font-mono text-[9px] uppercase tracking-[0.12em] text-muted-foreground">
                <span className="text-foreground/70">{lang === 'en' ? 'COMMUNITY SIGNAL / ONLINE' : 'COMMUNITY SIGNAL / ONLINE'}</span>
                <span>BEIJING · CHINA</span>
              </div>
              </>}
            </div>

            {/* 右侧连接网络 */}
            <div className="hero-field relative h-[410px] w-full lg:h-[600px]">
              <CommunityNetwork />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
