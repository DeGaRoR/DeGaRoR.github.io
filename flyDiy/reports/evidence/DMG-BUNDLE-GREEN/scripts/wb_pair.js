process.env.FLYDIY_CERT='1';
const path=require('path');const ROOT=process.env.ROOT||process.cwd();const L=require(path.join(ROOT,'tools/_treecrash_lib.js'));const C=L.core();
for (const k of ['metal','floats']) { const d=L.defOf(k,{}), N=d.nodes, K=d.cert, sim=C.makeSim(d,null); sim.reset(0);
  d.beams.forEach((b,i)=>{ const t=N[b.a].tag+'-'+N[b.b].tag; if(!/^S1B[LR]-WB$/.test(t)) return; const s=sim.beams[i];
    console.log(k,i,t,N[b.a].p.map(v=>v.toFixed(2)).join(','),'->',N[b.b].p.map(v=>v.toFixed(2)).join(','),'seam',s.seam,'k',s.k.toExponential(2),'Ft',(K.Ft[i]/1000).toFixed(2),K.names[K.byT[i]],'bench',(K.cases.bench.t[i]/1000).toFixed(2),'fu',(s.fu/1000).toFixed(2),'pred g',(3.8*s.fu/K.cases.bench.t[i]).toFixed(2)); }); }
