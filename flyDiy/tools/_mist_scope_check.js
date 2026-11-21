'use strict';
const fs=require('fs'),vm=require('vm'),assert=require('assert'),path=require('path');
function get(mode){const c={module:{exports:{}},URLSearchParams,location:{search:'?fmist='+mode}};vm.createContext(c);for(const f of ['forest_mist.js','atmo.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../src/viewer',f),'utf8'),c);return c.module.exports;}
const on=get('c');assert(on.GLSL.MIST.includes('float fmDens'));assert(on.GLSL.MIST.includes('float odP = fmOD'));assert.strictEqual(on.GLSL.MIST,on.GLSL.MIST_CLOUD);
for(const mode of ['a','ac','b','0']){const a=get(mode),surface=a.GLSL.MIST,cloud=a.GLSL.MIST_CLOUD;assert.deepStrictEqual(JSON.parse(JSON.stringify(a.AP)),JSON.parse(JSON.stringify(on.AP)));
 assert.equal(surface.includes('float fmDens'),mode==='ac');assert.equal(cloud.includes('float fmDens'),mode==='a'||mode==='ac');assert((cloud.match(/float fmDens\(/g)||[]).length<=1);assert.equal(surface.includes('float odP = fmOD'),mode==='ac');
 if(mode==='a')assert(cloud.includes('uniform vec4 uMist[13]'));
}
console.log('Mist scopes: selected veil/cloud/card/off paths, unchanged atlas layout, uniforms and no duplicate density library passed.');
