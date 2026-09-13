// _premises_gen.js — THE PREMISES (G353 / GPREM): the record the world editor
// writes, and everything that reads it headless. PREMISES-CONTRACT-2026-09-13.md
// is the document; this is its code. Pure: no THREE, no DOM, loads in node
// for GATE PREMISES and in the page for the bench and (later) the game, where
// it becomes src/core/27_premises.js.
//
// WHAT IS HERE (v0 — the terrain layers):
//   the record        DEF / normalise / migrate / envelope / unwrap (the garage's
//                     rulings: nulls kept, plaque beside the record, a bare
//                     record accepted, a load replaces)
//   the seeds         fnv / hash32 / mulberry32 / seedOf — every element its own stream
//   the polygons      even-odd containment (concave allowed), a signed edge
//                     distance, simplicity, orientation, bbox
//   the modifiers     flatten / raise / ramp / grade, each a smoothstep feather
//                     over a signed distance — AERO.grade's idiom, one function
//                     per record, C1 by construction
//   the index         256 m cells keyed by string (treesNear's idiom) so the
//                     hot path is one Map.get and AABB rejects
//   compose           the overlay a world composes at its terrainH seam:
//                     terrainH(x, z, h) / surfaceAt / excludeAt / inExtent
//   the frame         'free' (x, z, yaw) in v0; 'road' arrives with the sites
//   issues / checks   what the #chk panel shows and the gate holds
//   bake              the extent rastered to int16, and the sampler the
//                     baked-vs-live rule compares against (WORLD-V2 §6.3)
//
// Heights in the record are RELATIVE to y0, the BASE terrain at the anchor —
// the modifiers add y0 back. A world change moves the anchor, not the record.
(function () {
'use strict';

const PREMISES_V = 1;
const LAYERS = ['terrain', 'surface', 'material', 'exclude', 'roads', 'runways', 'zones', 'sites', 'links', 'objects'];
const SURFACE = { GRASS: 0, ROCK: 1, SCREE: 2, FOREST_FLOOR: 3, WATER: 4, PAVED: 5, GRAVEL: 6, SAND: 7 };
const SURFACE_NAMES = ['GRASS', 'ROCK', 'SCREE', 'FOREST_FLOOR', 'WATER', 'PAVED', 'GRAVEL', 'SAND'];

// ---------------------------------------------------------------------------
// the seeds
// ---------------------------------------------------------------------------
function fnv(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return h >>> 0;
}
function hash32(a, b) {
  let h = Math.imul((a >>> 0) ^ 0x9E3779B9, 0x85EBCA6B) ^ (b >>> 0);
  h = Math.imul(h ^ (h >>> 13), 0xC2B2AE35);
  return (h ^ (h >>> 16)) >>> 0;
}
// mulberry32 — the village's own stream (tools/_village_gen.js), one per element
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const seedOf = (seed, layer, id) => hash32(seed | 0, fnv(layer + ':' + id));

// ---------------------------------------------------------------------------
// the polygons — poly = [[x, z], ...], any winding, concave allowed
// ---------------------------------------------------------------------------
function polyBBox(poly) {
  let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
  for (const p of poly) { if (p[0] < x0) x0 = p[0]; if (p[0] > x1) x1 = p[0]; if (p[1] < z0) z0 = p[1]; if (p[1] > z1) z1 = p[1]; }
  return { x0, z0, x1, z1 };
}
// signed area: positive when the polygon turns from +x toward +z (CCW seen from +y)
function polyArea(poly) {
  let a = 0;
  for (let i = 0, n = poly.length; i < n; i++) { const p = poly[i], q = poly[(i + 1) % n]; a += p[0] * q[1] - q[0] * p[1]; }
  return a / 2;
}
const polyCCW = poly => polyArea(poly) > 0;
// even-odd: works for concave polygons, which the convex-only village test does not
function inPoly(poly, x, z) {
  let inside = false;
  for (let i = 0, n = poly.length, j = n - 1; i < n; j = i++) {
    const a = poly[i], b = poly[j];
    if ((a[1] > z) !== (b[1] > z) && x < (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
  }
  return inside;
}
function distPtSeg(x, z, a, b) {
  const dx = b[0] - a[0], dz = b[1] - a[1];
  const l2 = dx * dx + dz * dz;
  const t = l2 > 1e-12 ? Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / l2)) : 0;
  return Math.hypot(x - (a[0] + dx * t), z - (a[1] + dz * t));
}
// signed distance to the polygon's edge: negative inside
function sdPoly(poly, x, z) {
  let d = Infinity;
  for (let i = 0, n = poly.length; i < n; i++) {
    const e = distPtSeg(x, z, poly[i], poly[(i + 1) % n]);
    if (e < d) d = e;
  }
  return inPoly(poly, x, z) ? -d : d;
}
function segsCross(a, b, c, d) {
  const o = (p, q, r) => (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);
  const o1 = o(a, b, c), o2 = o(a, b, d), o3 = o(c, d, a), o4 = o(c, d, b);
  return (o1 > 0) !== (o2 > 0) && (o3 > 0) !== (o4 > 0) && o1 !== 0 && o2 !== 0 && o3 !== 0 && o4 !== 0;
}
// simple = at least three points, no repeated point, no two non-adjacent edges crossing
function polySimple(poly) {
  const n = poly.length;
  if (n < 3) return false;
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++)
    if (Math.abs(poly[i][0] - poly[j][0]) < 1e-6 && Math.abs(poly[i][1] - poly[j][1]) < 1e-6) return false;
  if (Math.abs(polyArea(poly)) < 1e-6) return false;
  for (let i = 0; i < n; i++) for (let j = i + 2; j < n; j++) {
    if (i === 0 && j === n - 1) continue;
    if (segsCross(poly[i], poly[(i + 1) % n], poly[j], poly[(j + 1) % n])) return false;
  }
  return true;
}
const ensureCCW = poly => (polyCCW(poly) ? poly.slice() : poly.slice().reverse());
const smf01 = t => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));

// ---------------------------------------------------------------------------
// the modifiers — each { bbox (with its falloff), apply(x, z, h) -> h }, in
// the PREMISES frame, heights relative to y0 added back here
// ---------------------------------------------------------------------------
function makeModifier(m, y0) {
  const fall = Math.max(0.5, +m.falloff || 8);
  const weight = d => (d <= 0 ? 1 : d >= fall ? 0 : 1 - smf01(d / fall));
  if (m.kind === 'flatten' || m.kind === 'raise' || m.kind === 'ramp') {
    const poly = m.poly;
    const bb = polyBBox(poly);
    const bbox = { x0: bb.x0 - fall, z0: bb.z0 - fall, x1: bb.x1 + fall, z1: bb.z1 + fall };
    let target;
    if (m.kind === 'flatten') { const lv = (m.abs ? 0 : y0) + (+m.level || 0); target = () => lv; }
    else if (m.kind === 'raise') { const dh = +m.dh || 0; target = (x, z, h) => h + dh; }
    else { const pl = m.plane || [0, 0, 0]; target = (x, z) => y0 + pl[0] * x + pl[1] * z + (pl[2] || 0); }
    return { id: m.id, kind: m.kind, bbox, apply: (x, z, h) => {
      if (x < bbox.x0 || x > bbox.x1 || z < bbox.z0 || z > bbox.z1) return h;
      const w = weight(sdPoly(poly, x, z));
      return w > 0 ? h + (target(x, z, h) - h) * w : h;
    } };
  }
  if (m.kind === 'grade') {
    // a polyline with a height at every node, a width, a feather beyond the
    // half width — AERO.grade's oriented feather, per segment
    const pts = m.pts, hw = Math.max(0.5, (+m.width || 4) / 2);
    let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
    for (const p of pts) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); z0 = Math.min(z0, p[1]); z1 = Math.max(z1, p[1]); }
    const bbox = { x0: x0 - hw - fall, z0: z0 - hw - fall, x1: x1 + hw + fall, z1: z1 + hw + fall };
    return { id: m.id, kind: 'grade', bbox, apply: (x, z, h) => {
      if (x < bbox.x0 || x > bbox.x1 || z < bbox.z0 || z > bbox.z1 || pts.length < 2) return h;
      let best = Infinity, ty = 0;
      for (let i = 0; i + 1 < pts.length; i++) {
        const a = pts[i], b = pts[i + 1];
        const dx = b[0] - a[0], dz = b[1] - a[1], l2 = dx * dx + dz * dz;
        const t = l2 > 1e-12 ? Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / l2)) : 0;
        const d = Math.hypot(x - (a[0] + dx * t), z - (a[1] + dz * t));
        if (d < best) { best = d; ty = (a[2] || 0) + ((b[2] || 0) - (a[2] || 0)) * t; }
      }
      const w = weight(best - hw);
      return w > 0 ? h + (y0 + ty - h) * w : h;
    } };
  }
  return null;
}

// ---------------------------------------------------------------------------
// the index — 256 m cells, a string key, AABB rejects in the item
// ---------------------------------------------------------------------------
function SpatialIndex(cell) {
  const C = cell || 256, cells = new Map();
  const key = (i, j) => i + ',' + j;
  return {
    add(bbox, item) {
      const i0 = Math.floor(bbox.x0 / C), i1 = Math.floor(bbox.x1 / C), j0 = Math.floor(bbox.z0 / C), j1 = Math.floor(bbox.z1 / C);
      for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
        const k = key(i, j);
        let a = cells.get(k);
        if (!a) { a = []; cells.set(k, a); }
        a.push(item);
      }
    },
    query(x, z) { return cells.get(key(Math.floor(x / C), Math.floor(z / C))) || null; },
    size: () => cells.size,
  };
}

// ---------------------------------------------------------------------------
// the record
// ---------------------------------------------------------------------------
function DEF() {
  return { v: PREMISES_V, id: 'premises', name: '', seed: 1,
           frame: { kind: 'free', extent: null, anchors: {} },
           layers: { terrain: [], surface: [], material: [], exclude: [], roads: [], runways: [], zones: [], sites: [], links: [], objects: [] },
           budget: { tris: 400000, lights: 24, smoke: 6, people: 40 } };
}
const PREMISES_MIGRATORS = {
  // 1 -> 2: (none yet) — each entry lifts ONE version, on the raw saved shape
};
function migrate(rec) {
  let r = rec, v = +r.v || 1;
  while (v < PREMISES_V) {
    const m = PREMISES_MIGRATORS[v];
    if (!m) throw new Error('premises: no migrator from v' + v);
    r = m(r) || r; v++; r.v = v;
  }
  return r;
}
// fill what a save predates; never invent a value the author did not write
// (a missing number stays missing where the composer has a default)
function normalise(rec) {
  const d = DEF();
  const r = Object.assign(d, rec || {});
  r.v = PREMISES_V;
  r.frame = Object.assign({ kind: 'free', extent: null, anchors: {} }, r.frame || {});
  r.frame.anchors = r.frame.anchors || {};
  r.layers = Object.assign({}, d.layers, r.layers || {});
  for (const k of LAYERS) if (!Array.isArray(r.layers[k])) r.layers[k] = [];
  r.budget = Object.assign({}, d.budget, r.budget || {});
  if (typeof r.seed !== 'number') r.seed = 1;
  return r;
}
const envelope = (name, rec, plaque, log) => JSON.stringify({
  what: 'flydiy-premises', v: PREMISES_V, name: name || null, premises: rec,
  plaque: plaque || null, log: log || { built: null, tests: [], flights: [] } });
// an envelope, or a bare record pasted out of a console
function unwrap(txt) {
  const o = typeof txt === 'string' ? JSON.parse(txt) : txt;
  if (o && o.what === 'flydiy-premises') return { rec: normalise(migrate(o.premises)), name: o.name || null, plaque: o.plaque || null, log: o.log || null };
  if (o && o.layers) return { rec: normalise(migrate(o)), name: null, plaque: null, log: null };
  throw new Error('not a flyDiy premises');
}
// a stable id a layer has not used: z3, f7, ...
const ID_PREFIX = { terrain: 't', surface: 'y', material: 'm', exclude: 'x', roads: 'r', runways: 'w', zones: 'z', sites: 's', links: 'l', objects: 'o' };
function newId(rec, layer) {
  const used = new Set((rec.layers[layer] || []).map(e => e.id));
  for (let i = 1; ; i++) { const id = (ID_PREFIX[layer] || layer[0]) + i; if (!used.has(id)) return id; }
}
function findById(rec, id) {
  for (const k of LAYERS) { const e = (rec.layers[k] || []).find(e => e.id === id); if (e) return { layer: k, entry: e }; }
  return null;
}

// ---------------------------------------------------------------------------
// the frame — 'free' in v0: an anchor (x, z, yaw) per world id
// ---------------------------------------------------------------------------
function frameOf(rec, world) {
  const wid = (world && world.id) || '*';
  const a = rec.frame.anchors[wid] || rec.frame.anchors['*'] || { x: 0, z: 0, yaw: 0 };
  const c = Math.cos(a.yaw || 0), s = Math.sin(a.yaw || 0);
  // local x -> [c, -s], local z -> [s, c] (placeSite's rotation, verbatim)
  const toWorld = (lx, lz) => [a.x + lx * c + lz * s, a.z - lx * s + lz * c];
  const toLocal = (x, z) => { const dx = x - a.x, dz = z - a.z; return [dx * c - dz * s, dx * s + dz * c]; };
  const y0 = world && world.terrainH ? world.terrainH(a.x, a.z) : 0;
  return { anchor: a, toWorld, toLocal, y0, worldId: wid };
}

// ---------------------------------------------------------------------------
// compose — the overlay a world composes at its terrainH seam
// ---------------------------------------------------------------------------
function compose(rec0, world) {
  const rec = normalise(rec0);
  const F = frameOf(rec, world);
  const mods = [];
  for (const m of rec.layers.terrain) { const M = makeModifier(m, F.y0); if (M) mods.push(M); }
  // the index is in the PREMISES frame (local); the world point is turned once per call
  const index = SpatialIndex(256);
  for (const M of mods) index.add(M.bbox, M);
  const surf = rec.layers.surface.filter(s => s.poly && s.poly.length >= 3).map(s => ({ poly: s.poly, bbox: polyBBox(s.poly), surface: +s.surface }));
  const excl = rec.layers.exclude.filter(s => s.poly && s.poly.length >= 3).map(s => ({ poly: s.poly, bbox: polyBBox(s.poly), what: s.what || ['trees'] }));
  // the extent: the record's own, else the union of everything, else nothing
  let ext = rec.frame.extent;
  if (!ext) {
    let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
    const grow = b => { x0 = Math.min(x0, b.x0); z0 = Math.min(z0, b.z0); x1 = Math.max(x1, b.x1); z1 = Math.max(z1, b.z1); };
    for (const M of mods) grow(M.bbox);
    for (const s of surf) grow(s.bbox);
    for (const s of excl) grow(s.bbox);
    ext = isFinite(x0) ? { x0, z0, x1, z1 } : { x0: 0, z0: 0, x1: 0, z1: 0 };
  }
  const inBB = (b, x, z) => x >= b.x0 && x <= b.x1 && z >= b.z0 && z <= b.z1;
  const O = {
    n: mods.length, rec, frame: F, extent: ext, index,
    terrainH(x, z, h) {
      if (!mods.length) return h;
      const L = F.toLocal(x, z);
      const cell = index.query(L[0], L[1]);
      if (!cell) return h;
      for (let i = 0; i < cell.length; i++) h = cell[i].apply(L[0], L[1], h);
      return h;
    },
    // the composed ground at a world point, from the host's own base
    terrainAt: (x, z) => O.terrainH(x, z, world.terrainH(x, z)),
    surfaceAt(x, z) {
      if (!surf.length) return -1;
      const L = F.toLocal(x, z);
      for (let i = surf.length - 1; i >= 0; i--) { const s = surf[i]; if (inBB(s.bbox, L[0], L[1]) && inPoly(s.poly, L[0], L[1])) return s.surface; }
      return -1;
    },
    excludeAt(x, z, what) {
      if (!excl.length) return false;
      const L = F.toLocal(x, z);
      for (const e of excl) if (inBB(e.bbox, L[0], L[1]) && (!what || e.what.indexOf(what) >= 0) && inPoly(e.poly, L[0], L[1])) return true;
      return false;
    },
    inExtent(x, z) { const L = F.toLocal(x, z); return inBB(ext, L[0], L[1]); },
  };
  return O;
}

// ---------------------------------------------------------------------------
// issues — what refuses a commit; checks — what the panel shows and the gate holds
// ---------------------------------------------------------------------------
function issues(rec0) {
  const rec = normalise(rec0);
  const out = [];
  const polys = [];
  for (const k of ['terrain', 'surface', 'material', 'exclude', 'zones']) for (const e of rec.layers[k]) {
    if (e.kind === 'grade') { if (!e.pts || e.pts.length < 2) out.push(k + ' ' + e.id + ': a grade needs two points'); continue; }
    if (!e.poly || e.poly.length < 3) { out.push(k + ' ' + e.id + ': a polygon needs three points'); continue; }
    if (!polySimple(e.poly)) out.push(k + ' ' + e.id + ': the polygon crosses itself');
    else polys.push({ k, e });
    if (k === 'terrain' && !(+e.falloff > 0)) out.push('terrain ' + e.id + ': falloff must be positive');
  }
  // two flattens at different levels whose bodies overlap: not a fixed point, a mistake
  const fl = rec.layers.terrain.filter(e => e.kind === 'flatten' && e.poly && polySimple(e.poly));
  for (let i = 0; i < fl.length; i++) for (let j = 0; j < i; j++) {
    const a = fl[i], b = fl[j];
    if (Math.abs((+a.level || 0) - (+b.level || 0)) < 0.01) continue;
    const overlap = a.poly.some(p => inPoly(b.poly, p[0], p[1])) || b.poly.some(p => inPoly(a.poly, p[0], p[1]));
    if (overlap) out.push('terrain ' + a.id + ' and ' + b.id + ': two flattens at different levels overlap');
  }
  for (const s of rec.layers.surface) if (!(s.surface >= 0 && s.surface <= 7)) out.push('surface ' + s.id + ': unknown surface ' + s.surface);
  const ids = new Set();
  for (const k of LAYERS) for (const e of rec.layers[k]) { if (ids.has(e.id)) out.push('duplicate id ' + e.id); ids.add(e.id); }
  return out;
}

// the extent rastered to int16 (WORLD-V2 §9's patch, 1 cm steps) — the
// baked mode the live mode must agree with
function bake(overlay, world, extent, cell) {
  const c = cell || 1, ex = extent || overlay.extent;
  const nx = Math.max(2, Math.ceil((ex.x1 - ex.x0) / c) + 1), nz = Math.max(2, Math.ceil((ex.z1 - ex.z0) / c) + 1);
  const data = new Int16Array(nx * nz);
  const F = overlay.frame;
  let lo = Infinity, hi = -Infinity;
  const tmp = new Float32Array(nx * nz);
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const w = F.toWorld(ex.x0 + i * c, ex.z0 + j * c);
    const h = overlay.terrainAt(w[0], w[1]);
    tmp[j * nx + i] = h; if (h < lo) lo = h; if (h > hi) hi = h;
  }
  const step = 0.01, base = Math.floor(lo / step) * step;
  for (let k = 0; k < tmp.length; k++) data[k] = Math.round((tmp[k] - base) / step);
  return { x0: ex.x0, z0: ex.z0, nx, nz, cell: c, step, base, data,
    // bilinear, in the premises frame
    sample(lx, lz) {
      const u = (lx - this.x0) / this.cell, v = (lz - this.z0) / this.cell;
      const i = Math.max(0, Math.min(this.nx - 2, Math.floor(u))), j = Math.max(0, Math.min(this.nz - 2, Math.floor(v)));
      const fu = Math.max(0, Math.min(1, u - i)), fv = Math.max(0, Math.min(1, v - j));
      const g = (a, b) => this.base + this.data[b * this.nx + a] * this.step;
      return (g(i, j) * (1 - fu) + g(i + 1, j) * fu) * (1 - fv) + (g(i, j + 1) * (1 - fu) + g(i + 1, j + 1) * fu) * fv;
    } };
}

// the baked-vs-live tolerance beyond the 1 cm quantisation: bilinear's own bound,
// cell^2 / 8 times the second differences at the cell spacing (|hxx| + |hzz| + 2|hxz|)
function curvTol(O, F, lx, lz, c) {
  const at = (dx, dz) => { const w = F.toWorld(lx + dx, lz + dz); return O.terrainAt(w[0], w[1]); };
  const h0 = at(0, 0);
  const hxx = at(c, 0) - 2 * h0 + at(-c, 0), hzz = at(0, c) - 2 * h0 + at(0, -c);
  const hxz = (at(c, c) - at(c, -c) - at(-c, c) + at(-c, -c)) / 4;
  return 0.125 * (Math.abs(hxx) + Math.abs(hzz) + 2 * Math.abs(hxz));
}

// the check lines: [{ ok, label }] — the panel draws them, the gate counts them
function checks(rec0, world, opts) {
  const rec = normalise(rec0), o = opts || {};
  const lines = [];
  const put = (ok, label) => { lines.push({ ok: !!ok, label }); return ok; };
  // 1 the record round-trips through the envelope
  try {
    const back = unwrap(envelope(rec.name, rec)).rec;
    put(JSON.stringify(back) === JSON.stringify(normalise(rec)), 'the record round-trips');
  } catch (e) { put(false, 'the record round-trips (' + e.message + ')'); }
  const iss = issues(rec);
  put(iss.length === 0, iss.length ? iss[0] : 'every polygon simple, every id unique');
  if (!world || !world.terrainH) return lines;
  const O = compose(rec, world);
  const F = O.frame;
  const rnd = mulberry32(7);
  // 7 every flatten is flat to 1 cm over its body
  let flatOk = true, flats = 0;
  for (const m of rec.layers.terrain) if (m.kind === 'flatten' && m.poly && polySimple(m.poly)) {
    flats++;
    const bb = polyBBox(m.poly), target = (m.abs ? 0 : F.y0) + (+m.level || 0);
    // the LAST flatten wins where two overlap; sample only where this one is the last
    for (let k = 0; k < 200; k++) {
      const lx = bb.x0 + rnd() * (bb.x1 - bb.x0), lz = bb.z0 + rnd() * (bb.z1 - bb.z0);
      if (!inPoly(m.poly, lx, lz)) continue;
      const w = F.toWorld(lx, lz);
      const h = O.terrainAt(w[0], w[1]);
      if (Math.abs(h - target) > 0.01) {
        // a later modifier may legitimately sit on top; only flag when nothing later covers this point
        const later = rec.layers.terrain.slice(rec.layers.terrain.indexOf(m) + 1).some(n => n.poly && inPoly(n.poly, lx, lz));
        if (!later) { flatOk = false; break; }
      }
    }
  }
  put(flatOk, flats ? 'every flatten flat to 1 cm over its body (' + flats + ')' : 'no flatten yet');
  // 6 C1: the slope across every falloff band stays bounded (no step)
  let slopeMax = 0;
  const ex = O.extent, span = Math.max(1, ex.x1 - ex.x0, ex.z1 - ex.z0);
  if (O.n) for (let k = 0; k < 400; k++) {
    const lx = ex.x0 - 8 + rnd() * (ex.x1 - ex.x0 + 16), lz = ex.z0 - 8 + rnd() * (ex.z1 - ex.z0 + 16);
    const w = F.toWorld(lx, lz), w2 = F.toWorld(lx + 0.25, lz);
    const s = Math.abs(O.terrainAt(w2[0], w2[1]) - O.terrainAt(w[0], w[1])) / 0.25;
    if (s > slopeMax) slopeMax = s;
  }
  put(slopeMax < (o.slopeMax || 3.0), 'no step across a falloff (max slope ' + slopeMax.toFixed(2) + ')');
  // 12 baked vs live agree to the quantisation (a small raster, the gate does the big one)
  if (O.n && span < 2000) {
    // 1 m is the contract's cell (rule 12); a wide extent rasters coarser for the
    // panel with a curvature allowance that is zero at 1 m (a feather's bilinear
    // error is curvature, not slope)
    const cell = o.cell || Math.max(1, Math.ceil(span / 400));   // 1 m is the contract's cell; wider extents raster coarser for the panel
    const B = bake(O, world, ex, cell);
    let worst = 0;
    for (let k = 0; k < 400; k++) {
      const lx = ex.x0 + rnd() * (ex.x1 - ex.x0), lz = ex.z0 + rnd() * (ex.z1 - ex.z0);
      const w = F.toWorld(lx, lz);
      const live = O.terrainAt(w[0], w[1]), baked = B.sample(lx, lz);
      // bilinear is exact on a plane: its error is CURVATURE, cell^2 / 8 of the
      // second differences at the cell (contract v1.1) — a step still fails,
      // its second difference is the step itself
      const tol = 0.02 + curvTol(O, F, lx, lz, B.cell);
      const err = Math.abs(live - baked) - tol;
      if (err > worst) worst = err;
    }
    put(worst <= 0, 'baked and live agree (' + (worst <= 0 ? 'within tolerance' : 'over by ' + worst.toFixed(3) + ' m') + ')');
  } else put(true, O.n ? 'baked vs live: extent too large for the panel (the gate rasters it)' : 'baked vs live: nothing to bake yet');
  return lines;
}

// ---------------------------------------------------------------------------
// the catalogue — v0: collect what the loaded generators export, or DERIVE an
// entry per preset for those without one (the contract §2.2)
// ---------------------------------------------------------------------------
const GENERATORS = ['HOUSE_GEN', 'BIG_GEN', 'SHED_GEN', 'TRAM_GEN', 'TOTEM_GEN', 'FACTORY_GEN'];
const GEN_NS = { HOUSE_GEN: 'house', BIG_GEN: 'big', SHED_GEN: 'shed', TRAM_GEN: 'tram', TOTEM_GEN: 'totem', FACTORY_GEN: 'factory' };
function collect(globals) {
  const entries = new Map(), aliases = {}, issuesOut = [];
  for (const g of GENERATORS) {
    const G = globals && globals[g];
    if (!G) continue;
    const ns = GEN_NS[g];
    if (Array.isArray(G.CATALOGUE)) {
      for (const e of G.CATALOGUE) {
        if (entries.has(e.key)) { issuesOut.push('catalogue: key collision ' + e.key); continue; }
        entries.set(e.key, Object.assign({ gen: g }, e));
      }
      Object.assign(aliases, G.CATALOGUE_ALIASES || {});
    } else if (G.PRESETS && G.DEF) {
      for (const name in G.PRESETS) {
        const key = ns + '/' + name;
        if (entries.has(key)) continue;
        entries.set(key, { key, kind: 'building', gen: g, preset: name, P: {}, frame: 'house', derived: true,
          foot: P => { const L = (P.L || 8) / 2, w = (P.w || 6) / 2; return [[-L, -w], [L, -w], [L, w], [-L, w]]; },
          keepOut: 3, ground: { need: 'none' }, size: P => ({ L: P.L || 8, w: P.w || 6 }),
          hooks: () => [], lod: { dist: [0, 150, 500, 1500] }, slots: {}, tags: [ns], headless: true });
      }
    }
  }
  return { entries, aliases, issues: issuesOut, byTag(t) { const out = []; entries.forEach(e => { if ((e.tags || []).indexOf(t) >= 0) out.push(e); }); return out; } };
}

const API = { PREMISES_V, LAYERS, SURFACE, SURFACE_NAMES, PREMISES_MIGRATORS, GENERATORS,
  fnv, hash32, mulberry32, seedOf,
  polyBBox, polyArea, polyCCW, inPoly, sdPoly, distPtSeg, polySimple, ensureCCW, smf01,
  makeModifier, SpatialIndex, DEF, migrate, normalise, envelope, unwrap, newId, findById,
  frameOf, compose, issues, checks, bake, curvTol, collect };
if (typeof window !== 'undefined') window.PREMISES_GEN = API;
if (typeof module !== 'undefined' && module.exports) module.exports = API;
})();
