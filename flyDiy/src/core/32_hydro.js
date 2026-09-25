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
// THE WIPLINE FAMILY (G451, 2026-09-20; the user: "we'll model our
// procedural floats according to the Wipaire range"). One parametric hull
// whose proportions are the Wipline 2350's (the Cessna 172's float: 5.97 m,
// 0.74 m wide, 0.58 m high, 1166 kg to the deck), drawn and flown from the
// same numbers. What a Wipline actually is, read off the 2350 parts manual
// (P/N 1002168) and the catalogue sheets:
//   - a V bottom whose deadrise WARPS from the step forward ("higher
//     deadrise angle on forward bottoms"), a straight keel flat ahead of
//     the step, then a rocker sweeping up into a near-vertical blunt STEM
//     wearing a rubber nose bumper; the deck is FLAT and level ("the
//     traditional Wipline flat top deck"), its plan a rounded point at the
//     bow and a narrow transom at the stern;
//   - one transverse step, its face vertical; the afterbody keel rising
//     aft in a shallow curve to a small pentagonal transom that carries
//     the water rudder post;
//   - extrusions at every hard edge: the keel bar, the chine with its
//     spray strap on the forebody, the gunwale angle at the deck edge, and
//     a SISTER KEELSON a side on the forebody bottom (the extra-thick skin
//     between keel and sister keel is the rock guard);
//   - sides with a few degrees of outward flare, so the deck is the hull's
//     widest line (the catalogue's "width - hull").
// The default below is that family at the H0 spike's SIZE (a 4.6 m float
// carrying half a Cub), so the H0 check keeps measuring the same loading;
// the catalogue itself is FLOAT_PRESETS, metres and kilograms, and a
// preset's hull is `presetParams(name)`.
//
// x aft of the step, y up from the step keel, z across (the hull is
// symmetric; in the solver's right-handed frame, x aft and y up, +z is the
// PORT side — G451 measured it on the rudder rig). The deck's top at
// the step is y = H.
const DEF = {
  L: 4.6,          // overall length, m
  xs: 2.55,        // the step, m aft of the bow (0.553 L on the 2350)
  B: 0.57,         // HULL WIDTH: the deck at the step, m (the catalogue's number)
  H: 0.447,        // hull height at the step, step keel to deck, m
  beta: 22,        // deadrise at the step, deg
  betaBow: 30,     // deadrise as the bottom warps into the stem, deg (46 buried the bow: the ultralight pitch-poled in a 5 m/s crosswind; the warp is what a Wipline shows, the bow's planing lift is what keeps its nose up)
  betaA: 18,       // afterbody deadrise, deg
  hs: 0.075,       // step depth, m (a 2350's is ~4 in; the step must VENTILATE with a 172's chine 12 cm deep at the hump)
  aftAngle: 6.5,   // the afterbody keel's rise aft, deg (the NACA float families: 5.5-8.5)
  aftCurve: 0.02,  // the afterbody keel's added rise at the stern, as a fraction of its length (a 2350's transom keel sits ~0.45 m over the step keel)
  flatK: 0.50,     // the keel flat ahead of the step, as a fraction of xs (the rocker lives in the forward half: with 0.32 the bow rode high and buried under a crosswind roll — the ultralight pitch-poled at 2.5 s)
  stemK: 0.16,     // the straight stem's height, as a fraction of H (a SHORT stem: the keel foot at 0.74 H — with 0.30 the bow went under at 0.4 m of draft and 6 deg nose-down and the ultralight pitch-poled in a crosswind; the old H0 bow's keel reached the deck)
  rake: 12,        // the stem's rake, deg from the vertical (top forward)
  noseR: 0.10,     // the deck-to-stem round at the bow, as a fraction of H (the deck stays high to the tip: Wipaire's "high bow buoyancy")
  sheerK: 0.10,    // the deck's SHEER: it rises toward the bow as H sheerK t^2 (a flat deck that goes under at 8 deg nose-down is pressed down and the seaplane pitch-poles — measured on the ultralight in a 5 m/s crosswind)
  planK: 4.0,      // plan fullness: the forebody chine holds its beam then narrows as (1 - t^planK)^0.5 (a full bow: see betaBow)
  bStern: 0.42,    // the stern's chine half-beam, as a fraction of the step's
  flare: 4,        // the sides' outward flare, deg
  bevel: 0.022,    // the gunwale's chamfer in the PHYSICS loft (the drawn float rounds it), m
  nSta: 26,        // stations over the length
  // the details the drawing reads (metres, at THIS size; a preset scales them)
  rChine: 0.010, rGun: 0.026, rLip: 0.007, rTransom: 0.012,
  railW: 0.030, railT: 0.004,          // the chine spray strap (forebody)
  keelW: 0.036, keelH: 0.006,          // the keel extrusion
  skZ: 0.50, skW: 0.026, skH: 0.010,   // the sister keelsons: at skZ of the chine half-beam
  wrArea: 0.055,   // the water rudder blade, m^2 (the physics reads it: WR_AREA was a constant; a 2350's is ~0.09)
  wrDepth: 0.32,   // ...and how far its foot hangs under the stern keel, m: to the keel LINE (the transom keel rides ~0.4 m over the step keel; a shallower blade left the water at the first nose-down of the roll)
  // G396.4: 27 kg, from 45. A composite float for a 500 kg aeroplane is
  // 22-27 kg (Aerocet 1100: 22 kg each, for 500 kg; Full Lotus 1450: 27 kg,
  // for 650; Clamar 1400: 27 kg) — 45 was an EDO 1400 aluminium float's
  // weight (70 kg each) halved by feel, and on the single-582 ultralight
  // the pair came to 19 % of the gross (real: 9-11 %). The frame scales it
  // by (L/4.6)^2: 4.15 m -> 22 kg each, the Aerocet's number.
  mFloat: 27,      // kg, the shell (composite; see above)
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
// Math.hypot to the bit, JIT-inlined (00_registry.js hyp3 - PHYSICS PERF 2026-09-24): len runs per wet
// panel per hydro pass; standalone (a bench loading this file alone) it is Math.hypot
const HYP3 = (typeof hyp3 === 'function') ? hyp3 : Math.hypot, HYP2 = (typeof hyp2 === 'function') ? hyp2 : Math.hypot;
const len = a => HYP3(a[0], a[1], a[2]);
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
// THE KEEL LINE, tabulated once per hull. Forebody: flat over flatK xs
// ahead of the step, then a cubic Bezier rocker that leaves the flat
// tangent and arrives TANGENT TO THE STEM (a straight line raked `rake`
// deg from the vertical), which runs up to the nose round; the bow tip is
// x = -xs on the deck's line. The Bezier is monotonic in x, so a station's
// keel height is read off a 512-point table by linear interpolation (this
// is the hot path: halfBeamAt runs per wet vertex per substep).
function keelTable(P) {
  const xs = P.xs, H = P.H;
  const rN = P.noseR * H, sLen = P.stemK * H, rk = P.rake * D2R;
  const Ht = H * (1 + (P.sheerK || 0));        // the deck at the tip, with the sheer
  const yFoot = Ht - rN - sLen;                // the stem's foot (the rocker's end)
  const xFoot = -xs + sLen * Math.tan(rk);     // ...raked aft of the tip
  const xF = -P.flatK * xs;                    // the flat's forward end
  const d = xF - xFoot;
  // P0 flat end, P1 along the flat, P2 back down the stem's line, P3 the foot
  const P0 = [xF, 0], P1 = [xF - 0.5 * d, 0];
  const kk = 0.48 * yFoot;
  const P2 = [xFoot + kk * Math.sin(rk), yFoot - kk * Math.cos(rk)], P3 = [xFoot, yFoot];
  const N = 512, X = new Float64Array(N + 1), Y = new Float64Array(N + 1);
  for (let i = 0; i <= N; i++) {
    const t = i / N, m = 1 - t;
    X[i] = m * m * m * P0[0] + 3 * m * m * t * P1[0] + 3 * m * t * t * P2[0] + t * t * t * P3[0];
    Y[i] = m * m * m * P0[1] + 3 * m * m * t * P1[1] + 3 * m * t * t * P2[1] + t * t * t * P3[1];
  }
  const at = x => {
    if (x >= xF) return 0;
    if (x <= xFoot) return yFoot + (xFoot - x) / Math.max(1e-6, Math.tan(rk));   // the stem
    // X runs from xF down to xFoot: bisect
    let lo = 0, hi = N;
    while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (X[mid] >= x) lo = mid; else hi = mid; }
    const f = (X[lo] - x) / Math.max(1e-12, X[lo] - X[hi]);
    return Y[lo] + (Y[hi] - Y[lo]) * f;
  };
  return { at, xFoot, yFoot, xF, rN };
}
const keelOf = P => (P._keel && P._keel.P === P) ? P._keel.T : (P._keel = { P, T: keelTable(P) }).T;
// the deck's line: level at H aft of the step, a sheer rising toward the
// bow over the forebody (H sheerK t^2), rounding down into the stem over
// the last noseR
function deckAt(P, x) {
  const rN = P.noseR * P.H, s = x + P.xs;
  const t = x < 0 ? Math.min(1, -x / P.xs) : 0;
  const Hd = P.H * (1 + (P.sheerK || 0) * t * t);
  if (s >= rN) return Hd;
  const q = rN - Math.max(0, s);
  return Hd - rN + Math.sqrt(Math.max(0, rN * rN - q * q));
}
// the chine's plan: holds its beam near the step, narrows to a rounded point
const planF = (P, t) => Math.pow(Math.max(0, 1 - Math.pow(Math.min(1, t), P.planK)), 0.5);
// the chine half-beam at the step from the HULL WIDTH (deck at the step)
function chineHalfStep(P) {
  const tf = Math.tan(P.flare * D2R), tb = Math.tan(P.beta * D2R);
  return (P.B / 2 - P.H * tf) / Math.max(0.2, 1 - tb * tf);
}
function sectionOf(P, x) {
  const xs = P.xs, LA = P.L - P.xs, K = keelOf(P);
  const bS = chineHalfStep(P);
  let yk, b, beta, body;
  if (x <= 0) {
    body = 'F';
    const t = Math.min(1, -x / xs);
    yk = K.at(x);
    b = bS * planF(P, t);
    // the warp lives in the forward third (t^2.5): the planing region aft
    // of the flat keeps the step's deadrise, or the hull loses its lift at
    // the hump (measured: t^1.6 read 25 deg a metre ahead of the step and
    // the 172 sat at 11 m/s with its step 4 cm too deep to ventilate)
    beta = P.beta + (P.betaBow - P.beta) * Math.pow(t, 2.5);
  } else {
    body = 'A';
    const u = Math.min(1, x / LA);
    b = bS * (1 - (1 - P.bStern) * Math.pow(u, 1.15));
    beta = P.betaA;
    // the transom keeps a height: the afterbody's chine never climbs past
    // 0.88 H (a keel rising through the deck line leaked the physics loft:
    // the last slice read 0.008 m2 of upward area with nothing under it)
    yk = Math.min(P.hs + x * Math.tan(P.aftAngle * D2R) + P.aftCurve * LA * u * u,
                  0.88 * P.H - b * Math.tan(beta * D2R));
  }
  const hc = b * Math.tan(beta * D2R);
  const yc = yk + hc;
  // (the bow tip is a POINT: the 4 mm the deck keeps over the chine dies with the beam)
  const yd = Math.max(yc + 0.004 * Math.min(1, b / 0.01), deckAt(P, x));
  // the deck edge: the side flares outward by a CONSTANT offset (the flare
  // angle over the side's height at the step — a chine that rises aft of
  // the step must not kink the gunwale line), dying with the beam so the
  // bow's plan closes to its point
  const bd = b + (P.H - bS * Math.tan(P.beta * D2R)) * Math.tan(P.flare * D2R) * Math.min(1, b / (0.08 * P.B));
  return { x, yk, b, bd, beta, hc, body, yc, yd };
}
// the section as a closed polygon in (y, z), keel to deck, starboard side
// listed z >= 0 then mirrored: K, C, E (the gunwale's chamfer foot), D (the
// deck edge). The PHYSICS loft and levelVolume both read exactly this.
function secPoly(P, s) {
  const bv = Math.min(P.bevel || 0, 0.45 * (s.yd - s.yc), 0.45 * s.bd);
  return { K: [s.yk, 0], C: [s.yc, s.b], E: [s.yd - bv, s.bd], D: [s.yd, s.bd - bv], bv };
}

function makeFloat(over = {}) {
  const P = Object.assign({}, DEF, over);
  const V = [], panels = [];
  const push = p => { V.push(p); return V.length - 1; };
  const LA = P.L - P.xs;
  const nF = Math.max(3, Math.round(P.nSta * P.xs / P.L)), nA = Math.max(3, P.nSta - nF);
  // stations: forebody bow..step (x=0-), afterbody step (x=0+)..stern
  const sta = [];
  // forebody stations crowd toward the bow (the rocker and the stem live in
  // the last fifth): a half-cosine from the step. The first station is the
  // bow tip itself, a point (its cap has no area and the clipper skips it)
  for (let i = 0; i <= nF; i++) { const u = 1 - i / nF; sta.push(sectionOf(P, -P.xs * Math.sin(0.5 * Math.PI * u))); }
  for (let i = 0; i <= nA; i++) sta.push(sectionOf(P, 1e-9 + (LA * i) / nA));
  // each station's vertices: K, C-, C+, D-, D+   (- = port z<0, + = starboard)
  for (const s of sta) {
    const q = secPoly(P, s);
    s.K = push([s.x, q.K[0], 0]);
    s.Cm = push([s.x, q.C[0], -q.C[1]]); s.Cp = push([s.x, q.C[0], q.C[1]]);
    // the deck edge is a CHAMFER (bevel): the side rises to E, the deck runs
    // in from D — the drawn float rounds it (rGun); one facet in the physics
    s.Em = push([s.x, q.E[0], -q.E[1]]); s.Ep = push([s.x, q.E[0], q.E[1]]);
    s.Dm = push([s.x, q.D[0], -q.D[1]]); s.Dp = push([s.x, q.D[0], q.D[1]]);
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
      tri('step', s0.Cm, s1.Cm, s0.Em, { side: -1, body: 'A', beta: 0, ref: rs });
      tri('step', s0.Cp, s1.Cp, s0.Ep, { side: 1, body: 'A', beta: 0, ref: rs });
      // G451: the flared side's chamfer foot and deck edge sit at different
      // heights over the two chines (the afterbody's is hs higher), so the
      // side and the deck need their own slivers across the step or the
      // hull leaks (closure read -0.0009 m2 along x)
      quad('side', s0.Em, s1.Em, s1.Dm, s0.Dm, { side: -1, body: 'A', beta: 0, ref: rs });
      quad('side', s0.Ep, s1.Ep, s1.Dp, s0.Dp, { side: 1, body: 'A', beta: 0, ref: rs });
      tri('side', s0.Em, s1.Em, s1.Cm, { side: -1, body: 'A', beta: 0, ref: rs });
      tri('side', s0.Ep, s1.Ep, s1.Cp, { side: 1, body: 'A', beta: 0, ref: rs });
      quad('deck', s0.Dm, s1.Dm, s1.Dp, s0.Dp, { side: 0, body: 'A', beta: 0, ref: rs });
      continue;
    }
    const m = { body: s0.body, ref: [0.5 * (s0.x + s1.x), 0.5 * (s0.ref[1] + s1.ref[1]), 0], x0: s0.x, x1: s1.x };
    const bk = s0.body === 'F' ? 'bottomF' : 'bottomA';
    quad(bk, s0.K, s1.K, s1.Cm, s0.Cm, Object.assign({ side: -1, beta: 0.5 * (s0.beta + s1.beta) }, m));
    quad(bk, s0.K, s1.K, s1.Cp, s0.Cp, Object.assign({ side: 1, beta: 0.5 * (s0.beta + s1.beta) }, m));
    quad('side', s0.Cm, s1.Cm, s1.Em, s0.Em, Object.assign({ side: -1, beta: 0 }, m));
    quad('side', s0.Cp, s1.Cp, s1.Ep, s0.Ep, Object.assign({ side: 1, beta: 0 }, m));
    quad('bevel', s0.Em, s1.Em, s1.Dm, s0.Dm, Object.assign({ side: -1, beta: 0 }, m));
    quad('bevel', s0.Ep, s1.Ep, s1.Dp, s0.Dp, Object.assign({ side: 1, beta: 0 }, m));
    quad('deck', s0.Dm, s1.Dm, s1.Dp, s0.Dp, Object.assign({ side: 0, beta: 0 }, m));
  }
  { // bow cap and stern transom
    const s = sta[0];
    const rb = [s.x + 0.05, s.ref[1], 0];
    tri('bow', s.K, s.Cm, s.Cp, { side: 0, body: 'F', beta: 0, ref: rb });
    quad('bow', s.Cm, s.Cp, s.Ep, s.Em, { side: 0, body: 'F', beta: 0, ref: rb });
    quad('bow', s.Em, s.Ep, s.Dp, s.Dm, { side: 0, body: 'F', beta: 0, ref: rb });
    const e = sta[sta.length - 1], re = [e.x - 0.05, e.ref[1], 0];
    tri('stern', e.K, e.Cm, e.Cp, { side: 0, body: 'A', beta: 0, ref: re });
    quad('stern', e.Cm, e.Cp, e.Ep, e.Em, { side: 0, body: 'A', beta: 0, ref: re });
    quad('stern', e.Em, e.Ep, e.Dp, e.Dm, { side: 0, body: 'A', beta: 0, ref: re });
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
    volDeck += 0.5 * (secArea(sta[i], P) + secArea(sta[i + 1], P)) * (sta[i + 1].x - sta[i].x);
  // S1 (G451.1): the plan's half-beam b(x), TABULATED per body (the step is a
  // jump the table must keep) — halfBeamAt ran the whole section builder
  // (keel, deck, warp) for every wet bottom vertex of every panel of every
  // substep: 15 % of a step on the water
  const NB = 96, bTab = { n: NB, F: new Float64Array(NB + 1), A: new Float64Array(NB + 1), x0F: -P.xs, x1F: -1e-6, x0A: 1e-6, x1A: LA };
  for (let i = 0; i <= NB; i++) {
    bTab.F[i] = sectionOf(P, bTab.x0F + (bTab.x1F - bTab.x0F) * i / NB).b;
    bTab.A[i] = sectionOf(P, bTab.x0A + (bTab.x1A - bTab.x0A) * i / NB).b;
  }
  return { P, V, panels, sta, m, cg, I, edge, stern, volDeck, nF, nA,
           xBow: -P.xs, xStern: LA, b: P.B / 2, bTab };
}
// the section's area below a water height (float frame), from its polygon:
// the V to the chine, the flared side, the chamfer — a clip of the (y, z)
// polygon at y = hw, sharing nothing with the 3D clipper
function secAreaTo(P, s, hw) {
  const q = secPoly(P, s);
  const top = Math.min(hw, s.yd);
  if (top <= s.yk) return 0;
  // the starboard half-polygon keel -> C -> E -> D, then the centreline back
  const pts = [q.K, q.C, q.E, q.D, [s.yd, 0]];
  const cut = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    const ina = a[0] <= top, inb = b[0] <= top;
    if (ina) cut.push(a);
    if (ina !== inb) { const f = (top - a[0]) / (b[0] - a[0]); cut.push([top, a[1] + (b[1] - a[1]) * f]); }
  }
  let A2 = 0;
  for (let i = 0; i < cut.length; i++) { const a = cut[i], b = cut[(i + 1) % cut.length]; A2 += a[1] * b[0] - b[1] * a[0]; }
  return Math.abs(A2);          // both halves: 2 x (half-area = |A2| / 2)
}
const secArea = (s, P) => secAreaTo(P || DEF, s, Infinity);

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
    LE: { F: [[Infinity, Infinity], [Infinity, Infinity]], A: [[Infinity, Infinity], [Infinity, Infinity]] },   // [side -1, side +1] x [keel, chine]
    ql: v3(),
  };
}
const FKEYS = ['Fs', 'Fp', 'Ff', 'Fx', 'Fm', 'Fr', 'Fk'];

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
  // of the surface there —
  // OR (S1, G451.1) THE SIDE ITSELF IS VENTILATED: the flow leaves a sharp
  // chine by the same cavity law the step edge obeys (sigma_chine = 2 g
  // dChine / V^2 below 1), and a chine cavity is open to the sky up the dry
  // side, so the air reaches the step's cavity along the chine however deep
  // the chine sits. The spray-root rise is not modelled (H0 cut), so the
  // clipper sees a side that is 14 cm "wet" at 11 m/s where the water has
  // in fact been thrown off the chine — with the still-water rule alone the
  // 172 on 2350s sat at the hump (air 0.14 at 11 m/s: the step face's base
  // suction 0.10 W and the wet afterbody's friction 0.05 W on top of a
  // planing hull's 0.12) at R/W 0.29 against its 0.31 of thrust, while a
  // 172 on 2350s lifts off in 20 s on 180 hp. The tank's band (0.18-0.22
  // at the hump) is GATE HYDRODYN's to hold.
  const airStill = smooth01(1 - (dChine - P.hs) / P.dVent);
  const airChine = smooth01(1 - 2 * G * Math.max(0, dChine) / (Vflow * Vflow));
  const air = Math.max(airStill, airChine);
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
    if (x > 0 && vent > 0) {
      const dx = Math.max(0, x);
      const yW = eK[1] + dx * xhat[1] - 0.5 * G * (dx / Vflow) * (dx / Vflow);
      const drop = Math.max(0, h - yW) * Math.exp(-dx / lr);
      h -= vent * drop;
    }
    D[i] = h - W[i][1];
  }
  // 4. clip every panel; the wet leading edge per (body, side) row
  const LE = out.LE;
  LE.F[0][0] = LE.F[0][1] = LE.F[1][0] = LE.F[1][1] = LE.A[0][0] = LE.A[0][1] = LE.A[1][0] = LE.A[1][1] = Infinity;
  const per = out.per, ql = out.ql;
  let wetF = 0, wetA = 0, wetOther = 0;
  for (let k = 0; k < F.panels.length; k++) {
    const pn = F.panels[k], o = per[k];
    o.wet = 0; o.A = 0; o.p = 0; o.d = 0;
    // S1 (G451.1): a panel with every corner clear of the water is dry — no clip
    let anyWet = false;
    for (let j = 0; j < pn.v.length; j++) if (D[pn.v[j]] >= 0) { anyWet = true; break; }
    if (!anyWet) { o.poly.length = 0; continue; }
    clipPoly(pn.v, W, D, o);
    if (o.A <= 1e-9) { o.poly.length = 0; continue; }
    o.wet = 1;
    // (the term accumulators are read on wet panels only: zeroed here, not on every panel)
    for (let q = 0; q < 7; q++) { const key = FKEYS[q]; o[key][0] = o[key][1] = o[key][2] = 0; }
    // the outward normal of the wet polygon itself (planar: the rest normal rotated)
    o.n[0] = o.AN[0]; o.n[1] = o.AN[1]; o.n[2] = o.AN[2]; nrm(o.n);
    if (pn.kind === 'bottomF' || pn.kind === 'bottomA') {
      const row = LE[pn.body][pn.side > 0 ? 1 : 0];
      for (let j = 0; j < o.poly.length; j++) {
        const q = o.poly[j];
        // float-frame position of the wet vertex
        ctx.toLocal(q, ql);
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
    const cl = ctx.toLocal(o.c, ql);
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
      const row = LE[pn.body][pn.side > 0 ? 1 : 0];
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
        const sym = pn.kind === 'side' || pn.kind === 'bevel' || pn.kind === 'bow';
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
function halfBeamAt(F, x) {
  const T = F.bTab;
  if (!T) return sectionOf(F.P, Math.min(F.xStern, Math.max(F.xBow, x))).b;
  const fwd = x < 0, tab = fwd ? T.F : T.A, x0 = fwd ? T.x0F : T.x0A, x1 = fwd ? T.x1F : T.x1A;
  const u = Math.max(0, Math.min(T.n, (x - x0) / (x1 - x0) * T.n)), i = Math.min(T.n - 1, Math.floor(u)), f = u - i;
  return tab[i] + (tab[i + 1] - tab[i]) * f;
}

// Sutherland-Hodgman on d >= 0 over the panel's corners; fills o.poly (wet
// vertices), o.depth, o.A (wet area), o.c (area centroid), o.p (integral of
// depth over the area), o.cp (the depth-weighted centroid = centre of pressure)
const CLIP_E1 = v3(), CLIP_E2 = v3(), CLIP_CR = v3();
function clipPoly(idx, W, D, o) {
  const poly = o.poly, dep = o.depth; poly.length = 0; dep.length = 0;
  const n = idx.length;
  // S1 (G451.1): the cut vertices come from the panel's own pool (no allocation per substep)
  const pool = o.pool || (o.pool = [v3(), v3(), v3(), v3(), v3(), v3()]);
  let np = 0;
  for (let i = 0; i < n; i++) {
    const a = idx[i], b = idx[(i + 1) % n], da = D[a], db = D[b];
    if (da >= 0) { poly.push(W[a]); dep.push(da); }
    if ((da >= 0) !== (db >= 0)) {
      const t = da / (da - db);
      const A = W[a], B = W[b];
      if (np >= pool.length) pool.push(v3());
      const q = pool[np++];
      q[0] = A[0] + (B[0] - A[0]) * t; q[1] = A[1] + (B[1] - A[1]) * t; q[2] = A[2] + (B[2] - A[2]) * t;
      poly.push(q); dep.push(0);
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
    const e1 = sub(q1, q0, CLIP_E1), e2 = sub(q2, q0, CLIP_E2), cr = cross(e1, e2, CLIP_CR);
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
    vol += secAreaTo(P, s, hw) * dx;
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
function tetraCtx(F, T, Q, p, v, slab) {
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
  // THE SLAB DISTRIBUTION (H2, G389). A force handed to the tetra by
  // barycentrics is statically exact, but a panel at the stern — two
  // metres outside the tetra — lands as +1.9 F on the step's nodes and
  // -0.9 F on the bow's: a pair of hammer blows the short strut beams pass
  // into the fuselage before the cluster's projection has averaged them.
  // Measured: a float 0.44 m under the belly nosed over at -35 deg in a
  // second from a 5 cm drop, the slam's first contact reading -2800 N m.
  // So the frame gives every station (bow, the flat's end, the step, the
  // stern: keel + two deck edges, in float-frame rest coordinates), and a
  // force at a point goes to the SIX nodes of the slab it lies in —
  // linear in x between the two stations, barycentric in each station's
  // triangle: an affine map on each slab, so the force and its torque are
  // exactly what they were, with no weight outside [-1, 2] and none
  // beyond the slab.
  ctx.slab = slab || null;
  const qD = v3();
  // one station's share: w of the force o onto the station k's three nodes
  const land = (S, k, w, q, f, o) => {
    // the station's triangle in its own (y, z) plane: K, DL, DR rest coords
    const st = S.st[k];
    const ky = st.K[0], kz = st.K[1], ly = st.DL[0], lz = st.DL[1], ry = st.DR[0], rz = st.DR[1];
    const det = (ly - ky) * (rz - kz) - (lz - kz) * (ry - ky);
    let b1 = 0, b2 = 0;
    if (Math.abs(det) > 1e-12) {
      b1 = ((q[1] - ky) * (rz - kz) - (q[2] - kz) * (ry - ky)) / det;
      b2 = ((ly - ky) * (q[2] - kz) - (lz - kz) * (q[1] - ky)) / det;
    }
    const b0 = 1 - b1 - b2;
    const ids = st.ids;   // [K, DL, DR] node ids
    let a = w * b0, i3 = ids[0] * 3; f[i3] += a * o[0]; f[i3 + 1] += a * o[1]; f[i3 + 2] += a * o[2];
    a = w * b1; i3 = ids[1] * 3; f[i3] += a * o[0]; f[i3 + 1] += a * o[1]; f[i3 + 2] += a * o[2];
    a = w * b2; i3 = ids[2] * 3; f[i3] += a * o[0]; f[i3 + 1] += a * o[1]; f[i3 + 2] += a * o[2];
  };
  ctx.distribute = (pt, f, o) => {
    if (!ctx.slab) { ctx.bary(pt, l); for (let j = 0; j < 4; j++) { const i3 = T[j] * 3, a = l[j]; f[i3] += a * o[0]; f[i3 + 1] += a * o[1]; f[i3 + 2] += a * o[2]; } return; }
    const S = ctx.slab, q = ctx.toLocal(pt, qD);
    const xs = S.x, n = xs.length;
    let i = 0; while (i + 2 < n && q[0] > xs[i + 1]) i++;
    // G451: the end slabs EXTRAPOLATE (t a little outside [0, 1]) so a
    // force ahead of the bow station or behind the stern one keeps its
    // lever — the Wipline's bow closes to a point, so its first station
    // sits 7 % of the forebody aft of the tip, and with t clamped the bow's
    // lift landed 0.16 m aft of where it acts: the ultralight ploughed and
    // pitch-poled at 3.5 s (trim -58 deg) where the same hull with its node
    // on the tip rose onto the step. Weights stay inside [-0.35, 1.35].
    const t = Math.max(-0.35, Math.min(1.35, (q[0] - xs[i]) / Math.max(1e-6, xs[i + 1] - xs[i])));
    // (a NEGATIVE weight is the extrapolation's, and it must land)
    if (1 - t !== 0) land(S, i, 1 - t, q, f, o);
    if (t !== 0) land(S, i + 1, t, q, f, o);
  };
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
    const ctx = tetraCtx(F, rec.tetra, rec.tetraLocal, p, v, rec.slab || null);
    const out = makeScratch(F);
    let mMin = Infinity; for (const i of rec.tetra) mMin = Math.min(mMin, def.nodes[i].m || 1);
    return { rec, F, ctx, out, mNode: mMin, side: rec.side, lam: [0, 0, 0, 0] };
  });
  // S1 (G451.1): THE HYDRO SUB-RATE. The water's forces are computed every
  // `every` substeps and HELD between (the held node forces in fh, added to
  // f on the substeps in between). Measured on the 172 on 2350s: the hydro
  // pass was 82 % of a step on the water, 14 x the dry step; the hull's
  // own frequencies are low (heave ~7 Hz, the slam bounded per compute by
  // mNode Vn / dt with dt the HELD interval), so 360 Hz is more than the
  // water needs. 1 = every substep (the H0-H4 calibration figure).
  const every = Math.max(1, Math.round((def.params && def.params.hydroEvery) || HYDRO_EVERY));
  return { floats, every, tick: 0, fh: new Float64Array(p.length), wet: 0 };
}
const HYDRO_EVERY = 8;
// one substep's hydro pass over the solver's floats: forces onto the frame
// nodes by the barycentrics of each term's point of application. water.h is
// sampled ONCE per float at its step keel (a lake is level; waterH costs
// 0.7 us and the hull has 130 vertices): the flat-water cut, until (ap)
// gives the surface a time argument.
// THE WATER RUDDER (H4, G393). A blade under each float's stern keel — a
// low-aspect fin in the water, `WR_AREA` per float, `WR_DEPTH` deep —
// steered by the rudder pedals (ctl.dr, nose-left positive: the fin's own
// convention; the stern goes RIGHT to yaw the nose left) through
// `WR_TRAVEL`. Side force 1/2 rho V^2 A Cl(alpha) with alpha the blade's
// angle to the local flow at the stern (its deflection less the stern's
// own sideslip, so an undeflected blade is a fin: it weathervanes the
// float INTO the water, which is what stops a seaplane's tail from
// swinging), Cl 3 per rad, stalled at 0.4 rad; scaled by how much of the
// blade is under the surface. RETRACTED BY THE PILOT'S RULE: down below
// WR_UP_V of forward speed with the afterbody wet (taxi, the start of the
// run), up on the step — a real pilot raises it as the aeroplane comes
// up, and lowers it after the landing run. Applied at the stern keel
// through the slab distribution.
const WR_AREA = 0.06, WR_DEPTH = 0.25, WR_TRAVEL = 35 * Math.PI / 180, WR_UP_V = 12;
function waterRudder(fx, ctl, water, simT, f) {
  const F = fx.F, ctx = fx.ctx, out = fx.out;
  // G451: the blade is the float's own (the drawn one): area and depth off
  // its parameters, the constants the fallback for a hull without them
  const WR_A = F.P.wrArea || WR_AREA, WR_D = F.P.wrDepth || WR_DEPTH;
  const sK = out.W[F.stern.K];
  const h = water.h(sK[0], sK[2], simT), dS = h - sK[1];
  // G451: THE BLADE'S OWN IMMERSION. The blade hangs WR_D under the stern
  // keel; what matters is how much of it is in the water, not whether the
  // afterbody bottom is wet — a Wipline's transom keel rides 0.4 m over the
  // step keel and lifts clear of the surface at the first nose-down of the
  // roll while the blade is still half in the water (the old gate on the
  // stern keel's depth and on wetA raised the rudders at 2.6 m/s and the
  // ultralight weathercocked 35 deg in a 5 m/s crosswind)
  const sub = Math.max(0, Math.min(1, (dS + WR_D) / WR_D));
  if (sub < 0.15) { fx.wrDown = 0; return; }
  const vS = ctx.velAt(sK, v3());
  const xhat = ctx.xhat, up = [0, 1, 0];
  const zR = cross(up, xhat); nrm(zR);                          // right = up x aft
  const Vf = -dot(vS, xhat), vy = dot(vS, zR);
  // G396.4: WATER RUDDERS UP FOR TAKE-OFF. A seaplane pilot raises them
  // before opening the throttle (the checklist item) — down, the pair cost
  // 0.02 W of drag at the hump (q A Cd at 8 m/s), a fifth of the single
  // 582's margin over it. Up above take-off power; down again at idle.
  // G451: ...but not before the plough is over — a crosswind seaplane keeps
  // its water rudders down until it is nearly on the step (the ultralight
  // weathercocked 35 deg in a 5 m/s crosswind with them raised at the
  // first push of the throttle; the drag they cost at 7 m/s is nothing)
  const takeoffPower = ctl && ctl.thr > 0.6 && Vf > 0.6 * WR_UP_V;
  const down = Vf < WR_UP_V && !takeoffPower ? 1 : 0;
  fx.wrDown = down;
  if (!down) return;
  const delta = (ctl ? (ctl.dr || 0) : 0) * WR_TRAVEL;
  const beta = Math.atan2(vy, Math.max(0.3, Vf));
  const al = delta - beta;
  const Cl = Math.max(-1.2, Math.min(1.2, 3.0 * al));
  const q = 0.5 * F.P.rho * (Vf * Vf + vy * vy);
  const Fy = q * WR_A * sub * Cl;
  const Fv = [zR[0] * Fy, zR[1] * Fy, zR[2] * Fy];
  // and its drag, along the flow
  const Vt = HYP2(Vf, vy) || 1e-6, Cd = 0.02 + 0.6 * al * al;
  const D = q * WR_A * sub * Cd;
  Fv[0] -= vS[0] / Vt * D; Fv[1] -= vS[1] / Vt * D; Fv[2] -= vS[2] / Vt * D;
  const at = [sK[0], sK[1] - 0.5 * WR_D * sub, sK[2]];
  ctx.distribute(at, f, Fv);
  out.wrForce = Fy; out.wrAlpha = al;
}
function hydroSolverPass(HY, world, f, simT, dt, ctl) {
  const every = HY.every || 1, fh = HY.fh;
  if (every > 1) {
    if (HY.tick % every) { HY.tick++; for (let i = 0; i < fh.length; i++) f[i] += fh[i]; return HY.wet; }
    HY.tick++;
    fh.fill(0);
    const wet = hydroSolverCompute(HY, world, fh, simT, dt * every, ctl);
    for (let i = 0; i < fh.length; i++) f[i] += fh[i];
    HY.wet = wet;
    return wet;
  }
  return HY.wet = hydroSolverCompute(HY, world, f, simT, dt, ctl);
}
function hydroSolverCompute(HY, world, f, simT, dt, ctl) {
  let wetAny = 0;
  for (const fx of HY.floats) {
    const F = fx.F, ctx = fx.ctx, out = fx.out;
    ctx.fill(out.W);
    const eK = out.W[F.edge.K];
    const h0 = world.waterH ? world.waterH(eK[0], eK[2]) : 0;
    fx.h = h0;
    if (!(h0 > -1e8) || h0 < eK[1] - 1.5) { fx.wet = 0; zeroTerms(out); continue; }   // dry: well clear of the water
    // H4 (G393): with a sea state the surface is sampled per vertex, with
    // the time (ruling ap: the physics reads the same closed form the
    // renderer draws); a lake, a river, a calm day keep the flat sample
    const waves = world.sea && world.sea.A > 0 && h0 === 0;
    const water = waves ? { h: (x, z, t) => world.waterH(x, z, t), v: () => ZERO3 }
                        : { h: () => h0, v: () => ZERO3 };
    if (waves) fx.h = world.waterH(eK[0], eK[2], simT);
    hydroPanels(F, ctx, water, simT, out, { mNode: fx.mNode, dt });
    fx.wet = out.wetF + out.wetA + out.wetOther;
    wetAny += fx.wet;
    waterRudder(fx, ctl, water, simT, f);
    const l = fx.lam;
    for (let k = 0; k < F.panels.length; k++) {
      const o = out.per[k];
      if (!o.wet) continue;
      // the hydrostatic term at its pressure centroid, the rest at the wet centroid
      ctx.distribute(o.cp, f, o.Fs);
      ZERO3b[0] = o.Fp[0] + o.Ff[0] + o.Fx[0] + o.Fm[0] + o.Fr[0] + o.Fk[0];
      ZERO3b[1] = o.Fp[1] + o.Ff[1] + o.Fx[1] + o.Fm[1] + o.Fr[1] + o.Fk[1];
      ZERO3b[2] = o.Fp[2] + o.Ff[2] + o.Fx[2] + o.Fm[2] + o.Fr[2] + o.Fk[2];
      if (ZERO3b[0] || ZERO3b[1] || ZERO3b[2]) ctx.distribute(o.c, f, ZERO3b);
    }
  }
  return wetAny;
}
const ZERO3 = [0, 0, 0], ZERO3b = [0, 0, 0];
function zeroTerms(out) {
  out.F[0] = out.F[1] = out.F[2] = 0; out.tau[0] = out.tau[1] = out.tau[2] = 0;
  for (const k in out.terms) out.terms[k][0] = out.terms[k][1] = out.terms[k][2] = 0;
  out.wetF = out.wetA = out.wetOther = 0; out.vent = 0;
  for (const o of out.per) o.wet = 0;
}
// the hull's METRIC keys: everything a preset scales with its size (the
// fractions — flatK, stemK, noseR, planK, bStern, the angles — do not)
const FLOAT_METRIC = ['L', 'xs', 'B', 'H', 'hs', 'rChine', 'rGun', 'rLip', 'rTransom', 'railW', 'railT',
                      'keelW', 'keelH', 'skW', 'skH', 'wrDepth'];
function scaleParams(base, k, over) {
  const P = Object.assign({}, base);
  for (const key of FLOAT_METRIC) if (typeof base[key] === 'number') P[key] = base[key] * k;
  P.wrArea = base.wrArea * k * k;
  P.mFloat = base.mFloat * k * k;
  delete P._keel;
  return Object.assign(P, { mLoad: 0, cgLoad: [0, 0, 0], loadI: [0, 0, 0] }, over || {});
}
// the float's SIZE for an aeroplane: the default hull scaled so a pair
// displaces FLOAT_DISP x the gross — the seaplane rule of 180 % (EDO's 1.8;
// the Wipline catalogue reads 1.8-2.2). Linear dimensions by the cube root,
// the shell's mass by the square. DEF_VOL is the default hull's own
// displacement to the deck, measured once from its sections.
const FLOAT_DISP = 1.8;
let DEF_VOL = 0;
function floatParamsFor(grossKg, over) {
  if (!DEF_VOL) DEF_VOL = makeFloat(DEF).volDeck * DEF.rho;
  const k = Math.cbrt((FLOAT_DISP * 0.5 * Math.max(60, grossKg)) / DEF_VOL);
  const P = scaleParams(DEF, k, over);
  P.scale = k;
  return P;
}
// ---- THE WIPLINE CATALOGUE ------------------------------------------------
// The Wipaire line, one row per model: the seaplane float's length, the
// hull's width and height, its displacement in fresh water and the
// seaplane system's weight for a pair (floats + rigging), all off the
// catalogue sheets (wipaire.com, 2026); the aircraft the row is sold for
// and the gross it carries. `est: true` rows are models the catalogue no
// longer lists (or lists without dimensions): their length, width and
// height are SCALED from their displacement along the fitted line of the
// measured rows (L ~ 0.55 D^1/3, B ~ 0.070 D^1/3, H ~ 0.061 D^1/3) and
// their mass interpolated between neighbours — stated as estimates, not
// facts. Displacement is per FLOAT; mSys per PAIR with rigging. The
// model number is roughly the float's buoyancy in pounds.
// `disp` is the catalogue's "displacement in fresh water", `flot` its
// "maximum flotation" (the whole watertight hull, ~10 % more): the hull is
// CALIBRATED so its volume to the deck is `flot`, and `disp` is the number
// the plaque quotes.
const FLOAT_PRESETS = {
  'Wipline 1450':  { L: 4.60, B: 0.64, H: 0.50, disp: 658,  flot: 724,  mSys: 68,  gross: 650,  est: true,
                     for: 'light sport (Carbon Cub SS, Legend Cub)' },
  'Wipline 2100':  { L: 5.36, B: 0.74, H: 0.58, disp: 1054, flot: 1171, mSys: 125, gross: 1089,
                     for: 'Piper PA-12 / PA-18, Cessna 170 / 172, Husky, Scout, CubCrafters' },
  'Wipline 2350':  { L: 5.97, B: 0.74, H: 0.58, disp: 1166, flot: 1295, mSys: 138, gross: 1157,
                     for: 'Cessna 172 / 175, Maule M6 / MX7' },
  'Wipline 3000':  { L: 6.12, B: 0.81, H: 0.74, disp: 1497, flot: 1664, mSys: 196, gross: 1519,
                     for: 'Cessna 180 / 182 / 185' },
  'Wipline 3450':  { L: 6.96, B: 0.81, H: 0.74, disp: 1713, flot: 1903, mSys: 223, gross: 1720,
                     for: 'Cessna 206 (all), T206H' },
  'Wipline 3730':  { L: 6.55, B: 0.83, H: 0.73, disp: 1692, flot: 1861, mSys: 215, gross: 1640, est: true,
                     for: 'Cessna 185 / 206 (the 3450 replaced it)' },
  'Wipline 3900':  { L: 6.70, B: 0.85, H: 0.75, disp: 1769, flot: 1946, mSys: 226, gross: 1720, est: true,
                     for: 'Cessna 206 (the 3450 replaced it)' },
  'Wipline 4000':  { L: 6.75, B: 0.86, H: 0.75, disp: 1814, flot: 1995, mSys: 236, gross: 1750, est: true,
                     for: 'utility singles to ~1,800 kg' },
  'Wipline 6000':  { L: 7.40, B: 0.99, H: 0.86, disp: 2722, flot: 2994, mSys: 295, gross: 2313, est: true,
                     for: 'de Havilland DHC-2 Beaver (the 6100 replaced it)' },
  'Wipline 6100':  { L: 7.49, B: 0.99, H: 0.86, disp: 2569, flot: 2854, mSys: 308, gross: 2540,
                     for: 'de Havilland DHC-2 Beaver Mk I / III, Pilatus PC-6' },
  'Wipline 7000':  { L: 7.20, B: 1.07, H: 0.95, disp: 3088, flot: 3397, mSys: 454, gross: 3291, est: true,
                     for: 'Quest / Daher Kodiak 100 (amphibian only in the catalogue)' },
  'Wipline 8000':  { L: 8.90, B: 1.05, H: 0.96, disp: 3629, flot: 3992, mSys: 540, gross: 3856, est: true,
                     for: 'Cessna 208 Caravan (the 8750 replaced it)' },
  'Wipline 8750':  { L: 9.50, B: 1.07, H: 0.99, disp: 3965, flot: 4405, mSys: 587, gross: 4110,
                     for: 'Cessna 208 / 208B Caravan' },
  'Wipline 10000': { L: 9.80, B: 1.14, H: 1.00, disp: 4536, flot: 4990, mSys: 700, gross: 7257, est: true,
                     for: 'Air Tractor AT-802 Fire Boss (amphibian only)' },
  'Wipline 13000': { L: 9.53, B: 1.30, H: 1.14, disp: 5826, flot: 6473, mSys: 674, gross: 5670,
                     for: 'de Havilland DHC-6 Twin Otter' },
};
const FLOAT_PRESET_NAMES = Object.keys(FLOAT_PRESETS);
// what the join carries into spec.gear.floats: every number the hull, its
// details and its rudder are built from (rho and the model's constants stay
// the model's; `preset` rides as a string beside them)
const FLOAT_SPEC_KEYS = ['L', 'xs', 'B', 'H', 'beta', 'betaBow', 'betaA', 'hs', 'aftAngle', 'aftCurve', 'flatK', 'stemK',
                         'rake', 'noseR', 'planK', 'bStern', 'flare', 'bevel', 'rChine', 'rGun', 'rLip', 'rTransom',
                         'railW', 'railT', 'keelW', 'keelH', 'skZ', 'skW', 'skH', 'wrArea', 'wrDepth', 'mFloat',
                         'fineK', 'scale', 'xAft', 'sheerK'];
// THE FINENESS. The catalogue's three dimensions and its flotation are
// four facts; the family at the 2350's proportions fills its box to 49 %
// and the 2350 needs 49 % — but the taller hulls (H/B 0.9 against the
// 2350's 0.78) need 42-44 %, so a Caravan float in the 2350's lines would
// carry 15 % too much. One scalar, f in [0, 1], moves the family from the
// 2350's lines toward a finer hull the way the big Wiplines actually
// differ from the small ones (the 7000 "modeled after the 13000, improved
// rough water handling"): deeper V at the step and aft, a finer plan
// forward, more afterbody rise, a narrower transom, a longer rocker.
// presetParams solves f so the hull's volume to the deck is the row's
// `flot`; a hull the range cannot reach keeps f at its end and says so.
// Two branches: FINER (f > 0) is mostly a deeper V; FULLER (f < 0) is
// mostly a fuller plan, a wider transom and a longer keel flat, the V
// shallowing only a little (6 deg per unit) — a shallow V at the step is a
// chine that sits low, and a low chine is a step that cannot ventilate: at
// 17 deg the 172 on 2350s sat at the hump (chine 14 cm under, hs 10 cm)
// where at 21 deg it planes.
function fineParams(P, f) {
  const n = f < 0;
  return Object.assign({}, P, {
    beta: Math.max(8, P.beta + (n ? 6 : 20) * f), betaA: Math.max(8, P.betaA + (n ? 4 : 10) * f), betaBow: P.betaBow + 8 * f,
    planK: P.planK - (n ? 4 : 1.5) * f, aftAngle: P.aftAngle + 0.5 * f, aftCurve: P.aftCurve + 0.01 * f,
    bStern: Math.min(0.9, P.bStern - (n ? 0.45 : 0.20) * f), flatK: Math.min(0.85, P.flatK - (n ? 0.30 : 0.16) * f), stemK: Math.max(0.06, P.stemK - 0.08 * f), fineK: f });
}
// a preset's hull: the family scaled to the row's LENGTH (the details, the
// step, the radii follow), the width and height set to the row's own, the
// fineness solved for the row's flotation — the catalogue's four numbers
// are honoured, the family supplies everything between them. The hull's
// mass is 0.40 of the pair's system weight (the struts, spreaders and
// wires are billed by the frame).
function presetParams(name, over) {
  const R = FLOAT_PRESETS[name];
  if (!R) return null;
  const k = R.L / DEF.L;
  // the catalogue's "height - hull" is the hull's OVERALL height — the bow,
  // where the sheer tops out — so the family's H (at the step) is that over
  // (1 + sheerK)
  const P0 = scaleParams(DEF, k, { B: R.B, H: R.H / (1 + (DEF.sheerK || 0)), mFloat: 0.40 * R.mSys, preset: name, disp: R.disp });
  const volOf = f => { const Q = fineParams(P0, f); delete Q._keel; return makeFloat(Q).volDeck * P0.rho; };
  // f runs from -0.7 (a FULLER hull than the family: a shallower V, a
  // wider transom — the small Wiplines, whose overall height leaves little
  // freeboard over the sheer) to 1 (the finest)
  let lo = -0.7, hi = 1, vLo = volOf(lo), vHi = volOf(1);
  let f;
  if (R.flot >= vLo) f = lo; else if (R.flot <= vHi) f = 1;
  else { for (let i = 0; i < 18; i++) { const m = 0.5 * (lo + hi); if (volOf(m) > R.flot) lo = m; else hi = m; } f = 0.5 * (lo + hi); }
  const P = fineParams(P0, f);
  delete P._keel;
  P.scale = k;
  P.volRes = volOf(f) / R.flot - 1;      // the residual the range left (0 inside it)
  return Object.assign(P, over || {});
}

// THE SIZING ADVISOR (S1, G451.1; playtest item 111 "automated float-sizing
// advice"). From the aeroplane's all-up mass: the catalogue row it belongs
// on (the smallest Wipline whose rated gross carries it — the catalogue's
// own rule, the model number is the aircraft's gross in pounds), and the
// verdict on the pair that is fitted: a pair must displace 1.8 x the gross
// (the FAA's 80 % reserve, 14 CFR 23.751 / CS-23) — under 1.8 the floats
// are UNDERSIZED (they sit deep, the chine buries and the step cannot
// ventilate: the hump is a wall, however much power); over 3 the pair is
// oversized (weight and drag for nothing). The 172 on 2350s carries 2.2.
function floatAdvice(grossKg, P) {
  const rows = FLOAT_PRESET_NAMES.map(n => Object.assign({ name: n }, FLOAT_PRESETS[n])).sort((a, b) => a.gross - b.gross);
  const fit = rows.find(r => r.gross >= grossKg) || rows[rows.length - 1];
  const out = { grossKg, recommend: fit.name, recommendGross: fit.gross, rows: rows.filter(r => r.gross >= 0.85 * grossKg && r.gross <= 1.4 * grossKg).map(r => r.name) };
  if (P) {
    const F = makeFloat(Object.assign({}, P, { mLoad: 0, cgLoad: [0, 0, 0], loadI: [0, 0, 0] }));
    const pair = 2 * F.volDeck * P.rho;
    out.pairKg = pair; out.reserve = pair / Math.max(1, grossKg);
    out.verdict = out.reserve < 1.8 ? 'UNDERSIZED' : out.reserve > 3.0 ? 'oversized' : 'sized';
    // the BEAM against the row's: a narrow float carries its load deeper and
    // ploughs at the hump (the user's 6.3 x 0.61 m pair on a 960 kg 172 sat
    // at 25 km/h at R/W 0.23 where the 2350's 0.74 m beam planes)
    out.narrow = P.B < 0.9 * fit.B;
    out.line = `${out.verdict}: the pair displaces ${pair.toFixed(0)} kg to the deck = ${out.reserve.toFixed(2)} x the ${grossKg.toFixed(0)} kg all-up (1.8 needed, 2-2.5 usual)` +
      (P.preset && P.preset === fit.name ? `; the ${fit.name} is the catalogue's row for it` : `; the catalogue puts ${grossKg.toFixed(0)} kg on the ${fit.name} (rated to ${fit.gross} kg)`) +
      (out.narrow ? `; NARROW: ${P.B.toFixed(2)} m of beam against the row's ${fit.B.toFixed(2)} — a narrow float ploughs deeper at the hump` : '');
  } else out.line = `the catalogue puts ${grossKg.toFixed(0)} kg on the ${fit.name} (rated to ${fit.gross} kg)`;
  return out;
}

const API = { DEF, G, NU, makeFloat, sectionOf, makeBody, makeScratch, hydroForces, bodyStep, readState, levelVolume,
              stillWater, gerstner, submergedVolumeMC, expDrop, expTow, expLand, nodeSlam, stabilityReport, ENVELOPE,
              savitskyStatic, rotPitch, polyArea, hullTriangles,
              hydroPanels, rigidCtx, tetraCtx, baryOf, hydroBuild, hydroSolverPass, floatParamsFor, FLOAT_DISP,
              FLOAT_PRESETS, FLOAT_PRESET_NAMES, FLOAT_METRIC, FLOAT_SPEC_KEYS, presetParams, fineParams, scaleParams, secPoly, secAreaTo, keelOf, deckAt,
              waterRudder, WR_AREA, WR_DEPTH, WR_TRAVEL, WR_UP_V, HYDRO_EVERY, floatAdvice };
HYDRO = API;
if (typeof window !== 'undefined') window.HYDRO_GEN = API;
})();
