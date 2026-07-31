// WHAT DOES turnBias ACTUALLY DO TO THE GAIT?
//
// targetAngles computes, per joint,
//
//     theta = bias + amplitude*range*sin(...) + side*turnBias*TURN_AUTHORITY*range
//
// with TURN_AUTHORITY = 1.0, and the Rapier joint is limited to [-range, range].
// So at |turnBias| = 1 the steering term ALONE consumes the joint's entire
// travel, and the oscillation is commanded entirely outside the limit. The
// controller's own comment says the intent is that "the oscillation and the
// steering share the joint rather than one erasing the other" — this measures
// whether that is what happens.
//
// If the gait collapses as the bias rises, then session 9's finding is sharper
// than it was stated: steering is not merely "downstream of gait coherence",
// steering DESTROYS the gait, and a creature at full steering authority is a
// bent stick with no thrust to aim.
import RAPIER from '@dimforge/rapier3d-compat';
import { rngFrom } from '../trunk/rng.js';
import { createRandomGenome } from '../engine/l1/factory.js';
import { morphogenesis } from '../engine/l1/morphogen.js';
import { createSimulation, FIXED_DT, swingTwistAngle } from '../engine/l1/physics.js';
import { computePhases, targetAngles, makeControl, TURN_AUTHORITY, DRIVE } from '../engine/l1/controller.js';
import { qrot, normalise } from '../engine/l1/vecmath.js';
import W1_SLICE from '../worlds/w1_slice.js';
await RAPIER.init();

const MODE = process.argv[2] || 'pd';
const FREQ = process.argv[3] ? Number(process.argv[3]) : null;
const N = Number(process.argv[4] ?? 30);
const SETTLE = 2, MEASURE = 10;
const W = { ...W1_SLICE, gravity: 0 };
const pct = (a, q) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.max(0, Math.round((s.length - 1) * q))] : NaN; };
const axisAtSpawn = (j, plan) =>
  normalise(qrot(plan.bodies[j.parentBody].rotation, j.type === 'twist' ? j.axes.z : j.axes.x));

const corpus = [];
for (let i = 0; corpus.length < N && i < N * 10; i++) {
  const g = createRandomGenome(rngFrom(0xB1A5 ^ (i * 2654435761)));
  let p; try { p = morphogenesis(g); } catch { continue; }
  if (p.jointCount >= 1) corpus.push({ g, p });
}

function trial(plan, genome, turnBias) {
  let sim;
  try {
    sim = createSimulation(RAPIER, plan, genome, W,
      { drive: DRIVE.POSITION, bounded: false, motor: MODE, motorFreqHz: FREQ, turnBias });
  } catch { return null; }
  const phases = computePhases(plan);
  const control = makeControl(plan, { turnBias });
  const n = plan.jointCount;
  const axes = plan.joints.map((j) => axisAtSpawn(j, plan));
  const si = new Float64Array(n), co = new Float64Array(n);
  let clipped = 0, total = 0, k = 0, bad = false;
  const nSettle = Math.round(SETTLE / FIXED_DT), nTotal = Math.round((SETTLE + MEASURE) / FIXED_DT);
  const c0 = sim.centreOfMass(); let prev = c0, path = 0;
  try {
    for (let s = 0; s < nTotal; s++) {
      sim.step();
      const c = sim.centreOfMass();
      if (!Number.isFinite(c[0] + c[1] + c[2])) { bad = true; break; }
      if (s >= nSettle) { path += Math.hypot(c[0] - prev[0], c[1] - prev[1], c[2] - prev[2]); }
      prev = c;
      if (s < nSettle) continue;
      const t = s * FIXED_DT;
      const tgt = targetAngles(plan, genome, t, phases, undefined, control);
      for (let i = 0; i < n; i++) {
        const j = plan.joints[i];
        if (j.type === 'rigid') continue;
        total++;
        if (Math.abs(tgt[i]) > j.angleLimits[0]) clipped++;
        const a = swingTwistAngle(sim.bodies[j.parentBody].rotation(), sim.bodies[j.childBody].rotation(), axes[i]);
        if (!Number.isFinite(a)) { bad = true; break; }
        const g = genome.controller.jointGenes[j.nodeId];
        const arg = g.freqMult * genome.controller.omega * t + phases[i];
        si[i] += a * Math.sin(arg); co[i] += a * Math.cos(arg);
      }
      if (bad) break;
      k++;
    }
  } catch { bad = true; }
  const c1 = sim.centreOfMass(); sim.free();
  if (bad || k === 0) return null;
  const gains = [];
  for (let i = 0; i < n; i++) {
    const j = plan.joints[i];
    if (j.type === 'rigid') continue;
    const g = genome.controller.jointGenes[j.nodeId];
    const cmdAmp = Math.abs(g.amplitude * j.angleLimits[0]);
    if (cmdAmp < 1e-3) continue;
    gains.push(Math.hypot(2 * si[i] / k, 2 * co[i] / k) / cmdAmp);
  }
  const net = Math.hypot(c1[0] - c0[0], c1[1] - c0[1], c1[2] - c0[2]);
  return {
    clip: total ? clipped / total : 0,
    gain: gains.length ? pct(gains, 0.5) : NaN,
    com: path / MEASURE,
    net: net / (SETTLE + MEASURE),
    eff: net / Math.max(path, 1e-9),
  };
}

console.log(`\nmotor='${MODE}' freqHz=${FREQ ?? 'budget-derived'}  TURN_AUTHORITY=${TURN_AUTHORITY}  n<=${corpus.length}`);
console.log(`\n  turnBias   clipped%   gait gain   CoM path m/s   net m/s   efficiency`);
for (const tb of [0, 0.1, 0.25, 0.5, 1.0]) {
  const rs = [];
  for (const { g, p } of corpus) { const r = trial(p, g, tb); if (r) rs.push(r); }
  if (!rs.length) { console.log(`  ${String(tb).padStart(6)}   (all diverged)`); continue; }
  const m = (f) => pct(rs.map(f), 0.5);
  console.log(`  ${String(tb).padStart(6)}     ${(100 * m(r => r.clip)).toFixed(0).padStart(5)}      ${m(r => r.gain).toFixed(3).padStart(6)}       ${m(r => r.com).toFixed(3).padStart(7)}     ${m(r => r.net).toFixed(4).padStart(7)}     ${m(r => r.eff).toFixed(3)}`);
}
console.log(`\n  "clipped%" is the fraction of joint-steps whose COMMANDED angle lies`);
console.log(`  outside the joint's own limit. "gait gain" is the median achieved`);
console.log(`  oscillation amplitude over the commanded one (lock-in, joint's own axis).\n`);
