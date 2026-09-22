import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';
import { fetchSiteContent } from '@/lib/api';
import { useI18n } from '@/contexts/I18nContext';

/**
 * 页面文案上下文：从数据库 site_content 表动态加载后台「页面文案设置」保存的内容。
 * 数据库值优先；无数据/为空时回退到组件内置默认文案，保证任何情况下页面都有文字。
 */
interface SiteContentContextValue {
  /** 取文案：数据库有值用数据库值，否则回退默认；按当前语言返回中/英文 */
  c: (section: string, key: string, fallbackZh: string, fallbackEn: string) => string;
  reload: () => void;
}

const SiteContentContext = createContext<SiteContentContextValue>({
  c: (_section, _key, fallbackZh) => fallbackZh,
  reload: () => {},
});

export function SiteContentProvider({ children }: { children: ReactNode }) {
  const { lang } = useI18n();
  const [items, setItems] = useState<Map<string, { zh: string; en: string }>>(new Map());

  const load = useCallback(async () => {
    try {
      const rows = await fetchSiteContent();
      const map = new Map<string, { zh: string; en: string }>();
      for (const row of rows) {
        map.set(`${row.section}.${row.key}`, { zh: row.value ?? '', en: row.value_en ?? '' });
      }
      setItems(map);
    } catch {
      // 静默失败：使用组件默认文案
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const c = useCallback(
    (section: string, key: string, fallbackZh: string, fallbackEn: string) => {
      const item = items.get(`${section}.${key}`);
      const zh = item?.zh?.trim() || fallbackZh;
      // 英文缺失时回落中文，避免出现空白
      const en = item?.en?.trim() || fallbackEn?.trim() || zh;
      return lang === 'en' ? en : zh;
    },
    [items, lang]
  );

  return <SiteContentContext.Provider value={{ c, reload: load }}>{children}</SiteContentContext.Provider>;
}

export function useSiteContent() {
  return useContext(SiteContentContext);
}
