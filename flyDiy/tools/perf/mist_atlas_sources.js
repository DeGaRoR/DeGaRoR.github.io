'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),zlib=require('zlib');
const out=path.resolve(process.argv[3]);fs.mkdirSync(out,{recursive:true});
function atmosphere(cache){const c={location:{search:'?fmist=c'+(cache?'&fmistcache=1':'')},URLSearchParams,module:{exports:{}}};vm.createContext(c);for(const f of ['forest_mist.js','atmo.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../../src/viewer',f),'utf8'),c);return c.module.exports;}
const original=atmosphere(false),candidate=atmosphere(true),data=JSON.parse(zlib.gunzipSync(fs.readFileSync(process.argv[2]))),rows=[];
if(JSON.stringify(original.AP)!==JSON.stringify(candidate.AP))throw Error('Atlas layout changed');
for(const [id,label]of [[119,'Fine ground'],[22,'Pavement']]){
 const p=data.programs.find(p=>p.id===id),[vs,fsrc]=p.shaders.map(k=>data.sources[k]);
 if(fsrc.split(original.GLSL.MIST).length!==2)throw Error('Original atmosphere does not exactly match capture '+id);
 rows.push({name:label+' / original mist noise',family:label,vs,fs:fsrc});
 rows.push({name:label+' / cached mist hash lattice',family:label,vs,fs:fsrc.replace(original.GLSL.MIST,candidate.GLSL.MIST)});
}
fs.writeFileSync(path.join(out,'sources.json'),JSON.stringify(rows));fs.writeFileSync(path.join(out,'scope.json'),JSON.stringify({scope:'Same atmosphere atlas layout/sampler. Four GPU-baked hash corners replace repeated hashes, retaining Hermite interpolation, all six noise terms, weather, samples and density law. The chosen elong=1 recipe does not read the reused contour tile; other elong values keep the original path. Half-float atlas quantization and GPU arithmetic require active-mist image acceptance. Compiler-only screening is not whole loading.'},null,2));console.log('Prepared '+rows.length+' mist atlas programs');
