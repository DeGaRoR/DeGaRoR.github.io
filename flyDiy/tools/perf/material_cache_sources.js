'use strict';
const fs=require('fs'),path=require('path'),zlib=require('zlib');
const cache=require('../../src/viewer/ground_material_cache.js');
const root=path.resolve(__dirname,'../..');
const out=path.join(root,'reports/evidence/PERFORMANCE-2026-11-19/material-cache');fs.mkdirSync(out,{recursive:true});
const d=JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(root,'reports/evidence/PERFORMANCE-2026-11-19/audit-full-hangar-timing/garage.json.gz'))));
const p=d.programs.find(p=>p.id===19),[vs,fs0]=p.shaders.map(k=>d.sources[k]);
// Keep this evidence reproducible: the first compiler run used world UVs.
const s=cache.deriveSources(vs,fs0,{space:'world'});
const rows=[{name:'original-combined-ground',vs,fs:fs0},{name:'material-only-baker',vs,fs:s.bakeFs},{name:'cached-material-lighting',vs,fs:s.litFs}];
for(const r of rows)if(!r.fs.includes('void main()')||!r.fs.includes('gl_FragColor'))throw Error('Missing shader main/output');
if(!s.bakeFs.includes('t = sSplat(')||s.bakeFs.slice(s.bakeFs.lastIndexOf('void main()')).includes('PhysicalMaterial material;'))throw Error('Invalid baker boundary');
if(s.litFs.slice(s.litFs.lastIndexOf('void main()')).includes('t = sSplat('))throw Error('Lit pass still evaluates splat');
fs.writeFileSync(path.join(out,'sources.json'),JSON.stringify(rows));
fs.writeFileSync(path.join(out,'scope.json'),JSON.stringify({originalProgram:19,vertexPreserved:true,bakerOutputs:['linear albedo + roughness','world normal'],lightingPreserved:true,productionEnabled:false,limitations:['A cache tile is valid for its recipe, geometry, weather and distance/detail configuration.','Filtering and cache interpolation require image comparison.','Prototype captures existing compiled sources; production needs independent source generation before original compilation.']},null,2));
console.log('Material-cache sources prepared: combined reference, unlit MRT builder, cached lighting pass.');
