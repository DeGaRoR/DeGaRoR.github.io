'use strict';
const fs=require('fs'),path=require('path'),root=path.resolve(process.argv[2]);
const read=p=>fs.existsSync(p)?JSON.parse(fs.readFileSync(p)):null;
const runs=['control','candidate'].map(id=>{
 const dir=path.join(root,id),s=read(path.join(dir,'summary.json')),r=read(path.join(dir,'ready.json'));
 const tf=path.join(dir,'thermal.jsonl'),thermal=fs.existsSync(tf)?fs.readFileSync(tf,'utf8').trim().split('\n').filter(Boolean).map(JSON.parse):[],last=thermal.findLast(x=>'completed'in x);
 const glChecks=[r?.glError,...(s?.steps||[]).map(x=>x.renderState?.glError),s?.afterFlight?.final?.glError].filter(x=>x!==undefined);
 const nullQueries=[r?.probe?.queryNulls,...(s?.steps||[]).map(x=>x.renderState?.probe?.queryNulls),s?.afterFlight?.final?.probe?.queryNulls].filter(x=>x!==undefined);
 const valid=!!(s?.ok&&s.steps.length===9&&s.steps.every(x=>x.ok)&&r?.bootHealth?.ok&&r.clock.legacy===false&&glChecks.every(x=>x===0)&&nullQueries.every(x=>x===0)&&last?.completed&&last.code===0&&!thermal.some(x=>x.abort));
 const focus=read(path.join(dir,'focus-correction.json'));
 const steps=(s?.steps||[]).map(x=>({name:x.name,ok:x.ok,frames:x.frames,wallS:x.wallS,glError:x.renderState?.glError}));
 return {id,valid,complete:!!last,seconds:r?.loadMs/1000,build:r?.build,peakC:last?.peakC??Math.max(0,...thermal.map(x=>x.cpuMaxC||0)),startUTC:thermal[0]?.utc,startC:thermal[0]?.cpuMaxC,glChecks,nullQueries,focusIntervention:focus?.result?.result?.value||null,memory:r?.memory,finalMemory:s?.afterFlight?.final?.memory,steps,boot:r?.boot?.filter(x=>['step','gone','ready','run','boot.js'].includes(x.k)),errors:read(path.join(dir,'runner-error.json'))};
});
const proof=read(path.join(root,'candidate/material-proof.json'));let visual=null;
if(proof?.ok){const p=proof.value;visual={scope:p.scope,cache:p.cache,staticCache:p.staticCache,wayCache:p.wayCache,forcedPuddleCapacity:p.forcedPuddleCapacity,gpu:p.gpu,glError:p.glError,row:p.row,micro:p.micro,cases:p.cases.map(c=>{const images={};for(const [name,b64]of Object.entries(c.images)){const file='compact-'+c.wet+'-'+name+'.png';fs.writeFileSync(path.join(root,'candidate',file),Buffer.from(b64,'base64'));images[name]=file;}const {images:_,...stats}=c;return {...stats,images};})};}
const summary={updated:new Date().toISOString(),runs,visual,visualError:proof&&!proof.ok?proof.error:null,decision:'Keep compact runway bakes OFF in delivered build. Compiler gains do not establish an integrated loading win. Preserve the slow candidate observation; its focus intervention and long interval from the reference prevent a clean causal comparison. No further optimization experiments in this wrap-up.'};
fs.writeFileSync(path.join(root,'analysis.json'),JSON.stringify(summary,null,2));console.log(JSON.stringify({valid:runs.filter(r=>r.valid).length,runs:runs.map(r=>({id:r.id,seconds:r.seconds,valid:r.valid,peakC:r.peakC})),visual:!!visual}));
