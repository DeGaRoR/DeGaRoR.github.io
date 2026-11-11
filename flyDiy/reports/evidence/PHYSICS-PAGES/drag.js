const C=require('./core.js'); const S=require('./specs.json'); const {genProbeAt,genAlphaForLift,genStallAngle}=C.__priv;
const out={};
for (const k of ['cub','c172','twin']){
  const def=C.buildGen(S[k].spec), g=def.params.gen, D=g.drag;
  const sh=C.genShakedown(def);
  const sim=C.makeSim(def,null); sim.reset(0);
  const W=sim.totalM*9.81, aMax=0.85*genStallAngle(def), Vs0=g.Vs||10, RHO=C.RHO;
  const dragAt=(v,cda)=>genProbeAt(sim,v,genAlphaForLift(sim,v,W,aMax)).drag-0.5*RHO*v*v*cda;
  const v65=cda=>{ let lo=Math.max(1.05*Vs0, sh.VbestLD||0), hi=4*Vs0;
    if(dragAt(lo,cda)>=0.65*sim.thrustAt(lo,1)) return lo;
    for(let i=0;i<24;i++){const m=0.5*(lo+hi); if(dragAt(m,cda)<0.65*sim.thrustAt(m,1)) lo=m; else hi=m;} return 0.5*(lo+hi); };
  const v0=v65(0);
  const rows={};
  // the gear row split (genGearCdA's own terms; the sum is checked against the core's)
  const G=def.spec.gear, semi=def.spec.geom.semi, fd=t=>1-0.18*(Math.max(0.70,Math.min(1.60,t||1))-1);
  const wCd=(G.fairing==='full'?0.15:G.fairing==='spat'?0.22:0.55)*(G.fairing&&G.fairing!=='none'?fd(G.fairTail):1);
  const tCd=(G.twFairing==='full'?0.15:G.twFairing==='spat'?0.22:0.55)*(G.twFairing&&G.twFairing!=='none'?fd(G.twFairTail):1);
  const R=G.wheelR||0.20, Rt=G.twR||0.10, legCd=(G.fairing==='full'||G.legFair==='fair')?0.30:1.0;
  const gp={ wheels:2*wCd*(2*R*0.76*R), third:tCd*(2*Rt*0.76*Rt), legs:2*legCd*(G.legDrop||0.42)*0.05,
    thirdLeg:(G.twFairing==='full'||G.twLegFair==='fair'?0.30:1.0)*(G.twLeg||0.20)*0.05,
    lever:0, struts: def.spec.bracing.type==='strut'? 2*0.10*(0.55*semi*1.12)*0.06 : 0 };
  if (G.suspension==='lever') gp.lever=NaN;
  const gsum=Object.values(gp).reduce((a,b)=>a+b,0);
  if (Math.abs(gsum-D.gear)>1e-9) console.log('GEAR SPLIT MISMATCH', gsum, D.gear);
  const gearRows={}; for(const r in gp) if(gp[r]>0) gearRows[r]={cda:gp[r], dV:v65(gp[r])-v0};
  let known=0; for (const r of ['body','cool','heads','screen','junct','exh','gear','brace','pod','strutPods']) known+=D[r]||0;
  const nac=D.axial-known; if (nac>1e-6) rows.nacelles={cda:nac, dV:v65(nac)-v0};
  for (const r of ['body','cool','heads','screen','junct','exh','gear','brace','pod','strutPods','stol']) if (D[r]>0) rows[r]={cda:D[r], dV:v65(D[r])-v0};
  // the surfaces at cruise: the probe's drag less the body row
  const a=genAlphaForLift(sim,v0,W,aMax), pr=genProbeAt(sim,v0,a), q=0.5*RHO*v0*v0;
  const surf=pr.drag-q*D.axial;
  const GR={ fuselage:['body'], cooling:['cool','heads','exh'], screen:['screen'], junct:['junct'], mainGear:['g:wheels','g:legs','g:lever'], third:['g:third','g:thirdLeg'], struts:['g:struts'], wires:['brace'], nacelles:['nacelles'], pod:['pod'], strutPods:['strutPods'] };
  const groups={};
  for (const gk in GR){ let c=0; for(const r of GR[gk]){ c += r.startsWith('g:') ? (gp[r.slice(2)]||0) : ((rows[r]&&rows[r].cda)||0); } if(c>0) groups[gk]={cda:c, dV:v65(c)-v0}; }
  out[k]={groups, name:S[k].name, Vs:Vs0, Vc:v0, VCruise:def.params.ap.VCruise, VbestLD:sh.VbestLD, LDbest:sh.LDbest, mass:sim.totalM, axial:D.axial,
    dragTotal:pr.drag, q, surfCdA:surf/q, rows, gearRows, wetted:D.swet, frontal:D.frontal, f:D.f, cdWet:D.cdWet, gearType:def.spec.gear.type, fairing:def.spec.gear.fairing};
  console.log(k, 'Vc', (v0*3.6).toFixed(1),'km/h','axial',D.axial.toFixed(3),'surf CdA',(surf/q).toFixed(3));
  for (const r in gearRows) console.log('   gear.',r.padEnd(8), gearRows[r].cda.toFixed(4),'m2', (gearRows[r].dV*3.6).toFixed(1),'km/h');
  for (const r in rows) console.log('   ',r.padEnd(10), rows[r].cda.toFixed(4),'m2', (rows[r].dV*3.6).toFixed(1),'km/h');
}
require('fs').writeFileSync(__dirname+'/drag.json', JSON.stringify(out,null,1));
