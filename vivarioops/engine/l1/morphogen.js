// engine/l1/morphogen.js — Genome -> BodyPlan (10 §A6, contract C1).
//
// PURE and DETERMINISTIC (N6). No rng: the genome fully determines the body.
//
// PORTED, not derived (P5). The algorithm follows `LimbCreator.cs` from
// mycoolfin/the-simsulator @ bd428a1 (MIT, (c) 2024 Michael Finn), verified
// line by line. Three places where the working code differs from 10 §A6 are
// marked DIVERGENCE below; in each the reference is followed and the spec
// should be corrected.

import {
  add, scale, neg, dot, cross, normalise, qmul, qrot, qnormalise,
  fromAxisAngle, lookRotation, handedness,
} from './vecmath.js';
import { CAPS } from './genome.js';

// Face axis lookup, in parent-local space. Index order is
// 0:-X  1:-Y  2:-Z  3:+X  4:+Y  5:+Z  — as in the reference.
const FACE_RIGHT = [
  [0, 0, -1], [-1, 0, 0], [1, 0, 0], [0, 0, 1], [1, 0, 0], [-1, 0, 0],
];
const FACE_UP = [
  [0, 1, 0], [0, 0, 1], [0, 1, 0], [0, 1, 0], [0, 0, 1], [0, 1, 0],
];
const FACE_NORMAL = [
  [-1, 0, 0], [0, -1, 0], [0, 0, -1], [1, 0, 0], [0, 1, 0], [0, 0, 1],
];

/**
 * 10 §A6: variants double per enabled reflection axis. One connection with all
 * three set spawns eight limbs. This is where rich symmetry comes from, and it
 * is why the global symmetry gene was dropped.
 */
export function reflectionVariants(c) {
  let out = [[false, false, false]];
  if (c.reflectX) out = out.concat(out.map(([x, y, z]) => [!x, y, z]));
  if (c.reflectY) out = out.concat(out.map(([x, y, z]) => [x, !y, z]));
  if (c.reflectZ) out = out.concat(out.map(([x, y, z]) => [x, y, !z]));
  return out;
}

/**
 * @param {object} genome
 * @param {object} [opts] `{ maxBodies }` — defaults to the schema cap of 24
 * @returns {object} BodyPlan
 */
export function morphogenesis(genome, opts = {}) {
  const maxBodies = opts.maxBodies ?? CAPS.maxBodies;

  const nodeById = new Map(genome.nodes.map(n => [n.id, n]));
  const connByParent = new Map();
  for (const c of genome.connections) {
    if (!connByParent.has(c.parentNodeId)) connByParent.set(c.parentNodeId, []);
    connByParent.get(c.parentNodeId).push(c);
  }

  const bodies = [];
  const joints = [];
  let truncated = false;
  const rejected = { dimensions: 0, overlap: 0 };

  // ── root ──────────────────────────────────────────────────────────────────
  const rootNode = nodeById.get(genome.rootNodeId);
  if (!rootNode) throw new Error(`morphogenesis: rootNodeId ${genome.rootNodeId} is not a node`);

  bodies.push({
    index: 0,
    nodeId: rootNode.id,
    parent: -1,
    depth: 0,
    dims: rootNode.dims.slice(),
    density: rootNode.density,
    cumulativeScale: [1, 1, 1],
    position: [0, 0, 0],
    rotation: [0, 0, 0, 1],
    mirror: { right: false, up: false, forward: false },
    swapX: false,
  });

  // DIVERGENCE 1 — BREADTH-FIRST, not the depth-first recursion of 10 §A6's
  // pseudocode. It changes WHICH limbs survive truncation at the body cap:
  // breadth-first loses the deepest tips, depth-first loses whole later
  // branches, so a capped creature comes out as a complete shallow body rather
  // than one long tentacle and a stump. The reference uses a queue; so do we.
  const queue = [{
    node: rootNode,
    limbIndex: 0,
    depth: 0,
    mirror: { right: false, up: false, forward: false },
  }];

  while (queue.length) {
    const task = queue.shift();
    const parentBody = bodies[task.limbIndex];
    const limitReached = task.depth === task.node.recursiveLimit;

    for (const c of connByParent.get(task.node.id) || []) {
      // Terminal-only connections appear once recursion has bottomed out:
      // tails, hands, claws.
      if (c.terminalOnly && !limitReached) continue;

      const childNode = nodeById.get(c.childNodeId);
      if (!childNode) continue;

      // Depth is PER NODE TYPE, not global tree depth: it resets to 0 on moving
      // to a different node and increments only on self-reference.
      const newDepth = childNode.id === task.node.id ? task.depth + 1 : 0;
      if (newDepth > childNode.recursiveLimit) continue;

      const variants = reflectionVariants(c);

      // DIVERGENCE 2 — the reference SKIPS a connection that will not fit and
      // tries the next one; 10 §A6 says "stop". Skipping is better: an 8-variant
      // connection may not fit while a 1-variant one still would, and stopping
      // truncates by declaration order rather than by size.
      if (bodies.length + variants.length > maxBodies) { truncated = true; continue; }

      for (const [rx, ry, rz] of variants) {
        const mirror = {
          right: task.mirror.right !== rx,      // XOR, accumulated down the tree
          up: task.mirror.up !== ry,
          forward: task.mirror.forward !== rz,
        };
        const built = placeChild(parentBody, childNode, c, mirror);

        // Reject BEFORE adding, and do not enqueue the subtree. A rejected limb
        // takes its descendants with it, which is what bounds runaway scale
        // rather than merely clipping one body.
        if (outOfBounds(built.body.dims)) { rejected.dimensions++; continue; }

        const candidate = { dims: built.body.dims, position: built.body.position, rotation: built.body.rotation };
        let collides = false;
        for (const other of bodies) {
          if (other.index === parentBody.index) continue;   // face contact with the parent is normal
          if (obbOverlap(candidate, other)) { collides = true; break; }
        }
        if (collides) { rejected.overlap++; continue; }

        const childIndex = bodies.length;
        bodies.push({ index: childIndex, nodeId: childNode.id, parent: parentBody.index, depth: newDepth, ...built.body });
        joints.push({
          index: joints.length,
          parentBody: parentBody.index,
          childBody: childIndex,
          nodeId: childNode.id,
          connectionId: c.id,
          type: childNode.joint.type,
          angleLimits: childNode.joint.angleLimits.slice(),
          phaseLag: childNode.joint.phaseLag,
          ...built.joint,
        });
        queue.push({ node: childNode, limbIndex: childIndex, depth: newDepth, mirror });
      }
    }
  }

  resolvePhaseLags(joints, bodies.length, genome);

  return {
    genomeRoot: genome.rootNodeId,
    bodies, joints, truncated, rejected,
    bodyCount: bodies.length,
    jointCount: joints.length,
    dofCount: joints.reduce((n, j) => n + DOF[j.type], 0),
  };
}

/**
 * A3 — THE POSITIONAL PHASE GRADIENT, resolved here rather than in the controller.
 *
 * `lag_j = phaseBase + phaseSlope * depth(j) + deviation_j`
 *
 * WHY HERE. controller.js `computePhases` accumulates `plan.joints[].phaseLag`
 * along the tree and is called from several places with only the plan in hand.
 * Resolving the gradient at morphogenesis leaves that function, its signature and
 * every caller untouched — the plan simply arrives carrying lags that already
 * describe a wave.
 *
 * WHAT WAS WRONG. Each node drew its lag independently, so the increments along
 * a chain were a RANDOM WALK and the CPG was never asking for a coordinated wave
 * in the first place. A SPINE escaped this by accident: one node repeated is one
 * lag repeated, which is a constant increment, which is exactly a travelling
 * wave — which is why after A2 put chains in the corpus the spined creatures
 * measured 0.96-0.999 commanded coherence while branched bodies sat at 0.08-0.15.
 * `phaseBase` gives the branched ones the same constant increment on purpose.
 *
 * `depth(j)` is TREE depth — joints between j and the root — and deliberately not
 * `bodies[].depth`, which is per-node-type and resets whenever the chain moves to
 * a different node. A gradient that restarts at every limb is not a gradient.
 *
 * BIT-IDENTICAL WHEN NEUTRAL. Both coefficients zero leaves `lag = deviation`,
 * which is the pre-A3 value, so the early return is a statement of that and not
 * merely an optimisation: a migrated v2 genome does not take this path at all.
 */
function resolvePhaseLags(joints, bodyCount, genome) {
  const base = genome.controller?.phaseBase ?? 0;
  const slope = genome.controller?.phaseSlope ?? 0;
  if (base === 0 && slope === 0) return;

  const jointOfBody = new Int32Array(bodyCount).fill(-1);
  for (const j of joints) jointOfBody[j.childBody] = j.index;

  // joints is in breadth-first order, so a parent is always resolved first.
  const depth = new Int32Array(joints.length);
  for (const j of joints) {
    const pj = jointOfBody[j.parentBody];
    depth[j.index] = pj < 0 ? 0 : depth[pj] + 1;
    // WRAPPED, not clamped. The lag is an angle fed to sin(), so -1.1*PI and
    // 0.9*PI are the same command; clamping would instead saturate the gradient
    // and quietly flatten the wave on any body deep enough to reach the bound.
    j.phaseLag = wrapPi(base + slope * depth[j.index] + j.phaseLag);
  }
}

const TAU = Math.PI * 2;
const wrapPi = (a) => a - TAU * Math.floor((a + Math.PI) / TAU);

/** Degrees of freedom per joint type — 10 §A17.2. Used for Species.dofCount. */
export const DOF = {
  rigid: 0, revolute: 1, twist: 1, bendTwist: 2, twistBend: 2, universal: 2, spherical: 3,
};

/**
 * SPEC GAP — neither of these rules appears anywhere in 10 §A6, and both are
 * load-bearing for B2's checkpoint ("not broken, not degenerate, not a pile of
 * overlapping boxes"). Both are taken from the reference.
 *
 * MIN/MAX_LIMB_DIMENSION bounds runaway cumulative scale. `scale` is 0.5-2.0 and
 * CUMULATIVE, so a 24-body chain can reach 2^24. Measured without this rule over
 * 500 genomes: median bounding radius 3.93 m but a maximum of 33 km and a maximum
 * mass of 2.7 billion kg, with 245 of 500 creatures larger than the 16 m tank.
 * A limb outside the bounds is dropped ALONG WITH ITS ENTIRE SUBTREE, which is
 * what makes the bound effective rather than merely clamping one body.
 */
export const MIN_LIMB_DIMENSION = 0.05;
export const MAX_LIMB_DIMENSION = 10.0;

const outOfBounds = (d) =>
  d[0] < MIN_LIMB_DIMENSION || d[1] < MIN_LIMB_DIMENSION || d[2] < MIN_LIMB_DIMENSION ||
  d[0] > MAX_LIMB_DIMENSION || d[1] > MAX_LIMB_DIMENSION || d[2] > MAX_LIMB_DIMENSION;

/**
 * Separating-axis test for two oriented boxes. 15 axes: 3 from each box plus the
 * 9 pairwise cross products. A limb overlapping a NON-PARENT limb is rejected;
 * parent-child contact at the attachment face is normal and is excluded by the
 * caller.
 */
export function obbOverlap(a, b, epsilon = 1e-4) {
  const ax = [qrot(a.rotation, [1, 0, 0]), qrot(a.rotation, [0, 1, 0]), qrot(a.rotation, [0, 0, 1])];
  const bx = [qrot(b.rotation, [1, 0, 0]), qrot(b.rotation, [0, 1, 0]), qrot(b.rotation, [0, 0, 1])];
  const ae = [a.dims[0] * 0.5 - epsilon, a.dims[1] * 0.5 - epsilon, a.dims[2] * 0.5 - epsilon];
  const be = [b.dims[0] * 0.5 - epsilon, b.dims[1] * 0.5 - epsilon, b.dims[2] * 0.5 - epsilon];
  const t = [b.position[0] - a.position[0], b.position[1] - a.position[1], b.position[2] - a.position[2]];

  const axes = [];
  for (const v of ax) axes.push(v);
  for (const v of bx) axes.push(v);
  for (const u of ax) for (const v of bx) {
    const c = cross(u, v);
    if (c[0] * c[0] + c[1] * c[1] + c[2] * c[2] > 1e-12) axes.push(normalise(c));
  }

  for (const L of axes) {
    let ra = 0, rb = 0;
    for (let i = 0; i < 3; i++) ra += ae[i] * Math.abs(dot(ax[i], L));
    for (let i = 0; i < 3; i++) rb += be[i] * Math.abs(dot(bx[i], L));
    if (Math.abs(dot(t, L)) > ra + rb) return false;   // separating axis found
  }
  return true;
}

/**
 * Place one child limb on a parent face. This is the block the reference exists
 * to get right, and the three things that go wrong are all here.
 */
function placeChild(parentBody, childNode, c, mirror) {
  let faceRight = FACE_RIGHT[c.parentFace].slice();
  let faceUp = FACE_UP[c.parentFace].slice();
  let faceNormal = FACE_NORMAL[c.parentFace].slice();

  // If the parent is itself handedness-swapped, negate the X component of all
  // three axes before anything else (10 §A6 step 2).
  if (parentBody.swapX) {
    faceRight[0] = -faceRight[0];
    faceUp[0] = -faceUp[0];
    faceNormal[0] = -faceNormal[0];
  }
  if (mirror.right) faceRight = neg(faceRight);
  if (mirror.up) faceUp = neg(faceUp);
  if (mirror.forward) faceNormal = neg(faceNormal);

  // Cumulative scale: repeated multiplication down a recursive chain is what
  // produces tapering (10 §A6 step 7).
  const cumulativeScale = [
    parentBody.cumulativeScale[0] * c.scale[0],
    parentBody.cumulativeScale[1] * c.scale[1],
    parentBody.cumulativeScale[2] * c.scale[2],
  ];
  const dims = [
    childNode.dims[0] * cumulativeScale[0],
    childNode.dims[1] * cumulativeScale[1],
    childNode.dims[2] * cumulativeScale[2],
  ];

  const pHalf = [parentBody.dims[0] * 0.5, parentBody.dims[1] * 0.5, parentBody.dims[2] * 0.5];

  // DIVERGENCE 3 — 10 §A6 step 4 writes a SCALAR `halfExtent`:
  //     anchor = normal*halfExtent + right*halfExtent*u + up*halfExtent*v
  // The reference multiplies each COMPONENT by the corresponding parent half
  // extent. For a cube they agree; for anything else they do not, and node dims
  // are per-axis 0.2-2.0, so they essentially never agree. A scalar half extent
  // puts limbs off the surface of every non-cubic body.
  const anchor = [
    faceNormal[0] * pHalf[0] + faceRight[0] * pHalf[0] * c.position[0] + faceUp[0] * pHalf[0] * c.position[1],
    faceNormal[1] * pHalf[1] + faceRight[1] * pHalf[1] * c.position[0] + faceUp[1] * pHalf[1] * c.position[1],
    faceNormal[2] * pHalf[2] + faceRight[2] * pHalf[2] * c.position[0] + faceUp[2] * pHalf[2] * c.position[1],
  ];

  // PARITY (N20) — the bug everybody hits. An odd number of mirrorings flips
  // handedness; without the sign flip, mirrored limbs bend the WRONG WAY and the
  // creature looks subtly broken in a way that is very hard to trace.
  const parity = (mirror.right !== mirror.up) !== (mirror.forward !== parentBody.swapX) ? -1 : 1;

  let jointRotation = fromAxisAngle(c.orientation[2] * parity, faceNormal);
  jointRotation = qmul(jointRotation, fromAxisAngle(c.orientation[1] * parity, faceUp));
  jointRotation = qmul(jointRotation, fromAxisAngle(c.orientation[0] * parity, faceRight));

  const axisX = qrot(jointRotation, faceRight);
  const axisY = qrot(jointRotation, faceUp);
  const axisZ = qrot(jointRotation, faceNormal);

  const parentSpaceRotation = qnormalise(qmul(jointRotation, lookRotation(faceNormal, faceUp)));

  // The child attaches by its own -Z face. Fixed convention, never revisited.
  const halfDepth = Math.abs(dims[2]) * 0.5;
  const parentSpacePosition = add(anchor, qrot(parentSpaceRotation, [0, 0, halfDepth]));

  const position = add(parentBody.position, qrot(parentBody.rotation, parentSpacePosition));
  const rotation = qmul(parentBody.rotation, parentSpaceRotation);

  // Cross-sectional area for joint strength (N19). 10 §A6 names
  // parentFaceWidth/Height without saying how to obtain them; the reference
  // projects the parent half-extents onto the face axes, which is the answer.
  const parentFaceWidth = 2 * Math.abs(dot(faceRight, pHalf));
  const parentFaceHeight = 2 * Math.abs(dot(faceUp, pHalf));
  const minCrossSectionalArea = Math.min(parentFaceWidth * parentFaceHeight, dims[0] * dims[1]);

  // The child's own handedness, computed from the axes actually used rather
  // than accumulated as a boolean. Equivalent to the XOR chain (each mirror
  // negation flips the sign of the triple product) but derived from the
  // geometry, so the two can be cross-checked against each other.
  const swapX = handedness(faceRight, faceUp, faceNormal) > 0;

  return {
    body: { dims, density: childNode.density, cumulativeScale, position, rotation, mirror, swapX },
    joint: {
      anchor,
      axes: { x: axisX, y: axisY, z: axisZ },
      minCrossSectionalArea,
      parity,
      mirrorCount: (mirror.right ? 1 : 0) + (mirror.up ? 1 : 0) + (mirror.forward ? 1 : 0),
    },
  };
}

// ── derived quantities — S1 morphometrics reads these at C1 ─────────────────

/** Volume of the box proxies. Physics uses boxes; the render uses capsules. */
export function bodyVolume(b) { return b.dims[0] * b.dims[1] * b.dims[2]; }

export function totalVolume(plan) {
  let v = 0;
  for (const b of plan.bodies) v += bodyVolume(b);
  return v;
}

/** kg — density is relative to water, so mass is density x volume (01 §7). */
export function totalMass(plan) {
  let m = 0;
  for (const b of plan.bodies) m += b.density * bodyVolume(b);
  return m;
}

export function centreOfMass(plan) {
  let m = 0, c = [0, 0, 0];
  for (const b of plan.bodies) {
    const bm = b.density * bodyVolume(b);
    m += bm;
    c = add(c, scale(b.position, bm));
  }
  return m > 0 ? scale(c, 1 / m) : [0, 0, 0];
}

/** Max distance from the centre of mass to any body centre plus its half-diagonal. */
export function boundingRadius(plan) {
  const com = centreOfMass(plan);
  let r = 0;
  for (const b of plan.bodies) {
    const d = Math.hypot(b.position[0] - com[0], b.position[1] - com[1], b.position[2] - com[2]);
    r = Math.max(r, d + 0.5 * Math.hypot(b.dims[0], b.dims[1], b.dims[2]));
  }
  return r;
}
