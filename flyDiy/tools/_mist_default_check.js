'use strict';
const fs=require('fs'),vm=require('vm'),assert=require('assert/strict'),path=require('path'),source=fs.readFileSync(path.join(__dirname,'../src/viewer/forest_mist.js'),'utf8');
function load({q='',gfx=null,on=null,welcome=null,profile=null}={}){const c={module:{exports:{}},URLSearchParams,location:{search:q},localStorage:{getItem:k=>k==='flydiy.gfx'?(gfx&&JSON.stringify(gfx)):k==='flydiy.fmist'?on:null},window:{WELCOME:welcome,PROFILE:profile&&{get:()=>profile}}};vm.createContext(c);vm.runInContext(source,c);return c.module.exports;}
for(const gfx of [null,{preset:'gamer',clouds:'half'},{preset:'ultra',clouds:'full'}])assert(load({gfx}).A);
for(const preset of ['laptop','potato','retro'])assert(load({gfx:{preset}}).C);
assert(load({gfx:{preset:'gamer',clouds:'off'}}).C);
assert(load({q:'?gfx=gamer',gfx:{preset:'retro',clouds:'off'}}).A);
assert(load({q:'?gfx=potato',gfx:{preset:'gamer',clouds:'half'}}).C);
assert(load({welcome:{SOFT:true}}).C);assert(load({q:'?soft=0',welcome:{SOFT:true}}).A);
assert(load({welcome:{pick:'retro'}}).C);assert(load({profile:'laptop'}).C);
assert(load({q:'?fmist=c'}).C);assert.equal(load({q:'?fmist=c'}).automatic,false);
assert.equal(load({on:'0'}).ON,false);assert(load({on:'1'}).A);
const gfxSource=fs.readFileSync(path.join(__dirname,'../src/viewer/gfx_settings.js'),'utf8');
function menu(method){const store={},w={location:{search:'',reload(){w.reloads++;}},reloads:0,localStorage:{getItem:k=>store[k]??null,setItem:(k,v)=>store[k]=String(v)},requestAnimationFrame:()=>1,FMIST:{ON:true,A:method==='a',B:false,C:method==='c',automatic:true,methodForClouds:m=>m==='off'?'c':'a',use:{a:method==='a',b:false,c:method==='c'}}};w.window=w;vm.runInNewContext(gfxSource,{window:w,setInterval:()=>0,clearInterval:()=>{}});return w;}
const a=menu('a');a.GFX.set('fmist','off');assert.equal(a.FMIST.use.a,false);a.GFX.set('fmist','on');assert.equal(a.FMIST.use.a,true);assert.equal(a.reloads,0);a.GFX.set('clouds','off');assert.equal(a.reloads,1);
const c=menu('c');c.GFX.set('clouds','half');assert.equal(c.reloads,1);
console.log('Approved mist default: cloud/cloudless fallback, explicit/off override, profile/welcome/software selection, live off/on and cloud-method reload passed.');
