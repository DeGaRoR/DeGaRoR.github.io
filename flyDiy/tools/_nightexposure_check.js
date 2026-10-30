'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert');
const s=fs.readFileSync(process.env.NIGHT_EXPOSURE_SOURCE||path.join(__dirname,'../src/viewer/render_world.js'),'utf8'),a=s.indexOf('  const LE = { on:'),b=s.indexOf('  function dayApply()',a);assert(a>0&&b>a);
class Col { constructor(){this.r=this.g=this.b=1;}copy(c){this.r=c.r;this.g=c.g;this.b=c.b;return this;}lerp(c,k){this.r+=(c.r-this.r)*k;this.g+=(c.g-this.g)*k;this.b+=(c.b-this.b)*k;return this;} }
let base=1.12,writes=0;const sun={intensity:1,color:new Col()},hemi={intensity:.2,color:new Col(),groundColor:new Col()},renderer={toneMappingExposure:base},G={exposureBase:()=>base,setExposure(r,v){base=v;writes++;r.toneMappingExposure=v;}};
const c={C:()=>new Col(),window:{GFX:G},sun,hemi,renderer};vm.createContext(c);vm.runInContext(s.slice(a,b)+';this.test={LE,lightTake,lightEase,lightShow};',c);const T=c.test;
T.lightTake(1.12);assert(Number.isFinite(T.LE.setEx),'first write seeds last-written exposure instead of NaN');assert.strictEqual(base,1.12);assert.strictEqual(writes,1);
const target=.92*Math.pow(2,13)*(1.12/.92);sun.intensity=2.5e-6;hemi.intensity=1e-7;T.lightTake(target);
for(let i=1;i<=360;i++)T.lightEase(i*1000/30);assert(base>target*.998,'night adaptation reaches the authored schedule');assert(base<=target,'no exposure overshoot');assert.strictEqual(base,renderer.toneMappingExposure);
for(let i=361;i<=900;i++)T.lightEase(i*1000/30);const settled=writes;for(let i=901;i<=960;i++)T.lightEase(i*1000/30);assert.strictEqual(writes,settled,'settled light keeps zero redundant exposure writes');
T.LE.setEx=Infinity;T.LE.ex=5;T.lightShow(false);assert.strictEqual(base,5,'invalid prior sentinel recovers');const n=writes;T.LE.ex=NaN;T.lightShow(true);assert.strictEqual(writes,n,'invalid target is never written');
base=2;T.LE.ex=3;T.LE.setEx=2;T.lightShow(false);assert.strictEqual(base,3,'ordinary finite threshold path retained');
// A full day/night/day cycle must return to daylight without redundant writes.
T.LE.tEx=1.12;for(let i=961;i<=1560;i++)T.lightEase(i*1000/30);assert(Math.abs(base-1.12)<.003,'return to authored daylight');
// Another exposure writer (garage/eye controls) is respected by the next ease step.
base=4;renderer.toneMappingExposure=4;T.LE.tEx=4;T.lightEase(1561*1000/30);assert.strictEqual(T.LE.ex,4);
T.LE.on=false;T.lightTake(2);assert.strictEqual(base,2,'disabled ease applies target directly');
// Execute the actual post-selection light-aim block: lunar direction, solar direction, and horizon clamp.
const keyStart=s.indexOf('    const keyV = ATMO_ON'),keyEnd=s.indexOf('    const dim =',keyStart);assert(keyStart>0&&keyEnd>keyStart);
const vec={x:0,y:0,z:0,set(x,y,z){this.x=x;this.y=y;this.z=z;return this;}};
const aim={ATMO_ON:true,SKY_LIGHT:{isMoon:true},day:{moon:[.6,.8,0]},v:[0,.5,Math.sqrt(.75)],SUN:vec,SUN_MIN_Y:Math.sin(2*Math.PI/180),Math};vm.createContext(aim);
const apply=()=>vm.runInContext('(function(){'+s.slice(keyStart,keyEnd)+'})()',aim);apply();assert.strictEqual(vec.x,.6);assert.strictEqual(vec.y,.8,'night key follows moon, not the below-horizon sun');
aim.SKY_LIGHT.isMoon=false;apply();assert.strictEqual(vec.x,0);assert.strictEqual(vec.y,.5,'day direction unchanged');aim.ATMO_ON=false;aim.SKY_LIGHT.isMoon=true;apply();assert.strictEqual(vec.y,.5,'non-atmospheric path stays solar');
aim.ATMO_ON=true;aim.day.moon=[1,-.1,0];apply();assert.strictEqual(vec.y,aim.SUN_MIN_Y,'low key keeps existing shadow horizon clamp');assert(Math.abs(Math.hypot(vec.x,vec.y,vec.z)-1)<1e-12);
const rig=require(path.join(__dirname,'../src/viewer/light_rig.js'));assert.strictEqual(rig.exposureStops(-12),16,'measured summer-night readability');assert.strictEqual(rig.exposureStops(-9),10);assert.strictEqual(rig.exposureFor(33),.92,'noon target unchanged');
let last=rig.exposureStops(-90);for(let e=-89.99;e<=90;e+=.01){const n=rig.exposureStops(e);assert(n<=last+1e-10,'monotone adaptation');assert(last-n<.021,'no exposure discontinuity');last=n;}
console.log('GATE NIGHTEXPOSURE: PASS');
