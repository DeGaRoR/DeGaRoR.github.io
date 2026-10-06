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
// equilibrium (a few rounds a case). The dynamic cases are most of the cost: with DMG-D2b's gear cases 13-46 s a build
// in node, 8-24 s since G1891 (the settle shared, a wheel landing's window 1.2 s - the same envelope to the bit; GATE
// DMGCERTCOST). THE COST IS NEVER IN THE GARAGE'S EDIT LOOP: the page asks for the certificate when the aeroplane rolls
// out, on the bench's thread (bench_worker.js 'cert'), and stamps the live sim when it lands (app.js certKick); the
// bench's test to destruction takes it from there; the gates call genCertify / genCertAttach (cached by the spec's
// hash). G1891: the page keeps it across page loads (IndexedDB, bench_worker.js certStoreGet / certStorePut).
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
  flapN: 2.0,                // G1836 (DMG-D2b): 23.345's positive limit with the flaps extended (as recalled)
  ctlFlown: { hold: 0.3 },   // G1836: the controls flown at V_A - full one way, full the other, s each
  tailAsymMax: 0.8,          // G1836: 23.427(b)'s other side, 100 - 10 (n - 1) %, at most 80 %
  landK: 1.5,                // G1836: the airframe behind the gear at the gear's ultimate in the landing / ground / water cases
  rough: { A: 0.04, lam: 3, V: 8, secs: 12 },
  // G1891 (DMG-CERTCOST): A LANDING'S WINDOW, frames after the release (60 a second). On WHEELS the peaks that set the
  // envelope come in the first impact and its first rebound: the last frame that moved any member's envelope on the
  // three wheel builds was 14 / 13 / 42 of D2a's 120 (the Cub / the Jodel / the metal Cessna; tools/
  // dmg_certcost_evidence.js), so 1.2 s keeps every one of them, to the bit. On the WATER a float keeps porpoising and
  // the struts' peaks still move at 98-119 frames: the floats keep the 2 s
  win: { wheels: 72, water: 120 },
  weave: { V: 0.6, hold: 0.5 },   // G1836: a floatplane's run-out, the rudder hard over and back (s each way, 3 cycles) at 0.6 V_S0  // G1836: 23.491's roughest ground (a stated field: bumps of A m, lam m apart), at V m/s
  // G1835 (DMG-D2b): THE GEAR'S BRACKET (30_solver gearStamp; DEFORM §7.3): a wheel's gear gives in compression with no
  // set to its limit - where a steel section sized for the ultimate yields (yUlt: 1.5 x 4130's ty / tu = 1.18), then crushes at that load over its own TRAVEL (the share of a member's length it gives
  // before it kinks and its attach lets go), per archetype - a spring-steel leg is the energy absorber and spreads a
  // long way, an oleo bottoms and its strut bends, a bungee's lug or bracket hardly gives; the nose fork its own. In
  // tension every gear joint is its lug, brittle at the ultimate. floorW: every gear joint holds at least this share
  // of the aeroplane's weight at its limit (the cross wires and snap-blockers no case loads much: with no floor they
  // would be paper; at 0.25 W the metal Cessna's cross brace sits at 0.60 of its yield in a crosswind rollout)
  leg: { yTol: 1.01, yUlt: 1.5 * GEN_CRASH.tubeFabric.ty / GEN_CRASH.tubeFabric.tu, floorW: 0.25, bungee: { travel: 0.04 }, spring: { travel: 0.15 }, oleo: { travel: 0.10 }, nose: { travel: 0.06 } },
  // G1835 (DMG-D2b): THE GROUND AND WATER LOADS (genCertGroundLoads; FAR 23 as recalled, A0 to open them) and the gear's
  // own landings (genCertDrop's attitudes)
  gearDrop: { roll: 4, noseUp: 8, stepPitch: 0, xwind: 0.2 },   // the gear's landings: one wheel / float first (deg of
                             // roll), a tricycle's tail-down (deg nose-up), a float's step attitude, the drift (x V_S0)
  ground: { sideV: 1.33, sideIn: 0.5, sideOut: 0.33,        // 23.485
            brakeV: 1.33, brakeMu: 0.8,                     // 23.493
            nMin: 2.67,                                     // 23.473(g): the landing's limit inertia load factor at least
            twSide: 1,                                      // 23.497(b)
            noseK: 2.25, noseAft: 0.8, noseFwd: 0.4, noseSide: 0.7,   // 23.499
            C1: 0.012, nwMin: 0, lift: 2 / 3, oneFloat: 0.75 },      // 23.527 / 23.529 / 23.535
};
// the landing, ground and water cases (genCertify's names): the airframe takes them at GEN_CERT.landK
const GEN_CERT_LAND = /^(drop|bow|taxiRough|g[A-Z]|w[A-Z])/;
// the controls flown (genCertFlownCtl): a member's larger peak certifies it both ways
const GEN_CERT_RING = /^flown(Elev|Rud)/;
const GEN_CERT_V = 4;        // the certificate's own version (a cached answer is only valid for the rules that made it);
                             // 2: G1835-G1836 (DMG-D2b) - the gear's cases, the ground and water loads, the flaps;
                             // 3: G1891 (DMG-CERTCOST) - the settle shared, a wheel landing's window 1.2 s (the same envelope);
                             // 4: G1826 (DMG-DRIVE) - the engine's torque, side and gyroscopic loads on its mount (23.361 / .363 / .371)
                             //    (merged after CERTCOST, which had also taken 3: a stored certificate without the drive cases is stale)

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
  sim.ctl.de = o.de || 0; sim.ctl.da = o.da || 0; sim.ctl.dr = o.dr || 0; sim.ctl.flap = o.flap || 0; sim.ctl.thr = thr;
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
  sim.ctl.de = 0; sim.ctl.da = 0; sim.ctl.dr = 0; sim.ctl.thr = 0; sim.ctl.flap = 0;
  for (let i = 0; i < n; i++) F[i * 3 + 1] -= def.nodes[i].m * 9.81;
  const raw = Float64Array.from(F);
  return { F: genCertRelieve(def, F), alpha: a, de, raw };
}
// the design speeds (23.335): V_A = Vs sqrt(n) (the stall at the limit), V_C at least 33 sqrt(W/S) kt, V_D 1.4 x that
function genCertSpeeds(def) {
  const g = (def.params && def.params.gen) || {}, Vs = g.Vs || 25, L = GEN_CERT.limit;
  const WSpsf = g.W && g.Sw ? (g.W / 4.4482) / (g.Sw * 10.7639) : 10;
  const VC = Math.max(1.3 * Vs * Math.sqrt(L), 33 * Math.sqrt(WSpsf) * 0.5144);
  return { VA: Vs * Math.sqrt(L), VC, VD: 1.4 * VC, VF: Math.max(1.4 * Vs, 1.8 * (g.VsFlap || Vs)) };
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
// G1891 (DMG-CERTCOST): THE SETTLE, ONCE A BUILD. Every landing starts from the same 4 s on the wheels (or the water)
// from the same reset; genCertSettled flies it once and keeps the sim's state (30_solver.js snap), and each landing's
// fresh sim, made and placed the same way, takes it (unsnap) instead of flying it again - to the bit the same start
// (GATE DMGCERTCOST). Without a settled state (a sim that will not snap) a landing settles itself, as before
function genCertDropSim(def, world) {
  const d2 = Object.assign({}, def, { cert: null, params: Object.assign({}, def.params, { damage: true, damageProbe: true }) });
  const floats = !!(def.parts && def.parts.floats), sea = floats && world && world.aerodromes ? world.aerodromes.find(a => a.id === 'SEA') : null;
  const sim = makeSim(d2, sea ? world : null);
  sim.reset(0);
  if (sea) placeAtAerodrome(sim, sea);
  if (sim.setEngine && sim.eng) for (let i = 0; i < sim.eng.length; i++) sim.setEngine(i, { key: 'off' });
  return sim;
}
function genCertSettled(def, world) {
  const sim = genCertDropSim(def, world);
  for (let f = 0; f < 240; f++) genCertStep(sim);
  return typeof sim.snap === 'function' ? sim.snap() : null;
}
function genCertDrop(def, sink, world, o, settled, frames) {
  const sim = genCertDropSim(def, world);
  if (!(settled && sim.unsnap(settled))) for (let f = 0; f < 240; f++) genCertStep(sim);
  const n = sim.n, P = sim.damagePeak();
  for (let i = 0; i < n; i++) { sim.p[i * 3 + 1] += 0.02; sim.v[i * 3] = 0; sim.v[i * 3 + 1] = -sink; sim.v[i * 3 + 2] = 0; }
  // G1835 (DMG-D2b): THE GEAR'S OWN LANDING ATTITUDES (23.479-23.483, as recalled): the settled aeroplane turned about
  // its CG - `pitch` deg nose-up (a tricycle's tail-down landing, 23.481), `level` (a taildragger's level landing on
  // its mains, 23.479: the three-point attitude taken out), `roll` deg (one wheel or one float first, 23.483) - set
  // back down to touch where it touched, then dropped at the sink with `fwd` m/s along its heading and `lat` m/s
  // across it (the spin-up and the spring-back of a wheel meeting the ground at speed, a drift)
  if (o) {
    const [xA, , zR] = sim.axes(), c0 = sim.cgPos();
    let y0 = Infinity; for (let i = 0; i < n; i++) y0 = Math.min(y0, sim.p[i * 3 + 1] - def.nodes[i].r);
    const turn = (k, th) => { const cs = Math.cos(th), sn = Math.sin(th);
      for (let i = 0; i < n; i++) {
        const d = [sim.p[i*3] - c0[0], sim.p[i*3+1] - c0[1], sim.p[i*3+2] - c0[2]], kd = k[0]*d[0] + k[1]*d[1] + k[2]*d[2];
        const cr = [k[1]*d[2] - k[2]*d[1], k[2]*d[0] - k[0]*d[2], k[0]*d[1] - k[1]*d[0]];
        for (let j = 0; j < 3; j++) sim.p[i*3+j] = c0[j] + d[j] * cs + cr[j] * sn + k[j] * kd * (1 - cs);
      } };
    // the deck: the body's x axis over the horizontal, nose-up positive (x is aft: a raised nose has xA[1] < 0); a turn
    // about the body's right axis by a positive angle raises the nose (x aft, y up, z right is a left-handed frame)
    const deck = Math.asin(Math.max(-1, Math.min(1, -xA[1])));
    const th = (o.level ? -deck : 0) + (o.pitch || 0) * Math.PI / 180;
    if (th) turn(zR, th);
    if (o.roll) turn(xA, o.roll * Math.PI / 180);
    let y1 = Infinity; for (let i = 0; i < n; i++) y1 = Math.min(y1, sim.p[i * 3 + 1] - def.nodes[i].r);
    const hl = Math.hypot(xA[0], xA[2]) || 1, fwd = o.fwd || 0, lat = o.lat || 0, zl = Math.hypot(zR[0], zR[2]) || 1;
    for (let i = 0; i < n; i++) { sim.p[i * 3 + 1] += y0 - y1;
      sim.v[i * 3] = -fwd * xA[0] / hl + lat * zR[0] / zl; sim.v[i * 3 + 2] = -fwd * xA[2] / hl + lat * zR[2] / zl; }
  }
  P.t.fill(0); P.c.fill(0);
  let nzMax = 0;
  const nF = frames || 120;
  for (let f = 0; f < nF; f++) { genCertStep(sim); nzMax = Math.max(nzMax, sim.out.nz || 0); genCertTap(sim, f); }
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
  for (let f = 0; f < 72; f++) { genCertStep(sim); genCertTap(sim, f); }
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
  for (let f = 0; f < 60; f++) genCertStep(sim);
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
    genCertStep(sim); genCertTap(sim, f);
    const na = sim.out.aeroFy / W;
    nzMax = Math.max(nzMax, na);
    if (na >= L) { reached = true; break; }
  }
  const nb = def.beams.length, t = new Float64Array(nb), c = new Float64Array(nb);
  for (let bi = 0; bi < nb; bi++) { const b = sim.beams[bi];
    t[bi] = Number.isFinite(b.fyP) ? P.t[bi] * b.fyP : 0; c[bi] = Number.isFinite(b.fcP) ? P.c[bi] * b.fcP : 0; }
  return { t, c, nz: nzMax, reached };
}
// G1835 (DMG-D2b): THE GROUND AND WATER LOADS on the free aeroplane (the static cases' machinery: the reactions at
// the wheels or on the floats, the weight on every node, the rest the rigid body's acceleration). Written from the
// regulation's text AS RECALLED - A0 to open 23.479-23.499 and 23.521-23.537 on the box before a number of theirs
// becomes a gate (§1, §11.2 #7). Each returns [name, nodal forces]; the reactions act at the axle (the wheel's node)
// or, on a float, over its step station (keel and both chines), the def's level frame (x aft, y up, z right).
function genCertGroundLoads(def, nTD) {
  const n = def.nodes.length, { M, c } = genCertMass(def), W = M * 9.81, R = def.refs || {}, out = [];
  const grav = () => { const F = new Float64Array(n * 3); for (let i = 0; i < n; i++) F[i * 3 + 1] = -def.nodes[i].m * 9.81; return F; };
  const add = (F, i, fx, fy, fz) => { F[i * 3] += fx; F[i * 3 + 1] += fy; F[i * 3 + 2] += fz; };
  const G = GEN_CERT.ground;
  const FL = def.parts && def.parts.floats;
  if (FL && FL.length === 2) {
    // 23.527: the water reaction load factor n_w = C1 V_S0^2 / (tan^(2/3) beta W^(1/3)) (V_S0 kt, W lb, beta the
    // deadrise at the step), with the wing's lift taken as 2/3 of the weight (as 23.473's); 23.529: the step landing
    // (the reaction through the step, both floats alike), the unsymmetrical step landing (0.75 of it on each float
    // with a side load of 0.25 tan beta of the upward load), and the landing on one float (23.535's one-float
    // condition read for a twin-float installation: the step load on one float, the other clear)
    const g = (def.params && def.params.gen) || {}, Vso = (g.VsFlap || g.Vs || 25) / 0.5144, Wlb = W / 4.4482;
    const beta = ((FL[0].P && FL[0].P.beta) || 22) * Math.PI / 180, tb = Math.tan(beta);
    const nw = Math.max(G.nwMin, G.C1 * Vso * Vso / (Math.pow(tb, 2 / 3) * Math.pow(Wlb, 1 / 3)));
    const st = f => [f.K[2], f.DL[2], f.DR[2]];
    const lift = F => { const wl = genCertDist(def, ['wing'], null); if (wl) for (let i = 0; i < n; i++) F[i * 3 + 1] += G.lift * W * wl[i]; };
    const onFloat = (F, f, up, side) => { for (const i of st(f)) add(F, i, 0, up / 3, side / 3); };
    { const F = grav(); lift(F); for (const f of FL) onFloat(F, f, 0.5 * (nw - G.lift) * W, 0); out.push(['wStep', F]); }
    for (const sg of [1, -1]) { const F = grav(); lift(F); const up = 0.75 * 0.5 * (nw - G.lift) * W;
      for (const f of FL) onFloat(F, f, up, sg * 0.25 * tb * up); out.push([sg > 0 ? 'wUnsymR' : 'wUnsymL', F]); }
    for (const f of FL) { const F = grav(); lift(F); onFloat(F, f, (nw - G.lift) * W * G.oneFloat, 0); out.push([f.side > 0 ? 'wOneR' : 'wOneL', F]); }
    out.nw = nw;
    return out;
  }
  const Mn = (R.mains || []).filter(i => i >= 0);
  if (Mn.length !== 2) return out;
  const [iL, iR] = def.nodes[Mn[0]].p[2] < def.nodes[Mn[1]].p[2] ? Mn : [Mn[1], Mn[0]];
  const tw = R.tw != null && R.tw >= 0 ? R.tw : -1;
  const xm = 0.5 * (def.nodes[iL].p[0] + def.nodes[iR].p[0]);
  const sT = tw >= 0 && Math.abs(def.nodes[tw].p[0] - xm) > 1e-3 ? Math.max(0, Math.min(1, (c[0] - xm) / (def.nodes[tw].p[0] - xm))) : 0;
  const trike = tw >= 0 && def.nodes[tw].p[0] < xm;
  const mainsStatic = F => { add(F, iL, 0, 0.5 * (1 - sT) * W, 0); add(F, iR, 0, 0.5 * (1 - sT) * W, 0); };
  // 23.485 SIDE LOAD: the level attitude on the mains only, 1.33 W vertical shared equally, 0.83 W across - 0.5 W
  // inboard on one wheel and 0.33 W outboard on the other (a skid: the ground pushes both the same way)
  for (const sg of [1, -1]) {
    const F = grav(); add(F, iL, 0, 0.5 * G.sideV * W, 0); add(F, iR, 0, 0.5 * G.sideV * W, 0);
    add(F, sg > 0 ? iL : iR, 0, 0, sg * G.sideIn * W); add(F, sg > 0 ? iR : iL, 0, 0, sg * G.sideOut * W);
    out.push([sg > 0 ? 'gSideR' : 'gSideL', F]);
  }
  // 23.493 BRAKED ROLL: 1.33 W on the mains, the drag 0.8 of it aft at the wheels (the nose-over moment the body's
  // pitch takes)
  { const F = grav(); for (const i of [iL, iR]) add(F, i, G.brakeMu * 0.5 * G.brakeV * W, 0.5 * G.brakeV * W, 0); out.push(['gBrake', F]); }
  if (tw >= 0 && !trike) {
    // 23.497 THE TAILWHEEL: (a) the tail-down landing's limit reaction (its static share x the drop's load factor)
    // up and aft at 45 deg; (b) its static load up with an equal side load, either way
    const Rt = sT * W * Math.max(nTD || 0, G.nMin);
    { const F = grav(); mainsStatic(F); add(F, tw, Rt * Math.SQRT1_2, Rt * Math.SQRT1_2, 0); out.push(['gTailObs', F]); }
    for (const sg of [1, -1]) { const F = grav(); mainsStatic(F); add(F, tw, 0, sT * W, sg * G.twSide * sT * W); out.push([sg > 0 ? 'gTailSideR' : 'gTailSideL', F]); }
  } else if (trike) {
    // 23.499 THE NOSEWHEEL: 2.25 x its static reaction up, with 0.8 of that aft, 0.4 of it forward, or 0.7 of it across
    const Rn = G.noseK * sT * W;
    for (const [nm, fx, fz] of [['gNoseAft', G.noseAft, 0], ['gNoseFwd', -G.noseFwd, 0], ['gNoseSideR', 0, G.noseSide], ['gNoseSideL', 0, -G.noseSide]]) {
      const F = grav(); mainsStatic(F); add(F, tw, fx * Rn, Rn, fz * Rn); out.push([nm, F]);
    }
  }
  return out;
}
// G1836 (DMG-D2b): THE ROUGHEST GROUND (23.491, as recalled: the structure and the gear "not less than the loads
// obtained when the airplane is operating over the roughest ground that may reasonably be expected in normal
// operation" - the regulation names no field, so the field is GEN_CERT.rough, a stated assumption): a taxi at
// GEN_CERT.rough.V over two crossed trains of bumps, the throttle on the speed, the rudder on the heading, the real
// sim under the probe. A world of its own (the ground, no water, no trees: makeWorld is seconds; this is nothing)
function genCertTaxi(def) {
  const R = GEN_CERT.rough, k1 = 2 * Math.PI / R.lam, k2 = 2 * Math.PI / (0.43 * R.lam);
  const W = { terrainH: (x, z) => R.A * Math.sin(k1 * x + 0.7) * Math.cos(0.8 * k1 * z) + 0.5 * R.A * Math.sin(k2 * (0.6 * x + 0.8 * z)),
              waterH: () => -1e9, trees: [], treesNear: (x, z, q) => { q.length = 0; return q; } };
  const d2 = Object.assign({}, def, { cert: null, params: Object.assign({}, def.params, { damage: true, damageProbe: true }) });
  const sim = makeSim(d2, W); sim.reset(0);
  for (let f = 0; f < 120; f++) genCertStep(sim);
  const x0 = sim.axes()[0], hl = Math.hypot(x0[0], x0[2]) || 1, fx = -x0[0] / hl, fz = -x0[2] / hl, h0 = Math.atan2(fz, fx);
  for (let i = 0; i < sim.n; i++) { sim.v[i * 3] = R.V * fx; sim.v[i * 3 + 2] = R.V * fz; }
  const P = sim.damagePeak(); P.t.fill(0); P.c.fill(0);
  let I = 0;
  for (let f = 0; f < R.secs * 60; f++) {
    const v = sim.cgVel(), e = R.V - (v[0] * fx + v[2] * fz); I = Math.max(-2, Math.min(2, I + e / 60));
    sim.ctl.thr = Math.max(0, Math.min(1, 0.25 + 0.15 * e + 0.1 * I));
    const xA = sim.axes()[0]; let dh = Math.atan2(-xA[2], -xA[0]) - h0; while (dh > Math.PI) dh -= 2 * Math.PI; while (dh < -Math.PI) dh += 2 * Math.PI;
    sim.ctl.dr = Math.max(-1, Math.min(1, 3 * dh));
    genCertStep(sim); genCertTap(sim, f);
  }
  const nb = def.beams.length, t = new Float64Array(nb), c = new Float64Array(nb);
  for (let bi = 0; bi < nb; bi++) { const b = sim.beams[bi];
    t[bi] = Number.isFinite(b.fyP) ? P.t[bi] * b.fyP : 0; c[bi] = Number.isFinite(b.fcP) ? P.c[bi] * b.fcP : 0; }
  return { t, c };
}
// G1836 (DMG-D2b, dm14): THE CONTROLS FLOWN (23.423 / 23.441's checked and maneuvering conditions, the static
// hard-over cases above, flown): level at V_A at full power, then the elevator (or the rudder) full one way for
// GEN_CERT.ctlFlown.hold s, full the other way as long, back to neutral, the throttle chopped as the input starts, the
// real sim under the probe; the elevator again at V_F with the flaps down (23.345's configuration, the approach's).
// What the static cases cannot show: the airframe RINGING after a step - a short tie
// between two posts that no static load path crosses (the metal Cessna's stab root cross-tie, HR-HR, 18 cm between
// its two root posts: 0.35 kN in every static case, 0.5 kN in a single frame as its final's throttle came off and its
// elevator moved) carries what the frame's own modes put through it, and only a flown case puts them there
// (G1891: `lead` - { S }: the elevator's and the rudder's cases at V_A fly the same second of level flight first; the
// first keeps it (30_solver snap), the second starts from it)
function genCertFlownCtl(def, k, flap, lead) {
  const d2 = Object.assign({}, def, { cert: null, params: Object.assign({}, def.params, { damage: true, damageProbe: true }) });
  const sim = makeSim(d2, null); sim.reset(0);
  if (sim.setAtmos) sim.setAtmos(null, 400);
  const V = flap ? genCertSpeeds(def).VF : genCertSpeeds(def).VA, CF = GEN_CERT.ctlFlown;
  sim.ctl.flap = flap || 0;
  for (let i = 0; i < sim.n; i++) { sim.p[i * 3 + 1] += 400; sim.v[i * 3] = -V; sim.v[i * 3 + 1] = 0; sim.v[i * 3 + 2] = 0; }
  sim.ctl.thr = 1;
  if (!(lead && lead.S && sim.unsnap(lead.S))) {
    for (let f = 0; f < 60; f++) genCertStep(sim);
    if (lead && typeof sim.snap === 'function') lead.S = sim.snap();
  }
  const P = sim.damagePeak(); P.t.fill(0); P.c.fill(0);
  const h = Math.round(CF.hold * 60);
  for (let f = 0; f < 4 * h; f++) {
    sim.ctl[k] = f < h ? 1 : f < 2 * h ? -1 : 0; sim.ctl.thr = 0;
    genCertStep(sim); genCertTap(sim, f);
  }
  const nb = def.beams.length, t = new Float64Array(nb), c = new Float64Array(nb);
  for (let bi = 0; bi < nb; bi++) { const b = sim.beams[bi];
    t[bi] = Number.isFinite(b.fyP) ? P.t[bi] * b.fyP : 0; c[bi] = Number.isFinite(b.fcP) ? P.c[bi] * b.fcP : 0; }
  return { t, c };
}
// G1836 (DMG-D2b, dm14): A FLOATPLANE'S WATER HANDLING - the run-out after a landing, the rudder (the water rudders) hard
// over one way then the other at the run-out's speed (GEN_CERT.weave: x V_S0), power off, on the sea lane, the real
// sim under the probe. No FAR 23 case asks for it (23.529's side loads are a tenth of the step's), and the twin
// floatplane's crosswind circuit rang a float strut to 1.7 x its water envelope as its pilot weaved the rudder at 12
// m/s on the run-out: a float's lateral load through its struts is a case the water's own handling makes
function genCertWaterWeave(def, world) {
  if (!world || !world.aerodromes) return null;
  const sea = world.aerodromes.find(a => a.id === 'SEA'); if (!sea) return null;
  const d2 = Object.assign({}, def, { cert: null, params: Object.assign({}, def.params, { damage: true, damageProbe: true }) });
  const sim = makeSim(d2, world); sim.reset(0); placeAtAerodrome(sim, sea);
  for (let f = 0; f < 120; f++) genCertStep(sim);
  const g = (def.params && def.params.gen) || {}, V = GEN_CERT.weave.V * (g.VsFlap || g.Vs || 25), xA = sim.axes()[0], hl = Math.hypot(xA[0], xA[2]) || 1;
  for (let i = 0; i < sim.n; i++) { sim.v[i * 3] = -V * xA[0] / hl; sim.v[i * 3 + 2] = -V * xA[2] / hl; }
  sim.ctl.thr = 0;
  const P = sim.damagePeak(); P.t.fill(0); P.c.fill(0);
  const h = Math.round(GEN_CERT.weave.hold * 60);
  for (let f = 0; f < 6 * h; f++) { sim.ctl.dr = (Math.floor(f / h) % 2) ? -1 : 1; genCertStep(sim); genCertTap(sim, f); }
  sim.ctl.dr = 0;
  const nb = def.beams.length, t = new Float64Array(nb), c = new Float64Array(nb);
  for (let bi = 0; bi < nb; bi++) { const b = sim.beams[bi];
    t[bi] = Number.isFinite(b.fyP) ? P.t[bi] * b.fyP : 0; c[bi] = Number.isFinite(b.fcP) ? P.c[bi] * b.fcP : 0; }
  return { t, c };
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
// G1891 (DMG-CERTCOST): genCertifySteps is the same computation as a generator - it yields the name of each case (or
// group of cases) as it completes, and returns the certificate - so the bench worker can give its event loop a turn
// between the cases; genCertify runs it to the end in one go
function genCertify(def, opt) {
  const g = genCertifySteps(def, opt);
  let r = g.next();
  while (!r.done) r = g.next();
  return r.value;
}
function* genCertifySteps(def, opt) {
  opt = opt || {};
  const t0 = (typeof performance !== 'undefined' ? performance : Date).now(), s0 = GEN_CERT_HOOK.steps;
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
  // G1836 (DMG-D2b, dm14): THE FLAPS EXTENDED (23.345, as recalled - A0 to open it): the positive limit with the flaps
  // fully down is 2.0 g, at the flap speed V_F (at least 1.4 Vs and 1.8 Vs with the flaps), trimmed. Without it no case
  // flew the flaps, and the circuit's FINAL loaded the metal Cessna's stab rear spar (HR-HR, the trim's download with
  // the flaps' nose-down moment) to 0.74 of a yield that sat on the floor (0.68 kN: the clean cases asked 0.29)
  A('flapF', { V: VS.VF, nz: GEN_CERT.flapN, trim: true, flap: 1 });
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
      const o = { V, alpha: t1.alpha, de: t1.de, dyn: GEN_CERT.dynCtl }; o[k] = d; const r = A(nm, o);
      // G1836 (DMG-D2b, dm14): THE UNSYMMETRICAL TAIL LOAD (23.427(b), as recalled - A0 to open it): 100 % of the
      // symmetrical case's stab load on one side, 100 - 10 (n - 1) % (at most 80 %) on the other. Without it nothing
      // loaded the stab's centre section (the rear spar across the fuselage, HR-HR): its yield sat on the floor and an
      // elevator moving on the metal Cessna's final read 0.74 of it
      if (k === 'de') {
        const Sn = new Uint8Array(nN);
        for (const st of def.strips) if (st.kind === 'stab') for (const q of st.w) Sn[q[0]] = 1;
        const pct = Math.min(GEN_CERT.tailAsymMax, 1 - 0.1 * (L - 1));
        for (const sd of [1, -1]) {
          const F2 = Float64Array.from(r.raw);
          for (let i = 0; i < nN; i++) if (Sn[i] && sd * def.nodes[i].p[2] > 0.01)
            for (let j = 0; j < 3; j++) F2[i * 3 + j] -= (1 - pct) * (r.raw[i * 3 + j] + (j === 1 ? def.nodes[i].m * 9.81 : 0));
          for (let i = 0; i < F2.length; i++) F2[i] *= GEN_CERT.dynCtl;
          put(nm + (sd > 0 ? 'uL' : 'uR'), genCertForces(flight, genCertRelieve(def, F2)));
        }
      }
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
      // G1826 (DMG-DRIVE): THE ENGINE'S OWN LOADS ON ITS MOUNT - 23.361's torque, 23.363's side load, 23.371's
      // gyroscopic couple (33_drive.js; FAR 23 as recalled, A0 to open it) - on the same pinned airframe
      if (typeof genCertDrive === 'function') for (const [nm, F] of genCertDrive(def, item)) put(nm, genCertForces(sysE, F));
    }
  }
  const tF = (typeof performance !== 'undefined' ? performance : Date).now();
  yield 'static';
  const bc = genCertBench(def, L);
  if (bc) put('bench', genCertForces(sysOf('bench', { kOf: kT, sub: genCertSubsTrue(def), pinned: bc.pinned, pos: bc.pos }), bc.F));
  const tB = (typeof performance !== 'undefined' ? performance : Date).now();
  const sink = GEN_CERT.dropCap ? 10 * 0.3048 : genCertSink(def);
  let drop = null;
  const now = () => (typeof performance !== 'undefined' ? performance : Date).now(), msC = {};
  let tc = now(); const lap = nm => { const t = now(); msC[nm] = t - tc; tc = t; };
  const tap = nm => { GEN_CERT_HOOK.name = nm; };
  // G1891: the settle every landing starts from, flown once (opt.share === false: each landing settles itself)
  const settled = opt.drop !== false && opt.share !== false ? genCertSettled(def, opt.world) : null;
  if (settled) { lap('settle'); yield 'settle'; }
  // (opt.full: every landing its 2 s, D2a's window - the evidence's and the gate's uncut reference)
  const dropN = opt.full ? 120 : def.parts && def.parts.floats ? GEN_CERT.win.water : GEN_CERT.win.wheels;
  if (opt.drop !== false) { tap('drop'); drop = genCertDrop(def, sink, opt.world, null, settled, dropN); cases.drop = { t: drop.t, c: drop.c }; lap('drop'); yield 'drop'; }
  if (opt.drop !== false && def.parts && def.parts.floats) { tap('bow'); const bw = genCertBow(def, opt.world); if (bw) cases.bow = bw; lap('bow'); yield 'bow'; }
  // G1835 (DMG-D2b): THE GEAR'S OWN CASES - the landings at the drop's sink in the attitudes 23.479-23.483 ask for, at
  // the touchdown speed (the wheel's spin-up and spring-back, the float's step meeting the water at speed), and the
  // ground and water loads (genCertGroundLoads) on the free aeroplane
  let ground = null;
  if (opt.drop !== false) {
    const g = (def.params && def.params.gen) || {}, Vso = g.VsFlap || g.Vs || 25;
    const tw = def.refs && def.refs.tw != null && def.refs.tw >= 0 ? def.refs.tw : -1, R = def.refs || {};
    const xm = R.mains && R.mains.length ? R.mains.reduce((a, i) => a + def.nodes[i].p[0], 0) / R.mains.length : 0;
    const trike = tw >= 0 && def.nodes[tw].p[0] < xm, FLt = !!(def.parts && def.parts.floats);
    // (a floatplane's step landing again with the drift of the demonstrated crosswind component - 23.233's 0.2 V_S0, as
    // recalled - either way: 23.529's unsymmetrical side load, 0.25 tan(beta) of the step's, is a tenth of the vertical,
    // and an ordinary crosswind landing's drift and weathercocking put 1.5-1.8 x the struts' limit through them)
    const xw = GEN_CERT.gearDrop.xwind * Vso;
    const GD = FLt ? [['dropStep', { pitch: GEN_CERT.gearDrop.stepPitch, fwd: Vso }], ['dropOne', { roll: GEN_CERT.gearDrop.roll, fwd: Vso }],
                      ['dropDriftR', { pitch: GEN_CERT.gearDrop.stepPitch, fwd: Vso, lat: xw }], ['dropDriftL', { pitch: GEN_CERT.gearDrop.stepPitch, fwd: Vso, lat: -xw }]]
      : [[trike ? 'dropNoseUp' : 'dropLevel', trike ? { pitch: GEN_CERT.gearDrop.noseUp, fwd: Vso } : { level: true, fwd: Vso }], ['dropOne', { roll: GEN_CERT.gearDrop.roll, fwd: Vso }]];
    // ...and the touchdown at the build's own limit sink (23.473's V, under the cap) at the touchdown speed: a frame's
    // dynamic answer is not monotone in the sink (the Cessna on floats' wing spar took more at 2.54 m/s, level, than in
    // the one-float landing at the cap's 3.05)
    GD.push(['drop473', { fwd: Vso }]);
    for (const [nm, o] of GD) { tap(nm); const r = genCertDrop(def, nm === 'drop473' ? genCertSink(def) : sink, opt.world, o, settled, dropN); cases[nm] = { t: r.t, c: r.c }; lap(nm); yield nm; }
    if (!FLt) { tap('taxiRough'); cases.taxiRough = genCertTaxi(def); lap('taxiRough'); yield 'taxiRough'; }
    else { tap('wWeave'); const ww = genCertWaterWeave(def, opt.world); if (ww) cases.wWeave = ww; lap('wWeave'); yield 'wWeave'; }
    ground = genCertGroundLoads(def, drop ? drop.nz : 0);
    for (const [nm, F] of ground) put(nm, genCertForces(flight, genCertRelieve(def, F)));
    lap('ground'); yield 'ground';
  }
  let flown = null;
  if (opt.drop !== false) { tap('flown'); flown = genCertFlown(def); cases.flown = { t: flown.t, c: flown.c }; lap('flown'); yield 'flown'; }
  if (opt.drop !== false) {
    const lead = opt.share !== false ? {} : null;   // G1891: the elevator's and the rudder's second of level flight, flown once
    tap('flownElev'); cases.flownElev = genCertFlownCtl(def, 'de', 0, lead); lap('flownElev'); yield 'flownElev';
    tap('flownRud'); cases.flownRud = genCertFlownCtl(def, 'dr', 0, lead); lap('flownRud'); yield 'flownRud';
    tap('flownElevF'); cases.flownElevF = genCertFlownCtl(def, 'de', 1); lap('flownElevF'); yield 'flownElevF';
  }
  GEN_CERT_HOOK.name = '';
  const tD = (typeof performance !== 'undefined' ? performance : Date).now();
  const { Ft, Fc, byT, byC, names } = genCertCombine(def, cases);
  return { v: GEN_CERT_V, key: genCertKey(def), nb, nN, limit: L, ult: GEN_CERT.ult, neg: -GEN_CERT.neg * L, m: GEN_CERT.m,
           sink, dropNz: drop ? drop.nz : null, flownNz: flown ? flown.nz : null, flownReached: flown ? flown.reached : null,
           Ft, Fc, byT, byC, names, cases, speeds: VS, aero, nw: ground && ground.nw != null ? ground.nw : null,
           ms: { flight: tF - t0, bench: tB - tF, drop: tD - tB, total: tD - t0, cases: msC, frames: GEN_CERT_HOOK.steps - s0 } };
}
// THE ENVELOPE from the cases (each { t, c }: every member's peak at limit, tension and compression), in the cases' own
// order (byT / byC: the governing case's index in `names`). G1890: its own function - the evidence re-reads it with a
// case's window cut short
function genCertCombine(def, cases) {
  const nb = def.beams.length;
  const Ft = new Float64Array(nb), Fc = new Float64Array(nb), byT = new Int8Array(nb).fill(-1), byC = new Int8Array(nb).fill(-1);
  const names = Object.keys(cases);
  // G1836 (DMG-D2b, dm14): THE GEAR IS THE FUSE. The landing, ground and water cases (the drops, the bow, the taxi over
  // the roughest ground, the ground and water loads) certify the AIRFRAME at the gear's ultimate (GEN_CERT.landK):
  // §7.3's bracket yields the gear just past its limit sink and breaks it past 1.2 V, so the members that carry the
  // gear's loads into the airframe must hold, with no set, what the gear can deliver before it lets go - a landing
  // that bends the gear does not bend the fuselage (§7.4's NASA 172 Test 1: the gear separates, the cabin intact).
  // Read at its limit, the airframe behind the gear sat at its certified yield at the limit sink (the Cessna on
  // floats' wing 1.00 at 23.473's 2.5 m/s, its engine bay 0.70 in the circuit's water touchdown). The gear's own
  // members take these cases at their limit (gearStamp: their bracket)
  // ...AND A FRAME RINGING RINGS BOTH WAYS (G1836): the controls flown (flownElev / flownRud / flownElevF) are steps, and
  // what they put through a member that no static load path crosses is a RINGING about whatever it carried - the
  // metal Cessna's stab root cross-tie rang to 0.49 kN in tension and 1.99 in compression after the elevator's step,
  // and to 0.50 kN in tension on its final as the flaps ran out (its mean there in tension). So a flown control case's
  // peak is an amplitude, not a sign: its larger peak certifies the member both ways
  const landC = names.map(nm => GEN_CERT_LAND.test(nm)), ringC = names.map(nm => GEN_CERT_RING.test(nm));
  names.forEach((nm, ci) => { const C = cases[nm], kL = landC[ci] ? GEN_CERT.landK : 1; for (let bi = 0; bi < nb; bi++) {
    const k = def.beams[bi].cls === 'gear' ? 1 : kL, r = ringC[ci] ? Math.max(C.t[bi], C.c[bi]) : 0;
    const t = Math.max(C.t[bi], r) * k, c = (def.beams[bi].tens ? C.c[bi] : Math.max(C.c[bi], r)) * k;
    if (t > Ft[bi]) { Ft[bi] = t; byT[bi] = ci; } if (c > Fc[bi]) { Fc[bi] = c; byC[bi] = ci; } } });
  return { Ft, Fc, byT, byC, names };
}
// G1890 (DMG-CERTCOST): THE EVIDENCE'S TAP - `frame(name, f, sim)` after every measured frame of a dynamic case (the
// case's name, the frame since its window opened, the sim under the probe); null in the game (one compare a frame)
// `steps`: every frame the certificate's sims have stepped (the certificate's own count: C.ms.frames, GATE DMGCERTCOST's
// budget - the time a machine takes, the frames do not move)
const GEN_CERT_HOOK = { frame: null, name: '', steps: 0 };
function genCertTap(sim, f) { if (GEN_CERT_HOOK.frame) GEN_CERT_HOOK.frame(GEN_CERT_HOOK.name, f, sim); }
function genCertStep(sim) { GEN_CERT_HOOK.steps++; sim.step(1 / 60); }
// G1826 (DMG-DRIVE): THE ENGINE'S OWN LOADS ON ITS MOUNT, at LIMIT (FAR 23 as recalled - 23.361, 23.363, 23.371; A0 to open
// them), each engine's item nodes (`item`: ENG / CGE / MNT, each given to the engine whose thrust node is nearest) loaded
// on the airframe held where it is (the crash cases' pinned system):
//   torque361 - the LIMIT torque (the mean torque at rated power and rpm through the reduction unit, x 23.361(c)'s factor
//     by cylinders: 2 for a four, 4 for a two, 1.33 from five) as the engine's reaction to its propeller (the sense the
//     build's engine turns, spec.engines[].sense), acting with condition A's 3.8 g on the engine (23.361(a)(2): at the
//     maximum continuous torque with 100 % of A; a piston's take-off and maximum continuous torques are one number here);
//   side363R / L - 1.33 g sideways on the engine, alone;
//   gyro371 a-d - the propeller's spin (I w, the blade-as-bar inertia of 33_drive) precessed by a yaw of 2.5 rad/s and
//     a pitch of 1.0 rad/s, both signs of each (the moment Omega x H on the mount), with 2.5 g and the maximum
//     continuous (static) thrust.
// A couple on the item nodes is laid out as a rigid body's angular acceleration would load them (F_i = m_i alpha x r_i,
// alpha = I_item^-1 M about the item's own centre of mass): a pure moment, no net force.
function genCertDrive(def, item) {
  const out = [], n = def.nodes.length, DS = typeof genDriveSpec === 'function' ? genDriveSpec(def) : null;
  if (!DS || !(DS.Q > 0)) return out;
  const G = GEN_DRIVE.far, E = (def.refs && def.refs.engine) || [], EO = (def.refs && def.refs.engineOf) || E.map(() => 0);
  const nE = (def.params && def.params.nEngines) || 1, sense = k => { const S = def.spec && def.spec.engines; return S && S[k] && +S[k].sense === -1 ? -1 : 1; };
  // each item node to the engine of its nearest thrust node
  const own = new Int32Array(n).fill(-1);
  for (let i = 0; i < n; i++) if (item[i]) { let best = Infinity;
    E.forEach((t, j) => { const a = def.nodes[i].p, b = def.nodes[t].p, d = Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]); if (d < best) { best = d; own[i] = EO[j] | 0; } }); }
  const couple = (F, k, M) => {
    let m = 0, c = [0, 0, 0];
    for (let i = 0; i < n; i++) if (own[i] === k) { const w = def.nodes[i].m; m += w; for (let j = 0; j < 3; j++) c[j] += w * def.nodes[i].p[j]; }
    if (!(m > 0)) return;
    c = c.map(x => x / m);
    const I = [0, 0, 0, 0, 0, 0, 0, 0, 0];
    for (let i = 0; i < n; i++) if (own[i] === k) { const w = def.nodes[i].m, r = [0, 1, 2].map(j => def.nodes[i].p[j] - c[j]), r2 = r[0] * r[0] + r[1] * r[1] + r[2] * r[2];
      for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) I[a * 3 + b] += w * ((a === b ? r2 : 0) - r[a] * r[b]); }
    // (a set of nodes in a line has no inertia about it: the least eigen-direction is padded by a millimetre's worth)
    for (let a = 0; a < 3; a++) I[a * 4] += 1e-6 * m;
    const Ii = genCertInv(I, 3), al = [0, 1, 2].map(a => Ii[a * 3] * M[0] + Ii[a * 3 + 1] * M[1] + Ii[a * 3 + 2] * M[2]);
    for (let i = 0; i < n; i++) if (own[i] === k) { const w = def.nodes[i].m, r = [0, 1, 2].map(j => def.nodes[i].p[j] - c[j]);
      F[i * 3] += w * (al[1] * r[2] - al[2] * r[1]); F[i * 3 + 1] += w * (al[2] * r[0] - al[0] * r[2]); F[i * 3 + 2] += w * (al[0] * r[1] - al[1] * r[0]); }
  };
  const gload = (F, ax, gx) => { for (let i = 0; i < n; i++) if (own[i] >= 0) F[i * 3 + ax] += def.nodes[i].m * 9.81 * gx; };
  // the engine's reaction to the prop it drives: about +x (aft) for a prop turning clockwise from behind (its spin is
  // along -x, the body's x being aft); the limit torque at the prop shaft (the crank's through the reduction unit)
  const Qlim = DS.tqK * DS.Qprop;
  { const F = new Float64Array(n * 3); for (let k = 0; k < nE; k++) couple(F, k, [sense(k) * Qlim, 0, 0]); gload(F, 1, -GEN_CERT.limit); out.push(['torque361', F]); }
  for (const [nm, sd] of [['side363R', 1], ['side363L', -1]]) { const F = new Float64Array(n * 3); gload(F, 2, sd * G.side); out.push([nm, F]); }
  // the gyroscopic couple: H = I w along -x sense; the mount carries -(Omega x H) on the engine (the reaction to the
  // precession it forces): with Omega = (0, q_yaw, q_pitch), Omega x H = (0, Omega_z H_x, -Omega_y H_x)
  const Hx = -DS.I * DS.omegaR;
  const T = def.params && def.params.prop ? def.params.prop.Tstatic : 0;
  [['a', 1, 1], ['b', 1, -1], ['c', -1, 1], ['d', -1, -1]].forEach(([nm, sy, sz]) => {
    const F = new Float64Array(n * 3), wy = sy * G.yaw, wz = sz * G.pitch;
    for (let k = 0; k < nE; k++) { const h = sense(k) * Hx; couple(F, k, [0, -(wz * h), wy * h]); }
    gload(F, 1, -G.gyroNz);
    // the thrust (maximum continuous: the static thrust) at the thrust nodes, forward (-x)
    if (T > 0) for (let k = 0; k < nE; k++) { const tn = E.filter((t, j) => (EO[j] | 0) === k); for (const t of tn) F[t * 3] -= T / tn.length; }
    out.push(['gyro371' + nm, F]);
  });
  return out;
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
