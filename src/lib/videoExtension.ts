import { Node, mergeAttributes, type RawCommands } from '@tiptap/core';

export interface VideoOptions {
  src: string;
  type?: string;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    video: {
      setVideo: (options: VideoOptions) => ReturnType;
    };
  }
}

export default Node.create({
  name: 'video',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: true,

  addAttributes() {
    return {
      src: { default: null },
      controls: { default: true },
      width: { default: '100%' },
      type: { default: 'video/mp4' },
    };
  },

  parseHTML() {
    return [
      { tag: 'video' },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ['video', mergeAttributes(HTMLAttributes, { controls: true, style: 'max-width:100%;' }), ['source', { src: HTMLAttributes.src, type: HTMLAttributes.type }]];
  },

  addNodeView() {
    return ({ node, editor }) => {
      const container = document.createElement('div');
      container.className = 'video-node relative';
      container.style.width = (node.attrs.width as string) || '100%';
      container.style.resize = 'horizontal';
      container.style.overflow = 'hidden';
      container.style.maxWidth = '100%';
      container.style.minWidth = '200px';

      const video = document.createElement('video');
      video.src = node.attrs.src as string;
      video.controls = true;
      video.style.width = '100%';
      video.style.height = 'auto';
      video.style.borderRadius = '8px';
      video.style.display = 'block';
      container.appendChild(video);

      const onResize = () => {
        const width = container.style.width;
        if (width && editor.isEditable) {
          editor.commands.updateAttributes('video', { width });
        }
      };

      const observer = new MutationObserver(() => {
        onResize();
      });
      observer.observe(container, { attributes: true, attributeFilter: ['style'] });

      return {
        dom: container,
        update: (updatedNode) => {
          if (updatedNode.attrs.src !== video.src) {
            video.src = updatedNode.attrs.src as string;
          }
          const newWidth = updatedNode.attrs.width as string;
          if (newWidth && container.style.width !== newWidth) {
            container.style.width = newWidth;
          }
          return true;
        },
        destroy: () => {
          observer.disconnect();
        },
      };
    };
  },

  addCommands() {
    return {
      setVideo: (options: VideoOptions) => ({ commands }: { commands: RawCommands }) => {
        return commands.insertContent({ type: this.name, attrs: { ...options, controls: true } });
      },
    } as unknown as Partial<RawCommands>;
  },
});
