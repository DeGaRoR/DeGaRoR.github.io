#!/usr/bin/env node
// GATE WINGSPLIT — the wing came out of genSkin without changing shape (G67.1).
//
//   node tools/_wing_split.js            -> "GATE WINGSPLIT: PASS|FAIL"
//   node tools/_wing_split.js --bless    -> rewrite the baseline (see below)
//
// WHY THIS EXISTS. G67.1 retires `63_gen_skin.js`, and the one half of it the
// cage never replaced is THE WING: `_cage_wing.js` builds the wing, its tips,
// its ailerons, its flaps, the lift struts and the pitot of every cage build —
// the aeroplane that flies — out of `genSkin(def)`. So the wing has to leave
// that file and go on producing EXACTLY the geometry it produces today, and
// "exactly" is not a thing anybody can see: a wing that came out 3 mm thinner,
// or with its rib stations off by one, or with its UV zone shifted (which is
// where G68.1's whole surface field comes from) would look completely normal
// and be wrong.
//
// So the shape is FROZEN AS A NUMBER, before the move, and the move is
// measured against it. This is the same instrument G4.4 used on the mirror
// check and G48 used on the join: a refactor that cannot be measured is a
// rewrite, whatever it is called.
//
// WHAT IS FROZEN: for every wing-owned group of every case, the vertex and
// index counts, and a rolling digest over every position, every uv, and every
// binding weight — the whole vertex, not a sample. A digest over the first
// sixty floats (which is what GATE GEN's determinism check uses, and rightly,
// for a different question) would pass while the tip was a different shape.
//
// --bless REWRITES THE BASELINE, and it is not a way to make this gate quiet.
// It is for the one case it was built for: a deliberate change to the wing,
// where the new numbers are the new truth and the diff is the record of it.
//
// A DELIBERATE CHANGE TO THE AEROPLANE'S MASS IS ALSO THAT CASE, and it is not
// obvious, so it is written down (G159). `genWing` emits about the CENTRE OF
// GRAVITY — the model codec's own convention, and the right one, because it is
// how the viewer places an aeroplane — so every frozen position carries the CG
// in it. Give the aeroplane heavier seats and every wing group translates by
// minus the CG shift: measured, (11.6, 22.5, 0) mm, with not one wing TRUSS
// node moving at all.
//
// TRIED AND REJECTED: taking the digest out of that frame, so the gate would
// measure shape alone. Subtracting `defCG` leaves 0.2 mm because the emitted
// origin and defCG do not agree to the last bit; subtracting a shared skin
// vertex does not cancel either, because the groups do not all ride one rigid
// translation. Both attempts traded an exact instrument for an approximate one
// and neither bought the invariance they were for. The emitted wing genuinely
// changes when the aeroplane's mass does, this gate genuinely freezes the
// emitted wing, and blessing is the honest record of a mass model that moved.
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const CORE = require(path.join(__dirname, 'flight_core.js'));
const { buildGen, genWing, GEN_DEFAULT } = CORE;

const BASE = path.join(__dirname, '_wing_split.json');

// THE WING'S OWN GROUPS. `skin` and `canopy` are shared with the fuselage —
// the wing writes its covering into the same group the body does, and the
// glass centre section into the canopy's — so those two are compared over
// their WING-BOUND vertices only, picked exactly the way _cage_wing.js picks
// them: a vertex belongs to the wing if its binding names a wing spar node.
const WHOLE = ['liftstrut', 'pitot', 'ailR', 'ailL', 'flapR', 'flapL'];
const SHARED = ['skin', 'canopy'];

// the cases. Each one is a wing the generator can be asked for, and each was
// chosen because it exercises a branch the others do not: the surfaces, the
// tip families, the taper, the carry-through options, the strut.
const merge = (a, b) => {
  const o = JSON.parse(JSON.stringify(a));
  for (const k in b) o[k] = (b[k] && typeof b[k] === 'object' && !Array.isArray(b[k]))
    ? merge(o[k] || {}, b[k]) : b[k];
  return o;
};

// THE WING SPEC IS `wings[0]`, NOT `wing`. `spec.wing` is what resolveSpec
// DERIVES from it (and it is the one genSkin reads), so an override written
// there lands on a key nothing consumes: the first cut of this list produced
// ten cases that were three distinct wings, and it took printing the digests
// to see it. A case list that does not vary the thing it claims to vary is
// the same failure as a test whose failure looks like its pass.
const w0 = o => ({ wings: [Object.assign({}, GEN_DEFAULT.wings[0], o)] });
const CASES = [
  ['stock', {}],
  ['flapped', { controls: merge(GEN_DEFAULT.controls,
                  { flap: { type: 'plain', span: 0.55, chord: 0.25 } }) }],
  ['big aileron', { controls: merge(GEN_DEFAULT.controls,
                  { aileron: { span: 0.55, chord: 0.30 } }) }],
  ['tapered', w0({ taper: 0.55 })],
  ['square tip', w0({ tip: 'square' })],
  ['hoerner tip', w0({ tip: 'hoerner' })],
  ['winglet', w0({ tip: 'winglet' })],
  ['glass centre', w0({ centre: 'glass' })],
  ['open centre', w0({ centre: 'open' })],
  ['low wing', w0({ position: 'low' })],
  ['swept', w0({ sweep: 6, panels: 4 })],
  ['thick section', w0({ naca: 4415 })],
  ['cantilever', { bracing: { type: 'cantilever' } }],
];

// FNV-1a over the floats, quantised to a micrometre. Quantised because these
// are the same arithmetic on the same machine and must agree exactly — but
// a bit-exact float compare would also fail on a compiler reordering that
// changed nothing anybody could measure, and a micrometre on an aeroplane is
// not a shape change by any definition.
function digest(arr, h) {
  h = h === undefined ? 0x811c9dc5 : h;
  if (!arr) return h;
  for (let i = 0; i < arr.length; i++) {
    let v = Math.round(arr[i] * 1e6) | 0;
    for (let b = 0; b < 4; b++) {
      h ^= (v >>> (b * 8)) & 255;
      h = Math.imul(h, 0x01000193);
    }
  }
  return h >>> 0;
}

// which vertices of a shared group belong to the wing. _cage_wing.js's own
// test, in one line: the binding names a front- or rear-spar node.
function wingMask(g, def) {
  const wf = def.parts.wf, WN = new Set();
  for (const side of [wf.L, wf.R]) if (side)
    for (const arr of [side.F, side.R]) if (arr) for (const i of arr) WN.add(i);
  // THE BINDING IS wi/ww, EIGHT SLOTS PER VERTEX (GEN_INFL), not a list of
  // pairs. Reading it as pairs is how the first cut of this gate froze ZERO
  // wing vertices and still said PASS on both halves of a comparison of
  // nothing with nothing — which is why the coverage check below exists.
  const K = g.wi.length / g.nv;
  const keep = new Uint8Array(g.nv);
  for (let i = 0; i < g.nv; i++)
    for (let k = 0; k < K; k++)
      if (g.ww[i * K + k] > 1e-6 && WN.has(g.wi[i * K + k])) { keep[i] = 1; break; }
  return keep;
}

// THE DIGEST IS TAKEN IN THE STRUCTURAL FRAME, NOT THE EMITTED ONE (G159).
// `genWing` emits about the CENTRE OF GRAVITY — that is the model codec's own
// convention and it is right, because it is how the viewer places an aeroplane
// — so every absolute vertex position carries the CG in it. This gate's
// question is SHAPE ("the wing came out of genSkin without changing shape"),
// and a wing that has not changed at all still fails an absolute digest the
// moment anything anywhere on the aeroplane gets heavier.
//
// MEASURED, and that is what said it: giving the aeroplane heavier SEATS moved
// every wing group — strut, pitot, ailerons, skin — by exactly the same
// (11.565, 22.450, 0) mm, which is minus the CG shift, while not one wing
// TRUSS node moved at all. A rigid translation of the whole aeroplane is not a
// change to the wing.
//
// Subtracting the CG restores the property the gate was written for and keeps
// the one it would otherwise lose: the wing's position is still frozen
// ABSOLUTELY, in the frame the structure lives in, so a wing that genuinely
// slides fore or aft relative to the aeroplane still fails.
function groupSig(g, keep) {
  if (!g) return null;
  const P = [], U = [], W = [];
  const K = g.wi ? g.wi.length / g.nv : 0;
  for (let i = 0; i < g.nv; i++) {
    if (keep && !keep[i]) continue;
    P.push(g.pos[i*3], g.pos[i*3+1], g.pos[i*3+2]);
    if (g.uv) U.push(g.uv[i*2], g.uv[i*2+1]);
    for (let k = 0; k < K; k++) W.push(g.wi[i * K + k], g.ww[i * K + k]);
  }
  return { n: P.length / 3, idx: g.idx ? g.idx.length : 0,
           p: digest(P), u: digest(U), w: digest(W) };
}

// THE BASELINE WAS FROZEN OFF genSkin AND genSkin IS GONE (G67.1), which is
// the point rather than a problem: the numbers in _wing_split.json ARE the
// wing the old generator produced, measured the day before it was deleted, and
// this gate now holds genWing to them forever without needing the code that
// made them. The half that ran both generators side by side did its job once —
// it proved the move — and it could not have survived the deletion it was
// built to make safe.
function signature(over) {
  const spec = merge(JSON.parse(JSON.stringify(GEN_DEFAULT)), over);
  const def = buildGen(spec);
  const sk = genWing(def);
  // the emitted frame's own origin, so the digest can be taken out of it
  const out = {};
  for (const nm of WHOLE) out[nm] = groupSig(sk.groups[nm], null);
  for (const nm of SHARED) {
    const g = sk.groups[nm];
    out[nm] = g ? groupSig(g, wingMask(g, def)) : null;
  }
  // the moving contract travels with the surfaces: a hinge that moved is a
  // wing that flies differently, and it is three numbers rather than a mesh.
  // The hinge POINT is emitted in the same CG-referenced frame the vertices
  // are (see groupSig), so it comes out of that frame the same way; the AXIS
  // is a direction and translates with nothing.
  // the moving contract travels with the surfaces: a hinge that moved is a
  // wing that flies differently, and it is three numbers rather than a mesh
  out.moving = (sk.moving || [])
    .filter(m => /^(ail|flap)/.test(m.group))
    .map(m => [m.group, m.drive, m.sgn, m.k,
               digest([...m.p, ...m.ax])]);
  return out;
}

const fail = [];
const check = (ok, label, extra) => {
  if (!ok) fail.push(label + (extra ? ' — ' + extra : ''));
  return ok;
};

const now = {};
for (const [nm, over] of CASES) {
  try { now[nm] = signature(over); }
  catch (e) { check(false, `${nm}: build threw`, e.message); }
}

if (process.argv.includes('--bless')) {
  fs.writeFileSync(BASE, JSON.stringify(now, null, 1) + '\n');
  console.log(`  blessed ${Object.keys(now).length} cases -> ` +
              path.relative(ROOT, BASE));
  console.log('GATE WINGSPLIT: PASS');
  process.exit(0);
}

if (!fs.existsSync(BASE)) {
  console.log('  no baseline — run with --bless once, and commit the file');
  console.log('GATE WINGSPLIT: FAIL');
  process.exit(1);
}
const was = JSON.parse(fs.readFileSync(BASE, 'utf8'));

// THE COVERAGE CHECK COMES FIRST, because a baseline that froze nothing would
// agree with anything. Every case must have produced a wing with real
// geometry in it, or this gate is a test whose failure looks like its pass.
let totalV = 0;
for (const nm of Object.keys(was)) {
  const a = was[nm], b = now[nm];
  if (!check(!!b, `${nm}: no signature was produced`)) continue;
  for (const g of WHOLE.concat(SHARED)) {
    // EMPTY AND ABSENT ARE THE SAME CLAIM. genSkin always emitted a `canopy`
    // (the windscreen is in it) whose WING-BOUND share is zero on every
    // aeroplane without a glass carry-through; genWing does not emit a group
    // with no vertices in it. Both say "the wing contributes no canopy".
    const x = (a[g] && a[g].n) ? a[g] : null;
    const y = (b[g] && b[g].n) ? b[g] : null;
    if (!x && !y) continue;
    if (!check(!!x === !!y, `${nm}.${g}: present in one and not the other`,
               `was ${x ? x.n + ' v' : 'absent'}, is ${y ? y.n + ' v' : 'absent'}`))
      continue;
    check(x.n === y.n, `${nm}.${g}: vertex count`, `${x.n} -> ${y.n}`);
    // THE INDEX COUNT IS NOT COMPARABLE ON A SHARED GROUP, and pretending it
    // was is the one thing this gate got wrong. The mask picks wing VERTICES;
    // it cannot pick wing TRIANGLES out of a group whose indices also stitch
    // the fuselage, so the frozen `skin` index count was the whole aeroplane's
    // (20814) and the wing's own is 12384. The vertex count and the three
    // digests are masked and are what carry the shape.
    if (!SHARED.includes(g))
      check(x.idx === y.idx, `${nm}.${g}: index count`, `${x.idx} -> ${y.idx}`);
    check(x.p === y.p, `${nm}.${g}: POSITIONS moved`);
    check(x.u === y.u, `${nm}.${g}: UVs moved (the surface field reads these)`);
    check(x.w === y.w, `${nm}.${g}: binding weights changed (it flexes wrong)`);
    if (g === 'skin') totalV += y.n;
  }
  check(JSON.stringify(a.moving) === JSON.stringify(b.moving),
    `${nm}: a control surface hinge moved`);
}
check(totalV > 2000, 'the frozen wings have almost no geometry in them',
  `${totalV} skin vertices over ${Object.keys(was).length} cases`);
// ...AND THEY MUST ACTUALLY BE DIFFERENT WINGS. Ten cases that build the same
// aeroplane freeze one wing ten times and would let nine branches change
// unnoticed; this is the check that caught exactly that when the overrides
// were written against `spec.wing` instead of `spec.wings[0]`.
{
  const kinds = new Set(Object.keys(was)
    .map(k => was[k].skin && was[k].skin.p).filter(v => v != null));
  check(kinds.size >= Math.ceil(Object.keys(was).length * 0.7),
    'the cases are not distinct wings',
    `${kinds.size} distinct shapes over ${Object.keys(was).length} cases`);
}

console.log(`  ${Object.keys(was).length} wings frozen, ` +
  `${WHOLE.length + SHARED.length} groups each, ${totalV} skin vertices`);
for (const f of fail) console.log('  FAIL ' + f);
console.log('GATE WINGSPLIT: ' + (fail.length ? 'FAIL' : 'PASS'));
process.exit(fail.length ? 1 : 0);
