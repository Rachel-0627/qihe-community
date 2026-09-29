import { useEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';
import { useI18n } from '@/contexts/I18nContext';
import { fetchHomeStats, type HomeStats as Stats } from '@/lib/api';

gsap.registerPlugin(useGSAP, ScrollTrigger);

/** 大数字更易读：中文超过一万折算成「万」，英文超过一千折算成 k */
function formatCount(n: number, lang: 'zh' | 'en') {
  if (lang === 'zh') {
    return n >= 10000 ? `${(n / 10000).toFixed(1)}万` : n.toLocaleString('zh-CN');
  }
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : n.toLocaleString('en-US');
}

/** 首页数据带：用真实数字给社区一个「有多少东西」的第一印象 */
export default function HomeStats() {
  const { t, lang } = useI18n();
  const [stats, setStats] = useState<Stats | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchHomeStats().then(setStats).catch(() => {});
  }, []);

  // 数字滚动：进入视口时从 0 增长到真实值
  useGSAP(() => {
    if (!stats || !rootRef.current) return;
    const nodes = rootRef.current.querySelectorAll<HTMLElement>('[data-count]');
    nodes.forEach((el) => {
      const target = Number(el.dataset.count || 0);
      const proxy = { v: 0 };
      el.textContent = '0';
      gsap.to(proxy, {
        v: target,
        duration: 1.1,
        ease: 'power2.out',
        onUpdate: () => { el.textContent = formatCount(Math.round(proxy.v), lang); },
        scrollTrigger: { trigger: el, start: 'top 90%', once: true },
      });
    });
  }, { scope: rootRef, dependencies: [stats, lang] });

  const items: { key: keyof Stats; zh: string; en: string }[] = [
    { key: 'cases', zh: '收录案例', en: 'Cases' },
    { key: 'projects', zh: '收录项目', en: 'Projects' },
    { key: 'events', zh: '城市活动', en: 'Events' },
    { key: 'views', zh: '累计浏览', en: 'Total Views' },
  ];

  return (
    <section className="border-b border-border bg-card">
      <div ref={rootRef} className="mx-auto max-w-7xl px-4 md:px-8">
        <div className="grid grid-cols-2 md:grid-cols-4">
          {items.map((item, i) => (
            // 标签在上、数字在下，左对齐成一组。
            // 原先用 justify-between 把数字顶到左边、标签甩到右边，
            // 屏幕越宽两者离得越远，看上去不像同一条数据
            <div
              key={item.key}
              className={`flex min-h-[90px] flex-col justify-end gap-1.5 py-6 md:min-h-[118px] md:py-7 ${i % 2 === 1 ? 'border-l border-border pl-4 md:pl-6' : ''} ${i >= 2 ? 'border-t border-border md:border-t-0' : ''} ${i === 2 ? 'md:border-l md:pl-6' : ''} ${i === 3 ? 'md:pl-6' : ''}`}
            >
              <p className="editorial-label text-[11px] leading-none tracking-[0.1em] text-muted-foreground">{t(item.zh, item.en)}</p>
              <p className="font-display text-[28px] font-medium leading-none tabular-nums text-foreground md:text-[34px] md:font-[540] md:tracking-[-.03em]">
                {stats ? <span data-count={stats[item.key]}>{formatCount(stats[item.key], lang)}</span> : <span className="text-muted-foreground">—</span>}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
