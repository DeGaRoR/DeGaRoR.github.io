// the test to destruction (bench_worker benchLoadRun, destroy), frame by frame: the jig, the shape at the end, the damage record
const C=require('./core.js'), S=require('./specs.json'), BW=require('/workspace/DeGaRoR.github.io/flyDiy/src/viewer/bench_worker.js');
const keys=(process.argv[2]||'cub,c172,twin').split(','), out={};
for (const k of keys){
  const spec=S[k].spec, cfg={ material: spec.fuselage&&spec.fuselage.material, wingMaterial: C.genSurfKey(spec,'wing',0), destroy:true };
  const run=BW.benchLoadRun(C,{spec:JSON.parse(JSON.stringify(spec)), cfg}); const sim=run.sim, def=run.def, rig=run.rig;
  const snap=()=>({p:Array.from(sim.p), ax:sim.axes().map(a=>a.slice())});
  let base=null, n=0, ph=rig.state.phase, atBreak=null;
  while(run.ok && !run.done && n<60*120){ run.pump(1); n++; if(ph==='settle'&&rig.state.phase!=='settle') base=snap(); ph=rig.state.phase; if(!atBreak && rig.state.brokeAt!=null) atBreak=snap(); }
  const end=snap(), D=sim.damage();
  const body=(sn)=>def.nodes.map((nd,i)=>{ const d=[0,1,2].map(q=>sn.p[i*3+q]-base.p[i*3+q]); return [0,1,2].map(a=>d[0]*sn.ax[a][0]+d[1]*sn.ax[a][1]+d[2]*sn.ax[a][2]); });
  const fb=D.firstBreak, fy=D.firstYield;
  out[k]={ st:rig.state, nodes:def.nodes.map(n=>({p:n.p,tag:n.tag,m:n.m})), beams:sim.beams.map(b=>({a:b.a,b:b.b,cls:b.cls,vis:b.vis,seam:b.seam,grp:b.grp,broken:!!b.broken,yielded:!!b.yielded})),
    dispBreak: atBreak?body(atBreak):null, dispEnd: body(end), broken:D.broken, firstBreak: fb&&{beam:fb.beam,cls:fb.cls,seam:fb.seam,how:fb.how}, firstYield: fy&&(typeof fy==='object'?{beam:fy.beam,cls:fy.cls}:fy),
    groups:(D.groups||[]).map(G=>({key:G.key,seam:G.seam,cls:G.cls,t0:G.t0,t1:G.t1})), yieldsN:D.yields, breaksN:D.breaks, semi:rig.semi, frames:n };
  console.log(k, rig.state.verdict, 'yield', rig.state.yieldAt&&rig.state.yieldAt.toFixed(2), 'break', rig.state.breakAt&&rig.state.breakAt.toFixed(2), 'broke', rig.state.brokeAt&&rig.state.brokeAt.toFixed(2), rig.state.brokeKey,
    '| broken members', D.broken.length, 'yielded', sim.beams.filter(b=>b.yielded).length, '| firstYield', JSON.stringify(out[k].firstYield), 'firstBreak', JSON.stringify(out[k].firstBreak), '| groups', out[k].groups.map(g=>g.key).join(','));
}
require('fs').writeFileSync(__dirname+'/destroy_'+keys.join('_')+'.json', JSON.stringify(out));
