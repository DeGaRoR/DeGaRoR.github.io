const C=require('./core.js'); const S=require('./specs.json');
const LK=Object.keys(C.GEN_LIGHT_AMPS); const out={};
for (const k of ['cub','c172','twin']){
  const def=C.buildGen(S[k].spec), sp=def.spec, cg=sp.cage||{};
  const lights=cg.lightOn? LK.filter(q=>cg['li_'+q+'Fit']==null||+cg['li_'+q+'Fit']) : [];
  const sy=C.genSystemsResolve(sp,{lights});
  const lightLoads=lights.map(q=>({key:'lt_'+q, amps:C.GEN_LIGHT_AMPS[q]*(q==='beacon'?0.5:1), cb:C.GEN_LIGHT_BREAKER[q]}));
  const run=(loads, alt)=>{ const bus=C.makeBus({battAh:sy.battAh, altA:sy.altA, loads, breakers:sy.breakers});
    bus.master=true; bus.alt=alt; bus.avionics=true; let t=0; const rpm=2300;
    bus.step(0.5,rpm,false); const A=bus.loadA, V=bus.V, net=bus.amps;
    if(alt) return {A,V,net};
    while(bus.ok && t<6*3600){ bus.step(5,rpm,false); t+=5; } return {A,V,net,min:t/60}; };
  const day=run(sy.loads.slice(), true), night=run(sy.loads.concat(lightLoads), true), dark=run(sy.loads.concat(lightLoads), false), darkDay=run(sy.loads.slice(), false);
  out[k]={name:S[k].name, elec:sy.elec, battAh:sy.battAh, altA:sy.altA, starter:sy.starter, vac:sy.vac, loads:sy.loads, lights:lightLoads, breakers:sy.breakers, parts:sy.parts, rows:sy.rows.filter(r=>r.group!=='panel'||r.amps>0), day, night, dark, darkDay, kg:sy.bill.elec.kg, price:sy.bill.elec.price};
  console.log(k, 'alt',sy.altA,'A batt',sy.battAh,'Ah | day', day.A.toFixed(2),'A | night', night.A.toFixed(2),'A net',night.net.toFixed(2),'| alt dead night', dark.min.toFixed(0),'min, day', darkDay.min.toFixed(0),'min');
}
require('fs').writeFileSync(__dirname+'/elec.json', JSON.stringify(out,null,1));
