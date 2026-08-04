// tools/_zrecur.mjs — THROWAWAY: what does SLICE_LIMITS.maxRecursion actually cost
// and buy?
//
// THE FINDING BEHIND IT. `RANGE.recursiveLimit` is [1, 6] — the grammar can express
// a six-segment chain — but `SLICE_LIMITS.maxRecursion` is 2 (the comment says
// "full: 6"), so factory.js draws recursiveLimit from [1, 2] and no chain longer
// than about two segments can ever be generated. Measured over 600 draws:
// longestRun >= 4 occurred ZERO times, against 6-7 for every authored creature.
//
// The Eel is ONE node connected to itself with recursiveLimit 6. The "authored
// geometry" that felt like cheating is precisely the thing the slice forbids.
//
// 44% of random genomes already draw a self-connection, so the mechanism is being
// used — it is only prevented from repeating. This sweeps the clamp and reports
// what opens up, and what it costs, because the clamp presumably exists for a
// reason (maxNodes 8 at full recursion is documented as "24 bodies instantiated").
import RAPIER from '@dimforge/rapier3d-compat';
import { createRandomGenome, SLICE_LIMITS } from '../engine/l1/factory.js';
import { morphogenesis } from '../engine/l1/morphogen.js';
import { signature } from '../engine/l1/naming.js';
import { assessViability } from '../engine/l1/viability.js';
import { createArena, createSimulation, FIXED_DT } from '../engine/l1/physics.js';
import { rngFrom } from '../trunk/rng.js';
import W1_SLICE from '../worlds/w1_slice.js';
await RAPIER.init();

const N = Number(process.argv[2] ?? 400);
const VIA = Number(process.argv[3] ?? 60);       // how many to viability-check
const pct = (a, f) => `${((100 * a.filter(f).length) / Math.max(1, a.length)).toFixed(0)}%`;
const med = (a) => { const s = [...a].sort((x, y) => x - y); return s[s.length >> 1] ?? 0; };

console.log(`\n  ${N} draws per setting, viability on ${VIA}, step cost on 6\n`);
console.log('  maxRec   bodies med/p90   longestRun med/max   run>=4   run>=6   viable   ms/creature-s');
console.log('  ' + '-'.repeat(96));

for (const m of [2, 3, 4, 6]) {
  const limits = { ...SLICE_LIMITS, maxRecursion: m };
  // ONE rng stream per setting, seeded identically, so the draws are as comparable
  // as a changed parameter allows.
  const rng = rngFrom('recur', 'sweep', m);
  const recs = [], keep = [];
  for (let i = 0; i < N; i++) {
    let g, plan, s;
    try { g = createRandomGenome(rng, limits); plan = morphogenesis(g); s = signature(plan, g); } catch { continue; }
    recs.push({ n: plan.bodyCount, run: s.longestRun });
    if (keep.length < VIA) keep.push(g);
  }
  let ok = 0;
  for (const g of keep) { try { if (assessViability(RAPIER, g, W1_SLICE).ok) ok++; } catch { /* count as unviable */ } }

  // Step cost: six creatures in one arena, 20 s, wall per creature-second.
  const arena = createArena(RAPIER, W1_SLICE, { bounded: false });
  const sims = [];
  for (const g of keep.slice(0, 6)) {
    try { sims.push(createSimulation(RAPIER, morphogenesis(g), g, W1_SLICE, { arena, wrap: false })); } catch { /* skip */ }
  }
  const t0 = Date.now();
  for (let i = 0; i < Math.round(20 / FIXED_DT); i++) arena.stepAll(sims);
  const msPerCs = ((Date.now() - t0) / (20 * Math.max(1, sims.length))) ;
  for (const s of sims) s.free();
  arena.free();

  const bodies = recs.map((r) => r.n).sort((a, b) => a - b);
  const runs = recs.map((r) => r.run);
  console.log('  ' + String(m).padStart(6)
    + `${med(bodies)} / ${bodies[Math.floor(bodies.length * 0.9)] ?? 0}`.padStart(15)
    + `${med(runs)} / ${Math.max(...runs)}`.padStart(21)
    + pct(recs, (r) => r.run >= 4).padStart(9)
    + pct(recs, (r) => r.run >= 6).padStart(9)
    + `${((100 * ok) / Math.max(1, keep.length)).toFixed(0)}%`.padStart(9)
    + msPerCs.toFixed(1).padStart(16));
}
console.log('\n  shipped is maxRecursion 2. The authored creatures all sit at longestRun 6-7.');
console.log('  ms/creature-s is the hot-loop cost: 5.4 was the figure every budget in');
console.log('  HANDOVER-FORAGE section 21 was priced against.\n');
