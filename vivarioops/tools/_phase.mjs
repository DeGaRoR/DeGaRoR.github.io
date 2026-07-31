// Is the CONTROLLER the reason body plan does not predict locomotion?
// computePhases() gives a joint its parent's phase plus the parent's phaseLag,
// so phase is a function of DEPTH ALONE. Siblings are always in unison.
// Three conditions, same creatures, same drag law, gravity zeroed:
//   as-is      genome phaseLag
//   unison     every phaseLag 0 — the degenerate case
//   scrambled  phaseLag randomised per joint — phase decoupled from depth
import RAPIER from '@dimforge/rapier3d-compat';
import { rngFrom } from '../trunk/rng.js';
import { createRandomGenome } from '../engine/l1/factory.js';
import { morphogenesis } from '../engine/l1/morphogen.js';
import { createSimulation, FIXED_DT } from '../engine/l1/physics.js';
import { computePhases, DRIVE } from '../engine/l1/controller.js';
import W1_SLICE from '../worlds/w1_slice.js';
await RAPIER.init();
const N = Number(process.argv[2] ?? 40), SEC = 15, STEPS = Math.round(SEC / FIXED_DT);
const W = { ...W1_SLICE, gravity: 0 };

const corpus = [];
for (let i = 0; corpus.length < N && i < N * 8; i++) {
  const g = createRandomGenome(rngFrom(0x9A5E ^ (i * 2654435761)));
  const p = morphogenesis(g);
  if (p.jointCount >= 2) corpus.push({ g, p });
}
const pct = (a, q) => { const s=[...a].sort((x,y)=>x-y); return s[Math.max(0,Math.round((s.length-1)*q))]; };
const rank = a => { const idx=a.map((v,i)=>[v,i]).sort((x,y)=>x[0]-y[0]); const r=[]; idx.forEach(([,i],k)=>r[i]=k); return r; };
const spear = (a,b) => { const ra=rank(a),rb=rank(b),n=a.length,m=(n-1)/2; let u=0,x=0,y=0;
  for(let i=0;i<n;i++){u+=(ra[i]-m)*(rb[i]-m);x+=(ra[i]-m)**2;y+=(rb[i]-m)**2;} return u/Math.sqrt(x*y); };

// how much phase diversity does the scheme actually produce?
let dist = [];
for (const { p } of corpus) {
  const ph = computePhases(p);
  const uniq = new Set([...ph].map(v => v.toFixed(6)));
  dist.push(uniq.size / p.jointCount);
}
console.log(`\ncorpus ${corpus.length}, ${SEC}s`);
console.log(`distinct phases / jointCount:  p10 ${pct(dist,0.1).toFixed(2)}  p50 ${pct(dist,0.5).toFixed(2)}  p90 ${pct(dist,0.9).toFixed(2)}`);

function run(mode, seed) {
  const rng = rngFrom(seed);
  const out = [];
  for (const { g, p } of corpus) {
    const plan = { ...p, joints: p.joints.map(j => ({ ...j,
      phaseLag: mode === 'asis' ? j.phaseLag : mode === 'unison' ? 0 : rng.f32() * 2 * Math.PI })) };
    let sim; try { sim = createSimulation(RAPIER, plan, g, W, { drive: DRIVE.POSITION, bounded: false }); }
    catch { out.push(null); continue; }
    const c0 = sim.centreOfMass(); let bad = false;
    try { for (let s = 0; s < STEPS; s++) { sim.step();
      if (s % 60 === 0) { const c = sim.centreOfMass(); if (!Number.isFinite(c[0]+c[1]+c[2])) { bad=true; break; } } } }
    catch { bad = true; }
    if (bad) { out.push(null); sim.free(); continue; }
    const c1 = sim.centreOfMass(); sim.free();
    out.push(Math.hypot(c1[0]-c0[0], c1[1]-c0[1], c1[2]-c0[2]));
  }
  return out;
}

const shape = corpus.map(({ p }) => {
  let area = 0, maxAsp = 1;
  for (const b of p.bodies) { const [x,y,z]=b.dims; area += 2*(x*y+y*z+z*x); maxAsp = Math.max(maxAsp, Math.max(x,y,z)/Math.min(x,y,z)); }
  return { area, maxAsp, n: p.bodyCount };
});

console.log('\nmode        n    travel p50   p90     rho(area) rho(aspect) rho(bodies)');
for (const [mode, seed] of [['asis',1],['unison',2],['scrambled',0xBEEF],['scrambled',0xF00D]]) {
  const r = run(mode, seed);
  const keep = [], sh = [];
  r.forEach((v,i) => { if (v != null && v < 500) { keep.push(v); sh.push(shape[i]); } });
  console.log(`${(mode+(seed===0xF00D?'*':'')).padEnd(11)} ${String(keep.length).padStart(2)}   ${pct(keep,0.5).toFixed(3).padStart(8)} ${pct(keep,0.9).toFixed(2).padStart(7)}` +
    `   ${spear(keep,sh.map(s=>s.area)).toFixed(2).padStart(7)}  ${spear(keep,sh.map(s=>s.maxAsp)).toFixed(2).padStart(8)}  ${spear(keep,sh.map(s=>s.n)).toFixed(2).padStart(9)}`);
}
