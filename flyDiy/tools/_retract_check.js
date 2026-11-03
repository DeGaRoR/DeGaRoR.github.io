#!/usr/bin/env node
// GATE RETRACT (RETRACT-1, 2026-11-03; futureDesigns/RETRACT-STUDY-2026-11.md §3.1) - THE RETRACTABLE GEAR, step 1.
// The metal Cessna fixture (a tricycle) flown with spec.gear.retract and without it:
//   1. THE SPEC: clampSpec keeps a tricycle's retract with its defaults (6 s, hydraulic, free fall), clamps the cycle
//      (2-20 s), and drops it on a taildragger and on floats; a fixed build's def carries no params.retract, its sim
//      no gear (sim.gear() null) and its ctl no gear key - nothing of the gear exists where it was not chosen
//   2. THE BILL: the retract build is heavier by the kit (GEN_RULES.retractKg of the gross, on the gear's ledger row)
//      and dearer by GEN_PRICES.retract; params.retract.cdA is the gear's own drag (gen.drag.gear)
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
//   9. THE HORN (audio_params + airframe_model, node): the gear warning is 1 with the gear up and the throttle back,
//      0 with the gear down, 0 on the ground, 0 with no gear (a fixed build); the stall voice sounds it intermittently
// Run: node tools/_retract_check.js   (one final `GATE RETRACT: PASS|FAIL`)
'use strict';
const fs = require('fs'), path = require('path');
const C = require('./flight_core.js'), LB = require('./_load_build.js');
let bad = 0;
const check = (ok, label, note) => { console.log((ok ? '  ok   ' : '  FAIL ') + label + (note != null ? '  (' + note + ')' : '')); if (!ok) bad++; return ok; };
const raw = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'build_v10_cessnaMetal_2026-09-26.json'), 'utf8'));
const specOf = retract => { const s = LB.gameSpec(JSON.parse(JSON.stringify(raw))); if (retract) s.gear.retract = retract; return s; };
const defOf = retract => { const s = specOf(retract); const d = C.buildGen(C.genMigrateSpec ? C.genMigrateSpec(s) : s); d.params = Object.assign({}, d.params, { damage: true }); return d; };

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
const dF = defOf(null), dR = defOf({ time: 6, act: 'hydraulic' });
{
  const W = C.makeWorld(), sF = C.makeSim(dF, W);
  check(dF.params.retract === undefined && sF.gear() === null && !('gear' in sF.ctl), 'a fixed build: no params.retract, no sim gear, no ctl.gear');
}

// ---- 2. the bill ---------------------------------------------------------------------------------------------------
console.log('2 THE BILL');
{
  const mF = dF.nodes.reduce((s, n) => s + n.m, 0), mR = dR.nodes.reduce((s, n) => s + n.m, 0);
  const LF = dF.parts.ledger.gear, LR = dR.parts.ledger.gear;
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

console.log(bad ? 'GATE RETRACT: FAIL (' + bad + ')' : 'GATE RETRACT: PASS');
process.exitCode = bad ? 1 : 0;
