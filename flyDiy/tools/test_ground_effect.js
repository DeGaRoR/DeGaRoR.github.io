// Ground-effect gate: height sweep on the Cub via probe with a live world.
// Asserts the McCormick-shaped behaviour: total drag at fixed alpha falls
// monotonically as the wing approaches the ground, lift rises, and both
// converge to free-air values far from it.
const { buildCub, makeSim, makeWorld } = require('./flight_core.js');
const world = makeWorld();
const def = buildCub();

// same span datum the solver derives
let b = 0;
for (const st of def.strips) if (st.kind === 'wing')
  for (const i of [st.fIn, st.fOut, st.rIn, st.rOut])
    b = Math.max(b, Math.abs(def.nodes[i].p[2]));
b *= 2;

const sim = makeSim(def, world);
const AL = 3 * Math.PI / 180, V = 25;
const vel = [-V * Math.cos(AL), -V * Math.sin(AL), 0];

function wingY() {
  let sy = 0, sN = 0;
  for (const st of def.strips) if (st.kind === 'wing') {
    sy += sim.p[st.fIn*3+1] + sim.p[st.fOut*3+1]; sN += 2;
  }
  return sy / sN;
}
function probeAt(hb) {
  sim.reset(0);
  const dy = hb * b - wingY();          // runway pad is flat at 0
  for (let i = 0; i < sim.n; i++) sim.p[i*3+1] += dy;
  const r = sim.probe(vel);
  // lift/drag in the wind frame at incoming alpha
  return { L: -r.Fx * Math.sin(AL) + r.Fy * Math.cos(AL),
           D: r.Fx * Math.cos(AL) + r.Fy * Math.sin(AL) };
}

const HB = [0.05, 0.10, 0.25, 0.50, 1.0, 5.0, 20.0];
const R = HB.map(hb => ({ hb, ...probeAt(hb) }));
const free = R[R.length - 1];
for (const x of R)
  console.log(`h/b=${x.hb.toFixed(2).padStart(5)}  L=${x.L.toFixed(0).padStart(5)} N (${(100*x.L/free.L-100).toFixed(1).padStart(5)}%)  D=${x.D.toFixed(1).padStart(6)} N (${(100*x.D/free.D-100).toFixed(1).padStart(5)}%)`);

let monoD = true, monoL = true;
for (let i = 1; i < R.length; i++) {
  if (R[i].D < R[i-1].D - 1e-6) monoD = false;   // drag must rise with height
  if (R[i].L > R[i-1].L + 1e-6) monoL = false;   // lift must fall with height
}
const dragCut = 1 - R[0].D / free.D;              // at h/b = 0.05
const liftGain = R[0].L / free.L - 1;
const converged = Math.abs(R[5].D / free.D - 1) < 0.005 && Math.abs(R[5].L / free.L - 1) < 0.005;
console.log(`drag cut @h/b=0.05: ${(dragCut*100).toFixed(1)}%  lift gain: ${(liftGain*100).toFixed(1)}%  far-field converged: ${converged}`);

const checks = {
  'drag monotonic with height': monoD,
  'lift monotonic with height': monoL,
  'drag cut @0.05 in 8..45%': dragCut > 0.08 && dragCut < 0.45,
  'lift gain @0.05 in 1..15%': liftGain > 0.01 && liftGain < 0.15,
  'free-air converged by h/b=5': converged,
};
const failed = Object.keys(checks).filter(k => !checks[k]);
if (failed.length) console.log(`FAILED CHECKS: ${failed.join(', ')}`);
const pass = failed.length === 0;
console.log(pass ? 'GATE GE: PASS' : 'GATE GE: FAIL');
process.exitCode = pass ? 0 : 1;
