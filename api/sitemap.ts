// 站点地图。
//
// 做成服务端实时生成而不是写死一个静态文件：内容是数据库里的，
// 写死的话每加一篇文章就得手改一次，迟早忘。
//
// 列出首页、各列表页，以及每一篇案例、项目、活动的详情页。
// 要登录才有意义的页面（后台、个人中心、投稿）不收录，与 robots.txt 一致。

const SITE = 'https://qihe.bj.cn';

/** 固定页面。改动频率与权重按内容更新节奏估：列表页勤、协议页几乎不动 */
const STATIC_PAGES: Array<{ path: string; changefreq: string; priority: string }> = [
  { path: '/', changefreq: 'daily', priority: '1.0' },
  { path: '/cases', changefreq: 'daily', priority: '0.9' },
  { path: '/projects', changefreq: 'daily', priority: '0.9' },
  { path: '/events', changefreq: 'weekly', priority: '0.7' },
  { path: '/tools', changefreq: 'weekly', priority: '0.7' },
  { path: '/discuss', changefreq: 'weekly', priority: '0.6' },
  { path: '/benefits', changefreq: 'monthly', priority: '0.5' },
  { path: '/terms', changefreq: 'yearly', priority: '0.2' },
  { path: '/privacy', changefreq: 'yearly', priority: '0.2' },
];

/** projects 表是按列授权的，只能取到这几列，正好够用 */
const COLLECTIONS: Array<{ table: string; path: string; priority: string }> = [
  { table: 'cases', path: 'cases', priority: '0.8' },
  { table: 'projects', path: 'projects', priority: '0.8' },
  { table: 'events', path: 'events', priority: '0.6' },
];

function escapeXml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function urlEntry(loc: string, lastmod: string | null, changefreq: string, priority: string): string {
  const parts = [`    <loc>${escapeXml(loc)}</loc>`];
  if (lastmod) parts.push(`    <lastmod>${lastmod}</lastmod>`);
  parts.push(`    <changefreq>${changefreq}</changefreq>`);
  parts.push(`    <priority>${priority}</priority>`);
  return `  <url>\n${parts.join('\n')}\n  </url>`;
}

/** created_at 是带时区的完整时间，sitemap 用 YYYY-MM-DD 就够 */
function toDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

export default async function handler(_req: any, res: any) {
  const entries: string[] = STATIC_PAGES.map((p) =>
    urlEntry(`${SITE}${p.path}`, null, p.changefreq, p.priority)
  );

  const supabaseUrl = process.env['SUPABASE_URL'];
  const supabaseKey = process.env['SUPABASE_ANON_KEY'];

  if (supabaseUrl && supabaseKey) {
    for (const c of COLLECTIONS) {
      try {
        const query = `${supabaseUrl}/rest/v1/${c.table}?select=id,created_at&order=created_at.desc&limit=1000`;
        const resp = await fetch(query, {
          headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` },
          signal: AbortSignal.timeout(5000),
        });
        if (!resp.ok) throw new Error(`${c.table} ${resp.status}`);
        const rows = (await resp.json()) as Array<{ id?: string; created_at?: string }>;
        for (const row of rows) {
          if (!row?.id) continue;
          entries.push(
            urlEntry(`${SITE}/${c.path}/${row.id}`, toDate(row.created_at), 'weekly', c.priority)
          );
        }
      } catch (err) {
        // 某张表取不到就跳过它，至少把其余页面交出去，
        // 整个 sitemap 报错会让搜索引擎什么都收不到
        console.error(`[sitemap] ${c.table} 读取失败:`, (err as Error).message);
      }
    }
  } else {
    console.error('[sitemap] 缺少 SUPABASE_URL / SUPABASE_ANON_KEY，只输出固定页面');
  }

  const xml =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    `${entries.join('\n')}\n` +
    `</urlset>\n`;

  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  // 搜索引擎不必每次都现算，缓存一小时；内容更新后最迟一小时生效
  res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
  res.status(200).send(xml);
}
