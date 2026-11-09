#!/usr/bin/env node
// REAL CHECK (REAL-FIGURES, 2026-11-07) — THE AEROPLANES AGAINST THEIR REAL FIGURES, OFFICIALLY: a load band on our
// side, a condition band on theirs, and the pilot kept apart from the airframe.
//
// The successor of tools/perf_study.js for the planes that matter (perf_study stays: its REAL table, its card pass and
// --build mode are unchanged and still the cards' instrument). The three things the user asked for (7 Nov):
//   1. THE REFERENCE IS A BAND. A brochure figure rarely says the weight it was flown at (solo? half fuel?). Every row
//      in tools/real_refs.js carries the conditions it was STATED at; an unknown condition is a RANGE, not a guess.
//   2. OUR SIDE IS A BAND TOO. Every indicator is measured at three loads - MIN (one 70 kg pilot, a quarter of the
//      fuel, no baggage), TYP (one 80 kg pilot, half fuel: the brochure's "solo, half fuel"), MTOW (every seat at the
//      game's 80 kg, the fuel and baggage topped or trimmed to the TYPE's gross) - and, where it matters (--cg, or
//      `cgSweep` on the plane), MTOW with the load forward and aft. The loads go aboard through the GAME's own door:
//      the frame's seat billing (78_freight_strap freightStrapSeatBill / freightStrapBaggage) into sim.setFreight, the
//      fuel through the burn's own node records (sim.fuel.frac + setNodeMass). The verdict per indicator: INSIDE (our
//      band at the reference's weights overlaps its band), NEAR (within 10 %), OUTSIDE - and the WEIGHT AT WHICH OURS
//      EQUALS THEIRS, which names the load that explains it.
//   3. THE PILOT KEPT APART. Three readings of every flown number:
//        airframe  the analytic probes (power required / available over the speed sweep, the excess-power climb,
//                  genTORunAt) - no pilot at all;
//        POH       the game's own pilot, Expert, calm, deterministic, flying a FIXED TEST-PILOT SCHEDULE taken from the
//                  type's handbook (rotate, take-off and landing flap, Vy, the approach at 1.3 Vs0, braking) as ratios
//                  to the build's own stall at the load flown;
//        best      the schedule's parameters swept (rotate speed x take-off flap, climb speed, braking and approach),
//                  the best result kept;
//        game      the game's pilot as it ships (its own speeds, its own flap rule).
//      game - best = the PILOT'S SHARE; best - reference (at the reference's weight) = the AIRFRAME'S.
//
//   node tools/real_check.js cub                    one plane (keys: tools/real_refs.js PLANES)
//   node tools/real_check.js --all [--jobs=4]       the whole set, one child process per plane
//   node tools/real_check.js cub --quick            the analytic band only (no flights, ~20 s a plane)
//   node tools/real_check.js --build=f.json --ref=c172r [--water]   any build against any reference row
//   options: --json=<file> (the results), --md=<file> (the report section), --svg=<file> (the band chart),
//            --sweep=mtow|typ|min (the load the technique sweep is flown at; default mtow), --cg (forward / aft cases),
//            --noland / --nowater (an amphibian's halves), --core=<flight_core.js> (another tree's core)
//   RUNTIME (measured 2026-11-07 on the cloud box, 4 cores, the set in parallel): see the report's own table.
//   THE REPORT (REAL-FIGURES-2): write each plane's JSON into reports/evidence/REAL-CHECK-<date>/ (a `--quick` run's JSON as
//   <key>.shape.json re-measures the shape and specs of a plane flown before), then `node tools/real_report.js` writes the
//   HTML report (the scores on geometry, specs and performance are defined there). An archetype card is a PLANES row with
//   `card: '<key>'`; a plane on another branch (`branch:`) is flown from a worktree of that branch with these two files copied in.
//
// RULES IT KEEPS: the build goes through the load door (_load_build.js: the page's own chain) - a raw file flies a
// different plane; nothing in the core is changed or patched (every override is a pilot schedule in def.params.ap /
// def.params.flaps on this process's copy); sea level ISA, no wind (setWind(null)), the land runs on a FLAT copy of the
// world (terrain 0, no trees or obstacles: the climb-out's "ground ahead" Vx rule and the canopy stay out of a
// performance test), the water runs on the SEA lane / the sea south of HOME (GATE HYDROTRIM's rig).
'use strict';
const fs = require('fs');
const path = require('path');
const T = __dirname, ROOT = path.join(T, '..');
const args = process.argv.slice(2);
const opt = (k, d) => { const a = args.find(x => x.startsWith('--' + k + '=')); return a ? a.slice(k.length + 3) : d; };
const has = k => args.includes('--' + k);
const CORE_PATH = path.resolve(opt('core', path.join(T, 'flight_core.js')));
const C = require(CORE_PATH);
const RR = require(path.join(T, 'real_refs.js'));
const { REFS, PLANES, HISTORY } = RR;
const G = 9.81;
const f = (v, d = 0) => (v == null || typeof v !== 'number' || !isFinite(v)) ? '—' : v.toFixed(d);

// ---------------------------------------------------------------------------------------------------------------------
// THE LOADS
// ---------------------------------------------------------------------------------------------------------------------
function loadFacts(def) {
  const L = def.parts.ledger || {};
  let empty = 0, payload = 0;
  for (const k in L) { if (L[k].payload) payload += L[k].mass; else empty += L[k].mass; }
  const S = def.spec, cab = S.cab || {};
  const occ = Array.isArray(S.occupied) ? S.occupied.map(x => !!x) : null;
  const nSeats = Math.max(occ ? occ.length : 0, S.seats || (cab.seatsX ? cab.seatsX.length : 0), S.occupants || 1);
  const occB = []; for (let i = 0; i < nSeats; i++) occB.push(occ ? !!occ[i] : i < (S.occupants != null ? S.occupants : (S.crew || 1)));
  const fuelKg = def.nodes.reduce((a, n) => a + (n.mFuel || 0), 0);
  const mass = def.nodes.reduce((a, n) => a + n.m, 0);
  return { empty, payload, nSeats, occB, fuelKg, baggage: S.baggage || 0, mass, occKg: C.GEN_RULES.occupantKg || 80 };
}
// a load case: who sits where (kg per seat), the fuel fraction, the baggage, and a top-up to a target mass placed aft
// (the baggage station) or forward (the pilot's seat)
function makeCase(def, F, c) {
  const adds = [];
  const push = l => { for (const a of l) adds.push(a); };
  for (let i = 0; i < F.nSeats; i++) {
    const want = c.seats[i] || 0, had = F.occB[i] ? F.occKg : 0;
    if (want !== had) push(C.freightStrapSeatBill(def, i, want - had));
  }
  if (c.bag != null && c.bag !== F.baggage) push(C.freightStrapBaggage(def, c.bag - F.baggage));
  let fuel = c.fuel;
  const massOf = () => F.mass + adds.reduce((a, x) => a + x[1], 0) - F.fuelKg * (1 - fuel);
  if (c.target) {
    let m = massOf();
    if (m > c.target) {                               // over gross: the POH's answer is less fuel, down to a quarter
      const cut = Math.min(m - c.target, F.fuelKg * (fuel - 0.25));
      if (cut > 0) fuel -= cut / Math.max(1e-6, F.fuelKg);
      m = massOf();
    }
    if (m < c.target - 0.5) push(c.fwd ? C.freightStrapSeatBill(def, 0, c.target - m) : C.freightStrapBaggage(def, c.target - m));
  }
  return { id: c.id, label: c.label, adds, fuel, mass: massOf() };
}
function cases(def, F, R, P, cg) {
  const mt = R.mtow, all = []; for (let i = 0; i < F.nSeats; i++) all.push(F.occKg);
  const one = k => { const s = [k]; for (let i = 1; i < F.nSeats; i++) s.push(0); return s; };
  const out = [
    makeCase(def, F, { id: 'min', label: 'MIN: 70 kg pilot, 1/4 fuel', seats: one(70), fuel: 0.25, bag: 0 }),
    makeCase(def, F, { id: 'typ', label: 'TYP: 80 kg pilot, 1/2 fuel', seats: one(80), fuel: 0.5, bag: 0 }),
    makeCase(def, F, { id: 'mtow', label: 'MTOW ' + mt + ' kg: every seat, full fuel, baggage to gross', seats: all, fuel: 1, bag: F.baggage, target: mt }),
  ];
  if (cg) {
    out.push(makeCase(def, F, { id: 'mtowF', label: 'MTOW, load forward (front seats, ballast at the pilot)', seats: one(F.occKg).map((v, i) => i < 2 && F.nSeats > 2 ? F.occKg : v), fuel: 1, bag: 0, target: mt, fwd: true }));
    out.push(makeCase(def, F, { id: 'mtowA', label: 'MTOW, load aft (every seat, the rest in the baggage)', seats: all, fuel: 1, bag: F.baggage, target: mt }));
  }
  return out;
}
// the case on the DEF (the analytic probes and GATE HYDROTRIM's water rig build their own sim from the def)
function loadedDef(spec, lc) {
  const def = C.buildGen(spec);
  for (const n of def.nodes) if (n.mFuel > 0) { n.m = Math.max(0.5, n.m - n.mFuel * (1 - lc.fuel)); n.mFuel *= lc.fuel; }
  for (const [i, kg] of lc.adds) def.nodes[i].m = Math.max(0.5, def.nodes[i].m + kg);
  return def;
}
// ...and on a SIM, through the game's doors (the burn's records, setFreight)
function loadSim(sim, def, lc) {
  const FU = sim.fuel, k = lc.fuel;
  if (FU && FU.kg0 > 0 && k !== 1) {
    for (let i = 0; i < def.nodes.length; i++) { const n = def.nodes[i]; if (n.mFuel > 0) sim.setNodeMass(i, Math.max(0.5, n.m - n.mFuel * (1 - k))); }
    FU.frac = k; FU.kg = FU.kg0 * k; FU.litres = FU.litres0 * k; for (const v of FU.vessels) v.litres = v.litres0 * k;
  }
  if (lc.adds.length) sim.setFreight(lc.adds.map(a => [a[0], a[1]]));
}

// ---------------------------------------------------------------------------------------------------------------------
// THE AIRFRAME (no pilot)
// ---------------------------------------------------------------------------------------------------------------------
const PP = require(path.join(T, '_perf_probe.js'));
function flapFrac(def, deg) {
  const fl = def.spec.controls && def.spec.controls.flap;
  if (!deg || !fl || !fl.type || fl.type === 'none' || !def.params.flaps) return 0;
  return Math.min(1, deg * Math.PI / 180 / C.genTravel('flap', fl.type));
}
// the stall off the probe: the largest lift over alpha at a reference speed (prop off, as the shakedown's)
function stallOf(sim, def, W, flap) {
  const f0 = sim.ctl.flap; sim.ctl.flap = flap || 0;
  const V0 = 25; let best = 0;
  for (let a = 0; a <= 0.45; a += 0.005) { const r = PP.probeAt(sim, V0, a); if (r.Fy > best) best = r.Fy; }
  sim.ctl.flap = f0;
  return best > 0 ? V0 * Math.sqrt(W / best) : null;
}
// the elevator that trims the approach (1.3 Vs0 in the flap) at this load's CG - genTrim's own differencing; the
// budget GEN's trim rule judges it against is 0.18 nose-up, 0.154 nose-down (64_gen_build trimBudget)
function apprTrim(sim, def, W, flap, Vs0) {
  const f0 = sim.ctl.flap, d0 = sim.ctl.de; sim.ctl.flap = flap;
  const Va = 1.3 * Vs0, aMax = 0.85 * def.params.polarWing.aStall;
  const al = PP.alphaForLift(sim, Va, W, aMax);
  sim.ctl.de = 0; const m0 = PP.probeAt(sim, Va, al.a).pitchUp;
  sim.ctl.de = 0.20; const m1 = PP.probeAt(sim, Va, al.a).pitchUp;
  sim.ctl.flap = f0; sim.ctl.de = d0;
  const dM = (m1 - m0) / 0.20;
  return Math.abs(dM) < 1e-9 ? 0 : -m0 / dM;
}
function airframe(spec, lc, R, P) {
  const def = loadedDef(spec, lc);
  const sim = C.makeSim(def, null); sim.reset(0);
  const W = sim.totalM * G, poh = R.poh || {};
  const Vs = stallOf(sim, def, W, 0);
  const fTO = flapFrac(def, poh.flapTO), fL = flapFrac(def, poh.flapLDG);
  const VsTO = fTO ? stallOf(sim, def, W, fTO) : Vs, Vs0 = fL ? stallOf(sim, def, W, fL) : Vs;
  // THE CRUISE, THE TOP SPEED AND THE CLIMB GEAR-UP (TAIL-RETRACT 2026-11-09): a retracting build's sweep flies a copy
  // of its def with the gear's own drag taken off as the solver takes it up (30_solver gearStep: cdA x frac), the
  // stall, the trim and the take-off run stay gear-down
  const RT = def.params.retract;
  let simC = sim;
  if (RT && RT.cdA > 0) {
    const defUp = Object.assign({}, def, { params: Object.assign({}, def.params, { fusCdA: def.params.fusCdA.slice() }) });
    defUp.params.fusCdA[0] -= RT.cdA * (RT.frac > 0 && RT.frac < 1 ? RT.frac : 1);
    simC = C.makeSim(defUp, null); simC.reset(0);
  }
  const rows = PP.sweepAt(def, simC, W, Vs);
  const V75 = PP.levelSpeedAt(rows, 0.75);
  let Vmax = PP.levelSpeedAt(rows, 1.0), VmaxAlt = null;
  // THE BOOK'S ALTITUDE (REF-DATA 2026-11-09: the DC-3's top speed is published at 8,500 ft): the Vmax row's `alt` (m)
  // flies the sweep in the ISA at that height (the probe's air and the engine's lapse, sim.setAtmos)
  const altV = R.rows && R.rows.Vmax && R.rows.Vmax.alt;
  if (altV > 0) {
    simC.setAtmos(C.ATMOS_ISA, altV);
    const rA = PP.sweepAt(def, simC, W, Vs * Math.sqrt(1 / Math.max(0.3, simC.probeAir().sigma)));
    const vA = PP.levelSpeedAt(rA, 1.0);
    simC.setAtmos(null, 0);
    if (vA) { VmaxAlt = altV; Vmax = vA; }
  }
  // THE CLIMB AT THE BOOK'S POWER (poh.climbPowerK: the DC-3's 1,220 fpm is at METO, 1,050 of its 1,200 hp - the
  // thrust x the power's fraction, a constant-speed propeller's at the same speed)
  const kC = poh.climbPowerK > 0 ? poh.climbPowerK : 1;
  let roc = 0, Vy = 0, LD = 0, Vbg = 0;
  for (const r of rows) { const ex = kC === 1 ? r.excess : (kC * r.T1 - r.drag) * r.V / W;
    if (ex > roc) { roc = ex; Vy = r.V; } if (r.LD > LD) { LD = r.LD; Vbg = r.V; } }
  const fit = PP.parasiteFit(rows, Vs, sim.probeAir().rho);
  let to = null; try { to = C.genTORunAt(sim, def, W); } catch (e) {}
  const sh = C.genShakedown(def, { slim: true });
  const cgMAC = sh && sh.cBar ? (sh.cgX - sh.xLEmac) / sh.cBar * 100 : null;
  const deAppr = apprTrim(sim, def, W, fL, Vs0), deApprClean = apprTrim(sim, def, W, 0, Vs);
  return { mass: sim.totalM, W, Vs: Vs * 3.6, VsTO: VsTO * 3.6, Vs0: Vs0 * 3.6, V75: V75 && V75 * 3.6, Vmax: Vmax && Vmax * 3.6, roc, Vy: Vy * 3.6, LD, Vbg: Vbg * 3.6,
           ...(VmaxAlt ? { VmaxAlt } : {}), ...(kC !== 1 ? { climbPowerK: kC } : {}), ...(RT ? { gearUp: true } : {}),
           CdS: fit && fit.CdS, TOgrass: to && to.sRoll, T0: sim.thrustAt(0, 1), cgMAC, sm: sh && sh.staticMargin * 100, stabTrim: sh && sh.stabTrim * 180 / Math.PI,
           deAppr, deApprClean, flapLdg: fL, flapTO: fTO };
}

// ---------------------------------------------------------------------------------------------------------------------
// THE TEST WORLD AND ONE FLIGHT
// ---------------------------------------------------------------------------------------------------------------------
const SURF = { paved: 5, grass: 0 };
function testWorld(surface) {
  const W = C.makeWorld();
  W.setWind(null);
  const code = SURF[surface] != null ? SURF[surface] : 0;
  return Object.assign({}, W, { terrainH: () => 0, waterH: () => -100, surface: () => code, canopyH: () => 0,
    slopeMax: 0.001, groundMaxRect: () => 0, obstacles: null, treeHits: null, woodSolid: false, treesNear: () => [] });
}
function seaWorld() { const W = C.makeWorld(); W.setWind(null); return W; }
// a pilot SCHEDULE on this process's def: VRot / VClimb / the cruise-climb factor / the take-off and landing flap /
// the approach / the brakes; returns the undo
function schedule(def, t, Vs, VsTO, Vs0) {
  const A = def.params.ap, FS = def.params.flaps, g = def.params.gen;
  const save = { A: Object.assign({}, A), FS: FS ? Object.assign({}, FS) : null, g: { VsFlap: g.VsFlap, landsFlapless: g.landsFlapless } };
  if (t) {
    if (t.vr) A.VRot = t.vr * VsTO / 1.05;          // the pilot rotates at VRot and unsticks ~1.05 VRot (64_ genTORunAt)
    if (t.vy) A.VClimb = t.vy;
    if (t.cruiseK != null) A.climbCruiseK = t.cruiseK;
    if (FS && t.flapTO != null) FS.to = t.flapTO;
    if (FS && t.flapLDG != null) {
      FS.ldg = t.flapLDG;
      if (t.flapLDG > 0) { g.VsFlap = Vs0; g.landsFlapless = false; A.VAppr = (t.vapp || 1.3) * Vs0; }
      else { A.VAppr = (t.vapp || 1.3) * Vs; }
    }
    if (t.brake != null) A.brakeMax = t.brake;
    // the brake LAW, not just its ceiling: the game's ramps at 0.12 / s from VBrakeOn (0.75 Vs on a taildragger), so
    // brakeMax alone never reaches the wheels inside a roll (measured: the Cub's roll 152 / 153 m at brakeMax 1.0 / 0.6)
    if (t.brakeRate != null) A.brakeRampRate = t.brakeRate;
    if (t.vBrakeOn != null) A.VBrakeOn = t.vBrakeOn * Vs;
  }
  return () => { Object.assign(A, save.A); for (const k of Object.keys(A)) if (!(k in save.A)) delete A[k];
    if (FS) Object.assign(FS, save.FS); g.VsFlap = save.g.VsFlap; g.landsFlapless = save.g.landsFlapless; };
}
function onSurface(sim) {
  if (sim.wheelsOnGround && sim.wheelsOnGround() > 0) return true;
  if (sim.hydro && sim.hydro.floats) for (const q of sim.hydro.floats) if (q.wet > 0) return true;
  if (sim.wetBody && sim.wetBody.wet > 0) return true;
  return false;
}
// one flight: mode 'circuit' (to STOPPED) or 'climb' (to 260 m agl); `water` = off the SEA lane
function flight(spec, def, lc, o) {
  const world = o.water ? seaWorld() : testWorld(o.surface);
  const undo = schedule(def, o.tech, o.Vs, o.VsTO, o.Vs0);
  const t0 = Date.now();
  const rec = { outcome: null };
  try {
    const sim = C.makeSim(def, world); sim.reset(0);
    let lane = null;
    if (o.water) { lane = world.aerodromes.find(a => a.id === 'SEA'); C.placeAtAerodrome(sim, lane); }
    loadSim(sim, def, lc);
    for (let i = 0; i < 300; i++) sim.step(1 / 60);
    const thRest = sim.out.pitch;                    // the attitude it sits at: three-point on a taildragger
    let shk = null;
    const ap = C.makePilot(sim, def, world, { shakedown: () => shk || (shk = C.genShakedown(def, { corners: false })), profile: o.profile || undefined });
    if (lane) ap.setRoute(lane, lane);
    const gH = (x, z) => o.water ? world.waterH(x, z) : 0;
    const c0 = sim.cgPos(), h0 = c0[1] - gH(c0[0], c0[2]);
    let x0 = null, off = null, offT = 0, lift = null, p15 = null, a60 = null, a250 = null, vs = [], th = [], downwind = false;
    let p50 = null, td = null, stop = null, maxS = o.mode === 'climb' ? 240 : 900, phases = [];
    const dist = (a, b) => Math.hypot(a[0] - b[0], a[2] - b[2]);
    // THE STOL RUN-UP (the user, 9 Nov: "get the flaps full down, brake and launch the engine until it reaches max rpm,
    // careful with the tail that might lift up, and go"): with `tech.runup`, from the first roll frame the brakes are held
    // and the stick is full back while the throttle comes in over 2 s; when the rpm has stood within 0.5 % for 0.5 s the
    // brakes let go and the pilot flies its roll from there. If the tail comes up (the pitch more than 2 deg under the rest
    // attitude) the power comes back until it sits down again. The take-off flap is the schedule's (the sweep flies full)
    const tailD = !(spec.gear && spec.gear.type && spec.gear.type !== 'taildragger');
    const SS = { b: 0, eased: 0, thTD: null, thMin: 1e9, hTD: null, hSwing: 0 };
    const RU = o.tech && o.tech.runup ? { on: false, done: false, t: 0, thr: 0, rpm: 0, steadyT: 0, th0: null, tailUps: 0 } : null;
    for (let s = 0; s < maxS * 60; s++) {
      ap.update(1 / 60);
      if (RU && !RU.done && (ap.phase === 'ROLL' || ap.phase === 'TAKEOFF')) {
        RU.on = true; RU.t += 1 / 60;
        if (RU.th0 == null) RU.th0 = sim.out.pitch;
        const tailUp = sim.out.pitch < RU.th0 - 2 / 57.3;
        if (tailUp) { RU.thr = Math.max(0.3, RU.thr - 0.5 / 60); RU.tailUps++; }
        else RU.thr = Math.min(1, RU.thr + 0.5 / 60);
        sim.ctl.thr = RU.thr; sim.ctl.brake = 1; sim.ctl.de = 1;
        const r = +(sim.out.rpm && sim.out.rpm[0]) || 0;
        RU.steadyT = (RU.thr >= 1 && r > 0 && Math.abs(r - RU.rpm) <= 0.005 * r) ? RU.steadyT + 1 / 60 : 0;
        RU.rpm = r;
        if ((RU.steadyT >= 0.5 && RU.thr >= 1) || RU.t > 15) { RU.done = true; RU.rpmHeld = r; RU.held = +RU.t.toFixed(1); }
      }
      // THE SHORT-FIELD STOP (`tech.stopShort`), BY THE GEAR (the user, 9 Nov: "you cannot take the technique from the 172,
      // it's a tricycle"):
      //   a TAILDRAGGER (FAA-H-8083-3, the tailwheel chapter): the stick held full back "as far as possible and as firmly
      //     as possible until the airplane stops" (the tailwheel pinned, the nose-over resisted), the brakes "evenly and
      //     firmly" from the touchdown with the throttle closed - full brake, eased while the tail comes up (the pitch
      //     more than 1.5 deg under the touchdown attitude) and back on as it sits down; the flaps stay where they are
      //   a TRICYCLE (the 172's handbook): the flaps up (the weight onto the wheels), the wheel full back, maximum brake
      //     pressure without sliding the tyres
      if (ap.phase === 'ROLLOUT' && onSurface(sim)) { if (SS.hTD == null) SS.hTD = sim.out.hdg; else { let dh = sim.out.hdg - SS.hTD; dh = Math.atan2(Math.sin(dh), Math.cos(dh)); SS.hSwing = Math.max(SS.hSwing, Math.abs(dh)); } }
      if (ap.phase === 'ROLLOUT' && onSurface(sim)) { if (SS.thTD == null) SS.thTD = sim.out.pitch; SS.thMin = Math.min(SS.thMin, sim.out.pitch);
        if (process.env.RC_TRACE && (s % 15 === 0)) console.error('ROLLOUT', ((s + 1) / 60).toFixed(2), 'V', sim.out.V.toFixed(1), 'pitch', (sim.out.pitch * 57.3).toFixed(1), 'brake', (+sim.ctl.brake).toFixed(2), 'de', (+sim.ctl.de).toFixed(2)); }
      if (o.tech && o.tech.stopShort && ap.phase === 'ROLLOUT' && onSurface(sim)) {
        sim.ctl.de = 1;
        if (tailD) {
          // the brakes only while the tail is down - within 3 deg of the three-point attitude the aeroplane sat at
          // (the handbook's "firmly held in a three-point attitude"); the moment it comes up they come off (a pilot's
          // feet, not a ramp: at walking pace the elevator holds nothing and the nose-over is the brakes')
          const up = sim.out.pitch < thRest - 3 / 57.3;
          SS.b = up ? 0 : Math.min(1, SS.b + 3 / 60);
          if (up) SS.eased++;
          sim.ctl.brake = SS.b;
        } else sim.ctl.flap = 0;
      }
      sim.step(1 / 60);
      const t = (s + 1) / 60, c = sim.cgPos(), agl = c[1] - gH(c[0], c[2]) - h0, ph = ap.phase, onS = onSurface(sim);
      if (!phases.length || phases[phases.length - 1][0] !== ph) phases.push([ph, +t.toFixed(1)]);
      if (x0 == null && sim.ctl.thr > 0.5 && (ph === 'ROLL' || ph === 'TAKEOFF')) x0 = [c[0], c[1], c[2], t];
      if (x0 && !lift) {
        if (!onS) { if (!off) off = [c[0], c[1], c[2], t, sim.out.V]; offT += 1 / 60; if (offT >= (o.water ? 2 : 1)) lift = off; }
        else { off = null; offT = 0; }
      }
      if (x0 && !p15 && agl >= 15) p15 = [c[0], c[1], c[2], t];
      if (lift && !a60 && agl >= 60) a60 = [t, c[1]];
      if (a60 && !a250 && agl >= 250) a250 = [t, c[1]];
      if (a60 && !a250) { vs.push(sim.out.V); th.push(sim.ctl.thr); }
      if (o.mode === 'climb' && a250) { rec.outcome = 'climbed'; break; }
      if (ph === 'DOWNWIND') downwind = true;
      if (downwind && !p50 && (ph === 'FINAL' || ph === 'FLARE') && agl < 15) p50 = [c[0], c[1], c[2], t];
      if (downwind && !td && (ph === 'FLARE' || ph === 'ROLLOUT') && onS) td = [c[0], c[1], c[2], t, sim.out.V];
      if (ph === 'GOAROUND') { p50 = null; td = null; }
      if (sim.stats().bad) { rec.outcome = 'nan'; break; }
      if (sim.out.dmg && sim.out.dmg.crashed) { rec.outcome = 'crashed'; break; }
      if (ph === 'STOPPED' && ap.t > 2) { if (!stop) stop = [c[0], c[1], c[2], t]; rec.outcome = 'stopped';
        if (process.env.RC_TRACE && t < stop[3] + 6) { if (s % 30 === 0) console.error('STOPPED', t.toFixed(1), 'pitch', (sim.out.pitch * 57.3).toFixed(1), 'V', sim.out.V.toFixed(2), 'crashed', !!(sim.out.dmg && sim.out.dmg.crashed)); continue; }
        break; }
    }
    rec.TO = x0 && lift ? dist(x0, lift) : null;
    rec.TOs = x0 && lift ? lift[3] - x0[3] : null;
    rec.Vlof = lift ? lift[4] * 3.6 : null;
    rec.TO50 = x0 && p15 ? dist(x0, p15) : null;
    rec.climb = a60 && a250 ? (a250[1] - a60[1]) / (a250[0] - a60[0]) : null;
    rec.Vclimb = vs.length ? vs.reduce((a, b) => a + b, 0) / vs.length * 3.6 : null;
    rec.thrClimb = th.length ? th.reduce((a, b) => a + b, 0) / th.length : null;
    rec.LDG = td && stop ? dist(td, stop) : null;
    rec.LDG50 = p50 && stop ? dist(p50, stop) : null;
    rec.Vtd = td ? td[4] * 3.6 : null;
    rec.flapLdgFlown = ap.appr ? ap.appr.flap : null;
    // the arrival's own record (the pilot's report): a touchdown sink over 3 m/s is a drop, not a landing, and its "roll"
    // is not a landing roll (the Birdman as found: 6.3 m/s at 39 km/h, 7 m)
    const RL = ap.report && ap.report.landing;
    rec.tdSink = RL ? RL.sink : null; rec.hard = !!(RL && RL.sink > 3);
    rec.outcome = rec.outcome || ap.report.outcome || 'clock';
    rec.goArounds = phases.filter(p => p[0] === 'GOAROUND').length;
    // the tail on the roll-out: how far the pitch fell under the touchdown attitude (deg; a nose-over starts there)
    rec.tailRise = SS.thTD != null ? +((SS.thTD - SS.thMin) * 57.3).toFixed(1) : null;
    // A NOSE-OVER (found 9 Nov: the sweep's hardest brake law stood the Carbon Cub SS on its nose at -19 deg, which the
    // sim does not call a crash, and the sweep took its 35 m for the best landing roll): the roll-out's lowest pitch more
    // than 10 deg nose-down. Such a roll is never a best figure
    rec.pitchMin = SS.thTD != null ? +(SS.thMin * 57.3).toFixed(1) : null;
    rec.noseOver = SS.thTD != null && SS.thMin < -10 / 57.3;
    // A GROUND LOOP (found 9 Nov: the SS's "20 m" was a 100 deg swing, the tyres scrubbing sideways): the heading moved more
    // than 30 deg on the roll-out. Not a landing roll either
    rec.hdgSwing = SS.hTD != null ? +(SS.hSwing * 57.3).toFixed(1) : null;
    rec.groundLoop = SS.hTD != null && SS.hSwing > 30 / 57.3;
    if (rec.noseOver || rec.groundLoop) { rec.LDGnoseOver = rec.LDG; rec.LDG = null; rec.LDG50 = null; }   // a roll that ends on the nose or sideways is not a landing roll
    if (o.tech && o.tech.stopShort) rec.stopShort = { gear: tailD ? 'tail' : 'tricycle', eased: SS.eased };
    if (RU) rec.runup = { held: RU.held || null, rpm: RU.rpmHeld ? Math.round(RU.rpmHeld) : null, tailUps: RU.tailUps };
  } finally { undo(); }
  rec.wall = (Date.now() - t0) / 1000;
  return rec;
}
// GATE HYDROTRIM's water rig (hydro_trim_table.fly): the floatplane supplement's technique ('poh': flaps 20, the stick
// through the hump, back at 0.97 Vs) and the G3390 rig's (no flap, no rotation) - the def carries the load
function waterRig(spec, lc, poh) {
  const HT = require(path.join(T, 'hydro_trim_table.js'));
  const def = loadedDef(spec, lc);
  const r = HT.fly(def, poh);
  return { TOW: r.air ? r.air.dist : null, TOWs: r.air ? r.air.t : null, Vlof: r.air ? r.air.V * 3.6 : null, hump: r.hump && r.hump.R, crashed: r.crashed };
}

// ---------------------------------------------------------------------------------------------------------------------
// ONE PLANE
// ---------------------------------------------------------------------------------------------------------------------
function loadSpec(P) {
  const LB = require(path.join(T, '_load_build.js'));
  if (P.card) {
    // an ARCHETYPE CARD (REAL-FIGURES-2): designBake's birth spec through the load door's birth envelope - the card as
    // the garage's new-aeroplane chooser hands it over (no file exists for a card)
    const BJ = require(path.join(T, '_bake_joined.js'));
    const { D } = BJ.loadPanel();
    const a = D.ARCHETYPES.find(x => x.key === P.card);
    if (!a) throw new Error('no archetype card ' + P.card);
    const r = LB.gameSpecFull({ birth: 1, spec: D.designBake(a.sel, a.over) });
    return { spec: r.spec, errors: r.errors || [], name: a.name };
  }
  const r = LB.loadBuild(P.file);
  return { spec: r.spec, errors: r.errors || [], name: r.name };
}
// THE SHAPE AND THE SPECS (REAL-FIGURES-2): what a builder measures with a tape and reads off the engine's plate, off the
// built def (the same extents perf_study's DIMENSIONS table reads: the node cloud settled on its gear, so `length` runs
// engine flange -> rudder trailing edge, ~0.3 m short of a spinner-to-rudder type figure)
function drawnDims(raw, pitch) {
  try {
    const os = require('os'), tmp = path.join(os.tmpdir(), 'real_drawn_' + process.pid + '.json'), fd = fs.openSync(tmp, 'w');
    const r = require('child_process').spawnSync(process.execPath, ['--max-old-space-size=4096', path.join(T, '_load_build.js'), '--child'],
      { input: JSON.stringify(raw), stdio: ['pipe', fd, 'pipe'], cwd: ROOT, encoding: 'utf8',
        env: Object.assign({}, process.env, { FLYDIY_JOIN_PROBE: path.join(T, '_drawn_dims_probe.js') }) });
    fs.closeSync(fd);
    const txt = fs.readFileSync(tmp, 'utf8'); try { fs.unlinkSync(tmp); } catch (e) {}
    const P = JSON.parse(txt.slice(txt.indexOf('\u0001') + 1)).probe;
    if (!P || !P.P) return null;
    const n = P.P.length / 3, lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9];
    for (let i = 0; i < n; i++) for (let a = 0; a < 3; a++) { const x = P.P[3 * i + a] / 100; if (x < lo[a]) lo[a] = x; if (x > hi[a]) hi[a] = x; }
    // the cage frame: x lateral, y up, z FORWARD (the spinner at +z): nose up by `pitch` lowers the tail (z < 0)
    const c = Math.cos(pitch), sn = Math.sin(pitch); let y0 = 1e9, y1 = -1e9;
    for (let i = 0; i < n; i++) { const y = P.P[3 * i + 1] / 100, z = P.P[3 * i + 2] / 100, yy = y * c + z * sn; if (yy < y0) y0 = yy; if (yy > y1) y1 = yy; }
    return { span: hi[0] - lo[0], length: hi[2] - lo[2], height: y1 - y0, heightLevel: hi[1] - lo[1], deckDeg: pitch * 180 / Math.PI, points: n };
  } catch (e) { return null; }
}
function measureShape(spec, def, rawForDrawn) {
  // HEIGHT on the WORLD vertical, the aeroplane standing on its gear (a type sheet's height: ground to fin top, tail down
  // on a taildragger) - the body-axis extent read a tail-sitter rotated by its deck angle (the DC-3-alike 7.26 m against
  // 5.16; world-vertical 5.22); LENGTH on the body axis
  const sim = C.makeSim(def, null); sim.reset(0);
  for (let i = 0; i < 300; i++) sim.step(1 / 60);
  const [xA] = sim.axes();
  let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
  for (let i = 0; i < sim.n; i++) {
    const p = [sim.p[i * 3], sim.p[i * 3 + 1], sim.p[i * 3 + 2]];
    const x = p[0] * xA[0] + p[1] * xA[1] + p[2] * xA[2], y = p[1];
    x0 = Math.min(x0, x - sim.r[i]); x1 = Math.max(x1, x + sim.r[i]); y0 = Math.min(y0, y - sim.r[i]); y1 = Math.max(y1, y + sim.r[i]);
  }
  const w = (spec.wings && spec.wings[0]) || {}, t = spec.tail || {}, g = spec.gear || {}, G = def.params.gen || {}, e = def.params.engine || {}, P = def.params.prop || {};
  const L = def.parts.ledger || {}; let empty = 0; for (const k in L) if (!L[k].payload) empty += L[k].mass;
  const fuelL = ((spec.energy && spec.energy.vessels) || []).reduce((a, v) => a + (v.capacity || 0), 0) || (spec.fuel && spec.fuel.litres) || 0;
  let sh = null; try { sh = C.genShakedown(def, { slim: true }); } catch (err) {}
  // THE DRAWN AEROPLANE (REAL-FIGURES-2, the user 8 Nov: "check whether we measure the same thing"): the node cloud is
  // the structure inside the skin - no spinner, no fin tip, no tyre rubber - and a raw file's stations can be stale (the
  // Jodel's file puts its fin 0.55 m aft of where the game draws it). The editor's own drawn scene, through the load
  // door's probe, gives what a tape measures: SPAN tip to tip, LENGTH spinner to rudder, HEIGHT standing on the gear at
  // the settled deck angle (tail down on a taildragger), the propeller's blades left out. The node figures stay beside it.
  const drawn = rawForDrawn ? drawnDims(rawForDrawn, Math.asin(Math.max(-1, Math.min(1, -xA[1])))) : null;
  // a drawn figure more than 35 % off the structure's is something else in the scene (the Petrel's branch drew a 12.5 m
  // "length" over a 5.6 m hull): the structure's figure is kept and the drawn one flagged
  const pickD = (k, node) => { if (!drawn || drawn[k] == null || node == null) return node; if (Math.abs(drawn[k] / node - 1) > 0.35) { (drawn.suspect = drawn.suspect || []).push(k); return node; } return drawn[k]; };
  return {
    drawn,
    dims: { span: pickD('span', (sh && sh.span) || G.span || null), length: pickD('length', (t.vX != null && t.vChord != null ? t.vX + t.vChord : x1) - x0),
            height: pickD('height', y1 - y0), S: (sh && sh.Sw) || G.Sw || null,
            cRoot: w.chord || null, cTip: w.chord ? w.chord * (w.taper == null ? 1 : w.taper) : null, hSpan: t.hSpan || null, Sh: t.Sh || null, Sv: t.Sv || null, track: g.track || null },
    nodes: { span: (sh && sh.span) || G.span || null, length: (t.vX != null && t.vChord != null ? t.vX + t.vChord : x1) - x0, height: y1 - y0 },
    specs: { engine: e.name || null, hp: e.powerW ? e.powerW / 745.7 : null, nE: def.params.nEngines || 1, propD: P.D || (spec.prop && spec.prop.D) || null,
             blades: (spec.prop && spec.prop.blades) || null, empty, mtow: def.parts.designGross || null, fuelL, seats: (spec.cabin && spec.cabin.seats) || null },
  };
}
function runPlane(key, P) {
  const tStart = Date.now();
  const R = REFS[P.ref];
  if (!R) throw new Error('no reference row ' + P.ref);
  const { spec, errors } = loadSpec(P);
  const def0 = C.buildGen(spec);
  const F = loadFacts(def0);
  const CS = cases(def0, F, R, P, P.cgSweep || has('cg'));
  const out = { key, label: P.label, file: P.file, ref: P.ref, refName: R.name, official: !!P.official, engineNote: P.engineNote || null,
                provisional: !!P.provisional, note: P.note || null, group: P.group || null, card: P.card || null,
                shape: measureShape(spec, def0, P.file ? JSON.parse(fs.readFileSync(path.join(ROOT, P.file), 'utf8')).spec || JSON.parse(fs.readFileSync(path.join(ROOT, P.file), 'utf8')) : null),
                joinErrors: errors, facts: { empty: F.empty, baked: F.mass, fuelKg: F.fuelKg, seats: F.nSeats, occupied: F.occB, baggage: F.baggage,
                engine: def0.params.engine && def0.params.engine.name, hp: def0.params.engine ? def0.params.engine.powerW / 745.7 : null,
                S: def0.params.gen && def0.params.gen.Sw, flapsGame: def0.params.flaps ? { to: def0.params.flaps.to, ldg: def0.params.flaps.ldg } : null,
                landsFlapless: !!(def0.params.gen && def0.params.gen.landsFlapless), tail: { Sh: spec.tail && spec.tail.Sh, hSpan: spec.tail && spec.tail.hSpan, Sv: spec.tail && spec.tail.Sv } },
                cases: [], flights: {}, sweep: null, water: {}, t: {} };
  // 1. the airframe at every load
  for (const lc of CS) {
    const a = airframe(spec, lc, R, P);
    out.cases.push(Object.assign({ id: lc.id, label: lc.label, fuel: lc.fuel }, a));
    log(key, lc.id.padEnd(5) + ' ' + f(a.mass) + ' kg  Vs ' + f(a.Vs) + '  V75 ' + f(a.V75) + '  Vmax ' + f(a.Vmax) + '  ROC ' + f(a.roc, 2) + ' @' + f(a.Vy) + '  L/D ' + f(a.LD, 1) +
                '  TO(grass) ' + f(a.TOgrass) + '  CG ' + f(a.cgMAC) + '% SM ' + f(a.sm) + '%  de(appr, flap ' + f(a.flapLdg, 2) + ') ' + f(a.deAppr, 3));
  }
  out.t.airframe = (Date.now() - tStart) / 1000;
  if (has('quick')) return finish(out, tStart);
  const poh = R.poh || {};
  const land = !P.water || P.land, water = !!P.water;
  const surf = (() => { for (const k of ['TO', 'LDG', 'TO50']) { const r = R.rows[k]; if (r && r.surface && r.surface !== 'unknown') return r.surface; } return 'grass'; })();
  out.surface = surf;
  const techOf = (a, over) => Object.assign({ vr: poh.vr || 1.1, vy: (poh.vy || 1.35) * a.Vs / 3.6, cruiseK: 1.0, flapTO: a.flapTO, flapLDG: a.flapLdg, brake: poh.brake != null ? poh.brake : 0.6, brakeRate: 0.5, vBrakeOn: 1.0, runup: !!poh.runup, stopShort: !!poh.stopShort }, over || {});
  const spd = a => ({ Vs: a.Vs / 3.6, VsTO: a.VsTO / 3.6, Vs0: a.Vs0 / 3.6 });
  const caseOf = id => CS.find(c => c.id === id);
  // 2. the flights at every load: the game's pilot and the POH schedule (a whole circuit each)
  if (land && !has('noland')) {
    for (const lc of CS) {
      const a = out.cases.find(c => c.id === lc.id);
      const def = C.buildGen(spec);
      const game = flight(spec, def, lc, Object.assign({ mode: 'circuit', surface: surf }, spd(a)));
      const pohF = flight(spec, def, lc, Object.assign({ mode: 'circuit', surface: surf, tech: techOf(a) }, spd(a)));
      out.flights[lc.id] = { game, poh: pohF };
      log(key, lc.id.padEnd(5) + ' flown  game: ' + fl(game) + '\n' + ' '.repeat(key.length + 9) + 'POH:  ' + fl(pohF));
    }
    // 3. the technique sweep at one load
    const sid = opt('sweep', P.sweep || 'mtow'), lc = caseOf(sid) || caseOf('mtow'), a = out.cases.find(c => c.id === lc.id);
    const def = C.buildGen(spec), base = techOf(a), runs = [];
    const flaps = [...new Set([0, a.flapTO, def0.params.flaps ? def0.params.flaps.to : 0].map(x => +(+x || 0).toFixed(3)))];
    for (const vr of [1.0, 1.1, 1.2]) for (const fT of flaps) {
      const VsTO = fT ? (() => { const d = loadedDef(spec, lc), s = C.makeSim(d, null); s.reset(0); return stallOf(s, d, s.totalM * G, fT); })() : a.Vs / 3.6;
      const r = flight(spec, def, lc, { mode: 'climb', surface: surf, tech: Object.assign({}, base, { vr, flapTO: fT }), Vs: a.Vs / 3.6, VsTO, Vs0: a.Vs0 / 3.6 });
      runs.push({ what: 'takeoff', vr, flapTO: fT, r });
    }
    for (const vyK of [0.85, 1.0, 1.15]) {
      const vy = vyK * a.Vy / 3.6;
      const r = flight(spec, def, lc, Object.assign({ mode: 'climb', surface: surf, tech: Object.assign({}, base, { vy }) }, spd(a)));
      runs.push({ what: 'climb', vyK, vy: vy * 3.6, r });
    }
    // (the fourth: the short-field stop by the gear - a taildragger's stick full back and firm brakes from the touchdown,
    // eased against a nose-over; a tricycle's flaps up and maximum brakes)
    for (const [brake, brakeRate, vBrakeOn, vapp, stopShort] of [[1.0, 1.0, 1.2, 1.3], [poh.brake != null ? poh.brake : 0.6, 1.0, 1.2, 1.2], [0.8, 0.5, 1.0, 1.2], [1.0, 1.0, 1.2, 1.3, true]]) {
      const r = flight(spec, def, lc, Object.assign({ mode: 'circuit', surface: surf, tech: Object.assign({}, base, { brake, brakeRate, vBrakeOn, vapp, stopShort: !!stopShort }) }, spd(a)));
      runs.push({ what: 'landing', brake, brakeRate, vBrakeOn, vapp, stopShort: !!stopShort, r });
    }
    const ok = x => x != null && isFinite(x);
    const minOf = (k, w) => { let b = null; for (const x of runs) if ((!w || x.what === w) && ok(x.r[k]) && !x.r.noseOver && !x.r.groundLoop && (b == null || x.r[k] < b.v)) b = { v: x.r[k], run: x }; return b; };
    const maxOf = (k, w) => { let b = null; for (const x of runs) if ((!w || x.what === w) && ok(x.r[k]) && (b == null || x.r[k] > b.v)) b = { v: x.r[k], run: x }; return b; };
    const allF = [...runs.map(x => x.r), out.flights[lc.id].poh];
    const bestMin = k => { let b = null; for (const r of allF) if (ok(r[k]) && (b == null || r[k] < b)) b = r[k]; return b; };
    const bestMax = k => { let b = null; for (const r of allF) if (ok(r[k]) && (b == null || r[k] > b)) b = r[k]; return b; };
    out.sweep = { load: lc.id, mass: lc.mass, runs: runs.map(x => Object.assign({ what: x.what, vr: x.vr, flapTO: x.flapTO, vyK: x.vyK, vy: x.vy, brake: x.brake, brakeRate: x.brakeRate, vBrakeOn: x.vBrakeOn, vapp: x.vapp, stopShort: x.stopShort || undefined, runup: x.what === 'takeoff' ? !!base.runup : undefined }, x.r)),
                  best: { TO: bestMin('TO'), TO50: bestMin('TO50'), climb: bestMax('climb'), LDG: bestMin('LDG'), LDG50: bestMin('LDG50') },
                  bestRun: { TO: brief(minOf('TO')), TO50: brief(minOf('TO50')), climb: brief(maxOf('climb')), LDG: brief(minOf('LDG')) } };
    log(key, 'sweep @' + lc.id + ': best TO ' + f(out.sweep.best.TO) + ' m, TO50 ' + f(out.sweep.best.TO50) + ' m, climb ' + f(out.sweep.best.climb, 2) + ' m/s, LDG ' + f(out.sweep.best.LDG) + ' m');
  }
  // 4. the water: GATE HYDROTRIM's rig (POH + rig technique) at every load, and the game's pilot off the SEA lane
  if (water && !has('nowater')) {
    for (const lc of CS) {
      const a = out.cases.find(c => c.id === lc.id);
      const rp = waterRig(spec, lc, true), rr = waterRig(spec, lc, false);
      const def = C.buildGen(spec);
      const game = flight(spec, def, lc, Object.assign({ mode: 'circuit', water: true }, spd(a)));
      out.water[lc.id] = { poh: rp, rig: rr, game };
      log(key, lc.id.padEnd(5) + ' water  POH ' + f(rp.TOW) + ' m / ' + f(rp.TOWs, 1) + ' s   rig ' + f(rr.TOW) + ' m / ' + f(rr.TOWs, 1) + ' s   game: ' + fl(game));
    }
  }
  return finish(out, tStart);
}
function brief(b) { if (!b) return null; const x = b.run; return { v: b.v, what: x.what, vr: x.vr, flapTO: x.flapTO, vyK: x.vyK, brake: x.brake, brakeRate: x.brakeRate, vBrakeOn: x.vBrakeOn, vapp: x.vapp, stopShort: x.stopShort || undefined }; }
function fl(r) { return 'TO ' + f(r.TO) + ' m (' + f(r.Vlof) + ' km/h), 50ft ' + f(r.TO50) + ' m, climb ' + f(r.climb, 2) + ' m/s @' + f(r.Vclimb) + ' thr ' + f(r.thrClimb, 2) +
                        ', LDG ' + f(r.LDG) + ' m (50ft ' + f(r.LDG50) + ', flap ' + f(r.flapLdgFlown, 2) + ', td ' + f(r.Vtd) + ' km/h), ' + r.outcome + (r.noseOver ? ' NOSE-OVER (pitch ' + f(r.pitchMin) + ' deg after ' + f(r.LDGnoseOver) + ' m)' : '') + (r.groundLoop ? ' GROUND LOOP (' + f(r.hdgSwing) + ' deg)' : '') + (r.goArounds ? ' GA ' + r.goArounds : '') + ' [' + f(r.wall) + ' s]'; }
function log(key, s) { if (!has('quiet')) console.log('[' + key + '] ' + s); }
function finish(out, t0) { out.verdicts = verdicts(out); out.t.total = (Date.now() - t0) / 1000; return out; }

// ---------------------------------------------------------------------------------------------------------------------
// THE VERDICTS: our band at the reference's weights against the reference's band
// ---------------------------------------------------------------------------------------------------------------------
// our value of `k` at mass m: piecewise-linear over the MIN / TYP / MTOW cases (extrapolated past the ends)
// (`clamp`, the verdicts' reading: outside the measured loads the band follows the END-TO-END secant (MIN to MTOW,
// not the nearest segment, whose slope a near-threshold flight can make absurd: the Petrel's water run at 406 kg read
// -91 m off MIN 463 / TYP 486), no further than 15 % of the mass past the end, never below zero)
function interp(pts, m, clamp) {
  const p = pts.filter(q => q.v != null && isFinite(q.v)).sort((a, b) => a.m - b.m);
  if (!p.length) return null; if (p.length === 1) return p[0].v;
  if (clamp && (m < p[0].m || m > p[p.length - 1].m)) {
    const a = p[0], b = p[p.length - 1], k = (b.v - a.v) / Math.max(1e-9, b.m - a.m);
    const mm = Math.max(a.m * 0.85, Math.min(b.m * 1.15, m)), e = mm < a.m ? a : b;
    return Math.max(0, e.v + k * (mm - e.m));
  }
  let i = 0; while (i < p.length - 2 && m > p[i + 1].m) i++;
  const a = p[i], b = p[i + 1]; return a.v + (b.v - a.v) * (m - a.m) / Math.max(1e-9, b.m - a.m);
}
// the weight at which ours equals v (the load that explains it), searched 0.6 x MIN .. 1.3 x MTOW
function solveM(pts, v) {
  const p = pts.filter(q => q.v != null && isFinite(q.v)); if (p.length < 2) return null;
  const vs = p.map(q => q.v); if (Math.max(...vs) - Math.min(...vs) < 0.03 * Math.abs(v)) return null;   // weight-insensitive (L/D, CdS)
  const lo = Math.min(...p.map(q => q.m)) * 0.6, hi = Math.max(...p.map(q => q.m)) * 1.3;
  let best = null;
  for (let m = lo; m <= hi; m += (hi - lo) / 400) { const d = Math.abs(interp(p, m) - v); if (best == null || d < best.d) best = { m, d }; }
  return best && best.d < Math.abs(v) * 0.01 ? best.m : null;
}
function refKg(R, row, ours) {
  const solo = R.empty + 77 + 0.5 * (R.fuelL || 0) * 0.72, light = R.empty + 70 + 0.25 * (R.fuelL || 0) * 0.72;
  const k = row.kg;
  if (k == null || k === 'unknown') return [light, R.mtow];
  if (k === 'gross') return [R.mtow, R.mtow];
  if (k === 'solo') return [solo, solo];
  if (Array.isArray(k)) return k;
  return [k, k];
}
function verdicts(out) {
  const R = REFS[out.ref], V = [];
  const pick = (id, sel) => { const c = out.cases.find(x => x.id === id); return c ? sel(c, id) : null; };
  const series = sel => out.cases.filter(c => ['min', 'typ', 'mtow'].includes(c.id)).map(c => ({ m: c.mass, v: sel(c, c.id) }));
  const flown = (who, k) => (c, id) => { const F = out.flights[id]; return F && F[who] ? F[who][k] : null; };
  const wat = (who, k) => (c, id) => { const F = out.water[id]; return F && F[who] ? F[who][k] : null; };
  const SRC = {
    Vs1: [['airframe', c => c.Vs]], V75: [['airframe', c => c.V75]], Vmax: [['airframe', c => c.Vmax]], LD: [['airframe', c => c.LD]],
    roc: [['airframe', c => c.roc], ['POH', flown('poh', 'climb')], ['game', flown('game', 'climb')]],
    TO: [['airframe (grass)', c => c.TOgrass], ['POH', flown('poh', 'TO')], ['game', flown('game', 'TO')]],
    TO50: [['POH', flown('poh', 'TO50')], ['game', flown('game', 'TO50')]],
    LDG: [['POH', flown('poh', 'LDG')], ['game', flown('game', 'LDG')]],
    LDG50: [['POH', flown('poh', 'LDG50')], ['game', flown('game', 'LDG50')]],
    TOW: [['POH (water rig)', wat('poh', 'TOW')], ['rig (no flap)', wat('rig', 'TOW')], ['game', wat('game', 'TO')]],
    TOWs: [['POH (water rig)', wat('poh', 'TOWs')], ['rig (no flap)', wat('rig', 'TOWs')], ['game', wat('game', 'TOs')]],
    TOW50: [['game', wat('game', 'TO50')]],
  };
  for (const rk of Object.keys(R.rows)) {
    const row = R.rows[rk], k = row.key || rk;
    const rv = Array.isArray(row.v) ? row.v : [row.v, row.v], tol = row.tol || 0.05;
    const band = [Math.min(...rv) * (1 - tol), Math.max(...rv) * (1 + tol)];
    if (k === 'empty') {
      const o = out.facts.empty;
      V.push({ k: rk, src: 'ledger', ref: rv, refBand: band, kg: null, ours: [o, o], verdict: cls(o, o, band), mAt: null, row });
      continue;
    }
    const kg = refKg(R, row);
    for (const [who, sel] of (SRC[k] || [])) {
      const s = series(sel); if (!s.some(q => q.v != null)) continue;
      const a = interp(s, kg[0], true), b = interp(s, kg[1], true);
      if (a == null || b == null) continue;
      const lo = Math.min(a, b), hi = Math.max(a, b);
      const mid = 0.5 * (rv[0] + rv[1]);
      const ms = s.filter(q => q.v != null).map(q => q.m), extrap = kg[0] < Math.min(...ms) - 5 || kg[1] > Math.max(...ms) + 5;
      V.push({ k: rk, src: who, ref: rv, refBand: band, kg, ours: [lo, hi], verdict: cls(lo, hi, band), extrap, mAt: solveM(s, mid), series: s, row });
    }
  }
  // the pilot's share at the sweep load: game - best (a distance: positive = the pilot costs metres; a climb: best - game)
  if (out.sweep) {
    const g = out.flights[out.sweep.load] && out.flights[out.sweep.load].game, b = out.sweep.best;
    out.pilotShare = g ? { load: out.sweep.load, TO: dif(g.TO, b.TO), TO50: dif(g.TO50, b.TO50), climb: dif(b.climb, g.climb), LDG: dif(g.LDG, b.LDG), LDG50: dif(g.LDG50, b.LDG50),
                           game: { TO: g.TO, TO50: g.TO50, climb: g.climb, LDG: g.LDG, LDG50: g.LDG50 }, best: b } : null;
  }
  return V;
}
const dif = (a, b) => (a != null && b != null) ? a - b : null;
function cls(lo, hi, band) {
  if (hi >= band[0] && lo <= band[1]) return 'inside';
  const gap = lo > band[1] ? lo / band[1] - 1 : 1 - hi / band[0];
  return gap <= 0.10 ? 'near' : 'outside';
}

// ---------------------------------------------------------------------------------------------------------------------
// THE REPORT PIECES
// ---------------------------------------------------------------------------------------------------------------------
const UNIT = { empty: 'kg', Vs1: 'km/h', V75: 'km/h', Vmax: 'km/h', roc: 'm/s', LD: '', TO: 'm', TO50: 'm', LDG: 'm', LDG50: 'm', TOW: 'm', TOWs: 's', TOW50: 'm', roc2: 'm/s', TOW2: 'm' };
const DEC = { roc: 2, roc2: 2, LD: 1, TOWs: 1 };
function md(out) {
  const L = [], R = REFS[out.ref], d = k => DEC[k] || 0;
  L.push('### ' + out.label + ' — against the ' + R.name);
  L.push('');
  L.push('Build `' + out.file + '` through the load door' + (out.joinErrors.length ? ' (join errors: ' + out.joinErrors.join('; ') + ')' : '') + '; ' + f(out.facts.hp) + ' hp ' + (out.facts.engine || '') +
         ', S ' + f(out.facts.S, 1) + ' m², empty ' + f(out.facts.empty) + ' kg, as baked ' + f(out.facts.baked) + ' kg, fuel ' + f(out.facts.fuelKg) + ' kg, ' + out.facts.seats + ' seats.' +
         (out.engineNote ? ' **Engine:** ' + out.engineNote + '.' : '') + ' Reference: ' + R.src + '.');
  L.push('');
  L.push('| load | mass kg | CG % MAC | SM % | Vs | Vs0 | V75 | Vmax | ROC m/s (Vy) | L/D | CdS | TO grass (analytic) | approach trim de (flap) |');
  L.push('|---|---|---|---|---|---|---|---|---|---|---|---|---|');
  for (const c of out.cases) L.push('| ' + c.id + ' | ' + f(c.mass) + ' | ' + f(c.cgMAC) + ' | ' + f(c.sm) + ' | ' + f(c.Vs) + ' | ' + f(c.Vs0) + ' | ' + f(c.V75) + ' | ' + f(c.Vmax) + ' | ' + f(c.roc, 2) + ' (' + f(c.Vy) + ') | ' + f(c.LD, 1) + ' | ' + f(c.CdS, 2) + ' | ' + f(c.TOgrass) + ' | ' + f(c.deAppr, 3) + ' (' + f(c.flapLdg, 2) + ') |');
  L.push('');
  if (Object.keys(out.flights).length) {
    L.push('Flown on ' + out.surface + ' (flat, calm, ISA). game = the pilot as it ships; POH = the same pilot on the handbook schedule.');
    L.push('');
    L.push('| load | who | TO roll | Vlof | TO 50 ft | climb m/s @ km/h (thr) | LDG roll | LDG 50 ft | flap flown | outcome |');
    L.push('|---|---|---|---|---|---|---|---|---|---|');
    for (const id of Object.keys(out.flights)) for (const who of ['game', 'poh']) { const r = out.flights[id][who];
      L.push('| ' + id + ' | ' + who + ' | ' + f(r.TO) + ' | ' + f(r.Vlof) + ' | ' + f(r.TO50) + ' | ' + f(r.climb, 2) + ' @ ' + f(r.Vclimb) + ' (' + f(r.thrClimb, 2) + ') | ' + f(r.LDG) + ' | ' + f(r.LDG50) + ' | ' + f(r.flapLdgFlown, 2) + ' | ' + r.outcome + (r.goArounds ? ', ' + r.goArounds + ' GA' : '') + (r.hard ? ', HARD (sink ' + f(r.tdSink, 1) + ' m/s)' : '') + (r.noseOver ? ', NOSE-OVER (' + f(r.pitchMin) + ' deg after ' + f(r.LDGnoseOver) + ' m)' : '') + (r.groundLoop ? ', GROUND LOOP (' + f(r.hdgSwing) + ' deg)' : '') + ' |'); }
    L.push('');
  }
  if (out.sweep) {
    const ps = out.pilotShare || {}, b = out.sweep.bestRun;
    L.push('Technique sweep at ' + out.sweep.load + ' (' + f(out.sweep.mass) + ' kg; ' + out.sweep.runs.length + ' flights): best TO roll ' + f(out.sweep.best.TO) + ' m' + (b.TO ? ' (rotate ' + b.TO.vr + ' Vs, flap ' + f(b.TO.flapTO, 2) + ')' : '') +
           ', best TO 50 ft ' + f(out.sweep.best.TO50) + ' m, best climb ' + f(out.sweep.best.climb, 2) + ' m/s' + (b.climb && b.climb.vyK ? ' (' + b.climb.vyK + ' x the probe\'s Vy)' : '') + ', best landing roll ' + f(out.sweep.best.LDG) + ' m' + (b.LDG && b.LDG.brake != null ? ' (brake ' + b.LDG.brake + ' at ' + b.LDG.brakeRate + '/s from ' + b.LDG.vBrakeOn + ' Vs, approach ' + b.LDG.vapp + ' Vs0' + (b.LDG.stopShort ? ', the short-field stop' : '') + ')' : '') + '.' + ((((REFS[out.ref] || {}).poh) || {}).runup ? ' Take-offs flown with the STOL run-up (brakes held to full rpm, stick back).' : ''));
    L.push('**The pilot\'s share** (game − best, at ' + ps.load + '): TO roll ' + sg(ps.TO) + ' m, TO 50 ft ' + sg(ps.TO50) + ' m, climb ' + sg(ps.climb, 2) + ' m/s, landing roll ' + sg(ps.LDG) + ' m.');
    L.push('');
  }
  if (Object.keys(out.water).length) {
    L.push('| load | water: POH rig run / time | rig (no flap) | hump R/W | game pilot (SEA lane) run / time / 50 ft / climb |');
    L.push('|---|---|---|---|---|');
    for (const id of Object.keys(out.water)) { const w = out.water[id];
      L.push('| ' + id + ' | ' + f(w.poh.TOW) + ' m / ' + f(w.poh.TOWs, 1) + ' s | ' + f(w.rig.TOW) + ' m / ' + f(w.rig.TOWs, 1) + ' s | ' + f(w.poh.hump, 3) + ' | ' + f(w.game.TO) + ' m / ' + f(w.game.TOs, 1) + ' s / ' + f(w.game.TO50) + ' m / ' + f(w.game.climb, 2) + ' m/s (' + w.game.outcome + ') |'); }
    L.push('');
  }
  L.push('| indicator | reading | reference (band) | at kg | ours at those kg | verdict | ours equals theirs at |');
  L.push('|---|---|---|---|---|---|---|');
  for (const v of out.verdicts) {
    const r = v.ref[0] === v.ref[1] ? f(v.ref[0], d(v.k)) : f(v.ref[0], d(v.k)) + '–' + f(v.ref[1], d(v.k));
    const kg = v.kg ? (v.kg[0] === v.kg[1] ? f(v.kg[0]) : f(v.kg[0]) + '–' + f(v.kg[1])) : '—';
    const o = v.ours[0] === v.ours[1] || Math.abs(v.ours[0] - v.ours[1]) < 1e-9 ? f(v.ours[0], d(v.k)) : f(v.ours[0], d(v.k)) + '–' + f(v.ours[1], d(v.k));
    L.push('| ' + v.k + ' ' + (UNIT[v.k] || '') + ' | ' + v.src + ' | ' + r + ' (' + f(v.refBand[0], d(v.k)) + '–' + f(v.refBand[1], d(v.k)) + ') | ' + kg + ' | ' + o + ' | **' + v.verdict + '**' + (v.extrap ? ' (extrap.)' : '') + ' | ' + whoLoad(out, v.mAt) + ' |');
  }
  L.push('');
  return L.join('\n');
}
const sg = (v, d = 0) => v == null ? '—' : (v >= 0 ? '+' : '') + v.toFixed(d);
function whoLoad(out, m) {
  if (m == null) return '—';
  const c = id => (out.cases.find(x => x.id === id) || {}).mass;
  const mn = c('min'), ty = c('typ'), mt = c('mtow');
  const w = m < mn - 15 ? 'below our lightest load' : m > mt + 15 ? 'above gross' : Math.abs(m - mn) <= 20 ? '≈ MIN' : Math.abs(m - ty) <= 20 ? '≈ solo, half fuel' : Math.abs(m - mt) <= 20 ? '≈ gross' : m < ty ? 'between MIN and solo' : 'between solo and gross';
  return f(m) + ' kg (' + w + ')';
}
// THE CHART: one row per plane x indicator - our band at the reference's weights (bar) against the reference band
// (outline), on a log-free percentage scale centred on the reference's middle
function svg(results) {
  const rows = [];
  for (const out of results) for (const v of out.verdicts) {
    if (v.k === 'empty' || !/^(airframe|POH|POH \(water rig\)|game)/.test(v.src)) continue;
    rows.push({ name: out.key + ' ' + v.k + ' · ' + v.src, v });
  }
  const W = 860, rh = 18, top = 40, H = top + rows.length * rh + 30, x0 = 330, x1 = W - 20, lim = 0.6;
  const X = p => x0 + (x1 - x0) * (Math.max(-lim, Math.min(lim, p)) + lim) / (2 * lim);
  const col = { inside: '#2f7d4e', near: '#b8860b', outside: '#c9451c' };
  let s = '<svg xmlns="http://www.w3.org/2000/svg" width="' + W + '" height="' + H + '" font-family="sans-serif" font-size="11">';
  s += '<rect width="100%" height="100%" fill="#fff"/><text x="10" y="18" font-size="13" font-weight="bold">real_check: our band (bar, at the reference\'s weights) vs the reference band (outline), % of the reference\'s middle</text>';
  for (const p of [-0.6, -0.4, -0.2, 0, 0.2, 0.4, 0.6]) s += '<line x1="' + X(p) + '" x2="' + X(p) + '" y1="' + (top - 8) + '" y2="' + (H - 25) + '" stroke="' + (p === 0 ? '#333' : '#ddd') + '"/><text x="' + X(p) + '" y="' + (H - 12) + '" text-anchor="middle">' + (p * 100).toFixed(0) + ' %</text>';
  rows.forEach((r, i) => {
    const y = top + i * rh, v = r.v, mid = 0.5 * (v.ref[0] + v.ref[1]), pc = x => x / mid - 1;
    s += '<text x="10" y="' + (y + 12) + '">' + r.name.replace(/&/g, '&amp;').replace(/</g, '&lt;') + '</text>';
    s += '<rect x="' + X(pc(v.refBand[0])) + '" y="' + (y + 2) + '" width="' + Math.max(1, X(pc(v.refBand[1])) - X(pc(v.refBand[0]))) + '" height="' + (rh - 4) + '" fill="none" stroke="#132238" stroke-dasharray="3,2"/>';
    const a = X(pc(v.ours[0])), b = X(pc(v.ours[1]));
    s += '<rect x="' + Math.min(a, b) + '" y="' + (y + 5) + '" width="' + Math.max(3, Math.abs(b - a)) + '" height="' + (rh - 10) + '" fill="' + col[v.verdict] + '"/>';
  });
  return s + '</svg>';
}

// ---------------------------------------------------------------------------------------------------------------------
// MAIN
// ---------------------------------------------------------------------------------------------------------------------
function main() {
  const keys = args.filter(a => !a.startsWith('--'));
  const t0 = Date.now();
  if (has('all') || keys.length > 1) {
    const list = has('all') ? Object.keys(PLANES).filter(k => !PLANES[k].branch || has('branch')) : keys;
    const jobs = +opt('jobs', 4), { spawn } = require('child_process');
    const dir = opt('dir', path.join(T, 'perf', 'real_check'));
    fs.mkdirSync(dir, { recursive: true });
    const pass = args.filter(a => /^--(quick|cg|sweep=|noland|nowater|core=)/.test(a));
    let i = 0, live = 0; const done = [];
    const next = () => {
      while (live < jobs && i < list.length) {
        const k = list[i++]; live++;
        const ch = spawn(process.execPath, [__filename, k, '--quiet', '--json=' + path.join(dir, k + '.json'), ...pass], { stdio: ['ignore', 'inherit', 'inherit'] });
        const s0 = Date.now();
        ch.on('exit', code => { live--; done.push(k); console.log('[all] ' + k + ' exit ' + code + ' in ' + ((Date.now() - s0) / 1000).toFixed(0) + ' s (' + done.length + '/' + list.length + ')'); if (done.length === list.length) collect(list, dir, t0); else next(); });
      }
    };
    next();
    return;
  }
  let key = keys[0], P = PLANES[key];
  if (opt('build')) { key = path.basename(opt('build'), '.json'); P = { label: key, file: opt('build'), ref: opt('ref', 'c172r'), water: has('water'), land: !has('water') || has('land') }; }
  if (!P) { console.log('usage: node tools/real_check.js <' + Object.keys(PLANES).join('|') + '> | --all | --build=f.json --ref=<' + Object.keys(REFS).join('|') + '>'); process.exit(2); }
  const out = runPlane(key, P);
  out.wall = (Date.now() - t0) / 1000;
  if (opt('json')) fs.writeFileSync(opt('json'), JSON.stringify(out, (k, v) => (k === 'row' ? undefined : v), 1));
  const m = md(out);
  if (opt('md')) fs.writeFileSync(opt('md'), m);
  if (opt('svg')) fs.writeFileSync(opt('svg'), svg([out]));
  if (!has('quiet') || !opt('json')) console.log('\n' + m);
  console.log('[' + key + '] done in ' + f(out.wall) + ' s');
}
function collect(list, dir, t0) {
  const res = list.map(k => { try { return JSON.parse(fs.readFileSync(path.join(dir, k + '.json'), 'utf8')); } catch (e) { return null; } }).filter(Boolean);
  for (const r of res) r.verdicts = verdicts(r);
  const parts = res.map(md);
  const sum = ['| plane | inside | near | outside | wall s |', '|---|---|---|---|---|'];
  for (const r of res) { const n = w => r.verdicts.filter(v => v.verdict === w).length; sum.push('| ' + r.key + ' | ' + n('inside') + ' | ' + n('near') + ' | ' + n('outside') + ' | ' + f(r.wall) + ' |'); }
  const text = '## The set\n\n' + sum.join('\n') + '\n\nWhole set: ' + f((Date.now() - t0) / 1000) + ' s wall.\n\n' + parts.join('\n');
  fs.writeFileSync(opt('md', path.join(dir, 'real_check.md')), text);
  fs.writeFileSync(opt('svg', path.join(dir, 'real_check.svg')), svg(res));
  console.log(text);
}
if (require.main === module) main();
module.exports = { flight, loadSpec, airframe, runPlane, verdicts, md, svg, interp, solveM, cases, loadFacts, makeCase, REFS, PLANES, HISTORY };
