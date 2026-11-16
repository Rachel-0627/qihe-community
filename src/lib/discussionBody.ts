const mediaPattern = /!\[(图片|视频)\]\((https?:\/\/[^\s)]+)\)/g;
export const DISCUSSION_IMAGE_MISSING_MARKER = '【图片未导入，请补传】';

export function replaceUnavailableDiscussionImages(body: string): string {
  return body.replace(/\[图片\]/g, DISCUSSION_IMAGE_MISSING_MARKER);
}

export function discussionBodyParts(body: string): Array<{ type: 'text' | 'image' | 'video'; value: string }> {
  const parts: Array<{ type: 'text' | 'image' | 'video'; value: string }> = [];
  let last = 0;
  for (const match of body.matchAll(mediaPattern)) {
    const index = match.index ?? 0;
    if (index > last) parts.push({ type: 'text', value: body.slice(last, index) });
    parts.push({ type: match[1] === '视频' ? 'video' : 'image', value: match[2] });
    last = index + match[0].length;
  }
  if (last < body.length) parts.push({ type: 'text', value: body.slice(last) });
  return parts;
}

export function discussionBodyExcerpt(body: string): string {
  return body.replace(mediaPattern, (_match, type: string) => type === '视频' ? '[视频]' : '[图片]');
}

export function prepareDiscussionPaste(html: string, plain: string): { text: string; sources: string[] } {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const images = Array.from(doc.body.querySelectorAll('img'));
  const sources = images.map((img) => img.getAttribute('src') || img.getAttribute('data-src') || img.getAttribute('data-original') || '');
  if (images.length === 0) return { text: plain, sources: [] };

  const token = (index: number) => `__QIHE_PASTED_IMAGE_${index}__`;
  const placeholders = plain.match(/\[图片\]/g)?.length ?? 0;
  if (placeholders >= images.length) {
    let index = 0;
    return { text: plain.replace(/\[图片\]/g, (value) => index < images.length ? token(index++) : value), sources };
  }

  // Some editors provide HTML images without matching placeholders in text/plain.
  const blocks = new Set(['P', 'DIV', 'LI', 'H1', 'H2', 'H3', 'H4', 'BLOCKQUOTE', 'SECTION', 'TR']);
  let output = '';
  const newline = () => { if (output && !output.endsWith('\n')) output += '\n'; };
  const walk = (node: Node): void => {
    if (node.nodeType === Node.TEXT_NODE) { output += node.textContent ?? ''; return; }
    if (!(node instanceof Element)) return;
    if (node.tagName === 'IMG') { newline(); output += token(images.indexOf(node as HTMLImageElement)); newline(); return; }
    if (node.tagName === 'BR') { output += '\n'; return; }
    if (blocks.has(node.tagName)) newline();
    for (const child of Array.from(node.childNodes)) walk(child);
    if (blocks.has(node.tagName)) newline();
  };
  for (const child of Array.from(doc.body.childNodes)) walk(child);
  return { text: output.replace(/\n{3,}/g, '\n\n').trim(), sources };
}
