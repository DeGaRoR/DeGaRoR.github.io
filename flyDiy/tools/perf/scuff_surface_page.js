(async()=>{
 const T=THREE,R=FLYDIY_RENDERER,gl=R.getContext(),S=SKIN_SCUFF,U=S.uniforms(T),wx=AEROWX.aeroWxSharedU(T),model=FLIGHT_PROBE.model();
 const result={scope:'Controlled actual Cub parts, forced damage/deposit records. Full shared-mud shader versus simplified surface; window crack body unchanged. GPU patch costs are not whole-world FPS.',options:{...S.OPT},parts:[]};
 window.__PERF_MIST_SCUFF_DIAGNOSTIC=result;
 const oldOpt={...S.OPT},oldOn=U.uDmgOn.value,oldRt=R.getRenderTarget(),oldAuto=R.autoClear,oldExposure=R.toneMappingExposure,oldColor=R.getClearColor(new T.Color()),oldAlpha=R.getClearAlpha();
 const prior={};for(const k of ['tGdMud','tGdFw','uGdBox','uGdDim'])prior[k]=k.startsWith('u')?wx[k].value.clone():wx[k].value;
 const mudBytes=new Uint8Array(32),fwBytes=new Uint8Array(16),mud=new T.Data3DTexture(mudBytes,2,2,2),fw=new T.Data3DTexture(fwBytes,2,2,2),target=new T.WebGLRenderTarget(512,512),created=[];
 for(const [tex,format]of [[mud,T.RGBAFormat],[fw,T.RGFormat]]){tex.format=format;tex.type=T.UnsignedByteType;tex.minFilter=tex.magFilter=T.LinearFilter;tex.unpackAlignment=1;tex.needsUpdate=true;}
 const sleep=ms=>new Promise(r=>setTimeout(r,ms));
 const encode=bytes=>{const c=document.createElement('canvas');c.width=c.height=512;const x=c.getContext('2d'),im=x.createImageData(512,512);for(let y=0;y<512;y++)im.data.set(bytes.subarray(y*2048,(y+1)*2048),(511-y)*2048);x.putImageData(im,0,0);return c.toDataURL('image/png').split(',')[1];};
 const diff=(a,b)=>{let sum=0,max=0,n=0;for(let i=0;i<a.length;i+=4)if(a[i+3]||b[i+3])for(let k=0;k<3;k++){const d=Math.abs(a[i+k]-b[i+k]);sum+=d;max=Math.max(max,d);n++;}return{mean:sum/Math.max(n,1),max,channels:n};};
 try{
  R.autoClear=true;R.toneMappingExposure=4;R.setClearColor(0,0);
  const selected=new Map();FLIGHT_PROBE.craft().updateMatrixWorld(true);
  FLIGHT_PROBE.craft().traverse(o=>{if(!o.isMesh||Array.isArray(o.material)||!o.material?.userData?.scuff||!model.wreckBuild.finOf.has(o.geometry))return;const cls=S.clsOf(model.wreckBuild.finOf.get(o.geometry));if(cls>3)return;if(!selected.has(cls)||o.geometry.attributes.position.count>selected.get(cls).geometry.attributes.position.count)selected.set(cls,o);});
  if(selected.size!==4)throw Error('Expected metal/fabric/wood/other surface classes');
  for(const [cls,original]of selected){
   const row={finish:original.material.userData.aeroFinish,class:cls,compileMs:{},gpu:[]};result.parts.push(row);
   const g=original.geometry.clone(),n=g.attributes.position.count,a=new Uint8Array(n*4),d=new Int8Array(n*4);for(let i=0;i<n;i++){a.set([140,200,100,200],i*4);d.set([127,0,0,cls],i*4);}g.setAttribute('aDmg',new T.BufferAttribute(a,4,true));g.setAttribute('aDmgD',new T.BufferAttribute(d,4,true));g.setDrawRange(0,g.index?g.index.count:n);created.push(g);
   const mesh=new T.Mesh(g),scene=new T.Scene();mesh.frustumCulled=false;mesh.matrixAutoUpdate=false;mesh.matrix.copy(original.matrixWorld);mesh.matrixWorld.copy(mesh.matrix);mesh.matrixWorldNeedsUpdate=true;scene.add(mesh);scene.add(new T.AmbientLight(0xffffff,1.5));
   g.computeBoundingBox();const box=g.boundingBox.clone().applyMatrix4(mesh.matrix),center=box.getCenter(new T.Vector3()),radius=Math.max(box.getSize(new T.Vector3()).length(),.1),cam=new T.PerspectiveCamera(40,1,.001,radius*20+100),direction=new T.Vector3(.1,.35,1).transformDirection(mesh.matrix);cam.position.copy(center).addScaledVector(direction,radius*1.05);cam.lookAt(center);cam.updateMatrixWorld(true);
   const sun=new T.DirectionalLight(0xffeedb,3);sun.position.copy(center).add(new T.Vector3(10,15,20));sun.target.position.copy(center);scene.add(sun,sun.target);
   const mats={};
   for(const mode of ['intact','original','full','lite']){
    Object.assign(S.OPT,{sharedGrunge:mode!=='original',specialize:false,simplify:mode==='lite',always:false});
    const m=original.material,ud=m.userData;m.userData={};let c;try{c=new m.constructor();c.copy(m);}finally{m.userData=ud;}c.userData={...ud};if(m.defines)c.defines={...m.defines};for(const k of ['clearcoat','clearcoatRoughness','transmission','envMapIntensity'])if(m[k]!==undefined&&c[k]!==undefined)c[k]=m[k];created.push(c);
    const W={on:mode!=='intact',wraps:new Map(),mats:new Set()},wrap=S.wrap(ud.scuffBase,'live',U,W,-1);c.onBeforeCompile=wrap;c.customProgramCacheKey=()=> 'scuff-lite-proof:'+cls+':'+mode;c.visible=c.colorWrite=true;c.opacity=1;c.transparent=false;c.side=T.DoubleSide;mesh.material=c;
    const t=performance.now();await R.compileAsync(scene,cam);row.compileMs[mode]=performance.now()-t;mats[mode]=c;
   }
   const set=(mode,on)=>{U.uDmgOn.value=on;wx.tGdMud.value=mud;wx.tGdFw.value=fw;wx.uGdBox.value.set(-128,-128,-128,128);wx.uGdDim.value.set(2,2,2,2);mesh.material=mats[mode];R.autoClear=true;R.toneMappingExposure=4;R.setClearColor(0,0);R.setRenderTarget(target);};
   const draw=(mode,on)=>{set(mode,on);R.clear();R.render(scene,cam);const bytes=new Uint8Array(512*512*4);R.readRenderTargetPixels(target,0,0,512,512,bytes);const e=gl.getError();if(e)throw Error('Controlled scuff GL '+e);let pixels=0;for(let i=3;i<bytes.length;i+=4)if(bytes[i])pixels++;if(pixels<32)throw Error('Insufficient image coverage '+pixels);return bytes;};
   mudBytes.fill(0);fwBytes.fill(0);mud.needsUpdate=fw.needsUpdate=true;
   const intact=draw('intact',0),originalDry=draw('original',1),fullDry=draw('full',1),liteDry=draw('lite',1),liteOff=draw('lite',0);
   mudBytes.fill(180);for(let i=0;i<8;i++)fwBytes.set([0,220],i*2);mud.needsUpdate=fw.needsUpdate=true;
   const fullMud=draw('full',1),liteMud=draw('lite',1);
   row.damageFull=diff(fullDry,intact);row.damageLite=diff(liteDry,liteOff);row.mudFull=diff(fullMud,fullDry);row.mudLite=diff(liteMud,liteDry);row.intactParity=diff(intact,liteOff);row.simplificationDifference=diff(fullDry,liteDry);row.images={intact:encode(intact),originalDry:encode(originalDry),fullDry:encode(fullDry),liteDry:encode(liteDry),fullMud:encode(fullMud),liteMud:encode(liteMud)};
   if(!row.damageFull.mean||!row.damageLite.mean||!row.mudFull.mean||!row.mudLite.mean)throw Error('Inactive damage/mud negative control');
   const ext=gl.getExtension('EXT_disjoint_timer_query_webgl2');
   if(ext)for(const [profile,bytes]of [['all',[140,200,100,200]],['dent',[140,0,0,0]],['scrape',[0,200,0,200]],['torn',[0,0,100,0]]]){for(let i=0;i<n;i++)a.set(bytes,i*4);g.attributes.aDmg.needsUpdate=true;const cases=profile==='all'?[['intact',0],['lite',0],['original',1],['full',1],['lite',1]]:[['original',1],['full',1],['lite',1]];for(let sample=0;sample<4;sample++)for(const [mode,on]of sample%2?cases.slice().reverse():cases){set(mode,on);if(gl.getQuery(ext.TIME_ELAPSED_EXT,gl.CURRENT_QUERY))throw Error('GPU timer already active');const q=gl.createQuery(),repeats=12;gl.beginQuery(ext.TIME_ELAPSED_EXT,q);for(let i=0;i<repeats;i++)R.render(scene,cam);gl.endQuery(ext.TIME_ELAPSED_EXT);gl.flush();const until=performance.now()+5000;while(!gl.getQueryParameter(q,gl.QUERY_RESULT_AVAILABLE)){if(performance.now()>until)throw Error('GPU timer timeout');await sleep(10);}const disjoint=gl.getParameter(ext.GPU_DISJOINT_EXT),ms=gl.getQueryParameter(q,gl.QUERY_RESULT)/1e6/repeats,error=gl.getError();gl.deleteQuery(q);row.gpu.push({profile,sample,mode,on,ms,disjoint,error});}}
  }
 }catch(e){result.error=String(e);}finally{
  Object.assign(S.OPT,oldOpt);U.uDmgOn.value=oldOn;for(const k of ['tGdMud','tGdFw','uGdBox','uGdDim']){if(k.startsWith('u'))wx[k].value.copy(prior[k]);else wx[k].value=prior[k];}R.setRenderTarget(oldRt);R.autoClear=oldAuto;R.toneMappingExposure=oldExposure;R.setClearColor(oldColor,oldAlpha);target.dispose();mud.dispose();fw.dispose();for(const o of created)o.dispose();
 }
 return result;
})()
