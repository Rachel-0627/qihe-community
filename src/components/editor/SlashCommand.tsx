import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import type { Editor } from '@tiptap/react';
import type { SuggestionProps } from '@tiptap/suggestion';
import { slashItems, type SlashItem } from '@/lib/editorSlashItems';

export interface SlashCommandRef {
  onKeyDown: (e: KeyboardEvent) => boolean;
}

const SlashCommand = forwardRef<SlashCommandRef, SuggestionProps<SlashItem>>((props, ref) => {
  const { query, command } = props;
  const [selectedIndex, setSelectedIndex] = useState(0);

  const items = useMemo(() => {
    const q = query.toLowerCase();
    if (!q) return slashItems;
    return slashItems.filter(
      (item) => item.title.toLowerCase().includes(q) || item.keywords.some((k) => k.includes(q))
    );
  }, [query]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  const selectItem = (index: number) => {
    const item = items[index];
    if (item) command(item);
  };

  useImperativeHandle(ref, () => ({
    onKeyDown: (e: KeyboardEvent) => {
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((i) => (i - 1 + items.length) % items.length);
        return true;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((i) => (i + 1) % items.length);
        return true;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        selectItem(selectedIndex);
        return true;
      }
      return false;
    },
  }));

  const listRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-index="${selectedIndex}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  if (items.length === 0) {
    return (
      <div className="w-64 rounded-lg border border-border bg-popover p-3 text-sm text-muted-foreground shadow-lg">
        未找到匹配项
      </div>
    );
  }

  return (
    <div ref={listRef} className="w-64 max-h-72 overflow-y-auto rounded-lg border border-border bg-popover py-1.5 shadow-lg">
      {items.map((item, index) => {
        const Icon = item.icon;
        return (
          <button
            key={item.title}
            type="button"
            data-index={index}
            onClick={() => selectItem(index)}
            onMouseEnter={() => setSelectedIndex(index)}
            className={`flex w-full items-center gap-3 px-3 py-2 text-left transition-colors ${
              index === selectedIndex ? 'bg-primary/15 text-foreground' : 'text-foreground'
            }`}
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted">
              <Icon className="h-4 w-4 text-muted-foreground" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">{item.title}</span>
              <span className="block truncate text-xs text-muted-foreground">{item.description}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
});

SlashCommand.displayName = 'SlashCommand';

export default SlashCommand;