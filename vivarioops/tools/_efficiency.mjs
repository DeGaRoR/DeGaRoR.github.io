// THE MEASURE THAT WAS MISSING: swimming efficiency.
//
//   efficiency = net displacement / COM path length
//
// A fish keeps its centre of mass almost on a line: efficiency ~0.9. A creature
// that thrashes has a COM path many times its progress. This is a CAPABILITY,
// not a bug — and it is exactly what selection should be reading. The corpus is
// RANDOM and unselected, so most of it should be terrible; the question is
// whether the good ones exist and whether the measure separates them.
//
// Also asks: can they STEER? Heading persistence over the run — a creature that
// holds a direction can be steered; one that random-walks cannot.
import RAPIER from '@dimforge/rapier3d-compat';
import { rngFrom } from '../trunk/rng.js';
import { createRandomGenome } from '../engine/l1/factory.js';
import { morphogenesis } from '../engine/l1/morphogen.js';
import { createSimulation, FIXED_DT } from '../engine/l1/physics.js';
import { DRIVE } from '../engine/l1/controller.js';
import W1_SLICE from '../worlds/w1_slice.js';
await RAPIER.init();
const SEC = 15, STEPS = Math.round(SEC/FIXED_DT), W = { ...W1_SLICE, gravity: 0 };
const N = Number(process.argv[2] ?? 60);
const corpus = [];
for (let i = 0; corpus.length < N && i < N*8; i++) {
  const g = createRandomGenome(rngFrom(0xC0DE ^ (i*2654435761)));
  const p = morphogenesis(g);
  if (p.jointCount >= 1) corpus.push({ g, p });
}
const pct=(a,q)=>{const s=[...a].sort((x,y)=>x-y);return s.length?s[Math.max(0,Math.round((s.length-1)*q))]:NaN;};
const MODE = process.argv[3] || 'pd';
const rows = [];
for (const { g, p } of corpus) {
  let sim; try { sim = createSimulation(RAPIER,p,g,W,{drive:DRIVE.POSITION,bounded:false,motor:MODE}); } catch { continue; }
  const c0 = sim.centreOfMass(); let prev = c0, path = 0, bad = false;
  const marks = [];                                   // COM every second, for heading
  try { for (let s=0;s<STEPS;s++){ sim.step();
    const c = sim.centreOfMass();
    if(!Number.isFinite(c[0]+c[1]+c[2])){bad=true;break;}
    path += Math.hypot(c[0]-prev[0],c[1]-prev[1],c[2]-prev[2]); prev = c;
    if (s % 120 === 0) marks.push([...c]);
  } } catch { bad = true; }
  const c1 = sim.centreOfMass(); sim.free();
  if (bad) continue;
  const net = Math.hypot(c1[0]-c0[0],c1[1]-c0[1],c1[2]-c0[2]);
  // heading persistence: mean cosine between consecutive one-second displacements
  let cos = 0, k = 0;
  for (let i = 2; i < marks.length; i++) {
    const a = [marks[i-1][0]-marks[i-2][0], marks[i-1][1]-marks[i-2][1], marks[i-1][2]-marks[i-2][2]];
    const b = [marks[i][0]-marks[i-1][0], marks[i][1]-marks[i-1][1], marks[i][2]-marks[i-1][2]];
    const na = Math.hypot(...a), nb = Math.hypot(...b);
    if (na > 1e-6 && nb > 1e-6) { cos += (a[0]*b[0]+a[1]*b[1]+a[2]*b[2])/(na*nb); k++; }
  }
  rows.push({ net: net/SEC, com: path/SEC, eff: net/Math.max(path,1e-9), persist: k?cos/k:0 });
}
console.log(`\nn=${rows.length}, ${SEC}s, motor=${MODE}\n`);
const q=(f)=>rows.map(f);
console.log(`  net speed        p10 ${pct(q(r=>r.net),0.1).toFixed(3)}  p50 ${pct(q(r=>r.net),0.5).toFixed(3)}  p90 ${pct(q(r=>r.net),0.9).toFixed(3)}  max ${Math.max(...q(r=>r.net)).toFixed(2)} m/s`);
console.log(`  COM path speed   p10 ${pct(q(r=>r.com),0.1).toFixed(2)}  p50 ${pct(q(r=>r.com),0.5).toFixed(2)}  p90 ${pct(q(r=>r.com),0.9).toFixed(2)}  max ${Math.max(...q(r=>r.com)).toFixed(1)} m/s`);
console.log(`  EFFICIENCY       p10 ${pct(q(r=>r.eff),0.1).toFixed(3)}  p50 ${pct(q(r=>r.eff),0.5).toFixed(3)}  p90 ${pct(q(r=>r.eff),0.9).toFixed(3)}  max ${Math.max(...q(r=>r.eff)).toFixed(3)}   (a fish ~0.9)`);
console.log(`  heading persist  p10 ${pct(q(r=>r.persist),0.1).toFixed(2)}  p50 ${pct(q(r=>r.persist),0.5).toFixed(2)}  p90 ${pct(q(r=>r.persist),0.9).toFixed(2)}   (+1 straight, 0 random walk)`);
const good = rows.filter(r=>r.eff>0.1), twitch = rows.filter(r=>r.eff<=0.02);
console.log(`\n  efficiency > 0.10 : ${good.length}/${rows.length} creatures   net p50 ${good.length?pct(good.map(r=>r.net),0.5).toFixed(3):'-'} m/s   COM p50 ${good.length?pct(good.map(r=>r.com),0.5).toFixed(2):'-'}  persist p50 ${good.length?pct(good.map(r=>r.persist),0.5).toFixed(2):'-'}`);
console.log(`  efficiency < 0.02 : ${twitch.length}/${rows.length} creatures   net p50 ${twitch.length?pct(twitch.map(r=>r.net),0.5).toFixed(3):'-'} m/s   COM p50 ${twitch.length?pct(twitch.map(r=>r.com),0.5).toFixed(2):'-'}  persist p50 ${twitch.length?pct(twitch.map(r=>r.persist),0.5).toFixed(2):'-'}`);
