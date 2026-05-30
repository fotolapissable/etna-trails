const APP_VERSION = 'v6';
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
  const isMap = url.hostname.includes('tile') || url.hostname.includes('arcgis') || url.hostname.includes('carto');

  if(isMap) {
    event.respondWith(fetch(event.request).catch(() => caches.match(event.request)));
    return;
  }

  if(url.pathname.endsWith('index.html') || url.pathname.endsWith('/')) {
    event.respondWith(
      fetch(event.request).then(r => {
        caches.open(CACHE_NAME).then(c => c.put(event.request, r.clone()));
        return r;
      }).catch(() => caches.match(event.request))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then(cached => cached || fetch(event.request))
  );
});

self.addEventListener('message', e => {
  if(e.data && e.data.action==='skipWaiting') self.skipWaiting();
});
