const path=require('path');const ROOT=process.env.ROOT||process.cwd();const L=require(path.join(ROOT,'tools/_treecrash_lib.js'));const C=L.core();
const key=process.argv[2]||'twinFloats', U=+(process.argv[3]||10), th=+(process.argv[4]||90), cert=process.argv[5]!=='nocert';
const def=L.defOf(key,{cert}), world=C.makeWorld(), sea=world.aerodromes.find(x=>x.id==='SEA');
const sim=C.makeSim(def,world); sim.reset(0); C.placeAtAerodrome(sim,sea);
const x0=sim.axes()[0],hl=Math.hypot(x0[0],x0[2]),fx=-x0[0]/hl,fz=-x0[2]/hl,rx=-fz,rz=fx;
const c=Math.cos(th*Math.PI/180),s=Math.sin(th*Math.PI/180);
if(U) world.setWind({base:[-U*(c*fx+s*rx),0,-U*(c*fz+s*rz)],gust:0});
let I=0;
const cuts0=sim.clusterCuts().cuts.filter(c=>/FLT/.test(c.tag)); console.log('FLT cuts', cuts0.map(c=>c.tag+'/'+c.kind+' Mu '+(c.Mu/1000).toFixed(2)+' Mv '+(c.Mv/1000).toFixed(2)+' T '+(c.T/1000).toFixed(2)+' kN.m').join(' | '));
for(let f=0;f<120;f++) sim.step(1/60);
let pk=0;
for(let f=0;f<600;f++){const v=sim.cgVel(),e=3-(v[0]*fx+v[2]*fz);I=Math.max(-2,Math.min(2,I+e/60));sim.ctl.thr=Math.max(0,Math.min(1,0.25+0.15*e+0.1*I));sim.step(1/60);
 const X=sim.clusterCuts().cuts.filter(c=>/FLT/.test(c.tag)); const [xA,,zR]=sim.axes();
 const w=X.reduce((a,c)=>Math.max(a,c.rb,c.rt),0);
 if(w>0.4||f%60===0) console.log(sim.t.toFixed(2),'pitch',(Math.asin(xA[1])*57.3).toFixed(1),'roll',(Math.asin(zR[1])*57.3).toFixed(1),X.map(c=>c.tag+' rb '+c.rb.toFixed(2)+' rt '+c.rt.toFixed(2)+' Mb '+(c.Mb/1000).toFixed(2)+' T '+(c.Tq/1000).toFixed(2)+(c.done?' DONE':'')).join(' | '),'cl',sim.damage().cl.length);
 if(sim.damage().cl.length) { console.log(JSON.stringify(sim.damage().cl)); break; } }
