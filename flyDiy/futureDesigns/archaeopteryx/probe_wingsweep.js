// probe_wingsweep.js: the Archaeopteryx's static margin as the wing moves aft (wgDx), the pack at the thighs. node futureDesigns/archaeopteryx/probe_wingsweep.js
const T=require('path').join(__dirname,'../../tools/')+'/';const C=require(T+'flight_core.js'),BJ=require(T+'_bake_joined.js'),LB=require(T+'_load_build.js');
const {D}=BJ.loadPanel(); const A=D.ARCHETYPES.find(x=>x.key==='archaeopteryx'); const c0=Object.assign({},A.over.cage);
console.log('card wgDx', c0.wgDx);
for (const dx of [0,-0.05,-0.1,-0.15,-0.2,-0.25,-0.3]) {
  const s0=D.designBake(A.sel,{cage:Object.assign({},c0,{wgDx:(+c0.wgDx||0)+dx}),spec:JSON.parse(JSON.stringify(A.over.spec))}); const sp=LB.gameSpecFull({v:s0.v,birth:1,spec:s0}).spec; const d=C.buildGen(JSON.parse(JSON.stringify(sp)));
  const g=d.params.gen, dc=C.genDesignCheck(d), row=k=>{const r=dc.rows.find(r=>new RegExp(k,'i').test(r.label||'')); return r?(+r.value):NaN;};
  const cg=C.defCG(d)[0]; console.log('wgDx', dx.toFixed(2).padStart(5), 'MAC LE', g.xLEmac.toFixed(3), 'CG', cg.toFixed(3), ((cg-g.xLEmac)/g.cBar*100).toFixed(1)+'% MAC', 'SM', (row('Static margin')*100).toFixed(1)+'%');
}
