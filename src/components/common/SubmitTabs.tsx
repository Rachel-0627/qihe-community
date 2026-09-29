import { Link } from 'react-router-dom';
import { FileText, Boxes, MessagesSquare } from 'lucide-react';
import { useI18n } from '@/contexts/I18nContext';
import type { SubmissionKind } from '@/types/types';

/** 可投稿的内容类型。加新类型只改这一处 */
export const SUBMIT_TABS = [
  { kind: 'case' as const,          to: '/submit/case',     zh: '案例', en: 'Case',     Icon: FileText },
  { kind: 'project' as const,       to: '/submit/project',  zh: '项目', en: 'Project',  Icon: Boxes },
  { kind: 'discussion_post' as const, to: '/submit/discuss', zh: '讨论', en: 'Discussion', Icon: MessagesSquare },
];

/** 投稿类型的元信息：标签、投稿页、发布后内容所在的路径。
 *  原先这些散在各处写成 `kind === 'case' ? … : …` 的二元判断，
 *  加第三种类型时会全部把帖子误判成项目。 */
export const SUBMIT_KIND_META: Record<SubmissionKind, { zh: string; en: string; submitTo: string; viewBase: string }> = {
  case:          { zh: '案例', en: 'Case',     submitTo: '/submit/case',     viewBase: '/cases' },
  project:       { zh: '项目', en: 'Project',  submitTo: '/submit/project',  viewBase: '/projects' },
  discussion_post: { zh: '帖子', en: 'Post', submitTo: '/submit/discuss', viewBase: '/discuss' },
};

/**
 * 投稿页顶部的类型切换条。
 * 抽成组件是因为帖子的表单和案例/项目的不是同一套外壳，
 * 不抽的话这段会被复制两份，加一个类型要改两个地方。
 */
export default function SubmitTabs({ active }: { active: SubmissionKind }) {
  const { t } = useI18n();
  return (
    <div className="mb-8 flex items-center gap-1 rounded-xl border border-border bg-card/40 p-1.5">
      {SUBMIT_TABS.map((tab) => (
        <Link
          key={tab.kind}
          to={tab.to}
          className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm transition-colors ${
            tab.kind === active
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <tab.Icon className="h-4 w-4" />
          {t(tab.zh, tab.en)}
        </Link>
      ))}
    </div>
  );
}
