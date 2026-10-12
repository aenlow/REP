import { useEffect, useState } from 'react';

/**
 * Hash routing. GitHub Pages serves one index.html, so routes live after `#`
 * and a refresh on any screen reloads the same page — no 404s, no server rewrites.
 */

export function currentPath(): string {
  const h = typeof window !== 'undefined' ? window.location.hash : '';
  const p = h.replace(/^#/, '');
  return p.startsWith('/') ? p : '/';
}

export function navigate(path: string, opts: { replace?: boolean } = {}): void {
  const target = `#${path}`;
  if (opts.replace) window.history.replaceState(null, '', target);
  else if (window.location.hash !== target) window.location.hash = path;
  window.dispatchEvent(new HashChangeEvent('hashchange'));
}

export function useRoute(): string[] {
  const [path, setPath] = useState(currentPath);
  useEffect(() => {
    const on = () => setPath(currentPath());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return path.split('/').filter(Boolean).map(decodeURIComponent);
}

export function href(path: string): string {
  return `#${path}`;
}
