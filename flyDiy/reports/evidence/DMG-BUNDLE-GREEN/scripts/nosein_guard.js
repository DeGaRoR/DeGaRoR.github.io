process.env.FLYDIY_CERT='1';
const path=require('path');const ROOT=process.env.ROOT||process.cwd();const L=require(path.join(ROOT,'tools/_treecrash_lib.js'));
L.waterCase('floats',{V:150/3.6,sink:10,pitch:60,secs:12/60}); const sim=L.lastRun.sim, D=sim.damage();
console.log('guard',JSON.stringify(sim.guard()),'crashed',D.crashed,'reason',D.reason);
