const APP_VERSION = 'v28';
const CACHE_NAME  = `etna-trails-${APP_VERSION}`;
const STATIC = ['./index.html','./data.json','./manifest.json'];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(c => c.addAll(STATIC))
      .catch(e => console.warn('[SW install]', e))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k.startsWith('etna-trails-') && k !== CACHE_NAME)
          .map(k => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if(!url.protocol.startsWith('http')) return;

  // ── Bypass totale: risorse esterne — nessuna cache ────────
  const bypassHosts = [
    'tile.', 'tile-', 'arcgis.com', 'carto.com', 'opentopomap.org',  // mappe
    'api.open-meteo.com',       // meteo
    'windy.com',                // windy embed
    'allorigins.win',           // proxy gpx
    'corsproxy.io',             // proxy ingv
    'codetabs.com',             // proxy ingv fallback
    'skylinewebcams.com',       // webcam
    'images-webcams.',          // webcam cdn
    'etnamonitor.it',           // tremore
    'fonts.googleapis.com',     // font
    'fonts.gstatic.com',        // font
    'cdnjs.cloudflare.com',     // leaflet
  ];

  if(bypassHosts.some(h => url.hostname.includes(h) || url.href.includes(h))) {
    event.respondWith(
      fetch(event.request).catch(() => new Response('', { status: 408 }))
    );
    return;
  }

  // ── Network-first: index.html e data.json ─────────────────
  if(
    url.pathname.endsWith('index.html') ||
    url.pathname.endsWith('/') ||
    url.pathname.endsWith('data.json')
  ){
    event.respondWith(
      fetch(event.request)
        .then(response => {
          // Clona PRIMA di usare — evita "body already used"
          const clone = response.clone();
          caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // ── Cache-first: manifest, icone, sw stesso ───────────────
  event.respondWith(
    caches.match(event.request).then(cached => {
      if(cached) return cached;
      return fetch(event.request).then(response => {
        // Salva in cache solo risposte valide della stessa origine
        if(
          response &&
          response.status === 200 &&
          response.type === 'basic'
        ){
          const clone = response.clone();
          caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
        }
        return response;
      });
    })
  );
});

self.addEventListener('message', e => {
  if(e.data && e.data.action === 'skipWaiting') self.skipWaiting();
});
