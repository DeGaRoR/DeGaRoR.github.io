'use strict';
const fs=require('fs'),zlib=require('zlib'),path=require('path'),stat=require('../../src/viewer/pavement_static_cache'),way=require('../../src/viewer/pavement_way_cache');
const d=JSON.parse(zlib.gunzipSync(fs.readFileSync(process.argv[2]))),out=path.resolve(process.argv[3]);
const p=d.programs.find(p=>p.shaders.some(k=>d.sources[k].includes('bool paved = cls < 1.5'))),sources=p.shaders.map(k=>d.sources[k]),vs=sources.find(s=>s.includes('gl_Position')),original=sources.find(s=>s.includes('pc_fragColor'));
function loops(s){
 const a=s.indexOf('vec4 pvWays('),b=s.indexOf('// THE ROCKS',a);if(a<0||b<a)throw Error('Ways boundary changed');
 const body=s.slice(a,b);if(body.split('for (int i = 0; i < 4; i++) {').length!==2)throw Error('Ways loop changed');
 s=s.slice(0,a)+'uniform int uPavWayCount;\n'+body.replace('for (int i = 0; i < 4; i++) {','for (int i = 0; i < uPavWayCount; i++) {')+s.slice(b);
 const c=s.indexOf('vec4 pvHoles('),e=s.indexOf('// THE RELIEF',c);if(c<0||e<c)throw Error('Holes boundary changed');
 const h=s.slice(c,e);if(h.split('for (int a = 0; a < 4; a++) {').length!==2||!h.includes('if (a == 3) break;'))throw Error('Hole loop changed');
 return s.slice(0,c)+'uniform int uPavHoleCount;\n'+h.replace('for (int a = 0; a < 4; a++) {','for (int a = 0; a < uPavHoleCount; a++) {').replace('if (a == 3) break;','')+s.slice(e);
}
const rows=[{name:'Original complete pavement program',family:'Original',vs,fs:original},{name:'Uniform-bound original hole/way loops',family:'Same formulas, uniform loop bounds',vs,fs:loops(original)},{name:'Small descriptor bakes with uniform loops',family:'Bakes with uniform loops',vs,fs:loops(way.patch(stat.patch(original)))}];
fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'sources.json'),JSON.stringify(rows));console.log('Prepared three real-program loop screens; game remains unchanged');
