import { Link } from 'react-router-dom';
import { useI18n } from '@/contexts/I18nContext';
import { useSiteSettings } from '@/contexts/SiteSettingsContext';
import { useSiteContent } from '@/contexts/SiteContentContext';

export default function Footer() {
  const { t } = useI18n();
  const { brandName, brandNameEn, footer, businessCoop, tools } = useSiteSettings();
  // 页脚文案优先读后台「页面文案设置」（site_content 表），无值回退「品牌与导航」配置
  const { c } = useSiteContent();
  return (
    <footer className="border-t border-border bg-[#0b0c0f]">
      <div className="mx-auto max-w-7xl px-4 py-12 md:px-8">
        {/* 12 栏网格：品牌占 5 栏，三组链接均分右侧 7 栏，
            避免原来「左边一个 logo、右边三列挤在一起、中间大片空白」的失衡 */}
        <div className="grid grid-cols-2 gap-x-8 gap-y-10 md:grid-cols-12">
          <div className="col-span-2 md:col-span-5">
            <Link to="/" className="inline-block font-display text-lg font-semibold tracking-tight text-foreground hover:text-accent transition-colors">
              {c('footer', 'brand', brandName, brandNameEn)}
            </Link>
            <p className="mt-4 max-w-sm text-base leading-relaxed text-muted-foreground text-pretty">
              {c('footer', 'tagline', footer.tagline, footer.taglineEn)}
            </p>
          </div>

          <div className="md:col-span-2 md:col-start-7">
            <Link to="/" className="editorial-label mb-3 inline-block text-lg tracking-[0.06em] text-foreground hover:text-accent transition-colors">
              {t('探索', 'Explore')}
            </Link>
            <ul className="space-y-2.5 text-base text-muted-foreground">
              <li><Link to="/cases" className="hover:text-accent transition-colors">{t('案例', 'Cases')}</Link></li>
              <li><Link to="/projects" className="hover:text-accent transition-colors">{t('项目库', 'Projects')}</Link></li>
              <li><Link to="/events" className="hover:text-accent transition-colors">{t('城市组局', 'Events')}</Link></li>
              {businessCoop.visible && (
                <li><Link to="/business" className="hover:text-accent transition-colors">{t('商务与合作', 'Business')}</Link></li>
              )}
              {tools.visible && (
                <li><Link to="/tools" className="hover:text-accent transition-colors">{t('工具', 'Tools')}</Link></li>
              )}
            </ul>
          </div>
          <div className="md:col-span-2">
            <Link to="/login" className="editorial-label mb-3 inline-block text-lg tracking-[0.06em] text-foreground hover:text-accent transition-colors">
              {t('账号', 'Account')}
            </Link>
            <ul className="space-y-2.5 text-base text-muted-foreground">
              <li><Link to="/login" className="hover:text-accent transition-colors">{t('登录', 'Sign in')}</Link></li>
              <li><Link to="/benefits" className="hover:text-accent transition-colors">{t('权益', 'Benefits')}</Link></li>
              <li><Link to="/profile" className="hover:text-accent transition-colors">{t('个人中心', 'Profile')}</Link></li>
            </ul>
          </div>
          <div className="md:col-span-2">
            <Link to="/terms" className="editorial-label mb-3 inline-block text-lg tracking-[0.06em] text-foreground hover:text-accent transition-colors">
              {t('关于', 'About')}
            </Link>
            <ul className="space-y-2.5 text-base text-muted-foreground">
              <li><Link to="/terms" className="hover:text-accent transition-colors">{t('用户协议', 'Terms')}</Link></li>
              <li><Link to="/privacy" className="hover:text-accent transition-colors">{t('隐私政策', 'Privacy')}</Link></li>
            </ul>
          </div>
        </div>

        <div className="mt-10 border-t border-border pt-6">
          <p className="font-mono-label text-xs text-muted-foreground">
            {c('footer', 'copyright', footer.copyright, footer.copyrightEn)}
          </p>
        </div>
      </div>
    </footer>
  );
}