import {readFileSync} from 'node:fs';
const R=(await import('@dimforge/rapier3d-compat')).default; await R.init();
const {morphogenesis}=await import('./engine/l1/morphogen.js');
const {createArena,createSimulation,FIXED_DT,SOLVER_ITERATIONS}=await import('./engine/l1/physics.js');
const {authoredList}=await import('./worlds/atlas_seed.js');
const {default:W}=await import('./worlds/w1_slice.js');
const SUS=JSON.parse(readFileSync('./tools/_zboom_polypoda.json','utf8'));
const HAB=W.habitatBounds??W.tankBounds;
const entries=[{n:'Polypoda(SUS)',genome:SUS}]
  .concat(authoredList().slice(0,7).map(e=>({n:e.commonName??'(unnamed)',genome:e.genome})));
// THE HARD ARM: ghosting ON but solver back to Rapier's default 4. If ghosting is
// a real fix it must hold even without the iteration increase propping it up.
for(const [label,iters] of [['ghosts + 8 iterations',8],['ghosts + 4 iterations (hard arm)',4]]){
  const arena=createArena(R,W,{bounded:false});
  arena.world3d.integrationParameters.numSolverIterations=iters;
  const cast=entries.map((e,i)=>{const a=(i/entries.length)*Math.PI*2;const plan=morphogenesis(e.genome);
   return {n:e.n,sim:createSimulation(R,plan,e.genome,W,{arena,wrap:false,creatureCollision:false,
    origin:[Math.cos(a)*(HAB[0]/4),Math.sin(a)*(HAB[1]/3),0]}),mx:0,tB:NaN};});
  const sims=cast.map(c=>c.sim); const T=10800;
  for(let st=0;st<Math.round(T/FIXED_DT);st++){
    arena.stepAll(sims);
    if(st%240)continue;
    for(const c of cast){const s=c.sim.integrity().spread;
      if(s>c.mx)c.mx=s; if(!Number.isFinite(c.tB)&&s>3)c.tB=st*FIXED_DT;}
  }
  const worst=cast.reduce((a,b)=>b.mx>a.mx?b:a);
  const burst=cast.filter(c=>Number.isFinite(c.tB));
  console.log('\n  '+label+', '+cast.length+' creatures, '+T+'s');
  console.log('   worst spread '+worst.mx.toFixed(2)+' ('+worst.n+')   bursts: '
    +(burst.length?burst.map(c=>c.n+'@'+c.tB.toFixed(0)+'s').join(', '):'NONE'));
  for(const c of cast) c.sim.free(); arena.free();
}
