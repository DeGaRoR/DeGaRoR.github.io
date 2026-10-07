// the floats' bench to destruction: the first member broken, its certificate, what governs it, and the break the certificate predicts
const path=require('path');const ROOT=process.env.ROOT||process.cwd();const L=require(path.join(ROOT,'tools/_treecrash_lib.js'));const C=L.core();
const k=process.argv[2]||'floats'; const cert=L.certOf(k), def=L.defOf(k,{cert:true}), sim=C.makeSim(def,null); sim.reset(0);
const BW=require(path.join(ROOT,'src/viewer/bench_worker.js'));
const cfg=BW.benchLoadCfg({genSurfKey:C.genSurfKey},def.spec,{destroy:true}); cfg.ult=3*C.GEN_LOAD_ULT; cfg.rampS=(+process.env.RAMPK||1)*4*cfg.ult/C.GEN_LOAD_ULT; cfg.surface='wing';
const rig=C.makeLoadTest(sim,def,cfg); for(let f=0;f<60*120&&!rig.state.done;f++) rig.step(1/60);
const D=sim.damage(), fb=D.firstBreak, bi=fb.beam, N=def.nodes, tag=i=>N[def.beams[i].a].tag+'-'+N[def.beams[i].b].tag;
const G=C.GEN_CERT, lim=cert.limit, bc=cert.cases.bench;
console.log(k,'BROKE AT',rig.state.brokeAt.toFixed(3),'key',rig.state.brokeKey,'first',tag(bi),fb.seam,fb.how,'limit',lim,'m',G.m,'uFit',G.uFit);
const row=i=>{const t=bc?bc.t[i]:NaN; const fit=!!sim.beams[i].seam; const pred=lim*1.5*G.m*(fit?G.uFit:G.uMember)*cert.Ft[i]/t;
  return tag(i)+' seam '+sim.beams[i].seam+' Ft '+(cert.Ft[i]/1000).toFixed(2)+' kN by '+cert.names[cert.byT[i]]+'; bench@limit '+(t/1000).toFixed(2)+' kN -> predicted break '+pred.toFixed(2)+' g (fu '+(sim.beams[i].fu/1000).toFixed(2)+')';};
console.log(' first:',row(bi));
// the bench case's own weakest joints (the predicted first breaks)
const cand=[]; for(let i=0;i<def.beams.length;i++){ if(!bc||!(bc.t[i]>100)) continue; const fit=!!sim.beams[i].seam; if(!fit) continue; cand.push([lim*1.5*G.m*G.uFit*cert.Ft[i]/bc.t[i],i]); }
cand.sort((a,b)=>a[0]-b[0]); for(const [p,i] of cand.slice(0,6)) console.log('  ',row(i));
console.log('cases', cert.names.join(','));
