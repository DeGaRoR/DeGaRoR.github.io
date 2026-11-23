'use strict';
const fs=require('fs'),path=require('path'),zlib=require('zlib');
const dir=path.resolve(__dirname,'../../reports/evidence/PERFORMANCE-2026-11-19/material-cache');
const names=['integrated-control-1','integrated-control-2','integrated-candidate-7','integrated-candidate-8-repeat'];
const runs=[];
function response(data,start,end){
 const times=data.frames.filter(t=>t>=start&&t<=end),gaps=times.slice(1).map((t,i)=>t-times[i]).sort((a,b)=>a-b);
 const tasks=data.longTasks.filter(t=>t.t>=start&&t.t<=end);
 return {samples:gaps.length,p50Ms:gaps[Math.floor(gaps.length*.5)],p99Ms:gaps[Math.floor(gaps.length*.99)],maxMs:gaps.at(-1),over100:gaps.filter(t=>t>100).length,over1000:gaps.filter(t=>t>1000).length,longTaskCount:tasks.length,longTaskMaxMs:Math.max(0,...tasks.map(t=>t.ms)),longTaskTotalMs:tasks.reduce((s,t)=>s+t.ms,0)};
}
function imageSize(file){if(!fs.existsSync(file))return null;const fd=fs.openSync(file,'r'),b=Buffer.alloc(24);try{fs.readSync(fd,b,0,24,0);return {w:b.readUInt32BE(16),h:b.readUInt32BE(20)};}finally{fs.closeSync(fd);}}
for(const name of names){
 const folder=path.join(dir,name),summary=path.join(folder,'summary.json');if(!fs.existsSync(summary))continue;
 const r=JSON.parse(fs.readFileSync(summary,'utf8'));
 if(!r.final||!r.bootHealth||!r.bootHealth.ok||r.errors.length||r.garage.glError)continue;
 const cold=path.join(folder,fs.existsSync(path.join(folder,'programs-cold.json.gz'))?'programs-cold.json.gz':'programs.json.gz');
 const data=JSON.parse(zlib.gunzipSync(fs.readFileSync(cold)));
 const inventory={programInstances:0,combinedGround:0,builder:0,reader:0};
 const phaseSubmissions={};
 for(const p of data.programs){if(p.t>r.final.t)continue;inventory.programInstances++;phaseSubmissions[p.phase||'other']=(phaseSubmissions[p.phase||'other']||0)+1;
  const source=data.sources[p.shaders[1]]||'',main=source.slice(source.indexOf('void main() {'));
  if(source.includes('out highp uvec4 cachePacked')||source.includes('out highp vec4 cacheNormal'))inventory.builder++;
  else if(source.includes('uniform highp usampler2D uMaterialCachePacked')||source.includes('uniform sampler2D uMaterialCacheNormal'))inventory.reader++;
  else if(main.includes('{ vec2 guv = (vWPi.xz - uGGrid.xy) / uGGrid.zw;')&&main.includes('PhysicalMaterial material;'))inventory.combinedGround++;
 }
 const phaseMs=Object.fromEntries(r.garage.boot.log.filter(e=>e.k==='step').map(e=>[e.id,e.ms]));
 const garage=response(data,r.garage.t,r.garageSoak.at(-1).t);
 const operations=r.operations.map(o=>({name:o.name,ms:o.ms,response:o.snapshot&&o.soak?response(data,o.snapshot.t,o.soak.at(-1).t):null}));
 runs.push({name,build:r.garage.build,query:r.query,garageSeconds:r.garage.t/1000,phaseMs,phaseSubmissions,inventory,garageResponse:garage,garageProbeMaxMs:Math.max(...r.garageSoak.map(s=>s.probeMs)),operations,cache:r.final.cache,glErrors:[r.garage.glError,r.final.glError],pageErrors:r.pageErrors,images:{garage:imageSize(path.join(folder,'garage.png')),world:imageSize(path.join(folder,'world.png'))}});
}
const output={updated:new Date().toISOString(),method:'Visible Chrome, fresh isolated profiles, fixed game-only saved state (Piper Cub), full hangar, viewport 5120x1271/DPR1. Ready times are poll-detected (~1 s resolution), not a verified native F11 screen. Driver cache not independently cleared. Controlled run order and all unsuccessful attempts are recorded in the living report. Post-ready rAF measures scheduling gaps; it is not input acknowledgement or GPU frame time. Cold census excludes subsequent image/GPU acceptance commands.',runs};
fs.writeFileSync(path.join(dir,'integrated-comparison.json'),JSON.stringify(output,null,2));
console.log(JSON.stringify(runs.map(r=>({name:r.name,garageSeconds:r.garageSeconds,worldCompileSeconds:r.phaseMs.worldCompile/1000,garageCompileSeconds:r.phaseMs.compile/1000,inventory:r.inventory,garageGapMax:r.garageResponse.maxMs,operations:r.operations.map(o=>({name:o.name,ms:o.ms}))})),null,2));
