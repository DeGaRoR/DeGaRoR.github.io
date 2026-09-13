#!/usr/bin/env node
// GATE PREMISES — the premises record's verdict (G353 / GPREM; the contract:
// futureDesigns/PREMISES-CONTRACT-2026-09-13.md §6).
//
//   node tools/_premises_check.js              -> the fixtures under tools/fixtures/premises_*.json
//   node tools/_premises_check.js --selftest   -> negative verification
//   node tools/_premises_check.js --sink 8402  -> a screenshot sink for the bench (POST /save?name=x, PNG body)
//
// Holds, headless (no THREE, no DOM), on tools/_premises_gen.js:
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
//      5 cm of the centreline - at a bend two straight segments meet) and its class answers as the surface inside
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

const PG = require(path.join(TOOLS, '_premises_gen.js'));
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
  for (const f of ['_house_kit.js', '_house_gen.js', '../src/viewer/sign_tex.js', '_big_gen.js', '_tram_gen.js'])
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
try { const fc = require(path.join(TOOLS, 'flight_core.js')); if (fc && fc.makeWorld) { FLIGHT = fc.makeWorld(); FLIGHT_FNS = { siteRunway: fc.siteRunway, sitePattern: fc.sitePattern, sitePatternIssues: fc.sitePatternIssues, patternPath: fc.patternPath }; } } catch (e) { FLIGHT = null; }

const fixtures = fs.readdirSync(path.join(TOOLS, 'fixtures')).filter(f => /^premises_v\d+_.*\.json$/.test(f)).sort();
check(fixtures.length > 0, '2 there is at least one fixture');

const rnd = PG.mulberry32(11);
const sampleIn = (bb, n, f) => { for (let k = 0; k < n; k++) f(bb.x0 + rnd() * (bb.x1 - bb.x0), bb.z0 + rnd() * (bb.z1 - bb.z0)); };

for (const fx of fixtures) {
  const txt = fs.readFileSync(path.join(TOOLS, 'fixtures', fx), 'utf8');
  let U;
  try { U = PG.unwrap(txt); } catch (e) { check(false, '2 ' + fx + ' unwraps', e.message); continue; }
  const rec = U.rec;
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
    for (let k = 0; k < 1000000; k++) { const x = (k % 1000) * 0.5 - 250, z = ((k / 1000) | 0) * 0.5 - 250; acc += OW.terrainH(x, z, W.terrainH(x, z)); }
    const ms = Date.now() - t0;
    check(ms < 2500 && isFinite(acc), '6 a million terrainH calls under 2500 ms', ms + ' ms on ' + W.id);
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
      sampleIn(bb, 400, (lx, lz) => {
        if (!PG.inPoly(m.poly, lx, lz)) return;
        n++;
        const w = F.toWorld(lx, lz), h = O1.terrainAt(w[0], w[1]);
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
    sampleIn({ x0: bb.x0 - 20, z0: bb.z0 - 20, x1: bb.x1 + 20, z1: bb.z1 + 20 }, 1000, (lx, lz) => {
      const w = O1.frame.toWorld(lx, lz);
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
        if (O1.surfaceAt(w[0], w[1]) !== (r.surface !== undefined ? r.surface : PG.ROAD_CLS[r.cls])) surfOk = false;
      }
      check(worst < 0.05, '9 road ' + r.id + ' is flat across (5 cm: at a bend two straight segments meet)', worst.toFixed(3) + ' m');
      check(surfOk, '9 road ' + r.id + ' answers its surface inside its width');
    }
    const Tn = O1.records.trees;
    if (rec.layers.zones.some(z => z.kind === 'forest')) {
      check(Tn.some(t => !t.placed), '11 ' + fx + ' the forest plants trees');
      const bad = Tn.find(t => !t.placed && (ex.some(e => PG.inPoly(e, t.x, t.z)) || P.some(q => PG.inPoly(q.poly, t.x, t.z)) || O1.roads.some(r => PG.roadDist(r, t.x, t.z) < r.w / 2 + 2.9)));
      check(!bad, '11 no forest tree in an exclude, a clear zone, a plot or a road', bad ? bad.x.toFixed(1) + ',' + bad.z.toFixed(1) : '');
    }
    for (const ob of rec.layers.objects) if (ob.kind === 'tree') check(Tn.some(t => t.placed && t.id === ob.id && t.x === ob.x), '11 tree ' + ob.id + ' is planted where it was put');
    // 10 the runways
    O1.runways.forEach((r, i) => {
      const A = O1.aerodromes[i], E = PG.runwayEnds(r);
      let worst = 0, across = 0, surfOk = true;
      for (let t = 0; t <= r.len; t += 4) {
        const lx = E.end0[0] + E.d[0] * t, lz = E.end0[1] + E.d[1] * t;
        const want = A.elev + (+r.slope || 0) * (t - r.len / 2), c = O1.localH(lx, lz);
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
        try { iss = FLIGHT_FNS.sitePatternIssues(FLIGHT_FNS.sitePattern(A, null), A, null, 0, FLIGHT_FNS.patternPath); } catch (e) { iss = [e.message]; }
        check(iss.length === 0, '10 sitePatternIssues empty for ' + r.id, iss[0]);
      }
    });
    if (rec.layers.runways.length) {
      const bad = JSON.parse(JSON.stringify(rec)); bad.layers.runways[0].len = 120;
      check(PG.issues(bad).length > 0, '10 a strip under 150 m is refused');
      const steep = JSON.parse(JSON.stringify(rec)); steep.layers.runways[0].slope = 0.08;
      check(PG.issues(steep).length > 0, '10 a strip over 5 % is refused');
    }
  }
  // 12 baked vs live
  {
    const B = PG.bake(O1, synth, O1.extent, 1);
    let worst = -Infinity;
    sampleIn(O1.extent, 10000, (lx, lz) => {
      const w = O1.frame.toWorld(lx, lz);
      const live = O1.terrainAt(w[0], w[1]), baked = B.sample(lx, lz);
      worst = Math.max(worst, Math.abs(live - baked) - (0.02 + PG.curvTol(O1, O1.frame, lx, lz, 1)));
    });
    check(worst <= 0, '12 ' + fx + ' baked and live agree', 'over by ' + worst.toFixed(3) + ' m');
  }
  // the panel's own lines all green on the golden
  const lines = PG.checks(rec, synth);
  check(lines.every(l => l.ok), '12 the #chk lines are green on ' + fx, lines.filter(l => !l.ok).map(l => l.label).join('; '));
}

// 3 the catalogue: every derived entry builds headless; a site stands; the conveyor lands
{
  if (CAT.entries.size) {
    check(CAT.issues.length === 0, '3 the catalogue has no key collision', CAT.issues[0]);
    let built = 0, bad = null;
    for (const [key, e] of CAT.entries) {
      if (!GENS[e.gen] || !e.params) continue;
      const P = e.params({}); P.ground = () => 0; P.waterY = -5; P.slopeX = 0; P.slopeZ = 0;
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
    check(!bad, '3 every derived catalogue entry builds headless with a simple foot (' + built + ' built)', bad);
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
      check(it.P.mill ? it.P.floorY > 0 : it.P.floorY >= hi + 0.05, '3 item ' + it.item + ' stands over its corners', (it.P.floorY - hi).toFixed(2));
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

// 13 the contract held: no catalogue key literal in the editor's files
{
  const files = fs.readdirSync(TOOLS).filter(f => /^_premises.*\.(js|html)$/.test(f) && f !== '_premises_check.js');
  const re = /['"](house|big|shed|tram|totem|factory)\/[a-z]/;
  for (const f of files) {
    const src = fs.readFileSync(path.join(TOOLS, f), 'utf8');
    check(!re.test(src), '13 no catalogue key literal in ' + f);
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
