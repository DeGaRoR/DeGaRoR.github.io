(async()=>{
 const finishes={};
 FLIGHT_PROBE.craft().traverse(o=>{if(!o.isMesh||!o.geometry)return;for(const a of Array.isArray(o.material)?o.material:[o.material]){if(!a?.userData?.scuff)continue;const k=(a.userData.aeroFinish||'unknown')+'/'+a.userData.scuff;finishes[k]=(finishes[k]||0)+1;}});
 const cloudStats=()=>typeof CLOUDS.stats==='function'?CLOUDS.stats():CLOUDS.stats;
 const result={finishes,field:PAVEMENT.microFieldStats(),scuff:FLYDIY_SCUFF_STATS(),mist:FMIST.stats(),clouds:cloudStats(),cloudMode:CLOUDS.S.mode,cloudReady:CLOUDS.ready};
 window.__PERF_MIST_SCUFF_DIAGNOSTIC=result;
 const q=new URLSearchParams(location.search);
 if(!['a','c'].includes(q.get('fmist'))&&q.get('perfaq')!=='1')return result;
 const sleep=ms=>new Promise(r=>setTimeout(r,ms));
 document.getElementById('bGo').click();
 const deadline=performance.now()+120000;
 while(!(document.body.classList.contains('mode-fly')&&BOOT.state==='gone'&&!BOOT.busy()&&FLIGHT_PROBE.sim().t>0)){if(performance.now()>deadline)throw Error('Diagnostic departure timeout');await sleep(250);}
 document.getElementById('bPause').click();
 DAY_CLOCK.preset('noon');DAY_CLOCK.set({rate:0});await sleep(1500);
 const cg=FLIGHT_PROBE.sim().cgPos(),ax=Math.round(cg[0]/100)*100,az=Math.round(cg[2]/100)*100,ay=FLIGHT_PROBE.world().terrainH(ax,az);
 FLIGHT_PROBE.devFree(ax+20,ay+40,az+20,Math.PI*.25,-.12);
 const eye=()=>typeof FLIGHT_PROBE.camera==='function'?FLIGHT_PROBE.camera():FLIGHT_PROBE.camera;
 result.visualSetup={clock:'noon',anchor:[ax,ay,az],query:location.search};
 const oldForce=FMIST.S.force;
 result.activeMist=[];
 const capture=()=>new Promise(resolve=>requestAnimationFrame(()=>{const c=document.createElement('canvas'),src=FLYDIY_RENDERER.domElement;c.width=1600;c.height=Math.round(1600*src.height/src.width);c.getContext('2d').drawImage(src,0,0,c.width,c.height);resolve(c.toDataURL('image/jpeg',.92).split(',')[1]);}));
 try{for(const strength of [0,.7]){
   FMIST.S.force={pool:strength,wisp:strength,oro:strength};FMIST.update(FLIGHT_PROBE.world().day,eye().position,FLIGHT_PROBE.world(),null);await sleep(1500);
   const start=performance.now();await sleep(7000);const frames=__GROUND_BENCH.frames.filter(t=>t>=start),gaps=frames.slice(1).map((t,i)=>t-frames[i]).sort((a,b)=>a-b);
   const imageJPEG=await capture();
   result.activeMist.push({strength,mist:FMIST.stats(),uniforms:Array.from(ATMO.apUniforms.uMist.value).slice(28,52),cloudActive:CLOUDS.active,cloudStats:cloudStats(),samples:gaps.length,p50:gaps[Math.floor(gaps.length*.5)],p99:gaps[Math.floor(gaps.length*.99)],max:gaps.at(-1),glError:FLYDIY_RENDERER.getContext().getError(),imageJPEG});
 }
 result.mistViews=[{view:'airfield',imageJPEG:result.activeMist.at(-1).imageJPEG,eye:eye().position.toArray()}];
 const fx=ax+400,fz=az+400,fy=FLIGHT_PROBE.world().terrainH(fx,fz);
 FLIGHT_PROBE.devFree(fx,fy+12,fz,Math.PI*.25,-.04);await sleep(2500);
 result.mistViews.push({view:'near-canopy',imageJPEG:await capture(),eye:eye().position.toArray(),glError:FLYDIY_RENDERER.getContext().getError()});
 }finally{FMIST.S.force=oldForce;}
 // Render actual aircraft materials/geometry in controlled lighting. Compare
 // general and class-specialized damage with the SAME restored mud model.
 const T=THREE,R=FLYDIY_RENDERER,gl=R.getContext(),model=FLIGHT_PROBE.model(),S=SKIN_SCUFF,W={on:true,wraps:new Map(),mats:new Set()},U=S.uniforms(T),wx=AEROWX.aeroWxSharedU(T);
 const oldOpt={...S.OPT};S.OPT.sharedGrunge=S.OPT.specialize=true;
 const selected=new Map();FLIGHT_PROBE.craft().updateMatrixWorld(true);
 FLIGHT_PROBE.craft().traverse(o=>{
  if(!o.isMesh||!o.geometry||Array.isArray(o.material)||!o.material?.userData?.scuff||!model.wreckBuild.finOf.has(o.geometry))return;
  const cls=S.clsOf(model.wreckBuild.finOf.get(o.geometry));if(cls>2)return;
  if(!selected.has(cls)||o.geometry.attributes.position.count>selected.get(cls).geometry.attributes.position.count)selected.set(cls,o);
 });
 const oldOn=U.uDmgOn.value,oldRt=R.getRenderTarget(),oldAc=R.autoClear,oldExposure=R.toneMappingExposure,oldClear=R.getClearColor(new T.Color()),oldAlpha=R.getClearAlpha();
 const gridOld={};for(const k of ['tGdMud','tGdFw','uGdBox','uGdDim'])gridOld[k]=k.startsWith('u')?wx[k].value.clone():wx[k].value;
 const mudBytes=new Uint8Array(32),fwBytes=new Uint8Array(16),mud=new T.Data3DTexture(mudBytes,2,2,2),fw=new T.Data3DTexture(fwBytes,2,2,2);
 for(const [tex,format]of [[mud,T.RGBAFormat],[fw,T.RGFormat]]){tex.format=format;tex.type=T.UnsignedByteType;tex.minFilter=tex.magFilter=T.LinearFilter;tex.unpackAlignment=1;tex.needsUpdate=true;}
 const target=new T.WebGLRenderTarget(384,384),created=[];
 const encode=bytes=>{const c=document.createElement('canvas');c.width=c.height=384;const x=c.getContext('2d'),im=x.createImageData(384,384);for(let y=0;y<384;y++)im.data.set(bytes.subarray(y*384*4,(y+1)*384*4),(383-y)*384*4);x.putImageData(im,0,0);return c.toDataURL('image/png').split(',')[1];};
 result.scuffImages=[];
 try{
  U.uDmgOn.value=1;R.autoClear=true;R.toneMappingExposure=4;R.setClearColor(0,0);
  wx.tGdMud.value=mud;wx.tGdFw.value=fw;wx.uGdBox.value.set(-128,-128,-128,128);wx.uGdDim.value.set(2,2,2,2);
  for(const [cls,original]of selected){
   const g=original.geometry.clone(),n=g.attributes.position.count,a=new Uint8Array(n*4),d=new Int8Array(n*4);for(let i=0;i<n;i++){a.set([140,200,100,200],i*4);d.set([127,0,0,cls],i*4);}g.setAttribute('aDmg',new T.BufferAttribute(a,4,true));g.setAttribute('aDmgD',new T.BufferAttribute(d,4,true));created.push(g);
   const sourceDraw={range:{...g.drawRange},indices:g.index?.count,groups:g.groups.slice(),materialVisible:original.material.visible,colorWrite:original.material.colorWrite,opacity:original.material.opacity,side:original.material.side};
   g.setDrawRange(0,g.index?g.index.count:n);
   const scene=new T.Scene(),mesh=new T.Mesh(g);mesh.frustumCulled=false;mesh.matrixAutoUpdate=false;mesh.matrix.copy(original.matrixWorld);mesh.matrixWorld.copy(mesh.matrix);mesh.matrixWorldNeedsUpdate=true;scene.add(mesh);scene.add(new T.AmbientLight(0xffffff,1.5));const sun=new T.DirectionalLight(0xffeedb,3);sun.position.set(10,10,8);scene.add(sun);
   g.computeBoundingBox();const box=g.boundingBox.clone().applyMatrix4(mesh.matrix),center=box.getCenter(new T.Vector3()),size=box.getSize(new T.Vector3()),radius=Math.max(size.length(),.1),cam=new T.PerspectiveCamera(40,1,.001,radius*20+100);cam.position.copy(center).add(new T.Vector3(1,.7,1).normalize().multiplyScalar(radius*1.7));cam.lookAt(center);cam.updateMatrixWorld(true);
   const mats={},compileMs={};for(const mode of ['general','specialized','old-mud-off']){
    const m=original.material,ud=m.userData;m.userData={};let c;try{c=new m.constructor();c.copy(m);}finally{m.userData=ud;}c.userData={...ud};if(m.defines)c.defines={...m.defines};for(const k of ['clearcoat','clearcoatRoughness','transmission','envMapIntensity'])if(m[k]!==undefined&&c[k]!==undefined)c[k]=m[k];created.push(c);
    const hint=mode==='specialized'?cls:-1,wrap=S.wrap(ud.scuffBase,'live',U,W,hint);
    c.onBeforeCompile=function(sh,r){wrap.call(this,sh,r);if(mode==='old-mud-off')sh.fragmentShader='#define GD_OFF 1\n'+sh.fragmentShader;};c.customProgramCacheKey=()=> 'scuff-image-proof:'+cls+':'+mode;
    c.visible=true;c.colorWrite=true;c.opacity=1;c.transparent=false;c.side=T.DoubleSide;mesh.material=c;const started=performance.now();await R.compileAsync(scene,cam);compileMs[mode]=performance.now()-started;mats[mode]=c;
   }
   // The live frame updates these shared uniforms while compileAsync yields.
   // Reapply immediately before each synchronous draw, with a damage-off control.
   const draw=(mat,on=1)=>{U.uDmgOn.value=on;wx.tGdMud.value=mud;wx.tGdFw.value=fw;wx.uGdBox.value.set(-128,-128,-128,128);wx.uGdDim.value.set(2,2,2,2);mesh.material=mat;R.setRenderTarget(target);R.clear();R.render(scene,cam);const bytes=new Uint8Array(384*384*4);R.readRenderTargetPixels(target,0,0,384,384,bytes);if(gl.getError())throw Error('Scuff image GL error');let covered=0;for(let i=3;i<bytes.length;i+=4)if(bytes[i])covered++;if(!covered)throw Error('Empty scuff image: '+JSON.stringify({sourceDraw,box:box.min.toArray().concat(box.max.toArray()),matrix:mesh.matrix.elements,calls:R.info.render.calls,triangles:R.info.render.triangles}));return bytes;};
   const diff=(a,b)=>{let sum=0,max=0,n=0;for(let i=0;i<a.length;i+=4)if(a[i+3]||b[i+3])for(let k=0;k<3;k++){const x=Math.abs(a[i+k]-b[i+k]);sum+=x;max=Math.max(max,x);n++;}return{mean:sum/Math.max(n,1),max,channels:n};};
   mudBytes.fill(0);fwBytes.fill(0);mud.needsUpdate=fw.needsUpdate=true;const intact=draw(mats.general,0),dry=draw(mats.general);
   mudBytes.fill(180);for(let i=0;i<8;i++)fwBytes.set([0,220],i*2);mud.needsUpdate=fw.needsUpdate=true;
   const a0=draw(mats.general),b0=draw(mats.specialized),old=draw(mats['old-mud-off']);
   const gpu={},ext=q.get('scuffgpu')==='1'&&gl.getExtension('EXT_disjoint_timer_query_webgl2');if(ext)for(let sample=0;sample<3;sample++)for(const mode of sample%2?['specialized','general']:['general','specialized']){mesh.material=mats[mode];R.setRenderTarget(target);const query=gl.createQuery();gl.beginQuery(ext.TIME_ELAPSED_EXT,query);R.clear();R.render(scene,cam);gl.endQuery(ext.TIME_ELAPSED_EXT);gl.flush();const end=performance.now()+5000;while(!gl.getQueryParameter(query,gl.QUERY_RESULT_AVAILABLE)){if(performance.now()>end)throw Error('Scuff GPU query timeout');await sleep(10);}if(gl.getParameter(ext.GPU_DISJOINT_EXT))throw Error('Scuff GPU timer disjoint');(gpu[mode]||(gpu[mode]=[])).push(gl.getQueryParameter(query,gl.QUERY_RESULT)/1e6);gl.deleteQuery(query);}
   const damageChange=diff(dry,intact),mudChange=diff(a0,dry);
   result.scuffImages.push({class:cls,finish:original.material.userData.aeroFinish,specializedHint:cls,vertices:n,compileMs,gpu,damageChange,activationVerified:damageChange.mean>0,parity:diff(a0,b0),mudChange,oldSuppression:diff(a0,old),images:{general:encode(a0),specialized:encode(b0),oldMudOff:encode(old),intact:encode(intact)}});
  }
  result.scuffQualityScope='Actual Cub raw material/geometry for each available metal/fabric/wood class, synthetic uniform damage records and constant2x2x2 deposit grid, controlled lighting. General-vs-specialized comparison includes the same restored mud. This does not validate a physical crash, pane cracks or every merged aircraft.';
 }catch(error){result.scuffQualityError=String(error);}finally{
  for(const k of ['tGdMud','tGdFw','uGdBox','uGdDim']){if(wx[k].value?.copy&&gridOld[k]?.isVector4)wx[k].value.copy(gridOld[k]);else wx[k].value=gridOld[k];}
  Object.assign(S.OPT,oldOpt);U.uDmgOn.value=oldOn;R.setRenderTarget(oldRt);R.autoClear=oldAc;R.toneMappingExposure=oldExposure;R.setClearColor(oldClear,oldAlpha);target.dispose();mud.dispose();fw.dispose();for(const c of created)c.dispose();
 }
 return result;
})()
