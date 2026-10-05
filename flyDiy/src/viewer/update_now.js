// update_now.js - "A NEW VERSION IS AVAILABLE - UPDATE" (UPDATE-NOW, G1535-G1539)
//
// The user, 2026-10-04: "How to ensure the latest version of the game is served? We used to have dedicated refresh
// buttons for other service worker-based apps." That day GitHub Pages started no deploy for three trains and the live
// site served an old build for ~14 h, tested unknowingly. And a plain reload is not enough: Pages serves the page with
// Cache-Control max-age=600, so F5 can bring back a page up to ten minutes old.
//
// - THE CHECK. version.json (tools/build.js writes it beside the page) fetched with cache:'no-store' and a ?t= query (the
//   browser's cache and the CDN's both bypassed), compared with the build THIS page was built with (window.FLYDIY_BUILD,
//   which build.js now writes into the BOOT slot right ahead of this file, so it is known from the first ~100 ms - the
//   rest of the page's scripts run only after the welcome and the island). Checked at boot, when the tab comes back
//   (visibilitychange / focus, at most once every 30 s) and every 5 min while the tab is visible. setTimeout and
//   events only: nothing in the render loop, no other request.
// - THE PILL. Shown whenever the server's build differs from the page's: "A new version is available · Update · ×",
//   bottom centre, above the welcome card and the loading screen (z 95; the loading screen's panel and card step up
//   above it while it is there), a finger-size target on a touch screen. × hides
//   it for this tab's session (sessionStorage, per server build: a NEWER one shows again). Nothing on a failed fetch
//   (offline, a 404, garbage): no answer is no news. The rigs (navigator.webdriver / HeadlessChrome) never see it
//   (a shared tree is rebuilt under a running rig all day); ?update=1 forces it on, ?update=0 off.
// - UPDATE. Never automatic - in flight the pill waits for the press. The press (1) saves what the autosaves save
//   (garage.js's GARAGE_SPEC.commit: the working aeroplane, flydiy.wip; and every flush registered with
//   UPDATE_NOW.onBeforeUpdate - the premises editor's pending record), then (2) navigates to the same URL with
//   ?v=<server build> added (every other parameter and the hash kept): a URL the HTTP cache and the CDN have never seen,
//   so a max-age page cannot come back. The new page strips ?v= again at once (history.replaceState), before anything
//   reads its own URL.
// - THE STAMP. "build 1a2b3c4d · 4 Oct 2026" (FLYDIY_BUILD_DATE: the date version.json first carried this build) on the
//   loading screen under the brand, in the welcome card's footer (welcome.js) and in the GRAPHICS menu (storage.js's
//   line) - so the user can tell which train is on test.
//
// GATE UPDATE (tools/_update_check.js) runs this file in a stubbed window.
(function () {
  'use strict';
  const W = typeof window !== 'undefined' ? window : null;
  if (!W) return;
  const PARAM = 'v';
  const EVERY = 5 * 60 * 1000, REGAIN = 30 * 1000;
  const DISMISS = 'flydiy.updateDismissed';
  const S = { build: W.FLYDIY_BUILD || null, date: W.FLYDIY_BUILD_DATE || null, server: null, serverAt: null,
              checks: 0, failed: 0, last: 0, shown: false, going: false };
  const loc = () => W.location || { href: '', search: '', pathname: '' };
  const q = () => loc().search || '';
  const nav = W.navigator || {};
  const RIG = !!(nav.webdriver || /HeadlessChrome/.test(nav.userAgent || ''));
  const FORCE = /[?&]update=1(&|$)/.test(q()), OFF = /[?&]update=0(&|$)/.test(q());
  const enabled = () => !OFF && (FORCE || !RIG);

  // ---- the stamp ---------------------------------------------------------------------------------------------------
  const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const day = iso => { const m = /^(\d{4})-(\d\d)-(\d\d)/.exec(String(iso || '')); return m ? (+m[3]) + ' ' + MON[+m[2] - 1] + ' ' + m[1] : ''; };
  const short = b => (b ? String(b).slice(0, 8) : 'unbuilt');
  // 'build 1a2b3c4d · 4 Oct 2026' - the page's own build (never the server's)
  const stamp = () => 'build ' + short(S.build) + (S.date ? ' · ' + day(S.date) : '');

  // ---- the URL -----------------------------------------------------------------------------------------------------
  // the update's address: the same page, every parameter and the hash kept, ?v=<server build> set (replaced if there)
  function updateUrl(href, server) {
    const u = new URL(href);
    u.searchParams.set(PARAM, String(server || Date.now()));
    return u.toString();
  }
  // the address without the cache-buster (null when there is none to take off)
  function stripUrl(href) {
    const u = new URL(href);
    if (!u.searchParams.has(PARAM)) return null;
    u.searchParams.delete(PARAM);
    return u.toString();
  }
  // at once, at eval: the address bar and every later reader of location.search see the user's own URL
  try {
    const clean = stripUrl(loc().href);
    if (clean && W.history && W.history.replaceState) W.history.replaceState(W.history.state, '', clean);
  } catch (e) {}

  // ---- the check ---------------------------------------------------------------------------------------------------
  let inflight = null;
  function check() {
    if (inflight) return inflight;
    if (typeof W.fetch !== 'function') return Promise.resolve(null);
    S.checks++; S.last = Date.now();
    inflight = W.fetch('version.json?t=' + Date.now(), { cache: 'no-store' })
      .then(r => (r && r.ok ? r.json() : null))
      .then(v => {
        if (!v || typeof v.build !== 'string' || !v.build) throw new Error('no build in version.json');
        S.server = v.build; S.serverAt = typeof v.date === 'string' ? v.date : null;
        return S.server;
      })
      .catch(() => { S.failed++; S.server = null; S.serverAt = null; return null; })
      .then(b => { inflight = null; render(); notify(); return b; });
    return inflight;
  }
  const newer = () => !!(S.server && S.build && S.server !== S.build);
  const listeners = [];
  const notify = () => { for (const f of listeners) { try { f(S); } catch (e) {} } };

  // ---- the pill ----------------------------------------------------------------------------------------------------
  const CSS = `
#updNow { position:fixed; left:50%; bottom:max(14px, env(safe-area-inset-bottom)); transform:translateX(-50%); z-index:95;
  display:flex; align-items:center; gap:4px; padding:4px 4px 4px 14px; max-width:calc(100vw - 32px); box-sizing:border-box;
  background:rgba(26,24,21,.92); border:1px solid rgba(230,161,90,.55); border-radius:22px; box-shadow:0 6px 24px rgba(0,0,0,.45);
  color:#f4efe6; font:400 13px/1.2 'IBM Plex Sans', ui-sans-serif, system-ui, sans-serif; pointer-events:auto; }
#updNow[hidden] { display:none; }
#updNow .uMsg { white-space:nowrap; overflow:hidden; text-overflow:ellipsis; margin-right:6px; }
#updNow .uMsg i { font-style:normal; color:#a59d8f; font-size:11px; margin-left:6px; }
#updNow button { font:600 13px/1 'IBM Plex Sans', ui-sans-serif, system-ui, sans-serif; cursor:pointer; border-radius:18px;
  min-height:32px; transition:none; backdrop-filter:none; -webkit-backdrop-filter:none; }
#updNow .uGo { padding:0 16px; color:#1a1815; background:#e6a15a; border:1px solid #e6a15a; letter-spacing:.04em; }
#updNow .uGo:hover { background:#f0b574; }
#updNow .uX { width:32px; padding:0; color:#a59d8f; background:none; border:1px solid transparent; font-size:17px; font-weight:400; }
#updNow .uX:hover { color:#f4efe6; }
@media (pointer:coarse) { #updNow { padding-left:16px; } #updNow button { min-height:44px; border-radius:22px; } #updNow .uX { width:44px; } }
#updNow .uShort { display:none; }
@media (max-width:560px) { #updNow .uMsg i, #updNow .uLong { display:none; } #updNow .uShort { display:inline; } }
/* WHERE IT SITS: bottom centre on the welcome and loading screens; over the 3D view's centre in the garage (between the
   bench panel and the editor: editor.css --ws-left / --ws-right); in flight the right column above the verbs (#flActs) -
   the PFD holds the top centre and the trace panel the bottom left two thirds - and on a phone in flight right-aligned
   over the verbs' two rows (the plates and the PFD stack down to mid-screen there; the trace panel, when opened, is the
   one thing it can overlap); the world
   editor's view (body.premOpen: its panel is the right 436 px) bottom centre; never in a photo (body.shot) */
body.mode-ws #updNow { bottom:128px; }
@media (min-width:901px) {
  body.mode-ws #updNow { bottom:72px; left:calc(var(--ws-left, 0px) + (100vw - var(--ws-left, 0px) - var(--ws-right, 0px)) / 2);
    max-width:calc(100vw - var(--ws-left, 0px) - var(--ws-right, 0px) - 24px); }
}
body.mode-fly #updNow { left:auto; right:22px; bottom:76px; transform:none; }
@media (max-width:760px) { body.mode-fly #updNow { right:12px; bottom:112px; } }
body.mode-fly.premOpen #updNow { right:auto; top:auto; left:calc((100vw - 436px) / 2); bottom:14px; transform:translateX(-50%); }
body.shot #updNow { display:none; }
html.updNowUp #bootPanel { bottom:84px; }
@media (min-width:901px) { html.updNowUp #bootCard { bottom:84px; } }
#bootBuild { margin-top:3px; font:400 10.5px/1.2 'IBM Plex Sans', ui-sans-serif, system-ui, sans-serif; letter-spacing:.06em; color:#8f887b; }
`;
  let pill = null;
  const doc = () => W.document || null;
  const sheet = () => {
    const d = doc(); if (!d || !d.createElement || d.getElementById('updNowCss')) return;
    const s = d.createElement('style'); s.id = 'updNowCss'; s.textContent = CSS; (d.head || d.body || d.documentElement).appendChild(s);
  };
  const dismissed = () => { try { return W.sessionStorage.getItem(DISMISS) === S.server; } catch (e) { return false; } };
  function build() {
    const d = doc(); if (!d || !d.createElement || !(d.body || d.documentElement)) return null;
    sheet();
    const mk = (tag, cls, text) => { const e = d.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
    const o = mk('div'); o.id = 'updNow'; o.setAttribute('role', 'status'); o.setAttribute('aria-live', 'polite');
    const msg = mk('span', 'uMsg');
    msg.appendChild(mk('span', 'uLong', 'A new version is available')); msg.appendChild(mk('span', 'uShort', 'New version'));
    const ver = mk('i', null, ''); msg.appendChild(ver);
    const go = mk('button', 'uGo', 'Update'); go.type = 'button';
    go.title = 'save your work and reload the newest build (the page is fetched fresh, past every cache)';
    go.onclick = () => update();
    const x = mk('button', 'uX', '×'); x.type = 'button'; x.title = 'not now (until a newer build, or the next visit)';
    x.setAttribute('aria-label', 'dismiss');
    x.onclick = () => { try { W.sessionStorage.setItem(DISMISS, S.server || ''); } catch (e) {} render(); };
    o.appendChild(msg); o.appendChild(go); o.appendChild(x);
    o._ver = ver;
    (d.body || d.documentElement).appendChild(o);
    return o;
  }
  function render() {
    stampBoot();
    const want = enabled() && newer() && !dismissed() && !S.going;
    // the loading screen's panel and card step up while the pill is there (its bar and its per cent stay in view)
    try { const h = doc() && doc().documentElement; if (h && h.classList) h.classList.toggle('updNowUp', !!want); } catch (e) {}
    if (!want) { if (pill) pill.hidden = true; S.shown = false; return; }
    if (!pill || !pill.isConnected) pill = build();
    if (!pill) return;
    pill._ver.textContent = short(S.build) + ' → ' + short(S.server);
    pill.hidden = false; S.shown = true;
  }
  // the loading screen's line under the brand (the BOOT slot follows #boot in body.html: it is there at eval)
  function stampBoot() {
    const d = doc(); if (!d || !d.getElementById) return;
    const brand = d.getElementById('bootBrand'); if (!brand || !brand.parentNode) return;
    let el = d.getElementById('bootBuild');
    if (!el) { sheet(); el = d.createElement('div'); el.id = 'bootBuild'; brand.parentNode.insertBefore(el, brand.nextSibling); }
    el.textContent = stamp();
  }

  // ---- update ------------------------------------------------------------------------------------------------------
  const flushes = [];
  // a module with work a debounce has not written yet registers its flush here (premises_ui.js does)
  const onBeforeUpdate = f => { if (typeof f === 'function') flushes.push(f); };
  function saveAll() {
    const done = [];
    try { const G = W.GARAGE_SPEC; if (G && typeof G.commit === 'function') { G.commit(); done.push('garage'); } } catch (e) {}
    for (const f of flushes) { try { f(); done.push('flush'); } catch (e) {} }
    return done;
  }
  function update() {
    if (S.going) return null;
    S.going = true;
    saveAll();
    let to;
    try { to = updateUrl(loc().href, S.server); } catch (e) { to = null; }
    if (pill) { pill.hidden = true; }
    if (to && typeof loc().assign === 'function') loc().assign(to); else if (typeof loc().reload === 'function') loc().reload();
    return to;
  }

  // ---- the schedule ------------------------------------------------------------------------------------------------
  const visible = () => { const d = doc(); return !d || d.visibilityState !== 'hidden'; };
  let timer = null;
  const arm = () => {
    if (typeof W.setTimeout !== 'function') return;
    if (timer && typeof W.clearTimeout === 'function') W.clearTimeout(timer);
    timer = W.setTimeout(() => { timer = null; if (visible()) check(); arm(); }, EVERY);
  };
  const regain = () => { if (visible() && Date.now() - S.last >= REGAIN) check(); };

  W.UPDATE_NOW = { state: S, check, render, update, saveAll, onBeforeUpdate, updateUrl, stripUrl, stamp, day, newer,
                   onChange: f => { if (typeof f === 'function') listeners.push(f); }, PARAM, EVERY, REGAIN, RIG, enabled };

  stampBoot();
  if (!enabled()) return;
  const d0 = doc();
  if (d0 && d0.addEventListener) d0.addEventListener('visibilitychange', regain);
  if (W.addEventListener) W.addEventListener('focus', regain);
  check();
  arm();
})();
