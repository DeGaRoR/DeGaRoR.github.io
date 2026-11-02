// STOL-PILOT legs (27 Oct): node reports/evidence/STOL-PILOT/legs.js <flight_core.js> <out.json>  [env ONLY=key,.. PROFS=expert,student JOBS=4]
// every (build x field x profile) flown by tools/pilot_trace.js on THAT core (the merged base's, this branch's): stock Cub,
// kit Cub, showcase STOL Cub x HOME, A4 (340 m), the Jolene mine strip (250 m), w8 (392 m, soft)
const path=require('path'),fs=require('fs'),{spawn}=require('child_process');
const T=path.join(__dirname,'..','..','..','tools');
const [core,out]=process.argv.slice(2);
const BUILDS={stock:'../builds/cub_2026-09-20_corrected.json',kit:'fixtures/stol_cub_kit.json',stol:'fixtures/stol_cub_showcase.json'};
const FIELDS={HOME:[],A4:['--from','A4'],mineL:['--world','jolene','--to','mn_strip'],mine:['--world','jolene','--from','mn_strip'],w8:['--world','jolene','--from','w8']};
if(process.env.FIELDS)for(const k of Object.keys(FIELDS))if(!process.env.FIELDS.split(',').includes(k))delete FIELDS[k];
const PROFS=(process.env.PROFS||'expert,student').split(',');
const only=process.env.ONLY?process.env.ONLY.split(','):null;
const cells=[];
for(const b in BUILDS)for(const f in FIELDS)for(const p of PROFS){const k=b+'/'+f+'/'+p;if(!only||only.some(o=>k.includes(o)))cells.push({k,b,f,p});}
const res={};let i=0,run=0;const J=+(process.env.JOBS||4);
function next(){if(i>=cells.length){if(!run){fs.writeFileSync(out,JSON.stringify(res,null,1));console.log('done',out);}return;}
 const c=cells[i++];run++;const args=[path.join(T,'pilot_trace.js'),path.join(T,BUILDS[c.b]),'--quiet','--core',core,'--max','900',...FIELDS[c.f]];if(c.p!=='expert')args.push('--profile',c.p);
 const ch=spawn('node',args,{cwd:path.join(T,'..')});let so='';ch.stdout.on('data',d=>so+=d);ch.stderr.on('data',d=>so+=d);
 ch.on('close',()=>{run--;try{const j=JSON.parse(so.trim().split('\n').pop());res[c.k]={outcome:j.outcome,t:j.t,ga:j.goArounds,bounces:j.bounces,to:j.takeoff,dep:j.dep&&j.dep.technique,depStol:!!(j.dep&&j.dep.stol),ldg:j.landing,appr:j.appr&&{tq:j.appr.technique,Vref:j.appr.Vref,aimIn:j.appr.aimIn,gs:j.appr.gs,stol:!!j.appr.stol},flare:j.flare,verdicts:j.verdicts};}catch(e){res[c.k]={err:so.slice(-600)};}
  const r=res[c.k];console.log(c.k,r.outcome||'ERR',r.ldg?('run '+r.ldg.run+' V '+r.ldg.V+' sink '+r.ldg.sink):'',r.to?('lift '+r.to.run):'');next();});}
for(let k=0;k<J;k++)next();
