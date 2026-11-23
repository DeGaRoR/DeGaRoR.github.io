(async()=>{
 const T=THREE,R=FLYDIY_RENDERER,gl=R.getContext(),ext=gl.getExtension('EXT_disjoint_timer_query_webgl2');
 if(!ext)throw Error('GPU timer queries unavailable');
 const F=WORLD.ground.fine(),prepared=window.FLYDIY_GROUND_CACHE?FLYDIY_GROUND_CACHE.materials(F.mat)[0]:F.mat,center=R.properties.get(prepared).uniforms.uFine.value,meshes=[...F.tiles.values()];
 for(const m of meshes)m.geometry.computeBoundingBox();
 meshes.sort((a,b)=>{const x=a.geometry.boundingBox.getCenter(new T.Vector3()),y=b.geometry.boundingBox.getCenter(new T.Vector3());return Math.hypot(x.x-center.x,x.z-center.y)-Math.hypot(y.x-center.x,y.z-center.y);});
 const mesh=meshes[0],b=new T.Box3().setFromObject(mesh),rect=[b.min.x,b.min.z,160,160],width=5120,height=1271;
 const reference=window.FLYDIY_GROUND_CACHE?FLYDIY_GROUND_CACHE.reference(mesh):null;
 const p=GROUND_MATERIAL_CACHE.makeProbe(T,R,mesh,{space:'screen',reference,packed:!!window.GROUND_CACHE_PACKED,cacheWidth:width,cacheHeight:height,rect,height:b.max.y+60,ambient:[2,2,2],keyLight:{color:[6,5,4],direction:[.2,.8,.5]}});
 const target=new T.WebGLRenderTarget(width,height,{type:T.HalfFloatType}),previous=R.getRenderTarget(),auto=R.autoClear;
 const draw=(mat,to)=>{p.object.material=mat;R.setRenderTarget(to);R.clear();R.render(p.scene,p.top);};
 const paths={original:()=>draw(p.referenceMaterial,target),split:()=>{draw(p.bakeMaterial,p.target);draw(p.litMaterial,target);}};
 try{
  R.autoClear=true;p.bakeMaterial.uniforms.uMaterialBakeEye.value.copy(p.top.position);
  for(const mat of[p.referenceMaterial,p.bakeMaterial,p.litMaterial])await p.compile(mat,p.top);
  for(let i=0;i<3;i++){paths.original();paths.split();}gl.finish();
  const rows={original:[],split:[]};
  for(let i=0;i<12;i++)for(const key of(i%2?['split','original']:['original','split'])){
   const query=gl.createQuery();gl.beginQuery(ext.TIME_ELAPSED_EXT,query);paths[key]();gl.endQuery(ext.TIME_ELAPSED_EXT);gl.flush();
   const until=performance.now()+5000;while(!gl.getQueryParameter(query,gl.QUERY_RESULT_AVAILABLE)){if(performance.now()>until)throw Error('GPU query timeout');await new Promise(r=>setTimeout(r,10));}
   if(gl.getParameter(ext.GPU_DISJOINT_EXT))throw Error('Disjoint GPU timer');
   rows[key].push(gl.getQueryParameter(query,gl.QUERY_RESULT)/1e6);gl.deleteQuery(query);
  }
  const error=gl.getError();if(error)throw Error('GPU benchmark draw error '+error);
  const stats=values=>{const v=values.slice().sort((a,b)=>a-b);return {medianMs:(v[5]+v[6])/2,minMs:v[0],maxMs:v.at(-1),samplesMs:values};};
  return {width,height,packed:p.sources.packed,materialCacheMiB:width*height*16/1048576,original:stats(rows.original),split:stats(rows.split),scope:'One fine-terrain tile stretched over full viewport, material rebuilt every split draw; not game FPS or startup.',glError:error};
 }finally{R.setRenderTarget(previous);R.autoClear=auto;target.dispose();p.dispose();}
})()
