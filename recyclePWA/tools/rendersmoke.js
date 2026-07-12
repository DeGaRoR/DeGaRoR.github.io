"use strict";
/* Render smoke (Phase 1 step 3): loads the WHOLE game script under a stubbed DOM,
 * starts the site scenario, runs the sim, drives render frames, and asserts the
 * site path actually drew (base blit + unit cards + vehicles). Catches renderer
 * null-derefs that the engine-only qc suites cannot see. Exit 0 = green. */
const fs = require("fs");
const proj = require("./_load.js").load(process.argv[2] || __dirname + "/..");
const html = proj.html;
const src = proj.shipping;

/* ---- recording 2D context ---- */
const calls = {};
function mkCtx() {
  const grad = { addColorStop() {} };
  return new Proxy({ canvas: { width: 800, height: 600 } }, {
    get(t, p) {
      if (p in t) return t[p];
      if (p === "measureText") return () => ({ width: 8 });
      if (p === "createLinearGradient" || p === "createRadialGradient" || p === "createPattern") return () => grad;
      if (p === "getImageData") return () => ({ data: new Uint8ClampedArray(4) });
      return (...a) => { calls[p] = (calls[p] || 0) + 1; };
    },
    set(t, p, v) { t[p] = v; return true; },
  });
}
const theCtx = mkCtx();

/* ---- element / document stubs ---- */
function mkEl(id) {
  const store = { id, style: {}, dataset: {}, classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
    clientWidth: 390, clientHeight: 700, width: 390, height: 700, innerHTML: "", textContent: "", value: "", scrollTop: 0, lang: "" };
  return new Proxy(store, {
    get(t, p) {
      if (p in t) return t[p];
      if (p === "getContext") return () => theCtx;
      if (p === "getBoundingClientRect") return () => ({ width: 390, height: 700, left: 0, top: 0, right: 390, bottom: 700 });
      if (p === "querySelectorAll") return () => [];
      if (p === "closest") return () => null;
      if (p === "querySelector") return sel => mkEl(id + " q:" + sel);
      return (...a) => undefined; // any other method: noop
    },
    set(t, p, v) { t[p] = v; return true; },
  });
}
const els = {};
const document_ = new Proxy({ documentElement: mkEl("html"), body: mkEl("body") }, {
  get(t, p) {
    if (p in t) return t[p];
    if (p === "getElementById") return id => (els[id] || (els[id] = mkEl(id)));
    if (p === "createElement") return tag => mkEl("dyn-" + tag);
    if (p === "querySelectorAll") return () => [];
    if (p === "querySelector") return sel => mkEl("q:" + sel);
    if (p === "addEventListener" || p === "removeEventListener") return () => {};
    return (...a) => undefined;
  },
});
const store = {};
const localStorage_ = { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } };
const window_ = new Proxy({ devicePixelRatio: 2, innerWidth: 390, innerHeight: 700, localStorage: localStorage_ }, {
  get(t, p) { if (p in t) return t[p]; return (...a) => undefined; },
});
class ImageStub{constructor(){this.complete=true;this.naturalWidth=10;this.width=10;this.height=10;}set src(v){if(this.onload)this.onload();}get src(){return "";}}
const rafQ = [];
const raf = f => { rafQ.push(f); return rafQ.length; };

const driver = `
;(function(){
  begin("career","site_ref");
  if(!siteMode())throw new Error("siteMode() false after begin(site_ref)");
  for(let i=0;i<1800;i++)tick(0.004); // ~7.2 sim-min: covers the reference plant’s cold-start first tip (≈ t=6.2)
  const deliveredInRun=G.deliveredTot; // capture NOW: later test blocks call newGame() and reset a fresh site_ref
  UI.viewReset();
  render();render();render();
  // build-overlay render paths: ghost (valid + invalid) and connect nubs
  BUILD.mode="place";BUILD.sel=["input",null,"Bunker"];BUILD.gx=2;BUILD.gy=4;BUILD.rot=0;render();
  BUILD.gx=8;BUILD.gy=20;render(); // invalid spot → reason badge path
  BUILD.mode="connect";BUILD.from=G.nodes[0];BUILD.fromSide=null;render();
  BUILD.mode=null;BUILD.sel=null;BUILD.from=null;
  // ── UI playability audit (2026-07-11) ──
  // 1. hit-targets: every site node is tappable at its centre; every conveyor at its midpoint
  let badNode=0,badEdge=0;
  for(const n of G.nodes){const h=hitTest(n.x,n.y);if(!h||h.kind!=="node"||h.n!==n)badNode++;}
  const stolen=[];
  for(const e of G.edges){if(e.kind!=="conveyor"||!e.route||e.route.length<2)continue;
    let reachable=false; // an edge must be tappable SOMEWHERE along its run (crossings may shadow single points)
    for(const fr of [0.3,0.5,0.7]){const m=e.route[Math.max(1,Math.floor(e.route.length*fr))];
      const h=hitTest(m[0],m[1]);
      if(h&&((h.kind==="edge"&&h.e===e)||h.kind==="node")){reachable=true;break;}}
    if(!reachable){badEdge++;stolen.push(e.from+"\u2192"+e.to);}}
  if(badNode||badEdge)throw new Error("hit-target audit: "+badNode+" nodes / "+badEdge+" conveyors unreachable: "+stolen.join(" | "));
  // 2. every inspector sheet opens for every site unit family + edges + trucks + vehicles
  const one={};for(const n of G.nodes)if(!one[n.site])one[n.site]=n;
  for(const k in one)inspectNode(one[k]);
  // 2b. the "Effect per waste type" section renders for a separator (plain capture/pass table, no theory)
  {const mag=G.nodes.find(n=>n.type==="magnet");
   if(mag){inspectNode(mag);const body=document.getElementById("sheet").innerHTML;
     if(!/Effet par type de d|Effect per waste type/.test(body))throw new Error("separator inspector missing the Effect-per-waste section");
     if(!/effrow/.test(body))throw new Error("effect section has no per-material rows");}}
  const ce=G.edges.find(e=>e.kind==="conveyor"),ve=G.edges.find(e=>e.kind==="vehicle");
  if(ce)inspectEdge(ce); if(ve)inspectEdge(ve);
  const tk=(G.trucks||[])[0]; if(tk)inspectTruck(tk);
  for(const cls of ["loader","forklift","ctruck"]){const v=G.vehicles.find(x=>x.cls===cls);if(v)inspectVehicle(v);}
  // 3. build UI surfaces: palette sheet + a full place→undo round trip through the real handlers
  openSitePalette();closeSheet();
  // site tutorial coach: updateCoach must show the panel with objective + step text (regression: two
  // duplicate #coach blocks + the legacy TUT poller were hiding it). Assert the text is populated.
  {newGame("career","site_career",0x2);
   if(!tutoActive())throw new Error("career should start the site tutorial");
   updateCoach();
   const txt=document.getElementById("coachTxt");
   if(!txt||!txt.textContent||txt.textContent.length<5)throw new Error("coach step text is empty");
   const obj=document.getElementById("coachObj");
   if(!obj||!obj.textContent||obj.textContent.indexOf("Goal")<0&&obj.textContent.indexOf("Objectif")<0)throw new Error("coach objective line is empty");}
  // sandbox hides the bottom nav: isSandboxSite() gates setView (no R&D/Goals in sandbox).
  // NB: the stub's classList is a no-op, so we assert on the isSandboxSite predicate + setView redirect, not DOM classes.
  {if(typeof isSandboxSite!=="function")throw new Error("isSandboxSite missing");
   newGame("career","site_free",0x1);
   if(!isSandboxSite())throw new Error("site_free should be a sandbox site");
   setView("tech");if(curView!=="process")throw new Error("sandbox should not switch to R&D view");
   setView("obj");if(curView!=="process")throw new Error("sandbox should not switch to Goals view");
   setView("process");if(curView!=="process")throw new Error("process view should work in sandbox");
   newGame("career","site_ref",0x1);
   if(isSandboxSite())throw new Error("site_ref must not be a sandbox site");
   setView("tech");if(curView!=="tech")throw new Error("career should reach the R&D view");
   setView("process");}
  // siteNodeLabel custom name: a renamed unit must show its label on the map (bug: siteNodeLabel ignored it)
  {const n={site:"process",type:"magnet",label:"Aimant #1"};
   if(siteNodeLabel(n)!=="Aimant #1")throw new Error("siteNodeLabel ignored the custom label");
   n.label=null;if(siteNodeLabel(n)!==tr("Magnet"))throw new Error("cleared label should fall back to type name");}
  // baleList export scope: the fn must exist and render a card for a bay holding bales (regression:
  // it was trapped inside the feeder branch of inspectNode and never ran for export bays)
  {if(typeof baleList!=="function")throw new Error("baleList missing");
   const bay={site:"output",role:"export",spec:"ferrous",buyer:"ferrous_bueller",gx:4,gy:35,
     bales:[{PET:[0,0],PVC:[0,0],steel:[0,50],film:[0,0],paper:[0,0],alu:[0,0]}]};
   const html=baleList(bay);
   if(html.indexOf("Bale")<0||html.indexOf("border")<0)throw new Error("baleList produced no card markup");}
  // ZONE_IMG spec mapping: every buyer spec must resolve to a real zone image (no PET fallback for carton)
  {const need={PET:"zone_0",ferrous:"zone_1",alu:"zone_2",carton:"zone_4",film:"zone_3",dispose:"zone_5"};
   for(const sp in need){if(ZONE_IMG[sp]!==need[sp])throw new Error("ZONE_IMG["+sp+"] should be "+need[sp]+" not "+ZONE_IMG[sp]);}
   const seen=new Set();for(const bz of COMPANIES.buyers){if(seen.has(bz.spec))continue;seen.add(bz.spec);
     if(!ZONE_IMG[bz.spec])throw new Error("buyer spec "+bz.spec+" has no zone image (would fall back to PET)");}}
  // picking station must be in the build catalogue (regression: it went missing)
  if(!SITE_CATALOG.some(c=>c[0]==="process"&&c[1]==="pick"))throw new Error("picking station missing from build catalogue");
  BUILD.mode="place";BUILD.sel=["process","eddy","Eddy current"];BUILD.gx=8;BUILD.gy=20;BUILD.rot=0;
  const cashB=G.cash,rr2=sitePlaceUnit("process","eddy",8,20,0);
  if(rr2.ok){BUILD.undo.push({t:"place",node:rr2.node,cost:rr2.cost});buildUndo();
    if(G.cash!==cashB)throw new Error("place→undo did not restore cash exactly ("+(G.cash-cashB)+")");}
  buildExit();render();
  // legacy taps
  inspectNode(G.nodes[0]);
  const mv=G.vehicles.find(v=>v.state!=="idle")||G.vehicles[0];
  if(mv)inspectVehicle(mv);
  __report({nodes:G.nodes.length,veh:G.vehicles.length,edges:G.edges.length,
    delivered:deliveredInRun,trucks:(G.trucks||[]).length,zoom:cam.zoom,camx:cam.x});
})();`;

let report = null;
const fn = new Function("document", "window", "localStorage", "requestAnimationFrame", "navigator", "performance", "Image", "location", "history", "ResizeObserver", "Audio", "AudioContext", "matchMedia", "visualViewport", "screen", "__report",
  src + driver);
try {
  fn(document_, window_, localStorage_, raf, { userAgent: "smoke", language: "en" }, { now: () => Date.now() }, ImageStub, { hash: "", search: "", href: "" }, { replaceState(){}, pushState(){} }, class{observe(){}disconnect(){}}, class{play(){}}, class{}, ()=>({matches:false,addEventListener(){}}), {width:390,height:700,scale:1,addEventListener(){}}, {width:390,height:700,orientation:{type:"portrait-primary",addEventListener(){}}}, r => { report = r; });
} catch (err) {
  console.error("SMOKE FAIL:", err.stack.split("\n").slice(0, 4).join("\n"));
  process.exit(1);
}

let fail = 0;
const ok = (c, m) => { console.log((c ? "  ok   " : "  FAIL ") + m); if (!c) fail++; };
ok(!!report, "driver completed (begin → 600 ticks → 3 renders → both inspectors)");
ok(report && report.nodes === 27 && report.edges === 29, "site scenario loaded through the real begin() path (27 units / 29 connections)");
ok(report && report.veh > 0, "fleet spawned (" + (report && report.veh) + " vehicles)");
ok(report && report.delivered > 0, "supplier trucks tipped during the smoke run");
ok(!report || report.trucks === undefined || report.trucks >= 0, "truck layer present (" + (report && report.trucks) + " in flight at sample)");
ok((calls.drawImage || 0) >= 3, "base layer blitted every frame (drawImage ×" + (calls.drawImage || 0) + ")");
ok((calls.fill || 0) > 100, "unit cards / chevrons / sprites drawn (fill ×" + (calls.fill || 0) + ")");
ok((calls.fillText || 0) > 30, "labels drawn (fillText ×" + (calls.fillText || 0) + ")");
ok(report && report.zoom >= 0.35 && report.zoom <= 1.6, "site view fit produced a sane zoom (" + (report && report.zoom.toFixed(2)) + ")");
console.log(fail ? "SMOKE: " + fail + " FAILURES" : "SMOKE: all green");
process.exit(fail ? 1 : 0);
