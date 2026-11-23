'use strict';
const fs=require('fs'),vm=require('vm'),assert=require('assert'),path=require('path'),source=fs.readFileSync(path.join(__dirname,'../src/viewer/skin_scuff.js'),'utf8');
function load(query){const c={module:{exports:{}},URLSearchParams,location:{search:query}};vm.createContext(c);vm.runInContext(source,c);return c.module.exports;}
const sharedImage={},hook=function(sh){sh.uniforms.tGrunge={value:sharedImage};sh.fragmentShader='uniform sampler2D tGrunge;\n'+sh.fragmentShader;};hook.toString=()=> 'real-weather-hook';
function shader(){return {uniforms:{},vertexShader:'#include <common>\nvoid main(){#include <begin_vertex>}',fragmentShader:'#include <common>\nvoid main(){#include <lights_physical_fragment>}'};}
const S=load('?scuffopt=1'),W=S.waker(),U={tDmgG:{value:sharedImage}},metal=S.wrap(hook,'live',U,W,0),fabric=S.wrap(hook,'live',U,W,1),general=S.wrap(hook,'live',U,W,-1),m={};
assert.strictEqual(metal.toString(),fabric.toString(),'Intact keys must not multiply by class');
let sh=shader();metal.call(m,sh);assert(!sh.fragmentShader.includes('#define DMG_SCUFF 1'));
W.pre++;S.wakeSet(W);assert.notStrictEqual(metal.toString(),fabric.toString());
for(const [wrap,constant]of [[metal,'0.0'],[fabric,'1.0'],[general,null]]){sh=shader();wrap.call(m,sh);assert(!sh.fragmentShader.includes('#define GD_OFF'));assert.equal((sh.fragmentShader.match(/uniform sampler2D tGrunge;/g)||[]).length,1);assert(!sh.fragmentShader.includes('uniform sampler2D tDmgG;'));assert.strictEqual(sh.uniforms.tGrunge.value,sharedImage);assert(sh.fragmentShader.includes(constant?'float dCls = '+constant+';':'float dCls = mod(vDmgD.w, 8.0);'));assert(sh.fragmentShader.includes('dmgStreak'));assert(sh.fragmentShader.includes('uDmgCol[1]'));}
W.pre--;S.wakeSet(W);assert.strictEqual(metal.toString(),fabric.toString());
const D=load(''),dw=D.waker();dw.pre++;D.wakeSet(dw);sh=shader();D.wrap(hook,'live',U,dw,0).call({},sh);assert(sh.fragmentShader.includes('#define GD_OFF 1'));assert(sh.fragmentShader.includes('float dCls = mod(vDmgD.w, 8.0);'));
console.log('Scuff opt: awake/asleep keys, general fallback, per-class source, shared texture identity and original default passed.');
