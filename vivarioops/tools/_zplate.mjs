// tools/_zplate.mjs — FIVE MICRO-TESTS ON THE FLUID LAW ITSELF.
//
// Measurement only. Nothing under engine/ is touched by this file, and none of
// the tests tunes anything: each states a prediction derived from the code, and
// the run either confirms or kills it.
//
// Every test reports THREE numbers where it can — the continuum analytic, what
// the LOCAL unguarded copy of the law computes, and what the ENGINE actually
// delivers — plus the guard scale factor `sc`. Splitting "what the law says"
// from "what survives the guard" is what makes the results readable; two of the
// findings below are invisible if you only measure the engine.
//
// THE PREDICTIONS, and where they come from:
//
//   F2  THE LIFT TERM DOUBLE-COUNTS AND POINTS THE WRONG WAY.
//       Drag is applied along -n (physics.js:992). Decompose the unit normal
//       into along-flow and cross-flow parts, n = c*u + sqrt(1-c^2)*d:
//           F_drag = -mag*n = -mag*c*u  -  mag*sqrt(1-c^2)*d
//                              ^drag       ^ THIS IS ALREADY LIFT
//       The lift block computes liftDir = (u x n) x u / |u x n|, which by BAC-CAB
//       is exactly (n - c*u)/sqrt(1-c^2) = +d — the SAME AXIS as the drag term's
//       cross-flow component, opposite sign, and liftMag/mag = 1.2*sqrt(1-c^2)
//       against the drag cross-flow's 1.0*sqrt(1-c^2).
//       PREDICTION: net cross-flow = +0.2 * d. Toward the LEEWARD side with lift
//       off (correct — that is the side a wing's lift acts toward) and toward the
//       WINDWARD side with lift on, at a fifth the magnitude. Ratio -0.2.
//
//   F4  THE 2x2 FACE QUADRATURE UNDER-RESOLVES ROTATION.
//       Samples sit at +-0.25*d, the midpoint of each half-face (physics.js:497).
//       For a face rotating about the limb centre the flow varies linearly across
//       it and the force is quadratic in that flow, so over r in [0, h]:
//           force  ~ mean r^2 : exact h^2/3  vs sampled h^2/4   (-25%)
//           torque ~ mean r^3 : exact h^3/4  vs sampled h^3/8   (-50%)
//       PREDICTION: delivered torque is HALF the law's own continuum value, and
//       the ratio is flat in omega (a quadrature error, not a guard).
//
//   F3  THE MOMENTUM GUARDS SCALE THINGS THEY HAVE NO BUSINESS SCALING.
//       physics.js:1084-1091 caps the whole fluid force AND torque at
//           sc <= m*|v|/(dt*|F|)      and      sc <= I*|omega|/(dt*|T|)
//       using the body's TOTAL linear and angular speed, then drops everything
//       when sc reaches 0. Both bounds exist to prevent REVERSAL, which only
//       needs the component along the force.
//       PREDICTION: severity unknown — that is why it is measured. Test D runs a
//       real swimmer and reports which cap decides; test E isolates the omega->0
//       corner the algebra says is degenerate.
//
//   node tools/_zplate.mjs
import RAPIER from '@dimforge/rapier3d-compat';
import { createSimulation, FIXED_DT } from '../engine/l1/physics.js';
import { morphogenesis } from '../engine/l1/morphogen.js';
import { qmul } from '../engine/l1/vecmath.js';
import { SEEDS } from '../worlds/seeds.js';
import W1_SLICE from '../worlds/w1_slice.js';

await RAPIER.init();

const RHO = W1_SLICE.mediumDensity * W1_SLICE.dragScale * W1_SLICE.dragCoefficient;
const WORLD = { ...W1_SLICE, gravity: 0 };
const GENOME = { controller: { omega: 1.0, jointGenes: {} } };
// min(WALL/FIXED_DT, STABLE_SPEED) in the shipped world. clampKinematics() runs
// at the TOP of step(), so any probe state above this is silently rewritten and
// the recovered "force" would be measuring the clamp instead.
const MAX_SPEED = 10;

const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const nrm = (a) => Math.hypot(a[0], a[1], a[2]);
const median = (xs) => {
  const s = xs.filter(Number.isFinite).sort((a, b) => a - b);
  if (!s.length) return NaN;
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const pct = (xs, p) => {
  const s = xs.filter(Number.isFinite).sort((a, b) => a - b);
  return s.length ? s[Math.min(s.length - 1, Math.floor(p * s.length))] : NaN;
};

const onePlan = (dims, density = 1.0) => ({
  bodyCount: 1, jointCount: 0, joints: [],
  bodies: [{ dims, density, position: [0, 0, 0], rotation: [0, 0, 0, 1], parent: -1 }],
});

// ── a faithful copy of the shipped face loop, WITHOUT the guards ──────────────
// Test A proves it reproduces the shipped law on the one case already verified
// (_dragmicro's translating cube) before anything else relies on it.
function faces(dims) {
  const out = [];
  const AXES = [[0, 1, 2], [1, 0, 2], [2, 0, 1]];
  for (const [na, t1, t2] of AXES) {
    for (const sgn of [1, -1]) {
      const areaQ = 0.25 * dims[t1] * dims[t2];
      for (const ii of [-1, 1]) {
        for (const jj of [-1, 1]) {
          const n = [0, 0, 0]; n[na] = sgn;
          const o = [0, 0, 0];
          o[na] = 0.5 * sgn * dims[na];
          o[t1] = 0.25 * ii * dims[t1];
          o[t2] = 0.25 * jj * dims[t2];
          out.push({ n, o, areaQ });
        }
      }
    }
  }
  return out;
}

function rotm(q) {
  const x = q[0], y = q[1], z = q[2], w = q[3];
  return [
    1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w),
    2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w),
    2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y),
  ];
}
const mv = (M, v) => [
  M[0] * v[0] + M[1] * v[1] + M[2] * v[2],
  M[3] * v[0] + M[4] * v[1] + M[5] * v[2],
  M[6] * v[0] + M[7] * v[1] + M[8] * v[2],
];
const I3 = rotm([0, 0, 0, 1]);

function fluidUnguarded(fs, M, lv, av, lift) {
  const F = [0, 0, 0], T = [0, 0, 0];
  for (const f of fs) {
    const n = mv(M, f.n), r = mv(M, f.o);
    const p = [
      lv[0] + (av[1] * r[2] - av[2] * r[1]),
      lv[1] + (av[2] * r[0] - av[0] * r[2]),
      lv[2] + (av[0] * r[1] - av[1] * r[0]),
    ];
    const vn = dot(p, n);
    if (vn <= 0) continue;
    const sp2 = dot(p, p);
    if (sp2 < 1e-6) continue;
    const sp = Math.sqrt(sp2);
    const mag = 0.5 * RHO * f.areaQ * vn * vn;
    let Fx = -mag * n[0], Fy = -mag * n[1], Fz = -mag * n[2];
    if (lift) {
      const c = vn / sp;
      const root = Math.sqrt(Math.max(1 - c * c, 0));
      const Cl = 1.2 * c * root;
      if (Cl > 0) {
        const u = [p[0] / sp, p[1] / sp, p[2] / sp];
        const k = [u[1] * n[2] - u[2] * n[1], u[2] * n[0] - u[0] * n[2], u[0] * n[1] - u[1] * n[0]];
        const km2 = dot(k, k);
        if (km2 > 1e-6) {
          const km = Math.sqrt(km2);
          const lm = 0.5 * RHO * sp2 * f.areaQ * Cl * c;
          Fx += lm * (k[1] * u[2] - k[2] * u[1]) / km;
          Fy += lm * (k[2] * u[0] - k[0] * u[2]) / km;
          Fz += lm * (k[0] * u[1] - k[1] * u[0]) / km;
        }
      }
    }
    F[0] += Fx; F[1] += Fy; F[2] += Fz;
    T[0] += r[1] * Fz - r[2] * Fy;
    T[1] += r[2] * Fx - r[0] * Fz;
    T[2] += r[0] * Fy - r[1] * Fx;
  }
  return { F, T };
}

/** The three caps of physics.js:1065-1091, reproduced so a reader can see which one decides. */
function guards(F, T, lv, av, m, I) {
  const P = dot(F, lv) + dot(T, av);
  const Q = dot(F, F) / m + dot(T, T) / I;
  let scE = 1;
  if (Q > 0) scE = P >= 0 ? 0 : Math.min(1, (-2 * P) / (FIXED_DT * Q));
  const fm = nrm(F), tm = nrm(T);
  const scL = fm > 0 ? (m * nrm(lv)) / (FIXED_DT * fm) : Infinity;
  const scA = tm > 0 ? (I * nrm(av)) / (FIXED_DT * tm) : Infinity;
  return { scE, scL, scA, sc: Math.min(1, scE, scL, scA) };
}

/** One step at a prescribed state; recover the applied force (and torque) from the velocity change. */
function probe(dims, { lv = [0, 0, 0], av = [0, 0, 0], lift = false, density = 1, lockRot = false }) {
  const sim = createSimulation(RAPIER, onePlan(dims, density), GENOME, WORLD,
    { bounded: false, motorScale: 0, lift });
  const rb = sim.bodies[0];
  const m = rb.mass();
  const Ip = rb.principalInertia();
  if (lockRot) rb.setEnabledRotations(false, false, false, true);
  rb.setLinvel({ x: lv[0], y: lv[1], z: lv[2] }, true);
  rb.setAngvel({ x: av[0], y: av[1], z: av[2] }, true);
  sim.step();
  const v1 = rb.linvel(), a1 = rb.angvel();
  sim.free();
  return {
    m, Imin: Math.min(Ip.x, Ip.y, Ip.z),
    F: [m * (v1.x - lv[0]) / FIXED_DT, m * (v1.y - lv[1]) / FIXED_DT, m * (v1.z - lv[2]) / FIXED_DT],
    // Valid only when av lies along a principal axis, so the gyroscopic term
    // omega x (I omega) vanishes. Every call below satisfies that.
    T: [Ip.x * (a1.x - av[0]) / FIXED_DT, Ip.y * (a1.y - av[1]) / FIXED_DT, Ip.z * (a1.z - av[2]) / FIXED_DT],
  };
}

const maxSpinOf = (d) => MAX_SPEED / (0.5 * Math.hypot(d[0], d[1], d[2]));

console.log(`\n  _zplate · rho_eff ${RHO}  dt ${FIXED_DT.toFixed(5)}  MAX_SPEED ${MAX_SPEED} m/s\n`);

// ══ TEST A · does the local copy reproduce the shipped law? ═══════════════════
// Pure translation of a cube along a face normal: one face exposed, analytic
// F = 0.5*rho*A*v^2. This is _dragmicro's case and it must read 1.000 for BOTH
// the engine and the local copy, or nothing below can be trusted.
{
  const L = 0.5, dims = [L, L, L], A = L * L, fs = faces(dims);
  console.log('  TEST A · translation, cube 0.5 m — the harness against _dragmicro\'s known-good case');
  console.log('       v    F_analytic     F_engine    ratio      F_local    ratio');
  console.log('  ' + '-'.repeat(72));
  for (const v of [0.1, 1, 5, 9]) {
    const r = probe(dims, { lv: [v, 0, 0], lockRot: true });
    const loc = fluidUnguarded(fs, I3, [v, 0, 0], [0, 0, 0], false);
    const Fa = 0.5 * RHO * A * v * v;
    console.log('  ' + String(v).padStart(6)
      + Fa.toFixed(4).padStart(13)
      + (-r.F[0]).toFixed(4).padStart(13)
      + (-r.F[0] / Fa).toFixed(3).padStart(9)
      + (-loc.F[0]).toFixed(4).padStart(13)
      + (-loc.F[0] / Fa).toFixed(3).padStart(9));
  }
  console.log('  → both columns must read 1.000. (v is kept under MAX_SPEED: above 10 m/s');
  console.log('    clampKinematics rewrites the state and the recovered "force" is the clamp.)\n');
}

// ══ TEST B · F2 — which way does the cross-flow force point? ═════════════════
// A thin plate whose big faces are +-Y, translating in the XY plane at incidence
// alpha to its own plane. The +Y face is windward (its outward normal advances
// into the flow). A real hydrofoil's lift acts toward the LEEWARD side, i.e. the
// -Y side here, so the correct sign of Fcross.n is NEGATIVE.
//
// Read the LOCAL columns for the physics — the engine columns carry test E's
// separate defect on top and would hide this one.
{
  const dims = [2, 0.02, 2], fs = faces(dims);
  const n = [0, 1, 0];
  const crossOn = (F, u) => {
    const along = dot(F, u);
    return dot([F[0] - along * u[0], F[1] - along * u[1], F[2] - along * u[2]], n);
  };
  console.log('  TEST B · F2 — lift direction. Plate [2, 0.02, 2], |v| = 1, rotation locked.');
  console.log('           Fcross.n < 0 = toward LEEWARD = correct (a wing lifts to its suction side).\n');
  console.log('             ── law as written (unguarded) ──      ── engine ──');
  console.log('    alpha    lift:off    lift:on     ratio      off       on     sc(on)');
  console.log('  ' + '-'.repeat(74));
  const ratios = [];
  for (const deg of [5, 15, 30, 45, 60, 75]) {
    const a = deg * Math.PI / 180;
    const u = [Math.cos(a), Math.sin(a), 0];
    const lOff = fluidUnguarded(fs, I3, u, [0, 0, 0], false);
    const lOn = fluidUnguarded(fs, I3, u, [0, 0, 0], true);
    const eOff = probe(dims, { lv: u, lift: false, lockRot: true });
    const eOn = probe(dims, { lv: u, lift: true, lockRot: true });
    const g = guards(lOn.F, lOn.T, u, [0, 0, 0], eOn.m, eOn.Imin);
    const co = crossOn(lOff.F, u), cn = crossOn(lOn.F, u);
    ratios.push(cn / co);
    console.log('  ' + `${deg}°`.padStart(7)
      + co.toFixed(4).padStart(11)
      + cn.toFixed(4).padStart(11)
      + (cn / co).toFixed(3).padStart(10)
      + crossOn(eOff.F, u).toFixed(4).padStart(11)
      + crossOn(eOn.F, u).toFixed(4).padStart(9)
      + g.sc.toFixed(3).padStart(9));
  }
  console.log('  ' + '-'.repeat(74));
  console.log(`  median law ratio ${median(ratios).toFixed(3)}   (predicted -0.200)`);
  console.log('  → lift:off is leeward at every incidence; lift:on flips it windward at a fifth.\n');
}

// ══ TEST C · F4 — how much of the law's own rotational torque is delivered? ═══
// Plate rotating about Z (an in-plane, principal axis), zero linear velocity.
// Only the +-Y faces see flow; vn = omega*x, so exactly half of each face is
// windward. The continuum value of the SAME law over that half-face is
//     tau_z = -0.5 * rho * omega^2 * a^4 * b,    a = dx/2, b = dz/2
// (both faces summed). The 2x2 sample sits at x = dx/4 and returns half of it.
{
  const dims = [2, 0.2, 2], fs = faces(dims);
  const a = dims[0] / 2, b = dims[2] / 2;
  console.log('  TEST C · F4 — rotational quadrature. Plate [2, 0.2, 2] spinning about Z, v = 0.');
  console.log(`           max spin for this body ${maxSpinOf(dims).toFixed(2)} rad/s (clampKinematics)\n`);
  console.log('    omega    tau_continuum     tau_engine    ratio      tau_local    ratio');
  console.log('  ' + '-'.repeat(74));
  for (const w of [0.5, 1, 2]) {
    const r = probe(dims, { av: [0, 0, w] });
    const loc = fluidUnguarded(fs, I3, [0, 0, 0], [0, 0, w], false);
    const ta = -0.5 * RHO * w * w * a ** 4 * b;
    console.log('  ' + w.toFixed(2).padStart(7)
      + ta.toFixed(4).padStart(15)
      + r.T[2].toFixed(4).padStart(15)
      + (r.T[2] / ta).toFixed(3).padStart(9)
      + loc.T[2].toFixed(4).padStart(15)
      + (loc.T[2] / ta).toFixed(3).padStart(9));
  }
  console.log('  → predicted: ratio 0.500, flat in omega.\n');
}

// ══ TEST E · F3 — the omega -> 0 corner of the ANGULAR momentum cap ══════════
// physics.js:1087-1089 caps sc at I*|omega| / (dt*|T|), and :1091 drops the whole
// contribution when sc reaches 0. A body with a fluid TORQUE and no spin
// therefore receives NOTHING — not a reduced force, none at all.
//
// With lift OFF a non-rotating box cannot reach this corner: every face's force
// is along -n while its area centroid is offset along +n, so each face's torque
// is identically zero. Lift is the term that puts a non-parallel force on a
// face, and it is what opens the degeneracy. The plate below sits at 30°
// incidence, where test B says the law wants a real cross-flow force.
{
  const dims = [2, 0.02, 2], fs = faces(dims);
  const a = 30 * Math.PI / 180;
  const u = [Math.cos(a), Math.sin(a), 0];
  console.log('  TEST E · F3 — the angular cap at low spin. Same plate at 30° incidence, lift ON.');
  console.log('           spin is about Z (out of the flow plane), so it does NOT change the law\'s force.\n');
  console.log('     omega     |F| law    |F| engine    sc      scE      scL      scA');
  console.log('  ' + '-'.repeat(72));
  for (const w of [0, 1e-4, 1e-2, 0.1, 0.5, 2]) {
    const r = probe(dims, { lv: u, av: [0, 0, w], lift: true });
    const loc = fluidUnguarded(fs, I3, u, [0, 0, w], true);
    const g = guards(loc.F, loc.T, u, [0, 0, w], r.m, r.Imin);
    const f = (x) => (Number.isFinite(x) ? x.toFixed(3) : '   inf');
    console.log('  ' + w.toExponential(0).padStart(8)
      + nrm(loc.F).toFixed(4).padStart(12)
      + nrm(r.F).toFixed(4).padStart(13)
      + g.sc.toFixed(3).padStart(8)
      + f(g.scE).padStart(9) + f(g.scL).padStart(9) + f(g.scA).padStart(9));
  }
  console.log('  → the law\'s force is essentially flat in omega. If the engine column');
  console.log('    collapses to 0 as omega -> 0, a torque bound is deleting a force.\n');
}

// ══ TEST D · F3 — on a real swimmer, which guard actually binds? ══════════════
// The eel from worlds/seeds.js, swimming under its own motors. Every step, for
// every body, the UNGUARDED force and torque are reconstructed from the state
// the engine itself saw, and the three caps are evaluated. The question is not
// whether a cap CAN bind — it is how often it does on a real gait.
{
  const sd = SEEDS.find((s) => s.id === 'eel') ?? SEEDS[0];
  const genome = sd.genome ?? sd;
  const plan = morphogenesis(genome);
  const fs = plan.bodies.map((b) => faces(b.dims));
  const SETTLE = 2, T = 8;

  console.log(`  TEST D · F3 — the guards on a real swimmer (${sd.id}, ${plan.bodyCount} bodies, ${T} s)\n`);
  console.log('    lift   body-steps   any cap   linear   energy   angular   sc med   sc p10   sc=0');
  console.log('  ' + '-'.repeat(88));

  for (const lift of [false, true]) {
    const sim = createSimulation(RAPIER, plan, genome, WORLD, { bounded: false, wrap: false, lift });
    for (let k = 0; k < Math.round(SETTLE / FIXED_DT); k++) sim.step();
    let n = 0, bound = 0, lin = 0, eng = 0, ang = 0, zero = 0;
    const scAll = [];
    for (let k = 0; k < Math.round(T / FIXED_DT); k++) {
      for (let i = 0; i < plan.bodies.length; i++) {
        const rb = sim.bodies[i];
        const lvv = rb.linvel(), avv = rb.angvel(), q = rb.rotation();
        const lv = [lvv.x, lvv.y, lvv.z], av = [avv.x, avv.y, avv.z];
        const lq = qmul([q.x, q.y, q.z, q.w], plan.bodies[i].rotation);
        const { F, T: Tq } = fluidUnguarded(fs[i], rotm(lq), lv, av, lift);
        if (!nrm(F) && !nrm(Tq)) continue;
        const Ip = rb.principalInertia();
        const g = guards(F, Tq, lv, av, rb.mass(), Math.min(Ip.x, Ip.y, Ip.z));
        n++; scAll.push(g.sc);
        if (g.sc <= 0) zero++;
        if (g.sc < 0.999) {
          bound++;
          const w = Math.min(g.scE, g.scL, g.scA);
          if (w === g.scL) lin++; else if (w === g.scE) eng++; else ang++;
        }
      }
      sim.step();
    }
    sim.free();
    const p = (x) => `${((100 * x) / Math.max(1, n)).toFixed(1)}%`;
    console.log('  ' + String(lift).padStart(6)
      + String(n).padStart(13)
      + p(bound).padStart(10) + p(lin).padStart(9) + p(eng).padStart(9) + p(ang).padStart(10)
      + median(scAll).toFixed(3).padStart(9) + pct(scAll, 0.10).toFixed(3).padStart(9)
      + p(zero).padStart(8));
  }
  console.log('\n  → "sc=0" is the share of body-steps where the fluid contribution is');
  console.log('    DISCARDED ENTIRELY (physics.js:1091), not merely reduced.\n');
}
