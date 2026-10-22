process.env.FLYDIY_CERT='1';
const path=require('path');const ROOT=process.env.ROOT||process.cwd();const L=require(path.join(ROOT,'tools/_treecrash_lib.js'));const C=L.core();
const key=process.argv[2]||'twinFloats';
const def=L.defOf(key,{probe:true}), world=C.makeWorld(); const sim=C.makeSim(def,world); sim.reset(0);
const a=world.aerodromes.find(x=>x.id==='SEA'); const vso=(def.params.gen.Vso||def.params.gen.Vs); const xw=0.2*16.56;
const h=a.hdg; world.setWind({base:[-Math.sin(h)*xw,0,Math.cos(h)*xw],gust:0});
C.placeAtAerodrome(sim,a); for(let i=0;i<600;i++) sim.step(1/60);
const ap=C.makePilot(sim,def,world); ap.setRoute(a,a);
const P=sim.damagePeak(); const N=def.nodes, tag=i=>N[def.beams[i].a].tag+'-'+N[def.beams[i].b].tag;
const spread=[]; def.beams.forEach((b,i)=>{ if(tag(i)==='FLD-FLD' && sim.beams[i].cls==='gear') spread.push(i); });
let ph=null;
for(let s=0;s<340*60;s++){ ap.update(1/60); if(ap.phase!==ph){ ph=ap.phase; console.log((sim.t).toFixed(1),'PHASE',ph);} P.t.fill(0);P.c.fill(0); sim.step(1/60);
  let w=0,wi=-1; for(const i of spread){ const r=Math.max(P.t[i],P.c[i]); if(r>w){w=r;wi=i;} }
  if(w>0.8){ const b=sim.beams[wi], a3=b.a*3, b3=b.b*3; const Lc=Math.hypot(sim.p[b3]-sim.p[a3],sim.p[b3+1]-sim.p[a3+1],sim.p[b3+2]-sim.p[a3+2]); const cl=sim.clusterCuts().clusters.find(c=>c.tag==='FLTL'||c.tag==='FLTR'&&c.nodes.includes(b.a)); console.log('   member',wi,'L0',b.L0.toFixed(5),'L',Lc.toFixed(5),'k',b.k.toExponential(2),'c',b.c.toExponential(2),'fc0',b.fc0&&b.fc0.toFixed(0),'clusters off', JSON.stringify(sim.clusterCuts().clusters.filter(c=>/FLT/.test(c.tag)).map(c=>c.tag+':'+c.off)), 'yielded', b.yielded, 'L0 build', sim._L0b ? '' : ''); const [xA,,zR]=sim.axes(); const v=sim.cgVel(); console.log(sim.t.toFixed(2),ph,'FLD-FLD',w.toFixed(2),P.c[wi]>P.t[wi]?'C':'T','node z',N[def.beams[wi].a].p[2].toFixed(2),'pitch',(Math.asin(xA[1])*57.3).toFixed(1),'roll',(Math.asin(zR[1])*57.3).toFixed(1),'V',Math.hypot(v[0],v[2]).toFixed(1),'vy',v[1].toFixed(2),'thr',sim.ctl.thr.toFixed(2),'dr',(sim.ctl.dr||0).toFixed(2)); }
  if(ap.phase==='STOPPED'&&ap.t>3) break; }
