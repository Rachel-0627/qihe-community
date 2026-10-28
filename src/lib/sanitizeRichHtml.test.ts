// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { sanitizeRichHtml } from './sanitizeRichHtml';

describe('sanitizeRichHtml', () => {
  it('removes dangerous elements and event handler attributes', () => {
    const html = sanitizeRichHtml(
      '<p onclick="alert(1)" style="background-image:url(javascript:alert(1))">safe</p><script>alert(1)</script><iframe src="https://evil.test"></iframe><object data="x"></object><img src="x" onerror="alert(1)"><svg onload="alert(1)"><circle /></svg>',
    );

    expect(html).toContain('<p>safe</p>');
    expect(html).not.toMatch(/<\/?(?:script|iframe|object|svg|circle)\b/i);
    expect(html).not.toMatch(/\bon(?:click|error|load)\s*=/i);
    expect(html).not.toMatch(/background-image|javascript:/i);
  });

  it('rejects dangerous URL protocols while preserving HTTPS and relative URLs', () => {
    const html = sanitizeRichHtml(
      '<a href="javascript:alert(1)">bad</a><a href="java&#x0a;script:alert(1)">obfuscated bad</a><a href="data:text/html,<script>alert(1)</script>">bad data</a><a href="mailto:editor@example.com">email</a><a href="https://example.com">https</a><img src="data:image/svg+xml,evil" alt="bad data image"><img src="/media/image.png" alt="image">',
    );

    expect(html).not.toContain('javascript:');
    expect(html).not.toContain('data:text/html');
    expect(html).not.toContain('data:image/svg+xml');
    expect(html).not.toContain('mailto:');
    expect(html).toContain('href="https://example.com"');
    expect(html).toContain('src="/media/image.png"');
  });

  it('preserves editor-supported rich text and project blocks', () => {
    const html = sanitizeRichHtml(
      '<h2 data-ch="chapter-1">Heading</h2><p><strong>bold</strong> <em>italic</em> <u>underline</u> <mark>highlight</mark></p><ul><li>item</li></ul><blockquote><p>quote</p></blockquote><pre><code class="language-js">const x = 1;</code></pre><table><thead><tr><th scope="col">A</th></tr></thead><tbody><tr><td colspan="1">B</td></tr></tbody></table><a href="https://example.com" target="_blank">link</a><figure data-editor-image="" data-align="center" style="width: 80%; max-width: 100%"><img src="https://example.com/image.png" alt="photo" style="width: 100%; height: auto"><figcaption style="text-align: center; font-size: 0.8rem">caption</figcaption></figure><div data-prompt="true" class="prompt-block"><p>prompt</p></div><video controls style="max-width: 100%"><source src="https://example.com/video.mp4" type="video/mp4"></video>',
    );

    for (const snippet of [
      '<h2 data-ch="chapter-1">Heading</h2>',
      '<strong>bold</strong>',
      '<ul>',
      '<blockquote>',
      '<pre><code class="language-js">',
      '<table>',
      '<th scope="col">',
      'href="https://example.com"',
      'target="_blank"',
      'rel="noopener noreferrer"',
      'data-editor-image=""',
      'data-align="center"',
      'src="https://example.com/image.png"',
      '<figcaption',
      'data-prompt="true"',
      'class="prompt-block"',
      '<video controls',
      'src="https://example.com/video.mp4"',
    ]) {
      expect(html).toContain(snippet);
    }
    expect(html).toMatch(/style="[^"]*width: 80%/);
    expect(html).toMatch(/style="[^"]*text-align: center/);
  });

  it('handles empty, plain-text, malformed, and repeated input safely', () => {
    expect(sanitizeRichHtml('')).toBe('');
    expect(sanitizeRichHtml('plain text')).toContain('plain text');

    const once = sanitizeRichHtml('<p>safe<img src=x onerror=alert(1)></p><script>alert(1)</script>');
    const twice = sanitizeRichHtml(once);

    expect(twice).toBe(once);
    expect(twice).not.toMatch(/onerror|<script/i);
  });
});
