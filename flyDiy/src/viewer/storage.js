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
    const go = () => {
      W.navigator.serviceWorker.register('sw.js').then(r => {
        S.sw = r.active ? 'active' : 'installing';
        r.addEventListener('updatefound', () => { const had = !!r.active; const w = r.installing; S.sw = had ? 'updating' : 'installing';
          if (w) w.addEventListener('statechange', () => { if (w.state === 'activated') S.sw = 'active'; }); });
      })
        .catch(e => { S.sw = 'failed'; S.error = String(e && e.message || e); });
    };
    // AS0a's find (G902): this script can run after the page's `load` has fired, and a listener added then
    // never runs - the worker never registered. Register at once when the load is behind us.
    if (W.document && W.document.readyState === 'complete') go(); else W.addEventListener('load', go);
  }
  // the server's build: version.json, never from a cache. G1535: update_now.js (the BOOT slot) owns the one check -
  // it also bypasses the CDN (?t=) and shows the "Update" pill; this asks it, and fetches itself only without it
  function checkServer() {
    const U = W.UPDATE_NOW;
    if (U && typeof U.check === 'function') return U.check().then(() => { S.server = U.state.server; S.serverAt = U.state.serverAt; stamp(); return S.server; });
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
  // G1535: the page's own build DATE (FLYDIY_BUILD_DATE, the BOOT slot) - the date version.json carries is the
  // server's, which is exactly the one that differs when the page is stale
  const day = () => (W.UPDATE_NOW && W.FLYDIY_BUILD_DATE ? ' (' + W.UPDATE_NOW.day(W.FLYDIY_BUILD_DATE) + ')' : '');
  const line = () => {
    const b = (S.build ? S.build.slice(0, 8) : '?') + day();
    const sv = S.server === null ? 'server unknown' : (S.server === S.build ? 'server the same' : 'server ' + S.server.slice(0, 8) + ' (a newer build - press Update)');
    const c = S.cachedMB === null ? 'cache unknown' : ('media cached ' + S.cachedMB.toFixed(1) + ' MB in ' + S.cached + ' files');
    return 'build ' + b + ' · ' + sv + ' · ' + c + ' · worker ' + S.sw + (S.error ? ' (' + S.error + ')' : '');
  };
  register();
  // G437 (A2): THE VERSION LINE ON THE SHED'S PANEL (the user: "I need an
  // indication of the version number somewhere"). The build id the page was
  // built with, the date version.json carries for it, the page's name;
  // "a newer build on the server" when the two disagree (a cached page).
  function stamp() {
    const el = W.document && W.document.getElementById('edVersion'); if (!el) return;
    const b = S.build ? S.build.slice(0, 8) : 'unbuilt';
    const page = isDev() ? 'dev.html' : 'index.html';
    const d = W.UPDATE_NOW && W.FLYDIY_BUILD_DATE ? ' · ' + W.UPDATE_NOW.day(W.FLYDIY_BUILD_DATE) : (S.serverAt ? ' · ' + S.serverAt.slice(0, 10) : '');
    const newer = S.server && S.build && S.server !== S.build ? ' · a newer build on the server: press Update' : '';
    el.textContent = 'build ' + b + d + ' · ' + page + newer;
  }
  // the pill's every answer re-stamps the shed's line (a check from the timer or a regained tab)
  if (W.UPDATE_NOW && W.UPDATE_NOW.onChange) W.UPDATE_NOW.onChange(U => { S.server = U.server; S.serverAt = U.serverAt; stamp(); });
  if (W.document) {
    const go = () => { stamp(); checkServer().then(stamp, stamp); };
    if (W.document.readyState === 'loading') W.document.addEventListener('DOMContentLoaded', go); else go();
  }
  W.STORAGE = { state: S, line, refresh, measure, checkServer, CACHE, stamp };
})();
