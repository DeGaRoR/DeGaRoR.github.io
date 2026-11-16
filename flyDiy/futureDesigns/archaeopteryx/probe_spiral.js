// probe_spiral.js <keys> [bank deg]: run: node futureDesigns/archaeopteryx/probe_spiral.js archaeopteryx,motorglider,cub 10
// the spiral in the sim: level at VCruise, banked 10 deg (rolled about the flight path), pitch held by a PD on the
// elevator, ailerons and rudder FREE at 0; bank over 25 s; motor at thrCruise vs off
const T=require('path').join(__dirname,'../../tools/')+'/';const C=require(T+'flight_core.js'),BJ=require(T+'_bake_joined.js'),LB=require(T+'_load_build.js'),L=require(T+'_treecrash_lib.js');
const {D}=BJ.loadPanel();
const born=k=>{const A=D.ARCHETYPES.find(x=>x.key===k), s0=D.designBake(A.sel,A.over); return C.buildGen(LB.gameSpecFull({v:s0.v,birth:1,spec:s0}).spec);};
const B0=(+process.argv[3]||10)/57.3;
for (const key of process.argv[2].split(',')) { const def=born(key), V=def.params.ap.VCruise;
 for (const motor of ['on','off']) {
  const F=L.flatWorld(0), s=C.makeSim(def,F.W); s.reset(0);
  let cx=0,cy=0,cz=0,m=0; for(let i=0;i<s.n;i++){cx+=s.p[3*i]*s.m[i];cy+=s.p[3*i+1]*s.m[i];cz+=s.p[3*i+2]*s.m[i];m+=s.m[i];} cx/=m;cy/=m;cz/=m;
  const cb=Math.cos(B0), sb=Math.sin(B0);
  for(let i=0;i<s.n;i++){ const y=s.p[3*i+1]-cy, z=s.p[3*i+2]-cz; s.p[3*i]-=cx; s.p[3*i+1]=600+y*cb-z*sb; s.p[3*i+2]=y*sb+z*cb; s.v[3*i]=-V; s.v[3*i+1]=0; s.v[3*i+2]=0; }
  const thr = motor==='on' ? (def.params.ap.thrCruise!=null?def.params.ap.thrCruise:0.6) : 0;
  for(let i=0;i<s.eng.length;i++) s.setEngine(i,{key:motor});
  const dt=1/120; let p0=null, prevP=0; const log=[];
  for (let f=0; f<25*120; f++) { const t=f*dt;
    s.ctl.thr=thr; s.ctl.da=0; s.ctl.dr=0;
    s.step(dt); const P=s.out.pitch||0; if (p0==null && t>0.5) p0=P; const q=(P-prevP)/dt; prevP=P;
    s.ctl.de = p0==null?0:Math.max(-1,Math.min(1, -3*(P-p0) - 0.6*q));
    if (f%240===0) log.push(t.toFixed(0)+'s φ'+((s.out.roll||0)*57.3).toFixed(1)+' V'+s.out.V.toFixed(0));
    if (!s.p.every(Number.isFinite)) { log.push('NaN'); break; } }
  console.log(key,'motor',motor,'from',(B0*57.3).toFixed(0),'deg:',log.join(' '));
 } }
