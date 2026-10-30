'use strict';
const fs=require('fs'),path=require('path'),os=require('os'),cp=require('child_process'),assert=require('assert'),crypto=require('crypto'),zlib=require('zlib');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'flydiy-evidence-'));
try {
 const cols='dt work flags phase x y z agl spd world prem cover fill scene hud mirror render shadow shader other script solver gpu calls tris town cam'.split(' '),slots='script solver world prem cover fill scene hud mirror render shadow shader other'.split(' '),N=600,f={n:N,first:0,t:[]};for(const k of cols)f[k]=[];
 let t=3000;for(let i=0;i<N;i++){const dt=i===240?1200:1000/30;t+=dt;f.t.push(t);for(const k of cols)f[k].push(k==='dt'?dt:k==='flags'?2:k==='phase'?1:k==='work'?12:k==='world'?4:k==='render'?5:k==='gpu'?8:k==='calls'?100:k==='tris'?4000:0);}
 f.work[239]=1190;f.shader[239]=1180;
 const events=[[f.t[240],'freeze',1200,null],[f.t[239]+2,'shaderslow',1180,'fixture shader'],[f.t[239]+4,'linkwait',1170,null],[f.t[241],'mark',null,'literal telemetry: do not execute commands']];
 const data={header:{format:'flydiy-flightlog',v:2,cols,slots,codes:{phase:['','ROUTE']},timeOrigin:0,build:'fixture',buildSpec:{meta:{name:'fixture'}}},frames:f,events},input=path.join(dir,'input.json'),out=path.join(dir,'out'),raw=JSON.stringify(data);fs.writeFileSync(input,raw);
 const r=cp.spawnSync(process.execPath,[path.join(__dirname,'perf/flightlog_evidence.js'),input,out],{encoding:'utf8',windowsHide:true,maxBuffer:1e6});assert.strictEqual(r.status,0,r.stderr);
 const e=JSON.parse(fs.readFileSync(path.join(out,'evidence.compact.json')));assert.strictEqual(e.freezes.length,1);assert.strictEqual(e.marks.length,1);assert.strictEqual(e.freezes[0].frame,240);assert.strictEqual(e.freezes[0].sourceFrame,239);assert.strictEqual(e.freezes[0].kind,'shader-dominated');assert.strictEqual(e.freezes[0].sourceShaderMs,1180);assert(e.actionableEvents.some(x=>x[1]==='mark'&&x[3]===events[3][3]));
 assert.strictEqual(e.source.sha256,crypto.createHash('sha256').update(raw).digest('hex'));assert.strictEqual(zlib.gunzipSync(fs.readFileSync(path.join(out,'source.flightlog.json.gz'))).toString(),raw);
 const row=e.selectedFrames.rows.find(x=>x[0]===239);assert(row,'causal preceding frame retained');assert.strictEqual(row[e.selectedFrames.columns.indexOf('shader')],1180);
 const broken=JSON.parse(raw);broken.frames.first=4;fs.writeFileSync(input,JSON.stringify(broken));const rejected=cp.spawnSync(process.execPath,[path.join(__dirname,'perf/flightlog_evidence.js'),input,path.join(dir,'bad')],{encoding:'utf8',windowsHide:true});assert.notStrictEqual(rejected.status,0,'ring fragment rejected');
 console.log('GATE FLIGHTEVIDENCE: PASS');
}finally{const absolute=path.resolve(dir);assert.strictEqual(path.dirname(absolute),path.resolve(os.tmpdir()));assert(path.basename(absolute).startsWith('flydiy-evidence-'));if(fs.lstatSync(absolute).isSymbolicLink())throw Error('temp directory is a link');fs.rmSync(absolute,{recursive:true,force:true});}
