#!/usr/bin/env node
// GATE VILLAGE — the village's verdict (G275).
//
//   node tools/_village_check.js              -> the default seeds
//   node tools/_village_check.js --selftest   -> negative verification
//
// The village generator (tools/_village_gen.js) lays a terrain, a road, plots
// and houses; the house generator builds each house on the terrain handed to
// it. This holds the LAYOUT to the rules a plan has to keep:
//
//   1  DETERMINISM: the same seed twice is the same village, to the metre.
//   2  THE PLOTS DO NOT OVERLAP: no plot's corner or centre lies inside
//      another; every plot fronts the road (its frontage is one road width
//      off the road's line, and no further).
//   3  EVERY HOUSE IS ON ITS PLOT: all four corners of its footprint inside
//      the plot's quad, and its centre off the road by more than the road's
//      half width plus a metre.
//   4  EVERY HOUSE STANDS: it builds (no NaN, no degenerate triangle), its
//      floor clears the ground under every corner of the footprint, an
//      inland house has no corner in the water, a waterfront house is on
//      piles, and its stair lands (a jetty on the water side more often
//      than not - the plan aims for it; the gate holds the count).
//   5  THE FENCES ARE ON THE PLOT LINES: every drawn segment's ends are on
//      one edge of its plot's quad, above the water, and a front fence has
//      its gate gap where the path crosses; no fence crosses its own house.
//   6  THE PATHS REACH: every plot with a house has a path whose first
//      point is at the road's edge and whose last is at the house.
//
// NEGATIVE-VERIFIED: --selftest moves a house off its plot, drops a plot
// onto another, pushes a fence into the water, and requires each rule red.
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const TOOLS = __dirname;
const SELFTEST = process.argv.includes('--selftest');

function makeTHREE() {
  function Col(c) { this.hex = c; }
  Col.prototype.setHex = function (h) { this.hex = h; };
  Col.prototype.multiplyScalar = function (k) {
    const c = this.hex, f = v => Math.round(v * k);
    this.hex = (f((c >> 16) & 255) << 16) | (f((c >> 8) & 255) << 8) | f(c & 255);
    return this;
  };
  function Mat(o) { Object.assign(this, { isMat: 1 }, o || {}); this.color = new Col((o && o.color) || 0); }
  class BufferAttribute { constructor(a, n) { this.array = a; this.itemSize = n; } }
  class BufferGeometry {
    constructor() { this.attributes = {}; this.index = null; }
    setAttribute(k, a) { this.attributes[k] = a; }
    setIndex(i) { this.index = i; }
    computeVertexNormals() {}
  }
  class Mesh { constructor(g, m) { this.geometry = g; this.material = m; } }
  class Vec2 { constructor(x, y) { this.x = x; this.y = y; } set(x, y) { this.x = x; this.y = y; } }
  class Texture { constructor(img) { this.image = img; this.repeat = new Vec2(1, 1); } }
  return { BufferAttribute, BufferGeometry, Mesh, Texture, Vector2: Vec2, Color: Col,
           MeshLambertMaterial: Mat, MeshStandardMaterial: Mat, MeshBasicMaterial: Mat,
           DoubleSide: 2, FrontSide: 0, RepeatWrapping: 1000, sRGBEncoding: 3001 };
}

const win = {};
{
  const ctx = { window: win, THREE: makeTHREE(), console, Math, JSON, Float32Array, Object,
                Array, Set, Map, Number, String, isFinite, parseInt, parseFloat };
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  for (const f of ['_house_kit.js', '_house_gen.js', '_village_gen.js'])
    vm.runInContext(fs.readFileSync(path.join(TOOLS, f), 'utf8'), ctx, { filename: f });
}
const HG = win.HOUSE_GEN, HK = win.HOUSE_KIT, VG = win.VILLAGE_GEN;

const fail = [];
let checks = 0;
function check(ok, what, detail) {
  checks++;
  if (!ok) fail.push(what + (detail ? ' — ' + detail : ''));
  return ok;
}

// ---------------------------------------------------------------------------
// the village, built the way the bench builds it: every house through the
// house generator, then the plot finished (paths, fences)
// ---------------------------------------------------------------------------
function buildVillage(V) {
  const vil = VG.makeVillage(V);
  for (const h of vil.houses) {
    const plot = vil.plots[h.plot];
    h.built = HG.build(h.P, 0);
    VG.finishPlot(vil, plot, h, h.built);
  }
  return vil;
}
const centreOf = p => [p.reduce((a, q) => a + q[0], 0) / p.length, p.reduce((a, q) => a + q[1], 0) / p.length];
const distPtSeg = (p, a, b) => {
  const dx = b[0] - a[0], dz = b[1] - a[1];
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / Math.max(1e-9, dx * dx + dz * dz)));
  return Math.hypot(p[0] - (a[0] + dx * t), p[1] - (a[1] + dz * t));
};
const onEdge = (poly, p, tol) => {
  for (let i = 0; i < poly.length; i++)
    if (distPtSeg(p, poly[i], poly[(i + 1) % poly.length]) < tol) return true;
  return false;
};
const distToRoad = (road, p) => {
  let d = 1e9;
  for (let i = 1; i < road.pts.length; i++) d = Math.min(d, distPtSeg(p, road.pts[i - 1], road.pts[i]));
  return d;
};
// a segment crossing a rotated rectangle (the house's footprint): sample it
function segHitsHouse(a, b, h, margin) {
  const n = 24;
  const cy = Math.cos(h.yaw), sy = Math.sin(h.yaw);
  for (let i = 0; i <= n; i++) {
    const x = a[0] + (b[0] - a[0]) * i / n - h.x, z = a[1] + (b[1] - a[1]) * i / n - h.z;
    // world -> local: local = R(-yaw) * (world - c); world = c + (lx cy + lz sy, -lx sy + lz cy)
    const lx = x * cy - z * sy, lz = x * sy + z * cy;
    if (Math.abs(lx) < h.P.L / 2 + margin && Math.abs(lz) < h.P.w / 2 + margin) return true;
  }
  return false;
}

function battery(name, vil) {
  const T = vil.T, road = vil.road;
  // 2 — the plots
  for (let i = 0; i < vil.plots.length; i++) {
    const p = vil.plots[i];
    for (let j = 0; j < vil.plots.length; j++) {
      if (i === j) continue;
      const q = vil.plots[j];
      const c = centreOf(p.poly);
      check(!VG.inPoly(q.poly, c[0], c[1]), name + ': plot ' + p.id + ' lies inside plot ' + q.id);
      for (const k of p.poly)
        check(!VG.inPoly(q.poly, k[0] - (k[0] - c[0]) * 0.02, k[1] - (k[1] - c[1]) * 0.02),
              name + ': plot ' + p.id + ' has a corner in plot ' + q.id);
    }
    // both frontage corners one verge off the road's line (the frontage
    // between them is a chord of the road's curve, and may sit further in)
    for (const k of [0, 1]) {
      const dr = distToRoad(road, p.poly[k]);
      check(Math.abs(dr - (road.w / 2 + 1.0)) < 0.35, name + ': plot ' + p.id + ' does not front the road',
            dr.toFixed(2) + ' m off it');
    }
    check(p.w >= vil.V.plotMin - 0.01 && p.w <= vil.V.plotMax + 0.01, name + ': plot ' + p.id + ' width out of range');
  }
  // 3, 4 — the houses
  let jetties = 0, water = 0;
  for (const h of vil.houses) {
    const plot = vil.plots[h.plot], st = h.built.stats;
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const w = h.toWorld(sx * h.P.L / 2, sz * h.P.w / 2);
      check(VG.inPoly(plot.poly, w[0], w[1]), name + ': house on plot ' + plot.id + ' has a corner off its plot');
      const g = h.ground(sx * h.P.L / 2, sz * h.P.w / 2);
      check(h.P.floorY > g + 0.05, name + ': house on plot ' + plot.id + ' has its floor in the ground',
            h.P.floorY.toFixed(2) + ' vs ' + g.toFixed(2));
      if (plot.side === 'land')
        check(T.h(w[0], w[1]) > T.waterY + 0.05, name + ': an inland house on plot ' + plot.id + ' has a corner in the water');
    }
    check(distToRoad(road, [h.x, h.z]) > road.w / 2 + 1 + Math.min(h.P.L, h.P.w) / 2,
          name + ': house on plot ' + plot.id + ' stands on the road');
    check(st.nan === 0 && st.degen === 0 && st.tris > 400, name + ': house on plot ' + plot.id + ' did not build clean');
    if (plot.side === 'water') {
      water++;
      check(Math.round(h.P.stance) === 3 && h.P.water === 1, name + ': a waterfront house on plot ' + plot.id + ' is not on piles');
      if (st.jetty) jetties++;
    } else check(!st.pier, name + ': an inland house on plot ' + plot.id + ' grew a pier');
    check(!!st.stair || !!st.front, name + ': house on plot ' + plot.id + ' has no way down');
  }
  if (water >= 3) check(jetties >= Math.ceil(water * 0.5), name + ': too few waterfront houses reach the water',
                        jetties + ' of ' + water);
  // 5 — the fences
  for (const plot of vil.plots) {
    const h = plot.house !== undefined ? vil.houses[plot.house] : null;
    for (const seg0 of plot.fences || []) {
      const seg = VG.clipToLand(T, seg0);
      if (!seg) continue;
      check(onEdge(plot.poly, seg.a, 0.05) && onEdge(plot.poly, seg.b, 0.05),
            name + ': a fence on plot ' + plot.id + ' is off the plot line');
      for (const t of [0, 0.25, 0.5, 0.75, 1])
        check(T.h(seg.a[0] + (seg.b[0] - seg.a[0]) * t, seg.a[1] + (seg.b[1] - seg.a[1]) * t) > T.waterY + 0.1,
              name + ': a fence on plot ' + plot.id + ' stands in the water');
      if (h) check(!segHitsHouse(seg.a, seg.b, h, 0.3), name + ': a fence on plot ' + plot.id + ' runs through its house');
      if (seg.kind === 'front' && h) {
        check(!!seg.gap && seg.gap[1] - seg.gap[0] >= 1.2, name + ': the front fence on plot ' + plot.id + ' has no gate');
        // the path crosses inside the gap
        const g = [plot.poly[0][0] + plot.tg[0] * h.gateT, plot.poly[0][1] + plot.tg[1] * h.gateT];
        const L = Math.hypot(seg.b[0] - seg.a[0], seg.b[1] - seg.a[1]);
        const tgt = ((g[0] - seg.a[0]) * (seg.b[0] - seg.a[0]) + (g[1] - seg.a[1]) * (seg.b[1] - seg.a[1])) / Math.max(1e-9, L);
        if (seg.gap) check(tgt > seg.gap[0] - 0.05 && tgt < seg.gap[1] + 0.05,
                           name + ': the gate on plot ' + plot.id + ' is not where the path crosses');
      }
    }
    // 7 — the car (G276): a known car, on its plot a half-length inside the
    //   line, clear of the house and the path, on dry ground
    if (plot.car) {
      const c = plot.car, K = HG.YARD_KIT[c.key];
      check(!!K && K.car, name + ': plot ' + plot.id + ' parked something that is not a car', c.key);
      check(VG.inPoly(plot.poly, c.x, c.z), name + ': the car on plot ' + plot.id + ' is off its plot');
      check(T.h(c.x, c.z) > T.waterY + 0.25, name + ': the car on plot ' + plot.id + ' is in the water');
      check(Math.abs(c.y - T.h(c.x, c.z)) < 0.01, name + ': the car on plot ' + plot.id + ' floats');
      if (h && K) {
        const half = Math.max(K.L, K.W) / 2;
        const cy = Math.cos(h.yaw), sy = Math.sin(h.yaw);
        const x = c.x - h.x, z = c.z - h.z, lx = x * cy - z * sy, lz = x * sy + z * cy;
        check(Math.abs(lx) > h.P.L / 2 + half * 0.5 || Math.abs(lz) > h.P.w / 2 + half * 0.5,
              name + ': the car on plot ' + plot.id + ' is in the house');
        for (const sg of plot.path || [])
          check(distPtSeg([c.x, c.z], sg[0], sg[1]) > half * 0.5, name + ': the car on plot ' + plot.id + ' is on the path');
      }
    }
    // 6 — the path
    if (h) {
      const pth = plot.path || [];
      check(pth.length >= 2, name + ': plot ' + plot.id + ' has no path');
      if (pth.length) {
        const a = pth[0][0], b = pth[pth.length - 1][1];
        check(distToRoad(road, a) < road.w / 2 + 0.6, name + ': the path on plot ' + plot.id + ' does not start at the road',
              distToRoad(road, a).toFixed(2));
        const cy = Math.cos(h.yaw), sy = Math.sin(h.yaw);
        const x = b[0] - h.x, z = b[1] - h.z, lx = x * cy - z * sy, lz = x * sy + z * cy;
        check(Math.abs(lx) < h.P.L / 2 + 6 && Math.abs(lz) < h.P.w / 2 + 8,
              name + ': the path on plot ' + plot.id + ' does not reach the house');
      }
    }
  }
}

// ---------------------------------------------------------------------------
const SEEDS = [3, 11, 27, 5, 8, 20, 44, 61];
for (const seed of SEEDS) {
  const V = Object.assign({}, VG.VDEF, { seed });
  const vil = buildVillage(V);
  check(vil.plots.length >= 6, 'seed ' + seed + ': only ' + vil.plots.length + ' plots');
  check(vil.houses.length === vil.plots.length, 'seed ' + seed + ': a plot has no house');
  // 1 — determinism
  const again = buildVillage(V);
  check(JSON.stringify(vil.plots.map(p => p.poly)) === JSON.stringify(again.plots.map(p => p.poly)) &&
        JSON.stringify(vil.houses.map(h => [h.x, h.z, h.yaw, h.P.L, h.P.w])) ===
        JSON.stringify(again.houses.map(h => [h.x, h.z, h.yaw, h.P.L, h.P.w])),
        'seed ' + seed + ': the village is not deterministic');
  battery('seed ' + seed, vil);
  console.log('seed ' + seed + ': ' + vil.plots.length + ' plots, ' + vil.houses.length + ' houses, ' +
              vil.houses.filter(h => h.built.stats.pier).length + ' piers, ' +
              vil.plots.reduce((a, p) => a + (p.fences || []).length, 0) + ' fence runs');
}

if (SELFTEST) {
  const neg = [];
  const V = Object.assign({}, VG.VDEF, { seed: 3 });
  const probe = mut => {
    const vil = buildVillage(V);
    mut(vil);
    const before = fail.length;
    battery('probe', vil);
    const red = fail.length > before;
    fail.length = before;
    return red;
  };
  if (!probe(vil => { const h = vil.houses[0]; h.x += 60; })) neg.push('a house off its plot passed');
  if (!probe(vil => { vil.plots[1].poly = vil.plots[0].poly.map(p => p.slice()); })) neg.push('two plots on one ground passed');
  if (!probe(vil => { const h = vil.houses[0]; h.P.floorY = -2; })) neg.push('a floor in the ground passed');
  if (!probe(vil => { const p = vil.plots.find(q => q.fences && q.fences.length);
                      p.fences[0].a = [p.fences[0].a[0] + 3, p.fences[0].a[1] + 3]; })) neg.push('a fence off the line passed');
  if (!probe(vil => { const p = vil.plots.find(q => q.house !== undefined); p.path = []; })) neg.push('a plot with no path passed');
  if (!probe(vil => { const p = vil.plots.find(q => q.car); if (p) p.car.x = p.house !== undefined ? vil.houses[p.house].x : p.car.x; if (p) p.car.z = vil.houses[p.house].z; }))
    neg.push('a car in the house passed');
  if (!probe(vil => { const p = vil.plots.find(q => (q.fences || []).some(f => f.kind === 'front'));
                      const f = p.fences.find(f => f.kind === 'front'); f.gap = null; })) neg.push('a front fence with no gate passed');
  for (const n of neg) fail.push('SELFTEST: ' + n);
  console.log('selftest: ' + (neg.length ? neg.length + ' holes' : 'every rule proven able to go red'));
}

if (fail.length) {
  for (const f of fail.slice(0, 40)) console.log('  ! ' + f);
  if (fail.length > 40) console.log('  ... and ' + (fail.length - 40) + ' more');
  console.log('GATE VILLAGE: FAIL (' + fail.length + ')');
  process.exit(1);
}
console.log('GATE VILLAGE: PASS (' + checks + ' checks)');
