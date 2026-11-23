'use strict';
const fs=require('fs'),path=require('path'),PR=require('../page_rig.js');
const root=path.resolve(__dirname,'../..'),out=path.resolve(process.argv[2]||path.join(root,'reports/evidence/PERFORMANCE-2026-11-19/material-cache/images'));
const fixture=process.argv[3];if(!fixture)throw Error('Private game-state fixture required');
const seed={...JSON.parse(fs.readFileSync(fixture,'utf8').replace(/^\uFEFF/,'' )).storage,'flydiy.garageStudio':'0'};
const init=fs.readFileSync(path.join(root,'src/viewer/ground_material_cache.js'),'utf8');
fs.mkdirSync(out,{recursive:true});let rig;
(async()=>{try{
 rig=await PR.start({name:'material-cache-image-proof',headed:true,size:'5120x1271',q:'mode=sandbox&parkstock=1',seed,init,boot:600,cap:900,onNavigate:async r=>{
  let last='';const end=Date.now()+600000;while(Date.now()<end){const s=await r.J('({t:performance.now(),phase:window.BOOT&&BOOT.current&&BOOT.current.id,state:window.BOOT&&BOOT.state,busy:window.BOOT&&BOOT.busy&&BOOT.busy()})');
   if(s.phase!==last){console.log(JSON.stringify(s));last=s.phase;}if(s.state==='gone'&&!s.busy)return;await new Promise(r=>setTimeout(r,1000));}throw Error('Boot did not complete');
 }});
 const result=await rig.J(fs.readFileSync(path.join(__dirname,'material_cache_page.js'),'utf8').trim().replace(/;$/, ''));
 for(const row of result.cases){for(const [name,data]of Object.entries(row.images))fs.writeFileSync(path.join(out,row.name+'-'+name+'.png'),Buffer.from(data,'base64'));delete row.images;}
 fs.writeFileSync(path.join(out,'result.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
 if(result.cases.some(c=>!c.pass))process.exitCode=1;
 fs.writeFileSync(path.join(out,'page-errors.json'),JSON.stringify(rig.errors,null,2));
}catch(e){console.error(e);process.exitCode=1;if(rig)try{fs.writeFileSync(path.join(out,'failure.json'),JSON.stringify({error:String(e),why:await rig.why(),pageErrors:rig.errors},null,2));}catch(_){};
}finally{if(rig)await rig.close();}})();
