import { RefreshCw } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { useI18n } from '@/contexts/I18nContext';
import { listChapters, stampChapters, countUnstamped } from '@/lib/chapters';

interface Props {
  /** 编辑器里的实时正文 */
  content: string;
  value: string[];
  onChange: (next: string[]) => void;
  /** 扫描章节：把盖好编号的正文写回编辑器 */
  onStamp: (html: string) => void;
}

export default function PreviewChapterPicker({ content, value, onChange, onStamp }: Props) {
  const { t } = useI18n();
  const chapters = listChapters(content);
  const pending = countUnstamped(content);

  const toggle = (ch: string) => {
    onChange(value.includes(ch) ? value.filter((x) => x !== ch) : [...value, ch]);
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label className="font-mono-label text-xs uppercase tracking-wider text-muted-foreground">
          {t('免费试看章节', 'Free preview chapters')}
        </Label>
        {pending > 0 && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 gap-1.5 text-xs"
            onClick={() => onStamp(stampChapters(content))}
          >
            <RefreshCw className="h-3 w-3" />
            {t(`扫描 ${pending} 个新章节`, `Scan ${pending} new chapters`)}
          </Button>
        )}
      </div>

      {chapters.length === 0 ? (
        <p className="rounded-md border border-dashed border-border p-3 text-sm text-muted-foreground">
          {pending > 0
            ? t('正文里有章节还没编号，点右上角扫描一下。', 'Chapters found but not numbered yet — click Scan above.')
            : t('正文里还没有章节标题。用 H1 或 H2 分章后，这里会列出可勾选的章节。', 'No chapter headings yet. Add H1 or H2 headings to split the article into chapters.')}
        </p>
      ) : (
        <>
          <div className="max-h-52 space-y-1 overflow-y-auto rounded-md border border-border p-2">
            {chapters.map((c) => (
              <label
                key={c.ch}
                className="flex cursor-pointer items-start gap-2 rounded px-2 py-1.5 text-sm hover:bg-muted/60"
              >
                <Checkbox className="mt-0.5" checked={value.includes(c.ch)} onCheckedChange={() => toggle(c.ch)} />
                <span className="leading-snug">{c.text}</span>
              </label>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            {t(
              '勾选的章节，权限不够的用户也能看到正文；其余章节只显示标题。开头的引言始终可见。',
              'Checked chapters stay readable for users without access; the rest show titles only. The intro is always visible.',
            )}
          </p>
        </>
      )}
    </div>
  );
}
