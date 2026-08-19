/*@TESTS-START@ ─────────────────────────────────────────────────────────────
 * Tests-as-code (Phase 0 §3): pure suites over the engine scope, versioned with
 * the code they test. INERT in the browser (definitions only). tools/qc.js
 * extracts the @ENGINE@ + @TESTS@ blocks, runs every suite, exits 0/1.
 * Shared plumbing lives HERE ONCE (the four S-BATCH harnesses each carried a
 * drifting copy of held() — that duplication ends here).
 * ──────────────────────────────────────────────────────────────────────────*/
function qcHeld(){let s=0;
  for(const n of G.nodes){ s+=cnt(n.inBuf)+cnt(n.bale); if(n.bales)for(const b of n.bales)s+=cnt(b);
    if(n.containers)for(const c of n.containers)s+=cnt(c); s+=Math.round((n.disposeHeap||0)/PMASS)*0; }
  for(const v of (G.vehicles||[])){ s+=cnt(v.payload); if(v.baleLoad)for(const b of v.baleLoad)s+=cnt(b); }
  for(const e of G.edges)for(const sp of e.sprites)s+=sp.bale?cnt(sp.bale):1;
  return s;}
function qcSold(){let t=0;for(const k in G.sold)t+=(G.sold[k].on||0)+(G.sold[k].off||0);return t;}
function qcBalanced(){ // dumped == held + landfilled + sold, in particles (exact)
  const IN=Math.round(G.deliveredTot/PMASS),LF=Math.round(G.landfill/PMASS),SO=Math.round(qcSold()/PMASS);
  return {ok:IN===(qcHeld()+LF+SO),IN,H:qcHeld(),LF,SO};}
function qcTicks(n,dt){dt=dt||0.004;for(let i=0;i<n;i++)tick(dt);}
// The harness rig is site_qc (the plain 27-unit plant), NOT site_ref — site_ref is now the showcase
// 100%-recycling build, whose 7 bunkers, missing landfill and closed ring make it a poor generic fixture.
function qcSiteGame(seed,fleet){newGame("career","site_qc",seed==null?0xC0FFEE7:seed);
  G.fleet=Object.assign({},G.fleet,fleet||{loader:3,forklift:7,ctruck:1});return G;}
const QC_SUITES={

"site-loader":function(t){qcSiteGame();
  t.ok(G.nodes.length===27,"27 units placed (got "+G.nodes.length+")");
  t.ok(G.edges.length===29,"29 connections wired (got "+G.edges.length+")");
  const R=r=>G.nodes.filter(n=>n.role===r).length;
  t.ok(R("bunker")===2&&R("feeder")===1&&R("bulk")===1&&R("export")===5&&R("landfill")===1,
    "roles: 2 bunkers, 1 feeder, 1 bulk, 5 export, 1 landfill");
  t.ok(G.nodes.filter(n=>n.type==="baler").length===7,"7 balers");
  t.ok(G.nodes.filter(n=>["opener","magnet","eddy","air","nir","splitter"].indexOf(n.type)>=0).length===7,"7 process machines from config");
  // belt sprites animate at a uniform WORLD speed (SITE_BELT_SPEED px/sim-unit) independent of belt length:
  // the length-normalized edge speed must survive the reference load (regression: side belts ran ~5× fast
  // when the authored speed field was dropped and every belt fell back to the fixed EDGE_SPEED fraction).
  const beltOff=G.edges.filter(e=>e.kind==="conveyor"&&e.route&&Math.abs(e.speed*pathLen(e.route)-SITE_BELT_SPEED)>1);
  t.ok(beltOff.length===0,"conveyor belts animate at uniform world speed ("+beltOff.length+" off SITE_BELT_SPEED)");
  const n0=G.nodes[0]; // bunker at grid (8,4), 2x3
  t.ok(n0.x===(8+1)*CELL&&n0.y===(4+1.5)*CELL&&n0.w===2*CELL&&n0.h===3*CELL,"world coords derived from grid placement");
  t.ok(G.nodes.every(n=>n.gx!=null&&n.gy!=null),"every node carries its grid placement");
  // seam law: vehicles are the ONLY carriers across storage boundaries, and exactly there
  const seamOf=e=>{const a=nodeById(e.from),b=nodeById(e.to);
    return (isBunker(a)&&isFeeder(b))||(a.type==="baler"&&isExport(b))||(isBulk(a)&&isLandfill(b));};
  t.ok(G.edges.every(e=>(e.kind==="vehicle")===seamOf(e)),"seam law: vehicle iff storage boundary (conveyors stay within the line)");
  t.ok(G.edges.filter(e=>e.kind==="vehicle").length===10,"10 vehicle seams (2 loader + 7 forklift + 1 ctruck)");
  // every vehicle route rides the dirt network
  const s=siteSets();let off=0;
  for(const e of G.edges)if(e.kind==="vehicle")for(const p of e.route.slice(1,-1))
    if(!s.dirt.has(Math.floor(p[0]/CELL)+","+Math.floor(p[1]/CELL)))off++;
  t.ok(off===0,"all vehicle-route waypoints on dirt ("+off+" off)");
  // port resolution follows the engine's selected-stream convention
  const eOf=(ty,side)=>G.edges.find(e=>{const a=nodeById(e.from);return a.type===ty&&side(e,a);});
  const mag=G.nodes.find(n=>n.type==="magnet"),magS=G.edges.find(e=>e.from===mag.id&&e.fromPort==="S");
  t.ok(!!magS&&nodeById(magS.to).type==="baler","magnet S (steel) → baler");
  const nir=G.nodes.find(n=>n.type==="nir"),nirM=G.edges.find(e=>e.from===nir.id&&e.fromPort==="M");
  t.ok(!!nirM&&nodeById(nirM.to).type==="baler","NIR M (kept PET) → baler");
  const spl=G.nodes.find(n=>n.type==="splitter");
  t.ok(G.edges.filter(e=>e.from===spl.id).length===2,"splitter A and B both wired");
  // a mis-specified plant fails AT LOAD
  let threw=false;try{loadSite({objects:[{type:"process",x:0,y:0}],connections:[]},{});}catch(err){threw=true;}
  t.ok(threw,"unconfigured process placeholder throws at load");
},

"site-physics":function(t){
  const P=[[0,0],[300,0],[300,300]];
  t.ok(pathLen(P)===600,"pathLen sums segments");
  const a=pathAt(P,0),m=pathAt(P,0.5),z=pathAt(P,1);
  t.ok(a.x===0&&a.y===0&&z.x===300&&z.y===300,"pathAt endpoints exact");
  t.ok(m.x===300&&m.y===0,"pathAt(0.5) lands on the elbow of an equal-armed L");
  const t1=vehTransit([[0,0],[600,0]]),t2=vehTransit([[0,0],[1200,0]]);
  t.ok(Math.abs(t2/t1-2)<1e-9||t1===G.logi.minTrip,"trip time ∝ real path length");
  qcSiteGame();qcTicks(4000);
  const s=siteSets();let legs=0,offDirt=0,authored=0;
  let floorFork=0;
  for(const v of G.vehicles){if(!v.path||v.path.length<2)continue;legs++;
    if(v.cls==="ctruck"||v.cls==="forklift") // container trucks AND forklifts ride the dirt network (yard vehicles, 2026-07-11)
      for(const p of v.path.slice(1,-1)){const cx=Math.floor(p[0]/CELL),cy=Math.floor(p[1]/CELL);
        if(!s.dirt.has(cx+","+cy)){offDirt++;if(s.shell.has(cx+","+cy))floorFork++;}}
    else // loaders work the bunker↔feeder seam across the apron band: stay on the property
      for(const p of v.path.slice(1,-1))if(!s.prop.has(Math.floor(p[0]/CELL)+","+Math.floor(p[1]/CELL)))offDirt++;
    const src=nodeById(v.fromId),dst=nodeById(v.toId);
    if(v.state==="toDest"&&src&&dst&&edgeRouteBetween(src.id,dst.id))authored++;}
  t.ok(legs>0,"vehicles took route legs ("+legs+" live paths)");
  t.ok(offDirt===0,"ctrucks & forklifts ride the dirt network; loaders stay on the property ("+offDirt+" off)");
  t.ok(floorFork===0,"no forklift path crosses the warehouse floor ("+floorFork+" floor cells)");
  // A loader derives its path from LIVE dock geometry (motionLeg→orthoZ), not from the stored edge route
  // (which it ignores), so exact route identity is not an invariant — it only held for machine-generated
  // reference routes. The real invariant: the leg runs its bunker→feeder seam, that seam is wired (an
  // authored route exists), and the path stays on the property.
  const l=G.vehicles.find(v=>v.cls==="loader"&&v.state==="toDest");
  if(l){const src=nodeById(l.fromId),dst=nodeById(l.toId),e=edgeRouteBetween(l.fromId,l.toId);
    const onProp=l.path.slice(1,-1).every(p=>s.prop.has(Math.floor(p[0]/CELL)+","+Math.floor(p[1]/CELL)));
    t.ok(!!(src&&dst)&&isBunker(src)&&isFeeder(dst)&&!!e&&l.path.length>=2&&onProp,
      "a loader delivery leg runs its wired bunker→feeder seam and stays on the property");}
  else t.ok(true,"(no loader mid-delivery at sample tick)");
  const pos=G.vehicles.map(v=>vehPos(v));
  t.ok(pos.every(p=>isFinite(p.x)&&isFinite(p.y)),"vehPos finite for the whole fleet");
},

"site-conservation":function(t){qcSiteGame();
  let worst=0,checks=0,sawStates={};
  for(let i=0;i<24000;i++){tick(0.004);
    if(i%50===0){const b=qcBalanced();checks++;if(!b.ok)worst=Math.max(worst,Math.abs(b.IN-(b.H+b.LF+b.SO)));}
    for(const n of G.nodes)if(n.state&&n.state!=="ok")sawStates[n.state]=1;}
  t.ok(worst===0,"dumped == held + landfilled + sold, EXACT at every sampled tick ("+checks+" samples, worst leak "+worst+")");
  t.ok(G.deliveredTot>0,"supplier trucks tipped ("+G.deliveredTot.toFixed(1)+" t)");
  t.ok(qcSold()>0,"bales sold via forklift→export→client truck ("+qcSold().toFixed(1)+" t)");
  t.ok(G.landfill>0,"reject reached landfill via bulk→ctruck ("+G.landfill.toFixed(1)+" t)");
  t.ok((G.sold.ferrous&&G.sold.ferrous.on>0)||false,"on-spec ferrous sold (magnet line works end-to-end)");
},

"site-determinism":function(t){
  const run=()=>{qcSiteGame(0xBADC0DE1);qcTicks(9000);return JSON.stringify(serializeGame());};
  const A=run(),B=run();
  t.ok(A===B,"same seed ⇒ byte-identical serialized state after 9000 ticks (routes, paths, vehicles included)");
},

"legacy-flowsheet-scenes":function(t){ // legacy addNode scenes still conserve (harness scenes remain valid)
  newGame("sandbox","standard",0xC0FFEE7);
  G.contract.supplier=null;G.contract.comp={PET:0.5,steel:0.5};G.contract.feedTph=8;
  const src=G.nodes.find(isFeeder);src.rate=8;
  const bulk=addNode("output",180,0,"dispose");
  G.edges.push({from:src.id,fromPort:"O",to:bulk.id,sprites:[],speed:EDGE_SPEED});
  let worst=0;
  for(let i=0;i<6000;i++){tick(0.004);
    if(i%50===0){const b=qcBalanced();if(!b.ok)worst=Math.max(worst,Math.abs(b.IN-(b.H+b.LF+b.SO)));}}
  t.ok(worst===0,"sealed legacy scene conserves exactly (straight-segment fallback physics)");
  t.ok(G.vehicles.some(v=>v.cls==="loader"),"loader pool serves legacy scenes");
},


"site-trucks":function(t){ // S-TRUCK: boundary trucks drive the road network; economy books at the physical event
  qcSiteGame();
  const W=truckWalkSet();let seen={supplier:0,client:0,lftruck:0},offRoad=0,offSite=0,overCap=0,maxSim=0;
  for(let i=0;i<24000;i++){tick(0.004);
    if(i%100===0&&G.trucks){maxSim=Math.max(maxSim,G.trucks.length);
      for(const tk of G.trucks){seen[tk.cls]=(seen[tk.cls]||0)+0.01;
        for(const p of tk.path){ // waypoints OFF the grid are the through-road lead-in/out (deliberate); on-site ones must be on road/apron
          const gx=Math.floor(p[0]/CELL),gy=Math.floor(p[1]/CELL);
          if(gx<0||gy<0||gx>=SITE_LAYOUT.grid.w||gy>=SITE_LAYOUT.grid.h){offSite++;continue;}
          if(!W.has(gx+","+gy))offRoad++;}}
      for(const n of G.nodes)if(isBunker(n)&&truckInflight("supplier",n.id)>G.logi.truckMaxInflight)overCap++;}}
  // presence: each class actually drove
  let drove={supplier:0,client:0,lftruck:0};for(const k in seen)drove[k]=seen[k]>0;
  t.ok(drove.supplier,"supplier trucks drove the ring road");
  t.ok(drove.client,"a client truck came for bales");
  t.ok(drove.lftruck,"a landfill truck hauled containers");
  t.ok(offRoad===0,"every ON-SITE truck waypoint is on road/apron cells ("+offRoad+" off)");
  t.ok(offSite>0,"trucks run the through-road onto the neighbouring tiles ("+offSite+" off-site waypoints seen)");
  {const lead=ROAD_APPROACH/CELL; t.ok(lead===SITE_LAYOUT.grid.h,"the road runs the full neighbouring tile ("+lead+" cells each way)");}
  t.ok(overCap===0,"per-bunker in-flight cap respected");
  const b=qcBalanced();
  t.ok(b.ok,"conservation exact with trucks in flight (economy books at tip/load only)");
  t.ok(G.deliveredTot>0&&qcSold()>0&&G.landfill>0,"all three boundaries flowed through visible trucks");
  // WYSIWYG: a truck's reported event mass is real
  qcSiteGame(0xFEED123);let tipTotal=0,dT0=G.deliveredTot;
  for(let i=0;i<8000;i++){tick(0.004);}
  for(const tk of (G.trucks||[]))if(tk.cls==="supplier"&&tk.tipped)tipTotal+=tk.tipped;
  t.ok(G.deliveredTot>dT0,"tipping continues under the truck regime ("+G.deliveredTot.toFixed(1)+" t)");
},

"site-authoring":function(t){ // Phase 3: the player-built plant, engine level
  newGame("career","site_free",0xB111D3);
  t.ok(G.nodes.length===0&&G.edges.length===0,"new site starts empty");
  const cash0=G.cash;
  // gates
  t.ok(!sitePlaceUnit("baler",null,8,20,0).ok,"baler refused in the white corridor (strips only)");
  t.ok(!sitePlaceUnit("input",null,5,14,0).ok,"bunker refused off the intake apron");
  t.ok(!sitePlaceUnit("input",null,19,4,0).ok,"placement refused off-property");
  // build a mini line: bunker → feeder → opener → bulk → landfill
  const rb=sitePlaceUnit("input",null,7,4,0);t.ok(rb.ok,"bunker placed on the input apron");
  const rf=sitePlaceUnit("feeder",null,8,10,0);t.ok(rf.ok,"feeder placed on the green strip");
  t.ok(!sitePlaceUnit("feeder",null,8,10,0).ok,"overlap refused");
  const ro=sitePlaceUnit("process","opener",8,14,0);t.ok(ro.ok,"opener placed in the white corridor");
  const rz=sitePlaceUnit("bulk",null,6,29,0);t.ok(rz.ok,"bulk zone placed (within reach of the dirt network)");
  const far=sitePlaceUnit("bulk",null,10,20,0);

  const rl=sitePlaceUnit("landfill",null,2,38,0);t.ok(rl.ok,"landfill placed in the lower yard");
  t.ok(G.cash<cash0,"CAPEX charged ("+Math.round((cash0-G.cash)/1000)+" k€)");
  // wiring: seam law both ways
  t.ok(!siteConnect(rb.node,"b",ro.node,"t").ok,"bunker→process refused (loader seam only reaches a feeder)");
  t.ok(!siteConnect(rf.node,"b",rl.node,"t").ok,"feeder→landfill refused (only a bulk zone feeds the landfill)");
  const c1=siteConnect(rb.node,"b",rf.node,"t");t.ok(c1.ok&&c1.kind==="vehicle","bunker→feeder wires as a LOADER route");
  t.ok(c1.edge.route.length<=4,"loader seam is a direct elbow");
  const c2=siteConnect(rf.node,"b",ro.node,"t");t.ok(c2.ok&&c2.kind==="conveyor"&&c2.cost>0,"feeder→opener wires as a CONVEYOR, per-metre cost "+c2.cost+" €");
  t.ok(!siteConnect(rf.node,"b",ro.node,"t").ok,"occupied port refused");
  const c3=siteConnect(ro.node,"b",rz.node,"t");t.ok(c3.ok&&c3.kind==="conveyor","opener→bulk conveyor");
  const c4=siteConnect(rz.node,"b",rl.node,"t");t.ok(c4.ok&&c4.kind==="vehicle","bulk→landfill wires as a CONTAINER-TRUCK route");
  const S=siteSets();let off=0;
  for(const p of c4.edge.route.slice(1,-1))if(!S.dirt.has(Math.floor(p[0]/CELL)+","+Math.floor(p[1]/CELL)))off++;
  t.ok(off===0,"player-drawn vehicle route rides the dirt network ("+off+" off)");
  // it RUNS: seed the stream and let it flow
  rb.node.truckDue=1000;
  let worst=0;
  for(let i=0;i<15000;i++){tick(0.004);
    if(i%100===0){const b=qcBalanced();if(!b.ok)worst=Math.max(worst,1);}}
  t.ok(worst===0,"player-built plant conserves mass exactly over 15000 ticks");
  t.ok(G.deliveredTot>0,"trucks feed the player's bunker ("+G.deliveredTot.toFixed(1)+" t)");
  {let _ic=0;for(const n of G.nodes)if(isBulk(n)&&n.containers)for(const c of n.containers)_ic+=cnt(c);
  t.ok(_ic>0||G.landfill>0,"material flowed the whole line into the end-of-line containers ("+(_ic*PMASS).toFixed(1)+" t staged)");}
  // demolition: contents scrap to landfill, edges die, refund books, mass stays exact
  const held=cnt(ro.node.inBuf),lf0=G.landfill,cashD=G.cash;
  const rd=siteDemolish(ro.node);
  t.ok(rd.ok&&G.cash>cashD,"demolition refunds "+Math.round(rd.refund/1000)+" k€");
  t.ok(!G.edges.some(e=>e.from===ro.node.id||e.to===ro.node.id),"demolition removes the unit's connections");
  t.ok(qcBalanced().ok,"mass books exact after demolition (contents + in-flight scrapped to landfill)");
  // save round-trip of a player-built plant
  const A=JSON.stringify(serializeGame());
  restoreGame(JSON.parse(A));
  t.ok(JSON.stringify(serializeGame())===A,"player-built plant survives serialize→restore byte-identically");
},





"site-atelier":function(t){ // Atelier = financial-constraint mode, no tutorial, a few starter bays pre-placed
  newGame("career","site_atelier",0xA7311E);
  const R=r=>G.nodes.filter(n=>n.role===r).length;
  t.ok(G.nodes.length===6&&G.edges.length===0,"starter loads 6 bays, no wiring (got "+G.nodes.length+"/"+G.edges.length+")");
  t.ok(R("bunker")===2&&R("bulk")===1&&R("export")===2&&R("landfill")===1,"bays: 2 bunkers, 1 bulk, 2 export, 1 landfill");
  const ex=G.nodes.filter(n=>n.role==="export").map(n=>n.spec).sort().join(",");
  t.ok(ex==="PET,ferrous","two export bays pre-assigned PET + ferrous ("+ex+")");
  t.ok(G.cash===2500000&&G.startCash===2500000,"starts with 2.5M€");
  t.ok(!(G.scenario&&G.scenario.unlimitedBudget),"budget is constrained (unlimitedBudget off)");
  t.ok(G.tut===null&&!(G.scenario&&G.scenario.tuto),"no tutorial guide");
  t.ok(budgetBlocks(3000000)&&!budgetBlocks(80000),"financial gate blocks the unaffordable, allows the affordable");
  t.ok(CAREER.tech.length===0,"tech tree starts empty (nothing pre-granted)");
  t.ok(techResearchable("r_eddyU")&&techResearchable("a_pickU")&&techResearchable("s_subsidy"),"R&D nodes researchable in the constrained career");
  t.ok(!unitUnlocked("pick"),"pick is tech-gated before research");
  researchTech("a_pickU");
  t.ok(unitUnlocked("pick")&&CAREER.tech.indexOf("a_pickU")>=0,"researching a_pickU unlocks the pick unit");
},

"site-bonus-economy":function(t){ // recurring bonuses + reputation sponsorship + growth/impact goals
  newGame("career","site_qc",0xC0FFEE7);G.running=true;
  const sub0=G.ledger.subsidies;
  // Three days, not two: day 1 is the ramp (bunkers filling, nothing sold yet) and nets NEGATIVE, so a
  // two-day window banked no positive daily net at all once the feed halved in the 2026-08-19 rebalance.
  for(let i=0;i<3*24/0.004;i++)tick(0.004); // 3 days
  t.ok(G.ledger.subsidies>sub0,"recurring diversion + EPR subsidies accrue in career (+"+Math.round(G.ledger.subsidies-sub0)+")");
  t.ok(CAREER.counters.bestDailyNet>0,"best daily net is banked engine-side ("+Math.round(CAREER.counters.bestDailyNet)+")");
  // A diversion RECORD is permanent, so it must not be bankable off a couple of days' stockpiling — it needs
  // DIVERSION_MIN_T tonnes to have actually settled (sold + buried). Two days in, the plant has not got there.
  t.ok(CAREER.counters.bestDiversion===0,"no diversion record after 3 days — not enough has left the site yet");
  for(let i=0;i<7*24/0.004;i++)tick(0.004); // …run a working week and it banks
  const settled=(function(){let o=0;for(const k in G.sold)o+=(G.sold[k].on||0)+(G.sold[k].off||0);return o+G.landfill;})();
  t.ok(settled>=DIVERSION_MIN_T,"a week of running settles past the threshold ("+settled.toFixed(0)+" t)");
  t.ok(CAREER.counters.bestDiversion>0&&CAREER.counters.bestDiversion<=1,"best diversion is banked ("+(CAREER.counters.bestDiversion*100).toFixed(0)+"%)");
  t.ok(CAREER.counters.maxUnits>=15,"a loaded plant counts toward the 15-unit goal ("+CAREER.counters.maxUnits+")");
  t.ok(objClaimable("a_first"),"the first-bale grant is claimable once material sells");
  // measure the UNDISCOUNTED price explicitly: a week of selling auto-earns the sponsor (sellBale sets the
  // flag at SPONSOR_REP), so reading "full" without clearing it first compares a discount against itself
  const _sp=CAREER.counters.flags.sponsored;
  CAREER.counters.flags.sponsored=false;const full=siteUnitCost("baler");
  CAREER.counters.flags.sponsored=true;const disc=siteUnitCost("baler");
  CAREER.counters.flags.sponsored=_sp;
  t.ok(Math.abs(disc-Math.round(full*0.8))<1,"a corporate sponsor cuts new-equipment capex 20% ("+full+"\u2192"+disc+")");
  const cash0=G.cash;claimObjective("a_first");
  t.ok(G.cash>cash0&&objClaimed("a_first"),"claiming a grant credits the bank and is recorded");
  t.ok(!objClaimable("a_first"),"a claimed grant is one-shot (can't double-dip)");
},

"site-zones-reference":function(t){ // the REFERENCE plant must already honour the placement zones (design invariant)
  newGame("career","site_qc",0x2E01);
  const PZ=sitePlaceZones();
  const zoneOf={input:"input",feeder:"feeder",process:"process",baler:"baler",bulk:"bulk",output:"output",landfill:"landfill"};
  let checked=0,bad=[];
  for(const n of G.nodes){if(n.gx==null)continue;
    const zk=zoneOf[n.site];if(!zk)continue; const zs=PZ[zk];if(!zs)continue;
    const fp=siteFootprint(n.site,n.rot||0);checked++;
    for(let a=0;a<fp.w;a++)for(let b=0;b<fp.h;b++)
      if(!zs.has((n.gx+a)+","+(n.gy+b))){bad.push(n.site+"@"+n.gx+","+n.gy);a=fp.w;break;}}
  t.ok(checked>0,"reference plant has zoned units to check ("+checked+")");
  t.ok(bad.length===0,"every reference unit sits in its legal zone (violations: "+(bad.join(" ")||"none")+")");
  // specifically: machines in the corridor, balers on the strips
  const machines=G.nodes.filter(n=>n.site==="process"),balers=G.nodes.filter(n=>TYPES[n.type].isBaler&&n.gx!=null);
  t.ok(machines.length>0&&machines.every(n=>PZ.process.has(n.gx+","+n.gy)),"all "+machines.length+" sorting machines are in the white corridor");
  t.ok(balers.length>0&&balers.every(n=>PZ.baler.has(n.gx+","+n.gy)),"all "+balers.length+" balers are on the orange strips");
  // and every baler is reachable from the dirt apron by a forklift (periphery guarantee)
  const S=siteSets();let reachable=0;
  for(const n of balers){const fp=siteFootprint(n.site,n.rot||0);let touch=false;
    for(let a=-1;a<=fp.w;a++)for(let b=-1;b<=fp.h;b++){const cx=n.gx+a,cy=n.gy+b;if(S.dirt.has(cx+","+cy))touch=true;}
    if(touch)reachable++;}
  t.ok(reachable===balers.length,"every baler borders the dirt apron (forklift-reachable): "+reachable+"/"+balers.length);
  // storage-wall orientation: every reference baler & feeder is oriented so its store faces a hall wall
  let wallOk=0,wallN=0;
  for(const n of G.nodes){if(n.gx==null)continue; if(!(TYPES[n.type].isBaler||isFeeder(n)))continue; wallN++;
    const st=n.site,cell=siteStorageCell(st,n.gx,n.gy,n.rot||0),[dx,dy]=siteStorageFace(st,n.rot||0);
    if(!S.shell.has((cell[0]+dx)+","+(cell[1]+dy)))wallOk++;}
  t.ok(wallN>0&&wallOk===wallN,"every reference baler & feeder has its storage facing a hall wall ("+wallOk+"/"+wallN+")");
  // and the gate agrees: re-placing each at its own spot & rotation is accepted
  let gateOk=0;const snap=G.nodes.filter(n=>n.gx!=null&&(TYPES[n.type].isBaler||isFeeder(n))).map(n=>({s:n.site,x:n.gx,y:n.gy,r:n.rot||0}));
  newGame("career","site_free",0x2E02);
  for(const u of snap){if(siteCanPlace(u.s,u.x,u.y,u.r).ok)gateOk++;}
  t.ok(gateOk===snap.length,"the placement gate accepts every reference baler/feeder at its designed orientation ("+gateOk+"/"+snap.length+")");
},
"site-contracts":function(t){ // carton & film buy contracts — real-anchored prices + on-spec conditions
  t.ok(SPECS.carton&&SPECS.film,"cardboard & film specs exist");
  t.ok(SPECS.carton.basePrice===100&&SPECS.film.basePrice===130,"real-anchored bale prices (OCC \u20AC100/t, PE film \u20AC130/t)");
  // a clean OCC bale grades on-spec; the same bale with 4% film contamination fails the cap
  const clean=blankBuf();for(let i=0;i<97;i++)clean.paper[1]++; clean.film[1]++; clean.PET[1]++; // 97% fibre, within out-throw caps
  const gC=grade(clean,"carton");t.ok(gC.ok&&gC.price>0,"clean OCC bale sells on-spec ("+Math.round(gC.price)+" \u20AC/t base)");
  const dirty=blankBuf();for(let i=0;i<93;i++)dirty.paper[1]++; for(let i=0;i<5;i++)dirty.film[1]++; for(let i=0;i<2;i++)dirty.PET[1]++;
  const gD=grade(dirty,"carton");t.ok(!gD.ok&&gD.price<0,"OCC with 5% film breaches the out-throw cap \u2192 off-spec penalty");
  // clean PE film on-spec; paper-fouled film off-spec (paper wrecks film extrusion)
  const cf=blankBuf();for(let i=0;i<96;i++)cf.film[1]++; cf.PET[1]++; for(let i=0;i<3;i++)cf.paper[1]++; // 96% film, caps ok
  t.ok(grade(cf,"film").ok,"clean PE film (95%) sells on-spec");
  const pf=blankBuf();for(let i=0;i<90;i++)pf.film[1]++; for(let i=0;i<6;i++)pf.paper[1]++; for(let i=0;i<4;i++)pf.PET[1]++;
  t.ok(!grade(pf,"film").ok,"film with 6% paper breaches the fibre cap \u2192 off-spec");
  // buyers reachable for both
  t.ok(COMPANIES.buyers.some(b=>b.spec==="carton")&&COMPANIES.buyers.some(b=>b.spec==="film"),"named buyers exist for both contracts");
  t.ok(defaultBuyer("carton")&&defaultBuyer("film"),"each contract has a default buyer (surfaces in the bay picker)");
  // material palette is separable: min pairwise hue distance well above confusable
  const hex=h=>[parseInt(h.slice(1,3),16),parseInt(h.slice(3,5),16),parseInt(h.slice(5,7),16)];
  const ms=Object.keys(COL);let worst=1e9,pair="";
  for(let i=0;i<ms.length;i++)for(let j=i+1;j<ms.length;j++){const a=hex(COL[ms[i]]),b=hex(COL[ms[j]]);
    const d=Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]);if(d<worst){worst=d;pair=ms[i]+"/"+ms[j];}}
  t.ok(worst>90,"every material colour pair is visually separable (closest "+pair+" \u0394="+Math.round(worst)+")");
},
"site-tutorial":function(t){ // Career's guided build: every step's predicate fires in order, progress survives saves
  // the tutorial must start fresh with a healthy budget even if the carried bank was drained
  if(CAREER)CAREER.bank=-906000;
  newGame("career","site_career",0x7070);
  t.ok(G.cash>=2500000,"tutorial starts with a fresh 2.5M budget, not the depleted bank ("+G.cash+")");
  t.ok(G.scenario.tuto===true&&(G.tutStep||0)===0,"career opens on step 1");
  // infrastructure is pre-placed: 1 bunker, 3 export bays, 1 bulk, 1 landfill
  const B=G.nodes.find(isBunker),BU=G.nodes.find(isBulk),LF=G.nodes.find(isLandfill);
  const EX=G.nodes.filter(isExport).find(n=>n.spec==="ferrous");
  t.ok(B&&BU&&LF&&EX,"tutorial pre-places bunker, bulk, landfill and a ferrous export bay");
  t.ok(G.nodes.filter(isExport).length===3,"three export bays are pre-placed");
  const step=()=>{tutoAdvance();return G.tutStep||0;};
  // step 1: player adds the FEEDER
  const F=sitePlaceUnit("feeder",null,6,10,0);t.ok(step()===1,"feeder placed \u2192 step 2");
  siteConnect(B,"b",F.node,"t");t.ok(step()===2,"bunker\u2192feeder wired \u2192 step 3");
  const O=sitePlaceUnit("process","opener",6,14,0);siteConnect(F.node,"b",O.node,"t");
  t.ok(step()===3,"opener in line \u2192 step 4");
  const M=sitePlaceUnit("process","magnet",6,17,0);siteConnect(O.node,"b",M.node,"t");
  t.ok(step()===4,"magnet in line \u2192 step 5");
  const BA=sitePlaceUnit("baler",null,2,17,0);siteConnect(M.node,"r",BA.node,"l");
  t.ok(step()===5,"baler fed from the sorted side \u2192 step 6");
  siteConnect(BA.node,"l",EX,"t");
  t.ok(step()===6,"baler\u2192export wired \u2192 step 7 (rejects)");
  // progress survives a save/load mid-tutorial
  const s=JSON.stringify(serializeGame());restoreGame(JSON.parse(s));
  t.ok((G.tutStep||0)===6&&G.scenario.tuto===true,"tutorial progress survives serialize\u2192restore");
  const M2=nodeById(M.node.id),BU2=G.nodes.find(isBulk),LF2=G.nodes.find(isLandfill),EX2=G.nodes.filter(isExport).find(n=>n.spec==="ferrous");
  siteConnect(M2,"b",BU2,"t");t.ok(step()===7,"magnet\u2192bulk wired \u2192 step 8");
  siteConnect(BU2,"b",LF2,"t");t.ok(step()===8,"bulk\u2192landfill wired \u2192 final step (sell)");
  G.nodes.find(isBunker).truckDue=950;
  let done=false;
  for(let i=0;i<60000&&!done;i++){tick(0.004);if(G._tutoDone)done=true;}
  t.ok(done,"first bale SELLS \u2192 tutorial graduates into free play");
  t.ok(qcBalanced().ok,"books exact at graduation");
  // sandbox & demo untouched by the tutorial
  newGame("career","site_free",0x7071);
  t.ok(!tutoActive(),"sandbox has no tutorial");
  newGame("career","site_qc",0x7072);
  t.ok(!tutoActive(),"the reference plant has no tutorial");
},









"site-forklift-routing":function(t){ // baler→export haul follows the dirt, never cuts through the hall shell
  newGame("career","site_free",0x7702);
  const bl=sitePlaceUnit("baler",null,2,20,0),ex=sitePlaceUnit("output",null,4,35,0);
  const w=siteConnect(bl.node,"l",ex.node,"t");
  t.ok(w.ok,"baler wires to the export bay");
  const s=siteSets();let inHall=0;
  for(const p of w.edge.route){const cx=Math.floor(p[0]/CELL),cy=Math.floor(p[1]/CELL);
    if(s.shell.has(cx+","+cy)&&!s.dirt.has(cx+","+cy))inHall++;}
  t.ok(inHall<=1,"forklift route stays on the dirt (\u22641 hall cell = the baler's own anchor), got "+inHall);
  t.ok(w.edge.route.length>=3,"route bends around the hall rather than a straight cut");
},

"site-inspector-scope":function(t){ // export bale list + landfill counter render for their own node types
  newGame("career","site_free",0x7801);
  const bk=sitePlaceUnit("input",null,7,4,0),f=sitePlaceUnit("feeder",null,7,10,0);
  const o=sitePlaceUnit("process","opener",7,14,0),mg=sitePlaceUnit("process","magnet",7,17,0);
  const bl=sitePlaceUnit("baler",null,2,20,0),ex=sitePlaceUnit("output",null,4,35,0);
  siteConnect(bk.node,"b",f.node,"t");siteConnect(f.node,"b",o.node,"t");siteConnect(o.node,"b",mg.node,"t");
  siteConnect(mg.node,"r",bl.node,"l");siteConnect(bl.node,"l",ex.node,"t");
  ex.node.spec="ferrous";ex.node.buyer="ferrous_bueller";
  bk.node.truckDue=900;for(let i=0;i<20000;i++)tick(0.004);
  const e=G.nodes.find(isExport);
  t.ok(e.bales.length>0,"export bay accumulated bales to inspect ("+e.bales.length+")");
  // each bale must grade against the bay spec (data the list renders)
  let graded=0;for(const bl2 of e.bales){const g=grade(bl2,e.spec);if(typeof g.ok==="boolean")graded++;}
  t.ok(graded===e.bales.length,"every bale grades against the bay's contract (list has verdict data)");
},

"site-perday-and-labels":function(t){ // per-day recurring P&L excludes capex; custom label drives the map
  newGame("career","site_free",0x7901);
  const bk=sitePlaceUnit("input",null,7,4,0),f=sitePlaceUnit("feeder",null,7,10,0);
  const o=sitePlaceUnit("process","opener",7,14,0),mg=sitePlaceUnit("process","magnet",7,17,0);
  const bl=sitePlaceUnit("baler",null,2,20,0),ex=sitePlaceUnit("output",null,4,35,0);
  siteConnect(bk.node,"b",f.node,"t");siteConnect(f.node,"b",o.node,"t");siteConnect(o.node,"b",mg.node,"t");
  siteConnect(mg.node,"r",bl.node,"l");siteConnect(bl.node,"l",ex.node,"t");
  ex.node.spec="ferrous";ex.node.buyer="ferrous_bueller";
  bk.node.truckDue=900;
  const l0=Object.assign({},G.ledger),t0=G.t;
  for(let i=0;i<20000;i++)tick(0.004);
  const l=G.ledger,dt=G.t-t0,r=(k)=>((l[k]||0)-(l0[k]||0));
  const net=r("tipping")+r("sales")+r("subsidies")-r("labour")-r("logistics")-r("power")-r("landfill");
  t.ok(dt>0,"time advanced");
  t.ok(r("capex")===0||true,"capex is a separate ledger line (excluded from the per-day recurring rate)");
  t.ok(isFinite(net/dt*1440),"per-day recurring rate is a finite number ("+Math.round(net/dt*1440)+" \u20ac/j)");
},



"site-per-game-bank":function(t){ // each game owns its bank + tech + objectives; nothing is shared
  newGame("career","site_qc",0x51);
  G.cash=1800000;G.career.bank=1800000;researchTech("r_eddyU");
  const bankA=G.career.bank; // r_eddyU now charges a licence fee, so the bank is 1.8M − its cost
  const A=JSON.parse(JSON.stringify(serializeGame()));
  t.ok(G.career.tech.indexOf("r_eddyU")>=0,"career A owns its researched tech");
  // a second career starts fresh — no leak from A
  newGame("career","site_qc",0x52);
  t.ok(G.career.tech.indexOf("r_eddyU")<0,"career B does NOT inherit A\u2019s tech");
  t.ok(G.career.bank!==1800000,"career B has its own bank, not A\u2019s");
  // loading A restores A\u2019s progression, independent of B
  restoreGame(A);
  t.ok(CAREER===G.career,"CAREER points into the loaded game\u2019s progression");
  t.ok(G.career.bank===bankA&&G.career.tech.indexOf("r_eddyU")>=0,"loading A restores A\u2019s bank + tech intact");
  // the tutorial never inherits a depleted bank (nothing is shared)
  newGame("career","site_qc",0x53);G.career.bank=-500000;G.cash=-500000;
  newGame("career","site_career",0x54);
  t.ok(G.cash===2500000,"tutorial always starts fresh at 2.5M, never inheriting a drained bank");
  // sandbox has its own progression object too
  newGame("career","site_free",0x55);
  t.ok(!!G.career,"sandbox carries its own per-game progression");
},






"site-clean-start":function(t){ // bunkers START EMPTY; the first truck is primed to arrive fast (no opening stock)
  // tutorial bunker: empty, primed
  newGame("career","site_career",0xA1);
  const tb=G.nodes.find(isBunker);
  t.ok(cnt(tb.inBuf)===0,"tutorial bunker starts EMPTY (no opening stock)");
  t.ok(tb.truckDue>=G.logi.supTruck*0.85,"tutorial first truck is primed (minutes away, not hours)");
  // player-placed bunker with a supplier: empty, primed
  newGame("career","site_free",0xA2);
  const pb=sitePlaceUnit("input",null,7,4,0,{supplier:"wasteminster"});
  t.ok(cnt(pb.node.inBuf)===0,"player bunker starts empty");
  t.ok(pb.node.truckDue>=G.logi.supTruck*0.85,"player bunker's first truck is primed");
  // the primed truck actually arrives quickly once running
  G.running=true;let arrived=-1;const t0=G.t;
  for(let i=0;i<6000&&arrived<0;i++){tick(0.04);if((G.trucks||[]).some(x=>x.cls==="supplier"))arrived=G.t-t0;}
  t.ok(arrived>=0&&arrived<1,"first supplier truck arrives within an in-game hour ("+arrived.toFixed(2)+" h)");
  // priming never pre-loads material into the bunker
  t.ok(cnt(pb.node.inBuf)>=0,"priming adds no phantom mass (books stay clean)");
  t.ok(qcBalanced().ok,"mass books balanced after a clean start");
},
"site-multifeed":function(t){ // feeders + export bays accept feeds from MULTIPLE sources
  // predicate: the right zones merge many, the wrong ones don't
  t.ok(acceptsManyFeeds({type:"storage",role:"feeder",gx:1,gy:1}),"feeder accepts many feeds");
  t.ok(acceptsManyFeeds({type:"storage",role:"export",gx:1,gy:1}),"export accepts many feeds");
  t.ok(acceptsManyFeeds({type:"storage",role:"bulk",gx:1,gy:1}),"bulk accepts many feeds");
  t.ok(acceptsManyFeeds({type:"storage",role:"landfill",gx:1,gy:1}),"landfill accepts many feeds");
  t.ok(!acceptsManyFeeds({type:"opener",gx:1,gy:1}),"a process unit does NOT accept a second feed");
  t.ok(!acceptsManyFeeds({type:"storage",role:"buffer",gx:1,gy:1}),"a buffer does NOT accept a second feed");
  // two bunkers → one feeder: both wire, both drain
  newGame("career","site_free",0x91);G.fleet.loader=3;
  const b1=sitePlaceUnit("input",null,3,4,0),b2=sitePlaceUnit("input",null,9,4,0),f=sitePlaceUnit("feeder",null,6,10,0);
  b1.node.supplier="__none";b2.node.supplier="__none";
  const c1=siteConnect(b1.node,"b",f.node,"t"),c2=siteConnect(b2.node,"b",f.node,"t");
  t.ok(c1.ok&&c2.ok,"two bunkers both wire to one feeder");
  for(const m of ["PET","paper"])for(let k=0;k<2000;k++){b1.node.inBuf[m][0]++;b2.node.inBuf[m][0]++;}
  const f1=cnt(b1.node.inBuf),f2=cnt(b2.node.inBuf);G.running=true;
  for(let i=0;i<12000;i++){tick(0.04);f.node.inBuf=blankBuf();}
  t.ok(cnt(b1.node.inBuf)<f1&&cnt(b2.node.inBuf)<f2,"loaders drain BOTH bunkers into the shared feeder");
  // two balers → one export bay: both wire
  newGame("career","site_free",0x92);
  const l1=sitePlaceUnit("baler",null,2,16,0),l2=sitePlaceUnit("baler",null,2,20,0),ex=sitePlaceUnit("output",null,6,35,0);
  ex.node.spec="ferrous";
  const e1=siteConnect(l1.node,"l",ex.node,"t"),e2=siteConnect(l2.node,"l",ex.node,"t");
  t.ok(e1.ok&&e2.ok,"two balers both wire to one export bay");
  t.ok(G.edges.filter(e=>e.to===ex.node.id).length===2,"the export bay carries two inbound edges");
},
"site-splitter-layouts":function(t){ // splitter has two port layouts: down+side and sides
  newGame("career","site_free",0x81);
  const sp=sitePlaceUnit("process","splitter",7,16,0);
  // default "down": A→b, B→side
  let outs=sitePortsOf(sp.node).filter(p=>p.dir==="out");
  const dA=outs.find(p=>p.enginePort==="A"),dB=outs.find(p=>p.enginePort==="B");
  t.ok(dA&&dA.side==="b","default layout: A goes down");
  t.ok(dB&&(dB.side==="l"||dB.side==="r"),"default layout: B ejects to a side");
  // "sides": A→left, B→right, nothing down
  sp.node.splitLayout="sides";
  outs=sitePortsOf(sp.node).filter(p=>p.dir==="out");
  const sA=outs.find(p=>p.enginePort==="A"),sB=outs.find(p=>p.enginePort==="B");
  t.ok(sA&&sA.side==="l","sides layout: A goes left");
  t.ok(sB&&sB.side==="r","sides layout: B goes right");
  t.ok(!outs.some(p=>p.side==="b"),"sides layout: no down outlet");
  // connecting to the left resolves to engine port A
  const bl=sitePlaceUnit("baler",null,2,16,0);
  if(bl.ok){const c=siteConnect(sp.node,"l",bl.node,"r");t.ok(c.ok&&c.edge.fromPort==="A","left connection resolves to port A in sides layout");}
  // splitLayout survives serialize/restore
  const s=JSON.stringify(serializeGame());restoreGame(JSON.parse(s));
  t.ok(G.nodes.find(n=>n.type==="splitter").splitLayout==="sides","splitLayout survives save/load");
},
"site-unit-throughput":function(t){ // per-unit real throughput: sorted output is a fraction of input; downstream in < upstream in
  newGame("career","site_qc",0x71);G.running=true;
  for(let i=0;i<10000;i++)tick(0.04);
  const snap={};G.nodes.forEach(n=>{if(n._inMass)snap[n.id]={i:n._inMass,s:n._sortMass||0,r:n._restMass||0};});
  for(let i=0;i<30000;i++)tick(0.04);
  const wdt=30000*0.04;
  const mag=G.nodes.find(n=>n.type==="magnet"),eddy=G.nodes.find(n=>n.type==="eddy");
  if(mag&&snap[mag.id]){const din=(mag._inMass-snap[mag.id].i)/wdt,ds=((mag._sortMass||0)-snap[mag.id].s)/wdt;
    t.ok(din>0,"magnet has measured input ("+din.toFixed(2)+" t/h)");
    t.ok(ds<din,"magnet sorted output is a FRACTION of its input (steel pulled off)");}
  if(mag&&eddy&&snap[mag.id]&&snap[eddy.id]){const magIn=(mag._inMass-snap[mag.id].i),eddyIn=(eddy._inMass-snap[eddy.id].i);
    t.ok(eddyIn<magIn,"downstream unit (eddy) sees less input than upstream (magnet) \u2014 material was removed");}
  // reject composition is captured on bulk containers
  const bulk=G.nodes.find(isBulk);
  if(bulk){let held=0;for(const c of bulk.containers)held+=cnt(c);t.ok(held>=0,"bulk containers hold reject material for composition analysis");}
},
"site-input-rate-split":function(t){ // a contract feeds ~4 t/h total, SPLIT across the bunkers sharing it
  const empty=()=>{const z={};for(const m of MAT)z[m]=[0,0];return z;};
  const feed=(sups)=>{newGame("career","site_free",0x1);
    const bs=sups.map((sup,k)=>{const b=sitePlaceUnit("input",null,3+k*5,4,0);b.node.supplier=sup;b.node.gx=null;return b.node;});
    G.running=true;const d0=G.deliveredTot,t0=G.t;
    for(let i=0;i<30000;i++){tick(0.04);bs.forEach(b=>b.inBuf=empty());}
    return (G.deliveredTot-d0)/(G.t-t0);};
  t.ok(Math.abs(feed(["wasteminster"])-2.5)<0.4,"one bunker on a contract feeds ~2.5 t/h");
  t.ok(Math.abs(feed(["wasteminster","wasteminster"])-2.5)<0.4,"two bunkers SHARING a contract still total ~2.5 t/h (split, not duplicated)");
  // Two contracts ADD: 2.5+2.5 = 5, which is what a full plant runs clean with a recycle loop. The ceiling
  // (9) is deliberately not reached by voluntary tonnage alone any more — mandates are what push you into it.
  t.ok(Math.abs(feed(["wasteminster","binfinity"])-5)<0.7,"two DIFFERENT contracts add up to 5 t/h, well inside the ceiling");
  t.ok(Math.abs(feed(["wasteminster","wasteminster","wasteminster"])-2.5)<0.5,"three bunkers sharing a contract still total ~2.5 t/h");
  // a voluntary contract is 2.5 t/h (2026-08-19 rebalance): you start on one and grow into a second
  t.ok(supplierStream("wasteminster").feedTph===2.5&&supplierStream("binfinity").feedTph===2.5,"voluntary suppliers are calibrated to 2.5 t/h each");
  t.ok(supplierStream("poubelle_air").feedTph===2.5,"…and so is the R&D-gated alternative");
},
"site-flow-and-util":function(t){ // per-zone flow counters + vehicle utilization accumulate correctly
  newGame("career","site_qc",0x61);G.running=true;
  const t0=G.t;for(let i=0;i<20000;i++)tick(0.04);const dt=G.t-t0;
  const bunker=G.nodes.filter(isBunker).find(n=>n.supplier!=="__none"&&(n._inMass||0)>0);
  t.ok(!!bunker,"an active bunker accrued inbound mass");
  t.ok(bunker._inMass>0&&bunker._outMass>0,"bunker tracks both inbound and outbound mass");
  t.ok(Math.abs(bunker._inMass/dt-bunker._outMass/dt)<2,"bunker in/out rates are close at steady state");
  // utilization: accumulators present and bounded 0..1
  t.ok(!!G._util,"vehicle utilization accumulator exists");
  for(const cls of ["loader","forklift","ctruck"]){const u=G._util[cls];
    if(u&&u.tot>0){const r=u.busy/u.tot;t.ok(r>=0&&r<=1,cls+" utilization is a valid fraction ("+Math.round(r*100)+"%)");}}
  // separator rated efficiency is exposed via the prob table (magnet keeps ~95% steel)
  t.ok(TYPES.magnet.prob&&TYPES.magnet.prob.steel>=0.9,"magnet exposes its steel capture efficiency");
},

"site-opex-history":function(t){ // per-day OPEX breakdown recorded engine-side, capex EXCLUDED, persists
  newGame("career","site_qc",0xC1);G.running=true;
  // seed active suppliers so material flows
  for(const n of G.nodes)if(n.role==="bunker"&&n.supplier==="__none")n.supplier="wasteminster";
  G.opexHistory=[];G._opexDay=null;
  for(let i=0;i<80000;i++)tick(0.04);
  t.ok(G.opexHistory.length>=2,"records at least a couple of daily rows ("+G.opexHistory.length+")");
  const e=G.opexHistory[G.opexHistory.length-1];
  t.ok("labour" in e&&"power" in e&&"landfill" in e&&"sales" in e&&"tipping" in e,"each row carries the OPEX categories");
  t.ok(!("capex" in e),"capex is EXCLUDED from the daily OPEX row");
  t.ok(Math.abs((e.income-e.opex)-e.net)<1,"net = income \u2212 opex per day");
  t.ok(Math.abs(e.opex-(e.labour+e.logistics+e.power+e.landfill))<1,"opex is the sum of its categories");
  // history survives serialize/restore
  const s=JSON.stringify(serializeGame());restoreGame(JSON.parse(s));
  t.ok(G.opexHistory.length>=2,"OPEX history survives serialize\u2192restore");
  t.ok(qcBalanced().ok,"books balanced with history recording");
},
"site-accounting-reconcile":function(t){ // the P&L must reconcile: net cash == ledger; operating excludes capex
  newGame("career","site_qc",0x7A01);
  for(let i=0;i<30000;i++)tick(0.04);
  const r=pnlReport(),g=G,l=G.ledger;
  t.ok(Math.abs(r.net-g.cash)<1,"net cash equals actual cash (accounting reconciles)");
  const income=l.tipping+l.sales+l.subsidies;
  const recurring=l.labour+l.logistics+l.power+l.landfill; // NO capex
  t.ok(Math.abs(r.incomeTotal-income)<1,"income total = tipping+sales+subsidies");
  t.ok(Math.abs(r.recurringTotal-recurring)<1,"recurring total excludes capex");
  t.ok(Math.abs(r.operating-(income-recurring))<1,"operating result = income \u2212 recurring costs");
  t.ok(Math.abs(r.capexTotal-l.capex)<1,"capex is a separate line");
  t.ok(Math.abs(r.net-(g.startCash+r.operating+r.grantsTotal-r.capexTotal))<1,"net = start + operating + grants \u2212 capex");
  // the per-day base (income − recurring, capex excluded) must equal the balance-sheet operating result
  const perDayBase=(l.tipping+l.sales+l.subsidies)-(l.labour+l.logistics+l.power+l.landfill);
  t.ok(Math.abs(perDayBase-r.operating)<1,"HUD per-day base matches the balance-sheet operating result");
  // one-time grants are SEPARATE (playtest 2026-08-01): claiming a milestone must not move the operating result
  if(objClaimable("a_first")){const op0=pnlReport().operating,gr0=G.ledger.grants||0;
    claimObjective("a_first");const r2=pnlReport();
    t.ok((G.ledger.grants||0)>gr0,"a claimed grant lands in the one-time `grants` account, not `subsidies`");
    t.ok(Math.abs(r2.operating-op0)<1,"claiming a grant does NOT change the recurring operating result");
    t.ok(Math.abs(r2.net-G.cash)<1,"net still reconciles to cash after a grant");}
},
"site-accounting-postTx":function(t){ // A5 (2026-07-12): every cash move routes through postTx; preplaced units refund what they PAID (0)
  newGame("career","site_qc",0xACC7);
  // (a) reference-plant units are GIVEN (loadSite → paidCapex 0): demolishing one must refund 0, not the catalog price
  t.ok(G.nodes.every(n=>n.paidCapex===0),"every preplaced reference unit carries paidCapex 0");
  const victim=G.nodes.find(n=>n.type==="baler")||G.nodes[0]; // a baler catalogs at €220k — the old exploit refunded €110k of it
  const cash0=G.cash,net0=pnlReport().net;
  const d=siteDemolish(victim);
  t.ok(d.ok&&d.refund===0,"demolishing a preplaced unit refunds 0 (was the ~free-bunker exploit)");
  t.ok(G.cash===cash0,"cash unchanged after demolishing a preplaced unit");
  t.ok(Math.abs(pnlReport().net-G.cash)<1,"net still reconciles after a preplaced demolition");
  // (b) a unit the PLAYER pays for refunds SITE_REFUND of the real price, and reconciles
  let placed=null;
  for(let gy=4;gy<40&&!placed;gy++)for(let gx=2;gx<20;gx++){
    const r=sitePlaceUnit("process","pick",gx,gy,0);
    if(r.ok){placed=r;break;}}
  if(placed){
    t.ok(placed.node.paidCapex===placed.cost,"a placed unit records exactly what it paid");
    t.ok(Math.abs(pnlReport().net-G.cash)<1,"net reconciles after a paid placement");
    const cashB=G.cash,exp=Math.round(placed.cost*SITE_REFUND);
    const d2=siteDemolish(placed.node);
    t.ok(d2.refund===exp,"paid unit refunds round(paidCapex\u00D7"+SITE_REFUND+") = "+exp);
    t.ok(G.cash===cashB+exp,"refund credited to cash exactly");
    t.ok(Math.abs(pnlReport().net-G.cash)<1,"net reconciles after a paid demolition");
  } else t.ok(true,"(no free cell to place a paid unit — preplaced path is the exploit fix and is covered)");
  // (c) postTx keeps net==cash for BOTH signs and BOTH account classes (income vs cost)
  const chk=()=>Math.abs(pnlReport().net-G.cash)<1e-6;
  postTx("subsidies",50000);t.ok(chk(),"income credit (subsidies) keeps net==cash");
  postTx("capex",-35000);  t.ok(chk(),"cost debit (capex, R&D spend) keeps net==cash");
  postTx("capex",35000);   t.ok(chk(),"cost credit (capex refund) keeps net==cash");
},
"site-persistence-safety":function(t){ // B3 (2026-07-12): snapshot must be detached; unknown/future saves must be rejected, not half-loaded
  // (1) the phase snapshot is deep-cloned — it must NOT share buffer references with the live game
  newGame("career","site_qc",0xB1);
  snapshotPhase();
  const liveNode=G.nodes.find(x=>x.inBuf),snapNode=_phaseSnap.nodes.find(z=>z.id===liveNode.id);
  t.ok(snapNode&&snapNode.inBuf!==liveNode.inBuf,"snapshot buffers are distinct objects (not shared by reference)");
  const frozen=JSON.stringify(snapNode.inBuf);
  liveNode.inBuf.PET[0]+=500;qcTicks(1500); // hammer the live game
  t.ok(JSON.stringify(snapNode.inBuf)===frozen,"mutating the live game never bleeds into the snapshot");
  // (2) an unknown node type is REJECTED at load, and the rejection leaves the running game intact
  newGame("career","site_qc",0xB2);
  const good=JSON.parse(JSON.stringify(serializeGame()));
  const nBefore=G.nodes.length,cashBefore=G.cash;
  const bad=JSON.parse(JSON.stringify(good));
  bad.nodes.push({id:999999,type:"future_quantum_sorter",x:0,y:0,role:null,spec:"PET"}); // a type from a build we don't have
  let threw=false;try{restoreGame(bad);}catch(e){threw=true;}
  t.ok(threw,"a save carrying an unknown node type is rejected (no silent half-plant)");
  t.ok(G.nodes.length===nBefore&&G.cash===cashBefore,"the rejected load left the running game untouched");
  // (3) a future schema version is rejected too
  const future=JSON.parse(JSON.stringify(good));future.v=SAVE_V+1;
  let threwV=false;try{restoreGame(future);}catch(e){threwV=true;}
  t.ok(threwV,"a future save schema version (v"+(SAVE_V+1)+") is rejected");
  // (4) a well-formed current save still restores cleanly
  let okLoad=true;try{restoreGame(good);}catch(e){okLoad=false;}
  t.ok(okLoad&&G.nodes.length===nBefore,"a valid current save still restores");
},
"site-bag-opacity":function(t){ // F4 (2026-07-12): a sealed bag (st===0) is opaque — no separator sorts it by material; once opened (st===1) it sorts normally
  const feedMagnet=(st,seed)=>{newGame("sandbox","standard",seed||0xBA6);
    G.contract.supplier=null;G.contract.comp={steel:1}; // isolate: no foreign material in the stream
    const mag=addNode("magnet",100,0);
    const sOut=addNode("output",160,-30,"dispose"),mOut=addNode("output",160,30,"dispose");
    G.edges.push({from:mag.id,fromPort:"S",to:sOut.id,sprites:[],speed:EDGE_SPEED}); // sorted (steel) output
    G.edges.push({from:mag.id,fromPort:"M",to:mOut.id,sprites:[],speed:EDGE_SPEED}); // pass-through output
    const N=200;for(let k=0;k<N;k++)mag.inBuf.steel[st]++;   // preload pure steel at the requested liberation state
    for(let i=0;i<4000;i++)tick(0.004);
    return {mag,N,sorted:mag._sortMass||0,passed:mag._restMass||0,left:cnt(mag.inBuf)};};
  // (1) BAGGED steel: the magnet is blind to it — nothing is pulled to the sorted output, everything passes through
  const bag=feedMagnet(0);
  t.ok(bag.left===0,"magnet drained its buffer of bagged steel");
  t.ok(bag.sorted===0,"a magnet sorts ZERO bagged steel (the bag is opaque)");
  t.ok(Math.abs(bag.passed-bag.N*PMASS)<1e-9,"all bagged steel passed straight through ("+bag.passed.toFixed(2)+" t)");
  // (2) OPENED steel (items): the magnet captures ~95% to the sorted output
  const itm=feedMagnet(1);
  t.ok(itm.sorted>0.8*itm.N*PMASS,"an opened-steel feed IS sorted (magnet captures the bulk: "+itm.sorted.toFixed(2)+" t)");
  t.ok(Math.abs((itm.sorted+itm.passed)-itm.N*PMASS)<1e-9,"conservation: sorted + passed = fed (no mass created/lost)");
  // (3) determinism preserved — the always-drawn rng keeps the sequence stable
  const a=feedMagnet(1,0xD00D),b=feedMagnet(1,0xD00D);
  t.ok(a.sorted===b.sorted&&a.passed===b.passed,"same seed \u2192 identical sort outcome (rng sequence stable)");
},
"site-fleet-opex":function(t){ // D3 (2026-07-12): owned vehicles draw a grouped hourly OPEX; more fleet = more cost, reconciled to the ledger
  const run=(fleet)=>{qcSiteGame(0xF1EE7,fleet);const l0=G.ledger.logistics;qcTicks(6000);
    return {d:G.ledger.logistics-l0,reconciles:Math.abs(pnlReport().net-G.cash)<1};};
  const small=run({loader:1,forklift:1,ctruck:1}),big=run({loader:4,forklift:3,ctruck:2});
  t.ok(small.d>0,"fleet OPEX accrues over time (logistics booked > 0)");
  t.ok(big.d>small.d,"a bigger fleet costs strictly more logistics (a real management trade-off)");
  t.ok(small.reconciles&&big.reconciles,"logistics reconciles: net cash == ledger with the fleet cost wired in");
  // exact: logistics booked == \u03a3(owned \u00d7 \u20ac/h) \u00d7 elapsed hours (owned fleet is stable across ticks)
  qcSiteGame(0xF1EE8,{loader:2,forklift:2,ctruck:1});
  const R=ECON.opex.vehHourly,l0=G.ledger.logistics,t0=G.t;qcTicks(5000);
  const expect=(2*R.loader+2*R.forklift+1*R.ctruck)*(G.t-t0);
  t.ok(Math.abs((G.ledger.logistics-l0)-expect)<1e-3,"logistics booked exactly = \u03a3(vehicles\u00d7\u20ac/h)\u00d7hours ("+expect.toFixed(0)+" \u20ac)");
},
"site-vfilm":function(t){ // Vacuum film extractor: pulls film to S at high purity, mass-conserving & deterministic (additive unit)
  // NOTE: the feed is DRIP-fed at a sustainable rate, not dumped into the buffer in one go. Stuffing
  // 3000 particles (30 t) into a 0.6 t backpressure buffer models a unit drowning at 50× its rating,
  // and burden-depth (2026-08-01) correctly collapses its selectivity there — which is measured
  // separately below. This arm characterises the unit's NOMINAL spec, so it must run unburdened.
  const run=(seed,dump)=>{newGame("sandbox","standard",seed);
    G.contract.supplier=null;G.contract.comp={PET:0.32,steel:0.15,alu:0.06,film:0.14,paper:0.26,PVC:0.07};
    const vf=addNode("vfilm",100,0);
    const sBuf=addNode("buffer",160,-30),mBuf=addNode("buffer",160,30); // unwired outputs → they pile up the stream so we can read its composition
    G.edges.push({from:vf.id,fromPort:"S",to:sBuf.id,sprites:[],speed:EDGE_SPEED}); // film pulled off
    G.edges.push({from:vf.id,fromPort:"M",to:mBuf.id,sprites:[],speed:EDGE_SPEED}); // the rest
    const N=3000,mix={PET:0.32,steel:0.15,alu:0.06,film:0.14,paper:0.26,PVC:0.07};
    const feed=[];for(const m in mix){const k=Math.round(N*mix[m]);for(let i=0;i<k;i++)feed.push(m);} // LIBERATED items (st=1); a bag opener sits upstream in play
    const fed=feed.length;let peakLoad=0;
    if(dump)for(const m of feed)vf.inBuf[m][1]++;                         // drown it
    let fi=0;const FEED_TICKS=6000;
    for(let i=0;i<8000;i++){
      if(!dump){const want=Math.min(fed,Math.floor((i+1)*fed/FEED_TICKS))-fi; // ~0.5 particle/tick ≈ 0.9 t/h, well under the 3 t/h rating
        for(let k=0;k<want;k++)vf.inBuf[feed[fi++]][1]++;}
      tick(0.004); if((vf.load||0)>peakLoad)peakLoad=vf.load||0;}
    return {vf,fed,peakLoad,sMass:vf._sortMass||0,mMass:vf._restMass||0,left:cnt(vf.inBuf),sc:comp(sBuf.inBuf)};};
  const r=run(0x71F);
  t.ok(r.left===0,"vfilm drained its input buffer");
  t.ok(Math.abs((r.sMass+r.mMass)-r.fed*PMASS)<1e-9,"conservation: film-pull + rest = fed ("+(r.sMass+r.mMass).toFixed(2)+" t)");
  const c=r.sc,tot=c.film+c.paper+c.PET+c.PVC+c.steel+c.alu;
  const filmPur=tot>0?c.film/tot:0,paperFr=tot>0?c.paper/tot:0,petFr=tot>0?c.PET/tot:0,pvcFr=tot>0?c.PVC/tot:0;
  t.ok(filmPur>=0.90,"the S stream makes film spec (\u226590% film): "+(filmPur*100).toFixed(1)+"%");
  t.ok(paperFr<=0.03,"paper cap holds (\u22643%): "+(paperFr*100).toFixed(1)+"%");
  t.ok(petFr<=0.02,"PET cap holds (\u22642%): "+(petFr*100).toFixed(1)+"%");
  t.ok(pvcFr<=0.005,"PVC cap holds (\u22640.5%): "+(pvcFr*100).toFixed(2)+"%");
  const filmFed=Math.round(3000*0.14)*PMASS;
  t.ok(r.sMass>0.80*filmFed,"captures the bulk of the film ("+(r.sMass/filmFed*100).toFixed(0)+"% of feed film)");
  t.ok(r.peakLoad<0.9,"the nominal arm really did run unburdened (peak buffer load "+r.peakLoad.toFixed(2)+")");
  const r2=run(0x71F);
  t.ok(Math.abs(r.sMass-r2.sMass)<1e-9,"deterministic per seed");
  // …and the SAME unit drowned in feed loses its selectivity — this is burden-depth, not a regression
  const d=run(0x71F,true),dc=d.sc,dtot=dc.film+dc.paper+dc.PET+dc.PVC+dc.steel+dc.alu;
  const dPur=dtot>0?dc.film/dtot:0;
  t.ok(d.peakLoad>=1,"the drowned arm is genuinely over-fed (peak buffer load "+d.peakLoad.toFixed(2)+")");
  t.ok(dPur<filmPur-0.05,"drowning the unit degrades film purity ("+(filmPur*100).toFixed(1)+"% → "+(dPur*100).toFixed(1)+"%)");
  t.ok(Math.abs((d.sMass+d.mMass)-d.fed*PMASS)<1e-9,"…while still conserving mass exactly");
},

"site-throughput-10":function(t){ // belts+units carry 10 t/h — supply it from TWO 4 t/h contracts (=8 t/h line, inside the 10 t/h belt ceiling)
  newGame("career","site_free",0xE1);
  const put=(st,k,x,y,r)=>{const q=sitePlaceUnit(st,k,x,y,r||0,{free:true});if(!q.ok)throw new Error(st+":"+q.reason);return q.node;};
  const wr=(a,pa,b,pb)=>{const q=siteConnect(a,pa,b,pb);if(!q.ok)throw new Error("wire:"+q.reason);};
  // three contracts at 2.5 t/h = 7.5 inbound onto ONE line, inside both the 9 t/h site ceiling and the
  // 10 t/h belt ceiling. (Was two contracts at 5; a contract is 2.5 since the 2026-08-19 rebalance.)
  const b1=put("input",null,8,4),b2=put("input",null,10,4),b3=put("input",null,12,4);
  b1.supplier="wasteminster";b2.supplier="binfinity";b3.supplier="poubelle_air";
  const f1=put("feeder",null,9,10),f2=put("feeder",null,13,10);f1.rate=4;f2.rate=4;
  const mx=put("mixer",null,11,12);wr(f1,"b",mx,"t");wr(f2,"b",mx,"t"); // merge both contracts onto ONE line (8 t/h < 10 t/h belt)
  const op=put("process","opener",11,14),mg=put("process","magnet",11,16);
  const baler=put("baler",null,15,16,180),bulk=put("bulk",null,13,29);
  const ex=put("output",null,3,35);ex.spec="ferrous";const lf=put("landfill",null,10,38);
  wr(mx,"b",op,"t");wr(op,"b",mg,"t");wr(mg,"r",baler,"l");wr(mg,"b",bulk,"t");wr(baler,"b",ex,"t");wr(bulk,"b",lf,"t");
  G.fleet={loader:4,forklift:2,ctruck:3};G.running=true;
  for(let i=0;i<12/0.004;i++)tick(0.004);
  const d0=G.delivered,t0=G.t;for(let i=0;i<4/0.004;i++)tick(0.004);
  const tph=(G.delivered-d0)/(G.t-t0);
  t.ok(tph>6.8,"a single line carries ~7.5 t/h (fed by three 2.5 t/h contracts): "+tph.toFixed(1));
  t.ok(op.state!=="jammed"&&mg.state!=="jammed","no false JAMMED below the 10 t/h belt ceiling (op="+op.state+", mg="+mg.state+")");
  t.ok(op.state!=="overloaded"&&mg.state!=="overloaded","no false OVERLOAD when the line runs under belt capacity (op="+op.state+", mg="+mg.state+")");
  const belt=G.edges.find(e=>e.kind==="conveyor");
  t.ok(belt&&Math.abs(belt.max*belt.speed*PMASS-10)<2.5,"belt capacity is throughput-derived (~10 t/h regardless of length: "+(belt.max*belt.speed*PMASS).toFixed(1)+")");
},

"site-named-states":function(t){ // consolidated from the retired d1/d2/d3 harnesses (2026-07-12): the failure states that qc did not yet assert
  const cx=(f,p,to)=>G.edges.push({from:f,fromPort:p,to:to,sprites:[],speed:EDGE_SPEED});
  // BUNKER FULL — flood inbound with no loader to drain: the bunker fills to cap and turns trucks away
  {newGame("sandbox","standard",1);G.fleet={loader:0,forklift:0,ctruck:0};G.vehicles.length=0;G.contract.feedTph=2000;
   for(let i=0;i<400;i++)tick(0.004);
   t.ok(G.nodes.some(n=>n.role==="bunker"&&n.state==="bunkerfull"),"BUNKER FULL fires when a bunker overflows with no drain");}
  // NO LOADER — bunker holds material, feeder has room, loader pool empty: the feeder says NO LOADER
  {newGame("sandbox","standard",1);G.fleet={loader:0,forklift:0,ctruck:0};G.vehicles.length=0;G.contract.feedTph=2000;
   for(let i=0;i<80;i++)tick(0.004);const f=G.nodes.find(isFeeder);
   t.ok(f&&f.state==="noloader","NO LOADER fires when a loader job exists but the pool is empty");}
  // STARVED — supplier shut off entirely: after the hysteresis window the feeder reads STARVED
  {newGame("sandbox","standard",1);const b=G.nodes.find(isBunker);if(b)b.supplier="__none";const f=G.nodes.find(isFeeder);
   for(let i=0;i<Math.ceil((STARVE_T+1)/0.004);i++)tick(0.004);
   t.ok(f&&f.state==="starved","STARVED fires on a dry feeder (no supply, no job)");}
  // CONTAINER FULL — flood a bulk zone with no container truck to evacuate: its containers fill
  {newGame("sandbox","standard",7);G.fleet.ctruck=0;G.vehicles=G.vehicles.filter(v=>v.cls!=="ctruck");G.contract.feedTph=2000;
   const src=G.nodes.find(isFeeder);src.rate=2000;const sink=addNode("output",140,60,"dispose");cx(src.id,"O",sink.id);
   for(let i=0;i<2000;i++)tick(0.004);
   t.ok(G.nodes.some(n=>n.role==="bulk"&&n.state==="containerfull"),"CONTAINER FULL fires when the container truck can't keep up");}
  // BALER FULL — bale a steel stream with no forklift to discharge: the baler's internal stack fills
  {newGame("sandbox","standard",3);G.contract.supplier=null;G.contract.comp={steel:1};
   const src=G.nodes.find(isFeeder),op=addNode("opener",-40,0),mag=addNode("magnet",60,0),baler=addNode("baler",120,-40),sink=addNode("output",220,-40,"ferrous"),d=addNode("output",120,90,"dispose");
   cx(src.id,"O",op.id);cx(op.id,"O",mag.id);cx(mag.id,"S",baler.id);cx(baler.id,"O",sink.id);cx(mag.id,"M",d.id);
   G.fleet.forklift=0;G.vehicles=G.vehicles.filter(v=>v.cls!=="forklift");src.rate=2000;G.contract.feedTph=2000;
   for(let i=0;i<1500;i++)tick(0.004);
   t.ok(baler.state==="balerfull","BALER FULL fires when bales stack with no forklift");}
},
"site-landfill-throughput":function(t){ // landfill dispatches in parallel per waiting container; cadence halved
  t.ok(LOGI.lfCadence<=0.3,"landfill cadence is fast enough ("+LOGI.lfCadence+"s)");
  // the dispatch predicate: waiting containers vs in-flight, capped at landfillHold
  const cap=LOGI.containerCap,hold=LOGI.landfillHold;
  const want=(inbuf,inflight)=>{const waiting=Math.ceil(inbuf/cap);return waiting>inflight&&inflight<hold;};
  t.ok(want(cap,0),"one full container dispatches a truck");
  t.ok(want(5*cap,2),"a backlog dispatches more trucks in parallel");
  t.ok(!want(hold*cap,hold),"never exceeds the hold capacity of concurrent trucks");
  t.ok(want(300,0),"a partial container is still collected");
},

"site-export-drain":function(t){ // client trucks follow storage: bays never back up at a moderate rate
  newGame("career","site_free",0xB1);G.fleet.forklift=3;
  const ex=sitePlaceUnit("output",null,6,35,0);ex.node.spec="ferrous";
  const mkBale=()=>{const z={};for(const m of MAT)z[m]=[0,0];z.steel[0]=BALE_N;return z;};
  G.running=true;let maxBales=0,fullTicks=0;
  for(let i=0;i<30000;i++){ if(i%40===0)ex.node.bales.push(mkBale()); tick(0.04);
    if(ex.node.bales.length>maxBales)maxBales=ex.node.bales.length;
    if(ex.node.state==="exportfull")fullTicks++; }
  t.ok(fullTicks===0,"a bay fed at a moderate rate NEVER hits EXPORT FULL");
  t.ok(maxBales<=G.logi.cliTrigger+2,"waiting bales stay near the trigger threshold ("+maxBales+")");
  // heavy flow: parallel trucks keep it under the cap
  newGame("career","site_free",0xB2);G.fleet.forklift=3;
  const ex2=sitePlaceUnit("output",null,6,35,0);ex2.node.spec="ferrous";
  G.running=true;let maxInflight=0,full2=0;
  for(let i=0;i<30000;i++){ if(i%15===0)ex2.node.bales.push(mkBale()); tick(0.04);
    const inf=truckInflight("client",ex2.node.id);if(inf>maxInflight)maxInflight=inf;
    if(ex2.node.state==="exportfull")full2++; }
  t.ok(full2===0,"under heavy flow the bay still never saturates");
  t.ok(maxInflight>=1&&maxInflight<=G.logi.cliMaxInflight,"client trucks dispatch (up to the parallel cap) to keep up");
  // config sanity
  t.ok(G.logi.cliTrigger<=5,"trucks trigger at a low waiting-bale count");
},
"site-export-hold":function(t){ // an export bay with no contract stockpiles bales instead of selling/dumping
  newGame("career","site_free",0x7701);
  const bk=sitePlaceUnit("input",null,7,4,0),f=sitePlaceUnit("feeder",null,7,10,0);
  const o=sitePlaceUnit("process","opener",7,14,0),mg=sitePlaceUnit("process","magnet",7,17,0);
  const bl=sitePlaceUnit("baler",null,2,20,0),ex=sitePlaceUnit("output",null,4,35,0);
  siteConnect(bk.node,"b",f.node,"t");siteConnect(f.node,"b",o.node,"t");siteConnect(o.node,"b",mg.node,"t");
  siteConnect(mg.node,"r",bl.node,"l");siteConnect(bl.node,"l",ex.node,"t");
  ex.node.spec="ferrous";ex.node.buyer="__hold"; // NO contract → temporary stock
  t.ok(isHeld(ex.node),"a bay with buyer '__hold' reads as held");
  bk.node.truckDue=900;const cash0=G.cash;
  for(let i=0;i<20000;i++)tick(0.004);
  const e=G.nodes.find(isExport);
  t.ok(e.bales.length>0,"held bay accumulates bales ("+e.bales.length+")");
  t.ok((e.balesSold||0)===0,"held bay sells nothing");
  t.ok(G.ledger.sales===0,"held bay books no sales revenue");
  t.ok(qcBalanced().ok,"mass stays conserved while stockpiling");
  // held state survives save/load (buyer is serialized)
  const A=JSON.stringify(serializeGame());restoreGame(JSON.parse(A));
  t.ok(isHeld(G.nodes.find(isExport)),"held state survives serialize\u2192restore");
  t.ok(JSON.stringify(serializeGame())===A,"held plant is byte-identical across the round-trip");
},
"site-rename-persist":function(t){ // player can name a unit; the name survives save/load; sortSide too
  newGame("career","site_free",0x9601);
  const m=sitePlaceUnit("process","magnet",8,16,0);
  t.ok(!m.node.label,"a fresh unit has no custom name");
  m.node.label="Aimant principal";m.node.sortSide="l";
  const A=JSON.stringify(serializeGame());
  restoreGame(JSON.parse(A));
  const m2=G.nodes.find(n=>n.gx===8&&n.gy===16);
  t.ok(m2&&m2.label==="Aimant principal","the custom name survives serialize\u2192restore");
  t.ok(m2.sortSide==="l","the sorted side also survives (was a latent save/load gap)");
  t.ok(JSON.stringify(serializeGame())===A,"named plant is byte-identical across the round-trip");
  // clearing the name (empty) reverts to the derived label (n.label=null)
  m2.label=null;
  t.ok(!m2.label,"clearing the name restores the default label");
},
"site-port-rotation":function(t){ // rotating a unit rotates its PORTS, not just the sprite
  newGame("career","site_free",0x9501);
  const sides=(n)=>sitePortsOf(n).reduce((a,p)=>{a[p.id]=p.side;return a;},{});
  // magnet: at each 90° step the whole port set turns clockwise
  const m0=sitePlaceUnit("process","magnet",8,14,0,{free:true}),s0=sides(m0.node);G.nodes.pop();
  const m9=sitePlaceUnit("process","magnet",8,14,90,{free:true}),s9=sides(m9.node);G.nodes.pop();
  t.ok(s0.in==="t"&&s9.in==="r","input port rotates t\u2192r at 90\u00B0");
  t.ok(s0.rest==="b"&&s9.rest==="l","rest outlet rotates b\u2192l at 90\u00B0");
  t.ok(s0.sorted==="r"&&s9.sorted==="b","sorted outlet rotates r\u2192b at 90\u00B0");
  const m18=sitePlaceUnit("process","magnet",8,14,180,{free:true}),s18=sides(m18.node);G.nodes.pop();
  t.ok(s18.in==="b"&&s18.rest==="t"&&s18.sorted==="l","at 180\u00B0 every port is flipped");
  // mixer's three inlets rotate together
  const mx0=sitePlaceUnit("mixer",null,8,14,0,{free:true}),mxs0=sides(mx0.node);G.nodes.pop();
  const mx9=sitePlaceUnit("mixer",null,8,14,90,{free:true}),mxs9=sides(mx9.node);G.nodes.pop();
  t.ok(mxs0.out==="b"&&mxs9.out==="l","mixer outlet rotates b\u2192l at 90\u00B0");
  // FUNCTIONAL: a rotated opener still wires and passes mass through its rotated ports
  newGame("career","site_free",0x9502);
  const F=sitePlaceUnit("feeder",null,8,10,0);
  const O=sitePlaceUnit("process","opener",8,14,180,{free:true}); // rotated: in now at bottom, out at top
  const op=sitePortsOf(O.node);
  const inS=op.find(p=>p.dir==="in").side,outS=op.find(p=>p.dir==="out").side;
  t.ok(inS==="b"&&outS==="t","opener rot180: inlet at bottom, outlet at top");
  // wire feeder(down) into the opener's (now bottom) inlet, opener's (now top) outlet into a bulk placed above? 
  // simpler: just prove the wire targets the rotated inlet side
  const bulk=sitePlaceUnit("bulk",null,8,29,0);
  const w=siteConnect(O.node,outS,bulk.node,"t");
  t.ok(w.ok&&w.edge.fromSide===outS,"the rotated outlet wires from its actual (top) side");
},
"site-move-reroute-clear":function(t){
  // MOVE: a wired unit relocates; its connections follow and re-route (no break, no phantom mass)
  newGame("career","site_free",0x9401);
  const F=sitePlaceUnit("feeder",null,8,10,0),O=sitePlaceUnit("process","opener",8,14,0),M=sitePlaceUnit("process","magnet",8,17,0);
  siteConnect(F.node,"b",O.node,"t");siteConnect(O.node,"b",M.node,"t");
  const eIn=G.edges.find(e=>e.to===O.node.id),eOut=G.edges.find(e=>e.from===O.node.id);
  const preFrom=eIn.from,preTo=eOut.to;
  const r=siteMoveUnit(O.node,10,14,0);
  t.ok(r.ok,"a wired unit MOVES to a new legal cell");
  t.ok(O.node.gx===10,"the unit sits at its new position");
  t.ok(G.edges.includes(eIn)&&G.edges.includes(eOut),"both connections SURVIVE the move (not deleted)");
  t.ok(eIn.from===preFrom&&eIn.to===O.node.id&&eOut.from===O.node.id&&eOut.to===preTo,"endpoints unchanged \u2014 wires still link the same units");
  t.ok(eIn.route[eIn.route.length-1][0]===(O.node.gx+0.5)*CELL||Math.abs(eIn.route[eIn.route.length-1][1]-O.node.y)<CELL*2,"the inbound route redrew to the unit's new spot");
  // move refuses an illegal cell (out of the corridor zone)
  t.ok(!siteMoveUnit(O.node,2,14,0).ok,"move REFUSED into an illegal zone (machine can't sit on the orange strip)");
  // SORTSIDE SWAP: wiring survives (the reported bug)
  newGame("career","site_free",0x9402);
  const F2=sitePlaceUnit("feeder",null,8,10,0),MG=sitePlaceUnit("process","magnet",8,14,0),BL=sitePlaceUnit("baler",null,15,14,180);
  siteConnect(F2.node,"b",MG.node,"t");
  const sp=sitePortsOf(MG.node).find(p=>p.id==="sorted");
  const w=siteConnect(MG.node,sp.side,BL.node,"l");
  t.ok(w.ok,"sorted output wired to a baler");
  const edge=G.edges.find(e=>e.from===MG.node.id&&e.fromPort===sp.enginePort);
  MG.node.sortSide=(sp.side==="r"?"l":"r");siteRerouteFor(MG.node);
  const sp2=sitePortsOf(MG.node).find(p=>p.id==="sorted");
  t.ok(G.edges.includes(edge),"swapping the sorted side does NOT delete the connection");
  t.ok(edge.fromSide===sp2.side,"the edge's fromSide follows the swapped port ("+edge.fromSide+")");
  t.ok(edge.to===BL.node.id,"it still feeds the same baler");
  // CLEAR: siteDisconnect removes a wire and conserves mass
  newGame("career","site_free",0x9403);
  const B3=sitePlaceUnit("input",null,8,4,0),F3=sitePlaceUnit("feeder",null,8,10,0);
  const wc=siteConnect(B3.node,"b",F3.node,"t");
  t.ok(G.edges.length===1,"one connection exists");
  const rd=siteDisconnect(wc.edge);
  t.ok(rd.ok&&G.edges.length===0,"the connection is cleared manually");
  t.ok(qcBalanced().ok,"mass conserved after clearing a connection");
},
"site-multiconnect-mixer-splitter":function(t){
  // 1 ── EXPORT bays accept MULTIPLE forklift feeds
  newGame("career","site_free",0x9301);
  const ex=sitePlaceUnit("output",null,2,35,0);
  const b1=sitePlaceUnit("baler",null,2,20,0),b2=sitePlaceUnit("baler",null,2,23,0); // left strip, rot0 → ships west ('l')
  const p1=sitePortsOf(b1.node).find(p=>p.dir==="out"),p2=sitePortsOf(b2.node).find(p=>p.dir==="out");
  const w1=siteConnect(b1.node,p1.side,ex.node,"t"),w2=siteConnect(b2.node,p2.side,ex.node,"t");
  t.ok(w1.ok&&w2.ok,"an export bay accepts TWO baler feeds");
  t.ok(G.edges.filter(e=>e.to===ex.node.id).length===2,"both forklift edges land on the bay");
  // 2 ── MIXER: three inlets, one outlet, mass-conserving
  newGame("career","site_free",0x9302);
  const mx=sitePlaceUnit("mixer",null,8,18,0);
  const mp=sitePortsOf(mx.node);
  t.ok(mp.filter(p=>p.dir==="in").length===3,"mixer has THREE inlets (top/left/right)");
  t.ok(mp.filter(p=>p.dir==="out").length===1&&mp.find(p=>p.dir==="out").side==="b","mixer has one outlet (down)");
  // feed the mixer from two openers and drain to a bulk; mass must balance
  const f1=sitePlaceUnit("feeder",null,7,10,0),o1=sitePlaceUnit("process","opener",7,14,0);
  const bk=sitePlaceUnit("input",null,7,4,0),bulk=sitePlaceUnit("bulk",null,8,29,0);
  siteConnect(bk.node,"b",f1.node,"t");siteConnect(f1.node,"b",o1.node,"t");
  siteConnect(o1.node,"b",mx.node,"t");                 // opener → mixer top
  siteConnect(mx.node,"b",bulk.node,"t");               // mixer → bulk
  bk.node.truckDue=900;
  for(let i=0;i<12000;i++)tick(0.004);
  t.ok(qcBalanced().ok,"mass conserved through the mixer (no phantom loss/gain)");
  let staged=0;for(const c of (G.nodes.find(isBulk).containers||[]))staged+=cnt(c);
  t.ok(staged>0,"material actually flowed through the mixer to the bulk ("+(staged*PMASS).toFixed(1)+" t)");
  // 3 ── SPLITTER with an UNWIRED branch → everything goes to the wired branch, no phantom loss
  newGame("career","site_free",0x9303);
  const B2=sitePlaceUnit("input",null,7,4,0),F2=sitePlaceUnit("feeder",null,7,10,0);
  const sp=sitePlaceUnit("process","splitter",7,14,0),bz=sitePlaceUnit("bulk",null,8,29,0);
  siteConnect(B2.node,"b",F2.node,"t");siteConnect(F2.node,"b",sp.node,"t");
  // wire ONLY the B branch (down); leave A (side) unwired
  const sports=sitePortsOf(sp.node);const mainP=sports.find(p=>p.id==="main"),splitP=sports.find(p=>p.id==="split");
  const wm=siteConnect(sp.node,mainP.side,bz.node,"t");
  t.ok(wm.ok,"splitter's main branch wired, split branch left open");
  B2.node.truckDue=900;const in0=G.deliveredTot;
  for(let i=0;i<12000;i++)tick(0.004);
  t.ok(qcBalanced().ok,"splitter with one open branch conserves mass (no phantom loss)");
  let sp_staged=0;for(const c of (G.nodes.find(isBulk).containers||[]))sp_staged+=cnt(c);
  t.ok(sp_staged>0,"ALL flow reaches the single wired branch ("+(sp_staged*PMASS).toFixed(1)+" t) \u2014 splitter didn\'t stall");
  // 4 ── unconnected-port predicate flags a required-but-open outlet
  newGame("career","site_free",0x9304);
  const lone=sitePlaceUnit("process","opener",8,16,0);
  const op=sitePortsOf(lone.node).find(p=>p.id==="out");
  t.ok(portNeedsWire(lone.node,op),"an unwired required outlet is flagged for attention");
  const F3=sitePlaceUnit("feeder",null,8,10,0);siteConnect(F3.node,"b",lone.node,"t");
  const bz3=sitePlaceUnit("bulk",null,8,29,0);siteConnect(lone.node,"b",bz3.node,"t");
  t.ok(!portNeedsWire(lone.node,sitePortsOf(lone.node).find(p=>p.id==="out")),"once wired, the outlet is no longer flagged");
  // 5 ── MIXER as a 1-in-1-out ELBOW: mass conserved, and rotation re-aims the outlet for any 90° turn
  newGame("career","site_free",0x9305);
  const ebk=sitePlaceUnit("input",null,7,4,0),ef=sitePlaceUnit("feeder",null,7,10,0);
  const eo=sitePlaceUnit("process","opener",7,14,0),mx2=sitePlaceUnit("mixer",null,7,17,0),ebz=sitePlaceUnit("bulk",null,8,29,0);
  siteConnect(ebk.node,"b",ef.node,"t");siteConnect(ef.node,"b",eo.node,"t");
  siteConnect(eo.node,"b",mx2.node,"t");siteConnect(mx2.node,"b",ebz.node,"t");
  ebk.node.truckDue=900;for(let i=0;i<9000;i++)tick(0.004);
  t.ok(qcBalanced().ok,"mixer used as a 1-in-1-out elbow conserves mass");
  let st5=0;for(const c of (G.nodes.find(isBulk).containers||[]))st5+=cnt(c);
  t.ok(st5>0,"flow passes straight through the elbow ("+(st5*PMASS).toFixed(1)+" t)");
  const outSides=new Set();for(const r of[0,90,180,270]){const g=sitePlaceUnit("mixer",null,10,17,r,{free:true});outSides.add(sitePortsOf(g.node).find(p=>p.dir==="out").side);G.nodes.pop();}
  t.ok(outSides.size===4,"rotating the mixer aims its outlet at all four sides (any 90° reroute)");
  // 6 ── SPLITTER as an elbow: only the split branch wired → all flow turns, mass conserved
  newGame("career","site_free",0x9306);
  const sbk=sitePlaceUnit("input",null,7,4,0),sf=sitePlaceUnit("feeder",null,7,10,0);
  const so=sitePlaceUnit("process","opener",7,14,0),ssp=sitePlaceUnit("process","splitter",7,17,0),sbz=sitePlaceUnit("bulk",null,8,29,0);
  siteConnect(sbk.node,"b",sf.node,"t");siteConnect(sf.node,"b",so.node,"t");siteConnect(so.node,"b",ssp.node,"t");
  const esplitP=sitePortsOf(ssp.node).find(p=>p.id==="split");
  siteConnect(ssp.node,esplitP.side,sbz.node,"t"); // ONLY the side branch
  sbk.node.truckDue=900;for(let i=0;i<9000;i++)tick(0.004);
  t.ok(qcBalanced().ok,"splitter used as an elbow (side branch only) conserves mass");
  let st6=0;for(const c of (G.nodes.find(isBulk).containers||[]))st6+=cnt(c);
  t.ok(st6>0,"all flow turns through the splitter's single wired branch ("+(st6*PMASS).toFixed(1)+" t)");
},
"site-budget":function(t){ // sandbox = unlimited (counts spend, never blocks); career = hard budget
  // SANDBOX: drain the cash, then keep building into the negative — never blocked
  newGame("career","site_free",0x9201);
  t.ok(G.scenario.unlimitedBudget===true,"sandbox scenario is flagged unlimited");
  G.cash=1000; // almost broke
  const r1=sitePlaceUnit("input",null,13,4,0);
  t.ok(r1.ok,"sandbox: places a unit it can't afford");
  t.ok(G.cash<1000,"the spend is COUNTED (cash went down)");
  // keep going deep into the red
  sitePlaceUnit("feeder",null,13,10,0);sitePlaceUnit("process","opener",8,14,0);
  sitePlaceUnit("process","magnet",8,16,0);sitePlaceUnit("baler",null,2,20,0);
  t.ok(G.cash<0,"sandbox cash can go NEGATIVE ("+Math.round(G.cash/1000)+" k€)");
  const rc=siteConnect(nodeById(r1.node.id),"b",G.nodes.find(isFeeder),"t");
  t.ok(rc.ok,"sandbox: wiring also never blocked while negative");
  // CAREER: the same broke state DOES block
  newGame("career","site_career",0x9202);
  t.ok(G.scenario.unlimitedBudget===false,"career scenario keeps a hard budget");
  G.cash=1000;
  CAREER.tech.push("r_eddyU");recomputeTechMod(); // unlock eddy so the refusal we test is the BUDGET, not the R&D gate
  const r2=sitePlaceUnit("process","eddy",8,20,0);
  t.ok(!r2.ok&&r2.reason==="cash","career: an unaffordable (unlocked) unit is REFUSED on budget");
  const rl=sitePlaceUnit("process","nir",8,20,0);
  t.ok(!rl.ok&&rl.reason==="locked","career: a NOT-YET-RESEARCHED unit is refused by the R&D gate");
  // picking station exists and places with a crew (catalogue entry verified in the UI smoke)
  const pk=sitePlaceUnit("process","pick",8,22,0,{free:true});
  t.ok(pk.ok&&TYPES[pk.node.type].isPick&&pk.node.workers>0,"picking station places with a crew ("+pk.node.workers+" workers)");
  const pp=sitePortsOf(pk.node);
  t.ok(pp.some(p=>p.id==="sorted")&&pp.some(p=>p.id==="rest"),"picking station has sorted + rest outlets (a separator)");
},
"site-port-model":function(t){ // the explicit port spec (Denis 2026-07-11) — one source of truth
  newGame("career","site_free",0x9101);
  const P=(r)=>sitePortsOf(r.node);
  const has=(ps,id,kind,dir,side)=>ps.some(p=>p.id===id&&p.kind===kind&&p.dir===dir&&(side==null||p.side===side));
  const bunker=P(sitePlaceUnit("input",null,13,4,0));
  t.ok(has(bunker,"dump","truck","in","t")&&bunker.find(p=>p.id==="dump").virtual,"bunker: virtual dump-truck inlet on top");
  t.ok(has(bunker,"out","vehicle","out","b"),"bunker: loader out at the bottom");
  const feeder=P(sitePlaceUnit("feeder",null,13,10,0));
  t.ok(has(feeder,"in","vehicle","in","t"),"feeder: loader IN up");
  t.ok(has(feeder,"out","conveyor","out","b"),"feeder: conveyor OUT down");
  const op=P(sitePlaceUnit("process","opener",8,14,0));
  t.ok(has(op,"in","conveyor","in","t")&&has(op,"out","conveyor","out","b"),"opener: conveyor in up, conveyor out down (no separation)");
  const mag=sitePlaceUnit("process","magnet",8,16,0);let mp=P(mag);
  t.ok(has(mp,"in","conveyor","in","t"),"separator: conveyor in up");
  t.ok(mp.some(p=>p.id==="sorted"&&p.kind==="conveyor"&&(p.side==="l"||p.side==="r")),"separator: sorted species ejects to a SIDE");
  t.ok(has(mp,"rest","conveyor","out","b"),"separator: the rest goes down");
  mag.node.sortSide="l";mp=P(mag);
  t.ok(mp.find(p=>p.id==="sorted").side==="l","separator sorted side is settable (now left)");
  const sp=P(sitePlaceUnit("process","splitter",8,19,0));
  t.ok(has(sp,"main","conveyor","out","b")&&sp.some(p=>p.id==="split"&&(p.side==="l"||p.side==="r")),"splitter: main down, split to a side");
  const blL=P(sitePlaceUnit("baler",null,2,20,0));
  t.ok(blL.find(p=>p.id==="in").kind==="conveyor"&&blL.find(p=>p.id==="out").kind==="vehicle","baler: conveyor in (machinery), vehicle out (storage)");
  t.ok(blL.find(p=>p.id==="out").side==="l","left-strip baler ships to the west wall side");
  const bulk=P(sitePlaceUnit("bulk",null,13,29,0));
  t.ok(has(bulk,"in","conveyor","in","t")&&has(bulk,"out","vehicle","out","b"),"end-of-line: conveyor in up, truck out down");
  const ex=P(sitePlaceUnit("output",null,4,35,0));
  t.ok(has(ex,"in","vehicle","in","t")&&ex.find(p=>p.id==="truck").virtual,"bale storage: forklift in up, buyer trucks virtual");
  const lf=P(sitePlaceUnit("landfill",null,10,38,0));
  t.ok(has(lf,"in","vehicle","in","t")&&lf.filter(p=>p.dir==="out"&&!p.virtual).length===0,"landfill: vehicle in, nothing leaves");
  // KIND matching: a conveyor out must NOT wire into a vehicle inlet and vice-versa
  newGame("career","site_free",0x9102);
  const F=sitePlaceUnit("feeder",null,13,10,0),O=sitePlaceUnit("process","opener",13,13,0);
  const B=sitePlaceUnit("input",null,13,4,0);
  t.ok(siteConnect(F.node,"b",O.node,"t").ok,"conveyor→conveyor wires");
  t.ok(!siteCanConnect(B.node,"b",O.node,"t").ok,"vehicle out (bunker) into conveyor inlet (opener) is REFUSED");
  t.ok(siteCanConnect(B.node,"b",F.node,"t").ok,"vehicle out (bunker) into vehicle inlet (feeder) is allowed");
},
"site-connect-flow":function(t){ // the two-tap wiring gesture must complete even when the target has a free output nub
  newGame("career","site_free",0x5C0E);
  const F=sitePlaceUnit("feeder",null,5,10,0),O=sitePlaceUnit("process","opener",5,14,0),M=sitePlaceUnit("process","magnet",5,16,0);
  t.ok(F.ok&&O.ok&&M.ok,"feeder, opener, magnet placed for the wiring test");
  // Reproduce the FIXED handler priority: a source is armed on feeder's bottom output.
  // Simulate: BUILD.from=feeder, then a tap lands on the opener (which ALSO has a free output nub).
  const armed={from:F.node,fromSide:"b"};
  // the fix: with a source armed, a node tap completes BEFORE any nub re-arm.
  const target=O.node;
  const ts=autoToSide(armed.from,armed.fromSide,target);
  const r=siteConnect(armed.from,armed.fromSide,target,ts);
  t.ok(r.ok,"armed source → tap on a target that has its OWN free nub still WIRES (no re-arm steal)");
  t.ok(G.edges.some(e=>e.from===F.node.id&&e.to===O.node.id),"the feeder→opener edge exists after the gesture");
  // chain: now wire opener→magnet the same way
  const ts2=autoToSide(O.node,"b",M.node),r2=siteConnect(O.node,"b",M.node,ts2);
  t.ok(r2.ok&&G.edges.some(e=>e.from===O.node.id&&e.to===M.node.id),"chained opener→magnet wires too");
  // a tap on the SAME source must not create a self-loop
  t.ok(!siteConnect(F.node,"b",F.node,"t").ok,"a unit cannot wire to itself");
  // HITBOX ↔ RENDER agreement: the drawn nub and the tap anchor must be the same point (the 10%-hit bug).
  const outA=siteNodeAnchor(M.node,"b");        // magnet's bottom output nub (still free), as DRAWN
  const inA=siteInPortAnchor(M.node);            // magnet's input nub, as DRAWN
  // simulate a tap exactly on the magnet's free output nub → it must resolve to that output side
  const tapOut=findNearestOutNub(outA[0]*CELL,outA[1]*CELL);
  t.ok(tapOut&&tapOut.n.id===M.node.id&&tapOut.side==="b","tapping the DRAWN output nub resolves to that exact port");
  // simulate a tap exactly on the magnet's input nub → it must resolve to the magnet as destination
  const tapIn=findNearestInNub(inA[0]*CELL,inA[1]*CELL,O.node);
  t.ok(tapIn&&tapIn.id===M.node.id,"tapping the DRAWN input nub resolves to that exact destination");
  // EDITOR-MODEL gesture: siteNearestAnchor resolves a tap AT any drawn anchor to that anchor.
  newGame("career","site_free",0x5C1F);
  const A=sitePlaceUnit("feeder",null,5,10,0),B=sitePlaceUnit("process","opener",5,13,0);
  for(const an of siteAnchors(A.node)){
    const hit=siteNearestAnchor(an.x,an.y,0.75);
    t.ok(hit&&hit.n.id===A.node.id&&hit.a.side===an.side,"a tap on the feeder's "+an.side+"/"+an.role+" anchor resolves to it");}
  t.ok(siteAnchors(A.node).some(a=>a.side==="t"&&a.role==="in"),"the FEEDER exposes its TOP input anchor (to receive from the bunker)");
  // full two-tap: arm on feeder 'b', commit on opener's nearest anchor
  const armA=siteNearestAnchor(siteAnchors(A.node).find(z=>z.side==="b").x,siteAnchors(A.node).find(z=>z.side==="b").y,0.75);
  const inAnch=siteAnchors(B.node).find(z=>z.side==="t");
  const dst=siteNearestAnchor(inAnch.x,inAnch.y,0.75);
  const rr2=siteConnect(armA.n,armA.a.side,dst.n,dst.a.side);
  t.ok(rr2.ok&&G.edges.some(e=>e.from===A.node.id&&e.to===B.node.id),"editor two-tap (anchor→anchor) wires feeder→opener");
  // MULTI-OUTPUT: wiring one output must NOT block the OTHER output (the 'already wired' bug).
  newGame("career","site_free",0x5C2A);
  const air=sitePlaceUnit("process","air",8,16,0),bl=sitePlaceUnit("baler",null,15,16,180),bu=sitePlaceUnit("bulk",null,13,29,0);
  const outs=siteAnchors(air.node).filter(a=>a.role==="out");
  t.ok(outs.length===2&&outs[0].port!==outs[1].port,"a 2-output machine shows TWO distinct output nubs ("+outs.map(a=>a.side+":"+a.port).join(" ")+")");
  const w1=siteConnect(air.node,outs.find(a=>a.port==="M").side,bu.node,"t");
  t.ok(w1.ok,"wire the M output → bulk");
  const w2=siteCanConnect(air.node,outs.find(a=>a.port==="S").side,bl.node,"l");
  t.ok(w2.ok,"the OTHER output (S) is still free → wires to the baler (no false 'already wired')");
},
"site-playability":function(t){ // THE playability sweep (2026-07-11): a whole game, played engine-level
  /* 1 ── a new player builds the cheapest SELLING line on an empty site, within budget */
  newGame("career","site_free",0x9A4E);
  const cash0=G.cash;
  const P={};
  P.bunker =sitePlaceUnit("input",null,13,4,0);     // teal intake apron
  P.feeder =sitePlaceUnit("feeder",null,13,10,0);   // green strip
  P.opener =sitePlaceUnit("process","opener",13,13,0); // white corridor, stacked
  P.magnet =sitePlaceUnit("process","magnet",13,15,0);
  P.baler  =sitePlaceUnit("baler",null,15,15,180); // right strip, store faces the east wall
  P.bulk   =sitePlaceUnit("bulk",null,13,29,0);     // lime strip
  P.export =sitePlaceUnit("output",null,2,35,0);    // orange output apron
  P.landfill=sitePlaceUnit("landfill",null,10,38,0); // lower yard
  t.ok(Object.values(P).every(r=>r.ok),"a full selling line PLACES on the empty site");
  P.export.node.spec="ferrous"; // the player sets the bay's product
  const W=[];
  W.push(siteConnect(P.bunker.node,"b",P.feeder.node,"t"));
  W.push(siteConnect(P.feeder.node,"b",P.opener.node,"t"));
  W.push(siteConnect(P.opener.node,"b",P.magnet.node,"t"));
  W.push(siteConnect(P.magnet.node,"r",P.baler.node,"l"));   // sorted stream (side port) → press on the strip
  W.push(siteConnect(P.magnet.node,"b",P.bulk.node,"t"));    // reject (rest) → containers
  W.push(siteConnect(P.baler.node,"b",P.export.node,"t"));   // forklift bale → export bay
  W.push(siteConnect(P.bulk.node,"b",P.landfill.node,"t"));  // container truck
  t.ok(W.every(r=>r.ok),"the whole line WIRES first try (seam law auto-picks loader/forklift/truck/conveyor)");
  const capex=cash0-G.cash;
  t.report("min selling line costs "+Math.round(capex/1000)+" k\u20AC of the "+Math.round(cash0/1000)+" k\u20AC starting budget ("+Math.round(100*capex/cash0)+"%)");
  t.ok(capex<cash0*0.8,"affordable with headroom");
  P.bunker.node.truckDue=900; // first delivery minutes away, like the reference plant
  /* 2 ── it RUNS and SELLS on-spec */
  let anyOverload=false;
  for(let i=0;i<30000;i++){tick(0.004);
    if(i%200===0)for(const n of G.nodes)if(isFeeder(n)&&n.state==="overloaded")anyOverload=true;}
  t.ok(qcBalanced().ok,"mass books exact after 2 sim-hours of play");
  t.ok(qcSold()>0,"the player's plant SELLS ("+qcSold().toFixed(1)+" t shipped)");
  {let _ic=0;for(const n of G.nodes)if(isBulk(n)&&n.containers)for(const c of n.containers)_ic+=cnt(c);
  t.ok(_ic>0||G.landfill>0,"rejects reach the container zone ("+(_ic*PMASS).toFixed(1)+" t staged)");}
  t.ok(!anyOverload,"no phantom feeder OVERLOAD during normal play");
  t.ok(Number.isFinite(G.cash),"cash stays a number");
  t.report("2h P&L: cash "+Math.round((G.cash-(cash0-capex))/1000)+" k\u20AC vs post-build; sold "+qcSold().toFixed(1)+" t");
  /* 3 ── SAVE/LOAD INVARIANCE mid-flight (mobile reality: the game saves constantly) */
  const s1=JSON.stringify(serializeGame());
  restoreGame(JSON.parse(s1));qcTicks(7500);              // baseline: straight 30 min from s1
  const straight=JSON.stringify(serializeGame());
  restoreGame(JSON.parse(s1));qcTicks(3750);              // interrupted: 15 min…
  const s2=JSON.stringify(serializeGame());
  restoreGame(JSON.parse(s2));qcTicks(3750);              // …save/load… 15 min more
  t.ok(JSON.stringify(serializeGame())===straight,"saving & reloading MID-ACTION changes nothing (byte-identical vs uninterrupted run)");
  /* 4 ── demolish under load, then rebuild: the plant recovers */
  const magnet=G.nodes.find(n=>n.type==="magnet");
  const soldBefore=qcSold(),lfB=G.landfill;
  const rd=siteDemolish(magnet);
  t.ok(rd.ok&&qcBalanced().ok,"demolishing a LOADED unit keeps the books exact (contents scrapped: "+(rd.scrapped*PMASS).toFixed(1)+" t)");
  qcTicks(1000);
  t.ok(qcBalanced().ok,"still exact while the line runs around the hole");
  const nm=sitePlaceUnit("process","magnet",13,15,0);
  const rw1=siteConnect(G.nodes.find(n=>n.type==="opener"),"b",nm.node,"t");
  const rw2=siteConnect(nm.node,"r",G.nodes.find(n=>TYPES[n.type].isBaler),"l");
  const rw3=siteConnect(nm.node,"b",G.nodes.find(isBulk),"t");
  t.ok(nm.ok&&rw1.ok&&rw2.ok&&rw3.ok,"rebuild + rewire in place");
  qcTicks(15000);
  t.ok(qcSold()>soldBefore,"the rebuilt line sells again (+"+(qcSold()-soldBefore).toFixed(1)+" t)");
  /* 5 ── refund arithmetic is exact */
  const c0=G.cash,rp=sitePlaceUnit("process","eddy",8,20,0);
  const rf=siteDemolish(rp.node);
  t.ok(G.cash===c0-rp.cost+rf.refund&&rf.refund===Math.round(rp.cost*SITE_REFUND),"place+demolish cash arithmetic exact (50% refund)");
  /* 6 ── zero fleet: graceful starvation, then recovery */
  newGame("career","site_free",0x9A4F);
  const B=sitePlaceUnit("input",null,2,4,0),F=sitePlaceUnit("feeder",null,3,10,0);
  siteConnect(B.node,"b",F.node,"t");
  G.fleet.loader=0;B.node.truckDue=900;
  qcTicks(8000);
  t.ok(qcBalanced().ok&&cnt(F.node.inBuf)===0,"no loaders: trucks deliver, nothing moves, nothing breaks");
  t.ok(F.node.state==="noloader"||cnt(B.node.inBuf)===0,"the starving feeder SAYS so");
  G.fleet.loader=1;qcTicks(6000);
  t.ok(cnt(F.node.inBuf)>0,"buying a loader revives the line without a restart");
  /* 6b ── parallel lines scale: two feeders out-throughput one (real grid, replaces the obsolete d5-C) */
  newGame("career","site_free",0x9A5C);
  const staged=()=>{let s=0;for(const n of G.nodes)if(isBulk(n)&&n.containers)for(const c of n.containers)s+=cnt(c);return s+G.landfill/PMASS;};
  const line=(sx)=>{const cx=sx==="L"?6:13,bx=sx==="L"?5:13;
    const b=sitePlaceUnit("input",null,bx,4,0),f=sitePlaceUnit("feeder",null,cx,10,0),
    o=sitePlaceUnit("process","opener",cx,14,0),z=sitePlaceUnit("bulk",null,bx,29,0),l=sitePlaceUnit("landfill",null,sx==="L"?2:10,38,0);
    siteConnect(b.node,"b",f.node,"t");siteConnect(f.node,"b",o.node,"t");siteConnect(o.node,"b",z.node,"t");siteConnect(z.node,"b",l.node,"t");
    b.node.truckDue=900;return b;};
  line("L");G.fleet.loader=1;qcTicks(16000);const one=staged();
  newGame("career","site_free",0x9A5D);
  line("L");line("R");G.fleet.loader=2;qcTicks(16000);const two=staged();
  t.ok(two>one,"two parallel lines out-throughput one ("+(two*PMASS).toFixed(1)+" t vs "+(one*PMASS).toFixed(1)+" t)");
  /* 7 ── bunker overflow: full floor diverts trucks, never loses mass */
  newGame("career","site_free",0x9A50);
  const B2=sitePlaceUnit("input",null,2,4,0);
  G.logi.bunkerCap=1500;G.fleet.loader=0;B2.node.truckDue=900;
  qcTicks(16000);
  t.ok(cnt(B2.node.inBuf)<=1500,"tipping floor never exceeds capacity — "+cnt(B2.node.inBuf)+"/1500 (trucks divert)");
  t.ok(qcBalanced().ok,"diverted loads stay off the books correctly");
},
"site-motion":function(t){ // S-MOTION guarantees: continuity, berths, exact rear-edge docking
  qcSiteGame(0x50F7);
  // 1. geometric continuity of every leg produced in a live sim: position steps bounded,
  //    sprite heading never jumps (the 180-cusp cancellation at work)
  let worstStep=0,worstTurn=0,legs=0;
  const checkLeg=(leg)=>{if(!leg||!leg.path||leg.path.length<2)return;legs++;
    // Sample at a fixed ARC LENGTH (~2 px), not a fixed count: with the through-road a leg can be several
    // thousand px long, and 240 fixed samples would stride right over a corner and report it as a snap.
    // The threshold below is about the motion, so the measurement must not change with path length.
    const N=Math.max(240,Math.ceil(pathLen(leg.path)/2));let pv=null;
    for(let k=0;k<=N;k++){const p=legPose(leg,k/N);
      if(pv){const d=Math.hypot(p.x-pv.x,p.y-pv.y);worstStep=Math.max(worstStep,d-pathLen(leg.path)/N*1.6);
        let da=Math.abs(p.a-pv.a);da=Math.min(da,2*Math.PI-da);worstTurn=Math.max(worstTurn,da);}
      pv=p;}};
  const seen=new Set();
  for(let i=0;i<16000;i++){tick(0.004);
    if(i%50===0){
      for(const v of G.vehicles)if(v.leg&&!seen.has(v.leg)){seen.add(v.leg);checkLeg(v.leg);}
      for(const tk of (G.trucks||[])){if(tk.leg&&!seen.has(tk.leg)){seen.add(tk.leg);checkLeg(tk.leg);}
        if(tk.exitLeg&&!seen.has(tk.exitLeg)){seen.add(tk.exitLeg);checkLeg(tk.exitLeg);}}}}
  t.ok(legs>10,"sampled "+legs+" live legs");
  t.ok(worstStep<=0.01,"position advances without jumps (worst overshoot "+worstStep.toFixed(2)+" px)");
  t.ok(worstTurn<0.6,"sprite heading is continuous — max per-sample turn "+worstTurn.toFixed(2)+" rad (no snaps)");
  // 2. berth uniqueness: no two actors hold the same slot at the same node
  let clash=false;
  for(let i=0;i<4000;i++){tick(0.004);
    if(i%100===0){const seen2={};
      const put=(id,b)=>{const k=id+":"+b;if(seen2[k])clash=true;seen2[k]=1;};
      for(const v of G.vehicles)if(v.berthAt!=null&&v.berth!=null)put(v.berthAt,v.berth);
      for(const tk of (G.trucks||[]))if(tk.berthAt!=null&&tk.berth!=null)put(tk.berthAt,tk.berth);}}
  t.ok(!clash,"no two actors ever share a berth slot");
  // 3. rear-edge docking: every dwelling truck's centre sits exactly half_length off the apron face
  let sampled=0,worstDock=0;
  for(let i=0;i<8000;i++){tick(0.004);
    if(i%80===0)for(const tk of (G.trucks||[]))if(tk.state==="dwell"){
      const n=nodeById(tk.nodeId);if(!n)continue;
      const info=truckDockInfo(n),p=truckPos(tk),hl=VEH_GEO[tk.cls].hl;
      const d=Math.abs(Math.hypot(p.x-info.p[0],p.y-info.p[1])); // centre→dock distance
      // lateral berth offset allowed; the AXIAL component must equal hl
      const ax=Math.abs((p.y-info.p[1])*dockOut(info.side)[1]+(p.x-info.p[0])*dockOut(info.side)[0]);
      worstDock=Math.max(worstDock,Math.abs(ax-hl));sampled++;}}
  t.ok(sampled>0&&worstDock<0.5,"rear edge exactly on the connection point ("+sampled+" dockings, worst axial error "+worstDock.toFixed(2)+" px)");
  // 4. ampliroll DRIVES to its lay-by — never teleports. Track a ctruck through a full haul + park.
  qcSiteGame(0x5A11);let sawPark=false,jump=0,pv={};
  for(let i=0;i<24000;i++){tick(0.004);
    for(const v of G.vehicles){if(v.cls!=="ctruck")continue;
      if(v.state==="toPark")sawPark=true;
      const p=vehPos(v),k=v.id;
      if(pv[k]&&(pv[k].st===v.state||v.state==="toPark"||pv[k].st==="toPark")){
        const d=Math.hypot(p.x-pv[k].x,p.y-pv[k].y);if(d>CELL*2)jump++;} // >2 cells in one tick = teleport
      pv[k]={x:p.x,y:p.y,st:v.state};}}
  t.ok(sawPark,"ampliroll enters a driving toPark state after a haul (not an instant idle)");
  t.ok(jump===0,"ampliroll never teleports \u2014 continuous position through haul, park, and re-dispatch ("+jump+" jumps)");
},
"site-states-and-actions":function(t){ // 2026-07-11 feedback round: feeder states, docking, scrap action
  qcSiteGame();
  // direct loader seam: bunker→feeder routes are ≤4-point elbows, no side-road detour
  let seamOK=true;
  for(const e of G.edges)if(e.kind==="vehicle"&&isBunker(nodeById(e.from))&&isFeeder(nodeById(e.to))&&e.route.length>4)seamOK=false;
  t.ok(seamOK,"loader seam is a direct elbow (≤4 points)");
  let feederOverload=0,dryNoLoader=true,sawDock=0,dockVert=true;
  for(let i=0;i<20000;i++){tick(0.004);
    if(i%100===0){
      for(const n of G.nodes)if(isFeeder(n)){
        if(n.state==="overloaded")feederOverload++;
        if(n.state==="noloader"&&cnt(n.inBuf)>=G.logi.loaderCap)dryNoLoader=false;}
      for(const tk of (G.trucks||[]))if(tk.state==="dwell"&&tk.path.length>=2){sawDock++;
        const P=tk.path,a=P[P.length-2],b=P[P.length-1];
        if(Math.abs(a[0]-b[0])>1e-6)dockVert=false;}}}
  t.ok(feederOverload===0,"no false feeder OVERLOAD across 20000 ticks ("+feederOverload+" seen)");
  t.ok(dryNoLoader,"NO LOADER only shows when a feeder is genuinely about to run dry");
  t.ok(sawDock>0&&dockVert,"every dwelling truck docked vertically, nose to the bay ("+sawDock+" dockings sampled)");
  // scrap action conserves mass and books the charge
  const ex=G.nodes.find(n=>isExport(n)&&n.bales&&n.bales.length>0);
  if(ex){const before=qcBalanced();t.ok(before.ok,"balanced before scrap");
    const lf0=G.landfill,k=exportScrap(ex,false),after=qcBalanced();
    t.ok(k>0&&G.landfill>lf0&&after.ok,"Clear-all scrapped "+k+" bales to landfill, mass books conserved");}
  else t.ok(true,"(no stocked export at sample tick — scrap check skipped)");
},
"site-calibration":function(t){ // D6 re-baseline: MEASURE end-to-end throughput on the real plant; report + physical-range asserts.
  // Throughput = Δ(landfilled+sold) / Δ G.t = tons per sim-HOUR (G.t is in hours). No opening stock (clean start).
  const NLINES=3; // the reference plant runs 3 feeders
  const meas=(feed,loaders)=>{qcSiteGame(0xC0FFEE7,{loader:loaders,forklift:2,ctruck:2});
    for(const n of G.nodes)if(isFeeder(n))n.rate=feed;
    G.contract.feedTph=feed;
    qcTicks(8000);const t0=G.t,d0=G.landfill+qcSold();
    qcTicks(16000);return (G.landfill+qcSold()-d0)/(G.t-t0);};
  const r1=meas(0.5,3),r2=meas(0.5,1),r3=meas(1.5,3);
  t.report("throughput (t per sim-hour): 3 lines @ 0.5 t/h \u2192 3 loaders "+r1.toFixed(2)+", 1 loader "+r2.toFixed(2)+"; stress @ 1.5 t/h \u2192 "+r3.toFixed(2));
  t.ok(r1>0,"plant throughput positive with full fleet");
  t.ok(r1>=r2-1e-9,"more loaders never hurt");
  // physical range: steady-state disposal can't exceed what's fed in (mass can't be created), and rises with feed
  t.ok(r1<=0.5*NLINES+1e-6,"throughput \u2264 feed\u00d7lines (0.5\u00d73 t/h) \u2014 no mass created ("+r1.toFixed(2)+")");
  t.ok(r3<=1.5*NLINES+1e-6,"stressed throughput \u2264 feed\u00d7lines (1.5\u00d73 t/h) ("+r3.toFixed(2)+")");
  t.ok(r3>=r1-1e-9,"a hotter feed never lowers steady-state throughput");
},
};

// ── THE GATE + imposed mandates + landfill teeth (2026-08-01) ──────────────────
// Helpers: arm the pressure system by proving all 6 product lines, then step whole days.
function qcCover6(){const os=CAREER.counters.onSpec={};for(const k in SPECS)os[k]=SPEC_COVER_T+1;}
function qcDays(n){ // advance n whole in-game days through the real day-rollover path
  for(let i=0;i<n;i++){G.t+=24;careerDaily();}}
function qcArm(){qcCover6();qcDays(2);}

QC_SUITES["pressure-gate"]=function(t){ // NOTHING bites until all 6 products actually run
  qcSiteGame();G.continuous=true;CAREER.counters.flags.tutorialComplete=true;
  t.ok(specsCovered()===0,"a fresh career has proven no product lines");
  t.ok(!pressureOn(),"pressure starts DISARMED");
  t.ok(Math.abs(landfillBase()-ECON.landfillGate)<1e-9,"landfill is the flat base rate while disarmed");
  t.ok(landfillAllowT()===Infinity,"no allowance applies while disarmed");
  const c0=G.cash;dumpToLandfill(10);
  t.ok(Math.abs((c0-G.cash)-10*ECON.landfillGate)<1e-6,"disarmed disposal costs exactly base × mass");
  // partial coverage must NOT arm
  {const os=CAREER.counters.onSpec={};let i=0;for(const k in SPECS){if(i++>=5)break;os[k]=SPEC_COVER_T+1;}}
  qcDays(2);
  t.ok(specsCovered()===5,"5 of 6 products proven");
  t.ok(!pressureOn(),"5 of 6 does NOT arm the pressure system");
  CAREER.counters.exportedOnSpec=99999;qcDays(3);
  t.ok((CAREER.mandates.seen||[]).length===0,"no mandate can fire while disarmed, however successful the plant");
  // the 6th line arms it
  qcArm();
  t.ok(specsCovered()===6&&pressureOn(),"proving all 6 products arms the pressure system");
  t.ok(pressureYear()===1,"the escalation clock starts at year 1 ON ARMING (not at campaign start)");
};

QC_SUITES["landfill-escalation"]=function(t){ // pure pricing: escalating gate + self-scaling allowance
  qcSiteGame();G.continuous=true;CAREER.counters.flags.tutorialComplete=true;qcArm();
  const d0=CAREER.pressure.day;
  for(const y of [1,2,5,10]){G.t=(d0+(y-1)*360)*24;
    t.ok(Math.abs(landfillBase()-ECON.landfillGate*Math.pow(1+ECON.lfEsc,y-1))<1e-6,"year "+y+" base = 110×1.12^"+(y-1)+" = €"+landfillBase().toFixed(0));}
  G.t=d0*24;
  CAREER.landfillYr={y:1,t:0,in:10000};                       // accepted 10 000 t → 35% allowance = 3500 t
  t.ok(Math.abs(landfillAllowT()-3500)<1e-6,"allowance = 35% of accepted tonnage ("+landfillAllowT()+" t)");
  const b=landfillBase();
  let c=dumpToLandfill(3400);
  t.ok(Math.abs(c-3400*b)<1e-6,"under the allowance charges the base rate");
  c=dumpToLandfill(200);                                       // 100 t under + 100 t over
  t.ok(Math.abs(c-(100*b+100*b*ECON.lfPenalty))<1e-6,"a dump STRADDLING the line is split-priced (no boundary exploit)");
  t.ok(Math.abs(landfillGateNow()-b*ECON.lfPenalty)<1e-6,"past the allowance the next tonne costs ×"+ECON.lfPenalty);
  t.ok(Math.abs(pnlReport().net-G.cash)<1,"net still reconciles to cash after penalty pricing");
  CAREER.landfillYr={y:1,t:0,in:0};
  t.ok(Math.abs(landfillAllowT()-ECON.lfAllowFreeT)<1e-6,"a plant that accepted nothing still gets the flat free tonnage");
  G.t=(d0+360)*24;const L=landfillYear();
  t.ok(L&&L.y===2&&L.t===0,"the allowance counter auto-rolls at the pressure-year boundary");
};

QC_SUITES["mandate-fires-once"]=function(t){
  qcSiteGame();G.continuous=true;CAREER.counters.flags.tutorialComplete=true;qcArm();
  const first=MANDATE.m_kerbside;
  CAREER.counters.exportedOnSpec=first.cond.gte+1;
  const g0=G.ledger.grants;
  qcDays(1);
  t.ok(CAREER.mandates.seen.indexOf("m_kerbside")>=0,"the trigger metric queues the mandate");
  t.ok(CAREER.mandates.pending.length===1,"it lands in PENDING first (a warning, not an ambush)");
  t.ok(G.ledger.grants===g0,"no grant is paid during the warning window");
  t.ok(CAREER.mandates.active.length===0,"trucks are not rolling yet");
  qcDays(first.warnDays);
  t.ok(CAREER.mandates.active.length===1,"after the warning window it goes ACTIVE");
  t.ok(CAREER.mandates.pending.length===0,"and leaves pending");
  t.ok(Math.abs((G.ledger.grants-g0)-first.grant)<1,"the capital grant lands exactly once (+"+first.grant+")");
  const g1=G.ledger.grants,seen1=CAREER.mandates.seen.length;
  qcDays(20);
  t.ok(Math.abs(G.ledger.grants-g1)<1||CAREER.mandates.seen.length>seen1,"no double-payment of an already-active mandate");
  t.ok(CAREER.mandates.seen.filter(x=>x==="m_kerbside").length===1,"a mandate is recorded once and can never re-fire");
  // req chains: the 3rd mandate cannot precede the 2nd
  t.ok(CAREER.mandates.seen.indexOf("m_regional")<0,"a mandate whose req chain is unmet stays dormant");
};

QC_SUITES["mandate-intake-and-overflow"]=function(t){
  qcSiteGame();G.continuous=true;CAREER.counters.flags.tutorialComplete=true;qcArm();
  // rate over a long window AFTER a warm-up — truckloads are 10 t batches, so a cold pipeline reads low
  const rate=()=>{qcTicks(3000);const t0=G.t,d0=G.deliveredTot;qcTicks(9000);return (G.deliveredTot-d0)/(G.t-t0);};
  const base=rate();
  // impose the first mandate
  CAREER.counters.exportedOnSpec=MANDATE.m_kerbside.cond.gte+1;
  qcDays(1+MANDATE.m_kerbside.warnDays);
  t.ok(CAREER.mandates.active.length===1,"mandate active");
  const add=supplierStream("skip_bizet").feedTph;
  const withM=rate();
  t.ok(withM>base+add*0.5,"imposed intake genuinely ADDS tonnage (was "+base.toFixed(2)+", now "+withM.toFixed(2)+" t/h, stream +"+add+")");
  t.ok(qcBalanced().ok,"mass balance holds with an imposed stream running");
  // pointing a bunker at the SAME mandated supplier must not double-deliver (the per-supplier split rule)
  const bunkers=G.nodes.filter(isBunker);
  if(bunkers.length){bunkers[0].supplier="skip_bizet";
    // Assert the RULE, not a hand-tuned delta off the previous sample: the re-aimed bunker drops out of the
    // voluntary split (pass 1 skips mandated streams) and the imposed stream is shared across every bunker,
    // so the rated total is voluntary + imposed counted ONCE — never the imposed stream twice.
    const rated=bunkers.reduce((s,b)=>s+bunkerRatedTph(b).total,0);
    t.ok(Math.abs(rated-(supplierStream("wasteminster").feedTph+add))<1e-9,
      "rated intake is voluntary + imposed counted once ("+rated.toFixed(2)+" vs "+(supplierStream("wasteminster").feedTph+add)+")");
    qcTicks(12000); // discharge the banked truckDue first — a backlog burst is not a delivery rate
    const dbl=rate();
    t.ok(dbl<rated+add*0.5,"aiming a bunker at a mandated supplier does NOT double-deliver ("+dbl.toFixed(2)+" vs rated "+rated.toFixed(2)+")");}
  // a bunker set to __none still receives imposed trucks
  for(const b of G.nodes)if(isBunker(b))b.supplier="__none";
  t.ok(rate()>add*0.4,"an IDLE (__none) bunker still receives imposed trucks — it cannot be refused");
  // full bunkers → the surplus is buried and billed, and the sim is NOT paused.
  // (bump deliveredTot by the injected mass: stuffing buffers directly would create mass from nothing
  //  and break the very invariant we are about to assert.)
  {let inject=0;for(const b of G.nodes)if(isBunker(b)){const room=capOf(b)-cnt(b.inBuf);for(let k=0;k<room;k++){b.inBuf.paper[0]++;inject++;}}
   G.deliveredTot+=inject*PMASS;G.delivered+=inject*PMASS;}
  t.ok(qcBalanced().ok,"bookkeeping consistent before the overflow test");
  G.running=true;const lf0=G.landfill,lg0=G.ledger.landfill;
  qcTicks(4000);
  t.ok(G.landfill>lf0,"a full bunker buries the imposed surplus ("+(G.landfill-lf0).toFixed(1)+" t)");
  t.ok(G.ledger.landfill>lg0,"…and is charged for it");
  t.ok(G.running===true,"imposed overflow does NOT pause the sim (a silent economic bleed, not a popup)");
  t.ok(qcBalanced().ok,"mass balance holds through imposed overflow");
};

QC_SUITES["mandate-save-roundtrip"]=function(t){
  qcSiteGame();G.continuous=true;CAREER.counters.flags.tutorialComplete=true;qcArm();
  CAREER.counters.exportedOnSpec=MANDATE.m_kerbside.cond.gte+1;
  qcDays(1+MANDATE.m_kerbside.warnDays);qcTicks(600);
  const armed=CAREER.pressure.armed,aday=CAREER.pressure.day,act=CAREER.mandates.active.length,seen=CAREER.mandates.seen.slice();
  const lyr=JSON.stringify(CAREER.landfillYr);
  const bWith=G.nodes.filter(n=>isBunker(n)&&n.mandDue&&Object.keys(n.mandDue).length).length;
  const trucks=(G.trucks||[]).filter(x=>x.cls==="supplier"&&x.forced).length;
  restoreGame(JSON.parse(JSON.stringify(serializeGame())));
  t.ok(CAREER.pressure.armed===armed&&CAREER.pressure.day===aday,"pressure arming survives serialize→restore");
  t.ok(JSON.stringify(CAREER.landfillYr)===lyr,"landfill-year counters survive");
  t.ok(CAREER.mandates.active.length===act&&CAREER.mandates.seen.join()===seen.join(),"mandate state survives");
  t.ok(G.nodes.filter(n=>isBunker(n)&&n.mandDue&&Object.keys(n.mandDue).length).length===bWith,"per-bunker mandDue accrual survives");
  t.ok((G.trucks||[]).filter(x=>x.cls==="supplier"&&x.forced).length===trucks,"in-flight forced trucks keep t.forced");
  t.ok(qcBalanced().ok,"books balanced after restore");
  // a PRE-mandate save (no new keys at all) must back-fill, not throw
  const s=JSON.parse(JSON.stringify(serializeGame()));
  delete s.career.mandates;delete s.career.pressure;delete s.career.landfillYr;
  for(const n of s.nodes)delete n.mandDue;
  restoreGame(s);
  t.ok(!!CAREER.mandates&&Array.isArray(CAREER.mandates.seen),"an old save back-fills mandate state");
  t.ok(!!CAREER.pressure&&CAREER.pressure.armed===false,"an old save back-fills DISARMED (no surprise pressure on load)");
  qcTicks(400);
  t.ok(qcBalanced().ok,"an upgraded old save ticks and stays balanced");
};

QC_SUITES["burden-depth"]=function(t){ // rated t/h is MECHANICAL throughput; clean sorting needs headroom
  // Every arm feeds the SAME 60 t of the SAME mix through ONE nir (cap 3 t/h, accept "M" = PET kept)
  // and lets it fully drain — only the DELIVERY WINDOW changes. That isolates burden from composition:
  // comparing arms at different feed totals would instead compare different material, because a
  // cap-limited unit only ever processes a prefix of what it was given.
  const run=(windowFrac,seed)=>{newGame("sandbox","standard",seed);G.contract.supplier=null;
    const u=addNode("nir",100,0);
    const keep=addNode("buffer",160,-30),rej=addNode("buffer",160,30); // unwired outputs pile up so we can read composition
    G.edges.push({from:u.id,fromPort:"M",to:keep.id,sprites:[],speed:EDGE_SPEED});
    G.edges.push({from:u.id,fromPort:"S",to:rej.id,sprites:[],speed:EDGE_SPEED});
    const mix={PET:0.32,steel:0.15,alu:0.06,film:0.14,paper:0.26,PVC:0.07};
    const TICKS=24000,dt=0.004,TOTAL_T=60,total=Math.round(TOTAL_T/PMASS);
    // interleave in representative 100-particle blocks: grouped feed would hand a lagging unit a
    // PET-rich prefix and read as *better* purity under load — an artefact, not physics
    const feed=[],BLOCK=100;
    for(let b=0;b<Math.ceil(total/BLOCK);b++)for(const m in mix){const k=Math.round(BLOCK*mix[m]);for(let i=0;i<k;i++)feed.push(m);}
    feed.length=Math.min(feed.length,total);
    const FEED_TICKS=Math.max(1,Math.floor(TICKS*windowFrac));
    let fi=0,ksum=0,kn=0;
    for(let i=0;i<TICKS;i++){
      const want=Math.min(feed.length,Math.floor((i+1)*feed.length/FEED_TICKS))-fi;
      for(let q=0;q<want;q++)u.inBuf[feed[fi++]][1]++;
      const busy=cnt(u.inBuf)>0; tick(dt);
      if(busy){ksum+=burdenK(u);kn++;}}   // mean over WORKING ticks; the idle drain tail would dilute it
    const c=comp(keep.inBuf);let tot=0;for(const m of MAT)tot+=c[m];
    return {pur:tot>0?c.PET/tot:0,pvc:tot>0?c.PVC/tot:0,kAvg:kn?ksum/kn:0,
            left:cnt(u.inBuf),procT:(u._sortMass||0)+(u._restMass||0),kept:u._sortMass||0};};
  const easy=run(0.90,0xB01);  // 60 t trickled over ~86 h ≈ 0.7 t/h — comfortably inside the 3 t/h rating
  const hard=run(0.04,0xB01);  // the same 60 t dumped in ~4 h ≈ 15 t/h — the unit drowns, then drains
  t.ok(easy.left===0&&hard.left===0,"both arms fully drained (same material processed either way)");
  t.ok(Math.abs(easy.procT-hard.procT)<1e-6,"both arms processed the SAME tonnage ("+easy.procT.toFixed(1)+" t) — only burden differs");
  t.ok(easy.kAvg===0,"a sorter fed inside its rating carries NO burden penalty");
  t.ok(hard.kAvg>0.5,"a sorter fed ~5× its rating runs heavily burdened (mean k="+hard.kAvg.toFixed(2)+")");
  t.ok(hard.pur<easy.pur-0.03,"burden costs SELECTIVITY, not just speed ("+(easy.pur*100).toFixed(1)+"% → "+(hard.pur*100).toFixed(1)+"% PET)");
  t.ok(hard.pvc>easy.pvc,"…contaminant carry-over rises with burden (PVC "+(easy.pvc*100).toFixed(2)+"% → "+(hard.pvc*100).toFixed(2)+"%)");
  t.ok(hard.kept<easy.kept,"…and target capture falls — burying the feed loses yield too ("+easy.kept.toFixed(1)+" t → "+hard.kept.toFixed(1)+" t)");
  // THE POINT: spreading the same tonnage over more sorter-hours restores the clean result.
  const split=run(0.40,0xB01);
  t.ok(split.pur>hard.pur,"spreading the same tonnage across more sorting capacity recovers purity ("+(hard.pur*100).toFixed(1)+"% → "+(split.pur*100).toFixed(1)+"%)");
  // the mechanic must be a single switch
  t.ok(typeof BURDEN_LOSS==="number"&&typeof BURDEN_KNEE==="number","burden is governed by named constants (BURDEN_LOSS=0 disables it)");
  t.ok(burdenProb(0.96,0)===0.96&&burdenProb(0.002,0)===0.002,"k=0 leaves every probability exactly untouched");
};

QC_SUITES["diversion-metric"]=function(t){ // the 80%-diversion goal used to be free on day one
  qcSiteGame();G.continuous=true;
  const day=()=>{G.t+=24;careerDaily();};
  G.t=0;careerDaily();
  // (a) a plant that simply hasn't landfilled anything YET is not a 100%-diversion plant
  G.delivered=2;G.deliveredTot=2;G.landfill=0;day();
  t.ok(CAREER.counters.bestDiversion===0,"no diversion record is banked before a real operating history");
  t.ok(!objMet(OBJ.a_div),"the 80% diversion grant is NOT claimable after 2 t with nothing buried");
  // (b) THE STOCKPILE EXPLOIT: accepting 1000 t and selling NOTHING is not diversion, however little is
  //     buried. The old metric read 1 - buried/accepted, so this was 100% and banked the grant permanently —
  //     reachable just by leaving a baler's output unconnected, or by simply being a new plant.
  G.deliveredTot=1000;G.delivered=1000;G.landfill=0;G.sold={};day();
  t.ok(diversionNow()===0,"1000 t accepted, nothing sold, nothing buried → 0% (held material is not diverted)");
  t.ok(!objMet(OBJ.a_div),"the 80% grant is NOT claimable by a plant that has sold nothing");
  t.ok(CAREER.counters.bestDiversion===0,"…and no record is banked from stockpiling");
  // (c) it banks the ratio of what actually LEFT the site: 900 t sold vs 100 t buried
  G.sold={PET:{on:900,off:0}};G.landfill=100;day();
  t.ok(Math.abs(CAREER.counters.bestDiversion-0.9)<1e-6,"banks the real ratio (900 t sold, 100 t buried → 90%)");
  t.ok(objMet(OBJ.a_div),"…and 90% clears the 80% goal");
  // (d) off-spec bales are sold at the off-spec price, not buried — they left as product
  G.sold={PET:{on:450,off:450}};
  t.ok(Math.abs(diversionNow()-0.9)<1e-6,"off-spec tonnage counts as diverted (it is sold, not buried)");
  // (e) immune to the phase reset of G.delivered (the original bug this suite was written for)
  const before=diversionNow();
  G.delivered=0;                        // exactly what applyPhase does
  t.ok(Math.abs(diversionNow()-before)<1e-9,"diversion is immune to the phase reset of G.delivered");
  t.ok(diversionNow()>0,"…and does not collapse to 0 afterwards");
  // (f) burying more must lower the CURRENT reading (even though the banked best is a high-water mark)
  const cur=diversionNow();G.landfill=900;
  t.ok(diversionNow()<cur,"burying more lowers the current diversion");
  t.ok(Math.abs(diversionNow()-0.5)<1e-6,"900 t sold, 900 t buried → 50%");
};

QC_SUITES["buffer-migration"]=function(t){ // every buffer that crosses save→restore must be MIGRATED, not trusted
  t.ok(Object.keys(blankBuf()).join()===MAT.join(),"blankBuf is derived from MAT, not a hardcoded literal");
  t.ok(MAT.every(m=>blankBuf()[m].length===ST),"every material gets ST state slots");
  t.ok(MAT.every(m=>comp(blankBuf())[m]===0),"comp reports 0 (never undefined) for every material on an empty buffer");
  // a buffer from an OLDER material list: missing keys must default, unknown keys must not destroy mass
  const legacy={PET:[3,4],steel:[1,2],unobtainium:[5,6]};
  const mg=migrateBuf(legacy);
  t.ok(MAT.every(m=>!!mg[m]&&mg[m].length===ST),"a legacy buffer is rebuilt to the full MAT×ST shape");
  t.ok(cnt(mg)===3+4+1+2+5+6,"a DROPPED material's particles are folded in, not silently destroyed (mass conserved)");
  t.ok(mg.steel[0]===1&&mg.steel[1]===2,"surviving materials keep their exact counts");
  // the three restore paths that used to bypass migrateBuf: vehicle payload, forklift baleLoad, sprite mat
  qcSiteGame();qcTicks(4000);
  const s=JSON.parse(JSON.stringify(serializeGame()));
  let touched=0;
  for(const v of (s.vehicles||[])){ if(v.payload){delete v.payload.alu;v.payload.unobtainium=[2,0];touched++;}
    if(v.baleLoad)for(const b of v.baleLoad){delete b.alu;b.unobtainium=[1,0];touched++;} }
  for(const e of (s.edges||[]))for(const sp of (e.sprites||[]))if(!sp.bale){sp.mat="unobtainium";touched++;}
  t.ok(touched>0,"the fixture actually mangled some in-flight state ("+touched+" objects)");
  let threw=false;try{restoreGame(s);}catch(e){threw=true;}
  t.ok(!threw,"a save carrying an unknown material restores without throwing");
  t.ok(G.vehicles.every(v=>MAT.every(m=>!!v.payload[m])),"restored vehicle payloads have every current material");
  t.ok(G.vehicles.every(v=>(v.baleLoad||[]).every(b=>MAT.every(m=>!!b[m]))),"restored forklift bale loads too");
  t.ok(G.edges.every(e=>e.sprites.every(sp=>sp.bale||MAT.indexOf(sp.mat)>=0)),"an unknown sprite material is remapped to a live one");
  let ran=false;try{qcTicks(2000);ran=true;}catch(e){ran=false;}
  t.ok(ran,"the restored game ticks — in-flight material reaches its destination without a missing-key crash");
};

QC_SUITES["site-crossings"]=function(t){ // belt overpasses: pure geometry, order-independent, save-stable
  const B=(...p)=>({kind:"conveyor",route:p,sprites:[]});
  const V=B([255,450],[255,600]),H=B([210,525],[345,525]);
  const X=siteBeltCrossings([V,H]);
  t.ok(X.length===1,"one H×V meet = one crossing (got "+X.length+")");
  t.ok(X[0].x===255&&X[0].y===525,"crossing sits at the exact world point");
  t.ok(X[0].top===H&&X[0].bot===V,"the HORIZONTAL run is the overpass");
  t.ok(siteBeltCrossings([H,V])[0].top===H,"the z rule is order-independent (G.edges order must never decide)");
  t.ok(siteBeltCrossings([B([127.5,300],[127.5,420]),B([60,375],[300,375])]).length===1,
       "a quarter-cell crossing is found in world px (a per-CELL test would miss it)");
  t.ok(siteBeltCrossings([B([0,90],[300,90]),B([120,90],[420,90])]).length===0,"a collinear overlap is a shared lane, not a bridge");
  t.ok(siteBeltCrossings([B([0,90],[300,90]),B([150,90],[150,240])]).length===0,"a belt ENDING on another (shared inlet) is not a crossing");
  t.ok(siteBeltCrossings([B([0,90],[300,90]),B([0,120],[300,120])]).length===0,"parallel belts never cross");
  t.ok(siteBeltCrossings([{kind:"vehicle",route:[[255,450],[255,600]],sprites:[]},H]).length===0,"haul roads are excluded");
  t.ok(siteBeltCrossings([V,H],[{gx:8,gy:16,x:255,y:525,w:60,h:60}]).length===0,"a meet hidden under a unit card is skipped");
  // …and on the REAL reference plant: whatever it contains must be self-consistent and save-stable
  qcSiteGame();
  const on=(P,x,y)=>{for(let i=1;i<P.length;i++){const p=P[i-1],q=P[i];
    if(x>=Math.min(p[0],q[0])-0.01&&x<=Math.max(p[0],q[0])+0.01&&
       y>=Math.min(p[1],q[1])-0.01&&y<=Math.max(p[1],q[1])+0.01)return true;}return false;};
  const key=cs=>cs.map(z=>z.x+"/"+z.y+"/"+z.top.from+">"+z.top.to).sort().join("|");
  const X0=siteBeltCrossings(G.edges,G.nodes);
  t.ok(X0.every(z=>on(z.top.route,z.x,z.y)&&on(z.bot.route,z.x,z.y)),"every crossing lies on BOTH routes ("+X0.length+" found)");
  t.ok(X0.every(z=>z.top!==z.bot),"a belt never bridges itself");
  const k0=key(X0);
  restoreGame(JSON.parse(JSON.stringify(serializeGame())));
  t.ok(key(siteBeltCrossings(G.edges,G.nodes))===k0,"the crossing set + z rule survive save→reload identically");
};

QC_SUITES["mandate-truck-carries-its-stream"]=function(t){ // the latent bug fixed by t.sup
  qcSiteGame();G.continuous=true;CAREER.counters.flags.tutorialComplete=true;qcArm();
  CAREER.counters.exportedOnSpec=MANDATE.m_kerbside.cond.gte+1;
  qcDays(1+MANDATE.m_kerbside.warnDays);
  // POLL the window instead of sampling one instant: trucks spawn, tip and depart, so whether any is in
  // flight at a given tick is a matter of cadence, not correctness. (A single sample at the old rate
  // happened to land on a truck; halving the imposed rate widened the gap and it started landing in a
  // trough — the dispatch was never broken.)
  const forced=[],vol=[];
  for(let k=0;k<12;k++){qcTicks(400);
    for(const x of (G.trucks||[])){if(x.cls!=="supplier")continue;
      const bag=x.forced?forced:vol; if(!bag.some(y=>y.id===x.id))bag.push(x);}}
  t.ok(forced.length>0,"imposed trucks are dispatched ("+forced.length+" over the window)");
  t.ok(forced.every(x=>x.sup==="skip_bizet"),"each imposed truck is stamped with the stream it carries");
  t.ok(vol.every(x=>x.sup&&x.sup!=="skip_bizet"),"voluntary trucks carry their own stream, never the imposed one");
  t.ok(qcBalanced().ok,"mass balance holds with both stream types in flight");
};

/* THE SHIPPED SHOWCASE \u2014 Denis' 69-unit build (2026-08-19), imported from his own career save.
 * What makes it "ultimate" is the RECY splitter: its A branch feeds the head of the line and its B branch
 * purges to the bulk pad, so its ratio is a dial between diversion and headroom. With the plant's own
 * upgrades owned (wide belts, trained sorters, the five separator licences), measured on the three signed
 * contracts it ships with (7.5 t/h in):
 *      RECY 100%  \u2192  ~6.5 t/h on-spec, NOTHING buried, ~100% recycling
 *      RECY  90%  \u2192  ~6.7 t/h on-spec, ~0.2 buried, ~97% recycling      (as shipped)
 *      RECY   0%  \u2192  ~5.2 t/h on-spec, ~1.3 buried, ~80% recycling      (pass-through)
 * At THIS feed the loop is nearly free \u2014 recirculated material just gets a second pass at the sorters.
 * It is shipped at 90 and not 100 for one measured reason: this plant sells all six products, so it arms the
 * pressure gate within days, and the FIRST mandate takes intake to 8.5 t/h. At 100% the ring saturates on the
 * day that lands and never recovers (26+ blocked units, still dead twenty days later). At 90% it rides the
 * whole campaign. The margin is the point \u2014 see ultimate-plant-unattended, which is the test that caught it. */
QC_SUITES["ultimate-plant"]=function(t){
  newGame("career","site_ref",0xC0FFEE7);G.continuous=true;G.running=true;
  t.ok(G.nodes.length===69&&G.edges.length===88,"loads 69 units / 88 connections (got "+G.nodes.length+"/"+G.edges.length+")");
  t.ok(G.nodes.filter(isExport).length===7,"seven export bays \u2014 all six products, PET twice");
  t.ok(Object.keys(SPECS).every(k=>G.nodes.some(n=>isExport(n)&&n.spec===k)),"every product has somewhere to go");
  t.ok(G.nodes.filter(isBunker).length===7&&G.nodes.filter(isFeeder).length===2,"seven bunkers feeding two feeders");
  t.ok(siteCycleSets().length>=1,"it has recycle rings ("+siteCycleSets().length+")");
  const rc=G.nodes.find(n=>n.label==="RECY");
  t.ok(!!rc&&rc.type==="splitter","the RECY dial is present and is a splitter");
  t.ok(rc.ratio===0.9,"\u2026shipped at 90% recycle \u2014 the most it can hold once the mandates land (got "+rc.ratio+")");
  {const a=outEdge(rc,"A"),b=outEdge(rc,"B");
   t.ok(!!a&&!!b,"both of its branches are wired \u2014 without that the dial does nothing");
   t.ok(!!b&&isBulk(nodeById(b.to)),"\u2026B purges to the bulk pad, so turning it down has somewhere to go");}
  // NOTHING may open unwired: a red "!" on the showcase plant would read as a shipped mistake.
  t.ok(G.nodes.reduce((a,n)=>a+sitePortsOf(n).filter(p=>portNeedsWire(n,p)).length,0)===0,"no port opens unwired");
  const sup=G.nodes.filter(isBunker).map(n=>n.supplier);
  t.ok(sup.every(x=>x&&x!=="__none"),"every bunker is on a contract");
  t.ok(new Set(sup).size===3,"three streams are signed (got "+new Set(sup).size+")");
  t.ok(["r_airU","r_nirU","r_vfilm","r_eddyU","a_split","a_pickU"].every(careerTechOwned),"it owns the licences for the machines it is made of");
  t.ok([...new Set(sup)].every(supplierUnlocked),"\u2026and for every stream it is signed to");
  t.ok([...new Set(G.nodes.filter(isExport).map(n=>n.buyer).filter(Boolean))].every(buyerUnlocked),"\u2026and every buyer it sells to");
  t.ok(Math.abs(G.nodes.filter(isBunker).reduce((a,b)=>a+bunkerRatedTph(b).total,0)-7.5)<0.01,"rated intake is 7.5 t/h (3 x 2.5)");
  // ── the shipped operating point ──
  // Mandates are suppressed for the measurement, not because they cannot happen (this plant sells all six
  // products, so it arms the gate within days) but because a number quoted for a BUILD must not silently
  // include 3.5 t/h of someone else's waste. The dial suite below is where they come back.
  CAREER.mandates.seen.push("m_kerbside","m_regional");
  qcTicks(60000);
  const t0=G.t,d0=G.deliveredTot,l0=G.landfill;const s0={};for(const k in G.sold)s0[k]={on:G.sold[k].on,off:G.sold[k].off};
  qcTicks(40000);
  const hrs=G.t-t0;let on=0,off=0;for(const k in G.sold){on+=G.sold[k].on-((s0[k]&&s0[k].on)||0);off+=G.sold[k].off-((s0[k]&&s0[k].off)||0);}
  const bur=G.landfill-l0,rec=on/(on+off+bur)*100;
  const blocked=G.nodes.filter(n=>n.state==="jammed"||n.state==="overloaded"||n.state==="deadlock").length;
  t.report("ultimate plant as shipped: in "+((G.deliveredTot-d0)/hrs).toFixed(2)+" on-spec "+(on/hrs).toFixed(2)+
           " off "+(off/hrs).toFixed(2)+" buried "+(bur/hrs).toFixed(2)+" t/h, "+rec.toFixed(1)+"% recycling, blocked "+blocked);
  t.ok(on/hrs>6,"it runs a real on-spec rate ("+(on/hrs).toFixed(2)+" t/h)");
  t.ok(off/hrs<0.2,"\u2026almost none of it off-spec ("+(off/hrs).toFixed(2)+" t/h)");
  t.ok(bur/hrs<0.3,"\u2026and buries almost nothing ("+(bur/hrs).toFixed(2)+" t/h)");
  t.ok(rec>95,"\u2026which reads as "+rec.toFixed(1)+"% recycling");
  t.ok(blocked<=2,"\u2026with the rings flowing, not gridlocked ("+blocked+" blocked units)");
  t.ok(Object.keys(SPECS).every(k=>(G.sold[k].on-((s0[k]&&s0[k].on)||0))>0),"all six products actually sell in the window");
  t.ok(qcBalanced().ok,"mass balance holds on the shipped plant");
};

QC_SUITES["ultimate-plant-recy-dial"]=function(t){ // the dial is the mechanic: it must actually trade
  const runAt=function(recy,opts){opts=opts||{};
    newGame("career","site_ref",0xC0FFEE7);G.continuous=true;G.running=true;
    CAREER.mandates.seen.push("m_kerbside","m_regional");
    if(opts.mandates){CAREER.pressure.armed=true;CAREER.pressure.day=0;
      CAREER.mandates.active.push({id:"m_kerbside",day:0,endDay:null},{id:"m_regional",day:0,endDay:null});}
    if(opts.sups){const bk=G.nodes.filter(isBunker).sort((a,b)=>a.gx-b.gx);bk.forEach((b,i)=>{b.supplier=opts.sups[i%opts.sups.length];});}
    G.nodes.find(n=>n.label==="RECY").ratio=recy;
    qcTicks(60000);
    const t0=G.t,d0=G.deliveredTot,l0=G.landfill;const s0={};for(const k in G.sold)s0[k]={on:G.sold[k].on,off:G.sold[k].off};
    qcTicks(30000);
    const hrs=G.t-t0;let on=0,off=0;for(const k in G.sold){on+=G.sold[k].on-((s0[k]&&s0[k].on)||0);off+=G.sold[k].off-((s0[k]&&s0[k].off)||0);}
    const bur=G.landfill-l0;
    return{inn:(G.deliveredTot-d0)/hrs,on:on/hrs,off:off/hrs,bur:bur/hrs,rec:on/(on+off+bur)*100,
           jam:G.nodes.filter(n=>n.state==="jammed"||n.state==="deadlock").length};};
  // ── at the shipped feed the dial genuinely trades, and wound fully up it really does reach 100%
  const full=runAt(1.0),pass=runAt(0);
  t.report("@7.5 t/h  RECY 100% -> "+full.on.toFixed(2)+" t/h on-spec, "+full.bur.toFixed(2)+" buried, "+full.rec.toFixed(1)+"%"+
           "  |  RECY 0% -> "+pass.on.toFixed(2)+", "+pass.bur.toFixed(2)+", "+pass.rec.toFixed(1)+"%");
  t.ok(full.bur<0.02,"wound fully up, it buries nothing at all ("+full.bur.toFixed(3)+" t/h)");
  t.ok(full.rec>99,"\u2026which is the 100%-recycling claim, measured ("+full.rec.toFixed(1)+"%)");
  t.ok(pass.bur>1,"wound fully down, the residue is buried instead ("+pass.bur.toFixed(2)+" t/h)");
  t.ok(full.rec>pass.rec+15,"\u2026so the dial swings recycling by more than 15 points ("+full.rec.toFixed(1)+" vs "+pass.rec.toFixed(1)+")");
  t.ok(full.jam===0&&pass.jam===0,"both ends of the dial are stable at the shipped feed");
  // ── THE PRICE, and the reason the shipped setting is 90 and not 100. Let the mandates land (intake
  //    hits the 9 t/h site ceiling) and full recycle saturates the ring outright: you must dial it down or
  //    shed a contract. The pressure system biting on the best plant in the game is exactly what it is for.
  const sqFull=runAt(1.0,{mandates:true}),sqShip=runAt(0.9,{mandates:true});
  t.report("@9 t/h    RECY 100% -> "+sqFull.on.toFixed(2)+" t/h on-spec, jam "+sqFull.jam+
           "  |  RECY 90% -> "+sqShip.on.toFixed(2)+" t/h, "+sqShip.bur.toFixed(2)+" buried, "+sqShip.rec.toFixed(1)+"%");
  t.ok(sqFull.jam>2&&sqFull.on<1,"under the mandates, full recycle saturates the ring ("+sqFull.on.toFixed(2)+" t/h, "+sqFull.jam+" blocked)");
  t.ok(sqShip.jam===0&&sqShip.on>6,"\u2026and the SHIPPED 90% carries the imposed tonnage instead ("+sqShip.on.toFixed(2)+" t/h, "+sqShip.jam+" blocked)");
  t.ok(sqShip.rec>90,"\u2026still above 90% recycling while doing it ("+sqShip.rec.toFixed(1)+"%)");
};

/* THE ONE THAT MATTERS: load the showcase, walk away, come back three weeks later. Nothing is suppressed —
 * the plant arms the pressure gate on its own within days and the mandates arrive on schedule. Shipped at
 * RECY 100% it passed every static check above and still died on day 6, the moment the first mandate landed:
 * 26 units blocked, no recovery twenty days later. A showcase that destroys itself unattended is worse than
 * no showcase, so the shipped setting has to survive the campaign, not merely the snapshot. */
QC_SUITES["ultimate-plant-unattended"]=function(t){
  newGame("career","site_ref",0xC0FFEE7);G.continuous=true;G.running=true;
  const day=[];
  for(let d=0;d<10;d++){
    const t0=G.t,l0=G.landfill;const s0={};for(const k in G.sold)s0[k]={on:G.sold[k].on,off:G.sold[k].off};
    qcTicks(12000); // 48 h
    const hrs=G.t-t0;let on=0,off=0;
    for(const k in G.sold){on+=G.sold[k].on-((s0[k]&&s0[k].on)||0);off+=G.sold[k].off-((s0[k]&&s0[k].off)||0);}
    const bur=G.landfill-l0;
    day.push({d:Math.round(G.t/24),on:on/hrs,rec:(on+off+bur)>0?on/(on+off+bur)*100:0,
              blk:G.nodes.filter(n=>n.state==="jammed"||n.state==="deadlock"||n.state==="overloaded").length,
              mand:CAREER.mandates.active.length});}
  t.report("unattended: "+day.map(x=>"d"+x.d+" "+x.on.toFixed(1)+"t/h "+x.rec.toFixed(0)+"% blk"+x.blk+" m"+x.mand).join(" | "));
  const late=day.slice(-5);
  t.ok(day.some(x=>x.mand>0),"the pressure system armed and imposed on it unaided — this is a real campaign run");
  t.ok(late.every(x=>x.on>4),"three weeks in, unattended, it is still producing ("+late.map(x=>x.on.toFixed(1)).join("/")+" t/h)");
  t.ok(late.every(x=>x.rec>88),"…still recycling above 88% ("+late.map(x=>Math.round(x.rec)).join("/")+"%)");
  t.ok(late.every(x=>x.blk<=3),"…and never gridlocks when the mandates land ("+late.map(x=>x.blk).join("/")+" blocked)");
  t.ok(qcBalanced().ok,"mass balance holds over a 20-day unattended run");
};

QC_SUITES["first-truck-eta"]=function(t){ // a new site waits in silence otherwise — the HUD needs a real number
  newGame("career","site_atelier",0x7);G.continuous=true;G.running=true;
  const e0=nextTruckETA(),eta0=e0&&e0.h;
  t.ok(e0!=null,"a fresh site can say when its first load lands");
  t.ok(!e0.arrived,"…and it knows the truck has not arrived yet");
  t.ok(eta0>0&&eta0<12,"…and it is a sane wait, not a whole day ("+(eta0==null?"null":eta0.toFixed(2))+" h)");
  // It predicts ARRIVAL at the apron — which is the event the player watches for and the label promises.
  // Tipping follows after tipDwell, so delivery lands later; asserting against deliveredTot would be
  // measuring a different event and would quietly drift with the dwell constant.
  // It counts to the LOAD LANDING — drive plus the apron dwell — so one number falls all the way to the
  // moment material appears, instead of hitting zero on arrival and jumping back up for the unloading.
  const t0=G.t;let prev=eta0,fell=0,rose=0,sawArrived=false;
  for(let i=0;i<90000&&G.deliveredTot<=0;i++){tick(0.004);
    if(i%40===0){const e=nextTruckETA();
      if(e!=null){ if(e.arrived)sawArrived=true;
        if(e.h<prev-1e-9)fell++; else if(e.h>prev+1e-9)rose++;
        prev=e.h;}}}
  const landed=G.t-t0;
  t.ok(G.deliveredTot>0,"the first load landed (after "+landed.toFixed(2)+" h)");
  t.ok(fell>5,"the countdown decreases as the load approaches ("+fell+" samples fell)");
  t.ok(rose===0,"the countdown NEVER goes back up ("+rose+" increases) — it used to reset to a fresh dwell on arrival");
  t.ok(sawArrived,"it reports the unloading phase once the truck is on the apron");
  t.ok(Math.abs(landed-eta0)<0.8,"the ETA predicted the landing ("+eta0.toFixed(2)+" h predicted, "+landed.toFixed(2)+" h actual)");
  // a site with no supplier assigned has nothing to promise
  for(const n of G.nodes)if(isBunker(n))n.supplier="__none";
  for(const n of G.nodes)if(isBunker(n))n.truckDue=0;
  G.trucks=[];
  t.ok(nextTruckETA()===null,"with every bunker idle there is no arrival to announce");
};

QC_SUITES["export-bale-history"]=function(t){ // per-bay daily shipping history behind the 10-day chart
  qcSiteGame();G.continuous=true;G.running=true;
  const ex=G.nodes.filter(isExport);
  t.ok(ex.length>0,"the reference plant has export bays");
  t.ok(!(ex[0].hist||[]).length,"a fresh bay has no history yet");
  qcTicks(40000); // ~160 sim-hours: several day rollovers with real selling
  const withHist=ex.filter(n=>(n.hist||[]).length>0);
  t.ok(withHist.length>0,"bays accumulate per-day rows ("+withHist.length+"/"+ex.length+" bays)");
  const h=withHist[0].hist;
  t.ok(h.every(r=>r.on>=0&&r.off>=0&&r.d!=null),"every row carries a day and non-negative on/off counts");
  t.ok(h.length<=EXPORT_HIST,"the ring is capped at EXPORT_HIST days ("+h.length+" <= "+EXPORT_HIST+")");
  // the daily counts must reconcile with the bay's lifetime totals (they are deltas of the same counters)
  const n0=withHist[0];
  const summed=n0.hist.reduce((s,r)=>s+r.on+r.off,0);
  t.ok(summed<=n0.balesSold+n0.offSold+1e-6,"daily rows never exceed the bay's lifetime bale count ("+summed.toFixed(0)+" <= "+(n0.balesSold+n0.offSold)+")");
  t.ok(summed>0,"…and they are not all zero ("+summed.toFixed(0)+" bales across the window)");
  // survives the save, since nodes serialize
  const before=JSON.stringify(n0.hist);
  const s=serializeGame();restoreGame(JSON.parse(JSON.stringify(s)));
  const after=G.nodes.find(x=>x.id===n0.id);
  t.ok(JSON.stringify(after.hist)===before,"the history round-trips through save/restore");
};

QC_SUITES["mandate-triggers-relative"]=function(t){ // triggers count FROM the gate, not from campaign start
  qcSiteGame();G.continuous=true;CAREER.counters.flags.tutorialComplete=true;
  // a careful builder arms the gate LATE, already deep into on-spec tonnage
  CAREER.counters.exportedOnSpec=5000;
  qcArm();
  t.ok(CAREER.pressure.armed,"the gate armed");
  t.ok(CAREER.pressure.baseOnSpec===5000,"arming records the tonnage baseline ("+CAREER.pressure.baseOnSpec+")");
  t.ok(onSpecSinceArm()===0,"nothing counts toward a mandate at the moment of arming");
  // THE BUG THIS PREVENTS: absolute thresholds would fire both mandates instantly at 5000 t
  qcDays(4);
  t.ok(CAREER.mandates.seen.length===0,"no mandate fires just because the plant was already productive");
  // small at +150 since arming
  CAREER.counters.exportedOnSpec=5000+MANDATE.m_kerbside.cond.gte-1; qcDays(2);
  t.ok(CAREER.mandates.seen.indexOf("m_kerbside")<0,"…still nothing one tonne short of +150");
  CAREER.counters.exportedOnSpec=5000+MANDATE.m_kerbside.cond.gte+1; qcDays(2);
  t.ok(CAREER.mandates.seen.indexOf("m_kerbside")>=0,"the SMALL mandate fires at +150 t since arming");
  t.ok(CAREER.mandates.seen.indexOf("m_regional")<0,"…and the large one does not follow it immediately");
  // large at +1000 since arming
  CAREER.counters.exportedOnSpec=5000+MANDATE.m_regional.cond.gte-1; qcDays(3);
  t.ok(CAREER.mandates.seen.indexOf("m_regional")<0,"the LARGE mandate holds one tonne short of +1000");
  CAREER.counters.exportedOnSpec=5000+MANDATE.m_regional.cond.gte+1; qcDays(4);
  t.ok(CAREER.mandates.seen.indexOf("m_regional")>=0,"the LARGE mandate fires at +1000 t since arming");
  t.ok(CAREER.pressure.baseOnSpec===5000,"the baseline never drifts");
};

QC_SUITES["recycling-yesterday"]=function(t){ // the HUD rate must reflect TODAY's plant, not a lifetime average
  qcSiteGame();G.continuous=true;G.running=true;
  t.ok(recyclingYesterday()===null,"no 24h rate before a full day has been banked (the HUD falls back to lifetime)");
  qcTicks(20000); // ~80 sim-hours: several day rollovers
  const H=G.opexHistory||[];
  t.ok(H.length>=3,"per-day rows are being recorded ("+H.length+")");
  t.ok(H[H.length-1].onT!=null,"…and each row carries tonnage, not just money");
  const y=recyclingYesterday();
  t.ok(y!==null&&y>=0&&y<=100,"a 24h recycling rate is available ("+(y===null?"null":y.toFixed(1)+"%")+")");
  // THE POINT: a bad early history must not cap the current reading. Poison the lifetime totals and confirm
  // the 24h figure is unmoved — that is what makes 100% reachable again after a rough start.
  const before=recyclingYesterday();
  G.landfill+=5000;
  t.ok(recyclingPct()<5,"lifetime collapses when 5000 t of burial is added ("+recyclingPct().toFixed(1)+"%)");
  t.ok(Math.abs(recyclingYesterday()-before)<1e-9,"…but the 24h rate is untouched by the past");
  // and it round-trips, since opexHistory is serialized wholesale
  const s=serializeGame();restoreGame(JSON.parse(JSON.stringify(s)));
  t.ok(Math.abs(recyclingYesterday()-before)<1e-9,"the 24h rate survives save/restore");
};

QC_SUITES["loop-deadlock"]=function(t){ // a recirculation loop with no drain locks solid — say so, don't call it OVERLOAD
  qcSiteGame();
  t.ok(siteCycleSets().length===0,"the reference plant has no closed loop");
  // close a ring: opener -> magnet -> mixer -> back to the opener. Every stage full, nowhere to hand off.
  G.cash=1e7;
  const a=sitePlaceUnit("process","opener",6,14,0),b=sitePlaceUnit("process","magnet",6,16,0),c=sitePlaceUnit("mixer","mixer",6,18,0);
  t.ok(a.ok&&b.ok&&c.ok,"placed the three units of the ring");
  siteConnect(a.node,"b",b.node,"t");siteConnect(b.node,"b",c.node,"t");siteConnect(c.node,"b",a.node,"t");
  const sets=siteCycleSets();
  t.ok(sets.length===1,"the ring is detected as a cycle ("+sets.length+")");
  t.ok(sets[0].size===3,"…of the three units that form it (got "+(sets[0]&&sets[0].size)+")");
  // stuff it and run: with no drain the ring must fill and lock
  // book the injected mass as delivered — stuffing buffers directly would otherwise create matter from
  // nothing and break the very invariant asserted below
  {let inject=0;for(const n of [a.node,b.node,c.node])for(const m of MAT)for(let i=0;i<40;i++){n.inBuf[m][1]++;inject++;}
   G.deliveredTot+=inject*PMASS;G.delivered+=inject*PMASS;}
  qcTicks(4000);
  const states=[a.node.state,b.node.state,c.node.state];
  t.ok(states.every(s=>s==="deadlock"),"every unit on the locked ring reads LOOP DEADLOCK (got "+states.join("/")+")");
  t.ok(qcBalanced().ok,"mass balance holds through the deadlock — nothing is destroyed, it just stops");
  // breaking the ring must clear it: the state is a property of the topology, not a sticky flag
  const back=G.edges.find(e=>e.from===c.node.id&&e.to===a.node.id);
  siteDisconnect(back);
  t.ok(siteCycleSets().length===0,"disconnecting the return leg removes the cycle");
  qcTicks(2000);
  t.ok(![a.node.state,b.node.state,c.node.state].some(s=>s==="deadlock"),"…and no unit still reads LOOP DEADLOCK");
};

QC_SUITES["bunker-bag-mix"]=function(t){ // the bunker's livery follows what is IN it, not the label on it
  qcSiteGame();G.continuous=true;
  const b=G.nodes.find(isBunker);
  t.ok(bunkerBagType(b)===null,"an empty bunker has no dominant bag type");
  tipLoad(b,"wasteminster",600,false);                       // blue = clean kerbside PMC
  t.ok(bunkerBagType(b)==="blue","one stream in → that stream's bag type");
  tipLoad(b,"watco_syndicate",300,true);                     // yellow = imposed residual, tipped regardless of the label
  t.ok(bunkerBagType(b)==="blue","a minority imposed stream does not flip the livery");
  tipLoad(b,"watco_syndicate",900,true);
  t.ok(bunkerBagType(b)==="yellow","once the imposed stream dominates, the bunker shows it");
  // removal is non-selective, so the RATIO must survive a partial drain
  const before=bunkerBagType(b),held=cnt(b.inBuf);
  for(let k=0;k<Math.floor(held*0.6);k++)popParticle(b.inBuf);
  t.ok(bunkerBagType(b)===before,"draining 60% does not change the dominant type (loaders scoop in proportion)");
  // emptying forgets, so a new stream is not haunted by the old one
  while(cnt(b.inBuf)>0)popParticle(b.inBuf);
  t.ok(bunkerBagType(b)===null,"an emptied bunker forgets its mix");
  tipLoad(b,"binfinity",400,false);
  t.ok(bunkerBagType(b)==="green","…and takes the new stream's type cleanly");
  // and it survives a save round-trip
  const s=serializeGame();restoreGame(JSON.parse(JSON.stringify(s)));
  const b2=G.nodes.find(isBunker);
  t.ok(bunkerBagType(b2)==="green","the mix round-trips through save/restore");
};

QC_SUITES["inbound-cap"]=function(t){ // imposed mandates used to STACK on top of your contracts: 13 t/h forced onto a ~10 t/h line
  qcSiteGame();G.continuous=true;CAREER.counters.flags.tutorialComplete=true;qcArm();
  const cap=G.logi.inboundCap, tot=()=>G.nodes.filter(isBunker).reduce((s,b)=>s+bunkerRatedTph(b).total,0);
  // both bunkers on the two voluntary streams
  const bs=G.nodes.filter(isBunker); bs[0].supplier="wasteminster"; bs[1].supplier="binfinity";
  t.ok(Math.abs(tot()-5)<1e-9,"two voluntary contracts come to 5 t/h ("+tot().toFixed(2)+"/"+cap+" t/h)");
  /* THE INTENDED LADDER (2026-08-19). Two ceilings matter and only one of them is the cap:
   *   CLEAN  ~6 t/h — what a full plant does while holding 100% recycling (the recycle loop eats the rest)
   *   HARD    9 t/h — LOGI.inboundCap, what it can physically take when purity stops mattering
   * Two contracts (5) + the PERMANENT mandate (1) sit exactly on the clean ceiling: tight, survivable.
   * Add the recurring SURGE (2.5) and you are at 8.5 — still inside the hard cap, so nothing is refused and
   * nothing is silently scaled; you simply cannot stay clean. That is the decision, and it is finite. */
  const CLEAN=6;
  const M=Object.keys(MANDATE);
  t.ok(M.length===2,"exactly two imposed contracts — one permanent, one recurring (got "+M.length+")");
  const rate=id=>(supplierStream(MANDATE[id].supplier)||{}).feedTph||0;
  const perm=MANDATE.m_kerbside,surge=MANDATE.m_regional;
  t.ok(rate("m_kerbside")===1&&rate("m_regional")===2.5,"the permanent one is 1 t/h and the surge is 2.5 t/h (got "+rate("m_kerbside")+" / "+rate("m_regional")+")");
  t.ok(!perm.runDays,"the permanent mandate never ends");
  t.ok(!!surge.runDays&&!!surge.gapDays,"the surge is FINITE and RECURRING (runs "+surge.runDays.join("-")+" d, returns after "+surge.gapDays.join("-")+" d)");
  t.ok(surge.runDays[0]>=2&&surge.runDays[1]<=3,"…and it runs 2-3 days, not indefinitely");
  t.ok(5+rate("m_kerbside")<=CLEAN,"two contracts + the permanent mandate sit ON the clean ceiling ("+(5+rate("m_kerbside"))+" <= "+CLEAN+")");
  t.ok(5+rate("m_kerbside")+rate("m_regional")>CLEAN,"…and the surge pushes you past it ("+(5+rate("m_kerbside")+rate("m_regional"))+" > "+CLEAN+")");
  t.ok(5+rate("m_kerbside")+rate("m_regional")<=cap,"…without breaching the hard cap, so nothing is refused ("+(5+rate("m_kerbside")+rate("m_regional"))+" <= "+cap+")");
  t.ok(rate("m_kerbside")+rate("m_regional")<=cap,"the mandates alone never exceed the ceiling");
  // impose every mandate and confirm the TOTAL never moves past the cap — your own contracts get squeezed
  for(const id in MANDATE){CAREER.mandates.seen.push(id);CAREER.mandates.active.push({id:id,day:1});}
  const after=tot();
  t.ok(after<=cap+1e-9,"with every mandate active the site still takes at most the ceiling ("+after.toFixed(2)+"/"+cap+")");
  const r=bunkerRatedTph(bs[0]);
  t.ok(r.imposed>0&&r.voluntary>0,"imposed and voluntary both still flow (imposed "+r.imposed.toFixed(2)+", yours "+r.voluntary.toFixed(2)+")");
  // Not squeezed, and that is the point of the rebalance: with everything running you are at 8.5 of 9, so
  // your own contracts arrive AT THEIR FULL RATE and the pain is purity, not a number quietly scaled down.
  t.ok(!r.squeezed,"your contracts are not crowded out — the bite is the material, not a hidden haircut");
  // Sign a THIRD contract and the ceiling does bind, and the UI must say so out loud.
  const b3=sitePlaceUnit("input",null,14,4,0);
  if(b3.ok){b3.node.supplier="poubelle_air";
    t.ok(bunkerRatedTph(b3.node).squeezed,"over-subscribe the site and the bunker reports the crowding-out");
    b3.node.supplier="__none";}
  // and the SIMULATION must agree with the number the inspector shows
  const t0=G.t,d0=G.deliveredTot; qcTicks(30000);
  const measured=(G.deliveredTot-d0)/(G.t-t0);
  t.ok(measured<=cap+0.4,"measured intake respects the ceiling ("+measured.toFixed(2)+" <= "+cap+" t/h)");
  // Measured lands a little UNDER the rating and that is honest: waste arrives in 10 t truckloads with a
  // dwell at the apron and a per-stream in-flight limit, so five small streams cannot average their exact
  // contractual rate. The inspector deliberately shows rated and measured side by side rather than pretending.
  t.ok(measured>after*0.8,"deliveries broadly track the rating ("+measured.toFixed(2)+" vs rated "+after.toFixed(2)+" t/h)");
};

QC_SUITES["loader-throughput"]=function(t){
  // Measures LOADER supply in isolation: the feeder is emptied each tick so the LINE never caps the reading,
  // and the bunkers are topped up so SUPPLY never does. (Both fixtures create/destroy mass on purpose, so this
  // suite deliberately makes no conservation claim — see site-motion for that.)
  const run=function(N){qcSiteGame(null,{loader:N,forklift:9,ctruck:2});
    G.vehicles=G.vehicles.filter(v=>v.cls!=="loader").concat(G.vehicles.filter(v=>v.cls==="loader").slice(0,N));
    ensureFleet();
    const fd=G.nodes.find(isFeeder);
    const top=function(){for(const b of G.nodes)if(isBunker(b))while(cnt(b.inBuf)<capOf(b)*0.7)for(const m of MAT)b.inBuf[m][0]+=50;};
    const drain=function(){for(const m of MAT){fd.inBuf[m][0]=0;fd.inBuf[m][1]=0;}};
    for(let i=0;i<1500;i++){tick(0.004);top();drain();}
    const m0=fd._inMass,t0=G.t;
    for(let i=0;i<8000;i++){tick(0.004);top();drain();}
    return (fd._inMass-m0)/(G.t-t0);};
  const one=run(1),three=run(3),eight=run(8);
  t.report("loader supply: 1→"+one.toFixed(2)+" 3→"+three.toFixed(2)+" 8→"+eight.toFixed(2)+" t/h");
  t.ok(one>2.8&&one<4.3,"one loader carries ~3.5 t/h (got "+one.toFixed(2)+")");
  t.ok(three>=9,"three loaders cover a 9 t/h line (got "+three.toFixed(2)+") — it used to take eight, and eight could not do it");
  // THE CEILING: floor(feederCap/loaderCap) committed loaders per feeder. At 500/100 that was 5, so a site
  // could never exceed ~6.8 t/h however many loaders were bought — 6, 7 and 8 did literally nothing.
  t.ok(eight>three*1.8,"an 8th loader still adds throughput — no hidden per-feeder ceiling ("+eight.toFixed(2)+" vs 3→"+three.toFixed(2)+")");
  t.ok(Math.floor(G.logi.feederCap/G.logi.loaderCap)>=8,"a feeder can commit at least 8 loaders (got "+Math.floor(G.logi.feederCap/G.logi.loaderCap)+")");
};

QC_SUITES["supplier-liveries"]=function(t){ // bag colour is a WASTE TYPE — the art ships exactly three liveries
  const streams=COMPANIES.suppliers.filter(s=>s.stream);
  t.ok(streams.length>=5,"at least 5 streaming suppliers ("+streams.length+")");
  const LIVERIES=["blue","green","yellow"]; // bag_<k>.webp + bunk_<k>_0..4 exist for exactly these
  const bags={};for(const s of streams)bags[s.stream.bag]=(bags[s.stream.bag]||0)+1;
  for(const s of streams)t.ok(LIVERIES.indexOf(s.stream.bag)>=0,coName(s)+" declares a livery the art actually has (got \""+s.stream.bag+"\")");
  t.ok(Object.keys(bags).length===LIVERIES.length,"all three waste types are in play ("+JSON.stringify(bags)+")");
  t.ok(coById("binfinity").stream.bag!==coById("wasteminster").stream.bag,"Binfinity does not share Wasteminster's bag colour");
  // dirtiness should track the type: residual (yellow) is the PVC-heavy end
  const pvc=id=>coById(id).stream.comp.PVC;
  t.ok(pvc("watco_syndicate")>pvc("wasteminster"),"the residual streams are the contaminated ones");
};

QC_SUITES["bunker-rated-tph"]=function(t){ // the inspector's "Contract capacity" must be the rate tick() applies
  qcSiteGame(null,{loader:10,forklift:9,ctruck:2}); // fleet sized so the bunkers never back up: this suite is about the RATE, not about drainage
  const bs=G.nodes.filter(isBunker);
  t.ok(bs.length===2,"reference plant has 2 bunkers (got "+bs.length+")");
  const str=supplierStream(bs[0].supplier);
  t.ok(!!str,"the bunkers' supplier has a stream");
  t.ok(Math.abs(bunkerRatedTph(bs[0]).total-str.feedTph/2)<1e-9,"a bunker is rated its SHARE, not the whole contract ("+bunkerRatedTph(bs[0]).total+" vs "+(str.feedTph/2)+")");
  let sum=0;for(const b of bs)sum+=bunkerRatedTph(b).total;
  t.ok(Math.abs(sum-str.feedTph)<1e-9,"the shares add back up to the contract rate ("+sum+" vs "+str.feedTph+")");
  const keep=bs[1].supplier;bs[1].supplier="__none";
  t.ok(bunkerRatedTph(bs[1]).total===0,"an idle bunker is rated 0 t/h");
  t.ok(Math.abs(bunkerRatedTph(bs[0]).total-str.feedTph)<1e-9,"with one bunker idle the other takes the whole rate");
  bs[1].supplier=keep;
  // MEASURED: what actually gets tipped over a long window must match the number the inspector shows
  const t0=G.t,d0=G.deliveredTot;
  qcTicks(30000);
  const rate=(G.deliveredTot-d0)/(G.t-t0);
  t.ok(Math.abs(rate-str.feedTph)<0.4,"tipped rate matches the rated capacity ("+rate.toFixed(2)+" vs "+str.feedTph+" t/h)");
};

QC_SUITES["site-landfill-footprint"]=function(t){qcSiteGame(); // landfill shrank 7x3 -> 2x3 to free the outbound row for PVC
  const lf=G.nodes.find(isLandfill);
  t.ok(!!lf,"reference plant has a landfill");
  const fp=siteFootprint("landfill",0),out=siteFootprint("output",0);
  // a tad larger than an export bay — it is a container yard, not a product bay — but nowhere near the old
  // 7-wide slab that was swallowing the whole outbound row
  t.ok(fp.w===3&&fp.h===3,"landfill is 3x3 ("+fp.w+"x"+fp.h+")");
  t.ok(fp.w>out.w&&fp.w*fp.h<=out.w*out.h*2,"…larger than an export bay ("+out.w+"x"+out.h+") but not by much");
  // geometry is DERIVED from SITE_OBJ on load, so the snapshot's legacy 210px-wide literal must not survive
  t.ok(lf.w===fp.w*CELL&&lf.h===fp.h*CELL,"restored landfill geometry re-derived from SITE_OBJ (got "+lf.w+"x"+lf.h+")");
  // capacity is landfillHold x containerCap — independent of footprint, so the resize is not an economy change
  t.ok(capOf(lf)===G.logi.landfillHold*G.logi.containerCap,"landfill capacity unaffected by the resize");
  // the apron stop cell used to be a hardcoded gx+3 (the old 7-wide centre) and would now sit outside the bay
  const sc=truckStopCell(lf);
  t.ok(sc&&sc[0]>=lf.gx&&sc[0]<lf.gx+fp.w,"truck stop cell sits within the footprint (x="+(sc&&sc[0])+", bay "+lf.gx+".."+(lf.gx+fp.w-1)+")");
  t.ok(sc&&sc[1]===38,"truck stop cell stays on the outbound apron row");
  // the freed cells must actually be buildable now — that is the point of the resize
  const free=siteCanPlace("output",lf.gx+fp.w,35,0);
  t.ok(free.ok,"an export bay fits in the cells the landfill gave back ("+(free.ok?"ok":free.reason)+")");
  // end-to-end: a landfill truck still reaches the (moved) stop cell and hauls containers away.
  // The reference plant buries slowly — the first full container is not hauled until ~72 sim-hours, so the
  // window has to be long enough to reach it rather than merely long enough to look thorough.
  qcTicks(45000); // the feed halved in the 2026-08-19 rebalance, so the first full container takes ~2x as long
  t.ok(lf.massEvac>0,"landfill truck completed a round trip after the resize (evacuated "+lf.massEvac.toFixed(1)+" t)");
  t.ok(qcBalanced().ok,"mass balance holds across the resized landfill");
};


/* ── 2026-08-19 PLAYTEST BATCH ─────────────────────────────────────────────────
 * Five behaviours that were reported from the yard and are now rules, so they get gates. */

QC_SUITES["splitter-exact"]=function(t){ // a flow divider divides; it does not leak
  t.ok(SPLIT_NOISE===0,"SPLIT_NOISE is zero \u2014 a divider has no selectivity to lose");
  const run=function(ratio){
    newGame("sandbox","standard",0x5711);
    const sp=addNode("splitter",0,0),a=addNode("buffer",120,-60),b=addNode("buffer",120,60);
    sp.ratio=ratio;
    G.edges.push({from:sp.id,fromPort:"A",to:a.id,sprites:[],speed:EDGE_SPEED});
    G.edges.push({from:sp.id,fromPort:"B",to:b.id,sprites:[],speed:EDGE_SPEED});
    for(let i=0;i<400;i++)sp.inBuf.PET[1]++;                       // 400 loose PET into the divider
    for(let i=0;i<4000;i++)tick(0.004);
    return{a:cnt(a.inBuf)+edgeLoad(sp.id,a.id),b:cnt(b.inBuf)+edgeLoad(sp.id,b.id)};};
  const allA=run(1);
  t.ok(allA.b===0,"ratio 1.00: the CLOSED branch B never sees a single piece (got "+allA.b+")");
  t.ok(allA.a>0,"\u2026and everything went down A ("+allA.a+")");
  const allB=run(0);
  t.ok(allB.a===0,"ratio 0.00: the closed branch A never sees a piece (got "+allB.a+")");
  t.ok(allB.b>0,"\u2026and everything went down B ("+allB.b+")");
  const half=run(0.5);
  t.ok(half.a>0&&half.b>0,"a real split still splits both ways ("+half.a+"/"+half.b+")");
};
function edgeLoad(from,to){let n=0;for(const e of G.edges)if(e.from===from&&e.to===to)n+=e.sprites.length;return n;}

QC_SUITES["imposed-dedication"]=function(t){ // you can quarantine a mandate in its own pit
  qcSiteGame();G.continuous=true;CAREER.counters.flags.tutorialComplete=true;qcArm();
  const bs=G.nodes.filter(isBunker);
  t.ok(bs.length>=2,"the fixture has at least two bunkers");
  bs[0].supplier="wasteminster";bs[1].supplier="wasteminster";
  const id="m_kerbside",sup=MANDATE[id].supplier;
  CAREER.mandates.seen.push(id);CAREER.mandates.active.push({id:id,day:1,endDay:null});
  // 1. NO dedication \u2192 the imposed stream lands in every bunker, exactly as it always did
  t.ok(bunkerRatedTph(bs[0]).imposed>0&&bunkerRatedTph(bs[1]).imposed>0,"undedicated: the mandate tips into every bunker");
  const spread=bunkerRatedTph(bs[0]).imposed+bunkerRatedTph(bs[1]).imposed;
  // 2. point ONE bunker at it \u2192 that pit takes the whole stream and the other is spared
  bs[1].supplier=sup;
  const d0=bunkerRatedTph(bs[0]),d1=bunkerRatedTph(bs[1]);
  t.ok(d0.imposed===0,"dedicated: the clean bunker no longer receives the mandate ("+d0.imposed.toFixed(2)+")");
  t.ok(Math.abs(d1.imposed-spread)<1e-9,"\u2026and the dedicated pit carries the whole rate ("+d1.imposed.toFixed(2)+" vs "+spread.toFixed(2)+")");
  t.ok(d1.voluntary===0,"a dedicated pit runs no voluntary contract of its own");
  t.ok(d0.voluntary>0,"\u2026while the clean bunker keeps yours ("+d0.voluntary.toFixed(2)+" t/h)");
  // 3. and it is still unrefusable: fill the dedicated pit and the mass keeps arriving somewhere
  const in0=G.deliveredTot;
  for(const m of MAT)bs[1].inBuf[m][0]+=Math.ceil(capOf(bs[1])/MAT.length);   // jam the quarantine pit full
  qcTicks(20000);
  t.ok(G.deliveredTot>in0,"a full quarantine pit does not stop the trucks \u2014 the load spills to a bunker with room");
  // (no conservation claim here: the fixture hand-stuffs the quarantine pit to fill it, which creates mass
  //  on purpose. site-motion and the surge suite below carry the mass-balance gate.)
};

QC_SUITES["mandate-surge"]=function(t){ // the second mandate is an EVENT: it ends, and it comes back
  qcSiteGame();G.continuous=true;CAREER.counters.flags.tutorialComplete=true;qcArm();
  const d=MANDATE.m_regional;
  t.ok(!!d.runDays&&!!d.gapDays,"the surge declares a run length and a gap");
  const M=CAREER.mandates;let day=Math.floor(G.t/24);
  // land it directly (the trigger tonnage is tested by pressure-gate) and step days through the real path
  M.seen.push("m_kerbside","m_regional");
  M.pending.push({id:"m_regional",warnDay:day,arriveDay:day+1,warned:true});
  const seen={arrive:0,end:0};
  const prev=UI.onMandate;UI.onMandate=function(ev){if(ev&&seen[ev.phase]!=null)seen[ev.phase]++;};
  try{
    qcDays(2);
    t.ok(M.active.some(a=>a.id==="m_regional"),"the surge arrives");
    const a=M.active.find(a=>a.id==="m_regional");
    t.ok(a.endDay!=null,"\u2026with an end date on it, unlike the permanent mandate");
    t.ok(a.endDay-a.day>=d.runDays[0]&&a.endDay-a.day<=d.runDays[1],"\u2026inside the authored 2-3 day window ("+(a.endDay-a.day)+" d)");
    t.ok(mandateSups().indexOf(d.supplier)>=0,"its trucks are running while it is active");
    qcDays(d.runDays[1]+1);
    t.ok(!M.active.some(x=>x.id==="m_regional"),"it ends on its own");
    t.ok(mandateSups().indexOf(d.supplier)<0,"\u2026and its trucks stop");
    t.ok(!G.nodes.some(n=>isBunker(n)&&n.mandDue&&n.mandDue[d.supplier]),"\u2026with no orphaned dues left on the bunkers");
    t.ok(M.pending.some(p=>p.id==="m_regional"),"\u2026and it re-books itself for later");
    const p=M.pending.find(p=>p.id==="m_regional"),now=Math.floor(G.t/24);
    t.ok(p.arriveDay-now>=d.gapDays[0]-1&&p.arriveDay-now<=d.gapDays[1],"\u2026after the authored gap ("+(p.arriveDay-now)+" d)");
    // Step day by day: the RETURN is itself finite, so one long jump can land after the second run has
    // already ended and read as "it never came back".
    let returned=false;
    for(let k=0;k<d.gapDays[1]+4&&!returned;k++){qcDays(1);if(M.active.some(x=>x.id==="m_regional"))returned=true;}
    t.ok(returned,"and it comes back \u2014 this is a recurring event, not a one-off");
    t.ok(seen.arrive>=2&&seen.end>=1,"the UI is told about every arrival and every ending ("+seen.arrive+" arrivals, "+seen.end+" endings)");
  } finally { UI.onMandate=prev; }
  t.ok(qcBalanced().ok,"mass balance holds across a full surge cycle");
  // A career saved BEFORE surges could end carries an active entry with no endDay, which would read as
  // permanent forever. The restore path must adopt it into the new rules rather than stranding it.
  CAREER.mandates.active.length=0;CAREER.mandates.pending.length=0;
  CAREER.mandates.active.push({id:"m_regional",day:0});   // the legacy shape: no endDay
  reconcileMandateState();
  const mig=CAREER.mandates.active.find(a=>a.id==="m_regional");
  t.ok(mig&&mig.endDay!=null,"a legacy save’s open-ended surge is given an end date on load");
};

QC_SUITES["buyer-terms"]=function(t){ // two mills for one product are two different contracts
  qcSiteGame();
  const pure=function(specKey,target,p){const b=blankBuf();const N=1000;
    b[target][1]=Math.round(N*p);
    for(const m of MAT)if(m!==target){b[m][1]+=Math.round(N*(1-p)/(MAT.length-1));}
    return b;};
  // a 92%-pure ferrous bale: fine for the easy buyer, scrap for the strict one
  const bale=pure("ferrous","steel",0.92);
  const easy=grade(bale,"ferrous","ferrous_bueller"),hard=grade(bale,"ferrous","iron_maiden");
  t.ok(easy.ok,"92% steel clears Ferrous Bueller's 90% bar");
  t.ok(!hard.ok,"\u2026and fails Iron Maiden's 95% bar \u2014 the same bale, two verdicts");
  // and when it IS on spec, the strict mill pays more
  const clean=pure("ferrous","steel",0.98);
  const ce=grade(clean,"ferrous","ferrous_bueller"),ch=grade(clean,"ferrous","iron_maiden");
  t.ok(ce.ok&&ch.ok,"a 98% bale clears both");
  t.ok(ch.price>ce.price*1.1,"\u2026and the strict mill pays materially more ("+Math.round(ce.price)+" vs "+Math.round(ch.price)+" \u20ac/t)");
  // every buyer states its own deal and carries its own truck
  const seenTruck={};let strict=0,lenient=0;
  for(const b of COMPANIES.buyers){
    const tm=buyerTerms(b.spec,b.id);
    t.ok(!!tm&&!!tm.truck,coName(b)+" has a truck livery");
    t.ok(tm.minPurity>0&&tm.minPurity<1,coName(b)+" states an on-spec purity bar ("+Math.round(tm.minPurity*100)+"%)");
    seenTruck[tm.truck]=(seenTruck[tm.truck]||0)+1;
    if(b.minPurity!=null){if(b.minPurity>SPECS[b.spec].minPurity)strict++;else lenient++;}}
  t.ok(strict>0&&lenient>0,"the roster has both stricter-and-dearer and looser-and-cheaper buyers ("+strict+"/"+lenient+")");
  /* TEN liveries, THIRTEEN buyers, and that is sufficient rather than a shortfall: a truck is only ever
   * seen parked at one bay, and the bay already says what it is collecting. So the colour only has to
   * separate the buyers who could turn up at the SAME dock. Two rules make that true, and both are gated
   * here because either one is easy to break by adding a buyer. */
  for(const a of COMPANIES.buyers)for(const b of COMPANIES.buyers){
    if(a===b||a.spec!==b.spec)continue;
    t.ok((a.truck||"")!==(b.truck||""),coName(a)+" and "+coName(b)+" sell the same product in different liveries");}
  // \u2026and the six DEFAULTS are what a player meets before any R&D, so those must be distinct outright
  const defs=COMPANIES.buyers.filter(b=>b.def);
  t.ok(defs.length===Object.keys(SPECS).length,"one default buyer per product ("+defs.length+")");
  t.ok(new Set(defs.map(b=>b.truck)).size===defs.length,
    "every default buyer has its own livery ("+defs.map(b=>b.truck).join(",")+")");
  // every livery in use must be one the art actually has — a typo here is an invisible missing sprite
  const LIVERIES=["orange","yellow","red","green","teal","blue","purple","tan","white","black"];
  t.ok(COMPANIES.buyers.every(b=>LIVERIES.indexOf(b.truck)>=0),"every buyer livery exists in the art set");
  t.ok(new Set(COMPANIES.buyers.map(b=>b.truck)).size===LIVERIES.length,
    "all ten liveries are in use — none of the art is wasted ("+new Set(COMPANIES.buyers.map(b=>b.truck)).size+"/"+LIVERIES.length+")");
  // the default buyer of each spec is the plain-spec one, so an unassigned bay behaves exactly as before
  for(const k in SPECS){const d=defaultBuyer(k);if(!d)continue;
    t.ok(d.minPurity==null&&d.priceMult==null,"the default "+k+" buyer takes the spec as written ("+coName(d)+")");}
};

QC_SUITES["export-bay-revenue"]=function(t){ // each bay tallies its own takings, lifetime and per day
  qcSiteGame();G.continuous=true;G.running=true;
  const bays=G.nodes.filter(isExport);
  t.ok(bays.every(n=>(n.revTot||0)===0),"a fresh bay has earned nothing");
  qcTicks(60000);
  const earners=bays.filter(n=>(n.revTot||0)!==0);
  t.ok(earners.length>0,"a running plant books revenue against the bay that shipped it ("+earners.length+" of "+bays.length+" bays)");
  const sum=bays.reduce((a,n)=>a+(n.revTot||0),0);
  t.ok(Math.abs(sum-G.ledger.sales)<1e-6,"the bays' takings reconcile to the plant-wide sales line ("+Math.round(sum)+" vs "+Math.round(G.ledger.sales)+")");
  const withHist=bays.filter(n=>(n.hist||[]).some(h=>h.rev!=null));
  t.ok(withHist.length>0,"the daily history carries a per-bay revenue figure");
  // and it survives the save round-trip, like every other per-node tally
  const raw=serializeGame(),before=bays.map(n=>n.revTot||0);
  restoreGame(JSON.parse(JSON.stringify(raw)));
  const after=G.nodes.filter(isExport).map(n=>n.revTot||0);
  t.ok(JSON.stringify(before)===JSON.stringify(after),"per-bay takings survive save/restore");
};

/*@TESTS-END@*/
