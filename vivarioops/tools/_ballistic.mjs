// Are they SWIMMING or JITTERING?
// Directed locomotion: net displacement grows LINEARLY with time (x ~ t).
// A random walk: it grows as sqrt(t). Tripling the duration therefore gives
// x3.00 for a swimmer and x1.73 for a diffuser. Also reports tortuosity —
// path length over net displacement — which is ~1 for a swimmer and large
// for something thrashing in place.
import RAPIER from '@dimforge/rapier3d-compat';
import { rngFrom } from '../trunk/rng.js';
import { createRandomGenome } from '../engine/l1/factory.js';
import { morphogenesis } from '../engine/l1/morphogen.js';
import { createSimulation, FIXED_DT } from '../engine/l1/physics.js';
import { DRIVE } from '../engine/l1/controller.js';
import W1_SLICE from '../worlds/w1_slice.js';
await RAPIER.init();
const N = Number(process.argv[2] ?? 30);
const W = { ...W1_SLICE, gravity: 0 };
const DURS = [5, 15, 45, 135];
const corpus = [];
for (let i = 0; corpus.length < N && i < N * 8; i++) {
  const g = createRandomGenome(rngFrom(0x5EED ^ (i * 2654435761)));
  const p = morphogenesis(g);
  if (p.jointCount >= 1) corpus.push({ g, p });
}
const pct=(a,q)=>{const s=[...a].sort((x,y)=>x-y);return s[Math.max(0,Math.round((s.length-1)*q))];};

const net = DURS.map(()=>[]), tort = [];
for (const { g, p } of corpus) {
  let sim; try { sim = createSimulation(RAPIER, p, g, W, { drive: DRIVE.POSITION, bounded: false }); } catch { continue; }
  const c0 = sim.centreOfMass();
  let prev = c0, path = 0, bad = false, k = 0;
  const maxSteps = Math.round(DURS[DURS.length-1]/FIXED_DT);
  const marks = DURS.map(d => Math.round(d/FIXED_DT));
  const got = [];
  try {
    for (let s = 1; s <= maxSteps; s++) {
      sim.step();
      if (s % 12 === 0) { const c = sim.centreOfMass();
        if (!Number.isFinite(c[0]+c[1]+c[2])) { bad = true; break; }
        path += Math.hypot(c[0]-prev[0], c[1]-prev[1], c[2]-prev[2]); prev = c; }
      if (s === marks[k]) { const c = sim.centreOfMass();
        got.push(Math.hypot(c[0]-c0[0], c[1]-c0[1], c[2]-c0[2])); k++; }
    }
  } catch { bad = true; }
  sim.free();
  if (bad || got.length < DURS.length || got.some(v=>!Number.isFinite(v)||v>1e4)) continue;
  got.forEach((v,i)=>net[i].push(v));
  if (got[DURS.length-1] > 1e-6) tort.push(path / got[DURS.length-1]);
}
console.log(`\nn = ${net[0].length}  (gravity 0, unbounded, per-face drag law)\n`);
console.log('  duration   net displacement p50   growth vs previous');
for (let i=0;i<DURS.length;i++) {
  const m = pct(net[i],0.5);
  const g = i ? (m/pct(net[i-1],0.5)) : NaN;
  console.log(`  ${String(DURS[i]).padStart(5)} s   ${m.toFixed(3).padStart(16)}   ${i? g.toFixed(2)+'x':'--'}`);
}
console.log(`\n  expected growth per 3x duration:  swimmer 3.00x   random walk 1.73x`);
console.log(`  tortuosity (path / net) p50 ${pct(tort,0.5).toFixed(1)}  p90 ${pct(tort,0.9).toFixed(1)}   (a swimmer is ~1)`);
