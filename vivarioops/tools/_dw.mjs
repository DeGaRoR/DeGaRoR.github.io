import RAPIER from '@dimforge/rapier3d-compat';
import { runDuel } from '../engine/l2/duel.js';
import { W1_SLICE } from '../worlds/w1_slice.js';
import { W1_RESIDENT_GENOMES, W1_RESIDENT_IDS, W1_RESIDENT_HASHES } from '../worlds/w1_residents.js';
import { deserialise, genomeHash } from '../engine/l1/genome.js';
import { morphogenesis } from '../engine/l1/morphogen.js';
import { worldHash } from '../contracts/world.js';
import { S1 } from '../engine/l2/probes.js';
await RAPIER.init();
const WH = worldHash(W1_SLICE, W1_RESIDENT_HASHES);
const R = W1_RESIDENT_IDS.map((id) => {
  const genome = deserialise(W1_RESIDENT_GENOMES[id]);
  const plan = morphogenesis(genome);
  const s = S1(plan);
  return { id, genome, plan, hash: genomeHash(genome), reach: s.reach, s };
});
for (const r of R) console.log(r.id, 'reach', Number(r.reach).toFixed(2), 'bodies', r.plan.bodyCount, 'joints', r.plan.jointCount);
for (const [i, j] of [[0,1],[0,2],[1,2]]) {
  const d = runDuel(RAPIER, { a: R[i], b: R[j], world: W1_SLICE, worldHash: WH, repeat: 0 });
  console.log(`${i}v${j}`, JSON.stringify({ valid: d.valid, reason: d.reason, outcome: d.outcome, workA: +d.workA.toFixed(4), workB: +d.workB.toFixed(4), sep: +Number(d.separation).toFixed(2), minD: +Number(d.minDistance).toFixed(2), flagged: d.flagged }));
}
