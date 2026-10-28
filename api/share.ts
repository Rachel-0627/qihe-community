import createDOMPurify from 'dompurify';
import { JSDOM } from 'jsdom';
import { createRichHtmlSanitizer } from '../src/lib/sanitizeRichHtml.js';

const serverWindow = new JSDOM('').window;
const sanitizeServerHtml = createRichHtmlSanitizer(createDOMPurify(serverWindow));

// 详情页的分享卡片：把这一篇的标题、摘要、封面写进返回的 HTML。
//
// 为什么需要它：站点是单页应用，标题和封面都是 JS 跑起来之后才改的，
// 而微信、各平台抓分享卡片时不执行 JS，只读服务器吐回来的那份 HTML，
// 所以不处理的话，转发任何一篇都只会显示站点默认的标题和封面。
//
// 为什么不按 User-Agent 区分爬虫：微信的抓取端和用户点开后的内置浏览器，
// UA 里都带 MicroMessenger，分不干净。认错一次，真人在微信里打开就是白屏。
// 所以这里对所有人返回同一份 HTML —— 只是把 meta 换成这一篇的，
// 真人拿到的仍是完整的单页应用，照常加载。
//
// 失败时一律退回站点默认的 index.html，宁可卡片是通用的，也不能让页面打不开。

const ENTITIES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

/** 注入 HTML 属性前必须转义，否则标题里一个引号就能把标签structure 打断 */
function escapeHtml(input: unknown): string {
  return String(input ?? '').replace(/[&<>"']/g, (ch) => ENTITIES[ch] ?? ch);
}

/** 摘要用于卡片描述，太长会被平台截断，这里先收敛到 200 字 */
function clamp(text: string, max = 200): string {
  const trimmed = text.replace(/\s+/g, ' ').trim();
  return trimmed.length > max ? `${trimmed.slice(0, max - 1)}…` : trimmed;
}

/** 封面可能存的是相对路径，补成完整地址，否则抓取方取不到图 */
function toAbsolute(url: string, origin: string): string {
  if (!url) return '';
  if (/^https?:\/\//i.test(url)) return url;
  return `${origin}${url.startsWith('/') ? '' : '/'}${url}`;
}

function replaceMetaContent(html: string, attr: string, name: string, value: string): string {
  const pattern = new RegExp(`(<meta\\s+${attr}="${name}"\\s+content=")[^"]*(")`, 'i');
  return html.replace(pattern, `$1${escapeHtml(value)}$2`);
}

interface ShareFields {
  title: string;
  description: string;
  image: string;
  url: string;
}

function applyShareFields(html: string, fields: ShareFields, imageChanged: boolean): string {
  let out = html;

  // 微信取的是 <title>，不是 og:title，这一条必须换
  out = out.replace(/<title>[\s\S]*?<\/title>/i, `<title>${escapeHtml(fields.title)}</title>`);

  out = replaceMetaContent(out, 'name', 'description', fields.description);
  out = replaceMetaContent(out, 'property', 'og:title', fields.title);
  out = replaceMetaContent(out, 'property', 'og:description', fields.description);
  out = replaceMetaContent(out, 'property', 'og:image', fields.image);
  out = replaceMetaContent(out, 'property', 'og:url', fields.url);
  out = replaceMetaContent(out, 'property', 'og:type', 'article');
  out = replaceMetaContent(out, 'name', 'twitter:title', fields.title);
  out = replaceMetaContent(out, 'name', 'twitter:description', fields.description);
  out = replaceMetaContent(out, 'name', 'twitter:image', fields.image);

  // 默认封面的宽高是写死的；换成这一篇自己的封面后尺寸就对不上了，
  // 留着错误的尺寸提示反而会让有些平台裁错，直接去掉。
  if (imageChanged) {
    out = out.replace(/\s*<meta\s+property="og:image:(width|height)"\s+content="[^"]*"\s*\/?>/gi, '');
  }

  return out;
}

const BASE_COLUMNS = 'title,title_en,summary,summary_en,cover_url';

/** 注入正文的上限。目前最长的一篇一万两千字，留足余量又不至于把响应撑大 */
const MAX_BODY_CHARS = 30000;

/**
 * 给搜索引擎看的正文。
 *
 * 站点是单页应用，HTML 里只有一个空的 <div id="root">，正文要等 JS 跑完才出现。
 * 百度基本不执行 JS，所以不处理的话，文章对百度约等于不存在。
 *
 * 放进 <noscript>：内容和页面上渲染出来的完全一致（不是给爬虫单独编一套，
 * 那是作弊会被惩罚），普通用户看不到也不影响体验，不执行 JS 的爬虫能完整读到。
 */
export function buildCrawlerBody(title: string, summary: string, content: string): string {
  const safe = sanitizeServerHtml(content)
    // 正文里真出现这个字符串会把 noscript 提前闭合，后面的内容全漏到页面上
    .replace(/<\/noscript>/gi, '')
    // 正文是后台录入的 HTML，正常不会有脚本，这里是兜底
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .slice(0, MAX_BODY_CHARS);

  return (
    '<noscript>' +
    `<h1>${escapeHtml(title)}</h1>` +
    (summary ? `<p>${escapeHtml(summary)}</p>` : '') +
    safe +
    '</noscript>'
  );
}

/** 结构化数据，帮搜索引擎认出这是一篇文章而不是一个普通页面 */
function buildJsonLd(fields: { title: string; description: string; image: string; url: string }): string {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: fields.title,
    description: fields.description,
    image: fields.image,
    url: fields.url,
    publisher: { '@type': 'Organization', name: '启禾社区' },
  };
  // </script> 同样会提前闭合，JSON 里出现就转义掉
  const json = JSON.stringify(data).replace(/<\//g, '<\\/');
  return `<script type="application/ld+json">${json}</script>`;
}

// path 用于反推 og:url —— 重写之后 req.url 变成 /api/share?...，
// 拿不到用户访问的原地址，不反推的话分享出去的链接会指向这个内部接口。
// hasBody：只有案例的正文匿名可读。项目的正文被付费墙挡着（列级权限），
// 活动压根没有正文字段 —— 两者都只注入标题与摘要，不能把付费内容漏给爬虫。
const TYPES: Record<string, { table: string; path: string; columns: string; hasBody: boolean }> = {
  case: { table: 'cases', path: 'cases', columns: `${BASE_COLUMNS},content,content_en`, hasBody: true },
  project: { table: 'projects', path: 'projects', columns: BASE_COLUMNS, hasBody: false },
  event: {
    table: 'events',
    path: 'events',
    columns: `${BASE_COLUMNS},city,city_en,event_date`,
    hasBody: false,
  },
};

/**
 * 活动时间。必须显式指定 Asia/Shanghai：
 * 前端那套取的是浏览器本地时区，而这里跑在服务器上（UTC），
 * 直接 getMonth()/getDate() 会比国内早 8 小时，日期可能整个差一天。
 */
function formatEventTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  try {
    return new Intl.DateTimeFormat('zh-CN', {
      timeZone: 'Asia/Shanghai',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(d);
  } catch {
    return '';
  }
}

export default async function handler(req: any, res: any) {
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const origin = `https://${host}`;

  // 先取站点默认的 HTML：它带着构建后带哈希的 js/css 地址，
  // 自己拼模板会在每次构建后失效，所以必须现取。
  let baseHtml = '';
  try {
    const baseRes = await fetch(`${origin}/index.html`);
    if (!baseRes.ok) throw new Error(`index.html ${baseRes.status}`);
    baseHtml = await baseRes.text();
  } catch (err) {
    console.error('[share] 取站点模板失败:', (err as Error).message);
    res.status(502).send('页面暂时打不开，请刷新重试');
    return;
  }

  const sendBase = () => {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=86400');
    res.status(200).send(baseHtml);
  };

  const type = String(req.query?.type ?? '');
  const id = String(req.query?.id ?? '');
  const meta = TYPES[type];

  if (!meta || !id) {
    sendBase();
    return;
  }

  const supabaseUrl = process.env['SUPABASE_URL'];
  const supabaseKey = process.env['SUPABASE_ANON_KEY'];
  if (!supabaseUrl || !supabaseKey) {
    console.error('[share] 缺少 SUPABASE_URL / SUPABASE_ANON_KEY，退回默认卡片');
    sendBase();
    return;
  }

  try {
    const query =
      `${supabaseUrl}/rest/v1/${meta.table}` +
      `?id=eq.${encodeURIComponent(id)}` +
      `&select=${meta.columns}&limit=1`;

    const dataRes = await fetch(query, {
      headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` },
      signal: AbortSignal.timeout(4000),
    });
    if (!dataRes.ok) throw new Error(`supabase ${dataRes.status}`);

    const rows = (await dataRes.json()) as Array<Record<string, string | null>>;
    const row = rows?.[0];
    if (!row) {
      // 内容不存在或没权限读，就当通用页处理，交给前端去显示「未找到」
      sendBase();
      return;
    }

    const title = (row['title'] || row['title_en'] || '').trim();
    const summary = (row['summary'] || row['summary_en'] || '').trim();
    const cover = toAbsolute((row['cover_url'] || '').trim(), origin);

    if (!title) {
      sendBase();
      return;
    }

    // 活动卡片把城市和时间放在最前面：转发到群里时，
    // 这两样比摘要更能决定别人要不要点进来。
    let description = summary;
    if (type === 'event') {
      const city = (row['city'] || row['city_en'] || '').trim();
      const when = formatEventTime(row['event_date'] || '');
      const head = [city, when].filter(Boolean).join(' · ');
      description = head ? `${head}｜${summary}` : summary;
    }

    const fields = {
      title: `${title} · 启禾社区`,
      description: clamp(description) || '聚焦 AI 实践的共创社区，汇聚案例、项目与城市组局活动。',
      image: cover || `${origin}/share-cover.png`,
      url: `${origin}/${meta.path}/${encodeURIComponent(id)}`,
    };

    let html = applyShareFields(baseHtml, fields, Boolean(cover));

    // 正文与结构化数据塞在 #root 后面：#root 必须保持为空，
    // React 挂载时会清空它，写进去的东西会被直接抹掉。
    const body = meta.hasBody ? (row['content'] || row['content_en'] || '') : '';
    const injected = buildCrawlerBody(title, description, body) + buildJsonLd(fields);
    html = html.replace('<div id="root"></div>', `<div id="root"></div>${injected}`);

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=86400');
    res.status(200).send(html);
  } catch (err) {
    console.error('[share] 生成分享卡片失败，退回默认：', (err as Error).message);
    sendBase();
  }
}
