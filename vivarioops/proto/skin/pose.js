// proto/skin/pose.js — a pose driver that is NOT the physics engine.
//
// PROTOTYPE. Nothing here is imported by the app.
//
// WHY FORWARD KINEMATICS AND NOT RAPIER. The question this prototype exists to
// answer is "does the skin hold together when the joints bend". Rapier answers it
// too, but only at the angles the solver happens to reach, only after a wasm boot
// and an arena, and never twice the same way. FK answers it deterministically, in
// no time at all, and — the reason that decides it — FK can be told to put EVERY
// joint at its own angle limit at once and hold it there. That configuration is
// where skinning breaks, and it is one a swimming animal may not visit for
// minutes.
//
// The joint frame comes straight out of morphogenesis (morphogen.js:370):
// `anchor` and `axes` are both in PARENT-LOCAL space, which is exactly the space
// a bend has to happen in. Bending about the anchor rather than about the child's
// centre is what keeps the two bodies in contact through the swing — rotate about
// the centre and the limb pulls out of its socket, which would look like a
// skinning failure and would not be one.
//
// Output is the shape physics.js readPose() returns — [{p:[x,y,z], q:[x,y,z,w]}]
// indexed by body index — so the same consumer drives either source.

import { qmul, qrot, fromAxisAngle, add, sub } from '../../engine/l1/vecmath.js';
import { computePhases, targetAngles } from '../../engine/l1/controller.js';

const qconj = (q) => [-q[0], -q[1], -q[2], q[3]];
const clamp = (v, lo, hi) => (v < lo ? lo : (v > hi ? hi : v));

/**
 * @param {object} plan
 * @param {object} genome
 */
export function makePoseDriver(plan, genome) {
  const n = plan.bodyCount;
  const phases = computePhases(plan);
  const angles = new Float64Array(plan.jointCount);

  // Joint feeding each body, and the child's rest transform in its parent's
  // frame. Both are constant for the life of the plan, so neither belongs in the
  // per-frame loop.
  const jointOfBody = new Int32Array(n).fill(-1);
  for (const j of plan.joints) jointOfBody[j.childBody] = j.index;

  const restLocalPos = [];
  const restLocalRot = [];
  for (let i = 0; i < n; i++) {
    const b = plan.bodies[i];
    if (b.parent < 0) { restLocalPos.push([0, 0, 0]); restLocalRot.push([0, 0, 0, 1]); continue; }
    const p = plan.bodies[b.parent];
    const ip = qconj(p.rotation);
    restLocalPos.push(qrot(ip, sub(b.position, p.position)));
    restLocalRot.push(qmul(ip, b.rotation));
  }

  const pose = Array.from({ length: n }, () => ({ p: [0, 0, 0], q: [0, 0, 0, 1] }));

  /**
   * @param {number} t        seconds
   * @param {object} [opts]
   * @param {number} [opts.drive=1]  gait amplitude multiplier; the commanded
   *        angle is still clamped to the joint's own limit, so this pushes a
   *        lazy gait to its extremes without inventing angles the body forbids
   * @param {number|null} [opts.hold=null]  -1..1: ignore the gait and pin every
   *        joint at that fraction of its own limit. The stress test.
   */
  function poseAt(t, opts = {}) {
    const drive = opts.drive ?? 1;
    const hold = opts.hold ?? null;

    if (hold === null) targetAngles(plan, genome, t, phases, angles);

    const root = plan.bodies[0];
    pose[0].p[0] = root.position[0]; pose[0].p[1] = root.position[1]; pose[0].p[2] = root.position[2];
    pose[0].q[0] = root.rotation[0]; pose[0].q[1] = root.rotation[1];
    pose[0].q[2] = root.rotation[2]; pose[0].q[3] = root.rotation[3];

    // One forward pass. morphogenesis is breadth-first and never gives a child an
    // index below its parent (morphogen.js:140), so the parent's world transform
    // is already final when the child is reached.
    for (let i = 1; i < n; i++) {
      const b = plan.bodies[i];
      const ji = jointOfBody[i];
      const j = plan.joints[ji];
      const range = j.angleLimits[0];

      const theta = hold === null
        ? clamp(angles[ji] * drive, -range, range)
        : range * hold;

      const bend = fromAxisAngle(theta, j.axes.x);
      const localPos = add(j.anchor, qrot(bend, sub(restLocalPos[i], j.anchor)));
      const localRot = qmul(bend, restLocalRot[i]);

      const P = pose[b.parent];
      const wp = add(P.p, qrot(P.q, localPos));
      const wq = qmul(P.q, localRot);
      pose[i].p[0] = wp[0]; pose[i].p[1] = wp[1]; pose[i].p[2] = wp[2];
      pose[i].q[0] = wq[0]; pose[i].q[1] = wq[1]; pose[i].q[2] = wq[2]; pose[i].q[3] = wq[3];
    }
    return pose;
  }

  return { poseAt, phases, jointOfBody };
}
