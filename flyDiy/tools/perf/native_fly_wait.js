'use strict';
module.exports=async function({state,click,sleep,now=Date.now,timeoutMs=180000,progress=()=>{}}){const end=now()+timeoutMs;let previous=-1,lastClick=-Infinity,lastSay=-Infinity,last;
 while(now()<end){last=await state();if(last.ready&&last.t>=0&&previous>=0&&last.t>previous)return{ok:true,last};previous=last.ready&&last.t>=0?last.t:-1;
  if(last.garage&&!last.busy&&!last.roll&&now()-lastClick>=2000){await click();lastClick=now();}
  if(now()-lastSay>=15000){progress(last);lastSay=now();}await sleep(250);
 }return{ok:false,last};};
