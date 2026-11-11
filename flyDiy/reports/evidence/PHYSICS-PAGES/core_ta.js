// the core with ONE what-if hook on the tail-arm floor (60_gen_spec.js:6359): globalThis.__TA_OVERRIDE(S, floorVal) -> tailArm
const fs=require('fs');
const F='/workspace/DeGaRoR.github.io/flyDiy/tools/flight_core.js';
let src=fs.readFileSync(F,'utf8');
const LINE='S.fuse.tailArm = Math.max(S.fuse.tailArm, S.fuse.boxRear + 0.9 * w.chord);';
if (src.split(LINE).length!==2) throw new Error('hook line not found exactly once');
src=src.replace(LINE, 'S.fuse.tailArm = (globalThis.__TA_OVERRIDE ? globalThis.__TA_OVERRIDE(S) : Math.max(S.fuse.tailArm, S.fuse.boxRear + 0.9 * w.chord));');
const m={exports:{}};
new Function('module','require','__filename','__dirname', src+'\n;module.exports.__priv={genProbeAt,genAlphaForLift,genStallAngle};')(m, require, F, '/workspace/DeGaRoR.github.io/flyDiy/tools');
module.exports=m.exports;
