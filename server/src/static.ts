import { existsSync, readFileSync, statSync } from 'node:fs';
import { extname, join, normalize, sep } from 'node:path';

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};

export interface StaticFile {
  body: Buffer;
  contentType: string;
  cacheControl: string;
}

/**
 * Resolves a URL path to a file inside `root`. Unknown paths fall back to `index.html` (single-page app).
 * Never leaves `root`: returns null for traversal attempts or when nothing can be served.
 */
export function resolveStatic(root: string, urlPath: string): StaticFile | null {
  let decoded: string;
  try {
    decoded = decodeURIComponent(urlPath.split('?')[0] ?? '/');
  } catch {
    return null;
  }
  if (decoded.includes('\0')) return null;

  const safeRoot = normalize(root);
  const candidate = normalize(join(safeRoot, decoded));
  if (candidate !== safeRoot && !candidate.startsWith(safeRoot + sep)) return null;

  let file = candidate;
  if (!existsSync(file) || !statSync(file).isFile()) {
    // A path with an extension that does not exist is a real 404; anything else is a client-side route.
    if (extname(decoded) !== '') return null;
    file = join(safeRoot, 'index.html');
    if (!existsSync(file)) return null;
  }

  const extension = extname(file);
  const isIndex = file.endsWith(`${sep}index.html`);
  return {
    body: readFileSync(file),
    contentType: TYPES[extension] ?? 'application/octet-stream',
    cacheControl: isIndex ? 'no-cache' : 'public, max-age=31536000, immutable',
  };
}
