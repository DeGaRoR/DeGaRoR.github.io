'use strict';
const assert=require('assert/strict'),T=require('../vendor/three.min'),SM=require('./flight_core').STRIP_MICRO,S=require('../src/viewer/pavement_static_cache'),P=require('../src/viewer/pavement');
let holes=0,hazards=0;const U={value:null},cache=S.create(T,U);
for(const width of [2,5,12,21,40])for(const len of [18,72,311.5,1200])for(const count of [0,1,3,4]){
 const f=SM.field({c:[0,0],hdg:0,len,wid:width},{chaos:.8,seed:41,hazards:count,holes:30,holeDepth:18,hazardSize:36},0),record=cache.register(f.seed,len,width/2,count);
 for(let i=0;i<Math.ceil(len/6);i++)for(let m=0;m<2;m++){
  const expected=f.hole(i,m),a=S.hole(f.seed,len,width/2,i,m),active=a[2][3]&&a[2][0]<f.pHole;
  assert.equal(!!active,!!expected,'Core and descriptor hole selection');if(!active)continue;
  const actual=[...a[0].slice(0,3),a[0][3]*.18,a[1][0],a[1][1],a[1][2],a[2][2],a[2][1]];
  actual.forEach((x,k)=>assert(Math.abs(x-expected[k])<1e-9,'Core hole parameter mismatch'));
  for(let k=0;k<3;k++)for(let c=0;c<4;c++){const stored=cache.data[(record[0]+4+(i*2+m)*3+k)*4+c];assert(Math.abs(stored-a[k][c])<.0001,'Float32 descriptor error');}holes++;
 }
 f.hazards.forEach((h,j)=>{const a=S.hazard(f.seed,len,width/2,count,j);a[3]*=.36;for(let k=0;k<4;k++)assert(Math.abs(a[k]-h[k])<1e-9,'Core hazard parameter mismatch');hazards++;});
}
const s=S.patch(P.GLSL.common);assert(s.includes('float fill)'));assert(s.includes('float rw = R / 3.14159265 * acos'),'Live fill-dependent shoreline retained');assert(s.includes('pmNoise(dd / R * 1.7'),'Irregular outline retained');assert(s.includes('D=uMicro.z*HA.w'),'Live wear depth retained');
console.log(JSON.stringify({holes,hazards,fields:cache.stats.fields,bytes:cache.stats.bytes,scope:'Descriptors compared with actual STRIP_MICRO hole/hazard geometry across80 fields; Float32 packing checked. Not GPU pixel acceptance.'}));U.value.dispose();
