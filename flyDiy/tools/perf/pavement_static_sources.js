'use strict';
const fs=require('fs'),zlib=require('zlib'),path=require('path'),stat=require('../../src/viewer/pavement_static_cache'),way=require('../../src/viewer/pavement_way_cache');
const d=JSON.parse(zlib.gunzipSync(fs.readFileSync(process.argv[2]))),out=path.resolve(process.argv[3]);
const p=d.programs.find(p=>p.shaders.some(k=>d.sources[k].includes('bool paved = cls < 1.5')));
const sources=p.shaders.map(k=>d.sources[k]),vs=sources.find(s=>s.includes('gl_Position')),original=sources.find(s=>s.includes('pc_fragColor'));
const rows=[{name:'Original complete pavement program',family:'Original',vs,fs:original},{name:'Static hole and hazard descriptors',family:'Static descriptors',vs,fs:stat.patch(original)},{name:'Descriptors plus one-dimensional way curves',family:'Combined descriptors/ways',vs,fs:way.patch(stat.patch(original))}];
fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'sources.json'),JSON.stringify(rows));console.log('Prepared three complete descriptor compiler variants');
