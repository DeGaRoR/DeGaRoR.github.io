'use strict';
// Reuse one bounded game load while diagnosing the opt-in terrain probe.
const fs=require('fs'),path=require('path'),PR=require('../page_rig.js');
const out=path.resolve(process.argv[2]),fixture=process.argv[3];
if(!fixture)throw Error('Output directory and private fixture required');
const seed={...JSON.parse(fs.readFileSync(fixture,'utf8').replace(/^\uFEFF/,'')).storage,'flydiy.garageStudio':'0'};
fs.mkdirSync(out,{recursive:true});let rig;
(async()=>{try{
 rig=await PR.start({name:'material-cache-session',headed:true,size:'5120x1271',q:'mode=sandbox&parkstock=1',seed,boot:600,cap:1200});
 console.log('SESSION READY');fs.writeFileSync(path.join(out,'ready.json'),JSON.stringify(await rig.why()));
 const end=Date.now()+800000;let last='';
 while(Date.now()<end){
  const file=path.join(out,'command.json');
  if(fs.existsSync(file)){
   const c=JSON.parse(fs.readFileSync(file,'utf8'));
   if(c.id!==last){last=c.id;if(c.stop)break;
    try{const v=await rig.J(c.expression);fs.writeFileSync(path.join(out,c.id+'.json'),JSON.stringify({ok:true,value:v}));console.log('DONE '+c.id);}
    catch(e){fs.writeFileSync(path.join(out,c.id+'.json'),JSON.stringify({ok:false,error:String(e),why:await rig.why()}));console.log('FAILED '+c.id+' '+e);}
   }
  }
  await new Promise(r=>setTimeout(r,500));
 }
}catch(e){console.error(e);process.exitCode=1;}
finally{if(rig)await rig.close();}})();
