#!/usr/bin/env node
// PRICE-STUDY (2026-11-04): the game's prices, computed headless off the game's own core, for
// futureDesigns/PRICE-STUDY-2026-11.md. A STUDY TOOL: it changes nothing, no gate runs it.
//
//   node futureDesigns/price-study/price_study.js            -> prints the tables, writes price_study_data.json
//   node futureDesigns/price-study/price_study.js --no-write -> prints only
//
// What it reads (never writes): tools/flight_core.js (the built core: POWERPLANTS, GEN_* catalogues, buildGen,
// genShakedown, the ledger, econ*/procure* prices) and tools/_cage_design.js (the Caravan-alike and RV-alike
// archetypes, baked exactly as GATE ARCHETYPES bakes them). The REAL side (web benchmarks, USD 2025-26) is the table
// REAL below, with its sources in the report; the conversion is fitted here (log least squares, so a x2 miss
// weighs the same whichever way it goes).
'use strict';
const fs = require('fs'), path = require('path'), cp = require('child_process');
const ROOT = path.resolve(__dirname, '..', '..');            // flyDiy/
const T = path.join(ROOT, 'tools');
const C = require(path.join(T, 'flight_core.js'));

// ---- the archetype loader: GATE ARCHETYPES' own shim (tools/_arch_check.js loadPanel), read from the file -------
function loadDesign() {
  const src = fs.readFileSync(path.join(T, '_arch_check.js'), 'utf8');
  const m = src.match(/function loadPanel\(\) \{[\s\S]*?\n\}\n/);
  if (!m) throw new Error('loadPanel not found in _arch_check.js');
  // eslint-disable-next-line no-eval
  eval(m[0] + '; loadPanel();');
  return require(path.join(T, '_cage_design.js'));
}

// ---- the planes ---------------------------------------------------------------------------------------------------
// B-ITES is the user's build on origin/claude/a0/b-ites-input (not on master): read from the tree when present,
// else from that branch with git show, else skipped (said so)
function bitesJson() {
  const rel = 'builds/candidates/review/B-ITES.json';
  const f = path.join(ROOT, rel);
  if (fs.existsSync(f)) return { j: JSON.parse(fs.readFileSync(f, 'utf8')), src: rel };
  try {
    const txt = cp.execSync('git show origin/claude/a0/b-ites-input:flyDiy/' + rel, { cwd: ROOT, stdio: ['ignore', 'pipe', 'ignore'] }).toString();
    return { j: JSON.parse(txt), src: 'origin/claude/a0/b-ites-input:flyDiy/' + rel };
  } catch (e) { return null; }
}
const PLANES = [
  { id: 'cub',     label: 'Cub (J-3, slightly upgraded)', build: 'builds/cub_2026-09-20_corrected.json', design: 'cub' },
  { id: 'c172',    label: 'Cessna 172',                   build: 'builds/cessna172_2026-09-20_corrected.json', design: 'c172' },
  { id: 'jodel',   label: 'Jodel (as a D115)',            build: 'builds/jodel_2026-09-20_corrected.json', design: 'jodel' },
  { id: 'birdman', label: 'Birdman',                      build: 'builds/candidates/review/birdman.json' },
  { id: 'chinook', label: 'Chinook (the Birdman Chinook)', build: 'builds/chinook_2026-09-21_corrected.json' },
  { id: 'tiger',   label: 'Tiger Moth',                   build: 'builds/candidates/tigermoth_2026-10.json' },
  { id: 'bites',   label: 'B-ITES (user, RV range)',      bites: true },
  { id: 'rv',      label: 'RV-alike (archetype)',         arch: 'rv' },
  { id: 'dc3',     label: 'DC-3',                         build: 'builds/candidates/dc3_2026-10.json' },
  { id: 'caravan', label: 'Caravan-alike (archetype)',    arch: 'caravan' },
  { id: 'c172f',   label: 'Cessna on floats (O-540)',     build: 'bugReports/cessnaFloatsWOrks.json', design: 'c172f' },
  { id: 'pa18f',   label: 'PA-18 on floats',              build: 'builds/pa18_floats_2026-10-23.json' },
  // the economy simulator's own designs (tools/econ_sim.js DESIGN_SRC), so its careers can be re-played at the proposal
  { id: 'rufus',   label: 'Rufus (the starter, econ-sim)', build: 'builds/rufus_2026-10-18_certified.json', econ: 'rufus' },
  { id: 'c172m',   label: 'metal Cessna (econ-sim c172)',  build: 'bugReports/cessnaMetal (1).json', econ: 'c172' },
  { id: 'cjodel',  label: 'composite Jodel (econ-sim)',    build: 'builds/composite_jodel_2026-10-07.json', econ: 'cjodel' },
];

const r100 = v => Math.round(v / 100) * 100;
function priceOne(P, D) {
  let spec, src;
  if (P.arch) { const a = D.ARCHETYPES.find(x => x.key === P.arch); spec = D.designBake(a.sel, a.over); src = 'tools/_cage_design.js ARCHETYPES.' + P.arch; }
  else if (P.bites) { const b = bitesJson(); if (!b) return { id: P.id, label: P.label, skipped: 'B-ITES.json not reachable' }; spec = C.genMigrateSpec(b.j.spec || b.j); src = b.src; }
  else { const j = JSON.parse(fs.readFileSync(path.join(ROOT, P.build), 'utf8')); spec = C.genMigrateSpec(j.spec || j); src = P.build; }
  const S = C.resolveSpec(spec).spec;
  const s = C.genShakedown(C.buildGen(spec), spec);
  const L = s.ledger;
  const sec = k => (L[k] ? L[k].cost : 0), secM = k => (L[k] ? L[k].mass : 0);
  const nEng = (S.engines || []).length || 1;
  const engEach = (S.pplant && S.pplant.price) || 0;
  const propP = (S.prop && S.prop.price) || 0;
  const engStruct = sec('engines') - engEach * nEng - propP;          // the mount, cowl frame, exhaust lump billed by mass
  const SUS = C.GEN_SUSPENSION[S.gear.suspension] || C.GEN_SUSPENSION.bungee;
  const wheelsP = 2 * C.GEN_PRICES.wheel + C.GEN_PRICES.thirdWheel;
  const seatRow = C.GEN_SEATS[(S.outfit && S.outfit.seats)] || C.GEN_SEATS.sling;
  const structKeys = ['fuselage', 'wings', 'bracing', 'tail', 'stol'];
  const structure = structKeys.reduce((a, k) => a + sec(k), 0) + engStruct;
  const structureKg = structKeys.reduce((a, k) => a + secM(k), 0);
  const gearBought = wheelsP + (SUS.price || 0);
  const cat = {
    engine: engEach * nEng, prop: propP,
    structure,                                                         // fuselage + wings + bracing + tail + the mount
    gear: sec('gear'), gearBought, gearStructure: sec('gear') - gearBought,
    panel: sec('panel'), elec: sec('elec'), avionics: sec('avionics'),
    systems: sec('panel') + sec('elec') + sec('avionics'),
    seats: sec('cabin'), outfit: sec('outfit'), furnish: sec('furnish'),
    tank: sec('vessel'), paint: sec('paint'), pod: sec('pod'),
  };
  const ledger = Math.round(s.cost);
  const wants = C.hangarWants(spec);
  // THE GAME'S PRICES OF THIS AEROPLANE
  //   scratchFit   materialised in a fitted main hangar: ledger x labourFit 0.8 (econAirframePrice)
  //   scratchShort materialised in a hangar short of the verb: ledger x 1.0
  //   catalogue    a maker's (PROCURE procurePrice, what the board charges): ledger x PROCURE_MARGIN 1.15;
  //                computed through procurePrice where the design is a catalogue model, else ledger x 1.15
  //   econCat      ECONOMY's econCatalogPrice (ledger x 0.8 x 1.35 = 1.08): a SECOND catalogue rule in the core
  //   used         PROCURE_COND 0.4-0.8 x the catalogue
  let catalogue = r100(ledger * C.PROCURE_MARGIN), catalogueSrc = 'ledger x PROCURE_MARGIN';
  if (P.design) {
    const model = Object.keys(C.PROCURE_MODELS).find(m => { try { return C.procurePrice(m, C.procureDefaults(m)).design === P.design; } catch (e) { return false; } });
    if (model) { catalogue = C.procurePrice(model, C.procureDefaults(model)).total; catalogueSrc = 'procurePrice(' + model + ')'; }
  }
  const prices = {
    ledger,
    scratchFit: C.econAirframePrice(ledger, { kits: ['bench', 'wood', 'metal'] }, wants) ,
    scratchFitRule: r100(ledger * C.PREM_RATES.labourFit),
    scratchShort: r100(ledger * C.PREM_RATES.labourShort),
    catalogue, catalogueSrc,
    econCat: C.econCatalogPrice(ledger),
    usedLo: r100(catalogue * C.PROCURE_COND[0]), usedHi: r100(catalogue * C.PROCURE_COND[1]),
    inCubs: +(ledger / C.econRefPrice()).toFixed(2),
  };
  return {
    id: P.id, label: P.label, src, engine: s.engineName, hp: Math.round(s.hp), nEng,
    prop: s.propName, material: S.material || (spec.fuselage && spec.fuselage.material), wants,
    emptyKg: Math.round(s.empty), loadedKg: Math.round(s.mass), engineKg: Math.round(s.engineMass || 0),
    fuelL: Math.round(s.energyL || 0), seats: S.seats,
    ledgerSections: Object.fromEntries(Object.entries(L).map(([k, v]) => [k, { kg: +v.mass.toFixed(1), cost: Math.round(v.cost), payload: !!v.payload }])),
    cat: Object.fromEntries(Object.entries(cat).map(([k, v]) => [k, Math.round(v)])),
    structureKg: Math.round(structureKg), prices,
  };
}

// ---- the components (the game's catalogue, as the game prices them) ---------------------------------------------
function components() {
  const eng = Object.entries(C.POWERPLANTS).map(([k, v]) => ({ key: k, name: v.engine.name, kW: v.engine.powerW / 1000,
    hp: Math.round(v.engine.powerW / 745.7), kg: v.engine.mass, price: v.price, family: v.engine.family }));
  // the prop law (60_gen_spec genPropSynth): MT.price x blades/2 x (D/1.88)^2 - the cs flag does not enter it
  const propP = (mat, blades, D) => Math.round(C.GEN_PROP_MATS[mat].price * blades / 2 * Math.pow(D / 1.88, 2));
  const propK = (mat, blades, D) => +(blades * C.GEN_PROP_MATS[mat].kg * Math.pow(D / 1.88, 2.5)).toFixed(1);
  const props = [
    ['fixed wood 2-blade 1.88 m (Cub)', 'wood', 2, 1.88], ['fixed alloy 2-blade 1.91 m (C172)', 'alu', 2, 1.91],
    ['composite 3-blade 1.73 m (912 class)', 'carbon', 3, 1.73], ['alloy 2-blade 1.93 m (an RV CS prop: priced as fixed)', 'alu', 2, 1.93],
    ['alloy 3-blade 2.69 m (PT6A-114A, CS)', 'alu', 3, 2.69], ['carbon 3-blade 2.70 m (the Caravan-alike)', 'carbon', 3, 2.70],
    ['alloy 3-blade 3.40 m (R-1830, CS)', 'alu', 3, 3.40],
  ].map(([n, m, b, D]) => ({ name: n, price: propP(m, b, D), kg: propK(m, b, D) }));
  const tank = (key, L) => { const v = C.GEN_VESSELS[key]; return Math.round(v.priceFixed + L * v.price); };
  const fuelP = L => +(L * C.GEN_FUELS.avgas100LL.price).toFixed(0);
  const sysTier = t => { const spec = { systems: { fit: t } }; try { const R = C.genSystemsResolve(Object.assign({}, spec, { fuel: { tanks: 1 } })); return { kg: +R.kg.toFixed(1), price: R.price }; } catch (e) { return null; } };
  return {
    engines: eng,
    customEngineLaw: { 'four 60 kW': C.genEnginePrice('four', 60000), 'four 75 kW': C.genEnginePrice('four', 75000), 'four 112 kW': C.genEnginePrice('four', 112000),
                       'four 134 kW': C.genEnginePrice('four', 134000), 'turbine 503 kW': C.genEnginePrice('turbine', 503000), 'two 48 kW': C.genEnginePrice('two', 48000) },
    props,
    instruments: Object.fromEntries(Object.entries(C.GEN_INSTR).map(([k, v]) => [k, { name: v.name, kg: v.kg, price: v.price }])),
    elec: C.GEN_ELEC, avionics: C.GEN_AVIONICS,
    systemTiers: { minimal: sysTier('minimal'), basic: sysTier('basic'), ifr: sysTier('ifr') },
    wheels: { wheelEach: C.GEN_PRICES.wheel, thirdWheel: C.GEN_PRICES.thirdWheel, suspension: C.GEN_SUSPENSION, fairings: { spat: C.GEN_PRICES.spat, trouser: C.GEN_PRICES.trouser, legFair: C.GEN_PRICES.legFair } },
    seats: { cabinLinePerSeat: C.GEN_PRICES.seat, rows: C.GEN_SEATS },
    paint: { full: C.GEN_PRICES.paintJob, bare: 0 },
    tanks: { 'alu 44 L (a Cub)': tank('alu', 44), 'alu 100 L': tank('alu', 100), 'wet 200 L (an RV)': tank('wet', 200),
             'wet 1257 L (a Caravan)': tank('wet', 1257), 'alu 3000 L (a DC-3)': tank('alu', 3000),
             fuelFirstFillPerL: C.GEN_FUELS.avgas100LL.price, 'first fill 44 L': fuelP(44) },
    materials: Object.fromEntries(Object.entries(C.GEN_MATERIALS).map(([k, v]) => [k, { name: v.name, pricePerKg: v.price }])),
    floats: 'no row: a float pair is billed by its shell mass x the airframe material (the gear section), no bought price',
    skis: 'no row: 25_airfield knows the word skis, the frame neither weighs nor prices them',
    lights: 'no row: GEN_LIGHT_AMPS draws amps, nothing prices or weighs a lamp',
    interior: 'GEN_SEATS rows + 60 cr/kg of furnishing (61_gen_frame outfit/furnish) + the cabin line 380 a seat',
  };
}

// ---- THE REAL SIDE: USD, 2025-26 (sources in PRICE-STUDY-2026-11.md; EUR/GBP converted at 1.08 / 1.27) ----------
// Each plane: plans (pure homebuilt: materials + engine + avionics, no labour), kit (airframe kit + engine + prop +
// avionics to fly), fac (new factory list, or USED market mid where none is made), hours (builder hours, plans route).
// Each range is [lo, hi]; the fit uses the geometric mid.
// components: [name, game credits (read from the core where a row exists, see compGame), real [lo, hi], basis]
// basis: new | oh (overhauled / exchange, the game's engines are "second-hand, installed") | used | exp (experimental,
// non-TSO) | tso. Ranges from search results of dealer pages (Aircraft Spruce, Air Power, Motive, Univair, Van's,
// Sarasota Avionics, P&WC flat-rate pages, afors.uk / Barnstormers / Controller listings): see the report.
const REAL_COMPONENTS = [
  // engines
  ['Continental A-65',            'eng:a65_sensenich74',     [9.5e3, 13e3],  'oh', 'shop overhaul ~9.5k before accessories; mid-time used 3-3.5k'],
  ['Rotax 582 (with gearbox)',    'eng:rotax582_ivo',        [8.2e3, 9.5e3], 'new', 'GBP 7 500 new boxed (UK 2025); AUD dealer ~8.2k ex GST'],
  ['Rotax 503',                   'eng:rotax503_wood',       [4.5e3, 5e3],   'oh', 'out of production; zero-time rebuild ~4.8k'],
  ['Rotax 912 UL / ULS',          'eng:rotax912_warp',       [20.6e3, 23.7e3], 'new', 'Motive / Six Chuter retail 2024-25'],
  ['Rotax 915 iS',                'eng:rotax915_carbon',     [48.5e3, 55e3], 'new', 'Motive retail (no exhaust, no alternator)'],
  ['Rotax 916 iS',                'eng:rotax916_carbon',     [51e3, 60e3],   'new', 'flying411; AUD dealer'],
  ['Continental O-200',           'eng:o200_eprops',         [40e3, 47.5e3], 'oh', 'Air Power O-200-A rebuilt 47.5k; new O-200-D 46.7k'],
  ['Lycoming O-320 (150/160 hp)', 'eng:o320_mccauley',       [48e3, 56e3],   'oh', 'factory overhaul / rebuilt exchange 2024; used reman 32k'],
  ['Lycoming IO-360 (180 hp)',    'eng:io360_mccauley',      [48e3, 56e3],   'oh', 'overhaul / rebuilt exchange; new 75-88k; Superior XP kit 31-55k'],
  ['Lycoming O-540',              'eng:o540_hartzell',       [61e3, 67e3],   'oh', 'factory overhaul exchange 2024; new 117k'],
  ['DH Gipsy Major',              'eng:gipsymajor1_wood',    [43e3, 70e3],   'oh', 'GBP 34-55k zero-timed / overhauled asking'],
  ['P&W R-985',                   'eng:r985_hs2b20',         [45e3, 60e3],   'oh', 'ESTIMATE (no published figure; R-1340 forum scaling)'],
  ['P&W R-1830',                  'eng:r1830_hs23e50',       [60e3, 100e3],  'oh', 'ESTIMATE (no reliable published figure)'],
  ['P&W PT6A-114A',               'eng:pt6a114a_hartzell3',  [350e3, 433e3], 'oh', 'P&WC flat rate 2025 (capped 433k); 2026 382-472k; exchange ~590k'],
  ['P&W PT6A-34',                 'eng:pt6a34_hartzell4',    [387e3, 455e3], 'oh', 'P&WC flat rate 2026'],
  ['P&W PT6A-42',                 'eng:pt6a42_hartzell4',    [420e3, 489e3], 'oh', 'P&WC flat rate 2026'],
  // props
  ['prop: fixed wood, Cub',       'prop:wood:2:1.88',        [3.5e3, 4.4e3], 'new', 'Sensenich W72 (Univair)'],
  ['prop: fixed metal, C172',     'prop:alu:2:1.91',         [8.2e3, 10.8e3], 'new', 'Sensenich 74DM6 / McCauley 1C160'],
  ['prop: ground-adj. composite 3-blade (912)', 'prop:carbon:3:1.73', [1.3e3, 4.4e3], 'new', 'Warp Drive 1.3k, E-Props EUR 1.5k, IVO 3.4-4.4k'],
  ['prop: constant speed 2-blade (IO-360)', 'prop:alu:2:1.93', [10.5e3, 11.8e3], 'new', 'Hartzell via Van\'s ~10.5k + governor ~1.25k; the game prices it as fixed'],
  ['prop: turboprop 3-blade (PT6A)', 'prop:alu:3:2.69',      [18.5e3, 45e3], 'new', '18.5-19.9k old Hartzell kit price; 30-45k ESTIMATE today'],
  // instruments (the game's rows are 'experimental / non-TSO new' or 'TSO' per the PANEL arc's notes)
  ['airspeed indicator',          'instr:asi',               [254, 374],     'exp', 'Swift 2 1/4 in; TSO 1.2-1.6k'],
  ['altimeter',                   'instr:alt',               [429, 1200],    'exp', 'Winter 2 1/4 in to 3 in 20k ft'],
  ['attitude, vacuum',            'instr:ai',                [1487, 2495],   'tso', 'Falcon to Sigma-Tek 5000B'],
  ['attitude, electric',          'instr:aiE',               [893, 4195],    'exp', 'non-TSO ~0.9k; TSO Mid-Continent 4.2k+'],
  ['directional gyro',            'instr:dg',                [675, 893],     'exp', 'non-TSO vacuum'],
  ['turn coordinator',            'instr:turn',              [1195, 1325],   'tso', 'RC Allen 82A'],
  ['compass',                     'instr:compass',           [455, 883],     'new', 'Airpath C2400'],
  ['vacuum pump',                 'elec:vac:pump',           [553, 809],     'new', 'Rapco overhauled / new'],
  // electrics
  ['battery, lead (PC680)',       'elec:battery:lead',       [183, 281],     'new', 'Van\'s / Spruce'],
  ['battery, lithium',            'elec:battery:lithium',    [379, 450],     'new', 'EarthX ETX680C'],
  ['alternator 60 A',             'elec:alternator:alt60',   [1057, 1287],   'new', 'Plane-Power'],
  ['starter',                     'elec:starter:yes',        [1086, 1120],   'new', 'Sky-Tec'],
  ['wiring harness',              'elec:harness',            [500, 3000],    'new', 'ESTIMATE (parts, homebuilt)'],
  // avionics
  ['VHF COM',                     'av:com:compact',          [1364, 2110],   'new', 'GTR 200 / Trig TY91'],
  ['Mode-S transponder',          'av:xpdr:modeS',           [3053, 3893],   'new', 'Trig TT21 / GTX 335 ADS-B'],
  ['VOR nav (used KX 155)',       'av:nav:vor',              [1995, 3000],   'used', 'Controller listings'],
  ['portable GPS',                'av:gps:portable',         [849, 1549],    'new', 'aera 660 / 760'],
  ['panel GPS',                   'av:gps:panel',            [4995, 7995],   'new', 'GPS 175 / GNX 375'],
  ['glass EFIS 7 in',             'av:gps:glass',            [3360, 6500],   'new', 'G3X Touch / SkyView HDX display; with ADAHRS ~6-7k'],
  // gear
  ['main wheel + tyre + brake, each', 'gear:wheel',          [680, 900],     'new', 'Matco 5.00-5 pair 1 096 + a tyre 254-294'],
  ['tailwheel assembly',          'gear:thirdWheel',         [1000, 1410],   'new', 'ABI / Scott 3200 PMA; used ~GBP 1 000'],
  ['bungee set (Cub)',            'gear:sus:bungee',         [200, 260],     'new', 'Univair, sold singly 49-65 (ESTIMATE for the set)'],
  ['spring-steel gear legs',      'gear:sus:spring',         [2000, 2500],   'new', 'Grove / LGC (old figure)'],
  ['floats, Cub/C172 class pair', 'floats',                  [27e3, 50e3],   'new', 'Aerocet 2200 straight ~27.5k; Wipline 2100 amphib ~50k; XCub straight 45k / amphib 70k; used EDO 2000 ~19k'],
  ['skis, Cub class pair',        'skis',                    [3e3, 9.5e3],   'new', 'Summit carbon 4.9k; Federal wheel-ski 8.8-9.5k'],
  // finish, interior, tanks, lights
  ['paint, C172 professional',    'paint',                   [7e3, 15e3],    'new', 'strip and paint 2025'],
  ['interior, C172 professional', 'interior:c172',           [14e3, 20e3],   'new', 'DIY kit 3-8k'],
  ['fuel tank, Cub/PA-18 class',  'tank:alu:44',             [400, 2274],    'new', 'used J-3 tank ~400; new PA-18 wing tank 2 274'],
  ['nav/strobe LED pair',         'lights',                  [1190, 1900],   'new', 'AeroLEDs Pulsar'],
  ['fabric covering materials, Cub', 'cover:cub',            [3e3, 6e3],     'new', 'Poly-Fiber / Stewart / Oratex; a professional recover 20-40k'],
];
const REAL = {
  components: REAL_COMPONENTS,
  planes: {
    cub:     { plans: [35e3, 60e3], kit: [80e3, 140e3], fac: [45e3, 65e3], facWhat: 'USED airworthy J-3, US and continental Europe alike (EUR 47-60k), 2024-26 asking; restored 70-100k; a 20-30 % Cub collector premium is in it',
               newCub: [250e3, 295e3], newWhat: 'NEW Cub-class: American Legend AL3 2025 ~252-272k, Carbon Cub UL ~294k',
               plansWhat: 'ESTIMATE: tube, fabric, spruce, hardware 15-25k + an overhauled C85/O-200 20-30k + a basic panel 5-8k',
               kitWhat: 'ESTIMATE: Wag-Aero quickbuild class airframe + engine + panel; a Backcountry Super Cub kit alone is 95.8k', hours: [700, 3000] },
    c172:    { fac: [499e3, 580e3], facWhat: 'NEW 172S list (Textron 2023 499k; 2026 MSRP ~580k)', used: [95e3, 150e3], usedWhat: 'used 1970s 172M/N: Europe EUR 80-110k, US 120-150k typical' },
    jodel:   { plans: [25e3, 45e3], fac: [20e3, 35e3], facWhat: 'USED D11/D112/D117 typical in Europe (EUR 12-38k asking, UK GBP 9-24k); no factory price found',
               plansWhat: 'ESTIMATE: wood, ply, fabric, hardware 6-12k + an overhauled C90/O-200 15-30k + a basic panel 5k', hours: [1500, 2500] },
    chinook: { kit: [20e3, 36e3], kitWhat: '2009 kit list: 1S/2S with a 503 ~20k, Plus 2 with a 912 27.5-36k (out of production)', fac: [10e3, 15e3], facWhat: 'USED Chinook Plus 2 (CAD 12-16k; US dealer 20-27.5k refurbished)' },
    tiger:   { fac: [80e3, 170e3], facWhat: 'USED DH.82A: GBP 60-75k flying (UK), 170k restored (US); AUD 99-105k sold' },
    bites:   { kit: [150e3, 190e3], kitWhat: 'RV-7/-8 airframe kit 48-50k + FWF 12k + IO-360 39-56k + CS prop ~10k + VFR panel 10-20k + paint/interior (ESTIMATE total); single-seat RV-3B kit 28k', fac: [130e3, 160e3], facWhat: 'USED flying RV-7A / RV-8', hours: [1500, 2500] },
    rv:      { kit: [150e3, 190e3], kitWhat: 'as B-ITES', fac: [130e3, 160e3], facWhat: 'USED flying RV-7A / RV-8', hours: [1500, 2500] },
    dc3:     { fac: [230e3, 600e3], facWhat: 'USED airworthy DC-3 / C-47 listings 2024-26 (a BT-67 turbine conversion is 9-16M)' },
    caravan: { fac: [2.6e6, 2.9e6], facWhat: 'NEW 208B Grand Caravan EX (Textron 2.685M, 2023; 2025-26 not confirmed)', used: [0.7e6, 1.5e6], usedWhat: 'used 2000s 208B' },
  },
};

// ---- the fit -------------------------------------------------------------------------------------------------------
const gmid = r => Math.sqrt(r[0] * r[1]);
function fitRate(pairs) {   // pairs [{game, real}] -> the single credit->USD factor k minimising sum (ln(real) - ln(k game))^2
  const lk = pairs.reduce((a, p) => a + Math.log(p.real / p.game), 0) / pairs.length;
  const k = Math.exp(lk);
  const res = pairs.map(p => Object.assign({}, p, { ratio: +(p.real / (k * p.game)).toFixed(2) }));
  const rms = Math.sqrt(res.reduce((a, p) => a + Math.pow(Math.log(p.ratio), 2), 0) / res.length);
  return { k: +k.toFixed(3), rmsFactor: +Math.exp(rms).toFixed(2), res };
}

// the game's credits for a REAL_COMPONENTS key (planes: the computed plane rows, for the per-plane items)
function compGame(key, planes) {
  const [k, a, b, c] = key.split(':');
  const pl = id => planes.find(p => p.id === id);
  if (k === 'eng') return C.POWERPLANTS[a].price;
  if (k === 'prop') return Math.round(C.GEN_PROP_MATS[a].price * (+b) / 2 * Math.pow((+c) / 1.88, 2));
  if (k === 'instr') return C.GEN_INSTR[a].price;
  if (k === 'elec') return a === 'harness' ? C.GEN_ELEC.harness.price : C.GEN_ELEC[a][b].price;
  if (k === 'av') return C.GEN_AVIONICS[a][b].price;
  if (k === 'gear') return a === 'sus' ? C.GEN_SUSPENSION[b].price : C.GEN_PRICES[a];
  if (k === 'floats') { const f = pl('c172f_delta'); return f ? f.gearDelta : null; }
  if (k === 'paint') return C.GEN_PRICES.paintJob;
  if (k === 'interior') { const p = pl('c172'); return p ? p.cat.furnish + p.cat.seats : null; }
  if (k === 'tank') { const v = C.GEN_VESSELS[a]; return Math.round(v.priceFixed + (+b) * v.price); }
  if (k === 'cover') { const p = pl('cub'); return p ? p.coverCr : null; }
  return null;   // skis, lights: no row
}
// what a float pair adds: the validated Cessna-on-floats build against itself on wheels (same spec, gear swapped)
function floatDelta() {
  const j = JSON.parse(fs.readFileSync(path.join(ROOT, 'bugReports/cessnaFloatsWOrks.json'), 'utf8'));
  const spec = C.genMigrateSpec(j.spec || j);
  const a = C.genShakedown(C.buildGen(spec), spec);
  const sp2 = JSON.parse(JSON.stringify(spec)); sp2.gear.type = 'tricycle'; delete sp2.gear.floats;
  const b = C.genShakedown(C.buildGen(sp2), sp2);
  return { id: 'c172f_delta', gearDelta: Math.round(a.ledger.gear.cost - b.ledger.gear.cost), gearKgDelta: Math.round(a.ledger.gear.mass - b.ledger.gear.mass),
           totalDelta: Math.round(a.cost - b.cost), emptyDelta: Math.round(a.empty - b.empty) };
}

// ---- THE PROPOSAL (nothing applied to the game: patched on THIS process's copy of the core, then measured) --------
// At the study's rate (1 credit = RATE USD), each outlier is moved to real/RATE. Data rows are patched in place
// (the frame reads the same objects); the rules that live in code (paint per m2, furnishing per kg, the cover per m2,
// floats, lights, the twin's second prop) are added as analytic deltas off the ledger's own masses.
const RATE = 1.5;
const PROPOSAL = {
  data: [
    ['GEN_PROP_MATS.wood.price', 900, 2600], ['GEN_PROP_MATS.alu.price', 2200, 6000], ['GEN_PROP_MATS.carbon.price', 5200, 2000],
    ['GEN_PRICES.wheel', 320, 550], ['GEN_PRICES.thirdWheel', 260, 800], ['GEN_SUSPENSION.spring.price', 900, 1500],
    ['GEN_ELEC.harness.price', 250, 800], ['GEN_INSTR.compass.price', 300, 450],
    ['POWERPLANTS.o200_eprops.price', 24000, 29000], ['POWERPLANTS.o320_mccauley.price', 28000, 34000],
    ['POWERPLANTS.gipsymajor1_wood.price', 26000, 37000],
  ],
  code: {
    paintPerM2: 120,          // GEN_FINISH.full: 1 800 flat -> 120 cr per m2 painted (the area: paint kg / 0.12 kg/m2)
    furnishPerKg: 240,        // 61_gen_frame outfit: 60 -> 240 cr a kilo of furnishing
    coverPerM2: 50,           // tube+fabric / aluTube covering, a fabric system's materials: 50 cr per m2 on top of the row
    floatsPerKgGross: 24,     // a float pair: 24 cr per kg of the gross it is sized for (Cub 800 kg ~19 200, C172 1 090 ~26 200)
    lights: 1000,             // a nav/strobe set + a landing light, on any aeroplane with a bus
    csHub: 1000,              // a constant-speed hub and governor (engine.cs), on top of the blades
    propPerEngine: true,      // 61_gen_frame: spend(S.prop.price) once -> once per engine (the DC-3 billed one prop)
    seatLine: 0,              // GEN_PRICES.seat 380 (a second seat line beside GEN_SEATS) -> 0
  },
};
function setPath(root, p, v) { const ks = p.split('.'); let o = root; for (let i = 0; i < ks.length - 1; i++) o = o[ks[i]]; const old = o[ks[ks.length - 1]]; o[ks[ks.length - 1]] = v; return old; }
function proposalPass(D, planesNow) {
  const olds = PROPOSAL.data.map(([p, , v]) => [p, setPath(C, p, v)]);
  try {
    return planesNow.filter(p => p.prices).map(p0 => {
      const P = PLANES.find(x => x.id === p0.id);
      const p1 = priceOne(P, D);
      const X = PROPOSAL.code, L = p1.ledgerSections;
      const paintM2 = L.paint ? L.paint.kg / 0.12 : 0;
      const d = {};
      d.paint = Math.round(X.paintPerM2 * paintM2 - C.GEN_PRICES.paintJob);
      d.furnish = Math.round((X.furnishPerKg - 60) * (L.furnish ? L.furnish.kg : 0));
      d.cover = /tube|aluTube/i.test(p1.material || '') ? Math.round(X.coverPerM2 * paintM2) : 0;
      const floats = p0.id === 'c172f' || p0.id === 'pa18f';
      d.floats = floats ? Math.round(X.floatsPerKgGross * p1.loadedKg) : 0;
      d.lights = (L.elec && L.elec.cost > 0) ? X.lights : 0;
      d.cs = /PT6/.test(p1.engine) ? X.csHub * p1.nEng : 0;
      d.prop2 = X.propPerEngine ? p1.cat.prop * (p1.nEng - 1) : 0;
      d.seatLine = -(C.GEN_PRICES.seat - X.seatLine) * Math.round((L.cabin ? L.cabin.cost : 0) / C.GEN_PRICES.seat);
      const ledger = p1.prices.ledger + Object.values(d).reduce((a, b) => a + b, 0);
      return { id: p0.id, label: p0.label, ledgerNow: p0.prices.ledger, ledgerData: p1.prices.ledger, codeDeltas: d, ledger,
               factor: +(ledger / p0.prices.ledger).toFixed(3), catalogue: r100(ledger * C.PROCURE_MARGIN), scratchFit: r100(ledger * C.PREM_RATES.labourFit) };
    });
  } finally { for (const [p, v] of olds) setPath(C, p, v); }
}

function main() {
  const D = loadDesign();
  const planes = PLANES.map(P => { try { return priceOne(P, D); } catch (e) { return { id: P.id, label: P.label, error: e.message }; } });
  const comps = components();
  const fd = floatDelta();
  comps.floatPairOnTheCessna = fd;
  // the Cub's covering, in credits: its covered area x the tube+fabric row's covering kg/m2 x the row's price a kilo
  // (the ledger bills covering by mass inside each section's structure; this is that share, recomputed)
  { const cub = planes.find(p => p.id === 'cub'); if (cub) { const m = C.GEN_MATERIALS.tubeFabric; cub.coverCr = Math.round(51 * m.cover * m.price); cub.coverNote = '51 m2 (HANDOVER G159: the Cub covers 51 m2) x ' + m.cover + ' kg/m2 x ' + m.price + ' cr/kg'; } }
  const compRows = REAL_COMPONENTS.map(([name, key, real, basis, note]) => {
    const game = compGame(key, planes.concat([fd]));
    return { name, key, game, real, basis, note, ratio: game ? +(gmid(real) / game).toFixed(2) : null };
  });
  comps.benchmark = compRows;
  // plane-level ratios: real / game, for each route against its natural game price
  //   plans  -> scratch (fitted, 0.8)       kit -> scratch short (1.0)      fac -> catalogue (1.15)
  const ratios = [];
  for (const p of planes) {
    const R = REAL.planes[p.id]; if (!R || !p.prices) continue;
    const row = { id: p.id, label: p.label, game: { scratchFit: p.prices.scratchFitRule, scratchShort: p.prices.scratchShort, catalogue: p.prices.catalogue, usedLo: p.prices.usedLo, usedHi: p.prices.usedHi } };
    if (R.plans) row.plans = { real: R.plans, ratio: +(gmid(R.plans) / p.prices.scratchFitRule).toFixed(2) };
    if (R.kit) row.kit = { real: R.kit, ratio: +(gmid(R.kit) / p.prices.scratchShort).toFixed(2) };
    if (R.fac) row.fac = { real: R.fac, what: R.facWhat, ratio: +(gmid(R.fac) / p.prices.catalogue).toFixed(2) };
    if (R.newCub) row.newCub = { real: R.newCub, ratio: +(gmid(R.newCub) / p.prices.catalogue).toFixed(2) };
    if (R.used) row.used = { real: R.used, ratio: +(gmid(R.used) / gmid([p.prices.usedLo, p.prices.usedHi])).toFixed(2) };
    ratios.push(row);
  }
  // the plane fit: the 'fac' route (what a buyer pays), every plane with one
  const facFit = fitRate(ratios.filter(r => r.fac).map(r => ({ id: r.id, game: r.game.catalogue, real: gmid(r.fac.real) })));
  const out = { what: 'PRICE-STUDY 2026-11-04: the game prices (credits) off tools/flight_core.js, the real benchmark (USD 2025-26)',
                date: '2026-11-04', core: 'tools/flight_core.js', refCub: C.econRefPrice(), planes, components: comps, real: REAL, ratios, facFit };
  // print
  console.log('PLANE                              engine                     hp  empty  ledger  scratch0.8  catalogue  used');
  for (const p of planes) {
    if (!p.prices) { console.log(p.label, p.skipped || p.error); continue; }
    console.log(p.label.padEnd(34), (p.engine + ' x' + p.nEng).slice(0, 26).padEnd(26), String(p.hp).padStart(4), String(p.emptyKg).padStart(6),
      String(p.prices.ledger).padStart(8), String(p.prices.scratchFitRule).padStart(10), String(p.prices.catalogue).padStart(10), p.prices.usedLo + '-' + p.prices.usedHi);
    console.log('    cat:', Object.entries(p.cat).filter(([, v]) => v).map(([k, v]) => k + ' ' + v).join(' · '));
  }
  console.log('\nCOMPONENTS real(USD mid) / game(credits):');
  for (const r of compRows) console.log('  ' + r.name.padEnd(44), String(r.game == null ? '-' : r.game).padStart(7), (r.real[0] + '-' + r.real[1]).padStart(16), r.basis.padEnd(4), r.ratio == null ? 'no row' : r.ratio);
  const compFit = fitRate(compRows.filter(r => r.game).map(r => ({ id: r.name, game: r.game, real: gmid(r.real) })));
  console.log('  component fit: 1 credit =', compFit.k, 'USD, rms factor', compFit.rmsFactor);
  out.compFit = compFit;
  console.log('\nRATIOS real(USD) / game(credits):');
  for (const r of ratios) console.log(r.label.padEnd(34), ['plans', 'kit', 'fac', 'newCub', 'used'].filter(k => r[k]).map(k => k + ' ' + r[k].ratio).join('  '));
  console.log('\nfactory/used fit: 1 credit =', facFit.k, 'USD, rms factor', facFit.rmsFactor, facFit.res.map(x => x.id + ' ' + x.ratio).join(' '));
  // the proposal, measured
  const prop = proposalPass(D, planes);
  out.proposal = { rate: RATE, table: PROPOSAL, planes: prop };
  // THE THREE ROUTES (the user, 4 Nov): build it (the maker way), buy it used (pre-built, certified, where it
  // stands), sell it. Today's rules + the proposed sale rule, on today's and on the proposed ledgers.
  //   build    ledger x labourFit 0.8 (a fitted main hangar) / x labourShort 1.0
  //   used     catalogue (ledger x PROCURE_MARGIN 1.15) x condition PROCURE_COND 0.4-0.8 = ledger x 0.46-0.92
  //   occasion the story's: catalogue x 0.35 = ledger x 0.40 (one-time listings)
  //   SELL (proposed, not in the game): min(SELL_K x the listing price at the airframe's condition, what it cost the
  //            player: career.airframes[slot].paid). A fleet airframe's condition: 0.8 less 0.08 a repair, floor 0.4
  //            (no hours are kept). Story airframes (the Rufus, the gifted Cub: paid 0) sell for nothing.
  const SELL_K = 0.75;
  const routesOf = L => {
    const cat = L * C.PROCURE_MARGIN, scratch = L * C.PREM_RATES.labourFit;
    return { buildFit: r100(scratch), buildShort: r100(L), usedLo: r100(cat * C.PROCURE_COND[0]), usedHi: r100(cat * C.PROCURE_COND[1]),
             occasion: r100(cat * 0.35), sellOwnBuild: r100(Math.min(SELL_K * cat * C.PROCURE_COND[1], scratch)),
             sellUsedMid: r100(Math.min(SELL_K * cat * 0.6, cat * 0.6)) };
  };
  out.routes = { sellK: SELL_K, rule: 'sale = min(SELL_K x listing(condition), paid)', planes: planes.filter(p => p.prices).map(p => {
    const q = prop.find(r => r.id === p.id);
    return { id: p.id, label: p.label, now: routesOf(p.prices.ledger), proposed: q ? routesOf(q.ledger) : null };
  }) };
  console.log('\nTHE THREE ROUTES (proposed ledgers): build fit/short | used | occasion | sell own build | sell a used one (cond 0.6)');
  for (const r of out.routes.planes) if (r.proposed) { const x = r.proposed;
    console.log('  ' + r.label.padEnd(34), x.buildFit + ' / ' + x.buildShort, '|', x.usedLo + '-' + x.usedHi, '|', x.occasion, '|', x.sellOwnBuild, '|', x.sellUsedMid); }
  console.log('\nPROPOSAL (at 1 credit =', RATE, 'USD; nothing applied): ledger now -> proposed');
  for (const r of prop) console.log('  ' + r.label.padEnd(34), String(r.ledgerNow).padStart(7), '->', String(r.ledger).padStart(7), ' x' + r.factor, ' catalogue', r.catalogue, '  deltas', JSON.stringify(r.codeDeltas));
  const cubF = (prop.find(r => r.id === 'cub') || {}).factor;
  // first-order career: everything ECON_BOOK prices is in Cubs (moves with the Cub's ledger); what is absolute does not
  const abs = { CAREER_GRANT: C.CAREER_GRANT, STORY_T6_FEE: C.STORY_T6_FEE, 'CONTRACT_PAY.perKm': C.CONTRACT_PAY.perKm,
                'CONTRACT_PAY.surf.short': C.CONTRACT_PAY.surf.short, 'ROUTES_PAY.perKm': C.ROUTES_PAY.perKm };
  out.proposal.career = { cubFactor: cubF, cubLedgerNow: C.econRefPrice(), cubLedgerProposed: Math.round(C.econRefPrice() * cubF),
    scalesWithCub: ['ECON_BOOK.shells', 'KIT_PRICES', 'signOn', 'landmarks', 'rungs', 'comps'], absolute: abs,
    paceIfPayHeld: { cubClass: +(3 * cubF).toFixed(1), seat4: +(8 * ((prop.find(r => r.id === 'c172') || {}).factor || 1)).toFixed(1), hangar1: +(11 * cubF).toFixed(1) },
    note: 'ECON-SIM G3250 measured (proposed table, 20 seeds): Cub-class 3 contracts, 4-seater 8, side hangar 11. Pace scales with price / pay to first order.' };
  console.log('  career: the Cub ledger', C.econRefPrice().toFixed(0), '->', out.proposal.career.cubLedgerProposed, '(x' + cubF + '); pace if pay held', JSON.stringify(out.proposal.career.paceIfPayHeld), 'absolute', JSON.stringify(abs));
  if (!process.argv.includes('--no-write')) {
    fs.writeFileSync(path.join(__dirname, 'price_study_data.json'), JSON.stringify(out, null, 1));
    console.log('wrote', path.relative(ROOT, path.join(__dirname, 'price_study_data.json')));
  }
}
main();
