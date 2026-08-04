// tools/_zbudget.mjs — THE A4 SWEEP: how strong should the muscle be?
//
// THE PREMISE A4 WAS WRITTEN ON IS GONE. planLocomotion/DESIGN-LOCOMOTION-TO-
// INTENT.md opens A4 with "saturation is real and progressive — corpus median
// 0.018 -> 0.129 across 300 s". After the A1 force-accumulation fix the corpus
// median is 0.000: the error clamp does not bind at all. So the chantier's first
// gate is already met and its stated lever, `budgetScale`, is INERT — it
// multiplies the clamp ceiling only, while the spring and damping gains use the
// raw budget (engine/l1/physics.js, at the motor-configure site).
//
// WHAT IS ACTUALLY WRONG is the second gate. Commanded inter-joint coherence is
// 0.947 after A3 and ACHIEVED coherence is 0.555 — a ratio of 0.586 against a
// target of 0.85. The controller now asks for a clean travelling wave and the
// body does not execute it. With the clamp at 0.000 that is not a torque BUDGET
// problem, it is a tracking STIFFNESS problem, and `MUSCLE_STRESS` is the only
// constant that moves it.
//
// MUSCLE_STRESS reads 200 barye = 20 Pa against real muscle's 1e4-1e6 Pa, i.e.
// three to five orders of magnitude weak, and is scheduled to become 2e6. This
// sweeps it rather than assuming that figure, and takes THE SMALLEST value that
// meets the gates — which is what the design document asks for.
//
// Every arm reports stability as well as tracking, because a stiffer actuator is
// exactly the change that historically tore creatures apart (the MYRIAPOD-FIX
// note in physics.js). An arm that tracks perfectly and detonates is not a win.
//
// Run: node tools/_zbudget.mjs [SECONDS=120] [N=12]
import RAPIER from '@dimforge/rapier3d-compat';
import { rngFrom } from '../trunk/rng.js';
import { createRandomGenome } from '../engine/l1/factory.js';
import { assessViability } from '../engine/l1/viability.js';
import { createSimulation, FIXED_DT, MUSCLE_STRESS } from '../engine/l1/physics.js';
import { totalMass } from '../engine/l1/morphogen.js';
import W1_SLICE from '../worlds/w1_slice.js';
await RAPIER.init();

const SECONDS = Number(process.argv[2] ?? 120);
const N = Number(process.argv[3] ?? 12);
const ARMS = (process.argv[4] ? process.argv[4].split(',').map(Number) : [1, 3, 10, 30, 100, 1e3, 1e4]);   // multiples of the shipped 200 barye

const corpus = [];
for (let i = 0; corpus.length < N && i < N * 12; i++) {
  const g = createRandomGenome(rngFrom('decay', 'corpus', i));
  const v = assessViability(RAPIER, g, W1_SLICE);
  if (v.ok && v.plan.jointCount >= 3) corpus.push({ genome: g, plan: v.plan });
}

function corr(a, b) {
  const n = a.length; let ma = 0, mb = 0;
  for (let i = 0; i < n; i++) { ma += a[i]; mb += b[i]; }
  ma /= n; mb /= n;
  let sa = 0, sb = 0, sab = 0;
  for (let i = 0; i < n; i++) { const x = a[i] - ma, y = b[i] - mb; sa += x * x; sb += y * y; sab += x * y; }
  return sa > 1e-12 && sb > 1e-12 ? sab / Math.sqrt(sa * sb) : NaN;
}
function pearson(a, b) {
  const n = a.length;
  const ma = a.reduce((s, x) => s + x, 0) / n, mb = b.reduce((s, x) => s + x, 0) / n;
  let num = 0, da = 0, db = 0;
  for (let i = 0; i < n; i++) { const x = a[i] - ma, y = b[i] - mb; num += x * y; da += x * x; db += y * y; }
  return da > 0 && db > 0 ? num / Math.sqrt(da * db) : 0;
}
const med = (a) => { const s = a.filter(Number.isFinite).sort((x, y) => x - y); return s.length ? s[s.length >> 1] : NaN; };
const pct = (a, f) => (100 * a.filter(f).length) / Math.max(1, a.length);

const HZ = 10, every = Math.round(1 / (HZ * FIXED_DT));

function trial(plan, genome, muscleStress) {
  let sim;
  try {
    sim = createSimulation(RAPIER, plan, genome, W1_SLICE,
      { bounded: false, wrap: true, effort: 0, turnBias: 0, muscleStress });
  } catch { return null; }
  for (let s = 0; s < Math.round(3 / FIXED_DT); s++) sim.step();
  sim.resetClock(); sim.resetIntegrity(); sim.control.effort = 1;

  const J = plan.jointCount;
  const NS = Math.floor(SECONDS * HZ);
  const th = Array.from({ length: J }, () => new Float64Array(NS));
  const wa = Array.from({ length: J }, () => new Float64Array(NS));
  let k = 0, keA = 0, nA = 0, keB = 0, nB = 0, path = 0, prev = null;
  const p0 = sim.bodies[0].translation();
  const start = { x: p0.x, y: p0.y, z: p0.z };

  const steps = Math.round(SECONDS / FIXED_DT);
  for (let s = 0; s < steps; s++) {
    try { sim.step(); } catch { break; }
    if (s % every !== 0 || k >= NS) continue;
    const d = sim.motorDiag;
    for (let j = 0; j < J; j++) { th[j][k] = d.theta[j]; wa[j][k] = d.want[j]; }
    k++;
    const c = sim.bodies[0].translation();
    if (prev) path += Math.hypot(c.x - prev.x, c.y - prev.y, c.z - prev.z);
    prev = { x: c.x, y: c.y, z: c.z };
    let e = 0;
    for (const rb of sim.bodies) { const v = rb.linvel(); e += 0.5 * rb.mass() * (v.x * v.x + v.y * v.y + v.z * v.z); }
    const sec = s * FIXED_DT;
    if (sec < SECONDS / 2) { keA += e; nA++; } else { keB += e; nB++; }
  }
  const end = sim.bodies[0].translation();
  const net = Math.hypot(end.x - start.x, end.y - start.y, end.z - start.z);
  const integ = sim.integrity();

  // Coherence over the samples actually collected, and the amplitude the body
  // delivered against the amplitude commanded.
  // COMMANDED SWING PER JOINT, needed for the amplitude-filtered arm below.
  const swing = new Float64Array(J);
  for (let j = 0; j < J; j++) {
    let wx = -1e9, wn = 1e9;
    for (let i = 0; i < k; i++) { if (wa[j][i] > wx) wx = wa[j][i]; if (wa[j][i] < wn) wn = wa[j][i]; }
    swing[j] = wx - wn;
  }
  const maxSwing = Math.max(...swing, 1e-12);

  // PEARSON IS SCALE-INVARIANT, and that is the trap in this metric. A joint
  // commanded at a swing of 0.001 rad has a PERFECT commanded correlation with
  // its neighbour — correlation does not care how big the signal is — while its
  // ACHIEVED trace is pure hydrodynamic buffeting and correlates with nothing. So
  // near-inert joints drag the achieved/commanded ratio down for a reason no
  // actuator can fix: a joint that was never asked to move cannot move
  // coherently. `cohAlive` repeats the measurement over pairs where BOTH joints
  // are actually commanded to swing.
  let ca = 0, cw = 0, n = 0, sa = 0, sw = 0, caL = 0, cwL = 0, nL = 0;
  const ALIVE = 0.10;                       // of the creature's largest commanded swing
  for (let j = 0; j + 1 < J; j++) {
    const a = corr(th[j].subarray(0, k), th[j + 1].subarray(0, k));
    const w = corr(wa[j].subarray(0, k), wa[j + 1].subarray(0, k));
    if (!Number.isFinite(a) || !Number.isFinite(w)) continue;
    ca += Math.abs(a); cw += Math.abs(w); n++;
    if (swing[j] >= ALIVE * maxSwing && swing[j + 1] >= ALIVE * maxSwing) {
      caL += Math.abs(a); cwL += Math.abs(w); nL++;
    }
  }
  for (let j = 0; j < J; j++) {
    let mx = -1e9, mn = 1e9, wx = -1e9, wn = 1e9;
    for (let i = 0; i < k; i++) {
      if (th[j][i] > mx) mx = th[j][i]; if (th[j][i] < mn) mn = th[j][i];
      if (wa[j][i] > wx) wx = wa[j][i]; if (wa[j][i] < wn) wn = wa[j][i];
    }
    sa += mx - mn; sw += wx - wn;
  }
  const out = {
    cohA: n ? ca / n : NaN,
    cohW: n ? cw / n : NaN,
    cohAL: nL ? caL / nL : NaN,
    cohWL: nL ? cwL / nL : NaN,
    aliveFrac: n ? nL / n : NaN,
    amp: sw > 1e-9 ? sa / sw : NaN,
    sat: integ.saturation, spin: integ.spinSaturation, spread: integ.spread,
    path: path / SECONDS, net: net / SECONDS, workOut: sim.workOut, mass: totalMass(plan),
    keRatio: nA > 0 && nB > 0 && keA > 0 ? (keB / nB) / (keA / nA) : NaN,
  };
  sim.free();
  return out;
}

console.log(`\n  A4 MUSCLE SWEEP — ${corpus.length} creatures x ${SECONDS} s, shipped MUSCLE_STRESS = ${MUSCLE_STRESS}\n`);
console.log('   xStress    stress   coh(ach)  coh(cmd)   ratio    ratio*   alive    amp    netSpd   workOut  KEok   r(spd,mass)  r(track,mass)');
console.log('  ' + '-'.repeat(104));
console.log('  ratio* = achieved/commanded over pairs where BOTH joints are actually commanded to swing');

for (const m of ARMS) {
  const rows = [];
  for (const { genome, plan } of corpus) {
    const r = trial(plan, genome, MUSCLE_STRESS * m);
    if (r) rows.push(r);
  }
  if (!rows.length) { console.log(`  ${String(m).padStart(8)}  all failed`); continue; }
  const cohA = med(rows.map((r) => r.cohA));
  const cohW = med(rows.map((r) => r.cohW));
  console.log('  ' + `x${m}`.padStart(8)
    + (MUSCLE_STRESS * m).toExponential(1).padStart(10)
    + cohA.toFixed(3).padStart(11)
    + cohW.toFixed(3).padStart(10)
    + (cohA / cohW).toFixed(3).padStart(8)
    + (med(rows.map((r) => r.cohAL)) / med(rows.map((r) => r.cohWL))).toFixed(3).padStart(9)
    + med(rows.map((r) => r.aliveFrac)).toFixed(2).padStart(8)
    + med(rows.map((r) => r.amp)).toFixed(3).padStart(8)
    + med(rows.map((r) => r.net)).toExponential(1).padStart(10)
    + med(rows.map((r) => r.workOut)).toExponential(1).padStart(10)
    + `${pct(rows, (r) => r.keRatio >= 0.8 && r.keRatio <= 1.25).toFixed(0)}%`.padStart(6)
    + pearson(rows.map((r) => r.net), rows.map((r) => r.mass)).toFixed(3).padStart(9)
    + pearson(rows.filter((r)=>Number.isFinite(r.cohAL/r.cohWL)).map((r) => r.cohAL / r.cohWL), rows.filter((r)=>Number.isFinite(r.cohAL/r.cohWL)).map((r) => r.mass)).toFixed(3).padStart(12));
}

console.log('\n  GATES: ratio (ach/cmd) >= 0.85 · sat < 0.02 · KEok >= 90% · burst 0%');
console.log('  Take the SMALLEST stress meeting all four.\n');
