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
import {
  createSubmission, fetchSubmission, updateSubmission,
  findPendingEditFor, fetchPublishedForEdit,
} from '@/lib/submissionsApi';
import { loadDraft, removeDraft, saveDraft } from '@/lib/useLocalDraft';
import { findSecrets, type SecretHit } from '@/lib/secretScan';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
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
 * 案例和项目投稿页共用它，各自只关心自己的专有字段，
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
  // 草稿按场景分开存：新建、改某条投稿、改某条已发布内容。
  // 共用一个 key 会互相覆盖——申请修改时冒出一份「新建」的旧草稿很莫名其妙
  const draftKey = useMemo(
    () => ({ type: `submit-${kind}`, id: resubmitId ?? (targetId ? `target-${targetId}` : 'new') }),
    [kind, resubmitId, targetId],
  );

  const [values, setValues] = useState<SubmissionFormValues>(empty);
  const [submitting, setSubmitting] = useState(false);
  /** 扫出的疑似密钥；非空时弹确认框 */
  const [secretHits, setSecretHits] = useState<SecretHit[]>([]);
  const [loading, setLoading] = useState(!!resubmitId || !!targetId);
  /** ?target= 进来时，如果已有一条待审的修改申请，就改那条而不是再开一条 */
  const [editingId, setEditingId] = useState<string | null>(resubmitId);
  /** 预填失败。空表单提交等于把已发布内容清空，所以必须拦住 */
  const [prefillFailed, setPrefillFailed] = useState(false);

  useEffect(() => {
    // 申请修改时不恢复草稿：内容应该来自线上那条
    const local = targetId ? null : loadDraft<SubmissionFormValues>(draftKey);
    if (local) setValues({ ...empty, ...local });

    const fill = (p: Record<string, string>) =>
      setValues((prev) => ({ ...prev, ...p, cover_url: p.cover_url ?? '' }));

    // 改一条已有的投稿：直接读那条记录
    if (resubmitId) {
      fetchSubmission(resubmitId)
        .then((s) => { if (s) fill((s.payload || {}) as Record<string, string>); })
        .catch(() => toast.error(t('读取投稿失败', 'Failed to load submission')))
        .finally(() => setLoading(false));
      return;
    }

    // 申请修改已发布内容
    if (targetId) {
      (async () => {
        try {
          // 线上现在长什么样，永远先读出来当底子。
          // 不能拿当初那条投稿当底子：发布后管理员可能在后台改过，
          // 用旧数据去填，用户一提交就把管理员的修改覆盖掉了。
          const live = await fetchPublishedForEdit(kind, targetId);
          if (!live) { setPrefillFailed(true); return; }

          // 已经提过一次还没审？改那一条，别再开一条——
          // 否则后台会看到两条互相覆盖的申请，先批哪条结果不一样
          const pending = await findPendingEditFor(targetId);
          if (!pending) { fill(live); return; }

          setEditingId(pending.id);
          // 用待审那条里「真的填了东西」的字段盖在线上内容之上。
          // 直接整份覆盖是不行的：早期版本的表单可能存下过空 payload，
          // 那样会把人带回一张空表，看起来就像没回显
          const draft = (pending.payload || {}) as Record<string, unknown>;
          const merged: Record<string, string> = { ...live };
          for (const [k, v] of Object.entries(draft)) {
            if (typeof v === 'string' && v.trim() !== '') merged[k] = v;
          }
          fill(merged);
          toast.info(t(
            '你之前提交的修改还在审核中，这次会直接改那一条',
            'Your earlier edit is still under review — this will update it',
          ));
        } catch {
          setPrefillFailed(true);
        } finally {
          setLoading(false);
        }
      })();
      return;
    }

    setLoading(false);
  }, [resubmitId, targetId, kind, draftKey, empty, t]);

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

  /** 真正提交。密钥确认通过后也走这里 */
  const doSubmit = useCallback(async () => {
    setSubmitting(true);
    try {
      const payload = buildPayload(values);
      // editingId 覆盖了两种情况：改自己被驳回/待审的投稿，
      // 以及对同一条已发布内容再次提交修改（覆盖上一条待审申请）
      if (editingId) await updateSubmission(editingId, payload);
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
  }, [values, buildPayload, editingId, targetId, kind, draftKey, navigate, t]);

  const handleSubmit = useCallback(() => {
    if (!values.title.trim()) return toast.error(t('请填写标题', 'Title is required'));
    if (!values.content.trim()) return toast.error(t('请填写正文', 'Content is required'));
    const extraError = validateExtra?.(values);
    if (extraError) return toast.error(extraError);

    // 投稿是公开内容，先看看有没有把自己的 API 密钥一起粘进来。
    // 只提醒不拦截：站点内容本来就在讲 AI 工具，万一误判不能让人发不出去。
    const hits = findSecrets(values.title, values.summary, values.content);
    if (hits.length > 0) {
      setSecretHits(hits);
      return;
    }
    void doSubmit();
  }, [values, validateExtra, doSubmit, t]);

  if (!user) return <Navigate to="/login" replace state={{ from: `/submit/${kind}` }} />;
  if (loading) return <div className="py-24 text-center text-muted-foreground">{t('载入中…', 'Loading…')}</div>;

  // 读不到原内容就不能往下走：空表单提交会把已发布的内容清空
  if (prefillFailed) {
    return (
      <div className="mx-auto max-w-xl px-4 py-24 text-center">
        <h1 className="font-display text-xl font-medium text-foreground">
          {t('读不到这条内容', 'Could not load this content')}
        </h1>
        <p className="mt-3 text-sm text-muted-foreground text-pretty">
          {t('可能是内容已被删除，或你的账号没有查看它正文的权限。为避免提交空白内容把线上的覆盖掉，这里先不让继续。',
             'It may have been removed, or your account cannot read its body. To avoid overwriting the live content with a blank form, editing is blocked here.')}
        </p>
        <Button variant="secondary" className="mt-6" onClick={() => navigate('/profile')}>
          {t('返回个人中心', 'Back to profile')}
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 md:px-8 md:py-14">
      {/* 内容类型切换。改一条已有投稿 / 申请修改已发布内容时不给切，
          换了类型等于换了一条内容，语义上说不通 */}
      {/* 内容类型切换。改一条已有投稿 / 申请修改已发布内容时不给切，
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

      <AlertDialog open={secretHits.length > 0} onOpenChange={(o) => { if (!o) setSecretHits([]); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('内容里好像有一把真的密钥', 'This looks like a real API key')}</AlertDialogTitle>
            <AlertDialogDescription className="text-pretty">
              {t(
                '投稿发布后所有人都能看到。下面这些看着像能直接用的 API 密钥，建议先删掉或替换成占位符：',
                'Submissions are public. These look like working API keys — consider removing them or replacing with placeholders:'
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>

          <ul className="space-y-1.5 border border-border bg-muted/50 p-3">
            {secretHits.map((h) => (
              <li key={h.masked} className="flex items-center justify-between gap-3 text-sm">
                <span className="text-muted-foreground">{h.label}</span>
                <code className="font-mono-label text-xs text-foreground">{h.masked}</code>
              </li>
            ))}
          </ul>

          <p className="text-xs text-muted-foreground">
            {t('如果这只是文章里举的例子，可以直接继续发布。', 'If these are just examples in your article, go ahead and publish.')}
          </p>

          <AlertDialogFooter>
            <AlertDialogCancel>{t('返回修改', 'Go back and edit')}</AlertDialogCancel>
            <AlertDialogAction onClick={() => { setSecretHits([]); void doSubmit(); }}>
              {t('确认是示例，继续发布', 'They are examples, publish')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
