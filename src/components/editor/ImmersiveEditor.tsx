import { forwardRef, useCallback, useEffect, useImperativeHandle, useState } from 'react';
import { useEditor, EditorContent, ReactRenderer } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Underline from '@tiptap/extension-underline';
import Highlight from '@tiptap/extension-highlight';
import Placeholder from '@tiptap/extension-placeholder';
import { TextStyle } from '@tiptap/extension-text-style';

import { SlashCommand } from '@/lib/editorSlashCommand';
import EditorImageExtension from '@/lib/editorImageExtension';
import VideoExtension from '@/lib/videoExtension';
import SlashCommandMenu from '@/components/editor/SlashCommand';
import BubbleMenu from '@/components/editor/BubbleMenu';
import { uploadMedia } from '@/lib/api';
import { toast } from 'sonner';

interface ImmersiveEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  uploadFolder: string;
  uploadId?: string;
  onImportFile?: () => void;
}

export default forwardRef<ImmersiveEditorApi, ImmersiveEditorProps>(function ImmersiveEditor(
  { value, onChange, placeholder = '输入 / 插入内容块，或直接开始写作…', uploadFolder, uploadId, onImportFile },
  ref
) {
  const [uploading, setUploading] = useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        codeBlock: { HTMLAttributes: { class: 'immersive-codeblock' } },
      }),
      Link.configure({ openOnClick: false, HTMLAttributes: { class: 'immersive-link' } }),
      Underline,
      Highlight,
      TextStyle,
      Placeholder.configure({ placeholder }),
      EditorImageExtension,
      VideoExtension,
      SlashCommand.configure({
        suggestion: {
          char: '/',
          items: () => [],
          render: () => {
            let reactRenderer: ReactRenderer | null = null;
            let unmount: (() => void) | null = null;
            return {
              onStart: (props) => {
                reactRenderer = new ReactRenderer(SlashCommandMenu, { props, editor: props.editor });
                unmount = props.mount(reactRenderer.element);
              },
              onUpdate: (props) => {
                reactRenderer?.updateProps(props);
              },
              onKeyDown: (props) => {
                if (props.event.key === 'Escape') {
                  return true;
                }
                return (reactRenderer?.ref as { onKeyDown?: (e: KeyboardEvent) => boolean } | null)?.onKeyDown?.(props.event) ?? false;
              },
              onExit: () => {
                unmount?.();
                reactRenderer?.destroy();
                reactRenderer = null;
                unmount = null;
              },
            };
          },
        },
      }),
    ],
    content: value,
    onUpdate: ({ editor: e }) => onChange(e.getHTML()),
    editorProps: {
      attributes: {
        class: 'immersive-prose prose prose-lg max-w-none dark:prose-invert focus:outline-none',
      },
      handleDrop: (view, event) => {
        const files = event.dataTransfer?.files;
        if (!files || files.length === 0) return false;
        const imageFile = Array.from(files).find((f) => f.type.startsWith('image/'));
        if (!imageFile) return false;
        event.preventDefault();
        insertImage(imageFile);
        return true;
      },
      handlePaste: (view, event) => {
        const items = event.clipboardData?.items;
        if (!items) return false;
        const imageItem = Array.from(items).find((i) => i.type.startsWith('image/'));
        if (!imageItem) return false;
        const file = imageItem.getAsFile();
        if (!file) return false;
        event.preventDefault();
        insertImage(file);
        return true;
      },
    },
  });

  // 外部 value 变化（如切换语言）时同步编辑器内容
  useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      editor.commands.setContent(value || '', { emitUpdate: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const insertImage = useCallback(
    async (file: File) => {
      if (!editor) return;
      setUploading(true);
      try {
        const url = await uploadMedia(file, uploadFolder, uploadId);
        editor.chain().focus().setEditorImage({ src: url, alt: file.name }).run();
        toast.success('图片已插入');
      } catch (err) {
        toast.error(err instanceof Error ? err.message : '图片上传失败');
      } finally {
        setUploading(false);
      }
    },
    [editor, uploadFolder, uploadId]
  );

  const insertVideo = useCallback(
    async (file: File) => {
      if (!editor) return;
      setUploading(true);
      try {
        const url = await uploadMedia(file, uploadFolder, uploadId);
        editor.chain().focus().setVideo({ src: url }).run();
        toast.success('视频已插入');
      } catch (err) {
        toast.error(err instanceof Error ? err.message : '视频上传失败');
      } finally {
        setUploading(false);
      }
    },
    [editor, uploadFolder, uploadId]
  );

  // 暴露命令给父组件（图片/视频/文件导入/撤销重做）
  useImperativeHandle(ref, () => ({
    insertImage,
    insertVideo,
    getHTML: () => editor?.getHTML() ?? '',
    setHTML: (html: string) => editor?.commands.setContent(html, { emitUpdate: false }),
    undo: () => editor?.chain().focus().undo().run(),
    redo: () => editor?.chain().focus().redo().run(),
  }), [editor, insertImage, insertVideo]);

  // 监听 Slash 菜单发出的图片/视频/导入事件
  useEffect(() => {
    const pickImage = () => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.onchange = (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (file) insertImage(file);
      };
      input.click();
    };
    const pickVideo = () => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'video/*';
      input.onchange = (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (file) insertVideo(file);
      };
      input.click();
    };
    const onImport = () => onImportFile?.();
    window.addEventListener('editor-insert-image', pickImage);
    window.addEventListener('editor-insert-video', pickVideo);
    window.addEventListener('editor-import-file', onImport);
    return () => {
      window.removeEventListener('editor-insert-image', pickImage);
      window.removeEventListener('editor-insert-video', pickVideo);
      window.removeEventListener('editor-import-file', onImport);
    };
  }, [insertImage, insertVideo, onImportFile]);

  return (
    <div className="relative">
      {uploading && (
        <div className="pointer-events-none absolute right-0 top-0 z-10 rounded bg-popover/90 px-2 py-1 text-xs text-muted-foreground">
          上传中…
        </div>
      )}
      {editor && <BubbleMenu editor={editor} />}
      <EditorContent editor={editor} />
    </div>
  );
});

export type ImmersiveEditorApi = {
  insertImage: (file: File) => void;
  insertVideo: (file: File) => void;
  getHTML: () => string;
  setHTML: (html: string) => void;
  undo: () => void;
  redo: () => void;
};