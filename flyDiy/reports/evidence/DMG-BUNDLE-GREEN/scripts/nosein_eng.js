process.env.FLYDIY_CERT='1';
const path=require('path');const ROOT=process.env.ROOT||process.cwd();const L=require(path.join(ROOT,'tools/_treecrash_lib.js'));
const k=process.argv[2]||'floats'; const idx=[30,31,32];
L.waterCase(k,{V:150/3.6,sink:10,pitch:60,secs:0.4,onFrame:(sim,s)=>{ const D=sim.damage(); console.log(s, idx.map(i=>[0,1,2].map(j=>sim.p[i*3+j].toExponential(2)).join(',')).join(' | '), 'broken',D.broken.length,'cl',D.cl.length, 'groups', (D.groups||[]).map(g=>g.key).join(','));}});
