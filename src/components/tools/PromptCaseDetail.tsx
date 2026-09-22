import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  X,
  Heart,
  Copy,
  Check,
  Sparkles,
  Download,
  Trash2,
  Loader2,
  Wand2,
  Clock,
  Layers,
  Sliders,
  Info,
  ChevronDown,
} from 'lucide-react';
import { PromptCase, PromptCaseGeneration } from '@/types/types';
import { useI18n } from '@/contexts/I18nContext';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import {
  generateImage,
  fetchPromptCaseGenerations,
  deletePromptCaseGeneration,
  fetchMyImageProviderConfig,
  type ImageProviderConfig,
} from '@/lib/api';

interface PromptCaseDetailProps {
  item?: PromptCase;
  open: boolean;
  onClose: () => void;
}

const SIZE_PRESETS = [
  { label: '1024x1024 (1K 标准 1:1)', value: '1024x1024' },
  { label: '3840x2160 (4K 超清 16:9)', value: '3840x2160' },
  { label: '1920x1080 (高清 16:9)', value: '1920x1080' },
  { label: '1080x1920 (手机竖屏 9:16)', value: '1080x1920' },
  { label: '2048x2048 (2K 方图)', value: '2048x2048' },
];

export default function PromptCaseDetail({ item, open, onClose }: PromptCaseDetailProps) {
  const { lang, t } = useI18n();
  const { user } = useAuth();
  const navigate = useNavigate();

  const title = (lang === 'en' && item?.title_en ? item.title_en : item?.title) ?? '';
  const description = (lang === 'en' && item?.description_en ? item.description_en : item?.description) ?? '';
  const prompt = (lang === 'en' && item?.prompt_en ? item.prompt_en : item?.prompt) ?? '';

  const [copied, setCopied] = useState(false);
  const [editablePrompt, setEditablePrompt] = useState(prompt ?? '');
  const [activeImage, setActiveImage] = useState(item?.cover_url);
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(null);
  const [history, setHistory] = useState<PromptCaseGeneration[]>([]);
  const [, setLoadingHistory] = useState(false);

  // 用户模型与生图请求设置
  const [userConfig, setUserConfig] = useState<ImageProviderConfig | null>(null);
  const [selectedSize, setSelectedSize] = useState('1024x1024');

  // 控制尺寸设置与计费说明的展开/收起（默认折叠隐藏，不占空间）
  const [isSizeSettingsOpen, setIsSizeSettingsOpen] = useState(false);
  const [isBillingInfoOpen, setIsBillingInfoOpen] = useState(false);

  const progressTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  // 切换 item 时同步状态
  useEffect(() => {
    setActiveImage(item?.cover_url);
    setEditablePrompt((lang === 'en' && item?.prompt_en ? item.prompt_en : item?.prompt) ?? '');
    setGeneratedUrl(null);
  }, [item, lang]);

  // 加载用户生图配置与生成历史
  useEffect(() => {
    if (!open || !user || !item) return;
    setLoadingHistory(true);
    fetchPromptCaseGenerations(item.id)
      .then((res) => setHistory(res))
      .catch((err) => console.error('fetch history error', err))
      .finally(() => setLoadingHistory(false));

    fetchMyImageProviderConfig()
      .then((cfg) => {
        if (cfg) {
          setUserConfig(cfg);
          if (cfg.default_size) {
            setSelectedSize(cfg.default_size);
          }
        }
      })
      .catch((err) => console.error('fetch config error', err));
  }, [item?.id, user, open]);

  // 案例库为空时调用方可能传入 undefined。守卫必须放在所有 hook 之后——
  // 在 hook 之前 return 会让两次渲染的 hook 数量不一致，React 直接报错。
  if (!item) return null;

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success(t('已复制到剪贴板', 'Copied to clipboard'));
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error(t('复制失败', 'Copy failed'));
    }
  };

  const downloadImage = (url: string, filename: string) => {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.target = '_blank';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const startProgress = () => {
    setProgress(0);
    if (progressTimer.current) clearInterval(progressTimer.current);
    progressTimer.current = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 90) return prev;
        const step = Math.max(1, Math.floor((100 - prev) / 10));
        return prev + step;
      });
    }, 600);
  };

  const stopProgress = () => {
    if (progressTimer.current) clearInterval(progressTimer.current);
    setProgress(100);
    setTimeout(() => setProgress(0), 400);
  };

  const handleGenerate = async () => {
    if (generating) return;

    if (!user) {
      navigate('/login', { state: { from: '/tools' } });
      return;
    }

    const config = userConfig || (await fetchMyImageProviderConfig());
    if (!config) {
      toast.info(t('请先配置生图模型', 'Please configure your image generation model first'));
      navigate('/profile/image-provider');
      return;
    }

    setGenerating(true);
    setGeneratedUrl(null);
    startProgress();
    try {
      const { url } = await generateImage(editablePrompt, item.id, selectedSize.trim() || '1024x1024');
      setGeneratedUrl(url);
      const updated = await fetchPromptCaseGenerations(item.id);
      setHistory(updated);
      toast.success(t('图片生成成功', 'Image generated'));
    } catch (err) {
      toast.error((err as Error)?.message || t('图片生成失败', 'Image generation failed'));
    } finally {
      stopProgress();
      setGenerating(false);
    }
  };

  const handleDeleteHistory = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await deletePromptCaseGeneration(id);
      setHistory((prev) => prev.filter((h) => h.id !== id));
      toast.success(t('已删除', 'Deleted'));
    } catch (err) {
      toast.error((err as Error)?.message || t('删除失败', 'Delete failed'));
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80" onClick={onClose} />
      <div className="relative z-10 flex max-h-[92dvh] w-full max-w-6xl flex-col overflow-hidden rounded-xl border border-border bg-card shadow-2xl md:flex-row">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 z-20 flex h-9 w-9 items-center justify-center rounded-full border border-border bg-background/80 text-foreground backdrop-blur-sm transition-colors hover:bg-background"
          aria-label={t('关闭', 'Close')}
        >
          <X className="h-4 w-4" />
        </button>

        {/* 左侧大图预览 + 历史切换 */}
        <div className="flex w-full flex-col border-b border-border bg-black/40 md:w-1/2 md:border-b-0 md:border-r">
          <div className="relative flex min-h-[260px] flex-1 items-center justify-center overflow-hidden p-6 md:min-h-[460px]">
            <img
              src={activeImage}
              alt={title}
              className="max-h-[58vh] max-w-full rounded-lg object-contain shadow-md"
            />
          </div>

          <div className="border-t border-border bg-card/60 p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-xs font-medium text-foreground">
                <Layers className="h-3.5 w-3.5 text-primary" />
                {t('预览切图', 'Preview Selection')}
              </span>
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="h-3.5 w-3.5" />
                {t('历史生成', 'Generations')} ({history.length})
              </span>
            </div>

            <div className="flex gap-2 overflow-x-auto pb-1">
              <button
                type="button"
                onClick={() => setActiveImage(item.cover_url)}
                className={`relative h-14 w-14 shrink-0 overflow-hidden rounded-md border-2 transition-all ${
                  activeImage === item.cover_url ? 'border-primary ring-2 ring-primary/30' : 'border-border opacity-70 hover:opacity-100'
                }`}
              >
                <img src={item.cover_url} alt="Original" className="h-full w-full object-cover" />
                <span className="absolute bottom-0 inset-x-0 bg-black/60 text-[9px] text-white text-center py-0.5">
                  {t('原图', 'Original')}
                </span>
              </button>

              {history.map((h) => (
                <div
                  key={h.id}
                  className={`group relative h-14 w-14 shrink-0 overflow-hidden rounded-md border-2 transition-all ${
                    activeImage === h.image_url ? 'border-primary ring-2 ring-primary/30' : 'border-border opacity-70 hover:opacity-100'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setActiveImage(h.image_url)}
                    className="h-full w-full"
                  >
                    <img src={h.image_url} alt="Generated" className="h-full w-full object-cover" />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => handleDeleteHistory(h.id, e)}
                    className="absolute right-1 top-1 hidden rounded bg-black/70 p-1 text-destructive hover:bg-black group-hover:block"
                    title={t('删除记录', 'Delete record')}
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 右侧信息与生图操作面板 */}
        <div className="relative flex w-full flex-1 flex-col overflow-y-auto p-5 md:p-6">
          <div className="flex flex-wrap gap-2">
            {item.category && <Badge variant="secondary" className="bg-primary/10 text-primary">{item.category.name}</Badge>}
            {item.style && <Badge variant="outline">{item.style.name}</Badge>}
            {item.scene && <Badge variant="outline">{item.scene.name}</Badge>}
          </div>

          <h2 className="mt-2 font-display text-xl font-medium text-foreground md:text-2xl">{title}</h2>

          {description && (
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground line-clamp-2">{description}</p>
          )}

          <div className="mt-3 flex flex-wrap gap-2">
            <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={() => toast(t('已收藏', 'Favorited'))}>
              <Heart className="h-3.5 w-3.5" />{t('收藏', 'Favorite')}
            </Button>
            <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={() => handleCopy(prompt)}>
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? t('已复制', 'Copied') : t('复制 Prompt', 'Copy Prompt')}
            </Button>
            <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={handleGenerate}>
              <Wand2 className="h-3.5 w-3.5" />{t('立即生成', 'Generate Now')}
            </Button>
          </div>

          {/* 可编辑 Prompt */}
          <div className="mt-4 space-y-1.5">
            <div className="flex items-center justify-between">
              <p className="font-mono-label text-[11px] uppercase tracking-wider text-muted-foreground">{t('可编辑 Prompt', 'Editable Prompt')}</p>
              <Button variant="ghost" size="sm" onClick={() => setEditablePrompt(prompt)} className="h-auto px-1.5 py-0.5 text-[11px]">
                {t('重置 Prompt', 'Reset')}
              </Button>
            </div>
            <Textarea
              value={editablePrompt}
              onChange={(e) => setEditablePrompt(e.target.value)}
              rows={3}
              className="resize-none px-3 font-mono text-xs leading-relaxed"
            />
          </div>

          {/* 可折叠隐藏与展开：生图请求设置（尺寸选择）—— 默认收起 */}
          <div className="mt-3 rounded-lg border border-border bg-card/60 overflow-hidden transition-all">
            <button
              type="button"
              onClick={() => setIsSizeSettingsOpen(!isSizeSettingsOpen)}
              className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-muted/40 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Sliders className="h-3.5 w-3.5 text-accent" />
                <span className="text-xs font-medium text-foreground">{t('生图尺寸设置', 'Image Size Settings')}</span>
                <span className="rounded bg-accent/15 px-1.5 py-0.5 font-mono text-[10px] text-accent">
                  {selectedSize}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {userConfig && (
                  <span className="text-[10px] font-mono text-muted-foreground hidden sm:inline">
                    {userConfig.model}
                  </span>
                )}
                <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform duration-200 ${isSizeSettingsOpen ? 'rotate-180' : ''}`} />
              </div>
            </button>

            {isSizeSettingsOpen && (
              <div className="border-t border-border/60 p-3 space-y-2 bg-background/40">
                <div className="flex flex-wrap gap-1.5">
                  {SIZE_PRESETS.map((preset) => (
                    <button
                      type="button"
                      key={preset.value}
                      onClick={() => setSelectedSize(preset.value)}
                      className={`rounded-md border px-2 py-1 font-mono text-[11px] transition-colors ${
                        selectedSize === preset.value
                          ? 'border-accent bg-accent/15 text-accent font-medium'
                          : 'border-border bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <Input
                    value={selectedSize}
                    onChange={(e) => setSelectedSize(e.target.value)}
                    placeholder="1024x1024"
                    className="max-w-[130px] font-mono text-xs px-2.5 h-7"
                  />
                  <span className="text-[11px] text-muted-foreground">
                    {t('自定义格式如 1024x1024、3840x2160', 'Custom e.g. 1024x1024, 3840x2160')}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* 可折叠隐藏与展开：接口计费与尺寸对应说明 —— 默认收起 */}
          <div className="mt-2 rounded-lg border border-border/80 bg-muted/20 overflow-hidden transition-all">
            <button
              type="button"
              onClick={() => setIsBillingInfoOpen(!isBillingInfoOpen)}
              className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-muted/40 transition-colors"
            >
              <div className="flex items-center gap-1.5 text-xs font-medium text-foreground">
                <Info className="h-3.5 w-3.5 text-accent shrink-0" />
                <span>{t('接口计费与尺寸对应说明', 'Billing & Size Instructions')}</span>
              </div>
              <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform duration-200 ${isBillingInfoOpen ? 'rotate-180' : ''}`} />
            </button>

            {isBillingInfoOpen && (
              <div className="border-t border-border/60 p-3 pt-2 text-[11px] space-y-1 text-muted-foreground leading-relaxed bg-background/40">
                <ul className="list-disc pl-4 space-y-1">
                  <li>{t('按张计费，生成失败不扣费。', 'Billed per image; failed generations are not charged.')}</li>
                  <li>{t('1K 与 4K 通常为独立模型名，计费按模型名结算，不看 size 参数。', '1K and 4K models are billed by model name, not size.')}</li>
                  <li>{t('如使用 4K 模型却传 1024x1024，仍按 4K 单价扣费；1K 模型若不支持 4K 尺寸，传错会被直接拒绝（不扣费）。', 'Using 1024x1024 on 4K model still charges 4K rate; 1K models rejecting 4K sizes will not be billed.')}</li>
                </ul>
              </div>
            )}
          </div>

          {/* 生成结果图片展示 */}
          {generatedUrl && (
            <div className="mt-4 space-y-2">
              <div className="flex items-center justify-between">
                <p className="font-mono-label text-xs uppercase tracking-wider text-muted-foreground">{t('最新生成结果', 'Latest Generated Result')}</p>
                <Button variant="ghost" size="sm" onClick={() => downloadImage(generatedUrl, `${item.title || 'generated'}.png`)} className="h-auto gap-1 px-2 py-1 text-xs">
                  <Download className="h-3.5 w-3.5" />{t('下载高清图', 'Download HD')}
                </Button>
              </div>
              <div className="overflow-hidden rounded-lg border border-border bg-muted">
                <img src={generatedUrl} alt={t('生成图片', 'Generated image')} className="w-full object-cover" />
              </div>
            </div>
          )}

          {/* 生成图片大按钮（首屏清晰可见，不被挤占） */}
          <div className="mt-auto pt-4">
            <Button onClick={handleGenerate} disabled={generating} className="relative w-full gap-2 overflow-hidden py-5 text-sm font-medium">
              {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {generating ? `${t('生成中', 'Generating')} ${progress}%` : t('生成图片', 'Generate Image')}
            </Button>
          </div>
        </div>

        {/* 电光紫流光骨架屏 + 进度 */}
        {generating && (
          <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm">
            <div className="relative w-full max-w-md space-y-6 px-6">
              <div className="electric-skeleton aspect-video w-full rounded-xl" />
              <div className="space-y-2">
                <div className="flex justify-between text-sm font-medium text-primary">
                  <span>{t('正在生成图片', 'Generating image')}</span>
                  <span>{progress}%</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full bg-primary transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <p className="text-center text-xs text-muted-foreground">
                  {t('第三方生图模型处理中，预计 5-15 秒…', 'Third-party model processing, usually 5-15s…')}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
