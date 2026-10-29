'use strict';
// Real three.js regression: background preparation must not expose pending
// future-state programs to today's frame, including depth and unlit materials.
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert');
const ROOT=process.env.NIGHT_TEST_ROOT||path.join(__dirname,'..'),{boot}=require(ROOT+'/tools/_fake_gl.js');
const app=fs.readFileSync(ROOT+'/src/viewer/app.js','utf8');
function fixture(){const B=boot(),{THREE:T,ctx}=B;B.load('src/viewer/shader_warm.js');
 let released=true,waits=0;const pending=new Set(),raw=B.renderer.getContext(),complete=raw.getExtension('KHR_parallel_shader_compile').COMPLETION_STATUS_KHR;
 const gl=new Proxy(raw,{get(target,key){
   if(key==='linkProgram')return p=>{raw.linkProgram(p);if(!released)pending.add(p);};
   if(key==='getProgramParameter')return (p,q)=>(q===complete||q===0x91b1)&&pending.has(p)&&!released?false:raw.getProgramParameter(p,q);
   if(key==='getProgramInfoLog')return p=>{if(pending.has(p)&&!released)waits++;return raw.getProgramInfoLog(p);};
   return raw[key];
 }});
 const R=new T.WebGLRenderer({context:gl,canvas:raw.canvas,reversedDepthBuffer:true});R.shadowMap.enabled=true;R.shadowMap.type=T.PCFShadowMap;R.toneMapping=T.ACESFilmicToneMapping;
 const scene=new T.Scene(),camera=new T.PerspectiveCamera(55,1,.1,100);camera.position.set(0,2,7);camera.lookAt(0,0,0);scene.fog=new T.Fog(0xabcdef,10,80);
 const sun=new T.DirectionalLight(0xffffff,1);sun.castShadow=true;scene.add(sun);
 scene.add(new T.PointLight(0xffffff,1),new T.PointLight(0xffffff,1));
 const pool=Array.from({length:8},()=>{const l=new T.PointLight(0xffffff,0);l.visible=false;scene.add(l);return l;});
 const L={pool,armed:false,arm(on){this.armed=!!on;for(const l of pool)l.visible=!!on;}};
 const geometry=new T.BoxGeometry(),basic=new T.MeshBasicMaterial({color:0xaabbcc}),lit=new T.MeshStandardMaterial({color:0x334455});
 const a=new T.Mesh(geometry,basic),b=new T.Mesh(geometry,lit);a.castShadow=b.castShadow=true;scene.add(a,b);
 const live=new T.Mesh(geometry,new T.MeshStandardMaterial({color:0x123456}));live.castShadow=true;live.name='kept-live';
 const band=live.material.clone();band.defines={BAND_TEST:1};const eye=live.material.clone();eye.defines={EYE_TEST:1};
 const pairs=[[live,live.material],[live,band],[live,eye]],rt=new T.WebGLRenderTarget(64,64),depthRT=new T.WebGLRenderTarget(32,32);
 Object.assign(ctx,{renderer:R,scene,camera,WF:{premises:{lamps:L}},aa:{target:()=>rt},PLAIN_RT:()=>depthRT,FLOWN_BAKE:{warmPairs:()=>pairs},requestAnimationFrame:fn=>setTimeout(()=>fn(Date.now()),1)});
 const c0=app.indexOf('  function compilePass('),c1=app.indexOf('  // G879 (C4b',c0),n0=app.indexOf('  const lampWarmOwners = '),n1=app.indexOf('  // APPROACH',n0);assert(c0>0&&c1>c0&&n0>0&&n1>n0);
 vm.runInContext(app.slice(c0,c1)+'\n'+app.slice(n0,n1),ctx);R.setRenderTarget(rt);R.render(scene,camera);
 return {...B,T,R,ctx,scene,camera,L,pool,a,b,basic,lit,live,band,eye,pairs,geometry,rt,depthRT,setPending(){released=false;waits=0;},release(){released=true;},waits:()=>waits,prepare:want=>vm.runInContext('lampsPrep('+!!want+')',ctx)};
}
(async()=>{
 {const F=fixture();F.setPending();F.L.arm(true);F.R.compile(F.scene,F.camera);F.L.arm(false);F.R.render(F.scene,F.camera);assert(F.waits()>0,'control must expose pending future programs');console.log('PASS real-three control reproduces premature future-state program use');F.release();}
 const F=fixture(),{R,scene,camera,L,geometry}=F,dayProgram=R.properties.get(F.basic).currentProgram,positions=Buffer.from(geometry.attributes.position.array.buffer).toString('hex');
 F.setPending();let done=false;const beforeSubmit=F.links.length;const job=F.prepare(true).then(()=>{done=true;});assert.strictEqual(F.links.length,beforeSubmit,'night submission must yield before compiling');await new Promise(r=>setTimeout(r,2));
 assert(!done,'preparation must wait for linking');assert.strictEqual(L.armed,false);assert(F.pool.every(l=>!l.visible));assert.strictEqual(R.properties.get(F.basic).currentProgram,dayProgram,'live basic currentProgram must be untouched');
 R.render(scene,camera);assert.strictEqual(F.waits(),0,'live frame must not inspect a pending future-state program');
 F.release();await job;assert.strictEqual(L.armed,false,'host alone arms the pool');L.arm(true);
 const n=F.links.length;R.render(scene,camera);R.render(scene,camera);assert.strictEqual(F.links.length,n,'main and second-frame depth need no new links');
 scene.add(F.live);for(const m of [F.live.material,F.band,F.eye]){F.live.material=m;R.render(scene,camera);R.render(scene,camera);}assert.strictEqual(F.links.length,n,'retained, eye and band views were prepared');
 assert.strictEqual(Buffer.from(geometry.attributes.position.array.buffer).toString('hex'),positions);assert.strictEqual(geometry.drawRange.count,Infinity);
 console.log('PASS pending preparation preserves live state; main/depth/retained views use known programs');
 // Repeated transitions replace only the matching owner pack. No program loss
 // while replacing it, and no unbounded accumulation of program references.
 for(let i=0;i<2;i++){await F.prepare(false);L.arm(false);R.render(scene,camera);await F.prepare(true);L.arm(true);R.render(scene,camera);}
 const programs=R.info.programs.length;for(let i=0;i<4;i++){await F.prepare(false);L.arm(false);R.render(scene,camera);await F.prepare(true);L.arm(true);R.render(scene,camera);}assert.strictEqual(R.info.programs.length,programs);
 const compile=F.ctx.compileSliced;F.ctx.compileSliced=()=>Promise.reject(new Error('test rejection'));await assert.rejects(F.prepare(false),/test rejection/);F.ctx.compileSliced=compile;assert.strictEqual(L.armed,true);assert(F.pool.every(l=>l.visible));R.render(scene,camera);
 console.log('PASS repeated transitions bound program ownership; rejected preparation leaves live lights intact');
 console.log('GATE NIGHTWARM: PASS');
})().catch(e=>{console.error(e.stack);console.log('GATE NIGHTWARM: FAIL');process.exitCode=1;});
