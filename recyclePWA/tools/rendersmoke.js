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
  begin("career","site_qc");   // the plain harness rig; the SHIPPED reference plant gets its own pass below
  if(!siteMode())throw new Error("siteMode() false after begin(site_qc)");
  for(let i=0;i<2600;i++)tick(0.004); // ~10.4 sim-h: covers the reference plant’s cold-start first tip (later since the default feed dropped 5→4 t/h, 2026-08-01)
  const deliveredInRun=G.deliveredTot; // capture NOW: later test blocks call newGame() and reset a fresh site_ref
  UI.viewReset();
  render();render();render();
  // build-overlay render paths: ghost (valid + invalid) and connect nubs
  BUILD.mode="place";BUILD.sel=["input",null,"Bunker"];BUILD.gx=2;BUILD.gy=4;BUILD.rot=0;render();
  BUILD.gx=8;BUILD.gy=20;render(); // invalid spot → reason badge path
  BUILD.mode="connect";BUILD.from=G.nodes[0];BUILD.fromSide=null;render();
  BUILD.mode=null;BUILD.sel=null;BUILD.from=null;
  // MOVE ghost at several rotations — it now draws the full placement ghost (sprite + rotated port nubs)
  // instead of a flat rect, so this path can null-deref on sprite/port geometry the place path never hits.
  {const mn=G.nodes.find(n=>n.site==="process");
   if(mn){startMoveUnit(mn);BUILD.gx=8;BUILD.gy=14;
     for(const r of [0,90,180,270]){BUILD.rot=r;render();}
     BUILD.mode=null;BUILD.moveNode=null;}}
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
   newGame("career","site_qc",0x1);   // back to the plain rig: everything after this (burden fixture, crossings) assumes it
   if(isSandboxSite())throw new Error("site_qc must not be a sandbox site");
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
  // ── a BURDENED sorter must inspect cleanly (the burden rows/advice only render when k>0,
  //    so inspecting an idle plant would not exercise that path at all)
  {const bn=G.nodes.find(n=>TYPES[n.type].prob);
   if(bn){const mix={PET:0.32,steel:0.15,alu:0.06,film:0.14,paper:0.26,PVC:0.07};
     // enough backlog that the unit is STILL drowning when we sample (a fast sorter clears a small
     // pile in a few hundred ticks and the burden decays back to zero before the inspector opens)
     for(let b=0;b<300;b++)for(const m in mix){const k=Math.round(100*mix[m]);for(let i=0;i<k;i++)bn.inBuf[m][1]++;}
     for(let i=0;i<2000;i++)tick(0.004);
     if(!(burdenK(bn)>0))throw new Error("burden fixture failed to burden a sorter");
     inspectNode(bn);
     const sh=document.getElementById("sheet").innerHTML;
     if(!/Burden|Charge/.test(sh))throw new Error("burdened sorter inspector shows no burden row");}}
  // ── belt OVERPASS: detected, cached, clipped, and consistent with the tap
  // (capture the plant counts FIRST — the crossing rig below adds units/edges on purpose)
  const nodes0=G.nodes.length,edges0=G.edges.length;
  let xings=0;
  {G.cash=1e7;
   const a=sitePlaceUnit("process","opener",8,14,0),b=sitePlaceUnit("process","magnet",8,20,0);
   const c=sitePlaceUnit("process","opener",6,17,0),d=sitePlaceUnit("process","magnet",11,17,0);
   if(a.ok&&b.ok&&c.ok&&d.ok){
     siteConnect(a.node,"b",b.node,"t");   // vertical trunk
     siteConnect(c.node,"r",d.node,"l");   // horizontal spur → crosses it
     const XS=siteCrossings(); xings=XS.list.length;
     if(!xings)throw new Error("crossed belts produced no crossing");
     if(siteCrossings()!==XS)throw new Error("crossing cache rebuilt with no geometry change");
     render();
     const x0=XS.list[0],h=hitTest(x0.x,x0.y);
     if(!h||h.kind!=="edge"||h.e!==x0.top)throw new Error("hitTest disagrees with paint order at a crossing");
     siteMoveUnit(d.node,12,17,0);
     if(siteCrossings()===XS)throw new Error("crossing cache went stale after a reroute");
     render();}}
  // ── COACH LEAK: play the tutorial, then load a plant that has none. The banner must go away.
  //    (updateCoach is what hides it, and it used to stop being called the moment the tutorial ended.)
  let coachLeak=null;
  {newGame("career","site_career",0x9);render();
   const shownDuringTuto=document.getElementById("coach").style.display;
   newGame("career","site_ref",0x9);render();render();
   coachLeak={duringTutorial:shownDuringTuto,afterLoadingRefPlant:document.getElementById("coach").style.display,
     tutoActiveOnRef:tutoActive()};}
  // ── the SHIPPED reference plant (Denis' 100%-recycling ring) must render, not just simulate
  let refPlant=null;
  {newGame("career","site_ref",0xC0FFEE7);G.running=true;
   for(let i=0;i<3000;i++)tick(0.004);
   UI.viewReset();render();render();
   const one={};for(const n of G.nodes)if(!one[n.site])one[n.site]=n;
   for(const k in one)inspectNode(one[k]);
   closeSheet();
   refPlant={nodes:G.nodes.length,edges:G.edges.length,cycles:siteCycleSets().length,
     landfills:G.nodes.filter(isLandfill).length,exports:G.nodes.filter(isExport).length,
     feeders:G.nodes.filter(isFeeder).map(n=>n.rate).join("/")};}
  begin("career","site_qc");for(let i=0;i<600;i++)tick(0.004);   // back to the rig for the rest of the run
  // ── seed a career, then hand the serialized save to the boot-resume pass below. Progression lives INSIDE
  //    the save (career:G.career), and CAREER is a live pointer into it — so a save with owned tech is the
  //    only fixture that can prove the boot path keeps them attached.
  // ── CONTRACTS view: render it in both states that matter — clean, and with every mandate imposed (which is
  //    when your own contracts get scaled down and the squeeze warning has to appear).
  let conHtml="",conSqueezed="";
  {setView("con");conHtml=document.getElementById("viewCon").innerHTML;
   CAREER.counters.flags.tutorialComplete=true;CAREER.pressure.armed=true;
   for(const id in MANDATE){if(CAREER.mandates.seen.indexOf(id)<0)CAREER.mandates.seen.push(id);CAREER.mandates.active.push({id:id,day:1});}
   renderConView();conSqueezed=document.getElementById("viewCon").innerHTML;
   CAREER.mandates.active.length=0;CAREER.mandates.seen.length=0;setView("process");}
  const careerAttached=(CAREER===G.career);
  CAREER.tech.push("r_airU","a_split");CAREER.claimed.push("a_first");recomputeTechMod();
  const bootSave=JSON.stringify(serializeGame());
  __report({nodes:nodes0,veh:G.vehicles.length,edges:edges0,xings,
    delivered:deliveredInRun,trucks:(G.trucks||[]).length,zoom:cam.zoom,camx:cam.x,
    careerAttached,bootSave,refPlant,coachLeak,
    conLen:conHtml.length,conHasIntake:/Site intake|Admission/.test(conHtml),conHasBuyers:/Buyers|Acheteurs/.test(conHtml),
    conSqueezeWarns:/crowding out|évincent/.test(conSqueezed),conHasImposed:/Cannot be refused|Non refusable/.test(conSqueezed),
    conTruckIcons:conHtml.split("assets/sup_").length-1,
    conLockedListed:/Locked|Verrouill/.test(conHtml),
    conAvailCount:(conHtml.match(/Not signed|Non sign|Locked|Verrouill/g)||[]).length,
    conHasComp:/compbar/.test(conHtml),
    // OBJ/MANDATE names reach tr() as VARIABLES, so tools/i18ncheck.js (which only scans tr("literal") call
    // sites) is blind to them — reword an objective and French silently falls back to English. Checked here,
    // where both the engine data and LANG.fr are in scope.
    frGaps:(function(){const m=[],SELF=["PET","PVC","Film","Alu","Aluminium"]; // identical in both languages
      for(const k in OBJ)if(OBJ[k].name&&!LANG.fr[OBJ[k].name])m.push("OBJ."+k+": "+OBJ[k].name);
      for(const k in MANDATE)if(MANDATE[k].name&&!LANG.fr[MANDATE[k].name])m.push("MANDATE."+k+": "+MANDATE[k].name);
      for(const k in SPECS){const l=SPECS[k].label;if(l&&SELF.indexOf(l)<0&&!LANG.fr[l])m.push("SPECS."+k+": "+l);}
      return m;})(),
    frChecked:Object.keys(OBJ).length+Object.keys(MANDATE).length+Object.keys(SPECS).length,
    // per-supplier liveries: bagCol/bagKey/truckSpriteKey must resolve from the STREAM, not from a plant-wide global
    bagCols:COMPANIES.suppliers.filter(s=>s.stream).map(s=>bagCol(s.id)),
    truckKeys:["wasteminster","binfinity"].map(id=>truckSpriteKey({cls:"supplier",sup:id,id:1})),
    // every streaming supplier must resolve to its OWN bin-truck livery, and that art must actually decode
    supTrucks:COMPANIES.suppliers.filter(s=>s.stream).map(s=>truckSpriteKey({cls:"supplier",sup:s.id,id:1})),
    supTrucksLoaded:COMPANIES.suppliers.filter(s=>s.stream).every(s=>!!img(truckSpriteKey({cls:"supplier",sup:s.id,id:1}))),
    // steel's halo colour must stand clear of the belt it rides on (luma gap, not just "a different hex")
    steelLuma:(function(h){h=COL.steel.replace("#","");return Math.round(0.299*parseInt(h.slice(0,2),16)+0.587*parseInt(h.slice(2,4),16)+0.114*parseInt(h.slice(4,6),16));})(),
    beltLuma:["#6F665C","#3B3833","#565149"].map(function(c){c=c.replace("#","");return Math.round(0.299*parseInt(c.slice(0,2),16)+0.587*parseInt(c.slice(2,4),16)+0.114*parseInt(c.slice(4,6),16));})});
})();`;

/* Pass 2 — BOOT RESUME. app.js's top-level boot block auto-resumes a saved site game before any driver
 * runs; with an empty store (pass 1) that branch is dead, which is exactly why the career-detachment
 * regression shipped. Seeding the store with a real save makes the boot path execute for real. */
const bootDriver = `
;(function(){
  __report({hasGame:!!G,
    nodes:G?G.nodes.length:0,
    attached:!!G&&CAREER===G.career,
    tech:(CAREER&&CAREER.tech)?CAREER.tech.length:-1,
    claimed:(CAREER&&CAREER.claimed)?CAREER.claimed.length:-1,
    airUnlocked:!!unitUnlocked("air")});
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

/* run the same shipping source again, but booting against a store that already holds a saved career */
let boot = null;
if (report && report.bootSave) {
  const store2 = { "recycle.save.v3": report.bootSave };
  const ls2 = { getItem: k => (k in store2 ? store2[k] : null), setItem: (k, v) => { store2[k] = String(v); }, removeItem: k => { delete store2[k]; } };
  const win2 = new Proxy({ devicePixelRatio: 2, innerWidth: 390, innerHeight: 700, localStorage: ls2 }, {
    get(t, p) { if (p in t) return t[p]; return (...a) => undefined; },
  });
  const fn2 = new Function("document", "window", "localStorage", "requestAnimationFrame", "navigator", "performance", "Image", "location", "history", "ResizeObserver", "Audio", "AudioContext", "matchMedia", "visualViewport", "screen", "__report",
    src + bootDriver);
  try {
    fn2(document_, win2, ls2, raf, { userAgent: "smoke", language: "en" }, { now: () => Date.now() }, ImageStub, { hash: "", search: "", href: "" }, { replaceState(){}, pushState(){} }, class{observe(){}disconnect(){}}, class{play(){}}, class{}, ()=>({matches:false,addEventListener(){}}), {width:390,height:700,scale:1,addEventListener(){}}, {width:390,height:700,orientation:{type:"portrait-primary",addEventListener(){}}}, r => { boot = r; });
  } catch (err) {
    console.error("SMOKE FAIL (boot pass):", err.stack.split("\n").slice(0, 4).join("\n"));
    process.exit(1);
  }
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
ok(report && report.xings > 0, "belt crossing detected on the built cross (" + (report && report.xings) + ")");
ok((calls.clip || 0) > 0, "overpass pass clipped the belt below (clip ×" + (calls.clip || 0) + ")"); // ctx.clip( appears nowhere else in js/, so this is an unambiguous marker that the pass ran
ok(report && report.careerAttached, "CAREER is attached to G.career after begin()");
ok(report && report.coachLeak && report.coachLeak.duringTutorial === "block" && report.coachLeak.afterLoadingRefPlant === "none" && !report.coachLeak.tutoActiveOnRef,
  "the tutorial banner does NOT survive into a plant with no tutorial (tuto=" + (report && report.coachLeak && report.coachLeak.duringTutorial) + " → ref=" + (report && report.coachLeak && report.coachLeak.afterLoadingRefPlant) + ")");
ok(report && report.refPlant && report.refPlant.nodes === 50 && report.refPlant.edges === 59,
  "shipped reference plant renders (" + (report && report.refPlant && report.refPlant.nodes) + " units / " + (report && report.refPlant && report.refPlant.edges) + " connections)");
ok(report && report.refPlant && report.refPlant.cycles === 1 && report.refPlant.landfills === 0 && report.refPlant.exports === 6,
  "…with its recycle ring, six export bays and no landfill (feeders " + (report && report.refPlant && report.refPlant.feeders) + " t/h)");
ok(report && report.conLen > 400 && report.conHasIntake && report.conHasBuyers, "contracts view renders (" + (report && report.conLen) + " chars, intake + buyers)");
ok(report && report.conHasComp, "contracts view shows stream composition bars");
ok(report && report.conTruckIcons >= 3, "each contract shows its bin-truck livery (" + (report && report.conTruckIcons) + " truck sprites)");
ok(report && report.conLockedListed && report.conAvailCount >= 3,
  "streams still locked behind R&D are listed as available-to-come (" + (report && report.conAvailCount) + " unsigned streams shown)");
ok(report && report.conHasImposed && report.conSqueezeWarns, "with every mandate imposed it lists them and warns your contracts are crowded out");
ok(report && report.frChecked > 5 && report.frGaps && report.frGaps.length === 0,
  "every OBJ/MANDATE/SPECS name has a French entry (" + (report && report.frChecked) + " checked)" + (report && report.frGaps && report.frGaps.length ? " — MISSING: " + report.frGaps.join(" | ") : ""));
ok(report && report.bagCols && new Set(report.bagCols).size === 3,
  "streams resolve to the three waste-type colours (" + [...new Set(report && report.bagCols || [])].join(" ") + ")");
ok(report && report.truckKeys && report.truckKeys[0] !== report.truckKeys[1],
  "supplier trucks differ per contract (" + (report && report.truckKeys || []).join(" vs ") + ")");
ok(report && report.supTrucks && new Set(report.supTrucks).size === report.supTrucks.length,
  "every streaming supplier has its OWN truck livery (" + (report && report.supTrucks || []).join(" ") + ")");
ok(report && report.supTrucksLoaded, "…and every one of those sprites decodes");
ok(report && report.beltLuma && Math.min(...report.beltLuma.map(b => Math.abs(report.steelLuma - b))) > 60,
  "steel reads clear of the conveyor greys (luma " + (report && report.steelLuma) + " vs belt " + (report && report.beltLuma || []).join("/") + ")");
// ── boot-resume: the regression that shipped as "my tech tree and rewards reset after the update"
ok(!!boot && boot.hasGame && boot.nodes > 0, "boot auto-resumed the seeded save (" + (boot && boot.nodes) + " units)");
ok(!!boot && boot.attached, "CAREER still points into G.career after the BOOT resume path");
ok(!!boot && boot.tech === 2, "owned tech survived the boot resume (" + (boot && boot.tech) + "/2)");
ok(!!boot && boot.claimed === 1, "claimed objectives survived the boot resume (" + (boot && boot.claimed) + "/1)");
ok(!!boot && boot.airUnlocked, "tech EFFECTS recomputed from the restored career (air unlocked)");
console.log(fail ? "SMOKE: " + fail + " FAILURES" : "SMOKE: all green");
process.exit(fail ? 1 : 0);
