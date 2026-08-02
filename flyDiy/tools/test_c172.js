const { buildC172 } = require('./flight_core.js');
const { runCircuit } = require('./circuit_harness.js');

runCircuit({
  id: 'C172', build: buildC172,
  perturb: { z: 1.0, v: 0.001 }, settleS: 10, maxS: 300,
  tip: { tag: 'WF', midZ: 2.30, tipZ: 5.50, tol: 0.2 },
  wingNote: 'dihedral 1.7',
  checks: c => ({
    'touchdown': !!c.td,
    'sink<1.0': c.td && c.td.sink < 1.0,
    '|tdZ|<5': c.td && Math.abs(c.td.z) < 5,
    'tdX in (-720,-400)': c.td && c.td.x > -720 && c.td.x < -400,
    'stopX<20': c.cg[0] < 20,
    '|stopZ|<7': Math.abs(c.cg[2]) < 7,
    'chassis<6%': c.smaxCh < 0.06,
    'gear<40%': c.smaxGr < 0.40,
    'rolloutPitchMin>-4': c.rollPitchMin > -4,
    'flapMin>-1': c.flapMin > -1,
    'flapMax<12': c.flapMax < 12,
    'chatter<6': c.chatRate() < 6,
  }),
});
