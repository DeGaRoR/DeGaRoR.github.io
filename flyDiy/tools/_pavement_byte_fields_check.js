'use strict';
const assert=require('assert/strict'),T=require('../vendor/three.min'),F=require('../src/viewer/pavement_field_cache'),P=require('../src/viewer/pavement');
const A={value:null},B={value:null},half=F.create(T,A),byte=F.create(T,B,{bytes:true});let checked=0,maxError=0;
for(const [seed,len,hw]of [[48527,24,3],[8932,31.5,10.5],[56446,37,4.5]]){
 const a=half.register(seed,len,hw),b=byte.register(seed,len,hw);assert.deepEqual(a,b);
 for(let l=0;l<4;l++)for(let j=0;j<a[3];j++)for(let i=0;i<a[2];i++)for(let c=0;c<4;c++){
  const at=((a[1]+l*a[3]+j)*8192+a[0]+i)*4+c,r=F.RANGES[l][c],x=T.DataUtils.fromHalfFloat(A.value.image.data[at]),y=(B.value.image.data[at]/255*2-1)*r;
  const error=Math.abs(x-y);assert(error<=r/255+Math.abs(x)*.001+1e-5,'Quantization within declared half-step plus HalfFloat rounding');maxError=Math.max(maxError,error);checked++;
 }
}
assert.equal(B.value.type,T.UnsignedByteType);assert.equal(byte.stats.bytes,half.stats.bytes/2);assert(F.common(P.GLSL.common,{bytes:true}).includes('gFieldA=(gFieldA*2.0-1.0)'));
console.log(JSON.stringify({checked,maxError,half:half.stats,byte:byte.stats,scope:'Bounded quantization/packing check; live field coefficients remain separate. Image acceptance required.'}));A.value.dispose();B.value.dispose();
