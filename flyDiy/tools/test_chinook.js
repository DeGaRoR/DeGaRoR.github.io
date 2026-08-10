const { buildChinook } = require('./flight_core.js');
const { runCircuit } = require('./circuit_harness.js');

runCircuit({
  id: 'CHINOOK', build: buildChinook,
  // maxS 300 -> 330 with the 2026-08-10 wing bracing. The braced wing flies the
  // circuit about 5 s slower and touchdown moved 295.5 -> 300.2 s, i.e. 0.2 s
  // PAST the old budget: the aeroplane landed properly (sink 0.59 m/s, three
  // point, x=-517, all inside their thresholds) and the gate reported
  // "touchdown" FAILED because it had already stopped watching. A budget is not
  // a verdict — the same lesson the runner's 900 s spawn timeout carries.
  perturb: { z: 1.0, v: 0.001 }, settleS: 10, maxS: 330,
  tip: { tag: 'WF', midZ: 2.00, tipZ: 5.34, tol: 0.2 },
  wingNote: 'Chinook',
  // STOL distance marks: first x seen in LIFTOFF / ROLLOUT / STOPPED
  onStep: c => {
    const M = c.custom, ph = c.ap.phase, x = () => c.sim.cgPos()[0];
    if (M.xLiftoff === undefined && ph === 'LIFTOFF') M.xLiftoff = x();
    if (M.xTD === undefined && ph === 'ROLLOUT') M.xTD = x();
    if (M.xStop === undefined && ph === 'STOPPED') M.xStop = x();
  },
  extraLines: c => {
    const M = c.custom;
    const toRoll = M.xLiftoff === undefined ? 999 : Math.abs(M.xLiftoff - 2);
    const ldgRoll = (M.xTD === undefined || M.xStop === undefined) ? 999 : Math.abs(M.xStop - M.xTD);
    return [`STOL: takeoff roll ${toRoll.toFixed(0)} m | landing roll ${ldgRoll.toFixed(0)} m`];
  },
  checks: c => ({
    'touchdown': !!c.td,
    // sink threshold: baseline 2026-08-02 measured 0.61 m/s; gated at ~2x observed
    'sink<1.2': c.td && c.td.sink < 1.2,
    '|tdZ|<5': c.td && Math.abs(c.td.z) < 5,
    'tdX in (-680,-380)': c.td && c.td.x > -680 && c.td.x < -380,
    'stopX<20': c.cg[0] < 20,
    '|stopZ|<7': Math.abs(c.cg[2]) < 7,
    'chassis<11.5%': c.smaxCh < 0.115,
    'gear<40%': c.smaxGr < 0.40,
    // recalibrated -2.5 -> -4 (2026-08): pre-bracing baseline was measured with
    // the tail lying on its side through the whole circuit; the healthy
    // aircraft brakes into a mild -2.8 deg nose-down transient, far from
    // nose-over. Deck angle at rest is +5.9.
    // -4 -> -7 (2026-08-10, wing bracing): the braced wing lands 4.7 s later
    // and rolls 114 m instead of ~59, so it is still carrying speed when the
    // brakes bite and the transient deepened -3.6 -> -5.1. MEASURED before
    // moving the number, because this check exists to catch NOSE-OVER and not
    // to track a baseline: through the whole rollout the closest piece of
    // STRUCTURE (a pod bottom longeron) stays 0.640 m off the ground, the
    // shakedown puts nose-over at 26.07 deg, and the Rotax 277 is a PUSHER so
    // there is no prop-strike path at any attitude. -5.1 is 21 deg of margin.
    'rolloutPitchMin>-7': c.rollPitchMin > -7,
    'flapMin>-10': c.flapMin > -10,
    'flapMax<20': c.flapMax < 20,
    'chatter<6': c.chatRate() < 6,
  }),
});
