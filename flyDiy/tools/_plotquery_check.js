'use strict';
const fs=require('fs'),vm=require('vm'),assert=require('assert'),path=require('path');
const game=path.resolve(__dirname,'..');
const math=require(game+'/tools/_core_math_global.js');
const fast=fs.readFileSync(game+'/src/core/27_premises.js','utf8'),walk=fast.replace('for (const p of plotsAt(lx, lz)) if','for (const p of O.records.plots) if');
function load(source){const scope=vm.createContext({Math,CORE_MATH:math,module:{exports:{}},console,__checks:0});vm.runInContext(source.replace('function inPoly(poly, x, z) {','function inPoly(poly, x, z) { __checks++;'),scope);return {scope,PG:scope.module.exports};}
const A=load(fast),B=load(walk),world={id:'plotquery',terrainH:()=>-1,waterH:()=>0};
const box=(x,z,w=20)=>[[x,z],[x+w,z],[x+w,z+w],[x,z+w]];
const rec={seed:19,layers:{roads:[{id:'r',pts:[[-3000,0],[3000,0]],w:6,cls:'gravel'}],zones:[{id:'lawn',kind:'village',poly:box(-4000,-4000,8000),rules:{grass:{kind:'lawn',h:.2,density:.7}}},{id:'meadow',kind:'village',poly:box(-4000,-4000,8000),rules:{grass:{kind:'meadow'}}},{id:'bare',kind:'village',poly:box(-4000,-4000,8000),rules:{grass:{kind:'none'}}}]}};
const a=A.PG.compose(A.PG.normalise(rec),world,{raster:false,noPlace:true}),b=B.PG.compose(B.PG.normalise(rec),world,{raster:false,noPlace:true});
function same(x,y,label){if(x===null||y===null||typeof x!=='object'||typeof y!=='object'){assert(Object.is(x,y),label+': '+x+' vs '+y);return;}assert.deepStrictEqual(Object.keys(x),Object.keys(y));for(const k of Object.keys(x))same(x[k],y[k],label+'.'+k);}
let n=0;function check(points){for(const [x,z]of points){for(const pave of [undefined,false,true]){same(a.coverAt(x,z,pave),b.coverAt(x,z,pave),'cover '+x+','+z);n++;}assert(Object.is(a.terrainAt(x,z),b.terrainAt(x,z)));}}
let plots=Array.from({length:800},(_,i)=>({id:'p'+i,zone:i%3===0?'bare':'lawn',poly:box((i%40)*128-2560,Math.floor(i/40)*128-1280),side:'land'}));
plots.unshift({id:'water-first',zone:'lawn',side:'water',poly:box(-80,-80,30)},{id:'overlap-second',zone:'meadow',side:'land',poly:box(-80,-80,30)},{id:'concave',zone:'lawn',poly:[[0,30],[80,30],[80,50],[20,50],[20,100],[0,100]]},{id:'empty',zone:'lawn',poly:[]});
a.records.plots=plots;b.records.plots=plots;
const points=[[NaN,0],[Infinity,0],[-Infinity,0],[0,0],[-65,-65],[-50,-50],[10,80],[60,80]];
for(let i=0;i<plots.length;i+=3)for(const q of plots[i].poly||[])for(const d of [-1e-10,0,1e-10,1,64])points.push([q[0]+d,q[1]-d]);
check(points);
// Ground flags are live; changes in generated lists invalidate by identity/count.
const visible=a.coverAt(10,80,false);plots[2].noGround=true;check([[10,80],[-65,-65],[0,0]]);assert.notStrictEqual(JSON.stringify(visible),JSON.stringify(a.coverAt(10,80,false)),'live noGround changes the result');plots[2].noGround=false;const ordered=a.coverAt(-65,-65,false);
plots=plots.slice().reverse();a.records.plots=plots;b.records.plots=plots;check(points.slice(0,60));assert.notStrictEqual(JSON.stringify(ordered),JSON.stringify(a.coverAt(-65,-65,false)),'replacement list changes overlapping priority');
plots.push({zone:'lawn',poly:box(5000,5000)});check([[5001,5001]]);plots.pop();check([[5001,5001]]);
for(const poly of [[[0,0],[Infinity,0],[0,10]],[[0,0],[NaN,0],[0,10]],box(-1e9,-1e9,2e9),box(1e20,1e20,1e10)]){a.records.plots=[{zone:'lawn',poly}];b.records.plots=a.records.plots;check([[-1,0],[0,1],[1,1],[1e20,1e20]]);}
const rotated=JSON.parse(JSON.stringify(rec));rotated.frame={kind:'free',anchors:{'*':{x:123.7,z:-211.3,yaw:.73}}};const ra=A.PG.compose(A.PG.normalise(rotated),world,{raster:false,noPlace:true}),rb=B.PG.compose(B.PG.normalise(rotated),world,{raster:false,noPlace:true});ra.records.plots=plots;rb.records.plots=plots;for(const q of points.slice(8,1000)){const w=ra.frame.toWorld(q[0],q[1]);same(ra.coverAt(...w),rb.coverAt(...w),'rotated cover');n++;}
a.records.plots=plots;b.records.plots=plots;a.coverAt(0,0);b.coverAt(0,0);A.scope.__checks=0;B.scope.__checks=0;
for(let i=0;i<1000;i++){const x=(i%40)*128-2550,z=Math.floor(i%800/40)*128-1270;assert.strictEqual(JSON.stringify(a.coverAt(x,z,false)),JSON.stringify(b.coverAt(x,z,false)));}
const counts={indexed:A.scope.__checks,scan:B.scope.__checks};assert(counts.indexed*20<counts.scan,JSON.stringify(counts));
console.log('PLOTQUERY: PASS '+n+' exact public cover queries; polygon checks '+counts.indexed+' vs '+counts.scan);

console.log('GATE PLOTQUERY: PASS');
