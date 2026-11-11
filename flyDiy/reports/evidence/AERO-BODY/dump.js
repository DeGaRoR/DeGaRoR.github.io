const C=require('/workspace/DeGaRoR.github.io/flyDiy/tools/flight_core.js');
const fs=require('fs');
for (const k of process.argv.slice(2)) {
  const r=JSON.parse(fs.readFileSync(__dirname+'/spec_'+k+'.json'));
  const sp=r.spec, c=sp.cage||{}, fl=sp.fuselage||{};
  const def=C.buildGen(JSON.parse(JSON.stringify(sp))), S=def.spec, D=def.params.gen.drag, ST=def.parts.ST;
  console.log('=== ',k,r.name,'| mat',S.material,'cover',fl.covering,'boom',S.fuse.boom,'tail',S.tail.type,'engMount',c.engMount,'eng x',S.engAt&&S.engAt.map(e=>e.mount+'@'+e.x.toFixed(2)+','+e.y.toFixed(2)).join(' '));
  console.log('   cage: taperOn',c.taperOn,'taperLen',c.taperLen,'boomStyle',c.boomStyle,'boomTwin',c.boomTwin,'aeroAftOn',c.aeroAftOn,'aeroAftLen',c.aeroAftLen,'rodD',c.rodD,'boomHf/Ha/Wf/Wa',c.boomHf,c.boomHa,c.boomWf,c.boomWa,'planeScale',c.planeScale,'taperPanel?',Object.keys(c).filter(x=>/taper|panel|skin|rearAp|aeroNose|noseFin|cowlOn|aft/i.test(x)).map(x=>x+'='+c[x]).join(','));
  console.log('   fuse: boxRear',S.fuse.boxRear.toFixed(2),'joined tailArm',fl.tailArm,'-> tailArm',S.fuse.tailArm.toFixed(2),'post',S.fuse.postX.toFixed(2),'chord',S.wings[0].chord.toFixed(2),'floor',(S.fuse.boxRear+0.9*S.wings[0].chord).toFixed(2),'profile',!!(S.fuse.profile),'rod',JSON.stringify(S.fuse.rod),'hX',S.tail.hX.toFixed(2));
  console.log('   ST',ST.map(s=>s.x.toFixed(2)+':'+(2*s.w).toFixed(2)+'x'+(s.yt-s.yb).toFixed(2)).join(' '));
  console.log('   cowl len',S.cowl.len&&S.cowl.len.toFixed(2),'| drag body',D.body.toFixed(3),'L',D.L.toFixed(2),'f',D.f.toFixed(2),'FF',D.FF.toFixed(2),'swet',D.swet.toFixed(1),'| fusCdA',def.params.fusCdA.map(x=>x.toFixed(3)).join('/'),'aft',def.params.fusCdAAft.map(x=>x.toFixed(3)).join('/'),'aftBlob x',(def.refs.fusDragAft.reduce((a,i)=>a+def.nodes[i].p[0],0)/4).toFixed(2),'fwdBlob x',(def.refs.fusDrag.reduce((a,i)=>a+def.nodes[i].p[0],0)/def.refs.fusDrag.length).toFixed(2));
  console.log('   dragrows',Object.entries(D).filter(([a,b])=>typeof b==='number').map(([a,b])=>a+'='+(+b).toFixed(3)).join(' '));
  if (S.tail.type==='twinBoom') console.log('   twinBoom boomX',S.tail.boomX,'boomLen',S.tail.boomLen,'boomR',S.tail.boomR);
}
