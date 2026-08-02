// PA-18 circuit gate: the flapped Super Cub flies the full circuit with the
// AP deploying flaps on approach and retracting them for the rollout.
// Thresholds anchored from the calibration run (2026-08): td sink 0.78 at
// x=-533, three-point 15.3 deg, rolloutPitchMin 4.8 with the tail pinned
// from touchdown (VTailDown 99 — the tail-up wheel-landing hold nosed it
// over under flap lift + dCm0 in the crosswind gate), maxFlap 1.00.
const { buildPA18, makeWorld } = require('./flight_core.js');
const { runCircuit } = require('./circuit_harness.js');

const world = makeWorld();

runCircuit({
  id: 'PA18', build: buildPA18, world,
  perturb: { z: 1.2, v: 0.001 }, settleS: 15, maxS: 300,
  tip: { tag: 'WF', midZ: 3.4, tipZ: 5.0, tol: 0.1 },
  flapDuring: () => true,
  // extras: phase coverage + flap deployment tracking (the point of the fiche)
  onStep: c => {
    const M = c.custom, ph = c.ap.phase;
    (M.seen ??= {})[ph] = true;
    M.maxFlap = Math.max(M.maxFlap ?? 0, c.sim.ctl.flap);
    if (ph === 'CLIMB' || ph === 'CRUISE') { M.drRMS = (M.drRMS ?? 0) + c.sim.ctl.dr ** 2; M.drN = (M.drN ?? 0) + 1; }
  },
  lines: c => {
    const M = c.custom, td = c.td, cg = c.cg;
    const [xAf] = c.sim.axes();
    M.finalPitch = Math.asin(Math.max(-1, Math.min(1, -xAf[1]))) * 57.3;
    M.rudRMS = Math.sqrt((M.drRMS ?? 0) / Math.max(1, M.drN ?? 0)) * 57.3;
    M.endFlap = c.sim.ctl.flap;
    const L = [];
    if (td) L.push(`TOUCHDOWN: sink=${td.sink.toFixed(2)} m/s  x=${td.x.toFixed(0)}  z=${td.z.toFixed(1)}  V=${td.V.toFixed(1)} m/s`);
    L.push(`STOP: x=${cg[0].toFixed(0)}  z=${cg[2].toFixed(1)}  final pitch ${M.finalPitch.toFixed(1)} deg  strain ch=${(c.smaxCh*100).toFixed(1)}% gr=${(c.smaxGr*100).toFixed(1)}%`);
    L.push(`FLAPS: max ${(M.maxFlap ?? 0).toFixed(2)} on approach, ${M.endFlap.toFixed(2)} at stop | wing flex ${c.flapMin.toFixed(1)}..${c.flapMax.toFixed(1)} deg | rudder RMS ${M.rudRMS.toFixed(2)} deg`);
    return L;
  },
  checks: c => {
    const M = c.custom, td = c.td, cg = c.cg;
    return {
      'touchdown': !!td,
      'reached STOPPED': !!(M.seen && M.seen.STOPPED),
      'flaps deployed on approach': (M.maxFlap ?? 0) > 0.95,
      'flaps retracted at stop': M.endFlap < 0.1,
      'sink<1.5': td && td.sink < 1.5,
      '|tdZ|<4': td && Math.abs(td.z) < 4,
      'tdX in (-660,-240)': td && td.x > -660 && td.x < -240,
      'stopX<20': cg[0] < 20,
      '|stopZ|<8': Math.abs(cg[2]) < 8,
      'chassis<8%': c.smaxCh < 0.08,
      'gear<35%': c.smaxGr < 0.35,
      'flapMin>-5': c.flapMin > -5,
      'flapMax<12': c.flapMax < 12,
      'rudderRMS<4': M.rudRMS < 4,
      'finalPitch in (5,18)': M.finalPitch > 5 && M.finalPitch < 18,
      'cgAlt>1.25': cg[1] > 1.25,
      'rolloutPitchMin>1': c.rollPitchMin > 1,
    };
  },
});
