/**
 * 扫描文本里疑似真实的 API 密钥。
 *
 * 用在投稿提交前，防止用户把自己的 Key 粘进公开内容里。
 *
 * 难点在压误报：站点内容本来就在讲 AI 工具，正文里出现
 * `sk-your-key-here`、`Bearer {YOUR_TOKEN}` 这类示例是正常的，
 * 一刀切拦下反而会挡住正经内容。所以只认「看起来是真的」：
 * 足够长、随机、且不含占位符特征。
 */

export interface SecretHit {
  /** 给用户看的类型名，如「OpenAI 风格密钥」 */
  label: string;
  /** 打码后的片段，只用于提示，不回传也不记录完整值 */
  masked: string;
}

interface Rule {
  label: string;
  pattern: RegExp;
}

/**
 * 真实密钥的共同特征是「长且随机」。这里统一要求够长，
 * 短的（sk-xxx、sk-123）一律放过，那基本都是写文章举的例子。
 */
const RULES: Rule[] = [
  { label: 'OpenAI 风格密钥', pattern: /\bsk-[A-Za-z0-9_-]{24,}\b/g },
  { label: 'Anthropic 密钥', pattern: /\bsk-ant-[A-Za-z0-9_-]{24,}\b/g },
  { label: 'Google API 密钥', pattern: /\bAIza[A-Za-z0-9_-]{30,}\b/g },
  { label: 'GitHub 令牌', pattern: /\bgh[pousr]_[A-Za-z0-9]{30,}\b/g },
  { label: 'HuggingFace 令牌', pattern: /\bhf_[A-Za-z0-9]{30,}\b/g },
  { label: 'JWT / Supabase 密钥', pattern: /\beyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}\b/g },
];

/** 带这些字样的基本是占位符，不是真钥匙 */
const PLACEHOLDER = /(xxx|yyy|your|example|placeholder|替换|示例|这里填|\.\.\.|\*\*\*)/i;

/** 真实密钥的字符分布是随机的；重复度太高的多半是手敲的假值 */
function looksRandom(value: string): boolean {
  const body = value.replace(/^[a-z]+[-_]/i, '');
  if (body.length < 16) return false;
  const unique = new Set(body).size;
  return unique / body.length > 0.35;
}

/** 只留头尾，中间打码 —— 提示里不该出现完整密钥 */
export function maskSecret(value: string): string {
  if (value.length <= 12) return `${value.slice(0, 3)}***`;
  return `${value.slice(0, 6)}***${value.slice(-4)}`;
}

/**
 * 扫描一段或多段文本。
 * 返回空数组表示没发现可疑密钥。同一个值只报一次。
 */
export function findSecrets(...texts: Array<string | null | undefined>): SecretHit[] {
  const hits: SecretHit[] = [];
  const seen = new Set<string>();

  for (const text of texts) {
    if (!text) continue;
    for (const rule of RULES) {
      // 正则带 g，复用会接着上次的 lastIndex 往下找，这里每次新建
      const re = new RegExp(rule.pattern.source, rule.pattern.flags);
      let m: RegExpExecArray | null = re.exec(text);
      while (m !== null) {
        const value = m[0];
        if (!seen.has(value) && !PLACEHOLDER.test(value) && looksRandom(value)) {
          seen.add(value);
          hits.push({ label: rule.label, masked: maskSecret(value) });
        }
        m = re.exec(text);
      }
    }
  }

  return hits;
}
