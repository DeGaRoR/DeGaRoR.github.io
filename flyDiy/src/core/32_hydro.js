// THE FLOAT IN WATER — H0, the spike (2026-09-13, futureDesigns/WATER-2026-09-13.md §5).
//
// One float, one panel set, dropped onto water. Headless in node, drawn by
// _hydro.html. It exists to answer the four questions that could invalidate
// the design before anything is built into the solver:
//   1. does it settle to the right draft (Archimedes, an arguable number)?
//   2. is it STABLE at the solver's substep (omega*dt, c*dt against the
//      fleet's measured envelope: proven 0.50 / 0.73, diverged 0.615 / 0.947)?
//   3. does a tow at increasing speed show a HUMP?
//   4. does a 1 m/s touchdown carry a GRADIENT of drag, not a step?
//
// THE RULE (§2.1): every hydrodynamic term is a smooth function of immersion,
// computed PER PANEL, and there is no boolean anywhere. A panel is a face of
// the float's own closed hull; each substep it is CLIPPED against the free
// surface (Sutherland-Hodgman on the signed depth at its corners), so the
// wetted area, its centroid and the depth over it are exact for a planar
// surface, continuous in the float's pose, and zero when the panel is dry.
//
// THE HULL is lofted from stations in the MODEL frame (x AFT, y up, z right —
// the solver's own, so the join later is a placement, not a re-frame): a
// V-bottom of declared deadrise up to the chine, vertical sides to a flat
// deck, a bow cap, a stern transom and — the one non-negotiable (§1.3) — a
// STEP: a transverse break in the planing bottom at x = 0, the afterbody's
// keel `hs` higher and rising aft at `aftAngle`. Origin at the step's keel
// point, forebody at x < 0.
//
// FOUR FORCE TERMS, all smooth in depth (§2.2):
//   1. hydrostatic  p = rho g d over the wet polygon — Archimedes exactly on
//      a closed hull (the check's Monte-Carlo volume is the independent
//      arbiter); on a planing bottom faded toward its trailing edge over the
//      Froude length V^2/g (the transom carries no head: `kTr`, compared in
//      the check with Savitsky's buoyant term) — BY AS MUCH AS THAT EDGE IS
//      VENTILATED. A water-filled wake keeps its head; only air behind the
//      edge brings the pressure there to atmospheric. Measured with the
//      fade unconditional: the hull sat 0.20 m deep at 10 m/s with a third
//      of its Archimedes, and a lone float never got over the hump.
//   2. planing lift — Savitsky's dynamic term, 0.012 tau^1.1 lambda^0.5, as a
//      per-panel pressure Cpl rho V^2 sin(alpha) g(s): concentrated at the
//      wetted leading edge (g ~ 1/sqrt(s), whose integral IS the lambda^0.5),
//      the deadrise correction as his -0.0065 beta CL0^0.6 at a reference
//      CL0. Summed in quadrature with a Newtonian sin^2 pressure so a bottom
//      meeting the water square-on (a drop) is an impact, not a Savitsky
//      extrapolation. One-sided: a bottom receding from the water ventilates.
//   3. drag — ITTC-57 skin friction along the local flow on every wet panel;
//      a cross-flow pressure 1/2 rho Cd Vn|Vn| on sides, bow and transom (the
//      keel's grip); and the pressure terms' own aft components on the
//      inclined bottom, which — with the step and transom ventilated — is
//      where a planing hull's wave-type resistance comes from here. There is
//      NO separate wave-making curve: what the tow sweep shows is what the
//      geometry makes (a stated cut; the bow wave's radiated energy in the
//      displacement regime is not modelled).
//   4. added mass / slam — von Karman / Wagner wedge entry: the wetted half-
//      width c = kw d / tan(beta) grows with keel depth, m_a' = 1/4 rho pi c^2
//      per side and unit length, F = (dm_a/dd) Vn^2 on entry only (the water
//      lets go on exit), ending when the chine wets (c capped at the half-
//      beam: dc/dd = 0). ON THE UNSTEADY ENTRY ONLY — the heave, the pitch
//      rate and the water's own motion, never the forward speed over the
//      inclined bottom: that steady entry IS the planing lift (2D+t theory),
//      and Savitsky's fit already carries it. Measured with both counted:
//      the tow porpoised to 20 deg and left the water at 17 m/s.
//      This is the term that carries the stability risk —
//      its linearised damping 2F/Vn is what the check reports as c*dt — and
//      `slamCap` is the semi-implicit treatment §5 names: the impulse a panel
//      may hand a node in one substep is bounded by that node's own normal
//      momentum, exactly as the solver already bounds ground friction.
//
// THE STEP'S SUCTION (3d). Before air reaches the step the flow still
// separates from its edge once the dynamic head beats the hydrostatic one
// (the cavity number sigma = 2 g d / V^2 under 1), and what sits behind the
// edge is a water-filled wake at BASE pressure — a suction of Cp_base q on
// the step face and the transom, the grip the design calls "held by
// suction" (§1.3). Cp_base -0.15 is INFERRED (bluff bodies -0.1..-0.3).
//
// THE STEP WORKS BY GEOMETRY. Aft of it the effective free surface is the
// forebody's WAKE: a streamline leaving the step edge along the forebody
// bottom, falling under gravity ((g/2)(dx/V)^2) and recovering to the still
// level over the transom-wave scale (kWake V^2/g); scaled by how much AIR
// reaches the step — a smooth ramp on the chine's depth at the step
// (`dVent`: submerged chines admit none). At rest the afterbody is fully
// wet; risen and planing, it is dry from the step back and the wetted area
// collapses — which is the hump's far side (§1.3). kWake and dVent are
// INFERRED constants the tow sweep exposes; H3's calibration against the
// NACA tank reports pins them.
//
// NOT MODELLED (H0 cuts, each named): the spray-root wave rise (Savitsky's
// lambda is the still-water one here); whisker spray drag; the added-mass
// inertia term m_a dVn/dt; a current; roll stability of a lone float (a
// single float with an aeroplane on it capsizes — GM < 0 — and the tank runs
// with roll and yaw LOCKED, as a towing carriage does; `free` shows the
// capsize honestly).
//
// H1 (G382): THE SAME LAW IN THE SOLVER. This file is a core file now
// (flight_core.js carries it as HYDRO; tools/_hydro_gen.js is the shim the
// bench and the H0 check load). The force pass takes a POSE PROVIDER, not a
// rigid body: `hydroPanels(F, ctx, water, t, out)` asks ctx for the world
// vertices, the hull's velocity at a point, and a point's float-frame
// position. The bench's rigid body is one provider (rigidCtx); a float
// built as NODES in the solver is another (tetraCtx): every hull vertex is
// an AFFINE combination of four non-coplanar float nodes (its barycentric
// weights in that tetrahedron, taken at rest), which is exact under any
// rigid motion of the cluster, and a panel's force lands on those four
// nodes by the barycentrics of its point of application — the right net
// force and the right torque, on real nodes, as a strip's does (ruling an).

// ONE GLOBAL. The file is wrapped: dev.html loads every core file as its own
// classic script, and a top-level `const API` / `G` / `D2R` here collided
// with the tool files' (measured: _vessel_gen.js refused to load). `HYDRO`
// is the only name this file puts in the shared scope; flight_core.js
// exports it, the frame and the solver read it, the bench reads
// window.HYDRO_GEN.
var HYDRO;
(function () {
const G = 9.81, NU = 1.0e-6, D2R = Math.PI / 180;

// ---- the float, declared ---------------------------------------------------
// A light-aircraft float carrying half a Cub: EDO-2000 class proportions
// (4.6 m, 0.72 m beam, 20 deg deadrise, the step at 54 % of the length),
// 45 kg of float and 255 kg of aeroplane on top of it.
const DEF = {
  L: 4.6,          // overall length, m
  xs: 2.5,         // the step, m aft of the bow
  B: 0.72,         // chine beam at the step, m
  beta: 20,        // forebody deadrise, deg
  betaA: 20,       // afterbody deadrise, deg
  hs: 0.045,       // step depth, m
  aftAngle: 6.5,   // the afterbody keel's rise aft, deg (the NACA float families: 5.5-8.5)
  xFlat: 1.4,      // forebody keel flat this far ahead of the step, m
  yBow: 0.38,      // keel height at the bow, m (the rocker)
  bBow: 0.10,      // half-beam at the bow, m
  bStern: 0.75,    // stern half-beam, as a fraction of B/2
  hSide: 0.24,     // chine to deck, m (at the forebody; the deck is level)
  nSta: 24,        // stations over the length
  mFloat: 45,      // kg
  cgFloat: [-0.2, 0.15, 0],
  mLoad: 255,      // the aeroplane's half, kg
  cgLoad: [-0.26, 1.15, 0],   // the step 12 deg aft of the CG (the seaplane rule: 10-15)
  loadI: [150, 300, 300],   // the load's own inertia about its CG (roll, yaw, pitch), kg m^2
  rho: 1000,       // fresh water; 1025 at sea
  // the model's constants
  Cpl: 0.39,       // Savitsky's 0.012 tau^1.1 as a pressure coefficient (0.37-0.42 over 2-8 deg)
  kBeta: 0.0163,   // deadrise: 1 - kBeta*beta = his -0.0065 beta CL0^0.6 at CL0 0.10 (the hump's loading)
  xi0: 0.01,       // the leading-edge weight's core, in beams (0.05 integrated to 86 % of lambda^0.5 at lambda 2)
  kTr: 0.15,       // transom fade length = kTr V^2/g (fitted in the check)
  kWake: 0.5,      // wake recovery length = kWake V^2/g (INFERRED)
  dVent: 0.05,     // chine depth at the step over which the step loses its air, m
  Cd: 1.2,         // cross-flow / square-on pressure coefficient
  kw: Math.PI / 2, // Wagner's rise-up on the wetted width (1 = von Karman)
  kRad: 0.02,      // wave radiation damping, see (3c) (INFERRED)
  slamCap: 1,      // bound a panel's slam impulse by the node's own momentum
  CpBase: -0.15,   // the separated wake's base pressure behind an unventilated step / transom (INFERRED)
};

// ---- small vectors ---------------------------------------------------------
const v3 = () => [0, 0, 0];
const sub = (a, b, o = v3()) => { o[0] = a[0] - b[0]; o[1] = a[1] - b[1]; o[2] = a[2] - b[2]; return o; };
const add = (a, b, o = v3()) => { o[0] = a[0] + b[0]; o[1] = a[1] + b[1]; o[2] = a[2] + b[2]; return o; };
const scl = (a, s, o = v3()) => { o[0] = a[0] * s; o[1] = a[1] * s; o[2] = a[2] * s; return o; };
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b, o = v3()) => { const x = a[1] * b[2] - a[2] * b[1], y = a[2] * b[0] - a[0] * b[2], z = a[0] * b[1] - a[1] * b[0]; o[0] = x; o[1] = y; o[2] = z; return o; };
const len = a => Math.hypot(a[0], a[1], a[2]);
const nrm = (a, o = a) => { const L = len(a) || 1e-12; o[0] = a[0] / L; o[1] = a[1] / L; o[2] = a[2] / L; return o; };
// 3x3 row-major
const matVec = (R, a, o = v3()) => { const x = R[0] * a[0] + R[1] * a[1] + R[2] * a[2], y = R[3] * a[0] + R[4] * a[1] + R[5] * a[2], z = R[6] * a[0] + R[7] * a[1] + R[8] * a[2]; o[0] = x; o[1] = y; o[2] = z; return o; };
const matTVec = (R, a, o = v3()) => { const x = R[0] * a[0] + R[3] * a[1] + R[6] * a[2], y = R[1] * a[0] + R[4] * a[1] + R[7] * a[2], z = R[2] * a[0] + R[5] * a[1] + R[8] * a[2]; o[0] = x; o[1] = y; o[2] = z; return o; };
const matMul = (A, B) => { const o = new Array(9); for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) o[i * 3 + j] = A[i * 3] * B[j] + A[i * 3 + 1] * B[3 + j] + A[i * 3 + 2] * B[6 + j]; return o; };
const ident = () => [1, 0, 0, 0, 1, 0, 0, 0, 1];
// Rodrigues: the rotation by the vector w*dt
function rotExp(w, dt) {
  const th = len(w) * dt;
  if (th < 1e-12) return ident();
  const k = nrm(scl(w, 1)), c = Math.cos(th), s = Math.sin(th), C = 1 - c;
  return [c + k[0] * k[0] * C, k[0] * k[1] * C - k[2] * s, k[0] * k[2] * C + k[1] * s,
          k[1] * k[0] * C + k[2] * s, c + k[1] * k[1] * C, k[1] * k[2] * C - k[0] * s,
          k[2] * k[0] * C - k[1] * s, k[2] * k[1] * C + k[0] * s, c + k[2] * k[2] * C];
}
function orthonormalise(R) {
  const a = [R[0], R[3], R[6]], b = [R[1], R[4], R[7]];
  nrm(a); const ab = dot(a, b); b[0] -= ab * a[0]; b[1] -= ab * a[1]; b[2] -= ab * a[2]; nrm(b);
  const c = cross(a, b);
  R[0] = a[0]; R[3] = a[1]; R[6] = a[2]; R[1] = b[0]; R[4] = b[1]; R[7] = b[2]; R[2] = c[0]; R[5] = c[1]; R[8] = c[2];
  return R;
}
// pitch about z (nose-up positive: the nose, at -x, goes up)
const rotPitch = th => { const c = Math.cos(th), s = Math.sin(th); return [c, s, 0, -s, c, 0, 0, 0, 1]; };
const smooth01 = t => t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t);

// ---- the hull --------------------------------------------------------------
function sectionOf(P, x) {
  const xs = P.xs, LA = P.L - P.xs;
  let yk, b, beta, body;
  if (x <= 0) {
    body = 'F';
    const ahead = -x;
    if (ahead <= P.xFlat) yk = 0;
    else { const t = (ahead - P.xFlat) / Math.max(1e-6, xs - P.xFlat); yk = P.yBow * t * t; }
    const tb = Math.min(1, ahead / xs);
    b = P.bBow + (P.B / 2 - P.bBow) * (1 - tb * tb * tb);
    beta = P.beta;
  } else {
    body = 'A';
    yk = P.hs + x * Math.tan(P.aftAngle * D2R);
    b = (P.B / 2) * (1 - (1 - P.bStern) * Math.min(1, x / LA));
    beta = P.betaA;
  }
  const hc = b * Math.tan(beta * D2R);
  // the deck is LEVEL across the step (the afterbody's sides are hs shorter)
  // and follows the sheer where the bow's chine climbs above it
  const yDeck = (P.B / 2) * Math.tan(P.beta * D2R) + P.hSide;
  return { x, yk, b, beta, hc, body, yc: yk + hc, yd: Math.max(yk + hc + 0.03, yDeck) };
}

function makeFloat(over = {}) {
  const P = Object.assign({}, DEF, over);
  const V = [], panels = [];
  const push = p => { V.push(p); return V.length - 1; };
  const LA = P.L - P.xs;
  const nF = Math.max(3, Math.round(P.nSta * P.xs / P.L)), nA = Math.max(3, P.nSta - nF);
  // stations: forebody bow..step (x=0-), afterbody step (x=0+)..stern
  const sta = [];
  for (let i = 0; i <= nF; i++) sta.push(sectionOf(P, -P.xs + (P.xs * i) / nF));
  for (let i = 0; i <= nA; i++) sta.push(sectionOf(P, 1e-9 + (LA * i) / nA));
  // each station's vertices: K, C-, C+, D-, D+   (- = port z<0, + = starboard)
  for (const s of sta) {
    s.K = push([s.x, s.yk, 0]);
    s.Cm = push([s.x, s.yc, -s.b]); s.Cp = push([s.x, s.yc, s.b]);
    s.Dm = push([s.x, s.yd, -s.b]); s.Dp = push([s.x, s.yd, s.b]);
    s.ref = [s.x, 0.5 * (s.yk + s.yd), 0];
  }
  // EVERY PANEL IS PLANAR: a lofted quad's keel and chine edges have
  // different slopes, so it is split on its diagonal into two triangles
  // (the clip is then exact, and the pressure's direction with it); the
  // slice's slam is shared between the pair
  const tri = (kind, a, b, c, meta) => panels.push(Object.assign({ kind, v: [a, b, c], slamW: 1 }, meta));
  const quad = (kind, a, b, c, d, meta) => {
    panels.push(Object.assign({ kind, v: [a, b, c], slamW: 0.5 }, meta));
    panels.push(Object.assign({ kind, v: [a, c, d], slamW: 0.5 }, meta));
  };
  for (let i = 0; i + 1 < sta.length; i++) {
    const s0 = sta[i], s1 = sta[i + 1];
    if (s0.body !== s1.body) {
      // THE STEP FACE: the forebody's section to the afterbody's at the same
      // x. It faces AFT: the hull's interior is on its forebody side, so the
      // orienting reference sits just ahead of it (at +0.02 it sat inside the
      // afterbody and every step face came out inward: the closure sum read
      // -2x their area and a level float felt 71 N fore-aft at rest)
      const rs = [-0.02, 0.5 * (s0.yk + s0.yd), 0];
      quad('step', s0.K, s1.K, s1.Cm, s0.Cm, { side: -1, body: 'A', beta: 0, ref: rs });
      quad('step', s0.K, s1.K, s1.Cp, s0.Cp, { side: 1, body: 'A', beta: 0, ref: rs });
      tri('step', s0.Cm, s1.Cm, s0.Dm, { side: -1, body: 'A', beta: 0, ref: rs });
      tri('step', s0.Cp, s1.Cp, s0.Dp, { side: 1, body: 'A', beta: 0, ref: rs });
      continue;
    }
    const m = { body: s0.body, ref: [0.5 * (s0.x + s1.x), 0.5 * (s0.ref[1] + s1.ref[1]), 0], x0: s0.x, x1: s1.x };
    const bk = s0.body === 'F' ? 'bottomF' : 'bottomA';
    quad(bk, s0.K, s1.K, s1.Cm, s0.Cm, Object.assign({ side: -1, beta: 0.5 * (s0.beta + s1.beta) }, m));
    quad(bk, s0.K, s1.K, s1.Cp, s0.Cp, Object.assign({ side: 1, beta: 0.5 * (s0.beta + s1.beta) }, m));
    quad('side', s0.Cm, s1.Cm, s1.Dm, s0.Dm, Object.assign({ side: -1, beta: 0 }, m));
    quad('side', s0.Cp, s1.Cp, s1.Dp, s0.Dp, Object.assign({ side: 1, beta: 0 }, m));
    quad('deck', s0.Dm, s1.Dm, s1.Dp, s0.Dp, Object.assign({ side: 0, beta: 0 }, m));
  }
  { // bow cap and stern transom
    const s = sta[0];
    tri('bow', s.K, s.Cm, s.Cp, { side: 0, body: 'F', beta: 0, ref: [s.x + 0.05, s.ref[1], 0] });
    quad('bow', s.Cm, s.Cp, s.Dp, s.Dm, { side: 0, body: 'F', beta: 0, ref: [s.x + 0.05, s.ref[1], 0] });
    const e = sta[sta.length - 1];
    tri('stern', e.K, e.Cm, e.Cp, { side: 0, body: 'A', beta: 0, ref: [e.x - 0.05, e.ref[1], 0] });
    quad('stern', e.Cm, e.Cp, e.Dp, e.Dm, { side: 0, body: 'A', beta: 0, ref: [e.x - 0.05, e.ref[1], 0] });
  }
  // orient every panel OUTWARD (its normal away from the section's interior
  // point), and record the rest normal, area and centroid in the float frame
  for (const pn of panels) {
    const a = V[pn.v[0]], b = V[pn.v[1]], c = V[pn.v[2]];
    const n = cross(sub(b, a), sub(c, a));
    const cen = v3(); for (const vi of pn.v) add(cen, V[vi], cen); scl(cen, 1 / pn.v.length, cen);
    if (dot(n, sub(cen, pn.ref)) < 0) pn.v.reverse();
    pn.n0 = polyNormal(pn.v.map(i => V[i]));
    pn.area0 = polyArea(pn.v.map(i => V[i]));
    pn.c0 = cen;
    pn.id = panels.indexOf(pn);
  }
  // mass, CG, inertia (about the combined CG, float frame). The float as a
  // uniform box of its own bounding size, the load as a point mass with its
  // own declared inertia; both shifted by the parallel axis.
  const m = P.mFloat + P.mLoad;
  const cg = [0, 0, 0];
  for (let k = 0; k < 3; k++) cg[k] = (P.mFloat * P.cgFloat[k] + P.mLoad * P.cgLoad[k]) / m;
  const H = Math.max(...sta.map(s => s.yd)) - Math.min(...sta.map(s => s.yk));
  const If = [P.mFloat / 12 * (H * H + P.B * P.B), P.mFloat / 12 * (P.L * P.L + P.B * P.B), P.mFloat / 12 * (P.L * P.L + H * H)];
  const I = [0, 0, 0];
  const shift = (mm, c, Ii) => {
    const d = sub(c, cg);
    I[0] += Ii[0] + mm * (d[1] * d[1] + d[2] * d[2]);
    I[1] += Ii[1] + mm * (d[0] * d[0] + d[2] * d[2]);
    I[2] += Ii[2] + mm * (d[0] * d[0] + d[1] * d[1]);
  };
  shift(P.mFloat, P.cgFloat, If); shift(P.mLoad, P.cgLoad, P.loadI);
  // the step edge: the forebody's last station (x = 0-), keel and chines
  const sF = sta[nF], sA = sta[nF + 1];
  const edge = { K: sF.K, Cm: sF.Cm, Cp: sF.Cp, KA: sA.K, hcStep: sF.hc };
  const sE = sta[sta.length - 1];
  const stern = { K: sE.K, Cm: sE.Cm, Cp: sE.Cp, Dm: sE.Dm, Dp: sE.Dp };
  // the hull's displacement to the deck, for the freeboard line
  let volDeck = 0;
  for (let i = 0; i + 1 < sta.length; i++) if (sta[i].body === sta[i + 1].body)
    volDeck += 0.5 * (secArea(sta[i]) + secArea(sta[i + 1])) * (sta[i + 1].x - sta[i].x);
  return { P, V, panels, sta, m, cg, I, edge, stern, volDeck, nF, nA,
           xBow: -P.xs, xStern: LA, b: P.B / 2 };
}
const secArea = s => s.b * s.hc + 2 * s.b * (s.yd - s.yc);

function polyNormal(pts) {
  const n = v3();
  for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length];
    n[0] += (a[1] - b[1]) * (a[2] + b[2]); n[1] += (a[2] - b[2]) * (a[0] + b[0]); n[2] += (a[0] - b[0]) * (a[1] + b[1]); }
  return nrm(n);
}
function polyArea(pts) {
  const n = v3();
  for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length];
    n[0] += (a[1] - b[1]) * (a[2] + b[2]); n[1] += (a[2] - b[2]) * (a[0] + b[0]); n[2] += (a[0] - b[0]) * (a[1] + b[1]); }
  return 0.5 * len(n);
}

// ---- the free surface ------------------------------------------------------
// h(x, z, t): still water at y = 0 by default. `gerstner` is the shared-
// surface shape the design asks for (§2.5), here so the panel model is
// exercised on a surface that moves; the world's own waterH is the one the
// game will pass.
const stillWater = { h: () => 0, v: () => [0, 0, 0] };
function gerstner(waves) {
  // waves: [{A, L, dir: [dx, dz], phase}] deep-water, additive heights
  const W = waves.map(w => ({ A: w.A, k: 2 * Math.PI / w.L, om: Math.sqrt(G * 2 * Math.PI / w.L),
                              d: nrm([w.dir[0], 0, w.dir[1]]), ph: w.phase || 0 }));
  return {
    h: (x, z, t) => { let y = 0; for (const w of W) y += w.A * Math.cos(w.k * (w.d[0] * x + w.d[2] * z) - w.om * t + w.ph); return y; },
    v: () => [0, 0, 0],
    waves: W,
  };
}

// ---- the body --------------------------------------------------------------
function makeBody(F, o = {}) {
  const S = {
    p: o.p ? o.p.slice() : [0, o.y != null ? o.y : 0.3, 0],   // CG, world
    R: o.R ? o.R.slice() : rotPitch((o.trim || 0) * D2R),
    v: o.v ? o.v.slice() : [0, 0, 0],
    w: o.w ? o.w.slice() : [0, 0, 0],
    lockRoll: o.lockRoll !== false, lockYaw: o.lockYaw !== false, lockPitch: !!o.lockPitch,
    t: 0,
  };
  // p is the CG: place so that the step's keel point is at the given height
  if (o.keelY != null) {
    const kq = matVec(S.R, sub(F.V[F.edge.K], F.cg));
    S.p[1] = o.keelY - kq[1];
  }
  return S;
}

// ---- the force pass --------------------------------------------------------
// out: { F, tau, terms: {static, plan, fric, cross, slam}, panels: [...] }
function makeScratch(F) {
  return {
    W: F.V.map(() => v3()),      // world vertices
    d: new Float64Array(F.V.length),
    dq: F.V.map(() => v3()),     // float-frame position (for x aft of the step)
    per: F.panels.map(() => ({ wet: 0, A: 0, c: v3(), cp: v3(), n: v3(), AN: v3(), pN: v3(), d: 0, p: 0,
                               Fs: v3(), Fp: v3(), Ff: v3(), Fx: v3(), Fm: v3(), Fr: v3(), Fk: v3(), poly: [], depth: [] })),
    F: v3(), tau: v3(),
    terms: { static: v3(), plan: v3(), fric: v3(), cross: v3(), slam: v3(), rad: v3(), suck: v3() },
  };
}

function hydroForces(F, S, water, out, opt = {}) {
  if (!S._ctx || S._ctx.F !== F) S._ctx = rigidCtx(F, S);
  return hydroPanels(F, S._ctx, water, S.t, out, opt);
}
// the rigid body's provider: the bench, the H0 check
function rigidCtx(F, S) {
  const ctx = { F, W: null, xhat: v3(), vH: v3(), p: S.p };
  ctx.fill = W => {
    const R = S.R, p = S.p;
    ctx.xhat[0] = R[0]; ctx.xhat[1] = R[3]; ctx.xhat[2] = R[6];
    ctx.vH[0] = S.v[0]; ctx.vH[1] = 0; ctx.vH[2] = S.v[2];
    for (let i = 0; i < F.V.length; i++) { const q = sub(F.V[i], F.cg); matVec(R, q, W[i]); add(W[i], p, W[i]); }
  };
  ctx.velAt = (pt, o) => { const r = sub(pt, S.p); cross(S.w, r, o); return add(o, S.v, o); };
  ctx.toLocal = (pt, o) => { matTVec(S.R, sub(pt, S.p), o); return add(o, F.cg, o); };
  return ctx;
}
function hydroPanels(F, ctx, water, t, out, opt = {}) {
  const P = F.P, rho = P.rho, V = F.V;
  const W = out.W, D = out.d;
  // 1. world vertices, the aft axis and the reference velocity, from the pose
  ctx.fill(W);
  const xhat = ctx.xhat, p = ctx.p;
  // 2. the step edge: its world height, its flow speed, the air that reaches it
  const eK = W[F.edge.K];
  const vE = ctx.velAt(eK, v3());
  const Vflow = Math.max(0.3, -dot(vE, xhat) + dot(water.v(eK[0], eK[2], t), xhat));   // water aft over the hull
  const dChine = 0.5 * ((water.h(W[F.edge.Cm][0], W[F.edge.Cm][2], t) - W[F.edge.Cm][1]) +
                        (water.h(W[F.edge.Cp][0], W[F.edge.Cp][2], t) - W[F.edge.Cp][1]));
  const hEdge = water.h(eK[0], eK[2], t);
  const dEdge = hEdge - eK[1];
  // the step ventilates when AIR reaches it (the chine's depth ramp) AND the
  // flow can hold a cavity open against the head at the edge: the cavity
  // number sigma = 2 g dEdge / V^2 below 1 (a level float at rest with its
  // chine a centimetre clear read a dry first afterbody slice without this
  // second factor - 3 % of Archimedes gone at draft 0.12)
  const sigma = 2 * G * dEdge / (Vflow * Vflow);
  const sep = smooth01(1 - sigma);                 // the flow leaves the edge
  // ...and air can follow it: the cavity behind the step is hs deep and open
  // at the chine line, so the water at the side must be within hs + dVent
  // of the surface there
  const air = smooth01(1 - (dChine - P.hs) / P.dVent);
  const vent = air * sep;
  const lr = Math.max(0.02, P.kWake * Vflow * Vflow / G);
  // the stern transom's own: its chines are higher, so it usually has air
  const sK = W[F.stern.K];
  // (a transom is open to the sky: its air comes over the deck edge)
  const dSternChine = 0.5 * ((water.h(W[F.stern.Dm][0], W[F.stern.Dm][2], t) - W[F.stern.Dm][1]) +
                             (water.h(W[F.stern.Dp][0], W[F.stern.Dp][2], t) - W[F.stern.Dp][1]));
  const dStern = water.h(sK[0], sK[2], t) - sK[1];
  const sepStern = smooth01(1 - 2 * G * Math.max(0, dStern) / (Vflow * Vflow));
  const airStern = smooth01(1 - dSternChine / P.dVent);
  const ventStern = airStern * sepStern;
  out.sep = sep; out.air = air; out.sepStern = sepStern; out.airStern = airStern; out.ventStern = ventStern;
  out.vent = vent; out.Vflow = Vflow; out.dEdge = dEdge; out.lr = lr;
  // the CG's horizontal velocity is the steady motion; what is left of a
  // panel's velocity after it is the UNSTEADY entry the slam is computed on
  const vH = ctx.vH;
  // 3. signed depth per vertex — with the WAKE under everything aft of the step
  for (let i = 0; i < V.length; i++) {
    const x = V[i][0];
    let h = water.h(W[i][0], W[i][2], t);
    if (x > 0) {
      const dx = Math.max(0, x);
      const yW = eK[1] + dx * xhat[1] - 0.5 * G * (dx / Vflow) * (dx / Vflow);
      const drop = Math.max(0, h - yW) * Math.exp(-dx / lr);
      h -= vent * drop;
    }
    D[i] = h - W[i][1];
  }
  // 4. clip every panel; the wet leading edge per (body, side) row
  const LE = { F: { '-1': [Infinity, Infinity], '1': [Infinity, Infinity] }, A: { '-1': [Infinity, Infinity], '1': [Infinity, Infinity] } };
  const per = out.per;
  let wetF = 0, wetA = 0, wetOther = 0;
  for (let k = 0; k < F.panels.length; k++) {
    const pn = F.panels[k], o = per[k];
    o.wet = 0; o.A = 0; o.p = 0; o.d = 0;
    for (const key of ['Fs', 'Fp', 'Ff', 'Fx', 'Fm', 'Fr', 'Fk']) { o[key][0] = o[key][1] = o[key][2] = 0; }
    clipPoly(pn.v, W, D, o);
    if (o.A <= 1e-9) { o.poly.length = 0; continue; }
    o.wet = 1;
    // the outward normal of the wet polygon itself (planar: the rest normal rotated)
    o.n[0] = o.AN[0]; o.n[1] = o.AN[1]; o.n[2] = o.AN[2]; nrm(o.n);
    if (pn.kind === 'bottomF' || pn.kind === 'bottomA') {
      const row = LE[pn.body][String(pn.side)];
      for (let j = 0; j < o.poly.length; j++) {
        const q = o.poly[j];
        // float-frame position of the wet vertex
        const ql = ctx.toLocal(q, v3());
        const b = halfBeamAt(F, ql[0]);
        const f = b > 1e-6 ? Math.min(1, Math.abs(ql[2]) / b) : 0;
        if (f < 0.35 && ql[0] < row[0]) row[0] = ql[0];
        if (f > 0.65 && ql[0] < row[1]) row[1] = ql[0];
      }
      if (pn.body === 'F') wetF += o.A; else wetA += o.A;
    } else wetOther += o.A;
  }
  out.wetF = wetF; out.wetA = wetA; out.wetOther = wetOther;
  // 5. forces
  const Ft = out.F, Tt = out.tau, T = out.terms;
  Ft[0] = Ft[1] = Ft[2] = 0; Tt[0] = Tt[1] = Tt[2] = 0;
  for (const key in T) T[key][0] = T[key][1] = T[key][2] = 0;
  const vc = v3(), u = v3(), ut = v3(), r = v3(), fv = v3(), tq = v3(), uu = v3();
  const apply = (Fv, at, acc) => {
    add(Ft, Fv, Ft); add(acc, Fv, acc);
    sub(at, p, r); cross(r, Fv, tq); add(Tt, tq, Tt);
  };
  let cEffMax = 0, slamMax = 0;
  for (let k = 0; k < F.panels.length; k++) {
    const pn = F.panels[k], o = per[k];
    if (!o.wet) continue;
    const n = o.n, A = o.A, isBottom = pn.kind === 'bottomF' || pn.kind === 'bottomA';
    // panel velocity at its wet centroid; the water's relative velocity u
    ctx.velAt(o.c, vc); sub(o.c, p, r);
    const wv = water.v(o.c[0], o.c[2], t);
    sub(wv, vc, u);
    const Vn = -dot(u, n);                         // the panel's speed INTO the water (> 0 entering)
    const un = dot(u, n); ut[0] = u[0] - un * n[0]; ut[1] = u[1] - un * n[1]; ut[2] = u[2] - un * n[2];
    const Vt = len(ut);
    // the float-frame x of the centroid: distance to the trailing edge, and to the wet leading edge
    const cl = ctx.toLocal(o.c, v3());
    const xTE = pn.body === 'F' ? 0 : F.xStern;
    const sTE = Math.max(0, xTE - cl[0]);
    let fTr = 1;
    if (isBottom) {
      const Lf = P.kTr * Vt * Vt / G, vt = pn.body === 'F' ? vent : ventStern;
      fTr = Lf > 1e-6 ? 1 - vt * Math.exp(-sTE / Lf) : 1;
    }
    // (1) hydrostatic on the wet polygon (the depth-weighted vector area), at the pressure centroid
    // (3d) ...and behind a separated edge that no air has reached, the step
    // face and the transom feel the water-filled wake's base pressure on top
    let sepK = 0;
    if (pn.kind === 'step') sepK = sep * (1 - air);
    else if (pn.kind === 'stern') sepK = sepStern * (1 - airStern);
    scl(o.pN, -rho * G * fTr, fv);
    apply(fv, o.cp, T.static); add(o.Fs, fv, o.Fs);
    if (sepK > 0) {
      // a suction: the pressure is BELOW atmospheric, so it pulls the face outward (+n)
      scl(o.AN, -P.CpBase * 0.5 * rho * Vflow * Vflow * sepK, fv);
      apply(fv, o.c, T.suck); add(o.Fk, fv, o.Fk);
    }
    // the wet leading edge distance s for this centroid
    let s = 0.05;
    if (isBottom) {
      const row = LE[pn.body][String(pn.side)];
      const b = halfBeamAt(F, cl[0]);
      const f = b > 1e-6 ? Math.min(1, Math.abs(cl[2]) / b) : 0;
      const xk = Number.isFinite(row[0]) ? row[0] : pn.body === 'F' ? F.xBow : 0;
      const xc = Number.isFinite(row[1]) ? row[1] : xTE;      // chine dry: its edge is at the trailing end
      const xle = xk + f * (xc - xk);
      s = Math.max(0.01, cl[0] - xle);
    } else {
      s = Math.max(0.05, cl[0] - F.xBow);
    }
    // (2) the dynamic pressure
    const V2 = Vn * Vn + Vt * Vt;
    if (V2 > 1e-4) {
      if (isBottom) {
        if (Vn > 0) {
          const cb = Math.cos(pn.beta * D2R);
          const alpha = Math.min(Math.PI / 2, Math.atan2(Vn, Vt) / cb);
          const kB = Math.max(0.3, 1 - P.kBeta * pn.beta);
          const gS = 1 / (2 * Math.sqrt(s / P.B + P.xi0));
          const sa = Math.sin(alpha);
          const cPl = P.Cpl * kB * sa * gS, cNw = 0.5 * P.Cd * sa * sa;
          const pd = rho * V2 * Math.sqrt(cPl * cPl + cNw * cNw);
          scl(o.AN, -pd, fv);
          apply(fv, o.c, T.plan); add(o.Fp, fv, o.Fp);
        }
      } else if (pn.kind !== 'deck' || Vn > 0) {
        const sym = pn.kind === 'side' || pn.kind === 'bow';
        const pd = 0.5 * rho * P.Cd * (sym ? Vn * Math.abs(Vn) : Math.max(0, Vn) * Vn);
        scl(o.AN, -pd, fv);
        apply(fv, o.c, T.cross); add(o.Fx, fv, o.Fx);
      }
      // (3) skin friction along the flow, ITTC-57
      if (Vt > 0.01) {
        const Re = Math.max(1e4, Vt * s / NU);
        const lg = Math.log10(Re) - 2;
        const Cf = 0.075 / (lg * lg);
        scl(ut, 0.5 * rho * Cf * Vt * A, fv);   // ut is already Vt * direction
        apply(fv, o.c, T.fric); add(o.Ff, fv, o.Ff);
      }
    }
    // (3c) wave radiation damping — the energy a heaving hull sends away as
    // waves, linear in the normal velocity: p = kRad rho sqrt(g B) Vn on the
    // bottom. kRad sits where the 2D heaving-section damping curve
    // (b33 / rho B^2 sqrt(g/B) ~ 0.5 near omega sqrt(B/g) = 1, falling as
    // omega^-3) reads at this float's own heave frequency (omega sqrt(B/g)
    // ~ 3.4): INFERRED, and stated so. Measured before it: zeta 0.016 on
    // the settle — the quadratic terms alone hardly touch a small bob.
    if (isBottom && P.kRad > 0) {
      scl(o.AN, -P.kRad * rho * Math.sqrt(G * P.B) * Vn, fv);
      apply(fv, o.c, T.rad); add(o.Fr, fv, o.Fr);
    }
    // (4) slam: wedge entry, on the keel depth of this slice, entering only —
    // the entry velocity is the UNSTEADY one (see the header)
    sub(vc, vH, uu); sub(wv, uu, uu);
    const VnU = -dot(uu, n);
    if (isBottom && VnU > 0) {
      let dk = 0, nk = 0;
      for (let j = 0; j < pn.v.length; j++) if (Math.abs(V[pn.v[j]][2]) < 1e-9) { dk += D[pn.v[j]]; nk++; }
      dk = nk ? dk / nk : 0;
      if (dk > 0) {
        const tb = Math.tan(pn.beta * D2R), cb = Math.cos(pn.beta * D2R);
        const bHalf = halfBeamAt(F, cl[0]);
        const c = Math.min(bHalf, P.kw * dk / tb);
        const dcdd = c < bHalf ? P.kw / tb : 0;
        const lx = Math.abs((pn.x1 != null ? pn.x1 : 0) - (pn.x0 != null ? pn.x0 : 0));
        const Vv = VnU / cb;
        let Fm = (pn.slamW || 1) * 0.5 * rho * Math.PI * c * dcdd * Vv * Vv * lx / cb;   // along -n, one side
        const cEff = VnU > 1e-6 ? 2 * Fm / VnU : 0;
        if (cEff > cEffMax) cEffMax = cEff;
        // the semi-implicit bound: one substep may not hand a node more
        // normal momentum than it has (opt.mNode, opt.dt from the caller)
        if (P.slamCap && opt.mNode && opt.dt) Fm = Math.min(Fm, opt.mNode * VnU / opt.dt);
        if (Fm > slamMax) slamMax = Fm;
        scl(n, -Fm, fv);
        apply(fv, o.c, T.slam); add(o.Fm, fv, o.Fm);
      }
    }
  }
  out.cEffMax = cEffMax; out.slamMax = slamMax;
  return out;
}
function halfBeamAt(F, x) { return sectionOf(F.P, Math.min(F.xStern, Math.max(F.xBow, x))).b; }

// Sutherland-Hodgman on d >= 0 over the panel's corners; fills o.poly (wet
// vertices), o.depth, o.A (wet area), o.c (area centroid), o.p (integral of
// depth over the area), o.cp (the depth-weighted centroid = centre of pressure)
function clipPoly(idx, W, D, o) {
  const poly = o.poly, dep = o.depth; poly.length = 0; dep.length = 0;
  const n = idx.length;
  for (let i = 0; i < n; i++) {
    const a = idx[i], b = idx[(i + 1) % n], da = D[a], db = D[b];
    if (da >= 0) { poly.push(W[a]); dep.push(da); }
    if ((da >= 0) !== (db >= 0)) {
      const t = da / (da - db);
      const A = W[a], B = W[b];
      poly.push([A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t]); dep.push(0);
    }
  }
  o.A = 0; o.p = 0;
  const AN = o.AN, pN = o.pN;
  AN[0] = AN[1] = AN[2] = 0; pN[0] = pN[1] = pN[2] = 0;
  if (poly.length < 3) return;
  // triangle fan; depth is linear over each triangle. AN is the VECTOR area
  // (a uniform pressure integrates to p*AN exactly), pN the depth-weighted
  // one (the hydrostatic force is -rho g pN: Gauss, exactly, per triangle)
  const c = o.c, cp = o.cp;
  c[0] = c[1] = c[2] = 0; cp[0] = cp[1] = cp[2] = 0;
  const q0 = poly[0], d0 = dep[0];
  for (let i = 1; i + 1 < poly.length; i++) {
    const q1 = poly[i], q2 = poly[i + 1], d1 = dep[i], d2 = dep[i + 1];
    const e1 = sub(q1, q0), e2 = sub(q2, q0), cr = cross(e1, e2);
    const A = 0.5 * len(cr);
    if (A < 1e-12) continue;
    o.A += A;
    const dm = (d0 + d1 + d2) / 3;
    o.p += A * dm;
    for (let k = 0; k < 3; k++) {
      AN[k] += 0.5 * cr[k]; pN[k] += 0.5 * cr[k] * dm;
      c[k] += A * (q0[k] + q1[k] + q2[k]) / 3;
      // integral of d * r over a triangle with linear d: A/12 * sum_i sum_j (1 + delta_ij) d_i r_j
      cp[k] += A / 12 * ((2 * d0 + d1 + d2) * q0[k] + (d0 + 2 * d1 + d2) * q1[k] + (d0 + d1 + 2 * d2) * q2[k]);
    }
  }
  if (o.A > 1e-12) { scl(c, 1 / o.A, c); if (o.p > 1e-12) scl(cp, 1 / o.p, cp); else { cp[0] = c[0]; cp[1] = c[1]; cp[2] = c[2]; } }
  o.d = o.A > 0 ? o.p / o.A : 0;
}

// ---- the rigid body's step -------------------------------------------------
// ext: { F: [..], tau: [..], vxHold: number|null, lift: N (world +y at the CG),
//        tail: { K, C, th0, Vref } — the aeroplane's tail as a pitch spring
//        K (N m/rad at Vref) and damper C (N m s/rad at Vref) about a trim
//        th0 (rad), scaled by (V/Vref)^2 and V/Vref: what holds a
//        floatplane's attitude on the water is in the air, not the float }
function bodyStep(F, S, dt, water, out, ext = {}, opt = {}) {
  hydroForces(F, S, water, out, opt);
  const Fw = [out.F[0], out.F[1] - F.m * G, out.F[2]];
  if (ext.F) add(Fw, ext.F, Fw);
  if (ext.lift) Fw[1] += ext.lift;
  const tau = [out.tau[0], out.tau[1], out.tau[2]];
  if (ext.tau) add(tau, ext.tau, tau);
  if (ext.tail) {
    const T = ext.tail, Vr = Math.hypot(S.v[0], S.v[2]) / (T.Vref || 16);
    const trim = Math.asin(Math.max(-1, Math.min(1, -S.R[3])));   // nose-up +
    const qUp = -S.w[2];                                          // nose-up rate
    const Mup = -T.K * Vr * Vr * (trim - (T.th0 || 0)) - T.C * Vr * qUp;
    tau[2] -= Mup;
    out.Mtail = Mup;
  }
  // angular: body frame, diagonal inertia
  const R = S.R;
  const wb = matTVec(R, S.w), tb = matTVec(R, tau);
  const Iw = [F.I[0] * wb[0], F.I[1] * wb[1], F.I[2] * wb[2]];
  const gyro = cross(wb, Iw);
  const ab = [(tb[0] - gyro[0]) / F.I[0], (tb[1] - gyro[1]) / F.I[1], (tb[2] - gyro[2]) / F.I[2]];
  if (S.lockRoll) { ab[0] = 0; wb[0] = 0; }
  if (S.lockYaw) { ab[1] = 0; wb[1] = 0; }
  if (S.lockPitch) { ab[2] = 0; wb[2] = 0; }
  wb[0] += ab[0] * dt; wb[1] += ab[1] * dt; wb[2] += ab[2] * dt;
  matVec(R, wb, S.w);
  S.v[0] += Fw[0] / F.m * dt; S.v[1] += Fw[1] / F.m * dt; S.v[2] += Fw[2] / F.m * dt;
  if (ext.vxHold != null) S.v[0] = -ext.vxHold;     // the carriage: forward is -x
  if (S.lockYaw) S.v[2] = 0;
  S.p[0] += S.v[0] * dt; S.p[1] += S.v[1] * dt; S.p[2] += S.v[2] * dt;
  const Rn = matMul(rotExp(S.w, dt), R);
  orthonormalise(Rn);
  for (let i = 0; i < 9; i++) R[i] = Rn[i];
  S.t += dt;
  return out;
}

// readings off a state: trim (nose-up +), the step keel's draft, the CG height
function readState(F, S, water) {
  const R = S.R, xhat = [R[0], R[3], R[6]];
  const trim = Math.asin(Math.max(-1, Math.min(1, -xhat[1])));
  const kq = add(matVec(R, sub(F.V[F.edge.K], F.cg)), S.p);
  const h = water.h(kq[0], kq[2], S.t);
  const roll = Math.asin(Math.max(-1, Math.min(1, R[7])));   // y-axis's z component
  return { trim, trimDeg: trim / D2R, draft: h - kq[1], keelY: kq[1], cgY: S.p[1], roll, rollDeg: roll / D2R, vx: -S.v[0], vy: S.v[1] };
}

// ---- Monte-Carlo submerged volume: the independent arbiter --------------------
// Points sampled in the hull's float-frame box, tested inside by ray parity
// against the hull's own triangles, and below the water by their world
// height. Deterministic (mulberry32). Not the clipper's arithmetic.
function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function hullTriangles(F) {
  const T = [];
  for (const pn of F.panels) for (let i = 1; i + 1 < pn.v.length; i++) T.push([F.V[pn.v[0]], F.V[pn.v[i]], F.V[pn.v[i + 1]]]);
  return T;
}
function rayHitsZ(q, tri) {
  // ray from q along +z; Moller-Trumbore
  const [a, b, c] = tri;
  const e1 = sub(b, a), e2 = sub(c, a);
  const dir = [0, 0, 1];
  const pv = cross(dir, e2), det = dot(e1, pv);
  if (Math.abs(det) < 1e-12) return false;
  const inv = 1 / det, tv = sub(q, a);
  const u = dot(tv, pv) * inv; if (u < 0 || u > 1) return false;
  const qv = cross(tv, e1);
  const v = dot(dir, qv) * inv; if (v < 0 || u + v > 1) return false;
  const t = dot(e2, qv) * inv;
  return t > 1e-9;
}
function submergedVolumeMC(F, S, water, N = 20000, seed = 7) {
  const T = hullTriangles(F);
  let lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  for (const v of F.V) for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], v[k]); hi[k] = Math.max(hi[k], v[k]); }
  const rnd = mulberry32(seed);
  let inside = 0, wet = 0;
  const q = v3(), qw = v3();
  for (let i = 0; i < N; i++) {
    q[0] = lo[0] + (hi[0] - lo[0]) * rnd(); q[1] = lo[1] + (hi[1] - lo[1]) * rnd(); q[2] = lo[2] + (hi[2] - lo[2]) * rnd();
    let hits = 0;
    for (const tri of T) if (rayHitsZ(q, tri)) hits++;
    if (!(hits & 1)) continue;
    inside++;
    matVec(S.R, sub(q, F.cg), qw); add(qw, S.p, qw);
    if (qw[1] < water.h(qw[0], qw[2], S.t)) wet++;
  }
  const box = (hi[0] - lo[0]) * (hi[1] - lo[1]) * (hi[2] - lo[2]);
  return { vol: box * wet / N, hull: box * inside / N, n: N, wet, inside };
}

// ---- the experiments -------------------------------------------------------
// Each returns { step(), done, log, S, out, F } and runs at 60 fps x sub.
function expDrop(F, o = {}) {
  const water = o.water || stillWater, sub_ = o.sub || 45, dt = 1 / (60 * sub_);
  const S = makeBody(F, { keelY: o.keelY != null ? o.keelY : 0.3, trim: o.trim || 0, lockRoll: o.lockRoll, lockYaw: o.lockYaw, lockPitch: o.lockPitch });
  const out = makeScratch(F), log = [];
  const tEnd = o.tEnd || 6;
  let frame = 0;
  const E = { F, S, out, water, dt, sub: sub_, log, done: false,
    step() {
      for (let s = 0; s < sub_; s++) bodyStep(F, S, dt, water, out, {}, { mNode: o.mNode, dt });
      const r = readState(F, S, water);
      log.push({ t: S.t, draft: r.draft, trim: r.trimDeg, cgY: r.cgY, Fy: out.F[1], Fs: out.terms.static[1], Fm: out.terms.slam[1], Fp: out.terms.plan[1], vy: r.vy, wetF: out.wetF, wetA: out.wetA });
      frame++;
      if (S.t >= tEnd) E.done = true;
      return r;
    } };
  return E;
}
// the tow: the carriage holds the surge speed, ramping it; heave and pitch free
function expTow(F, o = {}) {
  const water = o.water || stillWater, sub_ = o.sub || 24, dt = 1 / (60 * sub_);
  // o.trim (deg) with o.fixedTrim: the NACA tank's way — the model held at a
  // trim, free to heave, the load on the water following the wing's lift
  const S = makeBody(F, { keelY: -0.25, trim: o.trim || 0, lockRoll: o.lockRoll, lockYaw: o.lockYaw, lockPitch: !!o.fixedTrim });
  const out = makeScratch(F), log = [];
  const V0 = o.V0 || 0, V1 = o.V1 || 24, rate = o.rate || 0.5, tSettle = o.tSettle || 3;
  // unload as a wing would: lift = W (V/Vlo)^2, capped at W - a stated option
  const Vlo = o.Vlo || 0;
  const tail = o.tail ? Object.assign({ K: 1700, C: 470, th0: (o.trim || 0) * D2R, Vref: 16 }, o.tail === true ? {} : o.tail) : null;
  let V = V0, ext = { vxHold: V0, lift: 0, tail };
  const E = { F, S, out, water, dt, sub: sub_, log, done: false, V: () => V,
    step() {
      if (S.t > tSettle) V = Math.min(V1, V0 + rate * (S.t - tSettle));
      ext.vxHold = V;
      ext.lift = Vlo > 0 ? Math.min(0.95 * F.m * G, F.m * G * (V / Vlo) * (V / Vlo)) : 0;
      for (let s = 0; s < sub_; s++) bodyStep(F, S, dt, water, out, ext, { mNode: o.mNode, dt });
      const r = readState(F, S, water);
      const T = out.terms;
      log.push({ t: S.t, V, R: out.F[0], Rs: T.static[0], Rp: T.plan[0], Rf: T.fric[0], Rx: T.cross[0], Rm: T.slam[0], Rk: T.suck[0],
                 L: out.F[1], Ls: T.static[1], Lp: T.plan[1], trim: r.trimDeg, draft: r.draft, cgY: r.cgY,
                 wetF: out.wetF, wetA: out.wetA, vent: out.vent, sep: out.sep, lift: ext.lift, Mz: out.tau[2] });
      if (V >= V1 && S.t > tSettle + (V1 - V0) / rate + 2) E.done = true;
      return r;
    } };
  return E;
}
// the landing: flying at Vx with the wing carrying `liftK` of the weight,
// sinking at `sink`, trimmed by the tail (o.tail, default a Cub's half);
// from the touch the float decelerates under its own drag and the wing's
// lift falls as V^2 (o.hold keeps the carriage on instead); heave and
// pitch free
function expLand(F, o = {}) {
  const water = o.water || stillWater, sub_ = o.sub || 45, dt = 1 / (60 * sub_);
  const Vx = o.Vx || 16, sink = o.sink || 1.0, liftK = o.liftK != null ? o.liftK : 0.85;
  const S = makeBody(F, { keelY: o.keelY != null ? o.keelY : 0.25, trim: o.trim != null ? o.trim : 4, lockRoll: o.lockRoll, lockYaw: o.lockYaw, lockPitch: o.lockPitch });
  S.v[0] = -Vx; S.v[1] = -sink;
  const out = makeScratch(F), log = [];
  const tail = o.tail === null ? null : Object.assign({ K: 1700, C: 470, th0: (o.trim != null ? o.trim : 4) * D2R, Vref: Vx }, o.tail || {});
  const ext = { vxHold: o.hold ? Vx : null, lift: liftK * F.m * G, tail };
  const tEnd = o.tEnd || 3;
  const E = { F, S, out, water, dt, sub: sub_, log, done: false,
    step() {
      let maxJump = 0, prev = null;
      for (let s = 0; s < sub_; s++) {
        if (!o.hold) { const Vn = -S.v[0]; ext.lift = liftK * F.m * G * Math.max(0, Vn / Vx) * (Vn / Vx); }
        bodyStep(F, S, dt, water, out, ext, { mNode: o.mNode, dt });
        if (prev != null) maxJump = Math.max(maxJump, Math.abs(out.F[1] - prev));
        prev = out.F[1];
      }
      const r = readState(F, S, water);
      const T = out.terms;
      log.push({ t: S.t, R: out.F[0], Fy: out.F[1], Fs: T.static[1], Fp: T.plan[1], Fm: T.slam[1], Fx: T.cross[1], Fk: T.suck[1],
                 draft: r.draft, trim: r.trimDeg, vy: r.vy, vx: r.vx, cgY: r.cgY, wetF: out.wetF, wetA: out.wetA, jump: maxJump, cEff: out.cEffMax, lift: ext.lift });
      if (S.t >= tEnd) E.done = true;
      return r;
    } };
  return E;
}

// THE NODE ON THE PANEL: the solver's own regime. One node of mass m under a
// bottom panel's share of the float, dropped at Vn onto still water and
// integrated with the solver's scheme (v += f/m dt; p += v dt) at the
// solver's dt. Reports omega*dt (hydrostatic), the peak c*dt (slam), and
// whether it diverged. The spring is the panel's hydrostatic stiffness; the
// slam is the wedge law above on the slice's keel depth.
function nodeSlam(F, o = {}) {
  const P = F.P, rho = P.rho;
  const m = o.mNode || 3, sub_ = o.sub || 45, dt = 1 / (60 * sub_);
  const Vn0 = o.Vn || 2, cap = o.cap != null ? o.cap : P.slamCap;
  const beta = o.beta != null ? o.beta : P.beta, tb = Math.tan(beta * D2R);
  const lx = o.lx || (P.L / P.nSta), bHalf = o.bHalf || P.B / 2;
  // the slice's hydrostatic: a V of half-width c(d) = d/tanb per side -> A(d) = d^2/tanb (both sides)
  // this node carries ONE side: k(d) = rho g lx * d / tanb  (dA/dd per side)
  let y = 0.0, v = -Vn0, t = 0, tEnd = o.tEnd || 1.0;
  let peakC = 0, peakF = 0, maxY = -Infinity, minY = Infinity, diverged = false, steps = 0;
  const wStatic = Math.sqrt(rho * G * bHalf * lx / m);      // the chine-wet stiffness: k = rho g (b lx) per side
  const log = [];
  while (t < tEnd) {
    const d = -y;                                       // keel depth
    let f = -m * G + (o.hold ? m * G : 0);              // gravity, or held level by an external load
    if (d > 0) {
      const c = Math.min(bHalf, d / tb);
      f += rho * G * lx * (0.5 * c * c * tb + (c >= bHalf ? bHalf * (d - bHalf * tb) : 0));   // buoyancy of one side's wedge
      if (v < 0) {
        const Vn = -v;
        const cw = Math.min(bHalf, P.kw * d / tb), dcdd = cw < bHalf ? P.kw / tb : 0;
        let Fm = 0.5 * rho * Math.PI * cw * dcdd * Vn * Vn * lx;
        const cEff = 2 * Fm / Vn;
        if (cEff > peakC) peakC = cEff;
        if (cap) Fm = Math.min(Fm, m * Vn / dt);
        f += Fm;
        if (Fm > peakF) peakF = Fm;
      }
    }
    v += f / m * dt; y += v * dt; t += dt; steps++;
    if (y > maxY) maxY = y; if (y < minY) minY = y;
    if (!Number.isFinite(y) || Math.abs(v) > 10 * Vn0 + 50) { diverged = true; break; }
    if (log.length < 4000 && (steps % Math.max(1, Math.floor(sub_ / 15)) === 0)) log.push({ t, y, v, f });
  }
  return { m, dt, sub: sub_, Vn: Vn0, beta, lx, peakC, cdt: peakC * dt / m, peakF, omegaDt: wStatic * dt, minY, maxY, diverged, cap, log };
}

// the stability report the design asks for: omega*dt of every panel's
// hydrostatic stiffness on a node share, and c*dt of the slam law over a
// table of entry speeds — against the fleet's measured envelope
const ENVELOPE = { omegaDtOk: 0.50, cDtOk: 0.73, omegaDtBad: 0.615, cDtBad: 0.947 };
function stabilityReport(F, o = {}) {
  const P = F.P, rho = P.rho, m = o.mNode || 3;
  const subs = o.subs || [24, 45, 72];
  const rows = [];
  let kMax = 0, aMax = 0;
  for (const pn of F.panels) { const kk = rho * G * pn.area0 * Math.abs(pn.n0[1]); if (kk > kMax) { kMax = kk; aMax = pn.area0; } }
  for (const s of subs) {
    const dt = 1 / (60 * s);
    const om = Math.sqrt(kMax / m);
    const row = { sub: s, dt, kMax, aMax, omegaDt: om * dt, slam: [] };
    for (const Vn of (o.Vns || [0.5, 1, 2, 3, 5])) {
      const r = nodeSlam(F, { mNode: m, sub: s, Vn, cap: 0 });
      const rc = nodeSlam(F, { mNode: m, sub: s, Vn, cap: 1 });
      row.slam.push({ Vn, cdt: r.cdt, peakC: r.peakC, diverged: r.diverged, divergedCapped: rc.diverged, peakF: r.peakF, peakFCapped: rc.peakF });
    }
    rows.push(row);
  }
  return { mNode: m, rows, envelope: ENVELOPE };
}

// Savitsky's buoyant term against the transom fade: a flat plate of beam b
// at trim tau, wetted keel length lambda*b, speed V — the model's static
// lift with the fade over the geometric wedge's Archimedes, compared to
// 0.0055 lambda^2.5 tau^1.1 / Cv^2 over the same wedge. Reports the ratio so
// kTr can be judged (the check prints it; it is not a gate bound yet).
function savitskyStatic(P, tauDeg, lam, Cv) {
  const b = 1, V = Cv * Math.sqrt(G * b), tau = tauDeg * D2R;
  const Lw = lam * b;
  // geometric wedge under the plate: depth at distance s ahead of the transom = s tan(tau)
  const q = 0.5 * P.rho * V * V * b * b;
  const CLb_sav = 0.0055 * Math.pow(lam, 2.5) * Math.pow(tauDeg, 1.1) / (Cv * Cv);
  const Lf = P.kTr * V * V / G;
  let lift = 0, liftArch = 0;
  const N = 200;
  for (let i = 0; i < N; i++) {
    const s = (i + 0.5) / N * Lw, ds = Lw / N;
    const d = s * Math.tan(tau);
    const dF = P.rho * G * d * b * ds * Math.cos(tau);
    liftArch += dF;
    lift += dF * (1 - Math.exp(-s / Lf));
  }
  return { CLsav: CLb_sav, CLarch: liftArch / q, CLmodel: lift / q, ratio: lift / q / CLb_sav, ratioArch: liftArch / q / CLb_sav };
}

// the LEVEL float's submerged volume to a water height hw (float frame),
// from the analytic sections: the second arbiter for Archimedes, sharing
// nothing with the clipper but the declared shape
function levelVolume(F, hw, N = 2000) {
  const P = F.P, x0 = F.xBow, x1 = F.xStern;
  let vol = 0;
  for (let i = 0; i < N; i++) {
    const x = x0 + (x1 - x0) * (i + 0.5) / N, dx = (x1 - x0) / N;
    const s = sectionOf(P, x === 0 ? -1e-9 : x);
    const d = Math.min(hw, s.yd) - s.yk;
    if (d <= 0) continue;
    const tb = Math.tan(s.beta * D2R);
    const A = d <= s.hc ? d * d / tb : s.hc * s.hc / tb + 2 * s.b * (d - s.hc);
    vol += A * dx;
  }
  return vol;
}

// ---- the float as NODES ------------------------------------------------------
// barycentrics of a world point in the tetrahedron (P0..P3): Cramer on the
// 3x3 of the edges; o = [l0, l1, l2, l3]
function baryOf(pt, P0, P1, P2, P3, o) {
  const ax = P1[0] - P0[0], ay = P1[1] - P0[1], az = P1[2] - P0[2];
  const bx = P2[0] - P0[0], by = P2[1] - P0[1], bz = P2[2] - P0[2];
  const cx = P3[0] - P0[0], cy = P3[1] - P0[1], cz = P3[2] - P0[2];
  const dx = pt[0] - P0[0], dy = pt[1] - P0[1], dz = pt[2] - P0[2];
  const det = ax * (by * cz - bz * cy) - bx * (ay * cz - az * cy) + cx * (ay * bz - az * by);
  const inv = Math.abs(det) > 1e-12 ? 1 / det : 0;
  const l1 = (dx * (by * cz - bz * cy) - bx * (dy * cz - dz * cy) + cx * (dy * bz - dz * by)) * inv;
  const l2 = (ax * (dy * cz - dz * cy) - dx * (ay * cz - az * cy) + cx * (ay * dz - az * dy)) * inv;
  const l3 = (ax * (by * dz - bz * dy) - bx * (ay * dz - az * dy) + dx * (ay * bz - az * by)) * inv;
  o[0] = 1 - l1 - l2 - l3; o[1] = l1; o[2] = l2; o[3] = l3;
  return o;
}
// the provider over the solver's flat arrays: T = the four node ids, Q = their
// float-frame rest positions (the float's frame: origin at the step keel,
// the same as the hull's), p / v = the solver's position and velocity arrays
function tetraCtx(F, T, Q, p, v) {
  const nV = F.V.length, lam = new Float64Array(nV * 4), l = [0, 0, 0, 0];
  for (let i = 0; i < nV; i++) { baryOf(F.V[i], Q[0], Q[1], Q[2], Q[3], l); for (let k = 0; k < 4; k++) lam[i * 4 + k] = l[k]; }
  const lO = baryOf([0, 0, 0], Q[0], Q[1], Q[2], Q[3], [0, 0, 0, 0]);
  const lX = baryOf([1, 0, 0], Q[0], Q[1], Q[2], Q[3], [0, 0, 0, 0]);
  const P = [v3(), v3(), v3(), v3()], Vn = [v3(), v3(), v3(), v3()];
  const ctx = { F, T, Q, lam, xhat: v3(), vH: v3(), p: v3(), lamOf: l };
  const readTetra = () => { for (let k = 0; k < 4; k++) { const i3 = T[k] * 3; P[k][0] = p[i3]; P[k][1] = p[i3 + 1]; P[k][2] = p[i3 + 2]; Vn[k][0] = v[i3]; Vn[k][1] = v[i3 + 1]; Vn[k][2] = v[i3 + 2]; } };
  const worldOf = (L, o) => { o[0] = o[1] = o[2] = 0; for (let k = 0; k < 4; k++) { o[0] += L[k] * P[k][0]; o[1] += L[k] * P[k][1]; o[2] += L[k] * P[k][2]; } return o; };
  ctx.fill = W => {
    readTetra();
    for (let i = 0; i < nV; i++) { const w = W[i]; w[0] = w[1] = w[2] = 0;
      for (let k = 0; k < 4; k++) { const a = lam[i * 4 + k]; w[0] += a * P[k][0]; w[1] += a * P[k][1]; w[2] += a * P[k][2]; } }
    const o0 = worldOf(lO, v3()), ox = worldOf(lX, v3());
    sub(ox, o0, ctx.xhat); nrm(ctx.xhat);
    ctx.p[0] = ctx.p[1] = ctx.p[2] = 0; ctx.vH[0] = ctx.vH[1] = ctx.vH[2] = 0;
    for (let k = 0; k < 4; k++) { add(ctx.p, P[k], ctx.p); ctx.vH[0] += 0.25 * Vn[k][0]; ctx.vH[2] += 0.25 * Vn[k][2]; }
    scl(ctx.p, 0.25, ctx.p);
  };
  ctx.bary = (pt, o) => baryOf(pt, P[0], P[1], P[2], P[3], o);
  ctx.velAt = (pt, o) => { ctx.bary(pt, l); o[0] = o[1] = o[2] = 0; for (let k = 0; k < 4; k++) { o[0] += l[k] * Vn[k][0]; o[1] += l[k] * Vn[k][1]; o[2] += l[k] * Vn[k][2]; } return o; };
  ctx.toLocal = (pt, o) => { ctx.bary(pt, l); o[0] = o[1] = o[2] = 0; for (let k = 0; k < 4; k++) { o[0] += l[k] * Q[k][0]; o[1] += l[k] * Q[k][1]; o[2] += l[k] * Q[k][2]; } return o; };
  return ctx;
}
// hydroBuild(def, p, v): the solver's float records from the frame's
// parts.floats — the hull from the float's own parameters, the provider over
// the four frame nodes, the scratch. Called once by makeSim.
function hydroBuild(def, p, v) {
  const fl = def.parts && def.parts.floats;
  if (!fl || !fl.length) return null;
  const floats = fl.map(rec => {
    const F = makeFloat(rec.P);
    const ctx = tetraCtx(F, rec.tetra, rec.tetraLocal, p, v);
    const out = makeScratch(F);
    let mMin = Infinity; for (const i of rec.tetra) mMin = Math.min(mMin, def.nodes[i].m || 1);
    return { rec, F, ctx, out, mNode: mMin, side: rec.side, lam: [0, 0, 0, 0] };
  });
  return { floats };
}
// one substep's hydro pass over the solver's floats: forces onto the frame
// nodes by the barycentrics of each term's point of application. water.h is
// sampled ONCE per float at its step keel (a lake is level; waterH costs
// 0.7 us and the hull has 130 vertices): the flat-water cut, until (ap)
// gives the surface a time argument.
function hydroSolverPass(HY, world, f, simT, dt) {
  let wetAny = 0;
  for (const fx of HY.floats) {
    const F = fx.F, ctx = fx.ctx, out = fx.out;
    ctx.fill(out.W);
    const eK = out.W[F.edge.K];
    const h0 = world.waterH ? world.waterH(eK[0], eK[2]) : 0;
    fx.h = h0;
    if (!(h0 > -1e8) || h0 < eK[1] - 1.0) { fx.wet = 0; zeroTerms(out); continue; }   // dry: a metre clear of the water
    const water = { h: () => h0, v: () => ZERO3 };
    hydroPanels(F, ctx, water, simT, out, { mNode: fx.mNode, dt });
    fx.wet = out.wetF + out.wetA + out.wetOther;
    wetAny += fx.wet;
    const l = fx.lam;
    for (let k = 0; k < F.panels.length; k++) {
      const o = out.per[k];
      if (!o.wet) continue;
      // the hydrostatic term at its pressure centroid, the rest at the wet centroid
      ctx.bary(o.cp, l);
      for (let j = 0; j < 4; j++) { const a = l[j], i3 = ctx.T[j] * 3; f[i3] += a * o.Fs[0]; f[i3 + 1] += a * o.Fs[1]; f[i3 + 2] += a * o.Fs[2]; }
      const gx = o.Fp[0] + o.Ff[0] + o.Fx[0] + o.Fm[0] + o.Fr[0] + o.Fk[0];
      const gy = o.Fp[1] + o.Ff[1] + o.Fx[1] + o.Fm[1] + o.Fr[1] + o.Fk[1];
      const gz = o.Fp[2] + o.Ff[2] + o.Fx[2] + o.Fm[2] + o.Fr[2] + o.Fk[2];
      if (gx || gy || gz) {
        ctx.bary(o.c, l);
        for (let j = 0; j < 4; j++) { const a = l[j], i3 = ctx.T[j] * 3; f[i3] += a * gx; f[i3 + 1] += a * gy; f[i3 + 2] += a * gz; }
      }
    }
  }
  return wetAny;
}
const ZERO3 = [0, 0, 0];
function zeroTerms(out) {
  out.F[0] = out.F[1] = out.F[2] = 0; out.tau[0] = out.tau[1] = out.tau[2] = 0;
  for (const k in out.terms) out.terms[k][0] = out.terms[k][1] = out.terms[k][2] = 0;
  out.wetF = out.wetA = out.wetOther = 0; out.vent = 0;
  for (const o of out.per) o.wet = 0;
}
// the float's SIZE for an aeroplane: the H0 float (626 kg to the deck for
// a 300 kg half-load) scaled so a pair displaces FLOAT_DISP x the gross —
// the seaplane rule of 180 % (EDO's 1.8). Linear dimensions by the cube
// root, the shell's mass by the square.
const FLOAT_DISP = 1.8;
function floatParamsFor(grossKg, over) {
  const k = Math.cbrt((FLOAT_DISP * 0.5 * Math.max(60, grossKg)) / 626);
  const P = Object.assign({}, DEF, {
    L: DEF.L * k, xs: DEF.xs * k, B: DEF.B * k, hs: DEF.hs * k, xFlat: DEF.xFlat * k,
    yBow: DEF.yBow * k, bBow: DEF.bBow * k, hSide: DEF.hSide * k, mFloat: DEF.mFloat * k * k,
    mLoad: 0, cgLoad: [0, 0, 0], loadI: [0, 0, 0],
  }, over || {});
  P.scale = k;
  return P;
}

const API = { DEF, G, NU, makeFloat, sectionOf, makeBody, makeScratch, hydroForces, bodyStep, readState, levelVolume,
              stillWater, gerstner, submergedVolumeMC, expDrop, expTow, expLand, nodeSlam, stabilityReport, ENVELOPE,
              savitskyStatic, rotPitch, polyArea, hullTriangles,
              hydroPanels, rigidCtx, tetraCtx, baryOf, hydroBuild, hydroSolverPass, floatParamsFor, FLOAT_DISP };
HYDRO = API;
if (typeof window !== 'undefined') window.HYDRO_GEN = API;
})();
