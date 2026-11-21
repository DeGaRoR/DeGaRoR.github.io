// Experimental higher-level runway relief/curvature bake. Opt-in; original contact geometry is untouched.
// Four packed fields, one sampler. Unit bases keep wear/weather amplitudes live.
(function(root){
  'use strict';
  function hash(x,y,s){let h=(Math.imul(x|0,0x27d4eb2d)^Math.imul(y|0,0x165667b1)^Math.imul(s|0,0x2f6b4c13))>>>0;h=Math.imul(h^(h>>>15),0x2c1b3c6d)>>>0;h=Math.imul(h^(h>>>12),0x297a2d39)>>>0;return ((h^(h>>>15))>>>8)/16777216;}
  function noise(x,y,s){const ix=Math.floor(x),iy=Math.floor(y);let fx=x-ix,fy=y-iy;fx*=fx*(3-2*fx);fy*=fy*(3-2*fy);const a=hash(ix,iy,s),b=hash(ix+1,iy,s),c=hash(ix,iy+1,s),d=hash(ix+1,iy+1,s);return 2*((a+(b-a)*fx)+((c+(d-c)*fx)-(a+(b-a)*fx))*fy)-1;}
  function create(THREE,U){
    const width=8192,step=.25,entries=new Map();let x=0,y=0,shelf=0,height=64,data=new Uint16Array(width*height*4),texture;
    const stats={fields:0,bakeMs:0,bytes:0,step,approximation:'Bilinearly filtered quarter-metre unit relief/curvature fields; image acceptance required'};
    function upload(){if(texture)texture.dispose();texture=new THREE.DataTexture(data,width,height,THREE.RGBAFormat,THREE.HalfFloatType);texture.minFilter=texture.magFilter=THREE.LinearFilter;texture.generateMipmaps=false;texture.flipY=false;texture.name='pavement:unit-shape-fields';texture.needsUpdate=true;U.value=texture;stats.bytes=data.byteLength;}
    upload();
    function register(seed,len,hw){
      seed=Math.floor(Math.fround(seed)+.5);const key=[seed,len,hw].join('|');if(entries.has(key))return entries.get(key);
      const t=performance.now(),w=Math.ceil((len+4)/step)+1,h=Math.ceil((2*hw+4)/step)+1;
      if(w>width)throw Error('Runway field exceeds width budget');if(x+w>width){x=0;y+=shelf;shelf=0;}
      const needed=y+4*h;if(needed>4096)throw Error('Runway field exceeds 256 MiB budget');
      if(needed>height){while(height<needed)height*=2;const next=new Uint16Array(width*height*4);next.set(data);data=next;upload();}
      const ox=x,oy=y;x+=w;shelf=Math.max(shelf,4*h);
      const n=w*h,raw=Array.from({length:7},()=>new Float32Array(n));
      for(let j=0;j<h;j++)for(let i=0;i<w;i++){
        const u=i*step-2,v=j*step-hw-2,k=j*w+i;let full=0,fine=0,medium=0;
        for(let o=0;o<6;o++){const lam=32/2**o,a=Math.sqrt(lam)*noise(u/lam,v/lam,seed+101+o);full+=a;if(o>=4)fine+=a;if(o===2||o===3)medium+=a;}
        raw[0][k]=fine;raw[1][k]=medium;raw[2][k]=full;
        raw[3][k]=.35*noise(u/1.8,v/1.8,seed+302);raw[4][k]=.65*noise(u/3.5,v/3.5,seed+301);
        raw[5][k]=raw[3][k]+raw[4][k];raw[6][k]=.7*noise(u/25,v/25,seed+201)+.3*noise(u/12,v/12,seed+202);
      }
      const half=THREE.DataUtils.toHalfFloat;
      for(let j=0;j<h;j++)for(let i=0;i<w;i++){
        const k=j*w+i,curv=(r,d)=>{const xp=r[j*w+Math.min(w-1,i+d)],xm=r[j*w+Math.max(0,i-d)],yp=r[Math.min(h-1,j+d)*w+i],ym=r[Math.max(0,j-d)*w+i];return [r[k]-.25*(xp+xm+yp+ym),(xp-xm)/(2*d*step),-(yp-ym)/(2*d*step)];};
        const f=curv(raw[0],1),m=curv(raw[1],4),lf=curv(raw[3],1),lm=curv(raw[4],4);
        const values=[[f[0],m[0],raw[2][k],raw[6][k]],[f[1],f[2],m[1],m[2]],[lf[0],lm[0],raw[5][k],0],[lf[1],lf[2],lm[1],lm[2]]];
        for(let layer=0;layer<4;layer++){const at=((oy+layer*h+j)*width+ox+i)*4;for(let c=0;c<4;c++)data[at+c]=half(values[layer][c]);}
      }
      texture.needsUpdate=true;const rect=[ox,oy,w,h];entries.set(key,rect);stats.fields=entries.size;stats.bakeMs+=performance.now()-t;return rect;
    }
    return {register,stats};
  }
  function replaceBody(s,name,body){const re=new RegExp('float '+name+'\\([^)]*\\)\\s*\\{'),m=re.exec(s);if(!m)throw Error('Missing field anchor '+name);const start=s.indexOf('{',m.index);let depth=1,end=start+1;for(;depth&&end<s.length;end++){if(s[end]==='{')depth++;if(s[end]==='}')depth--;}if(depth)throw Error('Unbalanced field anchor');return s.slice(0,start+1)+body+s.slice(end-1);}
  const prefix=`
uniform highp sampler2D uPavField;
uniform vec4 uMicroField;
vec4 gFieldA, gFieldB, gFieldC, gFieldD;
void pvReadFields(float u,float v,float halfW){
  vec2 p=(vec2(u+2.0,v+halfW+2.0)*4.0+uMicroField.xy+0.5)/vec2(textureSize(uPavField,0));
  float dh=uMicroField.w/float(textureSize(uPavField,0).y);
  gFieldA=texture2D(uPavField,p);gFieldB=texture2D(uPavField,p+vec2(0.0,dh));
  gFieldC=texture2D(uPavField,p+vec2(0.0,2.0*dh));gFieldD=texture2D(uPavField,p+vec2(0.0,3.0*dh));
}
`;
  function common(s){const split=prefix.indexOf('void pvReadFields');return prefix.slice(0,split)+replaceBody(s,'pvRelief',`
    if(u<=0.0||u>=len||abs(v)>=halfW)return 0.0;
    float eT=smoothstep(0.0,4.0,u)*smoothstep(0.0,4.0,len-u),dT=smoothstep(0.5,2.5,halfW-abs(v));
    float r=0.0;if(uMicro2.x>0.0)r=dT*(uMicro2.x*gFieldA.z+max(0.0,uMicro2.w-1.0)*gFieldA.w+uMicro3.y*gFieldC.z-holes.x);
    return (r+smoothstep(0.0,0.5,halfW-abs(v))*holes.w)*eT;
  `)+prefix.slice(split);}
  function map(s){
    const start=s.indexOf('if (kF > 0.01) {');
    // Use the following comment as a stable boundary; cF/cM clamp may share a line across revisions.
    const boundary=s.indexOf('// THE WAYS, READ',start);
    if(start<0||boundary<start)throw Error('Missing curvature field anchors');
    // Preserve processing after the two band-stencil blocks (clamps, colours and normals).
    let at=start,depth=0,blocks=0;for(;at<boundary;at++){if(s[at]==='{')depth++;if(s[at]==='}'&&--depth===0){blocks++;if(blocks===2){at++;break;}}}
    if(blocks!==2)throw Error('Curvature stencil identity changed');
    s=s.slice(0,start)+`          if(kF>0.01){cF=(uMicro2.x*gFieldA.x+uMicro3.y*gFieldC.x)/(0.55*a1+0.03*uMicro3.y);gR+=kF*(uMicro2.x*gFieldB.xy+uMicro3.y*gFieldD.xy);}
          if(kM>0.01){cM=(uMicro2.x*gFieldA.y+uMicro3.y*gFieldC.y)/(0.9*a1+0.17*uMicro3.y);gR+=0.5*kM*(uMicro2.x*gFieldB.zw+uMicro3.y*gFieldD.zw);}
`+s.slice(at);
    const anchor='if (uMicro2.w > 0.5 && !grassy) {';if(s.split(anchor).length!==2)throw Error('Missing micro field read anchor');
    return s.replace(anchor,anchor+'\n        pvReadFields(u,-v,halfW);');
  }
  const api={create,common,map,noise};root.PAVEMENT_FIELD_CACHE=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
