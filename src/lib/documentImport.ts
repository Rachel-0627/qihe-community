// 文档导入：把 Markdown / Word / PDF 转成编辑器可用的 HTML，并把其中的图片
// 上传到对象存储，替换为公网 URL。
//
// 为什么需要单独处理图片：
//   · Markdown 里的图片多为本地相对路径（![](images/a.png)），浏览器无权读取
//     .md 文件旁边的文件，必须让用户把图片一起选中，再按文件名匹配。
//   · PDF 的 getTextContent() 只返回文字，图片要靠 getOperatorList() +
//     page.objs 才能取到（实测可拿到原始分辨率的 ImageBitmap）。
//   · Word 由 mammoth 转出的图片是 base64 data URI，直接存库会撑爆字段。

import * as mammoth from 'mammoth';
import * as pdfjsLib from 'pdfjs-dist';
import { uploadMedia } from '@/lib/api';

export interface ImportResult {
  /** 可直接交给编辑器的内容（Markdown 或 HTML，见 isMarkdown） */
  content: string;
  isMarkdown: boolean;
  /** 引用了本地图片但没提供对应文件 —— 用户没选中 */
  missingImages: string[];
  /** 找到了文件但上传失败 —— 网络或权限问题 */
  failedUploads: string[];
  /** 成功上传的图片数量 */
  uploadedImages: number;
}

/** 收集内容里所有「本地图片」引用（排除 http 与 data URI），用于提示用户需要补哪些文件 */
export function collectLocalImageRefs(text: string): string[] {
  const sources = new Set<string>();
  for (const m of text.matchAll(/!\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)) sources.add(m[1]);
  for (const m of text.matchAll(/<img[^>]+src=["']([^"']+)["']/gi)) sources.add(m[1]);
  return [...sources]
    .filter((src) => !/^https?:\/\//i.test(src) && !src.startsWith('data:'))
    .map((src) => basename(src))
    .filter(Boolean);
}

const MIN_IMAGE_SIDE = 80; // 小于此尺寸的多为图标、分割线等装饰元素，跳过

/** 把 Blob 上传到存储并返回公网 URL */
async function uploadBlob(blob: Blob, folder: string, name: string): Promise<string> {
  const file = new File([blob], name, { type: blob.type || 'image/png' });
  return uploadMedia(file, folder);
}

/** data:image/...;base64,xxx → Blob */
function dataUrlToBlob(dataUrl: string): Blob | null {
  const match = /^data:([^;,]+)(;base64)?,(.*)$/s.exec(dataUrl);
  if (!match) return null;
  const [, mime, isBase64, payload] = match;
  try {
    if (isBase64) {
      const bin = atob(payload);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      return new Blob([bytes], { type: mime });
    }
    return new Blob([decodeURIComponent(payload)], { type: mime });
  } catch {
    return null;
  }
}

/** 取路径的文件名部分，用于和用户选中的图片做匹配 */
function basename(path: string): string {
  return decodeURIComponent(path.split(/[\\/]/).pop() || '').split('?')[0].split('#')[0].toLowerCase();
}

/**
 * 把内容里所有图片引用换成公网 URL。
 * 同时处理 Markdown 的 ![]() 语法和 HTML 的 <img src>。
 */
async function replaceImageSources(
  text: string,
  folder: string,
  sidecarFiles: File[],
): Promise<{ text: string; missing: string[]; failed: string[]; uploaded: number }> {
  const byName = new Map<string, File>();
  for (const f of sidecarFiles) byName.set(f.name.toLowerCase(), f);

  const missing: string[] = [];
  const failed: string[] = [];
  const resolved = new Map<string, string>(); // 原始路径 → 新 URL，避免同图重复上传
  let uploaded = 0;

  // 收集所有图片引用：Markdown 的 ![alt](src) 与 HTML 的 <img src="...">
  const sources = new Set<string>();
  for (const m of text.matchAll(/!\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)) sources.add(m[1]);
  for (const m of text.matchAll(/<img[^>]+src=["']([^"']+)["']/gi)) sources.add(m[1]);

  for (const src of sources) {
    if (/^https?:\/\//i.test(src)) continue; // 已是网络地址，保留

    let blob: Blob | null = null;
    let name = basename(src) || `image_${Date.now()}.png`;

    if (src.startsWith('data:')) {
      blob = dataUrlToBlob(src);
      name = `embedded_${Date.now()}_${uploaded}.png`;
    } else {
      const hit = byName.get(basename(src));
      if (hit) {
        blob = hit;
        name = hit.name;
      }
    }

    if (!blob) {
      missing.push(basename(src) || src);
      continue;
    }

    try {
      const url = await uploadBlob(blob, folder, name);
      resolved.set(src, url);
      uploaded++;
    } catch {
      failed.push(name);
    }
  }

  let out = text;
  for (const [src, url] of resolved) {
    out = out.split(src).join(url);
  }
  return { text: out, missing, failed, uploaded };
}

/** 供「补选图片」二次流程调用：拿新选的图片重新解析一遍内容 */
export async function resolveImages(text: string, folder: string, files: File[]): Promise<ImportResult> {
  const r = await replaceImageSources(text, folder, files);
  return { content: r.text, isMarkdown: true, missingImages: r.missing, failedUploads: r.failed, uploadedImages: r.uploaded };
}

/** Markdown：保持 Markdown 原文交给编辑器解析，只把图片地址换成公网 URL */
export async function importMarkdown(file: File, folder: string, sidecarFiles: File[]): Promise<ImportResult> {
  const md = await file.text();
  if (!folder) return { content: md, isMarkdown: true, missingImages: [], failedUploads: [], uploadedImages: 0 };
  const { text, missing, failed, uploaded } = await replaceImageSources(md, folder, sidecarFiles);
  return { content: text, isMarkdown: true, missingImages: missing, failedUploads: failed, uploadedImages: uploaded };
}

/** Word：mammoth 会把图片转成 base64，这里统一改存到对象存储 */
export async function importDocx(file: File, folder: string): Promise<ImportResult> {
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.convertToHtml({ arrayBuffer });
  if (!folder) return { content: result.value, isMarkdown: false, missingImages: [], failedUploads: [], uploadedImages: 0 };
  const { text, missing, failed, uploaded } = await replaceImageSources(result.value, folder, []);
  return { content: text, isMarkdown: false, missingImages: missing, failedUploads: failed, uploadedImages: uploaded };
}

/** 把 pdf.js 取出的图片对象画到 canvas 并转成 Blob */
async function pdfImageToBlob(img: {
  width: number; height: number; kind?: number;
  bitmap?: ImageBitmap; data?: Uint8ClampedArray | Uint8Array;
}): Promise<Blob | null> {
  const canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  if (img.bitmap) {
    ctx.drawImage(img.bitmap, 0, 0);
  } else if (img.data) {
    // kind: 2 = RGB_24BPP，3 = RGBA_32BPP；其余（如 1bpp 灰度）跳过
    const rgba = new Uint8ClampedArray(img.width * img.height * 4);
    if (img.kind === 3) {
      rgba.set(img.data.subarray(0, rgba.length));
    } else if (img.kind === 2) {
      for (let i = 0, j = 0; i < img.data.length; i += 3, j += 4) {
        rgba[j] = img.data[i];
        rgba[j + 1] = img.data[i + 1];
        rgba[j + 2] = img.data[i + 2];
        rgba[j + 3] = 255;
      }
    } else {
      return null;
    }
    ctx.putImageData(new ImageData(rgba, img.width, img.height), 0, 0);
  } else {
    return null;
  }

  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), 'image/png'));
}

/** 整页渲染成图片，用于扫描件（无可提取文字）的兜底 */
async function renderPageToBlob(page: pdfjsLib.PDFPageProxy): Promise<Blob | null> {
  const viewport = page.getViewport({ scale: 2 });
  const canvas = document.createElement('canvas');
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  await page.render({ canvasContext: ctx, viewport, canvas }).promise;
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), 'image/png'));
}

/**
 * 清洗 PDF 抽取出的文本。
 *
 * 1) 异体汉字：浏览器打印生成的 PDF 常把汉字映射成「康熙部首」区（U+2F00-U+2FDF）
 *    的同形字符，肉眼一样但编码不同，会导致搜索不到、复制出乱码。
 *    这一区有官方的 NFKC 映射，可以安全还原。
 *
 *    注意：「CJK 部首补充」区（U+2E80-U+2EF3，例如 ⻄）Unicode **没有**提供映射，
 *    这里刻意不处理 —— 靠猜去替换会把原文改错，比留着更糟。
 *
 * 2) 汉字之间的多余空格：PDF 把一行文字切成多个片段，拼接时会残留空格
 *    （「比如有 些人」）。两个汉字之间的空格几乎不可能是原文本意，予以移除；
 *    中英文之间、英文单词之间的空格保持不动。
 */
function cleanPdfText(str: string): string {
  const CJK = '\\u4E00-\\u9FFF\\u3400-\\u4DBF\\u3000-\\u303F\\uFF00-\\uFFEF';
  return str
    .replace(/[⼀-⿟]/g, (c) => c.normalize('NFKC'))
    .replace(new RegExp(`([${CJK}])[ \\t]+(?=[${CJK}])`, 'g'), '$1');
}

/** HTML 转义 —— PDF 文本里可能带 < & " 等字符，直接拼进 HTML 会破坏结构 */
function escapeHtml(str: string): string {
  return cleanPdfText(str).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] as string);
}

/** 从字体名判断是否粗体。PDF 没有「加粗」这个语义，只能靠字体名推断 */
function isBoldFont(page: pdfjsLib.PDFPageProxy, fontName: string, cache: Map<string, boolean>): boolean {
  const hit = cache.get(fontName);
  if (hit !== undefined) return hit;
  let bold = false;
  try {
    const f = page.commonObjs.get(fontName) as { name?: string; bold?: boolean; black?: boolean } | undefined;
    const name = (f?.name || '').toLowerCase();
    bold = !!f?.bold || !!f?.black || /bold|semibold|demibold|black|heavy/.test(name);
  } catch {
    bold = false; // 字体未解析（未调用 getOperatorList）时按常规处理
  }
  cache.set(fontName, bold);
  return bold;
}

/** 判断是否为 CJK 字符（含中文标点）—— 决定换行拼接时要不要补空格 */
function isCjkChar(ch: string): boolean {
  return /[\u4E00-\u9FFF\u3400-\u4DBF\u3000-\u303F\uFF00-\uFFEF]/.test(ch);
}

interface Fragment { text: string; size: number; bold: boolean }
interface Line { fragments: Fragment[]; size: number; y: number }
interface PageLines { lines: Line[]; height: number; images: string[] }

/** 把单页文本切成「行」，每行保留字号与粗细信息 */
function extractLines(
  content: { items: unknown[] },
  page: pdfjsLib.PDFPageProxy,
  boldCache: Map<string, boolean>,
): Line[] {
  type Item = { str: string; transform: number[]; height: number; hasEOL: boolean; fontName?: string };
  const items = content.items.filter((i): i is Item => !!i && typeof (i as Item).str === 'string');

  const lines: Line[] = [];
  let fragments: Fragment[] = [];
  let y = 0;

  const flush = () => {
    const text = fragments.map((f) => f.text).join('');
    if (text.trim()) {
      // 一行的字号取占比最大的片段，避免行内小注脚拉低判断
      const size = fragments.reduce((a, b) => (b.text.length > a.text.length ? b : a)).size;
      lines.push({ fragments, size, y });
    } else if (fragments.length) {
      lines.push({ fragments: [], size: 0, y }); // 空行，用于分段
    }
    fragments = [];
  };

  for (const item of items) {
    if (item.str) {
      fragments.push({
        text: item.str,
        size: Math.round(item.height * 100) / 100,
        bold: item.fontName ? isBoldFont(page, item.fontName, boldCache) : false,
      });
      y = item.transform[5];
    }
    if (item.hasEOL) flush();
  }
  flush();

  return lines;
}

/** 把一行渲染成 HTML，连续的粗体片段合并成一个 <strong> */
function lineToHtml(fragments: Fragment[]): string {
  let out = '';
  let buffer = '';
  let bufferBold = false;

  const flush = () => {
    if (!buffer) return;
    out += bufferBold ? `<strong>${escapeHtml(buffer)}</strong>` : escapeHtml(buffer);
    buffer = '';
  };

  for (const f of fragments) {
    if (f.bold !== bufferBold) {
      flush();
      bufferBold = f.bold;
    }
    buffer += f.text;
  }
  flush();
  return out;
}

/**
 * PDF：逐页提取「文字 + 内嵌图片」，按页顺序交错输出。
 *
 * PDF 本身没有「标题」「加粗」这类语义，只有「在某个位置用某种字体画了些字」，
 * 因此这里做两步推断：
 *   · 标题 —— 用字号和全文正文字号的比值判断（1.8 倍以上算二级标题，1.35 倍以上算三级）
 *   · 加粗 —— 用字体名判断（含 Bold / Semibold / Black / Heavy 即视为粗体）
 * 字体信息必须先调用 getOperatorList() 才会被解析出来，这也是取图片的必要步骤。
 */
export async function importPdf(file: File, folder: string): Promise<ImportResult> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const boldCache = new Map<string, boolean>();
  const failed: string[] = [];
  let uploaded = 0;

  // 第一遍：把每页的行与图片都收集出来，同时统计字号分布
  const pages: PageLines[] = [];
  const sizeWeight = new Map<number, number>();

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);

    // 必须先跑一次 operator list：既解析字体（供粗体判断），又拿到内嵌图片
    let imageNames: string[] = [];
    try {
      const ops = await page.getOperatorList();
      for (let k = 0; k < ops.fnArray.length; k++) {
        if (ops.fnArray[k] === pdfjsLib.OPS.paintImageXObject) {
          const n = ops.argsArray[k][0];
          if (typeof n === 'string' && !imageNames.includes(n)) imageNames.push(n);
        }
      }
    } catch {
      imageNames = [];
    }

    const lines = extractLines(await page.getTextContent(), page, boldCache);
    for (const line of lines) {
      if (!line.size) continue;
      const chars = line.fragments.reduce((n, f) => n + f.text.length, 0);
      sizeWeight.set(line.size, (sizeWeight.get(line.size) || 0) + chars);
    }

    // 上传图片
    const urls: string[] = [];
    if (folder) {
      for (const name of imageNames) {
        try {
          if (!page.objs.has(name)) continue;
          const img = page.objs.get(name) as { width: number; height: number };
          if (!img || img.width < MIN_IMAGE_SIDE || img.height < MIN_IMAGE_SIDE) continue;
          const blob = await pdfImageToBlob(img);
          if (!blob) continue;
          urls.push(await uploadBlob(blob, folder, `pdf_p${i}_${name}.png`));
          uploaded++;
        } catch {
          failed.push(`第 ${i} 页的图片`);
        }
      }
      // 整页无文字也无图片 —— 多半是扫描件，整页渲染兜底
      if (!lines.some((l) => l.size) && urls.length === 0) {
        try {
          const blob = await renderPageToBlob(page);
          if (blob) {
            urls.push(await uploadBlob(blob, folder, `pdf_page_${i}.png`));
            uploaded++;
          }
        } catch {
          failed.push(`第 ${i} 页`);
        }
      }
    }

    pages.push({ lines, images: urls, height: page.getViewport({ scale: 1 }).height });
  }

  // 正文字号取「按字符数加权的中位数」，而不是出现最多的字号。
  //
  // 用众数会翻车：页眉页脚里一行超长的 URL 或路径，字符数可能超过真正的正文，
  // 于是基准被拉到 8pt，正文反而被当成标题。中位数对这类单行异常值免疫。
  const sorted = [...sizeWeight.entries()].sort((a, b) => a[0] - b[0]);
  const totalChars = sorted.reduce((n, [, w]) => n + w, 0);
  let bodySize = 0;
  let cumulative = 0;
  for (const [size, weight] of sorted) {
    cumulative += weight;
    if (cumulative >= totalChars / 2) { bodySize = size; break; }
  }
  if (!bodySize) bodySize = 10;

  // 第二遍：按推断出的层级输出 HTML
  const parts: string[] = [];

  for (const { lines, images, height: pageHeight } of pages) {
    // 先剔除页眉页脚，再算行距 —— 页脚那行离正文很远，会把行距中位数带偏
    const visible = lines.filter((line) => {
      if (!line.size) return true; // 保留空行，它本身就是分段信号
      const nearEdge = pageHeight > 0 && (line.y < pageHeight * 0.07 || line.y > pageHeight * 0.93);
      return !(line.size / bodySize < 0.95 && nearEdge);
    });

    // PDF 里段落之间靠的是「比常规行距更大的空隙」，不是空行。
    //
    // ⚠️ 不能用中位数当基准：很多文档的段落只有一两行，
    // 「段间距」的样本数反而比「段内行距」多，中位数会被段间距占据，
    // 阈值算出来比所有间距都大，结果一次都不分段、整篇挤成一大段。
    //
    // 正确做法是找间距分布里的「断层」—— 段内行距和段间距本来就是
    // 两个分离的簇，把阈值放在两簇中间。
    const gaps: number[] = [];
    for (let i = 1; i < visible.length; i++) {
      const prev = visible[i - 1];
      const cur = visible[i];
      if (!prev.size || !cur.size) continue;
      const gap = Math.abs(prev.y - cur.y);
      if (gap > 0.5) gaps.push(Math.round(gap * 2) / 2);
    }
    const unique = [...new Set(gaps)].sort((a, b) => a - b);

    let paragraphGap = Infinity; // 找不到断层时不按间距分段，避免误切
    let bestJump = 1.25;         // 相邻间距值差异要够大才算断层
    for (let i = 0; i < unique.length - 1; i++) {
      const jump = unique[i + 1] / unique[i];
      if (jump > bestJump) {
        bestJump = jump;
        paragraphGap = (unique[i] + unique[i + 1]) / 2;
      }
    }

    let paragraph: string[] = [];
    let previousPlain = '';
    const flushParagraph = () => {
      if (paragraph.length) parts.push(`<p>${paragraph.join('')}</p>`);
      paragraph = [];
      previousPlain = '';
    };

    let previous: Line | null = null;

    for (const line of visible) {
      if (!line.size) { flushParagraph(); previous = null; continue; }

      const html = lineToHtml(line.fragments);
      if (!html.trim()) continue;

      const ratio = line.size / bodySize;
      const allBold = line.fragments.every((f) => f.bold || !f.text.trim());
      const plain = line.fragments.map((f) => f.text).join('').trim();

      // 与上一行的间距超过阈值，或字号变了，都说明这里开始了新的一段
      const gapFromPrev = previous ? Math.abs(previous.y - line.y) : Infinity;
      const startsBlock = !previous || gapFromPrev > paragraphGap || previous.size !== line.size;

      let level: 'h2' | 'h3' | null = null;
      if (ratio >= 1.8) {
        level = 'h2';
      } else if (ratio >= 1.35) {
        level = 'h3';
      } else if (allBold && startsBlock && plain.length <= 30) {
        // 与正文同字号、但整行加粗且独立成段的短句 —— 中文文档里常见的小标题写法，
        // 例如「4）保持得体的妆容仪表」。限制长度是为了不误伤整段加粗的强调文字。
        level = 'h3';
      }

      if (level) {
        flushParagraph();
        parts.push(`<${level}>${html}</${level}>`);
        previous = line;
        continue;
      }

      if (startsBlock) flushParagraph();

      // 同一段内的换行处理：英文要补空格（否则单词会粘连），
      // 中文不能补（PDF 的换行不是词边界，补了就成了「比如有 些人」）。
      let separator = '';
      if (paragraph.length) {
        const before = previousPlain.slice(-1);
        const after = plain.slice(0, 1);
        separator = isCjkChar(before) && isCjkChar(after) ? '' : ' ';
      }
      paragraph.push(separator + html);
      previousPlain = plain;
      previous = line;
    }
    flushParagraph();

    for (const url of images) parts.push(`<p><img src="${url}" alt="PDF 插图" /></p>`);
  }

  return { content: parts.join(''), isMarkdown: false, missingImages: [], failedUploads: failed, uploadedImages: uploaded };
}
