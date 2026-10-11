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
//   the index         256 m cells keyed by number (treesNear's idiom) so the
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

const PREMISES_V = 2;   // v2 (contract v1.36, G2910): the polygon entries folded into `areas` (PREMISES_MIGRATORS[1])
// `ttype` (v1.20, 2026-09-22): polygons that STAMP a terrain-type code into the
// island's own ttype grid at composition. It is the one layer that writes into the
// world's data rather than over it, and it is how a place gets a terrain type the
// island's classifier never made - Metlakatla's alder corridor, code 15 `lush`.
// NOT `cover`: `coverAt` on the overlay already means what the COVER RING may plant
// at a point (the pavement's kill and boost, the plot's grass rule), and two unrelated
// things sharing that word in one file is how a reader is misled.
const LAYERS = ['terrain', 'surface', 'material', 'exclude', 'roads', 'runways', 'zones', 'sites', 'links', 'objects', 'ttype', 'areas', 'junctions'];   // v1.37: junctions (G2950)
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
// Math.hypot to the bit, the JIT-inlined way (00_registry.js hyp2 - PHYSICS PERF 2026-09-24): the composed
// ground is asked for every wheel and every node of the aeroplane every substep, and a road's grade
// makes one distance a segment. Standalone (GATE PREMISES requires this file alone) it is Math.hypot.
const HYP2 = (typeof hyp2 === 'function') ? hyp2 : Math.hypot;

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
  return HYP2(x - (a[0] + dx * t), z - (a[1] + dz * t));
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
// a segment against a closed axis-aligned rectangle (Liang-Barsky): true if any point of it lies in the rectangle
function segHitsRect(a, b, x0, z0, x1, z1) {
  let t0 = 0, t1 = 1;
  const dx = b[0] - a[0], dz = b[1] - a[1];
  const clip = (p, q) => { if (p === 0) return q >= 0; const r = q / p; if (p < 0) { if (r > t1) return false; if (r > t0) t0 = r; } else { if (r < t0) return false; if (r < t1) t1 = r; } return true; };
  return clip(-dx, a[0] - x0) && clip(dx, x1 - a[0]) && clip(-dz, a[1] - z0) && clip(dz, z1 - a[1]) && t0 <= t1;
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
// A ROAD DOES NOT TURN ON A POINT (2026-09-23, the user, on the totem grounds' 2.2 m track: "can you
// ensure that all path have no sharp angles ... They should be rounded at least a little, or smoothed
// overall"). An authored centreline is a handful of points and every one of them was a CORNER: the
// drawn ribbon, its band, its ruts and its markings all kinked, because nothing between the author's
// clicks and the mesh ever asked what radius a vehicle turns at.
//
// FILLETED, not resampled. A spline through the points would move the STRAIGHTS - a road would drift
// off the shore it was traced along - so the straights are kept exactly and only the corner is
// replaced, by the arc tangent to both legs. That is what a road actually is, and it is what an
// author expects when they drag a point: the line goes where they put it.
//
// THE RADIUS is the road's own: `w * 2.5` (a 2.2 m track rounds at 5.5 m, an 18 m street at 45),
// clamped to 4..60 m, and then bounded twice so it can never misbehave -
//   by the LEGS: the tangent length takes at most 45 % of either adjacent segment, so two corners
//     close together cannot eat each other and a short leg is not swallowed;
//   by the WIDTH: the arc's sagitta stays under 0.35 * w, so the smoothed centreline never leaves
//     the authored corner by more than a third of the road's width. That bound is what keeps every
//     consumer still reading the AUTHORED points - the pilot's taxi route, a premises surface
//     polygon, the editor's own drag handles - safely on the pavement.
// A turn under 3 degrees is left alone (it reads straight and an arc there is noise); the ends are
// never touched. The arc is walked every ~8 degrees, at least two segments, so `at()` traces a curve
// rather than a cut corner.
function roadFillet(pts, w) {
  const P = [];
  for (const q of pts) { const l = P[P.length - 1]; if (!l || Math.hypot(q[0] - l[0], q[1] - l[1]) > 1e-6) P.push([q[0], q[1]]); }
  if (P.length < 3) return P;
  const want = clamp((+w || 4) * 2.5, 4, 60);
  const out = [P[0]];
  for (let i = 1; i < P.length - 1; i++) {
    const A = P[i - 1], B = P[i], C = P[i + 1];
    const a = [A[0] - B[0], A[1] - B[1]], c = [C[0] - B[0], C[1] - B[1]];
    const la = Math.hypot(a[0], a[1]), lc = Math.hypot(c[0], c[1]);
    if (la < 1e-6 || lc < 1e-6) { out.push(B); continue; }
    const ua = [a[0] / la, a[1] / la], uc = [c[0] / lc, c[1] / lc];
    const cosA = clamp(ua[0] * uc[0] + ua[1] * uc[1], -1, 1);
    const inner = Math.acos(cosA);                       // the angle of the corner itself, A-B-C
    const turn = Math.PI - inner;                        // how far the road turns through it
    // under 3 degrees reads straight and an arc there is noise; over 150 is not a corner at all but
    // a road DOUBLING BACK on itself, and filleting one produces a 15 cm u-turn of twenty points -
    // geometrically smooth, visually the same spike, and a ribbon that folds on itself. Leave it
    // exactly as authored so it stays visible, and let GATE PAVEMENT section 11 name it.
    if (turn < 3 * Math.PI / 180 || turn > 150 * Math.PI / 180 || inner < 1e-3) { out.push(B); continue; }
    const half = inner / 2, tanHalf = Math.tan(half);
    let R = want;
    R = Math.min(R, 0.45 * Math.min(la, lc) * tanHalf);  // the legs: tangent = R / tan(inner/2)
    const sag = 1 - Math.sin(half);                      // sagitta = R * (1/sin(half) - 1) * sin(half)
    if (sag > 1e-6) R = Math.min(R, 0.35 * (+w || 4) * Math.sin(half) / sag);
    const tl = R / tanHalf;                              // how far back along each leg the arc starts
    if (!(R > 0.05) || !(tl > 0.05)) { out.push(B); continue; }
    const T0 = [B[0] + ua[0] * tl, B[1] + ua[1] * tl], T1 = [B[0] + uc[0] * tl, B[1] + uc[1] * tl];
    const bis = [ua[0] + uc[0], ua[1] + uc[1]];
    const lb = Math.hypot(bis[0], bis[1]);
    if (lb < 1e-6) { out.push(B); continue; }            // a straight-back hairpin: no centre to find
    const d = R / Math.sin(half);                        // B to the arc's centre, along the bisector
    const O = [B[0] + bis[0] / lb * d, B[1] + bis[1] / lb * d];
    let a0 = Math.atan2(T0[1] - O[1], T0[0] - O[0]);
    const a1 = Math.atan2(T1[1] - O[1], T1[0] - O[0]);
    let sweep = a1 - a0;
    while (sweep > Math.PI) sweep -= 2 * Math.PI;
    while (sweep < -Math.PI) sweep += 2 * Math.PI;
    const n = Math.max(2, Math.ceil(Math.abs(sweep) / (8 * Math.PI / 180)));
    for (let k = 0; k <= n; k++) { const ang = a0 + sweep * k / n; out.push([O[0] + Math.cos(ang) * R, O[1] + Math.sin(ang) * R]); }
  }
  out.push(P[P.length - 1]);
  return out;
}
function polyRoad(pts0, w) {
  const pts = roadFillet(pts0, w);
  const s = [0];
  for (let i = 1; i < pts.length; i++) s.push(s[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  // the first i >= 1 whose arclength reaches t (the last if none): a bisection over the running sum,
  // which never decreases - the linear walk it replaced made roadInPoly's 2 m sampling a square
  // (2026-09-24); a sum that is not finite keeps the walk, whose stop at a NaN is its own
  const bisect = isFinite(s[s.length - 1]);
  const at = t => {
    t = clamp(t, 0, s[s.length - 1]);
    let i = 1;
    if (bisect) { let hi = s.length - 1; while (i < hi) { const m = (i + hi) >> 1; if (s[m] < t) i = m + 1; else hi = m; } }
    else while (i < s.length - 1 && s[i] < t) i++;
    const u = (t - s[i - 1]) / Math.max(1e-6, s[i] - s[i - 1]);
    const p = [pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * u, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * u];
    const d = [pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]];
    const L = Math.hypot(d[0], d[1]) || 1;
    const tg = [d[0] / L, d[1] / L];
    return { p, tg, n: [tg[1], -tg[0]] };          // n = the right-hand side; the sower names the sides by the water
  };
  return { pts, s, length: s[s.length - 1], at, w };
}
// THE ROAD'S SEGMENT GRID (G2917; the user, 11 Oct: "I have traced a road with 250 points, and it's very difficult to
// edit, constant browser stuck window"). roadDist walked EVERY segment of a road's drawn line, and it is asked by
// everything near a road - coverAt (the cover ring's tufts, the tree walk: a road is filed in the cover index by its
// whole box), surfaceAt (each wheel, each substep), roadNear, the plots, the poles. A 250-point spline is ~2 500 drawn
// segments (its 0.9 degree steps): every sample anywhere in its box walked them all, tens of millions of segment tests
// in the re-sampling after an edit. Now a road of SEG_MIN points or more files its segments in SEG_CELL cells (built
// once per road object and line, a WeakMap - nothing is added to the object), and a query walks the rings of cells
// round its own until no unvisited segment can be nearer: the SAME minimum over the same distPtSeg values, bit for
// bit (GATE SCENERYED 9 against the walk). Far outside the grid, and for a short road, the walk as before.
const SEG_MIN = 48, SEG_CELL = 16, SEG_RINGS = 24;
let SEG_IDX = typeof WeakMap === 'function' ? new WeakMap() : null;
// (the bench's and the gate's switch: segIdx(false) is the walk everywhere, the before of an A/B; segIdx(true) back)
function segIdx(on) { if (on === false) SEG_IDX = null; else if (on === true && !SEG_IDX && typeof WeakMap === 'function') SEG_IDX = new WeakMap(); return !!SEG_IDX; }
const fin2 = q => !!q && isFinite(q[0]) && isFinite(q[1]);
function roadSegIdx(road) {
  const P = road && road.pts;
  if (!SEG_IDX || !Array.isArray(P) || P.length < SEG_MIN) return null;
  const last = P[P.length - 1], mid = P[P.length >> 1], sig = fin2(last) && fin2(mid) ? last[0] + last[1] * 3 + mid[0] * 7 + mid[1] * 11 : NaN;
  let I = SEG_IDX.get(road);
  if (I && I.pts === P && I.n === P.length && Object.is(I.sig, sig)) return I;
  let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
  for (const q of P) if (fin2(q)) { if (q[0] < x0) x0 = q[0]; if (q[0] > x1) x1 = q[0]; if (q[1] < z0) z0 = q[1]; if (q[1] > z1) z1 = q[1]; }
  if (!isFinite(x0)) return null;
  const C = SEG_CELL, nx = Math.floor((x1 - x0) / C) + 1, nz = Math.floor((z1 - z0) / C) + 1, cells = new Map();
  for (let i = 1; i < P.length; i++) {
    const a = P[i - 1], b = P[i]; if (!fin2(a) || !fin2(b)) continue;   // (a segment with a NaN end never wins the walk's min either)
    const i0 = Math.floor((Math.min(a[0], b[0]) - x0) / C), i1 = Math.floor((Math.max(a[0], b[0]) - x0) / C);
    const j0 = Math.floor((Math.min(a[1], b[1]) - z0) / C), j1 = Math.floor((Math.max(a[1], b[1]) - z0) / C);
    for (let ci = i0; ci <= i1; ci++) for (let cj = j0; cj <= j1; cj++) { const k = ci * 65536 + cj; let l = cells.get(k); if (!l) cells.set(k, l = []); l.push(i); }
  }
  I = { pts: P, n: P.length, sig, x0, z0, nx, nz, C, cells };
  SEG_IDX.set(road, I);
  return I;
}
function roadDist(road, x, z) {
  const I = roadSegIdx(road);
  if (I) {
    const ci = Math.floor((x - I.x0) / I.C), cj = Math.floor((z - I.z0) / I.C);
    if (ci >= -2 && cj >= -2 && ci <= I.nx + 1 && cj <= I.nz + 1) {
      // (a query farther than SEG_RINGS cells from the line - a point across an island-long road's box - takes the walk:
      // the rings would visit more cells than the walk tests segments)
      const P = I.pts, kMax = Math.min(SEG_RINGS, Math.max(I.nx, I.nz) + 3), all = kMax === Math.max(I.nx, I.nz) + 3;
      let d = Infinity;
      for (let k = 0; k <= kMax; k++) {
        // ring k round the query's cell; then nothing unvisited lies nearer than k cells
        for (let i = ci - k; i <= ci + k; i++) {
          if (i < 0 || i >= I.nx) continue;
          const edge = i === ci - k || i === ci + k;
          for (let j = cj - k; j <= cj + k; j += (edge || k === 0) ? 1 : 2 * k) {
            if (j < 0 || j >= I.nz) continue;
            const l = I.cells.get(i * 65536 + j); if (!l) continue;
            for (let m = 0; m < l.length; m++) { const s = l[m], e = distPtSeg(x, z, P[s - 1], P[s]); if (e < d) d = e; }
          }
        }
        if (d <= k * I.C) return d;
      }
      if (all) return d;
    }
  }
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
// (G835) every modifier keeps the definition it was made from: the cooked raster's signature (compose, rasterSig)
// hashes them, so a cook made from another record, another island or another composer never loads
function makeModifier(m, y0) { const M = makeModifier0(m, y0); if (M) { M.def = m; M.y0 = y0; } return M; }
function makeModifier0(m, y0) {
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
    // THE TWO ENDS OF THE FEATHER NEED NO DISTANCE (PHYSICS PERF 2026-09-24). weight() is 1 for any
    // sd <= 0 and sdPoly is -d inside, so a point inside the polygon weighs 1 whatever its distance to
    // the edge - the aeroplane on an apron pad asked for that distance per node per substep. Outside,
    // the plain squared distances bound the exact one from below within a hair (1e-9 relative, where
    // the two roundings differ by 1e-16): past the falloff by that margin the weight is 0 on either
    // reading. Everything between is sdPoly's own arithmetic, so the height is the same bits.
    const n = poly.length, fall2 = fall * fall * (1 + 1e-9);
    // THE CEILING (PHYSICS PERF, the solver's ground skip): apply() returns h + (T - h) w with w in
    // [0, 1] - never above max(h, T). bound() answers T's highest over a rectangle (local frame):
    // { t } for a level or a plane (a plane's highest is at a corner), { add } for a raise (T = h + dh).
    const bound = (x0, z0, x1, z1) => {
      if (m.kind === 'raise') return { t: -Infinity, add: Math.max(0, +m.dh || 0) };
      if (m.kind === 'flatten') return { t: target(0, 0, 0), add: 0 };
      const a0 = Math.max(x0, bbox.x0), a1 = Math.min(x1, bbox.x1), b0 = Math.max(z0, bbox.z0), b1 = Math.min(z1, bbox.z1);
      return { t: Math.max(target(a0, b0), target(a1, b0), target(a0, b1), target(a1, b1)), add: 0 };
    };
    // THE PAD THAT COVERS THE RECTANGLE (G611, the ceiling): a rectangle wholly inside the polygon - its corners
    // inside and no edge touching it - is at weight 1 at every point, so every point reads the target whatever
    // lay under it: hMaxRect restarts its bound there (the stand's apron over a DEM that rises under it). A
    // raise adds to what lay under it and never covers.
    const covers = m.kind === 'raise' ? null : (x0, z0, x1, z1) => {
      if (!(inPoly(poly, x0, z0) && inPoly(poly, x1, z0) && inPoly(poly, x0, z1) && inPoly(poly, x1, z1))) return false;
      for (let i = 0; i < n; i++) if (segHitsRect(poly[i], poly[(i + 1) % n], x0, z0, x1, z1)) return false;
      return true;
    };
    return { id: m.id, kind: m.kind, bbox, bound, covers, feather: fall, apply: (x, z, h) => {
      if (x < bbox.x0 || x > bbox.x1 || z < bbox.z0 || z > bbox.z1) return h;
      let w;
      if (inPoly(poly, x, z)) w = 1;
      else {
        let near = false;
        for (let i = 0; i < n; i++) {
          const a = poly[i], b = poly[(i + 1) % n], dx = b[0] - a[0], dz = b[1] - a[1], l2 = dx * dx + dz * dz;
          const t = l2 > 1e-12 ? Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / l2)) : 0;
          const ex = x - (a[0] + dx * t), ez = z - (a[1] + dz * t);
          if (ex * ex + ez * ez < fall2) { near = true; break; }
        }
        w = near ? weight(sdPoly(poly, x, z)) : 0;
      }
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
    // (the ceiling: level + (h - level) sm, sm in [0, 1] - between h and the level)
    // (G611: a rectangle whose four corners lie in the pad rect - the item's frame, a margin of a micron - reads
    // the level at every point: k = 0 there)
    const inR = (x, z) => { const dx = x - c[0], dz = z - c[1], lx = dx * cy - dz * sy, lz = dx * sy + dz * cy;
      return lx >= R.x0 + 1e-6 && lx <= R.x1 - 1e-6 && lz >= R.z0 + 1e-6 && lz <= R.z1 - 1e-6; };
    const covers = (x0, z0, x1, z1) => inR(x0, z0) && inR(x1, z0) && inR(x0, z1) && inR(x1, z1);
    return { id: m.id, kind: 'shelf', bbox, bound: () => ({ t: level, add: 0 }), covers, feather: Math.min(mF, mB), apply: (x, z, h) => {
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
    // THE CELLS ARE THE REACH, THE KEYS NUMBERS (the boot's house build, 2026-09-24).
    // At 64 m a town query still scanned ~15-25 segments of every road near it and
    // built a string key per road per query - 18 s of Metlakatla's roll-out, the
    // fences' AO and the lots' ground asking for the composed height. Cells of
    // `reach` counted from the bbox's corner hold every segment within reach of a
    // point in them (the same test, finer), in the polyline's order, so the scan
    // is the same scan over a shorter list and the answer bit-identical.
    const reach = hw + fall, CS = Math.max(4, reach), cells = new Map();
    const NZ = Math.floor((bbox.z1 - bbox.z0) / CS) + 3;
    const ck = (i, j) => (i + 1) * NZ + (j + 1);
    const cx = x => Math.floor((x - bbox.x0) / CS), cz = z => Math.floor((z - bbox.z0) / CS);
    for (let i = 0; i + 1 < pts.length; i++) {
      const a = pts[i], b = pts[i + 1];
      const i0 = cx(Math.min(a[0], b[0]) - reach), i1 = cx(Math.max(a[0], b[0]) + reach);
      const j0 = cz(Math.min(a[1], b[1]) - reach), j1 = cz(Math.max(a[1], b[1]) + reach);
      for (let ci = i0; ci <= i1; ci++) for (let cj = j0; cj <= j1; cj++) {
        const k = ck(ci, cj); let l = cells.get(k); if (!l) { l = []; cells.set(k, l); } l.push(i);
      }
    }
    // (the ceiling: h + (y + ty - h) w, w in [0, 1], ty between the ends of a segment in the point's
    // cell - so the highest end of any segment filed in a cell the rectangle touches, one cell of slack)
    const bound = (x0, z0, x1, z1) => {
      x0 = Math.max(x0, bbox.x0); x1 = Math.min(x1, bbox.x1); z0 = Math.max(z0, bbox.z0); z1 = Math.min(z1, bbox.z1);
      let t = -Infinity;
      for (let ci = cx(x0) - 1, c1 = cx(x1) + 1; ci <= c1; ci++) for (let cj = cz(z0) - 1, d1 = cz(z1) + 1; cj <= d1; cj++) {
        const list = cells.get(ck(ci, cj)); if (!list) continue;
        for (let q = 0; q < list.length; q++) { const a = pts[list[q]], b = pts[list[q] + 1]; t = Math.max(t, a[2] || 0, b[2] || 0); }
      }
      return { t: t === -Infinity ? t : (abs ? 0 : y0) + t, add: 0 };
    };
    // THE SEGMENTS, FLAT (G611): each segment's start, direction, squared length and end heights in one
    // typed array, computed once with the very operations the scan did per query - the same numbers, no
    // nested-array reads and no closures in the solver's per-wheel, per-substep query
    const SG = new Float64Array(Math.max(0, pts.length - 1) * 7);
    for (let i = 0; i + 1 < pts.length; i++) {
      const a = pts[i], b = pts[i + 1], dx = b[0] - a[0], dz = b[1] - a[1], o = i * 7;
      SG[o] = a[0]; SG[o + 1] = a[1]; SG[o + 2] = dx; SG[o + 3] = dz; SG[o + 4] = dx * dx + dz * dz; SG[o + 5] = a[2] || 0; SG[o + 6] = b[2] || 0;
    }
    const bx0 = bbox.x0, bz0 = bbox.z0;
    // (G614) does any segment reach into the rectangle? - its reach cells (the scan's own lists)
    const touches = (x0, z0, x1, z1) => {
      for (let ci = cx(Math.max(x0, bbox.x0)), c1 = cx(Math.min(x1, bbox.x1)); ci <= c1; ci++)
        for (let cj = cz(Math.max(z0, bbox.z0)), d1 = cz(Math.min(z1, bbox.z1)); cj <= d1; cj++) if (cells.get(ck(ci, cj))) return true;
      return false;
    };
    return { id: m.id, kind: 'grade', bbox, bound, touches, feather: fall, apply: (x, z, h) => {
      if (x < bbox.x0 || x > bbox.x1 || z < bbox.z0 || z > bbox.z1 || pts.length < 2) return h;
      const list = cells.get((Math.floor((x - bx0) / CS) + 1) * NZ + (Math.floor((z - bz0) / CS) + 1));
      if (!list) return h;
      // (PHYSICS PERF 2026-09-24) the plain squared distance screens a segment that cannot beat the best
      // (1e-9 relative over it - the two roundings differ by 1e-16); every one that can is measured
      // exactly as before, in the list's order, so the winner and its tie-break are the same
      let best = Infinity, best2 = Infinity, ty = 0;
      for (let n = 0; n < list.length; n++) {
        const o = list[n] * 7, ax = SG[o], az = SG[o + 1], dx = SG[o + 2], dz = SG[o + 3], l2 = SG[o + 4];
        const t = l2 > 1e-12 ? Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / l2)) : 0;
        const ex = x - (ax + dx * t), ez = z - (az + dz * t);
        if (ex * ex + ez * ez > best2) continue;
        const d = HYP2(ex, ez);
        if (d < best) { best = d; best2 = d * d * (1 + 1e-9); ty = SG[o + 5] + (SG[o + 6] - SG[o + 5]) * t; }
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
  // a number, not a string (2026-09-24: the composed ground asks this per height query); unique while |j| < 2^16 cells
  const key = (i, j) => (j < 65536 && j > -65536) ? i * 131072 + j : i + ',' + j;
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
    // (G2917) one item over many boxes - a long road by its segments: each cell holds it once, in the order it was added
    addMany(boxes, item) {
      const seen = new Set();
      for (const bbox of boxes) {
        const i0 = Math.floor(bbox.x0 / C), i1 = Math.floor(bbox.x1 / C), j0 = Math.floor(bbox.z0 / C), j1 = Math.floor(bbox.z1 / C);
        for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
          const k = key(i, j); if (seen.has(k)) continue; seen.add(k);
          let a = cells.get(k); if (!a) { a = []; cells.set(k, a); } a.push(item);
        }
      }
    },
    query(x, z) { return cells.get(key(Math.floor(x / C), Math.floor(z / C))) || null; },
    // every item filed in a cell the rectangle touches (an item in two cells comes twice)
    rect(x0, z0, x1, z1, fn) {
      const i0 = Math.floor(x0 / C), i1 = Math.floor(x1 / C), j0 = Math.floor(z0 / C), j1 = Math.floor(z1 / C);
      for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) { const a = cells.get(key(i, j)); if (a) for (let n = 0; n < a.length; n++) fn(a[n]); }
    },
    size: () => cells.size,
  };
}

// THE COOKED RASTER'S BYTES (G835): one 256 m cell of G614's A / B tiles as tools/premises_cook.js writes it (the
// file is one gzip stream; this is what is inside):
//   'FDGR' | u8 version 1 | u8 0 x 3 | u32 tiles | u32 nodes
//   | per tile 24 B: i32 i, i32 j, u8 n, u8 flags, u16 0, u32 first node, f64 b0
//   | 8 byte planes of `nodes` bytes each: the u residuals' bytes 0-3, then the k residuals' bytes 0-3
// A tile's (n + 1)^2 nodes, from its first: u = round((1 - A) 2^24) and k = round((B - b0) 2^15), each stored as its
// residual off the 2-D predictor (left + up - up-left), zigzagged (byte planes: the high bytes are all but empty,
// which is what the gzip is for). Decoded: A = 1 - u 2^-24 (0 and 1 exact), B = b0 + k 2^-15 (b0 exact: the tile's
// commonest level under A = 0, its pad), and B = 0 exactly where A = 1 when flags bit 0 says every such node had it
// (the ground itself).
const GRQ_A = 16777216, GRQ_B = 32768;
function rasterCellIndex(u8) {
  const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  if (!(u8.length >= 16 && u8[0] === 70 && u8[1] === 68 && u8[2] === 71 && u8[3] === 82 && u8[4] === 1)) throw new Error('premises: not a cooked raster cell (FDGR v1)');
  const n = dv.getUint32(8, true), nodes = dv.getUint32(12, true), base = 16 + 24 * n, at = new Map();
  if (u8.length !== base + 8 * nodes) throw new Error('premises: a cooked raster cell of the wrong length');
  for (let t = 0; t < n; t++) {
    const o = 16 + t * 24, i = dv.getInt32(o, true), j = dv.getInt32(o + 4, true);
    at.set(i * 131072 + j, { i, j, n: u8[o + 8], flags: u8[o + 9], first: dv.getUint32(o + 12, true), b0: dv.getFloat64(o + 16, true) });
  }
  return { u8, at, tiles: n, nodes, base };
}
function rasterTileDecode(C, e) {
  const u8 = C.u8, n = e.n, N = n + 1, NN = N * N, A = new Float64Array(NN), B = new Float64Array(NN), qu = new Int32Array(NN), qk = new Int32Array(NN);
  const plane = (q, p0) => {
    const b0 = C.base + p0 * C.nodes + e.first, b1 = b0 + C.nodes, b2 = b1 + C.nodes, b3 = b2 + C.nodes;
    for (let j = 0, k = 0; j < N; j++) for (let i = 0; i < N; i++, k++) {
      const v = (u8[b0 + k] | (u8[b1 + k] << 8) | (u8[b2 + k] << 16) | (u8[b3 + k] << 24)) >>> 0;
      q[k] = ((v & 1) ? -(v + 1) / 2 : v / 2) + (i && j ? q[k - 1] + q[k - N] - q[k - N - 1] : i ? q[k - 1] : j ? q[k - N] : 0);
    }
  };
  plane(qu, 0); plane(qk, 4);
  const a1b0 = e.flags & 1;
  for (let k = 0; k < NN; k++) { A[k] = 1 - qu[k] / GRQ_A; B[k] = (a1b0 && qu[k] === 0) ? 0 : (qk[k] === 0 ? e.b0 : e.b0 + qk[k] / GRQ_B); }
  return { x0: e.i * 16, z0: e.j * 16, r: 16 / n, n, N, A, B, k: e.i * 131072 + e.j, lp: null, ln: null };   // (k, lp, ln: the page's tile cache, G735)
}

// ---------------------------------------------------------------------------
// the record
// ---------------------------------------------------------------------------
function DEF() {
  return { v: PREMISES_V, id: 'premises', name: '', seed: 1, theme: THEME_DEF,
           frame: { kind: 'free', extent: null, anchors: {} },
           layers: { terrain: [], surface: [], material: [], exclude: [], roads: [], runways: [], zones: [], sites: [], links: [], objects: [], ttype: [], areas: [], junctions: [] },
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
  // v1.35: a round pad's polygon is its circle's, whatever the file says (a hand edit of `round` re-draws it)
  for (const m of r.layers.material) if (m && roundOk(m.round)) m.poly = roundPoly(m.round);
  // v1.36: an area's shape - a round's or a rounded rectangle's polygon is its own; every area has its props
  for (const a of r.layers.areas) if (a) { if (roundOk(a.round)) a.poly = roundPoly(a.round); else if (rectOk(a.rect)) a.poly = rectPoly(a.rect); if (!a.props || typeof a.props !== 'object') a.props = {}; }
  // v1.35: a spline road's handles run beside its points, one slot each
  for (const rd of r.layers.roads) if (rd && Array.isArray(rd.tan) && Array.isArray(rd.pts)) { while (rd.tan.length < rd.pts.length) rd.tan.push(null); rd.tan.length = rd.pts.length; }
  // v1.37: a road's junction ids run beside its points too, one slot each (a hand edit's short list padded with null)
  for (const rd of r.layers.roads) if (rd && Array.isArray(rd.nodes) && Array.isArray(rd.pts)) { while (rd.nodes.length < rd.pts.length) rd.nodes.push(null); rd.nodes.length = rd.pts.length; }
  r.budget =Object.assign({}, d.budget, r.budget || {});
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
// A PLACE SWITCHED OFF (G590, the 2026-09-26 playtest: Metlakatla - 375 plots, 65 site items, 62 roads - held
// the Jolene taxi at 12-15 fps; the user: off by default behind a switch, code and data kept). A place is its id
// PREFIX in every layer (the authoring tools write one per part: mk_ Metlakatla, mn_ the mine, nv_ the native
// village, tw_ the tramway, af_ the airfield). dropPlaces returns a COPY without them and what it cut, by layer;
// restorePlaces puts the cut back into a record that was edited without them (an entry the edit re-used the id
// of is the edit's) - so a save made with the place off never deletes it.
const placeOf = (e, prefixes) => !!(e && typeof e.id === 'string' && prefixes.some(p => e.id.startsWith(p)));
function dropPlaces(rec, prefixes) {
  const out = Object.assign({}, rec, { layers: Object.assign({}, rec.layers) }), cut = {};
  let n = 0;
  for (const k of Object.keys(out.layers)) {
    const a = out.layers[k]; if (!Array.isArray(a)) continue;
    const keep = [], gone = [];
    for (const e of a) (placeOf(e, prefixes) ? gone : keep).push(e);
    if (gone.length) { out.layers[k] = keep; cut[k] = gone; n += gone.length; }
  }
  return { rec: out, cut, n };
}
function restorePlaces(rec, cut) {
  if (!cut) return rec;
  const out = Object.assign({}, rec, { layers: Object.assign({}, rec.layers) });
  for (const k of Object.keys(cut)) {
    const a = (out.layers[k] || []).slice(), have = new Set(a.map(e => e && e.id));
    for (const e of cut[k]) if (!have.has(e.id)) a.push(e);
    out.layers[k] = a;
  }
  return out;
}
// ---- STAGES (contract v1.33, G2300 STAGES; GAME-2026-10-06.md §11) ---------------------------------------------------
// THE BUILDINGS THAT MISSIONS PUT UP. Any entry of any layer, and any ITEM of a site, may carry
//   stage: { track: 'minedock', show: [lo, hi | null], vary: [ { show: [lo, hi], ...what changes } ] }
// and stands only while the career's world progress `tracks[track]` (a small integer, 74_career.js, advanced by a
// contract's `unlock: { stage: '<track>:<n>' }`) lies in [lo, hi]; hi null (or absent) = no upper bound. `vary` (the
// first band holding the value) changes the entry while it stands: a RUNWAY's len / c / surface / look / profile / wid
// (its ground and its surface - physics, so a stage applies at composition only, never in flight: 76_stages.js), its
// `sock` / `ties` (false: no windsock, no tie-down spots); an item's or an object's P (merged).
// A CONSTRUCTION KIT is an object { kind: 'kit', kit: <STAGE_KITS name>, x, z, yaw, w, d } - data: it expands, where it
// stands, into the kit's props (the existing props: a fence round the plot, pallets, crates, drums, trestles) and, when
// the kit names one, a partial frame built by an existing generator; its own tree exclude over the plot.
// THE SANDBOX IS EVERY TRACK AT ITS MAX: `tracks` null, every value +Infinity - what stands is what has no upper bound,
// with the `stage` fields taken off, so the sandbox's record is TODAY'S, byte for byte (GATE STAGES holds it against
// the island cook's recorded hash). A career's record is stageView(rec, career.tracks): the page composes it at load
// (world_boot.js) and recomposes it at a roll-out / roll-in when a stage advanced (app.js; never in flight).
const STAGE_RUNWAY_VARY = ['len', 'c', 'wid', 'surface', 'look', 'profile', 'sock', 'ties'];
const STAGE_KITS = {
  // the fenced plot alone: the old fence round it, a gate gap, a pallet by the gate
  plot:  { fence: true, props: [['pallet_one', 0.12, 0.85, 0.3]] },
  // the building site: the plot fenced, the materials stacked, the trestles, the drums, and a frame going up
  build: { fence: true, frame: { gen: 'SHED_GEN', preset: 'lean-to', P: { L: 9, w: 5, wallH: 3.2, missing: 0.35, openFront: 1, firewood: 0, shake: 0.6 }, at: [-0.18, 0.1, 0] },
           props: [['pallets_stack', 0.32, -0.3, 0.2], ['pallets_three', 0.32, -0.05, 1.4], ['cement_bags', 0.3, 0.22, 0.6], ['cinder_pallet', 0.12, -0.36, 0],
                   ['crate_wood_a', 0.05, 0.36, 0.3], ['crate_wood_b', 0.1, 0.38, 1.1], ['crate_wood_c', 0.18, 0.36, -0.2],
                   ['drum_steel', -0.38, 0.34, 0], ['drum_steel', -0.33, 0.37, 0.8], ['barrel_plastic', -0.36, 0.28, 0.2],
                   ['work_trestle', 0.02, -0.12, 1.57], ['work_trestle', 0.12, -0.12, 1.57], ['stepladder', -0.05, 0.12, 0.4], ['handtruck', 0.22, 0.12, 2.1]] },
  // the dock's site: the plot fenced on the shore, the timbers and the drums for a pier
  shore: { fence: true, props: [['pallets_stack', -0.3, -0.25, 0.1], ['pallets_three', -0.05, -0.3, 1.2], ['drum_steel', 0.3, 0.3, 0], ['drum_steel', 0.34, 0.24, 0.9],
                                ['barrel_plastic', 0.26, 0.34, 0.3], ['work_trestle', 0, 0.1, 0], ['work_trestle', 0.1, 0.1, 0], ['crate_wood_c', -0.3, 0.3, 0.3], ['cement_bags', 0.32, -0.3, 0.5]] },
};
const STAGE_FENCE = { key: 'fence_old', len: 4.6, gate: 0.5 };   // the pier pack's old fence (4.6 m a stretch); the gate: half a side's middle stretch left open
const stageBand = s => { const b = s && Array.isArray(s.show) ? s.show : [0, null]; return [+b[0] || 0, b[1] === null || b[1] === undefined ? null : +b[1]]; };
const stageValue = (tracks, t) => (tracks && typeof tracks === 'object' && isFinite(+tracks[t]) && tracks[t] !== null && tracks[t] !== '' ? +tracks[t] : Infinity);
const stageIn = (band, v) => v >= band[0] && (band[1] === null || v <= band[1]);
function stageStands(st, tracks) { return !st || stageIn(stageBand(st), stageValue(tracks, st.track)); }
function stageVaryOf(st, tracks) {
  if (!st || !Array.isArray(st.vary)) return null;
  const v = stageValue(tracks, st.track);
  for (const q of st.vary) if (q && stageIn(stageBand(q), v)) return q;
  return null;
}
// a kit's props and frame, in the record's frame, ids `<kit id>:<n>` (seeded per kit: the same record, the same kit)
function stageKitObjects(k) {
  const K = STAGE_KITS[k.kit]; if (!K) return [];
  const w = +k.w || 24, d = +k.d || 18, yaw = +k.yaw || 0, c = Math.cos(yaw), s = Math.sin(yaw);
  // local (u across w, v across d) -> the record's frame, the placement law of an item in its site (x = u c + v s, z = -u s + v c)
  const at = (u, v) => [+(+k.x + u * c + v * s).toFixed(3), +(+k.z - u * s + v * c).toFixed(3)];
  const rnd = mulberry32(hash32(7, fnv('kit:' + k.id))), out = [];
  let n = 0;
  const put = (key, u, v, ry, extra) => { const p = at(u, v); out.push(Object.assign({ id: k.id + ':' + (n++), kind: 'prop', key, x: p[0], z: p[1], yaw: +(yaw + ry).toFixed(4) }, extra || {})); };
  if (K.fence && k.fence !== false) {
    const sides = [[[-w / 2, -d / 2], [w / 2, -d / 2]], [[w / 2, -d / 2], [w / 2, d / 2]], [[w / 2, d / 2], [-w / 2, d / 2]], [[-w / 2, d / 2], [-w / 2, -d / 2]]];
    sides.forEach((sd, si) => {
      const L = Math.hypot(sd[1][0] - sd[0][0], sd[1][1] - sd[0][1]), m = Math.max(1, Math.round(L / STAGE_FENCE.len)), a = Math.atan2(-(sd[1][1] - sd[0][1]), sd[1][0] - sd[0][0]);
      for (let i = 0; i < m; i++) {
        if (si === 0 && m >= 3 && i === Math.floor(m / 2)) continue;   // the gate: the front side's middle stretch
        const t = (i + 0.5) / m;
        put(STAGE_FENCE.key, sd[0][0] + (sd[1][0] - sd[0][0]) * t, sd[0][1] + (sd[1][1] - sd[0][1]) * t, a + (rnd() - 0.5) * 0.06);
      }
    });
  }
  for (const p of K.props) put(p[0], p[1] * w, p[2] * d, p[3] + (rnd() - 0.5) * 0.3);
  if (K.frame && k.frame !== false) {   // the frame fits the plot: at most 0.6 of its width and 0.45 of its depth
    const p = at(K.frame.at[0] * w, K.frame.at[1] * d), P = Object.assign({ seed: 1 + (hash32(3, fnv(k.id)) % 997) }, K.frame.P);
    P.L = +Math.max(1.6, Math.min(P.L, 0.6 * w)).toFixed(2); P.w = +Math.max(1.2, Math.min(P.w, 0.45 * d)).toFixed(2);
    out.push({ id: k.id + ':frame', key: stageFrameKey(K.frame), x: p[0], z: p[1], yaw: +(yaw + K.frame.at[2]).toFixed(4), y: null, P });
  }
  return out;
}
// a kit's frame by its generator and preset (the catalogue's key, GEN_NS's namespace: no key is written here - rule 13)
const stageFrameKey = f => (f.gen && GEN_NS[f.gen] ? GEN_NS[f.gen] + '/' + f.preset : f.key || null);
// the kit's plot as a polygon (the tree exclude while it stands)
function stageKitPoly(k) {
  const w = (+k.w || 24) / 2 + 2, d = (+k.d || 18) / 2 + 2, yaw = +k.yaw || 0, c = Math.cos(yaw), s = Math.sin(yaw);
  return [[-w, -d], [w, -d], [w, d], [-w, d]].map(q => [+(+k.x + q[0] * c + q[1] * s).toFixed(3), +(+k.z - q[0] * s + q[1] * c).toFixed(3)]);
}
// a COPY of the record as it stands at `tracks` (null: the sandbox), and what was cut / changed, so an edit made on the
// staged record can be put back into the whole one (stageRestore). `n`: entries cut or expanded; `staged`: the record
// carried any stage at all
function stageView(rec, tracks) {
  const out = Object.assign({}, rec, { layers: Object.assign({}, rec.layers) });
  const cut = {}, kept = {}, varied = {}, kits = {};
  let n = 0, staged = false;
  const strip = (e, where) => {
    staged = true;
    const c = Object.assign({}, e); delete c.stage;
    kept[where] = e.stage;
    const q = stageVaryOf(e.stage, tracks);
    if (q) {
      const ch = {};
      for (const key of Object.keys(q)) {
        if (key === 'show') continue;
        if (key === 'P') { ch.P = c.P; c.P = Object.assign({}, c.P || {}, q.P); continue; }
        ch[key] = c[key]; c[key] = q[key];
      }
      varied[where] = { was: ch, now: q };
    }
    return c;
  };
  for (const L of Object.keys(out.layers)) {
    const a = out.layers[L]; if (!Array.isArray(a)) continue;
    if (!a.some(e => e && (e.stage || (L === 'sites' && (e.items || []).some(it => it && it.stage)) || (L === 'objects' && e.kind === 'kit')))) continue;
    const keep = [];
    for (const e of a) {
      if (!e) { keep.push(e); continue; }
      // a ZONE below its band still SOWS - its land stays reserved, so a later zone never re-sows into it and the
      // village beside the harbour stands the same plots at every stage - and builds nothing (compose drops its plots
      // after the sowing, their ground kept clear of trees)
      if (e.stage && L === 'zones' && !stageStands(e.stage, tracks)) { const z = strip(e, L + ':' + e.id); z.stageSown = true; keep.push(z); n++; continue; }
      if (e.stage && !stageStands(e.stage, tracks)) { (cut[L] = cut[L] || []).push(e); n++; staged = true; continue; }
      let c = e.stage ? strip(e, L + ':' + e.id) : e;
      if (L === 'sites' && (c.items || []).some(it => it && it.stage)) {
        const items = [];
        for (const it of c.items) {
          if (it && it.stage && !stageStands(it.stage, tracks)) { (cut['items:' + c.id] = cut['items:' + c.id] || []).push(it); n++; staged = true; continue; }
          items.push(it && it.stage ? strip(it, 'items:' + c.id + ':' + it.id) : it);
        }
        c = Object.assign({}, c, { items });
      }
      if (L === 'objects' && c.kind === 'kit') {   // a kit that stands expands into its props, its frame and its exclude
        staged = true; kits[c.id] = c; n++;
        for (const o of stageKitObjects(c)) keep.push(o);
        out.layers.exclude = (out.layers.exclude || []).concat([{ id: c.id + ':clear', poly: stageKitPoly(c), what: ['trees'] }]);
        continue;
      }
      keep.push(c);
    }
    out.layers[L] = keep;
  }
  return { rec: out, n, staged, cut, kept, varied, kits, tracks: tracks || null, whole: rec };
}
// put a staged record's edit back into the whole record: the cut entries and items return, the kept entries get their
// `stage` back, a varied field the edit did not touch returns to its whole-record value, the kits' expansions go (an
// expanded id is `<kit id>:<n>` / `:frame` / `:clear`) and the kits return. Undefined in the editor's stage UI (later):
// this is what keeps a save made on a career's page from deleting a stage
function stageRestore(edited, V) {
  if (!V || !V.staged || !V.whole) return edited;
  const W = V.whole, out = Object.assign({}, edited, { layers: Object.assign({}, edited.layers) });
  const kitOf = id => { const m = /^(.+):(\d+|frame|clear)$/.exec(String(id)); return m && V.kits[m[1]] ? m[1] : null; };
  const back = (e, where) => {
    const st = V.kept[where]; if (!st) return e;
    const c = Object.assign({}, e); delete c.stage; delete c.stageSown; c.stage = st;   // (the key last, as the author writes it)
    const vr = V.varied[where];
    if (vr) for (const key of Object.keys(vr.was)) {
      if (key === 'P') { const P = Object.assign({}, c.P || {}); for (const pk of Object.keys(vr.now.P || {})) if (JSON.stringify(P[pk]) === JSON.stringify(vr.now.P[pk])) { if (vr.was.P && pk in vr.was.P) P[pk] = vr.was.P[pk]; else delete P[pk]; } c.P = P; continue; }
      if (JSON.stringify(c[key]) === JSON.stringify(vr.now[key])) { if (vr.was[key] === undefined) delete c[key]; else c[key] = vr.was[key]; }
    }
    return c;
  };
  // in the WHOLE record's order: a cut entry (or a kit) from the whole, an edited one from the edit (its stage back), one
  // the edit deleted gone; then whatever the edit added
  const merge = (whole, edit, cutList, whereOf, isKit) => {
    const cut = new Set((cutList || []).map(e => e.id)), byId = new Map();
    for (const e of edit || []) if (e && e.id !== undefined && !kitOf(e.id)) byId.set(e.id, e);
    const res = [], used = new Set();
    for (const e of whole || []) {
      if (!e || e.id === undefined) { res.push(e); continue; }
      if (cut.has(e.id) || (isKit && isKit(e))) { res.push(e); used.add(e.id); continue; }
      if (byId.has(e.id)) { res.push(back(byId.get(e.id), whereOf(e))); used.add(e.id); }
    }
    for (const e of edit || []) if (e && (e.id === undefined || !kitOf(e.id)) && !used.has(e.id) && !(e.id !== undefined && cut.has(e.id))) res.push(e);
    return res;
  };
  for (const L of Object.keys(out.layers)) {
    if (!Array.isArray(out.layers[L])) continue;
    let res = merge(W.layers[L], out.layers[L], V.cut[L], e => L + ':' + e.id, L === 'objects' ? (e => e.kind === 'kit') : null);
    if (L === 'sites') res = res.map(st => {
      const ws = (W.layers.sites || []).find(q => q.id === st.id);
      if (!ws || !Array.isArray(st.items) || !(V.cut['items:' + st.id] || (ws.items || []).some(it => it && it.stage))) return st;
      return Object.assign({}, st, { items: merge(ws.items, st.items, V.cut['items:' + st.id], it => 'items:' + st.id + ':' + it.id, null) });
    });
    out.layers[L] = res;
  }
  return out;
}
// the shape of every `stage` (issues() reports these): a known track word, an integer band, vary bands inside the
// stage's own band, a runway varying only its own fields, a kit naming a kit; `maxes` (optional, { track: max }:
// 72_contract_data.js CONTRACT_TRACKS) adds the sandbox's law - a band is open above or ends BELOW the track's max, so
// every track at its max IS the sandbox (no element the sandbox lacks stands at max)
function stageIssues(rec0, maxes) {
  const rec = rec0 && rec0.layers ? rec0 : normalise(rec0), out = [];
  const band = (what, b) => {
    if (!Array.isArray(b) || b.length !== 2) { out.push(what + ': show is [lo, hi | null]'); return null; }
    if (!(Number.isInteger(b[0]) && b[0] >= 0)) out.push(what + ': show[0] is an integer 0 or more');
    if (!(b[1] === null || (Number.isInteger(b[1]) && b[1] >= b[0]))) out.push(what + ': show[1] is null or an integer >= show[0]');
    return b;
  };
  const one = (what, st, kind, e) => {
    if (!st || typeof st !== 'object') { out.push(what + ': stage is { track, show, vary? }'); return; }
    if (typeof st.track !== 'string' || !/^\w+$/.test(st.track)) out.push(what + ': stage.track is a word');
    const b = st.show === undefined ? [0, null] : band(what, st.show);
    const mx = maxes && st.track in maxes ? +maxes[st.track] : null;
    if (maxes && mx === null) out.push(what + ': no track "' + st.track + '"');
    if (b && mx !== null) {
      if (b[0] > mx) out.push(what + ': show starts at ' + b[0] + ', past ' + st.track + '\'s max ' + mx);
      if (b[1] !== null && b[1] >= mx) out.push(what + ': show ends at ' + b[1] + ' - a band through the max (' + mx + ') must be open (null), or the sandbox and the max differ');
    }
    if (st.vary !== undefined) {
      if (!Array.isArray(st.vary)) { out.push(what + ': vary is a list'); return; }
      st.vary.forEach((q, i) => {
        const vb = q && band(what + ' vary[' + i + ']', q.show);
        if (vb && b && (vb[0] < b[0] || (b[1] !== null && (vb[1] === null || vb[1] > b[1])))) out.push(what + ' vary[' + i + ']: outside the stage\'s own band');
        if (vb && mx !== null && (vb[1] === null || vb[1] >= mx)) out.push(what + ' vary[' + i + ']: a change at the max is the sandbox\'s, not a stage\'s');
        for (const key of Object.keys(q || {})) {
          if (key === 'show') continue;
          if (kind === 'runway' ? STAGE_RUNWAY_VARY.indexOf(key) < 0 : key !== 'P') out.push(what + ' vary[' + i + ']: ' + key + ' is not a ' + (kind === 'runway' ? 'runway field a stage may change' : 'P'));
        }
        // a varied strip is still a strip: 150 m, 8 m wide, its profile inside the pilot's (or the altiport's) limits
        if (kind === 'runway' && e && q) {
          const r = Object.assign({}, RUNWAY_DEF, e, q); delete r.stage; delete r.show;
          if (!(r.len >= 150) || !(r.wid >= 8)) out.push(what + ' vary[' + i + ']: a strip is at least 150 m by 8 m');
          else for (const pi of profileIssues(r)) out.push(what + ' vary[' + i + ']: ' + pi);
        }
      });
    }
  };
  for (const L of LAYERS) for (const e of rec.layers[L] || []) {
    if (!e) continue;
    if (e.stage !== undefined) one(L + ' ' + e.id, e.stage, L === 'runways' ? 'runway' : 'P', e);
    if (L === 'objects' && e.kind === 'kit') { if (!STAGE_KITS[e.kit]) out.push('kit ' + e.id + ': unknown kit ' + e.kit); if (!e.stage) out.push('kit ' + e.id + ': a construction kit stands only at a stage'); }
    if (L === 'sites') for (const it of e.items || []) if (it && it.stage !== undefined) one('site ' + e.id + ' item ' + it.id, it.stage, 'P');
  }
  // a link names its two items: a staged item would leave it dangling
  const stagedItems = new Set();
  for (const st of rec.layers.sites || []) { if (st.stage) for (const it of st.items || []) stagedItems.add(st.id + '/' + it.id); for (const it of st.items || []) if (it && it.stage) stagedItems.add(st.id + '/' + it.id); }
  for (const L of rec.layers.links || []) for (const end of [L.from, L.to]) if (end && stagedItems.has(end.site + '/' + end.item) && !L.stage) out.push('link ' + L.id + ': names the staged item ' + end.site + '/' + end.item + ' and carries no stage');
  return out;
}
const ID_PREFIX = { terrain: 't', surface: 'y', material: 'm', exclude: 'x', roads: 'r', runways: 'w', zones: 'z', sites: 's', links: 'l', objects: 'o', ttype: 'k', areas: 'a', junctions: 'j' };
function newId(rec, layer) {
  // (v1.36: every id of the record, an area's v1 ids too - a migrated area keeps its surface's 'y1', and a new
  // surface must not take it again)
  const used = new Set();
  for (const k of LAYERS) for (const e of rec.layers[k] || []) if (e) { used.add(e.id); if (k === 'areas') for (const q of areaEntries(e)) used.add(q.entry.id); }
  for (let i = 1; ; i++) { const id = (ID_PREFIX[layer] || layer[0]) + i; if (!used.has(id)) return id; }
}
function findById(rec, id) {
  for (const k of LAYERS) { const e = (rec.layers[k] || []).find(e => e.id === id); if (e) return { layer: k, entry: e }; }
  return null;
}

// THE WATER A ZONE SEES (G434 / G434.1, compose's rule, exported at C3c G861): the LOWEST finite water over the zone's
// own box +- 60 m, 13 x 13 samples; `fallback` (compose: the anchor's water) where none is found. The town kit's
// sowing (tools/town_kit.js zoneWater) and the kit's lots (src/viewer/kit_lot.js) read the same rule
function zoneWaterYOf(world, F, z, fallback) {
  if (!world || !world.waterH || !z || !z.poly || z.poly.length < 3) return fallback;
  const bb = polyBBox(z.poly); let best = Infinity;
  for (let i = 0; i <= 12; i++) for (let j = 0; j <= 12; j++) { const w = F.toWorld(bb.x0 - 60 + (bb.x1 - bb.x0 + 120) * i / 12, bb.z0 - 60 + (bb.z1 - bb.z0 + 120) * j / 12); const v = world.waterH(w[0], w[1]); if (isFinite(v) && v < best) best = v; }
  return isFinite(best) ? best : fallback;
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
  // c, s: toLocal's own rotation, for a reader that must not allocate (the height query, G611)
  return { anchor: a, toWorld, toLocal, y0, worldId: wid, yaw: a.yaw || 0, c, s };
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
  // G2063 (TOWN-GEO): A PLOT WHOSE BOX IS CLEAR OF THE CANDIDATE'S CANNOT OVERLAP IT - polysOverlap asks only whether a corner
  // of one is inside the other, and a point outside a polygon's box is outside the polygon - so the test walks the plots
  // whose boxes meet (the record's 500 at Metlakatla, every candidate and every pull of its back: 0.6 s of a composition).
  // The same answer; no concatenation per candidate either
  const pbox = new Map(), boxOf = poly => { let b = pbox.get(poly); if (b) return b; let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
    for (const c of poly) { if (c[0] < x0) x0 = c[0]; if (c[0] > x1) x1 = c[0]; if (c[1] < z0) z0 = c[1]; if (c[1] > z1) z1 = c[1]; } pbox.set(poly, b = [x0, z0, x1, z1]); return b; };
  const apart = (a, b) => a[2] < b[0] || b[2] < a[0] || a[3] < b[1] || b[3] < a[1];   // (a NaN box is never apart)
  const overlapsAny = q => { const qb = boxOf(q);
    for (const L of [ctx.plots, plots]) for (const p of L) if (!apart(boxOf(p.poly), qb) && polysOverlap(p.poly, q)) return true;
    return false; };
  const rejectAt = (x, z) => !inPoly(zone.poly, x, z) || ctx.excludes.some(p => inPoly(p, x, z)) || (ctx.keepOut || []).some(p => inPoly(p, x, z));
  // A PLOT MAY NOT LIE ON A ROAD THAT IS NOT ITS OWN (2026-09-23, the user, of three
  // houses in the carriageway: "Some houses are drawn over the roads. Not what we
  // want..."). The sower cut a plot against the road it FRONTS and against nothing
  // else, so a plot at a junction ran its side or its back into the crossing street:
  // at Metlakatla 166 of 510 plots overlapped another road, up to 3.1 m inside the
  // carriageway, and a house stands where its plot is. The margin is half a metre
  // over the kerb - a garden may touch the road it fronts and may not touch another.
  // Each road's fillet is made once and boxed (2026-09-24: this test re-filleted and
  // 2 m-sampled every road of the record for every candidate plot, 2.7 s a compose at
  // Metlakatla): a plot whose box stays clear of a road's box grown by `half` has no
  // corner within `half` of it and no sample of it inside, so the road is skipped
  // with the answer the two tests would have given.
  const boxed = roads.map(rd => {
    const pr = polyRoad(rd.pts, rd.w || 3.6), half = (rd.w || 3.6) / 2 + 0.5;
    let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
    for (const p of rd.pts.concat(pr.pts)) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); z0 = Math.min(z0, p[1]); z1 = Math.max(z1, p[1]); }
    const m = half + 1e-3;
    return { rd, pr, half, x0: x0 - m, z0: z0 - m, x1: x1 + m, z1: z1 + m };
  });
  const onOtherRoad = (q, own) => {
    let qx0 = Infinity, qz0 = Infinity, qx1 = -Infinity, qz1 = -Infinity;
    for (const c of q) { qx0 = Math.min(qx0, c[0]); qx1 = Math.max(qx1, c[0]); qz0 = Math.min(qz0, c[1]); qz1 = Math.max(qz1, c[1]); }
    for (const B of boxed) {
      const rd = B.rd;
      if (rd.id === own) continue;
      if (qx1 < B.x0 || qx0 > B.x1 || qz1 < B.z0 || qz0 > B.z1) continue;
      if (q.some(c => roadDist(rd, c[0], c[1]) < B.half)) return true;
      if (roadInPoly(B.pr, q).length) return true;   // it runs THROUGH the plot
    }
    return false;
  };
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
            ok = !overlapsAny(q) && !q.some(c => rejectAt(c[0], c[1])) && !onOtherRoad(q, road.id);
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
  // A PALETTE ENTRY MAY NAME A COLLECTION, not only a subject. A tree's key is
  // `<collection>|<subject>` and an author has no way to know the subject names, so
  // 'spruce_tree.glb' selects every spruce in the pack. An exact key still matches.
  const pool = (zone.palette && zone.palette.length
    ? ctx.pool.filter(p => zone.palette.some(k => p.key === k || String(p.key).indexOf(k + '|') === 0))
    : ctx.pool);
  const list = pool.length ? pool : [{ key: 'stub|tree', size: 1, sink: 0, proportion: 1, h: 12 }];
  const zoneSeed = zone.seed !== null && zone.seed !== undefined ? zone.seed : seedOf(ctx.seed, 'zone', zone.id);
  const rnd = mulberry32(zoneSeed);
  const draw = () => { const tot = list.reduce((s, p) => s + (p.proportion || 1), 0); let r = rnd() * tot; for (const p of list) { r -= (p.proportion || 1); if (r <= 0) return p; } return list[list.length - 1]; };
  // G2063 (TOWN-GEO): THE THREE TESTS, CULLED, THE SAME ANSWERS. A road whose box (its points') lies farther than its half
  // width + `r` cannot come within `r` of its edge; a plot whose box lies 1.5 m clear cannot have the point within 1.5 m;
  // a tree farther than two grid cells (a cell is the spacing m) is farther than m. Each walked every road, plot and tree
  // of the record for every candidate (Metlakatla: 0.45 s of a composition). A NaN keeps the old answers: a road's NaN
  // distance made the min NaN (no road near), a tree at NaN is never clear of
  const RB = ctx.roads.map(r => { let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity; for (const q of r.pts || []) { if (q[0] < x0) x0 = q[0]; if (q[0] > x1) x1 = q[0]; if (q[1] < z0) z0 = q[1]; if (q[1] > z1) z1 = q[1]; } return { r, hw: (r.w || 3.6) / 2, b: [x0, z0, x1, z1] }; });
  const farBox = (b, x, z, r) => Math.max(b[0] - x, x - b[2], b[1] - z, z - b[3]) > r + 1e-3;   // (NaN: never far)
  const roadWithin = (x, z, r) => { let near = false; for (const R of RB) { if (farBox(R.b, x, z, R.hw + r)) continue; const d = roadDist(R.r, x, z) - R.hw; if (d !== d) return false; if (d < r) near = true; } return near; };
  const PB = ctx.plots.map(p => { let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity; for (const q of p.poly) { if (q[0] < x0) x0 = q[0]; if (q[0] > x1) x1 = q[0]; if (q[1] < z0) z0 = q[1]; if (q[1] > z1) z1 = q[1]; } return { p, b: [x0, z0, x1, z1] }; });
  const plotWithin = (x, z, r) => PB.some(P => !farBox(P.b, x, z, r) && sdPoly(P.p.poly, x, z) < r);
  const trees = [];
  const GRID = new Map(), gridM = Math.min(3.2, step * 0.55), gk = (i, j) => i * 1048576 + j, odd = [];   // (the one m clearOf is asked with)
  const gridAdd = t => { if (!(isFinite(t.x) && isFinite(t.z))) { odd.push(t); return; } const k = gk(Math.floor(t.x / gridM), Math.floor(t.z / gridM)); let c = GRID.get(k); if (!c) GRID.set(k, c = []); c.push(t); };
  for (const t of ctx.trees) gridAdd(t);
  const clearOf = (x, z, m) => {
    if (m !== gridM || !(isFinite(x) && isFinite(z))) return trees.every(t => Math.hypot(t.x - x, t.z - z) >= m) && ctx.trees.every(t => Math.hypot(t.x - x, t.z - z) >= m);
    for (const t of odd) if (!(Math.hypot(t.x - x, t.z - z) >= m)) return false;
    const i0 = Math.floor(x / gridM), j0 = Math.floor(z / gridM);
    for (let i = i0 - 2; i <= i0 + 2; i++) for (let j = j0 - 2; j <= j0 + 2; j++) { const c = GRID.get(gk(i, j)); if (c) for (const t of c) if (!(Math.hypot(t.x - x, t.z - z) >= m)) return false; }
    return true;
  };
  const bb = polyBBox(zone.poly), s = zoneSeed % 1000 * 0.618 + 9;
  const clearing = zone.rules && zone.rules.clearings === false ? -1 : 0.38;
  for (let z = bb.z0 + 1; z < bb.z1; z += step) for (let x = bb.x0 + 1; x < bb.x1; x += step) {
    const px = x + (rnd() - 0.5) * step * 0.75, pz = z + (rnd() - 0.5) * step * 0.75;
    if (!inPoly(zone.poly, px, pz)) continue;
    if (fbm(px * 0.035 + 2.2, pz * 0.035 + 8.8, s, 3) < clearing) continue;
    if (ctx.T(px, pz) < ctx.waterY + 0.6) continue;
    if (roadWithin(px, pz, 3)) continue;
    if (plotWithin(px, pz, 1.5)) continue;
    if (ctx.excludes.some(p => inPoly(p, px, pz))) continue;
    if (!clearOf(px, pz, Math.min(3.2, step * 0.55))) continue;
    const p = draw();
    // `rules.size` scales the stand (2026-09-23, the user: "normal conifers from the
    // forest, just not too tall"): a MEDIUM canopy is the same species grown less.
    const sizeK = zone.rules && zone.rules.size !== undefined ? +zone.rules.size : 1;
    const size = (p.size || 1) * (0.82 + rnd() * 0.4) * sizeK;
    const tr = { x: px, z: pz, key: p.key, size, yaw: rnd() * Math.PI * 2, sink: p.sink || 0, h: (p.h || 12) * size / (p.size || 1), zone: zone.id };
    trees.push(tr); gridAdd(tr);
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
// THE TREES BY THE RUNWAYS (G1091, POLISH-2; the user: "just follow the map first ... You can do both, only the map,
// and the map + the gravel and approach fans, and I'll judge"). On Jolene's 13/31 the tree map (WorldCover's TREE
// cells, canopy >= 2.5 m) stands 2-14 m past the paved edge, and the game drew its first tree ~60 m out: five
// clearances stacked - the pavement's 40 m band + 6 m fade (coverAt's kill), the strip's box + 30 m (a derived
// exclude), the gravel shoulders (y_sh13_*, a derived exclude and a GRAVEL surface), the renderer's aerodrome box
// (wid/2 + 60, len/2 + 150) and the approach fans (x_fan*). THREE WAYS, one switch, the user picks:
//   'today' - as it was;
//   'map'   - the map everywhere but the paving itself: no tree on a pavement or its DRAWN side (a strip's, an
//             apron's and a taxiway's side fades over PAVE_SIDE; an ordinary road draws its band and fade, which is
//             what 'today' kills too), no strip box, no shoulders, no aerodrome box, no fans;
//   'mapx'  - 'map' with the gravel shoulders and the approach fans kept as explicit excludes.
// Only on a DATA ISLAND (the analytic world's premises keep 'today'). The page: ?rwytrees= or localStorage
// flydiy.rwytrees (the island loader sets window.FLYDIY_RWYTREES); node: FLYDIY_RWYTREES=; a compose may pass
// opts.rwyTrees. Default 'today' until the user has judged.
const RWY_TREES = ['today', 'map', 'mapx'];
const PAVE_SIDE = 1.8;    // a side-faded pavement's DRAWN side: the recipe's sideW 1.2 + edgeChip 0.6 (GATE PAVEMENT holds it)
const PAVE_SIDE_SOFT = 7.9;   // G1395: a soft / grass pavement's: the torn edge's reach, 3.05 x edgeSoft 2.6 (GATE PAVEMENT holds it)
// THE GRASS BESIDE AND ON THE RUNWAYS (GRASS-DENSE G2565; the user, 8 Oct: "I want grass on the runway sides if the material says
// it does. And short grass on the grass runway"). coverAt's full query (the tufts' - never the `pave` half the rocks, the debris
// and the trees read, so nothing but the grass moves) answers by one of two LAWS:
//   'today' - as it was: kill 1 on the pavement and its whole band, the 6 m fade, the verge's bump; a grass strip's surface bare
//             (G665), a grass road / polygon thinned to 40 %;
//   'sides' - the grass follows what is DRAWN beside an aerodrome's pavement (a strip, a paved polygon, a taxiway): bare on the
//             pavement and its drawn side (`sideClear` m past a paved edge - PAVE_SIDE, the faded side G660 draws - and
//             `softClear` past a soft one, whose torn edge is where the grass creeps in), then CUT grass across the band and a
//             mown band `mowBand` m past it, blending to the biome's wild grass over `mowBlend` m, the verge's bump past that;
//             a grass STRIP's surface carries cut grass (`stripGrass` 1; 0 = bare, G665). An ordinary road keeps today's band
//             and fade, then `roadMow` m of mown verge. The answer gains `cut` (0..1: how mown the grass is here) and `surf`
//             (1 on a grass strip's running surface) - the heights are the viewer's (cover_ring.js: the cut grass's length).
// Live dials (the editor's PREMISES > grass rows; the world look saves them): PREMISES_GEN.grassSides(o) sets, () reads.
// `hard` (the user's call, default 0): grass where the PHYSICS says gravel or paved but nothing hard is DRAWN - a runway's gravel
// shoulder polygons (y_sh*: 46 m beside 13/31 and 02/20) and the declared strip box's margin, drawn as the island's ground since
// G660. 1 grows the cut grass there (the eye's WYSIWYG); the surface itself (friction) is not touched. Read by the viewer's okAt.
const GRASS_SIDES_DEF = { law: 'today', sideClear: PAVE_SIDE, softClear: 0.3, mowBand: 15, mowBlend: 4, roadMow: 2, stripGrass: 1, hard: 0 };
const GRASS_SIDES = Object.assign({}, GRASS_SIDES_DEF);
function grassSides(o) {
  if (o && typeof o === 'object') for (const k in o) {
    if (!(k in GRASS_SIDES_DEF)) continue;
    if (k === 'law') { if (o.law === 'today' || o.law === 'sides') GRASS_SIDES.law = o.law; }
    else if (isFinite(+o[k]) && o[k] !== null && o[k] !== '') GRASS_SIDES[k] = Math.max(0, +o[k]);
  }
  return Object.assign({}, GRASS_SIDES);
}
function rwyTreesMode(o) {
  let v = o && o.rwyTrees;
  if (v == null && typeof window !== 'undefined' && window.FLYDIY_RWYTREES != null) v = window.FLYDIY_RWYTREES;
  if (v == null && typeof process !== 'undefined' && process.env && process.env.FLYDIY_RWYTREES) v = process.env.FLYDIY_RWYTREES;
  v = String(v == null ? '' : v).toLowerCase();
  return RWY_TREES.indexOf(v) >= 0 ? v : 'today';
}
// THE STRIP'S TREE CLEARANCE (G1385 EDITOR-VEG, contract v1.31, the user: "I need to better control tree exclusion
// zones around runways"): a strip's `clear` { side, beyond, taper, bushes } is the clearing the trees keep from it -
// `side` metres past each edge, `beyond` metres past each end, and past the ends the half-width grows by `taper`
// metres a metre (0 a rectangle, 0.15 an approach surface's splay, < 0 an end that narrows). `bushes` keeps the
// cover ring's shrubs out of it as well (the tall vegetation; the grass and the flowers stay). NO `clear` is
// today's generic box exactly - wid/2 + 60 across, len/2 + 150 along, no taper, the bushes kept (20_world.js
// treeAeroBlocked, render_world's analytic treeEx) - and only in 'today'. An AUTHORED clearance is the strip's own
// word: it stands in every variant (rwyTreesMode) and it wins over treeBox false.
const RWY_CLEAR_DEF = { side: 60, beyond: 150, taper: 0, bushes: false };
// A COVER POLYGON'S VEGETATION (G1385 EDITOR-VEG, contract v1.31, the user: "I would like the polygons to be more
// flexible and accept any type of vegetation, from none, to an existing biome, to a new biome"). A `ttype` polygon's
// `veg`, saved with it:
//   { mode: 'none' }                                   nothing of a biome grows inside (no tree, no tuft, no bush)
//   { mode: 'biome', mix: 'conifer' }                  any mix of tools/_trees_tuning.json (the payload's biomes)
//   { mode: 'new', species: { name: { proportion, density?, size? }, ... }, density: trees/ha, under: bushes/1000 m2,
//     cover: the grass's factor }                     a biome defined in place - the mix '@' + the polygon's id
// The `code` may then be null: the polygon stamps no terrain type and only says what grows. Without `veg` a
// polygon is what it was (its code's biome).
const VEG_MODES = ['none', 'biome', 'new'];
const hasCode = c => c.code !== null && c.code !== undefined && c.code !== '' && isFinite(+c.code);
function vegOf(c) {
  const v = c && c.veg;
  if (!v || typeof v !== 'object' || VEG_MODES.indexOf(v.mode) < 0) return null;
  if (v.mode === 'biome' && !(typeof v.mix === 'string' && v.mix)) return null;
  if (v.mode === 'new' && !(v.species && typeof v.species === 'object' && Object.keys(v.species).length)) return null;
  return v;
}
// the mix a 'new' vegetation plants: the bench's shape ({ species, forest }) - `density` trees a hectare is the
// forest's count in its 220 m stand (28c_biomes B.density), `under` the bushes, `cover` the grass's factor
const VEG_R = 220;
function vegMixOf(v) {
  const sp = {};
  for (const k of Object.keys(v.species)) { const r = v.species[k] || {}; const o = { proportion: isFinite(+r.proportion) ? Math.max(0, +r.proportion) : 1 };
    for (const q of ['density', 'size', 'patch', 'dead']) if (isFinite(+r[q]) && r[q] !== null && r[q] !== '') o[q] = +r[q];
    sp[k] = o; }
  const ha = isFinite(+v.density) ? Math.max(0, +v.density) : 100;
  return { species: sp, forest: { ground: 'plane', radius: VEG_R, count: Math.round(ha * Math.PI * VEG_R * VEG_R / 10000),
    under: isFinite(+v.under) ? Math.max(0, +v.under) : 2, cover: isFinite(+v.cover) ? Math.max(0, +v.cover) : 1, reach: VEG_R } };
}
function runwayClearOf(r) {
  const c = r && r.clear;
  if (!c || typeof c !== 'object') return null;
  const n = (v, d, lo, hi) => (isFinite(+v) && v !== null && v !== '' ? clamp(+v, lo, hi) : d);
  return { side: n(c.side, RWY_CLEAR_DEF.side, 0, 600), beyond: n(c.beyond, RWY_CLEAR_DEF.beyond, 0, 3000),
           taper: n(c.taper, RWY_CLEAR_DEF.taper, -1, 1), bushes: !!c.bushes };
}
// the clearance as a box in the axis frame of the strip: al along (from the centre), ac across; true inside.
// e = { rl: len/2, hw: wid/2 + side, hl: len/2 + beyond, tp: taper }
function inRwyClear(e, al, ac) {
  al = Math.abs(al); ac = Math.abs(ac);
  if (al >= e.hl) return false;
  return ac < (al > e.rl && e.tp ? Math.max(0, e.hw + e.tp * (al - e.rl)) : e.hw);
}
// the same clearance as a polygon in the PREMISES frame (the editor's outline; eight corners, CCW)
function runwayClearPoly(r, cl) {
  cl = cl || runwayClearOf(r) || RWY_CLEAR_DEF;
  const E = runwayEnds(r), hw = r.wid / 2 + cl.side, hwE = Math.max(0, hw + cl.taper * cl.beyond), rl = r.len / 2, hl = rl + cl.beyond;
  const P = (u, v) => [r.c[0] + E.d[0] * u + E.n[0] * v, r.c[1] + E.d[1] * u + E.n[1] * v];
  return [P(-hl, -hwE), P(-rl, -hw), P(rl, -hw), P(hl, -hwE), P(hl, hwE), P(rl, hw), P(-rl, hw), P(-hl, hwE)];
}
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
// THE PLOTS (G2310 PREM-S3, contract v1.34): `plots` [{ id, x, z, hdg, stand?, taxiOut?, taxiOut1? }] in the premises
// frame are where a player's hangar MAY stand on this field (71_player_bases.js BASE_OFFERS names them; a plot id is the
// hangar id its holder gets). The record's `hangar` IS the field's first plot, its id the runway's own (Jolene's HOME):
// runwayPlots reads it as plot <runway id>, verbatim, so nothing at a field that had a hangar moves (the site's `hangar`
// is still the record's `hangar` alone - a field with plots and no hangar gains none). A plot's
// `stand` / `taxiOut` / `taxiOut1` are its own way out (the roll-out from that hangar's door); absent, the field's serve.
// A plot on a WATER field is a slipway: its shed stands on the shore, its `stand` on the water off the slip. A plot is a
// PLACE, not a building: the world stands a shed on it only while the player holds it (GAME §R GQ8).
const RUNWAY_DEF = { name: 'strip', len: 480, wid: 24, surface: SURFACE.GRASS, look: 'grass', slope: 0, crossfall: 0, disp: [0, 0], papi: [true, true], falloff: null, site: null, pattern: null, stand: null, taxiOut: null, taxiOut1: null, profile: null, approach: null, hangar: null, plots: null, circuit: null, band: null, pav: null, altiport: false };
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
  // the grade over a metre centred on sAlong; at an end the metre slides inside (GTRAM: a clamped half-metre read an
  // altiport's 10 % threshold as 5 %, and the crest test then saw a 5 % change of slope that is not in the ground)
  const slopeAt = sAlong => { const w = Math.min(1, r.len), a = Math.max(0, Math.min(r.len - w, sAlong - w / 2)); return (at(a + w) - at(a)) / w; };
  return { points: P, at, slopeAt, n };
}
// THE PILOT'S LIMITS on a profile (what the MSFS editor never asks): the slope anywhere under 5 %, the
// touchdown zone (a fifth of the run from each threshold) under 2.5 %, and no crest sharper than a 1.5 %
// change of slope over 30 m - a flare must not meet a hump it cannot see over
// THE ALTIPORT (GTRAM, the tramway's summit strip): `altiport: true` is a mountain strip the Alpine way -
// one way, landed UPHILL and left downhill whatever the wind (Courchevel 537 m at 18.5 %, Meribel 406 m
// with an 11 % middle, La Salette 180 m at 20 %), so the limits are the altiport's: the slope anywhere
// under 20 %, no touchdown-zone rule (the touchdown IS on the slope), a crest under 5 % of slope change
// over 30 m (the ease into the flat top the aeroplane stops on), an `approach` named, and the far end
// higher than the threshold it lands over
const ALTIPORT = { slopeMax: 0.20, crestMax: 0.05 };
function profileIssues(r) {
  const out = [], pr = runwayProfile(r), L = r.len, alti = !!r.altiport;
  let worst = 0, tdz = 0, crest = 0;
  for (let a = 0; a <= L; a += 3) {
    const sl = Math.abs(pr.slopeAt(a)); worst = Math.max(worst, sl);
    if (a < L / 5 || a > L - L / 5) tdz = Math.max(tdz, sl);
    if (a + 30 <= L) crest = Math.max(crest, Math.abs(pr.slopeAt(a + 30) - pr.slopeAt(a)));
  }
  if (alti) {
    if (worst > ALTIPORT.slopeMax) out.push('runway ' + r.id + ': the altiport is ' + (worst * 100).toFixed(1) + ' % somewhere, over ' + ALTIPORT.slopeMax * 100 + ' %');
    if (crest > ALTIPORT.crestMax) out.push('runway ' + r.id + ': a crest changes the slope ' + (crest * 100).toFixed(1) + ' % over 30 m, over ' + ALTIPORT.crestMax * 100 + ' on an altiport');
    if (r.approach !== 0 && r.approach !== 1) out.push('runway ' + r.id + ': an altiport names its approach (the end it is landed over)');
    else if (!((r.approach === 0 ? pr.at(L) - pr.at(0) : pr.at(0) - pr.at(L)) > 0)) out.push('runway ' + r.id + ': an altiport is landed uphill - the far end must be higher than end ' + r.approach);
    return out;
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
// [[x, z], ...] (and `taxiOut1`, G772: the way out toward end1) are in the premises frame; the site the pattern reads gets them in the world, the
// stand's heading DERIVED toward its first taxi point when the record gives none (an aeroplane is
// parked pointing the way it will leave - the core's own ruling at HOME), merged over the record's
// `site` (an authored pattern rides there untouched)
// THE PLOTS OF A RUNWAY (G2310, v1.34), in the premises frame: the record's `hangar` as plot <runway id> (verbatim) unless
// `plots` names that id itself, then every authored plot with a finite place, in the record's order
const plotOk = p => !!p && typeof p.id === 'string' && p.id.length > 0 && isFinite(+p.x) && isFinite(+p.z);
function runwayPlots(r) {
  const own = Array.isArray(r.plots) ? r.plots.filter(plotOk) : [];
  const out = [];
  if (r.hangar && isFinite(+r.hangar.x) && isFinite(+r.hangar.z) && !own.some(p => p.id === r.id))
    out.push({ id: r.id, x: +r.hangar.x, z: +r.hangar.z, hdg: +r.hangar.hdg || 0, main: true });
  for (const p of own) { const q = Object.assign({}, p); delete q.main; out.push(q); }
  return out;
}
// one plot into the world: the shed's centre, its door's heading and rotation.y (the club hangar's own rule, G434), its
// own way out when it has one (the stand's heading derived toward its first taxi point, as the field's)
function plotWorld(p, F) {
  const W = q => F.toWorld(q[0], q[1]);
  const hw = W([+p.x, +p.z]), hh = (+p.hdg || 0) - F.yaw;
  const o = { id: p.id, x: +hw[0].toFixed(3), z: +hw[1].toFixed(3), hdg: +hh.toFixed(4), ry: +(Math.PI - hh).toFixed(4) };
  if (p.main) o.main = true;
  if (p.stand && isFinite(+p.stand.x) && isFinite(+p.stand.z)) {
    const st = W([+p.stand.x, +p.stand.z]), tx = Array.isArray(p.taxiOut) ? p.taxiOut.map(W) : [];
    let hdg;
    if (p.stand.hdg !== null && p.stand.hdg !== undefined) hdg = +p.stand.hdg - F.yaw;
    else if (tx.length) hdg = Math.atan2(tx[0][1] - st[1], tx[0][0] - st[0]);
    else hdg = hh;   // a slipway's stand with no way out faces where the door does
    o.stand = { x: +st[0].toFixed(3), z: +st[1].toFixed(3), hdg: +hdg.toFixed(4) };
    if (tx.length) o.taxiOut = tx.map(q => [+q[0].toFixed(3), +q[1].toFixed(3)]);
    if (Array.isArray(p.taxiOut1) && p.taxiOut1.length) o.taxiOut1 = p.taxiOut1.map(W).map(q => [+q[0].toFixed(3), +q[1].toFixed(3)]);
  }
  return o;
}
function runwaySite(r, F) {
  const W = q => F.toWorld(q[0], q[1]);
  const base = Object.assign({}, r.site || {});
  // the club hangar (G434): the garage's shell in the world, its door along hdg (hangar.js draws the
  // door at local -x, so rotation.y = pi - hdg puts it there: 25_airfield.js's own -pi/2 for a door at -z)
  if (r.hangar && isFinite(+r.hangar.x) && isFinite(+r.hangar.z)) {
    const hw = W([+r.hangar.x, +r.hangar.z]), hh = (+r.hangar.hdg || 0) - F.yaw;
    base.hangar = Object.assign({ x: +hw[0].toFixed(3), z: +hw[1].toFixed(3), hdg: +hh.toFixed(4), ry: +(Math.PI - hh).toFixed(4) }, HANGAR_DIMS);
  }
  // G2310: every plot into the site, the first (the hangar's) verbatim - only when the record authors `plots`, so a
  // field without them composes to the very site it did (the key absent)
  const P = Array.isArray(r.plots) ? runwayPlots(r) : [];
  if (P.length) base.plots = P.map(p => plotWorld(p, F));
  if (!r.stand || !r.taxiOut || !r.taxiOut.length) return Object.keys(base).length ? base : null;
  const st = W([r.stand.x, r.stand.z]), tx = r.taxiOut.map(W);
  let hdg;
  if (r.stand.hdg !== null && r.stand.hdg !== undefined) hdg = +r.stand.hdg - F.yaw;
  else hdg = Math.atan2(tx[0][1] - st[1], tx[0][0] - st[0]);
  const out = Object.assign(base, { stand: { x: +st[0].toFixed(3), z: +st[1].toFixed(3), hdg: +hdg.toFixed(4) }, taxiOut: tx.map(q => [+q[0].toFixed(3), +q[1].toFixed(3)]) });
  // G772: THE OTHER WAY OUT - `taxiOut1` is the way to the centreline for a departure ALONG -hdg (off end1: the
  // pattern's direction 1), where the strip's apron has a second taxiway toward that end; absent, taxiOut
  // serves both directions as before. Same frame, same last-point-on-the-centreline rule
  if (Array.isArray(r.taxiOut1) && r.taxiOut1.length) out.taxiOut1 = r.taxiOut1.map(W).map(q => [+q[0].toFixed(3), +q[1].toFixed(3)]);
  return out;
}
// (v1.33) a stage's `sock: false` / `ties: false` onto the aerodrome (render_world's windsock, 25_airfield fleetSpots);
// absent - the record never says it - the aerodrome is untouched
function stageAero(a, r) { if (r.sock === false) a.sock = false; if (r.ties === false) a.ties = false; return a; }
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
           altiport: !!r.altiport,   // GTRAM: landed uphill and left downhill whatever the wind (43_pilot reads it)
           // THE TREES ROUND THE STRIP ARE THE RECORD'S (G527.3, contract v1.25): treeBox false - the renderer's generic box
           // (len/2 + 150 along, wid/2 + 60 across) is not cut; the strip's own box + 30 m and the authored excludes are
           treeBox: r.treeBox !== false,
           // THE STRIP'S OWN CLEARANCE (G1385, contract v1.31): `clear` authored - its sides, ends and taper replace the
           // generic box (and stand in every rwytrees variant); null - the generic box, as before (runwayClearOf)
           treeClear: runwayClearOf(r),
           // THE WAY OUT OF A ONE-WAY STRIP (G527.3, contract v1.25): `departure` names the end the take-off leaves OVER
           // (0|1); without it a one-way strip is left the way it is landed. East Point is landed over the sea and left
           // back out over it - the trees close in at the other end
           takeoffHdg: r.departure === 1 ? hdg : r.departure === 0 ? hdg + Math.PI : null,
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
    P.preset = entry.preset; P.slopeX = 0; P.slopeZ = 0; P.ground = ground;
    // THE WATER IS WHERE THE ITEM IS, not where the anchor is. `ctx.waterY` is one
    // number read at the premises' anchor, and on an island that anchor is inland,
    // so it reads -Infinity (the same trap that stopped a harbour zone sowing,
    // G434): every pier, float and wharf was then built at -Infinity. A marine
    // entry lives ON the water and has to be told which water.
    const wHere = ctx.waterAt ? ctx.waterAt(c[0], c[1]) : ctx.waterY;
    P.waterY = (isFinite(wHere) ? wHere : ctx.waterY) - oy;
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
      // ON A DECK, NOT ON THE GROUND (2026-09-22). A warehouse that stands on a
      // wharf has no ground under it - the seabed is five metres down - so its
      // floor is given over the WATER instead, and the composer turns that into
      // the item's own frame. Metlakatla's packing plant is four sheds on a pile
      // deck, and without this they all stood on the bottom of the sea.
      if (isFinite(P.floorOverWater) && isFinite(P.waterY)) P.floorY = P.waterY + P.floorOverWater;
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
    if (!A || !B) {
      // GTRAM: an end DECLARED on its site but not built is the catalogue's absence (a headless world with no
      // generators), said as such - the same words the site's own issue uses; an end the record lacks is missing
      const declared = e => { const st = (rec.layers.sites || []).find(q => q.id === e.site); return !!(st && (st.items || []).some(q => q.id === e.item)); };
      const why = (!A && declared(L.from)) || (!B && declared(L.to)) ? 'an end is not built (no catalogue entry for its station)' : 'an end is missing';
      out.push({ link: L, ok: false, issues: ['link ' + L.id + ': ' + why] }); continue;
    }
    const sol = S.solve(L, A, B, ctx || {});
    for (const id in sol.patch || {}) { const it = items.find(i => i.id === id); if (it) Object.assign(it.P, sol.patch[id]); }
    out.push(Object.assign({ link: L, A, B }, sol));
  }
  return out;
}

// ---------------------------------------------------------------------------
// SMOOTH ROADS (contract v1.19, 2026-09-22)
// ---------------------------------------------------------------------------
// A road has always been VERTICALLY smooth - its grade is re-densified every 6 m
// and run through four 3-tap passes - and horizontally POLYGONAL: polyRoad's
// tangent is per segment and jumps at every vertex, so pavement.js lays its cross
// rows on a normal that jumps with it and the ribbon pinches inside a bend and
// gapes outside. `smooth` rounds the corner instead: a circular fillet of that
// radius at each interior vertex, cut back when the neighbouring segments are too
// short to carry it. It is applied ONCE, in compose, before anything reads `pts` -
// so the ribbon, the grade, the surface strip, the cover query and the traffic all
// see the same line, and the record keeps the polyline the editor drew.
function smoothPath(pts, radius) {
  const R0 = radius === true ? 25 : +radius;
  if (!(R0 > 0) || !pts || pts.length < 3) return pts;
  const out = [[pts[0][0], pts[0][1]]];
  for (let i = 1; i < pts.length - 1; i++) {
    const p = pts[i], a = pts[i - 1], b = pts[i + 1];
    const l0 = Math.hypot(a[0] - p[0], a[1] - p[1]), l1 = Math.hypot(b[0] - p[0], b[1] - p[1]);
    if (l0 < 1e-6 || l1 < 1e-6) continue;
    const v0 = [(a[0] - p[0]) / l0, (a[1] - p[1]) / l0], v1 = [(b[0] - p[0]) / l1, (b[1] - p[1]) / l1];
    const ang = Math.acos(Math.max(-1, Math.min(1, v0[0] * v1[0] + v0[1] * v1[1])));
    if (!(ang > 0.02) || ang > Math.PI - 0.02) { out.push([p[0], p[1]]); continue; }
    let R = R0, t = R / Math.tan(ang / 2);
    const tmax = Math.min(l0, l1) * 0.45;
    if (t > tmax) { t = tmax; R = t * Math.tan(ang / 2); }
    const P0 = [p[0] + v0[0] * t, p[1] + v0[1] * t], P1 = [p[0] + v1[0] * t, p[1] + v1[1] * t];
    const bl = Math.hypot(v0[0] + v1[0], v0[1] + v1[1]) || 1;
    const bis = [(v0[0] + v1[0]) / bl, (v0[1] + v1[1]) / bl];
    const C = [p[0] + bis[0] * R / Math.sin(ang / 2), p[1] + bis[1] * R / Math.sin(ang / 2)];
    const a0 = Math.atan2(P0[1] - C[1], P0[0] - C[0]);
    let da = Math.atan2(P1[1] - C[1], P1[0] - C[0]) - a0;
    while (da > Math.PI) da -= Math.PI * 2;
    while (da < -Math.PI) da += Math.PI * 2;
    const n = Math.max(2, Math.ceil(Math.abs(da) / 0.3));
    for (let k = 0; k <= n; k++) { const th = a0 + da * k / n; out.push([C[0] + Math.cos(th) * R, C[1] + Math.sin(th) * R]); }
  }
  out.push([pts[pts.length - 1][0], pts[pts.length - 1][1]]);
  return out;
}

// ---------------------------------------------------------------------------
// SPLINE ROADS (contract v1.35, G2890 SCENERY-ED-1)
// ---------------------------------------------------------------------------
// The user (2026-10-11): "I cannot find how to get smooth roads ... bezier points adjustment, or simply smooth
// interpolation between the points. Right now, it cannot do long curves." The fillet (roadFillet) holds every corner
// within 0.35 x w of the clicked point - a 4 m road rounds at most 1.4 m off its corner, so a long bend needed a click
// every few metres. `curve: 'spline'` draws the road THROUGH its points instead: the C2 interpolating cubic (chord-length
// knots), so the curvature is continuous along the whole road - a bend tightens and opens without a jump at any point,
// the way a surveyed road does (a Catmull-Rom is only C1: its curvature steps at every point). Its free ends run out
// parabolically (the end segment's curvature is its neighbour's). A point may carry its own HANDLE, `tan[i]` = [dx, dz]
// in metres - the outgoing Bezier control point's offset, the incoming one mirrored: there the spline is CLAMPED to that
// direction and splits into two runs, each still C2 inside. The line is walked under 2.5 degrees a step, so polyRoad's
// fillet (3 degrees and up) leaves it alone and every reader - the ribbon, the grade, the surface strip, coverAt, the
// plots, the traffic - sees one smooth line. Applied ONCE in compose, like `smooth`; the record keeps the points the editor
// drew. A record without `curve` composes as before, to the bit.
function roadSplineD(P, tan) {
  // dP/ds at each point (s = chord length), coming in (Din) and going out (Dout) - equal except at a handle
  const n = P.length, h = [], Din = new Array(n), Dout = new Array(n);
  for (let i = 0; i < n - 1; i++) h.push(Math.max(1e-6, Math.hypot(P[i + 1][0] - P[i][0], P[i + 1][1] - P[i][1])));
  const fixed = i => !!(tan && tan[i]);
  let a = 0;
  while (a < n - 1) {
    let b = a + 1; while (b < n - 1 && !fixed(b)) b++;
    // the run a..b: clamped where a handle is, parabolic run-out at a free end; a tridiagonal solve (Thomas) for x and z
    const m = b - a + 1, lo = new Array(m).fill(0), di = new Array(m).fill(0), up = new Array(m).fill(0), rx = new Array(m).fill(0), rz = new Array(m).fill(0);
    for (let k = 0; k < m; k++) {
      const i = a + k;
      if (k === 0 || k === m - 1) {
        const hs = k === 0 ? h[i] : h[i - 1];
        if (fixed(i)) { di[k] = 1; rx[k] = 3 * tan[i][0] / hs; rz[k] = 3 * tan[i][1] / hs; continue; }
        const i0 = k === 0 ? i : i - 1, cx = (P[i0 + 1][0] - P[i0][0]) / hs, cz = (P[i0 + 1][1] - P[i0][1]) / hs;
        if (m === 2 && !fixed(k === 0 ? b : a)) { di[k] = 1; rx[k] = cx; rz[k] = cz; continue; }   // two free ends: the chord
        di[k] = 1; if (k === 0) up[k] = 1; else lo[k] = 1; rx[k] = 2 * cx; rz[k] = 2 * cz;            // D_end + D_next = 2 chord
        continue;
      }
      const h0 = h[i - 1], h1 = h[i];
      lo[k] = h1; di[k] = 2 * (h0 + h1); up[k] = h0;
      rx[k] = 3 * (h1 * (P[i][0] - P[i - 1][0]) / h0 + h0 * (P[i + 1][0] - P[i][0]) / h1);
      rz[k] = 3 * (h1 * (P[i][1] - P[i - 1][1]) / h0 + h0 * (P[i + 1][1] - P[i][1]) / h1);
    }
    for (let k = 1; k < m; k++) { const w = lo[k] / di[k - 1]; di[k] -= w * up[k - 1]; rx[k] -= w * rx[k - 1]; rz[k] -= w * rz[k - 1]; }
    const dx = new Array(m), dz = new Array(m);
    dx[m - 1] = rx[m - 1] / di[m - 1]; dz[m - 1] = rz[m - 1] / di[m - 1];
    for (let k = m - 2; k >= 0; k--) { dx[k] = (rx[k] - up[k] * dx[k + 1]) / di[k]; dz[k] = (rz[k] - up[k] * dz[k + 1]) / di[k]; }
    for (let k = 0; k < m; k++) { const i = a + k; if (k < m - 1) Dout[i] = [dx[k], dz[k]]; if (k > 0) Din[i] = [dx[k], dz[k]]; }
    a = b;
  }
  Din[0] = Dout[0]; Dout[n - 1] = Din[n - 1];
  return { h, Din, Dout };
}
function roadCurve(pts0, tan0) {
  const P = [], tan = [];
  (pts0 || []).forEach((q, i) => { const l = P[P.length - 1]; if (!l || Math.hypot(q[0] - l[0], q[1] - l[1]) > 1e-6) { P.push([+q[0], +q[1]]); tan.push(tan0 && tan0[i] && isFinite(+tan0[i][0]) && isFinite(+tan0[i][1]) && Math.hypot(+tan0[i][0], +tan0[i][1]) > 1e-6 ? [+tan0[i][0], +tan0[i][1]] : null); } });
  const n = P.length;
  if (n < 2 || (n < 3 && !tan[0] && !tan[1])) return P;
  const S = roadSplineD(P, tan), out = [[P[0][0], P[0][1]]], STEP = 0.9 * Math.PI / 180;
  const ang = (u, v) => { const lu = Math.hypot(u[0], u[1]), lv = Math.hypot(v[0], v[1]); return lu < 1e-9 || lv < 1e-9 ? 0 : Math.acos(clamp((u[0] * v[0] + u[1] * v[1]) / (lu * lv), -1, 1)); };
  for (let i = 0; i < n - 1; i++) {
    const h = S.h[i], A = P[i], D = P[i + 1];
    const B = [A[0] + S.Dout[i][0] * h / 3, A[1] + S.Dout[i][1] * h / 3], C = [D[0] - S.Din[i + 1][0] * h / 3, D[1] - S.Din[i + 1][1] * h / 3];
    // how far the control polygon turns bounds how far the curve does: that many steps (1 on a straight)
    const e0 = [B[0] - A[0], B[1] - A[1]], e1 = [C[0] - B[0], C[1] - B[1]], e2 = [D[0] - C[0], D[1] - C[1]];
    const turn = ang(e0, e1) + ang(e1, e2) + (Math.hypot(e1[0], e1[1]) < 1e-9 ? ang(e0, e2) : 0);
    const k = Math.max(1, Math.min(200, Math.ceil(turn / STEP)));
    for (let s = 1; s <= k; s++) {
      const u = s / k, v = 1 - u, b0 = v * v * v, b1 = 3 * v * v * u, b2 = 3 * v * u * u, b3 = u * u * u;
      out.push([b0 * A[0] + b1 * B[0] + b2 * C[0] + b3 * D[0], b0 * A[1] + b1 * B[1] + b2 * C[1] + b3 * D[1]]);
    }
  }
  return out;
}
// each point's outgoing handle as the spline draws it ([dx, dz] metres): its own `tan[i]`, else the spline's (the next
// segment's third; the last point's from its incoming one) - what the editor's handle discs show and start from
function roadHandles(pts, tan) {
  const n = pts.length;
  if (n < 2) return pts.map(() => [0, 0]);
  const T = pts.map((q, i) => (tan && tan[i] && Math.hypot(+tan[i][0], +tan[i][1]) > 1e-6 ? [+tan[i][0], +tan[i][1]] : null));
  const S = roadSplineD(pts.map(q => [+q[0], +q[1]]), T);
  return pts.map((q, i) => (T[i] ? T[i] : i < n - 1 ? [S.Dout[i][0] * S.h[i] / 3, S.Dout[i][1] * S.h[i] / 3] : [S.Din[i][0] * S.h[i - 1] / 3, S.Din[i][1] * S.h[i - 1] / 3]));
}
// a placed prop's scale (v1.36 `s`, the model placer's) on its composed record - only when it is not 1 (G3001)
const objScale = ob => (+ob.s > 0 && Math.abs(+ob.s - 1) > 1e-3 ? { s: +ob.s } : {});
// THE ROADS' BUILD KEYS (G3002 PLACER-FAST; the user: "adding assets in the editor is a bit of a pain, really, really
// long to move, update, rotate" - every edit's rebuild made EVERY road's pavement, its poles and its rails again, the
// island road's 25 km among them). A road's drawn things (its pavement row, its power line, its guardrail) are a
// function of: the road as composed (`rd`, every field) and as recorded, the record's pavement settings and theme, and
// what its poles and rails keep clear of NEAR it - the other roads (each one's digest), the plots, the strips, the
// paved polygons. roadBuildKeys(O) -> Map(id -> key): a road whose key is the same, and whose box no ground edit
// touched (roadBoxTouch), is drawn as it was; anything else is built again.
function roadBuildKeys(O) {
  const out = new Map(), roads = (O && O.roads) || [], recRoads = new Map(((O && O.rec && O.rec.layers && O.rec.layers.roads) || []).map(r => [r.id, r]));
  const dig = new Map(), bbs = new Map();
  for (const q of roads) if (q && q.pts && q.pts.length > 1) { dig.set(q, fnv(JSON.stringify([q.id, q.pts, q.w]))); bbs.set(q, polyBBox(q.pts)); }
  const plots = ((O && O.records && O.records.plots) || []).filter(p => p && p.poly && p.poly.length >= 3).map(p => [polyBBox(p.poly), fnv(JSON.stringify(p.poly))]);
  const strips = ((O && O.runways) || []).map(r => [r.id, r.c, r.len, r.wid, r.hdg]);
  const paved = ((O && O.pavePolys) || []).map(pp => [pp.bbox || polyBBox(pp.poly), fnv(JSON.stringify([pp.id, pp.poly, pp.look]))]);
  const glob = JSON.stringify([(O && O.pavement) || null, (O && O.rec && O.rec.theme) || null, strips]);
  for (const rd of roads) {
    if (!rd || !rd.pts || rd.pts.length < 2) continue;
    const bb = bbs.get(rd), m = (+rd.w || 3.6) / 2 + 14;
    const near = b => !(b.x1 < bb.x0 - m || b.x0 > bb.x1 + m || b.z1 < bb.z0 - m || b.z0 > bb.z1 + m);
    const ctx = [];
    for (const q of roads) if (q !== rd && dig.has(q) && near(bbs.get(q))) ctx.push(dig.get(q));
    for (const [b, h] of plots) if (near(b)) ctx.push(h);
    for (const [b, h] of paved) if (near(b)) ctx.push(h);
    out.set(rd.id, fnv(JSON.stringify([rd, recRoads.get(rd.id) || null])).toString(36) + ':' + fnv(glob + '|' + ctx.join(',')).toString(36));
  }
  return out;
}
// a ground edit's box (premises frame) over a road: its points' box grown by its half width and `pad` (its banks)
function roadBoxTouch(rd, box, pad) {
  if (!rd || !rd.pts || rd.pts.length < 1 || !box) return false;
  const bb = polyBBox(rd.pts), m = (+rd.w || 3.6) / 2 + (pad > 0 ? pad : 0);
  return !(box.x1 < bb.x0 - m || box.x0 > bb.x1 + m || box.z1 < bb.z0 - m || box.z0 > bb.z1 + m);
}
// A ROAD'S BED (contract v1.37, G2952): `bed: true | { fill, grade, bank, shoulder }` - null when the road has none (today's)
const BED_DEF = { fill: 0.15, grade: 0.12, bank: 10, shoulder: 0.5 };
function bedOf(r) {
  const b = r && r.bed;
  if (!b) return null;
  const o = Object.assign({}, BED_DEF, b === true ? {} : b);
  if (o.on === false) return null;
  return { fill: clamp(+o.fill || 0, 0, 2), grade: clamp(+o.grade || BED_DEF.grade, 0.01, 0.5), bank: clamp(+o.bank || +r.falloff || BED_DEF.bank, 1, 60), shoulder: clamp(isFinite(+o.shoulder) ? +o.shoulder : BED_DEF.shoulder, 0, 5) };
}

// ---------------------------------------------------------------------------
// THE GRAPH (contract v1.37, G2950 ROAD-GRAPH): nodes + edges and the one router - the roads' graph (O.roadGraph), the
// taxi pattern's ({ nodes, arcs }: graphOfPattern), a ground vehicle's route (GROUND-VEHICLE G2940) all go through it.
//   nodes [{ id, x, z, ... }]   edges [{ id, a, b, len, pts?: [[x, z]...] (a -> b), ... }]   (undirected)
//   -> { nodes, edges, node(id), edge(id), adj(id), path(a, b, weight?) -> { nodes, edges, len } | null (Dijkstra, a
//        binary heap; weight(e) defaults to e.len, Infinity or NaN closes an edge), components() -> [[ids]],
//        nodeAt(x, z, r) -> the nearest node within r, edgeAt(x, z, maxD) -> { edge, d } (by its pts, the segment grid) }
function graphMake(nodes0, edges0) {
  const nodes = new Map(), adj = new Map(), byE = new Map(), edges = [];
  for (const n of nodes0 || []) if (n && n.id != null && !nodes.has(n.id)) { nodes.set(n.id, n); adj.set(n.id, []); }
  for (const e of edges0 || []) { if (!e || !nodes.has(e.a) || !nodes.has(e.b) || byE.has(e.id)) continue; edges.push(e); byE.set(e.id, e); adj.get(e.a).push(e); if (e.b !== e.a) adj.get(e.b).push(e); }
  const other = (e, id) => (e.a === id ? e.b : e.a);
  function path(a, b, weight) {
    if (!nodes.has(a) || !nodes.has(b)) return null;
    const W = weight || (e => e.len), dist = new Map([[a, 0]]), prev = new Map(), done = new Set(), H = [];
    const up = i => { while (i > 0) { const p = (i - 1) >> 1; if (H[p][0] <= H[i][0]) break; const t = H[p]; H[p] = H[i]; H[i] = t; i = p; } };
    const down = i => { for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < H.length && H[l][0] < H[m][0]) m = l; if (r < H.length && H[r][0] < H[m][0]) m = r; if (m === i) return; const t = H[m]; H[m] = H[i]; H[i] = t; i = m; } };
    const push = q => { H.push(q); up(H.length - 1); };
    const pop = () => { const t = H[0], l = H.pop(); if (H.length) { H[0] = l; down(0); } return t; };
    push([0, a]);
    while (H.length) {
      const [d, u] = pop(); if (done.has(u)) continue; done.add(u); if (u === b) break;
      for (const e of adj.get(u)) { const w = +W(e); if (!(w >= 0) || !isFinite(w)) continue; const v = other(e, u), nd = d + w; if (nd < (dist.has(v) ? dist.get(v) : Infinity)) { dist.set(v, nd); prev.set(v, [u, e]); push([nd, v]); } }
    }
    if (!done.has(b)) return null;
    const ns = [b], es = []; for (let c = b; c !== a;) { const [u, e] = prev.get(c); es.push(e.id); ns.push(u); c = u; }
    return { nodes: ns.reverse(), edges: es.reverse(), len: dist.get(b) };
  }
  function components() {
    const seen = new Set(), out = [];
    for (const id of nodes.keys()) { if (seen.has(id)) continue; const c = [], st = [id]; seen.add(id); while (st.length) { const u = st.pop(); c.push(u); for (const e of adj.get(u)) { const v = other(e, u); if (!seen.has(v)) { seen.add(v); st.push(v); } } } out.push(c); }
    return out.sort((p, q) => q.length - p.length);
  }
  function nodeAt(x, z, r) { let best = null, bd = r > 0 ? r : Infinity; for (const n of nodes.values()) { const d = Math.hypot(n.x - x, n.z - z); if (d <= bd) { bd = d; best = n; } } return best; }
  function edgeAt(x, z, maxD) {
    let best = null, bd = maxD > 0 ? maxD : Infinity;
    for (const e of edges) { if (!e.pts || e.pts.length < 2) continue; const b = e.bb || (e.bb = polyBBox(e.pts)); if (x < b.x0 - bd || x > b.x1 + bd || z < b.z0 - bd || z > b.z1 + bd) continue; const d = roadDist(e, x, z); if (d < bd) { bd = d; best = e; } }
    return best ? { edge: best, d: bd } : null;
  }
  return { nodes: Array.from(nodes.values()), edges, node: id => nodes.get(id) || null, edge: id => byE.get(id) || null, adj: id => adj.get(id) || [], path, components, nodeAt, edgeAt };
}
// the taxi pattern's graph (25_airfield.js sitePattern: nodes { id, x, z, kind }, arcs [idA, idB]) through the same router
function graphOfPattern(P) {
  const ns = ((P && P.nodes) || []).map(n => ({ id: n.id, x: +n.x, z: +n.z, kind: n.kind }));
  const at = new Map(ns.map(n => [n.id, n]));
  const es = ((P && P.arcs) || []).filter(a => at.has(a[0]) && at.has(a[1])).map((a, i) => { const p = at.get(a[0]), q = at.get(a[1]); return { id: 'arc' + i, a: a[0], b: a[1], len: Math.hypot(q.x - p.x, q.z - p.z), pts: [[p.x, p.z], [q.x, q.z]] }; });
  return graphMake(ns, es);
}
// A ROAD'S JUNCTIONS (contract v1.37, G2950): `roads[].nodes` [id | null, ...] beside `pts` (one slot a point, as `tan`): a
// waypoint carrying an id IS that junction - every road whose waypoint carries the same id meets there (one node of the
// graph). The waypoints stay the user's: no step of the composer, the migrator or the graph ever writes `pts`; a junction
// is drawn where its roads' waypoints are (the editor keeps them on one spot: a snap, a junction's drag). `junctions` [{ id,
// name?, conn? }] names a junction and marks a CONNECTION POINT (a place's edge waypoint other roads are meant to join).
function junctionIds(rec) {
  const s = new Set();
  for (const r of (rec.layers && rec.layers.roads) || []) for (const id of (r && Array.isArray(r.nodes) ? r.nodes : [])) if (id) s.add(id);
  for (const j of (rec.layers && rec.layers.junctions) || []) if (j && j.id) s.add(j.id);
  return s;
}
function newJunctionId(rec, prefix) {
  const used = junctionIds(rec);
  for (const k of LAYERS) for (const e of rec.layers[k] || []) if (e && e.id) used.add(e.id);
  const p = prefix || 'j';
  for (let i = 1; ; i++) if (!used.has(p + i)) return p + i;
}
// (G2950) A JUNCTION ON A STRAIGHT SPAN IS NO CORNER: a waypoint carrying a junction id that lies on the straight line
// between its neighbours (within 1 cm - a crossing's waypoint inserted on both streets, cm-rounded) is read by the
// composition as no point at all - the road's grade samples, its plots, its pavement are the road's before the junction
// was made; `wp` keeps the waypoints (where the junctions are). A spline road keeps every point (each one shapes it).
function straightOf(r) {
  if (!Array.isArray(r.nodes) || r.curve === 'spline' || r.pts.length < 3) return r;
  const P = r.pts, out = [P[0]];
  for (let i = 1; i + 1 < P.length; i++) {
    const a = out[out.length - 1], p = P[i], b = P[i + 1], dx = b[0] - a[0], dz = b[1] - a[1], L = Math.hypot(dx, dz);
    const t = L > 1e-9 ? ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / (L * L) : -1;
    if (r.nodes[i] && t > 0 && t < 1 && Math.abs((p[0] - a[0]) * dz - (p[1] - a[1]) * dx) / L < 0.01 && !(p.length > 2 || a.length > 2 || b.length > 2)) continue;
    out.push(p);
  }
  out.push(P[P.length - 1]);
  return out.length === P.length ? r : Object.assign({}, r, { pts: out, wp: P });
}
// the line a road is drawn on: its spline, its fillet radius (v1.19) or its points
const roadLine = r => (r.curve === 'spline' ? roadCurve(r.pts, r.tan) : r.smooth ? smoothPath(r.pts, r.smooth) : r.pts);

// A ROUND PAD (contract v1.35, G2890; the user: "we need a round type of apron as well"): a paved (material, `look`)
// polygon whose `round` { c: [x, z], r, n? } is the truth - its `poly` is the circle's n-gon (48 by default), written by
// normalise so every reader (the pavement, coverAt, the surface below, the gates) reads an ordinary polygon
function roundPoly(R) {
  const n = Math.max(12, Math.min(128, Math.round(+R.n || 48))), r = Math.max(1, +R.r || 10), c = R.c;
  const out = [];
  for (let k = 0; k < n; k++) { const a = 2 * Math.PI * k / n; out.push([+(c[0] + Math.cos(a) * r).toFixed(3), +(c[1] + Math.sin(a) * r).toFixed(3)]); }
  return out;   // counter-clockwise (+x toward +z)
}
const roundOk = R => !!(R && Array.isArray(R.c) && isFinite(+R.c[0]) && isFinite(+R.c[1]) && +R.r > 0);
// a road's own clearing (v1.36, G2918): metres past its paved edge, 0 to 200; null when unset (today's road)
const roadClearOf = r => (!r || r.clear === null || r.clear === undefined || r.clear === '' || !isFinite(+r.clear) ? null : clamp(+r.clear, 0, 200));

// A PLOT'S GROUND (contract v1.35, G2890; the user: "an option to disable plot ground drawing for the houses. The ones
// on the shore draw grass up till the sea"): a zone's `rules.ground === false` takes the lot patch and the lawn off every
// plot it sows, `rules.noGround` [plot ids] off those plots alone; a site item's `P.plotGround === false` off its own lot
// A PLOT'S FENCE (G3007; the user: "we need an option to turn off the fencing around the plots too"): a zone's
// `rules.fences === false` takes the fence off every plot it sows, `rules.noFence` [plot ids] off those plots alone (the
// plot's boundary, its house and the rest of its lot as they were); absent - today's fences, every plot record the same
function plotFenceOff(zone, plotId) {
  const R = (zone && zone.rules) || {};
  return R.fences === false || (Array.isArray(R.noFence) && R.noFence.indexOf(plotId) >= 0);
}
function plotGroundOff(zone, plotId) {
  const R = (zone && zone.rules) || {};
  return R.ground === false || (Array.isArray(R.noGround) && R.noGround.indexOf(plotId) >= 0);
}

// ---------------------------------------------------------------------------
// THE AREAS (contract v1.36, record v2; G2910 SCENERY-ED-2, futureDesigns/SCENERY-POLYGON-2026-10.md). The user, 11 Oct:
// "The polygons saying 'gravel' around the main strip do not seem to draw anything, but to remove trees. I would rather
// have a generic polygon type to which we can attach properties". ONE shape, its effects attached:
//   areas[] = { id, name?, poly, round?: { c, r, n? }, rect?: { c, hw, hd, yaw, radius }, props: {
//                 terraform  the terrain modifier's fields (kind flatten / raise / ramp, level, dh, slope, hdg, abs, falloff, order)
//                 wheels     the surface entry's (surface: the SURFACE code, z, apron, yard) - the class the wheels feel;
//                            a hard one (paved / gravel / sand) keeps the trees and the plots out, as it always did
//                 draw       the material entry's: a PBR `set` (tile, fade, z) or a pavement `look` (band, pav, yaw, z, stands)
//                 marks      weathered paint on a pavement draw: parking bays, a dock's edge and bollards, hatching (areaMarks)
//                 exclude    the exclude entry's (what: trees / plots / settle); `zone` = a 'clear' zone's own
//                            fields when the area came from one (it composes as that zone)
//                 cover      the ttype entry's (code, from, clear, cover, veg: none / a biome / a new one) },
//               src?: { <layer>: [id, index] } }   the v1 entries it was folded from: their ids and places
// COMPOSE EXPANDS AN AREA BACK INTO THE v1 ENTRIES (expandAreas), each at the place its source had in its layer (a new
// area's after every v1 entry, in the areas' order) - so a migrated record composes to the same bits as the v1 record it
// came from (GATE PREMISES: every fixture and Jolene, sample for sample), and nothing past compose knows areas exist.
// The v1 -> v2 migrator folds every polygon entry not on a stage, the same `poly` exactly into one area (one entry of a
// layer an area); a terrain grade (a line), a zone that sows, a staged entry stay what they were.
const AREA_PROPS = ['terraform', 'wheels', 'draw', 'marks', 'exclude', 'cover', 'roadside'];   // (v1.37: roadside - an apron's junction, G2953)
const AREA_LAYERS = ['terrain', 'surface', 'material', 'exclude', 'ttype', 'zones'];
const AREA_SLOT = { terrain: 'terraform', surface: 'wheels', material: 'draw', exclude: 'exclude', zones: 'exclude', ttype: 'cover' };
const AREA_SUFFIX = { terrain: '~t', surface: '~w', material: '~d', exclude: '~x', zones: '~x', ttype: '~c' };
const AREA_TERRAFORM = ['flatten', 'raise', 'ramp'];
const AREA_EXCLUDE = ['trees', 'plots', 'settle', 'rocks'];   // what an exclusion keeps out: the trees (drawn and collidable), the plots a zone sows (and a forest's planting), the settlements; 'rocks' a word Jolene's data carries
const MARK_KINDS = ['parking', 'dock', 'hatch'];
const MARK_DEF = { parking: { bay: 2.7, depth: 5.5, aisle: 6.5, inset: 1, line: 0.12, colour: 'white', rows: 0 },
                   dock: { inset: 0.6, line: 0.2, colour: 'yellow', bollard: 9, edge: null },
                   hatch: { pitch: 1.4, bar: 0.45, inset: 0.6, colour: 'yellow' } };
// a ROUNDED RECTANGLE (the shape of a parking lot, a dock's quay): its polygon, counter-clockwise like roundPoly's
function rectPoly(Q) {
  const hw = Math.max(0.5, +Q.hw || 5), hd = Math.max(0.5, +Q.hd || 5), r = clamp(+Q.radius || 0, 0, Math.min(hw, hd) * 0.999);
  const yaw = +Q.yaw || 0, cs = Math.cos(yaw), sn = Math.sin(yaw), c = Q.c, out = [];
  const put = (x, z) => out.push([+(c[0] + x * cs - z * sn).toFixed(3), +(c[1] + x * sn + z * cs).toFixed(3)]);
  const cen = [[hw - r, hd - r], [-(hw - r), hd - r], [-(hw - r), -(hd - r)], [hw - r, -(hd - r)]];
  for (let k = 0; k < 4; k++) {
    if (r <= 0.01) { put(k === 0 || k === 3 ? hw : -hw, k < 2 ? hd : -hd); continue; }
    for (let i = 0; i <= 6; i++) { const a = (k + i / 6) * Math.PI / 2; put(cen[k][0] + Math.cos(a) * r, cen[k][1] + Math.sin(a) * r); }
  }
  return out;
}
const rectOk = Q => !!(Q && Array.isArray(Q.c) && isFinite(+Q.c[0]) && isFinite(+Q.c[1]) && +Q.hw > 0 && +Q.hd > 0);
const polyKey = poly => JSON.stringify(poly.map(q => [+q[0], +q[1]]));
const strip0 = (e, drop) => { const o = {}; for (const k of Object.keys(e)) if (drop.indexOf(k) < 0) o[k] = e[k]; return o; };
// may a v1 entry fold into an area? (a polygon, on no stage; a terrain modifier a polygon's; a zone only a clear one)
function areaFoldable(layer, e) {
  if (!e || typeof e.id !== 'string' || e.stage || !Array.isArray(e.poly) || e.poly.length < 3) return false;
  if (layer === 'terrain') return AREA_TERRAFORM.indexOf(e.kind) >= 0;
  if (layer === 'zones') return e.kind === 'clear';
  return AREA_LAYERS.indexOf(layer) >= 0;
}
// v1 -> v2: every foldable entry into an area, same poly = same area (one entry of a layer each). Returns the count.
function foldAreas(rec) {
  const L = rec.layers, groups = [], open = new Map();
  // the place every v1 entry has in its layer AS THE RECORD COMPOSES (its areas expanded): folding into a record that
  // already has areas pins every area entry's place too (its src), so every layer's order is kept exactly
  const pos = new Map();
  if (Array.isArray(L.areas) && L.areas.length) {
    const add = {};
    L.areas.forEach((a, ai) => { if (a) for (const q of areaEntries(a)) (add[q.layer] = add[q.layer] || []).push({ a, q, ord: q.ord, ai }); });
    for (const layer of AREA_LAYERS) {
      const old = L[layer] || [], ins = (add[layer] || []).sort((p, q) => (p.ord - q.ord) || (p.ai - q.ai));
      let i = 0, j = 0, p = 0;
      for (; i < old.length || j < ins.length; p++) {
        if (j < ins.length && (ins[j].ord <= p || i >= old.length)) { const A = ins[j++]; A.a.src = Object.assign({}, A.a.src, { [layer]: [A.q.entry.id, p] }); }
        else pos.set(old[i++], p);
      }
    }
  } else for (const layer of AREA_LAYERS) (L[layer] || []).forEach((e, i) => pos.set(e, i));
  for (const layer of AREA_LAYERS) {
    const arr = L[layer] || [];
    arr.forEach(e => {
      if (!areaFoldable(layer, e)) return;
      const i = pos.get(e);
      const key = (layer === 'material' && roundOk(e.round) ? 'round:' : '') + polyKey(e.poly), slot = AREA_SLOT[layer];
      let g = (open.get(key) || []).find(q => !q.slots[slot]);
      if (!g) { g = { poly: e.poly, slots: {}, src: {}, round: null }; groups.push(g); if (!open.has(key)) open.set(key, []); open.get(key).push(g); }
      g.slots[slot] = { layer, e }; g.src[layer] = [e.id, i];
      if (layer === 'material' && roundOk(e.round)) g.round = e.round;
    });
  }
  if (!groups.length) return 0;
  const gone = {};
  const areas = groups.map(g => {
    const S = g.slots, props = {};
    if (S.terraform) props.terraform = strip0(S.terraform.e, ['id', 'poly']);
    if (S.wheels) props.wheels = strip0(S.wheels.e, ['id', 'poly']);
    if (S.draw) props.draw = strip0(S.draw.e, ['id', 'poly', 'round']);
    if (S.exclude) props.exclude = S.exclude.layer === 'zones' ? { what: ['trees'], zone: strip0(S.exclude.e, ['id', 'poly', 'kind']) } : strip0(S.exclude.e, ['id', 'poly']);
    if (S.cover) props.cover = strip0(S.cover.e, ['id', 'poly']);
    for (const s in S) (gone[S[s].layer] = gone[S[s].layer] || new Set()).add(S[s].e);
    // the area's id: its surface's, else its draw's, else the first it came from (a place's prefix rides on every id)
    const first = ['surface', 'material', 'terrain', 'exclude', 'ttype', 'zones'].find(k => g.src[k]);
    const a = { id: g.src[first][0], poly: g.poly.map(q => [q[0], q[1]]), props, src: g.src };
    if (g.round) a.round = g.round;
    return a;
  });
  for (const k in gone) L[k] = L[k].filter(e => !gone[k].has(e));
  L.areas = (L.areas || []).concat(areas);
  return areas.length;
}
PREMISES_MIGRATORS[1] = r => { r.layers = Object.assign({}, r.layers); for (const k of AREA_LAYERS) if (Array.isArray(r.layers[k])) r.layers[k] = r.layers[k].slice(); foldAreas(r); return r; };
// an area's v1 entries: [{ layer, entry, ord }] (ord: its source's place in the layer; Infinity: a new one, at the end)
function areaEntries(a) {
  const P = (a && a.props) || {}, poly = a && a.poly, out = [];
  if (!Array.isArray(poly) || poly.length < 3) return out;
  const src = a.src || {};
  const idOf = layer => (src[layer] ? src[layer][0] : a.id + AREA_SUFFIX[layer]);
  const ordOf = layer => (src[layer] && isFinite(+src[layer][1]) ? +src[layer][1] : Infinity);
  const put = (layer, body) => out.push({ layer, entry: Object.assign({ id: idOf(layer) }, body, { poly }), ord: ordOf(layer) });
  if (P.terraform && AREA_TERRAFORM.indexOf(P.terraform.kind) >= 0) put('terrain', P.terraform);
  if (P.wheels && isFinite(+P.wheels.surface)) put('surface', P.wheels);
  if (P.draw && (P.draw.set || P.draw.look)) {
    const d = Object.assign({}, P.draw);
    if (roundOk(a.round) && !P.wheels) d.round = a.round;   // (a round draw's wheels are its look's - unless the area says its own)
    if (P.marks && MARK_KINDS.indexOf(P.marks.kind) >= 0) d.marks = P.marks;
    put('material', d);
  }
  if (P.exclude) {
    if (P.exclude.zone && typeof P.exclude.zone === 'object') put('zones', Object.assign({ kind: 'clear' }, P.exclude.zone));
    else { const x = strip0(P.exclude, ['zone']); if (!Array.isArray(x.what)) x.what = ['trees']; put('exclude', x); }
  }
  if (P.cover) put('ttype', P.cover);
  return out;
}
// the record with its areas folded back into the v1 layers it composes from (the same object when it has none)
function expandAreas(rec) {
  const A = rec && rec.layers && rec.layers.areas;
  if (!Array.isArray(A) || !A.length) return rec;
  const add = {};
  A.forEach((a, ai) => { if (a) for (const q of areaEntries(a)) (add[q.layer] = add[q.layer] || []).push({ e: q.entry, ord: q.ord, ai }); });
  const layers = Object.assign({}, rec.layers, { areas: [] });
  for (const L in add) {
    const ins = add[L].sort((p, q) => (p.ord - q.ord) || (p.ai - q.ai)), old = layers[L] || [], out = [];
    let i = 0, j = 0;
    while (i < old.length || j < ins.length) {
      if (j < ins.length && (ins[j].ord <= out.length || i >= old.length)) out.push(ins[j++].e);
      else out.push(old[i++]);
    }
    layers[L] = out;
  }
  return Object.assign({}, rec, { layers });
}
// the v1 entry an id names, in the expanded record: the area holding it and its property (the editor's selection)
function areaOfEntry(rec, id) {
  for (const a of (rec.layers && rec.layers.areas) || []) {
    if (a.id === id) return { area: a, prop: null };
    for (const q of areaEntries(a)) if (q.entry.id === id) return { area: a, prop: AREA_SLOT[q.layer], layer: q.layer };
  }
  return null;
}
// THE MARKS (G2912): weathered paint on an area's pavement, in the pavement's own frame (the polygon's bbox centre, turned
// by `yaw`: u = dx cos + dz sin, v = -dx sin + dz cos - polyGeometry's). Rectangles [u0, u1, v0, v1, kind, period, axis,
// span] as PAVEMENT's marks are (a period > 0: the box repeats along the axis), kind 0 white, 1 yellow; the renderer adds
// the mesh's u offset. Every mark lies inside the shape by `inset` (the gate holds it); the paint's age is the pavement's
// (pav.paintAge, the shader's chalk and wear). `water(edgeIndex)` > 0 says an edge's outside is water (the dock's side).
//   parking  rows of bays across v: a row `depth` deep facing an aisle, back to back with the next, the separators a rule
//   dock     the quay's edge line along the water's edge (inset from it) and the bollard spots every `bollard` metres
//   hatch    keep-clear bars every `pitch` across the largest box inside the shape, and the box's outline
function areaMarks(poly, spec, frame, water) {
  const S = Object.assign({}, MARK_DEF[spec && spec.kind] || {}, spec || {}), out = { rects: [], segs: [], kind: S.kind, n: 0, issues: [] };
  if (!Array.isArray(poly) || poly.length < 3 || MARK_DEF[S.kind] === undefined) return out;
  const yaw = +(frame && frame.yaw) || 0, c = Math.cos(yaw), sn = Math.sin(yaw);
  const bb = polyBBox(poly), cx = frame && isFinite(frame.cx) ? frame.cx : (bb.x0 + bb.x1) / 2, cz = frame && isFinite(frame.cz) ? frame.cz : (bb.z0 + bb.z1) / 2;
  const P = poly.map(q => { const dx = q[0] - cx, dz = q[1] - cz; return [dx * c + dz * sn, -dx * sn + dz * c]; });
  const kind = S.colour === 'white' ? 0 : 1, ins = Math.max(0, +S.inset || 0);
  // the polygon's inside along a line v = const: [u0, u1] intervals, each shrunk by the inset
  const spans = v => { const xs = []; for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const a = P[i], b = P[j]; if ((a[1] > v) !== (b[1] > v)) xs.push(a[0] + (v - a[1]) / (b[1] - a[1]) * (b[0] - a[0])); } xs.sort((p, q) => p - q); const o = []; for (let k = 0; k + 1 < xs.length; k += 2) if (xs[k + 1] - xs[k] > 2 * ins) o.push([xs[k] + ins, xs[k + 1] - ins]); return o; };
  // the inside over a band [va, vb]: the intervals every line of the band agrees on, and each kept off the band's corners
  const band = (va, vb) => {
    let cur = null;
    for (let k = 0; k <= 4; k++) { const sp = spans(va + (vb - va) * k / 4 + (k === 0 ? 1e-6 : k === 4 ? -1e-6 : 0)); cur = cur === null ? sp : cur.map(I => { let best = null; for (const J of sp) { const lo = Math.max(I[0], J[0]), hi = Math.min(I[1], J[1]); if (hi > lo && (!best || hi - lo > best[1] - best[0])) best = [lo, hi]; } return best; }).filter(Boolean); }
    return (cur || []).filter(I => I[1] > I[0]);
  };
  let v0 = Infinity, v1 = -Infinity; for (const q of P) { v0 = Math.min(v0, q[1]); v1 = Math.max(v1, q[1]); }
  // a box's corners all inside by the inset (exact - a rounded corner sits nearer its diagonal than the band's lines say)
  const okBox = (a, b, p, q) => [[a, p], [b, p], [a, q], [b, q]].every(c => -sdPoly(P, c[0], c[1]) >= ins - 1e-6);
  const R = (a, b, p, q, k, per, ax, span) => out.rects.push([+a.toFixed(3), +b.toFixed(3), +p.toFixed(3), +q.toFixed(3), k === undefined ? kind : k, per || 0, ax || 0, span || 0]);
  const MAXR = 40;
  if (S.kind === 'parking') {
    const bay = Math.max(1.8, +S.bay || 2.7), depth = Math.max(3, +S.depth || 5.5), aisle = Math.max(0, +S.aisle || 0), lw = Math.max(0.05, +S.line || 0.12);
    const rows = [];
    for (let v = v0 + ins; ; ) {
      if (v + depth > v1 - ins) break;
      rows.push([v, v + depth, 0]);   // closed at v (its back line), open toward the aisle
      const vb = v + depth + aisle;
      if (vb + depth > v1 - ins) break;
      rows.push([vb, vb + depth, 1]);   // across the aisle, closed at its far side
      v = vb + depth;
      if (S.rows > 0 && rows.length >= S.rows) break;
    }
    let capped = false;
    for (const [va, vb, side] of rows) {
      if (capped) break;
      for (const I of band(va, vb)) {
        let n = Math.floor((I[1] - I[0]) / bay);
        // the end bays off the shape's corners: one fewer until the end separators stand inside by the inset
        while (n >= 1 && !(okBox((I[0] + I[1]) / 2 - n * bay / 2 - lw / 2, (I[0] + I[1]) / 2 - n * bay / 2 + lw / 2, va, vb) && okBox((I[0] + I[1]) / 2 + n * bay / 2 - lw / 2, (I[0] + I[1]) / 2 + n * bay / 2 + lw / 2, va, vb))) n--;
        if (n < 1) continue;
        if (out.rects.length + 2 > MAXR) { out.issues.push('parking: more rows than the pavement paints (' + MAXR + ' marks) - a smaller lot, or two'); capped = true; break; }
        const u0 = (I[0] + I[1]) / 2 - n * bay / 2;
        R(u0 - lw / 2, u0 + n * bay + lw / 2, va, vb, kind, bay, 0, lw);   // the bays' separators
        const vb0 = side ? vb - lw : va; R(u0, u0 + n * bay, vb0, vb0 + lw);   // the row's back line
        out.n += n;
      }
    }
  } else if (S.kind === 'dock') {
    // the quay's edge: the one named, else the longest whose outside is water, else the longest
    let best = -1, bl = -1;
    const edges = P.map((a, i) => { const b = P[(i + 1) % P.length]; return { i, a, b, l: Math.hypot(b[0] - a[0], b[1] - a[1]) }; });
    if (S.edge !== null && S.edge !== undefined && edges[+S.edge]) best = +S.edge;
    else { for (const e of edges) { const w = water ? water(e.i) : 0; const sc = e.l * (w > 0 ? 10 : 1); if (sc > bl) { bl = sc; best = e.i; } } if (water && !(water(best) > 0)) out.issues.push('dock: no edge of this shape meets the water - its longest is the quay'); }
    const E = edges[best];
    if (E) {
      const lw = Math.max(0.05, +S.line || 0.2), du = E.b[0] - E.a[0], dv = E.b[1] - E.a[1], L = E.l || 1, tu = du / L, tv = dv / L;
      // the inward normal: the side the polygon's centre lies on
      let nu = -tv, nv = tu; { let mx = 0, mz = 0; for (const q of P) { mx += q[0] / P.length; mz += q[1] / P.length; } if ((mx - E.a[0]) * nu + (mz - E.a[1]) * nv < 0) { nu = -nu; nv = -nv; } }
      const off = ins + lw / 2, end = Math.min(L / 2, ins + 0.5);
      if (Math.abs(tv) < 0.02) {   // the quay runs along u (the pavement turned to it): a box and a rule of bollards
        const vL = E.a[1] + nv * off, ua = Math.min(E.a[0], E.b[0]) + end, ub = Math.max(E.a[0], E.b[0]) - end;
        if (ub > ua) {
          R(ua, ub, vL - lw / 2, vL + lw / 2);
          const sp = Math.max(3, +S.bollard || 9), nb = Math.floor((ub - ua) / sp), bs = 0.5, vB = E.a[1] + nv * (off + lw / 2 + 0.6 + bs / 2), uB = (ua + ub) / 2 - nb * sp / 2;
          if (nb >= 1) R(uB - bs / 2, uB + nb * sp + bs / 2, vB - bs / 2, vB + bs / 2, kind, sp, 0, bs);
          out.n = nb + 1;
        }
      } else {   // any other heading: the line as a segment (the pavement's segment slots; no bollard row)
        const a = [E.a[0] + tu * end + nu * off, E.a[1] + tv * end + nv * off], b = [E.b[0] - tu * end + nu * off, E.b[1] - tv * end + nv * off];
        out.segs.push([+a[0].toFixed(3), +a[1].toFixed(3), +b[0].toFixed(3), +b[1].toFixed(3), lw, kind]); out.n = 1;
        out.issues.push('dock: turn the pavement to the quay (its lanes along the water) for the bollards');
      }
      out.edge = best;
    }
  } else if (S.kind === 'hatch') {
    // the largest box inside: the band of v (in 24 steps) whose common interval times its height is the most
    let bestA = 0, box = null;
    const nS = 24, vs = []; for (let k = 0; k <= nS; k++) vs.push(v0 + (v1 - v0) * k / nS);
    for (let a = 0; a < nS; a++) for (let b = a + 1; b <= nS; b++) {
      const va = vs[a] + ins, vb = vs[b] - ins; if (vb - va < 1) continue;
      for (const I of band(va, vb)) { const A2 = (I[1] - I[0]) * (vb - va); if (A2 > bestA) { bestA = A2; box = [I[0], I[1], va, vb]; } }
    }
    // (shrunk a quarter metre at a time until its corners stand inside by the inset)
    for (let k = 0; box && k < 80 && !okBox(box[0], box[1], box[2], box[3]); k++) { box = [box[0] + 0.25, box[1] - 0.25, box[2] + 0.25, box[3] - 0.25]; if (box[1] - box[0] < 1 || box[3] - box[2] < 1) box = null; }
    if (box) {
      const pitch = Math.max(0.5, +S.pitch || 1.4), bar = Math.min(pitch * 0.8, Math.max(0.1, +S.bar || 0.45)), lw = 0.12;
      const n = Math.floor((box[1] - box[0] - 2 * lw) / pitch);
      if (n >= 1) { const u0 = (box[0] + box[1]) / 2 - n * pitch / 2 + (pitch - bar) / 2; R(u0, u0 + (n - 1) * pitch + bar, box[2] + lw, box[3] - lw, kind, pitch, 0, bar); }
      R(box[0], box[1], box[2], box[2] + lw); R(box[0], box[1], box[3] - lw, box[3]); R(box[0], box[0] + lw, box[2], box[3]); R(box[1] - lw, box[1], box[2], box[3]);
      out.n = Math.max(0, n); out.box = box;
    }
  }
  if (!out.rects.length && !out.segs.length) out.issues.push(S.kind + ': the shape is too small for its marks');
  return out;
}
// what an area is, in a few words (the editor's lists; the inspector's header): its draw, else its wheels, else what it does
function areaLabel(a) {
  const P = (a && a.props) || {};
  if (a && a.name) return a.name;
  if (P.draw && P.draw.look && RUNWAY_LOOKS[P.draw.look]) return (RUNWAY_LOOKS[P.draw.look].name || P.draw.look).toLowerCase() + (P.marks ? ' (' + P.marks.kind + ')' : '');
  if (P.draw && P.draw.set) return P.draw.set + ' ground';
  if (P.wheels) return (SURFACE_NAMES[+P.wheels.surface] || 'surface').toLowerCase() + (P.wheels.apron ? ' apron' : ' area');
  if (P.terraform) return P.terraform.kind === 'raise' ? 'raise / lower' : P.terraform.kind === 'ramp' ? 'slope' : 'flat';
  if (P.cover) return 'vegetation';
  if (P.exclude) return 'no ' + ((P.exclude.what || ['trees']).join(', ') || 'trees');
  return 'area';
}

// ---------------------------------------------------------------------------
// compose — the overlay a world composes at its terrainH seam
// ---------------------------------------------------------------------------
function compose(rec0, world, opts) {
  const o = opts || {};
  // THE STAGES (v1.33): the record as it stands at `o.tracks` (absent: the sandbox, every track at its max) - an
  // unstaged record is untouched, and a staged one composes exactly as its stageView would
  const SV = stageView(normalise(rec0), o.tracks);
  // (v1.36: the areas composed as the v1 entries they expand into - expandAreas; O.rec is that record)
  const recA = SV.staged ? normalise(SV.rec) : normalise(rec0), areasRaw = recA.layers.areas.slice();   // (G2953: the roadside aprons read the areas themselves)
  const rec = expandAreas(recA);
  const F = frameOf(rec, world);
  const mods = [];
  for (const m of rec.layers.terrain) { const M = makeModifier(m, F.y0); if (M) mods.push(M); }
  // T1: the authored modifiers alone, in the premises frame, to read a road's node heights from
  const T1 = (lx, lz) => { const w = F.toWorld(lx, lz); let h = world.terrainH(w[0], w[1]); for (const M of mods) h = M.apply(lx, lz, h); return h; };
  // THE ROADS (stage 2): a graded road is a DERIVED grade whose nodes sit on
  // T1, 3-tap smoothed along the profile (WORLD-GEN-PROC stage 3's roadbed
  // rule: flat across, the profile smoothed along); a surface strip of its class
  // `smooth` (v1.19) is applied HERE, once, so every reader sees the same line
  // (v1.35: `curve: 'spline'` the same way - roadLine)
  const roads = rec.layers.roads.filter(r => r.pts && r.pts.length >= 2).map(straightOf)
    .map(r => (r.curve === 'spline' || r.smooth ? Object.assign({}, r, { pts: roadLine(r), wp: r.wp || r.pts }) : r));   // (G2950: `wp` its waypoints, where its junctions are)
  // `traffic` (contract v1.13, G432): vehicles per km the renderer runs up and down the road - 0 or absent, none
  // `ribbon` false (G434): the renderer draws no ribbon over it - a taxiway under a material polygon of its own
  const roadObjs = roads.map(r => Object.assign({ id: r.id, pts: r.pts, w: +r.w || 3.6, surface: r.surface !== undefined ? +r.surface : (ROAD_CLS[r.cls] !== undefined ? ROAD_CLS[r.cls] : SURFACE.GRAVEL), traffic: Math.max(0, +r.traffic || 0), ribbon: r.ribbon !== false,
    look: roadLook(r).key, band: r.band === undefined ? null : r.band, pav: r.pav || null }, roadClearOf(r) !== null ? { clear: roadClearOf(r) } : {}));   // (G2918: its own clearing) the pavement's (v1.16)
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
      aerodromes.push(stageAero(runwayAerodrome(r, F, isFinite(wl) ? wl : 0, [], null), r));
      // G2310: a lane's site is its PLOTS alone (the slipways), each shed on the shore's composed ground; no plots, no site
      r.site = Array.isArray(r.plots) && r.plots.length ? runwaySite(r, F) : null;
      if (r.site && r.site.plots) for (const p of r.site.plots) { const L = F.toLocal(p.x, p.z); p.y = +T1(L[0], L[1]).toFixed(2); }
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
    aerodromes.push(stageAero(runwayAerodrome(r, F, elev, rec.layers.terrain.filter(m => m.kind === 'flatten' && m.poly && m.poly.length >= 3).map(m => m.poly), T1, roads.filter(q => q.graded !== false)), r));   // T1 sees the strip's own grade (pushed above)
    r.site = runwaySite(r, F);   // the composed runway's site: the stand and the way out in the world, the authored pattern kept
    // G710: THE PARKED AEROPLANES the way out must clear (25_airfield.js gpClearWay): every `aircraft`
    // object within 400 m of the stand or a taxi point, in the world (x, z, and `ry` = rotation.y, the
    // record's yaw plus the frame's - render_premises' own placement), its key naming the footprint
    if (r.site && r.site.stand && r.site.taxiOut) {
      const way = [[r.site.stand.x, r.site.stand.z]].concat(r.site.taxiOut), park = [];
      for (const ob of rec.layers.objects || []) {
        if (ob.kind !== 'aircraft' || !ob.key || !isFinite(+ob.x) || !isFinite(+ob.z)) continue;
        const w = F.toWorld(+ob.x, +ob.z);
        if (way.some(q => Math.hypot(q[0] - w[0], q[1] - w[1]) < 400))
          park.push({ id: ob.id, key: ob.key, x: +w[0].toFixed(3), z: +w[1].toFixed(3), ry: +((+ob.yaw || 0) + F.yaw).toFixed(4) });
      }
      if (park.length) r.site.parked = park;
    }
    if (r.site && r.site.stand) { const L = F.toLocal(r.site.stand.x, r.site.stand.z); r.site.stand.elev = +T1(L[0], L[1]).toFixed(2); }   // the ground under the stand (v9): the placer reads it
    if (r.site && r.site.hangar) { const L = F.toLocal(r.site.hangar.x, r.site.hangar.z); r.site.hangar.y = +T1(L[0], L[1]).toFixed(2); }   // the ground under the club hangar (G434): the shed stands on it
    if (r.site && r.site.plots) for (const p of r.site.plots) {   // G2310: each plot's shed on its ground, its own stand's ground (the placer reads it)
      const L = F.toLocal(p.x, p.z); p.y = +T1(L[0], L[1]).toFixed(2);
      if (p.stand) { const Ls = F.toLocal(p.stand.x, p.stand.z); p.stand.elev = +T1(Ls[0], Ls[1]).toFixed(2); }
    }
  }
  // THE ROADS (stage 3): a road's nodes sit on the ground AFTER the runways graded it
  const T1r = (lx, lz) => { const w = F.toWorld(lx, lz); let h = world.terrainH(w[0], w[1]); for (const M of mods) h = M.apply(lx, lz, h); return h; };
  const JH = new Map();   // (G2950) a junction's height: the first road graded through it sets it
  for (const r of roads) {
    if (r.graded === false) continue;
    // THE ROAD FOLLOWS THE GROUND (v6): its grade is read every 6 m along the traced line, not only at
    // the traced points - between two points 45 m apart a flatten's bank rose 14 m and a straight
    // grade cut a 3.5:1 step through it; smoothed four times over three samples so it stays a road
    const dense = [];
    for (let i = 0; i + 1 < r.pts.length; i++) { const a = r.pts[i], b = r.pts[i + 1], L = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.ceil(L / 6)); for (let k = 0; k < n; k++) { const u = k / n; dense.push([a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u]); } }
    dense.push(r.pts[r.pts.length - 1]);
    let hs = dense.map(p => T1r(p[0], p[1]));
    // THE ROAD BED (contract v1.37, G2952; the user, 11 Oct: "the road is sunk in many places. Maybe build a little bank or
    // something, ensuring the paved surface is always visible"): a road with `bed` stands on its own bed - its surface is
    // never under the ground ACROSS its paved width (the edges read too, plus `fill`), the dips are FILLED to its grade
    // (an embankment, never a cut: a road over the ground stands over any coarse mesh of it), and its banks run `bank`
    // metres back to the terrain. Without `bed` (every shipped road): today's road, to the bit.
    const BED = bedOf(r);
    let floor = null;
    if (BED) {
      const hw = (+r.w || 3.6) / 2;
      floor = dense.map((p, i) => {
        const a = dense[Math.max(0, i - 1)], b = dense[Math.min(dense.length - 1, i + 1)], dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz) || 1, nx = -dz / l, nz = dx / l;
        return Math.max(hs[i], T1r(p[0] + nx * hw, p[1] + nz * hw), T1r(p[0] - nx * hw, p[1] - nz * hw)) + BED.fill;
      });
      hs = floor.slice();
    }
    for (let pass = 0; pass < 4; pass++) hs = hs.map((h, i) => (i === 0 || i === hs.length - 1) ? h : (hs[i - 1] + 2 * h + hs[i + 1]) / 4);
    if (BED) {
      // back over the ground where the smoothing took a crest under it, then the dips filled to the bed's grade both ways
      const g = BED.grade, ds = i => Math.hypot(dense[i][0] - dense[i - 1][0], dense[i][1] - dense[i - 1][1]);
      for (let i = 0; i < hs.length; i++) if (hs[i] < floor[i]) hs[i] = floor[i];
      for (let i = 1; i < hs.length; i++) hs[i] = Math.max(hs[i], hs[i - 1] - g * ds(i));
      for (let i = hs.length - 2; i >= 0; i--) hs[i] = Math.max(hs[i], hs[i + 1] - g * ds(i + 1));
    }
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
    // THE JUNCTIONS' LEVEL (v1.37, G2950): the roads through a junction meet it at ONE height. A road that ENDS there (a
    // spur) takes the height the junction has; a road that passes THROUGH it takes it from a road crossing it before (a
    // crossing: the first graded sets it) but never from a spur's end - the through road is graded as it is, and sets the
    // height for the roads after it. Held 7 m either side of the waypoint, eased back over 7 more. A road without junction
    // ids: today's, to the bit.
    let jAt = null;
    if (Array.isArray(r.nodes) && r.nodes.some(Boolean)) {
      const W = r.wp || r.pts, s = [0];
      for (let k = 1; k < dense.length; k++) s.push(s[k - 1] + Math.hypot(dense[k][0] - dense[k - 1][0], dense[k][1] - dense[k - 1][1]));
      jAt = [];
      let k0 = 0;
      for (let i = 0; i < W.length && i < r.nodes.length; i++) {
        let best = k0, bd = Infinity; for (let k = k0; k < dense.length; k++) { const d = Math.hypot(dense[k][0] - W[i][0], dense[k][1] - W[i][1]); if (d < bd) { bd = d; best = k; } if (bd < 0.01 || (s[k] - s[k0] > 400 && bd < 30)) break; }
        k0 = best;
        const jid = r.nodes[i]; if (!jid) continue;
        // the waypoint's own place along the line (its projection on the samples' segments either side: a junction on a
        // straight span is no sample of its own - straightOf - and the height is read there, not at the nearest sample)
        let sj = s[best], pd = bd;
        for (const k of [best - 1, best]) { if (k < 0 || k + 1 >= dense.length) continue; const a = dense[k], b = dense[k + 1], dx = b[0] - a[0], dz = b[1] - a[1], l2 = dx * dx + dz * dz; if (l2 < 1e-12) continue; const t = Math.max(0, Math.min(1, ((W[i][0] - a[0]) * dx + (W[i][1] - a[1]) * dz) / l2)), d = Math.hypot(a[0] + dx * t - W[i][0], a[1] + dz * t - W[i][1]); if (d < pd) { pd = d; sj = s[k] + t * (s[k + 1] - s[k]); } }
        const isEnd = i === 0 || i === W.length - 1;
        jAt.push([jid, sj, isEnd]);
        if (!JH.has(jid) || (!isEnd && JH.get(jid).end)) continue;
        const H = JH.get(jid).h;
        for (let k = 0; k < dense.length; k++) { const d = Math.abs(s[k] - sj); if (d >= 14) continue; const u = d <= 7 ? 0 : (d - 7) / 7, w = u * u * (3 - 2 * u); hs[k] = H + (hs[k] - H) * w; }
      }
      jAt.s = s;
    }
    // a level approach at both ends: a road that starts on another road (a spur off the shore road) must
    // not lift the first road's edge on its first metres - the height is held for 7 m from each end
    { let acc = 0; for (let i = 1; i < dense.length; i++) { acc += Math.hypot(dense[i][0] - dense[i - 1][0], dense[i][1] - dense[i - 1][1]); if (acc < 7) hs[i] = hs[0]; else break; } acc = 0; for (let i = dense.length - 2; i >= 0; i--) { acc += Math.hypot(dense[i][0] - dense[i + 1][0], dense[i][1] - dense[i + 1][1]); if (acc < 7) hs[i] = hs[dense.length - 1]; else break; } }
    if (jAt) {
      // the road's height AT each junction's place (between its samples) - what the roads after it meet
      const s = jAt.s, hAtS = sj => { let k = 0; while (k + 2 < s.length && s[k + 1] < sj) k++; const L = s[k + 1] - s[k]; return L > 1e-9 ? hs[k] + (hs[k + 1] - hs[k]) * Math.max(0, Math.min(1, (sj - s[k]) / L)) : hs[k]; };
      for (const [jid, sj, isEnd] of jAt) if (!JH.has(jid) || (!isEnd && JH.get(jid).end)) JH.set(jid, { h: hAtS(sj), end: isEnd });
    }
    const M = makeModifier({ id: r.id + ':grade', kind: 'grade', pts: dense.map((p, i) => [p[0], p[1], hs[i]]), width: (+r.w || 3.6) + (BED ? 2 * BED.shoulder : 0), falloff: BED ? BED.bank : (+r.falloff || 6), abs: true }, F.y0);
    if (M) mods.push(M);
  }
  // THE GROUND UNDER THE SITES (stage 5 -> T2): every item's shelf, from its entry, cut before anything is placed
  const catS = o.catalogue || collect(o.globals || (typeof window !== 'undefined' ? window : {}));
  const T1s = (lx, lz) => { const w = F.toWorld(lx, lz); let h = world.terrainH(w[0], w[1]); for (const M of mods) h = M.apply(lx, lz, h); return h; };
  const shelves = [];
  for (const st of rec.layers.sites) for (const sh of siteShelves(st, catS, T1s)) { const M = makeModifier(sh, F.y0); if (M) { mods.push(M); shelves.push(sh); } }
  const index = SpatialIndex(256);
  mods.forEach((M, i) => { M.ord = i; index.add(M.bbox, M); });   // ord: the order every point applies them in (G611)
  // the surface polygons in PRIORITY order (z, then the record's order): the last wins at a point
  // (v1.35: a ROUND PAD's wheels feel its look's class - after every authored polygon of its priority)
  const surf = rec.layers.surface.filter(s => s.poly && s.poly.length >= 3).map((s, i) => ({ poly: s.poly, bbox: polyBBox(s.poly), surface: +s.surface, z: +s.z || 0, i }))
    .concat(rec.layers.material.filter(m => roundOk(m.round) && m.poly && m.poly.length >= 3 && m.look && RUNWAY_LOOKS[m.look] && RUNWAY_LOOKS[m.look].surface !== null && RUNWAY_LOOKS[m.look].surface !== undefined)
      .map((m, k) => ({ poly: m.poly, bbox: polyBBox(m.poly), surface: +RUNWAY_LOOKS[m.look].surface, z: +m.z || 0, i: 1e6 + k, pad: m.id })))
    .sort((a, b) => (a.z - b.z) || (a.i - b.i));
  // THE MATERIALS (v8, contract v1.9): a PBR set projected on the ground inside a polygon, its contour
  // fading over `fade` metres (half in, half out) into what lies under it, composited in priority order
  // THE PAVED POLYGONS (v1.16): a material polygon with a `look` (a pavement class) instead of a set is an
  // apron, a turnaround, a pad - the pavement module draws it, the map never sees it
  const pavePolys = rec.layers.material.filter(m => m.poly && m.poly.length >= 3 && m.look && RUNWAY_LOOKS[m.look] && RUNWAY_LOOKS[m.look].cls)
    .map(m => ({ id: m.id, poly: m.poly, bbox: polyBBox(m.poly), look: m.look, band: m.band === undefined ? null : m.band, pav: m.pav || null, yaw: +m.yaw || 0, z: +m.z || 0, stands: m.stands || null,
                 marks: m.marks && MARK_KINDS.indexOf(m.marks.kind) >= 0 ? m.marks : null }));
  // (v1.36, G2912) A DOCK'S WATER: for a pavement wearing dock marks, how much of each edge's outside is water - three
  // points 4 m out from the edge, water standing 20 cm over the ground there (areaMarks puts the quay's line on that edge)
  for (const pp of pavePolys) if (pp.marks && pp.marks.kind === 'dock' && world.waterH) {
    const n = pp.poly.length; pp.waterEdges = [];
    for (let i = 0; i < n; i++) {
      const a = pp.poly[i], b = pp.poly[(i + 1) % n], L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, nx = (b[1] - a[1]) / L, nz = -(b[0] - a[0]) / L;
      let wet = 0;
      for (const t of [0.25, 0.5, 0.75]) {
        const mx = a[0] + (b[0] - a[0]) * t, mz = a[1] + (b[1] - a[1]) * t, sg = inPoly(pp.poly, mx + nx * 0.5, mz + nz * 0.5) ? -1 : 1;
        const w = F.toWorld(mx + nx * 4 * sg, mz + nz * 4 * sg), wl = world.waterH(w[0], w[1]);
        if (isFinite(wl) && wl > world.terrainH(w[0], w[1]) + 0.2) wet++;
      }
      pp.waterEdges.push(wet / 3);
    }
  }
  const mats = rec.layers.material.filter(m => m.poly && m.poly.length >= 3 && m.set && !m.look).map((m, i) => ({ id: m.id, poly: m.poly, bbox: polyBBox(m.poly), set: String(m.set), tile: m.tile > 0 ? +m.tile : null, fade: Math.max(0, +m.fade || 0), z: +m.z || 0, i })).sort((a, b) => (a.z - b.z) || (a.i - b.i));
  // the weight of one material at a point: 1 well inside, 0 well outside, a smoothstep across the fade band
  const matWeight = (m, lx, lz) => { const d = -sdPoly(m.poly, lx, lz); if (m.fade <= 0) return d >= 0 ? 1 : 0; const u = (d + m.fade / 2) / m.fade; return u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u); };
  // G1091: the trees' variant (rwyTreesMode) - a data island's only; and each exclude says which of the runway
  // clearances it is: `rwy` the strip's box + 30 m (b), `shoulder` a runway's gravel shoulder (c), `fan` an
  // approach fan (e) - so excludeAt(.., 'trees') can drop them by the variant and the gates can name them
  const RWT = /^ISLAND-/.test(String(world.id || '')) ? rwyTreesMode(o) : 'today';
  const landRwy = runways.filter(r => !runwayIsWater(r));
  // an approach fan: an authored exclude of trees and nothing else that opens off a strip's end - a corner within
  // 100 m of the end, its centre beyond the end along the axis (x_fan13_*, x_fan02_*, x_fan3_*, mn_x_fan_n, nv_fan_*)
  const fanOf = (poly, what) => {
    if (!(what.length === 1 && what[0] === 'trees')) return null;
    let cx = 0, cz = 0; for (const q of poly) { cx += q[0] / poly.length; cz += q[1] / poly.length; }
    for (const r of landRwy) {
      const E = runwayEnds(r);
      for (const [k, e] of [[0, E.end0], [1, E.end1]]) {
        const near = poly.some(q => Math.hypot(q[0] - e[0], q[1] - e[1]) < 100);
        const u = (cx - r.c[0]) * E.d[0] + (cz - r.c[1]) * E.d[1];
        if (near && (k ? u : -u) > r.len / 2) return r.id + (k ? '/1' : '/0');
      }
    }
    return null;
  };
  // a runway's shoulder: a GRAVEL / SAND surface polygon lying inside the strip's reach (its band + the fade + 6 m, the
  // coverAt index's) and running along it for at least half its length (y_sh13_*, y_sh02_*; not a yard or a stand)
  const shoulderOf = poly => {
    for (const r of landRwy) {
      const E = runwayEnds(r), reach = r.wid / 2 + paveBand(r, (RUNWAY_LOOKS[r.look] || RUNWAY_LOOKS.grass).cls || 'grass', false) + PAVE_FADE + 6;
      let u0 = Infinity, u1 = -Infinity, inside = true;
      for (const q of poly) {
        const dx = q[0] - r.c[0], dz = q[1] - r.c[1], u = dx * E.d[0] + dz * E.d[1], v = dx * E.n[0] + dz * E.n[1];
        if (Math.abs(v) > reach + 0.5 || Math.abs(u) > r.len / 2 + reach) { inside = false; break; }
        u0 = Math.min(u0, u); u1 = Math.max(u1, u);
      }
      if (inside && u1 - u0 >= r.len / 2) return r.id;
    }
    return null;
  };
  const excl = rec.layers.exclude.filter(s => s.poly && s.poly.length >= 3).map(s => { const what = s.what || ['trees'], fan = fanOf(s.poly, what); return Object.assign({ poly: s.poly, bbox: polyBBox(s.poly), what, id: s.id || null }, fan ? { fan } : {}); });
  // (G1385: a strip with its own `clear` hands its trees to that clearance - the box + 30 m keeps the plots and the
  // settlements off, and a clearance narrower than 30 m is then what the user asked for, not the box's)
  for (const r of runways) { if (runwayIsWater(r)) continue; const box = runwayBox(r, 30); excl.push({ poly: box, bbox: polyBBox(box), what: runwayClearOf(r) ? ['settle', 'plots'] : ['trees', 'settle', 'plots'], derived: true, runway: r.id, rwy: true }); }
  // a hard surface (paved / gravel / sand) grows no tree and takes no plot: an apron is an apron
  for (const sp of rec.layers.surface) if (sp.poly && sp.poly.length >= 3 && [SURFACE.PAVED, SURFACE.GRAVEL, SURFACE.SAND].indexOf(+sp.surface) >= 0) {
    const sh = +sp.surface !== SURFACE.PAVED ? shoulderOf(sp.poly) : null;
    excl.push(Object.assign({ poly: sp.poly, bbox: polyBBox(sp.poly), what: ['trees', 'plots'], derived: true, surface: sp.id }, sh ? { shoulder: sh } : {}));
  }
  // G1091: which runway clearances the variant lifts, for TREES only (a strip's box still keeps plots and settlements
  // off): 'map' all three, 'mapx' the box alone (the shoulders and the fans stay)
  const treeOff = e => RWT !== 'today' && (e.rwy || (RWT === 'map' && (e.shoulder || e.fan)));
  // a clear zone is a derived exclude of trees
  for (const z of rec.layers.zones) if (z.kind === 'clear' && z.poly && z.poly.length >= 3) excl.push({ poly: z.poly, bbox: polyBBox(z.poly), what: ['trees'], derived: true });
  // THE TTYPE STAMPS (v1.20): each polygon with the code it stamps. 0 sea and 1 lake are
  // never overwritten - the water is not a place's to re-classify - and the codes
  // the ISLAND itself derives (12 cliff, 13 forest old, 14 scrub dense) are not
  // stamped either: they are a slope and a canopy, not a polygon.
  // THE JUNCTIONS CLOSE (G981, the user: "in the junctions between the different aprons and runways, there are gaps,
  // and it would be good that the pavement is continuous"). A taxiway ribbon stopped where it was traced: r_taxi_ne
  // 7.2 m short of 13/31's edge, r_taxi_e 5 m short of the pad - the ground showed through. A road END within JOIN m of
  // a strip's pavement or a paved polygon (or already on it) is carried along its own tangent until it lies OVER m
  // inside; the renderer fades that end out over the overlap (fadeA / fadeB, metres) and fades any road or apron
  // surface inside a strip's box, so one surface shows at every junction and nothing is drawn twice at full weight.
  // Only the drawn / classed line moves (roadObjs: surfaceAt, coverAt, pavedAt, the ribbon); the grade (stage 3)
  // keeps the traced points, so the runway's own ground is not re-graded under the extension.
  {
    const JOIN = 15, OVER = 3.5;
    const tgts = runways.filter(r => !runwayIsWater(r)).map(r => ({ kind: 'strip', poly: runwayBox(r, 0) }))
      .concat(pavePolys.map(pp => ({ kind: 'poly', poly: pp.poly })));
    const sdT = (x, z) => { let d = Infinity, k = null; for (const t of tgts) { const e = sdPoly(t.poly, x, z); if (e < d) { d = e; k = t.kind; } } return [d, k]; };
    for (const ro of roadObjs) {
      if (ro.runway || ro.ribbon === false || !ro.pts || ro.pts.length < 2) continue;
      const pts = ro.pts.slice();
      for (const end of [0, 1]) {
        const i = end ? pts.length - 1 : 0, j = end ? pts.length - 2 : 1, P = pts[i], Q = pts[j];
        const l = Math.hypot(P[0] - Q[0], P[1] - Q[1]); if (!(l > 1e-6)) continue;
        const dx = (P[0] - Q[0]) / l, dz = (P[1] - Q[1]) / l;
        let [d0, kind] = sdT(P[0], P[1]);
        if (d0 > JOIN) continue;
        let np = P;
        if (d0 > -OVER) {
          let got = null;
          for (let t = 0.5; t <= JOIN + OVER + ro.w; t += 0.5) { const x = P[0] + dx * t, z = P[1] + dz * t, r = sdT(x, z); if (r[0] <= -OVER) { got = [x, z]; kind = r[1]; break; } }
          if (!got) continue;
          np = got;
        }
        if (np !== P) { if (end) pts.push(np); else pts.unshift(np); }
        ro[end ? 'fadeB' : 'fadeA'] = kind === 'strip' ? 0 : 3;   // in a strip's box the renderer's box fade takes it
        ro[end ? 'joinB' : 'joinA'] = kind;
      }
      ro.pts = pts;
      // a TAXIWAY: a concrete road 10 m wide or more that meets a strip or an apron - its sides are the airfield's (G980)
      ro.taxiway = (RUNWAY_LOOKS[ro.look] || {}).cls === 'concrete' && ro.w >= 10 && !!(ro.joinA || ro.joinB);
      // G1391 (RUNWAY-LOOK): a SIDED road fades its side out over PAVE_SIDE as a strip does (its declared width the drawn
      // one) - every road but one whose entry declares its own band, unless the premises' recipe says roadSide 0
      ro.sided = ro.taxiway || ((ro.band === null || ro.band === undefined) && !(rec.pavement && +rec.pavement.roadSide === 0));
    }
  }
  // A ROAD'S CLEARING (contract v1.36, G2918; the user, 11 Oct: "remove the trees and the grass from the road, maybe with a
  // certain distance as a parameter (can be zero)"): `clear` metres past its paved edge (0: the road itself), the trees out
  // (an exclusion band: excludeAt answers by the road's own distance, exact) and the grass and the bushes (coverAt's kill,
  // above). The band is filed in PIECES (its runs through 200 m cells), each its own region keyed by its own line - an edit
  // regrows the trees under the pieces it moved, never the whole of an island-long road. Unset: today's road.
  for (const ro of roadObjs) {
    if (ro.runway || !(ro.clear >= 0) || !ro.pts || ro.pts.length < 2) continue;
    const half = ro.w / 2 + ro.clear;
    // (the pieces are the line's runs through a 200 m grid's cells: an edit changes the runs it moved and no other - an
    // arclength cut would shift every piece past the edit)
    const cellOf = p => Math.floor(p[0] / 200) * 100003 + Math.floor(p[1] / 200);
    let piece = [ro.pts[0]], cur = cellOf(ro.pts[0]);
    const flush = () => {
      if (piece.length < 2) return;
      const pr = { pts: piece }, bb = polyBBox(piece), b = { x0: bb.x0 - half, z0: bb.z0 - half, x1: bb.x1 + half, z1: bb.z1 + half };
      // its outline (the readers of polygons: the forest's planting, the records): the line offset either side, mitred
      const L = [], Rt = [];
      for (let i = 0; i < piece.length; i++) {
        const a = piece[Math.max(0, i - 1)], c = piece[Math.min(piece.length - 1, i + 1)], dx = c[0] - a[0], dz = c[1] - a[1], l = Math.hypot(dx, dz) || 1;
        L.push([piece[i][0] - dz / l * half, piece[i][1] + dx / l * half]); Rt.push([piece[i][0] + dz / l * half, piece[i][1] - dx / l * half]);
      }
      excl.push({ poly: L.concat(Rt.reverse()), bbox: b, what: ['trees'], derived: true, roadClear: ro.id, bandRoad: pr, half });
    };
    for (let i = 1; i < ro.pts.length; i++) {
      piece.push(ro.pts[i]);
      const c = cellOf(ro.pts[i]);
      if (c !== cur && i < ro.pts.length - 1) { flush(); piece = [ro.pts[i]]; cur = c; }
    }
    flush();
  }
  // G980: the bands the ground's own code is drawn under (stampTtype): a strip's box and a paved polygon, each out
  // to its band + the fade (sd: + outside the pavement, metres; reach: how far out the stamp goes)
  const BAND_SKIP = [0, 1, 8, 12, 13, 16];   // water, forest, cliff, old forest, city trees: never what a cleared band copies
  const bandStamps = [];
  for (const r of runways) {
    if (runwayIsWater(r)) continue;
    const L = RUNWAY_LOOKS[r.look] || RUNWAY_LOOKS.grass, box = runwayBox(r, 0), reach = paveBand(r, L.cls || 'grass', false) + PAVE_FADE;
    bandStamps.push({ bbox: polyBBox(runwayBox(r, reach)), reach, sd: (x, z) => sdPoly(box, x, z) });
  }
  for (const ro of roadObjs) {   // a taxiway's sides are the airfield's too
    if (!ro.taxiway) continue;
    const reach = paveBand(ro, 'concrete', true) + PAVE_FADE, bb = polyBBox(ro.pts), m = ro.w / 2 + reach;
    bandStamps.push({ bbox: { x0: bb.x0 - m, z0: bb.z0 - m, x1: bb.x1 + m, z1: bb.z1 + m }, reach, sd: (x, z) => roadDist(ro, x, z) - ro.w / 2 });
  }
  for (const pp of pavePolys) {
    const reach = paveBand(pp, RUNWAY_LOOKS[pp.look].cls, true) + PAVE_FADE, bb = pp.bbox;
    bandStamps.push({ bbox: { x0: bb.x0 - reach, z0: bb.z0 - reach, x1: bb.x1 + reach, z1: bb.z1 + reach }, reach, sd: (x, z) => sdPoly(pp.poly, x, z) });
  }
  // (G1385: a cover polygon may carry only a vegetation - its code null, nothing stamped; +null is 0, the sea)
  const ttypes = rec.layers.ttype.filter(c => c.poly && c.poly.length >= 3 && hasCode(c))
    .map(c => ({ id: c.id, poly: c.poly, bbox: polyBBox(c.poly), code: Math.round(+c.code),
                 // `from` (contract v1.22): the codes this stamp is allowed to REPLACE. Without it a
                 // stamp is flat and paints the bog, the rock and the beach the same as the wood;
                 // with it, a belt of `forest old` thickens the scrub and the young wood and leaves
                 // the muskeg a muskeg, which is the difference between a terrain type and a blanket.
                 from: Array.isArray(c.from) && c.from.length ? c.from.map(v => Math.round(+v)) : null,
                 // `clear` (contract v1.22): stamp only the cells this premises leaves OPEN -
                 // no plot, no road ribbon, no site footprint, no paved surface. It is what
                 // lets a terrain type mean "the ground between the buildings": a residential
                 // wood may fill a town's gaps without standing a conifer on a roof, because
                 // the island's own tree fill knows nothing at all about a premises.
                 clear: c.clear === true,
                 // `cover` (contract v1.23): the WORLD-COVER class to write beside the
                 // terrain type. THIS IS THE PIECE THAT MADE A PAINTED BIOME PLANT
                 // NOTHING. The island's tree fill is gated on `world.surface`, which
                 // comes from the COVER raster and not from ttype at all - and over a
                 // town that raster says BUILT, which maps to PAVED, which both
                 // forestHere and openHere refuse. So a ttype stamp over a town could
                 // move the ground's texture and could not put one tree on it. Writing
                 // the cover as well (GRASS, WC 30) lets the fill see open ground and
                 // the BIOME decide what stands there, which is the whole point of
                 // painting a terrain type instead of placing trees.
                 cover: isFinite(+c.cover) ? Math.round(+c.cover) : null }));
  // THE POLYGONS' OWN VEGETATION (G1385, contract v1.31): a cover polygon's `veg` - none, an existing biome by name,
  // or a biome of its own ('@' + its id, registered by the renderer from vegMixes). The LAST polygon over a point has
  // the word (the record's order, as the stamps). vegAt answers undefined where no polygon speaks.
  const vegPolys = rec.layers.ttype.filter(c => c.poly && c.poly.length >= 3 && vegOf(c))
    .map(c => { const v = vegOf(c); return { id: c.id, poly: c.poly, bbox: polyBBox(c.poly), mix: v.mode === 'none' ? null : v.mode === 'biome' ? v.mix : '@' + c.id }; });
  const vegMixes = {};
  for (const c of rec.layers.ttype) { const v = c.poly && c.poly.length >= 3 && vegOf(c); if (v && v.mode === 'new') vegMixes['@' + c.id] = vegMixOf(v); }
  let ext = rec.frame.extent, extAuthored = null;
  // THE EXTENT COVERS WHAT IS AUTHORED (G2919; the user's Jolene rev 23: an island road of 24.9 km ran up to 8 km past the
  // extent the record carried - the island's own, written once - and past it no fine patch was drawn: the graded road lay
  // under the coarse far ground, "the sinking seems worse further away"). An authored extent stands as written while every
  // feature's own points lie inside it (Jolene's: the island cook, the patch, the bit-equal gates untouched); one that a
  // feature leaves grows to cover them all, falloffs included (the composed box below).
  if (ext) {
    let out = false;
    const pin = q => { if (!out && q && (q[0] < ext.x0 || q[0] > ext.x1 || q[1] < ext.z0 || q[1] > ext.z1)) out = true; };
    for (const r of roads) for (const q of r.pts) pin(q);
    for (const k of ['terrain', 'surface', 'material', 'exclude', 'zones', 'ttype']) for (const e of rec.layers[k]) for (const q of e.poly || e.pts || []) pin(q);
    for (const r of runways) for (const q of runwayBox(r, 0)) pin(q);
    if (out) { extAuthored = ext; ext = null; }
  }
  if (!ext) {
    let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
    const grow = b => { x0 = Math.min(x0, b.x0); z0 = Math.min(z0, b.z0); x1 = Math.max(x1, b.x1); z1 = Math.max(z1, b.z1); };
    for (const M of mods) grow(M.bbox);
    for (const s of surf) grow(s.bbox);
    for (const s of excl) grow(s.bbox);
    for (const z of rec.layers.zones) if (z.poly && z.poly.length >= 3) grow(polyBBox(z.poly));
    for (const r of runways) grow(polyBBox(runwayBox(r, 30)));
    for (const M of mods) grow(M.bbox);
    if (extAuthored) grow(extAuthored);
    ext = isFinite(x0) ? { x0, z0, x1, z1 } : { x0: 0, z0: 0, x1: 0, z1: 0 };
  }
  const inBB = (b, x, z) => x >= b.x0 && x <= b.x1 && z >= b.z0 && z <= b.z1;
  // ---- THE GROUND RASTER (G614, the A0 baseline: the premises' composed ground was evaluated per query - every
  // wheel every substep, the wind's surface layer, the ring's and the cover's walks) ----------------------------
  // EVERY MODIFIER IS AFFINE IN THE HEIGHT UNDER IT: h' = h + (T - h) w (a flatten, a slope pad, a grade), h + dh w
  // (a raise), L + (h - L) sm (a shelf) - w, T, sm functions of the point alone. So is their stack, in order:
  // terrainH(x, z, h) = A(x, z) h + B(x, z), with B = terrainH(x, z, 0) and A = terrainH(x, z, 1) - B. The raster
  // holds A and B on a lattice, per 16 m tile of the premises frame, BAKED LAZILY the first time a tile is asked
  // for (the bake is the analytic path: this file stays the source), and a query is A h + B bilinear at the point,
  // with h - the island's own DEM, carve and all - read exactly as before: the DEM's seams stay where they are, a
  // pad inside its feather is its level exactly (A = 0, B = the level at every node), and only the feathers are
  // interpolated. The lattice is a quarter of the finest feather touching the tile (0.25-1 m). A tile no modifier
  // touches (a road's reach cells, a pad's box) is the ground itself, exactly as the analytic path returns it.
  // Tiles are Float64 (a Float32 level would stand 4e-7 m over the ceiling's own bound) and capped (GR_CAP bytes;
  // the LEAST RECENTLY READ go first); `o.raster === false` (the editor, a proof)
  // keeps the analytic path. GATE PREMRASTER holds the agreement.
  // G735 (B1b): THE CACHE IS AN LRU. It kept every EMPTY tile (the ground itself: null) in the one insertion-ordered
  // map and evicted by scanning it from the front for the first baked tile - past up to 18 596 nulls an eviction,
  // 10 143 evictions in FRAMECOST's boot - and a tile the solver read every frame went when it was the OLDEST baked.
  // Now the map still answers every lookup (nulls included: an empty tile is never evicted, it holds no bytes), and
  // the baked / decoded tiles are ALSO threaded on a doubly linked list through their own fields (lp / ln, k: the
  // key): a read moves its tile to the head (four pointer writes; none when it is already there, the common case),
  // an eviction takes the tail - O(1) both. What a tile holds is unchanged (the bake and the decode are pure), so a
  // read answers the same bits whatever was evicted (GATE PREMRASTER: a tiny cap against the default, Object.is).
  // `o.rasterCap` (bytes): the cap, for a proof.
  const GR_TS = 16, GR_CAP = o.rasterCap > 0 ? o.rasterCap : 48 * 1024 * 1024, GR_TOL = 0.01, GR_RELIEF = 2;
  const grOn = o.raster !== false && mods.length > 0;
  const grTiles = new Map(), grStats = { baked: 0, empty: 0, evicted: 0, bytes: 0, bakeMs: 0, rMin: Infinity, rMax: 0, decoded: 0, decodeMs: 0 };
  let grRmax = 0, grHead = null, grTail = null;   // the most / least recently read baked tile
  const grKey = (i, j) => i * 131072 + j;
  function grUnlink(T) {
    if (T.lp) T.lp.ln = T.ln; else if (grHead === T) grHead = T.ln;
    if (T.ln) T.ln.lp = T.lp; else if (grTail === T) grTail = T.lp;
    T.lp = null; T.ln = null;
  }
  function grFront(T) {                           // T read: it goes to the head
    grUnlink(T);
    T.ln = grHead; if (grHead) grHead.lp = T; grHead = T; if (!grTail) grTail = T;
  }
  function grDrop(T) { grUnlink(T); grTiles.delete(T.k); grStats.bytes -= 16 * T.N * T.N; }
  function grTrim() {                             // the least recently read go until the cache is under its cap
    while (grStats.bytes > GR_CAP && grTail && grTail !== grHead) { grDrop(grTail); grStats.evicted++; }
  }
  const grNow = () => (typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now());
  function grBake(ti, tj, quiet) {
    const x0 = ti * GR_TS, z0 = tj * GR_TS, x1 = x0 + GR_TS, z1 = z0 + GR_TS;
    const hit = [], seen = new Set();
    index.rect(x0, z0, x1, z1, M => {
      if (seen.has(M)) return; seen.add(M);
      const b = M.bbox;
      if (x1 < b.x0 || x0 > b.x1 || z1 < b.z0 || z0 > b.z1) return;
      if (M.touches && !M.touches(x0, z0, x1, z1)) return;
      hit.push(M);
    });
    if (!hit.length) { if (!quiet) grStats.empty++; return null; }
    const t0 = grNow();
    hit.sort((a, b) => a.ord - b.ord);
    let fe = Infinity; for (const M of hit) fe = Math.min(fe, M.feather > 0 ? M.feather : 1);
    // THE LATTICE EARNS ITS CELL: from a quarter of the finest feather (1 m at most), halved (to 0.25 m) while any
    // cell's midpoint reads more than GR_TOL (1 cm) off the analytic ground there - a deep cut's feather (twenty metres
    // of target over the DEM) needs a finer lattice than a road's half metre
    let n = Math.min(64, Math.max(16, Math.ceil(GR_TS / Math.max(0.25, Math.min(1, fe / 4))))), N, r, A, B, hc;
    for (;;) {
      N = n + 1; r = GR_TS / n; A = new Float64Array(N * N); B = new Float64Array(N * N);
      for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
        const x = x0 + i * r, z = z0 + j * r;
        let b0 = 0, b1 = 1;
        for (let q = 0; q < hit.length; q++) { b0 = hit[q].apply(x, z, b0); b1 = hit[q].apply(x, z, b1); }
        B[j * N + i] = b0; A[j * N + i] = b1 - b0;
      }
      if (n >= 64) break;
      // (the error at a midpoint is dA h + dB: h is the tile centre's ground, give or take GR_RELIEF of the DEM)
      if (hc === undefined) { const w = F.toWorld(x0 + GR_TS / 2, z0 + GR_TS / 2); hc = world.terrainH(w[0], w[1]); }
      let bad = false;
      for (let j = 0; j < n && !bad; j++) for (let i = 0; i < n && !bad; i++) {
        const x = x0 + (i + 0.5) * r, z = z0 + (j + 0.5) * r;
        let b0 = 0, b1 = 1;
        for (let q = 0; q < hit.length; q++) { b0 = hit[q].apply(x, z, b0); b1 = hit[q].apply(x, z, b1); }
        const k = j * N + i, da = (A[k] + A[k + 1] + A[k + N] + A[k + N + 1]) / 4 - (b1 - b0), db = (B[k] + B[k + 1] + B[k + N] + B[k + N + 1]) / 4 - b0;
        if (Math.abs(da * hc + db) + Math.abs(da) * GR_RELIEF > GR_TOL) bad = true;
      }
      if (!bad) break;
      n *= 2;
    }
    if (quiet) return { x0, z0, r, n, N, A, B };                      // (G835) the cook's walk: no stats, no cache
    if (r > grRmax) grRmax = r;
    grStats.baked++; grStats.bytes += 16 * N * N; grStats.bakeMs += grNow() - t0;
    grStats.rMin = Math.min(grStats.rMin, r); grStats.rMax = Math.max(grStats.rMax, r); grStats['n' + n] = (grStats['n' + n] || 0) + 1;
    return { x0, z0, r, n, N, A, B, k: grKey(ti, tj), lp: null, ln: null };   // (the cache's fields: grHeight threads it)
  }
  // the composed height at a LOCAL point over the ground h under it (the raster's answer to terrainH(x, z, h))
  function grHeight(lx, lz, h) {
    const ti = Math.floor(lx / GR_TS), tj = Math.floor(lz / GR_TS), k = grKey(ti, tj);
    let T = grTiles.get(k);
    if (T === undefined) {
      T = grCooked(ti, tj); if (T === undefined) T = grBake(ti, tj);
      grTiles.set(k, T);
      if (T !== null) { grFront(T); grTrim(); }
    } else if (T !== grHead && T !== null) grFront(T);
    if (T === null) return h;
    const u = (lx - T.x0) / T.r, v = (lz - T.z0) / T.r;
    let i = Math.floor(u), j = Math.floor(v);
    if (i >= T.n) i = T.n - 1; else if (i < 0) i = 0;
    if (j >= T.n) j = T.n - 1; else if (j < 0) j = 0;
    const fu = u - i, fv = v - j, N = T.N, q = j * N + i, A = T.A, B = T.B;
    const a0 = A[q] + (A[q + 1] - A[q]) * fu, a1 = A[q + N] + (A[q + N + 1] - A[q + N]) * fu;
    const b0 = B[q] + (B[q + 1] - B[q]) * fu, b1 = B[q + N] + (B[q + N + 1] - B[q + N]) * fu;
    return (a0 + (a1 - a0) * fv) * h + (b0 + (b1 - b0) * fv);
  }
  // THE COOKED RASTER (G835, the architecture queue's C2b): the same tiles, baked OFFLINE by tools/premises_cook.js
  // per 256 m cell of the premises frame (GR_CELL: 16 x 16 tiles) and handed back by rasterLoad. A cell carries a
  // SIGNATURE of what its tiles were baked from (rasterCellSig: the frame, the definition of every modifier that
  // reaches the cell, in the order they apply, what each answers at five points - the composer's code, not only
  // its inputs - and the base ground at the cell's corners - the island) and loads only onto a composition that
  // gives the same one: an edit, a dropped town or a changed composer re-bakes lazily the cells it moved and no
  // others. The bytes are quantized (rasterCellDecode: 1 - A in 2^-24, B in 2^-15 m from the tile's own level;
  // the ground itself and the tile's pad exact) - a cooked tile is the lazy tile to 0.04 mm at 600 m, and the
  // ceiling (hMaxRect) is widened by GR_COOK_EPS while a cook is loaded. A cooked tile is decoded the first time
  // it is asked for, into the same capped cache as a baked one (a decode is ~0.05 ms, a bake 1-1.6); a tile a
  // loaded cell does not list is the ground itself.
  const GR_V = 1, GR_CELL = 16, GR_COOK_EPS = 1e-4;   // GR_V: bump with any change to grBake's arithmetic or its constants
  let grCook = null, grModH = null;
  const grCellKey = (ci, cj) => ci * 131072 + cj;
  // G995 (A5-LOAD): A SIGNATURE HASHES NUMBERS TO 10 MICRONS, not their last bit. The cook runs in node, the page in
  // Chrome: two V8s whose Math (the frame's cos/sin, hypot) can differ in the last ulp - a runway's centreline read
  // -1038.14518562303 in one and -1038.1451856230306 in the other, and every cell under HOME, the airport road and
  // the east taxiway (33 of 92) refused a cook it matched to 1e-13 m. The quantum is far below anything the lattice
  // resolves (the cooked tiles are the lazy ones to 0.04 mm) and far above an engine's rounding.
  const Q5 = v => { const r = Math.round(v * 1e5) / 1e5; return Object.is(r, -0) ? 0 : r; };
  const num = v => (typeof v === 'number' ? (isFinite(v) ? String(Q5(v)) : String(v)) : JSON.stringify(v === undefined ? null : v, (k, x) => (typeof x === 'number' && isFinite(x)) ? Q5(x) : x));
  const h64 = t => { let a = 0x811c9dc5, b = 0x6c62272e; for (let i = 0; i < t.length; i++) { const c = t.charCodeAt(i); a = Math.imul(a ^ c, 0x01000193); b = Math.imul(b ^ c, 0x5bd1e995); b ^= b >>> 15; } return (a >>> 0).toString(16).padStart(8, '0') + (b >>> 0).toString(16).padStart(8, '0'); };
  function modParts(M) {
    const b = M.bbox, parts = [M.kind, M.id, num(M.feather), num(M.y0), num(M.def || null), num(b.x0), num(b.z0), num(b.x1), num(b.z1)];
    const cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2;
    for (const [x, z] of [[cx, cz], [b.x0, b.z0], [b.x1, b.z1], [(cx + b.x0) / 2, (cz + b.z1) / 2], [(cx + b.x1) / 2, (cz + b.z0) / 2]])
      parts.push(num(M.apply(x, z, 0)), num(M.apply(x, z, 1)));
    return parts;
  }
  function modHash(M) {
    if (!grModH) grModH = new Map();
    let h = grModH.get(M);
    if (h) return h;
    h = h64(modParts(M).join('|'));
    grModH.set(M, h);
    return h;
  }
  // (G995) a modifier's signature parts by id, readable: what a page and a node composition that disagree on it differ in
  const rasterModParts = id => { const M = mods.find(m => m.id === id); return M ? modParts(M) : null; };
  // the modifiers that can reach a cell's tiles, in the order they are listed (the order grBake applies them in)
  function cellMods(ci, cj) {
    const S = GR_TS * GR_CELL, x0 = ci * S, z0 = cj * S, x1 = x0 + S, z1 = z0 + S, seen = new Set();
    index.rect(x0, z0, x1, z1, M => {
      if (seen.has(M)) return;
      const b = M.bbox;
      if (x1 < b.x0 || x0 > b.x1 || z1 < b.z0 || z0 > b.z1) return;
      if (M.touches && !M.touches(x0, z0, x1, z1)) return;
      seen.add(M);
    });
    return mods.filter(M => seen.has(M));
  }
  // (G995) rasterCellParts: what a cell's signature hashes, readable - the modifiers' ids beside their hashes - so a page
  // and a node composition that disagree on a cell can be diffed (a rig's --eval against the cook's own)
  function rasterCellParts(ci, cj) {
    const S = GR_TS * GR_CELL, x0 = ci * S, z0 = cj * S;
    const parts = ['GR', GR_V, GR_TS, GR_TOL, GR_RELIEF, GR_CELL, F.anchor.x, F.anchor.z, F.yaw, F.c, F.s, F.y0, ci, cj].map(num);
    for (const M of cellMods(ci, cj)) parts.push(modHash(M) + '=' + M.kind + ':' + M.id);
    for (const [x, z] of [[x0, z0], [x0 + S, z0], [x0, z0 + S], [x0 + S, z0 + S], [x0 + S / 2, z0 + S / 2]]) { const w = F.toWorld(x, z); parts.push(num(world.terrainH(w[0], w[1]))); }
    return parts;
  }
  function rasterCellSig(ci, cj) {
    return 'g' + GR_V + '-' + h64(rasterCellParts(ci, cj).map(p => String(p).replace(/=.*$/, '')).join('|'));
  }
  // every tile a modifier touches, in (i, j) order, baked fresh (not cached): fn(i, j, tile) - the cook's walk;
  // keep(i, j), when given, says before the bake which tiles are wanted
  function rasterEach(fn, keep) {
    const keys = new Set();
    for (const M of mods) {
      const b = M.bbox;
      for (let i = Math.floor(b.x0 / GR_TS) - 1, i1 = Math.floor(b.x1 / GR_TS); i <= i1; i++)
        for (let j = Math.floor(b.z0 / GR_TS) - 1, j1 = Math.floor(b.z1 / GR_TS); j <= j1; j++) {
          if (M.touches && !M.touches(i * GR_TS, j * GR_TS, i * GR_TS + GR_TS, j * GR_TS + GR_TS)) continue;
          keys.add(grKey(i, j));
        }
    }
    const list = Array.from(keys, k => { const i = Math.round(k / 131072); return [i, k - i * 131072]; }).sort((a, b) => (a[0] - b[0]) || (a[1] - b[1]));
    let n = 0;
    for (const [i, j] of list) { if (keep && !keep(i, j)) continue; const T = grBake(i, j, true); if (T) { fn(i, j, T); n++; } }
    return n;
  }
  // cells: [{ ci, cj, sig, bytes }] (bytes: one cell after the gunzip, any number of variants' cells) ->
  // { taken, stale }: a cell whose signature is this composition's is taken, the others are left to the lazy bake
  function rasterLoad(cells) {
    if (!grOn || !cells) return { taken: 0, stale: 0 };
    const M = new Map(), have = new Map();
    let stale = 0;
    for (const c of cells) {
      const k = grCellKey(c.ci, c.cj);
      if (M.has(k)) continue;
      let sig = have.get(k);
      if (sig === undefined) { sig = rasterCellSig(c.ci, c.cj); have.set(k, sig); }
      if (c.sig !== sig) { stale++; continue; }
      M.set(k, rasterCellIndex(c.bytes));
    }
    // a loaded cell's cached tiles were the lazy bake's: they go, so every read under it is the cook's
    for (const [k, T] of grTiles) { const i = Math.round(k / 131072), j = k - i * 131072; if (M.has(grCellKey(Math.floor(i / GR_CELL), Math.floor(j / GR_CELL)))) { if (T) grDrop(T); else grTiles.delete(k); } }
    grCook = M.size ? M : null;
    return { taken: M.size, stale };
  }
  function grCooked(ti, tj) {
    if (!grCook) return undefined;
    const C = grCook.get(grCellKey(Math.floor(ti / GR_CELL), Math.floor(tj / GR_CELL)));
    if (!C) return undefined;
    const e = C.at.get(grKey(ti, tj));
    if (!e) return null;                                                // the cell lists every tile a modifier touches
    const t0 = grNow(), T = rasterTileDecode(C, e);
    grStats.decoded++; grStats.decodeMs += grNow() - t0; grStats.bytes += 16 * T.N * T.N;
    if (T.r > grRmax) grRmax = T.r;
    return T;
  }
  // THE SURFACE, INDEXED (G614, exact - the A0 ring: every forest lattice point asks world.surface, and this scan
  // of every surface polygon and every road was a third of it): 64 m cells, each holding the surface polygons
  // whose box touches it and the roads with a SEGMENT within its half width + a hair of it (a point on a road is
  // within w/2 of one of its segments, so that segment's cell holds it), in the priority order the scan used.
  // A query reads its cell's lists - the same tests, the same order, the same answer.
  const GS_C = 64, gsCells = new Map();
  const gsKey = (i, j) => i * 131072 + j;
  const gsAdd = (x0, z0, x1, z1, fn) => { for (let i = Math.floor(x0 / GS_C), i1 = Math.floor(x1 / GS_C); i <= i1; i++) for (let j = Math.floor(z0 / GS_C), j1 = Math.floor(z1 / GS_C); j <= j1; j++) { const k = gsKey(i, j); let c = gsCells.get(k); if (!c) gsCells.set(k, c = { S: [], R: [] }); fn(c); } };
  surf.forEach((sf, i) => gsAdd(sf.bbox.x0, sf.bbox.z0, sf.bbox.x1, sf.bbox.z1, c => c.S.push(i)));
  roadObjs.forEach((r, i) => {
    const m = r.w / 2 + 0.01;
    for (let q = 1; q < r.pts.length; q++) {
      const a = r.pts[q - 1], b = r.pts[q];
      gsAdd(Math.min(a[0], b[0]) - m, Math.min(a[1], b[1]) - m, Math.max(a[0], b[0]) + m, Math.max(a[1], b[1]) + m, c => { if (c.R[c.R.length - 1] !== i) c.R.push(i); });
    }
  });
  for (const [, c] of gsCells) { c.S.sort((a, b) => a - b); c.R = Array.from(new Set(c.R)).sort((a, b) => a - b); }
  const exIdx = new Map(); let exIdxN = -1;
  const gsAddTo = (M, b, e) => { for (let i = Math.floor(b.x0 / GS_C), i1 = Math.floor(b.x1 / GS_C); i <= i1; i++) for (let j = Math.floor(b.z0 / GS_C), j1 = Math.floor(b.z1 / GS_C); j <= j1; j++) { const k = gsKey(i, j); let l = M.get(k); if (!l) M.set(k, l = []); l.push(e); } };
  const roadBB = roadObjs.map(r => { const b = polyBBox(r.pts); return { x0: b.x0 - r.w, z0: b.z0 - r.w, x1: b.x1 + r.w, z1: b.z1 + r.w }; });
  for (const r of rec.layers.zones) if (r.poly && r.poly.length >= 3) { /* an airfield zone is its runway's ground: no plots, no trees */ if (r.kind === 'airfield') excl.push({ poly: r.poly, bbox: polyBBox(r.poly), what: ['trees', 'plots'], derived: true }); }
  const O = {
    n: mods.length, nAuthored: nAuth, rec, stage: SV.staged ? { n: SV.n, tracks: SV.tracks } : null, frame: F, extent: ext, index, roads: roadObjs.filter(r => !r.runway), runways, aerodromes, shelves, ttypes,
    // G1385: the cover polygons' vegetation - vegAt(x, z) -> undefined (no polygon here) | null (none) | a mix name;
    // vegMixes the polygons' own biomes by '@id'; vegSig a string that changes when any of it does (the renderer's replant)
    // (and the strips' own clearances - G1385's third item: the fill and the ring replant on either)
    vegPolys, vegMixes, vegSig: JSON.stringify([vegPolys, vegMixes, runways.map(r => runwayClearOf(r))]),
    // G2890 (SCENERY-ED-1; the user: "when I remove the exclusion polygons or the polygon around the runway, the trees
    // don't come back directly"): every region that keeps trees out - each exclude that names trees (an authored one, a
    // strip's box, a hard surface, a clear zone, a plot or a site foot), and each land strip's generic clearing (20_world's
    // aerodrome box, len/2 + 150 by wid/2 + 60, or its own `clear`) - as { k, x0, z0, x1, z1 } in WORLD metres, k a key
    // that changes with it. The renderer's tree streamer diffs two compositions' lists and regrows the chunks under what
    // was added or removed (render_world.js TREE_FILL.vegChanged), never the whole ring. Read at call time (the plots'
    // and the sites' excludes are pushed after this object is made).
    treeExRegions() {
      const out = [], wb = (b, pad) => { const c = [F.toWorld(b.x0 - pad, b.z0 - pad), F.toWorld(b.x1 + pad, b.z0 - pad), F.toWorld(b.x1 + pad, b.z1 + pad), F.toWorld(b.x0 - pad, b.z1 + pad)];
        return { x0: Math.min(c[0][0], c[1][0], c[2][0], c[3][0]), z0: Math.min(c[0][1], c[1][1], c[2][1], c[3][1]), x1: Math.max(c[0][0], c[1][0], c[2][0], c[3][0]), z1: Math.max(c[0][1], c[1][1], c[2][1], c[3][1]) }; };
      // (G2918: a road clearing's piece is keyed by its outline to the centimetre - a drag's sub-millimetre ripple along the
      // rest of a spline moves no key, so only the pieces it really moved regrow)
      for (const e of excl) if (e.what.indexOf('trees') >= 0 && !treeOff(e)) out.push(Object.assign({ k: e.bandRoad ? 'xb' + JSON.stringify(e.poly.map(q => [Math.round(q[0] * 100), Math.round(q[1] * 100)])) : 'x' + JSON.stringify(e.poly) }, wb(e.bbox, 1)));
      for (const r of landRwy) { const cl = runwayClearOf(r), pad = cl ? Math.max(cl.beyond, cl.side + Math.max(0, cl.taper) * cl.beyond) : 160;
        out.push(Object.assign({ k: 'r' + JSON.stringify([r.c, r.len, r.wid, r.hdg, cl, r.treeBox]) }, wb(polyBBox(runwayBox(r, 0)), pad + 2))); }
      return out;
    },
    vegAt(x, z) {
      if (!vegPolys.length) return undefined;
      const dx = x - F.anchor.x, dz = z - F.anchor.z, lx = dx * F.c - dz * F.s, lz = dx * F.s + dz * F.c;
      for (let i = vegPolys.length - 1; i >= 0; i--) { const v = vegPolys[i]; if (inBB(v.bbox, lx, lz) && inPoly(v.poly, lx, lz)) return v.mix; }
      return undefined;
    },
    // THE STAMP: the island's ttype grid is ONE array, read by the tree
    // walk (render_world's ttypeAt), by the cover ring and by the ground's packed
    // texture. Writing the code into it once, here, is why one polygon moves the
    // ground and the vegetation together with no second path. The returned function
    // puts the old bytes back, so a live edit re-stamps cleanly.
    stampTtype(isl) {
      if (!isl || !isl.ttype || !isl.grid || (!ttypes.length && !bandStamps.length)) return null;
      const g = isl.grid, T = isl.ttype, saved = [];
      // THE GROUND BESIDE THE PAVEMENT IS THE ISLAND'S (G980, the user: "making the outside runway lanes transparent
      // shows the ground below, was a bad suggestion ... use the same texture as the surroundings and the same
      // transformation, so it blends better"). The island's land cover calls the real airfield's whole footprint
      // BUILT (code 10, drawn as dirt) ~40 m either side of a runway's centreline - the brown the transparent side
      // showed. Every BUILT cell inside a strip's or a paved polygon's band + fade takes the code of the ground just
      // beyond the band (the nearest that is not forest, cliff or water - a cleared field; BUILT itself where the
      // surroundings ARE built, round the pad and the hangars, so no green halo rings an apron), so the ground's own splat,
      // with its own uv law and grades, draws the surroundings right up to the pavement's edge. Only the ttype byte
      // moves: the cover raster (the wheels' class, the fill's refusal) is untouched, and coverAt still keeps the
      // vegetation off the band. Before the authored stamps, so an authored polygon still has the last word.
      for (const b of bandStamps) {
        const w = [F.toWorld(b.bbox.x0, b.bbox.z0), F.toWorld(b.bbox.x1, b.bbox.z0), F.toWorld(b.bbox.x1, b.bbox.z1), F.toWorld(b.bbox.x0, b.bbox.z1)];
        const i0 = Math.max(0, Math.floor((Math.min(w[0][0], w[1][0], w[2][0], w[3][0]) - g.x0) / g.cell)), i1 = Math.min(g.w - 1, Math.ceil((Math.max(w[0][0], w[1][0], w[2][0], w[3][0]) - g.x0) / g.cell));
        const j0 = Math.max(0, Math.floor((Math.min(w[0][1], w[1][1], w[2][1], w[3][1]) - g.z0) / g.cell)), j1 = Math.min(g.h - 1, Math.ceil((Math.max(w[0][1], w[1][1], w[2][1], w[3][1]) - g.z0) / g.cell));
        const codeAt = (x, z) => { const ii = Math.floor((x - g.x0) / g.cell), jj = Math.floor((z - g.z0) / g.cell); return ii < 0 || jj < 0 || ii >= g.w || jj >= g.h ? -1 : T[jj * g.w + ii]; };
        for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
          const k = j * g.w + i; if (T[k] !== 10) continue;
          const cx = g.x0 + (i + 0.5) * g.cell, cz = g.z0 + (j + 0.5) * g.cell, L = F.toLocal(cx, cz);
          if (b.sd(L[0], L[1]) > b.reach) continue;
          // the nearest open ground beyond the reach: rings of 8 directions, 10 m apart, out to 120 m
          let code = -1;
          for (let r = g.cell; r <= 120 && code < 0; r += g.cell) for (let q = 0; q < 8 && code < 0; q++) {
            const x = cx + Math.cos(q * Math.PI / 4) * r, z = cz + Math.sin(q * Math.PI / 4) * r, L2 = F.toLocal(x, z);
            if (b.sd(L2[0], L2[1]) <= b.reach) continue;
            const c = codeAt(x, z); if (c >= 0 && BAND_SKIP.indexOf(c) < 0) code = c;
          }
          saved.push(k, T[k]); T[k] = code >= 0 ? code : 7;
        }
      }
      // the WORLD's island handle renames it (`cover`, not `coverU8`) - read both, or
      // the write lands on undefined and the surface never moves, which is silent
      const CV = isl.cover || isl.coverU8 || null, savedC = [];
      for (const c of ttypes) {
        const w = [F.toWorld(c.bbox.x0, c.bbox.z0), F.toWorld(c.bbox.x1, c.bbox.z0),
                   F.toWorld(c.bbox.x1, c.bbox.z1), F.toWorld(c.bbox.x0, c.bbox.z1)];
        const wx0 = Math.min(w[0][0], w[1][0], w[2][0], w[3][0]), wx1 = Math.max(w[0][0], w[1][0], w[2][0], w[3][0]);
        const wz0 = Math.min(w[0][1], w[1][1], w[2][1], w[3][1]), wz1 = Math.max(w[0][1], w[1][1], w[2][1], w[3][1]);
        const i0 = Math.max(0, Math.floor((wx0 - g.x0) / g.cell)), i1 = Math.min(g.w - 1, Math.ceil((wx1 - g.x0) / g.cell));
        const j0 = Math.max(0, Math.floor((wz0 - g.z0) / g.cell)), j1 = Math.min(g.h - 1, Math.ceil((wz1 - g.z0) / g.cell));
        for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
          const L = F.toLocal(g.x0 + (i + 0.5) * g.cell, g.z0 + (j + 0.5) * g.cell);
          if (!inPoly(c.poly, L[0], L[1])) continue;
          const k = j * g.w + i;
          // `from` (contract v1.22): this stamp may replace only the codes it names
          if (c.from && c.from.indexOf(T[k]) < 0) continue;
          if (c.clear) {
            const cx = g.x0 + (i + 0.5) * g.cell, cz = g.z0 + (j + 0.5) * g.cell;
            const lc = F.toLocal(cx, cz);
            // AN EMPTY LOT IS GROUND (the user: "the empty lots and the zones between
            // houses without roads should have forest biome"). Only a plot that
            // actually carries a building keeps the paint off it.
            if (O.records.plots.some(q => q.pick && sdPoly(q.poly, lc[0], lc[1]) < 3)) continue;
            if (roadObjs.some(rd => roadDist(rd, lc[0], lc[1]) < (rd.w || 3.6) / 2 + 4)) continue;
            if (O.records.items.some(it => it.foot && sdPoly(it.foot, lc[0], lc[1]) < 4)) continue;   // a foot is in the PREMISES frame, like the roads and the plots
            if (pavePolys.some(pp => inPoly(pp.poly, lc[0], lc[1]))) continue;
          }
          // OPEN WATER IS NOT A PLACE'S TO PAINT - but a MOLE is. A cell the
          // island calls sea or lake is skipped unless this premises has raised
          // it clear of the water, which is exactly the breakwater case: the
          // terrain layer lifts the rubble out of the sea and the cover layer
          // then has to say `rock`, or the ground is drawn as water four metres
          // up in the air.
          if (T[k] < 2) {
            const wx = g.x0 + (i + 0.5) * g.cell, wz = g.z0 + (j + 0.5) * g.cell;
            const wl = world.waterH ? world.waterH(wx, wz) : 0;
            if (!(O.terrainAt(wx, wz) > wl + 0.3)) continue;
          }
          saved.push(k, T[k]);
          T[k] = c.code;
          // ...but only over the classes the fill REFUSES. Writing it everywhere turned
          // 391 cells of real forest floor inside the town's envelope into grassland,
          // which loses the wood the island already had there. BUILT and CROP are the
          // two that map to PAVED; everything else the fill can already plant on.
          if (c.cover !== null && CV && (CV[k] === 50 || CV[k] === 40)) { savedC.push(k, CV[k]); CV[k] = c.cover; }
        }
      }
      // BACKWARD, and it matters: two stamps may cover the same cell (a lush verge
      // crossing another's), and the second one saved what the FIRST had written.
      // Unwound forward, the cell ends up holding the first stamp's code instead of
      // the island's own byte - an undo that quietly does not undo.
      return () => {
        for (let n = saved.length - 2; n >= 0; n -= 2) T[saved[n]] = saved[n + 1];
        if (CV) for (let n = savedC.length - 2; n >= 0; n -= 2) CV[savedC[n]] = savedC[n + 1];
      };
    },
    terrainH(x, z, h) {
      if (!mods.length) return h;
      // (G611: toLocal's arithmetic, in place - no array per query; the same bits)
      const dx = x - F.anchor.x, dz = z - F.anchor.z, lx = dx * F.c - dz * F.s, lz = dx * F.s + dz * F.c;
      const cell = index.query(lx, lz);
      if (!cell) return h;
      for (let i = 0; i < cell.length; i++) h = cell[i].apply(lx, lz, h);
      return h;
    },
    // THE RASTER'S ANSWER (G614): terrainH off the lazily baked A / B lattice - the world's terrainH reads this;
    // terrainH above stays the analytic source (the editor's, the bake's, the proof's)
    terrainFast(x, z, h) {
      if (!grOn) return O.terrainH(x, z, h);
      const dx = x - F.anchor.x, dz = z - F.anchor.z, lx = dx * F.c - dz * F.s, lz = dx * F.s + dz * F.c;
      if (!index.query(lx, lz)) return h;
      return grHeight(lx, lz, h);
    },
    // G1406 (METLA-LOAD): WOULD terrainFast BAKE HERE? - the raster is on, a modifier's cell holds the point and no cooked
    // cell does (a tile there is baked lazily, 1-1.6 ms, the first time anything reads it). The world's BUILD READ
    // (20_world.js terrainHBuild) takes the analytic path where this says so: a geometry builder reads a far tile a few
    // dozen times, ~17 times cheaper than its bake. It never asks what the cache holds, so its answer is the same
    // whatever was read before; where a cell is cooked it is the raster's own bits
    rasterLazyAt(x, z) {
      if (!grOn) return false;
      const dx = x - F.anchor.x, dz = z - F.anchor.z, lx = dx * F.c - dz * F.s, lz = dx * F.s + dz * F.c;
      if (!index.query(lx, lz)) return false;
      const S = GR_TS * GR_CELL;
      return !(grCook && grCook.has(grCellKey(Math.floor(lx / S), Math.floor(lz / S))));
    },
    get raster() { return grOn ? { on: true, tile: GR_TS, cap: GR_CAP, tiles: grTiles.size, ...grStats, rMaxBaked: grRmax, cookedCells: grCook ? grCook.size : 0 } : { on: false }; },
    // (G835) the cooked raster: a cell's signature, the cook's walk, the load
    rasterCellSig, rasterCellParts, rasterModParts, rasterEach, rasterLoad, rasterCell: GR_TS * GR_CELL, rasterTile: GR_TS,
    rasterCached: () => Array.from(grTiles, ([k, T]) => { const i = Math.round(k / 131072); return [i, k - i * 131072, T ? T.n : 0]; }),   // [i, j, n (0: the ground)] - what the cache holds (a probe's)
    // THE CEILING OVER A WORLD RECTANGLE (PHYSICS PERF 2026-09-24): an upper bound of terrainH(x, z, h)
    // for every point of it, given B >= h there. Each modifier blends h toward its target with a
    // weight in [0, 1] (a raise adds at most dh), whatever the order: max(B, every target) + the
    // raises. The rectangle's local box (the frame is rotated) holds every point's local cell.
    hMaxRect(ax, az, bx, bz, B) {
      if (!mods.length) return B;
      const p1 = F.toLocal(ax, az), p2 = F.toLocal(bx, az), p3 = F.toLocal(ax, bz), p4 = F.toLocal(bx, bz);
      let lx0 = Math.min(p1[0], p2[0], p3[0], p4[0]) - 0.01, lx1 = Math.max(p1[0], p2[0], p3[0], p4[0]) + 0.01;
      let lz0 = Math.min(p1[1], p2[1], p3[1], p4[1]) - 0.01, lz1 = Math.max(p1[1], p2[1], p3[1], p4[1]) + 0.01;
      // (G614) under the raster a point reads the lattice nodes around it - the modifiers of every node within
      // a lattice cell, each at the point's own ground: the bound of the rectangle grown by the coarsest cell
      if (grOn) { lx0 -= 1.01; lx1 += 1.01; lz0 -= 1.01; lz1 += 1.01; }
      // IN THE ORDER A POINT APPLIES THEM (G611): a pad whose full weight covers the rectangle sets every point
      // to its target, so the bound restarts there - at the target's highest (1 nm over it: the blend's own
      // rounding) - and whatever lay under it (the DEM, an earlier modifier) is out of it
      const hit = [], seen = new Set();
      index.rect(lx0, lz0, lx1, lz1, M => {
        if (seen.has(M)) return; seen.add(M);
        const b = M.bbox;
        if (lx1 < b.x0 || lx0 > b.x1 || lz1 < b.z0 || lz0 > b.z1) return;
        hit.push(M);
      });
      hit.sort((a, b) => a.ord - b.ord);
      let T = B, add = 0;
      for (const M of hit) {
        if (!M.bound) { T = Infinity; continue; }        // a modifier that cannot say: no ceiling
        const r = M.bound(lx0, lz0, lx1, lz1);
        if (M.covers && M.covers(lx0, lz0, lx1, lz1)) { T = r.t + 1e-9; add = 0; continue; }
        if (r.t > T) T = r.t;
        add += r.add;
      }
      return T + add + (grOn ? 1e-7 : 0) + (grCook ? GR_COOK_EPS : 0);   // (G614: the lattice's bilinear rounding, 100 nm; G835: a cook's quantization)
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
    // pavedAt(x, z, reach) -> null | { d, cls, halfW, kind, dPre }: the pavement whose surface the point lies deepest
    // inside (d = metres in from its edge, > 0). The viewer sinks its ground patch under the pavement's
    // opaque interior by it (G660, PAVEMENT.sinkAt); the same index as coverAt, the same dEdge
    pavedAt: (x, z, reach) => pavedAt(x, z, reach),
    // pavedNear(x, z, margin, skip) -> null | { d, id, kind, cls }: any pavement here or within `margin`, other than
    // `skip` - what a loose thing (a stone, litter, a parked car) asks before it is put down (G1003)
    pavedNear: (x, z, margin, skip) => pavedNear(x, z, margin, skip),
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
      const G = gsCells.get(gsKey(Math.floor(L[0] / GS_C), Math.floor(L[1] / GS_C)));   // (G614: the cell's own lists, the same order)
      if (!G) return -1;
      for (let n = G.S.length - 1; n >= 0; n--) { const s = surf[G.S[n]]; if (inBB(s.bbox, L[0], L[1]) && inPoly(s.poly, L[0], L[1])) return s.surface; }
      for (let n = 0; n < G.R.length; n++) { const i = G.R[n]; if (inBB(roadBB[i], L[0], L[1]) && roadDist(roadObjs[i], L[0], L[1]) <= roadObjs[i].w / 2) return roadObjs[i].surface; }
      return -1;
    },
    excludeAt(x, z, what) {
      if (!excl.length) return false;
      const L = F.toLocal(x, z);
      // (G614: the excludes whose box touches the point's 64 m cell - an OR, so any order; rebuilt when one is added)
      if (exIdxN !== excl.length) { exIdx.clear(); exIdxN = excl.length; excl.forEach(e => gsAddTo(exIdx, e.bbox, e)); }
      const list = exIdx.get(gsKey(Math.floor(L[0] / GS_C), Math.floor(L[1] / GS_C)));
      if (!list) return false;
      for (const e of list) if (inBB(e.bbox, L[0], L[1]) && (!what || e.what.indexOf(what) >= 0) && !(what === 'trees' && treeOff(e)) && (e.bandRoad ? roadDist(e.bandRoad, L[0], L[1]) <= e.half : inPoly(e.poly, L[0], L[1]))) return true;
      return false;
    },
    // (G614) the linear scans the indexes replaced - the reference GATE PREMRASTER holds them to
    surfaceAtScan(x, z) {
      const L = F.toLocal(x, z);
      for (let i = surf.length - 1; i >= 0; i--) { const s = surf[i]; if (inBB(s.bbox, L[0], L[1]) && inPoly(s.poly, L[0], L[1])) return s.surface; }
      for (let i = 0; i < roadObjs.length; i++) if (inBB(roadBB[i], L[0], L[1]) && roadDist(roadObjs[i], L[0], L[1]) <= roadObjs[i].w / 2) return roadObjs[i].surface;
      return -1;
    },
    excludeAtScan(x, z, what) {
      const L = F.toLocal(x, z);
      for (const e of excl) if (inBB(e.bbox, L[0], L[1]) && (!what || e.what.indexOf(what) >= 0) && !(what === 'trees' && treeOff(e)) && (e.bandRoad ? roadDist(e.bandRoad, L[0], L[1]) <= e.half : inPoly(e.poly, L[0], L[1]))) return true;
      return false;
    },
    // G1091: THE TREES BY THE RUNWAYS - the variant this composition plants by, the excludes it knows as runway
    // clearances (the gates print them), and the two point queries the woodland and the fill share:
    //   treePaveAt(x, z)  a tree's trunk may not stand here for the PAVEMENT's sake ('today': coverAt's kill - the
    //                     pavement, its band and the fade; 'map' / 'mapx': the pavement and its DRAWN side only)
    //   shoulderAt(x, z)  the point is on a runway's gravel shoulder (the trees' ground there is the island's in 'map')
    rwyTrees: RWT,
    rwyClearances: () => excl.filter(e => e.rwy || e.shoulder || e.fan).map(e => ({ id: e.id || e.surface || ('box:' + e.runway), kind: e.rwy ? 'box' : e.shoulder ? 'shoulder' : 'fan', runway: e.runway || e.shoulder || e.fan, off: treeOff(e) })),
    treePaveAt: (x, z) => treePaveAt(x, z),
    shoulderAt(x, z) {
      const L = F.toLocal(x, z);
      for (const e of excl) if (e.shoulder && inBB(e.bbox, L[0], L[1]) && inPoly(e.poly, L[0], L[1])) return e.shoulder;
      return null;
    },
    roadNear(x, z) { const L = F.toLocal(x, z); let d = Infinity; for (const r of roadObjs) d = Math.min(d, roadDist(r, L[0], L[1])); return d; },
    inExtent(x, z) { const L = F.toLocal(x, z); return inBB(ext, L[0], L[1]); },
    records: { plots: [], trees: [], items: [], links: [], issues: [], excludes: excl.filter(e => !e.roadClear).map(e => e.poly) },   // (G2918: a road's clearing is the trees' and the grass's, not a plot's)
  };
  // ---- THE ROAD GRAPH (contract v1.37, G2950 ROAD-GRAPH; the user: "a scenic tour of the island's roads, probably with a
  // simple car ... it would be good that we have the premises of a graph then") - made on its first ask, kept with the
  // composition. NODES: every junction (the waypoints sharing an id, one node), every road's two ends (`<road>:0`, `<road>:1`
  // unless a junction is there), every roadside apron's node; EDGES: each road's spans between its nodes, on its DRAWN line
  // (the spline, the junction extension) in world metres - len, w, cls, surface, look, grade (the steepest along, from the
  // composed ground). A node carries `roads` (the roads through it), `name` / `conn` (the junctions layer: a CONNECTION
  // POINT), `aprons` (a roadside apron: { area, use, poly, centre, r - the room to turn }). The API is graphMake's.
  let RG = null;
  O.roadGraph = () => {
    if (RG) return RG;
    const names = new Map(); for (const j of rec.layers.junctions || []) if (j && j.id) names.set(j.id, j);
    const nodes = new Map(), edges = [];
    const nodeFor = (id, lx, lz) => { let n = nodes.get(id); if (!n) { const w = F.toWorld(lx, lz); n = { id, x: w[0], z: w[1], lx, lz, roads: [], aprons: [] }; const J = names.get(id); if (J) { if (J.name) n.name = J.name; if (J.conn) n.conn = J.name || true; } nodes.set(id, n); } return n; };
    const byId = new Map(roadObjs.filter(ro => !ro.runway).map(ro => [ro.id, ro]));
    for (const r of rec.layers.roads) {
      const ro = byId.get(r.id); if (!ro || !r.pts || r.pts.length < 2 || !ro.pts || ro.pts.length < 2) continue;
      const P = r.pts, D = ro.pts, last = P.length - 1;
      // each waypoint on the drawn line: the nearest drawn point, searched forward (a spline passes through its points)
      const at = []; let k0 = 0;
      for (let i = 0; i <= last; i++) {
        let best = k0, bd = Infinity, run = 0, lim = (i < last ? Math.hypot(P[i + 1][0] - P[i][0], P[i + 1][1] - P[i][1]) : 0) * 3 + 60;
        for (let k = k0; k < D.length; k++) { if (k > k0) run += Math.hypot(D[k][0] - D[k - 1][0], D[k][1] - D[k - 1][1]); const d = Math.hypot(D[k][0] - P[i][0], D[k][1] - P[i][1]); if (d < bd) { bd = d; best = k; } if (run > lim && bd < 50) break; }
        at.push(best); k0 = best;
      }
      const ids = P.map((q, i) => (Array.isArray(r.nodes) && r.nodes[i]) || (i === 0 ? r.id + ':0' : i === last ? r.id + ':1' : null));
      const split = []; ids.forEach((id, i) => { if (id) split.push(i); });
      for (let s = 0; s + 1 < split.length; s++) {
        const i0 = split[s], i1 = split[s + 1], d0 = s === 0 ? 0 : at[i0], d1 = s + 2 === split.length ? D.length - 1 : at[i1];
        const A = nodeFor(ids[i0], P[i0][0], P[i0][1]), B = nodeFor(ids[i1], P[i1][0], P[i1][1]);
        const pts = D.slice(Math.min(d0, d1), Math.max(d0, d1) + 1).map(q => F.toWorld(q[0], q[1]));
        let len = 0; for (let q = 1; q < pts.length; q++) len += Math.hypot(pts[q][0] - pts[q - 1][0], pts[q][1] - pts[q - 1][1]);
        edges.push({ id: r.id + '#' + s, road: r.id, a: A.id, b: B.id, pts, len, w: ro.w, cls: r.cls || null, surface: ro.surface, look: ro.look });
        if (A.roads.indexOf(r.id) < 0) A.roads.push(r.id); if (B.roads.indexOf(r.id) < 0) B.roads.push(r.id);
      }
    }
    // the roadside aprons: an area whose `roadside` names a junction - the node a vehicle turns or stops from
    for (const a of areasRaw) {
      const RS = a && a.props && a.props.roadside; if (!RS || !RS.node || !nodes.has(RS.node) || !a.poly || a.poly.length < 3) continue;
      const poly = a.poly.map(q => F.toWorld(q[0], q[1])), c = polyCentroid(poly);
      let r0 = Infinity; for (let i = 0; i < poly.length; i++) r0 = Math.min(r0, distPtSeg(c[0], c[1], poly[i], poly[(i + 1) % poly.length]));
      nodes.get(RS.node).aprons.push({ area: a.id, use: Array.isArray(RS.use) ? RS.use.slice() : ['turn', 'stop'], poly, centre: c, r: +r0.toFixed(2) });
    }
    // each node's height and each edge's steepest grade, off the composed ground
    for (const n of nodes.values()) n.y = O.terrainAt(n.x, n.z);
    for (const e of edges) { let g = 0, hPrev = null, sPrev = 0, s = 0; for (let q = 0; q < e.pts.length; q++) { if (q) s += Math.hypot(e.pts[q][0] - e.pts[q - 1][0], e.pts[q][1] - e.pts[q - 1][1]); if (hPrev === null || s - sPrev >= 6 || q === e.pts.length - 1) { const h = O.terrainAt(e.pts[q][0], e.pts[q][1]); if (hPrev !== null && s > sPrev) g = Math.max(g, Math.abs(h - hPrev) / (s - sPrev)); hPrev = h; sPrev = s; } } e.grade = +g.toFixed(4); }
    RG = graphMake(Array.from(nodes.values()), edges);
    return RG;
  };
  // ---- coverAt's index (v1.17): every pavement's reach and every plot, in 64 m cells ------------
  const CIDX = SpatialIndex(64);
  const covItems = [];
  const addCov = (bbox, it) => { covItems.push(it); CIDX.add(bbox, it); };
  for (const r of runways) {
    if (runwayIsWater(r)) continue;
    const L = RUNWAY_LOOKS[r.look] || RUNWAY_LOOKS.grass, cls = L.cls || 'grass', band = paveBand(r, cls, false), reach = band + PAVE_FADE + 6;
    const E = runwayEnds(r);
    addCov(polyBBox(runwayBox(r, reach)), { kind: 'strip', id: r.id, cls, band, halfW: r.wid / 2, len: r.len, e0: E.end0, d: E.d, soft: cls !== 'concrete' && cls !== 'asphalt' });
  }
  for (const rd of roadObjs) {
    if (rd.runway || rd.ribbon === false) continue;
    const L = RUNWAY_LOOKS[rd.look] || RUNWAY_LOOKS.gravel, cls = L.cls || 'gravel', band = paveBand(rd, cls, true), reach = Math.max(rd.w / 2 + band + PAVE_FADE + 6, rd.clear >= 0 ? rd.w / 2 + rd.clear + 1 : 0);
    const it = Object.assign({ kind: 'road', id: rd.id, cls, band, halfW: rd.w / 2, road: rd, soft: cls !== 'concrete' && cls !== 'asphalt' }, rd.clear >= 0 ? { clear: rd.clear } : {});
    // (G2917) A LONG ROAD IS FILED BY ITS SEGMENTS: by its box, an island-long road sat in every cover cell of the island and
    // every tuft anywhere asked it. Each segment's box, out to the reach + 40 m (past every distance a reader acts on: the
    // cover's band, fade and verge, the 'sides' law's mow band, a stone's margin) - the same items answer every point that
    // any of them could touch, in the same order
    if (SEG_IDX && rd.pts.length >= SEG_MIN) {   // (segIdx(false): the box, the A/B's before)
      const m = reach + 40, boxes = [];
      for (let q = 1; q < rd.pts.length; q++) { const a = rd.pts[q - 1], b = rd.pts[q]; boxes.push({ x0: Math.min(a[0], b[0]) - m, z0: Math.min(a[1], b[1]) - m, x1: Math.max(a[0], b[0]) + m, z1: Math.max(a[1], b[1]) + m }); }
      covItems.push(it); CIDX.addMany(boxes, it);
    } else { const bb = polyBBox(rd.pts); addCov({ x0: bb.x0 - reach, z0: bb.z0 - reach, x1: bb.x1 + reach, z1: bb.z1 + reach }, it); }
  }
  for (const pp of pavePolys) {
    const cls = RUNWAY_LOOKS[pp.look].cls, band = paveBand(pp, cls, true), reach = band + PAVE_FADE + 6;
    addCov({ x0: pp.bbox.x0 - reach, z0: pp.bbox.z0 - reach, x1: pp.bbox.x1 + reach, z1: pp.bbox.z1 + reach }, { kind: 'poly', id: pp.id, cls, band, poly: pp.poly, soft: false });
  }
  const zoneOf = id => rec.layers.zones.find(z => z.id === id) || null;
  // the strip's dEdge (its box's SDF: + inside), the road's (w/2 - the distance), the polygon's
  const dEdgeOf = (it, lx, lz) => {
    if (it.kind === 'strip') { const dx = lx - it.e0[0], dz = lz - it.e0[1]; const u = dx * it.d[0] + dz * it.d[1], v = -dx * it.d[1] + dz * it.d[0];
      const du = Math.max(-u, u - it.len), dv = Math.abs(v) - it.halfW; return -(Math.hypot(Math.max(du, 0), Math.max(dv, 0)) + Math.min(Math.max(du, dv), 0)); }
    if (it.kind === 'road') return it.halfW - roadDist(it.road, lx, lz);
    return -sdPoly(it.poly, lx, lz);
  };
  // G1003 (A6-GROUND, the Jolene playtest: "rocks and debris lie on the taxiway and runway"): IS ANY PAVEMENT HERE, OR
  // WITHIN `margin` OF HERE - other than `skip` (an id: a strip's band stones ask whether they lie on ANOTHER strip, a
  // road's parked car whether it stands on anything but its own road). Every strip (grass ones too), road and paved
  // polygon of coverAt's index by its own dEdge (> -margin), then the surface layer's PAVED polygons (the aprons the
  // editor draws as surface, which that index does not hold) at the point and `margin` round it. The GRAVEL / SAND
  // polygons are not asked: on Jolene they are the runways' own shoulders (y_sh13_*, y_sh02_*), where the stones lie.
  // -> null | { d, id, kind, cls } (d: metres inside that pavement's edge, > -margin; kind 'surface' for a polygon).
  // G1091: a tree's trunk and the pavement. 'today' is coverAt's kill verbatim (the pavement, its band, the fade: 46 m
  // past 13/31's edge). 'map' / 'mapx' keep a tree off the paving and what the pavement DRAWS past its edge: a strip, a
  // paved polygon, a taxiway and (G1391) every SIDED road fade their side out over PAVE_SIDE (G660, G980); a road with a
  // band of its own still draws its band and fades over PAVE_FADE past it, so its reach is 'today's (band + fade). The PAVED surface polygons
  // are the derived excludes' (never lifted).
  function treePaveAt(x, z) {
    if (RWT === 'today') { const c = coverAt(x, z, 1); return !!(c && c.kill > 0); }
    const L = F.toLocal(x, z), lx = L[0], lz = L[1];
    const cell = CIDX.query(lx, lz);
    if (cell) for (const it of cell) {
      const reach = it.kind === 'road' && !(it.road && it.road.sided) ? it.band + PAVE_FADE : (it.soft ? PAVE_SIDE_SOFT : PAVE_SIDE);   // G1391: a sided road's side; G1395: a soft one's wider fade
      if (dEdgeOf(it, lx, lz) > -reach) return true;
    }
    return false;
  }
  function pavedNear(x, z, margin, skip) {
    const m = margin > 0 ? margin : 0, L = F.toLocal(x, z), lx = L[0], lz = L[1];
    const cell = CIDX.query(lx, lz);
    if (cell) for (const it of cell) {
      if (skip != null && it.id === skip) continue;
      const d = dEdgeOf(it, lx, lz);
      if (d > -m) return { d, id: it.id, kind: it.kind, cls: it.cls };
    }
    const offs = m > 0 ? [[0, 0], [m, 0], [-m, 0], [0, m], [0, -m]] : [[0, 0]];
    for (const o2 of offs) {
      const px = lx + o2[0], pz = lz + o2[1];
      const G = gsCells.get(gsKey(Math.floor(px / GS_C), Math.floor(pz / GS_C)));
      if (!G) continue;
      for (let n = G.S.length - 1; n >= 0; n--) { const sf = surf[G.S[n]]; if (inBB(sf.bbox, px, pz) && inPoly(sf.poly, px, pz)) { if (sf.surface === SURFACE.PAVED) return { d: 0, id: null, kind: 'surface', cls: null }; break; } }
    }
    return null;
  }
  // `pave` (2026-09-22): the PAVEMENT half only - the caller wants to know whether it may stand
  // something here, not which plot's lawn it is. It skips the plot walk, which is the query's cost
  // (36 polygons in a village), and the tree fill calls this on every lattice point of every chunk.
  function coverAt(x, z, pave) {
    const L = F.toLocal(x, z), lx = L[0], lz = L[1];
    const cell = CIDX.query(lx, lz);
    if (!pave && GRASS_SIDES.law === 'sides') return coverSides(lx, lz, cell);
    let kill = 0, boost = 0, cls = null, best = -Infinity;
    if (cell) for (const it of cell) {
      const d = dEdgeOf(it, lx, lz);              // + inside the pavement, - outside
      const out = -d, clr = it.clear >= 0 && out <= it.clear;   // (v1.36, G2918: a road's own clearing - nothing grows within it)
      if (out > it.band + PAVE_FADE + 6 && !clr) continue;
      // the pavement and its band: nothing; the fade: 1 -> 0 over PAVE_FADE; the border bump past the band
      let k = clr ? 1 : out <= it.band ? 1 : Math.max(0, 1 - (out - it.band) / PAVE_FADE);
      // a grass pavement is the world's grass with the wear drawn on it: thinned, not bare - except a STRIP's
      // surface, where no grass grows at all (G665, the user: "the runways should be able excluding the grass")
      if (it.cls === 'grass' && !(it.kind === 'strip' && d >= 0)) k *= 0.6;
      const bump = out <= it.band ? 0 : (out < it.band + PAVE_FADE + 6 ? Math.sin(Math.PI * Math.min(1, (out - it.band) / (PAVE_FADE + 6))) : 0);
      // a soft road's own edge is where the grass creeps in: the bump reaches into its last metre
      const soft = it.soft && d > 0 && d < 1 ? 0.5 * (1 - d) : 0;
      if (k > kill) { kill = k; }
      boost = Math.max(boost, bump * 0.7, soft);
      if (d > best) { best = d; cls = it.cls; }
    }
    if (pave) return (kill || boost) ? { kill, boost: Math.min(1, boost * (1 - kill)), kind: null, cls, grass: null } : null;
    return withPlot(lx, lz, kill, boost, cls, 0, 0);
  }
  // the plots: a point inside one takes its zone's grass rule; a plot's lawn is mown to the road's band (no fade thins it,
  // only the pavement and the band kill)
  const lawnWater = new Map();   // (v1.35: a zone's water, read once, for its water plots' lawn)
  function withPlot(lx, lz, kill, boost, cls, cut, surf) {
    let kind = null, grass = null;
    // (v1.35: a plot whose ground is off is the island's here - no lawn, the biome's own; and a water plot mows no lawn
    // within 30 cm of its zone's water - the shore is the biome's, the user: "they draw grass up till the sea")
    for (const p of O.records.plots) if (p.poly && !p.noGround && inPoly(p.poly, lx, lz)) {
      const g = zoneGrass(zoneOf(p.zone));
      if (g.kind === 'lawn' && p.side === 'water') {
        let wy = lawnWater.get(p.zone); if (wy === undefined) lawnWater.set(p.zone, wy = zoneWaterYOf(world, F, zoneOf(p.zone), -Infinity));
        if (isFinite(wy) && O.localH(lx, lz) < wy + 0.3) break;
      }
      kind = g.kind; grass = g; break;
    }
    if (kind === 'lawn' && kill < 1) kill = 0;
    if (!kill && !boost && !kind && !cut) return null;
    const o = { kill, boost: Math.min(1, boost * (1 - kill)), kind, cls, grass };
    if (GRASS_SIDES.law === 'sides') { o.cut = cut; o.surf = surf; }
    return o;
  }
  // THE 'sides' LAW (GRASS_SIDES above): what is drawn beside an aerodrome's pavement decides - bare on it and its drawn side,
  // cut across the band and the mow band, wild past the blend; a grass strip's surface cut; a road as today plus a mown verge
  function coverSides(lx, lz, cell) {
    const G = GRASS_SIDES, VERGE = PAVE_FADE + 6;
    let kill = 0, boost = 0, cut = 0, surf = 0, cls = null, best = -Infinity;
    if (cell) for (const it of cell) {
      const d = dEdgeOf(it, lx, lz), out = -d;
      const aero = it.kind === 'strip' || it.kind === 'poly' || (it.kind === 'road' && !!(it.road && it.road.taxiway));
      const mow = it.band + (aero ? G.mowBand : G.roadMow), blend = Math.max(1e-6, G.mowBlend);
      const v0 = aero ? mow + G.mowBlend : it.band;   // where the verge's bump starts
      const clr = it.clear >= 0 && out <= it.clear;   // (v1.36, G2918: a road's own clearing - bare)
      if (out > Math.max(v0, it.band + PAVE_FADE) + VERGE && !clr) continue;
      if (d > best) { best = d; cls = it.cls; }
      let k = 0, c = 0;
      if (clr) { k = 1; if (k > kill) kill = k; continue; }
      if (d >= 0) {   // ON the pavement: bare, but a grass strip's surface is cut grass and a grass road / polygon worn grass (40 %, cut)
        if (it.cls === 'grass') { if (it.kind === 'strip') { if (G.stripGrass > 0) { c = 1; surf = 1; } else k = 1; } else { k = 0.6; c = 1; } }
        else k = 1;
        if (it.soft && d < 1 && it.cls !== 'grass') boost = Math.max(boost, 0.5 * (1 - d));
      } else if (aero) {
        if (out <= (it.soft ? G.softClear : G.sideClear)) k = 1;
        else c = out <= mow ? 1 : Math.max(0, 1 - (out - mow) / blend);
      } else {   // an ordinary road: today's band and fade, then its mown verge
        k = out <= it.band ? 1 : Math.max(0, 1 - (out - it.band) / PAVE_FADE);
        if (it.cls === 'grass') k *= 0.6;
        if (out > it.band) c = out <= mow ? 1 : Math.max(0, 1 - (out - mow) / blend);
      }
      if (out > v0 && out < v0 + VERGE) boost = Math.max(boost, 0.7 * Math.sin(Math.PI * (out - v0) / VERGE));
      if (k > kill) kill = k;
      if (c > cut) cut = c;
    }
    return withPlot(lx, lz, kill, boost, cls, kill >= 1 ? 0 : cut, kill >= 1 ? 0 : surf);
  }

  // G1542 (GROUND-LATTICE): A ROAD'S RIBBON ENDS SQUARE (pavement.js roadGeometry: s from 0 to the length, the rows
  // across at each), while its dEdge is w/2 less the distance to the polyline - a round cap past each end. The patch
  // sinks by pavedAt (render_premises sinkOf, up to 0.8 m), so past every dead end a half disc of the patch was sunk
  // under NOTHING: a pit as wide as the road. tools/ground_drawn.js found it under mn_strip's stand, at the start of
  // mn_stand_lane: the drawn ground 0.23-0.59 m under the wheels of a Cub, a Jodel and a Cessna parked there. So for
  // the patch a road's DEAD end is an EDGE too: past it nothing is paved, and the DEEP sink (0.8 m) is held PAVE_END_IN
  // (the patch's 2 m cell) inside it, so no deeply sunk vertex lies within a cell of the end and no triangle carries that
  // sink past it. The last 2 m take the edge's own 7 cm (`dPre`: the depth sinkAt's pre-sink reads, G1001's law), so the
  // road still stands over the patch there by what it does at every edge. A closed road has no end. (pavedNear /
  // coverAt keep the round cap: the stones, the trees, the life.)
  // Only a DEAD end: an end that opens onto another pavement (a junction, a stand lane onto an apron) is covered by it,
  // and keeps the round cap there (the other pavement draws over it; GATE CONTACT's ratchet counted 33 more points of
  // a road's band within 5 mm of the patch when every end was held back).
  const PAVE_END_IN = 2;
  function roadDeadEnds(it) {                     // [start, end]: true where nothing else is paved at the end (cached)
    if (it.deadEnds) return it.deadEnds;
    const pts = it.road.pts, dead = p => { const cell = CIDX.query(p[0], p[1]); if (cell) for (const o2 of cell) if (o2 !== it && dEdgeOf(o2, p[0], p[1]) > -0.5) return false; return true; };
    return (it.deadEnds = [dead(pts[0]), dead(pts[pts.length - 1])]);
  }
  function roadEndIn(it, x, z) {                  // metres inside the nearer DEAD end, along the road (Infinity: not near one)
    const pts = it.road && it.road.pts, n = pts ? pts.length : 0;
    if (n < 2 || (pts[0][0] === pts[n - 1][0] && pts[0][1] === pts[n - 1][1])) return Infinity;
    const DE = roadDeadEnds(it);
    if (!DE[0] && !DE[1]) return Infinity;
    let best = Infinity, bi = 1, bt = 0;
    for (let i = 1; i < n; i++) {
      const a = pts[i - 1], b = pts[i], dx = b[0] - a[0], dz = b[1] - a[1], l2 = dx * dx + dz * dz;
      const t = l2 > 1e-12 ? ((x - a[0]) * dx + (z - a[1]) * dz) / l2 : 0, tc = Math.max(0, Math.min(1, t));
      const d = HYP2(x - (a[0] + dx * tc), z - (a[1] + dz * tc));
      if (d < best) { best = d; bi = i; bt = t; }
    }
    const len = i => HYP2(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    let e = Infinity;
    if (bi === 1 && DE[0]) e = bt * len(1);
    if (bi === n - 1 && DE[1]) e = Math.min(e, (1 - bt) * len(n - 1));
    return e;
  }
  // `reach` (G1541, m, default 0): also a pavement whose edge lies within `reach` OUTSIDE the point (d > -reach) - the
  // patch keeps its 2 cm under a pavement's side, the translucent fade drawn over the ground past the edge
  function pavedAt(x, z, reach) {
    const L = F.toLocal(x, z), lx = L[0], lz = L[1], r0 = reach > 0 ? -reach : 0;
    const cell = CIDX.query(lx, lz);
    let best = null;
    if (cell) for (const it of cell) {
      let d = dEdgeOf(it, lx, lz), dPre = d;
      if (it.kind === 'road' && d > r0) {           // past the square end nothing is drawn, not even a side
        const e = roadEndIn(it, lx, lz);
        if (e < 0) continue;
        dPre = Math.min(d, e); d = Math.min(d, e - PAVE_END_IN);
      }
      if (dPre <= r0) continue;
      if (!best || d > best.d) best = { d, cls: it.cls, halfW: it.halfW || 1e3, kind: it.kind, dPre: Math.max(dPre, best ? best.dPre : -Infinity) };
      else if (dPre > best.dPre) best.dPre = dPre;   // (the deepest pavement for the deep sink; the deepest paved extent for the rest)
    }
    return best;
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
    // (C3c, G861: the rule is zoneWaterYOf above the frame, exported - a Metlakatla house on the kit stands against the same water)
    const zoneWaterY = z => zoneWaterYOf(world, F, z, waterY);
    // THE WATER THAT REACHES AN ITEM. world.waterH answers with the body that
    // TOUCHES a point and -Infinity where none does, so a mole whose middle has
    // been raised out of the sea, or a wharf standing on its own piles, reads no
    // water at all under itself. Ring-sample outward until some is found: the
    // nearest water IS the water that thing floats in.
    const waterAt = (lx, lz) => {
      if (!world.waterH) return -Infinity;
      for (const r of [0, 18, 40, 90, 160]) {
        const n = r ? 8 : 1;
        let best = -Infinity;
        for (let k = 0; k < n; k++) {
          const a = Math.PI * 2 * k / n;
          const w = F.toWorld(lx + Math.cos(a) * r, lz + Math.sin(a) * r);
          const v = world.waterH(w[0], w[1]);
          if (isFinite(v) && v > best) best = v;
        }
        if (isFinite(best)) return best;
      }
      return -Infinity;
    };
    // (G2918: a road's clearing keeps the TREES and the grass out, never the plots a zone sows along it - the forest's planting
    // takes it below, the sower does not)
    const ctx = { T: O.localH, waterY, waterAt, seed: rec.seed, excludes: excl.filter(e => e.what.indexOf('trees') >= 0 && !e.roadClear).map(e => e.poly), plots: O.records.plots, keepOut: excl.filter(e => e.what.indexOf('plots') >= 0).map(e => e.poly) };
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
        { let n = 0; for (const p of sowPlots(z, roads, Object.assign({}, ctx, { waterY: zoneWaterY(z) }))) { p.pick = pickFor(p, cat, mulberry32(p.seed ^ 0x51ed), themeOf(rec), z); if (z.stageSown) p.stageSown = true; if (plotGroundOff(z, p.id)) p.noGround = true; if (plotFenceOff(z, p.id)) p.noFence = true; O.records.plots.push(p); n++; }
          if (!n && z.kind === 'harbour' && roads.some(rd => roadInPoly(polyRoad(rd.pts, rd.w || 3.6), z.poly).length)) O.records.issues.push('harbour ' + z.id + ': no plot of its road reaches the water'); }
    }
    // (v1.33) a zone below its stage's band sowed to hold its land; its plots go now, their ground kept clear of trees
    if (O.records.plots.some(p => p.stageSown)) {
      for (const p of O.records.plots) if (p.stageSown) excl.push({ poly: p.poly, bbox: polyBBox(p.poly), what: ['trees'], derived: true, stage: p.zone });
      O.records.plots = O.records.plots.filter(p => !p.stageSown);
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
    // the tree pool, from a caller that hands the list or the function that makes it
    // (the renderer passes `o.pool()`, some callers pass `pool: () => []`); planForest
    // only ever indexed it and never noticed, the garden pass filters it and did
    const pool = (typeof o.pool === 'function' ? o.pool() : o.pool) || [];
    const tctx = { T: O.localH, waterY, seed: rec.seed, excludes: ctx.excludes.concat(excl.filter(e => e.roadClear).map(e => e.poly)), plots: O.records.plots, roads: roadObjs, pool, trees: O.records.trees };
    for (const z of rec.layers.zones) if (z.kind === 'forest' && z.poly && z.poly.length >= 3 && polySimple(z.poly))
      for (const t of planForest(z, Object.assign({}, tctx, { waterY: zoneWaterY(z) }))) O.records.trees.push(t);
    // THE GARDEN TREES ARE GONE (2026-09-23, the user: "I don't want them to be fixed
    // trees, I want to use the normal tree system, and just paint those zones ... never
    // any tree as fixture without its lod system, we take the normal ones, maybe alter
    // the terrain type, let the game do the work"). They were right and the reasoning is
    // worth keeping: a record tree is ONE THREE.LOD with three hand-built rungs and no
    // impostor, no instancing, no chunking and no stand card - a poor cousin of the
    // island's own fill, which has all of it. Painting the terrain type (and, since
    // v1.23, the cover class with it) puts the same job in the system that was built
    // for it. `planForest` and the `forest` zone kind remain for a place that genuinely
    // wants hand-placed trees; nothing on Jolene does.
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
      O.records.objects.push(Object.assign({ id: ob.id, kind: ob.kind, key: ob.key, x: ob.x, z: ob.z, yaw: +ob.yaw || 0, y: O.localH(ob.x, ob.z) + (+ob.dy || 0), w: +ob.w || 3.6, on: ob.on || 'ground' }, objScale(ob)));   // (G3001: the placer's scale reaches the built prop - it was dropped here)
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
  const recA = normalise(rec0), rec = expandAreas(recA);
  const out = [];
  // THE AREAS (v1.36): a shape, its props known, its marks on a pavement; then every check below on the v1 entries
  // they compose as (an entry's id names its area: '<area>~d' is an area's draw, a migrated one its source's id)
  for (const a of recA.layers.areas) {
    if (!a || !a.id) { out.push('area without an id'); continue; }
    const P = a.props || {};
    for (const k of Object.keys(P)) if (AREA_PROPS.indexOf(k) < 0) out.push('area ' + a.id + ': no property `' + k + '` (' + AREA_PROPS.join(', ') + ')');
    if (P.terraform && AREA_TERRAFORM.indexOf(P.terraform.kind) < 0) out.push('area ' + a.id + ': terraform is ' + AREA_TERRAFORM.join(' | '));
    if (P.marks && MARK_KINDS.indexOf(P.marks.kind) < 0) out.push('area ' + a.id + ': marks are ' + MARK_KINDS.join(' | '));
    if (P.marks && !(P.draw && P.draw.look && RUNWAY_LOOKS[P.draw.look] && RUNWAY_LOOKS[P.draw.look].cls)) out.push('area ' + a.id + ': marks are paint on a pavement - draw it as a pavement first');
    if (P.exclude && P.exclude.what && (!Array.isArray(P.exclude.what) || P.exclude.what.some(w => AREA_EXCLUDE.indexOf(w) < 0))) out.push('area ' + a.id + ': exclude is a list of ' + AREA_EXCLUDE.join(', '));
    if (P.draw && !P.draw.set && !P.draw.look) out.push('area ' + a.id + ': draw has neither a set nor a look');
    if (P.roadside && (!P.roadside.node || !junctionIds(recA).has(P.roadside.node))) out.push('area ' + a.id + ': a roadside apron names a junction of a road (`roadside.node`)');
  }
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
  // v1.37 (G2950): a junction's waypoints lie on one spot (the editor keeps them there; a hand edit may not), its id a string
  { const J = new Map();
    for (const r of rec.layers.roads) if (Array.isArray(r.nodes)) r.nodes.forEach((id, i) => { if (id === null || id === undefined) return; if (typeof id !== 'string' || !id) { out.push('road ' + r.id + ': its waypoint ' + (i + 1) + ' names a junction that is not a word'); return; } const q = r.pts && r.pts[i]; if (!q) return; let l = J.get(id); if (!l) J.set(id, l = []); l.push([r.id, q]); });
    for (const [id, l] of J) { let d = 0; for (const [, q] of l) d = Math.max(d, Math.hypot(q[0] - l[0][1][0], q[1] - l[0][1][1])); if (d > 0.05) out.push('junction ' + id + ': its waypoints are ' + d.toFixed(2) + ' m apart (' + l.map(x => x[0]).join(', ') + ')'); } }
  const plotIds = new Set();   // G2310: plot ids are hangar ids - unique in the record
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
    // G2310 (v1.34): the plots - an array of { id, x, z, hdg?, stand?, taxiOut? }, every id unique in the record (a plot
    // id is a hangar id), a stand finite, a way out a list of points, and the first plot (the hangar's) written once
    if (r.plots != null) {
      if (!Array.isArray(r.plots)) out.push('runway ' + r.id + ': plots is a list of { id, x, z, hdg }');
      else for (const p of r.plots) {
        if (!p || typeof p.id !== 'string' || !p.id) { out.push('runway ' + r.id + ': a plot without an id'); continue; }
        if (!(isFinite(+p.x) && isFinite(+p.z))) out.push('runway ' + r.id + ': plot ' + p.id + ' needs x and z');
        if (p.hdg != null && !isFinite(+p.hdg)) out.push('runway ' + r.id + ': plot ' + p.id + ': hdg is radians');
        if (plotIds.has(p.id)) out.push('runway ' + r.id + ': plot ' + p.id + ' is named twice');
        plotIds.add(p.id);
        if (p.stand != null && !(isFinite(+p.stand.x) && isFinite(+p.stand.z))) out.push('runway ' + r.id + ': plot ' + p.id + ': the stand needs x and z');
        for (const k of ['taxiOut', 'taxiOut1']) if (p[k] != null && !(Array.isArray(p[k]) && p[k].every(q => Array.isArray(q) && isFinite(+q[0]) && isFinite(+q[1])))) out.push('runway ' + r.id + ': plot ' + p.id + ': ' + k + ' is a list of [x, z]');
        if (p.taxiOut != null && p.stand == null) out.push('runway ' + r.id + ': plot ' + p.id + ': a way out needs its stand');
      }
    }
    if (r.hangar && isFinite(+r.hangar.x)) { if (plotIds.has(r.id)) out.push('runway ' + r.id + ': plot ' + r.id + ' is named twice'); plotIds.add(r.id); }
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
  for (const c of rec.layers.ttype) {
    if (!c.poly || c.poly.length < 3) out.push('ttype ' + c.id + ': needs a polygon');
    const code = Math.round(+c.code);
    if (c.veg !== undefined && c.veg !== null && !vegOf(c)) out.push('ttype ' + c.id + ': vegetation ' + JSON.stringify(c.veg) + ' is not none, a biome by name or a new biome with species');
    if (!hasCode(c)) { if (!vegOf(c)) out.push('ttype ' + c.id + ': neither a terrain type nor a vegetation'); }
    else if (!isFinite(code) || code < 2 || code > 16) out.push('ttype ' + c.id + ': code ' + c.code + ' is not a terrain type a place may stamp (2..16)');
    else if (code === 12 || code === 13 || code === 14) out.push('ttype ' + c.id + ': ' + code + ' is DERIVED from slope and canopy, not stamped');
  }
  for (const k of LAYERS) for (const e of rec.layers[k]) { if (ids.has(e.id)) out.push('duplicate id ' + e.id); ids.add(e.id); }
  for (const i of stageIssues(rec)) out.push(i);   // v1.33: the stages' shape (the max law is GATE STAGES', with the career's tracks)
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
  const recA = normalise(rec0), rec = expandAreas(recA), o = opts || {};
  const lines = [];
  const put = (ok, label) => { lines.push({ ok: !!ok, label }); return ok; };
  try {
    const back = unwrap(envelope(recA.name, recA)).rec;
    put(JSON.stringify(back) === JSON.stringify(normalise(recA)), 'the record round-trips');
  } catch (e) { put(false, 'the record round-trips (' + e.message + ')'); }
  const iss = issues(recA);
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
  if (Tn.length) put(!Tn.some(t => !t.placed && (O.records.excludes.some(e => inPoly(e, t.x, t.z)) || (!t.garden && P.some(p => inPoly(p.poly, t.x, t.z))))), Tn.length + ' trees: none in an exclude, none but a GARDEN tree on a plot');
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
const GENERATORS = ['HOUSE_GEN', 'BIG_GEN', 'SHED_GEN', 'TRAM_GEN', 'TOTEM_GEN', 'FACTORY_GEN', 'SPORT_GEN', 'HANGAR_GEN', 'TOWER_GEN', 'MARINE_GEN'];   // SPORT_GEN: the sports grounds (G392); MARINE_GEN: the harbour kit (2026-09-22) - piers, floats, moles, wharves, net pens
const GEN_NS = { HOUSE_GEN: 'house', BIG_GEN: 'big', SHED_GEN: 'shed', TRAM_GEN: 'tram', TOTEM_GEN: 'totem', FACTORY_GEN: 'factory', SPORT_GEN: 'sport', HANGAR_GEN: 'hangar', TOWER_GEN: 'tower', MARINE_GEN: 'marine' };
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

const API = { PREMISES_V, LAYERS, smoothPath, roadCurve, roadHandles, roadLine, roundPoly, roundOk, plotGroundOff, plotFenceOff, SURFACE, SURFACE_NAMES, ROAD_CLS, ROAD_LOOK, roadLook, PAVE_BAND, PAVE_FADE, PAVE_SIDE, GRASS_SIDES_DEF, grassSides, RWY_TREES, rwyTreesMode, RWY_CLEAR_DEF, runwayClearOf, runwayClearPoly, inRwyClear, VEG_MODES, vegOf, vegMixOf, paveBand, PAV_KEYS, PAV_MARKS, STAND_KEYS, ZONE_GRASS, zoneGrass, ZONE_KINDS, ZONE_RULES, KIND_RULES, CATEGORIES, THEMES, THEME_DEF, themeOf, RUNWAY_LOOKS, runwaySite, runwayPlots, runwayIsWater, HANGAR_DIMS, PREMISES_MIGRATORS, GENERATORS, PAVE_SIDE_SOFT,
  fnv, hash32, mulberry32, seedOf, fbm, roadBuildKeys, roadBoxTouch, objScale,
  polyBBox, polyCentroid, polyArea, polyCCW, inPoly, sdPoly, distPtSeg, polySimple, ensureCCW, smf01, polysOverlap,
  polyRoad, roadDist, segIdx, roadClearOf, BED_DEF, bedOf, graphMake, graphOfPattern, junctionIds, newJunctionId, roadInPoly, shoreDepth, sowPlots, planForest, pickFor, PICK_TAGS, RUNWAY_DEF, ALTIPORT, runwayProfile, profileIssues, runwayShoulder, runwayEnds, runwayBox, runwayAerodrome, siteFrame, placeSite, siteShelves, slotAt, polyDrop, bankFalloff, shelfCovers, cellTol, deltaAt, LINK_SOLVERS, solveLinks,
  makeModifier, SpatialIndex, DEF, migrate, normalise, envelope, unwrap, newId, findById, dropPlaces, restorePlaces,
  AREA_PROPS, AREA_LAYERS, AREA_SLOT, AREA_SUFFIX, AREA_TERRAFORM, AREA_EXCLUDE, MARK_KINDS, MARK_DEF, rectPoly, rectOk, areaFoldable, foldAreas, areaEntries, expandAreas, areaOfEntry, areaMarks, areaLabel,
  STAGE_KITS, STAGE_FENCE, STAGE_RUNWAY_VARY, stageFrameKey, stageBand, stageValue, stageStands, stageVaryOf, stageKitObjects, stageKitPoly, stageView, stageRestore, stageIssues,
  frameOf, zoneWaterY: zoneWaterYOf, compose, issues, checks, bake, curvTol, collect, rasterCellIndex, rasterTileDecode, GRQ_A, GRQ_B };
if (typeof window !== 'undefined') window.PREMISES_GEN = API;
// standalone in node (GATE PREMISES requires this file) the API is the module; inside the core
// bundle 90_node_exports.js assigns module.exports after this line and carries PREMISES_GEN itself
if (typeof module !== 'undefined' && module.exports) module.exports = API;
return API;
})();
