const APP_VERSION = 'v43';
const CACHE_NAME  = `etna-trails-${APP_VERSION}`;
const TOPO_TILE_CACHE = 'etna-topo-tiles-v1';
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
          // Pulisce solo le vecchie cache della shell app, MAI la cache dei tile
          // offline (etna-topo-tiles-v1): l'utente non deve doverla riscaricare
          // ogni volta che l'app si aggiorna.
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

  // ── Tile OpenTopoMap (mappa di default): chiave di cache canonica che
  // ignora il sottodominio (a/b/c), cosi funziona sia il pre-download
  // manuale ("Scarica mappe offline") sia il caching opportunistico durante
  // la navigazione online, e la mappa resta leggibile senza segnale.
  const topoMatch = url.hostname.endsWith('tile.opentopomap.org') &&
    url.pathname.match(/\/(\d+)\/(\d+)\/(\d+)\.png$/);
  if(topoMatch){
    const tileKey = `https://tile-cache.etna/topo/${topoMatch[1]}/${topoMatch[2]}/${topoMatch[3]}.png`;
    event.respondWith(
      fetch(event.request).then(response => {
        if(response && response.status === 200){
          const clone = response.clone();
          caches.open(TOPO_TILE_CACHE).then(c => c.put(tileKey, clone));
        }
        return response;
      }).catch(() => caches.match(tileKey))
    );
    return;
  }

  // ── Bypass totale: altre risorse esterne — nessuna cache ────────
  const bypassHosts = [
    'tile.', 'tile-', 'arcgis.com', 'carto.com',  // altre mappe (satellite/dark)
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
      fetch(event.request, { cache: 'no-store' })
        .then(response => {
          // Clona PRIMA di usare — evita "body already used"
          const clone = response.clone();
          caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
          return response;
        })
        .catch(() => caches.match(event.request).then(cached => cached || caches.match('./index.html')))
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
