'use strict';
const fs=require('fs'),vm=require('vm'),assert=require('assert'),path=require('path');
const source=fs.readFileSync(path.join(__dirname,'../src/viewer/boot.js'),'utf8');
function make(src=source){let time=130000;const c={module:{exports:{}},window:{},performance:{now:()=>time},setTimeout:()=>1};vm.createContext(c);vm.runInContext(src.replace('B.ready = ready;','B.testWatch = watch; B.ready = ready;'),c);const b=c.module.exports;b.state='landing';b.opt={t0:0,hard:120000,idle:30000,quietFrames:3};b._progT=129000;b.lastEvent=129000;b._watchArmed=126000;return{b,clock:t=>time=t};}
let {b,clock}=make();b.testWatch();assert.equal(b.state,'landing');assert(!b.log.some(e=>e.k==='fail'));for(let i=0;i<3;i++){clock(130100+i*16);b.frame();}assert.equal(b.state,'gone');assert(b.log.some(e=>e.k==='ready'));
({b}=make());b.lastEvent=90000;b._progT=90000;b.testWatch();assert(b.log.some(e=>e.k==='fail'),'Stalled landing must still fail');
({b,clock}=make());clock(600001);b.lastEvent=600000;b._progT=600000;b.testWatch();assert(b.log.some(e=>e.k==='fail'),'Absolute cap must still fail');
const old=source.replace("(B.state === 'loading' || B.state === 'landing')","B.state === 'loading'");({b}=make(old));b.testWatch();assert(b.log.some(e=>e.k==='fail'),'Negative control reproduces premature landing failure');
console.log('BOOT landing watchdog: healthy quiet-frame handoff passes; idle/absolute failures retained; old behavior reproduced.');
