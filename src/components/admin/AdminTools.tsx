import { useI18n } from '@/contexts/I18nContext';

/**
 * 工具板块的后台配置。
 *
 * 原先这里只有一个「前台显示」开关，已移除：它和讨论区的同名开关挨在
 * 同一个页面上，很容易被误点，一关整个板块就从导航里消失，
 * 而且事后很难联想到是它造成的。板块现在始终可见。
 */
export default function AdminTools() {
  const { t } = useI18n();
  return (
    <p className="text-sm text-muted-foreground">
      {t('工具页内容现由「生图提示词案例库」自动承载。', 'Tools page content is now handled by the Image Prompt Case Library.')}
    </p>
  );
}
