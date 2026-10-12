/// <reference types="vitest/config" />
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

/**
 * REP is deployed to GitHub Pages under a repository subpath (e.g. /REP/).
 * We use a *relative* base ('./') and hash-based routing, so the same build
 * works at any path — /REP/, /rep/, a fork name, or a custom domain root —
 * and refreshing any screen never hits a 404.
 */

const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' blob: data:",
  "media-src 'self' blob:",
  "font-src 'self'",
  "connect-src 'self'",
  "worker-src 'self'",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'none'",
].join('; ');

function listPublicFiles(dir: string, root = dir): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return listPublicFiles(full, root);
    return [relative(root, full).split('\\').join('/')];
  });
}

/** Emits sw.js with a precache list of every built file and a content-hash version. */
function serviceWorker(): Plugin {
  return {
    name: 'rep-service-worker',
    apply: 'build',
    transformIndexHtml(html) {
      return html.replace(
        '<!--CSP-->',
        `<meta http-equiv="Content-Security-Policy" content="${CSP}" />`,
      );
    },
    generateBundle(_opts, bundle) {
      // Drop legacy .woff font fallbacks: every browser REP targets uses .woff2.
      for (const [name, item] of Object.entries(bundle)) {
        if (name.endsWith('.woff')) delete bundle[name];
        else if (name.endsWith('.css') && item.type === 'asset') {
          item.source = String(item.source).replace(/,\s*url\([^)]*?\.woff\)\s*format\(["']?woff["']?\)/g, '');
        }
      }
      const publicFiles = listPublicFiles(join(process.cwd(), 'public')).filter(
        (f) => f !== 'sw.js' && !f.startsWith('.'),
      );
      // .woff files are legacy fallbacks; every browser REP targets uses .woff2.
      const built = Object.keys(bundle).filter((f) => !f.endsWith('.map') && !f.endsWith('.woff'));
      const files = Array.from(new Set(['./', ...built, ...publicFiles])).sort();
      const hash = createHash('sha256');
      for (const f of built) {
        const item = bundle[f]!;
        hash.update(f);
        hash.update(item.type === 'chunk' ? item.code : String(item.source));
      }
      const version = hash.digest('hex').slice(0, 12);
      const template = readFileSync(join(process.cwd(), 'src/sw/sw-template.js'), 'utf8');
      this.emitFile({
        type: 'asset',
        fileName: 'sw.js',
        source: template
          .replace('__REP_VERSION__', version)
          .replace('__REP_PRECACHE__', JSON.stringify(files)),
      });
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [react(), serviceWorker()],
  build: {
    target: 'es2020',
    assetsInlineLimit: 0,
    sourcemap: false,
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.{ts,tsx}'],
    css: false,
  },
});
