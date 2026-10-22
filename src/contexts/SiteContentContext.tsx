import type { ReactNode } from 'react';
import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useI18n } from '@/contexts/I18nContext';
import { fetchSiteContent } from '@/lib/api';

/**
 * 页面文案上下文：前台仅展示数据库 site_content 表中后台保存的内容，不保留组件默认副本。
 */
interface SiteContentContextValue {
  /** 只读取后台保存的文案；数据未就绪或缺失时不显示另一份默认文案 */
  c: (section: string, key: string) => string;
  status: 'loading' | 'ready' | 'error';
  reload: () => Promise<void>;
}

const SiteContentContext = createContext<SiteContentContextValue>({
  c: () => '',
  status: 'loading',
  reload: async () => {},
});

export function SiteContentProvider({ children }: { children: ReactNode }) {
  const { lang } = useI18n();
  const [items, setItems] = useState<Map<string, { zh: string; en: string }>>(new Map());
  const [status, setStatus] = useState<SiteContentContextValue['status']>('loading');

  const load = useCallback(async () => {
    setStatus('loading');
    try {
      const rows = await fetchSiteContent();
      const map = new Map<string, { zh: string; en: string }>();
      for (const row of rows) {
        map.set(`${row.section}.${row.key}`, { zh: row.value ?? '', en: row.value_en ?? '' });
      }
      setItems(map);
      setStatus('ready');
    } catch {
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const c = useCallback(
    (section: string, key: string) => {
      if (status !== 'ready') return '';
      const item = items.get(`${section}.${key}`);
      const zh = item?.zh?.trim() || '';
      // 后台未填写英文时沿用同一条后台记录的中文，不使用代码中的另一份文案。
      const en = item?.en?.trim() || zh;
      return lang === 'en' ? en : zh;
    },
    [items, lang, status]
  );

  return <SiteContentContext.Provider value={{ c, status, reload: load }}>{children}</SiteContentContext.Provider>;
}

export function useSiteContent() {
  return useContext(SiteContentContext);
}
