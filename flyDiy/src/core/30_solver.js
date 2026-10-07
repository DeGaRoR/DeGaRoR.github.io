// ============================================================
// ---------------------------------------------------------------------------
// THE VORTEX KERNEL (G185.5) — the mutual interference between the planes of
// a biplane, and the wing's downwash on the tail, as the induced velocity of
// discrete HORSESHOE VORTICES. Each wing strip is one horseshoe: its bound
// vortex along the quarter-chord line of the strip's own sub-span, two
// semi-infinite trailing legs downstream. Biot-Savart, closed form, with a
// Rankine core so a control point that lands in a wake is finite.
//
// WHAT IS AND IS NOT IN IT (Munk's decomposition, Di = Di1 + Di2 + 2 Di12): a
// strip's OWN plane's induced velocity is already inside its polar (the
// lifting-line eAR and the ground-effect factor) and is never evaluated
// here — the pair list in makeSim excludes same-plane pairs. What the kernel
// adds is the OTHER plane's field at this plane, and both planes' field at
// the tail: the terms a single polar cannot hold.
//   segment(A, B, P)  the finite bound vortex A -> B, unit circulation
//   semi(A, d, P)     the semi-infinite leg from A to infinity along unit d
//   horseshoe(A, B, d, rc, P)  bound A->B, leg out of B, leg into A
// The circulation's SIGN rides on the strip (Gam[]): + means A -> B, and the
// solver picks the sign each pass so that ev x Gam is the strip's lift
// direction (Kutta-Joukowski, F' = rho V x Gamma).
const VK_INV4PI = 1 / (4 * Math.PI);
function vkSegment(A, B, rc, P, out) {
  const r1x = P[0]-A[0], r1y = P[1]-A[1], r1z = P[2]-A[2];
  const r2x = P[0]-B[0], r2y = P[1]-B[1], r2z = P[2]-B[2];
  const r0x = B[0]-A[0], r0y = B[1]-A[1], r0z = B[2]-A[2];
  const xx = r1y*r2z - r1z*r2y, xy = r1z*r2x - r1x*r2z, xz = r1x*r2y - r1y*r2x;
  let x2 = xx*xx + xy*xy + xz*xz;
  const L0 = Math.sqrt(r0x*r0x + r0y*r0y + r0z*r0z);
  const c2 = (rc * L0) * (rc * L0);
  if (x2 < c2) x2 = c2;
  if (!(x2 > 0)) return out;
  const m1 = Math.sqrt(r1x*r1x + r1y*r1y + r1z*r1z) || 1e-12;
  const m2 = Math.sqrt(r2x*r2x + r2y*r2y + r2z*r2z) || 1e-12;
  const k = VK_INV4PI / x2 * (r0x*(r1x/m1 - r2x/m2) + r0y*(r1y/m1 - r2y/m2) + r0z*(r1z/m1 - r2z/m2));
  out[0] += k * xx; out[1] += k * xy; out[2] += k * xz;
  return out;
}
// the leg from A to infinity along unit d, unit circulation flowing A -> inf
function vkSemi(A, d, rc, P, sign, out) {
  const r1x = P[0]-A[0], r1y = P[1]-A[1], r1z = P[2]-A[2];
  const xx = d[1]*r1z - d[2]*r1y, xy = d[2]*r1x - d[0]*r1z, xz = d[0]*r1y - d[1]*r1x;
  let x2 = xx*xx + xy*xy + xz*xz;
  if (x2 < rc * rc) x2 = rc * rc;
  if (!(x2 > 0)) return out;
  const m1 = Math.sqrt(r1x*r1x + r1y*r1y + r1z*r1z) || 1e-12;
  const k = sign * VK_INV4PI / x2 * (1 + (d[0]*r1x + d[1]*r1y + d[2]*r1z) / m1);
  out[0] += k * xx; out[1] += k * xy; out[2] += k * xz;
  return out;
}
// one horseshoe of unit circulation A -> B, legs along d; the leg at A flows
// INTO A (minus), the leg at B flows OUT (plus)
function vkHorseshoe(A, B, d, rc, P, out) {
  vkSegment(A, B, rc, P, out);
  vkSemi(B, d, rc, P, 1, out);
  vkSemi(A, d, rc, P, -1, out);
  return out;
}
const vortexKernel = { segment: vkSegment, semi: vkSemi, horseshoe: vkHorseshoe };

// G1891 (DMG-CERTCOST): the snapshot's deep copy and its write-back (makeSim's snap / unsnap): typed arrays, arrays and
// plain objects copied, functions left (a closure is the sim's own), shared references kept shared; snapPut writes a
// copy back INTO the live objects (the closures hold them), a missing or differently-shaped one replaced by a copy
function snapCopy(x, seen) {
  if (x === null || typeof x !== 'object') return x;
  seen = seen || new Map();
  if (seen.has(x)) return seen.get(x);
  if (ArrayBuffer.isView(x)) { const y = x.slice(); seen.set(x, y); return y; }
  if (Array.isArray(x)) { const y = []; seen.set(x, y); for (let i = 0; i < x.length; i++) y.push(typeof x[i] === 'function' ? undefined : snapCopy(x[i], seen)); return y; }
  const y = {}; seen.set(x, y);
  for (const k of Object.keys(x)) if (typeof x[k] !== 'function') y[k] = snapCopy(x[k], seen);
  return y;
}
function snapPut(t, s, seen) {
  seen = seen || new Set();
  if (seen.has(t)) return; seen.add(t);
  if (ArrayBuffer.isView(t)) { t.set(s); return; }
  const kind = o => o === null || typeof o !== 'object' ? 0 : ArrayBuffer.isView(o) ? 1 : Array.isArray(o) ? 2 : 3;
  const put = (o, k, sv) => {
    const tv = o[k];
    if (typeof tv === 'function' || tv === sv) return;   // (equal: not written - see unsnap's members)
    if (kind(sv) && kind(sv) === kind(tv) && (kind(sv) !== 1 || tv.length === sv.length)) snapPut(tv, sv, seen);
    else o[k] = snapCopy(sv);
  };
  if (Array.isArray(t)) { t.length = s.length; for (let i = 0; i < s.length; i++) if (s[i] !== undefined) put(t, i, s[i]); return; }
  for (const k of Object.keys(t)) if (!(k in s) && typeof t[k] !== 'function') delete t[k];
  for (const k of Object.keys(s)) put(t, k, s[k]);
}
function makeSim(def, world) {
  const P_ = def.params;
  const PP = POWERPLANTS[P_.powerplant];
  // The PROP may be the aeroplane's own rather than the powerplant's: a GARAGE
  // build chooses its disc, and every prop number below is then synthesised from
  // it (60_gen_spec.js). A fiche sets no `prop`, so it reads the registry exactly
  // as before and no fleet number moves.
  const PR = P_.prop || PP.prop;
  const PROPA = Math.PI * (PR.D / 2) ** 2;
  // THE AIR THIS SIM IS IN. A sim built with no world flies the STANDARD day:
  // genShakedown makes one that way on purpose, and a wind-tunnel probe must
  // never be in weather — which now includes the weather's air, not just its
  // wind. Read per pass rather than captured, because the viewer sets a new day
  // live exactly the way it already sets a new wind.
  // setAtmos(air, h) — the air AND the altitude a wind-tunnel probe is run at.
  // A TUNNEL IS AT A DECLARED AIR STATE, never at the incidental height the
  // aeroplane's nodes happen to be sitting at: every design-time number in
  // 64_gen_build is measured through probes, and if those read the model's own
  // ride height then a taller undercarriage would quietly change the stall
  // speed on the sheet. Default: ISA sea level, which is the datum.
  let atmOver = null, hProbe = 0;
  const setAtmos = (a, h) => { atmOver = a || null; hProbe = h || 0; };
  // WHERE THE GROUND IS, FOR GROUND EFFECT ONLY, when there is no world (G159).
  // A world-free sim has no place and therefore no terrain, which is the
  // shakedown's own ruling and the right one for the STANCE and for the AIR:
  // a number on the sheet must not depend on which patch of grass the
  // aeroplane is parked on. Ground EFFECT is not that kind of question. During
  // a take-off roll the wheels are on the ground, so h/b is set by the
  // aeroplane's own geometry and by nothing else, and leaving it out makes the
  // roll longer than the aeroplane's own wing says it is. So it is declared
  // rather than inferred: null (the default) is exactly the old behaviour, and
  // genTORunAt sets it to 0 for the length of the roll and clears it after.
  let gRef = null;
  const setGroundRef = h => { gRef = (h == null ? null : h); };
  const airOf = () => atmOver || (world && world.atmos) || ATMOS_ISA;
  // THE ENGINE'S OWN RELATION TO IT, declared on the registry row: 'na'
  // breathes the air and lapses with it, an electric motor's power comes out of
  // the pack and does not. Absent = 'na', because everything that flew before
  // this line existed was a piston.
  // G134: a GARAGE build may fly its OWN engine facts (def.params.engine, the
  // editor's dials resolved) — the registry row is then only the preset the
  // dials started from, exactly as params.prop already outranks PP.prop above.
  const EN = P_.engine || PP.engine;
  const ASP = (EN && EN.aspiration) || 'na';
  // a turbine's flat-rating margin (2026-09-05, TURBOPROP §2) — 1 for every
  // other family, which 05_atmos ignores; the three readers below pass it
  const FLAT = (EN && EN.flatK) || 1;
  // a blown piston's critical altitude (the blower model, 2026-09-05), as
  // the ISA density ratio 05_atmos reads — 1 for every other family, and 1
  // for a ground-boosted blower, which is the NA law
  const CRIT = (EN && (ASP === 'turbo' || ASP === 'super') && EN.critAlt > 0)
    ? ATMOS_ISA.sigma(EN.critAlt) : 1;
  const n = def.nodes.length;
  const p = new Float64Array(n * 3), v = new Float64Array(n * 3),
        f = new Float64Array(n * 3), m = new Float64Array(n),
        r = new Float64Array(n), rC = new Float64Array(n);   // rC: the contact radius (G661, reset below)
  // THE FLIGHT BOX (G610, 62_gen_aero genFlightBox): a softened wing spring (kTrue on the beam) reports
  // its strain against the TRUE k - the force it carries over the actual wing's stiffness, which is the
  // real wing's strain under the same load (sK = k / kTrue; 1, exactly, on every other beam)
  const beams = def.beams.map(b => ({ ...b, L0: 0, strain: 0, sK: b.kTrue != null ? b.k / b.kTrue : 1, kF: b.k, cF: b.c }));
  let subN = P_.substeps ?? 24;
  // THE TUBE (G294): RIGID CLUSTERS, shape-matched every substep. A group of
  // nodes (a twin boom's) is pulled onto the best-fit rigid transform of
  // its rest shape — Müller's shape matching: the mass-weighted centre,
  // the rotation extracted from the covariance of the current offsets
  // against the rest offsets (the 2016 iterative extraction, warm-started
  // on the last step's rotation), the goal positions R q + c, and the
  // nodes moved onto them with their velocities corrected by the same
  // displacement. Mass-weighted, so linear momentum is conserved exactly
  // and angular momentum to the iteration's tolerance; and it is a
  // PROJECTION, not a spring — no frequency, no substep cost, whatever the
  // stiffness the members would have needed. The members inside the cluster
  // still run (the drawing, the mass and the strain readouts want them);
  // their forces are tiny once the shape is held.
  let clusterFresh = false;                    // G348: rest re-taken at the first step after a reset
  const clusters = (def.clusters || []).map(C => {
    const idx = Int32Array.from(C.nodes);
    // `omega` (rad/s) is the cluster's STIFFNESS: the projection is applied
    // as the fraction (omega dt)^2 of the way to the goal each substep,
    // which is a spring of that frequency toward the rigid fit — a
    // cantilever with a real tip deflection — capped at 1 (rigid; 0 or
    // absent = rigid too)
    // G350: `rings` (the stations along the tube, each a list of node ids in
    // the same order) and `gj` (N·m², the tube's torsional rigidity) give the
    // cluster a TWIST constraint per bay — see twistHold below
    const rings = (C.rings || []).map(r => Int32Array.from(r));
    return { cls: C.cls, tag: C.tag, idx, q: new Float64Array(idx.length * 3),
             R: [1, 0, 0, 0, 1, 0, 0, 0, 1], omega: C.omega > 0 ? C.omega : 0,
             rings, gj: C.gj > 0 ? C.gj : 0, twist: null };
  });
  // THE TWIST (G350). Shape matching holds a cluster's SHAPE with one
  // stiffness for every mode, and measured on the twin boom its hold on
  // torsion is an order below its hold on bending (the fin's side load
  // twisted the boom 4.3 deg where the tube's GJ says 0.3). So torsion is
  // its own constraint: for each bay between two rings, the angle of ring
  // k's phase vector (its first node off its centroid, square to the axis)
  // against ring k+1's, about the bay's axis, is held at its rest value —
  // the rings turn back toward each other by the fraction (omega_T dt)² of
  // the excess each substep, omega_T² = (GJ / L) / I_red with I_red the
  // reduced moment of the two rings about the axis: the tube's own
  // torsional spring, derived, not calibrated. Momentum: equal and opposite
  // rotations weighted by the rings' own inertias.
  function twistRest(C) {
    if (C.rings.length < 2 || !(C.gj > 0)) { C.twist = null; return; }
    const T = [];
    for (let k = 0; k + 1 < C.rings.length; k++) {
      const g = twistGeom(C.rings[k], C.rings[k + 1]);
      if (!g) { T.push(null); continue; }
      const kth = C.gj / Math.max(0.05, g.L);
      const Ired = (g.I0 * g.I1) / Math.max(1e-9, g.I0 + g.I1);
      T.push({ rest: g.theta, w: Math.sqrt(kth / Math.max(1e-6, Ired)), I0: g.I0, I1: g.I1 });
    }
    C.twist = T;
  }
  // the bay's geometry now: centroids, axis, both rings' phase, the twist,
  // the length and the two moments of inertia about the axis
  function twistGeom(r0, r1) {
    const cen = r => { let x = 0, y = 0, z = 0, M = 0;
      for (const i of r) { x += p[i*3] * m[i]; y += p[i*3+1] * m[i]; z += p[i*3+2] * m[i]; M += m[i]; }
      return [x / M, y / M, z / M]; };
    const c0 = cen(r0), c1 = cen(r1);
    let ax = c1[0] - c0[0], ay = c1[1] - c0[1], az = c1[2] - c0[2];
    const L = hyp3(ax, ay, az);
    if (L < 1e-6) return null;
    ax /= L; ay /= L; az /= L;
    const perp = (i, c) => { let x = p[i*3] - c[0], y = p[i*3+1] - c[1], z = p[i*3+2] - c[2];
      const d = x * ax + y * ay + z * az; return [x - d * ax, y - d * ay, z - d * az]; };
    const inertia = (r, c) => { let I = 0; for (const i of r) { const q = perp(i, c); I += m[i] * (q[0]*q[0] + q[1]*q[1] + q[2]*q[2]); } return I; };
    const u = perp(r0[0], c0), v = perp(r1[0], c1);
    const lu = hyp3(u[0], u[1], u[2]), lv = hyp3(v[0], v[1], v[2]);
    if (lu < 1e-6 || lv < 1e-6) return null;
    const cx = u[1]*v[2] - u[2]*v[1], cy = u[2]*v[0] - u[0]*v[2], cz = u[0]*v[1] - u[1]*v[0];
    const s = (cx * ax + cy * ay + cz * az) / (lu * lv), c = (u[0]*v[0] + u[1]*v[1] + u[2]*v[2]) / (lu * lv);
    return { c0, c1, ax: [ax, ay, az], theta: Math.atan2(s, c), L, I0: inertia(r0, c0), I1: inertia(r1, c1) };
  }
  // (Cm: G1840's measured substep - the turn's force on a node of a cut's part, m e / dt^2, reported to the cut)
  function rotateRing(r, c, a, phi, dt, Cm) {
    const cw = Math.cos(phi), sw = Math.sin(phi), t = 1 - cw;
    const [kx, ky, kz] = a;
    const nm = Cm ? Cm.nm : null;
    for (const i of r) {
      const i3 = i*3, x = p[i3] - c[0], y = p[i3+1] - c[1], z = p[i3+2] - c[2];
      const nx = x*(cw + kx*kx*t) + y*(kx*ky*t - kz*sw) + z*(kx*kz*t + ky*sw);
      const ny = x*(ky*kx*t + kz*sw) + y*(cw + ky*ky*t) + z*(ky*kz*t - kx*sw);
      const nz = x*(kz*kx*t - ky*sw) + y*(kz*ky*t + kx*sw) + z*(cw + kz*kz*t);
      const ex = nx - x, ey = ny - y, ez = nz - z;
      p[i3] += ex; p[i3+1] += ey; p[i3+2] += ez;
      v[i3] += ex / dt; v[i3+1] += ey / dt; v[i3+2] += ez / dt;
      if (nm !== null && nm[i]) { const s = m[i] / (dt * dt); clAcc(Cm, nm[i], i3, s * ex, s * ey, s * ez); }
    }
  }
  function twistHold(C, dt) {
    if (!C.twist) return;
    // G1841 (DMG-D3): on a measured substep, each bay's torque (I_red phi / dt^2: the ring's angular impulse over the
    // substep) against the tube's torque limit; past it the tube tears at that bay
    const Cm = C.ms ? C : null, tw = Cm ? C.twL0 : null;
    if (Cm) C.twR = 0;
    for (let k = 0; k + 1 < C.rings.length; k++) {
      const T = C.twist[k];
      if (!T) continue;
      const g = twistGeom(C.rings[k], C.rings[k + 1]);
      if (!g) continue;
      let d = g.theta - T.rest;
      while (d > Math.PI) d -= 2 * Math.PI;
      while (d < -Math.PI) d += 2 * Math.PI;
      const al = Math.min(1, (T.w * dt) * (T.w * dt));
      const phi = al * d;
      if (Math.abs(phi) < 1e-9) continue;
      // split by inertia: the lighter ring turns more
      const s0 = g.I1 / Math.max(1e-9, g.I0 + g.I1), s1 = 1 - s0;
      rotateRing(C.rings[k], g.c0, g.ax, phi * s0, dt, Cm);
      rotateRing(C.rings[k + 1], g.c1, g.ax, -phi * s1, dt, Cm);
      if (tw) {
        const k0 = C.rk[k];
        if (C.rk[k + 1] === k0 + 1 && tw[k0] > 0) {
          const r = g.I0 * Math.abs(phi * s0) / (dt * dt) / tw[k0];
          if (r > C.twR) C.twR = r;
          if (r > C.twPk) C.twPk = r;
          if (r >= 1 && !PEAK) { bayPart(clusters.indexOf(C), k0, r); return; }
        }
      }
    }
  }
  function clusterRest(C) {
    let cx = 0, cy = 0, cz = 0, M = 0;
    for (let k = 0; k < C.idx.length; k++) {
      const i = C.idx[k], mi = m[i];
      cx += p[i*3] * mi; cy += p[i*3+1] * mi; cz += p[i*3+2] * mi; M += mi;
    }
    cx /= M; cy /= M; cz /= M;
    for (let k = 0; k < C.idx.length; k++) {
      const i = C.idx[k];
      C.q[k*3] = p[i*3] - cx; C.q[k*3+1] = p[i*3+1] - cy; C.q[k*3+2] = p[i*3+2] - cz;
    }
    C.R = [1, 0, 0, 0, 1, 0, 0, 0, 1];
  }
  // the rotation of a linear map A (row-major 3x3), warm-started from R.
  // G396.3 (found by the strut task session, unlanded at the crash): A
  // NEWTON STEP, NOT MÜLLER'S GRADIENT STEP. Müller, Bender,
  // Chentanez, Macklin 2016 ("A robust method to extract the rotational
  // part of deformations") turns R toward A by omega = sum(r_c x a_c) /
  // |sum(r_c . a_c)| — the exact correction for a round body, but that
  // scalar is the whole trace of A, and on a LONG THIN cluster (a float: a
  // hull 100:1 in its second moments, a boom tube likewise) a rotation
  // about the long axis is under-relaxed by the ratio of the short moments
  // to the trace: four iterations recovered a tenth of one substep's roll
  // (measured, scratch: 2.7e-4 of 3e-4 rad left). The projection then
  // pulled the float back toward a STALE roll every substep — an angular
  // damper that lived in the solver, not in the aeroplane: on the fixture's
  // floats the aileron doublet rolled 3 deg/s where the plant says 27, with
  // the angular momentum bleeding 75 % in 0.3 s and the pilot's approach in
  // a limit cycle on the stops; with the float struts soft the floats hung
  // loose and hid it (20 deg/s, decaying), stiff, they carried it into the
  // airframe. G350's own words on the boom — its hold on torsion "an order
  // below its hold on bending" — were this same lag about the tube's axis.
  // The Newton step: B = R^T A, S = sym(B), k = axial(skew(B)), the
  // linearised optimality (R^T A symmetric) reads (tr S . I - S) d = 2 k,
  // R <- R exp([d]x). Per axis the right divisor is the OTHER two moments,
  // which is why it converges in one step for a small rotation and in
  // three for half a radian, on any aspect ratio (scratch rot_test.js:
  // 2e-8 rad on the 100:1 body against Müller's 2.7e-4 at four
  // iterations, 7e-8 at four hundred). Degenerate S (a line of nodes) has
  // no rotation about the line to find; the ridge on the diagonal keeps
  // the solve finite there and returns the warm start about that axis.
  function extractRotation(A, R, iters) {
    for (let it = 0; it < iters; it++) {
      // B = R^T A  (row j of B = column j of R dotted with the columns of A)
      const B = new Array(9);
      for (let j = 0; j < 3; j++) {
        const rx = R[j], ry = R[3 + j], rz = R[6 + j];
        for (let c = 0; c < 3; c++) B[j*3 + c] = rx * A[c] + ry * A[3 + c] + rz * A[6 + c];
      }
      const s01 = 0.5 * (B[1] + B[3]), s02 = 0.5 * (B[2] + B[6]), s12 = 0.5 * (B[5] + B[7]);
      const kx = 0.5 * (B[7] - B[5]), ky = 0.5 * (B[2] - B[6]), kz = 0.5 * (B[3] - B[1]);
      const t = B[0] + B[4] + B[8], eps = 1e-9 * (Math.abs(t) + 1e-12);
      // M = tr(S) I - S, ridged
      const M0 = t - B[0] + eps, M4 = t - B[4] + eps, M8 = t - B[8] + eps;
      const M1 = -s01, M2 = -s02, M5 = -s12;
      const det = M0 * (M4 * M8 - M5 * M5) - M1 * (M1 * M8 - M5 * M2) + M2 * (M1 * M5 - M4 * M2);
      if (!(Math.abs(det) > 1e-300)) break;
      const bx = 2 * kx, by = 2 * ky, bz = 2 * kz;
      const dx = (bx * (M4 * M8 - M5 * M5) - M1 * (by * M8 - M5 * bz) + M2 * (by * M5 - M4 * bz)) / det;
      const dy = (M0 * (by * M8 - M5 * bz) - bx * (M1 * M8 - M5 * M2) + M2 * (M1 * bz - by * M2)) / det;
      const dz = (M0 * (M4 * bz - by * M5) - M1 * (M1 * bz - by * M2) + bx * (M1 * M5 - M4 * M2)) / det;
      const w = hyp3(dx, dy, dz);
      if (w < 1e-9) break;
      // R <- R * Rot(axis, w)  (Rodrigues, the axis in the cluster's rest frame)
      const ax = dx / w, ay = dy / w, az = dz / w;
      const cw = Math.cos(w), sw = Math.sin(w), tt = 1 - cw;
      const Q = [cw + ax*ax*tt,    ax*ay*tt - az*sw, ax*az*tt + ay*sw,
                 ay*ax*tt + az*sw, cw + ay*ay*tt,    ay*az*tt - ax*sw,
                 az*ax*tt - ay*sw, az*ay*tt + ax*sw, cw + az*az*tt];
      const N2 = new Array(9);
      for (let r2 = 0; r2 < 3; r2++) for (let c = 0; c < 3; c++)
        N2[r2*3 + c] = R[r2*3] * Q[c] + R[r2*3 + 1] * Q[3 + c] + R[r2*3 + 2] * Q[6 + c];
      R = N2;
    }
    return R;
  }
  function shapeMatch(C, dt) {
    const n2 = C.idx.length;
    let cx = 0, cy = 0, cz = 0, M = 0;
    for (let k = 0; k < n2; k++) {
      const i = C.idx[k], mi = m[i];
      cx += p[i*3] * mi; cy += p[i*3+1] * mi; cz += p[i*3+2] * mi; M += mi;
    }
    cx /= M; cy /= M; cz /= M;
    // G435: THE REST OFFSETS RE-CENTRED BY THE MASSES OF THIS SUBSTEP.
    // "Mass-weighted, so linear momentum is conserved exactly" (above) holds
    // only while sum m_k q_k = 0 with the m the goal is built from. The rest
    // is taken once (clusterRest) and the masses move after it: a tank
    // billed on a ring pair inside the cluster drains, the occupants shift.
    // A rod boom carrying the user's pusher lost 2.8 g a side to idle burn,
    // the offsets drifted 15 um off centre, and the projection - applied at
    // 1440 Hz with gain al/dt - pushed 730 kg.m/s into the parked aeroplane
    // in ten seconds: it crept 0.8 m aft at rest and, with 985 N on the
    // boom-mounted engine, was thrown onto its nose ("thrust is going
    // nowhere"). Recentred here the injection is 0.0000 to the bit,
    // whatever the masses do. One more pass over the cluster's ~20 nodes.
    let qbx = 0, qby = 0, qbz = 0;
    for (let k = 0; k < n2; k++) {
      const mi = m[C.idx[k]];
      qbx += mi * C.q[k*3]; qby += mi * C.q[k*3+1]; qbz += mi * C.q[k*3+2];
    }
    qbx /= M; qby /= M; qbz /= M;
    // A = sum m (x - c) q^T
    const A = [0, 0, 0, 0, 0, 0, 0, 0, 0];
    for (let k = 0; k < n2; k++) {
      const i = C.idx[k], mi = m[i];
      const dx = p[i*3] - cx, dy = p[i*3+1] - cy, dz = p[i*3+2] - cz;
      const qx = C.q[k*3] - qbx, qy = C.q[k*3+1] - qby, qz = C.q[k*3+2] - qbz;
      A[0] += mi*dx*qx; A[1] += mi*dx*qy; A[2] += mi*dx*qz;
      A[3] += mi*dy*qx; A[4] += mi*dy*qy; A[5] += mi*dy*qz;
      A[6] += mi*dz*qx; A[7] += mi*dz*qy; A[8] += mi*dz*qz;
    }
    const R = C.R = extractRotation(A, C.R, 4);
    const al = C.omega > 0 ? Math.min(1, (C.omega * dt) * (C.omega * dt)) : 1, inv = al / dt;
    // G1840 (DMG-D3): on a measured substep, the projection's force on a node of a cut's part (m al e / dt^2) is that
    // cut's reaction - reported to it (clAcc) by the same loop's twin below; the quiet loop is the base's, untouched
    if (C.ms && C.nm) { shapeGoalReport(C, R, al, inv, dt, cx, cy, cz, qbx, qby, qbz); return; }
    for (let k = 0; k < n2; k++) {
      const i = C.idx[k], i3 = i*3;
      const qx = C.q[k*3] - qbx, qy = C.q[k*3+1] - qby, qz = C.q[k*3+2] - qbz;
      const gx = R[0]*qx + R[1]*qy + R[2]*qz + cx;
      const gy = R[3]*qx + R[4]*qy + R[5]*qz + cy;
      const gz = R[6]*qx + R[7]*qy + R[8]*qz + cz;
      const ex = gx - p[i3], ey = gy - p[i3+1], ez = gz - p[i3+2];
      p[i3] += al * ex; p[i3+1] += al * ey; p[i3+2] += al * ez;
      v[i3] += inv * ex; v[i3+1] += inv * ey; v[i3+2] += inv * ez;
    }
  }
  // (G1840: shapeMatch's goal loop, the same arithmetic, reporting each part node's correction to its cuts)
  function shapeGoalReport(C, R, al, inv, dt, cx, cy, cz, qbx, qby, qbz) {
    const nm = C.nm, n2 = C.idx.length;
    for (let k = 0; k < n2; k++) {
      const i = C.idx[k], i3 = i*3;
      const qx = C.q[k*3] - qbx, qy = C.q[k*3+1] - qby, qz = C.q[k*3+2] - qbz;
      const gx = R[0]*qx + R[1]*qy + R[2]*qz + cx;
      const gy = R[3]*qx + R[4]*qy + R[5]*qz + cy;
      const gz = R[6]*qx + R[7]*qy + R[8]*qz + cz;
      const ex = gx - p[i3], ey = gy - p[i3+1], ez = gz - p[i3+2];
      p[i3] += al * ex; p[i3+1] += al * ey; p[i3+2] += al * ez;
      v[i3] += inv * ex; v[i3+1] += inv * ey; v[i3+2] += inv * ez;
      if (nm[i]) { const s = m[i] * inv / dt; clAcc(C, nm[i], i3, s * ex, s * ey, s * ez); }
    }
  }
  // ---- THE MEMBERS YIELD AND BREAK (G1470, TREE-CRASH) ----
  // The user (2026-10-04): "The crash should be as realistic as possible ... I hope the nodes and beam mesh from the
  // plane can deform." Every beam was a pure spring: a trunk stopped the aeroplane and the airframe sprang it back
  // 5-10 m. Now a member whose FORCE passes its yield (sigY x A: GEN_CRASH's row for what it is made of, A its billed
  // section, 61_gen_frame bm.A - the load test's own allowable, per member) takes a SET: its rest length moves by
  // the return mapping of an elastic / linearly hardening member, so the bend stays and the work that moved it is
  // gone from the rebound. Tension hardens from ty to tu over the material's uniform elongation and breaks there;
  // compression is perfectly plastic at cy until the member has kinked (ecu) and breaks there. A brittle member
  // (spruce in tension, carbon) breaks at its yield. A broken member's k and c go to 0 (restored by reset()).
  // THE COST: in a frame ARMED (armFrame below: a trunk or an obstacle in reach, a scrape, a member past half its
  // yield) one product and two compares per beam per substep in the beam loop that already has the length; unarmed,
  // one pass over the beams a frame. A member under its yield (every member of every validated build in flight, on a
  // hard landing at the gear's limit and in the 5.7 g load test - GATE TREECRASH) never yields, and its bits are the old ones.
  // `params.damage === false` turns it off (every limit Infinity); G1898: so does leaving it unset while the default is off. A hand fiche (no bm.A) has no limits.
  // G1898: on only when asked (params.damage, else the page's ?damage, else GEN_DAMAGE_DEFAULT - 60_gen_spec.js)
  const DMG_ON = (P_.damage ?? (typeof FLYDIY_DAMAGE === 'boolean' ? FLYDIY_DAMAGE
                  : typeof GEN_DAMAGE_DEFAULT !== 'undefined' && GEN_DAMAGE_DEFAULT)) === true && typeof GEN_CRASH !== 'undefined';
  const nb = beams.length;
  const DMG = { yields: 0, breaks: 0, work: 0, broken: [], firstBreak: null, firstYield: null,
                crashed: false, reason: null, at: null, dented: false, propStrike: false, propAt: null,
                gPeak: 0, setMax: 0, orphans: [], members: 0, dents: 0, primary: 0, firstPrimary: null, holed: 0,
                // DMG-D1a: the groups broken (in order, G1815), the kink floors (G1813), the spruce cracks and their log
                // [member, stage, t] (G1814), the frames armed (the census GATE DMGMEMBERS reads parked)
                groups: [], floors: 0, cracks: 0, rag: [], armedN: 0,
                // DMG-D1b: the body frame's refs parted (G1821: when, which node), the strips split / dropped (G1820)
                brokeUp: null, stripsSplit: 0, stripsDropped: 0 };
  // G1802 (DMG-D0): THE PLASTIC WORK PER BEAM (J), beside the total: what the repair bill sums by the ledger's section
  // (bm.sec, G1803; DEFORM §10). Written only where the total is (beamYield, beamKink: the armed path), zeroed by reset()
  DMG.wB = new Float64Array(nb);
  const dmgW = (bi, w) => { DMG.work += w; DMG.wB[bi] += w; };
  // per node: the members still holding it (an ORPHAN, every member broken, is debris: gravity and the ground
  // only, its aero dropped - a lone node carries a strip's lift on its own few kilos and would be flung)
  const nodeDeg = new Int32Array(n), nodeDeg0 = new Int32Array(n), orphan = new Uint8Array(n);
  // per beam: the cluster both its ends belong to (-1 none) - a set inside a shape-matched cluster re-takes the
  // cluster's rest (else the projection would pull the bend straight), a break releases the cluster
  const beamCl = new Int16Array(nb).fill(-1);
  // the CAPS the beam loop compares against every substep (the yield in tension, in compression - a bend's when lower):
  // contiguous typed arrays, not fields on the beam objects - fields added after the beam was made sit out of line, a
  // pointer and a cache line more per beam per substep (measured: +5-8 % on the step with nothing touching)
  const FY = new Float64Array(nb), FC = new Float64Array(nb);
  // DMG-D2a (G1831): the members' physics limits (yield, break, crush, sigY A) beside the caps, the certificate's floor
  const PHY = DMG_ON ? new Float64Array(nb * 4).fill(Infinity) : null;
  // THE NOSE: a fuselage member with both ends ahead of the firewall (x < 0 in the def's frame) - the engine and its
  // bearer's front, the cowl's stand-ins. It crushes round a trunk at a taxi's pace (the prop strikes, the engine
  // stops) and that is a dent, not a crash; any other member broken is (dmgFrame)
  // G1820 (DMG-D1b, §4.5): THE STRIP COMPONENT TEST, in place of TREE-CRASH's "a strip dies with any member between two
  // of its nodes" (one broken diagonal silenced a bay still whole). On a break EVENT (the outermost beamBreak, its
  // group included; never per substep) a union-find over the live members (and the clusters still holding) gives the
  // pieces. A strip whose weight set now spans two of them is SPLIT - its weights renormalised onto the piece holding
  // most of them - or, if no piece holds 70 %, DROPPED. A strip that reads its chord and normal off its own spar nodes
  // (fIn..rOut: every wing, stab and fin bay of a generated build) is dropped if those part (its frame would be read
  // across the gap); one that reads them off the body axes is dropped off the core's piece. A part that came off whole
  // keeps its strips (a wing that came off tumbles under its own aero). `SW` is what the aero pass spreads with: the
  // build's own st.w arrays until a split
  const stripDead = new Uint8Array(def.strips.length), SW = def.strips.map(st => st.w);
  const STRIP_KEEP = 0.7;
  // G1821 (§4.5): THE REFS-CORE. bodyAxes() averages noseFrame / tailMid / upLo / upHi: every out.* the pilot, the
  // HUD, the camera and the autopilot read comes from them. If a break puts them on two pieces the body frame would
  // average a wreck: the flight ends there, BROKE UP (DMG.brokeUp, the reason 'broke up: ...'). (Not refs.origin, the
  // drawing's datum: it is the wing roots', which a wing coming off takes along - DMG-D4's to re-pin)
  const REFS = [...new Set([].concat(def.refs.noseFrame || [], def.refs.tailMid || [], def.refs.upLo || [], def.refs.upHi || []))].filter(i => i >= 0 && i < n);
  const ufP = new Int32Array(n);
  const ufFind = i => { while (ufP[i] !== i) { ufP[i] = ufP[ufP[i]]; i = ufP[i]; } return i; };
  // the pieces now: live members (a kink floor pushes only, a SUPPORT limiter only touches: neither holds), clusters still on
  function pieces() {
    for (let i = 0; i < n; i++) ufP[i] = i;
    for (let bi = 0; bi < nb; bi++) { const b = beams[bi]; if (b.broken) continue; const x = ufFind(b.a), y = ufFind(b.b); if (x !== y) ufP[x] = y; }
    for (const C of clusters) if (!C.off) { const r0 = ufFind(C.idx[0]); for (const i of C.idx) { const x = ufFind(i); if (x !== r0) ufP[x] = r0; } }
    return ufFind;
  }
  const _cr = new Int32Array(8), _cs = new Float64Array(8);
  let brkDepth = 0;
  function compEvent() {
    const fd = pieces();
    const core = REFS.length ? fd(REFS[0]) : -1;
    if (REFS.length && !DMG.brokeUp) for (const i of REFS) if (fd(i) !== core) {
      DMG.brokeUp = { t: simT, node: i, tag: def.nodes[i].tag || null };
      if (!DMG.crashed) { DMG.crashed = true; DMG.at = simT; }
      DMG.reason = 'broke up: the fuselage parted (' + (def.nodes[i].tag || 'node ' + i) + ' off the core)';
      DMG.over = true;                               // the body frame does not average a wreck: the flight ends now
      break;
    }
    for (let si = 0; si < def.strips.length; si++) {
      if (stripDead[si]) continue;
      const st = def.strips[si], W = st.w;
      // the weight on each piece the strip's nodes sit on (a strip has a handful of nodes)
      let nr = 0, tot = 0;
      for (let q = 0; q < W.length; q++) {
        const r = fd(W[q][0]), w = W[q][1]; tot += w; let h = 0;
        while (h < nr && _cr[h] !== r) h++;
        if (h === nr) { if (nr === 8) { h = 7; } else { _cr[nr] = r; _cs[nr++] = 0; } }
        _cs[h] += w;
      }
      let keep = _cr[0], best = _cs[0];
      for (let h = 1; h < nr; h++) if (_cs[h] > best) { best = _cs[h]; keep = _cr[h]; }
      const whole = nr === 1;
      const frameOff = st.fIn != null ? (fd(st.fIn) !== keep || fd(st.fOut) !== keep || fd(st.rIn) !== keep || fd(st.rOut) !== keep) : (core >= 0 && keep !== core);
      if ((!whole && !(best >= STRIP_KEEP * tot)) || frameOff) { stripDead[si] = 1; SW[si] = W; DMG.stripsDropped++; continue; }
      if (whole) continue;
      if (SW[si] !== W && SW[si].every(x => fd(x[0]) === keep)) continue;   // split before, nothing new
      SW[si] = W.filter(x => fd(x[0]) === keep).map(x => [x[0], x[1] / best]);
      DMG.stripsSplit++;
    }
    aicHash = NaN;                                   // the induction's control points move with the weights
    if (typeof WB !== 'undefined' && WB && HYDRO.wetCut) HYDRO.wetCut(WB, fd, orphan);   // G1898.5: the wet body over the break
  }
  const noseB = new Uint8Array(nb);
  // ---- DMG-D1a MEMBERS (G1810-G1815): the members' own limits, stamped once here (nothing new per substep) ----
  // THE BUILD'S SEED (G1811, G1814): the scatter of a glue line and of a spruce member is the build's own and never
  // changes between runs: an FNV hash of the nodes as built and the member count, then one per member and purpose
  let dmgSeed = 0x811c9dc5 ^ nb;
  if (DMG_ON) for (const nd of def.nodes) for (let k = 0; k < 3; k++) { dmgSeed = Math.imul(dmgSeed ^ (Math.round(nd.p[k] * 1e6) | 0), 16777619) >>> 0; }
  const dmgRnd = (bi, salt) => { let h = Math.imul(dmgSeed ^ Math.imul(bi + 1, 0x9e3779b1), 0x85ebca6b) ^ Math.imul(salt, 0xc2b2ae35);
    h = Math.imul(h ^ (h >>> 16), 0x7feb352d); h = Math.imul(h ^ (h >>> 15), 0x846ca68b); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
  // G1812 (§4.1): A MEMBER IN COMPRESSION BUCKLES BEFORE IT CRUSHES once it is slender: Fc = min(cy A, pi^2 E I / L^2),
  // pinned (K = 1), E the material's own (GEN_MATERIALS phys), I a thin tube's of the member's own A at D / wall =
  // GEN_CRASH_TUBE_DT (the bend's section, G1471): A = pi D t, so I = pi D^3 t / 8 = A D^2 / 8 with D^2 = DT A / pi. A
  // 0.7 m 1" x 0.035" 4130 tube buckles at ~0.75 of its crush force; the long ones far lower. ONLY WHERE THE MEMBER IS A
  // TUBE: the welded / bolted truss of a tube row (4130, 6061: the lattice's fuselage members are its longerons,
  // posts and diagonals), the engine bearer (4130 on every aeroplane), the cabane and interplane struts. Measured
  // otherwise: the tail truss's root members (1.3-1.6 m stand-ins for the stab's attach), the strut fan's hidden
  // members (to 5.8 m: the lumped stand-in for a spar box) and the monocoque's members (a skin-stringer panel, not a
  // tube - §6.4) read 2-7x a thin tube's Euler load in a FAR 23.473 drop and at 5.7 g on the bench. NOT THE DRAWN
  // LIFT STRUTS EITHER: in the lattice they work in COMPRESSION at positive g (the metal Cessna's 21-28 kN at 5.7 g on
  // the bench, 15-21 kN in a flown 5.25 g pull; the Cub's front strut 1.2 kN at 4 g) - the boxed outer panel's upper
  // caps push the crank's upper nodes inboard and the hidden lower chord is the tension member (G140: "the strut is
  // the lower chord") - and a thin tube of their A (79-204 mm2, 2.6-4 m) buckles at 0.9-5 kN: the Cessna's struts
  // kinked at 2.7 g in flight. A real strut's compression case (negative g, a jury strut, a streamline section) is the
  // certificate's, DMG-D2. Not a wire (no compression), not the gear (its limits are the gear bracket's, DMG-D2b: a
  // leg is a spring standing for a whole leg)
  // G1811 (§7.2): THE SEAMS. A FITTING (a bolt or a lug in shear) is brittle: it breaks at its strength with no set,
  // Fu = 1.15 x its member's physics Fu (FAR 23.625's fitting factor; DMG-D2 replaces it with the certificate's); in
  // compression the member it ends is what buckles. A RIVET line's joint efficiency ~0.7 of the sheet's Fu, a short
  // plastic travel (2 %); a BOND (a glue line, a composite skin joint) brittle at 0.6-0.8 of its member's Fu, the
  // glue's quality a seeded scatter; an OPENING's frame takes a stress concentration Kt 1.5-2 on Fu (seeded), a short
  // travel if its metal has any. (Summaries' ranges, not certified numbers: §1, §11.2 #7.)
  // G1814 (§7.1 #6): SPRUCE IN TENSION does not snap clean: +-15 % seeded strength (grain, knots), then it breaks in
  // 2 or 3 stages (seeded): it cracks to 60 % of its strength, pulls out at that over RAG_SLIP of its length, (to 30 %
  // and pulls out again,) then lets go
  const RAG_SLIP = 0.005;
  function dmgMember(bi, b, R) {
    const Lb = b.L > 0 ? b.L : 0, ph = typeof GEN_MATERIALS !== 'undefined' && GEN_MATERIALS[b.mat] ? GEN_MATERIALS[b.mat].phys : null;
    const tube = b.cls === 'cabane' || b.cls === 'interplane' || (b.cls === 'fus' && (b.mat === 'tubeFabric' || b.mat === 'aluTube'));
    if (tube && !b.tens && ph && ph.E > 0 && Lb > 0) {
      const fe = Math.PI * Math.PI * ph.E * (b.A * (GEN_CRASH_TUBE_DT * b.A / Math.PI) / 8) / (Lb * Lb);
      if (fe < b.fc0) b.fc0 = fe;
    }
    const fu = R.tu * b.A;
    if (b.seam === 'fitting') { b.fy0 = b.fu = 1.15 * fu; b.etu = 0; }
    else if (b.seam === 'rivet') { b.fu = 0.7 * fu; b.fy0 = Math.min(b.fy0, 0.9 * b.fu); b.etu = R.etu > 0 ? Math.min(R.etu, 0.02) : 0; if (!(b.etu > 0)) b.fy0 = b.fu; }
    else if (b.seam === 'bond') { b.fy0 = b.fu = (0.6 + 0.2 * dmgRnd(bi, 1)) * fu; b.etu = 0; }
    else if (b.seam === 'opening') { b.fu = fu / (1.5 + 0.5 * dmgRnd(bi, 2)); b.fy0 = Math.min(b.fy0, 0.9 * b.fu); b.etu = R.etu > 0 ? Math.min(R.etu, 0.02) : 0; if (!(b.etu > 0)) b.fy0 = b.fu; }
    if (b.mat === 'wood' && b.seam !== 'fitting' && b.seam !== 'bond' && !(b.etu > 0)) {
      b.fy0 *= 1 + 0.15 * (2 * dmgRnd(bi, 3) - 1); b.fu = b.fy0;
      b.rgN = dmgRnd(bi, 4) < 0.5 ? 2 : 3;
    }
  }
  // G1815 (§4.4): THE BREAK GROUPS (61_gen_frame's table): a member that breaks its group (type 0: bm.grp) takes every
  // member of the group with it, the pair's own links (type 1) included, which break no group themselves
  const DGR = DMG_ON && def.parts && def.parts.dmg ? def.parts.dmg.groups : [];
  const grpOf = new Int32Array(nb).fill(-1), grpAll = DGR.map(G => G.t0.concat(G.t1)), grpDone = new Uint8Array(DGR.length);
  if (DGR.length) for (let bi = 0; bi < nb; bi++) { const g = beams[bi].grp; if (g >= 0 && g < DGR.length) grpOf[bi] = g; }
  // G1813 (§4.0): THE KINK FLOOR: a member that KINKED in compression (past ecu) is broken but keeps a compression-only
  // floor at its crushed length (its old k and c, pushing only): the nodes it held apart cannot pass through each
  // other (RoR never lets a crushed member go slack). In tension: nothing. The list is walked after the beam loop only
  // while it is not empty
  const FLR = new Int32Array(nb);
  let nFlr = 0;
  // G1898.4 (coordinator, perf): ONE hook in substep() for the floors (D1a) and the limiters (D1b) - set at the frame's
  // start (after armFrame) and on a break, read once a substep; two checks there cost the metal Cessna ~1 %
  let postLive = 0;
  // G1822 (DMG-D1b, §4.6 / §8.1): THE SUPPORT LIMITERS (61_gen_frame's parts.dmg.supp: the nose engine held off the
  // firewall, on the cabin's first ring), with the damage layer on. The mirror of a slack wire (G185): compression only,
  // carrying nothing until its gap closes (L0 the gap short of the length as built, `pre` as a wire's rigging), then
  // the stiffest member's k (and c) at either end - the cabin ring's, as a rule (the engine bearer's held only part of
  // it: the metal Cessna's engine CG node, pinned by a trunk at 30 m/s with the whole cabin behind it, ended 0.28 m
  // past the firewall on the bearer's k, 0.11 m on the ring's); pushing only, its damper never pulls. NOT MEMBERS:
  // first written as members in the beam loop (`(b.supp && L >= b.L0) ? 0`, the doc's one line), they cost the stock
  // step 5-7 % with nothing touching (12 more objects of another shape in the hottest loop; the compare itself nothing
  // measurable). So they are walked in their own pass, as the kink floors, and only in a frame ARMED or after a break:
  // a gap closes only once the engine's mount has yielded or broken (slack at 1.07-1.51 of their closing length in
  // the load test to 5.7 g, a flown pull and FAR 23.473's drop - GATE DMGINTEGRITY). They hold nothing (the orphan count,
  // the component test) and no trunk bends them
  const SUP = [];
  if (DMG_ON && def.parts && def.parts.dmg && def.parts.dmg.supp && def.parts.dmg.supp.length) {
    const kN = new Float64Array(n), cN = new Float64Array(n);
    for (const b of beams) for (const i of [b.a, b.b]) { if (b.k > kN[i]) kN[i] = b.k; if (b.c > cN[i]) cN[i] = b.c; }
    for (const S of def.parts.dmg.supp) {
      const A = def.nodes[S.a].p, B = def.nodes[S.b].p;
      SUP.push({ a: S.a, b: S.b, k: Math.max(kN[S.a], kN[S.b]), c: Math.max(cN[S.a], cN[S.b]), L0: Math.hypot(B[0] - A[0], B[1] - A[1], B[2] - A[2]) * (1 - S.pre), path: S.path });
    }
  }
  const nSup = SUP.length;
  for (let bi = 0; bi < nb; bi++) { const b = beams[bi]; if (b.cls === 'fus' && def.nodes[b.a].p[0] < -0.05 && def.nodes[b.b].p[0] < -0.05) noseB[bi] = 1; }
  {
    const nodeCl = new Int16Array(n).fill(-1);
    clusters.forEach((C, ci) => { for (const i of C.idx) nodeCl[i] = ci; });
    for (let bi = 0; bi < nb; bi++) {
      const b = beams[bi]; nodeDeg0[b.a]++; nodeDeg0[b.b]++;
      if (nodeCl[b.a] >= 0 && nodeCl[b.a] === nodeCl[b.b]) beamCl[bi] = nodeCl[b.a];
      const R = DMG_ON && b.A > 0 && b.mat ? GEN_CRASH[b.mat] : null;
      b.fy0 = R && R.ty ? R.ty * b.A : Infinity;     // tension yield, N
      b.fu = R && R.tu ? R.tu * b.A : Infinity;      // tension ultimate, N
      b.etu = R ? R.etu : 0;                         // plastic strain at the tensile break
      b.fc0 = R && R.cy ? R.cy * b.A : Infinity;     // compression yield (crush / kink), N
      b.ecu = R ? R.ecu : 0;                         // plastic shortening at the kink
      // BENT SIDEWAYS (a trunk pushes a member at a point along it, which an axial spring cannot feel): the member's
      // plastic moment M_p = sigma x Z_p, Z_p a thin tube's (A D / pi) of D / wall = GEN_CRASH_TUBE_DT and the member's
      // own A; its hinge tears through at GEN_CRASH's fold angle (thf)
      const Dt = R ? Math.sqrt(GEN_CRASH_TUBE_DT * b.A / Math.PI) : 0;
      b.mp = R && R.ty ? R.ty * b.A * Dt / Math.PI : Infinity;
      b.thf = R ? R.thf : 0;
      b.rgN = 0; b.rgS = 0; b.rgD = 0; b.kink = false; b.Lf = 0; b.Ff = 0;
      if (R) dmgMember(bi, b, R);                    // G1811-G1814 (DMG-D1a): Euler, the seams, wood's ragged break
      if (PHY && R) { PHY[bi * 4] = b.fy0; PHY[bi * 4 + 1] = b.fu; PHY[bi * 4 + 2] = b.fc0; PHY[bi * 4 + 3] = R.ty * b.A; }
      b.fyM = b.fy0; FY[bi] = b.fy0; FC[bi] = b.fc0; b.ep = 0; b.ec = 0; b.Lr = 0; b.broken = false; b.kB = 0; b.cB = 0; b.yielded = false;
      b.dOn = false; b.dTx = 0; b.dTz = 0; b.dNx = 0; b.dNz = 0; b.dk = 0; b.ks = 0; b.kt = 0.25; b.kt1 = 0.5;
    }
  }
  // ---- DMG-D2a THE CERTIFICATE (G1831; DEFORM §4.3 (c), 66_gen_cert.js): each member anchored to the loads the
  // aeroplane is certified for, the physics (TREE-CRASH's material x section, D1a's seams and Euler) its floor and its
  // ceiling. Stamped here when the def carries a certificate (genCertAttach) or later on a sim that has not yet bent
  // (sim.certStamp: the page's certificate arrives from its worker after the flight has started). Per member (not the
  // gear's: its limits are the gear bracket's, DMG-D2b), F_l its tension / compression envelope at the limit, m the
  // card's margin, kappa the floor (GEN_CERT):
  //   tension, ductile: yield at max(F_l x yTol, kappa x its physics yield), break at max(1.5 F_l m x uMember, kappa x
  //     its physics break), hardening between over a short travel (GEN_CERT.etu: a built-up member, not a coupon);
  //   tension, brittle (spruce, carbon): the break alone, no set (spruce's +-15 % scatter upward only: a certified spar
  //     is at least its certificate), its ragged stages as before;
  //   a JOINT (a seam: a fitting, a rivet line, a glue line, an opening's frame): brittle at max(1.5 F_l m x uFit, kappa
  //     x its physics) - the part comes off as a part at the card's broke-at (GEN_CERT: the fitting factor's reading);
  //   compression: crushes (perfectly plastic, to the kink) at max(1.5 F_l,c m x uMember, kappa x its physics), never
  //     past its physics (Euler and the crush stay the hard ceiling: a slender tube still buckles);
  //   and nothing past its physics either way (a member the certificate asks more of than its section can give is
  //     the bad design the bench finds).
  // Kept apart from the beam objects (no new fields on them: the beam loop's hidden class): the physics in PHY.
  function certStamp(Cc) {
    if (!PHY || !Cc || !Cc.Ft || Cc.Ft.length !== nb || DMG.yields || DMG.breaks || DMG.dents || peakOn) return false;
    const K = typeof GEN_CERT !== 'undefined' ? GEN_CERT : null; if (!K) return false;
    const m = K.m, kap = K.kappa, cap = (x, ph) => Math.min(Math.max(x, kap * ph), ph);
    for (let bi = 0; bi < nb; bi++) {
      const b = beams[bi], fyP = PHY[bi * 4], fuP = PHY[bi * 4 + 1], fcP = PHY[bi * 4 + 2];
      if (!(fyP < Infinity) || CERT_ENG[bi]) continue;
      if (b.cls === 'gear') { if (CERT_GEAR[bi] && K.leg) gearStamp(bi, b, Cc.Ft[bi], Cc.Fc[bi], m, K); continue; }
      const Ft = Cc.Ft[bi], Fc = Cc.Fc[bi], fit = !!b.seam;   // a joint: a fitting, a rivet line, a glue line, an opening (§7.2)
      const brittle = fit || !(b.etu > 0);
      const scat = b.rgN && PHY[bi * 4 + 3] > 0 ? Math.max(1, fyP / PHY[bi * 4 + 3]) : 1;
      b.fu = cap(1.5 * m * Ft * (fit ? K.uFit : K.uMember) * scat, fuP);
      b.fy0 = brittle ? b.fu : Math.min(cap(Ft * K.yTol, fyP), b.fu);
      if (!brittle && !(b.fu > b.fy0)) b.fu = b.fy0 * (1 + 1e-6);
      if (!brittle && K.etu > 0 && b.etu > K.etu) b.etu = K.etu;
      if (!b.tens) b.fc0 = cap(1.5 * m * Fc * K.uMember, fcP);
      b.fyM = b.fy0; FY[bi] = b.fy0; FC[bi] = b.fc0;
    }
    CERT = Cc;
    return true;
  }
  // G1835 (DMG-D2b): THE GEAR BRACKET (DEFORM §7.3). The gear is calibrated by the gear's own cases (66_gen_cert: the
  // drop at the limit sink in the attitudes 23.479-23.483 ask for, the side, braked, tailwheel and nosewheel loads,
  // the taxi over the roughest ground, the water loads), not by the flight's. Every gear member that is a JOINT (D1a's
  // fittings: the members from the axle, the tailwheel, the nosewheel or a float to the body - in the lattice ALL of
  // them carry the gear's load together: the near-vertical snap-blocker and the braces take a landing's push, the
  // cross wires a side load; the member drawn as the spring carries no more than they do) and every pair's own link
  // (the axle bar, the floats' spreaders) is stamped from its envelope F_l, both ways:
  //   IN COMPRESSION the gear GIVES (a wheel's leg, its braces, the nose fork): no set to the limit - it yields where a
  //     section sized for the ultimate yields, 1.5 F_l,c x the steel's ty / tu (GEN_CERT.leg.yUlt: 1.18 for 4130), the
  //     gear on every aeroplane being steel, an oleo or a bungee's steel vee - then it crushes at that load over its
  //     archetype's TRAVEL (GEN_CERT.leg: a spring-steel leg spreads a long way, an oleo bottoms and bends, a bungee's
  //     lug hardly gives) and past it kinks - its group lets go, the gear is off;
  //     a float's struts and spreaders are a truss with no spring: they crush at the ultimate (D2a's rule);
  //   IN TENSION it is the LUG: brittle at the joint's ultimate, 1.5 F_l,t m (dm13) - a side load past 23.485's (the
  //     ground loop), a float's bow digging in, pull a fitting apart;
  //   the floor is a share of the aeroplane's weight (GEN_CERT.leg.floorW: every gear joint holds at least that at its
  //     limit), NOT D1a's kappa x its physics: a gear member's billed tube (137-214 kN on the metal Cessna) is the
  //     gear class's stand-in, ten times what its gear carries, and its floor kept the gear from ever giving.
  // A float's own hull truss (inside its rigid cluster: the shell, D3's part) keeps D1a's physics.
  // THE ENGINE'S OWN BODY (G1836, dm14): a member with both ends on one engine's nodes (ENG / CGE: the propeller's
  // flange pair, the CG locators between the flange and the engine's centre of mass) is the crankcase, not the mount:
  // no certified case loads it (the static cases never; the dynamic ones only as the engine rings on its mount), so
  // its certified yield sat on that ringing - the Cessna on floats' circuit read 0.98 of it after its water
  // touchdown. It keeps its physics; the MOUNT (the bearer and its bolts to the firewall, D1a's fittings) is what the
  // certificate stamps and what lets go.
  const CERT_GEAR = new Uint8Array(nb), CERT_ENG = new Uint8Array(nb), CERT_FLT = new Uint8Array(nb);
  let CERT_NOSE = -1, CERT_ARCH = 'bungee', CERT_W = 0;
  if (PHY) {
    for (const G of DGR) for (const j of G.t1) CERT_GEAR[j] = 1;
    const isEng = i => /^(ENG|CGE)/.test(def.nodes[i].tag || ''), isFlt = i => /^FL[KD]/.test(def.nodes[i].tag || '');
    for (let bi = 0; bi < nb; bi++) { const b = beams[bi];
      if (b.cls === 'gear' && b.seam) CERT_GEAR[bi] = 1;
      if (b.cls !== 'gear') CERT_GEAR[bi] = 0;
      if (CERT_GEAR[bi] && (isFlt(b.a) || isFlt(b.b))) CERT_FLT[bi] = 1;
      if (isEng(b.a) && isEng(b.b)) CERT_ENG[bi] = 1; }
    const R = def.refs || {}, tw = R.tw != null && R.tw >= 0 ? R.tw : -1, Mn = R.mains || [];
    const xm = Mn.length ? Mn.reduce((a, i) => a + def.nodes[i].p[0], 0) / Mn.length : 0;
    if (tw >= 0 && def.nodes[tw].p[0] < xm) CERT_NOSE = tw;
    CERT_ARCH = (def.spec && def.spec.gear && def.spec.gear.suspension) || 'bungee';
    for (const nd of def.nodes) CERT_W += nd.m * 9.81;
  }
  function gearStamp(bi, b, Ft, Fc, m, K) {
    const G = K.leg, Fw = G.floorW * CERT_W, ft = Math.max(Ft, Fw), fc = Math.max(Fc, Fw);
    const A = CERT_NOSE >= 0 && (b.a === CERT_NOSE || b.b === CERT_NOSE) ? G.nose : (G[CERT_ARCH] || G.bungee);
    b.fu = 1.5 * m * ft * K.uFit; b.fy0 = b.fu; b.etu = 0;
    if (!b.tens) {
      if (CERT_FLT[bi]) b.fc0 = 1.5 * m * fc * K.uMember;
      else { b.fc0 = fc * Math.max(G.yTol, G.yUlt); b.ecu = A.travel; }
    }
    b.fyM = b.fy0; FY[bi] = b.fy0; FC[bi] = b.fc0;
  }
  let CERT = null, peakOn = false;
  if (PHY && def.cert) certStamp(def.cert);
  // THE PROBE (params.damageProbe, GATE TREECRASH and its evidence only): nothing yields; every member's peak force
  // over its yield, per substep, tension and compression (the limits read 0 so every beam takes the branch)
  const PEAK = P_.damageProbe ? { t: new Float64Array(nb), c: new Float64Array(nb) } : null;
  if (PEAK) beams.forEach((b, bi) => { b.fyP = b.fy0; b.fcP = b.fc0; b.fy0 = 0; b.fyM = 0; FY[bi] = 0; b.fc0 = 0; FC[bi] = 0; b.mp = Infinity; });
  peakOn = !!PEAK;   // (G1831: a probed sim's limits are its readout; no later stamp)
  let clDirty = false;
  DMG.cl = []; DMG.firstCl = null;   // G1840 (DMG-D3): the cluster cuts parted, in order
  // ---- DMG-D3 CLUSTERS (G1840-G1842): A CLUSTER IS ONE BREAKABLE PART (DEFORM-AND-BREAK §4.7 (i)) ----
  // A shape-matched cluster (the fin, the rod, a twin boom, a float) holds its shape by projection, so the members
  // inside it carry almost nothing and no member limit can see what it carries. It is judged as what it stands for: a
  // part with a ROOT SECTION, the same section whose EI / GJ set its omega and its twist (61_gen_frame `dmg`), and that
  // part's root attachment is a FITTING GROUP (DMG-D1a's): it breaks as D1a breaks a fitting, at CL_FIT (1.15, FAR
  // 23.625) x the section's ULTIMATE capacity at the material's own stresses (GEN_CRASH tu; shear tu / sqrt 3) - the
  // section fully plastic where the material is ductile (a thin tube's Z_p = 4/pi x its I / c), its extreme fibre where
  // it is brittle (spruce, carbon: tu = ty). Its first-yield moment (ty I / c) is reported beside it (clusterCuts' yb,
  // yt) - the census's 'yield' (G1843: why not the break limit, HANDOVER):
  //   'caps'  the fin: two caps of Acap, d apart (its EI) on its front and rear root posts, s apart. Bending about the
  //           chord (a side load) f Acap d; in its own plane f Acap s; torque (the posts' shear couple) f/sqrt3 Acap s
  //   'tube'  the rod: f EI / (E r) both ways (x 4/pi ductile), f/sqrt3 GJ / (G r), G = E / 2.6 (the twist's own G)
  //   'oval'  a twin boom: its oval's EI each way over its semi-axis; f/sqrt3 GJ / (G r_mean)
  //   'bolts' a rigid float (G790's: BeamNG's 'prop'): its attachment - the struts and spreader bars ending on it - read
  //           as a bolt group of the members' own break forces (D1a's b.fu: a fitting's 1.15 tu A): about each axis the
  //           group's polar sum(F rho^2) over the farthest member's rho
  // THE ROOT LOAD is the reaction the rest of the aeroplane puts on the part across the cut, from the forces ACROSS it:
  // the members joining the part to its root (their force this substep), plus - where the cluster spans the cut (the
  // fin's cluster holds its post, the rod's its bulkhead ring) - the projection's own correction on the part's nodes
  // (m al e / dt^2: the force that held it to the rest) and the twist constraint's turn of a ring across the cut. The
  // moment about the root's centroid, split into the torque about the part's axis and the two bending components.
  // Past either limit the part's ROOT ATTACHMENT GROUP breaks (DMG-D1a's group: the fin comes off, the float's struts
  // let go, the boom off its wing bay; the rod has no group - its root bay's members break) and the part comes off as
  // a RIGID BODY: its cluster is re-formed on the part's own nodes (the root's dropped), rest re-taken.
  // G1842: a rod / boom tube also has its MID-SPAN STATION (61_gen_frame dmgStation): the same cut one bay aft of ring
  // k, at the splice's efficiency (eta 0.7) - past it the tube splits into two rigid halves (the bay's members break).
  // G1841: the TWIST CONSTRAINT's own torque per bay (G350: I_red phi / dt^2, which is GJ / L x the excess twist below
  // the cap) against the tube's torque limit (the station's bay at eta): past it the tube tears there (BeamNG's
  // torsionbar strength, N.m) - the cluster splits at that bay (the root bay of the rod is its root).
  // THE COST: measured on the LAST substep of every frame (one pass over the cut members and the cluster's nodes: the
  // quiet path's one per frame, as armFrame's beam pass) and every substep of a frame ARMED (armFrame; a cut past half
  // its limit arms the next frame). Read-only: nothing it computes moves a node. Off (params.damage) it does not exist.
  const CUTS = [], clQ = [], nCl0 = clusters.length, beamCl0 = beamCl.slice();
  const cutOf = new Int32Array(nb);            // an in-cluster member of a root / station cut: the cut + 1
  const CL_FIT = 1.15, SQ3 = Math.sqrt(3);
  let clMs = false, clArm = false, clGuard = -1;
  const nodeSet = a => { const S = new Uint8Array(n); for (const i of a) S[i] = 1; return S; };
  // the members across a cut: one end in P, the other in R (R null: anywhere outside P); xs +1 when P holds end a
  function cutMembers(inP, inR) {
    const X = [], xs = [];
    for (let bi = 0; bi < nb; bi++) {
      const b = beams[bi], pa = inP[b.a], pb = inP[b.b];
      if (pa === pb) continue;
      const o = pa ? b.b : b.a;
      if (inR && !inR[o]) continue;
      X.push(bi); xs.push(pa ? 1 : -1);
    }
    return { X: Int32Array.from(X), xs: Int8Array.from(xs) };
  }
  // the nodes of a tube cluster aft of its bay k (ring k to k + 1): the rings after it and the cluster's other nodes
  // past the bay's middle along the tube (the rod's tail post; a boom's wing-bay nodes stay forward)
  function aftOf(C, S, k) {
    const R0 = C.rings0, ax = def.nodes[S.ax[1]].p, a0 = def.nodes[S.ax[0]].p;
    let ux = ax[0] - a0[0], uy = ax[1] - a0[1], uz = ax[2] - a0[2]; const ul = hyp3(ux, uy, uz) || 1; ux /= ul; uy /= ul; uz /= ul;
    const cen = r => { let s = 0; for (const i of r) { const q = def.nodes[i].p; s += q[0] * ux + q[1] * uy + q[2] * uz; } return s / r.length; };
    const sMid = 0.5 * (cen(R0[k]) + cen(R0[k + 1])), inRing = new Uint8Array(n), A = [];
    for (const r of R0) for (const i of r) inRing[i] = 1;
    for (let j = k + 1; j < R0.length; j++) for (const i of R0[j]) A.push(i);
    for (const i of C.idx0) if (!inRing[i]) { const q = def.nodes[i].p; if (q[0] * ux + q[1] * uy + q[2] * uz > sMid) A.push(i); }
    return A;
  }
  function addCut(ci, kind, P, inR, lim, ref, S, bay) {
    const inP = nodeSet(P), { X, xs } = cutMembers(inP, inR), C = clusters[ci];
    // the group the root attachment is (the most common among its members): its break takes the part off whole
    let grp = -1;
    if (kind === 'root') { const cnt = {}; for (const x of X) { const g = grpOf[x]; if (g >= 0) cnt[g] = (cnt[g] || 0) + 1; }
      for (const g in cnt) if (grp < 0 || cnt[g] > cnt[grp]) grp = +g; }
    let span = false; for (const i of C.idx0) if (!inP[i]) { span = true; break; }
    const cut = { cl: ci, kind, P, inP, X, xs, grp, span, bay, ref: ref.nodes, refW: ref.w, ax: S.ax, lat: S.lat,
                  Mu: lim.Mu, Mv: lim.Mv, T: lim.T, yb: lim.yb || 1, yt: lim.yt || 1, aF: new Float64Array(3), aM: new Float64Array(3),
                  done: false, rb: 0, rt: 0, Mb: 0, Tq: 0, pk: 0, pkB: 0, pkT: 0 };
    CUTS.push(cut);
    const k = CUTS.length - 1;
    if (kind !== 'bay') for (const x of X) if (beamCl[x] >= 0) cutOf[x] = k + 1;
    C.cuts.push(k);
    return k;
  }
  if (DMG_ON) clusters.forEach((C, ci) => {
    const S = def.clusters[ci] && def.clusters[ci].dmg;
    C.idx0 = C.idx; C.q0 = C.q; C.rings0 = C.rings; C.rk0 = C.rings.map((r, j) => j); C.rk = C.rk0;
    C.cuts = []; C.nm = null; C.ms = false; C.twL0 = null; C.twPk = 0; C.twR = 0;
    if (!S || !S.ax || !S.lat) return;
    const Rw = S.mat ? GEN_CRASH[S.mat] : null, ty = Rw && Rw.ty, G = S.E / 2.6;
    // the break stress (the fitting's factor on the ultimate) and the section's shape factor (plastic where ductile);
    // yb / yt: the first-yield moment and torque over the break limits (reported)
    const fu = Rw && Rw.tu ? CL_FIT * Rw.tu : 0, sh = Rw && Rw.etu > 0 ? 4 / Math.PI : 1;
    let lim = null;
    if (S.kind === 'caps' && fu) {
      const s = hyp3(def.nodes[S.lat[1]].p[0] - def.nodes[S.lat[0]].p[0], def.nodes[S.lat[1]].p[1] - def.nodes[S.lat[0]].p[1], def.nodes[S.lat[1]].p[2] - def.nodes[S.lat[0]].p[2]);
      lim = { Mu: fu * S.Acap * S.d, Mv: fu * S.Acap * s, T: fu / SQ3 * S.Acap * s, yb: ty / fu, yt: ty / fu };
    } else if (S.kind === 'tube' && fu) {
      const Mb = fu * sh * S.EI / (S.E * S.r);
      lim = { Mu: Mb, Mv: Mb, T: fu / SQ3 * S.GJ / (G * S.r), yb: ty / (fu * sh), yt: ty / fu };
    } else if (S.kind === 'oval' && fu) {
      lim = { Mu: fu * sh * S.EIv / (S.E * S.cv), Mv: fu * sh * S.EIl / (S.E * S.cl), T: fu / SQ3 * S.GJ / (G * S.rT), yb: ty / (fu * sh), yt: ty / fu };
    }
    const inR = S.root ? nodeSet(S.root) : null;
    if (S.kind === 'bolts') {
      // the attachment as a bolt group: the members ending on the part, at their own A and yield, about the keel (a),
      // the deck's beam (u) and the normal (v), round the group's centroid - the rest pose as built
      const inP = nodeSet(S.part), { X, xs } = cutMembers(inP, null), pts = [];
      X.forEach((x, j) => { const b = beams[x]; if (!(b.A > 0) || !(b.fu > 0) || !Number.isFinite(b.fu)) return;
        pts.push({ i: xs[j] > 0 ? b.a : b.b, A: b.A, ty: b.fu / b.A, y: (PEAK ? b.fyP : b.fy0) / b.fu }); });
      if (pts.length < 3) return;
      const pn = i => def.nodes[i].p, A0 = pn(S.ax[0]), A1 = pn(S.ax[1]), L0 = pn(S.lat[0]), L1 = pn(S.lat[1]);
      let a = [A1[0] - A0[0], A1[1] - A0[1], A1[2] - A0[2]], la = hyp3(a[0], a[1], a[2]); a = a.map(x => x / la);
      let u = [L1[0] - L0[0], L1[1] - L0[1], L1[2] - L0[2]]; const du = u[0] * a[0] + u[1] * a[1] + u[2] * a[2];
      u = [u[0] - du * a[0], u[1] - du * a[1], u[2] - du * a[2]]; const lu = hyp3(u[0], u[1], u[2]); u = u.map(x => x / lu);
      const v = [a[1] * u[2] - a[2] * u[1], a[2] * u[0] - a[0] * u[2], a[0] * u[1] - a[1] * u[0]];
      let W = 0; const c = [0, 0, 0];
      for (const q of pts) { const P = pn(q.i); W += q.A; for (let j = 0; j < 3; j++) c[j] += q.A * P[j]; }
      for (let j = 0; j < 3; j++) c[j] /= W;
      const polar = (e, sh) => { let I = 0; const rho = pts.map(q => { const P = pn(q.i), d = [P[0] - c[0], P[1] - c[1], P[2] - c[2]], de = d[0] * e[0] + d[1] * e[1] + d[2] * e[2];
          return hyp3(d[0] - de * e[0], d[1] - de * e[1], d[2] - de * e[2]); });
        pts.forEach((q, j) => { I += q.A * rho[j] * rho[j]; });
        let L = Infinity; pts.forEach((q, j) => { if (rho[j] > 1e-6) L = Math.min(L, q.ty * sh * I / rho[j]); }); return L; };
      const yr = Math.min(...pts.map(q => q.y));
      lim = { Mu: polar(u, 1), Mv: polar(v, 1), T: polar(a, 1 / SQ3), yb: yr, yt: yr };
      addCut(ci, 'root', S.part, null, lim, { nodes: Int32Array.from(pts.map(q => q.i)), w: Float64Array.from(pts.map(q => q.A)) }, S, -1);
      return;
    }
    if (!lim) return;
    const refN = S.ref || S.root, ones = n0 => Float64Array.from(n0.map(() => 1));
    // the root: the rod's root ring is its first ring (its bay 0 is the root's), a boom's root its wing bay
    const r0 = C.rings0.length && S.root ? C.rings0[0].every(i => inR[i]) : false;
    addCut(ci, 'root', S.part, inR, lim, { nodes: Int32Array.from(refN), w: ones(refN) }, S, r0 ? 0 : -1);
    if (S.station >= 0 && S.station + 1 < C.rings0.length) {
      const k = S.station, P = aftOf(C, S, k), inA = nodeSet(P), R2 = [];
      for (const i of C.idx0) if (!inA[i]) R2.push(i);
      addCut(ci, 'station', P, nodeSet(R2), { Mu: S.eta * lim.Mu, Mv: S.eta * lim.Mv, T: S.eta * lim.T, yb: lim.yb, yt: lim.yt },
             { nodes: Int32Array.from(C.rings0[k]), w: ones(Array.from(C.rings0[k])) }, S, k);
    }
    // G1841: the twist constraint's torque limit per bay (the station's bay at the splice's eta)
    if (C.rings0.length >= 2 && C.gj > 0) C.twL0 = C.rings0.slice(1).map((r, k) => (k === S.station ? S.eta : 1) * lim.T);
    C.dmgS = S;
  });
  // the per-node mask of the cuts a cluster's projection reports to (bit j: its cut j's part, where the cluster spans it)
  function clMask(C) {
    C.nm = null;
    for (let j = 0; j < C.cuts.length; j++) { const ct = CUTS[C.cuts[j]]; if (ct.done || !ct.span || ct.kind === 'bay') continue;
      if (!C.nm) C.nm = new Uint8Array(n);
      for (const i of C.idx) if (ct.inP[i]) C.nm[i] |= 1 << j; }
  }
  for (const C of clusters) if (C.cuts && C.cuts.length) clMask(C);
  const nCut0 = CUTS.length;
  // a root cut's group (a float's struts are outside its cluster: the group breaking member by member parts the cut too)
  const grpCut = new Int32Array(DGR.length).fill(-1);
  for (let k = 0; k < nCut0; k++) if (CUTS[k].kind === 'root' && CUTS[k].grp >= 0) grpCut[CUTS[k].grp] = k;
  if (PEAK) { PEAK.cl = new Float64Array(nCut0 * 2); PEAK.tw = new Float64Array(nCl0); }
  // a force on a node of a cut's part (the projection's, the twist's): to every cut of the cluster whose part holds it
  function clAcc(C, bm, i3, fx, fy, fz) {
    const x = p[i3], y = p[i3+1], z = p[i3+2];
    for (let j = 0; bm; j++, bm >>= 1) if (bm & 1) {
      const ct = CUTS[C.cuts[j]], F = ct.aF, M = ct.aM;
      F[0] += fx; F[1] += fy; F[2] += fz;
      M[0] += y * fz - z * fy; M[1] += z * fx - x * fz; M[2] += x * fy - y * fx;
    }
  }
  // (before a measured substep: the state its beam loop reads) the members across each live cut: their force on the part
  function cutX() {
    for (const C of clusters) if (C.cuts) C.ms = !C.off && (C.nm !== null || C.twL0 !== null);
    for (let k = 0; k < CUTS.length; k++) {
      const ct = CUTS[k];
      if (ct.done || ct.kind === 'bay' || clusters[ct.cl].off) continue;
      const F = ct.aF, M = ct.aM;
      F[0] = F[1] = F[2] = 0; M[0] = M[1] = M[2] = 0;
      for (let j = 0; j < ct.X.length; j++) {
        const b = beams[ct.X[j]], a3 = b.a*3, b3 = b.b*3;
        let dx = p[b3]-p[a3], dy = p[b3+1]-p[a3+1], dz = p[b3+2]-p[a3+2];
        const L = hyp3(dx, dy, dz) || 1e-9; dx /= L; dy /= L; dz /= L;
        const vrel = (v[b3]-v[a3])*dx + (v[b3+1]-v[a3+1])*dy + (v[b3+2]-v[a3+2])*dz;
        const Fb = (b.tens && L <= b.L0) ? 0 : b.k * (L - b.L0) + b.c * vrel;
        const s = ct.xs[j] > 0 ? Fb : -Fb, i3 = ct.xs[j] > 0 ? a3 : b3;
        const fx = s * dx, fy = s * dy, fz = s * dz, x = p[i3], y = p[i3+1], z = p[i3+2];
        F[0] += fx; F[1] += fy; F[2] += fz;
        M[0] += y * fz - z * fy; M[1] += z * fx - x * fz; M[2] += x * fy - y * fx;
      }
    }
  }
  // (after a measured substep: its projection has reported) every live cut's moment and torque against its limits
  const _ca = [0, 0, 0], _cu = [0, 0, 0];
  function clCuts() {
    let arm = false;
    for (let k = 0; k < CUTS.length; k++) {
      const ct = CUTS[k];
      if (ct.done || ct.kind === 'bay' || clusters[ct.cl].off) continue;
      let W = 0, cx = 0, cy = 0, cz = 0;
      for (let j = 0; j < ct.ref.length; j++) { const i3 = ct.ref[j] * 3, w = ct.refW[j]; cx += w * p[i3]; cy += w * p[i3+1]; cz += w * p[i3+2]; W += w; }
      cx /= W; cy /= W; cz /= W;
      const F = ct.aF, M = ct.aM;
      const mx = M[0] - (cy * F[2] - cz * F[1]), my = M[1] - (cz * F[0] - cx * F[2]), mz = M[2] - (cx * F[1] - cy * F[0]);
      const a0 = ct.ax[0] * 3, a1 = ct.ax[1] * 3, l0 = ct.lat[0] * 3, l1 = ct.lat[1] * 3;
      let ax = p[a1] - p[a0], ay = p[a1+1] - p[a0+1], az = p[a1+2] - p[a0+2]; const al = hyp3(ax, ay, az) || 1; ax /= al; ay /= al; az /= al;
      let ux = p[l1] - p[l0], uy = p[l1+1] - p[l0+1], uz = p[l1+2] - p[l0+2]; const du = ux * ax + uy * ay + uz * az;
      ux -= du * ax; uy -= du * ay; uz -= du * az; const ul = hyp3(ux, uy, uz) || 1; ux /= ul; uy /= ul; uz /= ul;
      const vx = ay * uz - az * uy, vy = az * ux - ax * uz, vz = ax * uy - ay * ux;
      const Tq = mx * ax + my * ay + mz * az, Mu = mx * ux + my * uy + mz * uz, Mv = mx * vx + my * vy + mz * vz;
      const rb = Math.hypot(Mu / ct.Mu, Mv / ct.Mv), rt = Math.abs(Tq) / ct.T;
      ct.rb = rb; ct.rt = rt; ct.Mb = Math.hypot(Mu, Mv); ct.Tq = Tq;
      if (rb > ct.pkB) ct.pkB = rb; if (rt > ct.pkT) ct.pkT = rt;
      const r = rb > rt ? rb : rt;
      if (r > ct.pk) ct.pk = r;
      if (r > ARM_FRAC) arm = true;
      if (PEAK) { if (k < nCut0) { if (rb > PEAK.cl[k*2]) PEAK.cl[k*2] = rb; if (rt > PEAK.cl[k*2+1]) PEAK.cl[k*2+1] = rt; } }
      else if (r >= 1) cutPart(k, rb >= rt ? 'bend' : 'twist', r);
    }
    for (let ci = 0; ci < clusters.length; ci++) { const C = clusters[ci];
      if (C.ms && C.twR > ARM_FRAC) arm = true;
      if (PEAK && ci < nCl0 && C.twR > PEAK.tw[ci]) PEAK.tw[ci] = C.twR;
      C.ms = false; }
    clArm = arm;
  }
  // A CUT PARTS (its limit passed, a twist bay torn, or one of its members broken as a member): its group / its members
  // break, and at the substep's end its cluster is re-formed (clApply)
  function cutPart(k, why, r) {
    const ct = CUTS[k];
    if (ct.done) return;
    ct.done = true;
    const C = clusters[ct.cl];
    DMG.cl.push({ tag: C.tag, cl: ct.cl, cut: ct.kind, why, ratio: r, Mb: ct.Mb, T: ct.Tq, t: simT, grp: ct.grp >= 0 ? DGR[ct.grp].key : null });
    if (!DMG.firstCl) DMG.firstCl = DMG.cl[DMG.cl.length - 1];
    clQ.push(k);
    const how = ct.kind + '-' + why;
    clGuard = ct.cl;
    if (ct.grp >= 0) { if (!grpDone[ct.grp]) beamBreak(DGR[ct.grp].t0[0], how); }
    for (let j = 0; j < ct.X.length; j++) if (ct.kind !== 'root' || ct.grp < 0) beamBreak(ct.X[j], how);
    clGuard = -1;
  }
  // G1841: a twist bay of cluster ci past its torque: the bay's own cut (the rod's root, the station) or a new one
  function bayPart(ci, k0, r) {
    const C = clusters[ci];
    if (C.cuts) for (const j of C.cuts) if (CUTS[j].bay === k0) { if (!CUTS[j].done) cutPart(j, 'twist', r); return; }
    const S = C.dmgS; if (!S) return;
    const inC = nodeSet(C.idx), P = aftOf(C, S, k0).filter(i => inC[i]), inP = nodeSet(P), R2 = [];
    for (const i of C.idx) if (!inP[i]) R2.push(i);
    if (!P.length || !R2.length) return;
    const k = addCut(ci, 'bay', P, nodeSet(R2), { Mu: Infinity, Mv: Infinity, T: Infinity }, { nodes: new Int32Array(0), w: new Float64Array(0) }, S, k0);
    cutPart(k, 'twist', r);
  }
  function setIdx(C, list) {
    const S = nodeSet(list);
    C.idx = Int32Array.from(list); C.q = new Float64Array(list.length * 3);
    const rings = [], rk = [];
    C.rings.forEach((r, j) => { if (Array.prototype.every.call(r, i => S[i])) { rings.push(r); rk.push(C.rk[j]); } });
    C.rings = rings; C.rk = rk;
  }
  // the parts that came off this substep: a ROOT cut's part keeps its cluster on its own nodes (the root's dropped) - a
  // rigid body that detaches; a STATION's (a bay's) splits the tube into two rigid clusters. A cluster still holding
  // nodes on both sides (a twin boom's fin stands on the station's ring and the ring before) lets go of the fewer
  function clApply() {
    for (const k of clQ) {
      const ct = CUTS[k], C = clusters[ct.cl];
      if (C.off) continue;
      const keep = [], other = [];
      for (const i of C.idx) (ct.inP[i] ? keep : other).push(i);
      if (ct.kind === 'root') {
        for (const j of C.cuts) CUTS[j].done = true;
        if (other.length) setIdx(C, keep);
      } else {
        setIdx(C, other);
        if (keep.length >= 3) {
          const C2 = { cls: C.cls, tag: C.tag + '/aft', idx: null, q: null, R: [1, 0, 0, 0, 1, 0, 0, 0, 1], omega: C.omega,
                       rings: C.rings0, rk: C.rk0, gj: C.gj, twist: null, off: false, dirty: false, cuts: [], nm: null, ms: false,
                       twL0: C.twL0, twPk: 0, twR: 0, dmgS: null };
          setIdx(C2, keep);
          clusters.push(C2); clusterRest(C2); twistRest(C2);
        }
      }
      if (C.idx.length < 3) C.off = true;
      const sideA = ct.inP, sideB = nodeSet(other);
      for (const D of clusters) {
        if (D === C || D.off || D.tag === C.tag + '/aft') continue;
        let nA = 0, nB = 0; for (const i of D.idx) { if (sideA[i]) nA++; else if (sideB[i]) nB++; }
        if (nA && nB) { const drop = nA < nB ? sideA : sideB; setIdx(D, Array.from(D.idx).filter(i => !drop[i])); if (D.idx.length < 3) D.off = true; else { clusterRest(D); twistRest(D); } }
      }
      if (!C.off) { clusterRest(C); twistRest(C); }
    }
    clQ.length = 0;
    // which cluster each member is inside now (the rule makeSim's own)
    const nodeCl = new Int16Array(n).fill(-1);
    clusters.forEach((C, ci) => { for (const i of C.idx) nodeCl[i] = ci; });
    for (let bi = 0; bi < nb; bi++) { const b = beams[bi]; beamCl[bi] = nodeCl[b.a] >= 0 && nodeCl[b.a] === nodeCl[b.b] ? nodeCl[b.a] : -1; }
    for (const C of clusters) if (C.cuts && C.cuts.length) clMask(C);
  }
  // reset(): every cluster as built, every cut whole
  function clReset() {
    clusters.length = nCl0;
    CUTS.length = nCut0;
    for (const C of clusters) if (C.idx0) { C.idx = C.idx0; C.q = C.q0; C.rings = C.rings0; C.rk = C.rk0; C.cuts = C.cuts.filter(k => k < nCut0); C.twPk = 0; C.twR = 0; C.ms = false; }
    for (const ct of CUTS) { ct.done = false; ct.rb = ct.rt = ct.Mb = ct.Tq = ct.pk = ct.pkB = ct.pkT = 0; }
    beamCl.set(beamCl0);
    for (const C of clusters) if (C.cuts && C.cuts.length) clMask(C);
    clQ.length = 0; clArm = false; clGuard = -1; DMG.cl.length = 0; DMG.firstCl = null;
  }
  function dmgReset() {
    for (let bi = 0; bi < nb; bi++) {
      const b = beams[bi];
      if (b.broken) { b.k = b.kB; b.c = b.cB; b.broken = false; }
      b.fyM = b.fy0; FY[bi] = b.fy0; FC[bi] = b.fc0; b.ep = 0; b.ec = 0; b.dOn = false; b.dk = 0; b.ks = 0;
      b.rgS = 0; b.rgD = 0; b.kink = false; b.Lf = 0; b.Ff = 0;
    }
    nFlr = 0; postLive = 0; grpDone.fill(0); DMG.groups.length = 0; DMG.floors = 0; DMG.cracks = 0; DMG.rag.length = 0; DMG.armedN = 0;
    for (let i = 0; i < n; i++) { nodeDeg[i] = nodeDeg0[i]; orphan[i] = 0; }
    if (DMG_ON) clReset();          // G1840 (DMG-D3): every cluster as built, every cut whole
    for (const C of clusters) { C.off = false; C.dirty = false; }
    clDirty = false; stripDead.fill(0); for (let si = 0; si < SW.length; si++) SW[si] = def.strips[si].w;
    DMG.brokeUp = null; DMG.stripsSplit = 0; DMG.stripsDropped = 0;
    DMG.yields = 0; DMG.breaks = 0; DMG.work = 0; DMG.broken.length = 0; DMG.firstBreak = null; DMG.firstYield = null;
    DMG.crashed = false; DMG.over = false; DMG.reason = null; DMG.at = null; DMG.dented = false; DMG.propStrike = false; DMG.propAt = null;
    DMG.gPeak = 0; DMG.setMax = 0; DMG.orphans.length = 0; DMG.members = 0; DMG.dents = 0; DMG.primary = 0; DMG.firstPrimary = null; DMG.holed = 0; gF = 0; cIx = cIy = cIz = 0;
    for (const b of beams) b.yielded = false;
    DMG.wB.fill(0);   // G1802
  }
  // (G1816) why a member broke, for the break-order gate: 'fold' (bent round a trunk past its fold angle), 'kink'
  // (crushed past ecu), 'ragged' (spruce's last stage), 'tension' (brittle at its strength, or ductile at etu), 'group'
  function beamBreak(bi, how) {
    const b = beams[bi];
    if (b.broken) return;
    b.kB = b.k; b.cB = b.c; b.k = 0; b.c = 0; b.broken = true;
    DMG.breaks++; DMG.broken.push(bi);
    if (!DMG.firstBreak) DMG.firstBreak = { beam: bi, cls: b.cls, t: simT, seam: b.seam || null, grp: grpOf[bi], how: how || 'tension' };
    if (b.kink) { FLR[nFlr++] = bi; DMG.floors++; }  // G1813: the crushed member stays a floor
    postLive = 1;                                     // G1898.4: a break may need the floors or the limiters
    if (!noseB[bi]) { DMG.primary++; if (!DMG.firstPrimary) DMG.firstPrimary = { beam: bi, cls: b.cls, t: simT }; }
    // G1840 (DMG-D3): a member of a cluster's root or station cut parts that cut (the part comes off, the tube splits);
    // any other member inside a cluster lets the cluster go (G1470)
    // (a cut's member another cluster also holds - a twin boom's fin stands across its station - parts the cut too: the
    // re-form makes that cluster let go of the fewer side)
    if (beamCl[bi] >= 0) { const ck = cutOf[bi] - 1; if (ck >= 0) cutPart(ck, 'member', 0); else if (beamCl[bi] !== clGuard) clusters[beamCl[bi]].off = true; }
    for (const i of [b.a, b.b]) if (--nodeDeg[i] <= 0 && !orphan[i]) { orphan[i] = 1; DMG.orphans.push(i); }
    // G1815: the member's group breaks whole (once)
    const g = grpOf[bi];
    brkDepth++;
    if (g >= 0 && !grpDone[g]) {
      grpDone[g] = 1; DMG.groups.push({ grp: g, key: DGR[g].key, seam: b.seam || null, by: bi, cls: b.cls, t: simT });
      if (grpCut[g] >= 0) cutPart(grpCut[g], 'member', 0);   // G1840: a cluster's root group broken as members: its part is off
      for (const j of grpAll[g]) beamBreak(j, 'group');
    }
    if (--brkDepth === 0) compEvent();               // G1820 / G1821: once per event, its group whole
  }
  // the return mapping: the member's force k (L - L0) is held at the yield surface by moving L0; returns nothing,
  // the caller re-reads b.L0 / b.k
  // the caps a bent member's chord carries: the material's, and a bend of depth dk straightens (tension) or folds
  // further (compression) at its plastic moment over that depth
  function kinkCaps(bi) { const b = beams[bi], fk = b.dk > 1e-6 ? b.mp / b.dk : Infinity; FY[bi] = b.fyM < fk ? b.fyM : fk; FC[bi] = b.fc0 < fk ? b.fc0 : fk; }
  function hingeCheck(bi) {
    const b = beams[bi], L = b.Lr;
    if (Math.atan(b.dk / (b.kt1 * L)) + Math.atan(b.dk / ((1 - b.kt1) * L)) > b.thf) beamBreak(bi, 'fold');
  }
  function noteSet(bi) {
    const b = beams[bi], set = Math.abs(b.L0 - b.Lr) / b.Lr;
    if (set > DMG.setMax) DMG.setMax = set;
    DMG.yields++;
    if (!b.yielded) { b.yielded = true; DMG.members++; }
    if (!DMG.firstYield) DMG.firstYield = { beam: bi, cls: b.cls, t: simT };
    if (beamCl[bi] >= 0 && !b.broken) { clusters[beamCl[bi]].dirty = true; clDirty = true; }
  }
  // the return mapping: the member's force k (L - L0) is held at the yield surface by moving L0 (the caller re-reads
  // b.L0 / b.k). A bent member flows at its bend's cap first: pulled straight, or folded further (to its tear)
  function beamYield(bi, L, Fs) {
    const b = beams[bi];
    if (PEAK) { if (Fs > 0) { const r = Fs / b.fyP; if (r > PEAK.t[bi]) PEAK.t[bi] = r; } else if (!b.tens) { const r = -Fs / b.fcP; if (r > PEAK.c[bi]) PEAK.c[bi] = r; } return; }
    if (b.tens && Fs < 0) return;                    // a slack wire carries nothing to yield
    let dL;
    if (Fs > 0) {
      const fy = FY[bi];
      if (b.dk > 0 && fy < b.fyM) {                  // the bend pulls straight (no further than straight)
        dL = Math.min((Fs - fy) / b.k, b.ks);
        dmgW(bi, fy * dL); b.L0 += dL; b.ks -= dL;
        if (b.ks <= 1e-12) { b.ks = 0; b.dk = 0; } else b.dk = Math.sqrt(2 * b.Lr * b.kt * b.ks);
        kinkCaps(bi);
      } else if (b.rgN) {                            // G1814: spruce cracks, pulls out, lets go
        const crack = b.rgS === 0;
        if (crack) { b.rgS = 1; b.rgD = 0; b.fyM = 0.6 * b.fy0; kinkCaps(bi); DMG.cracks++; if (DMG.rag.length < 4096) DMG.rag.push(bi, 1, simT); }
        const cap = FY[bi];
        if (Fs > cap) {
          dL = (Fs - cap) / b.k; dmgW(bi, cap * dL); b.L0 += dL;   // G1898.1 (integration): the pull-out's work per beam too (D0 x D1a)
          if (!crack) b.rgD += dL;                   // (the crack's own release is not pull-out)
          if (b.rgD >= RAG_SLIP * b.Lr) {
            b.rgS++; b.rgD = 0;
            if (DMG.rag.length < 4096) DMG.rag.push(bi, b.rgS, simT);
            if (b.rgS >= b.rgN) { beamBreak(bi, 'ragged'); return; }
            b.fyM = 0.3 * b.fy0; kinkCaps(bi); DMG.cracks++;
          }
        }
      } else {
        if (!(b.etu > 0)) { beamBreak(bi); return; } // brittle: the yield IS the break
        const H = (b.fu - b.fy0) / (b.etu * b.Lr);   // N per metre of plastic travel (bilinear hardening)
        dL = (Fs - fy) / (b.k + H);
        dmgW(bi, (fy + 0.5 * H * dL) * dL);
        b.L0 += dL; b.ep += dL / b.Lr; b.fyM = b.fy0 + H * b.ep * b.Lr; kinkCaps(bi);
        if (b.ep >= b.etu) beamBreak(bi);
      }
    } else {
      const fc = FC[bi];
      dL = (-Fs - fc) / b.k;
      dmgW(bi, fc * dL); b.L0 -= dL;
      if (b.dk > 0 && fc < b.fc0) {                // the bend folds further
        b.ks += dL; b.dk = Math.sqrt(2 * b.Lr * b.kt * b.ks); kinkCaps(bi); hingeCheck(bi);
      } else {
        b.ec += dL / b.Lr;
        if (b.ec >= b.ecu) { b.kink = true; b.Lf = L; b.Ff = fc; beamBreak(bi, 'kink'); }   // G1813: kinked - a floor at its crushed length (G1898.6: its crush force kept)
      }
    }
    noteSet(bi);
  }
  // A TRUNK BENDS A MEMBER (from the contact pass): the member is pushed at t along it past its collapse load
  // P_c = M_p / (L t (1 - t)): the bend's depth grows to `dk` (the trunk's way into the member's line, less what the
  // spring carries at P_c), the work P_c x the new depth is gone, and past the material's fold angle it has torn. The
  // bend's chord deficit (ks = dk^2 / (2 L t (1 - t))) is its STATE, not a move of L0: the nodes held apart by the
  // rest of the airframe stretch the bent member, whose chord then carries no more than M_p / dk - it pulls straight
  // or folds on (beamYield) at that force, and the frame round it moves as far as that lets it
  function beamKink(bi, dk, Pc) {
    const b = beams[bi];
    dmgW(bi, Pc * (dk - b.dk)); b.dk = dk;
    b.ks = Math.max(b.ks, dk * dk / (2 * b.Lr * b.kt));
    kinkCaps(bi);
    DMG.dents++;
    noteSet(bi);
    hingeCheck(bi);
  }
  // THE IMPACT'S g: what the ground, the trunks and the obstacles pushed on the aeroplane this frame (their impulse over
  // the frame, over its weight), filtered over ~50 ms - 1 parked, 0 in the air. From the contact forces themselves,
  // not the CG's change of speed: a velocity set from outside (a placement, an air start) is no impact
  let gF = 0, cIx = 0, cIy = 0, cIz = 0;
  // THE YIELD IS ARMED A FRAME AT A TIME (the hard gate: the step no slower with nothing touching). The beam loop's compare
  // runs every substep of a frame in which something could yield: a trunk in reach (trunkFrame's pairs), an obstacle in
  // reach, anything but a wheel on the ground in the last frame, a member already over HALF its yield at the frame's start
  // (one pass over the beams a frame, not one a substep), an airframe already damaged, or the probe. Everything the
  // validated builds fly and land on sits under 0.82 of yield (GATE TREECRASH), so a frame unarmed is a frame that could
  // not have yielded - but for a load that jumps from under half its yield past all of it inside one frame with only
  // the wheels down (a drop far past the gear's limit): it yields from the next frame. Measured: the compare a substep
  // cost 4-8 % of the step on the Cub and the metal Cessna; armed by the frame it costs nothing measurable.
  let armed = false, scrape = false;
  const ARM_FRAC = 0.5;
  // THE WATER (G1470 x GEAR-WATER 2, A0): the water reaches the frame as the ground does - forces on the nodes (the floats'
  // panels; the wet body's slam, buoyancy and drag where 32_hydro.js has wetBuild) - so the beams yield and break on
  // the same path. Its push counts in the impact's g (the sum of f across the hydro pass: O(n) a substep, on a frame
  // the water's own arm says can reach the water only), and it ARMS the yield while it is dynamic: in the water and
  // descending over 0.5 m/s, or last frame's contact g over 1.3 - afloat or taxiing on the water it does not.
  // `WB` / `wetArm` are the wet body's (GEAR-WATER 2); without it the guards read false.
  const wetOn = () => typeof wetArm !== 'undefined' && wetArm;
  let _w0x = 0, _w0y = 0, _w0z = 0;
  function waterSum0() { let x = 0, y = 0, z = 0; for (let i = 0; i < n; i++) { x += f[i*3]; y += f[i*3+1]; z += f[i*3+2]; } _w0x = x; _w0y = y; _w0z = z; return true; }
  function waterSum1(dt) { let x = 0, y = 0, z = 0; for (let i = 0; i < n; i++) { x += f[i*3]; y += f[i*3+1]; z += f[i*3+2]; } cIx += (x - _w0x) * dt; cIy += (y - _w0y) * dt; cIz += (z - _w0z) * dt; }
  function waterDynamic() {
    if (!((HY && HY.wet > 0) || wetOn())) return false;
    if (gF > 1.3) return true;
    let vy = 0; for (let i = 0; i < n; i++) vy += v[i*3+1] * m[i];
    return vy / totalM < -0.5;
  }
  function armFrame() {
    armed = false;
    if (!DMG_ON) return;
    if (PEAK || _prN || _obstRecs.length || scrape || DMG.yields || DMG.dents || clArm || waterDynamic()) { armed = true; scrape = false; DMG.armedN++; return; }
    for (let bi = 0; bi < nb; bi++) {
      const b = beams[bi], a3 = b.a * 3, b3 = b.b * 3;
      const Fs = b.k * (hyp3(p[b3] - p[a3], p[b3+1] - p[a3+1], p[b3+2] - p[a3+2]) - b.L0);
      if (Fs > ARM_FRAC * FY[bi] || -Fs > ARM_FRAC * FC[bi]) { armed = true; DMG.armedN++; break; }
    }
  }
  // the nose ring and the engine's nodes: on the ground, the prop has been through it (a nose-over)
  const NOSE_G = new Uint8Array(n);
  if (DMG_ON) for (const i of (def.refs.noseFrame || []).concat(def.refs.engine || [])) if (i >= 0 && i < n) NOSE_G[i] = 1;
  let noseGnd = false;
  // THE CRASH (G1470): when a member other than the nose's BREAKS (noseB: the nose crushing round a trunk is a dent), when
  // the contacts' push passes CRASH_G (the impact's g above, over 50 ms; FAR 23.561's 9 g forward ultimate is what the
  // cabin is built to survive, so past it the occupants are in an accident whatever the airframe did), or when the
  // airframe has soaked up CRASH_J of plastic work (a 3 m/s taxi into a trunk spends 0.7-1.1 kJ, a 5 m/s one 1.5-2).
  // Under all three a set is a DENT (DMG.dented): the aeroplane taxies on, bent. A prop strike stops its engine and is
  // not a crash on its own (a nose-over on the ground is a crash only if it breaks something).
  const CRASH_G = 9, CRASH_J = 1500;
  // G1835 (DMG-D2b): the AIRFRAME's plastic work - the gear's is its energy absorber doing its job (§7.3: a spring-steel
  // leg spreads, an oleo bottoms; a gear joint's crush past its limit is its bracket), not the airframe crushing. Summed
  // only once the total has passed CRASH_J (one pass over the beams, then the answer)
  const gearB = new Uint8Array(nb);
  for (let bi = 0; bi < nb; bi++) if (beams[bi].cls === 'gear') gearB[bi] = 1;
  function airWork() { let w = 0; for (let bi = 0; bi < nb; bi++) if (!gearB[bi]) w += DMG.wB[bi]; return w; }
  function dmgFrame(dtFrame) {
    const gC = dtFrame > 0 ? Math.hypot(cIx, cIy, cIz) / (totalM * 9.81 * dtFrame) : 0;
    cIx = cIy = cIz = 0;
    gF += (gC - gF) * Math.min(1, dtFrame / 0.05);
    if (noseGnd) { noseGnd = false; for (let k = 0; k < eng.length; k++) propStrike(k, 'ground'); }
    if (gF > DMG.gPeak) DMG.gPeak = gF;
    // a holed hull slice (GEAR-WATER 2's S8.br: the slam past its skin's breach pressure) is skin damage - a dent
    if (typeof WB !== 'undefined' && WB && WB.slices) { let h = 0; for (const S8 of WB.slices) if (S8.br) h++; DMG.holed = h; }
    if (DMG.yields || DMG.dents || DMG.holed) DMG.dented = true;
    // G1898: with the layer off there is no crash ending either (a 9 g impact flew on in master: off = master's game)
    if (DMG.crashed || !DMG_ON) return;
    const why = DMG.primary ? 'a ' + (DMG.firstPrimary.cls || 'member') + ' member broke'
      : gF > CRASH_G ? 'an impact of ' + gF.toFixed(0) + ' g'
      : DMG.work > CRASH_J && airWork() > CRASH_J ? 'the airframe crushed (' + (airWork() / 1000).toFixed(1) + ' kJ of plastic work)' : null;
    if (why) { DMG.crashed = true; DMG.reason = why; DMG.at = simT; }
  }
  // ...and the flight is OVER once the wreck has come to rest (the CG under 1 m/s) or 4 s after the crash: the game
  // ends it there (app.js endFlight('crashed')), so the card shows the aeroplane bent as it lies, not the first
  // millisecond of the impact
  function dmgOver() {
    if (!DMG.crashed || DMG.over) return;
    let x = 0, y = 0, z = 0;
    for (let i = 0; i < n; i++) { x += v[i*3] * m[i]; y += v[i*3+1] * m[i]; z += v[i*3+2] * m[i]; }
    if (simT - DMG.at > 4 || (simT - DMG.at > 0.5 && Math.hypot(x, y, z) / totalM < 1)) DMG.over = true;
  }
  const _treeScratch = [], _obstScratch = [], _obstRecs = [], _pen = [0, 0, 0];
  // the obstacles this frame can touch (G433): the registry's bins round the CG, kept to the shapes
  // whose reach covers the aeroplane's own (a node is never 15 m from the CG) - read once a FRAME,
  // not a substep, and only when low enough for the tallest of them
  function obstFrame() {
    _obstRecs.length = 0;
    if (!world || !world.obstacles || !world.obstacles.count || p[1] >= world.obstacles.maxTop + 3) return;
    const OB = world.obstacles, near = OB.near(p[0], p[2], _obstScratch);
    for (const id of near) {
      const r = OB.get(id); if (!r) continue;
      const dx = r.x - p[0], dz = r.z - p[2], reach = r.shape.xr + 15;
      if (dx * dx + dz * dz > reach * reach) continue;
      if (p[1] > r.y0 + r.shape.top + 15) continue;
      _obstRecs.push(r);
    }
  }
  // THE TRUNKS THIS FRAME CAN TOUCH (G1330, TREE-HITBOX): world.treeHits' trunks whose circle comes within the
  // aeroplane's box (its nodes' extent + what it moves in a frame + 1 m) and whose foot..top spans its nodes' heights,
  // read once a FRAME into a fixed buffer (no allocation); each trunk from its centre's cell, so once. Over the woods
  // at height the buffer is empty and the substep's beam walk is skipped whole
  const TK_CAP = 512, _tk = new Float64Array(TK_CAP * 5), PR_CAP = 8192, _pr = new Int32Array(PR_CAP * 2);
  let _tkN = 0, _prN = 0, _tkHits = 0;
  function trunkFrame(dtFrame) {
    _tkN = 0; _prN = 0;
    const TH = world && world.treeHits, TL = TH && TH.list;
    if (!TL || !TL.length) return;
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity, z0 = Infinity, z1 = -Infinity, v2 = 0;
    for (let i = 0; i < n; i++) {
      const x = p[i*3], y = p[i*3+1], z = p[i*3+2];
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; if (z < z0) z0 = z; if (z > z1) z1 = z;
      const s2 = v[i*3]*v[i*3] + v[i*3+1]*v[i*3+1] + v[i*3+2]*v[i*3+2]; if (s2 > v2) v2 = s2;
    }
    const mg = 1 + 2 * Math.sqrt(v2) * dtFrame;
    x0 -= mg; x1 += mg; y0 -= mg; y1 += mg; z0 -= mg; z1 += mg;
    for (let s = 0; s < TL.length && _tkN < TK_CAP; s++) {
      const S = TL[s];
      if (y0 > S.top || x1 < S.x0 || x0 > S.x1 || z1 < S.z0 || z0 > S.z1) continue;
      const A = S.arr, c = S.cell, a0 = Math.max(0, Math.floor((x0 - 0.6) / c) - S.cx0), a1 = Math.min(S.nx - 1, Math.floor((x1 + 0.6) / c) - S.cx0);
      const b0 = Math.max(0, Math.floor((z0 - 0.6) / c) - S.cz0), b1 = Math.min(S.nz - 1, Math.floor((z1 + 0.6) / c) - S.cz0);
      for (let bz = b0; bz <= b1; bz++) for (let ax = a0; ax <= a1; ax++) {
        const cell = bz * S.nx + ax;
        for (let j = S.start[cell], j1 = S.start[cell + 1]; j < j1 && _tkN < TK_CAP; j++) {
          const o = S.idx[j] * 5, tx = A[o], tz = A[o+1], R = A[o+3];
          if ((Math.floor(tz / c) - S.cz0) * S.nx + (Math.floor(tx / c) - S.cx0) !== cell) continue;   // its centre's cell: once
          if (tx + R < x0 || tx - R > x1 || tz + R < z0 || tz - R > z1 || A[o+4] < y0 || A[o+2] - 1 > y1) continue;
          const q = _tkN++ * 5; _tk[q] = tx; _tk[q+1] = tz; _tk[q+2] = A[o+2]; _tk[q+3] = R; _tk[q+4] = A[o+4];
        }
      }
    }
    // ...and paired once with the beams whose box (this frame's, padded by the frame's motion) its circle meets: the
    // substeps walk the pairs alone (a trunk under the wingtip is a few beams, not all 389)
    if (_tkN) for (let bi = 0; bi < beams.length && _prN < PR_CAP; bi++) {
      const b = beams[bi], ia = b.a * 3, ib = b.b * 3;
      if (b.broken) continue;                        // G1470: a broken member is two loose ends, not a bar
      const bx0 = Math.min(p[ia], p[ib]) - mg, bx1 = Math.max(p[ia], p[ib]) + mg, bz0 = Math.min(p[ia+2], p[ib+2]) - mg, bz1 = Math.max(p[ia+2], p[ib+2]) + mg;
      const by0 = Math.min(p[ia+1], p[ib+1]) - mg, by1 = Math.max(p[ia+1], p[ib+1]) + mg;
      for (let k = 0; k < _tkN && _prN < PR_CAP; k++) {
        const o = k * 5, R = _tk[o+3];
        if (_tk[o] + R < bx0 || _tk[o] - R > bx1 || _tk[o+1] + R < bz0 || _tk[o+1] - R > bz1 || _tk[o+4] < by0 || _tk[o+2] - 1 > by1) continue;
        _pr[_prN * 2] = bi; _pr[_prN * 2 + 1] = k; _prN++;
      }
    }
    if (_tkN && DMG_ON) propTrunk();
  }
  // G1470: A PROP STRIKE. The disc (diameter PR.D) about each engine's thrust nodes, from 0.2 m behind them to 1 m
  // ahead along the thrust line - the prop of a nose tractor stands ahead of its mount nodes, a pusher's behind the
  // nacelle node it is rigged on, and the band covers both: a trunk inside it (its circle within the disc's half
  // span of the hub, its height spanning the disc's) stops that engine for good (eng.seized, reset() clears it).
  // Only when trunkFrame found trunks in reach, so never in the open air.
  const ENG_N = def.refs.engine || [], ENG_K = def.refs.engineOf || ENG_N.map(() => 0);
  function propTrunk() {
    bodyAxes();
    let hx = -xAft[0], hz = -xAft[2]; const hl = Math.hypot(hx, hz) || 1; hx /= hl; hz /= hl;
    const Rp = PR.D / 2;
    for (let k = 0; k < eng.length; k++) {
      if (eng[k].seized) continue;
      let cx = 0, cy = 0, cz = 0, c = 0;
      for (let j = 0; j < ENG_N.length; j++) if ((ENG_K[j] | 0) === k) { const e = ENG_N[j] * 3; cx += p[e]; cy += p[e+1]; cz += p[e+2]; c++; }
      if (!c) continue;
      cx /= c; cy /= c; cz /= c;
      for (let t = 0; t < _tkN; t++) {
        const o = t * 5, dx = _tk[o] - cx, dz = _tk[o+1] - cz, ax = dx * hx + dz * hz;
        if (ax < -0.2 - _tk[o+3] || ax > 1 + _tk[o+3]) continue;
        const lx = dx - ax * hx, lz = dz - ax * hz;
        if (Math.hypot(lx, lz) > Rp + _tk[o+3] || cy - Rp > _tk[o+4] || cy + Rp < _tk[o+2]) continue;
        propStrike(k, 'trunk');
        break;
      }
    }
  }
  function propStrike(k, what) {
    const e = eng[k]; if (!e || e.seized) return;
    e.seized = true; e.running = false; e.crank = 0;
    DMG.propStrike = true; if (!DMG.propAt) DMG.propAt = { eng: k, what, t: simT };
  }
  // G194: `eng` is null (every engine running, full lever — bit-identical to
  // before) or [{ on, thr }] per engine, a MULTIPLIER on the pilot's `thr`
  // that the pilots never read or write: the player's levers over the
  // pilot's one throttle.
  // G1938 (PILOT-ONE, the user's ruling 2026-10-05): `brakeD` is the DIFFERENTIAL brake, -1..1 - the toe brakes
  // split: > 0 brakes the main on +z of the built pose harder and the other less, and yaws the aeroplane the way
  // a positive rudder (dr > 0) does - measured, scratch pivot. A main's brake is clamp(brake + side x brakeD, 0, 1); brakeD 0 (every caller before
  // this) is the symmetric brake to the bit. The pivot turn at the end of a one-way strip needs it: on the
  // tailwheel's steering alone the user's Cub turns on a 9.4 m radius, and East Point is 12 m wide
  const ctl = { thr: 0, de: 0, da: 0, dr: 0, brake: 0, flap: 0, eng: null, brakeD: 0 };
  const FP = P_.flaps;   // per-aircraft high-lift deltas; undefined = no flaps
  let simT = 0;          // sim time for the deterministic wind field
  const out = { V: 0, alpha: 0, thrust: 0, wash: 0, alt: 0, vs: 0, thrustPer: [] };
  // THE CLEARANCE CONE (2026-09-14, the gate rationalization). The ground pass
  // below asked the world for the terrain under EVERY node EVERY substep —
  // 73 to 156 times a frame, at 300 m as on the runway — and the noise stack
  // behind terrainH was a third of a flown circuit's CPU. So the ground is
  // sampled once per node per FRAME (gc*: where it was sampled and what it
  // read), and inside the frame a node skips the sample while it is provably
  // clear: the world publishes a slope bound S (world.slopeMax, a Lipschitz
  // constant on terrainH), and a node c metres above its cached sample that
  // has moved d metres sideways since cannot have met the ground while
  // c > S·d. The skipped branch is EXACTLY the `pen <= 0 -> continue` the
  // full sample would have taken (terrainH is pure and nothing else reads
  // gy), so the trajectory is bit-identical — GATE GE flies it both ways and
  // compares every p and v. A world without a bound (the island's raster, a
  // premises layer) gets the old path; so does FLYDIY_EXACT_GROUND=1.
  const GROUND_CONE_EPS = 0.01;
  let coneOn = !(typeof process !== 'undefined' && process.env && process.env.FLYDIY_EXACT_GROUND === '1');
  let coneLive = false, coneS2 = 0;
  const gcx = new Float64Array(n), gcz = new Float64Array(n), gcy = new Float64Array(n);
  // THE GROUND'S CEILING (PHYSICS PERF 2026-09-24) - the cone's sibling for a world that declares no
  // slope bound: the island's raster steps by up to 2 m where a coarse leaf meets a fine one, so no
  // slope bound is true there, but a CEILING is (world.groundMaxRect: the mesh's highest vertex, every
  // premises target over the rectangle). Once a frame, over the nodes' footprint grown by twice the
  // fastest node's travel and half a metre: a node still inside that box whose bottom is above the
  // ceiling cannot touch the ground this substep - EXACTLY the `pen <= 0 -> continue` its sample would
  // take, so the trajectory is the same bits. A node that leaves the box samples as before. Measured on
  // the Jolene roll-out: ~45 % of the solver was this pass.
  let hbLive = false, hbH = 0, hbX0 = 0, hbX1 = 0, hbZ0 = 0, hbZ1 = 0;
  out.gndSampled = 0; out.gndSkipped = 0;
  function setGroundCone(on) { coneOn = !!on; }
  // THE FLOATS (H1, G382): a build on floats carries parts.floats — two
  // rigid node bodies — and the hydro law (32_hydro.js) runs on the hull
  // each float declares, its forces landing on the float's four frame
  // nodes. No floats, no pass, no cost.
  const HY = (typeof HYDRO !== 'undefined' && HYDRO) ? HYDRO.hydroBuild(def, p, v) : null;
  out.hydro = HY;
  // G1381 (GEAR-WATER): a build WITHOUT floats meets the water on its belly, its flying surfaces and its tyres
  // (32_hydro.js wetBuild); a float build keeps the float pass alone. G1384 (SOAR): NOTHING IN DRY AIR - the body is
  // built at the first frame the aeroplane can reach the water (step's arm, below) and the pass runs only on armed
  // frames, so a dry flight builds nothing, samples nothing per substep, writes nothing to `out` and adds no force:
  // its trajectory is master's to the bit. (On the sim, never on `out`: the physics worker posts `out` every
  // snapshot; out.wetDrag / out.wetBuoy carry the numbers once wet.)
  const WB_CAN = !HY && typeof HYDRO !== 'undefined' && !!HYDRO && typeof HYDRO.wetBuild === 'function';
  let WB = null, wetArm = false, WB_REACH = 0;
  if (WB_CAN) {   // the farthest any node (plus its radius) stands from the mass centre as built, +25 % for the flex
    let cx = 0, cy = 0, cz = 0, mm = 0;
    for (const nd of def.nodes) { cx += nd.p[0] * nd.m; cy += nd.p[1] * nd.m; cz += nd.p[2] * nd.m; mm += nd.m; }
    cx /= mm || 1; cy /= mm || 1; cz /= mm || 1;
    for (const nd of def.nodes) WB_REACH = Math.max(WB_REACH, Math.hypot(nd.p[0] - cx, nd.p[1] - cy, nd.p[2] - cz) + (nd.r || 0));
    WB_REACH = 1.25 * WB_REACH + 0.5;
  }
  // once a frame: can any node reach the water this frame? The lowest node and the mass centre each ask the water
  // under them (two waterH samples a frame, never a substep's); armed when the lowest node, less a frame of its
  // fastest descent, a metre and three times the sea's amplitude, is under that level
  function wetArmFrame(dtFrame) {
    wetArm = false;
    if (!WB_CAN || !world || typeof world.waterH !== 'function') return;
    let iLo = 0, yLo = Infinity, vDn = 0, cx = 0, cy = 0, cz = 0, mm = 0;
    for (let i = 0; i < n; i++) {
      const y = p[i*3+1]; if (y < yLo) { yLo = y; iLo = i; }
      if (-v[i*3+1] > vDn) vDn = -v[i*3+1];
      cx += p[i*3] * m[i]; cy += y * m[i]; cz += p[i*3+2] * m[i]; mm += m[i];
    }
    cx /= mm; cy /= mm; cz /= mm;
    const amp = world.sea && world.sea.A > 0 ? 3 * world.sea.A : 0;
    const reach = yLo - 2 * vDn * dtFrame - 1.0 - amp;
    const w1 = world.waterH(p[iLo*3], p[iLo*3+2]);
    let near = w1 > -1e8 && reach < w1;
    if (!near) { const w2 = world.waterH(cx, cz); near = w2 > -1e8 && Math.min(reach, cy - WB_REACH) < w2; }
    if (!near) { if (WB) { WB.tick = 0; WB.wet = 0; } return; }
    if (!WB) { WB = HYDRO.wetBuild(def, p, v, m, fuel); if (WB && DMG.breaks && HYDRO.wetCut) HYDRO.wetCut(WB, pieces(), orphan); }   // G1385: the tanks read the fuel the burn leaves; G1898.5: a wet body built on a broken airframe
    wetArm = !!WB;
  }
  let totalM = 0;
  for (const nd of def.nodes) totalM += nd.m;

  // ---- THE PANEL ARC, session 1 (2026-09-11): WHAT THE INSTRUMENTS READ ----
  // Three sources that did not exist — a shaft speed, a burn, a load factor
  // — and an engine that can be OFF. Everything here defaults to the
  // aeroplane that flew before it existed (every engine running, tanks as
  // built, nz 1) so a gate that never touches it flies the same numbers,
  // except for the burn, which the user ruled runs EVERYWHERE (the P4
  // remainder; the mass gates were re-anchored once, --bless).
  const nE0 = P_.nEngines || 1;
  // per engine: running, the key position (off | l | r | both | start), the
  // cranking timer. `setEngine` below is the ONE writer; the pilots write the
  // same thing the cockpit key writes.
  const eng = [];
  for (let i = 0; i < nE0; i++) eng.push({ running: true, key: 'both', crank: 0, seized: false });   // seized: a prop strike (G1470)
  // the burn: the thermo sheet's rated figure (kg/h of fuel, or kW of pack
  // draw), scaled by the effective throttle and the altitude power ratio
  const THERMO = (typeof genEngineThermo === 'function') ? genEngineThermo(EN) : null;
  const ENERGY = P_.energy || { kind: 'fuel', kgL: 0.72 };
  // which kilos are fuel (G121's records on the def's own nodes) — drained
  // in proportion across every tank, the way the reserve sheet drains them
  const FUEL_IDX = [], FUEL0 = [], DRY0 = [];
  for (let i = 0; i < n; i++) if (def.nodes[i].mFuel > 0) {
    FUEL_IDX.push(i); FUEL0.push(def.nodes[i].mFuel);
    DRY0.push(Math.max(0.5, def.nodes[i].m - def.nodes[i].mFuel));
  }
  const fuelKg0 = FUEL0.reduce((a, b) => a + b, 0);
  const kgL = ENERGY.kgL > 0 ? ENERGY.kgL : 0.72;
  const fuel = { kind: ENERGY.kind || 'fuel', kg0: fuelKg0, kg: fuelKg0,
                 litres0: fuelKg0 / kgL, litres: fuelKg0 / kgL, frac: 1,
                 kWh: ENERGY.kWh || 0, soc: 1, burnKgH: 0, drawKW: 0,
                 // G435: THE ENERGY STATE, SAID. `starved` the moment the tanks or
                 // the pack stop every engine (with the sim second it happened), and
                 // the ENDURANCE at the draw of this substep (seconds; Infinity at
                 // idle) - the user's 2 kWh trainer spiralled into the sea on the
                 // downwind leg with the throttle at 1.00 and nothing that said why
                 starved: false, starvedAt: null, enduranceS: Infinity,
                 // per vessel, in the order the spec lists them: litres now
                 vessels: (ENERGY.vessels || []).map(v => ({ bay: v.bay,
                   litres0: v.litres || 0, litres: v.litres || 0 })) };
  // the load factor and the rates: finite differences over one frame,
  // filtered (a node-beam sim's raw acceleration is the truss ringing)
  let vPrev = null, hdgPrev = null;
  // G1801 (DMG-D0): THE VELOCITY GUARD (DEFORM §5.4): a node faster than VGUARD m/s relative to the CG is a SIM FAULT, not a
  // flight - caught here before it becomes NaN, and the flight ends 'sim-diverged' (app.js, sim_host.js through
  // H.diverged, the rigs through stats().bad). Once a frame (readPanel, beside its CG pass), never a substep: n
  // subtractions and a compare. A NaN velocity trips it too. Read-only: the physics' bits are untouched. The validated
  // builds' worst in their gates is far under it (GATE DMGINST's census: a torn piece whips at ~70 m/s)
  const VGUARD = 150, VGUARD2 = VGUARD * VGUARD;
  const VG = { vMax: 0, node: -1, peak: 0, fault: null };   // this frame's fastest node (m/s rel. the CG), the peak since reset, the fault
  function guardFrame(cv) {
    let mx = 0, im = -1, nan = false;
    for (let i = 0; i < n; i++) {
      const i3 = i * 3, dx = v[i3] - cv[0], dy = v[i3+1] - cv[1], dz = v[i3+2] - cv[2], s2 = dx*dx + dy*dy + dz*dz;
      if (s2 > mx) { mx = s2; im = i; } else if (s2 !== s2) { nan = true; im = i; }
    }
    VG.vMax = Math.sqrt(mx); VG.node = im;
    if (VG.vMax > VG.peak) VG.peak = VG.vMax;
    // G1898.2 (coordinator): the SPEED fault ends a flight only with the damage layer on - with it off an elastic wreck whips
    // its nodes to ~1.8 x the impact speed off the CG (a 45 m/s trunk: 82 m/s), so an ~80 m/s impact would read 'sim-diverged'
    // where master flies on; off = master's game (as G1898's crash verdict). A NaN is a fault either way. The peak is kept.
    if (!VG.fault && (nan || (DMG_ON && mx > VGUARD2))) VG.fault = { why: nan ? 'nan' : 'speed', node: im, v: nan ? NaN : VG.vMax, t: simT };
  }
  out.nz = 1; out.nzMax = 1; out.nzMin = 1; out.r = 0; out.beta = 0;
  out.pitch = 0; out.roll = 0; out.hdg = 0; out.rpm = []; out.rpmEng = [];
  function resetPanel() {
    for (const e of eng) { e.running = true; e.key = 'both'; e.crank = 0; e.seized = false; }
    fuel.frac = 1; fuel.kg = fuel.kg0; fuel.litres = fuel.litres0; fuel.soc = 1;
    fuel.burnKgH = 0; fuel.drawKW = 0;
    fuel.starved = false; fuel.starvedAt = null; fuel.enduranceS = Infinity;
    out.starved = false; out.energyFrac = 1; out.submerged = false;
    for (const vs of fuel.vessels) vs.litres = vs.litres0;
    vPrev = null; hdgPrev = null;
    out.nz = 1; out.nzMax = 1; out.nzMin = 1; out.r = 0;
    VG.vMax = 0; VG.node = -1; VG.peak = 0; VG.fault = null;   // G1801
  }
  // the key, the starter and the hand on the prop. `start: true` cranks
  // (1.5 s, the viewer's `starterOk` deciding whether the bus can), `swing:
  // true` is a hand-prop; both need a live magneto position and fuel. A key
  // turned to 'off' stops the engine. Nothing here touches the throttle.
  function setEngine(i, patch) {
    const e = eng[i]; if (!e || !patch) return;
    if (patch.key !== undefined) {
      e.key = ['off', 'l', 'r', 'both', 'start'].includes(patch.key) ? patch.key : 'both';
      if (e.key === 'off') { e.running = false; e.crank = 0; }
    }
    const canRun = e.key !== 'off' && !e.seized && (fuel.kind === 'battery' ? fuel.soc > 0 : fuel.frac > 0);
    if (patch.running !== undefined) e.running = !!patch.running && canRun;
    if (patch.swing && canRun) e.running = true;
    if (patch.start && canRun && !e.running) {
      const ok = typeof sim.starterOk === 'function' ? sim.starterOk(i) : true;
      if (ok) e.crank = 1.5;
    }
  }
  // per engine, the effective torque demand the burn and the shaft speed
  // share: idle floor + throttle, zero when the engine is not running
  const IDLE_T = (() => {
    const sh = (typeof GEN_SHAFT !== 'undefined') ? GEN_SHAFT : { staticK: 0.92, idleK: 0.28 };
    return Math.pow(sh.idleK / sh.staticK, 2);
  })();
  function thrEffOf(i) {
    const e = eng[i]; if (!e || !e.running) return 0;
    const le = ctl.eng && ctl.eng[i];
    const t = Math.max(0, Math.min(1, ctl.thr * (le ? (le.on ? +le.thr : 0) : 1)));
    return IDLE_T + (1 - IDLE_T) * t;
  }
  // the burn, once per substep: the sheet's rated figure times the mean
  // effective throttle across the engines, times the altitude power ratio
  function burn(dt) {
    if (!THERMO) return;
    let tSum = 0;
    for (let i = 0; i < nE0; i++) {
      const e = eng[i];
      if (e.crank > 0) { e.crank -= dt; if (e.crank <= 0) { e.crank = 0; e.running = true; } }
      tSum += thrEffOf(i);
    }
    const pk = out.powerK >= 0 ? out.powerK : 1;
    if (fuel.kind === 'battery') {
      fuel.drawKW = THERMO.drawKW * tSum * pk;
      if (fuel.kWh > 0 && fuel.drawKW > 0) {
        fuel.soc = Math.max(0, fuel.soc - fuel.drawKW * dt / 3600 / fuel.kWh);
        fuel.enduranceS = fuel.soc * fuel.kWh * 3600 / fuel.drawKW;
        if (fuel.soc <= 0) { for (const e of eng) e.running = false; starve(); }
      } else fuel.enduranceS = Infinity;
      out.energyFrac = fuel.soc;
      return;
    }
    fuel.burnKgH = THERMO.burnKgH * tSum * pk;
    out.energyFrac = fuel.frac;
    fuel.enduranceS = (fuel.kg0 > 0 && fuel.burnKgH > 0) ? fuel.frac * fuel.kg0 * 3600 / fuel.burnKgH : Infinity;
    if (!(fuel.kg0 > 0) || !(fuel.burnKgH > 0)) return;
    const f2 = Math.max(0, fuel.frac - fuel.burnKgH * dt / 3600 / fuel.kg0);
    if (f2 === fuel.frac) return;
    fuel.frac = f2;
    fuel.kg = fuel.kg0 * f2; fuel.litres = fuel.litres0 * f2;
    for (const vs of fuel.vessels) vs.litres = vs.litres0 * f2;
    for (let k = 0; k < FUEL_IDX.length; k++)
      setNodeMass(FUEL_IDX[k], DRY0[k] + FUEL0[k] * f2);
    if (f2 <= 0) { for (const e of eng) e.running = false; starve(); }   // tanks dry
  }
  function starve() {
    if (fuel.starved) return;
    fuel.starved = true; fuel.starvedAt = simT; out.starved = true;
  }
  // the readings that need a frame, not a substep: nz off the CG's own
  // acceleration against the body up, the yaw rate off the heading, the
  // attitude the viewer used to derive itself (43_pilot's formulas)
  function readPanel(dtFrame) {
    bodyAxes();
    const cv = cgVel();
    if (DMG_ON) guardFrame(cv);   // G1801; G1898.10: the layer off runs master's path (the page's NaN watchdog as before)
    if (vPrev && dtFrame > 0) {
      const ax = (cv[0] - vPrev[0]) / dtFrame, ay = (cv[1] - vPrev[1]) / dtFrame,
            az = (cv[2] - vPrev[2]) / dtFrame;
      const nzRaw = (ax * yUp[0] + ay * yUp[1] + az * yUp[2] + 9.81 * yUp[1]) / 9.81;
      const kf = Math.min(1, dtFrame / 0.15);
      out.nz += (nzRaw - out.nz) * kf;
      if (out.nz > out.nzMax) out.nzMax = out.nz;
      if (out.nz < out.nzMin) out.nzMin = out.nz;
    }
    vPrev = cv;
    out.pitch = Math.asin(Math.max(-1, Math.min(1, -xAft[1])));
    out.roll = Math.atan2(-zRt[1], yUp[1]);
    // the heading in the NAV's own convention (38_nav.js: 0 = +x, toward +z)
    const hdg = Math.atan2(-xAft[2], -xAft[0]);
    if (hdgPrev != null && dtFrame > 0) {
      let dh = hdg - hdgPrev;
      while (dh > Math.PI) dh -= 2 * Math.PI;
      while (dh < -Math.PI) dh += 2 * Math.PI;
      out.r += (dh / dtFrame - out.r) * Math.min(1, dtFrame / 0.2);
    }
    hdgPrev = hdg; out.hdg = hdg;
    // sideslip: the air-relative velocity against the right axis
    const ax = cv[0] - (out.windX || 0), ay = cv[1] - (out.windY || 0), az = cv[2] - (out.windZ || 0);
    const Vt = hyp3(ax, ay, az);
    out.beta = Vt > 1 ? Math.asin(Math.max(-1, Math.min(1, (ax * zRt[0] + ay * zRt[1] + az * zRt[2]) / Vt))) : 0;
    // G435: UNDER THE WATER THE FLIGHT IS OVER. A wheeled build in the sea
    // stands on the seabed as on any ground (the floats' hydro is the only
    // water the solver pushes on) and the user "followed the plane to the
    // bottom of the sea, and it was like it continued flying". A metre of
    // water over the mass centre is the fact; the pilot and the game end it.
    if (!HY && world && typeof world.waterH === 'function') {
      const c = cgPos();
      const wh = world.waterH(c[0], c[2]);
      out.submerged = Number.isFinite(wh) && c[1] < wh - 1.0;
    } else out.submerged = false;
  }

  // wingspan datum for ground effect: outermost wing-strip node |z| in def
  // coordinates. Derived, not a fiche param — works for every aircraft.
  // G185: PER PLANE — a sesquiplane's lower wing reads its own span, not the
  // upper's. A monoplane has one entry and the same number as before.
  const bOf = [];
  for (const st of def.strips) if (st.kind === 'wing') {
    const k = st.plane | 0;
    let b = bOf[k] || 0;
    for (const i of [st.fIn, st.fOut, st.rIn, st.rOut])
      b = Math.max(b, Math.abs(def.nodes[i].p[2]));
    bOf[k] = b;
  }
  for (let k = 0; k < bOf.length; k++) bOf[k] = Math.max(0.1, (bOf[k] || 0) * 2);
  const bSpan = bOf[0] || 0.1;

  // G185.5: THE INDUCTION PAIRS. Targets: every wing strip, from the wing
  // strips of the OTHER planes (never its own — the polar has those); every
  // stab / V-tail strip, from every wing strip (the downwash). The tail pairs
  // are built for every aeroplane so the downwash can be MEASURED
  // (out.tailEps, the sheet's dEpsDa); they are APPLIED only when the def
  // asks for the vortex model (params.downwashModel 'vortex' — biplanes;
  // a monoplane keeps its calibrated constant and its numbers, to the bit).
  // A fin sees sidewash, which this does not model — no fin pairs.
  const NST = def.strips.length;
  const IND = P_.induction || { core: 0.30, kProbe: 3 };
  const DWM = P_.downwashModel || 'const';
  const WS = [];
  def.strips.forEach((st, i) => { if (st.kind === 'wing') WS.push(i); });
  const pairs = [];                 // [target strip, source strip, applied]
  for (let ti = 0; ti < NST; ti++) {
    const t = def.strips[ti];
    if (t.kind === 'wing') {
      for (const sj of WS) if ((def.strips[sj].plane | 0) !== (t.plane | 0)) pairs.push([ti, sj, 1]);
    } else if (t.kind === 'stab' || t.kind === 'vtail') {
      for (const sj of WS) pairs.push([ti, sj, DWM === 'vortex' ? 1 : 0]);
    }
  }
  const NP = pairs.length;
  const crossPlane = pairs.some(pr => def.strips[pr[0]].kind === 'wing');
  // passes a probe needs to converge the circulation: the wing<->wing loop is
  // a contraction (round-trip gain ~0.02, see HANDOVER G185.5) and three
  // passes leave a residual under 0.2 %; a monoplane's tail-only pairs are
  // open-loop and two passes measure them exactly
  const K_PROBE = NP ? (crossPlane ? (IND.kProbe || 3) : 2) : 1;
  const Gam = new Float64Array(NST), GamPrev = new Float64Array(NST);
  const vi = new Float64Array(NST * 3);
  const AIC = new Float64Array(NP * 3);
  const sA = new Float64Array(NST * 3), sB = new Float64Array(NST * 3), sD = [0, 0, 0];
  const sZA = new Float64Array(NST), sZB = new Float64Array(NST), sC = [0, 0, 0];   // G970: the bound's span coordinates (body lateral)
  const cpt = new Float64Array(NST * 3);
  // G197: THE WAKE THE POLAR ALREADY ASSUMES. Every strip carries the same
  // 2D lift coefficient, so the circulation is spanwise-uniform and the
  // trailing vorticity is all shed at the tips — and a uniformly loaded
  // wing's far-field centreline downwash is HALF the elliptic one (the
  // stock's tail read 0.22 for a classical 0.41; Prandtl's sigma read 0.87
  // of the fit). The polar's own 3D terms (a3d, eAR) assume near-elliptic
  // loading, so the kernel's SOURCES shed that loading: each source strip's
  // circulation is weighed by the elliptic template over its own plane's
  // live projected span, renormalised per plane every pass so the plane's
  // total circulation-length is conserved (strip forces are untouched —
  // this is the mutual term only). 'uniform' is the negative control.
  const LOADING = IND.loading || 'elliptic';
  const Ez = new Float64Array(NST), Dz = new Float64Array(NST), Wg = new Float64Array(NST);
  const PLANE = new Int8Array(NST); let NPL = 1;
  for (const j of WS) { PLANE[j] = def.strips[j].plane | 0; NPL = Math.max(NPL, PLANE[j] + 1); }
  const bHalf = new Float64Array(NPL);
  const ellF = u => { u = Math.max(-1, Math.min(1, u)); return 0.5 * (u * Math.sqrt(1 - u * u) + Math.asin(u)); };
  let aicHash = NaN, aicFresh = true;
  const cpOf = (ti, o) => {                 // a strip's control point: its attach-weighted c/4 (G1820: a split strip's)
    o[0] = o[1] = o[2] = 0;
    for (const [i, w] of (DMG.stripsSplit ? SW[ti] : def.strips[ti].w)) { o[0] += p[i*3]*w; o[1] += p[i*3+1]*w; o[2] += p[i*3+2]*w; }
    return o;
  };
  // the bound vortex of a wing strip: the quarter-chord line over the
  // strip's own sub-span (a half bay at t 0.28 / 0.78; the centre strip's
  // whole width at t 0.5), from its spar nodes and its c/4 weight
  const boundOf = (st, A, B) => {
    const cf = st.cf != null ? st.cf : 0.8, cr = 1 - cf;
    const tA = st.t === 0.5 ? 0 : st.t < 0.5 ? 0 : 0.5;
    const tB = st.t === 0.5 ? 1 : st.t < 0.5 ? 0.5 : 1;
    for (let k = 0; k < 3; k++) {
      const fi = p[st.fIn*3+k], fo = p[st.fOut*3+k], ri = p[st.rIn*3+k], ro = p[st.rOut*3+k];
      A[k] = cf * (fi + (fo - fi) * tA) + cr * (ri + (ro - ri) * tA);
      B[k] = cf * (fi + (fo - fi) * tB) + cr * (ri + (ro - ri) * tB);
    }
  };
  const _A = [0, 0, 0], _B = [0, 0, 0], _P = [0, 0, 0], _o = [0, 0, 0];
  const _Ai = [0, 0, 0], _Bi = [0, 0, 0], _Di = [0, 0, 0];
  // the influence coefficients: geometry only, per unit circulation, with
  // the GROUND IMAGE (mirrored in y about gH, circulation reversed) when the
  // pass has a ground — the cross-plane and tail terms then see ground
  // effect too, where the polar's McCormick factor only ever held a plane's
  // own image. Called once per frame in flight and on a geometry change in a
  // probe; never per substep (it is ~25 strip loops' worth of arithmetic).
  function buildAIC(gH, dx, dy, dz) {
    sD[0] = dx; sD[1] = dy; sD[2] = dz;
    for (const j of WS) { boundOf(def.strips[j], _A, _B); for (let k = 0; k < 3; k++) { sA[j*3+k] = _A[k]; sB[j*3+k] = _B[k]; } }
    // the template: the mean of sqrt(1 - (2z/b)^2) over each strip's bound
    // sub-span, b = the plane's live projected span (its outermost endpoint)
    // G970: z is the SPAN coordinate - the endpoint's offset from the nose
    // frame (the symmetry plane) along the body's own lateral axis (zRt,
    // fresh from bodyAxes() at the top of this pass). It read the WORLD z:
    // the span only while the aeroplane sat on z = 0 flying along x (HOME's
    // final, the tunnel's rest pose, where the two are the same number). At
    // A3, 11.6 km down z, every strip read u = -1, the sources came out
    // lopsided and the tail's downwash flipped 0.35 -> 0.18 on a flapped
    // final - a 0.35 elevator trim jump, and the cub flared into the ground
    avgP(def.refs.noseFrame, sC);
    for (const j of WS) {
      sZA[j] = (sA[j*3] - sC[0]) * zRt[0] + (sA[j*3+1] - sC[1]) * zRt[1] + (sA[j*3+2] - sC[2]) * zRt[2];
      sZB[j] = (sB[j*3] - sC[0]) * zRt[0] + (sB[j*3+1] - sC[1]) * zRt[1] + (sB[j*3+2] - sC[2]) * zRt[2];
    }
    bHalf.fill(0);
    for (const j of WS) bHalf[PLANE[j]] = Math.max(bHalf[PLANE[j]], Math.abs(sZA[j]), Math.abs(sZB[j]));
    for (const j of WS) {
      const b2 = bHalf[PLANE[j]] || 1, zA = sZA[j], zB = sZB[j];
      Dz[j] = Math.abs(zB - zA);
      const u0 = Math.min(zA, zB) / b2, u1 = Math.max(zA, zB) / b2;
      Ez[j] = LOADING === 'uniform' ? 1
            : (u1 - u0 > 1e-9 ? (ellF(u1) - ellF(u0)) / (u1 - u0) : Math.sqrt(Math.max(0, 1 - u0 * u0)));
    }
    for (let ti = 0; ti < NST; ti++) { cpOf(ti, _P); cpt[ti*3] = _P[0]; cpt[ti*3+1] = _P[1]; cpt[ti*3+2] = _P[2]; }
    for (let q = 0; q < NP; q++) {
      const ti = pairs[q][0], sj = pairs[q][1];
      const rc = IND.core * def.strips[sj].chord;
      _P[0] = cpt[ti*3]; _P[1] = cpt[ti*3+1]; _P[2] = cpt[ti*3+2];
      _A[0] = sA[sj*3]; _A[1] = sA[sj*3+1]; _A[2] = sA[sj*3+2];
      _B[0] = sB[sj*3]; _B[1] = sB[sj*3+1]; _B[2] = sB[sj*3+2];
      _o[0] = _o[1] = _o[2] = 0;
      vkHorseshoe(_A, _B, sD, rc, _P, _o);
      if (gH !== null && gH !== undefined) {
        _Ai[0] = _A[0]; _Ai[1] = 2*gH - _A[1]; _Ai[2] = _A[2];
        _Bi[0] = _B[0]; _Bi[1] = 2*gH - _B[1]; _Bi[2] = _B[2];
        _Di[0] = dx; _Di[1] = -dy; _Di[2] = dz;
        const im = [0, 0, 0];
        vkHorseshoe(_Ai, _Bi, _Di, rc, _P, im);
        _o[0] -= im[0]; _o[1] -= im[1]; _o[2] -= im[2];
      }
      AIC[q*3] = _o[0]; AIC[q*3+1] = _o[1]; AIC[q*3+2] = _o[2];
    }
  }
  // a cheap signature of what the coefficients depend on
  function aicSig(gH, dx, dy, dz) {
    let h = (gH === null || gH === undefined) ? -1e9 : gH;
    for (const j of WS) { const st = def.strips[j];
      for (const i of [st.fIn, st.fOut, st.rIn, st.rOut]) h += p[i*3] + 2*p[i*3+1] + 3*p[i*3+2]; }
    return h * 1.000001 + dx * 7 + dy * 11 + dz * 13;
  }
  // the weighed sources. The bound vortex runs root to tip on BOTH sides,
  // so the two sides' circulations carry opposite signs; folding the side's
  // sign in (sg) makes a lifting plane's circulation one-signed and the
  // template can run plane-wide, centre strip included (excluded, the centre
  // kept its uniform value beside a root raised to 1.25x — a dip shedding a
  // counter-rotating pair right under the tail, 30 % of the effect). The
  // plane's MEAN circulation is spread on the elliptic template, scaled so
  // the template integrates to the same total, and each strip's own
  // deviation from the mean (washout, flaps, ailerons, wash) is shed where
  // it is — a washed-out tip is not rolled off twice, an aileron's
  // antisymmetric part cancels in the mean and rides the deviations.
  const pG = new Float64Array(NPL), pS = new Float64Array(NPL), pDz = new Float64Array(NPL), pEDz = new Float64Array(NPL);
  const sgOf = new Float64Array(NST);
  for (const j of WS) sgOf[j] = def.strips[j].side < 0 ? -1 : 1;
  function weighSources() {
    if (LOADING === 'uniform') { for (const j of WS) Wg[j] = Gam[j]; return; }
    pG.fill(0); pDz.fill(0); pEDz.fill(0);
    for (const j of WS) { const k = PLANE[j];
      pG[k] += sgOf[j] * Gam[j] * Dz[j]; pDz[k] += Dz[j]; pEDz[k] += Ez[j] * Dz[j]; }
    for (let k = 0; k < NPL; k++) { pS[k] = pEDz[k] > 1e-9 ? pDz[k] / pEDz[k] : 1; pG[k] = pDz[k] > 1e-9 ? pG[k] / pDz[k] : 0; }
    for (const j of WS) {
      const k = PLANE[j], gt = sgOf[j] * Gam[j];
      Wg[j] = sgOf[j] * (pG[k] * pS[k] * Ez[j] + (gt - pG[k]));
    }
  }
  function applyInduction() {
    vi.fill(0); weighSources();
    for (let q = 0; q < NP; q++) {
      if (!pairs[q][2]) continue;
      const g = Wg[pairs[q][1]];
      if (!g) continue;
      const ti = pairs[q][0];
      vi[ti*3] += AIC[q*3] * g; vi[ti*3+1] += AIC[q*3+1] * g; vi[ti*3+2] += AIC[q*3+2] * g;
    }
  }
  // the tail's downwash, MEASURED whether or not it is applied: the induced
  // angle at the stab strips from every wing strip's circulation
  function measureTailEps() {
    // the MEAN induced velocity over the tail strips (each strip sums its
    // wing sources; the strips are then averaged, not summed)
    let eps = 0, nT = 0, last = -1; weighSources();
    for (let q = 0; q < NP; q++) {
      const ti = pairs[q][0], st = def.strips[ti];
      if (st.kind !== 'stab' && st.kind !== 'vtail') continue;
      if (ti !== last) { nT++; last = ti; }
      const g = Wg[pairs[q][1]];
      if (!g) continue;
      // downwash = induced velocity against the tail's normal (yUp for a stab)
      eps += -(AIC[q*3]*yUp[0] + AIC[q*3+1]*yUp[1] + AIC[q*3+2]*yUp[2]) * g;
    }
    return nT ? eps / nT : 0;
  }

  function reset(drop = 0) {
    PFO.netF = 0; PFO.mErr = 0;
    if (WB) HYDRO.wetReset(WB);                     // G1384.3: a fresh aeroplane is dry and whole
    dmgReset();                    // G1470: every member whole, every set undone (before G610's k restore below)
    // (G610) a reset is the aeroplane as it FLIES: a rig's trueBox() (the load test on the garage's own sim)
    // lasts until the next one, so the roll-out after a sandbag test flies the flight box again
    if (subN !== (P_.substeps ?? 24)) {
      for (const b of beams) if (b.kTrue != null) { b.k = b.kF; b.c = b.cF; b.sK = b.kF / b.kTrue; }
      subN = P_.substeps ?? 24;
    }
    if (NP) { Gam.fill(0); GamPrev.fill(0); aicHash = NaN; }   // G185.5
    totalM = 0;                    // G121: masses may have changed (setNodeMass)
    resetPanel();                  // the panel arc: tanks as built, engines running
    for (let i = 0; i < n; i++) {
      const nd = def.nodes[i];
      p[i*3] = nd.p[0]; p[i*3+1] = nd.p[1]; p[i*3+2] = nd.p[2];
      v[i*3] = v[i*3+1] = v[i*3+2] = 0;
      m[i] = nd.m; r[i] = nd.r;
      totalM += nd.m;
      rigGround(i, nd.m);          // hoisted; reset only ever runs post-build
    }
    // G661 (A2-RUNWAYS, a small local edit in A1-PHYS's solver): THE WHEEL STANDS ON THE GROUND, NOT IN
    // IT. The ground spring holds a wheel's share of the weight by penetrating: 2.0 cm under each main of
    // the stock build, 2.8 under the aluminium Cessna's nosewheel (measured) - a rigid drawn tyre sunk
    // that far into the runway, the playtest's 142532 ("that's not acceptable anymore"). The drawn tyre IS
    // the loaded tyre, so each wheel's contact radius carries its own static deflection: the share of
    // the weight the level stance gives it (the lever of the CG between the mains and the third wheel)
    // over its own ground stiffness. K, C and every force law are unchanged - the spring meets the
    // ground that much earlier, so at rest the wheel's rim is on the surface. Every other node: rC = r.
    for (let i = 0; i < n; i++) rC[i] = r[i];
    {
      const M = (def.refs && def.refs.mains) || [], tw = def.refs ? def.refs.tw : null, W = totalM * 9.81;
      if (M.length) {
        let cx = 0; for (let i = 0; i < n; i++) cx += def.nodes[i].p[0] * def.nodes[i].m; cx /= totalM;
        let xm = 0; for (const i of M) xm += def.nodes[i].p[0]; xm /= M.length;
        const hasTw = tw != null && tw >= 0, xt = hasTw ? def.nodes[tw].p[0] : xm;
        const sT = hasTw && Math.abs(xt - xm) > 1e-3 ? Math.max(0, Math.min(1, (cx - xm) / (xt - xm))) : 0;
        const def0 = (i, share) => Math.max(0, Math.min(0.05, share * W / KGn[i]));
        for (const i of M) rC[i] = r[i] + def0(i, (1 - sT) / M.length);
        if (hasTw) rC[tw] = r[tw] + def0(tw, sT);
      }
    }
    for (const b of beams) {
      b.L0 = hyp3(p[b.b*3]-p[b.a*3], p[b.b*3+1]-p[b.a*3+1], p[b.b*3+2]-p[b.a*3+2]);
      // G185: RIGGING. A wire's rest length is a hair short of the drawn
      // distance, so it stands in tension at rest — the turnbuckle's job.
      if (b.pre) b.L0 *= (1 - b.pre);
      b.strain = 0;
      b.Lr = b.L0;                 // G1470: the rest length as built, what a set is measured from
    }
    for (const C of clusters) { clusterRest(C); twistRest(C); }   // G294 / G350: the rest shape, as built
    // THE THREE-POINT STANCE (2026-09-04, the user: "quite a few of my builds
    // break their tailwheel simply on spawning, it just flips"). def.nodes are
    // the LEVEL attitude: on a taildragger the tail hangs ~1 m in the air and
    // FALLS onto the tailwheel in the first half second of every spawn
    // (measured on the default build: TW from y 1.08 to 0.09 in 0.67 s), the
    // one slam a 6 cm leg cannot take — it drove the node through the plane of
    // its anchors. So the airframe is pitched about the mains' axle until the
    // third wheel's contact shares the mains' ground line, BEFORE the first
    // step: the static stance the settle would have found, without the drop.
    // A tricycle gets the same treatment onto its nosewheel. Nothing changes
    // for a build without a third wheel, and a stance out of reach (the small
    // root of A sin t + B cos t = C does not exist) leaves the pose alone.
    // NOT CALLED HERE: it is a PLACEMENT step the GAME takes (app.js
    // applyRoute, right after reset and before placeAtStand), like the stand
    // itself. Measured: taken inside reset it moved every flying gate's
    // spawn, and three marginal cases (PILOT hover/card, FLEX alloy, GEN
    // sink) landed on the other side of their thresholds — the battery's
    // datum is the level drop + 600-frame settle, and it stays so.
    let minC = Infinity;
    for (let i = 0; i < n; i++) minC = Math.min(minC, p[i*3+1] - rC[i]);
    for (let i = 0; i < n; i++) p[i*3+1] += -minC + 0.01 + drop;
    ctl.thr = ctl.de = ctl.da = ctl.dr = ctl.brake = ctl.flap = ctl.brakeD = 0;
    ctl.eng = null;                                  // G194: every lever back to full
    // G348: ...AND AGAIN AT THE FIRST STEP. placeAtAerodrome rotates the
    // airframe AFTER reset — a strip at heading 0 is the built pose turned
    // 180° about y, and a rotation extraction warm-started from identity
    // has no gradient at exactly 180° (Müller 2016's one blind spot): the
    // fin cluster's goal was the fin as built, mirrored, 2 m of pull on the
    // tail — every conventional aeroplane placed at heading 0 stood on its
    // nose (GATE HONEST's paved strip rolled 0.7 m in 8 s from G327 on). The
    // rest shape is re-taken from the pose the first step finds, R identity
    // there by construction; every later turn is incremental.
    clusterFresh = true;
    simT = 0;
  }
  function stance() {
    const M = def.refs && def.refs.mains, tw = def.refs && def.refs.tw;
    if (!M || !M.length || tw == null || tw < 0) return 0;
    let ax = 0, ay = 0;
    for (const i of M) { ax += p[i*3]; ay += p[i*3+1]; }
    ax /= M.length; ay /= M.length;
    const A = p[tw*3] - ax, B = p[tw*3+1] - ay, C = rC[tw] - rC[M[0]];
    const R = hyp2(A, B);
    if (R < 1e-6 || Math.abs(C) > R) return 0;
    const th = Math.asin(C / R) - Math.atan2(B, A);
    if (!(Math.abs(th) < 0.6)) return 0;          // 34 deg: past that it is not a stance
    const cs = Math.cos(th), sn = Math.sin(th);
    for (let i = 0; i < n; i++) {
      const dx = p[i*3] - ax, dy = p[i*3+1] - ay;
      p[i*3] = ax + dx * cs - dy * sn;
      p[i*3+1] = ay + dx * sn + dy * cs;
    }
    return th;
  }

  // ---- small vec helpers on flat arrays ----
  const norm3 = a => { const L = hyp3(a[0], a[1], a[2]) || 1e-9;
    a[0] /= L; a[1] /= L; a[2] /= L; return a; };
  const xAft = [0,0,0], yUp = [0,0,0], zRt = [0,0,0], t1 = [0,0,0], t2 = [0,0,0];
  const avgP = (ids, o) => { o[0]=o[1]=o[2]=0;
    for (const i of ids) { o[0]+=p[i*3]; o[1]+=p[i*3+1]; o[2]+=p[i*3+2]; }
    const k = 1 / ids.length; o[0]*=k; o[1]*=k; o[2]*=k; };
  function bodyAxes() {
    avgP(def.refs.noseFrame, t1); avgP(def.refs.tailMid, t2);
    xAft[0]=t2[0]-t1[0]; xAft[1]=t2[1]-t1[1]; xAft[2]=t2[2]-t1[2]; norm3(xAft);
    avgP(def.refs.upLo, t1); avgP(def.refs.upHi, t2);
    yUp[0]=t2[0]-t1[0]; yUp[1]=t2[1]-t1[1]; yUp[2]=t2[2]-t1[2]; norm3(yUp);
    zRt[0]=yUp[1]*xAft[2]-yUp[2]*xAft[1];   // right = up x aft (nose -x)
    zRt[1]=yUp[2]*xAft[0]-yUp[0]*xAft[2];
    zRt[2]=yUp[0]*xAft[1]-yUp[1]*xAft[0]; norm3(zRt);
  }

  // sig = ground-effect downwash factor (1 = free air). It scales the induced
  // drag term AND raises the lift slope via the lifting-line identity
  // 1/a3d = 1/a0 + 1/eAR (a0 reconstructed from the registry constants).
  // dCl0/dCd0/dAStall = high-lift deltas (already scaled by flap fraction):
  // flaps are camber + drag + reduced stall margin, never a bare alpha shift.
  function polar(al, P, sig = 1, dCl0 = 0, dCd0 = 0, dAStall = 0) {
    const s = Math.min(1, Math.max(0, (Math.abs(al) - (P.aStall - dAStall)) / 0.10));
    let a3 = P.a3d;
    if (sig < 1) a3 = 1 / (1 / P.a3d - (1 - sig) / P.eAR);
    const Cl = (P.Cl0 + dCl0 + a3 * al) * (1 - s) + 1.1 * Math.sin(2 * al) * s;
    const CdAtt = P.Cd0 + dCd0 + sig * Cl * Cl / P.eAR;
    const Cd = CdAtt * (1 - s) + (P.Cd0 + dCd0 + 1.9 * Math.sin(al) * Math.sin(al)) * s;
    return [Cl, Cd];
  }

  // strip force pass. probe=true: no prop/wash, aero only.
  const sc=[0,0,0], sw_=[0,0,0], sn=[0,0,0];
  // the engines' constant bookkeeping, once per sim rather than once per substep (PHYSICS PERF
  // 2026-09-24: the pass allocated these every call - GC is 4 % of a frame)
  const LEV = i => { const e = ctl.eng && ctl.eng[i]; return e ? (e.on ? +e.thr : 0) : 1; };
  const ENG_OF = def.refs.engineOf || def.refs.engine.map(() => 0);
  const ENG_CNT = (() => { const nE = def.params.nEngines || 1, c = new Array(nE).fill(0); for (const k of ENG_OF) if (k < nE) c[k]++; return c; })();
  const CW_I = [0, 0, 0, 0], CW_W = [0, 0, 0, 0];
  // G2080 ENGINE-TORQUE: THE PROPELLER'S OWN MOMENTS. Until here a propeller was a force along the body axis at its
  // mount nodes and a scalar wash; nothing knew which way it turned (futureDesigns/PROP-EFFECTS-2026-09-05.md). Four
  // effects, each from the build's own numbers - the shaft law (00_registry genShaftRpm), the disc, the blades' mass,
  // the hand (`engines[i].sense`, +1 clockwise from behind):
  //   REACTION TORQUE  the engine's torque on the crankcase, Q = thrEff . powerK . P_rated / omega_rated (at the prop
  //                    shaft, through the reduction): the airframe rolls against the prop, sense . Q about +xAft
  //   GYROSCOPIC       the prop's angular momentum H = I_p . Omega . sense . forward, and the airframe pays H x omega_body
  //                    whenever it turns (the tail-up's yaw, a pitch in a turn)
  //   P-FACTOR         blade-element theory, a constant-pitch, constant-chord blade (beta . Omega r = p n along the span):
  //                    an in-plane air velocity u_p at the disc loads the blade advancing into it, and the moment is
  //                    M = sense . (K p n / 2 + T / (2 Omega)) . u_p  (a VECTOR along u_p: air from below, a right
  //                    yaw-left for the Lycoming hand). K = N rho c a R^2 / 4 is calibrated on the model's own static
  //                    point (K = T0 / (Omega0 (p n0 - v_i0)), p = V0 / n_rated the zero-thrust pitch of the synthesis), so
  //                    no blade constant is invented; K p is weakly p-dependent (the static thrust carries it)
  //   SWIRL            the slipstream carries the torque's angular momentum: a solid-body rotation omega_s = 2 Q_s /
  //                    (rho V_w pi R_w^4) inside the contracted wake (R_w from momentum theory), added to the local air
  //                    of every TAIL strip the wash reaches (st.wash), about the nearest engine's axis - the fin and the
  //                    stab answer it through their own polars. NOT the wing: in a nacelle's wake the grid has three
  //                    strips (wash 0.07 / 0.99 / 0.39 on the twin) that are not centred on the axis, so the swirl made
  //                    a net LIFT there - a false roll couple at the nacelle's 1.65 m arm that leaned the same-hand twin
  //                    RIGHT under its own left torque (GATE ENGTORQUE, measured). The wing's real de-swirl (it takes
  //                    back part of the torque's roll) is the named cut that buys
  // The three moments are PURE COUPLES (no net force) spread over the engine's mount nodes and their beam neighbours -
  // f_i = (J^-1 M) x r_i, J = sum(|r|^2 I - r r^T), the least-norm set of forces that makes exactly M.
  // PAR.propFx gates each (1 = on) for the A/B the gates and the evidence read; read once per sim.
  const PFX = (typeof PAR !== 'undefined' && PAR.propFx) || {};
  const FX_TQ = PFX.torque !== 0, FX_GY = PFX.gyro !== 0, FX_PF = PFX.pfactor !== 0, FX_SW = PFX.swirl !== 0;
  const FX_ON = FX_TQ || FX_GY || FX_PF || FX_SW;
  const ENG_DEF = P_.engines || [];
  const SENSE = new Float64Array(Math.max(1, ENG_CNT.length));
  for (let k = 0; k < SENSE.length; k++) SENSE[k] = (ENG_DEF[k] && ENG_DEF[k].sense === -1) ? -1 : 1;
  // the prop's polar moment (62_gen_aero: k . m . R^2 from the blades' mass) - a def that states none spins nothing
  const I_PROP = (PR && PR.I > 0) ? PR.I : 0;
  // the rated torque at the prop shaft
  const GEAR = (EN && EN.gear > 0) ? EN.gear : 1;
  const OMEGA_R = 2 * Math.PI * ((EN && EN.rpm > 0 ? EN.rpm : 2300) / GEAR) / 60;
  const Q_R = ((EN && EN.powerW > 0) ? EN.powerW : 0) / OMEGA_R;
  // the P-factor's blade constant K . p at the datum air, off the static full-throttle point
  const PF_KP = (() => {
    if (!(PR && PR.Tstatic > 0 && PR.kV2 > 0) || typeof genShaftRpm !== 'function') return 0;
    const n0 = genShaftRpm(EN, PR, 1, 0, 1, 1, true) / 60, nR = OMEGA_R / (2 * Math.PI);
    const pitch = Math.sqrt(PR.Tstatic / PR.kV2) / nR;
    const vi0 = 0.5 * Math.sqrt(2 * PR.Tstatic / (RHO * PROPA));
    const den = 2 * Math.PI * n0 * Math.max(0.2 * pitch * n0, pitch * n0 - vi0);
    return den > 0 ? PR.Tstatic * pitch / den : 0;
  })();
  // each engine's node set: its mount nodes and every node one beam away
  const ENG_SET = (() => {
    const sets = [], adj = new Map();
    for (const b of def.beams) {
      const a = b.a != null ? b.a : b[0], c = b.b != null ? b.b : b[1];
      if (!adj.has(a)) adj.set(a, []); if (!adj.has(c)) adj.set(c, []);
      adj.get(a).push(c); adj.get(c).push(a);
    }
    for (let k = 0; k < SENSE.length; k++) {
      const s = new Set();
      for (let j = 0; j < ENG_N.length; j++) if (((ENG_OF[j] | 0) < SENSE.length ? ENG_OF[j] | 0 : 0) === k) {
        s.add(ENG_N[j]); for (const q of (adj.get(ENG_N[j]) || [])) s.add(q);
      }
      sets.push(Int32Array.from(s));
    }
    return sets;
  })();
  // per engine, refreshed by the thrust pass: the hub (mount centroid), the swirl rate, the wake radius, the sense
  const SW_HUB = new Float64Array(SENSE.length * 3), SW_W = new Float64Array(SENSE.length), SW_R = new Float64Array(SENSE.length);
  let swirlOn = false;
  // the published moments, body components [along xAft, along yUp, along zRt] per engine (+yUp = nose LEFT,
  // +xAft = left wing down, +zRt = nose up): `out.propFx`
  const PFO = { Q: new Float64Array(SENSE.length), rpm: new Float64Array(SENSE.length), H: new Float64Array(SENSE.length),
                tq: new Float64Array(SENSE.length * 3), gyro: new Float64Array(SENSE.length * 3), pf: new Float64Array(SENSE.length * 3),
                swirl: SW_W, wakeR: SW_R, rate: [0, 0, 0], netF: 0, mErr: 0 };
  out.propFx = PFO;
  const _cm = [0, 0, 0], _wb = [0, 0, 0];
  // the airframe's angular velocity off the axes' own reference nodes: w = x . xdot + (ydot . (x X y)) x
  function bodyRate(o) {
    const ax = def.refs.noseFrame, bx = def.refs.tailMid, ay = def.refs.upLo, by = def.refs.upHi;
    let lx = 0, ly = 0, lz = 0, dx = 0, dy = 0, dz = 0;
    for (const i of bx) { lx += p[i*3] / bx.length; ly += p[i*3+1] / bx.length; lz += p[i*3+2] / bx.length; dx += v[i*3] / bx.length; dy += v[i*3+1] / bx.length; dz += v[i*3+2] / bx.length; }
    for (const i of ax) { lx -= p[i*3] / ax.length; ly -= p[i*3+1] / ax.length; lz -= p[i*3+2] / ax.length; dx -= v[i*3] / ax.length; dy -= v[i*3+1] / ax.length; dz -= v[i*3+2] / ax.length; }
    let L = hyp3(lx, ly, lz) || 1, xd = dx*xAft[0]+dy*xAft[1]+dz*xAft[2];
    const xdx = (dx - xd*xAft[0]) / L, xdy = (dy - xd*xAft[1]) / L, xdz = (dz - xd*xAft[2]) / L;
    lx = ly = lz = dx = dy = dz = 0;
    for (const i of by) { lx += p[i*3] / by.length; ly += p[i*3+1] / by.length; lz += p[i*3+2] / by.length; dx += v[i*3] / by.length; dy += v[i*3+1] / by.length; dz += v[i*3+2] / by.length; }
    for (const i of ay) { lx -= p[i*3] / ay.length; ly -= p[i*3+1] / ay.length; lz -= p[i*3+2] / ay.length; dx -= v[i*3] / ay.length; dy -= v[i*3+1] / ay.length; dz -= v[i*3+2] / ay.length; }
    L = hyp3(lx, ly, lz) || 1;
    // x X y = -zRt (zRt = up x aft)
    const wx = -(dx*zRt[0] + dy*zRt[1] + dz*zRt[2]) / L;
    o[0] = xAft[1]*xdz - xAft[2]*xdy + wx * xAft[0];
    o[1] = xAft[2]*xdx - xAft[0]*xdz + wx * xAft[1];
    o[2] = xAft[0]*xdy - xAft[1]*xdx + wx * xAft[2];
    return o;
  }
  // a pure couple M over the node set S: f_i = (J^-1 M) x r_i about the set's centroid
  function applyCouple(S, Mx, My, Mz) {
    const ns = S.length; if (ns < 3) return;
    let cx = 0, cy = 0, cz = 0;
    for (let j = 0; j < ns; j++) { const e = S[j] * 3; cx += p[e]; cy += p[e+1]; cz += p[e+2]; }
    cx /= ns; cy /= ns; cz /= ns;
    let a = 0, b = 0, c = 0, d = 0, e_ = 0, g = 0;   // J = [[a d e],[d b g],[e g c]]
    for (let j = 0; j < ns; j++) {
      const q = S[j] * 3, rx = p[q] - cx, ry = p[q+1] - cy, rz = p[q+2] - cz;
      a += ry*ry + rz*rz; b += rx*rx + rz*rz; c += rx*rx + ry*ry; d -= rx*ry; e_ -= rx*rz; g -= ry*rz;
    }
    const A = b*c - g*g, B = e_*g - d*c, Cc = d*g - b*e_, det = a*A + d*B + e_*Cc;
    if (!(Math.abs(det) > 1e-12)) return;
    const D2 = a*c - e_*e_, E2 = d*e_ - a*g, F2 = a*b - d*d;
    const wx = (A*Mx + B*My + Cc*Mz) / det, wy = (B*Mx + D2*My + E2*Mz) / det, wz = (Cc*Mx + E2*My + F2*Mz) / det;
    let Fx = 0, Fy = 0, Fz = 0, mx = 0, my = 0, mz = 0;
    for (let j = 0; j < ns; j++) {
      const q = S[j] * 3, rx = p[q] - cx, ry = p[q+1] - cy, rz = p[q+2] - cz;
      const fx = wy*rz - wz*ry, fy = wz*rx - wx*rz, fz = wx*ry - wy*rx;
      f[q] += fx; f[q+1] += fy; f[q+2] += fz;
      Fx += fx; Fy += fy; Fz += fz; mx += ry*fz - rz*fy; my += rz*fx - rx*fz; mz += rx*fy - ry*fx;
    }
    // what the set really received (GATE ENGTORQUE's COUPLES): its net force and its moment's miss, worst since reset
    const Mm = hyp3(Mx, My, Mz) || 1;
    PFO.netF = Math.max(PFO.netF, hyp3(Fx, Fy, Fz) / Mm); PFO.mErr = Math.max(PFO.mErr, hyp3(mx - Mx, my - My, mz - Mz) / Mm);
  }
  // the four effects, once per pass after the thrust: the couples onto each engine's nodes, the swirl's state for the
  // strip loop below. Ti = each engine's thrust (N), Vf the axial airspeed, (wx,wy,wz) the air at the CG.
  function propMoments(nE, Ti, Vf, rho, sig, wx, wy, wz, powerK) {
    const nk = Math.min(nE, SENSE.length);
    let wb = null;
    if (FX_GY && I_PROP > 0) { wb = bodyRate(_wb); PFO.rate[0] = wb[0]; PFO.rate[1] = wb[1]; PFO.rate[2] = wb[2]; }
    swirlOn = false;
    for (let k = 0; k < nk; k++) {
      const sn = SENSE[k], rp = PFO.rpm[k], Om = 2 * Math.PI * rp / 60, Q = PFO.Q[k], T = Ti[k];
      const S = ENG_SET[k];
      let Mx = 0, My = 0, Mz = 0;
      // the hub and the disc's own velocity (the mount nodes of engine k)
      let hx = 0, hy = 0, hz = 0, vx = 0, vy = 0, vz = 0, c = 0;
      for (let j = 0; j < ENG_N.length; j++) if (((ENG_OF[j] | 0) < SENSE.length ? ENG_OF[j] | 0 : 0) === k) {
        const e = ENG_N[j] * 3; hx += p[e]; hy += p[e+1]; hz += p[e+2]; vx += v[e]; vy += v[e+1]; vz += v[e+2]; c++;
      }
      if (c) { hx /= c; hy /= c; hz /= c; vx /= c; vy /= c; vz /= c; }
      SW_HUB[k*3] = hx; SW_HUB[k*3+1] = hy; SW_HUB[k*3+2] = hz;
      // REACTION TORQUE: sense . Q about +xAft
      if (FX_TQ && Q) { Mx += sn * Q * xAft[0]; My += sn * Q * xAft[1]; Mz += sn * Q * xAft[2]; }
      PFO.tq[k*3] = FX_TQ ? sn * Q : 0; PFO.tq[k*3+1] = 0; PFO.tq[k*3+2] = 0;
      // GYROSCOPIC: H = I Om sense (-xAft); M = H x w
      const H = I_PROP * Om; PFO.H[k] = H;
      if (wb && H) {
        const hX = -sn * H * xAft[0], hY = -sn * H * xAft[1], hZ = -sn * H * xAft[2];
        const gx = hY * wb[2] - hZ * wb[1], gy = hZ * wb[0] - hX * wb[2], gz = hX * wb[1] - hY * wb[0];
        Mx += gx; My += gy; Mz += gz;
        PFO.gyro[k*3] = gx*xAft[0]+gy*xAft[1]+gz*xAft[2]; PFO.gyro[k*3+1] = gx*yUp[0]+gy*yUp[1]+gz*yUp[2]; PFO.gyro[k*3+2] = gx*zRt[0]+gy*zRt[1]+gz*zRt[2];
      } else { PFO.gyro[k*3] = PFO.gyro[k*3+1] = PFO.gyro[k*3+2] = 0; }
      // P-FACTOR: the in-plane air at the disc, M = sense (K p n / 2 + T / (2 Om)) u_p - a running engine only
      if (FX_PF && Q > 0 && Om > 1) {
        let ux = wx - vx, uy = wy - vy, uz = wz - vz;
        const ua = ux*xAft[0] + uy*xAft[1] + uz*xAft[2];
        ux -= ua * xAft[0]; uy -= ua * xAft[1]; uz -= ua * xAft[2];
        const kf = sn * (PF_KP * sig * (rp / 60) * 0.5 + T / (2 * Om));
        Mx += kf * ux; My += kf * uy; Mz += kf * uz;
        PFO.pf[k*3] = kf*(ux*xAft[0]+uy*xAft[1]+uz*xAft[2]); PFO.pf[k*3+1] = kf*(ux*yUp[0]+uy*yUp[1]+uz*yUp[2]); PFO.pf[k*3+2] = kf*(ux*zRt[0]+uy*zRt[1]+uz*zRt[2]);
      } else { PFO.pf[k*3] = PFO.pf[k*3+1] = PFO.pf[k*3+2] = 0; }
      if (Mx || My || Mz) applyCouple(S, Mx, My, Mz);
      // SWIRL: the torque that goes with the model's thrust (thrust is linear in the lever, the idle's torque makes
      // none), its angular momentum carried by the contracted wake as a solid-body rotation
      SW_W[k] = 0; SW_R[k] = 0;
      if (FX_SW && T > 0 && Q_R > 0) {
        const lev = Math.max(0, Math.min(1, ctl.thr * LEV(k)));
        const Qs = lev * powerK * Q_R;
        const wsh = Math.sqrt(Vf * Vf + 2 * T / (rho * PROPA)) - Vf;
        const Vw = Math.max(1, Vf + wsh), Rw = (PR.D / 2) * Math.sqrt((Vf + 0.5 * wsh) / Math.max(1e-6, Vf + wsh));
        if (Qs > 0 && Rw > 0.05) {
          SW_W[k] = sn * 2 * Qs / (rho * Vw * Math.PI * Rw * Rw * Rw * Rw); SW_R[k] = Rw; swirlOn = true;
        }
      }
    }
  }
  // the swirl's air at a strip in the wash (sx,sy,sz), into o: about the nearest engine's axis, solid-body inside the
  // wake radius, faded to nothing over its last quarter beyond it
  function swirlAt(sx, sy, sz, o) {
    o[0] = o[1] = o[2] = 0;
    let best = -1, bd = Infinity, bdx = 0, bdy = 0, bdz = 0;
    for (let k = 0; k < SW_W.length; k++) {
      if (!SW_W[k]) continue;
      let dx = sx - SW_HUB[k*3], dy = sy - SW_HUB[k*3+1], dz = sz - SW_HUB[k*3+2];
      const a = dx*xAft[0] + dy*xAft[1] + dz*xAft[2];
      dx -= a * xAft[0]; dy -= a * xAft[1]; dz -= a * xAft[2];
      const d = hyp3(dx, dy, dz);
      if (d < bd) { bd = d; best = k; bdx = dx; bdy = dy; bdz = dz; }
    }
    if (best < 0) return o;
    const Rw = SW_R[best], g = bd <= Rw ? 1 : Math.max(0, 1 - (bd - Rw) / (0.25 * Rw));
    if (!g) return o;
    // v = sense . w_s . (forward x d) = w_s . (d x xAft) (the sense is in SW_W)
    const w = SW_W[best] * g;
    o[0] = w * (bdy*xAft[2] - bdz*xAft[1]); o[1] = w * (bdz*xAft[0] - bdx*xAft[2]); o[2] = w * (bdx*xAft[1] - bdy*xAft[0]);
    return o;
  }
  const _sw = [0, 0, 0];
  function aeroPass(probe) {
    bodyAxes();
    // mean velocity (mass-weighted), and the mean altitude in the same sweep
    let vmx=0, vmy=0, vmz=0, pmy=0;
    for (let i = 0; i < n; i++) { vmx+=v[i*3]*m[i]; vmy+=v[i*3+1]*m[i]; vmz+=v[i*3+2]*m[i];
                                 pmy+=p[i*3+1]*m[i]; }
    vmx/=totalM; vmy/=totalM; vmz/=totalM; pmy/=totalM;

    // THE AIR, SAMPLED ONCE FOR THE WHOLE PASS at the aeroplane's own altitude.
    // Node y is metres above MEAN SEA LEVEL already (placeAtAerodrome offsets
    // every node by the strip's own elev), so there is no new datum here.
    // Once, not per strip, and that is a declared cut rather than laziness: the
    // density gradient across a 13 m span is 1e-4 of the density, and this pass
    // runs up to 200 times a frame.
    const AIR = airOf();
    // A TUNNEL PROBE reads the DECLARED air (hProbe, ISA sea level unless the
    // bench says otherwise); a FLYING aeroplane reads the air at its own mean
    // altitude. The two must not be the same line: if a probe read the model's
    // own ride height, a taller undercarriage would change the stall speed on
    // the sheet, and the sheet is what two builds are compared by.
    //
    // AND A SIM WITH NO WORLD HAS NO PLACE, so it has no altitude either — it
    // flies in the declared air too. That is genShakedown's own existing ruling
    // about the ground ("settled on a flat plane, so the answer does not depend
    // on which patch of grass it is parked on") extended to the air, and it is
    // needed for the same reason: the STANCE is measured by settling rather
    // than probing, so without this clause a 1.2e-4 density difference from the
    // aeroplane's own ride height reached the design sheet — enough to flip
    // which main wheel a deliberately-broken variant came to rest on.
    // genDensityAlt is unaffected by construction: it sets its height itself.
    const hAir = (probe || !world) ? hProbe : pmy;
    const rho = AIR.rho(hAir), sig = AIR.sigma(hAir);
    // EQUIVALENT AIRSPEED is the speed this aeroplane's WING thinks it is
    // doing: the speed at sea level that would make the same dynamic pressure.
    // Every V-number in this project (Vs, VCruise, VAppr, the plant gains) was
    // derived at rho0 and is therefore already an EAS, so this factor is what
    // lets the autopilot keep flying the numbers it was tuned with when the air
    // thins. At sea level it is EXACTLY 1 and nothing moves.
    const easK = Math.sqrt(sig);
    // and what the powerplant makes of it — see 05_atmos.js, where both
    // scalings are re-derived from 60_gen_spec's own prop synthesis rather than
    // asserted.
    const PS = atmosPropScale(sig, ASP, FLAT, CRIT);
    out.rho = rho; out.sigma = sig; out.easK = easK;
    out.densityAlt = AIR.densityAlt(hAir); out.oatC = AIR.T(hAir) - 273.15;
    out.powerK = PS.power; out.thrustK = PS.kT;

    // world samples: ONE terrain height (ground effect) and ONE wind vector
    // under the wing per pass; strips re-sample wind at their own position
    // so spatial gust structure produces roll/twist forcing. All wind terms
    // are exact zeros when no wind is set — the zero-wind battery is
    // byte-identical to the pre-wind one.
    let gH = gRef, wcx = 0, wcy = 0, wcz = 0;
    if (world) {
      let sx = 0, sy = 0, sz = 0, sN = 0;
      for (const st of def.strips) if (st.kind === 'wing') {
        sx += p[st.fIn*3] + p[st.fOut*3];
        sy += p[st.fIn*3+1] + p[st.fOut*3+1];
        sz += p[st.fIn*3+2] + p[st.fOut*3+2];
        sN += 2;
      }
      const mx = sx / sN, my = sy / sN, mz = sz / sN;
      gH = world.terrainH(mx, mz);
      // the CG sample used to pass a literal 0 for y. It was silent while the
      // wind field ignored y and wrong the moment it stopped (G72): the wing
      // would have been told the wind at sea level while its own strips, which
      // sample at their real positions two lines down, felt the wind at
      // altitude — the two disagreeing about the same air.
      if (world.wind) { const wv = world.wind(mx, my, mz, simT); wcx = wv[0]; wcy = wv[1]; wcz = wv[2]; }
    }
    // prop advance ratio uses AIRSPEED (thrust decays with air, not ground)
    const Vfwd = Math.max(0, -((vmx-wcx)*xAft[0]+(vmy-wcy)*xAft[1]+(vmz-wcz)*xAft[2]));

    // prop thrust + far-wake propwash
    let T = 0, wash = 0;
    if (!probe) {
      // TWO DIFFERENT COUNTS, and conflating them was a real defect (fixed
      // 2026-08-11). `refs.engine` is the list of NODES the thrust is applied
      // AT — the two mount points of ONE engine on the Cub, one node per
      // nacelle on the DC-3 — so it can say where the force goes but not how
      // many engines make it. `params.nEngines` says that, and every def
      // states it. The registry's Tstatic/kV2 are PER PROPELLER.
      const nE = def.params.nEngines || 1;
      const Tcap = Math.max(0, PR.Tstatic * PS.kT - PR.kV2 * PS.kV * Vfwd * Vfwd);
      // G194: PER ENGINE. Each engine's thrust is the pilot's throttle times
      // its own lever (ctl.eng, null = every lever full and on), and each
      // mount node takes its OWN engine's share (refs.engineOf) — so a cut
      // or trimmed engine on a wing pair is a real yaw couple through the two
      // nodes at +-z, with no new physics. With ctl.eng null this is
      // Tper * nE spread evenly, to the bit.
      const lev = LEV;
      const EO = ENG_OF, cnt = ENG_CNT;   // (constant per def: hoisted, PHYSICS PERF 2026-09-24)
      const Ti = out.thrustPer; Ti.length = nE;
      T = 0;
      for (let i = 0; i < nE; i++) {
        // the panel arc: a stopped engine pulls nothing (every engine runs
        // unless the key or the tanks say otherwise — bit-identical before)
        const run = !eng[i] || eng[i].running;
        Ti[i] = run ? ctl.thr * lev(i) * Tcap : 0; T += Ti[i];
        // and the shaft speed the tacho reads: prop rpm, then through the
        // reduction unit (00_registry.js genShaftRpm, the one law)
        if (typeof genShaftRpm === 'function') {
          const thrE = run ? Math.max(0, Math.min(1, ctl.thr * lev(i))) : 0;
          const rp = genShaftRpm(EN, PR, thrE, Vfwd, sig, PS.power, run);
          out.rpm[i] = rp; out.rpmEng[i] = genEngineRpm(EN, rp);
          // G2080: the shaft's torque (the law's own Qe) and speed, per engine
          if (i < PFO.Q.length) { PFO.rpm[i] = rp; PFO.Q[i] = run ? (IDLE_T + (1 - IDLE_T) * thrE) * PS.power * Q_R : 0; }
        }
      }
      // propwash is ONE disc's — the tail flies in the wake of the prop ahead
      // of it, not in the sum of the aeroplane's engines (the mean disc now)
      wash = Math.sqrt(Vfwd * Vfwd + 2 * (T / nE) / (rho * PROPA)) - Vfwd;
      // G477: THE THRUST LINE'S TILT (engTilt, downthrust positive): the
      // force is turned about the lateral axis, forward-and-down at the
      // front of the engine, so a high pusher's line of action passes
      // nearer the CG. Zero on every def that says nothing — to the bit.
      const TL = P_.engTilt;
      for (let j = 0; j < def.refs.engine.length; j++) {
        const e = def.refs.engine[j], k = EO[j] < nE ? EO[j] : 0;
        const per = Ti[k] / Math.max(1, cnt[k]);
        const tl = TL ? (TL[k] || 0) : 0;
        if (tl) {
          const cs = Math.cos(tl), sn = Math.sin(tl);
          f[e*3]   -= per * (cs * xAft[0] + sn * yUp[0]);
          f[e*3+1] -= per * (cs * xAft[1] + sn * yUp[1]);
          f[e*3+2] -= per * (cs * xAft[2] + sn * yUp[2]);
        } else {
          f[e*3]   -= per * xAft[0];
          f[e*3+1] -= per * xAft[1];
          f[e*3+2] -= per * xAft[2];
        }
      }
      if (FX_ON) propMoments(nE, Ti, Vfwd, rho, sig, wcx, wcy, wcz, PS.power);
    }
    out.aeroFy = 0; out.wingFy = 0; out.stabFy = 0; out.dbgAl = 0; out.dbgN = 0;
    const planeFy = out.planeFy = [];                // G185: each plane's lift
    out.thrust = T; out.wash = wash;
    // THREE SPEEDS, and the distinction is load-bearing now that the air can be
    // thin: out.V is TRUE airspeed (air-relative — what alpha is built on and
    // what a propeller advances into), out.Veas is what the wing and the
    // instrument feel, out.Vg is over the ground (wheels, brakes, stop
    // detection). At sea level the first two are the same number exactly.
    const avx = vmx - wcx, avy = vmy - wcy, avz = vmz - wcz;
    out.V = hyp3(avx, avy, avz);
    out.Veas = out.V * easK;
    out.Vg = hyp3(vmx, vmy, vmz);
    out.windX = wcx; out.windY = wcy; out.windZ = wcz;
    out.alpha = Math.atan2(-(avx*yUp[0]+avy*yUp[1]+avz*yUp[2]),
                           -(avx*xAft[0]+avy*xAft[1]+avz*xAft[2]));
    out.vs = vmy;

    // G185.5: the induced field, from the LAST pass's circulations (one
    // substep of lag; the loop is a contraction, see the kernel's note). The
    // wake trails the way the air goes past: opposite the air-relative
    // velocity. Coefficients are rebuilt when the geometry signature moves
    // (a probe with new positions, a frame in flight), never per substep.
    let tailEpsSum = 0, tailEpsN = 0;
    if (NP) {
      const va = hyp3(avx, avy, avz) || 1;
      const dx = -avx / va, dy = -avy / va, dz = -avz / va;
      // ONCE A FRAME IN FLIGHT (G578, PHYSICS PERF): the signature hashes the node positions, which
      // move every substep, so this rebuilt every substep - 10-16 % of the solver - where the note on
      // buildAIC says "once per frame in flight". In a step it is rebuilt on the frame's first substep
      // (the geometry a frame moves is millimetres; the circulations still update every substep); a
      // probe rebuilds whenever its geometry moves, as before
      if (probe || aicFresh) {
        const sg = aicSig(gH, dx, dy, dz);
        if (sg !== aicHash) { buildAIC(gH, dx, dy, dz); aicHash = sg; }
        if (!probe) aicFresh = false;
      }
      applyInduction();
      out.tailEps = out.V > 0.5 ? measureTailEps() / out.V : 0;
    } else out.tailEps = 0;
    GamPrev.set(Gam);

    let stripIdx = -1;
    const SWL = DMG.stripsSplit ? SW : null;   // G1898.4: a split strip's weights only once one exists (the lookup cost ~0.5 %)
    for (const st of def.strips) {
      stripIdx++;
      // G1470 / G1820: a strip whose nodes a break has parted is no longer a wing: no lift, no drag (the component test)
      if (stripDead[stripIdx]) { if (NP) Gam[stripIdx] = 0; continue; }
      // --- strip frame ---
      // a strip that names its four spar nodes (the wing's, and since TAIL
      // CHANTIER 2 P4 the stab's and fin's bays) takes its chord and normal
      // from the DEFORMED nodes; the tail read the body axes before — its
      // incidence welded to the fuselage whatever its truss did
      if (st.kind === 'wing' || st.fIn != null) {
        const fi=st.fIn*3, fo=st.fOut*3, ri=st.rIn*3, ro=st.rOut*3, t=st.t;
        sc[0]=(p[ri]+(p[ro]-p[ri])*t)-(p[fi]+(p[fo]-p[fi])*t);
        sc[1]=(p[ri+1]+(p[ro+1]-p[ri+1])*t)-(p[fi+1]+(p[fo+1]-p[fi+1])*t);
        sc[2]=(p[ri+2]+(p[ro+2]-p[ri+2])*t)-(p[fi+2]+(p[fo+2]-p[fi+2])*t);
        norm3(sc);
        sw_[0]=(p[fo]-p[fi])*st.side; sw_[1]=(p[fo+1]-p[fi+1])*st.side; sw_[2]=(p[fo+2]-p[fi+2])*st.side;
        norm3(sw_);
        sn[0]=sw_[1]*sc[2]-sw_[2]*sc[1];
        sn[1]=sw_[2]*sc[0]-sw_[0]*sc[2];
        sn[2]=sw_[0]*sc[1]-sw_[1]*sc[0]; norm3(sn);
      } else if (st.kind === 'stab') {
        sc[0]=xAft[0]; sc[1]=xAft[1]; sc[2]=xAft[2];
        sn[0]=yUp[0]; sn[1]=yUp[1]; sn[2]=yUp[2];
      } else if (st.kind === 'vtail') {
        // V-TAIL panel: chord still aft, but the normal is canted out of the
        // vertical by the panel's own dihedral, INWARD on each side:
        //   n = cos G * up  +  side * sin G * right
        // (side +1 is the +z panel — the PORT one, "+z is the LEFT side" in
        // probe() below — and inward for it is -z, which is `right`.)
        // Both panels then lift upward together (their lateral parts cancel in
        // symmetric flight) and oppositely in yaw, which is the whole trick —
        // the mixing falls out of the geometry instead of being asserted.
        // G209: this read `- side` — the normals leaned OUTWARD, and the
        // rudder mix below was negated to yaw the right way regardless. The
        // yaw came out right and two things came out backwards: the tail's
        // sideslip roll couple (a V-tail rolls away from the wind, as a
        // dihedralled wing does) and the drawn ruddervators, whose sense the
        // join had matched to the leaning-out model.
        const cV = st.cosV, sV = st.sinV * st.side;
        sc[0]=xAft[0]; sc[1]=xAft[1]; sc[2]=xAft[2];
        sn[0]=cV*yUp[0]+sV*zRt[0]; sn[1]=cV*yUp[1]+sV*zRt[1]; sn[2]=cV*yUp[2]+sV*zRt[2];
        norm3(sn);
      } else { // fin
        sc[0]=xAft[0]; sc[1]=xAft[1]; sc[2]=xAft[2];
        sn[0]=zRt[0]; sn[1]=zRt[1]; sn[2]=zRt[2];
      }
      // --- local velocity + position via attach weights ---
      let vx=0, vy=0, vz=0, spx=0, spy=0, spz=0;
      for (const [i, w] of (SWL ? SWL[stripIdx] : st.w)) {   // G1820: a split strip's weights
        vx+=v[i*3]*w; vy+=v[i*3+1]*w; vz+=v[i*3+2]*w;
        spx+=p[i*3]*w; spy+=p[i*3+1]*w; spz+=p[i*3+2]*w;
      }
      // wind at the strip's own position (spatial gust structure -> roll/twist)
      let wx_ = wcx, wy_ = wcy, wz_ = wcz;
      if (world && world.wind) { const wv = world.wind(spx, spy, spz, simT); wx_ = wv[0]; wy_ = wv[1]; wz_ = wv[2]; }
      // relative air velocity = air motion (wash + wind) - node motion
      const wsh = wash * st.wash;
      let rx = wsh*xAft[0]+wx_-vx, ry = wsh*xAft[1]+wy_-vy, rz = wsh*xAft[2]+wz_-vz;
      // G2080: the slipstream's swirl, where the wash reaches
      if (swirlOn && st.wash > 0 && !probe && st.kind !== 'wing') { swirlAt(spx, spy, spz, _sw); rx += _sw[0] * st.wash; ry += _sw[1] * st.wash; rz += _sw[2] * st.wash; }
      // G185.5: ...plus the induced velocity of the other plane and, on a
      // tail flying the vortex model, of the wing. The lift vector is built
      // on the LOCAL wind below, so a downwash tilts it aft and the mutual
      // induced drag falls out of the geometry — no separate term.
      if (NP) { const si = stripIdx * 3; rx += vi[si]; ry += vi[si+1]; rz += vi[si+2]; }
      const u = rx*sc[0]+ry*sc[1]+rz*sc[2];
      const w_ = rx*sn[0]+ry*sn[1]+rz*sn[2];
      const V2 = u*u + w_*w_;
      if (V2 < 0.01) continue;
      let al = Math.atan2(w_, u);
      // G185: a wing strip flies ITS PLANE's polar (plane 0's is polarWing)
      let P = P_.polarWings ? (P_.polarWings[st.plane | 0] || P_.polarWing) : P_.polarWing;
      let fl = 0;                                  // flap fraction on this strip
      if (st.kind === 'wing') {
        al += P_.ailTau * ctl.da * st.side * st.ail;
        if (FP && st.flap && ctl.flap > 0) {
          fl = ctl.flap * st.flap;
          al += (FP.tau || 0) * fl;                // flaperon droop (surface rotates)
        }
      } else if (st.kind === 'stab') {
        // G185.5: the vortex model's downwash is already in the local wind
        // (vi above), so the calibrated constant stands aside on a def that
        // asks for it; every other def keeps the constant, to the bit
        al = (DWM === 'vortex' ? al : (1 - P_.downwash) * al) + P_.stabTrim - P_.elevTau * ctl.de;
        P = P_.polarTail;
      } else if (st.kind === 'vtail') {
        // ruddervator: elevator SYMMETRIC (both panels the same way, vertical
        // forces add and lateral cancel), rudder ANTISYMMETRIC (the reverse).
        // PLUS side, with the normals leaning inward: dr > 0 (nose LEFT) asks
        // the port panel for MORE lift, which pulls its tail end up and toward
        // the centreline — starboard — and the starboard panel for less,
        // which pushes it down and starboard too. The verticals cancel, the
        // laterals add. (2026-09-04 wrote MINUS here against an outward-
        // leaning normal; the same yaw, measured again at G209: d(yawLeft)/
        // d(dr) unchanged on the V-tail archetype.)
        al = (DWM === 'vortex' ? al : (1 - P_.downwash) * al) + P_.stabTrim - P_.elevTau * ctl.de
             + P_.rudTau * ctl.dr * PAR.rudderSign * st.side;
        P = P_.polarTail;
      } else {
        al += P_.rudTau * ctl.dr * PAR.rudderSign;
        // G115: the fin flies its OWN polar when the def declares one (the
        // generator does, from the real fin aspect ratio); the fleet's
        // fiches never set polarFin, so the fallback keeps them bit-exact.
        P = P_.polarFin || P_.polarTail;
      }
      // ground effect (wing strips only; tail excluded — honest cut):
      // McCormick sigma = (16h/b)^2 / (1 + (16h/b)^2)
      let sig = 1;
      if (gH !== null && st.kind === 'wing') {
        const hb = Math.max(0.02,
          ((p[st.fIn*3+1] + p[st.fOut*3+1]) * 0.5 - gH) / (bOf[st.plane | 0] || bSpan));
        const g16 = 16 * hb;
        sig = g16 * g16 / (1 + g16 * g16);
      }
      const [Cl, Cd] = fl > 0
        ? polar(al, P, sig, (FP.dCl0 || 0) * fl, (FP.dCd0 || 0) * fl, (FP.dAStall || 0) * fl)
        : polar(al, P, sig);
      // G461: the stab flies at the body's wake q (P_.tailEta, 1 on a fiche)
      const q = 0.5 * rho * V2 * st.area * ((st.kind === 'stab' || st.kind === 'vtail') ? (P_.tailEta || 1) : 1), iv = 1 / Math.sqrt(V2);
      // G185.5: this strip's circulation for the NEXT pass — Kutta-Joukowski,
      // Gamma = Cl c V / 2 per unit span, signed so that (wind x bound) is
      // the lift direction: the bound runs A -> B (inboard -> outboard) and
      // the sign is what makes ev x sAB agree with the strip normal
      if (NP && st.kind === 'wing') {
        const si = stripIdx * 3;
        const bx = sB[si] - sA[si], by = sB[si+1] - sA[si+1], bz = sB[si+2] - sA[si+2];
        // ev x b, dotted with the normal: the lift of a + circulation A -> B
        const cx = (ry*bz - rz*by), cy = (rz*bx - rx*bz), cz = (rx*by - ry*bx);
        const sgn = (cx*sn[0] + cy*sn[1] + cz*sn[2]) >= 0 ? 1 : -1;
        Gam[stripIdx] = 0.5 * Cl * st.chord / iv * sgn;
      }
      // drag along relative wind (in strip plane), lift perpendicular
      const dx=(u*sc[0]+w_*sn[0])*iv, dy=(u*sc[1]+w_*sn[1])*iv, dz=(u*sc[2]+w_*sn[2])*iv;
      const lx=(u*sn[0]-w_*sc[0])*iv, ly=(u*sn[1]-w_*sc[1])*iv, lz=(u*sn[2]-w_*sc[2])*iv;
      const Fx = q*(Cl*lx + Cd*dx), Fy = q*(Cl*ly + Cd*dy), Fz = q*(Cl*lz + Cd*dz);
      out.aeroFy += Fy;
      if (st.kind === 'wing') { out.wingFy += Fy; out.dbgAl += al; out.dbgN++;
        planeFy[st.plane | 0] = (planeFy[st.plane | 0] || 0) + Fy;   // G185: per plane
        if (out.dump) out.dump.push({ side: st.side, t: st.t, wash: st.wash,
          al: al*57.3, Fy, ch: st.chord }); }
      else if (st.kind === 'stab' || st.kind === 'vtail') out.stabFy += Fy;
      for (const [i, w] of (SWL ? SWL[stripIdx] : st.w)) {
        f[i*3] += Fx*w; f[i*3+1] += Fy*w; f[i*3+2] += Fz*w;
      }
      // wing pitching moment as front/rear spar couple (d = spar spacing 0.78 m)
      // flap dCm0 feeds in here — the couple reading polarWing.Cm0 alone would
      // silently ignore the flap pitching moment (HANDOVER "watch Cm0")
      if (st.kind === 'wing') {
        // G185: the strip's own plane's Cm0 and spar spacing
        const Fc = q * (P.Cm0 + (fl > 0 ? (FP.dCm0 || 0) * fl : 0))
                     * st.chord / (st.sparSpacing || P_.sparSpacing), t = st.t;
        CW_I[0] = st.fIn; CW_W[0] = (1-t); CW_I[1] = st.fOut; CW_W[1] = t;
        CW_I[2] = st.rIn; CW_W[2] = -(1-t); CW_I[3] = st.rOut; CW_W[3] = -t;
        for (let q = 0; q < 4; q++) {
          const i = CW_I[q], w = CW_W[q];
          f[i*3] += Fc*w*sn[0]; f[i*3+1] += Fc*w*sn[1]; f[i*3+2] += Fc*w*sn[2];
        }
      }
    }
    // fuselage blobs: anisotropic CdA in body axes; side/vertical area split
    // between cabin and aft fuselage so yaw and pitch damping are physical
    const blob = (ids, CdA) => {
      let vx=0, vy=0, vz=0, bx=0, by=0, bz=0;
      for (const i of ids) {
        vx+=v[i*3]; vy+=v[i*3+1]; vz+=v[i*3+2];
        bx+=p[i*3]; by+=p[i*3+1]; bz+=p[i*3+2];
      }
      vx/=4; vy/=4; vz/=4; bx/=4; by/=4; bz/=4;
      // wind on the fuselage: without this there is no weathercocking
      let wx_ = 0, wy_ = 0, wz_ = 0;
      if (world && world.wind) { const wv = world.wind(bx, by, bz, simT); wx_ = wv[0]; wy_ = wv[1]; wz_ = wv[2]; }
      const rx=wx_-vx, ry=wy_-vy, rz=wz_-vz, Vr = hyp3(rx, ry, rz);
      if (Vr < 0.1) return;
      const cb = [rx*xAft[0]+ry*xAft[1]+rz*xAft[2],
                  rx*yUp[0]+ry*yUp[1]+rz*yUp[2],
                  rx*zRt[0]+ry*zRt[1]+rz*zRt[2]];
      const k = 0.5 * rho * Vr * 0.25;
      for (const i of ids) {
        f[i*3]   += k*(CdA[0]*cb[0]*xAft[0] + CdA[1]*cb[1]*yUp[0] + CdA[2]*cb[2]*zRt[0]);
        f[i*3+1] += k*(CdA[0]*cb[0]*xAft[1] + CdA[1]*cb[1]*yUp[1] + CdA[2]*cb[2]*zRt[1]);
        f[i*3+2] += k*(CdA[0]*cb[0]*xAft[2] + CdA[1]*cb[1]*yUp[2] + CdA[2]*cb[2]*zRt[2]);
      }
    };
    blob(def.refs.fusDrag,    P_.fusCdA);
    blob(def.refs.fusDragAft, P_.fusCdAAft);
    // G461: THE BODY'S OWN PITCHING MOMENT (Munk). A closed body in potential
    // flow feels no lift and a pure couple, 2 q (k2 - k1) Vol per radian of
    // incidence, NOSE-UP with the nose up — destabilising, the term every
    // hand calculation carries and the blobs (a crossflow force) cannot
    // make. The incidence is the fore blob's own relative wind against the
    // body axes; the couple is a force pair on the two blob rings, up on
    // the fore ring and down on the aft, over the distance between them.
    // (k2 - k1) and Multhopp's wing correction are one factor, P_.bodyMunk.K
    // (GEN_RULES.bodyMunkK); a fiche without the record flies as before.
    if (P_.bodyMunk && P_.bodyMunk.vol > 0 && def.refs.fusDrag && def.refs.fusDragAft) {
      const A = def.refs.fusDrag, Bq = def.refs.fusDragAft;
      let vx=0, vy=0, vz=0, ax=0, ay=0, bx=0, by=0;
      for (const i of A) { vx+=v[i*3]; vy+=v[i*3+1]; vz+=v[i*3+2]; ax+=p[i*3]; ay+=p[i*3+1]; }
      for (const i of Bq) { bx+=p[i*3]; by+=p[i*3+1]; }
      vx/=A.length; vy/=A.length; vz/=A.length; ax/=A.length; ay/=A.length; bx/=Bq.length; by/=Bq.length;
      let wx_ = 0, wy_ = 0, wz_ = 0;
      if (world && world.wind) { const wv = world.wind(ax, ay, 0, simT); wx_ = wv[0]; wy_ = wv[1]; wz_ = wv[2]; }
      const rx=wx_-vx, ry=wy_-vy, rz=wz_-vz;
      const u = rx*xAft[0]+ry*xAft[1]+rz*xAft[2], wn = rx*yUp[0]+ry*yUp[1]+rz*yUp[2];
      const Vr2 = u*u + wn*wn;
      if (Vr2 > 1) {
        // the body's incidence: the relative wind runs aft (u > 0 flying
        // forward) and from below (wn > 0 along up) with the nose up
        const alB = Math.atan2(wn, u);
        const M = 2 * P_.bodyMunk.K * P_.bodyMunk.vol * 0.5 * rho * Vr2 * Math.sin(2 * alB) * 0.5;
        const L = hyp2(bx - ax, by - ay);
        if (L > 0.3) {
          const F = M / L;      // nose-up couple: up on the fore ring, down on the aft
          for (const i of A)  { f[i*3] += F/A.length*yUp[0];  f[i*3+1] += F/A.length*yUp[1];  f[i*3+2] += F/A.length*yUp[2]; }
          for (const i of Bq) { f[i*3] -= F/Bq.length*yUp[0]; f[i*3+1] -= F/Bq.length*yUp[1]; f[i*3+2] -= F/Bq.length*yUp[2]; }
        }
      }
    }
  }

  // G115: DEFDAMP is overridable per def — for the MEASUREMENT instrument
  // (the G115 yaw probe ran free-yaw decay at two settings; the probe
  // retired with the fleet, 2026-09-05), not for play.
  // No fiche and no generated build sets it, so everything flies 0.5 as ever.
  const G = -9.81, DEFDAMP = def.params.defDamp ?? 0.5;
  // ground stiffness scales with node mass so light aircraft stay stable at the same dt
  const KGn = new Float64Array(n), CGn = new Float64Array(n),
        KTn = new Float64Array(n), CTn = new Float64Array(n);
  // G121: the per-node rig is a FUNCTION now, because a node's mass can
  // change (fuel burns; the sanctioned door is setNodeMass below) and the
  // ground spring plus its critical-damping companion must follow the mass
  // they carry, or the landing rollout at reserves rides constants rigged
  // for full tanks. Identical arithmetic to the old loop.
  function rigGround(i, mi) {
    // light nodes: Cub/drone-calibrated regime (unchanged); heavy nodes keep scaling
    KGn[i] = mi <= 6 ? Math.min(9e4, 2.5e5 * mi) : 1.5e4 * mi;
    CGn[i] = 1.6 * Math.sqrt(KGn[i] * mi);
    KTn[i] = Math.min(2.2e4, 2e5 * mi);
    CTn[i] = Math.min(40, 300 * mi);
  }
  for (let i = 0; i < n; i++) rigGround(i, def.nodes[i].m);

  // G121 — THE SANCTIONED MASS DOOR (the review's B1/B3, built BEFORE the
  // energy arc's burn so it cannot be built wrong). `m[]` was always exposed
  // and mutating it directly was always possible — and always wrong: totalM
  // was summed once at construction, and it is the divisor under the
  // mass-weighted mean velocity that alpha, vs, DEFDAMP's rigid mean, the
  // probe CG and cgPos/cgVel are all built on. Drain fuel behind its back
  // and ALPHA ITSELF corrupts — an invisible drag and rate damper that grow
  // as the tanks empty, and nothing NaNs. This door keeps every consumer
  // honest: the sum, the ground rig, nothing else touched. Burn calls this;
  // nothing else writes m[].
  function setNodeMass(i, kg) {
    if (!(i >= 0 && i < n) || !(kg > 0.01)) return;
    totalM += kg - m[i];
    m[i] = kg;
    rigGround(i, kg);
  }

  function trqOf() {
    let cgx=0, cgy=0;
    for (let i = 0; i < n; i++) { cgx+=p[i*3]*m[i]; cgy+=p[i*3+1]*m[i]; }
    cgx/=totalM; cgy/=totalM;
    let Mz = 0;
    for (let i = 0; i < n; i++)
      Mz += (p[i*3]-cgx)*(f[i*3+1]-G*m[i]) - (p[i*3+1]-cgy)*f[i*3];
    return -Mz;   // nose-up positive, gravity excluded
  }
  // G1813: the kinked members' floors - push only, below the crushed length (out of substep's own body: measured, the
  // loop inline cost the metal Cessna's step ~2 % in the air with no floor at all)
  function floorPass() {
    for (let q = 0; q < nFlr; q++) {
      const b = beams[FLR[q]], a3 = b.a*3, b3 = b.b*3;
      let dx = p[b3]-p[a3], dy = p[b3+1]-p[a3+1], dz = p[b3+2]-p[a3+2];
      const L = hyp3(dx, dy, dz) || 1e-9;
      if (L >= b.Lf) continue;
      dx /= L; dy /= L; dz /= L;
      let Fb = b.kB * (L - b.Lf) + b.cB * ((v[b3]-v[a3])*dx + (v[b3+1]-v[a3+1])*dy + (v[b3+2]-v[a3+2])*dz);
      if (Fb >= 0) continue;
      // G1898.6 (coordinator): THE FLOOR IS PLASTIC - a crushed tube pushes back at most its crush force and crushes further
      // past it (its floor follows), never an elastic stop: the Cub's severe water nose-in drove its stab's 0.3 kg nodes
      // half a metre into 474 kN/m floors and the stored ~60 kJ came back as 3 km/s. Stored energy now <= Ff^2 / 2k
      if (b.Ff > 0 && -Fb > b.Ff) { Fb = -b.Ff; const Le = L + b.Ff / b.kB; if (Le < b.Lf) b.Lf = Le; }
      f[a3]+=Fb*dx; f[a3+1]+=Fb*dy; f[a3+2]+=Fb*dz;
      f[b3]-=Fb*dx; f[b3+1]-=Fb*dy; f[b3+2]-=Fb*dz;
    }
  }
  // G1822: the SUPPORT limiters - push only, below their closing length (walked in a frame armed or after a break)
  function suppPass() {
    for (let q = 0; q < nSup; q++) {
      const S = SUP[q], a3 = S.a*3, b3 = S.b*3;
      let dx = p[b3]-p[a3], dy = p[b3+1]-p[a3+1], dz = p[b3+2]-p[a3+2];
      const L = hyp3(dx, dy, dz) || 1e-9;
      if (L >= S.L0) continue;
      dx /= L; dy /= L; dz /= L;
      const Fb = S.k * (L - S.L0) + S.c * ((v[b3]-v[a3])*dx + (v[b3+1]-v[a3+1])*dy + (v[b3+2]-v[a3+2])*dz);
      if (Fb >= 0) continue;
      f[a3]+=Fb*dx; f[a3+1]+=Fb*dy; f[a3+2]+=Fb*dz;
      f[b3]-=Fb*dx; f[b3+1]-=Fb*dy; f[b3+2]-=Fb*dz;
    }
  }
  function substep(dt) {
    for (let i = 0; i < n; i++) { f[i*3]=0; f[i*3+1]=G*m[i]; f[i*3+2]=0; }
    aeroPass(false);
    // G1470: debris (every member broken) keeps its weight and nothing of the air's
    if (DMG.orphans.length) for (const i of DMG.orphans) { f[i*3] = 0; f[i*3+1] = G*m[i]; f[i*3+2] = 0; }
    if (out.trq) out.trqAero = trqOf();
    for (let bi = 0; bi < nb; bi++) {
      const b = beams[bi];
      const a3=b.a*3, b3=b.b*3;
      let dx=p[b3]-p[a3], dy=p[b3+1]-p[a3+1], dz=p[b3+2]-p[a3+2];
      const L = hyp3(dx, dy, dz) || 1e-9;
      dx/=L; dy/=L; dz/=L;
      // G1470: past its yield the member takes a set (beamYield moves L0), past its ultimate it breaks (k, c -> 0)
      if (armed) { const Fs = b.k * (L - b.L0); if (Fs > FY[bi] || -Fs > FC[bi]) beamYield(bi, L, Fs); }
      const vrel = (v[b3]-v[a3])*dx + (v[b3+1]-v[a3+1])*dy + (v[b3+2]-v[a3+2])*dz;
      b.strain = (L - b.L0) / b.L0 * b.sK;
      // G185: a WIRE carries tension only — slack, it is not there (no
      // spring, and no damper either: a slack cable damps nothing)
      const Fb = (b.tens && L <= b.L0) ? 0 : b.k * (L - b.L0) + b.c * vrel;
      f[a3]+=Fb*dx; f[a3+1]+=Fb*dy; f[a3+2]+=Fb*dz;
      f[b3]-=Fb*dx; f[b3+1]-=Fb*dy; f[b3+2]-=Fb*dz;
    }
    if (postLive) {                                  // G1898.4: one compare a substep for both (none: nothing to do)
      if (nFlr) floorPass();                         // G1813: the kinked members' floors
      if (nSup && (armed || DMG.breaks)) suppPass(); // G1822: the SUPPORT limiters
    }
    // ground: wheels roll, everything else scrapes. Terrain-aware.
    const gH = world ? world.terrainH : null;
    for (let i = 0; i < n; i++) {
      const i3 = i*3;
      let gy;
      if (coneLive) {
        const dx = p[i3] - gcx[i], dz = p[i3+2] - gcz[i];
        const c = p[i3+1] - rC[i] - gcy[i] - GROUND_CONE_EPS;
        if (c > 0 && c * c > coneS2 * (dx * dx + dz * dz)) { out.gndSkipped++; continue; }
        gy = gH(p[i3], p[i3+2]); gcx[i] = p[i3]; gcz[i] = p[i3+2]; gcy[i] = gy; out.gndSampled++;
      } else if (hbLive && p[i3+1] - rC[i] > hbH && p[i3] >= hbX0 && p[i3] <= hbX1 && p[i3+2] >= hbZ0 && p[i3+2] <= hbZ1) {
        out.gndSkipped++; continue;
      } else { gy = gH ? gH(p[i3], p[i3+2]) : 0; if (hbLive) out.gndSampled++; }
      const pen = gy + rC[i] - p[i3+1];
      if (pen <= 0) continue;
      if (NOSE_G[i]) noseGnd = true;                 // G1470: the nose on the ground - the prop has struck it
      let Fn = KGn[i] * pen - CGn[i] * v[i3+1];
      if (out.gndDump) out.gndPitch -= (p[i3] - out.gndCgx) * Fn;

      if (Fn < 0) Fn = 0;
      f[i3+1] += Fn;
      cIy += Fn * dt;                                // G1470: the contact impulse (the impact's g, below)
      const isMain = def.refs.mains.includes(i), isTW = i === def.refs.tw;
      if (isMain || isTW) {
        // rolling dir = horizontal forward, tailwheel steered by rudder
        let hx = -xAft[0], hz = -xAft[2];
        if (isTW) {
          const s = P_.twSteer * ctl.dr;   // measured: matches nose-left convention
          const cs = Math.cos(s), sn_ = Math.sin(s);
          const nx = hx*cs - hz*sn_, nz = hx*sn_ + hz*cs;
          hx = nx; hz = nz;
        }
        const hL = hyp2(hx, hz) || 1e-9; hx/=hL; hz/=hL;
        const lx = -hz, lz = hx;
        const vr_ = v[i3]*hx + v[i3+2]*hz, vl = v[i3]*lx + v[i3+2]*lz;
        // G115: the wheel asks WHAT IT IS ROLLING ON. `world.surface` is the
        // biome classifier with the aerodrome strips folded in (measured: 5
        // at Morford's pavement, 0 at HOME); classes without a row read the
        // grass row, which equals the classic constants — so HOME, the
        // calibration datum, is unchanged to the last bit.
        const su = world && world.surface
          ? (GROUND_SURF[world.surface(p[i3], p[i3+2])] || GROUND_DEF)
          : GROUND_DEF;
        // G1938: the differential brake, per main (its side of the built pose); brakeD 0 is the old line exactly
        const bkI = !isMain ? 0 : ctl.brakeD ? Math.max(0, Math.min(1, ctl.brake + (def.nodes[i].p[2] > 0 ? 1 : -1) * ctl.brakeD)) : ctl.brake;
        const muR = su[0] + (isMain ? bkI * su[1] : 0);
        // G121.3: BELOW WALKING PACE THE COEFFICIENT IS A DAMPER, NOT A
        // RESISTANCE. The 0.2 m/s regularization means the sub-0.2 regime
        // was never physical rolling — and it turned out to be load-bearing
        // as the PLACEMENT-BOUNCE damper: at Morford the fleet's Cub, given
        // pavement's 0.02 in that regime, kept 2.5x less rock damping than
        // the grass the settle was calibrated on and flipped onto its back
        // in 1.7 s, parked, on flat ground (measured; XCTY3 caught it). So
        // the creep regime damps at least at the grass datum on EVERY
        // surface — bit-identical at HOME, where muR == CRR — and the true
        // surface coefficient applies from 0.2 m/s up, which is where the
        // takeoff run, the brakes and the surface honesty actually live.
        // 0.5 m/s, not the 0.2 regularization floor: the placement-bounce
        // ROCKING measured 0.1-0.3 m/s fore-aft at the wheels, just above
        // 0.2 — the band must cover the whole settle/rock regime. Costs a
        // paved takeoff under a metre (it passes 0.5 m/s in the first
        // second); HOME remains bit-identical (muR == CRR there).
        const muRe = Math.abs(vr_) < 0.5 ? Math.max(muR, CRR) : muR;
        const kR = Math.min(muRe * Fn / Math.max(Math.abs(vr_), 0.2), m[i]/dt);
        const kL = Math.min(su[2] * Fn / Math.max(Math.abs(vl), 0.02), m[i]/dt);
        f[i3]   -= kR*vr_*hx + kL*vl*lx;
        f[i3+2] -= kR*vr_*hz + kL*vl*lz;
      } else {
        scrape = true;                               // G1470: something other than a wheel on the ground (arms the yield)
        const vx=v[i3], vz=v[i3+2], sp = hyp2(vx, vz);
        if (sp > 1e-6) {
          const kf = Math.min(0.8 * Fn / sp, m[i]/dt);
          f[i3] -= kf*vx; f[i3+2] -= kf*vz;
          cIx -= kf * vx * dt; cIz -= kf * vz * dt;
        }
      }
    }
    // THE WATER (H1): every wet panel of every float, onto the frame
    const wIn = DMG_ON && (HY || wetOn()) ? waterSum0() : false;   // G1470: the water's push, for the impact's g
    if (HY && world) out.hydroWet = HYDRO.hydroSolverPass(HY, world, f, simT, dt, ctl);
    else if (wetArm) { out.hydroWet = HYDRO.wetSolverPass(WB, world, f, simT, dt); out.wetDrag = WB.drag; out.wetBuoy = WB.buoy; out.wetFlood = WB.flood; }
    if (wIn) waterSum1(dt);
    // tree collisions: cheap cylinder push-out, only when low and near trees
    if (world) {
      const cgx = p[0], cgz = p[2];   // any chassis node as coarse anchor
      // HEIGHT OVER THE GROUND, NOT ALTITUDE (G1112, TREES-NEAR): `p[1] < 24` was the analytic world's, whose field
      // is at y = 0. Jolene's HOME stands at 31.7 m, so no tree was ever tested there - and of the island's collidable
      // woodland only the 23 % rooted under 24 m could be reached at all, and only from under 24 m of altitude
      // (G1481: not where the viewer drew the forest fill in the woodland's place - world.woodSolid false)
      if (world.woodSolid !== false && p[1] - world.terrainH(cgx, cgz) < 24) {
        const near = world.treesNear(cgx, cgz, _treeScratch);
        if (near.length) for (let i = 0; i < n; i++) {
          const i3 = i*3;
          for (const ti of near) {
            const T = world.trees[ti];
            const dx = p[i3] - T.x, dz = p[i3+2] - T.z;
            const R = 0.7 * T.s + 0.12;
            const d2 = dx*dx + dz*dz;
            if (d2 > R*R) continue;
            if (p[i3+1] > T.h + 4.6 * T.s) continue;
            const d = Math.sqrt(d2) || 1e-6;
            const push = KTn[i] * (R - d) / d;
            f[i3] += push * dx - CTn[i] * v[i3];
            f[i3+2] += push * dz - CTn[i] * v[i3+2];
          }
        }
      }
      // THE TREES YOU SEE (G1330, TREE-HITBOX): every trunk the viewer draws - the forest fill, the woodland's clump
      // neighbours and its own trees above the cylinder above, the hand-placed and the premises' trees - registered on
      // the world (29_obstacles.js TREE_HITS) and gathered once a frame round the aeroplane (trunkFrame). Tested
      // against every BEAM, not the nodes: a 0.3-0.6 m trunk slips between two nodes of a wing (they stand up to
      // 0.8 m apart, a beam up to 4.9 m long), and the node test let a taxiing aeroplane through a trunk on its own
      // centreline. The beam's closest point to the trunk's axis (horizontal), inside the radius and between the foot
      // and the top, pushes both its ends out along the axis' normal by their share (1 - t, t), with the GROUND's spring
      // per node (KGn) and its damper on the velocity along the normal, the force never pulling (CGn): the woodland's softer KTn could not
      // hold a taxiing aeroplane inside a 0.3 m radius - the axis crossed the beam and pushed it on through
    }
    for (let q = 0; q < _prN; q++) {
      const b = beams[_pr[q * 2]], ia = b.a * 3, ib = b.b * 3;
      const ax = p[ia], ay = p[ia+1], az = p[ia+2], ex = p[ib] - ax, ey = p[ib+1] - ay, ez = p[ib+2] - az;
      const e2 = ex*ex + ez*ez;
      {
        const o = _pr[q * 2 + 1] * 5, tx = _tk[o], tz = _tk[o+1], R = _tk[o+3];
        let t = e2 > 1e-12 ? ((tx - ax) * ex + (tz - az) * ez) / e2 : 0;
        t = t < 0 ? 0 : t > 1 ? 1 : t;
        const dx = ax + t * ex - tx, dz = az + t * ez - tz, d2 = dx*dx + dz*dz;
        // G1470: a member already BENT ROUND THIS TRUNK keeps the side it was hit from (its line may now cross the
        // trunk's axis: the bend wraps the trunk, it is not pushed out the far side), and stands clear of it by the
        // bend's depth
        const bent = b.dOn && b.dTx === tx && b.dTz === tz;
        let nx, nz, pen;
        if (bent) {
          nx = b.dNx; nz = b.dNz;
          const sN = dx * nx + dz * nz, lat = dx * nz - dz * nx;
          if (sN > R || lat * lat > R * R) continue;
          pen = R - sN - b.dk;
          if (pen <= 0) continue;
        } else {
          if (d2 > R*R) continue;
          const d = Math.sqrt(d2) || 1e-6; nx = dx / d; nz = dz / d; pen = R - d;
        }
        const y = ay + t * ey;
        if (y > _tk[o+4] || y < _tk[o+2] - 1) continue;
        const wa = 1 - t, wb = t;
        const vna = v[ia] * nx + v[ia+2] * nz, vnb = v[ib] * nx + v[ib+2] * nz;
        // damped both ways and never pulling (a clamp at 0): with the damper on the way IN only, the spring handed the
        // impact back and a 30 m/s aeroplane bounced 15 m off a trunk (G1333's pictures showed it)
        let fa = wa * Math.max(0, KGn[b.a] * pen - CGn[b.a] * vna), fb = wb * Math.max(0, KGn[b.b] * pen - CGn[b.b] * vnb);
        // G1470: no more than the member's own collapse load at that point (its ends' clusters take a node-on hit:
        // t held to 0.1..0.9) - past it the member bends round the trunk (beamKink) and the work is gone, where the
        // spring alone handed the whole impact back (an 8 m/s taxi into a trunk rolled back 16 m)
        if (b.mp < Infinity && !(b.dOn && !bent)) {
          const t1 = t < 0.1 ? 0.1 : t > 0.9 ? 0.9 : t, tau = t1 * (1 - t1), Pc = b.mp / (b.Lr * tau), F = fa + fb;
          if (F > Pc) {
            if (!bent) { b.dOn = true; b.dTx = tx; b.dTz = tz; b.dNx = nx; b.dNz = nz; b.dk = 0; b.kt = tau; b.kt1 = t1; }
            const Ke = wa * KGn[b.a] + wb * KGn[b.b], dk = b.dk + pen - Pc / Ke;
            if (dk > b.dk) beamKink(_pr[q * 2], dk, Pc);
            const sc = Pc / F; fa *= sc; fb *= sc;
          }
        }
        f[ia] += fa * nx; f[ia+2] += fa * nz; f[ib] += fb * nx; f[ib+2] += fb * nz;
        cIx += (fa + fb) * nx * dt; cIz += (fa + fb) * nz * dt;
        _tkHits++;
      }
    }
    // G1470: DEBRIS (a node every member of which broke - an engine torn off its mount) meets the trunks as a point:
    // with no beam left to test it would fly through the tree it was torn off on
    if (_tkN && DMG.orphans.length) for (const i of DMG.orphans) {
      const i3 = i * 3;
      for (let k = 0; k < _tkN; k++) {
        const o = k * 5, dx = p[i3] - _tk[o], dz = p[i3+2] - _tk[o+1], R = _tk[o+3] + r[i], d2 = dx*dx + dz*dz;
        if (d2 > R*R || p[i3+1] > _tk[o+4] || p[i3+1] < _tk[o+2] - 1) continue;
        const d = Math.sqrt(d2) || 1e-6, nx = dx / d, nz = dz / d, vn = v[i3] * nx + v[i3+2] * nz;
        const F = Math.max(0, KGn[i] * (R - d) - CGn[i] * vn);
        f[i3] += F * nx; f[i3+2] += F * nz; cIx += F * nx * dt; cIz += F * nz * dt;
      }
    }
    // THE OBSTACLES (G433): every solid thing the world registered (29_obstacles.js - houses, props,
    // cars, the parked aeroplanes, the settlements' boxes, the traffic), a column grid each; a node
    // inside one is pushed out along the shortest way (up, or sideways along the footprint's distance
    // field) by the trees' own spring and damper. Only when low enough to reach the tallest of them.
    out.obst = 0;
    if (_obstRecs.length) {
      for (let i = 0; i < n; i++) {
        const i3 = i*3;
        for (const r of _obstRecs) {
          if (!OBSTACLES.penetration(r, p[i3], p[i3+1], p[i3+2], _pen)) continue;
          const px = _pen[0], py = _pen[1], pz = _pen[2], L = hyp3(px, py, pz) || 1e-6;
          const nx = px / L, ny = py / L, nz = pz / L;
          const vn = v[i3]*nx + v[i3+1]*ny + v[i3+2]*nz;               // the velocity into the thing, damped; the rest kept
          const fk = KTn[i] * L - (vn < 0 ? CTn[i] * vn : 0);
          f[i3] += fk*nx; f[i3+1] += fk*ny; f[i3+2] += fk*nz;
          cIx += fk * nx * dt; cIy += fk * ny * dt; cIz += fk * nz * dt;
          out.obst++;
        }
      }
    }
    if (out.trq) out.trqTotal = trqOf();
    // integrate; damp only deformation (velocity relative to rigid mean)
    let vmx=0, vmy=0, vmz=0;
    for (let i = 0; i < n; i++) { vmx+=v[i*3]*m[i]; vmy+=v[i*3+1]*m[i]; vmz+=v[i*3+2]*m[i]; }
    vmx/=totalM; vmy/=totalM; vmz/=totalM;
    // G348: a fresh reset's clusters take their rest from THIS pose (placed)
    if (clusterFresh) { for (const C of clusters) clusterRest(C); clusterFresh = false; }
    const dp = Math.max(0, 1 - DEFDAMP * dt);
    for (let i = 0; i < n; i++) {
      const i3 = i*3, im = dt/m[i];
      v[i3]   = vmx + (v[i3]   + f[i3]*im   - vmx) * dp;
      v[i3+1] = vmy + (v[i3+1] + f[i3+1]*im - vmy) * dp;
      v[i3+2] = vmz + (v[i3+2] + f[i3+2]*im - vmz) * dp;
      p[i3] += v[i3]*dt; p[i3+1] += v[i3+1]*dt; p[i3+2] += v[i3+2]*dt;
    }
    // G294 / G350: the tube holds its shape, and its twist; G1470: a cluster a member broke inside lets go, one a
    // member took a set inside holds its NEW shape (its rest re-taken here, after the substep that bent it)
    for (const C of clusters) { if (C.off) continue; shapeMatch(C, dt); twistHold(C, dt); }
    if (clDirty) { for (const C of clusters) if (C.dirty) { C.dirty = false; clusterRest(C); twistRest(C); } clDirty = false; }
    // altitude of CG (wheel-corrected later by caller if needed)
    let cy = 0;
    for (let i = 0; i < n; i++) cy += p[i*3+1]*m[i];
    out.alt = cy/totalM;
  }

  // THE ACTUAL WING (G610): this sim flies the true box until its next reset() - every softened beam back
  // to its true k and c, the step the true box needs as the default. The load test and GATE FLEX call it
  // (after their reset): "let the test test the actual wing". Returns the step.
  function trueBox() {
    for (const b of beams) if (b.kTrue != null && !b.broken) { b.k = b.kTrue; b.c = b.cTrue; b.sK = 1; }
    if (P_.substepsTrue) subN = P_.substepsTrue;
    return subN;
  }
  function step(dtFrame, sub = subN) {
    const dt = dtFrame / sub;
    aicFresh = true;
    // the cone's frame-start samples (a bound the world declares, else off)
    const S = coneOn && world ? world.slopeMax : undefined;
    coneLive = typeof S === 'number' && Number.isFinite(S) && S >= 0;
    out.gndSampled = 0; out.gndSkipped = 0;
    if (coneLive) {
      coneS2 = S * S;
      const gH = world.terrainH;
      for (let i = 0; i < n; i++) { gcx[i] = p[i*3]; gcz[i] = p[i*3+2]; gcy[i] = gH(p[i*3], p[i*3+2]); }
    }
    // the ceiling (above): only where the world's ground is the one it bounds
    const GM = coneOn && !coneLive && world ? world.groundMaxRect : null;
    hbLive = false;
    if (GM && GM.of === world.terrainH) {
      let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity, v2 = 0;
      for (let i = 0; i < n; i++) {
        const x = p[i*3], z = p[i*3+2];
        if (x < x0) x0 = x; if (x > x1) x1 = x; if (z < z0) z0 = z; if (z > z1) z1 = z;
        const s2 = v[i*3]*v[i*3] + v[i*3+2]*v[i*3+2]; if (s2 > v2) v2 = s2;
      }
      const mg = 0.5 + 2 * Math.sqrt(v2) * dtFrame;
      hbX0 = x0 - mg; hbX1 = x1 + mg; hbZ0 = z0 - mg; hbZ1 = z1 + mg;
      const H = GM(hbX0, hbZ0, hbX1, hbZ1);
      if (Number.isFinite(H)) { hbH = H + 1e-6; hbLive = true; }
    }
    obstFrame();
    trunkFrame(dtFrame);
    wetArmFrame(dtFrame);                           // G1384: the water's pass only on a frame that can reach it
    armFrame();
    postLive = (nFlr > 0 || (nSup > 0 && (armed || DMG.breaks > 0))) ? 1 : 0;   // G1898.4
    // G1840 (DMG-D3): the clusters' cuts are measured on every substep of an armed frame, and on the last of any other:
    // the members across them read from the substep's own starting state (the beam loop's), the cuts judged once its
    // projection has run, the parts that came off re-formed rigid - all out here, so substep() is the base's
    // G1898.10: no cut (always so with the layer off) - master's own loop, no per-substep flag
    if (nCut0 === 0) for (let s = 0; s < sub; s++) { substep(dt); simT += dt; burn(dt); }
    else for (let s = 0; s < sub; s++) {
      clMs = nCut0 > 0 && (armed || s === sub - 1);
      if (clMs) cutX();
      substep(dt);
      if (clMs) clCuts();
      if (clQ.length) clApply();
      simT += dt; burn(dt);
    }
    readPanel(dtFrame);
    dmgFrame(dtFrame);
    dmgOver();
  }

  // ONE THRUST MODEL, TWO READERS. 64_gen_build's design-time numbers — the
  // cruise speed off the power curve, thrCruise, the climb gradient, the
  // take-off roll integration — used to re-type `Tstatic - kV2 V^2` straight
  // off the registry. That was harmless while the air was a constant and became
  // a SECOND, quieter engine the moment it stopped being one: the sheet would
  // have gone on quoting sea-level thrust while the aeroplane flew on less.
  // `floor` is the caller's own — genTrim floors the bracket at 1 N so a ratio
  // cannot divide by zero, the take-off roll floors it at 0 — and it is passed
  // rather than chosen here so the two readers keep their own numbers exactly.
  // What air a PROBE is in, for the readers that have to convert between the
  // equivalent airspeeds the sheet is written in and the true ones the tunnel
  // prescribes. Cheap, and it keeps the conversion in one place.
  function probeAir() {
    const A = airOf(), sg = A.sigma(hProbe);
    return { air: A, h: hProbe, rho: A.rho(hProbe), sigma: sg,
             easK: Math.sqrt(sg), densityAlt: A.densityAlt(hProbe),
             oatC: A.T(hProbe) - 273.15, power: atmosPowerRatio(sg, ASP, FLAT, CRIT),
             aspiration: ASP };
  }

  function thrustAt(V, floor = 0, hAlt) {
    const A = airOf();
    const PS = atmosPropScale(A.sigma(hAlt == null ? hProbe : hAlt), ASP, FLAT, CRIT);
    return Math.max(floor, PR.Tstatic * PS.kT - PR.kV2 * PS.kV * V * V)
           * (def.params.nEngines || 1);
  }

  // ---- wind tunnel: prescribe uniform velocity, measure aero force+moment ----
  // (G1830, DMG-D2a: `live` - the pass as the step makes it, the propeller's thrust and its wash over the tail and the
  // inner wing included; the certificate's flight cases read the node forces it leaves in f. Absent: as ever)
  function probe(vel, live) {
    for (let i = 0; i < n; i++) {
      f[i*3]=f[i*3+1]=f[i*3+2]=0;
      v[i*3]=vel[0]; v[i*3+1]=vel[1]; v[i*3+2]=vel[2];
    }
    // G185.5: a probe has no history, so the circulation is iterated to a
    // fixed point — a FIXED number of passes (never a tolerance loop: the
    // trim search needs a smooth function of speed), the residual posted
    Gam.fill(0);
    for (let k = 0; k < K_PROBE; k++) {
      if (k) for (let i = 0; i < n; i++) f[i*3]=f[i*3+1]=f[i*3+2]=0;
      aeroPass(live ? (k === 0) : true);   // (live: the first pass builds the geometry as a probe does, the rest fly)
    }
    if (NP) { let d = 0, s = 0; for (const j of WS) { d += Math.abs(Gam[j] - GamPrev[j]); s += Math.abs(Gam[j]); }
              out.gamResid = s > 0 ? d / s : 0; } else out.gamResid = 0;
    let cgx=0, cgy=0, cgz=0;
    for (let i = 0; i < n; i++) { cgx+=p[i*3]*m[i]; cgy+=p[i*3+1]*m[i]; cgz+=p[i*3+2]*m[i]; }
    cgx/=totalM; cgy/=totalM; cgz/=totalM;
    let Fx=0, Fy=0, Fz=0, Mz=0, My=0;
    for (let i = 0; i < n; i++) {
      Fx+=f[i*3]; Fy+=f[i*3+1]; Fz+=f[i*3+2];
      Mz += (p[i*3]-cgx)*f[i*3+1] - (p[i*3+1]-cgy)*f[i*3];
      My += (p[i*3+2]-cgz)*f[i*3] - (p[i*3]-cgx)*f[i*3+2];
    }
    // nose-up pitch = -Mz ; nose-LEFT yaw = +My  (nose -x, +z is the LEFT side)
    return { Fx, Fy, Fz, pitchUp: -Mz, yawLeft: My, cg: [cgx, cgy, cgz],
             planeFy: out.planeFy ? out.planeFy.slice() : [] };   // G185
  }

  function stats() {
    let smax = 0, bad = false;
    for (const b of beams) smax = Math.max(smax, Math.abs(b.strain));
    for (let i = 0; i < n; i++) if (!isFinite(p[i*3+1])) bad = true;
    return { smax, bad: bad || !!VG.fault };   // G1801: a node past the velocity guard is a sim fault too
  }
  function impulse(i, ix, iy, iz) { v[i*3]+=ix/m[i]; v[i*3+1]+=iy/m[i]; v[i*3+2]+=iz/m[i]; }
  function wheelsOnGround() {
    let c = 0;
    // H4 (G393): ON THE WATER the floats are the contacts — each wet float
    // counts one, and the pair in the displacement regime (the afterbody
    // wet: not yet on the step) counts a third, so a seaplane at rest reads
    // three like a taildragger on three points and two once on the step,
    // which is exactly the tail-down / tail-up split the pilot steers by
    if (HY) {
      let wet = 0, aft = 0;
      for (const fx of HY.floats) { if (fx.wet > 0.05) wet++; if (fx.out.wetA > 0.2) aft++; }
      return wet + (wet === 2 && aft === 2 ? 1 : 0);
    }
    for (const i of [...def.refs.mains, def.refs.tw]) {
      if (!(i >= 0)) continue;   // REVIEW 2026-10-04: no third wheel (tw null) read p[NaN]
      const gh = world ? world.terrainH(p[i*3], p[i*3+2]) : 0;
      if (p[i*3+1] - rC[i] - gh < 0.03) c++;
    }
    return c;
  }
  // P1.D: WHICH wheels — the mains in order and the tail / nose wheel, so a
  // ground law can tell one main down (a wing-low touchdown) from the tail
  // still flying; on the water the floats, as above
  function wheelContacts() {
    const on = i => { const gh = world ? world.terrainH(p[i*3], p[i*3+2]) : 0; return p[i*3+1] - rC[i] - gh < 0.03; };
    if (HY) return { mains: HY.floats.map(fx => fx.wet > 0.05), tw: HY.floats.length === 2 && HY.floats.every(fx => fx.out.wetA > 0.2), water: true };
    return { mains: def.refs.mains.map(on), tw: def.refs.tw != null && def.refs.tw >= 0 ? on(def.refs.tw) : false, water: false };
  }
  function cgPos() {
    let x=0, y=0, z=0;
    for (let i = 0; i < n; i++) { x+=p[i*3]*m[i]; y+=p[i*3+1]*m[i]; z+=p[i*3+2]*m[i]; }
    return [x/totalM, y/totalM, z/totalM];
  }
  function cgVel() {
    let x=0, y=0, z=0;
    for (let i = 0; i < n; i++) { x+=v[i*3]*m[i]; y+=v[i*3+1]*m[i]; z+=v[i*3+2]*m[i]; }
    return [x/totalM, y/totalM, z/totalM];
  }
  function axes() { bodyAxes(); return [xAft.slice(), yUp.slice(), zRt.slice()]; }
  // THE STRUCTURAL ORIGIN (G179): where the body frame is PINNED. bodyAxes
  // takes its directions off the firewall ring and the tail post; the origin
  // of every rest-vs-live comparison used to be the MASS CENTRE, which moves
  // relative to the structure whenever a heavy node sags or a tank drains. A
  // wing-mounted pair hanging 0.3 m low dropped the CG 59 mm, and every bound
  // wing vertex rode UP by that much against an unbound centre section — the
  // hump at the root, on the stand, that no flight gate could see. The
  // firewall ring is the reference the axes already use: one datum, not two.
  // Rest side: defOrigin() in 50_model_codec.js, the same average.
  // G179.3: the wing carry-through where the frame declares one (refs.origin,
  // every generated build), the firewall ring otherwise (the imported fiches)
  function bodyOrigin() { avgP(def.refs.origin || def.refs.noseFrame, t1); return t1.slice(); }

  // G1891 (DMG-CERTCOST): THE STATE OF A WHOLE AEROPLANE, SAVED AND PUT BACK. The certificate's landings (66_gen_cert.js
  // genCertDrop) each settled a fresh sim on its wheels for 4 s from the same reset - the same 240 frames four to six
  // times a build, most of a floatplane's certificate. snap() takes everything a step reads and writes - the nodes, the
  // members' mechanical state (rest length, stiffness: never their limits), the clusters, the air's lag (the
  // circulations, the kernel's cache), the ground's and the water's state, the engines, the tanks, the panel's filters,
  // the clock - and unsnap(S) writes it into ANOTHER sim of the same def (its nodes and beams the same arrays), made
  // the same way: the second runs on exactly as the first would have (GATE DMGCERTCOST: the certificate with the
  // settle shared is the unshared one to the bit).
  // Only for a WHOLE aeroplane: nothing bent, broken or parted, no wet body - snap() returns null otherwise (a damaged
  // lattice's structure is not its def's). Never in the step: what a step costs is untouched.
  const whole = () => !(DMG.breaks || DMG.yields || DMG.dents || DMG.cl.length || WB || clQ.length);
  function snap() {
    if (!whole()) return null;
    return { n, nb, nodes: def.nodes, beams: def.beams,
      A: [p, v, f, m, r, rC, KGn, CGn, KTn, CTn, gcx, gcy, gcz, Gam, GamPrev, vi, AIC, sA, sB, sZA, sZB, cpt, Ez, Dz, Wg, pG, pS, pDz, pEDz, bHalf, _tk, _pr]
        .map(a => a.slice()),
      O: snapCopy([xAft, yUp, zRt, t1, t2, sD, sC, beams.map(b => [b.L0, b.Lr, b.strain, b.k, b.c, b.sK]), clusters, CUTS, eng, fuel, VG, ctl,
                   Object.assign({}, out, { hydro: null })]),
      // the floats' water (32_hydro.js hydroBuild): its sub-rate's count and held forces and the floats' last answers -
      // the rest of it (the hull, the scratch) is rebuilt from the nodes at every compute
      H: HY ? { tick: HY.tick, wet: HY.wet, fh: HY.fh.slice(), fl: HY.floats.map(fx => [fx.h, fx.wet, fx.wrDown]) } : null,
      S: [subN, clusterFresh, simT, gF, cIx, cIy, cIz, armed, scrape, noseGnd, aicHash, aicFresh, atmOver, hProbe, gRef,
          vPrev && vPrev.slice(), hdgPrev, totalM, coneOn, coneLive, coneS2, hbLive, hbH, hbX0, hbX1, hbZ0, hbZ1, wetArm,
          _tkN, _prN, _tkHits, postLive, clMs, clArm, clDirty, _w0x, _w0y, _w0z] };
  }
  function unsnap(Sn) {
    if (!Sn || Sn.nodes !== def.nodes || Sn.beams !== def.beams || Sn.n !== n || Sn.nb !== nb || !whole()) return false;
    [p, v, f, m, r, rC, KGn, CGn, KTn, CTn, gcx, gcy, gcz, Gam, GamPrev, vi, AIC, sA, sB, sZA, sZB, cpt, Ez, Dz, Wg, pG, pS, pDz, pEDz, bHalf, _tk, _pr]
      .forEach((a, k) => a.set(Sn.A[k]));
    const O = Sn.O, B = O[7];
    [xAft, yUp, zRt, t1, t2, sD, sC].forEach((a, k) => snapPut(a, O[k]));
    // (a field written only where it differs: a whole aeroplane's members hold their reset's values but the strain, and
    // a number read back out of a double array is a heap number - written into a member's small-integer field (a wire's
    // c 0, sK 1) it generalises the field and every later sim's beam loop ran 40 % slower, measured)
    beams.forEach((b, bi) => { const x = B[bi];
      if (b.L0 !== x[0]) b.L0 = x[0]; if (b.Lr !== x[1]) b.Lr = x[1]; if (b.strain !== x[2]) b.strain = x[2];
      if (b.k !== x[3]) b.k = x[3]; if (b.c !== x[4]) b.c = x[4]; if (b.sK !== x[5]) b.sK = x[5]; });
    snapPut(clusters, O[8]); snapPut(CUTS, O[9]); snapPut(eng, O[10]); snapPut(fuel, O[11]); snapPut(VG, O[12]);
    snapPut(ctl, O[13]); snapPut(out, Object.assign({}, O[14], { hydro: HY }));
    if (HY && Sn.H) {
      if (HY.tick !== Sn.H.tick) HY.tick = Sn.H.tick; if (HY.wet !== Sn.H.wet) HY.wet = Sn.H.wet; HY.fh.set(Sn.H.fh);
      HY.floats.forEach((fx, k) => { const x = Sn.H.fl[k]; if (fx.h !== x[0]) fx.h = x[0]; if (fx.wet !== x[1]) fx.wet = x[1]; if (fx.wrDown !== x[2]) fx.wrDown = x[2]; });
    }
    [subN, clusterFresh, simT, gF, cIx, cIy, cIz, armed, scrape, noseGnd, aicHash, aicFresh, atmOver, hProbe, gRef,
     vPrev, hdgPrev, totalM, coneOn, coneLive, coneS2, hbLive, hbH, hbX0, hbX1, hbZ0, hbZ1, wetArm,
     _tkN, _prN, _tkHits, postLive, clMs, clArm, clDirty, _w0x, _w0y, _w0z] = Sn.S;
    if (vPrev) vPrev = vPrev.slice();
    return true;
  }
  // G121: totalM is a GETTER — it was a copied value, so a mass change via
  // setNodeMass would have been invisible to every external reader (the
  // autopilot's taxi feedforward, the shakedown's weights). Same number as
  // ever for anything that never changes mass; nothing writes it.
  const sim = { p, v, m, r, f, beams, n, ctl, out, get totalM() { return totalM; },   // f: the node forces of the last pass, readable (G461's NP decomposition)
           // THE CLOCK, READABLE (G460, ruling ap): the wave the floats are pushed by is
           // waterH(x, z, simT) - the renderer draws the same wave at the same t
           get t() { return simT; },
           setNodeMass,
           // the panel arc: the tanks, the engines and their one writer
           fuel, eng, setEngine, thrEffOf, hydro: HY, get wetBody() { return WB; },
           // G2090 (WATER-LOOK): the wet body's contacts for the page's spray / wake / bubbles (32_hydro.js wetFx; reading
           // clears the slam peaks it hands over); null while no wet body was ever built
           wetFx: dst => (WB && HYDRO.wetFx ? HYDRO.wetFx(WB, dst) : null),
           trunkHits: () => _tkHits,   // G1330: beam-trunk contacts (one per beam per trunk per substep) since the sim was made
           // G1470: the damage - yields, breaks (beam indices), plastic work (J), the largest set (strain), the peak
           // filtered g, the prop strike, and the verdict: crashed (with why and when) / dented / neither
           damage: () => DMG, damagePeak: () => PEAK,
           // G1831 (DMG-D2a): stamp the certificate on a sim that has not bent yet (the page's arrives from its
           // worker); true if stamped. cert(): the certificate stamped, or null
           certStamp: Cc => certStamp(Cc), cert: () => CERT,
           snap, unsnap,   // G1891: a whole aeroplane's state, saved and put back into a sim of the same def
           // G1815: break one member as a crash would (GATE DMGMEMBERS' closed-set check: its group, and nothing more)
           damageBreak: bi => { if (DMG_ON && bi >= 0 && bi < nb) beamBreak(bi, 'gate'); },
           // G1840 (DMG-D3): the clusters' cuts - limits (N.m), the last measured ratios and loads, the peaks, parted -
           // and each tube cluster's twist bays (the worst bay's torque over its limit); `clusters` live (their nodes)
           clusterCuts: () => ({ cuts: CUTS.map((c, k) => ({ k, cl: c.cl, tag: clusters[c.cl] ? clusters[c.cl].tag : null, cls: clusters[c.cl] ? clusters[c.cl].cls : null, kind: c.kind,
                                   Mu: c.Mu, Mv: c.Mv, T: c.T, yb: c.yb, yt: c.yt, rb: c.rb, rt: c.rt, Mb: c.Mb, Tq: c.Tq, pk: c.pk, pkB: c.pkB, pkT: c.pkT, done: c.done,
                                   grp: c.grp >= 0 ? DGR[c.grp].key : null, P: Array.from(c.P), X: Array.from(c.X), bay: c.bay })),
                                 twist: clusters.map((C, ci) => C.twL0 ? { cl: ci, tag: C.tag, lim: C.twL0.slice(), r: C.twR, pk: C.twPk } : null).filter(x => x),
                                 clusters: clusters.map(C => ({ tag: C.tag, cls: C.cls, off: !!C.off, nodes: Array.from(C.idx) })) }),
           // G1801: the velocity guard - { vMax, node, peak, fault: null | { why: 'speed' | 'nan', node, v, t } }
           guard: () => VG, fault: () => VG.fault,
           // G1820: the strips as the aero pass flies them (dead, and each one's weights: the build's or a split's)
           damageStrips: () => ({ dead: stripDead, w: SW }),
           // G1822: the SUPPORT limiters ({ a, b, k, c, L0, path }; closed while their nodes are nearer than L0)
           damageSupp: () => SUP,
           reset, stance, step, trueBox, probe, stats, impulse, wheelsOnGround, wheelContacts, cgPos, cgVel, axes,
           // G197: the kernel's sources, readable (the gate asserts the weights' normalisation)
           induction: () => ({ WS: WS.slice(), plane: Array.from(PLANE), bHalf: Array.from(bHalf), Ez: Array.from(Ez), Dz: Array.from(Dz), Gam: Array.from(Gam), Wg: Array.from(Wg), zA: WS.map(j => sZA[j]), zB: WS.map(j => sZB[j]), A: WS.map(j => [sA[j*3], sA[j*3+1], sA[j*3+2]]), B: WS.map(j => [sB[j*3], sB[j*3+1], sB[j*3+2]]), d: sD.slice(), cpt: Array.from(cpt), pairs: pairs.length, loading: LOADING }),
           bodyOrigin,
           setAtmos, setGroundRef, setGroundCone, atmos: airOf, thrustAt, probeAir };
  return sim;
}


