#!/usr/bin/env node
// GATE RETRACT (RETRACT-1, 2026-11-03; futureDesigns/RETRACT-STUDY-2026-11.md §3.1) - THE RETRACTABLE GEAR, step 1.
// The metal Cessna fixture (a tricycle) flown with spec.gear.retract and without it:
//   1. THE SPEC: clampSpec keeps a tricycle's retract with its defaults (6 s, hydraulic, free fall), clamps the cycle
//      (2-20 s), and drops it on a taildragger and on floats; a fixed build's def carries no params.retract, its sim
//      no gear (sim.gear() null) and its ctl no gear key - nothing of the gear exists where it was not chosen
//   2. THE BILL: a retracting gear wears no fairings; against the same aeroplane fixed and bare it is heavier by the kit
//      (GEN_RULES.retractKg of the gross, on the gear's ledger row) and dearer by GEN_PRICES.retract; params.retract.cdA
//      is the gear's own drag (gen.drag.gear)
//   3. THE SQUAT SWITCH: the handle up on the ground holds the gear down (pos 1 after 3 s)
//   4. THE CIRCUIT (the expert): the gear up in the climb (over 15 m, climbing), the transit the cycle's time (+-0.2 s),
//      down for the circuit, down and locked at the flare, landed on its wheels (a touchdown, under 2.5 m/s, no prop
//      strike, not crashed)
//   5. THE DRAG: the circuit to the base turn with the handle held down and held up - the downwind is faster gear up
//   6. THE GEAR-UP LANDING: a person with gearForget 0.05 drawn from seed 17 (pilotGearDice(17, 0) < 0.05) forgets the
//      approach - the 'gear-forgotten' verdict, no wheel touchdown, the propeller strikes, the belly scrapes (the scar)
//   7. THE POWER AND THE EMERGENCY: in flight with the gear up, the power off and the handle down - the gear does not
//      move; gearEmergency() - down and locked in the free fall's time (4 s, +-0.3 s)
//   8. THE FORGETFUL PERSON'S OTHER DAY: the same person from seed 1935 lowers it and lands on its wheels; the expert
//      never forgets
//  10. THE FOLD (G1, the T-tail tourer drawn headless, _scene_headless): inward goes inboard and up and the starboard
//      mirrors it, outward outboard, aft-flat aft with the wheel's axis upright, two axes two turns, a custom fold equal
//      to the preset it copies, the fraction stopping part way, the preview posing the drawn units (and not the capture),
//      the join's fraction and measured lift, the certificate strip, and a partial gear's downwind between the two
//  11. DOES IT FIT (G2, the T-tail tourer headless): as born the mains meet and stow out of the body, the half track,
//      the fold and the leg go red; the fit costs under 300 ms; a wider track at a partial fold fits with nothing red;
//      the mains forward cross the front spar; the nose turned too far rises into the floor; a fixed gear has no fit
//  12. THE RESERVATION (G3): a well per unit round its stowed wheel; a tank at a well meets it (body box turned, wing
//      side box), one 2 m away does not; the join writes gear.wells; the under-floor bay gives up the mains' litres,
//      the wing root a wide track's; no retraction, no wells; a fixed build's bays untouched
//  13. THE WELLS CUT (G4): as born two cuts (the mains' merged, the nose's), convex CCW; every axle position inside the
//      body lies inside its outline; the knife (_knife_gen knifeWells) cuts one closed loop per well, walls and a flat
//      ceiling at the cut's height (section wheelWell), and carves the frames and liners out of the volume; the measured
//      sheet is never cut; the box option (gearWellCut 1) is a rounded rectangle holding the exact hull and cuts as
//      cleanly; a 3.2 m track cuts the nose alone; a 0.6 fraction cuts nothing; a fixed gear nothing; the preview row
//      never moves the cut
//  14. THE MECHANISM (GM1): the nose's trunnion inside the body, the mains' inside the wing between its skins; three
//      oleo legs, flown as an oleo; no fitting in a well; a wing too thin for a trunnion turns the station red
//  15. THE ACTUATION (GM2/GM3): each unit's brace and actuator; the brace links keep their lengths over the fold (1e-9);
//      every actuator holds its stroke; down, every part's pose is the identity; the rest slot - the nose leg leaves the
//      skin inside its well; the kinematics is the core's
//  16. THE WING'S WELLS (G5): a 3.2 m track's mains wells in the wing; the wing's skin cut from below (closed loops,
//      walls and a ceiling); the main leg's rest slot in the wing's lower skin inside its well; a wing well closed under
//      the upper skin; as born, the centre section carved out of the mains' belly well
//  17. THE DOORS (G6): exact - a leg door on each unit and well doors; up, every door flush on its skin; a well door
//      opens down in transit; box - two doors split or one, no leg door; doors off - none; every door a kinematics part
//   9. THE HORN (audio_params + airframe_model, node): the gear warning is 1 with the gear up and the throttle back,
//      0 with the gear down, 0 on the ground, 0 with no gear (a fixed build); the stall voice sounds it intermittently
// Run: node tools/_retract_check.js   (one final `GATE RETRACT: PASS|FAIL`)
'use strict';
const fs = require('fs'), path = require('path');
const C = require('./flight_core.js'), LB = require('./_load_build.js');
let bad = 0;
const check = (ok, label, note) => { console.log((ok ? '  ok   ' : '  FAIL ') + label + (note != null ? '  (' + note + ')' : '')); if (!ok) bad++; return ok; };
const raw = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'build_v10_cessnaMetal_2026-09-26.json'), 'utf8'));
const specOf = (retract, bare) => { const s = LB.gameSpec(JSON.parse(JSON.stringify(raw))); if (retract) s.gear.retract = retract;
  if (bare) { s.gear.fairing = s.gear.twFairing = 'none'; s.gear.legFair = s.gear.twLegFair = 'none'; } return s; };
const defOf = (retract, bare) => { const s = specOf(retract, bare); const d = C.buildGen(C.genMigrateSpec ? C.genMigrateSpec(s) : s); d.params = Object.assign({}, d.params, { damage: true }); return d; };

// ---- 1. the spec -------------------------------------------------------------------------------------------------
console.log('1 THE SPEC');
{
  const cl = s => C.clampSpec(s) || s;
  const r = cl(specOf({})).gear.retract;
  check(!!r && r.time === 6 && r.act === 'hydraulic' && r.emerg === 'freefall', 'a tricycle keeps its retract, defaults 6 s / hydraulic / free fall', JSON.stringify(r));
  check(cl(specOf({ time: 99, act: 'electric' })).gear.retract.time === 20 && cl(specOf({ time: 99, act: 'electric' })).gear.retract.emerg === 'crank',
        'the cycle clamped to 20 s; an electric gear cranks down');
  const td = specOf({ time: 6 }); td.gear.type = 'taildragger';
  check(!('retract' in cl(td).gear), 'a taildragger drops it');
  const fl = specOf({ time: 6 }); fl.gear.type = 'floats';
  check(!('retract' in cl(fl).gear), 'floats drop it');
}
// (dB: the same aeroplane fixed and BARE - a retracting gear wears no fairings, so the bill compares like with like)
const dF = defOf(null), dB = defOf(null, true), dR = defOf({ time: 6, act: 'hydraulic' });
{
  const W = C.makeWorld(), sF = C.makeSim(dF, W);
  check(dF.params.retract === undefined && sF.gear() === null && !('gear' in sF.ctl), 'a fixed build: no params.retract, no sim gear, no ctl.gear');
}

// ---- 2. the bill ---------------------------------------------------------------------------------------------------
console.log('2 THE BILL');
{
  check(dR.spec.gear.fairing === 'none' && dR.spec.gear.twFairing === 'none' && dR.spec.gear.legFair === 'none',
        'a retracting gear wears no fairings (the fixture\'s spats dropped)', dR.spec.gear.fairing + '/' + dR.spec.gear.twFairing);
  const mF = dB.nodes.reduce((s, n) => s + n.m, 0), mR = dR.nodes.reduce((s, n) => s + n.m, 0);
  const LF = dB.parts.ledger.gear, LR = dR.parts.ledger.gear;
  check(mR - mF > 20 && mR - mF < 60, 'the kit weighs 20-60 kg on this 1-t aeroplane', (mR - mF).toFixed(1) + ' kg');
  // (the gear row carries the kit; the rest of the difference is the structure's gauge following the heavier gross)
  check(LR.mass - LF.mass > 0.85 * (mR - mF), 'and it is billed on the gear row', (LR.mass - LF.mass).toFixed(1) + ' of ' + (mR - mF).toFixed(1));
  check(Math.abs((LR.cost - LF.cost) - C.GEN_PRICES.retract) < 100, 'it costs GEN_PRICES.retract', (LR.cost - LF.cost).toFixed(0));
  check(dR.params.retract && dR.params.retract.cdA > 0.05 && dR.params.retract.cdA < 0.5, 'params.retract.cdA is the gear\'s drag area', dR.params.retract && dR.params.retract.cdA.toFixed(3));
}

// ---- the flights -----------------------------------------------------------------------------------------------------
// hold: null (the pilot's), 0 (the handle up all the way, after the lift-off), 1 (down all the way)
function fly(def, o) {
  o = o || {};
  const W = C.makeWorld(), sim = C.makeSim(def, W); sim.reset(0);
  for (let s = 0; s < 600; s++) sim.step(1 / 60);
  if (o.noEmerg) sim.gearEmergency = () => {};   // the gear-up landing: the pilot's emergency extension disarmed
  const ap = C.makePilot(sim, def, W, o.pilot || undefined);
  const R = { upAt: null, upT0: null, upT1: null, dw: [], flareLocked: null, minAglUp: Infinity, phases: [] };
  let air = false, last = '';
  for (let s = 0; s < (o.maxS || 600) * 60; s++) {
    const t = s / 60;
    ap.update(1 / 60);
    if (ap.phase === 'LIFTOFF' || ap.phase === 'CLIMB') air = true;
    if (o.hold != null && air) sim.ctl.gear = o.hold;
    if (o.onStep) o.onStep(sim, ap, t);
    sim.step(1 / 60);
    const g = sim.gear();
    if (g) {
      if (R.upT0 == null && g.pos < 0.999) { R.upT0 = t; R.upAt = ap.dbg.alt; }
      if (R.upT0 != null && R.upT1 == null && g.pos < 0.02) R.upT1 = t;
      if (ap.phase === 'FLARE' && R.flareLocked == null) R.flareLocked = g.locked;
    }
    if (ap.phase === 'DOWNWIND') R.dw.push(ap.dbg.V);
    if (ap.phase !== last) { R.phases.push(ap.phase); last = ap.phase; }
    if (sim.stats().bad) { R.nan = true; break; }
    if ((ap.phase === 'STOPPED' && t > 5) || (o.until && o.until(sim, ap, t))) break;
  }
  R.dw.sort((a, b) => a - b);
  R.dwV = R.dw.length ? R.dw[R.dw.length >> 1] : NaN;
  R.td = ap.tdInfo || null;
  const D = sim.damage ? sim.damage() : null;
  R.prop = !!(D && D.propStrike); R.crashed = !!(D && D.crashed);
  const SC = sim.damageScar ? sim.damageScar() : null;
  R.scar = SC ? SC.hits : -1;
  R.verdicts = ap.report.verdicts.map(v => v.code);
  R.phase = ap.phase; R.sim = sim; R.ap = ap;
  return R;
}

// ---- 3. the squat switch ---------------------------------------------------------------------------------------------
console.log('3 THE SQUAT SWITCH');
{
  const W = C.makeWorld(), sim = C.makeSim(dR, W); sim.reset(0);
  for (let s = 0; s < 600; s++) sim.step(1 / 60);
  sim.ctl.gear = 0;
  for (let s = 0; s < 180; s++) sim.step(1 / 60);
  const g = sim.gear();
  check(g.pos === 1 && g.wow, 'the handle up on the ground holds the gear down', 'pos ' + g.pos);
}

// ---- 4. the expert's circuit ---------------------------------------------------------------------------------------------
console.log('4 THE CIRCUIT');
const A = fly(dR);
console.log('    phases ' + A.phases.join(' > '));
check(!A.nan && A.phase === 'STOPPED', 'flown to a stop', A.phase);
check(A.upAt != null && A.upAt > 15, 'the gear went up over 15 m', A.upAt != null ? A.upAt.toFixed(1) + ' m' : 'never');
check(A.upT1 != null && Math.abs(A.upT1 - A.upT0 - 6) < 0.2, 'in the cycle\'s 6 s', A.upT1 != null ? (A.upT1 - A.upT0).toFixed(2) + ' s' : '-');
check(A.flareLocked === true, 'down and locked at the flare');
check(!!A.td && A.td.sink < 2.5 && !A.prop && !A.crashed, 'landed on its wheels', A.td ? 'sink ' + A.td.sink.toFixed(2) + ' prop ' + A.prop : 'no touchdown');

// ---- 5. the drag ---------------------------------------------------------------------------------------------------------
console.log('5 THE DRAG');
const B = fly(dR, { hold: 1, until: (s, ap) => ap.phase === 'BASE' });
const U = fly(dR, { hold: 0, noEmerg: true, until: (s, ap) => ap.phase === 'BASE' });
check(U.dwV > B.dwV + 0.5, 'the downwind is faster with the gear up', 'up ' + U.dwV.toFixed(2) + ' / down ' + B.dwV.toFixed(2) + ' m/s');

// ---- 6. the gear-up landing: the forgotten approach (a person with gearForget 0.05, drawn from seed 17) ------------------
console.log('6 THE GEAR-UP LANDING');
const PER = { quirks: { gearForget: 0.05 } };
const F = fly(dR, { pilot: { profile: PER, seed: 17 } });
console.log('    phases ' + F.phases.join(' > ') + '  verdicts ' + F.verdicts.join(','));
check(!F.nan, 'no NaN');
check(F.verdicts.includes('gear-forgotten'), 'the approach was forgotten (the die: seed 17 < 0.05)');
check(!F.td, 'no wheel touchdown');
check(F.prop, 'the propeller struck');
check(F.scar > 0, 'the belly scraped (the scar)', F.scar);
check(F.phase === 'STOPPED' && F.verdicts.includes('gear-up-landing'), 'the slide ends: STOPPED, \'gear-up-landing\'', F.phase);

// ---- 7. the power and the emergency ----------------------------------------------------------------------------------------
console.log('7 THE POWER AND THE EMERGENCY');
{
  let tCut = null, posCut = null, posHeld = null, tEm = null, tLock = null;
  fly(dR, { maxS: 200, onStep: (sim, ap, t) => {
    const g = sim.gear();
    if (tCut == null && ap.phase === 'DOWNWIND' && g.up) { tCut = t; sim.gearPower(false); posCut = g.pos; }
    if (tCut != null) { sim.ctl.gear = 1; }
    if (tCut != null && posHeld == null && t > tCut + 8) { posHeld = g.pos; sim.gearEmergency(); tEm = t; }
    if (tEm != null && tLock == null && g.locked) tLock = t;
  }, until: (s, ap, t) => tLock != null || t > 190 });
  check(posCut != null && posHeld != null && posHeld === posCut, 'no power: the handle down moves nothing in 8 s', 'pos ' + posHeld);
  check(tLock != null && Math.abs(tLock - tEm - 4) < 0.3, 'the free fall: down and locked in 4 s', tLock != null ? (tLock - tEm).toFixed(2) + ' s' : 'never');
}

// ---- 8. the forgetful person -----------------------------------------------------------------------------------------------
console.log('8 THE FORGETFUL PERSON');
{
  check(C.pilotGearDice(17, 0) < 0.05 && C.pilotGearDice(1935, 0) >= 0.05, 'the die: seed 17 forgets, 1935 does not');
  const N = fly(dR, { pilot: { profile: PER, seed: 1935 } });
  check(!N.verdicts.includes('gear-forgotten') && !!N.td && !N.prop, 'seed 1935: lowered, landed on its wheels');
  check(C.PILOT_PROFILES.expert.quirks === undefined || !C.PILOT_PROFILES.expert.quirks.gearForget, 'the expert never forgets');
}

// ---- 9. the horn ---------------------------------------------------------------------------------------------------------------
console.log('9 THE HORN');
{
  const AP = require(path.join(__dirname, '..', 'src', 'viewer', 'audio', 'audio_params.js'));
  const AM = require(path.join(__dirname, '..', 'src', 'viewer', 'audio', 'airframe_model.js'));
  const warnOf = (out, ctl) => { const blk = AP.audioParamsBlock(); const sim = { out, ctl, eng: [] }; AP.audioParams(sim, { mode: 'chase', p: new Float64Array(3) }, dR, blk, null, 1 / 60); return blk.s[AP.I.gearWarn]; };
  check(warnOf({ gear: 0, gearWow: 0, V: 40 }, { thr: 0.1, flap: 0 }) === 1, 'gear up, throttle back: the warning');
  check(warnOf({ gear: 0, gearWow: 0, V: 40 }, { thr: 0.8, flap: 0.5 }) === 1, 'gear up, the landing flap: the warning');
  check(warnOf({ gear: 0, gearWow: 0, V: 40 }, { thr: 0.8, flap: 0 }) === 0, 'gear up, cruise power: none');
  check(warnOf({ gear: 1, gearWow: 0, V: 40 }, { thr: 0.1, flap: 0.5 }) === 0, 'gear down: none');
  check(warnOf({ gear: 0.5, gearWow: 1, V: 0 }, { thr: 0, flap: 0 }) === 0, 'on the ground: none');
  check(warnOf({ V: 40 }, { thr: 0, flap: 1 }) === 0, 'a fixed build: none');
  // the stall voice sounds it: on, off, on (0.3 s on, 0.2 s off)
  const blk = AP.audioParamsBlock(), st = AM.airframeState(), seen = new Set();
  const sim = { out: { gear: 0, gearWow: 0, V: 40, alpha: 0 }, ctl: { thr: 0.1, flap: 0 }, eng: [] };
  for (let i = 0; i < 60; i++) { AP.audioParams(sim, { mode: 'chase', p: new Float64Array(3) }, dR, blk, null, 1 / 60); const tg = AM.airframeStep(blk, st, 1 / 60); seen.add(tg[AM.AF_PARAMS.indexOf('stall')] > 0.5 ? 'on' : 'off'); }
  check(seen.has('on') && seen.has('off'), 'the horn sounds intermittently on the stall voice', [...seen].join('/'));
}

// ---- 10. THE FOLD (G1): the chain, the presets, the fraction, the preview, the join's spec, the certificate ---------
console.log('10 THE FOLD (G1)');
{
  const SH = require('./_scene_headless.js'), BJ = require('./_bake_joined.js');
  const { D } = BJ.loadPanel();
  const arch = D.ARCHETYPES.find(x => x.key === 'ttail');
  const birth = LB.gameSpecFull({ v: 0, birth: 1, spec: D.designBake(arch.sel, arch.over) }).spec;
  let W0 = null;   // the headless page's window (its gear layer's CAGE_GEAR_FOLD)
  const sceneOf = over => { const S = SH.sceneBuild(birth, { over: Object.assign({ gearRetract: 1 }, over), garage: birth }); W0 = S.W; return S; };
  const FOLD = () => W0.CAGE_GEAR_FOLD;
  const at = (C, g) => { const M = FOLD().foldPose(C, g), h = C.hinge, v = [C.axle[0] - h[0], C.axle[1] - h[1], C.axle[2] - h[2]];
    return [h[0] + M[0] * v[0] + M[1] * v[1] + M[2] * v[2], h[1] + M[3] * v[0] + M[4] * v[1] + M[5] * v[2], h[2] + M[6] * v[0] + M[7] * v[1] + M[8] * v[2]]; };
  const wAxUp = C => { const M = FOLD().foldPose(C, 0), a = C.wAx; return [M[0] * a[0] + M[1] * a[1] + M[2] * a[2], M[3] * a[0] + M[4] * a[1] + M[5] * a[2], M[6] * a[0] + M[7] * a[1] + M[8] * a[2]]; };
  sceneOf({});                       // (the page's gear layer, once: its fold's keys)
  const K = FOLD().FOLD_KEYS;
  const swOf = over => sceneOf(over).W.CAGE_GEAR.swing;
  // inward: inboard and up, the starboard the port's mirror
  let S = swOf({ gearFold: K.indexOf('inward') });
  const dL = S.L.axle, uL = at(S.L, 0), uR = at(S.R, 0);
  check(Math.abs(uL[0]) < Math.abs(dL[0]) - 0.1 && uL[1] > dL[1] + 0.1, 'inward: the port wheel goes inboard and up', uL.map(x => x.toFixed(2)).join(','));
  check(Math.abs(uL[0] + uR[0]) < 1e-6 && Math.abs(uL[1] - uR[1]) < 1e-6 && Math.abs(uL[2] - uR[2]) < 1e-6, 'the starboard mirrors it');
  check(at(S.T, 0)[2] < S.T.axle[2] - 0.1, 'the nose goes aft');
  check(S.L.lift > 0.1 && S.T.lift > 0.1, 'the lift is measured', S.L.lift.toFixed(2) + ' / ' + S.T.lift.toFixed(2) + ' m');
  // outward
  S = swOf({ gearFold: K.indexOf('outward') });
  check(Math.abs(at(S.L, 0)[0]) > Math.abs(S.L.axle[0]) + 0.1, 'outward: the wheel goes outboard');
  // aft, the wheel turned flat
  S = swOf({ gearFold: K.indexOf('aftFlat') });
  check(at(S.L, 0)[2] < S.L.axle[2] - 0.1 && Math.abs(wAxUp(S.L)[1]) > 0.9, 'aft-flat: aft, the wheel\'s axis upright (it lies flat)', wAxUp(S.L).map(x => x.toFixed(2)).join(','));
  // two turns
  S = swOf({ gearFold: K.indexOf('skymaster') });
  check(S.L.turns.length === 2, 'two axes: two turns');
  // custom = the preset it copies
  // (GR R3: a preset's last turn is trimmed to centre the stowed wheel - a custom fold at the trimmed angle is the preset)
  const Si = swOf({ gearFold: K.indexOf('inward') }), angI = Math.abs(Si.L.turns[0].ang) * 180 / Math.PI;
  S = swOf({ gearFold: K.indexOf('custom'), gm1Ax: 0, gm1Ang: angI, gm2Ang: 0, gmTwist: 0 });
  check(S.L.turns.length === 1 && Math.hypot(...at(S.L, 0).map((x, i) => x - at(Si.L, 0)[i])) < 1e-9, 'custom (fore-aft, the trimmed angle) is the inward preset',
        'trim ' + Si.L.trim + ' deg');
  // the fraction: part way, less lift
  const Sf = swOf({ gearFold: K.indexOf('inward'), gearRetFrac: 0.6 });
  check(Sf.L.frac === 0.6 && Sf.L.lift < Si.L.lift - 0.05, 'the fraction 0.6 stops part way (less lift)', Sf.L.lift.toFixed(2) + ' < ' + Si.L.lift.toFixed(2));
  // the preview: the editor's gearPos poses the drawn units (and only then)
  const mOf = (over, nm) => { let m = null; sceneOf(over).scene.traverse(o => { if (o.name === nm) m = o.matrix.elements.slice(); }); return m; };
  const I = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  const m1 = mOf({ gearPos: 1 }, 'edWheelL'), m5 = mOf({ gearPos: 0.5 }, 'edWheelL');
  check(m1 && m1.every((x, i) => Math.abs(x - I[i]) < 1e-12) && m5 && m5.some((x, i) => Math.abs(x - I[i]) > 1e-3), 'the preview: down is untouched, 0.5 turns the unit');
  // the join's spec: the fraction and the measured lift; the preview never reaches it
  const s0 = D.designBake(arch.sel, arch.over);
  Object.assign(s0.cage, { gearRetract: 1, gearRetFrac: 0.6, gearPos: 0.3 });
  const js = LB.gameSpecFull({ v: s0.v, birth: 1, spec: s0 }).spec.gear.retract;
  check(js && js.frac === 0.6 && js.lift && js.lift.mains > 0 && js.lift.nose > 0, 'the join writes the fraction and the lift', JSON.stringify(js));
  // the certificate: the rows at "fixed" are absent, the preview always
  const off = C.genStolCageOff({ gearRetract: 0, gearRetT: 6, gearFold: 0, gearPos: 1, s1R: 0.2 });
  const on = C.genStolCageOff({ gearRetract: 1, gearRetT: 6, gearFold: 0, gearPos: 0.3, s1R: 0.2 });
  check(Object.keys(off).join() === 's1R' && Object.keys(on).join() === 'gearRetract,gearRetT,gearFold,s1R',
        'the certificate: a fixed gear\'s rows and the preview count as absent', Object.keys(off).join() + ' | ' + Object.keys(on).join());
  // ---- 11. DOES IT FIT (G2): the four tests, the red rows, the time ----------------------------------------------
  console.log('11 DOES IT FIT (G2)');
  const fitOf = over => { const Sx = sceneOf(over); return { f: Sx.W.CAGE_GEAR.fit, bad: Sx.W.CAGE_ROW_BAD() }; };
  let F = fitOf({});
  check(F.f && !F.f.ok && F.f.tests.units && F.f.tests.skin, 'the T-tail tourer as born: the mains meet and stow out of the body',
        F.f && F.f.why.slice(0, 2).join(' | '));
  check(F.bad && F.bad.s1X && F.bad.gearFold && F.bad.s1Drop, 'and the rows to turn go red (the half track, the fold, the leg)',
        F.bad && Object.keys(F.bad).slice(0, 8).join(','));
  check(F.f.ms < 300, 'the fit is quick enough for a slider', F.f.ms + ' ms');
  F = fitOf({ s1X: 1.6, gearRetFrac: 0.6 });
  check(F.f && F.f.ok && F.bad === null, 'a wider track at a partial fold fits: nothing red');
  F = fitOf({ gearFold: K.indexOf('inward'), s1Z: 1.8, s1X: 1.3 });
  check(F.f.tests.spar && /front spar/.test(F.f.tests.spar[0].why) && F.bad.s1Z, 'the mains forward: the folded wheel crosses the front spar (s1Z red)',
        F.f.tests.spar && F.f.tests.spar[0].why);
  F = fitOf({ gearFoldNose: FOLD().FOLD_NOSE_KEYS.indexOf('custom'), gn1Ax: 1, gn1Ang: 130 });
  check(F.f.tests.floor && F.bad.gn1Ang && F.bad.floorY, 'the nose turned too far: into the cabin floor (its turn and the floor red)',
        F.f.tests.floor && F.f.tests.floor[0].why);
  { const Sx = SH.sceneBuild(birth, { over: { gearRetract: 0 }, garage: birth });
    check(!Sx.W.CAGE_GEAR.fit && Sx.W.CAGE_ROW_BAD() === null, 'a fixed gear: no fit, nothing red'); }
  // ---- 12. THE RESERVATION (G3): the wells, the spec, the bays, the tanks -----------------------------------------
  console.log('12 THE RESERVATION (G3)');
  { const Sx = sceneOf({}), WL = Sx.W.CAGE_GEAR.wells, SW = Sx.W.CAGE_GEAR.swing;
    const inBox = (w, p) => [0, 1, 2].every(i => p[i] >= w.min[i] && p[i] <= w.max[i]);
    const centreUp = key => at(SW[key], 0);
    check(WL && WL.length === 3 && WL.every(w => inBox(w, centreUp(w.unit))), 'a well per unit, round its stowed wheel',
          WL && WL.map(w => w.unit + ' ' + (w.vol * 1000).toFixed(0) + ' L').join(', '));
    const near = WL.find(w => w.unit === 'L'), c = [0, 1, 2].map(i => (near.min[i] + near.max[i]) / 2);
    check(FOLD().wellHitsTank(near, { on: 'body', c, e: [0.1, 0.1, 0.1], rot: 0.3 })
          && !FOLD().wellHitsTank(near, { on: 'body', c: [c[0] + 2, c[1], c[2]], e: [0.1, 0.1, 0.1], rot: 0 })
          && FOLD().wellHitsTank(near, { on: 'wing', sides: [{ x0: near.min[0], x1: near.max[0], zF0: near.max[2], zF1: near.max[2], zR0: near.min[2], zR1: near.min[2], y: c[1], d: 0.1 }] }),
          'a tank at a well meets it (a body box turned, a wing side box); one 2 m away does not'); }
  const specRet = over => { const s = D.designBake(arch.sel, arch.over); Object.assign(s.cage, { gearRetract: 1 }, over);
    return LB.gameSpecFull({ v: s.v, birth: 1, spec: s }).spec; };
  const bayDrop = (spec, key) => { const d = C.buildGen(spec), n = JSON.parse(JSON.stringify(d.spec)); delete n.gear.wells;
    const b1 = C.genBayResolve(d.spec, key, d.parts.ST), b0 = C.genBayResolve(n, key, d.parts.ST); return [b0.litres, b1.litres]; };
  { const sp = specRet({});
    check(Array.isArray(sp.gear.wells) && sp.gear.wells.length === 3 && sp.gear.wells.some(w => w.bodyL > 0), 'the join writes the wells into the spec',
          sp.gear.wells && sp.gear.wells.map(w => w.unit + ' ' + w.bodyL + ' L body').join(', '));
    const [u0, u1] = bayDrop(sp, 'underFloor');
    check(u1 < u0 - 10, 'the mains\' wells take their litres from the under-floor bay', u0.toFixed(1) + ' -> ' + u1.toFixed(1) + ' L'); }
  { const [w0, w1] = bayDrop(specRet({ s1X: 1.6 }), 'wingRoot');
    check(w1 < w0 - 10, 'a wider track: the wells take theirs from the wing root', w0.toFixed(1) + ' -> ' + w1.toFixed(1) + ' L'); }
  { const fx = JSON.parse(JSON.stringify(specRet({}))); delete fx.gear.retract;
    check(!('wells' in (C.clampSpec(fx) || fx).gear), 'no retraction, no wells (clampSpec drops them)');
    const d0 = C.buildGen(specOf(null)), b = C.genBayResolve(d0.spec, 'underFloor', d0.parts.ST);
    check(b && b.wellL === undefined, 'a fixed build\'s bays are untouched'); }
  // ---- 13. THE WELLS CUT (G4): exact or box, the knife from below, the carve, the sheet never cut ----------------------
  console.log('13 THE WELLS CUT (G4)');
  { const KG = require('./_knife_gen.js');
    const cutOf = over => { const Sx = sceneOf(Object.assign({ gearPos: 1 }, over)); return { Sx, cuts: Sx.W.CAGE_GEAR.cuts || null }; };
    const inPoly = (o, u, v, tol) => o.every((a, i) => { const b = o[(i + 1) % o.length], l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
      return ((b[0] - a[0]) * (v - a[1]) - (b[1] - a[1]) * (u - a[0])) / l > -tol; });
    const ccw = o => { let a = 0; for (let i = 0; i < o.length; i++) { const p = o[i], q = o[(i + 1) % o.length]; a += p[0] * q[1] - q[0] * p[1]; } return a > 0; };
    const convex = o => o.every((a, i) => { const b = o[(i + 1) % o.length], c = o[(i + 2) % o.length];
      return (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]) > -1e-12; });
    // as born: the mains' wells meet under the belly (one cut) and the nose's forward
    const ex = cutOf({}), FSx = ex.Sx.FS, sheet = ex.Sx.built.sheet;
    check(ex.cuts && ex.cuts.length === 2 && ex.cuts.some(c => c.units.join() === 'R,L' || c.units.join() === 'L,R') && ex.cuts.some(c => c.units.join() === 'T')
          && ex.cuts.every(c => c.mode === 'exact' && ccw(c.outline) && convex(c.outline)),
          'as born: two cuts, the mains\' merged and the nose\'s, convex CCW outlines',
          ex.cuts && ex.cuts.map(c => c.units.join('+') + ' ' + c.outline.length + ' pts').join(', '));
    // the unit passes: every swept point inside the body, in plan, is inside its cut's outline (the knife's frame)
    { const SWx = ex.Sx.W.CAGE_GEAR.swing, AFx = ex.Sx.W.CAGE_GEAR.AF; let worst = 0, n = 0;
      for (const key of ['L', 'R', 'T']) { const C0 = SWx[key], cut = ex.cuts.find(c => c.units.includes(key));
        for (let g = 0; g <= 1.0001; g += 0.1) { const p = at(C0, g);
          if (p[2] < AFx.z0 || p[2] > AFx.z1) continue;
          const cy = AFx.cyAt(p[2]), sf = AFx.surf(p[2], Math.atan2(p[0], cy - p[1]));
          if (Math.hypot(sf[0], sf[1] - cy) - Math.hypot(p[0], p[1] - cy) <= 0) continue;
          n++; if (!cut || !inPoly(cut.outline, p[2] / FSx, -p[0] / FSx, 1e-9)) worst++; } }
      check(n > 0 && worst === 0, 'every axle position inside the body lies inside its well\'s outline', n + ' inside, ' + worst + ' out'); }
    // the knife: one closed loop per cut, a ceiling at the cut's height, the walls; the carve leaves the volume empty
    const m = KG.knifeWells(sheet, ex.cuts), st = m.knifeStats.slice(-(ex.cuts.length + 1));
    check(st.slice(0, -1).every(s => s.loops === 1 && s.open === 0 && s.cut > 0), 'the knife: one closed loop per well',
          st.slice(0, -1).map(s => s.loops + ' loop, ' + s.loopPts + ' pts, ' + s.open + ' open').join(' | '));
    const ww = m.F.filter(f => f.m === 'wheelWell');
    // GM: the ceiling is FITTED (the cut's height map) - never above the cut's top, deepest where the unit goes
    const top = Math.max(...ex.cuts.map(c => c.ceil));
    let yMax = -Infinity; for (const f of ww) for (const i of f.v) yMax = Math.max(yMax, m.V[i][1]);
    check(ww.length > 20 && ex.cuts.every(c => c.hf && c.hf.y.length === c.hf.nx * c.hf.nz) && yMax <= top + 1e-9 && yMax > top - 0.05 / ex.Sx.FS,
          'the well: walls and a fitted ceiling (its height map), up to the cut\'s top (section wheelWell)', ww.length + ' faces');
    const inVol = (X, skipWell) => { let k = 0; for (const f of X.F) { if (skipWell && f.m === 'wheelWell') continue;
      let cx = 0, cy = 0, cz = 0; for (const i of f.v) { cx += X.V[i][0]; cy += X.V[i][1]; cz += X.V[i][2]; } const q = f.v.length;
      if (ex.cuts.some(c => cy / q < KG.wellCeilFn(c)(cx / q, cz / q) - 1e-6 && inPoly(c.outline, cz / q, -cx / q, -1e-4))) k++; } return k; };
    const before = inVol(sheet, false), after = inVol(m, true);
    check(before > 50 && after <= 2, 'the well is empty: the skin under it cut, the frames and liners under its ceiling carved', before + ' faces before, ' + after + ' after');
    check(!sheet.F.some(f => f.m === 'wheelWell') && sheet.F.length < m.F.length && m.V.length > sheet.V.length && sheet.V.every((p, i) => p === m.V[i] || (p[0] === m.V[i][0] && p[1] === m.V[i][1] && p[2] === m.V[i][2])),
          'the measured sheet is never cut (the knife cut a copy; the sheet\'s vertices keep their places)');
    // the box: the rounded rectangle round the same points (it holds the exact hull)
    const bx = cutOf({ gearWellCut: 1 });
    check(bx.cuts && bx.cuts.length === 2 && bx.cuts.every(c => c.mode === 'box' && ccw(c.outline) && convex(c.outline))
          && ex.cuts.every(c => { const b = bx.cuts.find(x => x.units.join() === c.units.join()); return b && c.outline.every(p => inPoly(b.outline, p[0], p[1], 1e-6)); }),
          'box: a rounded rectangle per cut, the exact hull inside it');
    { const mb = KG.knifeWells(bx.Sx.built.sheet, bx.cuts), sb = mb.knifeStats.slice(-(bx.cuts.length + 1), -1);
      check(sb.every(s => s.loops === 1 && s.open === 0), 'box: the knife cuts it as cleanly'); }
    // a wider track: the mains stow in the wing (G5's), the nose alone is cut; a fraction 0.6: nothing enters the body
    const wd = cutOf({ s1X: 1.6 });
    check(wd.cuts && wd.cuts.length === 1 && wd.cuts[0].units.join() === 'T', 'a 3.2 m track: the nose\'s well alone (the mains go into the wing)');
    { const c6 = cutOf({ s1X: 1.6, gearRetFrac: 0.6 }).cuts || [];   // (GM: the nose's trunnion is in the body - its rest slot is cut)
      check(!c6.some(c => c.units.includes('L') || c.units.includes('R')), 'a fraction 0.6: the mains go nowhere into the body (the nose\'s slot alone)', c6.map(c => c.units.join('+')).join(', ')); }
    { const Sx = SH.sceneBuild(birth, { over: { gearRetract: 0 }, garage: birth });
      check(!Sx.W.CAGE_GEAR.cuts, 'a fixed gear: no cut'); }
    // the preview row never moves the cut (the wells are the whole fold's)
    const half = cutOf({ gearPos: 0.4 });
    check(JSON.stringify(half.cuts) === JSON.stringify(ex.cuts), 'the preview position does not move the cut'); }
  // ---- 14. THE MECHANISM (GM1): the trunnion inside the structure, the oleo, the fittings out of the wells ----------
  console.log('14 THE MECHANISM (GM1)');
  { const Sx = sceneOf({ gearPos: 1 }), G = Sx.W.CAGE_GEAR, SWx = G.swing, AFx = G.AF, W = Sx.W.CAGE_WING;
    const nose = SWx.T.hinge, cy = AFx.cyAt(nose[2]), sf = AFx.surf(nose[2], Math.atan2(nose[0], cy - nose[1]));
    const inBody = Math.hypot(sf[0], sf[1] - cy) - Math.hypot(nose[0], nose[1] - cy);
    check(inBody > 0.04, 'the nose leg turns on a trunnion inside the body', Math.round(inBody * 1000) + ' mm inside the skin');
    const mh = SWx.L.hinge, u = W.underAt(mh[0], mh[2]), o = W.overAt(mh[0], mh[2]);
    check(u && o && mh[1] > u.y + 0.02 && mh[1] < o.y - 0.02, 'the mains turn on trunnions inside the wing, between its skins',
          u && o ? 'pin ' + mh[1].toFixed(3) + ' between ' + u.y.toFixed(3) + ' and ' + o.y.toFixed(3) : 'no wing there');
    let nOleo = 0; Sx.scene.traverse(q => { if (/^edLeg[LRT]$/.test(q.name || '')) nOleo++; });
    check(nOleo === 3 && specRet({}).gear.suspension === 'oleo', 'a retracting gear is three oleo legs, and flies as an oleo',
          'suspension ' + specRet({}).gear.suspension);
    const AC = Sx.W.CAGE_ACCESS, cuts = G.cuts, inW = q => cuts.some(c => q.p[1] / Sx.FS < c.ceil && c.outline.every((a, i) => {
      const b = c.outline[(i + 1) % c.outline.length]; return (b[0] - a[0]) * (-q.p[0] / Sx.FS - a[1]) - (b[1] - a[1]) * (q.p[2] / Sx.FS - a[0]) > 0; }));
    const belly = (AC && AC.placed || []).filter(q => q.on === 'body' || !q.on);
    check(belly.length > 3 && !belly.some(inW), 'no fitting is bolted into a well (the aerial and the drain moved clear)',
          belly.filter(q => /xpdr|Drain/.test(q.key)).map(q => q.key + ' z ' + q.p[2].toFixed(2)).join(', '));
    const bornFit = Sx.W.CAGE_GEAR.fit;                 // (read before the next build: the headless page's window is shared)
    const thin = sceneOf({ wgThick: 9 }).W.CAGE_GEAR.fit;
    check(bornFit && !bornFit.tests.mount && thin && thin.tests.mount && thin.rows.s1Z,
          'the mount: a wing too thin for the trunnion turns the mains\' station red, as born it has room',
          thin && thin.tests.mount ? thin.tests.mount[0].why : 'no mount test'); }
  // ---- 15. THE ACTUATION AND THE ONE KINEMATICS (GM2/GM3) -------------------------------------------------------------
  console.log('15 THE ACTUATION (GM2/GM3)');
  { const Sx = sceneOf({ s1X: 1.6, gearPos: 1 }), G = Sx.W.CAGE_GEAR, R = G.mech, CM = C.GEAR_MECH;
    check(R && ['L', 'R', 'T'].every(k => ['_brace1', '_brace2', '_cyl', '_rod'].every(n => R.parts.some(p => p.name === 'edMech' + k + n))),
          'each unit has its brace (two links) and its actuator (body and rod)', R && R.parts.length + ' parts');
    let worst = 0, inv = 0;
    for (let i = 0; i <= 40; i++) { const g = 1 - i / 40, Q = CM.gearMechPoints(R, g);
      for (const k in R.knees) { const K = R.knees[k], a = Q.pt(K.s), b = Q.pt(K.l), n = Q.knees[k];
        worst = Math.max(worst, Math.abs(Math.hypot(n[0] - a[0], n[1] - a[1], n[2] - a[2]) - K.a), Math.abs(Math.hypot(n[0] - b[0], n[1] - b[1], n[2] - b[2]) - K.b)); } }
    check(worst < 1e-9, 'the brace links keep their lengths over the whole fold', worst.toExponential(1));
    const I = G.mechInfo;
    check(['L', 'R', 'T'].every(k => I[k] && I[k].ok && I[k].Lb >= I[k].Lmax - I[k].Lmin + 0.03 - 1e-9),
          'every actuator holds its stroke (extended <= 2 x closed - 60 mm; the barrel holds the rod)',
          ['L', 'T'].map(k => k + ' ' + I[k].Lmin.toFixed(3) + '-' + I[k].Lmax.toFixed(3) + ' m').join(', '));
    const T1 = CM.gearMechPose(R, 1);
    check(Object.values(T1).every(t => Math.abs(t[0] - 1) + Math.abs(t[5] - 1) + Math.abs(t[10] - 1) + Math.abs(t[3]) + Math.abs(t[7]) + Math.abs(t[11]) < 1e-9),
          'down, every part stands where it was drawn (the pose is the identity)');
    // the rest slot: where each body leg leaves the skin gear down lies inside its well's outline
    const AFx = G.AF, din = p => { const cy = AFx.cyAt(p[2]), sf = AFx.surf(p[2], Math.atan2(p[0], cy - p[1])); return Math.hypot(sf[0], sf[1] - cy) - Math.hypot(p[0], p[1] - cy); };
    const T = G.swing.T, cutT = G.cuts.find(c => c.units.includes('T'));
    let cross = null; for (let f = 0; f <= 1; f += 0.01) { const p = [T.hinge[0] + (T.axle[0] - T.hinge[0]) * f, T.hinge[1] + (T.axle[1] - T.hinge[1]) * f, T.hinge[2] + (T.axle[2] - T.hinge[2]) * f]; if (din(p) < 0) { cross = p; break; } }
    const inO = (o, u, v) => o.every((a, i) => { const b = o[(i + 1) % o.length]; return (b[0] - a[0]) * (v - a[1]) - (b[1] - a[1]) * (u - a[0]) > 0; });
    check(cross && cutT && inO(cutT.outline, cross[2] / Sx.FS, -cross[0] / Sx.FS), 'the rest slot: the nose leg leaves the skin, gear down, inside its well (the trunnion slots in)',
          cross ? 'at z ' + cross[2].toFixed(3) : 'no crossing');
    // the flight's record: the snapshot carries the very record, and the capture's map
    const s0 = D.designBake(arch.sel, arch.over); Object.assign(s0.cage, { gearRetract: 1, s1X: 1.6 });
    check(typeof C.gearMechPose === 'function' && typeof C.gearFoldPose === 'function', 'the one kinematics is the core\'s (gearMechPose, gearFoldPose)'); }
  // ---- 16. THE WING'S WELLS (G5): the wing's skin cut from below, its rest slot, closed under its upper skin ---------
  console.log('16 THE WING\'S WELLS (G5)');
  { const KG = require('./_knife_gen.js'), THREE = SH.context().THREE;
    const wide = sceneOf({ s1X: 1.6, gearPos: 1 }), G = wide.W.CAGE_GEAR, W = wide.W.CAGE_WING;
    check(G.cutsM && G.cutsM.some(c => c.units.includes('L')) && G.cutsM.some(c => c.units.includes('R')),
          'a 3.2 m track: the wing has the mains\' wells (the body the nose\'s alone)', G.cutsM && G.cutsM.map(c => c.units.join('+')).join(', '));
    const skins = []; wide.scene.traverse(o => { if (o.isMesh && o.userData && o.userData.wingSkin) skins.push(o); });
    let wells = 0, loops = 0, open = 0, area = 0;
    for (const o of skins) { const r = KG.knifeWellsGeo(THREE, o.geometry, G.cutsM);
      if (r.well) { wells++; const p = r.well.attributes.position, ix = r.well.index.array;
        for (let t = 0; t < ix.length; t += 3) { const a = [p.getX(ix[t]), p.getY(ix[t]), p.getZ(ix[t])], b = [p.getX(ix[t + 1]), p.getY(ix[t + 1]), p.getZ(ix[t + 1])], c = [p.getX(ix[t + 2]), p.getY(ix[t + 2]), p.getZ(ix[t + 2])];
          const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
          area += 0.5 * Math.hypot(u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]); } }
      for (const st of r.stats) if (st.loops != null) { loops += st.loops; open += st.open; } }
    check(wells >= 1 && loops >= 2 && open === 0 && area > 0.05, 'the wing\'s skin is cut from below: closed loops, walls and a ceiling (wheelWell)',
          wells + ' skin mesh(es), ' + loops + ' loops, ' + area.toFixed(2) + ' m2 of well');
    // the rest slot: where the mains' leg leaves the wing's lower skin, gear down, is inside its well's outline
    const L = G.swing.L, cut = G.cutsM.find(c => c.units.includes('L'));
    let cross = null; for (let f = 0; f <= 1; f += 0.01) { const p = [L.hinge[0] + (L.axle[0] - L.hinge[0]) * f, L.hinge[1] + (L.axle[1] - L.hinge[1]) * f, L.hinge[2] + (L.axle[2] - L.hinge[2]) * f];
      const u = W.underAt(p[0], p[2]); if (u && p[1] < u.y) { cross = p; break; } }
    const inO = (o, u, v) => o.every((a, i) => { const b = o[(i + 1) % o.length]; return (b[0] - a[0]) * (v - a[1]) - (b[1] - a[1]) * (u - a[0]) > 0; });
    check(cross && cut && inO(cut.outline, cross[2], -cross[0]), 'the rest slot: the main leg leaves the wing\'s skin, gear down, inside its well', cross ? 'at x ' + cross[0].toFixed(3) : 'no crossing');
    // closed: outside the body every cell of a wing well's ceiling is under the upper skin
    let over = 0; for (const c of G.cutsM) { const H = c.hf; for (let j = 0; j < H.nz; j++) for (let i = 0; i < H.nx; i++) {
      const x = H.x0 + i * H.d, z = H.z0 + j * H.d; if (Math.abs(x) <= G.AF.halfWAt(z) + 0.03) continue;
      const o = W.overAt(x, z); if (o && H.y[j * H.nx + i] > o.y - 0.0079) over++; } }
    check(over === 0, 'a wing well stays closed under the upper skin (a unit thicker than the wing pokes through: the fit says so)', over + ' cells over');
    // as born: the wing's centre section crosses the mains' belly well - carved out of it
    const born = sceneOf({ gearPos: 1 }), GB2 = born.W.CAGE_GEAR, sk2 = []; born.scene.traverse(o => { if (o.isMesh && o.userData && o.userData.wingSkin === 'centre') sk2.push(o); });
    const mc = GB2.cutsM.find(c => c.units.includes('L') && c.units.includes('R'));
    let inside0 = 0, inside1 = 0; const ceilF = mc ? KG.wellCeilFn(mc) : null;
    const count = g => { let k = 0; const p = g.attributes.position, ix = g.index.array; for (let t = 0; t < ix.length; t += 3) { let cx = 0, cy = 0, cz = 0; for (let q = 0; q < 3; q++) { cx += p.getX(ix[t + q]) / 3; cy += p.getY(ix[t + q]) / 3; cz += p.getZ(ix[t + q]) / 3; }
      if (inO(mc.outline, cz, -cx) && cy < ceilF(cx, cz) - 1e-6) k++; } return k; };
    for (const o of sk2) { inside0 += count(o.geometry); const r = KG.knifeWellsGeo(THREE, o.geometry, GB2.cutsM); if (r.skin) inside1 += count(r.skin); }
    check(mc && sk2.length && inside0 > 0 && inside1 <= 2, 'as born, the centre section is carved out of the mains\' well (the bars through the wheels)', inside0 + ' faces in the well before, ' + inside1 + ' after'); }
  // ---- 17. THE DOORS (G6): the leg doors, the well doors, flush up, open in transit ---------------------------------
  console.log('17 THE DOORS (G6)');
  { const docs = over => { const Sx = sceneOf(Object.assign({ gearPos: 1 }, over)); return { Sx, G: Sx.W.CAGE_GEAR }; };
    const ex = docs({ s1X: 1.6 }), D6 = ex.G.doors || [];
    check(['L', 'R', 'T'].every(k => D6.some(d => d.kind === 'leg' && d.unit === k)) && D6.some(d => d.kind === 'well'),
          'exact: a leg door on each unit (the skin it covers stowed) and well doors for the rest', D6.map(d => d.name.replace('edMechDoor', '')).join(' '));
    // the doors' panels posed by the core: up (g = 0) every one lies on the skin it was cut from
    const R = ex.G.mech, AFx = ex.G.AF, W = ex.Sx.W.CAGE_WING;
    // the skin's own triangles (the sheet's skin sections, metres, and the wing's skin meshes), and a point's height
    // off the one under it in plan
    const tris = [], FSx = ex.Sx.FS, SK = new Set(['body', 'taper', 'taperPanel', 'waistband', 'floorLoop', 'ceilingLoop', 'pillarPassenger', 'pillarCabin', 'pillarWindow', 'pillarFront', 'pillarTail']);
    const sh = ex.Sx.built.sheet;
    for (const f of sh.F) if (SK.has(f.m)) for (let i = 1; i + 1 < f.v.length; i++) tris.push([f.v[0], f.v[i], f.v[i + 1]].map(k => sh.V[k].map(c => c * FSx)));
    ex.Sx.scene.traverse(o => { if (o.isMesh && o.userData && o.userData.wingSkin) { const g = o.geometry, pa = g.attributes.position, ix = g.index.array;
      for (let t = 0; t < ix.length; t += 3) tris.push([0, 1, 2].map(q => [pa.getX(ix[t + q]), pa.getY(ix[t + q]), pa.getZ(ix[t + q])])); } });
    const onSkin = p => { let best = 1;
      for (const T of tris) {
        const [A, B, Cc] = T, d = (B[2] - Cc[2]) * (A[0] - Cc[0]) + (Cc[0] - B[0]) * (A[2] - Cc[2]);
        if (Math.abs(d) < 1e-12) continue;
        const l1 = ((B[2] - Cc[2]) * (p[0] - Cc[0]) + (Cc[0] - B[0]) * (p[2] - Cc[2])) / d, l2 = ((Cc[2] - A[2]) * (p[0] - Cc[0]) + (A[0] - Cc[0]) * (p[2] - Cc[2])) / d, l3 = 1 - l1 - l2;
        if (l1 < -1e-6 || l2 < -1e-6 || l3 < -1e-6) continue;
        best = Math.min(best, Math.abs(p[1] - (l1 * A[1] + l2 * B[1] + l3 * Cc[1])));
      }
      return best; };
    // (P2: a door is a slab - its outer face (the first doorOuterN vertices of its front mesh) lies on the skin, its back
    // face DOOR_T in; behind the wing's blunt trailing edge 'in' is between the skins, so the outer face is what is measured)
    const vertsOf = name => { const out = []; ex.Sx.scene.traverse(o => { if (o.name === name) o.traverse(q => { if (q.isMesh && q.userData.doorOuterN) { const pa = q.geometry.attributes.position; for (let i = 0; i < q.userData.doorOuterN; i++) out.push([pa.getX(i), pa.getY(i), pa.getZ(i)]); } }); }); return out; };
    const posed = (name, g) => { const t = C.gearMechPose(R, g)[name]; return vertsOf(name).map(v => [t[0] * v[0] + t[1] * v[1] + t[2] * v[2] + t[3], t[4] * v[0] + t[5] * v[1] + t[6] * v[2] + t[7], t[8] * v[0] + t[9] * v[1] + t[10] * v[2] + t[11]]); };
    let worst = 0;
    const atTE = p => { const te = W.teAt(Math.abs(p[0])); return te && p[2] < te.z + 0.015; };   // (the trailing edge's lip: no area in plan)
    for (const d of D6) for (const p of posed(d.name, 0)) if (!atTE(p)) worst = Math.max(worst, onSkin(p));
    check(worst < 0.004, 'up, every door lies flush on the skin it was cut from (its outer face)', Math.round(worst * 1000) + ' mm at the most');
    { let slab = 0; ex.Sx.scene.traverse(o => { if (D6.some(d => d.name === o.name)) { const m = o.children.filter(q => q.isMesh), f = m.find(q => q.userData.doorOuterN);
        if (f && m.length >= 2 && f.geometry.attributes.position.count > f.userData.doorOuterN && f.geometry.attributes.color) slab++; } });
      check(slab === D6.length, 'P2: every door is a slab - its outer face, a chamfered edge and side wall (seam-shaded), a back face', slab + ' of ' + D6.length); }
    const wd = D6.find(d => d.kind === 'well'), cy = (ps) => ps.reduce((s, p) => s + p[1], 0) / ps.length;
    check(wd && cy(posed(wd.name, 0.5)) < cy(posed(wd.name, 0)) - 0.02, 'a well door swings open (down) as the gear travels', wd && (cy(posed(wd.name, 0)) - cy(posed(wd.name, 0.5))).toFixed(3) + ' m lower');
    const b2 = docs({ gearWellCut: 1, gearDoors: 2 }).G.doors || [], b1 = docs({ gearWellCut: 1, gearDoors: 1 }).G.doors || [];
    check(!b2.some(d => d.kind === 'leg') && b2.filter(d => d.kind === 'well').length >= 4 && b1.filter(d => d.kind === 'well').length >= 2 && b1.length < b2.length,
          'box: simple doors - two split along the well, or one; no leg door', b2.length + ' with two, ' + b1.length + ' with one');
    const none = docs({ gearDoors: 0, gearLegDoor: 0 }).G.doors || [];
    check(none.length === 0, 'doors off: an open well');
    check(D6.every(d => R.parts.some(p => p.name === d.name && p.o0)), 'every door is a part of the one kinematics (the flight poses it)'); }
  // ---- 18. THE CATALINA (P2 v3): the PBY-5A's mains as its operator's handbook draws them (Canso handbook, Figs 12-13)
  console.log('18 THE CATALINA (P2 v3)');
  { const ac = D.ARCHETYPES.find(x => x.key === 'c172');
    const bc = LB.gameSpecFull({ v: 0, birth: 1, spec: D.designBake(ac.sel, ac.over) }).spec;
    const Sc = SH.sceneBuild(bc, { over: { gearRetract: 1, gearFold: 6, gearDoors: 0, gearLegDoor: 0, s1X: 0.6, floorY: -0.25 }, garage: bc });
    const Gc = Sc.W.CAGE_GEAR, CMc = C.GEAR_MECH, Rc = Gc.mech, Cu = Rc.units.L, Ic = Gc.mechInfo.L, AFc = Gc.AF;
    const pose = g => { const Q = CMc.gearMechPoints(Rc, g), M = Q.M.L, d = Q.D.L; return { Q, M, P: p => CMc.gearUnitPt(Cu, M, p, d) }; };
    const top = Cu.top, ax = Cu.axle, legLen = Math.hypot(top[0] - ax[0], top[1] - ax[1]);
    let inPlane = 0, tiltMax = 0, wheelTilt = 0, stretch = 0;
    for (let i = 0; i <= 20; i++) { const g = 1 - i / 20, { Q, M, P } = pose(g), t = P(top), a = P(ax);
      inPlane = Math.max(inPlane, Math.abs(t[2] - top[2]), Math.abs(a[2] - ax[2]));
      tiltMax = Math.max(tiltMax, Math.acos(Math.max(-1, Math.min(1, (t[1] - a[1]) / Math.hypot(t[0] - a[0], t[1] - a[1], t[2] - a[2])))) * 180 / Math.PI);
      const w = CMc.gearApp(M, Cu.wAx); wheelTilt = Math.max(wheelTilt, Math.asin(Math.min(1, Math.abs(w[2]))) * 180 / Math.PI);
      const lp = P(Ic.Lp); stretch = Math.max(stretch, Math.hypot(lp[0] - Ic.S[0], lp[1] - Ic.S[1], lp[2] - Ic.S[2]) - Ic.D); }
    check(inPlane < 1e-6, 'the motion is in the hull\'s section (about fore-aft axes: no aft swing, no tuck)', (inPlane * 1000).toFixed(3) + ' mm off the plane');
    check(tiltMax < 25 && wheelTilt < 1e-6, 'the leg stays near upright, the wheel upright in its fore-aft plane', 'leg ' + tiltMax.toFixed(1) + ' deg at the most');
    check(stretch <= 0.003 && Gc.mechInfo.catStrut, 'the side strut is longest gear down (locked straight) and folds - never stretched', (stretch * 1000).toFixed(1) + ' mm');
    const cu = pose(0).P(ax);
    const p1 = pose(0.5).P(ax), r0 = ax;
    check(cu[1] > ax[1] + 0.5 * legLen && Math.abs(cu[0]) < Math.abs(ax[0]) - 0.05, 'up and in: the wheel rises and comes in against the side',
          'up ' + (cu[1] - ax[1]).toFixed(2) + ' m, in ' + (Math.abs(ax[0]) - Math.abs(cu[0])).toFixed(2) + ' m');
    check(p1[1] - r0[1] > (cu[1] - r0[1]) * 0.5, 'it rises first (the jack lifts it, it comes in last - "a tendency to fall into the well")',
          'half way: ' + Math.round(100 * (p1[1] - r0[1]) / (cu[1] - r0[1])) + ' % of the rise, ' + Math.round(100 * (Math.abs(r0[0]) - Math.abs(p1[0])) / (Math.abs(r0[0]) - Math.abs(cu[0]))) + ' % of the way in');
    check(Rc.parts.some(q => q.name === 'edMechL_cyl') && Rc.parts.some(q => q.name === 'edMechL_rod') && Rc.parts.some(q => q.name === 'edMechL_brace1'),
          'the V-strut\'s jack and the side strut are parts of the one kinematics');
    check((Gc.cutsSide || []).length === 2, 'a recess in each side (the wheel and its leg)', (Gc.cutsSide || []).length + ' side wells'); }
  // the physics of a partial gear: the downwind between the fixed gear's and the full retract's
  const dS = defOf({ time: 6, act: 'hydraulic', frac: 0.6 });
  check(dS.params.retract.frac === 0.6, 'params carry the fraction');
  const Us = fly(dS, { hold: 0, noEmerg: true, until: (s, ap) => ap.phase === 'BASE' });
  check(Us.dwV > B.dwV + 0.1 && Us.dwV < U.dwV - 0.1, 'a partial gear up: the downwind between down and fully up',
        B.dwV.toFixed(2) + ' < ' + Us.dwV.toFixed(2) + ' < ' + U.dwV.toFixed(2));
}

console.log(bad ? 'GATE RETRACT: FAIL (' + bad + ')' : 'GATE RETRACT: PASS');
process.exitCode = bad ? 1 : 0;
