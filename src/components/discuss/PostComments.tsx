import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { MessageCircle, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useI18n } from '@/contexts/I18nContext';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { fetchPostComments, addPostComment, deletePostComment } from '@/lib/discussionApi';
import type { PostComment } from '@/types/types';

/**
 * 帖子评论区。
 *
 * 只做一级评论，不做楼中楼——嵌套的数据结构、折叠规则、通知逻辑都会翻倍，
 * 这个量级的社区用不上，想回复某人写 @昵称 就够。
 *
 * 评论不审核（审核要等一天的评论区等于没有评论区），
 * 靠作者自删和管理员删除兜底。删除是软删，数据库里留痕。
 */
export default function PostComments({ postId }: { postId: string }) {
  const { user, profile } = useAuth();
  const { t } = useI18n();
  const [comments, setComments] = useState<PostComment[]>([]);
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    fetchPostComments(postId)
      .then(setComments)
      .catch(() => toast.error(t('评论加载失败', 'Failed to load comments')))
      .finally(() => setLoading(false));
  }, [postId, t]);

  useEffect(load, [load]);

  const send = useCallback(async () => {
    if (!body.trim()) return;
    setSending(true);
    try {
      const created = await addPostComment(postId, body);
      // 直接追加而不是整段重拉：评论多了以后重拉会让页面跳一下
      setComments((prev) => [...prev, created]);
      setBody('');
    } catch (e) {
      toast.error(e instanceof Error && e.message.includes('登录')
        ? e.message
        : t('发送失败，请稍后重试', 'Failed to send, please retry'));
    } finally {
      setSending(false);
    }
  }, [body, postId, t]);

  const remove = useCallback(async (id: string) => {
    try {
      await deletePostComment(id);
      setComments((prev) => prev.filter((c) => c.id !== id));
    } catch {
      toast.error(t('删除失败', 'Failed to delete'));
    }
  }, [t]);

  const canDelete = (c: PostComment) =>
    !!user && (c.author_id === user.id || profile?.role === 'admin');

  return (
    <section className="mt-10 border-t border-border pt-8">
      <div className="flex items-center gap-2">
        <MessageCircle className="h-5 w-5 text-accent" />
        <h2 className="font-display text-xl font-medium text-foreground">
          {t('交流区', 'Discussion')}{comments.length > 0 && ` (${comments.length})`}
        </h2>
      </div>

      {loading ? (
        <p className="mt-6 text-sm text-muted-foreground">{t('载入中…', 'Loading…')}</p>
      ) : comments.length === 0 ? (
        <p className="mt-6 text-sm text-muted-foreground">
          {t('还没有人回应，来说第一句。', 'No replies yet — say the first word.')}
        </p>
      ) : (
        <div className="mt-6 space-y-5">
          {comments.map((c) => (
            <div key={c.id} className="flex gap-3">
              <Avatar className="h-8 w-8 shrink-0">
                <AvatarImage src={c.author_avatar || undefined} alt={c.author_name} />
                <AvatarFallback className="bg-muted text-xs">{(c.author_name || 'U')[0]}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-foreground">{c.author_name || t('匿名', 'Anonymous')}</span>
                  <span className="font-mono-label text-xs text-muted-foreground">
                    {new Date(c.created_at).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </span>
                  {canDelete(c) && (
                    <button
                      type="button"
                      onClick={() => remove(c.id)}
                      className="ml-auto text-muted-foreground transition-colors hover:text-destructive"
                      aria-label={t('删除', 'Delete')}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
                <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-foreground text-pretty">{c.body}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {user ? (
        <div className="mt-8 flex flex-col gap-2">
          <Textarea
            value={body}
            rows={3}
            maxLength={1000}
            onChange={(e) => setBody(e.target.value)}
            placeholder={t('说点什么…想回复谁就 @ 他的昵称', 'Say something… mention someone with @nickname')}
          />
          <div className="flex justify-end">
            <Button onClick={send} disabled={sending || !body.trim()} size="sm" className="font-mono-label text-xs uppercase tracking-wider">
              {sending ? t('发送中…', 'Sending…') : t('发送', 'Send')}
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-8 border border-dashed border-border p-5 text-center">
          <p className="text-sm text-muted-foreground">{t('登录后可以参与讨论', 'Sign in to join the discussion')}</p>
          <Link to="/login">
            <Button size="sm" className="mt-3 font-mono-label text-xs uppercase tracking-wider">{t('登录', 'Sign in')}</Button>
          </Link>
        </div>
      )}
    </section>
  );
}
