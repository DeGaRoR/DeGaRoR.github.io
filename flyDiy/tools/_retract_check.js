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
  S = swOf({ gearFold: K.indexOf('custom'), gm1Ax: 0, gm1Ang: 90, gm2Ang: 0, gmTwist: 0 });
  const Si = swOf({ gearFold: K.indexOf('inward') });
  check(S.L.turns.length === 1 && Math.hypot(...at(S.L, 0).map((x, i) => x - at(Si.L, 0)[i])) < 1e-9, 'custom (fore-aft, 90) is the inward preset');
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
  // the physics of a partial gear: the downwind between the fixed gear's and the full retract's
  const dS = defOf({ time: 6, act: 'hydraulic', frac: 0.6 });
  check(dS.params.retract.frac === 0.6, 'params carry the fraction');
  const Us = fly(dS, { hold: 0, noEmerg: true, until: (s, ap) => ap.phase === 'BASE' });
  check(Us.dwV > B.dwV + 0.1 && Us.dwV < U.dwV - 0.1, 'a partial gear up: the downwind between down and fully up',
        B.dwV.toFixed(2) + ' < ' + Us.dwV.toFixed(2) + ' < ' + U.dwV.toFixed(2));
}

console.log(bad ? 'GATE RETRACT: FAIL (' + bad + ')' : 'GATE RETRACT: PASS');
process.exitCode = bad ? 1 : 0;
