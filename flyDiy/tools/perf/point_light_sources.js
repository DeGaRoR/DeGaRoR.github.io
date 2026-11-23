'use strict';
const fs=require('fs'),path=require('path'),zlib=require('zlib'),loop=require('./point_light_loop'),input=JSON.parse(zlib.gunzipSync(fs.readFileSync(process.argv[2]))),out=path.resolve(process.argv[3]),rows=[],seen=new Set();
for(const p of input.programs){const texts=p.shaders.map(k=>input.sources[k]),vs=texts.find(s=>s.includes('gl_Position')),fsrc=texts.find(s=>s.includes('pc_fragColor'));if(!fsrc)continue;
 let family=fsrc.includes('#define SHADER_NAME pavement')?'Road/runway pavement':texts.join('\n').includes('distance(vWPi.xz, uFine.xy) < uFine.z')?'Coarse ground':null;
 if(!family||seen.has(family))continue;const result=loop.expanded(fsrc);if(result.count<8)continue;
 rows.push({name:family+' / original unrolled lights',family,vs,fs:fsrc},{name:family+' / compact point-light loop',family,vs,fs:result.source},{name:family+' / uniform-bound compact loop',family,vs,fs:loop.expanded(fsrc,true).source});seen.add(family);
}
if(seen.size!==2)throw Error('Both heavy families required');fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'sources.json'),JSON.stringify(rows));
fs.writeFileSync(path.join(out,'scope.json'),JSON.stringify({input:process.argv[2],scope:'Compiler screen: complete captured night programs, only unshadowed point-light loop compacted. Same lights, order and RE_Direct calls. No padding, skipped lights, appearance or runtime acceptance. Shadowed-point-light path excluded.',rows:rows.map(r=>({name:r.name,chars:r.fs.length}))},null,2));console.log(rows.map(r=>({name:r.name,chars:r.fs.length})));
