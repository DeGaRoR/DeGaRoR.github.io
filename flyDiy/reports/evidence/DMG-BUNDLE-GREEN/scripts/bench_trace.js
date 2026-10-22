const path=require('path');const ROOT=process.env.ROOT||process.cwd();const L=require(path.join(ROOT,'tools/_treecrash_lib.js'));const C=L.core();
const k=process.argv[2]||'floats'; const cert=L.certOf(k), def=L.defOf(k,{cert:true}), sim=C.makeSim(def,null); sim.reset(0);
const BW=require(path.join(ROOT,'src/viewer/bench_worker.js'));
const cfg=BW.benchLoadCfg({genSurfKey:C.genSurfKey},def.spec,{destroy:true}); cfg.ult=3*C.GEN_LOAD_ULT; cfg.rampS=4*cfg.ult/C.GEN_LOAD_ULT; cfg.surface='wing';
const rig=C.makeLoadTest(sim,def,cfg); const N=def.nodes, tag=i=>N[def.beams[i].a].tag+'-'+N[def.beams[i].b].tag;
const W=[]; def.beams.forEach((b,i)=>{ if(/^S1B[LR]-WB$/.test(tag(i))) W.push(i); });
const bc=cert.cases.bench; let nextG=3.0;
for(let f=0;f<60*120&&!rig.state.done;f++){ rig.step(1/60); const g=rig.state.n||0;
  if(g>=nextG){ nextG+=0.25; const D=sim.damage(); const pos=sim.p; const rows=W.map(i=>{const b=def.beams[i]; const a=b.a*3,c=b.b*3; const Lc=Math.hypot(pos[a]-pos[c],pos[a+1]-pos[c+1],pos[a+2]-pos[c+2]); const L0=sim.beams[i].L0; return ((sim.beams[i].k*(Lc-L0))/(bc.t[i]*g/3.8)).toFixed(3);});
   console.log("g",g.toFixed(2),"WB force/linear",rows.join(" "),"members set",D.members,'yields',D.yields,'set max',(100*D.setMax).toFixed(2)+'%'); } }
console.log('BROKE AT',rig.state.brokeAt, Object.keys(rig.state).join(','));
