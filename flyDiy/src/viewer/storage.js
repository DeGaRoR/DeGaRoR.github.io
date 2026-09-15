// storage.js - THE MEDIA CACHE AND THE VERSION LINE (LOADING S4, G421)
//
// The user's ruling (2026-09-14): a service worker, yes - but he has had
// sync trouble with them, so: (1) it caches ONLY media/ (content-hashed
// names: a file never changes under its URL, so cache-first cannot go
// stale; scripts and pages are never cached - a new build is a new page on
// the next load, as it always was); (2) the interface shows the build this
// page runs, the build the server has, and how much media is cached; (3) a
// REFRESH CACHES button clears the cache, updates the worker and reloads.
// Registered from index.html only (build.js writes sw.js and version.json
// beside it); dev.html never registers, and the rigs measure on a fresh
// profile. `window.STORAGE` is what the GRAPHICS menu's row reads.
(function () {
  'use strict';
  const W = (typeof window !== 'undefined') ? window : null;
  if (!W) return;
  const CACHE = 'flydiy-media-v1';
  const S = { build: W.FLYDIY_BUILD || null, server: null, serverAt: null, cached: null, cachedMB: null, sw: 'none', error: null };
  const hasSW = () => !!(W.navigator && W.navigator.serviceWorker && /^https?:/.test(W.location.protocol));
  const isDev = () => /dev\.html/.test(W.location.pathname);

  function register() {
    if (!hasSW() || isDev()) { S.sw = isDev() ? 'off (dev.html)' : 'unavailable'; return; }
    W.addEventListener('load', () => {
      W.navigator.serviceWorker.register('sw.js').then(r => {
        S.sw = r.active ? 'active' : 'installing';
        r.addEventListener('updatefound', () => { const had = !!r.active; const w = r.installing; S.sw = had ? 'updating' : 'installing';
          if (w) w.addEventListener('statechange', () => { if (w.state === 'activated') S.sw = 'active'; }); });
      })
        .catch(e => { S.sw = 'failed'; S.error = String(e && e.message || e); });
    });
  }
  // the server's build: version.json, never from a cache
  function checkServer() {
    return fetch('version.json', { cache: 'no-store' }).then(r => r.ok ? r.json() : null)
      .then(v => { S.server = v && v.build ? v.build : null; S.serverAt = v && v.date ? v.date : null; return S.server; })
      .catch(() => { S.server = null; return null; });
  }
  // what the cache holds (the entries' content-length, summed)
  function measure() {
    if (!W.caches) { S.cached = 0; S.cachedMB = 0; return Promise.resolve(S); }
    return W.caches.open(CACHE).then(c => c.keys().then(keys => Promise.all(keys.map(k => c.match(k).then(r => {
      const n = r && r.headers && +r.headers.get('content-length'); return n > 0 ? n : 0; })))
      .then(sizes => { S.cached = keys.length; S.cachedMB = sizes.reduce((a, b) => a + b, 0) / 1048576; return S; })))
      .catch(() => { S.cached = null; return S; });
  }
  // the button: drop the media cache, ask the worker to update, reload the page
  function refresh() {
    const steps = [];
    if (W.caches) steps.push(W.caches.delete(CACHE).catch(() => {}));
    if (hasSW()) steps.push(W.navigator.serviceWorker.getRegistration().then(r => r ? r.update().catch(() => {}) : null).catch(() => {}));
    return Promise.all(steps).then(() => { W.location.reload(); });
  }
  const line = () => {
    const b = S.build ? S.build.slice(0, 8) : '?';
    const sv = S.server === null ? 'server unknown' : (S.server === S.build ? 'server the same' : 'server ' + S.server.slice(0, 8) + ' (a newer build - reload)');
    const c = S.cachedMB === null ? 'cache unknown' : ('media cached ' + S.cachedMB.toFixed(1) + ' MB in ' + S.cached + ' files');
    return 'build ' + b + ' · ' + sv + ' · ' + c + ' · worker ' + S.sw + (S.error ? ' (' + S.error + ')' : '');
  };
  register();
  W.STORAGE = { state: S, line, refresh, measure, checkServer, CACHE };
})();
