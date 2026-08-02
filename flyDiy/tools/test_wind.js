// Crosswind + gust gate: Cub (light taildragger) and C172 (trike) fly the
// full circuit in a 3 m/s crosswind with gusts. Asserts the circuit
// completes, the decrab keeps touchdown drift and offset bounded, and the
// gust rejection holds cruise altitude.
const { buildCub, buildC172, makeWorld } = require('./flight_core.js');
const { runCircuit } = require('./circuit_harness.js');

const WIND = { base: [0, 0, 3], gust: 1.0 };
function mkWindWorld() { const w = makeWorld(); w.setWind(WIND); return w; }

const altCollector = c => {
  if (c.ap.phase === 'CRUISE') {
    const d = Math.abs(c.ap.dbg.alt - c.def.params.ap.hCruise);
    if (d > (c.custom.altExc ?? 0)) c.custom.altExc = d;
  }
};
const common = c => ({
  'touchdown': !!c.td,
  '|tdZ|<6': c.td && Math.abs(c.td.z) < 6,
  '|tdDrift|<1.8': c.td && Math.abs(c.td.drift ?? 9) < 1.8,
  'stopX<20': c.cg[0] < 20,
  '|stopZ|<10': Math.abs(c.cg[2]) < 10,
  'gustAltExc<18': (c.custom.altExc ?? 0) < 18,
});

const r1 = runCircuit({
  id: 'WINDCUB', build: buildCub, world: mkWindWorld(), uprightCheck: false,
  perturb: { z: 1.2, v: 0.001 }, settleS: 15, maxS: 300,
  tip: { tag: 'WF', midZ: 3.4, tipZ: 5.0, tol: 0.1 }, flapDuring: () => true,
  wingNote: 'crosswind 3 m/s + gusts',
  onStep: altCollector,
  checks: c => ({ ...common(c),
    'sink<2.0': c.td && c.td.sink < 2.0,
    'chassis<8%': c.smaxCh < 0.08, 'gear<35%': c.smaxGr < 0.35 }),
});

const r2 = runCircuit({
  id: 'WINDC172', build: buildC172, world: mkWindWorld(), uprightCheck: false,
  perturb: { z: 1.0, v: 0.001 }, settleS: 10, maxS: 300,
  tip: { tag: 'WF', midZ: 2.30, tipZ: 5.50, tol: 0.2 },
  wingNote: 'crosswind 3 m/s + gusts',
  onStep: altCollector,
  checks: c => ({ ...common(c),
    'sink<1.5': c.td && c.td.sink < 1.5,
    'chassis<6%': c.smaxCh < 0.06, 'gear<40%': c.smaxGr < 0.40 }),
});

const pass = r1.pass && r2.pass;
console.log(pass ? 'GATE WIND: PASS' : 'GATE WIND: FAIL');
process.exitCode = pass ? 0 : 1;
