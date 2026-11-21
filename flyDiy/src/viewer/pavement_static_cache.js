// Experimental static hole/hazard descriptors, rather than a raster of the runway.
// Analytic outlines, live hole depth, water fill and damp rings remain in the shader.
(function(root) {
  'use strict';
  function hash(x,y,s){let h=(Math.imul(x|0,0x27d4eb2d)^Math.imul(y|0,0x165667b1)^Math.imul(s|0,0x2f6b4c13))>>>0;h=Math.imul(h^(h>>>15),0x2c1b3c6d)>>>0;h=Math.imul(h^(h>>>12),0x297a2d39)>>>0;return ((h^(h>>>15))>>>8)/16777216;}
  const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
  function hole(seed,len,hw,i,m) {
    const R=.5+.6*hash(i,m,seed+12),hu=(i+.15+.7*hash(i,m,seed+13))*6;
    const ea=1+1.2*hash(i,m,seed+18),th=(hash(i,m,seed+19)-.5)*1.05,c=Math.cos(th),s=Math.sin(th);
    const eV=R*Math.sqrt(ea*ea*s*s+c*c),eU=R*Math.sqrt(ea*ea*c*c+s*s),lim=hw-2.5-eV;
    let hv=hash(i,m,seed+14)<.667?(hash(i,m,seed+15)<.5?-1:1)*1.098+(hash(i,m,seed+16)-.5)*2*(.35+.05*hw):(hash(i,m,seed+16)-.5)*2*lim;
    hv=clamp(hv,-lim,lim);
    return [[hu,hv,R,.5+.5*hash(i,m,seed+17)],[ea,c,s,0],[hash(i,m,seed+11),eU,eV,lim>0&&hu>=4+eU&&hu<=len-4-eU?1:0]];
  }
  function hazard(seed,len,hw,count,j) {
    let R=1.5+1.5*hash(j,0,seed+32);const room=hw-.8-2*R;if(room<0)R=(hw-.8)/2;if(R<.6)return [0,0,0,0];
    const aspect=1+.6*hash(j,0,seed+37),hu=clamp(len*(.05+.9*(j+.2+.6*hash(j,0,seed+31))/Math.max(count,1e-30)),4+aspect*R,len-4-aspect*R);
    const hv=(hash(j,0,seed+35)<.5?-1:1)*(.3+R+Math.max(0,room)*hash(j,0,seed+36));
    return [hu,hv,R,(.7+.3*hash(j,0,seed+34))*(hash(j,0,seed+33)<.6?1:-1)];
  }
  function create(THREE,uniform) {
    const width=256,entries=new Map();let used=0,data=new Float32Array(width*4),texture;
    const stats={fields:0,bytes:0,bakeMs:0,texels:0,approximation:'Float32 static descriptors; shader keeps analytic outlines and wet response. GPU parity pending.'};
    function upload(){if(texture)texture.dispose();texture=new THREE.DataTexture(data,width,data.length/(width*4),THREE.RGBAFormat,THREE.FloatType);texture.minFilter=texture.magFilter=THREE.NearestFilter;texture.generateMipmaps=false;texture.flipY=false;texture.name='pavement:hole-descriptors';texture.needsUpdate=true;uniform.value=texture;stats.bytes=data.byteLength;}
    upload();
    function register(seed,len,hw,count){
      if(![seed,len,hw,count].every(Number.isFinite)||len<=0||hw<=0)throw Error('Invalid static runway descriptor');
      seed=Math.trunc(Math.fround(Math.fround(seed)+.5));const key=[seed,len,hw,count].join('|');if(entries.has(key))return entries.get(key);
      const t=performance.now(),cells=Math.ceil(len/6),base=used,needed=base+4+cells*6;
      if(needed>1048576)throw Error('Static runway descriptors exceed16MiB');
      if(needed*4>data.length){let n=data.length/4;while(n<needed)n*=2;const next=new Float32Array(n*4);next.set(data);data=next;upload();}
      for(let j=0;j<4;j++)data.set(hazard(seed,len,hw,count,j),(base+j)*4);
      for(let i=0;i<cells;i++)for(let m=0;m<2;m++){const rows=hole(seed,len,hw,i,m);for(let k=0;k<3;k++)data.set(rows[k],(base+4+(i*2+m)*3+k)*4);}
      used=needed;texture.needsUpdate=true;const record=[base,cells,0,0];entries.set(key,record);stats.fields=entries.size;stats.texels=used;stats.bakeMs+=performance.now()-t;return record;
    }
    return {register,stats,get data(){return data;}};
  }
  const GLSL=`
uniform highp sampler2D uPavStatic;
uniform vec4 uMicroStatic;
vec4 pvStaticTexel(int at){int w=textureSize(uPavStatic,0).x;return texelFetch(uPavStatic,ivec2(at%w,at/w),0);}
vec4 pvHoleData(int i,int m,int layer){if(i<0||i>=int(uMicroStatic.y))return vec4(0.0);return pvStaticTexel(int(uMicroStatic.x)+4+(i*2+m)*3+layer);}
`;
  function patch(source){
    const a=source.indexOf('vec4 pvHazard('),b=source.indexOf('{',a);if(a<0)throw Error('Static hazard source anchor changed');
    let depth=1,e=b+1;for(;depth&&e<source.length;e++){if(source[e]==='{')depth++;if(source[e]==='}')depth--;}if(depth)throw Error('Unbalanced hazard function');
    source=source.slice(0,a)+GLSL+source.slice(a,b+1)+'vec4 H=pvStaticTexel(int(uMicroStatic.x)+j);return vec4(H.xyz,H.w*uMicro2.z);'+source.slice(e-1);
    const start=source.indexOf('        if (pmH(i, m, sd + 11) >= uMicro.y) continue;'),end=source.indexOf('        vec2 dd = vec2(u - hu, v - hv);',start);
    if(start<0||end<start)throw Error('Static hole source anchor changed');
    return source.slice(0,start)+`        vec4 HC=pvHoleData(i,m,2);if(HC.w<0.5||HC.x>=uMicro.y)continue;
        vec4 HA=pvHoleData(i,m,0),HB=pvHoleData(i,m,1);
        float hu=HA.x,hv=HA.y,R=HA.z,D=uMicro.z*HA.w,ea=HB.x,cth=HB.y,sth=HB.z,eU=HC.y,eV=HC.z;
`+source.slice(end);
  }
  const api={hash,hole,hazard,create,patch,GLSL};root.PAVEMENT_STATIC_CACHE=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
