import { Extension } from '@tiptap/core';

/**
 * 给标题保留 data-ch 属性（章节永久编号）。
 *
 * 为什么必须专门声明：ProseMirror 只保留 schema 里声明过的属性，没声明的一律丢弃。
 * 实测 <h2 data-ch="ch-abc123"> 过一遍编辑器会变成 <h2> —— 编号一丢，
 * 后台勾选的免费试看章节在下一次编辑后就全部失效。
 *
 * 用 addGlobalAttributes 而不是替换 Heading 扩展，是为了不引入新依赖，
 * 也不动 StarterKit 里标题的其它行为。
 */
export const ChapterHeading = Extension.create({
  name: 'chapterHeading',
  addGlobalAttributes() {
    return [
      {
        types: ['heading'],
        attributes: {
          ch: {
            default: null,
            parseHTML: (element) => element.getAttribute('data-ch'),
            renderHTML: (attributes) =>
              attributes.ch ? { 'data-ch': attributes.ch as string } : {},
          },
        },
      },
    ];
  },
});
