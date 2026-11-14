/* Faringitis Aguda · CDSS — service worker
   Red primero para el HTML (siempre la versión más nueva si hay conexión),
   caché como respaldo sin conexión. Solo precachea archivos que existen. */
const CACHE = 'faringitis-cdss-v1.0';
const CORE = ['./', './index.html'];

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    // add uno por uno: si alguno falla, la instalación no se rompe
    await Promise.all(CORE.map(u => c.add(new Request(u, {cache: 'reload'})).catch(() => {})));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k.startsWith('faringitis-cdss-') && k !== CACHE).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  const isPage = req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html');
  if (isPage) {
    e.respondWith((async () => {
      try {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 4000);   // sin red lenta eterna
        const res = await fetch(req, {signal: ctrl.signal, cache: 'no-store'});
        clearTimeout(t);
        if (res && res.ok) {
          const c = await caches.open(CACHE);
          c.put('./index.html', res.clone()).catch(() => {});
        }
        return res;
      } catch (_) {
        const c = await caches.open(CACHE);
        return (await c.match('./index.html')) || (await c.match('./')) ||
          new Response('<h1>Sin conexión</h1><p>Abra la app una vez con internet para guardarla.</p>',
                       {headers: {'Content-Type': 'text/html; charset=utf-8'}});
      }
    })());
    return;
  }
  // otros recursos del mismo origen: caché primero, luego red
  e.respondWith((async () => {
    const hit = await caches.match(req);
    if (hit) return hit;
    try {
      const res = await fetch(req);
      if (res && res.ok) (await caches.open(CACHE)).put(req, res.clone()).catch(() => {});
      return res;
    } catch (_) { return new Response('', {status: 504}); }
  })());
});
