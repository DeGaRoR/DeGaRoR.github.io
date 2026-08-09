import RAPIER from '@dimforge/rapier3d-compat';
import { rngFrom } from '../trunk/rng.js';
import { createRandomGenome } from '../engine/l1/factory.js';
import { assessViability } from '../engine/l1/viability.js';
import W1_SLICE from '../worlds/w1_slice.js';
await RAPIER.init();
const hist = {}, chainHist = {}, branchHist = {};
let n = 0, t = 0;
while (n < 120 && t < 2400) {
  const g = createRandomGenome(rngFrom('morph','census',t++));
  const v = assessViability(RAPIER, g, W1_SLICE);
  if (!v.ok) continue; n++;
  const plan = v.plan;
  // recompute depth from the joint list, ignoring plan.bodies[].depth
  const parent = new Array(plan.bodies.length).fill(-1);
  for (const j of plan.joints) parent[j.childBody] = j.parentBody;
  const dep = plan.bodies.map((_, i) => { let d = 0, k = i; while (parent[k] >= 0) { k = parent[k]; d++; } return d; });
  const maxd = Math.max(...dep);
  hist[maxd] = (hist[maxd] || 0) + 1;
  // longest chain = maxd + 1 bodies; branching factor at root
  const kids = new Array(plan.bodies.length).fill(0);
  for (const p of parent) if (p >= 0) kids[p]++;
  branchHist[kids[0]] = (branchHist[kids[0]] || 0) + 1;
  chainHist[`${maxd+1}/${plan.bodies.length}`] = (chainHist[`${maxd+1}/${plan.bodies.length}`] || 0) + 1;
}
console.log('MAX DEPTH (recomputed from joints)');
for (const k of Object.keys(hist).sort((a,b)=>a-b)) console.log(`  depth ${k}: ${hist[k]} creatures  ${'#'.repeat(hist[k])}`);
console.log('\nCHILDREN OF ROOT');
for (const k of Object.keys(branchHist).sort((a,b)=>a-b)) console.log(`  ${k} kids: ${branchHist[k]}`);
console.log('\nplan.bodies[].depth field vs recomputed — sample of 5:');
let s = 0, tt = 0;
while (s < 5 && tt < 400) {
  const g = createRandomGenome(rngFrom('morph','census',tt++));
  const v = assessViability(RAPIER, g, W1_SLICE);
  if (!v.ok) continue; s++;
  const parent = new Array(v.plan.bodies.length).fill(-1);
  for (const j of v.plan.joints) parent[j.childBody] = j.parentBody;
  const dep = v.plan.bodies.map((_, i) => { let d = 0, k = i; while (parent[k] >= 0) { k = parent[k]; d++; } return d; });
  console.log(`  stored [${v.plan.bodies.map(b=>b.depth).join(',')}]  recomputed [${dep.join(',')}]`);
}
