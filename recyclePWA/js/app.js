"use strict";
const cashStatEl=document.getElementById("cashStat");
// Tutorial coach — persistent banner; shows one step, watches G for completion, congratulates,
// briefly auto-pauses on milestones, advances. Polled from render() every frame (works while paused).
let _coachIdx=-1,_coachBusy=false;
function renderCoach(){const co=document.getElementById("coachTut");
  if(!G||!G.tut||G.tutStep>=G.tut.length){co.classList.add("hide");_coachIdx=-1;_tutFocusNode=null;updateTutFocus();return;}
  const _sh=document.getElementById("sheet");if(_sh&&_sh.classList.contains("show")){co.classList.add("hide");_coachIdx=-1;return;}
  if(_coachBusy)return;
  if(_coachIdx!==G.tutStep){_coachIdx=G.tutStep;const st=G.tut[G.tutStep];
    co.classList.remove("hide","done");
    document.getElementById("coachTutStep").textContent=(G.scenario?locF(G.scenario.phases[G.phaseIdx].name,G.scenario.phases[G.phaseIdx].name_f)+" \u00B7 ":"")+tr("Step")+" "+(G.tutStep+1);
    document.getElementById("coachProg").textContent=(G.tutStep+1)+"/"+G.tut.length;
    document.getElementById("coachText").textContent=locF(st.t,st.f);
    document.getElementById("coachNext").textContent=tr("Got it");document.getElementById("coachNext").style.display=st.info?"block":"none";
    _tutFocusNode=(st&&st.node&&!careerTechOwned(st.node))?st.node:null;updateTutFocus();if(curView==="tech")renderTechView();}}
let _coachVis=false,_coachView="",_coachStep=-99;
function syncCoachInset(){const co=document.getElementById("coach"),on=!co.classList.contains("hide");
  document.querySelectorAll(".vpanel").forEach(p=>{
    if(on&&p.classList.contains("on")){const pr=p.getBoundingClientRect();p.style.paddingTop=Math.max(0,co.getBoundingClientRect().bottom-pr.top+8)+"px";}
    else p.style.paddingTop="";});}
function tutorialPoll(){if(G&&G.scenario&&G.scenario.tuto)return; // site tutorial → updateCoach() owns #coach; the legacy TUT poller must not touch it
  if(!G||!G.tut){const co=document.getElementById("coachTut");if(!co.classList.contains("hide")){co.classList.add("hide");syncCoachInset();}_coachIdx=-1;return;}
  if(_coachBusy)return;renderCoach();
  const _cv=!document.getElementById("coachTut").classList.contains("hide");
  if(_cv!==_coachVis||curView!==_coachView||_coachIdx!==_coachStep){_coachVis=_cv;_coachView=curView;_coachStep=_coachIdx;requestAnimationFrame(syncCoachInset);}
  if(G.tutStep<G.tut.length){const st=G.tut[G.tutStep];if(!st.info&&st.c&&st.c())coachComplete(st);}}
function coachComplete(st){_coachBusy=true;const wasRunning=G.running;if(st.pause)G.running=false;
  if(st&&st.node){_tutFocusNode=null;updateTutFocus();if(curView==="tech")setView("process");}
  const co=document.getElementById("coachTut");co.classList.remove("hide");co.classList.add("done");
  document.getElementById("coachTutStep").textContent="\u2713 "+tr("Done");document.getElementById("coachProg").textContent="";
  if(st.ok)document.getElementById("coachText").textContent=locF(st.ok,st.okf);
  document.getElementById("coachNext").style.display="none";
  G.tutStep++;
  if(G.tut&&G.tutStep>=G.tut.length){const r=tutNextChapter();if(r&&r.chapter){if(UI.onPhase)UI.onPhase(r.phase);}else if(r&&r.done&&UI.onGraduate)UI.onGraduate({name:"Tutorial complete"});}
  saveGame();
  setTimeout(()=>{_coachBusy=false;_coachIdx=-1;if(st.pause&&wasRunning)G.running=true;renderCoach();},1600);}
document.getElementById("coachNext").addEventListener("click",()=>{if(!G||!G.tut||G.tutStep>=G.tut.length)return;
  const st=G.tut[G.tutStep];if(st&&st.info){G.tutStep++;_coachIdx=-1;saveGame();renderCoach();}});
function loop(ts){if(!last)last=ts;let dr=(ts-last)/1000;last=ts;if(dr>0.1)dr=0.1;
  if(G&&G.running&&!G.finished){let sim=dr*0.04*G.speed;const STEP=0.004;let guard=0;
    while(sim>0&&guard++<500){const s=Math.min(STEP,sim);tick(s);sim-=s;} G._st=(G._st||0)+dr; if(G._st>3){G._st=0;saveGame();}}
  if(G&&G.running&&_inspectNode&&sheet.classList.contains("show")){
    _inspectT+=dr;
    if(_inspectT>=0.33){_inspectT=0;
      const typing=document.activeElement&&document.activeElement.id==="iNameIn";
      if(!typing&&_inspectNode===selNode){
        const bs=sheet.querySelector("#baleScroll");
        if(bs&&isExport(_inspectNode)){ // export bay: update the list in place ONLY when bale count changes (no flicker)
          const shown=+bs.dataset.n||0,now=_inspectNode.bales.length;
          if(shown!==now){const top=bs.scrollTop;bs.outerHTML=baleList(_inspectNode);const nb=sheet.querySelector("#baleScroll");if(nb)nb.scrollTop=top;}
          // refresh only the compact "Bales ✓/✗" summary row live, not the list
        } else { // non-list inspectors (feeder/baler/etc.): full refresh is fine
          const sc=sheet.scrollTop;inspectNode(_inspectNode);sheet.scrollTop=sc;}}}}
  if(G)render();requestAnimationFrame(loop);}
const cv=document.getElementById("cv"),ctx=cv.getContext("2d");
let DPR=1,VW=0,VH=0,_rL=0,_rT=0;
const DBG_HIT=(location.hash||"").indexOf("hit")>=0;let _dbgTap=null; // add #hit to the URL to overlay hit regions + last-tap crosshair
function resize(){DPR=Math.min(2,window.devicePixelRatio||1);VW=cv.clientWidth;VH=cv.clientHeight;cv.width=VW*DPR;cv.height=VH*DPR;syncRect();syncCoachInset();}
window.addEventListener("resize",resize);
if(window.ResizeObserver)new ResizeObserver(()=>resize()).observe(cv); // URL bars resize the canvas without a window resize event
if(window.visualViewport){visualViewport.addEventListener("resize",resize);visualViewport.addEventListener("scroll",()=>syncRect());}
function s2w(x,y){return {x:(x-cam.x)/cam.zoom,y:(y-cam.y)/cam.zoom};} // canvas-local px -> world
function syncRect(){const r=cv.getBoundingClientRect();_rL=r.left;_rT=r.top;} // canvas offset in the viewport (safe-areas, HUD, mobile toolbar)
function p2w(cx,cy){return s2w(cx-_rL,cy-_rT);} // pointer (viewport) px -> world
function rr(c,x,y,w,h,r){c.beginPath();c.moveTo(x+r,y);c.arcTo(x+w,y,x+w,y+h,r);c.arcTo(x+w,y+h,x,y+h,r);c.arcTo(x,y+h,x,y,r);c.arcTo(x,y,x+w,y,r);c.closePath();}
function bez(pp,t){const u=1-t;return{x:u*u*u*pp.p0.x+3*u*u*t*pp.c0.x+3*u*t*t*pp.c1.x+t*t*t*pp.p1.x,y:u*u*u*pp.p0.y+3*u*u*t*pp.c0.y+3*u*t*t*pp.c1.y+t*t*t*pp.p1.y};}
function edgePath(e){const a=nodeById(e.from),b=nodeById(e.to);if(!a||!b)return null;
  const p0=outPortPos(a,e.fromPort)||{x:a.x,y:a.y},p1=inPortPos(b);const dx=Math.max(40,Math.abs(p1.x-p0.x)*0.5);
  return{p0,p1,c0:{x:p0.x+dx,y:p0.y},c1:{x:p1.x-dx,y:p1.y}};}
const STATECOL={ok:null,starved:"#6b6258",bagged:"#D98E48",overloaded:"#D98E48",jammed:"#C25B4E",bunkerfull:"#C25B4E",noloader:"#D98E48",containerfull:"#C25B4E",balerfull:"#C25B4E",exportfull:"#D98E48"};
const STATETXT={starved:"STARVED",bagged:"BAGGED",overloaded:"OVERLOAD",jammed:"JAMMED",bunkerfull:"BUNKER FULL",noloader:"NO LOADER",containerfull:"CONTAINER FULL",balerfull:"BALER FULL",exportfull:"EXPORT FULL"};
const SR=[4.6,3.2]; // sprite radius: bag (0) bigger, item (1) smaller
const BAG_COL="#3F6FB5"; // default/fallback bag colour
const BAG_COL_BY={blue:"#3F6FB5",grey:"#8A857E"}; // bag colour = the supplier's waste type (blue PMC / grey fully-mixed)
function bagCol(){const src=G&&G.nodes&&G.nodes.find(isBunker);const sid=src&&((src.supplier&&src.supplier!=="__none")?src.supplier:(G.contract&&G.contract.supplier));const st=sid&&supplierStream(sid);return (st&&BAG_COL_BY[st.bag])||BAG_COL;}

/* ── SITE renderer (Phase 1 step 3) ─────────────────────────────────────────
 * The physical plant view: meadow board, property gate, warehouse shell, painted
 * zones, grid-placed unit cards, routed conveyors (chevrons) and haul roads,
 * vehicles riding their true paths (D3). Editor-grade visuals per D7 — unit
 * iconography/diorama styling is Phase 4. Base layer prerendered at 2× and
 * blitted; dynamic layer redraws per frame. Palette: design package §8.       */

/* ── SITE art (Phase 4 pre-pass, assets by Denis 2026-07-11) ──
 * All art embedded as webp data-URIs (single-file architecture). Every draw
 * falls back to the vector look until its image is decoded — and permanently
 * for units without art yet (bulk zone, landfill). Background is RECONSTRUCTED
 * canonically from the generated plan's textures: the generated art was
 * internally off-grid (±0.5 cell, inconsistent), so its materials were
 * sampled and re-composed exactly on the layout's zone rectangles. */
/*@ASSETS-START@*/
// Asset registry — extracted to real files for the PWA split (was 673 KB of base64 in the single-file build).
// loadAsset() below is unchanged: it just gets a relative URL instead of a data URL.
const ASSET_FILES=["bag_blue","bag_green","bag_yellow","bale_0","bale_1","bale_2","bale_3","bale_4","bg","bunk_blue_0","bunk_blue_1","bunk_blue_2","bunk_blue_3","bunk_blue_4","bunk_green_0","bunk_green_1","bunk_green_2","bunk_green_3","bunk_green_4","bunk_yellow_0","bunk_yellow_1","bunk_yellow_2","bunk_yellow_3","bunk_yellow_4","cont_0","cont_1","cont_2","conv_belt","fb_0","fb_1","p_PET_0","p_PET_1","p_PET_2","p_PVC_0","p_PVC_1","p_PVC_2","p_alu_0","p_alu_1","p_alu_2","p_film_0","p_film_1","p_film_2","p_paper_0","p_paper_1","p_paper_2","p_steel_0","p_steel_1","p_steel_2","unit_0","unit_1","unit_2","unit_3","unit_4","unit_5","unit_6","unit_7","veh_0","veh_1","veh_10","veh_11","veh_2","veh_3","veh_4","veh_5","veh_6","veh_7","veh_8","veh_9","veh_int","zone_0","zone_1","zone_2","zone_3","zone_4","bale_pvc","zone_pvc","zone_5","zone_bulk","zone_landfill","tile_forest1","tile_forest2","tile_forest3","tile_forest4","tile_landfill","tile_incin"];
const ASSETS={};for(const k of ASSET_FILES)ASSETS[k]="assets/"+k+".webp";
/*@ASSETS-END@*/

let siteBaseCv=null;const SITE_BS=2; // declared BEFORE the loader: onload may fire synchronously (tests) and invalidates the base
let G_frame=0;
const IMGS={};
function loadAsset(k){const im=new Image();im.onload=()=>{if(k==="bg")siteBaseCv=null;};im.decoding="async";im.src=ASSETS[k];IMGS[k]=im;}
for(const k in ASSETS)loadAsset(k);
function img(k){let im=IMGS[k];
  if(!im||im.naturalWidth===0){ // lost/evicted after backgrounding on mobile → re-decode
    if(!im||im._retried!==G_frame){loadAsset(k);IMGS[k]._retried=G_frame;}
    return null;}
  return im.complete?im:null;}
// When the tab regains visibility (app switch on mobile), force a base-layer rebuild so a
// dropped background comes back on the next frame.
if(typeof document!=="undefined"&&document.addEventListener)
  document.addEventListener("visibilitychange",()=>{if(!document.hidden){siteBaseCv=null;}});
const BALE_IMG={PET:"bale_0",steel:"bale_1",film:"bale_2",paper:"bale_3",alu:"bale_4",PVC:"bale_pvc"};
const ZONE_IMG={PET:"zone_0",ferrous:"zone_1",alu:"zone_2",carton:"zone_4",paper:"zone_4",film:"zone_3",pvc:"zone_pvc",dispose:"zone_5"}; // dedicated PVC bay art
const UNIT_IMG={opener:"unit_0",magnet:"unit_1",eddy:"unit_2",pick:"unit_3",nir:"unit_4",air:"unit_5",splitter:"unit_6"};
function bagKey(){ // nearest of the three bunker liveries to the contract's bag colour
  const h=(bagCol()||"#3F6FB5").replace("#","");
  const r=parseInt(h.slice(0,2),16),g=parseInt(h.slice(2,4),16),b=parseInt(h.slice(4,6),16);
  if(b>=g&&b>=r)return"blue"; if(g>=r)return"green"; return"yellow";}
function siteMode(){return !!(G&&G.scenario&&G.scenario.siteRef);}
const SITE_C={board:"#A7C28C",boardRow:"#9FBC82",whFloor:"#E9E3D5",wall:"#BCAF99",wallDk:"#9C8F78",surround:"#8FAA72"};
const SITE_ZCOL={road:"#6E665C",truckin:"#5E6B82",truckout:"#8A8FA0",dirt:"#A98C5E",baling:"#F2A23B",bulk:"#BCE03A",feeder:"#5BCB5C",input:"#46BFB8",output:"#E0A45C"};
const SITE_ZA={road:.82,truckin:.7,truckout:.7,dirt:.78,baling:.32,bulk:.34,feeder:.32,input:.32,output:.32};
const SITE_UCOL={input:"#46BFB8",feeder:"#5BCB5C",process:"#2F9BE8",mixer:"#7C8AA0",baler:"#F2A23B",bulk:"#BCE03A",output:"#E0A45C",landfill:"#C7E84A"};
function rrp(c,x,y,w,h,r){r=Math.min(r,w/2,h/2);c.beginPath();c.moveTo(x+r,y);c.arcTo(x+w,y,x+w,y+h,r);c.arcTo(x+w,y+h,x,y+h,r);c.arcTo(x,y+h,x,y,r);c.arcTo(x,y,x+w,y,r);c.closePath();}
function buildSiteBase(){const GW=SITE_LAYOUT.grid.w,GH=SITE_LAYOUT.grid.h,S=siteSets();
  siteBaseCv=document.createElement("canvas");siteBaseCv.width=GW*CELL*SITE_BS;siteBaseCv.height=GH*CELL*SITE_BS;
  const b=siteBaseCv.getContext("2d");b.scale(SITE_BS,SITE_BS);
  const bgi=img("bg");
  if(!bgi){siteBaseCv=null;return;} // bg not decoded → don't cache a blank base; renderSite retries next frame
  b.drawImage(bgi,0,0,GW*CELL,GH*CELL); // the corrected plan already carries walls, zones & yard
  return;
  b.fillStyle=SITE_C.board;rrp(b,0,0,GW*CELL,GH*CELL,10);b.fill();
  b.fillStyle=SITE_C.boardRow;b.globalAlpha=.5;for(let y=0;y<GH;y+=3)b.fillRect(0,y*CELL,GW*CELL,CELL);b.globalAlpha=1;
  let mnx=1e9,mny=1e9,mxx=-1e9,mxy=-1e9;for(const k of S.shell){const[x,y]=k.split(",").map(Number);mnx=Math.min(mnx,x);mny=Math.min(mny,y);mxx=Math.max(mxx,x+1);mxy=Math.max(mxy,y+1);}
  b.save();b.shadowColor="rgba(46,35,22,.28)";b.shadowBlur=16;b.shadowOffsetY=7;b.fillStyle=SITE_C.whFloor;b.fillRect(mnx*CELL,mny*CELL,(mxx-mnx)*CELL,(mxy-mny)*CELL);b.restore();
  for(const z of SITE_LAYOUT.zones){b.fillStyle=SITE_ZCOL[z.type]||"#888";b.globalAlpha=(SITE_ZA[z.type]!=null?SITE_ZA[z.type]:.3);
    for(const[x,y]of z.cells)b.fillRect(x*CELL,y*CELL,CELL,CELL);}b.globalAlpha=1;
  const inShell=(x,y)=>S.shell.has(x+","+y);
  b.strokeStyle=SITE_C.wall;b.lineWidth=6;b.lineCap="round";b.beginPath();
  for(const k of S.shell){const[x,y]=k.split(",").map(Number);
    if(!inShell(x,y-1)){b.moveTo(x*CELL,y*CELL);b.lineTo((x+1)*CELL,y*CELL);}
    if(!inShell(x,y+1)){b.moveTo(x*CELL,(y+1)*CELL);b.lineTo((x+1)*CELL,(y+1)*CELL);}
    if(!inShell(x-1,y)){b.moveTo(x*CELL,y*CELL);b.lineTo(x*CELL,(y+1)*CELL);}
    if(!inShell(x+1,y)){b.moveTo((x+1)*CELL,y*CELL);b.lineTo((x+1)*CELL,(y+1)*CELL);}}
  b.stroke();b.strokeStyle=SITE_C.wallDk;b.lineWidth=2;b.stroke();
  b.fillStyle="rgba(64,62,52,.26)";for(let x=0;x<SITE_LAYOUT.grid.w;x++)for(let y=0;y<GH;y++)if(!S.prop.has(x+","+y))b.fillRect(x*CELL,y*CELL,CELL,CELL);}
const sitePathAngleAt=pathAngleAt; // pure geometry lives in the engine (NNG-4)
function siteRoundedPath(P,r){ctx.beginPath();ctx.moveTo(P[0][0],P[0][1]);for(let i=1;i<P.length-1;i++)ctx.arcTo(P[i][0],P[i][1],P[i+1][0],P[i+1][1],r);ctx.lineTo(P[P.length-1][0],P[P.length-1][1]);}
function siteSmoothPath(P){ctx.beginPath();ctx.moveTo(P[0][0],P[0][1]);if(P.length===2){ctx.lineTo(P[1][0],P[1][1]);return;}
  for(let i=1;i<P.length-1;i++){const mx=(P[i][0]+P[i+1][0])/2,my=(P[i][1]+P[i+1][1])/2;ctx.quadraticCurveTo(P[i][0],P[i][1],mx,my);}ctx.lineTo(P[P.length-1][0],P[P.length-1][1]);}
function _edgeOffsetPath(P,off){ // shift a polyline sideways by `off` px along each segment's normal
  if(!off)return P;const out=[];
  for(let i=0;i<P.length;i++){
    const a=P[Math.max(0,i-1)],b=P[Math.min(P.length-1,i+1)];
    let nx=-(b[1]-a[1]),ny=(b[0]-a[0]);const L=Math.hypot(nx,ny)||1;nx/=L;ny/=L;
    out.push([P[i][0]+nx*off,P[i][1]+ny*off]);}
  return out;}
function _edgeLane(e){ // deterministic small offset per vehicle edge so parallel hauls fan out
  let h=0,s=(e.from+"-"+e.to);for(let i=0;i<s.length;i++)h=(h*31+s.charCodeAt(i))|0;
  return ((h%5)-2)*2.6;} // −5.2 … +5.2 px in 2.6 steps
// ── Drop shadows (S-SHADOW): one clean, contour-following cast under every RAISED object — separation
//    equipment, vehicles, conveyor belts, containers, bales. Flat zones (bulk/landfill slabs) and waste
//    particles get NONE. Shadow params are device-space, so the cast stays consistent across zoom.
function siteShadow(){ctx.shadowColor="rgba(24,18,11,.42)";ctx.shadowBlur=6;ctx.shadowOffsetX=1;ctx.shadowOffsetY=4;}
function baleShadow(){ctx.shadowColor="rgba(24,18,11,.40)";ctx.shadowBlur=3;ctx.shadowOffsetX=0.5;ctx.shadowOffsetY=2;}
function noShadow(){ctx.shadowColor="transparent";ctx.shadowBlur=0;ctx.shadowOffsetX=0;ctx.shadowOffsetY=0;}
const CONT_W=CELL*0.72,CONT_H=CELL*1.44; // roll-off container footprint (~20% down from the old 0.9×1.8)
const BALE_W=12,BALE_H=8; // one bale footprint (1.6×1.07 m) used in EVERY context: stack, belt, fork, truck bed
function drawSiteEdge(e){let P=e.route;if(!P||P.length<2)return;
  if(e.kind==="vehicle"){ // haul road route: dashed spline on the dirt (§7), fanned out per edge
    P=_edgeOffsetPath(P,_edgeLane(e));
    ctx.save();ctx.strokeStyle="rgba(126,77,31,.30)";ctx.lineWidth=7;ctx.lineCap="round";siteSmoothPath(P);ctx.stroke();
    ctx.strokeStyle="#D08A3A";ctx.lineWidth=2.4;ctx.setLineDash([7,8]);siteSmoothPath(P);ctx.stroke();ctx.setLineDash([]);
    const end=sitePathAngleAt(P,pathLen(P)-0.01); // arrowhead at destination
    ctx.translate(end.x,end.y);ctx.rotate(end.a);ctx.fillStyle="#D08A3A";
    ctx.beginPath();ctx.moveTo(-5,-4.5);ctx.lineTo(5,0);ctx.lineTo(-5,4.5);ctx.closePath();ctx.fill();ctx.restore();}
  else{ // conveyor: vector casing (corners) + straight-run TILES (art) + flow chevrons
    const jam=e.sprites.length>=(e.max||EDGE_MAX);
    ctx.lineCap="round";ctx.lineJoin="round";
    const R=9; // ONE corner radius, ONE path. Every layer is the SAME polyline stroked at a smaller width →
    //           concentric rounded strokes always share the corner, so borders never drift (no offset-path math).
    // casing (outer dark frame) → belt bed → sheen: each is P stroked narrower. Crisp edges fall out for free.
    siteShadow();ctx.strokeStyle="#1c1916";ctx.lineWidth=13;siteRoundedPath(P,R);ctx.stroke();noShadow(); // dark border rail (drop shadow on the casing only)
    ctx.strokeStyle="#6F665C";ctx.lineWidth=11;siteRoundedPath(P,R);ctx.stroke(); // metal frame
    ctx.strokeStyle=jam?"#6a352f":"#3B3833";ctx.lineWidth=9;siteRoundedPath(P,R);ctx.stroke(); // belt trough
    ctx.strokeStyle=jam?"#7a3b34":"#565149";ctx.lineWidth=7;siteRoundedPath(P,R);ctx.stroke(); // rubber bed
    // slats: short ticks laid ACROSS the belt, following the path so they wrap the corner (no butt gap)
    const _bl=pathLen(P),step=7,BW=7;
    ctx.strokeStyle="rgba(24,21,18,.5)";ctx.lineWidth=1.2;
    for(let d=step/2;d<_bl;d+=step){const q=sitePathAngleAt(P,d);
      const nx=-Math.sin(q.a),ny=Math.cos(q.a);
      ctx.beginPath();ctx.moveTo(q.x-nx*BW/2,q.y-ny*BW/2);ctx.lineTo(q.x+nx*BW/2,q.y+ny*BW/2);ctx.stroke();}
    const L=pathLen(P),n=Math.max(1,Math.round(L/26));
    ctx.fillStyle=jam?"rgba(226,140,120,.85)":"rgba(242,232,216,.55)";
    for(let i=0;i<n;i++){const p=sitePathAngleAt(P,(i+0.5)/n*L);
      ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.a);
      ctx.beginPath();ctx.moveTo(-2.6,-3.4);ctx.lineTo(3.4,0);ctx.lineTo(-2.6,3.4);ctx.lineTo(-0.6,0);ctx.closePath();ctx.fill();ctx.restore();}}}
function drawSiteSprites(e){const P=e.route;if(!P||P.length<2||e.kind==="vehicle")return;const _bc=bagCol(),_bk=bagKey(),L=pathLen(P);
  for(const s of e.sprites){const p=sitePathAngleAt(P,Math.min(1,s.t)*L);
    if(s.bale){const bi=img(BALE_IMG[baleDom(s.bale)]||"bale_0");
      if(bi)ctx.drawImage(bi,p.x-BALE_W/2,p.y-BALE_H/2,BALE_W,BALE_H);
      else{ctx.fillStyle=COL[baleDom(s.bale)];rr(ctx,p.x-5,p.y-4,10,8,2);ctx.fill();ctx.strokeStyle="#1a1714";ctx.lineWidth=1;ctx.stroke();}}
    else if(s.st===0){const gi=img("bag_"+_bk); // an unopened bag, in the contract's livery
      if(gi)ctx.drawImage(gi,p.x-5,p.y-5,10,10);
      else{ctx.fillStyle=_bc;const r=SR[0];rr(ctx,p.x-r,p.y-r,r*2,r*2,2);ctx.fill();ctx.strokeStyle="#1a1714";ctx.lineWidth=0.8;ctx.stroke();}}
    else{const pi=img("p_"+s.mat+"_"+(s.v||0)); // a liberated ITEM of its actual material (3 deterministic variants)
      if(pi){ // a soft material-coloured halo behind the item makes streams legible when tiny
        ctx.save();ctx.fillStyle=COL[s.mat];ctx.globalAlpha=0.5;ctx.beginPath();ctx.arc(p.x,p.y,6,0,7);ctx.fill();ctx.restore();
        ctx.drawImage(pi,p.x-4.5,p.y-4.5,9,9);}
      else{ctx.fillStyle=COL[s.mat];ctx.beginPath();ctx.arc(p.x,p.y,SR[1],0,7);ctx.fill();}}}}

const TRUCK_STYLE={supplier:{col:"#3F6FB5",len:76,wid:20},client:{col:"#4E5D75",len:96,wid:20},lftruck:{col:"#7C766D",len:84,wid:20}};
function truckDrawPos(t){return truckPos(t);} // berths already give each truck its own spot — no ad-hoc lane shifting
function truckSpriteKey(t){
  if(t.cls==="supplier"){const k=bagKey();return k==="green"?"veh_0":(k==="blue"?"veh_2":"veh_1");}
  if(t.cls==="client")return"veh_"+(3+t.id%2); // wooden / mesh flatbeds
  return"veh_5";} // landfill: the dark flatbed
function drawSiteTrucks(){ if(!G.trucks)return;
  for(const t of G.trucks){const p=truckDrawPos(t),st=TRUCK_STYLE[t.cls]||TRUCK_STYLE.supplier;
    const spr=img(truckSpriteKey(t));
    if(spr){const dh=2*VEH_GEO[t.cls].hl,dw=dh*spr.width/spr.height; // exact world length — rear-edge maths is exact
      ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.a+Math.PI/2); // p.a = SPRITE heading from S-MOTION (art nose-up)
      siteShadow();
      ctx.drawImage(spr,-dw/2,-dh/2,dw,dh);
      noShadow();
      if(t.cls==="client"&&t.loaded>0&&t.baleDoms){ // the ACTUAL loaded bales on the flatbed (rear = +y, nose-up frame)
        for(let i=0;i<Math.min(t.loaded,10);i++){
          const bx=(i%2?5:-5),by=dh/2-7-Math.floor(i/2)*8;
          const bi=img(BALE_IMG[t.baleDoms[i]]||"bale_0");
          if(bi)ctx.drawImage(bi,bx-BALE_W/2,by-BALE_H/2,BALE_W,BALE_H);}}
      if(t.cls==="lftruck"&&t.hauled>0){const ci=img("cont_2"); // removed container on the bed, with its own shadow
        if(ci){siteShadow();ctx.drawImage(ci,-CONT_W/2,CELL*0.1,CONT_W,CONT_H);noShadow();}}
      ctx.restore();}
    else{
    let col=st.col; if(t.cls==="supplier"){col=bagCol();}
    ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.a);
    siteShadow();
    ctx.fillStyle=col;ctx.strokeStyle="#17140f";ctx.lineWidth=1.4;
    rr(ctx,-st.len/2,-st.wid/2,st.len*0.74,st.wid,4);ctx.fill();ctx.stroke();
    ctx.fillStyle="#2B2824";rr(ctx,st.len/2-st.len*0.24,-st.wid/2+1,st.len*0.22,st.wid-2,4);ctx.fill();ctx.stroke();
    noShadow();
    ctx.restore();}
    if(cam.zoom>0.42){ // status badge (screen-aligned): what is this truck doing?
      let txt;
      if(t.state==="dwell"){
        if(t.cls==="client")txt=tr("LOADING BALES")+" "+t.loaded+"/"+t.plan;
        else{const pr=t.dw>0?Math.round(Math.max(0,Math.min(1,(G.t-t.dwT0)/t.dw))*100):0;
          txt=tr(t.cls==="supplier"?"TIPPING":"LOADING")+" "+pr+"%";}}
      else txt=(t.state==="toStop")?tr("ARRIVING"):tr("LEAVING");
      ctx.font="700 8px -apple-system,sans-serif";const w=ctx.measureText(txt).width+10;
      ctx.fillStyle="rgba(30,26,20,.78)";rr(ctx,p.x-w/2,p.y-26,w,12,6);ctx.fill();
      ctx.fillStyle=t.state==="dwell"?"#F2E8D8":"rgba(242,232,216,.7)";
      ctx.textAlign="center";ctx.textBaseline="middle";ctx.fillText(txt,p.x,p.y-20);}}}
function hitTruck(wx,wy){if(!G.trucks)return null;const R=Math.max(22,26/cam.zoom);let best=null,bd=R;
  for(const t of G.trucks){const p=truckDrawPos(t);const d=Math.hypot(p.x-wx,p.y-wy);if(d<bd){bd=d;best=t;}}
  return best;}
function inspectTruck(t){
  const CLSN={supplier:"Supplier truck",client:"Client truck",lftruck:"Landfill truck"};
  const STN={toStop:"driving in",dwell:(t.cls==="supplier"?"tipping":"loading"),exit:"driving out"};
  const n=nodeById(t.nodeId);
  let cargo="";
  if(t.cls==="supplier")cargo='<div class="row"><span class="k">'+tr("Delivering")+'</span><span class="v">'+
    (t.tipped>0?(t.tipped*PMASS).toFixed(1)+" t "+tr("tipped"):(G.logi.supTruck*PMASS).toFixed(0)+" t "+tr("incoming"))+'</span></div>';
  else if(t.cls==="client")cargo='<div class="row"><span class="k">'+tr("Loaded")+'</span><span class="v">'+
    (t.balesSold||0)+' '+tr("bales")+'</span></div>';
  else cargo='<div class="row"><span class="k">'+tr("Hauling")+'</span><span class="v">'+
    ((t.hauled||0)*PMASS).toFixed(1)+' t</span></div>';
  const eta=(t.state!=="dwell"&&t.eta>G.t)?' \u00B7 '+Math.max(0,t.eta-G.t).toFixed(1)+' min':'';
  showSheet('<h3>'+tr(CLSN[t.cls]||t.cls)+' #'+t.id+'</h3>'+
    '<div class="real">'+tr(STN[t.state]||t.state)+eta+'</div>'+
    '<div class="row"><span class="k">'+tr("Serving")+'</span><span class="v">'+(n?siteNodeLabel(n):"\u2014")+'</span></div>'+cargo);}
// Real-scale bales (anchors: 1.1 × 1.6 m ≈ 8 × 12 px, 4 per cell): export bays and balers
// show their ACTUAL stored bales as physical objects — count what you see (NNG-2).
function baleDom(b){const c=comp(b);let dom="PET",mx=0;for(const m of MAT)if(c[m]>mx){mx=c[m];dom=m;}return dom;}

function contImg(f){return img(f<=0.02?"cont_0":(f<0.85?"cont_1":"cont_2"));}
function drawContainers(n){const cs=n.containers||[];if(!cs.length)return;
  const CW=CONT_W,CH=CONT_H; // a roll-off container, standing on the bulk pad
  for(let i=0;i<cs.length;i++){const f=Math.min(1,cnt(cs[i])/G.logi.containerCap);
    const cx=n.x-n.w/2+(i+0.5)*(n.w/cs.length),cy=n.y+CELL*0.1;
    const ci=contImg(f);
    if(ci){siteShadow();ctx.drawImage(ci,cx-CW/2,cy-CH/2,CW,CH);noShadow();}
    else{siteShadow();ctx.fillStyle="rgba(40,32,20,.25)";rr(ctx,cx-CW/2,cy-CH/2,CW,CH,4);ctx.fill();noShadow();
      if(f>0){ctx.fillStyle="#7E7A6A";rr(ctx,cx-CW/2+2,cy-CH/2+2+(CH-4)*(1-f),CW-4,(CH-4)*f,3);ctx.fill();}}
    if(i===n.active){ctx.strokeStyle="#F2A93B";ctx.lineWidth=1.8;rr(ctx,cx-CW/2-1.5,cy-CH/2-1.5,CW+3,CH+3,5);ctx.stroke();}}}
function drawLandfillHold(n){const full=Math.floor(cnt(n.inBuf)/G.logi.containerCap),part=(cnt(n.inBuf)%G.logi.containerCap)/G.logi.containerCap;
  const k=Math.min(G.logi.landfillHold,full+(part>0?1:0));
  const CW=CONT_H,CH=CONT_W; // parked sideways in the waiting yard
  for(let i=0;i<k;i++){const col=i%3,row=Math.floor(i/3);
    const cx=n.x-n.w/2+(col+0.5)*(n.w/3),cy=n.y-n.h/2+(row+0.55)*CELL*1.2;
    const f=(i<full)?1:part,ci=contImg(f);
    if(ci){ctx.save();ctx.translate(cx,cy);ctx.rotate(Math.PI/2);siteShadow();ctx.drawImage(ci,-CH/2,-CW/2,CH,CW);ctx.restore();}
    else{ctx.fillStyle="rgba(40,32,20,.25)";rr(ctx,cx-CW/2,cy-CH/2,CW,CH,4);ctx.fill();
      ctx.fillStyle="#7E7A6A";rr(ctx,cx-CW/2+2,cy-CH/2+2,(CW-4)*f,CH-4,3);ctx.fill();}}}
function drawOneBale(cx,cy,b,specKey){const bw=BALE_W,bh=BALE_H; // top-down 1.6 × 1.1 m at 7.5 px/m
  const bi=img(BALE_IMG[baleDom(b)]||"bale_0");
  if(bi){baleShadow();ctx.drawImage(bi,cx-bw/2,cy-bh/2,bw,bh);noShadow();}
  else{baleShadow();ctx.fillStyle=COL[baleDom(b)];rr(ctx,cx-bw/2,cy-bh/2,bw,bh,1.6);ctx.fill();noShadow();
    ctx.strokeStyle="rgba(23,20,15,.35)";ctx.lineWidth=0.8;ctx.beginPath();
    ctx.moveTo(cx-bw/6,cy-bh/2);ctx.lineTo(cx-bw/6,cy+bh/2);ctx.moveTo(cx+bw/6,cy-bh/2);ctx.lineTo(cx+bw/6,cy+bh/2);ctx.stroke();}
  if(specKey){const g=grade(b,specKey);ctx.strokeStyle=g.ok?"#3E8E4E":"#C25B4E";ctx.lineWidth=1.3; // on-spec ✓ / ✗
    rr(ctx,cx-bw/2,cy-bh/2,bw,bh,1.6);ctx.stroke();}}
const _BQ=[[-7,-5.5],[7,-5.5],[-7,5.5],[7,5.5]]; // 2×2 within one 4 m cell
function drawBaleStack(n,list,max){ // EXPORT bay: fill cell by cell (4 per cell), dock side first
  const k=Math.min(list.length,max!=null?max:list.length);
  const gw=Math.round(n.w/CELL),gh=Math.round(n.h/CELL),spec=isSell(n)?n.spec:null;
  for(let i=0;i<k;i++){const cell=Math.floor(i/4),q=i%4;
    const cxg=cell%gw,cyg=gh-1-Math.floor(cell/gw); // bottom row first (trucks dock below)
    const cx=n.x-n.w/2+(cxg+0.5)*CELL+_BQ[q][0],cy=n.y-n.h/2+(cyg+0.5)*CELL+_BQ[q][1];
    drawOneBale(cx,cy,list[i],spec);}
  if(spec&&list.length){let on=0;for(const b of list)if(grade(b,spec).ok)on++; // on-spec tally
    ctx.font="700 8px -apple-system,sans-serif";ctx.textAlign="center";ctx.textBaseline="middle";
    const txt="✓"+on+(list.length>on?"  ✗"+(list.length-on):""),w=ctx.measureText(txt).width+10;
    ctx.fillStyle="rgba(30,26,20,.72)";rr(ctx,n.x-w/2,n.y-n.h/2-14,w,12,6);ctx.fill();
    ctx.fillStyle=list.length>on?"#E8A9A0":"#BFE3C0";ctx.fillText(txt,n.x,n.y-n.h/2-8);}}
function drawBalerStack(n,list,max){ // BALER: the four stored bales sit 2×2 in the cell OPPOSITE the inlet
  const k=Math.min(list.length,max!=null?max:list.length);if(!k)return;
  const inEdge=G.edges.find(e=>e.to===n.id&&e.kind==="conveyor");
  const inSide=(inEdge&&inEdge.toSide)||"r";
  const cxg=(inSide==="l")?Math.round(n.w/CELL)-1:0; // inlet left → stack right, else stack left
  for(let i=0;i<k;i++){const q=i%4;
    drawOneBale(n.x-n.w/2+(cxg+0.5)*CELL+_BQ[q][0],n.y-n.h/2+0.5*n.h+_BQ[q][1],list[i],null);}}
function siteNodeLabel(n){
  if(n.label)return n.label;                 // player-set name wins on the map
  if(isBunker(n))return tr("Bunker");
  if(isFeeder(n))return tr("Feeder");
  if(isBulk(n))return tr("Bulk");
  if(isLandfill(n))return tr("Landfill");
  if(isSell(n))return tr(SPECS[n.spec]?SPECS[n.spec].label:"Export");
  return tr(TYPES[n.type].name);}
function siteSpriteFor(n){ // {im, rot(rad), flip} or null → vector card
  if(n.site==="input"){const fill=Math.max(0,Math.min(0.999,cnt(n.inBuf)/capOf(n)));
    return{im:img("bunk_"+bagKey()+"_"+Math.floor(fill*5)),rot:(n.rot||0)*Math.PI/180,flip:false};}
  if(n.site==="output")return{im:img(ZONE_IMG[n.spec]||"zone_0"),rot:(n.rot||0)*Math.PI/180,flip:false};
  if(n.site==="feeder")return{im:img("fb_0"),rot:(90+(n.rot||0))*Math.PI/180,flip:false}; // art is 2×1 → +90° for the vertical footprint
  if(n.site==="baler"){const inE=G.edges.find(e=>e.to===n.id&&e.kind==="conveyor");const r=n.rot||0;
    // a vertical baler (rot 90/270) rotates its art; a horizontal one (rot 0/180) must NOT — a 180° turn
    // also flips the art vertically. Its facing is a pure horizontal mirror set by which side the inlet is on
    // (press faces the inlet); rot 180 just moves the inlet to the other side. (regression: right-strip baler
    // showed up vertically inverted when flip and a 180° rotation stacked.)
    if(r===90||r===270)return{im:img("fb_1"),rot:r*Math.PI/180,flip:false};
    return{im:img("fb_1"),rot:0,flip:(inE?inE.toSide==="l":r===180)};} // press faces the inlet
  if(n.site==="process")return{im:img(UNIT_IMG[n.type]),rot:(n.rot||0)*Math.PI/180,flip:false};
  if(n.site==="mixer")return{im:img("unit_6"),rot:(n.rot||0)*Math.PI/180,flip:false}; // junction art
  return null;} // bulk & landfill: no art yet → vector card
function _ghostNode(st,kind,gx,gy,rot){ // a throwaway node just for sprite/port geometry (not added to G)
  const fp=siteFootprint(st,rot||0);
  const sk=SITE_KIND[st]||{type:"process"};const type=(st==="process"||st==="mixer")?(kind||(st==="mixer"?"mixer":"opener")):sk.type;
  return {site:st,type:type,role:sk.role||null,gx:gx,gy:gy,rot:rot||0,
    x:(gx+fp.w/2)*CELL,y:(gy+fp.h/2)*CELL,w:fp.w*CELL,h:fp.h*CELL,
    inBuf:blankBuf(),bale:blankBuf(),bales:[],spec:null};}
function drawPlacementGhost(st,kind,gx,gy,rot,chk){
  const g=_ghostNode(st,kind,gx,gy,rot),x=gx*CELL,y=gy*CELL,w=g.w,h=g.h;
  // 1) sprite ghost (semi-transparent), or a coloured card if no art
  const sp=(TYPES[g.type]?siteSpriteFor(g):null);
  ctx.save();ctx.globalAlpha=chk.ok?0.72:0.5;
  if(sp&&sp.im){ctx.translate(g.x,g.y);if(sp.flip)ctx.scale(-1,1);ctx.rotate(sp.rot);
    const quarter=Math.abs(Math.sin(sp.rot))>0.5,dw=quarter?h:w,dh=quarter?w:h;
    ctx.drawImage(sp.im,-dw/2,-dh/2,dw,dh);
  } else {ctx.fillStyle=chk.ok?(SITE_UCOL[st]||"#8a8"):"#C25B4E";rr(ctx,x+2,y+2,w-4,h-4,7);ctx.fill();}
  ctx.restore();
  // 2) footprint outline (legality colour)
  ctx.setLineDash([6,5]);ctx.strokeStyle=chk.ok?"#2f5c2f":"#7a2620";ctx.lineWidth=2;rr(ctx,x+2,y+2,w-4,h-4,7);ctx.stroke();ctx.setLineDash([]);
  // 3) PORT nubs at their rotated positions — the visual feedback for rotation
  if(TYPES[g.type])for(const p of sitePortsOf(g)){if(p.virtual)continue;
    const px=p.x*CELL,py=p.y*CELL;
    const base=p.kind==="vehicle"?"#5AB6C4":"#F2A93B"; // teal veh / orange belt (matches live ports)
    if(p.dir==="in"){ctx.beginPath();ctx.arc(px,py,9,0,7);ctx.strokeStyle="#6BBE6E";ctx.lineWidth=2.4;ctx.stroke();}
    ctx.beginPath();ctx.arc(px,py,7,0,7);ctx.fillStyle=base;ctx.globalAlpha=0.95;ctx.fill();ctx.globalAlpha=1;
    ctx.strokeStyle="#1c1a16";ctx.lineWidth=1.6;ctx.stroke();
    // a tiny arrow showing flow direction (out = pointing away, in = pointing in)
    const dir={t:[0,-1],b:[0,1],l:[-1,0],r:[1,0]}[p.side]||[0,1],sgn=p.dir==="out"?1:-1;
    ctx.strokeStyle="#1c1a16";ctx.lineWidth=1.6;ctx.beginPath();
    ctx.moveTo(px+dir[0]*sgn*2,py+dir[1]*sgn*2);ctx.lineTo(px+dir[0]*sgn*6,py+dir[1]*sgn*6);ctx.stroke();}
  // 4) reason label if illegal
  if(!chk.ok){ctx.font="700 10px -apple-system,sans-serif";ctx.textAlign="center";ctx.textBaseline="bottom";
    const txt=tr(SITE_REASON[chk.reason]||chk.reason),tw=ctx.measureText(txt).width+12;
    ctx.fillStyle="rgba(30,26,20,.85)";rr(ctx,x+w/2-tw/2,y-19,tw,14,6);ctx.fill();
    ctx.fillStyle="#E8A9A0";ctx.fillText(txt,x+w/2,y-7);}}
function drawSiteNode(n){const x=n.x-n.w/2,y=n.y-n.h/2,col=SITE_UCOL[n.site]||"#9aa";
  const sp=siteSpriteFor(n);
  if(sp&&sp.im){
    ctx.save();ctx.translate(n.x,n.y);
    if(sp.flip)ctx.scale(-1,1);
    ctx.rotate(sp.rot);
    const quarter=Math.abs(Math.sin(sp.rot))>0.5,dw=quarter?n.h:n.w,dh=quarter?n.w:n.h;
    siteShadow();
    ctx.drawImage(sp.im,-dw/2,-dh/2,dw,dh);ctx.restore();
    const sc2=STATECOL[n.state];
    if(selNode===n||sc2){ctx.strokeStyle=selNode===n?"#2A2A2A":sc2;ctx.lineWidth=selNode===n?2.5:2;rr(ctx,x+1,y+1,n.w-2,n.h-2,7);ctx.stroke();}
    if(isSell(n))drawBaleStack(n,n.bales,G.logi.exportCap);
    else if(TYPES[n.type].isBaler)drawBalerStack(n,n.bales,G.logi.balerBales);
    // (obsolete fill/composition gauges removed 2026-07-11 — sprite fill states carry this now)
    ctx.fillStyle="rgba(40,32,20,.88)";ctx.font="800 "+Math.max(8,Math.min(11,n.w*0.16))+"px 'Baloo 2',-apple-system,sans-serif";
    ctx.textAlign="center";ctx.textBaseline="top";ctx.fillText(siteNodeLabel(n),n.x,y+n.h+3);
    if(n.state&&n.state!=="ok"){const txt=STATETXT[n.state];ctx.font="700 8px -apple-system,sans-serif";
      const w2=ctx.measureText(txt).width+12,bx=n.x-w2/2,by=y-15;
      ctx.fillStyle=n.state==="jammed"?"#5a2620":(n.state==="starved"?"#2c2824":"#4a3420");
      rr(ctx,bx,by,w2,13,6);ctx.fill();ctx.strokeStyle=sc2;ctx.lineWidth=1;ctx.stroke();
      ctx.fillStyle=sc2;ctx.textAlign="center";ctx.textBaseline="middle";ctx.fillText(txt,n.x,by+7);}
    return;}
  const hasZoneArt=(isBulk(n)&&img("zone_bulk"))||(isLandfill(n)&&img("zone_landfill"));
  if(!hasZoneArt){ // vector card (skipped when the yard-slab art covers the whole footprint)
    ctx.fillStyle=col;rr(ctx,x+2,y+2,n.w-4,n.h-4,7);ctx.fill(); // flat slab: no drop shadow (it is a zone, not a raised object)
    const g=ctx.createLinearGradient(0,y,0,y+n.h);g.addColorStop(0,"rgba(255,255,255,.30)");g.addColorStop(.5,"rgba(255,255,255,0)");g.addColorStop(1,"rgba(0,0,0,.13)");
    ctx.fillStyle=g;rr(ctx,x+2,y+2,n.w-4,n.h-4,7);ctx.fill();}
  else{ /* flat slab (bulk/landfill zone art): no drop shadow */ }
  const sc=STATECOL[n.state];
  ctx.strokeStyle=selNode===n?"#2A2A2A":(sc||"rgba(0,0,0,.18)");ctx.lineWidth=selNode===n?2.5:(sc?2:1.5);rr(ctx,x+2,y+2,n.w-4,n.h-4,7);ctx.stroke();
  const zoneImg=isBulk(n)?img("zone_bulk"):(isLandfill(n)?img("zone_landfill"):null);
  if(zoneImg)ctx.drawImage(zoneImg,x+2,y+2,n.w-4,n.h-4);            // the yard-slab art fills the footprint…
  else if(n.w>=40&&n.h>=40)icon(ctx,n,n.x,n.y-Math.min(9,n.h*0.12),Math.min(26,n.w*0.5,n.h*0.5),"rgba(40,32,20,.75)");
  if(isSell(n))drawBaleStack(n,n.bales,G.logi.exportCap);            // physical bales (4/cell, real scale)
  else if(TYPES[n.type].isBaler){drawBuffer(n,x,y);drawBalerStack(n,n.bales,G.logi.balerBales);} // press fill + stored bales (2×2 in the far cell)
  else if(isBulk(n))drawContainers(n);                              // …the physical containers sit on it
  else if(isLandfill(n))drawLandfillHold(n);                        // …parked awaiting the removal truck
  else drawBuffer(n,x,y);
  ctx.fillStyle="rgba(40,32,20,.88)";ctx.font="800 "+Math.max(8,Math.min(11,n.w*0.16))+"px 'Baloo 2',-apple-system,sans-serif";
  ctx.textAlign="center";ctx.textBaseline="top";ctx.fillText(siteNodeLabel(n),n.x,y+n.h+3);
  if(isSell(n)){ctx.fillStyle="rgba(40,32,20,.7)";ctx.font="700 9px -apple-system,sans-serif";
    ctx.fillText((n.bales?n.bales.length:0)+" \u25A4",n.x,y+n.h+15);}
  if(n.state&&n.state!=="ok"){const txt=STATETXT[n.state];ctx.font="700 8px -apple-system,sans-serif";
    const w=ctx.measureText(txt).width+12,bx=n.x-w/2,by=y-15;
    ctx.fillStyle=n.state==="jammed"?"#5a2620":(n.state==="starved"?"#2c2824":"#4a3420");
    rr(ctx,bx,by,w,13,6);ctx.fill();ctx.strokeStyle=sc;ctx.lineWidth=1;ctx.stroke();
    ctx.fillStyle=sc;ctx.textAlign="center";ctx.textBaseline="middle";ctx.fillText(txt,n.x,by+7);}}

/* ── SITE build UI (Phase 3) ── tap-to-place with a ghost, two-tap wiring, demolish, undo ── */
const BUILD={mode:null,sel:null,gx:0,gy:0,rot:0,from:null,fromSide:null,undo:[]};
const SITE_CATALOG=[ // [siteType, kind, display name]
  ["input",null,"Bunker"],["feeder",null,"Feeder"],
  ["process","opener","Bag opener"],["process","magnet","Magnet"],["process","eddy","Eddy current"],
  ["process","air","Air classifier"],["process","nir","NIR sorter"],["process","pick","Picking station"],["process","splitter","Splitter"],["mixer",null,"Mixer"],
  ["baler",null,"Baler"],["bulk",null,"Container zone"],["output",null,"Export bay"],["landfill",null,"Landfill"]];
const SITE_REASON={offgrid:"Outside the map",offproperty:"Not your land",needshell:"Must be INSIDE the warehouse",
  needyard:"Must be OUTSIDE the warehouse",overlap:"Overlaps a unit",cash:"Not enough cash",
  zone_input:"Bunkers go on the teal intake apron",zone_feeder:"Feeders go on the green strip",
  zone_baler:"Balers go on the orange side strips",zone_process:"Sorting machines go in the white corridor",
  zone_bulk:"Container zones go on the lime strip",zone_output:"Export bays go on the orange output apron",
  zone_landfill:"Landfills go in the lower yard",
  wall_baler:"Turn the baler so its bale store faces a hall wall",
  wall_feeder:"Turn the feeder so its output faces the hall wall",
  nooutport:"That side has no output",noinport:"That unit has no matching inlet",
  needbelt:"A conveyor port only links to a conveyor inlet",needveh:"A vehicle port only links to a vehicle bay",
  inportused:"That inlet is already fed",
  portused:"That output is already wired",dup:"Already connected",noroute:"No route reaches it",
  bunkerin:"Bunkers are truck-fed",bunkerout:"A bunker only feeds a feeder (loader)",
  feederin:"A feeder is only fed by a bunker (loader)",balerout:"A baler only ships to an export bay (forklift)",
  exportin:"An export bay only receives baler forklifts",bulkout:"A container zone only ships to the landfill (truck)",
  landfillin:"The landfill only receives container trucks",sink:"Nothing leaves this unit by wire",same:"Same unit",notsite:"Not a site unit"};
let _bbar=null;
function buildBar(){if(_bbar)return _bbar;
  _bbar=document.createElement("div");
  _bbar.style.cssText="position:fixed;left:50%;transform:translateX(-50%);bottom:170px;z-index:40;display:none;gap:8px;";
  _bbar.innerHTML='<button id="bRot" style="min-width:46px;height:46px;border-radius:12px;border:1px solid #5a5248;background:#2e2a25;color:#F2E8D8;font-size:18px">\u27F2</button>'+
    '<button id="bOk" style="min-width:86px;height:46px;border-radius:12px;border:0;background:#7FA86B;color:#1c1a16;font-weight:800;font-size:15px">\u2713</button>'+
    '<button id="bNo" style="min-width:46px;height:46px;border-radius:12px;border:1px solid #5a5248;background:#2e2a25;color:#F2E8D8;font-size:16px">\u2715</button>'+
    '<button id="bUndo" style="min-width:46px;height:46px;border-radius:12px;border:1px solid #5a5248;background:#2e2a25;color:#F2E8D8;font-size:18px">\u21B6</button>';
  document.getElementById("wrap").appendChild(_bbar);
  _bbar.querySelector("#bRot").addEventListener("click",()=>{BUILD.rot=(BUILD.rot+90)%360;});
  _bbar.querySelector("#bNo").addEventListener("click",()=>{BUILD.moveNode=null;buildExit();});
  _bbar.querySelector("#bOk").addEventListener("click",()=>{
    if(BUILD.mode==="move"&&BUILD.moveNode){
      const r=siteMoveUnit(BUILD.moveNode,BUILD.gx,BUILD.gy,BUILD.rot);
      if(!r.ok){toast(tr(SITE_REASON[r.reason]||r.reason),"warn");return;}
      toast(tr("Moved"));saveGame();BUILD.mode=null;BUILD.moveNode=null;
      const ch=document.getElementById("chint");if(ch)ch.style.display="none";updateBuildBar();return;}
    if(BUILD.mode!=="place"||!BUILD.sel)return;
    const r=sitePlaceUnit(BUILD.sel[0],BUILD.sel[1],BUILD.gx,BUILD.gy,BUILD.rot);
    if(!r.ok){toast(tr(SITE_REASON[r.reason]||r.reason),"warn");return;}
    BUILD.undo.push({t:"place",node:r.node,cost:r.cost});
    if(tutoActive()&&isSell(r.node)&&SITE_TUTO[G.tutStep||0]&&SITE_TUTO[G.tutStep||0].id==="export"){
      r.node.spec="ferrous";toast(tr("Bay set to FERROUS \u2014 your magnet\u2019s steel"),"");}
    toast(tr(BUILD.sel[2])+" \u2212"+Math.round(r.cost/1000)+" k\u20AC");saveGame();
    buildExit();}); // placed → straight back to the game (no re-armed ghost, no phantom overlap warning)
  return _bbar;}
function updateBuildBar(){const b=buildBar();
  b.style.display=(BUILD.mode==="place"||BUILD.mode==="move")?"flex":"none";
  const u=document.getElementById("undoBtn");if(u)u.disabled=!BUILD.undo.length;
  const c=document.getElementById("connBtn");if(c){c.style.display=siteMode()?"":"none";c.classList.toggle("on",BUILD.mode==="connect");}}
function buildExit(){BUILD.mode=null;BUILD.sel=null;BUILD.from=null;BUILD.fromSide=null;BUILD.moveNode=null;
  const ch=document.getElementById("chint");if(ch)ch.style.display="none";updateBuildBar();}
function startMoveUnit(n){BUILD.mode="move";BUILD.moveNode=n;BUILD.rot=n.rot||0;
  BUILD.moveOrig={gx:n.gx,gy:n.gy,rot:n.rot||0};BUILD.gx=n.gx;BUILD.gy=n.gy;
  showHint(tr("Drag onto the grid, \u2713 to confirm"));updateBuildBar();}
function buildUndo(){const u=BUILD.undo.pop();if(!u)return;
  if(u.t==="place"&&G.nodes.indexOf(u.node)>=0){const r=siteDemolish(u.node);
    G.cash+=Math.max(0,u.cost-r.refund);toast(tr("Removed")+" +"+Math.round(u.cost/1000)+" k\u20AC");}
  else if(u.t==="connect"&&G.edges.indexOf(u.edge)>=0){siteDisconnect(u.edge);
    G.cash+=u.cost;if(u.cost)toast(tr("Disconnected")+" +"+Math.round(u.cost/1000)+" k\u20AC");else toast(tr("Disconnected"));}
  saveGame();updateBuildBar();}
function openSitePalette(){
  let b='<h3>'+tr("Build")+'</h3><div class="real">'+tr("Tap a unit, place it on the grid, then wire it from its inspector.")+'</div><div class="palgrid">';
  for(const[st,kind,name]of SITE_CATALOG){const cost=siteUnitCost(st,kind);
    b+='<div class="palcard" data-bsel="'+st+':'+(kind||"")+'" style="border-color:'+(SITE_UCOL[st]||"#666")+'">'+
       '<div class="pt">'+tr(name)+'</div><div class="pd">'+Math.round(cost/1000)+' k\u20AC \u00B7 '+
       tr(SITE_SHELL_RULE[st]==="in"?"inside the warehouse":"in the yard")+'</div></div>';}
  b+='</div>';
  showSheet(b);
  sheet.querySelectorAll("[data-bsel]").forEach(el=>el.addEventListener("click",()=>{
    const[st,kind]=el.dataset.bsel.split(":");
    const item=SITE_CATALOG.find(c=>c[0]===st&&(c[1]||"")===kind);
    BUILD.mode="place";BUILD.sel=[st,kind||null,item?item[2]:st];BUILD.rot=0;
    const c=p2w(VW/2,VH/2),fp=siteFootprint(st,0);
    BUILD.gx=Math.max(0,Math.round(c.x/CELL-fp.w/2));BUILD.gy=Math.max(0,Math.round(c.y/CELL-fp.h/2));
    closeSheet();updateBuildBar();showHint(tr("Tap the grid to position, \u2713 to build"));}));}
function drawTutoZone(){
  if(!tutoActive())return;
  const st=SITE_TUTO[G.tutStep||0];if(!st.zone)return;
  const p=0.25+0.2*Math.sin(Date.now()/300);
  const[x0,y0,x1,y1]=st.zone;
  ctx.strokeStyle="rgba(242,169,59,"+(p+0.35)+")";ctx.lineWidth=3;ctx.setLineDash([10,7]);
  rr(ctx,x0*CELL+2,y0*CELL+2,(x1-x0+1)*CELL-4,(y1-y0+1)*CELL-4,10);ctx.stroke();ctx.setLineDash([]);}
function drawBuildOverlay(){
  drawTutoZone();
  if(BUILD.mode==="move"&&BUILD.moveNode){
    const n=BUILD.moveNode,st=n.site;
    const PZ=sitePlaceZones(),zoneSet=PZ[st];
    if(zoneSet){const pulse=0.10+0.06*Math.sin(Date.now()/400);
      ctx.fillStyle="rgba(107,190,110,"+pulse+")";
      for(const k of zoneSet){const[zx,zy]=k.split(",").map(Number);ctx.fillRect(zx*CELL,zy*CELL,CELL,CELL);}}
    const fp=siteFootprint(st,BUILD.rot),chk=siteCanPlace(st,BUILD.gx,BUILD.gy,BUILD.rot,n.id);
    const gx=BUILD.gx*CELL,gy=BUILD.gy*CELL,gw=fp.w*CELL,gh=fp.h*CELL;
    // live preview of where each connected edge would re-route to
    const nx=(BUILD.gx+fp.w/2)*CELL,ny=(BUILD.gy+fp.h/2)*CELL;
    ctx.strokeStyle="rgba(242,169,59,.5)";ctx.lineWidth=2;ctx.setLineDash([5,5]);
    for(const e of G.edges){if(e.from!==n.id&&e.to!==n.id)continue;
      const other=nodeById(e.from===n.id?e.to:e.from);if(!other)continue;
      ctx.beginPath();ctx.moveTo(nx,ny);ctx.lineTo(other.x,other.y);ctx.stroke();}
    ctx.setLineDash([]);
    ctx.globalAlpha=0.6;ctx.fillStyle=chk.ok?(SITE_UCOL[st]||"#8a8"):"#C25B4E";
    rr(ctx,gx+2,gy+2,gw-4,gh-4,7);ctx.fill();ctx.globalAlpha=1;
    ctx.setLineDash([6,5]);ctx.strokeStyle=chk.ok?"#2f5c2f":"#7a2620";ctx.lineWidth=2;rr(ctx,gx+2,gy+2,gw-4,gh-4,7);ctx.stroke();ctx.setLineDash([]);
    if(!chk.ok){ctx.font="700 10px -apple-system,sans-serif";ctx.textAlign="center";ctx.textBaseline="bottom";
      const txt=tr(SITE_REASON[chk.reason]||chk.reason),tw=ctx.measureText(txt).width+12;
      ctx.fillStyle="rgba(30,26,20,.85)";rr(ctx,gx+gw/2-tw/2,gy-19,tw,14,6);ctx.fill();
      ctx.fillStyle="#E8A9A0";ctx.fillText(txt,gx+gw/2,gy-7);}}
  if(BUILD.mode==="place"&&BUILD.sel){
    const[st,kind]=BUILD.sel;
    const PZ=sitePlaceZones(),zoneSet=PZ[st]; // shade the legal placement area for this family
    if(zoneSet){const pulse=0.10+0.06*Math.sin(Date.now()/400);
      ctx.fillStyle="rgba(107,190,110,"+pulse+")";
      for(const k of zoneSet){const[zx,zy]=k.split(",").map(Number);ctx.fillRect(zx*CELL,zy*CELL,CELL,CELL);}}
    const fp=siteFootprint(st,BUILD.rot),chk=siteCanPlace(st,BUILD.gx,BUILD.gy,BUILD.rot);
    drawPlacementGhost(st,kind,BUILD.gx,BUILD.gy,BUILD.rot,chk);}
  if(BUILD.mode==="connect"){
    const pulse=0.75+0.25*Math.sin(Date.now()/280);
    for(const n of G.nodes){if(n.gx==null)continue;
      // when a source is armed, outline every unit that can legally receive it
      if(BUILD.from&&BUILD.fromSide&&n.id!==BUILD.from.id){
        const ts=autoToSide(BUILD.from,BUILD.fromSide,n);
        if(siteCanConnect(BUILD.from,BUILD.fromSide,n,ts).ok){
          ctx.strokeStyle="rgba(107,190,110,"+pulse+")";ctx.lineWidth=3;
          rr(ctx,n.x-n.w/2-3,n.y-n.h/2-3,n.w+6,n.h+6,9);ctx.stroke();}}
      // draw the unit's REAL ports (the exact set the tap resolves against). Colour = KIND:
      // conveyor = orange, vehicle = teal. Inputs get a green ring. Armed one glows; wired outputs dim.
      for(const a of siteAnchors(n)){
        const px=a.x*CELL,py=a.y*CELL,on=BUILD.from===n&&BUILD.fromSide===a.side;
        const wired=a.role==="out"&&G.edges.some(e=>e.from===n.id&&e.fromPort===a.port);
        const R=on?11*pulse:(wired?6:9);
        const base=a.kind==="vehicle"?"rgba(90,182,196,.92)":"rgba(242,169,59,.92)"; // teal veh / orange belt
        if(a.role==="in"){ // green ring around an inlet
          ctx.beginPath();ctx.arc(px,py,R+2.5,0,7);ctx.strokeStyle="rgba(107,190,110,.95)";ctx.lineWidth=2.4;ctx.stroke();}
        ctx.beginPath();ctx.arc(px,py,R,0,7);
        ctx.fillStyle=on?"#F2A93B":(wired?"rgba(90,84,74,.8)":base);
        ctx.fill();ctx.strokeStyle="#1c1a16";ctx.lineWidth=1.8;ctx.stroke();}}}}
function siteViewFit(){const bw=SITE_LAYOUT.grid.w*CELL,bh=SITE_LAYOUT.grid.h*CELL;
  const z=Math.max(0.35,Math.min(1.6,(VW-14)/bw));
  cam.zoom=z;cam.x=(VW-bw*z)/2;cam.y=(bh*z<=VH-20)?(VH-bh*z)/2:12;}
function updateCoach(){const el=document.getElementById("coach");if(!el)return;
  const on=tutoActive();
  el.classList.remove("hide"); // site coach is display-driven, never the legacy .hide opacity trick
  el.style.display=on?"block":"none";
  const ab=document.getElementById("addBtn"),cb=document.getElementById("connBtn");
  if(ab)ab.classList.remove("pulseBtn");if(cb)cb.classList.remove("pulseBtn");
  if(!on){if(G&&G._tutoDone&&!G._tutoCongrats){G._tutoCongrats=true;
    toast(tr("First sale! The plant is yours \u2014 grow it."),"");saveGame();}
    return;}
  const st=SITE_TUTO[G.tutStep||0];
  document.getElementById("coachStep").textContent=tr("TUTORIAL");
  const _pg=document.getElementById("coachProg2");if(_pg)_pg.textContent=((G.tutStep||0)+1)+"/"+SITE_TUTO.length;
  const _ob=document.getElementById("coachObj");if(_ob)_ob.textContent=tr("Goal")+": "+locF(TUTO_OBJ.en,TUTO_OBJ.fr);
  document.getElementById("coachTxt").textContent=tr(st.txt);
  const pb=st.btn?document.getElementById(st.btn):(st.zone||st.unit?document.getElementById("addBtn"):null);
  if(pb)pb.classList.add("pulseBtn");
  _tutoUnit=st.unit||null; // the palette card to highlight when the Add sheet is open
  G._tutoDirty=false;}
let _uiSite=null,_tutoUnit=null;
// ─── Environment decor: one grid-sized tile in each of the 8 cells around the plant. The three central
//     tiles (landfill / plant / incinerator) share the road corridor on their right; forest fills the rest.
const SURROUND=[{k:"tile_forest1",cx:-1,cy:-1},{k:"tile_landfill",cx:0,cy:-1},{k:"tile_forest2",cx:1,cy:-1},
                {k:"tile_forest3",cx:-1,cy:0},                                 {k:"tile_forest4",cx:1,cy:0},
                {k:"tile_forest2",cx:-1,cy:1},{k:"tile_incin",cx:0,cy:1},      {k:"tile_forest1",cx:1,cy:1}];
function drawSiteSurround(){const TW=SITE_LAYOUT.grid.w*CELL,TH=SITE_LAYOUT.grid.h*CELL;
  const vx0=-cam.x/cam.zoom,vy0=-cam.y/cam.zoom,vx1=(VW-cam.x)/cam.zoom,vy1=(VH-cam.y)/cam.zoom; // cull off-screen tiles
  for(const t of SURROUND){const im=img(t.k);if(!im||!im.width)continue;
    const x=t.cx*TW,y=t.cy*TH;if(x+TW<vx0||x>vx1||y+TH<vy0||y>vy1)continue;
    ctx.drawImage(im,x,y,TW,TH);}}
// Keep the camera inside the tiled world: zoom-out stops when the whole 3×3 extent fits, pan stays within it.
function clampCam(){if(!siteMode())return;const TW=SITE_LAYOUT.grid.w*CELL,TH=SITE_LAYOUT.grid.h*CELL;
  const x0=-TW,y0=-TH,x1=2*TW,y1=2*TH,ew=x1-x0,eh=y1-y0;
  cam.zoom=Math.max(Math.max(VW/ew,VH/eh),Math.min(4.8,cam.zoom));
  const loX=VW-x1*cam.zoom,hiX=-x0*cam.zoom;cam.x=loX<=hiX?Math.min(hiX,Math.max(loX,cam.x)):(loX+hiX)/2;
  const loY=VH-y1*cam.zoom,hiY=-y0*cam.zoom;cam.y=loY<=hiY?Math.min(hiY,Math.max(loY,cam.y)):(loY+hiY)/2;}
function renderSite(){
  G_frame++;
  if(_uiSite!==true){_uiSite=true;updateBuildBar();}
  if(tutoActive()||G._tutoDirty||G._tutoDone&&!G._tutoCongrats)updateCoach();
  if(!siteBaseCv||!img("bg"))buildSiteBase(); // rebuild if the base OR the bg bitmap was evicted
  if(!siteBaseCv)return; // bg not decoded yet this frame — skip cleanly, retry next frame
  ctx.setTransform(DPR,0,0,DPR,0,0);ctx.fillStyle=SITE_C.surround;ctx.fillRect(0,0,VW,VH);
  clampCam();
  ctx.setTransform(DPR*cam.zoom,0,0,DPR*cam.zoom,DPR*cam.x,DPR*cam.y);
  drawSiteSurround(); // environment tiles behind the plant
  ctx.drawImage(siteBaseCv,0,0,SITE_LAYOUT.grid.w*CELL,SITE_LAYOUT.grid.h*CELL);
  if(cam.zoom>0.5&&(BUILD.mode==="place"||BUILD.mode==="move")){ctx.strokeStyle="rgba(40,34,26,.14)";ctx.lineWidth=1/cam.zoom;ctx.beginPath(); // game grid — shown ONLY while placing/moving a unit; hidden otherwise
    for(let x=0;x<=SITE_LAYOUT.grid.w;x++){ctx.moveTo(x*CELL,0);ctx.lineTo(x*CELL,SITE_LAYOUT.grid.h*CELL);}
    for(let y=0;y<=SITE_LAYOUT.grid.h;y++){ctx.moveTo(0,y*CELL);ctx.lineTo(SITE_LAYOUT.grid.w*CELL,y*CELL);}ctx.stroke();}
  for(const e of G.edges)drawSiteEdge(e);      // connections under units (layer model §2)
  for(const e of G.edges)drawSiteSprites(e);
  for(const n of G.nodes)drawSiteNode(n);
  drawUnconnectedPorts();
  drawVehicles();
  drawSiteTrucks();
  drawBuildOverlay();
  updateHUD();
  tutorialPoll();}
function drawUnconnectedPorts(){
  if(!siteMode())return;
  const pulse=0.5+0.5*Math.sin(Date.now()/240);
  for(const n of G.nodes){if(n.gx==null)continue;
    for(const p of sitePortsOf(n)){if(!portNeedsWire(n,p))continue;
      const px=p.x*CELL,py=p.y*CELL;
      ctx.beginPath();ctx.arc(px,py,7+pulse*2,0,7);
      ctx.fillStyle="rgba(210,91,78,"+(0.55+0.35*pulse)+")";ctx.fill();
      ctx.strokeStyle="#7a2620";ctx.lineWidth=1.5;ctx.stroke();
      ctx.fillStyle="#fff";ctx.font="700 9px -apple-system,sans-serif";ctx.textAlign="center";ctx.textBaseline="middle";
      ctx.fillText("!",px,py+0.5);}}}
function hitVehicle(wx,wy){if(!G.vehicles)return null;const R=Math.max(13,17/cam.zoom);let best=null,bd=R;
  for(const v of G.vehicles){const p=vehPos(v);const d=Math.hypot(p.x-wx,p.y-wy);if(d<bd){bd=d;best=v;}}
  return best;}
function inspectVehicle(v){
  const CLSN={loader:"Wheel loader",forklift:"Forklift",ctruck:"Container truck"};
  const STN={idle:"idle",toSource:"driving to pickup",loading:"loading",toDest:"driving to drop-off",unloading:"unloading"};
  const src=nodeById(v.fromId),dst=nodeById(v.toId),home=nodeById(v.home);
  const col=VEH_COLS[v.cls]||"#E0B341";
  const carried=cnt(v.payload),balesT=(v.baleLoad||[]).reduce((s,b)=>s+cnt(b),0);
  let cargo;
  if(v.baleLoad&&v.baleLoad.length)cargo='<div class="row"><span class="k">'+tr("Carrying")+'</span><span class="v">'+v.baleLoad.length+' '+tr("bales")+' \u00B7 '+(balesT*PMASS).toFixed(1)+' t</span></div>';
  else if(carried>0)cargo='<div class="row"><span class="k">'+tr("Carrying")+'</span><span class="v">'+(carried*PMASS).toFixed(1)+' t</span></div>'+compBar(v.payload);
  else cargo='<div class="row"><span class="k">'+tr("Carrying")+'</span><span class="v">'+tr("empty")+'</span></div>';
  const leg=(v.state==="toSource"||v.state==="toDest")?
    '<div class="row"><span class="k">'+tr("Trip")+'</span><span class="v">'+
    (src?siteNodeLabel(src):"\u2014")+' \u2192 '+(dst?siteNodeLabel(dst):"\u2014")+
    (v.eta>G.t?' \u00B7 '+Math.max(0,v.eta-G.t).toFixed(1)+' min':'')+'</span></div>':
    '<div class="row"><span class="k">'+tr("At")+'</span><span class="v">'+
    siteNodeLabel(v.state==="loading"?src:(v.state==="unloading"?dst:(home||dst||src))||{})+'</span></div>';
  showSheet('<h3><span style="display:inline-block;width:12px;height:9px;border-radius:2px;background:'+col+';margin-right:8px"></span>'+
    tr(CLSN[v.cls]||v.cls)+' #'+v.id+'</h3>'+
    '<div class="real">'+tr(STN[v.state]||v.state)+'</div>'+leg+cargo);}

function render(){
  if(siteMode()){renderSite();return;}
  ctx.setTransform(DPR,0,0,DPR,0,0);ctx.fillStyle="#1F1D1B";ctx.fillRect(0,0,VW,VH);drawGrid();
  ctx.setTransform(DPR*cam.zoom,0,0,DPR*cam.zoom,DPR*cam.x,DPR*cam.y);
  for(const e of G.edges)drawEdge(e);
  for(const e of G.edges)drawSprites(e);
  for(const n of G.nodes)drawNode(n);
  drawVehicles();
  if(DBG_HIT){ctx.lineWidth=1.5/cam.zoom;const PR=Math.max(15,22/cam.zoom);
    for(const n of G.nodes){ctx.strokeStyle="rgba(65,224,163,.75)";ctx.strokeRect(n.x-n.w/2,n.y-n.h/2,n.w,n.h);
      if(!isInput(n)&&!isBunker(n)&&!isLandfill(n)&&!isExport(n)){const ip=inPortPos(n);ctx.beginPath();ctx.arc(ip.x,ip.y,PR,0,7);ctx.stroke();}
      if(!isOutput(n))for(const pt of TYPES[n.type].out){const op=outPortPos(n,pt);if(op){ctx.beginPath();ctx.arc(op.x,op.y,PR,0,7);ctx.stroke();}}}
    if(_dbgTap){ctx.strokeStyle="#FF4D4D";ctx.lineWidth=2/cam.zoom;const r=14/cam.zoom;ctx.beginPath();ctx.moveTo(_dbgTap.x-r,_dbgTap.y);ctx.lineTo(_dbgTap.x+r,_dbgTap.y);ctx.moveTo(_dbgTap.x,_dbgTap.y-r);ctx.lineTo(_dbgTap.x,_dbgTap.y+r);ctx.stroke();}}
  if(G.connecting)drawConnecting();
  updateHUD();
  tutorialPoll();
}
function drawGrid(){const step=40*cam.zoom;if(step<14)return;const ox=((cam.x%step)+step)%step,oy=((cam.y%step)+step)%step;
  ctx.strokeStyle="rgba(255,255,255,0.025)";ctx.lineWidth=1;ctx.beginPath();
  for(let x=ox;x<VW;x+=step){ctx.moveTo(x,0);ctx.lineTo(x,VH);}for(let y=oy;y<VH;y+=step){ctx.moveTo(0,y);ctx.lineTo(VW,y);}ctx.stroke();}
// Transport regimes (Bible §7): a VEHICLE route crosses a storage boundary (loader bunker→feeder,
// container-truck bulk→landfill, forklift baler→export); everything else is a within-line BELT.
const VEH_COL="#E0B341",CONV_COL="#5d574e";
function isVehicleEdge(a,b){return !!a&&!!b&&((isBunker(a)&&isFeeder(b))||(isBulk(a)&&isLandfill(b))||(TYPES[a.type].isBaler&&isExport(b)));}
function drawEdge(e){const pp=edgePath(e);if(!pp)return;
  const a=nodeById(e.from),b=nodeById(e.to),veh=isVehicleEdge(a,b);
  ctx.lineCap="round";
  if(veh){ ctx.strokeStyle="rgba(224,179,65,0.34)";ctx.lineWidth=3;ctx.setLineDash([2,6]); } // haul road — trucks travel it, no belt sprites
  else{ const jam=e.sprites.length>=(e.max||EDGE_MAX);ctx.strokeStyle=jam?"#7a3b34":CONV_COL;ctx.lineWidth=jam?5:4;ctx.setLineDash([]); }
  ctx.beginPath();ctx.moveTo(pp.p0.x,pp.p0.y);ctx.bezierCurveTo(pp.c0.x,pp.c0.y,pp.c1.x,pp.c1.y,pp.p1.x,pp.p1.y);ctx.stroke();
  ctx.setLineDash([]);}
function drawSprites(e){const pp=edgePath(e);if(!pp)return;const _bc=bagCol();
  for(const s of e.sprites){const p=bez(pp,Math.min(1,s.t));
    if(s.bale){const c=comp(s.bale);let dom="PET",mx=0;for(const m of MAT)if(c[m]>mx){mx=c[m];dom=m;}
      ctx.fillStyle=COL[dom];rr(ctx,p.x-5,p.y-4,10,8,2);ctx.fill();ctx.strokeStyle="#1a1714";ctx.lineWidth=1;ctx.stroke();}
    else{if(s.st===0){ctx.fillStyle=_bc;const r=SR[0];rr(ctx,p.x-r,p.y-r,r*2,r*2,2);ctx.fill();ctx.strokeStyle="#1a1714";ctx.lineWidth=0.8;ctx.stroke();}else{ctx.fillStyle=COL[s.mat];ctx.beginPath();ctx.arc(p.x,p.y,SR[1],0,7);ctx.fill();}}}}
const VEH_COLS={loader:"#E0B341",forklift:"#E08A41",ctruck:"#6E9BC4"};
// Draw each pool vehicle at its interpolated world position (vehPos, from the engine). Moving vehicles
// ride the haul road at full opacity; stationary ones park just below the node they're working, dimmed.
const VEHA=new WeakMap(); // last heading per vehicle (renderer-local, never serialized)
function vehSpriteKey(v){
  if(v.cls==="loader")return"veh_"+(6+v.id%3);
  if(v.cls==="forklift")return"veh_"+(9+v.id%3);
  return"veh_int";} // internal container hauler: the roll-off ampliroll
function drawVehicles(){ if(!G.vehicles)return; const _parkIdx={};
  for(const v of G.vehicles){
    const p=vehPos(v),moving=(v.state==="toSource"||v.state==="toDest"),atNode=!moving;
    const col=VEH_COLS[v.cls]||VEH_COL,loaded=(cnt(v.payload)>0)||(v.baleLoad&&v.baleLoad.length>0);
    const site=siteMode();
    const src=nodeById(v.fromId),dst=nodeById(v.toId),home=nodeById(v.home);
    // site: vehPos returns the exact stand point (nose-to-dock, body outside) — no offset/de-stack needed.
    // flowsheet fallback keeps the old vertical nudge.
    const px=p.x,py=p.y+(site?0:(atNode?38:0)),long=(v.cls==="ctruck"),hw=site?(long?17:13):(long?8:6),hh=site?7:4.5;
    const spr=site?img(vehSpriteKey(v)):null;
    if(spr){
      const pose=vehFullPose(v); // S-MOTION: position AND sprite heading from one model
      const dh=2*VEH_GEO[v.cls].hl,dw=dh*spr.width/spr.height; // exact world length per class
      ctx.save();ctx.translate(pose.x,pose.y);ctx.rotate(pose.a+Math.PI/2+(v.cls==="ctruck"?Math.PI:0)); // ctruck art faces backwards → +180°
      ctx.globalAlpha=moving?1:0.85;
      siteShadow();
      ctx.drawImage(spr,-dw/2,-dh/2,dw,dh);
      noShadow();
      if(v.baleLoad&&v.baleLoad.length){ // the actual bales, stacked on the forks
        for(let i=0;i<Math.min(v.baleLoad.length,3);i++){
          const bi=img(BALE_IMG[baleDom(v.baleLoad[i])]||"bale_0");
          if(bi)ctx.drawImage(bi,-BALE_W/2+i*1.5,-dh/2-2-i*2,BALE_W,BALE_H);}}
      else if(cnt(v.payload)>0){
        if(v.cls==="ctruck"){const ci=img("cont_2"); // hauled container, seated on the REAR of the bed (behind the cab)
          if(ci){siteShadow();ctx.drawImage(ci,-CONT_W/2,-CELL,CONT_W,CONT_H);noShadow();}} // its own drop shadow
        else{const gi=img("bag_"+bagKey()); // bags heaped in the loader's bucket (front)
          if(gi){ctx.drawImage(gi,-7,-dh/2-1,9,9);ctx.drawImage(gi,-1,-dh/2-3,9,9);ctx.drawImage(gi,3,-dh/2,8,8);}
          else{ctx.fillStyle="rgba(242,232,216,.85)";ctx.beginPath();ctx.arc(0,-dh/4,3.4,0,7);ctx.fill();}}}
      ctx.restore();ctx.globalAlpha=1;}
    else{
      ctx.globalAlpha=moving?1:0.55;
      ctx.fillStyle=col;ctx.strokeStyle="#17140f";ctx.lineWidth=1.2;
      rr(ctx,px-hw,py-hh,hw*2,hh*2,2);ctx.fill();ctx.stroke();
      if(loaded){
        if(site&&v.baleLoad&&v.baleLoad.length){ctx.fillStyle=COL[baleDom(v.baleLoad[0])];rr(ctx,px-6,py-4,12,8,1.6);ctx.fill();ctx.strokeStyle="rgba(23,20,15,.7)";ctx.lineWidth=0.8;ctx.stroke();}
        else{ctx.fillStyle="#F2E8D8";rr(ctx,px-hw+2,py-hh+1.6,hw*2-4,hh*2-3.2,1.2);ctx.fill();}}
      if(v.cls==="forklift"){ctx.strokeStyle=col;ctx.lineWidth=1.4;ctx.beginPath();ctx.moveTo(px+hw,py-2);ctx.lineTo(px+hw+3,py-2);ctx.moveTo(px+hw,py+2);ctx.lineTo(px+hw+3,py+2);ctx.stroke();}
      ctx.globalAlpha=1;}
  }
}
function drawNode(n){const t=TYPES[n.type],x=n.x-n.w/2,y=n.y-n.h/2;
  ctx.fillStyle=isDispose(n)?"#2b2420":(isOutput(n)?"#2e2a26":"#2A2724");rr(ctx,x,y,n.w,n.h,12);ctx.fill();
  const sc=STATECOL[n.state];
  ctx.lineWidth=sc?2:1.5;ctx.strokeStyle=selNode===n?"#D98E48":(sc||"#403A34");ctx.stroke();
  icon(ctx,n,n.x,n.y-7,38,sc&&n.state!=="starved"?sc:"#D98E48");
  // buffer gauge bottom edge
  if(!isOutput(n))drawBuffer(n,x,y);
  if(isSell(n))drawExportInfo(n);
  if(t.isPick){ctx.fillStyle="#C9BFB2";ctx.font="700 11px -apple-system,sans-serif";ctx.textAlign="right";ctx.textBaseline="bottom";
    ctx.fillText("\u00D7"+n.workers,x+n.w-7,y+n.h-12);}
  // label below
  ctx.fillStyle="#C9BFB2";ctx.font="600 10px -apple-system,sans-serif";ctx.textAlign="center";ctx.textBaseline="top";
  let lbl=tr(t.name);
  if(isBunker(n))lbl=tr("Bunker")+" \u25BE";                      // ▾ trucks tip in
  else if(isFeeder(n))lbl=tr("Feeder")+" \u25B8";                 // ▸ feeds the line
  else if(isBulk(n))lbl=tr("Bulk")+" \u25BE";                     // ▾ reject piles into containers
  else if(isLandfill(n))lbl=tr("Landfill")+" \u25BE";             // ▾ off-map evac
  else if(isSell(n))lbl=tr(SPECS[n.spec].label)+" \u25B8";     // sells →
  else if(isDispose(n))lbl=tr("Landfill")+" \u25BE";              // ▾ disposes (legacy)
  else if(n.type==="storage")lbl=tr("Buffer");
  if(n.label)lbl=n.label;                                          // player-set name wins
  ctx.fillText(lbl,n.x,y+n.h+4);
  // failure badge
  if(n.state&&n.state!=="ok"){const txt=STATETXT[n.state];ctx.font="700 8px -apple-system,sans-serif";
    const w=ctx.measureText(txt).width+12,bx=n.x-w/2,by=y-15;
    ctx.fillStyle=n.state==="jammed"?"#5a2620":(n.state==="starved"?"#2c2824":"#4a3420");
    rr(ctx,bx,by,w,13,6);ctx.fill();ctx.strokeStyle=sc;ctx.lineWidth=1;ctx.stroke();
    ctx.fillStyle=sc;ctx.textAlign="center";ctx.textBaseline="middle";ctx.fillText(txt,n.x,by+7);}
  drawPorts(n);
}
function drawBuffer(n,x,y){const t=TYPES[n.type],buf=t.isBaler?n.bale:n.inBuf,capN=t.isBaler?BALE_N:capOf(n),total=cnt(buf);
  const px=x+7,pw=n.w-14,trough=y+n.h-7,maxH=n.h*0.46;
  ctx.fillStyle="#191715";rr(ctx,px,trough-2,pw,4,2);ctx.fill();           // trough floor
  if(t.isBaler){ctx.strokeStyle="rgba(217,142,72,.42)";ctx.lineWidth=1;ctx.setLineDash([3,3]);ctx.beginPath();ctx.moveTo(px,trough-maxH);ctx.lineTo(px+pw,trough-maxH);ctx.stroke();ctx.setLineDash([]);} // full-bale ceiling
  if(total>0){const c=comp(buf),frac=Math.min(1,total/capN);let fy=trough;  // pile rises with fill
    for(const m of MAT){if(c[m]<=0)continue;const seg=maxH*frac*c[m]/total;ctx.fillStyle=COL[m];ctx.fillRect(px,fy-seg,pw,seg);fy-=seg;}
    if(frac>=0.98||n.state==="jammed"||n.state==="overloaded"){ // piling up → overload outline
      ctx.strokeStyle=n.state==="jammed"?"#C25B4E":"#D98E48";ctx.lineWidth=1.5;
      ctx.strokeRect(px-1,trough-maxH*frac-1,pw+2,maxH*frac+2);}}}
function drawExportInfo(n){ctx.fillStyle="#7FA86B";ctx.font="700 11px -apple-system,sans-serif";ctx.textAlign="center";ctx.textBaseline="middle";
  ctx.fillText(n.balesSold+"\u25C6",n.x,n.y+16);
  if(n.truckFlash>0){ctx.save();ctx.globalAlpha=Math.min(1,n.truckFlash);ctx.fillStyle=VEH_COL;ctx.font="700 13px -apple-system,sans-serif";
    ctx.fillText("\u20AC",n.x,n.y-n.h/2-16-(1-n.truckFlash)*10);ctx.restore();n.truckFlash-=0.03;}}
function drawPorts(n){const t=TYPES[n.type];const pc=CONV_COL; // uniform: every connection is a belt
  if(!isInput(n)&&!isBunker(n)&&!isLandfill(n)&&!isExport(n)){const ip=inPortPos(n);ctx.fillStyle="#191715";ctx.strokeStyle=pc;ctx.lineWidth=1.5;
    ctx.beginPath();ctx.arc(ip.x,ip.y,5,0,7);ctx.fill();ctx.stroke();}
  if(!isOutput(n))for(const port of t.out){const op=outPortPos(n,port);if(!op)continue;
    const active=G.connecting&&G.connecting.node===n&&G.connecting.port===port;
    ctx.fillStyle=active?pc:"#191715";ctx.strokeStyle=active?"#F0D478":pc;ctx.lineWidth=1.6;
    ctx.beginPath();ctx.arc(op.x,op.y,5.5,0,7);ctx.fill();ctx.stroke();
    if(t.out.length>1&&t.ports){const isUp=Math.abs(op.x-n.x)<6,lab=t.ports[port]||port;
      ctx.fillStyle="#A89E92";ctx.font="8px -apple-system,sans-serif";
      if(isUp){ctx.textAlign="center";ctx.textBaseline="bottom";ctx.fillText(lab,op.x,op.y-7);}
      else{ctx.textAlign="left";ctx.textBaseline="middle";ctx.fillText(lab,op.x+8,op.y);}}}}
function drawConnecting(){const c=G.connecting,op=outPortPos(c.node,c.port);if(!op)return;
  const m=G.pointer?p2w(G.pointer.x,G.pointer.y):op;ctx.strokeStyle="#D98E48";ctx.lineWidth=2.5;ctx.setLineDash([6,5]);
  ctx.beginPath();ctx.moveTo(op.x,op.y);ctx.lineTo(m.x,m.y);ctx.stroke();ctx.setLineDash([]);}
function icon(c,n,cx,cy,s,col){const type=STORE_UNITS[n.type]?"storage":n.type,_role=STORE_UNITS[n.type]||n.role;c.save();c.translate(cx,cy);c.strokeStyle=col;c.fillStyle=col;c.lineWidth=2;c.lineCap="round";c.lineJoin="round";
  const u=s/2,L=(a,b,d,e)=>{c.beginPath();c.moveTo(a,b);c.lineTo(d,e);c.stroke();};
  if(type==="storage"){ // open-top bin + a role arrow: Input ↘in, Output ↗out, Buffer none
    c.beginPath();c.moveTo(-u*.6,-u*.15);c.lineTo(-u*.6,u*.55);c.lineTo(u*.6,u*.55);c.lineTo(u*.6,-u*.15);c.stroke();
    const role=_role||"buffer";
    if(role==="input"){c.beginPath();c.moveTo(0,-u*.75);c.lineTo(0,-u*.05);c.stroke();c.beginPath();c.moveTo(-u*.22,-u*.3);c.lineTo(0,-u*.05);c.lineTo(u*.22,-u*.3);c.stroke();} // arrow down INTO bin
    else if(role==="output"){c.beginPath();c.moveTo(0,u*.05);c.lineTo(0,-u*.75);c.stroke();c.beginPath();c.moveTo(-u*.22,-u*.5);c.lineTo(0,-u*.75);c.lineTo(u*.22,-u*.5);c.stroke();} // arrow up OUT of bin
  }
  else if(type==="magnet"){c.beginPath();c.arc(0,-u*.1,u*.5,Math.PI,0);c.stroke();L(-u*.5,-u*.1,-u*.5,u*.45);L(u*.5,-u*.1,u*.5,u*.45);
    c.lineWidth=3.2;L(-u*.5,u*.45,-u*.22,u*.45);L(u*.5,u*.45,u*.22,u*.45);c.lineWidth=2;c.fillRect(-u*.16,-u*.68,u*.32,u*.32);}
  else if(type==="opener"){ // a sack slit open, an item freed
    c.beginPath();c.moveTo(-u*.38,u*.55);c.quadraticCurveTo(-u*.58,-u*.05,-u*.32,-u*.33);c.lineTo(u*.32,-u*.33);c.quadraticCurveTo(u*.58,-u*.05,u*.38,u*.55);c.closePath();c.stroke();
    L(-u*.32,-u*.33,u*.32,-u*.33);
    c.lineWidth=3;L(-u*.16,0,u*.16,-u*.24);c.lineWidth=2;
    c.beginPath();c.arc(u*.04,-u*.6,u*.11,0,7);c.fill();}
  else if(type==="eddy"){ // a spinning rotor flinging a particle off
    c.beginPath();c.arc(-u*.18,u*.12,u*.42,0,7);c.stroke();
    c.beginPath();c.arc(-u*.18,u*.12,u*.2,0.5,4.7);c.stroke();
    c.beginPath();c.moveTo(u*.12,-u*.08);c.quadraticCurveTo(u*.48,-u*.42,u*.72,-u*.66);c.stroke();
    c.beginPath();c.arc(u*.72,-u*.66,u*.1,0,7);c.fill();}
  else if(type==="air"){for(let i=-1;i<=1;i++){c.beginPath();c.moveTo(-u,i*u*.38);c.bezierCurveTo(-u*.2,i*u*.38,u*.2,(i*u*.38)-u*.45,u,(i*u*.38)-u*.55);c.stroke();}
    L(u*.3,-u,u*.55,-u*.72);L(u*.55,-u*.72,u*.2,-u*.6);}
  else if(type==="nir"){c.beginPath();c.ellipse(0,0,u*.78,u*.48,0,0,7);c.stroke();c.beginPath();c.arc(0,0,u*.26,0,7);c.stroke();L(-u,-u*.78,u,-u*.78);}
  else if(type==="splitter"){L(-u,0,0,0);L(0,0,u,-u*.5);L(0,0,u,u*.5);c.beginPath();c.arc(0,0,u*.14,0,7);c.fill();}
  else if(type==="pick"){L(-u,u*.55,u,u*.55); // belt
    for(const dx of [-u*.42,u*.42]){c.beginPath();c.arc(dx,-u*.45,u*.2,0,7);c.stroke(); // head
      L(dx,-u*.25,dx,u*.2); L(dx,-u*.1,dx-u*.28,u*.22); L(dx,-u*.1,dx+u*.28,u*.22);}}
  else if(type==="baler"){c.strokeRect(-u*.65,-u*.28,u*1.3,u*.82);L(-u*.65,0,u*.65,0);L(0,-u*.28,0,u*.54);L(-u*.46,-u*.66,u*.46,-u*.66);L(-u*.28,-u*.66,-u*.28,-u*.38);L(u*.28,-u*.66,u*.28,-u*.38);}
  c.restore();}
/* ─── UI + WIRING — DOM: HUD, hit-testing, inspectors, palette, bottom sheet, the
 *  UI{} hook overrides (onEnd/viewReset), balance sheet, menus, event listeners, boot. ─── */
// ─── i18n ─── tr(): short-label dictionary (English key → translation, English fallback).
//     locF(en,fr): co-located French for prose (tutorial steps, briefings). Language toggle in the menu.
let LANG_CUR="en";
function locF(en,fr){return (LANG_CUR==="fr"&&fr)?fr:en;}
const LANG={fr:{
  "Effect per waste type":"Effet par type de d\u00e9chet",
  "A sealed bag is opaque: it passes through untouched until an opener frees the contents.":"Un sac ferm\u00e9 est opaque : il passe intact tant qu\u2019un ouvreur n\u2019a pas lib\u00e9r\u00e9 son contenu.",
  "Bar = share pulled to the sorted output. The rest passes straight through.":"Barre = part envoy\u00e9e vers la sortie tri\u00e9e. Le reste passe tout droit.",
  "Pickers pull the selected material; everything else rides on.":"Les trieurs retirent le mat\u00e9riau s\u00e9lectionn\u00e9 ; tout le reste continue.",
  "captured":"captur\u00e9","partly captured":"partiellement","mostly passes":"passe surtout","passes through":"passe tout droit",
  "Opens bags so downstream units can sort the contents. Sorts nothing itself \u2014 everything passes through.":"Ouvre les sacs pour que les unit\u00e9s en aval trient le contenu. Ne trie rien lui-m\u00eame \u2014 tout passe.",
  "Splits the flow by ratio, not by material \u2014 every waste type is divided the same way.":"Divise le flux par ratio, pas par mati\u00e8re \u2014 chaque type de d\u00e9chet est s\u00e9par\u00e9 de la m\u00eame fa\u00e7on.",
  "Merges several feeds into one. Sorts nothing \u2014 all waste types pass through together.":"Fusionne plusieurs entr\u00e9es en une. Ne trie rien \u2014 tous les types de d\u00e9chet passent ensemble.",
  "Daily operating result":"R\u00e9sultat d\u2019exploitation journalier","Run a full day to see the per-day breakdown.":"Fais tourner une journ\u00e9e compl\u00e8te pour voir le d\u00e9tail par jour.",
  "day":"jour","last {n} days":"{n} derniers jours","Each bale is one day\u2019s operating result (capex excluded).":"Chaque barre est le r\u00e9sultat d\u2019exploitation d\u2019un jour (capex exclu).","Each bar is one day\u2019s operating result (capex excluded).":"Chaque barre est le r\u00e9sultat d\u2019exploitation d\u2019un jour (capex exclu).",
  "Input full \u2014 overflow forced to landfill (paused)":"Entr\u00e9e pleine \u2014 surplus forc\u00e9 en d\u00e9charge (en pause)",

  "A shared pool — vehicles pull jobs across the yard as work appears.":"Un pool partagé — les véhicules prennent les tâches sur tout le site au fur et à mesure.",
  "All busy — try again when one is idle":"Tous occupés — réessaie quand l'un est libre",
  "Bale":"Ballot",
  "Bales":"Ballots",
  "Bulk":"Bulk",
  "Bunker":"Bunker",
  "Charged by weight. Tanks your diversion — send as little here as you can.":"Facturé au poids. Plombe ton taux de valorisation — envoie-en le moins possible ici.",
  "Container trucks drop here; a landfill truck hauls it off-map on a cadence, charged by weight. Send as little as you can.":"Les camions de conteneurs déposent ici ; un camion de décharge évacue hors site à cadence régulière, facturé au poids. Envoie-en le moins possible.",
  "Containers":"Conteneurs",
  "Disconnected":"Déconnecté",
  "Done":"Terminé",
  "Export to file (.json)":"Exporter en fichier (.json)",
  "Exported":"Exporté",
  "Feeder":"Feeder",
  "Fleet":"Flotte",
  "Held":"Stocké",
  "Holds and relays material — a surge tank between stages.":"Stocke et relaie la matière — un tampon entre les étapes.",
  "Import from file (.json)":"Importer un fichier (.json)",
  "Loaders feed the feeder · forklifts stock the export zone · container trucks clear the bulk zone. Reducing a class only removes an idle vehicle — never one mid-haul.":"Les chargeurs alimentent le feeder · les chariots stockent la zone d'export · les camions de conteneurs vident la zone bulk. Réduire une classe ne retire qu'un véhicule inactif — jamais un en cours.",
  "Loaders keep this feeder topped up from the bunker; the feed rate sets how fast material enters the line.":"Les chargeurs maintiennent ce feeder rempli depuis le bunker ; le débit fixe la vitesse d'entrée sur la ligne.",
  "No buyer — bales pile up here as temporary stock. Pick a contract to start selling.":"Aucun acheteur — les ballots s'accumulent ici en stock temporaire. Choisis un contrat pour commencer à vendre.",
  "No contract (stock)":"Aucun contrat (stock)",
  "No saved games yet — import a file below":"Aucune sauvegarde — importe un fichier ci-dessous",
  "Not a valid save file.":"Fichier de sauvegarde invalide.",
  "Now tap the destination unit":"Touche maintenant l'unité de destination",
  "Offtake":"Enlèvement",
  "On-site":"Sur site",
  "Purge a recycle loop here.":"Purge une boucle de recyclage ici.",
  "Reject piles into containers; a container truck hauls each FULL one to the landfill. All full ⇒ the belt into here backs up.":"Le rejet s'entasse dans des conteneurs ; un camion emporte chaque conteneur PLEIN à la décharge. Tous pleins ⇒ le tapis en amont bloque.",
  "Tap a port to link again — or the link button to finish":"Touche un port pour relier à nouveau — ou le bouton lien pour terminer",
  "Tap a unit's port to start a link":"Touche le port d'une unité pour démarrer une liaison",
  "Tipping":"Redevance",
  "Trucks tip the contract’s waste here — you’re paid to take it — and loaders carry it to the feeder. A full bunker turns trucks away: no charge, no landfill, lost throughput.":"Les camions déversent les déchets du contrat ici — tu es payé pour les prendre — et les chargeurs les portent au feeder. Un bunker plein refuse les camions : pas de redevance, pas de décharge, débit perdu.",
  "bulk + landfill":"bulk + décharge",
  "export zone":"zone d'export",
  "full":"plein",
  "needs its zone placed first":"nécessite que sa zone soit placée d'abord",
  "spawning…":"apparition…",
  "still bagged":"encore ensaché",
  "too much":"trop",
  "uncapped":"sans plafond",

  // ── site (Phase 1-2) ──
  "Run the plant":"Diriger l\u2019usine","The physical site \u2014 trucks, loaders, your line, top-down.":"Le site physique \u2014 camions, chargeurs, ta ligne, vue du dessus.",
  "Flowsheet (legacy)":"Flowsheet (ancien)","The old abstract view \u2014 kept until the site editor lands.":"L\u2019ancienne vue abstraite \u2014 conservée jusqu\u2019à l\u2019éditeur de site.",
  "Reference plant":"Usine de référence","The physical yard: trucks, loaders, forklifts on a real site plan \u2014 tap anything to inspect it":"La cour physique : camions, chargeurs, chariots sur un vrai plan de site \u2014 touche pour inspecter",
  "Your plant is live \u2014 pinch to zoom, tap any unit or vehicle to inspect it.":"Ton usine tourne \u2014 pince pour zoomer, touche une unité ou un véhicule pour l\u2019inspecter.",
  "Wheel loader":"Chargeur","Container truck":"Camion conteneur","Supplier truck":"Camion fournisseur","Client truck":"Camion client","Landfill truck":"Camion décharge",
  "driving to pickup":"va charger","driving to drop-off":"va livrer","loading":"chargement","unloading":"déchargement","idle":"à l\u2019arrêt",
  "driving in":"arrive","tipping":"déverse","driving out":"repart",
  "Serving":"Dessert","Delivering":"Livraison","incoming":"en approche","tipped":"déversés","Loaded":"Chargé","Hauling":"Transporte",
  "Carrying":"Charge","bales":"ballots","Trip":"Trajet","At":"À","empty":"vide","Export":"Export",
  "TIPPING":"DÉVERSE","LOADING BALES":"CHARGE BALLOTS","LOADING":"CHARGE","ARRIVING":"ARRIVE","LEAVING":"REPART",
  "Build your plant":"Construis ton usine","Empty site, your budget \u2014 place the units, wire the line, run the yard.":"Site vide, ton budget \u2014 place les unités, câble la ligne, dirige la cour.",
  "A full plant already running \u2014 study it, tweak it, break it.":"Une usine complète déjà en marche \u2014 étudie-la, modifie-la, casse-la.",
  "Build":"Construire","Tap a unit, place it on the grid, then wire it from its inspector.":"Touche une unité, place-la sur la grille, puis câble-la depuis son inspecteur.",
  "Bag opener":"Ouvre-sacs","Magnet":"Aimant","Eddy current":"Courants de Foucault","Air classifier":"Classificateur \u00E0 air","NIR sorter":"Trieur NIR","Splitter":"R\u00E9partiteur","Baler":"Presse \u00E0 ballots","Container zone":"Zone conteneurs","Export bay":"Baie d\u2019export","Landfill":"D\u00E9charge",
  "inside the warehouse":"dans le hangar","in the yard":"dans la cour",
  "Tap the grid to position, \u2713 to build":"Touche la grille pour positionner, \u2713 pour construire",
  "Connect output":"Connecter la sortie","Demolish":"D\u00E9molir","Demolished":"D\u00E9moli","Removed":"Retir\u00E9","Connected":"Connect\u00E9",
  "Tap an orange output nub":"Touche une pastille orange de sortie","Tap the destination unit":"Touche l\u2019unit\u00E9 destination",
  "Now tap a GREEN unit to wire it":"Touche maintenant une unit\u00E9 VERTE pour c\u00E2bler",
  "Career":"Carri\u00E8re","Spent":"D\u00E9pens\u00E9","Move":"D\u00E9placer","Moved":"D\u00E9plac\u00E9",
  "Drag onto the grid, \u2713 to confirm":"Fais glisser sur la grille, \u2713 pour confirmer","Clear connection":"Supprimer la connexion","Removed":"Retir\u00E9","Guided: build your first line, sell your first bale.":"Guid\u00E9 : construis ta premi\u00E8re ligne, vends ton premier ballot.",
  "Sandbox":"Bac \u00E0 sable","Empty site, your budget, no guidance.":"Site vide, ton budget, sans guide.",
  "Atelier":"Atelier","Financial challenge. No tutorial.":"D\u00E9fi financier. Sans tutoriel.",
  "TUTORIAL":"TUTORIEL","Goal":"Objectif",
  "Your bunker, export bays, bulk and landfill are already placed. Add a FEEDER inside the warehouse, below the bunker. (\uFF0B Add)":"Ton bunker, tes baies d\u2019export, le bulk et la d\u00E9charge sont d\u00E9j\u00E0 pos\u00E9s. Ajoute un FEEDER dans l\u2019entrep\u00F4t, sous le bunker. (\uFF0B Ajouter)",
  "Wire them: tap the link button \u2192 the bunker\u2019s orange output \u2192 the green feeder inlet. A loader shuttles waste across.":"Relie-les : touche le bouton lien \u2192 la sortie orange du bunker \u2192 l\u2019entr\u00E9e verte du feeder. Un chargeur fait la navette.",
  "Add a BAG OPENER under the feeder, then wire feeder \u2192 opener (a conveyor).":"Ajoute un OUVRE-SACS sous le feeder, puis relie feeder \u2192 ouvre-sacs (un convoyeur).",
  "Add a MAGNET under the opener and wire opener \u2192 magnet. It lifts the steel off the belt.":"Ajoute un AIMANT sous l\u2019ouvre-sacs et relie ouvre-sacs \u2192 aimant. Il soul\u00E8ve l\u2019acier du tapis.",
  "Add a BALER on the orange strip and wire the magnet\u2019s SORTED output (steel) into it.":"Ajoute une PRESSE sur la bande orange et relie la sortie TRI\u00C9E de l\u2019aimant (acier) dedans.",
  "Wire the BALER \u2192 the FERROUS export bay (bottom-left). A forklift carries the bales; client trucks buy them.":"Relie la PRESSE \u2192 la baie d\u2019export FERREUX (en bas \u00E0 gauche). Un chariot porte les ballots ; les camions clients les ach\u00E8tent.",
  "The magnet\u2019s OTHER output is the reject stream. Wire it to the BULK zone \u2014 an unwired output jams the unit.":"L\u2019AUTRE sortie de l\u2019aimant est le flux de rejet. Relie-la \u00E0 la zone BULK \u2014 une sortie non c\u00E2bl\u00E9e bloque l\u2019unit\u00E9.",
  "Wire the BULK zone \u2192 the LANDFILL so full reject containers get hauled off-site.":"Relie la zone BULK \u2192 la D\u00C9CHARGE pour que les conteneurs de rejet pleins soient \u00E9vacu\u00E9s.",
  "Press \u25B6 to run the line. Watch it flow \u2014 truck, loader, belt, press \u2014 until a buyer truck LOADS your first ferrous bale.":"Appuie sur \u25B6 pour lancer la ligne. Regarde le flux \u2014 camion, chargeur, tapis, presse \u2014 jusqu\u2019\u00E0 ce qu\u2019un camion acheteur CHARGE ton premier ballot ferreux.","Bay set to FERROUS \u2014 your magnet\u2019s steel":"Baie r\u00E9gl\u00E9e sur FERREUX \u2014 l\u2019acier de ton aimant",
  "Sorted outlet side":"C\u00F4t\u00E9 de sortie du tri","Split outlet side":"C\u00F4t\u00E9 de sortie du split","Left":"Gauche","Right":"Droite",
  "That side has no output":"Ce c\u00F4t\u00E9 n\u2019a pas de sortie","That unit has no matching inlet":"Cette unit\u00E9 n\u2019a pas d\u2019entr\u00E9e compatible",
  "A conveyor port only links to a conveyor inlet":"Un port tapis ne se relie qu\u2019\u00E0 une entr\u00E9e tapis","A vehicle port only links to a vehicle bay":"Un port v\u00E9hicule ne se relie qu\u2019\u00E0 une baie v\u00E9hicule",
  "That inlet is already fed":"Cette entr\u00E9e est d\u00E9j\u00E0 aliment\u00E9e","First sale! The plant is yours \u2014 grow it.":"Premi\u00E8re vente ! L\u2019usine est \u00E0 toi \u2014 fais-la grandir.",
  "Place a BUNKER on the teal tipping apron \u2014 trucks deliver there. (\uFF0B Add)":"Place un BUNKER sur la dalle turquoise \u2014 les camions livrent l\u00E0. (\uFF0B Ajouter)",
  "Place a FEEDER inside the warehouse, below your bunker.":"Place un FEEDER dans le hangar, sous ton bunker.",
  "Wire them: link button \u2192 tap the bunker\u2019s orange output \u2192 tap the green feeder. A loader appears.":"C\u00E2ble-les : bouton lien \u2192 touche la sortie orange du bunker \u2192 touche le feeder vert. Un chargeur appara\u00EEt.",
  "Place a BAG OPENER under the feeder and wire feeder \u2192 opener (a conveyor).":"Place un OUVRE-SACS sous le feeder et c\u00E2ble feeder \u2192 ouvre-sacs (un convoyeur).",
  "Place a MAGNET under the opener and wire opener \u2192 magnet. It pulls the steel out.":"Place un AIMANT sous l\u2019ouvre-sacs et c\u00E2ble ouvre-sacs \u2192 aimant. Il extrait l\u2019acier.",
  "Place a BALER beside the magnet and wire the magnet\u2019s SIDE output (sorted steel) into it.":"Place une PRESSE \u00E0 c\u00F4t\u00E9 de l\u2019aimant et c\u00E2ble la sortie LAT\u00C9RALE de l\u2019aimant (acier tri\u00E9) vers elle.",
  "Place an EXPORT BAY in the yard below and wire baler \u2192 bay. A forklift carries the bales; trucks buy them.":"Place une BAIE D\u2019EXPORT dans la cour en bas et c\u00E2ble presse \u2192 baie. Un chariot porte les ballots ; des camions les ach\u00E8tent.",
  "The magnet\u2019s BOTTOM output is the reject stream: wire it to a CONTAINER ZONE, and the zone to a LANDFILL in the yard.":"La sortie BASSE de l\u2019aimant est le refus : c\u00E2ble-la vers une ZONE CONTENEURS, puis la zone vers une D\u00C9CHARGE dans la cour.",
  "Now run the plant (\u25B6). Watch your line: first truck, loader, belt, press \u2014 until a buyer truck LOADS your bales.":"Lance l\u2019usine (\u25B6). Regarde ta ligne : premier camion, chargeur, tapis, presse \u2014 jusqu\u2019\u00E0 ce qu\u2019un camion acheteur CHARGE tes ballots.",
  "Tap an orange output \u2014 or the link button to finish":"Touche une sortie orange \u2014 ou le bouton lien pour terminer",
  "Tap an orange output nub first":"Touche d\u2019abord une pastille orange de sortie",
  "Outside the map":"Hors du terrain","Not your land":"Hors de ta propri\u00E9t\u00E9","Must be INSIDE the warehouse":"Doit \u00EAtre DANS le hangar","Must be OUTSIDE the warehouse":"Doit \u00EAtre HORS du hangar","Overlaps a unit":"Chevauche une unit\u00E9","Not enough cash":"Pas assez d\u2019argent",
  "That output is already wired":"Cette sortie est d\u00E9j\u00E0 c\u00E2bl\u00E9e","Already connected":"D\u00E9j\u00E0 connect\u00E9","No route reaches it":"Aucune route ne l\u2019atteint",
  "Bunkers are truck-fed":"Un bunker est aliment\u00E9 par camion","A bunker only feeds a feeder (loader)":"Un bunker n\u2019alimente qu\u2019un feeder (chargeur)","A feeder is only fed by a bunker (loader)":"Un feeder n\u2019est aliment\u00E9 que par un bunker (chargeur)",
  "A baler only ships to an export bay (forklift)":"Une presse n\u2019exp\u00E9die que vers une baie d\u2019export (chariot)","An export bay only receives baler forklifts":"Une baie d\u2019export ne re\u00E7oit que les chariots des presses",
  "A container zone only ships to the landfill (truck)":"Une zone conteneurs n\u2019exp\u00E9die que vers la d\u00E9charge (camion)","The landfill only receives container trucks":"La d\u00E9charge ne re\u00E7oit que les camions conteneurs",
  "Nothing leaves this unit by wire":"Rien ne sort de cette unit\u00E9 par c\u00E2blage","Same unit":"M\u00EAme unit\u00E9",
  "On-spec":"Conformes","Scrap off-spec":"Jeter les non-conformes","Clear all bales":"Tout vider",
  "Scrapped bales go straight to landfill — you pay the disposal charge.":"Les ballots jetés partent directement à la décharge — tu paies les frais d’enfouissement.",
  "bales scrapped to landfill":"ballots envoyés à la décharge",
  "Career":"Carrière","Sandbox":"Bac à sable","Add":"Ajouter","Menu":"Menu","Retry":"Réessayer",
  "Cash":"Argent","Recycling":"Recyclage","Machine slots":"Emplacements machines","Phase":"Phase","Mode":"Mode","Step":"Étape",
  "Start building":"Construire","Continue":"Continuer","Got it":"Compris","Start":"Démarrer","complete":"terminée","banked":"versé","recovered":"récupéré","Sell":"Vendre","Sells":"Vend","Ferrous":"Ferreux","Base equipment":"Équipement de base","Included from the start \u2014 every contract begins with these. Research branches the line out from here.":"Inclus dès le départ \u2014 chaque contrat commence avec ça. La recherche prolonge la ligne à partir d\u2019ici.",
  "One contract. Stay solvent, hit spec.":"Un contrat. Reste solvable, atteins la qualité.",
  "Infinite feed. No fail. Figure it out.":"Flux infini. Aucun échec. Débrouille-toi.",
  "Get paid to take garbage. Sort it clean, sell the good stuff, dodge the landfill bill.":"Payé pour récupérer les déchets. Trie-les proprement, vends le bon, évite la facture de décharge.",
  "Pick a contract":"Choisis un contrat","new here? start with the tutorial":"nouveau ? commence par le tutoriel",
  "Storage":"Stockage","Bag opener":"Ouvre-sacs","Picking station":"Cabine de tri","Mixer":"Mélangeur","Magnet":"Aimant",
  "Eddy-current separator":"Séparateur à courants de Foucault","Air classifier":"Classificateur à air",
  "NIR sorter":"Trieur NIR","Splitter":"Répartiteur","Baler":"Presse à ballots",
  "Not enough cash":"Pas assez d’argent","Resumed your saved game":"Partie sauvegardée reprise",
  "Phase complete — reward banked":"Phase terminée — prime encaissée","Flushed to landfill":"Vidé à la décharge",
  "Finished in the red":"Terminé dans le rouge","Off-spec":"Hors qualité","in progress":"en cours",
  "Intake":"Entrée","Landfill":"Décharge","Buffer":"Tampon","Ferrous":"Ferreux","added":"ajouté",
  "Per day":"Par jour","Yesterday":"Hier",
  "Separation efficiency":"Efficacité de séparation","Share of each material sent to the sorted output. The rest passes through.":"Part de chaque matériau envoyée vers la sortie triée. Le reste passe tout droit.",
  "Inbound":"Entrant","To feeder":"Vers feeder","filling":"se remplit","Line rate":"Débit ligne","Sold":"Vendu",
  "Actual in":"Entrée réelle","Sorted out":"Sortie triée","Pass-through":"Passe tout droit","Out":"Sortie",
  "Reject composition":"Composition des rejets","Landfilled composition":"Composition enfouie",
  "Outlet layout":"Disposition des sorties",
  "Busy":"Occupé","saturated \u2014 add one":"saturé \u2014 ajoutes-en un","underused \u2014 you could remove one":"sous-utilisé \u2014 tu peux en retirer un","healthy":"sain",
  "Save game":"Sauvegarder","Load game":"Charger","Store your current run in a named slot.":"Enregistre ta partie dans un emplacement nomm\u00e9.",
  "Resume a saved career or sandbox.":"Reprends une carri\u00e8re ou un bac \u00e0 sable sauvegard\u00e9.",
  "Save as new slot":"Nouvel emplacement","Or overwrite":"Ou \u00e9craser","Overwrite":"\u00c9craser","Overwrite this save?":"\u00c9craser cette sauvegarde ?",
  "Saved":"Sauvegard\u00e9","Save failed.":"\u00c9chec de la sauvegarde.","Nothing to save yet.":"Rien \u00e0 sauvegarder pour l\u2019instant.",
  "No saved games yet.":"Aucune sauvegarde pour l\u2019instant.","Career or sandbox \u2014 pick a slot":"Carri\u00e8re ou bac \u00e0 sable \u2014 choisis un emplacement",
  "Loaded":"Charg\u00e9","Could not load.":"Chargement impossible.","Incompatible save.":"Sauvegarde incompatible.","Delete this save?":"Supprimer cette sauvegarde ?",
  "Sandbox":"Bac \u00e0 sable","Career":"Carri\u00e8re",
  "Containers evacuated":"Conteneurs évacués","Awaiting haul":"En attente d\u2019enlèvement",
  "Add equipment":"Ajouter un équipement","Stream":"Flux","Balance sheet":"Bilan","Sells to":"Vend à","Supplier":"Fournisseur","Exported on-spec":"Exporté conforme","None (idle)":"Aucun (à l\u2019arrêt)",
  "drops on the canvas — drag to place, tap a port then a unit to wire":"déposé sur le plateau — glisse pour placer, touche un port puis une unité pour relier",
  "Status":"État","Throughput":"Débit","Power":"Puissance","Capex":"Investissement","Crew":"Équipe",
  "Picks out":"Trie","Role":"Rôle","Input":"Entrée","Output":"Sortie","Feed rate":"Débit d’entrée",
  "Contract":"Contrat","Sell PET":"Vendre PET","Sell ferrous":"Vendre ferreux",
  "Bales waiting":"Ballots en attente","On-spec bales":"Ballots conformes","Off-spec dumped":"Rejetés hors spec",
  "To A":"Vers A","rest to B":"reste vers B","Disconnect":"Déconnecter","Carrying":"Transporte",
  "Resume":"Reprendre","continue your current run":"continue ta partie en cours","Confirm":"Confirmer","Cancel":"Annuler","Close":"Fermer",
  "Flush everything here to landfill? You\u2019re charged by weight.":"Tout vider ici \u00e0 la d\u00e9charge ? Factur\u00e9 au poids.",
  "Start a new game? Your current run will be lost.":"Commencer une nouvelle partie ? Ta partie en cours sera perdue.","Phase restarted — give it another go":"Phase relancée — réessaie",
  "Bag":"Sac","Steel":"Acier","Film":"Film","Paper":"Papier","Alu":"Alu",
  "Input rate":"Débit d’entrée","Output rate":"Débit de sortie","contract":"contrat","Input full — overflow forced to landfill (paused)":"Entrée pleine — surplus forcé à la décharge (pause)",
  "Income":"Revenus","Tipping (gate in)":"Frais de réception","Bale sales":"Vente de ballots","Subsidies":"Subventions","Total income":"Total des revenus",
  "Costs":"Coûts","Landfill / disposal":"Décharge / rebut","Labour":"Main-d’œuvre","Logistics & upkeep":"Logistique & entretien","Total costs":"Total des coûts",
  "Operating costs":"Coûts d’exploitation","Total operating costs":"Total coûts d’exploitation","Operating result":"Résultat d’exploitation","Income − operating costs":"Revenus − coûts d’exploitation","Investment":"Investissement",
  "Result":"Résultat","Starting cash":"Trésorerie de départ","Net cash":"Trésorerie nette","Tonnage":"Tonnage","PET on-spec":"PET conforme","Landfilled":"Mis en décharge",
  "Learn the line, then run your plant.":"Apprends la ligne, puis fais tourner ton usine.","Graduation":"Tutoriel terminé","The plant is yours":"L\u2019usine est à toi",
  "Tutorial done \u2014 the line runs continuously now. Keep the cash positive; as you unlock partners in R&D you\u2019ll pick suppliers on each Intake and buyers on each Output.":"Tutoriel terminé \u2014 la ligne tourne en continu maintenant. Garde la trésorerie positive ; en débloquant des partenaires en R&D, tu choisiras les fournisseurs sur chaque Entrée et les acheteurs sur chaque Sortie.",
  "GOALS":"OBJECTIFS","Balance":"Solde","Progression":"Progression","Milestones":"Jalons","All claimed.":"Tout réclamé.","Claim":"Réclamer","ready":"prêt","Ready to claim":"Prêt à réclamer","Requires":"Requiert","equipment":"équipement",
  "Growth":"Croissance","Impact":"Impact","PVC":"PVC",
  "Sell your first on-spec bale":"Vends ton premier ballot conforme",
  "Reach €5k/day operating profit":"Atteins 5 k€/jour de bénéfice",
  "Reach €10k/day operating profit":"Atteins 10 k€/jour de bénéfice",
  "Reach €20k/day operating profit":"Atteins 20 k€/jour de bénéfice",
  "Build a 15-unit plant":"Bâtis une usine de 15 unités",
  "Recover 100 t on-spec":"Récupère 100 t conformes",
  "Hit 80% landfill diversion":"Atteins 80 % de détournement",
  "Earn a corporate sponsor (250 t on-spec)":"Décroche un sponsor (250 t conformes)",
  "Complete the tutorial":"Terminer le tutoriel","Run an eddy-current separator":"Faire tourner un séparateur à courants de Foucault","Run an air classifier":"Faire tourner un classificateur à air","Run a NIR sorter":"Faire tourner un trieur NIR","Export 100 t on-spec":"Exporter 100 t conformes","Build a 10-unit flowsheet":"Construire une ligne de 10 unités",
  "Trained sorters":"Trieurs formés","Recycling subsidy":"Subvention au recyclage","Binfinity contract":"Contrat Binfinity","Iron Maiden offtake":"Débouché Iron Maiden",
  "Non-ferrous line":"Ligne non-ferreuse","Density separation":"Séparation par densité","Optical sorting":"Tri optique","High-strength magnet":"Aimant haute puissance","VFD retrofit":"Variateur de fréquence","Wide belts":"Tapis larges","Flow splitting":"Division du flux","Manual sort cabin":"Cabine de tri manuel","Yard extension I":"Extension de cour I","Yard extension II":"Extension de cour II","Yard extension III":"Extension de cour III",
  "Trained sorters":"Trieurs formés","Recycling subsidy":"Subvention au recyclage","Binfinity contract":"Contrat Binfinity","Iron Maiden offtake":"Accord Iron Maiden","Unlock the eddy-current separator":"Débloque le séparateur à courants de Foucault","Unlock the air classifier":"Débloque le classificateur à air","Unlock the NIR sorter":"Débloque le trieur NIR","Steel capture 95% \u2192 98%":"Capture acier 95 % \u2192 98 %","\u221210% power, plant-wide":"\u221210 % d\u2019énergie, toute l\u2019usine","+15% throughput":"+15 % de débit","Unlock the splitter":"Débloque le répartiteur","Unlock the picking station":"Débloque la station de tri","+15 slots \u00b7 bigger bunkers":"+15 emplacements \u00b7 bacs agrandis","+20 slots \u00b7 bigger bunkers":"+20 emplacements \u00b7 bacs agrandis","+25 slots \u00b7 bigger bunkers":"+25 emplacements \u00b7 bacs agrandis","+5% picking efficiency":"+5 % d\u2019efficacité de tri","+10% on all sales":"+10 % sur toutes les ventes","Unlock Binfinity (supplier)":"Débloque Binfinity (fournisseur)","Unlock Iron Maiden Metals (buyer)":"Débloque Iron Maiden Metals (acheteur)","New equipment":"Nouvel équipement","Sorting efficiency":"Efficacité de tri","Cost reduction":"Réduction des coûts","Logistics":"Logistique","Real estate":"Immobilier","HR":"RH","Sales & marketing":"Ventes & marketing","Effect":"Effet","Cost":"Coût","free":"gratuit","Refund":"Rembourser","Owned":"Possédé","Locked":"Verrouillé","Not enough in the bank":"Fonds insuffisants","Research":"Rechercher","Unlock (free)":"Débloquer (gratuit)","Researched ":"Recherché ","Unlocked ":"Débloqué ","Refunded ":"Remboursé ","Product":"Produit","Price":"Prix","On-spec / bale":"Conforme / ballot","Off-spec / bale":"Hors spec / ballot","On-spec rule":"Règle de conformité","Sold on-spec":"Vendus conformes","liberated":"libéré","Gate":"Redevance","Each bale is graded on its liberated target purity. Below the threshold \u2014 or over a contaminant cap \u2014 it sells at the off-spec price (a loss). Cleaner bales pay more, up to +20% over base.":"Chaque ballot est noté sur la pureté de sa cible libérée. Sous le seuil \u2014 ou au-dessus d\u2019un plafond de contaminant \u2014 il part au prix hors spec (une perte). Les ballots plus propres paient plus, jusqu\u2019à +20 % du prix de base.",
}};
function tr(s){if(LANG_CUR==="en"||!s)return s;const d=LANG[LANG_CUR];return (d&&d[s])||s;}
function setLang(l){LANG_CUR=l;try{localStorage.setItem("recycle.lang",l);}catch(e){}document.documentElement.lang=l;applyLang();}
function applyLang(){buildLegend();const set=(id,s)=>{const el=document.getElementById(id);if(el)el.textContent=s;};
  set("mCareer",tr("Career"));set("mCareerSub",tr("Guided: build your first line, sell your first bale."));
  set("mAtelier",tr("Atelier"));set("mAtelierSub",tr("Financial challenge. No tutorial."));
  set("mSandbox",tr("Sandbox"));set("mSandboxSub",tr("Empty site, your budget, no guidance."));
  set("mDemo",tr("Reference plant"));set("mDemoSub",tr("A full plant already running \u2014 study it, tweak it, break it."));
  set("mLoad",tr("Load game"));set("mLoadSub",tr("Resume a saved career or sandbox."));
  const ab=document.getElementById("addBtn");if(ab){const _l=ab.querySelector(".lbl");if(_l)_l.textContent=tr("Add");else ab.textContent="\uFF0B "+tr("Add");}
  document.querySelectorAll("#langRow button").forEach(b=>b.classList.toggle("on",b.dataset.lang===LANG_CUR));
  const dl=document.querySelector("#divStat .lbl");if(dl)dl.textContent=tr("Recycling");
  const pl=document.querySelector("#phaseStat .lbl");if(pl)pl.textContent=tr("Phase");
  set("mResume",tr("Resume"));set("mResumeSub",tr("continue your current run"));
  const cy=document.getElementById("confirmYes");if(cy)cy.textContent=tr("Confirm");const cn=document.getElementById("confirmNo");if(cn)cn.textContent=tr("Cancel");
  const ic=document.getElementById("infoClose");if(ic)ic.textContent=tr("Close");
  if(G){updateHUD();_coachIdx=-1;if(!(G.scenario&&G.scenario.tuto)&&typeof renderCoach==="function")renderCoach();}}
// ── Meta views: Process (canvas) / R&D (tech) / Goals (objectives) ──
const ICN={flag:'<path d="M5 21V4h12l-2 4 2 4H5"/>',eddy:'<circle cx="12" cy="12" r="8"/><path d="M12 6a6 6 0 0 1 5 9"/><path d="M9 18l-1.5-3 3 .4"/>',air:'<path d="M4 9h11a3 3 0 1 0-3-3"/><path d="M4 14h13a3 3 0 1 1-3 3"/>',nir:'<ellipse cx="12" cy="12" rx="9" ry="5"/><circle cx="12" cy="12" r="2.5"/>',baler:'<rect x="5" y="6" width="14" height="12" rx="1.5"/><path d="M11 6v12"/>',units:'<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>',facility:'<path d="M4 20V11l8-5 8 5v9"/><path d="M9 20v-5h6v5"/>',magnet:'<path d="M7 4v8a5 5 0 0 0 10 0V4"/><path d="M7 4h3v8a2 2 0 0 0 4 0V4h3"/>',bolt:'<path d="M13 3 5 13h5l-1 8 8-10h-5z"/>',belt:'<path d="M3 16h18M3 9h18"/><path d="M15 5l3 3-3 3"/>',splitter:'<path d="M5 12h6l4-5M11 12l4 5"/><circle cx="17" cy="7" r="1.6"/><circle cx="17" cy="17" r="1.6"/>',pick:'<circle cx="12" cy="6" r="2.3"/><path d="M9 21v-6l-2-3 2-2h2l2 2-2 3v6"/>',slots:'<rect x="3" y="9" width="8" height="11"/><rect x="13" y="5" width="8" height="15"/>',coin:'<circle cx="12" cy="12" r="8"/><path d="M14.7 9.4a3.2 3.2 0 1 0 0 5.2M8.3 12h5"/>'};
const OBJ_ICON={a_first:"baler",a_net5:"bolt",a_size:"units",a_net10:"bolt",a_net20:"bolt",a_100t:"baler",a_div:"flag",a_rep:"flag"};
const TECH_META={
  r_eddyU:{name:"Non-ferrous line",cl:"equipment",g:"eddy",fx:"Unlock the eddy-current separator"},
  r_airU :{name:"Density separation",cl:"equipment",g:"air",fx:"Unlock the air classifier"},
  r_nirU :{name:"Optical sorting",cl:"equipment",g:"nir",fx:"Unlock the NIR sorter"},
  r_mag  :{name:"High-strength magnet",cl:"sorting",g:"magnet",fx:"Steel capture 95% \u2192 98%"},
  t_vfd  :{name:"VFD retrofit",cl:"cost",g:"bolt",fx:"\u221210% power, plant-wide"},
  t_belt :{name:"Wide belts",cl:"logistics",g:"belt",fx:"+15% throughput"},
  a_split:{name:"Flow splitting",cl:"equipment",g:"splitter",fx:"Unlock the splitter"},
  a_pickU:{name:"Manual sort cabin",cl:"equipment",g:"pick",fx:"Unlock the picking station"},
  a_yard1:{name:"Yard extension I",cl:"realestate",g:"slots",fx:"+15 slots \u00b7 bigger bunkers"},
  a_yard2:{name:"Yard extension II",cl:"realestate",g:"slots",fx:"+20 slots \u00b7 bigger bunkers"},
  a_yard3:{name:"Yard extension III",cl:"realestate",g:"slots",fx:"+25 slots \u00b7 bigger bunkers"},
  h_sorters:{name:"Trained sorters",cl:"hr",g:"pick",fx:"+5% picking efficiency"},
  s_subsidy:{name:"Recycling subsidy",cl:"subsidies",g:"coin",fx:"+10% on all sales"},
  sl_binf  :{name:"Binfinity contract",cl:"sales",g:"flag",fx:"Unlock Binfinity (supplier)"},
  sl_iron  :{name:"Iron Maiden offtake",cl:"sales",g:"flag",fx:"Unlock Iron Maiden Metals (buyer)"},
};
const CL_META={equipment:["New equipment","#D98E48"],sorting:["Sorting efficiency","#E3B04B"],cost:["Cost reduction","#C7794A"],logistics:["Logistics","#B5894E"],realestate:["Real estate","#7FA86B"],hr:["HR","#A77BA6"],subsidies:["Subsidies","#6E93B0"],sales:["Sales & marketing","#CC6B66"]};
let curView="process",_objSig="",_tutFocusNode=null;
const fmtN=n=>{const r=Math.round(n);return (r<0?"\u2212":"")+Math.abs(r).toString().replace(/\B(?=(\d{3})+(?!\d))/g,"\u202F");}; // integer, thin no-break space thousands sep
const euroB=v=>fmtN(v/1000)+"\u202Fk\u20AC"; // global budget / equipment cost in k\u20AC (e.g. 2\u202F000 k\u20AC)
const euroF=v=>{v=Math.round(v);return (v<0?"\u2212":"")+"\u20AC"+fmtN(Math.abs(v));}; // full \u20AC, small amounts (per-bale prices)
function flashBank(el){if(el){el.classList.add("flash");setTimeout(()=>el.classList.remove("flash"),500);}}
function svgI(g){return '<svg width="20" height="20" viewBox="0 0 24 24">'+(ICN[g]||"")+'</svg>';}
function buildLegend(){const el=document.getElementById("legend");if(!el)return;
  const LBL={PET:"PET",PVC:"PVC",steel:tr("Steel"),film:tr("Film"),paper:tr("Paper"),alu:tr("Alu")};
  let s='<span class="lg bag"><i style="background:'+bagCol()+'"></i>'+tr("Bag")+'</span>';
  for(const m of MAT)s+='<span class="lg"><i style="background:'+COL[m]+'"></i>'+LBL[m]+'</span>';
  el.innerHTML=s;}
function showTabbar(on){if(isSandboxSite())on=false; // sandbox has no R&D/Goals tabs → no bottom nav at all
  const t=document.getElementById("tabbar");if(t)t.classList.toggle("hide",!on);const l=document.getElementById("legend");if(l)l.classList.toggle("hide",!on);if(on)buildLegend();}
function updateBadge(){const b=document.querySelector('#tabbar button[data-v="obj"]');if(b)b.classList.toggle("hasnew",!!(G&&G.mode==="career"&&hasClaimable()));}
function refreshBanks(up){document.querySelectorAll(".vhead .bank .v").forEach(el=>{el.textContent=euroB(G?G.cash:CAREER.bank);if(up)flashBank(el);});}
function updateTutFocus(){const rd=document.querySelector('#tabbar button[data-v="tech"]');if(rd)rd.classList.toggle("hasfocus",!!(_tutFocusNode&&curView!=="tech"));}
function setView(v){if(isSandboxSite()&&(v==="tech"||v==="obj"))v="process"; // no R&D/Goals in sandbox
  curView=v;
  document.getElementById("viewTech").classList.toggle("on",v==="tech");
  document.getElementById("viewObj").classList.toggle("on",v==="obj");
  document.getElementById("dock").style.display=(v==="process")?"":"none";
  document.querySelectorAll("#tabbar button").forEach(b=>b.classList.toggle("on",b.dataset.v===v));
  if(v==="tech")renderTechView(); if(v==="obj")renderObjView(); updateBadge(); updateTutFocus(); requestAnimationFrame(syncCoachInset);}
function renderObjView(){const ids=Object.keys(OBJ),cats=[["grow","Growth"],["impact","Impact"]];
  const _vb=document.querySelector("#viewObj .vbody"),_sc=_vb?_vb.scrollTop:0;
  let html='<div class="vhead"><span class="vt">'+tr("GOALS")+'</span><div class="bank"><div class="l">'+tr("Balance")+'</div><div class="v">'+euroB(G?G.cash:CAREER.bank)+'</div></div></div><div class="vbody">';
  for(const [c,label] of cats){const list=ids.filter(id=>OBJ[id].cat===c&&!objClaimed(id));
    const ready=list.filter(objClaimable).reduce((s,id)=>s+OBJ[id].reward,0);
    html+='<div class="ohd">'+tr(label)+(ready?' <span class="rdy">'+euroB(ready)+' '+tr("ready")+'</span>':'')+'</div>';
    if(!list.length)html+='<div class="pg" style="margin:0 4px 10px">'+tr("All claimed.")+'</div>';
    for(const id of list){const o=OBJ[id],cl=objClaimable(id),lk=objLocked(id),pg=objProgress(id);
      let right,foot;
      if(cl){right='<button class="clm" data-id="'+id+'">'+tr("Claim")+' '+euroB(o.reward)+'</button>';foot=tr("Ready to claim");}
      else{right='<span class="rw">'+euroB(o.reward)+'</span>';
        if(lk){const need=(o.req||[]).filter(r=>!objClaimed(r)).map(r=>tr(OBJ[r].name));foot="\uD83D\uDD12 "+tr("Requires")+" "+need.join(", ");}
        else foot=Math.round(pg*100)+"%";}
      const bar=(!cl&&!lk&&pg>0&&pg<1)?'<div class="bar"><i style="width:'+Math.round(pg*100)+'%"></i></div>':'';
      const tag=o.equip?'<span class="tag">'+tr("equipment")+'</span>':'';
      html+='<div class="obj'+(cl?' claimable':lk?' locked':'')+'"><div class="oc">'+svgI(OBJ_ICON[id])+'</div><div class="ob"><div class="on2">'+tr(o.name)+tag+'</div>'+bar+'<div class="mt"><span class="pg">'+foot+'</span>'+right+'</div></div></div>';}}
  html+='</div>';
  const view=document.getElementById("viewObj");view.innerHTML=html;
  const _nb=view.querySelector(".vbody");if(_nb)_nb.scrollTop=_sc; _objSig=claimableObjectives().join(",")+"|"+CAREER.claimed.length;
  view.querySelectorAll(".clm").forEach(b=>b.addEventListener("click",()=>{const id=b.dataset.id,card=b.closest(".obj");
    if(!claimObjective(id))return;
    card.style.maxHeight=card.offsetHeight+"px"; refreshBanks(true); toast("+"+euroB(OBJ[id].reward)); updateBadge();
    requestAnimationFrame(()=>card.classList.add("swipe")); setTimeout(renderObjView,360);}));}
const RVIEW={x:0,y:0,s:0.82,init:false};let rDrag=null,rMoved=false;
function techNodes(){const CX=500,CY=410,RING=145; // organic 1->N tree: position follows req topology, not class
  const kids={};for(const id in TECH_META){const rq=(TECH[id]&&TECH[id].req)||[];const par=rq.length?rq[0]:"__root";(kids[par]=kids[par]||[]).push(id);}
  const nodes=[{id:"__root",name:"Base equipment",cl:"root",g:"units",x:CX,y:CY,root:true}];
  (function place(id,depth,a0,a1){const ch=kids[id]||[];const seg=(a1-a0)/Math.max(1,ch.length);
    ch.forEach((cid,i)=>{const ca0=a0+i*seg,ca1=ca0+seg,a=(ca0+ca1)/2,r=depth*RING;
      nodes.push(Object.assign({id:cid,x:CX+r*Math.cos(a),y:CY+r*Math.sin(a),root:false},TECH_META[cid]));
      place(cid,depth+1,ca0,ca1);});})("__root",1,-Math.PI/2,-Math.PI/2+2*Math.PI);
  return nodes;}
function rzoom(f,apply,stage){const r=stage.getBoundingClientRect(),mx=r.width/2,my=r.height/2,ns=Math.max(.45,Math.min(1.5,RVIEW.s*f));RVIEW.x=mx-(mx-RVIEW.x)*(ns/RVIEW.s);RVIEW.y=my-(my-RVIEW.y)*(ns/RVIEW.s);RVIEW.s=ns;apply();}
function showBaseKitSheet(){
  const items=BASE_UNITS.map(u=>'<div class="bkrow"><canvas width="44" height="44" data-bic="'+u+'"></canvas><div class="pt">'+tr(TYPES[u].name)+'</div></div>').join("");
  showSheet('<h3>'+tr("Base equipment")+'</h3><div class="real">'+tr("Included from the start \u2014 every contract begins with these. Research branches the line out from here.")+'</div><div class="bkgrid">'+items+'</div>');
  sheet.querySelectorAll("canvas[data-bic]").forEach(c=>{const g=c.getContext("2d");g.translate(22,22);icon(g,{type:c.dataset.bic},0,0,24,"#D98E48");});
  sheet.querySelectorAll("[data-scrap]").forEach(el=>el.addEventListener("click",()=>{
    const k=exportScrap(n,el.dataset.scrap==="off");
    toast(k+" "+tr("bales scrapped to landfill"),"warn");saveGame();inspectNode(n);}));
  sheet.querySelectorAll("[data-bconn]").forEach(el=>el.addEventListener("click",()=>{
    closeSheet();BUILD.mode="connect";BUILD.from=n;BUILD.fromSide=null;
    const free=["t","b","l","r"].filter(s=>{const p=sitePort(n,s);
      return TYPES[n.type].out.indexOf(p)>=0&&!G.edges.some(e=>e.from===n.id&&e.fromPort===p);});
    const ports=[...new Set(free.map(s=>sitePort(n,s)))];
    if(ports.length===1&&free.length){BUILD.fromSide=free[0]; // one free output → pre-armed, one tap to wire
      showHint(tr("Now tap a GREEN unit to wire it"));}
    else showHint(tr("Tap an orange output \u2014 or the link button to finish"));
    updateBuildBar();}));
}
function renderTechView(){const view=document.getElementById("viewTech");
  let nodes=techNodes();const byId={};nodes.forEach(n=>byId[n.id]=n); // full tree always visible; the focus node is highlighted + panned to, the rest show locked
  const col=cl=>cl==="root"?"#EDE6DD":(CL_META[cl]?CL_META[cl][1]:"#888");
  let links="";
  for(const n of nodes){if(n.root)continue;const reqs=(TECH[n.id].req&&TECH[n.id].req.length)?TECH[n.id].req:["__root"];
    for(const rid of reqs){const a=byId[rid]||byId.__root,lit=(rid==="__root")||careerTechOwned(rid),c=lit?col(n.cl):"#3a342f";
      const mx=(a.x+n.x)/2,my=(a.y+n.y)/2,dx=n.x-a.x,dy=n.y-a.y,len=Math.hypot(dx,dy)||1,bow=Math.min(40,len*.16);
      links+='<path d="M'+a.x+' '+a.y+' Q '+(mx-dy/len*bow)+' '+(my+dx/len*bow)+' '+n.x+' '+n.y+'" stroke="'+c+'" stroke-width="'+(lit?2.2:1.3)+'" fill="none" opacity="'+(lit?.8:.45)+'" '+(lit?"":'stroke-dasharray="4 5"')+'/>';}}
  let ndh="";
  for(const n of nodes){const c=col(n.cl);
    if(n.root){ndh+='<div class="rnode root" data-root="1" style="--c:'+c+';left:'+n.x+'px;top:'+n.y+'px"><svg width="24" height="24" viewBox="0 0 24 24">'+(ICN.units||"")+'</svg><span class="chk">\u2713</span><span class="rlbl">'+tr("Base equipment")+'</span></div>';continue;}
    const own=careerTechOwned(n.id),reqMet=techReqMet(n.id),can=techResearchable(n.id),free=TECH[n.id].cost===0,cls=own?"owned":can?"avail":(reqMet?"poor":"locked"),tgt=(_tutFocusNode===n.id&&!own)?" target":"";
    ndh+='<div class="rnode '+cls+tgt+'" data-id="'+n.id+'" style="--c:'+c+';left:'+n.x+'px;top:'+n.y+'px"><span class="ring"></span><svg width="22" height="22" viewBox="0 0 24 24">'+(ICN[n.g]||"")+'</svg><span class="rlbl">'+tr(n.name)+'</span>'+(own?'<span class="chk">\u2713</span>':"")+'</div>';}
  view.innerHTML='<div class="vhead"><span class="vt">R&amp;D</span><div class="bank"><div class="l">'+tr("Balance")+'</div><div class="v">'+euroB(G?G.cash:CAREER.bank)+'</div></div></div>'+
    '<div class="rstage" id="rstage"><div class="rworld" id="rworld"><svg class="rlinks" width="1000" height="860">'+links+'</svg>'+ndh+'</div>'+
    '<div class="rzoom"><button data-z="in">+</button><button data-z="out">\u2212</button></div></div>';
  const stage=document.getElementById("rstage"),world=document.getElementById("rworld");
  const apply=()=>{world.style.transform="translate("+RVIEW.x+"px,"+RVIEW.y+"px) scale("+RVIEW.s+")";};
  if(!RVIEW.init){RVIEW.init=true;requestAnimationFrame(()=>{const r=stage.getBoundingClientRect();if(r.width){RVIEW.x=r.width/2-500*RVIEW.s;RVIEW.y=r.height/2-410*RVIEW.s;}apply();});}else apply();
  if(_tutFocusNode&&byId[_tutFocusNode]&&!careerTechOwned(_tutFocusNode)){const tn=byId[_tutFocusNode];requestAnimationFrame(()=>{const r=stage.getBoundingClientRect();if(r.width){RVIEW.x=r.width/2-tn.x*RVIEW.s;RVIEW.y=r.height*0.52-tn.y*RVIEW.s;apply();}});}
  stage.addEventListener("pointerdown",e=>{rDrag={x:e.clientX,y:e.clientY,vx:RVIEW.x,vy:RVIEW.y};rMoved=false;});
  stage.addEventListener("pointermove",e=>{if(!rDrag)return;const dx=e.clientX-rDrag.x,dy=e.clientY-rDrag.y;if(Math.abs(dx)+Math.abs(dy)>4)rMoved=true;RVIEW.x=rDrag.vx+dx;RVIEW.y=rDrag.vy+dy;apply();});
  const up=()=>{rDrag=null;};stage.addEventListener("pointerup",up);stage.addEventListener("pointerleave",up);stage.addEventListener("pointercancel",up);
  stage.addEventListener("wheel",e=>{e.preventDefault();rzoom(e.deltaY<0?1.1:1/1.1,apply,stage);},{passive:false});
  view.querySelectorAll(".rzoom button").forEach(b=>b.addEventListener("click",()=>rzoom(b.dataset.z==="in"?1.2:1/1.2,apply,stage)));
  view.querySelectorAll(".rnode[data-id]").forEach(el=>el.addEventListener("click",()=>{if(rMoved)return;openTechNode(el.dataset.id,el,apply,stage);}));
  {const re=view.querySelector(".rnode[data-root]");if(re)re.addEventListener("click",()=>{if(rMoved)return;showBaseKitSheet();});}}
function openTechNode(id,el,apply,stage){const m=TECH_META[id],T=TECH[id];
  const nx=parseFloat(el.style.left),ny=parseFloat(el.style.top),r=stage.getBoundingClientRect();
  RVIEW.x=r.width/2-nx*RVIEW.s;RVIEW.y=r.height*0.27-ny*RVIEW.s;apply(); // pan the tapped node into the clear upper area so the sheet never hides it
  const own=careerTechOwned(id),can=techResearchable(id),free=T.cost===0,reqMet=techReqMet(id);
  const reqs=(T.req||[]).map(rid=>({n:TECH_META[rid].name,ok:careerTechOwned(rid)}));
  let btn;
  if(own)btn=techRefundable(id)?'<button class="bigbtn ghost" id="techAct" data-act="refund">'+tr("Refund")+(free?"":" \u00b7 "+euroB(T.cost))+'</button>':'<button class="bigbtn ghost" id="techAct" disabled>'+tr("Owned")+'</button>';
  else if(!reqMet)btn='<button class="bigbtn ghost" id="techAct" disabled>'+tr("Locked")+'</button>';
  else if(!can)btn='<button class="bigbtn ghost" id="techAct" disabled>'+tr("Not enough in the bank")+'</button>';
  else btn='<button class="bigbtn primary" id="techAct" data-act="buy">'+(free?tr("Unlock (free)"):tr("Research")+" \u00b7 "+euroB(T.cost))+'</button>';
  const c=CL_META[m.cl]?CL_META[m.cl][1]:"#D98E48";
  showSheet('<h3 style="color:'+c+'">'+tr(m.name)+'</h3><div class="real">'+tr(CL_META[m.cl]?CL_META[m.cl][0]:"")+'</div>'+
    '<div class="trow"><span>'+tr("Effect")+'</span><b style="color:'+c+'">'+tr(m.fx)+'</b></div>'+
    '<div class="trow"><span>'+tr("Cost")+'</span><b>'+(free?tr("free"):euroB(T.cost))+'</b></div>'+
    (reqs.length?'<div class="treq">'+tr("Requires")+" "+reqs.map(x=>(x.ok?"\u2713 ":"\u2715 ")+tr(x.n)).join(" \u00b7 ")+'</div>':"")+
    '<div style="margin-top:14px">'+btn+'</div>');
  const act=document.getElementById("techAct");
  if(act&&act.dataset.act==="buy")act.addEventListener("click",()=>{if(researchTech(id)){refreshBanks(true);toast((free?tr("Unlocked "):tr("Researched "))+tr(m.name));closeSheet();renderTechView();}});
  if(act&&act.dataset.act==="refund")act.addEventListener("click",()=>{if(refundTech(id)){refreshBanks(true);toast(tr("Refunded ")+tr(m.name));closeSheet();renderTechView();}});}
document.querySelectorAll("#tabbar button").forEach(b=>b.addEventListener("click",()=>setView(b.dataset.v)));
function _pad2(n){return (n<10?"0":"")+n;}
function fmtCal(t){const c=calendar(t);return (c.y>1?"Y"+c.y+" \u00b7 ":"")+c.d+" "+tr(c.month)+" \u00b7 "+_pad2(c.hh)+":"+_pad2(c.mm);}
function recurringNet(){const l=G.ledger||{};return (l.tipping||0)+(l.sales||0)+(l.subsidies||0)-(l.labour||0)-(l.logistics||0)-(l.power||0)-(l.landfill||0);}
const SIM_DAY=24; // sim-time units per in-game day = 24 (1 unit = 1 HOUR; calendar reads t as hours)
function perDayRate(){ // what the plant EARNED YESTERDAY: recurring net over the last completed day (excludes capex)
  if(!G)return {v:0,pending:true};
  const now=G.t,net=recurringNet(),day=Math.floor(now/SIM_DAY);
  if(G._pnlDay==null){G._pnlDay=day;G._pnlDayStart=net;G._pnlYesterday=null;}
  if(day>G._pnlDay){const elapsed=day-G._pnlDay;G._pnlYesterday=(net-G._pnlDayStart)/elapsed;G._pnlDay=day;G._pnlDayStart=net;}
  return {v:(G._pnlYesterday==null?0:G._pnlYesterday),pending:G._pnlYesterday==null};}
function updateHUD(){const cs=document.getElementById("cashStat");const cw=document.getElementById("clockVal");if(cw)cw.textContent=fmtCal(G.t);
  if(G.mode==="sandbox"){cs.querySelector(".val").textContent=tr("Sandbox");cs.querySelector(".lbl").textContent=tr("Mode");
    document.getElementById("divStat").style.display="none";}
  else{document.getElementById("divStat").style.display="";
    const unlimited=G.scenario&&G.scenario.unlimitedBudget;
    cs.querySelector(".lbl").textContent=tr(unlimited?"Spent":"Cash");
    cs.querySelector(".val").textContent=euroB(unlimited?(G.startCash-G.cash):G.cash);
    cs.querySelector(".val").classList.toggle("low",!unlimited&&G.cash<300); // no red alert when budget is unlimited
    const div=recyclingPct();document.querySelector("#divStat .val").textContent=Math.round(div)+"%";}
  {const ps=document.getElementById("pnlStat");if(ps){const pd=perDayRate(),v=ps.querySelector(".val");ps.querySelector(".lbl").textContent=tr("Yesterday");
    if(pd.pending){v.textContent="\u2014";v.classList.remove("pos","neg");} // no full day banked yet
    else{const up=pd.v>=0;v.textContent=(up?"\u25B2 ":"\u25BC ")+euroB(Math.abs(Math.round(pd.v)));
      v.classList.toggle("pos",up);v.classList.toggle("neg",!up);}
    ps.style.display="";}}
  const pb=document.getElementById("play");
  if(pb._run!==G.running){pb._run=G.running; // rebuild the icon only on state change (not every frame)
    pb.innerHTML=G.running
      ? '<svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" style="pointer-events:none"><rect x="6" y="5" width="4.2" height="14" rx="1.6"/><rect x="13.8" y="5" width="4.2" height="14" rx="1.6"/></svg>'
      : '<svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" style="pointer-events:none"><path d="M8 5.5v13a1 1 0 0 0 1.54.84l10-6.5a1 1 0 0 0 0-1.68l-10-6.5A1 1 0 0 0 8 5.5z"/></svg>';}
  pb.classList.toggle("on",G.running);
  {const pp=phaseProgress(),pbE=document.getElementById("phaseBar");
   if(pp){pbE.classList.add("on");
     document.getElementById("pbName").textContent=tr("Exported on-spec");
     document.getElementById("pbNum").textContent=pp.done.toFixed(1)+" / "+pp.total+" t";
     const f=document.getElementById("pbFill");f.style.width=(pp.frac*100).toFixed(1)+"%";
     f.style.background="var(--good)";
   }else pbE.classList.remove("on");}
  const menuHidden=document.getElementById("menu").classList.contains("hide");
  document.getElementById("tabbar").classList.toggle("hide",!menuHidden);
  if(!menuHidden&&curView!=="process")setView("process"); updateBadge();
  if(curView==="obj"){const sig=claimableObjectives().join(",")+"|"+CAREER.claimed.length; if(sig!==_objSig&&!document.querySelector("#viewObj .obj.swipe"))renderObjView();}}
const pointers=new Map();let mode_=null,grab=null,downPos=null,moved=false,pinchD=0,lastPt=null;
function hitTest(wx,wy){const PR=Math.max(15,22/cam.zoom),ER=Math.max(11,15/cam.zoom);
  // Ports FIRST (explicit wiring nubs), finger-sized in screen px so they stay tappable at any zoom. (Flowsheet only — site wiring has its own nubs.)
  if(!siteMode()){
    for(const n of G.nodes){if(isOutput(n))continue;for(const port of TYPES[n.type].out){const op=outPortPos(n,port);if(op&&Math.hypot(wx-op.x,wy-op.y)<PR)return{kind:"out",n,port};}}
    for(const n of G.nodes){if(!isInput(n)&&!isBunker(n)&&!isLandfill(n)&&!isExport(n)){const ip=inPortPos(n);if(Math.hypot(wx-ip.x,wy-ip.y)<PR)return{kind:"in",n};}}}
  // Body = the drawn card rect (interior taps inspect / drag-move).
  for(const n of G.nodes){if(Math.abs(wx-n.x)<n.w/2&&Math.abs(wy-n.y)<n.h/2)return{kind:"node",n};}
  let bestE=null,bestD=ER; // at conveyor crossings the NEAREST edge wins the tap (playability, 2026-07-11)
  for(const e of G.edges){
    if(e.route&&e.route.length>1){ // site connection: distance to the route polyline
      for(let i=1;i<e.route.length;i++){const a=e.route[i-1],b=e.route[i];
        const dx=b[0]-a[0],dy=b[1]-a[1],L2=dx*dx+dy*dy;
        const u=L2>0?Math.max(0,Math.min(1,((wx-a[0])*dx+(wy-a[1])*dy)/L2)):0;
        const d=Math.hypot(wx-(a[0]+dx*u),wy-(a[1]+dy*u));
        if(d<bestD){bestD=d;bestE=e;}}
      continue;}
    const pp=edgePath(e);if(!pp)continue;for(let t=0.15;t<=0.85;t+=0.175){const p=bez(pp,t);
      const d=Math.hypot(wx-p.x,wy-p.y);if(d<bestD){bestD=d;bestE=e;}}}
  return bestE?{kind:"edge",e:bestE}:null;}
cv.addEventListener("wheel",ev=>{ev.preventDefault(); // desktop zoom, anchored under the cursor
  const r=cv.getBoundingClientRect(),sx=ev.clientX-r.left,sy=ev.clientY-r.top;
  const wx=(sx-cam.x)/cam.zoom,wy=(sy-cam.y)/cam.zoom;
  const z2=Math.min(4.8,cam.zoom*Math.exp(-ev.deltaY*0.0016));
  cam.zoom=z2;cam.x=sx-wx*z2;cam.y=sy-wy*z2;clampCam();},{passive:false});
cv.addEventListener("pointerdown",ev=>{cv.setPointerCapture(ev.pointerId);if(cv.clientWidth!==VW||cv.clientHeight!==VH)resize();else syncRect();pointers.set(ev.pointerId,{x:ev.clientX,y:ev.clientY});
  if(pointers.size===2){const ps=[...pointers.values()];pinchD=Math.hypot(ps[0].x-ps[1].x,ps[0].y-ps[1].y);mode_="pinch";grab=null;return;}
  const w=p2w(ev.clientX,ev.clientY);downPos={x:ev.clientX,y:ev.clientY};moved=false;lastPt={x:ev.clientX,y:ev.clientY};G.pointer={x:ev.clientX,y:ev.clientY};
  const h=hitTest(w.x,w.y);
  if(G.connecting){if(h&&(h.kind==="node"||h.kind==="in")&&h.n!==G.connecting.node&&!isInput(h.n)&&!isBunker(h.n)&&!isLandfill(h.n)&&!isExport(h.n))finishConnect(h.n);else G.connecting=null;
    document.getElementById("chint").style.display="none";mode_=null;return;}
  if(h&&h.kind==="out"&&!siteMode()){G.connecting={node:h.n,port:h.port};showHint("Tap a unit to connect into");mode_="connect";return;}
  if(h&&(h.kind==="node"||h.kind==="in")){grab=siteMode()?null:h.n;mode_="maybe";return;}
  mode_="pan";grab=null;});
cv.addEventListener("pointermove",ev=>{if(!pointers.has(ev.pointerId))return;pointers.set(ev.pointerId,{x:ev.clientX,y:ev.clientY});G.pointer={x:ev.clientX,y:ev.clientY};
  if(mode_==="pinch"&&pointers.size>=2){const ps=[...pointers.values()];const d=Math.hypot(ps[0].x-ps[1].x,ps[0].y-ps[1].y);
    const mx=(ps[0].x+ps[1].x)/2,my=(ps[0].y+ps[1].y)/2,before=p2w(mx,my);cam.zoom=Math.min(4.8,cam.zoom*d/(pinchD||d));pinchD=d;
    const after=p2w(mx,my);cam.x+=(after.x-before.x)*cam.zoom;cam.y+=(after.y-before.y)*cam.zoom;clampCam();return;}
  const dx=ev.clientX-(lastPt?lastPt.x:ev.clientX),dy=ev.clientY-(lastPt?lastPt.y:ev.clientY);lastPt={x:ev.clientX,y:ev.clientY};
  if(downPos&&Math.hypot(ev.clientX-downPos.x,ev.clientY-downPos.y)>10)moved=true;
  if(mode_==="maybe"&&moved)mode_=(siteMode()?"pan":"drag");
  if(mode_==="drag"&&grab){grab.x+=dx/cam.zoom;grab.y+=dy/cam.zoom;}
  else if(mode_==="pan"){cam.x+=dx;cam.y+=dy;clampCam();}});
cv.addEventListener("pointerup",ev=>{pointers.delete(ev.pointerId);const w=p2w(ev.clientX,ev.clientY);if(DBG_HIT)_dbgTap=w;
  if(!moved&&(mode_==="maybe"||mode_==="pan")){
    if(siteMode()&&BUILD.mode==="place"&&BUILD.sel){ // tap = position the ghost
      const fp=siteFootprint(BUILD.sel[0],BUILD.rot);
      BUILD.gx=Math.round(w.x/CELL-fp.w/2);BUILD.gy=Math.round(w.y/CELL-fp.h/2);}
    else if(siteMode()&&BUILD.mode==="move"&&BUILD.moveNode){ // tap = reposition the unit being moved
      const fp=siteFootprint(BUILD.moveNode.site,BUILD.rot);
      BUILD.gx=Math.round(w.x/CELL-fp.w/2);BUILD.gy=Math.round(w.y/CELL-fp.h/2);}
    else if(siteMode()&&BUILD.mode==="connect"){
      // EDITOR MODEL (reproduced from the reference connection editor, 2026-07-11):
      // tap the nearest anchor to arm; tap the nearest anchor again to commit. One anchor set,
      // no output/input distinction at selection time — siteConnect validates direction.
      const cx=w.x/CELL,cy=w.y/CELL,PR=Math.max(0.75,26/cam.zoom/CELL); // radius in CELL units
      const an=siteNearestAnchor(cx,cy,PR);
      if(!BUILD.from){ // arm from the tapped anchor
        if(an){BUILD.from=an.n;BUILD.fromSide=an.a.side;showHint(tr("Now tap the destination unit"));}
        else showHint(tr("Tap a unit's port to start a link"));
        return;}
      // a source is armed → this tap is the destination anchor
      if(an&&an.n.id!==BUILD.from.id){
        const r=siteConnect(BUILD.from,BUILD.fromSide,an.n,an.a.side);
        if(r.ok){BUILD.undo.push({t:"connect",edge:r.edge,cost:r.cost});
          toast(tr("Connected")+(r.cost?" −"+Math.round(r.cost/1000)+" k€":""));saveGame();
          BUILD.from=null;BUILD.fromSide=null;updateBuildBar();
          showHint(tr("Tap a port to link again — or the link button to finish"));}
        else{ // illegal side → retry auto-picking the destination's canonical inlet
          const ts=autoToSide(BUILD.from,BUILD.fromSide,an.n),r2=siteConnect(BUILD.from,BUILD.fromSide,an.n,ts);
          if(r2.ok){BUILD.undo.push({t:"connect",edge:r2.edge,cost:r2.cost});
            toast(tr("Connected")+(r2.cost?" −"+Math.round(r2.cost/1000)+" k€":""));saveGame();
            BUILD.from=null;BUILD.fromSide=null;updateBuildBar();
            showHint(tr("Tap a port to link again — or the link button to finish"));}
          else toast(tr(SITE_REASON[r2.reason]||r2.reason),"warn");}
        return;}
      // tapped the same unit or empty → re-arm or cancel
      if(an){BUILD.from=an.n;BUILD.fromSide=an.a.side;return;}
      BUILD.from=null;BUILD.fromSide=null;showHint(tr("Tap a unit's port to start a link"));}
    else{
      const vh=siteMode()?hitVehicle(w.x,w.y):null;
      const th=(!vh&&siteMode())?hitTruck(w.x,w.y):null;
      if(vh)inspectVehicle(vh);
      else if(th)inspectTruck(th);
      else{const h=hitTest(w.x,w.y);
        if(h&&(h.kind==="node"||h.kind==="in"))inspectNode(h.n);else if(h&&h.kind==="edge")inspectEdge(h.e);}}}
  if(mode_!=="connect"){mode_=null;grab=null;}
  if(pointers.size===0&&!G.connecting)G.pointer=null;lastPt=null;});
function showHint(t){const h=document.getElementById("chint");h.textContent=t;h.style.display="block";}
function finishConnect(target){const c=G.connecting;G.edges=G.edges.filter(e=>!(e.from===c.node.id&&e.fromPort===c.port));
  if(target.id!==c.node.id)G.edges.push({from:c.node.id,fromPort:c.port,to:target.id,sprites:[],speed:EDGE_SPEED});G.connecting=null;toast("Connected");saveGame();}
const scrim=document.getElementById("scrim"),sheet=document.getElementById("sheet");
let _sheetAt=0;
function closeSheet(){sheet.classList.remove("show");scrim.classList.remove("show");sheet.classList.remove("overMenu");scrim.classList.remove("overMenu");_inspectNode=null;}
let _sdrag=null;
sheet.addEventListener("pointerdown",function(e){if(e.target.closest("button,input,.o,.palcard,.seg"))return;if(sheet.scrollTop>0)return;_sdrag={y:e.clientY,id:e.pointerId};});
sheet.addEventListener("pointermove",function(e){if(!_sdrag||e.pointerId!==_sdrag.id)return;const dy=e.clientY-_sdrag.y;if(dy>0){sheet.style.transition="none";sheet.style.transform="translateY("+dy+"px)";}});
sheet.addEventListener("pointerup",function(e){if(!_sdrag)return;const dy=e.clientY-_sdrag.y;_sdrag=null;sheet.style.transition="";sheet.style.transform="";if(dy>90)closeSheet();});
sheet.addEventListener("pointercancel",function(){if(_sdrag){_sdrag=null;sheet.style.transition="";sheet.style.transform="";}});
// Close on pointerdown (NOT click): touch synthesizes a delayed ghost click on the scrim that
// covers the just-tapped unit, which would otherwise slam the inspector shut. Guard the open too.
scrim.addEventListener("pointerdown",()=>{if(performance.now()-_sheetAt<350)return;closeSheet();});
function showSheet(html){_sheetAt=performance.now();sheet.innerHTML='<div class="grab"></div><button class="sx" aria-label="Close">\u2715</button>'+html;
  const _menuOpen=!document.getElementById("menu").classList.contains("hide"); // sheets from the main menu must stack ABOVE it
  sheet.classList.toggle("overMenu",_menuOpen);scrim.classList.toggle("overMenu",_menuOpen);
  sheet.classList.add("show");scrim.classList.add("show");const _x=sheet.querySelector(".sx");if(_x)_x.addEventListener("pointerdown",function(e){e.stopPropagation();closeSheet();});}
function baleReason(bale,specKey){ // why is this bale off-spec? returns a short human string or "" if on-spec
  const spec=SPECS[specKey];if(!spec)return"";
  const c=comp(bale);let t=0;for(const m of MAT)t+=c[m];if(t<=0)return tr("empty");
  const frac={};for(const m of MAT)frac[m]=c[m]/t;
  const tf=((bale[spec.target]&&bale[spec.target][1])||0)/t; // liberated target only
  const over=Object.keys(spec.caps).filter(m=>(frac[m]||0)>spec.caps[m]);
  if(over.length)return tr("too much")+" "+over.map(m=>tr(m)+" "+Math.round(frac[m]*100)+"%").join(", ");
  if(tf<spec.minPurity){ // purity shortfall — say the target % vs the requirement
    const bagged=((bale[spec.target]&&bale[spec.target][0])||0)/t;
    let s=tr(spec.label)+" "+Math.round(tf*100)+"% < "+Math.round(spec.minPurity*100)+"%";
    if(bagged>0.02)s+=" ("+Math.round(bagged*100)+"% "+tr("still bagged")+")";
    return s;}
  return"";}
function baleList(n){ // per-bale cards: colour border on/off-spec, composition mini-bar, reason
  if(!n.bales||!n.bales.length)return"";
  const rows=n.bales.map((bale,i)=>{
    const c=comp(bale),t=cnt(bale);if(t<=0)return"";
    const ungraded=(n.spec==="dispose"||n.buyer==="__hold");
    const g=ungraded?{ok:true}:grade(bale,n.spec);
    const reason=ungraded?"":baleReason(bale,n.spec);
    const bars=MAT.filter(m=>c[m]>0).map(m=>'<i style="width:'+(c[m]/t*100)+'%;background:'+COL[m]+'"></i>').join("");
    const top=MAT.filter(m=>c[m]>0).sort((a,b)=>c[b]-c[a]).slice(0,3)
      .map(m=>'<span style="white-space:nowrap"><span class="d" style="display:inline-block;width:7px;height:7px;border-radius:50%;background:'+COL[m]+';margin-right:3px"></span>'+tr(m)+' '+Math.round(c[m]/t*100)+'%</span>').join(' ');
    const bord=g.ok?"#3E8E4E":"#C25B4E",tag=g.ok?"\u2713":"\u2717";
    return '<div style="border:2px solid '+bord+';border-radius:9px;padding:6px 8px;margin:5px 0;background:rgba(23,21,19,.5)">'+
      '<div style="display:flex;justify-content:space-between;align-items:center;font-size:11px;font-weight:700;color:'+bord+'">'+
        '<span>'+tag+' '+tr("Bale")+' '+(i+1)+'</span><span style="color:var(--muted);font-weight:600">'+(t*PMASS).toFixed(2)+' t</span></div>'+
      '<div class="compbar" style="height:7px;margin:5px 0">'+bars+'</div>'+
      '<div style="font-size:10px;color:var(--muted);display:flex;gap:8px;flex-wrap:wrap">'+top+'</div>'+
      (reason?'<div style="font-size:10px;color:#E8A9A0;margin-top:3px">'+reason+'</div>':'')+
      '</div>';}).join("");
  return '<div id="baleScroll" data-n="'+n.bales.length+'" style="max-height:230px;overflow-y:auto;margin-top:6px">'+rows+'</div>';}
function compBar(buf){const c=comp(buf),t=cnt(buf);if(t<=0)return'<div class="compbar"></div><div class="desc">empty</div>';
  const bars=MAT.map(m=>c[m]>0?'<i style="width:'+(c[m]/t*100)+'%;background:'+COL[m]+'"></i>':"").join("");
  const leg=MAT.filter(m=>c[m]>0).map(m=>'<span><span class="d" style="background:'+COL[m]+'"></span>'+m+' '+(c[m]/t*100).toFixed(0)+'%</span>').join("");
  const d=stateDist(buf),sl=STATES.map((s,i)=>s+' '+(d[i]/t*100).toFixed(0)+'%').join(" \u00B7 ");
  return'<div class="compbar">'+bars+'</div><div class="complegend">'+leg+'</div><div class="desc" style="margin-top:5px">size: '+sl+'</div>';}
function vehUtil(cls){ // 0..1 utilization over a rolling window
  if(!G||!G._util||!G._util[cls])return 0;const u=G._util[cls],now=G.t;
  const rk="_utilRing";G[rk]=G[rk]||{};const ring=G[rk][cls]||(G[rk][cls]=[]);
  const last=ring[ring.length-1];
  if(!last||now-last.t>=0.25){ring.push({t:now,b:u.busy,o:u.tot});if(ring.length>60)ring.shift();}
  let a=ring[0];for(const s of ring){if(now-s.t<=12){a=s;break;}} // ~12h window
  const db=u.busy-a.b,dtot=u.tot-a.o;if(dtot<=1e-6)return 0;
  return Math.max(0,Math.min(1,db/dtot));}
function openFleet(){
  if(!G||!G.fleet){showSheet('<h3>'+tr("Fleet")+'</h3>');return;}
  const CLS=[["loader","Loaders","#E0B341"],["forklift","Forklifts","#E08A41"],["ctruck","Container trucks","#6E9BC4"]];
  const lbl={idle:"idle",toSource:"to pickup",loading:"loading",toDest:"to drop-off",unloading:"unloading"};
  let b='<h3>'+tr("Fleet")+'</h3><div class="real">'+tr("A shared pool \u2014 vehicles pull jobs across the yard as work appears.")+'</div>';
  for(const [cls,label,col] of CLS){
    const vs=(G.vehicles||[]).filter(v=>v.cls===cls),count=G.fleet[cls]||0;
    b+='<div class="row"><span class="k"><span style="display:inline-block;width:11px;height:8px;border-radius:2px;background:'+col+';margin-right:8px;vertical-align:middle"></span>'+tr(label)+'</span>'+
       '<span class="v"><button class="ibtn" data-fdec="'+cls+'" aria-label="one fewer">\u2212</button>&nbsp;<b>'+count+'</b>&nbsp;<button class="ibtn" data-finc="'+cls+'" aria-label="one more">\uFF0B</button></span></div>';
    let chips;
    if(vs.length)chips=vs.map(v=>{const load=(cnt(v.payload)>0)||(v.baleLoad&&v.baleLoad.length),on=v.state!=="idle";
      return '<span style="font-size:11px;padding:2px 8px;border-radius:10px;background:'+(on?"rgba(224,179,65,.16)":"rgba(255,255,255,.05)")+';color:'+(on?"#E4C77A":"#8f887f")+'">'+(lbl[v.state]||v.state)+(load?" \u25CF":"")+'</span>';}).join("");
    else chips='<span style="font-size:11px;color:#8f887f">'+(homeNode(cls)?tr("spawning\u2026"):tr("needs its zone placed first"))+'</span>';
    b+='<div style="display:flex;flex-wrap:wrap;gap:5px;margin:1px 0 9px 3px">'+chips+'</div>';
    if(vs.length){const u=vehUtil(cls),pct=Math.round(u*100);
      const hint=u>0.9?tr("saturated \u2014 add one"):(u<0.35&&count>1?tr("underused \u2014 you could remove one"):tr("healthy"));
      const hc=u>0.9?"var(--bad)":(u<0.35&&count>1?"var(--muted)":"var(--good)");
      b+='<div class="effrow" style="margin:-4px 0 10px 3px"><span class="efm">'+tr("Busy")+'</span>'+
        '<span class="efbar"><span class="eff" style="width:'+pct+'%;background:'+col+'"></span></span>'+
        '<span class="efp">'+pct+'%</span></div>'+
        '<div class="desc" style="margin:-6px 0 10px 3px;color:'+hc+'">'+hint+'</div>';}
  }
  b+='<div class="real">'+tr("Loaders feed the feeder \u00B7 forklifts stock the export zone \u00B7 container trucks clear the bulk zone. Reducing a class only removes an idle vehicle \u2014 never one mid-haul.")+'</div>';
  showSheet(b);
  sheet.querySelectorAll("[data-finc]").forEach(el=>el.addEventListener("click",()=>{const c=el.dataset.finc;G.fleet[c]=(G.fleet[c]||0)+1;if(typeof ensureFleet==="function")ensureFleet();saveGame();openFleet();}));
  sheet.querySelectorAll("[data-fdec]").forEach(el=>el.addEventListener("click",()=>{const c=el.dataset.fdec;if((G.fleet[c]||0)<=0)return;
    const idx=(G.vehicles||[]).findIndex(v=>v.cls===c&&v.state==="idle");
    if(idx<0&&(G.vehicles||[]).some(v=>v.cls===c)){toast(tr("All busy \u2014 try again when one is idle"));return;} // never delete a loaded vehicle (NNG-1)
    G.fleet[c]--; if(idx>=0)G.vehicles.splice(idx,1); saveGame();openFleet();}));
}
function openPalette(){const order=paletteUnits();
  const cards=order.map(type=>{const d=TYPES[type],afford=G.mode==="sandbox"||G.cash>=CAPEX[type],nm=(type==="output")?"Sell point":d.name;
    return'<div class="palcard '+(afford?'':'cant')+'" data-type="'+type+'"><canvas width="68" height="68" data-ic="'+type+'"></canvas>'+
      '<div><div class="pt">'+tr(nm)+'</div><div class="pc">'+(CAPEX[type]?euroB(CAPEX[type]):tr('free'))+'</div>'+
      '<div class="pd">'+(d.cap?d.cap+' t/h \u00B7 '+(d.kW||0)+'kW':(type==="output"?tr("export zone"):""))+'</div></div></div>';}).join("");
  // Sell point and Landfill are both "output"-family but split into structurally different node sets
  // (export zone vs bulk+landfill), so the dispose target gets its own synthetic card.
  const _lfAfford=G.mode==="sandbox"||G.cash>=(CAPEX.output||0);
  const landfillCard=order.includes("output")?'<div class="palcard '+(_lfAfford?'':'cant')+'" data-type="__dispose"><canvas width="68" height="68" data-ic="output"></canvas><div><div class="pt">'+tr("Landfill")+'</div><div class="pc">'+(CAPEX.output?euroB(CAPEX.output):tr("free"))+'</div><div class="pd">'+tr("bulk + landfill")+'</div></div></div>':'';
  const _used=G.nodes.filter(n=>n.type!=="storage").length,_tot=techSlots(BASE_SLOTS),_sl=(G.mode!=="sandbox")?'<div class="slotbar"><span>'+tr("Machine slots")+'</span><b'+(_used>=_tot?' class="full"':'')+'>'+_used+' / '+_tot+'</b></div>':'';
  showSheet('<h3>'+tr("Add equipment")+'</h3><div class="real">'+tr("drops on the canvas \u2014 drag to place, tap a port then a unit to wire")+'</div>'+_sl+'<div class="palgrid">'+cards+landfillCard+'</div>');
  sheet.querySelectorAll("canvas[data-ic]").forEach(c=>{const g=c.getContext("2d");g.translate(34,34);icon(g,{type:c.dataset.ic},0,0,30,"#D98E48");});
  if(_tutoUnit&&tutoActive()){const tc=sheet.querySelector('.palcard[data-type="'+_tutoUnit+'"]');if(tc){tc.classList.add("tutohi");tc.scrollIntoView&&tc.scrollIntoView({block:"nearest"});}}
  sheet.querySelectorAll(".palcard").forEach(c=>c.addEventListener("click",()=>{const type=c.dataset.type;
    const k=G.nodes.length,w=s2w(VW/2,VH/2-30),_px=w.x+(k%4)*36-54,_py=w.y+Math.floor(k/4)*26-20;
    if(type==="__dispose"){ // bulk + landfill pair — same capex as any output
      if(G.mode==="career"&&G.cash<(CAPEX.output||0)){toast("Not enough cash");return;}
      if(G.mode==="career"&&CAPEX.output){G.cash-=CAPEX.output;G.ledger.capex+=CAPEX.output;}
      addNode("output",_px,_py,"dispose");closeSheet();toast(tr("Landfill")+" "+tr("added")+(G.mode==="career"&&CAPEX.output?" \u00B7 \u2212"+euroB(CAPEX.output):""));saveGame();return;}
    const _mach=G.nodes.filter(n=>n.type!=="storage").length;
    if(G.mode!=="sandbox"&&!STORE_UNITS[type]&&_mach>=techSlots(BASE_SLOTS)){toast("No free slots \u2014 extend the yard (R&D)");return;}
    if(G.mode==="career"&&G.cash<CAPEX[type]){toast("Not enough cash");return;}
    if(G.mode==="career"){G.cash-=CAPEX[type];G.ledger.capex+=CAPEX[type];}
    addNode(type,_px,_py);
    closeSheet();toast(tr(TYPES[type].name)+" "+tr("added")+(CAPEX[type]?" \u00B7 \u2212"+euroB(CAPEX[type]):""));saveGame();}));}
function _esc(s){return String(s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));}
function inspectNode(n){selNode=n;_inspectNode=n;const t=TYPES[n.type];
  const row=(k,v)=>'<div class="row"><span class="k">'+k+'</span><span class="v">'+v+'</span></div>';
  const svg=s=>'<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'+s+'</svg>';
  const capT=(t.isBaler?BALE_N:capOf(n))*PMASS, fillT=cnt(t.isBaler?n.bale:n.inBuf)*PMASS;
  // header: name + small icon actions (info toggle, flush, cut-film, remove)
  let acts='<button class="ibtn" id="iInfo" aria-label="info">'+svg('<circle cx="12" cy="12" r="9"/><path d="M12 11v5"/><path d="M12 7.6v.3"/>')+'</button>';
  if(n.type==="storage")acts+='<button class="ibtn" id="flush" aria-label="flush to landfill">'+svg('<path d="M12 4v9"/><path d="M8 10l4 4 4-4"/><path d="M5 19h14"/>')+'</button>';

  const _nm=(n.type==="storage")?({input:"Intake",output:"Output",buffer:"Buffer",bunker:"Bunker",feeder:"Feeder",bulk:"Bulk zone",landfill:"Landfill",export:"Export zone"}[n.role]||"Storage"):t.name;
  const _title=n.label?_esc(n.label):tr(_nm);
  const renameBtn=(n.gx!=null)?'<button class="ibtn" id="iRen" aria-label="rename">'+svg('<path d="M4 20h4l10-10a2 2 0 0 0-2.83-2.83L5.2 17.2 4 20z"/><path d="M13.5 6.5l4 4"/>')+'</button>':'';
  let b='<div class="ihead"><h3 id="iTitle">'+_title+'</h3><div class="iacts">'+renameBtn+acts+'</div></div>';
  // params · limits · costs (the focus)
  if(n.state&&n.state!=="ok")b+=row(tr("Status"),'<span style="color:'+(STATECOL[n.state]||"var(--muted)")+'">'+STATETXT[n.state]+'</span>');
  if(t.cap&&!isInput(n)&&n.type!=="storage")b+=row(tr("Throughput"),t.cap+' t/h'); // storage units don't process at a fixed rate
  if((n._inMass||0)>0&&!isInput(n)&&n.type!=="storage"){ // LIVE throughput measured on this unit
    const ri=nodeRate(n,"_inMass"),rs=nodeRate(n,"_sortMass"),rr=nodeRate(n,"_restMass");
    b+=row(tr("Actual in"),ri.toFixed(1)+' t/h');
    if(t.accept){ // a sorter has two meaningful outputs
      b+=row(tr("Sorted out"),'<span style="color:var(--good)">'+rs.toFixed(1)+' t/h</span>')+
         row(tr("Pass-through"),rr.toFixed(1)+' t/h');
    } else b+=row(tr("Out"),(rs+rr).toFixed(1)+' t/h');}
  if(t.kW)b+=row(tr("Power"),t.kW+' kW \u00B7 \u20AC'+(t.kW*ECON.elec).toFixed(0)+'/h');
  { // EFFECT PER WASTE TYPE — plain, no theory: for each material, how much this unit pulls out vs lets pass.
    let rows2=null,note="";
    if(t.prob&&t.accept){ // separators: capture % per material to the SORTED output
      rows2=[];for(const m of MAT){const bp=t.prob[m]!==undefined?t.prob[m]:t.prob.default;rows2.push([m,techProb(n.type,m,bp)]);}
      note=tr("Bar = share pulled to the sorted output. The rest passes straight through.");
      if(t.needsItem)note+=" "+tr("A sealed bag is opaque: it passes through untouched until an opener frees the contents.");
    } else if(t.isPick){ // manual pick: captures its TARGET at PICK_EFF, everything else is a rare false-grab
      rows2=[];for(const m of MAT)rows2.push([m,(m===n.target)?techPickEff(PICK_EFF):PICK_FALSE]);
      note=tr("Pickers pull the selected material; everything else rides on.");
    }
    if(rows2){
      b+='<div class="slbl" style="margin-top:8px">'+tr("Effect per waste type")+'</div>';
      rows2.sort((a,b2)=>b2[1]-a[1]);
      for(const [m,p] of rows2){const pct=Math.round(p*100);
        // plain-language verdict so the unit reads without theory
        const verdict=pct>=80?tr("captured"):(pct>=25?tr("partly captured"):(pct>=3?tr("mostly passes"):tr("passes through")));
        const vcol=pct>=80?"var(--good)":(pct>=25?"var(--accent)":"var(--muted)");
        b+='<div class="effrow"><span class="dot" style="background:'+COL[m]+'"></span><span class="efm">'+tr(m)+'</span>'+
          '<span class="efbar"><span class="eff" style="width:'+Math.max(2,pct)+'%;background:'+COL[m]+'"></span></span>'+
          '<span class="efp" style="color:'+vcol+'">'+verdict+'</span></div>';}
      b+='<div class="desc">'+note+'</div>';
    } else if(t.opener){ b+='<div class="slbl" style="margin-top:8px">'+tr("Effect per waste type")+'</div><div class="desc">'+tr("Opens bags so downstream units can sort the contents. Sorts nothing itself \u2014 everything passes through.")+'</div>';
    } else if(t.isSplit){ b+='<div class="slbl" style="margin-top:8px">'+tr("Effect per waste type")+'</div><div class="desc">'+tr("Splits the flow by ratio, not by material \u2014 every waste type is divided the same way.")+'</div>';
    } else if(t.isMixer){ b+='<div class="slbl" style="margin-top:8px">'+tr("Effect per waste type")+'</div><div class="desc">'+tr("Merges several feeds into one. Sorts nothing \u2014 all waste types pass through together.")+'</div>';}
  }
  if(CAPEX[n.type])b+=row(tr("Capex"),euroB(CAPEX[n.type]));
  if(!isOutput(n)&&!isBunker(n)&&!isFeeder(n)&&!isBulk(n)&&!isLandfill(n)&&!isExport(n))b+=row(tr("Buffer"),fillT.toFixed(2)+' / '+capT.toFixed(1)+' t')+compBar(t.isBaler?n.bale:n.inBuf);
  let dsc=t.real?'<p>'+t.real+'</p>':'';
  if(t.isPick){const cap=(n.workers*PICK_RATE).toFixed(1),wage=(n.workers*WAGE);
    b+=row(tr("Crew"),'<b id="wv">'+n.workers+'</b> \u00B7 '+cap+' t/h \u00B7 \u20AC'+wage+'/h')+
       '<input type="range" min="1" max="6" value="'+n.workers+'" id="crew">'+
       '<div class="slbl">'+tr("Picks out")+'</div><div class="seg">'+
       MAT.map(m=>'<div class="o '+(n.target===m?"on":"")+'" data-tgt="'+m+'"><span class="dot" style="background:'+COL[m]+'"></span>'+m+'</div>').join("")+'</div>';}
  if(n.type==="storage"){
    if(n.role==="input"||n.role==="feeder"){ // line source (feeder) — feed rate; loaders keep it topped up
      if(n.gx!=null){ // site actions: wire the output / demolish (Phase 3)
        const canOut=!isExport(n)&&!isLandfill(n)&&["t","b","l","r"].some(s=>{const p=sitePort(n,s);
          return TYPES[n.type].out.indexOf(p)>=0&&!G.edges.some(e=>e.from===n.id&&e.fromPort===p);});
        if(canOut){b+='<div style="display:flex;gap:8px;margin-top:10px">';
          b+='<button class="bigbtn primary" data-bconn="1" style="flex:1">'+tr("Connect output")+'</button></div>';}}
      if(isFeeder(n))b+=row(tr("Feeder"),(cnt(n.inBuf)*PMASS).toFixed(2)+' / '+(capOf(n)*PMASS).toFixed(0)+' t')+compBar(n.inBuf);
      b+=(G.mode!=="sandbox"?row(tr("Input rate"),'<b>'+(G.contract&&G.contract.feedTph||5)+'</b> t/h \u00B7 '+tr("contract")):'')+
        row(tr("Feed rate"),'<b id="rrv">'+n.rate+'</b> t/h')+
        '<input type="range" min="1" max="15" value="'+n.rate+'" id="frate">';
      if(n.role==="input"&&G.continuous){const _us=COMPANIES.suppliers.filter(sz=>supplierUnlocked(sz.id)),_cur=(n.supplier==="__none")?"__none":(n.supplier||(G.contract&&G.contract.supplier));b+='<div class="slbl">'+tr("Supplier")+'</div><div class="seg wrap">'+_us.map(sz=>'<div class="o '+(_cur===sz.id?"on":"")+'" data-supplier="'+sz.id+'">'+coName(sz)+(sz.stream?' \u00b7 \u20AC'+sz.stream.gate+'/t':'')+'</div>').join("")+'<div class="o '+(_cur==="__none"?"on":"")+'" data-supplier="__none">'+tr("None (idle)")+'</div></div>';}
      {const ri=nodeRate(n,"_inMass");b+=row(tr("Inbound"),ri.toFixed(1)+' t/h')+row(tr("Line rate"),(n.rate||0).toFixed(1)+' t/h');}
      dsc+='<p>'+tr("Loaders keep this feeder topped up from the bunker; the feed rate sets how fast material enters the line.")+'</p>';}
    if(n.role==="bunker"){ // tipping floor — truck-fed, loader-drained
      b+=row(tr("Bunker"),(cnt(n.inBuf)*PMASS).toFixed(1)+' / '+(capOf(n)*PMASS).toFixed(0)+' t')+
        row(tr("Tipping"),'<span style="color:var(--good)">+\u20AC'+ECON.tipping+' / t</span>');
      {const ri=nodeRate(n,"_inMass"),ro=nodeRate(n,"_outMass");
       b+=row(tr("Inbound"),'<span style="color:var(--accent2)">'+ri.toFixed(1)+' t/h</span>')+
          row(tr("To feeder"),ro.toFixed(1)+' t/h'+(ri>ro+0.3&&cnt(n.inBuf)>capOf(n)*0.6?' <span style="color:var(--bad)">\u25B2 '+tr("filling")+'</span>':''));}
      if(G.continuous){const _us=COMPANIES.suppliers.filter(sz=>supplierUnlocked(sz.id)),_cur=(n.supplier==="__none")?"__none":(n.supplier||(G.contract&&G.contract.supplier));b+='<div class="slbl">'+tr("Supplier")+'</div><div class="seg wrap">'+_us.map(sz=>'<div class="o '+(_cur===sz.id?"on":"")+'" data-supplier="'+sz.id+'">'+coName(sz)+(sz.stream?' \u00b7 \u20AC'+sz.stream.gate+'/t':'')+'</div>').join("")+'<div class="o '+(_cur==="__none"?"on":"")+'" data-supplier="__none">'+tr("None (idle)")+'</div></div>';}
      dsc+='<p>'+tr("Trucks tip the contract\u2019s waste here \u2014 you\u2019re paid to take it \u2014 and loaders carry it to the feeder. A full bunker turns trucks away: no charge, no landfill, lost throughput.")+'</p>';}
    if(n.role==="buffer")dsc+='<p>'+tr("Holds and relays material \u2014 a surge tank between stages.")+'</p>';
    if(n.role==="bulk"){ // 3 containers, container-truck evac
      b+='<div class="slbl">'+tr("Containers")+'</div><div style="display:flex;gap:6px;height:34px;align-items:flex-end;margin:2px 0 6px">';
      for(const c of n.containers){const f=Math.min(1,cnt(c)/G.logi.containerCap),full=cnt(c)>=G.logi.containerCap;
        b+='<div style="flex:1;height:100%;background:rgba(255,255,255,.06);border-radius:3px;position:relative;overflow:hidden"><div style="position:absolute;bottom:0;left:0;right:0;height:'+Math.round(f*100)+'%;background:'+(full?"#C25B4E":"#7FA86B")+'"></div></div>';}
      b+='</div>'+row(tr("Held"),(n.containers.reduce((a,c)=>a+cnt(c),0)*PMASS).toFixed(1)+' t \u00B7 '+bulkFullCount(n)+'/'+G.logi.containersPerZone+' '+tr("full"));
      {const agg=blankBuf();for(const c of n.containers)for(const m of MAT)for(let z=0;z<ST;z++)agg[m][z]+=c[m][z];
       if(cnt(agg)>0){b+='<div class="slbl" style="margin-top:6px">'+tr("Reject composition")+'</div>'+compBar(agg);}}
      dsc+='<p>'+tr("Reject piles into containers; a container truck hauls each FULL one to the landfill. All full \u21D2 the belt into here backs up.")+'</p>';}
    if(n.role==="landfill"){
      b+=row(tr("On-site"),(cnt(n.inBuf)*PMASS).toFixed(1)+' / '+(capOf(n)*PMASS).toFixed(0)+' t')+
        row(tr("Gate"),'<span style="color:var(--bad)">\u2212\u20AC'+ECON.landfillGate+' / t</span>');
      if(cnt(n.inBuf)>0){b+='<div class="slbl" style="margin-top:6px">'+tr("Landfilled composition")+'</div>'+compBar(n.inBuf);}
      dsc+='<p>'+tr("Container trucks drop here; a landfill truck hauls it off-map on a cadence, charged by weight. Send as little as you can.")+'</p>';}
    if(isExport(n)&&n.bales&&n.bales.length&&n.gx!=null){const ungraded=isHeld(n)||n.spec==="dispose";let on=0;for(const bl of n.bales)if(ungraded||grade(bl,n.spec).ok)on++;
      const offN=n.bales.length-on;
      b+='<div class="row"><span class="k">'+tr("Bales")+'</span><span class="v">'+n.bales.length+(ungraded?"":' \u00b7 \u2713 '+on+(offN?'  \u2717 '+offN:''))+'</span></div>';
      {const ro=nodeRate(n,"_outMass");b+=row(tr("Sold"),'<span style="color:var(--good)">'+ro.toFixed(1)+' t/h</span>');}
      b+=baleList(n);
      b+='<div style="display:flex;gap:8px;margin-top:8px">';
      if(offN&&n.spec!=="dispose"&&!isHeld(n))b+='<button class="bigbtn ghost" data-scrap="off" style="flex:1">'+tr("Scrap off-spec")+' ('+offN+')</button>';
      b+='<button class="bigbtn ghost" data-scrap="all" style="flex:1">'+tr("Clear all bales")+' ('+n.bales.length+')</button></div>';
      b+='<div class="desc">'+tr("Scrapped bales go straight to landfill — you pay the disposal charge.")+'</div>';}
    if(isLandfill(n)){b+=row(tr("Awaiting haul"),(cnt(n.inBuf)*PMASS).toFixed(1)+' / '+(capOf(n)*PMASS).toFixed(0)+' t');
      b+=row(tr("Containers evacuated"),(n.contEvac||0)+' \u00B7 '+(n.massEvac||0).toFixed(1)+' t');}
    if(n.role==="output"||n.role==="export"){const _ub=COMPANIES.buyers.filter(bz=>buyerUnlocked(bz.id)),_eff=n.spec==="dispose"?null:(n.buyer||(defaultBuyer(n.spec)&&defaultBuyer(n.spec).id));
      if(isExport(n))b+=row(tr("Bales"),n.bales.length+' / '+G.logi.exportCap+(n.state==="exportfull"?' \u00b7 <span style="color:var(--bad)">'+tr("full")+'</span>':''));
      b+='<div class="slbl">'+tr("Sells to")+'</div><div class="seg wrap">'+
      (isExport(n)?'<div class="o '+(isHeld(n)?"on":"")+'" data-buyer="__hold"><span class="dot" style="background:#8a8078"></span>'+tr("No contract (stock)")+'</div>':'')+
      _ub.map(bz=>{const sp=SPECS[bz.spec];return '<div class="o '+(!isHeld(n)&&_eff===bz.id?"on":"")+'" data-buyer="'+bz.id+'"><span class="dot" style="background:'+(COL[sp.target]||"#999")+'"></span>'+coName(bz)+'</div>';}).join("")+
      (isExport(n)?'':'<div class="o '+(n.spec==="dispose"?"on":"")+'" data-buyer="__landfill"><span class="dot" style="background:#6b645c"></span>'+tr("Landfill")+'</div>')+'</div>';
      if(isHeld(n)){b+='<div class="desc" style="margin-top:6px">'+tr("No buyer — bales pile up here as temporary stock. Pick a contract to start selling.")+'</div>';}
      else if(n.spec!=="dispose"){const off=buyerOfftake(n),sp=SPECS[n.spec],bm=BALE_N*PMASS,pr=sp.basePrice*techPrice(),pmin=Math.round(pr*0.8*bm),pmax=Math.round(pr*1.2*bm),poff=Math.round(sp.offSpec*bm),caps=Object.keys(sp.caps).map(m=>tr(m)+" \u2264"+Math.round(sp.caps[m]*100)+"%").join(", ");
        b+=row(tr("Product"),'<span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:'+(COL[sp.target]||"#999")+';margin-right:6px"></span>'+tr(sp.label)+' \u00b7 \u2265'+Math.round(sp.minPurity*100)+'%')+
          row(tr("Price"),euroF(pr)+" / t")+
          row(tr("Offtake"),off===Infinity?tr("uncapped"):('<b>'+off+'</b>'))+
          row(tr("On-spec / bale"),'<b style="color:var(--good)">'+euroF(pmin)+'\u2013'+euroF(pmax)+'</b> \u00b7 '+bm.toFixed(1)+' t')+
          row(tr("Off-spec / bale"),'<span style="color:var(--bad)">'+euroF(poff)+'</span>')+
          row(tr("On-spec rule"),'\u2265'+Math.round(sp.minPurity*100)+'% '+tr(sp.label)+(caps?' \u00b7 '+caps:''))+
          row(tr("Sold on-spec"),'<span style="color:var(--good)">'+n.balesSold+'</span>')+
          row(tr("Off-spec dumped"),'<span style="color:var(--bad)">'+n.offSold+'</span>');
        dsc+='<p>'+tr(isExport(n)?"Forklifts move bales here; a client truck sells them (graded per bale) at the buyer\u2019s pace. Oversupply a slow buyer and the zone fills, stalling the baler.":"Each bale is graded on its liberated target purity.")+'</p>';}
      else{b+=row(tr("Gate"),'<span style="color:var(--bad)">\u2212\u20AC'+ECON.landfillGate+' / t</span>');dsc+='<p>'+tr("Charged by weight. Tanks your diversion \u2014 send as little here as you can.")+'</p>';}}
  }
  if(t.isSplit){b+=row(tr("To A"),'<b id="rv">'+Math.round(n.ratio*100)+'%</b> ('+tr("rest to B")+')')+'<input type="range" min="0" max="100" value="'+Math.round(n.ratio*100)+'" id="ratio">';dsc+='<p>'+tr("Purge a recycle loop here.")+'</p>';}
  // splitter: choose the PORT LAYOUT (down+side, or the two sides)
  if(t.isSplit){const lay=(n.splitLayout==="sides")?"sides":"down";
    b+='<div class="slbl">'+tr("Outlet layout")+'</div><div class="seg">'+
      '<div class="o '+(lay==="down"?"on":"")+'" data-splitlay="down">A \u2193 \u00B7 B \u25C0\u25B6</div>'+
      '<div class="o '+(lay==="sides"?"on":"")+'" data-splitlay="sides">A \u25C0 \u00B7 B \u25B6</div></div>';}
  // separators & splitters(down layout): choose which SIDE the ejected/split stream leaves (the rest always goes down)
  if((t.out.length>1&&!t.pass&&!t.isSplit)||(t.isSplit&&n.splitLayout!=="sides")){const side=sortSideOf(n);
    b+='<div class="slbl">'+tr(t.isSplit?"Split outlet side":"Sorted outlet side")+'</div><div class="seg">'+
      '<div class="o '+(side==="l"?"on":"")+'" data-sortside="l">\u25C0 '+tr("Left")+'</div>'+
      '<div class="o '+(side==="r"?"on":"")+'" data-sortside="r">'+tr("Right")+' \u25B6</div></div>';}
  dsc+='<p>'+t.desc+'</p>';
  if(n.gx!=null){ // common site actions: MOVE + DEMOLISH (all unit families)
    const refund=Math.round(((n.paidCapex||0)*SITE_REFUND)/1000);
    b+='<div style="display:flex;gap:8px;margin-top:12px">'+
      '<button class="bigbtn primary" data-bmove="1" style="flex:1">'+tr("Move")+'</button>'+
      '<button class="bigbtn ghost" data-bdemo2="1" style="flex:1">'+tr("Demolish")+' (+'+refund+' k€)</button></div>';}
  showSheet(b);
  const ii=document.getElementById("iInfo");if(ii)ii.addEventListener("click",()=>showInfo(tr(t.name),dsc));
  const ren=document.getElementById("iRen");if(ren)ren.addEventListener("click",()=>{
    const ttl=document.getElementById("iTitle");if(!ttl)return;
    const cur=n.label||"";
    ttl.outerHTML='<input id="iNameIn" type="text" maxlength="24" placeholder="'+tr(_nm)+'" value="'+_esc(cur)+'" '+
      'style="flex:1;min-width:0;font:700 15px -apple-system,sans-serif;color:var(--text);background:#231f1b;border:1px solid var(--accent2);border-radius:8px;padding:4px 8px;">';
    const inp=document.getElementById("iNameIn");if(inp){inp.focus();inp.select();
      const commit=()=>{const v=inp.value.trim();n.label=v||null;saveGame();inspectNode(n);};
      inp.addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();commit();}else if(e.key==="Escape"){inspectNode(n);}});
      inp.addEventListener("blur",commit);}
  });
  sheet.querySelectorAll("[data-bmove]").forEach(el=>el.addEventListener("click",()=>{
    closeSheet();startMoveUnit(n);}));
  sheet.querySelectorAll("[data-bdemo2]").forEach(el=>el.addEventListener("click",()=>{
    const r=siteDemolish(n);closeSheet();if(r.ok){toast(tr("Removed")+" +"+Math.round(((n.paidCapex||0)*SITE_REFUND)/1000)+" k€");saveGame();}}));
  sheet.querySelectorAll(".o[data-buyer]").forEach(o=>o.addEventListener("click",()=>{const v=o.dataset.buyer;
    if(v==="__landfill"){n.spec="dispose";n.buyer=null;}
    else if(v==="__hold"){n.buyer="__hold";} // keep n.spec so bales still show what they'd grade as
    else{const bz=coById(v);if(bz){n.spec=bz.spec;n.buyer=v;}}
    saveGame();inspectNode(n);}));
  sheet.querySelectorAll(".o[data-supplier]").forEach(o=>o.addEventListener("click",()=>{n.supplier=o.dataset.supplier;primeFirstTruck(n);saveGame();inspectNode(n);}));
  sheet.querySelectorAll(".o[data-tgt]").forEach(o=>o.addEventListener("click",()=>{n.target=o.dataset.tgt;inspectNode(n);}));
  const cw=document.getElementById("crew");if(cw)cw.addEventListener("input",()=>{n.workers=+cw.value;document.getElementById("wv").textContent=cw.value;});
  const rg=document.getElementById("ratio");if(rg)rg.addEventListener("input",()=>{n.ratio=rg.value/100;document.getElementById("rv").textContent=rg.value+"%";});
  sheet.querySelectorAll(".o[data-sortside]").forEach(o=>o.addEventListener("click",()=>{
    const s=o.dataset.sortside;if(sortSideOf(n)===s)return;n.sortSide=s;
    siteRerouteFor(n); // the ejected port moved sides — reroute every edge from CURRENT geometry (no break)
    saveGame();inspectNode(n);}));
  sheet.querySelectorAll(".o[data-splitlay]").forEach(o=>o.addEventListener("click",()=>{
    const lay=o.dataset.splitlay;if((n.splitLayout==="sides"?"sides":"down")===lay)return;
    n.splitLayout=(lay==="sides")?"sides":"down"; // ports A/B move → reroute every edge from the new geometry
    siteRerouteFor(n);saveGame();inspectNode(n);}));
  const fr=document.getElementById("frate");if(fr)fr.addEventListener("input",()=>{n.rate=+fr.value;document.getElementById("rrv").textContent=fr.value;saveGame();});
  const fl=document.getElementById("flush");if(fl)fl.addEventListener("click",()=>askConfirm(tr("Flush everything here to landfill? You\u2019re charged by weight."),()=>{flushToLandfill(n);closeSheet();toast("Flushed to landfill");saveGame();}));
}

function inspectEdge(e){const from=nodeById(e.from),to=nodeById(e.to),buf=blankBuf();let bales=0;
  for(const s of e.sprites){if(s.bale){bales++;for(const m of MAT)for(let z=0;z<ST;z++)buf[m][z]+=s.bale[m][z];}else buf[s.mat][s.st]++;}
  const _nmOf=(u)=>u.label?_esc(u.label):tr(TYPES[u.type].name);
  showSheet('<h3>'+tr("Stream")+'</h3><div class="real">'+_nmOf(from)+' \u2192 '+_nmOf(to)+'</div>'+
    '<div class="desc">In flight now \u2014 sampled:</div>'+compBar(buf)+
    '<div class="row"><span class="k">Carrying</span><span class="v">'+e.sprites.length+(bales?' bales':' particles')+(e.sprites.length>=(e.max||EDGE_MAX)?' \u00B7 BACKED UP':'')+'</span></div>'+
    '<div class="iacts" style="margin-top:12px;justify-content:flex-end"><button class="bigbtn ghost" id="delE" aria-label="disconnect" style="flex:1"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px;margin-right:6px"><path d="M9 15l-3 3a3 3 0 01-4-4l3-3"/><path d="M15 9l3-3a3 3 0 014 4l-3 3"/><path d="M8.5 8.5l7 7"/></svg>'+tr("Clear connection")+'</button></div>');
  document.getElementById("delE").addEventListener("click",()=>{siteDisconnect(e);closeSheet();toast(tr("Disconnected"));saveGame();});}
function toast(msg,kind){const t=document.createElement("div");t.className="toast "+(kind||"");t.textContent=tr(msg);
  document.getElementById("toasts").appendChild(t);setTimeout(()=>{t.style.transition="opacity .3s";t.style.opacity="0";setTimeout(()=>t.remove(),300);},2400);}
document.getElementById("play").addEventListener("click",()=>{if(G.finished)return;G.running=!G.running;saveGame();});
document.querySelectorAll(".sp").forEach(s=>s.addEventListener("click",()=>{document.querySelectorAll(".sp").forEach(x=>x.classList.remove("on"));s.classList.add("on");G.speed=+s.dataset.s;}));
document.getElementById("addBtn").addEventListener("click",()=>{if(siteMode())openSitePalette();else openPalette();});
document.getElementById("connBtn").addEventListener("click",()=>{
  if(BUILD.mode==="connect")buildExit();
  else{BUILD.mode="connect";BUILD.from=null;BUILD.fromSide=null;BUILD.sel=null;updateBuildBar();
    showHint(tr("Tap an orange output \u2014 or the link button to finish"));}});
document.getElementById("undoBtn").addEventListener("click",()=>{buildUndo();});
{const _fb=document.getElementById("fleetBtn");if(_fb)_fb.addEventListener("click",openFleet);}
document.getElementById("menuBtn").addEventListener("click",showMenu);
document.getElementById("saveBtn").addEventListener("click",()=>{if(G){G.running=false;openSaveSheet();}});
document.getElementById("btnLoad").addEventListener("click",openLoadSheet);
document.getElementById("importFile").addEventListener("change",function(e){
  const f=e.target.files&&e.target.files[0];if(!f)return;
  const rd=new FileReader();
  rd.onload=()=>{const raw=importSaveJSON(rd.result);
    if(!raw){toast(tr("Not a valid save file."),"warn");return;}
    try{restoreGame(raw);if(G&&G.nodes.some(n=>!TYPES[n.type]))throw new Error("incompatible");
      if(G&&G.scenario)snapshotPhase();
      closeSheet();document.getElementById("menu").classList.add("hide");last=0;showTabbar(true);setView("process");
      toast(tr("Loaded")+" \u2713","warn");}
    catch(err){toast(tr("Incompatible save."),"warn");}};
  rd.readAsText(f);e.target.value="";});
// Briefing modal — scenario intro + each phase transition. Pauses the run; "Continue" resumes.
let _briefResume=false;
function showBriefing(scnName,title,body,resumeOnClose,doneHTML){
  const _bd=document.getElementById("briefDone");if(doneHTML){_bd.innerHTML=doneHTML;_bd.classList.add("on");}else{_bd.classList.remove("on");_bd.innerHTML="";}
  document.getElementById("briefPh").textContent=scnName||"";
  document.getElementById("briefT").textContent=title||"";
  document.getElementById("briefB").textContent=body||"";
  document.getElementById("briefGo").textContent=resumeOnClose?tr("Continue"):tr("Start building");
  document.getElementById("brief").classList.add("show");_briefResume=!!resumeOnClose;}
document.getElementById("briefGo").addEventListener("click",()=>{document.getElementById("brief").classList.remove("show");
  if(_briefResume&&G&&!G.finished){G.running=true;saveGame();}});
UI.onOverflow=function(){toast(tr("Input full \u2014 overflow forced to landfill (paused)"),"bad");};
UI.onPhase=function(phase){if(!G||!G.scenario)return;G.running=false;
  const lp=G.lastPhase; let done="";
  if(lp){const pl=tr(SPECS[lp.product]?SPECS[lp.product].label:lp.product);
    const recov=lp.recovered>0?(" \u00b7 "+lp.recovered.toFixed(1)+" t "+pl+" "+tr("recovered")):"";
    done='<div class="bdTitle">\u2713 '+locF(lp.name,lp.name_f)+' '+tr("complete")+'</div>'+
         '<div class="bdSub">+'+euroB(lp.reward)+' '+tr("banked")+recov+'</div>';}
  showBriefing(tr(G.scenario.name),locF(phase.name,phase.name_f),locF(phase.briefing,phase.briefing_f),true,done);};
UI.onGraduate=function(lp){if(!G)return;G.running=false;
  const done=lp?'<div class="bdTitle">\u2713 '+locF(lp.name,lp.name_f)+' '+tr("complete")+'</div>':"";
  showBriefing(tr("Graduation"),tr("The plant is yours"),tr("Tutorial done \u2014 the line runs continuously now. Keep the cash positive; as you unlock partners in R&D you\u2019ll pick suppliers on each Intake and buyers on each Output."),true,done);};
// UI.onEnd — renders the end overlay from engine-set state (G.finished/tier already set).
UI.onEnd=function(win,reason){const ov=document.getElementById("ov");ov.classList.add("show");
  const T=document.getElementById("ovT"),Pp=document.getElementById("ovP"),S=document.getElementById("ovS");
  if(win){T.textContent="Contract complete";T.className="win";
    Pp.textContent=G.scenario
      ?"You ran the whole line \u2014 ferrous, then aluminium, then PET \u2014 and finished in the black. That's the full MRF loop. Try a Career contract or Sandbox next."
      :(G.contractKey==="standard"
      ?"Both products made spec and you stayed solvent. Now try the Film-heavy stream \u2014 it tangles the line, so you'll need a picking station to strip film first."
      :"You tamed the film stream and stayed solvent. The pickers earned their wages here. Try Sandbox to push purity with a recycle loop.");}
  else if(reason==="red"){T.textContent="Finished in the red";T.className="loss";Pp.textContent="You completed the contract but ended below zero \u2014 the landfill bill outran your bale sales. No game-over: retry and bin less, recover more.";}
  else{T.textContent="Off-spec";T.className="loss";Pp.textContent="Your PET never made grade. Check the failure badges \u2014 a NIR flashing BAGGED means un-opened bags reached it (lost yield). Liberate before you sort.";}
  const r=pnlReport();
  S.innerHTML="<b>P&amp;L</b> \u00B7 net \u20AC"+Math.round(r.net)+" \u00B7 lowest \u20AC"+Math.round(G.minCash)
    +"<br>+ tipping \u20AC"+Math.round(r.income.tipping)+" \u00B7 + sales \u20AC"+Math.round(r.income.sales)
    +(r.income.subsidies?" \u00B7 + subsidies \u20AC"+Math.round(r.income.subsidies):"")
    +"<br>\u2212 landfill \u20AC"+Math.round(r.costs.landfill)+" \u00B7 \u2212 power \u20AC"+Math.round(r.costs.power)
    +(r.costs.labour>1?" \u00B7 \u2212 labour \u20AC"+Math.round(r.costs.labour):"")
    +" \u00B7 \u2212 capex \u20AC"+Math.round(r.costs.capex)
    +"<br>PET "+G.petOn.toFixed(1)+"t on-spec \u00B7 landfilled "+G.landfill.toFixed(1)+"t \u00B7 "+fmtCal(G.t);};
// UI.viewReset — frame the camera to the placed units after a new/restored game.
UI.viewReset=function(){resize();
  if(siteMode()){siteViewFit();return;}
  if(G&&G.nodes.length){let minx=1e9,maxx=-1e9,miny=1e9,maxy=-1e9;
    for(const n of G.nodes){minx=Math.min(minx,n.x-n.w/2-46);maxx=Math.max(maxx,n.x+n.w/2+64);
      miny=Math.min(miny,n.y-n.h/2-50);maxy=Math.max(maxy,n.y+n.h/2+46);}
    const bw=maxx-minx,bh=maxy-miny,z=Math.min(1.1,Math.max(0.5,Math.min(VW/bw,VH/bh)));
    cam.zoom=z;cam.x=VW*0.5-((minx+maxx)/2)*z;cam.y=VH*0.5-((miny+maxy)/2)*z;}
  else{cam.zoom=0.9;cam.x=VW*0.5;cam.y=VH*0.5;}};
// Detailed balance-sheet popup (presentation): reuses pnlReport(); shown in the bottom sheet.
function balanceSheetHTML(){const r=pnlReport(),E=fmtN;
  const diverted=recyclingPct();
  const G2="var(--good)",O2="var(--accent)";
  const row=(k,v,b,c)=>'<div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid rgba(255,255,255,.08)'+(b?';font-weight:700':'')+'"><span>'+k+'</span><span'+(c?' style="color:'+c+'"':'')+'>\u20AC'+E(v)+'</span></div>';
  const ton=(k,v)=>'<div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid rgba(255,255,255,.08)"><span>'+k+'</span><span>'+v+'</span></div>';
  const head=t=>'<div style="margin:12px 0 4px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;font-size:11px;opacity:.6">'+t+'</div>';
  const _sup=G.contract&&G.contract.supplier?coName(G.contract.supplier):'';
  return '<h3>'+tr("Balance sheet")+'</h3><div class="real">'+(G.contract?G.contract.name:'')+(_sup?' \u00B7 '+_sup:'')+' \u00B7 '+fmtCal(G.t)+'</div>'+
    head(tr("Income"))+row(tr("Tipping (gate in)"),r.income.tipping,0,G2)+row(tr("Bale sales"),r.income.sales,0,G2)+(r.income.subsidies?row(tr("Subsidies"),r.income.subsidies,0,G2):'')+row(tr("Total income"),r.incomeTotal,1,G2)+
    head(tr("Operating costs"))+row(tr("Landfill / disposal"),-r.costs.landfill,0,O2)+row(tr("Power"),-r.costs.power,0,O2)+(r.costs.labour>0?row(tr("Labour"),-r.costs.labour,0,O2):'')+(r.costs.logistics>0?row(tr("Logistics & upkeep"),-r.costs.logistics,0,O2):'')+row(tr("Total operating costs"),-r.recurringTotal,1,O2)+
    head(tr("Operating result"))+row(tr("Income \u2212 operating costs"),r.operating,1,(r.operating>=0?G2:O2))+
    head(tr("Investment"))+row(tr("Capex"),-r.capexTotal,1,O2)+
    head(tr("Result"))+row(tr("Starting cash"),G.startCash!=null?G.startCash:ECON.startCash)+row(tr("Net cash"),r.net,1)+
    head(tr("Tonnage"))+ton(tr("PET on-spec"),G.petOn.toFixed(1)+'t')+ton(tr("Landfilled"),G.landfill.toFixed(1)+'t')+ton(tr("Recycling"),diverted.toFixed(0)+'%')+
    opexDayHTML();}
function opexDayHTML(){ // per-day OPEX breakdown (capex excluded) + a compact history
  const H=(G&&G.opexHistory)||[];const head=t=>'<div style="margin:12px 0 4px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;font-size:11px;opacity:.6">'+t+'</div>';
  const E=fmtN,G2="var(--good)",O2="var(--accent)";
  const row=(k,v,b,c)=>'<div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid rgba(255,255,255,.08)'+(b?';font-weight:700':'')+'"><span>'+k+'</span><span'+(c?' style="color:'+c+'"':'')+'>\u20AC'+E(v)+'</span></div>';
  if(!H.length)return head(tr("Daily operating result"))+'<div class="desc">'+tr("Run a full day to see the per-day breakdown.")+'</div>';
  const e=H[H.length-1]; // yesterday
  let s=head(tr("Daily operating result")+" \u00B7 "+tr("Yesterday"));
  s+=row(tr("Tipping (gate in)"),e.tipping,0,G2)+row(tr("Bale sales"),e.sales,0,G2)+(e.subsidies?row(tr("Subsidies"),e.subsidies,0,G2):'');
  s+=row(tr("Labour"),-e.labour,0,O2)+row(tr("Power"),-e.power,0,O2)+row(tr("Landfill / disposal"),-e.landfill,0,O2)+(e.logistics?row(tr("Logistics & upkeep"),-e.logistics,0,O2):'');
  s+=row(tr("Operating result")+" / "+tr("day"),e.net,1,(e.net>=0?G2:O2));
  // compact history: last N days as a net sparkline (bars)
  const N=Math.min(30,H.length),recent=H.slice(-N);
  const vals=recent.map(x=>x.net),mn=Math.min(0,...vals),mx=Math.max(0,...vals),span=(mx-mn)||1;
  let bars='';
  for(const x of recent){const h=Math.round((x.net-mn)/span*34)+2;const pos=x.net>=0;
    bars+='<span title="'+tr("day")+' '+x.day+': \u20AC'+E(x.net)+'" style="flex:1;height:'+h+'px;min-width:2px;background:'+(pos?"var(--good)":"var(--accent)")+';opacity:.8;border-radius:1px"></span>';}
  s+=head(tr("Operating result")+" \u00B7 "+tr("last {n} days").replace("{n}",N))+
     '<div style="display:flex;align-items:flex-end;gap:2px;height:40px;padding:4px 0">'+bars+'</div>'+
     '<div class="desc">'+tr("Each bar is one day\u2019s operating result (capex excluded).")+'</div>';
  return s;}
function showBalanceSheet(){if(G)showSheet(balanceSheetHTML());}
document.getElementById("ovRetry").addEventListener("click",()=>{document.getElementById("ov").classList.remove("show");
  if(G&&G.scenario&&_phaseSnap){try{restoreGame(_phaseSnap);G.finished=false;G.running=false;saveGame();UI.viewReset();last=0;setTimeout(()=>toast("Phase restarted \u2014 give it another go","warn"),300);}catch(e){newGame(G.mode,G.contractKey,(Date.now()>>>0));last=0;}}
  else{newGame(G.mode,G.contractKey,(Date.now()>>>0));last=0;}});
document.getElementById("ovMenu").addEventListener("click",()=>{document.getElementById("ov").classList.remove("show");showMenu();});
function showInfo(title,html){const m=document.getElementById("infoM");document.getElementById("infoT").textContent=title;document.getElementById("infoB").innerHTML=html||"";m.classList.add("show");document.getElementById("infoClose").onclick=()=>m.classList.remove("show");}
function hasResumable(){return !!(G&&G.nodes&&G.nodes.length&&!G.finished);}
function askConfirm(msg,onYes){const m=document.getElementById("confirmM");document.getElementById("confirmMsg").textContent=msg;m.classList.add("show");
  const y=document.getElementById("confirmYes"),no=document.getElementById("confirmNo");const done=()=>{m.classList.remove("show");y.onclick=null;no.onclick=null;};
  y.onclick=()=>{done();onYes();};no.onclick=done;}
function showMenu(){if(G){G.running=false;saveGame();}const res=hasResumable();
  const r=document.getElementById("btnResume");if(r)r.style.display=res?"block":"none";
  document.getElementById("btnResume").classList.toggle("flag",res);
  document.getElementById("btnCareer").classList.toggle("flag",!res);
  document.getElementById("btnSandbox").classList.remove("flag");
  document.getElementById("btnLoad").style.display="block"; // always available (load slot or import a file)
  document.getElementById("menu").classList.remove("hide");}
function _slotModeLabel(m){return m==="sandbox"?tr("Sandbox"):tr("Career");}
function openSaveSheet(){ // name the current run and store it in a slot
  if(!G){toast(tr("Nothing to save yet."),"warn");return;}
  const dflt=(G.label||_slotModeLabel(slotMode())+" \u00b7 "+fmtCal(G.t));
  const slots=listSlots();
  const existing=slots.map(s=>'<div class="palcard" data-ovr="'+s.id+'" style="display:block"><div class="pt">\u21BB '+_esc(s.name)+'</div><div class="pd">'+tr("Overwrite")+' \u00b7 '+_slotModeLabel(s.mode)+'</div></div>').join("");
  showSheet('<h3>'+tr("Save game")+'</h3><div class="real">'+_slotModeLabel(slotMode())+' \u00b7 '+fmtCal(G.t)+' \u00b7 '+euroB(G.cash)+'</div>'+
    '<input id="saveName" type="text" maxlength="40" value="'+_esc(dflt)+'" style="width:100%;box-sizing:border-box;font:600 15px -apple-system,sans-serif;color:var(--text);background:#231f1b;border:1px solid var(--accent2);border-radius:9px;padding:9px 11px;margin:4px 0 10px">'+
    '<button class="bigbtn primary" id="saveNew" style="width:100%">'+tr("Save as new slot")+'</button>'+
    '<button class="bigbtn ghost" id="saveExport" style="width:100%;margin-top:8px">'+tr("Export to file (.json)")+'</button>'+
    (existing?'<div class="slbl" style="margin-top:12px">'+tr("Or overwrite")+'</div><div class="palgrid" style="grid-template-columns:1fr">'+existing+'</div>':''));
  const doSave=(id)=>{const nm=(document.getElementById("saveName").value||"").trim()||dflt;const sid=saveToSlot(nm,id);
    if(sid){toast(tr("Saved")+" \u2713","warn");closeSheet();}else toast(tr("Save failed."),"warn");};
  document.getElementById("saveNew").addEventListener("click",()=>doSave(null));
  document.getElementById("saveExport").addEventListener("click",()=>{exportSaveJSON();toast(tr("Exported")+" \u2713","warn");});
  sheet.querySelectorAll(".palcard[data-ovr]").forEach(c=>c.addEventListener("click",()=>{
    askConfirm(tr("Overwrite this save?"),()=>doSave(c.dataset.ovr));}));}
function openLoadSheet(){
  const slots=listSlots();
  const cards=slots.map(s=>{const badge=s.mode==="sandbox"?'<span style="color:#8a8078">'+tr("Sandbox")+'</span>':'<span style="color:var(--good)">'+tr("Career")+'</span>';
    return '<div class="palcard" data-load="'+s.id+'" style="display:block"><div class="pt">'+_esc(s.name)+'</div>'+
      '<div class="pd" style="margin:3px 0">'+badge+' \u00b7 '+euroB(s.cash||0)+' \u00b7 '+new Date(s.ts||0).toLocaleDateString()+'</div>'+
      '<button class="ibtn danger" data-del="'+s.id+'" style="position:absolute;top:8px;right:8px" aria-label="delete">\u2715</button></div>';}).join("");
  showSheet('<h3>'+tr("Load game")+'</h3><div class="real">'+(slots.length?tr("Career or sandbox \u2014 pick a slot"):tr("No saved games yet \u2014 import a file below"))+'</div>'+(cards?'<div class="palgrid" style="grid-template-columns:1fr">'+cards+'</div>':'')+
    '<button class="bigbtn ghost" id="loadImport" style="width:100%;margin-top:10px">'+tr("Import from file (.json)")+'</button>');
  sheet.querySelectorAll(".palcard[data-load]").forEach(c=>c.addEventListener("click",(e)=>{
    if(e.target.closest("[data-del]"))return; // delete handled below
    const sv=loadSlot(c.dataset.load);
    if(!sv){toast(tr("Could not load."),"warn");return;}
    try{restoreGame(sv);if(G&&G.nodes.some(n=>!TYPES[n.type]))throw new Error("incompatible");
      if(G&&G.scenario)snapshotPhase();
      closeSheet();document.getElementById("menu").classList.add("hide");last=0;showTabbar(true);setView("process");
      toast(tr("Loaded")+" \u2713","warn");}
    catch(err){toast(tr("Incompatible save."),"warn");}}));
  sheet.querySelectorAll("[data-del]").forEach(b=>b.addEventListener("click",(e)=>{e.stopPropagation();
    askConfirm(tr("Delete this save?"),()=>{deleteSlot(b.dataset.del);openLoadSheet();});}));
  const imp=document.getElementById("loadImport");if(imp)imp.addEventListener("click",()=>document.getElementById("importFile").click());}
function startNew(mode,key){if(hasResumable())askConfirm(tr("Start a new game? Your current run will be lost."),()=>begin(mode,key));else begin(mode,key);}
function begin(mode,key){closeSheet();document.getElementById("menu").classList.add("hide");newGame(mode,key,(Date.now()>>>0));if(G&&G.scenario)snapshotPhase();last=0;showTabbar(true);setView("process");
  if(G.scenario&&G.scenario.siteRef){G.running=true;setTimeout(()=>toast(tr("Your plant is live \u2014 pinch to zoom, tap any unit or vehicle to inspect it."),"warn"),500);}
  else if(G.scenario){const p0=G.scenario.phases[0];showBriefing(tr(G.scenario.name),locF(p0.name,p0.name_f),locF(p0.briefing,p0.briefing_f),false);
    setTimeout(()=>toast("Wire Intake \u2192 magnet \u2192 Baler \u2192 a ferrous Output. Tap \uFF0B Add.","warn"),700);}
  else if(mode==="career")setTimeout(()=>toast("Wire Intake \u2192 sorters \u2192 Baler \u2192 an Output. Tap \uFF0B Add, drag to place, tap a port then a unit.","warn"),400);
  else setTimeout(()=>toast("Infinite feed, no fail. Build, watch streams split, read the badges.","warn"),400);}
function chooseContract(){document.getElementById("menu").classList.add("hide");
  const card=(key)=>{const c=CONTRACTS[key];const leg=MAT.filter(m=>c.comp[m]).map(m=>'<span><span class="d" style="background:'+COL[m]+'"></span>'+m+' '+Math.round(c.comp[m]*100)+'%</span>').join("");
    const hot=key==="film";
    return '<div class="palcard" data-ck="'+key+'" style="display:block"><div class="pt">'+c.name+(hot?' \uD83D\uDD25':'')+'</div>'+
      '<div class="pd" style="margin:4px 0">'+c.tonnage+'t \u00B7 '+(hot?'film fouls the line \u2014 you will need a picking station':'a gentle first run')+'</div>'+
      '<div class="complegend">'+leg+'</div></div>';};
  const scn=SCENARIOS.pmc;
  const siteCard='<div class="palcard" data-scn="site_ref" style="display:block;border-color:#7FA86B"><div class="pt">\uD83C\uDFED '+tr("Reference plant")+' \u2014 SITE</div>'+
    '<div class="pd" style="margin:4px 0">'+tr("The physical yard: trucks, loaders, forklifts on a real site plan \u2014 tap anything to inspect it")+'</div></div>';
  const scnCard='<div class="palcard" data-scn="pmc" style="display:block;border-color:var(--accent)"><div class="pt">\uD83C\uDF93 Tutorial \u2014 '+scn.name+'</div>'+
    '<div class="pd" style="margin:4px 0">'+scn.phases.length+' phases on one line \u00B7 ferrous \u2192 aluminium \u2192 PET \u00B7 learn the machines as you unlock them</div></div>';
  showSheet('<h3>'+tr("Pick a contract")+'</h3><div class="real">'+tr("new here? start with the tutorial")+'</div><div class="palgrid" style="grid-template-columns:1fr">'+siteCard+scnCard+card("standard")+card("film")+'</div>');
  sheet.querySelectorAll(".palcard[data-scn]").forEach(c=>c.addEventListener("click",()=>startNew("career",c.dataset.scn)));
  sheet.querySelectorAll(".palcard[data-ck]").forEach(c=>c.addEventListener("click",()=>startNew("career",c.dataset.ck)));}
document.getElementById("btnResume").addEventListener("click",()=>{
  if(hasResumable()){document.getElementById("menu").classList.add("hide");last=0;}
  else{const sv=loadSave();if(sv&&sv.nodes&&sv.nodes.length&&(sv.contractKey||"").indexOf("site_")===0){try{restoreGame(sv);document.getElementById("menu").classList.add("hide");last=0;}catch(e){}}}});
document.getElementById("btnCareer").addEventListener("click",()=>startNew("career","site_career")); // Career: guided tutorial on an empty site
document.getElementById("btnAtelier").addEventListener("click",()=>startNew("career","site_atelier")); // Atelier: financial challenge, no tutorial
document.getElementById("btnSandbox").addEventListener("click",()=>startNew("career","site_free"));  // Sandbox: empty site, no tutorial
document.getElementById("btnDemo").addEventListener("click",()=>startNew("career","site_ref"));      // Reference plant, already running
resize();
{let _sv=null;try{_sv=loadSave();}catch(e){_sv=null;}
 let _ok=false;
 if(_sv&&_sv.nodes&&_sv.nodes.length&&!_sv.finished&&(_sv.contractKey||"").indexOf("site_")===0){
   try{restoreGame(_sv);
     if(G&&G.nodes.some(n=>!TYPES[n.type]))throw new Error("incompatible save");
     document.getElementById("menu").classList.add("hide");setTimeout(()=>toast("Resumed your saved game","warn"),350);_ok=true;}
   catch(e){clearSave();_ok=false;}}
 showMenu();/* no hidden default game: the menu reflects the real (none) resumable state */}
if(cashStatEl)cashStatEl.addEventListener("click",()=>showBalanceSheet());
document.querySelectorAll("#langRow button").forEach(b=>b.addEventListener("click",()=>setLang(b.dataset.lang)));
loadCareer();purgeLegacyCareer();
try{const _ps=localStorage.getItem("recycle.phasesnap");if(_ps)_phaseSnap=JSON.parse(_ps);}catch(e){}
try{const _l=localStorage.getItem("recycle.lang");if(_l==="fr")LANG_CUR="fr";}catch(e){}
document.documentElement.lang=LANG_CUR;applyLang();
requestAnimationFrame(loop);
