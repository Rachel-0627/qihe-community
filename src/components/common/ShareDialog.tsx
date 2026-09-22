import { useState } from 'react';
import { Share2, Copy, Check } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { useI18n } from '@/contexts/I18nContext';

interface ShareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  shareUrl: string;
}

/** 链接分享弹窗：展示当前内容公开详情页链接，支持一键复制 */
export default function ShareDialog({ open, onOpenChange, title, shareUrl }: ShareDialogProps) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast.success(t('链接已复制', 'Link copied'));
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // 剪贴板 API 不可用时回退到 execCommand（部分移动端浏览器）
      try {
        const ta = document.createElement('textarea');
        ta.value = shareUrl;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        setCopied(true);
        toast.success(t('链接已复制', 'Link copied'));
        setTimeout(() => setCopied(false), 2000);
      } catch {
        toast.error(t('复制失败，请长按链接手动复制', 'Copy failed, press and hold the link to copy'));
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display">{t('分享链接', 'Share Link')}</DialogTitle>
          <DialogDescription className="text-pretty">
            {t('复制下方链接发送给好友，打开即可查看这篇内容。', 'Copy the link below to share this content.')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <p className="truncate font-display text-sm font-medium text-foreground">{title}</p>
          <button
            type="button"
            onClick={handleCopy}
            className="block w-full break-all border border-border bg-muted p-3 text-left font-mono-label text-xs leading-relaxed text-muted-foreground transition-colors hover:border-accent hover:text-foreground"
          >
            {shareUrl}
          </button>
          <Button onClick={handleCopy} className="w-full gap-1.5 font-mono-label text-xs uppercase tracking-wider">
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied ? t('已复制', 'Copied') : t('复制链接', 'Copy Link')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function ShareButton({ onClick }: { onClick: () => void }) {
  const { t } = useI18n();
  return (
    <Button variant="outline" size="sm" onClick={onClick} className="gap-1.5 font-mono-label text-xs uppercase tracking-wider">
      <Share2 className="h-3.5 w-3.5" />{t('分享', 'Share')}
    </Button>
  );
}