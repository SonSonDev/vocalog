import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { resolveStatic } from './static.ts';

let root: string;

beforeAll(() => {
  root = mkdtempSync(join(tmpdir(), 'vocalog-static-'));
  mkdirSync(join(root, 'assets'));
  writeFileSync(join(root, 'index.html'), '<h1>app</h1>');
  writeFileSync(join(root, 'assets', 'app-abc123.js'), 'console.log(1)');
  writeFileSync(join(tmpdir(), 'vocalog-secret.txt'), 'outside the root');
});

afterAll(() => {
  rmSync(root, { recursive: true, force: true });
  rmSync(join(tmpdir(), 'vocalog-secret.txt'), { force: true });
});

describe('resolveStatic', () => {
  it('serves index.html at the root without caching', () => {
    const file = resolveStatic(root, '/');
    expect(file?.body.toString()).toBe('<h1>app</h1>');
    expect(file?.contentType).toContain('text/html');
    expect(file?.cacheControl).toBe('no-cache');
  });

  it('serves assets with a long cache and the right type', () => {
    const file = resolveStatic(root, '/assets/app-abc123.js');
    expect(file?.contentType).toContain('text/javascript');
    expect(file?.cacheControl).toContain('immutable');
  });

  it('falls back to index.html for client-side routes', () => {
    expect(resolveStatic(root, '/membres/42')?.body.toString()).toBe('<h1>app</h1>');
  });

  it('returns null for a missing file with an extension', () => {
    expect(resolveStatic(root, '/assets/missing.js')).toBeNull();
  });

  it('never leaves the root', () => {
    expect(resolveStatic(root, '/../vocalog-secret.txt')).toBeNull();
    expect(resolveStatic(root, '/%2e%2e/vocalog-secret.txt')).toBeNull();
    expect(resolveStatic(root, '/..%2fvocalog-secret.txt')).toBeNull();
  });

  it('rejects malformed paths', () => {
    expect(resolveStatic(root, '/%E0%A4%A')).toBeNull();
    expect(resolveStatic(root, '/a%00b')).toBeNull();
  });
});
