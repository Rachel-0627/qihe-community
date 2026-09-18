import { useState, useEffect, useCallback } from 'react';
import { useI18n } from '@/contexts/I18nContext';
import { useAuth } from '@/contexts/AuthContext';
import { fetchCategories, saveCategory, deleteCategory } from '@/lib/api';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Pencil, Trash2, Plus } from 'lucide-react';
import type { Category } from '@/types/types';

const emptyCategory = (): Partial<Category> => ({ name: '', name_en: '', slug: '', sort_order: 0, type: 'case' });

export default function AdminCaseFilters() {
  const { t, lang } = useI18n();
  const { profile } = useAuth();

  const [items, setItems] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Partial<Category> | null>(null);

  const load = useCallback(() => {
    fetchCategories('case')
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
    const payload = { ...editing, slug: editing.slug?.trim() || editing.name?.trim() };
    try {
      await saveCategory(payload);
      toast.success(t('保存成功', 'Saved successfully'));
      setEditing(null);
      load();
    } catch { toast.error(t('保存失败', 'Save failed')); }
  }, [editing, load, t]);

  const handleDelete = async (id: string) => {
    try { await deleteCategory(id); toast.success(t('已删除', 'Deleted')); load(); }
    catch { toast.error(t('删除失败', 'Delete failed')); }
  };

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <p className="editorial-label">{t('案例分类配置', 'Case Category Config')}</p>
          <h2 className="mt-1 font-display text-xl font-medium">{t('自定义案例分类', 'Customize case categories')}</h2>
        </div>
        <Button onClick={() => setEditing(emptyCategory())} className="gap-1.5 font-mono-label text-xs"><Plus className="h-3.5 w-3.5" />{t('新增分类', 'Add category')}</Button>
      </div>

      {editing && (
        <div className="mt-6 space-y-4 border border-border bg-card p-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label={t('名称（中）', 'Name (ZH)')}><Input value={editing.name || ''} onChange={(e) => setEditing({ ...editing, name: e.target.value })} className="px-3" /></Field>
            <Field label={t('名称（英）', 'Name (EN)')}><Input value={editing.name_en || ''} onChange={(e) => setEditing({ ...editing, name_en: e.target.value })} className="px-3" /></Field>
            <Field label={t('标识', 'Slug')}><Input value={editing.slug || ''} onChange={(e) => setEditing({ ...editing, slug: e.target.value })} className="px-3" placeholder={editing.name || ''} /></Field>
            <Field label={t('排序', 'Sort Order')}><Input type="number" value={editing.sort_order || 0} onChange={(e) => setEditing({ ...editing, sort_order: Number(e.target.value) })} className="px-3" /></Field>
          </div>
          <div className="flex gap-2">
            <Button onClick={handleSave} className="font-mono-label text-xs uppercase tracking-wider">{t('保存', 'Save')}</Button>
            <Button variant="outline" onClick={() => setEditing(null)} className="font-mono-label text-xs uppercase tracking-wider">{t('取消', 'Cancel')}</Button>
          </div>
        </div>
      )}

      <div className="mt-6 w-full max-w-full overflow-x-auto border border-border bg-card">
        <table className="w-full min-w-[600px] border-collapse">
          <thead>
            <tr className="border-b border-border bg-muted/40">
              <th className="whitespace-nowrap px-4 py-3 text-left font-mono-label text-xs uppercase tracking-wider text-muted-foreground">{t('名称', 'Name')}</th>
              <th className="whitespace-nowrap px-4 py-3 text-left font-mono-label text-xs uppercase tracking-wider text-muted-foreground">{t('英文', 'English')}</th>
              <th className="whitespace-nowrap px-4 py-3 text-left font-mono-label text-xs uppercase tracking-wider text-muted-foreground">{t('标识', 'Slug')}</th>
              <th className="whitespace-nowrap px-4 py-3 text-left font-mono-label text-xs uppercase tracking-wider text-muted-foreground">{t('排序', 'Sort')}</th>
              <th className="whitespace-nowrap px-4 py-3 text-right font-mono-label text-xs uppercase tracking-wider text-muted-foreground">{t('操作', 'Actions')}</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-sm text-muted-foreground">{t('加载中…', 'Loading…')}</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-sm text-muted-foreground">{t('暂无分类', 'No categories')}</td></tr>
            ) : items.map((item) => (
              <tr key={item.id} className="border-b border-border last:border-0">
                <td className="whitespace-nowrap px-4 py-3 text-sm text-foreground">{item.name}</td>
                <td className="whitespace-nowrap px-4 py-3 text-sm text-muted-foreground">{item.name_en}</td>
                <td className="whitespace-nowrap px-4 py-3 text-sm text-muted-foreground">{item.slug}</td>
                <td className="whitespace-nowrap px-4 py-3 text-sm text-muted-foreground">{item.sort_order}</td>
                <td className="whitespace-nowrap px-4 py-3 text-right">
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditing({ ...item })}><Pencil className="h-3.5 w-3.5" /></Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete(item.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
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
