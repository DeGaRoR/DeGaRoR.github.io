'use strict';
// Exact lattice coefficients, not rasterized colour or approximated heights.
// Weather, amplitude, curvature, normals and material blending remain live.
(function(root){
  const SCALES=[32,16,8,4,2,1,3.5,1.8],OFFSETS=[101,102,103,104,105,106,301,302];
  function hash(x,y,s){let h=(Math.imul(x|0,0x27d4eb2d)^Math.imul(y|0,0x165667b1)^Math.imul(s|0,0x2f6b4c13))>>>0;h=Math.imul(h^(h>>>15),0x2c1b3c6d)>>>0;h=Math.imul(h^(h>>>12),0x297a2d39)>>>0;return ((h^(h>>>15))>>>8)/16777216;}
  function rects(len,halfW){if(!(Number.isFinite(len)&&len>0&&Number.isFinite(halfW)&&halfW>0))throw Error('Invalid micro-noise field bounds');return SCALES.map(scale=>{const x0=Math.floor(-2/scale)-2,y0=Math.floor((-halfW-2)/scale)-2,x1=Math.ceil((len+2)/scale)+2,y1=Math.ceil((halfW+2)/scale)+2;return {x0,y0,w:x1-x0+1,h:y1-y0+1};});}
  function create(THREE,uniform,options){
    const width=1024,maxTexels=(options&&options.maxTexels)||4194304,entries=new Map(),ranges=new Map();
    let data=new Float32Array(width*4),used=0,texture=null,valid=true;
    const stats={fields:0,texels:0,capacityBytes:0,bakeMs:0,fallback:null};
    const upload=()=>{if(texture)texture.dispose();texture=new THREE.DataTexture(data,width,data.length/(width*4),THREE.RGBAFormat,THREE.FloatType);texture.minFilter=texture.magFilter=THREE.NearestFilter;texture.generateMipmaps=false;texture.flipY=false;texture.name='pavement:exact-noise-coefficients';texture.needsUpdate=true;uniform.value=texture;stats.capacityBytes=data.byteLength;};
    const reserve=n=>{if(used+n>maxTexels)throw Error('Micro-noise cache exceeds '+maxTexels*16+' bytes');if((used+n)*4>data.length){let count=data.length/4;while(count<used+n)count*=2;count=Math.min(count,maxTexels);const next=new Float32Array(count*4);next.set(data);data=next;upload();}const p=used;used+=n;return p;};
    upload();
    function register(seed,len,halfW){
      if(!valid)return -1;
      seed=Math.trunc(Math.fround(Math.fround(seed)+.5));
      const key=[seed,len,halfW].join('|');if(entries.has(key))return entries.get(key);
      const before=typeof performance!=='undefined'?performance.now():Date.now();
      try{const bounds=rects(len,halfW);const count=8+bounds.reduce((n,b)=>n+b.w*b.h,0);if(used+count>maxTexels)throw Error('Micro-noise cache budget exceeded');
        const header=reserve(8);
        bounds.forEach((b,k)=>{const base=reserve(b.w*b.h);data.set([base,b.x0,b.y0,b.w],(header+k)*4);const s=(seed+OFFSETS[k])|0;
          for(let y=0;y<b.h;y++)for(let x=0;x<b.w;x++){const o=(base+y*b.w+x)*4,ix=x+b.x0,iy=y+b.y0;data[o]=hash(ix,iy,s);data[o+1]=hash(ix+1,iy,s);data[o+2]=hash(ix,iy+1,s);data[o+3]=hash(ix+1,iy+1,s);}
        });
        texture.needsUpdate=true;entries.set(key,header);ranges.set(header,bounds);stats.fields=entries.size;stats.texels=used;stats.bakeMs+=(typeof performance!=='undefined'?performance.now():Date.now())-before;return header;
      }catch(e){valid=false;stats.fallback=String(e.message||e);if(texture)texture.dispose();texture=null;uniform.value=null;data=new Float32Array(0);stats.capacityBytes=0;return -1;}
    }
    function sample(header,layer,x,y){const o=(header+layer)*4,base=data[o],x0=data[o+1],y0=data[o+2],w=data[o+3],ix=Math.floor(x),iy=Math.floor(y),r=ranges.get(header)[layer];
      if(ix<x0||iy<y0||ix>=x0+w||iy>=y0+r.h)throw Error('Noise cache sample outside field');
      const a=(base+(iy-y0)*w+ix-x0)*4;let fx=x-ix,fy=y-iy;fx=fx*fx*(3-2*fx);fy=fy*fy*(3-2*fy);const A=data[a],B=data[a+1],C=data[a+2],D=data[a+3];return 2*((A+(B-A)*fx)+((C+(D-C)*fx)-(A+(B-A)*fx))*fy)-1;}
    return {register,sample,stats,get valid(){return valid;},get texture(){return texture;},get data(){return data;},dispose(){if(texture)texture.dispose();}};
  }
  const GLSL=`
uniform highp sampler2D uPavNoise;
uniform vec4 uMicroCache;
int gMicroHeader;
vec4 pvNoiseTexel(int i){int w=textureSize(uPavNoise,0).x;return texelFetch(uPavNoise,ivec2(i%w,i/w),0);}
float pvCachedNoise(vec2 p,int layer){
  vec2 i=floor(p),f=p-i;f=f*f*(3.0-2.0*f);
  vec4 R=pvNoiseTexel(gMicroHeader+layer);
  int index=int(R.x+0.5)+(int(i.y)-int(R.z))*int(R.w+0.5)+int(i.x)-int(R.y);
  vec4 C=pvNoiseTexel(index);
  float a=C.x,b=C.y,c=C.z,d=C.w;
  return 2.0*((a+(b-a)*f.x)+((c+(d-c)*f.x)-(a+(b-a)*f.x))*f.y)-1.0;
}
`;
  function patch(common){const changes=[
    ['pmNoise(vec2(u, v) / lam, sd + 101 + k)','pvCachedNoise(vec2(u, v) / lam, k)'],
    ['pmNoise(q / lam, sd + 101 + k)','pvCachedNoise(q / lam, k)'],
    ['pmNoise(vec2(u, v) / 3.5, sd + 301)','pvCachedNoise(vec2(u, v) / 3.5, 6)'],
    ['pmNoise(vec2(u, v) / 1.8, sd + 302)','pvCachedNoise(vec2(u, v) / 1.8, 7)'],
    ['pmNoise(q / 1.8, sd + 302)','pvCachedNoise(q / 1.8, 7)'],
    ['pmNoise(q / 3.5, sd + 301)','pvCachedNoise(q / 3.5, 6)']
  ];for(const [a,b]of changes){if(common.split(a).length!==2)throw Error('Micro-noise source boundary changed: '+a);common=common.replace(a,b);}return GLSL+common;}
  const api={create,hash,rects,patch,GLSL,SCALES,OFFSETS};if(typeof module!=='undefined'&&module.exports)module.exports=api;root.PAVEMENT_NOISE_CACHE=api;
})(typeof window!=='undefined'?window:globalThis);
