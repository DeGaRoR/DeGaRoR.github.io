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
  const rec = PG.expandAreas(U.rec);   // (v1.36, G2910: the v1 view of the migrated record - row 20 holds that it composes as the record does)
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

// 17 THE STAGES (v1.33, G2300 STAGES): an entry, a site's item or a zone may carry `stage: { track, show, vary }` and
// stands only while the career's track lies in its band. On a record of its own (no catalogue key: rule 13) on synth:
// (a) a record with no stage composes untouched; (b) the sandbox (no tracks: every track at its max) stands what has no
// upper bound, the `stage` taken off - the record a stageless author would have written, key for key; (c) below its band
// an entry is cut, inside it it stands; a vary changes a runway's length while it holds; a `sock: false` reaches the
// aerodrome; (d) a ZONE below its band still sows (a later zone keeps its plots) and builds nothing; (e) a kit expands
// into its props (and its tree exclude) only while it stands; (f) the envelope round-trips the stages; stageRestore puts a
// staged edit back into the whole record; (g) issues() refuses a bad band, a vary outside its band, a kit with no stage
{
  const base = { v: 1, id: 'stg', seed: 4, frame: { kind: 'free', extent: null, anchors: { '*': { x: 0, z: 0, yaw: 0 } } },
    layers: { terrain: [], surface: [], material: [], exclude: [], ttype: [], links: [], sites: [],
      roads: [{ id: 'r1', pts: [[-200, 0], [200, 0]], w: 6, cls: 'gravel' }],
      zones: [{ id: 'z_a', kind: 'residential', poly: [[-150, -50], [0, -50], [0, 60], [-150, 60]], density: 1 }, { id: 'z_b', kind: 'residential', poly: [[-150, -50], [150, -50], [150, 60], [-150, 60]], density: 1 }],
      runways: [{ id: 'w1', c: [0, -200], hdg: 0, len: 600, wid: 20, surface: 0 }],
      objects: [{ id: 'p1', kind: 'prop', key: 'drum', x: 10, z: -40, yaw: 0 }] } };
  const plain = PG.normalise(JSON.parse(JSON.stringify(base)));
  const Op = PG.compose(plain, synth);
  check(Op.stage === null && !PG.stageView(plain, null).staged, '17a a record with no stage composes untouched');
  const st = JSON.parse(JSON.stringify(base));
  st.layers.objects[0].stage = { track: 'tk', show: [2, null] };
  st.layers.objects.push({ id: 'k1', kind: 'kit', kit: 'plot', x: -60, z: -60, yaw: 0.3, w: 20, d: 14, stage: { track: 'tk', show: [1, 1] } });
  st.layers.runways[0].stage = { track: 'tk', show: [0, null], vary: [{ show: [0, 1], len: 400, sock: false }] };
  st.layers.zones[0].stage = { track: 'tk', show: [2, null] };
  const S = PG.normalise(st);
  const Vs = PG.stageView(S, null);
  check(JSON.stringify(PG.normalise(Vs.rec)) === JSON.stringify(plain), '17b the sandbox stands what has no upper bound, the stage taken off: the stageless record, key for key');
  const Os = PG.compose(S, synth);
  check(JSON.stringify(Os.rec) === JSON.stringify(Op.rec) && Os.terrainAt(0, -200) === Op.terrainAt(0, -200) && Os.records.plots.length === Op.records.plots.length, '17b the sandbox composes as the stageless record (the record, the ground, the plots)');
  const O1 = PG.compose(S, synth, { tracks: { tk: 1 } }), O0 = PG.compose(S, synth, { tracks: { tk: 0 } });
  const has = (O, id) => O.rec.layers.objects.some(o => o.id === id);
  check(!has(O1, 'p1') && has(PG.compose(S, synth, { tracks: { tk: 2 } }), 'p1'), '17c below its band an entry is cut; inside it, it stands');
  check(O1.aerodromes[0].len === 400 && O1.aerodromes[0].sock === false && Op.aerodromes[0].len === 600 && Op.aerodromes[0].sock === undefined, '17c a vary changes the strip while it holds (len 400, no windsock); the sandbox\'s strip is the record\'s');
  const zb = O => JSON.stringify(O.records.plots.filter(p => p.zone === 'z_b').map(p => p.poly));
  check(O1.records.plots.every(p => p.zone !== 'z_a') && zb(O1) === zb(Op) && O1.excludeAt(...O1.frame.toWorld(...PG.polyCentroid(Op.records.plots.find(p => p.zone === 'z_a').poly)), 'trees'), '17d a zone below its band sows (the next zone keeps its plots), builds nothing, and its ground keeps the trees off');
  const kitN = O => O.rec.layers.objects.filter(o => /^k1:/.test(o.id)).length;
  check(kitN(O1) >= 8 && kitN(O0) === 0 && kitN(Op) === 0 && O1.rec.layers.exclude.some(e => e.id === 'k1:clear'), '17e a kit expands into its fence and props (and its clearance) only while it stands', kitN(O1) + ' objects at 1');
  check(JSON.stringify(PG.unwrap(PG.envelope(null, S)).rec) === JSON.stringify(S), '17f the envelope round-trips the stages');
  const V1 = PG.stageView(S, { tk: 1 });
  check(JSON.stringify(PG.normalise(PG.stageRestore(JSON.parse(JSON.stringify(V1.rec)), V1))) === JSON.stringify(S), '17f stageRestore puts a staged edit back into the whole record');
  const badBand = JSON.parse(JSON.stringify(st)); badBand.layers.objects[0].stage.show = [3, 1];
  const badVary = JSON.parse(JSON.stringify(st)); badVary.layers.runways[0].stage.vary[0].show = [5, 6]; badVary.layers.runways[0].stage.show = [0, 3];
  const badKit = JSON.parse(JSON.stringify(st)); delete badKit.layers.objects[1].stage;
  check(PG.issues(S).length === 0 && PG.issues(badBand).length > 0 && PG.issues(badVary).length > 0 && PG.issues(badKit).length > 0, '17g issues() takes the stages and refuses a bad band, a vary outside its band, a kit with no stage');
  check(PG.stageIssues(S, { tk: 2 }).length === 0 && PG.stageIssues(S, { tk: 1 }).length > 0, '17g the sandbox\'s law: a band through the track\'s max must be open');
}

// 19 THE SCENERY EDITOR'S UNBLOCKERS (G2890 SCENERY-ED-1, contract v1.35): the smooth road, the round pad, the plots'
//    ground, the trees' exclusion regions (their regrowth on a delete), the shape's edits through the store.
{
  const turnAndK = c => {
    let mx = 0; const ks = [];
    for (let i = 1; i < c.length - 1; i++) {
      const a = Math.atan2(c[i][1] - c[i - 1][1], c[i][0] - c[i - 1][0]), b = Math.atan2(c[i + 1][1] - c[i][1], c[i + 1][0] - c[i][0]);
      let d = b - a; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
      mx = Math.max(mx, Math.abs(d));
      ks.push(d / ((Math.hypot(c[i][0] - c[i - 1][0], c[i][1] - c[i - 1][1]) + Math.hypot(c[i + 1][0] - c[i][0], c[i + 1][1] - c[i][1])) / 2));
    }
    return { maxTurn: mx * 180 / Math.PI, ks };
  };
  // 19a a test road on a CLOTHOID (curvature rising linearly over 400 m), a point every 80 m: the spline passes through
  //     every point, never turns 2.5 degrees at a sample (no kink - polyRoad's fillet leaves it alone), bends one way, and
  //     its curvature rises monotonically (a step back under 1 % of the peak; the run-out under 10 %)
  const A2 = 400 * 250; let x = 0, z = 0, th = 0; const clo = [[0, 0]];
  for (let s = 1; s <= 400; s++) { th += s / A2; x += Math.cos(th); z += Math.sin(th); if (s % 80 === 0) clo.push([x, z]); }
  const cc = PG.roadCurve(clo), cs = turnAndK(cc);
  check(clo.every(p => cc.some(q => Math.hypot(q[0] - p[0], q[1] - p[1]) < 1e-6)), '19a the spline road passes through every point');
  check(cs.maxTurn < 2.5, '19a no kink on the clothoid road (the largest turn at a sample)', cs.maxTurn.toFixed(2) + ' deg');
  const kMax = Math.max(...cs.ks);
  let worstBack = 0; for (let i = 1; i < cs.ks.length; i++) worstBack = Math.max(worstBack, cs.ks[i - 1] - cs.ks[i]);
  check(cs.ks.every(k => k > 0) && worstBack < 0.01 * kMax && cs.ks[cs.ks.length - 1] > 0.9 * kMax, '19a the clothoid road\'s curvature is monotone', 'worst step back ' + (worstBack / kMax * 100).toFixed(2) + ' %, end ' + (cs.ks[cs.ks.length - 1] / kMax * 100).toFixed(1) + ' % of the peak');
  check(PG.polyRoad(cc, 4).pts.length === cc.length, '19a the fillet leaves the spline\'s line as it is');
  // ...on five points of a 300 m arc: the curvature within 8 % of the circle's everywhere
  const arc = []; for (let k = 0; k <= 5; k++) { const a = k / 5 * Math.PI / 2; arc.push([300 * Math.sin(a), 300 - 300 * Math.cos(a)]); }
  const as = turnAndK(PG.roadCurve(arc));
  check(as.ks.every(k => Math.abs(k * 300 - 1) < 0.08), '19a a 300 m arc of five points is drawn as the arc', 'radius ' + (1 / Math.max(...as.ks)).toFixed(0) + '..' + (1 / Math.min(...as.ks)).toFixed(0) + ' m');
  // LONG CURVES (the user: "it cannot do long curves"): three points, 400 m legs, a 60 degree turn - the fillet bends a 4 m
  // road at under 15 m, the spline over 150 m
  const bend = [[0, 0], [400, 0], [600, 346.4]];
  const rSp = 1 / Math.max(...turnAndK(PG.roadCurve(bend)).ks), rFi = 1 / Math.max(...turnAndK(PG.polyRoad(bend, 4).pts).ks);
  check(rSp > 150 && rFi < 15, '19a a long bend from three clicks (the tightest radius: spline vs the corner fillet)', rSp.toFixed(0) + ' m vs ' + rFi.toFixed(1) + ' m');
  // a HANDLE: the curve leaves its point along it, and the road still passes through the point
  const hc = PG.roadCurve([[0, 0], [100, 0], [200, 0]], [null, [20, 20], null]);
  const i1 = hc.findIndex(q => Math.hypot(q[0] - 100, q[1]) < 1e-6), d1 = i1 >= 0 && hc[i1 + 1] ? [hc[i1 + 1][0] - 100, hc[i1 + 1][1]] : [0, 0];
  check(i1 > 0 && (d1[0] + d1[1]) / (Math.SQRT2 * Math.hypot(d1[0], d1[1])) > 0.999, '19a a point\'s handle turns the road there (it leaves the point along the handle)');
  check(JSON.stringify(PG.roadHandles([[0, 0], [100, 0], [200, 0]], [null, [20, 20], null])[1]) === '[20,20]', '19a roadHandles answers a handle set by hand as it is');
  // a record WITHOUT `curve` composes its roads exactly as before (the points the fillet reads); with it, on the curve
  const rdRec = PG.normalise({ layers: { roads: [{ id: 'r1', pts: bend, w: 4, cls: 'gravel', graded: true, falloff: 6 }] } });
  const O0 = PG.compose(rdRec, synth);
  check(JSON.stringify(O0.roads[0].pts) === JSON.stringify(bend), '19a a road without a curve composes on its points, to the bit');
  const rdSp = JSON.parse(JSON.stringify(rdRec)); rdSp.layers.roads[0].curve = 'spline';
  const O1 = PG.compose(rdSp, synth), mid = PG.roadCurve(bend)[Math.floor(PG.roadCurve(bend).length / 2)];
  const wMid = O1.frame.toWorld(mid[0], mid[1]);
  check(O1.roads[0].pts.length > 20 && O1.surfaceAt(wMid[0], wMid[1]) === PG.SURFACE.GRAVEL, '19a a spline road composes on its curve (its class answers on the curve)');
  // 19b A ROUND PAD: normalise writes its polygon from its circle (counter-clockwise, every corner on the circle); the wheels
  //     feel its look's class inside, the island's outside; the paved polygon draws it; the round trip keeps it
  const padRec = PG.normalise({ layers: { material: [{ id: 'm1', round: { c: [30, -20], r: 18 }, look: 'concrete', set: 'cracked', fade: 0, z: 0, poly: [[0, 0], [1, 0], [0, 1]] }] } });
  const pp = padRec.layers.material[0].poly;
  check(pp.length === 48 && PG.polyCCW(pp) && pp.every(q => Math.abs(Math.hypot(q[0] - 30, q[1] + 20) - 18) < 0.002), '19b a round pad\'s polygon is its circle (48 corners, counter-clockwise)');
  const Op = PG.compose(padRec, synth), wc = Op.frame.toWorld(30, -20), wo = Op.frame.toWorld(30, 10);
  check(Op.surfaceAt(wc[0], wc[1]) === PG.SURFACE.PAVED && Op.surfaceAt(wo[0], wo[1]) === -1, '19b the wheels feel a concrete pad inside it, nothing outside');
  check((Op.pavePolys || []).some(q => q.id === 'm1'), '19b the pavement draws the pad');
  const padRT = PG.unwrap(PG.envelope('pad', padRec)).rec;
  check(JSON.stringify(padRT.layers.material[0]) === JSON.stringify(padRec.layers.material[0]), '19b a round pad round-trips through the store');
  // 19c THE PLOTS' GROUND: a residential zone on a road - `rules.ground: false` takes every plot's ground off, `noGround`
  //     one plot's; a plot whose ground is off mows no lawn (coverAt answers the island's there)
  const zRec = PG.normalise({ seed: 3, layers: { roads: [{ id: 'r1', pts: [[-150, 0], [150, 0]], w: 5, cls: 'gravel', graded: true, falloff: 6 }],
    zones: [{ id: 'z1', kind: 'residential', poly: [[-140, -40], [140, -40], [140, 40], [-140, 40]], density: 1, seed: 5, palette: null, rules: {} }] } });
  const plotsOf = r => PG.compose(r, synth, { catalogue: CAT }).records.plots;
  const P0 = plotsOf(zRec);
  check(P0.length >= 4 && P0.every(p => !p.noGround), '19c a zone sows its plots with their ground on by default', P0.length + ' plots');
  const zOff = JSON.parse(JSON.stringify(zRec)); zOff.layers.zones[0].rules.ground = false;
  const P1 = plotsOf(zOff);
  check(P1.length === P0.length && P1.every(p => p.noGround), '19c rules.ground false: every plot\'s ground off, the same plots');
  if (P0.length) {
    const z1 = JSON.parse(JSON.stringify(zRec)); z1.layers.zones[0].rules.noGround = [P0[0].id];
    const O2 = PG.compose(z1, synth, { catalogue: CAT }), P2 = O2.records.plots;
    check(P2.filter(p => p.noGround).length === 1 && P2.find(p => p.id === P0[0].id).noGround, '19c rules.noGround: that plot alone');
    const lawnAt = (O, p) => { const c = PG.polyCentroid(p.poly), w = O.frame.toWorld(c[0], c[1]), q = O.coverAt(w[0], w[1]); return q ? q.kind : null; };
    const pOn = P2.find(p => !p.noGround && PG.zoneGrass(z1.layers.zones[0]).kind === 'lawn');
    check(lawnAt(O2, P2.find(p => p.noGround)) !== 'lawn' && (!pOn || lawnAt(O2, pOn) === 'lawn'), '19c a plot with its ground off mows no lawn; its neighbour does');
    check(PG.plotGroundOff(z1.layers.zones[0], P0[0].id) && !PG.plotGroundOff(zRec.layers.zones[0], P0[0].id), '19c plotGroundOff reads the zone\'s rules');
  }
  // 19d THE TREES COME BACK (the user: "when I remove the exclusion polygons or the polygon around the runway, the trees
  //     don't come back directly"): treeExRegions names every region that keeps trees out; an exclude removed, shrunk or
  //     moved, a strip moved or deleted changes its key (the streamer regrows the chunks under the old and the new box)
  const exRec = PG.normalise({ layers: { exclude: [{ id: 'x1', poly: [[0, 0], [60, 0], [60, 40], [0, 40]], what: ['trees'] }],
    runways: [Object.assign({}, PG.RUNWAY_DEF, { id: 'w1', c: [400, 0], hdg: 0, len: 500, wid: 20 })] } });
  const keys = r => PG.compose(r, synth).treeExRegions().map(q => q.k);
  const k0 = keys(exRec), exNone = JSON.parse(JSON.stringify(exRec)); exNone.layers.exclude = [];
  const exShr = JSON.parse(JSON.stringify(exRec)); exShr.layers.exclude[0].poly[1] = [30, 0]; exShr.layers.exclude[0].poly[2] = [30, 40];
  const rwMv = JSON.parse(JSON.stringify(exRec)); rwMv.layers.runways[0].c = [420, 0];
  const rwGone = JSON.parse(JSON.stringify(exRec)); rwGone.layers.runways = [];
  const diff = (a, b) => a.filter(k => b.indexOf(k) < 0).length + b.filter(k => a.indexOf(k) < 0).length;
  check(diff(k0, keys(exRec)) === 0, '19d the same record names the same tree exclusions (no regrowth without a change)');
  check(diff(k0, keys(exNone)) >= 1 && diff(k0, keys(exShr)) >= 2 && diff(k0, keys(rwMv)) >= 2 && diff(k0, keys(rwGone)) >= 2, '19d an exclude removed or shrunk, a strip moved or deleted: its region changes');
  const reg = PG.compose(exRec, synth).treeExRegions().find(q => q.k.indexOf('[[0,0],[60,0]') >= 0), w00 = PG.compose(exRec, synth).frame.toWorld(0, 0), w64 = PG.compose(exRec, synth).frame.toWorld(60, 40);
  check(reg && reg.x0 <= Math.min(w00[0], w64[0]) && reg.x1 >= Math.max(w00[0], w64[0]) && reg.z0 <= Math.min(w00[1], w64[1]) && reg.z1 >= Math.max(w00[1], w64[1]), '19d an exclusion\'s region covers it in world metres');
  // ...and the game's streamer answers a premises edit by those regions (the hook, the diff, the eviction by box)
  const RW = fs.readFileSync(path.join(TOOLS, '..', 'src', 'viewer', 'render_world.js'), 'utf8'), APP = fs.readFileSync(path.join(TOOLS, '..', 'src', 'viewer', 'app.js'), 'utf8');
  check(/vegChanged: \(\) => \{\s*const exN = exRegrow\(\);/.test(RW) && /O\.treeExRegions \? O\.treeExRegions\(\)/.test(RW) && /dropPart\(c2\.base\); dropPart\(c2\.fill\); chunks\.delete\(k\); n\+\+;/.test(RW), '19d TREE_FILL.vegChanged regrows the chunks under a changed exclusion');
  check(/onRebuilt:[^\n]*window\.TREE_FILL\.vegChanged\(\)/.test(APP), '19d the editor\'s rebuild calls TREE_FILL.vegChanged');
  // 19e THE SHAPE THROUGH THE STORE: a corner inserted, a corner removed, a road's handles beside its points - each
  //     edit saved and loaded back is the same record; a handle list shorter or longer than the points is laid beside them
  const shp = PG.normalise({ layers: { surface: [{ id: 's1', poly: [[0, 0], [50, 0], [50, 30], [0, 30]], surface: PG.SURFACE.GRAVEL }],
    roads: [{ id: 'r1', pts: [[0, 0], [100, 0], [200, 50]], w: 4, cls: 'gravel', curve: 'spline', tan: [null, [10, 5]] }] } });
  check(shp.layers.roads[0].tan.length === 3 && shp.layers.roads[0].tan[2] === null, '19e normalise lays a road\'s handles beside its points');
  const ins = JSON.parse(JSON.stringify(shp)); ins.layers.surface[0].poly.splice(2, 0, [60, 15]); ins.layers.roads[0].pts.splice(1, 0, [50, -5]); ins.layers.roads[0].tan.splice(1, 0, null);
  const insRT = PG.unwrap(PG.envelope(null, ins)).rec;
  check(JSON.stringify(insRT.layers) === JSON.stringify(PG.normalise(ins).layers) && insRT.layers.surface[0].poly.length === 5 && insRT.layers.roads[0].tan[2][0] === 10, '19e a corner inserted round-trips (the handle stays on its point)');
  const del = JSON.parse(JSON.stringify(insRT)); del.layers.surface[0].poly.splice(2, 1); del.layers.roads[0].pts.splice(1, 1); del.layers.roads[0].tan.splice(1, 1);
  const delRT = PG.unwrap(PG.envelope(null, del)).rec;
  check(JSON.stringify(delRT.layers) === JSON.stringify(shp.layers), '19e the corner removed again is the record it was');
  check(PG.issues(insRT).length === 0 && PG.issues(padRec).length === 0, '19e the edited shapes and the pad raise no issue');
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
  const rec = PG.expandAreas(PG.unwrap(fs.readFileSync(path.join(TOOLS, 'fixtures', fixtures[0]), 'utf8')).rec);
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
  // (v1.33) a stage whose band ends past the max, a vary of a field no stage may change: refused
  const sg = JSON.parse(JSON.stringify(rec)); (sg.layers.objects = sg.layers.objects || []).push({ id: 'sg_t', kind: 'kit', kit: 'plot', x: 0, z: 0, stage: { track: 'tk', show: [1, 5] } });
  neg.push([PG.stageIssues(sg, { tk: 2 }).length > 0, 'a stage band closed past the max is refused']);
  const sv = JSON.parse(JSON.stringify(rec)); (sv.layers.runways = sv.layers.runways || []).push({ id: 'w_t', c: [0, 0], hdg: 0, len: 400, wid: 20, stage: { track: 'tk', vary: [{ show: [0, 0], hdg: 2 }] } });
  neg.push([PG.issues(sv).some(i => /hdg is not a runway field/.test(i)), 'a stage varying a runway field no stage may change is refused']);
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
    const rec = PG.expandAreas(PG.unwrap(txt).rec);   // (v1.36: the v1 view)
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
    // (G830: the rule is the generation half's - src/viewer/premises_build.js genItem - which the renderer runs inline
    // or in its house worker)
    const RP = fs.readFileSync(path.join(TOOLS, '..', 'src', 'viewer', 'premises_build.js'), 'utf8');
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

    // 14q THE TOWN SWITCH (G590, the 2026-09-26 playtest): Metlakatla held the Jolene taxi at 12-15 fps, so the game
    // drops every mk_ entry at load unless the GRAPHICS 'towns' row or ?town=1 says otherwise. Everything above
    // tested the record WITH the town (the data is kept and must stay whole); this tests it WITHOUT: nothing left
    // points at a cut id, the other fields and sites stand, the terrain codes the town stamped (15, 16) are not
    // stamped, the town's wood is not planted - and a save made with the town off puts it back.
    {
      const D = PG.dropPlaces(rec, ['mk_']);
      const isMk = e => e && typeof e.id === 'string' && e.id.startsWith('mk_');
      const left = Object.keys(D.rec.layers).filter(k => Array.isArray(D.rec.layers[k]) && D.rec.layers[k].some(isMk));
      check(D.n > 200 && !left.length, '14q the switch drops every mk_ entry', D.n + ' cut; left in ' + (left.join(', ') || 'none'));
      check(Object.keys(rec.layers).some(k => Array.isArray(rec.layers[k]) && rec.layers[k].some(isMk)), '14q ...from a COPY: the record itself keeps the town');
      const refs = (JSON.stringify(D.rec).match(/"mk_[\w-]*"/g) || []);
      check(!refs.length, '14q nothing left refers to a cut id', [...new Set(refs)].slice(0, 5).join(', '));
      check(PG.issues(D.rec).length === 0, '14q the record without the town has no issues', PG.issues(D.rec).slice(0, 3).join(' / '));
      const OD = PG.compose(D.rec, IW, { catalogue: CAT, globals: GENS });
      const ids = OD.aerodromes.map(a => a.id);
      check(!ids.includes('mk_sea') && ['HOME', 'SEA', 'mn_strip', 'nv_strip', 'tw_ski'].every(id => ids.includes(id)), '14q the other fields stay destinations, the town\'s sea lane goes', ids.join(','));
      const pre = x => String(x || '').split('_')[0];
      const sites = new Set(OD.records.items.map(r => pre(r.site)));
      check(['mn', 'nv', 'tw', 'af'].every(p => sites.has(p)), '14q the mine, the native village, the tramway and the field still place their items', [...sites].join(','));
      check(OD.records.trees.filter(t => /^mk_/.test(String(t.zone || ''))).length === 0 && OD.records.plots.every(p => !/^mk_/.test(String(p.zone || p.id))), '14q no town plot and no town tree is composed');
      if (IW.ttype) {
        const cnt = c => { let n = 0; for (let k = 0; k < IW.ttype.length; k++) if (IW.ttype[k] === c) n++; return n; };
        const a15 = cnt(15), a16 = cnt(16), un = OD.stampTtype(IW), b15 = cnt(15), b16 = cnt(16); if (un) un();
        check(b15 === a15 && b16 === a16, '14q the town\'s terrain types (15, 16) are not stamped', '15: ' + a15 + ' -> ' + b15 + ', 16: ' + a16 + ' -> ' + b16);
      }
      // a save made with the town off (the editor's autosave through app.js's storage wrapper) puts the cut back;
      // an entry the edit added, and one it changed, are the edit's
      const E = JSON.parse(JSON.stringify(D.rec));
      E.layers.objects.push({ id: 'o_g590', kind: 'tree', x: 1, z: 2 });
      const mv = E.layers.sites.find(s => !isMk(s)); if (mv && mv.at) mv.at = { x: mv.at.x + 5, z: mv.at.z };
      const back = PG.restorePlaces(E, D.cut);
      const same = Object.keys(rec.layers).every(k => !Array.isArray(rec.layers[k]) || rec.layers[k].every(e => (back.layers[k] || []).some(b => b.id === e.id)));
      check(same && back.layers.objects.some(e => e.id === 'o_g590') && (!mv || back.layers.sites.find(s => s.id === mv.id).at.x === mv.at.x),
            '14q restorePlaces puts every cut entry back and keeps the edit');
      const AP = fs.readFileSync(path.join(TOOLS, '..', 'src', 'viewer', 'app.js'), 'utf8') + fs.readFileSync(path.join(TOOLS, '..', 'src', 'viewer', 'world_boot.js'), 'utf8');   // G999: the load's composition is world_boot.js's
      check(/off: \['mk_'\]/.test(AP) && /PREMISES_GEN\.dropPlaces\(U\.rec, TOWN\.off\)/.test(AP) && /makeWorld\(0, \{ premises: premisesPlaced/.test(AP) && /restorePlaces\(U\.rec, TOWN\.cut\)/.test(AP),
            '14q app.js drops the town at load by default and restores it in every editor save');
    }

    // 14r THE AUTHORS ARE DETERMINISTIC, held by a source scan rather than by
    // regenerating (which costs seconds and needs the DEM). Python randomises
    // hash() of a str PER PROCESS, so `random.Random(hash((name, seed)))` seeds a
    // different generator on every run: the island fixture came out with a
    // different md5 three times running, the walked yard rings moved, and
    // jolene_author --absorb reported phantom edits for a part nobody had touched.
    // Five sessions now author ONE generated 176 kB record and the rule that makes
    // that safe is that anyone may regenerate it and get the same bytes, so a
    // builtin hash() anywhere in an author is a defect by construction. Use a
    // stable digest - zlib.crc32, an FNV, hashlib - and never hash().
    const authors = [path.join(TOOLS, 'metlakatla_author.py'), path.join(TOOLS, 'jolene_author.py')]
      .concat(fs.readdirSync(path.join(TOOLS, 'jolene_parts')).filter(f => f.endsWith('.py'))
                .map(f => path.join(TOOLS, 'jolene_parts', f)))
      .filter(f => fs.existsSync(f));
    for (const f of authors) {
      const src = fs.readFileSync(f, 'utf8');
      const bad = src.split(new RegExp('\\r?\\n')).map((L, i) => [i + 1, L])
        .filter(([, L]) => /(?:^|[^.\w])hash\s*\(/.test(L) && !/^\s*#/.test(L) && !/hashlib/.test(L));
      check(bad.length === 0, '14r ' + path.basename(f) + ": no builtin hash() - it is randomised per process",
            bad.length ? 'line ' + bad[0][0] + ': ' + bad[0][1].trim() : 'none');
    }
  }
}

// 15 THE BOOT'S SQUARE (G554, 2026-09-24): the boot drains the build queue four at a time and every step froze - re-walking
// every frozen child and RE-MERGING every lot of the premises: 28 s of a 106 s roll-out at Metlakatla's 450 plots.
// Held by a source scan (the anchors checked, so a moved function turns this red instead of quiet).
{
  const RP3 = fs.readFileSync(path.join(TOOLS, '..', 'src', 'viewer', 'render_premises.js'), 'utf8');
  const i0 = RP3.indexOf('function freezeStatic('), i1 = RP3.indexOf('function mergeInto('), i2 = RP3.indexOf('function batchLots(');
  check(i0 > 0 && i1 > i0 && i2 > i1, "15 freezeStatic / mergeInto / batchLots found in render_premises.js, in that order");
  const fz = RP3.slice(i0, i1), mi = RP3.slice(i1, i2);
  check(/if \(!fresh && walk && !c\.userData\.skipWalk\)/.test(fz), '15 a build step freezes only what is new (the frozen children are re-walked by the tick and the rebuild; a settled house is not, G592)');
  // G592: per cell, as each cell goes live - a frame of the stream only marks the lots (the merge walks the group) and
  // the tick's walk merges; batchGroup keeps a cell's merge while its source set is the same
  check(/if \(lots\) \{ if \(walk \|\| !STREAMING\) batchLots\(\); else BATCH\.pending = true; \}/.test(fz), '15 a frame of the stream marks the lots, the walk merges them (not at every step)');
  const bg = RP3.slice(RP3.indexOf('function batchGroup('), RP3.indexOf('// THE LOTS group stands'));
  check(/if \(was && was\.sig === sig\)/.test(bg) && /if \(!cellLive\(ck\)\) \{ pend = true;/.test(bg), '15 the merge is per cell: an unchanged cell is kept, a cell still streaming waits');
  check(mi.length > 300 && !/fromBufferAttribute|applyMatrix4/.test(mi), "15 the merge reads the arrays, not three's per-vertex accessors");
}

// 16 THE COMPOSED GROUND, SAME BITS FASTER (2026-09-24): a grade files its segments in cells of its reach under
// number keys (it was 64 m under string keys), and polyRoad's at() bisects its arclength (it walked it). Both
// are held to the plain formula they replaced: the grade to a scan of EVERY segment in polyline order (the
// strict < keeps the first of a tie), at() to the linear walk - Object.is on every answer, over roads that
// curve every half metre, repeat a point, run long and straight, or are one segment.
{
  const r16 = PG.mulberry32(16);
  const smf = PG.smf01;
  const refGrade = (m, y0) => {
    const pts = m.pts, hw = Math.max(0.5, (+m.width || 4) / 2), fall = Math.max(0.5, +m.falloff || 8);
    const weight = d => (d <= 0 ? 1 : d >= fall ? 0 : 1 - smf(d / fall));
    return (x, z, h) => {
      let best = Infinity, ty = 0;
      for (let i = 0; i + 1 < pts.length; i++) {
        const a = pts[i], b = pts[i + 1], dx = b[0] - a[0], dz = b[1] - a[1], l2 = dx * dx + dz * dz;
        const t = l2 > 1e-12 ? Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / l2)) : 0;
        const d = Math.hypot(x - (a[0] + dx * t), z - (a[1] + dz * t));
        if (d < best) { best = d; ty = (a[2] || 0) + ((b[2] || 0) - (a[2] || 0)) * t; }
      }
      const w = weight(best - hw);
      return w > 0 ? h + ((m.abs ? 0 : y0) + ty - h) * w : h;
    };
  };
  const roads = [];
  { const p = []; for (let k = 0; k <= 400; k++) { const a = k * 0.004; p.push([300 + 120 * Math.cos(a), -80 + 120 * Math.sin(a), 4 + Math.sin(k * 0.1)]); } roads.push(p); }   // an arc, a point every 0.48 m
  { const p = [[0, 0, 1]]; for (let k = 1; k < 60; k++) { const q = p[p.length - 1]; p.push(k % 7 === 0 ? q.slice() : [q[0] + (r16() - 0.3) * 30, q[1] + (r16() - 0.5) * 30, q[2] + (r16() - 0.5)]); } roads.push(p); }   // a wander, some points repeated
  roads.push([[-2000, 500, 0], [3000, 520, 12]]);                                    // one long segment
  { const p = []; for (let k = 0; k < 200; k++) p.push([-400 + k * 6, 900 + 3 * Math.sin(k * 0.3), 2]); roads.push(p); }   // the compose's 6 m sampling
  let n16 = 0, bad16 = 0, moved = 0, first16 = '';
  for (const pts of roads) for (const [width, falloff, abs] of [[3.6, 6, true], [1, 0.5, false], [30, 40, true], [7, 12, false]]) {
    const m = { id: 'g16', kind: 'grade', pts, width, falloff, abs }, y0 = 3.25;
    const M = PG.makeModifier(m, y0), R = refGrade(m, y0);
    let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
    for (const p of pts) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); z0 = Math.min(z0, p[1]); z1 = Math.max(z1, p[1]); }
    const pad = width / 2 + falloff + 5;
    for (let s = 0; s < 6000; s++) {
      // half anywhere in the grown box, half within reach of a random segment
      let x, z;
      if (s & 1) { x = x0 - pad + r16() * (x1 - x0 + 2 * pad); z = z0 - pad + r16() * (z1 - z0 + 2 * pad); }
      else { const i = Math.floor(r16() * (pts.length - 1)), a = pts[i], b = pts[i + 1], u = r16(); x = a[0] + (b[0] - a[0]) * u + (r16() - 0.5) * 2 * pad; z = a[1] + (b[1] - a[1]) * u + (r16() - 0.5) * 2 * pad; }
      const h = -7 + r16() * 20, got = M.apply(x, z, h), want = R(x, z, h);
      n16++; if (!Object.is(got, want)) { bad16++; if (!first16) first16 = x.toFixed(3) + ',' + z.toFixed(3) + ': ' + got + ' vs ' + want; }
      if (got !== h) moved++;
    }
  }
  check(bad16 === 0 && moved > n16 / 5, '16 a grade answers what a scan of every segment answers', bad16 + ' of ' + n16 + ' differ, ' + moved + ' moved' + (first16 ? ' - first ' + first16 : ''));
  // at(): the linear walk, then the same interpolation
  const refAt = (R, t) => {
    const s = R.s, pts = R.pts;
    t = Math.max(0, Math.min(s[s.length - 1], t));
    let i = 1; while (i < s.length - 1 && s[i] < t) i++;
    const u = (t - s[i - 1]) / Math.max(1e-6, s[i] - s[i - 1]);
    return [pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * u, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * u, pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]];
  };
  let nA = 0, badA = 0;
  for (const pts of roads.concat([[[0, 0], [0, 0], [10, 0]]])) {
    const R = PG.polyRoad(pts.map(p => [p[0], p[1]]), 3.6);
    const ts = [0, -3, R.length, R.length + 9, NaN];
    for (const v of R.s) ts.push(v, v - 1e-9, v + 1e-9);
    for (let k = 0; k < 500; k++) ts.push(r16() * R.length);
    for (const t of ts) {
      const g = R.at(t), w = refAt(R, t), L = Math.hypot(w[2], w[3]) || 1;
      nA++; if (!Object.is(g.p[0], w[0]) || !Object.is(g.p[1], w[1]) || !Object.is(g.tg[0], w[2] / L) || !Object.is(g.tg[1], w[3] / L)) badA++;
    }
  }
  check(badA === 0, "16 polyRoad's at() answers what the linear walk answers", badA + ' of ' + nA + ' differ');
}

// 17 THE RUNWAY LOOK (G1390-G1394, RUNWAY-LOOK): the premises carry their pavement's look per surface type
// (rec.pavement's pv / sf / gr keys, the editor's PAVEMENT section and each runway's 'look of every ...' rows) and the
// roads' side rule (roadSide). They round-trip through the envelope and the normaliser, raise no issue, reach the
// composed premises (O.pavement) and the pavement module's resolve; a road is SIDED (its side faded like a strip's,
// its declared width the drawn one) unless its entry declares a band or the premises say roadSide 0
{
  const PAVM = require('../src/viewer/pavement.js');
  const look = { grBright: 1.18, grHue: 0.21, grTint: 0.35, grWear: 0.6, grSideW: 2.5, grSideA: 0.15, sfSideBright: 0.8, pvTint: 0.1, pvSideA: 0.5 };
  const base = { seed: 5, pavement: Object.assign({ wet: 0.2 }, look), layers: { roads: [{ id: 'p1', pts: [[-120, 30], [120, 30]], w: 3, cls: 'path', look: 'dirt' }, { id: 'p2', pts: [[-120, -30], [120, -30]], w: 6, cls: 'gravel', band: 2 }] } };
  const rec = PG.normalise(JSON.parse(JSON.stringify(base)));
  const back = PG.unwrap(PG.envelope('look', rec)).rec, again = PG.normalise(JSON.parse(JSON.stringify(back)));
  const kept = Object.keys(look).every(k => back.pavement && back.pavement[k] === look[k] && again.pavement[k] === look[k]);
  check(kept && JSON.stringify(back) === JSON.stringify(rec), '17 the runway look round-trips through the envelope and the normaliser', JSON.stringify(back.pavement));
  check(PG.issues(rec).length === 0, '17 a premises with a runway look has no issues', PG.issues(rec)[0]);
  const O = PG.compose(rec, synth, { catalogue: CAT, noPlace: true });
  check(O.pavement && Object.keys(look).every(k => O.pavement[k] === look[k]), '17 the composed premises hand the look to the renderers (O.pavement)');
  const RS = PAVM.resolve({ cls: 'grass' }, rec), L = PAVM.lookOf('grass', RS.recipe), Ld = PAVM.lookOf('dirt', RS.recipe);
  const t = PAVM.tintRGB(0.21, 0.35).map(c => c * 1.18);
  check(L.surf.every((c, i) => Math.abs(c - t[i]) < 1e-9) && L.sideW === 2.5 && L.sideA === 0.15 && L.wear === 0.6 && Ld.side.every(c => Math.abs(c - 0.8) < 1e-9) && Ld.sideA === 0,
    "17 the module resolves the premises' look per surface type (grass: its tint, side 2.5 m from 0.15, wear 0.6; dirt: the soft side's brightness)");
  const r1 = O.roads.find(r => r.id === 'p1'), r2 = O.roads.find(r => r.id === 'p2');
  check(r1 && r1.sided === true && r2 && r2.sided === false, '17 a road is sided unless its entry declares a band', 'p1 ' + (r1 && r1.sided) + ', p2 ' + (r2 && r2.sided));
  const off = PG.normalise(Object.assign(JSON.parse(JSON.stringify(base)), { pavement: { roadSide: 0 } }));
  const Of = PG.compose(off, synth, { catalogue: CAT, noPlace: true });
  check(Of.roads.every(r => r.sided === false), '17 roadSide 0 in the premises draws every road\'s band again');
}

// ---------------------------------------------------------------------------
// 17 EDITOR-VEG (G1385, contract v1.31): a cover polygon's vegetation - none, a biome by name, a biome of its own -
//    and a strip's own tree clearance survive the save and the reload, and compose to what they say.
{
  const sq = (cx, cz, h) => [[cx - h, cz - h], [cx + h, cz - h], [cx + h, cz + h], [cx - h, cz + h]];
  const rec = PG.DEF();
  rec.layers.ttype = [
    { id: 'k1', poly: sq(0, 0, 100), code: null, veg: { mode: 'biome', mix: 'conifer' } },
    { id: 'k2', poly: sq(60, 0, 30), code: 8, veg: { mode: 'none' } },
    { id: 'k3', poly: sq(-300, 0, 80), code: null, veg: { mode: 'new', species: { 'spruce_tree.glb': { proportion: 2 }, 'grass_reed': { proportion: 1, density: 0.3 } }, density: 250, under: 4, cover: 0.5 } },
    { id: 'k4', poly: sq(300, 300, 40), code: 15 }];
  rec.layers.runways = [Object.assign({ id: 'w1' }, JSON.parse(JSON.stringify(PG.RUNWAY_DEF)), { c: [0, 600], hdg: Math.PI / 2, len: 600, wid: 20, clear: { side: 40, beyond: 200, taper: 0.15, bushes: true } }),
                        Object.assign({ id: 'w2' }, JSON.parse(JSON.stringify(PG.RUNWAY_DEF)), { c: [0, -900], hdg: Math.PI / 2, len: 400, wid: 20 })];
  // the round trip: the envelope, a reload, the same polygons and vegetation, the same clearance
  const back = PG.unwrap(PG.envelope('veg', JSON.parse(JSON.stringify(rec)))).rec;
  check(JSON.stringify(back.layers.ttype) === JSON.stringify(rec.layers.ttype), '17 the cover polygons and their vegetation survive the save and the reload', back.layers.ttype.map(c => c.id + ':' + JSON.stringify(c.veg || null)).join(' '));
  check(JSON.stringify(back.layers.runways.map(r => r.clear || null)) === JSON.stringify(rec.layers.runways.map(r => r.clear || null)), "17 a strip's own clearance survives the save and the reload");
  check(PG.issues(back).length === 0, '17 the record has no issues', PG.issues(back)[0]);
  const bad = JSON.parse(JSON.stringify(rec)); bad.layers.ttype.push({ id: 'k9', poly: sq(900, 900, 20), code: null, veg: { mode: 'biome' } }, { id: 'k8', poly: sq(950, 950, 20), code: null });
  const bi = PG.issues(bad);
  check(bi.some(t => /k9: vegetation/.test(t)) && bi.some(t => /k8: neither/.test(t)), '17 a biome without a name and a polygon saying nothing are issues', bi.join(' | '));
  // the composition: vegAt by the last polygon over a point; the code-less polygons stamp nothing
  const O = PG.compose(back, synth);
  const at = (x, z) => { const w = O.frame.toWorld(x, z); return O.vegAt(w[0], w[1]); };
  check(at(0, 50) === 'conifer' && at(60, 0) === null && at(-300, 10) === '@k3' && at(300, 300) === undefined && at(2000, 0) === undefined,
    '17 vegAt: the biome, none (the later polygon over it), its own mix, nothing where no polygon speaks', [at(0, 50), at(60, 0), at(-300, 10), at(300, 300), at(2000, 0)].map(String).join(' '));
  const M3 = O.vegMixes['@k3'];
  check(M3 && M3.species['spruce_tree.glb'].proportion === 2 && M3.species.grass_reed.density === 0.3 && Math.abs(M3.forest.count / (Math.PI * M3.forest.radius ** 2) * 1e4 - 250) < 0.5 && M3.forest.under === 4 && M3.forest.cover === 0.5,
    "17 a new biome is a mix in the bench's shape: its species, 250 trees a hectare, its bushes and its grass", JSON.stringify(M3 && M3.forest));
  check(O.ttypes.map(c => c.id).join() === 'k2,k4', '17 only the polygons with a code stamp one', O.ttypes.map(c => c.id).join());
  // the planters' question (28c_biomes mixHere): the polygon first, the code's biome where none speaks
  const BIOMES = require(path.join(TOOLS, '..', 'src', 'core', '28c_biomes.js'));
  const B = BIOMES.make({ biomes: { map: { 8: 'deciduous' }, mixes: { conifer: { species: { 'spruce_tree.glb': {} }, forest: { count: 2500 } }, deciduous: { species: {}, forest: { count: 900 } } } } });
  for (const k in O.vegMixes) B.mixes[k] = O.vegMixes[k];
  B.over = (x, z) => O.vegAt(x, z);
  const mh = (x, z) => { const w = O.frame.toWorld(x, z); return B.mixHere(8, w[0], w[1]); };
  check(mh(0, 50) === 'conifer' && mh(60, 0) === null && mh(-300, 10) === '@k3' && mh(2000, 0) === 'deciduous' && B.density('@k3') > 0,
    "17 mixHere: the polygon's biome, none, its own mix, the terrain type's elsewhere", [mh(0, 50), mh(60, 0), mh(-300, 10), mh(2000, 0)].map(String).join(' '));
  // the clearance: the aerodrome carries it (null without), the box and its taper, the outline
  const a1 = O.aerodromes.find(a => a.id === 'w1'), a2 = O.aerodromes.find(a => a.id === 'w2');
  check(a1 && a1.treeClear && a1.treeClear.side === 40 && a1.treeClear.beyond === 200 && a1.treeClear.taper === 0.15 && a1.treeClear.bushes === true && a2 && a2.treeClear === null,
    "17 a strip's own clearance reaches its aerodrome; none is today's box", JSON.stringify(a1 && a1.treeClear) + ' / ' + JSON.stringify(a2 && a2.treeClear));
  const e = { rl: 300, hl: 500, hw: 50, tp: 0.15 };
  check(PG.inRwyClear(e, 0, 49) && !PG.inRwyClear(e, 0, 51) && PG.inRwyClear(e, 400, 64) && !PG.inRwyClear(e, 400, 66) && PG.inRwyClear(e, -499, 79) && !PG.inRwyClear(e, 501, 0),
    '17 the clearance: its sides, its taper past the ends (+15 m at 100 m out), its length');
  const poly = PG.runwayClearPoly(back.layers.runways[0]);
  check(poly.length === 8 && PG.inPoly(poly, 0, 600 + 299) && PG.inPoly(poly, 49, 600) && !PG.inPoly(poly, 51, 600) && PG.inPoly(poly, 70, 600 + 300 + 150) && !PG.inPoly(poly, 0, 600 + 501),
    "17 the editor's outline is the clearance", JSON.stringify(poly.map(q => q.map(v => Math.round(v)))));
  // the derived strip box keeps the plots off but hands the trees to the strip's own clearance
  const wx = O.frame.toWorld(0, 600 + 300 + 20);
  check(!O.excludeAt(wx[0], wx[1], 'trees') && O.excludeAt(wx[0], wx[1], 'plots'), "17 a strip with its own clearance: the box + 30 m keeps the plots, its clearance the trees");
}

// 18 THE PLOTS (G2310 PREM-S3, contract v1.34): a runway's `plots` [{ id, x, z, hdg, stand?, taxiOut?, taxiOut1? }] -
// the record's `hangar` read as plot <runway id> verbatim; a field without plots composes to the very site it did (no
// `plots` key); with them the hangar is byte-identical and every plot rides into the site in the world frame (a stand's
// heading derived toward its first taxi point, as the field's); the round trip keeps them; issues() refuses a malformed
// one (each row below is its own negative control: the bad record MUST be refused). The shipped Jolene has none.
{
  const F = { toWorld: (x, z) => [x + 1000, z - 500], toLocal: (x, z) => [x - 1000, z + 500], yaw: 0 };   // a moved frame: the plots follow it
  const base = { id: 'HOME', c: [0, 0], hdg: 0, len: 800, wid: 30, hangar: { x: 100, z: 60, hdg: -1.5708 }, stand: { x: 100, z: 40, hdg: null }, taxiOut: [[90, 30], [0, 0]] };
  const P0 = PG.runwayPlots(base);
  check(P0.length === 1 && P0[0].id === 'HOME' && P0[0].main && P0[0].x === 100 && P0[0].z === 60 && P0[0].hdg === -1.5708, '18 the hangar is plot <runway id>, verbatim', JSON.stringify(P0));
  const s0 = PG.runwaySite(base, F);
  check(!('plots' in s0), '18 a field without plots composes to the site it did (no plots key)', Object.keys(s0).join(','));
  const withP = Object.assign({}, base, { plots: [{ id: 'HOME.2', x: 200, z: 60, hdg: 3.1416, stand: { x: 170, z: 60, hdg: null }, taxiOut: [[150, 30], [0, 0]] }, { id: 'HOME.3', x: -50, z: 80, hdg: 0 }] });
  const s1 = PG.runwaySite(withP, F);
  check(JSON.stringify(s1.hangar) === JSON.stringify(s0.hangar) && JSON.stringify(s1.stand) === JSON.stringify(s0.stand) && JSON.stringify(s1.taxiOut) === JSON.stringify(s0.taxiOut),
    '18 with plots the field\'s hangar, stand and way out are byte-identical');
  const q0 = s1.plots[0], q1 = s1.plots[1], q2 = s1.plots[2];
  check(s1.plots.length === 3 && q0.main && q0.x === s1.hangar.x && q0.z === s1.hangar.z && q0.hdg === s1.hangar.hdg && q0.ry === s1.hangar.ry, '18 the site\'s plots: HOME first, the hangar itself');
  check(q1.id === 'HOME.2' && q1.x === 1200 && q1.z === -440 && Math.abs(q1.ry - (Math.PI - 3.1416)) < 1e-4 && q1.stand.x === 1170 && Math.abs(q1.stand.hdg - Math.atan2(-30, -20)) < 1e-4 && q1.taxiOut[0][0] === 1150,
    '18 a plot rides into the world frame with its stand (heading toward its first taxi point) and way out', JSON.stringify(q1));
  check(q2.id === 'HOME.3' && !q2.stand && !q2.taxiOut, '18 a plot with no way of its own carries none (the field\'s serves)');
  // a lane: its site is its plots alone
  const lane = { id: 'SEA', c: [0, 0], hdg: 0, len: 1500, wid: 200, surface: PG.SURFACE.WATER, plots: [{ id: 'SEA', x: 0, z: 300, hdg: -1.5708, stand: { x: 0, z: 250, hdg: null } }] };
  const sl = PG.runwaySite(lane, F);
  check(sl && sl.plots && sl.plots.length === 1 && !sl.hangar && !sl.stand && Math.abs(sl.plots[0].stand.hdg - (-1.5708)) < 1e-4, '18 a lane\'s site is its slipway plots alone (the slip\'s stand faces where its door does)', JSON.stringify(sl));
  // the round trip
  const recP = PG.normalise({ layers: { runways: [withP] } });
  const back = PG.unwrap(PG.envelope('t', recP)).rec;
  check(JSON.stringify(back.layers.runways[0].plots) === JSON.stringify(withP.plots), '18 the envelope round trip keeps the plots byte for byte');
  check(PG.issues(recP).filter(m => /plot/.test(m)).length === 0, '18 well-formed plots raise no issue', PG.issues(recP).filter(m => /plot/.test(m))[0]);
  // the refusals (each its own negative control)
  const bad = (what, mut) => { const r = JSON.parse(JSON.stringify(withP)); mut(r); const iss = PG.issues(PG.normalise({ layers: { runways: [r] } })).filter(m => /plot/.test(m)); check(iss.length > 0, '18 refused: ' + what, iss[0] || 'no issue'); };
  bad('a plot without a place', r => { delete r.plots[0].x; });
  bad('a plot without an id', r => { delete r.plots[1].id; });
  bad('a plot named twice', r => { r.plots[1].id = 'HOME.2'; });
  bad('a plot named as the hangar it duplicates', r => { r.plots[1].id = 'HOME'; });
  bad('a way out with no stand', r => { delete r.plots[0].stand; });
  bad('a way out that is not a list of points', r => { r.plots[0].taxiOut = [[1, 'x']]; });
  bad('plots that are not a list', r => { r.plots = { id: 'x' }; });
  {
    const two = PG.normalise({ layers: { runways: [withP, Object.assign({}, base, { id: 'w3', c: [3000, 0], hangar: null, stand: null, taxiOut: null, plots: [{ id: 'HOME.2', x: 3000, z: 60 }] })] } });
    check(PG.issues(two).some(m => /HOME\.2 is named twice/.test(m)), '18 refused: a plot id held by two runways (a plot id is a hangar id)');
  }
  // the shipped record: every plot well-formed
  for (const fx of fixtures) {
    const rec = PG.unwrap(fs.readFileSync(path.join(TOOLS, 'fixtures', fx), 'utf8')).rec;
    const n = rec.layers.runways.reduce((k, r) => k + (Array.isArray(r.plots) ? r.plots.length : 0), 0);
    if (n) check(PG.issues(rec).filter(m => /plot/.test(m)).length === 0, '18 ' + path.basename(fx) + ': its ' + n + ' plots are well-formed');
  }
}

// 20 THE AREAS (G2910 SCENERY-ED-2, contract v1.36, record v2; futureDesigns/SCENERY-POLYGON-2026-10.md): every polygon
// entry not on a stage folds into ONE area per polygon (PREMISES_MIGRATORS[1]); compose expands the areas back into the
// v1 entries at their places. Held here:
//   20a THE MIGRATION ROUND TRIP: every fixture, Jolene and her parts - the expanded record IS the v1 record, layer for
//       layer (canonical JSON), nothing foldable is left, the other layers untouched, the envelope round-trips
//   20b THE SAME WORLD: the migrated record composes to the v1 record's bits - the ground, the wheels, the excludes, the
//       cover, the vegetation, the plots, the trees' regions, the pavements, the materials, the stamps
//   20c the places switch (dropPlaces / restorePlaces) cuts and restores areas by their ids' prefix
//   20d a fold into a record that already has areas keeps every layer's order (the editor's fold of a hand edit)
//   20e a new area composes after every v1 entry (it wins its priority); explicit wheels beat a round draw's
//   20f the shapes: a rectangle (square, rounded) and a round written by normalise; ids never collide (newId)
//   20g issues: an unknown property, marks on no pavement, a bad exclusion
//   20h THE MARKS: parking bays, a dock's line and bollards, keep-clear hatching - every mark inside its shape by the
//       inset, the counts, the rules the shader reads; a dock's water edge found by compose
//   20i Jolene's gravel bands beside 13/31 are areas that keep the trees out and draw nothing (what the user saw)
{
  const canon = v => JSON.stringify(v, (k, x) => (x && typeof x === 'object' && !Array.isArray(x) ? Object.keys(x).sort().reduce((o, q) => { o[q] = x[q]; return o; }, {}) : x));
  const sources = fixtures.map(f => [f, fs.readFileSync(path.join(TOOLS, 'fixtures', f), 'utf8')])
    .concat([['island_jolene.json', fs.readFileSync(path.join(TOOLS, 'fixtures', 'island_jolene.json'), 'utf8')]])
    .concat(fs.readdirSync(path.join(TOOLS, 'jolene_parts')).filter(f => /\.json$/.test(f)).map(f => { const o = JSON.parse(fs.readFileSync(path.join(TOOLS, 'jolene_parts', f), 'utf8')); return ['part ' + f, JSON.stringify({ layers: o.layers })]; }));
  let folded = 0;
  for (const [name, txt] of sources) {
    const raw = JSON.parse(txt), r1 = PG.normalise(JSON.parse(JSON.stringify(raw.premises || raw))), r2 = PG.unwrap(txt).rec, X = PG.expandAreas(r2);
    folded += r2.layers.areas.length;
    const badL = PG.AREA_LAYERS.filter(k => canon(X.layers[k]) !== canon(r1.layers[k]));
    check(!badL.length, '20a ' + name + ': its ' + r2.layers.areas.length + ' areas expand to the v1 layers it had', badL.join(', '));
    check(PG.AREA_LAYERS.every(k => !(r2.layers[k] || []).some(e => PG.areaFoldable(k, e))), '20a ' + name + ': nothing foldable is left');
    check(PG.LAYERS.filter(k => k !== 'areas' && PG.AREA_LAYERS.indexOf(k) < 0).every(k => canon(r2.layers[k]) === canon(r1.layers[k])), '20a ' + name + ': the other layers are untouched');
    check(JSON.stringify(PG.unwrap(PG.envelope('t', r2)).rec) === JSON.stringify(r2) && PG.issues(r2).length === PG.issues(r1).length, '20a ' + name + ': the v2 record round-trips, with the issues it had', PG.issues(r2)[0]);
    // 20b the same world, on the synthetic ground (the anchors' worlds are the fixtures' rows above; this is the record's rule)
    const W = synth, A = PG.compose(JSON.parse(JSON.stringify(raw.premises || raw)), W, { catalogue: CAT }), B = PG.compose(r2, W, { catalogue: CAT });
    const ex = A.extent; let diff = 0, first = null;
    for (let i = 0; i < 1500; i++) {
      const lx = ex.x0 - 15 + (ex.x1 - ex.x0 + 30) * ((i * 0.6180339) % 1), lz = ex.z0 - 15 + (ex.z1 - ex.z0 + 30) * ((i * 0.3819660 + 0.11) % 1), w = A.frame.toWorld(lx, lz);
      const qa = A.coverAt ? A.coverAt(w[0], w[1]) : null, qb = B.coverAt ? B.coverAt(w[0], w[1]) : null;
      const a = [A.terrainAt(w[0], w[1]), A.surfaceAt(w[0], w[1]), A.excludeAt(w[0], w[1], 'trees'), A.excludeAt(w[0], w[1], 'plots'), A.vegAt ? A.vegAt(w[0], w[1]) : 0, JSON.stringify(qa)];
      const b = [B.terrainAt(w[0], w[1]), B.surfaceAt(w[0], w[1]), B.excludeAt(w[0], w[1], 'trees'), B.excludeAt(w[0], w[1], 'plots'), B.vegAt ? B.vegAt(w[0], w[1]) : 0, JSON.stringify(qb)];
      if (a.some((v, k) => !Object.is(v, b[k]))) { diff++; if (!first) first = lx.toFixed(1) + ',' + lz.toFixed(1) + ' ' + JSON.stringify(a) + ' vs ' + JSON.stringify(b); }
    }
    const ids = (O, k) => (O[k] || []).map(e => e.id).join(',');
    check(diff === 0, '20b ' + name + ': the migrated record composes to the same ground, wheels, excludes, cover and vegetation (1500 samples)', first);
    check(canon(A.records.plots.map(p => [p.id, p.poly])) === canon(B.records.plots.map(p => [p.id, p.poly])) && A.records.items.length === B.records.items.length && A.records.trees.length === B.records.trees.length, '20b ' + name + ': the same plots, items and trees');
    check(canon(A.treeExRegions().map(q => q.k)) === canon(B.treeExRegions().map(q => q.k)) && ids(A, 'pavePolys') === ids(B, 'pavePolys') && ids(A, 'materials') === ids(B, 'materials') && ids(A, 'ttypes') === ids(B, 'ttypes') && A.n === B.n, '20b ' + name + ': the same tree regions, pavements, materials, stamps and modifiers');
    check(canon(PG.AREA_LAYERS.map(k => A.rec.layers[k])) === canon(PG.AREA_LAYERS.map(k => B.rec.layers[k])), '20b ' + name + ': the composed record (O.rec) is the v1 one');
  }
  check(folded > 60, '20a the fixtures fold into areas (' + folded + ')');
  // 20c the places: Jolene's Metlakatla (mk_) cut and restored, areas included
  {
    const J = PG.unwrap(fs.readFileSync(path.join(TOOLS, 'fixtures', 'island_jolene.json'), 'utf8')).rec;
    const D = PG.dropPlaces(J, ['mk_']), back = PG.restorePlaces(D.rec, D.cut);
    check(J.layers.areas.some(a => /^mk_/.test(a.id)) && !D.rec.layers.areas.some(a => /^mk_/.test(a.id)) && (D.cut.areas || []).length > 0, '20c a place switched off takes its areas with it', (D.cut.areas || []).length + ' cut');
    check(canon(PG.expandAreas(back).layers) === canon(PG.expandAreas(J).layers) || canon(back.layers.areas.map(a => a.id).sort()) === canon(J.layers.areas.map(a => a.id).sort()), '20c ...and restored');
  }
  // 20d a fold into a record that has areas keeps every layer's order
  {
    const O0 = PG.unwrap(fs.readFileSync(path.join(TOOLS, 'fixtures', 'premises_v1_official.json'), 'utf8')).rec;
    const a0 = O0.layers.areas[0], mix = JSON.parse(JSON.stringify(O0));
    mix.layers.surface.push({ id: 'y_hand', poly: [[500, 500], [540, 500], [540, 530]], surface: PG.SURFACE.SAND });
    mix.layers.exclude.unshift({ id: 'x_hand', poly: a0.poly.map(q => q.slice()), what: ['trees', 'plots'] });
    mix.layers.terrain.push({ id: 't_hand', kind: 'raise', poly: [[500, 500], [540, 500], [540, 530]], dh: 1, falloff: 5 });
    const before = PG.expandAreas(mix), n = PG.foldAreas(mix), after = PG.expandAreas(mix);
    check(n === 2 && PG.AREA_LAYERS.every(k => canon(before.layers[k]) === canon(after.layers[k])), '20d a fold into a record with areas keeps every layer\'s order', n + ' folded');
  }
  // 20e a new area: after every v1 entry of its layer (it wins its priority); explicit wheels beat a round draw's
  {
    const sq = (cx, cz, h) => [[cx - h, cz - h], [cx + h, cz - h], [cx + h, cz + h], [cx - h, cz + h]];
    const r = PG.normalise({ layers: { surface: [{ id: 'y1', poly: sq(0, 0, 50), surface: PG.SURFACE.GRAVEL }],
      areas: [{ id: 'a1', poly: sq(0, 0, 20), props: { wheels: { surface: PG.SURFACE.PAVED } } }, { id: 'a2', round: { c: [200, 0], r: 15 }, props: { wheels: { surface: PG.SURFACE.GRAVEL }, draw: { look: 'concrete', z: 0 } } },
              { id: 'a3', round: { c: [300, 0], r: 15 }, props: { draw: { look: 'concrete', z: 0 } } }] } });
    const O = PG.compose(r, synth), at = (x, z) => { const w = O.frame.toWorld(x, z); return O.surfaceAt(w[0], w[1]); };
    check(at(0, 0) === PG.SURFACE.PAVED && at(40, 0) === PG.SURFACE.GRAVEL, '20e a new area composes after the v1 entries (paved over the gravel at the same priority)');
    check(at(200, 0) === PG.SURFACE.GRAVEL && at(300, 0) === PG.SURFACE.PAVED, '20e a round draw\'s wheels are its look\'s unless the area says its own');
    check(O.rec.layers.surface.map(e => e.id).join() === 'y1,a1~w,a2~w' && O.rec.layers.material.map(e => e.id).join() === 'a2~d,a3~d' && O.rec.layers.material[1].round && !O.rec.layers.material[0].round, '20e the v1 entries an area expands into: ids <area>~w / ~d, the round kept only where it says the wheels', O.rec.layers.material.map(e => e.id + (e.round ? '(r)' : '')).join());
  }
  // 20f the shapes and the ids
  {
    const R0 = PG.rectPoly({ c: [10, 20], hw: 30, hd: 10, yaw: 0, radius: 0 }), R1 = PG.rectPoly({ c: [0, 0], hw: 30, hd: 10, yaw: 0.5, radius: 4 });
    check(R0.length === 4 && PG.polyCCW(R0) && R0.some(q => q[0] === 40 && q[1] === 30) && R1.length === 28 && PG.polyCCW(R1) && PG.polySimple(R1), '20f a rectangle: square (4 corners) or rounded (7 a corner), counter-clockwise, simple');
    const n = PG.normalise({ layers: { areas: [{ id: 'a1', rect: { c: [0, 0], hw: 5, hd: 3, yaw: 0, radius: 0 }, poly: [[0, 0], [1, 0], [0, 1]] }, { id: 'a2', round: { c: [0, 0], r: 9 } }] } });
    check(n.layers.areas[0].poly.length === 4 && n.layers.areas[1].poly.length === 48 && n.layers.areas[0].props && typeof n.layers.areas[0].props === 'object', '20f normalise writes a rectangle\'s and a round\'s polygon, and gives every area its props');
    const J = PG.unwrap(fs.readFileSync(path.join(TOOLS, 'fixtures', 'premises_v1_official.json'), 'utf8')).rec;
    const used = new Set(); for (const a of J.layers.areas) for (const q of PG.areaEntries(a)) used.add(q.entry.id);
    check(['surface', 'material', 'terrain', 'exclude', 'ttype', 'areas'].every(k => !used.has(PG.newId(J, k))), '20f a new id never takes an area\'s (the migrated areas keep their entries\' ids)');
  }
  // 20g issues
  {
    const bad = PG.normalise({ layers: { areas: [{ id: 'a1', poly: [[0, 0], [20, 0], [20, 20]], props: { glow: {} } }, { id: 'a2', poly: [[0, 0], [20, 0], [20, 20]], props: { marks: { kind: 'parking' }, draw: { set: 'cracked' } } },
      { id: 'a3', poly: [[0, 0], [20, 0], [20, 20]], props: { exclude: { what: ['cows'] } } }, { id: 'a4', poly: [[0, 0], [20, 0], [20, 20]], props: { terraform: { kind: 'dig', falloff: 3 } } }] } });
    const iss = PG.issues(bad);
    check(['a1: no property', 'a2: marks are paint on a pavement', 'a3: exclude is a list', 'a4: terraform is'].every(t => iss.some(m => m.indexOf(t) >= 0)), '20g refused: an unknown property, marks off a pavement, a bad exclusion, a bad terraform', iss.join(' | '));
    const good = PG.normalise({ layers: { areas: [{ id: 'a1', poly: [[0, 0], [40, 0], [40, 20], [0, 20]], props: { wheels: { surface: 5 }, draw: { look: 'concrete', z: 0 }, marks: { kind: 'parking' }, exclude: { what: ['trees', 'plots'] }, terraform: { kind: 'flatten', level: 0, falloff: 8 }, cover: { code: 15 } } }] } });
    check(PG.issues(good).length === 0, '20g an area with every property raises no issue', PG.issues(good)[0]);
  }
  // 20h THE MARKS
  {
    const boxes = R => { const out = []; for (const r of R.rects) { if (r[5] > 0) { const ax = r[6], st = ax === 0 ? r[0] : r[2], en = ax === 0 ? r[1] : r[3]; for (let p = st; p + r[7] <= en + 1e-6; p += r[5]) out.push(ax === 0 ? [p, p + r[7], r[2], r[3]] : [r[0], r[1], p, p + r[7]]); } else out.push(r.slice(0, 4)); } return out; };
    const inside = (poly, R, fr, ins) => { const c = Math.cos(fr.yaw || 0), s = Math.sin(fr.yaw || 0), bb = PG.polyBBox(poly), cx = (bb.x0 + bb.x1) / 2, cz = (bb.z0 + bb.z1) / 2; let worst = Infinity;
      for (const b of boxes(R)) for (const [u, v] of [[b[0], b[2]], [b[1], b[2]], [b[0], b[3]], [b[1], b[3]]]) { const x = cx + u * c - v * s, z = cz + u * s + v * c; worst = Math.min(worst, -PG.sdPoly(poly, x, z)); }
      return worst; };
    const lot = PG.rectPoly({ c: [0, 0], hw: 30, hd: 15, yaw: 0, radius: 0 });
    const P1 = PG.areaMarks(lot, { kind: 'parking' }, { yaw: 0 });
    const D = PG.MARK_DEF.parking;
    check(P1.n === 63 && P1.rects.length === 6 && P1.rects.every(r => r[4] === 0) && P1.rects[0][5] === D.bay && P1.rects[0][6] === 0, '20h parking on a 60 x 30 lot: three rows of 21 bays (two across an aisle, one back to back), two marks a row (the separators a rule, the back line)', P1.n + ' bays, ' + P1.rects.length + ' marks');
    check(inside(lot, P1, { yaw: 0 }) >= D.inset - 1e-6, '20h every parking mark inside the lot by its inset', inside(lot, P1, { yaw: 0 }).toFixed(3) + ' m');
    const turned = PG.rectPoly({ c: [100, 50], hw: 25, hd: 12, yaw: 0.7, radius: 3 }), P2 = PG.areaMarks(turned, { kind: 'parking', colour: 'yellow', bay: 2.5 }, { yaw: 0.7 });
    check(P2.n >= 15 && P2.rects.every(r => r[4] === 1) && inside(turned, P2, { yaw: 0.7 }) >= D.inset - 1e-6, '20h a turned, rounded lot: its bays in its frame, yellow, inside (the end bays off its rounded corners)', P2.n + ' bays, ' + inside(turned, P2, { yaw: 0.7 }).toFixed(2) + ' m');
    const quay = [[0, 0], [60, 0], [60, 14], [0, 14]], wet = i => (i === 2 ? 1 : 0);   // edge 2 ([60,14] -> [0,14]) meets the water
    const P3 = PG.areaMarks(quay, { kind: 'dock' }, { yaw: 0 }, wet);
    const line = P3.rects[0], bol = P3.rects[1];
    check(P3.edge === 2 && line && line[2] > 13.1 - 7 && line[3] < 14 - 7 && bol && bol[5] === PG.MARK_DEF.dock.bollard && bol[3] < line[2] && P3.issues.length === 0 && inside(quay, P3, { yaw: 0 }) >= PG.MARK_DEF.dock.inset - 1e-6, '20h a dock: the quay\'s line along the water\'s edge (inset), the bollards inside it every 9 m', JSON.stringify(P3.rects));
    const P3b = PG.areaMarks(quay, { kind: 'dock' }, { yaw: 0 }, () => 0);
    check(P3b.issues.some(t => /no edge of this shape meets the water/.test(t)) && P3b.edge === 0, '20h a dock with no water says so (its longest edge is the quay)');
    const P3c = PG.areaMarks(quay, { kind: 'dock' }, { yaw: 0.4 }, wet);
    check(P3c.segs.length === 1 && P3c.issues.some(t => /turn the pavement/.test(t)), '20h a dock not square to its pavement: the line as a segment, and the advice');
    const P4 = PG.areaMarks(lot, { kind: 'hatch' }, { yaw: 0 });
    check(P4.n > 30 && P4.rects.length === 5 && inside(lot, P4, { yaw: 0 }) >= PG.MARK_DEF.hatch.inset - 1e-6, '20h keep-clear: the bars a rule inside the largest box, its outline', P4.n + ' bars');
    const tiny = PG.areaMarks([[0, 0], [3, 0], [3, 2], [0, 2]], { kind: 'parking' }, { yaw: 0 });
    check(!tiny.rects.length && tiny.issues.some(t => /too small/.test(t)), '20h a shape too small for its marks says so');
    const big = PG.areaMarks(PG.rectPoly({ c: [0, 0], hw: 40, hd: 200, yaw: 0, radius: 0 }), { kind: 'parking' }, { yaw: 0 });
    check(big.rects.length <= 40 && big.issues.some(t => /more rows/.test(t)), '20h a lot past the pavement\'s 40 marks is capped, and says so', big.rects.length + ' marks');
    // compose finds the dock's water: the ground under the water past the quay's north edge
    const wW = { id: 'wet', terrainH: (x, z) => (z < 0 ? 2 : -3), waterH: () => 0 };
    const rd = PG.normalise({ layers: { areas: [{ id: 'a1', poly: [[0, -20], [40, -20], [40, -1], [0, -1]], props: { wheels: { surface: 5 }, draw: { look: 'concrete', z: 0 }, marks: { kind: 'dock' } } }] } });
    const Od = PG.compose(rd, wW), pp = (Od.pavePolys || []).find(q => q.id === 'a1~d');
    check(pp && pp.marks && pp.marks.kind === 'dock' && pp.waterEdges && pp.waterEdges[2] === 1 && pp.waterEdges[0] === 0 && pp.waterEdges[1] === 0, '20h compose finds the quay: the one edge whose outside is water', JSON.stringify(pp && pp.waterEdges));
  }
  // 20i Jolene's shoulder bands: areas that keep the trees out and draw nothing (the user's "gravel" polygons)
  {
    const J = PG.unwrap(fs.readFileSync(path.join(TOOLS, 'fixtures', 'island_jolene.json'), 'utf8')).rec;
    const sh = J.layers.areas.filter(a => /^y_sh/.test(a.id));
    check(sh.length === 4 && sh.every(a => a.props.wheels && a.props.wheels.surface === PG.SURFACE.GRAVEL && !a.props.draw), '20i Jolene\'s four gravel bands are areas with gravel wheels and no draw (the inspector says so)', sh.map(a => a.id).join());
  }
}

// ---------------------------------------------------------------------------
// 21 THE ROAD GRAPH and THE ROAD BED (contract v1.37, G2950-G2954)
{
  // 21a THE ROUTER: graphMake's path is the shortest (Floyd on a random graph of 24 nodes), an edge weighed Infinity is
  //     closed, the components, nodeAt / edgeAt
  {
    let s = 7; const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    const N = 24, ns = [], es = []; for (let i = 0; i < N; i++) ns.push({ id: 'n' + i, x: rnd() * 1000, z: rnd() * 1000 });
    for (let i = 0; i < 60; i++) { const a = Math.floor(rnd() * N), b = Math.floor(rnd() * N); if (a === b) continue; es.push({ id: 'e' + i, a: 'n' + a, b: 'n' + b, len: Math.hypot(ns[a].x - ns[b].x, ns[a].z - ns[b].z), pts: [[ns[a].x, ns[a].z], [ns[b].x, ns[b].z]] }); }
    ns.push({ id: 'lone', x: 5000, z: 5000 });
    const G = PG.graphMake(ns, es), D = {}; for (const a of ns) { D[a.id] = {}; for (const b of ns) D[a.id][b.id] = a === b ? 0 : Infinity; }
    for (const e of G.edges) { D[e.a][e.b] = Math.min(D[e.a][e.b], e.len); D[e.b][e.a] = D[e.a][e.b]; }
    for (const k of ns) for (const i of ns) for (const j of ns) if (D[i.id][k.id] + D[k.id][j.id] < D[i.id][j.id]) D[i.id][j.id] = D[i.id][k.id] + D[k.id][j.id];
    let bad = 0, tried = 0; for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) { const p = G.path('n' + i, 'n' + j); tried++; if (!isFinite(D['n' + i]['n' + j]) ? p !== null : !(p && Math.abs(p.len - D['n' + i]['n' + j]) < 1e-6 && p.nodes[0] === 'n' + i && p.nodes[p.nodes.length - 1] === 'n' + j)) bad++; }
    check(bad === 0, '21a the router\'s path is the shortest between every pair (' + tried + ' pairs against Floyd)', bad + ' wrong');
    const p0 = G.path('n0', 'n5'), e0 = p0 && p0.edges[0], p1 = e0 ? G.path('n0', 'n5', e => (e.id === e0 ? Infinity : e.len)) : null;
    check(p0 && (!p1 || p1.edges.indexOf(e0) < 0), '21a an edge weighed Infinity is closed');
    check(G.path('n0', 'lone') === null && G.components().some(c => c.length === 1 && c[0] === 'lone'), '21a a node on nothing is its own component, no path to it');
    const ne = G.nodeAt(ns[3].x + 1, ns[3].z, 5), ee = G.edgeAt((es[0].pts[0][0] + es[0].pts[1][0]) / 2, (es[0].pts[0][1] + es[0].pts[1][1]) / 2, 1);
    check(ne && ne.id === 'n3' && ee && ee.d < 1e-6, '21a nodeAt and edgeAt find the node and the edge under a point');
    const PT = PG.graphOfPattern({ nodes: [{ id: 'hold', x: 0, z: 0 }, { id: 'tw', x: 30, z: 0 }, { id: 'stand', x: 30, z: 40 }], arcs: [['hold', 'tw'], ['tw', 'stand']] });
    const pp = PT.path('stand', 'hold');
    check(pp && pp.nodes.join('>') === 'stand>tw>hold' && Math.abs(pp.len - 70) < 1e-9, '21a a taxi pattern routes through the same router', pp && pp.nodes.join('>'));
  }
  // 21b THE JUNCTION'S LEVEL: a road through another at a shared waypoint does not bump it - the first road's centre over
  //     the crossing is as it was but for the level patch across the second's width, and the second meets it at its
  //     height (2 cm); without the shared id
  //     (the control) the second road's own grade there differs
  {
    const base = () => { const r = PG.normalise(PG.DEF()); r.frame.extent = { x0: -400, z0: -400, x1: 400, z1: 400 }; return r; };
    const A = { id: 'ra', pts: [[-200, 10], [0, 10], [200, 10]], w: 5, cls: 'paved', graded: true, falloff: 8 };
    const B = { id: 'rb', pts: [[0, -190], [0, 10], [0, 210]], w: 4, cls: 'gravel', graded: true, falloff: 8, grade: 0.03 };
    const mk = (ids, withB) => { const r = base(); r.layers.roads.push(Object.assign({}, A, ids ? { nodes: [null, 'jx', null] } : {})); if (withB) r.layers.roads.push(Object.assign({}, B, ids ? { nodes: [null, 'jx', null] } : {})); return PG.compose(r, synth); };
    const O0 = mk(true, false), O1 = mk(true, true), Oc = mk(false, true), F = O0.frame;
    const hA = (O, s) => { const w = F.toWorld(s, 10); return O.terrainAt(w[0], w[1]); }, hB = (O, s) => { const w = F.toWorld(0, s); return O.terrainAt(w[0], w[1]); };
    let dJ = 0, dC = 0; for (let s = -5; s <= 5; s += 0.5) { dJ = Math.max(dJ, Math.abs(hA(O1, s) - hA(O0, s))); dC = Math.max(dC, Math.abs(hA(Oc, s) - hA(O0, s))); }
    // (the crossing road is graded level across its own width: on the through road's 8 % slope that is a level patch of
    //  its width and falloff - under 35 cm here - where the same road without the junction cut it by metres)
    check(dJ <= 0.35, '21b a road through a junction no longer cuts the through road: its centre within ' + (dJ * 100).toFixed(1) + ' cm of itself over 5 m either side (' + (dC * 100).toFixed(1) + ' cm without the shared id)');
    check(Math.abs(hB(O1, 10) - hA(O0, 0)) <= 0.02, '21b ...and meets it at its height', (hB(O1, 10) - hA(O0, 0)).toFixed(3));
    check(dC > 0.05, '21b (the control: without the junction the second road bumps the first)', (dC * 100).toFixed(1) + ' cm');
    const R2 = base(); R2.layers.roads.push(Object.assign({}, A)); const before = JSON.stringify(PG.compose(R2, synth).roads.map(r => r.pts));
    check(PG.compose(R2, synth).roads.length === 1 && before === JSON.stringify(PG.compose(R2, synth).roads.map(r => r.pts)), '21b a road without junction ids composes as before');
    const R3 = base(); R3.layers.roads.push(Object.assign({}, A, { nodes: [null, 'jx', null] }), Object.assign({}, B, { pts: [[0, -190], [3, 10], [0, 210]], nodes: [null, 'jx', null] }));
    check(PG.issues(R3).some(t => /jx/.test(t)), '21b a junction whose waypoints are apart is an issue', PG.issues(R3).filter(t => /jx/.test(t)).join('; '));
  }
  // 21c THE ROAD BED: over a bumpy ground a road without a bed is under it here and there across its width; with one,
  //     its surface is over the ground (the ground without the road) at its centre and both edges, its grade within the
  //     bed's; a shipped record carries no bed
  {
    const bumpy = { id: 'bumpy', terrainH: (x, z) => 2 * Math.sin(x / 23) + 1.3 * Math.sin(z / 4.1 + x / 17) + 0.8 * Math.cos(x / 5.3), waterH: () => -40 };
    const base = () => { const r = PG.normalise(PG.DEF()); r.frame.extent = { x0: -400, z0: -400, x1: 400, z1: 400 }; return r; };
    const road = bed => Object.assign({ id: 'rd', pts: [[-250, 0], [-60, 30], [80, -20], [250, 10]], w: 4, cls: 'gravel', graded: true, falloff: 6, curve: 'spline' }, bed ? { bed } : {});
    const Og = PG.compose(base(), bumpy);
    const under = O => { const R = O.roads[0], L = R.pts; let k = 0, m = 0, gmax = 0, hp = null; for (let i = 1; i + 1 < L.length; i++) { const a = L[i - 1], b = L[i + 1], dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz) || 1; if (Math.abs(L[i][0]) > 200) continue;
      for (const sd of [-2, 0, 2]) { const w = O.frame.toWorld(L[i][0] - dz / l * sd, L[i][1] + dx / l * sd); m++; if (O.terrainAt(w[0], w[1]) < Og.terrainAt(w[0], w[1]) - 0.02) k++; }
      const wc = O.frame.toWorld(L[i][0], L[i][1]), h = O.terrainAt(wc[0], wc[1]); if (hp) { const ds = Math.hypot(wc[0] - hp[0], wc[1] - hp[1]); if (ds > 3) { gmax = Math.max(gmax, Math.abs(h - hp[2]) / ds); hp = [wc[0], wc[1], h]; } } else hp = [wc[0], wc[1], h]; }
      return { k, m, gmax }; };
    const r0 = base(); r0.layers.roads.push(road(null)); const U0 = under(PG.compose(r0, bumpy));
    const r1 = base(); r1.layers.roads.push(road(true)); const U1 = under(PG.compose(r1, bumpy));
    check(U0.k > U0.m * 0.05, '21c (the control: a road without a bed is under the ground in ' + U0.k + ' of ' + U0.m + ' samples across its width)');
    check(U1.k <= Math.ceil(U1.m * 0.005), '21c with its bed, over the ground across its width (' + U1.k + ' of ' + U1.m + ' under)');
    check(U1.gmax <= PG.BED_DEF.grade + 0.03, '21c ...its grade within the bed\'s (' + (U1.gmax * 100).toFixed(1) + ' %)');
    const r2 = base(); r2.layers.roads.push(road({ on: false, bank: 20 }));
    check(JSON.stringify(PG.compose(r2, bumpy).terrainAt(10, 3)) === JSON.stringify(PG.compose(r0, bumpy).terrainAt(10, 3)) && PG.bedOf(r2.layers.roads[0]) === null, '21c a bed `on: false` is no bed');
    const J = PG.unwrap(fs.readFileSync(path.join(TOOLS, 'fixtures', 'island_jolene.json'), 'utf8')).rec;
    check(J.layers.roads.every(r => !r.bed), '21c no shipped road carries a bed (the user turns it on)');
  }
  // 21d METLAKATLA ONE GRID (G2954): its streets one component of shared-waypoint junctions; its connection points named;
  //     a path from one connection point to another runs on its streets; it is not joined to the island's other roads
  {
    const J = PG.unwrap(fs.readFileSync(path.join(TOOLS, 'fixtures', 'island_jolene.json'), 'utf8')).rec;
    const G = PG.compose(J, synth, { raster: false }).roadGraph(), mk = id => /^mk_/.test(id);
    const comps = G.components().filter(c => c.some(id => G.node(id).roads.some(mk)));
    const conn = G.nodes.filter(n => n.conn && n.roads.some(mk));
    // (the town's grid: its streets and its three ways out; six streets the data draws apart - 17 to 130 m off the grid, the
    //  user's to join - are their own components, listed by tools/road_review.js)
    const grid = comps[0] || [], roadsOf = c => new Set([].concat(...c.map(id => G.node(id).roads)));
    check(roadsOf(grid).size >= 56, '21d Metlakatla\'s town grid is one graph (' + roadsOf(grid).size + ' streets, ' + G.nodes.filter(n => n.roads.length > 1 && n.roads.some(mk)).length + ' junctions; ' + (comps.length - 1) + ' streets drawn apart)');
    check(conn.length === 3 && conn.every(n => n.name && grid.indexOf(n.id) >= 0), '21d its three ways out are named connection points on the grid (' + conn.map(n => n.name).join(', ') + ')');
    const pc = conn.length >= 2 ? G.path(conn[0].id, conn[conn.length - 1].id) : null;
    check(pc && pc.edges.every(e => mk(G.edge(e).road)), '21d a path between two of them runs on its streets', pc && (pc.edges.length + ' spans, ' + pc.len.toFixed(0) + ' m'));
    check(comps.every(c => c.every(id => G.node(id).roads.every(mk))), '21d ...and it is joined to no road outside it (the user traces those)');
    // the town's 391 plots (on flat ground) as they were before the junctions (the fixture of train 44.4, 11 Oct): a waypoint
    // inserted on a straight span is no corner - the same plots, seed for seed (a later edit of Metlakatla's zones or
    // streets moves this hash: re-take it from tools/road_review.js's record then)
    const flat = { id: 'flat', terrainH: () => 0, waterH: () => -100 };
    const kp = JSON.stringify((PG.compose(J, flat, { raster: false }).records.plots || []).filter(p => /^mk_/.test(String(p.zone))).map(p => [p.zone, p.road, p.seed, p.quad || p.poly]));
    const hp = require('crypto').createHash('sha256').update(kp).digest('hex').slice(0, 16);
    check(hp === '010ca477a8e4145c', '21d the junctions sow the same ' + JSON.parse(kp).length + ' plots as the town had without them', hp);
    check(!PG.issues(J).some(t => /junction|roadside/.test(t)), '21d no junction issue', PG.issues(J).filter(t => /junction|roadside/.test(t)).slice(0, 3).join('; '));
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
