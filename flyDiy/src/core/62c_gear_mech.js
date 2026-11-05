// ===========================================================================
// GEAR_MECH - ONE KINEMATICS FOR A RETRACTING UNDERCARRIAGE (RETRACT GM3, futureDesigns/RETRACT-STUDY-2026-11.md
// §8.11; the user: "a proper 3D model and animation of these retractable gears ... WYSIWYG").
//
// Every moving part of a retracting gear is posed from the gear's position g (1 down .. 0 up) by THIS function - the
// garage's preview row, quickshot --gear and the flown aeroplane (app.js, through the capture's map) - so what the
// builder watches fold is what flies. Pure arithmetic, no THREE, no state.
//
// THE RECORD (the gear layer builds it, in its own frame, metres):
//   units: { L | R | T: a fold chain - { hinge, leg (unit axis), twist (rad), turns: [{ axis, ang }], frac } }
//   knees: { id: { s: P, l: P, a, b, bend: P } }   a two-link brace: from s to l, links a and b, the knee on bend's side
//   parts: [{ name, rule: 'rigid', unit }                       turns with its unit about the hinge (leg, wheel, castor)
//           { name, rule: 'door', hinge, axis, ang, seq, o0 }  G6: a well door on its hinge (gearDoorOpen)
//           { name, rule: 'aim', from: P, to: P, o0, d0 }]      its base on `from`, its axis toward `to` (a cylinder's
//                                                               body, its rod, a brace's link): o0 / d0 its rest base
//                                                               and axis (at g = 1 the part is where it was drawn)
//   a point P: { fix: [x, y, z] } (the structure) | { unit, p } (rides the unit, p its rest place) | { knee: id }
// THE POSE: name -> [r00, r01, r02, tx, r10, r11, r12, ty, r20, r21, r22, tz] (row-major 3 x 4), the rest at g = 1 the
// identity.
// ===========================================================================

// the axis-angle rotation, 3 x 3 row-major
function gearRot(k, a) {
  const c = Math.cos(a), s = Math.sin(a), C = 1 - c, x = k[0], y = k[1], z = k[2];
  return [c + x * x * C, x * y * C - z * s, x * z * C + y * s, y * x * C + z * s, c + y * y * C, y * z * C - x * s,
          z * x * C - y * s, z * y * C + x * s, c + z * z * C];
}
function gearMul(A, B) {
  const o = new Array(9);
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) o[i * 3 + j] = A[i * 3] * B[j] + A[i * 3 + 1] * B[3 + j] + A[i * 3 + 2] * B[6 + j];
  return o;
}
const gearApp = (M, v) => [M[0] * v[0] + M[1] * v[1] + M[2] * v[2], M[3] * v[0] + M[4] * v[1] + M[5] * v[2], M[6] * v[0] + M[7] * v[1] + M[8] * v[2]];
// THE FOLD (G1's chain): s = (1 - g) x frac walks it - the wheel's twist about its leg across all of it, the turns one
// after the other - and the 3 x 3 the unit turns by about its hinge
function gearFoldPose(C, g) {
  const s = Math.max(0, Math.min(1, 1 - g)) * (C.frac == null ? 1 : C.frac), n = C.turns.length;
  let M = gearRot(C.leg, (C.twist || 0) * s);
  C.turns.forEach((T, k) => { M = gearMul(gearRot(T.axis, T.ang * Math.max(0, Math.min(1, s * n - k))), M); });
  return M;
}
// a unit's rest point where the fold has taken it
function gearUnitPt(C, M, p) {
  const h = C.hinge, q = gearApp(M, [p[0] - h[0], p[1] - h[1], p[2] - h[2]]);
  return [h[0] + q[0], h[1] + q[1], h[2] + q[2]];
}
// the two-link knee: from s to l, links a (from s) and b (from l), bent toward `bend` (else `prev`, the side it was on)
function gearKnee(s, l, a, b, bend, prev) {
  const c = [l[0] - s[0], l[1] - s[1], l[2] - s[2]];
  let d = Math.hypot(c[0], c[1], c[2]);
  const u = d > 1e-12 ? [c[0] / d, c[1] / d, c[2] / d] : [0, -1, 0];
  d = Math.max(Math.abs(a - b) + 1e-9, Math.min(a + b, d));
  const x = (a * a - b * b + d * d) / (2 * d), h = Math.sqrt(Math.max(0, a * a - x * x));
  let w = null;
  for (const ref of [bend, prev]) {
    if (!ref) continue;
    const r = [ref[0] - s[0], ref[1] - s[1], ref[2] - s[2]], t = r[0] * u[0] + r[1] * u[1] + r[2] * u[2];
    const p = [r[0] - u[0] * t, r[1] - u[1] * t, r[2] - u[2] * t], pl = Math.hypot(p[0], p[1], p[2]);
    if (pl > 1e-9) { w = [p[0] / pl, p[1] / pl, p[2] / pl]; break; }
  }
  if (!w) { const r = Math.abs(u[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0], t = r[0] * u[0] + r[1] * u[1] + r[2] * u[2];
            w = [r[0] - u[0] * t, r[1] - u[1] * t, r[2] - u[2] * t]; const wl = Math.hypot(w[0], w[1], w[2]); w = w.map(c => c / wl); }
  return [s[0] + u[0] * x + w[0] * h, s[1] + u[1] * x + w[1] * h, s[2] + u[2] * x + w[2] * h];
}
// G6: HOW OPEN A WELL DOOR IS at g (0 shut .. 1 open): open within `k` of the gear leaving up (always shut once it is
// stowed); shut again within `k` of down when it can be (`closedDown`: the down gear does not pass through it)
function gearDoorOpen(seq, g) {
  const k = (seq && seq.k) || 0.15;
  let o = Math.max(0, Math.min(1, g / k));
  if (seq && seq.closedDown) o = Math.min(o, Math.max(0, Math.min(1, (1 - g) / k)));
  return o;
}
// the shortest rotation taking the unit vector a onto b
function gearAlign(a, b) {
  const k = [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const s = Math.hypot(k[0], k[1], k[2]), c = a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  if (s < 1e-12) return c > 0 ? [1, 0, 0, 0, 1, 0, 0, 0, 1] : gearRot(Math.abs(a[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0], Math.PI);
  return gearRot([k[0] / s, k[1] / s, k[2] / s], Math.atan2(s, c));
}
const gearNrm = v => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
// every point of the record at g: the units' folds, then the knees (their ends are units' points or fixed)
function gearMechPoints(R, g) {
  const M = {};
  for (const k in R.units || {}) M[k] = gearFoldPose(R.units[k], g);
  const knees = {};
  const pt = P => P.fix ? P.fix : P.unit ? (M[P.unit] ? gearUnitPt(R.units[P.unit], M[P.unit], P.p) : P.p)
    : P.knee ? knees[P.knee] : null;
  for (const id in R.knees || {}) {
    const K = R.knees[id];
    knees[id] = gearKnee(pt(K.s), pt(K.l), K.a, K.b, K.bend ? pt(K.bend) : null, K.k0 || null);
  }
  return { M, knees, pt };
}
function gearMechPose(R, g) {
  const { M, pt } = gearMechPoints(R, g), out = {};
  for (const P of R.parts || []) {
    let A, t;
    if (P.rule === 'door') {
      // G6: a hinged door - turned about its hinge line by its angle x how open it is at g, less how open it was drawn
      // (at g = 1: the rest is where it was drawn)
      A = gearRot(P.axis, P.ang * (gearDoorOpen(P.seq, g) - gearDoorOpen(P.seq, 1)));
      const h = P.hinge, Ah = gearApp(A, h);
      t = [h[0] - Ah[0], h[1] - Ah[1], h[2] - Ah[2]];
    } else if (P.rule === 'rigid') {
      const C = R.units[P.unit];
      if (!C) continue;
      A = M[P.unit]; const h = C.hinge, Ah = gearApp(A, h);
      t = [h[0] - Ah[0], h[1] - Ah[1], h[2] - Ah[2]];
    } else {
      const b = pt(P.from), e = pt(P.to);
      if (!b || !e) continue;
      A = gearAlign(P.d0, gearNrm([e[0] - b[0], e[1] - b[1], e[2] - b[2]]));
      const Ao = gearApp(A, P.o0);
      t = [b[0] - Ao[0], b[1] - Ao[1], b[2] - Ao[2]];
    }
    out[P.name] = [A[0], A[1], A[2], t[0], A[3], A[4], A[5], t[1], A[6], A[7], A[8], t[2]];
  }
  return out;
}
const GEAR_MECH = { gearRot, gearMul, gearApp, gearFoldPose, gearUnitPt, gearKnee, gearAlign, gearMechPoints, gearMechPose, gearDoorOpen };
