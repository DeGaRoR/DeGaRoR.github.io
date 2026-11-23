// Experimental one-dimensional runway way curves. No contact geometry is changed.
// Retain analytic transverse troughs/berms and live rut depth, mud and water.
(function(root) {
  'use strict';
  const STEP = .125;
  function hash(x,y,s) { let h=(Math.imul(x|0,0x27d4eb2d)^Math.imul(y|0,0x165667b1)^Math.imul(s|0,0x2f6b4c13))>>>0;h=Math.imul(h^(h>>>15),0x2c1b3c6d)>>>0;h=Math.imul(h^(h>>>12),0x297a2d39)>>>0;return ((h^(h>>>15))>>>8)/16777216; }
  function noise(x,y,s) { const ix=Math.floor(x),iy=Math.floor(y);let fx=x-ix,fy=y-iy;fx*=fx*(3-2*fx);fy*=fy*(3-2*fy);const a=hash(ix,iy,s),b=hash(ix+1,iy,s),c=hash(ix,iy+1,s),d=hash(ix+1,iy+1,s);return 2*((a+(b-a)*fx)+((c+(d-c)*fx)-(a+(b-a)*fx))*fy)-1; }
  function curve(u,key,seed) {
    const a1=key===1?.25:.30,a2=key===1?.06:key===2?.10:.08;
    return [a1*noise(u/60,key,seed+411)+a2*noise(u/15,key,seed+421),
      .75+.25*noise(u/9,key+3,seed+431),
      .03*noise(u/.7,key*2-1,seed+441),.03*noise(u/.7,key*2+1,seed+441)];
  }
  function create(THREE,uniform) {
    const width=1024,entries=new Map();let used=0,data=new Uint16Array(width*4),texture;
    const stats={fields:0,texels:0,bytes:0,bakeMs:0,step:STEP,approximation:'Half-float longitudinal curve samples at 0.125m; transverse track shape stays analytic. Visual acceptance pending.'};
    function upload() { if(texture)texture.dispose();texture=new THREE.DataTexture(data,width,data.length/(width*4),THREE.RGBAFormat,THREE.HalfFloatType);texture.minFilter=texture.magFilter=THREE.NearestFilter;texture.generateMipmaps=false;texture.flipY=false;texture.name='pavement:way-curves';texture.needsUpdate=true;uniform.value=texture;stats.bytes=data.byteLength; }
    upload();
    function register(seed,len) {
      if(!Number.isFinite(seed)||!Number.isFinite(len)||len<=0)throw Error('Invalid way-curve bounds');
      seed=Math.trunc(Math.fround(Math.fround(seed)+.5));const key=seed+'|'+len;
      if(entries.has(key))return entries.get(key);
      const t=performance.now(),n=Math.ceil((len+2)/STEP)+1,base=used,needed=used+n*3;
      if(needed>2097152)throw Error('Way-curve cache exceeds 16MiB GPU budget');
      if(needed*4>data.length){let size=data.length/4;while(size<needed)size*=2;const next=new Uint16Array(size*4);next.set(data);data=next;upload();}
      for(let i=0;i<n;i++)for(let k=0;k<3;k++){const values=curve(i*STEP-1,k,seed),at=(base+i*3+k)*4;for(let c=0;c<4;c++)data[at+c]=THREE.DataUtils.toHalfFloat(values[c]);}
      used=needed;texture.needsUpdate=true;const record=[base,n,STEP,len];entries.set(key,record);stats.fields=entries.size;stats.texels=used;stats.bakeMs+=performance.now()-t;return record;
    }
    function sample(record,u,key) { const f=Math.max(0,Math.min(record[1]-1,(u+1)/STEP)),i=Math.floor(f),j=Math.min(record[1]-1,i+1),a=(record[0]+i*3+key)*4,b=(record[0]+j*3+key)*4;return Array.from({length:4},(_,c)=>{const x=THREE.DataUtils.fromHalfFloat(data[a+c]),y=THREE.DataUtils.fromHalfFloat(data[b+c]);return x+(y-x)*(f-i);}); }
    return {register,sample,stats,get data(){return data;},get texture(){return texture;}};
  }
  const GLSL=`
uniform highp sampler2D uPavWays;
uniform vec4 uMicroWay;
vec4 pvWayTexel(int at){int w=textureSize(uPavWays,0).x;return texelFetch(uPavWays,ivec2(at%w,at/w),0);}
vec4 pvWayCurve(float u,int key){
  float f=clamp((u+1.0)*8.0,0.0,uMicroWay.y-1.0);int i=int(f),j=min(i+1,int(uMicroWay.y)-1),base=int(uMicroWay.x);
  return mix(pvWayTexel(base+i*3+key),pvWayTexel(base+j*3+key),fract(f));
}
`;
  function patch(source) {
    const anchor='vec4 pvWays(float u, float v, float halfW, int sd) {';
    if(source.split(anchor).length!==2)throw Error('Way-curve function identity changed');
    source=source.replace(anchor,GLSL+anchor);
    const changes=[
      ['float c = c0 + a1 * pmNoise(vec2(u / 60.0, float(key)), sd + 411) + a2 * pmNoise(vec2(u / 15.0, float(key)), sd + 421);','vec4 wayCurve = pvWayCurve(u,key);\n    float c = c0 + wayCurve.x;'],
      ['float dep = W.z * (0.75 + 0.25 * pmNoise(vec2(u / 9.0, float(key + 3)), sd + 431));','float dep = W.z * wayCurve.y;'],
      ['0.03 * pmNoise(vec2(u / 0.7, float(key * 2 + s)), sd + 441)','(s < 0 ? wayCurve.z : wayCurve.w)']
    ];
    for(const [a,b]of changes){if(source.split(a).length!==2)throw Error('Way-curve source boundary changed: '+a);source=source.replace(a,b);}
    return source;
  }
  const api={STEP,hash,noise,curve,create,patch,GLSL};root.PAVEMENT_WAY_CACHE=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
