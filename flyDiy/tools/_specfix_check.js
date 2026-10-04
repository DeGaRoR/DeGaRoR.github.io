#!/usr/bin/env node
// _specfix_check.js — GATE SPECFIX (SPEC-FIXPOINT G1550-G1559; the 2026-10-04 review's A2, A3, B8, B9, B13,
// E1, E2, E3 and clampSpec's tailY). THE RESOLVED SPEC IS A FIXED POINT AND THE CORNERS ARE THE STAND.
//
// The reserve sheet, the four CG corners and the editor's fuel slider re-feed the RESOLVED spec to buildGen
// (genSpecAtFuel). Before this arc that was not the same aeroplane: offsets were applied again on every pass (A2),
// derived values escaped the envelope the next pass then cut (B8), the tail-end offset accumulated in clampSpec,
// and the frame solved the gear, the structure's scale, the floats and the gauge again off the written-back gear
// station and the re-fed loading (a floatplane's corners were another lattice at the SAME fuel). And the join wrote
// six rows only when they were off their default, which the garage's per-key merge then kept for ever (A3 / E2).
//
// On the five validated builds (the user's Cub, the Jodel, the metal Cessna, the Cessna floats, the twin-582 on
// floats) and a corpus of offset / envelope / null specs:
//   REGISTRY  every GEN_FIELDS row's default is GEN_DEFAULT's; its clamp is the one clampSpec applies (a value
//             far out lands on the bound); every join row has a round-trip case below (no row without a case)
//   CLAMP     clampSpec(clampSpec(s)) == clampSpec(s)
//   RESOLVE   resolve(resolve(s)) == resolve(s); every derived registry field inside its envelope; every offset
//             consumed (zeroed, recorded in _offsets) and applied exactly once
//   BUILD     buildGen leaves its input unchanged; buildGen(def.spec) rebuilds def.spec and the same lattice
//   CORNERS   genSpecAtFuel at full / reserves / dry, solo and full cabin: the SAME aeroplane as the stand -
//             node count, every rest position and radius, every beam (ends, rest length, class, stiffness),
//             every strip (kind, chord, area), the gear station and track, the design gross
//   B9 / B13  a zero / negative tail area builds finite; an explicit null on a non-derivable number is its default
//   JOIN      (skipped with --no-join) the page's own join, headless (tools/_bake_joined.js): commit the build,
//             switch a join-owned row ON and commit, switch it back and commit - the file and the resolved spec
//             equal the never-on commit (every row on the Cub; all rows at once on the other four)
// Tolerance: 1e-9 relative (a derived angle read back through tan/atan moves the last bit).
// Verdict contract: one final `GATE SPECFIX: PASS|FAIL`, exit code to match. ~1.5 min (the joins); --no-join ~15 s.
'use strict';
const fs = require('fs'), path = require('path');
const T = __dirname, ROOT = path.join(T, '..');
const C = require('./flight_core.js');
const argv = process.argv.slice(2);
const NOJOIN = argv.includes('--no-join');
const VERBOSE = argv.includes('--verbose');

let fails = 0;
const ok = (c, l) => { if (!c || VERBOSE) console.log((c ? '  ok     ' : '  FAIL   ') + l); if (!c) fails++; };
const cl = o => JSON.parse(JSON.stringify(o));
const TOL = 1e-9;
const near = (a, b) => a === b || (typeof a === 'number' && typeof b === 'number' &&
  Math.abs(a - b) <= TOL * Math.max(1, Math.abs(a), Math.abs(b)));

// every leaf, by path (functions skipped: the cowl's section closures)
function flat(o, p, out) {
  out = out || {};
  if (o && typeof o === 'object') { for (const k in o) flat(o[k], p ? p + '.' + k : k, out); }
  else if (typeof o !== 'function') out[p] = o;
  return out;
}
function diff(a, b, skip) {
  const A = flat(a, ''), B = flat(b, ''), d = [];
  for (const k of new Set([...Object.keys(A), ...Object.keys(B)])) {
    if (skip && skip.test(k)) continue;
    if (!near(A[k], B[k])) d.push(k + ': ' + JSON.stringify(A[k]) + ' -> ' + JSON.stringify(B[k]));
  }
  return d;
}
const say = (d, n) => d.length ? ' [' + d.length + ': ' + d.slice(0, n || 4).join('; ') + ']' : '';
const getP = (o, p) => p.split('.').reduce((x, k) => (x == null ? undefined : x[k]), o);

// ---- the validated builds (master_bench.js's list; the twin flown on floats as GATE FLOATS flies it) ----
const BUILDS = [
  { key: 'cub', file: 'builds/cub_2026-09-20_corrected.json' },
  { key: 'jodel', file: 'builds/jodel_2026-09-20_corrected.json' },
  { key: 'cessna', file: 'bugReports/cessnaMetal (1).json' },
  { key: 'floats', file: 'bugReports/cessnaFloatsWOrks.json' },
  { key: 'twinFloats', file: 'tools/fixtures/build_v7_ultralight_2026-09-05.json',
    patch: s => { s.gear.type = 'floats'; s.cage = Object.assign({}, s.cage, { gearFloats: 1 }); } },
];
const specOf = b => {
  const j = JSON.parse(fs.readFileSync(path.join(ROOT, b.file), 'utf8'));
  const s = j.spec || j;
  if (b.patch) b.patch(s);
  return s;
};

// ---- the corpus: offsets, the envelope's edges, the nulls ----
const D0 = () => cl(C.GEN_DEFAULT);
const mk = f => { const s = D0(); f(s); return s; };
const CORPUS = [
  { key: 'stock', spec: D0() },
  // the review's A2 repro: wing dx 0.5, tail dx 0.4
  { key: 'A2 wing 0.5 + tail 0.4', spec: mk(s => { s.wings[0].place.dx = 0.5; s.tail.place.dx = 0.4; }) },
  { key: 'wing dx 0.5', spec: mk(s => { s.wings[0].place.dx = 0.5; }), off: { 'wings.0.place.dx': 0.5 } },
  { key: 'tail dx -0.8', spec: mk(s => { s.tail.place.dx = -0.8; }), off: { 'tail.place.dx': -0.8 } },
  { key: 'tailY 0.3', spec: mk(s => { s.fuselage.tailY = 0.3; }), off: { 'fuselage.tailY': 0.3 } },
  { key: 'gear dx 0.3 dtrack 0.2', spec: mk(s => { s.gear.place.dx = 0.3; s.gear.place.dtrack = 0.2; }) },
  { key: 'tricycle + gear dx -0.2', spec: mk(s => { s.gear.type = 'tricycle'; s.gear.place.dx = -0.2; }) },
  { key: 'floats (derived) + gear dx 0.2', spec: mk(s => { s.gear.type = 'floats'; s.gear.place.dx = 0.2; }) },
  { key: 'biplane, plane 1 dx 0.2', spec: mk(s => {
      const w = cl(s.wings[0]); s.wings[0].position = 'low'; w.position = 'parasol'; w.place.dx = 0.2; s.wings.push(w); }),
    off: { 'wings.1.place.dx': 0.2 } },
  { key: 'everything at once', spec: mk(s => {
      s.wings[0].place.dx = 1.0; s.wings[0].place.dy = 0.2; s.engines[0].place.dx = -0.25;
      s.tail.place.dx = 0.6; s.gear.place.dx = -0.2; s.gear.place.dtrack = 0.4; s.fuselage.tailY = -0.2; }) },
  // B8: span 18 / chord 2.1 / xLE 3.0 - a derived tail arm of 8.99 m and a tailplane of 4.66 m
  { key: 'B8 18 m x 2.1 m, xLE 3.0', spec: mk(s => { s.wings[0].span = 18; s.wings[0].chord = 2.1; s.wings[0].xLE = 3.0; }) },
  { key: 'V-tail (derived)', spec: mk(s => { s.tail.type = 'v'; s.tail.vAngle = 35; }) },
  { key: 'twin boom', spec: mk(s => { s.tail.type = 'twinBoom'; s.tail.boomX = 1.2; s.tail.boomLen = 3.5; }) },
  { key: 'pusher', spec: mk(s => { s.engines[0].mount = 'pusher'; }) },
  { key: 'drone', spec: mk(s => { s.cabin.seating = 'drone'; }) },
  { key: 'legDrop 1.2', spec: mk(s => { s.gear.legDrop = 1.2; }) },
  { key: 'dorsal long and low', spec: mk(s => { s.tail.dorsal.height = 0.12; s.tail.dorsal.len = 1.6; }) },
];
// derived-envelope exceptions, declared: the tail arm's floor rule (boxRear + 0.9 chord) may stand past 6.5 m
const ENV_EXCEPT = { 'fuselage.tailArm': R => Math.max(6.5, R.fuse.boxRear + 0.9 * R.wing.chord) };

// ---- REGISTRY ----------------------------------------------------------------------------------------
console.log('-- REGISTRY: GEN_FIELDS against GEN_DEFAULT and clampSpec --');
{
  const F = C.GEN_FIELDS;
  const real = p => p.replace(/\[\]/g, '.0');
  for (const p in F) {
    const f = F[p], dv = getP(C.GEN_DEFAULT, real(p));
    ok(f.def === dv || (f.def === undefined && dv === undefined), `${p}: default ${JSON.stringify(f.def)} is GEN_DEFAULT's (${JSON.stringify(dv)})`);
    if (f.clamp && !f.join) {
      for (const [v, want] of [[1e6, f.clamp[1]], [-1e6, f.clamp[0]]]) {
        const s = D0();
        const segs = real(p).split('.'), last = segs.pop();
        const o = segs.reduce((x, k) => x[k], s);
        o[last] = v;
        const K = C.clampSpec(s);
        const got = getP(K, real(p));
        // an offset is consumed by the clamp (tailY) - its record says what was applied
        const seen = f.rule === 'offset' && p === 'fuselage.tailY' ? K._offsets[p] : got;
        ok(near(seen, want), `${p}: clampSpec cuts ${v} to ${want} (got ${seen})`);
      }
    }
  }
}

// ---- the per-spec checks ---------------------------------------------------------------------------------
function geomDiff(d0, d1) {
  const out = [];
  if (d0.nodes.length !== d1.nodes.length) out.push('nodes ' + d0.nodes.length + ' -> ' + d1.nodes.length);
  else d0.nodes.forEach((n, i) => {
    const m = d1.nodes[i];
    if (n.tag !== m.tag || !near(n.r, m.r) || !n.p.every((v, k) => near(v, m.p[k]))) out.push('node ' + i + ' ' + n.tag);
  });
  if (d0.beams.length !== d1.beams.length) out.push('beams ' + d0.beams.length + ' -> ' + d1.beams.length);
  // the TRUE stiffness (kTrue where the flight box softened a wing spring): the box is the integrator's cut at
  // the loading it is given (62_gen_aero genFlightBox reads the node masses), not the airframe
  else d0.beams.forEach((b, i) => {
    const c = d1.beams[i], kt = x => (x.kTrue != null ? x.kTrue : x.k);
    if (b.a !== c.a || b.b !== c.b || b.cls !== c.cls || !near(b.L, c.L) || !near(kt(b), kt(c))) out.push('beam ' + i + ' ' + b.cls);
  });
  if (d0.strips.length !== d1.strips.length) out.push('strips ' + d0.strips.length + ' -> ' + d1.strips.length);
  else d0.strips.forEach((s, i) => {
    const t = d1.strips[i];
    if (s.kind !== t.kind || !near(s.chord, t.chord) || !near(s.area, t.area)) out.push('strip ' + i + ' ' + s.kind);
  });
  for (const k of ['gx', 'tr', 'designGross'])
    if (!near(d0.parts[k], d1.parts[k])) out.push(k + ' ' + d0.parts[k] + ' -> ' + d1.parts[k]);
  return out;
}
// (a zero-length beam is the review's B10 - the twin boom's HTL/HTR on the boom chain - and GATE GENPAIRS's, not
// this arc's: finite is asked here, length is not)
const finiteDef = d => d.nodes.every(n => n.p.every(Number.isFinite) && Number.isFinite(n.m)) &&
  d.strips.every(s => Number.isFinite(s.area) && Number.isFinite(s.chord)) &&
  d.beams.every(b => Number.isFinite(b.L) && Number.isFinite(b.k));

function checkSpec(label, s, opts) {
  opts = opts || {};
  // CLAMP
  {
    const K1 = C.clampSpec(cl(s)), K2 = C.clampSpec(K1);
    const d = diff(K1, K2);
    ok(!d.length, `${label}: clampSpec is idempotent` + say(d));
  }
  // RESOLVE
  const R1 = C.resolveSpec(cl(s)).spec;
  {
    const R2 = C.resolveSpec(R1).spec;
    const d = diff(R1, R2);
    ok(!d.length, `${label}: resolve(resolve(s)) == resolve(s)` + say(d));
    // every derived registry field inside its envelope (the cabin's seating floor read as clampSpec reads it)
    const bad = [];
    for (const p in C.GEN_FIELDS) {
      const f = C.GEN_FIELDS[p];
      if (f.rule !== 'derive' || !f.clamp) continue;
      const vals = p.startsWith('wings[]') ? R1.wings.map(w => getP(w, p.slice(8))) : [getP(R1, p)];
      for (const v of vals) {
        if (v == null) continue;
        const hi = ENV_EXCEPT[p] ? ENV_EXCEPT[p](R1) : f.clamp[1];
        const inside = near(C.genFieldClamp(p, v, R1), v) || (ENV_EXCEPT[p] && v <= hi + 1e-9 && v >= f.clamp[0]);
        if (!inside) bad.push(p + '=' + v);
      }
    }
    ok(!bad.length, `${label}: every derived field inside its envelope (B8)` + (bad.length ? ' [' + bad.join(', ') + ']' : ''));
    // every offset consumed: zero on the resolved spec, recorded once
    const z = [];
    R1.wings.forEach((w, k) => { if (w.place.dx) z.push('wings.' + k + '.place.dx'); });
    if (R1.tail.place.dx) z.push('tail.place.dx');
    if (R1.fuselage.tailY) z.push('fuselage.tailY');
    ok(!z.length, `${label}: every offset consumed on the resolved spec` + (z.length ? ' [' + z.join(', ') + ']' : ''));
    if (opts.off) for (const k in opts.off)
      ok(near(R1._offsets[k], opts.off[k]), `${label}: ${k} recorded once (${R1._offsets[k]})`);
  }
  // BUILD
  const snap = JSON.stringify(s);
  const def = C.buildGen(s);
  ok(JSON.stringify(s) === snap, `${label}: buildGen leaves its input unchanged`);
  ok(finiteDef(def), `${label}: the lattice is finite`);
  {
    const snapD = JSON.stringify(def.spec);
    const def2 = C.buildGen(def.spec);
    ok(JSON.stringify(def.spec) === snapD, `${label}: buildGen(def.spec) leaves def.spec unchanged`);
    const d = diff(def.spec, def2.spec);
    ok(!d.length, `${label}: buildGen(def.spec).spec == def.spec` + say(d));
    const g = geomDiff(def, def2);
    ok(!g.length, `${label}: buildGen(def.spec) is the same lattice` + say(g));
  }
  // CORNERS
  {
    const S = def.spec, seats = Math.max(1, S.seats | 0);
    const full = (S.fuel && S.fuel.litres > 0) ? S.fuel.litres : 0;
    const res = full > 10 ? Math.max(4, 0.15 * full) : full;
    const bad = [];
    for (const occ of [1, seats]) for (const L of [full, res, 0]) {
      const cs = C.genSpecAtFuel(S, L);
      cs.cabin.pilots = 1; cs.cabin.pax = Math.max(0, occ - 1); cs.cabin.occupied = null;
      const g = geomDiff(def, C.buildGen(cs));
      if (g.length) bad.push(occ + ' aboard, ' + (+L).toFixed(1) + ' L: ' + g.slice(0, 3).join(', '));
    }
    ok(!bad.length, `${label}: the six corners (solo / full cabin x full / reserves / dry) are the stand's aeroplane` +
       (bad.length ? ' [' + bad.length + ': ' + bad.slice(0, 2).join(' | ') + ']' : ''));
  }
  return { R1, def };
}

console.log('-- the five validated builds --');
const VAL = {};
for (const b of BUILDS) VAL[b.key] = checkSpec(b.key, specOf(b));
console.log('-- the corpus (offsets, the envelope, the nulls) --');
const CR = {};
for (const c of CORPUS) CR[c.key] = checkSpec(c.key, c.spec, c);

// ---- the offsets land exactly once ----
console.log('-- every offset lands exactly once --');
{
  const R0 = CR.stock.R1;
  ok(near(CR['wing dx 0.5'].R1.wings[0].xLE, R0.wings[0].xLE + 0.5), 'wing dx 0.5 moves the resolved leading edge by 0.5');
  ok(near(CR['tail dx -0.8'].R1.tail.hX, R0.tail.hX - 0.8) && near(CR['tail dx -0.8'].R1.tail.vX, R0.tail.vX - 0.8),
     'tail dx -0.8 moves the tail stations by -0.8');
  ok(near(CR['tailY 0.3'].R1.fuselage.tailBot, R0.fuselage.tailBot + 0.3) &&
     near(CR['tailY 0.3'].R1.fuselage.tailTop, R0.fuselage.tailTop + 0.3), 'tailY 0.3 raises the tail-end section by 0.3');
  // the review's repro numbers: the first resolve is the aeroplane the editor showed (main xLE 0.88, hX 6.31)
  const A2 = CR['A2 wing 0.5 + tail 0.4'].R1;
  ok(Math.abs(A2.wings[0].xLE - 0.88) < 0.01 && Math.abs(A2.tail.hX - 6.31) < 0.01,
     `A2 repro: xLE ${A2.wings[0].xLE.toFixed(3)} / hX ${A2.tail.hX.toFixed(3)} (the review: 0.88 / 6.31, re-resolved 0.38 / 5.41 before)`);
  const G = CR['gear dx 0.3 dtrack 0.2'].def.parts, G0 = CR.stock.def.parts;
  ok(G.gx > G0.gx + 0.2 && G.tr > G0.tr + 0.15, `gear dx 0.3 / dtrack 0.2 move the mains (${G0.gx.toFixed(3)} -> ${G.gx.toFixed(3)}, track ${G0.tr.toFixed(3)} -> ${G.tr.toFixed(3)})`);
}

// ---- B8: the envelope holds the derivation ----
console.log('-- B8 / B9 / B13 --');
{
  const R = CR['B8 18 m x 2.1 m, xLE 3.0'].R1, E = C.GEN_TAIL_ENVELOPE;
  ok(R.tail.hSpan <= E.hSpan[1] + 1e-9 && R.fuse.tailArm <= ENV_EXCEPT['fuselage.tailArm'](R) + 1e-9 && R.tail.hX <= 9 + 1e-9,
     `B8: the derived tail stays in its envelope (hSpan ${R.tail.hSpan.toFixed(3)}, tailArm ${R.fuse.tailArm.toFixed(3)}, hX ${R.tail.hX.toFixed(3)}; was 4.66 / 8.99)`);
  // B9: zero and negative areas
  for (const [k, v, f] of [['Sh', 0], ['Sh', -1], ['Sv', 0], ['Svt', 0, s => { s.tail.type = 'v'; s.tail.hSpan = 2.4; s.tail.hChord = 0.7; }]]) {
    const s = mk(x => { x.tail[k] = v; if (f) f(x); });
    let good = false, msg = '';
    try { const d = C.buildGen(s); good = finiteDef(d) && d.spec.tail[k] >= C.GEN_FIELDS['tail.' + k].clamp[0]; msg = d.spec.tail[k]; }
    catch (e) { msg = 'threw ' + e.message; }
    ok(good, `B9: tail.${k} = ${v} builds finite, clamped to ${msg}`);
  }
  // B13: an explicit null on a non-derivable number is its default; a derivable null stays derived
  const s = mk(x => { x.wings[0].chord = null; x.wings[0].naca = null; x.fuselage.postGap = null;
                      x.controls.aileron.span = null; x.cabin.baggage = null; x.fuselage.tailArm = null; });
  const RN = C.resolveSpec(s), W = RN.spec.wings[0], Dd = C.GEN_DEFAULT;
  ok(W.chord === Dd.wings[0].chord && W.naca === Dd.wings[0].naca && RN.spec.fuselage.postGap === Dd.fuselage.postGap &&
     RN.spec.controls.aileron.span === Dd.controls.aileron.span && RN.spec.cabin.baggage === Dd.cabin.baggage,
     `B13: null chord / naca / postGap / aileron span / baggage read as the defaults (${W.chord} / ${W.naca} / ${RN.spec.fuselage.postGap} / ${RN.spec.controls.aileron.span} / ${RN.spec.cabin.baggage})`);
  ok(RN.auto['fuse.tailArm'] === true, 'B13: a null on a derivable field is still derived (tailArm auto)');
  ok(s.wings[0].chord === null, 'B13: the input keeps its null (a save keeps what it says)');
}

// ---- JOIN: on -> off -> commit through the garage's merge ----
if (NOJOIN) console.log('-- JOIN round trips: skipped (--no-join) --');
else {
  console.log('-- JOIN: the page\'s join, headless; on -> off -> commit through the garage\'s merge --');
  const BJ = require('./_bake_joined.js');
  BJ.loadPanel();
  // one case per join-owned registry row (GEN_FIELDS `join` with `states`); the gate fails on a row without one
  const ROWS = [
    { cage: { skinOn: 0 }, paths: ['fuselage.covering'] },
    { cage: { glazeOn: 0 }, paths: ['cabin.glazing'] },
    { cage: { wgCons: 1 }, paths: ['wings[].material'] },
    { cage: { finCons: 2 }, paths: ['tail.finMaterial'] },
    { cage: { stCons: 3 }, paths: ['tail.stabMaterial'] },
    { cage: { stCant: 30 }, paths: ['tail.type'] },
    { cage: { wgPos: 3, bpCabane: 1 }, paths: ['bracing.cabane'] },
    { cage: { w2On: 1 }, paths: ['bracing.interplane', 'bracing.interplaneAt', 'bracing.wires'] },
  ];
  {
    const covered = new Set([].concat(...ROWS.map(r => r.paths)));
    const owned = Object.keys(C.GEN_FIELDS).filter(p => C.GEN_FIELDS[p].join && C.GEN_FIELDS[p].join.states);
    const miss = owned.filter(p => !covered.has(p));
    ok(!miss.length, 'every join-owned registry row has a round-trip case' + (miss.length ? ' [' + miss.join(', ') + ']' : ''));
  }
  const joinOf = s => { const r = BJ.bakeJoined(s); return { spec: r.spec, errors: r.errors }; };
  const withCage = (s, over) => { const x = cl(s); x.cage = Object.assign({}, x.cage, over); return x; };
  const SKIP = /^(_|cage\.)/;     // the cage is the editor's own record (replaced whole); underscored keys are readouts
  const roundTrip = (label, A, over) => {
    const B = joinOf(withCage(A, over)).spec;
    const back = cl(B); back.cage = cl(A.cage);
    const Cc = joinOf(back).spec;
    const reached = Object.keys(over).length && diff(A, B, SKIP).length > 0;
    ok(reached, `${label}: ON reaches the build (${Object.keys(over).map(k => k + '=' + over[k]).join(' ')})`);
    // a state's `with` keys are stated null in the file, in both commits (GEN_FIELDS 'tail.type')
    for (const [X, nm] of [[A, 'never-on'], [B, 'on']]) for (const p in C.GEN_FIELDS) {
      const W = C.GEN_FIELDS[p].join && C.GEN_FIELDS[p].join.with, st = getP(X, p);
      if (!W || !W[st]) continue;
      const left = W[st].filter(q => getP(X, q) != null);
      ok(!left.length, `${label}: ${p} '${st}' (${nm}) states its other types' keys null` + (left.length ? ' [' + left.join(', ') + ']' : ''));
    }
    const dF = diff(A, Cc, SKIP);
    ok(!dF.length, `${label}: ON -> OFF -> commit leaves the file as never-on` + say(dF, 6));
    const dR = diff(C.resolveSpec(cl(A)).spec, C.resolveSpec(cl(Cc)).spec, SKIP);
    ok(!dR.length, `${label}: ...and the resolved spec` + say(dR, 6));
  };
  const t0 = Date.now();
  for (const b of BUILDS) {
    // the build as the editor commits it - twice: the headless scene is built once per process, and the first
    // join after ANOTHER build can read that build's engine layer (measured: the twin's wing pair came out null,
    // or at the Cessna's units, on the first commit and at its own on the second, and stayed there) - a harness
    // history, not the merge under test (HANDOVER G1550)
    const A = joinOf(joinOf(specOf(b)).spec).spec;
    // the commit is itself a fixed point of the join (a second commit changes nothing)
    const A2 = joinOf(cl(A)).spec;
    const d0 = diff(A, A2, SKIP);
    ok(!d0.length, `${b.key}: a second commit changes nothing` + say(d0, 6));
    if (b.key === 'cub') for (const r of ROWS) roundTrip('cub ' + r.paths[0], A, r.cage);
    else roundTrip(b.key + ' (every row at once)', A, { skinOn: 0, glazeOn: 0, wgCons: 1, finCons: 2, stCons: 3, stCant: 30 });
  }
  console.log(`  (joins: ${((Date.now() - t0) / 1000).toFixed(1)} s)`);
}

console.log(fails ? `\n  ${fails} check(s) failed` : '');
console.log('GATE SPECFIX: ' + (fails ? 'FAIL' : 'PASS'));
process.exit(fails ? 1 : 0);
