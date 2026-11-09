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
//   parts: [{ name, rule: 'rigid', unit, slide? }               turns with its unit about the hinge (leg, wheel, castor);
//                                                               `slide`: rides the piston up the leg first (gearSlide)
//           { name, rule: 'door', hinge, axis, ang, seq, o0 }  G6: a well door on its hinge (gearDoorOpen)
//           { name, rule: 'aim', from: P, to: P, o0, d0 }]      its base on `from`, its axis toward `to` (a cylinder's
//                                                               body, its rod, a brace's link): o0 / d0 its rest base
//                                                               and axis (at g = 1 the part is where it was drawn)
//   a point P: { fix: [x, y, z] } (the structure) | { unit, p } (rides the unit, p its rest place) | { knee: id }
//              | { along: [P, P], r, s, ax } (on a link: r from its first point toward its second, s across it -
//                along ax x the link: a horn on an arm)
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
// GR (the user, 5 Nov: "allow these very long landing trains to half retract before you put them back into their
// pod"): THE SHORTENING - a unit's `shorten` { dir: the leg's rest axis (trunnion to axle), t0: where the piston leaves
// the cylinder (metres down the leg), d: how far it slides in, k: over what share of the travel } - the piston, the
// axle and the wheel slide up the leg by gearSlide(C, g) (smooth, done by k of the way up) before the fold turns them
function gearSlide(C, g) {
  const S = C && C.shorten;
  if (!S || !(S.d > 0)) return 0;
  const s = Math.max(0, Math.min(1, 1 - g)) * (C.frac == null ? 1 : C.frac), t = Math.max(0, Math.min(1, s / (S.k || 0.5)));
  return S.d * t * t * (3 - 2 * t);
}
// a rest point slid with the piston (below t0 on the leg), else as it is
function gearSlidePt(C, p, d) {
  const S = C && C.shorten;
  if (!d || !S) return p;
  const h = C.top || C.hinge, t = (p[0] - h[0]) * S.dir[0] + (p[1] - h[1]) * S.dir[1] + (p[2] - h[2]) * S.dir[2];   // (P2: from the leg's head)
  return t > S.t0 ? [p[0] - S.dir[0] * d, p[1] - S.dir[1] * d, p[2] - S.dir[2] * d] : p;
}
// P2 (the Super Petrel's Catalina mains, 6 Nov - the user: "the mechanism needs to be small and the wheel should fit
// below the wing"): THE HOIST - a unit's `hoist` { dir, d, k }: the WHOLE unit (head, leg, wheel) carried up `dir`
// (reversed) by gearLift(C, g), smooth, done k of the way up - apart from the shortening, which slides the piston and
// the wheel up the leg: a jack lifts the head a little, the oleo telescopes the rest
function gearLift(C, g) {
  const L = C && C.hoist;
  if (!L || !(L.d > 0)) return 0;
  const s = Math.max(0, Math.min(1, 1 - g)) * (C.frac == null ? 1 : C.frac), t = Math.max(0, Math.min(1, s / (L.k || 0.6)));
  return L.d * t * t * (3 - 2 * t);
}
// P2 (the user's sketch, 6 Nov, relayed by the hull-types session - "THE FOLDING KNEE": "mechanisms are invisible"):
// THE ARC - a unit's `arc` { p: the arm's pivot, knee: its rest end, axis, ang }: the arm turns about p by ang and the
// knee opens by as much, so the leg and its wheel do not turn - the whole unit TRANSLATES with the knee on a quarter
// circle about p (smooth, over the whole travel). gearArc(C, g) is that translation
function gearArc(C, g) {
  const A = C && C.arc;
  if (!A || !A.ang) return null;
  const s = Math.max(0, Math.min(1, 1 - g)) * (C.frac == null ? 1 : C.frac), t = s * s * (3 - 2 * s);
  const v = [A.knee[0] - A.p[0], A.knee[1] - A.p[1], A.knee[2] - A.p[2]], q = gearApp(gearRot(A.axis, A.ang * t), v);
  return [A.p[0] + q[0] - A.knee[0], A.p[1] + q[1] - A.knee[1], A.p[2] + q[2] - A.knee[2]];
}
// a unit's rest point where the fold (and, given d, the shortening; given l, the hoist; given a, the arc) has taken it
function gearUnitPt(C, M, p, d, l, a) {
  const h = C.hinge, p1 = d ? gearSlidePt(C, p, d) : p, Lf = C.hoist;
  const ps = l && Lf ? [p1[0] - Lf.dir[0] * l, p1[1] - Lf.dir[1] * l, p1[2] - Lf.dir[2] * l] : p1, q = gearApp(M, [ps[0] - h[0], ps[1] - h[1], ps[2] - h[2]]);
  return a ? [h[0] + q[0] + a[0], h[1] + q[1] + a[1], h[2] + q[2] + a[2]] : [h[0] + q[0], h[1] + q[1], h[2] + q[2]];
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
  const M = {}, D = {}, Lm = {}, Am = {};
  for (const k in R.units || {}) { M[k] = gearFoldPose(R.units[k], g); D[k] = gearSlide(R.units[k], g); Lm[k] = gearLift(R.units[k], g); Am[k] = gearArc(R.units[k], g); }
  const knees = {};
  const pt = P => P.fix ? P.fix : P.unit ? (M[P.unit] ? gearUnitPt(R.units[P.unit], M[P.unit], P.p, D[P.unit], Lm[P.unit], Am[P.unit]) : P.p)
    : P.knee ? knees[P.knee] : P.along ? alongPt(P) : null;
  // (P2: a point on a link, r from its first end toward its second, s across - the folding knee's piston works on its
  // arm's horn)
  const alongPt = P => { const a = pt(P.along[0]), b = pt(P.along[1]); if (!a || !b) return null;
    const v = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], l = Math.hypot(v[0], v[1], v[2]) || 1, u = [v[0] / l, v[1] / l, v[2] / l];
    const s = P.s || 0, x = P.ax || [0, 0, 1], w = [x[1] * u[2] - x[2] * u[1], x[2] * u[0] - x[0] * u[2], x[0] * u[1] - x[1] * u[0]];
    return [a[0] + u[0] * P.r + w[0] * s, a[1] + u[1] * P.r + w[1] * s, a[2] + u[2] * P.r + w[2] * s]; };
  for (const id in R.knees || {}) {
    const K = R.knees[id];
    knees[id] = gearKnee(pt(K.s), pt(K.l), K.a, K.b, K.bend ? pt(K.bend) : null, K.k0 || null);
  }
  return { M, D, Lm, Am, knees, pt };
}
function gearMechPose(R, g) {
  const { M, D, Lm, Am, pt } = gearMechPoints(R, g), out = {};
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
      // (GR: a part riding the piston - `slide` - goes up the leg first: x -> A (x - dir d - h) + h)
      const d = P.slide ? D[P.unit] : 0;
      if (d && C.shorten) { const Ad = gearApp(A, C.shorten.dir); t = [t[0] - Ad[0] * d, t[1] - Ad[1] * d, t[2] - Ad[2] * d]; }
      // (P2: the lift carries every part of the unit)
      const l = Lm[P.unit];
      if (l && C.hoist) { const Al = gearApp(A, C.hoist.dir); t = [t[0] - Al[0] * l, t[1] - Al[1] * l, t[2] - Al[2] * l]; }
      const ar = Am[P.unit]; if (ar) t = [t[0] + ar[0], t[1] + ar[1], t[2] + ar[2]];      // (P2: the knee's arc)
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
const GEAR_MECH = { gearRot, gearMul, gearApp, gearFoldPose, gearUnitPt, gearSlide, gearSlidePt, gearLift, gearArc, gearKnee, gearAlign, gearMechPoints, gearMechPose, gearDoorOpen };

// ===========================================================================
// GEAR_LEVER - THE TRAILING-LINK (LEVERED) LEG WITH ITS OLEO-PNEUMATIC STRUT, the PZL-104 Wilga's kind (WILGA-GEAR,
// futureDesigns/WILGA-GEAR-STUDY-2026-11.md; the user: "modeling the Wilga type suspension, very close to original, full
// integrated in the game"). A fixed upper leg carries a lateral pivot at its foot; a trailing arm (the lever) turns on
// it and carries the axle; a separate oleo strut runs from a fitting on the leg to a horn on the arm (AAIB 7/2009
// G-EPZL's description). ONE kinematics and ONE strut law, read by the garage (the drawn leg at any compression), the
// frame (61: the nodes stand where these points say), the solver (30: the strut's force) and the flown drawing (app.js:
// every part posed from the physics nodes by gearNodeFrame) - so the drawn leg IS the physics leg at every compression.
// Pure arithmetic, no THREE, no state.
//
// THE LEVER RECORD (one side, any right-handed frame, metres): { piv: P (the pivot's centre), ax: unit (the pivot's
//   axis), w: the bearing's half-width along ax, axle: P, horn: P (the strut's lower eye, on the arm), top: P (the
//   strut's upper eye, on the leg) } - every point as drawn at FULL EXTENSION (the strut's own length there is Lx).
// THE STRUT RECORD (gearOleoDesign's): { Lx, S (stroke), A (piston area), P1 (stage 1's charge, absolute, at full
//   extension), V1, P2 (stage 2's charge, absolute), V2, s2 (the stroke it comes in at), n (polytropic), kc / kr (the
//   orifice's compression / rebound coefficient, N s2/m2), cl (the seals' linear damping, N s/m), kS (the stops) }
// ===========================================================================
const GEAR_PA = 101325;                         // the atmosphere the strut's gauge pressures are read against (Pa)
// a point turned by ang about the lever's axis through its pivot; positive ang raises the axle (sg, fixed per record)
// (the core's sin / cos - G2370: the frame stands its nodes on these points, so page and node must agree to the bit)
function gearLeverRot(k, a) {
  const c = CORE_MATH.cos(a), s = CORE_MATH.sin(a), C = 1 - c, x = k[0], y = k[1], z = k[2];
  return [c + x * x * C, x * y * C - z * s, x * z * C + y * s, y * x * C + z * s, c + y * y * C, y * z * C - x * s,
          z * x * C - y * s, z * y * C + x * s, c + z * z * C];
}
function gearLeverTurn(L, p, ang) {
  const R = gearLeverRot(L.ax, ang * (L.sg || 1)), q = gearApp(R, [p[0] - L.piv[0], p[1] - L.piv[1], p[2] - L.piv[2]]);
  return [L.piv[0] + q[0], L.piv[1] + q[1], L.piv[2] + q[2]];
}
// stamp the record's sense (+ang raises the axle, the frame's y up) and its strut's length at full extension
function gearLeverInit(L, up) {
  const U = up || [0, 1, 0], d = 1e-3;
  L.sg = 1;
  const a1 = gearLeverTurn(L, L.axle, d);
  if ((a1[0] - L.axle[0]) * U[0] + (a1[1] - L.axle[1]) * U[1] + (a1[2] - L.axle[2]) * U[2] < 0) L.sg = -1;
  L.Lx = hyp3(L.top[0] - L.horn[0], L.top[1] - L.horn[1], L.top[2] - L.horn[2]);
  L.up = U;
  return L;
}
// the arm turned by ang: its axle and horn, the strut's stroke (Lx less its length) and the axle's rise
function gearLeverAt(L, ang) {
  const a = gearLeverTurn(L, L.axle, ang), h = gearLeverTurn(L, L.horn, ang), U = L.up || [0, 1, 0];
  const len = hyp3(L.top[0] - h[0], L.top[1] - h[1], L.top[2] - h[2]);
  return { axle: a, horn: h, len, s: L.Lx - len,
           rise: (a[0] - L.axle[0]) * U[0] + (a[1] - L.axle[1]) * U[1] + (a[2] - L.axle[2]) * U[2] };
}
// the angle the arm stands at for a stroke s (bisection over [0, hi]; the stroke rises monotonically over the travel
// gearOleoDesign checks), and for a rise of the axle
function gearLeverAngOf(L, key, v, hi) {
  let lo = 0, up = hi == null ? Math.PI / 2 : hi;
  for (let k = 0; k < 60; k++) { const m = 0.5 * (lo + up); if (gearLeverAt(L, m)[key] < v) lo = m; else up = m; }
  return 0.5 * (lo + up);
}
// the motion ratio ds / d(rise) at an angle (the strut's shortening per metre of wheel travel; the wheel's load is the
// strut's force times it, by virtual work)
function gearLeverMR(L, ang) {
  const e = 1e-4, A = gearLeverAt(L, ang - e), B = gearLeverAt(L, ang + e);
  return (B.s - A.s) / (B.rise - A.rise);
}
// THE GAS: stage 1 (P1, V1) alone until its pressure reaches stage 2's charge P2, then both volumes together (the
// later Wilgas' "two-stage gas-oil, charged with nitrogen" - polot.net, the study's [11]); absolute Pa at stroke s
function gearOleoP(O, s) {
  const x = s < 0 ? 0 : s;
  if (!(O.V2 > 0) || x <= O.s2) return O.P1 * CORE_MATH.pow(O.V1 / Math.max(0.03 * O.V1, O.V1 - O.A * x), O.n);
  const Vt = O.V1 + O.V2;
  return O.P2 * CORE_MATH.pow((Vt - O.A * O.s2) / Math.max(0.03 * Vt, Vt - O.A * x), O.n);
}
// the strut's SPRING force (N, + pushes the eyes apart): the gas over its piston, the stops (top-out below 0, bottoming
// past S)
function gearOleoSpring(O, s) {
  let F = O.A * (gearOleoP(O, s) - GEAR_PA);
  if (s < 0) F += O.kS * s; else if (s > O.S) F += O.kS * (s - O.S);
  return F;
}
// THE WHOLE LAW at stroke s and closing speed sd (m/s, + compressing) over a step dt, mR the eyes' reduced mass: the
// spring, the orifice (quadratic: kc compressing, kr extending - the rebound throttled harder, the study's §5) and the
// seals (linear cl). THE DAMPER IS INTEGRATED SEMI-IMPLICITLY: c sd / (1 + c dt / mR) is the exact one-step answer of
// m dw/dt = -c w for the step - it takes the relative speed to zero at most, never through it, whatever the step (an
// orifice at a 3 m/s drop asks a c far past the explicit bound); a step that resolves the motion reads the plain law
// THE SEALS AND BEARINGS' FRICTION (ff, N): Coulomb, regularised under O.vf (m/s) - folded into the same semi-implicit
// damper (ff / (|sd| + vf) as a coefficient), so a parked aeroplane's strut stops instead of rocking on its gas
function gearOleoF(O, s, sd, dt, mR) {
  const c = (sd > 0 ? O.kc : O.kr) * Math.abs(sd) + O.cl + (O.ff > 0 ? O.ff / (Math.abs(sd) + O.vf) : 0);
  return gearOleoSpring(O, s) + c * sd / (1 + c * dt / mR);
}
// THE STRUT DESIGNED FOR ITS AEROPLANE (the study's §4, every rule there with its source): W the static load on this
// wheel at the design gross (N), sink the limit sink (m/s), D the rules (GEN_RULES.lever): the static deflection at
// gross dSt (the charge: the shop services the strut for the aeroplane), the piston's diameter, the pressure ratio
// static / extended rp, the polytropic n, stage 2's charge over the static pressure p2k and its full-stroke target over
// the limit load nFull, the orifice's share of the limit load at the limit sink cd, the rebound over compression rb,
// the seals' damping ratio zl and their friction ff (a share of the static strut force, regularised under vf m/s).
// L: the lever (gearLeverInit'd, its `up` the world's up in its frame at the parked attitude); angFull the arm's
// angle at full stroke
function gearOleoDesign(L, angFull, W, sink, D) {
  const S = gearLeverAt(L, angFull).s, A = Math.PI * 0.25 * D.dPiston * D.dPiston, n = D.n;
  const aSt = gearLeverAngOf(L, 'rise', D.dSt, angFull), sSt = gearLeverAt(L, aSt).s, mrSt = gearLeverMR(L, aSt);
  const mrS = gearLeverMR(L, angFull * 0.98);
  const Fst = W / mrSt, Pst = Fst / A + GEAR_PA, P1 = Pst / D.rp;
  const V1 = A * sSt / (1 - CORE_MATH.pow(D.rp, -1 / n));
  // stage 2: charged at p2k x the static pressure; its volume solved so the gas at full stroke carries nFull x the
  // static load through the full-stroke motion ratio (bisection: the pressure there falls as V2 grows)
  const P2 = D.p2k * Pst, s2 = (V1 / A) * (1 - CORE_MATH.pow(P1 / P2, 1 / n));
  const Ftgt = D.nFull * W / Math.max(0.05, mrS), Ptgt = Ftgt / A + GEAR_PA;
  let V2 = 0;
  if (s2 < S) {
    const pAt = v => P2 * CORE_MATH.pow((V1 + v - A * s2) / Math.max(1e-12, V1 + v - A * S), n);
    let lo = 0, hi = 50 * V1;
    for (let k = 0; k < 80; k++) { const m = 0.5 * (lo + hi); if (pAt(m) > Ptgt) lo = m; else hi = m; }
    V2 = 0.5 * (lo + hi);
  }
  const O = { Lx: L.Lx, S, A, n, P1, V1, P2, V2, s2, kc: 0, kr: 0, cl: 0, kS: 0 };
  // the gas's own stiffness at full stroke, and the stops at stopK times it (a metal stop on rubber pads)
  const kFull = (gearOleoSpring(O, S) - gearOleoSpring(O, S - 1e-4)) / 1e-4;
  O.kS = D.stopK * kFull;
  // the orifice: at the limit sink the strut closes at mrSt x sink; it carries cd of the limit load's strut force there
  const v0 = mrSt * sink, Flim = D.nLim * W / mrSt;
  O.kc = D.cd * Flim / (v0 * v0);
  O.kr = D.rb * O.kc;
  // the seals: zl of critical on the static spring and the wheel's own mass seen at the strut (m / MR^2)
  const kSt = (gearOleoSpring(O, sSt + 1e-4) - gearOleoSpring(O, sSt - 1e-4)) / 2e-4;
  const mEff = (W / 9.81) / (mrSt * mrSt);
  O.cl = D.zl * 2 * Math.sqrt(kSt * mEff);
  O.ff = D.ff * Fst; O.vf = D.vf;
  O.sSt = sSt; O.angSt = aSt; O.mrSt = mrSt; O.Fst = Fst; O.kFull = kFull;
  return O;
}
// THE PART'S POSE FROM ITS NODES: the rigid transform (3 x 4 row-major, gearMechPose's shape) taking the rest points
// r[0..2] onto the current c[0..2] - a triad on the first three (origin r0, axis r0->r1, the plane with r2). The garage
// poses the drawn arm and strut with it from gearLeverAt's points; the flight from the solver's nodes; so the two
// cannot differ by construction
function gearNodeFrame(r, c) {
  const tri = q => { const e1 = gearNrm([q[1][0] - q[0][0], q[1][1] - q[0][1], q[1][2] - q[0][2]]);
    const v = [q[2][0] - q[0][0], q[2][1] - q[0][1], q[2][2] - q[0][2]], d = v[0] * e1[0] + v[1] * e1[1] + v[2] * e1[2];
    const e2 = gearNrm([v[0] - d * e1[0], v[1] - d * e1[1], v[2] - d * e1[2]]);
    return [e1, e2, [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]]]; };
  const A = tri(r), B = tri(c), M = new Array(9);
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) M[i * 3 + j] = B[0][i] * A[0][j] + B[1][i] * A[1][j] + B[2][i] * A[2][j];
  const Ar = gearApp(M, r[0]);
  return [M[0], M[1], M[2], c[0][0] - Ar[0], M[3], M[4], M[5], c[0][1] - Ar[1], M[6], M[7], M[8], c[0][2] - Ar[2]];
}
// THE LEG FROM ITS ROWS (GEN_RULES.lever's keys, or the garage's): the points relative to the axle at full extension,
// frame axes [x aft, y up, q outboard]; legDir the leg's direction up from the pivot (the drawn leg's, else the rows').
// The garage draws with it and the frame falls back on it, so a leg nobody measured is the leg the rows describe
function gearLeverRef(o, legDir) {
  const D = Math.PI / 180, a = o.arm, th = o.ang * D, tb = (o.ang - o.hornDeg) * D, rh = o.hornK * a;
  const piv = [-a * CORE_MATH.cos(th), a * CORE_MATH.sin(th), -o.qPiv];
  const horn = [piv[0] + rh * CORE_MATH.cos(tb), piv[1] - rh * CORE_MATH.sin(tb), -o.qHorn];
  const ld = legDir || o.legDir, l = hyp3(ld[0], ld[1], ld[2]) || 1;
  const top = [piv[0] + o.top * ld[0] / l, piv[1] + o.top * ld[1] / l, piv[2] + o.top * ld[2] / l];
  return { piv, horn, top, w: o.w, comp: (o.ang - o.comp) * D };
}
const GEAR_LEVER = { GEAR_PA, gearLeverRef, gearLeverTurn, gearLeverInit, gearLeverAt, gearLeverAngOf, gearLeverMR, gearOleoP, gearOleoSpring,
                     gearOleoF, gearOleoDesign, gearNodeFrame };
