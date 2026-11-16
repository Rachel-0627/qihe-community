import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent, ClipboardEvent } from 'react';
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
import DiscussionBody from '@/components/discuss/DiscussionBody';
import { uploadMedia } from '@/lib/api';
import { DISCUSSION_CATEGORIES } from '@/lib/communityConnectionsApi';
import { DISCUSSION_IMAGE_MISSING_MARKER, discussionBodyParts, prepareDiscussionPaste, replaceUnavailableDiscussionImages } from '@/lib/discussionBody';
import {
  createSubmission, updateSubmission, fetchSubmission,
  findPendingEditFor, fetchPublishedForEdit,
} from '@/lib/submissionsApi';
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
  const [category, setCategory] = useState<string>('随想交流');
  const [submitting, setSubmitting] = useState(false);
  const [pastingImages, setPastingImages] = useState(false);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const videoSelectionRef = useRef({ start: 0, end: 0 });
  const [loading, setLoading] = useState(!!resubmitId || !!targetId);
  /** ?target= 进来时，若已有一条待审的修改申请，就改那条而不是再开一条 */
  const [editingId, setEditingId] = useState<string | null>(resubmitId);
  /** 预填失败：空表单提交会把线上帖子清空，必须拦住 */
  const [prefillFailed, setPrefillFailed] = useState(false);

  // 草稿按场景分开存：新建、改某条投稿、改某条已发布内容，
  // 共用一个 key 会互相覆盖——申请修改时冒出一份「新建帖子」的旧草稿很莫名其妙
  const draftKey = useMemo(
    () => ({ type: 'submit-business', id: resubmitId ?? (targetId ? `target-${targetId}` : 'new') }),
    [resubmitId, targetId],
  );
  useLocalDraft(
    draftKey,
    { title, body, coverUrl, images, category },
    (d) => {
      if (d.title) setTitle(d.title);
      if (d.body) setBody(d.body);
      if (d.coverUrl) setCoverUrl(d.coverUrl);
      if (Array.isArray(d.images)) setImages(d.images);
      if (d.category) setCategory(d.category);
    },
    // 申请修改时不要恢复草稿：内容应该来自线上那条，
    // 否则会被「新建帖子」时留下的半成品盖掉
    !resubmitId && !targetId,
  );

  // 把一份内容填进表单。payload 和正式表的字段名是对齐的
  const fill = useCallback((p: Record<string, unknown>) => {
    if (typeof p.title === 'string') setTitle(p.title);
    if (typeof p.body === 'string') setBody(p.body);
    if (typeof p.cover_url === 'string') setCoverUrl(p.cover_url);
    if (typeof p.category === 'string') setCategory(p.category);
    if (Array.isArray(p.images)) setImages(p.images as string[]);
    else if (typeof p.images === 'string') {
      // fetchPublishedForEdit 把数组序列化成字符串传回来
      try { const a = JSON.parse(p.images); if (Array.isArray(a)) setImages(a); } catch { /* 忽略 */ }
    }
  }, []);

  useEffect(() => {
    // 改一条已有的投稿（被驳回、待审、或草稿箱里的）
    if (resubmitId) {
      fetchSubmission(resubmitId)
        .then((s) => { if (s) fill(s.payload as Record<string, unknown>); })
        .catch(() => toast.error(t('载入失败', 'Failed to load')))
        .finally(() => setLoading(false));
      return;
    }

    // 申请修改已发布的帖子
    if (targetId) {
      (async () => {
        try {
          // 线上现在长什么样，先读出来当底子。
          // 不能拿当初那条投稿当底子：发布后管理员可能改过
          const live = await fetchPublishedForEdit('discussion_post', targetId);
          if (!live) { setPrefillFailed(true); return; }

          const pending = await findPendingEditFor(targetId);
          if (!pending) { fill(live); return; }

          setEditingId(pending.id);
          // 待审那条里真的填了东西的字段，盖在线上内容之上
          const draft = (pending.payload || {}) as Record<string, unknown>;
          const merged: Record<string, unknown> = { ...live };
          for (const [k, v] of Object.entries(draft)) {
            if (Array.isArray(v) ? v.length > 0 : typeof v === 'string' && v.trim() !== '') merged[k] = v;
          }
          fill(merged);
          toast.info(t('你之前提交的修改还在审核中，这次会直接改那一条',
                       'Your earlier edit is still under review — this will update it'));
        } catch {
          setPrefillFailed(true);
        } finally {
          setLoading(false);
        }
      })();
      return;
    }

    setLoading(false);
  }, [resubmitId, targetId, fill, t]);

  const chooseVideo = useCallback(() => {
    const input = bodyRef.current;
    if (input) videoSelectionRef.current = { start: input.selectionStart, end: input.selectionEnd };
    videoInputRef.current?.click();
  }, []);

  const uploadInlineVideo = useCallback(async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    if (!file) return;
    if (!file.type.startsWith('video/')) {
      toast.error(t('请选择视频文件', 'Choose a video file'));
      return;
    }

    const selection = videoSelectionRef.current;
    setUploadingVideo(true);
    try {
      const url = await uploadMedia(file, 'discuss/inline');
      const marker = `![视频](${url})`;
      setBody((current) => {
        const start = Math.min(selection.start, current.length);
        const end = Math.min(selection.end, current.length);
        const before = current.slice(0, start);
        const after = current.slice(end);
        const prefix = before && !before.endsWith('\n') ? '\n' : '';
        const suffix = after && !after.startsWith('\n') ? '\n' : '';
        return `${before}${prefix}${marker}${suffix}${after}`;
      });
      toast.success(t('视频已插入正文', 'Video inserted into the post'));
    } catch {
      toast.error(t('视频上传失败，请确认文件不超过 50MB 后重试', 'Video upload failed. Check that the file is under 50 MB and try again.'));
    } finally {
      setUploadingVideo(false);
      bodyRef.current?.focus();
    }
  }, [t]);

  const pasteBody = useCallback(async (event: ClipboardEvent<HTMLTextAreaElement>) => {
    const clipboard = event.clipboardData;
    const plain = clipboard.getData('text/plain');
    const html = clipboard.getData('text/html');
    const prepared = prepareDiscussionPaste(html, plain);
    const files = Array.from(clipboard.items)
      .filter((item) => item.kind === 'file' && item.type.startsWith('image/'))
      .map((item) => item.getAsFile())
      .filter((file): file is File => file !== null);
    if (prepared.sources.length === 0 && files.length === 0) {
      if (plain.includes('[图片]')) {
        event.preventDefault();
        const input = event.currentTarget;
        const start = input.selectionStart;
        const end = input.selectionEnd;
        setBody((current) => current.slice(0, start) + replaceUnavailableDiscussionImages(plain) + current.slice(end));
        toast.warning(t('剪贴板没有带上图片，请单独复制图片并粘贴到正文，或使用上方“配图”上传',
          'The clipboard did not include the images. Copy each image into the post, or upload it using Images above.'));
      }
      return;
    }

    event.preventDefault();
    const input = event.currentTarget;
    const start = input.selectionStart;
    const end = input.selectionEnd;
    const count = Math.max(prepared.sources.length, files.length);
    let pasted = prepared.text;
    if (prepared.sources.length === 0) {
      let index = 0;
      pasted = plain.replace(/\[图片\]/g, (value) => index < files.length ? `__QIHE_PASTED_IMAGE_${index++}__` : value);
      while (index < files.length) pasted += `${pasted && !pasted.endsWith('\n') ? '\n' : ''}__QIHE_PASTED_IMAGE_${index++}__\n`;
    } else if (files.length > prepared.sources.length) {
      for (let i = prepared.sources.length; i < files.length; i++) {
        pasted += `${pasted && !pasted.endsWith('\n') ? '\n' : ''}__QIHE_PASTED_IMAGE_${i}__\n`;
      }
    }
    setPastingImages(true);
    let failed = 0;
    try {
      for (let i = 0; i < count; i++) {
        const source = prepared.sources[i];
        let file = files[i];
        if (!file && source && /^(data:image\/|blob:|https?:\/\/)/i.test(source)) {
          try {
            const response = await fetch(source);
            if (!response.ok) throw new Error('Image unavailable');
            const blob = await response.blob();
            if (!blob.type.startsWith('image/')) throw new Error('Not an image');
            file = new File([blob], `pasted-${i}.${blob.type.split('/')[1] || 'png'}`, { type: blob.type });
          } catch { /* 飞书图片可能需要登录或禁止跨站读取 */ }
        }
        let replacement = DISCUSSION_IMAGE_MISSING_MARKER;
        if (file) {
          try { replacement = `![图片](${await uploadMedia(file, 'discuss/inline')})`; }
          catch { failed++; }
        } else failed++;
        pasted = pasted.replace(`__QIHE_PASTED_IMAGE_${i}__`, replacement);
      }
      setBody((current) => current.slice(0, start) + pasted + current.slice(end));
      if (failed) toast.warning(t(`${failed} 张图片未能读取，请逐张复制图片再粘贴`,
        `${failed} images could not be read. Copy and paste them one by one.`));
    } finally {
      setPastingImages(false);
      bodyRef.current?.focus();
    }
  }, [t]);

  const submit = useCallback(async () => {
    if (!title.trim()) { toast.error(t('请填写标题', 'Title is required')); return; }
    if (!body.trim()) { toast.error(t('请填写正文', 'Content is required')); return; }
    if (body.includes(DISCUSSION_IMAGE_MISSING_MARKER)) {
      toast.error(t('正文里有未导入的图片，请补传图片或删除提示后再发布',
        'Your post has images that were not imported. Upload them or remove the markers before publishing.'));
      return;
    }
    if (body.length > 3000) { toast.error(t('正文超过 3000 字，请精简后发布', 'Content exceeds 3000 characters')); return; }
    setSubmitting(true);
    try {
      const payload = { title: title.trim(), body: body.trim(), cover_url: coverUrl, images, category };
      if (editingId) await updateSubmission(editingId, payload);
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
  }, [title, body, coverUrl, images, category, editingId, targetId, navigate, t]);

  if (!user) return <Navigate to="/login" replace state={{ from: '/submit/discuss' }} />;
  if (loading) return <div className="py-24 text-center text-muted-foreground">{t('载入中…', 'Loading…')}</div>;

  // 读不到原帖就不让往下走：空表单一提交会把线上内容清空
  if (prefillFailed) {
    return (
      <div className="mx-auto max-w-xl px-4 py-24 text-center">
        <h1 className="font-display text-xl font-medium text-foreground">
          {t('读不到这条内容', 'Could not load this content')}
        </h1>
        <p className="mt-3 text-sm text-muted-foreground text-pretty">
          {t('可能帖子已被删除。为避免提交空白内容把线上的覆盖掉，这里先不让继续。',
             'It may have been removed. To avoid overwriting the live post with a blank form, editing is blocked here.')}
        </p>
        <Button variant="secondary" className="mt-6" onClick={() => navigate('/profile')}>
          {t('返回个人中心', 'Back to profile')}
        </Button>
      </div>
    );
  }

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
          <span className="text-sm font-medium">{t('内容分类', 'Category')}</span>
          <select value={category} onChange={(e) => setCategory(e.target.value)} className="h-10 rounded-md border border-input bg-background px-3 text-sm">
            {DISCUSSION_CATEGORIES.filter((item) => item !== '全部').map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </label>
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
          <Textarea ref={bodyRef} value={body} rows={10} maxLength={3000} readOnly={pastingImages || uploadingVideo}
            onChange={(e) => setBody(e.target.value)} onPaste={(e) => void pasteBody(e)}
            placeholder={t('你的做法、遇到的问题、踩过的坑、想听听大家怎么看…', 'What you did, what went wrong, what you want others to weigh in on…')} />
          <span className="text-xs text-muted-foreground">{pastingImages
            ? t('正在粘贴图片…', 'Pasting images…')
            : uploadingVideo ? t('正在上传并插入视频…', 'Uploading and inserting video…')
            : t('从飞书粘贴时若出现“图片未导入”，请单独复制图片粘贴，或使用上方“配图”上传', 'If Feishu images are not imported, copy them individually or upload them using Images above')}
            {' · '}{body.length}/3000</span>
        </label>
        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" variant="secondary" onClick={chooseVideo} disabled={pastingImages || uploadingVideo}>
            {uploadingVideo ? t('视频上传中…', 'Uploading video…') : t('插入视频', 'Insert video')}
          </Button>
          <input ref={videoInputRef} type="file" accept="video/mp4,video/webm,video/ogg" className="hidden"
            onChange={(e) => void uploadInlineVideo(e)} />
          <span className="text-xs text-muted-foreground">
            {t('选择 MP4、WebM 或 OGG 视频，单个不超过 50MB。飞书占位提示不含原视频文件。', 'Choose an MP4, WebM, or OGG video up to 50 MB. Feishu placeholders do not contain the source video.')}
          </span>
        </div>
        {discussionBodyParts(body).some((part) => part.type === 'image' || part.type === 'video') && (
          <div className="border-t border-border pt-4">
            <p className="mb-3 text-sm font-medium">{t('正文预览', 'Content preview')}</p>
            <DiscussionBody body={body} />
          </div>
        )}

        <div className="flex items-center gap-3">
          <Button onClick={submit} disabled={submitting || pastingImages || uploadingVideo || body.length > 3000} className="font-mono-label text-xs uppercase tracking-wider">
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
