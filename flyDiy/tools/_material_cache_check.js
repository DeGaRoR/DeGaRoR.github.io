'use strict';
// Guard the experimental transformation against upstream shader changes.
const assert=require('assert'),fs=require('fs'),path=require('path');
const cache=require('../src/viewer/ground_material_cache.js');
const file=path.join(__dirname,'../reports/evidence/PERFORMANCE-2026-11-19/material-cache/sources.json');
const reference=JSON.parse(fs.readFileSync(file,'utf8'))[0];
for(const space of ['screen','world']){
 const s=cache.deriveSources(reference.vs,reference.fs,{space});
 assert.strictEqual(s.vs,reference.vs);
 const main=text=>text.slice(text.lastIndexOf('void main() {'));
 assert(main(s.bakeFs).includes('t = sSplat('),'Material recipe must remain in builder');
 assert(!main(s.bakeFs).includes('PhysicalMaterial material;'),'Builder must stop before lighting');
 assert(!main(s.litFs).includes('t = sSplat('),'Lighting must not rebuild material');
 assert(main(s.litFs).includes('PhysicalMaterial material;'),'Lighting must remain');
 assert(s.bakeFs.includes('cacheNormal = vec4('));
 assert(s.litFs.includes('roughnessFactor = cachedGround.a;'));
 assert(s.litFs.includes('texture2D(uMaterialCacheNormal, cachedUv)'));
 assert.throws(()=>cache.deriveSources(reference.vs,reference.fs.replace('PhysicalMaterial material;','unexpected upstream change'),{space}));
}
assert.throws(()=>cache.deriveSources(reference.vs,reference.fs,{space:'invalid'}));
assert.strictEqual(cache.expandIncludes('#include <a>',{a:'#include <b>',b:'expanded'}),'expanded');
assert.throws(()=>cache.expandIncludes('#include <missing>',{}));
assert.throws(()=>cache.expandIncludes('#include <a>',{a:'#include <a>'}));
const painted=reference.fs.replace('float roughnessFactor = roughness;','diffuseColor.rgb *= vec3(0.12345);\nfloat roughnessFactor = roughness;');
const whole=cache.deriveSources(reference.vs,painted,{space:'screen',completeMaterial:true});
assert(whole.bakeFs.includes('diffuseColor.rgb *= vec3(0.12345);'));
assert(!whole.litFs.includes('diffuseColor.rgb *= vec3(0.12345);'),'Painted material must not be applied twice');
const noCameraHeader=reference.fs.replace(/uniform\s+(?:highp\s+)?vec3\s+cameraPosition\s*;/,'');
const earlyEye=cache.deriveSources(reference.vs,noCameraHeader).bakeFs;
assert(earlyEye.includes('uniform highp vec3 uMaterialBakeEye;'),'Pre-compilation hook must declare its own eye uniform');
assert(earlyEye.indexOf('uniform highp vec3 uMaterialBakeEye;')<earlyEye.indexOf('uMaterialBakeEye.xz'),'Eye must be declared before helper functions use it');
const packed=cache.deriveSources(reference.vs,reference.fs,{packed:true,completeMaterial:true});
assert(packed.bakeFs.includes('out highp uvec4 cachePacked;'));assert(!packed.bakeFs.includes('out highp vec4 pc_fragColor;'));
assert.strictEqual((packed.bakeFs.match(/packHalf2x16\(/g)||[]).length,4);
assert(packed.litFs.includes('uniform highp usampler2D uMaterialCachePacked;'));
assert.strictEqual((packed.litFs.match(/unpackHalf2x16\(/g)||[]).length,4);
console.log('Material-cache source guards passed (experimental only).');
