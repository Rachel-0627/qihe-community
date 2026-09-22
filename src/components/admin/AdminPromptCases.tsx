import { useState, useEffect, useCallback } from 'react';
import { useI18n } from '@/contexts/I18nContext';
import { useAuth } from '@/contexts/AuthContext';
import { fetchAllPromptCases, fetchPromptCaseFilters, savePromptCase, deletePromptCase } from '@/lib/api';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AnimatedDialogContent } from '@/components/common/AnimatedDialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Pencil, Trash2, Plus } from 'lucide-react';
import FileUploadField from '@/components/common/FileUploadField';
import NumberField from '@/components/admin/NumberField';
import type { PromptCase, PromptCaseFilter, PromptCaseAspectRatio } from '@/types/types';

const ASPECT_RATIOS: PromptCaseAspectRatio[] = ['3:4', '4:3', '9:16', '16:9', '2.35:1'];

const emptyCase = (): Partial<PromptCase> => ({
  title: '', title_en: '', description: '', description_en: '', prompt: '', prompt_en: '', cover_url: '', aspect_ratio: '4:3',
  category_id: null, style_id: null, scene_id: null, sort_order: 0, is_active: true,
});

export default function AdminPromptCases() {
  const { t, lang } = useI18n();
  const { profile } = useAuth();

  const [items, setItems] = useState<PromptCase[]>([]);
  const [filters, setFilters] = useState<PromptCaseFilter[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Partial<PromptCase> | null>(null);
  const [open, setOpen] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([fetchAllPromptCases(), fetchPromptCaseFilters()])
      .then(([caseRows, filterRows]) => { setItems(caseRows); setFilters(filterRows); })
      .catch(() => toast.error(t('加载失败', 'Load failed')))
      .finally(() => setLoading(false));
  }, [t]);

  useEffect(() => {
    if (profile && profile.role !== 'admin') return;
    load();
  }, [profile, load]);

  const categoryOptions = filters.filter((f) => f.group === 'category' && f.name !== '全部');
  const styleOptions = filters.filter((f) => f.group === 'style' && f.name !== '全部');
  const sceneOptions = filters.filter((f) => f.group === 'scene' && f.name !== '全部');

  const openNew = () => { setEditing(emptyCase()); setOpen(true); };
  const openEdit = (item: PromptCase) => { setEditing({ ...item }); setOpen(true); };

  const handleSave = useCallback(async () => {
    if (!editing) return;
    if (!editing.title?.trim()) { toast.error(t('请填写标题', 'Title is required')); return; }
    if (!editing.prompt?.trim()) { toast.error(t('请填写提示词', 'Prompt is required')); return; }
    const payload = { ...editing, sort_order: Number(editing.sort_order) || 0 };
    try {
      await savePromptCase(payload);
      toast.success(t('保存成功', 'Saved successfully'));
      setOpen(false);
      setEditing(null);
      load();
    } catch { toast.error(t('保存失败', 'Save failed')); }
  }, [editing, load, t]);

  const handleDelete = async (id: string) => {
    try { await deletePromptCase(id); toast.success(t('已删除', 'Deleted')); load(); }
    catch { toast.error(t('删除失败', 'Delete failed')); }
  };

  const update = (patch: Partial<PromptCase>) => setEditing((prev) => prev ? { ...prev, ...patch } : prev);

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <p className="editorial-label">{t('提示词案例管理', 'Prompt Case Management')}</p>
          <h2 className="mt-1 font-display text-xl font-medium">{t('生图提示词案例库', 'Image Prompt Case Library')}</h2>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={openNew} className="gap-1.5 font-mono-label text-xs"><Plus className="h-3.5 w-3.5" />{t('新增案例', 'Add case')}</Button>
          </DialogTrigger>
          <AnimatedDialogContent open={open} className="max-h-[90dvh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="font-display">
                {editing?.id ? t('编辑案例', 'Edit Case') : t('新增案例', 'Add Case')}
              </DialogTitle>
            </DialogHeader>
            {editing && (
              <div className="mt-4 space-y-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field label={t('标题（中）', 'Title (ZH)')}><Input value={editing.title || ''} onChange={(e) => update({ title: e.target.value })} className="px-3" /></Field>
                  <Field label={t('标题（英）', 'Title (EN)')}><Input value={editing.title_en || ''} onChange={(e) => update({ title_en: e.target.value })} className="px-3" /></Field>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field label={t('描述（中）', 'Description (ZH)')}>
                    <Textarea value={editing.description || ''} onChange={(e) => update({ description: e.target.value })} rows={3} className="px-3" />
                  </Field>
                  <Field label={t('描述（英）', 'Description (EN)')}>
                    <Textarea value={editing.description_en || ''} onChange={(e) => update({ description_en: e.target.value })} rows={3} className="px-3" />
                  </Field>
                </div>

                <Field label={t('封面图', 'Cover Image')}>
                  <FileUploadField
                    label=""
                    value={editing.cover_url || ''}
                    onChange={(url) => update({ cover_url: url })}
                    folder="prompt-cases"
                    preview="image"
                  />
                </Field>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <Field label={t('分类', 'Category')}>
                    <Select value={editing.category_id || 'none'} onValueChange={(v) => update({ category_id: v === 'none' ? null : v })}>
                      <SelectTrigger className="px-3"><SelectValue placeholder={t('请选择', 'Select')} /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">{t('无', 'None')}</SelectItem>
                        {categoryOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label={t('风格', 'Style')}>
                    <Select value={editing.style_id || 'none'} onValueChange={(v) => update({ style_id: v === 'none' ? null : v })}>
                      <SelectTrigger className="px-3"><SelectValue placeholder={t('请选择', 'Select')} /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">{t('无', 'None')}</SelectItem>
                        {styleOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label={t('场景', 'Scene')}>
                    <Select value={editing.scene_id || 'none'} onValueChange={(v) => update({ scene_id: v === 'none' ? null : v })}>
                      <SelectTrigger className="px-3"><SelectValue placeholder={t('请选择', 'Select')} /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">{t('无', 'None')}</SelectItem>
                        {sceneOptions.map((o) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </Field>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field label={t('比例', 'Aspect Ratio')}>
                    <Select value={editing.aspect_ratio} onValueChange={(v) => update({ aspect_ratio: v as PromptCaseAspectRatio })}>
                      <SelectTrigger className="px-3"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {ASPECT_RATIOS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </Field>
                  <NumberField label={t('排序', 'Sort Order')} value={editing.sort_order || 0} onChange={(v) => update({ sort_order: v })} />
                </div>

                <Field label={t('提示词（中）', 'Prompt (ZH)')}>
                  <Textarea value={editing.prompt || ''} onChange={(e) => update({ prompt: e.target.value })} rows={5} className="px-3" />
                </Field>
                <Field label={t('提示词（英）', 'Prompt (EN)')}>
                  <Textarea value={editing.prompt_en || ''} onChange={(e) => update({ prompt_en: e.target.value })} rows={5} className="px-3" />
                </Field>

                <div className="flex items-center gap-3">
                  <Switch id="pc-active" checked={editing.is_active !== false} onCheckedChange={(checked) => update({ is_active: checked })} />
                  <Label htmlFor="pc-active" className="font-mono-label text-xs uppercase tracking-wider text-muted-foreground">{t('前台显示', 'Visible')}</Label>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="outline" onClick={() => setOpen(false)} className="font-mono-label text-xs uppercase tracking-wider">{t('取消', 'Cancel')}</Button>
                  <Button onClick={handleSave} className="font-mono-label text-xs uppercase tracking-wider">{t('保存', 'Save')}</Button>
                </div>
              </div>
            )}
          </AnimatedDialogContent>
        </Dialog>
      </div>

      <div className="mt-6 w-full max-w-full overflow-x-auto border border-border bg-card">
        <table className="w-full min-w-[700px] border-collapse">
          <thead>
            <tr className="border-b border-border bg-muted/40">
              <th className="whitespace-nowrap px-4 py-3 text-left font-mono-label text-xs uppercase tracking-wider text-muted-foreground">{t('封面', 'Cover')}</th>
              <th className="whitespace-nowrap px-4 py-3 text-left font-mono-label text-xs uppercase tracking-wider text-muted-foreground">{t('标题', 'Title')}</th>
              <th className="whitespace-nowrap px-4 py-3 text-left font-mono-label text-xs uppercase tracking-wider text-muted-foreground">{t('分类', 'Category')}</th>
              <th className="whitespace-nowrap px-4 py-3 text-left font-mono-label text-xs uppercase tracking-wider text-muted-foreground">{t('比例', 'Ratio')}</th>
              <th className="whitespace-nowrap px-4 py-3 text-left font-mono-label text-xs uppercase tracking-wider text-muted-foreground">{t('状态', 'Status')}</th>
              <th className="whitespace-nowrap px-4 py-3 text-right font-mono-label text-xs uppercase tracking-wider text-muted-foreground">{t('操作', 'Actions')}</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-sm text-muted-foreground">{t('加载中…', 'Loading…')}</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-sm text-muted-foreground">{t('暂无案例', 'No cases')}</td></tr>
            ) : items.map((item) => (
              <tr key={item.id} className="border-b border-border last:border-0">
                <td className="whitespace-nowrap px-4 py-3">
                  {item.cover_url ? <img src={item.cover_url} alt="" className="h-12 w-16 rounded border border-border object-cover" /> : <span className="text-sm text-muted-foreground">-</span>}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-sm text-foreground">{item.title || t('未命名', 'Untitled')}</td>
                <td className="whitespace-nowrap px-4 py-3 text-sm text-muted-foreground">
                  {[item.category?.name, item.style?.name, item.scene?.name].filter(Boolean).join(' / ') || '-'}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-sm text-muted-foreground">{item.aspect_ratio}</td>
                <td className="whitespace-nowrap px-4 py-3 text-sm">
                  <span className={`inline-flex rounded px-2 py-0.5 text-xs ${item.is_active ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'}`}>
                    {item.is_active ? t('显示', 'Visible') : t('隐藏', 'Hidden')}
                  </span>
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right">
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(item)}><Pencil className="h-3.5 w-3.5" /></Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive"><Trash2 className="h-3.5 w-3.5" /></Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg">
                        <AlertDialogHeader>
                          <AlertDialogTitle>{t('确认删除？', 'Confirm delete?')}</AlertDialogTitle>
                          <AlertDialogDescription>{t('此操作不可撤销。', 'This action cannot be undone.')}</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>{t('取消', 'Cancel')}</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDelete(item.id)} className="bg-destructive text-destructive-foreground">
                            {t('删除', 'Delete')}
                          </AlertDialogAction>
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="font-mono-label text-xs uppercase tracking-wider text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
