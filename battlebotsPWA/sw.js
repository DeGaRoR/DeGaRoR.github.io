/* sw.js — hors-ligne simple : precache + cache-first.
   Bosser CACHE à chaque livraison pour invalider l'ancien. */
const CACHE = "roboclash-v7";
const ASSETS = ["./","index.html","styles.css","data.js","engine.js","app.js",
                "manifest.webmanifest","icon.svg",
  "assets/a1.webp","assets/a2.webp","assets/a3.webp","assets/arena.webp","assets/b0.webp","assets/b1.webp","assets/b2.webp","assets/b3.webp","assets/c0.webp","assets/c1.webp","assets/c2.webp","assets/disque.webp","assets/fleche.webp","assets/k0.webp","assets/k1.webp","assets/k2.webp","assets/l1.webp","assets/l2.webp","assets/losange.webp","assets/m0.webp","assets/m1.webp","assets/m2.webp","assets/m3.webp","assets/m4.webp","assets/marteau.webp","assets/n1.webp","assets/n2.webp","assets/pr0.webp","assets/pr1.webp","assets/pr2.webp","assets/pr3.webp","assets/r1.webp","assets/r2.webp","assets/rusty_sprite.webp","assets/tortue.webp"];
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
