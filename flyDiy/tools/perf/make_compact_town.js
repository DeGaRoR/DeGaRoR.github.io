'use strict';
// Diagnostic fixture only: keep a compact group of original zones/plot seeds.
// No shipped map or saved scenery is overwritten.
const fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'../..'),P=require('../premises_cook.js');
const original=JSON.parse(fs.readFileSync(path.join(root,'tools/fixtures/island_jolene.json'),'utf8'));
const prior=JSON.parse(fs.readFileSync(path.join(root,'reports/evidence/PERFORMANCE-2026-11-19/town-original-plots.json'),'utf8'));
const keepZones=new Set(['mk_z_core','mk_z_res_c','mk_z_res_n','mk_z_res_e']);
const selected=prior.plots.filter(p=>keepZones.has(p.zone)),roadIds=new Set(selected.map(p=>p.road));
const points=original.layers.zones.filter(z=>keepZones.has(z.id)).flatMap(z=>z.poly);
const box={x0:Math.min(...points.map(p=>p[0]))-30,x1:Math.max(...points.map(p=>p[0]))+30,
 z0:Math.min(...points.map(p=>p[1]))-30,z1:Math.max(...points.map(p=>p[1]))+30};
const inside=p=>p&&p[0]>=box.x0&&p[0]<=box.x1&&p[1]>=box.z0&&p[1]<=box.z1;
const center=e=>{if(e.at)return[e.at.x,e.at.z];if(e.c)return e.c;
 if(Number.isFinite(e.x)&&Number.isFinite(e.z))return[e.x,e.z];
 const ps=e.poly||e.pts;if(ps&&ps.length)return[ps.reduce((s,p)=>s+p[0],0)/ps.length,ps.reduce((s,p)=>s+p[1],0)/ps.length];return null;};
const essential=new Set(['mk_sea','mk_mp_air','mk_mf_air','mk_x_lake']);
const rec=JSON.parse(JSON.stringify(original)),before={},after={};
for(const [layer,rows]of Object.entries(rec.layers)){
 if(!Array.isArray(rows))continue;before[layer]=rows.filter(e=>/^mk_/.test(e.id)).length;
 rec.layers[layer]=rows.filter(e=>{
  if(!/^mk_/.test(e.id)||essential.has(e.id))return true;
  if(layer==='zones')return keepZones.has(e.id);
  if(layer==='roads')return roadIds.has(e.id)||(e.pts||[]).some(inside);
  return inside(center(e));
 });
 after[layer]=rec.layers[layer].filter(e=>/^mk_/.test(e.id)).length;
}
// The removed neighbourhoods become wooded land, with the same modest forest
// zone density already authored around the town. Water is kept by the normal
// forest placement tests; the type override only touches land cover codes.
const ps=original.layers.zones.filter(z=>/^mk_/.test(z.id)).flatMap(z=>z.poly);
const outer={x0:Math.min(...ps.map(p=>p[0])),x1:Math.max(...ps.map(p=>p[0])),z0:Math.min(...ps.map(p=>p[1])),z1:Math.max(...ps.map(p=>p[1]))};
const strips=[[outer.x0,outer.z0,box.x0,outer.z1],[box.x1,outer.z0,outer.x1,outer.z1],
 [box.x0,outer.z0,box.x1,box.z0],[box.x0,box.z1,box.x1,outer.z1]];
strips.forEach(([x0,z0,x1,z1],i)=>{if(x1<=x0||z1<=z0)return;const poly=[[x0,z0],[x1,z0],[x1,z1],[x0,z1]];
 rec.layers.zones.push({id:'perf_wood_'+i,kind:'forest',poly,density:.11});
 rec.layers.ttype.push({id:'perf_wood_type_'+i,poly,code:8,from:[7,8,10,15]});
});
const {O}=P.composeVariant('jolene',P.VARIANTS.find(v=>v.name==='town'),JSON.stringify(rec));
const townPlots=O.records.plots.filter(p=>/^mk_/.test(p.zone));
const report={scope:'Compact town fixture; other named places and seaplane base retained; peripheral town layers removed and forest zones added.',
 originalTownPlots:prior.count,targetTownPlots:Math.round(prior.count/3),actualTownPlots:townPlots.length,
 fraction:townPlots.length/prior.count,retainedZones:[...keepZones],box,before,after,
 originalSelectedPlotSeeds:selected.length,retainedOriginalIds:townPlots.filter(p=>prior.plots.some(q=>q.id===p.id)).length,
 issues:O.records.issues};
fs.writeFileSync(path.join(root,'tools/fixtures/perf_town_third.json'),JSON.stringify(rec,null,1)+'\n');
fs.writeFileSync(path.join(root,'reports/evidence/PERFORMANCE-2026-11-19/town-third-fixture.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
