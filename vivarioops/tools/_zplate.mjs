// tools/_zplate.mjs — MICRO-TESTS ON THE FLUID LAW ITSELF.
//
// Measurement only. Nothing under engine/ is touched by this file, and no test
// here tunes anything: each states a prediction derived from the code, and the
// run either confirms or kills it.
//
// Each test reports the continuum analytic, what the LOCAL unguarded copy of the
// law computes, and what the ENGINE actually delivers. Splitting "what the law
// says" from "what survives the guard" is what makes the results readable.
//
// STATUS OF THE THREE PREDICTIONS THIS TOOL WAS WRITTEN FOR:
//
//   F2  THE LIFT TERM DOUBLE-COUNTED AND POINTED THE WRONG WAY.  **CONFIRMED,
//       AND THE TERM IS NOW DELETED.**
//       Drag is applied along -n. Decompose the unit normal into along-flow and
//       cross-flow parts, n = c*u + sqrt(1-c^2)*d:
//           F_drag = -mag*n = -mag*c*u  -  mag*sqrt(1-c^2)*d
//                              ^drag       ^ THIS IS ALREADY LIFT
//       The reference's block computed liftDir = (u x n) x u / |u x n|, which by
//       BAC-CAB is exactly (n - c*u)/sqrt(1-c^2) = +d — the SAME AXIS, opposite
//       sign, with liftMag/mag = 1.2*sqrt(1-c^2) against that component's 1.0.
//       MEASURED at ratio -0.200 to three figures at every incidence 5-75 deg.
//       `opts.lift` is gone from the engine and gate L1-45 now holds the sign.
//       TEST B IS KEPT as the permanent record: it models the deleted term
//       LOCALLY, so the evidence survives the code it described.
//
//   F4  THE 2x2 FACE QUADRATURE UNDER-RESOLVES ROTATION.  **CONFIRMED, OPEN.**
//       Samples sit at +-0.25*d, the midpoint of each half-face. For a face
//       rotating about the limb centre the flow varies linearly across it and the
//       force is quadratic in that flow, so over r in [0, h]:
//           force  ~ mean r^2 : exact h^2/3  vs sampled h^2/4   (-25%)
//           torque ~ mean r^3 : exact h^3/4  vs sampled h^3/8   (-50%)
//       MEASURED at exactly 0.500, flat in omega. Test C is the acceptance
//       instrument for C6.4, where the ratio should move 0.500 -> ~0.88.
//
//   F3  THE MOMENTUM GUARDS ARE DEGENERATE.  **HALF FALSE, HALF LOAD-BEARING.**
//       The claim as first written — that they suppress thrust on a real gait —
//       is FALSE: test D evaluates all three caps on every body-step of a
//       swimming eel and 0.0% bind. The linear cap never decides.
//       But the omega->0 CORNER was real, and C6.4 detonated it. The caps used
//       the body's TOTAL speed, so a body with a denormal torque and zero spin
//       got sc = 0 and lost its ENTIRE fluid force. At 2x2 quadrature a
//       translating box's torque cancelled to exactly zero and the corner was
//       unreachable; at 4x4 the +-0.125/+-0.375 offsets leave a ~1e-17 residue
//       and translation drag vanished outright. The caps now bound the component
//       the impulse OPPOSES, which is the only thing a reversal bound needs.
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

// ── a copy of the shipped face loop, WITHOUT the guards ───────────────────────
// Test A proves it reproduces the shipped law on the one case already verified
// (_dragmicro's translating cube) before anything else relies on it.
//
// `lift` models the DELETED term. It has no counterpart in the engine any more —
// that is deliberate, and it is what lets test B keep documenting F2 forever.
// QUAD must track engine/l1/physics.js. 2 = the old 2x2, 4 = the shipped 4x4.
const QUAD = 4;
function faces(dims) {
  const out = [];
  const AXES = [[0, 1, 2], [1, 0, 2], [2, 0, 1]];
  for (const [na, t1, t2] of AXES) {
    for (const sgn of [1, -1]) {
      const areaQ = (dims[t1] * dims[t2]) / (QUAD * QUAD);
      for (let ii = 0; ii < QUAD; ii++) {
        for (let jj = 0; jj < QUAD; jj++) {
          const n = [0, 0, 0]; n[na] = sgn;
          const o = [0, 0, 0];
          o[na] = 0.5 * sgn * dims[na];
          o[t1] = ((ii + 0.5) / QUAD - 0.5) * dims[t1];
          o[t2] = ((jj + 0.5) / QUAD - 0.5) * dims[t2];
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

function fluidUnguarded(fs, M, lv, av, lift = false) {
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
    if (lift) {                                   // the DELETED term, modelled
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

/** The three caps of applyEnvironment's guard, reproduced so test D can see which binds. */
function guards(F, T, lv, av, m, I) {
  const P = dot(F, lv) + dot(T, av);
  const Q = dot(F, F) / m + dot(T, T) / I;
  let scE = 1;
  if (Q > 0) scE = P >= 0 ? 0 : Math.min(1, (-2 * P) / (FIXED_DT * Q));
  // The caps bound the component the impulse OPPOSES, not the total speed — see
  // the note in applyEnvironment. The old total-speed form is what C6.4 detonated.
  const fm = nrm(F), tm = nrm(T);
  const fOpp = fm > 0 ? -dot(F, lv) / fm : 0;
  const tOpp = tm > 0 ? -dot(T, av) / tm : 0;
  const scL = fm > 0 && fOpp > 0 ? (m * fOpp) / (FIXED_DT * fm) : Infinity;
  const scA = tm > 0 && tOpp > 0 ? (I * tOpp) / (FIXED_DT * tm) : Infinity;
  return { scE, scL, scA, sc: Math.min(1, scE, scL, scA) };
}

/** One step at a prescribed state; recover the applied force (and torque) from the velocity change. */
function probe(dims, { lv = [0, 0, 0], av = [0, 0, 0], density = 1, lockRot = false }) {
  const sim = createSimulation(RAPIER, onePlan(dims, density), GENOME, WORLD,
    { bounded: false, motorScale: 0 });
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

console.log(`\n  _zplate · rho_eff ${RHO}  dt ${FIXED_DT.toFixed(5)}  MAX_SPEED ${MAX_SPEED} cm/s\n`);

// ══ TEST A · does the local copy reproduce the shipped law? ═══════════════════
{
  const L = 0.5, dims = [L, L, L], A = L * L, fs = faces(dims);
  console.log('  TEST A · translation, cube 0.5 — the harness against _dragmicro\'s known-good case');
  console.log('       v    F_analytic     F_engine    ratio      F_local    ratio');
  console.log('  ' + '-'.repeat(72));
  for (const v of [0.1, 1, 5, 9]) {
    const r = probe(dims, { lv: [v, 0, 0], lockRot: true });
    const loc = fluidUnguarded(fs, I3, [v, 0, 0], [0, 0, 0]);
    const Fa = 0.5 * RHO * A * v * v;
    console.log('  ' + String(v).padStart(6)
      + Fa.toFixed(4).padStart(13)
      + (-r.F[0]).toFixed(4).padStart(13)
      + (-r.F[0] / Fa).toFixed(3).padStart(9)
      + (-loc.F[0]).toFixed(4).padStart(13)
      + (-loc.F[0] / Fa).toFixed(3).padStart(9));
  }
  console.log('  → both columns must read 1.000. (v is kept under MAX_SPEED: above it,');
  console.log('    clampKinematics rewrites the state and the "force" is the clamp.)\n');
}

// ══ TEST B · F2 — the permanent record of why there is no lift term ══════════
// A thin plate whose big faces are +-Y, translating in the XY plane at incidence
// alpha to its own plane. The +Y face is windward. A real hydrofoil's lift acts
// toward the LEEWARD side, i.e. -Y here, so the correct sign is NEGATIVE.
//
// Both columns are the LOCAL law: the engine no longer has a lift path at all.
// This is the evidence for the deleted term, and it cross-checks gate L1-45 —
// L1-45 asserts the `off` column's sign on the shipped law.
{
  const dims = [2, 0.02, 2], fs = faces(dims);
  const n = [0, 1, 0];
  const crossOn = (F, u) => {
    const along = dot(F, u);
    return dot([F[0] - along * u[0], F[1] - along * u[1], F[2] - along * u[2]], n);
  };
  console.log('  TEST B · F2 — the DELETED lift term, modelled locally. Plate [2, 0.02, 2], |v| = 1.');
  console.log('           Fcross.n < 0 = LEEWARD = correct (a wing lifts to its suction side).\n');
  console.log('    alpha    no lift (shipped)   with lift (deleted)     ratio');
  console.log('  ' + '-'.repeat(66));
  const ratios = [];
  for (const deg of [5, 15, 30, 45, 60, 75]) {
    const a = deg * Math.PI / 180;
    const u = [Math.cos(a), Math.sin(a), 0];
    const co = crossOn(fluidUnguarded(fs, I3, u, [0, 0, 0], false).F, u);
    const cn = crossOn(fluidUnguarded(fs, I3, u, [0, 0, 0], true).F, u);
    ratios.push(cn / co);
    const side = (x) => (x < 0 ? 'leeward' : 'WINDWARD');
    console.log('  ' + `${deg}°`.padStart(7)
      + co.toFixed(4).padStart(12) + side(co).padStart(10)
      + cn.toFixed(4).padStart(15) + side(cn).padStart(10)
      + (cn / co).toFixed(3).padStart(11));
  }
  console.log('  ' + '-'.repeat(66));
  console.log(`  median ratio ${median(ratios).toFixed(3)}  — the deleted term cut the cross-flow`);
  console.log('  force to a fifth AND reversed it, at every incidence. Gate L1-45 holds the sign.\n');
}

// ══ TEST C · F4 — how much of the law's own rotational torque is delivered? ═══
// Plate rotating about Z (an in-plane, principal axis), zero linear velocity.
// Only the +-Y faces see flow; vn = omega*x, so exactly half of each face is
// windward. The continuum value of the SAME law over that half-face is
//     tau_z = -0.5 * rho * omega^2 * a^4 * b,    a = dx/2, b = dz/2
// (both faces summed). The 2x2 sample sits at x = dx/4 and returns half of it.
//
// THIS IS THE ACCEPTANCE INSTRUMENT FOR C6.4: the ratio should move to ~0.88.
{
  const dims = [2, 0.2, 2], fs = faces(dims);
  const a = dims[0] / 2, b = dims[2] / 2;
  console.log('  TEST C · F4 — rotational quadrature. Plate [2, 0.2, 2] spinning about Z, v = 0.');
  console.log(`           max spin for this body ${maxSpinOf(dims).toFixed(2)} rad/s (clampKinematics)\n`);
  console.log('    omega    tau_continuum     tau_engine    ratio      tau_local    ratio');
  console.log('  ' + '-'.repeat(74));
  for (const w of [0.5, 1, 2]) {
    const r = probe(dims, { av: [0, 0, w] });
    const loc = fluidUnguarded(fs, I3, [0, 0, 0], [0, 0, w]);
    const ta = -0.5 * RHO * w * w * a ** 4 * b;
    console.log('  ' + w.toFixed(2).padStart(7)
      + ta.toFixed(4).padStart(15)
      + r.T[2].toFixed(4).padStart(15)
      + (r.T[2] / ta).toFixed(3).padStart(9)
      + loc.T[2].toFixed(4).padStart(15)
      + (loc.T[2] / ta).toFixed(3).padStart(9));
  }
  console.log('  → 0.500 today (2x2 midpoint). C6.4 should take it to ~0.88.\n');
}

// ══ TEST D · F3 — on a real swimmer, does any guard bind? ════════════════════
// The eel from worlds/seeds.js, swimming under its own motors. Every step, for
// every body, the UNGUARDED force and torque are reconstructed from the state
// the engine itself saw, and the three caps are evaluated.
{
  const sd = SEEDS.find((s) => s.id === 'eel') ?? SEEDS[0];
  const genome = sd.genome ?? sd;
  const plan = morphogenesis(genome);
  const fs = plan.bodies.map((b) => faces(b.dims));
  const SETTLE = 2, T = 8;

  const sim = createSimulation(RAPIER, plan, genome, WORLD, { bounded: false, wrap: false });
  for (let k = 0; k < Math.round(SETTLE / FIXED_DT); k++) sim.step();
  let n = 0, bound = 0, lin = 0, eng = 0, ang = 0, zero = 0;
  const scAll = [];
  for (let k = 0; k < Math.round(T / FIXED_DT); k++) {
    for (let i = 0; i < plan.bodies.length; i++) {
      const rb = sim.bodies[i];
      const lvv = rb.linvel(), avv = rb.angvel(), q = rb.rotation();
      const lv = [lvv.x, lvv.y, lvv.z], av = [avv.x, avv.y, avv.z];
      const lq = qmul([q.x, q.y, q.z, q.w], plan.bodies[i].rotation);
      const { F, T: Tq } = fluidUnguarded(fs[i], rotm(lq), lv, av);
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
  console.log(`  TEST D · F3 — the guards on a real swimmer (${sd.id}, ${plan.bodyCount} bodies, ${T} s)\n`);
  console.log('   body-steps   any cap   linear   energy   angular   sc med   sc p10   sc=0');
  console.log('  ' + '-'.repeat(74));
  console.log('  ' + String(n).padStart(11)
    + p(bound).padStart(10) + p(lin).padStart(9) + p(eng).padStart(9) + p(ang).padStart(10)
    + median(scAll).toFixed(3).padStart(9) + pct(scAll, 0.10).toFixed(3).padStart(9)
    + p(zero).padStart(8));
  console.log('\n  → "sc=0" is the share of body-steps where the fluid contribution is');
  console.log('    DISCARDED ENTIRELY, not merely reduced. F3 predicted the LINEAR cap');
  console.log('    would dominate here; it does not bind at all. The prediction is dead.\n');
}
