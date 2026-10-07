process.env.FLYDIY_CERT='1';
const path=require('path');const ROOT=process.env.ROOT||process.cwd();const G=require(path.join(ROOT,'tools/_dmg_gear_lib.js'));const L=G.L;
const k=process.argv[2]||'twinFloats', sink=+(process.argv[3]||3.66);
const d=G.bracketDrop(k,{sink}); const sim=L.lastRun.sim; let mx=0; for(let i=0;i<sim.n;i++) mx=Math.max(mx,Math.abs(sim.p[i*3+1]));
console.log(JSON.stringify(d).slice(0,500)); console.log('guard',JSON.stringify(sim.guard()),'max |y|',mx.toExponential(2), 'cl', JSON.stringify(sim.damage().cl.map(c=>c.tag+'/'+c.cut+'/'+c.why+'@'+c.t.toFixed(3))), 'groups t', JSON.stringify((sim.damage().groups||[]).map(g=>g.key+'@'+g.t.toFixed(3))));
