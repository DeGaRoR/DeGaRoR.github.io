const C=require('./core.js'); const S=require('./specs.json');
const out={};
const keys=process.argv.slice(2).length?process.argv.slice(2):['cub','c172','twin'];
for (const k of keys){
  const t0=Date.now();
  const spec=S[k].spec, def=C.buildGen(spec), sim=C.makeSim(def,null); sim.reset(0);
  const cfg={ material: spec.fuselage && spec.fuselage.material, wingMaterial: C.genSurfKey(spec,'wing',0) };
  const rig=C.makeLoadTest(sim, def, cfg);
  let base=null, lim=null, frames=0;
  const snap=()=>{ const ax=sim.axes(); return { p:Float64Array.from(sim.p), ax:ax.map(a=>a.slice()) }; };
  const forces=()=>sim.beams.map(b=>{ const F=(b.tens&&b.strain<0)?0:b.k*b.strain*b.L0; return F; });
  while(!rig.state.done && frames<60*30){
    const ph=rig.state.phase; rig.step(1/60); frames++;
    if(ph==='settle' && rig.state.phase==='ramp') base=snap();
    if(!lim && rig.state.n>=C.GEN_LOAD_LIMIT){ lim=snap(); lim.F=forces(); lim.n=rig.state.n; lim.defl=rig.state.defl.slice(); }
  }
  const st=rig.state;
  // displacement in the body frame
  const disp=def.nodes.map((nd,i)=>{ const d=[0,1,2].map(q=>lim.p[i*3+q]-base.p[i*3+q]); return [0,1,2].map(a=>d[0]*lim.ax[a][0]+d[1]*lim.ax[a][1]+d[2]*lim.ax[a][2]); });
  // rigid part: the root station's displacement (pinned fuselage: ~0)
  const util=sim.beams.map((b,i)=>{ const F=lim.F[i]; const cap = F>=0 ? (b.fy0||b.fu) : (b.fc0||b.fy0||b.fu); return { u: cap>0?Math.abs(F)/cap:0, F, t: F>=0?'T':'C' }; });
  out[k]={ name:S[k].name, W:rig.W, semi:rig.semi, limitN:lim.n, verdict:st.verdict, limitPct:st.limitPct, ultPct:st.ultPct, limitYield:st.limitYield, ultYield:st.ultYield, worstCls:st.worstCls, worstBeam:st.worstBeam,
    tipM: st.limitPct/100*rig.semi, stations: rig.stations.map(s=>s.z), deflLim: lim.defl,
    nodes:def.nodes.map(n=>({p:n.p, tag:n.tag, m:n.m})), beams:sim.beams.map((b,i)=>({a:b.a,b:b.b,cls:b.cls,vis:b.vis,u:+util[i].u.toFixed(4),F:+util[i].F.toFixed(1),t:util[i].t, fy:b.fy0, fc:b.fc0, fu:b.fu, mat:b.mat})),
    disp: disp.map(d=>d.map(x=>+x.toFixed(5))), bags: rig.bags.length, carried: rig.carried.length, frames, ms: Date.now()-t0 };
  const top=util.map((u,i)=>[u.u,i]).sort((a,b)=>b[0]-a[0]).slice(0,6).map(([u,i])=>sim.beams[i].cls+':'+def.nodes[sim.beams[i].a].tag+'-'+def.nodes[sim.beams[i].b].tag+' '+(u*100).toFixed(0)+'% '+util[i].t);
  console.log(k, st.verdict, 'tip@3.8', (st.limitPct/100*rig.semi*100).toFixed(1),'cm', st.limitPct.toFixed(2),'% semi', 'ult', st.ultPct&&st.ultPct.toFixed(2), 'yield@lim', st.limitYield&&st.limitYield.toFixed(0), st.worstCls, frames,'fr', Date.now()-t0,'ms');
  console.log('   top:', top.join(' | '));
}
require('fs').writeFileSync(__dirname+'/load_'+keys.join('_')+'.json', JSON.stringify(out));
