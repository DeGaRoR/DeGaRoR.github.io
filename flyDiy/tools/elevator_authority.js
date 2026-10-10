// elevator_authority.js (G2500, CESSNA-VREF) - THE ELEVATOR AGAINST THE TRIM IT IS ASKED, FREE AIR (the build's own tunnel:
// sim.probe, the prop and its wash OFF - 64_gen_build genProbeAt's method): for the metal Cessna as the game loads it
// (tools/_load_build.js), as the file is written, and the C172 file build; flap 0 / 0.25 / 0.5 / 1, 21-31 m/s: the
// alpha that lifts the weight, the pitching moment at de 0 and over the elevator's travel (0.2 / 0.35 = the pilot
// servo's stop / 0.5 / 0.7 / 1.0 = the stick's), the linear trim and the real one (where the moment crosses 0).
//   node tools/elevator_authority.js [<flyDiy dir>]

'use strict';
const path=require('path'),fs=require('fs');const ROOT=path.resolve(process.argv[2]||path.join(__dirname,'..'));process.chdir(ROOT);const T=path.join(ROOT,'tools');
const PT=require(path.join(T,'pilot_trace.js'));PT.loadPanel();const C=require(path.join(T,'flight_core.js'));const LB=require(path.join(T,'_load_build.js'));
function probe(sim,V,a){const [xA,yU]=sim.axes();const vel=[0,0,0];for(let k=0;k<3;k++)vel[k]=-V*(Math.cos(a)*xA[k]+Math.sin(a)*yU[k]);return sim.probe(vel);}
function aFor(sim,V,W,aMax){let a0=0.01,a1=0.09,f0=probe(sim,V,a0).Fy-W,f1=probe(sim,V,a1).Fy-W;for(let i=0;i<12;i++){if(Math.abs(f1-f0)<1e-9)break;let a2=a1-f1*(a1-a0)/(f1-f0);a2=Math.min(aMax,Math.max(-0.06,a2));a0=a1;f0=f1;a1=a2;f1=probe(sim,V,a1).Fy-W;if(Math.abs(f1)<0.5)break;}return {a:a1,miss:f1};}
const r=(v,n=3)=>+(+v).toFixed(n);
const builds=[['metal game','bugReports/cessnaMetal (1).json',1],['metal file','bugReports/cessnaMetal (1).json',0],['c172 file','builds/cessna172_2026-09-20_corrected.json',0]];
for(const [lab,file,game] of builds){
  const raw=JSON.parse(fs.readFileSync(file,'utf8'));const spec=game?LB.gameSpec(raw):(raw.spec||raw);
  const def=C.buildGen(C.genMigrateSpec?C.genMigrateSpec(JSON.parse(JSON.stringify(spec))):spec);const g=def.params.gen;
  console.log('== '+lab+': Vs '+r(g.Vs,2)+' VsFlap '+r(g.VsFlap,2)+' deAppr '+r(g.deAppr)+' deFlare '+(g.deFlare!=null?r(g.deFlare):'-')+' flareFlapless '+(g.flareFlapless!=null?r(g.flareFlapless):'-')+' landsFlapless '+!!g.landsFlapless+' apprTrimFail '+(g.apprTrimFail!=null?r(g.apprTrimFail):'-')+' elevTau '+r(def.params.elevTau)+' stabTrim '+r(def.params.stabTrim,4));
  const sim=C.makeSim(def,null);sim.reset(0);const W=sim.totalM*9.81;
  const aMax=0.85*(def.params.polarWings||[def.params.polarWing]).reduce((m,p)=>Math.min(m,p.aStall),Infinity);
  for(const f of [0,0.25,0.5,1]){
    sim.ctl.flap=f;
    for(const V of [21,23,25,27,29,31]){
      const {a,miss}=aFor(sim,V,W,aMax);sim.ctl.de=0;const m0=probe(sim,V,a).pitchUp;
      // the pitching moment over the elevator's whole travel (the servo's stop is 0.35; the player's stick 1.0)
      const curve=[0.2,0.35,0.5,0.7,1.0].map(d=>{sim.ctl.de=d;return probe(sim,V,a).pitchUp;});sim.ctl.de=0;
      const slope=(curve[0]-m0)/0.2;const deTrim=-m0/slope;
      // the trim on the real curve: the first de where pitchUp crosses 0
      let deReal=null;const pts=[[0,m0]].concat([0.2,0.35,0.5,0.7,1.0].map((d,i)=>[d,curve[i]]));
      for(let i=1;i<pts.length;i++){if((pts[i-1][1]<=0)!==(pts[i][1]<=0)){const[d0,y0]=pts[i-1],[d1,y1]=pts[i];deReal=d0-y0*(d1-d0)/(y1-y0);break;}}
      console.log('  flap '+f.toFixed(2)+' V '+V+' alpha '+r(a*57.3,1)+(Math.abs(miss)>5?' (STALLED: lift short '+r(miss,0)+' N)':'')+' M(de=0) '+r(m0,0)+' Nm, linear deTrim '+r(deTrim)+', real '+(deReal==null?'none in [0,1]':r(deReal))+'; M at de .2/.35/.5/.7/1: '+curve.map(v=>r(v,0)).join('/'));
    }
  }
}
