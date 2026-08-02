// tools/_zforage.mjs — does the food model do anything, and is it FAIR?
//
// The first build failed on fairness rather than on mechanism: intake correlated
// with body mass at Spearman 0.94 and with swimming at -0.37, so the winning
// move was to be large and hold still. Question 3 is therefore the one that
// matters — if `eaten` still tracks mass, the mouth model has not fixed it.
import RAPIER from '@dimforge/rapier3d-compat';
import { rngFrom } from '../trunk/rng.js';
import { createRandomGenome } from '../engine/l1/factory.js';
import { morphogenesis, boundingRadius, totalMass } from '../engine/l1/morphogen.js';
import { makeFood, runForage, mouthsOf, FOOD_COUNT, FOOD_RADIUS, INGEST_RATE } from '../engine/l2/forage.js';
import { netSpeed } from '../engine/l2/objective.js';
import { SEEDS } from '../worlds/seeds.js';
import W1_SLICE from '../worlds/w1_slice.js';
await RAPIER.init();

const T = Number(process.argv[2] ?? 20);
const med = (xs) => { const s=[...xs].filter(Number.isFinite).sort((a,b)=>a-b); return s.length? (s.length%2? s[s.length>>1] : (s[(s.length>>1)-1]+s[s.length>>1])/2) : NaN; };
const spearman = (a, b) => {
  const rank = (v) => { const idx = v.map((x,i)=>[x,i]).sort((p,q)=>p[0]-q[0]); const r=new Array(v.length); idx.forEach(([,i],k)=>r[i]=k); return r; };
  const ra=rank(a), rb=rank(b), n=a.length, ma=(n-1)/2;
  let num=0,da=0,db=0;
  for(let i=0;i<n;i++){const x=ra[i]-ma,y=rb[i]-ma;num+=x*y;da+=x*x;db+=y*y;}
  return da&&db? num/Math.sqrt(da*db) : 0;
};

const subs = [];
for (const sd of SEEDS) { const g = sd.genome ?? sd; try { subs.push({ id: sd.id, g, p: morphogenesis(g) }); } catch {} }
for (let i=0,n=0; n<18; i++) {
  const g = createRandomGenome(rngFrom('forage', i));
  let p; try { p = morphogenesis(g); } catch { continue; }
  if (p.bodyCount < 3) continue;
  subs.push({ id:`r${i}`, g, p }); n++;
}

const f0 = makeFood(W1_SLICE);
console.log(`\n  _zforage · ${subs.length} creatures · ${T}s each · tank ${W1_SLICE.tankBounds.join('x')} cm\n`);
console.log('  1 · THE FOOD');
console.log(`      ${f0.items.length} items of ${f0.perItem.toFixed(3)} g, radius ${FOOD_RADIUS} cm`);
console.log(`      total ${f0.remaining().toFixed(2)} g (asked ${f0.initialTotal}) · ingest ${INGEST_RATE} g/s per mouth`);

const eaten=[], ls=[], mass=[], ratio=[], items=[], depl=[];
for (const s of subs) {
  const food = makeFood(W1_SLICE);
  const r = runForage(RAPIER, { plan: s.p, genome: s.g, world: W1_SLICE, food, seconds: T });
  if (!r.valid) continue;
  const ns = netSpeed(RAPIER, { plan: s.p, genome: s.g, world: W1_SLICE, seconds: 6 });
  eaten.push(r.eaten); mass.push(r.massBase); ratio.push(r.ratio); items.push(r.itemsEaten);
  ls.push(ns.valid ? ns.score / Math.max(2*boundingRadius(s.p),1e-9) : 0);
  depl.push(100 * (r.fieldStart - r.fieldEnd) / r.fieldStart);
}
console.log('\n  2 · WHAT GOT EATEN');
console.log(`      grams   p50 ${med(eaten).toFixed(3)}   max ${Math.max(...eaten).toFixed(3)}`);
console.log(`      items emptied  p50 ${med(items).toFixed(0)}   max ${Math.max(...items)}  of ${f0.items.length}`);
console.log(`      field consumed p50 ${med(depl).toFixed(2)}%   max ${Math.max(...depl).toFixed(2)}%`);
console.log('\n  3 · IS IT FAIR?  (Spearman — mass near 0 is the goal)');
console.log(`      eaten vs MASS             ${spearman(eaten, mass).toFixed(2)}    was 0.94 with body-absorption`);
console.log(`      eaten vs body-lengths/s   ${spearman(eaten, ls).toFixed(2)}    was -0.37`);
console.log('\n  4 · THE LEDGER  (intake / spend; >1 is surplus)');
console.log(`      ratio  p50 ${med(ratio).toExponential(3)}   min ${Math.min(...ratio).toExponential(2)}   max ${Math.max(...ratio).toExponential(2)}\n`);
