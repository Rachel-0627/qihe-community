import { Node, mergeAttributes } from '@tiptap/core';

/**
 * 提示词块。
 *
 * 为什么不直接用代码块：代码块是等宽字体加深色底，中文提示词放进去很难读；
 * 更要紧的是语义——以后给提示词加「一键运行」时，必须能把它和真正的代码分开，
 * 所以这里单独立一个节点，存成 <div data-prompt>。
 *
 * 存的是普通 HTML，不依赖数据库结构，老内容不受影响。
 */

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    promptBlock: {
      setPromptBlock: () => ReturnType;
    };
  }
}

export default Node.create({
  name: 'promptBlock',
  group: 'block',
  // 里面放普通段落，用户可以正常换行、写多段提示词
  content: 'block+',
  defining: true,

  parseHTML() {
    return [{ tag: 'div[data-prompt]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, { 'data-prompt': 'true', class: 'prompt-block' }),
      0,
    ];
  },

  addCommands() {
    return {
      setPromptBlock:
        () =>
        ({ commands }) =>
          commands.wrapIn(this.name),
    };
  },

  addKeyboardShortcuts() {
    return {
      // 在块的末尾连按两次回车跳出去，否则写完提示词会困在块里出不来
      Enter: ({ editor }) => {
        if (!editor.isActive(this.name)) return false;
        const { state } = editor;
        const { $from, empty } = state.selection;
        if (!empty || $from.parent.content.size > 0) return false;
        return editor.chain().liftEmptyBlock().run();
      },
    };
  },
});
