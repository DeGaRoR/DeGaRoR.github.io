// afb0220_measure.js - JOLENE 02/20 (AFB-0220): the rough lane's centreline against the band's, and cross-sections.
//   node tools/afb0220_measure.js          -> [[t, lane - band (m), band, lane], ...] at the lane profile's five points,
//                                             then cross-sections (u: heights at v -40 .. 50; ~ = water over the ground)
// The lane (xw_rough) levels its grade at its own centre's ground, so its profile points carry the offset that lays it on
// w2's heights: subtract the printed differences from tools/jolene_parts/afb0220.py LANE_PROFILE, re-splice, re-run (two
// passes converge: the lane's falloff 6 m stops 2.25 m short of the band's centreline). The micro bumps are taken off for
// the reading (MICRO=1 keeps them).
'use strict';
const T=__dirname+'/';
require(T+'flight_core.js');
const fs=require('fs');const IN=require(T+'island_node.js');
const J=JSON.parse(fs.readFileSync(T+'fixtures/island_jolene.json','utf8'));
const lane=J.layers.runways.find(r=>r.id==='xw_rough');
if(!process.env.MICRO) delete lane.micro;
const W=IN.islandWorld('jolene',{premises:JSON.stringify(J)});
const HDG=1.9908,d=[Math.cos(HDG),Math.sin(HDG)],n=[-d[1],d[0]],c=[598.7,-129.73],L=1757.8,e0=[c[0]-d[0]*L/2,c[1]-d[1]*L/2];
const P=(u,v)=>[e0[0]+d[0]*u+n[0]*v,e0[1]+d[1]*u+n[1]*v];
const H=(u,v)=>W.terrainH(...P(u,v));
const out=[];
for(const t of [0,0.25,0.5,0.75,1]){const u=330+1000*t, uu=Math.min(1329.5,Math.max(330.5,u));const hb=H(uu,0),hl=H(uu,-17.25);out.push([t,+(hl-hb).toFixed(3),hb.toFixed(2),hl.toFixed(2)]);}
console.log(JSON.stringify(out));
// cross sections
for(const u of [200,400,700,1000,1300,1430,1600]){const r=[];for(const v of [-40,-30,-26,-20,-14,-9,-8,-6,0,6,8,10,13,16,20,25,30,40,50]){const p=P(u,v);const h=W.terrainH(p[0],p[1]),w=W.waterH?W.waterH(p[0],p[1]):-1e9;r.push(h.toFixed(2)+(w>h?'~':''));}console.log(u,r.join(' '));}
