process.env.FLYDIY_CERT='1';
const path=require('path');const ROOT=process.env.ROOT||process.cwd();const L=require(path.join(ROOT,'tools/_treecrash_lib.js'));
const k=process.argv[2]||'floats', raw=process.argv[3]; const d=L.defOf(k), N=d.nodes;
L.waterCase(k,{V:150/3.6,sink:10,pitch:60,secs:12/60,onFrame:(sim,s)=>{ if(s<7) return; const big=[]; for(let i=0;i<sim.n;i++){const r=Math.hypot(sim.p[i*3],sim.p[i*3+1],sim.p[i*3+2]-1290); if(r>100) big.push(N[i].tag);} const D=sim.damage(); console.log(s,'huge nodes',big.length, big.slice(0,12).join(' '),'| groups',(D.groups||[]).map(g=>g.key).join(','),'cl',JSON.stringify(D.cl.map(c=>c.tag+'/'+c.cut+'/'+c.why)), 'crashed',D.crashed,D.reason, 'diverged', D.diverged||D.simDiverged||'');}});
