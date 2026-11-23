(()=>{
 const T=THREE,R=FLYDIY_RENDERER,F=WORLD.ground.fine(),U=R.properties.get(F.mat).uniforms,c=U.uFine.value;
 const meshes=[...F.tiles.values()];for(const m of meshes)m.geometry.computeBoundingBox();
 meshes.sort((a,b)=>{const x=a.geometry.boundingBox.getCenter(new T.Vector3()),y=b.geometry.boundingBox.getCenter(new T.Vector3());return Math.hypot(x.x-c.x,x.z-c.y)-Math.hypot(y.x-c.x,y.z-c.y);});
 const original=meshes[0],b=new T.Box3().setFromObject(original),mid=b.getCenter(new T.Vector3());
 const scene=new T.Scene(),mat=new T.MeshBasicMaterial({color:0xffffff,side:T.DoubleSide}),m=new T.Mesh(original.geometry,mat);
 original.updateWorldMatrix(true,false);m.matrix.copy(original.matrixWorld);m.matrixAutoUpdate=false;m.frustumCulled=false;scene.add(m);
 const cam=new T.OrthographicCamera(-80,80,80,-80,.1,20000);cam.position.set(mid.x,b.max.y+60,mid.z);cam.up.set(0,0,-1);cam.lookAt(mid.x,0,mid.z);cam.updateMatrixWorld(true);
 const target=new T.WebGLRenderTarget(64,64),prev=R.getRenderTarget(),col=R.getClearColor(new T.Color()).clone(),alpha=R.getClearAlpha();
 try{R.setRenderTarget(target);R.setClearColor(0,0);R.clear();R.render(scene,cam);const bytes=new Uint8Array(64*64*4);R.readRenderTargetPixels(target,0,0,64,64,bytes);let coverage=0,light=0;for(let i=0;i<bytes.length;i+=4){if(bytes[i+3])coverage++;light+=bytes[i];}
 return {fine:c.toArray(),bounds:[b.min.toArray(),b.max.toArray()],camera:cam.position.toArray(),coverage,mean:light/4096,uniforms:Object.fromEntries(Object.entries(U).filter(([k])=>/uTier|diffuse|opacity|fog|Exposure/.test(k)).map(([k,v])=>[k,v.value&&v.value.toArray?v.value.toArray():v.value])),glError:R.getContext().getError()};
 }finally{R.setRenderTarget(prev);R.setClearColor(col,alpha);mat.dispose();target.dispose();}
})();
