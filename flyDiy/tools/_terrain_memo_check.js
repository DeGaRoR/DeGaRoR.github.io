'use strict';
// Exercise the actual cache/read functions with changing composition, lakes,
// non-cacheable weather relief, collisions and build-read bypasses.
const fs=require('fs'),vm=require('vm'),assert=require('assert');
const source=fs.readFileSync(require('path').join(__dirname,'../src/core/20_world.js'),'utf8');
function extract(name){const start=source.indexOf('  function '+name+'(');assert(start>=0);const end=source.indexOf('\n  }',start)+4;return source.slice(start,end);}
function context(legacy,wearMemo=false){const c={Math,Float64Array,Uint8Array,TH_N:16384,terrainHashLegacy:legacy,terrainWearMemo:wearMemo,thWear:null,terrainMemoStats:{hits:0,misses:0,wearReads:0,cachedWearHits:0},buildDepth:0,groundVer:0,thX:null,thZ:null,thH:null,delta:0,wet:false,lazy:false,wear:false};
 c.baseH=(x,z)=>Math.sin(x*.01)*5+z*.001;
 c.PM={rasterLazyAt:()=>c.lazy,terrainH:(x,z,h)=>h+c.delta,terrainFast:(x,z,h)=>h+c.delta,stonesAt:()=>.125,wearDelta:()=>c.wear?c.delta:null};
 c.LAKE_BED=null;c.wearScale=()=>1;c.lakeCarve=(x,z,h0,h)=>Math.min(h,-2+c.delta);
 vm.createContext(c);vm.runInContext(['terrainMemoIndex','terrainClear','terrainH'].map(extract).join('\n'),c);return c;}
const a=context(true),b=context(false);let checks=0;
for(const setting of [{},{delta:3},{delta:7,wear:true},{delta:9,wear:true},{delta:1,wear:false,LAKE_BED:true},{buildDepth:1,lazy:true},{buildDepth:0,lazy:false}]){
 Object.assign(a,setting);Object.assign(b,setting);a.terrainClear();b.terrainClear();
 for(let pass=0;pass<2;pass++)for(let z=-50;z<50;z++)for(let x=-50;x<50;x++){
  const X=x*2,Z=z*2;assert(Object.is(a.terrainH(X,Z),b.terrainH(X,Z)));checks++;
 }
}
assert(b.terrainMemoStats.hits>a.terrainMemoStats.hits+10000);
const oldSlots=new Set(),newSlots=new Set();for(let z=0;z<100;z++)for(let x=0;x<100;x++){oldSlots.add(a.terrainMemoIndex(x*2,z*2));newSlots.add(b.terrainMemoIndex(x*2,z*2));}
assert.equal(oldSlots.size,2);assert(newSlots.size>6000);
console.log(JSON.stringify({checks,bitIdentical:true,legacySlots:oldSlots.size,mixedSlots:newSlots.size,legacy:a.terrainMemoStats,mixed:b.terrainMemoStats}));
module.exports={context};
