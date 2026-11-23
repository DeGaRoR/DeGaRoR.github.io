'use strict';
// Differential geometry regression: preserve the pre-cache depth law exactly.
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');
const src=fs.readFileSync(path.join(__dirname,'../src/viewer/render_premises.js'),'utf8');
const a=src.indexOf('  function patchDepth(x, z) {'),b=src.indexOf('\n  // G680:',a);
const current=src.slice(a,b);
const reference="  function patchDepth(x, z) {\n    const A = patchAct, b = patchB; if (!A || !b) return 0;\n    // (the chunk the point is IN, a shared edge the upper chunk's: a point on an unbuilt chunk's edge is 0 deep. The\n    // patch's inline walk took floor((x - 0.01) / 64) and skipped that chunk itself, so a vertex on a chunk's low x or\n    // low z edge never measured the unbuilt chunk it lay on: it stood at the ground, a column 2 m over its tucked\n    // neighbour 2 m in - a thin wall along two of every border's four sides)\n    const ei = Math.floor(x / PCH), ej = Math.floor(z / PCH);\n    if (!A.act.has(A.key(ei, ej))) return 0;\n    let edge = Math.min(x - b.x0, b.x1 - x, z - b.z0, b.z1 - z);\n    for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) {\n      if (!di && !dj) continue;\n      if (A.act.has(A.key(ei + di, ej + dj))) continue;\n      const nx0 = (ei + di) * PCH, nz0 = (ej + dj) * PCH;\n      const dx = Math.max(nx0 - x, x - nx0 - PCH, 0), dz = Math.max(nz0 - z, z - nz0 - PCH, 0);\n      edge = Math.min(edge, Math.hypot(dx, dz));\n    }\n    return Math.max(0, edge);\n  }";

const ctx=()=>({PCH:64,patchB:{x0:-192,z0:-192,x1:256,z1:256},patchAct:null,patchDepthCells:new Map()});
const before=ctx(),after=ctx();vm.runInNewContext(reference,before);vm.runInNewContext(current,after);
const key=(i,j)=>i+','+j;let seed=12345,count=0;
const rnd=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
for(let layout=0;layout<12;layout++){
 const act=new Set();for(let i=-4;i<=4;i++)for(let j=-4;j<=4;j++)if(rnd()>.25)act.add(key(i,j));
 for(const c of [before,after]){c.patchAct={act,key};c.patchDepthCells.clear();}
 for(let i=-5;i<=5;i++)for(let j=-5;j<=5;j++)for(const dx of [0,1e-8,2,32,62,64-1e-8,64])for(const dz of [0,1e-8,2,32,62,64-1e-8,64]){
  const x=i*64+dx,z=j*64+dz;
  assert(Object.is(before.patchDepth(x,z),after.patchDepth(x,z)),`depth changed at ${x},${z}, layout ${layout}`);count++;
 }
 assert(after.patchDepthCells.size<=act.size,'cache retained off-patch cells');
}
assert(/patchAct = A; patchB = b; patchDepthCells.clear\(\)/.test(src),'all patch replacements must invalidate cached neighbours');
console.log(`PATCH DEPTH: PASS (${count} exact comparisons, 12 changing patch layouts, bounded cache)`);
