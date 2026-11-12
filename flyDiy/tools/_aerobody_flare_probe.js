#!/usr/bin/env node
// AERO-BODY (PHYSICS_V 8): the Rufus's flare FLOWN - power off, the stick on its stop (ramped over 4 s), the wings held
// level by the ailerons, from the pilot's DOWNWIND; the settled speed over Vs (the last 10 s airborne, 400 m below the
// start at most). Not RUFUS-CERT's own protocol (it read 1.16; this probe reads 1.266 on PHYSICS_V 7): it measures the
// MOVE between two cores, which GATE DESIGNCHECK's flown reference takes (1.16 x 1.239 / 1.266 = 1.135).
//   node tools/_aerobody_flare_probe.js [<tree root>] [<build>]   -> one JSON line
const path=require('path'),fs=require('fs');const root=process.argv[2]||require('path').join(__dirname,'..'),file=process.argv[3]||'tools/fixtures/repro/rufus_2026-10-18.json';
const C=require(path.join(root,'tools/flight_core.js')),BJ=require(path.join(root,'tools/_bake_joined.js'));BJ.loadPanel();
const j=JSON.parse(fs.readFileSync(path.join(root,file),'utf8'));const J=BJ.bakeJoined(j.spec||j).spec;
const def=C.buildGen(J),W=C.makeWorld(),sim=C.makeSim(def,W);sim.reset(0);const ap=C.makePilot(sim,def);const dt=1/60;let t=0;
while(ap.phase!=='DOWNWIND'&&t<300){ap.update(dt);sim.step(dt);t+=dt;}
const D=180/Math.PI,bank=()=>{const[,y,z]=sim.axes();return Math.atan2(z[1],y[1])*D;};
const V=()=>Math.hypot(...sim.cgVel());const Vs=def.params.gen.Vs;const ser=[];
const h0=sim.cgPos()[1];const al=[];for(let i=0;i<60*40;i++){const s=i*dt;sim.ctl.thr=0;sim.ctl.de=-Math.min(1,s/4);sim.ctl.da=Math.max(-1,Math.min(1,-0.05*bank()));sim.ctl.dr=0;sim.step(dt);if(i%15===0){ser.push(V());al.push(sim.cgPos()[1]);}}
const ok=ser.map((v,i)=>i>=4*12&&al[i]>h0-400&&al[i]>15?v:null).filter(v=>v!=null);const tail=ok.slice(-4*10),mean=tail.reduce((a,b)=>a+b,0)/tail.length,min=Math.min(...ok);
console.log(JSON.stringify({phase:ap.phase,t:+t.toFixed(1),Vs:+Vs.toFixed(2),settled:+(mean/Vs).toFixed(3),minAfter10:+(min/Vs).toFixed(3),h0:+h0.toFixed(0),alt:+sim.cgPos()[1].toFixed(0),n:ok.length,ser:ser.filter((v,i)=>i%8===0).map(v=>+(v/Vs).toFixed(2))}));
