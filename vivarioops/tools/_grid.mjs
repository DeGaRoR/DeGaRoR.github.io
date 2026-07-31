// tools/_grid.mjs — HOW MANY BEARINGS DOES THE TRIAL NEED?
//
// §101 measured S/N 1.92 at four bearings and predicted ~3.8 at sixteen from
// 1/sqrt(n). That prediction assumes the per-bearing scores are independent
// draws around a creature's true value, which is exactly the kind of assumption
// this session keeps getting punished for. Measure it instead.
//
// The whole simulation is DETERMINISTIC — no stochastic term anywhere, and the
// creature always starts identically. So the only thing that varies between two
// evaluations of one genome is WHICH BEARINGS the trial happened to use. That
// makes the noise fully characterisable from one fine sweep per creature:
// measure the score at every bearing on a dense grid once, then compute what any
// n-bearing trial WOULD have returned by subsampling. No re-simulation, and
// every trial size falls out of the same data.
//
// Cost: 36 bearings x 2 runs x 15 s = 1080 sim-seconds per creature, about 15 s
// wall. Ten creatures gives every number below.
import RAPIER from '@dimforge/rapier3d-compat';
import { rngFrom } from '../trunk/rng.js';
import { createRandomGenome } from '../engine/l1/factory.js';
import { morphogenesis } from '../engine/l1/morphogen.js';
import { createSimulation, FIXED_DT } from '../engine/l1/physics.js';
import { DRIVE, sensorTurnBias } from '../engine/l1/controller.js';
import W1_SLICE from '../worlds/w1_slice.js';
await RAPIER.init();

const W = { ...W1_SLICE, gravity: 0 }, MOTOR = { motor: 'solver' };
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const nrm = (v) => { const n = Math.hypot(...v) || 1; return v.map((x) => x / n); };
const cross = (a, b) => [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
const dot = (a, b) => a[0]*b[0] + a[1]*b[1] + a[2]*b[2];
const mean = (v) => v.reduce((a, b) => a + b, 0) / (v.length || 1);
const sd = (v) => { const m = mean(v); return Math.sqrt(mean(v.map((x) => (x - m) ** 2))); };

const AX = 8, SK = 15, GRID = 36;   // 36 bearings = every 10 degrees

function axisRun(plan, g, tb) {
  let sim;
  try { sim = createSimulation(RAPIER, plan, g, W, { drive: DRIVE.POSITION, bounded: false, turnBias: tb, ...MOTOR }); }
  catch { return null; }
  const mk = []; let bad = false;
  try {
    for (let s = 0; s < Math.round(AX / FIXED_DT); s++) {
      sim.step(); const c = sim.centreOfMass();
      if (!Number.isFinite(c[0] + c[1] + c[2])) { bad = true; break; }
      if (s % 60 === 0) mk.push([...c]);
    }
  } catch { bad = true; }
  const c1 = sim.centreOfMass(); sim.free();
  if (bad || mk.length < 4) return null;
  const v = [];
  for (let i = 1; i < mk.length; i++) {
    const d = [mk[i][0]-mk[i-1][0], mk[i][1]-mk[i-1][1], mk[i][2]-mk[i-1][2]];
    if (Math.hypot(...d) > 1e-5) v.push(nrm(d));
  }
  let ax = [0, 0, 0];
  for (let i = 1; i < v.length; i++) { const c = cross(v[i-1], v[i]); ax = [ax[0]+c[0], ax[1]+c[1], ax[2]+c[2]]; }
  return { axis: nrm(ax), speed: Math.hypot(c1[0]-mk[0][0], c1[1]-mk[0][1], c1[2]-mk[0][2]) / AX };
}

function profile(plan, g) {
  const p = axisRun(plan, g, 1), m = axisRun(plan, g, -1);
  if (!p || !m) return null;
  const d = [p.axis[0]-m.axis[0], p.axis[1]-m.axis[1], p.axis[2]-m.axis[2]], mag = Math.hypot(...d);
  const axis = mag > 1e-6 ? nrm(d) : [0, 1, 0];
  const s0 = Math.abs(axis[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0];
  const u = nrm(cross(axis, s0));
  return { basis: [u, nrm(cross(axis, u))], authority: mag / 2, speed: (p.speed + m.speed) / 2 };
}

/** Score at ONE bearing. Returns closing fraction. */
function scoreAt(plan, g, pr, ov, deg) {
  const R = Math.max(1, Math.min(8, pr.speed * SK * 0.6));
  const [U, V] = pr.basis;
  let sim;
  try { sim = createSimulation(RAPIER, plan, g, W, { drive: DRIVE.POSITION, bounded: false, ...MOTOR }); }
  catch { return null; }
  const c0 = sim.centreOfMass(), th = deg * Math.PI / 180;
  const t = [0, 1, 2].map((i) => c0[i] + R * (Math.cos(th) * U[i] + Math.sin(th) * V[i]));
  let best = R, bad = false, prev = c0, va = 0, vb = 0;
  try {
    for (let s = 0; s < Math.round(SK / FIXED_DT); s++) {
      const c = sim.centreOfMass();
      if (!Number.isFinite(c[0] + c[1] + c[2])) { bad = true; break; }
      const dv = [c[0]-prev[0], c[1]-prev[1], c[2]-prev[2]];
      va = 0.98*va + 0.02*dot(dv, U); vb = 0.98*vb + 0.02*dot(dv, V);
      const td = [t[0]-c[0], t[1]-c[1], t[2]-c[2]], ta = dot(td, U), tb = dot(td, V);
      if (Math.hypot(va, vb) > 1e-7 && Math.hypot(ta, tb) > 1e-4) {
        const br = wrap(Math.atan2(tb, ta) - Math.atan2(vb, va)) / Math.PI;
        sim.control.turnBias = ov === null ? sensorTurnBias(g, br, br) : Math.max(-1, Math.min(1, ov * br));
      }
      prev = c;
      const d = Math.hypot(t[0]-c[0], t[1]-c[1], t[2]-c[2]); if (d < best) best = d;
      sim.step();
    }
  } catch { bad = true; }
  sim.free();
  return bad ? null : Math.max(0, (R - best) / R);
}

const N = Number(process.argv[2] ?? 10);
const rows = [];
for (let i = 0; rows.length < N && i < N * 12; i++) {
  const g = createRandomGenome(rngFrom('noise', i));       // same corpus as _noise.mjs
  let p; try { p = morphogenesis(g); } catch { continue; }
  if (p.jointCount < 1) continue;
  const pr = profile(p, g);
  if (!pr || !(pr.speed > 1e-4)) continue;
  const live = [], dead = [];
  let bad = false;
  for (let k = 0; k < GRID; k++) {
    const deg = k * 360 / GRID;
    const L = scoreAt(p, g, pr, null, deg), D = scoreAt(p, g, pr, 0, deg);
    if (L === null || D === null) { bad = true; break; }
    live.push(L); dead.push(D);
  }
  if (bad) continue;
  rows.push({ i, ben: live.map((L, k) => L - dead[k]), gain: g.controller.preyGain + g.controller.threatGain, auth: pr.authority });
}

console.log(`\n  ${rows.length} creatures, benefit measured at all ${GRID} bearings (every 10 deg)\n`);
console.log('  creature   true benefit   per-bearing sd    min      max');
for (const r of rows) {
  console.log(`  ${String(r.i).padEnd(9)}  ${mean(r.ben).toFixed(4).padStart(11)}   ${sd(r.ben).toFixed(4).padStart(12)}  ${Math.min(...r.ben).toFixed(3).padStart(7)}  ${Math.max(...r.ben).toFixed(3).padStart(7)}`);
}

// What would an n-bearing evenly-spaced trial have returned, at each offset?
console.log('\n  S/N BY TRIAL SIZE — derived by subsampling the grid, no extra simulation\n');
console.log('   n bearings   within-sd (noise)   between-sd (signal)    S/N    predicted by 1/sqrt(n)');
const between = sd(rows.map((r) => mean(r.ben)));
const base = [];
for (const n of [2, 3, 4, 6, 9, 12, 18, 36]) {
  if (GRID % n !== 0) continue;
  const step = GRID / n;
  const withins = rows.map((r) => {
    const perOffset = [];
    for (let o = 0; o < step; o++) {
      const pick = [];
      for (let k = 0; k < n; k++) pick.push(r.ben[(o + k * step) % GRID]);
      perOffset.push(mean(pick));
    }
    return sd(perOffset);
  });
  const within = mean(withins);
  const sn = within > 1e-9 ? between / within : Infinity;
  if (n === 4) base.push(sn);
  const pred = base.length ? (base[0] * Math.sqrt(n / 4)).toFixed(2) : '—';
  console.log(`   ${String(n).padStart(10)}   ${within.toFixed(4).padStart(15)}   ${between.toFixed(4).padStart(17)}   ${sn.toFixed(2).padStart(6)}    ${String(pred).padStart(10)}`);
}
console.log(`\n  "within" is the spread over the ${GRID}/n distinct rotations of an evenly`);
console.log('  spaced n-bearing set. At n = 36 there is only one such set, so the noise');
console.log('  is 0 by construction and S/N is infinite — that row is the definition of');
console.log('  the true value, not a usable trial.\n');
