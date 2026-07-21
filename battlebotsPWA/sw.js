/* sw.js — hors-ligne simple : precache + cache-first.
   Bosser CACHE à chaque livraison pour invalider l'ancien. */
const CACHE = "roboclash-v4";
const ASSETS = ["./","index.html","styles.css","data.js","engine.js","app.js",
                "manifest.webmanifest","icon.svg"];
self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(()=>self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(
    ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(()=>self.clients.claim()));
});
self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;
  e.respondWith(caches.match(e.request, {ignoreSearch:true})
    .then(hit => hit || fetch(e.request)));
});
