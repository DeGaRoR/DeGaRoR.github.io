// probe_dsim.js <keys>: run: node futureDesigns/archaeopteryx/probe_dsim.js archaeopteryx,motorglider
// the Dutch roll in the sim: level at VCruise, pitch held by a PD on the elevator (the static margin is negative),
// ailerons and rudder FREE at 0; a rudder doublet at 1 s; motor at thrCruise vs off. beta / yaw rate / bank over 12 s
const T=require('path').join(__dirname,'../../tools/')+'/';const C=require(T+'flight_core.js'),BJ=require(T+'_bake_joined.js'),LB=require(T+'_load_build.js'),L=require(T+'_treecrash_lib.js');
const {D}=BJ.loadPanel();
const born=k=>{const A=D.ARCHETYPES.find(x=>x.key===k), s0=D.designBake(A.sel,A.over); return C.buildGen(LB.gameSpecFull({v:s0.v,birth:1,spec:s0}).spec);};
for (const key of process.argv[2].split(',')) { const def=born(key), V=def.params.ap.VCruise;
 for (const motor of ['on','off']) {
  const F=L.flatWorld(0), s=C.makeSim(def,F.W); s.reset(0);
  let cx=0,cy=0,cz=0,m=0; for(let i=0;i<s.n;i++){cx+=s.p[3*i]*s.m[i];cy+=s.p[3*i+1]*s.m[i];cz+=s.p[3*i+2]*s.m[i];m+=s.m[i];} cx/=m;cy/=m;cz/=m;
  for(let i=0;i<s.n;i++){ s.p[3*i]-=cx; s.p[3*i+1]+=600-cy; s.p[3*i+2]-=cz; s.v[3*i]=-V; s.v[3*i+1]=0; s.v[3*i+2]=0; }
  const thr = motor==='on' ? (def.params.ap.thrCruise!=null?def.params.ap.thrCruise:0.6) : 0;
  if (motor==='off') for(let i=0;i<s.eng.length;i++) s.setEngine(i,{key:'off'}); else for(let i=0;i<s.eng.length;i++) s.setEngine(i,{key:'on'});
  const dt=1/120; let p0=null, de=0, prevP=0; const log=[]; let bmax=0;
  for (let f=0; f<12*120; f++) { const t=f*dt;
    s.ctl.thr=thr; s.ctl.da=0; s.ctl.dr = (t>=1&&t<1.5)?0.4:(t>=1.5&&t<2)?-0.4:0;
    s.step(dt); const P=s.out.pitch||0; if (p0==null && t>0.5) p0=P; const tgt=p0==null?P:p0;
    const q=(P-prevP)/dt; prevP=P; de = Math.max(-1,Math.min(1, -3*(P-tgt) - 0.6*q)); s.ctl.de = p0==null?0:de;
    if (t>=2) bmax=Math.max(bmax,Math.abs(s.out.beta||0));
    if (f%60===0 && t>=1) log.push(t.toFixed(1)+':b'+((s.out.beta||0)*57.3).toFixed(1)+' r'+((s.out.r||0)*57.3).toFixed(0)+' φ'+((s.out.roll||0)*57.3).toFixed(0)+' V'+s.out.V.toFixed(0));
    if (!s.p.every(Number.isFinite)) { log.push('NaN'); break; } }
  console.log(key,'motor',motor,'(thr '+(+thr).toFixed(2)+', V0 '+V.toFixed(1)+')'); console.log('  '+log.join(' '));
 } }
