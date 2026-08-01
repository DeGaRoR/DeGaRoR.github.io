// tools/_zorient.mjs — THROWAWAY. Pick the turn3d estimator empirically.
//
// C0.1 repair verification. Reproduces the diagnosis targets before any engine
// edit: a straight swimmer (turnBias 0) reads ~5.46 deg/s under the shipped
// magnitude accumulation and ~0.59 deg/s under vector accumulation, and the
// coherent steering response (differenced across +/-bias) is ~0.12 deg/s on the
// shipped actuator. Compares three rate estimators so the repair uses the one
// that actually cancels the per-stroke wobble:
//
//   old   = sum of |increment| / dt          (shipped: magnitude accumulation)
//   vecV  = |vector sum of increments| / dt   from COM VELOCITY direction
//   vecF  = |vector sum of increments| / dt   from BODY FORWARD axis (rootQ)
//
// and the coherent response = |rateVec(+bias) - rateVec(-bias)| / 2 for each.
//
//   node tools/_zorient.mjs [seconds] [stride]
import RAPIER from '@dimforge/rapier3d-compat';
import { morphogenesis } from '../engine/l1/morphogen.js';
import { createSimulation, FIXED_DT } from '../engine/l1/physics.js';
import { SEEDS } from '../worlds/seeds.js';
import { W1_SLICE } from '../worlds/w1_slice.js';

const T = Number(process.argv[2] ?? 16);
const STRIDE_S = Number(process.argv[3] ?? 0.6); // seconds between direction samples
await RAPIER.init();

const DEG = 180 / Math.PI;
const rotv = (q, v) => {
  const t = [2 * (q.y * v[2] - q.z * v[1]), 2 * (q.z * v[0] - q.x * v[2]), 2 * (q.x * v[1] - q.y * v[0])];
  return [v[0] + q.w * t[0] + (q.y * t[2] - q.z * t[1]),
          v[1] + q.w * t[1] + (q.z * t[0] - q.x * t[2]),
          v[2] + q.w * t[2] + (q.x * t[1] - q.y * t[0])];
};
const cross = (p, q) => [p[1]*q[2]-p[2]*q[1], p[2]*q[0]-p[0]*q[2], p[0]*q[1]-p[1]*q[0]];
const hyp = (a) => Math.hypot(a[0], a[1], a[2]);

// Run one bias direction, sample com + forward axis every STRIDE, and return the
// increment lists for both direction sources.
function run(plan, genome, bias) {
  const sim = createSimulation(RAPIER, plan, genome, { ...W1_SLICE, gravity: 0 },
    { bounded: false, wrap: true, effort: 1, turnBias: bias });
  const settle = Math.round(2 / FIXED_DT);
  for (let k = 0; k < settle; k++) sim.step();
  const every = Math.max(1, Math.round(STRIDE_S / FIXED_DT));
  const coms = [], fwds = [];
  const steps = Math.round(T / FIXED_DT);
  for (let k = 0; k <= steps; k++) {
    if (k % every === 0) {
      coms.push(sim.centreOfMass());
      const q = sim.bodies[0].rotation();
      fwds.push(rotv(q, [0, 0, 1]));
    }
    if (k < steps) sim.step();
  }
  sim.free();
  const dt = T;
  // velocity-direction increments
  const dirs = [];
  for (let i = 1; i < coms.length; i++) {
    const d = [coms[i][0]-coms[i-1][0], coms[i][1]-coms[i-1][1], coms[i][2]-coms[i-1][2]];
    const n = hyp(d); if (n > 1e-6) dirs.push([d[0]/n, d[1]/n, d[2]/n]);
  }
  const incV = [], incF = [];
  for (let i = 1; i < dirs.length; i++) incV.push(cross(dirs[i-1], dirs[i]));
  for (let i = 1; i < fwds.length; i++) {
    const a = fwds[i-1], b = fwds[i];
    const na = hyp(a), nb = hyp(b);
    if (na > 1e-6 && nb > 1e-6) incF.push(cross([a[0]/na,a[1]/na,a[2]/na], [b[0]/nb,b[1]/nb,b[2]/nb]));
  }
  const sumMag = (inc) => inc.reduce((s, c) => s + Math.asin(Math.min(1, hyp(c))), 0);
  const vecSum = (inc) => inc.reduce((s, c) => [s[0]+c[0], s[1]+c[1], s[2]+c[2]], [0,0,0]);
  return {
    old:  sumMag(incV) / dt,
    vecV: vecSum(incV), // divide by dt below
    vecF: vecSum(incF),
    dt,
  };
}

console.log(`\n  _zorient · ${T}s, stride ${STRIDE_S}s — turn rate estimators (deg/s)\n`);
console.log('  id            bias0.old  bias0.vecV bias0.vecF | resp.old  resp.vecV resp.vecF');
for (const sd of SEEDS) {
  if (sd.id === 'staircase') continue;
  const g = sd.genome ?? sd;
  let plan; try { plan = morphogenesis(g); } catch { continue; }
  const z = run(plan, g, 0);
  const p = run(plan, g, 1);
  const m = run(plan, g, -1);
  const magV = (r) => hyp(r.vecV) / r.dt * DEG;
  const magF = (r) => hyp(r.vecF) / r.dt * DEG;
  // coherent response = |vecSum(+)/dt - vecSum(-)/dt| / 2
  const resp = (a, b, key) => {
    const va = a[key].map(x => x / a.dt), vb = b[key].map(x => x / b.dt);
    return hyp([va[0]-vb[0], va[1]-vb[1], va[2]-vb[2]]) / 2 * DEG;
  };
  const respOld = Math.abs(p.old - m.old) / 2 * DEG / DEG; // p.old already /dt in rad
  console.log(
    `  ${sd.id.padEnd(12)} ${(z.old*DEG).toFixed(2).padStart(9)} ${magV(z).toFixed(2).padStart(10)} ${magF(z).toFixed(2).padStart(10)} |`
    + ` ${(Math.abs(p.old-m.old)/2*DEG).toFixed(2).padStart(8)} ${resp(p,m,'vecV').toFixed(2).padStart(9)} ${resp(p,m,'vecF').toFixed(2).padStart(9)}`);
}
console.log('\n  diagnosis targets: bias0 old~5.46, vec~0.59 deg/s; coherent response shipped ~0.12 deg/s\n');
