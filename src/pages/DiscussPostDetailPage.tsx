import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { useI18n } from '@/contexts/I18nContext';
import { fetchDiscussionPostById } from '@/lib/discussionApi';
import PostComments from '@/components/discuss/PostComments';
import type { DiscussionPost } from '@/types/types';

export default function DiscussPostDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useI18n();
  const [item, setItem] = useState<DiscussionPost | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    window.scrollTo({ top: 0 });
    if (!id) return;
    fetchDiscussionPostById(id)
      .then(setItem)
      .catch(() => toast.error(t('加载失败', 'Failed to load')))
      .finally(() => setLoading(false));
  }, [id, t]);

  if (loading) return <div className="py-24 text-center text-muted-foreground">{t('载入中…', 'Loading…')}</div>;
  if (!item) return <div className="py-24 text-center text-muted-foreground">{t('帖子不存在或已被删除', 'Post not found')}</div>;

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 md:px-8 md:py-14">
      <Link to="/business" className="inline-flex items-center gap-1.5 font-mono-label text-xs uppercase tracking-wider text-muted-foreground transition-colors hover:text-foreground">
        <ArrowLeft className="h-3.5 w-3.5" />
        {t('返回分享讨论区', 'Back to Business')}
      </Link>

      <header className="mt-8 border-b border-border pb-6">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono-label text-xs text-muted-foreground">
            {item.author_name || t('匿名', 'Anonymous')} · {new Date(item.created_at).toLocaleDateString('zh-CN')}
          </span>
        </div>
        <h1 className="mt-3 font-display text-3xl font-medium leading-tight text-foreground text-balance md:text-4xl">
          {item.title}
        </h1>
      </header>

      {item.cover_url && (
        <div className="mt-8 overflow-hidden border border-border bg-card">
          <img src={item.cover_url} alt={item.title} loading="lazy" className="w-full object-cover" />
        </div>
      )}

      {/* 配图排在正文前面。单张铺满，多张两列——
          一列排下来在长帖里会把正文推得太远 */}
      {item.images?.length > 0 && (
        <div className={`mt-6 grid gap-3 ${item.images.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
          {item.images.map((url, i) => (
            <a key={url} href={url} target="_blank" rel="noreferrer" className="overflow-hidden border border-border bg-card">
              <img src={url} alt={`${item.title} ${i + 1}`} loading="lazy" className="w-full object-cover transition-transform hover:scale-[1.02]" />
            </a>
          ))}
        </div>
      )}

      {/* 正文是纯文本，用 whitespace-pre-line 保住换行；
          不走 dangerouslySetInnerHTML —— 用户输入的内容不能当 HTML 渲染 */}
      <div className="mt-8 whitespace-pre-line text-base leading-relaxed text-foreground text-pretty">
        {item.body}
      </div>

      <PostComments postId={item.id} />
    </div>
  );
}
