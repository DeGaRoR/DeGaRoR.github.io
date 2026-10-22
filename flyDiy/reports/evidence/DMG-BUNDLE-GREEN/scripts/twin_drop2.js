process.env.FLYDIY_CERT='1';
const path=require('path');const ROOT=process.env.ROOT||process.cwd();const L=require(path.join(ROOT,'tools/_treecrash_lib.js'));
const k=process.argv[2]||'twinFloats';
for (const sink of (process.argv[3]||'2.13,2.5,3.05,3.66').split(',').map(Number)) {
  let pk={}; L.hardLanding(k,{sink,frames:150,probe:true,onFrame:(sim)=>{for(const c of sim.clusterCuts().cuts){ if(!/FLT/.test(c.tag)) continue; const key=c.tag+'/'+c.kind; pk[key]=Math.max(pk[key]||0,c.rb,c.rt);} }});
  const sim=L.lastRun.sim; const X=sim.clusterCuts().cuts.filter(c=>/FLT/.test(c.tag));
  console.log('sink',sink, X.map(c=>c.tag+' pk '+(c.pk||0).toFixed(2)+' (bend '+(c.pkB||0).toFixed(2)+' twist '+(c.pkT||0).toFixed(2)+') T lim '+(c.T/1000).toFixed(2)+' kNm').join(' | '));
}
