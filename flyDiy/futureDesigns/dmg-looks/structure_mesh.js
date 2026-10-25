// DMG-LOOKS brief 2 (node only): HOW THE DRAWN FRAME MEMBERS ARE MESHED in the flown cage snapshot (headless:
// tools/_dmg_wall_lib.js snapshotOf, the page's own layers and join). For each structure group (the Cub's 'stube', the
// Jodel's 'swoodFrame', the metal Cessna's 'stoele', and every build's 'sjoint') each vertex is matched to its nearest
// member (within 8 cm at rest) and the distinct 1 cm stations along each member are counted: the rings a bend could use.
// Also the cost of the alternative to the pool - every frame member re-meshed at a ring every 4 cm, always on.
//   node structure_mesh.js   (from the repo root's flyDiy/: ~10 s)   -> structure_mesh.txt
'use strict';
process.chdir(require('path').join(__dirname, '..', '..'));
const out = [], log0 = console.log; console.log = (...a) => { out.push(a.join(' ')); log0(...a); };
const W=require(process.cwd()+'/tools/_dmg_wall_lib.js');
const jobs=[['builds/cub_2026-09-20_corrected.json',['stube','sjoint']],['builds/jodel_2026-09-20_corrected.json',['swoodFrame','sjoint']],['bugReports/cessnaMetal (1).json',['stoele','sjoint']]];
for (const [f,keys] of jobs) { const S=W.snapshotOf(f); const R=S.rest, B=S.def.beams;
 for (const key of keys) {
 const gs=S.groups.filter(g=>g.key===key);
 const segs=B.map((b,i)=>{const a=[R[b.a*3],R[b.a*3+1],R[b.a*3+2]],c=[R[b.b*3],R[b.b*3+1],R[b.b*3+2]];const e=[c[0]-a[0],c[1]-a[1],c[2]-a[2]];return {i,a,e,L2:e[0]**2+e[1]**2+e[2]**2,cls:b.cls,mat:b.mat}}).filter(s=>s.L2>1e-6&&s.cls!=='wire');
 const per=new Map(); let far=0, nv=0;
 for (const g of gs) for (let v=0; v<g.nv; v++){ nv++; const x=g.pos[v*3],y=g.pos[v*3+1],z=g.pos[v*3+2]; let best=null,bd=1e9,bt=0;
   for(const s of segs){let t=((x-s.a[0])*s.e[0]+(y-s.a[1])*s.e[1]+(z-s.a[2])*s.e[2])/s.L2; t=Math.max(0,Math.min(1,t)); const d=(s.a[0]+t*s.e[0]-x)**2+(s.a[1]+t*s.e[1]-y)**2+(s.a[2]+t*s.e[2]-z)**2; if(d<bd){bd=d;best=s;bt=t}}
   if(!best||bd>0.08*0.08) { far++; continue; } let P=per.get(best.i); if(!P) per.set(best.i,P={n:0,ts:new Set(),L:Math.sqrt(best.L2)}); P.n++; P.ts.add(Math.round(bt*Math.sqrt(best.L2)*100)); }
 const arr=[...per.values()]; if(!arr.length){console.log(f,key,'none');continue;}
 const q=(a,p)=>{a=a.slice().sort((x,y)=>x-y);return a[Math.floor((a.length-1)*p)]};
 const tris=arr.map(p=>p.n/3), st=arr.map(p=>p.ts.size), dens=arr.map(p=>p.ts.size/p.L);
 console.log(f.split('/').pop(), key, 'verts', nv, 'off-member', far, '| members', arr.length, '| tris/member p50', q(tris,.5).toFixed(0), 'p90', q(tris,.9).toFixed(0), '| 1cm stations/member p50', q(st,.5), '| stations per metre p10/p50/p90', q(dens,.1).toFixed(0)+'/'+q(dens,.5).toFixed(0)+'/'+q(dens,.9).toFixed(0));
 const sumL=arr.reduce((s,p)=>s+p.L,0), sides=key==='stube'?6:key==='swoodFrame'?4:6, tris4=arr.reduce((s,p)=>s+Math.max(1,Math.round(p.L/0.04))*sides*2,0); console.log('   sumL',sumL.toFixed(1),'m  tris now',(nv/3).toFixed(0),' tris at 4cm rings (no caps)',tris4, ' x', (tris4/(arr.reduce((s,p)=>s+p.n,0)/3)).toFixed(2));
 }
}
require('fs').writeFileSync(require('path').join(__dirname, 'structure_mesh.txt'), out.join('\n') + '\n');
