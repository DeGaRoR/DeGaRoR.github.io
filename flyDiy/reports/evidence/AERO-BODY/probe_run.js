process.env.FLYDIY_JOIN_PROBE=__dirname+'/'+(process.env.PROBE||'probe_af.js'); process.env.FLYDIY_JOIN_NOCACHE='1';
const LB=require('/workspace/DeGaRoR.github.io/flyDiy/tools/_load_build.js'), fs=require('fs');
const [key,file]=process.argv.slice(2); const r=LB.loadBuild(file);
fs.writeFileSync(__dirname+'/'+(process.env.OUTP||'probe_')+key+'.json', typeof r.probe==='string'?r.probe:JSON.stringify(r.probe)); console.log('ok',key, String(r.probe).slice(0,100));
