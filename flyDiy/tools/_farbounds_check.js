'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert');
const THREE=require('../vendor/three.min.js');const src=fs.readFileSync(path.join(__dirname,'../src/viewer/render_world.js'),'utf8');
const match=/const farBounds = (\(geo, pos\) => \{[\s\S]*?\n      \});/.exec(src);assert(match,'shipped FARLOD bounds helper exists');
const fast=vm.runInNewContext('('+match[1]+')',{THREE,Number,Math});
const geo=p=>new THREE.BufferGeometry().setAttribute('position',new THREE.BufferAttribute(p,3));
const fields=g=>[...g.boundingBox.min.toArray(),...g.boundingBox.max.toArray(),...g.boundingSphere.center.toArray(),g.boundingSphere.radius];
let seed=0x4c28;const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)|0;return (seed>>>0)/4294967296};
const cases=[[],[0,0,0],[-0,0,-0,0,-0,0],[1,2,3,-4,-5,-6],[1e30,-1e-30,0,-1e30,1e-30,0]];
for(let c=0;c<80;c++){const a=[];const n=c===79?100000:1+Math.floor(rand()*600);for(let i=0;i<n;i++)a.push((rand()-.5)*24000,(rand()-.5)*3000,(rand()-.5)*24000);cases.push(a)}
cases.push([NaN,0,0,1,2,3],[Infinity,0,0,1,2,3],[-Infinity,0,0,1,2,3]);
const error=console.error;let checked=0;
try{console.error=()=>{};for(const a of cases){const p=new Float32Array(a),before=Buffer.from(p.buffer).toString('hex'),old=geo(p),next=geo(p);old.computeBoundingSphere();old.computeBoundingBox();fast(next,p);const x=fields(old),y=fields(next);for(let i=0;i<x.length;i++)assert(Object.is(x[i],y[i]),'bounds parity case '+checked+' field '+i+': '+x[i]+' / '+y[i]);assert.strictEqual(Buffer.from(p.buffer).toString('hex'),before,'positions untouched');checked++;}}
finally{console.error=error;}
const p=new Float32Array(cases[84]),base=THREE.Vector3.prototype.fromBufferAttribute;let calls=0;
try{THREE.Vector3.prototype.fromBufferAttribute=function(){calls++;return base.apply(this,arguments)};const a=geo(p);a.computeBoundingSphere();a.computeBoundingBox();const slow=calls;calls=0;fast(geo(p),p);assert.strictEqual(calls,0,'fast path avoids accessor walks');assert(slow>=p.length,'legacy control executes at least three accessor walks');console.log('  ok   legacy '+slow+' Vector3 attribute reads -> 0 on '+p.length/3+' vertices');}
finally{THREE.Vector3.prototype.fromBufferAttribute=base;}
console.log('  ok   exact bounds and unchanged position buffers across '+checked+' random, signed-zero, empty, large and nonfinite cases');
console.log('GATE FARBOUNDS: PASS');
