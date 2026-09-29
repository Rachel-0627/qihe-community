import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useI18n } from '@/contexts/I18nContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import ImmersiveEditor from '@/components/editor/ImmersiveEditor';
import SubmitTabs from '@/components/common/SubmitTabs';
import FileUploadField from '@/components/common/FileUploadField';
import { createSubmission, fetchSubmission, updateSubmission } from '@/lib/submissionsApi';
import { loadDraft, removeDraft, saveDraft } from '@/lib/useLocalDraft';
import type { SubmissionKind, SubmissionPayload } from '@/types/types';

/** 表单值。公共字段固定，各内容类型的专有字段以字符串键追加。 */
export interface SubmissionFormValues {
  title: string;
  summary: string;
  content: string;
  cover_url: string;
  [extra: string]: string;
}

interface SubmissionFormProps {
  kind: SubmissionKind;
  /** 页面标题与说明 */
  heading: string;
  headingEdit: string;
  /** 上传目录前缀，如 cases / projects */
  folder: string;
  /** 专有字段的初始值 */
  extraDefaults?: Record<string, string>;
  /** 渲染专有字段。用同一套 values / patch，草稿和校验才能统一处理 */
  renderExtra?: (values: SubmissionFormValues, patch: (n: Record<string, string>) => void) => ReactNode;
  /** 返回错误文案表示校验不通过；返回 null 放行 */
  validateExtra?: (values: SubmissionFormValues) => string | null;
  /** 把表单值转成提交给后端的 payload */
  buildPayload: (values: SubmissionFormValues) => SubmissionPayload;
}

/**
 * 投稿表单的公共外壳：登录判断、本地草稿、公共字段、提交与重投。
 * 案例和项目投稿页共用它，各自只关心自己的专有字段——
 * 否则两个页面会各自躺着一份一模一样的逻辑，改一处要改两处。
 */
export default function SubmissionForm({
  kind, heading, headingEdit, folder,
  extraDefaults = {}, renderExtra, validateExtra, buildPayload,
}: SubmissionFormProps) {
  const { user } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  // ?resubmit=<id> 改一条被驳回的投稿；?target=<id> 申请修改已发布内容
  const resubmitId = params.get('resubmit');
  const targetId = params.get('target');

  const empty = useMemo<SubmissionFormValues>(
    () => ({ title: '', summary: '', content: '', cover_url: '', ...extraDefaults }),
    // extraDefaults 由调用方以字面量传入，这里只在首次挂载时取一次
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  const draftKey = useMemo(
    () => ({ type: `submit-${kind}`, id: resubmitId ?? 'new' }),
    [kind, resubmitId],
  );

  const [values, setValues] = useState<SubmissionFormValues>(empty);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(!!resubmitId);

  useEffect(() => {
    const local = loadDraft<SubmissionFormValues>(draftKey);
    if (local) setValues({ ...empty, ...local });
    if (!resubmitId) return;
    fetchSubmission(resubmitId)
      .then((s) => {
        if (!s) return;
        const p = (s.payload || {}) as Record<string, string>;
        setValues((prev) => ({ ...prev, ...p, cover_url: p.cover_url ?? '' }));
      })
      .catch(() => toast.error(t('读取投稿失败', 'Failed to load submission')))
      .finally(() => setLoading(false));
  }, [resubmitId, draftKey, empty, t]);

  // 用 Record<string,string> 而不是 Partial<>：后者允许 undefined，
  // 与 SubmissionFormValues 的字符串索引签名冲突
  const patch = useCallback((next: Record<string, string>) => {
    setValues((prev) => {
      const merged = { ...prev, ...next };
      saveDraft(draftKey, merged);
      return merged;
    });
  }, [draftKey]);

  // 草稿其实每次输入都已自动存了，这个按钮是给个明确的确认感，
  // 否则用户不知道关掉页面会不会丢
  const handleSaveDraft = useCallback(() => {
    saveDraft(draftKey, values);
    toast.success(t('草稿已保存到本机浏览器', 'Draft saved in this browser'));
  }, [draftKey, values, t]);

  const handleSubmit = useCallback(async () => {
    if (!values.title.trim()) return toast.error(t('请填写标题', 'Title is required'));
    if (!values.content.trim()) return toast.error(t('请填写正文', 'Content is required'));
    const extraError = validateExtra?.(values);
    if (extraError) return toast.error(extraError);

    setSubmitting(true);
    try {
      const payload = buildPayload(values);
      if (resubmitId) await updateSubmission(resubmitId, payload);
      else await createSubmission(kind, payload, targetId);
      removeDraft(draftKey);
      toast.success(t('已提交，等待管理员审核', 'Submitted, pending review'));
      navigate('/profile');
    } catch (e) {
      toast.error(e instanceof Error && e.message.includes('登录')
        ? e.message
        : t('提交失败，请稍后重试', 'Submission failed, please retry'));
    } finally {
      setSubmitting(false);
    }
  }, [values, validateExtra, buildPayload, resubmitId, targetId, kind, draftKey, navigate, t]);

  if (!user) return <Navigate to="/login" replace state={{ from: `/submit/${kind}` }} />;
  if (loading) return <div className="py-24 text-center text-muted-foreground">{t('载入中…', 'Loading…')}</div>;

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 md:px-8 md:py-14">
      {/* 内容类型切换。改一条已有投稿 / 申请修改已发布内容时不给切——
          换了类型等于换了一条内容，语义上说不通 */}
      {/* 内容类型切换。改一条已有投稿 / 申请修改已发布内容时不给切——
          换了类型等于换了一条内容，语义上说不通 */}
      {!resubmitId && !targetId && <SubmitTabs active={kind} />}

      <div className="border-b border-border pb-6">
        <p className="editorial-label text-accent">{t('投稿', 'Submit')}</p>
        <h1 className="mt-2 font-display text-3xl font-medium text-foreground md:text-4xl">
          {targetId ? headingEdit : heading}
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          {t('提交后需要管理员审核通过才会公开展示。草稿自动存在本机浏览器里，关掉页面不会丢。',
             'Reviewed by an admin before going public. Drafts are saved in this browser.')}
        </p>
      </div>

      <div className="mt-8 flex flex-col gap-6">
        <label className="flex flex-col gap-2">
          <span className="text-sm font-medium">{t('标题', 'Title')} *</span>
          <Input value={values.title} maxLength={120}
            onChange={(e) => patch({ title: e.target.value })}
            placeholder={t('一句话说清这是什么', 'What is it, in one line')} />
        </label>

        <label className="flex flex-col gap-2">
          <span className="text-sm font-medium">{t('摘要', 'Summary')}</span>
          <Textarea value={values.summary} rows={3} maxLength={300}
            onChange={(e) => patch({ summary: e.target.value })}
            placeholder={t('列表页会显示这段，两三句即可', 'Shown in listings, two or three sentences')} />
        </label>

        <FileUploadField
          label={t('封面图', 'Cover image')}
          value={values.cover_url}
          onChange={(url: string) => patch({ cover_url: url })}
          folder={`${folder}/covers`}
          accept="image/jpeg,image/png,image/webp,image/gif"
        />

        {renderExtra?.(values, patch)}

        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium">{t('正文', 'Content')} *</span>
          <div className="rounded-md border border-border">
            <ImmersiveEditor
              value={values.content}
              onChange={(html) => patch({ content: html })}
              placeholder={t('展开讲讲：做了什么、怎么做的、效果如何', 'Tell the story: what, how, and the outcome')}
              uploadFolder={`${folder}/content`}
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-border pt-6">
          <Button variant="ghost" onClick={() => navigate(-1)} disabled={submitting}>
            {t('取消', 'Cancel')}
          </Button>
          <Button variant="secondary" onClick={handleSaveDraft} disabled={submitting}>
            {t('保存草稿', 'Save draft')}
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? t('提交中…', 'Submitting…') : t('发布', 'Publish')}
          </Button>
        </div>
      </div>
    </div>
  );
}
