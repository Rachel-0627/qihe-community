import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useI18n } from '@/contexts/I18nContext';
import { useAuth } from '@/contexts/AuthContext';
import { fetchProjects, saveProject, deleteProject, ACCESS_LABELS, fetchProjectFilterOptions, isShowOnHomeReady } from '@/lib/api';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AnimatedDialogContent } from '@/components/common/AnimatedDialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Pencil, Trash2, Plus, Loader2, Pin } from 'lucide-react';
import ImmersiveEditor, { type ImmersiveEditorApi } from '@/components/editor/ImmersiveEditor';
import FileUploadField from '@/components/common/FileUploadField';
import NumberField from '@/components/admin/NumberField';
import { translateZhToEn, fetchProjectContent, toggleProjectPinned } from '@/lib/api';
import { importMarkdown, importDocx, importPdf, type ImportResult } from '@/lib/documentImport';
import { useLocalDraft } from '@/lib/useLocalDraft';
import { totalCount } from '@/lib/utils';
import type { ProjectItem, ContentAccess, ProjectFilterOption } from '@/types/types';

const ACCESS: ContentAccess[] = ['free', 'member', 'pro', 'private'];

const emptyProject = (scene: string, maturity: string): Partial<ProjectItem> => ({
  title: '', title_en: '', summary: '', summary_en: '', cover_url: '',
  scene, maturity, access_level: 'free',
  video_url: '', external_url: '', is_hot: false, is_pinned: false, sort_order: 0, content: '', content_en: '', show_on_home: true,
  likes: 0, favorites: 0, views: 0,
  base_likes: 0, base_favorites: 0, base_views: 0,
});

export default function AdminProjects() {
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const { profile } = useAuth();

  const [items, setItems] = useState<ProjectItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Partial<ProjectItem> | null>(null);
  const [open, setOpen] = useState(false);
  // 数据库迁移未执行时，这个开关存不进去，置灰并说明原因，避免静默失效
  const [homeToggleReady, setHomeToggleReady] = useState(true);
  const [filterOptions, setFilterOptions] = useState<ProjectFilterOption[]>([]);
  const [translating, setTranslating] = useState<{ title: boolean; summary: boolean }>({ title: false, summary: false });
  const editorRef = useRef<ImmersiveEditorApi>(null);

  const sceneOptions = filterOptions.filter((o) => o.group === 'scene' && o.is_active);
  const maturityOptions = filterOptions.filter((o) => o.group === 'maturity' && o.is_active);
  const defaultScene = sceneOptions[0]?.name ?? '视觉创意';
  const defaultMaturity = maturityOptions[0]?.name ?? '概念验证';

  useEffect(() => {
    isShowOnHomeReady().then(setHomeToggleReady).catch(() => setHomeToggleReady(false));
  }, []);

  useEffect(() => {
    if (profile && profile.role !== 'admin') { navigate('/', { replace: true }); return; }
    setLoading(true);
    Promise.all([fetchProjects(), fetchProjectFilterOptions()])
      .then(([projects, options]) => { setItems(projects); setFilterOptions(options); })
      .catch(() => toast.error(t('加载失败', 'Load failed')))
      .finally(() => setLoading(false));
  }, [profile, navigate, t]);

  const openNew = () => { setEditing(emptyProject(defaultScene, defaultMaturity)); setOpen(true); };
  // 正文/外链受列级权限保护，列表数据里没有，必须单独取回后再打开编辑器。
  // 取不到就不打开弹窗 —— 否则管理员会在「空正文」上点保存，把已有内容覆盖掉。
  const openEdit = async (item: ProjectItem) => {
    try {
      const res = await fetchProjectContent(item.id);
      if (!res.allowed) throw new Error('no access');
      setEditing({
        ...item,
        content: res.content ?? '',
        content_en: res.content_en ?? '',
        external_url: res.external_url ?? '',
      });
      setOpen(true);
    } catch {
      toast.error(t('正文加载失败，请稍后重试', 'Failed to load content, please retry'));
    }
  };

  const { clearDraft: clearProjectDraft } = useLocalDraft<Partial<ProjectItem>>(
    { type: 'project', id: editing?.id || 'new' },
    editing || {},
    (draft) => setEditing((prev) => (prev ? { ...prev, ...draft } : prev)),
    open
  );

  const autoTranslate = async (key: 'title' | 'summary') => {
    if (!editing) return;
    const zh = editing[key];
    if (!zh?.trim()) return;
    const enKey = key === 'title' ? 'title_en' : 'summary_en';
    if (editing[enKey]?.trim()) return;
    setTranslating((p) => ({ ...p, [key]: true }));
    try {
      const en = await translateZhToEn(zh);
      if (en) setEditing((prev) => prev ? { ...prev, [enKey]: en } : prev);
    } catch {
      toast.error(t('翻译失败', 'Translation failed'));
    } finally {
      setTranslating((p) => ({ ...p, [key]: false }));
    }
  };

  const handleSave = useCallback(async () => {
    if (!editing) return;
    if (!editing.title?.trim()) { toast.error(t('请填写标题', 'Title is required')); return; }
    const toInt = (n: unknown) => Math.max(0, Math.floor(Number(n) || 0));
    const payload = {
      ...editing,
      base_likes: toInt(editing.base_likes),
      base_favorites: toInt(editing.base_favorites),
      base_views: toInt(editing.base_views),
    };
    try {
      await saveProject(payload);
      clearProjectDraft();
      toast.success(t('保存成功', 'Saved successfully'));
      setOpen(false);
      setEditing(null);
      if (payload.id) {
        setItems((prev) =>
          prev.map((c) =>
            c.id === payload.id
              ? { ...c, base_likes: payload.base_likes, base_favorites: payload.base_favorites, base_views: payload.base_views }
              : c
          )
        );
      }
      fetchProjects().then(setItems);
    } catch { toast.error(t('保存失败', 'Save failed')); }
  }, [editing, t, clearProjectDraft]);

  const handleTogglePinned = async (item: ProjectItem) => {
    const nextPinned = !item.is_pinned;
    try {
      await toggleProjectPinned(item.id, nextPinned);
      setItems((prev) => prev.map((p) => p.id === item.id ? { ...p, is_pinned: nextPinned } : p));
      toast.success(nextPinned ? t('已置顶', 'Pinned to top') : t('已取消置顶', 'Unpinned'));
    } catch {
      toast.error(t('操作失败', 'Operation failed'));
    }
  };

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
        const folder = `projects/${editing?.id || 'new'}`;
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
        setEditing((prev) => prev ? { ...prev, content: result.content } : prev);
        if (result.missingImages.length > 0) {
          toast.warning(`缺少图片文件：${result.missingImages.join(', ')}`);
        }
        if (result.failedUploads.length > 0) {
          toast.warning(`部分图片上传失败：${result.failedUploads.join(', ')}`);
        }
        if (result.uploadedImages > 0) {
          toast.success(`已导入并上传 ${result.uploadedImages} 张图片`);
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : '导入失败');
      }
    };
    input.click();
  }, [editing?.id]);

  const handleDelete = async (id: string) => {
    try { await deleteProject(id); toast.success(t('已删除', 'Deleted')); setItems((p) => p.filter((x) => x.id !== id)); }
    catch { toast.error(t('删除失败', 'Delete failed')); }
  };

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <p className="editorial-label">{t('项目管理', 'Projects')}</p>
          <h2 className="mt-1 font-display text-xl font-medium">{t('管理 AI 项目', 'Manage AI Projects')}</h2>
        </div>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setEditing(null); }}>
          <DialogTrigger asChild>
            <Button onClick={openNew} className="gap-1.5 font-mono-label text-xs"><Plus className="h-3.5 w-3.5" />{t('新建项目', 'New Project')}</Button>
          </DialogTrigger>
          <AnimatedDialogContent open={open} className="max-h-[90dvh] max-w-[calc(100%-2rem)] overflow-y-auto md:max-w-2xl">
            <DialogHeader><DialogTitle className="font-display">{editing?.id ? t('编辑项目', 'Edit Project') : t('新建项目', 'New Project')}</DialogTitle></DialogHeader>
            {editing && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-4">
                  <Field label={t('标题', 'Title')}>
                    <div className="relative">
                      <Input value={editing.title || ''} onChange={(e) => setEditing({ ...editing, title: e.target.value })} onBlur={() => autoTranslate('title')} className="px-3" />
                      {translating.title && <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />}
                    </div>
                  </Field>
                  <Field label={t('摘要', 'Summary')}>
                    <div className="relative">
                      <Textarea value={editing.summary || ''} onChange={(e) => setEditing({ ...editing, summary: e.target.value })} onBlur={() => autoTranslate('summary')} className="px-3" rows={2} />
                      {translating.summary && <Loader2 className="absolute right-3 top-3 h-4 w-4 animate-spin text-muted-foreground" />}
                    </div>
                  </Field>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <FileUploadField label={t('封面图', 'Cover Image')} value={editing.cover_url || ''} onChange={(url) => setEditing({ ...editing, cover_url: url })} folder="projects/covers" accept="image/jpeg,image/png,image/webp,image/gif" id={editing.id} />
                    <FileUploadField label={t('视频', 'Video')} value={editing.video_url || ''} onChange={(url) => setEditing({ ...editing, video_url: url })} folder="projects/videos" accept="video/mp4" preview="video" id={editing.id} />
                  </div>
                  <Field label={t('外部链接', 'External URL')}><Input value={editing.external_url || ''} onChange={(e) => setEditing({ ...editing, external_url: e.target.value })} className="px-3" /></Field>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <Field label={t('应用场景', 'Scene')}>
                      <Select value={editing.scene || defaultScene} onValueChange={(v) => setEditing({ ...editing, scene: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {sceneOptions.map((s) => <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>)}
                          {sceneOptions.length === 0 && <SelectItem value={editing.scene || ''}>{editing.scene}</SelectItem>}
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field label={t('成熟度', 'Maturity')}>
                      <Select value={editing.maturity || defaultMaturity} onValueChange={(v) => setEditing({ ...editing, maturity: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {maturityOptions.map((m) => <SelectItem key={m.id} value={m.name}>{m.name}</SelectItem>)}
                          {maturityOptions.length === 0 && <SelectItem value={editing.maturity || ''}>{editing.maturity}</SelectItem>}
                        </SelectContent>
                      </Select>
                    </Field>
                    <Field label={t('访问级别', 'Access Level')}>
                      <Select value={editing.access_level || 'free'} onValueChange={(v) => setEditing({ ...editing, access_level: v as ContentAccess })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{ACCESS.map((a) => <SelectItem key={a} value={a}>{lang === 'en' ? ACCESS_LABELS[a].en : ACCESS_LABELS[a].zh}</SelectItem>)}</SelectContent>
                      </Select>
                    </Field>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="font-mono-label text-xs uppercase tracking-wider text-muted-foreground">{t('正文内容', 'Content')}</Label>
                  <ImmersiveEditor
                    ref={editorRef}
                    value={typeof editing.content === 'string' ? editing.content : ''}
                    onChange={(html) => setEditing({ ...editing, content: html })}
                    uploadFolder="projects"
                    uploadId={editing.id}
                    onImportFile={handleImportFile}
                  />
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <NumberField
                    label={t('基础点赞', 'Base likes')}
                    value={editing.base_likes}
                    onChange={(v) => setEditing({ ...editing, base_likes: v })}
                    actual={editing.likes}
                  />
                  <NumberField
                    label={t('基础收藏', 'Base favorites')}
                    value={editing.base_favorites}
                    onChange={(v) => setEditing({ ...editing, base_favorites: v })}
                    actual={editing.favorites}
                  />
                  <NumberField
                    label={t('基础浏览', 'Base views')}
                    value={editing.base_views}
                    onChange={(v) => setEditing({ ...editing, base_views: v })}
                    actual={editing.views}
                  />
                </div>
                <div className="flex items-center gap-3 border border-border bg-muted/30 px-4 py-3">
                  <Switch
                    id="project-pinned"
                    checked={!!editing.is_pinned}
                    onCheckedChange={(v) => setEditing({ ...editing, is_pinned: v })}
                  />
                  <Label htmlFor="project-pinned" className="flex items-center gap-1.5 font-mono-label text-xs uppercase tracking-wider text-muted-foreground">
                    <Pin className="h-3.5 w-3.5 text-accent" />
                    {t('置顶展示（优先排在列表最前列）', 'Pin to top (prioritize at the top of list)')}
                  </Label>
                </div>
                <div className="flex items-center gap-3 border border-border bg-muted/30 px-4 py-3">
                  <Switch
                    id="project-on-home"
                    disabled={!homeToggleReady}
                    checked={editing.show_on_home !== false}
                    onCheckedChange={(v) => setEditing({ ...editing, show_on_home: v })}
                  />
                  <Label htmlFor="project-on-home" className="font-mono-label text-xs uppercase tracking-wider text-muted-foreground">
                    {t('在首页「热门项目」板块展示', 'Show in homepage "Trending Projects" section')}
                    {!homeToggleReady && (
                      <span className="ml-2 normal-case tracking-normal text-destructive">
                        {t('（暂不可用 · 需先更新数据库）', '(unavailable · database update required)')}
                      </span>
                    )}
                  </Label>
                </div>
                <Button onClick={handleSave} className="w-full font-mono-label text-xs uppercase tracking-wider">{t('保存', 'Save')}</Button>
              </div>
            )}
          </AnimatedDialogContent>
        </Dialog>
      </div>

      <div className="mt-6 w-full max-w-full overflow-x-auto border border-border bg-card">
        <table className="w-full min-w-[720px] border-collapse">
          <thead>
            <tr className="border-b border-border bg-muted/40">
              <th className="whitespace-nowrap px-4 py-3 text-left font-mono-label text-xs uppercase tracking-wider text-muted-foreground">{t('置顶', 'Pinned')}</th>
              <th className="whitespace-nowrap px-4 py-3 text-left font-mono-label text-xs uppercase tracking-wider text-muted-foreground">{t('标题', 'Title')}</th>
              <th className="whitespace-nowrap px-4 py-3 text-left font-mono-label text-xs uppercase tracking-wider text-muted-foreground">{t('场景', 'Scene')}</th>
              <th className="whitespace-nowrap px-4 py-3 text-left font-mono-label text-xs uppercase tracking-wider text-muted-foreground">{t('访问', 'Access')}</th>
              <th className="whitespace-nowrap px-4 py-3 text-right font-mono-label text-xs uppercase tracking-wider text-muted-foreground">{t('点赞', 'Likes')}</th>
              <th className="whitespace-nowrap px-4 py-3 text-right font-mono-label text-xs uppercase tracking-wider text-muted-foreground">{t('收藏', 'Saved')}</th>
              <th className="whitespace-nowrap px-4 py-3 text-right font-mono-label text-xs uppercase tracking-wider text-muted-foreground">{t('浏览', 'Views')}</th>
              <th className="whitespace-nowrap px-4 py-3 text-right font-mono-label text-xs uppercase tracking-wider text-muted-foreground">{t('操作', 'Actions')}</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-sm text-muted-foreground">{t('加载中…', 'Loading…')}</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={8} className="px-4 py-8 text-center text-sm text-muted-foreground">{t('暂无项目', 'No projects')}</td></tr>
            ) : items.map((item) => (
              <tr key={item.id} className="border-b border-border last:border-0 hover:bg-muted/10 transition-colors">
                <td className="whitespace-nowrap px-4 py-3 text-sm">
                  <button
                    type="button"
                    onClick={() => handleTogglePinned(item)}
                    className={`inline-flex items-center gap-1 rounded px-2 py-1 font-mono-label text-[11px] transition-colors ${
                      item.is_pinned
                        ? 'bg-accent/20 text-accent font-medium border border-accent/40'
                        : 'text-muted-foreground hover:text-foreground border border-transparent'
                    }`}
                    title={item.is_pinned ? t('点击取消置顶', 'Click to unpin') : t('点击置顶', 'Click to pin')}
                  >
                    <Pin className={`h-3 w-3 ${item.is_pinned ? 'text-accent fill-accent' : ''}`} />
                    {item.is_pinned ? t('已置顶', 'Pinned') : t('常规', 'Normal')}
                  </button>
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-sm text-foreground">{lang === 'en' && item.title_en ? item.title_en : item.title}</td>
                <td className="whitespace-nowrap px-4 py-3 text-sm text-muted-foreground">{item.scene}</td>
                <td className="whitespace-nowrap px-4 py-3 text-sm text-muted-foreground">{lang === 'en' ? ACCESS_LABELS[item.access_level].en : ACCESS_LABELS[item.access_level].zh}</td>
                <td className="whitespace-nowrap px-4 py-3 text-right font-mono-label text-xs text-muted-foreground">{totalCount(item.likes, item.base_likes)}</td>
                <td className="whitespace-nowrap px-4 py-3 text-right font-mono-label text-xs text-muted-foreground">{totalCount(item.favorites, item.base_favorites)}</td>
                <td className="whitespace-nowrap px-4 py-3 text-right font-mono-label text-xs text-muted-foreground">{totalCount(item.views, item.base_views)}</td>
                <td className="whitespace-nowrap px-4 py-3 text-right">
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(item)}><Pencil className="h-3.5 w-3.5" /></Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 text-destructive"><Trash2 className="h-3.5 w-3.5" /></Button></AlertDialogTrigger>
                      <AlertDialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg">
                        <AlertDialogHeader><AlertDialogTitle className="font-display">{t('确认删除', 'Confirm delete')}</AlertDialogTitle><AlertDialogDescription>{t('删除后无法恢复，确定要删除该项目吗？', 'This cannot be undone. Delete this project?')}</AlertDialogDescription></AlertDialogHeader>
                        <AlertDialogFooter><AlertDialogCancel>{t('取消', 'Cancel')}</AlertDialogCancel><AlertDialogAction onClick={() => handleDelete(item.id)}>{t('删除', 'Delete')}</AlertDialogAction></AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="font-mono-label text-xs uppercase tracking-wider text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
