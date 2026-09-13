// _weather_bench.js — THE WEATHERING BENCH's panel and instrument (G345).
// Loaded after the editor chain on tools/_weather.html. It builds nothing of
// the aeroplane: it drives AEROWX (the macros, the pins, the lab) and reads
// the editor's own renderer/scene/camera for the measurement. Everything a
// person can do here is also on window.WX_BENCH for the Browser pane.
//
// THE PANE PUMPS NO rAF (HANDOVER): every change draws once, by hand.
(function () {
  'use strict';
  const W = window.AEROWX, A = window.AEROSKIN, UI = window.CAGE_UI;
  if (!W || !A || !UI) { console.error('weather bench: module or editor missing'); return; }
  const T = window.THREE;
  const root = document.getElementById('wx');
  const $ = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };

  function draw() { try { UI.draw(); } catch (e) {} }
  function ensureU() { A.aeroSharedU(T); }

  // ---- rows ------------------------------------------------------------
  function row(parent, label, lo, hi, st, get, set, cls, derived) {
    const r = $('div', 'r' + (cls ? ' ' + cls : ''));
    const k = $('span', 'k', label); k.title = label;
    const i = $('input'); i.type = 'range'; i.min = lo; i.max = hi; i.step = st;
    const v = $('span', 'v');
    const d = derived ? $('span', 'd') : null;
    const sync = () => { const x = get(); i.value = x == null ? '' : x; v.textContent = x == null ? '—' : (+x).toFixed(2); if (d) d.textContent = derived(); };
    i.oninput = () => { set(+i.value); sync(); draw(); };
    i.ondblclick = () => { set(null); sync(); draw(); };
    r.append(k, i, v); if (d) r.append(d);
    parent.append(r);
    r.sync = sync; sync();
    return r;
  }
  const rows = [];
  const syncAll = () => rows.forEach(r => r.sync && r.sync());

  // ---- THE MACROS --------------------------------------------------------
  const hM = $('div'); hM.append($('h2', null, 'the four macros'));
  root.append(hM);
  for (const k of W.AERO_WX_MACRO)
    rows.push(row(hM, k, 0, 1, 0.01, () => W.AERO_WX.macro[k],
      v => { W.aeroWxSetMacro(T, { [k]: v == null ? 0 : v }); syncAll(); }, 'macro'));
  {
    const r = $('div', 'r');
    for (const [lab, m] of [['fresh', {}], ['flown', { flight: 0.6 }], ['old', { age: 0.8, flight: 0.5 }],
                            ['bush', { flight: 0.5, bush: 0.9 }], ['rained', { flight: 0.3, rain: 0.9 }],
                            ['all', { age: 1, flight: 1, bush: 1, rain: 1 }]]) {
      const b = $('button', null, lab);
      b.onclick = () => { W.aeroWxSetMacro(T, { age: 0, flight: 0, bush: 0, rain: 0 }); W.aeroWxSetMacro(T, m); syncAll(); draw(); };
      r.append(b);
    }
    hM.append(r);
  }

  // ---- THE VIEWS ---------------------------------------------------------
  const hV = $('div'); hV.append($('h2', null, 'view'));
  root.append(hV);
  {
    const r = $('div', 'r');
    const k = $('span', 'k', 'debug'); const s = $('select');
    for (const [v, lab] of [[0, 'paint'], [1, 'cover'], [2, 'cavity (grammar)'], [3, 'curvature'],
                            [4, 'plume / mud'], [5, 'grunge'], [6, 'up / fwd / down']]) {
      const o = $('option', null, lab); o.value = v; s.append(o);
    }
    s.onchange = () => { W.aeroWxSetDebug(T, +s.value); draw(); };
    r.append(k, s); hV.append(r);
  }
  // THE AEROPLANE'S OWN BOX (its aeroskin meshes, not the room), for the
  // close-ups: a millimetre feature is under a pixel at whole-aeroplane
  // framing and measures as nothing — the insects, the stone chips and the
  // groove dirt are judged from a metre away, as a person would
  function aeroBox() {
    const box = new T.Box3();
    UI.scene.traverse(o => {
      if (!o.isMesh || !o.geometry || !o.visible) return;
      const m = [].concat(o.material)[0];
      if (!(m && m.userData && m.userData.aeroskin) || (m.userData.aeroCompanion)) return;
      box.expandByObject(o);
    });
    return box;
  }
  // camera presets over the editor's own orbit (yaw, pitch, zoom, centre)
  const PRESETS = {
    flank:   () => [1.25, 0.15, 1.15, null],
    exhaust: () => { const E = window.CAGE_ENG; return [1.35, -0.15, 3.0, E && E.exhaustAt && [E.exhaustAt[0], E.exhaustAt[1], E.exhaustAt[2] - 0.6]]; },
    belly:   () => [0.8, -0.95, 1.25, null],
    wheel:   () => { const G = window.CAGE_GEAR; const c = G && G.contacts && G.contacts[0]; return [0.95, -0.3, 3.5, c && c.p]; },
    nose:    () => [0.18, 0.1, 1.7, null],
    // the cowl's front from a metre: forward faces, close
    front:   () => { const b = aeroBox(); const c = b.getCenter(new T.Vector3()); return [0.55, -0.05, 6.0, [c.x * 0.5, c.y + 0.15, b.max.z - 0.35]]; },
    // a leading edge from a metre: the wing's outer third
    le:      () => { const b = aeroBox(); const c = b.getCenter(new T.Vector3()); return [0.75, 0.15, 7.0, [b.max.x * 0.6, b.max.y - 0.35, c.z + 0.6]]; },
    top:     () => [0.9, 1.1, 1.2, null],
    cowl:    () => [0.75, 0.35, 2.6, null],
    // a seam and a rivet row from a metre, on the flank
    seam:    () => { const b = aeroBox(); const c = b.getCenter(new T.Vector3()); return [1.45, 0.1, 7.0, [b.max.x, c.y, c.z]]; },
    tail:    () => [2.4, 0.2, 2.0, null],
    // the glazing from above and ahead, and the panel from the pilot's own
    // seat: both placed off the ENGINE's published position (the crew layer
    // publishes no eye point) — the screen sits ~1.4 m behind it and half a
    // metre up, the panel just ahead of the screen's foot
    screen:  () => { const E = window.CAGE_ENG, a = E && E.units && E.units[0] && E.units[0].at; return a ? [0.55, 0.45, 3.4, [0, a[1] + 0.55, a[2] - 1.45]] : [0.7, 0.55, 3.2, null]; },
    cockpit: () => { const E = window.CAGE_ENG, a = E && E.units && E.units[0] && E.units[0].at; return a ? [Math.PI, 0.05, 18, [0.3, a[1] + 0.3, a[2] - 1.15]] : [Math.PI, 0.05, 18, null]; },
  };
  {
    const r = $('div', 'r wrap');
    for (const k of Object.keys(PRESETS)) {
      const b = $('button', null, k);
      b.onclick = () => look(k);
      r.append(b);
    }
    hV.append(r);
  }
  function look(name) {
    const p = PRESETS[name] ? PRESETS[name]() : null;
    if (!p) return;
    UI.setView(p[0], p[1], p[2], p[3] ? [p[3][0], p[3][1], p[3][2]] : null);
    draw();
  }

  // ---- THE PINS (the fine sliders) ----------------------------------------
  const hP = $('details'); hP.open = true; hP.append($('summary', null, 'layers — pin a strength, double-click to release'));
  root.append(hP);
  const resolved = () => W.aeroWxResolve(W.AERO_WX.macro, {});
  W.AERO_WX_LAYERS.forEach((L, i) =>
    rows.push(row(hP, L.label, 0, 1, 0.01,
      () => (W.AERO_WX.pin[L.k] != null ? W.AERO_WX.pin[L.k] : null),
      v => W.aeroWxPin(T, L.k, v), null,
      () => 'd ' + resolved()[i].toFixed(2))));
  {
    const b = $('button', null, 'release all pins');
    b.onclick = () => { for (const k of Object.keys(W.AERO_WX.pin)) W.aeroWxPin(T, k, null); syncAll(); draw(); };
    hP.append(b);
  }

  // ---- THE LAB: coefficients, palette, knobs ------------------------------
  const hC = $('details'); hC.append($('summary', null, 'coefficients (age / flight / bush / rain)'));
  root.append(hC);
  for (const L of W.AERO_WX_LAYERS) {
    const d = $('details'); d.append($('summary', null, L.k));
    W.AERO_WX_MACRO.forEach((m, g) =>
      rows.push(row(d, m, -1, 1.5, 0.01, () => W.aeroWxLabGet('layer', L.k, g),
        v => W.aeroWxLabSet(T, 'layer', L.k, g, v == null ? W.AERO_WX_DEF.layers[W.AERO_WX_LAYERS.indexOf(L)][g] : v))));
    hC.append(d);
  }
  const hK = $('details'); hK.append($('summary', null, 'palette (linear rgb + roughness floor) and knobs'));
  root.append(hK);
  for (const C of W.AERO_WX_COL) {
    const d = $('details'); d.append($('summary', null, C.k));
    ['r', 'g', 'b', 'floor'].forEach((f, g) =>
      rows.push(row(d, f, 0, 1, 0.005, () => W.aeroWxLabGet('col', C.k, g),
        v => W.aeroWxLabSet(T, 'col', C.k, g, v == null ? W.AERO_WX_DEF.cols[W.AERO_WX_COL.indexOf(C)][g] : v))));
    hK.append(d);
  }
  {
    const d = $('details'); d.append($('summary', null, 'knobs'));
    const R = W.AERO_WX_KNOB_RANGE;      // one keeper with the editor's lab (G345.6)
    for (const k of Object.keys(W.AERO_WX_KNOB))
      rows.push(row(d, k, R[k][0], R[k][1], R[k][2], () => W.aeroWxLabGet('knob', k),
        v => W.aeroWxLabSet(T, 'knob', k, v == null ? W.AERO_WX_DEF.knobs[k] : v)));
    hK.append(d);
  }
  {
    const r = $('div', 'r');
    const b1 = $('button', null, 'export recipe'); const b2 = $('button', null, 'reset lab');
    const ta = $('textarea');
    b1.onclick = () => { ta.value = W.aeroWxLabExport(); };
    b2.onclick = () => { W.aeroWxLabReset(T); syncAll(); draw(); };
    r.append(b1, b2); hK.append(r, ta);
  }

  // ---- THE MEASUREMENT -----------------------------------------------------
  // The _light_probe.js method: a render target, the viewport set BY HAND
  // (a hidden pane's canvas is 0x0 and the renderer's viewport with it),
  // readRenderTargetPixels, and the difference between two shots.
  const SZ = 320;
  let RT = null, buf = null;
  function shoot() {
    const R = UI.renderer, S = UI.scene, C = UI.camera;
    if (!R) throw new Error('no renderer (EXT scene)');
    if (!RT) {
      RT = new T.WebGLRenderTarget(SZ, SZ, { format: T.RGBAFormat });
      RT.texture.colorSpace = T.SRGBColorSpace;
      buf = new Uint8Array(SZ * SZ * 4);
    }
    // the editor's draw() places the camera; do that, then shoot square
    draw();
    const asp = C.aspect;
    C.aspect = 1; C.updateProjectionMatrix();
    const pr = R.getRenderTarget();
    R.setRenderTarget(RT);
    R.setViewport(0, 0, SZ, SZ);
    R.clear(true, true, true);
    R.render(S, C);
    R.readRenderTargetPixels(RT, 0, 0, SZ, SZ, buf);
    R.setRenderTarget(pr);
    C.aspect = asp; C.updateProjectionMatrix();
    return Uint8Array.from(buf);
  }
  function diff(a, b, thr) {
    thr = thr || 6;
    let n = 0, sum = 0, lum = 0;
    for (let i = 0; i < a.length; i += 4) {
      const d = Math.max(Math.abs(a[i] - b[i]), Math.abs(a[i + 1] - b[i + 1]), Math.abs(a[i + 2] - b[i + 2]));
      if (d > thr) { n++; }
      sum += d;
      lum += (0.2126 * (b[i] - a[i]) + 0.7152 * (b[i + 1] - a[i + 1]) + 0.0722 * (b[i + 2] - a[i + 2]));
    }
    const px = a.length / 4;
    return { pct: 100 * n / px, mean: sum / px, lum: lum / px };
  }
  // which preset shows a layer best
  const LAYER_VIEW = {
    dust: 'top', belly: 'belly', cav: 'seam', dep: 'seam', fade: 'top', chalk: 'top', rough: 'flank',
    panel: 'flank', exhaust: 'exhaust', mud: 'wheel', bug: 'front', streakA: 'flank', streakD: 'flank',
    chip: 'seam', rust: 'wheel', scratch: 'seam', impact: 'front', tar: 'belly', corner: 'cockpit',
    hands: 'cockpit', gDust: 'screen', gEdge: 'screen', gRain: 'screen', gBug: 'screen',
  };
  // measure ONE layer: all macros off, the pin at 0 then at 1, on its preset
  function measure(key, view) {
    const m0 = Object.assign({}, W.AERO_WX.macro);
    const pins0 = Object.assign({}, W.AERO_WX.pin);
    W.aeroWxSetMacro(T, { age: 0, flight: 0, bush: 0, rain: 0 });
    for (const k of Object.keys(W.AERO_WX.pin)) W.aeroWxPin(T, k, null);
    look(view || LAYER_VIEW[key] || 'flank');
    W.aeroWxPin(T, key, 0);
    const a = shoot();
    W.aeroWxPin(T, key, 1);
    const b = shoot();
    W.aeroWxPin(T, key, null);
    // restore
    W.aeroWxSetMacro(T, m0);
    for (const k of Object.keys(pins0)) W.aeroWxPin(T, k, pins0[k]);
    syncAll(); draw();
    const r = diff(a, b);
    r.key = key; r.view = view || LAYER_VIEW[key] || 'flank';
    r.ok = r.pct >= 0.5;
    return r;
  }
  function measureAll(keys) {
    const out = [];
    for (const L of W.AERO_WX_LAYERS) if (!keys || keys.includes(L.k)) out.push(measure(L.k));
    renderTable(out);
    return out;
  }
  const hMs = $('div'); hMs.append($('h2', null, 'measure'));
  root.append(hMs);
  const tbl = $('table');
  {
    const r = $('div', 'r');
    const b = $('button', null, 'measure all layers');
    b.onclick = () => measureAll();
    // THE REFERENCE SHOT crosses a page load: ?nowx renders the same build
    // with the module switched off, and its shot lands in localStorage so the
    // weathered page can diff against a picture the weathering never touched
    const b2 = $('button', null, 'ref shot');
    b2.onclick = () => { refSave(shoot()); stat('reference shot taken' + (window.AEROWX_OFF ? ' (no weathering)' : '')); };
    const b3 = $('button', null, 'diff vs ref');
    b3.onclick = () => { const d = refDiff(); stat(d ? 'vs ref: ' + d.pct.toFixed(2) + ' % changed, mean ' + d.mean.toFixed(2) : 'no reference'); };
    r.append(b, b2, b3); hMs.append(r, tbl);
  }
  const REF_KEY = 'flydiy.wxRef';
  function refSave(px) {
    let s = ''; for (let i = 0; i < px.length; i += 3) s += String.fromCharCode(px[i], px[i + 1] || 0, px[i + 2] || 0);
    try { localStorage.setItem(REF_KEY, btoa(s)); } catch (e) { stat('reference too large for storage'); }
  }
  function refLoad() {
    let b = null; try { b = localStorage.getItem(REF_KEY); } catch (e) {}
    if (!b) return null;
    const s = atob(b), out = new Uint8Array(SZ * SZ * 4);
    for (let i = 0; i < out.length; i++) out[i] = s.charCodeAt(i);
    return out;
  }
  function refDiff() { const r = refLoad(); return r ? diff(r, shoot()) : null; }

  // A PICTURE, AT SIZE: the current view rendered to a render target at
  // w x h (the pane's canvas is 0x0 when hidden and keeps no drawing buffer),
  // flipped into a 2-D canvas and POSTed as a PNG to a sink — the
  // _shoulder.html convention (tools/_shoulder_check's sink, any port). The
  // pictures land in flyDiy/screenshots/weather/.
  async function snap(name, w, h, port) {
    w = w || 1280; h = h || 720;
    const R = UI.renderer, S = UI.scene, C = UI.camera;
    draw();
    const rt = new T.WebGLRenderTarget(w, h, { format: T.RGBAFormat });
    rt.texture.colorSpace = T.SRGBColorSpace;
    const asp = C.aspect;
    C.aspect = w / h; C.updateProjectionMatrix();
    const pr = R.getRenderTarget();
    R.setRenderTarget(rt); R.setViewport(0, 0, w, h); R.clear(true, true, true);
    R.render(S, C);
    const px = new Uint8Array(w * h * 4);
    R.readRenderTargetPixels(rt, 0, 0, w, h, px);
    R.setRenderTarget(pr); rt.dispose();
    C.aspect = asp; C.updateProjectionMatrix();
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    const ctx = cv.getContext('2d'), img = ctx.createImageData(w, h);
    for (let y = 0; y < h; y++)                       // GL rows are bottom-up
      img.data.set(px.subarray((h - 1 - y) * w * 4, (h - y) * w * 4), y * w * 4);
    ctx.putImageData(img, 0, 0);
    const blob = await new Promise(r => cv.toBlob(r, 'image/png'));
    const res = await fetch('http://localhost:' + (port || 8399) + '/save?name=' + encodeURIComponent(name),
                            { method: 'POST', body: blob });
    return res.status;
  }
  const statEl = $('div', 'r'); hMs.append(statEl);
  function stat(s) { statEl.textContent = s; }
  function renderTable(res) {
    tbl.innerHTML = '';
    for (const r of res) {
      const tr = $('tr');
      tr.append($('td', null, r.key), $('td', null, r.view),
                $('td', r.ok ? 'ok' : 'bad', r.pct.toFixed(2) + ' %'),
                $('td', null, 'Δ ' + r.mean.toFixed(1)), $('td', null, 'L ' + (r.lum >= 0 ? '+' : '') + r.lum.toFixed(1)));
      tbl.append(tr);
    }
  }

  // ---- THE SOURCES, as the editor measured them ---------------------------
  function sources() {
    const U = A.aeroSharedU(T);
    return { nE: U.uWxN ? U.uWxN.value.x : 0, nW: U.uWxN ? U.uWxN.value.y : 0,
             exhaust: U.uWxE ? U.uWxE.value.map(v => [v.x, v.y, v.z, v.w]) : [],
             wheels: U.uWxW ? U.uWxW.value.map(v => [v.x, v.y, v.z, v.w]) : [] };
  }

  ensureU();
  syncAll();
  draw();
  window.WX_BENCH = { W, A, UI, look, PRESETS, measure, measureAll, shoot, diff, sources,
                      refSave, refLoad, refDiff, snap, off: !!window.AEROWX_OFF,
                      setMacro: m => { W.aeroWxSetMacro(T, m); syncAll(); draw(); },
                      pin: (k, v) => { W.aeroWxPin(T, k, v); syncAll(); draw(); },
                      debug: v => { W.aeroWxSetDebug(T, v); draw(); },
                      sync: syncAll, draw };
})();
