// assets.js — the ONE way the page fetches an external binary asset.
//
// Since 2026-09-01 geometry lives as .bin files under media/geo/ (and
// textures as images under media/tex/), so somebody has to own the fetch, the
// cache and the failure story. This is that somebody: everything that wants
// bytes (app.js's MODEL_LOAD, props.js's propWarm, whatever the world grows
// next) calls ASSET_FETCH and nothing else touches the network.
//
// The contract:
//   ASSET_FETCH(url) -> Promise<Uint8Array>. Two callers racing for one URL
//   share one request. A failed fetch REJECTS and stays cached as the
//   rejection: hammering a missing file with retries would just turn one 404
//   into thirty. Callers degrade the way this project already degrades a
//   missing payload — the thing is absent, not the page broken.
//   THE BYTES ARE THE CALLER'S ONCE DELIVERED (AS1, G907). The map held every
//   fetched Uint8Array for the life of the page, so the consumers' own
//   `BINS.delete` after a decode (props.js, animals.js, app.js MODEL_DECODE)
//   freed nothing: every bin stayed in the heap next to its decoded arrays.
//   A settled fetch now leaves the map. Each bin URL has ONE consumer (436
//   files, 436 keys), and each consumer keeps its own answer for the page's
//   life (PROP_WARMS / PROP_BUILT, the animals' WARMS / BUILT, MODEL_LOAD's
//   loadCache, the trees' WARM + BINS), so no asset is fetched twice; a
//   second ask of a released URL would fetch again (the service worker's
//   media cache answers it), never fail.
//
// URLs arrive ALREADY prefixed: the baked manifests resolve
// FLYDIY_ASSET_BASE at their own eval (tools/_media_lib.js BASE_DECL), so
// what reaches here is fetchable as-is from the page's own location.
//
// Node note: the gates never load this file — they read the same .bin files
// through tools/_media_lib.js readGeo (fs + the same gunzip) and hand the
// bytes to the codecs directly. If this ever runs where
// fetch is missing, every call rejects and every consumer takes its
// asset-absent path, which is the honest degradation.
//
// GEOMETRY ARRIVES GZIPPED (G930, AS5a). GitHub Pages sends a .bin raw, so
// every file under media/geo/ is ONE gzip stream named `<stem>.<h8>.gz.bin`
// (tools/_media_lib.js says why the name carries the transport). The suffix
// decides, never a sniff of the bytes: a `.gz.bin` body goes through the
// platform's DecompressionStream (the world pack's decoder, build.js
// ISLAND_LOADER) and callers get the AS-IS bytes the baker hashed - the same
// Uint8Array, off/len and all, the codecs read before. A browser without
// DecompressionStream rejects, which is the asset-absent path every caller
// already has (such a browser cannot boot the island either).
//
// ASSET_FETCH_FRESH(url) is the same fetch and decode with no cache, for the
// one caller that retries past a cached rejection (tools/_cage_char.js).
(() => {
  'use strict';
  const BUFS = new Map();   // url -> Promise<Uint8Array>
  const GZ_BIN = /\.gz\.bin$/;
  function load(url) {
    if (typeof fetch !== 'function')
      return Promise.reject(new Error('asset fetch: no fetch() here for ' + url));
    return fetch(url).then(r => {
      if (!r.ok) throw new Error('asset fetch: ' + url + ' -> ' + r.status);
      if (!GZ_BIN.test(url)) return r.arrayBuffer();
      if (typeof DecompressionStream !== 'function' || !r.body)
        throw new Error('asset fetch: no DecompressionStream here for ' + url);
      return new Response(r.body.pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
    }).then(b => new Uint8Array(b));
  }
  function assetFetch(url) {
    let p = BUFS.get(url);
    if (p) return p;
    p = load(url);
    // a rejected promise with no local catch would print an unhandled-
    // rejection per consumer; one silent tap keeps the console readable while
    // every real caller still sees (and reports) the rejection itself
    p.catch(() => {});
    BUFS.set(url, p);
    p.then(() => { if (BUFS.get(url) === p) BUFS.delete(url); }, () => {});   // delivered: the caller keeps it (G907)
    return p;
  }
  if (typeof window !== 'undefined') { window.ASSET_FETCH = assetFetch; window.ASSET_FETCH_FRESH = load; }
})();
