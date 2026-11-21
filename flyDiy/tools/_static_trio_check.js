'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert');
const src=fs.readFileSync(path.join(__dirname,'../src/viewer/parked.js'),'utf8');
const fn=name=>{const a=src.indexOf('  function '+name+'(');assert(a>=0,name);const b=src.indexOf('\n  }',a);return src.slice(a,b+4);};
const queued=[],ctx={STATIC_TRIO:true,TRIO_KEYS:['arch:cub','arch:c172','arch:jodel'],REC:{},
 enqueue:k=>queued.push(k),canCapture:()=>{throw Error('live capture forbidden');},W:{FLYDIY_FLEET:true},Math,String};
vm.createContext(ctx);vm.runInContext(fn('staticKey')+'\n'+fn('capture'),ctx);
for(const key of ['mine:My Cub','mine:cessna','mine:My dear jodel','mine:birdman','arch:chinook','stock:other']){
 const k=ctx.staticKey(key);assert(ctx.TRIO_KEYS.includes(k));assert.equal(ctx.staticKey(k),k);assert.equal(ctx.capture(key),null);assert.equal(queued.at(-1),k);
}
const rec={key:'arch:cub',cooked:true};ctx.REC['arch:cub']=rec;assert.equal(ctx.capture('mine:My Cub'),rec);
const line=src.split('\n').find(l=>l.includes('const fleetOn ='));assert(line);vm.runInContext(line+'\nglobalThis.testFleetOn=fleetOn;',ctx);
assert.equal(ctx.testFleetOn(),false,'even explicit fleet=true must not enable player bakes in this test');
ctx.STATIC_TRIO=false;assert.equal(ctx.staticKey('mine:My Cub'),'mine:My Cub');assert.equal(ctx.testFleetOn(),true);
console.log('STATIC TRIO: PASS (only three stable prop keys, capture bypass, existing records, fleet override, opt-out)');
