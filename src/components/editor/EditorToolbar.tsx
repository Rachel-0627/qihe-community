import { ArrowLeft, Undo2, Redo2, Eye, Send, Loader2, CheckCircle2, AlertCircle, FileUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

interface EditorToolbarProps {
  onBack: () => void;
  lang: 'zh' | 'en';
  onToggleLang: () => void;
  saveStatus: SaveStatus;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onPreview: () => void;
  onPublish: () => void;
  onImportFile: () => void;
  isPublished?: boolean;
}

function StatusBadge({ status }: { status: SaveStatus }) {
  if (status === 'saving') {
    return (
      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> 正在保存…
      </span>
    );
  }
  if (status === 'saved') {
    return (
      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <CheckCircle2 className="h-3.5 w-3.5 text-[hsl(var(--success))]" /> 已保存
      </span>
    );
  }
  if (status === 'error') {
    return (
      <span className="flex items-center gap-1.5 text-xs text-destructive">
        <AlertCircle className="h-3.5 w-3.5" /> 保存失败
      </span>
    );
  }
  return null;
}

export default function EditorToolbar({
  onBack,
  lang,
  onToggleLang,
  saveStatus,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onPreview,
  onPublish,
  onImportFile,
  isPublished,
}: EditorToolbarProps) {
  return (
    <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b border-border/40 bg-background/85 px-4 backdrop-blur-md md:px-8">
      <div className="flex min-w-0 items-center gap-2">
        <Button variant="ghost" size="sm" onClick={onBack} className="shrink-0 text-muted-foreground hover:text-foreground">
          <ArrowLeft className="mr-1 h-4 w-4" /> 返回
        </Button>
        <div className="hidden items-center rounded-md border border-border/50 p-0.5 md:flex">
          <button
            type="button"
            onClick={() => lang !== 'zh' && onToggleLang()}
            className={cn('rounded px-2.5 py-1 text-xs font-medium transition-colors', lang === 'zh' ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground')}
          >
            中文
          </button>
          <button
            type="button"
            onClick={() => lang !== 'en' && onToggleLang()}
            className={cn('rounded px-2.5 py-1 text-xs font-medium transition-colors', lang === 'en' ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground')}
          >
            English
          </button>
        </div>
        <div className="ml-2 hidden md:block">
          <StatusBadge status={saveStatus} />
        </div>
      </div>

      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon" onClick={onUndo} disabled={!canUndo} className="text-muted-foreground hover:text-foreground" title="撤销">
          <Undo2 className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" onClick={onRedo} disabled={!canRedo} className="text-muted-foreground hover:text-foreground" title="重做">
          <Redo2 className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" onClick={onImportFile} className="text-muted-foreground hover:text-foreground" title="导入文件">
          <FileUp className="h-4 w-4" />
        </Button>
        <span className="mx-1 h-5 w-px bg-border/60" />
        <Button variant="ghost" size="sm" onClick={onPreview} className="text-muted-foreground hover:text-foreground">
          <Eye className="mr-1 h-4 w-4" /> 预览
        </Button>
        <Button size="sm" onClick={onPublish} className="bg-primary text-primary-foreground hover:bg-primary/90">
          <Send className="mr-1 h-3.5 w-3.5" /> {isPublished ? '更新发布' : '发布'}
        </Button>
      </div>
    </header>
  );
}