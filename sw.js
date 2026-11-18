const V = 'efir-v9';
const SHELL = ['./', 'index.html', 'app.js', 'rules.js', 'asr-worker.js', 'tap.js', 'fonts.css', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png',
  'vendor/transformers.min.js', 'vendor/ort-wasm-simd-threaded.asyncify.mjs', 'vendor/ort-wasm-simd-threaded.asyncify.wasm',
  'fonts/oswald-cyrillic-500-normal.woff2', 'fonts/oswald-cyrillic-600-normal.woff2', 'fonts/oswald-latin-500-normal.woff2', 'fonts/oswald-latin-600-normal.woff2',
  'fonts/rubik-cyrillic-400-normal.woff2', 'fonts/rubik-cyrillic-500-normal.woff2', 'fonts/rubik-latin-400-normal.woff2', 'fonts/rubik-latin-500-normal.woff2',
  'fonts/jetbrains-mono-cyrillic-500-normal.woff2', 'fonts/jetbrains-mono-latin-500-normal.woff2'];

self.addEventListener('install', e => { e.waitUntil(caches.open(V).then(c => Promise.allSettled(SHELL.map(u => c.add(u)))).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('efir-') && k !== V).map(k => caches.delete(k)))).then(() => self.clients.claim())); });

self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return; // модель кешує сама бібліотека
  const heavy = /\/(vendor|fonts)\//.test(u.pathname);
  e.respondWith((async () => {
    const c = await caches.open(V);
    const hit = await c.match(e.request, { ignoreSearch: true });
    if (heavy && hit) return hit;
    try {
      const r = await fetch(e.request, heavy ? {} : { cache: 'no-cache' });
      if (r.ok) c.put(e.request, r.clone());
      return r;
    } catch (err) {
      if (hit) return hit;
      throw err;
    }
  })());
});
