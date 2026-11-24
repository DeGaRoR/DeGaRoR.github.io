'use strict';
const fs=require('fs'),path=require('path'),zlib=require('zlib'),crypto=require('crypto'),root=path.resolve(process.argv[2]);
const read=f=>JSON.parse(fs.readFileSync(path.join(root,f))),hash=s=>crypto.createHash('sha256').update(s).digest('hex');
function canonical(vs,fsrc){
 let s=fsrc.replace(/^#define SHADER_NAME .*$/gm,'');const n=+(s.match(/uniform PointLight pointLights\[\s*(\d+)\s*\]/)?.[1]||0),decl=s.indexOf('PointLight pointLight;'),spot=s.indexOf('SpotLight spotLight;',decl);
 if(n&&decl>=0&&spot>decl){const start=s.lastIndexOf('#if (',decl),end=s.lastIndexOf('#if (',spot),part=s.slice(start,end);if(part.includes('#if defined( USE_SHADOWMAP ) && 0 > 0'))s=s.slice(0,start)+'POINT_LIGHT_LOOP\n'+s.slice(end);}
 s=s.replace(/#if \d+ > 0\s+struct PointLight/g,'#if POINT_COUNT > 0\nstruct PointLight').replace(/uniform PointLight pointLights\[\s*\d+\s*\]/g,'uniform PointLight pointLights[POINT_COUNT]');
 return hash(vs.replace(/^#define SHADER_NAME .*$/gm,'')+'\n'+s);
}
const trips=read('lighting-cycle.json'),summary={scope:'Native-player diagnostic source/ownership capture. Readiness timings include instrumentation; source matches normalize ONLY the unshadowed point-light loop/array/count guard and shader display name. Not a compiler CPU bill or visual acceptance.',transitions:[]};
let prior=new Map();
for(const trip of trips){const id='lighting-'+trip.preset,d=JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(root,id+'.json.gz')))),meta=read(id+'.meta.json'),rows=[];
 const owners=new Map();for(const o of d.owners){let a=owners.get(o.program);if(!a)owners.set(o.program,a=[]);a.push(o);}
 const canon=new Map();for(const p of d.programs){const texts=p.shaders.map(k=>d.sources[k]),vs=texts.find(s=>s.includes('gl_Position')),frag=texts.find(s=>s.includes('pc_fragColor'));if(!vs||!frag)continue;const count=+(frag.match(/uniform PointLight pointLights\[\s*(\d+)\s*\]/)?.[1]||0),key=canonical(vs,frag),a=canon.get(key)||[];a.push({id:p.id,count});canon.set(key,a);
  if(p.id<trip.before.n)continue;const oo=owners.get(p.id)||[],m=oo[0],family=m?.name||(/aCoarseN/.test(texts.join(''))?'Island ground':'Unnamed/shared');const previous=(prior.get(key)||[]).filter(x=>x.count!==count);
  rows.push({id:p.id,count,phase:p.phase,stage:p.stage,submitted:p.t,observedReady:p.ready,sourceIds:p.shaders,family,ground:!!m?.groundFamily,previousSameSourceExceptPointCount:previous,materialKeys:[...new Set(oo.map(x=>x.key))].map(k=>k.slice(0,180)),materialCount:new Set(oo.map(x=>x.material)).size});
 }
 summary.transitions.push({preset:trip.preset,observerMs:trip.after.t-trip.before.t,newLinks:trip.after.n-trip.before.n,gl:trip.after.gl,clock:meta.clock,sourceMatchedOtherLightCount:rows.filter(r=>r.previousSameSourceExceptPointCount.length).length,counts:rows.reduce((m,r)=>(m[r.count]=(m[r.count]||0)+1,m),{}),trips:trip.after.trips,rows});prior=canon;
}
fs.writeFileSync(path.join(root,'analysis.json'),JSON.stringify(summary,null,2));for(const t of summary.transitions)console.log(JSON.stringify({preset:t.preset,seconds:t.observerMs/1000,newLinks:t.newLinks,matchedCountOnly:t.sourceMatchedOtherLightCount,counts:t.counts,gl:t.gl}));
