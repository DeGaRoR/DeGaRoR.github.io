const { buildJodel } = require('./flight_core.js');
const { runCircuit } = require('./circuit_harness.js');

runCircuit({
  id: 'JODEL', build: buildJodel,
  perturb: { z: 1.0, v: 0.001 }, settleS: 10, maxS: 300,
  tip: { tag: 'WF', midZ: 2.10, tipZ: 4.36, tol: 0.2 },
  wingNote: 'dihedral 14 crank',
  checks: c => ({
    'touchdown': !!c.td,
    'sink<1.2': c.td && c.td.sink < 1.2,
    '|tdZ|<5.5': c.td && Math.abs(c.td.z) < 5.5,
    'tdX in (-720,-420)': c.td && c.td.x > -720 && c.td.x < -420,
    'stopX<20': c.cg[0] < 20,
    '|stopZ|<7': Math.abs(c.cg[2]) < 7,
    'chassis<6%': c.smaxCh < 0.06,
    'gear<40%': c.smaxGr < 0.40,
    'rolloutPitchMin>-2': c.rollPitchMin > -2,
    'flapMin>8': c.flapMin > 8,
    'flapMax<31': c.flapMax < 31,
    'chatter<6': c.chatRate() < 6,
  }),
});
