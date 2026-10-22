const path=require('path');const ROOT=process.env.ROOT||process.cwd();const L=require(path.join(ROOT,'tools/_treecrash_lib.js'));const C=L.core();
const key=process.argv[2]||'twinFloats', U=+(process.argv[3]||10), th=+(process.argv[4]||90);
const def=L.defOf(key,{cert:true}), world=C.makeWorld(), sea=world.aerodromes.find(x=>x.id==='SEA');
const sim=C.makeSim(def,world); sim.reset(0); C.placeAtAerodrome(sim,sea);
const N=def.nodes, tag=bi=>N[def.beams[bi].a].tag+'-'+N[def.beams[bi].b].tag;
const x0=sim.axes()[0],hl=Math.hypot(x0[0],x0[2]),fx=-x0[0]/hl,fz=-x0[2]/hl,rx=-fz,rz=fx;
const c=Math.cos(th*Math.PI/180),s=Math.sin(th*Math.PI/180);
if(U) world.setWind({base:[-U*(c*fx+s*rx),0,-U*(c*fz+s*rz)],gust:0});
let I=0, nb=0;
for(let f=0;f<120;f++) sim.step(1/60);
for(let f=0;f<600;f++){const v=sim.cgVel(),e=3-(v[0]*fx+v[2]*fz);I=Math.max(-2,Math.min(2,I+e/60));sim.ctl.thr=Math.max(0,Math.min(1,0.25+0.15*e+0.1*I));sim.step(1/60);
 const D=sim.damage(); const [xA,yU,zR]=sim.axes();
 const hd=Math.atan2(-xA[2],-xA[0])*57.3, h0d=Math.atan2(fz,fx)*57.3; let dh=hd-h0d; while(dh>180)dh-=360; while(dh<-180)dh+=360; if(f%30===0||D.broken.length!==nb) console.log((sim.t).toFixed(2),"yaw",dh.toFixed(0),"airspd",sim.out.V&&sim.out.V.toFixed(1),'roll',(Math.asin(zR[1])*57.3).toFixed(1),'pitch',(Math.asin(xA[1])*57.3).toFixed(1),'Vg',(v[0]*fx+v[2]*fz).toFixed(2),'thr',sim.ctl.thr.toFixed(2),'yields',D.yields,'broken',D.broken.length, D.broken.slice(nb).map(i=>tag(i)+'('+sim.beams[i].cls+')').join(' '));
 nb=D.broken.length;}
const D=sim.damage(); console.log('final broken',D.broken.length,'reason',D.reason);
