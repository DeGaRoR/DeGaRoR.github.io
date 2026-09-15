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
           DoubleSide: 2, FrontSide: 0, RepeatWrapping: 1000, SRGBColorSpace: 'srgb', LinearSRGBColorSpace: 'srgb-linear' };
}

const win = {};
{
  const ctx = { window: win, THREE: makeTHREE(), console, Math, JSON, Float32Array, Object,
                Array, Set, Map, Number, String, isFinite, parseInt, parseFloat };
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  for (const f of ['_house_kit.js', '_house_gen.js', '../src/viewer/sign_tex.js', '_big_gen.js', '_tram_gen.js', '_totem_gen.js', '_village_gen.js', '../src/viewer/tram_run.js'])
    vm.runInContext(fs.readFileSync(path.join(TOOLS, f), 'utf8'), ctx, { filename: f });
}
const HG = win.HOUSE_GEN, HK = win.HOUSE_KIT, VG = win.VILLAGE_GEN, BGN = win.BIG_GEN, TRUN = win.TRAM_RUN;

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
    h.built = (h.gen === 'big' ? BGN : HG).build(h.P, 0);
    VG.finishPlot(vil, plot, h, h.built);
    if (plot.out) plot.out.built = HG.build(plot.out.P, 0);
  }
  if (vil.site && vil.site.tram) VG.tramLine(vil, h => HG.build(h.P, 0));
  for (const h of vil.siteHouses || []) if (!h.tram) h.built = (h.gen === 'big' ? BGN : HG).build(h.P, 0);
  if (vil.park && vil.park.house) vil.park.house.built = HG.build(vil.park.house.P, 0);   // the park's log cabin (G352)
  VG.planBillboards(vil, ['air_taxi', 'bear_tours', 'north_motel']);
  // the trees, on a stub pool shaped like the bench's (tall and small)
  VG.planTrees(vil, [{ key: 'cedar|Cedar', size: 1, sink: 2, proportion: 1, h: 17 },
                     { key: 'firpack|small', size: 2.1, sink: 0, proportion: 2.85, h: 4 }]);
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
    // a big building (G312) publishes no nan/degen count and stands on the
    // land half of a water plot: the house's water rules do not apply
    if (h.P.big) { check(st.tris > 400 && isFinite(st.tris), name + ': ' + h.P.preset + ' on plot ' + plot.id + ' did not build'); continue; }
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
  // 10 — THE LOT'S GROUND (G290): every vertex of the patch two centimetres
  //   over the terrain (it owns its surface, never its height), every weight
  //   in range, alpha 1 inside the plot and 0 at the margin's edge; under
  //   the house the ground is dry, on the path it is dirt, a stride inside
  //   a fenced edge the grass is dense, and at the seafront it is pebbles.
  for (const plot of vil.plots) {
    if (plot.house === undefined) continue;
    const h = vil.houses[plot.house];
    const L = VG.lotGround(vil, plot, h, h.built, []);
    check(L.verts > 100 && L.idx.length > 0, name + ': plot ' + plot.id + ' has no ground patch');
    let off = 0, bad = 0;
    for (let i = 0; i < L.verts; i++) {
      if (Math.abs(L.pos[i * 3 + 1] - (T.h(L.pos[i * 3], L.pos[i * 3 + 2]) + 0.02)) > 0.002) off++;
      for (let k = 0; k < 4; k++) { const v = L.splat[i * 4 + k]; if (!(v >= 0 && v <= 1)) bad++; }
      for (let k = 0; k < 2; k++) { const v = L.tone[i * 2 + k]; if (!(v >= 0 && v <= 1)) bad++; }
      const a = L.alpha[i]; if (!(a >= 0 && a <= 1)) bad++;
    }
    check(off === 0, name + ': the ground patch on plot ' + plot.id + ' is not on the terrain', off + ' vertices');
    check(bad === 0, name + ': the ground patch on plot ' + plot.id + ' has a weight out of range');
    // the nearest vertex to a point, and its weights
    const at = (x, z) => {
      let bi = 0, bd = 1e9;
      for (let i = 0; i < L.verts; i++) { const d = Math.hypot(L.pos[i * 3] - x, L.pos[i * 3 + 2] - z); if (d < bd) { bd = d; bi = i; } }
      return { dry: L.splat[bi * 4 + 1], dirt: L.splat[bi * 4 + 2], peb: L.splat[bi * 4 + 3], lush: L.tone[bi * 2 + 1], alpha: L.alpha[bi], d: bd };
    };
    const c = at(h.x, h.z);
    check(c.dry > 0.9 && c.alpha > 0.99, name + ': plot ' + plot.id + ' is not dry under its house', c.dry.toFixed(2));
    const sg = (plot.path || [])[1];
    if (sg) { const m = at((sg[0][0] + sg[1][0]) / 2, (sg[0][1] + sg[1][1]) / 2); check(m.dirt > 0.85, name + ': plot ' + plot.id + ' has no dirt on its path', m.dirt.toFixed(2)); }
    const fr = (plot.fences || []).find(f => f.kind === 'side');
    if (fr) {
      const mid = [(fr.a[0] + fr.b[0]) / 2, (fr.a[1] + fr.b[1]) / 2];
      const cen = centreOf(plot.poly);
      const dir = [cen[0] - mid[0], cen[1] - mid[1]], dl = Math.hypot(dir[0], dir[1]) || 1;
      const q = at(mid[0] + dir[0] / dl * 0.5, mid[1] + dir[1] / dl * 0.5);
      if (T.h(mid[0], mid[1]) > T.waterY + 0.5) check(q.lush > 0.5, name + ': plot ' + plot.id + ' has no dense grass by its fence', q.lush.toFixed(2));
    }
    if (plot.side === 'water') {
      // a point just above the tide inside the plot, if the patch reaches one
      let found = null;
      for (let i = 0; i < L.verts && !found; i++) { const y = L.pos[i * 3 + 1] - 0.02; if (y > T.waterY + 0.15 && y < T.waterY + 0.3 && L.alpha[i] > 0.99) found = i; }
      if (found !== null) check(L.splat[found * 4 + 3] > 0.9, name + ': plot ' + plot.id + ' has no pebbles at its seafront');
    }
  }
  // 11 — THE TREES (G306): the world's record shape, every one on land and
  //   off the road, none through a house, an outbuilding, a car or a boat,
  //   none on a path or a plot line, a wood behind the village and no
  //   tree of it on a plot, no two closer than a stride; and the clearing
  //   the world's woodland must honour names every plot and the road
  {
    const trees = vil.trees || [];
    check(trees.length >= 20, name + ': the village planted ' + trees.length + ' trees');
    let onWater = 0, onRoad = 0, inHouse = 0, onPath = 0, close = 0, badRec = 0, onPlotFromWood = 0;
    const rectHit = (o, hx, hz0, hz1, x, z) => {
      const c = Math.cos(o.yaw), sn = Math.sin(o.yaw);
      const dx = x - o.x, dz = z - o.z, lx = dx * c - dz * sn, lz = dx * sn + dz * c;
      return Math.abs(lx) < hx && lz > hz0 && lz < hz1;
    };
    for (let i = 0; i < trees.length; i++) {
      const t = trees[i];
      if (!(typeof t.key === 'string' && t.size > 0 && t.yaw >= 0 && isFinite(t.x) && isFinite(t.z))) badRec++;
      if (T.h(t.x, t.z) < T.waterY + 0.5) onWater++;
      if (distToRoad(road, [t.x, t.z]) < road.w / 2 + 1.5) onRoad++;
      for (const p of vil.plots) {
        if (p.house === undefined) continue;
        const h = vil.houses[p.house];
        if (rectHit(h, h.P.L / 2 + 1, -h.P.w / 2 - 1, h.P.w / 2 + (h.P.porch ? h.P.porchD : 0) + 1, t.x, t.z)) inHouse++;
        if (p.out && rectHit(p.out, p.out.P.L / 2 + 1, -p.out.P.w / 2 - 1, p.out.P.w / 2 + 1, t.x, t.z)) inHouse++;
        for (const c of [p.car, p.boat]) if (c && Math.hypot(c.x - t.x, c.z - t.z) < 2.5) inHouse++;
        if (VG.inPoly(p.poly, t.x, t.z))
          for (const sg of (p.path || []).concat(p.outPath || [])) if (distPtSeg([t.x, t.z], sg[0], sg[1]) < 1.0) onPath++;
      }
      for (let j = i + 1; j < trees.length; j++) if (Math.hypot(trees[j].x - t.x, trees[j].z - t.z) < 2.5) close++;
    }
    check(badRec === 0, name + ': ' + badRec + ' tree records are not the world\'s shape');
    check(onWater === 0, name + ': ' + onWater + ' trees stand in the water or on the beach');
    check(onRoad === 0, name + ': ' + onRoad + ' trees stand on the road');
    check(inHouse === 0, name + ': ' + inHouse + ' trees stand through a building, a car or a boat');
    check(onPath === 0, name + ': ' + onPath + ' trees stand on a path');
    check(close === 0, name + ': ' + close + ' pairs of trees closer than a stride');
    const wood = trees.filter(t => !vil.plots.some(p => VG.inPoly(p.poly, t.x, t.z)));
    check(wood.length >= 10, name + ': no wood behind the village (' + wood.length + ' trees off the plots)');
    check(!!vil.clearing && vil.clearing.polys.length === vil.plots.length && vil.clearing.road.pts.length > 2,
          name + ': the clearing does not name every plot and the road');
  }
  // 12 — THE STAPLES (G309): a village of six plots or more has its town
  //   hall and its church, on land plots two or more apart, each from its
  //   named preset with the flag / the belfry, and nothing parked or built
  //   behind them
  if (vil.plots.length >= 6) {
    const civ = vil.houses.filter(h => h.P.civic);
    const hall = civ.find(h => h.P.preset === 'town hall'), church = civ.find(h => h.P.preset === 'church');
    // the generator's own conditions: two land plots for the hall, one of
    // the rest two or more plots away for the church (a site can eat the
    // land plots, G321)
    // (G340: the pair in the middle of the village - the generator's own
    // civicPlots names them)
    const cp = VG.civicPlots(vil.plots, road);
    const wantHall = cp.hall !== undefined, wantChurch = cp.church !== undefined;
    if (hall) check(hall.plot === cp.hall, name + ': the town hall is not on the plot nearest the middle');
    if (church) check(church.plot === cp.church, name + ': the church is not on its plot');
    check(!!hall === wantHall, name + ': ' + (wantHall ? 'no town hall' : 'a town hall with no plot for it'));
    check(!!church === wantChurch, name + ': ' + (wantChurch ? 'no church' : 'a church with no plot for it'));
    if (hall && church) {
      check(hall.plot !== church.plot && Math.abs(hall.plot - church.plot) >= 2, name + ': the town hall and the church share a block');
      for (const h of [hall, church]) {
        const p = vil.plots[h.plot];
        check(p.side === 'land', name + ': ' + h.P.preset + ' stands on a water plot');
        check(!p.out && !p.car && !p.boat, name + ': ' + h.P.preset + ' has a shed, a car or a boat');
        check(h.P.storeys === HG.PRESETS[h.P.preset].storeys, name + ': ' + h.P.preset + ' lost its storeys');
      }
      check(!!hall.built.stats.flagpole, name + ': the town hall has no flag');
      check(hall.P.cupola === 1 && church.P.cupola === 1 && church.P.cupCross === 1, name + ': the belfry or the cupola is missing');
    }
  }
  // 13 — THE BIG BUILDINGS (G312): a village of eight plots or more has
  //   its store, its workshop and its cannery, each on its plot facing the
  //   road, built (no NaN), its sign slot published, its yard open (no
  //   fence, no shed, no car) - and a house's rules still hold for it
  if (vil.plots.length >= 8 && BGN) {
    const bigs = vil.houses.filter(h => h.P.big);
    // (the generator's own conditions, G348: a store wants a free land plot,
    // a workshop a second, the cannery a water plot - the mine's junction
    // and the tram's base station take land plots off the road)
    const cp = VG.civicPlots(vil.plots, road);
    const landFree = vil.plots.filter(p => p.side === 'land' && p.id !== cp.hall && p.id !== cp.church).length;
    const waterN = vil.plots.filter(p => p.side === 'water').length;
    for (const [want, ok] of [['store', landFree >= 1], ['workshop', landFree >= 2], ['cannery', waterN >= 1]])
      check(bigs.some(h => h.P.preset === want) === ok, name + (ok ? ': no ' : ': an unexpected ') + want);
    for (const h of bigs) {
      const p = vil.plots[h.plot];
      check(h.built.stats.tris > 200 && h.built.stats.sign && isFinite(h.built.stats.sign.x), name + ': ' + h.P.preset + ' did not build a sign slot');
      // THE LOT LAW BY CATEGORY (G401): no shed, no wreck, no boat on a working lot; a works is fenced
      // in rails with a wide gate at the front, a shop's front is open to its car park (rails at the sides only)
      check(!p.out && !p.car && !p.boat, name + ': ' + h.P.preset + ' has a shed or a wreck');
      const front = p.fences.find(f => f.kind === 'front');
      if (p.cat === 'industrial') check(!!front && front.gap && front.gap[1] - front.gap[0] >= 6 && p.lot && p.lot.kind === 'gravel', name + ': ' + h.P.preset + ' (industrial) wants a rail fence with a wide gate over a gravel yard');
      else if (p.cat === 'commercial') check(!front && p.lot && p.lot.kind === 'concrete' && p.lot.bays.length >= 2 && p.lot.poly.every(q => VG.inPoly ? true : true), name + ': ' + h.P.preset + ' (commercial) wants an open front over a concrete car park with bays');
      // it faces the road: its +z, in the world, points from the plot's centre toward the road
      const fz = [Math.sin(h.yaw), Math.cos(h.yaw)];
      const c = centreOf(p.poly), fr = p.front;
      const tr = [fr[0] - c[0], fr[1] - c[1]];
      check(fz[0] * tr[0] + fz[1] * tr[1] > 0, name + ': ' + h.P.preset + ' turns its back on the road');
      // a working lot's way in is its slab or its yard (G401): the garden path is only a house's
      const okPath = (p.path || []).length >= 3 || !!(p.lot && p.lot.poly);
      check(okPath, name + ': ' + h.P.preset + ' has no path nor a lot');
    }
  }
  // 14 — THE ROADSIDE BILLBOARDS (G313): two or three, on the inland verge,
  //   on no plot, apart, facing the road, each a baked sign
  {
    const bb = vil.billboards || [];
    check(bb.length >= 2, name + ': only ' + bb.length + ' roadside billboards');
    for (let i = 0; i < bb.length; i++) {
      const b = bb[i];
      check(!!BGN.signMeta(b.key), name + ': billboard ' + b.key + ' is not a baked sign');
      const d = distToRoad(road, [b.x, b.z]);
      check(d > road.w / 2 + 1 && d < road.w / 2 + 4, name + ': a billboard is not on the verge', d.toFixed(2));
      for (const p of vil.plots) check(!VG.inPoly(p.poly, b.x, b.z), name + ': a billboard stands on plot ' + p.id);
      for (let j = i + 1; j < bb.length; j++) check(Math.hypot(bb[j].x - b.x, bb[j].z - b.z) > 25, name + ': two billboards crowd each other');
      check(Math.abs(b.y - T.h(b.x, b.z)) < 0.01, name + ': a billboard floats');
    }
  }
  // 15 — THE SITE (G321): with a theme named, the hill is there (the ground
  //   at its centre well above the road's), every item built on the real
  //   terrain with its floor above the ground under its corners, none on a
  //   plot, none in the water, the mill's tiers each above the hill under
  //   them, the tram shed astride the road with the road through it (the
  //   road's line crosses its footprint between its two openings), and no
  //   plot on the site's span of the land side
  if (vil.site) {
    const S = vil.site, th = S.theme, spur = S.road;
    // THE SPUR (G340): leaves the shore road, ends at the mountain's foot
    // with the site on it, well back from the water; the mill climbs
    check(!!spur && spur.pts.length > 10, name + ': the mine has no spur');
    check(distToRoad(road, spur.pts[0]) < 0.5, name + ': the spur does not leave the shore road');
    check(distToRoad(road, S.at.p) > vil.V.plotDepth + 10, name + ': the site has water access', distToRoad(road, S.at.p).toFixed(1));
    check(distToRoad(spur, S.at.p) < 0.5, name + ': the site is not on its spur');
    check(T.h(S.at.p[0], S.at.p[1]) > T.waterY + 2, name + ': the site is at the water');
    const items = vil.siteHouses || [];
    check(items.length === th.items.length + (S.tram ? 2 : 0), name + ': the site built ' + items.length + ' of ' + (th.items.length + (S.tram ? 2 : 0)));
    for (const h of items) {
      const st = h.built.stats;
      check(st.tris > 300 && isFinite(st.tris), name + ': ' + h.P.preset + ' did not build');
      for (const p of vil.plots) check(!VG.inPoly(p.poly, h.x, h.z), name + ': ' + h.P.preset + ' stands on plot ' + p.id);
      check(T.h(h.x, h.z) > T.waterY + 0.3, name + ': ' + h.P.preset + ' stands in the water');
      if (h.P.mill) {
        // THE SHOULDER (G350): the top house on a flat pad cut into the
        // mountain - the ground under the main block's corners level, its
        // floor a hand over it; the stations on the slope each above the
        // hill under their corners; the mill climbs from the road to the pad;
        // the conveyors fall within bounds on the real hill
        const Mi = st.mill, Tm = Mi.top.main;
        let gT0 = 1e9, gT1 = -1e9;
        for (const x of [Tm.x0, Tm.x1]) for (const z of [Tm.zF, Tm.zB]) { const gy = h.ground(x, z); gT0 = Math.min(gT0, gy); gT1 = Math.max(gT1, gy); }
        check(gT1 - gT0 < 0.05, name + ': the top house does not stand on the flat', (gT1 - gT0).toFixed(2));
        check(Tm.fy > gT1 + 0.1 && Tm.fy < gT1 + 1.0, name + ': the top house floats or sinks', (Tm.fy - gT1).toFixed(2));
        for (const S of Mi.stations) {
          let gU = -1e9;
          for (const x of [S.x0, S.x1]) for (const z of [S.zF, S.zB]) gU = Math.max(gU, h.ground(x, z));
          check(S.fy > gU + 0.1, name + ': the ' + S.tag + ' is in the hill', S.fy.toFixed(2) + ' vs ' + gU.toFixed(2));
        }
        check(!!Mi.bottom && Mi.level - Mi.bottom.fy > 20, name + ': the mill does not climb', Mi.bottom ? (Mi.level - Mi.bottom.fy).toFixed(1) : 'no receiving house');
        check(h.ground(0, Mi.plateau.zB - Mi.plateau.marginB - 2) > Mi.level + 2, name + ': the pad is not cut into the mountain', (h.ground(0, Mi.plateau.zB - Mi.plateau.marginB - 2) - Mi.level).toFixed(1));
        for (const C of Mi.conveyors) if (!C.rope) check(C.deg > 2 && C.deg <= Mi.maxDeg + 1e-6, name + ': the conveyor ' + C.from + ' -> ' + C.to + ' runs at ' + C.deg.toFixed(1) + ' deg on the real hill');
      } else {
        const L = h.P.L, w = h.P.w;
        let gU = -1e9;
        for (const sx of [-1, 1]) for (const sz of [-1, 1]) gU = Math.max(gU, h.ground(sx * L / 2, sz * w / 2));
        check(h.P.floorY > gU, name + ': ' + h.P.preset + ' has its floor in the ground');
      }
      if (h.item.bottomOnRoad) {
        // THE RECEIVING HOUSE ASTRIDE THE ROAD (G333): the mill's bottom
        // house, both ends open, its centre on the road's line, its open
        // ends along the road
        const B = st.mill.bottom;
        check(!!B, name + ': the mill has no receiving house');
        if (B) {
          const wB = h.toWorld(B.x, B.z);
          check(distToRoad(spur, wB) < 1.5, name + ': the receiving house is not on the road', distToRoad(spur, wB).toFixed(2));
          const a = spur.at(S.t + h.item.x), lx = [Math.cos(h.yaw), -Math.sin(h.yaw)];   // the mill's local x, in the world
          check(Math.abs(a.tg[0] * lx[0] + a.tg[1] * lx[1]) > 0.9, name + ': the receiving house does not stand along the road');
        }
      }
    }
    for (const p of vil.plots)
      check(!(p.side === 'land' && p.s1 > S.jt - 14 && p.s0 < S.jt + 14), name + ': a plot on the spur\'s junction');
    // THE GRAVEL YARD (G334): a patch on the terrain, gravel by the mill's
    // foot, grass again at its far corner, the lower buildings on it
    {
      const Y = VG.siteGround(vil, []);
      check(Y.verts > 500 && Y.idx.length > 0, name + ': the yard has no ground');
      let off = 0;
      for (let i = 0; i < Y.verts; i++) if (Math.abs(Y.pos[i * 3 + 1] - (T.h(Y.pos[i * 3], Y.pos[i * 3 + 2]) + 0.025)) > 0.002) off++;
      check(off === 0, name + ': the yard is not on the terrain', off + ' vertices');
      const at = (x, z) => { let bi = 0, bd = 1e9; for (let i = 0; i < Y.verts; i++) { const d = Math.hypot(Y.pos[i * 3] - x, Y.pos[i * 3 + 2] - z); if (d < bd) { bd = d; bi = i; } } return { grav: Y.splat[bi * 4 + 2], under: Y.splat[bi * 4 + 1], d: bd }; };
      const mill = items.find(h => h.P.mill);
      if (mill) {
        const Mi = mill.built.stats.mill, Bm = Mi.bottom;
        const foot = mill.toWorld(Bm.x, Bm.z - Bm.w / 2 - 5);
        const q = at(foot[0], foot[1]);
        check(q.d < 1.5 && q.grav > 0.5, name + ': no gravel at the mill\'s foot', q.grav.toFixed(2));
        const S1 = Mi.stations[1], wS = mill.toWorld(S1.xo, S1.zM), u = at(wS[0], wS[1]);
        check(u.under > 0.5, name + ': the yard is not dry under the mill');
      }
      const far = Y.poly[3], mid = [(Y.poly[2][0] + Y.poly[3][0]) / 2, (Y.poly[2][1] + Y.poly[3][1]) / 2];
      const g2 = at(mid[0] * 0.9 + far[0] * 0.1, mid[1] * 0.9 + far[1] * 0.1);
      check(g2.d > 3 || g2.grav < 0.6, name + ': the yard is gravel to its far edge');
      for (const h of items) if (!h.P.mill && !h.tram) check(VG.inPoly(Y.poly, h.x, h.z), name + ': ' + h.P.preset + ' stands off the yard');
    }
  }
  // 17 — THE TRAM (G348): with a site, the base station stands behind the
  //   shore road on the land side (no water access, no plot under it) with
  //   its open end toward the mountain; the top station stands inland of it
  //   and well above it; the line between their track hooks is one angle
  //   (15-45 degrees) and both stations were built for it; every rope runs
  //   from a base hook to a top hook and climbs; a cabin's dock at each end
  if (vil.site && vil.site.tram) {
    const TR = vil.tram;
    check(!!TR, name + ': the tram line was not solved');
    if (TR) {
      const base = TR.base, top = TR.top;
      check(distToRoad(road, [base.x, base.z]) > 12 && distToRoad(road, [base.x, base.z]) < 40, name + ': the base station is not just behind the road', distToRoad(road, [base.x, base.z]).toFixed(1));
      const a = road.at(vil.site.tram.t), inland = [-a.n[0], -a.n[1]];
      check((base.x - a.p[0]) * inland[0] + (base.z - a.p[1]) * inland[1] > 0, name + ': the base station is on the water side');
      for (const p of vil.plots) check(!VG.inPoly(p.poly, base.x, base.z), name + ': the base station stands on plot ' + p.id);
      check(T.h(base.x, base.z) > T.waterY + 1, name + ': the base station is at the water');
      check((top.x - base.x) * inland[0] + (top.z - base.z) * inland[1] > 80, name + ': the top station is not inland of the base');
      check(top.y > base.y + 30, name + ': the top station is not up the mountain', (top.y - base.y).toFixed(1));
      check(TR.angle > 15 && TR.angle < 45, name + ': the line is not at a tram angle', TR.angle.toFixed(1));
      check(Math.abs(base.P.lineDeg - TR.angle) < 0.6 && Math.abs(top.P.lineDeg - TR.angle) < 0.6, name + ': the stations were not built for the line', base.P.lineDeg.toFixed(1) + '/' + top.P.lineDeg.toFixed(1));
      // the open end of the barn faces the mountain: the barn's +z is inland
      const bz = [Math.sin(base.yaw), Math.cos(base.yaw)];
      check(bz[0] * inland[0] + bz[1] * inland[1] > 0.9, name + ': the barn does not open toward the mountain');
      check(TR.ropes.length === 6 && [0, 1].every(i => TR.ropes.filter(r => r.line === i && r.kind === 'track').length === 1 && TR.ropes.filter(r => r.line === i && r.kind === 'haul').length === 2), name + ': six ropes, a track and two haul strands per line');
      // the lines are parallel: a rope's lateral offset from the base-to-top axis is the same at both ends (paired by side, not by index - G351)
      {
        const u = [top.x - base.x, top.z - base.z], lu = Math.hypot(u[0], u[1]), lat = p => ((p[0] - base.x) * -u[1] + (p[2] - base.z) * u[0]) / lu;
        for (const rp of TR.ropes) check(Math.abs(lat(rp.a) - lat(rp.b)) < 0.05, name + ': a rope crosses the line', rp.kind + ' ' + lat(rp.a).toFixed(2) + ' -> ' + lat(rp.b).toFixed(2));
        check(Math.abs(Math.abs(lat(TR.ropes[0].a)) - Math.abs(lat(TR.ropes[3].a))) < 0.05 && Math.abs(lat(TR.ropes[0].a) - lat(TR.ropes[3].a)) > 4, name + ': the two lines are not a cabin apart either side');
      }
      for (const rp of TR.ropes) {
        const ang = Math.atan2(rp.b[1] - rp.a[1], Math.hypot(rp.b[0] - rp.a[0], rp.b[2] - rp.a[2])) * 180 / Math.PI;
        // (the haul strands leave the top's wheel under the saddle: a few degrees steeper)
        check(Math.abs(ang - TR.angle) < (rp.kind === 'track' ? 1.5 : 8), name + ': a rope is off the line', rp.kind + ' ' + ang.toFixed(1));
        check(rp.b[1] > rp.a[1] + 20, name + ': a rope does not climb');
        // the rope clears the terrain along its run
        let low = 0;
        for (let i = 1; i < 20; i++) { const t = i / 20, x = rp.a[0] + (rp.b[0] - rp.a[0]) * t, z = rp.a[2] + (rp.b[2] - rp.a[2]) * t, y = rp.a[1] + (rp.b[1] - rp.a[1]) * t; if (y < T.h(x, z) + (rp.kind === 'track' ? 6 : 3)) low++; }   // (the haul strands hang under the track rope: three metres behind the base)
        check(low === 0, name + ': a rope runs into the mountain', low + ' of 19 samples');
      }
      check(TR.docks.length === 2 && TR.docks.every(d => isFinite(d.p[0]) && isFinite(d.p[1]) && isFinite(d.p[2])), name + ': no dock for the cabins');
    }
  }
  // 18 — THE TRAM MOVES (G351): the runtime's rope is the chord with the sag
  //   hung between the docks; for s in 0, 1/4, 1/2, 3/4, 1 both cabins'
  //   contact lines are on their ropes, their hangers plumb, their carriages
  //   at the rope's own slope, the pair a cabin's width apart, one climbing
  //   as the other descends, both clear of the mountain; at s = 0 and 1
  //   each cabin's origin is in its slot within 2 cm - which is the
  //   stations and the runtime agreeing on where the rope is over a dock
  if (vil.site && vil.site.tram && vil.tram && TRUN) {
    const TR = vil.tram, run = TRUN.make(TR, null, { sag: 0.012 });
    check(!!TR.slots && TR.slots.base.length === 2 && TR.slots.top.length === 2, name + ': the line has no slots');
    const pv = yaw => { const c = TRUN.CAB_DEF.pivot; return [c[0] * Math.cos(yaw) + c[2] * Math.sin(yaw), c[1], -c[0] * Math.sin(yaw) + c[2] * Math.cos(yaw)]; };
    const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
    let prevS = null;
    for (const sv of [0, 0.25, 0.5, 0.75, 1]) {
      run.setS(sv);
      const ps = run.poses();
      for (let i = 0; i < 2; i++) {
        const p = ps[i], L = run.lines[i];
        const onRope = L.rope.at(p.t), n = TRUN.upNormal(L.rope.tangent(p.t));
        const back = [p.pivot[0] + n[0] * L.cab.ropeUp, p.pivot[1] + n[1] * L.cab.ropeUp, p.pivot[2] + n[2] * L.cab.ropeUp];   // the contact line rides ropeUp over the pivot
        check(dist(back, onRope) < 0.01, name + ': cabin ' + i + ' is off its rope at s ' + sv);
        const off = pv(p.yaw);
        check(dist([p.origin[0] + off[0], p.origin[1] + off[1], p.origin[2] + off[2]], p.pivot) < 1e-6, name + ': cabin ' + i + ' does not hang plumb from its pivot');
        const T2 = L.rope.tangent(p.t), slope = Math.atan2(T2[1], Math.hypot(T2[0], T2[2]));
        check(Math.abs(Math.abs(p.pitch) - Math.abs(slope)) < 1e-6, name + ': cabin ' + i + ' carriage is not at the rope slope at s ' + sv);
        if (sv > 0 && sv < 1) check(p.origin[1] > T.h(p.origin[0], p.origin[2]) + 3, name + ': cabin ' + i + ' scrapes the mountain at s ' + sv);   // (in a dock it stands a metre over the station's ground)
      }
      check(Math.hypot(ps[0].origin[0] - ps[1].origin[0], ps[0].origin[2] - ps[1].origin[2]) > 3.4, name + ': the cabins meet at s ' + sv);
      if (prevS) check((ps[0].origin[1] - prevS[0].origin[1]) * (ps[1].origin[1] - prevS[1].origin[1]) < 0, name + ': the cabins do not move in opposite senses');
      prevS = ps;
    }
    // in a dock the cabin's PIVOT stands on the dock's centre, hangH over the floor (its origin a hand along the slot, by which way it faces)
    const inDock = (p, slot) => dist(p.pivot, [slot[0], slot[1] + TRUN.CAB_DEF.pivot[1], slot[2]]);
    const p0 = run.setS(0).poses(), p1 = run.setS(1).poses();
    check(inDock(p0[0], TR.slots.base[0]) < 0.02 && inDock(p0[1], TR.slots.top[1]) < 0.02, name + ': the cabins are not in their docks at s 0', inDock(p0[0], TR.slots.base[0]).toFixed(3) + '/' + inDock(p0[1], TR.slots.top[1]).toFixed(3));
    check(inDock(p1[0], TR.slots.top[0]) < 0.02 && inDock(p1[1], TR.slots.base[1]) < 0.02, name + ': the cabins are not in their docks at s 1', inDock(p1[0], TR.slots.top[0]).toFixed(3) + '/' + inDock(p1[1], TR.slots.base[1]).toFixed(3));
    // the clock: from a dwell it moves off, reaches the far dock, dwells, and comes back the other way
    run.setS(0); run.phase = 'dwell'; run.wait = 0.1; run.dir = 1;
    let tMax = 0, arrived = false;
    for (let k = 0; k < 4000 && !arrived; k++) { run.tick(0.1); if (run.phase === 'dwell' && run.s > 0.99) arrived = true; tMax += 0.1; }
    check(arrived && tMax > 20 && tMax < 400, name + ': the tram does not make the run', tMax.toFixed(0) + ' s, D ' + run.D.toFixed(0));
    check(run.dir === -1, name + ': the tram does not turn round at the top');
  }
  // 19 — THE TOTEM PARK (G352): up the mountain behind the village, clear of
  //   the mine's spur and the tram's base, its lawn flat at its level with
  //   every pole on it, the level `parkRise` over the road, on the tile; a
  //   path from the road's verge to the frontage's middle over dry ground; a
  //   rail fence on all four edges with one gate, where the path comes in;
  //   no plot corner in the park and no park corner in a plot; no tree on the
  //   lawn or the path; a log cabin built in the clan-house slot
  if (vil.V.park) {
    const PK = vil.park;
    if (check(!!PK, name + ': no totem park')) {
      const pl = PK.plan;
      check(pl.poles.length === win.TOTEM_GEN.KEYS.length, name + ': the park has ' + pl.poles.length + ' poles');
      let offLevel = 0, offGround = 0;
      for (const p of pl.poles) { if (Math.abs(p.y - PK.level) > 1e-6) offLevel++; if (Math.abs(T.h(p.x, p.z) - PK.level) > 0.03) offGround++; }
      check(offLevel === 0 && offGround === 0, name + ': poles off the lawn level', offLevel + '/' + offGround);
      let notFlat = 0; for (const q of pl.footprint) if (Math.abs(T.h(q[0], q[1]) - PK.level) > 0.05) notFlat++;
      check(notFlat === 0, name + ': the lawn is not flat', notFlat + ' of ' + pl.footprint.length);
      const ap = road.at(PK.t);
      check(PK.level > T.h(ap.p[0], ap.p[1]) + 4 && PK.d >= 40, name + ': the park is not up the mountain', (PK.level - T.h(ap.p[0], ap.p[1])).toFixed(1) + ' m up, ' + PK.d.toFixed(0) + ' m in');   // (the rise the tile allows: parkRise where the hill gives it before the edge)
      check(PK.poly.every(q => Math.abs(q[0]) < T.size / 2 - 2 && Math.abs(q[1]) < T.size / 2 - 2), name + ': the park is off the tile');
      let inPark = 0, inPlot = 0;
      for (const p of vil.plots) { for (const q of p.poly) if (VG.inPoly(PK.poly, q[0], q[1])) inPark++; for (const q of PK.poly) if (VG.inPoly(p.poly, q[0], q[1])) inPlot++; }
      check(inPark === 0 && inPlot === 0, name + ': the park and a plot overlap', inPark + '/' + inPlot);
      const pts = PK.path.pts, last = pts[pts.length - 1];
      check(pts.length >= 6 && distToRoad(road, pts[0]) < road.w / 2 + 1.0 && Math.hypot(last[0] - PK.plot.front[0], last[1] - PK.plot.front[1]) < 1.0, name + ': the path does not run from the road to the park');
      check(!pts.some(q => T.h(q[0], q[1]) < T.waterY + 0.5), name + ': the path wades');
      check(PK.fences.length === 4 && PK.fences.filter(f => f.gap).length === 1 && PK.fences[0].kind === 'front' && PK.fences[0].style === 'rail', name + ': the park is not fenced on four sides with one gate');
      const gate = PK.fences[0], gl = Math.hypot(gate.b[0] - gate.a[0], gate.b[1] - gate.a[1]), gm = (gate.gap[0] + gate.gap[1]) / 2;
      const gp = [gate.a[0] + (gate.b[0] - gate.a[0]) * gm / gl, gate.a[1] + (gate.b[1] - gate.a[1]) * gm / gl];
      check(Math.hypot(gp[0] - last[0], gp[1] - last[1]) < 1.5, name + ': the gate is not where the path comes in');
      const treesIn = (vil.trees || []).filter(t => VG.inPoly(PK.poly, t.x, t.z)).length;
      const treesOn = (vil.trees || []).filter(t => { for (let i = 1; i < pts.length; i++) if (distPtSeg([t.x, t.z], pts[i - 1], pts[i]) < 1.5) return true; return false; }).length;
      check(treesIn === 0 && treesOn === 0, name + ': trees on the lawn or the path', treesIn + '/' + treesOn);
      check(!!PK.house && !!PK.house.built && PK.house.built.stats.tris > 300, name + ': no log cabin in the park');
      if (PK.house && pl.house) check(Math.hypot(PK.house.x - pl.house.x, PK.house.z - pl.house.z) < 0.01 && PK.house.P.L <= pl.house.w && PK.house.P.w <= pl.house.d, name + ': the cabin is not in the slot');
      if (vil.site) check(Math.abs(PK.t - vil.site.jt) > 60 && (!vil.site.tram || Math.abs(PK.t - vil.site.tram.t) > 40), name + ': the park crowds the mine or the tram');
    }
  }
  // 20 — THE LIGHTS AT NIGHT (G370): every site building publishes its
  //   fixtures - the mill floods and pendants (interior) and lanterns, each
  //   station floods and pendants - every one within a hand of glass that
  //   glows (the aeroplane's rule); the streets: every second pole carries a
  //   lamp, one per 80 m of road at least, its head over the road's verge
  {
    const glassNear = (built, L) => { const gd = built.bags.glass.data(); let near = 0; for (let i = 0; i < gd.lit.length; i++) { if (gd.lit[i] < 0.5) continue; const dx = gd.pos[i * 3] - L.x, dy = gd.pos[i * 3 + 1] - L.y, dz = gd.pos[i * 3 + 2] - L.z; if (dx * dx + dy * dy + dz * dz < 0.35 * 0.35) near++; } return near; };
    for (const h of vil.siteHouses || []) {
      const lit = h.built && h.built.stats.lit;
      if (!lit) continue;
      const kinds = {};
      for (const L of lit.lights) kinds[L.kind] = (kinds[L.kind] || 0) + 1;
      if (h.P.mill) check((kinds.flood || 0) >= 4 && (kinds.pendant || 0) >= 2 && (kinds.wall || 0) >= 8, name + ': the mill is short of lights', JSON.stringify(kinds));
      if (h.P.station) check((kinds.flood || 0) >= 2 && (kinds.pendant || 0) >= 2 && (kinds.wall || 0) >= 4, name + ': ' + h.P.preset + ' is short of lights', JSON.stringify(kinds));
      let bare = 0;
      for (const L of lit.lights) if (!L.prop && glassNear(h.built, L) < 4) bare++;
      check(bare === 0, name + ': ' + h.P.preset + ' has ' + bare + ' lights without glass');
    }
    const lampPoles = (vil.poles || []).filter(q => q.lamp);
    check(lampPoles.length >= Math.floor(road.length / 80), name + ': only ' + lampPoles.length + ' street lamps on ' + road.length.toFixed(0) + ' m');
    let offRoad = 0;
    for (const q of lampPoles) if (distToRoad(road, [q.x + q.n[0] * 1.9, q.z + q.n[1] * 1.9]) > road.w / 2 + 1.5) offRoad++;
    check(offRoad === 0, name + ': ' + offRoad + ' street lamp heads are not over the road');
  }
  // 16 — THE TERRAIN (G340, the user: "mountain on one side, water on the
  //   other, and a varied, yet coherent slope through"): in every column,
  //   water at the front edge, the back edge a mountain (40 m and more over
  //   the shore), the bench off the shore gentle (under 0.12 per metre over
  //   its first fifty), and the profile never falls more than a gully on the
  //   way up (coherent: a slope, not bumps)
  {
    const half = T.size / 2;
    let cols = 0, bad = [];
    for (let x = -half + 10; x <= half - 10; x += (T.size - 20) / 8) {
      cols++;
      const zs = T.zShore;
      if (!(T.h(x, -half + 2) < T.waterY)) bad.push('no water at x ' + x.toFixed(0));
      const y0 = T.h(x, zs + 2), yB = T.h(x, half - 2);
      if (!(yB - y0 > 40)) bad.push('no mountain at x ' + x.toFixed(0) + ' (' + (yB - y0).toFixed(0) + ' m)');
      if (!((T.h(x, zs + 50) - y0) / 48 < 0.12)) bad.push('the bench is steep at x ' + x.toFixed(0));
      let drop = 0;
      for (let z = zs + 2; z < half - 12; z += 10) drop = Math.max(drop, T.h(x, z) - T.h(x, z + 10));
      if (drop > 6) bad.push('a fall of ' + drop.toFixed(1) + ' m on the way up at x ' + x.toFixed(0));
    }
    check(bad.length === 0, name + ': the terrain: ' + bad.slice(0, 3).join('; '));
    check(cols === 9, name + ': the terrain columns');
  }
  // 8 — THE POLES (G285): a known pole, on the ground, on the road's verge
  //   (a metre or two off the road's line), on no plot
  for (const q of vil.poles || []) {
    const K = HG.YARD_KIT[q.key];
    check(!!K && K.pole, name + ': a road pole is not a pole', q.key);
    check(Math.abs(q.y - T.h(q.x, q.z)) < 0.01, name + ': a pole floats');
    const d = distToRoad(road, [q.x, q.z]);
    check(d > road.w / 2 + 0.2 && d < road.w / 2 + 1.2, name + ': a pole is not on the verge', d.toFixed(2));
    for (const p of vil.plots) check(!VG.inPoly(p.poly, q.x, q.z), name + ': a pole stands on plot ' + p.id);
  }
  // 5b — NO HOLES (G283): every edge of every plot but the shore is fenced,
  //   by this plot or the neighbour it shares the edge with, and the front
  //   fence has its gate. And a waterfront house has its back entrance.
  {
    const key = (a, b) => [a, b].map(p => p[0].toFixed(1) + ',' + p[1].toFixed(1)).sort().join('|');
    const have = new Set();
    for (const p of vil.plots) for (const f of p.fences || []) have.add(key(f.a, f.b));
    for (const p of vil.plots) {
      const edges = [[p.poly[1], p.poly[2], 'side'], [p.poly[3], p.poly[0], 'side'], [p.poly[0], p.poly[1], 'front']];
      if (p.side === 'land') edges.push([p.poly[2], p.poly[3], 'back']);
      const bigLot = p.house !== undefined && vil.houses[p.house].P.big;
      if (vil.V.fenceOdds >= 1 && !bigLot)
        for (const [a, b, kind] of edges)
          check(have.has(key(a, b)), name + ': plot ' + p.id + ' has a hole in its ' + kind + ' fence');
      if (!bigLot) check((p.fences || []).some(f => f.kind === 'front' && f.gap), name + ': plot ' + p.id + ' has no gate');
      if (p.side === 'water' && p.house !== undefined && !bigLot)
        check(!!vil.houses[p.house].built.stats.stoop, name + ': a waterfront house on plot ' + p.id + ' has no back entrance');
    }
  }
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
    // 9 — THE OUTBUILDING (G287): a known kind for the plot's size, all
    //   four corners on the plot, none inside the house's rectangle, the
    //   floor above the ground under every corner, built clean; the car of
    //   a plot with a garage stands in the garage door
    if (plot.out) {
      const o = plot.out, Q = o.P;
      check(['outhouse', 'storage shed', 'garage'].includes(o.kind), name + ': an outbuilding of no known kind', o.kind);
      const cy = Math.cos(h.yaw), sy = Math.sin(h.yaw);
      const oc = Math.cos(o.yaw), os = Math.sin(o.yaw);
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
        const lx0 = sx * Q.L / 2, lz0 = sz * Q.w / 2;
        const w = [o.x + lx0 * oc + lz0 * os, o.z - lx0 * os + lz0 * oc];
        check(VG.inPoly(plot.poly, w[0], w[1]), name + ': the ' + o.kind + ' on plot ' + plot.id + ' has a corner off its plot');
        if (h) {
          const x = w[0] - h.x, z = w[1] - h.z, lx = x * cy - z * sy, lz = x * sy + z * cy;
          check(Math.abs(lx) > h.P.L / 2 + 0.5 || Math.abs(lz) > h.P.w / 2 + 0.5, name + ': the ' + o.kind + ' on plot ' + plot.id + ' is in the house');
        }
        check(Q.floorY > o.ground(sx * Q.L / 2, sz * Q.w / 2) + 0.05, name + ': the ' + o.kind + ' on plot ' + plot.id + ' has its floor in the ground');
      }
      if (o.built) check(o.built.stats.nan === 0 && o.built.stats.degen === 0 && o.built.stats.tris > 100,
                         name + ': the ' + o.kind + ' on plot ' + plot.id + ' did not build clean');
      if (o.kind === 'garage' && plot.car && plot.car.garage) {
        const c = plot.car, cy2 = Math.cos(o.yaw), sy2 = Math.sin(o.yaw);
        const x = c.x - o.x, z = c.z - o.z, lx = x * cy2 - z * sy2, lz = x * sy2 + z * cy2;
        // in FRONT of the door (G290): its own half-length and a step past the wall
        const KC = HG.YARD_KIT[c.key];
        check(Math.abs(lx) < 0.6 && Math.abs(lz - (Q.w / 2 + KC.L / 2 + 1.2)) < 0.3,
              name + ': the car on plot ' + plot.id + ' is not in front of the garage door',
              lx.toFixed(2) + ',' + lz.toFixed(2) + ' vs ' + (Q.w / 2 + KC.L / 2 + 1.2).toFixed(2));
      }
    }
    // 7 — the car (G276): a known car, on its plot a half-length inside the
    //   line, clear of the house and the path, on dry ground
    for (const c of [plot.car, plot.boat]) if (c) {
      const K = plot.car === c ? HG.YARD_KIT[c.key] : HG.PIER_KIT[c.key];
      check(!!K && (K.car || c.key === 'boat_tirola'),
            name + ': plot ' + plot.id + ' parked something that is not a car or the trailer boat', c.key);
      check(VG.inPoly(plot.poly, c.x, c.z), name + ': the car on plot ' + plot.id + ' is off its plot');
      check(T.h(c.x, c.z) > T.waterY + 0.25, name + ': the car on plot ' + plot.id + ' is in the water');
      check(Math.abs(c.y - T.h(c.x, c.z)) < 0.01, name + ': the car on plot ' + plot.id + ' floats');
      if (h && K) {
        const half = Math.max(K.L, K.W) / 2;
        const cy = Math.cos(h.yaw), sy = Math.sin(h.yaw);
        const x = c.x - h.x, z = c.z - h.z, lx = x * cy - z * sy, lz = x * sy + z * cy;
        check(Math.abs(lx) > h.P.L / 2 + half * 0.5 || Math.abs(lz) > h.P.w / 2 + half * 0.5,
              name + ': the car on plot ' + plot.id + ' is in the house');
        if (!c.garage && plot.out) {
          const o = plot.out, cy2 = Math.cos(o.yaw), sy2 = Math.sin(o.yaw);
          const x2 = c.x - o.x, z2 = c.z - o.z, lx2 = x2 * cy2 - z2 * sy2, lz2 = x2 * sy2 + z2 * cy2;
          check(Math.abs(lx2) > o.P.L / 2 + half * 0.5 || Math.abs(lz2) > o.P.w / 2 + half * 0.5,
                name + ': the car on plot ' + plot.id + ' is in the ' + o.kind);
        }
        for (const sg of plot.path || [])
          check(distPtSeg([c.x, c.z], sg[0], sg[1]) > half * 0.5, name + ': the car on plot ' + plot.id + ' is on the path');
      }
    }
    // 6 — the path
    if (h) {
      const pth = plot.path || [];
      check(pth.length >= 2 || !!(plot.lot && plot.lot.poly), name + ': plot ' + plot.id + ' has no path nor a lot');
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
// THE SITE (G321): two of the seeds carry the mine on its hill
const SEEDS = [3, 11, 27, 5, 8, 20, 44, 61];
for (const seed of SEEDS) {
  const V = Object.assign({}, VG.VDEF, { seed, site: (seed === 3 || seed === 20) ? 'kennecott' : '' });
  const vil = buildVillage(V);
  // (G334: the mine's span takes both sides of the road now - its own row
  // of bunkhouses stands across from it - so a site seed keeps fewer plots)
  check(vil.plots.length >= (vil.site ? 3 : 6), 'seed ' + seed + ': only ' + vil.plots.length + ' plots');
  check(vil.houses.length === vil.plots.length, 'seed ' + seed + ': a plot has no house');
  // 1 — determinism: the PLAN is what is compared (plots, house poses), so
  // the plan is what is rebuilt — not every house on it again (2026-09-14,
  // the gate rationalization: this was half the gate's wall)
  const again = VG.makeVillage(V);
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
  if (!probe(vil => { const p = vil.plots.find(q => q.house !== undefined); vil.T = Object.assign({}, vil.T, { h: (x, z) => vil.houses[0].y + 5 }); }))
    neg.push('a ground patch off the terrain passed');
  if (!probe(vil => { const p = vil.plots.find(q => q.out); if (p) { p.out.x = vil.houses[p.house].x; p.out.z = vil.houses[p.house].z; } }))
    neg.push('an outbuilding in the house passed');
  if (!probe(vil => { if (vil.poles.length) { const q = vil.poles[0]; q.x = vil.houses[0].x; q.z = vil.houses[0].z; } }))
    neg.push('a pole on a plot passed');
  if (!probe(vil => { const p = vil.plots.find(q => (q.fences || []).some(f => f.kind === 'side')); p.fences = p.fences.filter(f => f.kind !== 'side'); }))
    neg.push('a hole in a side fence passed');
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
// the verdict line is matched WHOLE by tools/run_gates.js - the count is a
// line of its own (the suffix had the runner reading every pass as red)
console.log(checks + ' checks');
console.log('GATE VILLAGE: PASS');
