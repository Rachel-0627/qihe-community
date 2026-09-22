import { MessageCircle } from 'lucide-react';
import { useI18n } from '@/contexts/I18nContext';
import ShimmerEmptyState from './ShimmerEmptyState';

export interface CommentItem {
  id: string;
  user_name: string;
  avatar_url?: string;
  content: string;
  created_at: string;
}

interface CommentsSectionProps {
  comments?: CommentItem[];
}

export default function CommentsSection({ comments }: CommentsSectionProps) {
  const { t } = useI18n();

  // 根据用户要求：有评论再显示评论内容，没有就不要显示，也不要显示这个页面/占位区域
  if (!comments || comments.length === 0) {
    return null;
  }

  return (
    <section className="mt-12 border-t border-border pt-8">
      <div className="flex items-center gap-2">
        <MessageCircle className="h-5 w-5 text-accent" />
        <h2 className="font-display text-xl font-medium text-foreground">
          {t('评论', 'Comments')} ({comments.length})
        </h2>
      </div>
      <div className="mt-6 space-y-4">
        {comments.map((item) => (
          <div key={item.id} className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-center justify-between">
              <span className="font-medium text-foreground">{item.user_name}</span>
              <span className="font-mono-label text-xs text-muted-foreground">{item.created_at}</span>
            </div>
            <p className="mt-2 text-sm text-muted-foreground leading-relaxed text-pretty">{item.content}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
