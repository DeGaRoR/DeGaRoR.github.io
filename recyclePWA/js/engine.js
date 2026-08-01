
"use strict";
/* ╔══════════════════════════════════════════════════════════════════════════╗
 * ║  RECYCLE — NON-NEGOTIABLES (NNG). The 6 rules no change may violate.        ║
 * ║  These are the code-level distillation; RECYCLE_BIBLE.md holds the fuller   ║
 * ║  design-level set. If a feature needs one of these bent, it's the wrong     ║
 * ║  feature. (Kept to 6 deliberately — see the note below the list.)           ║
 * ╠══════════════════════════════════════════════════════════════════════════╣
 * ║  ── CORE (truth of the simulation) ──                                       ║
 * ║  NNG-1  MASS IS CONSERVED. Every item reaches exactly one sink; transforms  ║
 * ║         never fabricate or vanish mass; sinks tally tonnage + composition.  ║
 * ║         The gated transfer exists to enforce this: a move commits only when ║
 * ║         the source HAS the item AND the destination HAS room (checked       ║
 * ║         before release) — backpressure/starvation are emergent, never faked.║
 * ║  NNG-2  WYSIWYG, EMERGENT, NEVER SCRIPTED. The screen is the real sim state.║
 * ║         Stalls, jams, deadlocks fall out of the rules, not scripted events; ║
 * ║         the renderer may draw a subset under load but NEVER a fabricated     ║
 * ║         item, and never a silent freeze (every stall is a named state).     ║
 * ║  NNG-3  THE MONEY IS REAL AND RECONCILES. Every cash flow is weight-based   ║
 * ║         (mass × rate); the P&L reconciles to cash to the cent; rates are    ║
 * ║         anchored to real Belgium figures and live in ONE central ECON block ║
 * ║         (the single tunable source of truth). Tipping in / disposal out are ║
 * ║         both charged on actual weight.                                      ║
 * ║  ── CODE STRUCTURE ──                                                        ║
 * ║  NNG-4  ENGINE IS PURE; UI IS A SEPARATE LAYER. The ENGINE block carries    ║
 * ║         zero DOM and talks out only through the UI{} hook object. The        ║
 * ║         harness loads the engine block ALONE (between the @ENGINE-START@/    ║
 * ║         @ENGINE-END@ sentinels): a green suite in isolation PROVES the       ║
 * ║         decoupling. v1 ships as one file → PWA; that's not a licence to      ║
 * ║         couple.                                                             ║
 * ║  NNG-5  THE HARNESS IS THE ARBITER; NOTHING SHIPS RED. Behavioral changes   ║
 * ║         are validated headlessly before a session is done; runs are         ║
 * ║         deterministic per seed; balance-band changes are deliberate and     ║
 * ║         documented, never silent. Implement first, then test.               ║
 * ║  ── UI ──                                                                    ║
 * ║  NNG-6  THE PLAYER IS NEVER LIED TO AND NEVER DEAD-ENDED. Problems surface  ║
 * ║         as honest readable states (STARVED / JAMMED / BLINDED / WRONG-SIZE);║
 * ║         completion is tonnage-and-spec, never time-gated (tiers are         ║
 * ║         cosmetic); a cash crunch is recoverable, not a hard game-over.      ║
 * ╠══════════════════════════════════════════════════════════════════════════╣
 * ║  Why 6: each carries one rider so the real count of rules is ~12 — gated    ║
 * ║  transfers sit under NNG-1, named-states under NNG-2/6, central-config under ║
 * ║  NNG-3, single-file under NNG-4. Six crisp heads beat twelve nags nobody     ║
 * ║  rereads; the Bible keeps the exhaustive design list.                       ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */
/* RECYCLE — changelog: moved to CHANGELOG.md (repo root) at the v1.0.0 PWA split. New entries go there. */
/*@ENGINE-START@ ─────────────────────────────────────────────────────────────
 *  ENGINE — pure simulation + economy + save/serialize. NO DOM, NO canvas, NO
 *  render. Talks to the outside world only through the UI{} hook object (no-ops
 *  here; the browser layer overrides them). The test harness loads THIS BLOCK
 *  ALONE (between the @ENGINE-START@/@ENGINE-END@ sentinels) — if the suite is
 *  green on the engine in isolation, the decoupling is proven, not asserted.
 * ────────────────────────────────────────────────────────────────────────────*/
const VERSION="0.6.0-dev35";
const MAT=["PET","PVC","steel","film","paper","alu"];
const COL={PET:"#2F6FD1",PVC:"#E8C020",steel:"#5B6670",film:"#C445B8",paper:"#B06A2E",alu:"#63D9A8"}; // maximally-separable hues for fast visual ID (2026-07-11): PET=blue, PVC=yellow, steel=grey, film=magenta, paper=brown, alu=cyan
const STATES=["bag","item"], ST=2; // liberation state: 0=bag (tied), 1=item (loose). Bag opener does bag->item.
const PMASS=0.01,BUF_CAP=60,EDGE_MAX=14,BALE_N=50;
// dev31 finite storage — storage units hold realistic volumes (process units keep BUF_CAP for backpressure granularity).
const STORE_INPUT=20000,STORE_BUFFER=4000,STORE_OUTPUT=15000; // ~200 t tipping floor / ~40 t surge / ~150 t product bay (×real-estate upgrades)
const EDGE_SPEED=66; // logical belt speed (sim timing; keep fixed -- balance depends on it)
const EVAC_CADENCE=0.45; // sim-seconds between disposal-truck dumps (selling is sell-on-arrival, see sellBale)
const OPEN_EFF=1.0,SPLIT_NOISE=0.03; // OPEN_EFF=1.0: every bag opened (rng draw kept so downstream sequence is stable)
const PICK_RATE=1.2,PICK_EFF=0.85,PICK_FALSE=0.02;
const STARVE_T=1.5; // sim-seconds of CONTINUOUS starvation before STARVED shows (hysteresis: stops the flicker during normal flow)
const JAM_T=1.2;    // sim-seconds of CONTINUOUS choke (material waiting, nothing moved) before JAMMED shows — a saturated-but-flowing belt is not a jam
const OVER_T=1.2;   // sim-seconds of CONTINUOUS buffer-saturation before OVERLOAD shows (hysteresis: a transient tick-quantized spike is not an overload)
/* ════════════════════════════════════════════════════════════════════════════
 *  ECONOMIC MODEL — SINGLE SOURCE OF TRUTH. Tune the whole game economy HERE.
 *  All € are game-€. Per-tonne unless noted. Mass granularity = PMASS t/particle.
 *  Sanity invariants: tipping (income) and landfill/disposal (cost) are ALWAYS
 *  charged on actual weight (mass × rate). Keep in sync with RECYCLE_ECONOMICS.md.
 * ════════════════════════════════════════════════════════════════════════════*/
const ECON={
  startCash:2000000,     // career starting cash (€) — small-plant budget (dev30)
  tipping:60,            // income to ACCEPT feed         (€/t in)  — charged on actual weight
  landfillGate:110,      // cost to DISPOSE to landfill   (€/t out) — charged on actual weight
  burner:20,             // FUTURE: energy-from-waste disposal (€/t), cheaper than landfill
  elec:0.15,             // electricity                   (€/kWh)
  wage:22,               // labour                        (€/h per worker)
  // Product prices (€/t): on-spec base, off-spec penalty (negative = you pay to dump the bale).
  prices:{
    PET:    {base:350,  offSpec:-110},
    ferrous:{base:200,  offSpec:-50},
    // FUTURE (v0.5+), real-anchored — see economics doc:
    alu:    {base:1200, offSpec:-50},
    carton: {base:100,  offSpec:-35},  // OCC (old corrugated cardboard) bales, ~€95/t (2025-26 EU)
    film:   {base:130,  offSpec:-45},  // sorted PE film 90/10, ~€120/t; mixed/contaminated film collapses to near-zero
    PVC:    {base:90,   offSpec:-40},  // rigid-PVC regrind (pipe/profile), niche low-value market (~€70-150/t); the alternative is paying −€110/t to landfill it
  },
  // Capex (€) per unit — paid up front on placement, 50% refunded on removal.
  capex:{pick:50000, opener:80000, magnet:35000, eddy:90000, air:120000, nir:300000, vfilm:130000, splitter:20000, baler:120000, storage:40000, intake:40000, output:40000, buffer:25000, export:0, landfill:0},
  // Land / space (FUTURE v0.5): warehouse tile buy / rent per cycle / cheap yard tile.
  land:{tileBuy:300, tileRent:8, yardTile:50},
  // Vehicle OPEX (Lot D, 2026-07-12): a grouped €/h-per-OWNED-vehicle cost (operator wage + machine
  // leasing). No capex at purchase; the cost is drawn over time and reconciled to G.ledger.logistics.
  // Calibrated soft: a lean reference fleet (loader×3+forklift×2+ctruck×1 ≈ 34 €/h ≈ 816 €/day) stays
  // clearly profitable against +6007 €/day; each extra vehicle is a real management cost, not a wall.
  opex:{vehHourly:{loader:6, forklift:4, ctruck:8}},
  // Subsidies (FUTURE v0.5 tutorial).
  subsidies:{starterGrant:1500, ferrousPremium:0, aluBonus:50},
  // Site (MRF) placement capex (€) — the career/site economy. Single source (A3, 2026-07-12);
  // siteUnitCost() reads this. Distinct from the legacy flowsheet `capex` table above.
  siteCost:{input:60000,feeder:45000,baler:140000,bulk:60000,output:45000,landfill:120000,
    process:{opener:90000,pick:40000,magnet:130000,eddy:190000,air:150000,nir:280000,vfilm:160000,splitter:70000,buffer:50000}},
};
const WAGE=ECON.wage;     // alias — economic value lives in ECON
const CAPEX=ECON.capex;   // alias — economic value lives in ECON
// ── Single cash choke-point (A2, 2026-07-12) ────────────────────────────────
// EVERY discretionary cash movement routes through postTx so cash and ledger can
// never drift apart. `cashDelta` is the signed change to G.cash; the matching
// ledger entry is booked with the account's net-formula sign, so pnlReport().net
// stays byte-equal to G.cash (income accounts add, cost accounts subtract).
const LEDGER_INCOME={tipping:1,sales:1,subsidies:1,grants:1}; // the rest (labour/logistics/power/landfill/capex) are cost accounts. `grants` = ONE-TIME milestone/phase rewards, kept out of the recurring daily rate.
function postTx(account,cashDelta){
  G.cash+=cashDelta;
  if(!G.ledger)return cashDelta;
  if(G.ledger[account]==null)G.ledger[account]=0;
  G.ledger[account]+=LEDGER_INCOME[account]?cashDelta:-cashDelta;
  return cashDelta;
}
/* ════════════════════════════════════════════════════════════════════════════
 *  LOGISTICS MODEL (S-BATCH) — discrete batch transport at the zone↔line seam.
 *  Belts stay CONTINUOUS within the line (EDGE_SPEED); vehicles carry BATCHES
 *  across storage boundaries only (Bible §7). Masses in particles (PMASS t each;
 *  a bale = BALE_N particles). Single source of truth, NNG-3 style.
 *  S-BATCH-0 ships this block + an INERT fleet/dispatcher (no node split, no
 *  behaviour change). Behaviour lands per slice: -1 inbound, -2 bulk/landfill,
 *  -3 bale/export. Kinematics get calibrated in -5.
 * ════════════════════════════════════════════════════════════════════════════*/
const LOGI={
  // ── static capacities (particles unless noted) ──
  bunkerCap:20000,    // tipping floor          (~200 t)
  feederCap:2000,     // line-source store      (~20 t)
  containerCap:1000,  // one bulk container     (~10 t)
  containersPerZone:3,
  landfillHold:6,     // full containers a landfill zone parks awaiting evac
  exportCap:20,       // bales an export zone holds
  balerBales:4,       // bales a baler stores internally before a forklift must pull
  // ── vehicle capacities ──
  loaderCap:220,      // scoop bunker→feeder    (~2.2 t) — S-BATCH-5: 1 loader ≈ 7.9 t/s ≈ 1.6× a 5 t/s feed
  forkBales:3,        // bales/trip baler→export — S-BATCH-5: covers a fully-baled 5 t/s stream with margin
  supTruck:1000,      // supplier truck load    (~10 t)
  lfTruck:2,          // containers/visit a landfill truck removes
  cliTruck:24,        // bales/visit a client truck loads (~12 t)
  cliCadence:2,       // min sim-time between successive client-truck SPAWNS at one bay (just spacing)
  cliTrigger:5,       // a client truck rolls once this many bales are waiting (trucks follow storage)
  cliMaxInflight:4,   // client trucks that may serve ONE bay at once (parallel clears a backlog)
  cliMinLoad:8,       // (legacy) retained for the non-site path below
  // ── kinematics (sim-sec; belts are length-INDEPENDENT, these are NOT). ──
  vehSpeed:1000,      // world-units / sim-sec — S-BATCH-5: a ~110-unit haul takes ~0.11 s (visible, snappy)
  minTrip:0.02,       // floor on a one-way transit
  loadDwell:0.03, unloadDwell:0.03,
  lfCadence:0.3,      // sim-sec between landfill-truck dispatch checks (halved — landfill must never bottleneck)
  // ── boundary trucks (S-TRUCK, site mode; anchors: 1 unit of G.t = 1 HOUR, 1 cell = 4 m) ──
  truckSpeed:1800,    // world-px / sim-s ≈ 4 m/s ≈ 14 km/h yard speed
  tipDwell:1.0,       // min at the bunker apron to tip a load
  cliDwell:1.0,       // min at the export dock to load bales
  lfDwell:0.8,        // min at the landfill to load containers
  truckMaxInflight:2, // supplier trucks simultaneously serving ONE bunker
  // ── starting fleet (pool sizes; capex/R&D raise these later) ──
  fleet0:{loader:1, forklift:1, ctruck:1},
};
const CONTRACTS={
  // tiers = completion time in sim-seconds; gold = kept up with intake, silver = lagged, else bronze.
  standard:{name:"Mixed dry recyclables",tonnage:10,comp:{PET:0.35,steel:0.25,PVC:0.05,film:0.15,paper:0.20},product:"PET",tiers:{gold:2.4,silver:3.0},units:["storage","opener","magnet","air","nir","baler"]},
  film:{name:"Film-heavy stream",tonnage:10,comp:{PET:0.30,steel:0.20,PVC:0.05,film:0.35,paper:0.10},product:"PET",tiers:{gold:2.6,silver:3.3},units:["storage","pick","opener","magnet","air","nir","baler"]},
};
// Multi-phase scenarios (the tutorial). One continuous line; each phase swaps the feed + product goal,
// pays a reward and unlocks units on completion. A plain CONTRACT is just a single-phase challenge.
const SCENARIOS={
  pmc:{name:"PMC blue-bag MRF (tutorial)",startCash:2000000,supplier:"wasteminster",scene:[{type:"storage",x:-185,y:0,role:"input",spec:null},{type:"storage",x:185,y:-78,role:"output",spec:"ferrous"},{type:"storage",x:185,y:78,role:"output",spec:"dispose"}],phases:[
    {name:"Phase 1 — Ferrous",name_f:"Phase 1 — Ferreux",product:"ferrous",tonnage:150,comp:{steel:0.45,PET:0.20,film:0.15,paper:0.15,PVC:0.05},
     tiers:{gold:2.0,silver:2.8},reward:50000,premium:{product:"ferrous",perTonne:80},
     briefing:"A scrap buyer wants clean steel. Liberate the bags, lift the ferrous with a magnet, bale it, sell it. A ferrous premium is stacked on your starter grant.",briefing_f:"Un ferrailleur veut de l’acier propre. Libère les sacs, capte le ferreux avec un aimant, mets-le en ballots, vends. Une prime ferreux s’ajoute à ta subvention de départ."},
    {name:"Phase 2 — Aluminium",name_f:"Phase 2 — Aluminium",product:"alu",tonnage:200,comp:{alu:0.30,steel:0.25,PET:0.20,film:0.15,paper:0.10},
     tiers:{gold:2.0,silver:2.8},reward:60000,
     briefing:"Aluminium is the jackpot (€1200/t). The eddy-current separator flings it off — but ONLY after the magnet pulls the steel. Magnet before eddy. Finish in the black.",briefing_f:"L’aluminium, c’est le jackpot (1200 €/t). Le séparateur à courants de Foucault l’éjecte — mais SEULEMENT après que l’aimant a retiré l’acier. L’aimant avant le Foucault. Termine dans le vert."},
    {name:"Phase 3 — PET & capacity",name_f:"Phase 3 — PET & capacité",product:"PET",tonnage:300,comp:{PET:0.40,steel:0.15,PVC:0.05,film:0.25,paper:0.15},
     tiers:{gold:2.6,silver:3.4},reward:80000,grantTech:["a_split","a_pickU"],
     briefing:"A new customer pushes PET volume past one NIR. Split the plastics across two NIRs and re-merge to keep up. Hit your PET on-spec target.",briefing_f:"Un nouveau client pousse le volume de PET au-delà d’un seul NIR. Répartis les plastiques sur deux NIR et re-fusionne pour suivre. Atteins ta cible de PET conforme."},
  ]},
};
const SPECS={
  PET:{target:"PET",minPurity:0.95,caps:{PVC:0.005},basePrice:ECON.prices.PET.base,offSpec:ECON.prices.PET.offSpec,label:"PET"},
  ferrous:{target:"steel",minPurity:0.90,caps:{},basePrice:ECON.prices.ferrous.base,offSpec:ECON.prices.ferrous.offSpec,label:"Ferrous"},
  alu:{target:"alu",minPurity:0.90,caps:{},basePrice:ECON.prices.alu.base,offSpec:ECON.prices.alu.offSpec,label:"Aluminium"},
  // OCC cardboard: mills accept ≥95% fibre, <5% total out-throws (EN 643 grade 1.05). Plastics are the killer contaminant.
  carton:{target:"paper",minPurity:0.95,caps:{film:0.02,PET:0.02,PVC:0.01},basePrice:ECON.prices.carton.base,offSpec:ECON.prices.carton.offSpec,label:"Cardboard"},
  // PE film 90/10: reprocessors demand ≥90% film, tight paper/rigid limits (paper fibre wrecks film extrusion).
  film:{target:"film",minPurity:0.90,caps:{paper:0.03,PET:0.02,PVC:0.005},basePrice:ECON.prices.film.base,offSpec:ECON.prices.film.offSpec,label:"Film"},
  pvc:{target:"PVC",minPurity:0.90,caps:{},basePrice:ECON.prices.PVC.base,offSpec:ECON.prices.PVC.offSpec,label:"PVC"}, // salvage the killer contaminant instead of landfilling it
};
// ── Named trading partners. Suppliers tip a waste stream; buyers buy a spec. Each carries a per-language
// name map (coName resolves, default EN). Streams/buyer-pricing get wired as the agreement loop lands.
const COMPANIES={
  suppliers:[
    {id:"wasteminster",name:{en:"Wasteminster Council"},tutorial:true,stream:{comp:{PET:0.32,steel:0.15,alu:0.06,film:0.14,paper:0.26,PVC:0.07},feedTph:4,gate:55,bag:"blue"}},
    {id:"binfinity",name:{en:"Binfinity"},stream:{comp:{PET:0.15,steel:0.06,alu:0.02,film:0.30,paper:0.32,PVC:0.15},feedTph:4,gate:75,bag:"grey"}},
    {id:"hauler_oates",name:{en:"Hauler Oates"}},
    {id:"down_dumps",name:{en:"Down in the Dumps Ltd."}},
    {id:"skip_bizet",name:{en:"Skip Bizet"}},
    {id:"poubelle_air",name:{en:"Poubelle Air"}},
    {id:"ducasse_dechets",name:{en:"Ducasse Déchets"}},
    {id:"trouville_dechets",name:{en:"Trouville Déchets"}},
    {id:"verviers_nord",name:{en:"Verviers Nord Containers"}},
    {id:"supradel",name:{en:"Supradel"}},
    {id:"watco_syndicate",name:{en:"Watco Syndicate"}},
    {id:"van_jesuswinkel",name:{en:"Van Jesuswinkel"}},
  ],
  buyers:[
    {id:"ferrous_bueller",name:{en:"Ferrous Bueller"},spec:"ferrous",def:true},
    {id:"iron_maiden",name:{en:"Iron Maiden Metals"},spec:"ferrous"},
    {id:"aluminati",name:{en:"Aluminati"},spec:"alu",def:true},
    {id:"foil_play",name:{en:"Foil Play"},spec:"alu"},
    {id:"tin_pan_alloy",name:{en:"Tin Pan Alloy"},spec:"alu"},
    {id:"repetitive",name:{en:"Re-PET-itive"},spec:"PET",def:true},
    {id:"flake_news",name:{en:"Flake News"},spec:"PET"},
    {id:"poly_cracker",name:{en:"Poly Want a Cracker"},spec:"PET"},
    {id:"corr_blimey",name:{en:"Corr Blimey Board"},spec:"carton",def:true},
    {id:"box_office",name:{en:"Box Office Fibre"},spec:"carton"},
    {id:"cling_on",name:{en:"Cling-On Polymers"},spec:"film",def:true},
    {id:"wrap_battle",name:{en:"Wrap Battle Recycling"},spec:"film"},
    {id:"vinyl_countdown",name:{en:"Vinyl Countdown"},spec:"pvc",def:true},
  ],
};
function coById(id){for(const c of COMPANIES.suppliers)if(c.id===id)return c;for(const c of COMPANIES.buyers)if(c.id===id)return c;return null;}
function coName(c){if(typeof c==="string")c=coById(c);if(!c)return "";const L=(typeof LANG_CUR!=="undefined")?LANG_CUR:"en";return (c.name&&(c.name[L]||c.name.en))||c.id;}
function defaultBuyer(spec){let f=null;for(const c of COMPANIES.buyers)if(c.spec===spec){if(c.def)return c;if(!f)f=c;}return f;}
// Buyer max offtake (t/sim-sec) for an export zone; Infinity = uncapped (current default → sell-on-arrival,
// matching the pre-S-BATCH baseline). Finite maxDaily is the S-BATCH-5 balance lever (fork D).
function buyerOfftake(n){const bid=n.buyer||(defaultBuyer(n.spec)&&defaultBuyer(n.spec).id);const b=bid&&coById(bid);return (b&&b.maxDaily)||Infinity;}
function supplierStream(id){const c=coById(id);return (c&&c.stream)||null;}
const TYPES={
  intake:{name:"Intake",real:"tipping floor",storage:true,role:"input",cap:5,out:["O"],
    desc:"Where trucks tip the contract\u2019s waste \u2014 you\u2019re paid \u20AC60/t to take it. Set its feed rate to push material down the line."},
  output:{name:"Output",real:"product bay / landfill",storage:true,role:"output",cap:5,out:["O"],
    desc:"A sell point: link a baler to it and pick what it sells. Set it to dispose to make a landfill (\u2212\u20AC110/t)."},
  buffer:{name:"Buffer",real:"surge bay",storage:true,role:"buffer",cap:5,out:["O"],
    desc:"Holds and relays material \u2014 a surge tank between stages."},
  storage:{name:"Storage",real:"storage bay",storage:true,pass:true,cap:5,out:["O"],
    desc:"A typed storage area \u2014 set its ROLE in the inspector. Input feeds the line (you're paid \u20AC60/t to take the waste). Output sells a product (link a baler to it) or disposes to landfill (\u2212\u20AC110/t). Buffer just holds and relays material."},
  opener:{name:"Bag opener",real:"bag opener",cap:10,kW:90,opener:true,out:["O"],
    desc:"Liberates whole items from bags: bag \u2192 item, at 100%. Bottles and cans stay intact \u2014 it never size-reduces. Sorters downstream need liberated items: anything baled while still bagged won\u2019t make spec."},
  pick:{name:"Picking station",real:"manual sorting cabin",kW:3,isPick:true,out:["R","O"],workers:2,target:"film",
    ports:{R:"picked out",O:"the rest"},
    desc:"Staffed, not automated. Each worker handles ~1.2 t/h and draws \u20AC22/h whether busy or idle. Pulls ~85% of the targeted material (2% of good product goes with it). Put it early to strip film, or after the NIR to hand-clean a product."},
  magnet:{name:"Magnet",real:"overband magnet",cap:10,kW:5,out:["S","M"],accept:"S",other:"M",main:"M",needsItem:true,
    prob:{steel:0.95,default:0.01,film:0.005,paper:0.005}, ports:{S:"steel lifted off",M:"the rest"},
    desc:"Lifts ferromagnetic steel off the belt \u2014 keeps 95%. Works at any size; magnetism does not care how big the piece is."},
  eddy:{name:"Eddy-current separator",real:"eddy-current separator (ECS)",cap:12,kW:20,out:["S","M"],accept:"S",other:"M",main:"M",needsItem:true,
    prob:{alu:0.90,steel:0.80,default:0.02}, ports:{S:"aluminium",M:"the rest"},
    desc:"Induces eddy currents that fling non-ferrous metal (aluminium) up and off the belt \u2014 keeps ~90%. REQUIRES the magnet upstream: any steel left in the feed is flung with the aluminium and fouls the bale. Magnet before eddy, always. Rated to swallow full feed; not the bottleneck."},
  air:{name:"Air classifier",real:"zig-zag windsifter",cap:4,kW:30,out:["S","M"],accept:"S",other:"M",main:"M",needsItem:true,
    prob:{film:0.92,paper:0.88,PET:0.05,PVC:0.05,steel:0.01,default:0.05}, ports:{S:"light: film & paper",M:"heavy: PET & PVC"},
    desc:"Blows the light fraction up and out; heavies continue. Coarse is too big to lift and rides along."},
  nir:{name:"NIR sorter",real:"near-infrared optical sorter",cap:3,kW:15,out:["M","S"],accept:"M",other:"S",main:"M",needsItem:true,
    prob:{PET:0.96,PVC:0.002,film:0.05,paper:0.05,steel:0.10,default:0.05}, ports:{M:"PET kept",S:"ejected"},
    desc:"Reads each fragment spectrum: keeps 96% of PET, ejects 99.8% of PVC by its chlorine signature. Cannot read coarse pieces \u2014 it ejects them, so unliberated feed becomes lost yield, not product."},
  vfilm:{name:"Vacuum film extractor",real:"film vacuum / air-knife hood",cap:3,kW:18,out:["S","M"],accept:"S",other:"M",main:"M",needsItem:true,
    prob:{film:0.88,paper:0.012,PET:0.004,PVC:0.004,alu:0.003,steel:0.002,default:0.003}, ports:{S:"film pulled off",M:"the rest"},
    desc:"A vacuum hood + cyclone lifts light 2D film off the belt \u2014 keeps ~88%, with little else (rigid bottles and metals are too heavy to lift). Sealed bags ride through: put it after the bag opener. Turns film + carton into two sellable products when paired with the air classifier."},
  splitter:{name:"Splitter",real:"flow divider",cap:12,kW:2,out:["A","B"],isSplit:true,
    ports:{A:"fraction to A",B:"fraction to B"},
    desc:"Bleeds a set fraction to A, the rest to B, regardless of material (~3% crosses over \u2014 nothing is perfect). Purge a recycle loop here so it cannot snowball."},
  mixer:{name:"Mixer",real:"merge conveyor / surge junction",cap:12,kW:2,pass:true,isMixer:true,out:["O"],
    desc:"Merges up to three feeds (top, left, right) into one stream out the bottom. Mass-conserving \u2014 a plain junction. Rotate it to turn a single feed 90\u00B0: with one inlet and the outlet wired it works as an elbow."},
  baler:{name:"Baler",real:"channel baler",cap:6,kW:40,pass:true,isBaler:true,out:["O"],
    desc:"Compacts whatever reaches it into bales \u2014 agnostic, it bales anything. Link it to a typed export to actually sell. Loose, unbaled material cannot be sold."},
};
// Typed-storage role predicates — a Storage node's behaviour is its role, not its type.
// Inbound split (S-BATCH-1): the tipping floor (BUNKER, truck-fed, loader-drained) and the line
// source (FEEDER, loader-fed, belt-out) are now two nodes. `isInput` is kept as the name for the
// LINE-SOURCE and aliases the feeder, so existing call sites (tutorial wire-check, feed rate, ports)
// follow the feeder automatically; the bunker is matched separately by isBunker.
function isBunker(n){return n&&n.type==="storage"&&n.role==="bunker";}
function isFeeder(n){return n&&n.type==="storage"&&n.role==="feeder";}
function isInput(n){return isFeeder(n);}
function isOutput(n){return n&&n.type==="storage"&&n.role==="output";}
function isDispose(n){return isOutput(n)&&n.spec==="dispose";}
function isHeld(n){return isExport(n)&&n.buyer==="__hold";} // export bay in temporary-stock mode (no contract)
// Sell split (S-BATCH-3): the sell Output becomes an EXPORT ZONE (holds bales, forklift-fed from the
// baler, drained by a per-zone client truck bounded by the buyer's maxDaily). `isSell` is kept as the
// name for the sell point and aliases the export zone, so label/inspector/grading call sites follow it.
function isExport(n){return n&&n.type==="storage"&&n.role==="export";}
function isSell(n){return isExport(n);}
// Outbound split (S-BATCH-2): the dispose Output (bulk pile + landfill in one) becomes a BULK ZONE
// (belt-fed, holds 3 containers, drained by a container truck) and a LANDFILL zone (ctruck-fed, its
// inBuf is the on-site pile, evacuated off-map by a cadence landfill truck that books the charge).
function isBulk(n){return n&&n.type==="storage"&&n.role==="bulk";}
function isLandfill(n){return n&&n.type==="storage"&&n.role==="landfill";}
const STORE_UNITS={intake:"input",output:"output",buffer:"buffer"}; // palette unit -> storage node role
const CAPEX_LEGACY_REMOVED=true; // CAPEX now lives in ECON.capex (aliased above)

let G=null, cam={x:0,y:0,zoom:1}, P=[], _id=1, selNode=null, _inspectNode=null, _inspectT=0;
// Engine→UI hooks. Default no-ops so the ENGINE block has ZERO DOM/render dependencies
// (the harness loads the engine alone with these no-ops). The UI block overrides them.
const UI={viewReset(){},onEnd(){},onPhase(){},onOverflow(){},onGraduate(){}};
const blankBuf=()=>({PET:[0,0],PVC:[0,0],steel:[0,0],film:[0,0],paper:[0,0],alu:[0,0]});
// Rebuild a restored buffer to the current material×state shape (old saves may miss materials/states).
function migrateBuf(b){const o=blankBuf();if(b)for(const m of MAT)if(b[m])for(let z=0;z<ST;z++)o[m][z]=b[m][z]||0;return o;}
const cnt=b=>{let s=0;for(const m of MAT){const c=b[m];if(c)s+=c[0]+c[1];}return s;};
const comp=b=>{const c={PET:0,PVC:0,steel:0,film:0,paper:0,alu:0};for(const m of MAT){const v=b[m];if(v)c[m]=v[0]+v[1];}return c;};
const stateDist=b=>{const d=[0,0];for(const m of MAT)for(let z=0;z<ST;z++)d[z]+=b[m][z];return d;};
function rng(){G.rngState=(G.rngState+0x6d2b79f5)|0;let a=G.rngState,t=Math.imul(a^(a>>>15),1|a);t=(t+Math.imul(t^(t>>>7),61|t))^t;return((t^(t>>>14))>>>0)/4294967296;}
function popParticle(b){const t=cnt(b);if(t<=0)return null;let r=rng()*t;
  for(const m of MAT)for(let z=0;z<ST;z++){if(r<b[m][z]){b[m][z]--;return{mat:m,st:z};}r-=b[m][z];}
  for(const m of MAT)for(let z=0;z<ST;z++)if(b[m][z]>0){b[m][z]--;return{mat:m,st:z};}return null;}
function grade(buf,specKey){const spec=SPECS[specKey];const c=comp(buf);let t=0;for(const m of MAT)t+=c[m];if(t<=0)return{ok:false,price:0,purity:0,frac:{}};
  const frac={};for(const m of MAT)frac[m]=c[m]/t;const tf=((buf[spec.target]&&buf[spec.target][1])||0)/t; // LIBERATED target only \u2014 bagged target is not product
  const failCap=Object.keys(spec.caps).some(m=>(frac[m]||0)>spec.caps[m]);
  if(failCap||tf<spec.minPurity)return{ok:false,price:spec.offSpec,purity:tf,frac};
  const q=0.8+0.4*(tf-spec.minPurity)/(1-spec.minPurity);return{ok:true,price:spec.basePrice*q,purity:tf,frac};}
const INBOUND_DX=110; // world-units the FEEDER sits right of its BUNKER (the loader-route length)
function _addOne(type,wx,wy,spec,role){if(STORE_UNITS[type]){role=STORE_UNITS[type];if(type==="output"&&!spec)spec="PET";type="storage";}const t=TYPES[type];
  const n={id:_id++,type,x:wx,y:wy,w:78,h:66,inBuf:blankBuf(),ratio:0.5,spec:spec||"PET",
    role:type==="storage"?(role||"buffer"):null,rate:5,truckDue:0,
    containers:(role==="bulk")?[blankBuf(),blankBuf(),blankBuf()]:null,active:0, // bulk-zone holds CONTAINERS_PER_ZONE containers
    bale:blankBuf(),bales:[],disposeHeap:0,evacT:0,truckFlash:0,balesSold:0,offSold:0,jam:0,load:0,state:"ok",wrongSize:0,
    workers:t.workers||2,target:t.target||"film",paidCapex:0};
  G.nodes.push(n);if(G.mode==="career"&&type!=="storage"){const mc=G.nodes.reduce((s,x)=>s+(x.type!=="storage"?1:0),0);if(mc>CAREER.counters.maxUnits)CAREER.counters.maxUnits=mc;}return n;}
// Inbound intake materialises as a BUNKER + FEEDER pair, auto-wired with a loader route (fork B(i):
// two real, separately-positioned nodes). Returns the FEEDER (the line-relevant node — callers that
// wire "intake → X" wire feeder → X). The bunker sits INBOUND_DX to the left so the feeder keeps the
// original anchor (downstream layout unchanged). Supplier rides on the bunker.
function addInbound(wx,wy,supplier){
  const bunker=_addOne("storage",wx-INBOUND_DX,wy,null,"bunker");
  const feeder=_addOne("storage",wx,wy,null,"feeder");
  if(supplier)bunker.supplier=supplier;
  feeder.rate=(G.contract&&G.contract.feedTph)||4;
  G.edges.push({from:bunker.id,fromPort:"O",to:feeder.id,sprites:[],speed:EDGE_SPEED}); // loader route (no belt sprites)
  return feeder;
}
// Dispose Output materialises as a BULK ZONE + LANDFILL pair, auto-wired with a container-truck route.
// Returns the BULK ZONE (the belt-relevant node — reject/bulk belts wire INTO it). The landfill sits
// INBOUND_DX to the right so the bulk zone keeps the original anchor (incoming belt edges unchanged).
function addOutbound(wx,wy){
  const bulk=_addOne("storage",wx,wy,null,"bulk");
  const land=_addOne("storage",wx+INBOUND_DX,wy,null,"landfill");
  G.edges.push({from:bulk.id,fromPort:"O",to:land.id,sprites:[],speed:EDGE_SPEED}); // container-truck route (no belt sprites)
  return bulk;
}
function isInputIntent(type,role){return type==="intake"||type==="bunker"||type==="feeder"||STORE_UNITS[type]==="input"||(type==="storage"&&role==="input");}
function isDisposeIntent(type,spec,role){return type==="landfill"||type==="bulkzone"||role==="bulk"||role==="landfill"||(STORE_UNITS[type]==="output"&&spec==="dispose")||(type==="storage"&&role==="output"&&spec==="dispose");}
function isSellIntent(type,spec,role){return type==="export"||role==="export"||((STORE_UNITS[type]==="output"||(type==="storage"&&role==="output"))&&spec!=="dispose");}
function addNode(type,wx,wy,spec,role){
  if(isInputIntent(type,role))return addInbound(wx,wy);
  if(isDisposeIntent(type,spec,role))return addOutbound(wx,wy);
  if(isSellIntent(type,spec,role))return _addOne("storage",wx,wy,spec||"PET","export"); // sell Output → EXPORT ZONE (bales in n.bales, forklift-fed, client-truck evac)
  return _addOne(type,wx,wy,spec,role);}

/* ── SITE model (Phase 1) ────────────────────────────────────────────────────
 * Grid-native plant geometry. recycle-layout v4 is the sole source of truth for
 * the grid, zones, placement gates and routed connections (RECYCLE-PHASE0.md §1).
 * World px = cell × CELL. Node x/y/w/h are DERIVED from grid placement (D2);
 * vehicle legs follow authored routes or deterministic dirt-BFS (D3, WYSIWYG).
 *
 * REAL-WORLD ANCHORS (units audit 2026-07-11 — all balance numbers must respect these):
 *   1 grid cell = 4 m  → shell 60×88 m ≈ 5 300 m² (mid-size MRF), site 88×168 m ≈ 1.5 ha.
 *   1 unit of sim-time (G.t) = 1 real HOUR. This is the CANONICAL unit: calendar(t) reads t as
 *   hours (t*60 minutes, SIM_DAY_E=24 h/day), and every economic term (elec kW·dt, wages €/h·dt)
 *   agrees. Rate/feed values below are t per HOUR (t/h). Earlier "sim-sec = minute" / "t/min" notes
 *   were WRONG — comment bugs, not code; do not "fix" the code to match them (verified empirically).
 *   OPEN (D6 balancing pass): feed is a GAME-BALANCE figure in t/h (ref line = 0.5 t/h; measured
 *   end-to-end plant throughput ≈ 1.2 t/h with the full fleet). These are tuned for play, not scaled
 *   to a real MRF (a real line is ~15–35 t/h); keep loaderCap and feed retuned TOGETHER so
 *   "1 loader ≈ 1 line" holds.
 * ──────────────────────────────────────────────────────────────────────────*/
const CELL=30;
const SITE_BELT_SPEED=1800; // world-px per sim-time unit (belt animation; doubled at the 10 t/h throughput pass)
const BELT_TPH=10;          // nominal conveyor throughput — every belt carries this REGARDLESS of length
function beltMaxFor(wlen){return Math.max(8,Math.ceil((BELT_TPH/PMASS)*wlen/SITE_BELT_SPEED));} // max×speed ≈ BELT_TPH/PMASS sprites/h
const SITE_OBJ={input:{w:2,h:3},feeder:{w:1,h:2},process:{w:1,h:1},mixer:{w:1,h:1},baler:{w:2,h:1},bulk:{w:3,h:3},output:{w:2,h:3},landfill:{w:7,h:3}};
const SITE_KIND={input:{type:"storage",role:"bunker"},feeder:{type:"storage",role:"feeder"},mixer:{type:"mixer"},baler:{type:"baler"},bulk:{type:"storage",role:"bulk"},output:{type:"storage",role:"export"},landfill:{type:"storage",role:"landfill"}};
const SITE_LAYOUT={"meta":{"name":"RECYCLE site layout","version":4,"note":"Canonical design reference. v4: input\u2192feeder is a VEHICLE (loader) seam per S-BATCH-1 \u2014 the tipping floor is loader-served; conveyors never cross the bunker boundary. Unit positions are an illustrative example plant; the player places units. Grid, cell size, zone geometry, unit dimensions, port model, routing rules and palette are canonical."},"grid":{"w":22,"h":42},"cell":30,"property":[[0,0],[0,1],[0,2],[0,3],[0,4],[0,5],[0,6],[0,7],[0,8],[0,9],[0,10],[0,11],[0,12],[0,13],[0,14],[0,15],[0,16],[0,17],[0,18],[0,19],[0,20],[0,21],[0,22],[0,23],[0,24],[0,25],[0,26],[0,27],[0,28],[0,29],[0,30],[0,31],[0,32],[0,33],[0,34],[0,35],[0,36],[0,37],[0,38],[0,39],[0,40],[0,41],[1,0],[1,1],[1,2],[1,3],[1,4],[1,5],[1,6],[1,7],[1,8],[1,9],[1,10],[1,11],[1,12],[1,13],[1,14],[1,15],[1,16],[1,17],[1,18],[1,19],[1,20],[1,21],[1,22],[1,23],[1,24],[1,25],[1,26],[1,27],[1,28],[1,29],[1,30],[1,31],[1,32],[1,33],[1,34],[1,35],[1,36],[1,37],[1,38],[1,39],[1,40],[1,41],[2,0],[2,1],[2,2],[2,3],[2,4],[2,5],[2,6],[2,7],[2,8],[2,9],[2,10],[2,11],[2,12],[2,13],[2,14],[2,15],[2,16],[2,17],[2,18],[2,19],[2,20],[2,21],[2,22],[2,23],[2,24],[2,25],[2,26],[2,27],[2,28],[2,29],[2,30],[2,31],[2,32],[2,33],[2,34],[2,35],[2,36],[2,37],[2,38],[2,39],[2,40],[2,41],[3,0],[3,1],[3,2],[3,3],[3,4],[3,5],[3,6],[3,7],[3,8],[3,9],[3,10],[3,11],[3,12],[3,13],[3,14],[3,15],[3,16],[3,17],[3,18],[3,19],[3,20],[3,21],[3,22],[3,23],[3,24],[3,25],[3,26],[3,27],[3,28],[3,29],[3,30],[3,31],[3,32],[3,33],[3,34],[3,35],[3,36],[3,37],[3,38],[3,39],[3,40],[3,41],[4,0],[4,1],[4,2],[4,3],[4,4],[4,5],[4,6],[4,7],[4,8],[4,9],[4,10],[4,11],[4,12],[4,13],[4,14],[4,15],[4,16],[4,17],[4,18],[4,19],[4,20],[4,21],[4,22],[4,23],[4,24],[4,25],[4,26],[4,27],[4,28],[4,29],[4,30],[4,31],[4,32],[4,33],[4,34],[4,35],[4,36],[4,37],[4,38],[4,39],[4,40],[4,41],[5,0],[5,1],[5,2],[5,3],[5,4],[5,5],[5,6],[5,7],[5,8],[5,9],[5,10],[5,11],[5,12],[5,13],[5,14],[5,15],[5,16],[5,17],[5,18],[5,19],[5,20],[5,21],[5,22],[5,23],[5,24],[5,25],[5,26],[5,27],[5,28],[5,29],[5,30],[5,31],[5,32],[5,33],[5,34],[5,35],[5,36],[5,37],[5,38],[5,39],[5,40],[5,41],[6,0],[6,1],[6,2],[6,3],[6,4],[6,5],[6,6],[6,7],[6,8],[6,9],[6,10],[6,11],[6,12],[6,13],[6,14],[6,15],[6,16],[6,17],[6,18],[6,19],[6,20],[6,21],[6,22],[6,23],[6,24],[6,25],[6,26],[6,27],[6,28],[6,29],[6,30],[6,31],[6,32],[6,33],[6,34],[6,35],[6,36],[6,37],[6,38],[6,39],[6,40],[6,41],[7,0],[7,1],[7,2],[7,3],[7,4],[7,5],[7,6],[7,7],[7,8],[7,9],[7,10],[7,11],[7,12],[7,13],[7,14],[7,15],[7,16],[7,17],[7,18],[7,19],[7,20],[7,21],[7,22],[7,23],[7,24],[7,25],[7,26],[7,27],[7,28],[7,29],[7,30],[7,31],[7,32],[7,33],[7,34],[7,35],[7,36],[7,37],[7,38],[7,39],[7,40],[7,41],[8,0],[8,1],[8,2],[8,3],[8,4],[8,5],[8,6],[8,7],[8,8],[8,9],[8,10],[8,11],[8,12],[8,13],[8,14],[8,15],[8,16],[8,17],[8,18],[8,19],[8,20],[8,21],[8,22],[8,23],[8,24],[8,25],[8,26],[8,27],[8,28],[8,29],[8,30],[8,31],[8,32],[8,33],[8,34],[8,35],[8,36],[8,37],[8,38],[8,39],[8,40],[8,41],[9,0],[9,1],[9,2],[9,3],[9,4],[9,5],[9,6],[9,7],[9,8],[9,9],[9,10],[9,11],[9,12],[9,13],[9,14],[9,15],[9,16],[9,17],[9,18],[9,19],[9,20],[9,21],[9,22],[9,23],[9,24],[9,25],[9,26],[9,27],[9,28],[9,29],[9,30],[9,31],[9,32],[9,33],[9,34],[9,35],[9,36],[9,37],[9,38],[9,39],[9,40],[9,41],[10,0],[10,1],[10,2],[10,3],[10,4],[10,5],[10,6],[10,7],[10,8],[10,9],[10,10],[10,11],[10,12],[10,13],[10,14],[10,15],[10,16],[10,17],[10,18],[10,19],[10,20],[10,21],[10,22],[10,23],[10,24],[10,25],[10,26],[10,27],[10,28],[10,29],[10,30],[10,31],[10,32],[10,33],[10,34],[10,35],[10,36],[10,37],[10,38],[10,39],[10,40],[10,41],[11,0],[11,1],[11,2],[11,3],[11,4],[11,5],[11,6],[11,7],[11,8],[11,9],[11,10],[11,11],[11,12],[11,13],[11,14],[11,15],[11,16],[11,17],[11,18],[11,19],[11,20],[11,21],[11,22],[11,23],[11,24],[11,25],[11,26],[11,27],[11,28],[11,29],[11,30],[11,31],[11,32],[11,33],[11,34],[11,35],[11,36],[11,37],[11,38],[11,39],[11,40],[11,41],[12,0],[12,1],[12,2],[12,3],[12,4],[12,5],[12,6],[12,7],[12,8],[12,9],[12,10],[12,11],[12,12],[12,13],[12,14],[12,15],[12,16],[12,17],[12,18],[12,19],[12,20],[12,21],[12,22],[12,23],[12,24],[12,25],[12,26],[12,27],[12,28],[12,29],[12,30],[12,31],[12,32],[12,33],[12,34],[12,35],[12,36],[12,37],[12,38],[12,39],[12,40],[12,41],[13,0],[13,1],[13,2],[13,3],[13,4],[13,5],[13,6],[13,7],[13,8],[13,9],[13,10],[13,11],[13,12],[13,13],[13,14],[13,15],[13,16],[13,17],[13,18],[13,19],[13,20],[13,21],[13,22],[13,23],[13,24],[13,25],[13,26],[13,27],[13,28],[13,29],[13,30],[13,31],[13,32],[13,33],[13,34],[13,35],[13,36],[13,37],[13,38],[13,39],[13,40],[13,41],[14,0],[14,1],[14,2],[14,3],[14,4],[14,5],[14,6],[14,7],[14,8],[14,9],[14,10],[14,11],[14,12],[14,13],[14,14],[14,15],[14,16],[14,17],[14,18],[14,19],[14,20],[14,21],[14,22],[14,23],[14,24],[14,25],[14,26],[14,27],[14,28],[14,29],[14,30],[14,31],[14,32],[14,33],[14,34],[14,35],[14,36],[14,37],[14,38],[14,39],[14,40],[14,41],[15,0],[15,1],[15,2],[15,3],[15,4],[15,5],[15,6],[15,7],[15,8],[15,9],[15,10],[15,11],[15,12],[15,13],[15,14],[15,15],[15,16],[15,17],[15,18],[15,19],[15,20],[15,21],[15,22],[15,23],[15,24],[15,25],[15,26],[15,27],[15,28],[15,29],[15,30],[15,31],[15,32],[15,33],[15,34],[15,35],[15,36],[15,37],[15,38],[15,39],[15,40],[15,41],[16,0],[16,1],[16,2],[16,3],[16,4],[16,5],[16,6],[16,7],[16,8],[16,9],[16,10],[16,11],[16,12],[16,13],[16,14],[16,15],[16,16],[16,17],[16,18],[16,19],[16,20],[16,21],[16,22],[16,23],[16,24],[16,25],[16,26],[16,27],[16,28],[16,29],[16,30],[16,31],[16,32],[16,33],[16,34],[16,35],[16,36],[16,37],[16,38],[16,39],[16,40],[16,41],[17,0],[17,1],[17,2],[17,3],[17,4],[17,5],[17,6],[17,7],[17,8],[17,9],[17,10],[17,11],[17,12],[17,13],[17,14],[17,15],[17,16],[17,17],[17,18],[17,19],[17,20],[17,21],[17,22],[17,23],[17,24],[17,25],[17,26],[17,27],[17,28],[17,29],[17,30],[17,31],[17,32],[17,33],[17,34],[17,35],[17,36],[17,37],[17,38],[17,39],[17,40],[17,41],[18,0],[18,1],[18,2],[18,3],[18,4],[18,5],[18,6],[18,7],[18,8],[18,9],[18,10],[18,11],[18,12],[18,13],[18,14],[18,15],[18,16],[18,17],[18,18],[18,19],[18,20],[18,21],[18,22],[18,23],[18,24],[18,25],[18,26],[18,27],[18,28],[18,29],[18,30],[18,31],[18,32],[18,33],[18,34],[18,35],[18,36],[18,37],[18,38],[18,39],[18,40],[18,41]],"shell":[[2,10],[2,11],[2,12],[2,13],[2,14],[2,15],[2,16],[2,17],[2,18],[2,19],[2,20],[2,21],[2,22],[2,23],[2,24],[2,25],[2,26],[2,27],[2,28],[2,29],[2,30],[2,31],[3,10],[3,11],[3,12],[3,13],[3,14],[3,15],[3,16],[3,17],[3,18],[3,19],[3,20],[3,21],[3,22],[3,23],[3,24],[3,25],[3,26],[3,27],[3,28],[3,29],[3,30],[3,31],[4,10],[4,11],[4,12],[4,13],[4,14],[4,15],[4,16],[4,17],[4,18],[4,19],[4,20],[4,21],[4,22],[4,23],[4,24],[4,25],[4,26],[4,27],[4,28],[4,29],[4,30],[4,31],[5,10],[5,11],[5,12],[5,13],[5,14],[5,15],[5,16],[5,17],[5,18],[5,19],[5,20],[5,21],[5,22],[5,23],[5,24],[5,25],[5,26],[5,27],[5,28],[5,29],[5,30],[5,31],[6,10],[6,11],[6,12],[6,13],[6,14],[6,15],[6,16],[6,17],[6,18],[6,19],[6,20],[6,21],[6,22],[6,23],[6,24],[6,25],[6,26],[6,27],[6,28],[6,29],[6,30],[6,31],[7,10],[7,11],[7,12],[7,13],[7,14],[7,15],[7,16],[7,17],[7,18],[7,19],[7,20],[7,21],[7,22],[7,23],[7,24],[7,25],[7,26],[7,27],[7,28],[7,29],[7,30],[7,31],[8,10],[8,11],[8,12],[8,13],[8,14],[8,15],[8,16],[8,17],[8,18],[8,19],[8,20],[8,21],[8,22],[8,23],[8,24],[8,25],[8,26],[8,27],[8,28],[8,29],[8,30],[8,31],[9,10],[9,11],[9,12],[9,13],[9,14],[9,15],[9,16],[9,17],[9,18],[9,19],[9,20],[9,21],[9,22],[9,23],[9,24],[9,25],[9,26],[9,27],[9,28],[9,29],[9,30],[9,31],[10,10],[10,11],[10,12],[10,13],[10,14],[10,15],[10,16],[10,17],[10,18],[10,19],[10,20],[10,21],[10,22],[10,23],[10,24],[10,25],[10,26],[10,27],[10,28],[10,29],[10,30],[10,31],[11,10],[11,11],[11,12],[11,13],[11,14],[11,15],[11,16],[11,17],[11,18],[11,19],[11,20],[11,21],[11,22],[11,23],[11,24],[11,25],[11,26],[11,27],[11,28],[11,29],[11,30],[11,31],[12,10],[12,11],[12,12],[12,13],[12,14],[12,15],[12,16],[12,17],[12,18],[12,19],[12,20],[12,21],[12,22],[12,23],[12,24],[12,25],[12,26],[12,27],[12,28],[12,29],[12,30],[12,31],[13,10],[13,11],[13,12],[13,13],[13,14],[13,15],[13,16],[13,17],[13,18],[13,19],[13,20],[13,21],[13,22],[13,23],[13,24],[13,25],[13,26],[13,27],[13,28],[13,29],[13,30],[13,31],[14,10],[14,11],[14,12],[14,13],[14,14],[14,15],[14,16],[14,17],[14,18],[14,19],[14,20],[14,21],[14,22],[14,23],[14,24],[14,25],[14,26],[14,27],[14,28],[14,29],[14,30],[14,31],[15,10],[15,11],[15,12],[15,13],[15,14],[15,15],[15,16],[15,17],[15,18],[15,19],[15,20],[15,21],[15,22],[15,23],[15,24],[15,25],[15,26],[15,27],[15,28],[15,29],[15,30],[15,31],[16,10],[16,11],[16,12],[16,13],[16,14],[16,15],[16,16],[16,17],[16,18],[16,19],[16,20],[16,21],[16,22],[16,23],[16,24],[16,25],[16,26],[16,27],[16,28],[16,29],[16,30],[16,31]],"objects":[{"type":"input","x":2,"y":4,"rot":0},{"type":"input","x":4,"y":4,"rot":0},{"type":"input","x":6,"y":4,"rot":0},{"type":"input","x":15,"y":4,"rot":0},{"type":"input","x":13,"y":4,"rot":0},{"type":"input","x":11,"y":4,"rot":0},{"type":"feeder","x":5,"y":10,"rot":0},{"type":"feeder","x":9,"y":10,"rot":0},{"type":"feeder","x":13,"y":10,"rot":0},{"type":"process","x":5,"y":13,"rot":0},{"type":"process","x":5,"y":15,"rot":0},{"type":"process","x":5,"y":17,"rot":0},{"type":"process","x":5,"y":19,"rot":0},{"type":"baler","x":2,"y":15,"rot":0},{"type":"baler","x":2,"y":17,"rot":0},{"type":"baler","x":2,"y":19,"rot":0},{"type":"process","x":5,"y":21,"rot":0},{"type":"process","x":7,"y":23,"rot":0},{"type":"process","x":5,"y":25,"rot":0},{"type":"bulk","x":4,"y":29,"rot":0},{"type":"bulk","x":8,"y":29,"rot":0},{"type":"bulk","x":12,"y":29,"rot":0},{"type":"output","x":2,"y":35,"rot":0},{"type":"output","x":4,"y":35,"rot":0},{"type":"output","x":6,"y":35,"rot":0},{"type":"landfill","x":12,"y":35,"rot":0},{"type":"output","x":0,"y":35,"rot":0},{"type":"output","x":8,"y":35,"rot":0},{"type":"output","x":10,"y":35,"rot":0},{"type":"baler","x":2,"y":23,"rot":0}],"zones":[{"type":"road","cells":[[19,0],[19,1],[19,2],[19,3],[19,4],[19,5],[19,6],[19,7],[19,8],[19,9],[19,10],[19,11],[19,12],[19,13],[19,14],[19,15],[19,16],[19,17],[19,18],[19,19],[19,20],[19,21],[19,22],[19,23],[19,24],[19,25],[19,26],[19,27],[19,28],[19,29],[19,30],[19,31],[19,32],[19,33],[19,34],[19,35],[19,36],[19,37],[19,38],[19,39],[19,40],[19,41],[20,0],[20,1],[20,2],[20,3],[20,4],[20,5],[20,6],[20,7],[20,8],[20,9],[20,10],[20,11],[20,12],[20,13],[20,14],[20,15],[20,16],[20,17],[20,18],[20,19],[20,20],[20,21],[20,22],[20,23],[20,24],[20,25],[20,26],[20,27],[20,28],[20,29],[20,30],[20,31],[20,32],[20,33],[20,34],[20,35],[20,36],[20,37],[20,38],[20,39],[20,40],[20,41]]},{"type":"truckin","cells":[[0,0],[0,1],[0,2],[0,3],[1,0],[1,1],[1,2],[1,3],[2,0],[2,1],[2,2],[2,3],[3,0],[3,1],[3,2],[3,3],[4,0],[4,1],[4,2],[4,3],[5,0],[5,1],[5,2],[5,3],[6,0],[6,1],[6,2],[6,3],[7,0],[7,1],[7,2],[7,3],[8,0],[8,1],[8,2],[8,3],[9,0],[9,1],[9,2],[9,3],[10,0],[10,1],[10,2],[10,3],[11,0],[11,1],[11,2],[11,3],[12,0],[12,1],[12,2],[12,3],[13,0],[13,1],[13,2],[13,3],[14,0],[14,1],[14,2],[14,3],[15,0],[15,1],[15,2],[15,3],[16,0],[16,1],[16,2],[16,3],[17,0],[17,1],[17,2],[17,3],[18,0],[18,1],[18,2],[18,3]]},{"type":"truckout","cells":[[0,38],[0,39],[0,40],[0,41],[1,38],[1,39],[1,40],[1,41],[2,38],[2,39],[2,40],[2,41],[3,38],[3,39],[3,40],[3,41],[4,38],[4,39],[4,40],[4,41],[5,38],[5,39],[5,40],[5,41],[6,38],[6,39],[6,40],[6,41],[7,38],[7,39],[7,40],[7,41],[8,38],[8,39],[8,40],[8,41],[9,38],[9,39],[9,40],[9,41],[10,38],[10,39],[10,40],[10,41],[11,38],[11,39],[11,40],[11,41],[12,38],[12,39],[12,40],[12,41],[13,38],[13,39],[13,40],[13,41],[14,38],[14,39],[14,40],[14,41],[15,38],[15,39],[15,40],[15,41],[16,38],[16,39],[16,40],[16,41],[17,38],[17,39],[17,40],[17,41],[18,38],[18,39],[18,40],[18,41]]},{"type":"input","cells":[[2,4],[2,5],[2,6],[3,4],[3,5],[3,6],[4,4],[4,5],[4,6],[5,4],[5,5],[5,6],[6,4],[6,5],[6,6],[7,4],[7,5],[7,6],[8,4],[8,5],[8,6],[9,4],[9,5],[9,6],[10,4],[10,5],[10,6],[11,4],[11,5],[11,6],[12,4],[12,5],[12,6],[13,4],[13,5],[13,6],[14,4],[14,5],[14,6],[15,4],[15,5],[15,6],[16,4],[16,5],[16,6]]},{"type":"feeder","cells":[[2,10],[2,11],[3,10],[3,11],[4,10],[4,11],[5,10],[5,11],[6,10],[6,11],[7,10],[7,11],[8,10],[8,11],[9,10],[9,11],[10,10],[10,11],[11,10],[11,11],[12,10],[12,11],[13,10],[13,11],[14,10],[14,11],[15,10],[15,11],[16,10],[16,11]]},{"type":"baling","cells":[[2,12],[2,13],[2,14],[2,15],[2,16],[2,17],[2,18],[2,19],[2,20],[2,21],[2,22],[2,23],[2,24],[2,25],[2,26],[2,27],[2,28],[3,12],[3,13],[3,14],[3,15],[3,16],[3,17],[3,18],[3,19],[3,20],[3,21],[3,22],[3,23],[3,24],[3,25],[3,26],[3,27],[3,28],[15,12],[15,13],[15,14],[15,15],[15,16],[15,17],[15,18],[15,19],[15,20],[15,21],[15,22],[15,23],[15,24],[15,25],[15,26],[15,27],[15,28],[16,12],[16,13],[16,14],[16,15],[16,16],[16,17],[16,18],[16,19],[16,20],[16,21],[16,22],[16,23],[16,24],[16,25],[16,26],[16,27],[16,28]]},{"type":"bulk","cells":[[2,29],[2,30],[2,31],[3,29],[3,30],[3,31],[4,29],[4,30],[4,31],[5,29],[5,30],[5,31],[6,29],[6,30],[6,31],[7,29],[7,30],[7,31],[8,29],[8,30],[8,31],[9,29],[9,30],[9,31],[10,29],[10,30],[10,31],[11,29],[11,30],[11,31],[12,29],[12,30],[12,31],[13,29],[13,30],[13,31],[14,29],[14,30],[14,31],[15,29],[15,30],[15,31],[16,29],[16,30],[16,31]]},{"type":"output","cells":[[0,35],[0,36],[0,37],[1,35],[1,36],[1,37],[2,35],[2,36],[2,37],[3,35],[3,36],[3,37],[4,35],[4,36],[4,37],[5,35],[5,36],[5,37],[6,35],[6,36],[6,37],[7,35],[7,36],[7,37],[8,35],[8,36],[8,37],[9,35],[9,36],[9,37],[10,35],[10,36],[10,37],[11,35],[11,36],[11,37],[12,35],[12,36],[12,37],[13,35],[13,36],[13,37],[14,35],[14,36],[14,37],[15,35],[15,36],[15,37],[16,35],[16,36],[16,37],[17,35],[17,36],[17,37],[18,35],[18,36],[18,37]]},{"type":"dirt","cells":[[0,4],[0,5],[0,6],[1,4],[1,5],[1,6],[17,4],[17,5],[17,6],[18,4],[18,5],[18,6],[0,7],[0,8],[0,9],[1,7],[1,8],[1,9],[2,7],[2,8],[2,9],[3,7],[3,8],[3,9],[4,7],[4,8],[4,9],[5,7],[5,8],[5,9],[6,7],[6,8],[6,9],[7,7],[7,8],[7,9],[8,7],[8,8],[8,9],[9,7],[9,8],[9,9],[10,7],[10,8],[10,9],[11,7],[11,8],[11,9],[12,7],[12,8],[12,9],[13,7],[13,8],[13,9],[14,7],[14,8],[14,9],[15,7],[15,8],[15,9],[16,7],[16,8],[16,9],[17,7],[17,8],[17,9],[18,7],[18,8],[18,9],[0,10],[0,11],[0,12],[0,13],[0,14],[0,15],[0,16],[0,17],[0,18],[0,19],[0,20],[0,21],[0,22],[0,23],[0,24],[0,25],[0,26],[0,27],[0,28],[0,29],[0,30],[0,31],[0,32],[0,33],[0,34],[1,10],[1,11],[1,12],[1,13],[1,14],[1,15],[1,16],[1,17],[1,18],[1,19],[1,20],[1,21],[1,22],[1,23],[1,24],[1,25],[1,26],[1,27],[1,28],[1,29],[1,30],[1,31],[1,32],[1,33],[1,34],[17,10],[17,11],[17,12],[17,13],[17,14],[17,15],[17,16],[17,17],[17,18],[17,19],[17,20],[17,21],[17,22],[17,23],[17,24],[17,25],[17,26],[17,27],[17,28],[17,29],[17,30],[17,31],[17,32],[17,33],[17,34],[18,10],[18,11],[18,12],[18,13],[18,14],[18,15],[18,16],[18,17],[18,18],[18,19],[18,20],[18,21],[18,22],[18,23],[18,24],[18,25],[18,26],[18,27],[18,28],[18,29],[18,30],[18,31],[18,32],[18,33],[18,34],[2,32],[2,33],[2,34],[3,32],[3,33],[3,34],[4,32],[4,33],[4,34],[5,32],[5,33],[5,34],[6,32],[6,33],[6,34],[7,32],[7,33],[7,34],[8,32],[8,33],[8,34],[9,32],[9,33],[9,34],[10,32],[10,33],[10,34],[11,32],[11,33],[11,34],[12,32],[12,33],[12,34],[13,32],[13,33],[13,34],[14,32],[14,33],[14,34],[15,32],[15,33],[15,34],[16,32],[16,33],[16,34]]}],"connections":[{"type":"vehicle","from":{"unit":0,"side":"b"},"to":{"unit":6,"side":"t"},"via":[],"route":[[3,7],[2.5,7.5],[5.5,7.5],[5.5,10]]},{"type":"vehicle","from":{"unit":1,"side":"b"},"to":{"unit":6,"side":"t"},"via":[],"route":[[5,7],[4.5,7.5],[5.5,7.5],[5.5,10]]},{"type":"vehicle","from":{"unit":2,"side":"b"},"to":{"unit":7,"side":"t"},"via":[],"route":[[7,7],[6.5,7.5],[9.5,7.5],[9.5,10]]},{"type":"vehicle","from":{"unit":5,"side":"b"},"to":{"unit":7,"side":"t"},"via":[],"route":[[12,7],[11.5,7.5],[9.5,7.5],[9.5,10]]},{"type":"vehicle","from":{"unit":4,"side":"b"},"to":{"unit":7,"side":"t"},"via":[],"route":[[14,7],[13.5,7.5],[9.5,7.5],[9.5,10]]},{"type":"vehicle","from":{"unit":3,"side":"b"},"to":{"unit":8,"side":"t"},"via":[],"route":[[16,7],[15.5,7.5],[13.5,7.5],[13.5,10]]},{"type":"conveyor","from":{"unit":7,"side":"b"},"to":{"unit":20,"side":"t"},"via":[],"route":[[9.5,12],[9.5,29]]},{"type":"conveyor","from":{"unit":8,"side":"b"},"to":{"unit":21,"side":"t"},"via":[],"route":[[13.5,12],[13.5,29]]},{"type":"conveyor","from":{"unit":6,"side":"b"},"to":{"unit":9,"side":"t"},"via":[],"route":[[5.5,12],[5.5,13]]},{"type":"conveyor","from":{"unit":9,"side":"b"},"to":{"unit":10,"side":"t"},"via":[],"route":[[5.5,14],[5.5,15]]},{"type":"conveyor","from":{"unit":10,"side":"l"},"to":{"unit":13,"side":"r"},"via":[],"route":[[5,15.5],[4,15.5]]},{"type":"conveyor","from":{"unit":10,"side":"b"},"to":{"unit":11,"side":"t"},"via":[],"route":[[5.5,16],[5.5,17]]},{"type":"conveyor","from":{"unit":11,"side":"l"},"to":{"unit":14,"side":"r"},"via":[],"route":[[5,17.5],[4,17.5]]},{"type":"conveyor","from":{"unit":11,"side":"b"},"to":{"unit":12,"side":"t"},"via":[],"route":[[5.5,18],[5.5,19]]},{"type":"conveyor","from":{"unit":12,"side":"l"},"to":{"unit":15,"side":"r"},"via":[],"route":[[5,19.5],[4,19.5]]},{"type":"conveyor","from":{"unit":12,"side":"b"},"to":{"unit":16,"side":"t"},"via":[],"route":[[5.5,20],[5.5,21]]},{"type":"conveyor","from":{"unit":16,"side":"b"},"to":{"unit":18,"side":"t"},"via":[],"route":[[5.5,22],[5.5,25]]},{"type":"conveyor","from":{"unit":16,"side":"r"},"to":{"unit":17,"side":"t"},"via":[],"route":[[6,21.5],[7.5,21.5],[7.5,23]]},{"type":"conveyor","from":{"unit":17,"side":"l"},"to":{"unit":29,"side":"r"},"via":[],"route":[[7,23.5],[4,23.5]]},{"type":"conveyor","from":{"unit":18,"side":"l"},"to":{"unit":29,"side":"r"},"via":[],"route":[[5,25.5],[4.5,25.5],[4.5,23.5],[4,23.5]]},{"type":"conveyor","from":{"unit":18,"side":"b"},"to":{"unit":19,"side":"t"},"via":[],"route":[[5.5,26],[5.5,29]]},{"type":"conveyor","from":{"unit":17,"side":"b"},"to":{"unit":19,"side":"t"},"via":[],"route":[[7.5,24],[7.5,26.5],[5.5,26.5],[5.5,29]]},{"type":"vehicle","from":{"unit":14,"side":"l"},"to":{"unit":22,"side":"t"},"via":[],"route":[[2,17.5],[1.5,17.5],[1.5,32.5],[2.5,32.5],[2.5,34.5],[3,35]]},{"type":"vehicle","from":{"unit":13,"side":"l"},"to":{"unit":26,"side":"t"},"via":[],"route":[[2,15.5],[0.5,15.5],[0.5,34.5],[1,35]]},{"type":"vehicle","from":{"unit":15,"side":"l"},"to":{"unit":23,"side":"t"},"via":[],"route":[[2,19.5],[1.5,19.5],[1.5,32.5],[4.5,32.5],[4.5,34.5],[5,35]]},{"type":"vehicle","from":{"unit":29,"side":"l"},"to":{"unit":24,"side":"t"},"via":[],"route":[[2,23.5],[1.5,23.5],[1.5,32.5],[6.5,32.5],[6.5,34.5],[7,35]]},{"type":"vehicle","from":{"unit":19,"side":"b"},"to":{"unit":25,"side":"t"},"via":[],"route":[[5.5,32],[5.5,32.5],[15.5,32.5],[15.5,35]]},{"type":"vehicle","from":{"unit":20,"side":"b"},"to":{"unit":25,"side":"t"},"via":[],"route":[[9.5,32],[9.5,32.5],[15.5,32.5],[15.5,35]]},{"type":"vehicle","from":{"unit":21,"side":"b"},"to":{"unit":25,"side":"t"},"via":[],"route":[[13.5,32],[13.5,32.5],[15.5,32.5],[15.5,35]]}]};
function _cellSet(v){const s=new Set();for(const r of v){if(r.length===2)s.add(r[0]+","+r[1]);else for(let x=r[0];x<=r[2];x++)for(let y=r[1];y<=r[3];y++)s.add(x+","+y);}return s;}
const SITE={};
function siteSets(){if(!SITE.dirt){SITE.dirt=_cellSet(SITE_LAYOUT.zones.find(z=>z.type==="dirt").cells);SITE.shell=_cellSet(SITE_LAYOUT.shell);SITE.prop=_cellSet(SITE_LAYOUT.property);}return SITE;}
// Functional PLACEMENT zones: each unit family may only sit in its coloured area (Denis 2026-07-11).
// Balers occupy the two orange strips flanking the warehouse's white corridor; the corridor stays
// clear so forklifts on the aprons reach every baler's product without entering the warehouse.
function _zoneCells(t){const z=SITE_LAYOUT.zones.find(zz=>zz.type===t);return z?z.cells:[];}
function sitePlaceZones(){if(SITE._pz)return SITE._pz;
  const mk=(cells)=>_cellSet(cells);
  const S=siteSets();
  const balingS=_cellSet(_zoneCells("baling")),feederS=_cellSet(_zoneCells("feeder")),bulkS=_cellSet(_zoneCells("bulk"));
  // The CORRIDOR = the warehouse floor minus the orange strips (baling), the green feeder strip and
  // the lime bulk strip. Sorting machines + conveyors live here; the orange strips take ONLY balers.
  // Every baler is thus on the periphery, reachable by apron forklifts — machines never need reaching.
  const corridor=[];for(const k of S.shell){if(!balingS.has(k)&&!feederS.has(k)&&!bulkS.has(k))corridor.push(k.split(",").map(Number));}
  SITE._pz={
    input:mk(_zoneCells("input")),        // teal intake apron
    feeder:mk(_zoneCells("feeder")),      // green strip, top of hall
    process:mk(corridor),                 // WHITE central corridor — machines & conveyors only
    mixer:mk(corridor),                   // the merge junction lives in the corridor too
    baler:mk(_zoneCells("baling")),       // orange side strips — BALERS only
    bulk:mk(_zoneCells("bulk")),          // lime strip, bottom of hall
    output:mk(_zoneCells("output")),      // orange output apron
    landfill:mk(_zoneCells("truckout").concat(_zoneCells("output"))) // lower yard
  };
  return SITE._pz;}
function siteFootprint(t,rot){const o=SITE_OBJ[t];return(rot===90||rot===270)?{w:o.h,h:o.w}:{w:o.w,h:o.h};}
// fromPort resolution: reuse the engine's own "selected stream" convention (outPortPos):
// side (l/r) carries the selected/ejected stream (t.accept, or A on a splitter); down (b) the rest.
function sitePort(node,side){const t=TYPES[node.type],outs=t.out;
  if(outs.length===1)return outs[0];
  const sel=t.accept||(t.isSplit?"A":outs[0]),other=outs.find(p=>p!==sel)||outs[0];
  return(side==="l"||side==="r")?sel:other;}
// loadSite(layout, config) — the scenario loader. Layout = physical truth (geometry, routes);
// config = what each machine IS: {units:{index:{kind,spec,target,ratio,rate,supplier,buyer,portMap}}}.
// `process` placeholders REQUIRE config.units[i].kind (an engine TYPES key). Throws on any gap:
// a mis-specified plant must fail at load, not mid-sim.
function _siteMakeUnit(o,cu){cu=cu||{};let type,role=null;
  if(o.type==="process"){type=cu.kind;if(!type||!TYPES[type])throw new Error("site unit: a process placeholder needs a kind (got "+type+")");}
  else{const k=SITE_KIND[o.type];if(!k)throw new Error("site unit: unknown site type "+o.type);type=k.type;role=k.role||null;}
  const fp=siteFootprint(o.type,o.rot||0);
  const n=_addOne(type,(o.x+fp.w/2)*CELL,(o.y+fp.h/2)*CELL,cu.spec||null,role);
  n.w=fp.w*CELL;n.h=fp.h*CELL;n.gx=o.x;n.gy=o.y;n.rot=o.rot||0;n.site=o.type;
  if(cu.target)n.target=cu.target;if(cu.ratio!=null)n.ratio=cu.ratio;if(cu.rate!=null)n.rate=cu.rate;
  if(cu.supplier!==undefined)n.supplier=cu.supplier;if(cu.buyer)n.buyer=cu.buyer;
  if(cu.stock>0){const _c=(G.contract&&G.contract.comp)||{paper:1}; // opening stock, rolled on the seeded rng (deterministic)
    for(let k=0;k<cu.stock;k++){let r=rng(),a=0,p="paper";for(const m of MAT){a+=_c[m]||0;if(r<a){p=m;break;}}n.inBuf[p][0]++;}
    G.deliveredTot+=cu.stock*PMASS;} // yesterday's deliveries: in the MASS books (NNG-1), not in today's cash
  if(cu.due>0)n.truckDue=cu.due;
  return n;}
function _siteMakeEdge(A,fromSide,B,toSide,kind,routeCells,portOverride){
  const port=portOverride||sitePort(A,fromSide);
  if(TYPES[A.type].out.indexOf(port)<0)throw new Error("site edge: unknown port "+port+" on "+A.type);
  const wroute=routeCells.map(p=>[p[0]*CELL,p[1]*CELL]);
  const wlen=pathLen(wroute);
  const e={from:A.id,fromPort:port,to:B.id,sprites:[],kind,route:wroute,fromSide,toSide,
    speed:(kind==="conveyor"&&wlen>0)?SITE_BELT_SPEED/wlen:EDGE_SPEED,
    max:(kind==="conveyor")?beltMaxFor(wlen):EDGE_MAX};
  G.edges.push(e);return e;}
function preplaceTutorial(){ // guided career: give the player the infrastructure (bunker, export bays, landfill, bulk)
  // Sorting units (opener/magnet/baler…) are added BY THE PLAYER during the tutorial steps.
  const put=(o,cu)=>_siteMakeUnit(o,cu||{});
  const _tb=put({type:"input", x:6, y:4, rot:0},{supplier:"wasteminster"}); // 1 EMPTY bunker; first truck primed below
  if(_tb)primeFirstTruck(_tb); // clean start: no opening stock, first Wasteminster truck minutes away
  put({type:"output",x:2, y:35,rot:0},{spec:"ferrous"});        // export bay 1 (ferrous by default)
  put({type:"output",x:4, y:35,rot:0},{spec:"alu"});            // export bay 2
  put({type:"output",x:6, y:35,rot:0},{spec:"PET"});            // export bay 3
  put({type:"bulk",  x:8, y:29,rot:0},{});                      // 1 bulk (reject) container zone
  put({type:"landfill",x:12,y:35,rot:0},{});                    // landfill export (off-map evac)
}
function loadSite(layout,config){config=config||{};const cfgU=config.units||{};const made=[];
  layout.objects.forEach((o,i)=>{made.push(_siteMakeUnit(o,cfgU[i]||{}));});
  const _anchor=(o,side)=>{const fp=siteFootprint(o.type,o.rot||0);
    return side==="t"?[o.x+fp.w/2,o.y]:side==="b"?[o.x+fp.w/2,o.y+fp.h]:side==="l"?[o.x,o.y+fp.h/2]:[o.x+fp.w,o.y+fp.h/2];};
  layout.connections.forEach((c,ci)=>{const A=made[c.from.unit],B=made[c.to.unit];
    if(!A||!B)throw new Error("loadSite: connection "+ci+" references a missing unit");
    const oA=layout.objects[c.from.unit],oB=layout.objects[c.to.unit];
    if(c.type==="vehicle"&&oA.type==="input"&&oB.type==="feeder"){ // loader seam: direct Z, no side-road detour
      const p0=_anchor(oA,c.from.side),p1=_anchor(oB,c.to.side),my=(p0[1]+p1[1])/2;
      c={...c,route:(Math.abs(p0[0]-p1[0])<1e-6)?[p0,p1]:[p0,[p0[0],my],[p1[0],my],p1]};}
    if(c.type==="vehicle"&&(!c.route||c.route.length<2))throw new Error("loadSite: vehicle connection "+ci+" lacks a route");
    const pm=(cfgU[c.from.unit]||{}).portMap;
    _siteMakeEdge(A,c.from.side,B,c.to.side,c.type,
      c.route||[[A.x/CELL,A.y/CELL],[B.x/CELL,B.y/CELL]],pm&&pm[c.from.side]);});
  return made;}
// Reference-plant configuration (illustrative, RECYCLE-PHASE0.md §1). One sort column:
// opener → magnet(steel→baler13) → eddy(alu→baler14) → air(light→baler15) → splitter → 2×NIR
// (kept PET → baler29, reject → bulk). Feeders 7/8 run straight to bulk (unprocessed lines).
// Active bunkers: 0,2,3 (one per feeder) at the contract stream; the rest idle ("__none").
// NOTE (content gap, flagged 2026-07-11): no paper/film spec exists yet, so baler15's light
// fraction sells off-spec under "PET" — placeholder until a paper buyer is added.
const SITE_CONFIG_REF={units:{
  0:{stock:2000,due:900},2:{stock:2000,due:900},3:{stock:2000,due:900}, // 20 t on each active tipping floor at opening; first truck minutes away
  1:{supplier:"__none"},4:{supplier:"__none"},5:{supplier:"__none"},
  9:{kind:"opener"},10:{kind:"magnet"},11:{kind:"eddy"},12:{kind:"air"},
  16:{kind:"splitter",ratio:0.5},17:{kind:"nir"},18:{kind:"nir"},
  22:{spec:"alu"},23:{spec:"PET"},24:{spec:"PET"},26:{spec:"ferrous"},27:{spec:"PET"},28:{spec:"PET"}}};
// ─── Reference plant = Denis’ hand-built, profit-positive site (recycle-sandbox-2026-07-12.json,
//     27 units / 29 connections, fleet loader3/forklift7/ctruck1). Replaces the old illustrative
//     SITE_LAYOUT/SITE_CONFIG_REF plant, which ran at a loss and blocked the tech tree. Structure only:
//     buffers start empty, runtime (cash/t/vehicles/sold) is fresh; economics reproduce ~+9.9k €/day. ───
const SITE_REF_SNAPSHOT={"nodes":[{"id":1,"type":"storage","x":270,"y":165,"w":60,"h":90,"gx":8,"gy":4,"rot":0,"site":"input","role":"bunker","spec":"PET","rate":5,"ratio":0.5,"workers":2,"target":"film","supplier":"wasteminster","active":0},{"id":2,"type":"storage","x":285,"y":330,"w":30,"h":60,"gx":9,"gy":10,"rot":0,"site":"feeder","role":"feeder","spec":"PET","rate":3,"ratio":0.5,"workers":2,"target":"film","active":0},{"id":3,"type":"opener","x":285,"y":405,"w":30,"h":30,"gx":9,"gy":13,"rot":0,"site":"process","spec":"PET","rate":5,"ratio":0.5,"workers":2,"target":"film","active":0},{"id":4,"type":"pick","x":285,"y":465,"w":30,"h":30,"gx":9,"gy":15,"rot":0,"site":"process","spec":"PET","rate":5,"ratio":0.5,"workers":5,"target":"film","sortSide":"l","active":0},{"id":5,"type":"air","x":285,"y":525,"w":30,"h":30,"gx":9,"gy":17,"rot":0,"site":"process","spec":"PET","rate":5,"ratio":0.5,"workers":2,"target":"film","sortSide":"l","active":0},{"id":6,"type":"magnet","x":285,"y":585,"w":30,"h":30,"gx":9,"gy":19,"rot":0,"site":"process","spec":"PET","rate":5,"ratio":0.5,"workers":2,"target":"film","sortSide":"l","active":0},{"id":7,"type":"nir","x":345,"y":675,"w":30,"h":30,"gx":11,"gy":22,"rot":0,"site":"process","spec":"PET","rate":5,"ratio":0.5,"workers":2,"target":"film","active":0},{"id":8,"type":"nir","x":225,"y":675,"w":30,"h":30,"gx":7,"gy":22,"rot":0,"site":"process","spec":"PET","rate":5,"ratio":0.5,"workers":2,"target":"film","sortSide":"l","active":0},{"id":9,"type":"splitter","x":285,"y":645,"w":30,"h":30,"gx":9,"gy":21,"rot":0,"site":"process","spec":"PET","rate":5,"ratio":0.5,"workers":2,"target":"film","sortSide":"r","splitLayout":"sides","active":0},{"id":10,"type":"mixer","x":285,"y":705,"w":30,"h":30,"gx":9,"gy":23,"rot":0,"site":"mixer","spec":"PET","rate":5,"ratio":0.5,"workers":2,"target":"film","active":0},{"id":11,"type":"eddy","x":285,"y":825,"w":30,"h":30,"gx":9,"gy":27,"rot":0,"site":"process","spec":"PET","rate":5,"ratio":0.5,"workers":2,"target":"film","sortSide":"l","active":0},{"id":12,"type":"pick","x":285,"y":765,"w":30,"h":30,"gx":9,"gy":25,"rot":0,"site":"process","spec":"PET","rate":5,"ratio":0.5,"workers":4,"target":"PVC","sortSide":"l","active":0},{"id":13,"type":"storage","x":285,"y":915,"w":90,"h":90,"gx":8,"gy":29,"rot":0,"site":"bulk","role":"bulk","spec":"PET","rate":5,"ratio":0.5,"workers":2,"target":"film","active":0},{"id":14,"type":"storage","x":60,"y":1095,"w":60,"h":90,"gx":1,"gy":35,"rot":0,"site":"output","role":"export","spec":"film","rate":5,"ratio":0.5,"workers":2,"target":"film","buyer":"cling_on","active":0},{"id":15,"type":"storage","x":120,"y":1095,"w":60,"h":90,"gx":3,"gy":35,"rot":0,"site":"output","role":"export","spec":"carton","rate":5,"ratio":0.5,"workers":2,"target":"film","buyer":"corr_blimey","active":0},{"id":16,"type":"storage","x":180,"y":1095,"w":60,"h":90,"gx":5,"gy":35,"rot":0,"site":"output","role":"export","spec":"ferrous","rate":5,"ratio":0.5,"workers":2,"target":"film","buyer":"ferrous_bueller","active":0},{"id":17,"type":"storage","x":240,"y":1095,"w":60,"h":90,"gx":7,"gy":35,"rot":0,"site":"output","role":"export","spec":"PET","rate":5,"ratio":0.5,"workers":2,"target":"film","buyer":"repetitive","active":0},{"id":18,"type":"storage","x":300,"y":1095,"w":60,"h":90,"gx":9,"gy":35,"rot":0,"site":"output","role":"export","spec":"alu","rate":5,"ratio":0.5,"workers":2,"target":"film","buyer":"aluminati","active":0},{"id":19,"type":"storage","x":435,"y":1095,"w":210,"h":90,"gx":11,"gy":35,"rot":0,"site":"landfill","role":"landfill","spec":"PET","rate":5,"ratio":0.5,"workers":2,"target":"film","active":0},{"id":20,"type":"baler","x":90,"y":465,"w":60,"h":30,"gx":2,"gy":15,"rot":0,"site":"baler","spec":"PET","rate":5,"ratio":0.5,"workers":2,"target":"film","active":0},{"id":21,"type":"baler","x":90,"y":525,"w":60,"h":30,"gx":2,"gy":17,"rot":0,"site":"baler","spec":"PET","rate":5,"ratio":0.5,"workers":2,"target":"film","active":0},{"id":22,"type":"baler","x":90,"y":585,"w":60,"h":30,"gx":2,"gy":19,"rot":0,"site":"baler","spec":"PET","rate":5,"ratio":0.5,"workers":2,"target":"film","active":0},{"id":23,"type":"baler","x":90,"y":675,"w":60,"h":30,"gx":2,"gy":22,"rot":0,"site":"baler","spec":"PET","rate":5,"ratio":0.5,"workers":2,"target":"film","active":0},{"id":24,"type":"baler","x":90,"y":765,"w":60,"h":30,"gx":2,"gy":25,"rot":0,"site":"baler","spec":"PET","rate":5,"ratio":0.5,"workers":2,"target":"film","active":0},{"id":25,"type":"baler","x":90,"y":825,"w":60,"h":30,"gx":2,"gy":27,"rot":0,"site":"baler","spec":"PET","rate":5,"ratio":0.5,"workers":2,"target":"film","active":0},{"id":26,"type":"baler","x":480,"y":675,"w":60,"h":30,"gx":15,"gy":22,"rot":180,"site":"baler","spec":"PET","rate":5,"ratio":0.5,"workers":2,"target":"film","active":0},{"id":27,"type":"storage","x":330,"y":165,"w":60,"h":90,"gx":10,"gy":4,"rot":0,"site":"input","role":"bunker","spec":"PET","rate":5,"ratio":0.5,"workers":2,"target":"film","supplier":"wasteminster","active":0}],"edges":[{"from":1,"fromPort":"O","to":2,"fromSide":"b","toSide":"t","route":[[270,210],[270,255],[285,255],[285,300]],"kind":"vehicle","max":14,"speed":66},{"from":2,"fromPort":"O","to":3,"fromSide":"b","toSide":"t","route":[[285,360],[285,390]],"kind":"conveyor","max":14,"speed":30},{"from":3,"fromPort":"O","to":4,"fromSide":"b","toSide":"t","route":[[285,420],[285,450]],"kind":"conveyor","max":14,"speed":30},{"from":4,"fromPort":"O","to":5,"fromSide":"b","toSide":"t","route":[[285,480],[285,510]],"kind":"conveyor","max":14,"speed":30},{"from":5,"fromPort":"M","to":6,"fromSide":"b","toSide":"t","route":[[285,540],[285,570]],"kind":"conveyor","max":14,"speed":30},{"from":6,"fromPort":"M","to":9,"fromSide":"b","toSide":"t","route":[[285,600],[285,630]],"kind":"conveyor","max":14,"speed":30},{"from":9,"fromPort":"B","to":7,"fromSide":"r","toSide":"t","route":[[300,645],[345,645],[345,660]],"kind":"conveyor","max":14,"speed":15},{"from":7,"fromPort":"S","to":10,"fromSide":"b","toSide":"r","route":[[345,690],[345,705],[300,705]],"kind":"conveyor","max":14,"speed":15},{"from":9,"fromPort":"A","to":8,"fromSide":"l","toSide":"t","route":[[270,645],[225,645],[225,660]],"kind":"conveyor","max":14,"speed":15},{"from":8,"fromPort":"S","to":10,"fromSide":"b","toSide":"l","route":[[225,690],[225,705],[270,705]],"kind":"conveyor","max":14,"speed":15},{"from":10,"fromPort":"O","to":12,"fromSide":"b","toSide":"t","route":[[285,720],[285,750]],"kind":"conveyor","max":14,"speed":30},{"from":12,"fromPort":"O","to":11,"fromSide":"b","toSide":"t","route":[[285,780],[285,810]],"kind":"conveyor","max":14,"speed":30},{"from":11,"fromPort":"M","to":13,"fromSide":"b","toSide":"t","route":[[285,840],[285,870]],"kind":"conveyor","max":14,"speed":30},{"from":13,"fromPort":"O","to":19,"fromSide":"b","toSide":"t","route":[[285,960],[285,975],[435,975],[435,1050]],"kind":"vehicle","max":14,"speed":66},{"from":4,"fromPort":"R","to":20,"fromSide":"l","toSide":"r","route":[[270,465],[120,465]],"kind":"conveyor","max":14,"speed":6},{"from":5,"fromPort":"S","to":21,"fromSide":"l","toSide":"r","route":[[270,525],[120,525]],"kind":"conveyor","max":14,"speed":6},{"from":6,"fromPort":"S","to":22,"fromSide":"l","toSide":"r","route":[[270,585],[120,585]],"kind":"conveyor","max":14,"speed":6},{"from":8,"fromPort":"M","to":23,"fromSide":"l","toSide":"r","route":[[210,675],[120,675]],"kind":"conveyor","max":14,"speed":10},{"from":12,"fromPort":"R","to":24,"fromSide":"l","toSide":"r","route":[[270,765],[120,765]],"kind":"conveyor","max":14,"speed":6},{"from":11,"fromPort":"S","to":25,"fromSide":"l","toSide":"r","route":[[270,825],[120,825]],"kind":"conveyor","max":14,"speed":6},{"from":7,"fromPort":"M","to":26,"fromSide":"r","toSide":"l","route":[[360,675],[450,675]],"kind":"conveyor","max":14,"speed":10},{"from":20,"fromPort":"O","to":14,"fromSide":"l","toSide":"t","route":[[60,465],[45,465],[45,1035],[60,1050]],"kind":"vehicle","max":14,"speed":66},{"from":21,"fromPort":"O","to":15,"fromSide":"l","toSide":"t","route":[[60,525],[45,525],[45,975],[105,975],[105,1035],[120,1050]],"kind":"vehicle","max":14,"speed":66},{"from":22,"fromPort":"O","to":16,"fromSide":"l","toSide":"t","route":[[60,585],[45,585],[45,975],[165,975],[165,1035],[180,1050]],"kind":"vehicle","max":14,"speed":66},{"from":23,"fromPort":"O","to":17,"fromSide":"l","toSide":"t","route":[[60,675],[45,675],[45,975],[225,975],[225,1035],[240,1050]],"kind":"vehicle","max":14,"speed":66},{"from":24,"fromPort":"O","to":14,"fromSide":"l","toSide":"t","route":[[60,765],[45,765],[45,1035],[60,1050]],"kind":"vehicle","max":14,"speed":66},{"from":25,"fromPort":"O","to":18,"fromSide":"l","toSide":"t","route":[[60,825],[45,825],[45,975],[285,975],[285,1035],[300,1050]],"kind":"vehicle","max":14,"speed":66},{"from":26,"fromPort":"O","to":17,"fromSide":"r","toSide":"t","route":[[510,675],[525,675],[525,975],[225,975],[225,1035],[240,1050]],"kind":"vehicle","max":14,"speed":66},{"from":27,"fromPort":"O","to":2,"fromSide":"b","toSide":"t","route":[[330,210],[330,255],[285,255],[285,300]],"kind":"vehicle","max":14,"speed":66}],"fleet":{"loader":3,"forklift":7,"ctruck":1},"nextId":28};
function loadSiteRef(snap){ // build the reference plant from the embedded snapshot into the fresh G (clean buffers)
  for(const ns of snap.nodes){const type=ns.type,role=ns.role||null,spec=ns.spec||"PET";
    if(!TYPES[type])throw new Error("loadSiteRef: unknown type "+type);
    G.nodes.push({id:ns.id,type,x:ns.x,y:ns.y,w:ns.w||78,h:ns.h||66,gx:(ns.gx!=null?ns.gx:null),gy:(ns.gy!=null?ns.gy:null),rot:ns.rot||0,site:ns.site||null,paidCapex:0,
      inBuf:blankBuf(),ratio:ns.ratio==null?0.5:ns.ratio,spec,
      bale:blankBuf(),bales:[],containers:(role==="bulk")?[blankBuf(),blankBuf(),blankBuf()]:null,active:0,disposeHeap:0,evacT:0,truckDue:0,offAllow:0,truckFlash:0,balesSold:0,offSold:0,
      role,rate:ns.rate||4,jam:0,load:0,state:"ok",wrongSize:0,workers:ns.workers||2,target:ns.target||"film",supplier:ns.supplier||null,buyer:ns.buyer||null,label:ns.label||null,sortSide:ns.sortSide||null,splitLayout:ns.splitLayout||null,contEvac:0,massEvac:0,_inMass:0,_outMass:0,_sortMass:0,_restMass:0});}
  const live=new Set(G.nodes.map(n=>n.id));
  for(const es of snap.edges)if(live.has(es.from)&&live.has(es.to)){
    const wl=(es.kind==="conveyor"&&es.route)?pathLen(es.route):0; // re-derive belt speed+max from the route (10 t/h model) — stored values are legacy
    G.edges.push({from:es.from,fromPort:es.fromPort,to:es.to,speed:(wl>0)?SITE_BELT_SPEED/wl:(es.speed||EDGE_SPEED),kind:es.kind||null,route:es.route||null,max:(wl>0)?beltMaxFor(wl):(es.max||null),fromSide:es.fromSide||null,toSide:es.toSide||null,sprites:[]});}
  _id=snap.nextId||(G.nodes.reduce((m,n)=>Math.max(m,n.id),0)+1);
  if(snap.fleet)G.fleet=Object.assign({},G.fleet,snap.fleet);
}
// ─── Atelier starter: a few pre-placed bays (2 bunkers, 1 bulk, 2 export PET/ferrous, 1 landfill) on a
//     financially-constrained site. The player builds the sorting line and scales the fleet from here. ───
const SITE_STARTER_SNAPSHOT={"nodes":[{"id":1,"type":"storage","x":270,"y":165,"w":60,"h":90,"gx":8,"gy":4,"rot":0,"site":"input","role":"bunker","spec":"PET","rate":5,"ratio":0.5,"workers":2,"target":"film","active":0,"supplier":"wasteminster"},{"id":2,"type":"storage","x":330,"y":165,"w":60,"h":90,"gx":10,"gy":4,"rot":0,"site":"input","role":"bunker","spec":"PET","rate":5,"ratio":0.5,"workers":2,"target":"film","active":0,"supplier":"wasteminster"},{"id":3,"type":"storage","x":285,"y":915,"w":90,"h":90,"gx":8,"gy":29,"rot":0,"site":"bulk","role":"bulk","spec":"PET","rate":5,"ratio":0.5,"workers":2,"target":"film","active":0},{"id":4,"type":"storage","x":60,"y":1095,"w":60,"h":90,"gx":1,"gy":35,"rot":0,"site":"output","role":"export","spec":"PET","rate":5,"ratio":0.5,"workers":2,"target":"film","active":0,"buyer":"repetitive"},{"id":5,"type":"storage","x":120,"y":1095,"w":60,"h":90,"gx":3,"gy":35,"rot":0,"site":"output","role":"export","spec":"ferrous","rate":5,"ratio":0.5,"workers":2,"target":"film","active":0,"buyer":"ferrous_bueller"},{"id":6,"type":"storage","x":435,"y":1095,"w":210,"h":90,"gx":11,"gy":35,"rot":0,"site":"landfill","role":"landfill","spec":"PET","rate":5,"ratio":0.5,"workers":2,"target":"film","active":0}],"edges":[],"fleet":{"loader":1,"forklift":1,"ctruck":1},"nextId":7};
SCENARIOS.site_free={name:"New site",startCash:1500000,unlimitedBudget:true,supplier:null,siteRef:true,siteEmpty:true,fleet:{loader:1,forklift:1,ctruck:1},
  logi:{loaderCap:100,loadDwell:0.25,unloadDwell:0.25,minTrip:0.05,
        tipDwell:2,cliDwell:3,lfDwell:2,exportCap:24,feederCap:500},  // lfCadence inherits LOGI (0.3) — the stale :15 here was throttling the landfill truck ~50x
  phases:[{name:"New site",tonnage:Infinity,comp:{PET:0.32,steel:0.15,alu:0.06,film:0.14,paper:0.26,PVC:0.07},product:"PET",feedTph:0.5,tiers:{gold:2.4,silver:3.0}}]};
SCENARIOS.site_career=Object.assign({},SCENARIOS.site_free,{name:"Career",tuto:true,unlimitedBudget:false,startCash:2500000});
SCENARIOS.site_atelier=Object.assign({},SCENARIOS.site_free,{name:"Atelier",startCash:2500000,unlimitedBudget:false,siteEmpty:false,siteStarter:true,fleet:{loader:1,forklift:1,ctruck:1}}); // financial-constraint mode, no tutorial, starter bays pre-placed
SCENARIOS.site_ref={name:"Reference plant",startCash:2000000,supplier:null,siteRef:true,fleet:{loader:3,forklift:7,ctruck:1},
  // D6 rebalance (2026-07-11): line feed 0.5 t/h (game-balance value; G.t is in HOURS);
  // loader dwell 0.25 h scoop/dump; dwells/cadence are in hours; landfill truck every 15 h;
  // export = 24 bales (6 cells × 4/cell). NB: these are tuned for play, not scaled to a real MRF.
  logi:{loaderCap:100,loadDwell:0.25,unloadDwell:0.25,minTrip:0.05,
        tipDwell:2,cliDwell:3,lfDwell:2,exportCap:24,feederCap:500},  // lfCadence inherits LOGI (0.3) — the stale :15 here was throttling the landfill truck ~50x
  phases:[{name:"Reference plant",tonnage:Infinity,comp:{PET:0.32,steel:0.15,alu:0.06,film:0.14,paper:0.26,PVC:0.07},product:"PET",feedTph:3,tiers:{gold:2.4,silver:3.0}}]};
// ─── Tutorial: per-phase guided steps. Each step is text + a pure check(G); the coach (UI) polls the
//     current step every frame, advances on completion, congratulates, and auto-pauses on milestones. ───
function nodeType(t){return G.nodes.find(n=>n.type===t);}
function edgeMatch(fp,tp,port){return G.edges.some(e=>{const f=nodeById(e.from),t=nodeById(e.to);return f&&t&&fp(f)&&tp(t)&&(!port||e.fromPort===port);});}
const _isT=t=>(n=>n.type===t);
const _outSpec=sp=>(n=>isSell(n)&&n.spec===sp); // isSell aliases isExport → matches the sell point (export zone)
const TUT={pmc:[
 [ // Phase 1 — Ferrous
  {info:1,t:"Trucks tip waste into the BUNKER (far left); a LOADER carries it to the FEEDER, which feeds your line. Bales sell at the EXPORT zone (top-right); reject goes to LANDFILL (bottom-right). Let\u2019s pull steel out and bale it.",f:"Les camions d\u00e9versent dans le BUNKER (\u00e0 gauche) ; un CHARGEUR porte la mati\u00e8re au FEEDER, qui alimente ta ligne. Les ballots se vendent \u00e0 la zone d\u2019EXPORT (haut-droite) ; le rejet part en D\u00c9CHARGE (bas-droite). Extrayons l\u2019acier."},
  {t:"Tap \uFF0B Add and drop a BAG OPENER on the line \u2014 it rips sacks open for sorting.",f:"Touche \uFF0B Ajouter et pose un OUVRE-SACS \u2014 il d\u00e9chire les sacs pour le tri.",c:()=>!!nodeType("opener"),ok:"Bags liberated.",okf:"Sacs ouverts."},
  {t:"Add a MAGNET \u2014 it lifts steel off the belt.",f:"Ajoute un AIMANT \u2014 il soul\u00e8ve l\u2019acier du tapis.",c:()=>!!nodeType("magnet"),ok:"Your steel separator.",okf:"Ton s\u00e9parateur d\u2019acier."},
  {t:"Add a BALER \u2014 it packs material into dense bales; a FORKLIFT then carries them to the export zone (the only form buyers take).",f:"Ajoute une PRESSE \u2014 elle compacte en ballots denses ; un CHARIOT les porte ensuite \u00e0 la zone d\u2019export (seule forme accept\u00e9e).",c:()=>!!nodeType("baler"),ok:"Bales = payment.",okf:"Les ballots = paiement."},
  {info:1,t:"Now wire it: tap a unit\u2019s OUTPUT port (the edge nub), then tap the next unit.",f:"Maintenant c\u00e2ble : touche le port de SORTIE (l\u2019ergot), puis l\u2019unit\u00e9 suivante."},
  {t:"Wire FEEDER \u2192 BAG OPENER. The feeder is your line\u2019s source \u2014 the bunker behind it is truck-fed.",f:"Relie FEEDER \u2192 OUVRE-SACS. Le feeder est la source de ta ligne \u2014 le bunker derri\u00e8re est aliment\u00e9 par camions.",c:()=>edgeMatch(isInput,_isT("opener")),ok:"Feed connected.",okf:"Aliment\u00e9."},
  {t:"Wire BAG OPENER \u2192 MAGNET.",f:"Relie OUVRE-SACS \u2192 AIMANT.",c:()=>edgeMatch(_isT("opener"),_isT("magnet")),ok:"Good.",okf:"Bien."},
  {t:"The magnet has TWO outlets. Wire STEEL \u2192 BALER.",f:"L\u2019aimant a DEUX sorties. Relie ACIER \u2192 PRESSE.",c:()=>edgeMatch(_isT("magnet"),_isT("baler"),"S"),ok:"Steel to the baler.",okf:"Acier vers la presse."},
  {t:"Wire the OTHER outlet (the rest) \u2192 a LANDFILL\u2019s bulk zone (\uFF0B Add \u2192 Landfill), or a Buffer. Unwired outlets jam the unit.",f:"Relie l\u2019AUTRE sortie (le reste) \u2192 la zone bulk d\u2019une D\u00c9CHARGE (\uFF0B Ajouter \u2192 Landfill), ou un Tampon. Une sortie non c\u00e2bl\u00e9e bloque l\u2019unit\u00e9.",c:()=>edgeMatch(_isT("magnet"),n=>isBulk(n)||n.role==="buffer","M"),ok:"Nothing backs up.",okf:"Plus de blocage."},
  {t:"Wire BALER \u2192 the SELL POINT selling ferrous (top-right).",f:"Relie PRESSE \u2192 le point de VENTE ferreux (haut-droite).",c:()=>edgeMatch(_isT("baler"),_outSpec("ferrous")),ok:"Line complete!",okf:"Ligne pr\u00eate !"},
  {info:1,t:"The FEEDER sets the pace \u2014 tap it for the feed rate (t/h). Behind it, the BUNKER fills from supplier trucks and a LOADER shuttles between them \u2014 automatic, you never wire that.",f:"Le FEEDER r\u00e8gle le rythme \u2014 touche-le pour le d\u00e9bit (t/h). Derri\u00e8re, le BUNKER se remplit par les camions fournisseurs et un CHARGEUR fait la navette \u2014 automatique, tu ne le c\u00e2bles pas."},
  {t:"Press \u25B6 (bottom) to start the feed.",f:"Appuie sur \u25B6 (en bas) pour lancer.",c:()=>!!G.running,ok:"Running \u2014 watch the steel flow.",okf:"En marche \u2014 regarde l\u2019acier filer."},
  {info:1,t:"Watch the yard move: the LOADER feeds the feeder, a FORKLIFT stocks the export zone, a CONTAINER TRUCK clears the landfill. Tap FLEET (truck icon, bottom bar) to see them \u2014 and add vehicles when a zone can\u2019t keep up.",f:"Regarde la cour : le CHARGEUR alimente le feeder, un CHARIOT stocke l\u2019export, un CAMION vide la d\u00e9charge. Touche FLOTTE (ic\u00f4ne camion, barre du bas) pour les voir \u2014 et en ajouter quand une zone sature."},
  {t:"Wait for your first ferrous bale to sell \u2014 a CLIENT TRUCK grades each one and pays.",f:"Attends la vente de ton premier ballot de ferreux \u2014 un CAMION CLIENT \u00e9value chacun et paie.",c:()=>!!(G.sold.ferrous&&G.sold.ferrous.on>0),pause:1,ok:"First sale \u2014 you\u2019re in business! Keep running to clear the phase.",okf:"Premi\u00e8re vente \u2014 lanc\u00e9 ! Continue pour finir la phase."},
  {info:1,t:"If the line stalls, a badge names the block: BUNKER FULL (trucks turned away), NO LOADER, STARVED, BALER FULL, EXPORT FULL, CONTAINER FULL. Fix the named zone \u2014 usually more fleet, or unblock what\u2019s downstream.",f:"Si la ligne cale, un badge nomme le blocage : BUNKER FULL (camions refus\u00e9s), NO LOADER, STARVED, BALER FULL, EXPORT FULL, CONTAINER FULL. R\u00e8gle la zone nomm\u00e9e \u2014 souvent plus de flotte, ou d\u00e9bloque l\u2019aval."},
  {info:1,t:"Tip: tap your CASH (top-left) any time for the full P&L \u2014 tipping in, ballot sales, landfill, power, capex and your diversion %.",f:"Astuce : touche ton ARGENT (en haut \u00e0 gauche) \u00e0 tout moment pour le bilan complet \u2014 redevance, ventes, d\u00e9charge, \u00e9nergie, investissements et ton taux de d\u00e9tournement."},
 ],
 [ // Phase 2 — Aluminium
  {info:1,t:"ALUMINIUM \u2014 the jackpot (\u20AC1200/t). Keep your steel line. Aluminium needs the EDDY, and only works AFTER the magnet takes the steel.",f:"ALUMINIUM \u2014 le jackpot (1200 \u20AC/t). Garde ta ligne acier. L\u2019alu passe par le FOUCAULT, et seulement APR\u00c8S que l\u2019aimant a pris l\u2019acier."},
  {t:"Open the R&D tab (bottom bar) and unlock the NON-FERROUS LINE (a small licence fee). That adds the eddy-current separator to your kit.",f:"Ouvre l\u2019onglet R&D (barre du bas) et d\u00e9bloque la LIGNE NON-FERREUSE (petite licence). \u00c7a ajoute le s\u00e9parateur \u00e0 courants de Foucault.",c:()=>careerTechOwned("r_eddyU"),node:"r_eddyU",ok:"Unlocked \u2014 back to Process to place it.",okf:"D\u00e9bloqu\u00e9 \u2014 retour \u00e0 Process pour le poser."},
   {t:"Add an EDDY-CURRENT separator.",f:"Ajoute un s\u00e9parateur \u00e0 COURANTS DE FOUCAULT.",c:()=>!!nodeType("eddy"),ok:"The aluminium kicker.",okf:"L\u2019\u00e9jecteur d\u2019alu."},
  {t:"Reroute the magnet\u2019s REST outlet \u2192 EDDY.",f:"Redirige la sortie RESTE de l\u2019aimant \u2192 FOUCAULT.",c:()=>edgeMatch(_isT("magnet"),_isT("eddy")),ok:"Steel first, then aluminium.",okf:"L\u2019acier d\u2019abord, puis l\u2019alu."},
  {info:1,t:"Give aluminium its OWN baler and its own SELL POINT set to aluminium (tap it \u2192 pick the alu buyer; don\u2019t mix with steel). Eddy\u2019s leftover \u2192 landfill, then run.",f:"Donne \u00e0 l\u2019alu sa PROPRE presse et son PROPRE point de vente r\u00e9gl\u00e9 sur aluminium (touche-le \u2192 choisis l\u2019acheteur alu ; pas avec l\u2019acier). Reste du Foucault \u2192 d\u00e9charge, puis lance."},
  {t:"Sell your first aluminium bale.",f:"Vends ton premier ballot d\u2019aluminium.",c:()=>!!(G.sold.alu&&G.sold.alu.on>0),pause:1,ok:"Aluminium sold \u2014 the big money.",okf:"Alu vendu \u2014 le gros lot."},
 ],
 [ // Phase 3 — PET & capacity
  {info:1,t:"PET must be CLEAN to make \u226595%. Steel, film and paper all contaminate it \u2014 strip them out before the NIRs or your ballots go off-spec.",f:"Le PET doit \u00eatre PROPRE pour atteindre \u226595%. L\u2019acier, le film et le papier le contaminent \u2014 retire-les avant les NIR ou tes ballots seront hors spec."},
  {t:"Open R&D and unlock DENSITY SEPARATION (a small licence fee). That\u2019s the air classifier.",f:"Ouvre R&D et d\u00e9bloque la S\u00c9PARATION DENSIM\u00c9TRIQUE (petite licence). C\u2019est le classificateur \u00e0 air.",c:()=>careerTechOwned("r_airU"),node:"r_airU",ok:"Air unlocked.",okf:"Air d\u00e9bloqu\u00e9."},
   {t:"Now unlock OPTICAL SORTING (a small licence fee). That\u2019s the NIR sorter.",f:"D\u00e9bloque le TRI OPTIQUE (petite licence). C\u2019est le trieur NIR.",c:()=>careerTechOwned("r_nirU"),node:"r_nirU",ok:"NIR unlocked \u2014 back to Process.",okf:"NIR d\u00e9bloqu\u00e9 \u2014 retour \u00e0 Process."},
   {t:"Add a NIR SORTER \u2014 it keeps PET and ejects the rest.",f:"Ajoute un TRIEUR NIR \u2014 il garde le PET et \u00e9jecte le reste.",c:()=>!!nodeType("nir"),ok:"The plastics reader.",okf:"Le lecteur de plastiques."},
  {t:"Add an AIR CLASSIFIER \u2014 it blows film + paper out as the light fraction.",f:"Ajoute un CLASSIFICATEUR \u00c0 AIR \u2014 il souffle le film + le papier (la fraction l\u00e9g\u00e8re).",c:()=>!!nodeType("air"),ok:"Paper & film remover.",okf:"\u00d4te le papier et le film."},
  {t:"Add a SPLITTER \u2014 one NIR can\u2019t keep up with the volume.",f:"Ajoute un R\u00c9PARTITEUR \u2014 un seul NIR ne suit pas le volume.",c:()=>!!nodeType("splitter"),ok:"Now you can feed two NIRs.",okf:"Tu peux alimenter deux NIR."},
  {info:1,t:"Build the clean line: opener \u2192 magnet (steel \u2192 landfill) \u2192 AIR (light film+paper \u2192 landfill) \u2192 splitter \u2192 two NIRs (PET kept; reject \u2192 landfill) \u2192 baler \u2192 a SELL POINT (PET). Then run it.",f:"Construis la ligne propre : ouvre-sacs \u2192 aimant (acier \u2192 d\u00e9charge) \u2192 AIR (film+papier l\u00e9gers \u2192 d\u00e9charge) \u2192 r\u00e9partiteur \u2192 deux NIR (PET gard\u00e9 ; rejet \u2192 d\u00e9charge) \u2192 presse \u2192 un point de VENTE (PET). Puis lance."},
  {t:"Sell your first clean PET ballot.",f:"Vends ton premier ballot de PET propre.",c:()=>!!(G.sold.PET&&G.sold.PET.on>0),pause:1,ok:"PET sold \u2014 clean line running. Finish the phase to complete the tutorial.",okf:"PET vendu \u2014 ligne propre. Termine la phase pour finir le tutoriel."},
 ],
]};
function applyPhase(i){const ph=G.scenario.phases[i];G.phaseIdx=i;G.delivered=0;G.phaseSoldBase={};for(const k in G.sold)G.phaseSoldBase[k]=G.sold[k].on||0;
  G.contract={name:ph.name,tonnage:ph.tonnage,comp:ph.comp,product:ph.product||"PET",tiers:ph.tiers||{gold:2.4,silver:3.0},premium:ph.premium||null,units:null,feedTph:ph.feedTph||4,supplier:(G.scenario&&G.scenario.supplier)||null};
  if(ph.grantTech){for(const id of ph.grantTech)if(CAREER.tech.indexOf(id)<0)CAREER.tech.push(id);recomputeTechMod();saveCareer();} // tutorial trunk auto-grants the free unlocks (Step 8: interactive tree-click)
  G.tut=(TUT[G.contractKey]&&TUT[G.contractKey][i])||null;G.tutStep=0;}
function tutNextChapter(){ // continuous model: the coach (not a tonnage quota) advances tutorial chapters; the feed never stops
  if(!G.scenario)return null;
  if(G.phaseIdx<G.scenario.phases.length-1){const i=G.phaseIdx+1,ph=G.scenario.phases[i];G.phaseIdx=i;
    if(ph.grantTech){for(const id of ph.grantTech)if(CAREER.tech.indexOf(id)<0)CAREER.tech.push(id);recomputeTechMod();saveCareer();}
    G.tut=(TUT[G.contractKey]&&TUT[G.contractKey][i])||null;G.tutStep=0;saveGame();return{chapter:true,phase:ph};}
  G.tut=null;const f=CAREER&&CAREER.counters&&CAREER.counters.flags;if(f)f.tutorialComplete=true;saveCareer();saveGame();return{done:true};}
function newGame(mode,contractKey,seed){
  _id=1;P=[];selNode=null;
  const ck=contractKey||"standard";
  const scn=SCENARIOS[ck]||null;const base=scn?scn.phases[0]:CONTRACTS[ck];
  // Each game (career OR sandbox) owns its own bank + tech + objectives — NOTHING is shared between distinct games.
  let cash0=(scn&&scn.startCash)||ECON.startCash;
  const _s0=(seed!=null)?(seed>>>0):0x9E3779B9;
  const _lg=Object.assign({},LOGI,(scn&&scn.logi)||{});
  G={mode,contractKey:ck,scenario:scn,phaseIdx:0,unlocked:scn?[]:null,tut:null,tutStep:0,nodes:[],edges:[],cash:cash0,startCash:cash0,seed:_s0,rngState:_s0,delivered:0,deliveredTot:0,landfill:0,
    petOn:0,petOff:0,ferOn:0,sold:{},minCash:cash0,running:false,speed:1,finished:false,tier:null,
    continuous:(mode==="sandbox"||(mode==="career"&&!!scn)),
    carryEmit:0,carry:{},energy:0,t:0,wageTot:0,ledger:{tipping:0,sales:0,subsidies:0,grants:0,labour:0,logistics:0,power:0,landfill:0,capex:0},connecting:null,pointer:null,
    logi:_lg,fleet:Object.assign({},_lg.fleet0,(scn&&scn.fleet)||{}),vehicles:[],jobs:[],vehId:1,trucks:[],truckId:1,
    contract:{name:base.name,tonnage:base.tonnage,comp:base.comp,product:base.product||"PET",tiers:base.tiers||{gold:2.4,silver:3.0},premium:base.premium||null,units:base.units||null,feedTph:base.feedTph||4,supplier:(scn&&scn.supplier)||base.supplier||null}};
  G.career=newCareer();G.career.bank=cash0;CAREER=G.career; // per-game progression; CAREER is a live pointer into G
  if(scn)applyPhase(0);
  if(mode==="sandbox"){G.cash=999999;G.contract.tonnage=Infinity;}
  if(G.continuous)G.contract.tonnage=Infinity;
  recomputeTechMod();
  if(scn&&scn.siteRef){
    if(scn.siteStarter){loadSiteRef(SITE_STARTER_SNAPSHOT);}   // Atelier: pre-placed starter bays
    else if(!scn.siteEmpty){loadSiteRef(SITE_REF_SNAPSHOT);}
    else if(scn.tuto)preplaceTutorial(); // guided site: infrastructure is pre-placed, player adds the sorting units
  } // grid-native site scenario; siteEmpty ⇒ the player builds the plant (Phase 3)
  else if(scn&&scn.scene){for(const sd of scn.scene)addNode(sd.type,sd.x,sd.y,sd.spec,sd.role);} // pre-placed tutorial scene
  else{addNode("storage",-150,0,null,"input");addNode("storage",150,0,"PET","output");}
  {const _src=G.nodes.find(isInput);if(_src)_src.rate=G.contract.feedTph||4;} // feeder rate defaults to the contract delivery rate
  ensureFleet(); // spawn pool vehicles (loaders home at the feeder) now that the scene exists
  UI.viewReset();
  saveGame();
}
function nodeById(id){return G.nodes.find(n=>n.id===id);}
function outEdge(n,port){return G.edges.find(e=>e.from===n.id&&e.fromPort===port);}
function inPortPos(n){return {x:n.x-n.w/2-11,y:n.y};}                       // inlet ← left
function portSideOf(n,port){ // which t/b/l/r side a given OUTPUT port is drawn on (mirrors outPortPos)
  const t=TYPES[n.type],outs=t.out;if(!outs.length)return "r";
  if(outs.length===1)return "r";                                  // single → right
  const up=t.accept||(t.isPick?"R":(t.isSplit?"A":outs[0]));      // selected stream → up
  return port===up?"t":"r";}
function outPortPos(n,port){const t=TYPES[n.type],outs=t.out;if(!outs.length)return null;
  if(outs.length===1)return {x:n.x+n.w/2+11,y:n.y};                          // single → right
  const up=t.accept||(t.isPick?"R":(t.isSplit?"A":outs[0]));                 // the "selected" stream
  if(port===up)return {x:n.x,y:n.y-n.h/2-11};                                // selected ↑ up
  return {x:n.x+n.w/2+11,y:n.y};}                                            // rest → right
function capOf(n){if(!n||n.type!=="storage")return BUF_CAP; // process units keep the small backpressure buffer
  const base=n.role==="bunker"?G.logi.bunkerCap:(n.role==="feeder"?G.logi.feederCap:(n.role==="bulk"?G.logi.containersPerZone*G.logi.containerCap:(n.role==="landfill"?G.logi.landfillHold*G.logi.containerCap:(n.role==="export"?G.logi.exportCap*BALE_N:(n.role==="input"?STORE_INPUT:(n.role==="buffer"?STORE_BUFFER:(n.role==="output"?STORE_OUTPUT:BUF_CAP)))))));
  return Math.round(base*((TECHMOD&&TECHMOD.storeCap)||1));}
function hasRoom(n){return cnt(n.inBuf)<capOf(n);}
// Bulk-zone container helpers (S-BATCH-2). Material fills the ACTIVE container; when it hits
// CONTAINER_CAP the next non-full container becomes active. A "full container" is one at/over cap
// (the container-truck hauls it whole). bulkRoom==0 ⇒ all 3 full ⇒ CONTAINER-FULL (belt backs up).
function bulkRoom(n){if(!n.containers)return 0;let r=0;for(const c of n.containers)r+=Math.max(0,G.logi.containerCap-cnt(c));return r;}
function bulkAdd(n,mat,st){if(!n.containers)return false;
  if(cnt(n.containers[n.active])>=G.logi.containerCap){let nx=-1;for(let i=0;i<n.containers.length;i++)if(cnt(n.containers[i])<G.logi.containerCap){nx=i;break;}if(nx<0)return false;n.active=nx;}
  n.containers[n.active][mat][st]++;return true;}
function bulkFullCount(n){if(!n.containers)return 0;let f=0;for(const c of n.containers)if(cnt(c)>=G.logi.containerCap)f++;return f;}
function spawnSprite(e,mat,st){let s=P.pop();if(!s)s={};s.mat=mat;s.st=st;s.bale=null;s.t=0;s.v=(G.sprSeq=((G.sprSeq||0)+1)%3);e.sprites.push(s);}
function spawnBale(e,tok){let s=P.pop();if(!s)s={};s.mat=null;s.st=0;s.bale=tok;s.t=0;s.v=0;e.sprites.push(s);}
function killSprite(e,i){const s=e.sprites[i];e.sprites.splice(i,1);if(P.length<600)P.push(s);}
// Win = the CONTRACT'S product made grade (≥80% of that product on-spec) and we're in the black.
// Product-aware (was PET-specific); standard/film keep product "PET" so the bar is unchanged.
function recyclingPct(){ // on-spec product recovered / total intake \u2014 stockpiling can\u2019t inflate it (held material isn\u2019t recovered)
  if(!G||G.mode==="sandbox")return 0; const di=G.deliveredTot||0; if(di<=0)return 0;
  let recov=0; for(const k in G.sold)recov+=(G.sold[k].on||0);
  return Math.max(0,Math.min(100,recov/di*100));}
function phaseProgress(){ // continuous model: cumulative on-spec EXPORT toward the first tonnage milestone (100 t) — never a contract quota
  if(!G||G.mode==="sandbox")return null;
  const done=(G.mode==="career"&&CAREER&&CAREER.counters&&CAREER.counters.exportedOnSpec)||0,total=100;
  return{done:done,total:total,frac:total>0?Math.max(0,Math.min(1,done/total)):0,exported:true};}
function contractWon(){const prod=(G.contract&&G.contract.product)||"PET";const s=G.sold[prod]||{on:0,off:0};
  return G.cash>0 && s.on>(s.on+s.off)*0.8 && s.on>0.5;}
function nodeRate(n,key){ // t/h over a rolling window from the cumulative mass counter n[key]
  if(!G)return 0;const now=G.t,cum=n[key]||0;
  const rk="_rr_"+key;const ring=n[rk]||(n[rk]=[]);
  const last=ring[ring.length-1];
  if(!last||now-last.t>=0.25){ring.push({t:now,v:cum});if(ring.length>40)ring.shift();}
  let a=ring[0];for(const s of ring){if(now-s.t<=6){a=s;break;}} // ~6 in-game hours window
  const dt=now-a.t;if(dt<=1e-6)return 0;
  return (cum-a.v)/dt;} // mass per in-game hour = t/h (1 unit of G.t = 1 hour)
function sellBale(node,tokBuf){const g=grade(tokBuf,node.spec),mass=cnt(tokBuf)*PMASS;
  node._outMass=(node._outMass||0)+mass;
  const rev=g.price*mass*TECHMOD.price; G.cash+=rev;G.ledger.sales+=rev;
  if(g.ok){node.balesSold++; if(node.spec==="PET")G.petOn+=mass; else G.ferOn+=mass; if(G.mode==="career")CAREER.counters.exportedOnSpec+=mass;}
  else {node.offSold++; if(node.spec==="PET")G.petOff+=mass;}
  const sp=G.sold[node.spec]||(G.sold[node.spec]={on:0,off:0}); if(g.ok)sp.on+=mass; else sp.off+=mass;
  if(g.ok&&G.contract&&G.contract.premium&&node.spec===G.contract.premium.product){const pr=G.contract.premium.perTonne*mass;postTx("subsidies",pr);} // phase premium → Subsidies
  if(G.mode==="career"){ // recurring bonuses: diversion incentive on everything baled, green/EPR subsidy on on-spec revenue
    postTx("subsidies",DIVERSION_PREMIUM*mass);
    if(g.ok&&rev>0)postTx("subsidies",rev*EPR_RATE);
    if((CAREER.counters.exportedOnSpec||0)>=SPONSOR_REP&&CAREER.counters.flags)CAREER.counters.flags.sponsored=true; // auto-earn the sponsor at the rep threshold
  }
}
// Single disposal path — ALWAYS charges on actual weight (mass × landfillGate) and books the
// Landfill cost center. Used by every route to landfill (loose, bale, leftover; later: flush + disposal contract).
function budgetBlocks(cost){return cost>0 && G.cash<cost && !(G.scenario&&G.scenario.unlimitedBudget);}
function dumpToLandfill(mass){G.landfill+=mass;const c=mass*ECON.landfillGate;G.cash-=c;G.ledger.landfill+=c;}
// Manual flush-to-landfill — the player-driven half of the disposal primitive (Bible §7/§143): dump a
// storage area's whole content (loose + accumulated bales + dispose heap) to landfill, charged by weight.
function storageItems(n){let c=cnt(n.inBuf);if(n.bales)for(const t of n.bales)c+=cnt(t);c+=(n.disposeHeap||0);return c;}
function flushToLandfill(n){const c=storageItems(n);if(c>0)dumpToLandfill(c*PMASS);n.inBuf=blankBuf();if(n.bales)n.bales=[];n.disposeHeap=0;}
// Time-tier: faster completion = better tier; every contract is completable untimed (bronze floor).
function tierFor(t,tiers){if(!tiers)return"bronze";if(t<=tiers.gold)return"gold";if(t<=tiers.silver)return"silver";return"bronze";}
// Calendar: t is sim-hours. 12 months x 30 days = 360-day year. Pure; the UI formats it. Season is derived for the parked night/seasonal cycle.
const MONTHS=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
function calendar(t){const tm=Math.floor(t*60+1e-6),mm=((tm%60)+60)%60,hh=Math.floor(tm/60)%24,td=Math.floor(tm/1440);
  const y=Math.floor(td/360)+1,doy=((td%360)+360)%360,mo=Math.floor(doy/30),d=doy%30+1;
  return {y:y,mo:mo,d:d,hh:hh,mm:mm,month:MONTHS[mo],season:["winter","spring","summer","autumn"][Math.floor(((mo+1)%12)/3)]};}
// P&L by cost center (reads the ledger). Reconciles: net === cash.
const SIM_DAY_E=24; // engine copy of the day length (UI has its own SIM_DAY)
function _opexSnap(){const l=G.ledger||{};return {tipping:l.tipping||0,sales:l.sales||0,subsidies:l.subsidies||0,labour:l.labour||0,logistics:l.logistics||0,power:l.power||0,landfill:l.landfill||0};}
function recordOpexDay(){ // §OPEX-HISTORY: at each in-game day rollover, push a per-category OPEX row (capex EXCLUDED)
  if(!G)return;const day=Math.floor(G.t/SIM_DAY_E);
  if(G._opexDay==null){G._opexDay=day;G._opexStart=_opexSnap();G.opexHistory=G.opexHistory||[];return;}
  if(day<=G._opexDay)return;
  const elapsed=day-G._opexDay,now=_opexSnap(),s=G._opexStart||now;
  const e={day:G._opexDay,
    tipping:(now.tipping-s.tipping)/elapsed,sales:(now.sales-s.sales)/elapsed,subsidies:(now.subsidies-s.subsidies)/elapsed,
    labour:(now.labour-s.labour)/elapsed,logistics:(now.logistics-s.logistics)/elapsed,power:(now.power-s.power)/elapsed,landfill:(now.landfill-s.landfill)/elapsed};
  e.income=e.tipping+e.sales+e.subsidies;e.opex=e.labour+e.logistics+e.power+e.landfill;e.net=e.income-e.opex;
  G.opexHistory=G.opexHistory||[];G.opexHistory.push(e);if(G.opexHistory.length>120)G.opexHistory.shift();
  G._opexDay=day;G._opexStart=now;}
function pnlReport(){const L=G.ledger;
  const income=L.tipping+L.sales+L.subsidies;   // RECURRING income only (subsidies = per-tonne bonuses)
  const grants=L.grants||0;                     // ONE-TIME milestone/phase grants (excluded from operating result)
  const recurring=L.labour+L.logistics+L.power+L.landfill; // operating costs (NO capex)
  const capex=L.capex;
  const start=(G.startCash!=null?G.startCash:ECON.startCash);
  return{income:{tipping:L.tipping,sales:L.sales,subsidies:L.subsidies},
    costs:{labour:L.labour,logistics:L.logistics,power:L.power,landfill:L.landfill,capex:L.capex},
    incomeTotal:income,recurringTotal:recurring,capexTotal:capex,grantsTotal:grants,
    operating:income-recurring,                 // what the plant earns before investment (grants excluded)
    costTotal:recurring+capex,net:start+income+grants-recurring-capex,cash:G.cash};}
/* ── Save / restore ─────────────────────────────────────────────────────────
 * localStorage autosave so a refresh never wipes progress. Guarded by try/catch:
 * if storage is unavailable (e.g. a sandboxed preview iframe) the game just runs
 * without persistence instead of throwing. Persists the BUILD (node+edge config
 * and buffers) and the economy (cash/ledger/tonnages); transient edge sprites are
 * dropped and respawn from the buffers on resume. */
const SAVE_KEY="recycle.save.v3"; // bumped: material model changed (bag/item states + aluminium)
function serializeGame(){if(!G)return null;
  return{v:1,mode:G.mode,contractKey:G.contractKey,phaseIdx:G.phaseIdx,unlocked:G.unlocked,tutStep:G.tutStep,continuous:G.continuous,nextId:_id,startCash:G.startCash,seed:G.seed,rngState:G.rngState,sprSeq:G.sprSeq||0,fleet:G.fleet,vehicles:G.vehicles,vehId:G.vehId,trucks:G.trucks||[],truckId:G.truckId||1,
    career:G.career?JSON.parse(JSON.stringify(G.career)):null,
    opexHistory:(G.opexHistory||[]).slice(),_opexDay:G._opexDay,_opexStart:G._opexStart||null,_pnlDay:G._pnlDay,_pnlDayStart:G._pnlDayStart,_pnlYesterday:G._pnlYesterday,
    cash:G.cash,delivered:G.delivered,deliveredTot:G.deliveredTot,landfill:G.landfill,petOn:G.petOn,petOff:G.petOff,ferOn:G.ferOn,sold:G.sold,
    minCash:G.minCash,wageTot:G.wageTot,t:G.t,tier:G.tier,finished:G.finished,ledger:Object.assign({},G.ledger),
    nodes:G.nodes.map(n=>({id:n.id,type:n.type,x:n.x,y:n.y,w:n.w,h:n.h,gx:(n.gx!=null?n.gx:null),gy:(n.gy!=null?n.gy:null),rot:n.rot||0,site:n.site||null,paidCapex:n.paidCapex||0,spec:n.spec,role:n.role,rate:n.rate,ratio:n.ratio,workers:n.workers,target:n.target,inBuf:n.inBuf,bale:n.bale,bales:n.bales,containers:n.containers,active:n.active,disposeHeap:n.disposeHeap,evacT:n.evacT,truckDue:n.truckDue||0,offAllow:n.offAllow||0,balesSold:n.balesSold||0,offSold:n.offSold||0,supplier:(n.supplier!==undefined?n.supplier:null),buyer:n.buyer||null,label:n.label||null,sortSide:n.sortSide||null,splitLayout:n.splitLayout||null,contEvac:n.contEvac||0,massEvac:n.massEvac||0,_inMass:n._inMass||0,_outMass:n._outMass||0,_sortMass:n._sortMass||0,_restMass:n._restMass||0})),
    edges:G.edges.map(e=>({from:e.from,fromPort:e.fromPort,to:e.to,speed:e.speed,kind:e.kind||null,route:e.route||null,max:e.max||null,fromSide:e.fromSide||null,toSide:e.toSide||null,
      sprites:e.sprites.map(sp=>({mat:sp.mat,st:sp.st,t:sp.t,v:sp.v||0,bale:sp.bale?JSON.parse(JSON.stringify(sp.bale)):null}))}))};}
function saveGame(){if(G&&G.mode==="career"&&CAREER)CAREER.bank=G.cash;try{const s=serializeGame();if(s)localStorage.setItem(SAVE_KEY,JSON.stringify(s));}catch(e){}}
// ── Named save slots ─────────────────────────────────────────────────────────
const SLOTS_KEY="recycle.slots.v3",SLOT_PFX="recycle.slot.v3.";
function isSandboxSite(){return !!(G&&G.contractKey==="site_free");} // sandbox: no R&D tree, no objectives, no bottom nav
function slotMode(){ // how a slot is labelled: sandbox vs career (career includes the reference plant & tutorial)
  if(!G)return "career";
  return isSandboxSite()?"sandbox":"career";}
function listSlots(){try{const ix=JSON.parse(localStorage.getItem(SLOTS_KEY)||"{}");
  return Object.keys(ix).map(id=>Object.assign({id},ix[id])).sort((a,b)=>(b.ts||0)-(a.ts||0));}catch(e){return [];}}
function writeSlot(id,meta){try{const ix=JSON.parse(localStorage.getItem(SLOTS_KEY)||"{}");ix[id]=meta;localStorage.setItem(SLOTS_KEY,JSON.stringify(ix));}catch(e){}}
function saveToSlot(name,id){ // id optional (overwrite); returns the slot id
  if(!G)return null;
  const s=serializeGame();if(!s)return null;
  id=id||("s"+Date.now().toString(36)+Math.floor(Math.random()*1e4).toString(36));
  try{localStorage.setItem(SLOT_PFX+id,JSON.stringify(s));}catch(e){return null;}
  writeSlot(id,{name:name||("Save "+new Date().toLocaleString()),mode:slotMode(),scen:G.contractKey||null,
    t:G.t||0,cash:Math.round(G.cash||0),ts:Date.now()});
  return id;}
function loadSlot(id){try{const raw=localStorage.getItem(SLOT_PFX+id);return raw?JSON.parse(raw):null;}catch(e){return null;}}
function deleteSlot(id){try{localStorage.removeItem(SLOT_PFX+id);const ix=JSON.parse(localStorage.getItem(SLOTS_KEY)||"{}");delete ix[id];localStorage.setItem(SLOTS_KEY,JSON.stringify(ix));}catch(e){}}
function exportSaveJSON(){ // download the current game as a .json file (portable, carries mode+scenario)
  if(!G)return;
  const s=serializeGame();if(!s)return;
  const payload={_recycle:"save",v:3,mode:slotMode(),scen:G.contractKey||null,ts:Date.now(),game:s};
  const blob=new Blob([JSON.stringify(payload)],{type:"application/json"});
  const a=document.createElement("a");a.href=URL.createObjectURL(blob);
  const nm=(G.label||slotMode())+"-"+new Date().toISOString().slice(0,10);
  a.download="recycle-"+nm.replace(/[^a-z0-9-]/gi,"_")+".json";
  document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove();},0);}
function importSaveJSON(text){ // parse a previously exported file → the raw serialized game (or null)
  try{const p=JSON.parse(text);
    if(p&&p._recycle==="save"&&p.game)return p.game; // wrapped export
    if(p&&p.nodes)return p;                            // a bare serialized game
    return null;}catch(e){return null;}}
function loadSave(){try{const s=localStorage.getItem(SAVE_KEY);return s?JSON.parse(s):null;}catch(e){return null;}}
function clearSave(){try{localStorage.removeItem(SAVE_KEY);}catch(e){}}
// ── Career layer ── per-career persistence (bank funds R&D; tech + claimed objectives + lifetime counters).
// Scoped to a career save (not global); Sandbox treats the whole tree as already unlocked.
const CAREER_KEY="recycle.career",ECON_V=2; // ECON_V bumps when the money scale changes (dev30 reset = v2); older careers get reseeded
function newCareer(){return{v:1,econV:ECON_V,bank:ECON.startCash,tech:[],claimed:[],counters:{exportedOnSpec:0,onSpec:{},profitBanked:0,bestDiversion:0,bestDailyNet:0,maxUnits:0,contractsWon:0,flags:{ran:{},tutorialComplete:false,sponsored:false}}};}
let CAREER=newCareer();
function loadCareer(){CAREER=newCareer();recomputeTechMod();} // no shared career; each game carries its own G.career
function purgeLegacyCareer(){try{localStorage.removeItem(CAREER_KEY);}catch(e){}} // drop the old shared key if present
function saveCareer(){if(G&&G.career)saveGame();} // progression is per-game now (persisted inside the save); no shared career key
function careerTechOwned(id){return (G&&G.mode==="sandbox")?true:CAREER.tech.indexOf(id)>=0;} // sandbox: all unlocked
function settleCareer(win){ if(!G||G.mode==="sandbox")return; // settle a finished contract into the bank
  const start=(G.startCash!=null?G.startCash:((G.scenario&&G.scenario.startCash)||ECON.startCash)), profit=G.cash-start;
  CAREER.bank=G.cash; if(profit>0)CAREER.counters.profitBanked+=profit; if(win)CAREER.counters.contractsWon++;
  for(const k in G.sold){const so=G.sold[k]; if(so&&so.on>0)CAREER.counters.onSpec[k]=(CAREER.counters.onSpec[k]||0)+so.on;} // per-material lifetime on-spec mass
  const div=G.delivered>0?Math.max(0,1-G.landfill/G.delivered):0; if(div>CAREER.counters.bestDiversion)CAREER.counters.bestDiversion=div;
  const mc=G.nodes.reduce((s,x)=>s+(x.type!=="storage"?1:0),0); if(mc>CAREER.counters.maxUnits)CAREER.counters.maxUnits=mc;
  if(win&&G.contractKey==="pmc"){const f=CAREER.counters.flags;if(f)f.tutorialComplete=true;}
  saveCareer();}
// ── Tech effects (data-driven) ── each node lists declarative effects; the engine never branches on a tech id.
// effect kinds: unlock(unit) · cap(unit|all,mult) · kw(unit|all,mult) · prob(unit,mat,mult|add) · openEff(add) · pickEff(add) · elec(mult) · slots(add)
const TECH={
  // ── UNLOCK LICENCES (small fee to add a machine to your kit; capex is paid again per build). Branched:
  //    metals route = eddy; plastics route = air → nir/vfilm. Cheap entry to low-grade products, dearer to premium. ──
  r_airU :{cost:8000,  req:[],          fx:[{t:"unlock",unit:"air"}]},     // density: film + carton
  a_split:{cost:5000,  req:[],          fx:[{t:"unlock",unit:"splitter"}]},
  a_pickU:{cost:10000, req:[],          fx:[{t:"unlock",unit:"pick"}]},
  r_eddyU:{cost:20000, req:[],          fx:[{t:"unlock",unit:"eddy"}]},    // non-ferrous: the alu jackpot
  r_vfilm:{cost:25000, req:["r_airU"],  fx:[{t:"unlock",unit:"vfilm"}]},   // dedicated film extraction
  r_nirU :{cost:45000, req:["r_airU"],  fx:[{t:"unlock",unit:"nir"}]},     // optical: the PET premium (dearest entry)
  // ── UPGRADES (repriced down; they were too dear vs their swing) ──
  r_mag  :{cost:60000, req:["r_eddyU"], fx:[{t:"prob",unit:"magnet",mat:"steel",add:0.03}]},
  t_belt :{cost:80000, req:["r_eddyU"], fx:[{t:"cap",unit:"all",mult:1.15}]},
  t_vfd  :{cost:30000, req:["r_eddyU"], fx:[{t:"kw",unit:"all",mult:0.90}]},  // minor: power is a small cost in this economy
  h_sorters:{cost:30000, req:["a_pickU"], fx:[{t:"pickEff",add:0.05}]},
  s_subsidy:{cost:80000, req:[],         fx:[{t:"price",mult:1.08}]},          // green subsidy: +8% on sales (trimmed to keep the stack under ×2)
  sl_binf  :{cost:40000, req:[],         fx:[{t:"supplier",id:"binfinity"}]},
  sl_iron  :{cost:40000, req:[],         fx:[{t:"buyer",id:"iron_maiden"}]},
  // ── REAL ESTATE (the scaling wall: base is 20 slots; the reference plant is 27 units → yard1 is effectively mandatory) ──
  a_yard1:{cost:120000, req:[],          fx:[{t:"slots",add:15},{t:"storeCap",mult:1.5}]},
  a_yard2:{cost:350000, req:["a_yard1"], fx:[{t:"slots",add:20},{t:"storeCap",mult:1.5}]},
  a_yard3:{cost:800000, req:["a_yard2"], fx:[{t:"slots",add:25},{t:"storeCap",mult:1.5}]}
};
function ownedTech(){return (G&&G.mode==="sandbox")?Object.keys(TECH):CAREER.tech;} // sandbox owns the whole tree
function _blankMod(){return{cap:{},kw:{},prob:{},open:0,pick:0,elec:1,slots:0,price:1,storeCap:1,unlock:new Set(),suppliers:new Set(),buyers:new Set()};}
let TECHMOD=_blankMod();
function recomputeTechMod(){const m=_blankMod(); // memoize: fold owned tech once, accessors read O(1) (prob is in the hot loop)
  m.suppliers.add("wasteminster");for(const _b of COMPANIES.buyers)if(_b.def)m.buyers.add(_b.id); // defaults: tutorial supplier + one buyer per spec
  for(const id of ownedTech()){const T=TECH[id];if(!T)continue;
    for(const e of T.fx||[]){
      if(e.t==="cap")m.cap[e.unit]=(m.cap[e.unit]||1)*(e.mult||1);
      else if(e.t==="kw")m.kw[e.unit]=(m.kw[e.unit]||1)*(e.mult||1);
      else if(e.t==="prob"){const pu=m.prob[e.unit]||(m.prob[e.unit]={});const c=pu[e.mat]||(pu[e.mat]={mult:1,add:0});if(e.mult!=null)c.mult*=e.mult;if(e.add!=null)c.add+=e.add;}
      else if(e.t==="openEff")m.open+=(e.add||0);
      else if(e.t==="pickEff")m.pick+=(e.add||0);
      else if(e.t==="elec")m.elec*=(e.mult||1);
      else if(e.t==="slots")m.slots+=(e.add||0);
      else if(e.t==="storeCap")m.storeCap*=(e.mult||1);
      else if(e.t==="unlock")m.unlock.add(e.unit);
      else if(e.t==="price")m.price*=(e.mult||1);
      else if(e.t==="supplier")m.suppliers.add(e.id);
      else if(e.t==="buyer")m.buyers.add(e.id);
    }}
  TECHMOD=m;}
function techCap(u,b){return b*(TECHMOD.cap[u]||1)*(TECHMOD.cap.all||1);}
function techKW(u,b){return b*(TECHMOD.kw[u]||1)*(TECHMOD.kw.all||1);}
function techProb(u,mat,b){const pu=TECHMOD.prob[u];if(!pu)return b;const c=pu[mat]||pu.all;if(!c)return b;return Math.max(0,Math.min(1,b*(c.mult||1)+(c.add||0)));}
function techOpenEff(b){return Math.min(1,b+TECHMOD.open);}
function techPickEff(b){return Math.min(1,b+TECHMOD.pick);}
function techElecMult(){return TECHMOD.elec;}
function techSlots(b){return b+TECHMOD.slots;}
function unitUnlocked(u){return (G&&G.mode==="sandbox")||TECHMOD.unlock.has(u);} // base-unit gating wired in Step 3
function supplierUnlocked(id){return (G&&G.mode==="sandbox")||TECHMOD.suppliers.has(id);}
function buyerUnlocked(id){return (G&&G.mode==="sandbox")||TECHMOD.buyers.has(id);}
function techPrice(){return TECHMOD.price;}
// ── Research / refund from the career bank (validated) ──
function techReq(id){return (TECH[id]&&TECH[id].req)||[];}
function techReqMet(id){return techReq(id).every(r=>careerTechOwned(r));}
function techResearchable(id){const T=TECH[id];return !!T&&!!G&&G.mode!=="sandbox"&&!careerTechOwned(id)&&techReqMet(id)&&(!budgetBlocks(T.cost));}
function researchTech(id){if(!techResearchable(id))return false;postTx("capex",-TECH[id].cost);CAREER.bank=G.cash;CAREER.tech.push(id);recomputeTechMod();saveCareer();saveGame();return true;}
function techRefundable(id){if(!TECH[id]||!careerTechOwned(id)||!G||G.mode==="sandbox")return false;for(const k in TECH)if(TECH[k].req.indexOf(id)>=0&&careerTechOwned(k))return false;return true;}
function refundTech(id){if(!techRefundable(id))return false;postTx("capex",TECH[id].cost);CAREER.bank=G.cash;const i=CAREER.tech.indexOf(id);if(i>=0)CAREER.tech.splice(i,1);recomputeTechMod();saveCareer();saveGame();return true;}
// ── Objectives (data-driven) ── manual-claim goals; reward funds the bank. Counters are lifetime + monotonic so claimable state is stable.
// ── Recurring bonuses (linear in tonnage, never multiplicative) + reputation sponsorship. Real-anchored:
//    diversion incentive (landfill-tax avoided), EPR/green subsidy (producer-responsibility funds recyclers),
//    corporate sponsor co-invests in equipment once you have a track record. ──
const DIVERSION_PREMIUM=20;   // €/t baled & sold = kept out of landfill
const EPR_RATE=0.05;          // +5% of on-spec revenue, green/EPR subsidy
const SPONSOR_REP=250;        // cumulative on-spec tonnes to earn a corporate sponsor
const SPONSOR_DISCOUNT=0.80;  // sponsor covers 20% of new-equipment capex
// One-shot milestone grants that fund expansion + R&D fast (Growth = scale, Impact = green track record).
const OBJ={
  a_first:{cat:"grow",  name:"Sell your first on-spec bale",         cond:{metric:"exportedOnSpec",gte:0.1}, reward:200000},
  a_net5 :{cat:"grow",  name:"Reach €5k/day operating profit",        cond:{metric:"dailyNet",gte:5000},      reward:250000},
  a_size :{cat:"grow",  name:"Build a 15-unit plant",                cond:{metric:"unitsOnLine",gte:15},     reward:200000},
  a_net10:{cat:"grow",  name:"Reach €10k/day operating profit",       cond:{metric:"dailyNet",gte:10000},     reward:300000, req:["a_net5"]},
  a_net20:{cat:"grow",  name:"Reach €20k/day operating profit",       cond:{metric:"dailyNet",gte:20000},     reward:400000, req:["a_net10"]},
  a_100t :{cat:"impact",name:"Recover 100 t on-spec",               cond:{metric:"exportedOnSpec",gte:100},  reward:150000, req:["a_first"]},
  a_div  :{cat:"impact",name:"Hit 80% landfill diversion",          cond:{metric:"diversion",gte:0.8},      reward:150000},
  a_rep  :{cat:"impact",name:"Earn a corporate sponsor (250 t on-spec)",cond:{metric:"exportedOnSpec",gte:250},reward:100000, sponsor:true}, // signing bonus + a permanent −20% equipment-capex discount (flags.sponsored)
};
function objMetric(m){const c=CAREER.counters;
  return m==="exportedOnSpec"?c.exportedOnSpec : m==="profitBanked"?c.profitBanked : m==="unitsOnLine"?c.maxUnits : m==="diversion"?c.bestDiversion : m==="dailyNet"?(c.bestDailyNet||0) : m==="contractsWon"?c.contractsWon : 0;}
function objMet(o){const cd=o.cond,f=CAREER.counters.flags||{};
  if(cd.metric)return objMetric(cd.metric)>=cd.gte;
  if(cd.event==="tutorialComplete")return !!f.tutorialComplete;
  if(cd.event==="unitRan")return !!(f.ran&&f.ran[cd.unit]);
  if(cd.event==="contractWon")return CAREER.counters.contractsWon>0;
  if(cd.owns)return careerTechOwned(cd.owns);
  return false;}
function objClaimed(id){return CAREER.claimed.indexOf(id)>=0;}
function objReqMet(id){return ((OBJ[id]&&OBJ[id].req)||[]).every(objClaimed);}
function objClaimable(id){return !!OBJ[id]&&!objClaimed(id)&&objReqMet(id)&&objMet(OBJ[id]);}
function objLocked(id){return !!OBJ[id]&&!objClaimed(id)&&!objReqMet(id);}
function claimableObjectives(){return Object.keys(OBJ).filter(objClaimable);}
function hasClaimable(){return claimableObjectives().length>0;}
function objProgress(id){const o=OBJ[id];if(!o)return 0;if(o.cond.metric)return Math.max(0,Math.min(1,objMetric(o.cond.metric)/o.cond.gte));return objMet(o)?1:0;}
function claimObjective(id){if(!objClaimable(id))return false;postTx("grants",OBJ[id].reward);CAREER.bank=G.cash;CAREER.claimed.push(id); // one-time grant → `grants` (not the recurring `subsidies`)
  if(OBJ[id].sponsor&&CAREER.counters.flags)CAREER.counters.flags.sponsored=true;
  saveCareer();saveGame();return true;}

let _phaseSnap=null; // checkpoint at each phase start, so Retry restarts THIS phase (not phase 1)
function snapshotPhase(){try{const s=JSON.stringify(serializeGame()); // B1: deep clone — serializeGame copies inBuf/bale BY REFERENCE, so the
  _phaseSnap=JSON.parse(s);localStorage.setItem("recycle.phasesnap",s);}catch(e){}} // in-memory snapshot must be detached or it corrupts as the game runs
const SAVE_V=1; // serialized-game schema version (serializeGame writes v:1). A future bump must REJECT on old clients, not half-load.
function validateSave(s){ // B2: reject a bad/future save BEFORE touching any global state — a rejected load leaves the running game intact
  if(!s||typeof s!=="object")throw new Error("save: not an object");
  if(s.v!=null&&s.v!==SAVE_V)throw new Error("save: schema v"+s.v+" \u2260 v"+SAVE_V+" (incompatible version)");
  if(!Array.isArray(s.nodes))throw new Error("save: nodes missing or not an array");
  if(s.edges!=null&&!Array.isArray(s.edges))throw new Error("save: edges is not an array");
  for(const ns of s.nodes){
    if(!ns||typeof ns.type!=="string"||!TYPES[ns.type]) // unknown type ⇒ this save came from a build we don't understand: reject, don't drop
      throw new Error("save: unknown node type "+JSON.stringify(ns&&ns.type)+" \u2014 refusing to load a partial plant");
  }
  return true;
}
function restoreGame(s){validateSave(s);_id=s.nextId||1;P=[];selNode=null;
  const scn=SCENARIOS[s.contractKey]||null;const base=scn?scn.phases[s.phaseIdx||0]:(CONTRACTS[s.contractKey]||CONTRACTS.standard);
  const _lg=Object.assign({},LOGI,(scn&&scn.logi)||{});
  G={mode:s.mode,contractKey:s.contractKey,scenario:scn,phaseIdx:s.phaseIdx||0,unlocked:s.unlocked||(scn?[]:null),tut:(scn&&TUT[s.contractKey])?TUT[s.contractKey][s.phaseIdx||0]:null,tutStep:s.tutStep||0,nodes:[],edges:[],
    cash:s.cash,startCash:(s.startCash!=null?s.startCash:((scn&&scn.startCash)||ECON.startCash)),seed:(s.seed!=null?s.seed:0x9E3779B9),rngState:(s.rngState!=null?s.rngState:(s.seed!=null?s.seed:0x9E3779B9)),delivered:s.delivered,deliveredTot:(s.deliveredTot!=null?s.deliveredTot:s.delivered),landfill:s.landfill,petOn:s.petOn,petOff:s.petOff,ferOn:s.ferOn,sold:s.sold||{},
    minCash:s.minCash,running:false,speed:1,finished:!!s.finished,tier:s.tier||null,continuous:(s.mode==="sandbox"||(s.mode==="career"&&!!scn))||!!s.continuous,
    carryEmit:0,carry:{},energy:0,t:s.t||0,wageTot:s.wageTot||0,
    ledger:Object.assign({tipping:0,sales:0,subsidies:0,grants:0,labour:0,logistics:0,power:0,landfill:0,capex:0},s.ledger||{}),
    connecting:null,pointer:null,
    logi:_lg,sprSeq:s.sprSeq||0,fleet:Object.assign({},_lg.fleet0,s.fleet||{}),vehicles:(s.vehicles||[]).map(v=>Object.assign({},v,{payload:v.payload||blankBuf(),baleLoad:v.baleLoad||[]})),jobs:[],vehId:s.vehId||1,trucks:s.trucks||[],truckId:s.truckId||1,
    contract:{name:base.name,tonnage:base.tonnage,comp:base.comp,product:base.product||"PET",tiers:base.tiers||{gold:2.4,silver:3.0},premium:base.premium||null,units:base.units||null,feedTph:base.feedTph||4,supplier:(scn&&scn.supplier)||base.supplier||null}};
  if(s.mode==="sandbox")G.contract.tonnage=Infinity;
  if(G.continuous)G.contract.tonnage=Infinity;
  // Current-schema restore only (D4: legacy pre-S-BATCH migration deleted 2026-07-11 — the
  // flowsheet game is archived; site saves carry grid placement + edge routes natively).
  for(const ns of s.nodes){const type=ns.type,role=ns.role,spec=ns.spec;
    if(!TYPES[type])throw new Error("restoreGame: unknown type "+type); // B2: validateSave gates this; defensive so no path can silently drop a node
    G.nodes.push({id:ns.id,type,x:ns.x,y:ns.y,w:ns.w||78,h:ns.h||66,gx:(ns.gx!=null?ns.gx:null),gy:(ns.gy!=null?ns.gy:null),rot:ns.rot||0,site:ns.site||null,paidCapex:(ns.paidCapex!=null?ns.paidCapex:(ns.capex!=null?ns.capex:0)),
      inBuf:migrateBuf(ns.inBuf),ratio:ns.ratio==null?0.5:ns.ratio,spec:spec||"PET",
      bale:migrateBuf(ns.bale),bales:(ns.bales||[]).map(migrateBuf),containers:(role==="bulk")?((ns.containers&&ns.containers.length)?ns.containers.map(migrateBuf):[blankBuf(),blankBuf(),blankBuf()]):null,active:ns.active||0,disposeHeap:ns.disposeHeap||0,evacT:ns.evacT||0,truckDue:ns.truckDue||0,offAllow:ns.offAllow||0,truckFlash:0,balesSold:ns.balesSold||0,offSold:ns.offSold||0,role:role||(type==="storage"?"buffer":null),rate:ns.rate||4,
      jam:0,load:0,state:"ok",wrongSize:0,workers:ns.workers||2,target:ns.target||"film",supplier:ns.supplier||null,buyer:ns.buyer||null,label:ns.label||null,sortSide:ns.sortSide||null,splitLayout:ns.splitLayout||null,contEvac:ns.contEvac||0,massEvac:ns.massEvac||0,_inMass:ns._inMass||0,_outMass:ns._outMass||0,_sortMass:ns._sortMass||0,_restMass:ns._restMass||0});}
  const live=new Set(G.nodes.map(n=>n.id));
  for(const es of s.edges)if(live.has(es.from)&&live.has(es.to)){const _wl=(es.kind==="conveyor"&&es.route)?pathLen(es.route):0;
  G.edges.push({from:es.from,fromPort:es.fromPort,to:es.to,speed:(_wl>0)?SITE_BELT_SPEED/_wl:(es.speed||EDGE_SPEED),kind:es.kind||null,route:es.route||null,max:(_wl>0)?beltMaxFor(_wl):(es.max||null),fromSide:es.fromSide||null,toSide:es.toSide||null,
    sprites:(es.sprites||[]).map(sp=>({mat:sp.mat,st:sp.st,t:sp.t||0,v:sp.v||0,bale:sp.bale?migrateBuf(sp.bale):null}))});} // in-transit material survives the round-trip (NNG-1)
  // per-game progression: rebuild from the save (or seed fresh for legacy saves), then point CAREER at it
  G.opexHistory=s.opexHistory?s.opexHistory.slice():[];
  if(s._opexDay!=null){G._opexDay=s._opexDay;G._opexStart=s._opexStart||null;}
  if(s._pnlDay!=null){G._pnlDay=s._pnlDay;G._pnlDayStart=s._pnlDayStart;G._pnlYesterday=s._pnlYesterday;}
  G.career=s.career?Object.assign(newCareer(),s.career):newCareer();
  {const c=G.career.counters;if(!c.flags)c.flags={ran:{},tutorialComplete:false};if(!c.flags.ran)c.flags.ran={};if(!c.onSpec)c.onSpec={};}
  if(G.career.bank==null)G.career.bank=G.cash;
  CAREER=G.career;recomputeTechMod();
  UI.viewReset();}
/* ── Palette discovery ──────────────────────────────────────────────────────
 * Career restricts the palette to the contract's necessary units (progressive
 * discovery); sandbox shows the full toolbox. */
const ALL_UNITS=["intake","output","buffer","pick","opener","magnet","eddy","air","nir","vfilm","splitter","baler"];
const BASE_UNITS=["intake","output","buffer","opener","magnet","baler"]; // always available; eddy/air/nir/splitter/pick are tech-gated
const BASE_SLOTS=20; // machines placeable before yard tech (dev30: small-plant base)
function paletteUnits(){if(!G||G.mode==="sandbox")return ALL_UNITS.slice();
  return ALL_UNITS.filter(u=>BASE_UNITS.indexOf(u)>=0||unitUnlocked(u));} // base units + whatever tech has unlocked
// Engine endGame: sets result + tier + persists, then hands off rendering to the UI hook.
// DOM-free by construction (the overlay lives in UI.onEnd).
function endGame(win,reason){if(G.finished)return;G.finished=true;G.running=false;
  if(win)G.tier=tierFor(G.t,G.contract.tiers);settleCareer(win);saveGame();UI.onEnd(win,reason);}
/* ── S-BATCH vehicle layer ───────────────────────────────────────────────────
 * Discrete batch carriers at the zone↔line seam. PURE: positions interpolate
 * from engine node coords (UI only draws, NNG-4). Deterministic: every transition
 * fires off G.t/eta — no wall clock (NNG-5). S-BATCH-0 = INERT skeleton: buildJobs
 * finds no zone roles yet (no node split), so no job is built and no vehicle is
 * spawned → tick behaviour is unchanged. The state machine + length-proportional
 * travel math live here so -1..-3 only wire sources + the gated mass transfers.
 * ──────────────────────────────────────────────────────────────────────────*/
/* Route-polyline vehicle physics (D3, WYSIWYG): one geometry for physics and pixels.
 * A leg's path is (1) the authored edge route between the two nodes (either direction),
 * else (2) a deterministic BFS over the dirt network, else (3) a straight segment
 * (legacy flowsheet scenes / tests keep working). Trip time ∝ real path length. */
function pathLen(P){let L=0;for(let i=1;i<P.length;i++)L+=Math.hypot(P[i][0]-P[i-1][0],P[i][1]-P[i-1][1]);return L;}
function pathAngleAt(P,d){for(let i=1;i<P.length;i++){const s=Math.hypot(P[i][0]-P[i-1][0],P[i][1]-P[i-1][1]);
  if(d<=s){const t=s?d/s:0;return{x:P[i-1][0]+(P[i][0]-P[i-1][0])*t,y:P[i-1][1]+(P[i][1]-P[i-1][1])*t,a:Math.atan2(P[i][1]-P[i-1][1],P[i][0]-P[i-1][0])};}d-=s;}
  const n=P.length-1;return{x:P[n][0],y:P[n][1],a:Math.atan2(P[n][1]-P[n-1][1],P[n][0]-P[n-1][0])};}
function pathAt(P,f){if(!P||!P.length)return{x:0,y:0};if(P.length===1||f<=0)return{x:P[0][0],y:P[0][1]};
  const T=pathLen(P);if(f>=1||T<=0){const e=P[P.length-1];return{x:e[0],y:e[1]};}
  let d=f*T;for(let i=1;i<P.length;i++){const seg=Math.hypot(P[i][0]-P[i-1][0],P[i][1]-P[i-1][1]);
    if(d<=seg){const u=seg>0?d/seg:0;return{x:P[i-1][0]+(P[i][0]-P[i-1][0])*u,y:P[i-1][1]+(P[i][1]-P[i-1][1])*u};}d-=seg;}
  const e=P[P.length-1];return{x:e[0],y:e[1]};}
function edgeRouteBetween(aId,bId){for(const e of G.edges){if(!e.route)continue;
  if(e.from===aId&&e.to===bId)return e.route.slice();
  if(e.from===bId&&e.to===aId)return e.route.slice().reverse();}return null;}
function siteNodeDirtCell(n){if(n.gx==null)return null;const s=siteSets();
  const cx=Math.floor(n.x/CELL),cy=Math.floor(n.y/CELL);
  if(s.dirt.has(cx+","+cy))return[cx,cy];
  for(let r=1;r<=6;r++)for(let dx=-r;dx<=r;dx++)for(let dy=-r;dy<=r;dy++){
    if(Math.max(Math.abs(dx),Math.abs(dy))!==r)continue;
    if(s.dirt.has((cx+dx)+","+(cy+dy)))return[cx+dx,cy+dy];}
  return null;}
function siteBfsDirt(a,b){const s=siteSets(),gk=b[0]+","+b[1],q=[a],came={};came[a[0]+","+a[1]]=null;let hit=false;
  while(q.length){const c=q.shift();if(c[0]+","+c[1]===gk){hit=true;break;}
    for(const[dx,dy]of[[1,0],[-1,0],[0,1],[0,-1]]){const nx=c[0]+dx,ny=c[1]+dy;
      if(!s.dirt.has(nx+","+ny))continue;const k=nx+","+ny;if(k in came)continue;came[k]=c;q.push([nx,ny]);}}
  if(!hit)return null;const path=[];let cur=b;while(cur){path.push(cur);cur=came[cur[0]+","+cur[1]];}return path.reverse();}
function _simplifyPts(pts){if(pts.length<3)return pts.slice();const out=[pts[0]];
  for(let i=1;i<pts.length-1;i++){const a=out[out.length-1],b=pts[i],c=pts[i+1];
    const v1=[b[0]-a[0],b[1]-a[1]],v2=[c[0]-b[0],c[1]-b[1]];
    const cr=v1[0]*v2[1]-v1[1]*v2[0],dot=v1[0]*v2[0]+v1[1]*v2[1];
    if(Math.abs(cr)<1e-6&&dot>0)continue;      // collinear, same direction → redundant
    if(Math.hypot(v1[0],v1[1])<1e-6)continue;  // zero-length step
    out.push(b);}                              // corners AND cusps (doubling back, dot<0) are geometry — keep
  out.push(pts[pts.length-1]);return out;}
function nodeDock(n){ // where vehicles actually load/unload: the node's vehicle-edge anchor (falls back to centre)
  for(const e of G.edges){if(!e.route||e.kind!=="vehicle")continue;
    if(e.from===n.id)return e.route[0].slice();
    if(e.to===n.id)return e.route[e.route.length-1].slice();}
  return[n.x,n.y];}
// The connection side of a node's vehicle edge ('t'/'b'/'l'/'r'), from the stored edge side.
function nodeDockSide(n){
  for(const e of G.edges){if(e.kind!=="vehicle")continue;
    if(e.from===n.id)return e.fromSide||"b";
    if(e.to===n.id)return e.toSide||"t";}
  return "t";}
// Heading (radians) for a vehicle docked at this node, nose pointing INTO the node through its side.
// side 't' → the dock is above the node, vehicle faces DOWN (+y, π/2). 'b' → faces UP (-π/2). etc.
function dockAngle(side){return side==="t"?Math.PI/2:side==="b"?-Math.PI/2:side==="l"?0:Math.PI;}
// The point where a vehicle of half-length `hl` STOPS so its NOSE reaches the dock and its body
// sits OUTSIDE the node (never overlapping the footprint).
function dockStand(dock,side,hl){
  return side==="t"?[dock[0],dock[1]-hl]:side==="b"?[dock[0],dock[1]+hl]
        :side==="l"?[dock[0]-hl,dock[1]]:[dock[0]+hl,dock[1]];}
/* ── S-MOTION ────────────────────────────────────────────────────────────────
 * One motion model for ALL actors (loaders, forklifts, container trucks, and
 * boundary trucks). A leg is {path, revA, revB}: revA = arc length of the
 * reverse-out portion at the START of the path, revB = arc length of the
 * reverse-in portion at the END. Sprite heading = corner-smoothed path
 * tangent + pi*flip(s), flip ramping 0<->1 across the same window used for
 * corner smoothing: at a true 180-degree cusp the two ramps cancel exactly,
 * so the sprite's ABSOLUTE heading is continuous through every reversal.
 * Docking: "nose" classes (loader, forklift) drive in nose-first and reverse
 * out; "rear" classes (every truck) pull PAST the bay on their lane, cusp,
 * and reverse in — cab away from the unit, rear edge exactly on the
 * connection point (berth centre = dock + outward*half_length).
 * Berths give sub-cell spacing: lateral slots along the dock side, claimed
 * deterministically when a leg is planned, held until the next leg. ──────*/
function ctruckLayby(v){const i=(v.id%3);return[17.5*CELL,(20+i*1.6)*CELL];} // dirt-apron lay-by, per truck
const VEH_GEO={ // half-length in world px, from REAL vehicle lengths (1 cell = 4 m = 30 px)
  loader:{hl:24,mode:"nose"},    // wheel loader ~8 m
  forklift:{hl:12,mode:"nose"},  // counterbalance forklift ~3 m
  ctruck:{hl:27,mode:"rear"},    // roll-off ampliroll ~9 m (sized down ~20% for the yard)
  supplier:{hl:29,mode:"rear"},   // refuse truck, sized down ~20%  // refuse truck ~9.5 m
  client:{hl:32,mode:"rear"},    // flatbed bale truck ~8.5 m (was 40 — oversized)
  lftruck:{hl:32,mode:"rear"}};  // roll-off ~9 m — sized to match the client bale truck (was 27, read as visibly smaller than the other yard trucks)
const BERTH_LANE=26, DOCK_CLEAR=CELL*1.05, PULL_PAST=CELL*0.9, TURN_WIN=16;
function dockOut(side){return side==="t"?[0,-1]:side==="b"?[0,1]:side==="l"?[-1,0]:[1,0];}
function truckDockInfo(n){ // boundary trucks serve the apron face
  if(isBunker(n))return{p:[n.x,n.y-n.h/2],side:"t"};
  return{p:[n.x,n.y+n.h/2],side:"b"};} // export & landfill: served from below
function vehDockInfo(n){return{p:nodeDock(n),side:nodeDockSide(n)};}
function berthPointFor(n,cls,slot,truck){
  const info=truck?truckDockInfo(n):vehDockInfo(n);
  const o=dockOut(info.side),hl=VEH_GEO[cls].hl;
  const lat=[0,1,-1,2,-2,3,-3][(slot||0)%7]*BERTH_LANE;
  const tx=(info.side==="t"||info.side==="b")?[1,0]:[0,1];
  return{x:info.p[0]+o[0]*hl+tx[0]*lat,y:info.p[1]+o[1]*hl+tx[1]*lat,side:info.side,out:o};}
function claimBerth(nId,self){ // deterministic: smallest slot not held by another actor at/heading to nId
  const used=new Set();
  for(const v of (G.vehicles||[]))if(v!==self&&v.berthAt===nId&&v.berth!=null)used.add(v.berth);
  for(const t of (G.trucks||[]))if(t!==self&&t.berthAt===nId&&t.berth!=null)used.add(t.berth);
  let k=0;while(used.has(k))k++;return k;}
function _cleanPath(P){ // collapse micro-steps then simplify — true cusps (>7px) survive
  if(!P||P.length<2)return P;
  const out=[P[0].slice()];
  for(let i=1;i<P.length;i++){const a=out[out.length-1],b=P[i];
    if(Math.hypot(b[0]-a[0],b[1]-a[1])<7){if(i===P.length-1)out[out.length-1]=b.slice();continue;}
    out.push(b.slice());}
  return _simplifyPts(out);}
function _trimNear(mid,pt,r){ // drop trailing BFS cell-centres that sit within r of the junction target
  while(mid.length&&Math.hypot(mid[mid.length-1][0]-pt[0],mid[mid.length-1][1]-pt[1])<r)mid.pop();
  return mid;}
function orthoZ(p0,p1){
  const dx=Math.abs(p0[0]-p1[0]),dy=Math.abs(p0[1]-p1[1]);
  if(dx<1e-6||dy<1e-6)return[p0.slice(),p1.slice()];
  if(Math.min(dx,dy)<CELL)return[p0.slice(),p1.slice()]; // small lateral offset: a gentle direct taper beats an 11-px double-90 bayonet
  const my=(p0[1]+p1[1])/2;return[p0.slice(),[p0[0],my],[p1[0],my],p1.slice()];}
function motionLeg(A,B,cls,slotA,slotB,truck){ // node A (or null=start in place) → node B
  if(!B)return null;
  if((A&&A.gx==null)||B.gx==null){ // legacy flowsheet scene: straight centre-to-centre, no reversing
    const a=A?[A.x,A.y]:[B.x,B.y];return{path:[a,[B.x,B.y]],revA:0,revB:0};}
  const g=VEH_GEO[cls];
  const bB=berthPointFor(B,cls,slotB,truck),oB=bB.out;
  const laneB=[bB.x+oB[0]*DOCK_CLEAR,bB.y+oB[1]*DOCK_CLEAR];
  let head=[],revA=0;
  if(A&&A.gx!=null){const bA=berthPointFor(A,cls,slotA,truck),oA=bA.out;
    const laneA=[bA.x+oA[0]*DOCK_CLEAR,bA.y+oA[1]*DOCK_CLEAR];
    head=[[bA.x,bA.y],laneA];
    if(g.mode==="nose")revA=DOCK_CLEAR;} // nose-docked: back out to the lane, cusp, drive on
  const start=head.length?head[head.length-1]:(A?[A.x,A.y]:null);
  let core;
  if(!start)core=[laneB.slice()];
  else if(cls==="loader")core=orthoZ(start,laneB); // loaders shoot straight across the apron band (bunker↔feeder seam)
  else{const c0=[Math.floor(start[0]/CELL),Math.floor(start[1]/CELL)],c1=[Math.floor(laneB[0]/CELL),Math.floor(laneB[1]/CELL)];
    const cells=siteBfsDirt(c0,c1);
    if(cells){let mid=cells.map(c=>[(c[0]+0.5)*CELL,(c[1]+0.5)*CELL]);
      mid=_trimNear(mid,laneB,CELL*0.8);mid.reverse();mid=_trimNear(mid,start,CELL*0.8);mid.reverse();
      const j0=orthoZ(start,mid[0]||laneB),j1=orthoZ(mid.length?mid[mid.length-1]:start,laneB);
      core=[start.slice(),...j0.slice(1,-1),...mid,...j1.slice(1)];}
    else core=orthoZ(start,laneB);}
  let tail=[],revB=0;
  if(g.mode==="rear"){ // pull PAST on the lane, cusp, reverse in (bed to the dock)
    const last=core[core.length-1],prev=core.length>1?core[core.length-2]:(head.length?head[head.length-1]:[last[0]-1,last[1]]);
    let dx=last[0]-prev[0],dy=last[1]-prev[1];const dl=Math.hypot(dx,dy)||1;dx/=dl;dy/=dl;
    const pp=[last[0]+dx*PULL_PAST,last[1]+dy*PULL_PAST];
    tail=[pp,laneB.slice(),[bB.x,bB.y]];
    revB=Math.hypot(laneB[0]-pp[0],laneB[1]-pp[1])+Math.hypot(bB.x-laneB[0],bB.y-laneB[1]);} // reverse begins AT the cusp
  else tail=[[bB.x,bB.y]]; // nose: drive straight in
  const raw=head.concat(head.length?core.slice(1):core).concat(tail);
  return{path:_cleanPath(raw),revA,revB};}
// Sprite pose along a leg. Heading is corner-smoothed and reversal-blended in one pass.
function _lerpA(a,b,t){let d=b-a;while(d>Math.PI)d-=2*Math.PI;while(d<-Math.PI)d+=2*Math.PI;
  if(Math.abs(Math.abs(d)-Math.PI)<1e-4)d=Math.PI; // 180° cusps resolve consistently (+pi)
  return a+d*t;}
function legPose(leg,f){const P=leg.path,L=pathLen(P);
  if(!P||P.length===0)return{x:0,y:0,a:-Math.PI/2};
  if(P.length===1||L<1e-6)return{x:P[0][0],y:P[0][1],a:-Math.PI/2};
  const s=Math.max(0,Math.min(L,f*L));
  const pt=pathAt(P,s/L);
  // Build sprite-heading PIECES: segments split at reverse-mode boundaries; each piece's
  // heading = segment tangent + pi if reversing. Blending between adjacent pieces with a
  // shortest-arc lerp makes 180-degree cusps cancel automatically (heading stays constant
  // while backing straight) and sweeps 90-degree corners smoothly.
  const bA=leg.revA||0,bB=L-(leg.revB||0);
  const cuts=[];
  if(bA>0&&bA<L)cuts.push(bA);
  if((leg.revB||0)>0&&bB>0&&bB<L)cuts.push(bB);
  const pieces=[];let acc=0;
  for(let i=1;i<P.length;i++){
    const l=Math.hypot(P[i][0]-P[i-1][0],P[i][1]-P[i-1][1]);if(l<1e-9)continue;
    const a0=Math.atan2(P[i][1]-P[i-1][1],P[i][0]-P[i-1][0]);
    let s0=acc,s1=acc+l;acc=s1;
    let bounds=[s0];for(const c of cuts)if(c>s0+1e-9&&c<s1-1e-9)bounds.push(c);bounds.push(s1);
    bounds.sort((x,y)=>x-y);
    for(let k=0;k<bounds.length-1;k++){const m=(bounds[k]+bounds[k+1])/2;
      const rev=(m<bA)||(m>bB&&(leg.revB||0)>0);
      pieces.push({s0:bounds[k],s1:bounds[k+1],a:a0+(rev?Math.PI:0)});}}
  let idx=0;while(idx<pieces.length-1&&s>pieces[idx].s1)idx++;
  const pc=pieces[idx];let a=pc.a;
  const wL=idx>0?Math.min(TURN_WIN,(pc.s1-pc.s0)/2,(pieces[idx-1].s1-pieces[idx-1].s0)/2):0;
  const wR=idx<pieces.length-1?Math.min(TURN_WIN,(pc.s1-pc.s0)/2,(pieces[idx+1].s1-pieces[idx+1].s0)/2):0;
  if(wL>0&&s-pc.s0<wL){const u=0.5+0.5*(s-pc.s0)/wL;a=_lerpA(pieces[idx-1].a,pc.a,u);}
  else if(wR>0&&pc.s1-s<wR){const u=0.5*(1-(pc.s1-s)/wR);a=_lerpA(pc.a,pieces[idx+1].a,u);}
  const rev=(s<bA)||((leg.revB||0)>0&&s>bB);
  return{x:pt.x,y:pt.y,a:_normA(a),rev};}
function _normA(a){while(a>Math.PI)a-=2*Math.PI;while(a<-Math.PI)a+=2*Math.PI;return a;}
// Docked/idle pose at a berth: nose classes face INTO the node, rear classes face AWAY.
function berthPose(n,cls,slot,truck){const b=berthPointFor(n,cls,slot,truck);
  const inward=Math.atan2(-b.out[1],-b.out[0]);
  const a=(VEH_GEO[cls].mode==="nose")?inward:inward+Math.PI;
  return{x:b.x,y:b.y,a};}

const VEH_HL={loader:CELL*0.9,forklift:CELL*0.75,ctruck:CELL*1.4}; // half-length in world px, per class
function legPath(A,B,cls){if(!A||!B)return null;
  const sideA=nodeDockSide(A),sideB=nodeDockSide(B),hl=VEH_HL[cls]||CELL*0.9;
  const pa=nodeDock(A),pb=nodeDock(B);
  const standA=dockStand(pa,sideA,hl),standB=dockStand(pb,sideB,hl);
  if(A.id===B.id)return[standA];
  const r=edgeRouteBetween(A.id,B.id);
  if(r){ // authored route: replace its bare endpoints with stand points so the body stays outside
    const mid=r.slice(1,-1);return _simplifyPts([standA,...mid,standB]);}
  const ca=siteNodeDirtCell(A),cb=siteNodeDirtCell(B);
  if(ca&&cb){const cells=siteBfsDirt(ca,cb);
    if(cells)return _simplifyPts([standA,...cells.map(c=>[(c[0]+0.5)*CELL,(c[1]+0.5)*CELL]),standB]);}
  return[standA,standB];}
function vehTransit(P){ // sim-seconds, one-way, ∝ real path length (NOT normalized like belts)
  return Math.max(G.logi.minTrip,pathLen(P)/G.logi.vehSpeed);}
function vehFullPose(v){ // {x,y,a} — the single source of truth for every pool vehicle
  const src=nodeById(v.fromId),dst=nodeById(v.toId),home=nodeById(v.home);
  if(v.state==="toPark"){const f=(v.eta>v.t0)?Math.max(0,Math.min(1,(G.t-v.t0)/(v.eta-v.t0))):1;
    return v.leg?legPose(v.leg,f):{x:v.path[v.path.length-1][0],y:v.path[v.path.length-1][1],a:Math.PI/2};}
  if(v.state==="toSource"||v.state==="toDest"){
    if(!v.leg||!v.path){const A=v.state==="toSource"?(home||src):src,B=v.state==="toSource"?src:dst;
      if(!A||!B)return{x:0,y:0,a:-Math.PI/2};
      v.leg=motionLeg(A,B,v.cls,0,v.berth||0,false);v.path=v.leg.path;}
    if(!v.leg)v.leg={path:v.path,revA:0,revB:0}; // restored save: rebuild the leg wrapper around the stored path
    const f=(v.eta>v.t0)?Math.max(0,Math.min(1,(G.t-v.t0)/(v.eta-v.t0))):1;
    return legPose(v.leg,f);}
  if(v.state==="loading"&&src&&src.gx!=null)return berthPose(src,v.cls,v.berth||0,false);
  if(v.state==="unloading"&&dst&&dst.gx!=null)return berthPose(dst,v.cls,v.berth||0,false);
  // idle ctrucks sit at their lay-by — but only once they've DRIVEN there (see toPark leg); no teleport
  if(v.state==="idle"&&v.cls==="ctruck"&&v.lx!=null)return{x:v.lx,y:v.ly,a:v.la!=null?v.la:Math.PI/2};
  if(v.state==="idle"){const h=nodeById(v.berthAt)||home||dst||src;
    if(h&&h.gx!=null)return berthPose(h,v.cls,v.berth||0,false);}
  if(v.lx!=null)return{x:v.lx,y:v.ly,a:-Math.PI/2};
  const h2=home||dst||src;return h2?{x:h2.x,y:h2.y,a:-Math.PI/2}:{x:0,y:0,a:-Math.PI/2};}
function vehPos(v){const p=vehFullPose(v);return{x:p.x,y:p.y};} // engine callers need position only
// Spawn pool vehicles up to the fleet count, homed at the class's natural node. S-BATCH-1 wires loaders
// (home = feeder); forklift/ctruck homes arrive with -3/-2 (homeNode returns null ⇒ not spawned yet).
function homeNode(cls){ if(cls==="loader")return G.nodes.find(isFeeder)||null; if(cls==="ctruck")return G.nodes.find(isLandfill)||null; if(cls==="forklift")return G.nodes.find(isExport)||null; return null; }
function ensureFleet(){ if(!G||!G.fleet||!G.vehicles)return;
  for(const cls in G.fleet){ const h=homeNode(cls); if(!h)continue;
    let have=0; for(const v of G.vehicles)if(v.cls===cls)have++;
    for(let k=have;k<G.fleet[cls];k++)
      G.vehicles.push({id:G.vehId++,cls,state:"idle",home:h.id,fromId:null,toId:null,payload:blankBuf(),baleLoad:[],t0:0,eta:0}); } }
// Pending job queue. SCANS NODES IN ASCENDING ID ORDER for determinism (NNG-5).
function primeFirstTruck(n){ // clean fast start: first truck minutes away, WITHOUT pre-filling the bunker
  if(!n||!isBunker(n)||n.supplier==="__none")return;
  if((n.truckDue||0) < G.logi.supTruck*0.9)n.truckDue=Math.floor(G.logi.supTruck*0.9);}
function buildJobs(){const jobs=[];
  for(const n of G.nodes){
    // LOADER: a feeder with UNCOMMITTED room (≥ one full load, after subtracting what loaders already en
    //   route will deliver) + a WIRED bunker holding material. Multiple loaders may serve one feeder — the
    //   room-accurate reservation (in advanceVehicles) keeps their combined delivery ≤ room, so a larger
    //   fleet scales a single intake instead of idling (a loader was previously capped at one per feeder).
    if(isFeeder(n)){
      let committed=0; for(const v of G.vehicles)if(v.cls==="loader"&&v.toId===n.id&&v.state!=="idle")committed+=(v.state==="toDest"||v.state==="unloading")?cnt(v.payload):G.logi.loaderCap;
      if(capOf(n)-cnt(n.inBuf)-committed < G.logi.loaderCap)continue;
      // consider EVERY wired bunker holding material; pick the fullest (deterministic tie-break on id).
      let best=null,bestFill=-1;
      for(const e of G.edges){if(e.to!==n.id)continue;const src=nodeById(e.from);if(!src||!isBunker(src))continue;
        const f=cnt(src.inBuf);if(f<=0)continue;
        // don't pile loaders on a bunker another loader is already draining unless it's much fuller
        if(f>bestFill||(f===bestFill&&(!best||src.id<best.from))){bestFill=f;best={from:src.id};}}
      if(best)jobs.push({cls:"loader",fromId:best.from,toId:n.id}); }
    // CONTAINER TRUCK: a bulk zone with FULL containers + a WIRED landfill with room. POOLED — many
    //   trucks may clear one bulk zone (one full container per trip). Reserve containers already owed
    //   to inbound trucks + landfill room already inbound, so a bigger fleet drains a backed-up zone.
    if(isBulk(n)){ const full=bulkFullCount(n); if(full<=0)continue;
      const e=G.edges.find(e=>e.from===n.id&&isLandfill(nodeById(e.to))&&cnt(nodeById(e.to).inBuf)<capOf(nodeById(e.to)));
      if(e){ const lf=nodeById(e.to),CC=G.logi.containerCap;
        let commit=0,inbound=0;
        for(const v of G.vehicles){ if(v.cls!=="ctruck"||v.state==="idle")continue;
          if(v.fromId===n.id&&(v.state==="toSource"||v.state==="loading"))commit++;   // containers this zone owes an inbound truck
          if(v.toId===e.to)inbound++; }                                                // containers already heading into this landfill
        const wantN=Math.max(0,full-commit),roomN=Math.floor(Math.max(0,capOf(lf)-cnt(lf.inBuf))/CC)-inbound;
        for(let k=Math.min(wantN,roomN);k>0;k--)jobs.push({cls:"ctruck",fromId:n.id,toId:e.to}); } }
    // FORKLIFT: a baler with stored bales + a WIRED export zone with room. POOLED — many forklifts may
    //   serve one baler. Reserve bales already owed to inbound forks + export room already spoken for,
    //   so adding forklifts actually relieves a full baler (was hard-capped 1:1 by a `some()` dedup).
    if(TYPES[n.type].isBaler){ if(!n.bales||n.bales.length<=0)continue;
      const e=G.edges.find(e=>e.from===n.id&&isExport(nodeById(e.to))&&nodeById(e.to).bales.length<G.logi.exportCap);
      if(e){ const dep=nodeById(e.to),FB=G.logi.forkBales;
        let commit=0,roomUsed=0;
        for(const v of G.vehicles){ if(v.cls!=="forklift"||v.state==="idle")continue;
          if(v.fromId===n.id&&(v.state==="toSource"||v.state==="loading"))commit+=FB;   // bales this baler owes an inbound fork
          if(v.toId===e.to)roomUsed+=(v.state==="toSource"||v.state==="loading")?FB:(v.baleLoad?v.baleLoad.length:0); } // export room already inbound
        const wantLoads=Math.ceil(Math.max(0,n.bales.length-commit)/FB);
        const roomLoads=Math.floor(Math.max(0,(G.logi.exportCap-dep.bales.length)-roomUsed)/FB);
        for(let k=Math.min(wantLoads,roomLoads);k>0;k--)jobs.push({cls:"forklift",fromId:n.id,toId:e.to}); } }
  }
  return jobs;}
// Assign queued jobs to idle pool vehicles of the matching class, in queue order.
function dispatchJobs(){G.jobs=buildJobs();
  G.jobs.sort((a,b)=>{ // scarce vehicles go to the most URGENT job first (stable, deterministic)
    if(a.cls!==b.cls)return 0;                                            // only order within a class
    if(a.cls==="loader"){const fa=cnt(nodeById(a.toId).inBuf),fb=cnt(nodeById(b.toId).inBuf);return fa-fb||a.toId-b.toId;} // hungriest feeder first
    if(a.cls==="forklift"){const fa=nodeById(a.fromId).bales.length,fb=nodeById(b.fromId).bales.length;return fb-fa||a.fromId-b.fromId;} // fullest baler first
    if(a.cls==="ctruck"){const fa=bulkFullCount(nodeById(a.fromId)),fb=bulkFullCount(nodeById(b.fromId));return fb-fa||a.fromId-b.fromId;} // fullest bulk zone first
    return 0;});
  for(const job of G.jobs){const v=G.vehicles.find(x=>x.cls===job.cls&&x.state==="idle");
    if(!v){ if(job.cls==="loader"){const f=nodeById(job.toId);
      if(f&&cnt(f.inBuf)<G.logi.loaderCap)f.state="noloader";} continue; } // only when genuinely running dry with nobody coming
    const s=nodeById(job.fromId),h=nodeById(v.home)||s;if(!s)continue;
    v.state="toSource";v.fromId=job.fromId;v.toId=job.toId;v.job=job;v.t0=G.t;
    const slotA=(v.berthAt===((h&&h.id)||null))?v.berth:0;
    v.berthAt=s.id;v.berth=claimBerth(s.id,v);
    if(v.cls==="ctruck"&&v.lx!=null){ // ampliroll departs its lay-by: drive lay-by → pickup berth
      const bB=berthPointFor(s,"ctruck",v.berth,false),oB=bB.out;
      const laneB=[bB.x+oB[0]*DOCK_CLEAR,bB.y+oB[1]*DOCK_CLEAR];
      const c0=[Math.floor(v.lx/CELL),Math.floor(v.ly/CELL)],c1=[Math.floor(laneB[0]/CELL),Math.floor(laneB[1]/CELL)];
      const cells=siteBfsDirt(c0,c1);
      const core=cells?[[v.lx,v.ly],...cells.map(c=>[(c[0]+0.5)*CELL,(c[1]+0.5)*CELL]),laneB]:[[v.lx,v.ly],laneB];
      const last=core[core.length-1],prev=core.length>1?core[core.length-2]:[last[0]-1,last[1]];
      let dx=last[0]-prev[0],dy=last[1]-prev[1];const dl=Math.hypot(dx,dy)||1;dx/=dl;dy/=dl;
      const pp=[last[0]+dx*PULL_PAST,last[1]+dy*PULL_PAST];
      v.leg={path:_cleanPath(core.concat([pp,laneB.slice(),[bB.x,bB.y]])),revA:0,
             revB:Math.hypot(laneB[0]-pp[0],laneB[1]-pp[1])+Math.hypot(bB.x-laneB[0],bB.y-laneB[1])};
      v.lx=null;v.ly=null;}
    else v.leg=motionLeg(h,s,v.cls,slotA,v.berth,false);
    v.path=v.leg.path;v.eta=G.t+vehTransit(v.path);}}
// Advance every in-flight vehicle one step off G.t/eta (no wall clock → deterministic, NNG-5).
// Load/unload are gated both ways (only what the source HAS / the dest has ROOM) → backpressure is
// emergent and mass is conserved (NNG-1). The loader reserves dest room at load time, so its payload
// always fits at unload; the unload still hard-gates on cap as a belt-and-braces invariant.
function advanceVehicles(dt){ ensureFleet();
  if(G.vehicles&&G.vehicles.length){
    {G._util=G._util||{};for(const cls of ["loader","forklift","ctruck"]){const u=G._util[cls]||(G._util[cls]={busy:0,tot:0});
      const vs=G.vehicles.filter(v=>v.cls===cls);if(vs.length){u.tot+=dt*vs.length;for(const v of vs)if(v.state!=="idle")u.busy+=dt;}}}
    for(const v of G.vehicles){
      if(v.state==="idle"||G.t<v.eta)continue;                 // parked, or still travelling/dwelling
      if(v.state==="toSource"){v.state="loading";v.eta=G.t+G.logi.loadDwell;}
      else if(v.state==="loading"){                            // load ≤cap from source→payload, reserving dest room
        const s=nodeById(v.fromId),d=nodeById(v.toId);
        if(s&&d&&v.cls==="loader"){
          let inflight=0;for(const o of G.vehicles)if(o!==v&&o.cls==="loader"&&o.toId===d.id&&(o.state==="toDest"||o.state==="unloading"))inflight+=cnt(o.payload);
          const room=capOf(d)-cnt(d.inBuf)-inflight;               // reserve only room not already spoken for by inbound loaders (keeps idle loaders empty)
          const q=Math.max(0,Math.min(G.logi.loaderCap-cnt(v.payload),cnt(s.inBuf),room));
          for(let k=0;k<q;k++){const pt=popParticle(s.inBuf);if(!pt)break;v.payload[pt.mat][pt.st]++;}}
        else if(s&&d&&v.cls==="ctruck"){ // haul ONE full container whole (bulk zone → landfill)
          let idx=-1;for(let i=0;i<(s.containers?s.containers.length:0);i++)if(cnt(s.containers[i])>=G.logi.containerCap){idx=i;break;}
          if(idx>=0){const c=s.containers[idx];for(const m of MAT)for(let z=0;z<ST;z++){v.payload[m][z]+=c[m][z];c[m][z]=0;}}}
        else if(s&&d&&v.cls==="forklift"){ // pull ≤FORK_BALES bales baler→export, reserving export room
          const room=G.logi.exportCap-d.bales.length,take=Math.max(0,Math.min(G.logi.forkBales,s.bales.length,room));
          for(let k=0;k<take;k++)v.baleLoad.push(s.bales.shift());}
        v.state="toDest";v.t0=G.t;
        const _slotA=(v.berthAt===((s&&s.id)||null))?v.berth:0;
        if(d){v.berthAt=d.id;v.berth=claimBerth(d.id,v);}
        v.leg=(s&&d)?motionLeg(s,d,v.cls,_slotA,v.berth,false):{path:[[s?s.x:0,s?s.y:0],[d?d.x:0,d?d.y:0]],revA:0,revB:0};
        v.path=v.leg.path;v.eta=G.t+vehTransit(v.path);}
      else if(v.state==="toDest"){v.state="unloading";v.eta=G.t+G.logi.unloadDwell;}
      else if(v.state==="unloading"){                          // deposit at dest, hard-gated (never overfill)
        const d=nodeById(v.toId);
        if(d&&v.baleLoad&&v.baleLoad.length){ while(v.baleLoad.length&&d.bales.length<G.logi.exportCap)d.bales.push(v.baleLoad.shift()); } // bale carrier → export
        else if(d){let _mv=0;for(const m of MAT)for(let z=0;z<ST;z++){let take=v.payload[m][z];
          while(take>0&&cnt(d.inBuf)<capOf(d)){d.inBuf[m][z]++;v.payload[m][z]--;take--;_mv++;}}
          if(_mv>0){d._inMass=(d._inMass||0)+_mv*PMASS;const src=nodeById(v.fromId);if(src)src._outMass=(src._outMass||0)+_mv*PMASS;}}
        if(v.cls==="ctruck"){ // ampliroll DRIVES back to its dirt lay-by (no teleport)
          const park=ctruckLayby(v),from=nodeById(v.toId);
          const p0=from?nodeDock(from):[v.path[v.path.length-1][0],v.path[v.path.length-1][1]];
          const c0=[Math.floor(p0[0]/CELL),Math.floor(p0[1]/CELL)],c1=[Math.floor(park[0]/CELL),Math.floor(park[1]/CELL)];
          const cells=siteBfsDirt(c0,c1);
          const path=cells?_cleanPath([p0,...cells.map(c=>[(c[0]+0.5)*CELL,(c[1]+0.5)*CELL]),park]):[p0,park];
          v.leg={path,revA:0,revB:0};v.path=path;v.state="toPark";v.t0=G.t;v.eta=G.t+vehTransit(path);
          v.job=null;v.berthAt=null;v.berth=null;}
        else{if(v.path&&v.path.length){v.lx=v.path[v.path.length-1][0];v.ly=v.path[v.path.length-1][1];}
          v.state="idle";v.home=v.toId;v.job=null;v.path=null;}}
      else if(v.state==="toPark"){ // arrived at the lay-by → settle idle there
        const e=v.path[v.path.length-1];v.lx=e[0];v.ly=e[1];v.la=Math.PI/2;
        v.state="idle";v.path=null;v.leg=null;}
    }
  }
  dispatchJobs();
}



/* ── SITE TUTORIAL (2026-07-11) ─────────────────────────────────────────────
 * Career opens on an empty site with a guided build: each step is a PURE
 * predicate on G (engine-testable); the UI only renders the current step.
 * Progress is monotonic in G.tutStep (serialized). Completing the line —
 * first on-spec sale + a reject path — graduates into free play. ──────────*/
const TUTO_OBJ={en:"Build a ferrous line: feeder \u2192 opener \u2192 magnet \u2192 baler \u2192 export, send rejects to the bulk zone, then run it and sell your first bale.",
  fr:"Construis une ligne ferreux : feeder \u2192 ouvre-sacs \u2192 aimant \u2192 presse \u2192 export, envoie les rejets au bulk, puis lance et vends ton premier ballot."};
const SITE_TUTO=[
 {id:"feeder", txt:"Your bunker, export bays, bulk and landfill are already placed. Add a FEEDER inside the warehouse, below the bunker. (\uFF0B Add)",
  unit:"feeder", zone:[2,10,16,13], done:g=>g.nodes.some(isFeeder)},
 {id:"wire1",  txt:"Wire them: tap the link button \u2192 the bunker\u2019s orange output \u2192 the green feeder inlet. A loader shuttles waste across.",
  btn:"connBtn", done:g=>g.edges.some(e=>isBunker(nodeById(e.from))&&isFeeder(nodeById(e.to)))},
 {id:"opener", txt:"Add a BAG OPENER under the feeder, then wire feeder \u2192 opener (a conveyor).",
  unit:"opener", zone:[2,13,16,18], done:g=>g.nodes.some(n=>n.type==="opener")&&g.edges.some(e=>isFeeder(nodeById(e.from))&&nodeById(e.to).type==="opener")},
 {id:"magnet", txt:"Add a MAGNET under the opener and wire opener \u2192 magnet. It lifts the steel off the belt.",
  unit:"magnet", zone:[2,15,16,20], done:g=>g.nodes.some(n=>n.type==="magnet")&&g.edges.some(e=>nodeById(e.from).type==="opener"&&nodeById(e.to).type==="magnet")},
 {id:"baler",  txt:"Add a BALER on the orange strip and wire the magnet\u2019s SORTED output (steel) into it.",
  unit:"baler", zone:[2,12,4,28], done:g=>g.nodes.some(n=>TYPES[n.type].isBaler)&&g.edges.some(e=>nodeById(e.from).type==="magnet"&&TYPES[nodeById(e.to).type].isBaler)},
 {id:"export", txt:"Wire the BALER \u2192 the FERROUS export bay (bottom-left). A forklift carries the bales; client trucks buy them.",
  done:g=>g.edges.some(e=>TYPES[nodeById(e.from).type].isBaler&&isExport(nodeById(e.to)))},
 {id:"rejects",txt:"The magnet\u2019s OTHER output is the reject stream. Wire it to the BULK zone \u2014 an unwired output jams the unit.",
  done:g=>g.edges.some(e=>nodeById(e.from).type==="magnet"&&isBulk(nodeById(e.to)))},
 {id:"landfill",txt:"Wire the BULK zone \u2192 the LANDFILL so full reject containers get hauled off-site.",
  done:g=>g.edges.some(e=>isBulk(nodeById(e.from))&&isLandfill(nodeById(e.to)))},
 {id:"sell",   txt:"Press \u25B6 to run the line. Watch it flow \u2014 truck, loader, belt, press \u2014 until a buyer truck LOADS your first ferrous bale.",
  done:g=>{let s=0;for(const n of g.nodes)if(isSell(n))s+=(n.balesSold||0);return s>0;}}
];
function tutoActive(){return !!(G&&G.scenario&&G.scenario.tuto&&(G.tutStep||0)<SITE_TUTO.length);}
function tutoAdvance(){ // monotonic; call cheaply from tick
  if(!G||!G.scenario||!G.scenario.tuto)return;
  let s=G.tutStep||0;
  while(s<SITE_TUTO.length&&SITE_TUTO[s].done(G))s++;
  if(s!==G.tutStep){G.tutStep=s;G._tutoDirty=true;
    if(s>=SITE_TUTO.length)G._tutoDone=true;}}
/* ── SITE authoring (Phase 3) ───────────────────────────────────────────────
 * The game: the player places units on the grid and wires them. Placement is
 * gated by property + shell rule + overlap (design package §3/§4/§6); wiring
 * enforces port direction and the SEAM LAW (conveyors within the line; a
 * vehicle — and only a vehicle — crosses each storage boundary). CAPEX charges
 * on placement, conveyors per metre. All pure engine, harness-tested. ──────*/
const SITE_COST=ECON.siteCost;   // alias — economic value lives in ECON (A3)
const SITE_BELT_COST=800;   // € per grid cell (4 m) of conveyor
const SITE_REFUND=0.5;      // demolition refund fraction
const SITE_SHELL_RULE={input:"out",feeder:"in",process:"in",baler:"in",bulk:"in",output:"out",landfill:"out"}; // legacy hangar/yard hint (kept for the palette copy); real gate is sitePlaceZones()
function siteUnitCost(siteType,kind){let c=siteType==="process"?(SITE_COST.process[kind]||150000):siteType==="mixer"?60000:(SITE_COST[siteType]||50000);
  if(G&&G.mode==="career"&&CAREER&&CAREER.counters.flags&&CAREER.counters.flags.sponsored)c=Math.round(c*SPONSOR_DISCOUNT); // corporate sponsor covers 20%
  return c;}
function siteCellsOf(siteType,gx,gy,rot){const fp=siteFootprint(siteType,rot||0),out=[];
  for(let a=0;a<fp.w;a++)for(let b=0;b<fp.h;b++)out.push([gx+a,gy+b]);return out;}
function _shellBorder(S,x,y){return S.shell.has(x+","+y)&&(!S.shell.has((x-1)+","+y)||!S.shell.has((x+1)+","+y)||!S.shell.has(x+","+(y-1))||!S.shell.has(x+","+(y+1)));}
// The STORAGE cell of a baler/feeder for a given placement+rotation. Baler stores bales in the cell
// away from the corridor (the wall side); feeder's output/storage sits on the strip edge. We define it
// geometrically from the footprint's long axis and rotation, then require it to border a shell wall.
// The face the STORAGE points toward, as an outward (dx,dy), given rotation. A baler's bale store sits
// opposite its inlet; rot 0 = store faces LEFT (−x). A feeder's output faces UP (−y) at rot 0. Rotation
// turns these clockwise. We then require the cell on that face to be just OUTSIDE the shell (a wall).
function siteStorageFace(siteType,rot){rot=((rot||0)%360+360)%360;
  const base=siteType==="feeder"?[0,-1]:[-1,0]; // feeder→up, baler→left at rot0
  const rots={0:[0,1],90:[1,0],180:[0,-1],270:[-1,0]}; // cos/sin helpers, but do it explicitly:
  // clockwise rotation of (dx,dy): 90°→(−dy,dx)
  let[dx,dy]=base;const steps=rot/90;
  for(let i=0;i<steps;i++){const nx=-dy,ny=dx;dx=nx;dy=ny;}
  return[dx,dy];}
function siteStorageCell(siteType,gx,gy,rot){ // the footprint cell that sits on the storage face
  const fp=siteFootprint(siteType,rot||0),[dx,dy]=siteStorageFace(siteType,rot);
  // pick the footprint cell furthest along (dx,dy)
  let best=null,bs=-1e9;
  for(let a=0;a<fp.w;a++)for(let b=0;b<fp.h;b++){const s=(gx+a)*dx+(gy+b)*dy;if(s>bs){bs=s;best=[gx+a,gy+b];}}
  return best;}
function siteCanPlace(siteType,gx,gy,rot,ignoreId){const S=siteSets(),cells=siteCellsOf(siteType,gx,gy,rot);
  for(const[x,y]of cells){
    if(x<0||y<0||x>=SITE_LAYOUT.grid.w||y>=SITE_LAYOUT.grid.h)return{ok:false,reason:"offgrid"};
    if(!S.prop.has(x+","+y))return{ok:false,reason:"offproperty"};}
  const PZ=sitePlaceZones(),zoneSet=PZ[siteType];
  if(zoneSet&&!cells.every(([x,y])=>zoneSet.has(x+","+y)))return{ok:false,reason:"zone_"+siteType};
  for(const n of G.nodes){if(n.gx==null||n.id===ignoreId)continue;
    const fp2=siteFootprint(n.site,n.rot||0);
    for(const[x,y]of cells)if(x>=n.gx&&x<n.gx+fp2.w&&y>=n.gy&&y<n.gy+fp2.h)return{ok:false,reason:"overlap"};}
  if(siteType==="baler"||siteType==="feeder"){ // storage face must point at a hall wall (Denis 2026-07-11)
    const cell=siteStorageCell(siteType,gx,gy,rot),[dx,dy]=siteStorageFace(siteType,rot);
    const nx=cell[0]+dx,ny=cell[1]+dy;
    if(S.shell.has(nx+","+ny))return{ok:false,reason:"wall_"+siteType};} // neighbour on the storage side is INSIDE → not a wall
  return{ok:true};}
function sitePlaceUnit(siteType,kind,gx,gy,rot,opts){opts=opts||{};
  const chk=siteCanPlace(siteType,gx,gy,rot);if(!chk.ok)return chk;
  if(siteType==="process"&&kind&&!opts.free&&!(G&&(G.mode==="sandbox"||(G.scenario&&G.scenario.unlimitedBudget)))&&BASE_UNITS.indexOf(kind)<0&&!unitUnlocked(kind))return{ok:false,reason:"locked"}; // R&D gate: unlock before placing (sandbox / free-play / scenario setup exempt)
  const cost=siteUnitCost(siteType,kind);
  if(!opts.free&&budgetBlocks(cost))return{ok:false,reason:"cash"};
  const n=_siteMakeUnit({type:siteType,x:gx,y:gy,rot:rot||0},{kind,spec:opts.spec});
  n.paidCapex=opts.free?0:cost;
  if(siteType==="input"&&opts.supplier!==undefined){n.supplier=opts.supplier;if(typeof primeFirstTruck==="function")primeFirstTruck(n);}
  if(siteType==="feeder")n.rate=(G.contract&&G.contract.feedTph)||0.5;
  if(!opts.free){postTx("capex",-cost);}
  return{ok:true,node:n,cost};}
function findNearestOutNub(wx,wy,radius){const PR=radius||Math.max(22,32/(G.cam?G.cam.zoom:1));let best=null,bd=PR;
  for(const n of G.nodes){if(n.gx==null||isOutput(n)||isExport(n)||isLandfill(n))continue;
    for(const s of["t","b","l","r"]){const port=sitePort(n,s);
      if(TYPES[n.type].out.indexOf(port)<0)continue;
      if(G.edges.some(e=>e.from===n.id&&e.fromPort===port))continue;
      const a=siteNodeAnchor(n,s),d=Math.hypot(a[0]*CELL-wx,a[1]*CELL-wy);
      if(d<bd){bd=d;best={n,port,side:s};}}}
  return best;}
function findNearestInNub(wx,wy,exclude,radius){const PR=radius||Math.max(22,32/(G.cam?G.cam.zoom:1));let best=null,bd=PR;
  for(const n of G.nodes){if(n.gx==null||isInput(n)||isBunker(n)||isLandfill(n)||isExport(n))continue;
    if(exclude&&n.id===exclude.id)continue;
    const a=siteInPortAnchor(n),d=Math.hypot(a[0]*CELL-wx,a[1]*CELL-wy);
    if(d<bd){bd=d;best=n;}}
  return best;}
function sortSideOf(n){return (n.sortSide==="l")?"l":"r";}      // which side the sorted/split stream ejects
function _rotSide(side,rot){ // rotate a t/b/l/r side clockwise by rot degrees
  const order=["t","r","b","l"],i=order.indexOf(side);if(i<0)return side;
  return order[(i+(((rot||0)/90)|0))%4];}
function sitePortsOf(n){ // THE port model — one list per unit, in cell coords, honouring rotation & sortSide
  const fp=siteFootprint(n.site,n.rot||0),t=TYPES[n.type];
  const P=(side)=>({t:[n.gx+fp.w/2,n.gy],b:[n.gx+fp.w/2,n.gy+fp.h],l:[n.gx,n.gy+fp.h/2],r:[n.gx+fp.w,n.gy+fp.h/2]}[side]);
  // mk() rotates the LOCAL side by n.rot so ports turn WITH the unit. Pass preRotated:true for sides
  // already resolved in world frame (baler storage/machinery via siteStorageFace).
  const mk=(id,kind,dir,side,extra)=>{const e=extra||{};const ws=e.preRotated?side:_rotSide(side,n.rot||0);
    const o=Object.assign({id,kind,dir,side:ws,x:P(ws)[0],y:P(ws)[1]},e);delete o.preRotated;return o;};
  const out=[];
  if(isBunker(n)){ // dump trucks locate at top (virtual); loader leaves at the bottom
    out.push(mk("dump","truck","in","t",{virtual:true}));
    out.push(mk("out","vehicle","out","b",{enginePort:t.out[0]}));
    return out;}
  if(isFeeder(n)){ // loader arrives up; belt leaves down
    out.push(mk("in","vehicle","in","t"));
    out.push(mk("out","conveyor","out","b",{enginePort:t.out[0]}));
    return out;}
  if(n.type==="baler"){ // conveyor in on the MACHINERY side; forklift out on the STORAGE (wall) side
    const face=siteStorageFace("baler",n.rot||0); // storage points at the wall
    const stSide=(face[0]<0)?"l":(face[0]>0)?"r":(face[1]<0)?"t":"b";
    const machSide={l:"r",r:"l",t:"b",b:"t"}[stSide];
    out.push(mk("in","conveyor","in",machSide,{preRotated:true}));
    out.push(mk("out","vehicle","out",stSide,{enginePort:t.out[0],preRotated:true}));
    return out;}
  if(isBulk(n)){ // end-of-line: belt in up, container truck out down
    out.push(mk("in","conveyor","in","t"));
    out.push(mk("out","vehicle","out","b",{enginePort:t.out[0]}));
    return out;}
  if(isExport(n)){ // bale storage: forklift in up; buyer trucks are virtual (not node-routed)
    out.push(mk("in","vehicle","in","t"));
    out.push(mk("truck","truck","out","b",{virtual:true}));
    return out;}
  if(isLandfill(n)){ // container trucks arrive up; nothing leaves
    out.push(mk("in","vehicle","in","t"));
    return out;}
  if(n.type==="mixer"){ // merge junction: three conveyor inlets (up/left/right) → one conveyor out (down)
    out.push(mk("in_t","conveyor","in","t"));
    out.push(mk("in_l","conveyor","in","l"));
    out.push(mk("in_r","conveyor","in","r"));
    out.push(mk("out","conveyor","out","b",{enginePort:t.out[0]}));
    return out;}
  // ── process units: conveyor in up; outputs depend on the sub-type ──
  out.push(mk("in","conveyor","in","t"));
  if(t.opener||t.out.length===1){ // opener (and any single-out process): straight through, out down
    out.push(mk("out","conveyor","out","b",{enginePort:t.out[0]}));
  } else if(t.isSplit){ // splitter: two port layouts
    if(n.splitLayout==="sides"){ // A → left, B → right (both horizontal, no down outlet)
      out.push(mk("main","conveyor","out","l",{enginePort:"A"}));
      out.push(mk("split","conveyor","out","r",{enginePort:"B"}));
    } else { // default "down": A straight down, B ejects to the selected side
      out.push(mk("main","conveyor","out","b",{enginePort:"A"}));
      out.push(mk("split","conveyor","out",sortSideOf(n),{enginePort:"B"}));
    }
  } else { // separator: sorted species ejects to the selected side; the REST goes down
    const sel=t.accept||t.out[0],rest=t.other||t.out.find(p=>p!==sel)||t.out[0];
    out.push(mk("sorted","conveyor","out",sortSideOf(n),{enginePort:sel}));
    out.push(mk("rest","conveyor","out","b",{enginePort:rest}));
  }
  return out;}
function portNeedsWire(n,p){ // is this port REQUIRED and currently unwired?
  if(p.virtual)return false;
  if(p.dir==="out"){ // outputs must go somewhere, except the splitter's optional 2nd branch & mixer passthrough handled by edges
    if(isExport(n)||isLandfill(n))return false;
    return !G.edges.some(e=>e.from===n.id&&e.fromPort===p.enginePort);}
  // inputs: a unit that PROCESSES needs a feed. Bunkers are truck-fed (virtual). Mixers/exports accept many but
  // need at least ONE feed total; we flag each unfed inlet only if the unit has NO feed at all (avoid noise).
  if(isBunker(n))return false;
  const anyFeed=G.edges.some(e=>e.to===n.id);
  if(acceptsManyFeeds(n))return !anyFeed && p.side==="t"; // one marker only
  return !G.edges.some(e=>e.to===n.id&&e.toSide===p.side);}
function siteAnchors(n){ // tappable anchors = the unit's real (non-virtual) ports
  return sitePortsOf(n).filter(p=>!p.virtual).map(p=>({side:p.side,role:p.dir==="in"?"in":"out",port:p.enginePort,kind:p.kind,x:p.x,y:p.y}));}
function siteNearestAnchor(cx,cy,maxD){ // cx,cy in CELL units; returns {n,a} nearest anchor
  let best=null,bd=maxD||0.75;
  for(const n of G.nodes){if(n.gx==null)continue;
    for(const a of siteAnchors(n)){const d=Math.hypot(a.x-cx,a.y-cy);if(d<bd){bd=d;best={n,a};}}}
  return best;}
function siteInPortAnchor(n){ // the input nub position (cell coords) — top-centre inlet for site units
  const fp=siteFootprint(n.site,n.rot||0);
  return [n.gx+fp.w/2,n.gy];} // top-centre; matches autoToSide's "t" for process/most units
function siteNodeAnchor(n,side){const fp=siteFootprint(n.site,n.rot||0);
  return side==="t"?[n.gx+fp.w/2,n.gy]:side==="b"?[n.gx+fp.w/2,n.gy+fp.h]
        :side==="l"?[n.gx,n.gy+fp.h/2]:[n.gx+fp.w,n.gy+fp.h/2];}
function autoToSide(A,fromSide,B){ // destination side: process = its canonical top-in; else nearest facing side
  if(B.site==="process")return"t";
  const pa=siteNodeAnchor(A,fromSide);
  const sides=(B.type==="baler")?["l","r"]:["t","b","l","r"];
  let best=sides[0],bd=1e9;
  for(const s of sides){const p=siteNodeAnchor(B,s),d=Math.hypot(p[0]-pa[0],p[1]-pa[1]);if(d<bd){bd=d;best=s;}}
  return best;}

function siteSeamKind(A,B,fromSide){ // the wire kind = the source OUTPUT port's kind
  const ports=sitePortsOf(A).filter(p=>p.dir==="out"&&!p.virtual);
  const p=(fromSide&&ports.find(z=>z.side===fromSide))||ports[0];
  return p?(p.kind==="vehicle"?"vehicle":"conveyor"):"conveyor";}
function acceptsManyFeeds(n){ // zones that legitimately merge several sources into one inlet
  return isExport(n)||isFeeder(n)||isBulk(n)||isLandfill(n)||(TYPES[n.type]&&TYPES[n.type].isMixer);}
function siteCanConnect(A,fromSide,B,toSide){
  if(!A||!B||A.id===B.id)return{ok:false,reason:"same"};
  if(A.gx==null||B.gx==null)return{ok:false,reason:"notsite"};
  // PORT MODEL: the source needs a real OUTPUT port on fromSide; the dest a real INPUT port on toSide;
  // and their KINDS must match (conveyor↔conveyor, vehicle↔vehicle). Everything else follows from this.
  const outP=sitePortsOf(A).find(p=>p.dir==="out"&&!p.virtual&&p.side===fromSide)
           ||sitePortsOf(A).find(p=>p.dir==="out"&&!p.virtual); // tolerate a nearby side pick
  if(!outP)return{ok:false,reason:"nooutport"};
  let inP=sitePortsOf(B).find(p=>p.dir==="in"&&!p.virtual&&p.side===toSide)
         ||sitePortsOf(B).find(p=>p.dir==="in"&&!p.virtual);
  if(!inP)return{ok:false,reason:"noinport"};
  if(outP.kind!==inP.kind)return{ok:false,reason:outP.kind==="vehicle"?"needveh":"needbelt"};
  if(G.edges.some(e=>e.from===A.id&&e.fromPort===outP.enginePort))return{ok:false,reason:"portused"};
  if(!acceptsManyFeeds(B)&&G.edges.some(e=>e.to===B.id&&e.toSide===inP.side))
    return{ok:false,reason:"inportused"}; // most inlets take ONE feed; export/feeder/bulk/landfill/mixer accept many
  if(G.edges.some(e=>e.from===A.id&&e.to===B.id))return{ok:false,reason:"dup"};
  return{ok:true,kind:outP.kind==="vehicle"?"vehicle":"conveyor",port:outP.enginePort,toSide:inP.side};}
function siteRouteFor(A,fromSide,B,toSide,kind){ // cell-coordinate route, per the canonical routing rules (§7)
  const p0=siteNodeAnchor(A,fromSide),p1=siteNodeAnchor(B,toSide);
  const vert=s=>(s==="t"||s==="b");
  if(kind==="vehicle"&&isBunker(A)&&isFeeder(B)){ // loader seam only: direct Z across the tipping apron
    const my=(p0[1]+p1[1])/2;
    return Math.abs(p0[0]-p1[0])<1e-6?[p0,p1]:[p0,[p0[0],my],[p1[0],my],p1];}
  if(kind==="vehicle"){ // forklift / container truck: dirt-network BFS between the side cells (drives AROUND the hall)
    const sc=(p,s)=>{const ax=Math.floor(p[0]),ay=Math.floor(p[1]);
      if(s==="l")return[ax-1,Math.floor(p[1]-1e-6)];
      if(s==="r")return[Math.floor(p[0]),Math.floor(p[1]-1e-6)];
      if(s==="t")return[Math.floor(p[0]-1e-6),ay-1];
      return[Math.floor(p[0]-1e-6),Math.floor(p[1])];};
    const nd=(c)=>{const s=siteSets();if(s.dirt.has(c[0]+","+c[1]))return c;
      for(let r=1;r<=5;r++)for(let dx=-r;dx<=r;dx++)for(let dy=-r;dy<=r;dy++){
        if(Math.max(Math.abs(dx),Math.abs(dy))!==r)continue;
        if(s.dirt.has((c[0]+dx)+","+(c[1]+dy)))return[c[0]+dx,c[1]+dy];}return null;};
    const a=nd(sc(p0,fromSide)),b=nd(sc(p1,toSide));if(!a||!b)return null;
    const cells=siteBfsDirt(a,b);if(!cells)return null;
    const pts=[p0,...cells.map(c=>[c[0]+0.5,c[1]+0.5]),p1];
    return _simplifyPts(pts);}
  // conveyor: side-aware orthogonal elbow
  if(Math.abs(p0[0]-p1[0])<1e-6||Math.abs(p0[1]-p1[1])<1e-6)return[p0,p1];
  const v0=vert(fromSide),v1=vert(toSide);
  if(v0&&v1){const my=(p0[1]+p1[1])/2;return[p0,[p0[0],my],[p1[0],my],p1];}
  if(!v0&&!v1){const mx=(p0[0]+p1[0])/2;return[p0,[mx,p0[1]],[mx,p1[1]],p1];}
  return v0?[p0,[p0[0],p1[1]],p1]:[p0,[p1[0],p0[1]],p1];}
function siteConnect(A,fromSide,B,toSide,opts){opts=opts||{};
  const chk=siteCanConnect(A,fromSide,B,toSide);if(!chk.ok)return chk;
  const route=siteRouteFor(A,fromSide,B,chk.toSide||toSide,chk.kind);
  if(!route)return{ok:false,reason:"noroute"};
  let cost=0;
  if(chk.kind==="conveyor"){cost=Math.ceil(pathLen(route))*SITE_BELT_COST;
    if(!opts.free&&budgetBlocks(cost))return{ok:false,reason:"cash"};}
  const e=_siteMakeEdge(A,fromSide,B,chk.toSide||toSide,chk.kind,route,chk.port);
  if(!opts.free&&cost>0){postTx("capex",-cost);}
  return{ok:true,edge:e,cost,kind:chk.kind};}
function _portSideForEdge(n,e,dir){ // find the current side of the port this edge uses on unit n
  const ports=sitePortsOf(n).filter(p=>!p.virtual&&(dir==="out"?p.dir==="out":p.dir==="in"));
  if(dir==="out"){const p=ports.find(z=>z.enginePort===e.fromPort);return p?p.side:(ports[0]&&ports[0].side);}
  // input: keep the recorded toSide if it's still a real inlet, else the first inlet
  const keep=ports.find(z=>z.side===e.toSide);return keep?keep.side:(ports[0]&&ports[0].side);}
function siteRerouteEdge(e){ // recompute fromSide/toSide/route from the units' CURRENT geometry
  const A=nodeById(e.from),B=nodeById(e.to);if(!A||!B)return;
  const fs=_portSideForEdge(A,e,"out"),ts=_portSideForEdge(B,e,"in");
  e.fromSide=fs;e.toSide=ts;
  const cellRoute=siteRouteFor(A,fs,B,ts,e.kind);
  if(cellRoute)e.route=cellRoute.map(p=>[p[0]*CELL,p[1]*CELL]);}
function siteRerouteFor(n){ // reroute every edge touching unit n
  for(const e of G.edges)if(e.from===n.id||e.to===n.id)siteRerouteEdge(e);}
function siteMoveUnit(n,gx,gy,rot){ // move a placed unit; connections follow & redraw. Returns {ok,reason}
  if(n.gx==null)return{ok:false,reason:"notsite"};
  const orot=(rot==null?n.rot||0:rot);
  const chk=siteCanPlace(n.site,gx,gy,orot,n.id); // allow overlapping ITSELF
  if(!chk.ok)return chk;
  const fp=siteFootprint(n.site,orot);
  n.gx=gx;n.gy=gy;n.rot=orot;
  n.x=(gx+fp.w/2)*CELL;n.y=(gy+fp.h/2)*CELL;n.w=fp.w*CELL;n.h=fp.h*CELL;
  siteRerouteFor(n);
  return{ok:true};}
function siteDisconnect(e){ // in-flight material rides to the destination? No — a removed belt scraps its load (charged)
  let carried=0;for(const sp of e.sprites)carried+=sp.bale?cnt(sp.bale):1;
  if(carried>0)dumpToLandfill(carried*PMASS);
  G.edges=G.edges.filter(x=>x!==e);return{ok:true,scrapped:carried};}
function siteDemolish(n){if(n.gx==null)return{ok:false,reason:"notsite"};
  let held=cnt(n.inBuf)+cnt(n.bale);
  if(n.bales)for(const b of n.bales)held+=cnt(b);
  if(n.containers)for(const c of n.containers)held+=cnt(c);
  if(held>0)dumpToLandfill(held*PMASS);                    // contents scrap to landfill (mass conserved, charged)
  let scrapped=held;
  for(const e of G.edges.slice())if(e.from===n.id||e.to===n.id)scrapped+=siteDisconnect(e).scrapped;
  for(const v of (G.vehicles||[]))if(v.fromId===n.id||v.toId===n.id||v.home===n.id){ // strand nobody
    if(v.state!=="idle"){const p=vehPos(v);v.lx=p.x;v.ly=p.y;}
    v.state="idle";v.job=null;v.path=null;
    if(v.home===n.id)v.home=null;}
  for(let i=(G.trucks||[]).length-1;i>=0;i--){const t=G.trucks[i];
    if(t.nodeId===n.id&&t.state!=="exit"){t.state="exit";t.path=t.exitPath;t.t0=G.t;
      t.eta=G.t+Math.max(G.logi.minTrip,pathLen(t.path)/G.logi.truckSpeed);}}
  const refund=Math.round((n.paidCapex||0)*SITE_REFUND); // A1: refund only what was actually paid — preplaced units (paidCapex 0) refund 0
  postTx("capex",refund);
  G.nodes=G.nodes.filter(x=>x!==n);
  return{ok:true,refund,scrapped};}
// Management action: scrap bales from an export bay straight to landfill (offspec only, or all).
// The disposal charge books immediately (dumpToLandfill); mass moves bales → G.landfill (conserved).
function exportScrap(n,onlyOffspec){if(!isExport(n)||!n.bales)return 0;
  let scrapped=0;const keep=[];
  for(const b of n.bales){
    if(onlyOffspec&&grade(b,n.spec).ok){keep.push(b);continue;}
    dumpToLandfill(cnt(b)*PMASS);scrapped++;}
  n.bales=keep;if(scrapped)n.state=(n.bales.length>=G.logi.exportCap)?"exportfull":"ok";
  return scrapped;}
/* ── S-TRUCK boundary trucks (Phase 2) ──────────────────────────────────────
 * Supplier, client and landfill trucks become entities that DRIVE the ring
 * road + aprons (WYSIWYG, D3): the visible truck IS the delivery. Economy
 * books at the physical event — gate fee at TIP, sale at LOAD, landfill
 * charge at LOAD (NNG-3). Deterministic off G.t (NNG-5). SITE-PLACED nodes
 * only (n.gx!=null): legacy flowsheet scenes keep their instant paths, so
 * every pre-existing harness claim is untouched. ─────────────────────────*/
let _truckWalk=null;
function truckWalkSet(){if(_truckWalk)return _truckWalk;const s=new Set();
  for(const z of SITE_LAYOUT.zones)if(z.type==="road"||z.type==="truckin"||z.type==="truckout")
    for(const[x,y]of z.cells)s.add(x+","+y);
  return _truckWalk=s;}
const TRUCK_IN=[19,0],TRUCK_OUT=[19,41]; // ring-road entry (north) and exit (south): one-way flow
function truckBfs(a,b){const W=truckWalkSet(),gk=b[0]+","+b[1],q=[a],came={};came[a[0]+","+a[1]]=null;let hit=false;
  while(q.length){const c=q.shift();if(c[0]+","+c[1]===gk){hit=true;break;}
    for(const[dx,dy]of[[1,0],[-1,0],[0,1],[0,-1]]){const nx=c[0]+dx,ny=c[1]+dy;
      if(!W.has(nx+","+ny))continue;const k=nx+","+ny;if(k in came)continue;came[k]=c;q.push([nx,ny]);}}
  if(!hit)return null;const p=[];let cur=b;while(cur){p.push(cur);cur=came[cur[0]+","+cur[1]];}return p.reverse();}
function truckStopCell(n){ // apron cell adjacent to the node it serves
  if(isBunker(n))return[n.gx+1,3];              // inbound apron, above the bunker
  if(isExport(n))return[n.gx+1,38];             // outbound apron, below the export bay
  if(isLandfill(n))return[Math.min(18,n.gx+3),38];
  return null;}
function truckPathWorld(a,b){const cells=truckBfs(a,b);if(!cells)return null;
  return _simplifyPts(cells.map(c=>[(c[0]+0.5)*CELL,(c[1]+0.5)*CELL]));}
function truckInflight(cls,nodeId){let k=0;for(const t of (G.trucks||[]))if(t.cls===cls&&t.nodeId===nodeId&&t.state!=="exit")k++;return k;}
function truckDockLegs(n,cls,slot){ // S-MOTION legs for a boundary truck serving node n
  const b=berthPointFor(n,cls,slot,true),o=b.out;
  const lane=[b.x+o[0]*DOCK_CLEAR,b.y+o[1]*DOCK_CLEAR];
  const laneCell=[Math.floor(lane[0]/CELL),Math.floor(lane[1]/CELL)];
  const core=truckBfs(TRUCK_IN,laneCell);if(!core)return null;
  const w=c=>[(c[0]+0.5)*CELL,(c[1]+0.5)*CELL];
  let coreW=_simplifyPts(core.map(w));
  coreW=_trimNear(coreW,lane,CELL*0.8);
  const jn=orthoZ(coreW.length?coreW[coreW.length-1]:lane,lane); // orthogonal junction — no diagonals
  coreW=coreW.concat(coreW.length?jn.slice(1):jn);
  // pull PAST along the arrival direction, cusp, reverse in — cab away, rear on the dock
  const last=coreW[coreW.length-1],prev=coreW.length>1?coreW[coreW.length-2]:[last[0]-1,last[1]];
  let dx=last[0]-prev[0],dy=last[1]-prev[1];const dl=Math.hypot(dx,dy)||1;dx/=dl;dy/=dl;
  const pp=[last[0]+dx*PULL_PAST,last[1]+dy*PULL_PAST];
  const enterPath=_cleanPath(coreW.concat([pp,lane.slice(),[b.x,b.y]]));
  const revB=Math.hypot(lane[0]-pp[0],lane[1]-pp[1])+Math.hypot(b.x-lane[0],b.y-lane[1]); // reverse begins AT the cusp: pp→lane→berth
  const back=truckBfs(laneCell,TRUCK_OUT);if(!back)return null;
  let backW=_simplifyPts(back.map(w));backW.reverse();backW=_trimNear(backW,lane,CELL*0.8);backW.reverse();
  const exitPath=_cleanPath([[b.x,b.y],lane.slice(),...backW]);
  return{enter:{path:enterPath,revA:0,revB},exit:{path:exitPath,revA:0,revB:0}};}
function spawnSiteTruck(cls,n){ if(!G.trucks)G.trucks=[];
  const t={id:G.truckId++,cls,nodeId:n.id,state:"toStop",t0:G.t,
    tipped:0,balesSold:0,hauled:0,plan:0,loaded:0,dw:0,dwT0:0};
  t.berthAt=n.id;t.berth=claimBerth(n.id,t);
  const dk=truckDockLegs(n,cls,t.berth);if(!dk){G.truckId--;return null;}
  t.leg=dk.enter;t.exitLeg=dk.exit;t.path=dk.enter.path;t.exitPath=dk.exit.path;
  t.eta=G.t+Math.max(G.logi.minTrip,pathLen(t.path)/G.logi.truckSpeed);
  G.trucks.push(t);return t;}
function truckPos(t){ // world pose (position + SPRITE heading), pure — S-MOTION
  const leg=t.leg||{path:t.path,revA:0,revB:0};
  if(t.state==="dwell")return legPose(leg,1); // parked at the berth, flip state included (cab away)
  const f=(t.eta>t.t0)?Math.max(0,Math.min(1,(G.t-t.t0)/(t.eta-t.t0))):1;
  return legPose(leg,f);}
function baleDomM(b){const c=comp(b);let dom="PET",mx=0;for(const m of MAT)if(c[m]>mx){mx=c[m];dom=m;}return dom;}
function _truckEvent(t){const n=nodeById(t.nodeId);if(!n)return;
  if(t.cls==="supplier"){ // TIP: dump what fits, pay gate on the dumped mass, divert the rest (NNG-3)
    const _idle=n.supplier==="__none";
    const _str=(!_idle)?supplierStream((n.supplier&&n.supplier!=="__none")?n.supplier:(G.contract&&G.contract.supplier)):null;
    const _comp=(_str&&_str.comp)||G.contract.comp,_gate=(_str&&_str.gate)||ECON.tipping;
    let load=Math.min(G.logi.supTruck,capOf(n)-cnt(n.inBuf));
    for(let k=0;k<load;k++){let r=rng(),a=0,p="paper";for(const m of MAT){a+=_comp[m]||0;if(r<a){p=m;break;}}n.inBuf[p][0]++;}
    if(load>0){const m=load*PMASS;G.cash+=m*_gate;G.ledger.tipping+=m*_gate;G.delivered+=m;G.deliveredTot+=m;n.truckFlash=1;t.tipped=load;n._inMass=(n._inMass||0)+m;}
    if(load<G.logi.supTruck){n.state="bunkerfull";if(!G.overflowAlerted){G.overflowAlerted=true;G.running=false;if(UI.onOverflow)UI.onOverflow();}}}
  else if(t.cls==="client"){ // finish the planned load (whatever the incremental pass hasn't taken yet)
    const off=buyerOfftake(n),bm=BALE_N*PMASS;
    while(t.loaded<t.plan&&n.bales.length>0&&(off===Infinity||(n.offAllow||0)>=bm)){
      const _b=n.bales.shift();(t.baleDoms=t.baleDoms||[]).push(baleDomM(_b));
      sellBale(n,_b);if(off!==Infinity)n.offAllow-=bm;t.loaded++;n.truckFlash=1;}
    t.balesSold=t.loaded;}
  else if(t.cls==="lftruck"){ // LOAD: haul exactly ONE container off-map, book the charge, count it
    const take=Math.min(G.logi.containerCap,cnt(n.inBuf)); // one container per trip
    if(take>0){for(let k=0;k<take;k++)popParticle(n.inBuf);dumpToLandfill(take*PMASS);
      n.contEvac=(n.contEvac||0)+1;n.massEvac=(n.massEvac||0)+take*PMASS; // landfill tally
      n.truckFlash=1;t.hauled=take;t.hauledCont=1;}}}
function advanceSiteTrucks(dt){ if(!G.trucks||!G.trucks.length)return;
  for(let i=G.trucks.length-1;i>=0;i--){const t=G.trucks[i];
    if(t.state==="dwell"&&t.cls==="client"&&t.plan>0){ // incremental bale loading, evenly through the dwell
      const n=nodeById(t.nodeId);
      if(n){const prog=Math.max(0,Math.min(1,(G.t-t.dwT0)/t.dw)),k=Math.floor(prog*t.plan),off=buyerOfftake(n),bm=BALE_N*PMASS;
        while(t.loaded<k&&n.bales.length>0&&(off===Infinity||(n.offAllow||0)>=bm)){
          const _b=n.bales.shift();(t.baleDoms=t.baleDoms||[]).push(baleDomM(_b));
          sellBale(n,_b);if(off!==Infinity)n.offAllow-=bm;t.loaded++;t.balesSold=t.loaded;n.truckFlash=1;}}}
    if(G.t<t.eta)continue;
    if(t.state==="toStop"){t.state="dwell";t.dwT0=G.t;
      t.dw=(t.cls==="supplier"?G.logi.tipDwell:(t.cls==="client"?G.logi.cliDwell:G.logi.lfDwell));
      t.eta=G.t+t.dw;
      if(t.cls==="client"){const n=nodeById(t.nodeId);if(n){const off=buyerOfftake(n),bm=BALE_N*PMASS;
        t.plan=(off===Infinity)?Math.min(G.logi.cliTruck,n.bales.length)
              :Math.min(G.logi.cliTruck,n.bales.length,Math.floor((n.offAllow||0)/bm+1e-9));t.loaded=0;}}}
    else if(t.state==="dwell"){_truckEvent(t);
      if(!t.exitLeg||!t.exitPath){G.trucks.splice(i,1);continue;}
      t.state="exit";t.leg=t.exitLeg;t.path=t.exitPath;t.berthAt=null;t.berth=null; // free the berth as it pulls out
      t.t0=G.t;t.eta=G.t+Math.max(G.logi.minTrip,pathLen(t.path)/G.logi.truckSpeed);}
    else if(t.state==="exit")G.trucks.splice(i,1);}}
function careerDaily(){ if(!G||G.mode!=="career"||!CAREER||!CAREER.counters)return; // engine-side: bank best daily net + best diversion for goals (HUD-independent)
  const l=G.ledger||{}, net=(l.tipping||0)+(l.sales||0)+(l.subsidies||0)-(l.labour||0)-(l.logistics||0)-(l.power||0)-(l.landfill||0);
  const day=Math.floor(G.t/24);
  if(G._cDay==null){G._cDay=day;G._cNet=net;return;}
  if(day>G._cDay){const dn=(net-G._cNet)/(day-G._cDay);
    if(dn>(CAREER.counters.bestDailyNet||0))CAREER.counters.bestDailyNet=dn;
    const dv=G.delivered>0?Math.max(0,1-G.landfill/G.delivered):0; if(dv>CAREER.counters.bestDiversion)CAREER.counters.bestDiversion=dv;
    const mc=G.nodes.reduce((a,x)=>a+(x.type!=="storage"?1:0),0); if(mc>CAREER.counters.maxUnits)CAREER.counters.maxUnits=mc; // count built OR loaded units
    G._cDay=day;G._cNet=net;}}
function tick(dt){
  if(G&&G.scenario&&G.scenario.tuto&&!G._tutoDone)tutoAdvance();
  if(G.finished)return; G.energy=0;
  careerDaily();
  // 0. inbound — SUPPLIER TRUCKS tip into BUNKERS (S-BATCH-1). The supplier stream accrues a "due" mass
  //    per bunker; each full truckload (supTruck) dumps what FITS and tips on the dumped weight (NNG-3,
  //    booking moves from per-particle to per-load, same totals). What doesn't fit DIVERTS — no landfill,
  //    no tip (fork C turn-away); the bunker reads BUNKER-FULL. Loaders drain bunker→feeder (stage 3d).
  const _supN={}; // how many active bunkers share each supplier — the contract rate is SPLIT among them, not duplicated
  for(const b of G.nodes){ if(!isBunker(b)||b.supplier==="__none")continue;
    const sk=(b.supplier&&b.supplier!=="__none")?b.supplier:((G.contract&&G.contract.supplier)||"__default");_supN[sk]=(_supN[sk]||0)+1;}
  for(const b of G.nodes){ if(!isBunker(b))continue;
    b.state=(cnt(b.inBuf)>=capOf(b))?"bunkerfull":"ok";                   // WYSIWYG: full is full every tick, not only when a truck bounces (NNG-2)
    if(cnt(b.inBuf)<capOf(b)*0.5)G.overflowAlerted=false;                 // re-arm the full-alert once the bunker drains
    const _idle=b.supplier==="__none";
    const _str=(G.continuous&&!_idle)?supplierStream((b.supplier&&b.supplier!=="__none")?b.supplier:(G.contract&&G.contract.supplier)):null;
    const _comp=(_str&&_str.comp)||G.contract.comp,_frTot=(_str&&_str.feedTph)||G.contract.feedTph||4,_gate=(_str&&_str.gate)||ECON.tipping;
    if(_idle)continue;
    if(!(G.continuous||G.delivered<G.contract.tonnage))continue;          // tutorial tonnage gate
    const _sk=(b.supplier&&b.supplier!=="__none")?b.supplier:((G.contract&&G.contract.supplier)||"__default");
    const _fr=_frTot/Math.max(1,_supN[_sk]||1);                          // SPLIT the contract's rate across its bunkers
    b.truckDue=(b.truckDue||0)+_fr*dt/PMASS;                              // particles this bunker's share owes
    if(b.gx!=null){ // SITE bunker (S-TRUCK): each due truckload becomes a visible truck; the gate fee books at the TIP
      while(b.truckDue>=G.logi.supTruck&&truckInflight("supplier",b.id)<G.logi.truckMaxInflight){
        b.truckDue-=G.logi.supTruck;spawnSiteTruck("supplier",b);}
      continue;}
    while(b.truckDue>=G.logi.supTruck&&(G.continuous||G.delivered<G.contract.tonnage)){
      b.truckDue-=G.logi.supTruck;
      let load=Math.min(G.logi.supTruck,capOf(b)-cnt(b.inBuf));             // dump what fits; remainder diverts
      if(!G.continuous)load=Math.min(load,Math.max(0,Math.ceil((G.contract.tonnage-G.delivered)/PMASS))); // don't overshoot the quota
      for(let k=0;k<load;k++){let r=rng(),a=0,p="paper";for(const m of MAT){a+=_comp[m]||0;if(r<a){p=m;break;}}b.inBuf[p][0]++;}
      if(load>0){const m=load*PMASS;G.cash+=m*_gate;G.ledger.tipping+=m*_gate;G.delivered+=m;G.deliveredTot+=m;b.truckFlash=1;}
      if(capOf(b)-cnt(b.inBuf)<=0||(load<G.logi.supTruck&&cnt(b.inBuf)>=capOf(b))){ // truck turned away on a full bunker
        b.state="bunkerfull"; if(!G.overflowAlerted){G.overflowAlerted=true;G.running=false;if(UI.onOverflow)UI.onOverflow();} }
    }
  }
  // 2. advance sprites
  for(const e of G.edges){const dst=nodeById(e.to);if(!dst){for(const s of e.sprites)if(P.length<600)P.push(s);e.sprites.length=0;continue;}
    const dl=TYPES[dst.type];
    for(let i=e.sprites.length-1;i>=0;i--){const s=e.sprites[i];s.t+=e.speed*dt*(s.bale?0.5:1);if(s.t<1)continue;
      if(s.bale){ // bale token
        if(isSell(dst)){sellBale(dst,s.bale);dst.truckFlash=1;killSprite(e,i);} // accounted on arrival (graded + paid)
        else if(isBulk(dst)){ if(bulkRoom(dst)>=cnt(s.bale)){for(const m of MAT)for(let z=0;z<ST;z++)for(let k=0;k<s.bale[m][z];k++)bulkAdd(dst,m,z);killSprite(e,i);} else s.t=1; } // into containers, or stall if the zone is full
        else{for(const m of MAT)for(let z=0;z<ST;z++)dst.inBuf[m][z]+=s.bale[m][z];killSprite(e,i);} // misrouted: unpack
      } else { // material particle
        if(isBulk(dst)){ if(bulkAdd(dst,s.mat,s.st))killSprite(e,i); else s.t=1; } // into the active container, or stall (CONTAINER-FULL)
        else if(isSell(dst)){dst.looseHit=1;dumpToLandfill(PMASS);killSprite(e,i);} // loose unbaled at a seller -> wasted
        else if(hasRoom(dst)){dst.inBuf[s.mat][s.st]++;killSprite(e,i);}
        else s.t=1;
      }
    }
  }
  // 3. process units (skip Output sinks, balers, and BUNKERS — a bunker drains by loader, not by belt)
  for(const n of G.nodes){const t=TYPES[n.type];if(isOutput(n)||t.isBaler||isBunker(n)||isBulk(n)||isLandfill(n)||isExport(n))continue;
    let cap=isInput(n)?(n.rate||5):(t.cap||5);
    if(t.isPick){cap=n.workers*PICK_RATE;const w=n.workers*WAGE*dt;G.cash-=w;G.wageTot+=w;G.ledger.labour+=w;}
    if(!isInput(n))cap=techCap(n.type,cap);
    G.carry[n.id]=(G.carry[n.id]||0)+cap*dt/PMASS;let budget=Math.floor(G.carry[n.id]);G.carry[n.id]-=budget;
    n.load=cnt(n.inBuf)>0?Math.min(1.5,cnt(n.inBuf)/(capOf(n)*(isInput(n)?1.0:0.9))):0; // a feeder is a hopper: full = healthy. Process nodes: OVERLOAD only when the backpressure buffer is genuinely saturating (~90% full), not at half — decoupled from the rated t/h, which was tripping a 10 t/h unit at ~5 t/h.
    let jammed=false,wrong=false,did=0;
    for(let k=0;k<budget;k++){if(cnt(n.inBuf)<=0)break;const pt=popParticle(n.inBuf);if(!pt)break;
      let mat=pt.mat,st=pt.st,nst=st,port;
      if(t.isPick){const isT=mat===n.target;const take=isT?rng()<techPickEff(PICK_EFF):rng()<PICK_FALSE;port=take?"R":"O";}
      else if(t.opener){ // liberate bag -> item at 100% (every bag opened); immune to film
        if(st===0&&rng()<techOpenEff(OPEN_EFF))nst=1; else nst=st;
        port="O";}
      else if(t.pass)port="O";
      else if(t.isSplit){const eA=outEdge(n,"A"),eB=outEdge(n,"B");
        if(eA&&eB){let toA=rng()<n.ratio;if(rng()<SPLIT_NOISE)toA=!toA;port=toA?"A":"B";} // both wired → split
        else if(eA)port="A"; else if(eB)port="B"; // one branch only → everything goes there
        else port="A";} // neither wired → route to A (will find no edge below and jam cleanly)
      else{const bp=t.prob[mat]!==undefined?t.prob[mat]:t.prob.default,p=techProb(n.type,mat,bp);
        const roll=rng()<p; // F2: draw the rng ALWAYS so forcing a bag pass-through never shifts the deterministic sequence
        if(t.needsItem&&st===0){port=t.other;wrong=true;} // Lot F: a sealed bag is opaque — NO separator can sort by material; it passes straight through (roll discarded)
        else port=roll?t.accept:t.other;}
      const e=outEdge(n,port);
      // Doubly-gated transfer (NNG #3): commit only if the destination has room; otherwise
      // restore the particle UNCHANGED (no resize, no wrap side-effect) and stall. This is the
      // clean backpressure rule and fixes the wrap leak the old pop-then-jam had on a full output.
      if(!e||e.sprites.length>=(e.max||EDGE_MAX)){n.inBuf[mat][st]++;jammed=true;break;}
      spawnSprite(e,mat,nst);did++;
      n._inMass=(n._inMass||0)+PMASS; // one particle consumed
      if(t.accept&&port===t.accept)n._sortMass=(n._sortMass||0)+PMASS; // to the SORTED/selected output
      else n._restMass=(n._restMass||0)+PMASS;                          // to the pass-through/other output
    }
    n.jam=jammed?Math.min(1,n.jam+0.12):Math.max(0,n.jam-0.08);
    if(t.kW&&did>0)G.energy+=techKW(n.type,t.kW)*dt;
    if(did>0&&G.mode==="career"){const f=CAREER.counters.flags;if(f&&f.ran)f.ran[n.type]=true;} // objective: this unit ran
    // failure state
    n.idle = (did===0&&cnt(n.inBuf)===0) ? (n.idle||0)+dt : 0;
    n.chok = (did===0&&cnt(n.inBuf)>0) ? (n.chok||0)+dt : 0; // choked = has material but moved nothing (true jam); resets as soon as anything flows
    n.over = (n.load>1.02) ? (n.over||0)+dt : 0; // sustained buffer-saturation timer (hysteresis, mirrors chok/idle)
    if(n.chok>JAM_T)n.state="jammed"; else if(wrong)n.state="bagged"; else if(n.over>OVER_T)n.state="overloaded";
    else if(n.idle>STARVE_T)n.state="starved"; else n.state="ok";
  }
  // 3b. balers: accumulate → pack a bale into n.bales (≤ BALER_BALES). Bales are pulled by a FORKLIFT
  //     (stage 3d), not emitted onto a belt. When the internal stack is full the baler jams (BALER-FULL).
  for(const n of G.nodes){if(!TYPES[n.type].isBaler)continue;
    const movedIn=cnt(n.inBuf);
    for(const m of MAT)for(let z=0;z<ST;z++){n.bale[m][z]+=n.inBuf[m][z];n.inBuf[m][z]=0;}
    let jam=false;
    while(cnt(n.bale)>=BALE_N){
      if(n.bales.length>=G.logi.balerBales){jam=true;break;}                 // BALER-FULL: stack is full, await a forklift
      const tok=blankBuf();for(let k=0;k<BALE_N;k++){const p=popParticle(n.bale);if(!p)break;tok[p.mat][p.st]++;}
      n.bales.push(tok);
    }
    n.jam=jam?Math.min(1,n.jam+0.12):Math.max(0,n.jam-0.08);
    n.idle = (movedIn>0||cnt(n.bale)>0)?0:(n.idle||0)+dt; n.state = jam?"balerfull":(n.idle>STARVE_T?"starved":"ok");
    if(TYPES[n.type].kW && movedIn>0) G.energy+=techKW(n.type,TYPES[n.type].kW)*dt;
  }
  // 3c. outbound disposal (S-BATCH-2). The LANDFILL TRUCK is a per-zone cadence arrival (not a pool
  //     vehicle): every LF_CADENCE it hauls ≤ LF_TRUCK containers off-map and books the landfill charge
  //     on their ACTUAL mass (dumpToLandfill, unchanged rate). Bulk zones surface CONTAINER-FULL here.
  for(const n of G.nodes){
    if(isLandfill(n)){ n.evacT=(n.evacT||0)+dt;
      if(n.evacT>=G.logi.lfCadence){ n.evacT-=G.logi.lfCadence;
        if(n.gx!=null){ // S-TRUCK: dispatch one truck PER waiting container so a backlog clears in parallel (never bottlenecks)
          const waiting=Math.ceil(cnt(n.inBuf)/G.logi.containerCap);        // full-or-partial containers on the pad
          const inflight=truckInflight("lftruck",n.id);
          if(waiting>inflight&&inflight<G.logi.landfillHold)spawnSiteTruck("lftruck",n); } // charge books when the truck LOADS one container
        else{ const take=Math.min(G.logi.lfTruck*G.logi.containerCap,cnt(n.inBuf));
          if(take>0){ for(let k=0;k<take;k++)popParticle(n.inBuf); dumpToLandfill(take*PMASS); n.truckFlash=1; } } } }
    else if(isBulk(n)){ n.state=(bulkRoom(n)<=0)?"containerfull":"ok"; }
    else if(isExport(n)&&isHeld(n)){ // TEMPORARY STOCK: no contract → just accumulate, never sell/dump
      n.state=(n.bales.length>=G.logi.exportCap)?"exportfull":"ok"; }
    else if(isExport(n)){ // CLIENT TRUCK: buys bales bounded by the buyer's offtake (Infinity ⇒ buy-on-arrival)
      const off=buyerOfftake(n),bm=BALE_N*PMASS;
      if(off!==Infinity)n.offAllow=Math.min((n.offAllow||0)+off*dt,G.logi.cliTruck*bm);
      if(n.gx!=null){ // S-TRUCK: the sale books when the visible truck LOADS at the dock
        n.cliT=(n.cliT||0)+dt;
        // trucks follow the STORAGE: roll as soon as ~5 bales are waiting, and dispatch one PER waiting
        // truckload in parallel (like the landfill) so a busy bay never backs up. A short cadence only
        // spaces successive spawns so they don't all leave on the same tick.
        const inflight=truckInflight("client",n.id);
        const claimed=inflight*G.logi.cliTruck;                          // bales already spoken for by trucks en route
        const free=n.bales.length-claimed;                               // bales still needing a truck
        const trigger=Math.min(G.logi.cliTrigger,G.logi.exportCap);      // roll at this many waiting bales
        const ready=free>=trigger||n.bales.length>=G.logi.exportCap-2;   // …or the bay is nearly full
        if(n.cliT>=G.logi.cliCadence&&ready&&inflight<G.logi.cliMaxInflight&&(off===Infinity||(n.offAllow||0)>=bm)){
          n.cliT=0;spawnSiteTruck("client",n);}}
      else{ let q;
        if(off===Infinity){ q=Math.min(G.logi.cliTruck,n.bales.length); }
        else { q=Math.min(G.logi.cliTruck,n.bales.length,Math.floor(n.offAllow/bm+1e-9)); }
        for(let i=0;i<q;i++){ sellBale(n,n.bales.shift()); if(off!==Infinity)n.offAllow-=bm; n.truckFlash=1; } }
      n.state=(n.bales.length>=G.logi.exportCap)?"exportfull":"ok"; } }
  // 3d. batch transport (S-BATCH): advance pool vehicles + dispatch jobs.
  advanceVehicles(dt);
  advanceSiteTrucks(dt); // S-TRUCK boundary trucks (site mode only; no-op elsewhere)
  // 4. economics
  {const pw=G.energy*ECON.elec*techElecMult();G.cash-=pw;G.ledger.power+=pw;}
  {let lo=0;const R=ECON.opex.vehHourly;if(G.fleet&&R)for(const cls in G.fleet)lo+=(G.fleet[cls]||0)*(R[cls]||0);
   if(lo>0)postTx("logistics",-lo*dt);} // Lot D: fleet OPEX — owned vehicles draw a grouped hourly cost into the ledger
  G.minCash=Math.min(G.minCash,G.cash);G.t+=dt;
  recordOpexDay(); // per-day OPEX history (engine-side, capex-excluded) — see §OPEX-HISTORY
  // NNG-6 soft-fail: NO hard game-over on cash<0 — the run continues and is recoverable
  // (sell bales to climb back out). The HUD flags "in the red"; the contract still ends only on completion.
  // 5. completion
  if(G.mode==="career"&&!G.continuous&&G.delivered>=G.contract.tonnage){
    let up=0;for(const n of G.nodes){const t=TYPES[n.type];if(isOutput(n)||t.isBaler||isBulk(n)||isLandfill(n)||isExport(n))continue;up+=cnt(n.inBuf);}
    let infl=0;for(const e of G.edges)infl+=e.sprites.length;
    if(up<=0&&infl<=0){
      // pack any partial bale, then move all baler bales to their wired export zone (else landfill)
      for(const n of G.nodes){if(!TYPES[n.type].isBaler)continue;
        if(cnt(n.bale)>0){const tok=blankBuf();for(const m of MAT)for(let z=0;z<ST;z++)tok[m][z]=n.bale[m][z];n.bales.push(tok);n.bale=blankBuf();}
        const e=outEdge(n,"O"),dst=e&&nodeById(e.to);
        while(n.bales.length){const b=n.bales.shift();if(dst&&isExport(dst))dst.bales.push(b);else dumpToLandfill(cnt(b)*PMASS);}}
      // drain in-flight vehicles: bale carriers → export, loose carriers → landfill (unsorted waste)
      for(const v of G.vehicles){
        if(v.baleLoad&&v.baleLoad.length){const d=nodeById(v.toId);while(v.baleLoad.length){const b=v.baleLoad.shift();if(d&&isExport(d))d.bales.push(b);else dumpToLandfill(cnt(b)*PMASS);}}
        if(v.payload&&cnt(v.payload)>0){dumpToLandfill(cnt(v.payload)*PMASS);v.payload=blankBuf();}}
      // final client truck: sell every export bale (uncapped at close)
      for(const n of G.nodes){if(!isExport(n)||!n.bales.length)continue;for(const tok of n.bales)sellBale(n,tok);n.bales=[];}
      // final landfill truck: bulk containers + landfill piles + any legacy dispose heap
      for(const n of G.nodes){
        if(n.containers){for(const c of n.containers)if(cnt(c)>0)dumpToLandfill(cnt(c)*PMASS);n.containers=[blankBuf(),blankBuf(),blankBuf()];}
        if(isLandfill(n)&&cnt(n.inBuf)>0){dumpToLandfill(cnt(n.inBuf)*PMASS);n.inBuf=blankBuf();}
        if(isDispose(n)&&n.disposeHeap>0){dumpToLandfill(n.disposeHeap*PMASS);n.disposeHeap=0;}}
      G.minCash=Math.min(G.minCash,G.cash);
      if(!G.scenario){const win=contractWon();endGame(win,win?"win":(G.cash<=0?"red":"offspec"));} // plain contract: finite challenge (legacy)
      else{const ph=G.scenario.phases[G.phaseIdx];
        if(ph.reward){postTx("grants",ph.reward);} // one-time phase reward → grants (kept out of the recurring rate)
        G.lastPhase={name:ph.name,name_f:ph.name_f,reward:ph.reward||0,product:ph.product||"PET",recovered:Math.max(0,((G.sold[ph.product]&&G.sold[ph.product].on)||0)-((G.phaseSoldBase&&G.phaseSoldBase[ph.product])||0))};
        if(G.phaseIdx<G.scenario.phases.length-1){applyPhase(G.phaseIdx+1);snapshotPhase();UI.onPhase(G.scenario.phases[G.phaseIdx]);} // advance phase
        else{ // last phase done → graduate into continuous operation (no win screen)
          G.continuous=true;G.contract.tonnage=Infinity;G.tut=null;
          const f=CAREER&&CAREER.counters&&CAREER.counters.flags; if(f)f.tutorialComplete=true; saveCareer();
          if(UI.onGraduate)UI.onGraduate(G.lastPhase);}}
    }
  }
}
let last=0;
/*@ENGINE-END@ ───────────────────────────────────────────────────────────────
 *  BROWSER LAYER below — everything DOM/canvas. Not seen by the engine harness.
 *  RENDER — canvas drawing (the run loop, camera, geometry, node/edge/sprite draw).
 * ────────────────────────────────────────────────────────────────────────────*/
