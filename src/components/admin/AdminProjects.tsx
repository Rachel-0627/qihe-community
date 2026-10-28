import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useI18n } from '@/contexts/I18nContext';
import { useAuth } from '@/contexts/AuthContext';
import { fetchProjects, saveProject, deleteProject, deleteProjects, bulkUpdateProjects, ACCESS_LABELS, fetchProjectFilterOptions, isShowOnHomeReady, isProjectGalleryReady } from '@/lib/api';
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
import { Pencil, Trash2, Plus, Pin } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import ImmersiveEditor, { type ImmersiveEditorApi } from '@/components/editor/ImmersiveEditor';
import FileUploadField from '@/components/common/FileUploadField';
import MultiImageUploadField from '@/components/common/MultiImageUploadField';
import NumberField from '@/components/admin/NumberField';
import { fetchProjectContent, toggleProjectPinned } from '@/lib/api';
import { importMarkdown, importDocx, importPdf, type ImportResult } from '@/lib/documentImport';
import { useLocalDraft } from '@/lib/useLocalDraft';
import { totalCount } from '@/lib/utils';
import PreviewChapterPicker from '@/components/admin/PreviewChapterPicker';
import { stampChapters } from '@/lib/chapters';
import type { ProjectItem, ContentAccess, ProjectFilterOption } from '@/types/types';

const ACCESS: ContentAccess[] = ['free', 'member', 'pro', 'private'];
const UNCHANGED = '__unchanged__';

const emptyProject = (scene: string, maturity: string): Partial<ProjectItem> => ({
  id: crypto.randomUUID(),
  title: '', title_en: '', summary: '', summary_en: '', cover_url: '',
  gallery_urls: [],
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
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkEditOpen, setBulkEditOpen] = useState(false);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkSaving, setBulkSaving] = useState(false);
  const [bulkEdit, setBulkEdit] = useState({ sceneId: UNCHANGED, maturityId: UNCHANGED, access: UNCHANGED });
  // 数据库迁移未执行时，这个开关存不进去，置灰并说明原因，避免静默失效
  const [homeToggleReady, setHomeToggleReady] = useState(true);
  const [galleryStatus, setGalleryStatus] = useState<'checking' | 'ready' | 'missing'>('checking');
  const [filterOptions, setFilterOptions] = useState<ProjectFilterOption[]>([]);
  const editorRef = useRef<ImmersiveEditorApi>(null);

  const sceneOptions = filterOptions.filter((o) => o.group === 'scene' && o.is_active);
  const maturityOptions = filterOptions.filter((o) => o.group === 'maturity' && o.is_active);
  const defaultScene = sceneOptions[0]?.name ?? '视觉创意';
  const defaultMaturity = maturityOptions[0]?.name ?? '概念验证';

  const checkGalleryReady = useCallback(async () => {
    setGalleryStatus('checking');
    try {
      setGalleryStatus(await isProjectGalleryReady() ? 'ready' : 'missing');
    } catch {
      setGalleryStatus('missing');
    }
  }, []);

  useEffect(() => {
    isShowOnHomeReady().then(setHomeToggleReady).catch(() => setHomeToggleReady(false));
    void checkGalleryReady();
  }, [checkGalleryReady]);

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
  // 取不到就不打开弹窗，否则管理员会在「空正文」上点保存，把已有内容覆盖掉。
  const openEdit = async (item: ProjectItem) => {
    try {
      const res = await fetchProjectContent(item.id);
      if (!res.allowed) throw new Error('no access');
      setEditing({
        ...item,
        content: stampChapters(res.content ?? ''),
        content_en: res.content_en ?? '',
        external_url: res.external_url ?? '',
        preview_chapters: res.preview_chapters ?? [],
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

  const handleSave = useCallback(async () => {
    if (!editing || savingRef.current) return;
    if (!editing.title?.trim()) { toast.error(t('请填写标题', 'Title is required')); return; }
    savingRef.current = true;
    setSaving(true);
    const toInt = (n: unknown) => Math.max(0, Math.floor(Number(n) || 0));
    const payload = {
      ...editing,
      base_likes: toInt(editing.base_likes),
      base_favorites: toInt(editing.base_favorites),
      base_views: toInt(editing.base_views),
    };
    const isNewProject = !items.some((item) => item.id === payload.id);
    try {
      await saveProject(payload, { idempotentCreate: isNewProject });
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
    finally {
      savingRef.current = false;
      setSaving(false);
    }
  }, [editing, items, t, clearProjectDraft]);

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
    try {
      await deleteProject(id);
      toast.success(t('已删除', 'Deleted'));
      setItems((p) => p.filter((x) => x.id !== id));
      setSelectedIds((prev) => { const next = new Set(prev); next.delete(id); return next; });
    }
    catch { toast.error(t('删除失败', 'Delete failed')); }
  };

  const handleBulkDelete = async () => {
    const ids = [...selectedIds];
    if (!ids.length || bulkSaving) return;
    setBulkSaving(true);
    try {
      await deleteProjects(ids);
      setItems((prev) => prev.filter((item) => !selectedIds.has(item.id)));
      setSelectedIds(new Set());
      setBulkDeleteOpen(false);
      toast.success(t(`已删除 ${ids.length} 个项目`, `Deleted ${ids.length} projects`));
    } catch {
      toast.error(t('批量删除失败', 'Bulk delete failed'));
    } finally {
      setBulkSaving(false);
    }
  };

  const handleBulkEdit = async () => {
    if (!selectedIds.size || bulkSaving) return;
    const patch: Partial<ProjectItem> = {};
    const scene = filterOptions.find((option) => option.id === bulkEdit.sceneId);
    const maturity = filterOptions.find((option) => option.id === bulkEdit.maturityId);
    if (scene) { patch.scene = scene.name; patch.scene_en = scene.name_en; }
    if (maturity) { patch.maturity = maturity.name; patch.maturity_en = maturity.name_en; }
    if (bulkEdit.access !== UNCHANGED) patch.access_level = bulkEdit.access as ContentAccess;
    if (!Object.keys(patch).length) {
      toast.error(t('请至少选择一个要修改的字段', 'Choose at least one field to update'));
      return;
    }

    const ids = [...selectedIds];
    setBulkSaving(true);
    try {
      await bulkUpdateProjects(ids, patch);
      setItems((prev) => prev.map((item) => selectedIds.has(item.id) ? { ...item, ...patch } : item));
      setSelectedIds(new Set());
      setBulkEditOpen(false);
      setBulkEdit({ sceneId: UNCHANGED, maturityId: UNCHANGED, access: UNCHANGED });
      toast.success(t(`已更新 ${ids.length} 个项目`, `Updated ${ids.length} projects`));
    } catch {
      toast.error(t('批量编辑失败', 'Bulk edit failed'));
    } finally {
      setBulkSaving(false);
    }
  };

  const allSelected = items.length > 0 && items.every((item) => selectedIds.has(item.id));

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <p className="editorial-label">{t('项目管理', 'Projects')}</p>
          <h2 className="mt-1 font-display text-xl font-medium">{t('管理 AI 项目', 'Manage AI Projects')}</h2>
        </div>
        <Dialog open={open} onOpenChange={(v) => { if (saving) return; setOpen(v); if (!v) setEditing(null); }}>
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
                      <Input value={editing.title || ''} onChange={(e) => setEditing({ ...editing, title: e.target.value })} className="px-3" />
                    </div>
                  </Field>
                  <Field label={t('摘要', 'Summary')}>
                    <div className="relative">
                      <Textarea value={editing.summary || ''} onChange={(e) => setEditing({ ...editing, summary: e.target.value })} className="px-3" rows={2} />
                    </div>
                  </Field>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <MultiImageUploadField
                      label={t('卡片图片集', 'Card image gallery')}
                      value={editing.gallery_urls?.length ? editing.gallery_urls : (editing.cover_url ? [editing.cover_url] : [])}
                      onChange={(urls) => setEditing({ ...editing, gallery_urls: urls, cover_url: urls[0] || '' })}
                      folder="projects/covers"
                      id={editing.id}
                      disabled={galleryStatus !== 'ready'}
                    />
                    <FileUploadField label={t('视频', 'Video')} value={editing.video_url || ''} onChange={(url) => setEditing({ ...editing, video_url: url })} folder="projects/videos" accept="video/mp4" preview="video" id={editing.id} />
                  </div>
                  {galleryStatus !== 'ready' && (
                    <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground" role="status" aria-live="polite">
                      <span>
                        {galleryStatus === 'checking'
                          ? t('正在检查多图轮播数据库状态…', 'Checking the project gallery database…')
                          : t('多图轮播数据库字段尚未启用，请先应用迁移。', 'The project gallery database field is not enabled yet. Apply the migration first.')}
                      </span>
                      {galleryStatus === 'missing' && (
                        <Button type="button" variant="outline" size="sm" onClick={() => void checkGalleryReady()}>
                          {t('重新检查', 'Retry')}
                        </Button>
                      )}
                    </div>
                  )}
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
                {/* 紧挨着「访问级别」：选了付费级别马上就能看到试看设置，
                    放到正文编辑器下面的话要滚很久，容易以为没这个功能 */}
                {(editing.access_level || 'free') !== 'free' && (
                  <PreviewChapterPicker
                    content={typeof editing.content === 'string' ? editing.content : ''}
                    value={editing.preview_chapters ?? []}
                    onChange={(next) => setEditing({ ...editing, preview_chapters: next })}
                    onStamp={(html) => setEditing({ ...editing, content: html })}
                  />
                )}
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
                <Button onClick={handleSave} disabled={saving} className="w-full font-mono-label text-xs uppercase tracking-wider">{saving ? t('保存中…', 'Saving…') : t('保存', 'Save')}</Button>
              </div>
            )}
          </AnimatedDialogContent>
        </Dialog>

        <Dialog open={bulkEditOpen} onOpenChange={(value) => { if (!bulkSaving) setBulkEditOpen(value); }}>
          <AnimatedDialogContent open={bulkEditOpen} className="max-h-[90dvh] max-w-[calc(100%-2rem)] overflow-y-auto md:max-w-xl">
            <DialogHeader><DialogTitle className="font-display">{t(`批量编辑 ${selectedIds.size} 个项目`, `Edit ${selectedIds.size} projects`)}</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <Field label={t('应用场景（不修改请保持默认）', 'Scene (leave unchanged to skip)')}>
                <Select value={bulkEdit.sceneId} onValueChange={(sceneId) => setBulkEdit((prev) => ({ ...prev, sceneId }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={UNCHANGED}>{t('保持不变', 'Leave unchanged')}</SelectItem>
                    {sceneOptions.map((option) => <SelectItem key={option.id} value={option.id}>{lang === 'en' && option.name_en ? option.name_en : option.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
              <Field label={t('成熟度（不修改请保持默认）', 'Maturity (leave unchanged to skip)')}>
                <Select value={bulkEdit.maturityId} onValueChange={(maturityId) => setBulkEdit((prev) => ({ ...prev, maturityId }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={UNCHANGED}>{t('保持不变', 'Leave unchanged')}</SelectItem>
                    {maturityOptions.map((option) => <SelectItem key={option.id} value={option.id}>{lang === 'en' && option.name_en ? option.name_en : option.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
              <Field label={t('访问级别（不修改请保持默认）', 'Access level (leave unchanged to skip)')}>
                <Select value={bulkEdit.access} onValueChange={(access) => setBulkEdit((prev) => ({ ...prev, access }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={UNCHANGED}>{t('保持不变', 'Leave unchanged')}</SelectItem>
                    {ACCESS.map((access) => <SelectItem key={access} value={access}>{lang === 'en' ? ACCESS_LABELS[access].en : ACCESS_LABELS[access].zh}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
              <div className="flex justify-end gap-2">
                <Button variant="outline" disabled={bulkSaving} onClick={() => setBulkEditOpen(false)}>{t('取消', 'Cancel')}</Button>
                <Button disabled={bulkSaving} onClick={handleBulkEdit}>{bulkSaving ? t('保存中…', 'Saving…') : t('应用修改', 'Apply changes')}</Button>
              </div>
            </div>
          </AnimatedDialogContent>
        </Dialog>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3 border border-border bg-card px-4 py-3">
        <span className="mr-auto text-sm text-muted-foreground">
          {t(`已选 ${selectedIds.size} 个项目（当前最多显示 ${items.length} 个）`, `${selectedIds.size} selected (up to ${items.length} listed)`)}
        </span>
        <Button variant="outline" disabled={selectedIds.size === 0 || bulkSaving} onClick={() => setBulkEditOpen(true)}>
          <Pencil className="mr-1.5 h-3.5 w-3.5" />{t('批量编辑', 'Bulk edit')}
        </Button>
        <Button variant="destructive" disabled={selectedIds.size === 0 || bulkSaving} onClick={() => setBulkDeleteOpen(true)}>
          <Trash2 className="mr-1.5 h-3.5 w-3.5" />{t('批量删除', 'Bulk delete')}
        </Button>
      </div>

      <div className="mt-6 w-full max-w-full overflow-x-auto border border-border bg-card">
        <table className="w-full min-w-[760px] border-collapse">
          <thead>
            <tr className="border-b border-border bg-muted/40">
              <th className="px-4 py-3 text-left">
                <Checkbox
                  aria-label={t('全选当前列表项目', 'Select all listed projects')}
                  checked={allSelected}
                  onCheckedChange={(checked) => setSelectedIds(checked ? new Set(items.map((item) => item.id)) : new Set())}
                  disabled={items.length === 0 || loading}
                />
              </th>
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
              <tr><td colSpan={9} className="px-4 py-8 text-center text-sm text-muted-foreground">{t('加载中…', 'Loading…')}</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={9} className="px-4 py-8 text-center text-sm text-muted-foreground">{t('暂无项目', 'No projects')}</td></tr>
            ) : items.map((item) => (
              <tr key={item.id} className="border-b border-border last:border-0 hover:bg-muted/10 transition-colors">
                <td className="px-4 py-3">
                  <Checkbox
                    aria-label={t(`选择项目 ${item.title}`, `Select project ${item.title}`)}
                    checked={selectedIds.has(item.id)}
                    onCheckedChange={(checked) => setSelectedIds((prev) => {
                      const next = new Set(prev);
                      if (checked) next.add(item.id);
                      else next.delete(item.id);
                      return next;
                    })}
                  />
                </td>
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

      <AlertDialog open={bulkDeleteOpen} onOpenChange={(value) => { if (!bulkSaving) setBulkDeleteOpen(value); }}>
        <AlertDialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display">{t(`确认删除 ${selectedIds.size} 个项目`, `Delete ${selectedIds.size} projects?`)}</AlertDialogTitle>
            <AlertDialogDescription>{t('删除后无法恢复，请确认选中的项目无误。', 'This cannot be undone. Check the selected projects before continuing.')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={bulkSaving}>{t('取消', 'Cancel')}</AlertDialogCancel>
            <AlertDialogAction disabled={bulkSaving} onClick={(event) => { event.preventDefault(); void handleBulkDelete(); }}>
              {bulkSaving ? t('删除中…', 'Deleting…') : t('确认删除', 'Delete selected')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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
