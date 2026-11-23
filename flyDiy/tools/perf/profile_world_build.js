'use strict';
// Time the actual world's generator stages; stop before the remaining boot.
const fs=require('fs'),path=require('path');
const PR=require('../page_rig.js');
const out=path.resolve(process.argv[2]);fs.mkdirSync(out,{recursive:true});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const init=`(()=>{const timer=setInterval(()=>{if(typeof window.buildWorldSceneSteps!=='function')return;
 clearInterval(timer);const original=window.buildWorldSceneSteps;
 window.buildWorldSceneSteps=function(...args){const g=original.apply(this,args),p=window.__WORLD_BUILD_PROFILE={steps:[],done:false};
 return {next(...a){const t=performance.now(),r=g.next(...a);p.steps.push({label:r.done?'done':String(r.value),ms:performance.now()-t});p.done=r.done;return r;},[Symbol.iterator](){return this;}};};
},10);setTimeout(()=>clearInterval(timer),30000);})()`;

(async()=>{try{
 await PR.start({name:'world-stage-probe',size:'5120x1271',cap:100,boot:80,init,
  onNavigate:async rig=>{
   const end=Date.now()+80000;
   while(Date.now()<end){await sleep(500);const p=await rig.J('window.__WORLD_BUILD_PROFILE||null');
    if(!p||!p.done)continue;
    p.gpu=rig.gpu;p.url=rig.url;p.build=await rig.ev('window.FLYDIY_BUILD');
    fs.writeFileSync(path.join(out,'world-slices.json'),JSON.stringify(p,null,2));
    const groups={};for(const s of p.steps)groups[s.label]=(groups[s.label]||0)+s.ms;
    console.log(JSON.stringify(Object.entries(groups).sort((a,b)=>b[1]-a[1]).slice(0,20)));
    throw Error('WORLD_PROFILE_COMPLETE');
   }
   throw Error('World generator timer did not complete within 80 seconds');
  }});
 throw Error('Probe unexpectedly completed a full boot');
}catch(e){if(e.message!=='WORLD_PROFILE_COMPLETE'){console.error(e);process.exitCode=1;}}})();
