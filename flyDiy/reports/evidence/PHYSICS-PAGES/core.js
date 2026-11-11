// the game's core, with the module-private helpers reachable (genProbeAt, genAlphaForLift)
const fs=require('fs');
const F='/workspace/DeGaRoR.github.io/flyDiy/tools/flight_core.js';
const src=fs.readFileSync(F,'utf8');
const m={exports:{}};
const fn=new Function('module','require','__filename','__dirname', src+'\n;module.exports.__priv={genProbeAt,genAlphaForLift,genStallAngle,genTrim:typeof genTrim!=="undefined"?genTrim:null};');
fn(m, require, F, '/workspace/DeGaRoR.github.io/flyDiy/tools');
const C=m.exports; for(const k of Object.keys(C)) global[k]=C[k];
module.exports=C;
