'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert');
const app=fs.readFileSync(process.env.INTRO_APP||path.join(__dirname,'../src/viewer/app.js'),'utf8');
const a=app.indexOf('  function shedFrameState() {'),b=app.indexOf('  function setEnvSource(',a);assert(a>0&&b>a);
const calls=[],room={id:'room'};const c={ATMO:{MIST:{room},setAP:on=>calls.push(['ap',on])},shedDayTick:()=>calls.push(['room',c.ATMO.MIST.room]),envSliceStep:()=>calls.push(['probe'])};
vm.createContext(c);vm.runInContext(app.slice(a,b),c);c.shedFrameState();assert.deepStrictEqual(calls,[['ap',false],['room',room],['probe']]);
const guard=app.match(/if \(!stIntro \|\| !stIntroAt\) shedFrameState\(\);/);assert(guard,'room work gated while intro owns world');
vm.runInContext('this.tick=()=>{'+guard[0]+'};',c);
for(const [intro,at,n]of [[null,null,3],[{},[1,2,3],0],[{},null,3]]){calls.length=0;c.stIntro=intro;c.stIntroAt=at;c.tick();assert.strictEqual(calls.length,n);}
const swap=app.slice(app.indexOf('  function storyIntroSwap() {'),app.indexOf('  // THE LOOP\'S DOORS:'));
assert(swap.indexOf('ATMO.MIST.room = W.mist;')<swap.indexOf('shedFrameState();'),'room mist restored before recomputing its tables');
assert(swap.indexOf('shedFrameState();')<swap.indexOf('setExp(W.exp);'),'saved exposure restored after room update');
console.log('GATE INTROSTATE: PASS');
