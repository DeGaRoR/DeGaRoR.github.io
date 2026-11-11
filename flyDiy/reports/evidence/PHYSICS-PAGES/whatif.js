// the Twin busher's sim body as resolved (tail cone to 3.47 m) against the body cut where the pod is drawn
const C=require('./core_ta.js'); const S=require('./specs.json'); const {genProbeAt,genAlphaForLift,genStallAngle}=C.__priv;
const cage=S.twin.spec.cage;
function measure(label){
  const def=C.buildGen(JSON.parse(JSON.stringify(S.twin.spec))), g=def.params.gen, D=g.drag, sp=def.spec, ST=def.parts.ST;
  const sh=C.genShakedown(def), bal=C.genAidBalance(def);
  const sim=C.makeSim(def,null); sim.reset(0);
  const W=sim.totalM*9.81, aMax=0.85*genStallAngle(def), Vs0=g.Vs;
  const dragAt=(v)=>genProbeAt(sim,v,genAlphaForLift(sim,v,W,aMax)).drag;
  let lo=Math.max(1.05*Vs0, sh.VbestLD||0), hi=4*Vs0; for(let i=0;i<24;i++){const m=0.5*(lo+hi); if(dragAt(m)<0.65*sim.thrustAt(m,1)) lo=m; else hi=m;}
  const vc=0.5*(lo+hi);
  // the yaw stiffness: the side force's moment per rad of sideslip at cruise (weathercock), from the probe
  const yawAt=b=>{ const [xA,yU,zR]=sim.axes(); const a=genAlphaForLift(sim,vc,W,aMax);
    const vel=[0,1,2].map(k=>-vc*(Math.cos(a)*Math.cos(b)*xA[k]+Math.sin(a)*yU[k])+vc*Math.sin(b)*zR[k]); const r=sim.probe(vel); return r; };
  const r0=yawAt(0), r1=yawAt(0.05);
  const fusM=def.nodes.filter(n=>/^S[3-6]/.test(n.tag)).reduce((a,n)=>a+n.m,0);
  const pX=(sp.engines&&sp.engines[0]&&sp.engines[0].x);
  return { label, tailArm:sp.fuse.tailArm, boxRear:sp.fuse.boxRear, ST:ST.map(s=>+s.x.toFixed(2)), stEnd:ST[ST.length-1].x,
    swet:D.swet, L:D.L, f:D.f, FF:D.FF, body:D.body, axial:D.axial, aftCdA:def.params.fusCdAAft[1], fwdCdA:def.params.fusCdA[1],
    aftAt:def.nodes[def.refs.fusDragAft[0]].p[0], mass:sim.totalM, nodesS3_6:fusM, Vc:vc*3.6, VCruisePlaque:def.params.ap.VCruise*3.6,
    LD:sh.LDbest, cgX:bal.cgX, npX:bal.npX, sm:bal.sm, engX:pX, yawKeys:Object.keys(r0).filter(k=>/yaw|Mz|Fz|side/i.test(k)) , r0yaw:r0.yawR!=null?r0.yawR:null, r1yaw:r1.yawR!=null?r1.yawR:null,
    yawd: ['yaw','yawR','Mz','yawMom'].map(k=>[k, r0[k], r1[k]]).filter(x=>x[1]!=null) };
}
globalThis.__TA_OVERRIDE=null;
const a=measure('as resolved (the tail-arm floor)');
const drawnEnd=a.boxRear + (+cage.taperLen);
globalThis.__TA_OVERRIDE=S=>drawnEnd;
const b=measure('body cut at the drawn pod end (boxRear + cage taperLen '+cage.taperLen+')');
console.log(JSON.stringify([a,b],(k,v)=>typeof v==='number'?+v.toFixed(4):v,1));
require('fs').writeFileSync(__dirname+'/whatif.json', JSON.stringify([a,b]));
