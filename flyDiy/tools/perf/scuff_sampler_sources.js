'use strict';
// Preserve the existing grunge image; reuse its weathering sampler to make room for computed mud.
const fs=require('fs'),path=require('path'),zlib=require('zlib'),d=JSON.parse(zlib.gunzipSync(fs.readFileSync(process.argv[2]))),out=path.resolve(process.argv[3]),rows=[];
for(const p of d.programs.filter(p=>p.shaders.some(k=>d.sources[k].includes('#define DMG_SCUFF 1')))){
 const [vs,s]=p.shaders.map(k=>d.sources[k]);if((s.match(/uniform sampler2D tGrunge;/g)||[]).length!==1||(s.match(/uniform sampler2D tDmgG;/g)||[]).length!==1||(s.match(/#define GD_OFF 1/g)||[]).length!==1)throw Error('Unexpected sampler source '+p.id);
 const candidate=s.replace('uniform sampler2D tGrunge;','').replace('uniform sampler2D tDmgG;','uniform sampler2D tGrunge;\n#define tDmgG tGrunge').replace('#define GD_OFF 1','// Computed mud/rain restored after sharing the existing grunge sampler.');
 rows.push({name:'Scuff program '+p.id+' / existing',family:'Scuff '+p.id,vs,fs:s});rows.push({name:'Scuff program '+p.id+' / shared grunge + live mud',family:'Scuff '+p.id,vs,fs:candidate});
}
if(!rows.length)throw Error('No scuff shaders');fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'sources.json'),JSON.stringify(rows));fs.writeFileSync(path.join(out,'scope.json'),JSON.stringify({scope:'Captured complete real-game shader pairs. Existing tDmgG and tGrunge uniforms reference the SAME cached aeroWxGrungeTex CanvasTexture in the game. Candidate reuses tGrunge and removes GD_OFF so computed mud/rain can coexist. Link/sampler validation only; not integrated, no wet/crash rendered acceptance or loading-time saving claimed.',programs:rows.length/2},null,2));console.log('Prepared '+rows.length+' sampler compatibility programs');
