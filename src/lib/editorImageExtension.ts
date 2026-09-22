import { Node, mergeAttributes } from '@tiptap/core';

export type ImageAlign = 'left' | 'center' | 'right';

export interface EditorImageOptions {
  HTMLAttributes: Record<string, unknown>;
  inline: boolean;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    editorImage: {
      setEditorImage: (options: { src: string; alt?: string; caption?: string; align?: ImageAlign }) => ReturnType;
    };
  }
}

export default Node.create<EditorImageOptions>({
  name: 'editorImage',
  group: 'block',
  atom: true,
  draggable: true,
  selectable: true,

  addOptions() {
    return {
      HTMLAttributes: {},
      inline: false,
    };
  },

  addAttributes() {
    return {
      src: { default: null },
      alt: { default: '' },
      caption: { default: '' },
      align: { default: 'center' as ImageAlign },
      width: { default: '100%' },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'figure[data-editor-image]',
        getAttrs: (el) => {
          const img = (el as HTMLElement).querySelector('img');
          const caption = (el as HTMLElement).querySelector('figcaption');
          return {
            src: img?.getAttribute('src') || null,
            alt: img?.getAttribute('alt') || '',
            caption: caption?.textContent || '',
            align: (el as HTMLElement).getAttribute('data-align') || 'center',
            width: img?.getAttribute('width') || '100%',
          };
        },
      },
      {
        tag: 'img[src]',
        getAttrs: (el) => ({
          src: (el as HTMLImageElement).getAttribute('src'),
          alt: (el as HTMLImageElement).getAttribute('alt') || '',
          caption: '',
          align: 'center',
          width: (el as HTMLImageElement).getAttribute('width') || '100%',
        }),
      },
    ];
  },

  renderHTML({ node, HTMLAttributes }) {
    const align = (node.attrs.align as ImageAlign) || 'center';
    const caption = (node.attrs.caption as string) || '';
    const width = (node.attrs.width as string) || '100%';

    const figureAttrs = mergeAttributes(this.options.HTMLAttributes, {
      'data-editor-image': '',
      'data-align': align,
      style: `width: ${width}; max-width: 100%;`,
    });

    const imgAttrs = mergeAttributes(HTMLAttributes, {
      src: node.attrs.src,
      alt: node.attrs.alt || '',
      style: 'width: 100%; height: auto; display: block; border-radius: 6px;',
    });

    const children: Array<unknown> = [['img', imgAttrs]];
    if (caption) {
      children.push(['figcaption', { style: 'text-align: center; font-size: 0.8rem; color: hsl(var(--muted-foreground)); margin-top: 0.5rem;' }, caption]);
    }

    return ['figure', figureAttrs, ...children] as never;
  },

  addCommands() {
    return {
      setEditorImage:
        (options) =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: {
              src: options.src,
              alt: options.alt || '',
              caption: options.caption || '',
              align: options.align || 'center',
              width: '100%',
            },
          });
        },
    };
  },
});