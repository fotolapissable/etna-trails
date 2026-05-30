const APP_VERSION = 'v15';
const CACHE_NAME  = `etna-trails-${APP_VERSION}`;

const STATIC_ASSETS = [
  './index.html',
  './data.json',
  './manifest.json',
  'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache =>
      cache.addAll(STATIC_ASSETS).catch(e => console.warn('[SW]', e))
    )
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k.startsWith('etna-trails-') && k!==CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  // Skip non-http requests (geo:, chrome-extension:, etc.)
  if(!url.protocol.startsWith('http')) return;
  // Skip cross-origin tile requests — just fetch
  const isTile = url.hostname.includes('tile') || url.hostname.includes('arcgis') || url.hostname.includes('carto') || url.hostname.includes('opentopomap');
  if(isTile) {
    event.respondWith(fetch(event.request).catch(() => new Response('', {status: 408})));
    return;
  }
  // index.html and data.json: network-first
  if(url.pathname.endsWith('index.html') || url.pathname.endsWith('/') || url.pathname.endsWith('data.json')) {
    event.respondWith(
      fetch(event.request).then(r => {
        try {
          const clone = r.clone();
          caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
        } catch(e) {}
        return r;
      }).catch(() => caches.match(event.request))
    );
    return;
  }
  // Everything else: cache-first
  event.respondWith(
    caches.match(event.request).then(cached => {
      if(cached) return cached;
      return fetch(event.request).then(r => {
        if(r && r.status===200 && r.type!=='opaque') {
          try {
            caches.open(CACHE_NAME).then(c => c.put(event.request, r.clone()));
          } catch(e) {}
        }
        return r;
      });
    })
  );
});

self.addEventListener('message', e => {
  if(e.data && e.data.action==='skipWaiting') self.skipWaiting();
});
