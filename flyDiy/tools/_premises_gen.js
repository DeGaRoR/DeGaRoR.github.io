// _premises_gen.js — THE PREMISES (G353 / GPREM): the record the world editor
// writes, and everything that reads it headless. PREMISES-CONTRACT-2026-09-13.md
// is the document; this is its code. Pure: no THREE, no DOM, loads in node
// for GATE PREMISES and in the page for the bench and (later) the game, where
// it becomes src/core/27_premises.js.
//
// WHAT IS HERE:
//   the record        DEF / normalise / migrate / envelope / unwrap (the garage's
//                     rulings: nulls kept, plaque beside the record, a bare
//                     record accepted, a load replaces)
//   the seeds         fnv / hash32 / mulberry32 / seedOf — every element its own stream
//   the polygons      even-odd containment (concave allowed), a signed edge
//                     distance, simplicity, orientation, bbox
//   the modifiers     flatten / raise / ramp / grade, each a smoothstep feather
//                     over a signed distance — AERO.grade's idiom, one function
//                     per record, C1 by construction
//   the roads (v1)    polyRoad (arclength, tangent, normal — the village's road
//                     frame), a DERIVED grade for a graded road (its nodes at
//                     the ground, 3-tap smoothed, WORLD-GEN-PROC stage 3's
//                     rule), a DERIVED surface strip, roadNear
//   the sower (v1)    sowPlots — makePlots' loop verbatim, generalised from one
//                     road by arclength to every road inside a polygon; the
//                     fold test, the back-in loop, the riparian rule kept
//   the forest (v1)   planForest — planTrees' wood layer (a jittered grid, a
//                     clearing noise, the keep-outs) inside a forest zone
//   the index         256 m cells keyed by string (treesNear's idiom) so the
//                     hot path is one Map.get and AABB rejects
//   compose           the overlay a world composes at its terrainH seam:
//                     terrainH(x, z, h) / surfaceAt / excludeAt / inExtent,
//                     plus the RECORDS the placement stages emit (plots, trees)
//   the runways (v2)  a strip is a PROFILE (ROADMAP P4 §2): a centreline, a
//                     width, a longitudinal slope; it composes as a DERIVED
//                     grade (elev + slope along the run), a DERIVED surface
//                     strip, a DERIVED tree exclude (+30 m), and publishes an
//                     AERODROME record in W.aerodromes' shape so siteRunway,
//                     sitePattern, the paint and the pilot read it untouched
//   the sites (v3)    placeSite - THEMES / placeSite's item body generalised
//                     to a CATALOGUE KEY: an item stands in its site's frame
//                     on the composed ground (the standing rules verbatim:
//                     the high corner + a hand, the mill's own, a shed astride
//                     the road on its slab), its foot + 3 m keeps the wood
//                     and the plots out; the LINKS: conveyor = the mill's
//                     tramTo (placeSite verbatim), solved before the build
//   the frame         'free' (x, z, yaw); 'road' arrives with the sites
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
const ROAD_CLS = { gravel: SURFACE.GRAVEL, paved: SURFACE.PAVED, track: SURFACE.GRASS, path: SURFACE.GRASS };
const ZONE_KINDS = ['residential', 'commercial', 'industrial', 'harbour', 'park', 'airfield', 'forest', 'clear'];
// the plot rules a zone starts from (the village's VDEF numbers)
const ZONE_RULES = { plotMin: 20, plotMax: 34, plotDepth: 30, riparian: 16, gapOdds: 0.18, sides: 'both' };
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

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
// the village's value noise, for a forest's clearings
function hash2(x, y, s) { const h = Math.sin(x * 127.1 + y * 311.7 + s * 74.7) * 43758.5453; return h - Math.floor(h); }
function vnoise(x, y, s) {
  const ix = Math.floor(x), iy = Math.floor(y);
  let fx = x - ix, fy = y - iy;
  fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy);
  const a = hash2(ix, iy, s), b = hash2(ix + 1, iy, s), c = hash2(ix, iy + 1, s), d = hash2(ix + 1, iy + 1, s);
  return (a + (b - a) * fx) * (1 - fy) + (c + (d - c) * fx) * fy;
}
function fbm(x, y, s, oct) {
  let v = 0, amp = 0.5, f = 1, tot = 0;
  for (let i = 0; i < (oct || 4); i++) { v += vnoise(x * f, y * f, s + i * 13) * amp; tot += amp; amp *= 0.5; f *= 2.1; }
  return v / tot;
}

// ---------------------------------------------------------------------------
// the polygons — poly = [[x, z], ...], any winding, concave allowed
// ---------------------------------------------------------------------------
function polyBBox(poly) {
  let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
  for (const p of poly) { if (p[0] < x0) x0 = p[0]; if (p[0] > x1) x1 = p[0]; if (p[1] < z0) z0 = p[1]; if (p[1] > z1) z1 = p[1]; }
  return { x0, z0, x1, z1 };
}
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
  for (let i = 0, n = poly.length; i < n; i++) { const e = distPtSeg(x, z, poly[i], poly[(i + 1) % n]); if (e < d) d = e; }
  return inPoly(poly, x, z) ? -d : d;
}
function segsCross(a, b, c, d) {
  const o = (p, q, r) => (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);
  const o1 = o(a, b, c), o2 = o(a, b, d), o3 = o(c, d, a), o4 = o(c, d, b);
  return (o1 > 0) !== (o2 > 0) && (o3 > 0) !== (o4 > 0) && o1 !== 0 && o2 !== 0 && o3 !== 0 && o4 !== 0;
}
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
// do two polygons overlap (a corner of one inside the other)
const polysOverlap = (a, b) => a.some(p => inPoly(b, p[0], p[1])) || b.some(p => inPoly(a, p[0], p[1]));

// ---------------------------------------------------------------------------
// the roads — the village's polyRoad: arclength, tangent, and a normal
// ---------------------------------------------------------------------------
function polyRoad(pts, w) {
  const s = [0];
  for (let i = 1; i < pts.length; i++) s.push(s[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const at = t => {
    t = clamp(t, 0, s[s.length - 1]);
    let i = 1;
    while (i < s.length - 1 && s[i] < t) i++;
    const u = (t - s[i - 1]) / Math.max(1e-6, s[i] - s[i - 1]);
    const p = [pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * u, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * u];
    const d = [pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]];
    const L = Math.hypot(d[0], d[1]) || 1;
    const tg = [d[0] / L, d[1] / L];
    return { p, tg, n: [tg[1], -tg[0]] };          // n = the right-hand side; the sower names the sides by the water
  };
  return { pts, s, length: s[s.length - 1], at, w };
}
function roadDist(road, x, z) {
  let d = Infinity;
  for (let i = 1; i < road.pts.length; i++) { const e = distPtSeg(x, z, road.pts[i - 1], road.pts[i]); if (e < d) d = e; }
  return d;
}
// the arclength intervals of a road inside a polygon (sampled every 2 m)
function roadInPoly(road, poly) {
  const out = [];
  let t0 = null;
  for (let t = 0; ; t += 2) {
    const tt = Math.min(t, road.length);
    const p = road.at(tt).p, inside = inPoly(poly, p[0], p[1]);
    if (inside && t0 === null) t0 = tt;
    if (!inside && t0 !== null) { out.push([t0, tt]); t0 = null; }
    if (tt >= road.length) break;
  }
  if (t0 !== null) out.push([t0, road.length]);
  return out;
}
// how far from p along n until the ground is under water (the village's)
function shoreDepth(T, waterY, p, n) {
  let d = 0;
  while (d < 80 && T(p[0] + n[0] * d, p[1] + n[1] * d) > waterY + 0.05) d += 0.5;
  return d;
}

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
  if (m.kind === 'shelf') {
    // THE SHELF (the village's withShelf, verbatim): a pad rect in the ITEM's frame (c, yaw), level
    // inside, the base beyond a front margin (front and sides) or a back margin, smoothstepped
    const c = m.c, cy = Math.cos(m.yaw), sy = Math.sin(m.yaw), R = m.rect;
    const mF = Math.max(0.5, +m.marginF || 6), mB = Math.max(0.5, +m.marginB || mF);
    const corners = [[R.x0 - mF, R.z0 - mB], [R.x1 + mF, R.z0 - mB], [R.x1 + mF, R.z1 + mF], [R.x0 - mF, R.z1 + mF]].map(q => [c[0] + q[0] * cy + q[1] * sy, c[1] - q[0] * sy + q[1] * cy]);
    const bbox = polyBBox(corners);
    const level = +m.level;
    return { id: m.id, kind: 'shelf', bbox, apply: (x, z, h) => {
      if (x < bbox.x0 || x > bbox.x1 || z < bbox.z0 || z > bbox.z1) return h;
      const dx = x - c[0], dz = z - c[1];
      const lx = dx * cy - dz * sy, lz = dx * sy + dz * cy;
      const k = Math.max(Math.max(0, R.z0 - lz) / mB, Math.max(0, R.x0 - lx, lx - R.x1, lz - R.z1) / mF);
      if (k >= 1) return h;
      const sm = k * k * (3 - 2 * k);
      return level + (h - level) * sm;
    } };
  }
  if (m.kind === 'grade') {
    const pts = m.pts, hw = Math.max(0.5, (+m.width || 4) / 2);
    let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
    for (const p of pts) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); z0 = Math.min(z0, p[1]); z1 = Math.max(z1, p[1]); }
    const bbox = { x0: x0 - hw - fall, z0: z0 - hw - fall, x1: x1 + hw + fall, z1: z1 + hw + fall };
    const abs = !!m.abs;
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
      return w > 0 ? h + ((abs ? 0 : y0) + ty - h) * w : h;
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
const PREMISES_MIGRATORS = {};
function migrate(rec) {
  let r = rec, v = +r.v || 1;
  while (v < PREMISES_V) {
    const m = PREMISES_MIGRATORS[v];
    if (!m) throw new Error('premises: no migrator from v' + v);
    r = m(r) || r; v++; r.v = v;
  }
  return r;
}
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
function unwrap(txt) {
  const o = typeof txt === 'string' ? JSON.parse(txt) : txt;
  if (o && o.what === 'flydiy-premises') return { rec: normalise(migrate(o.premises)), name: o.name || null, plaque: o.plaque || null, log: o.log || null };
  if (o && o.layers) return { rec: normalise(migrate(o)), name: null, plaque: null, log: null };
  throw new Error('not a flyDiy premises');
}
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
// the frame — 'free': an anchor (x, z, yaw) per world id
// ---------------------------------------------------------------------------
function frameOf(rec, world) {
  const wid = (world && world.id) || '*';
  const a = rec.frame.anchors[wid] || rec.frame.anchors['*'] || { x: 0, z: 0, yaw: 0 };
  const c = Math.cos(a.yaw || 0), s = Math.sin(a.yaw || 0);
  const toWorld = (lx, lz) => [a.x + lx * c + lz * s, a.z - lx * s + lz * c];
  const toLocal = (x, z) => { const dx = x - a.x, dz = z - a.z; return [dx * c - dz * s, dx * s + dz * c]; };
  const y0 = world && world.terrainH ? world.terrainH(a.x, a.z) : 0;
  return { anchor: a, toWorld, toLocal, y0, worldId: wid, yaw: a.yaw || 0 };
}

// ---------------------------------------------------------------------------
// THE SOWER — makePlots' loop, generalised: every road inside the zone, both
// sides, the water side named by the ground, the fold test, the back-in
// loop and the riparian rule verbatim; every plot rejected that leaves the
// zone, enters an exclude / keep-out, or overlaps a plot already sown
// ---------------------------------------------------------------------------
function sowPlots(zone, roads, ctx) {
  // ctx = { T(lx, lz) the composed ground in the premises frame, waterY, seed, excludes: [poly], plots: [existing], keepOut: [poly] }
  const V = Object.assign({}, ZONE_RULES, zone.rules || {});
  const density = zone.density === undefined ? 1 : clamp(+zone.density, 0, 1);
  const gapOdds = clamp(V.gapOdds + 0.6 * (1 - density), 0, 0.95);
  const plots = [];
  const all = () => ctx.plots.concat(plots);
  const rejectAt = (x, z) => !inPoly(zone.poly, x, z) || ctx.excludes.some(p => inPoly(p, x, z)) || (ctx.keepOut || []).some(p => inPoly(p, x, z));
  for (const road of roads) {
    const rd = polyRoad(road.pts, road.w || 3.6);
    if (rd.length < 40) continue;
    const zoneSeed = zone.seed !== null && zone.seed !== undefined ? zone.seed : seedOf(ctx.seed, 'zone', zone.id);
    const rnd = mulberry32(hash32(zoneSeed, fnv(String(road.id))));
    for (const [tA, tB] of roadInPoly(rd, zone.poly)) {
      if (tB - tA < 30) continue;
      let t = tA + 6 + rnd() * 8;
      let k = 0;
      while (t < tB - 26) {
        const w = V.plotMin + rnd() * (V.plotMax - V.plotMin);
        if (t + w > tB - 6) break;
        for (const sgn of [1, -1]) {
          if (V.sides === 'right' && sgn < 0) continue;
          if (V.sides === 'left' && sgn > 0) continue;
          if (rnd() < gapOdds) continue;
          const a = rd.at(t), b = rd.at(t + w);
          const an = [a.n[0] * sgn, a.n[1] * sgn], bn = [b.n[0] * sgn, b.n[1] * sgn];   // away from the road, this side
          const off = rd.w / 2 + 1.0;
          const f0 = [a.p[0] + an[0] * off, a.p[1] + an[1] * off];
          const f1 = [b.p[0] + bn[0] * off, b.p[1] + bn[1] * off];
          // the water side is where the ground goes under within the plot's depth
          const sd0 = shoreDepth(ctx.T, ctx.waterY, f0, an), sd1 = shoreDepth(ctx.T, ctx.waterY, f1, bn);
          const side = (sd0 < V.plotDepth + 10 || sd1 < V.plotDepth + 10) && sd0 < 80 && sd1 < 80 ? 'water' : 'land';
          let b0, b1, depth;
          const back = cut => {
            if (side === 'water') {
              const d0 = sd0 + V.riparian - cut, d1 = sd1 + V.riparian - cut;
              b0 = [f0[0] + an[0] * d0, f0[1] + an[1] * d0];
              b1 = [f1[0] + bn[0] * d1, f1[1] + bn[1] * d1];
              depth = Math.min(d0, d1);
            } else {
              depth = V.plotDepth - cut;
              b0 = [f0[0] + an[0] * depth, f0[1] + an[1] * depth];
              b1 = [f1[0] + bn[0] * depth, f1[1] + bn[1] * depth];
            }
          };
          back(0);
          if (side === 'water' && depth < 12 + V.riparian) continue;    // the road is nearly on the beach here
          const fe = [f1[0] - f0[0], f1[1] - f0[1]];
          let be = [b1[0] - b0[0], b1[1] - b0[1]];
          if (fe[0] * be[0] + fe[1] * be[1] < 0.35 * Math.hypot(fe[0], fe[1]) * Math.hypot(be[0], be[1])) continue;
          if (Math.hypot(be[0], be[1]) < 9) continue;
          // pull the back in until no corner is in a neighbour, none of theirs in it, and it stays in the zone
          let ok = false;
          const dMin = side === 'water' ? 12 + V.riparian : 14;
          for (let cut = 0; depth - cut >= dMin && !ok; cut += 2) {
            back(cut);
            const q = [f0, f1, b1, b0];
            ok = !all().some(p => polysOverlap(p.poly, q)) && !q.some(c => rejectAt(c[0], c[1]));
          }
          if (!ok) continue;
          be = [b1[0] - b0[0], b1[1] - b0[1]];
          const poly = [f0, f1, b1, b0];
          const nrm2 = [an[0] + bn[0], an[1] + bn[1]];
          const nl = Math.hypot(nrm2[0], nrm2[1]) || 1;
          plots.push({ id: zone.id + ':' + road.id + ':' + (k++), zone: zone.id, road: road.id, side, s0: t, s1: t + w, poly, depth,
                       n: [nrm2[0] / nl, nrm2[1] / nl], front: [(f0[0] + f1[0]) / 2, (f0[1] + f1[1]) / 2],
                       tg: [fe[0] / Math.hypot(fe[0], fe[1]), fe[1] / Math.hypot(fe[0], fe[1])], w,
                       seed: hash32(zoneSeed, fnv(road.id + ':' + (k - 1))), kind: zone.kind });
        }
        t += w + (rnd() < 0.5 ? 0 : 2 + rnd() * 4);
      }
    }
  }
  return plots;
}

// THE PICKERS (contract §4): a plot's building by the zone's kind, from the catalogue BY TAG -
// 'sampler' is the house generator's own draw (what a residential plot gets, and what any kind
// gets when no entry carries its tag: the generators tag their entries, the editor names none)
const PICK_TAGS = { residential: null, commercial: 'commercial', industrial: 'industrial', harbour: 'harbour', park: 'park' };
function pickFor(plot, cat, rnd) {
  const tag = PICK_TAGS[plot.kind];
  if (!tag || !cat || !cat.byTag) return 'sampler';
  const list = cat.byTag(tag).filter(e => e.kind === 'building' || e.kind === 'park');
  if (!list.length) return 'sampler';
  return list[Math.floor(rnd() * list.length) % list.length].key;
}

// THE FOREST — planTrees' wood layer inside a forest zone: a jittered grid at
// a spacing the density sets, a clearing noise, off the water, the roads,
// the plots, the excludes; the species drawn from the palette by proportion
function planForest(zone, ctx) {
  // ctx = { T, waterY, seed, excludes, plots, roads: [{pts, w}], pool: [{key, size, sink, proportion, h}], trees: [existing] }
  const density = zone.density === undefined ? 1 : clamp(+zone.density, 0.05, 3);
  const step = 6 / Math.sqrt(density);
  const pool = (zone.palette && zone.palette.length ? ctx.pool.filter(p => zone.palette.indexOf(p.key) >= 0) : ctx.pool);
  const list = pool.length ? pool : [{ key: 'stub|tree', size: 1, sink: 0, proportion: 1, h: 12 }];
  const zoneSeed = zone.seed !== null && zone.seed !== undefined ? zone.seed : seedOf(ctx.seed, 'zone', zone.id);
  const rnd = mulberry32(zoneSeed);
  const draw = () => { const tot = list.reduce((s, p) => s + (p.proportion || 1), 0); let r = rnd() * tot; for (const p of list) { r -= (p.proportion || 1); if (r <= 0) return p; } return list[list.length - 1]; };
  const roadNear = (x, z) => { let d = 1e9; for (const r of ctx.roads) d = Math.min(d, roadDist(r, x, z) - (r.w || 3.6) / 2); return d; };
  const trees = [];
  const clearOf = (x, z, m) => trees.every(t => Math.hypot(t.x - x, t.z - z) >= m) && ctx.trees.every(t => Math.hypot(t.x - x, t.z - z) >= m);
  const bb = polyBBox(zone.poly), s = zoneSeed % 1000 * 0.618 + 9;
  const clearing = zone.rules && zone.rules.clearings === false ? -1 : 0.38;
  for (let z = bb.z0 + 1; z < bb.z1; z += step) for (let x = bb.x0 + 1; x < bb.x1; x += step) {
    const px = x + (rnd() - 0.5) * step * 0.75, pz = z + (rnd() - 0.5) * step * 0.75;
    if (!inPoly(zone.poly, px, pz)) continue;
    if (fbm(px * 0.035 + 2.2, pz * 0.035 + 8.8, s, 3) < clearing) continue;
    if (ctx.T(px, pz) < ctx.waterY + 0.6) continue;
    if (roadNear(px, pz) < 3) continue;
    if (ctx.plots.some(p => sdPoly(p.poly, px, pz) < 1.5)) continue;
    if (ctx.excludes.some(p => inPoly(p, px, pz))) continue;
    if (!clearOf(px, pz, Math.min(3.2, step * 0.55))) continue;
    const p = draw();
    const size = (p.size || 1) * (0.82 + rnd() * 0.4);
    trees.push({ x: px, z: pz, key: p.key, size, yaw: rnd() * Math.PI * 2, sink: p.sink || 0, h: (p.h || 12) * size / (p.size || 1), zone: zone.id });
  }
  return trees;
}

// ---------------------------------------------------------------------------
// THE RUNWAYS — a strip's geometry from its record, in the premises frame
// ---------------------------------------------------------------------------
const RUNWAY_DEF = { name: 'strip', len: 480, wid: 24, surface: SURFACE.GRASS, slope: 0, crossfall: 0, disp: [0, 0], papi: [true, true], falloff: null, site: null, pattern: null };
function runwayEnds(r) {
  const d = [Math.cos(r.hdg), Math.sin(r.hdg)], hl = r.len / 2;
  return { d, n: [-d[1], d[0]], end0: [r.c[0] - d[0] * hl, r.c[1] - d[1] * hl], end1: [r.c[0] + d[0] * hl, r.c[1] + d[1] * hl] };
}
// the strip's box, with a margin, as a polygon (for the exclude and the hit)
function runwayBox(r, margin) {
  const E = runwayEnds(r), m = margin || 0, hw = r.wid / 2 + m;
  const a = [E.end0[0] - E.d[0] * m, E.end0[1] - E.d[1] * m], b = [E.end1[0] + E.d[0] * m, E.end1[1] + E.d[1] * m];
  return [[a[0] + E.n[0] * hw, a[1] + E.n[1] * hw], [b[0] + E.n[0] * hw, b[1] + E.n[1] * hw], [b[0] - E.n[0] * hw, b[1] - E.n[1] * hw], [a[0] - E.n[0] * hw, a[1] - E.n[1] * hw]];
}
// the record in W.aerodromes' shape, in WORLD coordinates (24_world_aero's push)
function runwayAerodrome(r, F, elev) {
  const E = runwayEnds(r);
  const c = F.toWorld(r.c[0], r.c[1]);
  const dw = [E.d[0] * Math.cos(F.yaw) + E.d[1] * Math.sin(F.yaw), -E.d[0] * Math.sin(F.yaw) + E.d[1] * Math.cos(F.yaw)];
  const hdg = Math.atan2(dw[1], dw[0]);
  const hl = r.len / 2, aimIn = (r.len - 10) / 4;
  // the pilot lands along -hdg over thr1 (5 m inside end1): the target sits a quarter in from that bar
  const tdz = [c[0] + dw[0] * (hl - 5 - aimIn), c[1] + dw[1] * (hl - 5 - aimIn)];
  const spawn = [c[0] - dw[0] * (hl - 35), c[1] - dw[1] * (hl - 35)];
  // the strip's own flat, in the world: its graded box (the width and the shoulder) - siteOnFlat asks it
  const shoulder = r.falloff !== null && r.falloff !== undefined ? +r.falloff : Math.min(120, 40 + r.len * 0.06);
  const flatBox = runwayBox(r, shoulder).map(q => F.toWorld(q[0], q[1]));
  return { id: r.id, name: r.name || 'strip', kind: 'strip', x: c[0], z: c[1], hdg, len: r.len, wid: r.wid, flat: (x, z) => inPoly(flatBox, x, z),
           surface: r.surface === undefined ? SURFACE.GRASS : +r.surface, elev, tdz, spawn, flyIn: false, premises: true,
           slope: +r.slope || 0, disp: r.disp || [0, 0], papi: r.papi || [true, true] };
}

// ---------------------------------------------------------------------------
// THE SITES — placeSite's item body, on a catalogue entry
// ---------------------------------------------------------------------------
// a site's frame: `at` in the premises frame, x along, z "inland"; an item's
// yaw 0 faces -z of the site (the road side, THEMES' convention), so its
// world yaw is at.yaw + pi + item.yaw (placeSite: atan2(-up) + it.yaw)
function siteFrame(site) {
  const a = site.at || { x: 0, z: 0, yaw: 0 };
  const c = Math.cos(a.yaw || 0), sn = Math.sin(a.yaw || 0);
  return { at: a, toLocal: (lx, lz) => [a.x + lx * c + lz * sn, a.z - lx * sn + lz * c] };
}
function placeSite(site, cat, ctx) {
  // ctx = { T(lx, lz) the composed ground in the premises frame, waterY, seed }
  const SF = siteFrame(site);
  const out = [], keepOut = [], issues = [];
  (site.items || []).forEach((it, k) => {
    const key = cat.aliases[it.key] || it.key;
    const entry = cat.entries.get(key);
    if (!entry) { issues.push('site ' + site.id + ': no catalogue entry for ' + it.key); return; }
    const c = SF.toLocal(it.x || 0, it.z || 0);
    const yaw = (SF.at.yaw || 0) + Math.PI + (it.yaw || 0);
    const cy = Math.cos(yaw), sy = Math.sin(yaw);
    const toWorld = (lx, lz) => [c[0] + lx * cy + lz * sy, c[1] - lx * sy + lz * cy];
    const oy = ctx.T(c[0], c[1]);
    const ground = (lx, lz) => { const w = toWorld(lx, lz); return ctx.T(w[0], w[1]) - oy; };
    const P = entry.params ? entry.params(it.P || {}) : Object.assign({}, entry.P || {}, it.P || {});
    P.preset = entry.preset; P.slopeX = 0; P.slopeZ = 0; P.ground = ground; P.waterY = ctx.waterY - oy;
    if (entry.gen === 'BIG_GEN') P.big = 1;
    if (entry.gen === 'HOUSE_GEN') { P.water = 0; P.pier = 0; }
    const size = entry.size ? entry.size(P) : { L: P.L || 8, w: P.w || 6 };
    // STANDING (placeSite verbatim): the mill on its lowest tier's front corners + 0.6; a shed
    // astride the road on its slab a hand over the ground, no plinth; a big building on its plinth
    // over the high corner; a house on the high corner by its stance
    if (P.mill) {
      P.floorY = Math.max(ground(-P.tierL0 / 2, P.tierW / 2), ground(P.tierL0 / 2, P.tierW / 2)) + 0.6;
      if (it.bottomOnRoad) { P.bottomGap = (it.z || 0) - P.tierW / 2 - (P.bottomW || 9) / 2; P.bottomL = 16; }
    } else {
      let hiC = -1e9;
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) hiC = Math.max(hiC, ground(sx * size.L / 2, sz * size.w / 2));
      if (entry.gen === 'BIG_GEN') { P.floorY = hiC + (it.onRoad ? 0.06 : Math.max(0.3, P.floorY || 0)); if (it.onRoad) P.plinth = 0; }
      else P.floorY = hiC + (P.stance === 0 ? 0.3 : 0.55);
    }
    P.site = site.name || site.id;
    const rec = { id: site.id + '/' + (it.id || ('i' + k)), item: it.id || ('i' + k), site: site.id, key, entry, gen: entry.gen, P, x: c[0], z: c[1], y: oy, yaw, toWorld, ground,
                  seed: hash32(seedOf(ctx.seed, 'site', site.id), fnv(String(it.id || k))), size };
    out.push(rec);
    // the keep-out: the foot and a margin, in the premises frame
    const foot = entry.foot ? entry.foot(P) : [[-size.L / 2, -size.w / 2], [size.L / 2, -size.w / 2], [size.L / 2, size.w / 2], [-size.L / 2, size.w / 2]];
    const m = entry.keepOut === undefined ? 3 : +entry.keepOut;
    const fb = polyBBox(foot);
    keepOut.push([[fb.x0 - m, fb.z0 - m], [fb.x1 + m, fb.z0 - m], [fb.x1 + m, fb.z1 + m], [fb.x0 - m, fb.z1 + m]].map(q => toWorld(q[0], q[1])));
    rec.foot = foot.map(q => toWorld(q[0], q[1]));
  });
  return { items: out, keepOut, issues };
}

// THE GROUND UNDER AN ITEM (contract §1.3 stage 5 -> T2, §2 rule 5): an entry that says
// ground.need 'flatten' publishes the SHAPE; the world cuts it - a shelf from
// ground.shelf(P) (the mill's pad: rect, zLevel, marginF, marginB - the level is the
// ground at zLevel ahead along the item's own z), else the foot at its median;
// 'level' is the foot at its high corner (a slab); 'none' stands over whatever is there
function siteShelves(site, cat, T) {
  const SF = siteFrame(site), out = [];
  (site.items || []).forEach((it, k) => {
    const entry = cat.entries.get(cat.aliases[it.key] || it.key);
    if (!entry || !entry.ground || entry.ground.need === 'none' || !entry.ground.need) return;
    const c = SF.toLocal(it.x || 0, it.z || 0);
    const yaw = (SF.at.yaw || 0) + Math.PI + (it.yaw || 0);
    const cy = Math.cos(yaw), sy = Math.sin(yaw);
    const toWorld = (lx, lz) => [c[0] + lx * cy + lz * sy, c[1] - lx * sy + lz * cy];
    const P = entry.params ? entry.params(Object.assign({ recvZ: it.z || 0 }, it.P || {})) : Object.assign({}, entry.P || {}, it.P || {});
    const id = site.id + '/' + (it.id || ('i' + k)) + ':ground';
    if (entry.ground.need === 'flatten' && typeof entry.ground.shelf === 'function') {
      const M = entry.ground.shelf(P);
      const ahead = toWorld(0, M.zLevel || 0);
      out.push({ id, kind: 'shelf', c, yaw, rect: { x0: M.rect[0], z0: M.rect[1], x1: M.rect[2], z1: M.rect[3] }, level: T(ahead[0], ahead[1]), marginF: M.marginF, marginB: M.marginB });
      return;
    }
    const foot = entry.foot ? entry.foot(P) : null;
    if (!foot || foot.length < 3) return;
    const fb = polyBBox(foot);
    let level;
    if (entry.ground.need === 'level' || entry.ground.level === 'high') {
      level = -Infinity;
      for (const q of foot) { const w = toWorld(q[0], q[1]); level = Math.max(level, T(w[0], w[1])); }
    } else {
      const hs = [];
      for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) { const w = toWorld(fb.x0 + (i + 0.5) / 8 * (fb.x1 - fb.x0), fb.z0 + (j + 0.5) / 8 * (fb.z1 - fb.z0)); hs.push(T(w[0], w[1])); }
      hs.sort((a, b) => a - b); level = hs[hs.length >> 1];
    }
    const f = entry.ground.falloff || 6;
    out.push({ id, kind: 'shelf', c, yaw, rect: { x0: fb.x0, z0: fb.z0, x1: fb.x1, z1: fb.z1 }, level, marginF: f, marginB: f });
  });
  return out;
}

// THE LINKS: a solver per kind; 'placed' ones patch P before the build
const LINK_SOLVERS = {
  // the mill's aerial tramway to the receiving shed (placeSite :724-730 verbatim):
  // the target in the mill's own frame, at the shed's eave
  conveyor: { needs: 'placed', band: { maxDx: 120, dyMin: -40, dyMax: 60 },
    solve(link, A, B) {
      const c = Math.cos(A.yaw), sn = Math.sin(A.yaw);
      const dx = B.x - A.x, dz = B.z - A.z;
      const ty = B.y + (B.P.floorY || 0) + (B.P.eaveH || 5) - A.y;
      const to = [dx * c - dz * sn, ty, dx * sn + dz * c];
      const issues = [];
      if (Math.abs(to[0]) > this.band.maxDx) issues.push('conveyor ' + link.id + ': ' + Math.abs(to[0]).toFixed(0) + ' m along is over ' + this.band.maxDx);
      if (ty < this.band.dyMin || ty > this.band.dyMax) issues.push('conveyor ' + link.id + ': a rise of ' + ty.toFixed(0) + ' m is outside ' + this.band.dyMin + '..' + this.band.dyMax);
      return { ok: !issues.length, geom: { from: [A.x, A.y + (A.P.floorY || 0) + 6, A.z], to: [B.x, B.y + (B.P.floorY || 0) + (B.P.eaveH || 5), B.z] }, patch: { [A.id]: { tramTo: to } }, issues };
    } },
};
// THE CABLE (phase 'built'): the village's tramLine is the solver - handed a vil of the two
// station records ({ P, x, z, y, yaw, toWorld }) and a build callback it calls three times
// each to read the hooks in the world and set lineDeg on both; it leaves vil.tram
// { angle, ropes[6] {kind, line, a, b}, docks, slots, base, top, pair }. Not on master yet
// (the village-tram branch): without it the link says so and stays red.
LINK_SOLVERS.cable = { needs: 'built', band: { minDeg: 15, maxDeg: 45 },
  solve(link, A, B, ctx) {
    const VG = ctx.globals && ctx.globals.VILLAGE_GEN;
    if (!VG || typeof VG.tramLine !== 'function') return { ok: false, geom: null, patch: {}, issues: ['cable ' + link.id + ': VILLAGE_GEN.tramLine is not here yet (the village-tram branch carries it)'] };
    if (!ctx.build) return { ok: false, geom: null, patch: {}, issues: ['cable ' + link.id + ': no build callback for the stations'] };
    const st = r => Math.round(r.P.station || 0);
    const base = st(A) === 2 ? A : st(B) === 2 ? B : null, top = st(A) === 1 ? A : st(B) === 1 ? B : null;
    if (!base || !top) return { ok: false, geom: null, patch: {}, issues: ['cable ' + link.id + ': needs one base station (P.station 2) and one top station (P.station 1)'] };
    const vil = { base, top, T: { h: ctx.T } };
    let tram;
    try { tram = VG.tramLine(vil, r => ctx.build(r)); } catch (e) { return { ok: false, geom: null, patch: {}, issues: ['cable ' + link.id + ': ' + (e && e.message)] }; }
    const issues = [];
    const deg = tram && tram.angle !== undefined ? (Math.abs(tram.angle) > 3.2 ? tram.angle : tram.angle * 180 / Math.PI) : NaN;
    if (!(deg >= this.band.minDeg && deg <= this.band.maxDeg)) issues.push('cable ' + link.id + ': the line is ' + (isFinite(deg) ? deg.toFixed(0) + ' deg' : 'unsolved') + ', outside ' + this.band.minDeg + '..' + this.band.maxDeg);
    return { ok: !issues.length, geom: tram, patch: { [base.id]: { lineDeg: base.P.lineDeg }, [top.id]: { lineDeg: top.P.lineDeg } }, issues };
  } };
function solveLinks(rec, items, phase, ctx) {
  const byId = {}; for (const it of items) byId[it.site + '/' + it.item] = it;
  const out = [];
  for (const L of rec.layers.links || []) {
    const S = LINK_SOLVERS[L.kind];
    if (!S) { out.push({ link: L, ok: false, issues: ['link ' + L.id + ': unknown kind ' + L.kind] }); continue; }
    if (S.needs !== phase) continue;
    const A = byId[(L.from.site || '') + '/' + L.from.item] || items.find(i => i.item === L.from.item);
    const B = byId[(L.to.site || '') + '/' + L.to.item] || items.find(i => i.item === L.to.item);
    if (!A || !B) { out.push({ link: L, ok: false, issues: ['link ' + L.id + ': an end is missing'] }); continue; }
    const sol = S.solve(L, A, B, ctx || {});
    for (const id in sol.patch || {}) { const it = items.find(i => i.id === id); if (it) Object.assign(it.P, sol.patch[id]); }
    out.push(Object.assign({ link: L, A, B }, sol));
  }
  return out;
}

// ---------------------------------------------------------------------------
// compose — the overlay a world composes at its terrainH seam
// ---------------------------------------------------------------------------
function compose(rec0, world, opts) {
  const o = opts || {};
  const rec = normalise(rec0);
  const F = frameOf(rec, world);
  const mods = [];
  for (const m of rec.layers.terrain) { const M = makeModifier(m, F.y0); if (M) mods.push(M); }
  // T1: the authored modifiers alone, in the premises frame, to read a road's node heights from
  const T1 = (lx, lz) => { const w = F.toWorld(lx, lz); let h = world.terrainH(w[0], w[1]); for (const M of mods) h = M.apply(lx, lz, h); return h; };
  // THE ROADS (stage 2): a graded road is a DERIVED grade whose nodes sit on
  // T1, 3-tap smoothed along the profile (WORLD-GEN-PROC stage 3's roadbed
  // rule: flat across, the profile smoothed along); a surface strip of its class
  const roads = rec.layers.roads.filter(r => r.pts && r.pts.length >= 2);
  const roadObjs = roads.map(r => ({ id: r.id, pts: r.pts, w: +r.w || 3.6, surface: r.surface !== undefined ? +r.surface : (ROAD_CLS[r.cls] !== undefined ? ROAD_CLS[r.cls] : SURFACE.GRAVEL) }));
  const nAuth = mods.length;
  // THE RUNWAYS (stage 2, BEFORE the roads - v1.2: a taxi road near a strip must sit on the strip's graded ground, so its nodes are read after the runway grades): a DERIVED grade along the centreline at elev + slope * s
  // (elev = T1 at the centre), a DERIVED surface strip of the record's class,
  // a DERIVED tree exclude 30 m round the box, and the aerodrome record
  const runways = rec.layers.runways.filter(r => r.c && r.len > 0 && r.wid > 0).map(r => Object.assign({}, RUNWAY_DEF, r));
  const aerodromes = [];
  for (const r of runways) {
    const E = runwayEnds(r);
    const elev = T1(r.c[0], r.c[1]);
    const rise = (+r.slope || 0) * r.len / 2;
    const fall = r.falloff !== null && r.falloff !== undefined ? +r.falloff : Math.min(120, 40 + r.len * 0.06);
    const M = makeModifier({ id: r.id + ':grade', kind: 'grade', pts: [[E.end0[0], E.end0[1], elev - rise], [E.end1[0], E.end1[1], elev + rise]], width: r.wid, falloff: fall, abs: true }, F.y0);
    if (M) mods.push(M);
    roadObjs.push({ id: r.id, pts: [E.end0, E.end1], w: r.wid, surface: r.surface === undefined ? SURFACE.GRASS : +r.surface, runway: true });
    aerodromes.push(runwayAerodrome(r, F, elev));
  }
  // THE ROADS (stage 3): a road's nodes sit on the ground AFTER the runways graded it
  const T1r = (lx, lz) => { const w = F.toWorld(lx, lz); let h = world.terrainH(w[0], w[1]); for (const M of mods) h = M.apply(lx, lz, h); return h; };
  for (const r of roads) {
    if (r.graded === false) continue;
    const hs = r.pts.map(p => T1r(p[0], p[1]));
    const sm = hs.map((h, i) => (i === 0 || i === hs.length - 1) ? h : (hs[i - 1] + 2 * h + hs[i + 1]) / 4);
    const M = makeModifier({ id: r.id + ':grade', kind: 'grade', pts: r.pts.map((p, i) => [p[0], p[1], sm[i]]), width: +r.w || 3.6, falloff: +r.falloff || 6, abs: true }, F.y0);
    if (M) mods.push(M);
  }
  // THE GROUND UNDER THE SITES (stage 5 -> T2): every item's shelf, from its entry, cut before anything is placed
  const catS = o.catalogue || collect(o.globals || (typeof window !== 'undefined' ? window : {}));
  const T1s = (lx, lz) => { const w = F.toWorld(lx, lz); let h = world.terrainH(w[0], w[1]); for (const M of mods) h = M.apply(lx, lz, h); return h; };
  const shelves = [];
  for (const st of rec.layers.sites) for (const sh of siteShelves(st, catS, T1s)) { const M = makeModifier(sh, F.y0); if (M) { mods.push(M); shelves.push(sh); } }
  const index = SpatialIndex(256);
  for (const M of mods) index.add(M.bbox, M);
  const surf = rec.layers.surface.filter(s => s.poly && s.poly.length >= 3).map(s => ({ poly: s.poly, bbox: polyBBox(s.poly), surface: +s.surface }));
  const excl = rec.layers.exclude.filter(s => s.poly && s.poly.length >= 3).map(s => ({ poly: s.poly, bbox: polyBBox(s.poly), what: s.what || ['trees'] }));
  for (const r of runways) { const box = runwayBox(r, 30); excl.push({ poly: box, bbox: polyBBox(box), what: ['trees', 'settle', 'plots'], derived: true, runway: r.id }); }
  // a hard surface (paved / gravel / sand) grows no tree and takes no plot: an apron is an apron
  for (const sp of rec.layers.surface) if (sp.poly && sp.poly.length >= 3 && [SURFACE.PAVED, SURFACE.GRAVEL, SURFACE.SAND].indexOf(+sp.surface) >= 0) excl.push({ poly: sp.poly, bbox: polyBBox(sp.poly), what: ['trees', 'plots'], derived: true, surface: sp.id });
  // a clear zone is a derived exclude of trees
  for (const z of rec.layers.zones) if (z.kind === 'clear' && z.poly && z.poly.length >= 3) excl.push({ poly: z.poly, bbox: polyBBox(z.poly), what: ['trees'], derived: true });
  let ext = rec.frame.extent;
  if (!ext) {
    let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
    const grow = b => { x0 = Math.min(x0, b.x0); z0 = Math.min(z0, b.z0); x1 = Math.max(x1, b.x1); z1 = Math.max(z1, b.z1); };
    for (const M of mods) grow(M.bbox);
    for (const s of surf) grow(s.bbox);
    for (const s of excl) grow(s.bbox);
    for (const z of rec.layers.zones) if (z.poly && z.poly.length >= 3) grow(polyBBox(z.poly));
    for (const r of runways) grow(polyBBox(runwayBox(r, 30)));
    for (const M of mods) grow(M.bbox);
    ext = isFinite(x0) ? { x0, z0, x1, z1 } : { x0: 0, z0: 0, x1: 0, z1: 0 };
  }
  const inBB = (b, x, z) => x >= b.x0 && x <= b.x1 && z >= b.z0 && z <= b.z1;
  const roadBB = roadObjs.map(r => { const b = polyBBox(r.pts); return { x0: b.x0 - r.w, z0: b.z0 - r.w, x1: b.x1 + r.w, z1: b.z1 + r.w }; });
  for (const r of rec.layers.zones) if (r.poly && r.poly.length >= 3) { /* an airfield zone is its runway's ground: no plots, no trees */ if (r.kind === 'airfield') excl.push({ poly: r.poly, bbox: polyBBox(r.poly), what: ['trees', 'plots'], derived: true }); }
  const O = {
    n: mods.length, nAuthored: nAuth, rec, frame: F, extent: ext, index, roads: roadObjs.filter(r => !r.runway), runways, aerodromes, shelves,
    terrainH(x, z, h) {
      if (!mods.length) return h;
      const L = F.toLocal(x, z);
      const cell = index.query(L[0], L[1]);
      if (!cell) return h;
      for (let i = 0; i < cell.length; i++) h = cell[i].apply(L[0], L[1], h);
      return h;
    },
    terrainAt: (x, z) => O.terrainH(x, z, world.terrainH(x, z)),
    // the composed ground in the PREMISES frame
    localH: (lx, lz) => { const w = F.toWorld(lx, lz); return O.terrainAt(w[0], w[1]); },
    surfaceAt(x, z) {
      const L = F.toLocal(x, z);
      for (let i = surf.length - 1; i >= 0; i--) { const s = surf[i]; if (inBB(s.bbox, L[0], L[1]) && inPoly(s.poly, L[0], L[1])) return s.surface; }
      for (let i = 0; i < roadObjs.length; i++) if (inBB(roadBB[i], L[0], L[1]) && roadDist(roadObjs[i], L[0], L[1]) <= roadObjs[i].w / 2) return roadObjs[i].surface;
      return -1;
    },
    excludeAt(x, z, what) {
      if (!excl.length) return false;
      const L = F.toLocal(x, z);
      for (const e of excl) if (inBB(e.bbox, L[0], L[1]) && (!what || e.what.indexOf(what) >= 0) && inPoly(e.poly, L[0], L[1])) return true;
      return false;
    },
    roadNear(x, z) { const L = F.toLocal(x, z); let d = Infinity; for (const r of roadObjs) d = Math.min(d, roadDist(r, L[0], L[1])); return d; },
    inExtent(x, z) { const L = F.toLocal(x, z); return inBB(ext, L[0], L[1]); },
    records: { plots: [], trees: [], items: [], links: [], issues: [], excludes: excl.map(e => e.poly) },
  };
  // PLACEMENT (stage 5): the zones sown in array order — a later zone's plots
  // reject against the earlier ones; forest zones plant after every plot is known
  if (!o.noPlace) {
    const waterY = world.waterH ? world.waterH(F.anchor.x, F.anchor.z) : -Infinity;
    const ctx = { T: O.localH, waterY, seed: rec.seed, excludes: excl.filter(e => e.what.indexOf('trees') >= 0).map(e => e.poly), plots: O.records.plots, keepOut: excl.filter(e => e.what.indexOf('plots') >= 0).map(e => e.poly) };
    // THE SITES (stage 5a): placed first; every item's foot + margin keeps the plots and the wood out
    const cat = catS;
    for (const st of rec.layers.sites) {
      const S = placeSite(st, cat, ctx);
      for (const it of S.items) O.records.items.push(it);
      for (const k of S.keepOut) { ctx.keepOut.push(k); ctx.excludes.push(k); O.records.excludes.push(k); }
      for (const i of S.issues) O.records.issues.push(i);
    }
    O.records.links = solveLinks(rec, O.records.items, 'placed');
    // phase B: the links that need the BUILT stations - only when the caller hands a builder (the
    // renderer does; the gate does under its stub); tramLine builds the pair itself, three passes
    const linksB = solveLinks(rec, O.records.items, 'built', { globals: o.globals || (typeof window !== 'undefined' ? window : {}), build: o.build || null, T: O.localH });
    for (const L of linksB) O.records.links.push(L);
    for (const L of O.records.links) for (const i of L.issues || []) O.records.issues.push(i);
    for (const z of rec.layers.zones) {
      if (!z.poly || z.poly.length < 3 || !polySimple(z.poly)) continue;
      if (['residential', 'commercial', 'industrial', 'harbour', 'park'].indexOf(z.kind) >= 0)
        for (const p of sowPlots(z, roads, ctx)) { p.pick = pickFor(p, cat, mulberry32(p.seed ^ 0x51ed)); O.records.plots.push(p); }
    }
    const pool = o.pool || [];
    const tctx = { T: O.localH, waterY, seed: rec.seed, excludes: ctx.excludes, plots: O.records.plots, roads: roadObjs, pool, trees: O.records.trees };
    for (const z of rec.layers.zones) if (z.kind === 'forest' && z.poly && z.poly.length >= 3 && polySimple(z.poly))
      for (const t of planForest(z, tctx)) O.records.trees.push(t);
    // the hand-placed trees (objects of kind 'tree'), in the premises frame, TREE_PLACE's record
    for (const ob of rec.layers.objects) if (ob.kind === 'tree') O.records.trees.push({ x: ob.x, z: ob.z, key: ob.key, size: ob.size || 1, yaw: ob.yaw || 0, sink: 0, h: 12, id: ob.id, placed: true });
    for (const t of O.records.trees) t.y = O.localH(t.x, t.z);
  }
  return O;
}

// ---------------------------------------------------------------------------
// issues — what refuses a commit; checks — what the panel shows and the gate holds
// ---------------------------------------------------------------------------
function issues(rec0) {
  const rec = normalise(rec0);
  const out = [];
  for (const k of ['terrain', 'surface', 'material', 'exclude', 'zones']) for (const e of rec.layers[k]) {
    if (e.kind === 'grade') { if (!e.pts || e.pts.length < 2) out.push(k + ' ' + e.id + ': a grade needs two points'); continue; }
    if (!e.poly || e.poly.length < 3) { out.push(k + ' ' + e.id + ': a polygon needs three points'); continue; }
    if (!polySimple(e.poly)) out.push(k + ' ' + e.id + ': the polygon crosses itself');
    if (k === 'terrain' && !(+e.falloff > 0)) out.push('terrain ' + e.id + ': falloff must be positive');
    if (k === 'zones' && ZONE_KINDS.indexOf(e.kind) < 0) out.push('zone ' + e.id + ': unknown kind ' + e.kind);
  }
  for (const r of rec.layers.roads) { if (!r.pts || r.pts.length < 2) out.push('road ' + r.id + ': a road needs two points'); else if (!(+r.w > 0)) out.push('road ' + r.id + ': width must be positive'); }
  for (const r of rec.layers.runways) {
    if (!r.c || !(r.len >= 150)) out.push('runway ' + r.id + ': a strip is at least 150 m');
    else if (!(r.wid >= 8)) out.push('runway ' + r.id + ': a strip is at least 8 m wide');
    else if (Math.abs(+r.slope || 0) > 0.05) out.push('runway ' + r.id + ': a slope over 5 % is not a strip');
  }
  const fl = rec.layers.terrain.filter(e => e.kind === 'flatten' && e.poly && polySimple(e.poly));
  for (let i = 0; i < fl.length; i++) for (let j = 0; j < i; j++) {
    const a = fl[i], b = fl[j];
    if (Math.abs((+a.level || 0) - (+b.level || 0)) < 0.01) continue;
    if (polysOverlap(a.poly, b.poly)) out.push('terrain ' + a.id + ' and ' + b.id + ': two flattens at different levels overlap');
  }
  for (const s of rec.layers.surface) if (!(s.surface >= 0 && s.surface <= 7)) out.push('surface ' + s.id + ': unknown surface ' + s.surface);
  // two strips whose boxes overlap: the later one re-grades the earlier across its profile - a mistake, not a fixed point
  const rws = rec.layers.runways.filter(r => r.c && r.len >= 150 && r.wid >= 8).map(r => Object.assign({}, RUNWAY_DEF, r));
  for (let i = 0; i < rws.length; i++) for (let j = 0; j < i; j++) if (polysOverlap(runwayBox(rws[i], 0), runwayBox(rws[j], 0))) out.push('runways ' + rws[i].id + ' and ' + rws[j].id + ' cross');
  for (const ob of rec.layers.objects) if (ob.kind === 'tree' && !ob.key) out.push('tree ' + ob.id + ': no species');
  for (const st of rec.layers.sites) { if (!st.at) out.push('site ' + st.id + ': no anchor'); for (const it of st.items || []) if (!it.key) out.push('site ' + st.id + ': an item without a key'); }
  for (const L of rec.layers.links) { if (!LINK_SOLVERS[L.kind]) out.push('link ' + L.id + ': unknown kind ' + L.kind); if (!L.from || !L.to || !L.from.item || !L.to.item) out.push('link ' + L.id + ': needs two ends'); }
  const ids = new Set();
  for (const k of LAYERS) for (const e of rec.layers[k]) { if (ids.has(e.id)) out.push('duplicate id ' + e.id); ids.add(e.id); }
  return out;
}

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
  try {
    const back = unwrap(envelope(rec.name, rec)).rec;
    put(JSON.stringify(back) === JSON.stringify(normalise(rec)), 'the record round-trips');
  } catch (e) { put(false, 'the record round-trips (' + e.message + ')'); }
  const iss = issues(rec);
  put(iss.length === 0, iss.length ? iss[0] : 'every polygon simple, every id unique');
  if (!world || !world.terrainH) return lines;
  const O = o.overlay || compose(rec, world, { pool: o.pool });
  const F = O.frame;
  const rnd = mulberry32(7);
  let flatOk = true, flats = 0;
  for (const m of rec.layers.terrain) if (m.kind === 'flatten' && m.poly && polySimple(m.poly)) {
    flats++;
    const bb = polyBBox(m.poly), target = (m.abs ? 0 : F.y0) + (+m.level || 0);
    for (let k = 0; k < 200; k++) {
      const lx = bb.x0 + rnd() * (bb.x1 - bb.x0), lz = bb.z0 + rnd() * (bb.z1 - bb.z0);
      if (!inPoly(m.poly, lx, lz)) continue;
      const h = O.localH(lx, lz);
      if (Math.abs(h - target) > 0.01) {
        const w = F.toWorld(lx, lz);
        const later = rec.layers.terrain.slice(rec.layers.terrain.indexOf(m) + 1).some(n => n.poly && inPoly(n.poly, lx, lz)) || O.roadNear(w[0], w[1]) < 12;
        if (!later) { flatOk = false; break; }
      }
    }
  }
  put(flatOk, flats ? 'every flatten flat to 1 cm over its body (' + flats + ')' : 'no flatten yet');
  let slopeMax = 0;
  const ex = O.extent, span = Math.max(1, ex.x1 - ex.x0, ex.z1 - ex.z0);
  if (O.n) for (let k = 0; k < 400; k++) {
    const lx = ex.x0 - 8 + rnd() * (ex.x1 - ex.x0 + 16), lz = ex.z0 - 8 + rnd() * (ex.z1 - ex.z0 + 16);
    const s = Math.abs(O.localH(lx + 0.25, lz) - O.localH(lx, lz)) / 0.25;
    if (s > slopeMax) slopeMax = s;
  }
  put(slopeMax < (o.slopeMax || 3.0), 'no step across a falloff (max slope ' + slopeMax.toFixed(2) + ')');
  if (O.n) {
    // the panel's baked-vs-live: the contract's 1 m lattice, sampled LOCALLY at
    // each point (the four lattice neighbours quantised to 1 cm, bilinear) - the
    // same comparison the gate makes over a whole raster, at the cost of four
    // samples per point instead of a raster of the extent
    const cell = 1, q = v => Math.round(v * 100) / 100;
    let worst = 0;
    for (let k = 0; k < 400; k++) {
      const lx = ex.x0 + rnd() * (ex.x1 - ex.x0), lz = ex.z0 + rnd() * (ex.z1 - ex.z0);
      const i = Math.floor(lx / cell) * cell, j = Math.floor(lz / cell) * cell, fu = (lx - i) / cell, fv = (lz - j) / cell;
      const g = (a, b) => q(O.localH(a, b));
      const baked = (g(i, j) * (1 - fu) + g(i + cell, j) * fu) * (1 - fv) + (g(i, j + cell) * (1 - fu) + g(i + cell, j + cell) * fu) * fv;
      const err = Math.abs(O.localH(lx, lz) - baked) - (0.02 + curvTol(O, F, lx, lz, cell));
      if (err > worst) worst = err;
    }
    put(worst <= 0, 'baked and live agree at 1 m (' + (worst <= 0 ? 'within tolerance' : 'over by ' + worst.toFixed(3) + ' m') + ')');
  } else put(true, 'baked vs live: nothing to bake yet');
  // the plots (rule 8): no overlap, inside their zone, outside excludes
  const P = O.records.plots;
  if (P.length) {
    let ok = true, why = '';
    for (let i = 0; i < P.length && ok; i++) {
      const z = rec.layers.zones.find(zz => zz.id === P[i].zone);
      if (!P[i].poly.every(c => inPoly(z.poly, c[0], c[1]))) { ok = false; why = P[i].id + ' leaves its zone'; }
      if (P[i].poly.some(c => O.records.excludes.some(e => inPoly(e, c[0], c[1])))) { ok = false; why = P[i].id + ' in an exclude'; }
      for (let j = 0; j < i && ok; j++) if (polysOverlap(P[i].poly, P[j].poly)) { ok = false; why = P[i].id + ' overlaps ' + P[j].id; }
    }
    put(ok, ok ? P.length + ' plots sown: none overlap, all in their zone' : why);
  }
  const Tn = O.records.trees;
  if (Tn.length) put(!Tn.some(t => !t.placed && (O.records.excludes.some(e => inPoly(e, t.x, t.z)) || P.some(p => inPoly(p.poly, t.x, t.z)))), Tn.length + ' trees: none in an exclude or a plot');
  // the sites (rules 3 and 9): every item resolved, every link solved
  if (O.records.items.length || rec.layers.sites.length) {
    const want = rec.layers.sites.reduce((a, st) => a + (st.items || []).length, 0);
    put(O.records.items.length === want, O.records.items.length + ' of ' + want + ' site items resolved from the catalogue' + (O.records.issues.length ? ' - ' + O.records.issues[0] : ''));
  }
  if (O.records.links.length) put(O.records.links.every(L => L.ok), O.records.links.every(L => L.ok) ? O.records.links.length + ' link' + (O.records.links.length > 1 ? 's' : '') + ' solved' : O.records.links.find(L => !L.ok).issues[0]);
  // the runways (rule 10): the centreline on its profile to 5 cm; the pattern sound
  for (let i = 0; i < O.runways.length; i++) {
    const r = O.runways[i], A = O.aerodromes[i], E = runwayEnds(r);
    let worst = 0;
    for (let t = 0; t <= r.len; t += Math.max(2, r.len / 60)) {
      const lx = E.end0[0] + E.d[0] * t, lz = E.end0[1] + E.d[1] * t;
      const want = A.elev + (+r.slope || 0) * (t - r.len / 2);
      worst = Math.max(worst, Math.abs(O.localH(lx, lz) - want));
    }
    put(worst < 0.05, 'runway ' + r.id + ' on its profile (' + (worst * 100).toFixed(1) + ' cm)');
    if (o.site && o.site.sitePattern) {
      let iss;
      try { const pat = o.site.sitePattern(A, r.site || null); iss = o.site.sitePatternIssues(pat, A, r.site || null, 0, o.site.patternPath || null); }
      catch (e) { iss = ['pattern: ' + e.message]; }
      put(!iss.length, iss.length ? 'runway ' + r.id + ': ' + iss[0] : 'runway ' + r.id + ' pattern sound (sitePatternIssues empty)');
    }
  }
  return lines;
}

// ---------------------------------------------------------------------------
// the catalogue — collect what the loaded generators export, or DERIVE an
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
        const isMill = !!(G.PRESETS[name] && G.PRESETS[name].mill);
        entries.set(key, { key, kind: isMill ? 'complex' : 'building', gen: g, preset: name, P: {}, frame: 'house', derived: true,
          params: ov => Object.assign({}, G.DEF, G.PRESETS[name] || {}, ov || {}),
          // the mill's foot is its tiers' footprint (placeSite :718-720); a house's its L x w
          foot: P => { if (P.mill) { const L = P.tierL0 + 24, w = P.tierW / 2 + (Math.round(P.tiers) - 1) * P.tierStep + P.tierW, zc = -(w / 2 - P.tierW / 2); return [[-L / 2, zc - w / 2], [L / 2, zc - w / 2], [L / 2, zc + w / 2], [-L / 2, zc + w / 2]]; } const L = (P.L || 8) / 2, w = (P.w || 6) / 2; return [[-L, -w], [L, -w], [L, w], [-L, w]]; },
          keepOut: 3, ground: { need: 'none' }, size: P => ({ L: P.L || 8, w: P.w || 6 }),
          hooks: () => [], lod: { dist: [0, 150, 500, 1500] }, slots: {}, tags: [ns], headless: true });
      }
    }
  }
  return { entries, aliases, issues: issuesOut, keys: () => Array.from(entries.keys()), byTag(t) { const out = []; entries.forEach(e => { if ((e.tags || []).indexOf(t) >= 0) out.push(e); }); return out; } };
}

const API = { PREMISES_V, LAYERS, SURFACE, SURFACE_NAMES, ROAD_CLS, ZONE_KINDS, ZONE_RULES, PREMISES_MIGRATORS, GENERATORS,
  fnv, hash32, mulberry32, seedOf, fbm,
  polyBBox, polyArea, polyCCW, inPoly, sdPoly, distPtSeg, polySimple, ensureCCW, smf01, polysOverlap,
  polyRoad, roadDist, roadInPoly, shoreDepth, sowPlots, planForest, pickFor, PICK_TAGS, RUNWAY_DEF, runwayEnds, runwayBox, runwayAerodrome, siteFrame, placeSite, siteShelves, LINK_SOLVERS, solveLinks,
  makeModifier, SpatialIndex, DEF, migrate, normalise, envelope, unwrap, newId, findById,
  frameOf, compose, issues, checks, bake, curvTol, collect };
if (typeof window !== 'undefined') window.PREMISES_GEN = API;
if (typeof module !== 'undefined' && module.exports) module.exports = API;
})();
