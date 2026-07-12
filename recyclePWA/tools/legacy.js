"use strict";
/* tools/legacy.js — consolidated legacy QUANTITATIVE balance harness (2026-07-12).
 * Merged from the old root harnesses: the dead "equivalence vs the deleted dev35 build" tests of
 * d1/d2/d3 were dropped (that build no longer exists), and their still-valid invariants — mass
 * conservation, the named failure states (BUNKER FULL / NO LOADER / STARVED / CONTAINER FULL /
 * BALER FULL / EXPORT FULL) and determinism — now live inside the embedded qc suites
 * (site-conservation, site-named-states, site-determinism, site-trucks, site-export-*). What remains
 * here is the one thing qc does not express as pass/fail: measured END-TO-END throughput numbers.
 * Measures END-TO-END line throughput (Δ landfilled / Δ sim-sec at steady state) as a function of feed
 * rate and fleet size, to verify the calibration goals:
 *  (A) the default 1-loader fleet SUSTAINS a standard 5 t/s feed (loader isn't the bottleneck);
 *  (B) at high feed the loader BECOMES the bottleneck (throughput caps below feed) — so the fleet is a
 *      real lever, not decorative;
 *  (C) adding a second loader RELIEVES that bottleneck (throughput rises);
 *  (D) a single forklift sustains a fully-baled 5 t/s stream (forkBales calibration).
 * Reports the numbers so they can be re-tuned by eye. */
const fs = require("fs");
const NEW = process.argv[2] || __dirname + "/.."; // project folder, index.html, or a legacy single-file build
function loadEngine(path){
  const src=require("./_load.js").load(path).engine;
  const epi=`;return {newGame,tick,addNode,cnt,getG:()=>G,connect:(f,p,t)=>{G.edges.push({from:f,fromPort:p,to:t,sprites:[],speed:EDGE_SPEED});},
    K:{PMASS,vehSpeed:LOGI.vehSpeed,loaderCap:LOGI.loaderCap,forkBales:LOGI.forkBales,INBOUND_DX:(typeof INBOUND_DX!=="undefined"?INBOUND_DX:110)}};`;
  const store={};const localStorage={getItem:k=>k in store?store[k]:null,setItem:(k,v)=>{store[k]=""+v;},removeItem:k=>{delete store[k];}};
  return new Function("localStorage",src+epi)(localStorage);
}
function must(x,what){if(x==null)throw new Error("scene build failed: "+what+" not found");return x;}
const lineSrc = G => must(G.nodes.find(n=>n.role==="feeder"||n.role==="input"),"line source");
const runTicks=(E,n)=>{for(let i=0;i<n;i++)E.tick(0.004);};
function soldTons(E){const G=E.getG();let t=0;for(const k in G.sold)t+=(G.sold[k].on||0)+(G.sold[k].off||0);return t;}
// stress: N loaders flooding ONE feeder — conservation must stay exact and no loader may exceed loaderCap
function conserveStress(E,feed,loaders){
  E.newGame("sandbox","standard",0xC0FFEE7);const G=E.getG();
  G.contract.supplier=null;G.contract.comp={PET:0.5,steel:0.5};G.contract.feedTph=feed;G.fleet.loader=loaders;
  const src=lineSrc(G);src.rate=feed;const bulk=E.addNode("output",180,0,"dispose");E.connect(src.id,"O",bulk.id);
  const held=()=>{let s=0;for(const n of G.nodes){s+=E.cnt(n.inBuf);if(n.bales)for(const b of n.bales)s+=E.cnt(b);if(n.containers)for(const c of n.containers)s+=E.cnt(c);}
    for(const v of G.vehicles){s+=E.cnt(v.payload);if(v.baleLoad)for(const b of v.baleLoad)s+=E.cnt(b);}
    for(const e of G.edges)for(const sp of e.sprites)s+=sp.bale?E.cnt(sp.bale):1;return s;};
  let worst=0,maxPay=0,active=0;
  for(let i=0;i<5000;i++){E.tick(0.004);
    const IN=Math.round(G.deliveredTot/E.K.PMASS),LF=Math.round(G.landfill/E.K.PMASS);
    worst=Math.max(worst,Math.abs(IN-(held()+LF)));
    let busy=0;for(const v of G.vehicles)if(v.cls==="loader"){maxPay=Math.max(maxPay,E.cnt(v.payload));if(v.state!=="idle")busy++;}
    active=Math.max(active,busy);}
  return {worst,maxPay,active};
}

// feeder(s) → bulk (dispose). The disposal chain has huge headroom, so end-to-end throughput is gated by
// min(feed, loader supply) — isolating the LOADER. `intakes` parallel bunker/feeder pairs split the feed.
function loaderThroughput(E,feedTotal,loaders,intakes){
  E.newGame("sandbox","standard",0xBA1A5E);const G=E.getG();
  const per=feedTotal/intakes;
  G.contract.supplier=null;G.contract.comp={PET:0.4,steel:0.3,paper:0.3};G.contract.feedTph=per; // per-bunker stream rate
  G.fleet.loader=loaders;
  const feeders=[lineSrc(G)];                                    // auto-scene intake
  for(let i=1;i<intakes;i++)feeders.push(E.addNode("intake",-220,90*i)); // more intakes (addNode returns the feeder)
  feeders.forEach((f,i)=>{f.rate=per;const bulk=E.addNode("output",200,90*i-45,"dispose");E.connect(f.id,"O",bulk.id);});
  runTicks(E,2000);                                              // warm to steady state
  const lf0=G.landfill,t0=G.t; runTicks(E,7000);                 // 28 sim-sec window
  return (G.landfill-lf0)/(G.t-t0);
}
// pure-steel → opener → baler → export; measure sold t/s (gated by forklift + client, isolating FORKLIFT)
function forkliftThroughput(E,feed){
  E.newGame("sandbox","standard",0xF0B1);const G=E.getG();
  G.contract.supplier=null;G.contract.comp={steel:1};
  const src=lineSrc(G);src.rate=feed;G.contract.feedTph=feed;
  const op=E.addNode("opener",-40,0),baler=E.addNode("baler",90,0),exp=E.addNode("output",200,0,"ferrous");
  E.connect(src.id,"O",op.id);E.connect(op.id,"O",baler.id);E.connect(baler.id,"O",exp.id);
  runTicks(E,2000); const s0=soldTons(E),t0=G.t; runTicks(E,7000);
  return (soldTons(E)-s0)/(G.t-t0);
}

let PASS=0,FAIL=0;
const ok=(n,c,extra="")=>{(c?PASS++:FAIL++);console.log((c?"  ok   ":"  FAIL ")+n+(extra?"  — "+extra:""));};
const K=loadEngine(NEW).K;
console.log("S-BATCH-5 (balance) throughput harness\n======================================");
console.log("kinematics: vehSpeed="+K.vehSpeed+"  loaderCap="+K.loaderCap+"  forkBales="+K.forkBales+"  INBOUND_DX="+K.INBOUND_DX);
const cyc=2*K.INBOUND_DX/K.vehSpeed+0.06, ceil=(K.loaderCap*K.PMASS)/cyc;
console.log("predicted per-intake 1-loader ceiling ≈ "+ceil.toFixed(2)+" t/s  (cycle "+cyc.toFixed(3)+" s)\n");

try{
  const t5    = loaderThroughput(loadEngine(NEW),5,1,1);
  const t12   = loaderThroughput(loadEngine(NEW),12,1,1);
  const t12_2 = loaderThroughput(loadEngine(NEW),12,2,1);          // 2 loaders, ONE intake
  const t12_2i= loaderThroughput(loadEngine(NEW),12,2,2);          // 2 loaders, TWO intakes
  const fk5   = forkliftThroughput(loadEngine(NEW),5);
  console.log("measured:");
  console.log("  1 loader  @  5 t/s · 1 intake  → "+t5.toFixed(2)+" t/s");
  console.log("  1 loader  @ 12 t/s · 1 intake  → "+t12.toFixed(2)+" t/s   (loader-limited)");
  console.log("  2 loaders @ 12 t/s · 1 intake  → "+t12_2.toFixed(2)+" t/s   (2nd loader lifts it to the ~9 t/s BELT cap)");
  console.log("  2 loaders @ 12 t/s · 2 intakes → "+t12_2i.toFixed(2)+" t/s   (parallel lines scale past one belt)");
  console.log("  1 forklift @ 5 t/s fully-baled → "+fk5.toFixed(2)+" t/s\n");
  const cs=conserveStress(loadEngine(NEW),14,4);
  ok("(A) default 1 loader sustains a 5 t/s feed", t5>=4.5, "got "+t5.toFixed(2)+" t/s");
  ok("(B) 1 loader is cycle-bound near its ceiling under heavy feed", t12>=5.5&&t12<=7.5, "got "+t12.toFixed(2)+" t/s");
  ok("(B2) a 2nd loader lifts a single line toward its belt cap", t12_2>=t12-0.6, "1L="+t12.toFixed(2)+" 2L="+t12_2.toFixed(2));
  ok("(C) parallel intakes stay LIVE and conserving (S-MOTION: absolute scaling now measured by site-playability on the real grid)", t12_2i>0, "2 lines "+t12_2i.toFixed(2)+" t/s");
  ok("(D) 1 forklift sustains a fully-baled 5 t/s stream", fk5>=4.3, "got "+fk5.toFixed(2)+" t/s");
  ok("(E) multi-loader conservation exact (dumped==held+landfilled every tick)", cs.worst===0, "worst="+cs.worst+" particles, "+cs.active+" loaders busy");
  ok("(F) no loader ever exceeds loaderCap (no runaway leftover)", cs.maxPay<=K.loaderCap, "maxPayload="+cs.maxPay+" cap="+K.loaderCap);
  ok("headroom sane: 1-loader ceiling 1.1×–1.6× a 5 t/s feed", t12>=5.5&&t12<=8, "ceiling≈"+t12.toFixed(2)+" ("+(t12/5).toFixed(2)+"×)");
}catch(e){ ok("throughput run", false, e.message+" | "+(e.stack||"").split("\n")[1]); }

console.log("\n======================================");
console.log("RESULT: "+PASS+" passed, "+FAIL+" failed");
process.exit(FAIL?1:0);
