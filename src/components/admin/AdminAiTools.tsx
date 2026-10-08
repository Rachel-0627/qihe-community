import { useState, useEffect, useCallback } from 'react';
import { useI18n } from '@/contexts/I18nContext';
import { useAuth } from '@/contexts/AuthContext';
import { fetchAllAiTools, saveAiTool, deleteAiTool } from '@/lib/aiToolsApi';
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
import { AI_TOOL_CATEGORIES, type AiTool, type AiToolCategory } from '@/types/types';

const emptyTool = (): Partial<AiTool> => ({
  name: '', summary: '', url: '', cover_url: '', provider: '', category: '其他', sort_order: 0, is_visible: true,
});

export default function AdminAiTools() {
  const { t } = useI18n();
  const { profile } = useAuth();

  const [items, setItems] = useState<AiTool[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Partial<AiTool> | null>(null);
  const [open, setOpen] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    fetchAllAiTools()
      .then(setItems)
      .catch(() => toast.error(t('加载失败', 'Load failed')))
      .finally(() => setLoading(false));
  }, [t]);

  useEffect(() => {
    if (profile && profile.role !== 'admin') return;
    load();
  }, [profile, load]);

  const handleSave = useCallback(async () => {
    if (!editing) return;
    if (!editing.name?.trim()) { toast.error(t('请填写名称', 'Name is required')); return; }
    const url = (editing.url || '').trim();
    // 卡片是直接跳外站的，只接受 http(s)，避免把 javascript: 之类塞进 href
    if (!/^https?:\/\/.+/i.test(url)) { toast.error(t('请填写以 http:// 或 https:// 开头的网址', 'URL must start with http:// or https://')); return; }
    try {
      await saveAiTool({ ...editing, url, sort_order: Number(editing.sort_order) || 0 });
      toast.success(t('保存成功', 'Saved successfully'));
      setOpen(false);
      setEditing(null);
      load();
    } catch { toast.error(t('保存失败', 'Save failed')); }
  }, [editing, load, t]);

  const handleDelete = async (id: string) => {
    try { await deleteAiTool(id); toast.success(t('已删除', 'Deleted')); load(); }
    catch { toast.error(t('删除失败', 'Delete failed')); }
  };

  const update = (patch: Partial<AiTool>) => setEditing((prev) => prev ? { ...prev, ...patch } : prev);

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <p className="editorial-label">{t('工具收录管理', 'Tool Directory Management')}</p>
          <h2 className="mt-1 font-display text-xl font-medium">{t('实用 AI 工具', 'Useful AI Tools')}</h2>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => { setEditing(emptyTool()); setOpen(true); }} className="gap-1.5 font-mono-label text-xs">
              <Plus className="h-3.5 w-3.5" />{t('新增工具', 'Add tool')}
            </Button>
          </DialogTrigger>
          <AnimatedDialogContent open={open} className="max-h-[90dvh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="font-display">
                {editing?.id ? t('编辑工具', 'Edit Tool') : t('新增工具', 'Add Tool')}
              </DialogTitle>
            </DialogHeader>
            {editing && (
              <div className="mt-4 space-y-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field label={t('工具名称', 'Name')}>
                    <Input value={editing.name || ''} onChange={(e) => update({ name: e.target.value })} className="px-3" />
                  </Field>
                  <Field label={t('提供方', 'Provider')}>
                    <Input value={editing.provider || ''} onChange={(e) => update({ provider: e.target.value })} placeholder={t('如 魔搭社区', 'e.g. ModelScope')} className="px-3" />
                  </Field>
                </div>

                <Field label={t('一句话介绍', 'Summary')}>
                  <Textarea value={editing.summary || ''} onChange={(e) => update({ summary: e.target.value })} rows={3} className="px-3" />
                </Field>

                <Field label={t('工具网址', 'Tool URL')}>
                  <Input value={editing.url || ''} onChange={(e) => update({ url: e.target.value })} placeholder="https://" className="px-3" />
                </Field>

                <Field label={t('封面图', 'Cover Image')}>
                  <FileUploadField label="" value={editing.cover_url || ''} onChange={(url) => update({ cover_url: url })} folder="ai-tools" preview="image" />
                </Field>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field label={t('分类', 'Category')}>
                    <Select value={editing.category || '其他'} onValueChange={(v) => update({ category: v as AiToolCategory })}>
                      <SelectTrigger className="px-3"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {AI_TOOL_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </Field>
                  <NumberField label={t('排序', 'Sort Order')} value={editing.sort_order || 0} onChange={(v) => update({ sort_order: v })} />
                </div>

                <div className="flex items-center gap-3">
                  <Switch id="at-visible" checked={editing.is_visible !== false} onCheckedChange={(checked) => update({ is_visible: checked })} />
                  <Label htmlFor="at-visible" className="font-mono-label text-xs uppercase tracking-wider text-muted-foreground">{t('前台显示', 'Visible')}</Label>
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
              {[t('封面', 'Cover'), t('名称', 'Name'), t('分类', 'Category'), t('提供方', 'Provider'), t('状态', 'Status')].map((h) => (
                <th key={h} className="whitespace-nowrap px-4 py-3 text-left font-mono-label text-xs uppercase tracking-wider text-muted-foreground">{h}</th>
              ))}
              <th className="whitespace-nowrap px-4 py-3 text-right font-mono-label text-xs uppercase tracking-wider text-muted-foreground">{t('操作', 'Actions')}</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-sm text-muted-foreground">{t('加载中…', 'Loading…')}</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-sm text-muted-foreground">{t('暂无工具', 'No tools')}</td></tr>
            ) : items.map((item) => (
              <tr key={item.id} className="border-b border-border last:border-0">
                <td className="whitespace-nowrap px-4 py-3">
                  {item.cover_url ? <img src={item.cover_url} alt="" className="h-12 w-16 border border-border object-cover" /> : <span className="text-sm text-muted-foreground">-</span>}
                </td>
                <td className="px-4 py-3 text-sm text-foreground">{item.name}</td>
                <td className="whitespace-nowrap px-4 py-3 text-sm text-muted-foreground">{item.category}</td>
                <td className="whitespace-nowrap px-4 py-3 text-sm text-muted-foreground">{item.provider || '-'}</td>
                <td className="whitespace-nowrap px-4 py-3 text-sm">
                  <span className={`inline-flex px-2 py-0.5 text-xs ${item.is_visible ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'}`}>
                    {item.is_visible ? t('显示', 'Visible') : t('隐藏', 'Hidden')}
                  </span>
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right">
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditing({ ...item }); setOpen(true); }}><Pencil className="h-3.5 w-3.5" /></Button>
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
                          <AlertDialogAction onClick={() => handleDelete(item.id)} className="bg-destructive text-destructive-foreground">{t('删除', 'Delete')}</AlertDialogAction>
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
