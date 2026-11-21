'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert'),{performance}=require('perf_hooks');
global.CORE_MATH=require('./flight_core.js').CORE_MATH;
const P=require('../src/core/27_premises.js'),fixture=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures/premises_v1_perf_town_third.json'))),world={terrainH:()=>10,waterH:()=>-Infinity};
let state=92381;const rnd=()=>((state=(Math.imul(state,1664525)+1013904223)>>>0)/4294967296);
const original=P.compose(fixture,world,{noPlace:true,boundedRoads:false}),bounded=P.compose(fixture,world,{noPlace:true,boundedRoads:true}),points=[];
for(let i=0;i<8000;i++)points.push([(rnd()-.5)*18000,(rnd()-.5)*18000]);
for(const r of original.roads)for(let i=0;i<r.pts.length;i+=Math.max(1,Math.floor(r.pts.length/20))){const q=r.pts[i];for(const reach of[0,1,12,48,100])points.push([q[0]+reach,q[1]-reach*.3]);}
let checks=0;const calls=[['treePaveAt',[]],['coverAt',[1]],['coverAt',[0]],['pavedAt',[0]],['pavedAt',[6]],['pavedNear',[0]],['pavedNear',[30]]];
for(const [name,args]of calls)for(const [x,z]of points){const a=original[name](x,z,...args),b=bounded[name](x,z,...args);assert.deepStrictEqual(b,a,name+' '+x+','+z);checks++;}
const timings={};for(const [label,o]of[['legacy',original],['bounded',bounded]]){const start=performance.now();let count=0;for(const [x,z]of points)if(o.coverAt(x,z,1))count++;timings[label]={ms:performance.now()-start,contributing:count};}
console.log(JSON.stringify({checks,points:points.length,roads:original.roads.length,exact:true,timings,scope:'Actual full composed fixture, flat test terrain, default sides and pavement-only cover, tree exclusion, pavedNear and pavedAt; no sampling approximation or road geometry change.'}));
