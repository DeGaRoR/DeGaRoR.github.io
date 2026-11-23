'use strict';
const assert=require('assert/strict'),T=require('../vendor/three.min'),W=require('../src/viewer/pavement_way_cache'),P=require('../src/viewer/pavement');
const uniform={value:null},cache=W.create(T,uniform),seed=1234567,len=230,record=cache.register(seed,len),errors=[0,0,0,0];
assert.strictEqual(cache.register(seed,len),record,'Same field is reused');
for(let i=0;i<20000;i++){const u=(i*0.61803398875%1)*len,key=i%3,a=W.curve(u,key,seed),b=cache.sample(record,u,key);for(let k=0;k<4;k++)errors[k]=Math.max(errors[k],Math.abs(a[k]-b[k]));}
assert(errors[0]<.0003,'Lateral path drift below0.3mm');assert(errors[1]<.001,'Relative rut-depth factor error below0.1%');assert(errors[2]<.002&&errors[3]<.002,'Fine jitter drift below2mm');
const patched=W.patch(P.GLSL.common);assert(patched.includes('pvWayCurve(u,key)'));assert(!patched.includes('a1 * pmNoise(vec2(u / 60.0'));
assert(patched.includes('float rutsD = uMicro3.x;'),'Live rut depth retained');assert(patched.includes('float x = v - c - float(s) * W.x'),'Transverse shape retained');
assert.throws(()=>cache.register(seed,0),/bounds/);uniform.value.dispose();
console.log(JSON.stringify({samples:20000,maximumCurveErrors:errors,stats:cache.stats,scope:'CPU curve interpolation/half precision bounds only; not GPU pixel or game loading acceptance.'}));
