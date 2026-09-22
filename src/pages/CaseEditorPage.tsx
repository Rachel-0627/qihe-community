import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useI18n } from '@/contexts/I18nContext';
import { toast } from 'sonner';
import { fetchCaseById, fetchCategories, saveCaseAndReturn } from '@/lib/api';
import { importMarkdown, importDocx, importPdf, type ImportResult } from '@/lib/documentImport';
import type { Category, CaseItem } from '@/types/types';
import ImmersiveEditor, { type ImmersiveEditorApi } from '@/components/editor/ImmersiveEditor';
import EditorToolbar, { type SaveStatus } from '@/components/editor/EditorToolbar';
import PublishPanel from '@/components/editor/PublishPanel';
import EditorPreview from '@/components/editor/EditorPreview';

interface Bilingual {
  title: string;
  summary: string;
  content: string;
}

const emptyBilingual = (): Bilingual => ({ title: '', summary: '', content: '' });

export default function CaseEditorPage() {
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id;
  const navigate = useNavigate();
  const { profile, loading: authLoading } = useAuth();
  const { t } = useI18n();

  const [lang, setLang] = useState<'zh' | 'en'>('zh');
  const [zh, setZh] = useState<Bilingual>(emptyBilingual());
  const [en, setEn] = useState<Bilingual>(emptyBilingual());
  const [coverUrl, setCoverUrl] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [showOnHome, setShowOnHome] = useState(false);
  const [author, setAuthor] = useState('');
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(isEdit);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [preview, setPreview] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);
  const [caseId, setCaseId] = useState<string | undefined>(id);

  const editorRef = useRef<ImmersiveEditorApi>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dirtyRef = useRef(false);
  const initializedRef = useRef(false);

  // 权限校验
  useEffect(() => {
    if (!authLoading && profile && profile.role !== 'admin') {
      navigate('/admin', { replace: true });
    }
  }, [authLoading, profile, navigate]);

  // 加载分类
  useEffect(() => {
    fetchCategories('case')
      .then(setCategories)
      .catch(() => {});
  }, []);

  // 加载已有案例
  useEffect(() => {
    if (!isEdit || !id) return;
    setLoading(true);
    fetchCaseById(id)
      .then((item) => {
        if (!item) {
          toast.error(t('案例不存在', 'Case not found'));
          navigate('/admin', { replace: true });
          return;
        }
        setZh({ title: item.title || '', summary: item.summary || '', content: item.content || '' });
        setEn({ title: item.title_en || '', summary: item.summary_en || '', content: item.content_en || '' });
        setCoverUrl(item.cover_url || '');
        setCategoryId(item.category_id);
        setShowOnHome(item.show_on_home);
        setAuthor(item.author || '');
      })
      .catch(() => toast.error(t('加载案例失败', 'Failed to load case')))
      .finally(() => {
        setLoading(false);
        initializedRef.current = true;
      });
  }, [id, isEdit, navigate, t]);

  const current = lang === 'zh' ? zh : en;
  const setCurrent = useCallback(
    (patch: Partial<Bilingual>) => {
      if (lang === 'zh') setZh((p) => ({ ...p, ...patch }));
      else setEn((p) => ({ ...p, ...patch }));
    },
    [lang]
  );

  // 自动保存：构建完整 payload（含两套语言），debounce 1.5s
  const doSave = useCallback(async () => {
    if (!dirtyRef.current) return;
    setSaveStatus('saving');
    try {
      const payload: Partial<CaseItem> = {
        title: zh.title,
        title_en: en.title,
        summary: zh.summary,
        summary_en: en.summary,
        content: zh.content,
        content_en: en.content,
        cover_url: coverUrl,
        category_id: categoryId,
        show_on_home: showOnHome,
        author,
        author_en: author,
        sort_order: 0,
        is_featured: false,
      };
      if (caseId) payload.id = caseId;
      const newId = await saveCaseAndReturn(payload);
      if (newId && !caseId) setCaseId(newId);
      dirtyRef.current = false;
      setSaveStatus('saved');
    } catch {
      setSaveStatus('error');
    }
  }, [zh, en, coverUrl, categoryId, showOnHome, author, caseId]);

  // 标记脏数据并触发防抖保存
  const scheduleSave = useCallback(() => {
    dirtyRef.current = true;
    setSaveStatus('saving');
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      doSave();
    }, 1500);
  }, [doSave]);

  // 离开页面前保存
  useEffect(() => {
    const handler = () => {
      if (dirtyRef.current) {
        // beforeunload 无法等待异步，尽力触发
        doSave();
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [doSave]);

  // 切换语言：先保存当前，避免丢失
  const handleToggleLang = useCallback(() => {
    if (dirtyRef.current) {
      doSave();
    }
    setLang((l) => (l === 'zh' ? 'en' : 'zh'));
  }, [doSave]);

  // 发布
  const handlePublish = useCallback(async () => {
    if (!zh.title.trim()) {
      toast.error('请先填写中文标题');
      return;
    }
    setSaveStatus('saving');
    try {
      const payload: Partial<CaseItem> = {
        id: caseId,
        title: zh.title,
        title_en: en.title,
        summary: zh.summary,
        summary_en: en.summary,
        content: zh.content,
        content_en: en.content,
        cover_url: coverUrl,
        category_id: categoryId,
        show_on_home: showOnHome,
        author,
        author_en: author,
        sort_order: 0,
        is_featured: false,
      };
      await saveCaseAndReturn(payload);
      dirtyRef.current = false;
      setSaveStatus('saved');
      setPublishOpen(false);
      toast.success(isEdit ? '案例已更新' : '案例已发布');
      navigate('/admin');
    } catch {
      setSaveStatus('error');
      toast.error('发布失败，请重试');
    }
  }, [zh, en, coverUrl, categoryId, showOnHome, author, caseId, isEdit, navigate]);

  // 导入文件
  const handleImportFile = useCallback(async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.md,.markdown,.docx,.pdf,text/markdown,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/pdf';
    input.multiple = true;
    input.onchange = async (e) => {
      const files = Array.from((e.target as HTMLInputElement).files || []);
      if (files.length === 0) return;
      const doc = files.find((f) => !f.type.startsWith('image/'));
      const sidecars = files.filter((f) => f.type.startsWith('image/'));
      if (!doc) {
        toast.error('请选择一个 Markdown、Word 或 PDF 文件');
        return;
      }
      try {
        const ext = doc.name.split('.').pop()?.toLowerCase() || '';
        const folder = `cases/${caseId || 'new'}`;
        let result: ImportResult;
        if (ext === 'md' || ext === 'markdown' || doc.type === 'text/markdown') {
          result = await importMarkdown(doc, folder, sidecars);
        } else if (ext === 'docx') {
          result = await importDocx(doc, folder);
        } else if (ext === 'pdf') {
          result = await importPdf(doc, folder);
        } else {
          toast.error('仅支持 Markdown、Word、PDF 文件');
          return;
        }
        editorRef.current?.setHTML(result.content);
        setCurrent({ content: result.content });
        if (result.missingImages.length > 0) {
          toast.warning(`缺少图片文件：${result.missingImages.join(', ')}`);
        }
        if (result.failedUploads.length > 0) {
          toast.warning(`部分图片上传失败：${result.failedUploads.join(', ')}`);
        }
        if (result.uploadedImages > 0) {
          toast.success(`已导入并上传 ${result.uploadedImages} 张图片`);
        }
        scheduleSave();
      } catch (err) {
        toast.error(err instanceof Error ? err.message : '导入失败');
      }
    };
    input.click();
  }, [caseId, setCurrent, scheduleSave]);

  // 撤销/重做通过编辑器历史
  const handleUndo = useCallback(() => {
    editorRef.current?.undo();
  }, []);
  const handleRedo = useCallback(() => {
    editorRef.current?.redo();
  }, []);

  if (authLoading || (isEdit && loading)) {
    return <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">{t('加载中…', 'Loading…')}</div>;
  }

  if (preview) {
    return (
      <div className="min-h-screen bg-background">
        <EditorToolbar
          onBack={() => setPreview(false)}
          lang={lang}
          onToggleLang={handleToggleLang}
          saveStatus={saveStatus}
          canUndo={false}
          canRedo={false}
          onUndo={handleUndo}
          onRedo={handleRedo}
          onPreview={() => setPreview(false)}
          onPublish={() => setPublishOpen(true)}
          onImportFile={handleImportFile}
          isPublished={isEdit}
        />
        <EditorPreview title={current.title} summary={current.summary} content={current.content} coverUrl={coverUrl} author={author} />
        <PublishPanel
          open={publishOpen}
          onOpenChange={setPublishOpen}
          lang={lang}
          title={current.title}
          summary={current.summary}
          coverUrl={coverUrl}
          categoryId={categoryId}
          showOnHome={showOnHome}
          author={author}
          categories={categories}
          onChange={(patch) => {
            if (patch.title !== undefined) setCurrent({ title: patch.title });
            if (patch.summary !== undefined) setCurrent({ summary: patch.summary });
            if (patch.coverUrl !== undefined) setCoverUrl(patch.coverUrl);
            if (patch.categoryId !== undefined) setCategoryId(patch.categoryId);
            if (patch.showOnHome !== undefined) setShowOnHome(patch.showOnHome);
            if (patch.author !== undefined) setAuthor(patch.author);
          }}
          onConfirm={handlePublish}
          isPublished={isEdit}
          caseId={caseId}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <EditorToolbar
        onBack={() => navigate('/admin')}
        lang={lang}
        onToggleLang={handleToggleLang}
        saveStatus={saveStatus}
        canUndo={false}
        canRedo={false}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onPreview={() => setPreview(true)}
        onPublish={() => setPublishOpen(true)}
        onImportFile={handleImportFile}
        isPublished={isEdit}
      />

      <div className="mx-auto w-full max-w-[760px] px-4 py-10 md:px-8 md:py-16">
        {/* 标题 */}
        <input
          value={current.title}
          onChange={(e) => {
            setCurrent({ title: e.target.value });
            scheduleSave();
          }}
          placeholder="文章标题"
          className="w-full bg-transparent font-display text-3xl font-medium leading-tight tracking-tight text-foreground placeholder:text-muted-foreground/40 focus:outline-none md:text-4xl"
        />

        {/* 摘要 */}
        <textarea
          value={current.summary}
          onChange={(e) => {
            setCurrent({ summary: e.target.value });
            scheduleSave();
          }}
          placeholder="写一句摘要…"
          rows={2}
          className="mt-4 w-full resize-none bg-transparent text-lg leading-relaxed text-muted-foreground placeholder:text-muted-foreground/40 focus:outline-none"
        />

        <div className="my-8 h-px w-full bg-border/40" />

        {/* 正文 */}
        <ImmersiveEditor
          ref={editorRef}
          value={current.content}
          onChange={(html) => {
            setCurrent({ content: html });
            scheduleSave();
          }}
          uploadFolder="cases"
          uploadId={caseId}
          placeholder={lang === 'en' ? 'Type / for commands, or start writing…' : '输入 / 插入内容块，或直接开始写作…'}
          onImportFile={handleImportFile}
        />
      </div>

      <PublishPanel
        open={publishOpen}
        onOpenChange={setPublishOpen}
        lang={lang}
        title={current.title}
        summary={current.summary}
        coverUrl={coverUrl}
        categoryId={categoryId}
        showOnHome={showOnHome}
        author={author}
        categories={categories}
        onChange={(patch) => {
          if (patch.title !== undefined) setCurrent({ title: patch.title });
          if (patch.summary !== undefined) setCurrent({ summary: patch.summary });
          if (patch.coverUrl !== undefined) setCoverUrl(patch.coverUrl);
          if (patch.categoryId !== undefined) setCategoryId(patch.categoryId);
          if (patch.showOnHome !== undefined) setShowOnHome(patch.showOnHome);
          if (patch.author !== undefined) setAuthor(patch.author);
        }}
        onConfirm={handlePublish}
        isPublished={isEdit}
        caseId={caseId}
      />
    </div>
  );
}