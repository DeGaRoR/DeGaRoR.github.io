// 27_premises.js — THE PREMISES (G353 / G385): the record the world editor
// writes, and everything that reads it headless. PREMISES-CONTRACT-2026-09-13.md
// is the document; this is its code. Pure: no THREE, no DOM. It sits in the
// core because makeWorld (20_world.js) composes the record over the world in
// the same frame the physics reads - the ported bench's tools/_premises_gen.js
// (G356-G380), moved here whole at the port's first landing. The bench page
// and GATE PREMISES read it from here.
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
const PREMISES_GEN = (function () {
'use strict';

const PREMISES_V = 1;
const LAYERS = ['terrain', 'surface', 'material', 'exclude', 'roads', 'runways', 'zones', 'sites', 'links', 'objects'];
const SURFACE = { GRASS: 0, ROCK: 1, SCREE: 2, FOREST_FLOOR: 3, WATER: 4, PAVED: 5, GRAVEL: 6, SAND: 7 };
const SURFACE_NAMES = ['GRASS', 'ROCK', 'SCREE', 'FOREST_FLOOR', 'WATER', 'PAVED', 'GRAVEL', 'SAND'];
const ROAD_CLS = { gravel: SURFACE.GRAVEL, paved: SURFACE.PAVED, track: SURFACE.GRASS, path: SURFACE.GRASS };
const ZONE_KINDS = ['residential', 'commercial', 'industrial', 'harbour', 'park', 'airfield', 'forest', 'clear'];
// THE CATEGORIES (G393, the asset session): the seven words every generator's catOf answers with, the
// same seven in every catalogue entry's `cat` - what the palette groups by and a zone draws from
const CATEGORIES = ['residential', 'shed', 'commercial', 'industrial', 'official', 'landmark', 'sports'];
// THE THEME (v9, contract v1.10, the user: "take these new categories, under the global Alaska theme -
// the only one for a long time, but let's have a data model like it"). The record carries ONE word
// (rec.theme); the theme says what a sown plot of each zone kind draws from - the categories, and how
// often the house generator's own sampler (a random house) stands instead of a named preset - and which
// generators' entries a plot may stand (the house frame; the rest of the catalogue is for SITES, placed
// by hand). A zone may override its categories (zone.rules.cats). A second theme is a table, not a
// rewrite: the same seven categories, other draws.
const THEMES = {
  alaska: { name: 'Alaska', blurb: 'the panhandle: wooden houses and their sheds, canneries and net lofts on the water, a mine and its tram, totems, a ball park',
    categories: CATEGORIES,
    // each category's PLACEMENT LAW (THEME-ALASKA-RURAL-2026-09-14.md): zoned = the composer sows it on the
    // plots of a zone; hand = the editor stands it as a site (the palette lists every category)
    laws: { residential: 'zoned', shed: 'zoned', commercial: 'zoned', industrial: 'zoned', official: 'hand', landmark: 'hand', sports: 'hand' },
    plots: { residential: { cats: ['residential'], sampler: 0.7 }, commercial: { cats: ['commercial'], sampler: 0 },
             industrial: { cats: ['industrial'], sampler: 0 }, harbour: { cats: ['industrial', 'residential'], sampler: 0.5 },
             park: { tag: 'park' }, airfield: { cats: ['commercial'], sampler: 0 } },
    plotGens: ['HOUSE_GEN'] },
};
const THEME_DEF = 'alaska';
const themeOf = rec => THEMES[rec && rec.theme] || THEMES[THEME_DEF];
// the plot rules a zone starts from (the village's VDEF numbers)
const ZONE_RULES = { plotMin: 20, plotMax: 34, plotDepth: 30, riparian: 16, gapOdds: 0.18, sides: 'both' };
// what a KIND changes before the zone's own rules: a park plot is the village's park (36 x 40) with
// a gap after it, so two lawns' falloffs (6 m each) never meet; every other kind takes ZONE_RULES
const KIND_RULES = { park: { plotMin: 36, plotMax: 44, plotDepth: 40, gap: 16, bankMax: 10, setback: 12 },
  // a HARBOUR sows only the plots whose ground reaches the water: the village's water house on each
  // (its piles in the water, the pier growing off the landing, the boat); a harbour zone whose road
  // never nears the water sows nothing and says so
  harbour: { waterOnly: true, plotMin: 18, plotMax: 30, plotDepth: 34 } };   // a lawn is refused past a 10 m bank; the plot 12 m back from the road so the bank never re-grades the road
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
function polyCentroid(poly) { let x = 0, z = 0; for (const q of poly) { x += q[0]; z += q[1]; } return [x / Math.max(1, poly.length), z / Math.max(1, poly.length)]; }
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
// THE BANK LAW (v6): a level's falloff (its margin) so the bank never passes
// 3:1. A smoothstep's steepest is 1.5 x drop / falloff, and the drop is
// measured WHERE THE BANK RUNS - along the boundary offset outward by the
// margin itself (on a 40 % flank the ground keeps falling across the feather),
// so it is iterated: f = max(least, drop(f) / 1.8), three times.
// ---------------------------------------------------------------------------
function polyDrop(poly, T, level, off) {
  let drop = 0;
  const n = poly.length;
  for (let i = 0; i < n; i++) {
    const a = poly[i], b = poly[(i + 1) % n], L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (L < 1e-6) continue;
    let nx = (b[1] - a[1]) / L, nz = -(b[0] - a[0]) / L;   // a normal; flipped outward below
    const mx = (a[0] + b[0]) / 2, mz = (a[1] + b[1]) / 2;
    if (inPoly(poly, mx + nx * 0.5, mz + nz * 0.5)) { nx = -nx; nz = -nz; }
    const k = Math.max(1, Math.ceil(L / 3));
    for (let j = 0; j <= k; j++) { const u = j / k, x = a[0] + (b[0] - a[0]) * u + nx * off, z = a[1] + (b[1] - a[1]) * u + nz * off; drop = Math.max(drop, Math.abs(T(x, z) - level)); }
  }
  return drop;
}
function bankFalloff(poly, T, level, least) {
  let f = Math.max(0.5, +least || 6);
  for (let it = 0; it < 3; it++) f = Math.max(+least || 6, polyDrop(poly, T, level, f) / 1.8);
  return +f.toFixed(2);
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
    else {
      // a SLOPE polygon (v8): `level` at the polygon's centroid, `slope` (a fraction) rising toward `hdg`
      // (degrees, 0 = +z, 90 = +x); the old `plane` [a, b, c] form still reads
      let pl;
      if (m.slope !== undefined && m.slope !== null && m.level !== undefined) {
        const c = polyCentroid(poly), hd = (+m.hdg || 0) * Math.PI / 180, a = (+m.slope || 0) * Math.sin(hd), b = (+m.slope || 0) * Math.cos(hd);
        pl = [a, b, (+m.level || 0) - a * c[0] - b * c[1]];
      } else pl = m.plane || [0, 0, 0];
      target = (x, z) => y0 + pl[0] * x + pl[1] * z + (pl[2] || 0);
    }
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
    // THE SEGMENTS ARE INDEXED (LOADING S2, G407). This apply ran for every
    // terrain vertex, ground texel and tree-walk point inside the road's
    // bbox and scanned the WHOLE polyline each time: 6.3 s of the island's
    // boot in this one function (measured, tools/boot_perf.js). A segment can
    // only move a point within `reach` = hw + fall of itself (weight is 0
    // past it), so each segment is filed under every cell its bbox grown by
    // `reach` touches, and a query reads its own cell's list. Byte-identical
    // to the scan: a segment within reach of the point is always in the
    // list, one beyond it weighs nothing whether it is scanned or not, and
    // the list keeps the polyline's order so ties resolve to the same index.
    const reach = hw + fall, CS = Math.max(64, 2 * reach), cells = new Map();
    const ck = (i, j) => i + ',' + j;
    for (let i = 0; i + 1 < pts.length; i++) {
      const a = pts[i], b = pts[i + 1];
      const i0 = Math.floor((Math.min(a[0], b[0]) - reach) / CS), i1 = Math.floor((Math.max(a[0], b[0]) + reach) / CS);
      const j0 = Math.floor((Math.min(a[1], b[1]) - reach) / CS), j1 = Math.floor((Math.max(a[1], b[1]) + reach) / CS);
      for (let ci = i0; ci <= i1; ci++) for (let cj = j0; cj <= j1; cj++) {
        const k = ck(ci, cj); let l = cells.get(k); if (!l) { l = []; cells.set(k, l); } l.push(i);
      }
    }
    return { id: m.id, kind: 'grade', bbox, apply: (x, z, h) => {
      if (x < bbox.x0 || x > bbox.x1 || z < bbox.z0 || z > bbox.z1 || pts.length < 2) return h;
      const list = cells.get(ck(Math.floor(x / CS), Math.floor(z / CS)));
      if (!list) return h;
      let best = Infinity, ty = 0;
      for (let n = 0; n < list.length; n++) {
        const i = list[n], a = pts[i], b = pts[i + 1];
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
  return { v: PREMISES_V, id: 'premises', name: '', seed: 1, theme: THEME_DEF,
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
  if (!THEMES[r.theme]) r.theme = THEME_DEF;
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
  const V = Object.assign({}, ZONE_RULES, KIND_RULES[zone.kind] || {}, zone.rules || {});
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
          const off = rd.w / 2 + 1.0 + (V.setback || 0);   // a kind may set its plots back from the road (a park's lawn and its bank stay off the shoulder)
          const f0 = [a.p[0] + an[0] * off, a.p[1] + an[1] * off];
          const f1 = [b.p[0] + bn[0] * off, b.p[1] + bn[1] * off];
          // the water side is where the ground goes under within the plot's depth
          const sd0 = shoreDepth(ctx.T, ctx.waterY, f0, an), sd1 = shoreDepth(ctx.T, ctx.waterY, f1, bn);
          const side = (sd0 < V.plotDepth + 10 || sd1 < V.plotDepth + 10) && sd0 < 80 && sd1 < 80 ? 'water' : 'land';
          if (V.waterOnly && side !== 'water') continue;
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
        t += w + (V.gap || 0) + (rnd() < 0.5 ? 0 : 2 + rnd() * 4);
      }
    }
  }
  return plots;
}

// THE PICKERS (contract §4): a plot's building by the zone's kind, from the catalogue BY TAG -
// 'sampler' is the house generator's own draw (what a residential plot gets, and what any kind
// gets when no entry carries its tag: the generators tag their entries, the editor names none)
const PICK_TAGS = { residential: null, commercial: 'commercial', industrial: 'industrial', harbour: 'harbour', park: 'park' };
// (v9) by the THEME: the zone kind's categories (the zone's own when it names some), among the entries
// the plot builder stands; the theme's sampler share draws the random house instead; a kind the theme
// routes by TAG (the park) keeps the tag route
function pickFor(plot, cat, rnd, theme, zone) {
  const TH = theme || THEMES[THEME_DEF];
  const rule = (TH.plots || {})[plot.kind] || null;
  const own = zone && zone.rules && Array.isArray(zone.rules.cats) && zone.rules.cats.length ? zone.rules.cats : null;
  const cats = own || (rule && rule.cats) || null;
  if (!cat) return 'sampler';
  let list = [];
  if (cats && cat.entries) cat.entries.forEach(e => { if (e.kind === 'building' && e.cat && cats.indexOf(e.cat) >= 0 && (!TH.plotGens || TH.plotGens.indexOf(e.gen) >= 0)) list.push(e); });
  // no entry of those categories (a catalogue without them, a kind the theme routes by tag): the tag route
  if (!list.length) { const tag = rule && rule.tag !== undefined ? rule.tag : PICK_TAGS[plot.kind]; if (tag && cat.byTag) list = cat.byTag(tag).filter(e => e.kind === 'building' || e.kind === 'park'); }
  if (!list.length) return 'sampler';
  const samp = own ? 0 : +((rule && rule.sampler) || 0);
  if (samp > 0 && rnd() < samp) return 'sampler';
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
// THE LOOK (v9, contract v1.10, the user: "allow for transparent runways, yet the marking can show, only
// it would not feature a ground texture; give a couple of possible materials"): what the strip's ground
// is DRAWN as, apart from the surface CLASS the wheels feel (grass / gravel / paved / sand, the physics
// the registry already has). 'none' paints the markings on the bare composed ground - a surface or
// material polygon under it is what shows; a set names a PBR set of the site's or the lot's (read by the
// renderer at call time). Each look proposes a class; the record's surface may still say otherwise.
// THE PAVEMENT (contract v1.16, 2026-09-22): a look is a pavement CLASS (src/viewer/pavement.js's
// six: concrete / asphalt / gravel / dirt / sand / grass) + a recipe PRESET; `set` is what the old
// renderer tiled and stays for a page without the pavement module. `none` stands no pavement: the
// marks alone on the ground under. A ROAD's look derives from its class when null (ROAD_LOOK).
const RUNWAY_LOOKS = {
  grass:    { name: 'grass strip',    surface: SURFACE.GRASS,  set: null,      cls: 'grass',    preset: null },
  none:     { name: 'markings only',  surface: null,           set: null,      cls: null,       preset: null },
  asphalt:  { name: 'asphalt',        surface: SURFACE.PAVED,  set: 'asphalt', cls: 'asphalt',  preset: null },
  concrete: { name: 'concrete',       surface: SURFACE.PAVED,  set: 'brushed', cls: 'concrete', preset: 'fresh' },
  worn:     { name: 'old concrete',   surface: SURFACE.PAVED,  set: 'cracked', cls: 'concrete', preset: 'worn' },
  gravel:   { name: 'gravel',         surface: SURFACE.GRAVEL, set: 'pebble',  cls: 'gravel',   preset: null },
  dirt:     { name: 'dirt',           surface: SURFACE.GRAVEL, set: 'dirt',    cls: 'dirt',     preset: null },   // no DIRT in the SURFACE enum: gravel's friction
  sand:     { name: 'sand',           surface: SURFACE.SAND,   set: 'dry',     cls: 'sand',     preset: null },
};
const ROAD_LOOK = { gravel: 'gravel', paved: 'asphalt', track: 'grass', path: 'grass' };
// THE BAND a pavement class draws beside itself when the entry says nothing (metres; a road's is
// capped at 1.2) - the same numbers as src/viewer/pavement.js's CLASS_DEF.band, which GATE PAVEMENT
// holds equal: the core needs them for coverAt (v1.17) without reaching the viewer
const PAVE_BAND = { concrete: 4, asphalt: 1.5, gravel: 2.5, dirt: 1.5, sand: 1, grass: 1.5 };
// WHAT A `pav` MAY SAY (v1.16's per-entry knobs, mirrored from src/viewer/pavement.js's ENTRY_KNOBS,
// which GATE PAVEMENT holds equal): the record is validated against these so a misspelt key is an
// ISSUE and not a silent no-op - `pav: { mark: 'none' }` used to be read, ignored and never reported
const PAV_KEYS = ['paintAge', 'crackK', 'rubberK', 'laneW', 'wet', 'mossK', 'patchK', 'marks'];
// THE PARKING STANDS (v1.21, 2026-09-23, the user: "you may also further design a parking area for
// planes, with clear ground markings"): a material polygon may carry `stands` - a row of aircraft
// stands painted on it, each a lead-in line with a nose-stop bar across its end, drawn in the
// polygon's own frame (PAVEMENT.standMarks). Validated like `pav`, and for the same reason: a
// misspelt key here would be read, ignored and never reported.
const STAND_KEYS = ['n', 'pitch', 'lead', 'bar', 'u0', 'vOff'];
const PAV_MARKS = ['auto', 'none', 'edges', 'centre'];
const PAVE_FADE = 6;      // the fade past the band (PAVEMENT.RECIPE.fadeW's default): where the ground is the world's again
function paveBand(entry, cls, isRoad) {
  const b = entry && entry.band !== undefined && entry.band !== null ? +entry.band : (isRoad ? Math.min(PAVE_BAND[cls] || 2, 1.2) : (PAVE_BAND[cls] || 2));
  return Math.max(0, b);
}
// THE GRASS OF A ZONE (contract v1.17, the user: "land plots should override the default biome
// settings, and come with their own grass definition ... small and dense"): what the cover ring
// plants INSIDE a plot of this kind - a lawn (short, dense), the meadow (the biome's own), or none
// (a works' yard, a harbour's gravel). `h` is the tuft's height in metres, `density` a factor on
// the lawn row's own; a zone's `rules.grass` overrides its kind's
const ZONE_GRASS = { residential: { kind: 'lawn', h: 0.12, density: 1 }, commercial: { kind: 'lawn', h: 0.15, density: 0.8 }, park: { kind: 'lawn', h: 0.1, density: 1.2 },
  industrial: { kind: 'none' }, harbour: { kind: 'none' }, airfield: { kind: 'meadow' }, forest: { kind: 'meadow' }, clear: { kind: 'meadow' } };
function zoneGrass(zone) { return Object.assign({}, ZONE_GRASS[zone && zone.kind] || { kind: 'meadow' }, (zone && zone.rules && zone.rules.grass) || {}); }
// a road's look: its own, else its class's; the pavement's row for it (or null for 'none')
function roadLook(r) { const k = r.look && RUNWAY_LOOKS[r.look] ? r.look : (ROAD_LOOK[r.cls] || 'gravel'); return { key: k, row: RUNWAY_LOOKS[k] }; }
// THE ONE-WAY STRIP (v9, contract v1.11): `approach` names the end the landing comes over (0 or 1) when
// the air is calm - a strip with a ridge at one end lands from the other and departs toward it; null
// leaves the pilot its choice (the runway direction nearest its inbound track)
// THE CLUB HANGAR (G434, contract v1.14): `hangar` { x, z, hdg } in the premises frame stands the
// GARAGE'S OWN SHELL (genHangarBuild's exterior, the player's dims) at the field, its door facing
// hdg - the building the aeroplane rolls out of; runwaySite carries it into the world as the
// site's `hangar` (25_airfield.js's shape: x, z, ry, HW, HD, EAVE, + y the composed ground)
// THE GLIDESLOPE LIGHTS (G434): `papi[k]` is true (a PAPI, four units), 'vasi' (a two-bar VASI) or
// false (none) at end k; the approach that lands over end k reads it
// A WATER STRIP (G434): surface WATER is a SEA LANE - no grade, no strip, no exclude; the record
// registers a `kind: 'water'` aerodrome (the analytic SEA's shape) the seaplanes spawn on
// THE CIRCUIT PROTOCOL (G422.4, contract v1.15): `circuit` { hand: 'left' | 'right', height: m over
// the strip, join: 'downwind' | 'straight' } declares how the strip is flown — the pilot's side, the
// least pattern height, whether a straight-in is allowed (43_pilot.js planArrival); null leaves the
// pilot to the terrain and the wind. The editor's row is owed.
const RUNWAY_DEF = { name: 'strip', len: 480, wid: 24, surface: SURFACE.GRASS, look: 'grass', slope: 0, crossfall: 0, disp: [0, 0], papi: [true, true], falloff: null, site: null, pattern: null, stand: null, taxiOut: null, profile: null, approach: null, hangar: null, circuit: null, band: null, pav: null };
const HANGAR_DIMS = { HW: 15, HD: 12.5, EAVE: 7.0 };   // hangar.js's own defaults; the player's sliders override them at the roll-out (playerShedDims)
function runwayIsWater(r) { return +r.surface === SURFACE.WATER; }

// THE PROFILE (v8, contract v1.8): a strip's centreline height along its length as CONTROL POINTS
// [[t, dy], ...] - t 0..1 from end 0, dy relative to the strip's elevation (the ground at its centre
// before it is graded) - with a MONOTONE cubic between them (Fritsch-Carlson: the ground never
// overshoots a point, a hump is a hump and a dip a dip). No profile = the old linear slope. The ends
// are always control points (the thresholds); the editor keeps them.
function runwayProfile(r) {
  let P = Array.isArray(r.profile) && r.profile.length >= 2 ? r.profile.map(q => [+q[0], +q[1]]).filter(q => isFinite(q[0]) && isFinite(q[1])) : null;
  if (!P || P.length < 2) { const rise = (+r.slope || 0) * r.len / 2; P = [[0, -rise], [1, rise]]; }
  P.sort((a, b) => a[0] - b[0]);
  if (P[0][0] > 0) P.unshift([0, P[0][1]]); if (P[P.length - 1][0] < 1) P.push([1, P[P.length - 1][1]]);
  P[0][0] = 0; P[P.length - 1][0] = 1;
  const n = P.length, x = P.map(q => q[0] * r.len), y = P.map(q => q[1]);
  const h = [], d = [];
  for (let i = 0; i + 1 < n; i++) { h.push(Math.max(1e-6, x[i + 1] - x[i])); d.push((y[i + 1] - y[i]) / h[i]); }
  const m = new Array(n).fill(0);
  if (n === 2) { m[0] = m[1] = d[0]; }
  else {
    m[0] = d[0]; m[n - 1] = d[n - 2];
    for (let i = 1; i + 1 < n; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
    for (let i = 0; i + 1 < n; i++) { if (d[i] === 0) { m[i] = m[i + 1] = 0; continue; } const a = m[i] / d[i], b = m[i + 1] / d[i], q = a * a + b * b; if (q > 9) { const tau = 3 / Math.sqrt(q); m[i] = tau * a * d[i]; m[i + 1] = tau * b * d[i]; } }
  }
  const at = sAlong => {
    const sx = Math.max(0, Math.min(r.len, sAlong));
    let i = 0; while (i + 2 < n && sx > x[i + 1]) i++;
    const t = (sx - x[i]) / h[i], t2 = t * t, t3 = t2 * t;
    return (2 * t3 - 3 * t2 + 1) * y[i] + (t3 - 2 * t2 + t) * h[i] * m[i] + (-2 * t3 + 3 * t2) * y[i + 1] + (t3 - t2) * h[i] * m[i + 1];
  };
  const slopeAt = sAlong => (at(Math.min(r.len, sAlong + 0.5)) - at(Math.max(0, sAlong - 0.5))) / Math.min(1, r.len);
  return { points: P, at, slopeAt, n };
}
// THE PILOT'S LIMITS on a profile (what the MSFS editor never asks): the slope anywhere under 5 %, the
// touchdown zone (a fifth of the run from each threshold) under 2.5 %, and no crest sharper than a 1.5 %
// change of slope over 30 m - a flare must not meet a hump it cannot see over
function profileIssues(r) {
  const out = [], pr = runwayProfile(r), L = r.len;
  let worst = 0, tdz = 0, crest = 0;
  for (let a = 0; a <= L; a += 3) {
    const sl = Math.abs(pr.slopeAt(a)); worst = Math.max(worst, sl);
    if (a < L / 5 || a > L - L / 5) tdz = Math.max(tdz, sl);
    if (a + 30 <= L) crest = Math.max(crest, Math.abs(pr.slopeAt(a + 30) - pr.slopeAt(a)));
  }
  if (worst > 0.05) out.push('runway ' + r.id + ': the profile is ' + (worst * 100).toFixed(1) + ' % somewhere, over 5 %');
  if (tdz > 0.025) out.push('runway ' + r.id + ': the touchdown zone slopes ' + (tdz * 100).toFixed(1) + ' %, over 2.5');
  if (crest > 0.015) out.push('runway ' + r.id + ': a crest changes the slope ' + (crest * 100).toFixed(1) + ' % over 30 m, over 1.5');
  return out;
}
// THE SHOULDER (v9): the strip's radius of terraforming - how far past the box (either side and past the
// ends) the grade's falloff runs before the ground is the terrain's again; authored (falloff) or a
// length law: 40 m + 6 % of the length, at most 120 m
function runwayShoulder(r) { return r.falloff !== null && r.falloff !== undefined ? +r.falloff : Math.min(120, 40 + (+r.len || 0) * 0.06); }
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
// THE STAND AND ITS WAY OUT, in the world (v6): the record's `stand` {x, z, hdg|null} and `taxiOut`
// [[x, z], ...] are in the premises frame; the site the pattern reads gets them in the world, the
// stand's heading DERIVED toward its first taxi point when the record gives none (an aeroplane is
// parked pointing the way it will leave - the core's own ruling at HOME), merged over the record's
// `site` (an authored pattern rides there untouched)
function runwaySite(r, F) {
  const W = q => F.toWorld(q[0], q[1]);
  const base = Object.assign({}, r.site || {});
  // the club hangar (G434): the garage's shell in the world, its door along hdg (hangar.js draws the
  // door at local -x, so rotation.y = pi - hdg puts it there: 25_airfield.js's own -pi/2 for a door at -z)
  if (r.hangar && isFinite(+r.hangar.x) && isFinite(+r.hangar.z)) {
    const hw = W([+r.hangar.x, +r.hangar.z]), hh = (+r.hangar.hdg || 0) - F.yaw;
    base.hangar = Object.assign({ x: +hw[0].toFixed(3), z: +hw[1].toFixed(3), hdg: +hh.toFixed(4), ry: +(Math.PI - hh).toFixed(4) }, HANGAR_DIMS);
  }
  if (!r.stand || !r.taxiOut || !r.taxiOut.length) return Object.keys(base).length ? base : null;
  const st = W([r.stand.x, r.stand.z]), tx = r.taxiOut.map(W);
  let hdg;
  if (r.stand.hdg !== null && r.stand.hdg !== undefined) hdg = +r.stand.hdg - F.yaw;
  else hdg = Math.atan2(tx[0][1] - st[1], tx[0][0] - st[0]);
  return Object.assign(base, { stand: { x: +st[0].toFixed(3), z: +st[1].toFixed(3), hdg: +hdg.toFixed(4) }, taxiOut: tx.map(q => [+q[0].toFixed(3), +q[1].toFixed(3)]) });
}
function runwayAerodrome(r, F, elev, flats, hAt, gradedRoads) {
  const E = runwayEnds(r);
  const c = F.toWorld(r.c[0], r.c[1]);
  const dw = [E.d[0] * Math.cos(F.yaw) + E.d[1] * Math.sin(F.yaw), -E.d[0] * Math.sin(F.yaw) + E.d[1] * Math.cos(F.yaw)];
  const hdg = Math.atan2(dw[1], dw[0]);
  const hl = r.len / 2, aimIn = (r.len - 10) / 4;
  // the pilot lands along -hdg over thr1 (5 m inside end1): the target sits a quarter in from that bar
  const tdz = [c[0] + dw[0] * (hl - 5 - aimIn), c[1] + dw[1] * (hl - 5 - aimIn)];
  const spawn = [c[0] - dw[0] * (hl - 35), c[1] - dw[1] * (hl - 35)];
  // the strip's own flat, in the world: its graded box (the width and the shoulder) - siteOnFlat asks it
  const shoulder = runwayShoulder(r);
  const flatBox = runwayBox(r, shoulder).map(q => F.toWorld(q[0], q[1]));
  // ... and every authored flatten (an apron cut beside the strip is flat ground too)
  const flatPolys = (flats || []).map(poly => poly.map(q => F.toWorld(q[0], q[1])));
  // ... and every GRADED ROAD (G434): a road's bed is flat across and smoothed along by construction -
  // a taxiway traced as a road is ground a pattern may walk on (the validator asks flat())
  const roadsL = (gradedRoads || []).filter(rd => rd.pts && rd.pts.length >= 2).map(rd => ({ pts: rd.pts, w: +rd.w || 3.6 }));
  const onRoad = (x, z) => { if (!roadsL.length) return false; const L = F.toLocal(x, z); return roadsL.some(rd => roadDist(rd, L[0], L[1]) <= rd.w / 2 + 1); };
  const flat = (x, z) => inPoly(flatBox, x, z) || flatPolys.some(pl => inPoly(pl, x, z)) || onRoad(x, z);
  // the aeroplane is placed at the stand when the strip has one
  const S = runwaySite(r, F);
  const spawnAt = S && S.stand ? [S.stand.x, S.stand.z] : spawn;
  // THE GROUND UNDER THE STAND (v9): a profiled strip's stand is not at the strip's elevation - the placer reads it
  const groundAt = (x, z) => { if (!hAt) return elev; const L = F.toLocal(x, z); return +hAt(L[0], L[1]).toFixed(2); };
  if (S && S.stand) S.stand.elev = groundAt(S.stand.x, S.stand.z);
  const spawnElev = groundAt(spawnAt[0], spawnAt[1]);
  // a SEA LANE (G434): the analytic SEA's shape - kind 'water', no site, flat everywhere (the water is)
  if (runwayIsWater(r)) return { id: r.id, name: r.name || 'sea lane', kind: 'water', x: c[0], z: c[1], hdg, len: r.len, wid: r.wid, flat: () => true,
           surface: SURFACE.WATER, look: 'none', elev, tdz, spawn, spawnElev: elev, flyIn: false, premises: true, water: true,
           landHdg: r.approach === 0 ? hdg : r.approach === 1 ? hdg + Math.PI : null, slope: 0, disp: [0, 0], papi: [false, false], circuit: r.circuit || null };
  return { id: r.id, name: r.name || 'strip', kind: 'strip', x: c[0], z: c[1], hdg, len: r.len, wid: r.wid, flat,
           surface: r.surface === undefined ? SURFACE.GRASS : +r.surface, look: RUNWAY_LOOKS[r.look] ? r.look : 'grass', elev, tdz, spawn: spawnAt, spawnElev, flyIn: false, premises: true,
           band: r.band === undefined ? null : r.band, pav: r.pav || null,   // the pavement's (v1.16): the renderer resolves them with the premises' recipe
           // the direction of travel when landing over the named end (end 0 -> end 1 is +hdg); the pilot reads it in calm air
           landHdg: r.approach === 0 ? hdg : r.approach === 1 ? hdg + Math.PI : null,
           slope: +r.slope || 0, disp: r.disp || [0, 0], papi: r.papi || [true, true], circuit: r.circuit || null };
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
// a slot's place in a plan: the entry's slots map names a path ('plan.house'); the plan publishes it
function slotAt(plan, path) {
  if (!path) return null;
  let cur = { plan };
  for (const seg of String(path).split('.')) { if (cur === null || cur === undefined) return null; cur = cur[seg]; }
  return cur && typeof cur === 'object' && isFinite(cur.x) && isFinite(cur.z) ? cur : null;
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
      // THE MILL (the village's placeSite at G367): the receiving house astride the road (recvZ = the
      // item's z), the top house on the pad the shelf was cut to from the same plan - the entry's
      // ground.shelf publishes zLevel; without a shelf, the foot's high corner
      if (it.bottomOnRoad) { P.recvZ = it.z || 0; P.bottomL = 16; }
      const sh = entry.ground && typeof entry.ground.shelf === 'function' ? entry.ground.shelf(P) : null;
      let hiC = -1e9;
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) hiC = Math.max(hiC, ground(sx * size.L / 2, sz * size.w / 2));
      P.floorY = (sh && isFinite(sh.zLevel) ? ground(0, sh.zLevel) : hiC) + 0.5;
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
    const P = entry.params ? entry.params(Object.assign({ recvZ: it.z || 0 }, it.P || {})) : Object.assign({}, entry.P || {}, it.bottomOnRoad ? { recvZ: it.z || 0 } : {}, it.P || {});
    const id = site.id + '/' + (it.id || ('i' + k)) + ':ground';
    if (entry.ground.need === 'flatten' && typeof entry.ground.shelf === 'function') {
      const M = entry.ground.shelf(P);
      const ahead = toWorld(0, M.zLevel || 0), level = T(ahead[0], ahead[1]);
      // the entry's margins are the least; each bank widens with its own drop so neither passes 3:1 (v6)
      // the entry's margins are the least; the bank law widens both where the ground asks (the pad's
      // rect in the world, the bank measured where it runs)
      const rectW = [[M.rect[0], M.rect[1]], [M.rect[2], M.rect[1]], [M.rect[2], M.rect[3]], [M.rect[0], M.rect[3]]].map(q => toWorld(q[0], q[1]));
      const fF = bankFalloff(rectW, T, level, M.marginF), fB = bankFalloff(rectW, T, level, M.marginB);
      out.push({ id, kind: 'shelf', c, yaw, rect: { x0: M.rect[0], z0: M.rect[1], x1: M.rect[2], z1: M.rect[3] }, level, marginF: fF, marginB: fB, drop: +polyDrop(rectW, T, level, 0).toFixed(2) });
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
    // THE BANK (v6): the entry's falloff is the least margin; the bank widens with the drop between
    // the level and the ground at the foot's corners so it never passes 3:1 (a smoothstep's steepest
    // is 1.5 x drop / margin) - a station on a 35 % flank had a 14 m wall over its 6 m margin
    const rectW = [[fb.x0, fb.z0], [fb.x1, fb.z0], [fb.x1, fb.z1], [fb.x0, fb.z1]].map(q => toWorld(q[0], q[1]));
    const f = bankFalloff(rectW, T, level, entry.ground.falloff || 6);
    out.push({ id, kind: 'shelf', c, yaw, rect: { x0: fb.x0, z0: fb.z0, x1: fb.x1, z1: fb.z1 }, level, marginF: f, marginB: f, drop: +polyDrop(rectW, T, level, 0).toFixed(2) });
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
    // the first pass needs a finite lineDeg on both (an undefined one overrides the generator's default
    // in build's merge and every hook comes back NaN): the band's middle seeds it, tramLine converges
    const seed0 = (this.band.minDeg + this.band.maxDeg) / 2;
    if (!isFinite(base.P.lineDeg)) base.P.lineDeg = seed0;
    if (!isFinite(top.P.lineDeg)) top.P.lineDeg = seed0;
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
  // `traffic` (contract v1.13, G432): vehicles per km the renderer runs up and down the road - 0 or absent, none
  // `ribbon` false (G434): the renderer draws no ribbon over it - a taxiway under a material polygon of its own
  const roadObjs = roads.map(r => ({ id: r.id, pts: r.pts, w: +r.w || 3.6, surface: r.surface !== undefined ? +r.surface : (ROAD_CLS[r.cls] !== undefined ? ROAD_CLS[r.cls] : SURFACE.GRAVEL), traffic: Math.max(0, +r.traffic || 0), ribbon: r.ribbon !== false,
    look: roadLook(r).key, band: r.band === undefined ? null : r.band, pav: r.pav || null }));   // the pavement's (v1.16)
  const nAuth = mods.length;
  // THE RUNWAYS (stage 2, BEFORE the roads - v1.2: a taxi road near a strip must sit on the strip's graded ground, so its nodes are read after the runway grades): a DERIVED grade along the centreline at elev + slope * s
  // (elev = T1 at the centre), a DERIVED surface strip of the record's class,
  // a DERIVED tree exclude 30 m round the box, and the aerodrome record
  const runways = rec.layers.runways.filter(r => r.c && r.len > 0 && r.wid > 0).map(r => Object.assign({}, RUNWAY_DEF, r));
  const aerodromes = [];
  for (const r of runways) {
    const E = runwayEnds(r);
    // a SEA LANE (G434): the water's own level, nothing graded, nothing painted, nothing excluded
    if (runwayIsWater(r)) {
      const cw = F.toWorld(r.c[0], r.c[1]);
      const wl = world.waterH ? world.waterH(cw[0], cw[1]) : T1(r.c[0], r.c[1]);
      aerodromes.push(runwayAerodrome(r, F, isFinite(wl) ? wl : 0, [], null));
      r.site = null;
      continue;
    }
    const elev = T1(r.c[0], r.c[1]);
    const fall = runwayShoulder(r);
    // the centreline on its PROFILE, sampled every 6 m into the grade (the old linear slope is a two-point profile)
    const pr = runwayProfile(r), gpts = [];
    const nS = Math.max(1, Math.ceil(r.len / 6));
    for (let k = 0; k <= nS; k++) { const a = r.len * k / nS; gpts.push([E.end0[0] + E.d[0] * a, E.end0[1] + E.d[1] * a, elev + pr.at(a)]); }
    const M = makeModifier({ id: r.id + ':grade', kind: 'grade', pts: gpts, width: r.wid, falloff: fall, abs: true }, F.y0);
    if (M) mods.push(M);
    roadObjs.push({ id: r.id, pts: [E.end0, E.end1], w: r.wid, surface: r.surface === undefined ? SURFACE.GRASS : +r.surface, runway: true });
    aerodromes.push(runwayAerodrome(r, F, elev, rec.layers.terrain.filter(m => m.kind === 'flatten' && m.poly && m.poly.length >= 3).map(m => m.poly), T1, roads.filter(q => q.graded !== false)));   // T1 sees the strip's own grade (pushed above)
    r.site = runwaySite(r, F);   // the composed runway's site: the stand and the way out in the world, the authored pattern kept
    if (r.site && r.site.stand) { const L = F.toLocal(r.site.stand.x, r.site.stand.z); r.site.stand.elev = +T1(L[0], L[1]).toFixed(2); }   // the ground under the stand (v9): the placer reads it
    if (r.site && r.site.hangar) { const L = F.toLocal(r.site.hangar.x, r.site.hangar.z); r.site.hangar.y = +T1(L[0], L[1]).toFixed(2); }   // the ground under the club hangar (G434): the shed stands on it
  }
  // THE ROADS (stage 3): a road's nodes sit on the ground AFTER the runways graded it
  const T1r = (lx, lz) => { const w = F.toWorld(lx, lz); let h = world.terrainH(w[0], w[1]); for (const M of mods) h = M.apply(lx, lz, h); return h; };
  for (const r of roads) {
    if (r.graded === false) continue;
    // THE ROAD FOLLOWS THE GROUND (v6): its grade is read every 6 m along the traced line, not only at
    // the traced points - between two points 45 m apart a flatten's bank rose 14 m and a straight
    // grade cut a 3.5:1 step through it; smoothed four times over three samples so it stays a road
    const dense = [];
    for (let i = 0; i + 1 < r.pts.length; i++) { const a = r.pts[i], b = r.pts[i + 1], L = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.ceil(L / 6)); for (let k = 0; k < n; k++) { const u = k / n; dense.push([a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u]); } }
    dense.push(r.pts[r.pts.length - 1]);
    let hs = dense.map(p => T1r(p[0], p[1]));
    for (let pass = 0; pass < 4; pass++) hs = hs.map((h, i) => (i === 0 || i === hs.length - 1) ? h : (hs[i - 1] + 2 * h + hs[i + 1]) / 4);
    // THE GRADE LIMIT (G434, contract v1.14): `grade` is the steepest the road may run - the humps
    // are CUT to it and the dips FILLED (a lower then an upper envelope of that slope, both ways),
    // the ends held where they meet the ground; a taxiway across a 4 m mound had climbed 8 % and
    // dropped 12 % onto the runway, following the DEM the way a track does and a taxiway never would
    if (+r.grade > 0) {
      const g = +r.grade, ds = i => Math.hypot(dense[i][0] - dense[i - 1][0], dense[i][1] - dense[i - 1][1]);
      const h0 = hs[0], h1 = hs[hs.length - 1];
      for (let i = 1; i < hs.length; i++) hs[i] = Math.min(hs[i], hs[i - 1] + g * ds(i));
      for (let i = hs.length - 2; i >= 0; i--) hs[i] = Math.min(hs[i], hs[i + 1] + g * ds(i + 1));
      for (let i = 1; i < hs.length; i++) hs[i] = Math.max(hs[i], hs[i - 1] - g * ds(i));
      for (let i = hs.length - 2; i >= 0; i--) hs[i] = Math.max(hs[i], hs[i + 1] - g * ds(i + 1));
      hs[0] = h0; hs[hs.length - 1] = h1;
    }
    // a level approach at both ends: a road that starts on another road (a spur off the shore road) must
    // not lift the first road's edge on its first metres - the height is held for 7 m from each end
    { let acc = 0; for (let i = 1; i < dense.length; i++) { acc += Math.hypot(dense[i][0] - dense[i - 1][0], dense[i][1] - dense[i - 1][1]); if (acc < 7) hs[i] = hs[0]; else break; } acc = 0; for (let i = dense.length - 2; i >= 0; i--) { acc += Math.hypot(dense[i][0] - dense[i + 1][0], dense[i][1] - dense[i + 1][1]); if (acc < 7) hs[i] = hs[dense.length - 1]; else break; } }
    const M = makeModifier({ id: r.id + ':grade', kind: 'grade', pts: dense.map((p, i) => [p[0], p[1], hs[i]]), width: +r.w || 3.6, falloff: +r.falloff || 6, abs: true }, F.y0);
    if (M) mods.push(M);
  }
  // THE GROUND UNDER THE SITES (stage 5 -> T2): every item's shelf, from its entry, cut before anything is placed
  const catS = o.catalogue || collect(o.globals || (typeof window !== 'undefined' ? window : {}));
  const T1s = (lx, lz) => { const w = F.toWorld(lx, lz); let h = world.terrainH(w[0], w[1]); for (const M of mods) h = M.apply(lx, lz, h); return h; };
  const shelves = [];
  for (const st of rec.layers.sites) for (const sh of siteShelves(st, catS, T1s)) { const M = makeModifier(sh, F.y0); if (M) { mods.push(M); shelves.push(sh); } }
  const index = SpatialIndex(256);
  for (const M of mods) index.add(M.bbox, M);
  // the surface polygons in PRIORITY order (z, then the record's order): the last wins at a point
  const surf = rec.layers.surface.filter(s => s.poly && s.poly.length >= 3).map((s, i) => ({ poly: s.poly, bbox: polyBBox(s.poly), surface: +s.surface, z: +s.z || 0, i })).sort((a, b) => (a.z - b.z) || (a.i - b.i));
  // THE MATERIALS (v8, contract v1.9): a PBR set projected on the ground inside a polygon, its contour
  // fading over `fade` metres (half in, half out) into what lies under it, composited in priority order
  // THE PAVED POLYGONS (v1.16): a material polygon with a `look` (a pavement class) instead of a set is an
  // apron, a turnaround, a pad - the pavement module draws it, the map never sees it
  const pavePolys = rec.layers.material.filter(m => m.poly && m.poly.length >= 3 && m.look && RUNWAY_LOOKS[m.look] && RUNWAY_LOOKS[m.look].cls)
    .map(m => ({ id: m.id, poly: m.poly, bbox: polyBBox(m.poly), look: m.look, band: m.band === undefined ? null : m.band, pav: m.pav || null, yaw: +m.yaw || 0, z: +m.z || 0, stands: m.stands || null }));
  const mats = rec.layers.material.filter(m => m.poly && m.poly.length >= 3 && m.set && !m.look).map((m, i) => ({ id: m.id, poly: m.poly, bbox: polyBBox(m.poly), set: String(m.set), tile: m.tile > 0 ? +m.tile : null, fade: Math.max(0, +m.fade || 0), z: +m.z || 0, i })).sort((a, b) => (a.z - b.z) || (a.i - b.i));
  // the weight of one material at a point: 1 well inside, 0 well outside, a smoothstep across the fade band
  const matWeight = (m, lx, lz) => { const d = -sdPoly(m.poly, lx, lz); if (m.fade <= 0) return d >= 0 ? 1 : 0; const u = (d + m.fade / 2) / m.fade; return u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u); };
  const excl = rec.layers.exclude.filter(s => s.poly && s.poly.length >= 3).map(s => ({ poly: s.poly, bbox: polyBBox(s.poly), what: s.what || ['trees'] }));
  for (const r of runways) { if (runwayIsWater(r)) continue; const box = runwayBox(r, 30); excl.push({ poly: box, bbox: polyBBox(box), what: ['trees', 'settle', 'plots'], derived: true, runway: r.id }); }
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
    materials: mats, pavePolys, pavement: rec.pavement || null,
    // THE COVER'S QUERY (contract v1.17): what the cover ring may plant at a WORLD point -
    //   null                      the premises has nothing to say here (the biome's own)
    //   { kill, boost, kind, cls, look, grass }
    //     kill  0..1  1 on a pavement (a strip's box, a road's width, a paved polygon) and across its
    //                 drawn band, falling to 0 over the fade past the band (a few stragglers there)
    //     boost 0..1  the borders: a bump in the fade past a band and a soft road's edge, where the
    //                 user wants the grass ENCOURAGED
    //     kind  'lawn' inside a plot whose zone says so, 'none' (a works' yard), 'meadow' (the
    //                 biome's) or null when no plot claims the point
    //     cls   the pavement class drawn nearest (for the tuft's colour, which the viewer adds)
    //     grass the zone's grass rule when kind is a plot's (h, density)
    // One index cell per 64 m; O(1) a point. The pavement's own laws (the band, the fade) live here
    // and in pavement.js's recipe; GATE PAVEMENT holds the band table equal.
    coverAt: (x, z, pave) => coverAt(x, z, pave),
    // the material seen at a world point after the composite: { set, w } of the top one, or null
    materialAt(x, z) {
      const L = F.toLocal(x, z);
      let top = null;
      for (const m of mats) { if (!inBB({ x0: m.bbox.x0 - m.fade, z0: m.bbox.z0 - m.fade, x1: m.bbox.x1 + m.fade, z1: m.bbox.z1 + m.fade }, L[0], L[1])) continue; const w = matWeight(m, L[0], L[1]); if (w <= 0) continue; top = { set: m.set, w: top ? w + top.w * (1 - w) * (top.set === m.set ? 1 : 0) : w, id: m.id }; if (w >= 1) top.w = 1; }
      return top;
    },
    materialWeight: (m, lx, lz) => matWeight(m, lx, lz),
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
  // ---- coverAt's index (v1.17): every pavement's reach and every plot, in 64 m cells ------------
  const CIDX = SpatialIndex(64);
  const covItems = [];
  const addCov = (bbox, it) => { covItems.push(it); CIDX.add(bbox, it); };
  for (const r of runways) {
    if (runwayIsWater(r)) continue;
    const L = RUNWAY_LOOKS[r.look] || RUNWAY_LOOKS.grass, cls = L.cls || 'grass', band = paveBand(r, cls, false), reach = band + PAVE_FADE + 6;
    const E = runwayEnds(r);
    addCov(polyBBox(runwayBox(r, reach)), { kind: 'strip', cls, band, halfW: r.wid / 2, len: r.len, e0: E.end0, d: E.d, soft: cls !== 'concrete' && cls !== 'asphalt' });
  }
  for (const rd of roadObjs) {
    if (rd.runway || rd.ribbon === false) continue;
    const L = RUNWAY_LOOKS[rd.look] || RUNWAY_LOOKS.gravel, cls = L.cls || 'gravel', band = paveBand(rd, cls, true), reach = rd.w / 2 + band + PAVE_FADE + 6;
    const bb = polyBBox(rd.pts);
    addCov({ x0: bb.x0 - reach, z0: bb.z0 - reach, x1: bb.x1 + reach, z1: bb.z1 + reach }, { kind: 'road', cls, band, halfW: rd.w / 2, road: rd, soft: cls !== 'concrete' && cls !== 'asphalt' });
  }
  for (const pp of pavePolys) {
    const cls = RUNWAY_LOOKS[pp.look].cls, band = paveBand(pp, cls, true), reach = band + PAVE_FADE + 6;
    addCov({ x0: pp.bbox.x0 - reach, z0: pp.bbox.z0 - reach, x1: pp.bbox.x1 + reach, z1: pp.bbox.z1 + reach }, { kind: 'poly', cls, band, poly: pp.poly, soft: false });
  }
  const zoneOf = id => rec.layers.zones.find(z => z.id === id) || null;
  // the strip's dEdge (its box's SDF: + inside), the road's (w/2 - the distance), the polygon's
  const dEdgeOf = (it, lx, lz) => {
    if (it.kind === 'strip') { const dx = lx - it.e0[0], dz = lz - it.e0[1]; const u = dx * it.d[0] + dz * it.d[1], v = -dx * it.d[1] + dz * it.d[0];
      const du = Math.max(-u, u - it.len), dv = Math.abs(v) - it.halfW; return -(Math.hypot(Math.max(du, 0), Math.max(dv, 0)) + Math.min(Math.max(du, dv), 0)); }
    if (it.kind === 'road') return it.halfW - roadDist(it.road, lx, lz);
    return -sdPoly(it.poly, lx, lz);
  };
  // `pave` (2026-09-22): the PAVEMENT half only - the caller wants to know whether it may stand
  // something here, not which plot's lawn it is. It skips the plot walk, which is the query's cost
  // (36 polygons in a village), and the tree fill calls this on every lattice point of every chunk.
  function coverAt(x, z, pave) {
    const L = F.toLocal(x, z), lx = L[0], lz = L[1];
    const cell = CIDX.query(lx, lz);
    let kill = 0, boost = 0, cls = null, best = -Infinity;
    if (cell) for (const it of cell) {
      const d = dEdgeOf(it, lx, lz);              // + inside the pavement, - outside
      const out = -d;
      if (out > it.band + PAVE_FADE + 6) continue;
      // the pavement and its band: nothing; the fade: 1 -> 0 over PAVE_FADE; the border bump past the band
      let k = out <= it.band ? 1 : Math.max(0, 1 - (out - it.band) / PAVE_FADE);
      if (it.cls === 'grass') k *= 0.6;              // a grass pavement is the world's grass with the wear drawn on it: thinned, not bare
      const bump = out <= it.band ? 0 : (out < it.band + PAVE_FADE + 6 ? Math.sin(Math.PI * Math.min(1, (out - it.band) / (PAVE_FADE + 6))) : 0);
      // a soft road's own edge is where the grass creeps in: the bump reaches into its last metre
      const soft = it.soft && d > 0 && d < 1 ? 0.5 * (1 - d) : 0;
      if (k > kill) { kill = k; }
      boost = Math.max(boost, bump * 0.7, soft);
      if (d > best) { best = d; cls = it.cls; }
    }
    if (pave) return (kill || boost) ? { kill, boost: Math.min(1, boost * (1 - kill)), kind: null, cls, grass: null } : null;
    let kind = null, grass = null;
    // the plots: a point inside one takes its zone's grass rule
    for (const p of O.records.plots) if (p.poly && inPoly(p.poly, lx, lz)) { const g = zoneGrass(zoneOf(p.zone)); kind = g.kind; grass = g; break; }
    // a plot's lawn is mown to the road's band: no fade thins it, only the pavement and the band kill
    if (kind === 'lawn' && kill < 1) kill = 0;
    if (!kill && !boost && !kind) return null;
    return { kill, boost: Math.min(1, boost * (1 - kill)), kind, cls, grass };
  }

  // PLACEMENT (stage 5): the zones sown in array order — a later zone's plots
  // reject against the earlier ones; forest zones plant after every plot is known
  if (!o.noPlace) {
    const waterY = world.waterH ? world.waterH(F.anchor.x, F.anchor.z) : -Infinity;
    // THE WATER A ZONE SEES (G434): the level of the sea or the lake that touches it - sampled over the
    // zone's own box, not read at the anchor (an anchor on a field 4 km inland reads -Infinity there, and
    // a harbour zone on the shore sowed nothing: no plot ever "reached the water"). THE LOWEST finite
    // level found (G434.1): a coastal zone's box also holds ponds up the hill - the highest of them
    // (4.6 m at Annette) made the whole shore band "water" and the harbour sowed nothing again; the
    // sea is the lowest water there is, and a lakeside zone with no sea reads its lake
    const zoneWaterY = z => {
      if (!world.waterH || !z.poly || z.poly.length < 3) return waterY;
      const bb = polyBBox(z.poly); let best = Infinity;
      for (let i = 0; i <= 12; i++) for (let j = 0; j <= 12; j++) { const w = F.toWorld(bb.x0 - 60 + (bb.x1 - bb.x0 + 120) * i / 12, bb.z0 - 60 + (bb.z1 - bb.z0 + 120) * j / 12); const v = world.waterH(w[0], w[1]); if (isFinite(v) && v < best) best = v; }
      return isFinite(best) ? best : waterY;
    };
    const ctx = { T: O.localH, waterY, seed: rec.seed, excludes: excl.filter(e => e.what.indexOf('trees') >= 0).map(e => e.poly), plots: O.records.plots, keepOut: excl.filter(e => e.what.indexOf('plots') >= 0).map(e => e.poly) };
    // THE SITES (stage 5a): placed first; every item's foot + margin keeps the plots and the wood out
    const cat = catS;
    for (const st of rec.layers.sites) {
      const S = placeSite(st, cat, ctx);
      for (const it of S.items) {
        O.records.items.push(it);
        // an item astride a road it was not put on: its pad would re-grade the road (an authoring mistake, named)
        const rit = (st.items || []).find(q => (q.id || '') === it.item) || {};
        if (!rit.onRoad && !rit.bottomOnRoad && it.foot) for (const rd of roadObjs) if (!rd.runway && (roadInPoly(polyRoad(rd.pts, rd.w), it.foot).length || it.foot.some(q => roadDist(rd, q[0], q[1]) < rd.w / 2))) { S.issues.push('site ' + st.id + ': ' + it.item + ' stands on road ' + rd.id + ' (set it back, or put it on the road)'); break; }
      }
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
        { let n = 0; for (const p of sowPlots(z, roads, Object.assign({}, ctx, { waterY: zoneWaterY(z) }))) { p.pick = pickFor(p, cat, mulberry32(p.seed ^ 0x51ed), themeOf(rec), z); O.records.plots.push(p); n++; }
          if (!n && z.kind === 'harbour' && roads.some(rd => roadInPoly(polyRoad(rd.pts, rd.w || 3.6), z.poly).length)) O.records.issues.push('harbour ' + z.id + ': no plot of its road reaches the water'); }
    }
    // THE PARKS (stage 5c, contract v1.5): a plot whose pick is a PARK entry stands the park on the
    // plot by the entry's own stand (totemPlot's shape: (plot, T, o) -> a plan with footprint, level,
    // the slots' places); its lawn is a DERIVED flatten at the plan's level, cut here and joined to
    // the index, the park re-stood on the cut ground; the entry's fill names what stands in its
    // slots - each an item in placeSite's shape (so the renderer builds it like a site's)
    O.records.parks = [];
    {
      const globals = o.globals || (typeof window !== 'undefined' ? window : {});
      for (const p of O.records.plots) {
        const e = p.pick && p.pick !== 'sampler' ? cat.entries.get(cat.aliases[p.pick] || p.pick) : null;
        if (!e || e.kind !== 'park') continue;
        const G = globals[e.gen], stand = G && e.stand ? G[e.stand] : null;
        if (typeof stand !== 'function') { O.records.issues.push('plot ' + p.id + ': ' + p.pick + ' has no stand ' + (e.stand || '?') + ' here'); continue; }
        const seed = seedOf(rec.seed, 'park', String(p.id));
        const T = { h: O.localH, waterY, size: Math.max(ext.x1 - ext.x0, ext.z1 - ext.z0, 1) };
        let plan = stand(p, T, { seed, house: true });
        // the lawn the plan publishes (the patch and its margin - the house slot is behind the poles' footprint), else the footprint
        const lawnOf = pl => (pl.lawn && pl.lawn.length >= 3 ? pl.lawn : pl.footprint);
        if (e.ground && e.ground.need === 'flatten' && plan && lawnOf(plan) && lawnOf(plan).length >= 3) {
          // THE BANK: the lawn's drop is the most the ground differs from the level over the footprint;
          // the falloff widens with it so the bank never passes 3:1 (a smoothstep's steepest is 1.5 x
          // drop / falloff), up to half the gap the kind keeps between plots - beyond that the plot is
          // too steep for a lawn and is refused, with the reason
          const drop = polyDrop(lawnOf(plan), O.localH, plan.level, 0);
          const KR = KIND_RULES[p.kind] || {}, bankMax = KR.bankMax || 16, gap = KR.gap || 0;
          if (drop > bankMax) { O.records.issues.push('plot ' + p.id + ': the lawn would need a ' + drop.toFixed(0) + ' m bank - too steep for ' + p.pick); continue; }
          const falloff = Math.min(gap / 2 || 8, bankFalloff(lawnOf(plan), O.localH, plan.level, e.ground.falloff || 6));
          const sh = { id: 'park:' + p.id, kind: 'flatten', poly: lawnOf(plan).map(q => [q[0], q[1]]), level: plan.level - F.y0, falloff, derived: true, plot: p.id, drop: +drop.toFixed(2) };
          const M = makeModifier(sh, F.y0);
          if (M) { mods.push(M); index.add(M.bbox, M); shelves.push(sh); }
          plan = stand(p, T, { seed, house: true, level: plan.level });
        }
        if (!plan) { O.records.issues.push('plot ' + p.id + ': ' + p.pick + ' would not stand'); continue; }
        const park = { id: 'park:' + p.id, plot: p, key: p.pick, entry: e, gen: e.gen, plan, level: plan.level, seed, items: [] };
        // the slots: the entry's fill names the occupant, its slots say where in the plan (a path)
        const site = { id: park.id, name: park.id, at: { x: 0, z: 0, yaw: 0 }, items: [] };
        for (const slot in (e.fill || {})) {
          const fk = e.fill[slot], at = slotAt(plan, e.slots && e.slots[slot]);
          if (!at) { O.records.issues.push('park ' + p.id + ': slot ' + slot + ' has no place in the plan'); continue; }
          // placeSite's yaw is at.yaw + PI + item yaw; the plan's ry is the world yaw itself
          site.items.push({ id: slot, key: fk, x: at.x, z: at.z, yaw: (at.ry || 0) - Math.PI, P: { L: Math.min((at.w || 12) - 1, 10), w: Math.min((at.d || 9) - 1, 7.5) } });
        }
        if (site.items.length) {
          const S = placeSite(site, cat, ctx);
          for (const it of S.items) { it.park = park.id; O.records.items.push(it); park.items.push(it); }
          for (const k of S.keepOut) { ctx.keepOut.push(k); ctx.excludes.push(k); O.records.excludes.push(k); }
          for (const i of S.issues) O.records.issues.push(i);
        }
        // THE PARK'S DRESSING (placePark's, in the composer): the footpath from the road's verge to the
        // lawn's front, swaying a little; a rail fence round the plot with its gate where the path comes in
        {
          const rd = roadObjs.find(r => r.id === p.road);
          const n = p.n, tg = p.tg, w = p.w;
          const prnd = mulberry32(hash32(seed, 0x9a7));
          const back = rd ? Math.max(0, roadDist(rd, p.front[0], p.front[1]) - rd.w / 2 - 0.6) : 0;
          const p0 = [p.front[0] - n[0] * back, p.front[1] - n[1] * back];
          const front = plan.toWorld(0, plan.local.patch.z1 + 0.6);
          const sway = (prnd() < 0.5 ? -1 : 1) * (3 + prnd() * 3);
          const pts = [];
          for (let i = 0; i <= 10; i++) { const u = i / 10, sw = Math.sin(u * Math.PI) * sway; pts.push([+(p0[0] + (front[0] - p0[0]) * u + tg[0] * sw).toFixed(3), +(p0[1] + (front[1] - p0[1]) * u + tg[1] * sw).toFixed(3)]); }
          park.path = { pts, width: 1.4 };
          const q = p.poly;
          park.fences = [
            { a: q[0], b: q[1], kind: 'front', style: 'rail', gap: [w / 2 - 1.2, w / 2 + 1.2] },
            { a: q[1], b: q[2], kind: 'side', style: 'rail', gap: null },
            { a: q[2], b: q[3], kind: 'back', style: 'rail', gap: null },
            { a: q[3], b: q[0], kind: 'side', style: 'rail', gap: null },
          ];
        }
        O.records.parks.push(park);
      }
      O.n = mods.length;
    }
    const pool = o.pool || [];
    const tctx = { T: O.localH, waterY, seed: rec.seed, excludes: ctx.excludes, plots: O.records.plots, roads: roadObjs, pool, trees: O.records.trees };
    for (const z of rec.layers.zones) if (z.kind === 'forest' && z.poly && z.poly.length >= 3 && polySimple(z.poly))
      for (const t of planForest(z, Object.assign({}, tctx, { waterY: zoneWaterY(z) }))) O.records.trees.push(t);
    // the hand-placed trees (objects of kind 'tree'), in the premises frame, TREE_PLACE's record
    for (const ob of rec.layers.objects) if (ob.kind === 'tree') O.records.trees.push({ x: ob.x, z: ob.z, key: ob.key, size: ob.size || 1, yaw: ob.yaw || 0, sink: 0, h: 12, id: ob.id, placed: true });
    // the hand-placed PROPS and BILLBOARDS (contract v1.6): a prop is a PROP_REG key stood on the
    // composed ground (tilted to it when `on` is 'ground'), a billboard a painted sign's key on its
    // posts at the width given; both in the premises frame, their y the ground plus `dy`
    // ...and the PARKED AEROPLANES (G411, contract v1.12): kind 'aircraft', its key naming a build
    // ('arch:cub', 'stock:<name>', 'mine:<slot>' - src/viewer/parked.js), stood on its wheels on the
    // composed ground, nose along its yaw. Same record shape as a prop; the renderer tells them apart.
    O.records.objects = [];
    for (const ob of rec.layers.objects) if (ob.kind === 'prop' || ob.kind === 'billboard' || ob.kind === 'aircraft') {
      if (!ob.key) { O.records.issues.push(ob.kind + ' ' + ob.id + ': no key'); continue; }
      O.records.objects.push({ id: ob.id, kind: ob.kind, key: ob.key, x: ob.x, z: ob.z, yaw: +ob.yaw || 0, y: O.localH(ob.x, ob.z) + (+ob.dy || 0), w: +ob.w || 3.6, on: ob.on || 'ground' });
    }
    // THE ANIMALS (contract v1.17, 2026-09-22): a HOTSPOT, not an individual -
    // `n` animals of the species `key` living within `r` metres of (x, z). One
    // record makes a herd, a pod or a flock, and `n: 1, r: 0` is one animal
    // placed by hand. They carry no mesh here: src/viewer/animal_run.js sows
    // them on the composed ground (and the composed WATER, for a pod), seeded
    // per individual so adding one never moves the others (rule 5).
    O.records.animals = [];
    for (const ob of rec.layers.objects) if (ob.kind === 'animal') {
      if (!ob.key) { O.records.issues.push('animal ' + ob.id + ': no species'); continue; }
      O.records.animals.push({ id: ob.id, key: ob.key, x: ob.x, z: ob.z, yaw: +ob.yaw || 0,
                               y: O.localH(ob.x, ob.z) + (+ob.dy || 0), dy: +ob.dy || 0,
                               n: Math.max(1, Math.min(24, (+ob.n) | 0 || 1)), r: Math.max(0, +ob.r || 0) });
    }
    for (const t of O.records.trees) t.y = O.localH(t.x, t.z);
  }
  return O;
}

// ---------------------------------------------------------------------------
// issues — what refuses a commit; checks — what the panel shows and the gate holds
// ---------------------------------------------------------------------------
// what a `pav` may carry, checked once for every layer that takes one. A MISSPELT KEY WAS SILENT:
// resolve() reads the seven knobs it knows and ignores the rest, so `pav: { mark: 'none' }` did
// nothing and said nothing (the Metlakatla session asked, 2026-09-23)
function pavIssues(what, pav) {
  const out = [];
  if (typeof pav !== 'object') { out.push(what + ': pav is an object of knobs'); return out; }
  for (const key in pav) if (PAV_KEYS.indexOf(key) < 0) out.push(what + ': pav has no knob `' + key + '` (' + PAV_KEYS.join(', ') + ')');
  if (pav.marks !== undefined && PAV_MARKS.indexOf(pav.marks) < 0) out.push(what + ': pav.marks is ' + PAV_MARKS.join(' | '));
  return out;
}
function standIssues(what, st) {
  const out = [];
  if (typeof st !== 'object' || Array.isArray(st)) { out.push(what + ': stands is an object of numbers'); return out; }
  for (const key in st) if (STAND_KEYS.indexOf(key) < 0) out.push(what + ': stands has no knob `' + key + '` (' + STAND_KEYS.join(', ') + ')');
  if (!(+st.n >= 1 && +st.n <= 24)) out.push(what + ': stands.n is 1 to 24');
  if (st.pitch !== undefined && !(+st.pitch > 0)) out.push(what + ': stands.pitch must be positive');
  for (const key of ['lead', 'bar']) if (st[key] !== undefined && !(+st[key] > 0)) out.push(what + ': stands.' + key + ' must be positive');
  return out;
}
function issues(rec0) {
  const rec = normalise(rec0);
  const out = [];
  for (const k of ['terrain', 'surface', 'material', 'exclude', 'zones']) for (const e of rec.layers[k]) {
    if (e.kind === 'grade') { if (!e.pts || e.pts.length < 2) out.push(k + ' ' + e.id + ': a grade needs two points'); continue; }
    if (!e.poly || e.poly.length < 3) { out.push(k + ' ' + e.id + ': a polygon needs three points'); continue; }
    if (!polySimple(e.poly)) out.push(k + ' ' + e.id + ': the polygon crosses itself');
    if (k === 'terrain' && !(+e.falloff > 0)) out.push('terrain ' + e.id + ': falloff must be positive');
    if (k === 'zones' && ZONE_KINDS.indexOf(e.kind) < 0) out.push('zone ' + e.id + ': unknown kind ' + e.kind);
    if (k === 'zones' && e.rules && e.rules.grass && ['lawn', 'meadow', 'none'].indexOf(e.rules.grass.kind) < 0) out.push('zone ' + e.id + ': grass kind is lawn, meadow or none');
    if (k === 'material' && !e.set && !e.look) out.push('material ' + e.id + ': no set and no look');
    if (k === 'material' && e.look && !(RUNWAY_LOOKS[e.look] && RUNWAY_LOOKS[e.look].cls)) out.push('material ' + e.id + ': unknown look ' + e.look);
    if (k === 'material' && e.band !== undefined && e.band !== null && !(+e.band >= 0)) out.push('material ' + e.id + ': band must be 0 or more');
    if (k === 'material' && e.pav) out.push.apply(out, pavIssues('material ' + e.id, e.pav));
    if (k === 'material' && e.stands) out.push.apply(out, standIssues('material ' + e.id, e.stands));
  }
  // ROADS AND RUNWAYS ARE VALIDATED HERE (2026-09-23): the polygon loop above carried three checks
  // written `k === 'roads' || k === 'runways'` and never ran over either layer, so a road's band, its
  // `pav` and its look have gone unchecked since v1.16. They are checked now.
  for (const k of ['roads', 'runways']) for (const e of rec.layers[k]) {
    const what = k.replace(/s$/, '') + ' ' + e.id;
    if (e.band !== undefined && e.band !== null && !(+e.band >= 0)) out.push(what + ': band must be 0 or more');
    if (e.pav) out.push.apply(out, pavIssues(what, e.pav));
    if (e.look !== undefined && e.look !== null && !RUNWAY_LOOKS[e.look]) out.push(what + ': unknown look ' + e.look);
  }
  for (const r of rec.layers.roads) { if (!r.pts || r.pts.length < 2) out.push('road ' + r.id + ': a road needs two points'); else if (!(+r.w > 0)) out.push('road ' + r.id + ': width must be positive'); }
  for (const r of rec.layers.runways) {
    if (!r.c || !(r.len >= 150)) out.push('runway ' + r.id + ': a strip is at least 150 m');
    else if (!(r.wid >= 8)) out.push('runway ' + r.id + ': a strip is at least 8 m wide');
    else for (const i of profileIssues(Object.assign({}, RUNWAY_DEF, r))) out.push(i);
    if (r.look !== undefined && r.look !== null && !RUNWAY_LOOKS[r.look]) out.push('runway ' + r.id + ': unknown look ' + r.look);
    if (r.approach !== undefined && r.approach !== null && r.approach !== 0 && r.approach !== 1) out.push('runway ' + r.id + ': approach is 0, 1 or null');
    if (r.circuit != null) {
      const c = r.circuit;
      if (typeof c !== 'object') out.push('runway ' + r.id + ': circuit is an object { hand, height, join } or null');
      else {
        if (c.hand != null && c.hand !== 'left' && c.hand !== 'right') out.push('runway ' + r.id + ': circuit.hand is left or right');
        if (c.height != null && !(+c.height > 0)) out.push('runway ' + r.id + ': circuit.height is metres over the strip');
        if (c.join != null && c.join !== 'downwind' && c.join !== 'straight') out.push('runway ' + r.id + ': circuit.join is downwind or straight');
      }
    }
    if (r.papi && (!Array.isArray(r.papi) || r.papi.length !== 2 || !r.papi.every(v => v === true || v === false || v === 'vasi'))) out.push('runway ' + r.id + ': papi is [end 0, end 1] of true, false or vasi');
    if (r.hangar && !(isFinite(+r.hangar.x) && isFinite(+r.hangar.z))) out.push('runway ' + r.id + ': the hangar needs x and z');
  }
  const fl = rec.layers.terrain.filter(e => e.kind === 'flatten' && e.poly && polySimple(e.poly));
  for (let i = 0; i < fl.length; i++) for (let j = 0; j < i; j++) {
    const a = fl[i], b = fl[j];
    if (Math.abs((+a.level || 0) - (+b.level || 0)) < 0.01) continue;
    if (polysOverlap(a.poly, b.poly)) out.push('terrain ' + a.id + ' and ' + b.id + ': two flattens at different levels overlap');
  }
  for (const s of rec.layers.surface) if (!(s.surface >= 0 && s.surface <= 7)) out.push('surface ' + s.id + ': unknown surface ' + s.surface);
  // two strips whose boxes overlap: the later one re-grades the earlier across its profile - a mistake, not a fixed point
  const rws = rec.layers.runways.filter(r => r.c && r.len >= 150 && r.wid >= 8).map(r => Object.assign({}, RUNWAY_DEF, r)).filter(r => !runwayIsWater(r));
  for (let i = 0; i < rws.length; i++) for (let j = 0; j < i; j++) if (polysOverlap(runwayBox(rws[i], 0), runwayBox(rws[j], 0))) out.push('runways ' + rws[i].id + ' and ' + rws[j].id + ' cross');
  for (const ob of rec.layers.objects) { if (ob.kind === 'tree' && !ob.key) out.push('tree ' + ob.id + ': no species'); if ((ob.kind === 'prop' || ob.kind === 'billboard' || ob.kind === 'aircraft') && !ob.key) out.push(ob.kind + ' ' + ob.id + ': no key');
    if (ob.kind === 'animal') { if (!ob.key) out.push('animal ' + ob.id + ': no species'); if (ob.n !== undefined && (!(+ob.n >= 1) || +ob.n > 24)) out.push('animal ' + ob.id + ': ' + ob.n + ' of them (1 to 24)'); } }
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
// a shelf's ground in the premises frame: the pad's rect grown by its larger margin, in the item's frame
function shelfCovers(sh, lx, lz) {
  if (sh.kind !== 'shelf') return sh.poly ? inPoly(sh.poly, lx, lz) : false;
  const dx = lx - sh.c[0], dz = lz - sh.c[1], cy = Math.cos(sh.yaw), sy = Math.sin(sh.yaw);
  const x = dx * cy - dz * sy, z = dx * sy + dz * cy, m = Math.max(+sh.marginF || 0, +sh.marginB || 0);
  return x >= sh.rect.x0 - m && x <= sh.rect.x1 + m && z >= sh.rect.z0 - m && z <= sh.rect.z1 + m;
}
// the baked-vs-live tolerance over a CELL: the curvature bound at its worst corner, not at the point (the
// bilinear error is bounded by the second differences anywhere in the cell)
function cellTol(O, F, lx, lz, c, world) {
  const i = Math.floor(lx / c) * c, j = Math.floor(lz / c) * c;
  let t = curvTol(O, F, lx, lz, c, world);
  for (const [a, b] of [[i, j], [i + c, j], [i, j + c], [i + c, j + c]]) t = Math.max(t, curvTol(O, F, a, b, c, world));
  return t;
}
// THE DELTA (v6): what the modifiers ADD to the world at a point - the surface the baked-vs-live law
// is about. The world's own creases are the world's (its raster answers for them); the modifier
// layer's promise is that ITS contribution rasters within the bilinear bound.
function deltaAt(O, F, world, lx, lz) { const w = F.toWorld(lx, lz); return O.terrainAt(w[0], w[1]) - world.terrainH(w[0], w[1]); }
function curvTol(O, F, lx, lz, c, world) {
  const at = world ? (dx, dz) => deltaAt(O, F, world, lx + dx, lz + dz) : (dx, dz) => { const w = F.toWorld(lx + dx, lz + dz); return O.terrainAt(w[0], w[1]); };
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
    // the STEP the modifiers add, not the terrain's own slope (a cliff of the village's mountain is not a falloff's fault)
    const wa = F.toWorld(lx, lz), wb = F.toWorld(lx + 0.25, lz);
    const da = O.localH(lx, lz) - world.terrainH(wa[0], wa[1]), db = O.localH(lx + 0.25, lz) - world.terrainH(wb[0], wb[1]);
    const s = Math.abs(db - da) / 0.25;
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
      const bil = h => (h(i, j) * (1 - fu) + h(i + cell, j) * fu) * (1 - fv) + (h(i, j + cell) * (1 - fu) + h(i + cell, j + cell) * fu) * fv;
      const baked = bil(g);
      // the world's own raster miss at this point: a crease of the world's is the world's, not the layer's
      const w0 = (a, b) => { const w = F.toWorld(a, b); return world.terrainH(w[0], w[1]); };
      const worldMiss = Math.abs(w0(lx, lz) - bil(w0));
      const err = Math.abs(O.localH(lx, lz) - baked) - (0.02 + cellTol(O, F, lx, lz, cell) + worldMiss);
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
  if (O.records.items.some(i => !i.park) || rec.layers.sites.length) {
    const want = rec.layers.sites.reduce((a, st) => a + (st.items || []).length, 0);
    const own = O.records.items.filter(i => !i.park).length;
    put(own === want, own + ' of ' + want + ' site items resolved from the catalogue' + (O.records.issues.length ? ' - ' + O.records.issues[0] : ''));
  }
  if (O.records.links.length) put(O.records.links.every(L => L.ok), O.records.links.every(L => L.ok) ? O.records.links.length + ' link' + (O.records.links.length > 1 ? 's' : '') + ' solved' : O.records.links.find(L => !L.ok).issues[0]);
  // the runways (rule 10): the centreline on its profile to 5 cm; the pattern sound
  for (let i = 0; i < O.runways.length; i++) {
    const r = O.runways[i], A = O.aerodromes[i], E = runwayEnds(r);
    let worst = 0;
    const prof = runwayProfile(r);
    for (let t = 0; t <= r.len; t += Math.max(2, r.len / 60)) {
      const lx = E.end0[0] + E.d[0] * t, lz = E.end0[1] + E.d[1] * t;
      const want = A.elev + prof.at(t);
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
const GENERATORS = ['HOUSE_GEN', 'BIG_GEN', 'SHED_GEN', 'TRAM_GEN', 'TOTEM_GEN', 'FACTORY_GEN', 'SPORT_GEN', 'HANGAR_GEN', 'TOWER_GEN'];   // SPORT_GEN: the sports grounds (G392), when the page loads tools/_sport_gen.js
const GEN_NS = { HOUSE_GEN: 'house', BIG_GEN: 'big', SHED_GEN: 'shed', TRAM_GEN: 'tram', TOTEM_GEN: 'totem', FACTORY_GEN: 'factory', SPORT_GEN: 'sport', HANGAR_GEN: 'hangar', TOWER_GEN: 'tower' };
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
        const cat = typeof G.catOf === 'function' ? (G.catOf(name) || null) : null;   // G393: every generator answers one of the seven words
        entries.set(key, { key, kind: isMill ? 'complex' : 'building', gen: g, preset: name, P: {}, frame: 'house', derived: true, cat,
          params: ov => Object.assign({}, G.DEF, G.PRESETS[name] || {}, ov || {}),
          // the mill's foot is its tiers' footprint (placeSite :718-720); a house's its L x w
          foot: P => { if (P.mill) { const L = P.tierL0 + 24, w = P.tierW / 2 + (Math.round(P.tiers) - 1) * P.tierStep + P.tierW, zc = -(w / 2 - P.tierW / 2); return [[-L / 2, zc - w / 2], [L / 2, zc - w / 2], [L / 2, zc + w / 2], [-L / 2, zc + w / 2]]; } const L = (P.L || 8) / 2, w = (P.w || 6) / 2; return [[-L, -w], [L, -w], [L, w], [-L, w]]; },
          keepOut: 3, ground: { need: 'none' }, size: P => ({ L: P.L || 8, w: P.w || 6 }),
          hooks: () => [], lod: { dist: [0, 150, 500, 1500] }, slots: {}, tags: cat ? [ns, cat] : [ns], headless: true });
      }
    }
  }
  return { entries, aliases, issues: issuesOut, keys: () => Array.from(entries.keys()), byTag(t) { const out = []; entries.forEach(e => { if ((e.tags || []).indexOf(t) >= 0) out.push(e); }); return out; },
           // by CATEGORY (v9): the entries whose `cat` is the word (a park entry without one is a landmark)
           byCat(c) { const out = []; entries.forEach(e => { if ((e.cat || (e.kind === 'park' ? 'landmark' : null)) === c) out.push(e); }); return out; } };
}

const API = { PREMISES_V, LAYERS, SURFACE, SURFACE_NAMES, ROAD_CLS, ROAD_LOOK, roadLook, PAVE_BAND, PAVE_FADE, paveBand, PAV_KEYS, PAV_MARKS, STAND_KEYS, ZONE_GRASS, zoneGrass, ZONE_KINDS, ZONE_RULES, KIND_RULES, CATEGORIES, THEMES, THEME_DEF, themeOf, RUNWAY_LOOKS, runwaySite, runwayIsWater, HANGAR_DIMS, PREMISES_MIGRATORS, GENERATORS,
  fnv, hash32, mulberry32, seedOf, fbm,
  polyBBox, polyCentroid, polyArea, polyCCW, inPoly, sdPoly, distPtSeg, polySimple, ensureCCW, smf01, polysOverlap,
  polyRoad, roadDist, roadInPoly, shoreDepth, sowPlots, planForest, pickFor, PICK_TAGS, RUNWAY_DEF, runwayProfile, profileIssues, runwayShoulder, runwayEnds, runwayBox, runwayAerodrome, siteFrame, placeSite, siteShelves, slotAt, polyDrop, bankFalloff, shelfCovers, cellTol, deltaAt, LINK_SOLVERS, solveLinks,
  makeModifier, SpatialIndex, DEF, migrate, normalise, envelope, unwrap, newId, findById,
  frameOf, compose, issues, checks, bake, curvTol, collect };
if (typeof window !== 'undefined') window.PREMISES_GEN = API;
// standalone in node (GATE PREMISES requires this file) the API is the module; inside the core
// bundle 90_node_exports.js assigns module.exports after this line and carries PREMISES_GEN itself
if (typeof module !== 'undefined' && module.exports) module.exports = API;
return API;
})();
