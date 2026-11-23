'use strict';
// Run only an owned test process tree. Fail closed if LHM sensors disappear.
// User permits brief95 C peaks, no sustained90 C (21 Nov). Explicit90 C
// stop keeps margin for1Hz sampling. Older study policies85/87 remain valid.
const http=require('http'),fs=require('fs'),path=require('path'),{spawn,execFileSync}=require('child_process');
try { const os=require('os'); os.setPriority(0,os.constants.priority.PRIORITY_ABOVE_NORMAL); } catch(_) {}
const [logDir,script,...args]=process.argv.slice(2);
const policyPath=logDir&&path.join(path.dirname(path.resolve(logDir)),'thermal-policy.json');
const policy=policyPath&&fs.existsSync(policyPath)?JSON.parse(fs.readFileSync(policyPath,'utf8')):null;
const configured=policy?.stopC??Number(process.env.WINGSMITH_THERMAL_STOP_C);
const STOP_C=[85,87,90].includes(configured)?configured:85;
const heatState={},guard=require('./thermal_guard'),guardPolicy={...policy,stopC:STOP_C};
if(!logDir||!script)throw Error('Usage: thermal_run.js <log-dir> <node-test-script> [args]');
fs.mkdirSync(logDir,{recursive:true});const log=path.join(logDir,'thermal.jsonl');
const sensors=require('./lhm_cpu').createReader();
(async()=>{const first=await sensors();first.stopAtC=STOP_C;fs.appendFileSync(log,JSON.stringify(first)+'\n');if(first.cpuMaxC>=STOP_C)throw Error('CPU already at stop threshold: '+first.cpuMaxC);
 const child=spawn(process.execPath,[script,...args],{stdio:'inherit'});let stopped=false,checking=false,interval,peak=first.cpuMaxC,samples=1;
 const stop=reason=>{if(stopped||child.exitCode!==null)return;stopped=true;fs.appendFileSync(log,JSON.stringify({utc:new Date().toISOString(),abort:reason})+'\n');console.error('THERMAL STOP: '+reason);try{execFileSync('taskkill',['/PID',String(child.pid),'/T','/F'],{stdio:'ignore'});}catch(e){console.error('Owned test termination: '+e.message);}};
 interval=setInterval(async()=>{if(checking||stopped)return;checking=true;try{const row=await sensors();row.stopAtC=STOP_C;if(policy?.peakC)row.peakStopC=policy.peakC;peak=Math.max(peak,row.cpuMaxC);fs.appendFileSync(log,JSON.stringify(row)+'\n');if(samples++%15===0)console.log('CPU '+row.cpuMaxC+' C; peak '+peak+' C; guard '+STOP_C+' C');const reason=guard(row.cpuMaxC,Date.now(),heatState,guardPolicy);if(reason)stop(reason);}catch(e){stop('Sensor monitoring failed: '+e.message);}finally{checking=false;}},1000);
 child.on('error',e=>{clearInterval(interval);console.error(e);process.exitCode=1;});
 child.on('exit',(code,signal)=>{clearInterval(interval);fs.appendFileSync(log,JSON.stringify({utc:new Date().toISOString(),completed:!stopped,peakC:peak,samples,code,signal})+'\n');console.log('Thermal monitor: peak '+peak+' C in '+samples+' samples');process.exitCode=stopped?4:(code===null?1:code);});
})().catch(e=>{console.error('Thermal preflight refused: '+e.message);process.exitCode=4;});
