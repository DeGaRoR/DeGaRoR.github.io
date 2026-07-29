// engine/l1/vecmath.js — the minimum vector and quaternion algebra morphogenesis
// needs. Pure, allocation-light, no dependencies.
//
// CONVENTION (01 §7): Y is up, RIGHT-HANDED. Forward is +Z. This matches the
// reference implementation's QuaternionHelper, which is explicitly right-handed
// with +Z forward and +Y up — so the placement math transfers without a
// handedness fix-up. Unity's own left-handed LookRotation would NOT transfer.

export const v3 = (x = 0, y = 0, z = 0) => [x, y, z];

export const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const scale = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
export const neg = (a) => [-a[0], -a[1], -a[2]];
export const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
export const len = (a) => Math.hypot(a[0], a[1], a[2]);
export function normalise(a) {
  const l = len(a);
  return l > 1e-12 ? [a[0] / l, a[1] / l, a[2] / l] : [0, 0, 0];
}

// Quaternions as [x, y, z, w].

export const QID = [0, 0, 0, 1];

/** Right-hand rule rotation of `radians` about `axis`. */
export function fromAxisAngle(radians, axis) {
  const n = normalise(axis);
  const h = radians * 0.5;
  const s = Math.sin(h);
  return [n[0] * s, n[1] * s, n[2] * s, Math.cos(h)];
}

/** Hamilton product. `qmul(a, b)` applies b first, then a. */
export function qmul(a, b) {
  const [ax, ay, az, aw] = a, [bx, by, bz, bw] = b;
  return [
    ax * bw + bx * aw + (ay * bz - az * by),
    ay * bw + by * aw + (az * bx - ax * bz),
    az * bw + bz * aw + (ax * by - ay * bx),
    aw * bw - (ax * bx + ay * by + az * bz),
  ];
}

export function qnormalise(q) {
  const l = Math.hypot(q[0], q[1], q[2], q[3]);
  return l > 1e-12 ? [q[0] / l, q[1] / l, q[2] / l, q[3] / l] : QID.slice();
}

/** Rotate a vector by a quaternion. */
export function qrot(q, v) {
  const [x, y, z, w] = q;
  const t = cross([x, y, z], v);
  const t2 = [t[0] * 2, t[1] * 2, t[2] * 2];
  return [
    v[0] + w * t2[0] + (y * t2[2] - z * t2[1]),
    v[1] + w * t2[1] + (z * t2[0] - x * t2[2]),
    v[2] + w * t2[2] + (x * t2[1] - y * t2[0]),
  ];
}

/**
 * Rotation putting +Z along `forward` and +Y as close as possible to `up`.
 * Right-handed: right = normalise(up x forward).
 */
export function lookRotation(forward, up) {
  const f = normalise(forward);
  const r = normalise(cross(up, f));
  const u = cross(f, r);
  return fromBasis(r, u, f);
}

/** Quaternion from an orthonormal basis given as three row vectors. */
export function fromBasis(r, u, f) {
  const m11 = r[0], m12 = r[1], m13 = r[2];
  const m21 = u[0], m22 = u[1], m23 = u[2];
  const m31 = f[0], m32 = f[1], m33 = f[2];
  const trace = m11 + m22 + m33;
  let x, y, z, w;
  if (trace > 0) {
    let s = Math.sqrt(trace + 1);
    w = s * 0.5; s = 0.5 / s;
    x = (m23 - m32) * s; y = (m31 - m13) * s; z = (m12 - m21) * s;
  } else if (m11 >= m22 && m11 >= m33) {
    const s = Math.sqrt(1 + m11 - m22 - m33), inv = 0.5 / s;
    x = 0.5 * s; y = (m12 + m21) * inv; z = (m13 + m31) * inv; w = (m23 - m32) * inv;
  } else if (m22 > m33) {
    const s = Math.sqrt(1 + m22 - m11 - m33), inv = 0.5 / s;
    x = (m21 + m12) * inv; y = 0.5 * s; z = (m32 + m23) * inv; w = (m31 - m13) * inv;
  } else {
    const s = Math.sqrt(1 + m33 - m11 - m22), inv = 0.5 / s;
    x = (m31 + m13) * inv; y = (m32 + m23) * inv; z = 0.5 * s; w = (m12 - m21) * inv;
  }
  return qnormalise([x, y, z, w]);
}

/** Signed volume of the basis — negative means left-handed. */
export const handedness = (r, u, f) => dot(cross(r, u), f);
