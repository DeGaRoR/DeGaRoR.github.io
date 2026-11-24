'use strict';
const fs=require('fs'),vm=require('vm'),assert=require('assert'),C=require('../src/viewer/pavement_noise_cache.js');
const scope={Math};vm.createContext(scope);vm.runInContext(fs.readFileSync(require('path').join(__dirname,'../src/core/26b_strip_micro.js'),'utf8')+';globalThis.micro=STRIP_MICRO;',scope);
const M=scope.micro,T={DataTexture:class{constructor(data,w,h){this.image={data,width:w,height:h};}dispose(){this.disposed=true;}},RGBAFormat:1,FloatType:2,NearestFilter:3};
let state=123456;const random=()=>((state=(Math.imul(state,1664525)+1013904223)>>>0)/4294967296);
for(let i=0;i<20000;i++){const x=(random()*10000-5000)|0,y=(random()*10000-5000)|0,s=(random()*0xffffffff)|0;assert.strictEqual(C.hash(x,y,s),M.ih(x,y,s));}
let checks=0;const uniform={value:null},cache=C.create(T,uniform);
for(const [seed,len,hw]of[[17,120,8],[83211,600,22]]){const header=cache.register(seed,len,hw);assert(header>=0);assert.equal(cache.register(seed,len,hw),header);
 for(let k=0;k<8;k++)for(let n=0;n<5000;n++){
  const x=(-1+random()*(len+2))/C.SCALES[k],y=(-hw-1+random()*(2*hw+2))/C.SCALES[k];
  assert.strictEqual(cache.sample(header,k,x,y),M.vnoise(x,y,seed+C.OFFSETS[k]));checks++;
 }
}
assert(cache.valid);assert.equal(cache.stats.fields,2);assert(uniform.value);assert.throws(()=>cache.sample(0,0,-1e6,0));
const failUniform={value:null},small=C.create(T,failUniform,{maxTexels:1024});assert.equal(small.register(1,10000,100),-1);assert(!small.valid);assert.equal(failUniform.value,null);assert.equal(small.stats.capacityBytes,0);
const src=fs.readFileSync(require('path').join(__dirname,'../src/viewer/pavement.js'),'utf8');const c={module:{exports:{}},location:{search:''},console};vm.createContext(c);vm.runInContext(src,c);const patched=C.patch(c.module.exports.GLSL.common);assert(patched.includes('pvCachedNoise(q / lam, k)'));assert(patched.includes('pmNoise(vec2(u, v) / 25.0, sd + 201)'));assert(patched.includes('pmNoise(dd / R'));assert(patched.includes('float pmH('));assert.throws(()=>C.patch('missing blocks'));
console.log(JSON.stringify({hashChecks:20000,exactNoiseSamples:checks,fields:cache.stats.fields,capacityBytes:cache.stats.capacityBytes,bakeMs:cache.stats.bakeMs,weatherAndMaterialMathRetained:true,budgetFallback:true}));
