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
//   node tools/perf_study.js --build=my.json --vs=c172 [--engine=io360_mccauley] [--fly] [--md=]
//                                         -> A SAVED BUILD (the garage's export, or a
//                                            bare spec) against one reference row,
//                                            with the DIMENSIONS table (the type
//                                            sheet) and the BUILD CHECK (stance,
//                                            balance, sandbags, hot and high) the
//                                            bench would print; --engine swaps the
//                                            registry row it flies; --fly flies it;
//                                            --md= keeps the trace (chantier 3,
//                                            2026-09-20: the user's Cessna 172
//                                            against the 172R)
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
               src: 'POH J-3C-65: stall 38 mph, cruise 75 mph, Vmax 87 mph, 450 fpm, TO run 370 ft, ldg 290 ft',
               dims: { length: 6.83, height: 2.03, AR: 6.9, cRoot: 1.60, cTip: 1.60, hSpan: 2.90, track: 1.83,
                       fuelL: 45, seats: 2, engineHP: 65, engineKg: 77, propD: 1.83, cabinW: 0.72,
                       src: 'J-3 type sheet: 22 ft 5 in x 35 ft 3 in x 6 ft 8 in, chord 63 in, 12 US gal, Sensenich 72 in' } },
  pietenpol: { name: 'Pietenpol Air Camper (A-65)', mtow: 476, empty: 280, S: 13.5, b: 8.8, powerKW: 48,
               Vs1: 56, V75: 120, Vmax: 137, roc: 2.5, TO: 120, LDG: 100, LD: 8, T0: 1200, engineMatch: true,
               src: 'type data: stall 35 mph, cruise 75, Vmax 85, 500 fpm' },
  tigermoth: { name: 'DH.82 Tiger Moth (Gipsy Major 130 hp)', mtow: 828, empty: 506, S: 22.2, b: 8.9, powerKW: 97,
               Vs1: 72, V75: 145, Vmax: 175, roc: 3.2, TO: 150, LDG: 120, LD: 8, engineMatch: true,
               src: 'type data: stall 45 mph, cruise 90, Vmax 109, 635 fpm' },
  stearman:  { name: 'Boeing-Stearman PT-17 (R-670 220 hp)', mtow: 1232, empty: 878, S: 27.6, b: 9.8, powerKW: 164,
               Vs1: 87, V75: 170, Vmax: 200, roc: 4.3, TO: 180, LDG: 150, LD: 7.5, engineMatch: true,
               src: 'type data: stall 55 mph, cruise 106, Vmax 124, 840 fpm' },
  // the `jodel` CARD is the D.112 since G445.4 (the user's build, two seats
  // on an A-65); the D.119 row it was measured against until then keeps
  // its numbers under `d119` for the record
  d119:      { name: 'Jodel D.119 (O-200)', mtow: 650, empty: 360, S: 12.7, b: 8.2, powerKW: 75,
               Vs1: 68, V75: 175, Vmax: 200, roc: 3.5, TO: 200, LDG: 150, LD: 11, T0: 1600, CdS: 0.45, engineMatch: true,
               src: 'type data D.119: stall 68 km/h, cruise 175, Vmax 200, 700 fpm, TO 200 m' },
  // the D.112 (2026-09-20, the user's Jodel build "should be a D112"): the
  // two-seat A-65 Jodel; the sources scatter on the climb (800 fpm and 2 m/s
  // in one line) and the cruise (150-160), the middle is taken; the tail
  // span and the height are the d112 reference payload's own (G89 model)
  // THE STALL ROW IS A RULING (2026-09-21, the user: "our rolling distances
  // and stall speeds are always too high"): the catalogue's 35 mph at 530 kg
  // on 12.7 m2 would need CL 2.54 on a 13 % wing, which no clean wing has
  // ever done, and a 23012 wing at 1.6 puts a D.112 at gross at 73 km/h.
  // The club's own figure is 60-65 km/h (the flight manual's "decrochage",
  // an indicated figure at high alpha); 65 is taken, and the model's 72 is
  // read against that, not against a number physics refuses. The roll and
  // the climb stay the catalogue's at gross (200 m, 2.5 m/s) - they are
  // consistent with a 70 km/h stall, not with a 56 one.
  d112:      { name: 'Jodel D.112 (A-65)', mtow: 530, empty: 320, S: 12.7, b: 8.2, powerKW: 48,
               Vs1: 65, V75: 150, Vmax: 175, roc: 2.5, TO: 200, LDG: 150, LD: 10, T0: 1200, engineMatch: true,
               src: 'Wikipedia D.11 / aircraft-catalog D.112: A-65 65 hp, 8.20 m, 12.70 m2, 320 / 530 kg, stall 35 mph (CL 2.54 at gross - refused; Vs1 65 km/h, the club figure), cruise 100 mph, climb 800 fpm or 2 m/s (sic), Vmax 124 mph',
               dims: { length: 6.20, height: 2.07, AR: 5.3, cRoot: 1.72, cTip: 1.2, hSpan: 2.74, fuelL: 45, seats: 2,
                       engineHP: 65, engineKg: 77, propD: 1.83, cabinW: 1.05,
                       src: 'D.112 type sheet: 6.20 m long, 2 seats side by side, one 45 L tank; the tail span 2.74 and the height 2.07 measured off src/models/d112 (the reference plane payload)' } },
  // THE CHINOOK (G461, the user's birdman.json "takes the architecture from
  // the birdman chinook 2S"): the documented two-seater is ASAP's Chinook
  // Plus 2 (the 2S evolved: the 1980s Birdman 2S has a 37 ft span and the
  // 447/503, Wikipedia gives it no weights); with the Rotax 582 the user
  // mounted, this row IS the Plus 2 / 582.
  // THE WEIGHT THE SHEET WAS FLOWN AT (2026-09-21, the same session): a POH's
  // numbers are at gross and say so; an ultralight's sheet is the aeroplane
  // as its owner flies it - one up, half fuel - and says nothing. perfKg 340:
  // 209 empty + an 86 kg pilot + 27 kg of fuel + 18 of kit. The sheet's
  // 35 mph at 1050 lb gross would need CL 2.4 clean on a 154 ft2 wing; at
  // 340 kg it needs 1.7, which is what the double-surface wing does, and the
  // 200 ft roll and the 1200 fpm are the same aeroplane, one up. `perfKg` is
  // the weight the bench loads the build to for Vs / V75 / ROC / TO / LDG
  // when the row carries it; empty weight, area and the dimensions are
  // compared as they are.
  chinook:   { name: 'Chinook Plus 2 (Rotax 582, 64 hp)', mtow: 476, perfKg: 340, empty: 209, S: 14.35, b: 9.75, powerKW: 48,
               Vs1: 56, V75: 133, Vmax: 153, roc: 6.1, TO: 61, LDG: 91, LD: 10, T0: 1500, engineMatch: true,
               src: 'ultralightnews ASAP Chinook Plus 2 sheet: 32 ft span, 154.5 sq ft, 17 ft 8 in, 5 ft 10 in, 380 lb empty / 1050 lb gross, 10 US gal, Rotax 503/582, stall 35 mph (32 with flaperons), cruise 72/83 mph, max 95 (582), Vne 115, climb 1000/1200 fpm, take-off 250/200 ft, glide 10:1, +4/-2 g; pilotmix Plus 2/582: empty 460 lb, 1050 MTOW, stall 32 mph, cruise 83, climb 1200 fpm, take-off 200 ft, landing 300 ft; Vs1 taken at 35 mph clean',
               dims: { length: 5.38, height: 1.78, AR: 6.6, cRoot: 1.47, cTip: 1.47, fuelL: 38, seats: 2,
                       engineHP: 64, engineKg: 39, propD: 1.73, cabinW: 0.60,
                       src: 'ASAP sheet: 17 ft 8 in long, 5 ft 10 in high, 32 ft span, 154.5 sq ft (chord 4.83 ft = 1.47 m, constant), tandem, 10 US gal; the 582 with the E gearbox 39 kg dry; a 68 in three-blade IVO is the usual prop' } },
  c172:      { name: 'Cessna 172R (IO-360-L2A 160 hp)', mtow: 1111, empty: 736, S: 16.2, b: 11.0, powerKW: 119,
               // Vs1 was 87 (the flaps-30 KCAS) until 2026-09-20: the POH's
               // section 5 gives 44 KIAS / 51-52 KCAS flaps up at 2450 lb
               Vs1: 95, V75: 218, Vmax: 230, roc: 3.7, TO: 288, LDG: 168, LD: 9, T0: 2290, CdS: 0.47, engineMatch: true,
               TO50: 514, LDG50: 395, Vs0: 87, Vy: 146, ceiling: 4100,
               src: 'POH 172R: Vs1 44 KIAS / 51 KCAS flaps up, Vs0 33 KIAS / 47 KCAS flaps 30, Vy 79 KIAS, 75 % cruise ~118 KTAS at SL, 720 fpm, ground roll 945 ft / 50 ft 1685 ft, ldg roll 550 ft / 50 ft 1295 ft, ceiling 13 500 ft',
               // THE TYPE SHEET (chantier 3): what a builder measures with a tape
               dims: { length: 8.28, height: 2.72, AR: 7.5, cRoot: 1.63, cTip: 1.12, hSpan: 3.40, track: 2.53, wheelbase: 1.65,
                       fuelL: 212, seats: 4, engineHP: 160, engineKg: 138, propD: 1.905, cabinW: 1.00, Sh: 3.3, Sv: 1.6,
                       dihedral: 1.73, incidence: 1.5, washout: 3, flapMax: 30, flapSpan: 0.54, ailSpan: 0.35,
                       src: 'Cessna 172R type sheet: 27 ft 2 in x 36 ft 1 in x 8 ft 11 in, root 5 ft 4 in, tip 3 ft 8.5 in, stab span 11 ft 4 in, track 8 ft 3.5 in, 56 US gal, McCauley 1C235 75 in, cabin 39.5 in, flaps 0-30 deg; ailerons 6 ft 4 in = 0.35 of the semispan, the flaps the rest of the panel from the root = 0.54' } },
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

REAL.jodel = REAL.d112;                          // the card is the D.112 (G445.4)
// THE PROBES live in tools/_perf_probe.js since chantier 2 (GATE DRAG reads
// the same instruments): probeAt, alphaForLift, sweep/sweepAt, levelSpeedAt,
// parasiteFit, ballast
const { sweepAt, levelSpeedAt, parasiteFit, ballast } = require(path.join(T, '_perf_probe.js'));

function measure(key) {
  const a = D.ARCHETYPES.find(x => x.key === key);
  if (!a) return null;
  let spec0, joinErrs = [];
  if (birth) spec0 = D.designBake(a.sel, a.over);
  else { const bj = BJ.bakeCard(key); spec0 = bj.spec; joinErrs = bj.errors; }
  return Object.assign(measureSpec(spec0, REAL[key], a.name), { key, joinErrs });
}
// A SAVED BUILD (chantier 3): the garage's export already carries the join's
// measurements (the profile, the cabin, the gear stations, the tail's areas),
// so it flies as it is - the aeroplane the game flies, not a re-bake of it
function measureSpec(spec0, R, name) {
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
  // ...or to the weight the sheet's performance was flown at (perfKg), when
  // the row says the sheet is not a gross-weight one
  const target = R ? (R.perfKg || R.mtow) : 0;
  const kg = target > asBaked ? target - asBaked : 0;
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
  return { name, mass: sim.totalM, asBaked, empty, payload, ballast: kg, S: sh.Sw, b: sh.span, T0, T0W: T0 / W, Vs: Vs * 3.6, V75: V75 && V75 * 3.6, Vmax: Vmax && Vmax * 3.6,
           roc, Vy: Vy * 3.6, LD, TO: to.sRoll, TO50: to.TORun, powerKW: (def.params.powerW || (PR.powerW || 0)) / 1000, nE, sh, def, spec, drag, ledger: L, joinErrs: [] };
}

// THE TYPE SHEET, measured off the def (chantier 3): the extents a builder
// takes with a tape - length and height off the node cloud in the body frame
// (settled on its wheels), the rest off the spec the join wrote
function dimsOf(m) {
  const def = m.def, S = m.spec, sim = C.makeSim(def, null); sim.reset(0);
  for (let i = 0; i < 150; i++) sim.step(1 / 60);
  const [xA, yU] = sim.axes();
  let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
  for (let i = 0; i < sim.n; i++) {
    const p = [sim.p[i * 3], sim.p[i * 3 + 1], sim.p[i * 3 + 2]];
    const x = p[0] * xA[0] + p[1] * xA[1] + p[2] * xA[2], y = p[0] * yU[0] + p[1] * yU[1] + p[2] * yU[2];
    x0 = Math.min(x0, x - sim.r[i]); x1 = Math.max(x1, x + sim.r[i]); y0 = Math.min(y0, y - sim.r[i]); y1 = Math.max(y1, y + sim.r[i]);
  }
  const w = S.wings && S.wings[0] || {}, g = S.gear || {}, t = S.tail || {}, e = def.params.engine || {}, PR = def.params.prop || {};
  const sh = m.sh, G = def.params.gen || {};
  const fuel = (S.energy && S.energy.vessels || []).reduce((a, v) => a + (v.capacity || 0), 0) || (S.fuel && S.fuel.litres) || 0;
  // the cloud runs from the engine's flange nodes to the tail post: length
  // is flange -> rudder trailing edge, and a type sheet's spinner-to-rudder
  // figure runs ~0.3 m longer (measured on the 172 build, 2026-09-20). NOTE
  // every station the join writes (gear.x, wings[].xLE, cabin.seatsX,
  // tail.hX) is metres aft of the WINDSCREEN-BASE ring (the join's zFw =
  // 'wsFront'), not the firewall: a type sheet's fuselage stations must be
  // re-based before they are compared (the 172's firewall is ~0.5 m ahead)
  return { length: (t.vX != null && t.vChord != null ? t.vX + t.vChord : x1) - x0, height: y1 - y0, AR: G.AR, cRoot: w.chord, cTip: w.chord * (w.taper == null ? 1 : w.taper), hSpan: t.hSpan, track: g.track,
           wheelbase: (g.x != null && g.twX != null) ? Math.abs(g.x - g.twX) : null,
           fuelL: fuel, seats: S.cabin && S.cabin.seats, engineHP: (e.powerW || 0) / 745.7, engineKg: e.mass, propD: PR.D, cabinW: S.cabin && S.cabin.halfW * 2,
           Sh: t.Sh, Sv: t.Sv, dihedral: w.dihedral, incidence: w.incidence, washout: w.washout,
           flapMax: (C.GEN_FLAP_TRAVEL && S.controls && S.controls.flap && C.GEN_FLAP_TRAVEL[S.controls.flap.type]) || null,
           flapSpan: S.controls && S.controls.flap && S.controls.flap.span,
           engineName: e.name, propName: PR.name || (C.POWERPLANTS[S.engines[0].type] || { prop: {} }).prop.name, material: S.fuselage && S.fuselage.material, gearType: g.type };
}

// THE BUILD CHECK (chantier 3): what the bench's three cards say about a
// build, headless - the shakedown's stance and balance, the sandbags ticked
// to their verdict, the hot-and-high sheet. Reported, never enforced, as the
// bench itself does.
function buildCheck(m) {
  const def = m.def, S = m.spec;
  const out = { shake: m.sh };
  const sim = C.makeSim(def, null); sim.reset(0);
  const rig = C.makeLoadTest(sim, def, { material: S.fuselage && S.fuselage.material,
                                         wingMaterial: typeof C.genSurfKey === 'function' ? C.genSurfKey(S, 'wing', 0) : undefined });
  if (rig.state.ok) { for (let i = 0; i < 60 * 60 && !rig.state.done; i++) rig.step(1 / 60); out.load = rig.state; }
  out.dalt = C.genDensityAlt(def);
  return out;
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
const buildFile = (args.find(x => x.startsWith('--build=')) || '').slice(8);
const vsKey = (args.find(x => x.startsWith('--vs=')) || '').slice(5);
const engineKey = (args.find(x => x.startsWith('--engine=')) || '').slice(9);
const keys = buildFile ? [] : (only.length ? only : Object.keys(REAL)).filter(k => D.ARCHETYPES.some(a => a.key === k));
const f = (v, d = 0) => v == null || !isFinite(v) ? '—' : (+v).toFixed(d);
const pct = (ours, real) => (ours == null || real == null || !isFinite(ours)) ? '—' : ((ours / real - 1) * 100).toFixed(0) + ' %';
const lines = [];
const out = s => { console.log(s); lines.push(s); };
out('| card | real aeroplane | empty kg (real) | as baked / at MTOW kg | S m² | T0/W | Vs km/h | V75 km/h | Vmax km/h | ROC m/s | L/D | CdS m² | TO roll m | TO 50 ft m |');
out('|---|---|---|---|---|---|---|---|---|---|---|---|---|---|');
const results = [];
if (buildFile) {
  const raw = JSON.parse(require('fs').readFileSync(buildFile, 'utf8'));
  const spec = raw.spec || raw;
  let name = raw.name || path.basename(buildFile);
  if (engineKey) {
    if (!C.POWERPLANTS[engineKey]) { console.log('no registry row ' + engineKey + ': ' + Object.keys(C.POWERPLANTS).join(' ')); process.exit(2); }
    for (const e of spec.engines) e.type = engineKey;
    name += ' (on ' + engineKey + ')';
  }
  const guess = vsKey || (/172|cessna/i.test(name) ? 'c172' : /cub|j-?3/i.test(name) ? 'cub' : Object.keys(REAL).find(k => new RegExp(k, 'i').test(name)) || '');
  const R = REAL[guess];
  if (!R) { console.log('no reference row for the build "' + name + '": pass --vs=' + Object.keys(REAL).join('|')); process.exit(2); }
  const m = measureSpec(spec, R, name);
  const cell = (ours, real, d) => f(ours, d) + ' / ' + f(real, d) + ' (' + pct(ours, real) + ')';
  const eHP = m.def.params.engine ? m.def.params.engine.powerW / 745.7 : 0;
  const engOK = !!(R.dims && Math.abs(eHP / R.dims.engineHP - 1) < 0.15);
  out('| ' + name + ' | ' + R.name + (engOK ? '' : ' (engine differs)') + ' | ' + cell(m.empty, R.empty) + ' | ' + f(m.asBaked) + ' / ' + f(m.mass) + ' | ' + cell(m.S, R.S, 1) + ' | ' + f(m.T0W, 2) + (R.T0 ? ' / ' + f(R.T0 / (R.mtow * 9.81), 2) : '') +
      ' | ' + cell(m.Vs, R.Vs1) + ' | ' + cell(m.V75, R.V75) + ' | ' + cell(m.Vmax, R.Vmax) + ' | ' + cell(m.roc, R.roc, 1) + ' | ' + cell(m.LD, R.LD, 1) + ' | ' + cell(m.drag.CdS, R.CdS, 2) + ' | ' + cell(m.TO, R.TO) + ' | ' + cell(m.TO50, R.TO50) + ' |');
  results.push({ k: 'build', R: Object.assign({}, R, { engineMatch: engOK }), m });
  // THE DIMENSIONS against the type sheet
  const d = dimsOf(m), rd = R.dims || {};
  out('');
  out('DIMENSIONS (ours / ' + R.name + '; ours at ' + (R.perfKg ? "the sheet's weight " : "MTOW ") + f(m.mass, 0) + ' kg, ballast ' + f(m.ballast, 0) + ' kg):');
  out('  engine     ' + (d.engineName || '-') + ' ' + f(d.engineHP, 0) + ' hp ' + f(d.engineKg, 0) + ' kg, prop ' + (d.propName || '-') + ' ' + f(d.propD, 2) + ' m' +
      (rd.engineHP ? '   / ' + f(rd.engineHP, 0) + ' hp ' + f(rd.engineKg, 0) + ' kg, prop ' + f(rd.propD, 2) + ' m' : ''));
  out('  fuselage   ' + (d.material || '-') + ', ' + (d.gearType || '-') + ' gear, ' + f(d.seats, 0) + ' seats / ' + f(rd.seats, 0));
  const rowsD = [['length m (eng flange-rudder TE)', 'length', 2], ['height m', 'height', 2], ['span m', 'span', 2], ['area m2', 'area', 1], ['AR', 'AR', 1], ['root chord m', 'cRoot', 2], ['tip chord m', 'cTip', 2],
                 ['dihedral deg', 'dihedral', 1], ['incidence deg', 'incidence', 1], ['washout deg', 'washout', 1], ['flap max deg', 'flapMax', 0], ['flap span frac', 'flapSpan', 2],
                 ['stab span m', 'hSpan', 2], ['stab area m2', 'Sh', 2], ['fin area m2', 'Sv', 2], ['track m', 'track', 2], ['wheelbase m', 'wheelbase', 2],
                 ['cabin width m', 'cabinW', 2], ['fuel L', 'fuelL', 0], ['wing load kg/m2 at MTOW', 'wingLoad', 1], ['power load kg/hp at MTOW', 'powerLoad', 1]];
  const oursD = Object.assign({ span: m.b, area: m.S, wingLoad: m.mass / m.S, powerLoad: m.mass / Math.max(1e-6, eHP) }, d);
  const realD = Object.assign({ span: R.b, area: R.S, wingLoad: (R.perfKg || R.mtow) / R.S, powerLoad: rd.engineHP ? (R.perfKg || R.mtow) / rd.engineHP : null }, rd);
  for (const [label, k, dec] of rowsD) out('  ' + label.padEnd(30) + f(oursD[k], dec).padStart(7) + ' / ' + f(realD[k], dec).padStart(6) + '  ' + pct(oursD[k], realD[k]));
  // THE BUILD CHECK
  const bc = buildCheck(m), s = bc.shake;
  out('');
  out('BUILD CHECK (the bench, headless; as baked ' + f(m.asBaked, 0) + ' kg):');
  out('  stance     ' + (s.onWheels ? 'on its wheels' : 'NOT on its wheels (rests on ' + s.restsOn + ')') + (s.gearFolded ? ', GEAR FOLDED' : '') +
      ', deck ' + f(s.deckAngle, 1) + ' deg, suspension travel ' + f(s.susTravel * 1000, 0) + ' mm, nose-over ' + f(s.noseOver, 0) + ' deg, power-over ' + f(s.powerOver, 2));
  out('  balance    CG ' + f((s.cgX - s.xLEmac) / s.cBar * 100, 0) + ' % MAC, static margin ' + f(s.staticMargin * 100, 0) + ' % (NP ' + f((s.npX - s.xLEmac) / s.cBar * 100, 0) + ' % MAC), stab trim ' + f(s.stabTrim * 180 / Math.PI, 1) + ' deg, Cn-beta ' + f(s.cnBeta, 3) + ', d(eps)/d(a) ' + f(s.dEpsDa, 2));
  out('  shake      ' + (s.flyableCircuit ? 'FLIES A CIRCUIT' : 'WILL NOT FLY A CIRCUIT') + ': Vs ' + f(s.Vs * 3.6, 0) + ' km/h, cruise ' + f(s.VCruise * 3.6, 0) + ' km/h at thr ' + f(s.thrCruise, 2) + ', climb ' + f(s.climbRate, 2) + ' m/s, TO ' + f(s.TORun, 0) + ' m, L/D best ' + f(s.LDbest, 1) + ' at ' + f(s.VbestLD * 3.6, 0) + ' km/h, ' + f(s.hp, 0) + ' hp, ' + f(s.powerLoad, 1) + ' kg/hp');
  if (bc.load) out('  sandbags   ' + bc.load.verdict + ': limit ' + f(bc.load.limitPct, 2) + ' % of semispan, ultimate ' + f(bc.load.ultPct, 2) + ' %' + (bc.load.ultYield == null ? '' : ', worst member ' + f(bc.load.ultYield, 0) + ' % of yield (' + (bc.load.worstCls || '-') + ')'));
  else out('  sandbags   no wing to load');
  if (bc.dalt) { const hot = bc.dalt.cases.find(c => c.id === 'hot');
    out('  hot & high ' + ((hot.climbRate || 0) >= 0.3 && (hot.TORun || 0) <= 1100 ? 'WORKS HOT AND HIGH' : 'SEA LEVEL ONLY') + ': ' + f(hot.densAlt, 0) + ' m DA, TO ' + f(hot.TORun, 0) + ' m, climb ' + f(hot.climbRate, 2) + ' m/s, service ceiling ' +
        (bc.dalt.serviceCeiling == null ? '> ' + f(bc.dalt.ceilingCap, 0) : f(bc.dalt.serviceCeiling, 0)) + ' m' + (R.ceiling ? ' / ' + f(R.ceiling, 0) + ' m' : '')); }
  const L = m.ledger || {};
  out('  ledger     ' + Object.keys(L).map(k => k + ' ' + f(L[k].mass, 0) + (L[k].payload ? '*' : '')).join(', ') + '  (* payload; empty ' + f(m.empty, 0) + ' kg)');
  try { const sy = C.genSystemsResolve(m.spec); out('  systems    ' + sy.rows.map(x => x.key + ' ' + f(x.kg, 1)).join(', ')); } catch (e) {}
  const dr = m.drag;
  out('  drag       CdS fit ' + f(dr.CdS, 3) + ' m2 (induced k ' + f(dr.kInd, 0) + ')  fusCdA ' + f(dr.fusCdA, 3) + '  gear ' + f(dr.gearDCdA, 3) + '  brace ' + f(dr.braceDCdA, 3) +
      (dr.breakdown ? '  ' + Object.keys(dr.breakdown).map(c => c + ' ' + f(dr.breakdown[c], 3)).join(' ') : ''));
  if (args.includes('--fly')) flyKeys.push('build');
}
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
for (const x of disc) { const rr = results.find(r => r.k === x.card); if (!rr || !rr.R.engineMatch) continue; (byWhat[x.what] = byWhat[x.what] || []).push(x.d); }
for (const w in byWhat) { const a = byWhat[w]; out('  ' + w.padEnd(7) + ' ' + ((a.reduce((p, q) => p + q, 0) / a.length) * 100).toFixed(0).padStart(4) + ' %  (n ' + a.length + ', spread ' + (Math.min(...a) * 100).toFixed(0) + '..' + (Math.max(...a) * 100).toFixed(0) + ')'); }
if (mdOut) require('fs').writeFileSync(mdOut, lines.join('\n') + '\n');
