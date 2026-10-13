process.env.FLYDIY_CERT='1';
const path=require('path');const ROOT=process.env.ROOT||process.cwd();const L=require(path.join(ROOT,'tools/_treecrash_lib.js'));
const k=process.argv[2]||'floats'; const d=L.defOf(k), N=d.nodes; let fr=0, printed=0;
L.waterCase(k,{V:150/3.6,sink:10,pitch:60,secs:10/60,onStart:(sim)=>{ sim.onSubstep=(s,dt)=>{ if(fr<8||printed>40) return; let vm=0,vi=-1; for(let i=0;i<sim.n;i++){const vv=Math.hypot(sim.v[i*3],sim.v[i*3+1],sim.v[i*3+2]); if(!(vv<=vm)){vm=vv;vi=i;}}
   const D=sim.damage(); if(vm>80||s%40===0){ printed++; console.log('f',fr,'s',s,'vmax',vm.toExponential(3),N[vi].tag,vi,'broken',D.broken.length,'groups',(D.groups||[]).length,'cl',D.cl.length); } }; },
  onFrame:(sim,s)=>{fr=s+1;}});
