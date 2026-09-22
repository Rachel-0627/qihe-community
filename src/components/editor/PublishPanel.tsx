import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import FileUploadField from '@/components/common/FileUploadField';
import type { Category } from '@/types/types';

interface PublishPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lang: 'zh' | 'en';
  title: string;
  summary: string;
  coverUrl: string;
  categoryId: string | null;
  showOnHome: boolean;
  author: string;
  categories: Category[];
  onChange: (patch: Partial<{
    title: string;
    summary: string;
    coverUrl: string;
    categoryId: string | null;
    showOnHome: boolean;
    author: string;
  }>) => void;
  onConfirm: () => void;
  isPublished: boolean;
  caseId?: string;
}

export default function PublishPanel({
  open,
  onOpenChange,
  lang,
  title,
  summary,
  coverUrl,
  categoryId,
  showOnHome,
  author,
  categories,
  onChange,
  onConfirm,
  isPublished,
  caseId,
}: PublishPanelProps) {
  const label = lang === 'en' ? 'en' : 'zh';
  const catLabel = (c: Category) => (label === 'en' && c.name_en ? c.name_en : c.name);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full max-w-[calc(100%-2rem)] overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="font-display text-lg">{isPublished ? '更新发布' : '发布设置'}</SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-5">
          <div className="space-y-1.5">
            <Label className="font-mono-label text-xs uppercase tracking-wider text-muted-foreground">封面图</Label>
            <FileUploadField
              label="封面"
              value={coverUrl}
              onChange={(url) => onChange({ coverUrl: url })}
              folder="cases"
              id={caseId}
              preview="image"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="pub-summary" className="font-mono-label text-xs uppercase tracking-wider text-muted-foreground">
              摘要
            </Label>
            <Textarea
              id="pub-summary"
              value={summary}
              onChange={(e) => onChange({ summary: e.target.value })}
              placeholder="一句话介绍这篇案例…"
              rows={3}
              className="px-3"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="font-mono-label text-xs uppercase tracking-wider text-muted-foreground">分类</Label>
            <Select value={categoryId || 'none'} onValueChange={(v) => onChange({ categoryId: v === 'none' ? null : v })}>
              <SelectTrigger>
                <SelectValue placeholder="选择分类" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">未分类</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {catLabel(c)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="pub-author" className="font-mono-label text-xs uppercase tracking-wider text-muted-foreground">
              作者
            </Label>
            <Input id="pub-author" value={author} onChange={(e) => onChange({ author: e.target.value })} placeholder="作者名称" className="px-3" />
          </div>

          <div className="flex items-center justify-between rounded-md border border-border/50 px-3 py-2.5">
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground">首页展示</p>
              <p className="text-xs text-muted-foreground">在首页案例板块中展示</p>
            </div>
            <Switch checked={showOnHome} onCheckedChange={(v) => onChange({ showOnHome: v })} />
          </div>
        </div>

        <SheetFooter className="mt-8">
          <Button onClick={onConfirm} className="w-full bg-primary text-primary-foreground hover:bg-primary/90">
            {isPublished ? '确认更新' : '确认发布'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}