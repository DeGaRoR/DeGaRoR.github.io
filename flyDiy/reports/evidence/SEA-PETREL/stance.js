// the Petrel at rest on HOME's ground, two aboard vs one: pitch, wheels on the ground, the lowest non-wheel nodes
const path=require('path'),fs=require('fs');const T='/workspace/base/flyDiy/tools';
const PT=require(path.join(T,'pilot_trace.js'));PT.loadPanel();const C=require(path.join(T,'flight_core.js'));
const IN=require(path.join(T,'island_node.js'));const TR=require(path.join(T,'_tour_lib.js'));
const TW=TR.tourWorld(C,IN,fs),W=TW.W,A=W.aerodromes.find(a=>a.id==='HOME');
for (const occ of [[1,1],[1,0],[0,1]]) {
  const spec=PT.specOf(path.join(T,'..','builds/candidates/superpetrel_V4_1.json')).spec;
  spec.cabin=Object.assign({},spec.cabin,{occupied:occ});
  const def=C.buildGen(C.genMigrateSpec(spec));
  const sim=C.makeSim(def,W); sim.reset(0); if(sim.stance) sim.stance(); C.placeAtAerodrome(sim,A);
  for(let i=0;i<600;i++) sim.step(1/60);
  const g=(x,z)=>W.terrainH(x,z); const low=[];
  for(let i=0;i<sim.n;i++){const y=sim.p[i*3+1]-g(sim.p[i*3],sim.p[i*3+2]); low.push([y,def.nodes[i].id||i]);}
  low.sort((a,b)=>a[0]-b[0]);
  const m=def.nodes.reduce((s,q)=>s+q.m,0), cg=sim.cgPos();
  console.log(JSON.stringify(occ),'mass',m.toFixed(1),'pitch',(sim.out.pitch*57.3).toFixed(1),'roll',(sim.out.roll*57.3).toFixed(1),'wheels',sim.wheelsOnGround(),'lowest',low.slice(0,6).map(q=>q[1]+':'+q[0].toFixed(3)).join(' '), 'cgX(design)', (def.params.cg?JSON.stringify(def.params.cg):''));
}
