// tools/hydro.js — SESSION DIAGNOSTIC. Not part of the gate.
//
// Answers three questions with numbers rather than adjectives:
//   1. How much faster is buoyant drift than locomotion, per creature?
//   2. Where does that ratio come from — the density range, the gravity field,
//      or the drag law?
//   3. Does the reference implementation's per-face fluid model change it?
//
// Uses tools/_hydro_physics.mjs, a lab copy of engine/l1/physics.js in which the
// fluid law is a parameter. The engine itself is untouched.
//
//   node tools/hydro.js [N] [--seconds 15]

import RAPIER from '@dimforge/rapier3d-compat';
import { rngFrom } from '../trunk/rng.js';
import { createRandomGenome } from '../engine/l1/factory.js';
import { morphogenesis } from '../engine/l1/morphogen.js';
import { createSimulation, FIXED_DT, WALL } from './_hydro_physics.mjs';
import { DRIVE } from '../engine/l1/controller.js';
import W1_SLICE from '../worlds/w1_slice.js';

await RAPIER.init();

const N = Number(process.argv[2] ?? 60);
const SECONDS = Number(process.argv[process.argv.indexOf('--seconds') + 1] ?? 15) || 15;
const STEPS = Math.round(SECONDS / FIXED_DT);

const pct = (a, p) => {
  if (!a.length) return NaN;
  const s = [...a].sort((x, y) => x - y);
  const i = (s.length - 1) * p;
  const lo = Math.floor(i), hi = Math.ceil(i);
  return s[lo] + (s[hi] - s[lo]) * (i - lo);
};
const med = (a) => pct(a, 0.5);
const fmt = (x, d = 3) => (Number.isFinite(x) ? x.toFixed(d) : 'n/a');

// ── corpus ───────────────────────────────────────────────────────────────────
const corpus = [];
for (let i = 0; corpus.length < N && i < N * 6; i++) {
  const rng = rngFrom(0xC0FFEE ^ (i * 2654435761));
  const genome = createRandomGenome(rng);
  const plan = morphogenesis(genome);
  if (plan.bodyCount < 2) continue;
  corpus.push({ genome, plan });
}

/** Mass-weighted mean density and total volume, straight from the plan. */
function bulk(plan) {
  let m = 0, v = 0;
  for (const b of plan.bodies) {
    const vol = b.dims[0] * b.dims[1] * b.dims[2];
    v += vol; m += vol * b.density;
  }
  return { mass: m, volume: v, density: m / v };
}

/**
 * @param {object} o `{ fluid, buoyancy, gravityOn, bounded, motorScale }`
 * @returns per-creature metrics
 */
function run(o = {}) {
  const { fluid = 'projected', buoyancy = true, gravityOn = true, bounded = false,
          motorScale = undefined, world = W1_SLICE, lift, fluidGuard } = o;
  const out = [];
  for (const { genome, plan } of corpus) {
    let sim;
    try {
      sim = createSimulation(RAPIER, plan, genome, world, {
        drive: DRIVE.POSITION, fluid, buoyancy, gravityOn, bounded, motorScale,
        lift, fluidGuard,
      });
    } catch { out.push(null); continue; }

    const c0 = sim.centreOfMass();
    let bad = false, peak = 0, hitFloor = false, hitSurface = false;
    let vyPeak = 0;
    try {
      for (let s = 0; s < STEPS; s++) {
        // Probe BEFORE stepping: a wasm panic names the place that noticed, not
        // the place that broke (HANDOFF, B3).
        if (!sim.finite()) { bad = true; break; }
        sim.step();
        if (s % 12 === 0) {
          const c = sim.centreOfMass();
          if (!Number.isFinite(c[0] + c[1] + c[2])) { bad = true; break; }
          for (const rb of sim.bodies) {
            const v = rb.linvel();
            const sp = Math.hypot(v.x, v.y, v.z);
            if (sp > peak) peak = sp;
            if (Math.abs(v.y) > Math.abs(vyPeak)) vyPeak = v.y;
          }
          if (bounded) {
            if (c[1] < world.floor.y + 1.0) hitFloor = true;
            if (c[1] > world.surface.y - 1.0) hitSurface = true;
          }
        }
      }
    } catch { bad = true; }

    if (bad) { out.push(null); sim.free(); continue; }
    const c1 = sim.centreOfMass();
    const horiz = Math.hypot(c1[0] - c0[0], c1[2] - c0[2]);
    const vert = Math.abs(c1[1] - c0[1]);
    const work = sim.work;
    sim.free();
    out.push({ horiz, vert, work, peak, vyPeak, hitFloor, hitSurface,
               bulk: bulk(plan), bodies: plan.bodyCount });
  }
  return out;
}

function report(label, rows) {
  const ok = rows.filter(Boolean);
  const h = ok.map(r => r.horiz), v = ok.map(r => r.vert), p = ok.map(r => r.peak);
  const pin = ok.filter(r => r.hitFloor || r.hitSurface).length;
  console.log(
    `${label.padEnd(38)} n=${String(ok.length).padStart(3)}/${rows.length}` +
    `  horiz p50 ${fmt(med(h))} p90 ${fmt(pct(h, 0.9))}` +
    `  vert p50 ${fmt(med(v))}` +
    `  peak p50 ${fmt(med(p), 2)} p95 ${fmt(pct(p, 0.95), 1)}` +
    (pin ? `  pinned ${pin}/${ok.length}` : ''));
  return ok;
}

// ── 1. the static picture, from the plan alone ───────────────────────────────
console.log(`\ncorpus: ${corpus.length} creatures, ${SECONDS} s runs, dt ${FIXED_DT}`);
const bulks = corpus.map(c => bulk(c.plan));
const dens = bulks.map(b => b.density);
console.log(`\n-- 1. bulk density, mass-weighted (medium = ${W1_SLICE.mediumDensity}) --`);
console.log(`  p10 ${fmt(pct(dens, 0.1))}  p50 ${fmt(med(dens))}  p90 ${fmt(pct(dens, 0.9))}`);
const netAcc = dens.map(d => Math.abs(W1_SLICE.gravity * (W1_SLICE.mediumDensity / d - 1)));
console.log(`  |net buoyant accel| m/s^2   p10 ${fmt(pct(netAcc, 0.1), 2)}  p50 ${fmt(med(netAcc), 2)}  p90 ${fmt(pct(netAcc, 0.9), 2)}`);
const neutralFrac = dens.filter(d => Math.abs(d - 1) < 0.05).length / dens.length;
console.log(`  fraction within 5% of neutral: ${(neutralFrac * 100).toFixed(0)}%`);

// Terminal vertical speed for a cube of the same volume, projected-area drag.
const vterm = bulks.map(b => {
  const L = Math.cbrt(b.volume);
  const dRho = Math.abs(W1_SLICE.mediumDensity - b.density);
  const A = L * L;
  const Cd = W1_SLICE.dragCoefficient * W1_SLICE.dragScale;
  return Math.sqrt(2 * dRho * b.volume * W1_SLICE.gravity / (W1_SLICE.mediumDensity * Cd * A));
});
console.log(`  analytic terminal |v_y| m/s p10 ${fmt(pct(vterm, 0.1), 2)}  p50 ${fmt(med(vterm), 2)}  p90 ${fmt(pct(vterm, 0.9), 2)}`);

// ── 2. drift vs locomotion, measured ────────────────────────────────────────
console.log(`\n-- 2. drift vs locomotion, unbounded, projected-area drag --`);
const drift = report('gravity ON,  motors OFF (drift)', run({ gravityOn: true, bounded: false, motorScale: 0 }));
const swim0 = report('gravity OFF, motors ON  (swim)', run({ gravityOn: false, bounded: false }));
const both = report('gravity ON,  motors ON', run({ gravityOn: true, bounded: false }));
const ratios = [];
for (let i = 0; i < corpus.length; i++) {
  const d = drift[i], s = swim0[i];
  if (d && s && s.horiz > 1e-9) ratios.push(d.vert / s.horiz);
}
console.log(`  per-creature drift/swim ratio  p10 ${fmt(pct(ratios, 0.1), 1)}  p50 ${fmt(med(ratios), 1)}  p90 ${fmt(pct(ratios, 0.9), 1)}`);

// ── 3. in the tank ──────────────────────────────────────────────────────────
console.log(`\n-- 3. the bounded tank, which is where duels happen --`);
report('tank, gravity ON', run({ gravityOn: true, bounded: true }));
report('tank, buoyancy neutralised', run({ gravityOn: false, bounded: true }));

// ── 4. candidate fixes, one variable at a time ──────────────────────────────
console.log(`\n-- 4. candidates, gravity ON, bounded tank, projected drag --`);
const narrow = (lo, hi) => {
  const c = corpus.map(({ genome, plan }) => ({
    genome,
    plan: { ...plan, bodies: plan.bodies.map(b => ({ ...b,
      density: Math.min(hi, Math.max(lo, b.density)) })) },
  }));
  return c;
};
for (const [lo, hi] of [[0.9, 1.1], [0.97, 1.03], [1, 1]]) {
  const saved = corpus.map(c => c.plan);
  const c2 = narrow(lo, hi);
  for (let i = 0; i < corpus.length; i++) corpus[i].plan = c2[i].plan;
  report(`density clamped to [${lo}, ${hi}]`, run({ gravityOn: true, bounded: true }));
  for (let i = 0; i < corpus.length; i++) corpus[i].plan = saved[i];
}
for (const ds of [4, 16]) {
  report(`dragScale x${ds}`, run({ gravityOn: true, bounded: true, world: { ...W1_SLICE, dragScale: ds } }));
}

// ── 5. the reference fluid model ────────────────────────────────────────────
console.log(`\n-- 5. reference per-face fluid model (ApplyFluidForcesSystem.cs) --`);
report('faces, gravity OFF, unbounded', run({ fluid: 'faces', gravityOn: false, bounded: false }));
report('faces, gravity ON,  tank', run({ fluid: 'faces', gravityOn: true, bounded: true }));
report('faces, gravity OFF, tank', run({ fluid: 'faces', gravityOn: false, bounded: true }));
console.log('');

console.log(`-- 6. isolating the instability in the face model --`);
report('faces, no lift, g OFF, unbounded', run({ fluid: 'faces', lift: false, gravityOn: false, bounded: false }));
report('faces, magnitude guard only', run({ fluid: 'faces', fluidGuard: 'magnitude', gravityOn: false, bounded: false }));
report('faces + energy guard, g OFF, unbnd', run({ fluid: 'faces', gravityOn: false, bounded: false }));
report('faces + energy guard, neutral tank', run({ fluid: 'faces', gravityOn: false, bounded: true }));
report('faces + energy guard, tank g ON', run({ fluid: 'faces', gravityOn: true, bounded: true }));
console.log('');
console.log(`-- 7. with the ANGULAR energy guard as well --`);
report('faces+lift, both guards, g OFF', run({ fluid: 'faces', gravityOn: false, bounded: false }));
report('faces+lift, both guards, tank g0', run({ fluid: 'faces', gravityOn: false, bounded: true }));
report('faces+lift, both guards, tank g ON', run({ fluid: 'faces', gravityOn: true, bounded: true }));
report('faces, no lift, both guards, g0 tank', run({ fluid: 'faces', lift: false, gravityOn: false, bounded: true }));
console.log('');
// ── 8. does body plan matter, and can the genome even build a fin? ──────────
console.log('-- 8. morphology: what the genome can express, and whether it matters --');
const shape = corpus.map(({ plan }) => {
  let area = 0, vol = 0, maxAsp = 1;
  for (const b of plan.bodies) {
    const [x, y, z] = b.dims;
    area += 2 * (x * y + y * z + z * x);
    vol += x * y * z;
    maxAsp = Math.max(maxAsp, Math.max(x, y, z) / Math.min(x, y, z));
  }
  return { area, vol, maxAsp, n: plan.bodyCount, slender: area / Math.cbrt(vol * vol) };
});
const asp = shape.map(s => s.maxAsp);
console.log(`  max aspect ratio per creature  p50 ${fmt(med(asp), 2)}  p90 ${fmt(pct(asp, 0.9), 2)}  max ${fmt(Math.max(...asp), 2)}`);
console.log(`  genome ceiling (RANGE.dim 0.2..2.0) = 10.00 : a 2.0 x 0.2 x 2.0 plate IS representable`);
console.log(`  wetted area / volume^(2/3)     p50 ${fmt(med(shape.map(s => s.slender)), 2)}  (sphere 4.84, cube 6.00)`);

const rank = (a) => {
  const idx = a.map((v, i) => [v, i]).sort((x, y) => x[0] - y[0]);
  const r = new Array(a.length);
  idx.forEach(([, i], k) => { r[i] = k; });
  return r;
};
const spearman = (a, b) => {
  const ra = rank(a), rb = rank(b), n = a.length;
  const ma = (n - 1) / 2;
  let num = 0, da = 0, db = 0;
  for (let i = 0; i < n; i++) { num += (ra[i] - ma) * (rb[i] - ma); da += (ra[i] - ma) ** 2; db += (rb[i] - ma) ** 2; }
  return num / Math.sqrt(da * db);
};
for (const [label, opts] of [
  ['projected (current)', { gravityOn: false, bounded: false }],
  ['faces, no lift', { fluid: 'faces', lift: false, gravityOn: false, bounded: false }],
]) {
  const rows = run(opts);
  const keep = [], sh = [];
  rows.forEach((r, i) => { if (r && r.peak < 60) { keep.push(r.horiz); sh.push(shape[i]); } });
  console.log(`  ${label.padEnd(22)} n=${keep.length}` +
    `  rho(travel, area) ${fmt(spearman(keep, sh.map(s => s.area)), 2)}` +
    `  rho(travel, aspect) ${fmt(spearman(keep, sh.map(s => s.maxAsp)), 2)}` +
    `  rho(travel, bodies) ${fmt(spearman(keep, sh.map(s => s.n)), 2)}`);
}
console.log('');
