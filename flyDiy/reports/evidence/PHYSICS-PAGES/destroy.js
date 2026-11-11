const C=require('./core.js'), S=require('./specs.json'), BW=require('/workspace/DeGaRoR.github.io/flyDiy/src/viewer/bench_worker.js');
const out={};
for (const k of (process.argv[2]||'cub,c172,twin').split(',')){
  const t0=Date.now(), spec=S[k].spec;
  const cfg={ material: spec.fuselage&&spec.fuselage.material, wingMaterial: C.genSurfKey(spec,'wing',0), destroy:true };
  const run=BW.benchLoadRun(C,{spec:JSON.parse(JSON.stringify(spec)), cfg});
  let n=0; while(run.ok && !run.done && n<60*120){ run.pump(60); n+=60; }
  const st=run.rig.state, sim=run.sim||null;
  out[k]={verdict:st.verdict, yieldAt:st.yieldAt, breakAt:st.breakAt, breakFirst:st.breakFirst, brokeAt:st.brokeAt, brokeKey:st.brokeKey, brokeSeam:st.brokeSeam, frames:n, ms:Date.now()-t0, keys:Object.keys(run)};
  console.log(k, JSON.stringify(out[k]));
}
require('fs').writeFileSync(__dirname+'/destroy.json', JSON.stringify(out,null,1));
