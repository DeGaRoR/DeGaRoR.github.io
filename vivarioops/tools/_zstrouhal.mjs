// tools/_zstrouhal.mjs — THE DIMENSIONLESS REGIME. Are the creatures swimming,
// or slipping?
//
// Everything in this project is metres per second. Two numbers that decide
// whether motion READS as swimming have never been computed:
//
//   L/s   body-lengths per second. A real fish cruises 1–10. If ours do ~0.1,
//         they look static no matter how the physics is tuned.
//   St    Strouhal number, f·A/U (beat frequency × peak-to-peak tail amplitude ÷
//         forward speed). Efficient swimming across the animal kingdom sits at
//         0.2–0.4. A body beating far too fast for the speed it makes sits well
//         above that — it is slipping, and the wasted lateral motion is exactly
//         the wobble that broke turnRate3d and drowns the steering signal.
//
// THE HYPOTHESIS (flagged as one): a single mis-tuned constant — the controller's
// `omega` — puts the whole corpus near St ~ 2, and dropping it would raise speed
// while lowering St toward the efficient band. If so the slowness, the wobble and
// the dead steering are one constant, not four subsystems. This tool measures it;
// it does not change anything. Per PLAN-AFTER-B2 §5 a measurement carries no gate
// obligation and no version bump.
//
// METHOD (all measured, none commanded — the actuator is bandwidth-limited, so
// what a creature is TOLD to do and what it DOES are not the same number):
//   - free water: gravity 0, unbounded, no torus wrap, turnBias 0 (swim straight),
//     2 s settle to shed the spawn-constraint transient, then T s measured.
//   - U : net centre-of-mass displacement ÷ T. m/s.
//   - tail tip : the deepest body in the recursion (furthest limb), the analogue
//     of a fish's tail. Tracked relative to the COM to remove forward translation.
//   - A : peak-to-peak of the tip's excursion PERPENDICULAR to the travel axis —
//     the lateral throw of the tail. m.
//   - f : the ACHIEVED beat frequency, from zero-crossings of that same lateral
//     signal. Hz. Reported beside the COMMANDED f (omega·effort/2π) so the
//     bandwidth ceiling the handover found ("~6 rad/s at every effort") is visible.
//   - L : bounding diameter (2·boundingRadius), a body-length proxy.
//   - the sweep : `effort` multiplies `omega` inside the controller (controller.js
//     omega = genome.controller.omega · effort), so sweeping effort IS sweeping the
//     commanded frequency without mutating the genome. The corpus median of U and
//     St at each step is the finding: if U rises as effort falls while St drops,
//     the regime is the problem.
//
//   node tools/_zstrouhal.mjs [nRandom] [seconds]
import RAPIER from '@dimforge/rapier3d-compat';
import { rngFrom } from '../trunk/rng.js';
import { createRandomGenome } from '../engine/l1/factory.js';
import { morphogenesis, boundingRadius } from '../engine/l1/morphogen.js';
import { swimMetrics } from '../engine/l2/probe.js';
import { createSimulation, FIXED_DT } from '../engine/l1/physics.js';
import { SEEDS } from '../worlds/seeds.js';
import { W1_SLICE } from '../worlds/w1_slice.js';

const N = Number(process.argv[2] ?? 12);
const T = Number(process.argv[3] ?? 12);
const SETTLE = 2;
const EFFORTS = [0.5, 0.7, 1.0, 1.5, 2.5];   // omega sweep
const TWO_PI = Math.PI * 2;
await RAPIER.init();

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a) => Math.hypot(a[0], a[1], a[2]);
const unit = (a) => { const n = norm(a); return n > 1e-9 ? a.map((x) => x / n) : [0, 0, 0]; };
const median = (xs) => {
  const s = xs.filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  if (!s.length) return NaN;
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

// Uniform geometric shrink: scale every node's dims, so morphogenesis rebuilds a
// proportionally smaller creature (connection scales are ratios, unaffected).
const scaleGenome = (genome, s) => {
  const g = structuredClone(genome);
  for (const n of g.nodes) n.dims = n.dims.map((d) => d * s);
  return g;
};

// The tail: deepest body in the recursion, tie-broken by distance from the root.
function tipIndex(plan) {
  let best = 0, bd = -1, bdist = -1;
  for (const b of plan.bodies) {
    const d = b.depth, dist = norm(b.position);
    if (d > bd || (d === bd && dist > bdist)) { bd = d; bdist = dist; best = b.index; }
  }
  return best;
}

function measure(plan, genome, effort) {
  const sim = createSimulation(RAPIER, plan, genome, { ...W1_SLICE, gravity: 0 },
    { bounded: false, wrap: false, effort, turnBias: 0 });
  const tip = tipIndex(plan);
  for (let k = 0; k < Math.round(SETTLE / FIXED_DT); k++) sim.step();
  const c0 = sim.centreOfMass();
  const rel = [];
  const steps = Math.round(T / FIXED_DT);
  for (let k = 0; k < steps; k++) {
    sim.step();
    const c = sim.centreOfMass();
    const p = sim.bodies[tip].translation();
    rel.push([p.x - c[0], p.y - c[1], p.z - c[2]]);
  }
  const c1 = sim.centreOfMass();
  sim.free();

  const travel = norm(sub(c1, c0));
  const U = travel / T;
  const fwd = unit(sub(c1, c0));
  // The tail's motion PERPENDICULAR to travel, in an arbitrary orthonormal basis
  // (e1,e2) of that plane — so amplitude is independent of which plane a creature
  // happens to undulate in (the eels beat in their own local ±X, not the world's).
  let e1 = cross(fwd, [0, 1, 0]);
  if (norm(e1) < 1e-6) e1 = cross(fwd, [1, 0, 0]);
  e1 = unit(e1);
  const e2 = unit(cross(fwd, e1));
  const pa = rel.map((r) => { const p = sub(r, [dot(r, fwd) * fwd[0], dot(r, fwd) * fwd[1], dot(r, fwd) * fwd[2]]); return [dot(p, e1), dot(p, e2)]; });
  const ma = pa.reduce((s, p) => [s[0] + p[0], s[1] + p[1]], [0, 0]).map((x) => x / pa.length);
  const cen2 = pa.map((p) => [p[0] - ma[0], p[1] - ma[1]]);
  // Principal axis of the 2-D scatter (planar undulation is a line): project onto
  // it to get one signed oscillation, then A = peak-to-peak, f = zero-crossings.
  let saa = 0, sbb = 0, sab = 0;
  for (const [a, b] of cen2) { saa += a * a; sbb += b * b; sab += a * b; }
  const theta = 0.5 * Math.atan2(2 * sab, saa - sbb);
  const ax = [Math.cos(theta), Math.sin(theta)];
  const s = cen2.map((p) => p[0] * ax[0] + p[1] * ax[1]);
  const A = Math.max(...s) - Math.min(...s);          // peak-to-peak tail throw, m
  let cr = 0;
  for (let k = 1; k < s.length; k++) if ((s[k - 1] < 0) !== (s[k] < 0)) cr++;
  const f = cr / (2 * T);                              // achieved beat frequency, Hz
  const St = U > 1e-4 ? (f * A) / U : Infinity;
  const fCmd = (genome.controller.omega * effort) / TWO_PI;   // commanded fundamental, Hz
  return { U, f, fCmd, A, St };
}

// ── subjects: the authored library, then random factory creatures ─────────────
const subs = [];
for (const sd of SEEDS) {
  if (sd.id === 'staircase') continue;   // not a swimmer; excluded like _zwobble
  const g = sd.genome ?? sd;
  try { subs.push({ id: sd.id, genome: g, plan: morphogenesis(g) }); } catch { /* skip */ }
}
let n = 0;
for (let i = 0; n < N; i++) {
  const g = createRandomGenome(rngFrom('strouhal', i));
  let p; try { p = morphogenesis(g); } catch { continue; }
  if (p.bodyCount < 3) continue;
  subs.push({ id: `r${i}`, genome: g, plan: p }); n++;
}

// ── per-creature, at effort 1.0 ───────────────────────────────────────────────
console.log(`\n  _zstrouhal · ${T} s free water, gravity 0, straight swim · effort 1.0\n`);
console.log('  id             L(m)    U(m/s)     L/s      f(Hz)   fCmd(Hz)    A(m)      St');
console.log('  ' + '-'.repeat(78));
const base = [];
for (const s of subs) {
  const L = 2 * boundingRadius(s.plan);
  const m = measure(s.plan, s.genome, 1.0);
  // Same reduction the species record uses (engine/l2/probe.js), so the gauge and
  // the recorded field cannot drift apart.
  base.push({ id: s.id, L, ...m, Ls: swimMetrics(m.U, m.f, L).bodyLengthsPerSecond });
  console.log('  ' + s.id.padEnd(12)
    + L.toFixed(2).padStart(7)
    + m.U.toFixed(4).padStart(10)
    + (m.U / L).toFixed(3).padStart(9)
    + m.f.toFixed(2).padStart(9)
    + m.fCmd.toFixed(2).padStart(10)
    + m.A.toFixed(3).padStart(9)
    + (Number.isFinite(m.St) ? m.St.toFixed(2) : '  ∞').padStart(9));
}
console.log('  ' + '-'.repeat(78));
console.log('  median' + ' '.repeat(6)
  + median(base.map((b) => b.L)).toFixed(2).padStart(7)
  + median(base.map((b) => b.U)).toFixed(4).padStart(10)
  + median(base.map((b) => b.Ls)).toFixed(3).padStart(9)
  + median(base.map((b) => b.f)).toFixed(2).padStart(9)
  + median(base.map((b) => b.fCmd)).toFixed(2).padStart(10)
  + median(base.map((b) => b.A)).toFixed(3).padStart(9)
  + median(base.map((b) => b.St)).toFixed(2).padStart(9));

// ── the omega sweep: corpus medians at each effort ────────────────────────────
console.log(`\n  omega sweep (effort multiplies commanded frequency) — corpus medians\n`);
console.log('  effort   med U(m/s)   med L/s   med f(Hz)   med A(m)    med St');
console.log('  ' + '-'.repeat(62));
for (const e of EFFORTS) {
  const ms = subs.map((s) => ({ L: 2 * boundingRadius(s.plan), ...measure(s.plan, s.genome, e) }));
  console.log('  ' + e.toFixed(2).padStart(5)
    + median(ms.map((m) => m.U)).toFixed(4).padStart(12)
    + median(ms.map((m) => m.U / m.L)).toFixed(3).padStart(10)
    + median(ms.map((m) => m.f)).toFixed(2).padStart(11)
    + median(ms.map((m) => m.A)).toFixed(3).padStart(11)
    + median(ms.map((m) => m.St)).toFixed(2).padStart(10));
}
// ── size sweep: is L/s scale-free? ────────────────────────────────────────────
// Uniform geometric scaling of the node dims. L/s is a dimensionless ratio, so if
// it is INVARIANT the "choose the frame" lever is a mirage — the problem is L/s
// itself, which no camera or tank size can fix. If it MOVES with scale, the drag
// regime shifts and smaller creatures are a real lever.
const SIZES = [1.0, 0.5, 0.25];
console.log(`  size sweep (uniform genome-dim scale, effort 1.0) — corpus medians\n`);
console.log('  scale   med L(m)   med U(m/s)   med L/s    med St');
console.log('  ' + '-'.repeat(50));
for (const S of SIZES) {
  const ms = subs.map((s) => {
    const g = scaleGenome(s.genome, S);
    let p; try { p = morphogenesis(g); } catch { return null; }
    if (p.bodyCount < 1) return null;
    return { L: 2 * boundingRadius(p), ...measure(p, g, 1.0) };
  }).filter(Boolean);
  console.log('  ' + S.toFixed(2).padStart(5)
    + median(ms.map((m) => m.L)).toFixed(2).padStart(10)
    + median(ms.map((m) => m.U)).toFixed(4).padStart(12)
    + median(ms.map((m) => m.U / m.L)).toFixed(4).padStart(11)
    + median(ms.map((m) => m.St)).toFixed(2).padStart(9));
}

console.log('\n  Reading: efficient swimming is St 0.2–0.4 and L/s 1–10. If U rises as');
console.log('  effort falls while St drops toward that band, the regime is the finding.\n');
