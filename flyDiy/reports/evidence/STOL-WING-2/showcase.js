// variants of the showcase STOL Cub: node showcase.js '<json {name:{cage:{},eng:"preset",lap:1}}>'
const T='/home/user/DeGaRoR.github.io/flyDiy/tools';
const C=require(T+'/flight_core.js');const LB=require(T+'/_load_build.js');const FP=require(T+'/_stol_fp.js');
const BJ=require(T+'/_bake_joined.js');const {W}=BJ.loadPanel();
const clone=o=>JSON.parse(JSON.stringify(o));
const base=require(T+'/../builds/cub_2026-09-20_corrected.json');
const NAMES=Object.keys(W.ENG_PAGE.PRESETS).filter(n=>n!=='bare engine');
const vars=JSON.parse(process.argv[2]);
function envOf(v){const env=clone(base);const P=env.spec.cage;Object.assign(P,v.cage||{});
  if(v.eng){W.CAGE_ENG_APPLY_PRESET(P,v.eng);P.engPreset=NAMES.indexOf(v.eng);}
  return env;}
module.exports={envOf,NAMES};
function lap(def){const world=C.makeWorld();const sim=C.makeSim(def,world);sim.reset(0);for(let i=0;i<300;i++)sim.step(1/60);
 const ap=C.makePilot(sim,def,world);if(process.env.TO){const H=world.aerodromes.find(a=>a.id==='HOME'),D=world.aerodromes.find(a=>a.id===process.env.TO);ap.setRoute(H,D);}let sRoll=null,lift=null,liftV=null,s=0;
 for(;s<1500*60;s++){ap.update(1/60);sim.step(1/60);if(ap.phase==='ROLL'&&sRoll==null&&ap.dbg)sRoll=ap.dbg.s;
  if(ap.phase==='LIFTOFF'&&lift==null&&sRoll!=null&&ap.dbg){lift=Math.abs(ap.dbg.s-sRoll);liftV=+(sim.stats().ias||0).toFixed?.(1);}
  if(sim.stats().bad)break;if(ap.phase==='STOPPED'&&ap.t>5)break;}
 return {outcome:(ap.report&&ap.report.outcome)||ap.phase,lift,liftV,L:ap.report&&ap.report.landing};}
if(require.main===module) for(const [name,v] of Object.entries(vars)){
  const env=envOf(v);const s=LB.gameSpec(env);const def=C.buildGen(clone(s));const g=def.params.gen,A=def.params.ap;
  const sh=C.genShakedown(def,{corners:true});const dc=sh.design;const m=C.machineSheet(def,{shakedown:sh});
  const rows=dc.rows.filter(r=>r.level!=='pass'||/ctl\.(flare|droop)|pitch\.sm/.test(r.id)).map(r=>r.id+'='+r.value+(r.level==='pass'?'':'('+r.level+')')).join(' ');
  const L=def.parts.ledger;let mass=0,cost=0;for(const k in L){mass+=L[k].mass;cost+=L[k].cost;}
  let out=[name.padEnd(10),s.engines[0].type,'wR',s.gear.wheelR,'m',mass.toFixed(0),'$',cost.toFixed(0),'Vs',(g.VsMeas*3.6).toFixed(1),'Vs0',(g.VsFlap*3.6).toFixed(1),'AP',(g.VsFlapAP*3.6||0).toFixed(1),'flapless',!!g.landsFlapless,'Vref',(m.Vref*3.6).toFixed(1),'TO',A.TORun,'|',dc.verdict,rows];
  if(v.lap){const t0=Date.now();const Lp=lap(C.buildGen(clone(s)));out.push('| lap',Lp.outcome,'lift',Lp.lift&&Lp.lift.toFixed(1),'liftV',Lp.liftV,'ldg',JSON.stringify(Lp.L),((Date.now()-t0)/1000).toFixed(0)+'s');}
  console.log(out.join(' '));
}
