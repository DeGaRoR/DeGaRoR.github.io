'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert/strict'),{performance}=require('perf_hooks');
global.CORE_MATH=require('./flight_core').CORE_MATH;
const P=require('../src/core/27_premises'),fixture=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/premises_v1_perf_town_third.json'))),world={terrainH:()=>10,waterH:()=>-Infinity};
const a=P.compose(fixture,world,{noPlace:true,boundedPolys:false}),b=P.compose(fixture,world,{noPlace:true,boundedPolys:true}),points=[];
let seed=91827;const rnd=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
for(let i=0;i<4000;i++)points.push([(rnd()-.5)*20000,(rnd()-.5)*20000]);
for(const pp of a.pavePolys)for(let i=0;i<pp.poly.length;i++)for(const e of[-50,-6,-1e-5,-1e-7,0,1e-7,1e-5,6,50])points.push(a.frame.toWorld(pp.poly[i][0]+e,pp.poly[i][1]+e*.4));
const calls=[['treePaveAt',[]],['coverAt',[1]],['coverAt',[0]],['pavedAt',[0]],['pavedAt',[6]],['pavedNear',[0]],['pavedNear',[30]]];let checks=0;
for(const [name,args]of calls)for(const p of points){assert.deepStrictEqual(b[name](p[0],p[1],...args),a[name](p[0],p[1],...args),name+' '+p);checks++;}
assert(b.pavePolyStats().rejected>100,'Exercise distant polygons, not an empty fixture');
const timing=[];for(let order=0;order<4;order++)for(const [name,o]of order%2?[['bounded',b],['original',a]]:[['original',a],['bounded',b]]){const start=performance.now();for(const p of points)o.pavedAt(p[0],p[1],6);timing.push({order,name,ms:performance.now()-start});}
console.log(JSON.stringify({checks,points:points.length,polygons:a.pavePolys.length,exact:true,original:a.pavePolyStats(),bounded:b.pavePolyStats(),timing,scope:'Actual composed fixture; random/edge/threshold queries, all cover/pavement decisions match exactly. Micro timings are not browser loading savings.'}));
