// @vitest-environment node
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from 'typescript';
import { afterAll, describe, expect, it } from 'vitest';

const root = fileURLToPath(new URL('../../', import.meta.url));
const buildDir = mkdtempSync(path.join(root, 'node_modules', '.share-runtime-'));

afterAll(() => rmSync(buildDir, { recursive: true, force: true }));

describe('compiled share function', () => {
  it('loads in native Node ESM and sanitizes content without a bundler resolver', () => {
    writeFileSync(path.join(buildDir, 'package.json'), '{"type":"module"}');
    for (const relative of ['api/share.ts', 'src/lib/sanitizeRichHtml.ts']) {
      const outputPath = path.join(buildDir, relative.replace(/\.ts$/, '.js'));
      mkdirSync(path.dirname(outputPath), { recursive: true });
      const compiled = ts.transpileModule(readFileSync(path.join(root, relative), 'utf8'), {
        compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
      });
      writeFileSync(outputPath, compiled.outputText);
    }

    const entry = pathToFileURL(path.join(buildDir, 'api/share.js')).href;
    const deployment = JSON.parse(readFileSync(path.join(root, 'vercel.json'), 'utf8'));
    const runtimeFlags = (deployment.env?.NODE_OPTIONS ?? '').split(/\s+/).filter(Boolean);
    // Vercel disables require(ESM) unless the deployment explicitly opts in.
    const run = spawnSync(process.execPath, ['--no-experimental-require-module', ...runtimeFlags, '--input-type=module', '-e', `
      const { buildCrawlerBody } = await import(${JSON.stringify(entry)});
      const output = buildCrawlerBody('Title', 'Summary', '<h2>Heading</h2><p onclick="bad()">safe</p><script>bad()</script>');
      if (!output.includes('<h2>Heading</h2>') || !output.includes('<p>safe</p>')) throw Error('Valid content was lost');
      if (/<script|onclick=/i.test(output)) throw Error('Unsafe content remained');
      console.log('native-share-ok');
    `], { encoding: 'utf8', timeout: 10000, windowsHide: true });

    expect(run.error).toBeUndefined();
    expect(run.status, run.stderr).toBe(0);
    expect(run.stdout).toContain('native-share-ok');
  });
});
