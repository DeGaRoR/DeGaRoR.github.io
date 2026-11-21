'use strict';
const assert=require('assert/strict'),{context}=require('./_terrain_memo_check');
const a=context(false),b=context(false,true);
for(const c of[a,b]){const base=c.baseH;c.baseCalls=0;c.wearCalls=0;c.level=0;c.delta=2;c.baseH=(x,z)=>{c.baseCalls++;return base(x,z);};c.PM.wearDelta=(x,z)=>{c.wearCalls++;return Math.abs(x)<20&&Math.abs(z)<20?c.level:null;};}
let checks=0;
for(const level of[0,1,-.25,2.75,.01]){a.level=b.level=level;for(let pass=0;pass<3;pass++)for(let z=-30;z<30;z+=2)for(let x=-30;x<30;x+=2){assert(Object.is(a.terrainH(x,z),b.terrainH(x,z)));checks++;}}
// Deliberate soil changes WITHOUT invalidation must still affect cached points.
for(const level of[3,-1,0]){a.level=b.level=level;assert(Object.is(a.terrainH(0,0),b.terrainH(0,0)));checks++;}
const beforeA=a.baseCalls,beforeB=b.baseCalls;
for(let i=0;i<1000;i++){a.level=b.level=i*.001;assert(Object.is(a.terrainH(0,0),b.terrainH(0,0)));checks++;}
assert.equal(a.baseCalls-beforeA,1000,'Original recomputes the weather strip base');
assert.equal(b.baseCalls-beforeB,0,'Cached weather base must be reused while soil changes');
assert(b.terrainMemoStats.cachedWearHits>1000);
// A premises/lake rebuild invalidates both tables through the existing hook.
for(const c of[a,b]){c.delta=9;c.LAKE_BED=true;c.terrainClear();}for(let x=-32;x<32;x++){assert(Object.is(a.terrainH(x,0),b.terrainH(x,0)));checks++;}
// Build-read lazy bypass keeps its exact old behavior and never consumes cache.
for(const c of[a,b]){c.buildDepth=1;c.lazy=true;}for(let x=-20;x<20;x++){assert(Object.is(a.terrainH(x,1),b.terrainH(x,1)));checks++;}
console.log(JSON.stringify({checks,bitIdentical:true,baseCalls:{original:a.baseCalls,cached:b.baseCalls},weatherBaseHits:b.terrainMemoStats.cachedWearHits}));
