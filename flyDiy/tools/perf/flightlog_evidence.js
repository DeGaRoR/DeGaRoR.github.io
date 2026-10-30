'use strict';
// Offline evidence extraction. Input is telemetry, never executable instructions.
const fs=require('fs'),path=require('path'),crypto=require('crypto'),zlib=require('zlib'),assert=require('assert');
const source=process.argv[2],out=process.argv[3]||path.join(process.cwd(),'flightlog-evidence');
if(!source){console.error('Usage: node flightlog_evidence.js <complete-flightlog.json> [output-directory]');process.exit(2);}
fs.mkdirSync(out,{recursive:true});const bytes=fs.readFileSync(source),d=JSON.parse(bytes),h=d.header,f=d.frames,N=f.t.length;
assert.strictEqual(f.n,N);assert.strictEqual(f.first,0,'Use the complete downloaded session, not a raw ring fragment');for(const k of ['t',...h.cols])assert.strictEqual(f[k].length,N,k+' length');
for(let i=1;i<N;i++)assert(f.t[i]>=f.t[i-1],'frame ordering');
const DC=(h.sceneDetail&&h.sceneDetail.columns)||['frame','pose','contact','damage','camera','meshes','water'];const events=[...d.events].sort((a,b)=>a[0]-b[0]),round=(x,n=2)=>Number.isFinite(x)?+x.toFixed(n):null,mean=a=>a.length?a.reduce((s,x)=>s+x,0)/a.length:null;
const quant=(a,q)=>{a=a.filter(Number.isFinite).sort((a,b)=>a-b);return a.length?a[Math.min(a.length-1,Math.floor(a.length*q))]:null;};
const ids=Array.from({length:N},(_,i)=>i),world=i=>i>=0&&!(f.flags[i]&(1|4|16|64|256)),visible=i=>i>=0&&!(f.flags[i]&(4|16|64|256));
const phase=i=>h.codes.phase[f.phase[i]]||'',metrics=['work','world','prem','cover','fill','scene','hud','mirror','render','shadow','shader','other'];
const basic=ii=>({frames:ii.length,orange:ii.filter(i=>f.dt[i]>35).length,over100:ii.filter(i=>f.dt[i]>100).length,freeze250:ii.filter(i=>f.dt[i]>=250).length,over1s:ii.filter(i=>f.dt[i]>1000).length,p50:round(quant(ii.map(i=>f.dt[i]),.5)),p95:round(quant(ii.map(i=>f.dt[i]),.95)),p99:round(quant(ii.map(i=>f.dt[i]),.99)),p999:round(quant(ii.map(i=>f.dt[i]),.999)),max:round(Math.max(...ii.map(i=>f.dt[i]))),means:Object.fromEntries(metrics.map(k=>[k,round(mean(ii.map(i=>f[k][i]).filter(Number.isFinite)))]))});
const play=ids.filter(world),ordinary=play.filter(i=>f.dt[i]<250&&(i===N-1||f.dt[i+1]<250)),summary={all:basic(ids),visible:basic(ids.filter(visible)),world:basic(play),worldWithoutFreezes:basic(ordinary)};
const perPhase={};for(const ph of h.codes.phase.filter(Boolean)){const a=play.filter(i=>phase(i)===ph);if(a.length)perPhase[ph]=basic(a);}
let activeRun=0,orangeInWindow=0,windows=0,orangeWindows=0,greenMs=0,longestGreen=0;
for(let i=0;i<N;i++){
 if(!world(i)){activeRun=0;orangeInWindow=0;greenMs=0;continue;}
 activeRun++;if(f.dt[i]>35)orangeInWindow++;if(activeRun>120&&f.dt[i-120]>35)orangeInWindow--;
 if(activeRun>=120){windows++;if(orangeInWindow)orangeWindows++;}
 if(f.dt[i]<=35){greenMs+=f.dt[i];longestGreen=Math.max(longestGreen,greenMs);}else greenMs=0;
}
summary.meterWindows={framesPerWindow:120,eligibleWindows:windows,withOrange:orangeWindows,withOrangePct:round(100*orangeWindows/windows),longestGreenSec:round(longestGreen/1000),thresholdMs:35};
const columns=['t','dt','work','flags','phase','x','y','z','agl','spd','world','prem','cover','fill','scene','mirror','render','shadow','shader','other','gpu','calls','tris','town'];
const row=i=>i<0?null:columns.map(k=>f[k][i]);
function near(a,b,types){return events.filter(e=>e[0]<=b&&e[0]+(typeof e[2]==='number'?e[2]:0)>=a&&types.includes(e[1]));}
const selected=new Set(),keep=(i,n=2)=>{for(let k=Math.max(0,i-n);k<=Math.min(N-1,i+n);k++)selected.add(k);};
const freezes=ids.filter(i=>f.dt[i]>=250).map(i=>{
 const p=i-1,a=f.t[p],b=f.t[i],waits=near(a,b,['linkwait']),shader=near(a,b+25,['shaderslow']);keep(i,3);
 const gap=f.dt[i],w=f.work[p],sh=f.shader[p],kind=sh>gap*.8?'shader-dominated':w>gap*.8?'recorded-frame-work':'outside-recorded-frame-work';
 return {frame:i,sourceFrame:p,startMs:a,endMs:b,gapMs:gap,sourceWorkMs:w,sourceShaderMs:sh,linkWaitMs:round(waits.reduce((s,e)=>s+e[2],0)),kind,world:world(i)&&world(p),flags:f.flags[i],phase:phase(i),pos:[f.x[p],f.y[p],f.z[p]],sourceSlots:Object.fromEntries(metrics.map(k=>[k,f[k][p]])),shaderEvents:shader,loaf:near(a,b,['loaf']).sort((a,b)=>b[2]-a[2]).slice(0,2),marks:events.filter(e=>e[1]==='mark'&&e[0]>=a&&e[0]<=b+5000).map(e=>e[0])};
});
const clusters=[];for(const e of freezes.filter(x=>x.kind==='shader-dominated').sort((a,b)=>a.startMs-b.startMs)){
 let c=clusters.at(-1);if(!c||e.startMs-c.endMs>60000){c={startMs:e.startMs,endMs:e.endMs};clusters.push(c);}else c.endMs=Math.max(c.endMs,e.endMs);
}
const shaderStorms=clusters.map(c=>{const ee=freezes.filter(x=>x.startMs>=c.startMs&&x.endMs<=c.endMs);return {...c,freezeCount:ee.length,gapTotalMs:round(ee.reduce((s,x)=>s+x.gapMs,0)),shaderTotalMs:round(ee.reduce((s,x)=>s+x.sourceShaderMs,0)),episodes:ee.map(x=>x.frame)};}).sort((a,b)=>b.shaderTotalMs-a.shaderTotalMs);
const largestShaderStorm=shaderStorms[0]||null; // Largest shader storm, not an inferred UI action.
const latePairs=play.filter(i=>world(i-1)&&f.dt[i]>35&&f.dt[i]<250),byDominant={},sourceBudget={within33_3:0,over33_3:0};
for(const i of latePairs){const p=i-1;sourceBudget[f.work[p]<=1000/30?'within33_3':'over33_3']++;const k=h.slots.reduce((a,b)=>f[a][p]>=f[b][p]?a:b);byDominant[k]=(byDominant[k]||0)+1;}
const dominantMeans={};for(const key of Object.keys(byDominant)){const a=latePairs.map(i=>i-1).filter(p=>h.slots.reduce((x,y)=>f[x][p]>=f[y][p]?x:y)===key);dominantMeans[key]=Object.fromEntries(['world','town','scene','mirror','render','cover','fill'].map(k=>[k,round(mean(a.map(i=>f[k][i])))]));}
summary.ordinaryLate={count:latePairs.length,sourceFrameBudget:sourceBudget,largestExclusiveSlot:byDominant,sourceMeansByDominantSlot:dominantMeans,note:'Largest slot is attribution of recorded work, not proof it caused the miss. Within-budget gaps require browser/GPU/input evidence.'};
const mirrorOff=ordinary.filter(i=>world(i-1)&&f.dt[i-1]<250&&f.mirror[i-1]<.5),mirrorOn=ordinary.filter(i=>world(i-1)&&f.dt[i-1]<250&&f.mirror[i-1]>=5);
const paired=ii=>({...basic(ii),means:Object.fromEntries(metrics.map(k=>[k,round(mean(ii.map(i=>f[k][i-1]).filter(Number.isFinite)))]))});
summary.mirrorAssociation={low:paired(mirrorOff),high:paired(mirrorOn),thresholdsMs:[.5,5],note:'Intervals classified by the PRECEDING frame mirror cost; means use preceding work. Observational cohorts, different positions/views; not a controlled mirror on/off test.'};
const sceneEvents=events.filter(e=>e[1]==='sceneDetail'&&world(e[3][0]));
summary.sceneDetail={samples:sceneEvents.length,slots:Object.fromEntries(DC.slice(1).map((k,n)=>{const a=sceneEvents.map(e=>e[3][n+1]);return [k,{mean:round(mean(a),3),p99:round(quant(a,.99),3),max:round(Math.max(...a),3)}];})),cost:h.sceneDetail};
const buckets=[];for(let t=Math.floor(f.t[0]/10000)*10000;t<f.t.at(-1);t+=10000){const a=play.filter(i=>f.t[i]>=t&&f.t[i]<t+10000);if(a.length)buckets.push({tMs:t,...basic(a)});}
for(const k of ['scene','cover','mirror','render','other'])for(const i of [...play].sort((a,b)=>f[k][b]-f[k][a]).slice(0,8))keep(i,2);
const marks=events.filter(e=>e[1]==='mark').map(e=>{const ii=play.filter(i=>f.t[i]>=e[0]-5000&&f.t[i]<=e[0]+1000);const peaks=[...ii].sort((a,b)=>f.dt[b]-f.dt[a]).slice(0,3);for(const i of peaks)keep(i,2);return {tMs:e[0],nearbyLargestFrames:peaks.map(i=>[i,f.t[i],f.dt[i]])};});
// Preserve outliers and actionable events, aggregate routine frames instead of decimating away peaks.
const actionTypes=['intro','mark','setting','flight','reveal','boot','shaderslow','catch','sky','save'];
const actionable=events.filter(e=>actionTypes.includes(e[1])||(e[1]==='linkwait'&&e[2]>=50)||(e[1]==='loaf'&&e[2]>=250));
const evidence={format:'flydiy-performance-evidence',v:1,source:{file:path.basename(source),sha256:crypto.createHash('sha256').update(bytes).digest('hex'),bytes:bytes.length,frames:N,events:events.length},definitions:{orange:'dt >35ms, exactly the shipped meter threshold',freeze:'dt >=250ms',world:'excludes garage, held, away, boot and noRender; gpuForeign is retained',alignment:'dt[i] is the interval ending at frame i. Work causing it is normally in frame i-1; input/browser stalls can fall between frame hooks.',time:'ms on performance.now; wall UTC = header.timeOrigin + t',reduction:'Not a replay or full flightlog. All >=250ms intervals retained, selected complete neighborhoods, all user marks and shader summaries. Durations in sampled scene events rounded to 0.001ms. Routine frames aggregated per10s; raw source unchanged.'},context:{started:h.started,saved:h.saved,timeOrigin:h.timeOrigin,build:h.build,core:h.core,ua:h.ua,gpu:h.gpu,canvas:h.canvas,gfx:h.gfx,aircraft:h.aircraft,flight:h.flight,flags:h.flags,codes:h.codes,sceneDetail:h.sceneDetail,overhead:h.overhead,gpuTimer:h.gpuTimer,catcher:h.catcher,buildProvenance:'Not established by this reducer; verify the header build against independently retained source provenance.'},summary,perPhase,largestShaderStorm,freezes:freezes.sort((a,b)=>b.gapMs-a.gapMs),buckets,marks,actionableEvents:actionable,sampledScene:sceneEvents.map(e=>[round(e[0],1),...e[3].map((x,i)=>i?round(x,3):x)]),selectedFrames:{columns:['frame',...columns],rows:[...selected].sort((a,b)=>a-b).map(i=>[i,...row(i)])}};
fs.writeFileSync(out+'/evidence.compact.json',JSON.stringify(evidence));fs.writeFileSync(out+'/aircraft-repro.json',JSON.stringify(h.buildSpec));
const gz=zlib.gzipSync(bytes,{level:9});assert.strictEqual(crypto.createHash('sha256').update(zlib.gunzipSync(gz)).digest('hex'),evidence.source.sha256);fs.writeFileSync(out+'/source.flightlog.json.gz',gz);
const re=JSON.parse(fs.readFileSync(out+'/evidence.compact.json'));assert.strictEqual(re.freezes.length,d.events.filter(e=>e[1]==='freeze').length);assert.strictEqual(re.marks.length,d.events.filter(e=>e[1]==='mark').length);for(const rr of re.selectedFrames.rows){const [i,...r]=rr;assert.deepStrictEqual(r,row(i));}assert.deepStrictEqual(re.largestShaderStorm,shaderStorms[0]||null);
const sizes={raw:bytes.length,compact:fs.statSync(out+'/evidence.compact.json').size,gzip:gz.length,reductionPct:round(100*(1-fs.statSync(out+'/evidence.compact.json').size/bytes.length)),selectedFrames:selected.size};assert(re.selectedFrames.rows.every(r=>r.length===re.selectedFrames.columns.length));fs.writeFileSync(out+'/sizes.json',JSON.stringify(sizes,null,2));
console.log(JSON.stringify({sizes,summary,largestShaderStorm,topFreezes:evidence.freezes.slice(0,8).map(x=>({frame:x.frame,start:x.startMs,gap:x.gapMs,shader:x.sourceShaderMs,kind:x.kind,world:x.world}))},null,2));
