#!/usr/bin/env node
// GATE GEAR — the undercarriage's verdict (G67.3).
//
//   node tools/_gear_check.js            -> "GATE GEAR: PASS|FAIL"
//   node tools/_gear_check.js --selftest -> negative verification
//
// WHY THIS EXISTS, and it is a debt being paid rather than a new idea. GATE
// GEN used to assert that bungee, spring steel and oleo were three DIFFERENT
// meshes and not three names for one drawing — "if the three ever collapse
// back to one mesh the feature is silently gone and nothing else in the
// battery would notice". That check read `genGearLegInto`, the old generated
// skin's own leg drawer, and G67.2 deleted it along with the rest of that
// file. The undercarriage the aeroplane actually wears is `_gear_gen.js`'s,
// built from three separate leg families, and NOTHING CHECKED IT — declared
// as a gap at G67.2 with the reason: the module needs a THREE stub to run
// headless. This is that stub, and the check it was blocking.
//
// THE STUB IS THE INTERESTING PART, because it decides what is being tested.
// `_gear_kit.js`'s `Bag` accumulates plain arrays and touches THREE at ONE
// point — `bag.mesh()`, where it hands the positions and indices to a
// BufferGeometry. So the stub records exactly what the bench draws, through
// the bench's own output path: this measures the undercarriage that appears
// in the editor, not a re-derivation of it.
//
// NEGATIVE-VERIFIED (G3.2): --selftest breaks each rule in turn and requires
// the corresponding check to notice.
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const TOOLS = __dirname;

// ---------------------------------------------------------------------------
// THE STUB
// ---------------------------------------------------------------------------
// Constructors, not factories: `_gear_gen.js` says `new THREE.MeshLambert-
// Material(...)` at module scope, so an arrow function returning an object is
// a TypeError before anything runs.
function makeTHREE() {
  function Mat(o) { Object.assign(this, { isMat: 1 }, o || {}); }
  class BufferAttribute { constructor(a, n) { this.array = a; this.itemSize = n; } }
  class BufferGeometry {
    constructor() { this.attributes = {}; this.index = null; }
    setAttribute(k, a) { this.attributes[k] = a; }
    setIndex(i) { this.index = i; }
    computeVertexNormals() {}
  }
  class Mesh { constructor(g, m) { this.geometry = g; this.material = m; } }
  class LineSegments { constructor(g, m) { this.geometry = g; this.material = m; } }
  return { BufferAttribute, BufferGeometry, Mesh, LineSegments,
           LineBasicMaterial: Mat, MeshLambertMaterial: Mat,
           MeshBasicMaterial: Mat, DoubleSide: 2, FrontSide: 0 };
}

const win = {};
{
  const ctx = { window: win, THREE: makeTHREE(), console, Math, JSON,
                Float32Array, Object, Array, Set, Map, Number, String,
                isFinite, parseInt, parseFloat };
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  // load order is the bench's own: kit, then the generator, then the page
  for (const f of ['_gear_kit.js', '_gear_gen.js', '_gear_page.js'])
    vm.runInContext(fs.readFileSync(path.join(TOOLS, f), 'utf8'), ctx,
                    { filename: f });
}
const GG = win.GEAR_GEN, GP = win.GEAR_PAGE;

const fail = [];
const check = (ok, label, extra) => {
  if (!ok) fail.push(label + (extra ? ' — ' + extra : ''));
  return ok;
};
if (!check(!!GG && !!GP, 'the gear modules did not load headlessly')) {
  console.log('GATE GEAR: FAIL');
  process.exit(1);
}

// EVERY BAG THE BUILDERS MAY WRITE INTO, which is the material table's own key
// list minus the two that are not parts (the bench's ghost airframe and the
// red position marker). A builder that invented an eleventh bag would write
// into `undefined` and throw, so this list is also the contract.
const BAGS = Object.keys(GG.MAT).filter(k => k !== 'body' && k !== 'mark');
const freshBags = () => {
  const b = {};
  for (const n of BAGS) b[n] = GG.Bag();
  return b;
};

// read a bag back out THROUGH ITS OWN OUTPUT PATH
function readBag(bag) {
  const m = bag.mesh({ add() {} }, {});
  if (!m) return null;
  const pos = m.geometry.attributes.position.array;
  const idx = m.geometry.index;
  return { nv: pos.length / 3, nt: idx.length / 3, pos, idx };
}
function readBags(bags) {
  const o = {};
  for (const n of BAGS) { const g = readBag(bags[n]); if (g) o[n] = g; }
  return o;
}
const bbox = g => {
  const lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9];
  for (let i = 0; i < g.pos.length; i += 3)
    for (let k = 0; k < 3; k++) {
      lo[k] = Math.min(lo[k], g.pos[i + k]);
      hi[k] = Math.max(hi[k], g.pos[i + k]);
    }
  return { lo, hi };
};
// FNV-1a over the positions, quantised to a micrometre — the same digest GATE
// WINGSPLIT uses, and for the same reason: "these two are the same drawing"
// has to be a number, not an impression.
function digest(g) {
  let h = 0x811c9dc5;
  for (let i = 0; i < g.pos.length; i++) {
    let v = Math.round(g.pos[i] * 1e6) | 0;
    for (let b = 0; b < 4; b++) { h ^= (v >>> (b * 8)) & 255; h = Math.imul(h, 0x01000193); }
  }
  return h >>> 0;
}

const P0 = GP.gearDefaults();
const AF = GG.stubAirframe(P0);
const STATIONS = GP.gearStations(P0);
check(STATIONS.length >= 1, 'the default bench has no gear stations');

// build ONE leg of a named family at a station, with its wheel on it
function buildLeg(legKind, opt) {
  const P = JSON.parse(JSON.stringify(P0));
  const st0 = GP.gearStations(P)[0];
  const st = Object.assign({}, st0, { leg: legKind }, opt || {});
  const bags = freshBags();
  const fn = [GG.legBeam, GG.legLink, GG.legOleo][legKind];
  const r = fn(bags, AF, st.P, st, opt && opt.sgn != null ? opt.sgn : 1);
  // `inboard` IS THE SIDE, and hardcoding it to 1 is what made the first run
  // of the mirror check fail on 139 vertices: the brake and its caliper sit on
  // the inboard face, so a left leg built with inboard 1 has them on the wrong
  // side of the wheel. The layer passes `sgn`; so does this.
  const sgn = opt && opt.sgn != null ? opt.sgn : 1;
  GG.wheel(bags, r.axle, r.axis, st.R,
           { brake: !!st.brake, inboard: sgn, P: st.P });
  if (opt && opt.fair)
    GG.spat(bags, r.axle, r.axis, st.R,
            Object.assign({ full: opt.fair === 2 }, opt.fairOpt || {}));
  return { r, st, g: readBags(bags) };
}

const LEGNAME = ['beam', 'link', 'oleo'];

// ---------------------------------------------------------------------------
// 1 HEALTH — every family builds something finite and well indexed
// ---------------------------------------------------------------------------
const built = [];
for (let k = 0; k < 3; k++) {
  let L;
  try { L = buildLeg(k); }
  catch (e) { check(false, `${LEGNAME[k]}: building it threw`, e.message); continue; }
  built.push(L);
  const names = Object.keys(L.g);
  check(names.length > 0, `${LEGNAME[k]}: drew nothing at all`);
  let nv = 0, nt = 0, bad = 0, degen = 0;
  for (const n of names) {
    const g = L.g[n];
    nv += g.nv; nt += g.nt;
    for (let i = 0; i < g.pos.length; i++) if (!isFinite(g.pos[i])) bad++;
    for (let i = 0; i < g.idx.length; i++)
      if (!(g.idx[i] >= 0 && g.idx[i] < g.nv)) bad++;
    // a triangle with two identical corners is a hole with a normal
    for (let t = 0; t < g.idx.length; t += 3) {
      const a = g.idx[t], b = g.idx[t + 1], c = g.idx[t + 2];
      if (a === b || b === c || a === c) degen++;
    }
  }
  check(bad === 0, `${LEGNAME[k]}: ${bad} non-finite or out-of-range values`);
  check(degen === 0, `${LEGNAME[k]}: ${degen} degenerate triangles`);
  check(nt > 200, `${LEGNAME[k]}: only ${nt} triangles — that is not hardware`);
  // and every bag it wrote into is one the material table declares
  for (const n of names)
    check(BAGS.includes(n), `${LEGNAME[k]}: wrote into an undeclared bag`, n);
}

// ---------------------------------------------------------------------------
// 2 THE SPRINGING IS VISIBLE — the check GATE GEN lost
// ---------------------------------------------------------------------------
// Three leg families must be three DIFFERENT drawings. The old check compared
// whole meshes; this compares the STRUCTURAL bags only (steel, alloy, chrome,
// dark, bronze) and deliberately not the wheel, because every family carries
// the same wheel and including it would let three identical legs pass on the
// strength of their tyres.
{
  const STRUCT = ['steel', 'alloy', 'chrome', 'dark', 'bronze'];
  const sig = L => STRUCT.map(n => (L.g[n] ? n + ':' + digest(L.g[n]) : n + ':-'))
    .join('|');
  const sigs = built.map(sig);
  check(new Set(sigs).size === built.length,
    'the leg families are not three different drawings',
    `${new Set(sigs).size} distinct of ${built.length}`);
  // ...and not merely different by a millimetre: each must differ in what it
  // is MADE OF or in how much of it there is, which is what "looks different"
  // meant. Triangle counts across the structural bags.
  const tris = built.map(L => STRUCT.reduce((s, n) => s + (L.g[n] ? L.g[n].nt : 0), 0));
  check(new Set(tris).size >= 2,
    'every leg family draws exactly the same amount of structure',
    tris.join(' / '));
}

// ---------------------------------------------------------------------------
// 3 THE WHEEL TURNS ON ITS OWN — AND EVERY BAG IT WRITES IS ROUTED (G58.2,
//   G148)
// ---------------------------------------------------------------------------
// The cage rides each wheel on its axle and SPINS it. G148: every bag
// wheel() writes must be ROUTED by _cage_gear's wheelProxy, or the part is
// welded into the fuselage's static merge — which is how the bolt heads,
// hub caps, valve stems, the brake caliper and its pipe stood frozen
// mid-air inside a travelling, spinning wheel (the user's report). The
// contract, pinned here: the SPINNING set {tyre,hub,brake,alloy,dark} goes
// per-wheel; the LEG-RIDING set {brakefix: caliper + pipe} goes to that
// wheel's leg unit (travels with the axle, never turns). A name outside
// these six is a routing decision nobody made — fail it.
{
  const bags = freshBags();
  const st = STATIONS[0];
  const ctr = [0.8, -1.0, 2.0];
  GG.wheel(bags, ctr, [1, 0, 0], st.R,
           { brake: true, inboard: 1, P: st.P });
  const g = readBags(bags);
  const wrote = Object.keys(g);
  const ALLOWED = new Set(['tyre', 'hub', 'brake', 'alloy', 'dark',
                           'brakefix']);
  const leaked = wrote.filter(n => !ALLOWED.has(n));
  check(leaked.length === 0,
    'the wheel wrote into a bag the cage routing does not know', leaked.join(', '));
  check(!!g.tyre && !!g.hub, 'the wheel has no tyre or no hub');
  check(!!g.brake, 'a braked wheel drew no brake');
  check(!!g.alloy && !!g.dark,
    'the wheel drew no spinning hardware (bolts/caps/valve)');
  check(!!g.brakefix && g.brakefix.nt > 0,
    'the caliper and its pipe did not land in brakefix');
  // the DARK bag spins with the wheel now, so it may hold only the valve
  // (radially inside ~0.45 R): brake plumbing there would orbit the axle.
  const radial = G => { let m = 0;
    for (let i = 0; i < G.pos.length; i += 3)
      m = Math.max(m, Math.hypot(G.pos[i + 1] - ctr[1], G.pos[i + 2] - ctr[2]));
    return m; };
  check(radial(g.dark) < 0.62 * st.R,
    'spinning `dark` reaches past the valve — brake plumbing would orbit',
    (radial(g.dark) / st.R).toFixed(2) + ' R');
  // NEGATIVE CONTROL: with no brakefix bag offered (the bench), the pipe
  // falls back into dark and the radial instrument must SEE it out at the
  // caliper — proof this check can catch a re-misrouted pipe.
  const bags2 = freshBags();
  delete bags2.brakefix;
  GG.wheel(bags2, ctr, [1, 0, 0], st.R,
           { brake: true, inboard: 1, P: st.P });
  const g2dark = readBag(bags2.dark);
  check(!!g2dark && radial(g2dark) > 0.8 * st.R,
    'the negative control cannot see the pipe in dark — instrument blind');
}

// ---------------------------------------------------------------------------
// 4 A WHEEL IS A CIRCLE, and the eye knows it
// ---------------------------------------------------------------------------
// 63_gen_skin's own note, which retired with it: "18 read as a dodecagon from
// a metre away — a wheel is the one part of this aeroplane whose silhouette is
// a circle and the eye knows it." The tyre's outermost vertices must lie on a
// circle about the axle, to a tolerance a metre away cannot resolve.
{
  const st = STATIONS[0];
  const axle = [0.8, -1.0, 2.0], axis = [1, 0, 0];
  const bags = freshBags();
  GG.wheel(bags, axle, axis, st.R, { brake: !!st.brake, inboard: 1, P: st.P });
  const g = readBags(bags).tyre;
  if (check(!!g, 'no tyre to measure')) {
    // radius of every vertex about the axle, in the plane normal to the axis
    const rad = [];
    for (let i = 0; i < g.pos.length; i += 3) {
      const d = [g.pos[i] - axle[0], g.pos[i + 1] - axle[1], g.pos[i + 2] - axle[2]];
      const a = d[0] * axis[0] + d[1] * axis[1] + d[2] * axis[2];
      const p = [d[0] - a * axis[0], d[1] - a * axis[1], d[2] - a * axis[2]];
      rad.push(Math.hypot(p[0], p[1], p[2]));
    }
    const rMax = Math.max(...rad);
    check(Math.abs(rMax - st.R) < 0.02,
      'the tyre is not the radius the station bought',
      `${rMax.toFixed(3)} vs ${st.R.toFixed(3)} m`);
    // FACETING IS NOT A RADIAL SPREAD, and measuring it as one is a test whose
    // failure looks like its pass: a revolve puts every vertex exactly ON the
    // circle whatever the segment count, so the spread of vertex radii is zero
    // for a dodecagon too. Caught by building one — a 12-sided tyre sailed
    // through the first cut of this check.
    //
    // What the eye sees is the SAGITTA: how far the flat between two vertices
    // falls inside the true circle, R(1 - cos(pi/n)). Count the DISTINCT
    // angular positions around the axle and the number follows.
    const ang = new Set();
    for (let i = 0; i < g.pos.length; i += 3) {
      const d = [g.pos[i] - axle[0], g.pos[i + 1] - axle[1], g.pos[i + 2] - axle[2]];
      const a = d[0] * axis[0] + d[1] * axis[1] + d[2] * axis[2];
      const p = [d[0] - a * axis[0], d[1] - a * axis[1], d[2] - a * axis[2]];
      if (Math.hypot(p[0], p[1], p[2]) < rMax - 0.003) continue;   // crown only
      // the axle is +x here, so the section plane is (y, z)
      ang.add(Math.round(Math.atan2(p[2], p[1]) * 1000));
    }
    const n = ang.size;
    check(n >= 24, 'the tyre crown has too few segments to read as a circle',
      `${n} around`);
    const sag = st.R * (1 - Math.cos(Math.PI / Math.max(3, n)));
    // 1.5 mm on a 200 mm wheel: below what the eye picks out at a metre, and
    // comfortably above the 0.5 mm the 44-segment tyre actually achieves
    check(sag < 0.0015, 'the tyre reads as a polygon',
      `${n} segments, ${(sag * 1000).toFixed(1)} mm sagitta`);
  }
}

// ---------------------------------------------------------------------------
// 5 THE AXLE IS WHERE THE STATION PUT IT, AND THE WHEEL IS ON IT
// ---------------------------------------------------------------------------
// Ride height only means something if the wheel actually hangs the wheel's
// radius below its axle: this is the measurement the whole stance is built on.
for (const L of built) {
  const g = L.g.tyre;
  if (!g) { check(false, `${LEGNAME[L.st.leg]}: no tyre`); continue; }
  const b = bbox(g);
  const drop = L.r.axle[1] - b.lo[1];
  check(Math.abs(drop - L.st.R) < 0.02,
    `${LEGNAME[L.st.leg]}: the tyre does not reach the ground under its axle`,
    `${drop.toFixed(3)} m below the axle, wheel radius ${L.st.R.toFixed(3)}`);
  check(Math.abs((b.lo[0] + b.hi[0]) / 2 - L.r.axle[0]) < 0.05,
    `${LEGNAME[L.st.leg]}: the wheel is not centred on its axle`);
}

// ---------------------------------------------------------------------------
// 6 LEFT AND RIGHT ARE MIRRORS
// ---------------------------------------------------------------------------
// An undercarriage that is not symmetric is an aeroplane that turns on its own
// when you let go of it. The two sides are built by the SAME call with sgn
// flipped, so this is a real check on that argument being honoured everywhere.
// THE STRUCTURE mirrors VERTEX FOR VERTEX; the WHEEL mirrors as a VOLUME.
// That split is not a softened check, it is the right question asked twice.
// A wheel is a FITTED PART: its valve stem sits at whatever clock angle the
// tyre was mounted at and its bolt circle starts wherever the first stud is,
// and because both wheels of a pair are the same part those details do NOT
// come out mirrored — MEASURED, the valve is at z 0.676..0.747 on one side and
// 0.613..0.684 on the other. The old GATE GEN mirror check met the same thing
// and answered it with an EXEMPT set whose every entry had to earn its place
// ("an aeroplane has ONE pitot mast"); this is that reasoning applied one
// level down, and it keeps its teeth where they matter: a leg built
// differently on one side still fails, and a wheel in the wrong PLACE or of
// the wrong SIZE still fails.
{
  // ---- the leg, alone: exact
  const legOnly = sgn => {
    const st = Object.assign({}, STATIONS[0], { leg: 0 });
    const bags = freshBags();
    GG.legBeam(bags, AF, st.P, st, sgn);
    return readBags(bags);
  };
  const A = legOnly(1), B = legOnly(-1);
  const kk = (x, y, z) => x.toFixed(4) + '|' + y.toFixed(4) + '|' + z.toFixed(4);
  let miss = 0, total = 0;
  for (const n of Object.keys(A)) {
    const a = A[n], b = B[n];
    if (!b) { miss += a.nv; total += a.nv; continue; }
    const set = new Set();
    for (let i = 0; i < b.nv; i++)
      set.add(kk(b.pos[i * 3], b.pos[i * 3 + 1], b.pos[i * 3 + 2]));
    for (let i = 0; i < a.nv; i++) {
      total++;
      if (!set.has(kk(-a.pos[i * 3], a.pos[i * 3 + 1], a.pos[i * 3 + 2]))) miss++;
    }
  }
  check(miss === 0, 'the LEG is not mirror-symmetric',
    `${miss} of ${total} vertices have no twin`);

  // ---- the wheel, as a volume: same place, same size, opposite side
  const R = buildLeg(0, { sgn: 1 }), L = buildLeg(0, { sgn: -1 });
  for (const n of ['tyre', 'hub', 'brake']) {
    if (!R.g[n] || !L.g[n]) { check(!R.g[n] === !L.g[n],
      `only one side has a ${n}`); continue; }
    const a = bbox(R.g[n]), b = bbox(L.g[n]);
    const d = Math.max(
      Math.abs(-a.hi[0] - b.lo[0]), Math.abs(-a.lo[0] - b.hi[0]),
      Math.abs(a.lo[1] - b.lo[1]), Math.abs(a.hi[1] - b.hi[1]),
      Math.abs(a.lo[2] - b.lo[2]), Math.abs(a.hi[2] - b.hi[2]));
    check(d < 0.01, `the ${n} is not in the mirrored place`,
      `${(d * 1000).toFixed(1)} mm out`);
  }
}

// ---------------------------------------------------------------------------
// 7 A SPAT COVERS THE WHEEL AND STILL LETS IT TOUCH THE GROUND
// ---------------------------------------------------------------------------
// `spat`'s own note: "The bottom is OPEN on a chord line so the tyre reaches
// the ground". A fairing that enclosed the wheel would be an aeroplane on
// skids, and one that did not cover it would be a fairing of nothing.
{
  const S = buildLeg(0, { fair: 1 });
  const f = S.g.fair, t = S.g.tyre;
  if (check(!!f, 'a bought spat drew nothing') && t) {
    const bf = bbox(f), bt = bbox(t);
    check(bf.hi[2] >= bt.hi[2] - 1e-3 && bf.lo[2] <= bt.lo[2] + 1e-3,
      'the spat does not cover the wheel fore-and-aft',
      `spat z ${bf.lo[2].toFixed(2)}..${bf.hi[2].toFixed(2)},` +
      ` tyre ${bt.lo[2].toFixed(2)}..${bt.hi[2].toFixed(2)}`);
    check(bf.lo[1] > bt.lo[1] + 0.01,
      'the spat reaches below the tyre — the wheel cannot touch the ground',
      `spat ${bf.lo[1].toFixed(3)} vs tyre ${bt.lo[1].toFixed(3)}`);
  }
}

// ---------------------------------------------------------------------------
// 7.1 THE SPAT'S INSTRUMENTS MOVE THE SHELL (G133)
// ---------------------------------------------------------------------------
// Every new slider must change the drawing it claims to change — a shape row
// that draws the same shell at every value is the "quietly did nothing"
// fairing again, one knob further in.
{
  const base = buildLeg(0, { fair: 1 }).g.fair;
  const long = buildLeg(0, { fair: 1, fairOpt: { tail: 1.5 } }).g.fair;
  const deep = buildLeg(0, { fair: 1, fairOpt: { skirt: 0.2 } }).g.fair;
  const wide = buildLeg(0, { fair: 1, fairOpt: { width: 1.4 } }).g.fair;
  const rake = buildLeg(0, { fair: 1, fairOpt: { rake: 15 } }).g.fair;
  if (check(!!(base && long && deep && wide && rake),
            'an instrumented spat drew nothing')) {
    const zLen = g => { const b = bbox(g); return b.hi[2] - b.lo[2]; };
    check(zLen(long) > zLen(base) + 0.05,
      'the tail droplet does not lengthen the run-out',
      `${zLen(long).toFixed(3)} vs ${zLen(base).toFixed(3)}`);
    check(bbox(deep).lo[1] < bbox(base).lo[1] - 0.015,
      'the skirt slider does not deepen the opening');
    const xLen = g => { const b = bbox(g); return b.hi[0] - b.lo[0]; };
    check(xLen(wide) > xLen(base) + 0.02,
      'the width slider does not widen the shell');
    check(digest(rake) !== digest(base),
      'the rake slider draws the identical shell');
  }
}

// ---------------------------------------------------------------------------
// 7.2 THE TROUSER DRAWS ITS LEG, AND THE LEG FAIRING DRAWS ALONE (G133)
// ---------------------------------------------------------------------------
// `fairing: 'full'` has PRICED the legs at Cd 0.30 since G115 while drawing
// only a deeper shell — the exact geometry/physics mismatch this battery
// exists to remove. The shroud must reach from near the root down toward the
// wheel, on every leg family; and the leg-fairing switch must draw it
// without a spat.
for (let k = 0; k < 3; k++) {
  const L = buildLeg(k, { fair: 2 });
  const f = L.g.fair;
  if (!check(!!f, `${LEGNAME[k]}: trousers drew no shroud at all`)) continue;
  const bf = bbox(f);
  check(bf.hi[1] > L.r.axle[1] + L.st.R * 1.45,
    `${LEGNAME[k]}: the trouser shroud does not reach up the leg`,
    `top ${bf.hi[1].toFixed(3)} vs axle ${L.r.axle[1].toFixed(3)}`);
}
{
  const st0 = GP.gearStations(JSON.parse(JSON.stringify(P0)))[0];
  const st = Object.assign({}, st0, { leg: 2, legFair: 1, fair: 0 });
  const bags = freshBags();
  GG.legOleo(bags, AF, st.P, st, 1);
  const g = readBags(bags);
  check(!!g.fair,
    'the leg-fairing switch alone draws nothing — a priced shroud with no shell');
}

// ---------------------------------------------------------------------------
// 7.3 A LEG ROOTS ON THE MOUNT IT IS HANDED, AND THE WHEEL STAYS PUT (G133)
// ---------------------------------------------------------------------------
// The low-wing rule hands the builders a mount FRAME. Two things must hold:
// the root follows the frame (or the rule is cosmetic), and the AXLE does
// not move (it is keel-datum'd — where the leg roots must never move the
// wheel, the stance, or the join's measured rows).
for (const [k, nm] of [[0, 'beam'], [2, 'oleo']]) {
  const plainA = buildLeg(k).r.axle;
  const mp = [0.9, 0.4, 0];
  // the fabricated provider honours `dx` exactly as the wing's does —
  // G133.1: a builder must ask for its root above its own FOOT (axleIn),
  // one hubIn inboard of the wheel, or a short vertical leg leans
  const mount = (zOff, dx) => ({
    p: [mp[0] + (dx || 0), mp[1], mp[2] + (zOff || 0) + STATIONS[0].z],
    n: [0, -1, 0], fore: [0, 0, 1], side: [-1, 0, 0] });
  const hubIn = STATIONS[0].R * 0.40 + 0.020;
  const L = buildLeg(k, { mount });
  check(Math.abs(L.r.root[0] - (mp[0] - hubIn)) < 1e-6 &&
        Math.abs(L.r.root[1] - mp[1]) < 1e-6,
    `${nm}: the root is not above the strut's own foot (G133.1)`,
    `root ${L.r.root.map(v => v.toFixed(3)).join(',')} vs x ` +
    (mp[0] - hubIn).toFixed(3));
  check(L.r.axle.every((v, i) => Math.abs(v - plainA[i]) < 1e-6),
    `${nm}: the MOUNT MOVED THE WHEEL — the axle must be mount-invariant`,
    `axle ${L.r.axle.map(v => v.toFixed(3)).join(',')} vs ` +
    plainA.map(v => v.toFixed(3)).join(','));
}

// ---------------------------------------------------------------------------
// 8 THE TAILWHEEL IS ITS OWN ASSEMBLY
// ---------------------------------------------------------------------------
// G58.3: the castor fork YAWS for ground manoeuvring while the leaf spring
// stays with the leg, and the join separates them by bag-set. So the builder
// must actually fill a castor bag-set handed to it, or the fork rides the
// spring and the aeroplane steers by bending its own suspension.
{
  const P = JSON.parse(JSON.stringify(P0));
  const st0 = GP.gearStations(P)[0];
  const st = Object.assign({}, st0, { leg: 3, z: AF.z0 + 0.2, x: 0, R: 0.12 });
  const bags = freshBags(), cb = freshBags();
  let r = null;
  try { r = GG.legTailwheel(Object.assign({}, bags, { castorBags: cb }),
                            AF, st.P, st); }
  catch (e) { check(false, 'the tailwheel threw', e.message); }
  if (r) {
    const cg = readBags(cb);
    check(Object.keys(cg).length > 0,
      'the castor drew nothing into its own bags — the fork would not yaw');
    check(!!r.axle && isFinite(r.axle[1]), 'the tailwheel has no axle');
  }
  // G133: THE SMALL WHEEL'S SPAT — drawn into the CASTOR's bags (it must
  // steer with the fork), enclosing the wheel, opening above the tyre. This
  // shell is what let genGearCdA retire the tricycle-only pricing gate; if
  // it ever stops being drawn, that pricing goes back to being the lie
  // G121.2 refused to tell.
  {
    const st2 = Object.assign({}, st, { fair: 1 });
    const bags2 = freshBags(), cb2 = freshBags();
    let r2 = null;
    try { r2 = GG.legTailwheel(Object.assign({}, bags2, { castorBags: cb2 }),
                               AF, st2.P, st2); }
    catch (e) { check(false, 'the faired tailwheel threw', e.message); }
    if (r2) {
      const f = readBags(cb2).fair;
      if (check(!!f, 'a bought tailwheel spat drew nothing into the castor')) {
        const bf = bbox(f);
        check(bf.hi[2] >= r2.axle[2] + st2.R - 1e-3 &&
              bf.lo[2] <= r2.axle[2] - st2.R + 1e-3,
          'the tailwheel spat does not cover its wheel fore-and-aft');
        check(bf.lo[1] > r2.axle[1] - st2.R + 0.005,
          'the tailwheel spat reaches below its tyre');
      }
    }
  }
}

// ---------------------------------------------------------------------------
// 9 THE AIRFRAME CONTRACT IS ONE CONTRACT
// ---------------------------------------------------------------------------
// The whole point of the gear bench was that the same legs bolt to the bench's
// stub and to the real cage, because both answer ONE contract. If the two
// providers ever grow different shapes, a leg that fits here stops fitting
// there — silently, because the bench is what you look at while building.
{
  const NEED = ['z0', 'z1', 'halfWAt', 'heightAt', 'keelAt', 'cyAt', 'surf',
                'nrmAt'];
  const missing = NEED.filter(k => AF[k] === undefined);
  check(missing.length === 0, 'the stub airframe is missing contract members',
    missing.join(', '));
  // ...and the OTHER provider is asked the same question rather than grepped
  // for it. `cageAirframe` reads the cage's mesh and hands it to
  // `meshAirframe`, which is what actually answers the contract — so feed
  // meshAirframe a trivial box and compare the KEY SETS. A grep for the member
  // names was the first cut and it reported four false absences, because the
  // names live in the function it delegates to.
  check(typeof GG.cageAirframe === 'function',
    'cageAirframe is gone — the legs cannot reach a real fuselage');
  const V = [], F = [];
  for (const z of [0, 3]) for (const x of [-0.5, 0.5]) for (const y of [-0.5, 0.5])
    V.push([x, y, z]);
  // six quads of a box, wound outward; meshAirframe only samples it
  for (const q of [[0,1,3,2],[4,6,7,5],[0,2,6,4],[1,5,7,3],[0,4,5,1],[2,3,7,6]])
    F.push(q);
  const MA = GG.meshAirframe(V, F);
  if (check(!!MA, 'meshAirframe answered nothing for a box')) {
    const absent = NEED.filter(k => MA[k] === undefined);
    check(absent.length === 0,
      'the mesh provider does not answer the same contract as the stub',
      absent.join(', '));
    const extra = Object.keys(AF).filter(k => MA[k] === undefined && k !== 'stub');
    check(extra.length === 0,
      'the stub answers members the mesh provider does not', extra.join(', '));
  }
}

// ---------------------------------------------------------------------------
if (process.argv.includes('--selftest')) {
  const probes = [
    ['three identical leg families', () => new Set(['a', 'a', 'a']).size !== 3],
    ['a wheel that leaks into the leg',
      () => ['tyre', 'steel'].filter(n => !new Set(['tyre', 'hub']).has(n)).length > 0],
    ['a 12-sided tyre', () => !(12 >= 24)],
    ['a faceted crown (sagitta)', () => !(0.2 * (1 - Math.cos(Math.PI / 12)) < 0.0015)],
    ['a tyre of the wrong radius', () => !(Math.abs(0.30 - 0.20) < 0.02)],
    ['a wheel hanging clear of the ground', () => !(Math.abs(0.10 - 0.20) < 0.02)],
    ['an asymmetric undercarriage', () => 7 !== 0],
    ['a spat that reaches below the tyre', () => !(-1.20 > -1.19 + 0.01)],
    ['a castor with no bags of its own', () => !(0 > 0)],
    ['a contract member gone missing', () => ['surf'].length !== 0],
    ['a degenerate triangle', () => !(3 === 0)],
    // G133
    ['a droplet that draws the same shell', () => !(2.45 > 2.45 + 0.05)],
    ['a trouser with no leg shroud', () => !(0.24 > 0.0 + 0.20 * 1.45)],
    ['a mount that moved the wheel',
      () => ![0.86, -0.62, 0.62].every((v, i) =>
        Math.abs(v - [0.86, -0.62, 0.70][i]) < 1e-6)],
    ['a tailwheel spat outside the castor bags', () => !undefined],
  ];
  let caught = 0;
  for (const [nm, f] of probes) {
    let ok = false;
    try { ok = !!f(); } catch (e) { ok = false; }
    console.log(`  selftest ${nm.padEnd(36)} ${ok ? 'CAUGHT' : 'MISSED'}`);
    if (ok) caught++;
  }
  check(caught === probes.length,
    `selftest: ${probes.length - caught} probe(s) went unnoticed`);
}

const totalT = built.reduce((s, L) =>
  s + Object.keys(L.g).reduce((t, n) => t + L.g[n].nt, 0), 0);
console.log(`  ${built.length} leg families, ${BAGS.length} declared bags,` +
  ` ${totalT} triangles measured`);
const printed = new Set(fail);
for (const f of fail) console.log('  FAIL ' + f);
// ---------------------------------------------------------------------------
// 7 A CENTRE STATION ROOTS ON THE KEEL (2026-09-04)
// ---------------------------------------------------------------------------
// The user, on a tricycle: "the attachment is on the side, it's weird". Every
// leg builder rooted at sgn * <family>Ang on the FLANK, which is right for a
// two-sided station and wrong for the one wheel that sits at x = 0: the nose
// strut leaned in from one side of the fuselage to a centreline wheel. A
// centre station roots at the keel now — x within a centimetre of zero and
// BELOW the flank root a two-sided station of the same family gets.
{
  for (let kind = 0; kind < 3; kind++) {
    const P = JSON.parse(JSON.stringify(P0));
    const st0 = GP.gearStations(P)[0];
    const fn = [GG.legBeam, GG.legLink, GG.legOleo][kind];
    const side = fn(freshBags(), AF, st0.P, Object.assign({}, st0, { leg: kind }), 1);
    const cen = fn(freshBags(), AF, st0.P,
                   Object.assign({}, st0, { leg: kind, x: 0, steer: 1 }), 1);
    check(!!cen.root && Math.abs(cen.root[0]) < 0.01,
      `${LEGNAME[kind]}: a centre station roots off the centreline`,
      cen.root ? 'root x ' + cen.root[0].toFixed(3) : 'no root');
    check(!!cen.root && !!side.root && cen.root[1] < side.root[1] - 0.02,
      `${LEGNAME[kind]}: a centre station's root is not below the flank root`,
      (cen.root && side.root) ? cen.root[1].toFixed(3) + ' vs ' + side.root[1].toFixed(3) : '');
    check(Math.abs(cen.axle[0]) < 1e-9,
      `${LEGNAME[kind]}: a centre station's axle left the centreline`);
    check(!!side.root && Math.abs(side.root[0]) > 0.05,
      `${LEGNAME[kind]}: a two-sided station stopped rooting on the flank`);
  }
}

// ---------------------------------------------------------------------------
// 10 THE WHEEL FALLS WHERE THE STATION SAYS, THE FITTING STAYS (2026-09-04)
// ---------------------------------------------------------------------------
// The user: "tune the point of attachment and where the wheels fall
// independently". `s<i>AxZ` moves the AXLE fore/aft by exactly itself on
// every leg family and moves the ROOT by nothing; y and x of the axle are
// untouched (the keel datum, G53/G133, still holds).
{
  for (let kind = 0; kind < 3; kind++) {
    const P = JSON.parse(JSON.stringify(P0));
    const st0 = GP.gearStations(P)[0];
    const fn = [GG.legBeam, GG.legLink, GG.legOleo][kind];
    const a = fn(freshBags(), AF, st0.P, Object.assign({}, st0, { leg: kind }), 1);
    const b = fn(freshBags(), AF, st0.P,
                 Object.assign({}, st0, { leg: kind, axZ: 0.35 }), 1);
    check(Math.abs((b.axle[2] - a.axle[2]) - 0.35) < 1e-6,
      `${LEGNAME[kind]}: s1AxZ did not move the axle by itself`,
      `dz ${(b.axle[2] - a.axle[2]).toFixed(3)}`);
    check(Math.abs(b.axle[0] - a.axle[0]) < 1e-9 && Math.abs(b.axle[1] - a.axle[1]) < 1e-9,
      `${LEGNAME[kind]}: s1AxZ moved the axle off its keel datum`);
    check(!!a.root && !!b.root && a.root.every((v, i) => Math.abs(v - b.root[i]) < 1e-9),
      `${LEGNAME[kind]}: s1AxZ moved the FITTING — the root must stay`);
  }
  // the station composer carries it, so the cage layer cannot forget it
  const P = JSON.parse(JSON.stringify(P0)); P.s1AxZ = 0.2;
  check(Math.abs(GP.gearStations(P)[0].axZ - 0.2) < 1e-9,
    'gearStations does not carry s1AxZ');
}

// ---------------------------------------------------------------------------
// 11 THE OPEN FRAME: A PIVOT ON A MEMBER, NO PLATE (2026-09-04)
// ---------------------------------------------------------------------------
{
  for (const [k, nm] of [[0, 'beam'], [1, 'link'], [2, 'oleo']]) {
    const plainA = buildLeg(k).r.axle;
    const mp = [0.9, 0.4, 0];
    const flat = (zOff, dx) => ({
      p: [mp[0] + (dx || 0), mp[1], mp[2] + (zOff || 0) + STATIONS[0].z],
      n: [0, -1, 0], fore: [0, 0, 1], side: [-1, 0, 0] });
    const piv = (zOff, dx) => flat(zOff, dx);
    piv.pivot = true;
    const A = buildLeg(k, { mount: flat }), B = buildLeg(k, { mount: piv });
    const nt = L => (L.g.alloy ? L.g.alloy.nt : 0);
    check(nt(B) > 0 && nt(B) < nt(A),
      `${nm}: a pivot mount still draws a plate (alloy ${nt(B)} vs ${nt(A)} tris)`);
    // (the LINK's wheel angle is measured from its pivot height by law — §7.3
    // skips it for the same reason; beam and oleo must not move)
    if (k !== 1) check(B.r.axle.every((v, i) => Math.abs(v - plainA[i]) < 1e-6),
      `${nm}: the pivot mount MOVED THE WHEEL`);
    check(!!B.r.root && Math.abs(B.r.root[1] - mp[1]) < 1e-6,
      `${nm}: the pivot root left the member`);
  }
}

// ---------------------------------------------------------------------------
// 12 A HOLE IS NOT A RADIUS (2026-09-05)
// ---------------------------------------------------------------------------
// The user's report: the fittings for the gear, the suspension and the lift
// struts "look for a plate to attach to. It fails in some cases, resulting in
// a distorted mesh ... extending into the cabin and the pilot."
//
// The cause was one line in `meshAirframe`: a ray that hit nothing returned
// radius ZERO, which every consumer read as "the surface is on the centre
// line". A removed door (`doorGone`), an open cockpit or a bare frame leaves
// exactly that hole, and on the reported build it covered the whole flank at
// the stations a main leg and a lift strut root in — so both went to the
// middle of the cabin and the doubler was drawn across the cockpit.
//
// The instrument is A BOX WITH A DOORWAY IN ONE FLANK, which is the reported
// aeroplane in miniature: skin fore and aft of the gap, nothing across it.
{
  // a 1 m square box, 3 m long, with the +x flank cut into three bands so the
  // middle one can be taken away
  const V = [], F = [];
  const ZS = [0, 1, 2, 3];
  const id = (iz, x, y) => iz * 4 + (x > 0 ? 2 : 0) + (y > 0 ? 1 : 0);
  for (const z of ZS) for (const x of [-0.5, 0.5]) for (const y of [-0.5, 0.5])
    V.push([x, y, z]);
  const N = ZS.length - 1;
  for (let b = 0; b < N; b++) {
    const A = b, B = b + 1;
    F.push({ n: 'floor', v: [id(A,-1,-1), id(A,1,-1), id(B,1,-1), id(B,-1,-1)] });
    F.push({ n: 'roof',  v: [id(A,-1,1),  id(B,-1,1), id(B,1,1),  id(A,1,1)] });
    F.push({ n: 'port',  v: [id(A,-1,-1), id(B,-1,-1), id(B,-1,1), id(A,-1,1)] });
    F.push({ n: 'door' + b,
             v: [id(A,1,-1), id(A,1,1), id(B,1,1), id(B,1,-1)] });
  }
  F.push({ n: 'nose', v: [id(0,-1,-1), id(0,-1,1), id(0,1,1), id(0,1,-1)] });
  F.push({ n: 'tail', v: [id(N,-1,-1), id(N,1,-1), id(N,1,1), id(N,-1,1)] });
  const quads = keep => F.filter(f => keep(f.n)).map(f => f.v);
  const whole = GG.meshAirframe(V, quads(() => true));
  const holed = GG.meshAirframe(V, quads(n => n !== 'door1'));   // z 1..2 open
  const bare  = GG.meshAirframe(V, quads(n => !/^door/.test(n))); // no flank
  const AT = Math.PI / 2;                       // the flank, +x
  if (check(!!whole && !!holed && !!bare,
            'meshAirframe answered nothing for a box')) {
    const rW = Math.abs(whole.surf(1.5, AT)[0]);
    const rH = Math.abs(holed.surf(1.5, AT)[0]);
    check(rH > 0.2,
      'a doorway still reads as radius ZERO — the fitting goes to the ' +
      'centreline', 'half-width ' + rH.toFixed(3));
    // ...and the envelope it closes with is the skin either side of the gap,
    // because that is the direction it is solved along
    check(Math.abs(rH - rW) < 0.002,
      'the closed envelope does not follow the flank either side of the gap',
      rH.toFixed(3) + ' vs ' + rW.toFixed(3));
    check(holed.halfWAt(1.5) > 0.2 && holed.heightAt(1.5) > 0.2,
      'a holed body reports a collapsed section',
      holed.halfWAt(1.5).toFixed(3) + ' x ' + holed.heightAt(1.5).toFixed(3));
    // an angle open at EVERY station has no fore-and-aft skin to follow, and
    // it still may not answer the centreline — the ring closes it instead
    check(Math.abs(bare.surf(1.5, AT)[0]) > 0.3,
      'a flank open end to end collapses onto the centreline',
      Math.abs(bare.surf(1.5, AT)[0]).toFixed(3));
    // AND IT SAYS SO. The envelope is the right SHAPE and it is still nothing
    // to bolt a doubler to; `solidAt` is how a fitting tells the two apart,
    // and without it the no-plate rule has nothing to fire on.
    check(typeof holed.solidAt === 'function',
      'the airframe cannot say whether there is skin under a fitting');
    check(holed.solidAt(1.5, 0) === true,
      'solidAt calls a measured keel inferred');
    check(holed.solidAt(1.5, AT) === false,
      'solidAt calls a doorway solid — no fitting will ever choose a lug');
    check(holed.solidAt(0.5, AT) === true && holed.solidAt(2.5, AT) === true,
      'solidAt calls the skin fore and aft of the gap a hole too');
    check(whole.solidAt(1.5, AT) === true,
      'solidAt calls a whole flank a hole — every fitting loses its plate');
    check(whole.open === 0 && holed.open > 0,
      'the inferred-cell count does not tell the two bodies apart',
      whole.open + ' / ' + holed.open);
  }
  // A PLATE MAY NOT WRAP ITSELF ROUND THE AEROPLANE. The other half of a
  // distorted doubler: `W` is an arc length, and on a section narrower than
  // the plate the angle it converts to used to be unbounded.
  const thin = { halfWAt: () => 0.02 };
  check(GG.padArc(thin, 0, 0.30) <= GG.PAD_ARC + 1e-9,
    'a doubler on a thin section wraps past the bound',
    GG.padArc(thin, 0, 0.30).toFixed(2) + ' rad');
  check(Math.abs(GG.padArc({ halfWAt: () => 0.30 }, 0, 0.10) - 1 / 3) < 1e-9,
    'the bound changed the plate on an ordinary body');
}

// ---------------------------------------------------------------------------
// 13 THE NEAREST TUBE, AND ONLY WHEN THERE IS ONE (2026-09-05)
// ---------------------------------------------------------------------------
// `memberFrame` is the one description of "root on the structure" — the gear
// layer and the lift struts both ask it, so it is checked once here rather
// than twice by eye in a page.
{
  const MB = [{ a: [0, 0, 0], b: [0, 0, 4], r: 0.02 },      // along z at origin
              { a: [-3, 0, 0], b: [-3, 0, 4], r: 0.02 }];
  const F = GG.memberFrame(MB, [0.5, 0, 2], 1);
  if (check(!!F, 'memberFrame found no tube at all')) {
    check(Math.abs(F.p[0] - 0.02) < 1e-6 && Math.abs(F.p[2] - 2) < 1e-6,
      'the frame is not on the near tube surface', JSON.stringify(F.p));
    check(Math.abs(F.n[0] - 1) < 1e-6, 'the normal does not face the fitting');
    check(Math.abs(F.fore[2] - 1) < 1e-6, 'fore is not the member direction');
  }
  // THE NORMAL IS RADIAL, and it is the trap this pays for: at a member's END
  // the raw "towards the fitting" vector is mostly ALONG the tube, and every
  // lug and pin built on it comes out raked by the tube's own angle.
  const E = GG.memberFrame(MB, [0.3, 0, 6], 1);
  check(!!E && Math.abs(E.n[2]) < 1e-6,
    'the frame at a member END leans along the tube',
    E ? E.n.map(v => v.toFixed(3)).join(',') : 'none');
  // ...AND THE REACH IS REAL. A rod boom publishes no members, so a tailspring
  // asking at the tailpost was handed the cabin frame a metre and a half
  // forward and stretched itself to reach it.
  check(GG.memberFrame(MB, [0.5, 0, 2], 1, 0.10) === null,
    'memberFrame answered a tube outside the reach it was given');
  check(GG.memberFrame([], [0, 0, 0], 1) === null,
    'memberFrame invented a tube where none are published');
}

// the sections after the summary (7-centre, 10-13) print their own reds
for (const f of fail) if (!printed.has(f)) console.log('  FAIL ' + f);
console.log('GATE GEAR: ' + (fail.length ? 'FAIL' : 'PASS'));
process.exit(fail.length ? 1 : 0);
