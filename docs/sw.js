/* REP service worker. Generated at build time — version and precache list are injected.
 * Caches only same-origin app files. Never touches IndexedDB, where workout data lives. */
/* eslint-disable no-restricted-globals */
const VERSION = '473b31893870';
const CACHE = `rep-shell-${VERSION}`;
const PRECACHE = ["./","assets/big-shoulders-display-latin-700-normal-KM2fueoL.woff2","assets/big-shoulders-display-latin-800-normal-DDUD9Xuh.woff2","assets/index-BPCG7A-d.css","assets/index-CVdiYASM.js","assets/public-sans-latin-400-normal-8Rpg0ruU.woff2","assets/public-sans-latin-600-normal-Fru-LXNs.woff2","icons/apple-touch-icon.png","icons/favicon-32.png","icons/icon-192.png","icons/icon-512.png","icons/icon-maskable-512.png","icons/icon-monochrome-512.png","icons/rep-mark.svg","manifest.webmanifest"];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(PRECACHE.map((p) => new Request(p, { cache: 'reload' })))),
  );
  // Do NOT skipWaiting automatically: the page asks the user first.
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('rep-shell-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

function timeout(ms) {
  return new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms));
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // never cache third-party requests

  // Navigations: serve the cached shell for this version so HTML and assets always match.
  // A new version is fetched in the background by the browser's SW update check and only
  // takes over when the user taps "Update" in the app.
  if (req.mode === 'navigate') {
    event.respondWith(
      caches
        .match('./', { cacheName: CACHE })
        .then((hit) => hit || Promise.race([fetch(req), timeout(8000)]))
        .catch(() => caches.match('index.html', { cacheName: CACHE })),
    );
    return;
  }

  // Hashed assets, icons, fonts, media: cache first, then network.
  event.respondWith(
    caches.match(req, { cacheName: CACHE }).then(
      (hit) =>
        hit ||
        fetch(req).then((res) => {
          if (res.ok && url.pathname.includes('/media/')) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        }),
    ),
  );
});
