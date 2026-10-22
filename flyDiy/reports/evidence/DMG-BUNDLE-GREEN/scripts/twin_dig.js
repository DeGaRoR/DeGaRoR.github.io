process.env.FLYDIY_CERT='1';
const path=require('path');const ROOT=process.env.ROOT||process.cwd();const G=require(path.join(ROOT,'tools/_dmg_gear_lib.js'));const L=G.L;
const r=G.digIn(process.argv[2]||'twinFloats',{V:90,sink:5,pitch:20}); const sim=L.lastRun.sim, D=sim.damage(), def=L.defOf('twinFloats'), N=def.nodes;
console.log(JSON.stringify(r).slice(0,600)); console.log('cl',JSON.stringify(D.cl.map(c=>c.tag+'/'+c.cut+'/'+c.why+'@'+c.t.toFixed(3)+' r'+c.ratio.toFixed(3))),'broken',D.broken.slice(0,12).map(i=>N[def.beams[i].a].tag+'-'+N[def.beams[i].b].tag+':'+sim.beams[i].cls).join(' '));
