process.env.FLYDIY_JOIN_PROBE=require('path').join(__dirname,'jprobe.js');
const path=require('path'); const LB=require(path.join(process.cwd(),'tools','_load_build.js'));
for (const k of (process.argv[2]||'metal').split(',')) { const r=LB.loadValidated(k); console.log(k, JSON.stringify(r.probe)); console.log(' engines',JSON.stringify(r.spec.engines), 'gear.y',r.spec.gear.y,'twY',r.spec.gear.twY, 'propD', r.spec.prop&&r.spec.prop.D); }
