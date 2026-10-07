const fs=require('fs'),path=require('path');const C=require(process.cwd()+'/flight_core.js');const IN=require(process.cwd()+'/island_node.js');
const W=IN.islandWorld('jolene',{premises:fs.readFileSync('fixtures/island_jolene.json','utf8')});
const a=W.aerodromes.find(q=>q.id===(process.argv[3]||'nv_strip'));
const b=process.argv[2]||'cessna172';
const d=C.buildGen(C.genMigrateSpec(JSON.parse(fs.readFileSync(path.join('..','builds',b+'_2026-09-20_corrected.json'))).spec));
for (const thr of [0.5,0.6,0.75,0.9]) for (const deX of [0.3, 0.0]) for (const brk of [0, 0.3]) {
 const sim=C.makeSim(d,W); sim.reset(0); if(sim.stance)sim.stance(); C.placeAtLineup(sim,a,{x:a.x,z:a.z,hdg:a.hdg},W,d.refs); for(let i=0;i<300;i++)sim.step(1/60);
 const p0=sim.cgPos().slice(); let hp=null,turned=0,maxd=0,t=0;
 for(let i=0;i<60*40;i++){ Object.assign(sim.ctl,{thr,dr:1,de:deX,brake:brk,brakeD:1}); sim.step(1/60); t+=1/60;
   const x=sim.axes()[0], h=Math.atan2(-x[2],-x[0]); if(hp!==null){let dh=h-hp; dh-=2*Math.PI*Math.round(dh/2/Math.PI); turned+=dh;} hp=h;
   const c=sim.cgPos(); maxd=Math.max(maxd,Math.hypot(c[0]-p0[0],c[2]-p0[2])); if(Math.abs(turned)>Math.PI) break; }
 console.log(b,'thr',thr,'de',deX,'brake',brk,'turned',(turned*57.3).toFixed(0),'in',t.toFixed(1),'s, excursion',maxd.toFixed(1));
}
