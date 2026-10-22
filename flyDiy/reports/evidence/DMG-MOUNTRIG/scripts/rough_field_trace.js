process.env.FLYDIY_CERT='1';
const path=require('path'); const T=path.join(process.cwd(),'tools');
const L=require(path.join(T,'_treecrash_lib.js')); const C=L.core();
const k=process.argv[2]||'metal', V=+(process.argv[3]||8);
const def=L.defOf(k,{probe:true}); const F=L.flatWorld(0); const A=0.02, lam=3, k1=2*Math.PI/lam, k2=2*Math.PI/(0.43*lam);
F.W.terrainH=(x,z)=>A*Math.sin(k1*x+0.7)*Math.cos(0.8*k1*z)+0.5*A*Math.sin(k2*(0.6*x+0.8*z));
const sim=C.makeSim(def,F.W); sim.reset(0); C.placeAtAerodrome(sim,Object.assign({},F.strip,{elev:0,spawnElev:0}));
for(let f=0;f<240;f++) sim.step(1/60);
const x0=sim.axes()[0],hl=Math.hypot(x0[0],x0[2]),fx=-x0[0]/hl,fz=-x0[2]/hl; const P=sim.damagePeak(); P.t.fill(0);P.c.fill(0);
let I=0; const h0=Math.atan2(fz,fx); const N=def.nodes,B=def.beams; let last=0;
for(let f=0;f<20*60;f++){const v=sim.cgVel(),Vg=v[0]*fx+v[2]*fz,e=V-Vg;I=Math.max(-2,Math.min(2,I+e/60));sim.ctl.thr=Math.max(0,Math.min(1,0.25+0.15*e+0.1*I));
 const xA=sim.axes()[0],h=Math.atan2(-xA[2],-xA[0]);let dh=h-h0;while(dh>Math.PI)dh-=2*Math.PI;while(dh<-Math.PI)dh+=2*Math.PI;sim.ctl.dr=Math.max(-1,Math.min(1,3*dh));sim.ctl.brake=0;sim.step(1/60);
 let m=0,mi=-1;for(let i=0;i<P.t.length;i++){const r=Math.max(P.t[i],P.c[i]);if(r>m){m=r;mi=i;}}
if(sim.t>6.0&&sim.t<6.4&&f%2===0){const vi=N.findIndex(n=>n.tag==="VSNL"),s0=N.findIndex(n=>n.tag==="S0BR");const bi=B.findIndex(b=>N[b.a].tag==="VSNL"&&N[b.b].tag==="S0BR");const sb=sim.beams[bi];const L=Math.hypot(...[0,1,2].map(j=>sim.p[vi*3+j]-sim.p[s0*3+j]));const D=sim.damage();console.log("   t",sim.t.toFixed(3),"L-L0 mm",((L-sb.L0)*1e3).toFixed(2),"vVSN",[0,1,2].map(j=>sim.v[vi*3+j].toFixed(2)).join(","),"crush",(D.drive&&D.drive[0]?D.drive[0].crush:0),"strike",D.propStrike,D.drive&&D.drive[0]&&D.drive[0].strike,"dents",D.dents,"members",D.members,"rpm",(sim.out.rpm[0]||0).toFixed(0));}
  if(m>last*1.5+0.05||f%120===0){console.log(sim.t.toFixed(2),'Vg',Vg.toFixed(2),'pitch',(Math.asin(xA[1])*57.3).toFixed(1),'yaw',(dh*57.3).toFixed(1),'worst',m.toFixed(2),N[B[mi].a].tag+'-'+N[B[mi].b].tag,'thr',sim.ctl.thr.toFixed(2),'TWy',(sim.p[def.refs.tw*3+1]).toFixed(3));last=m;}}
