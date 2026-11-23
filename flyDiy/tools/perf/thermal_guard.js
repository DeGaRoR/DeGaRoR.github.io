'use strict';
module.exports=function(temp,now,state,policy){
 const brief=policy.stopC===90&&policy.peakC===94&&policy.sustainedMs===3000;
 if(!brief)return temp>=policy.stopC?'CPU reached '+temp+' C':null;
 if(temp>=94)return 'CPU peak reached '+temp+' C (94 C guard below95 C allowance)';
 if(temp>=90){if(state.hotSince==null)state.hotSince=now;if(now-state.hotSince>=3000)return 'CPU sustained90 C or more for3 seconds';}
 else state.hotSince=null;
 return null;
};
