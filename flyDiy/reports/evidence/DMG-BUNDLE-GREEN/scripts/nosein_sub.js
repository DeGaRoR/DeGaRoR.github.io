process.env.FLYDIY_CERT='1';
const path=require('path');const ROOT=process.env.ROOT||process.cwd();const L=require(path.join(ROOT,'tools/_treecrash_lib.js'));
const k=process.argv[2]||'floats'; const idx=[30,31,32];
let sim0=null;
L.waterCase(k,{V:150/3.6,sink:10,pitch:60,secs:8/60,onStart:(s)=>{sim0=s;}});
const sim=L.lastRun.sim, def=sim0&&L.defOf(k); const sub=sim.substeps||def.params.substepsTrue||def.params.substeps||24;
console.log('substeps',sub, 't', sim.t.toFixed(4));
const N=L.defOf(k).nodes, tg=bi=>N[sim.beams[bi]?L.defOf(k).beams[bi].a:0].tag;
let lastB=sim.damage().broken.length;
for(let s=0;s<sub*2;s++){ sim.step(1/60/sub,1); const D=sim.damage(); const vmax=idx.map(i=>Math.hypot(sim.v[i*3],sim.v[i*3+1],sim.v[i*3+2]));
  const nb=D.broken.length; console.log(s,'t',sim.t.toFixed(5),'|v| ENGL/ENGR/CGE',vmax.map(x=>x.toExponential(2)).join(' '),'broken',nb, nb>lastB? 'groups '+(D.groups||[]).map(g=>g.key+'@'+g.t.toFixed(4)).join(','):''); lastB=nb; if(!(vmax[0]<1e6)) break; }
