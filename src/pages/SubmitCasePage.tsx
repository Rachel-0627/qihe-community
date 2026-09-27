import { useEffect, useState } from 'react';
import { useI18n } from '@/contexts/I18nContext';
import SubmissionForm from '@/components/common/SubmissionForm';
import { fetchCategories } from '@/lib/api';
import type { Category } from '@/types/types';

/** 用户投稿案例。公共逻辑都在 SubmissionForm 里，这里只管「分类」这个专有字段。 */
export default function SubmitCasePage() {
  const { t } = useI18n();
  const [categories, setCategories] = useState<Category[]>([]);

  useEffect(() => {
    fetchCategories('case').then(setCategories).catch(() => setCategories([]));
  }, []);

  return (
    <SubmissionForm
      kind="case"
      folder="cases"
      heading={t('发布案例', 'Publish a case')}
      headingEdit={t('申请修改案例', 'Request an edit')}
      extraDefaults={{ category_id: '' }}
      renderExtra={(values, patch) =>
        categories.length > 0 && (
          <label className="flex flex-col gap-2">
            <span className="text-sm font-medium">{t('分类', 'Category')}</span>
            <select
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              value={values.category_id || ''}
              onChange={(e) => patch({ category_id: e.target.value })}
            >
              <option value="">{t('不指定', 'Unspecified')}</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </label>
        )
      }
      buildPayload={(v) => ({
        title: v.title.trim(),
        summary: v.summary.trim(),
        content: v.content,
        cover_url: v.cover_url,
        category_id: v.category_id || null,
        // 英文字段留空，管理员审核时可用后台的翻译功能补
        title_en: '', summary_en: '', content_en: '',
      })}
    />
  );
}
