// tools/_ztrail.mjs — THROWAWAY: what does a trajectory actually MEASURE?
//
// The Forage screen draws a never-forgetting trail of the mouth, and looking at
// six of them side by side is the sharpest thing on the screen: one creature
// leaves a dense scribble ball a body-length across, another a long clean thread
// most of the way over the tank. So the obvious next move is to turn the trail
// into a number — "distance travelled" — and that number is a trap.
//
// PATH LENGTH IS SCALE-DEPENDENT. Summing |dp| over samples measures the wiggle
// at the sampling rate, not the travel: sample twice as often and a thrashing
// creature's "distance" nearly doubles while a gliding one's barely moves. It is
// the coastline paradox, and it means any path length must state its ruler.
//
// This tool runs one shared-arena trial, records every mouth at 4 Hz (what the
// screen keeps), and scores five candidate metrics against the only thing that
// matters here — how much the creature ATE:
//
//   pathLength(tau)  sum |dp| after resampling at interval tau
//   netDisp          |p_end - p_start|
//   gyration         RMS distance of the trail from its own centroid
//   exploredVol      voxels of side 2r visited, x (2r)^3 — the volume the mouth
//                    could have reached, self-overlap removed
//   sweptNaive       pathLength(0.25s) x pi r^2 — the same thing WITHOUT removing
//                    overlap, i.e. the number you get if you trust path length
//
// The prediction, from the picture: exploredVol tracks eaten and pathLength does
// not, because the scribble ball re-visits water it has already stripped.
import RAPIER from '@dimforge/rapier3d-compat';
import { rngFrom } from '../trunk/rng.js';
import { morphogenesis, totalMass } from '../engine/l1/morphogen.js';
import { createArena, createSimulation, FIXED_DT } from '../engine/l1/physics.js';
import { seedPopulation } from '../engine/l1/breed.js';
import { makeFood, mouthsOf, mouthPoints, forageStep, ledger, INGEST_RATE } from '../engine/l2/forage.js';
import W1_SLICE from '../worlds/w1_slice.js';
await RAPIER.init();

const T = Number(process.argv[2] ?? 300);
const N = Number(process.argv[3] ?? 12);
const SAMPLE = 0.25;                      // 4 Hz — exactly what the screen keeps

const genomes = seedPopulation({
  RAPIER, rng: rngFrom('forage', 'pop'), world: W1_SLICE, population: N, authoredSlots: 2,
}).genomes;
const arena = createArena(RAPIER, W1_SLICE, { bounded: true });
const food = makeFood(W1_SLICE);
const R = Math.min(W1_SLICE.tankBounds[0], W1_SLICE.tankBounds[2]) / 3;

const cast = [];
genomes.forEach((g, i) => {
  const a = (i / N) * Math.PI * 2;
  let plan, sim;
  try {
    plan = morphogenesis(g);
    sim = createSimulation(RAPIER, plan, g, W1_SLICE, {
      arena, wrap: false, origin: [Math.cos(a) * R, Math.sin(a) * (W1_SLICE.tankBounds[1] / 3), Math.sin(a) * R],
    });
  } catch { return; }
  const mouths = mouthsOf(plan);
  cast.push({ i, plan, sim, mouths, buf: mouths.map(() => [0, 0, 0]), eaten: 0, mass: totalMass(plan), trail: [] });
});

const sims = cast.map((c) => c.sim);
const steps = Math.round(T / FIXED_DT), every = Math.round(SAMPLE / FIXED_DT);
for (let s = 0; s < steps; s++) {
  arena.stepAll(sims);
  for (const c of cast) c.eaten += forageStep(c.sim, c.plan, food, c.mouths, FIXED_DT, INGEST_RATE, c.buf);
  if (s % every === 0) {
    for (const c of cast) {
      const p = mouthPoints(c.sim, c.plan, c.mouths, c.buf)[0];
      if (p && Number.isFinite(p[0] + p[1] + p[2])) c.trail.push([p[0], p[1], p[2]]);
    }
  }
}

// ── the metrics ─────────────────────────────────────────────────────────────
const d3 = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

/** Path length after coarse-graining to every `k`-th sample. The ruler is k*SAMPLE. */
function pathLength(tr, k = 1) {
  let L = 0;
  for (let i = k; i < tr.length; i += k) L += d3(tr[i], tr[i - k]);
  return L;
}
function netDisp(tr) { return tr.length < 2 ? 0 : d3(tr[tr.length - 1], tr[0]); }
/** RMS distance from the trail's own centroid — "how big is the region it occupied". */
function gyration(tr) {
  if (!tr.length) return 0;
  const c = [0, 1, 2].map((a) => tr.reduce((s, p) => s + p[a], 0) / tr.length);
  return Math.sqrt(tr.reduce((s, p) => s + d3(p, c) ** 2, 0) / tr.length);
}
/**
 * THE UNION OF THE MOUTH'S REACH over the whole trajectory — the water it could
 * actually have eaten from, with every re-visit counted once.
 *
 * FIRST ATTEMPT WAS TOO COARSE TO TEST ANYTHING and is recorded because it looked
 * fine: one voxel of side 2r per sample gave 1-12 cells over a trial, so the
 * metric was quantised to about ten values and its correlation was measuring the
 * quantisation. The cell has to be well BELOW the radius it approximates, and
 * every cell within r of a sample has to be marked, not just the one the sample
 * landed in.
 */
function exploredVol(tr, r) {
  const h = r / 2, seen = new Set(), n = Math.ceil(r / h);
  for (const p of tr) {
    const cx = Math.round(p[0] / h), cy = Math.round(p[1] / h), cz = Math.round(p[2] / h);
    for (let i = -n; i <= n; i++) for (let j = -n; j <= n; j++) for (let k = -n; k <= n; k++) {
      if ((i * i + j * j + k * k) * h * h <= r * r) seen.add(`${cx + i},${cy + j},${cz + k}`);
    }
  }
  return seen.size * h ** 3;
}

/** Pearson r. Small n here, so this is an indication, not a result. */
function corr(xs, ys) {
  const n = xs.length, mx = xs.reduce((a, b) => a + b, 0) / n, my = ys.reduce((a, b) => a + b, 0) / n;
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) { const a = xs[i] - mx, b = ys[i] - my; sxy += a * b; sxx += a * a; syy += b * b; }
  return sxx > 0 && syy > 0 ? sxy / Math.sqrt(sxx * syy) : NaN;
}

const r = food.radius;
for (const c of cast) {
  c.m = {
    len025: pathLength(c.trail, 1),
    len1: pathLength(c.trail, 4),
    len4: pathLength(c.trail, 16),
    net: netDisp(c.trail),
    gyr: gyration(c.trail),
    vol: exploredVol(c.trail, r),
    swept: pathLength(c.trail, 1) * Math.PI * r * r,
  };
  // How straight the path is: 1 = a perfect line, ~0 = went nowhere.
  c.m.straight = c.m.len1 > 0 ? c.m.net / c.m.len1 : 0;
}

console.log(`\n  ${cast.length} creatures, shared arena, ${T}s, mouth sampled at ${1 / SAMPLE} Hz, food radius ${r} cm`);
console.log(`  food ${food.eatenCount()}/${food.items.length} items emptied\n`);
console.log('   #    eaten   L(0.25s)    L(1s)    L(4s)      net      Rg    explVol   sweptNaive   straight');
console.log('  ' + '-'.repeat(95));
for (const c of cast) {
  const m = c.m;
  console.log('  ' + String(c.i + 1).padStart(2)
    + c.eaten.toFixed(2).padStart(9)
    + m.len025.toFixed(1).padStart(11) + m.len1.toFixed(1).padStart(9) + m.len4.toFixed(1).padStart(9)
    + m.net.toFixed(1).padStart(9) + m.gyr.toFixed(2).padStart(8)
    + m.vol.toFixed(0).padStart(11) + m.swept.toFixed(0).padStart(13)
    + m.straight.toFixed(3).padStart(11));
}

const eaten = cast.map((c) => c.eaten);
console.log('\n  correlation with eaten (Pearson, n = ' + cast.length + ')');
for (const [k, label] of [['len025', 'path length @0.25s'], ['len1', 'path length @1s'], ['len4', 'path length @4s'],
  ['net', 'net displacement'], ['gyr', 'radius of gyration'], ['vol', 'explored volume'],
  ['swept', 'swept (naive)'], ['straight', 'straightness net/L(1s)']]) {
  console.log('   ' + label.padEnd(22) + corr(cast.map((c) => c.m[k]), eaten).toFixed(3).padStart(7));
}

// THE RULER MATTERS — the same trail, three sampling intervals.
console.log('\n  path length vs its own ruler (mean over the cast)');
const mean = (f) => cast.reduce((s, c) => s + f(c), 0) / cast.length;
console.log(`   @0.25 s ${mean((c) => c.m.len025).toFixed(1)} cm`);
console.log(`   @1 s    ${mean((c) => c.m.len1).toFixed(1)} cm  (${(100 * mean((c) => c.m.len1) / mean((c) => c.m.len025)).toFixed(0)}% of it)`);
console.log(`   @4 s    ${mean((c) => c.m.len4).toFixed(1)} cm  (${(100 * mean((c) => c.m.len4) / mean((c) => c.m.len025)).toFixed(0)}% of it)`);
console.log(`\n   mean explored volume ${mean((c) => c.m.vol).toFixed(0)} cm3 against naive swept ${mean((c) => c.m.swept).toFixed(0)} cm3`
  + ` — overlap discards ${(100 * (1 - mean((c) => c.m.vol) / mean((c) => c.m.swept))).toFixed(0)}%\n`);

for (const c of cast) c.sim.free();
arena.free();
