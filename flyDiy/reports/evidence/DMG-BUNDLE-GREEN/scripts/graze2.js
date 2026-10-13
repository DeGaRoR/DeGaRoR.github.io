const path=require('path');const ROOT=process.env.ROOT||process.cwd();const L=require(path.join(ROOT,'tools/_treecrash_lib.js'));const C=L.core();
const key=process.argv[2]||'twinFloats', thr=+(process.argv[3]||0);
const def=L.defOf(key,{}), {W,strip}=L.flatWorld(0); const sim=C.makeSim(def,W); sim.reset(0);
C.placeAtAerodrome(sim,Object.assign({},strip,{elev:0,spawnElev:0})); sim.ctl.brake=1;
const E=def.refs.engine, EO=def.refs.engineOf||E.map(()=>0);
const hub=()=>{let x=0,y=0,z=0,c=0;E.forEach((i,j)=>{if((EO[j]|0)===0){x+=sim.p[i*3];y+=sim.p[i*3+1];z+=sim.p[i*3+2];c++;}});return [x/c,y/c,z/c];};
for(let f=0;f<240+180+60;f++){ if(f>=240) sim.ctl.thr=Math.min(1,(f-240)/60)*thr; sim.step(1/60);
  if(f%20===0||f>=415){const h=hub(),[xA,,zR]=sim.axes(); if(f%20===0||f%2===0) console.log(sim.t.toFixed(2),'hub',h.map(v=>v.toFixed(4)).join(','),'roll',(Math.asin(zR[1])*57.3).toFixed(3),'yaw',(Math.atan2(-xA[2],-xA[0])*57.3).toFixed(3),'cgv',sim.cgVel().map(v=>v.toFixed(3)).join(','));}}
