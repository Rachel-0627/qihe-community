import { useRef, useState } from 'react';
import { Loader2, Upload, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { uploadMedia } from '@/lib/api';
import { toast } from 'sonner';
import { useI18n } from '@/contexts/I18nContext';

interface MultiImageUploadFieldProps {
  label: string;
  value: string[];
  onChange: (urls: string[]) => void;
  folder: string;
  id?: string;
  disabled?: boolean;
}

export default function MultiImageUploadField({ label, value, onChange, folder, id, disabled = false }: MultiImageUploadFieldProps) {
  const { t } = useI18n();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleFiles = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;
    setUploading(true);
    try {
      const urls = await Promise.all(files.map((file) => uploadMedia(file, folder, id)));
      onChange([...value, ...urls]);
      toast.success(t(`已上传 ${urls.length} 张图片`, `Uploaded ${urls.length} images`));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('图片上传失败', 'Image upload failed'));
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-2">
      <Label className="font-mono-label text-xs uppercase tracking-wider text-muted-foreground">{label}</Label>
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs text-muted-foreground">{t('按添加顺序轮播，可一次选择多张', 'Images rotate in upload order; select multiple at once')}</span>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          multiple
          onChange={handleFiles}
          className="sr-only"
        />
        <Button type="button" variant="outline" size="sm" disabled={disabled || uploading} onClick={() => inputRef.current?.click()}>
          {uploading ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Upload className="mr-1 h-3.5 w-3.5" />}
          {uploading ? t('上传中…', 'Uploading…') : t('添加图片', 'Add images')}
        </Button>
      </div>
      {value.length > 0 && (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {value.map((url, index) => (
            <div key={`${url}-${index}`} className="relative aspect-[4/3] overflow-hidden rounded border border-border bg-muted">
              <img src={url} alt={`${label} ${index + 1}`} className="h-full w-full object-cover" />
              <button
                type="button"
                aria-label={t(`移除第 ${index + 1} 张图片`, `Remove image ${index + 1}`)}
                onClick={() => onChange(value.filter((_, itemIndex) => itemIndex !== index))}
                className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-background/90 text-foreground shadow hover:bg-destructive hover:text-destructive-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
              <span className="absolute bottom-1 left-1 rounded bg-background/90 px-1.5 py-0.5 text-[10px] text-foreground">{index + 1}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
