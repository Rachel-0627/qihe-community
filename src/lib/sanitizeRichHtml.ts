import DOMPurify, { type Config, type DOMPurify as DOMPurifyInstance } from 'dompurify';

const SAFE_STYLE_VALUES: Record<string, RegExp> = {
  'background-color': /^(?:#[\da-f]{3,8}|(?:rgb|hsl)a?\([\d\s.,%+-]+\)|[a-z]{1,20}|var\(--[\w-]+\))$/i,
  'border-radius': /^(?:0|\d+(?:\.\d+)?(?:px|%|em|rem))$/i,
  color: /^(?:#[\da-f]{3,8}|(?:rgb|hsl)a?\([\d\s.,%+-]+\)|[a-z]{1,20}|var\(--[\w-]+\))$/i,
  display: /^(?:block|inline|inline-block|flex|grid|none)$/i,
  'font-family': /^[\p{L}\p{N}\s,'"-]{1,80}$/u,
  'font-size': /^(?:\d+(?:\.\d+)?(?:px|pt|em|rem|%|vw|vh)|xx-small|x-small|small|medium|large|x-large|xx-large|smaller|larger)$/i,
  'font-style': /^(?:normal|italic|oblique)$/i,
  'font-weight': /^(?:normal|bold|[1-9]00)$/i,
  height: /^(?:0|\d+(?:\.\d+)?(?:px|%|em|rem|vw|vh)|auto)$/i,
  'max-width': /^(?:none|0|\d+(?:\.\d+)?(?:px|%|em|rem|vw|vh))$/i,
  'min-width': /^(?:0|\d+(?:\.\d+)?(?:px|%|em|rem|vw|vh))$/i,
  'margin-top': /^(?:0|auto|\d+(?:\.\d+)?(?:px|em|rem|%))$/i,
  'margin-right': /^(?:0|auto|\d+(?:\.\d+)?(?:px|em|rem|%))$/i,
  'margin-bottom': /^(?:0|auto|\d+(?:\.\d+)?(?:px|em|rem|%))$/i,
  'margin-left': /^(?:0|auto|\d+(?:\.\d+)?(?:px|em|rem|%))$/i,
  'text-align': /^(?:left|right|center|justify|start|end)$/i,
  'text-decoration': /^(?:none|underline|line-through|overline)$/i,
  width: /^(?:auto|0|\d+(?:\.\d+)?(?:px|%|em|rem|vw|vh))$/i,
};

const RICH_HTML_CONFIG: Config = {
  ALLOWED_TAGS: [
    'a', 'b', 'blockquote', 'br', 'caption', 'code', 'col', 'colgroup', 'del', 'div', 'em', 'figcaption', 'figure',
    'h1', 'h2', 'h3', 'hr', 'i', 'img', 'li', 'mark', 'ol', 'p', 'pre', 's', 'source', 'span', 'strong', 'table',
    'tbody', 'td', 'tfoot', 'th', 'thead', 'tr', 'u', 'ul', 'video',
  ],
  ALLOWED_ATTR: [
    'alt', 'class', 'colspan', 'controls', 'data-align', 'data-ch', 'data-editor-image', 'data-prompt', 'height', 'href',
    'id', 'loading', 'rel', 'rowspan', 'scope', 'src', 'start', 'style', 'target', 'title', 'type', 'width',
  ],
  ALLOW_DATA_ATTR: false,
  ALLOWED_URI_REGEXP: /^(?:https?:\/\/|\/|#|\?|(?!(?:[a-z][a-z\d+.-]*):)[^:])[^\s]*$/i,
  RETURN_TRUSTED_TYPE: false,
};

function sanitizeStyle(style: string): string {
  return style
    .split(';')
    .flatMap((declaration) => {
      const separator = declaration.indexOf(':');
      if (separator < 0) return [];

      const property = declaration.slice(0, separator).trim().toLowerCase();
      const value = declaration.slice(separator + 1).trim();
      const safeValue = SAFE_STYLE_VALUES[property];
      return safeValue?.test(value) ? [`${property}: ${value}`] : [];
    })
    .join('; ');
}

/** Attach the community rich-text policy to a DOMPurify instance for either browser or Node. */
export function createRichHtmlSanitizer(purifier: DOMPurifyInstance): (html: string) => string {
  purifier.addHook('uponSanitizeAttribute', (node, data) => {
    if (data.attrName === 'style') {
      const safeStyle = sanitizeStyle(data.attrValue);
      data.attrValue = safeStyle;
      data.keepAttr = Boolean(safeStyle);
    }
    if (data.attrName === 'href' || data.attrName === 'src') {
      const normalizedUrl = data.attrValue.replace(/[\u0000-\u0020]+/g, '');
      const hasUnsafeScheme = /^[a-z][a-z\d+.-]*:/i.test(normalizedUrl) && !/^https?:\/\//i.test(normalizedUrl);
      if (hasUnsafeScheme) data.keepAttr = false;
    }
  });

  purifier.addHook('afterSanitizeAttributes', (node) => {
    if (node.nodeName !== 'A') return;
    const href = node.getAttribute('href') ?? '';
    if (/^https?:\/\//i.test(href)) {
      node.setAttribute('target', '_blank');
      node.setAttribute('rel', 'noopener noreferrer');
      return;
    }
    if (node.getAttribute('target') === '_blank') {
      node.setAttribute('rel', 'noopener noreferrer');
    }
  });

  return (html: string) => purifier.sanitize(html, RICH_HTML_CONFIG) as string;
}

const browserPurifier = typeof window === 'undefined' ? null : DOMPurify(window);

export const sanitizeRichHtml = browserPurifier
  ? createRichHtmlSanitizer(browserPurifier)
  : (_html: string) => {
      throw new Error('sanitizeRichHtml requires a browser DOM; use createRichHtmlSanitizer with a server DOM instead.');
    };
