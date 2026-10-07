// ============================================================
// THE ROUTE, DRAWN ON THE MAP (G2120 ROUTE-DRAW, 2026-10-07). The user:
// "regarding autopilot, can we now draw a trajectory (control points +
// altitude) for the autopilots?"
//
// THE GESTURES (the in-flight map, #mm, in its DRAW mode; a mouse, a pen or a
// finger - pointer events throughout):
//   click / tap an empty spot     a point there (on a leg: inserted into it),
//                                 at a safe height over the ground about it
//                                 (38c_route.js routeSafeAlt), MSL or AGL as chosen
//   drag a point                  moves it (its altitude kept, in its own ref)
//   right-click / long-press      deletes it
//   drag the map / wheel / pinch  pans / zooms the drawing's view
// THE PANEL (#rtp, under the map in the same plate): the name, the saved
// routes (a library, flydiy.routes), every point's altitude (MSL | AGL) and
// speed, what happens after the last point (hold / home / land), the PROFILE -
// altitude against distance with the ground (and the trees) under the legs,
// red where the profile clears it by less than the margin, a point the
// aeroplane cannot make (routeProfile's verdicts) flagged as it is drawn - and
// FLY THIS ROUTE (43_pilot.js ap.flyRoute; the worker's pilot through
// sim_link.js route). While the route is flown the strip carries the aeroplane
// and the active point; the plan line (app.js railPlan) the point, its
// altitude and the vertical speed against the limit.
//
// THE RECORD is 38c_route.js's plain object; the draft and whether it is armed
// are remembered with the flight (flydiy.routeDraw: an armed route is handed to
// every new flight's pilot), the named routes in flydiy.routes. Nothing here
// runs a frame while the map is closed and no route is drawn: drawOnMap returns
// at once, tick is called by drawMap only.
//
// app.js attaches it (ROUTE_DRAW.attach(deps)) and calls drawOnMap / tick from
// drawMap, mapView for the frame, onPilot from the flights' mkPilot sites.
// ============================================================
const ROUTE_DRAW = (() => {
  'use strict';
  const COL = { route: '#f58fd8', routeDim: 'rgba(245,143,216,.55)', bad: '#ff6b5a', ink: '#fbf4ea', dark: 'rgba(20,14,8,.85)',
                ground: '#6d5b44', groundTop: '#a68b62', teal: '#63d3cc', amber: '#ffd35a' };
  const S = { on: false, route: null, armed: false, sel: -1, view: null, frame: null, prof: null, dirty: true, profT: 0,
              newRef: 'msl', drag: null, ptrs: new Map(), el: null, msg: '', saved: null, lastFrom: null, flownId: null };
  let D = null;    // app.js's doors (attach)
  const $ = id => (typeof document !== 'undefined' ? document.getElementById(id) : null);
  const clone = o => JSON.parse(JSON.stringify(o));
  const pref = (k, d) => { try { const v = JSON.parse(D.prefGet(k, 'null')); return v == null ? d : v; } catch (e) { return d; } };
  const fmtKm = d => d >= 1000 ? (d / 1000).toFixed(1) + ' km' : Math.round(d) + ' m';

  // ---- the record, remembered ------------------------------------------------------------------------------------
  function saveDraft() { try { D.prefSet('flydiy.routeDraw', JSON.stringify({ v: 1, route: S.route, fly: S.armed })); } catch (e) {} }
  function library() { const L = pref('flydiy.routes', []); return Array.isArray(L) ? L.map(r => routeNormalise(r)).filter(Boolean) : []; }
  function saveLibrary(L) { try { D.prefSet('flydiy.routes', JSON.stringify(L.slice(0, 40))); } catch (e) {} }
  // an edit to a route the pilot holds ARMED (not yet begun) is handed to it at once; one being flown, or flown already,
  // waits for 'fly the edits'
  function changed() { S.dirty = true; saveDraft(); const a = ap(); if (S.armed && a && a.drawn && a.drawn.state === 'armed') armNow(); redraw(); }

  const ap = () => D && D.ap();
  const world = () => D && D.world();
  const flying = () => { const a = ap(), d = a && a.drawn; return !!(d && (d.state === 'flying' || d.state === 'hold') && S.route && d.route && d.route.id === S.route.id); };
  const perf = () => { const a = ap(); try { return a && a.routePerf ? a.routePerf() : null; } catch (e) { return null; } };

  // ---- the profile: from the field before the take-off, the aeroplane in the air, the route's join while flown ----
  function fromNow() {
    const a = ap(), sim = D.sim();
    if (!a || !sim) return null;
    const d = a.drawn;
    if (flying() && a.legs && a.legs[0] && a.legs[0].A && a.legs[0].hA != null) return { x: a.legs[0].A[0], z: a.legs[0].A[1], h: a.legs[0].hA };
    const c = sim.cgPos();
    if (sim.wheelsOnGround && sim.wheelsOnGround() === 0 && D.started()) return { x: c[0], z: c[2], h: c[1] };
    const f = a.route && a.route.from;
    return f ? { x: f.x, z: f.z, h: f.elev || 0 } : { x: c[0], z: c[2], h: c[1] };
  }
  function profile() {
    if (!S.route || !S.route.pts.length || typeof routeProfile !== 'function') { S.prof = null; return null; }
    const now = Date.now();
    if (!S.dirty && S.prof && now - S.profT < 2000) return S.prof;
    const from = fromNow();
    const k = from ? Math.round(from.x / 50) + ',' + Math.round(from.z / 50) + ',' + Math.round(from.h / 5) : '-';
    if (!S.dirty && S.prof && k === S.lastFrom) { S.profT = now; return S.prof; }
    S.prof = routeProfile(S.route, world(), { perf: perf() || undefined, from });
    S.lastFrom = k; S.dirty = false; S.profT = now;
    return S.prof;
  }

  // ---- flying it ------------------------------------------------------------------------------------------------
  function armNow() {
    const a = ap();
    if (!a || !a.flyRoute || !S.route || !S.route.pts.length) return null;
    const rec = routeNormalise(S.route);
    const how = a.flyRoute(rec);
    const W = D.simw && D.simw();
    if (W && W.route) W.route(rec);
    S.flownId = rec.id;
    return how;
  }
  function fly() {
    if (!S.route || !S.route.pts.length) { S.msg = 'Draw at least one point on the map first.'; return; }
    S.armed = true;
    const how = armNow();
    S.msg = how === 'armed' ? 'Armed: flown after the take-off’s climb-out.' : how === 'now' ? 'Flying it from here.' : how === 'queued' ? 'Armed for the next departure.' : 'The pilot cannot take it (' + how + ').';
    saveDraft(); build(); redraw();
  }
  function leave() {
    S.armed = false;
    const a = ap();
    if (a && a.flyRoute) a.flyRoute(null);
    const W = D.simw && D.simw();
    if (W && W.route) W.route(null);
    S.msg = 'Off the route: the autopilot flies its destination.';
    saveDraft(); build(); redraw();
  }
  // a new flight's pilot (app.js: the reset, the skip to line-up, a new aeroplane): an armed route is its
  function onPilot(p) {
    if (!S.armed || !S.route || !S.route.pts.length || !p || !p.flyRoute) return;
    try { p.flyRoute(routeNormalise(S.route)); S.flownId = S.route.id; } catch (e) { console.error('route:', e); }
  }

  // ---- the map: the view, the frame, the overlay, the gestures ---------------------------------------------------
  function fitView() {
    const B = D.box();
    if (S.route && S.route.pts.length >= 2) {
      let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
      for (const p of S.route.pts) { x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); z0 = Math.min(z0, p.z); z1 = Math.max(z1, p.z); }
      S.view = { cx: (x0 + x1) / 2, cz: (z0 + z1) / 2, range: Math.min(B.size, Math.max(4000, 1.5 * Math.max(x1 - x0, z1 - z0))) };
    } else {
      const sim = D.sim(), c = sim ? sim.cgPos() : [B.x0 + B.size / 2, 0, B.z0 + B.size / 2];
      S.view = { cx: c[0], cz: c[2], range: Math.min(B.size, 16000) };
    }
  }
  // drawMap's frame in draw mode (north up, the drawing's own view), or null: the map's own
  function mapView() { return S.on && S.view ? S.view : null; }
  function setFrame(f) { S.frame = f; }
  function toWorld(bx, by) {
    const F = S.frame; if (!F) return null;
    const dx = (bx - F.W2 / 2) / F.k, dy = (by - F.W2 / 2) / F.k, co = Math.cos(F.rot), si = Math.sin(F.rot);
    return [F.cx + dx * co + dy * si, F.cz - dx * si + dy * co];
  }
  function toScreen(x, z) {
    const F = S.frame; if (!F) return null;
    const co = Math.cos(F.rot), si = Math.sin(F.rot);
    return [F.W2 / 2 + F.k * ((x - F.cx) * co - (z - F.cz) * si), F.W2 / 2 + F.k * ((x - F.cx) * si + (z - F.cz) * co)];
  }
  function canvasXY(e) {
    const cv = $('mm'), r = cv.getBoundingClientRect();
    return [(e.clientX - r.left) * cv.width / Math.max(1, r.width), (e.clientY - r.top) * cv.height / Math.max(1, r.height)];
  }
  function hitPt(bx, by, touch) {
    if (!S.route || !S.frame) return -1;
    const mk = S.frame.W2 / 344, R = (touch ? 22 : 12) * mk;
    let best = -1, bd = R;
    S.route.pts.forEach((p, i) => { const s = toScreen(p.x, p.z), d = Math.hypot(s[0] - bx, s[1] - by); if (d < bd) { bd = d; best = i; } });
    return best;
  }
  function hitLeg(bx, by) {
    if (!S.route || S.route.pts.length < 2) return -1;
    const mk = S.frame.W2 / 344, R = 8 * mk;
    for (let i = 1; i < S.route.pts.length; i++) {
      const a = toScreen(S.route.pts[i - 1].x, S.route.pts[i - 1].z), b = toScreen(S.route.pts[i].x, S.route.pts[i].z);
      const vx = b[0] - a[0], vy = b[1] - a[1], L2 = vx * vx + vy * vy || 1;
      const t = Math.max(0, Math.min(1, ((bx - a[0]) * vx + (by - a[1]) * vy) / L2));
      if (t > 0.05 && t < 0.95 && Math.hypot(a[0] + t * vx - bx, a[1] + t * vy - by) < R) return i;
    }
    return -1;
  }
  function delPt(i) {
    if (!S.route || i < 0 || i >= S.route.pts.length) return;
    S.route.pts.splice(i, 1);
    S.sel = Math.min(S.sel, S.route.pts.length - 1);
    changed(); build();
  }
  function addPt(w, at) {
    if (!S.route) S.route = routeNew('Route ' + (library().length + 1));
    const p = routeAddPt(S.route, world(), w[0], w[1], at, S.newRef);
    if (!p) { S.msg = 'A route holds ' + ROUTE_MAX_PTS + ' points.'; build(); return; }
    S.sel = S.route.pts.indexOf(p);
    changed(); build();
  }
  function down(e) {
    if (!S.on) return;
    e.stopPropagation(); e.preventDefault();
    const cv = $('mm');
    try { cv.setPointerCapture(e.pointerId); } catch (err) {}
    const [bx, by] = canvasXY(e);
    S.ptrs.set(e.pointerId, [bx, by]);
    if (S.ptrs.size === 2) {   // a pinch: the first finger's drag is the pinch now
      const [a, b] = [...S.ptrs.values()];
      clearTimeout(S.drag && S.drag.lp);
      S.drag = { kind: 'pinch', d0: Math.hypot(a[0] - b[0], a[1] - b[1]) || 1, range0: S.view.range, moved: true };
      return;
    }
    if (e.button === 2) return;   // the context menu deletes
    const touch = e.pointerType === 'touch' || e.pointerType === 'pen';
    const i = hitPt(bx, by, touch);
    S.drag = { kind: i >= 0 ? 'pt' : 'pan', i, x0: bx, y0: by, cx0: S.view.cx, cz0: S.view.cz, moved: false, lp: null };
    if (i >= 0) { S.sel = i; build(); }
    if (i >= 0 && touch) S.drag.lp = setTimeout(() => { if (S.drag && !S.drag.moved && S.drag.i === i) { S.drag = null; delPt(i); } }, 600);
  }
  function move(e) {
    if (!S.on || !S.drag) return;
    const [bx, by] = canvasXY(e);
    if (S.ptrs.has(e.pointerId)) S.ptrs.set(e.pointerId, [bx, by]);
    const G = S.drag;
    if (G.kind === 'pinch') {
      if (S.ptrs.size < 2) return;
      const [a, b] = [...S.ptrs.values()];
      S.view.range = clampRange(G.range0 * G.d0 / (Math.hypot(a[0] - b[0], a[1] - b[1]) || 1));
      redraw(); return;
    }
    if (!G.moved && Math.hypot(bx - G.x0, by - G.y0) < 6 * S.frame.W2 / 344) return;
    if (!G.moved) { G.moved = true; clearTimeout(G.lp); }
    if (G.kind === 'pt') {
      const w = toWorld(bx, by), p = S.route.pts[G.i];
      if (!w || !p) return;
      p.x = Math.round(w[0]); p.z = Math.round(w[1]);
      S.dirty = true; redraw();
    } else {
      const k = S.frame.k;
      S.view.cx = G.cx0 - (bx - G.x0) / k; S.view.cz = G.cz0 - (by - G.y0) / k;
      redraw();
    }
  }
  function up(e) {
    S.ptrs.delete(e.pointerId);
    if (!S.on || !S.drag) return;
    const G = S.drag;
    clearTimeout(G.lp);
    if (G.kind === 'pinch') { if (S.ptrs.size === 0) S.drag = null; return; }
    S.drag = null;
    if (e.type === 'pointercancel') return;
    if (G.kind === 'pt') { if (G.moved) { changed(); build(); } return; }
    if (G.moved) return;
    const [bx, by] = canvasXY(e);
    const w = toWorld(bx, by);
    if (!w) return;
    const at = hitLeg(bx, by);
    addPt(w, at >= 0 ? at : null);
  }
  const clampRange = r => Math.max(1500, Math.min(D.box().size * 1.2, r));
  function wheel(e) {
    if (!S.on) return;
    e.preventDefault(); e.stopPropagation();
    const [bx, by] = canvasXY(e), w0 = toWorld(bx, by);
    S.view.range = clampRange(S.view.range * Math.exp(e.deltaY * 0.0015));
    // zoom about the cursor: the point under it stays under it
    const F = S.frame; F.k = F.W2 / S.view.range; F.cx = S.view.cx; F.cz = S.view.cz;
    const w1 = toWorld(bx, by);
    if (w0 && w1) { S.view.cx += w0[0] - w1[0]; S.view.cz += w0[1] - w1[1]; }
    redraw();
  }
  function ctx(e) {
    if (!S.on) return;
    e.preventDefault(); e.stopPropagation();
    const [bx, by] = canvasXY(e);
    const i = hitPt(bx, by, false);
    if (i >= 0) delPt(i);
  }
  let wired = false;
  function wire() {
    const cv = $('mm');
    if (wired || !cv || !cv.addEventListener) return;
    wired = true;
    cv.addEventListener('pointerdown', down);
    cv.addEventListener('pointermove', move);
    cv.addEventListener('pointerup', up);
    cv.addEventListener('pointercancel', up);
    cv.addEventListener('contextmenu', ctx);
    cv.addEventListener('wheel', wheel, { passive: false });
  }

  // the overlay drawMap calls (after the published plan): the drawn route while it is drawn, armed or not yet flown
  function drawOnMap(g, PX, PY, mk, W2, labPut) {
    if (!S.route || !S.route.pts.length) return;
    if (!S.on && !S.armed) return;
    if (!S.on && flying()) return;               // flown: the pilot's published legs are on the map (drawPlanOnMap)
    const P = S.route.pts, pr = profile();
    g.save();
    g.lineCap = 'round'; g.lineJoin = 'round';
    const from = fromNow();
    if (from && !flying()) {
      g.strokeStyle = COL.routeDim; g.lineWidth = 1.4 * mk; g.setLineDash([2 * mk, 4 * mk]);
      g.beginPath(); g.moveTo(PX(from.x, from.z), PY(from.x, from.z)); g.lineTo(PX(P[0].x, P[0].z), PY(P[0].x, P[0].z)); g.stroke();
    }
    g.strokeStyle = COL.route; g.lineWidth = 2.2 * mk; g.setLineDash(S.armed ? [] : [7 * mk, 4 * mk]);
    g.beginPath(); P.forEach((p, i) => { const x = PX(p.x, p.z), y = PY(p.x, p.z); if (i) g.lineTo(x, y); else g.moveTo(x, y); }); g.stroke();
    g.setLineDash([]);
    // the stretches the profile clears the ground by less than the margin, red over the line
    if (pr && pr.unsafe) {
      g.strokeStyle = COL.bad; g.lineWidth = 3.6 * mk;
      let open = false;
      g.beginPath();
      for (const s of pr.samples) {
        const red = !s.join && s.clr < pr.margin;
        if (red) { const x = PX(s.x, s.z), y = PY(s.x, s.z); if (open) g.lineTo(x, y); else { g.moveTo(x, y); open = true; } }
        else open = false;
      }
      g.stroke();
    }
    // in the draw mode, each point's capture ring (the fly-by passes inside it)
    const pf = perf();
    if (S.on && pf && typeof routeCaptureR === 'function') {
      g.strokeStyle = 'rgba(245,143,216,.25)'; g.lineWidth = 1 * mk;
      P.forEach((p, i) => { const r = routeCaptureR(S.route, i, pf, from) * S.frame.k; if (r > 4 * mk) { g.beginPath(); g.arc(PX(p.x, p.z), PY(p.x, p.z), r, 0, 6.283); g.stroke(); } });
    }
    P.forEach((p, i) => {
      const x = PX(p.x, p.z), y = PY(p.x, p.z);
      if (x < -30 || x > W2 + 30 || y < -30 || y > W2 + 30) return;
      const bad = pr && pr.pts[i] && !pr.pts[i].ok, sel = S.on && i === S.sel;
      g.beginPath(); g.arc(x, y, (sel ? 6.5 : 5) * mk, 0, 6.283);
      g.fillStyle = bad ? COL.bad : COL.route; g.fill();
      g.strokeStyle = sel ? COL.ink : COL.dark; g.lineWidth = (sel ? 2 : 1.2) * mk; g.stroke();
      g.fillStyle = COL.dark; g.font = `700 ${Math.round(8 * mk)}px "IBM Plex Mono", monospace`; g.textAlign = 'center';
      g.fillText(String(i + 1), x, y + 3 * mk); g.textAlign = 'start';
      g.font = `500 ${Math.round(11 * mk)}px "IBM Plex Sans", sans-serif`;
      const h = pr && pr.pts[i] ? Math.round(pr.pts[i].h) : Math.round(p.alt);
      if (S.on || i === 0) labPut(x, y, 'WP' + (i + 1) + ' ' + h + ' m' + (p.ref === 'agl' ? ' (' + Math.round(p.alt) + ' agl)' : '') + (bad ? ' !' : ''), 'rgba(20,14,8,.8)', bad ? '#ffb0a4' : '#ffd0f0');
    });
    g.restore();
  }

  // ---- the panel ----------------------------------------------------------------------------------------------------
  const mkEl = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
  function btn(host, label, fn, title, cls) { const b = mkEl('button', 'rtBtn' + (cls ? ' ' + cls : ''), label); b.type = 'button'; if (title) b.title = title; b.onclick = e => { e.stopPropagation(); fn(); }; host.appendChild(b); return b; }
  function build() {
    if (!S.on) return;
    const plate = $('mmp');
    if (!plate) return;
    let el = $('rtp');
    if (!el) {
      el = mkEl('div'); el.id = 'rtp';
      el.addEventListener('pointerdown', e => e.stopPropagation());   // the plate's drag is not the panel's
      el.addEventListener('wheel', e => e.stopPropagation());
      plate.appendChild(el);
    }
    el.hidden = false;
    el.textContent = '';
    const R = S.route;
    // the head: the name, close
    const hd = mkEl('div', 'rtHead');
    hd.appendChild(mkEl('b', null, 'DRAWN ROUTE'));
    const nm = mkEl('input', 'rtName'); nm.type = 'text'; nm.maxLength = 40; nm.placeholder = 'name'; nm.value = R ? R.name : '';
    nm.onchange = () => { if (!S.route) S.route = routeNew(); S.route.name = nm.value.trim().slice(0, 40) || 'Route'; changed(); };
    hd.appendChild(nm);
    btn(hd, '✕', () => setOn(false), 'Close the drawing (the route stays as it is)', 'rtX');
    el.appendChild(hd);
    // the library
    const lb = mkEl('div', 'rtRow');
    const sel = mkEl('select', 'rtSel');
    const L = library();
    sel.appendChild(Object.assign(mkEl('option', null, L.length ? 'saved routes (' + L.length + ')…' : 'no saved routes'), { value: '' }));
    for (const r of L) sel.appendChild(Object.assign(mkEl('option', null, r.name + ' · ' + r.pts.length + ' pts'), { value: r.id }));
    sel.onchange = () => { const r = L.find(q => q.id === sel.value); if (r) { S.route = clone(r); S.sel = -1; S.msg = 'Loaded ' + r.name + '.'; fitView(); changed(); build(); } };
    lb.appendChild(sel);
    btn(lb, 'new', () => { S.route = routeNew('Route ' + (L.length + 1)); S.sel = -1; S.msg = 'A new route: click the map to add points.'; changed(); build(); }, 'Start a new route');
    btn(lb, 'save', () => {
      if (!S.route || !S.route.pts.length) { S.msg = 'Nothing to save yet.'; build(); return; }
      const LL = library().filter(r => r.id !== S.route.id); LL.unshift(routeNormalise(S.route)); saveLibrary(LL);
      S.msg = 'Saved as “' + S.route.name + '”.'; build();
    }, 'Keep this route in the saved routes (by its name)');
    btn(lb, 'delete', () => {
      if (!S.route) return;
      const LL = library(), had = LL.some(r => r.id === S.route.id);
      if (had) { saveLibrary(LL.filter(r => r.id !== S.route.id)); S.msg = 'Removed from the saved routes.'; }
      else { S.route = null; S.msg = 'Cleared.'; if (S.armed) leave(); }
      changed(); build();
    }, 'Remove this route from the saved routes (an unsaved one is cleared)');
    el.appendChild(lb);
    // new points' reference; the end
    const op = mkEl('div', 'rtRow');
    op.appendChild(mkEl('span', 'rtK', 'new points'));
    for (const r of ['msl', 'agl']) btn(op, r.toUpperCase(), () => { S.newRef = r; build(); }, r === 'msl' ? 'A new point’s altitude over the sea' : 'A new point’s altitude over the ground under it', S.newRef === r ? 'on' : '');
    op.appendChild(mkEl('span', 'rtK', 'then'));
    const en = mkEl('select', 'rtSel rtEnd');
    for (const [v, t] of [['hold', 'hold over the last'], ['home', 'home, its circuit'], ['land', 'land, nearest strip']]) en.appendChild(Object.assign(mkEl('option', null, t), { value: v }));
    en.value = R ? R.end : 'hold';
    en.onchange = () => { if (!S.route) S.route = routeNew(); S.route.end = en.value; changed(); };
    op.appendChild(en);
    el.appendChild(op);
    // the points
    const pr = profile();
    const list = mkEl('div', 'rtList');
    if (!R || !R.pts.length) list.appendChild(mkEl('div', 'rtNote', 'Click the map to add a point; drag one to move it; right-click or long-press it to delete it.'));
    else R.pts.forEach((p, i) => {
      const row = mkEl('div', 'rtPt' + (i === S.sel ? ' sel' : '') + (pr && pr.pts[i] && !pr.pts[i].ok ? ' bad' : ''));
      row.onclick = () => { S.sel = i; build(); redraw(); };
      row.appendChild(mkEl('b', null, 'WP' + (i + 1)));
      const a = mkEl('input', 'rtAlt'); a.type = 'number'; a.step = 10; a.value = Math.round(p.alt); a.title = 'The altitude asked over this point (m)';
      a.onchange = () => { if (Number.isFinite(+a.value)) { p.alt = +a.value; changed(); build(); } };
      row.appendChild(a);
      const rf = mkEl('select', 'rtSel rtRef');
      for (const v of ['msl', 'agl']) rf.appendChild(Object.assign(mkEl('option', null, v === 'msl' ? 'm MSL' : 'm AGL'), { value: v }));
      rf.value = p.ref; rf.onchange = () => { routeSetRef(p, rf.value, world()); changed(); build(); };
      row.appendChild(rf);
      const v = mkEl('input', 'rtSpd'); v.type = 'number'; v.step = 5; v.placeholder = 'cruise'; v.value = p.V != null ? Math.round(p.V * 3.6) : ''; v.title = 'The speed on the leg into this point (km/h); empty: the cruise';
      v.onchange = () => { p.V = v.value === '' ? null : Math.max(20, +v.value) / 3.6; changed(); build(); };
      row.appendChild(v); row.appendChild(mkEl('span', 'rtU', 'km/h'));
      btn(row, '✕', () => delPt(i), 'Delete this point', 'rtDel');
      if (pr && pr.pts[i]) { const P = pr.pts[i]; row.title = 'WP' + (i + 1) + ': ' + Math.round(P.h) + ' m MSL, ' + Math.round(P.h - P.g) + ' m over the ground, ' + fmtKm(P.d) + ' along; the leg asks ' + (P.vs >= 0 ? '+' : '') + P.vs.toFixed(1) + ' m/s' + (P.why ? ' - ' + P.why : ''); }
      list.appendChild(row);
    });
    el.appendChild(list);
    // the profile strip
    const cv = mkEl('canvas', 'rtProf'); cv.id = 'rtProf'; cv.width = 680; cv.height = 150;
    el.appendChild(cv);
    const st = mkEl('div', 'rtStat'); st.id = 'rtStat'; el.appendChild(st);
    // the verbs
    const act = mkEl('div', 'rtRow rtAct');
    if (S.armed) {
      btn(act, flying() ? 'leave the route' : 'disarm', leave, 'The autopilot flies its destination again');
      btn(act, 'fly the edits', fly, 'Hand the pilot the route as it is drawn now', 'on');
    } else btn(act, 'FLY THIS ROUTE', fly, 'The autopilot flies it: armed on the ground (after the climb-out), from here in the air', 'go');
    act.appendChild(mkEl('span', 'rtMsg', S.msg || ''));
    el.appendChild(act);
    el.appendChild(mkEl('div', 'rtNote', 'click: add · drag a point: move · right-click / long-press: delete · drag the map: pan · wheel / pinch: zoom'));
    drawProfile();
  }
  function statusText(pr) {
    const a = ap(), pf = perf();
    if (!S.route || !S.route.pts.length) return '';
    const parts = [];
    if (pr) {
      parts.push(fmtKm(pr.len) + ', lowest ' + Math.round(pr.minClr) + ' m over what stands under it (margin ' + pr.margin + ')');
      let up = 0; for (const s of pr.samples) if (s.hPlan != null) up = Math.max(up, s.hPlan - s.h);
      if (up > 3) parts.push('flown up to ' + Math.round(up) + ' m over the drawing (dashed)');
      if (pf) parts.push('plan limits +' + pf.climb.toFixed(1) + ' / −' + pf.sink.toFixed(1) + ' m/s');
    }
    if (flying() && a && a.intent) {
      const I = a.intent, Lg = I.legs && I.legs[I.legI];
      if (I.phase === 'LOITER') parts.unshift('HOLDING over ' + (a.drawn.hold ? a.drawn.hold.name : 'the last point'));
      else if (Lg) parts.unshift('FLYING ' + Lg.name + ' of ' + I.legs.length + ' · ' + Lg.hPlan + ' m · vs ' + (I.vs >= 0 ? '+' : '−') + Math.abs(I.vs).toFixed(1) + ' (limit ' + (I.vs >= 0 ? '+' + I.vsUp.toFixed(1) : '−' + Math.abs(I.vsDn).toFixed(1)) + ')');
    } else if (S.armed) parts.unshift('ARMED');
    return parts.join(' · ');
  }
  function drawProfile() {
    const cv = $('rtProf'), st = $('rtStat');
    const pr = profile();
    if (st) {
      st.textContent = '';
      if (pr && pr.warnings.length) for (const w of pr.warnings) st.appendChild(mkEl('div', 'rtWarn', '⚠ ' + w));
      st.appendChild(mkEl('div', null, statusText(pr)));
    }
    if (!cv || !cv.getContext) return;
    const g = cv.getContext('2d'), W = cv.width, H = cv.height;
    g.clearRect(0, 0, W, H);
    g.fillStyle = 'rgba(12,10,8,.55)'; g.fillRect(0, 0, W, H);
    if (!pr || !pr.samples.length) { g.fillStyle = 'rgba(251,244,234,.6)'; g.font = '500 13px "IBM Plex Sans", sans-serif'; g.fillText('the profile: altitude against distance, the ground under the legs', 14, H / 2); return; }
    const ml = 42, mr = 10, mt = 10, mb = 20;
    let lo = Infinity, hi = -Infinity;
    for (const s of pr.samples) { lo = Math.min(lo, s.g); hi = Math.max(hi, s.h, s.hPlan != null ? s.hPlan : s.h, s.g + pr.margin); }
    lo = Math.max(-20, lo - 20); hi = hi + 40;
    const len = Math.max(1, pr.len);
    const X = d => ml + (W - ml - mr) * d / len, Y = h => mt + (H - mt - mb) * (1 - (h - lo) / (hi - lo));
    // the axes' marks
    g.strokeStyle = 'rgba(251,244,234,.12)'; g.lineWidth = 1; g.fillStyle = 'rgba(251,244,234,.55)'; g.font = '500 10px "IBM Plex Mono", monospace';
    const stepH = (hi - lo) > 600 ? 200 : (hi - lo) > 250 ? 100 : 50;
    for (let h = Math.ceil(lo / stepH) * stepH; h <= hi; h += stepH) { g.beginPath(); g.moveTo(ml, Y(h)); g.lineTo(W - mr, Y(h)); g.stroke(); g.fillText(h + ' m', 2, Y(h) + 3); }
    const stepD = len > 20000 ? 5000 : len > 8000 ? 2000 : 1000;
    for (let d = stepD; d < len; d += stepD) g.fillText((d / 1000) + ' km', X(d) - 10, H - 5);
    // the ground (and the trees), filled
    g.beginPath(); g.moveTo(X(0), Y(lo));
    for (const s of pr.samples) g.lineTo(X(s.d), Y(s.g));
    g.lineTo(X(len), Y(lo)); g.closePath(); g.fillStyle = COL.ground; g.fill();
    g.beginPath(); pr.samples.forEach((s, i) => (i ? g.lineTo(X(s.d), Y(s.g)) : g.moveTo(X(s.d), Y(s.g)))); g.strokeStyle = COL.groundTop; g.lineWidth = 1.2; g.stroke();
    // the margin over the ground, dashed
    g.setLineDash([3, 4]); g.strokeStyle = 'rgba(255,107,90,.45)';
    g.beginPath(); pr.samples.forEach((s, i) => (i ? g.lineTo(X(s.d), Y(s.g + pr.margin)) : g.moveTo(X(s.d), Y(s.g + pr.margin)))); g.stroke(); g.setLineDash([]);
    // the profile: magenta, red where it is under the margin
    for (let i = 1; i < pr.samples.length; i++) {
      const a = pr.samples[i - 1], b = pr.samples[i];
      g.strokeStyle = (!b.join && b.clr < pr.margin) ? COL.bad : b.join ? COL.routeDim : COL.route; g.lineWidth = (!b.join && b.clr < pr.margin) ? 3.2 : 2.2;
      g.beginPath(); g.moveTo(X(a.d), Y(a.h)); g.lineTo(X(b.d), Y(b.h)); g.stroke();
    }
    // THE PLAN AS FLOWN (PILOT-PROFILE's planner, 44_vprofile.js): amber, dashed, where it leaves the drawing (raised to
    // a leg's minimum en-route altitude, a climb moved earlier, a descent held)
    g.setLineDash([5, 3]); g.strokeStyle = COL.amber; g.lineWidth = 1.6;
    g.beginPath(); let on = false;
    for (const s of pr.samples) {
      const off = s.hPlan != null && Math.abs(s.hPlan - s.h) > 3;
      if (off) { if (on) g.lineTo(X(s.d), Y(s.hPlan)); else { g.moveTo(X(s.d), Y(s.hPlan)); on = true; } } else on = false;
    }
    g.stroke(); g.setLineDash([]);
    // the points
    const a = ap(), act = flying() && a && a.intent ? a.intent.legI : -1;
    g.font = '600 10px "IBM Plex Mono", monospace';
    pr.pts.forEach((P, i) => {
      g.beginPath(); g.arc(X(P.d), Y(P.h), i === act ? 5.5 : 4, 0, 6.283);
      g.fillStyle = P.ok ? COL.route : COL.bad; g.fill();
      g.strokeStyle = i === act ? COL.amber : COL.dark; g.lineWidth = i === act ? 2 : 1; g.stroke();
      g.fillStyle = P.ok ? '#ffd0f0' : '#ffb0a4';
      g.fillText('WP' + (i + 1) + ' ' + Math.round(P.h), Math.min(W - 70, X(P.d) - 16), Math.max(10, Y(P.h) - 8));
    });
    // the aeroplane, while the route is flown (its distance along the drawn legs, its altitude)
    const sim = D.sim();
    if (flying() && sim && a.intent && a.intent.phase === 'ROUTE') {
      const i = a.intent.legI, c = sim.cgPos();
      const B = pr.pts[i], A0 = i > 0 ? pr.pts[i - 1] : (pr.samples[0] || null);
      if (B && A0) {
        const vx = B.x - A0.x, vz = B.z - A0.z, Lr = Math.hypot(vx, vz) || 1;
        const t = Math.max(0, Math.min(1, ((c[0] - A0.x) * vx + (c[2] - A0.z) * vz) / (Lr * Lr)));
        const d = (A0.d || 0) + t * Lr, x = X(d), y = Y(c[1]);
        g.fillStyle = COL.teal; g.strokeStyle = COL.dark; g.lineWidth = 1;
        g.beginPath(); g.moveTo(x + 7, y); g.lineTo(x - 5, y - 5); g.lineTo(x - 3, y); g.lineTo(x - 5, y + 5); g.closePath(); g.fill(); g.stroke();
      }
    }
  }

  // ---- on / off, the doors ------------------------------------------------------------------------------------------
  function setOn(on) {
    on = !!on;
    if (on === S.on) { if (on) build(); return; }
    S.on = on;
    wire();
    if (on) {
      D.mapOpen(true);
      if (!S.view) fitView();
      S.dirty = true;
      build();
    } else {
      const el = $('rtp'); if (el) { el.hidden = true; el.textContent = ''; }
      D.mapOpen(false);
    }
    redraw();
  }
  function redraw() { if (D && D.redraw) D.redraw(); }
  // drawMap's cadence: the panel's live lines and the strip, at most twice a second
  let tickT = 0;
  function tick() {
    if (!S.on) return;
    const now = Date.now();
    if (now - tickT < 500) return;
    tickT = now;
    drawProfile();
  }
  function attach(deps) {
    D = deps;
    const d = pref('flydiy.routeDraw', null);
    if (d && d.route) { S.route = routeNormalise(d.route); S.armed = !!d.fly && !!S.route && S.route.pts.length > 0; }
  }
  return {
    attach, setOn, on: () => S.on, armed: () => S.armed, route: () => S.route, fly, leave, onPilot,
    mapView, setFrame, drawOnMap, tick, profile, flying,
    // for the gates and the still rigs: draw at world coordinates, as a click would
    add: (x, z, at) => { addPt([x, z], at == null ? null : at); return S.route; },
    load: r => { S.route = routeNormalise(r); S.sel = -1; fitView(); changed(); build(); return S.route; },
    select: i => { S.sel = i; build(); redraw(); },
    state: () => ({ on: S.on, armed: S.armed, sel: S.sel, n: S.route ? S.route.pts.length : 0, view: S.view ? Object.assign({}, S.view) : null, msg: S.msg }),
  };
})();
if (typeof window !== 'undefined') window.ROUTE_DRAW = ROUTE_DRAW;
