// node wirebudget.js <flyDiy root> : empty mass, all-up mass, CG % MAC and cert key of each calibrated build with its
// harness as today, as 1 % of empty, and as cable runs - measured through buildGen (the structure re-sizes with it)
const path=require('path');const R=path.resolve(process.argv[2]);const C=require(R+'/tools/flight_core.js');const LB=require(R+'/tools/_load_build.js');
const GA={st:{ul:0.13,yes:0.33,heavy:0.55},alt:A=>A>=60?0.13:A>=40?0.09:0.055};
const H=C.GEN_ELEC.harness, k0=H.kg;
const meas=s=>{const d=C.buildGen(s);const sh=C.genShakedown(d);const p=x=>((x-sh.xLEmac)/sh.cBar*100).toFixed(2);return {empty:sh.empty,all:sh.mass,cgE:p(sh.cgEmptyX),cg:p(sh.cgX),key:C.genCertKey(d)};};
const REF={cub:345,jodel:320,cessna172:[721,744]};
for(const [n,f] of [['cub','cub_2026-09-20_corrected'],['jodel','jodel_2026-09-20_corrected'],['cessna172','cessna172_2026-09-20_corrected']]){
  const s=LB.loadBuild('builds/'+f+'.json').spec;
  H.kg=k0; const t=meas(s); const Y=C.genSystemsResolve(s,{lights:['nav','beacon','land','taxi','flood','instr']});
  const h=(Y.rows.find(r=>r.key==='harness')||{kg:0}).kg, bus=(Y.parts.find(p=>p.key==='bus')||{kg:0}).kg;
  const d=C.buildGen(s); let x0=1e9,x1=-1e9; for(const q of d.nodes){x0=Math.min(x0,q.p[0]);x1=Math.max(x1,q.p[0]);} const L=x1-x0, b=C.genShakedown(d).span;
  let w=0; if(Y.starter)w+=2*1.0*(GA.st[Y.elec.starter]||0.33); if(Y.altA)w+=1.5*GA.alt(Y.altA);
  w+=Y.loads.length*2*2*0.006 + 2*(b/2)*2*0.012 + L*2*0.012 + 2*(0.3*b/2+1)*2*0.025;
  const runs=bus+1.6*w, pc=bus+0.01*(t.empty-h);
  const row=(lab,harn)=>{H.kg=k0+(harn-h); const m=meas(s); H.kg=k0; const ref=REF[n], r=Array.isArray(ref)?ref:[ref,ref];
    const off=m.empty<r[0]?(m.empty/r[0]-1)*100:m.empty>r[1]?(m.empty/r[1]-1)*100:0;
    console.log([n.padEnd(10),lab.padEnd(12),harn.toFixed(2).padStart(6),m.empty.toFixed(2).padStart(8),m.all.toFixed(2).padStart(8),(off>=0?'+':'')+off.toFixed(1)+' %',m.cgE,m.cg,m.key].join('  '));};
  row('today',h); row('cable runs',runs); row('1 % empty',pc);
}
H.kg=k0;
