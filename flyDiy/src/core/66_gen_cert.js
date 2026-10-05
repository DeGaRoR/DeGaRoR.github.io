// ============================================================
// THE CERTIFICATE (G1830-G1834, DMG-D2a; DEFORM-AND-BREAK §4.3 (c), ruling dm1).
//
// TREE-CRASH judged a member on its PHYSICS: it yields at sigY x A (GEN_CRASH, its billed section). That is calibration
// (a) of §4.3 and it is crash-only: on the validated builds the worst member reaches 0.17-0.36 of its yield at the 3.8 g
// limit on the bench, so nothing a pilot can do in the air ever bends the aeroplane. The certificate anchors each
// member to the loads the aeroplane is CERTIFIED for, the way a real one is sized: the generator runs the cases a
// certification runs, records every member's peak force at LIMIT load (the per-member envelope F_l, tension and
// compression apart), and the solver stamps the member from it (30_solver.js certStamp, behind params.damage, only when
// the def carries a certificate), never past its physics (TREE-CRASH's material x section, D1a's seams and Euler):
//   - tension, ductile: the first set just past the limit, Fy = max(F_l x yTol, Fy_floor); the break at the certified
//     ultimate times the card's margin and the member's own, Fu = max(1.5 F_l m x uMember, Fu_floor), over a short
//     plastic travel (etu); brittle (spruce - its ragged stages kept, its scatter only upward -, carbon): Fy = Fu;
//   - a JOINT (D1a's seams: the fitting - the wing root, the strut, the tail, the mount, the float struts -, the rivet
//     line, the glue line, the opening's frame) is brittle at 1.5 F_l m x uFit: the part comes off as a part (§4.4) at
//     the card's broke-at, every member between the joints holding 1.15 x longer (see uFit / uMember below: FAR
//     23.625's 15 %, kept between the two, on the side the lattice can show);
//   - compression: the member crushes (perfectly plastic, to its kink) at the certified ULTIMATE, never at the limit -
//     a member perfectly plastic at its limit would be a mechanism one hair past it, the wing folding at 3.81 g -
//     Fc = min(max(1.5 F_l,c m x uMember, Fc_floor), its physics), the physics being D1a's Euler on a tube member: a
//     slender tube still buckles where the card would allow more (where a bad design shows);
//   - the FLOORS (kappa x the member's D1a physics) keep a member no certified case loads from being paper; a crash
//     into the ground or a trunk meets members past every certified case, and there the floors and Euler govern.
// The gear's own members keep D1a's limits (the gear bracket, §7.3, is DMG-D2b's).
//
// THE CASES (FAR 23 normal category; the sections named are written from the regulation's text as recalled, not from
// a search summary, and are A0's to open on the box before a number of theirs becomes a gate: §1, §11.2 #7):
//   ON THE SOLVER'S OWN AIR (sim.probe live: the strips' span and chord distribution, the aerofoil's pitching moment
//   twisting the box, the controls' loads on their strips, the propeller's thrust and wash), the aeroplane as it flies
//   (the flight box, G610), each case a static equilibrium of the lattice's own force law with whatever the loads leave
//   unbalanced taken by the rigid body's acceleration (inertia relief - nothing supports it):
//     the V-n corners (23.333/23.335/23.337): A (V_A, +3.8 g, trimmed), D (V_D, +3.8 g, trimmed), the negative limit
//     at V_C (-0.4 x 3.8 = -1.52 g); A and D again with the checked manoeuvre's pitching acceleration on top
//     (23.423(b)); the rolling pull (23.349: 2/3 of the limit, the aileron full, both ways); the elevator hard over at
//     V_D and the rudder hard over at V_A from 1 g, suddenly (x dynCtl: a stick snapped over is a step on an elastic
//     tail);
//   THE ENGINE ON ITS MOUNT (23.561(b): 9 g forward, 3 up, 6 down, 1.5 either way, ultimate) and THE AIRFRAME STOPPED
//   AT ITS NOSE (23.561's 9 g forward, the reaction at the propeller: a trunk at a taxi's pace);
//   THE BENCH (the garage's own rig, 65_gen_loadtest: the fuselage on trestles, inverted, the bags at 3.8 g with the
//   wing's own weight, the true box) - the static answer the rig converges to (to 0.05 %), so a bench run to the limit
//   leaves no set by construction;
//   DYNAMIC, the real sim under the probe: THE DROP (23.473: GATE TREECRASH's own, at the 10 ft/s cap, no lift), a
//   floatplane's BOW LANDING (23.527-23.529: TREECRASH's float nose-in), and THE FLIGHT TEST (23.307: the pull flown to
//   the limit - the airframe's own dynamics, read up to the step the wing's load first reaches it).
// Linear algebra: a dense Cholesky of ~300-400 degrees of freedom per stiffness, Newton on the tangent to the
// equilibrium (a few rounds a case). The dynamic cases are most of the cost (2.6-9 s a build in node and in a browser
// worker). THE COST IS NEVER IN THE GARAGE'S EDIT LOOP: the page asks for the certificate when the aeroplane rolls out,
// on the bench's thread (bench_worker.js 'cert'), and stamps the live sim when it lands (app.js certKick); the bench's
// test to destruction takes it from there; the gates call genCertify / genCertAttach (cached by the spec's hash).
// ============================================================
const GEN_CERT = {
  limit: GEN_LOAD_LIMIT,     // 23.337(a), the normal category's +3.8 g
  ult: GEN_LOAD_ULT,         // 23.303: 1.5 x limit
  neg: 0.4,                  // 23.337(b): the negative limit at least 0.4 x the positive
  roll: 2 / 3,               // 23.349: the rolling condition at 2/3 of the positive limit
  m: 1.05,                   // the margin the card prints: a joint breaks at 1.5 F_l m (DEFORM §4.3: m ~ 1.0-1.1)
  yTol: 1.01,                // the first set at 1.01 x the envelope (the rig's substep peaks round its static answer)
  etu: 0.01,                 // a certified ductile member's plastic travel to its break: a built-up member (a spar cap, a
                             // stringer panel) gives within a percent or two, not the coupon's 8-10 % (D1a's rivet line:
                             // 2 %). Measured: at 10 % the metal Cessnas' box yields from 3.9 g and sheds its load, and the
                             // strut lets go at 6.9-7.3 g, past the card; at 2 %, 6.1-6.2 g; at 1 %, 6.06-6.10 g
  // THE FITTING FACTOR, READ AS THE LATTICE NEEDS IT (the coordinator's ruling asked for, HANDOVER G1831): the brief's
  // literal stamp (a fitting at 1.15 x the member's certified break) puts every joint 15 % past the members it joins,
  // so on every certified build the first thing to break is the middle of a member (§7.2 forbids it) and the joints
  // hold to 1.15 x 1.5 m x the limit (6.9 g at m 1.05; 7.2 at 1.1) - past §7.4's over-g row (the ultimate x 1.1 breaks
  // AT A FITTING, at the g on the card). In the lattice a joint member IS the bolt and the tube (D1a: no separate
  // bolt), and §7.2's own reason - "joints and cutouts are where a crash finds the structure: load concentration and
  // fasteners, not the certified strength" - is the concentration the 15 % is written for. So the 15 % stays between
  // the joint and the members, on the side the lattice can show: the joint lets go at the card's broke-at (1.5 F_l m),
  // every member between joints 1.15 x further. Both readings measured (GATE DMGCERT's evidence)
  uMember: 1.15,             // an ordinary member breaks at 1.5 F_l m x uMember
  uFit: 1,                   // a joint at 1.5 F_l m x uFit
  kappa: 0.1,                // the floor: kappa x the member's physics (the census: HANDOVER G1831, kappa.json)
  dynCtl: 2,                 // the controls' hard-over cases, suddenly applied: twice the static load
  dropCap: true,             // the drop at 23.473(d)'s 10 ft/s cap rather than the build's own V (GATE TREECRASH drops there)
};
const GEN_CERT_V = 1;        // the certificate's own version (a cached answer is only valid for the rules that made it)

// is the damage layer on for this def? (30_solver's own DMG_ON: params.damage, else the page's ?damage, else the
// default) - the page asks before it spends a thread on a certificate
function genDamageOn(def) {
  const P = (def && def.params) || {};
  return (P.damage ?? (typeof FLYDIY_DAMAGE === 'boolean' ? FLYDIY_DAMAGE
          : typeof GEN_DAMAGE_DEFAULT !== 'undefined' && GEN_DAMAGE_DEFAULT)) === true && typeof GEN_CRASH !== 'undefined';
}
// ---- the build's key: the spec, else the frame's own numbers -----------------------------------------------------
function genCertKey(def) {
  let h = 0x811c9dc5;
  const mix = s => { for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0; };
  mix('cert' + GEN_CERT_V + JSON.stringify(GEN_CERT) + (typeof PHYSICS_V !== 'undefined' ? PHYSICS_V : ''));
  if (def.spec) mix(JSON.stringify(def.spec));
  else {
    for (const nd of def.nodes) mix(nd.p.join(',') + ':' + nd.m);
    for (const b of def.beams) mix(b.a + ',' + b.b + ',' + b.k + ',' + (b.kTrue || '') + ',' + (b.cls || ''));
  }
  mix(':' + def.nodes.length + ':' + def.beams.length);
  return h.toString(16);
}

// ---- the static solver -------------------------------------------------------------------------------------------
// K u = f on the lattice as the solver builds it: each beam an axial spring k e e^T (and a pre-tensioned wire's
// geometric stiffness T / L (I - e e^T)), each shape-matched cluster the spring toward its rigid fit the projection
// is (30_solver shapeMatch: the fraction (omega dt)^2 of the way each substep = omega^2 m per node off the rigid
// fit; a rigid cluster's al = 1 is omega = 1 / dt), linearised about the def's own geometry. A tiny mass-weighted
// regularisation (eps M) makes the free body solvable: self-equilibrated loads have no component along its rigid
// modes, so it moves nothing they load. `pinned` (the bench's trestles) removes those nodes' degrees of freedom.
function genCertSystem(def, opt) {
  const n = def.nodes.length, P = opt.pos || null;
  const nodes = P ? def.nodes.map((nd, i) => ({ p: [P[i * 3], P[i * 3 + 1], P[i * 3 + 2]], m: nd.m })) : def.nodes;
  const pin = opt.pinned || null;
  const dof = new Int32Array(n * 3).fill(-1);
  let N = 0;
  for (let i = 0; i < n; i++) if (!pin || !pin[i]) for (let j = 0; j < 3; j++) dof[i * 3 + j] = N++;
  const K = new Float64Array(N * N), lin = [];
  const X = new Float64Array(n * 3);
  for (let i = 0; i < n; i++) for (let j = 0; j < 3; j++) X[i * 3 + j] = nodes[i].p[j];
  const kOf = opt.kOf;
  const B = def.beams, Lb = new Float64Array(B.length);
  const add = (ia, ib, blk) => {
    for (let r = 0; r < 3; r++) { const dr = dof[ia * 3 + r]; if (dr < 0) continue;
      for (let c = 0; c < 3; c++) { const dc = dof[ib * 3 + c]; if (dc < 0) continue; K[dr * N + dc] += blk[r * 3 + c]; } }
  };
  const blk = new Float64Array(9), nblk = new Float64Array(9);
  for (let bi = 0; bi < B.length; bi++) {
    const b = B[bi], pa = nodes[b.a].p, pb = nodes[b.b].p;
    let ex = pb[0] - pa[0], ey = pb[1] - pa[1], ez = pb[2] - pa[2];
    const L = Math.hypot(ex, ey, ez) || 1e-9; ex /= L; ey /= L; ez /= L;
    Lb[bi] = L;
    const k = kOf(b);
    if (!(k > 0)) continue;
    // (the axial stiffness only: a rigging wire's pre-tension alone is not a self-equilibrated set, and its geometric
    // stiffness would resist a rigid turn; the equilibrium (genCertForces) carries every member's force exactly, the
    // pre-tension - 30_solver reset's L0 = L (1 - pre) - included)
    const e = [ex, ey, ez];
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) { const v = k * e[r] * e[c]; blk[r * 3 + c] = v; nblk[r * 3 + c] = -v; }
    add(b.a, b.a, blk); add(b.b, b.b, blk); add(b.a, b.b, nblk); add(b.b, b.a, nblk);
  }
  // the clusters: omega^2 (M - M R (R^T M R)^-1 R^T M) on their nodes
  const dt = 1 / (60 * (opt.sub || 24));
  for (const Cl of def.clusters || []) {
    const idx = Cl.nodes || []; if (idx.length < 2) continue;
    const w = Cl.omega > 0 ? Math.min(Cl.omega, 1 / dt) : 1 / dt, w2 = w * w;
    const nc = idx.length;
    let M = 0, cx = 0, cy = 0, cz = 0;
    for (const i of idx) { const mi = nodes[i].m; M += mi; cx += mi * nodes[i].p[0]; cy += mi * nodes[i].p[1]; cz += mi * nodes[i].p[2]; }
    cx /= M; cy /= M; cz /= M;
    // R: 3 nc x 6 (translations, rotations theta x q); MR and G = R^T M R
    const R = new Float64Array(nc * 3 * 6);
    for (let k = 0; k < nc; k++) {
      const p = nodes[idx[k]].p, qx = p[0] - cx, qy = p[1] - cy, qz = p[2] - cz;
      for (let j = 0; j < 3; j++) R[(k * 3 + j) * 6 + j] = 1;
      // theta x q: rot x -> (0, -qz, qy); rot y -> (qz, 0, -qx); rot z -> (-qy, qx, 0)
      R[(k * 3 + 1) * 6 + 3] = -qz; R[(k * 3 + 2) * 6 + 3] = qy;
      R[(k * 3) * 6 + 4] = qz; R[(k * 3 + 2) * 6 + 4] = -qx;
      R[(k * 3) * 6 + 5] = -qy; R[(k * 3 + 1) * 6 + 5] = qx;
    }
    const MR = new Float64Array(nc * 3 * 6);
    for (let r = 0; r < nc * 3; r++) { const mi = nodes[idx[(r / 3) | 0]].m; for (let c = 0; c < 6; c++) MR[r * 6 + c] = mi * R[r * 6 + c]; }
    const G = new Float64Array(36);
    for (let a = 0; a < 6; a++) for (let c = 0; c < 6; c++) { let s = 0; for (let r = 0; r < nc * 3; r++) s += R[r * 6 + a] * MR[r * 6 + c]; G[a * 6 + c] = s; }
    const Gi = genCertInv(G, 6);
    // H = MR Gi
    const H = new Float64Array(nc * 3 * 6);
    for (let r = 0; r < nc * 3; r++) for (let c = 0; c < 6; c++) { let s = 0; for (let a = 0; a < 6; a++) s += MR[r * 6 + a] * Gi[a * 6 + c]; H[r * 6 + c] = s; }
    const m3 = nc * 3, Kc = new Float64Array(m3 * m3), ix = new Int32Array(m3);
    for (let r = 0; r < m3; r++) ix[r] = idx[(r / 3) | 0] * 3 + (r % 3);
    for (let r = 0; r < m3; r++) for (let c = 0; c < m3; c++) {
      let s = 0; for (let a = 0; a < 6; a++) s += H[r * 6 + a] * MR[c * 6 + a];
      Kc[r * m3 + c] = w2 * ((r === c ? nodes[idx[(r / 3) | 0]].m : 0) - s);
    }
    lin.push({ idx: ix, Kc });
    for (let r = 0; r < m3; r++) { const dr = dof[ix[r]]; if (dr < 0) continue;
      for (let c = 0; c < m3; c++) { const dc = dof[ix[c]]; if (dc < 0) continue; K[dr * N + dc] += Kc[r * m3 + c]; } }
  }
  // the regularisation: eps M, eps far under the lattice's own stiffest-to-lightest ratio
  let kmax = 0;
  for (let i = 0; i < n; i++) for (let j = 0; j < 3; j++) { const d = dof[i * 3 + j]; if (d >= 0) kmax = Math.max(kmax, K[d * N + d] / nodes[i].m); }
  const eps = 1e-9 * kmax;
  for (let i = 0; i < n; i++) for (let j = 0; j < 3; j++) { const d = dof[i * 3 + j]; if (d >= 0) K[d * N + d] += eps * nodes[i].m; }
  if (!genCertChol(K, N)) return null;
  return { N, dof, K, Lb, kOf, def, X, lin, eps, free: !!opt.free };
}
function genCertInv(A, n) {
  const M = Float64Array.from(A), I = new Float64Array(n * n);
  for (let i = 0; i < n; i++) I[i * n + i] = 1;
  for (let c = 0; c < n; c++) {
    let p = c; for (let r = c + 1; r < n; r++) if (Math.abs(M[r * n + c]) > Math.abs(M[p * n + c])) p = r;
    if (p !== c) for (let k = 0; k < n; k++) { let t = M[c * n + k]; M[c * n + k] = M[p * n + k]; M[p * n + k] = t; t = I[c * n + k]; I[c * n + k] = I[p * n + k]; I[p * n + k] = t; }
    const d = M[c * n + c] || 1e-30;
    for (let k = 0; k < n; k++) { M[c * n + k] /= d; I[c * n + k] /= d; }
    for (let r = 0; r < n; r++) if (r !== c) { const f = M[r * n + c]; if (f) for (let k = 0; k < n; k++) { M[r * n + k] -= f * M[c * n + k]; I[r * n + k] -= f * I[c * n + k]; } }
  }
  return I;
}
// in-place Cholesky (the lower triangle holds L); false if not positive definite
function genCertChol(A, N) {
  for (let j = 0; j < N; j++) {
    const rj = j * N;
    let d = A[rj + j];
    for (let k = 0; k < j; k++) d -= A[rj + k] * A[rj + k];
    if (!(d > 0)) return false;
    d = Math.sqrt(d); A[rj + j] = d;
    const inv = 1 / d;
    for (let i = j + 1; i < N; i++) {
      const ri = i * N;
      let s = A[ri + j];
      for (let k = 0; k < j; k++) s -= A[ri + k] * A[rj + k];
      A[ri + j] = s * inv;
    }
  }
  return true;
}
function genCertBack(S, f) {
  const N = S.N, A = S.K, y = new Float64Array(N);
  for (let i = 0; i < N; i++) { let s = f[i]; const ri = i * N; for (let k = 0; k < i; k++) s -= A[ri + k] * y[k]; y[i] = s / A[ri + i]; }
  for (let i = N - 1; i >= 0; i--) { let s = y[i]; for (let k = i + 1; k < N; k++) s -= A[k * N + i] * y[k]; y[i] = s / A[i * N + i]; }
  return y;
}
// the members' forces for nodal loads F (n * 3, the frame the system was built in): the EQUILIBRIUM of the lattice's
// own force law, not the linear answer - the true box's members are so stiff (1.7e7 N/m on the metal Cessna's wing)
// that a 7 cm bend's second-order stretch reads 30 kN in a linear field, and the load's P-delta moves a root member
// by 3-4 %. Modified Newton on the one factorisation: u += K0^-1 r(u), r the loads plus every member's
// k (|x_b - x_a| - L0) along its CURRENT direction (a wire slack carries nothing: 30_solver's law), the clusters' pull
// toward their rigid fit (linear: they barely turn) and the regularisation; to a micrometre or 40 rounds
function genCertForces(sysOf, F) {
  const S = sysOf(null); if (!S) return null;
  const def = S.def, n = F.length / 3, dof = S.dof, B = def.beams, P = S.X, N = S.N;
  const u = new Float64Array(n * 3), x = new Float64Array(n * 3), r = new Float64Array(N);
  const out = new Float64Array(B.length), E = new Float64Array(B.length * 4);
  const resid = () => {
    for (let i = 0; i < n * 3; i++) x[i] = P[i] + u[i];
    r.fill(0);
    for (let i = 0; i < n * 3; i++) if (dof[i] >= 0) r[dof[i]] = F[i];
    for (let bi = 0; bi < B.length; bi++) {
      const b = B[bi], k = S.kOf(b);
      if (!(k > 0)) { out[bi] = 0; continue; }
      const a3 = b.a * 3, b3 = b.b * 3;
      let ex = x[b3] - x[a3], ey = x[b3 + 1] - x[a3 + 1], ez = x[b3 + 2] - x[a3 + 2];
      const L = Math.hypot(ex, ey, ez) || 1e-9; ex /= L; ey /= L; ez /= L;
      let Fb = k * (L - S.Lb[bi] * (1 - (b.pre || 0)));
      if (b.tens && Fb < 0) Fb = 0;
      out[bi] = Fb; E[bi * 4] = ex; E[bi * 4 + 1] = ey; E[bi * 4 + 2] = ez; E[bi * 4 + 3] = L;
      const da = dof[a3], db = dof[b3];
      if (da >= 0) { r[da] += Fb * ex; r[da + 1] += Fb * ey; r[da + 2] += Fb * ez; }
      if (db >= 0) { r[db] -= Fb * ex; r[db + 1] -= Fb * ey; r[db + 2] -= Fb * ez; }
    }
    for (const T of S.lin) {
      const { idx, Kc } = T, m3 = idx.length;
      for (let p = 0; p < m3; p++) { const dp = dof[idx[p]]; if (dp < 0) continue; let s = 0; for (let q = 0; q < m3; q++) s += Kc[p * m3 + q] * u[idx[q]]; r[dp] -= s; }
    }
    for (let i = 0; i < n * 3; i++) if (dof[i] >= 0) r[dof[i]] -= S.eps * def.nodes[(i / 3) | 0].m * u[i];
    // THE FREE BODY (the flight cases): the loads are fixed in direction while the frame bends under them, so the
    // bent geometry leaves a small net force and moment; the body's own acceleration takes it (the inertia relief of
    // genCertRelieve, on the residual, about the current CG), so nothing turns the solve into a rigid drift
    if (S.free) {
      let M = 0, cx = 0, cy = 0, cz = 0;
      for (let i = 0; i < n; i++) { const m = def.nodes[i].m; M += m; cx += m * x[i * 3]; cy += m * x[i * 3 + 1]; cz += m * x[i * 3 + 2]; }
      cx /= M; cy /= M; cz /= M;
      let Fx = 0, Fy = 0, Fz = 0, Mx = 0, My = 0, Mz = 0;
      const I = [0, 0, 0, 0, 0, 0, 0, 0, 0];
      for (let i = 0; i < n; i++) {
        const m = def.nodes[i].m, rx = x[i * 3] - cx, ry = x[i * 3 + 1] - cy, rz = x[i * 3 + 2] - cz;
        const fx = r[dof[i * 3]], fy = r[dof[i * 3 + 1]], fz = r[dof[i * 3 + 2]];
        Fx += fx; Fy += fy; Fz += fz; Mx += ry * fz - rz * fy; My += rz * fx - rx * fz; Mz += rx * fy - ry * fx;
        const r2 = rx * rx + ry * ry + rz * rz;
        I[0] += m * (r2 - rx * rx); I[4] += m * (r2 - ry * ry); I[8] += m * (r2 - rz * rz); I[1] -= m * rx * ry; I[2] -= m * rx * rz; I[5] -= m * ry * rz;
      }
      I[3] = I[1]; I[6] = I[2]; I[7] = I[5];
      const Ii = genCertInv(I, 3), ax = Fx / M, ay = Fy / M, az = Fz / M;
      const al = [Ii[0] * Mx + Ii[1] * My + Ii[2] * Mz, Ii[3] * Mx + Ii[4] * My + Ii[5] * Mz, Ii[6] * Mx + Ii[7] * My + Ii[8] * Mz];
      for (let i = 0; i < n; i++) {
        const m = def.nodes[i].m, rx = x[i * 3] - cx, ry = x[i * 3 + 1] - cy, rz = x[i * 3 + 2] - cz;
        r[dof[i * 3]] -= m * (ax + al[1] * rz - al[2] * ry);
        r[dof[i * 3 + 1]] -= m * (ay + al[2] * rx - al[0] * rz);
        r[dof[i * 3 + 2]] -= m * (az + al[0] * ry - al[1] * rx);
      }
    }
  };
  // the tangent at u: each member's k e e^T + (F / L)(I - e e^T) along its current line (a slack wire: nothing)
  const tangent = () => {
    const K = new Float64Array(N * N), blk = new Float64Array(9);
    for (let bi = 0; bi < B.length; bi++) {
      const b = B[bi], k = S.kOf(b);
      if (!(k > 0)) continue;
      if (b.tens && out[bi] <= 0) continue;
      const e = [E[bi * 4], E[bi * 4 + 1], E[bi * 4 + 2]], g = out[bi] / E[bi * 4 + 3];
      for (let q = 0; q < 3; q++) for (let c = 0; c < 3; c++) blk[q * 3 + c] = k * e[q] * e[c] + g * ((q === c ? 1 : 0) - e[q] * e[c]);
      for (const [ia, ib, sg] of [[b.a, b.a, 1], [b.b, b.b, 1], [b.a, b.b, -1], [b.b, b.a, -1]])
        for (let q = 0; q < 3; q++) { const dr = dof[ia * 3 + q]; if (dr < 0) continue;
          for (let c = 0; c < 3; c++) { const dc = dof[ib * 3 + c]; if (dc >= 0) K[dr * N + dc] += sg * blk[q * 3 + c]; } }
    }
    for (const T of S.lin) { const { idx, Kc } = T, m3 = idx.length;
      for (let p = 0; p < m3; p++) { const dr = dof[idx[p]]; if (dr < 0) continue; for (let q = 0; q < m3; q++) { const dc = dof[idx[q]]; if (dc >= 0) K[dr * N + dc] += Kc[p * m3 + q]; } } }
    // a slack wire can leave a mode with no stiffness of its own (a wire-braced stab at negative g): the shift grows
    // until the tangent factors (Levenberg-Marquardt's damping; the residual, not the tangent, is the answer)
    const K0 = K.slice();
    for (let sh = S.eps; sh < 1e12 * (S.eps + 1); sh *= 100) {
      for (let i = 0; i < n * 3; i++) if (dof[i] >= 0) K[dof[i] * N + dof[i]] += sh * def.nodes[(i / 3) | 0].m;
      if (genCertChol(K, N)) return { N, K };
      K.set(K0);
    }
    return null;
  };
  // Newton: the first step on the system's own factorisation (the linear answer), then the tangent's, to a micrometre
  let it = 0, du = Infinity, T = S;
  for (; it < 60 && du > 1e-6; it++) {
    resid();
    if (it === 1 || (it > 1 && it % 6 === 0)) T = tangent() || T;   // the tangent once, refreshed every 6 rounds
    const y = genCertBack(T, r);
    // a step capped at 2 cm a node (the frame's own deflections are centimetres; a larger step is the slack modes'
    // linear guess, never the answer)
    let ym = 0; for (let i = 0; i < N; i++) if (Math.abs(y[i]) > ym) ym = Math.abs(y[i]);
    if (it > 0 && ym > 0.02) { const q = 0.02 / ym; for (let i = 0; i < N; i++) y[i] *= q; }
    du = 0;
    for (let i = 0; i < n * 3; i++) if (dof[i] >= 0) { const d = y[dof[i]]; u[i] += d; if (Math.abs(d) > du) du = Math.abs(d); }
  }
  resid();
  out.U = i => u[i]; out.iters = it; out.conv = du;
  return out;
}

// ---- the loads ---------------------------------------------------------------------------------------------------
// the wing's lift (or the stab's) as unit node weights: each strip its area's share, then its own node weights
function genCertDist(def, kinds, sideF) {
  const w = new Float64Array(def.nodes.length);
  let A = 0;
  const S = def.strips.filter(s => kinds.indexOf(s.kind) >= 0);
  for (const s of S) A += s.area;
  if (!(A > 0)) return null;
  for (const s of S) {
    let z = 0, ws = 0; for (const q of s.w) { z += def.nodes[q[0]].p[2] * q[1]; ws += q[1]; }
    const f = sideF ? sideF(z / (ws || 1), s) : 1;
    for (const q of s.w) w[q[0]] += f * (s.area / A) * q[1];
  }
  return w;
}
function genCertMass(def) {
  let M = 0, cx = 0, cy = 0, cz = 0;
  for (const nd of def.nodes) { M += nd.m; cx += nd.m * nd.p[0]; cy += nd.m * nd.p[1]; cz += nd.m * nd.p[2]; }
  return { M, c: [cx / M, cy / M, cz / M] };
}
// whatever the applied loads leave unbalanced is the rigid body's acceleration: -m (a + alpha x r) on every node
function genCertRelieve(def, F) {
  const n = def.nodes.length, { M, c } = genCertMass(def);
  let Fx = 0, Fy = 0, Fz = 0, Mx = 0, My = 0, Mz = 0;
  const I = [0, 0, 0, 0, 0, 0, 0, 0, 0];
  for (let i = 0; i < n; i++) {
    const p = def.nodes[i].p, m = def.nodes[i].m, rx = p[0] - c[0], ry = p[1] - c[1], rz = p[2] - c[2];
    const fx = F[i * 3], fy = F[i * 3 + 1], fz = F[i * 3 + 2];
    Fx += fx; Fy += fy; Fz += fz;
    Mx += ry * fz - rz * fy; My += rz * fx - rx * fz; Mz += rx * fy - ry * fx;
    const r2 = rx * rx + ry * ry + rz * rz;
    I[0] += m * (r2 - rx * rx); I[4] += m * (r2 - ry * ry); I[8] += m * (r2 - rz * rz);
    I[1] -= m * rx * ry; I[2] -= m * rx * rz; I[5] -= m * ry * rz;
  }
  I[3] = I[1]; I[6] = I[2]; I[7] = I[5];
  const Ii = genCertInv(I, 3);
  const ax = Fx / M, ay = Fy / M, az = Fz / M;
  const al = [Ii[0] * Mx + Ii[1] * My + Ii[2] * Mz, Ii[3] * Mx + Ii[4] * My + Ii[5] * Mz, Ii[6] * Mx + Ii[7] * My + Ii[8] * Mz];
  for (let i = 0; i < n; i++) {
    const p = def.nodes[i].p, m = def.nodes[i].m, rx = p[0] - c[0], ry = p[1] - c[1], rz = p[2] - c[2];
    F[i * 3]     -= m * (ax + al[1] * rz - al[2] * ry);
    F[i * 3 + 1] -= m * (ay + al[2] * rx - al[0] * rz);
    F[i * 3 + 2] -= m * (az + al[0] * ry - al[1] * rx);
  }
  return F;
}
// THE FLIGHT CASES ON THE SOLVER'S OWN AIR (G1830): the aeroplane at its level pose, a uniform airflow at angle of
// attack alpha (sim.probe: the strip pass with the circulation iterated, the node forces left in sim.f - the span
// and chord distribution the aeroplane flies with, the aerofoil's own pitching moment twisting the box, the
// controls' loads on their strips), the propeller's thrust at full throttle and its wash (the probe's `live` pass),
// the weight on every node, the rest the rigid body's acceleration. `o`:
// { V, nz (the load factor the aero force normal to the path is solved for: alpha by secant), trim (the elevator
// solved for no pitching moment about the CG), de / da / dr (a control held: full = +-1), thr }
function genCertProbeSim(def) {
  const sim = makeSim(Object.assign({}, def, { cert: null, params: Object.assign({}, def.params, { damage: false }) }), null);
  sim.reset(0);
  for (let i = 0; i < sim.n; i++) for (let j = 0; j < 3; j++) sim.p[i * 3 + j] = def.nodes[i].p[j];
  return sim;
}
function genCertAeroLoads(def, sim, o) {
  const n = def.nodes.length, { M, c } = genCertMass(def), W = M * 9.81, V = o.V;
  const vel = a => [-V * Math.cos(a), -V * Math.sin(a), 0];
  const thr = o.thr == null ? 1 : o.thr;
  sim.ctl.de = o.de || 0; sim.ctl.da = o.da || 0; sim.ctl.dr = o.dr || 0; sim.ctl.flap = 0; sim.ctl.thr = thr;
  const pr = a => sim.probe(vel(a), true);
  const Fn = (a) => { const r = pr(a); return -r.Fx * Math.sin(a) + r.Fy * Math.cos(a); };
  // alpha for the load factor at this elevator (secant; the polar is smooth below the stall)
  const solveA = (target) => {
    let a0 = 0, a1 = 0.05, f0 = Fn(a0) - target, f1 = Fn(a1) - target;
    for (let k = 0; k < 12 && Math.abs(f1) > 1e-4 * W; k++) {
      const a2 = a1 - f1 * (a1 - a0) / ((f1 - f0) || 1e-9);
      a0 = a1; f0 = f1; a1 = Math.max(-0.35, Math.min(0.35, a2)); f1 = Fn(a1) - target;
    }
    return a1;
  };
  let a = 0;
  if (o.trim) {
    const pm = de => { sim.ctl.de = de; a = solveA(o.nz * W); return pr(a).pitchUp; };
    let d0 = 0, d1 = o.nz > 0 ? -0.2 : 0.2, m0 = pm(d0), m1 = pm(d1);
    for (let k = 0; k < 10 && Math.abs(m1) > 1; k++) {
      const d2 = d1 - m1 * (d1 - d0) / ((m1 - m0) || 1e-9);
      d0 = d1; m0 = m1; d1 = Math.max(-1, Math.min(1, d2)); m1 = pm(d1);
    }
    sim.ctl.de = d1; a = solveA(o.nz * W);
  } else a = o.alpha != null ? o.alpha : solveA(o.nz * W);
  pr(a);
  const F = Float64Array.from(sim.f);
  const de = sim.ctl.de;
  sim.ctl.de = 0; sim.ctl.da = 0; sim.ctl.dr = 0; sim.ctl.thr = 0;
  for (let i = 0; i < n; i++) F[i * 3 + 1] -= def.nodes[i].m * 9.81;
  return { F: genCertRelieve(def, F), alpha: a, de };
}
// the design speeds (23.335): V_A = Vs sqrt(n) (the stall at the limit), V_C at least 33 sqrt(W/S) kt, V_D 1.4 x that
function genCertSpeeds(def) {
  const g = (def.params && def.params.gen) || {}, Vs = g.Vs || 25, L = GEN_CERT.limit;
  const WSpsf = g.W && g.Sw ? (g.W / 4.4482) / (g.Sw * 10.7639) : 10;
  const VC = Math.max(1.3 * Vs * Math.sqrt(L), 33 * Math.sqrt(WSpsf) * 0.5144);
  return { VA: Vs * Math.sqrt(L), VC, VD: 1.4 * VC };
}
// ---- the cases ---------------------------------------------------------------------------------------------------
function genCertSubs(def) { return (def.params && def.params.substeps) || 24; }
function genCertSubsTrue(def) { return (def.params && (def.params.substepsTrue || def.params.substeps)) || 24; }
// the bench (65_gen_loadtest's rig, static), in the rig's own pose: the aeroplane reset and turned over about its body
// x (the boom's axis, sim.axes()[0] - a few degrees off the def's x, so the bags press a little aft in the body's
// frame, as the rig's do) through its CG; the wing's nodes free, everything else on the trestles; the bags (the rig's
// own: the weight over the wing strips by area, through their node weights) pressing world-down, the wing's own
// weight with them, a wing-carried node's n m g against them; the true box
function genCertBenchPose(def) {
  const sim = makeSim(Object.assign({}, def, { cert: null, params: Object.assign({}, def.params, { damage: false }) }), null);
  sim.reset(0);
  const a = sim.axes()[0], n = sim.n, P = Float64Array.from(sim.p);
  let cx = 0, cy = 0, cz = 0, M = 0;
  for (let i = 0; i < n; i++) { const m = def.nodes[i].m; M += m; cx += m * P[i * 3]; cy += m * P[i * 3 + 1]; cz += m * P[i * 3 + 2]; }
  cx /= M; cy /= M; cz /= M;
  for (let i = 0; i < n; i++) {
    const o = i * 3, dx = P[o] - cx, dy = P[o + 1] - cy, dz = P[o + 2] - cz, k = 2 * (a[0] * dx + a[1] * dy + a[2] * dz);
    P[o] = cx + k * a[0] - dx; P[o + 1] = cy + k * a[1] - dy; P[o + 2] = cz + k * a[2] - dz;
  }
  return P;
}
function genCertBench(def, nz) {
  const n = def.nodes.length, wingTag = {};
  for (const t of GEN_LOAD_WINGTAGS) wingTag[t] = 1;
  const carried = genLoadCarried(def, GEN_LOAD_WINGTAGS), car = new Uint8Array(n);
  for (const i of carried) car[i] = 1;
  const pinned = new Uint8Array(n);
  def.nodes.forEach((nd, i) => { if (!wingTag[nd.tag] && !car[i]) pinned[i] = 1; });
  const { M } = genCertMass(def), W = M * 9.81, wl = genCertDist(def, ['wing'], null);
  const F = new Float64Array(n * 3);
  if (!wl) return null;
  // THE RIG'S BAGS ARE IMPULSES (65_gen_loadtest stepClamped: a velocity n F h / m on each bag node at every
  // substep's start), so the dampers between a bagged node and its neighbours feel that velocity in the very substep
  // and carry a share of the bag across (c e . (v_b - v_a)): the rig's settled answer includes it - 1-4 % of a root
  // member's force, measured - and a certificate that left it out would let a bench run to limit set by that much.
  // The impulsive part (the bags, a carried node's relief; not the weight, a force) is passed on through the
  // dampers' matrix: F_eff = F + C h M^-1 F_imp, h the true box's substep. (The pinned nodes' bags count too: the
  // trestle clamps them only after the substep.)
  const pos = genCertBenchPose(def), I = new Float64Array(n * 3);
  for (let i = 0; i < n; i++) {
    const m = def.nodes[i].m;
    I[i * 3 + 1] = -(nz * W * wl[i] - (car[i] ? nz * m * 9.81 : 0));
    F[i * 3 + 1] = I[i * 3 + 1] - m * 9.81;
  }
  const h = 1 / (60 * genCertSubsTrue(def));
  for (const b of def.beams) {
    const c = b.cTrue != null ? b.cTrue : b.c;
    if (!(c > 0)) continue;
    let ex = pos[b.b * 3] - pos[b.a * 3], ey = pos[b.b * 3 + 1] - pos[b.a * 3 + 1], ez = pos[b.b * 3 + 2] - pos[b.a * 3 + 2];
    const L = Math.hypot(ex, ey, ez) || 1e-9; ex /= L; ey /= L; ez /= L;
    const ma = def.nodes[b.a].m, mb = def.nodes[b.b].m;
    const dv = ((I[b.b * 3] / mb - I[b.a * 3] / ma) * ex + (I[b.b * 3 + 1] / mb - I[b.a * 3 + 1] / ma) * ey + (I[b.b * 3 + 2] / mb - I[b.a * 3 + 2] / ma) * ez) * h;
    if (b.tens) { /* a wire's damper only while taut: the tail's wires sit on the trestles */ }
    const D = c * dv;
    F[b.a * 3] += D * ex; F[b.a * 3 + 1] += D * ey; F[b.a * 3 + 2] += D * ez;
    F[b.b * 3] -= D * ex; F[b.b * 3 + 1] -= D * ey; F[b.b * 3 + 2] -= D * ez;
  }
  return { F, pinned, pos };
}
// THE DROP (23.473): the real sim under the probe (every member's peak force, per substep): settled on its wheels
// 4 s (a floatplane on the analytic world's sea lane), lifted 2 cm and dropped at the sink rate, no lift, 2 s - the
// procedure GATE TREECRASH's own drop flies (so the airframe starts the impact carrying its 1 g, as a real one does)
function genCertDrop(def, sink, world) {
  const d2 = Object.assign({}, def, { cert: null, params: Object.assign({}, def.params, { damage: true, damageProbe: true }) });
  const floats = !!(def.parts && def.parts.floats), sea = floats && world && world.aerodromes ? world.aerodromes.find(a => a.id === 'SEA') : null;
  const sim = makeSim(d2, sea ? world : null);
  sim.reset(0);
  if (sea) placeAtAerodrome(sim, sea);
  if (sim.setEngine && sim.eng) for (let i = 0; i < sim.eng.length; i++) sim.setEngine(i, { key: 'off' });
  for (let f = 0; f < 240; f++) sim.step(1 / 60);
  const n = sim.n, P = sim.damagePeak();
  for (let i = 0; i < n; i++) { sim.p[i * 3 + 1] += 0.02; sim.v[i * 3] = 0; sim.v[i * 3 + 1] = -sink; sim.v[i * 3 + 2] = 0; }
  P.t.fill(0); P.c.fill(0);
  let nzMax = 0;
  for (let f = 0; f < 120; f++) { sim.step(1 / 60); nzMax = Math.max(nzMax, sim.out.nz || 0); }
  const nb = def.beams.length, t = new Float64Array(nb), c = new Float64Array(nb);
  for (let bi = 0; bi < nb; bi++) {
    const b = sim.beams[bi];
    t[bi] = Number.isFinite(b.fyP) ? P.t[bi] * b.fyP : 0;
    c[bi] = Number.isFinite(b.fcP) ? P.c[bi] * b.fcP : 0;
  }
  return { t, c, nz: nzMax };
}
// THE BOW LANDING (a floatplane, 23.527-23.529's bow condition; GATE TREECRASH's own float nose-in, A0's WATER CASE):
// 90 km/h along its heading, 5 m/s down, pitched 20 deg nose-down about its CG, power off, 0.3 m over the sea lane;
// the real sim under the probe for 1.2 s (the peak is in its first second)
function genCertBow(def, world) {
  if (!world || !world.aerodromes) return null;
  const sea = world.aerodromes.find(a => a.id === 'SEA'); if (!sea) return null;
  const d2 = Object.assign({}, def, { cert: null, params: Object.assign({}, def.params, { damage: true, damageProbe: true }) });
  const sim = makeSim(d2, world); sim.reset(0); placeAtAerodrome(sim, sea);
  const n = sim.n, p = sim.p, v = sim.v, ax = sim.axes(), xA = ax[0], k = ax[2], c0 = sim.cgPos();
  const th = -20 * Math.PI / 180, cs = Math.cos(th), sn = Math.sin(th);
  for (let i = 0; i < n; i++) {
    const d = [p[i*3] - c0[0], p[i*3+1] - c0[1], p[i*3+2] - c0[2]], kd = k[0]*d[0] + k[1]*d[1] + k[2]*d[2];
    const cr = [k[1]*d[2] - k[2]*d[1], k[2]*d[0] - k[0]*d[2], k[0]*d[1] - k[1]*d[0]];
    for (let j = 0; j < 3; j++) p[i*3+j] = c0[j] + d[j] * cs + cr[j] * sn + k[j] * kd * (1 - cs);
  }
  const wh = world.waterH ? world.waterH(c0[0], c0[2]) : 0;
  let yMin = Infinity; for (let i = 0; i < n; i++) yMin = Math.min(yMin, p[i*3+1] - def.nodes[i].r);
  const hl = Math.hypot(xA[0], xA[2]) || 1, V = 90 / 3.6;
  for (let i = 0; i < n; i++) { p[i*3+1] += wh + 0.3 - yMin; v[i*3] = -V * xA[0] / hl; v[i*3+1] = -5; v[i*3+2] = -V * xA[2] / hl; }
  sim.ctl.thr = 0;
  for (let f = 0; f < 72; f++) sim.step(1 / 60);
  const P = sim.damagePeak(), nb = def.beams.length, t = new Float64Array(nb), c = new Float64Array(nb);
  for (let bi = 0; bi < nb; bi++) { const b = sim.beams[bi];
    t[bi] = Number.isFinite(b.fyP) ? P.t[bi] * b.fyP : 0; c[bi] = Number.isFinite(b.fcP) ? P.c[bi] * b.fcP : 0; }
  return { t, c };
}
// THE FLIGHT TEST (23.307: a structure may be shown by test): the aeroplane flown through a pull to its limit, the real
// sim (the flight box, the air, the propeller at full throttle and its wash, the airframe's own dynamics), every
// member's peak read up to the step its applied load factor first reaches the limit: what a pull does to a flown
// frame that a static case cannot (the onset's dynamics, the elevator still going as the limit arrives, the wash).
// TREE-CRASH's own pull: level at 1.33 x the speed the limit stalls at (2.6 Vs), the elevator on a PI to the load
// factor ramped over a second
function genCertFlown(def) {
  const d2 = Object.assign({}, def, { cert: null, params: Object.assign({}, def.params, { damage: true, damageProbe: true }) });
  const sim = makeSim(d2, null); sim.reset(0);
  if (sim.setAtmos) sim.setAtmos(null, 400);   // 400 m up, in its air (a sim with no world flies the declared height's)
  const g = (def.params && def.params.gen) || {}, V = 2.6 * (g.Vs || 25), L = GEN_CERT.limit;
  for (let i = 0; i < sim.n; i++) { sim.p[i * 3 + 1] += 400; sim.v[i * 3] = -V; sim.v[i * 3 + 1] = 0; sim.v[i * 3 + 2] = 0; }
  sim.ctl.thr = 1;
  for (let f = 0; f < 60; f++) sim.step(1 / 60);
  const P = sim.damagePeak(); P.t.fill(0); P.c.fill(0);
  // THE LOAD FACTOR IS THE AIR'S: the aero force over the weight (out.aeroFy), not the CG's acceleration (out.nz),
  // which lags the wing's load through the frame's own springs in a quick pull - measured on the metal Cessna, the
  // wing carrying 5.7 W when the CG read 3.8 g. The pilot flies the CG's (the instrument), the case stops on the air's
  let I = 0, nzMax = 0, reached = false;
  const W = sim.totalM * 9.81;
  for (let f = 0; f < 60 * 6; f++) {
    const tgt = Math.min(L, 1 + (L - 1) * (f / 60));
    const e = tgt - sim.out.nz; I += e / 60;
    sim.ctl.de = Math.max(-1, Math.min(1, 0.4 * e + 0.8 * I));
    sim.step(1 / 60);
    const na = sim.out.aeroFy / W;
    nzMax = Math.max(nzMax, na);
    if (na >= L) { reached = true; break; }
  }
  const nb = def.beams.length, t = new Float64Array(nb), c = new Float64Array(nb);
  for (let bi = 0; bi < nb; bi++) { const b = sim.beams[bi];
    t[bi] = Number.isFinite(b.fyP) ? P.t[bi] * b.fyP : 0; c[bi] = Number.isFinite(b.fcP) ? P.c[bi] * b.fcP : 0; }
  return { t, c, nz: nzMax, reached };
}
// FAR 23.473(d): the limit descent velocity, m/s
function genCertSink(def) {
  const g = def.params && def.params.gen;
  if (!g || !(g.W > 0) || !(g.Sw > 0)) return 3.05;
  const WS = (g.W / 4.4482) / (g.Sw * 10.7639);
  return Math.min(10, Math.max(7, 4.4 * Math.pow(WS, 0.25))) * 0.3048;
}

// genCertify(def, opt) -> the certificate: per member the tension and compression envelopes at limit (N), and per
// case its own (the evidence and the gate read them). `opt.world`: the world a floatplane's drop lands on.
function genCertify(def, opt) {
  opt = opt || {};
  const t0 = (typeof performance !== 'undefined' ? performance : Date).now();
  const nb = def.beams.length, nN = def.nodes.length;
  const kF = b => b.k, kT = b => (b.kTrue != null ? b.kTrue : b.k);
  const sysCache = {};
  const sysOf = (key, o) => () => sysCache[key] || (sysCache[key] = genCertSystem(def, o));
  const flight = sysOf('flight', { kOf: kF, sub: genCertSubs(def), free: true });
  const cases = {};
  const put = (name, Fb) => { if (!Fb) return; const t = new Float64Array(nb), c = new Float64Array(nb);
    for (let bi = 0; bi < nb; bi++) { if (Fb[bi] > 0) t[bi] = Fb[bi]; else c[bi] = -Fb[bi]; } cases[name] = { t, c }; };
  const L = GEN_CERT.limit;
  // the V-n corners and the controls (23.333, 23.337, 23.349, 23.423, 23.441), on the solver's own air
  const VS = genCertSpeeds(def), PS = genCertProbeSim(def), aero = {};
  // (a corner the probe's polar cannot reach - alpha at its 20 deg clamp - is flown 8 % faster until it can: the
  // stall speed of the shakedown and the probe's own CLmax are not the same number on every build)
  const A = (nm, o) => {
    let r = genCertAeroLoads(def, PS, o), V = o.V;
    for (let k = 0; k < 8 && o.nz != null && o.alpha == null && Math.abs(r.alpha) > 0.34; k++) { V *= 1.08; r = genCertAeroLoads(def, PS, Object.assign({}, o, { V })); }
    aero[nm] = { alpha: r.alpha, de: r.de, V, nz: o.nz, dyn: o.dyn || 1 };
    if (o.dyn) for (let i = 0; i < r.F.length; i++) r.F[i] *= o.dyn;
    put(nm, genCertForces(flight, r.F));
    return r;
  };
  A('pullA', { V: VS.VA, nz: L, trim: true });                         // A: the stall at the limit
  A('pullD', { V: VS.VD, nz: L, trim: true });                         // D: the limit at the dive speed
  A('negC', { V: VS.VC, nz: -GEN_CERT.neg * L, trim: true, thr: 0 });  // the negative limit at V_C
  // the corners WITH the checked manoeuvre's pitching acceleration on top (23.423(b): nose up 39 n (n - 1.5) / V,
  // rad/s2, V in knots - written from the regulation's text as recalled, A0 to open it): a flown pull reaches the limit
  // with the elevator still going (the flown census: the fuselage's bottom member at the strut 1.4 x the trimmed
  // corner at 3.8 g, the elevator full at 3.3 g), so the limit load and the pitch acceleration arrive together
  {
    let Iz = 0; const { c } = genCertMass(def);
    for (const nd of def.nodes) { const dx = nd.p[0] - c[0], dy = nd.p[1] - c[1]; Iz += nd.m * (dx * dx + dy * dy); }
    for (const [nm, base] of [['pullAq', 'pullA'], ['pullDq', 'pullD']]) {
      const V = aero[base].V, a0 = aero[base].alpha, vel = [-V * Math.cos(a0), -V * Math.sin(a0), 0];
      const Mreq = Iz * 39 * L * (L - 1.5) / (V / 0.5144);
      const pm = de => { PS.ctl.de = de; PS.ctl.thr = 1; return PS.probe(vel, true).pitchUp - Mreq; };
      let d0 = aero[base].de, d1 = Math.min(1, d0 + 0.2), m0 = pm(d0), m1 = pm(d1);
      for (let k = 0; k < 10 && Math.abs(m1) > 1; k++) { const d2 = d1 - m1 * (d1 - d0) / ((m1 - m0) || 1e-9); d0 = d1; m0 = m1; d1 = Math.max(-1, Math.min(1, d2)); m1 = pm(d1); }
      PS.ctl.de = 0; PS.ctl.thr = 0;
      A(nm, { V, alpha: a0, de: d1 });
    }
  }
  A('rollR', { V: VS.VA, nz: GEN_CERT.roll * L, trim: true, da: 1 });  // 2/3 of the limit, the aileron full
  A('rollL', { V: VS.VA, nz: GEN_CERT.roll * L, trim: true, da: -1 });
  // THE CONTROLS HARD OVER (beyond 23.423 / 23.441's checked and maneuvering cases, on purpose): from level 1 g, the
  // elevator at the dive speed and the rudder at V_A each full either way, the alpha held (the onset, before the
  // aeroplane answers). A game's stick is abrupt: a flown pull with a twitchy elevator loaded the stab 2-3.6 x the
  // checked manoeuvre at under 4 g (the census, HANDOVER G1830). So the tail, the control surfaces and whatever carries
  // their loads into the airframe are certified for what the controls can ask inside the envelope. And SUDDENLY: a
  // stick snapped over is a step on an elastic tail, whose peak is twice the static answer (the dynamic factor of a
  // suddenly applied load) - GEN_CERT.dynCtl. (The rudder at V_A, 23.441's speed: hard over at V_D its yaw
  // acceleration loads the wing's struts through their mass past every g case - 36-51 kN on the Cessnas' struts
  // against 18-25 kN at the limit pull - and a wing certified for that never breaks at its card. The ailerons are
  // 23.349's rolling condition above, full at V_A with 2/3 of the limit, for the same reason.)
  {
    const tD = genCertAeroLoads(def, PS, { V: VS.VD, nz: 1, trim: true }), tA = genCertAeroLoads(def, PS, { V: VS.VA, nz: 1, trim: true });
    for (const [nm, k, d, t1, V] of [['elevUpD', 'de', 1, tD, VS.VD], ['elevDownD', 'de', -1, tD, VS.VD], ['rudRA', 'dr', 1, tA, VS.VA], ['rudLA', 'dr', -1, tA, VS.VA]]) {
      const o = { V, alpha: t1.alpha, de: t1.de, dyn: GEN_CERT.dynCtl }; o[k] = d; A(nm, o);
    }
  }
  // THE EMERGENCY LANDING (23.561(b)): an item of mass that could injure an occupant is restrained under ultimate
  // inertia of 9 g forward, 3 g up, 1.5 g sideways (either way) and 6 g down - for the engine on its mount (the ENG /
  // CGE / MNT nodes, the mount's bearer members carrying it to an airframe held where it is). ULTIMATE loads: the
  // envelope takes them at limit (/ 1.5). It is the case that keeps a trunk at a taxi's pace a dent: TREE-CRASH's 9 g
  // (FAR 23.561's own forward ultimate) is where the crash begins. (The g as recalled from the regulation; A0 opens it.)
  {
    const n = def.nodes.length, item = new Uint8Array(n), pinned = new Uint8Array(n);
    let any = false;
    def.nodes.forEach((nd, i) => { if (/^(ENG|CGE|MNT)/.test(nd.tag || '')) { item[i] = 1; any = true; } else pinned[i] = 1; });
    if (any) {
      const sysE = sysOf('mount', { kOf: kF, sub: genCertSubs(def), pinned });
      for (const [nm, ax, gx] of [['crashFwd', 0, -9], ['crashUp', 1, 3], ['crashDown', 1, -6], ['crashSideR', 2, 1.5], ['crashSideL', 2, -1.5]]) {
        const F = new Float64Array(n * 3);
        for (let i = 0; i < n; i++) if (item[i]) F[i * 3 + ax] = def.nodes[i].m * 9.81 * gx / GEN_CERT.ult * GEN_CERT.limit;
        put(nm, genCertForces(sysE, F));
      }
      // ...AND THE AIRFRAME STOPPED AT ITS NOSE (23.561's 9 g forward on the whole aeroplane, a minor crash landing:
      // the cabin and what holds it must keep the occupants): every node's inertia 9 g forward, the reaction where a
      // trunk at a taxi's pace meets it - the propeller, through the engine's thrust nodes on the centreline (the
      // firewall ring when the engines are on the wings) - a point, not a clamp: the free airframe pitches about it
      // (inertia relief), so the mount carries the reaction's moment as the trunk loads it (its lower members in
      // compression: measured on the Cub's taxi, 3.8 kN where a clamped engine read them in tension)
      const eng = ((def.refs && def.refs.engine) || []).filter(i => Math.abs(def.nodes[i].p[2]) < 0.6);
      const R = eng.length ? eng : ((def.refs && def.refs.noseFrame) || []);
      if (R.length) {
        const F = new Float64Array(n * 3), k9 = -9 / GEN_CERT.ult * GEN_CERT.limit * 9.81;
        let Mt = 0; for (let i = 0; i < n; i++) { F[i * 3] = def.nodes[i].m * k9; Mt += def.nodes[i].m; }
        for (const i of R) F[i * 3] -= Mt * k9 / R.length;
        put('impactNose', genCertForces(flight, genCertRelieve(def, F)));
      }
    }
  }
  const tF = (typeof performance !== 'undefined' ? performance : Date).now();
  const bc = genCertBench(def, L);
  if (bc) put('bench', genCertForces(sysOf('bench', { kOf: kT, sub: genCertSubsTrue(def), pinned: bc.pinned, pos: bc.pos }), bc.F));
  const tB = (typeof performance !== 'undefined' ? performance : Date).now();
  const sink = GEN_CERT.dropCap ? 10 * 0.3048 : genCertSink(def);
  let drop = null;
  if (opt.drop !== false) { drop = genCertDrop(def, sink, opt.world); cases.drop = { t: drop.t, c: drop.c }; }
  if (opt.drop !== false && def.parts && def.parts.floats) { const bw = genCertBow(def, opt.world); if (bw) cases.bow = bw; }
  let flown = null;
  if (opt.drop !== false) { flown = genCertFlown(def); cases.flown = { t: flown.t, c: flown.c }; }
  const tD = (typeof performance !== 'undefined' ? performance : Date).now();
  const Ft = new Float64Array(nb), Fc = new Float64Array(nb), byT = new Int8Array(nb).fill(-1), byC = new Int8Array(nb).fill(-1);
  const names = Object.keys(cases);
  names.forEach((nm, ci) => { const C = cases[nm]; for (let bi = 0; bi < nb; bi++) {
    if (C.t[bi] > Ft[bi]) { Ft[bi] = C.t[bi]; byT[bi] = ci; } if (C.c[bi] > Fc[bi]) { Fc[bi] = C.c[bi]; byC[bi] = ci; } } });
  return { v: GEN_CERT_V, key: genCertKey(def), nb, nN, limit: L, ult: GEN_CERT.ult, neg: -GEN_CERT.neg * L, m: GEN_CERT.m,
           sink, dropNz: drop ? drop.nz : null, flownNz: flown ? flown.nz : null, flownReached: flown ? flown.reached : null,
           Ft, Fc, byT, byC, names, cases, speeds: VS, aero,
           ms: { flight: tF - t0, bench: tB - tF, drop: tD - tB, total: tD - t0 } };
}
// THE CACHE: one certificate per build (its spec hash), a few builds deep
const GEN_CERT_CACHE = new Map();
function genCertAttach(def, opt) {
  if (!def || !def.beams || !def.nodes) return null;
  if (def.cert && def.cert.nb === def.beams.length) return def.cert;
  const key = genCertKey(def);
  let C = GEN_CERT_CACHE.get(key);
  if (!C || C.nb !== def.beams.length) {
    C = genCertify(def, opt);
    GEN_CERT_CACHE.set(key, C);
    while (GEN_CERT_CACHE.size > 8) GEN_CERT_CACHE.delete(GEN_CERT_CACHE.keys().next().value);
  }
  def.cert = C;
  return C;
}
