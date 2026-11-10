// The pocket GLSL (forest_mist.js FMIST.GLSL + atmo's mistVN) run on SwiftShader against the CPU mirror, point by point.
global.location={search:'?fmist=c'}; const F=require('/workspace/DeGaRoR.github.io/flyDiy/src/viewer/forest_mist.js');
const W=require(process.argv[2]+'/jolene.js')(); const m=F.bakeMap(W,512);
const { chromium } = require('playwright');
const NW=2048, NH=546, X0=768, Y0=34, N=512;
const atlas=new Float32Array(NW*NH*4); for(let j=0;j<N;j++) for(let i=0;i<N;i++) for(let c=0;c<4;c++) atlas[((Y0+j)*NW+X0+i)*4+c]=m.px[(j*N+i)*4+c];
// sample points: a 64x64 grid over 3 km round the slope, at the canopy top + h
const G=64, pts=[]; const cx=-1500, cz=-18300;
for(let j=0;j<G;j++) for(let i=0;i<G;i++){ const x=cx+(i/G-0.5)*3000, z=cz+(j/G-0.5)*3000; const ii=Math.floor((x-m.x0)*m.inv*N), jj=Math.floor((z-m.z0)*m.inv*N); const top=m.px[(jj*N+ii)*4]; pts.push([x, top+6, z]); }
const k=[1,1,0];
const cpu=pts.map(p=>F.densCPU(m,k,1e4,[0,0],p[0],p[1],p[2])/F.S.rhoMax);
const mistVN=`float mistH21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }
 float mistVN(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(mistH21(i), mistH21(i + vec2(1.0, 0.0)), f.x), mix(mistH21(i + vec2(0.0, 1.0)), mistH21(i + vec2(1.0, 1.0)), f.x), f.y); }`;
const glsl=F.GLSL(NW,NH,Y0).replace(/texture2D\(/g,'texture(');
const L=new Float32Array(52); L[28]=1;L[29]=1;L[30]=0;L[31]=1e4; L[32]=0;L[33]=0;L[34]=1;L[35]=1; L[36]=m.x0;L[37]=m.z0;L[38]=m.inv;L[39]=1/F.S.period; L[46]=F.S.flat?1:0;
const fs=`#version 300 es
precision highp float; precision highp sampler2D;
uniform sampler2D uApAtlas; uniform vec4 uMist[13]; uniform sampler2D uPts; out vec4 o;
${mistVN}
${glsl}
void main(){ ivec2 c=ivec2(gl_FragCoord.xy); vec3 p=texelFetch(uPts,c,0).xyz; o=vec4(fmDens(p),0.0,0.0,1.0); }`;
(async()=>{
  const b=await chromium.launch({args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
  const pg=await b.newPage(); await pg.setContent('<canvas id=c width=64 height=64></canvas>');
  const res=await pg.evaluate(({fs,atlas,pts,L,NW,NH,G})=>{
    const gl=document.getElementById('c').getContext('webgl2'); gl.getExtension('EXT_color_buffer_float');
    const sh=(t,s)=>{const o=gl.createShader(t); gl.shaderSource(o,s); gl.compileShader(o); if(!gl.getShaderParameter(o,gl.COMPILE_STATUS)) throw gl.getShaderInfoLog(o); return o;};
    const pr=gl.createProgram(); gl.attachShader(pr,sh(gl.VERTEX_SHADER,'#version 300 es\nin vec2 a; void main(){gl_Position=vec4(a,0,1);}')); gl.attachShader(pr,sh(gl.FRAGMENT_SHADER,fs)); gl.linkProgram(pr); gl.useProgram(pr);
    const tex=(w,h,d,u)=>{gl.activeTexture(gl.TEXTURE0+u); const t=gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D,t); gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA32F,w,h,0,gl.RGBA,gl.FLOAT,new Float32Array(d)); gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST); return t;};
    tex(NW,NH,atlas,0); const P=new Float32Array(G*G*4); pts.forEach((p,i)=>{P[i*4]=p[0];P[i*4+1]=p[1];P[i*4+2]=p[2];}); tex(G,G,P,1);
    gl.uniform1i(gl.getUniformLocation(pr,'uApAtlas'),0); gl.uniform1i(gl.getUniformLocation(pr,'uPts'),1); gl.uniform4fv(gl.getUniformLocation(pr,'uMist'),new Float32Array(L));
    const fb=gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER,fb); const rt=gl.createTexture(); gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D,rt); gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA32F,G,G,0,gl.RGBA,gl.FLOAT,null); gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,rt,0);
    const vb=gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER,vb); gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),gl.STATIC_DRAW); gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0,2,gl.FLOAT,false,0,0);
    gl.viewport(0,0,G,G); gl.drawArrays(gl.TRIANGLES,0,3); const out=new Float32Array(G*G*4); gl.readPixels(0,0,G,G,gl.RGBA,gl.FLOAT,out); return Array.from(out.filter((_,i)=>i%4===0));
  },{fs,atlas:Array.from(atlas),pts,L:Array.from(L),NW,NH,G});
  await b.close();
  let gz=0,cz2=0,diff=0,big=0; for(let i=0;i<res.length;i++){ if(res[i]>0.01) gz++; if(cpu[i]>0.01) cz2++; diff+=Math.abs(res[i]-cpu[i]); if(Math.abs(res[i]-cpu[i])>0.1) big++; }
  console.log('points',res.length,'GPU share >0.01:',(gz/res.length).toFixed(3),'CPU share:',(cz2/res.length).toFixed(3),'mean |diff|:',(diff/res.length).toFixed(4),'points off by >0.1:',big);
  const sample=[]; for(let i=0;i<res.length;i+=373) sample.push(res[i].toFixed(3)+'/'+cpu[i].toFixed(3)); console.log('gpu/cpu samples', sample.join(' '));
})().catch(e=>{console.error('ERR',String(e).slice(0,2000)); process.exit(1);});
