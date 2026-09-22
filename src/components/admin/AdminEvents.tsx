import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useI18n } from '@/contexts/I18nContext';
import { useAuth } from '@/contexts/AuthContext';
import { fetchEvents, saveEvent, deleteEvent, fetchEventFilterOptions, isShowOnHomeReady, getEventRegistrationExport } from '@/lib/api';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Pencil, Trash2, Plus, Download, Users } from 'lucide-react';
import * as XLSX from 'xlsx';
import NumberField from '@/components/admin/NumberField';
import FileUploadField from '@/components/common/FileUploadField';
import { totalCount } from '@/lib/utils';
import type { EventItem, EventFilterOption, EventRegistrationExportRow } from '@/types/types';

const emptyEvent = (city: string, theme: string): Partial<EventItem> => ({
  title: '', title_en: '', summary: '', summary_en: '', cover_url: '', video_url: '',
  city, city_en: '', theme, theme_en: '', location: '', location_en: '',
  event_date: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 16),
  capacity: 50, sort_order: 0, show_on_home: true,
  likes: 0, favorites: 0, views: 0,
  base_likes: 0, base_favorites: 0, base_views: 0,
});

export default function AdminEvents() {
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const { profile } = useAuth();

  const [items, setItems] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Partial<EventItem> | null>(null);
  const [open, setOpen] = useState(false);
  // 数据库迁移未执行时，这个开关存不进去，置灰并说明原因，避免静默失效
  const [homeToggleReady, setHomeToggleReady] = useState(true);
  const [filterOptions, setFilterOptions] = useState<EventFilterOption[]>([]);
  const [exportOpen, setExportOpen] = useState(false);
  const [exportRows, setExportRows] = useState<EventRegistrationExportRow[]>([]);
  const [exportLoading, setExportLoading] = useState(false);
  const [exportEvent, setExportEvent] = useState<EventItem | null>(null);

  const cityOptions = filterOptions.filter((o) => o.group === 'city' && o.is_active);
  const themeOptions = filterOptions.filter((o) => o.group === 'theme' && o.is_active);
  const defaultCity = cityOptions[0]?.name ?? '';
  const defaultTheme = themeOptions[0]?.name ?? '';

  useEffect(() => {
    isShowOnHomeReady().then(setHomeToggleReady).catch(() => setHomeToggleReady(false));
  }, []);

  useEffect(() => {
    if (profile && profile.role !== 'admin') { navigate('/', { replace: true }); return; }
    setLoading(true);
    Promise.all([fetchEvents(), fetchEventFilterOptions()])
      .then(([events, options]) => { setItems(events); setFilterOptions(options); })
      .catch(() => toast.error(t('加载失败', 'Load failed')))
      .finally(() => setLoading(false));
  }, [profile, navigate, t]);

  const openNew = () => { setEditing(emptyEvent(defaultCity, defaultTheme)); setOpen(true); };
  const openEdit = (item: EventItem) => { setEditing({ ...item, event_date: item.event_date.slice(0, 16) }); setOpen(true); };

  const handleSave = useCallback(async () => {
    if (!editing) return;
    if (!editing.title?.trim()) { toast.error(t('请填写标题', 'Title is required')); return; }
    const toInt = (n: unknown) => Math.max(0, Math.floor(Number(n) || 0));
    const payload = {
      ...editing,
      event_date: editing.event_date ? new Date(editing.event_date).toISOString() : new Date().toISOString(),
      base_likes: toInt(editing.base_likes),
      base_favorites: toInt(editing.base_favorites),
      base_views: toInt(editing.base_views),
    };
    try {
      await saveEvent(payload);
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
      fetchEvents().then(setItems);
    } catch { toast.error(t('保存失败', 'Save failed')); }
  }, [editing, t]);

  const handleDelete = async (id: string) => {
    try { await deleteEvent(id); toast.success(t('已删除', 'Deleted')); setItems((p) => p.filter((x) => x.id !== id)); }
    catch { toast.error(t('删除失败', 'Delete failed')); }
  };

  const openExport = async (item: EventItem) => {
    setExportEvent(item);
    setExportOpen(true);
    setExportLoading(true);
    try {
      const rows = await getEventRegistrationExport(item.id);
      setExportRows(rows);
    } catch {
      toast.error(t('加载报名列表失败', 'Failed to load registrations'));
      setExportRows([]);
    } finally {
      setExportLoading(false);
    }
  };

  const downloadExcel = useCallback(() => {
    if (!exportEvent) return;
    const headers = [t('姓名', 'Name'), t('电话', 'Phone'), t('微信', 'WeChat'), t('备注', 'Note'), t('报名时间', 'Registered At')];
    const rows = exportRows.map((r) => [
      r.name,
      r.phone,
      r.wechat,
      r.note.replace(/\n/g, ' '),
      new Date(r.created_at).toLocaleString(),
    ]);
    const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, t('报名人员', 'Registrations'));
    const title = (lang === 'en' && exportEvent.title_en ? exportEvent.title_en : exportEvent.title).replace(/\s+/g, '_');
    XLSX.writeFile(workbook, `${title}_registrations.xlsx`);
  }, [exportEvent, exportRows, lang, t]);

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <p className="editorial-label">{t('活动管理', 'Events')}</p>
          <h2 className="mt-1 font-display text-xl font-medium">{t('管理线下活动', 'Manage Events')}</h2>
        </div>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setEditing(null); }}>
          <DialogTrigger asChild>
            <Button onClick={openNew} className="gap-1.5 font-mono-label text-xs"><Plus className="h-3.5 w-3.5" />{t('新建活动', 'New Event')}</Button>
          </DialogTrigger>
          <DialogContent className="max-h-[90dvh] max-w-[calc(100%-2rem)] overflow-y-auto md:max-w-2xl">
            <DialogHeader><DialogTitle className="font-display">{editing?.id ? t('编辑活动', 'Edit Event') : t('新建活动', 'New Event')}</DialogTitle></DialogHeader>
            {editing && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field label={t('标题（中）', 'Title (ZH)')}><Input value={editing.title || ''} onChange={(e) => setEditing({ ...editing, title: e.target.value })} className="px-3" /></Field>
                  <Field label={t('标题（英）', 'Title (EN)')}><Input value={editing.title_en || ''} onChange={(e) => setEditing({ ...editing, title_en: e.target.value })} className="px-3" /></Field>
                  <Field label={t('摘要（中）', 'Summary (ZH)')}><Textarea value={editing.summary || ''} onChange={(e) => setEditing({ ...editing, summary: e.target.value })} className="px-3" rows={2} /></Field>
                  <Field label={t('摘要（英）', 'Summary (EN)')}><Textarea value={editing.summary_en || ''} onChange={(e) => setEditing({ ...editing, summary_en: e.target.value })} className="px-3" rows={2} /></Field>
                  <FileUploadField label={t('封面图', 'Cover Image')} value={editing.cover_url || ''} onChange={(url) => setEditing({ ...editing, cover_url: url })} folder="events/covers" accept="image/jpeg,image/png,image/webp,image/gif" id={editing.id} />
                  <FileUploadField label={t('视频', 'Video')} value={editing.video_url || ''} onChange={(url) => setEditing({ ...editing, video_url: url })} folder="events/videos" accept="video/mp4" preview="video" id={editing.id} />
                  <Field label={t('活动时间', 'Date')}><Input type="datetime-local" value={editing.event_date || ''} onChange={(e) => setEditing({ ...editing, event_date: e.target.value })} className="px-3" /></Field>
                  <Field label={t('城市（中）', 'City (ZH)')}>
                    <Select value={editing.city || defaultCity} onValueChange={(v) => setEditing({ ...editing, city: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {cityOptions.map((c) => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}
                        {cityOptions.length === 0 && <SelectItem value={editing.city || ''}>{editing.city}</SelectItem>}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label={t('城市（英）', 'City (EN)')}><Input value={editing.city_en || ''} onChange={(e) => setEditing({ ...editing, city_en: e.target.value })} className="px-3" /></Field>
                  <Field label={t('主题（中）', 'Theme (ZH)')}>
                    <Select value={editing.theme || defaultTheme} onValueChange={(v) => setEditing({ ...editing, theme: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {themeOptions.map((th) => <SelectItem key={th.id} value={th.name}>{th.name}</SelectItem>)}
                        {themeOptions.length === 0 && <SelectItem value={editing.theme || ''}>{editing.theme}</SelectItem>}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label={t('主题（英）', 'Theme (EN)')}><Input value={editing.theme_en || ''} onChange={(e) => setEditing({ ...editing, theme_en: e.target.value })} className="px-3" /></Field>
                  <Field label={t('地点（中）', 'Location (ZH)')}><Input value={editing.location || ''} onChange={(e) => setEditing({ ...editing, location: e.target.value })} className="px-3" /></Field>
                  <Field label={t('地点（英）', 'Location (EN)')}><Input value={editing.location_en || ''} onChange={(e) => setEditing({ ...editing, location_en: e.target.value })} className="px-3" /></Field>
                  <Field label={t('名额', 'Capacity')}><Input type="number" value={editing.capacity || 0} onChange={(e) => setEditing({ ...editing, capacity: Number(e.target.value) })} className="px-3" /></Field>
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
                    id="event-on-home"
                    disabled={!homeToggleReady}
                    checked={editing.show_on_home !== false}
                    onCheckedChange={(v) => setEditing({ ...editing, show_on_home: v })}
                  />
                  <Label htmlFor="event-on-home" className="font-mono-label text-xs uppercase tracking-wider text-muted-foreground">
                    {t('在首页「近期活动」板块展示', 'Show in homepage "Upcoming Events" section')}
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
              <th className="whitespace-nowrap px-4 py-3 text-left font-mono-label text-xs uppercase tracking-wider text-muted-foreground">{t('城市', 'City')}</th>
              <th className="whitespace-nowrap px-4 py-3 text-left font-mono-label text-xs uppercase tracking-wider text-muted-foreground">{t('主题', 'Theme')}</th>
              <th className="whitespace-nowrap px-4 py-3 text-right font-mono-label text-xs uppercase tracking-wider text-muted-foreground">{t('报名', 'Registered')}</th>
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
              <tr><td colSpan={8} className="px-4 py-8 text-center text-sm text-muted-foreground">{t('暂无活动', 'No events')}</td></tr>
            ) : items.map((item) => (
              <tr key={item.id} className="border-b border-border last:border-0">
                <td className="whitespace-nowrap px-4 py-3 text-sm text-foreground">{lang === 'en' && item.title_en ? item.title_en : item.title}</td>
                <td className="whitespace-nowrap px-4 py-3 text-sm text-muted-foreground">{lang === 'en' ? item.city_en : item.city}</td>
                <td className="whitespace-nowrap px-4 py-3 text-sm text-muted-foreground">{lang === 'en' ? item.theme_en : item.theme}</td>
                <td className="whitespace-nowrap px-4 py-3 text-right font-mono-label text-xs text-muted-foreground">{item.registered}/{item.capacity}</td>
                <td className="whitespace-nowrap px-4 py-3 text-right font-mono-label text-xs text-muted-foreground">{totalCount(item.likes, item.base_likes)}</td>
                <td className="whitespace-nowrap px-4 py-3 text-right font-mono-label text-xs text-muted-foreground">{totalCount(item.favorites, item.base_favorites)}</td>
                <td className="whitespace-nowrap px-4 py-3 text-right font-mono-label text-xs text-muted-foreground">{totalCount(item.views, item.base_views)}</td>
                <td className="whitespace-nowrap px-4 py-3 text-right">
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openExport(item)} title={t('导出报名列表', 'Export registrations')}><Users className="h-3.5 w-3.5" /></Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(item)}><Pencil className="h-3.5 w-3.5" /></Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8 text-destructive"><Trash2 className="h-3.5 w-3.5" /></Button></AlertDialogTrigger>
                      <AlertDialogContent className="max-w-[calc(100%-2rem)] md:max-w-lg">
                        <AlertDialogHeader><AlertDialogTitle className="font-display">{t('确认删除', 'Confirm delete')}</AlertDialogTitle><AlertDialogDescription>{t('删除后无法恢复，确定要删除该活动吗？', 'This cannot be undone. Delete this event?')}</AlertDialogDescription></AlertDialogHeader>
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

      {/* 报名人员导出弹窗 */}
      <Dialog open={exportOpen} onOpenChange={setExportOpen}>
        <DialogContent className="max-h-[90dvh] max-w-[calc(100%-2rem)] overflow-y-auto md:max-w-3xl">
          <DialogHeader>
            <DialogTitle className="font-display">
              {t('报名人员', 'Registrations')}
              {exportEvent ? ` · ${lang === 'en' && exportEvent.title_en ? exportEvent.title_en : exportEvent.title}` : ''}
            </DialogTitle>
          </DialogHeader>
          {exportLoading ? (
            <p className="py-8 text-center text-sm text-muted-foreground">{t('加载中…', 'Loading…')}</p>
          ) : exportRows.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">{t('暂无报名人员', 'No registrations')}</p>
          ) : (
            <>
              <div className="flex justify-end">
                <Button onClick={downloadExcel} size="sm" className="gap-1.5 font-mono-label text-xs">
                  <Download className="h-3.5 w-3.5" />{t('下载 Excel', 'Download Excel')}
                </Button>
              </div>
              <div className="mt-2 w-full max-w-full overflow-x-auto border border-border bg-card">
                <table className="w-full min-w-[640px] border-collapse">
                  <thead>
                    <tr className="border-b border-border bg-muted/40">
                      <th className="whitespace-nowrap px-4 py-3 text-left font-mono-label text-xs uppercase tracking-wider text-muted-foreground">{t('姓名', 'Name')}</th>
                      <th className="whitespace-nowrap px-4 py-3 text-left font-mono-label text-xs uppercase tracking-wider text-muted-foreground">{t('电话', 'Phone')}</th>
                      <th className="whitespace-nowrap px-4 py-3 text-left font-mono-label text-xs uppercase tracking-wider text-muted-foreground">{t('微信', 'WeChat')}</th>
                      <th className="whitespace-nowrap px-4 py-3 text-left font-mono-label text-xs uppercase tracking-wider text-muted-foreground">{t('备注', 'Note')}</th>
                      <th className="whitespace-nowrap px-4 py-3 text-left font-mono-label text-xs uppercase tracking-wider text-muted-foreground">{t('报名时间', 'Registered At')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {exportRows.map((row) => (
                      <tr key={row.id} className="border-b border-border last:border-0">
                        <td className="whitespace-nowrap px-4 py-3 text-sm text-foreground">{row.name || '-'}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-sm text-muted-foreground">{row.phone || '-'}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-sm text-muted-foreground">{row.wechat || '-'}</td>
                        <td className="max-w-xs whitespace-normal px-4 py-3 text-sm text-muted-foreground">{row.note || '-'}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-sm text-muted-foreground">{new Date(row.created_at).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
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
