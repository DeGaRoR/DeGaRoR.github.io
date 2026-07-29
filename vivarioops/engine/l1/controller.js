// engine/l1/controller.js — the CPG (10 §A7).
//
// PURE: a function of (bodyPlan, genome, t). No rng, no clock — `t` is passed in
// as simulation time, so a controller state is reproducible from the tick index.
//
// Sims used evolved neural networks. They work and they produce twitchy motion.
// Coupled oscillators produce undulation, gait and travelling waves at a fraction
// of the complexity, which is the whole reason this is a CPG.

/**
 * PHASE PROPAGATION — the one detail that decides whether creatures look alive.
 *
 * A child joint's phase is its PARENT JOINT's phase plus a genetic lag, so a
 * chain of segments with a consistent lag produces a TRAVELLING WAVE: an eel
 * swimming, a centipede's metachronal gait, a ray's fin ripple. Independent
 * per-joint phases produce noise that reads as convulsion.
 *
 * Joints attached to the root body have phase 0 (10 §A7: "root joint phase = 0");
 * their own phaseLag is what their children inherit, not what they use.
 *
 * @returns {Float64Array} phase per joint, indexed by joint.index
 */
export function computePhases(plan) {
  const phases = new Float64Array(plan.jointCount);
  // Joint feeding each body, so a joint can find its parent joint.
  const jointOfBody = new Int32Array(plan.bodyCount).fill(-1);
  for (const j of plan.joints) jointOfBody[j.childBody] = j.index;

  // plan.joints is already in breadth-first order, so a parent joint is always
  // resolved before its children. No sort, no second pass.
  for (const j of plan.joints) {
    const parentJoint = jointOfBody[j.parentBody];
    phases[j.index] = parentJoint < 0 ? 0 : phases[parentJoint] + plan.joints[parentJoint].phaseLag;
  }
  return phases;
}

/** The driven angular range of a joint, per driven axis. */
export function jointRange(plan, jointIndex, axis = 0) {
  return plan.joints[jointIndex].angleLimits[axis];
}

/**
 * Target angle for every joint at simulation time `t`.
 *
 *   theta_j(t) = bias_j + amplitude_j * limitRange_j
 *                * sin(freqMult_j * omega * t + phase_j)
 *
 * @param {object} plan
 * @param {object} genome
 * @param {number} t seconds
 * @param {Float64Array} phases from computePhases()
 * @param {Float64Array} [out] reused across ticks — no allocation in the loop (N4)
 */
export function targetAngles(plan, genome, t, phases, out) {
  const n = plan.jointCount;
  const dst = out && out.length === n ? out : new Float64Array(n);
  const omega = genome.controller.omega;
  for (let i = 0; i < n; i++) {
    const j = plan.joints[i];
    const g = genome.controller.jointGenes[j.nodeId];
    const range = j.angleLimits[0];
    dst[i] = g.bias + g.amplitude * range * Math.sin(g.freqMult * omega * t + phases[i]);
  }
  return dst;
}

/**
 * Target angular VELOCITY, for the velocity-motor drive mode.
 *
 * 10 §A7 and 30 §4 both flag velocity motors as the fallback if position targets
 * look convulsive: driving joint velocity directly is often more stable than
 * chasing a position target, and is cheaper. Built now rather than after B3
 * fails, so the comparison is a switch instead of a rewrite.
 */
export function targetVelocities(plan, genome, t, phases, out) {
  const n = plan.jointCount;
  const dst = out && out.length === n ? out : new Float64Array(n);
  const omega = genome.controller.omega;
  for (let i = 0; i < n; i++) {
    const j = plan.joints[i];
    const g = genome.controller.jointGenes[j.nodeId];
    dst[i] = g.amplitude * j.angleLimits[0] * g.freqMult * omega
           * Math.cos(g.freqMult * omega * t + phases[i]);
  }
  return dst;
}

export const DRIVE = { POSITION: 'position', VELOCITY: 'velocity' };
