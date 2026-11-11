// every pod-and-boom design through the game's load door, then the core with and without the tail-arm floor
const FLY='/workspace/DeGaRoR.github.io/flyDiy', LB=require(FLY+'/tools/_load_build.js'), fs=require('fs');
const FILES=['builds/candidates/Twin_busher_floats_4b.json','builds/candidates/birdman.json','builds/candidates/flydiy-build (4).json',
 'builds/candidates/build_v7_twin_2026-09-04.json','builds/candidates/build_v7_ultralight_2026-09-05_floats.json','builds/candidates/build_v8_pusher_2026-09-11.json',
 'builds/candidates/superpetrel_V4_1.json','builds/chinook_2026-09-21_corrected.json','builds/rufus_2026-10-18_certified.json',
 'tools/fixtures/build_v8_twin-boom_2026-09-11.json','tools/fixtures/build_v10_engcfg_pushpull_2026-10-22.json'];
const out={};
for(const f of FILES){ try{ const r=LB.loadBuild(f); out[f]={name:r.name, errors:r.errors, spec:r.spec}; console.log('ok',f,r.name,(r.errors||[]).length);}catch(e){ out[f]={error:String(e.message).slice(0,200)}; console.log('ERR',f,e.message.slice(0,120)); } }
fs.writeFileSync(__dirname+'/pods_specs.json', JSON.stringify(out));
