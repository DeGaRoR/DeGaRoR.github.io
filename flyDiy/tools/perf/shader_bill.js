'use strict';
// Real-GPU program/source census, including blocking status queries and reuse.
// No skipped compiles, disabled watchdogs, or altered graphics settings.
// Default: the full hangar, even when a saved snapshot last selected studio.
// --studio explicitly selects the studio diagnostic; --hangar is an explicit alias for the default.
const fs=require('fs'),path=require('path'),zlib=require('zlib');
const PR=require('../page_rig.js');
const out=path.resolve(process.argv[2]||path.join(__dirname,'../../reports/evidence/PERFORMANCE-2026-11-19/shader-bill'));
fs.mkdirSync(out,{recursive:true});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const arg=(k,d)=>{const i=process.argv.indexOf(k);return i>=0?process.argv[i+1]:d;};
const bootSeconds=+arg('--boot-seconds',480),observeSeconds=+arg('--observe-seconds',0);
const init=`(()=>{
 const C=window.__SHC={programs:[],sources:{},stage:'boot',glErrors:[],samplerBindings:{},compileCalls:[],owners:[]},S=new WeakMap(),P=new WeakMap(),active=new WeakMap(),textureIds=new WeakMap();let nextTexture=0;
 // Diagnostic-only renderer interception: no new GL readiness queries. Capture
 // stand-in material ownership before temporary compile groups are discarded.
 const ownerSeen=new Set();let instrumentedRenderer;
 Object.defineProperty(window,'FLYDIY_RENDERER',{configurable:true,get:()=>instrumentedRenderer,set:R=>{
  instrumentedRenderer=R;if(!R||R.__shaderBillWrapped)return;R.__shaderBillWrapped=true;
  const compile=R.compile;
  R.compile=function(sc,cam,lit){const t=performance.now(),phase=window.BOOT&&BOOT.current&&BOOT.current.id;
   const result=compile.apply(this,arguments),compileMs=performance.now()-t;
   sc.traverse(o=>{for(const m of(Array.isArray(o.material)?o.material:[o.material])){if(!m)continue;
    const props=R.properties.get(m),ps=new Set(props.programs?[...props.programs.values()]:[]);if(props.currentProgram)ps.add(props.currentProgram);
    for(const pr of ps){const id=C.idFor(pr.program),key=id+':'+m.id;if(id===null||ownerSeen.has(key))continue;ownerSeen.add(key);
     C.owners.push({program:id,material:m.id,name:m.name,type:m.type,groundFamily:!!m.groundFamily,heavyLink:!!m.heavyLink,
      key:String(m.customProgramCacheKey?m.customProgramCacheKey():'').slice(0,1200),userDataKeys:Object.keys(m.userData||{}),
      object:o.name,objectType:o.type,attributes:Object.keys(o.geometry&&o.geometry.attributes||{}),phase,t:performance.now(),cacheKey:pr.cacheKey});}
   }});
   C.compileCalls.push({t,ms:compileMs,phase,programs:C.programs.length});return result;};
 }});
 C.idFor=pr=>{const r=P.get(pr);return r?r.id:null;};
 const hash=s=>{let h=2166136261;for(let i=0;i<s.length;i++)h=Math.imul(h^s.charCodeAt(i),16777619);return (h>>>0).toString(16)+':'+s.length;};
 const state=()=>({t:performance.now(),stage:C.stage,phase:window.BOOT&&BOOT.current&&BOOT.current.id,set:window.BOOT&&BOOT.set});
 for(const K of [WebGLRenderingContext,WebGL2RenderingContext]){
  const p=K.prototype,ss=p.shaderSource,attach=p.attachShader,link=p.linkProgram,param=p.getProgramParameter,info=p.getProgramInfoLog,del=p.deleteProgram;
  p.shaderSource=function(s,text){const key=hash(text);C.sources[key]=text;S.set(s,key);return ss.call(this,s,text);};
  p.attachShader=function(pr,sh){let r=P.get(pr);if(!r){r={id:C.programs.length,shaders:[],waits:[]};P.set(pr,r);C.programs.push(r);}r.shaders.push(S.get(sh));return attach.call(this,pr,sh);};
  p.linkProgram=function(pr){const r=P.get(pr);if(r){Object.assign(r,state());r.stack=(new Error().stack||'').split('\\n').slice(2,9).join('\\n');}return link.call(this,pr);};
  p.getProgramParameter=function(pr,k){const t=performance.now(),v=param.call(this,pr,k),r=P.get(pr);if(r){if(k===0x91B1){r.polls=(r.polls||0)+1;if(r.firstPoll===undefined)r.firstPoll=t;if(v&&r.ready===undefined)r.ready=performance.now();if(!v){r.lastPending=performance.now();r.pendingPhase=window.BOOT&&BOOT.current&&BOOT.current.id;}}if(k===0x8B82&&performance.now()-t>1)r.waits.push({...state(),kind:'LINK_STATUS',ms:performance.now()-t});}return v;};
  p.getProgramInfoLog=function(pr){const t=performance.now();try{return info.call(this,pr);}finally{const r=P.get(pr),ms=performance.now()-t;if(r&&ms>1)r.waits.push({...state(),kind:'info',ms});}};
  p.deleteProgram=function(pr){const r=P.get(pr);if(r)r.deleted=state();return del.call(this,pr);};
  if(${process.argv.includes('--trace-gl-errors')}){
   const use=p.useProgram;p.useProgram=function(pr){active.set(this,pr);return use.call(this,pr);};
   for(const key of ['drawElements','drawArrays','drawElementsInstanced','drawArraysInstanced']){const draw=p[key];if(!draw)continue;
    p[key]=function(...args){const tracing=C.glErrors.length<12,previous=[];
     if(tracing)for(let i=0;i<8;i++){const e=this.getError();if(!e)break;previous.push(e);}
     if(tracing)C.checkedDraws=(C.checkedDraws||0)+1;
     const v=draw.apply(this,args);
     if(tracing){const e=this.getError();if(e||previous.length){const pr=active.get(this),id=C.idFor(pr);C.glErrors.push({...state(),draw:key,program:id,error:e,previous});
      if(e&&pr&&id!==null&&!C.samplerBindings[id]){
       const gl=this,was=gl.getParameter(gl.ACTIVE_TEXTURE),rows=[];
       try{for(let i=0;i<gl.getProgramParameter(pr,gl.ACTIVE_UNIFORMS);i++){const u=gl.getActiveUniform(pr,i);if(!u||!/(?:sampler)/i.test(String(u.type))&&![35678,35680,35682,36289,36292,36293,36298,36303,36306,36308].includes(u.type))continue;
        const v=gl.getUniform(pr,gl.getUniformLocation(pr,u.name)),units=typeof v==='number'?[v]:Array.from(v||[]),bindings=[];
        for(const unit of units){gl.activeTexture(gl.TEXTURE0+unit);const targets=[];
         for(const [target,binding]of[[gl.TEXTURE_2D,gl.TEXTURE_BINDING_2D],[gl.TEXTURE_CUBE_MAP,gl.TEXTURE_BINDING_CUBE_MAP],[gl.TEXTURE_2D_ARRAY,gl.TEXTURE_BINDING_2D_ARRAY],[gl.TEXTURE_3D,gl.TEXTURE_BINDING_3D]]){if(!target||!binding)continue;const tex=gl.getParameter(binding);if(!tex)continue;if(!textureIds.has(tex))textureIds.set(tex,++nextTexture);targets.push({target,texture:textureIds.get(tex),compareMode:gl.getTexParameter(target,gl.TEXTURE_COMPARE_MODE)});}
         bindings.push({unit,targets});}
        rows.push({name:u.name,type:u.type,size:u.size,bindings});}
       }finally{gl.activeTexture(was);}C.samplerBindings[id]=rows;
      }
     }}return v;};
   }
  }
 }
})();`;
let rig;
async function dump(name){
 // Match raw WebGL programs to Three's cached material programs. Run after
 // readiness so this scene walk does not become part of the measured boot.
 await rig.ev(`(()=>{const C=__SHC,R=window.FLYDIY_RENDERER;if(!R||!R.properties)return;
  const live=new Map();for(const p of R.info.programs){const id=C.idFor(p.program);if(id!==null)live.set(id,{id,cacheKey:p.cacheKey,usedTimes:p.usedTimes,materials:[]});}
  const roots=new Map();if(window.WORLD&&WORLD.scene)roots.set(WORLD.scene,'world');
  if(window.GARAGE_ENV&&GARAGE_ENV._debug){const g=GARAGE_ENV._debug();if(g.scene)roots.set(g.scene,'garage');if(g.world)roots.set(g.world,'world');}
  const materials=new Map();for(const [root,scene]of roots)root.traverse(o=>{
   for(const m of(Array.isArray(o.material)?o.material:[o.material])){if(!m)continue;
    let row=materials.get(m);if(!row){row={id:m.id,name:m.name,type:m.type,key:m.customProgramCacheKey?m.customProgramCacheKey():null,objects:0,examples:[]};materials.set(m,row);}
    row.objects++;if(row.examples.length<4){const trail=[];for(let p=o;p&&trail.length<5;p=p.parent)trail.push(p.name||p.type);row.examples.push({scene,object:o.name,type:o.type,path:trail.reverse().join('/'),attributes:o.geometry?Object.keys(o.geometry.attributes):[]});}
   }
  });
  for(const [m,row]of materials){const props=R.properties.get(m);if(props.programs)for(const p of props.programs.values()){const id=C.idFor(p.program);if(live.has(id))live.get(id).materials.push(row);}}
  C.attribution={live:[...live.values()],sceneMaterials:materials.size,measuredAfterReadiness:true};
  const textures=new Set(),buffers=new Set(),geometries=new Set();
  const tex=v=>{if(v&&v.isTexture)textures.add(v);else if(Array.isArray(v))for(const t of v)if(t&&t.isTexture)textures.add(t);};
  for(const m of materials.keys()){for(const k of Object.keys(m))tex(m[k]);if(m.uniforms)for(const u of Object.values(m.uniforms))if(u)tex(u.value);}
  for(const root of roots.keys())root.traverse(o=>{const g=o.geometry;if(!g||geometries.has(g))return;geometries.add(g);
   for(const a of [...Object.values(g.attributes||{}),g.index,...Object.values(g.morphAttributes||{}).flat()]){
    const ar=a&&(a.array||a.data&&a.data.array);if(ar&&ar.buffer)buffers.add(ar.buffer);
   }});
  C.resources={scope:'Scene-referenced materials only, after readiness; not total GPU/process memory. Buffer bytes are CPU backing stores, including shared storage once.',
   geometries:geometries.size,geometryBackingBytes:[...buffers].reduce((n,b)=>n+b.byteLength,0),
   textures:[...textures].map(t=>{const im=t.image||{},imgs=Array.isArray(im)?im:[im];return {id:t.id,name:t.name,width:imgs[0]&&imgs[0].width,height:imgs[0]&&imgs[0].height,depth:imgs[0]&&imgs[0].depth,faces:imgs.length,format:t.format,type:t.type,compressed:!!t.isCompressedTexture,array:!!t.isDataArrayTexture,colorSpace:t.colorSpace,mipLevels:t.mipmaps?t.mipmaps.length:0};})};
 })()`);
 await rig.ev('window.__SHJSON=JSON.stringify(__SHC);__SHJSON.length');
 const n=await rig.ev('__SHJSON.length'),chunks=[];
 for(let i=0;i<n;i+=2000000)chunks.push(await rig.ev(`__SHJSON.slice(${i},${i+2000000})`));
 fs.writeFileSync(path.join(out,name+'.json.gz'),zlib.gzipSync(chunks.join('')));
 const meta=await rig.J(`({build:window.FLYDIY_BUILD,t:performance.now(),bootT0:BOOT.t0,settle:window.FLYDIY_WORLD_SETTLE,programs:__SHC.programs.length,boot:BOOT.log,holds:window.FLYDIY_HOLDS?FLYDIY_HOLDS():null,
  clock:window.FLYDIY_PACE&&FLYDIY_PACE.state(),simT:window.FLIGHT_PROBE?FLIGHT_PROBE.sim().t:null,worker:window.FLYDIY_SIMW?FLYDIY_SIMW.state():null,
  mode:window.FLYDIY_MODE,careerId:window.FLYDIY_CAREER_ID,studio:window.FLYDIY_STUDIO?FLYDIY_STUDIO.on():null,viewport:{w:innerWidth,h:innerHeight,dpr:devicePixelRatio},
  parked:window.PARKED?{staticTrio:PARKED.staticTrio,records:Object.values(PARKED.records).map(r=>({key:r.key,cooked:!!r.cooked,fleet:!!r.fleet})),pending:PARKED.pending.length,fleet:PARKED.fleet.stats}:null,
  town:(()=>{const w=window.FLIGHT_PROBE&&FLIGHT_PROBE.world(),r=w&&w.premises&&w.premises.overlay&&w.premises.overlay.records;
   const pr=window.WORLD&&WORLD.premises;
   return r?{allPlots:(r.plots||[]).length,townPlots:(r.plots||[]).filter(p=>/^mk_/.test(p.zone)).length,
    allItems:(r.items||[]).length,townItems:(r.items||[]).filter(p=>/^mk_/.test(p.id)).length,
    kit:pr&&pr.kitTownStats?pr.kitTownStats():null,city:pr&&pr.cityStats?pr.cityStats():null}:null;})(),
  workerPerf:window.FLYDIY_SIMW?FLYDIY_SIMW.perf():null,
  trips:window.FLYDIY_TRIPS?FLYDIY_TRIPS.map(t=>({kind:t.kind,ms:t.ms,done:t.done,steps:t.steps.map(s=>({id:s.id,ran:s.ran,why:s.why}))})):null})`);
 fs.writeFileSync(path.join(out,name+'.meta.json'),JSON.stringify(meta,null,2));
}
async function go(name){
 if(!process.argv.includes('--single-go')){await rig.fly();return;}
 await rig.ev("document.getElementById('bGo').click();true");
 const traces=[],end=Date.now()+120000;let prev=-1,lastLog=0;
 while(Date.now()<end){const s=await rig.J(`({t:performance.now(),simT:(${PR.SIMT}),body:document.body.className,
  holds:FLYDIY_HOLDS(),worker:window.FLYDIY_SIMW?FLYDIY_SIMW.state():null,perf:window.FLYDIY_SIMW?FLYDIY_SIMW.perf():null})`);
  traces.push(s);if(Date.now()-lastLog>15000){console.log(name,JSON.stringify({t:s.t,simT:s.simT,holds:s.holds,worker:s.worker?{phase:s.worker.phase,reason:s.worker.reason,dead:s.worker.dead,flight:s.worker.flight,lastError:s.worker.lastError}:null}));lastLog=Date.now();}
  if(s.simT>=0&&prev>=0&&s.simT>prev){fs.writeFileSync(path.join(out,name+'-trace.json'),JSON.stringify(traces,null,2));rig.flying=true;return;}
  prev=s.simT;await sleep(1000);
 }
 fs.writeFileSync(path.join(out,name+'-trace.json'),JSON.stringify(traces,null,2));throw Error(name+': simulation did not advance after a single Go click');
}
(async()=>{try{
 let card=fs.readFileSync(path.join(__dirname,'../../builds/cessna172r_2026-11-08.json'),'utf8'),seed={'flydiy.wip':card},size='5120x1271';
 const li=process.argv.indexOf('--playtest-log');
 if(li>=0){const log=JSON.parse(fs.readFileSync(process.argv[li+1],'utf8').replace(/^\uFEFF/,'')),h=log.header;
  if(!h.buildSpec||!h.gfx)throw Error('Playtest log lacks buildSpec or gfx');
  seed={'flydiy.wip':JSON.stringify({what:'flydiy-build',v:h.buildSpec.v||10,name:h.aircraft&&h.aircraft.name||'Playtest aircraft',spec:h.buildSpec}),'flydiy.gfx':JSON.stringify(h.gfx)};
  if(h.flight&&typeof h.flight.simw==='boolean')seed['flydiy.simw']=h.flight.simw?'1':'0';
  if(h.window&&h.window.w&&h.window.h)size=h.window.w+'x'+h.window.h;
  fs.writeFileSync(path.join(out,'reconstruction.json'),JSON.stringify({source:process.argv[li+1],build:h.build,aircraft:h.aircraft,gfx:h.gfx,size,simw:h.flight&&h.flight.simw,limitation:'Aircraft and settings at log export; not the full saved garage/profile or necessarily the initial aircraft/settings.'},null,2));
 }
 const pi=process.argv.indexOf('--profile-snapshot');
 if(pi>=0){const p=JSON.parse(fs.readFileSync(process.argv[pi+1],'utf8').replace(/^\uFEFF/,''));
  if(!p.storage||Object.keys(p.storage).some(k=>!k.startsWith('flydiy.')))throw Error('Expected game-only profile snapshot');
  seed=p.storage;
  fs.writeFileSync(path.join(out,'reconstruction.json'),JSON.stringify({kind:'game localStorage replay',sourceBuild:p.build,keys:Object.keys(seed).length,privateFixture:true,traceGLErrors:process.argv.includes('--trace-gl-errors'),limitation:'No IndexedDB, browser cache, extensions or original browser session copied. GL error tracing adds overhead; timing is diagnostic only.'},null,2));
 }
 const careerId=arg('--career-id',null);
 if(process.argv.includes('--hangar')&&process.argv.includes('--studio'))throw Error('Choose either --hangar or --studio');
 const studio=process.argv.includes('--studio');
 if(studio&&process.argv.includes('--no-seed'))throw Error('--studio needs its explicit test preference; omit --no-seed');
 seed={...seed,'flydiy.garageStudio':studio?'1':'0'};
 if(careerId){if(!seed['flydiy.career.'+careerId])throw Error('Career not in private fixture');const ix=JSON.parse(seed['flydiy.careers']);ix.last=careerId;seed={...seed,'flydiy.careers':JSON.stringify(ix)};}
 fs.writeFileSync(path.join(out,'test-configuration.json'),JSON.stringify({query:process.argv[3]||'',headed:process.argv.includes('--headed'),garage:studio?'studio':'hangar',studioPreferenceOverridden:true,size,careerId,drawErrorTracing:process.argv.includes('--trace-gl-errors'),bootSeconds,observeSeconds},null,2));
 rig=await PR.start({name:'shader-bill',size,live:process.argv.includes('--live'),allowBootFailure:true,repo:arg('--repo',undefined),fallback:arg('--fallback',undefined),headed:process.argv.includes('--headed'),cap:Math.max(720,bootSeconds+observeSeconds+180),boot:bootSeconds,q:process.argv[3]||'',init,seed:process.argv.includes('--no-seed')?null:seed,onNavigate:async r=>{
  let last='',lastAt=0;const end=Date.now()+bootSeconds*1000;
  while(Date.now()<end){const s=await r.J(`({t:performance.now(),phase:window.BOOT&&BOOT.current&&BOOT.current.id,state:window.BOOT&&BOOT.state,busy:window.BOOT&&BOOT.busy&&BOOT.busy(),n:window.__SHC?__SHC.programs.length:0})`);
   if(s.phase!==last||Date.now()-lastAt>30000){console.log(JSON.stringify(s));last=s.phase;lastAt=Date.now();}
   if(s.state==='gone'&&!s.busy)return;await sleep(1000);
  }throw Error('No completed loading chain in '+bootSeconds+' seconds');
 }});
 await dump('garage');
 const health=rig.bootHealth||await rig.J(PR.BOOT_HEALTH);fs.writeFileSync(path.join(out,'boot-health.json'),JSON.stringify(health,null,2));
 if(!health.ok)process.exitCode=1;
 if(process.argv.includes('--lighting-cycle')){
  if(!health.ok)throw Error('Normal loader readiness required');
  const clock=await rig.J('FLYDIY_PACE.state()');if(clock.legacy)throw Error('Lighting cycle requires native player clock');
  const trips=[];
  for(const preset of ['saved','noon','night']){
   if(preset!=='saved')await rig.J(`(()=>{DAY_CLOCK.preset('${preset}');DAY_CLOCK.set({rate:0});return true;})()`);
   const before=await rig.J('({t:performance.now(),n:__SHC.programs.length,keys:{...FLYDIY_TRIP_KEYS}})');
   await rig.ev(`__SHC.stage='lighting-${preset}';true`);rig.flying=false;await rig.fly();
   const after=await rig.J('({t:performance.now(),n:__SHC.programs.length,gl:FLYDIY_RENDERER.getContext().getError(),trips:FLYDIY_TRIPS.map(t=>({kind:t.kind,ms:t.ms,done:t.done,steps:t.steps.map(s=>({id:s.id,ran:s.ran,why:s.why,key:s.key}))}))})');
   trips.push({preset,before,after});fs.writeFileSync(path.join(out,'lighting-cycle.json'),JSON.stringify(trips,null,2));
   if(after.gl)throw Error('World draw error '+after.gl);
   await dump('lighting-'+preset);
   await rig.ev("FLYDIY_MENU.act('shed');true");let returned=false;
   for(let i=0;i<240;i++){if(await rig.J("document.body.classList.contains('mode-ws')&&BOOT.state==='gone'&&!BOOT.busy()")){returned=true;break;}await sleep(250);}
   if(!returned)throw Error('Garage return deadline');
  }
  fs.writeFileSync(path.join(out,'errors.json'),JSON.stringify(rig.errors,null,2));return;
 }
 if(observeSeconds){const tail=[],end=Date.now()+observeSeconds*1000;while(Date.now()<end){const t=Date.now();const s=await rig.J(`({t:performance.now(),state:BOOT.state,busy:BOOT.busy(),programs:__SHC.programs.length,mode:window.FLYDIY_MODE,careerId:window.FLYDIY_CAREER_ID,parked:window.PARKED?{queued:PARKED.queued(),fleet:PARKED.fleet.stats}:null})`);tail.push({...s,probeRoundtripMs:Date.now()-t});console.log('post-ready',JSON.stringify(tail.at(-1)));await sleep(5000);}fs.writeFileSync(path.join(out,'post-ready-trace.json'),JSON.stringify(tail,null,2));await dump('garage-after-observation');}
 if(process.argv.includes('--boot-only')){
  const hooks=await rig.J(`(()=>{const mats=new Set(),out=[];if(!window.WORLD||!WORLD.scene)return {error:'no world scene'};
   WORLD.scene.traverse(o=>{for(const m of(Array.isArray(o.material)?o.material:[o.material]))if(m&&m.customProgramCacheKey&&m.customProgramCacheKey().includes('island-disc-shared'))mats.add(m);});
   const h=s=>{let x=2166136261;for(let i=0;i<s.length;i++)x=Math.imul(x^s.charCodeAt(i),16777619);return (x>>>0).toString(16)+':'+s.length;};
   for(const m of mats){const sh={uniforms:THREE.UniformsUtils.clone(THREE.ShaderLib.standard.uniforms),vertexShader:THREE.ShaderLib.standard.vertexShader,fragmentShader:THREE.ShaderLib.standard.fragmentShader};m.onBeforeCompile(sh,FLYDIY_RENDERER);out.push({name:m.name,key:m.customProgramCacheKey(),side:sh.uniforms.uGroundDiscSide&&sh.uniforms.uGroundDiscSide.value,vertex:h(sh.vertexShader),fragment:h(sh.fragmentShader)});}return out;})()`);
  fs.writeFileSync(path.join(out,'disc-hooks.json'),JSON.stringify(hooks,null,2));fs.writeFileSync(path.join(out,'errors.json'),JSON.stringify(rig.errors,null,2));return;
 }
 await rig.ev("__SHC.stage='departure';FLIGHT_REC.mark('seg:departure')");await go('departure');await dump('world');
 await rig.ev("FLYDIY_MENU.act('shed')");
 for(let i=0;i<180;i++){if(await rig.ev("document.body.classList.contains('mode-ws')&&BOOT.state==='gone'&&!BOOT.busy()"))break;await sleep(500);}
 const edited=await rig.ev(`(()=>{__SHC.stage='edit';const e=document.getElementById('p_topRound');if(!e)return false;e.value=String(Math.min(+e.max,+e.value+(+e.step||.01)));e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));return e.id;})()`);
 console.log('Edited',edited);await sleep(1000);
 await rig.ev("__SHC.stage='edited-departure';FLIGHT_REC.mark('seg:edited-departure')");rig.flying=false;await go('edited-departure');await dump('edited-world');
 await rig.ev("window.__SHLOG=FLIGHT_REC.rec.logParts().join('');__SHLOG.length");const n=await rig.ev('__SHLOG.length'),fd=fs.openSync(path.join(out,'flightlog.json'),'w');
 try{for(let i=0;i<n;i+=2000000)fs.writeSync(fd,await rig.ev(`__SHLOG.slice(${i},${i+2000000})`));}finally{fs.closeSync(fd);}
 fs.writeFileSync(path.join(out,'errors.json'),JSON.stringify(rig.errors,null,2));
}catch(e){console.error(e);process.exitCode=1;if(rig)try{await dump('failure');}catch(_){};
}finally{if(rig)await rig.close();}})();
