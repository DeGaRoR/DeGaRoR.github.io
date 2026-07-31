// THE TRAVELLING WAVE, ON A BODY THAT CAN ACTUALLY CARRY ONE.
//
// tools/_seed.mjs builds its "serpent" with `parentFace: 0` (+X) on a limb whose
// attachment face is its own -Z (see makeJointData). Every self-connection is
// therefore a 90-degree turn: the chain is a STAIRCASE, and it self-intersects
// after three segments and is rejected by the OBB test. That, and not
// SLICE_LIMITS.maxRecursion, is why every "6-segment" design in session 8 was
// really 3+1 — the hand-written genome never goes through the factory, so
// maxRecursion was never in the path at all.
//
// Attach on the face the child grows out of (+Z, face 5) and the same slice
// builds a straight 13-segment 6.5 m chain with zero rejections.
//
// With that body available, sweep the phase lag against the actuator settings.
// A pi/2 travelling wave must beat unison on efficiency; that is a property of
// the fluid model, and it is the sharpest cheap check we have of it.
import RAPIER from '@dimforge/rapier3d-compat';
import { morphogenesis } from '../engine/l1/morphogen.js';
import { createSimulation, FIXED_DT, swingTwistAngle } from '../engine/l1/physics.js';
import { computePhases, DRIVE } from '../engine/l1/controller.js';
import { qrot, normalise } from '../engine/l1/vecmath.js';
import { GENOME_V } from '../contracts/versions.js';
import W1_SLICE from '../worlds/w1_slice.js';
await RAPIER.init();

const SEC = 15, STEPS = Math.round(SEC / FIXED_DT), W = { ...W1_SLICE, gravity: 0 };
const axisAtSpawn = (j, plan) =>
  normalise(qrot(plan.bodies[j.parentBody].rotation, j.type === 'twist' ? j.axes.z : j.axes.x));

/** A straight chain: self-connected on +Z, the face the child grows out of. */
function serpent({ segs = 12, dims = [0.5, 0.35, 1.2], taper = 0.95,
                   lag = Math.PI / 2, amp = 0.8, omega = 2.0, face = 5 } = {}) {
  return {
    version: GENOME_V, seed: 0, rootNodeId: 'seg',
    nodes: [{
      id: 'seg', dims, density: 1, recursiveLimit: segs,
      joint: { type: 'revolute', angleLimits: [0.9, 0.9, 0.9], phaseLag: lag },
      colorGenes: { hueShift: 0.5, valueShift: 0, patternPhase: 0 },
    }],
    connections: [{
      id: 'c_self', parentNodeId: 'seg', childNodeId: 'seg', parentFace: face,
      position: [0, 0], orientation: [0, 0, 0], scale: [taper, taper, taper],
      reflectX: false, reflectY: false, reflectZ: false, terminalOnly: false,
    }],
    material: { hueShift: 0.5, valueShift: 0, patternPhase: 0 },
    controller: { omega, preyGain: 0, threatGain: 0, jointGenes: { seg: { amplitude: amp, bias: 0, freqMult: 1 } } },
    social: {},
  };
}

function trial(genome, opts) {
  let plan; try { plan = morphogenesis(genome); } catch (e) { return { err: e.message }; }
  let sim;
  try { sim = createSimulation(RAPIER, plan, genome, W, { drive: DRIVE.POSITION, bounded: false, ...opts }); }
  catch (e) { return { err: e.message }; }
  const phases = computePhases(plan);
  const n = plan.jointCount;
  const axes = plan.joints.map((j) => axisAtSpawn(j, plan));
  const si = new Float64Array(n), co = new Float64Array(n);
  const c0 = sim.centreOfMass(); let prev = c0, path = 0, bad = false, k = 0;
  const settle = Math.round(3 / FIXED_DT);
  try {
    for (let s = 0; s < STEPS; s++) {
      sim.step();
      const c = sim.centreOfMass();
      if (!Number.isFinite(c[0] + c[1] + c[2])) { bad = true; break; }
      path += Math.hypot(c[0] - prev[0], c[1] - prev[1], c[2] - prev[2]); prev = c;
      if (s < settle) continue;
      const t = s * FIXED_DT;
      for (let i = 0; i < n; i++) {
        const j = plan.joints[i];
        const a = swingTwistAngle(sim.bodies[j.parentBody].rotation(), sim.bodies[j.childBody].rotation(), axes[i]);
        if (!Number.isFinite(a)) { bad = true; break; }
        const arg = genome.controller.omega * t + phases[i];
        si[i] += a * Math.sin(arg); co[i] += a * Math.cos(arg);
      }
      if (bad) break;
      k++;
    }
  } catch { bad = true; }
  const c1 = sim.centreOfMass(); const work = sim.work; sim.free();
  if (bad) return { err: 'diverged' };
  // Achieved inter-joint lag: the phase step actually realised down the chain.
  const ph = [];
  for (let i = 0; i < n; i++) ph.push(Math.atan2(-2 * co[i] / k, 2 * si[i] / k));
  const steps = [];
  for (let i = 1; i < ph.length; i++) {
    let d = ph[i] - ph[i - 1];
    while (d > Math.PI) d -= 2 * Math.PI;
    while (d < -Math.PI) d += 2 * Math.PI;
    steps.push(d * 180 / Math.PI);
  }
  const mean = steps.length ? steps.reduce((a, b) => a + b, 0) / steps.length : NaN;
  const sd = steps.length ? Math.sqrt(steps.reduce((a, b) => a + (b - mean) ** 2, 0) / steps.length) : NaN;
  const net = Math.hypot(c1[0] - c0[0], c1[1] - c0[1], c1[2] - c0[2]);
  return {
    bodies: plan.bodyCount, net: net / SEC, com: path / SEC,
    eff: net / Math.max(path, 1e-9), work, lagMean: mean, lagSd: sd,
  };
}

const CONFIGS = [
  ['pd (shipped)', { motor: 'pd' }],
  ['solver, budget gains', { motor: 'solver' }],
  ['solver, 10 Hz zeta 0.9', { motor: 'solver', motorFreqHz: 10 }],
  ['solver, 25 Hz zeta 0.9', { motor: 'solver', motorFreqHz: 25 }],
];
const LAGS = [['unison  0 ', 0], ['pi/4     ', Math.PI / 4], ['pi/2     ', Math.PI / 2],
               ['3pi/4    ', 3 * Math.PI / 4], ['pi       ', Math.PI]];

for (const [label, opts] of CONFIGS) {
  console.log(`\n=== ${label} ===`);
  console.log('  lag        bodies   net m/s   CoM m/s     eff    achieved inter-joint lag');
  let unison = null;
  for (const [lname, lag] of LAGS) {
    const r = trial(serpent({ lag }), opts);
    if (r.err) { console.log(`  ${lname}  ERROR ${r.err}`); continue; }
    if (lag === 0) unison = r.eff;
    console.log(`  ${lname}   ${String(r.bodies).padStart(4)}   ${r.net.toFixed(4).padStart(7)}   ${r.com.toFixed(3).padStart(7)}   ${r.eff.toFixed(3).padStart(6)}    ${r.lagMean.toFixed(0).padStart(5)} +/- ${r.lagSd.toFixed(0)} deg`);
  }
  const half = trial(serpent({ lag: Math.PI / 2 }), opts);
  if (!half.err && unison) console.log(`  --> pi/2 beats unison on efficiency by ${(half.eff / unison).toFixed(2)}x`);
}
console.log('');
