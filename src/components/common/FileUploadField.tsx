import { useRef, useState } from 'react';
import { Upload, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { uploadMedia } from '@/lib/api';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface FileUploadFieldProps {
  label: string;
  value: string;
  onChange: (url: string) => void;
  folder: string;
  accept?: string;
  id?: string;
  preview?: 'image' | 'video' | 'none';
}

export default function FileUploadField({ label, value, onChange, folder, accept, id, preview = 'image' }: FileUploadFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadMedia(file, folder, id);
      onChange(url);
      toast.success('上传成功');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '上传失败');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const isPreview = value && preview !== 'none';

  return (
    <div className="space-y-1.5">
      <Label className="font-mono-label text-xs uppercase tracking-wider text-muted-foreground">{label}</Label>
      <div className="flex items-center gap-2">
        <Input value={value || ''} onChange={(e) => onChange(e.target.value)} placeholder="https://" className="px-3" />
        <input ref={inputRef} type="file" accept={accept} onChange={handleFile} className="sr-only" />
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-10 w-10 shrink-0"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
          title="上传文件"
        >
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
        </Button>
      </div>
      {isPreview && (
        <div className="relative mt-2 inline-block max-w-full">
          <button
            type="button"
            onClick={() => onChange('')}
            className="absolute -right-2 -top-2 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-destructive text-destructive-foreground shadow-sm"
            title="清除"
          >
            <X className="h-3 w-3" />
          </button>
          {preview === 'image' ? (
            <img src={value} alt={label} className="max-h-32 rounded border border-border object-cover" />
          ) : (
            <video src={value} controls className="max-h-32 rounded border border-border" />
          )}
        </div>
      )}
    </div>
  );
}

// 纯按钮上传，返回 URL 后调用 onChange
export function FileUploadButton({ onChange, folder, accept, id, children }: { onChange: (url: string) => void; folder: string; accept?: string; id?: string; children: React.ReactNode }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadMedia(file, folder, id);
      onChange(url);
      toast.success('上传成功');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '上传失败');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <>
      <input ref={inputRef} type="file" accept={accept} onChange={handleFile} className="sr-only" />
      <Button type="button" variant="outline" size="sm" disabled={uploading} onClick={() => inputRef.current?.click()}>
        {uploading ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : null}
        {children}
      </Button>
    </>
  );
}
