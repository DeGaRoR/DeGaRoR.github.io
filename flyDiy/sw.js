// GENERATED FILE - DO NOT EDIT. Written by tools/build.js (LOADING S4). Build f19301f974bb.
// The media cache: cache-first for media/ (content-hashed, immutable), nothing else.
const CACHE = 'flydiy-media-v1';
self.addEventListener('install', e => { self.skipWaiting(); });
self.addEventListener('activate', e => { e.waitUntil(self.clients.claim()); });
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
