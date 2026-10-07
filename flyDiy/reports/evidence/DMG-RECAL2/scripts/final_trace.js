// DMG-RECAL2: the final and the flare every second (every 0.1 s under 16 m) with the TECS demand - the Cessna on floats' headwind dive (data/floats_5_0_final_*.txt).
// Run from flyDiy/: node reports/evidence/DMG-RECAL2/scripts/final_trace.js <key> <U> <th deg> [max s]
process.env.FLYDIY_CERT='1';
const path=require('path');const L=require(path.join(process.env.ROOT||process.cwd(),'tools/_treecrash_lib.js'));const C=L.core();
const key=process.argv[2],U=+process.argv[3],TH=+process.argv[4];const def=L.defOf(key,{probe:true}),world=C.makeWorld();const sim=C.makeSim(def,world);sim.reset(0);
const a=world.aerodromes.find(x=>x.id==='SEA');const h=a.hdg,fwd=[Math.cos(h),Math.sin(h)],right=[-Math.sin(h),Math.cos(h)],c=Math.cos(TH*Math.PI/180),s=Math.sin(TH*Math.PI/180);
if(U)world.setWind({base:[U*(s*right[0]-c*fwd[0]),0,U*(s*right[1]-c*fwd[1])],gust:0});
C.placeAtAerodrome(sim,a);for(let i=0;i<600;i++)sim.step(1/60);
const ap=C.makePilot(sim,def,world);ap.setRoute(a,a);let ph;
for(let k=0;k<(+process.argv[5]||400)*60;k++){ap.update(1/60);sim.step(1/60);const d=ap.dbg,m=ap._m;if(ap.phase!==ph){ph=ap.phase;console.log(sim.t.toFixed(1),ph);}
 if((k%60==0&&(ph==='FINAL'||ph==='FLARE'))||(ph==='FINAL'&&d.agl<16&&k%6==0))console.log('  ',sim.t.toFixed(1),ph,'s',d.s.toFixed(0),'agl',d.agl.toFixed(1),'V',d.V.toFixed(1),'vs',m.vs.toFixed(2),'th',(d.th*57.3).toFixed(1),'thr',sim.ctl.thr.toFixed(2),'de',sim.ctl.de.toFixed(3),'Ith',(ap.dbg.tecs?JSON.stringify(ap.dbg.tecs).slice(0,80):''));
 if(ph==='ROLLOUT')break;}
console.log(JSON.stringify(ap.report.verdicts.slice(-4)));
