import { useEffect, useMemo, useState } from 'react';
import { useI18n } from '@/contexts/I18nContext';
import { Input } from '@/components/ui/input';
import SubmissionForm from '@/components/common/SubmissionForm';
import { fetchProjectFilterOptions } from '@/lib/api';
import type { ProjectFilterOption } from '@/types/types';

/** 只放行 http/https。不加这层校验，用户可以填 javascript: 之类的地址。 */
function isSafeUrl(raw: string): boolean {
  try {
    const u = new URL(raw.trim());
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * 用户投稿项目。
 * 场景与成熟度的选项直接读 project_filter_options，
 * 和后台新增项目时的下拉是同一份数据，不会出现两套标签。
 * 视频不开放上传（几十 MB 占存储），要展示视频请填外部链接。
 */
export default function SubmitProjectPage() {
  const { t, lang } = useI18n();
  const [options, setOptions] = useState<ProjectFilterOption[]>([]);

  useEffect(() => {
    fetchProjectFilterOptions().then(setOptions).catch(() => setOptions([]));
  }, []);

  const scenes = useMemo(() => options.filter((o) => o.group === 'scene' && o.is_active), [options]);
  const maturities = useMemo(() => options.filter((o) => o.group === 'maturity' && o.is_active), [options]);
  const label = (o: ProjectFilterOption) => (lang === 'en' && o.name_en ? o.name_en : o.name);

  return (
    <SubmissionForm
      kind="project"
      folder="projects"
      heading={t('发布项目', 'Publish a project')}
      headingEdit={t('申请修改项目', 'Request an edit')}
      extraDefaults={{ external_url: '', scene: '', maturity: '' }}
      validateExtra={(v) => {
        if (!v.external_url.trim()) return t('请填写项目地址', 'Project URL is required');
        if (!isSafeUrl(v.external_url)) return t('项目地址需以 http:// 或 https:// 开头', 'URL must start with http:// or https://');
        if (!v.scene) return t('请选择应用场景', 'Please choose a scene');
        if (!v.maturity) return t('请选择成熟度', 'Please choose a maturity level');
        return null;
      }}
      renderExtra={(values, patch) => (
        <>
          <label className="flex flex-col gap-2">
            <span className="text-sm font-medium">{t('项目地址', 'Project URL')} *</span>
            <Input
              value={values.external_url}
              onChange={(e) => patch({ external_url: e.target.value })}
              placeholder="https://"
              inputMode="url"
            />
            <span className="text-xs text-muted-foreground">
              {t('能打开看的地址：线上 Demo、仓库、产品页都可以', 'Anything openable: a demo, repo, or product page')}
            </span>
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium">{t('应用场景', 'Scene')} *</span>
              <select
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                value={values.scene}
                onChange={(e) => patch({ scene: e.target.value })}
              >
                <option value="">{t('请选择', 'Select…')}</option>
                {scenes.map((o) => <option key={o.id} value={o.name}>{label(o)}</option>)}
              </select>
            </label>

            <label className="flex flex-col gap-2">
              <span className="text-sm font-medium">{t('成熟度', 'Maturity')} *</span>
              <select
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                value={values.maturity}
                onChange={(e) => patch({ maturity: e.target.value })}
              >
                <option value="">{t('请选择', 'Select…')}</option>
                {maturities.map((o) => <option key={o.id} value={o.name}>{label(o)}</option>)}
              </select>
            </label>
          </div>
        </>
      )}
      buildPayload={(v) => ({
        title: v.title.trim(),
        summary: v.summary.trim(),
        content: v.content,
        cover_url: v.cover_url,
        external_url: v.external_url.trim(),
        scene: v.scene,
        maturity: v.maturity,
        // 英文字段留空，管理员审核时用后台翻译功能补
        title_en: '', summary_en: '', content_en: '', scene_en: '', maturity_en: '',
      })}
    />
  );
}
