import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useI18n } from '@/contexts/I18nContext';
import { useAuth } from '@/contexts/AuthContext';
import { fetchAssistantConfig, saveAssistantConfig, fetchKnowledgeBase, saveKnowledgeItem, deleteKnowledgeItem } from '@/lib/api';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Save, Plus, Pencil, Trash2 } from 'lucide-react';
import type { AssistantConfig, KnowledgeItem } from '@/types/types';

export default function AdminAssistant() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { profile } = useAuth();

  const [config, setConfig] = useState<AssistantConfig | null>(null);
  const [knowledge, setKnowledge] = useState<KnowledgeItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingKb, setEditingKb] = useState<Partial<KnowledgeItem> | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (profile && profile.role !== 'admin') { navigate('/', { replace: true }); return; }
    Promise.all([fetchAssistantConfig(), fetchKnowledgeBase()])
      .then(([c, k]) => { setConfig(c); setKnowledge(k); })
      .catch(() => toast.error(t('加载失败', 'Load failed')))
      .finally(() => setLoading(false));
  }, [profile, navigate, t]);

  const updateConfig = (patch: Partial<AssistantConfig>) => setConfig((prev) => prev ? { ...prev, ...patch } : prev);

  const handleSaveConfig = useCallback(async () => {
    if (!config) return;
    setSaving(true);
    try {
      await saveAssistantConfig(config);
      toast.success(t('助手配置已保存', 'Assistant config saved'));
    } catch { toast.error(t('保存失败', 'Save failed')); }
    finally { setSaving(false); }
  }, [config, t]);

  const openNewKb = () => { setEditingKb({ title: '', content: '', tags: '', sort_order: 0 }); setOpen(true); };
  const openEditKb = (item: KnowledgeItem) => { setEditingKb({ ...item }); setOpen(true); };

  const handleSaveKb = async () => {
    if (!editingKb) return;
    if (!editingKb.title?.trim()) { toast.error(t('请填写标题', 'Title is required')); return; }
    try {
      await saveKnowledgeItem(editingKb);
      toast.success(t('保存成功', 'Saved successfully'));
      setOpen(false);
      setEditingKb(null);
      fetchKnowledgeBase().then(setKnowledge);
    } catch { toast.error(t('保存失败', 'Save failed')); }
  };

  const handleDeleteKb = async (id: string) => {
    try { await deleteKnowledgeItem(id); toast.success(t('已删除', 'Deleted')); setKnowledge((p) => p.filter((x) => x.id !== id)); }
    catch { toast.error(t('删除失败', 'Delete failed')); }
  };

  if (loading) return <div className="py-16 text-center text-sm text-muted-foreground">{t('加载中…', 'Loading…')}</div>;

  return (
    <div className="space-y-12">
      {/* Persona config */}
      <section>
        <div className="flex items-center justify-between">
          <div>
            <p className="editorial-label">{t('人设管理', 'Persona')}</p>
            <h2 className="mt-1 font-display text-xl font-medium">{t('配置 AI 助手人设', 'Configure Assistant Persona')}</h2>
          </div>
          <Button onClick={handleSaveConfig} disabled={saving} className="gap-1.5 font-mono-label text-xs"><Save className="h-3.5 w-3.5" />{t('保存', 'Save')}</Button>
        </div>

        {config && (
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label={t('人设名称（中）', 'Persona Name (ZH)')}><Input value={config.persona_name} onChange={(e) => updateConfig({ persona_name: e.target.value })} className="px-3" /></Field>
            <Field label={t('人设名称（英）', 'Persona Name (EN)')}><Input value={config.persona_name_en} onChange={(e) => updateConfig({ persona_name_en: e.target.value })} className="px-3" /></Field>
            <Field label={t('欢迎语（中）', 'Greeting (ZH)')}><Textarea value={config.greeting} onChange={(e) => updateConfig({ greeting: e.target.value })} className="px-3" rows={2} /></Field>
            <Field label={t('欢迎语（英）', 'Greeting (EN)')}><Textarea value={config.greeting_en} onChange={(e) => updateConfig({ greeting_en: e.target.value })} className="px-3" rows={2} /></Field>
            <div className="sm:col-span-2">
              <Field label={t('系统提示词（中）', 'System Prompt (ZH)')}><Textarea value={config.system_prompt} onChange={(e) => updateConfig({ system_prompt: e.target.value })} className="px-3" rows={4} /></Field>
            </div>
            <div className="sm:col-span-2">
              <Field label={t('系统提示词（英）', 'System Prompt (EN)')}><Textarea value={config.system_prompt_en} onChange={(e) => updateConfig({ system_prompt_en: e.target.value })} className="px-3" rows={4} /></Field>
            </div>
          </div>
        )}
      </section>

      {/* Knowledge base */}
      <section>
        <div className="flex items-center justify-between">
          <div>
            <p className="editorial-label">{t('知识库管理', 'Knowledge Base')}</p>
            <h2 className="mt-1 font-display text-xl font-medium">{t('管理助手知识库', 'Manage Knowledge Base')}</h2>
          </div>
          <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setEditingKb(null); }}>
            <DialogTrigger asChild>
              <Button onClick={openNewKb} className="gap-1.5 font-mono-label text-xs"><Plus className="h-3.5 w-3.5" />{t('新建条目', 'New Entry')}</Button>
            </DialogTrigger>
            <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg">
              <DialogHeader><DialogTitle className="font-display">{editingKb?.id ? t('编辑条目', 'Edit Entry') : t('新建条目', 'New Entry')}</DialogTitle></DialogHeader>
              {editingKb && (
                <div className="space-y-4">
                  <Field label={t('标题', 'Title')}><Input value={editingKb.title || ''} onChange={(e) => setEditingKb({ ...editingKb, title: e.target.value })} className="px-3" /></Field>
                  <Field label={t('标签（逗号分隔）', 'Tags (comma separated)')}><Input value={editingKb.tags || ''} onChange={(e) => setEditingKb({ ...editingKb, tags: e.target.value })} className="px-3" /></Field>
                  <Field label={t('内容', 'Content')}><Textarea value={editingKb.content || ''} onChange={(e) => setEditingKb({ ...editingKb, content: e.target.value })} className="px-3" rows={6} /></Field>
                  <Button onClick={handleSaveKb} className="w-full font-mono-label text-xs uppercase tracking-wider">{t('保存', 'Save')}</Button>
                </div>
              )}
            </DialogContent>
          </Dialog>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {knowledge.length === 0 ? (
            <p className="col-span-full py-8 text-center text-sm text-muted-foreground">{t('暂无知识库条目', 'No knowledge entries')}</p>
          ) : knowledge.map((item) => (
            <div key={item.id} className="magazine-card flex h-full flex-col p-5">
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-display text-base font-medium text-foreground">{item.title}</h3>
                <div className="flex shrink-0 gap-1">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditKb(item)}><Pencil className="h-3 w-3" /></Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="h-7 w-7 text-destructive"><Trash2 className="h-3 w-3" /></Button></AlertDialogTrigger>
                    <AlertDialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg">
                      <AlertDialogHeader><AlertDialogTitle className="font-display">{t('确认删除', 'Confirm delete')}</AlertDialogTitle><AlertDialogDescription>{t('删除后无法恢复，确定要删除该条目吗？', 'This cannot be undone. Delete this entry?')}</AlertDialogDescription></AlertDialogHeader>
                      <AlertDialogFooter><AlertDialogCancel>{t('取消', 'Cancel')}</AlertDialogCancel><AlertDialogAction onClick={() => handleDeleteKb(item.id)}>{t('删除', 'Delete')}</AlertDialogAction></AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
              <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-muted-foreground text-pretty">{item.content}</p>
              {item.tags && <p className="mt-auto pt-3 font-mono-label text-[10px] text-muted-foreground">{item.tags}</p>}
            </div>
          ))}
        </div>
      </section>
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