'use strict';
const fs=require('fs'),path=require('path');
const PR=require('../page_rig.js'),out=path.resolve(process.argv[2]||path.join(__dirname,'../../reports/evidence/PERFORMANCE-2026-11-19/ground-share-compare'));
fs.mkdirSync(out,{recursive:true});const sleep=ms=>new Promise(r=>setTimeout(r,ms));let rig;
const result={samples:[],errors:[]};const save=()=>fs.writeFileSync(path.join(out,'summary.json'),JSON.stringify(result,null,2));
async function ready(){const end=Date.now()+180000;while(Date.now()<end){if(await rig.ev("BOOT.state==='gone'&&!BOOT.busy()"))return;await sleep(500);}throw Error('Settings preparation timeout');}
(async()=>{try{
 const card=fs.readFileSync(path.join(__dirname,'../../builds/cessna172r_2026-11-08.json'),'utf8');
 rig=await PR.start({name:'ground-share-compare',size:'5120x1271',cap:600,boot:480,q:'groundshare=1',seed:{'flydiy.wip':card}});
 await ready();result.bootMs=await rig.ev('performance.now()');result.gpu=rig.gpu;save();await rig.fly();await rig.pause();
 for(const [label,shared] of [['shared-A',true],['legacy-B',false],['shared-A2',true]]){
  const t=Date.now();await rig.ev(`WORLD.ground.shareDisc(${shared});FLYDIY_SETTLE('ground')`);await ready();await rig.frames(60);
  const a=await rig.ev(`FLIGHT_REC.mark('seg:${label}');performance.now()`);await sleep(6000);
  const b=await rig.ev(`FLIGHT_REC.mark('seg:${label}-end');performance.now()`);
  const png=await rig.grab({craft:false,settle:2});fs.writeFileSync(path.join(out,label+'.png'),png);
  const row={label,shared,t0:a,t1:b,preparationMs:Date.now()-t-6000,programs:await rig.ev('FLYDIY_RENDERER.info.programs.length')};result.samples.push(row);console.log(JSON.stringify(row));save();
 }
 await rig.ev("window.__GLOG=FLIGHT_REC.rec.logParts().join('');__GLOG.length");const n=await rig.ev('__GLOG.length'),fd=fs.openSync(path.join(out,'flightlog.json'),'w');
 try{for(let i=0;i<n;i+=2000000)fs.writeSync(fd,await rig.ev(`__GLOG.slice(${i},${i+2000000})`));}finally{fs.closeSync(fd);}
 result.errors=rig.errors.slice();
}catch(e){result.errors.push(String(e.stack||e));console.error(e);process.exitCode=1;}finally{save();if(rig)await rig.close();}})();
