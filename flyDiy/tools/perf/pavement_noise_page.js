(async()=>{
 const T=THREE,P=PAVEMENT,R=FLYDIY_RENDERER,gl=R.getContext();
 if(!P.microNoiseStats().enabled)throw Error('Exact noise cache inactive');
 const parts=[...P.TAB.parts].filter(p=>p.uniforms.uMicroCache&&p.uniforms.uMicroCache.value.x>=0).sort((a,b)=>b.uniforms.uMicro2.value.x-a.uniforms.uMicro2.value.x);
 const part=parts[0];if(!part)throw Error('No cached rough runway row');
 const n=512,span=Math.min(16,part.pk[2]*1.6),u=part.pk[3],g=new T.PlaneGeometry(span,span,32,32);g.rotateX(-Math.PI/2);
 const count=g.attributes.position.count,pav=new Float32Array(count*4),id=new Float32Array(count),tan=new Float32Array(count*3);
 for(let i=0;i<count;i++){const x=g.attributes.position.getX(i),z=g.attributes.position.getZ(i);pav.set([u+x,z,Math.min(u+x,2*u-u-x,part.pk[2]-Math.abs(z)),1],i*4);id[i]=part.row;tan.set([1,1,0],i*3);}
 g.setAttribute('aPav',new T.BufferAttribute(pav,4));g.setAttribute('aPavId',new T.BufferAttribute(id,1));g.setAttribute('aPavT',new T.BufferAttribute(tan,3));
 const scene=new T.Scene(),mesh=new T.Mesh(g,P.TAB.mat);scene.add(mesh);scene.add(new T.AmbientLight(0xffffff,1.3));const sun=new T.DirectionalLight(0xffeddb,3);sun.position.set(-10,8,4);scene.add(sun);
 const cam=new T.PerspectiveCamera(40,1,.1,200);cam.position.set(0,span*.8,span*.65);cam.lookAt(0,0,0);cam.updateMatrixWorld(true);
 const target=new T.WebGLRenderTarget(n,n),prev=R.getRenderTarget(),auto=R.autoClear,wet=P.WET.value,exposure=R.toneMappingExposure;
 const mats={},rows=[];const encode=bytes=>{const c=document.createElement('canvas');c.width=c.height=n;const ctx=c.getContext('2d'),im=ctx.createImageData(n,n);for(let y=0;y<n;y++)im.data.set(bytes.subarray(y*n*4,(y+1)*n*4),(n-1-y)*n*4);ctx.putImageData(im,0,0);return c.toDataURL('image/png').split(',')[1];};
 const draw=mat=>{mesh.material=mat;R.setRenderTarget(target);R.clear();R.render(scene,cam);const bytes=new Uint8Array(n*n*4);R.readRenderTargetPixels(target,0,0,n,n,bytes);if(gl.getError())throw Error('Pavement probe GL error');return bytes;};
 try{
 R.autoClear=true;R.toneMappingExposure=4;
 for(const mode of ['reference','cached','no-cues-control']){
  P.microNoiseReference(mode==='reference');const mat=P.TAB.mat.clone();mat.onBeforeCompile=sh=>{sh._pavU=P.TAB.mat.uniforms;P.hookT(sh);if(mode==='no-cues-control')sh.fragmentShader=sh.fragmentShader.replace('if (uMicro2.w > 0.5 && !grassy)','if (false)');};mat.customProgramCacheKey=()=> 'noise-proof:'+mode;mesh.material=mat;await R.compileAsync(scene,cam);draw(mat);mats[mode]=mat;
 }
 for(const value of[0,.8]){
  P.WET.value=value;const a=draw(mats.reference),b=draw(mats.cached),c=draw(mats['no-cues-control']);let sum=0,max=0,coverage=0,control=0,light=0;const ds=[];
  for(let i=0;i<a.length;i+=4){if(a[i+3]<128)continue;coverage++;for(let k=0;k<3;k++){const d=Math.abs(a[i+k]-b[i+k]);sum+=d;max=Math.max(max,d);ds.push(d);control+=Math.abs(a[i+k]-c[i+k]);light+=a[i+k];}}
  ds.sort((a,b)=>a-b);rows.push({wet:value,coveredPixels:coverage,meanReference:light/Math.max(1,ds.length),meanByteError:sum/Math.max(1,ds.length),p99ByteError:ds[Math.floor(ds.length*.99)]||0,maxByteError:max,negativeControlMean:control/Math.max(1,ds.length),images:{reference:encode(a),cached:encode(b),noCues:encode(c)}});
 }
 const gpu={};const ext=gl.getExtension('EXT_disjoint_timer_query_webgl2');
 if(ext){target.setSize(5120,1271);for(let i=0;i<6;i++)for(const mode of(i%2?['cached','reference']:['reference','cached'])){mesh.material=mats[mode];R.setRenderTarget(target);const q=gl.createQuery();gl.beginQuery(ext.TIME_ELAPSED_EXT,q);R.clear();R.render(scene,cam);gl.endQuery(ext.TIME_ELAPSED_EXT);gl.flush();const end=performance.now()+5000;while(!gl.getQueryParameter(q,gl.QUERY_RESULT_AVAILABLE)){if(performance.now()>end)throw Error('GPU timer timeout');await new Promise(r=>setTimeout(r,10));}if(gl.getParameter(ext.GPU_DISJOINT_EXT))throw Error('Disjoint GPU timer');(gpu[mode]||(gpu[mode]=[])).push(gl.getQueryParameter(q,gl.QUERY_RESULT)/1e6);gl.deleteQuery(q);}}
 return {gpu,scope:'Controlled actual rough-runway material row on identical synthetic patch geometry, fixed lighting/camera; dry and wet. Not a full-world screenshot or physical relief geometry check.',row:part.row,pk:Array.from(part.pk),micro:part.userData.pavMicro,cache:P.microNoiseStats(),cases:rows,glError:gl.getError()};
 }finally{P.WET.value=wet;P.microNoiseReference(false);R.setRenderTarget(prev);R.autoClear=auto;R.toneMappingExposure=exposure;target.dispose();g.dispose();for(const m of Object.values(mats))m.dispose();}
})()
