// THE TEST NEVER RUN: does SELECTION improve locomotion?
// Sims' demo creatures are the product of many generations. Ours are all
// generation zero. If displacement has gradient, the architecture works and it
// just has not been run. If it does not, no actuator fix will save it.
import RAPIER from '@dimforge/rapier3d-compat';
import { rngFrom } from '../trunk/rng.js';
import { createRandomGenome, SLICE_LIMITS } from '../engine/l1/factory.js';
import { morphogenesis } from '../engine/l1/morphogen.js';
import { mutateTimes } from '../engine/l1/mutate.js';
import { createSimulation, FIXED_DT } from '../engine/l1/physics.js';
import { DRIVE } from '../engine/l1/controller.js';
import W1_SLICE from '../worlds/w1_slice.js';
await RAPIER.init();
const POP = 24, GENS = Number(process.argv[2] ?? 10), SEC = 10;
const STEPS = Math.round(SEC/FIXED_DT), W = { ...W1_SLICE, gravity: 0 };
const MOTOR = process.argv[3] ?? 'solver';
const rng = rngFrom(0xE501);

function score(genome) {
  let plan; try { plan = morphogenesis(genome); } catch { return null; }
  if (plan.jointCount < 1) return null;
  let sim; try { sim = createSimulation(RAPIER, plan, genome, W, { drive: DRIVE.POSITION, bounded: false, motor: MOTOR }); } catch { return null; }
  const c0 = sim.centreOfMass(); let prev = c0, path = 0, bad = false;
  try { for (let s=0;s<STEPS;s++){ sim.step(); const c = sim.centreOfMass();
    if(!Number.isFinite(c[0]+c[1]+c[2])){bad=true;break;}
    path += Math.hypot(c[0]-prev[0],c[1]-prev[1],c[2]-prev[2]); prev = c; } } catch { bad = true; }
  const c1 = sim.centreOfMass(); const work = sim.work; sim.free();
  if (bad) return null;
  const net = Math.hypot(c1[0]-c0[0],c1[1]-c0[1],c1[2]-c0[2]);
  if (!Number.isFinite(net) || net > 1e4) return null;
  return { net, eff: net/Math.max(path,1e-9), path, work };
}

let pop = [];
while (pop.length < POP) { const g = createRandomGenome(rng); if (score(g)) pop.push(g); }
const pct=(a,q)=>{const s=[...a].sort((x,y)=>x-y);return s.length?s[Math.max(0,Math.round((s.length-1)*q))]:NaN;};
console.log(`\npopulation ${POP}, ${GENS} generations, ${SEC}s trials, motor='${MOTOR}', fitness = net displacement\n`);
console.log(' gen   best net   median net   best eff   median eff');
for (let gen = 0; gen <= GENS; gen++) {
  const scored = pop.map(g => ({ g, s: score(g) })).filter(x => x.s);
  scored.sort((a,b) => b.s.net - a.s.net);
  const nets = scored.map(x=>x.s.net), effs = scored.map(x=>x.s.eff);
  console.log(` ${String(gen).padStart(3)}   ${nets[0].toFixed(3).padStart(8)}   ${pct(nets,0.5).toFixed(3).padStart(10)}   ${effs[0].toFixed(3).padStart(8)}   ${pct(effs,0.5).toFixed(3).padStart(10)}`);
  if (gen === GENS) break;
  // elitist: keep top third, fill with mutants of them, one random stranger
  const keep = scored.slice(0, Math.max(2, Math.floor(scored.length/3))).map(x=>x.g);
  const next = [...keep];
  while (next.length < POP - 1) {
    const parent = keep[rng.int(keep.length)];
    const m = mutateTimes(parent, rngFrom(rng.u32()), 1 + rng.int(3), { limits: SLICE_LIMITS });
    if (score(m.genome)) next.push(m.genome);
  }
  let stranger = createRandomGenome(rng);
  while (!score(stranger)) stranger = createRandomGenome(rng);
  next.push(stranger);
  pop = next;
}
