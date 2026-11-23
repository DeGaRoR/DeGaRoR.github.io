(async()=>{
  const T=THREE,R=FLYDIY_RENDERER,F=WORLD.ground.fine();
  if(!F||!F.tiles.size||!F.mat)throw Error('No prepared fine terrain');
  const prepared=window.FLYDIY_GROUND_CACHE?FLYDIY_GROUND_CACHE.materials(F.mat)[0]:F.mat;
  const U=R.properties.get(prepared).uniforms;if(!U)throw Error('No prepared fine terrain uniforms');
  // A garage can retain fine tiles while clipping the entire fine disc.
  // Diagnose before spending another cold compilation on an invisible subject.
  if(!(U.uFine.value.z>0))throw Error('Fine disc disabled in this scene: '+JSON.stringify(U.uFine.value.toArray()));
  const center=U.uFine.value,meshes=[...F.tiles.values()];
  for(const m of meshes)m.geometry.computeBoundingBox();
  meshes.sort((a,b)=>{const x=a.geometry.boundingBox.getCenter(new T.Vector3()),y=b.geometry.boundingBox.getCenter(new T.Vector3());return Math.hypot(x.x-center.x,x.z-center.y)-Math.hypot(y.x-center.x,y.z-center.y);});
  const m=meshes[0],b=new T.Box3().setFromObject(m),n=256,c=b.getCenter(new T.Vector3()),rect=[b.min.x,b.min.z,b.max.x-b.min.x,b.max.z-b.min.z];
  const reference=window.FLYDIY_GROUND_CACHE?FLYDIY_GROUND_CACHE.reference(m):null;
  const p=GROUND_MATERIAL_CACHE.makeProbe(T,R,m,{space:'screen',reference,packed:!!window.GROUND_CACHE_PACKED,size:n,rect,height:b.max.y+60,ambient:[2,2,2],keyLight:{color:[6,5,4],direction:[.2,.8,.5]}});
  const target=new T.WebGLRenderTarget(n,n,{type:T.UnsignedByteType,minFilter:T.NearestFilter,magFilter:T.NearestFilter,depthBuffer:true});target.texture.colorSpace=T.NoColorSpace;
  const prev=R.getRenderTarget(),auto=R.autoClear,color=R.getClearColor(new T.Color()).clone(),alpha=R.getClearAlpha();
  const encode=bytes=>{const canvas=document.createElement('canvas');canvas.width=canvas.height=n;const ctx=canvas.getContext('2d'),im=ctx.createImageData(n,n);
   for(let y=0;y<n;y++)for(let x=0;x<n;x++){const a=((n-1-y)*n+x)*4,k=(y*n+x)*4;im.data[k]=bytes[a];im.data[k+1]=bytes[a+1];im.data[k+2]=bytes[a+2];im.data[k+3]=255;}ctx.putImageData(im,0,0);return canvas.toDataURL('image/png').split(',')[1];};
  const glErrors=[];
  const draw=(mat,cam)=>{p.object.material=mat;R.setRenderTarget(target);R.clear();R.render(p.scene,cam);const bytes=new Uint8Array(n*n*4);R.readRenderTargetPixels(target,0,0,n,n,bytes);const gl=R.getContext(),error=gl.getError();if(error){const pr=R.properties.get(mat).currentProgram.program;gl.validateProgram(pr);const samplers=[];for(let i=0;i<gl.getProgramParameter(pr,gl.ACTIVE_UNIFORMS);i++){const u=gl.getActiveUniform(pr,i);if(/map|splat|tint|pack|cache|lut/i.test(u.name))samplers.push({name:u.name,type:u.type,value:gl.getUniform(pr,gl.getUniformLocation(pr,u.name))});}glErrors.push({material:mat===p.referenceMaterial?'reference':mat===p.litMaterial?'lit':'builder',error,validation:gl.getProgramInfoLog(pr),samplers});}return bytes;};
  const cases=[],oblique=new T.PerspectiveCamera(45,1,.1,5000);oblique.position.set(c.x+150,b.max.y+130,c.z+150);oblique.lookAt(c);oblique.updateMatrixWorld(true);
  try{
   R.autoClear=true;R.setClearColor(0,0);
   for(const [name,cam]of[['overhead',p.top],['oblique',oblique]]){
    const t=performance.now();await p.bake(cam.position,cam);const bakeMs=performance.now()-t;
    await p.compile(p.referenceMaterial,cam);await p.compile(p.litMaterial,cam);
    // Warm each first-use path before taking the diagnostic images.
    draw(p.referenceMaterial,cam);draw(p.litMaterial,cam);
    const a=draw(p.referenceMaterial,cam),z=draw(p.litMaterial,cam),delta=new Uint8Array(a.length),diff=[];let covered=0,sum=0,light=0;
    for(let i=0;i<a.length;i+=4){delta[i+3]=255;if(a[i+3]<128)continue;covered++;for(let k=0;k<3;k++){const d=Math.abs(a[i+k]-z[i+k]);diff.push(d);sum+=d;light+=a[i+k];delta[i+k]=Math.min(255,d*16);}}
    diff.sort((a,b)=>a-b);const mean=sum/Math.max(1,diff.length),p99=diff[Math.floor(diff.length*.99)]||0,max=diff.at(-1)||0;
    const validReference=covered>=n*n*.05&&light/Math.max(1,diff.length)>=2;
    const material=p.sources.packed?null:draw(p.bakeMaterial,cam);let materialCoverage=0,materialLight=0;if(material)for(let i=0;i<material.length;i+=4){if(material[i+3])materialCoverage++;materialLight+=material[i];}
    const pr=R.properties.get(p.referenceMaterial).currentProgram.program,gl=R.getContext(),lighting={};for(let i=0;i<gl.getProgramParameter(pr,gl.ACTIVE_UNIFORMS);i++){const u=gl.getActiveUniform(pr,i);if(/toneMappingExposure|hemisphereLights|ambientLightColor|diffuse$|roughness$|metalness$/.test(u.name))lighting[u.name]=gl.getUniform(pr,gl.getUniformLocation(pr,u.name));}
    cases.push({name,bakeAndCompileMs:bakeMs,coveredPixels:covered,validReference,materialCoverage,materialMean:materialLight/(n*n),lighting,exposure:R.toneMappingExposure,glErrors:glErrors.slice(),meanReferenceByte:light/Math.max(1,diff.length),meanAbsoluteByteError:mean,p99ByteError:p99,maxByteError:max,pass:validReference&&!glErrors.length&&mean<=.5&&p99<=2,
     images:Object.assign({reference:encode(a),cached:encode(z),difference16x:encode(delta)},material?{material:encode(material)}:{})});
    // Keep failed images and metrics instead of throwing away the evidence.
    if(!validReference)break;
   }
   let negativeControl;
   if(window.GROUND_CACHE_NEGATIVE){
    p.litMaterial.fragmentShader=p.litMaterial.fragmentShader.replace('normal = normalize((viewMatrix','normal = -normalize((viewMatrix');p.litMaterial.needsUpdate=true;await p.compile(p.litMaterial,oblique);
    const a=draw(p.referenceMaterial,oblique),z=draw(p.litMaterial,oblique);let sum=0,count=0;for(let i=0;i<a.length;i+=4)if(a[i+3])for(let k=0;k<3;k++){sum+=Math.abs(a[i+k]-z[i+k]);count++;}
    negativeControl={invertedNormalsMeanByteError:sum/count,detected:sum/count>1};
   }
   return {build:window.FLYDIY_BUILD,size:n,rect,cacheBytes:n*n*8*2,space:'screen',packed:p.sources.packed,testLighting:{ambient:[2,2,2],directionalColor:[6,5,4],directionalDirection:[.2,.8,.5],shadows:'original world maps retained'},negativeControl,cases,limitations:['Controlled frozen reference lighting and recipe.','Screen cache is invalid when camera, scene or material inputs change; this is not a persistent world-tile cache.','No production integration or whole-startup saving claimed.']};
  }finally{R.setRenderTarget(prev);R.autoClear=auto;R.setClearColor(color,alpha);target.dispose();p.dispose();}
 })();
