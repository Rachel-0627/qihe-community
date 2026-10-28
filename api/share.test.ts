// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { buildCrawlerBody } from './share';

describe('share crawler HTML', () => {
  it('sanitizes the HTML body before returning server-rendered markup', () => {
    const output = buildCrawlerBody(
      'Title',
      'Summary',
      '<h2>Heading</h2><p onclick="alert(1)">safe</p><script>alert(1)</script><a href="javascript:alert(1)">bad link</a>',
    );

    expect(output).toContain('<h2>Heading</h2>');
    expect(output).toContain('<p>safe</p>');
    expect(output).not.toMatch(/<script|onclick=|javascript:/i);
    expect(output.startsWith('<noscript>')).toBe(true);
  });
});
