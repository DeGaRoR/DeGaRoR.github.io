const path=require('path');const ROOT=process.env.ROOT||process.cwd();const L=require(path.join(ROOT,'tools/_treecrash_lib.js'));const C=L.core();
const key=process.argv[2]||'twinFloats', U=+(process.argv[3]||10), th=+(process.argv[4]||90), probe=process.argv[5]==='probe';
const def=L.defOf(key,{cert:true,probe}), world=C.makeWorld(), sea=world.aerodromes.find(x=>x.id==='SEA');
const sim=C.makeSim(def,world); sim.reset(0); C.placeAtAerodrome(sim,sea);
const N=def.nodes, tag=bi=>N[def.beams[bi].a].tag+'-'+N[def.beams[bi].b].tag;
const x0=sim.axes()[0],hl=Math.hypot(x0[0],x0[2]),fx=-x0[0]/hl,fz=-x0[2]/hl,rx=-fz,rz=fx;
const c=Math.cos(th*Math.PI/180),s=Math.sin(th*Math.PI/180);
if(U) world.setWind({base:[-U*(c*fx+s*rx),0,-U*(c*fz+s*rz)],gust:0});
let I=0; const P=sim.damagePeak();
const gear=[]; def.beams.forEach((b,bi)=>{ if(sim.beams[bi].cls==='gear') gear.push(bi); });
for(let f=0;f<120;f++) sim.step(1/60);
const fl=N.map((n,i)=>i).filter(i=>N[i].tag==='FLK');
for(let f=0;f<600;f++){const v=sim.cgVel(),e=3-(v[0]*fx+v[2]*fz);I=Math.max(-2,Math.min(2,I+e/60));sim.ctl.thr=Math.max(0,Math.min(1,0.25+0.15*e+0.1*I));
 P.t.fill(0);P.c.fill(0); sim.step(1/60);
 let w=0,wi=-1; for(const bi of gear){const r=Math.max(P.t[bi],P.c[bi]); if(r>w){w=r;wi=bi;}}
 const [xA]=sim.axes(); const wh=world.waterH(sim.cgPos()[0],sim.cgPos()[2]);
 let bowMin=1e9; for(const i of fl) bowMin=Math.min(bowMin, sim.p[i*3+1]-world.waterH(sim.p[i*3],sim.p[i*3+2]));
 if(w>0.5||f%30===0) console.log(sim.t.toFixed(2),'pitch',(Math.asin(xA[1])*57.3).toFixed(1),'cgY-water',(sim.cgPos()[1]-wh).toFixed(2),'vy',sim.cgVel()[1].toFixed(2),'wh',wh.toFixed(2),'gear worst',w.toFixed(2),wi>=0?tag(wi)+(P.t[wi]>P.c[wi]?' T':' C'):'', 'keel-min',bowMin.toFixed(2),'broken',sim.damage().broken.length);
 if(sim.damage().broken.length) break;}
