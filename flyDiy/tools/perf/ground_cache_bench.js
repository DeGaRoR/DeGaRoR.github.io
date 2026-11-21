'use strict';
const fs=require('fs'),path=require('path'),zlib=require('zlib'),PR=require('../page_rig.js');
const out=path.resolve(process.argv[2]),query=process.argv[3]||'mode=sandbox&parkstock=1&perftrim=1',fixture=process.argv[4];
if(!fixture)throw Error('Output, query and private fixture required');
const seed={...JSON.parse(fs.readFileSync(fixture,'utf8').replace(/^\uFEFF/,'')).storage,'flydiy.garageStudio':'0'};
fs.mkdirSync(out,{recursive:true});let rig;
const init=`(()=>{const C=window.__GROUND_BENCH={sources:{},programs:[],longTasks:[],frames:[],blockingQueries:[],nativeIds:new WeakMap()},S=new WeakMap();const hash=s=>{let h=2166136261;for(let i=0;i<s.length;i++)h=Math.imul(h^s.charCodeAt(i),16777619);return(h>>>0).toString(16)+':'+s.length;};
 const frame=t=>{C.frames.push(t);if(C.frames.length>30000)C.frames.shift();requestAnimationFrame(frame);};requestAnimationFrame(frame);
 for(const K of[WebGLRenderingContext,WebGL2RenderingContext]){const p=K.prototype,source=p.shaderSource,attach=p.attachShader,link=p.linkProgram,param=p.getProgramParameter,info=p.getProgramInfoLog;const programs=new WeakMap();
 p.shaderSource=function(shader,text){const h=hash(text);S.set(shader,h);C.sources[h]=text;return source.call(this,shader,text);};
 p.attachShader=function(program,shader){let row=programs.get(program);if(!row){row={id:C.programs.length,shaders:[]};programs.set(program,row);C.programs.push(row);}row.shaders.push(S.get(shader));return attach.call(this,program,shader);};
 p.linkProgram=function(program){const row=programs.get(program);if(row){C.nativeIds.set(program,row.id);row.t=performance.now();row.phase=window.BOOT&&BOOT.current&&BOOT.current.id;}return link.call(this,program);};
 p.getProgramParameter=function(program,key){const t=performance.now(),v=param.call(this,program,key),ms=performance.now()-t,row=programs.get(program);if(row){if(key===0x91B1&&v&&row.ready===undefined)row.ready=performance.now();if(ms>50)C.blockingQueries.push({program:row.id,kind:key,t,ms,phase:window.BOOT&&BOOT.current&&BOOT.current.id});}return v;};
 p.getProgramInfoLog=function(program){const t=performance.now(),v=info.call(this,program),ms=performance.now()-t,row=programs.get(program);if(row&&ms>50)C.blockingQueries.push({program:row.id,kind:'info',t,ms,phase:window.BOOT&&BOOT.current&&BOOT.current.id});return v;};}
 try{new PerformanceObserver(list=>{for(const e of list.getEntries())C.longTasks.push({t:e.startTime,ms:e.duration});}).observe({type:'longtask',buffered:true});}catch(_){};
 })()`+(process.argv.includes('--trace-gl')?`;
 (()=>{const C=__GROUND_BENCH;C.glTrace=[];C.glHistory=[];C.glSuspicious=[];let seq=0;const deleted=new WeakSet(),locations=new WeakMap(),uniforms=new WeakMap();
 const compact=args=>args.map(a=>a==null?a:typeof a==='number'||typeof a==='string'||typeof a==='boolean'?a:{type:a.constructor&&a.constructor.name,program:C.nativeIds.get(a),length:a.length,bytes:a.byteLength});
 for(const K of [WebGLRenderingContext,WebGL2RenderingContext]){const p=K.prototype,get=p.getError;
 for(const key of Object.getOwnPropertyNames(p)){
  if(key==='constructor'||key==='getError'||key==='isContextLost')continue;
  const descriptor=Object.getOwnPropertyDescriptor(p,key);if(!descriptor||typeof descriptor.value!=='function')continue;
  const own=descriptor.value;p[key]=function(...args){const value=own.apply(this,args),row={seq:seq++,method:key,args:compact(args)};C.glHistory[row.seq%128]=row;
   if(key==='deleteProgram'&&args[0])deleted.add(args[0]);
   if(key==='getProgramParameter'&&args[0]&&deleted.has(args[0])&&C.glSuspicious.length<24)C.glSuspicious.push({...row,reason:'Query after deleteProgram',stack:new Error().stack});
   if(key==='getActiveUniform'&&value){let u=uniforms.get(args[0]);if(!u){u={};uniforms.set(args[0],u);}u[value.name]=value;}
   if(key==='getUniformLocation'&&value){const u=uniforms.get(args[0]);locations.set(value,{name:args[1],program:C.nativeIds.get(args[0]),info:u&&u[args[1]]});}
   if(/^uniform[234]fv$/.test(key)&&args[0]){const l=locations.get(args[0]),n=Number(key[7]);if(l&&l.info&&args[1].length>l.info.size*n&&C.glSuspicious.length<24)C.glSuspicious.push({...row,reason:'Uniform array exceeds reflected size',uniform:l});}
   return value;};
 }
 p.getError=function(){const error=get.call(this);if(error&&C.glTrace.length<24)C.glTrace.push({t:performance.now(),phase:window.BOOT&&BOOT.current&&BOOT.current.id,error,stack:new Error().stack,history:C.glHistory.slice().sort((a,b)=>a.seq-b.seq),suspicious:C.glSuspicious.slice()});return error;};
 }})()`:'');
const snap=`(()=>{const R=FLYDIY_RENDERER;return {t:performance.now(),build:window.FLYDIY_BUILD,body:document.body.className,boot:{state:BOOT.state,busy:BOOT.busy(),log:BOOT.log},studio:window.FLYDIY_STUDIO&&FLYDIY_STUDIO.on(),viewport:{w:innerWidth,h:innerHeight,dpr:devicePixelRatio},sceneryAudit:{biomes:(()=>{const B=window.TREE_FILL&&TREE_FILL.biomes&&TREE_FILL.biomes();return B&&B.tuned?B.tuned():null;})(),mistStats:window.FMIST&&FMIST.stats?FMIST.stats():null,dustAllocated:!!(window.DUST_FX&&DUST_FX.fx),damageLook:window.FLYDIY_DMGLOOK,scuff:window.FLYDIY_SCUFF!==false,pavementNoise:window.PAVEMENT&&PAVEMENT.microNoiseStats?PAVEMENT.microNoiseStats():null,query:location.search,mist:window.FMIST?{on:FMIST.ON,a:FMIST.A,b:FMIST.B,c:FMIST.C}:null,town:window.FLYDIY_TOWN?{all:FLYDIY_TOWN.all,removed:FLYDIY_TOWN.n,keep:FLYDIY_TOWN.keep}:null,premises:window.WORLD&&WORLD.premises&&WORLD.premises.stats?{animals:WORLD.premises.stats.animals,traffic:WORLD.premises.stats.traffic,town:WORLD.premises.stats.town,runways:WORLD.premises.stats.runways}:null},bakeAudit:{trim:/[?&]perftrim=1(?:&|$)/.test(location.search),flownModule:!!window.FLOWN_BAKE,flownFlag:window.FLYDIY_FLOWN_BAKE,parked:window.PARKED?{staticTrio:PARKED.staticTrio,fleetOn:PARKED.fleetOn(),queued:PARKED.fleet.queue.length,busy:PARKED.fleet.busy,stats:PARKED.fleet.stats,records:Object.keys(PARKED.records)}:null,rockStats:window.ROCK_STATS||null,rockRing:!!window.ROCK_RING_LIVE,terrainMemo:window.FLIGHT_PROBE&&FLIGHT_PROBE.world&&FLIGHT_PROBE.world().terrainMemo?FLIGHT_PROBE.world().terrainMemo():null},cache:window.FLYDIY_GROUND_CACHE?FLYDIY_GROUND_CACHE.stats:null,programs:R.info.programs.length,glError:R.getContext().getError(),simT:window.FLIGHT_PROBE?FLIGHT_PROBE.sim().t:null};})()`;
const result={query,operations:[],errors:[]};
const save=()=>fs.writeFileSync(path.join(out,'summary.json'),JSON.stringify(result,null,2));
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function soak(seconds){const samples=[],end=Date.now()+seconds*1000;while(Date.now()<end){const t=Date.now(),s=await rig.J(`({t:performance.now(),frame:FLYDIY_RENDERER.info.render.frame,programs:FLYDIY_RENDERER.info.programs.length})`);samples.push({...s,probeMs:Date.now()-t});await sleep(1000);}return samples;}
async function retainSession(){
 save();console.log('Retaining run for bounded diagnostics');const end=Date.now()+420000;let last='';
 while(Date.now()<end){const file=path.join(out,'command.json');if(fs.existsSync(file)){const command=JSON.parse(fs.readFileSync(file,'utf8'));if(command.id!==last){last=command.id;if(command.stop)break;try{const value=await rig.J(command.expression);fs.writeFileSync(path.join(out,command.id+'.json'),JSON.stringify({ok:true,value}));console.log('Diagnostic done '+command.id);}catch(error){fs.writeFileSync(path.join(out,command.id+'.json'),JSON.stringify({ok:false,error:String(error)}));console.log('Diagnostic failed '+command.id);}}}await sleep(500);}
}
(async()=>{try{
 rig=await PR.start({name:'ground-cache-load',headed:true,allowBootFailure:true,size:'5120x1271',q:query,seed,init,boot:600,cap:1100,onNavigate:async r=>{let last='',at=0;const end=Date.now()+600000;while(Date.now()<end){const s=await r.J(`({t:performance.now(),phase:window.BOOT&&BOOT.current&&BOOT.current.id,state:window.BOOT&&BOOT.state,busy:window.BOOT&&BOOT.busy&&BOOT.busy(),trace:window.__GROUND_BENCH&&__GROUND_BENCH.glTrace})`);if(s.trace?.length){fs.writeFileSync(path.join(out,'gl-first-error.json'),JSON.stringify(s.trace,null,2));const data=await r.J('__GROUND_BENCH');fs.writeFileSync(path.join(out,'programs-trace.json.gz'),zlib.gzipSync(JSON.stringify(data)));throw Error('Diagnostic stopped at first GL error; no loading timing accepted');}if(s.phase!==last||Date.now()-at>30000){console.log(JSON.stringify(s));last=s.phase;at=Date.now();}if(s.state==='gone'&&!s.busy)return;await sleep(1000);}throw Error('Boot deadline');}});
 result.gpu=rig.gpu;result.bootHealth=rig.bootHealth;result.garage=await rig.J(snap);save();
 if(process.argv.includes('--trace-gl')){const trace=await rig.J('({errors:__GROUND_BENCH.glTrace,history:__GROUND_BENCH.glHistory,suspicious:__GROUND_BENCH.glSuspicious})');fs.writeFileSync(path.join(out,'gl-call-history.json'),JSON.stringify(trace,null,2));throw Error('Diagnostic-only GL trace; no loading timing accepted');}
 if(!result.bootHealth||!result.bootHealth.ok)throw Error('Invalid readiness: loader failure/timeout; diagnostics retained, timings excluded');
 if(result.garage.glError||rig.errors.some(e=>/Shader Error|not compiled|VALIDATE_STATUS/.test(e)))throw Error('Invalid rendered readiness: shader/draw errors; timings excluded');
 result.garageSoak=await soak(20);save();
 fs.writeFileSync(path.join(out,'garage.png'),await rig.grab({craft:false,settle:4}));
 if(!process.argv.includes('--boot-only'))for(let trip=1;trip<=2;trip++){
  const t=await rig.ev(`(()=>{const t=performance.now();document.getElementById('bGo').click();return t;})()`);let prev=-1,world;
  const end=Date.now()+180000;while(Date.now()<end){const s=await rig.J(`({t:performance.now(),simT:(${PR.SIMT}),world:document.body.classList.contains('mode-fly'),ready:BOOT.state==='gone'&&!BOOT.busy()})`);if(s.world&&s.ready&&s.simT>prev&&prev>=0){world=s;break;}prev=s.simT;await sleep(500);}
  if(!world)throw Error('Departure '+trip+' did not reach advancing simulation');
  result.operations.push({name:'departure-'+trip,ms:world.t-t,snapshot:await rig.J(snap)});save();
  const cpu=trip===1&&process.argv.includes('--cpu-world');
  if(cpu){await rig.cmd('Profiler.enable');await rig.cmd('Profiler.setSamplingInterval',{interval:1000});await rig.cmd('Profiler.start');}
  result.operations.at(-1).soak=await soak(5);
  if(cpu){const profile=await rig.cmd('Profiler.stop');if(profile.result&&profile.result.profile)fs.writeFileSync(path.join(out,'world.cpuprofile'),JSON.stringify(profile.result.profile));result.operations.at(-1).cpuProfiled=true;}
  if(trip===1)fs.writeFileSync(path.join(out,'world.png'),await rig.grab({craft:false,settle:4}));
  const start=await rig.ev(`(()=>{const t=performance.now();FLYDIY_MENU.act('shed');return t;})()`);let returned;
  const deadline=Date.now()+120000;while(Date.now()<deadline){const s=await rig.J(`({t:performance.now(),ok:document.body.classList.contains('mode-ws')&&BOOT.state==='gone'&&!BOOT.busy()})`);if(s.ok){returned=s;break;}await sleep(250);}
  if(!returned)throw Error('Return '+trip+' timed out');result.operations.push({name:'return-'+trip,ms:returned.t-start});save();
 }
 result.final=await rig.J(snap);
 const pageDiagnostic=process.argv.find(a=>a.startsWith('--page-diagnostic='));
 if(pageDiagnostic||process.argv.includes('--retain-after')||fs.existsSync(path.join(out,'retain-diagnostics.flag'))){
  const cold=await rig.J('__GROUND_BENCH');fs.writeFileSync(path.join(out,'programs-cold.json.gz'),zlib.gzipSync(JSON.stringify(cold)));
  if(pageDiagnostic){let recording=true;const progress=(async()=>{while(recording){await sleep(3000);if(!recording)break;try{const partial=await rig.J('window.__PERF_MIST_SCUFF_DIAGNOSTIC||null');if(partial)fs.writeFileSync(path.join(out,'page-diagnostic-progress.json'),JSON.stringify({diagnosticOnly:true,partial}));}catch(_){} }})();try{const value=await rig.J(fs.readFileSync(pageDiagnostic.slice('--page-diagnostic='.length),'utf8'));fs.writeFileSync(path.join(out,'page-diagnostic.json'),JSON.stringify({ok:true,value}));}catch(e){let partial=null;try{partial=await rig.J('window.__PERF_MIST_SCUFF_DIAGNOSTIC||null');}catch(_){}fs.writeFileSync(path.join(out,'page-diagnostic.json'),JSON.stringify({ok:false,error:String(e),partial}));}finally{recording=false;await progress;}}
  else await retainSession();
 }
}catch(e){result.errors.push(String(e));console.error(e);process.exitCode=1;if(rig)try{result.failure=await rig.J(snap);result.why=await rig.why();}catch(_){};
 if(rig&&process.argv.includes('--retain-on-failure'))await retainSession();
}finally{
 if(rig){result.pageErrors=rig.errors;try{const data=await rig.J('__GROUND_BENCH');fs.writeFileSync(path.join(out,'programs.json.gz'),zlib.gzipSync(JSON.stringify(data)));result.longTasks=data.longTasks;result.blockingQueries=data.blockingQueries;result.programSourceCount=Object.keys(data.sources).length;
  const frameStats=(start,end)=>{const times=data.frames.filter(t=>t>=start&&t<=end),gaps=times.slice(1).map((t,i)=>t-times[i]).sort((a,b)=>a-b);return {samples:gaps.length,p50:gaps[Math.floor(gaps.length*.5)],p99:gaps[Math.floor(gaps.length*.99)],max:gaps.at(-1),over100:gaps.filter(t=>t>100).length,over1000:gaps.filter(t=>t>1000).length,longTasks:data.longTasks.filter(t=>t.t>=start&&t.t<=end)};};
  if(result.garage&&result.garageSoak&&result.garageSoak.length)result.garageResponsiveness=frameStats(result.garage.t,result.garageSoak.at(-1).t);
  for(const op of result.operations)if(op.snapshot&&op.soak&&op.soak.length)op.responsiveness=frameStats(op.snapshot.t,op.soak.at(-1).t);
 }catch(e){result.errors.push(String(e));}await rig.close();}
 save();require('./update_report.js');console.log(JSON.stringify({garageMs:result.garage&&result.garage.t,operations:result.operations.map(o=>({name:o.name,ms:o.ms})),errors:result.errors}));
}})();
