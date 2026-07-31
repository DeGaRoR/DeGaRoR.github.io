// tools/_zdiv.mjs — EFFECTIVE BODY-PLAN VARIETY. The §2.2 gate reads this.
//
// Replaces tools/_diversity.mjs, which could not fail: its topology signature
// was built from `c.parentNodeId`/`c.childNodeId`, and those are GENERATED IDS
// (genome.js makeId), so every genome hashed to a unique string and the tool
// reported N distinct out of N for a whole session. Method note, session 10:
// "a signature built from generated ids can only ever return N distinct."
//
// WHAT IS COUNTED. The signature is the PHENOTYPE tree in canonical id-free
// form: a body's form is a function of the SORTED multiset of its children's
// forms, so two plans differing only in declaration order collapse together, and
// no id, dimension or colour enters. This is deliberately the coarsest reading —
// "how many different ANIMALS", not "how many different individuals". Dimensions
// are excluded on purpose: two creatures the player would call the same animal
// at a different size must not count as two shapes, and any signature carrying a
// float returns N distinct for the same reason _diversity.mjs did.
//
// WHICH NUMBER IS "VARIETY". Distinct-count is the wrong headline — 1500 shapes
// where three of them are 50% of the population is not variety. The headline is
// the Hill number of order 1, exp(Shannon), which is the number of EQUALLY
// COMMON shapes that would give the same entropy. Hill-2 (inverse Simpson) is
// printed beside it because it weights the common shapes harder and moves first.
//
// CORPUS IS PINNED, AND THE ABSOLUTE NUMBER IS CORPUS-SENSITIVE. `rngFrom('div',
// i)` for i < N, N = 2000 by default: this is the draw that reproduces the design
// document's mean of 3.91 bodies at shipped limits exactly. H1 itself moves about
// +-1.5 across seed namespaces at this N and rises with N (16.3 at 2000, 17.4 at
// 5000 on the same namespace) because it keeps counting rare shapes. So compare
// RUNS OF THIS TOOL against each other, never a run of this tool against a figure
// quoted from elsewhere.
//
//   node tools/_zdiv.mjs [N] [preset]
//   presets: current (default) · shipped · wide · full
import { fileURLToPath } from 'node:url';
import { rngFrom } from '../trunk/rng.js';
import { createRandomGenome, SLICE_LIMITS, FULL_LIMITS } from '../engine/l1/factory.js';
import { morphogenesis } from '../engine/l1/morphogen.js';

const N = Number(process.argv[2] ?? 2000);
const PRESET = process.argv[3] ?? 'current';

// The pre-B2 constants, restated as literals rather than read from the code, so
// `shipped` keeps meaning what it meant when the design was written even after
// SLICE_LIMITS moves. Same reason gate/l1.js L1-4 restates A2's caps.
export const PRESETS = {
  current: SLICE_LIMITS,
  shipped: { ...SLICE_LIMITS, maxReflectionAxes: 1, nodeCount: [2, 5], extraEdges: [0, 3],
             allowedFaces: [0, 1, 2, 3, 4, 5], reflectMinOffset: 0 },
  wide:    { ...SLICE_LIMITS, maxReflectionAxes: 3, nodeCount: [3, 7], extraEdges: [0, 3],
             allowedFaces: [0, 1, 2, 3, 4, 5], reflectMinOffset: 0 },
  full:    FULL_LIMITS,
};

/**
 * Canonical id-free form of a body plan, as a rooted tree. Exported because
 * _zdrift and _zratchet compare shapes and must not each invent their own.
 */
export function shapeSignature(plan) {
  const kids = new Map();
  for (const b of plan.bodies) {
    if (b.parent < 0) continue;
    if (!kids.has(b.parent)) kids.set(b.parent, []);
    kids.get(b.parent).push(b.index);
  }
  const walk = (i) => `(${(kids.get(i) || []).map(walk).sort().join('')})`;
  return walk(0);
}

export const hill1 = (counts, n) => Math.exp(
  -[...counts.values()].reduce((s, c) => s + (c / n) * Math.log(c / n), 0));
export const hill2 = (counts, n) =>
  1 / [...counts.values()].reduce((s, c) => s + (c / n) ** 2, 0);

export function measureVariety(limits, n = 2000, ns = 'div') {
  const counts = new Map();
  const sigs = [];
  let bodies = 0, discarded = 0, attempted = 0, singleJoint = 0, plans = 0;

  for (let i = 0; i < n; i++) {
    let p;
    try { p = morphogenesis(createRandomGenome(rngFrom(ns, i), limits)); } catch { continue; }
    plans++;
    const sig = shapeSignature(p);
    sigs.push(sig);
    counts.set(sig, (counts.get(sig) ?? 0) + 1);
    bodies += p.bodyCount;
    const rej = p.rejected.overlap + p.rejected.dimensions;
    discarded += rej;
    attempted += (p.bodyCount - 1) + rej;
    if (p.jointCount <= 1) singleJoint++;
  }

  // How many shapes it takes to cover half the population — the figure that
  // says whether the distinct-count is real or a long tail of singletons.
  const desc = [...counts.values()].sort((a, b) => b - a);
  let acc = 0, topHalf = 0;
  while (acc < plans / 2 && topHalf < desc.length) acc += desc[topHalf++];

  // Tanks of six, drawn as consecutive non-overlapping groups: this is the
  // player-facing statement, not a population statistic.
  let dupTanks = 0, tanks = 0;
  for (let i = 0; i + 6 <= sigs.length; i += 6) {
    tanks++;
    if (new Set(sigs.slice(i, i + 6)).size < 6) dupTanks++;
  }

  return {
    plans, distinct: counts.size,
    h1: hill1(counts, plans), h2: hill2(counts, plans),
    meanBodies: bodies / plans,
    discardPct: 100 * discarded / attempted,
    singleJointPct: 100 * singleJoint / plans,
    topHalf, dupTankPct: 100 * dupTanks / tanks,
  };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const limits = PRESETS[PRESET];
  if (!limits) { console.error(`unknown preset ${PRESET} — ${Object.keys(PRESETS).join(' | ')}`); process.exit(1); }
  const r = measureVariety(limits, N);

  console.log(`\n  _zdiv · ${N} genomes · preset ${PRESET}`);
  console.log(`  limits: reflectionAxes ${limits.maxReflectionAxes}  nodeCount [${limits.nodeCount}]  `
    + `extraEdges [${limits.extraEdges}]  faces [${limits.allowedFaces ?? '0..5'}]  `
    + `reflectMinOffset ${limits.reflectMinOffset ?? 0}\n`);
  console.log(`  EFFECTIVE VARIETY (H1)   ${r.h1.toFixed(1).padStart(8)}      gate: >= 155`);
  console.log(`  inverse Simpson  (H2)    ${r.h2.toFixed(1).padStart(8)}`);
  console.log(`  distinct shapes          ${String(r.distinct).padStart(8)}`);
  console.log(`  shapes covering half     ${String(r.topHalf).padStart(8)}`);
  console.log(`  single-joint creatures   ${r.singleJointPct.toFixed(1).padStart(7)}%      gate: <= 8%`);
  console.log(`  tanks of six w/ a dup    ${r.dupTankPct.toFixed(0).padStart(7)}%       gate: <= 40%`);
  console.log(`  mean bodies              ${r.meanBodies.toFixed(2).padStart(8)}`);
  console.log(`  limbs discarded          ${r.discardPct.toFixed(0).padStart(7)}%       (accepted — §2.4 geometry budget)\n`);
}
