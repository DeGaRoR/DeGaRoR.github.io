// PER-JOINT TRANSFER FUNCTION: does the body reproduce the gait the controller
// commands, in AMPLITUDE and in PHASE?
//
// Undulatory thrust is a property of the PHASE RELATIONSHIP between adjacent
// joints. Session 8 measured that a pi/2 travelling wave beats unison 3.3x on
// efficiency. That is a statement about the COMMAND. It is only a statement
// about the CREATURE if each joint reproduces its command with the same gain
// and the same phase lag. If the lag varies joint to joint, the commanded wave
// arrives at the body scrambled, and no amount of controller design fixes it.
//
// Method: lock-in (quadrature) detection. For each joint, correlate the achieved
// angle against sin and cos of that joint's own commanded frequency, over an
// integer number of periods after a settle. That gives amplitude and phase
// without differentiating a noisy signal.
//
//   gain  = |achieved| / |commanded|      1.0 = perfect tracking
//   lag   = arg(achieved) - arg(commanded)  radians, positive = behind
//
// AXIS NOTE, and it matters: tools/_track.mjs and tools/_amp.mjs both read
// `j.axisLocal ?? [1,0,0]`. There is no `axisLocal` field anywhere in the
// engine, so both have always measured the angle about the parent body's X axis
// rather than about the joint's axis. This recomputes the axis the way
// physics.js does (jointAxisAtSpawn, which is not exported).
import RAPIER from '@dimforge/rapier3d-compat';
import { rngFrom } from '../trunk/rng.js';
import { createRandomGenome } from '../engine/l1/factory.js';
import { morphogenesis } from '../engine/l1/morphogen.js';
import { createSimulation, FIXED_DT, swingTwistAngle } from '../engine/l1/physics.js';
import { computePhases, DRIVE } from '../engine/l1/controller.js';
import { qrot, normalise } from '../engine/l1/vecmath.js';
import W1_SLICE from '../worlds/w1_slice.js';
await RAPIER.init();

const MODE = process.argv[2] || 'pd';
const N = Number(process.argv[3] ?? 40);
const FREQ = process.argv[4] ? Number(process.argv[4]) : null;
const SETTLE = 3, MEASURE = 12;
const W = { ...W1_SLICE, gravity: 0 };
const pct = (a, q) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.max(0, Math.round((s.length - 1) * q))] : NaN; };

/** physics.js jointAxisAtSpawn, replicated — it is not exported. */
const axisAtSpawn = (j, plan) =>
  normalise(qrot(plan.bodies[j.parentBody].rotation, j.type === 'twist' ? j.axes.z : j.axes.x));

function measure(plan, genome) {
  let sim;
  try { sim = createSimulation(RAPIER, plan, genome, W, { drive: DRIVE.POSITION, bounded: false, motor: MODE, motorFreqHz: FREQ }); }
  catch { return null; }
  const phases = computePhases(plan);
  const n = plan.jointCount;
  const axes = plan.joints.map((j) => axisAtSpawn(j, plan));
  const solverSeen = new Set();
  if (MODE === 'solver') plan.joints.forEach((j, i) => { if (sim.joints[i].configureMotorPosition) solverSeen.add(i); });
  const si = new Float64Array(n), co = new Float64Array(n), dc = new Float64Array(n);
  let k = 0, bad = false;
  const nSettle = Math.round(SETTLE / FIXED_DT), nTotal = Math.round((SETTLE + MEASURE) / FIXED_DT);
  try {
    for (let s = 0; s < nTotal; s++) {
      sim.step();
      if (s < nSettle) continue;
      const t = s * FIXED_DT;
      for (let i = 0; i < n; i++) {
        const j = plan.joints[i];
        const a = swingTwistAngle(sim.bodies[j.parentBody].rotation(), sim.bodies[j.childBody].rotation(), axes[i]);
        if (!Number.isFinite(a)) { bad = true; break; }
        const g = genome.controller.jointGenes[j.nodeId];
        const arg = g.freqMult * genome.controller.omega * t + phases[i];
        si[i] += a * Math.sin(arg); co[i] += a * Math.cos(arg); dc[i] += a;
      }
      if (bad) break;
      k++;
    }
  } catch { bad = true; }
  sim.free();
  if (bad || k === 0) return null;
  const out = [];
  for (let i = 0; i < n; i++) {
    const j = plan.joints[i];
    if (j.type === 'rigid') continue;
    const g = genome.controller.jointGenes[j.nodeId];
    // commanded: theta = bias + amp*range*sin(arg). Lock-in of that gives
    // in-phase = amp*range/2, quadrature 0.
    const cmdAmp = Math.abs(g.amplitude * j.angleLimits[0]);
    if (cmdAmp < 1e-3) continue;
    const I = 2 * si[i] / k, Q = 2 * co[i] / k;   // achieved sin/cos components
    out.push({
      type: j.type,
      solverDriven: solverSeen.has(i),
      overrun: (Math.abs(g.bias) + cmdAmp) / j.angleLimits[0],
      gain: Math.hypot(I, Q) / cmdAmp,
      lag: Math.atan2(-Q, I),                     // 0 = in phase, +ve = behind
      bias: dc[i] / k,
    });
  }
  return out;
}

const rows = [];
for (let i = 0; rows.length < N * 3 && i < N * 10; i++) {
  const g = createRandomGenome(rngFrom(0xB0DE ^ (i * 2654435761)));
  let p; try { p = morphogenesis(g); } catch { continue; }
  if (p.jointCount < 1) continue;
  const r = measure(p, g);
  if (r) rows.push(...r);
}

const gains = rows.map(r => r.gain);
const lags = rows.map(r => Math.abs(r.lag) * 180 / Math.PI);
console.log(`\nmotor='${MODE}' freqHz=${FREQ ?? 'budget-derived'}  n=${rows.length} joints  ${MEASURE}s measured after ${SETTLE}s settle\n`);
console.log(`  TRACKING GAIN  |achieved|/|commanded|`);
console.log(`    p05 ${pct(gains,0.05).toFixed(3)}   p25 ${pct(gains,0.25).toFixed(3)}   p50 ${pct(gains,0.5).toFixed(3)}   p75 ${pct(gains,0.75).toFixed(3)}   p95 ${pct(gains,0.95).toFixed(3)}`);
console.log(`    within 20% of 1.0: ${(100*gains.filter(g=>g>0.8&&g<1.2).length/gains.length).toFixed(0)}%   under 0.5: ${(100*gains.filter(g=>g<0.5).length/gains.length).toFixed(0)}%`);
console.log(`\n  PHASE LAG  degrees behind the command`);
console.log(`    p05 ${pct(lags,0.05).toFixed(0)}   p25 ${pct(lags,0.25).toFixed(0)}   p50 ${pct(lags,0.5).toFixed(0)}   p75 ${pct(lags,0.75).toFixed(0)}   p95 ${pct(lags,0.95).toFixed(0)}`);
console.log(`    SPREAD p95-p05 = ${(pct(lags,0.95)-pct(lags,0.05)).toFixed(0)} deg`);

const grp = (label, sel) => {
  const g = rows.filter(sel);
  if (!g.length) return;
  const gg = g.map(r => r.gain), ll = g.map(r => Math.abs(r.lag) * 180 / Math.PI);
  console.log(`  ${label.padEnd(30)} n=${String(g.length).padStart(3)}  gain p50 ${pct(gg,0.5).toFixed(2)} p95 ${pct(gg,0.95).toFixed(2)}   lag p50 ${pct(ll,0.5).toFixed(0)} p95 ${pct(ll,0.95).toFixed(0)}`);
};
console.log('\n  BY JOINT TYPE / DRIVE PATH');
grp('solver-driven', r => r.solverDriven);
grp('PD fallback (spherical etc)', r => !r.solverDriven);
for (const t of ['revolute','twist','spherical']) grp(`  type ${t}`, r => r.type === t);
console.log('\n  BY COMMAND OVERRUN  (|bias|+amp*range)/range; >1 means the command');
console.log('  is outside the joint limit for part of every cycle');
grp('overrun <= 1.0', r => r.overrun <= 1.0);
grp('overrun 1.0 - 1.5', r => r.overrun > 1.0 && r.overrun <= 1.5);
grp('overrun > 1.5', r => r.overrun > 1.5);
console.log(`\n  A commanded pi/2 (90 deg) travelling wave survives only if this spread`);
console.log(`  is small compared with 90 deg.\n`);
