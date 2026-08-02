// tools/_zfoodsweep.mjs — THROWAWAY: how dense must food be to be catchable?
// A mouth is a point; whether it ever finds anything is set by how much of the
// tank volume the items' proximity spheres actually cover.
import RAPIER from '@dimforge/rapier3d-compat';
import { rngFrom } from '../trunk/rng.js';
import { createRandomGenome } from '../engine/l1/factory.js';
import { morphogenesis } from '../engine/l1/morphogen.js';
import { makeFood, runForage } from '../engine/l2/forage.js';
import { SEEDS } from '../worlds/seeds.js';
import W1_SLICE from '../worlds/w1_slice.js';
await RAPIER.init();
const T = 300;
const med = (xs) => { const s=[...xs].sort((a,b)=>a-b); return s.length? s[s.length>>1] : NaN; };
const subs = [];
for (const sd of SEEDS) { const g = sd.genome ?? sd; try { subs.push({ g, p: morphogenesis(g) }); } catch {} }
for (let i=0,n=0; n<10; i++) {
  const g = createRandomGenome(rngFrom('forage', i));
  let p; try { p = morphogenesis(g); } catch { continue; }
  if (p.bodyCount < 3) continue; subs.push({ g, p }); n++;
}
const [W,H,D] = W1_SLICE.tankBounds, VOL = W*H*D;
console.log(`\n  tank ${VOL} cm^3 · ${subs.length} creatures · ${T}s\n`);
console.log('  count  radius   coverage   items eaten p50/max   grams p50');
console.log('  ' + '-'.repeat(62));
for (const [count, radius] of [[700,1.6],[700,2.4],[1400,2.0],[1400,2.6],[2200,2.4],[2200,3.0]]) {
  const cov = 1 - Math.exp(-count * (4/3)*Math.PI*radius**3 / VOL);
  const it=[], gr=[];
  for (const s of subs) {
    const food = makeFood(W1_SLICE, { count, radius });
    const r = runForage(RAPIER, { plan: s.p, genome: s.g, world: W1_SLICE, food, seconds: T });
    if (!r.valid) continue;
    it.push(r.itemsEaten); gr.push(r.eaten);
  }
  console.log('  ' + String(count).padStart(5) + radius.toFixed(1).padStart(8)
    + `${(cov*100).toFixed(0)}%`.padStart(11)
    + `${med(it)} / ${Math.max(...it)}`.padStart(21)
    + med(gr).toFixed(2).padStart(12));
}
