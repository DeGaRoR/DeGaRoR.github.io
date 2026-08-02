const { buildChinook } = require('./flight_core.js');
const { runCircuit } = require('./circuit_harness.js');

runCircuit({
  id: 'CHINOOK', build: buildChinook,
  perturb: { z: 1.0, v: 0.001 }, settleS: 10, maxS: 300,
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
    'rolloutPitchMin>-4': c.rollPitchMin > -4,
    'flapMin>-10': c.flapMin > -10,
    'flapMax<20': c.flapMax < 20,
    'chatter<6': c.chatRate() < 6,
  }),
});
