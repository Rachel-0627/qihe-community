import { useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useI18n } from '@/contexts/I18nContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import SubmitTabs from '@/components/common/SubmitTabs';
import FileUploadField from '@/components/common/FileUploadField';
import ImageListField from '@/components/discuss/ImageListField';
import { createSubmission, updateSubmission, fetchSubmission } from '@/lib/submissionsApi';
import { useLocalDraft } from '@/lib/useLocalDraft';

/**
 * 发布帖子。
 *
 * 未复用 SubmissionForm：该外壳固定包含摘要、封面与富文本正文，帖子均不需要，
 * 并入会在共享组件中引入大量按类型判断是否显示的分支。
 * 顶部类型切换条已抽成 SubmitTabs，两处共用。
 *
 * 帖子不含联系方式字段，交流在评论区进行。
 */
export default function SubmitDiscussPostPage() {
  const { user } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const resubmitId = params.get('resubmit');
  const targetId = params.get('target');

  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [coverUrl, setCoverUrl] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(!!resubmitId);

  const draftKey = useMemo(() => ({ type: 'submit-business', id: resubmitId ?? 'new' }), [resubmitId]);
  useLocalDraft(
    draftKey,
    { title, body, coverUrl, images },
    (d) => {
      if (d.title) setTitle(d.title);
      if (d.body) setBody(d.body);
      if (d.coverUrl) setCoverUrl(d.coverUrl);
      if (Array.isArray(d.images)) setImages(d.images);
    },
    !resubmitId,
  );

  // 改一条被驳回的投稿：把原内容取回来填进表单
  useEffect(() => {
    if (!resubmitId) return;
    fetchSubmission(resubmitId)
      .then((s) => {
        if (!s) return;
        setTitle(s.payload.title || '');
        setBody(s.payload.body || '');
        setCoverUrl(s.payload.cover_url || '');
        setImages(Array.isArray(s.payload.images) ? s.payload.images : []);
      })
      .catch(() => toast.error(t('载入失败', 'Failed to load')))
      .finally(() => setLoading(false));
  }, [resubmitId, t]);

  const submit = useCallback(async () => {
    if (!title.trim()) { toast.error(t('请填写标题', 'Title is required')); return; }
    if (!body.trim()) { toast.error(t('请填写正文', 'Content is required')); return; }
    setSubmitting(true);
    try {
      const payload = { title: title.trim(), body: body.trim(), cover_url: coverUrl, images };
      if (resubmitId) await updateSubmission(resubmitId, payload);
      else await createSubmission('discussion_post', payload, targetId);
      toast.success(t('已提交，等待管理员审核', 'Submitted, pending review'));
      navigate('/profile');
    } catch (e) {
      toast.error(e instanceof Error && e.message.includes('登录')
        ? e.message
        : t('提交失败，请稍后重试', 'Submission failed, please retry'));
    } finally {
      setSubmitting(false);
    }
  }, [title, body, coverUrl, images, resubmitId, targetId, navigate, t]);

  if (!user) return <Navigate to="/login" replace state={{ from: '/submit/discuss' }} />;
  if (loading) return <div className="py-24 text-center text-muted-foreground">{t('载入中…', 'Loading…')}</div>;

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 md:px-8 md:py-14">
      {!resubmitId && !targetId && <SubmitTabs active="discussion_post" />}

      <div className="border-b border-border pb-6">
        <p className="editorial-label text-accent">{t('投稿', 'Submit')}</p>
        <h1 className="mt-2 font-display text-3xl font-medium text-foreground md:text-4xl">
          {targetId ? t('申请修改帖子', 'Request an edit') : t('发布帖子', 'New post')}
        </h1>
        <p className="mt-3 text-sm text-muted-foreground text-pretty">
          {t('提交后需管理员审核通过才会公开。有人回应会出现在帖子下方的交流区。',
             'Reviewed before going public. Replies appear in the discussion area under your post.')}
        </p>
      </div>

      <div className="mt-8 flex flex-col gap-6">
        <label className="flex flex-col gap-2">
          <span className="text-sm font-medium">{t('标题', 'Title')} *</span>
          <Input value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)}
            placeholder={t('一句话说清你要分享或讨论什么', 'What you want to share or ask, in one line')} />
        </label>

        <FileUploadField
          label={t('封面图（列表里显示）', 'Cover image (shown in the list)')}
          value={coverUrl}
          onChange={setCoverUrl}
          folder="discuss/covers"
          accept="image/jpeg,image/png,image/webp,image/gif"
        />

        {/* 配图放在正文输入框前面，跟详情页的排列一致，
            免得发帖时以为图会出现在文字下面 */}
        <ImageListField value={images} onChange={setImages} folder="discuss/images" />

        <label className="flex flex-col gap-2">
          <span className="text-sm font-medium">{t('正文', 'Content')} *</span>
          <Textarea value={body} rows={10} maxLength={3000} onChange={(e) => setBody(e.target.value)}
            placeholder={t('你的做法、遇到的问题、踩过的坑、想听听大家怎么看…', 'What you did, what went wrong, what you want others to weigh in on…')} />
          <span className="text-xs text-muted-foreground">{body.length}/3000</span>
        </label>

        <div className="flex items-center gap-3">
          <Button onClick={submit} disabled={submitting} className="font-mono-label text-xs uppercase tracking-wider">
            {submitting ? t('提交中…', 'Submitting…') : t('发布', 'Publish')}
          </Button>
          <Button variant="ghost" onClick={() => navigate(-1)} className="font-mono-label text-xs uppercase tracking-wider">
            {t('取消', 'Cancel')}
          </Button>
        </div>
      </div>
    </div>
  );
}
