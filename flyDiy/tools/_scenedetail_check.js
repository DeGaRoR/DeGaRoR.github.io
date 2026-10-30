'use strict';
const assert=require('assert'),path=require('path'),{performance}=require('perf_hooks');
global.window={location:{search:''},localStorage:{getItem:()=>null,setItem(){}}};
const FR=require(path.join(__dirname,'../src/viewer/flight_recorder.js'));
let t=100,calls=0;const clock=()=>{calls++;return t;};
assert.strictEqual(FR.make({now:clock}).sceneDetail,null);
const R=FR.make({frames:256,chunk:32,now:clock,sceneDetail:true});
for(let f=0;f<100;f++){
 R.begin(t,{steps:0});const before=calls,on=R.sceneDetail.begin();
 assert.strictEqual(on,f%31===0);
 if(!on)assert.strictEqual(calls,before,'unsampled frame reads no extra clock');
 for(let k=0;k<6;k++){t+=k+1;if(on)R.sceneDetail.lap(k);}
 R.lap(R.S.scene);R.end(true,[0,0,0]);t+=12;
}
const events=R.events.filter(e=>e[1]==='sceneDetail');assert.strictEqual(events.length,4);
for(let k=0;k<4;k++){assert.deepStrictEqual(events[k][3],[k*31,1,2,3,4,5,6]);assert.strictEqual(events[k][2],21);}
const H=R.header();assert.deepStrictEqual(H.sceneDetail.columns,['frame','pose','contact','damage','camera','meshes','water']);
const saved=JSON.parse(R.logParts().join(''));assert.strictEqual(saved.events.filter(e=>e[1]==='sceneDetail').length,4);
assert.strictEqual(saved.header.sceneDetail.samples,4);assert.strictEqual(H.sceneDetail.selfUsMean,0);
// Compare whole recorder-frame cost, with identical guards, after warm-up.
function bench(on){const r=FR.make({sceneDetail:on}),n=30000,cg=[0,0,0],pc={steps:0};
 const loop=()=>{r.begin(performance.now(),pc);const s=r.sceneDetail&&r.sceneDetail.begin();for(let k=0;k<6;k++)if(s)r.sceneDetail.lap(k);r.end(true,cg);};
 for(let i=0;i<10000;i++)loop();const t=performance.now();for(let i=0;i<n;i++)loop();return (performance.now()-t)*1000/n;
}
const off=[],on=[];for(let k=0;k<5;k++){if(k%2){on.push(bench(true));off.push(bench(false));}else{off.push(bench(false));on.push(bench(true));}}
const median=a=>a.sort((a,b)=>a-b)[a.length>>1],a=median(off),b=median(on);assert(b-a<50,'sampled detail adds under 50us per frame in isolated recorder check');
console.log(JSON.stringify({sampled:events.length,offUs:a,onUs:b,deltaUs:b-a,off,on}));
console.log('GATE SCENEDETAIL: PASS');
