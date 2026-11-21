'use strict';
// Diagnostic stage-only run: Chrome sampling + existing recorder scope hooks.
const fs=require('fs'),path=require('path'),PR=require('../page_rig.js');
const out=path.resolve(process.argv[2]),fixture=JSON.parse(fs.readFileSync(process.argv[3],'utf8').replace(/^\uFEFF/,''));
const query=process.argv[4]||'mode=sandbox&parkstock=1&groundcache=0&perftrim=1';
fs.mkdirSync(out,{recursive:true});const seed={...fixture.storage,'flydiy.garageStudio':'0'};
const init=`(()=>{const D=window.__GEOMETRY_DIAG={scopes:{},slices:[],wrapped:false};
 const timer=setInterval(()=>{
  if(!D.generator&&typeof window.buildWorldSceneSteps==='function'){D.generator=true;const orig=window.buildWorldSceneSteps;
   window.buildWorldSceneSteps=function(...args){const g=orig.apply(this,args);return {next(...a){const t=performance.now(),r=g.next(...a);D.slices.push({t,ms:performance.now()-t,label:r.done?'done':String(r.value)});return r;},[Symbol.iterator](){return this;}};};}
  if(!D.wrapped&&window.FLIGHT_REC){D.wrapped=true;const R=FLIGHT_REC,push=R.push,pop=R.pop,stack=[];
   R.push=function(s){const v=push.apply(this,arguments);stack.push({s,t:performance.now(),children:0,phase:window.BOOT&&BOOT.current&&BOOT.current.id});return v;};
   R.pop=function(){const r=stack.pop();if(r){const ms=performance.now()-r.t,key=r.phase+':'+r.s,row=D.scopes[key]||(D.scopes[key]={calls:0,inclusiveMs:0,selfMs:0,maxMs:0});row.calls++;row.inclusiveMs+=ms;row.selfMs+=ms-r.children;row.maxMs=Math.max(row.maxMs,ms);if(stack.length)stack[stack.length-1].children+=ms;}return pop.apply(this,arguments);};
   D.scopeNames=R.S;}
 },10);setTimeout(()=>clearInterval(timer),130000);
})();`;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{try{await PR.start({name:'geometry-cpu-profile',headed:true,live:process.argv.includes('--live'),size:'5120x1271',q:query,seed,init,cap:150,boot:130,onNavigate:async r=>{
 await r.cmd('Profiler.enable');await r.cmd('Profiler.setSamplingInterval',{interval:1000});
 const before=await r.ev('performance.now()');const start=await r.cmd('Profiler.start');if(start.error)throw Error(JSON.stringify(start.error));
 const phases=[],end=Date.now()+125000;let prev='';
 while(Date.now()<end){const s=await r.J('({t:performance.now(),phase:window.BOOT&&BOOT.current&&BOOT.current.id})');
  if(s.phase!==prev){console.log(JSON.stringify(s));phases.push(s);prev=s.phase;}
  if(['parked','snapshot','bake','images','upload','worldCompile'].includes(s.phase))break;await sleep(500);
 }
 const stopped=await r.cmd('Profiler.stop');if(stopped.error||!stopped.result.profile)throw Error('No Chrome CPU profile');
 fs.writeFileSync(path.join(out,'chrome.cpuprofile'),JSON.stringify(stopped.result.profile));
 const data=await r.J('({t:performance.now(),build:window.FLYDIY_BUILD,bootT0:BOOT.t0,log:BOOT.log,diag:__GEOMETRY_DIAG,settle:window.FLYDIY_WORLD_SETTLE,clock:window.FLYDIY_PACE&&FLYDIY_PACE.state(),terrainMemo:FLIGHT_PROBE.world().terrainMemo(),scopes:FLIGHT_REC.S})');
 data.profileStartBeforeMs=before;data.query=query;data.phases=phases;data.gpu=r.gpu;data.errors=r.errors;data.stageOnly=true;
 fs.writeFileSync(path.join(out,'stage-data.json'),JSON.stringify(data,null,2));
 console.log('CPU_PROFILE_COMPLETE');throw Error('CPU_PROFILE_COMPLETE');
 }});}catch(e){if(e.message!=='CPU_PROFILE_COMPLETE'){console.error(e);process.exitCode=1;}}})();
