'use strict';
const assert=require('assert'),fs=require('fs'),path=require('path'),vm=require('vm');
const cache=require('../src/viewer/ground_material_cache.js'),context={console};
vm.createContext(context);vm.runInContext(fs.readFileSync(path.join(__dirname,'../vendor/three.min.js'),'utf8'),context);
const T=context.THREE,scene=new T.Scene(),ground=new T.MeshStandardMaterial(),aircraft=new T.MeshStandardMaterial();
ground.groundFamily=new Set([ground]);
const a=new T.Mesh(new T.PlaneGeometry(),ground),b=new T.Mesh(new T.BoxGeometry(),aircraft);scene.add(a,b);
let target=null;const calls=[];
let shadowCalls=0,renderCalls=[];
const renderer={autoClear:true,shadowMap:{autoUpdate:true,needsUpdate:true,render(){shadowCalls++;}},
 getRenderTarget:()=>target,setRenderTarget:value=>{target=value;},getActiveCubeFace:()=>0,getActiveMipmapLevel:()=>0,
 getViewport:v=>v.set(0,0,32,32),getPixelRatio:()=>1,getClearColor:c=>c.set(0),getClearAlpha:()=>1,setClearColor(){},clear(){},
 render(sc){this.shadowMap.render();const materials=[];let lights=0;sc.traverseVisible(o=>{if(o.isLight)lights++;if(o.material&&o.material.visible)materials.push(o.material);});renderCalls.push({sc,materials,lights,shadowCalls});},
 compile(sc,cam,lights){const materials=[];sc.traverse(o=>{if(o.material)materials.push(o.material);});calls.push({materials,target,lights});return new Set(materials);}};
const previousCompile=renderer.compile,service=cache.install(T,renderer),result=renderer.compile(scene,new T.PerspectiveCamera());
assert.strictEqual(calls.length,2);assert.strictEqual(calls[0].materials.length,2);
assert.strictEqual(calls[1].materials.length,1,'Builder pass must not compile non-ground scene materials');
assert.strictEqual(calls[1].materials[0].groundCacheRole,'baker');
assert(calls[1].lights.isScene);assert.strictEqual(calls[1].lights.children.length,0,'Builder light signature must be fixed and empty');
assert.strictEqual(calls[1].lights.fog,scene.fog);
assert.strictEqual([...result].filter(m=>m===aircraft).length,1);
assert.strictEqual(a.material,ground);assert.strictEqual(b.material,aircraft);assert.strictEqual(target,null);
const light=new T.DirectionalLight();scene.add(light);const camera=new T.PerspectiveCamera();
renderer.render(scene,camera);
assert.strictEqual(renderCalls.length,2);assert.notStrictEqual(renderCalls[0].sc,scene,'Builder must use an isolated scene');
assert.strictEqual(renderCalls[0].materials.length,1);assert.strictEqual(renderCalls[0].materials[0].groundCacheRole,'baker');
assert.strictEqual(renderCalls[0].lights,0);assert.strictEqual(renderCalls[0].shadowCalls,0,'Material pass must bypass full-scene shadow hooks');
assert.strictEqual(renderCalls[1].sc,scene);assert.strictEqual(renderCalls[1].lights,1);assert.strictEqual(shadowCalls,1);
assert.strictEqual(a.parent,scene);assert.strictEqual(a.material,ground);assert.strictEqual(b.material,aircraft);assert(light.visible);
assert.strictEqual(renderer.shadowMap.autoUpdate,true);assert.strictEqual(renderer.shadowMap.needsUpdate,true);assert.strictEqual(target,null);
service.dispose();assert.strictEqual(renderer.compile,previousCompile);
a.geometry.dispose();b.geometry.dispose();ground.dispose();aircraft.dispose();
console.log('Ground-cache integration scope/restoration check passed.');
