// The command implies joint speeds ~1 rad/s. Measured peak spin is 150+.
// Where does it come from — the motor, or the fluid? Setting mediumDensity 0
// removes every fluid force while leaving the motors untouched.
import RAPIER from '@dimforge/rapier3d-compat';
import { rngFrom } from '../trunk/rng.js';
import { createRandomGenome } from '../engine/l1/factory.js';
import { morphogenesis } from '../engine/l1/morphogen.js';
import { createSimulation, FIXED_DT } from '../engine/l1/physics.js';
import { DRIVE } from '../engine/l1/controller.js';
import W1_SLICE from '../worlds/w1_slice.js';
await RAPIER.init();
const SEC = 8, STEPS = Math.round(SEC/FIXED_DT);
const corpus = [];
for (let i = 0; corpus.length < 25 && i < 200; i++) {
  const g = createRandomGenome(rngFrom(0xC0DE ^ (i*2654435761)));
  const p = morphogenesis(g);
  if (p.jointCount >= 1) corpus.push({ g, p });
}
const pct=(a,q)=>{const s=[...a].sort((x,y)=>x-y);return s.length?s[Math.max(0,Math.round((s.length-1)*q))]:NaN;};
for (const [label, W, o] of [
  ['baseline (fluid + motors)',  {...W1_SLICE, gravity:0},                    {}],
  ['NO FLUID (density 0)',       {...W1_SLICE, gravity:0, mediumDensity:0},   {}],
  ['fluid, NO motors',           {...W1_SLICE, gravity:0},                    {motorScale:0}],
  ['NO FLUID, old motors',       {...W1_SLICE, gravity:0, mediumDensity:0},   {torqueModel:'scale'}],
]) {
  const spins=[], coms=[]; let div=0;
  for (const { g, p } of corpus) {
    let sim; try { sim = createSimulation(RAPIER,p,g,W,{drive:DRIVE.POSITION,bounded:false,...o}); } catch { div++; continue; }
    let peak=0, prev=sim.centreOfMass(), path=0, bad=false;
    try { for (let s=0;s<STEPS;s++){ sim.step();
      const c=sim.centreOfMass();
      if(!Number.isFinite(c[0]+c[1]+c[2])){bad=true;break;}
      path += Math.hypot(c[0]-prev[0],c[1]-prev[1],c[2]-prev[2]); prev=c;
      for(const rb of sim.bodies){const a=rb.angvel();const q=Math.hypot(a.x,a.y,a.z);
        if(!Number.isFinite(q)){bad=true;break;} if(q>peak)peak=q;}
      if(bad)break; } } catch { bad=true; }
    sim.free(); if(bad){div++;continue;}
    spins.push(peak); coms.push(path/SEC);
  }
  console.log(` ${label.padEnd(28)} div=${String(div).padStart(2)}  peak |omega| p50 ${pct(spins,0.5).toFixed(1).padStart(7)}  p90 ${pct(spins,0.9).toFixed(1).padStart(7)}   COM path speed p50 ${pct(coms,0.5).toFixed(2).padStart(6)} m/s`);
}
console.log('\n (the controller commands joint motion at ~1 rad/s)');
