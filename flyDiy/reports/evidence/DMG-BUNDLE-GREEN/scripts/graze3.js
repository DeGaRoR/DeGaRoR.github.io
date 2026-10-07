process.env.FLYDIY_CERT='1';
const path=require('path');const ROOT=process.env.ROOT||process.cwd();const L=require(path.join(ROOT,'tools/_treecrash_lib.js'));const C=L.core();
const key=process.argv[2]||'twinFloats', thr=+(process.argv[3]||0), bite=0.03;
const def=L.defOf(key,{}), elev=0, {W,TH,strip}=L.flatWorld(elev); const sim=C.makeSim(def,W); sim.reset(0);
C.placeAtAerodrome(sim,Object.assign({},strip,{elev,spawnElev:elev})); sim.ctl.brake=1;
for(let f=0;f<240;f++) sim.step(1/60);
for(let f=0;f<180;f++){ sim.ctl.thr=Math.min(1,f/60)*thr; sim.step(1/60);}
const E=def.refs.engine, EO=def.refs.engineOf||E.map(()=>0);
const hub=()=>{let x=0,y=0,z=0,c=0;E.forEach((i,j)=>{if((EO[j]|0)===0){x+=sim.p[i*3];y+=sim.p[i*3+1];z+=sim.p[i*3+2];c++;}});return [x/c,y/c,z/c];};
let [hx,hy,hz]=hub(); const ax=sim.axes(), fx=-ax[0][0], fz=-ax[0][2], fl=Math.hypot(fx,fz), ux=fx/fl, uz=fz/fl, R=def.params.prop.D/2, rt=0.15;
const lat=Math.max(0,R+rt-bite), fw=0.3, sd=hz<-0.3?-1:(hz>0.3?1:-1), lx=-uz*sd, lz=ux*sd;
const T=[hx+ux*fw+lx*lat, hz+uz*fw+lz*lat]; TH.set('fill:test',[T[0],T[1],elev-0.5,rt,elev+10]);
for(let f=0;f<12;f++){ sim.step(1/60); const h=hub(); const a=sim.axes()[0]; let ex=-a[0],ez=-a[2]; const el=Math.hypot(ex,ez); ex/=el; ez/=el;
  const dx=T[0]-h[0], dz=T[1]-h[2], axl=dx*ex+dz*ez, la=Math.hypot(dx-axl*ex,dz-axl*ez);
  const d=sim.damage().drive[0]; console.log(sim.t.toFixed(3),'hub',h.map(v=>v.toFixed(4)).join(','),'ax',axl.toFixed(3),'lat',la.toFixed(4),'bite',(R+rt-la).toFixed(4),'strike',d.strike, d.strikeAt&&d.strikeAt.bite&&d.strikeAt.bite.toFixed(4), 'crush',d.crush&&d.crush.toFixed(3), d.crushOn);}
