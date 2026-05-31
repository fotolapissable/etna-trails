const APP_VERSION = 'v23';
const CACHE_NAME  = `etna-trails-${APP_VERSION}`;
const STATIC = ['./index.html','./data.json','./manifest.json'];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(STATIC).catch(e => console.warn('[SW]',e))));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k.startsWith('etna-trails-') && k!==CACHE_NAME).map(k => caches.delete(k)))
  ));
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if(!url.protocol.startsWith('http')) return;

  // ── Bypass totale: tile mappe ──────────────────────────
  const isTile = url.hostname.includes('tile') || url.hostname.includes('arcgis')
               || url.hostname.includes('carto') || url.hostname.includes('opentopomap');
  if(isTile){
    event.respondWith(fetch(event.request).catch(()=>new Response('',{status:408})));
    return;
  }

  // ── Bypass totale: Open-Meteo (sempre fresh, no cache) ─
  if(url.hostname === 'api.open-meteo.com'){
    event.respondWith(
      fetch(event.request).catch(()=>new Response('{}',{status:408,headers:{'Content-Type':'application/json'}}))
    );
    return;
  }

  // ── Bypass totale: Windy embed ─────────────────────────
  if(url.hostname.includes('windy.com')){
    event.respondWith(fetch(event.request).catch(()=>new Response('',{status:408})));
    return;
  }

  // ── Bypass totale: allorigins proxy (GPX remoti) ───────
  if(url.hostname.includes('allorigins.win')){
    event.respondWith(fetch(event.request).catch(()=>new Response('',{status:408})));
    return;
  }

  // ── Network-first: index + data ────────────────────────
  if(url.pathname.endsWith('index.html')||url.pathname.endsWith('/')||url.pathname.endsWith('data.json')){
    event.respondWith(fetch(event.request).then(r=>{
      try{caches.open(CACHE_NAME).then(c=>c.put(event.request,r.clone()));}catch(e){}
      return r;
    }).catch(()=>caches.match(event.request)));
    return;
  }

  // ── Cache-first: tutto il resto ────────────────────────
  event.respondWith(caches.match(event.request).then(cached=>{
    if(cached) return cached;
    return fetch(event.request).then(r=>{
      if(r&&r.status===200&&r.type!=='opaque'){
        try{caches.open(CACHE_NAME).then(c=>c.put(event.request,r.clone()));}catch(e){}
      }
      return r;
    });
  }));
});

self.addEventListener('message', e=>{
  if(e.data&&e.data.action==='skipWaiting') self.skipWaiting();
});
