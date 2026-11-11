const C=require('./core_ta.js'); const {genProbeAt,genAlphaForLift,genStallAngle}=C.__priv; const P=require('./pods_specs.json');
const rows=[];
function one(spec){
  const def=C.buildGen(JSON.parse(JSON.stringify(spec))), g=def.params.gen, D=g.drag, sp=def.spec, ST=def.parts.ST;
  const sim=C.makeSim(def,null); sim.reset(0);
  const W=sim.totalM*9.81, aMax=0.85*genStallAngle(def), Vs0=g.Vs, sh=C.genShakedown(def);
  const dragAt=v=>genProbeAt(sim,v,genAlphaForLift(sim,v,W,aMax)).drag;
  let lo=Math.max(1.05*Vs0, sh.VbestLD||0), hi=4*Vs0; for(let i=0;i<24;i++){const m=0.5*(lo+hi); if(dragAt(m)<0.65*sim.thrustAt(m,1)) lo=m; else hi=m;}
  const bal=C.genAidBalance(def);
  return {tailArm:sp.fuse.tailArm, boxRear:sp.fuse.boxRear, chord:sp.wings[0].chord, ST:ST.map(s=>[+s.x.toFixed(2),+(s.yt-s.yb).toFixed(2)]), body:D.body, f:D.f, FF:D.FF, axial:D.axial, aft:def.params.fusCdAAft[1], Vc:0.5*(lo+hi)*3.6, mass:sim.totalM, sm:bal.sm,
    eng:(sp.engAt||[]).map(e=>e.mount+'@'+e.x.toFixed(2)), propD:sp.prop&&sp.prop.D, tail:sp.tail.type, boom:sp.fuselage&&sp.fuselage.boom};
}
for(const f in P){ const r=P[f]; if(!r.spec) continue; const c=r.spec.cage||{};
  const joined=r.spec.fuselage&&r.spec.fuselage.tailArm;
  globalThis.__TA_OVERRIDE=null; let a; try{a=one(r.spec);}catch(e){console.log('ERR',f,e.message);continue;}
  const floor=a.boxRear+0.9*a.chord, active = joined!=null && joined < floor-1e-6;
  const drawnEnd = a.boxRear + (+c.taperOn ? (+c.taperLen||0.6) : 0);
  let b=null; if(active){ globalThis.__TA_OVERRIDE=()=>Math.max(joined, drawnEnd); try{b=one(r.spec);}catch(e){b={err:e.message};} }
  rows.push({f, name:r.name, boomStyle:c.boomStyle, boomTwin:c.boomTwin, taperOn:c.taperOn, taperLen:c.taperLen, joined, floor, active, drawnEnd, a, b});
  console.log((active?'FLOOR ':'ok    ')+f.padEnd(58), 'tail',a.tail,'boom',a.boom,'| joined',joined&&joined.toFixed(2),'box',a.boxRear.toFixed(2),'floor',floor.toFixed(2),'-> sim',a.tailArm.toFixed(2),'drawn',drawnEnd.toFixed(2),
    '| body',a.body.toFixed(3), b&&b.body? '-> '+b.body.toFixed(3):'', '| Vc',a.Vc.toFixed(0), b&&b.Vc?'-> '+b.Vc.toFixed(0):'', '| eng',a.eng.join(','));
}
require('fs').writeFileSync(__dirname+'/pods.json', JSON.stringify(rows));
