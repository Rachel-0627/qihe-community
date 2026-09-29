import { useRef, useState } from 'react';
import { ImagePlus, Loader2, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/contexts/I18nContext';
import { uploadMedia } from '@/lib/api';

interface Props {
  value: string[];
  onChange: (next: string[]) => void;
  folder: string;
  max?: number;
}

/**
 * 多图上传。
 *
 * 没复用 FileUploadField：那个是单值的（一个 url 进、一个 url 出），
 * 改成兼容多值会让所有现有调用方都要跟着判断类型。
 *
 * 顺序就是上传顺序，详情页按这个顺序排。想调顺序删了重传即可——
 * 加拖拽排序对这个使用量来说是过度设计。
 */
export default function ImageListField({ value, onChange, folder, max = 9 }: Props) {
  const { t } = useI18n();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const pick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;

    const room = max - value.length;
    if (room <= 0) { toast.error(t(`最多 ${max} 张`, `Up to ${max} images`)); return; }

    setUploading(true);
    try {
      // 逐张传而不是并发：并发上传在弱网下更容易整批失败，
      // 而且成功几张、失败几张时状态难收拾
      const urls: string[] = [];
      for (const f of files.slice(0, room)) {
        urls.push(await uploadMedia(f, folder));
      }
      onChange([...value, ...urls]);
      if (files.length > room) toast.warning(t(`超出的 ${files.length - room} 张没有上传`, `${files.length - room} skipped`));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('上传失败', 'Upload failed'));
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium">
        {t('配图', 'Images')}
        <span className="ml-2 font-normal text-muted-foreground">{value.length}/{max}</span>
      </span>

      <div className="flex flex-wrap gap-2">
        {value.map((url, i) => (
          <div key={url} className="group relative h-24 w-24 overflow-hidden rounded-md border border-border">
            <img src={url} alt={`${i + 1}`} className="h-full w-full object-cover" />
            <button
              type="button"
              onClick={() => onChange(value.filter((u) => u !== url))}
              className="absolute right-1 top-1 rounded bg-background/90 p-1 text-muted-foreground transition-colors hover:text-destructive"
              aria-label={t('移除', 'Remove')}
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ))}

        {value.length < max && (
          <Button
            type="button"
            variant="outline"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="h-24 w-24 flex-col gap-1 border-dashed text-muted-foreground"
          >
            {uploading
              ? <Loader2 className="h-5 w-5 animate-spin" />
              : <><ImagePlus className="h-5 w-5" /><span className="text-xs">{t('添加', 'Add')}</span></>}
          </Button>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        multiple
        accept="image/jpeg,image/png,image/webp,image/gif"
        onChange={pick}
        className="sr-only"
      />
    </div>
  );
}
