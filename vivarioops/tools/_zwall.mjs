// tools/_zwall.mjs — THROWAWAY: are the foragers stuck on the glass, and does a
// bigger tank fix it?
//
// THIS IS NOT A NEW FINDING. physics.js:697 already records it: "the tank
// boundary is ABSORBING. 30 random creatures over 240 s — median speed decays 4x
// and the median wall gap decays monotonically from 6.2 to 1.8, with a third of
// the corpus below 0.02 m/s in the final window. A creature random-walks, reaches
// a wall, and has no mechanism to leave. It takes 2-4 minutes to develop, which
// is why every 40 s test in this project showed nothing."
//
// The project's answer was THE TORUS — `wrap`, a finite volume with no boundary —
// and it carries an explicit condition: "WRAPPING IS SAFE HERE FOR A SPECIFIC
// REASON: creatures do not interact... The day that stops being true this needs a
// periodic broad-phase, not a translate."
//
// FORAGE IS THAT DAY. The cast shares one arena, so `wrap: false` is forced, and
// the absorbing boundary is back. This tool measures how bad it is in the forage
// configuration and what a bigger tank actually buys, so "the aquarium is too
// small" gets a number instead of an impression.
//
// NO FOOD HERE ON PURPOSE. Ingestion applies no force, so food cannot affect
// where a creature ends up; leaving it out isolates the boundary.
import RAPIER from '@dimforge/rapier3d-compat';
import { rngFrom } from '../trunk/rng.js';
import { morphogenesis, boundingRadius } from '../engine/l1/morphogen.js';
import { createArena, createSimulation, FIXED_DT } from '../engine/l1/physics.js';
import { seedPopulation } from '../engine/l1/breed.js';
import W1_SLICE from '../worlds/w1_slice.js';
await RAPIER.init();

const T = Number(process.argv[2] ?? 300);
const N = Number(process.argv[3] ?? 12);
const SAMPLE = 0.25;
const SCALES = [1, 2, 3];

const median = (a) => {
  if (!a.length) return NaN;
  const s = [...a].sort((x, y) => x - y);
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
};

const genomes = seedPopulation({
  RAPIER, rng: rngFrom('forage', 'pop'), world: W1_SLICE, population: N, authoredSlots: 2,
}).genomes;

console.log(`\n  ${N} creatures, SHARED arena (wrap off, as Forage runs it), ${T}s\n`);
console.log('  scale     tank cm   creature/tank   t_first_wall   %time on glass   speed first->last third   gap first->last');
console.log('  ' + '-'.repeat(116));

for (const scale of SCALES) {
  const bounds = W1_SLICE.tankBounds.map((b) => b * scale);
  const world = { ...W1_SLICE, tankBounds: bounds };
  const half = bounds.map((b) => b / 2);
  const arena = createArena(RAPIER, world, { bounded: true });
  const R = Math.min(bounds[0], bounds[2]) / 3;

  const cast = [];
  genomes.forEach((g, i) => {
    const a = (i / N) * Math.PI * 2;
    let plan, sim;
    try {
      plan = morphogenesis(g);
      sim = createSimulation(RAPIER, plan, g, world, {
        arena, wrap: false, origin: [Math.cos(a) * R, Math.sin(a) * (bounds[1] / 3), Math.sin(a) * R],
      });
    } catch { return; }
    cast.push({ i, sim, radius: boundingRadius(plan), gaps: [], speeds: [], tWall: NaN, prev: null });
  });

  const sims = cast.map((c) => c.sim);
  const steps = Math.round(T / FIXED_DT), every = Math.round(SAMPLE / FIXED_DT);
  for (let s = 0; s < steps; s++) {
    arena.stepAll(sims);
    if (s % every) continue;
    const now = s * FIXED_DT;
    for (const c of cast) {
      const p = c.sim.centreOfMass();
      if (!Number.isFinite(p[0] + p[1] + p[2])) continue;
      // Gap to the NEAREST face, in cm. Negative means the centre is outside.
      const gap = Math.min(half[0] - Math.abs(p[0]), half[1] - Math.abs(p[1]), half[2] - Math.abs(p[2]));
      c.gaps.push(gap);
      // "On the glass" = the body is touching it, i.e. the gap is inside the
      // creature's own radius. A size-independent threshold would call a big
      // creature stuck in open water and a small one free while it scrapes.
      if (!Number.isFinite(c.tWall) && gap <= c.radius) c.tWall = now;
      if (c.prev) c.speeds.push(Math.hypot(p[0] - c.prev[0], p[1] - c.prev[1], p[2] - c.prev[2]) / SAMPLE);
      c.prev = [p[0], p[1], p[2]];
    }
  }

  const third = (arr, k) => arr.slice(Math.floor((arr.length * k) / 3), Math.floor((arr.length * (k + 1)) / 3));
  const rows = cast.map((c) => ({
    onGlass: c.gaps.length ? c.gaps.filter((g) => g <= c.radius).length / c.gaps.length : 0,
    tWall: c.tWall,
    sp0: median(third(c.speeds, 0)), sp2: median(third(c.speeds, 2)),
    gap0: median(third(c.gaps, 0)), gap2: median(third(c.gaps, 2)),
    ratio: c.radius / (Math.min(...half)),
  }));
  const stuck = rows.filter((r) => Number.isFinite(r.tWall)).length;
  const tw = rows.map((r) => r.tWall).filter(Number.isFinite);

  console.log('  ' + `${scale}x`.padStart(4)
    + `${bounds[0]}x${bounds[1]}x${bounds[2]}`.padStart(14)
    + median(rows.map((r) => r.ratio)).toFixed(2).padStart(14)
    + (tw.length ? `${median(tw).toFixed(0)}s (${stuck}/${rows.length})` : `never (0/${rows.length})`).padStart(15)
    + `${(100 * median(rows.map((r) => r.onGlass))).toFixed(0)}%`.padStart(15)
    + `${median(rows.map((r) => r.sp0)).toFixed(3)} -> ${median(rows.map((r) => r.sp2)).toFixed(3)}`.padStart(26)
    + `${median(rows.map((r) => r.gap0)).toFixed(1)} -> ${median(rows.map((r) => r.gap2)).toFixed(1)}`.padStart(18));

  for (const c of cast) c.sim.free();
  arena.free();
}

console.log('\n  t_first_wall: first time the CENTRE comes within the creature\'s own radius of a face.');
console.log('  %time on glass: share of samples in that state. speed in cm/s, gap in cm, medians over the cast.');
console.log('  If speed falls and gap falls together, the boundary is ABSORBING — which is the');
console.log('  finding physics.js:697 already records, re-opened because Forage cannot wrap.\n');
