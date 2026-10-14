// THE DRAWN ROUTE'S DOOR IN THE PAGE (G3070 ROUTE-LAZY): the drawing (route_draw.js) is its own file beside the
// page (route_draw.<h8>.js; dev.html src/viewer/route_draw.js), fetched and run on first demand - setOn(true) (the
// map's draw mode), fly / leave, want() (FLY > drawn route unfolded) - or run by the boot ahead of app.js when an
// ARMED route is stored (tools/build.js ROUTE_LOADER). Until then this answers from the stored draft and draws
// nothing; a stored armed route reaches a new pilot even if the file could not be had (the record is the core's).
const ROUTE_DRAW = (() => {
  'use strict';
  const G = typeof window !== 'undefined' ? window : globalThis;
  let UI = null, D = null, loading = null;
  // the drawing has run (the boot's armed route, or a fetch): it takes the page's doors
  function bindUI(ui) {
    if (UI || !ui) return;
    UI = ui;
    if (D) UI.attach(D);
  }
  if (G.ROUTE_DRAW_UI) bindUI(G.ROUTE_DRAW_UI);
  // the stored draft, as the drawing's attach reads it (flydiy.routeDraw { v, route, fly })
  function draft() {
    if (!D || typeof routeNormalise !== 'function') return null;
    try {
      const d = JSON.parse(D.prefGet('flydiy.routeDraw', 'null'));
      const r = d && d.route ? routeNormalise(d.route) : null;
      return r ? { route: r, armed: !!d.fly && r.pts.length > 0 } : null;
    } catch (e) { return null; }
  }
  // FETCH AND RUN, once (a failure is said and the next demand tries again). The file is this build's
  // (FLYDIY_ROUTE_SRC: route_draw.<h8>.js, cache-first in sw.js); sw.js is told to keep it for the next boot.
  function ready() {
    if (UI) return Promise.resolve(UI);
    if (!loading) {
      loading = Promise.resolve().then(() => {
        const src = G.FLYDIY_ROUTE_SRC;
        if (!src) throw new Error('this page names no route_draw file');
        return fetch(src).then(r => { if (!r.ok) throw new Error(src + ' ' + r.status); return r.text(); });
      }).then(text => {
        if (!UI) {
          const s = document.createElement('script');
          s.textContent = text;
          (document.head || document.body).appendChild(s);
          if (!UI && G.ROUTE_DRAW_UI) bindUI(G.ROUTE_DRAW_UI);
        }
        if (!UI) throw new Error('the route drawing ran but did not register');
        G.FLYDIY_ROUTE_RAN = G.FLYDIY_ROUTE_SRC;
        try { if (G.navigator && navigator.serviceWorker) navigator.serviceWorker.ready.then(r => { if (r.active) r.active.postMessage({ flydiy: 'route-draw', src: G.FLYDIY_ROUTE_SRC }); }); } catch (e) {}
        return UI;
      }).catch(e => {
        loading = null;
        console.warn('flyDiy: the route drawing did not load (' + (e && e.message) + ')');
        throw e;
      });
    }
    return loading;
  }
  // an action that needs the drawing: at once when it is there, else once it is - then the rail shows the new state
  function later(fn) {
    if (UI) return fn(UI);
    ready().then(ui => { fn(ui); if (D && D.rail) D.rail(); }, () => {});
  }
  return {
    bindUI, ready, want: () => { ready().catch(() => {}); }, loaded: () => !!UI,
    attach(deps) { D = deps; if (UI) UI.attach(deps); },
    on: () => (UI ? UI.on() : false),
    armed: () => (UI ? UI.armed() : !!(draft() || {}).armed),
    route: () => (UI ? UI.route() : (draft() || {}).route || null),
    flying: () => (UI ? UI.flying() : false),
    profile: () => (UI ? UI.profile() : null),
    setOn: on => { if (UI) UI.setOn(on); else if (on) later(ui => ui.setOn(true)); },
    fly: () => later(ui => ui.fly()),
    leave: () => later(ui => ui.leave()),
    // a new flight's pilot: an armed route is its (the drawing's own rule; the stored one when the file is not here)
    onPilot(p) {
      if (UI) return UI.onPilot(p);
      const d = draft();
      if (!d || !d.armed || !p || !p.flyRoute) return;
      try { p.flyRoute(routeNormalise(d.route)); } catch (e) { console.error('route:', e); }
    },
    // drawMap's: nothing to draw, no frame of its own, until the drawing is there
    mapView: () => (UI ? UI.mapView() : null),
    setFrame: f => { if (UI) UI.setFrame(f); },
    drawOnMap: (g, PX, PY, mk, W2, labPut) => { if (UI) UI.drawOnMap(g, PX, PY, mk, W2, labPut); },
    tick: () => { if (UI) UI.tick(); },
    // the gates' and the still rigs' (await ROUTE_DRAW.ready() first): the drawing's own, once it is there
    add: (x, z, at) => (UI ? UI.add(x, z, at) : null),
    load: r => (UI ? UI.load(r) : null),
    select: i => { if (UI) UI.select(i); },
    state: () => (UI ? UI.state() : { on: false, armed: !!(draft() || {}).armed, sel: -1, n: ((draft() || {}).route || { pts: [] }).pts.length, view: null, msg: '', loaded: false }),
  };
})();
if (typeof window !== 'undefined') window.ROUTE_DRAW = ROUTE_DRAW;
