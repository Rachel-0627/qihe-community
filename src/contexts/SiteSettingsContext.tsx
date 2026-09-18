import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';
import { fetchSiteSettings } from '@/lib/api';

interface SiteSettingsContextValue {
  brandName: string;
  brandNameEn: string;
  termsContent: string;
  privacyContent: string;
  navLabels: Record<string, { zh: string; en: string }>;
  lockedDialog: {
    title: string;
    titleEn: string;
    content: string;
    contentEn: string;
  };
  footer: {
    tagline: string;
    taglineEn: string;
    copyright: string;
    copyrightEn: string;
  };
  businessCoop: {
    visible: boolean;
    content: string;
    contentEn: string;
  };
  reload: () => void;
}

const defaultNavLabels: Record<string, { zh: string; en: string }> = {
  '/': { zh: '首页', en: 'Home' },
  '/cases': { zh: '案例', en: 'Cases' },
  '/projects': { zh: '项目库', en: 'Projects' },
  '/events': { zh: '城市组局', en: 'Events' },
  '/business': { zh: '商务与合作', en: 'Business' },
};

const defaultLockedDialog = {
  title: '需要更高会员等级',
  titleEn: 'Higher membership required',
  content: '该项目需要更高会员等级才能查看。升级会员以解锁全部项目内容，或使用当前等级的免费解锁额度。',
  contentEn: 'This project requires a higher membership tier. Upgrade to unlock all projects, or use your free unlock quota.',
};

const defaultFooter = {
  tagline: '高端 AI 项目社区 · 创新实验室 × 数字艺术展览',
  taglineEn: 'Premium AI project community · Innovation lab × Digital art gallery',
  copyright: '© 2026 AI 创业社区. 保留所有权利。',
  copyrightEn: '© 2026 AI Startup Community. All rights reserved.',
};

const defaultBusinessCoop = {
  visible: true,
  content: '<p>欢迎与我们联系商务合作。</p>',
  contentEn: '<p>Welcome to contact us for business cooperation.</p>',
};

const SiteSettingsContext = createContext<SiteSettingsContextValue>({
  brandName: '启禾社区',
  brandNameEn: 'Qihe Community',
  termsContent: '',
  privacyContent: '',
  navLabels: defaultNavLabels,
  lockedDialog: defaultLockedDialog,
  footer: defaultFooter,
  businessCoop: defaultBusinessCoop,
  reload: () => {},
});

export function SiteSettingsProvider({ children }: { children: ReactNode }) {
  const [brandName, setBrandName] = useState('启禾社区');
  const [brandNameEn, setBrandNameEn] = useState('Qihe Community');
  const [termsContent, setTermsContent] = useState('');
  const [privacyContent, setPrivacyContent] = useState('');
  const [navLabels, setNavLabels] = useState(defaultNavLabels);
  const [lockedDialog, setLockedDialog] = useState(defaultLockedDialog);
  const [footer, setFooter] = useState(defaultFooter);
  const [businessCoop, setBusinessCoop] = useState(defaultBusinessCoop);

  const load = useCallback(async () => {
    try {
      const settings = await fetchSiteSettings();
      const get = (key: string) => settings.find((s) => s.key === key)?.value ?? '';
      const name = get('brand_name');
      const nameEn = get('brand_name_en');
      if (name) setBrandName(name);
      if (nameEn) setBrandNameEn(nameEn);
      setTermsContent(get('terms_content'));
      setPrivacyContent(get('privacy_content'));

      const next: Record<string, { zh: string; en: string }> = { ...defaultNavLabels };
      const updateNav = (path: string, zhKey: string, enKey: string) => {
        const zh = get(zhKey);
        const en = get(enKey);
        if (zh) next[path].zh = zh;
        if (en) next[path].en = en;
      };
      updateNav('/', 'nav_home', 'nav_home_en');
      updateNav('/cases', 'nav_cases', 'nav_cases_en');
      updateNav('/projects', 'nav_projects', 'nav_projects_en');
      updateNav('/events', 'nav_events', 'nav_events_en');
      updateNav('/business', 'nav_business', 'nav_business_en');
      setNavLabels(next);

      setLockedDialog({
        title: get('locked_project_dialog_title') || defaultLockedDialog.title,
        titleEn: get('locked_project_dialog_title_en') || defaultLockedDialog.titleEn,
        content: get('locked_project_dialog_content') || defaultLockedDialog.content,
        contentEn: get('locked_project_dialog_content_en') || defaultLockedDialog.contentEn,
      });

      setFooter({
        tagline: get('footer_tagline') || defaultFooter.tagline,
        taglineEn: get('footer_tagline_en') || defaultFooter.taglineEn,
        copyright: get('footer_copyright') || defaultFooter.copyright,
        copyrightEn: get('footer_copyright_en') || defaultFooter.copyrightEn,
      });

      setBusinessCoop({
        visible: get('business_coop_visible') !== 'false',
        content: get('business_coop_content') || defaultBusinessCoop.content,
        contentEn: get('business_coop_content_en') || defaultBusinessCoop.contentEn,
      });
    } catch {
      // 静默失败，使用默认值
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <SiteSettingsContext.Provider value={{ brandName, brandNameEn, termsContent, privacyContent, navLabels, lockedDialog, footer, businessCoop, reload: load }}>
      {children}
    </SiteSettingsContext.Provider>
  );
}

export function useSiteSettings() {
  return useContext(SiteSettingsContext);
}
