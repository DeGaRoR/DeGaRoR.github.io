'use strict';
// Execute the real poll body with shared, changing and disposed programs.
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert');
const text=fs.readFileSync(path.join(__dirname,'../src/viewer/app.js'),'utf8');
const section=text.slice(text.indexOf('function compileSliced('));
const start=section.indexOf('const poll = () => {'),end=section.indexOf('\n        };',start);
assert(start>=0&&end>start);
let linked=false,calls=0,extraCalls=0,finished=0,next;
const shared={isReady(){calls++;return linked;}},extra={isReady(){extraCalls++;return false;}};
const mats=new Set(),properties=new Map();
for(let i=0;i<100;i++){const m={};mats.add(m);properties.set(m,{currentProgram:shared,programs:new Map([['a',shared]])});}
const disposed={};mats.add(disposed);properties.set(disposed,{});
const ctx={mats,renderer:{properties:{get:m=>properties.get(m)}},sc:{},res(){finished++;},setTimeout(f,ms){assert.equal(ms,10);next=f;}};
vm.runInNewContext(section.slice(start,end+11)+';poll();',ctx);
assert.equal(calls,1);assert.equal(mats.size,100);assert.equal(finished,0);
// A variant added while waiting must still hold the reveal.
const m=[...mats][0];properties.get(m).programs.set('new',extra);linked=true;
next();assert.equal(calls,2);assert.equal(extraCalls,1);assert.equal(mats.size,1);assert.equal(finished,0);
// Disposal removes that final program; no stale false cache may hold the job.
properties.set(m,{});next();assert.equal(mats.size,0);assert.equal(finished,1);
console.log('COMPILE POLL: PASS (100 shared materials, one query per tick, changing variants and disposal)');
