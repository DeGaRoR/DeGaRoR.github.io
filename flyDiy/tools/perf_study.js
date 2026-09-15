#!/usr/bin/env node
// PERF STUDY (G396.5, 2026-09-15) — the recreation cards against the real
// aeroplanes they are named after, on the numbers a POH or a type sheet
// prints. Not a gate: a bench that prints a table and the deltas, so the
// discrepancies can be ranked and diagnosed.
//
//   node tools/perf_study.js               -> the probe pass (every card, ~1 min)
//   node tools/perf_study.js --fly=cub,jodel -> plus the flown pass on those cards
//                                            (the pilot's own take-off run, climb,
//                                             landing roll; ~5 min each)
//   node tools/perf_study.js --md=out.md   -> the table as markdown
//
// THE INDICATORS (each one is a number a real POH states at MTOW, sea level,
// ISA, and each one is MEASURED here, never read off a rule):
//   mass    all-up mass as baked (kg)         vs MTOW (and empty, for the split)
//   S, b    wing area (m2), span (m)          wing loading follows
//   T0/W    static thrust over weight         the prop model's word
//   Vs      the measured clean stall (km/h)   Vs1 (flaps up) — the wing + the mass
//   V75     level speed at 75 % thrust (km/h) the drag polar (probe sweep)
//   Vmax    level speed at full thrust (km/h)
//   ROC     climb rate at Vy (m/s)            (T - D)/W over the speed sweep, the best
//   L/D     the best glide ratio
//   TO      the take-off ground roll (m)      analytic (genTORunAt) and flown (--fly)
//   LDG     the landing roll (m)              flown only
//
// THE REAL NUMBERS are POH / type-certificate values as commonly published
// (approximate to 5 %; sea level, ISA, MTOW; Vs1 = flaps up, power off). Cards
// whose ENGINE is not the real one (the Tiger Moth-alike on an A-65, the
// Stearman-alike on an R-985) are compared on wing and mass only — the
// power-bound numbers are flagged.
'use strict';
const path = require('path');
const T = __dirname;

function loadPanel() {
  const CORE = require(path.join(T, 'flight_core.js'));
  for (const k of Object.keys(CORE)) global[k] = CORE[k];
  const noop = function () { return this; };
  class Obj {
    constructor() {
      this.children = []; this.position = { set: noop };
      this.rotation = {}; this.scale = { set: noop, setScalar: noop };
    }
    add() { return this; } remove() {} traverse() {}
  }
  global.THREE = new Proxy({}, { get: (t, k) => {
    if (k === 'Vector3')
      return function () { return { set: noop, x: 0, y: 0, z: 0 }; };
    return class extends Obj {};
  } });
  global.window = { THREE: global.THREE };
  for (const f of ['_cage_parts.js', '_cage_page5.js', '_cage_gen.js',
    '_cage_crew.js', '_gear_kit.js', '_gear_gen.js', '_gear_page.js',
    '_cage_gear.js', '_cage_float.js', '_fit_site.js', '_fit_gen.js',
    '_eng_gen.js', '_eng_mesh.js', '_eng_page.js',
    '_cowl_gen.js', '_cowl_rows.js', '_cage_cowl.js', '_cage_eng.js',
    '_strut_gen.js', '_boom_gen.js', '_cage_wing.js', '_cage_brace.js', '_fin_gen.js', '_cage_fin.js',
    '_cage_stab.js', '_cage_access.js', '_cage_light.js'])
    require(path.join(T, f));
  global.window.CAGE_JOIN_ENGINES = require(path.join(T, '_cage_join.js')).CAGE_JOIN_ENGINES;
  return global.window;
}
loadPanel();
const D = require(path.join(T, '_cage_design.js'));
const C = require(path.join(T, 'flight_core.js'));

// ---------------------------------------------------------------------------
// THE REAL AEROPLANES. kmh = km/h TAS at sea level; roc m/s; runs in metres.
// `engineMatch` false: the card's engine is not the type's, power numbers are
// not comparable and are printed in brackets.
// ---------------------------------------------------------------------------
const REAL = {
  cub:       { name: 'Piper J-3C-65 Cub', mtow: 550, empty: 345, S: 16.6, b: 10.7, powerKW: 48,
               Vs1: 61, V75: 120, Vmax: 140, roc: 2.3, TO: 113, LDG: 88, LD: 9.5, T0: 1200, engineMatch: true,
               src: 'POH J-3C-65: stall 38 mph, cruise 75 mph, Vmax 87 mph, 450 fpm, TO run 370 ft, ldg 290 ft' },
  pietenpol: { name: 'Pietenpol Air Camper (A-65)', mtow: 476, empty: 280, S: 14.6, b: 8.8, powerKW: 48,
               Vs1: 56, V75: 120, Vmax: 137, roc: 2.5, TO: 120, LDG: 100, LD: 8, T0: 1200, engineMatch: true,
               src: 'type data: stall 35 mph, cruise 75, Vmax 85, 500 fpm' },
  tigermoth: { name: 'DH.82 Tiger Moth (Gipsy Major 130 hp)', mtow: 828, empty: 506, S: 22.2, b: 8.9, powerKW: 97,
               Vs1: 72, V75: 145, Vmax: 175, roc: 3.2, TO: 150, LDG: 120, LD: 8, engineMatch: false,
               src: 'type data: stall 45 mph, cruise 90, Vmax 109, 635 fpm — the card flies an A-65' },
  stearman:  { name: 'Boeing-Stearman PT-17 (R-670 220 hp)', mtow: 1232, empty: 878, S: 27.6, b: 9.8, powerKW: 164,
               Vs1: 87, V75: 170, Vmax: 200, roc: 4.3, TO: 180, LDG: 150, LD: 7.5, engineMatch: false,
               src: 'type data: stall 55 mph, cruise 106, Vmax 124, 840 fpm — the card flies an R-985' },
  jodel:     { name: 'Jodel D.119 (O-200)', mtow: 650, empty: 360, S: 12.7, b: 8.2, powerKW: 75,
               Vs1: 68, V75: 175, Vmax: 200, roc: 3.5, TO: 200, LDG: 150, LD: 11, T0: 1600, engineMatch: true,
               src: 'type data D.119: stall 68 km/h, cruise 175, Vmax 200, 700 fpm, TO 200 m' },
  c172:      { name: 'Cessna 172R (IO-360-L2A 160 hp)', mtow: 1111, empty: 736, S: 16.2, b: 11.0, powerKW: 119,
               Vs1: 87, V75: 218, Vmax: 230, roc: 3.7, TO: 288, LDG: 168, LD: 9, T0: 2290, engineMatch: true,
               src: 'POH 172R: Vs1 47 KCAS, 75 % cruise ~118 KTAS at SL, 720 fpm, ground roll 945 ft, ldg roll 550 ft' },
  caravan:   { name: 'Cessna 208 Caravan (PT6A-114A 675 shp)', mtow: 3629, empty: 2145, S: 25.96, b: 15.9, powerKW: 503,
               Vs1: 144, V75: 324, Vmax: 340, roc: 5.0, TO: 354, LDG: 224, LD: 11, engineMatch: true,
               src: 'POH 208: Vs1 78 KCAS, Vs0 61, cruise 175 KTAS at SL, 975 fpm, ground roll 1160 ft, ldg 735 ft' },
  rv:        { name: 'Van\'s RV-7 (IO-360 180 hp)', mtow: 816, empty: 500, S: 11.2, b: 7.6, powerKW: 134,
               Vs1: 93, V75: 310, Vmax: 340, roc: 8.0, TO: 150, LDG: 150, LD: 11, engineMatch: true,
               src: 'Van\'s data: stall 58 mph, 75 % cruise 193 mph, Vmax 210, 1600 fpm, TO 500 ft' },
  savannah:  { name: 'ICP Savannah S (Rotax 912 100 hp)', mtow: 600, empty: 300, S: 13.0, b: 9.0, powerKW: 73,
               Vs1: 52, V75: 160, Vmax: 190, roc: 5.0, TO: 60, LDG: 70, LD: 9, engineMatch: true,
               src: 'ICP data: stall 45 km/h (flaps), 52 clean, cruise 160, Vmax 190, 1000 fpm, TO 60 m' },
  mw5:       { name: 'Whittaker MW5 Sorcerer (Rotax 503)', mtow: 300, empty: 160, S: 12.1, b: 8.5, powerKW: 37,
               Vs1: 48, V75: 90, Vmax: 105, roc: 3.0, TO: 80, LDG: 70, LD: 8, engineMatch: false,
               src: 'type data MW5: stall 30 mph, cruise 55, 600 fpm — the card flies a 582' },
  da62:      { name: 'Diamond DA62 (2 x AE330 180 hp)', mtow: 2300, empty: 1600, S: 17.1, b: 14.6, powerKW: 268,
               Vs1: 143, V75: 315, Vmax: 350, roc: 5.2, TO: 500, LDG: 400, LD: 12, engineMatch: false,
               src: 'AFM DA62: Vs1 77 KCAS, Vs0 68, cruise 170 KTAS at SL, 1029 fpm — the card flies two IO-360 (160 hp)' },
  beaver:    { name: 'DHC-2 Beaver (R-985 450 hp)', mtow: 2313, empty: 1361, S: 23.2, b: 14.6, powerKW: 336,
               Vs1: 111, V75: 222, Vmax: 260, roc: 5.2, TO: 170, LDG: 150, LD: 9, engineMatch: true,
               src: 'type data: stall 60 kn clean, 45 flaps, cruise 120 kn, Vmax 140, 1020 fpm, TO 560 ft' },
};

// ---------------------------------------------------------------------------
// THE PROBES — the same instruments the shakedown flies (sim.probe at a speed
// and an angle), swept over speed for the level-flight thrust/drag balance
// ---------------------------------------------------------------------------
function probeAt(sim, V, a) {
  const [xA, yU] = sim.axes();
  const vel = [0, 0, 0];
  for (let k = 0; k < 3; k++) vel[k] = -V * (Math.cos(a) * xA[k] + Math.sin(a) * yU[k]);
  const r = sim.probe(vel);
  r.drag = -(r.Fx * -Math.cos(a) * xA[0] + r.Fy * -Math.cos(a) * xA[1] + r.Fz * -Math.cos(a) * xA[2])
           - (r.Fx * -Math.sin(a) * yU[0] + r.Fy * -Math.sin(a) * yU[1] + r.Fz * -Math.sin(a) * yU[2]);
  return r;
}
function alphaForLift(sim, V, W, aMax) {
  let a0 = 0.01, a1 = 0.09;
  let f0 = probeAt(sim, V, a0).Fy - W, f1 = probeAt(sim, V, a1).Fy - W;
  for (let i = 0; i < 10; i++) {
    if (Math.abs(f1 - f0) < 1e-9) break;
    let a2 = a1 - f1 * (a1 - a0) / (f1 - f0);
    a2 = Math.min(aMax, Math.max(-0.08, a2));
    a0 = a1; f0 = f1; a1 = a2; f1 = probeAt(sim, V, a1).Fy - W;
    if (Math.abs(f1) < 0.5) break;
  }
  return { a: a1, ok: Math.abs(f1) < 0.02 * W };
}
// level flight over the speed sweep: drag(V) and the thrust the prop makes
function sweep(def, sim, W) {
  const aMax = 0.85 * def.params.polarWing.aStall;
  const Vs = def.params.gen.VsMeas || def.params.gen.Vs || 15;
  const rows = [];
  for (let V = Vs * 1.05; V <= Vs * 4.0; V += Vs * 0.05) {
    const al = alphaForLift(sim, V, W, aMax);
    if (!al.ok) continue;
    const r = probeAt(sim, V, al.a);
    const T1 = sim.thrustAt(V, 1);
    rows.push({ V, drag: r.drag, T1, LD: r.Fy / Math.max(1e-6, r.drag), excess: (T1 - r.drag) * V / W });
  }
  return rows;
}
function levelSpeedAt(rows, frac) {
  // the highest V where drag <= frac * T1 (interpolated)
  let best = null;
  for (let i = 0; i < rows.length - 1; i++) {
    const a = rows[i], b = rows[i + 1];
    const fa = frac * a.T1 - a.drag, fb = frac * b.T1 - b.drag;
    if (fa >= 0 && fb < 0) best = a.V + (b.V - a.V) * fa / (fa - fb);
  }
  if (best == null && rows.length && frac * rows[rows.length - 1].T1 >= rows[rows.length - 1].drag) best = rows[rows.length - 1].V;
  return best;
}

function measure(key) {
  const a = D.ARCHETYPES.find(x => x.key === key);
  if (!a) return null;
  const R = REAL[key];
  const spec0 = D.designBake(a.sel, a.over);
  const def0 = C.buildGen(spec0);
  const sim0 = C.makeSim(def0, null); sim0.reset(0);
  // THE SPLIT the ledger keeps: empty (structure, engine, systems) against
  // the payload (crew, fuel, freight) — a POH's empty weight is the former
  const L = def0.parts.ledger || {};
  let empty = 0, payload = 0; for (const k in L) { if (L[k].payload) payload += L[k].mass; else empty += L[k].mass; }
  const asBaked = sim0.totalM;
  // AT MTOW: the POH's numbers are at gross weight, so the card is loaded to
  // the type's MTOW with freight before it is measured (a lighter card
  // stalls slower, climbs faster and rolls shorter for the mass alone)
  const spec = D.designBake(a.sel, a.over);
  const ballast = R && R.mtow > asBaked ? R.mtow - asBaked : 0;
  spec.cargo = spec.cargo || { len: 0, kg: 0 }; spec.cargo.kg = (spec.cargo.kg || 0) + ballast;
  const def = C.buildGen(spec);
  const sim = C.makeSim(def, null); sim.reset(0);
  const W = sim.totalM * 9.81;
  const sh = C.genShakedown(def, { slim: true });
  const rows = sweep(def, sim, W);
  const V75 = levelSpeedAt(rows, 0.75), Vmax = levelSpeedAt(rows, 1.0);
  let roc = 0, Vy = 0, LD = 0; for (const r of rows) { if (r.excess > roc) { roc = r.excess; Vy = r.V; } if (r.LD > LD) LD = r.LD; }
  const PR = def.params.prop || {}; const nE = def.params.nEngines || 1;
  const T0 = sim.thrustAt(0, 1);
  const to = C.genTORunAt(sim, def, W);
  return { key, name: a.name, mass: sim.totalM, asBaked, empty, payload, ballast, S: sh.Sw, b: sh.span, T0, T0W: T0 / W, Vs: sh.Vs * 3.6, V75: V75 && V75 * 3.6, Vmax: Vmax && Vmax * 3.6,
           roc, Vy: Vy * 3.6, LD, TO: to.sRoll, TO50: to.TORun, powerKW: (def.params.powerW || (PR.powerW || 0)) / 1000, nE, sh, def, spec };
}

function fly(def, spec) {
  const world = C.makeWorld();
  const sim = C.makeSim(def, world); sim.reset(0);
  for (let i = 0; i < 300; i++) sim.step(1 / 60);
  const ap = C.makePilot(sim, def, world);
  const rec = { liftRun: null, climb: null, ldg: null, outcome: null, t: 0 };
  let sRoll = null, climbT0 = null, climbH0 = null, climbSum = 0, climbN = 0, thrCruise = [], vCruise = [];
  for (let s = 0; s < 700 * 60; s++) {
    ap.update(1 / 60); sim.step(1 / 60);
    if (ap.phase === 'ROLL' && sRoll == null && ap.dbg) sRoll = ap.dbg.s;
    if (ap.phase === 'LIFTOFF' && rec.liftRun == null && sRoll != null && ap.dbg) rec.liftRun = Math.abs(ap.dbg.s - sRoll);
    if (ap.phase === 'CLIMB') { if (climbT0 == null) { climbT0 = s; climbH0 = sim.out.alt; } else if (s - climbT0 > 120 && s - climbT0 < 1800) { climbSum += sim.out.vs; climbN++; } }
    if (ap.phase === 'DOWNWIND' && s % 60 === 0) { thrCruise.push(sim.ctl.thr); vCruise.push(sim.out.V); }
    if (sim.stats().bad) { rec.outcome = 'nan'; break; }
    if (ap.phase === 'STOPPED' && ap.t > 5) { rec.t = s / 60; break; }
  }
  rec.climb = climbN ? climbSum / climbN : null;
  rec.thrCruise = thrCruise.length ? thrCruise.reduce((x, y) => x + y, 0) / thrCruise.length : null;
  rec.vCruise = vCruise.length ? vCruise.reduce((x, y) => x + y, 0) / vCruise.length * 3.6 : null;
  rec.ldg = ap.report.landing ? ap.report.landing.run : null;
  rec.outcome = rec.outcome || ap.report.outcome;
  return rec;
}

// ---------------------------------------------------------------------------
const args = process.argv.slice(2);
const flyKeys = ((args.find(x => x.startsWith('--fly=')) || '').slice(6)).split(',').filter(Boolean);
const mdOut = (args.find(x => x.startsWith('--md=')) || '').slice(5);
const only = ((args.find(x => x.startsWith('--only=')) || '').slice(7)).split(',').filter(Boolean);
const keys = (only.length ? only : Object.keys(REAL)).filter(k => D.ARCHETYPES.some(a => a.key === k));
const f = (v, d = 0) => v == null || !isFinite(v) ? '—' : (+v).toFixed(d);
const pct = (ours, real) => (ours == null || real == null || !isFinite(ours)) ? '—' : ((ours / real - 1) * 100).toFixed(0) + ' %';
const lines = [];
const out = s => { console.log(s); lines.push(s); };
out('| card | real aeroplane | empty kg (real) | as baked / at MTOW kg | S m² | T0/W | Vs km/h | V75 km/h | Vmax km/h | ROC m/s | L/D | TO roll m | TO 50 ft m |');
out('|---|---|---|---|---|---|---|---|---|---|---|---|---|');
const results = [];
for (const k of keys) {
  const R = REAL[k]; let m;
  try { m = measure(k); } catch (e) { out('| ' + k + ' | ' + R.name + ' | build threw: ' + e.message.slice(0, 40) + ' |'); continue; }
  if (!m) continue;
  const pw = R.engineMatch ? '' : ' (engine differs)';
  const cell = (ours, real, d) => f(ours, d) + ' / ' + f(real, d) + ' (' + pct(ours, real) + ')';
  out('| ' + k + ' | ' + R.name + pw + ' | ' + cell(m.empty, R.empty) + ' | ' + f(m.asBaked) + ' / ' + f(m.mass) + ' | ' + cell(m.S, R.S, 1) + ' | ' + f(m.T0W, 2) + (R.T0 ? ' / ' + f(R.T0 / (R.mtow * 9.81), 2) : '') +
      ' | ' + cell(m.Vs, R.Vs1) + ' | ' + cell(m.V75, R.V75) + ' | ' + cell(m.Vmax, R.Vmax) + ' | ' + cell(m.roc, R.roc, 1) + ' | ' + cell(m.LD, R.LD, 1) + ' | ' + cell(m.TO, R.TO) + ' | ' + cell(m.TO50, R.TO50) + ' |');
  results.push({ k, R, m });
}
if (flyKeys.length) {
  out('');
  out('| card (flown, the pilot) | TO run m (ours / real) | climb m/s at VClimb (ours / real ROC) | cruise: V km/h at thr (level) | landing roll m (ours / real) | outcome |');
  out('|---|---|---|---|---|---|');
  for (const r of results) {
    if (!flyKeys.includes(r.k)) continue;
    const t0 = Date.now();
    const fl = fly(r.m.def, r.m.spec);
    out('| ' + r.k + ' | ' + cell2(fl.liftRun, r.R.TO) + ' | ' + cell2(fl.climb, r.R.roc, 1) + ' | ' + f(fl.vCruise) + ' at ' + f(fl.thrCruise, 2) + ' | ' + cell2(fl.ldg, r.R.LDG) + ' | ' + fl.outcome + ' (' + f(fl.t) + ' s, ' + ((Date.now() - t0) / 1000).toFixed(0) + ' s wall) |');
  }
}
function cell2(ours, real, d) { return f(ours, d) + ' / ' + f(real, d) + ' (' + pct(ours, real) + ')'; }
// the ranked discrepancies, engine-matched cards only, power-bound numbers
out('');
out('RANKED DISCREPANCIES (engine-matched cards, |ours/real - 1|):');
const disc = [];
for (const r of results) {
  const R = r.R, m = r.m;
  const add = (what, ours, real) => { if (ours != null && real != null && isFinite(ours)) disc.push({ card: r.k, what, ours, real, d: ours / real - 1 }); };
  add('empty', m.empty, R.empty); add('Vs', m.Vs, R.Vs1); add('L/D', m.LD, R.LD); add('S', m.S, R.S);
  if (R.engineMatch) { add('V75', m.V75, R.V75); add('Vmax', m.Vmax, R.Vmax); add('ROC', m.roc, R.roc); add('TO roll', m.TO, R.TO); add('TO 50ft', m.TO50, R.TO50); if (R.T0) add('T0', m.T0, R.T0); }
}
disc.sort((a, b) => Math.abs(b.d) - Math.abs(a.d));
for (const x of disc.slice(0, 40)) out('  ' + (x.d > 0 ? '+' : '') + (x.d * 100).toFixed(0).padStart(4) + ' %  ' + x.card.padEnd(10) + x.what.padEnd(7) + ' ours ' + f(x.ours, 1) + '  real ' + f(x.real, 1));
// the same, by indicator (the mean signed error)
out('');
out('BY INDICATOR (mean signed error over the engine-matched cards):');
const byWhat = {};
for (const x of disc) { if (!REAL[x.card].engineMatch) continue; (byWhat[x.what] = byWhat[x.what] || []).push(x.d); }
for (const w in byWhat) { const a = byWhat[w]; out('  ' + w.padEnd(7) + ' ' + ((a.reduce((p, q) => p + q, 0) / a.length) * 100).toFixed(0).padStart(4) + ' %  (n ' + a.length + ', spread ' + (Math.min(...a) * 100).toFixed(0) + '..' + (Math.max(...a) * 100).toFixed(0) + ')'); }
if (mdOut) require('fs').writeFileSync(mdOut, lines.join('\n') + '\n');
