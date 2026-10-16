import { useState, useEffect, useMemo } from 'react';
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

/** 微信内置浏览器：它不支持系统分享面板，而且分享要走右上角菜单 */
function inWeChat(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /micromessenger/i.test(navigator.userAgent);
}

/** 手机浏览器的系统分享面板。微信里排除掉，那边用不了 */
function canUseSystemShare(): boolean {
  if (typeof navigator === 'undefined') return false;
  return typeof navigator.share === 'function' && !inWeChat();
}

/**
 * 分享入口。按设备给不同路径：
 * - 手机浏览器：直接唤起系统分享面板，选微信就能带标题和封面过去
 * - 微信内置浏览器：没有系统面板，改成引导用户点右上角菜单
 * - 电脑：还是复制链接
 *
 * 判断逻辑都收在这里，6 处调用点不用各写一遍。
 */
export default function ShareDialog({ open, onOpenChange, title, shareUrl }: ShareDialogProps) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  // 系统面板调不起来时退回弹窗，不让用户卡在"点了没反应"
  const [fallbackToDialog, setFallbackToDialog] = useState(false);

  const isWeChat = useMemo(inWeChat, []);
  const systemShare = useMemo(canUseSystemShare, []);
  const useSystemPanel = systemShare && !fallbackToDialog;

  useEffect(() => {
    if (!open) setFallbackToDialog(false);
  }, [open]);

  useEffect(() => {
    if (!open || !useSystemPanel) return;
    let cancelled = false;

    navigator
      .share({ title, url: shareUrl })
      .then(() => {
        if (!cancelled) onOpenChange(false);
      })
      .catch((err: { name?: string }) => {
        if (cancelled) return;
        // 用户自己点了取消，不是故障，安静关掉
        if (err?.name === 'AbortError') {
          onOpenChange(false);
          return;
        }
        // 浏览器不让调（权限、手势过期等），退回复制弹窗
        setFallbackToDialog(true);
      });

    return () => {
      cancelled = true;
    };
  }, [open, useSystemPanel, title, shareUrl, onOpenChange]);

  const handleCopy = async () => {
    const done = () => {
      setCopied(true);
      toast.success(t('链接已复制', 'Link copied'));
      setTimeout(() => setCopied(false), 2000);
    };
    try {
      await navigator.clipboard.writeText(shareUrl);
      done();
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
        done();
      } catch {
        toast.error(t('复制失败，请长按链接手动复制', 'Copy failed, press and hold the link to copy'));
      }
    }
  };

  // 走系统面板时不渲染弹窗，避免闪一下再消失
  if (useSystemPanel) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[calc(100%-2rem)] md:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display">{t('分享链接', 'Share Link')}</DialogTitle>
          <DialogDescription className="text-pretty">
            {isWeChat
              ? t('点右上角「···」选「发送给朋友」，分享出去会带上标题和封面。', 'Tap "···" at the top right and choose "Send to Chat" — the card will include the title and cover.')
              : t('复制下方链接发送给好友，打开即可查看这篇内容。', 'Copy the link below to share this content.')}
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
