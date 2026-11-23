'use strict';
// Exact ATMO module substitution in captured real-game programs; no fake BOOT.
const fs=require('fs'),path=require('path'),vm=require('vm'),zlib=require('zlib'),PR=require('../page_rig.js');
const input=process.argv[2],out=path.resolve(process.argv[3]);
fs.mkdirSync(out,{recursive:true});
function atmosphere(on){const c={location:{search:on?'?fmist=c':'?fmist=0'},URLSearchParams,module:{exports:{}}};vm.createContext(c);for(const file of['forest_mist.js','atmo.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../../src/viewer',file),'utf8'),c);return c.module.exports;}
const on=atmosphere(true),off=atmosphere(false);if(JSON.stringify(on.AP)!==JSON.stringify(off.AP)||on.GLSL.AP!==off.GLSL.AP)throw Error('Atmosphere atlas/sample layout differs; substitution not isolated');
const data=JSON.parse(zlib.gunzipSync(fs.readFileSync(input))),rows=[];
for(const [id,label]of[[19,'Coarse ground'],[119,'Fine ground'],[22,'Pavement']]){
 const p=data.programs.find(p=>p.id===id);if(!p)throw Error('Missing captured program '+id);
 const [vs,fragment]=p.shaders.map(k=>data.sources[k]);
 if(id!==22&&(!fragment.includes('#define GS_NOTROND')||!fragment.includes('struct PhysicalMaterial')))throw Error('Ground identity mismatch '+id);
 if(id===22&&!fragment.includes('bool paved = cls < 1.5'))throw Error('Pavement identity mismatch');
 if(fragment.split(on.GLSL.MIST).length!==2)throw Error('Atmosphere block not a unique exact module match: '+id);
 rows.push({name:label+' / pocket mist on',family:label,mist:true,program:id,sourceIds:p.shaders,vs,fs:fragment});
 rows.push({name:label+' / pocket mist off',family:label,mist:false,program:id,sourceIds:p.shaders,vs,fs:fragment.replace(on.GLSL.MIST,off.GLSL.MIST)});
}
fs.writeFileSync(path.join(out,'sources.json'),JSON.stringify(rows));
const compile=`async function(index){const row=window.__SHADER_ROWS[index],g=window.__LAB_GL||(window.__LAB_GL=document.createElement('canvas').getContext('webgl2'));if(!g)throw Error('No WebGL2');
 for(const name of g.getSupportedExtensions())g.getExtension(name);const ext=g.getExtension('KHR_parallel_shader_compile'),dbg=g.getExtension('WEBGL_debug_shaders');if(!ext)throw Error('No parallel completion polling');
 const t=performance.now(),vs=g.createShader(g.VERTEX_SHADER),fs=g.createShader(g.FRAGMENT_SHADER),p=g.createProgram();g.shaderSource(vs,row.vs);g.compileShader(vs);g.shaderSource(fs,row.fs);g.compileShader(fs);g.attachShader(p,vs);g.attachShader(p,fs);g.linkProgram(p);
 const end=performance.now()+120000;while(!g.getProgramParameter(p,ext.COMPLETION_STATUS_KHR)){if(performance.now()>end)throw Error('Compiler deadline');await new Promise(r=>setTimeout(r,20));}
 const ms=performance.now()-t,ok=g.getProgramParameter(p,g.LINK_STATUS),result={name:row.name,family:row.family,mist:row.mist,ms,ok,vsOk:g.getShaderParameter(vs,g.COMPILE_STATUS),fsOk:g.getShaderParameter(fs,g.COMPILE_STATUS),log:g.getProgramInfoLog(p),vsLog:g.getShaderInfoLog(vs),fsLog:g.getShaderInfoLog(fs),glError:g.getError(),hlslChars:dbg?dbg.getTranslatedShaderSource(fs).length:null};g.deleteProgram(p);g.deleteShader(vs);g.deleteShader(fs);return result;
}`;
(async()=>{const result={scope:'Compiler-only wall time of complete captured real-game source pairs, one link at a time. Generated ATMO.GLSL.MIST replaced exactly with actual off-module output; other source unchanged. No scene rendering, no loading-time saving or exclusive CPU attribution. Fresh visible Chrome per order, real GPU; driver cache erasure not claimed.',runs:[]};
 try{for(let order=0;order<2;order++){
  const run={order,rows:[]};result.runs.push(run);
  try{await PR.start({name:'mist-compiler-'+order,page:'tools/perf/compiler_probe.html',headed:true,size:'1280x720',cap:900,onNavigate:async rig=>{
   run.gpu=rig.gpu;for(let i=0;i<50;i++){if(await rig.ev("document.readyState==='complete'"))break;await new Promise(r=>setTimeout(r,100));}
   await rig.ev('window.__SHADER_ROWS='+JSON.stringify(rows));await rig.ev('window.__COMPILE_ROW='+compile);
   const indices=rows.map((_,i)=>i);if(order)indices.reverse();for(const i of indices){console.log('COMPILER START '+order+' '+rows[i].name);const r=await rig.J('window.__COMPILE_ROW('+i+')');run.rows.push(r);fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(result,null,2));console.log('COMPILER DONE '+r.name+' '+(r.ms/1000).toFixed(3)+' s; linked '+r.ok);if(!r.ok||!r.vsOk||!r.fsOk||r.glError)throw Error('Compiler validation failed '+r.name);}
   throw Error('EXPECTED_COMPILER_DIAGNOSTIC_COMPLETE');
  }});}catch(e){if(!String(e).includes('EXPECTED_COMPILER_DIAGNOSTIC_COMPLETE'))throw e;}
 }
 result.complete=true;
 }catch(e){result.error=String(e);process.exitCode=1;console.error(e);}
 fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(result,null,2));
})();
