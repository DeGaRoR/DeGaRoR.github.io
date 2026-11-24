'use strict';
const fs=require('fs'),path=require('path'),zlib=require('zlib');
const root=path.resolve(process.argv[2]),read=p=>JSON.parse(fs.readFileSync(p,'utf8').replace(/^\uFEFF/,'')),m=read(path.join(root,'manifest.json'));
const runs=m.cases.map(c=>{
 const folder=path.join(root,c.folder||c.id),file=path.join(folder,'summary.json'),r=fs.existsSync(file)?read(file):null,tp=path.join(folder,'thermal.jsonl');
 const th=fs.existsSync(tp)?fs.readFileSync(tp,'utf8').trim().split('\n').filter(Boolean).map(JSON.parse):[],end=th.findLast(x=>'completed'in x),abort=th.find(x=>x.abort);
 let valid=!!(c.exitCode===0&&r&&r.final&&r.bootHealth&&r.bootHealth.ok&&!r.errors.length&&!r.garage.glError&&!r.final.glError&&r.garageSoak.length>=18&&r.garageResponsiveness&&!abort&&end&&end.completed);
 const issues=[];if(valid){const a=r.final.sceneryAudit;if(!a||!a.biomes||!a.premises)issues.push('Missing audit');else{if(!a.biomes.subOn||!a.biomes.edgeOn||!(a.premises.animals>0)||!(a.premises.traffic>0)||a.town.removed||a.premises.runways!==17)issues.push('Retained scenery mismatch');if(a.mist.c!==c.mist||a.damageLook!==c.damage||a.scuff!==c.damage)issues.push('Test switch mismatch');if(a.pavementNoise.enabled||/[?&](pavmicro|cracks)=0/.test(c.query))issues.push('Runway cues/crack loading changed');}if(issues.length)valid=false;}
 let programs=null;if(valid){const d=JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(folder,'programs.json.gz'))));programs=d.programs.filter(p=>p.t<=r.garage.t).length;}
 return {...c,valid,issues,status:valid?'Completed':abort?'Safety-aborted — exclude':c.finished?'Failed — exclude':c.started?'Running':'Not run',seconds:valid?r.garage.t/1000:null,build:r&&r.garage&&r.garage.build,peakC:end?end.peakC:th.length?Math.max(...th.map(x=>x.cpuMaxC||0)):null,response:valid?r.garageResponsiveness:null,audit:valid?r.final.sceneryAudit:null,phases:valid?Object.fromEntries(r.garage.boot.log.filter(x=>x.k==='step').map(x=>[x.id,x.ms/1000])):null,programs};
});
const build=runs.find(r=>r.valid)?.build;for(const r of runs)if(r.valid&&r.build!==build){r.valid=false;r.issues.push('Build mismatch');r.status='Build mismatch — exclude';r.seconds=null;}
const mean=a=>a.reduce((x,y)=>x+y,0)/a.length;
const conditions=[[true,true,'All systems on'],[true,false,'Damage/scuff off'],[false,true,'Pocket mist off'],[false,false,'Both off']].map(([mist,damage,label])=>{const matches=runs.filter(r=>r.valid&&r.mist===mist&&r.damage===damage),values=matches.map(r=>r.seconds);return {mist,damage,label,seconds:values.length?mean(values):null,count:values.length,values};});
const by=(mist,damage)=>conditions.find(c=>c.mist===mist&&c.damage===damage).seconds;
const complete=conditions.every(c=>c.count>0)&&runs.filter(r=>r.valid&&r.mist&&r.damage).length===2;
const contrasts=complete?{damageOffWithMist:by(true,true)-by(true,false),damageOffWithoutMist:by(false,true)-by(false,false),mistOffWithDamage:by(true,true)-by(false,true),mistOffWithoutDamage:by(true,false)-by(false,false),combinedReduction:by(true,true)-by(false,false)}:null;
const fmt=v=>Number.isFinite(v)?v.toFixed(3):'—';
let md='## Focused pocket-mist × damage/scuff comparison\n\n'+m.protocol+' This narrows the previous damage/scuff/cracks group: cracks are not disabled here. Damage/scuff off changes appearance preparation; crash physics remains active.\n\n| Configuration | Garage (s) | Runs |\n| --- | ---: | ---: |\n';for(const c of conditions)md+='| '+c.label+' | '+fmt(c.seconds)+' | '+c.count+' |\n';
if(contrasts)md+='\nObserved conditional reductions: damage/scuff off with mist '+fmt(contrasts.damageOffWithMist)+'s; without mist '+fmt(contrasts.damageOffWithoutMist)+'s. Mist off with damage '+fmt(contrasts.mistOffWithDamage)+'s; without damage '+fmt(contrasts.mistOffWithoutDamage)+'s. Combined change '+fmt(contrasts.combinedReduction)+'s. Single runs per exclusion; these are screening effects, not exclusive/additive system costs.\n\n';else md+='\nComparison remains incomplete. Aborted or invalid runs do not supply timing values.\n\n';
md+='| Run | Status | Garage (s) | Startup submissions | Max garage frame gap (ms) | CPU peak (°C) |\n| --- | --- | ---: | ---: | ---: | ---: |\n';for(const r of runs)md+='| '+r.id+' | '+r.status+' | '+fmt(r.seconds)+' | '+(r.programs??'—')+' | '+fmt(r.response&&r.response.max)+' | '+fmt(r.peakC)+' |\n';
md+='\nThese startup-only runs do not validate an impact, active plume, wet landing or cockpit transition. Normal configuration retains these systems; the off combinations are diagnostic. Evidence: evidence/PERFORMANCE-2026-11-20/damage-mist-comparison/.\n\n';
for(const r of runs)for(const a of r.attempts||[])md+='Excluded earlier attempt for '+r.id+': '+a.folder+' (exit '+a.exitCode+').\n';
fs.writeFileSync(path.join(root,'analysis.json'),JSON.stringify({updated:new Date().toISOString(),complete,runs,conditions,contrasts,reportMarkdown:md},null,2));
if(runs.some(r=>r.issues.length))process.exitCode=1;
console.log('Focused comparison '+runs.filter(r=>r.valid).length+'/'+runs.length+' valid runs');
