const fs=require('fs'),path=require('path');const C=require(process.cwd()+'/flight_core.js');
const b=process.argv[2]||'cessna172';
const d=C.buildGen(C.genMigrateSpec(JSON.parse(fs.readFileSync(path.join('..','builds',b+'_2026-09-20_corrected.json'))).spec));
const de=d.params.ap.taxiDe??0.30;
for (const thr of [0.4,0.5,0.6]) for (const sgn of [1,-1]) for (const deX of [de]) { const bd = sgn;
 const sim=C.makeSim(d,null); sim.reset(0); if(sim.stance)sim.stance(); for(let i=0;i<120;i++)sim.step(1/60);
 const p0=sim.cgPos().slice(); const x0=sim.axes()[0]; const h0=Math.atan2(-x0[2],-x0[0]);
 let maxd=0,t=0,turned=0,hp=h0;
 for(let i=0;i<60*40;i++){ Object.assign(sim.ctl,{thr,dr:sgn,de:deX,brake:0,brakeD:bd}); sim.step(1/60); t+=1/60;
   const x=sim.axes()[0], h=Math.atan2(-x[2],-x[0]); let dh=h-hp; dh-=2*Math.PI*Math.round(dh/2/Math.PI); turned+=dh; hp=h;
   const c=sim.cgPos(); maxd=Math.max(maxd,Math.hypot(c[0]-p0[0],c[2]-p0[2])); if(Math.abs(turned)>Math.PI) break; }
 console.log(b,'thr',thr,'brakeD',bd,'de',deX.toFixed(2),'turned',(turned*57.3).toFixed(0),'in',t.toFixed(1),'s, CG max excursion',maxd.toFixed(1),'m');
}
