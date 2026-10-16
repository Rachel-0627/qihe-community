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
      /**
       * 气泡菜单的按钮会显示激活态，所以再点一次要能取消。
       *
       * 两个坑：
       * 1. 不能用 toggleWrap —— 整段全选时它判断不出已在块里，会再套一层；
       * 2. 取消时不能直接 lift —— 光标只在某一段里，那样只会把这一段提出来，
       *    块里其余段落还留在原处。所以先把选区撑满整个块，再整体提出。
       */
      setPromptBlock:
        () =>
        ({ state, chain, editor }) => {
          if (!editor.isActive(this.name)) {
            return chain().wrapIn(this.name).run();
          }
          const { $from } = state.selection;
          for (let depth = $from.depth; depth > 0; depth--) {
            if ($from.node(depth).type.name === this.name) {
              // 端点各往里收一格：块的边界本身装的是段落而不是文字，
              // 选区正好落在边界上，ProseMirror 会报 "not pointing into
              // a node with inline content"
              return chain()
                .setTextSelection({ from: $from.start(depth) + 1, to: $from.end(depth) - 1 })
                .lift(this.name)
                .run();
            }
          }
          return false;
        },
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
