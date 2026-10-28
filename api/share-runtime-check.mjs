export default async function handler(_req, res) {
  const checks = [];
  for (const [label, load] of [
    ['dompurify', () => import('dompurify')],
    ['jsdom', () => import('jsdom')],
    ['policy', () => import('../src/lib/sanitizeRichHtml.js')],
  ]) {
    try {
      await load();
      checks.push({ label, ok: true });
    } catch (error) {
      checks.push({ label, ok: false, code: error.code || error.name, message: String(error.message).slice(0, 400) });
    }
  }
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json({ node: process.version, checks });
}
