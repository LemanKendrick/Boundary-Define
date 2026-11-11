// App shell: network-first (fresh when online, cached when offline).
// Imagery tiles: cache-first, so any area you've viewed online is available offline.
const CACHE = 'gps-traverse-v2';
const TILE_CACHE = 'gps-traverse-tiles';
const TILE_MAX = 5000;
const ASSETS = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png', './icon-maskable-512.png'];
const TILE_HOSTS = ['vginmaps.vdem.virginia.gov', 'server.arcgisonline.com', 'basemap.nationalmap.gov'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE && k !== TILE_CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

let puts = 0;
async function trimTiles(){
  const c = await caches.open(TILE_CACHE), keys = await c.keys();
  for (let i = 0; i < keys.length - TILE_MAX; i++) await c.delete(keys[i]);
}
async function tile(req){
  const c = await caches.open(TILE_CACHE);
  const hit = await c.match(req.url);
  if (hit) return hit;
  try {
    const res = await fetch(req.url, {mode: 'cors', credentials: 'omit'});
    if (res.ok) { c.put(req.url, res.clone()); if (++puts % 100 === 0) trimTiles(); }
    return res;
  } catch (err) {
    try { return await fetch(req); }        // server without CORS: show it, don't cache
    catch (e2) { return Response.error(); } // offline and not cached
  }
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (TILE_HOSTS.includes(url.hostname)) { e.respondWith(tile(req)); return; }
  if (url.origin !== location.origin) return;
  e.respondWith(
    fetch(req).then(res => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
      return res;
    }).catch(() =>
      caches.match(req, {ignoreSearch: true}).then(hit =>
        hit || (req.mode === 'navigate' ? caches.match('./index.html') : Response.error()))
    )
  );
});
