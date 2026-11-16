// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { DISCUSSION_IMAGE_MISSING_MARKER, discussionBodyExcerpt, discussionBodyParts, prepareDiscussionPaste, replaceUnavailableDiscussionImages } from './discussionBody';

describe('discussion body images', () => {
  it('keeps pasted Feishu image placeholders at their original positions', () => {
    const html = '<p>第一步</p><p><img src="data:image/png;base64,AAA"></p><p>第二步</p><p><img src="https://example.com/second.png"></p>';
    const paste = prepareDiscussionPaste(html, '第一步\n[图片]\n第二步\n[图片]');
    expect(paste).toEqual({
      text: '第一步\n__QIHE_PASTED_IMAGE_0__\n第二步\n__QIHE_PASTED_IMAGE_1__',
      sources: ['data:image/png;base64,AAA', 'https://example.com/second.png'],
    });
  });

  it('uses HTML positions when plain text has no image placeholders', () => {
    expect(prepareDiscussionPaste('<p>之前<img src="https://example.com/a.png">之后</p>', '之前之后').text)
      .toBe('之前\n__QIHE_PASTED_IMAGE_0__\n之后');
  });

  it('replaces Feishu image-only placeholders when the clipboard has no image data', () => {
    const paste = prepareDiscussionPaste('', '步骤一\n[图片]\n步骤二\n[图片]');
    expect(paste.sources).toEqual([]);
    expect(replaceUnavailableDiscussionImages(paste.text)).toBe(
      `步骤一\n${DISCUSSION_IMAGE_MISSING_MARKER}\n步骤二\n${DISCUSSION_IMAGE_MISSING_MARKER}`,
    );
  });

  it('renders only image markers and keeps surrounding text', () => {
    const body = '之前\n![图片](https://example.com/a.png)\n之后';
    expect(discussionBodyParts(body)).toEqual([
      { type: 'text', value: '之前\n' },
      { type: 'image', value: 'https://example.com/a.png' },
      { type: 'text', value: '\n之后' },
    ]);
    expect(discussionBodyExcerpt(body)).toBe('之前\n[图片]\n之后');
  });

  it('renders inline video markers and replaces them in excerpts', () => {
    const body = '视频说明\n![视频](https://example.com/tutorial.mp4)\n补充说明';
    expect(discussionBodyParts(body)).toEqual([
      { type: 'text', value: '视频说明\n' },
      { type: 'video', value: 'https://example.com/tutorial.mp4' },
      { type: 'text', value: '\n补充说明' },
    ]);
    expect(discussionBodyExcerpt(body)).toBe('视频说明\n[视频]\n补充说明');
  });
});
