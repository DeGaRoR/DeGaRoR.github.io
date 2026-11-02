// fly a fixture (the game's load door), print the design numbers and the circuit (TO env: a destination aerodrome)
const T='/home/user/DeGaRoR.github.io/flyDiy/tools';
const C=require(T+'/flight_core.js');const LB=require(T+'/_load_build.js');
const clone=o=>JSON.parse(JSON.stringify(o));
const s=LB.gameSpec(JSON.parse(require('fs').readFileSync(process.argv[2],'utf8')));
const def=C.buildGen(clone(s));const g=def.params.gen,A=def.params.ap;
const sh=C.genShakedown(def,{corners:true});const dc=sh.design;const m=C.machineSheet(def,{shakedown:sh});
const L=def.parts.ledger;let mass=0,cost=0;for(const k in L){mass+=L[k].mass;cost+=L[k].cost;}
const rows=dc.rows.filter(r=>r.level!=='pass'||/ctl\.(flare|droop)|pitch\.sm/.test(r.id)).map(r=>r.id+'='+r.value+(r.level==='pass'?'':'('+r.level+')')).join(' ');
console.log(s.engines[0].type,'prop',JSON.stringify({D:s.prop.D,b:s.prop.blades,m:s.prop.material}),'wR',s.gear.wheelR,'m',mass.toFixed(0),'$',cost.toFixed(0),'Vs',(g.VsMeas*3.6).toFixed(1),'Vs0',(g.VsFlap*3.6).toFixed(1),'AP',g.VsFlapAP?(g.VsFlapAP*3.6).toFixed(1):'-','flapless',!!g.landsFlapless,'Vref',(m.Vref*3.6).toFixed(1),'TO',A.TORun,'|',dc.verdict,rows);
const world=C.makeWorld();const d2=C.buildGen(clone(s));const sim=C.makeSim(d2,world);sim.reset(0);for(let i=0;i<300;i++)sim.step(1/60);
const ap=C.makePilot(sim,d2,world);
if(process.env.TO){const H=world.aerodromes.find(a=>a.id==='HOME'),D=world.aerodromes.find(a=>a.id===process.env.TO);ap.setRoute(H,D);}
let sRoll=null,lift=null,st=0;
for(;st<1500*60;st++){ap.update(1/60);sim.step(1/60);if(ap.phase==='ROLL'&&sRoll==null&&ap.dbg)sRoll=ap.dbg.s;if(ap.phase==='LIFTOFF'&&lift==null&&sRoll!=null&&ap.dbg)lift=Math.abs(ap.dbg.s-sRoll);if(sim.stats().bad)break;if(ap.phase==='STOPPED'&&ap.t>5)break;}
console.log('lap',(ap.report&&ap.report.outcome)||ap.phase,'lift',lift&&lift.toFixed(1),'ldg',JSON.stringify(ap.report&&ap.report.landing));
