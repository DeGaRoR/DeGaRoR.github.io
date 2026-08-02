const { buildDC3 } = require('./flight_core.js');
const { runCircuit } = require('./circuit_harness.js');

runCircuit({
  id: 'DC3', build: buildDC3,
  perturb: { z: 1.5, v: 0.002 }, settleS: 10, maxS: 460,
  tip: { tag: 'WF', midZ: 7.6, tipZ: 14.3, tol: 0.2 },
  flapDuring: () => true,
  wingNote: 'dihedral 5 outboard',
  checks: c => ({
    'touchdown': !!c.td,
    'sink<1.8': c.td && c.td.sink < 1.8,
    '|tdZ|<5': c.td && Math.abs(c.td.z) < 5,
    'tdX in (-1060,-700)': c.td && c.td.x > -1060 && c.td.x < -700,
    'stopX<20': c.cg[0] < 20,
    '|stopZ|<9': Math.abs(c.cg[2]) < 9,
    'chassis<6%': c.smaxCh < 0.06,
    'gear<40%': c.smaxGr < 0.40,
    'rolloutPitchMin>0': c.rollPitchMin > 0,
    'flapMin>0': c.flapMin > 0,
    'flapMax<12': c.flapMax < 12,
    'chatter<6': c.chatRate() < 6,
  }),
});
