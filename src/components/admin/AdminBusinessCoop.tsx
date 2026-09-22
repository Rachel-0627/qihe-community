import { useState, useEffect, useCallback, useRef } from 'react';
import { useI18n } from '@/contexts/I18nContext';
import { useSiteSettings } from '@/contexts/SiteSettingsContext';
import { fetchSiteSettings, saveSiteSetting } from '@/lib/api';
import { importMarkdown, importDocx, importPdf, type ImportResult } from '@/lib/documentImport';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import ImmersiveEditor, { type ImmersiveEditorApi } from '@/components/editor/ImmersiveEditor';

export default function AdminBusinessCoop() {
  const { t } = useI18n();
  const { reload: reloadSiteSettings } = useSiteSettings();
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const zhEditorRef = useRef<ImmersiveEditorApi>(null);
  const enEditorRef = useRef<ImmersiveEditorApi>(null);

  const load = useCallback(() => {
    fetchSiteSettings()
      .then((rows) => {
        const map: Record<string, string> = {};
        rows.forEach((r) => { map[r.key] = r.value; });
        setSettings({
          business_coop_visible: map.business_coop_visible ?? 'true',
          business_coop_content: map.business_coop_content ?? '<p>欢迎与我们联系商务合作。</p>',
          business_coop_content_en: map.business_coop_content_en ?? '<p>Welcome to contact us for business cooperation.</p>',
        });
      })
      .catch(() => toast.error(t('加载失败', 'Load failed')))
      .finally(() => setLoading(false));
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  const handleSave = async (key: string, value: string) => {
    try {
      await saveSiteSetting({ key, value, updated_at: new Date().toISOString() });
      toast.success(t('保存成功', 'Saved successfully'));
      reloadSiteSettings();
    } catch {
      toast.error(t('保存失败', 'Save failed'));
    }
  };

  const makeImportHandler = useCallback((editorRef: React.RefObject<ImmersiveEditorApi | null>, setter: (html: string) => void) => async () => {
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
        const folder = 'business';
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
        setter(result.content);
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
  }, []);

  const handleImportZh = makeImportHandler(zhEditorRef, (html) => setSettings((prev) => ({ ...prev, business_coop_content: html })));
  const handleImportEn = makeImportHandler(enEditorRef, (html) => setSettings((prev) => ({ ...prev, business_coop_content_en: html })));

  if (loading) {
    return <p className="text-sm text-muted-foreground">{t('加载中…', 'Loading…')}</p>;
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between border border-border bg-card p-4">
        <div className="space-y-0.5">
          <Label className="font-mono-label text-xs uppercase tracking-wider text-muted-foreground">{t('前台显示', 'Visible on site')}</Label>
          <p className="text-sm text-muted-foreground">{t('关闭后前台导航与页面入口将隐藏', 'Hide navigation and page entry when turned off')}</p>
        </div>
        <Switch
          checked={settings.business_coop_visible !== 'false'}
          onCheckedChange={(checked) => {
            const value = checked ? 'true' : 'false';
            setSettings((prev) => ({ ...prev, business_coop_visible: value }));
            handleSave('business_coop_visible', value);
          }}
        />
      </div>

      <div className="space-y-3">
        <Label className="font-mono-label text-xs uppercase tracking-wider text-muted-foreground">{t('中文内容', 'Chinese content')}</Label>
        <ImmersiveEditor
          ref={zhEditorRef}
          value={settings.business_coop_content || ''}
          onChange={(value) => setSettings((prev) => ({ ...prev, business_coop_content: value }))}
          placeholder={t('编辑商务与合作页面内容', 'Edit business cooperation page content')}
          uploadFolder="business"
          onImportFile={handleImportZh}
        />
        <div className="flex justify-end">
          <Button onClick={() => handleSave('business_coop_content', settings.business_coop_content)} className="font-mono-label text-xs uppercase tracking-wider">
            {t('保存中文内容', 'Save Chinese content')}
          </Button>
        </div>
      </div>

      <div className="space-y-3">
        <Label className="font-mono-label text-xs uppercase tracking-wider text-muted-foreground">{t('英文内容', 'English content')}</Label>
        <ImmersiveEditor
          ref={enEditorRef}
          value={settings.business_coop_content_en || ''}
          onChange={(value) => setSettings((prev) => ({ ...prev, business_coop_content_en: value }))}
          placeholder={t('Edit business cooperation page content', 'Edit business cooperation page content')}
          uploadFolder="business"
          onImportFile={handleImportEn}
        />
        <div className="flex justify-end">
          <Button onClick={() => handleSave('business_coop_content_en', settings.business_coop_content_en)} className="font-mono-label text-xs uppercase tracking-wider">
            {t('保存英文内容', 'Save English content')}
          </Button>
        </div>
      </div>
    </div>
  );
}
