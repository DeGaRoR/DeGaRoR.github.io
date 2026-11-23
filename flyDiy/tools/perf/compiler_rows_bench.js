'use strict';
const fs=require('fs'),path=require('path'),PR=require('../page_rig.js');
const input=process.argv[2],out=path.resolve(process.argv[3]),rows=JSON.parse(fs.readFileSync(input,'utf8'));fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'sources.json'),JSON.stringify(rows));
const compile=`async function(index){const row=window.__SHADER_ROWS[index],g=window.__LAB_GL||(window.__LAB_GL=document.createElement('canvas').getContext('webgl2'));if(!g)throw Error('No WebGL2');
 for(const name of g.getSupportedExtensions())g.getExtension(name);const ext=g.getExtension('KHR_parallel_shader_compile'),dbg=g.getExtension('WEBGL_debug_shaders');if(!ext)throw Error('No parallel completion polling');
 const t=performance.now(),vs=g.createShader(g.VERTEX_SHADER),fs=g.createShader(g.FRAGMENT_SHADER),p=g.createProgram();g.shaderSource(vs,row.vs);g.compileShader(vs);g.shaderSource(fs,row.fs);g.compileShader(fs);g.attachShader(p,vs);g.attachShader(p,fs);g.linkProgram(p);
 const end=performance.now()+120000;while(!g.getProgramParameter(p,ext.COMPLETION_STATUS_KHR)){if(performance.now()>end)throw Error('Compiler deadline');await new Promise(r=>setTimeout(r,20));}
 const ms=performance.now()-t,ok=g.getProgramParameter(p,g.LINK_STATUS),result={name:row.name,family:row.family,mist:row.mist,ms,ok,vsOk:g.getShaderParameter(vs,g.COMPILE_STATUS),fsOk:g.getShaderParameter(fs,g.COMPILE_STATUS),log:g.getProgramInfoLog(p),vsLog:g.getShaderInfoLog(vs),fsLog:g.getShaderInfoLog(fs),glError:g.getError(),hlslChars:dbg?dbg.getTranslatedShaderSource(fs).length:null};
 if(ok){result.samplers=[];const types=[g.SAMPLER_2D,g.SAMPLER_3D,g.SAMPLER_CUBE,g.SAMPLER_2D_SHADOW,g.SAMPLER_CUBE_SHADOW,g.SAMPLER_2D_ARRAY,g.SAMPLER_2D_ARRAY_SHADOW,g.INT_SAMPLER_2D,g.UNSIGNED_INT_SAMPLER_2D];for(let i=0;i<g.getProgramParameter(p,g.ACTIVE_UNIFORMS);i++){const u=g.getActiveUniform(p,i);if(types.includes(u.type))result.samplers.push({name:u.name,size:u.size,type:u.type});}result.activeSamplerElements=result.samplers.reduce((n,u)=>n+u.size,0);result.fragmentTextureUnitLimit=g.getParameter(g.MAX_TEXTURE_IMAGE_UNITS);}
 g.deleteProgram(p);g.deleteShader(vs);g.deleteShader(fs);return result;
}`;
(async()=>{const result={scope:'Compiler-only wall time of complete captured real-game source pairs, one link at a time. Prepared source interventions identify compiler work; no game rendering or visual acceptance is claimed. No scene rendering, no loading-time saving or exclusive CPU attribution. Fresh visible Chrome per order, real GPU; driver cache erasure not claimed.',runs:[]};
 try{for(let order=0;order<(process.argv.includes('--one-order')?1:2);order++){
  const run={order,rows:[]};result.runs.push(run);
  try{await PR.start({name:'shader-rows-'+order,page:'tools/perf/compiler_probe.html',headed:true,size:'1280x720',cap:900,onNavigate:async rig=>{
   run.gpu=rig.gpu;for(let i=0;i<50;i++){if(await rig.ev("document.readyState==='complete'"))break;await new Promise(r=>setTimeout(r,100));}
   await rig.ev('window.__SHADER_ROWS='+JSON.stringify(rows)+';true');await rig.ev('window.__COMPILE_ROW='+compile);
   const indices=rows.map((_,i)=>i);if(order)indices.reverse();for(const i of indices){console.log('COMPILER START '+order+' '+rows[i].name);const r=await rig.J('window.__COMPILE_ROW('+i+')');run.rows.push(r);fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(result,null,2));console.log('COMPILER DONE '+r.name+' '+(r.ms/1000).toFixed(3)+' s; linked '+r.ok);if(!r.ok||!r.vsOk||!r.fsOk||r.glError)throw Error('Compiler validation failed '+r.name);}
   throw Error('EXPECTED_COMPILER_DIAGNOSTIC_COMPLETE');
  }});}catch(e){if(!String(e).includes('EXPECTED_COMPILER_DIAGNOSTIC_COMPLETE'))throw e;}
 }
 result.complete=true;
 }catch(e){result.error=String(e);process.exitCode=1;console.error(e);}
 fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(result,null,2));
})();
