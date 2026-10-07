const path=require('path');const ROOT=process.env.ROOT||process.cwd();const L=require(path.join(ROOT,'tools/_treecrash_lib.js'));const C=L.core();
const raw=process.argv[2]==='raw'; if(raw) process.env.FLYDIY_RAW_BUILDS='1';
const d=L.defOf('twinFloats'); const N=d.nodes;
const E=N.findIndex(n=>n.tag==='ENGL'); console.log('ENGL',N[E].p.map(v=>v.toFixed(3)).join(','),'m',N[E].m.toFixed(1));
d.beams.forEach((b,bi)=>{ if(b.a===E||b.b===E){const o=b.a===E?b.b:b.a; const L0=Math.hypot(...[0,1,2].map(j=>N[o].p[j]-N[E].p[j])); console.log(' ',N[o].tag,N[o].p.map(v=>v.toFixed(2)).join(','),'L',L0.toFixed(2),'cls',b.cls,'mat',b.mat,'A',b.A, 'inner',b.inner);} });
console.log('spec engines', JSON.stringify(d.spec.engAt), 'wing xLE', d.spec.wing.xLE, 'chord', d.spec.wing.chord);
