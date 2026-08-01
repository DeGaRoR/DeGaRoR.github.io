// tools/_zgait.mjs — THROWAWAY. Does the gait inner loop move a random corpus?
//
// Reproduces RECONCILIATION §3 arm D: score each random morphology at BIRTH, then
// adapt its gait (freeze morphology, hill-climb the controller), then re-score.
// Target (C3.4): median L/s >= 0.035 and >= 6/12 above 0.02, search <= 32x4.
//
//   node tools/_zgait.mjs [nRandom] [candidates] [iterations]
import RAPIER from '@dimforge/rapier3d-compat';
import { rngFrom } from '../trunk/rng.js';
import { createRandomGenome } from '../engine/l1/factory.js';
import { morphogenesis, boundingRadius } from '../engine/l1/morphogen.js';
import { netSpeed } from '../engine/l2/objective.js';
import { adaptGait } from '../engine/l2/gait.js';
import { W1_SLICE } from '../worlds/w1_slice.js';

const N = Number(process.argv[2] ?? 12);
const CAND = Number(process.argv[3] ?? 8);
const ITER = Number(process.argv[4] ?? 3);
await RAPIER.init();

function ls(genome, simOpts = {}) {
  let plan; try { plan = morphogenesis(genome); } catch { return { Ls: 0, ok: false }; }
  if (plan.bodyCount < 2) return { Ls: 0, ok: false };
  const r = netSpeed(RAPIER, { plan, genome, world: W1_SLICE, simOpts });
  const L = 2 * boundingRadius(plan);
  return { Ls: (r.valid && L > 1e-9) ? r.score / L : 0, ok: r.valid };
}
const UNB = { boundTorque: false };
const median = (a) => { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y); return s[s.length >> 1]; };

const subs = [];
for (let i = 0; subs.length < N; i++) {
  const g = createRandomGenome(rngFrom('gait', i));
  let p; try { p = morphogenesis(g); } catch { continue; }
  if (p.bodyCount < 2) continue;
  subs.push(g);
}

console.log(`\n  _zgait · ${N} random creatures · (1+${CAND})x${ITER} = ${1 + CAND * ITER} evals/body\n`);
console.log('  #     birth   adapted(bounded)   adapted(unbounded)');
const birth = [], adaptedB = [], adaptedU = [];
subs.forEach((g, i) => {
  const b = ls(g).Ls;
  const aB = adaptGait(RAPIER, { genome: g, world: W1_SLICE, rng: rngFrom('adapt', i), candidates: CAND, iterations: ITER });
  const aU = adaptGait(RAPIER, { genome: g, world: W1_SLICE, rng: rngFrom('adapt', i), candidates: CAND, iterations: ITER, simOpts: UNB });
  const lB = ls(aB.genome).Ls, lU = ls(aU.genome, UNB).Ls;
  birth.push(b); adaptedB.push(lB); adaptedU.push(lU);
  console.log(`  ${String(i).padStart(2)}   ${b.toFixed(4)}       ${lB.toFixed(4)}             ${lU.toFixed(4)}`);
});
console.log('  ' + '-'.repeat(52));
const above = (a) => a.filter(x => x >= 0.02).length;
console.log(`  birth              : median ${median(birth).toFixed(4)}  above 0.02: ${above(birth)}/${N}`);
console.log(`  adapted (bounded)  : median ${median(adaptedB).toFixed(4)}  above 0.02: ${above(adaptedB)}/${N}`);
console.log(`  adapted (unbounded): median ${median(adaptedU).toFixed(4)}  above 0.02: ${above(adaptedU)}/${N}`);
console.log(`\n  target: median >= 0.035, >= ${Math.ceil(N / 2)}/${N} above 0.02 (plan measured this UNBOUNDED)\n`);
