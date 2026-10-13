process.env.FLYDIY_CERT='1';
const path=require('path');const ROOT=process.env.ROOT||process.cwd();const L=require(path.join(ROOT,'tools/_treecrash_lib.js'));const C=L.core();
const k=process.argv[2]||'twinFloats'; const dc=L.defOf(k,{}); const sim=C.makeSim(dc,null); sim.reset(0); const cert=dc.cert, B=sim.beams, N=dc.nodes;
const tag=bi=>N[dc.beams[bi].a].tag+'-'+N[dc.beams[bi].b].tag;
const nm='torque361'; const cs=cert.cases[nm];
const rows=[]; dc.beams.forEach((b,bi)=>{ if(!/ENG|CGE|MNT/.test(tag(bi))) return; const t=cs.t[bi], c=cs.c[bi], s=B[bi]; const kk=Math.min(t>0?s.fu/t:Infinity,c>0?s.fc0/c:Infinity);
 rows.push([kk,tag(bi),'t',t.toFixed(0),'c',c.toFixed(0),'fu',s.fu&&s.fu.toFixed(0),'fc0',s.fc0&&s.fc0.toFixed(0),'fy0',s.fy0&&s.fy0.toFixed(0),'Ft',cert.Ft[bi].toFixed(0),'Fc',cert.Fc[bi].toFixed(0),'byT',cert.names[cert.byT[bi]],'byC',cert.names[cert.byC[bi]],'L',s.L0&&s.L0.toFixed(2),'A',dc.beams[bi].A]); });
rows.sort((a,b)=>a[0]-b[0]); for(const r of rows.slice(0,8)) console.log(r.map(x=>typeof x==='number'?x.toFixed(3):x).join(' '));
console.log('GEN_CERT', JSON.stringify({m:C.GEN_CERT.m,uFit:C.GEN_CERT.uFit,uMember:C.GEN_CERT.uMember,kappa:C.GEN_CERT.kappa}));
