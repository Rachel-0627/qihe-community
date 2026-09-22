import { useState } from 'react';
import type { Editor } from '@tiptap/react';
import { BubbleMenu as TiptapBubbleMenu } from '@tiptap/react/menus';
import { Bold, Italic, Link2, Quote, Code, Heading2, Heading3, Type, MoreHorizontal, Strikethrough, Highlighter, AlignLeft, AlignCenter, AlignRight, Trash2 } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

interface BubbleMenuProps {
  editor: Editor;
}

function ToolButton({
  active,
  onClick,
  title,
  children,
}: {
  active?: boolean;
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={cn(
        'flex h-8 w-8 items-center justify-center rounded text-sm transition-colors',
        active ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
      )}
    >
      {children}
    </button>
  );
}

export default function BubbleMenu({ editor }: BubbleMenuProps) {
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');

  const openLink = () => {
    const prev = editor.getAttributes('link').href || '';
    setLinkUrl(prev);
    setLinkOpen(true);
  };

  const applyLink = () => {
    const url = linkUrl.trim();
    if (url) {
      editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
    } else {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
    }
    setLinkOpen(false);
  };

  const isImageSelected = editor.isActive('editorImage');

  return (
    <TiptapBubbleMenu
      editor={editor}
      options={{ placement: 'top', offset: { mainAxis: 8 } }}
      shouldShow={({ editor: e, from, to }) => {
        if (isImageSelected) return true;
        if (from === to) return false;
        return !e.isActive('codeBlock');
      }}
    >
      <div className="flex items-center gap-0.5 rounded-lg border border-border bg-popover px-1 py-1 shadow-lg">
        {isImageSelected ? (
          <>
            <ToolButton title="左对齐" onClick={() => editor.chain().focus().updateAttributes('editorImage', { align: 'left' }).run()}>
              <AlignLeft className="h-4 w-4" />
            </ToolButton>
            <ToolButton title="居中" active={editor.isActive('editorImage', { align: 'center' })} onClick={() => editor.chain().focus().updateAttributes('editorImage', { align: 'center' }).run()}>
              <AlignCenter className="h-4 w-4" />
            </ToolButton>
            <ToolButton title="右对齐" onClick={() => editor.chain().focus().updateAttributes('editorImage', { align: 'right' }).run()}>
              <AlignRight className="h-4 w-4" />
            </ToolButton>
            <span className="mx-0.5 h-5 w-px bg-border" />
            <ToolButton title="删除图片" onClick={() => editor.chain().focus().deleteSelection().run()}>
              <Trash2 className="h-4 w-4 text-destructive" />
            </ToolButton>
          </>
        ) : (
          <>
            <ToolButton title="正文" active={editor.isActive('paragraph')} onClick={() => editor.chain().focus().setParagraph().run()}>
              <Type className="h-4 w-4" />
            </ToolButton>
            <ToolButton title="二级标题" active={editor.isActive('heading', { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
              <Heading2 className="h-4 w-4" />
            </ToolButton>
            <ToolButton title="三级标题" active={editor.isActive('heading', { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>
              <Heading3 className="h-4 w-4" />
            </ToolButton>
            <span className="mx-0.5 h-5 w-px bg-border" />
            <ToolButton title="粗体" active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()}>
              <Bold className="h-4 w-4" />
            </ToolButton>
            <ToolButton title="斜体" active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()}>
              <Italic className="h-4 w-4" />
            </ToolButton>
            <ToolButton title="引用" active={editor.isActive('blockquote')} onClick={() => editor.chain().focus().toggleBlockquote().run()}>
              <Quote className="h-4 w-4" />
            </ToolButton>
            <ToolButton title="行内代码" active={editor.isActive('code')} onClick={() => editor.chain().focus().toggleCode().run()}>
              <Code className="h-4 w-4" />
            </ToolButton>
            <Popover open={linkOpen} onOpenChange={setLinkOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  title="链接"
                  onClick={openLink}
                  className={cn(
                    'flex h-8 w-8 items-center justify-center rounded text-sm transition-colors',
                    editor.isActive('link') ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  )}
                >
                  <Link2 className="h-4 w-4" />
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-64 p-2" side="bottom" align="center">
                <div className="flex items-center gap-2">
                  <input
                    autoFocus
                    value={linkUrl}
                    onChange={(e) => setLinkUrl(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        applyLink();
                      }
                    }}
                    placeholder="https://"
                    className="h-8 flex-1 min-w-0 rounded border border-input bg-background px-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                  <button type="button" onClick={applyLink} className="h-8 shrink-0 rounded bg-primary px-3 text-xs font-medium text-primary-foreground hover:bg-primary/90">
                    应用
                  </button>
                </div>
              </PopoverContent>
            </Popover>
            <Popover>
              <PopoverTrigger asChild>
                <button type="button" title="更多" className="flex h-8 w-8 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
                  <MoreHorizontal className="h-4 w-4" />
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-40 p-1" side="bottom" align="end">
                <button type="button" onClick={() => editor.chain().focus().toggleStrike().run()} className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm text-foreground hover:bg-muted">
                  <Strikethrough className="h-4 w-4" /> 删除线
                </button>
                <button type="button" onClick={() => editor.chain().focus().toggleHighlight().run()} className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm text-foreground hover:bg-muted">
                  <Highlighter className="h-4 w-4" /> 高亮
                </button>
              </PopoverContent>
            </Popover>
          </>
        )}
      </div>
    </TiptapBubbleMenu>
  );
}