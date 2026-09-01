// assets.js — the ONE way the page fetches an external binary asset.
//
// Since 2026-09-01 geometry lives as .bin files under media/geo/ (and
// textures as images under media/tex/), so somebody has to own the fetch, the
// cache and the failure story. This is that somebody: everything that wants
// bytes (app.js's MODEL_LOAD, props.js's propWarm, whatever the world grows
// next) calls ASSET_FETCH and nothing else touches the network.
//
// The contract:
//   ASSET_FETCH(url) -> Promise<Uint8Array>, cached BY URL for the life of
//   the page — the same asset is never fetched twice, and two callers racing
//   for one URL share one request. A failed fetch REJECTS and stays cached as
//   the rejection: hammering a missing file with retries would just turn one
//   404 into thirty. Callers degrade the way this project already degrades a
//   missing payload — the thing is absent, not the page broken.
//
// URLs arrive ALREADY prefixed: the baked manifests resolve
// FLYDIY_ASSET_BASE at their own eval (tools/_media_lib.js BASE_DECL), so
// what reaches here is fetchable as-is from the page's own location.
//
// Node note: the gates never load this file — they read the same .bin files
// with fs and hand the bytes to the codecs directly. If this ever runs where
// fetch is missing, every call rejects and every consumer takes its
// asset-absent path, which is the honest degradation.
(() => {
  'use strict';
  const BUFS = new Map();   // url -> Promise<Uint8Array>
  function assetFetch(url) {
    let p = BUFS.get(url);
    if (p) return p;
    p = (typeof fetch === 'function'
      ? fetch(url).then(r => {
          if (!r.ok) throw new Error('asset fetch: ' + url + ' -> ' + r.status);
          return r.arrayBuffer();
        }).then(b => new Uint8Array(b))
      : Promise.reject(new Error('asset fetch: no fetch() here for ' + url)));
    // a rejected promise with no local catch would print an unhandled-
    // rejection per consumer; one silent tap keeps the console readable while
    // every real caller still sees (and reports) the rejection itself
    p.catch(() => {});
    BUFS.set(url, p);
    return p;
  }
  if (typeof window !== 'undefined') window.ASSET_FETCH = assetFetch;
})();
