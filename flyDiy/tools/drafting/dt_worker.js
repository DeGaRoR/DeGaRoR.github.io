// dt_worker.js - THE DRAFTING TABLE'S WORKER: the garage's generator and layers (dt_manifest.js) loaded off the page's
// thread, so the page itself stays instant. It answers three messages; the page never touches THREE or the garage.
//   {op:'init'}                                   -> {op:'ready', ms, errors, rows, cards}
//   {op:'birth', id, key | sel+over}              -> {op:'spec', id, spec}
//   {op:'build', id, spec, over, passes, level, views: {side: V, ...}, stations}
//                                                 -> {op:'built', id, ms, P(only the keys asked), measure, windows,
//                                                     views: {side: {x0, y0, W, H, edges}}}   (edges transferred)
/* global importScripts, DT_MANIFEST, DT_BUILD, DT_CORE */
'use strict';
self.window = self;
const el = () => ({ style: {}, classList: { add() {}, remove() {}, toggle() {} }, appendChild() {}, addEventListener() {},
  setAttribute() {}, textContent: '', value: '', checked: false, querySelector: () => null, querySelectorAll: () => [] });
self.document = { getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], createElement: el,
  body: el(), head: el() };
self.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
self.Image = function () { return el(); };
const BASE = '../../';                       // this file is flyDiy/tools/drafting/
let READY = null;

function init() {
  if (READY) return READY;
  const t0 = performance.now(), errors = [];
  importScripts('dt_manifest.js');
  for (const f of DT_MANIFEST.ALL) {
    try { importScripts(BASE + f + (self.DT_VERSION ? '?v=' + self.DT_VERSION : '')); }
    catch (e) { errors.push(f + ': ' + (e && e.message)); }
  }
  const D = self.CAGE_DESIGN;
  READY = { op: 'ready', ms: Math.round(performance.now() - t0), errors,
    rows: DT_BUILD.rowDefs(self),
    cards: D ? D.ARCHETYPES.filter(a => !a.blocked).map(a => ({ key: a.key, name: a.name, kind: a.kind, sel: a.sel })) : [] };
  return READY;
}

self.onmessage = ev => {
  const m = ev.data || {};
  try {
    if (m.op === 'init') { self.postMessage(init()); return; }
    init();
    if (m.op === 'birth') {
      const D = self.CAGE_DESIGN;
      let spec;
      if (m.key && !m.sel) spec = DT_BUILD.birth(self, m.key);
      else {
        const a = m.key ? D.ARCHETYPES.find(x => x.key === m.key) : null;
        spec = D.designBake(Object.assign({}, a ? a.sel : {}, m.sel || {}), m.over || (a ? a.over : undefined));
      }
      self.postMessage({ op: 'spec', id: m.id, spec });
      return;
    }
    if (m.op === 'build') {
      const B = DT_BUILD.build(self, m.spec, m.over || null, { level: m.level || 0, passes: m.passes || 1 });
      const out = { op: 'built', id: m.id, ms: B.ms, errors: B.errors, frame: B.frame, views: {} };
      out.measure = DT_CORE.measure(B, { stations: m.stations || [], probes: m.probes || [] });
      out.windows = DT_CORE.windows(B);
      if (m.keys) { out.P = {}; for (const k of m.keys) out.P[k] = B.P[k]; }
      const tr = [];
      for (const view of Object.keys(m.views || {})) {
        const V = m.views[view];
        const [x0, y0, x1, y1] = V.box, W = Math.round(x1 - x0), H = Math.round(y1 - y0);
        const id = DT_CORE.raster(view, B.tris, B.parts, V, W, H, x0, y0);
        const e = DT_CORE.edges(id, W, H);
        out.views[view] = { x0, y0, W, H, edges: e };
        tr.push(e.buffer);
      }
      if (m.shade) {                 // the quick 3D: a flat-shaded picture from a turned eye, as a grey + part image
        out.shade = shade(B, m.shade);
        tr.push(out.shade.rgba.buffer);
      }
      self.postMessage(out, tr);
      return;
    }
  } catch (e) {
    self.postMessage({ op: 'error', id: m.id, message: String(e && e.stack || e) });
  }
};

// THE QUICK 3D: the same triangles, turned (yaw, pitch), drawn with a z-buffer and flat shading by part colour
function shade(B, o) {
  const W = o.W || 600, H = o.H || 400, yaw = (o.yaw || 35) * Math.PI / 180, pit = (o.pitch || 20) * Math.PI / 180;
  const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pit), sp = Math.sin(pit);
  const T = B.tris, P = B.parts, n = P.length;
  // camera frame: x right, y up, z towards the eye; the plane in (a aft, h up, s starboard) -> world (x=-a fore, y=h, z=s)
  const Q = new Float32Array(T.length);
  let minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9;
  for (let i = 0; i < T.length; i += 3) {
    const wx = -T[i], wy = T[i + 1], wz = T[i + 2];
    const x1 = cy * wx + sy * wz, z1 = -sy * wx + cy * wz;
    const y2 = cp * wy - sp * z1, z2 = sp * wy + cp * z1;
    Q[i] = x1; Q[i + 1] = y2; Q[i + 2] = z2;
    if (x1 < minX) minX = x1; if (x1 > maxX) maxX = x1; if (y2 < minY) minY = y2; if (y2 > maxY) maxY = y2;
  }
  const k = Math.min((W - 20) / (maxX - minX), (H - 20) / (maxY - minY));
  const ox = W / 2 - k * (minX + maxX) / 2, oy = H / 2 + k * (minY + maxY) / 2;
  const zb = new Float32Array(W * H).fill(-1e9), rgba = new Uint8ClampedArray(W * H * 4);
  const COL = {};
  for (const name of Object.keys(DT_CORE.COLOURS)) { const c = DT_CORE.COLOURS[name]; COL[DT_CORE.PID[name]] = [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)]; }
  COL[DT_CORE.PID.body] = [205, 210, 218]; COL[DT_CORE.PID.pillar] = [205, 210, 218]; COL[DT_CORE.PID.waist] = [190, 196, 206];
  COL[DT_CORE.PID.wing] = [215, 220, 226]; COL[DT_CORE.PID.glass] = [80, 110, 140];
  const L = [0.35, 0.8, 0.5], ll = Math.hypot(L[0], L[1], L[2]);
  for (let t = 0; t < n; t++) {
    const o9 = t * 9;
    const ax = Q[o9], ay = Q[o9 + 1], az = Q[o9 + 2], bx = Q[o9 + 3], by = Q[o9 + 4], bz = Q[o9 + 5], cx = Q[o9 + 6], cy2 = Q[o9 + 7], cz = Q[o9 + 8];
    let nx = (by - ay) * (cz - az) - (bz - az) * (cy2 - ay), ny = (bz - az) * (cx - ax) - (bx - ax) * (cz - az), nz = (bx - ax) * (cy2 - ay) - (by - ay) * (cx - ax);
    const nl = Math.hypot(nx, ny, nz) || 1; nx /= nl; ny /= nl; nz /= nl;
    if (nz < 0) { nx = -nx; ny = -ny; nz = -nz; }
    const lit = 0.45 + 0.55 * Math.max(0, (nx * L[0] + ny * L[1] + nz * L[2]) / ll);
    const col = COL[P[t]] || [180, 180, 180];
    const X = [ox + k * ax, ox + k * bx, ox + k * cx], Y = [oy - k * ay, oy - k * by, oy - k * cy2], Z = [az, bz, cz];
    const area = (X[1] - X[0]) * (Y[2] - Y[0]) - (Y[1] - Y[0]) * (X[2] - X[0]);
    if (Math.abs(area) < 1e-9) continue;
    const x0 = Math.max(0, Math.floor(Math.min(...X))), x1 = Math.min(W - 1, Math.ceil(Math.max(...X)));
    const y0 = Math.max(0, Math.floor(Math.min(...Y))), y1 = Math.min(H - 1, Math.ceil(Math.max(...Y)));
    const inv = 1 / area;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const px = x + 0.5, py = y + 0.5;
      const w0 = ((X[1] - px) * (Y[2] - py) - (Y[1] - py) * (X[2] - px)) * inv;
      const w1 = ((X[2] - px) * (Y[0] - py) - (Y[2] - py) * (X[0] - px)) * inv;
      const w2 = 1 - w0 - w1;
      if (w0 < 0 || w1 < 0 || w2 < 0) continue;
      const z = w0 * Z[0] + w1 * Z[1] + w2 * Z[2], i = y * W + x;
      if (z <= zb[i]) continue;
      zb[i] = z; rgba[i * 4] = col[0] * lit; rgba[i * 4 + 1] = col[1] * lit; rgba[i * 4 + 2] = col[2] * lit; rgba[i * 4 + 3] = 255;
    }
  }
  return { W, H, rgba };
}
