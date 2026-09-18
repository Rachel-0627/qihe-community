import { useEffect, useRef, useState } from 'react';
import { useEditor, EditorContent, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import ImageResize from 'tiptap-extension-resize-image';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import { TextStyle } from '@tiptap/extension-text-style';
import Color from '@tiptap/extension-color';
import Highlight from '@tiptap/extension-highlight';
import Placeholder from '@tiptap/extension-placeholder';
import FontFamily from '@tiptap/extension-font-family';
import { Markdown } from 'tiptap-markdown';
import * as pdfjsLib from 'pdfjs-dist';
import PdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.mjs?url';
import { importMarkdown, importDocx, importPdf, resolveImages, type ImportResult } from '@/lib/documentImport';

pdfjsLib.GlobalWorkerOptions.workerSrc = PdfWorkerUrl;
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough, Heading1, Heading2, Heading3,
  List, ListOrdered, Quote, Link as LinkIcon, Image as ImageIcon, Video, AlignLeft,
  AlignCenter, AlignRight, Undo, Redo, Code, Minus, Type, Highlighter, FileUp, Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { uploadMedia } from '@/lib/api';
import VideoExtension from '@/lib/videoExtension';

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  label?: string;
  uploadFolder?: string;
}

export default function RichTextEditor({ value, onChange, placeholder, label, uploadFolder }: RichTextEditorProps) {
  const importRef = useRef<HTMLInputElement>(null);
  const imageRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLInputElement>(null);
  const mdImagesRef = useRef<HTMLInputElement>(null);
  // 暂存缺图的 Markdown 原文，等用户补选图片后重新解析
  const pendingMarkdownRef = useRef<string | null>(null);
  const [linkUrl, setLinkUrl] = useState('');
  const [uploading, setUploading] = useState<{ image: boolean; video: boolean; import: boolean }>({ image: false, video: false, import: false });

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3, 4, 5, 6] } }),
      Underline,
      TextStyle,
      FontFamily,
      Color,
      Highlight.configure({ multicolor: true }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Link.configure({ openOnClick: false, autolink: true }),
      Image.configure({ inline: true, allowBase64: true }),
      ImageResize,
      VideoExtension,
      Placeholder.configure({ placeholder: placeholder || '开始写作…' }),
      Markdown.configure({ html: true }),
    ],
    content: value,
    onUpdate: ({ editor: e }) => {
      onChange(e.getHTML());
    },
  });

  useEffect(() => {
    if (editor && editor.getHTML() !== value) {
      editor.commands.setContent(value, { emitUpdate: false });
    }
  }, [value, editor]);

  const addLink = () => {
    if (!editor || !linkUrl) return;
    editor.chain().focus().extendMarkRange('link').setLink({ href: linkUrl }).run();
    setLinkUrl('');
  };

  const uploadAndInsertImage = async (file: File) => {
    if (!editor) return;
    setUploading((p) => ({ ...p, image: true }));
    try {
      const url = await uploadMedia(file, 'editor/images');
      editor.chain().focus().setImage({ src: url }).run();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '图片上传失败');
    } finally {
      setUploading((p) => ({ ...p, image: false }));
      if (imageRef.current) imageRef.current.value = '';
    }
  };

  const uploadAndInsertVideo = async (file: File) => {
    if (!editor) return;
    setUploading((p) => ({ ...p, video: true }));
    try {
      const url = await uploadMedia(file, 'editor/videos');
      editor.commands.setVideo({ src: url });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '视频上传失败');
    } finally {
      setUploading((p) => ({ ...p, video: false }));
      if (videoRef.current) videoRef.current.value = '';
    }
  };

  const handleImageFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast.error('请上传图片文件'); return; }
    uploadAndInsertImage(file);
  };

  const handleVideoFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('video/')) { toast.error('请上传视频文件'); return; }
    uploadAndInsertVideo(file);
  };

  /** 把导入结果写进编辑器，并根据缺图情况给出对应提示 */
  const applyImportResult = (result: ImportResult, sourceText?: string) => {
    if (!editor) return;
    editor.commands.setContent(result.content);
    onChange(editor.getHTML());

    if (result.failedUploads.length) {
      const list = [...new Set(result.failedUploads)].slice(0, 5).join('、');
      toast.error(`有 ${result.failedUploads.length} 张图片上传失败：${list}。请检查网络或重试。`, { duration: 8000 });
      return;
    }

    if (result.missingImages.length) {
      const names = [...new Set(result.missingImages)];
      // 缺的是本地图片 —— 让用户点一下就能补选，不必事先知道要多选
      pendingMarkdownRef.current = sourceText ?? null;
      toast.warning(`还差 ${names.length} 张图片：${names.slice(0, 5).join('、')}`, {
        duration: 15000,
        description: '这些图片在你的电脑上，浏览器需要你亲自选中才能读取。',
        action: pendingMarkdownRef.current
          ? { label: '选择这些图片', onClick: () => mdImagesRef.current?.click() }
          : undefined,
      });
      return;
    }

    toast.success(result.uploadedImages > 0 ? `导入成功，已上传 ${result.uploadedImages} 张图片` : '导入成功');
  };

  /** 用户补选图片后，拿原文重新解析一遍 */
  const handleMarkdownImages = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []).filter((f) => f.type.startsWith('image/'));
    const source = pendingMarkdownRef.current;
    if (!files.length || !source || !editor) return;
    setUploading((p) => ({ ...p, import: true }));
    try {
      const result = await resolveImages(source, uploadFolder || '', files);
      applyImportResult(result, source);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '图片处理失败');
    } finally {
      setUploading((p) => ({ ...p, import: false }));
      if (mdImagesRef.current) mdImagesRef.current.value = '';
    }
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length || !editor) return;

    // 允许一次选中「文档 + 它引用的图片」：文档取第一个非图片文件，其余当作图片素材
    const doc = files.find((f) => !f.type.startsWith('image/'));
    const sidecars = files.filter((f) => f.type.startsWith('image/'));
    if (!doc) {
      toast.error('请选择一个 Markdown、Word 或 PDF 文件');
      if (importRef.current) importRef.current.value = '';
      return;
    }

    setUploading((p) => ({ ...p, import: true }));
    try {
      const ext = doc.name.split('.').pop()?.toLowerCase() || '';
      const folder = uploadFolder || '';
      let result: ImportResult;

      if (ext === 'md' || ext === 'markdown' || doc.type === 'text/markdown') {
        result = await importMarkdown(doc, folder, sidecars);
      } else if (ext === 'docx' || doc.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
        result = await importDocx(doc, folder);
      } else if (ext === 'pdf' || doc.type === 'application/pdf') {
        result = await importPdf(doc, folder);
      } else {
        toast.error('仅支持 Markdown、Word、PDF 文件');
        return;
      }

      applyImportResult(result, result.isMarkdown ? result.content : undefined);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '文件导入失败');
    } finally {
      setUploading((p) => ({ ...p, import: false }));
      if (importRef.current) importRef.current.value = '';
    }
  };


  return (
    <TooltipProvider delayDuration={200}>
      <div className="space-y-2">
        {label && <Label className="font-mono-label text-xs uppercase tracking-wider text-muted-foreground">{label}</Label>}
        <div className="relative">
          <Toolbar
          editor={editor}
          onAddLink={addLink}
          linkUrl={linkUrl}
          setLinkUrl={setLinkUrl}
          onImageClick={() => imageRef.current?.click()}
          onVideoClick={() => videoRef.current?.click()}
          onImport={() => importRef.current?.click()}
          uploading={uploading}
        />
        <input ref={importRef} type="file" multiple accept=".md,.markdown,.docx,.pdf,image/*" onChange={handleImportFile} className="sr-only" />
        <input ref={imageRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={handleImageFile} className="sr-only" />
        <input ref={videoRef} type="file" accept="video/mp4,video/webm" onChange={handleVideoFile} className="sr-only" />
        <input ref={mdImagesRef} type="file" multiple accept="image/*" onChange={handleMarkdownImages} className="sr-only" />
        <div
          className="min-h-[240px] cursor-text rounded-b border border-border bg-card transition-colors focus-within:border-primary focus-within:ring-1 focus-within:ring-primary"
          onClick={() => editor?.chain().focus().run()}
        >
          <EditorContent editor={editor} className="prose prose-sm max-w-none px-4 py-3 focus:outline-none md:prose-base dark:prose-invert" />
        </div>
      </div>
    </div>
    </TooltipProvider>
  );
}

function Toolbar({
  editor,
  onAddLink,
  linkUrl,
  setLinkUrl,
  onImageClick,
  onVideoClick,
  onImport,
  uploading,
}: {
  editor: Editor | null;
  onAddLink: () => void;
  linkUrl: string;
  setLinkUrl: (v: string) => void;
  onImageClick: () => void;
  onVideoClick: () => void;
  onImport: () => void;
  uploading: { image: boolean; video: boolean; import: boolean };
}) {
  if (!editor) return null;

  const toggle = (name: string) => {
    const chain = editor.chain().focus();
    if (name === 'bold') chain.toggleBold().run();
    if (name === 'italic') chain.toggleItalic().run();
    if (name === 'underline') chain.toggleUnderline().run();
    if (name === 'strike') chain.toggleStrike().run();
    if (name === 'bulletList') chain.toggleBulletList().run();
    if (name === 'orderedList') chain.toggleOrderedList().run();
    if (name === 'blockquote') chain.toggleBlockquote().run();
    if (name === 'code') chain.toggleCode().run();
    if (name === 'codeBlock') chain.toggleCodeBlock().run();
    if (name === 'horizontalRule') chain.setHorizontalRule().run();
    if (name === 'h1') chain.toggleHeading({ level: 1 }).run();
    if (name === 'h2') chain.toggleHeading({ level: 2 }).run();
    if (name === 'h3') chain.toggleHeading({ level: 3 }).run();
    if (name === 'alignLeft') chain.setTextAlign('left').run();
    if (name === 'alignCenter') chain.setTextAlign('center').run();
    if (name === 'alignRight') chain.setTextAlign('right').run();
    if (name === 'toggleHighlight') chain.toggleHighlight().run();
  };

  const active = (name: string) => {
    if (name === 'bold') return editor.isActive('bold');
    if (name === 'italic') return editor.isActive('italic');
    if (name === 'underline') return editor.isActive('underline');
    if (name === 'strike') return editor.isActive('strike');
    if (name === 'bulletList') return editor.isActive('bulletList');
    if (name === 'orderedList') return editor.isActive('orderedList');
    if (name === 'blockquote') return editor.isActive('blockquote');
    if (name === 'code') return editor.isActive('code');
    if (name === 'h1') return editor.isActive('heading', { level: 1 });
    if (name === 'h2') return editor.isActive('heading', { level: 2 });
    if (name === 'h3') return editor.isActive('heading', { level: 3 });
    if (name === 'alignLeft') return editor.isActive({ textAlign: 'left' });
    if (name === 'alignCenter') return editor.isActive({ textAlign: 'center' });
    if (name === 'alignRight') return editor.isActive({ textAlign: 'right' });
    if (name === 'highlight') return editor.isActive('highlight');
    return false;
  };

  const setColor = (color: string) => editor.chain().focus().setColor(color).run();

  const setFontSize = (size: string) => {
    editor.chain().focus().setMark('textStyle', { fontSize: size }).run();
  };

  const clearFontSize = () => {
    editor.chain().focus().unsetMark('textStyle').run();
  };

  const setFontFamily = (family: string) => {
    editor.chain().focus().setFontFamily(family).run();
  };

  return (
    <div className="sticky top-0 z-10 flex flex-wrap items-center gap-1 rounded-t border border-b-0 border-border bg-muted/90 px-2 py-2 backdrop-blur">
      <ToolButton onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} icon={<Undo className="h-3.5 w-3.5" />} title="撤销" />
      <ToolButton onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} icon={<Redo className="h-3.5 w-3.5" />} title="重做" />
      <Divider />
      <ToolButton active={active('h1')} onClick={() => toggle('h1')} icon={<Heading1 className="h-3.5 w-3.5" />} title="标题 1" />
      <ToolButton active={active('h2')} onClick={() => toggle('h2')} icon={<Heading2 className="h-3.5 w-3.5" />} title="标题 2" />
      <ToolButton active={active('h3')} onClick={() => toggle('h3')} icon={<Heading3 className="h-3.5 w-3.5" />} title="标题 3" />
      <Divider />
      <Select value="" onValueChange={(v) => v && setFontSize(v)}>
        <SelectTrigger className="h-8 w-20 px-2 text-xs" aria-label="字号">
          <span>字号</span>
        </SelectTrigger>
        <SelectContent>
          {['12px', '14px', '16px', '18px', '20px', '24px', '28px', '32px', '48px'].map((s) => (
            <SelectItem key={s} value={s}>{s}</SelectItem>
          ))}
          <SelectItem value="clear">清除</SelectItem>
        </SelectContent>
      </Select>
      <Select value="" onValueChange={(v) => v && (v === 'clear' ? clearFontSize() : setFontFamily(v))}>
        <SelectTrigger className="h-8 w-24 px-2 text-xs" aria-label="字体">
          <span>字体</span>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="sans-serif"> sans-serif</SelectItem>
          <SelectItem value="serif">serif</SelectItem>
          <SelectItem value="monospace">monospace</SelectItem>
          <SelectItem value="clear">清除</SelectItem>
        </SelectContent>
      </Select>
      <Divider />
      <ToolButton active={active('bold')} onClick={() => toggle('bold')} icon={<Bold className="h-3.5 w-3.5" />} title="加粗" />
      <ToolButton active={active('italic')} onClick={() => toggle('italic')} icon={<Italic className="h-3.5 w-3.5" />} title="斜体" />
      <ToolButton active={active('underline')} onClick={() => toggle('underline')} icon={<UnderlineIcon className="h-3.5 w-3.5" />} title="下划线" />
      <ToolButton active={active('strike')} onClick={() => toggle('strike')} icon={<Strikethrough className="h-3.5 w-3.5" />} title="删除线" />
      <ToolButton active={active('code')} onClick={() => toggle('code')} icon={<Code className="h-3.5 w-3.5" />} title="行内代码" />
      <ToolButton active={active('highlight')} onClick={() => toggle('toggleHighlight')} icon={<Highlighter className="h-3.5 w-3.5" />} title="高亮" />
      <Divider />
      <Popover>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <Button type="button" variant="ghost" size="icon" className="h-8 w-8" title="字体颜色">
                <Type className="h-3.5 w-3.5" />
              </Button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">字体颜色</TooltipContent>
        </Tooltip>
        <PopoverContent className="w-auto p-2">
          <div className="grid grid-cols-5 gap-1">
            {['#ecebe7', '#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#3b82f6', '#a855f7', '#ec4899', '#8b8f96'].map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className="h-6 w-6 rounded-full border border-border"
                style={{ backgroundColor: c }}
                aria-label={`color ${c}`}
              />
            ))}
          </div>
          <Button type="button" variant="ghost" size="sm" className="mt-2 w-full" onClick={() => editor.chain().focus().unsetColor().run()}>清除颜色</Button>
        </PopoverContent>
      </Popover>
      <Divider />
      <ToolButton active={active('alignLeft')} onClick={() => toggle('alignLeft')} icon={<AlignLeft className="h-3.5 w-3.5" />} title="左对齐" />
      <ToolButton active={active('alignCenter')} onClick={() => toggle('alignCenter')} icon={<AlignCenter className="h-3.5 w-3.5" />} title="居中对齐" />
      <ToolButton active={active('alignRight')} onClick={() => toggle('alignRight')} icon={<AlignRight className="h-3.5 w-3.5" />} title="右对齐" />
      <Divider />
      <ToolButton active={active('bulletList')} onClick={() => toggle('bulletList')} icon={<List className="h-3.5 w-3.5" />} title="无序列表" />
      <ToolButton active={active('orderedList')} onClick={() => toggle('orderedList')} icon={<ListOrdered className="h-3.5 w-3.5" />} title="有序列表" />
      <ToolButton active={active('blockquote')} onClick={() => toggle('blockquote')} icon={<Quote className="h-3.5 w-3.5" />} title="引用" />
      <ToolButton onClick={() => toggle('codeBlock')} icon={<Code className="h-3.5 w-3.5" />} title="代码块" />
      <ToolButton onClick={() => toggle('horizontalRule')} icon={<Minus className="h-3.5 w-3.5" />} title="分隔线" />
      <Divider />
      <Popover>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <Button type="button" variant="ghost" size="icon" className="h-8 w-8" title="插入链接">
                <LinkIcon className="h-3.5 w-3.5" />
              </Button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">插入链接</TooltipContent>
        </Tooltip>
        <PopoverContent className="w-56 space-y-2">
          <Label className="font-mono-label text-xs">链接 URL</Label>
          <Input value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} placeholder="https://" className="px-2 text-sm" />
          <div className="flex gap-1">
            <Button size="sm" className="flex-1" onClick={onAddLink}>插入</Button>
            <Button size="sm" variant="outline" onClick={() => editor.chain().focus().unsetLink().run()}>清除</Button>
          </div>
        </PopoverContent>
      </Popover>
      <ToolButton onClick={onImageClick} icon={uploading.image ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImageIcon className="h-3.5 w-3.5" />} title="上传图片" />
      <ToolButton onClick={onVideoClick} icon={uploading.video ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Video className="h-3.5 w-3.5" />} title="上传视频" />
      <Divider />
      <Tooltip>
        <TooltipTrigger asChild>
          <Button type="button" variant="ghost" size="sm" className="gap-1 font-mono-label text-xs" onClick={onImport} disabled={uploading.import}>
            {uploading.import ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileUp className="h-3.5 w-3.5" />}
            导入文件
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">导入 Markdown / Word / PDF</TooltipContent>
      </Tooltip>
    </div>
  );
}

function ToolButton({ onClick, icon, active, disabled, title }: { onClick: () => void; icon: React.ReactNode; active?: boolean; disabled?: boolean; title?: string }) {
  const button = (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cn('h-8 w-8', active && 'bg-accent text-accent-foreground')}
    >
      {icon}
    </Button>
  );
  if (!title) return button;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{button}</TooltipTrigger>
      <TooltipContent side="bottom" className="text-xs">{title}</TooltipContent>
    </Tooltip>
  );
}

function Divider() {
  return <div className="mx-1 h-4 w-px bg-border" />;
}
