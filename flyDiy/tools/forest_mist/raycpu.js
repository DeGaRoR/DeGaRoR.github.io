// the veil, on the CPU, per pixel of a view: the shader's taps (4 over the last 450 m, 2 over the first 350 m)
global.location={search:'?fmist=c'}; const F=require('/workspace/DeGaRoR.github.io/flyDiy/src/viewer/forest_mist.js');
const W=require(process.argv[2]+'/jolene.js')(); const m=F.bakeMap(W,512);
const [ex,ez,agl,yawD,pitchD,fov,I,out,mode]=[+process.argv[3],+process.argv[4],+process.argv[5],+process.argv[6],+process.argv[7],+process.argv[8],+process.argv[9],process.argv[10],process.argv[11]||'all'];
const OV=JSON.parse(process.argv[12]||'{}'); Object.assign(F.S,OV); if(OV.rhoMax&&OV.octaves!=null){} const rhoI=F.rhoOf(I); F.S.rho=rhoI;
const k=mode==='pool'?[I,0,0]:mode==='wisp'?[0,I,0]:[I,I,0];
const ey=Math.max(W.terrainH(ex,ez),W.waterH?W.waterH(ex,ez):-1e9)+agl, NX=240, NY=135, f=Math.tan(fov*Math.PI/360);
const yaw=yawD*Math.PI/180, pit=pitchD*Math.PI/180;
const fw=[Math.sin(yaw)*Math.cos(pit),Math.sin(pit),-Math.cos(yaw)*Math.cos(pit)], rt=[Math.cos(yaw),0,Math.sin(yaw)];
const up=[fw[1]*rt[2]-fw[2]*rt[1], fw[2]*rt[0]-fw[0]*rt[2], fw[0]*rt[1]-fw[1]*rt[0]].map(v=>-v);
const px=Buffer.alloc(NX*NY*3); let hit=0,n=0;
for(let j=0;j<NY;j++) for(let i=0;i<NX;i++){ const u=(2*(i+.5)/NX-1)*f*16/9, v=(1-2*(j+.5)/NY)*f;
  let d=[fw[0]+u*rt[0]+v*up[0], fw[1]+u*rt[1]+v*up[1], fw[2]+u*rt[2]+v*up[2]]; const L=Math.hypot(...d); d=d.map(x=>x/L);
  let D=0; for(let t=40;t<12000;t+=t<500?2:8){ const x=ex+d[0]*t,y=ey+d[1]*t,z=ez+d[2]*t; const g=W.terrainH(x,z), c=W.island.canopyAt(x,z); if(y<g+c*0.8){D=t;break;} }
  let od=0; if(D){ const SN=F.S.surfN, Ls=Math.min(D,F.S.surfM); for(let s=0;s<SN;s++){const t=D-(s+.5)*Ls/SN; od+=F.densCPU(m,k,1e4,[0,0],ex+d[0]*t,ey+d[1]*t,ez+d[2]*t)*Ls/SN;}
    if(D>Ls){const Le=Math.min(D-Ls,F.S.eyeM); for(let s=0;s<2;s++){const t=(s+.5)*Le/2; od+=F.densCPU(m,k,1e4,[0,0],ex+d[0]*t,ey+d[1]*t,ez+d[2]*t)*Le/2;}} n++; if(od>0.1) hit++; }
  const T=Math.exp(-od), base=D?[90,80,50]:[170,190,220], o=(j*NX+i)*3; for(let c=0;c<3;c++) px[o+c]=Math.round(base[c]*T+245*(1-T)); }
require('fs').writeFileSync(out, Buffer.concat([Buffer.from(`P6 ${NX} ${NY} 255\n`), px]));
console.log('pixels on ground with od > 0.15:', (hit/Math.max(1,n)).toFixed(3));
