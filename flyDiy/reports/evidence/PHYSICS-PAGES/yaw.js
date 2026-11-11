const C=require('./core_ta.js'); const S=require('./specs.json'); const {genProbeAt,genAlphaForLift,genStallAngle}=C.__priv;
const cage=S.twin.spec.cage;
function run(label){
  const def=C.buildGen(JSON.parse(JSON.stringify(S.twin.spec))), sim=C.makeSim(def,null); sim.reset(0);
  const W=sim.totalM*9.81, V=def.params.ap.VCruise, a=genAlphaForLift(sim,V,W,0.85*genStallAngle(def));
  const [xA,yU,zR]=sim.axes();
  const at=b=>{ const vel=[0,1,2].map(k=>-V*(Math.cos(a)*Math.cos(b)*xA[k]+Math.sin(a)*yU[k])+V*Math.sin(b)*zR[k]); return sim.probe(vel); };
  const r0=at(0), r1=at(0.05), q=0.5*C.RHO*V*V, g=def.params.gen;
  const Cnb=(r1.yawLeft-r0.yawLeft)/0.05/(q*g.Sw*g.span);
  const E=def.params.engines&&def.params.engines[0];
  return {label, V:V*3.6, Cn_beta_per_rad:Cnb, yawLeft0:r0.yawLeft, yawLeft5pct:r1.yawLeft, engine: E && JSON.stringify(E).slice(0,300), propD: def.spec.prop && def.spec.prop.D};
}
globalThis.__TA_OVERRIDE=null; const a=run('as resolved');
const end=1.8476+(+cage.taperLen); globalThis.__TA_OVERRIDE=()=>end; const b=run('cut at drawn end');
console.log(JSON.stringify([a,b],null,1));
