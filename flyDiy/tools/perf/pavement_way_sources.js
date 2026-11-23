'use strict';
const fs=require('fs'),zlib=require('zlib'),path=require('path'),way=require('../../src/viewer/pavement_way_cache');
const d=JSON.parse(zlib.gunzipSync(fs.readFileSync(process.argv[2]))),out=path.resolve(process.argv[3]);
const p=d.programs.find(p=>p.shaders.some(k=>d.sources[k].includes('bool paved = cls < 1.5')));
if(!p)throw Error('Captured pavement program required');
const sources=p.shaders.map(k=>d.sources[k]),vs=sources.find(s=>s.includes('gl_Position')),fsrc=sources.find(s=>s.includes('pc_fragColor'));
const rows=[{name:'Original complete pavement program',family:'Original',vs,fs:fsrc},{name:'One-dimensional baked way curves',family:'Baked way curves',vs,fs:way.patch(fsrc)}];
fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'sources.json'),JSON.stringify(rows));fs.writeFileSync(path.join(out,'scope.json'),JSON.stringify({sourceProgram:p.id,sourceIds:p.shaders,scope:'Real complete current program; substitute only static longitudinal way noise with sampled curve data. Analytic transverse troughs, berms, hazards, holes, live weather and relief unchanged. Compiler-only; no image or loading acceptance.'},null,2));
console.log('Prepared two complete pavement programs');
