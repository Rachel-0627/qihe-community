import type { Editor } from '@tiptap/react';
import {
  Type,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
  Image as ImageIcon,
  Video,
  Code2,
  Minus,
  FileText,
} from 'lucide-react';

export interface SlashItem {
  title: string;
  description: string;
  keywords: string[];
  icon: React.ComponentType<{ className?: string }>;
  action: (editor: Editor) => void;
}

export const slashItems: SlashItem[] = [
  {
    title: '正文',
    description: '普通段落文本',
    keywords: ['正文', 'paragraph', 'text', 'p'],
    icon: Type,
    action: (editor) => editor.chain().focus().setParagraph().run(),
  },
  {
    title: '二级标题',
    description: '大标题 H2',
    keywords: ['标题', 'heading', 'h2', 'title'],
    icon: Heading2,
    action: (editor) => editor.chain().focus().toggleHeading({ level: 2 }).run(),
  },
  {
    title: '三级标题',
    description: '小标题 H3',
    keywords: ['标题', 'heading', 'h3', 'title'],
    icon: Heading3,
    action: (editor) => editor.chain().focus().toggleHeading({ level: 3 }).run(),
  },
  {
    title: '无序列表',
    description: '项目符号列表',
    keywords: ['列表', 'bullet', 'list', 'ul'],
    icon: List,
    action: (editor) => editor.chain().focus().toggleBulletList().run(),
  },
  {
    title: '有序列表',
    description: '编号列表',
    keywords: ['列表', 'ordered', 'list', 'ol', 'number'],
    icon: ListOrdered,
    action: (editor) => editor.chain().focus().toggleOrderedList().run(),
  },
  {
    title: '引用',
    description: '突出引用文字',
    keywords: ['引用', 'quote', 'blockquote'],
    icon: Quote,
    action: (editor) => editor.chain().focus().toggleBlockquote().run(),
  },
  {
    title: '图片',
    description: '上传或粘贴图片',
    keywords: ['图片', 'image', 'picture', 'img', 'photo'],
    icon: ImageIcon,
    action: () => window.dispatchEvent(new CustomEvent('editor-insert-image')),
  },
  {
    title: '视频',
    description: '插入视频',
    keywords: ['视频', 'video', 'movie'],
    icon: Video,
    action: () => window.dispatchEvent(new CustomEvent('editor-insert-video')),
  },
  {
    title: '代码块',
    description: '插入代码块',
    keywords: ['代码', 'code', 'block', 'pre'],
    icon: Code2,
    action: (editor) => editor.chain().focus().toggleCodeBlock().run(),
  },
  {
    title: '分割线',
    description: '内容分隔',
    keywords: ['分割线', 'divider', 'hr', 'line'],
    icon: Minus,
    action: (editor) => editor.chain().focus().setHorizontalRule().run(),
  },
  {
    title: '导入文件',
    description: '从 Markdown / Word / PDF 导入',
    keywords: ['导入', '文件', 'import', 'file', 'word', 'pdf', 'markdown'],
    icon: FileText,
    action: () => window.dispatchEvent(new CustomEvent('editor-import-file')),
  },
];