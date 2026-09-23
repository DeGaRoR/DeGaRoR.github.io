// GENERATED FILE - DO NOT EDIT. Written by tools/build.js (LOADING S4). Build d2ee0d9101df.
// The media cache: cache-first for media/ (content-hashed, immutable), nothing else.
// The world payloads this build asks for; anything else under media/world/ is
// swept on activate (a superseded world is ~35 MB and nothing will ask for it).
const WORLD_KEEP = ["media/world/jolene/e2_topo.58051e86.bin","media/world/jolene/e2_tree.87d9d3e6.bin","media/world/jolene/e4_topo.01919615.bin","media/world/jolene/e4_tree.669b5d02.bin","media/world/jolene/grid_meta.95ea0ce8.bin","media/world/jolene/cover.f76749e0.bin","media/world/jolene/canopy.bb015f03.bin","media/world/jolene/coast.d707b1ff.bin","media/world/jolene/albedo.d0444877.bin","media/world/jolene/tint.75a21833.bin","media/world/jolene/ori1.d9b58fc5.bin","media/world/jolene/ndvi.4b21dcf4.bin","media/world/jolene/lake.60aa1707.bin","media/world/jolene/ttype.77afa58e.bin","media/world/jolene/lakes.7f36553d.bin"];
const CACHE = 'flydiy-media-v1';
self.addEventListener('install', e => { self.skipWaiting(); });
self.addEventListener('activate', e => { e.waitUntil((async () => {
  await self.clients.claim();
  try {
    const c = await caches.open(CACHE), keep = new Set(WORLD_KEEP);
    for (const req of await c.keys()) {
      const p = new URL(req.url).pathname, i = p.indexOf('/media/world/');
      if (i >= 0 && !keep.has(p.slice(i + 1))) await c.delete(req);
    }
  } catch (err) {}   // a cache that will not open is not worth failing activate over
})()); });
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  let u; try { u = new URL(req.url); } catch (err) { return; }
  if (u.origin !== self.location.origin || u.pathname.indexOf('/media/') < 0) return;
  e.respondWith(caches.open(CACHE).then(c => c.match(req).then(hit => hit || fetch(req).then(res => {
    if (res && res.ok) c.put(req, res.clone()).catch(() => {});
    return res;
  }))));
});
