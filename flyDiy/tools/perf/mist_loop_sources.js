'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),zlib=require('zlib');
const out=path.resolve(process.argv[3]);fs.mkdirSync(out,{recursive:true});
function atmosphere(loop){const c={location:{search:'?fmist=c'+(loop?'&fmistloop=1':'')},URLSearchParams,module:{exports:{}}};vm.createContext(c);for(const f of ['forest_mist.js','atmo.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../../src/viewer',f),'utf8'),c);return c.module.exports;}
const original=atmosphere(false),candidate=atmosphere(true),data=JSON.parse(zlib.gunzipSync(fs.readFileSync(process.argv[2]))),rows=[];
if(original.GLSL.MIST===candidate.GLSL.MIST)throw Error('Loop intervention absent');
for(const [id,label]of [[119,'Fine ground'],[22,'Pavement']]){
 const p=data.programs.find(p=>p.id===id),[vs,fsrc]=p.shaders.map(k=>data.sources[k]);
 if(fsrc.split(original.GLSL.MIST).length!==2)throw Error('Original source does not exactly match captured atmosphere '+id);
 rows.push({name:label+' / original mist loops',family:label,vs,fs:fsrc});
 rows.push({name:label+' / one uniform-bound mist loop',family:label,vs,fs:fsrc.replace(original.GLSL.MIST,candidate.GLSL.MIST)});
}
// Verify ordered positions and integration weights, including disabled/fractional/max taps.
let checks=0;for(const D of [0,1,100,450,451,1000,25000])for(const surface of [0,.2,1,2,4,8,9])for(const eye of [0,.5,.6,1,2,4,5]){
 const Ls=Math.min(D,450),dts=Ls/Math.max(1,surface),Le=Math.min(D-Ls,200),dte=Le/Math.max(1,eye),a=[],b=[];
 for(let i=0;i<8;i++){if(i>=surface)break;a.push([D-(i+.5)*dts,dts]);}if(D>Ls&&eye>.5)for(let i=0;i<4;i++){if(i>=eye)break;a.push([(i+.5)*dte,dte]);}
 const sn=Math.ceil(Math.max(0,Math.min(8,surface))),en=D>Ls&&eye>.5?Math.ceil(Math.max(0,Math.min(4,eye))):0;
 for(let i=0;i<sn+en;i++)b.push(i<sn?[D-(i+.5)*dts,dts]:[(i-sn+.5)*dte,dte]);
 if(JSON.stringify(a)!==JSON.stringify(b))throw Error('Mist sample mismatch');checks++;
}
fs.writeFileSync(path.join(out,'sources.json'),JSON.stringify(rows));fs.writeFileSync(path.join(out,'scope.json'),JSON.stringify({checks,scope:'Exact ordered density sample positions and weights; identical mist model and weather. Compiler-only screening, dynamic-loop runtime/active mist image acceptance and whole loading remain unproven.'},null,2));console.log('Prepared '+rows.length+' shaders; '+checks+' ordered sample checks passed.');
