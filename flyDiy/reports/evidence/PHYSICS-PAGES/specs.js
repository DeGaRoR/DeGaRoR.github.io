// load the three official planes through the game's load door, cache the specs
const path=require('path'), fs=require('fs');
const FLY='/workspace/DeGaRoR.github.io/flyDiy';
const LB=require(FLY+'/tools/_load_build.js');
const OUT=__dirname+'/specs.json';
const P={cub:'builds/cub_2026-09-20_corrected.json', c172:'builds/cessna172_2026-09-20.json', twin:'builds/candidates/Twin_busher_floats_4b.json'};
const o={};
for(const k in P){ const r=LB.loadBuild(P[k]); o[k]={name:r.name, file:P[k], errors:r.errors, spec:r.spec}; console.log(k, r.name, r.errors); }
fs.writeFileSync(OUT, JSON.stringify(o));
