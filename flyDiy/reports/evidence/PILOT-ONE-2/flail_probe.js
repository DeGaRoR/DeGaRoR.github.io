const C=require(process.env.CORE||(process.cwd()+'/flight_core.js'));
const mat=process.argv[2]||'aluTube';
const spec=JSON.parse(JSON.stringify(C.GEN_DEFAULT)); spec.fuselage.material=mat;
const def=C.buildGen(spec); if(process.env.AP) Object.assign(def.params.ap, JSON.parse(process.env.AP)); const sim=C.makeSim(def,null); sim.reset(0);
const ap=C.makePilot(sim,def); let t=0;
while(ap.phase!=='DOWNWIND'&&t<200){ap.update(1/60);sim.step(1/60);t+=1/60;}
let lvl=0; for(let f=0;f<60*40&&lvl<180;f++){ap.update(1/60);sim.step(1/60);t+=1/60; const ph=Math.abs(ap._m.bank||0); lvl = ph<0.035?lvl+1:0;}
for(let s=0;s<150;s++){ap.update(1/60);sim.step(1/60);t+=1/60;}
const de=[],th=[],tc=[];
for(let s=0;s<600;s++){ap.update(1/60);sim.step(1/60);t+=1/60; de.push(sim.ctl.de); th.push(ap._m.pitch*57.3); tc.push(ap.dbg && ap.dbg.tecs && ap.dbg.tecs.thC!=null? ap.dbg.tecs.thC*57.3 : NaN);}
const p2p=a=>Math.max(...a)-Math.min(...a); let rev=0; for(let i=2;i<de.length;i++){ if((de[i]-de[i-1])*(de[i-1]-de[i-2])<0) rev++; }
console.log(mat,"phase",ap.phase,"V",ap._m.ias.toFixed(1),"de p2p",p2p(de).toFixed(3),"pitch p2p",p2p(th).toFixed(2),"deg  de reversals/s",(rev/10).toFixed(1));
if(process.env.SHOW) for(let i=0;i<120;i+=3) console.log((i/60).toFixed(2), de[i].toFixed(3), th[i].toFixed(2));
if(process.env.DBGK) console.log(Object.keys(ap.dbg.tecs||{}).join(','));
