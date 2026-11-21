'use strict';
// One feature group removed at a time; references bracket the screening runs.
// These are marginal costs at this fixture, not additive exclusive system bills.
const fs=require('fs'),path=require('path'),http=require('http'),cp=require('child_process');
const out=path.resolve(process.argv[2]),fixture=process.argv[3];
const selectedCase=process.argv.find(s=>s.startsWith('--case='))?.slice(7);
if(!fixture)throw Error('Output and private fixture required');
fs.mkdirSync(out,{recursive:true});
const common='mode=sandbox&parkstock=1&groundcache=0&perftrim=1&pace=8';
let cases=[
 ['reference-open','Reference, everything retained',''],
 ['animals-off','Animals','animals=0'],
 ['subalpine-off','Sub-alpine vegetation ecosystem','subalpine=0'],
 ['forestedge-off','Extra forest edge','forestedge=0'],
 ['dust-spray-off','Dust and aircraft spray','dust=0&waterfx=0'],
 ['reference-middle','Reference, everything retained',''],
 ['pocket-mist-off','Pocket mist','fmist=0'],
 ['damage-surface-off','Damage, scuff and crack appearance','dmglook=0&scuff=0&cracks=0'],
 ['traffic-off','Generated scenery cars and road traffic','cars=0'],
 ['reference-close','Reference, everything retained','']
].map(([id,label,change])=>({id,label,change,query:common+(change?'&'+change:'')}));
let manifest={started:new Date().toISOString(),common,cases,protocol:'Visible Chrome, private saved full-hangar/Cub fixture,5120x1271/DPR1. Advanced cliffs/runtime aircraft bakes excluded in all cases. Town, runway cues and all other feature groups retained. Fresh profile per case, normal loader readiness,20s garage soak,two unchanged-design round trips,5s stand-world soaks. First world soak CPU-profiled equally in all cases. Three controls bracket the seven single-group exclusions; no additive cost or exclusive compiler attribution. No native-F11 or driver-cache erasure claim.',priority:['Animals','Sub-alpine ecosystem','Extra forest edge','Dust/spray','Pocket mist','Damage/scuff/crack','Traffic']};
const manifestFile=path.join(out,'manifest.json');
if(fs.existsSync(manifestFile)){
 if(!process.argv.includes('--resume'))throw Error('Do not overwrite an existing study; explicit --resume records attempts');
 manifest=JSON.parse(fs.readFileSync(manifestFile,'utf8'));cases=manifest.cases;delete manifest.error;delete manifest.finished;
}
fs.writeFileSync(manifestFile,JSON.stringify(manifest,null,2));
const pause=ms=>new Promise(r=>setTimeout(r,ms));
function temperature(){return new Promise((resolve,reject)=>{const q=http.get('http://127.0.0.1:8085/data.json',r=>{let s='';r.on('data',v=>s+=v);r.on('end',()=>{try{const a=[];function walk(n){if(/^\/intelcpu\/.*\/temperature\//.test(n.SensorId||'')&&!/Distance|TjMax/i.test(n.Text||'')){const m=/^([\d.,]+)/.exec(n.Value||'');if(m)a.push(+m[1].replace(',','.'));}for(const c of n.Children||[])walk(c);}walk(JSON.parse(s));if(!a.length)throw Error('No absolute CPU temperature');resolve(Math.max(...a));}catch(e){reject(e);}});});q.on('error',reject);q.setTimeout(2500,()=>q.destroy(Error('Temperature timeout')));});}
const bash='C:/Program Files/Git/bin/bash.exe',lock='flyDiy/tools/perf/boxlock.sh';
function box(action,id){const r=cp.spawnSync(bash,[lock,action,'gpu','wingsmith-audit','Single-system screening: '+id],{stdio:'inherit',timeout:60000});if(r.status!==0)throw Error('GPU lock '+action+' failed: '+r.status);}
function run(args,log){return new Promise((resolve,reject)=>{const file=fs.createWriteStream(log),child=cp.spawn(process.execPath,args,{env:{...process.env,WINGSMITH_THERMAL_STOP_C:'85'},stdio:['ignore','pipe','pipe']});
 for(const stream of[child.stdout,child.stderr])stream.on('data',s=>{file.write(s);process.stdout.write(s);});
 child.on('error',reject);child.on('close',code=>{file.end();resolve(code);});});}
function refresh(){cp.execFileSync(process.execPath,[manifest.reportTool||'flyDiy/tools/perf/feature_isolation_report.js',out],{stdio:'inherit'});cp.execFileSync(process.execPath,['flyDiy/tools/perf/update_report.js'],{stdio:'inherit'});}
(async()=>{refresh();for(const c of cases){
 if(selectedCase&&c.id!==selectedCase)continue;
 if(c.exitCode===0&&c.finished){console.log('Already completed '+c.id);continue;}
 if(c.started){(c.attempts||(c.attempts=[])).push({folder:c.folder||c.id,started:c.started,finished:c.finished,exitCode:c.exitCode,reason:'Interrupted or failed attempt; raw logs retained and excluded'});c.folder=c.id+'-attempt-'+(c.attempts.length+1);delete c.started;delete c.finished;delete c.exitCode;}
 const folder=path.join(out,c.folder||c.id);fs.mkdirSync(folder,{recursive:true});
 if(c.validationScope==='startup-only'){console.log('Cooling interval '+(c.coolSeconds||30)+'s before startup-only case');await pause((c.coolSeconds||30)*1000);}
 const until=Date.now()+(manifest.coolingDeadlineMs||120000),startMax=manifest.startMaxC||50;let temp=await temperature();while(temp>startMax){if(Date.now()>until)throw Error('Cooling deadline, CPU '+temp);console.log('Cooling before '+c.id+': '+temp+' C');await pause(5000);temp=await temperature();}
 c.started=new Date().toISOString();c.startC=temp;fs.writeFileSync(manifestFile,JSON.stringify(manifest,null,2));console.log('FEATURE CASE START '+c.id+'; CPU '+temp+' C');
 box('take',c.id);let code;
 try{code=await run(['flyDiy/tools/perf/thermal_run.js',folder,'flyDiy/tools/perf/ground_cache_bench.js',folder,c.query,fixture,...(c.validationScope==='startup-only'?['--boot-only']:['--cpu-world']),...(c.pageDiagnostic?['--page-diagnostic='+c.pageDiagnostic]:[])],path.join(folder,'runner.log'));}finally{box('drop',c.id);}
 c.finished=new Date().toISOString();c.exitCode=code;fs.writeFileSync(manifestFile,JSON.stringify(manifest,null,2));refresh();
 if(code!==0){if(code===4){console.log('Safety stop excluded; cool before next independent case. '+c.id);continue;}throw Error(c.id+' failed; stop study, do not silently replace or accept the run');}
 const summary=JSON.parse(fs.readFileSync(path.join(folder,'summary.json')));if(!summary.final||!summary.bootHealth.ok||summary.errors.length)throw Error('Invalid result '+c.id);
 console.log('FEATURE CASE COMPLETE '+c.id+' '+(summary.garage.t/1000).toFixed(3)+' seconds');
 }
 manifest.finished=new Date().toISOString();fs.writeFileSync(manifestFile,JSON.stringify(manifest,null,2));refresh();
})().catch(e=>{manifest.error=String(e);fs.writeFileSync(manifestFile,JSON.stringify(manifest,null,2));try{refresh();}catch(_){}console.error(e);process.exitCode=1;});
