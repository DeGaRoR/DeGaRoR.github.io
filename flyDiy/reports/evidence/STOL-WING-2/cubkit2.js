const T=require('path').join(__dirname,'..','..','..','tools');   // run from anywhere: node reports/evidence/STOL-WING-2/cubkit2.js '{"kit":{"cage":{"wgSlat":1}}}'
const C=require(T+'/flight_core.js');const LB=require(T+'/_load_build.js');const FP=require(T+'/_stol_fp.js');
const clone=o=>JSON.parse(JSON.stringify(o));
const base=require(T+'/../builds/cub_2026-09-20_corrected.json');
const kits=JSON.parse(process.argv[2]);
for(const [name,kit] of Object.entries(kits)){
  const env=clone(base); if(kit&&kit.cage) Object.assign(env.spec.cage,kit.cage); if(kit&&kit.mod) eval(kit.mod);
  const s=LB.gameSpec(env); const def=C.buildGen(clone(s)); const g=def.params.gen,A=def.params.ap;
  const sh=C.genShakedown(def,{corners:true}); const dc=sh.design; const m=C.machineSheet(def,{shakedown:sh});
  const rows=dc.rows.filter(r=>/ctl\.(flare|droop|elevator)/.test(r.id)).map(r=>r.id+'='+r.value+(r.level==='pass'?'':'('+r.level+')')).join(' ');
  const L=FP.fpLap(C,C.buildGen(clone(s)));
  console.log(name.padEnd(12),'stol',JSON.stringify(s.wings[0].stol),s.wings[0].tip,'Vs',(g.VsMeas*3.6).toFixed(1),'Vs0',(g.VsFlap*3.6).toFixed(1),'flapless',!!g.landsFlapless,'Vref',(m.Vref*3.6).toFixed(1),'TO',A.TORun,rows,'| lap',L.outcome,'lift',L.liftRun&&L.liftRun.toFixed(1),'ldg',L.ldgRun);
}
