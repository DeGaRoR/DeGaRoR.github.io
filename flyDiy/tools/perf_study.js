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
//   node tools/perf_study.js --ledger      -> the ledger row by row + the drag
//                                            build-up per card (the chantiers' instrument)
//   node tools/perf_study.js --birth       -> the pre-join (birth) spec, as GATE
//                                            ARCHETYPES flies it; the default is the
//                                            JOINED spec, as the game flies it (chantier 1)
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
// whose ENGINE is not the real one (the DA62-alike on two IO-360s for its
// AE330s) are compared on wing and mass only — the power-bound numbers are
// flagged. (The Tiger Moth-, Stearman- and MW5-alikes fly their own engines
// since chantier 0, 2026-09-15.)
'use strict';
const path = require('path');
const T = __dirname;

// the panel and the JOINED bake (chantier 1): a card as the game flies it —
// the birth spec with the join's measurements (the cabin box, the seats,
// the profile, the gear stations, the tail) merged over it; --birth
// measures the pre-join spec GATE ARCHETYPES flies instead
const BJ = require(path.join(T, '_bake_joined.js'));
const { D, C } = BJ.loadPanel();

// ---------------------------------------------------------------------------
// THE REAL AEROPLANES. kmh = km/h TAS at sea level; roc m/s; runs in metres.
// `engineMatch` false: the card's engine is not the type's, power numbers are
// not comparable and are printed in brackets. `CdS` is the type's parasite
// drag area (m2) from 75 % power at V75 with a prop efficiency of 0.75 (the
// study's 4.2 derivation; +-10 %), where the power and the speed are known.
// ---------------------------------------------------------------------------
const REAL = {
  cub:       { name: 'Piper J-3C-65 Cub', mtow: 550, empty: 345, S: 16.6, b: 10.7, powerKW: 48,
               Vs1: 61, V75: 120, Vmax: 140, roc: 2.3, TO: 113, LDG: 88, LD: 9.5, T0: 1200, CdS: 0.75, engineMatch: true,
               src: 'POH J-3C-65: stall 38 mph, cruise 75 mph, Vmax 87 mph, 450 fpm, TO run 370 ft, ldg 290 ft' },
  pietenpol: { name: 'Pietenpol Air Camper (A-65)', mtow: 476, empty: 280, S: 13.5, b: 8.8, powerKW: 48,
               Vs1: 56, V75: 120, Vmax: 137, roc: 2.5, TO: 120, LDG: 100, LD: 8, T0: 1200, engineMatch: true,
               src: 'type data: stall 35 mph, cruise 75, Vmax 85, 500 fpm' },
  tigermoth: { name: 'DH.82 Tiger Moth (Gipsy Major 130 hp)', mtow: 828, empty: 506, S: 22.2, b: 8.9, powerKW: 97,
               Vs1: 72, V75: 145, Vmax: 175, roc: 3.2, TO: 150, LDG: 120, LD: 8, engineMatch: true,
               src: 'type data: stall 45 mph, cruise 90, Vmax 109, 635 fpm' },
  stearman:  { name: 'Boeing-Stearman PT-17 (R-670 220 hp)', mtow: 1232, empty: 878, S: 27.6, b: 9.8, powerKW: 164,
               Vs1: 87, V75: 170, Vmax: 200, roc: 4.3, TO: 180, LDG: 150, LD: 7.5, engineMatch: true,
               src: 'type data: stall 55 mph, cruise 106, Vmax 124, 840 fpm' },
  jodel:     { name: 'Jodel D.119 (O-200)', mtow: 650, empty: 360, S: 12.7, b: 8.2, powerKW: 75,
               Vs1: 68, V75: 175, Vmax: 200, roc: 3.5, TO: 200, LDG: 150, LD: 11, T0: 1600, CdS: 0.45, engineMatch: true,
               src: 'type data D.119: stall 68 km/h, cruise 175, Vmax 200, 700 fpm, TO 200 m' },
  c172:      { name: 'Cessna 172R (IO-360-L2A 160 hp)', mtow: 1111, empty: 736, S: 16.2, b: 11.0, powerKW: 119,
               Vs1: 87, V75: 218, Vmax: 230, roc: 3.7, TO: 288, LDG: 168, LD: 9, T0: 2290, CdS: 0.47, engineMatch: true,
               src: 'POH 172R: Vs1 47 KCAS, 75 % cruise ~118 KTAS at SL, 720 fpm, ground roll 945 ft, ldg roll 550 ft' },
  caravan:   { name: 'Cessna 208 Caravan (PT6A-114A 675 shp)', mtow: 3629, empty: 2145, S: 25.96, b: 15.9, powerKW: 503,
               Vs1: 144, V75: 324, Vmax: 340, roc: 5.0, TO: 354, LDG: 224, LD: 11, CdS: 0.57, engineMatch: true,
               src: 'POH 208: Vs1 78 KCAS, Vs0 61, cruise 175 KTAS at SL, 975 fpm, ground roll 1160 ft, ldg 735 ft' },
  rv:        { name: 'Van\'s RV-7 (IO-360 180 hp)', mtow: 816, empty: 500, S: 11.2, b: 7.6, powerKW: 134,
               Vs1: 93, V75: 310, Vmax: 340, roc: 8.0, TO: 150, LDG: 150, LD: 11, CdS: 0.20, engineMatch: true,
               src: 'Van\'s data: stall 58 mph, 75 % cruise 193 mph, Vmax 210, 1600 fpm, TO 500 ft' },
  savannah:  { name: 'ICP Savannah S (Rotax 912 100 hp)', mtow: 600, empty: 300, S: 13.0, b: 9.0, powerKW: 73,
               Vs1: 52, V75: 160, Vmax: 190, roc: 5.0, TO: 60, LDG: 70, LD: 9, engineMatch: true,
               src: 'ICP data: stall 45 km/h (flaps), 52 clean, cruise 160, Vmax 190, 1000 fpm, TO 60 m' },
  mw5:       { name: 'Whittaker MW5 Sorcerer (Rotax 503)', mtow: 300, empty: 160, S: 12.1, b: 8.5, powerKW: 37,
               Vs1: 48, V75: 90, Vmax: 105, roc: 3.0, TO: 80, LDG: 70, LD: 8, engineMatch: true,
               src: 'type data MW5: stall 30 mph, cruise 55, 600 fpm' },
  da62:      { name: 'Diamond DA62 (2 x AE330 180 hp)', mtow: 2300, empty: 1600, S: 17.1, b: 14.6, powerKW: 268,
               Vs1: 143, V75: 315, Vmax: 350, roc: 5.2, TO: 500, LDG: 400, LD: 12, engineMatch: false,
               src: 'AFM DA62: Vs1 77 KCAS, Vs0 68, cruise 170 KTAS at SL, 1029 fpm — the card flies two IO-360 (160 hp)' },
  beaver:    { name: 'DHC-2 Beaver (R-985 450 hp)', mtow: 2313, empty: 1361, S: 23.2, b: 14.6, powerKW: 336,
               Vs1: 111, V75: 222, Vmax: 260, roc: 5.2, TO: 170, LDG: 150, LD: 9, CdS: 0.80, engineMatch: true,
               src: 'type data: stall 60 kn clean, 45 flaps, cruise 120 kn, Vmax 140, 1020 fpm, TO 560 ft' },
};

// THE PROBES live in tools/_perf_probe.js since chantier 2 (GATE DRAG reads
// the same instruments): probeAt, alphaForLift, sweep/sweepAt, levelSpeedAt,
// parasiteFit, ballast
const { sweepAt, levelSpeedAt, parasiteFit, ballast } = require(path.join(T, '_perf_probe.js'));

function measure(key) {
  const a = D.ARCHETYPES.find(x => x.key === key);
  if (!a) return null;
  const R = REAL[key];
  let spec0, joinErrs = [];
  if (birth) spec0 = D.designBake(a.sel, a.over);
  else { const bj = BJ.bakeCard(key); spec0 = bj.spec; joinErrs = bj.errors; }
  const def0 = C.buildGen(spec0);
  const sim0 = C.makeSim(def0, null); sim0.reset(0);
  // THE SPLIT the ledger keeps: empty (structure, engine, systems) against
  // the payload (crew, fuel, freight) — a POH's empty weight is the former
  const L = def0.parts.ledger || {};
  let empty = 0, payload = 0; for (const k in L) { if (L[k].payload) payload += L[k].mass; else empty += L[k].mass; }
  const asBaked = sim0.totalM;
  // AT MTOW: the POH's numbers are at gross weight, so the card is loaded to
  // the type's MTOW before it is measured (a lighter card stalls slower,
  // climbs faster and rolls shorter for the mass alone) - through the door,
  // at its own CG (see ballast()); the spec and the def are the card's own
  const spec = spec0, def = def0;
  const kg = R && R.mtow > asBaked ? R.mtow - asBaked : 0;
  const sim = C.makeSim(def, null); sim.reset(0);
  ballast(sim, kg);
  const W = sim.totalM * 9.81;
  const sh = C.genShakedown(def, { slim: true });
  // the shakedown's stall is the as-baked one; Vs goes as sqrt(m)
  const Vs = sh.Vs * Math.sqrt(sim.totalM / asBaked);
  const rows = sweepAt(def, sim, W, Vs);
  const V75 = levelSpeedAt(rows, 0.75), Vmax = levelSpeedAt(rows, 1.0);
  let roc = 0, Vy = 0, LD = 0; for (const r of rows) { if (r.excess > roc) { roc = r.excess; Vy = r.V; } if (r.LD > LD) LD = r.LD; }
  const PR = def.params.prop || {}; const nE = def.params.nEngines || 1;
  const T0 = sim.thrustAt(0, 1);
  const to = C.genTORunAt(sim, def, W);
  const fit = parasiteFit(rows, Vs, sim.probeAir().rho);
  const G = def.params.gen || {};
  const drag = { CdS: fit && fit.CdS, kInd: fit && fit.kInd, fusCdA: def.params.fusCdA && def.params.fusCdA[0],
                 gearDCdA: G.gearDCdA, braceDCdA: G.braceDCdA, breakdown: G.drag || null };
  return { key, name: a.name, mass: sim.totalM, asBaked, empty, payload, ballast: kg, S: sh.Sw, b: sh.span, T0, T0W: T0 / W, Vs: Vs * 3.6, V75: V75 && V75 * 3.6, Vmax: Vmax && Vmax * 3.6,
           roc, Vy: Vy * 3.6, LD, TO: to.sRoll, TO50: to.TORun, powerKW: (def.params.powerW || (PR.powerW || 0)) / 1000, nE, sh, def, spec, drag, ledger: L, joinErrs };
}

function fly(def, spec, kg) {
  const world = C.makeWorld();
  const sim = C.makeSim(def, world); sim.reset(0);
  ballast(sim, kg);
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
const showLedger = args.includes('--ledger');
const birth = args.includes('--birth');
const keys = (only.length ? only : Object.keys(REAL)).filter(k => D.ARCHETYPES.some(a => a.key === k));
const f = (v, d = 0) => v == null || !isFinite(v) ? '—' : (+v).toFixed(d);
const pct = (ours, real) => (ours == null || real == null || !isFinite(ours)) ? '—' : ((ours / real - 1) * 100).toFixed(0) + ' %';
const lines = [];
const out = s => { console.log(s); lines.push(s); };
out('| card | real aeroplane | empty kg (real) | as baked / at MTOW kg | S m² | T0/W | Vs km/h | V75 km/h | Vmax km/h | ROC m/s | L/D | CdS m² | TO roll m | TO 50 ft m |');
out('|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
const results = [];
for (const k of keys) {
  const R = REAL[k]; let m;
  try { m = measure(k); } catch (e) { out('| ' + k + ' | ' + R.name + ' | build threw: ' + e.message.slice(0, 40) + ' |'); continue; }
  if (!m) continue;
  const pw = R.engineMatch ? '' : ' (engine differs)';
  const cell = (ours, real, d) => f(ours, d) + ' / ' + f(real, d) + ' (' + pct(ours, real) + ')';
  out('| ' + k + ' | ' + R.name + pw + ' | ' + cell(m.empty, R.empty) + ' | ' + f(m.asBaked) + ' / ' + f(m.mass) + ' | ' + cell(m.S, R.S, 1) + ' | ' + f(m.T0W, 2) + (R.T0 ? ' / ' + f(R.T0 / (R.mtow * 9.81), 2) : '') +
      ' | ' + cell(m.Vs, R.Vs1) + ' | ' + cell(m.V75, R.V75) + ' | ' + cell(m.Vmax, R.Vmax) + ' | ' + cell(m.roc, R.roc, 1) + ' | ' + cell(m.LD, R.LD, 1) + ' | ' + cell(m.drag.CdS, R.CdS, 2) + ' | ' + cell(m.TO, R.TO) + ' | ' + cell(m.TO50, R.TO50) + ' |');
  results.push({ k, R, m });
}
// --ledger (chantier 0): what the ledger bills, row by row, and the drag
// build-up's own words - the numbers the mass and drag chantiers are
// read against, card by card
if (showLedger) {
  for (const r of results) {
    const m = r.m, L = m.ledger || {}, P = m.def.parts || {};
    out('');
    out('LEDGER ' + r.k + ' (empty ' + f(m.empty, 1) + ' kg, payload ' + f(m.payload, 1) + ', design gross ' + f(P.designGross, 0) + ', gauge ' +
        (P.gauge ? Object.keys(P.gauge).map(c => c + ' ' + f(P.gauge[c], 2)).join(' ') : '-') + ')');
    const cb = m.spec.cabin || {};
    out('  cabin ' + (cb.seating || '-') + ' seats ' + (cb.seats || '-') + ' halfW ' + f(cb.halfW, 2) + ' len ' + f(cb.len, 2) + ' h ' + f(cb.h, 2) +
        '  fuselage ' + (m.spec.fuselage && m.spec.fuselage.material) + '  fuel ' + f(m.spec.fuel && m.spec.fuel.litres, 0) + ' L');
    for (const e of m.joinErrs || []) out('  JOIN: ' + e);
    for (const k in L) out('  ' + k.padEnd(10) + f(L[k].mass, 1).padStart(7) + ' kg' + (L[k].payload ? '  (payload)' : ''));
    try {
      const sy = C.genSystemsResolve(m.spec);
      out('  systems rows: ' + sy.rows.map(x => x.key + ' ' + f(x.kg, 1)).join(', '));
    } catch (e) { out('  systems rows: ' + e.message); }
    const d = m.drag;
    out('  DRAG CdS fit ' + f(d.CdS, 3) + ' m2 (induced k ' + f(d.kInd, 0) + ')  fusCdA[0] ' + f(d.fusCdA, 3) + '  gearDCdA ' + f(d.gearDCdA, 3) + '  braceDCdA ' + f(d.braceDCdA, 3) +
        (d.breakdown ? '  ' + Object.keys(d.breakdown).map(c => c + ' ' + f(d.breakdown[c], 3)).join(' ') : ''));
  }
}
if (flyKeys.length) {
  out('');
  out('| card (flown, the pilot) | TO run m (ours / real) | climb m/s at VClimb (ours / real ROC) | cruise: V km/h at thr (level) | landing roll m (ours / real) | outcome |');
  out('|---|---|---|---|---|---|');
  for (const r of results) {
    if (!flyKeys.includes(r.k)) continue;
    const t0 = Date.now();
    const fl = fly(r.m.def, r.m.spec, r.m.ballast);
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
  add('empty', m.empty, R.empty); add('Vs', m.Vs, R.Vs1); add('L/D', m.LD, R.LD); add('S', m.S, R.S); add('CdS', m.drag.CdS, R.CdS);
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
