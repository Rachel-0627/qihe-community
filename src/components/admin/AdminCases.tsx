import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useI18n } from '@/contexts/I18nContext';
import { useAuth } from '@/contexts/AuthContext';
import { fetchCases, fetchCategories, saveCase, deleteCase, isShowOnHomeReady } from '@/lib/api';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Pencil, Trash2, Plus, Loader2 } from 'lucide-react';
import RichTextEditor from '@/components/common/RichTextEditor';
import FileUploadField from '@/components/common/FileUploadField';
import NumberField from '@/components/admin/NumberField';
import { translateZhToEn } from '@/lib/api';
import { totalCount } from '@/lib/utils';
import type { CaseItem, Category } from '@/types/types';

const emptyCase = (): Partial<CaseItem> => ({
  title: '', title_en: '', summary: '', summary_en: '', cover_url: '',
  category_id: null, author: '', author_en: '', is_featured: false, sort_order: 0, show_on_home: true,
  content: '', content_en: '',
  likes: 0, favorites: 0, views: 0,
  base_likes: 0, base_favorites: 0, base_views: 0,
});

export default function AdminCases() {
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const { profile } = useAuth();

  const [cases, setCases] = useState<CaseItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Partial<CaseItem> | null>(null);
  const [open, setOpen] = useState(false);
  // 数据库迁移未执行时，这个开关存不进去，置灰并说明原因，避免静默失效
  const [homeToggleReady, setHomeToggleReady] = useState(true);
  const [translating, setTranslating] = useState<{ title: boolean; summary: boolean }>({ title: false, summary: false });

  useEffect(() => {
    isShowOnHomeReady().then(setHomeToggleReady).catch(() => setHomeToggleReady(false));
  }, []);

  useEffect(() => {
    if (profile && profile.role !== 'admin') { navigate('/', { replace: true }); return; }
    Promise.all([fetchCases(), fetchCategories('case')])
      .then(([c, cat]) => { setCases(c); setCategories(cat); })
      .catch(() => toast.error(t('加载失败', 'Load failed')))
      .finally(() => setLoading(false));
  }, [profile, navigate, t]);

  const openNew = () => { setEditing(emptyCase()); setOpen(true); };
  const openEdit = (item: CaseItem) => { setEditing({ ...item }); setOpen(true); };

  const autoTranslate = async (key: 'title' | 'summary') => {
    if (!editing) return;
    const zh = editing[key];
    if (!zh?.trim()) return;
    const enKey = key === 'title' ? 'title_en' : 'summary_en';
    if (editing[enKey]?.trim()) return; // 已有英文内容时不自动覆盖
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
      category_id: editing.category_id?.trim() || null,
      base_likes: toInt(editing.base_likes),
      base_favorites: toInt(editing.base_favorites),
      base_views: toInt(editing.base_views),
    };
    try {
      await saveCase(payload);
      toast.success(t('保存成功', 'Saved successfully'));
      setOpen(false);
      setEditing(null);
      // 乐观更新：先立即刷新本地数据，避免数据库主从延迟导致列表未变
      if (payload.id) {
        setCases((prev) =>
          prev.map((c) =>
            c.id === payload.id
              ? { ...c, base_likes: payload.base_likes, base_favorites: payload.base_favorites, base_views: payload.base_views }
              : c
          )
        );
      }
      const data = await fetchCases();
      setCases(data);
    } catch { toast.error(t('保存失败', 'Save failed')); }
  }, [editing, t]);

  const handleDelete = async (id: string) => {
    try {
      await deleteCase(id);
      toast.success(t('已删除', 'Deleted'));
      setCases((prev) => prev.filter((c) => c.id !== id));
    } catch { toast.error(t('删除失败', 'Delete failed')); }
  };

  const updateContent = (key: 'content' | 'content_en', html: string) => {
    setEditing((prev) => prev ? { ...prev, [key]: html } : prev);
  };

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <p className="editorial-label">{t('案例管理', 'Cases')}</p>
          <h2 className="mt-1 font-display text-xl font-medium">{t('管理展示案例', 'Manage Showcase Cases')}</h2>
        </div>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setEditing(null); }}>
          <DialogTrigger asChild>
            <Button onClick={openNew} className="gap-1.5 font-mono-label text-xs"><Plus className="h-3.5 w-3.5" />{t('新建案例', 'New Case')}</Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90dvh] max-w-[calc(100%-2rem)] overflow-y-auto md:max-w-2xl">
            <DialogHeader>
              <DialogTitle className="font-display">{editing?.id ? t('编辑案例', 'Edit Case') : t('新建案例', 'New Case')}</DialogTitle>
            </DialogHeader>
            {editing && (
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="font-mono-label text-xs uppercase tracking-wider text-muted-foreground">
                    {t('标题', 'Title')}
                    {translating.title && <Loader2 className="ml-2 inline h-3 w-3 animate-spin" />}
                  </Label>
                  <Input value={editing.title || ''} onChange={(e) => setEditing({ ...editing, title: e.target.value })} onBlur={() => autoTranslate('title')} className="px-3" />
                </div>
                <div className="space-y-1.5">
                  <Label className="font-mono-label text-xs uppercase tracking-wider text-muted-foreground">
                    {t('摘要', 'Summary')}
                    {translating.summary && <Loader2 className="ml-2 inline h-3 w-3 animate-spin" />}
                  </Label>
                  <Textarea value={editing.summary || ''} onChange={(e) => setEditing({ ...editing, summary: e.target.value })} onBlur={() => autoTranslate('summary')} className="px-3" rows={2} />
                </div>
                <div className="space-y-1.5">
                  <Label className="font-mono-label text-xs uppercase tracking-wider text-muted-foreground">{t('作者', 'Author')}</Label>
                  <Input value={editing.author || ''} onChange={(e) => setEditing({ ...editing, author: e.target.value })} className="px-3" />
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <FileUploadField label={t('封面图', 'Cover Image')} value={editing.cover_url || ''} onChange={(url) => setEditing({ ...editing, cover_url: url })} folder="cases/covers" accept="image/jpeg,image/png,image/webp,image/gif" id={editing.id} />
                  <div className="space-y-1.5">
                    <Label className="font-mono-label text-xs uppercase tracking-wider text-muted-foreground">{t('分类', 'Category')}</Label>
                    <Select value={editing.category_id || 'none'} onValueChange={(v) => setEditing({ ...editing, category_id: v === 'none' ? null : v })}>
                      <SelectTrigger><SelectValue placeholder={t('选择分类', 'Select category')} /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">{t('无', 'None')}</SelectItem>
                        {categories.map((c) => <SelectItem key={c.id} value={c.id}>{lang === 'en' ? c.name_en : c.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <RichTextEditor label={t('正文内容', 'Content')} value={typeof editing.content === 'string' ? editing.content : ''} onChange={(html) => updateContent('content', html)} uploadFolder="cases" />
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
                    id="case-on-home"
                    disabled={!homeToggleReady}
                    checked={editing.show_on_home !== false}
                    onCheckedChange={(v) => setEditing({ ...editing, show_on_home: v })}
                  />
                  <Label htmlFor="case-on-home" className="font-mono-label text-xs uppercase tracking-wider text-muted-foreground">
                    {t('在首页「精选案例」板块展示', 'Show in homepage "Featured Cases" section')}
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
          </DialogContent>
        </Dialog>
      </div>

      <div className="mt-6 w-full max-w-full overflow-x-auto border border-border bg-card">
        <table className="w-full min-w-[720px] border-collapse">
          <thead>
            <tr className="border-b border-border bg-muted/40">
              <th className="whitespace-nowrap px-4 py-3 text-left font-mono-label text-xs uppercase tracking-wider text-muted-foreground">{t('标题', 'Title')}</th>
              <th className="whitespace-nowrap px-4 py-3 text-left font-mono-label text-xs uppercase tracking-wider text-muted-foreground">{t('作者', 'Author')}</th>
              <th className="whitespace-nowrap px-4 py-3 text-right font-mono-label text-xs uppercase tracking-wider text-muted-foreground">{t('点赞', 'Likes')}</th>
              <th className="whitespace-nowrap px-4 py-3 text-right font-mono-label text-xs uppercase tracking-wider text-muted-foreground">{t('收藏', 'Saved')}</th>
              <th className="whitespace-nowrap px-4 py-3 text-right font-mono-label text-xs uppercase tracking-wider text-muted-foreground">{t('浏览', 'Views')}</th>
              <th className="whitespace-nowrap px-4 py-3 text-right font-mono-label text-xs uppercase tracking-wider text-muted-foreground">{t('操作', 'Actions')}</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-muted-foreground">{t('加载中…', 'Loading…')}</td></tr>
            ) : cases.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-muted-foreground">{t('暂无案例', 'No cases')}</td></tr>
            ) : cases.map((item) => (
              <tr key={item.id} className="border-b border-border last:border-0">
                <td className="whitespace-nowrap px-4 py-3 text-sm text-foreground">{lang === 'en' && item.title_en ? item.title_en : item.title}</td>
                <td className="whitespace-nowrap px-4 py-3 text-sm text-muted-foreground">{item.author}</td>
                <td className="whitespace-nowrap px-4 py-3 text-right font-mono-label text-xs text-muted-foreground">{totalCount(item.likes, item.base_likes)}</td>
                <td className="whitespace-nowrap px-4 py-3 text-right font-mono-label text-xs text-muted-foreground">{totalCount(item.favorites, item.base_favorites)}</td>
                <td className="whitespace-nowrap px-4 py-3 text-right font-mono-label text-xs text-muted-foreground">{totalCount(item.views, item.base_views)}</td>
                <td className="whitespace-nowrap px-4 py-3 text-right">
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(item)}><Pencil className="h-3.5 w-3.5" /></Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive"><Trash2 className="h-3.5 w-3.5" /></Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg">
                        <AlertDialogHeader>
                          <AlertDialogTitle className="font-display">{t('确认删除', 'Confirm delete')}</AlertDialogTitle>
                          <AlertDialogDescription>{t('删除后无法恢复，确定要删除该案例吗？', 'This cannot be undone. Delete this case?')}</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>{t('取消', 'Cancel')}</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDelete(item.id)}>{t('删除', 'Delete')}</AlertDialogAction>
                        </AlertDialogFooter>
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

