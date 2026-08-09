// proto/skin/field.js — BodyPlan -> a scalar field whose zero set is ONE surface.
//
// PROTOTYPE. Nothing here is imported by the app. See proto/skin/README.md.
//
// The shipped renderer emits one mesh per body (render/creature.js:406), so a
// seven-body animal is seven detached capsules. This module says the same shapes
// a different way — as signed distances — because distances can be BLENDED and
// meshes cannot.
//
// Two things matter and they are the same thing:
//
//   1. The primitives are exactly the ones render/creature.js already draws.
//      `bodyGeo` derives a capsule radius as min(dims.x, dims.y) * 0.5 and falls
//      back to a scaled sphere when the body is not elongated. We repeat that
//      derivation rather than inventing a shape language, so the fused animal is
//      recognisably the same animal, and 10 §A10 ("capsules and ellipsoids only")
//      still holds.
//
//   2. The blend radius is GIRTH-RELATIVE, k = blendFactor * min(r_parent, r_child).
//      A constant radius is what turns a creature into a lava lamp: it fattens a
//      tentacle by the same absolute amount it fattens a torso, and the tentacle
//      disappears. Tied to girth, the same factor gives a big joint a big fillet
//      and a thin joint a thin one — the surface fuses, and the segmentation
//      survives. That is the whole difference between "soft constrictions" and
//      "blob".
//
// Skin weights come out of the same evaluation for free; see weightsAt().

/**
 * Polynomial smooth minimum. k is the blend radius in world units: outside k the
 * result is exactly min(a, b), so a body far from everything keeps its own shape
 * bit for bit and only the meeting region is touched.
 */
export function smin(a, b, k) {
  if (!(k > 0)) return Math.min(a, b);
  const h = Math.max(0, k - Math.abs(a - b)) / k;
  return Math.min(a, b) - h * h * k * 0.25;
}

/** Conjugate of a unit quaternion, which for unit length is its inverse. */
function qconj(q) { return [-q[0], -q[1], -q[2], q[3]]; }

/** Rotate v by quaternion q. Local copy: proto/ must not grow trunk imports it
 *  does not need, and this is four lines. */
function qrotv(q, v, out) {
  const [x, y, z, w] = q;
  const tx = 2 * (y * v[2] - z * v[1]);
  const ty = 2 * (z * v[0] - x * v[2]);
  const tz = 2 * (x * v[1] - y * v[0]);
  out[0] = v[0] + w * tx + (y * tz - z * ty);
  out[1] = v[1] + w * ty + (z * tx - x * tz);
  out[2] = v[2] + w * tz + (x * ty - y * tx);
  return out;
}

/**
 * Signed distance to a capsule of radius r whose straight section runs along
 * local Z from -hz to +hz.
 */
function sdCapsuleZ(px, py, pz, hz, r) {
  const qz = pz < -hz ? -hz : (pz > hz ? hz : pz);
  return Math.hypot(px, py, pz - qz) - r;
}

/**
 * Signed distance to an axis-aligned ellipsoid with semi-axes (ax, ay, az).
 * Quilez's k0/k1 form: not exact, but bounded and smooth, which is all marching
 * cubes and a gradient need.
 */
function sdEllipsoid(px, py, pz, ax, ay, az) {
  const k0 = Math.hypot(px / ax, py / ay, pz / az);
  if (k0 === 0) return -Math.min(ax, ay, az);
  const k1 = Math.hypot(px / (ax * ax), py / (ay * ay), pz / (az * az));
  return (k0 * (k0 - 1)) / k1;
}

/**
 * Per-body primitive, derived the same way render/creature.js:244 derives its
 * geometry. `blobby` there also forces an ellipsoid for vanes and bulbs; here the
 * elongation test alone is enough, because an ellipsoid and a fat capsule agree
 * to within the blend radius and nothing downstream cares which we picked.
 */
function primitiveFor(body) {
  const d = body.dims;
  const r = Math.min(d[0], d[1]) * 0.5;
  const straight = d[2] - 2 * r;
  if (straight > 0.5 * r) {
    return {
      kind: 'capsule',
      r,
      hz: straight * 0.5,
      sx: d[0] / (2 * r),
      sy: d[1] / (2 * r),
    };
  }
  return { kind: 'ellipsoid', ax: d[0] * 0.5, ay: d[1] * 0.5, az: d[2] * 0.5 };
}

/**
 * @param {object} plan            BodyPlan from morphogenesis()
 * @param {object} [opts]
 * @param {number} [opts.blendFactor=0.45]  fillet size as a fraction of the
 *                                          thinner of the two girths at a joint
 * @returns {object} field
 */
export function makeField(plan, opts = {}) {
  const blendFactor = opts.blendFactor ?? 0.45;
  // UNIFORM OUTWARD OFFSET. Subtracting a constant from a signed distance is an
  // offset surface, so this alone turns the field from "the animal" into "a
  // shell around the animal" — which is the third experiment's whole geometry.
  // It also fixes what killed the first: at any inflation worth looking at, no
  // feature is thin any more, so the sampling grid has nothing left to shred.
  const inflate = opts.inflate ?? 0;
  const n = plan.bodies.length;

  const prims = [];
  const pos = [];
  const invRot = [];
  const rChar = new Float64Array(n);   // girth radius as authored
  const rEff = new Float64Array(n);    // ...after the minimum-thickness floor
  const grow = new Float64Array(n);    // how far each primitive was inflated
  const kBlend = new Float64Array(n);  // blend radius against everything before it
  const tau = new Float64Array(n);     // influence falloff for skin weights

  for (let i = 0; i < n; i++) {
    const b = plan.bodies[i];
    prims.push(primitiveFor(b));
    pos.push(b.position);
    invRot.push(qconj(b.rotation));
    // Inflation counts as girth: it is what sets the grid spacing and the blend
    // radii, and a shell is a fatter thing than the animal inside it.
    rChar[i] = Math.min(b.dims[0], b.dims[1]) * 0.5 + inflate;
  }

  const girthRef = Math.max(...rChar);

  /**
   * MINIMUM THICKNESS — the one thing an implicit surface cannot do for free.
   *
   * A uniform grid resolves nothing thinner than about two cells, and the cell
   * size is set by the whole animal's extent. A vane 0.1 thick on a body 2 across
   * therefore either forces a grid nobody can afford or comes out ragged and
   * full of holes.
   *
   * So we inflate instead of failing: subtracting a constant from a signed
   * distance IS an offset surface, so any body thinner than the floor is grown to
   * it, exactly and smoothly, for three lines of arithmetic. A fin renders
   * slightly fatter than the capsule renderer draws it. That is a real and
   * visible cost, and it is the honest trade — the alternative is a fin with
   * holes in it.
   */
  function setMinRadius(rMin) {
    for (let i = 0; i < n; i++) {
      rEff[i] = Math.max(rChar[i], rMin);
      grow[i] = rEff[i] - rChar[i];
    }
    for (let i = 0; i < n; i++) {
      const p = plan.bodies[i].parent;
      // A body blends against the accumulated field using the THINNER of itself
      // and its parent, so a hair on a whale gets a hair-sized fillet.
      const pair = p >= 0 ? Math.min(rEff[p], rEff[i]) : rEff[i];
      kBlend[i] = blendFactor * pair;
      tau[i] = Math.max(1e-4, blendFactor * rEff[i]);
    }
  }
  setMinRadius(0);

  const local = [0, 0, 0];
  const rel = [0, 0, 0];
  const scratch = new Float64Array(n);

  /** Distance to body i alone. */
  function distanceTo(i, x, y, z) {
    rel[0] = x - pos[i][0]; rel[1] = y - pos[i][1]; rel[2] = z - pos[i][2];
    qrotv(invRot[i], rel, local);
    const pr = prims[i];
    if (pr.kind === 'capsule') {
      // Undo the anisotropic stretch, measure, then scale back by the SMALLEST
      // factor. That under-estimates the distance, which is the safe direction:
      // marching cubes needs the sign right and the magnitude bounded, and an
      // over-estimate is what makes a surface tunnel through a thin feature.
      const s = Math.min(pr.sx, pr.sy, 1);
      return sdCapsuleZ(local[0] / pr.sx, local[1] / pr.sy, local[2], pr.hz, pr.r) * s - grow[i] - inflate;
    }
    return sdEllipsoid(local[0], local[1], local[2], pr.ax, pr.ay, pr.az) - grow[i] - inflate;
  }

  /**
   * The fused field.
   *
   * FOLDED IN INDEX ORDER, which is meaningful: morphogenesis emits bodies
   * breadth-first and never assigns a child an index below its parent
   * (morphogen.js:140), so by the time body i is folded in, its parent is already
   * part of the accumulated surface and the fillet lands where the joint is.
   *
   * The approximation this accepts: the blend is against the accumulation, not
   * against the parent specifically. A limb folded back to touch an unrelated
   * body will soften against it too. Look for it under flex; only fix it if it
   * shows, because fixing it costs a second pass.
   */
  function eval3(x, y, z) {
    let d = distanceTo(0, x, y, z);
    for (let i = 1; i < n; i++) d = smin(d, distanceTo(i, x, y, z), kBlend[i]);
    return d;
  }

  /**
   * Skin weights, from the same distances that made the surface.
   *
   * w_i = exp(-(d_i - min d) / tau_i), normalised, top 4 kept. Deep inside a body
   * one weight is ~1; inside a fillet the weights cross over across exactly the
   * region the SURFACE crosses over, so the shape and its deformation are derived
   * from one thing and cannot disagree.
   *
   * Subtracting min d first is not cosmetic — d_i goes strongly negative inside a
   * body and the bare exponential overflows to Infinity there.
   */
  function weightsAt(x, y, z, outIdx, outW, at) {
    let dmin = Infinity;
    for (let i = 0; i < n; i++) {
      const d = distanceTo(i, x, y, z);
      scratch[i] = d;
      if (d < dmin) dmin = d;
    }
    // Top 4 by weight. n is <= 24 (CAPS.maxBodies), so a linear scan beats a sort.
    const bi = [-1, -1, -1, -1];
    const bw = [0, 0, 0, 0];
    for (let i = 0; i < n; i++) {
      const w = Math.exp(-(scratch[i] - dmin) / tau[i]);
      if (w <= bw[3]) continue;
      let s = 3;
      while (s > 0 && w > bw[s - 1]) { bw[s] = bw[s - 1]; bi[s] = bi[s - 1]; s--; }
      bw[s] = w; bi[s] = i;
    }
    let sum = bw[0] + bw[1] + bw[2] + bw[3];
    if (!(sum > 0)) { bi[0] = 0; bw[0] = 1; sum = 1; }
    const o = at * 4;
    for (let s = 0; s < 4; s++) {
      outIdx[o + s] = bi[s] < 0 ? 0 : bi[s];
      outW[o + s] = bi[s] < 0 ? 0 : bw[s] / sum;
    }
  }

  /**
   * World AABB of the rest pose, from the eight corners of every body's box.
   * Padded by the largest blend radius, because a fillet bulges OUTSIDE the union
   * of the primitives and a box that only just contains them clips it flat.
   */
  function bounds() {
    const lo = [Infinity, Infinity, Infinity];
    const hi = [-Infinity, -Infinity, -Infinity];
    const c = [0, 0, 0];
    const out = [0, 0, 0];
    for (let i = 0; i < n; i++) {
      const b = plan.bodies[i];
      const h = [b.dims[0] * 0.5, b.dims[1] * 0.5, b.dims[2] * 0.5];
      for (let s = 0; s < 8; s++) {
        c[0] = (s & 1 ? h[0] : -h[0]);
        c[1] = (s & 2 ? h[1] : -h[1]);
        c[2] = (s & 4 ? h[2] : -h[2]);
        qrotv(b.rotation, c, out);
        for (let a = 0; a < 3; a++) {
          const v = b.position[a] + out[a];
          if (v < lo[a]) lo[a] = v;
          if (v > hi[a]) hi[a] = v;
        }
      }
    }
    const pad = Math.max(...kBlend, girthRef * 0.15) + inflate;
    for (let a = 0; a < 3; a++) { lo[a] -= pad; hi[a] += pad; }
    return { lo, hi };
  }

  return {
    bodyCount: n,
    blendFactor,
    inflate,
    girthRef,
    rChar,
    rEff,
    kBlend,
    setMinRadius,
    eval: eval3,
    distanceTo,
    weightsAt,
    bounds,
  };
}
