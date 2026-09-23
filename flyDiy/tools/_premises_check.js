#!/usr/bin/env node
// GATE PREMISES — the premises record's verdict (G353 / GPREM; the contract:
// futureDesigns/PREMISES-CONTRACT-2026-09-13.md §6).
//
//   node tools/_premises_check.js              -> the fixtures under tools/fixtures/premises_*.json
//   node tools/_premises_check.js --selftest   -> negative verification
//   node tools/_premises_check.js --sink 8402  -> a screenshot sink for the bench (POST /save?name=x, PNG body)
//
// Holds, headless (no THREE, no DOM), on src/core/27_premises.js (the ported composer):
//
//   1  ROUND TRIP: the envelope unwraps to the record it wrapped, nulls and
//      all; a bare record is accepted; a foreign document is refused.
//   2  MIGRATION: every fixture walks to PREMISES_V and normalises.
//   3  CATALOGUE (v3): collect() answers, deriving an entry per preset when a
//      generator has no CATALOGUE; under the vm THREE stub every derived
//      entry of the house and big generators BUILDS at lod 0 on flat ground
//      with no NaN, and its foot is a simple polygon (any corners; v1.4); a key collision is reported.
//      SITES: every item of a site resolves and stands (its floor over its
//      corners), its foot keeps the plots and the wood out; the conveyor
//      link lands (the mill's tramTo is the shed's eave in the mill's frame,
//      to 1 cm); the same seed stands the same site.
//   5  THE GROUND UNDER AN ITEM (contract §2 rule 5, v1.3): an entry's ground
//      block is cut BEFORE placement - a published shelf (rect, zLevel, the
//      two margins: withShelf's law) at the ground zLevel ahead along the
//      item's z; 'level' a slab at the foot's high corner; 'flatten' the
//      foot at its median - each flat to 1 cm, the base untouched beyond
//      the margins, the item's floor a hand over the pad.
//   4  DETERMINISM: the fixture composes twice to the same heights; with its
//      DISJOINT modifiers permuted, the same heights.
//   5  IDENTITY: an empty record changes nothing; the fixture stood far from
//      HOME on the flight world changes nothing outside its extent + falloff,
//      and HOME's pad stays exactly 0 (GATE WORLD's goldens are safe).
//   6  C1 AND THE BUDGET: no step across any falloff band (the slope over
//      0.25 m stays under 3); a million terrainH calls with the fixture
//      composed on the flight world under 2500 ms (WORLD-CONTRACT rule 4).
//   7  FLATTEN: every flatten is flat to 1 cm over its body; a raise moves
//      its body by its dh; a ramp's body lies on its plane; a grade's
//      centreline is at its nodes' heights.
//   8  PLOTS (v1): every plot sown in a zone is a convex quad that does not
//      overlap another, lies inside its zone and outside every exclude; the
//      water side of a plot reaches the water; a zone with no road sows none;
//      the same seed sows the same plots, another seed different ones.
//   9  ROADS (v1): a graded road is flat across (the two shoulders within
//      8 cm of the centreline - at a bend two graded segments meet) and its class answers as the surface inside
//      its width; a forest keeps 3 m off it.
//  10  SURFACE: a surface polygon answers its class inside and -1 outside.
//      RUNWAYS (v2): a strip composes on its profile (the centreline at
//      elev + slope * s within 5 cm over the run, flat across to 2 cm), its
//      class answers inside its width, no forest tree stands within 30 m of
//      its box, its aerodrome record is in W.aerodromes' shape (siteRunway
//      derives it, sitePaintStrip paints it) and sitePattern's pattern for it
//      has no issue; a strip under 150 m or over 5 % is refused.
//  11  EXCLUDE: an exclude polygon answers true inside, false outside; a
//      forest zone plants no tree in an exclude, a clear zone or a plot, and
//      a hand-placed tree is planted where it was put.
//  12  BAKED VS LIVE: the extent rastered to int16 at 1 m; ten thousand
//      points within 0.02 m + cell^2 / 8 of the second differences at the
//      cell — bilinear's own bound (WORLD-V2 §6.3; contract v1.1).
//  8c  THE PARK ON A PLOT (v1.5): a park zone picks the park entry, the
//      composer stands it by the entry's stand, its lawn a derived flatten
//      flat to 1 cm, the entry's fill standing in its slot as an item.
//  9c  THE REAL CABLE: the catalogue's two stations (by tag) and the
//      village's tramLine solve six ropes in the band, lineDeg on both.
//  15  THE MATERIALS (v8): a PBR set inside a polygon, the fade across its
//      contour, the priority between overlaps (surface polygons too).
//  10c THE PROFILE (v8): control points, a monotone spline, the pilot's
//      limits (5 % anywhere, 2.5 % in the touchdown zone, 1.5 % / 30 m at a crest).
//  7b  THE SLOPE POLYGON (v8): level at the middle, a constant slope to a heading.
//  10b THE STAND (v6): a strip's stand and its way out become the pattern's
//      route out (the core's third branch); sound on a flatten, refused off it.
//  8d  THE HARBOUR (v6): only water plots; none off the water, and said.
//  14  THE DRESSING (v5): a park's footpath from the road verge to the lawn,
//      its rail fence with the gate where the path comes in; a prop and a
//      billboard compose on the ground in the premises frame; keyless = issue.
//  13  THE CONTRACT HELD: no catalogue key appears as a string literal in any
//      _premises_* file — the editor accepts a new asset without an edit.
//
// NEGATIVE-VERIFIED: --selftest crosses a polygon, forges an envelope, moves
// a level after compose, and requires each rule red.
'use strict';
const fs = require('fs');
const path = require('path');

const TOOLS = __dirname;
const SELFTEST = process.argv.includes('--selftest');
const SINK = process.argv.indexOf('--sink');
if (SINK >= 0) { sink(+process.argv[SINK + 1] || 8402); return; }

const PG = require(path.join(TOOLS, '..', 'src', 'core', '27_premises.js'));
const vm = require('vm');
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
  class BufferGeometry { constructor() { this.attributes = {}; this.index = null; } setAttribute(k, a) { this.attributes[k] = a; } setIndex(i) { this.index = i; } computeVertexNormals() {} }
  class Mesh { constructor(g, m) { this.geometry = g; this.material = m; } }
  class Vec2 { constructor(x, y) { this.x = x; this.y = y; } set(x, y) { this.x = x; this.y = y; } }
  class Texture { constructor(img) { this.image = img; this.repeat = new Vec2(1, 1); } }
  return { BufferAttribute, BufferGeometry, Mesh, Texture, Vector2: Vec2, Color: Col,
           MeshLambertMaterial: Mat, MeshStandardMaterial: Mat, MeshBasicMaterial: Mat,
           DoubleSide: 2, FrontSide: 0, RepeatWrapping: 1000, SRGBColorSpace: 'srgb', LinearSRGBColorSpace: 'srgb-linear' };
}
// the generators, headless: the catalogue's entries come from them
const GENS = {};
try {
  const ctx = { window: GENS, THREE: makeTHREE(), console, Math, JSON, Float32Array, Object, Array, Set, Map, Number, String, isFinite, parseInt, parseFloat };
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  for (const f of ['_house_kit.js', '_house_gen.js', '../src/viewer/sign_tex.js', '_big_gen.js', '_sport_gen.js', '_marine_gen.js', '_shed_gen.js', '_hangar_gen.js', '_tower_gen.js', '_tram_gen.js', '_totem_gen.js', '_village_gen.js'])
    vm.runInContext(fs.readFileSync(path.join(TOOLS, f), 'utf8'), ctx, { filename: f });
} catch (e) { console.log('  (generators not loaded headless: ' + e.message + ')'); }
const CAT = PG.collect(GENS);

const fail = [];
let checks = 0;
function check(ok, what, detail) {
  checks++;
  if (!ok) fail.push(what + (detail ? ' — ' + detail : ''));
  return ok;
}

// a synthetic terrain with relief at every scale the modifiers care about
const synth = { id: 'synth', terrainH: (x, z) => 3 * Math.sin(x / 40) + 2 * Math.cos(z / 33) + 0.02 * z + 0.4 * Math.sin(x / 7 + z / 9) + (z < -60 ? (z + 60) * 0.15 : 0), waterH: () => -4 };
// the flight world, when the build exists (run_gates builds first; a loose run may not have it)
let FLIGHT = null, FLIGHT_FNS = null;
try { const fc = require(path.join(TOOLS, 'flight_core.js')); if (fc && fc.makeWorld) { FLIGHT = fc.makeWorld(); if (!FLIGHT.id) FLIGHT.id = (FLIGHT.premises && FLIGHT.premises.base && FLIGHT.premises.base.id) || 'W-24km';   /* the composer anchors by the WORLD ID (G398.3): makeWorld returns none, its base carries it - without it every W-24km fixture composed at the origin */ FLIGHT_FNS = { siteRunway: fc.siteRunway, sitePattern: fc.sitePattern, sitePatternIssues: fc.sitePatternIssues, patternPath: fc.patternPath }; } } catch (e) { FLIGHT = null; }

const fixtures = fs.readdirSync(path.join(TOOLS, 'fixtures')).filter(f => /^premises_v\d+_.*\.json$/.test(f)).sort();
check(fixtures.length > 0, '2 there is at least one fixture');

const rnd = PG.mulberry32(11);
const sampleIn = (bb, n, f) => { for (let k = 0; k < n; k++) f(bb.x0 + rnd() * (bb.x1 - bb.x0), bb.z0 + rnd() * (bb.z1 - bb.z0)); };

// the world a fixture names: an anchor keyed 'village-bench' asks for the village's own terrain (its
// size and seed on the anchor), built headless from the generators; every other fixture composes on synth
function worldFor(rec) {
  // ... and a fixture anchored to the flight world alone composes on it (the game's own record)
  const ak = rec.frame && rec.frame.anchors ? Object.keys(rec.frame.anchors) : [];
  if (FLIGHT && ak.indexOf('W-24km') >= 0 && ak.indexOf('village-bench') < 0) return FLIGHT;
  const a = rec.frame && rec.frame.anchors && rec.frame.anchors['village-bench'];
  if (a && GENS.VILLAGE_GEN && GENS.VILLAGE_GEN.makeTerrain) {
    const V = Object.assign({}, GENS.VILLAGE_GEN.VDEF, { size: a.size || 640, seed: a.seed || 3 });
    const T = GENS.VILLAGE_GEN.makeTerrain(V);
    return { id: 'village-bench', terrainH: T.h, waterH: () => T.waterY };
  }
  return synth;
}
for (const fx of fixtures) {
  const txt = fs.readFileSync(path.join(TOOLS, 'fixtures', fx), 'utf8');
  let U;
  try { U = PG.unwrap(txt); } catch (e) { check(false, '2 ' + fx + ' unwraps', e.message); continue; }
  const rec = U.rec;
  const synth = worldFor(rec);   // shadows the module's synth for this fixture: the world it was made on
  check(rec.v === PG.PREMISES_V, '2 ' + fx + ' is at PREMISES_V');
  // 1 round trip
  const back = PG.unwrap(PG.envelope(U.name, rec)).rec;
  check(JSON.stringify(back) === JSON.stringify(rec), '1 ' + fx + ' round-trips through the envelope');
  check(JSON.stringify(PG.unwrap(JSON.stringify(rec)).rec) === JSON.stringify(rec), '1 a bare record is accepted');
  let refused = false; try { PG.unwrap('{"what":"flydiy-build","v":9}'); } catch (e) { refused = true; }
  check(refused, '1 a foreign document is refused');
  check(PG.issues(rec).length === 0, '2 ' + fx + ' has no issues', PG.issues(rec)[0]);

  // 4 determinism
  const O1 = PG.compose(rec, synth, { catalogue: CAT }), O2 = PG.compose(rec, synth, { catalogue: CAT });
  let same = true;
  sampleIn(O1.extent, 2000, (x, z) => { if (O1.terrainAt(x, z) !== O2.terrainAt(x, z)) same = false; });
  check(same, '4 ' + fx + ' composes the same twice');
  {
    const perm = JSON.parse(JSON.stringify(rec));
    perm.layers.terrain.reverse();
    const O3 = PG.compose(perm, synth, { catalogue: CAT });
    // the fixture's modifiers are disjoint (their feathered bboxes do not touch), so order cannot matter
    let disjoint = true;
    const M = rec.layers.terrain.map(m => PG.makeModifier(m, 0).bbox);
    for (let i = 0; i < M.length; i++) for (let j = 0; j < i; j++)
      if (!(M[i].x1 < M[j].x0 || M[j].x1 < M[i].x0 || M[i].z1 < M[j].z0 || M[j].z1 < M[i].z0)) disjoint = false;
    let sameP = true;
    sampleIn(O1.extent, 2000, (x, z) => { if (Math.abs(O1.terrainAt(x, z) - O3.terrainAt(x, z)) > 1e-9) sameP = false; });
    check(!disjoint || sameP, '4 ' + fx + ' disjoint modifiers compose the same in any order');
  }

  // 5 identity
  {
    const E = PG.compose(PG.DEF(), synth);
    let untouched = true;
    sampleIn({ x0: -500, z0: -500, x1: 500, z1: 500 }, 10000, (x, z) => { const h = synth.terrainH(x, z); if (E.terrainH(x, z, h) !== h) untouched = false; });
    check(untouched && E.n === 0, '5 an empty record changes nothing');
    if (FLIGHT) {
      const far = JSON.parse(JSON.stringify(rec));
      far.frame.anchors = { '*': { x: 3000, z: 3000, yaw: 0.3 } };
      const OF = PG.compose(far, FLIGHT);
      let outside = true;
      const ex = OF.extent, pad = 20;
      sampleIn({ x0: 1500, z0: 1500, x1: 4500, z1: 4500 }, 5000, (x, z) => {
        const L = OF.frame.toLocal(x, z);
        if (L[0] > ex.x0 - pad && L[0] < ex.x1 + pad && L[1] > ex.z0 - pad && L[1] < ex.z1 + pad) return;
        const h = FLIGHT.terrainH(x, z);
        if (OF.terrainH(x, z, h) !== h) outside = false;
      });
      check(outside, '5 ' + fx + ' far from HOME changes nothing outside its extent');
      check(Math.abs(OF.terrainH(-520, 0, FLIGHT.terrainH(-520, 0))) < 1e-9 && FLIGHT.terrainH(-520, 0) === 0, '5 HOME\'s pad stays exactly 0');
    } else check(true, '5 (flight world not built here — the identity on the 24 km world is held when run_gates builds)');
  }

  // 6 C1 and the budget
  {
    let slopeMax = 0;
    const ex = O1.extent;
    sampleIn({ x0: ex.x0 - 10, z0: ex.z0 - 10, x1: ex.x1 + 10, z1: ex.z1 + 10 }, 4000, (x, z) => {
      const s = Math.max(Math.abs(O1.terrainAt(x + 0.25, z) - O1.terrainAt(x, z)), Math.abs(O1.terrainAt(x, z + 0.25) - O1.terrainAt(x, z))) / 0.25;
      if (s > slopeMax) slopeMax = s;
    });
    check(slopeMax < 3.0, '6 ' + fx + ' no step across a falloff', 'max slope ' + slopeMax.toFixed(2));
    const W = FLIGHT || synth;
    const OW = PG.compose(rec, W);
    const t0 = Date.now();
    let acc = 0;
    // 200k calls at the same rate as the million this asked for (2.5 us a
    // call): the budget is per call, and five fixtures x a million was 6 s
    // of the gate (2026-09-14, the gate rationalization)
    for (let k = 0; k < 200000; k++) { const x = (k % 1000) * 0.5 - 250, z = ((k / 1000) | 0) * 0.5 - 250; acc += OW.terrainH(x, z, W.terrainH(x, z)); }
    const ms = Date.now() - t0;
    check(ms < 500 && isFinite(acc), '6 two hundred thousand terrainH calls under 500 ms (2.5 us a call)', ms + ' ms on ' + W.id);
  }

  // 7 the modifiers do what they say
  {
    const F = O1.frame;
    for (const m of rec.layers.terrain) {
      if (m.kind === 'grade') {
        let worst = 0;
        for (const p of m.pts) { const w = F.toWorld(p[0], p[1]); worst = Math.max(worst, Math.abs(O1.terrainAt(w[0], w[1]) - (F.y0 + p[2]))); }
        check(worst < 0.01, '7 grade ' + m.id + ' at its nodes\' heights', worst.toFixed(3) + ' m');
        continue;
      }
      const bb = PG.polyBBox(m.poly);
      let worst = 0, n = 0;
      const later = rec.layers.terrain.slice(rec.layers.terrain.indexOf(m) + 1);
      sampleIn(bb, 400, (lx, lz) => {
        if (!PG.inPoly(m.poly, lx, lz)) return;
        const w = F.toWorld(lx, lz);
        // what cuts the flat LATER is not the flat's fault: a road graded through it, a site's shelf, a later modifier
        if (O1.roadNear(w[0], w[1]) < 12 || later.some(q => q.poly && PG.inPoly(q.poly, lx, lz)) || (O1.shelves || []).some(sh => PG.shelfCovers(sh, lx, lz))) return;
        n++;
        const h = O1.terrainAt(w[0], w[1]);
        let target;
        if (m.kind === 'flatten') target = (m.abs ? 0 : F.y0) + m.level;
        else if (m.kind === 'raise') target = synth.terrainH(w[0], w[1]) + m.dh;
        else target = F.y0 + m.plane[0] * lx + m.plane[1] * lz + m.plane[2];
        worst = Math.max(worst, Math.abs(h - target));
      });
      check(n > 20 && worst < 0.01, '7 ' + m.kind + ' ' + m.id + ' holds over its body', worst.toFixed(3) + ' m over ' + n + ' samples');
    }
  }

  // 10 surface, 11 exclude
  for (const s of rec.layers.surface) {
    const bb = PG.polyBBox(s.poly);
    let ok = true;
    sampleIn({ x0: bb.x0 - 20, z0: bb.z0 - 20, x1: bb.x1 + 20, z1: bb.z1 + 20 }, 1000, (lx, lz) => {
      const w = O1.frame.toWorld(lx, lz);
      const inside = PG.inPoly(s.poly, lx, lz);
      const a = O1.surfaceAt(w[0], w[1]);
      const onWay = O1.roadNear(w[0], w[1]) < 12 || O1.runways.some(r => PG.inPoly(PG.runwayBox(r, 2), lx, lz));
      if (inside ? a !== s.surface : (a !== -1 && !onWay)) ok = false;
    });
    check(ok, '10 surface ' + s.id + ' answers ' + PG.SURFACE_NAMES[s.surface] + ' inside and -1 outside');
  }
  for (const e of rec.layers.exclude) {
    const bb = PG.polyBBox(e.poly);
    let ok = true;
    const others = (O1.records.excludes || []).filter(q => q !== e.poly && JSON.stringify(q) !== JSON.stringify(e.poly));
    sampleIn({ x0: bb.x0 - 20, z0: bb.z0 - 20, x1: bb.x1 + 20, z1: bb.z1 + 20 }, 1000, (lx, lz) => {
      const w = O1.frame.toWorld(lx, lz);
      if (!PG.inPoly(e.poly, lx, lz) && others.some(q => PG.inPoly(q, lx, lz))) return;   // another exclude's ground
      if (O1.excludeAt(w[0], w[1], 'trees') !== PG.inPoly(e.poly, lx, lz)) ok = false;
    });
    check(ok, '11 exclude ' + e.id + ' answers inside and not outside');
  }

  // 8 the plots, 9 the roads, 11 the trees (v1)
  {
    const P = O1.records.plots, zones = rec.layers.zones, ex = O1.records.excludes;
    if (rec.layers.zones.some(z => z.kind === 'residential')) {
      check(P.length > 0, '8 ' + fx + ' sows plots', 'none');
      let ok = true, why = '';
      for (let i = 0; i < P.length && ok; i++) {
        const z = zones.find(zz => zz.id === P[i].zone);
        if (P[i].poly.length !== 4) { ok = false; why = P[i].id + ' is not a quad'; }
        if (!P[i].poly.every(c => PG.inPoly(z.poly, c[0], c[1]))) { ok = false; why = P[i].id + ' leaves its zone'; }
        if (P[i].poly.some(c => ex.some(e => PG.inPoly(e, c[0], c[1])))) { ok = false; why = P[i].id + ' in an exclude'; }
        for (let j = 0; j < i && ok; j++) if (PG.polysOverlap(P[i].poly, P[j].poly)) { ok = false; why = P[i].id + ' overlaps ' + P[j].id; }
      }
      check(ok, '8 ' + fx + ' plots: quads, in their zone, out of excludes, no overlap', why);
      const noRoad = JSON.parse(JSON.stringify(rec)); noRoad.layers.roads = [];
      check(PG.compose(noRoad, synth).records.plots.length === 0, '8 a zone with no road sows no plot');
      const again = PG.compose(rec, synth).records.plots;
      check(again.length === P.length && again.every((q, i) => q.id === P[i].id && Math.abs(q.poly[0][0] - P[i].poly[0][0]) < 1e-9), '8 the same seed sows the same plots');
      const other = JSON.parse(JSON.stringify(rec)); other.seed = rec.seed + 7;
      const P2 = PG.compose(other, synth).records.plots;
      check(P2.length !== P.length || P2.some((q, i) => Math.abs(q.s0 - P[i].s0) > 1e-6), '8 another seed sows other plots');
    }
    for (const r of rec.layers.roads) {
      if (r.graded === false) continue;
      const rd = PG.polyRoad(r.pts, r.w);
      let worst = 0, surfOk = true;
      for (let t = 4; t < rd.length - 4; t += 3) {
        const a = rd.at(t), hw = r.w / 2 - 0.05;
        const c = O1.localH(a.p[0], a.p[1]), l = O1.localH(a.p[0] + a.n[0] * hw, a.p[1] + a.n[1] * hw), rr = O1.localH(a.p[0] - a.n[0] * hw, a.p[1] - a.n[1] * hw);
        worst = Math.max(worst, Math.abs(l - c), Math.abs(rr - c));
        const w = O1.frame.toWorld(a.p[0], a.p[1]);
        if (!rec.layers.surface.some(sp => sp.poly && PG.inPoly(sp.poly, a.p[0], a.p[1])) && O1.surfaceAt(w[0], w[1]) !== (r.surface !== undefined ? r.surface : PG.ROAD_CLS[r.cls])) surfOk = false;
      }
      // 8 cm: at a bend on a grade the two feet of an across sample fall a metre either side of the node on
      // segments of different slope (v6: the grade follows the ground every 6 m, so the slopes are the ground's)
      check(worst < 0.08, '9 road ' + r.id + ' is flat across (8 cm: at a bend two graded segments meet)', worst.toFixed(3) + ' m');
      check(surfOk, '9 road ' + r.id + ' answers its surface inside its width');
    }
    const Tn = O1.records.trees;
    if (rec.layers.zones.some(z => z.kind === 'forest')) {
      check(Tn.some(t => !t.placed), '11 ' + fx + ' the forest plants trees');
      // a GARDEN tree (contract v1.22) is ON a plot on purpose - that is the whole of
      // it; everything else the rule says still holds for it
      const bad = Tn.find(t => !t.placed && (ex.some(e => PG.inPoly(e, t.x, t.z)) || (!t.garden && P.some(q => PG.inPoly(q.poly, t.x, t.z))) || O1.roads.some(r => PG.roadDist(r, t.x, t.z) < r.w / 2 + 2.9)));
      check(!bad, '11 no forest tree in an exclude, a clear zone, a plot or a road', bad ? bad.x.toFixed(1) + ',' + bad.z.toFixed(1) : '');
    }
    for (const ob of rec.layers.objects) if (ob.kind === 'tree') check(Tn.some(t => t.placed && t.id === ob.id && t.x === ob.x), '11 tree ' + ob.id + ' is planted where it was put');
    // 10 the runways
    O1.runways.forEach((r, i) => {
      const A = O1.aerodromes[i], E = PG.runwayEnds(r);
      let worst = 0, across = 0, surfOk = true;
      for (let t = 0; t <= r.len; t += 4) {
        const lx = E.end0[0] + E.d[0] * t, lz = E.end0[1] + E.d[1] * t;
        const want = A.elev + PG.runwayProfile(r).at(t), c = O1.localH(lx, lz);
        worst = Math.max(worst, Math.abs(c - want));
        const hw = r.wid / 2 - 0.05;
        across = Math.max(across, Math.abs(O1.localH(lx + E.n[0] * hw, lz + E.n[1] * hw) - c), Math.abs(O1.localH(lx - E.n[0] * hw, lz - E.n[1] * hw) - c));
        const w = O1.frame.toWorld(lx, lz);
        if (O1.surfaceAt(w[0], w[1]) !== A.surface) surfOk = false;
      }
      check(worst < 0.05, '10 runway ' + r.id + ' on its profile', (worst * 100).toFixed(1) + ' cm');
      check(across < 0.02, '10 runway ' + r.id + ' flat across', (across * 100).toFixed(1) + ' cm');
      check(surfOk, '10 runway ' + r.id + ' answers its surface inside its width');
      const box = PG.runwayBox(r, 30);
      check(!Tn.some(t => !t.placed && PG.inPoly(box, t.x, t.z)), '10 no forest tree within 30 m of ' + r.id);
      check(['id', 'name', 'kind', 'x', 'z', 'hdg', 'len', 'wid', 'surface', 'elev', 'tdz', 'spawn'].every(k => A[k] !== undefined), '10 ' + r.id + ' has the aerodrome record fields');
      if (FLIGHT_FNS) {
        const R = FLIGHT_FNS.siteRunway(A);
        check(Math.abs(Math.hypot(R.end1.x - R.end0.x, R.end1.z - R.end0.z) - r.len) < 1e-6, '10 siteRunway derives ' + r.id);
        let iss;
        try { iss = FLIGHT_FNS.sitePatternIssues(FLIGHT_FNS.sitePattern(A, r.site || null), A, r.site || null, 0, FLIGHT_FNS.patternPath); } catch (e) { iss = [e.message]; }   // r.site: the composed stand and way out (v6)
        check(iss.length === 0, '10 sitePatternIssues empty for ' + r.id, iss[0]);
      }
    });
    if (rec.layers.runways.length) {
      const bad = JSON.parse(JSON.stringify(rec)); bad.layers.runways[0].len = 120;
      check(PG.issues(bad).length > 0, '10 a strip under 150 m is refused');
      const steep = JSON.parse(JSON.stringify(rec)); steep.layers.runways[0].slope = 0.08; delete steep.layers.runways[0].profile;   // a profile outranks the slope (v8)
      check(PG.issues(steep).length > 0, '10 a strip over 5 % is refused');
    }
  }
  // 12 baked vs live
  {
    // the composed height rastered; the tolerance is the modifiers' bilinear bound plus the WORLD's own
    // raster miss at the point (a crease of the world's is the world's, not the layer's)
    const B = PG.bake(O1, synth, O1.extent, 1), B0 = PG.bake(PG.compose(PG.DEF(), synth, { noPlace: true }), synth, O1.extent, 1);
    let worst = -Infinity;
    sampleIn(O1.extent, 10000, (lx, lz) => {
      const w = O1.frame.toWorld(lx, lz);
      const live = O1.terrainAt(w[0], w[1]), baked = B.sample(lx, lz);
      const worldMiss = Math.abs(synth.terrainH(w[0], w[1]) - B0.sample(lx, lz));
      worst = Math.max(worst, Math.abs(live - baked) - (0.02 + PG.cellTol(O1, O1.frame, lx, lz, 1) + worldMiss));
    });
    check(worst <= 0, '12 ' + fx + ' baked and live agree', 'over by ' + worst.toFixed(3) + ' m');
  }
  // the panel's own lines all green on the golden
  const lines = PG.checks(rec, synth, { site: FLIGHT_FNS || null, overlay: PG.compose(rec, synth, { catalogue: CAT, globals: GENS, build: r => (GENS[r.gen] ? GENS[r.gen].build(r.P, 0) : null) }) });
  check(lines.every(l => l.ok), '12 the #chk lines are green on ' + fx, lines.filter(l => !l.ok).map(l => l.label).join('; '));
}

// 3 the catalogue: every derived entry builds headless; a site stands; the conveyor lands
{
  if (CAT.entries.size) {
    check(CAT.issues.length === 0, '3 the catalogue has no key collision', CAT.issues[0]);
    let built = 0, bad = null;
    let parks = 0;
    for (const [key, e] of CAT.entries) {
      if (!GENS[e.gen]) continue;
      // a PARK entry does not build: it STANDS (its stand on its generator) - rule 8c stands one
      if (e.kind === 'park') { if (typeof GENS[e.gen][e.stand] !== 'function') { bad = key + ': no stand ' + e.stand; break; } parks++; continue; }
      const P = e.params ? e.params({}) : Object.assign({}, e.P || {}); P.ground = () => 0; P.waterY = -5; P.slopeX = 0; P.slopeZ = 0;
      if (P.mill) P.floorY = 0.6; else P.floorY = Math.max(0.3, P.floorY || 0.3);
      if (e.gen === 'BIG_GEN') P.big = 1;
      try {
        const b = GENS[e.gen].build(P, 0);
        if (!b || !b.stats || !(b.stats.tris > 0)) throw new Error('no stats');
        for (const k in b.bags) { const a = b.bags[k].pos || (b.bags[k].tris !== undefined ? null : null); if (a && a.some && a.some(v => !isFinite(v))) throw new Error('NaN in ' + k); }
        const foot = e.foot(P);
        if (!(foot.length >= 3 && PG.polySimple(foot))) throw new Error('foot is not a simple polygon');
        built++;
      } catch (err) { bad = key + ': ' + err.message; break; }
    }
    check(!bad, '3 every catalogue entry builds headless with a simple foot (' + built + ' built, ' + parks + ' parks)', bad);
    check(built >= 30 || !GENS.HOUSE_GEN, '3 the landed catalogue is built, not skipped (' + built + ')');
    // a concave foot is a foot: the sower and the keep-out use even-odd containment
    { const L = [[-6, -4], [6, -4], [6, 4], [1, 4], [1, 0], [-6, 0]]; check(PG.polySimple(L) && PG.inPoly(L, -3, 2) === false && PG.inPoly(L, 3, 2) === true, '3 a concave L-shaped foot is contained even-odd'); }
    const site = { id: 's1', name: 'the mine', at: { x: 0, z: 0, yaw: 0.2 }, yard: null,
      items: [{ id: 'mill', key: 'house/kennecott mill', x: -4, z: 24, yaw: 0, bottomOnRoad: true }, { id: 'rcv', key: 'big/tram shed', x: 0, z: 0, yaw: 0, onRoad: true }, { id: 'shop', key: 'big/mine shop', x: -34, z: 12, yaw: 0 }, { id: 'cot', key: 'house/mine cottage', x: -22, z: 5, yaw: 0.2 }] };
    const rec = PG.normalise({ seed: 4, layers: { sites: [site], links: [{ id: 'l1', kind: 'conveyor', from: { site: 's1', item: 'mill', hook: 'head' }, to: { site: 's1', item: 'rcv', hook: 'roof' } }],
      zones: [{ id: 'z1', kind: 'forest', poly: [[-120, -80], [120, -80], [120, 140], [-120, 140]], density: 1 }] } });
    const O = PG.compose(rec, synth, { catalogue: CAT, pool: [{ key: 'a|A', size: 1, sink: 0, proportion: 1, h: 14 }] });
    check(O.records.items.length === 4 && !O.records.issues.length, '3 every item of the site resolves from the catalogue', O.records.issues[0]);
    for (const it of O.records.items) {
      let hi = -1e9; for (const sx of [-1, 1]) for (const sz of [-1, 1]) hi = Math.max(hi, it.ground(sx * it.size.L / 2, sz * it.size.w / 2));
      // the mill stands on its pad: floorY = the cut shelf's level ahead along z + 0.5 (the village's law at G367)
      if (it.P.mill) { const sh = it.entry.ground && it.entry.ground.shelf ? it.entry.ground.shelf(it.P) : null; check(!!sh && Math.abs(it.P.floorY - (it.ground(0, sh.zLevel) + 0.5)) < 0.01, '3 item ' + it.item + ' stands on its shelf level + 0.5', sh ? (it.P.floorY - it.ground(0, sh.zLevel)).toFixed(2) : 'no shelf'); }
      else check(it.P.floorY >= hi + 0.05, '3 item ' + it.item + ' stands over its corners', (it.P.floorY - hi).toFixed(2));
    }
    const L = O.records.links[0];
    check(L && L.ok, '9 the conveyor link is solved', L && L.issues[0]);
    if (L && L.ok) {
      const mill = O.records.items.find(i => i.item === 'mill'), rcv = O.records.items.find(i => i.item === 'rcv');
      const w = mill.toWorld(mill.P.tramTo[0], mill.P.tramTo[2]);
      check(Math.hypot(w[0] - rcv.x, w[1] - rcv.z) < 0.01 && Math.abs(mill.y + mill.P.tramTo[1] - (rcv.y + rcv.P.floorY + (rcv.P.eaveH || 5))) < 0.01, '9 the conveyor lands on the shed\'s eave in the mill\'s frame (1 cm)');
    }
    check(!O.records.trees.some(t => O.records.items.some(it => PG.inPoly(it.foot, t.x, t.z))), '3 no forest tree inside a site item\'s foot');
    const O2 = PG.compose(rec, synth, { catalogue: CAT, pool: [{ key: 'a|A', size: 1, sink: 0, proportion: 1, h: 14 }] });
    check(O2.records.items.every((it, i) => it.x === O.records.items[i].x && it.P.floorY === O.records.items[i].P.floorY), '3 the same seed stands the same site');
  } else check(true, '3 (generators not loaded headless here)');
  // 8b THE PICKERS BY TAG: a commercial zone picks among the entries tagged 'commercial'; without a tag, the sampler
  {
    const road = { id: 'r', pts: [[-150, 0], [150, 0]], w: 4, cls: 'gravel', graded: true };
    const zone = { id: 'z', kind: 'commercial', poly: [[-160, -60], [160, -60], [160, 60], [-160, 60]], density: 1 };
    const rec = PG.normalise({ seed: 3, layers: { roads: [road], zones: [zone] } });
    const tagged = { entries: new Map([['x/store', { key: 'x/store', kind: 'building', tags: ['commercial'] }], ['x/cafe', { key: 'x/cafe', kind: 'building', tags: ['commercial'] }], ['x/home', { key: 'x/home', kind: 'building', tags: [] }]]), aliases: {}, keys: () => ['x/store', 'x/cafe', 'x/home'],
      byTag(t) { const out = []; this.entries.forEach(e => { if (e.tags.indexOf(t) >= 0) out.push(e); }); return out; } };
    const O = PG.compose(rec, synth, { catalogue: tagged });
    check(O.records.plots.length > 0 && O.records.plots.every(p => p.pick === 'x/store' || p.pick === 'x/cafe'), '8b a commercial zone picks only the entries tagged commercial', O.records.plots.map(p => p.pick).join(','));
    const Ou = PG.compose(rec, synth, { catalogue: { entries: new Map(), aliases: {}, keys: () => [], byTag: () => [] } });
    check(Ou.records.plots.every(p => p.pick === 'sampler'), '8b without a tagged entry the plots take the sampler');
    const Oa = PG.compose(rec, synth, { catalogue: tagged });
    check(Oa.records.plots.every((p, i) => p.pick === O.records.plots[i].pick), '8b the picks are the seed\'s');
  }
  // 9b THE CABLE'S PLUMBING: a stand-in tramLine (the village's is on its branch) sees the two
  // station records with toWorld / y / yaw, is handed a builder, sets lineDeg on both, and its
  // geometry reaches the link; without tramLine the link says so and stays red
  {
    const foot = () => [[-5, -4], [5, -4], [5, 4], [-5, 4]];
    const mk = (key, station) => [key, { key, kind: 'complex', gen: 'X', preset: key, P: {}, frame: 'house', params: ov => Object.assign({ L: 10, w: 8, floorY: 0.3, station }, ov || {}), foot, keepOut: 3, size: () => ({ L: 10, w: 8 }), ground: { need: 'none' }, hooks: () => [], lod: { dist: [0, 150, 500, 1500] }, slots: {}, tags: [] }];
    const cat = { entries: new Map([mk('x/top', 1), mk('x/base', 2)]), aliases: {}, keys: () => [] };
    const rec = PG.normalise({ seed: 1, layers: { sites: [{ id: 's', at: { x: 0, z: 0, yaw: 0 }, items: [{ id: 'b', key: 'x/base', x: 0, z: 0, yaw: 0 }, { id: 't', key: 'x/top', x: 10, z: 120, yaw: 0 }] }],
      links: [{ id: 'c1', kind: 'cable', from: { site: 's', item: 'b', hook: 'track0' }, to: { site: 's', item: 't', hook: 'track0' } }] } });
    const none = PG.compose(rec, synth, { catalogue: cat, globals: {}, build: () => ({ stats: {} }) });
    check(none.records.links.length === 1 && !none.records.links[0].ok && /tramLine is not here/.test(none.records.links[0].issues[0]), '9b without tramLine the cable link says so');
    let builds = 0;
    const fake = { VILLAGE_GEN: { tramLine(vil, buildFn) {
      if (!vil.base || !vil.top || typeof vil.base.toWorld !== 'function') throw new Error('no station records');
      for (let pass = 0; pass < 3; pass++) { vil.base.P.lineDeg = 30; vil.top.P.lineDeg = 30; buildFn(vil.base); buildFn(vil.top); }
      const aw = vil.base.toWorld(0, 0), bw = vil.top.toWorld(0, 0);
      return { angle: 30, ropes: [{ kind: 'track', line: 0, a: [aw[0], vil.base.y + 8, aw[1]], b: [bw[0], vil.top.y + 8, bw[1]] }], docks: [], slots: [], base: vil.base, top: vil.top, pair: [vil.base.id, vil.top.id] };
    } } };
    const O = PG.compose(rec, synth, { catalogue: cat, globals: fake, build: r => { builds++; return { stats: { station: { hooks: {} } } }; } });
    const L = O.records.links[0];
    check(L && L.ok && builds === 6, '9b the cable solver is handed the builder and calls it three times per station', 'builds ' + builds + (L && L.issues[0] ? ' ' + L.issues[0] : ''));
    check(O.records.items.every(it => it.P.lineDeg === 30), '9b lineDeg reaches both stations\' P');
    check(L && L.geom && L.geom.ropes && L.geom.ropes.length === 1, '9b the ropes reach the link');
  }
  // 8c THE PARK ON A PLOT (contract v1.5): a park zone's plots pick the entry tagged 'park'; the
  // composer stands it by the entry's own stand, cuts its lawn as a derived flatten at the plan's
  // level (flat to 1 cm over the footprint), and the entry's fill stands in its slot as an item
  if (CAT.byTag && CAT.byTag('park').length && GENS.TOTEM_GEN && GENS.VILLAGE_GEN) {
    const road = { id: 'r', pts: [[-200, 0], [200, 0]], w: 4, cls: 'gravel', graded: true };
    const zone = { id: 'z', kind: 'park', poly: [[-210, -80], [210, -80], [210, 80], [-210, 80]], density: 1 };
    const rec = PG.normalise({ seed: 5, layers: { roads: [road], zones: [zone] } });
    const O = PG.compose(rec, synth, { catalogue: CAT, globals: GENS });
    const pk = O.records.parks[0];
    check(O.records.plots.length > 0 && O.records.plots.every(p => CAT.entries.get(p.pick) && CAT.entries.get(p.pick).kind === 'park'), '8c a park zone picks the park entry on every plot', O.records.plots.map(p => p.pick).join(','));
    check(O.records.parks.length === O.records.plots.length, '8c every park plot stands a park', O.records.parks.length + ' of ' + O.records.plots.length);
    if (pk) {
      let worst = 0;
      const fp = pk.plan.lawn || pk.plan.footprint, bb = PG.polyBBox(fp);
      sampleIn(bb, 400, (x, z) => { if (PG.inPoly(fp, x, z) && PG.sdPoly(fp, x, z) < -0.5) worst = Math.max(worst, Math.abs(O.localH(x, z) - pk.level)); });
      check(worst < 0.01, '8c the lawn (the plan lawn polygon) is a derived flatten at the plan level (1 cm)', worst.toFixed(3) + ' m');
      check(!!pk.plan.lawn && PG.inPoly(pk.plan.lawn, pk.plan.house.x, pk.plan.house.z), '8c the house slot lies on the lawn');
      const it = O.records.items.find(i => i.park === pk.id);
      check(!!it && it.gen === 'HOUSE_GEN', '8c the slot occupant stands as an item', it ? it.key : 'none');
      if (it) { let hi = -1e9; for (const sx of [-1, 1]) for (const sz of [-1, 1]) hi = Math.max(hi, it.ground(sx * it.P.L / 2, sz * it.P.w / 2)); check(it.P.floorY >= hi + 0.05 && Math.abs(it.P.floorY - hi) < 1.5, '8c the slot house stands over its corners on the lawn', (it.P.floorY - hi).toFixed(2)); }
      const O2 = PG.compose(rec, synth, { catalogue: CAT, globals: GENS });
      check(JSON.stringify(O2.records.parks[0].plan.poles) === JSON.stringify(pk.plan.poles), '8c the same seed stands the same park');
    }
    check(O.records.issues.length === 0, '8c the park composes without an issue', O.records.issues[0]);
    // on a flank the plots cannot hold a lawn: refused with the reason, no park stood there
    const steep = { id: 'steep', terrainH: (x, z) => 0.9 * z, waterH: () => -40 };
    const Os = PG.compose(rec, steep, { catalogue: CAT, globals: GENS });
    check(Os.records.parks.length === 0 && Os.records.plots.length > 0 && Os.records.issues.some(i => /bank/.test(i)), '8c a lawn on a 90 % flank is refused with the reason', Os.records.issues[0] || (Os.records.parks.length + ' parks'));
    // on a slope it accepts, the bank widens with the drop and never passes 3:1
    const mild = { id: 'mild', terrainH: (x, z) => 0.3 * z, waterH: () => -40 };
    const Om = PG.compose(rec, mild, { catalogue: CAT, globals: GENS });
    let steepest = 0;
    for (const sh of Om.shelves) if (sh.plot) { const bb = PG.polyBBox(sh.poly); sampleIn({ x0: bb.x0 - 10, x1: bb.x1 + 10, z0: bb.z0 - 10, z1: bb.z1 + 10 }, 300, (x, z) => { const da = Om.localH(x, z) - mild.terrainH(x, z), db = Om.localH(x + 0.25, z) - mild.terrainH(x + 0.25, z); steepest = Math.max(steepest, Math.abs(db - da) / 0.25); }); }
    check(Om.records.parks.length > 0 && steepest < 3.0, '8c a lawn on a 30 % slope stands, its bank under 3:1', Om.records.parks.length + ' parks, bank ' + steepest.toFixed(2));
  }
  // 9c THE REAL CABLE: the two stations from the catalogue by their tags, the village's own tramLine
  // handed the composer's builder - solved, six ropes, the angle in the band, lineDeg on both
  if (CAT.byTag && CAT.byTag('top station').length && CAT.byTag('base station').length && GENS.VILLAGE_GEN && typeof GENS.VILLAGE_GEN.tramLine === 'function') {
    const topKey = CAT.byTag('top station')[0].key, baseKey = CAT.byTag('base station')[0].key;
    const slope = { id: 'slope', terrainH: (x, z) => 0.35 * z + 0.4 * Math.sin(x / 9), waterH: () => -40 };
    const rec = PG.normalise({ seed: 1, layers: { sites: [{ id: 's', at: { x: 0, z: 0, yaw: 0 }, items: [{ id: 'b', key: baseKey, x: 0, z: 0, yaw: 0 }, { id: 't', key: topKey, x: 0, z: 150, yaw: 0 }] }],
      links: [{ id: 'c1', kind: 'cable', from: { site: 's', item: 'b', hook: 'track0' }, to: { site: 's', item: 't', hook: 'track0' } }] } });
    const t0 = Date.now();
    const O = PG.compose(rec, slope, { catalogue: CAT, globals: GENS, build: r => GENS[r.gen].build(r.P, 0) });
    const L = O.records.links[0];
    check(!!L && L.ok, '9c the real tramLine solves the cable between two catalogue stations', L ? L.issues.join('; ') : 'no link');
    check(!!(L && L.geom && L.geom.ropes && L.geom.ropes.length === 6), '9c six ropes', L && L.geom && L.geom.ropes ? L.geom.ropes.length : 0);
    const deg = L && L.geom ? L.geom.angle : NaN;
    check(deg >= 15 && deg <= 45, '9c the line is in the band', String(deg));
    check(O.records.items.every(it => isFinite(it.P.lineDeg)), '9c lineDeg reaches both stations');
    check(Date.now() - t0 < 8000, '9c the built solve is under 8 s', (Date.now() - t0) + ' ms');
  }
  // 5b THE WORLD TAKES A PREMISES (the port, G385): makeWorld(0, { premises }) composes the strip
  // fixture over the flight world - inside the extent the ground is the composed one and the strip's
  // surface answers, outside every height is byte-identical to the bare world, the strip is in
  // W.aerodromes with its site registered for the pilot, and the premises block on the world answers
  if (FLIGHT && FLIGHT_FNS && typeof require('./flight_core.js').makeWorld === 'function') {
    const fc = require('./flight_core.js');
    const txt = fs.readFileSync(path.join(TOOLS, 'fixtures', 'premises_v1_strip.json'), 'utf8');
    const rec = PG.unwrap(txt).rec;
    const W = fc.makeWorld(0, { premises: txt });
    check(!!W.premises && !!W.premises.overlay && W.premises.overlay.n > 0, '5b the world carries the composed premises');
    const F = PG.frameOf(rec, W), ex = W.premises.overlay.extent;
    // G455: THE BARE WORLD IS THE SAME BAKE WITH THE LAYER UNSET. Since G413
    // makeWorld reads the premises' strips BEFORE the hydrology bake and
    // domes the drainage over them (20_world.js pmStrips) so no river
    // crosses a strip; the fixture's strip re-routes one, and its carved
    // bed differs from a bare makeWorld() by up to 3.1 m along a thin line
    // 0.8–1.8 km away (measured, a 20 m grid). That is the bake's, on
    // purpose. What this rule protects is the LAYER: outside its extent the
    // composed height must be the height with no layer — so the reference
    // is the same world after `premises.set(null)`, which drops PM and the
    // height memo and leaves the bake alone. Byte-identical on 4000 random
    // samples and the dense grid before this line was written.
    const W0 = fc.makeWorld(0, { premises: txt }); W0.premises.set(null);
    check(!W0.premises.overlay, '5b the layer comes off (premises.set(null))');
    let differs = 0, same = 0, outside = true, differsBare = 0;
    const r2 = PG.mulberry32(3);
    for (let k = 0; k < 400; k++) { const lx = ex.x0 + r2() * (ex.x1 - ex.x0), lz = ex.z0 + r2() * (ex.z1 - ex.z0); const w = F.toWorld(lx, lz); if (W.terrainH(w[0], w[1]) !== W0.terrainH(w[0], w[1])) differs++; else same++; }
    for (let k = 0; k < 400; k++) { const x = (r2() - 0.5) * 20000, z = (r2() - 0.5) * 20000; if (W.premises.overlay.inExtent(x, z)) continue; if (W.terrainH(x, z) !== W0.terrainH(x, z)) outside = false; if (W.terrainH(x, z) !== FLIGHT.terrainH(x, z)) differsBare++; }
    check(differs > 0, '5b inside the extent the ground is the composed one', differs + ' of ' + (differs + same) + ' samples differ');
    check(outside, '5b outside the extent every height is the bare world\'s (the same bake, the layer unset)');
    console.log('     5b the strips\' drainage domes (G413) move the bare bake at ' + differsBare + ' of 400 outside samples — the bake\'s, not the layer\'s');
    const A = W.aerodromes.find(a => a.premises);
    check(!!A && A.kind === 'strip', '5b the strip is in W.aerodromes');
    check(!!A && fc.siteOf(A.id) === (W.premises.overlay.runways[0].site || null), '5b the strip\'s site (its stand, its way out) is registered for the pilot');
    const E = PG.runwayEnds(Object.assign({}, PG.RUNWAY_DEF, rec.layers.runways[0])), cw = F.toWorld(rec.layers.runways[0].c[0], rec.layers.runways[0].c[1]);
    check(W.surface(cw[0], cw[1]) === (rec.layers.runways[0].surface === undefined ? PG.SURFACE.GRASS : rec.layers.runways[0].surface), '5b the strip\'s surface answers through the world', String(W.surface(cw[0], cw[1])));
    // 5c - PROTO TRAFFIC (G432, contract v1.13): a road's `traffic` reaches the composed road; absent
    //   is 0; a negative count is 0; the official premises (Skarvik) runs some on its one road
    { const t0 = PG.compose(PG.normalise({ layers: { roads: [{ id: 'r1', pts: [[0, 0], [300, 0]], w: 4, traffic: 6 }, { id: 'r2', pts: [[0, 40], [300, 40]], w: 4 }, { id: 'r3', pts: [[0, 80], [300, 80]], w: 4, traffic: -3 }] } }), FLIGHT, { pool: () => [], globals: {} });
      const by = Object.fromEntries(t0.roads.map(r => [r.id, r.traffic]));
      check(by.r1 === 6 && by.r2 === 0 && by.r3 === 0, '5c a road\'s traffic reaches the composed road (absent and negative are 0)', JSON.stringify(by));
      const off = PG.unwrap(fs.readFileSync(path.join(TOOLS, 'fixtures', 'premises_v1_official.json'), 'utf8')).rec;
      check(off.layers.roads.some(r => +r.traffic > 0), '5c the official premises runs traffic on a road'); }
    const bare = fc.makeWorld(0);
    check(bare.premises && bare.premises.overlay === null && bare.terrainH(cw[0], cw[1]) === FLIGHT.terrainH(cw[0], cw[1]), '5b a world with no premises is the bare world');
  }
  // 15 THE MATERIALS (v8): a set is 1 well inside its polygon, 0.5 on the contour, 0 past the fade; a
  // higher priority paints over a lower where they overlap, whatever the record's order; a surface
  // polygon's priority decides the physics class where two overlap
  {
    const rec = PG.normalise({ seed: 1, layers: {
      material: [{ id: 'm1', poly: [[-40, -40], [40, -40], [40, 40], [-40, 40]], set: 'x', fade: 8, z: 2 }, { id: 'm2', poly: [[0, -60], [80, -60], [80, 60], [0, 60]], set: 'y', fade: 0, z: 0 }],
      surface: [{ id: 'y1', poly: [[-50, -50], [50, -50], [50, 50], [-50, 50]], surface: 5, z: 1 }, { id: 'y2', poly: [[0, -50], [90, -50], [90, 50], [0, 50]], surface: 6, z: 0 }] } });
    const O = PG.compose(rec, synth, { noPlace: true });
    const at = (x, z) => O.materialAt(...O.frame.toWorld(x, z));
    check(at(-20, 0) && at(-20, 0).set === 'x' && at(-20, 0).w === 1, '15 a set is whole well inside its polygon');
    check(at(-40, 0) && Math.abs(at(-40, 0).w - 0.5) < 0.05, '15 half on the contour', at(-40, 0) && at(-40, 0).w.toFixed(2));
    check(at(-46, 0) === null || at(-46, 0).w < 0.02, '15 nothing past the fade');
    check(at(20, 0) && at(20, 0).set === 'x', '15 the higher priority paints over the lower where they overlap');
    check(at(60, 0) && at(60, 0).set === 'y', '15 the lower shows where the higher is not');
    check(O.surfaceAt(...O.frame.toWorld(20, 0)) === 5 && O.surfaceAt(...O.frame.toWorld(70, 0)) === 6, '15 the surface priority decides the class where two overlap');
    check(PG.issues(PG.normalise({ seed: 1, layers: { material: [{ id: 'm', poly: [[0, 0], [10, 0], [10, 10], [0, 10]], set: '' }] } })).some(i => /no set/.test(i)), '15 a material without a set is an issue');
  }
  // 10c THE PROFILE (v8): a strip with a hump composes on its monotone spline (the centreline at the
  // profile to 5 cm, no overshoot past a control point), the pilot's limits answer - a 4 % hump in the
  // middle passes, a 6 % one is refused, a hump in the touchdown zone is refused, a sharp crest is refused
  {
    const mk = prof => PG.normalise({ seed: 1, layers: { runways: [{ id: 'w', c: [0, 0], hdg: 0, len: 600, wid: 24, profile: prof }] } });
    const rec = mk([[0, 0], [0.5, 5], [1, 0]]);
    const O = PG.compose(rec, synth, { noPlace: true });
    const A = O.aerodromes[0], r = O.runways[0], pr = PG.runwayProfile(r);
    let worst = 0, over = 0;
    for (let t = 0; t <= 600; t += 4) { const h = O.localH(-300 + t, 0); worst = Math.max(worst, Math.abs(h - (A.elev + pr.at(t)))); if (pr.at(t) > 5.0001) over = Math.max(over, pr.at(t) - 5); }
    check(worst < 0.05, '10c the centreline is on its profile (5 cm)', worst.toFixed(3) + ' m');
    check(over === 0 && Math.abs(pr.at(300) - 5) < 1e-9, '10c the spline is monotone: no overshoot past the hump\'s point', String(over));
    check(PG.issues(rec).length === 0, '10c a 5 m hump over 600 m passes the pilot\'s limits', PG.issues(rec)[0]);
    check(PG.issues(mk([[0, 0], [0.5, 12], [1, 0]])).some(i => /over 5 %/.test(i)), '10c a 12 m hump is over 5 % and refused');
    check(PG.issues(mk([[0, 0], [0.1, 3], [1, 0]])).some(i => /touchdown zone/.test(i)), '10c a hump in the touchdown zone is refused');
    check(PG.issues(mk([[0, 0], [0.45, 4], [0.5, 4.2], [0.55, 1], [1, 0]])).some(i => /crest/.test(i)), '10c a sharp crest is refused');
    // the old linear slope still reads as a two-point profile
    const lin = PG.compose(PG.normalise({ seed: 1, layers: { runways: [{ id: 'w', c: [0, 0], hdg: 0, len: 600, wid: 24, slope: 0.02 }] } }), synth, { noPlace: true });
    check(Math.abs(lin.localH(300, 0) - lin.localH(-300, 0) - 12) < 0.05, '10c a linear slope is a two-point profile', (lin.localH(300, 0) - lin.localH(-300, 0)).toFixed(2));
  }
  // 7b THE SLOPE POLYGON (v8): level at the middle, a constant slope toward a heading
  {
    const rec = PG.normalise({ seed: 1, layers: { terrain: [{ id: 's', kind: 'ramp', poly: [[-50, -50], [50, -50], [50, 50], [-50, 50]], level: 10, slope: 0.04, hdg: 90, falloff: 10 }] } });
    const O = PG.compose(rec, synth, { noPlace: true });
    const y0 = O.frame.y0;
    check(Math.abs(O.localH(0, 0) - (y0 + 10)) < 0.01, '7b the slope polygon holds its level at the middle', (O.localH(0, 0) - y0).toFixed(2));
    check(Math.abs((O.localH(25, 0) - O.localH(-25, 0)) - 2) < 0.02 && Math.abs(O.localH(0, 25) - O.localH(0, -25)) < 0.02, '7b it rises 4 % toward +x and not along z', ((O.localH(25, 0) - O.localH(-25, 0))).toFixed(2));
  }
  // 10b THE STAND AND ITS WAY OUT (v6): a strip with a stand beside it and two taxi points gets a pattern
  // whose route out starts at the stand, walks the taxi points, enters the centreline and reaches
  // hold0 - sound when the stand is on a flatten, "leaves the flat ground" when it is not
  if (FLIGHT_FNS) {
    const strip = { id: 'w', c: [0, 0], hdg: 0, len: 600, wid: 24, slope: 0, stand: { x: 60, z: 90, hdg: null }, taxiOut: [[20, 70], [-40, 0]] };
    const flat = { id: 'f', kind: 'flatten', poly: [[-60, 40], [90, 40], [90, 110], [-60, 110]], level: 0, falloff: 12 };
    const recOff = PG.normalise({ seed: 1, layers: { runways: [strip] } });
    const recOn = PG.normalise({ seed: 1, layers: { runways: [strip], terrain: [flat] } });
    const off = PG.compose(recOff, synth, { noPlace: true }), on = PG.compose(recOn, synth, { noPlace: true });
    const pat = FLIGHT_FNS.sitePattern(on.aerodromes[0], on.runways[0].site);
    const st = pat.nodes.find(nd => nd.id === 'stand');
    check(!!st && st.kind === 'stand' && pat.routes.out[0][0] === 'stand' && pat.routes.out[0][pat.routes.out[0].length - 1] === 'hold0' && pat.routes.out[0].indexOf('tx0') === 1, '10b the pattern starts at the stand, walks the taxi point, ends at hold0', pat.routes.out[0].join('>'));
    check(!!st && Math.abs(st.hdg - Math.atan2(70 - 90, 20 - 60)) < 1e-3, '10b the stand faces its first taxi point', st && st.hdg);
    const c0 = pat.nodes.find(nd => nd.id === 'c0');
    check(!!c0 && Math.abs(c0.z) < 1e-6, '10b the entry is on the centreline');
    check(Math.abs(on.aerodromes[0].spawn[0] - 60) < 1e-6 && Math.abs(on.aerodromes[0].spawn[1] - 90) < 1e-6, '10b the aeroplane is placed at the stand');
    const issOn = FLIGHT_FNS.sitePatternIssues(pat, on.aerodromes[0], on.runways[0].site, 0, FLIGHT_FNS.patternPath);
    check(issOn.length === 0, '10b on a flatten the route out is sound', issOn[0]);
    const patOff = FLIGHT_FNS.sitePattern(off.aerodromes[0], off.runways[0].site);
    const issOff = FLIGHT_FNS.sitePatternIssues(patOff, off.aerodromes[0], off.runways[0].site, 0, FLIGHT_FNS.patternPath);
    check(issOff.some(i => /leaves the flat ground/.test(i)), '10b off the flat the validator says so', issOff.join('; ') || 'no issue');
    const P1 = FLIGHT_FNS.patternPath(pat, pat.routes.out[1], 1.0);
    check(!!P1 && P1.pts.length > 2, '10b the route out in the other direction samples');
  }
  // 8d THE HARBOUR (v6): a harbour zone sows only the plots whose ground reaches the water, every one a
  // water plot; on a road nowhere near the water it sows none and says so
  {
    // a shore of its own: the ground climbs 10 % away from the water at z 0
    const shore = { id: 'shore', terrainH: (x, z) => 0.1 * z + 0.5 * Math.sin(x / 30), waterH: () => 0 };
    const zone = { id: 'h', kind: 'harbour', poly: [[-200, -60], [200, -60], [200, 200], [-200, 200]] };
    const near = PG.normalise({ seed: 7, layers: { roads: [{ id: 'r', pts: [[-190, 25], [190, 25]], w: 4, cls: 'gravel', graded: true }], zones: [zone] } });
    const O = PG.compose(near, shore, { catalogue: { entries: new Map(), aliases: {}, keys: () => [], byTag: () => [] } });
    check(O.records.plots.length > 0 && O.records.plots.every(p => p.side === 'water'), '8d a harbour zone sows water plots only', O.records.plots.length + ' plots, ' + O.records.plots.filter(p => p.side !== 'water').length + ' on land');
    const far = PG.normalise({ seed: 7, layers: { roads: [{ id: 'r', pts: [[-190, 150], [190, 150]], w: 4, cls: 'gravel', graded: true }], zones: [zone] } });
    const Of = PG.compose(far, shore, { catalogue: { entries: new Map(), aliases: {}, keys: () => [], byTag: () => [] } });
    check(Of.records.plots.length === 0 && Of.records.issues.some(i => /harbour h: no plot/.test(i)), '8d a harbour off the water sows nothing and says so', Of.records.plots.length + ' plots; ' + (Of.records.issues[0] || 'no issue'));
  }
  // 14 THE PARK'S DRESSING (v5): its footpath starts on the road's verge and ends at the lawn's front,
  // its rail fence rounds the plot with the gate on the front edge where the path comes in
  if (CAT.byTag && CAT.byTag('park').length && GENS.TOTEM_GEN && GENS.VILLAGE_GEN) {
    const road = { id: 'r', pts: [[-200, 0], [200, 0]], w: 4, cls: 'gravel', graded: true };
    const zone = { id: 'z', kind: 'park', poly: [[-210, -80], [210, -80], [210, 80], [-210, 80]], density: 1 };
    const rec = PG.normalise({ seed: 5, layers: { roads: [road], zones: [zone] } });
    const O = PG.compose(rec, synth, { catalogue: CAT, globals: GENS });
    const pk = O.records.parks[0];
    if (pk) {
      const a = pk.path.pts[0], b = pk.path.pts[pk.path.pts.length - 1];
      check(PG.roadDist({ pts: road.pts }, a[0], a[1]) < road.w / 2 + 1.0, '14 the park path starts on the road verge', PG.roadDist({ pts: road.pts }, a[0], a[1]).toFixed(1) + ' m from the centreline');
      check(PG.sdPoly(pk.plan.lawn, b[0], b[1]) < 1.5, '14 the park path ends at the lawn', PG.sdPoly(pk.plan.lawn, b[0], b[1]).toFixed(1) + ' m off');
      check(pk.fences.length === 4 && pk.fences.filter(f => f.gap).length === 1 && pk.fences.find(f => f.gap).kind === 'front', '14 the park fence rounds the plot with one gate on the front');
      const fr = pk.fences.find(f => f.gap), tg = [fr.b[0] - fr.a[0], fr.b[1] - fr.a[1]], L = Math.hypot(tg[0], tg[1]);
      const t = ((b[0] - fr.a[0]) * tg[0] + (b[1] - fr.a[1]) * tg[1]) / L;
      check(t > fr.gap[0] - 3 && t < fr.gap[1] + 3, '14 the gate is where the path comes in', t.toFixed(1) + ' vs ' + fr.gap.map(v => v.toFixed(1)).join('..'));
    } else check(false, '14 a park stood for the dressing check');
  }
  // 14 THE OBJECTS: a prop and a billboard compose on the ground in the premises frame, a keyless one is an issue
  {
    const rec = PG.normalise({ seed: 2, layers: { objects: [{ id: 'o1', kind: 'prop', key: 'x_thing', x: 10, z: 20, yaw: 0.5, dy: 0.2 }, { id: 'o2', kind: 'billboard', key: 'sign_x', x: -30, z: 5, yaw: 1, w: 4 }, { id: 'o3', kind: 'prop', key: '', x: 0, z: 0 }] } });
    const O = PG.compose(rec, synth, { catalogue: { entries: new Map(), aliases: {}, keys: () => [], byTag: () => [] } });
    const o1 = O.records.objects.find(q => q.id === 'o1'), o2 = O.records.objects.find(q => q.id === 'o2');
    check(!!o1 && Math.abs(o1.y - (O.localH(10, 20) + 0.2)) < 1e-6 && o1.on === 'ground', '14 a prop composes on the ground plus its lift');
    check(!!o2 && o2.w === 4 && Math.abs(o2.y - O.localH(-30, 5)) < 1e-6, '14 a billboard composes at its width on the ground');
    check(O.records.objects.length === 2 && O.records.issues.some(i => /o3: no key/.test(i)) && PG.issues(rec).some(i => /o3: no key/.test(i)), '14 a keyless object is an issue, not an object');
  }
  // 5 THE GROUND UNDER AN ITEM: an entry's ground block is honoured before placement -
  // a published shelf (the mill's law), a slab at the high corner, a median flatten
  {
    const foot = P => [[-6, -4], [6, -4], [6, 4], [-6, 4]];
    const mk = (key, ground) => [key, { key, kind: 'building', gen: 'X', preset: key, P: {}, frame: 'house', params: ov => Object.assign({ L: 12, w: 8, floorY: 0.3 }, ov || {}), foot, keepOut: 3, size: () => ({ L: 12, w: 8 }), ground, hooks: () => [], lod: { dist: [0, 150, 500, 1500] }, slots: {}, tags: [] }];
    const cat = { entries: new Map([
      mk('x/shelf', { need: 'flatten', shelf: () => ({ rect: [-10, -30, 10, 6], zLevel: 3, marginF: 5, marginB: 9 }) }),
      mk('x/slab', { need: 'level', level: 'high', falloff: 6 }),
      mk('x/lawn', { need: 'flatten', level: 'median', falloff: 6 }) ]), aliases: {}, keys: () => [] };
    const rec = PG.normalise({ seed: 1, layers: { sites: [{ id: 's', at: { x: 0, z: 0, yaw: 0.4 }, items: [
      { id: 'a', key: 'x/shelf', x: -80, z: 40, yaw: 0.3 }, { id: 'b', key: 'x/slab', x: 40, z: 40, yaw: -0.2 }, { id: 'c', key: 'x/lawn', x: 0, z: -60, yaw: 0 }] }] } });
    const O = PG.compose(rec, synth, { catalogue: cat });
    check(O.shelves.length === 3, '5 three shelves derived from the three ground blocks', String(O.shelves.length));
    for (const it of O.records.items) {
      const sh = O.shelves.find(q => q.id === it.id + ':ground');
      let worst = 0;
      const R = sh.rect;
      for (let i = 0; i <= 8; i++) for (let j = 0; j <= 8; j++) { const w = it.toWorld(R.x0 + (R.x1 - R.x0) * i / 8, R.z0 + (R.z1 - R.z0) * j / 8); worst = Math.max(worst, Math.abs(O.localH(w[0], w[1]) - sh.level)); }
      check(worst < 0.01, '5 item ' + it.item + ' (' + it.key + ') stands on its pad at the level', worst.toFixed(3) + ' m');
      if (it.key === 'x/slab') { let hi = -1e9; for (const q of foot()) { const w = it.toWorld(q[0], q[1]); hi = Math.max(hi, synth.terrainH(...O.frame.toWorld(w[0], w[1]))); } check(Math.abs(sh.level - hi) < 1e-6, '5 the slab is at the foot\'s high corner'); }
      if (it.key === 'x/shelf') { const ahead = it.toWorld(0, 3); const base = synth.terrainH(...O.frame.toWorld(ahead[0], ahead[1])); check(Math.abs(sh.level - base) < 1e-6, '5 the shelf is at the ground zLevel ahead'); }
      // the item's own ground reads the pad: its floor sits a hand over it, not over the old slope
      check(Math.abs(it.P.floorY) < 1.5, '5 item ' + it.item + ' floors over its pad, not the slope', it.P.floorY.toFixed(2));
    }
    // beyond the margins the base is untouched
    const far = O.frame.toWorld(200, 200);
    check(O.terrainAt(far[0], far[1]) === synth.terrainH(far[0], far[1]), '5 the base beyond the margins is untouched');
  }

  const cat = PG.collect({ HOUSE_GEN: { DEF: { L: 8, w: 6 }, PRESETS: { 'shore cabin': {}, 'village house': { L: 9 } } },
                           TOTEM_GEN: { CATALOGUE: [{ key: 'totem/park', kind: 'park', preset: 'park', foot: () => [[0, 0], [1, 0], [1, 1]], lod: { dist: [0, 150, 500, 1500] } }] } });
  check(cat.entries.size === 3 && cat.entries.get('house/shore cabin').derived === true && cat.entries.get('totem/park').kind === 'park', '3 collect() derives an entry per preset and takes an exported CATALOGUE');
  const dup = PG.collect({ HOUSE_GEN: { CATALOGUE: [{ key: 'a/b' }] }, BIG_GEN: { CATALOGUE: [{ key: 'a/b' }] } });
  check(dup.issues.length === 1, '3 a key collision is reported');
}

// 16 THE THEME AND THE LOOK (v9, contract v1.10): the record carries a theme the composer knows (an
// unknown one normalises to the default); every zone kind's draw names categories of the seven (or a
// tag); the picker draws a named preset of the category on a plot and never a generator the theme
// keeps for sites; every look proposes a class the registry has or none, and an unknown look is an issue
{
  const d = PG.DEF();
  check(PG.THEMES[d.theme] && d.theme === PG.THEME_DEF, '16 the default record carries the default theme (' + PG.THEME_DEF + ')');
  check(PG.normalise({ theme: 'mars' }).theme === PG.THEME_DEF, '16 an unknown theme normalises to the default');
  for (const k in PG.THEMES) {
    const T = PG.THEMES[k];
    check(Array.isArray(T.categories) && T.categories.every(c => PG.CATEGORIES.indexOf(c) >= 0), '16 theme ' + k + ': its categories are of the seven');
    for (const z of PG.ZONE_KINDS) { if (z === 'forest' || z === 'clear') continue; const r = T.plots[z]; check(!!r && (r.tag || (Array.isArray(r.cats) && r.cats.length && r.cats.every(c => PG.CATEGORIES.indexOf(c) >= 0))), '16 theme ' + k + ': ' + z + ' zones draw by categories or a tag'); }
  }
  // the picker under a catalogue that carries the categories: a commercial plot gets a commercial entry
  // of the house generator (never the big one, which the theme keeps for sites), a residential plot a
  // residential preset or the sampler, a zone's own list overrides
  const cat = PG.collect({ HOUSE_GEN: { CATALOGUE: [{ key: 'h/a', kind: 'building', gen: 'HOUSE_GEN', cat: 'commercial', tags: ['house'] }, { key: 'h/b', kind: 'building', gen: 'HOUSE_GEN', cat: 'residential', tags: ['house'] }, { key: 'h/c', kind: 'building', gen: 'HOUSE_GEN', cat: 'official', tags: ['house'] }] },
                           BIG_GEN: { CATALOGUE: [{ key: 'b/a', kind: 'building', gen: 'BIG_GEN', cat: 'commercial', tags: ['big'] }] } });
  const rnd = PG.mulberry32(7);
  const picks = new Set(); for (let i = 0; i < 40; i++) picks.add(PG.pickFor({ kind: 'commercial' }, cat, rnd, PG.THEMES.alaska, null));
  check(picks.size === 1 && picks.has('h/a'), '16 a commercial plot draws the commercial entry of the house generator, never the big one', Array.from(picks).join(','));
  const res = new Set(); for (let i = 0; i < 60; i++) res.add(PG.pickFor({ kind: 'residential' }, cat, rnd, PG.THEMES.alaska, null));
  check(res.has('sampler') && res.has('h/b') && res.size === 2, '16 a residential plot draws the sampler or a residential preset', Array.from(res).join(','));
  const own = new Set(); for (let i = 0; i < 20; i++) own.add(PG.pickFor({ kind: 'residential' }, cat, rnd, PG.THEMES.alaska, { rules: { cats: ['official'] } }));
  check(own.size === 1 && own.has('h/c'), '16 a zone\'s own categories override the theme\'s', Array.from(own).join(','));
  check(cat.byCat('commercial').length === 2 && cat.byCat('sports').length === 0, '16 the catalogue answers byCat');
  // the derived entries carry catOf
  const der = PG.collect({ SHED_GEN: { PRESETS: { 'lean-to': {} }, DEF: {}, catOf: () => 'shed' } });
  check(der.entries.get('shed/lean-to').cat === 'shed' && der.byCat('shed').length === 1, '16 a derived entry carries its generator\'s category');
  // the looks
  for (const k in PG.RUNWAY_LOOKS) { const L = PG.RUNWAY_LOOKS[k]; check(typeof L.name === 'string' && (L.surface === null || PG.SURFACE_NAMES[L.surface] !== undefined), '16 look ' + k + ' names a class the registry has, or none'); }
  check(PG.RUNWAY_LOOKS.none.surface === null && PG.RUNWAY_LOOKS.none.set === null, '16 the markings-only look proposes no class and no set');
  check(Object.keys(PG.RUNWAY_LOOKS).filter(k => PG.RUNWAY_LOOKS[k].set).length >= 3, '16 at least three looks wear a PBR set');
  const rw = PG.normalise(PG.DEF()); rw.layers.runways.push({ id: 'w1', c: [0, 0], hdg: 0, len: 400, wid: 20, look: 'velvet' });
  check(PG.issues(rw).some(t => /unknown look/.test(t)), '16 an unknown look is an issue');
  rw.layers.runways[0].look = 'asphalt';
  check(!PG.issues(rw).some(t => /look/.test(t)), '16 a known look is not');
  const O = PG.compose(rw, synth);
  check(O.aerodromes.length === 1 && O.aerodromes[0].look === 'asphalt' && O.aerodromes[0].surface === PG.SURFACE.GRASS, '16 the aerodrome record carries the look; the class stays the record\'s own');
}

// 13 the contract held: no catalogue key literal in the editor's files
{
  const files = fs.readdirSync(TOOLS).filter(f => /^_premises.*\.(js|html)$/.test(f) && f !== '_premises_check.js').map(f => path.join(TOOLS, f))
    .concat([path.join(TOOLS, '..', 'src', 'core', '27_premises.js'), path.join(TOOLS, '..', 'src', 'viewer', 'render_premises.js'), path.join(TOOLS, '..', 'src', 'viewer', 'premises_ui.js')].filter(f => fs.existsSync(f)));
  const re = /['"](house|big|shed|tram|totem|factory)\/[a-z]/;
  for (const f of files) {
    const src = fs.readFileSync(f, 'utf8');
    check(!re.test(src), '13 no catalogue key literal in ' + path.basename(f));
  }
}

// ---------------------------------------------------------------------------
if (SELFTEST) {
  const neg = [];
  const rec = PG.unwrap(fs.readFileSync(path.join(TOOLS, 'fixtures', fixtures[0]), 'utf8')).rec;
  // a crossed polygon must be refused
  const bad = JSON.parse(JSON.stringify(rec));
  bad.layers.terrain[0].poly = [[0, 0], [10, 10], [10, 0], [0, 10]];
  neg.push([PG.issues(bad).length > 0, 'a crossed polygon is refused']);
  // a forged envelope must be refused
  let refused = false; try { PG.unwrap('{"what":"flydiy-premises","v":1}'); } catch (e) { refused = true; }
  neg.push([refused, 'an envelope without a record is refused']);
  // a moved level must change the heights (the determinism rule sees the change)
  const O1 = PG.compose(rec, synth);
  const mv = JSON.parse(JSON.stringify(rec)); mv.layers.terrain[0].level += 1;
  const O2 = PG.compose(mv, synth);
  const c = PG.polyBBox(rec.layers.terrain[0].poly);
  const w = O1.frame.toWorld((c.x0 + c.x1) / 2, (c.z0 + c.z1) / 2);
  neg.push([Math.abs(O1.terrainAt(w[0], w[1]) - O2.terrainAt(w[0], w[1])) > 0.9, 'a moved level moves the ground']);
  // a flatten with a zero falloff is an issue (a step)
  const st = JSON.parse(JSON.stringify(rec)); st.layers.terrain[0].falloff = 0;
  neg.push([PG.issues(st).length > 0, 'a zero falloff is refused']);
  for (const [ok, what] of neg) check(ok, 'selftest: ' + what);
}

// ---------------------------------------------------------------------------
// 14  THE ISLAND'S OWN PREMISES (2026-09-22): the field AND Metlakatla, composed
//     on Jolene itself with the full catalogue. Every other section composes a
//     premises_v1_* fixture on a synthetic world; nothing held the record the
//     GAME actually boots, and nothing at all held the harbour kit, whose whole
//     point is to stand over water where no other entry may.
//     bench/ is the developer's machine: absent, the section says so and skips.
{
  let IW = null;
  try { IW = require(path.join(TOOLS, 'island_node.js')).islandWorld('jolene', {}); } catch (e) { IW = null; }
  if (!IW) {
    console.log('  14 the island premises: bench/jolene absent, skipped');
  } else {
    const txt = fs.readFileSync(path.join(TOOLS, 'fixtures', 'island_jolene.json'), 'utf8');
    const rec = PG.unwrap(txt).rec;
    check(PG.issues(rec).length === 0, '14a island_jolene has no issues', PG.issues(rec).slice(0, 4).join(' / '));
    const O = PG.compose(rec, IW, { catalogue: CAT, globals: GENS });
    // every site item names an entry the catalogue has
    const miss = [];
    for (const st of rec.layers.sites) for (const it of (st.items || [])) if (!CAT.entries.get(CAT.aliases[it.key] || it.key)) miss.push(it.key);
    check(miss.length === 0, '14b every site item resolves from the catalogue', [...new Set(miss)].join(', '));
    check(O.records.items.length >= rec.layers.sites.length, '14c every site placed an item',
          O.records.items.length + ' of ' + rec.layers.sites.length + ' sites');
    // a marine item stands OVER THE WATER and its deck is above it; and it cuts no ground
    const marine = O.records.items.filter(r => r.entry && r.entry.gen === 'MARINE_GEN');
    check(marine.length >= 10, '14d the harbour kit is placed', marine.length + ' marine items');
    // THE SEA IS AT ZERO, and `world.waterH` is not the test: it answers with the
    // level of the water body that TOUCHES a point, which inland is -Infinity and
    // beside a lake is the lake's - it read 13 m over Airport Road. The island's
    // sea level is 0 (20_world.js ~:520), so that is what "over the water" means.
    // A pier is allowed to START on the beach; what must be wet is its FAR END.
    const dry = [];
    for (const r of marine) {
      if (String(r.key).indexOf('breakwater') >= 0) continue;   // a mole IS raised ground
      const L = (r.size && r.size.L) || 0;
      const far = r.toWorld(L / 2 - 2, 0);
      if (!(O.terrainAt(far[0], far[1]) <= 0.05)) dry.push(r.key + ' @' + far.map(v => v.toFixed(0)));
    }
    check(dry.length === 0, '14e a pier, a float and a wharf reaches the water', dry.slice(0, 5).join(', '));
    check(rec.layers.terrain.every(t => !/^mk_/.test(t.id) || t.abs === true),
          "14f the town's terrain is absolute — a level read off the DEM is not relative to an anchor");
    // the road network is dry, end to end
    const wetRoad = [];
    for (const r of rec.layers.roads) {
      if (!/^mk_/.test(r.id)) continue;
      for (let i = 0; i + 1 < r.pts.length; i++) {
        const a = r.pts[i], b = r.pts[i + 1];
        const n = Math.max(2, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 20));
        for (let k = 0; k <= n; k++) {
          const x = a[0] + (b[0] - a[0]) * k / n, z = a[1] + (b[1] - a[1]) * k / n;
          if (O.terrainAt(x, z) <= 0.15) { wetRoad.push(r.id); break; }     // sea level is 0
        }
      }
    }
    check(wetRoad.length === 0, "14g no street of the town runs through the water", [...new Set(wetRoad)].slice(0, 5).join(', '));
    // the ttype stamp: it lands, and it puts the old bytes back
    if (IW.ttype) {
      const before = IW.ttype.slice(0, 0);   // (a copy of the whole grid would be 12 MB; count instead)
      const count = c => { let n = 0; for (let k = 0; k < IW.ttype.length; k++) if (IW.ttype[k] === c) n++; return n; };
      const l0 = count(15), undo = O.stampTtype(IW), l1 = count(15);
      check(l1 > l0 && l1 > 1000, '14h the ttype layer stamps its terrain type', l0 + ' -> ' + l1 + ' cells');
      undo();
      check(count(15) === l0, '14i and the stamp is exactly undone', count(15) + ' left of ' + l0);
      void before;
    }
    // `smooth` is a no-op when it is absent, and rounds when it is there
    const straight = [[0, 0], [100, 0], [100, 100]];
    check(PG.smoothPath(straight, 0) === straight, '14j smooth: absent is a no-op');
    const sm = PG.smoothPath(straight, 25);
    check(sm.length > straight.length && Math.abs(sm[0][0]) < 1e-9 && Math.abs(sm[sm.length - 1][1] - 100) < 1e-9,
          '14k smooth: the corner rounds and the ends hold');
    // the seaplane base is an aerodrome of the world
    check(O.aerodromes.some(a => a.id === 'mk_sea' && a.kind === 'water'), '14l Metlakatla has its own sea lane');
    // 14m EVERY PLACED ITEM ACTUALLY BUILDS, and publishes what the renderer reads.
    // render_premises.js placeBuilt iterates `stats.lit.lights`; MARINE_GEN handed
    // it a NUMBER, the loop threw inside the renderer's own try, and all 26 harbour
    // items silently vanished from the game while the record said they were placed.
    const broke = [];
    for (const r of O.records.items) {
      const G = GENS[r.gen];
      if (!G || !G.build) { broke.push(r.key + ': no generator'); continue; }
      let b = null;
      try { b = G.build(r.P, 0, null); } catch (e) { broke.push(r.key + ': ' + e.message); continue; }
      const st = b && b.stats;
      if (!st || !(st.tris > 0)) broke.push(r.key + ': no triangles');
      else if (st.lit && !Array.isArray(st.lit.lights)) broke.push(r.key + ': stats.lit.lights is not a list');
      else if (st.nan) broke.push(r.key + ': ' + st.nan + ' NaN vertices');
    }
    check(broke.length === 0, '14m every placed item builds and publishes a lamp LIST', [...new Set(broke)].slice(0, 5).join(' / '));
    // 14n NOTHING THAT STANDS IN THE WATER TAKES LOT DRESSING. render_premises
    // dresses a hand-placed item like a plot - lot ground, a drive, a car and a
    // FENCE - for every category but sports and landmark, and the user found a
    // fence round a pier. An entry refuses with `lot: false`; the renderer must
    // honour it, and must also refuse one to anything standing on a DECK, whose
    // lot would be laid on the seabed under it.
    const noLot = (GENS.MARINE_GEN && GENS.MARINE_GEN.CATALOGUE || []).filter(e => e.lot !== false);
    check(noLot.length === 0, '14n every marine entry refuses a lot', noLot.map(e => e.key).join(', '));
    const RP = fs.readFileSync(path.join(TOOLS, '..', 'src', 'viewer', 'render_premises.js'), 'utf8');
    check(/entry\.lot === false/.test(RP) && /isFinite\(it\.P\.floorOverWater\)/.test(RP),
          '14n the renderer honours lot:false and refuses a lot over water');
    // 14o THE ttype STAMP'S `from` FILTER, and the undo under OVERLAP. Two stamps
    // may cover one cell, and the second one saved what the FIRST had written:
    // unwound forwards the cell keeps the first stamp's code for ever.
    if (IW.island && IW.island.ttype) {
      const g = IW.island.grid, T = IW.island.ttype;
      const at = (x, z) => T[Math.round((z - g.z0) / g.cell - 0.5) * g.w + Math.round((x - g.x0) / g.cell - 0.5)];
      const box = (cx, cz, r) => [[cx - r, cz - r], [cx + r, cz - r], [cx + r, cz + r], [cx - r, cz + r]];
      const two = PG.normalise(JSON.parse(JSON.stringify(rec)));
      const C = [-3500, -8450];
      two.layers.ttype = [{ id: 'kA', poly: box(C[0], C[1], 120), code: 8, from: [7] },
                          { id: 'kB', poly: box(C[0], C[1], 120), code: 15 }];
      const was = [];
      for (let z = C[1] - 110; z < C[1] + 110; z += 10) for (let x = C[0] - 110; x < C[0] + 110; x += 10) was.push(at(x, z));
      const O2 = PG.compose(two, IW, { catalogue: CAT, globals: GENS });
      const un = O2.stampTtype(IW.island);
      let only7 = true, all15 = true, i = 0;
      for (let z = C[1] - 110; z < C[1] + 110; z += 10) for (let x = C[0] - 110; x < C[0] + 110; x += 10) {
        const now = at(x, z), old = was[i++];
        if (old >= 2 && now !== 15) all15 = false;                       // the unfiltered stamp takes every land cell
        if (old < 2 && now !== old) only7 = false;                       // and neither stamp touches the water
      }
      check(all15 && only7, '14o a ttype stamp takes the land it covers and leaves the water');
      if (un) un();
      let back = true; i = 0;
      for (let z = C[1] - 110; z < C[1] + 110; z += 10) for (let x = C[0] - 110; x < C[0] + 110; x += 10) if (at(x, z) !== was[i++]) back = false;
      check(back, '14o two OVERLAPPING stamps undo exactly (the unwind runs backwards)');
      const one = PG.normalise(JSON.parse(JSON.stringify(rec)));
      one.layers.ttype = [{ id: 'kA', poly: box(C[0], C[1], 120), code: 8, from: [7] }];
      const O3 = PG.compose(one, IW, { catalogue: CAT, globals: GENS });
      const u3 = O3.stampTtype(IW.island);
      let kept = true; i = 0;
      for (let z = C[1] - 110; z < C[1] + 110; z += 10) for (let x = C[0] - 110; x < C[0] + 110; x += 10) {
        const old = was[i++], now = at(x, z);
        if (old === 7 ? now !== 8 : now !== old) kept = false;
      }
      check(kept, "14o `from` replaces only the codes it names");
      if (u3) u3();
    }
    // 14p THE TOWN'S TREES, and the two things that must hold about them.
    // The user's rule is "never any tree as fixture without its lod system, we take
    // the normal ones, maybe alter the terrain type, let the game do the work". The
    // PAINTED route is built (14p below) and cannot be delivered at a settlement -
    // the island's fill had 13 465 trees built with 55 576 chunks still queued after
    // 61 s, so the town's own chunks never come up - so Metlakatla PLACES its
    // conifers through planForest, which steps round every plot, road, site and
    // exclude by construction. What must hold is that they are drawn at all, and
    // that they are not drawn for ever.
    const mkTrees = O.records.trees.filter(t => /^mk_/.test(String(t.zone || '')));
    check(mkTrees.length > 500, '14p the town has its wood', mkTrees.length + ' trees in mk_ zones');
    const RP2 = fs.readFileSync(path.join(TOOLS, '..', 'src', 'viewer', 'render_premises.js'), 'utf8');
    // THE REGRESSION THIS EXISTS FOR: rebuild()'s GAME branch takes an early return,
    // and buildTrees() sat below it in the bench path only - so no premises record
    // tree had EVER been drawn in the game, silently, because until now no record
    // carried one. Both the call and the cull must survive a rebase.
    const gameBranch = RP2.slice(RP2.indexOf('if (o.game) {'), RP2.indexOf('if (!dirty || !dirty.bbox) {'));
    check(gameBranch.length > 200 && /buildTrees\(\);/.test(gameBranch),
          "14p buildTrees() is called in rebuild()'s GAME branch, not only the bench's");
    check(/addLevel\(new THREE\.Group\(\), TREE_GONE\)/.test(RP2) && /const TREE_GONE = \d+/.test(RP2),
          '14p a record tree has a cull level (the ladder ended at 132 m and drew at any distance)');
    check(/CV\[k\] = c\.cover/.test(fs.readFileSync(path.join(TOOLS, '..', 'src', 'core', '27_premises.js'), 'utf8')),
          '14p the cover stamp exists (the piece that lets a painted biome plant over a town)');
    const paints = rec.layers.ttype.some(c => isFinite(+c.cover));
    if (paints && IW.island && IW.island.cover) {
      const surf = () => { const c = {}; for (let z = -9100; z < -8200; z += 15) for (let x = -4200; x < -2900; x += 15) { const s2 = IW.surface(x, z); c[s2] = (c[s2] || 0) + 1; } return c; };
      const b4 = surf();
      const un2 = O.stampTtype(IW.island);
      const af = surf();
      check((af[PG.SURFACE.PAVED] || 0) < (b4[PG.SURFACE.PAVED] || 0),
            '14p the paint lifts the cover the fill refuses',
            (b4[PG.SURFACE.PAVED] || 0) + ' -> ' + (af[PG.SURFACE.PAVED] || 0) + ' paved samples');
      check((af[PG.SURFACE.FOREST_FLOOR] || 0) === (b4[PG.SURFACE.FOREST_FLOOR] || 0),
            "14p ...and does not take the island's own forest floor with it",
            (b4[PG.SURFACE.FOREST_FLOOR] || 0) + ' -> ' + (af[PG.SURFACE.FOREST_FLOOR] || 0));
      if (un2) un2();
      const bk = surf();
      check(Object.keys(b4).every(k => b4[k] === bk[k]), '14p the cover stamp is exactly undone');
    }
  }
}

// ---------------------------------------------------------------------------
if (fail.length) {
  for (const f of fail.slice(0, 30)) console.log('  ! ' + f);
  console.log('GATE PREMISES: FAIL (' + fail.length + ')');
  process.exit(1);
}
console.log('  ' + checks + ' checks on ' + fixtures.length + ' fixture(s)' + (FLIGHT ? ', the flight world loaded' : ', flight world absent'));
console.log('GATE PREMISES: PASS');

// ---------------------------------------------------------------------------
// the screenshot sink: the bench renders to a target and POSTs a PNG here,
// because the Browser pane's on-screen canvas is 0 x 0 while hidden
function sink(port) {
  const http = require('http');
  const dir = path.join(TOOLS, '..', 'screenshots', 'premises');
  fs.mkdirSync(dir, { recursive: true });
  http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', '*');
    if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
    const u = new URL(req.url, 'http://x');
    if (req.method !== 'POST' || u.pathname !== '/save') { res.writeHead(404); res.end(); return; }
    const name = (u.searchParams.get('name') || 'shot').replace(/[^a-z0-9_\-]/gi, '_');
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', () => {
      const fp = path.join(dir, name + '.png');
      fs.writeFileSync(fp, Buffer.concat(chunks));
      console.log('saved', fp, fs.statSync(fp).size, 'bytes');
      res.writeHead(200, { 'Content-Type': 'text/plain' }); res.end('ok');
    });
  }).listen(port, () => console.log('premises sink on http://localhost:' + port + '/save?name=<x> -> ' + dir));
}
