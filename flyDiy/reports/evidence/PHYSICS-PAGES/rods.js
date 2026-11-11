// rod-boom builds: the aft body as resolved (the family cone) against the drawn one (the taper, then the rod) given as a profile
const C=require('./core_ta.js'); const {genProbeAt,genAlphaForLift,genStallAngle}=C.__priv; const P=require('./pods_specs.json');
function one(spec){
  const def=C.buildGen(JSON.parse(JSON.stringify(spec))), g=def.params.gen, D=g.drag, ST=def.parts.ST;
  const sim=C.makeSim(def,null); sim.reset(0); const W=sim.totalM*9.81, aMax=0.85*genStallAngle(def), Vs0=g.Vs, sh=C.genShakedown(def);
  const dragAt=v=>genProbeAt(sim,v,genAlphaForLift(sim,v,W,aMax)).drag;
  let lo=Math.max(1.05*Vs0, sh.VbestLD||0), hi=4*Vs0; for(let i=0;i<24;i++){const m=0.5*(lo+hi); if(dragAt(m)<0.65*sim.thrustAt(m,1)) lo=m; else hi=m;}
  const V=def.params.ap.VCruise, a=genAlphaForLift(sim,V,W,aMax), [xA,yU,zR]=sim.axes();
  const at=b=>sim.probe([0,1,2].map(k=>-V*(Math.cos(a)*Math.cos(b)*xA[k]+Math.sin(a)*yU[k])+V*Math.sin(b)*zR[k]));
  const Cnb=(at(0.05).yawLeft-at(0).yawLeft)/0.05/(0.5*C.RHO*V*V*g.Sw*g.span);
  const bal=C.genAidBalance(def);
  return {def, ST:ST.map(s=>[+s.x.toFixed(2),+(s.yt-s.yb).toFixed(2)]), body:D.body, swet:D.swet, FF:D.FF, aft:def.params.fusCdAAft[1], Vc:0.5*(lo+hi)*3.6, Cnb, sm:bal.sm, mass:sim.totalM};
}
const rows=[];
for (const f of ['builds/candidates/birdman.json','builds/chinook_2026-09-21_corrected.json','builds/rufus_2026-10-18_certified.json','builds/candidates/build_v8_pusher_2026-09-11.json','builds/candidates/build_v7_twin_2026-09-04.json']){
  const sp=P[f].spec, c=sp.cage||{};
  globalThis.__TA_OVERRIDE=null;
  const a=one(sp); const ST=a.def.parts.ST, fu=a.def.spec.fuse, box=ST.find(s=>Math.abs(s.x-fu.boxRear)<1e-6)||ST[2];
  const L=fu.tailArm-fu.boxRear, tl=(+c.taperOn? (+c.taperLen||0.6):0.05), mid=0.5*(box.yt+box.yb);
  const rh0=+c.boomHf||0.24, rh1=+c.boomHa||0.17, rw0=+c.boomWf||0.16, rw1=+c.boomWa||0.11;
  const prof=[]; for(let i=0;i<=8;i++){ const t=i/8, x=t*L; let h,w;
    if(x<tl){ const u=x/tl; h=(box.yt-box.yb)*(1-u)+rh0*u; w=box.w*(1-u)+rw0/2*u; } else { const u=(x-tl)/Math.max(1e-6,L-tl); h=rh0+(rh1-rh0)*u; w=(rw0+(rw1-rw0)*u)/2; }
    prof.push({t, w, yb:mid-h/2, yt:mid+h/2}); }
  const sp2=JSON.parse(JSON.stringify(sp)); sp2.fuselage.profile=prof;
  const b=one(sp2);
  rows.push({f, name:P[f].name, a:{ST:a.ST,body:a.body,swet:a.swet,FF:a.FF,aft:a.aft,Vc:a.Vc,Cnb:a.Cnb,sm:a.sm,mass:a.mass}, b:{ST:b.ST,body:b.body,swet:b.swet,FF:b.FF,aft:b.aft,Vc:b.Vc,Cnb:b.Cnb,sm:b.sm,mass:b.mass}});
  console.log(f.split('/').pop().padEnd(36),'body',a.body.toFixed(3),'->',b.body.toFixed(3),'| swet',a.swet.toFixed(1),'->',b.swet.toFixed(1),'| aft side CdA',a.aft.toFixed(2),'->',b.aft.toFixed(2),
    '| Vc',a.Vc.toFixed(0),'->',b.Vc.toFixed(0),'| Cn_b',a.Cnb.toFixed(3),'->',b.Cnb.toFixed(3),'| SM',a.sm.toFixed(3),'->',b.sm.toFixed(3),'| depth@mid',a.ST[4][1],'->',b.ST[4][1]);
}
require('fs').writeFileSync(__dirname+'/rods.json', JSON.stringify(rows));
