// ===========================================================================
// PROCUREMENT (G2280 PROCURE) — the three routes to an aeroplane in one pure
// file: the MAKERS' catalogues over the validated builds (an options sheet
// per model, priced, factory-certified, delivered to a hangar of yours), the
// DRAWING BOARD (designs vs airframes) and the USED MARKET (seeded listings,
// each standing at an aerodrome, bought where it stands).
// futureDesigns/GAME-2026-10-06.md §R (binding: GQ2 the options sheet and
// "modified", G-DESIGN, GQ5 a free "bring it home", GQ12 found aeroplanes
// later, GQ20 fictional organisations), §5.1-§5.4.
// ===========================================================================
// THE RULES THIS FILE HOLDS (GATE PROCURE, tools/_procure_check.js, proves each):
//   VALIDATED ONLY  a model's every design is one of CONTRACT_DESIGNS' five (the user's validated builds, 1 Oct;
//                   72_contract_data.js, re-derived from the files by GATE CONTRACTS). procureCatalogue() filters on
//                   it again, so an unvalidated archetype never reaches a screen even if a row slips into the data.
//   THE OPTIONS     every option value writes EXISTING spec rows — the rows the editor's join reads back, so a bought
//                   aeroplane is the same aeroplane after the garage opens it (the engine: cage.engPreset + the
//                   registry row in spec.engines, _cage_join.js's CAGE_JOIN_ENGINES; the tank: energy.vessels[0]
//                   (capacity, and its drawn box scaled with it); the seats: cage.paxAbreast + the cabin's seat
//                   list; the gear: the other validated BUILD (wheels / floats), or the tyre rows (s1R, whProfile)
//                   + gear.wheelR; the avionics: systems.fit (GEN_SYSTEMS' tiers); the finish: finish.sections'
//                   tints; the registration: meta.reg). A customised model is an ordinary spec.
//   THE PRICE       ECONOMY (G2260) owns the price book: every price is asked of `econPrice(kind, item)` when that
//                   function exists, else of procureEconStub (same signature, this file's stand-in: the ledger ×
//                   the maker's margin, rounded to 100). The option rows carry their MEASURED ledger delta (`eff`),
//                   so the stub needs no simulation.
//   CERTIFIED       a model arrives with its certificate: the validated design's numbers (CONTRACT_DESIGNS) plus
//                   each chosen option's MEASURED effect (`eff`, genShakedown on the file with that one option —
//                   GATE PROCURE re-derives every one) — exact for the stock model and any one option, the sum of
//                   the effects for several (the gate holds the sum within its tolerance of the measured combination).
//   MODIFIED        the certificate is signed by procureFp (the bench's rule: the spec minus its cosmetic blocks, the
//                   GEN_SPEC_V / PHYSICS_V tag folded in); a saved spec under another fingerprint is MODIFIED - the
//                   factory certificate withdrawn, the change billed at build price (dm11: every ledger line the
//                   edit rebuilt, at its own build price). Paint and registration change nothing.
//   THE BOARD       designs = the flydiy.build.* slots read as a library (free, shared by the sandbox and careers);
//                   airframes = the career's `airframes` rows over the fleet ledger (PREM-S2). "Build this design"
//                   makes an airframe (the ledger's price through econPrice), "Save as design" files an airframe's
//                   spec. In the sandbox every slot is both (nothing changes there).
//   THE USED MARKET listings = f(career seed, epoch = floor(completed / 3)) — FNV-1a + mulberry32 (73_'s contractRng),
//                   at most 4; each a validated model with seeded variations (hours and a past repair: words and
//                   price only; an older avionics tier and +0-15 kg carried: real spec rows; the paint, the
//                   registration, a seller line), standing at an aerodrome it can fly from (73_'s gear / strip
//                   rules on its own certificate), priced catalogue × condition (0.4-0.8).
//   BUYING          a maker's model is delivered to the main hangar or a side hangar of yours (a delivery fee for a
//                   side hangar); a used one becomes an airframe STATIONED WHERE IT STOOD (playerArrive: 'away'
//                   where you hold nothing there), to be flown home or brought home (free, GQ5). The career pays
//                   (the ledger line `buy`); the sandbox takes it free (the line written at its would-be price,
//                   `free`, as playerCharge records any sandbox cost). The voucher (GQ23) pays for one stock Cub.
//
// Pure: no DOM, no storage, no clock, no random (the gate scans for each). The page (app.js, map_menu.js) hands in
// the build files' specs, the slot names and the ledgers it measured.
// ===========================================================================
const PROCURE_V = 1;
const PROCURE_MARGIN = 1.15;           // a maker's margin over the ledger (§5.2: a scratch build is ×0.75 of it)
const PROCURE_USED_MAX = 4;            // at most four listings at once
const PROCURE_USED_EVERY = 3;          // refreshed after every three completed contracts (CONTRACT_GEN.refreshEvery)
const PROCURE_COND = [0.4, 0.8];       // a used aeroplane's price: catalogue × condition
const PROCURE_DELIVERY = { main: 0, side: 400, perKm: 25 };   // a maker's delivery to a side hangar (the stub's)
const PROCURE_COSMETIC = ['paint', 'finish', 'meta'];          // bench.js BENCH_COSMETIC
// ...and the READOUTS the editor derives a frame after a load: `fuel` (the energy arc's legacy litres, re-derived from
// energy.vessels by the energy layer - measured on the page, G2280: the stock Cub's 45 came back 29 a frame after the
// load with no edit). A readout is not a choice, so it never signs or withdraws a certificate.
const PROCURE_READOUTS = ['fuel'];
const PROCURE_LOOK = { energy: ['finish', 'hue', 'tint'], vessel: ['finish', 'hue', 'tint'], systems: ['look'] };
const PROCURE_STATE_ROWS = /^_view|^(explodeD|dumOn|cabOcc|paxOcc\d+|lightOn|li_reflect|li_beaconRpm|accDetail)$/;
const prClone = o => JSON.parse(JSON.stringify(o));
const prNo = (doc, why) => ({ ok: false, doc, why });
const prR100 = n => Math.round((+n || 0) / 100) * 100;

// ---- THE TEXT (keys; plain DRAFT English beside each — the narrative pack replaces it, the keys stay) -------
const PT_ = t => ({ t, draft: true });
const PROCURE_TEXT = {
  // the makers (GQ20: fictional organisations; no real brand: the gate holds every word against CONTRACT_CONFIG_WORDS)
  'mk.bramble.name':   PT_('Bramble Light Aircraft'),
  'mk.bramble.line':   PT_('Fabric over steel tube, built for short fields and long days. Two seats, one behind the other.'),
  'mk.vernier.name':   PT_('Ateliers Vernier'),
  'mk.vernier.line':   PT_('A wood shop that builds aeroplanes: light, quick and kind to its pilot.'),
  'mk.northline.name': PT_('Northline Aero'),
  'mk.northline.line': PT_('Metal four-seaters for real work, on wheels or on water.'),
  'mk.driftwood.name': PT_('Driftwood Ultralights'),
  'mk.driftwood.line': PT_('Two small engines, one seat and a pair of floats: the bay is the runway.'),
  // the models
  'mdl.scout.name':    PT_('Bramble Scout'),
  'mdl.scout.line':    PT_('The two-seat bush hauler: slow, forgiving, at home on gravel.'),
  'mdl.pinson.name':   PT_('Vernier Pinson'),
  'mdl.pinson.line':   PT_('Two seats side by side in a wooden fuselage; quicker than it looks.'),
  'mdl.meridian.name': PT_('Northline Meridian'),
  'mdl.meridian.line': PT_('Four seats and a baggage bay; wheels for the strips, floats for the dock.'),
  'mdl.tern.name':     PT_('Driftwood Tern'),
  'mdl.tern.line':     PT_('A single seat between two engines, on floats: fish-spotting and survey work.'),
  // the option rows
  'opt.engine': PT_('engine'), 'opt.tank': PT_('fuel tank'), 'opt.seats': PT_('seats'), 'opt.gear': PT_('gear'),
  'opt.avionics': PT_('panel and radios'), 'opt.finish': PT_('finish'), 'opt.reg': PT_('registration'),
  'opt.engine.v': PT_('{n} kW ({k} hp), {c}'),
  'opt.tank.std': PT_('standard tank'), 'opt.tank.long': PT_('long-range: wing-root tanks (+50 %)'),
  'opt.seats.n': PT_('{n} seats'), 'opt.seats.3': PT_('3 seats (one rear seat out, more room for bags)'),
  'opt.gear.wheels': PT_('wheels'), 'opt.gear.tundra': PT_('tundra tyres'), 'opt.gear.floats': PT_('floats'),
  'opt.avionics.minimal': PT_('minimal: day VFR, no radio'), 'opt.avionics.basic': PT_('basic VFR, a radio'),
  'opt.avionics.ifr': PT_('IFR panel and radios'), 'opt.avionics.custom': PT_('the factory\'s working panel'),
  'opt.finish.factory': PT_('factory colours'), 'opt.finish.red': PT_('signal red'), 'opt.finish.blue': PT_('harbour blue'),
  'opt.finish.green': PT_('forest green'), 'opt.finish.white': PT_('plain white'),
  'opt.cool.air': PT_('air-cooled'), 'opt.cool.liquid': PT_('liquid-cooled'),
  // the used market
  'used.title': PT_('{m}, {h} hours'),
  'used.hours': PT_('{h} hours on the engine since its last overhaul'),
  'used.repair.none': PT_('no damage history'),
  'used.repair.gear': PT_('the gear was replaced after a hard landing'),
  'used.repair.prop': PT_('a new propeller after a prop strike'),
  'used.repair.wing': PT_('a wing tip rebuilt after a hangar rash'),
  'used.repair.skin': PT_('a skin panel patched after hail'),
  'used.older': PT_('an older panel than the factory\'s'),
  'used.kg': PT_('{k} kg of extra equipment fitted over the years'),
  'used.seller.0': PT_('"She never let me down. I just don\'t fly enough any more."'),
  'used.seller.1': PT_('"Selling for a bigger one. Logbooks all there."'),
  'used.seller.2': PT_('"It sat a winter outside, but it starts on the second blade."'),
  'used.seller.3': PT_('"My late uncle\'s. Make me a fair offer and fly it away."'),
  'used.seller.4': PT_('"A club aeroplane, flown hard, looked after."'),
  'used.seller.5': PT_('"Bought it for a job that never came. Hardly used."'),
  'used.where': PT_('stands at {a}'),
};
function procureText(key, vars) {
  const e = PROCURE_TEXT[key] || (typeof CONTRACT_TEXT !== 'undefined' ? CONTRACT_TEXT[key] : null);
  let s = e ? e.t : '[' + key + ']';
  if (vars) s = s.replace(/\{(\w+)\}/g, (m, k) => (vars[k] != null ? String(vars[k]) : m));
  return s;
}

// ---- THE MAKERS AND THEIR MODELS --------------------------------------------------------------------------
// A model: { id, maker, name/line (keys), designs: { <gear value>: CONTRACT_DESIGNS id } (the validated build the
// options apply to — the first is the stock gear), opts: { <row>: { def, vals: { <value>: { ... } } } } }.
// An option value: what it writes (`eng`, `tank`, `seats`, `fit`, `tyre`, `tint`, or a gear value naming a
// design) and `eff`: { <design id>: the MEASURED effect against that design's file (GATE PROCURE re-derives it):
// { cost, emptyKg, massKg, toM, cruiseKmh, rangeKm, tankL, seats } as deltas }. A value with no `eff` for a
// design is not offered on it.
const PROCURE_MAKERS = {
  bramble:   { id: 'bramble',   name: 'mk.bramble.name',   line: 'mk.bramble.line',   colour: '#d9a441' },
  vernier:   { id: 'vernier',   name: 'mk.vernier.name',   line: 'mk.vernier.line',   colour: '#b0763f' },
  northline: { id: 'northline', name: 'mk.northline.name', line: 'mk.northline.line', colour: '#6f93b8' },
  driftwood: { id: 'driftwood', name: 'mk.driftwood.name', line: 'mk.driftwood.line', colour: '#7fa88f' },
};
// the engines a maker lists: the panel's catalogue index (_cage_eng.js PRESET_NAMES) and the registry row the join
// writes for it (_cage_join.js CAGE_JOIN_ENGINES) — GATE PROCURE holds both to the panel's own tables
const PROCURE_ENGINES = {
  a65:   { preset: 'continental A-65',  idx: 0,  type: 'a65_sensenich74' },
  o200:  { preset: 'continental O-200', idx: 1,  type: 'o200_eprops' },
  vw:    { preset: 'VW 2180',           idx: 4,  type: 'vw2180_wood' },
  r912:  { preset: 'rotax 912 (flat)',  idx: 7,  type: 'rotax912_warp' },
  r582:  { preset: 'rotax 582',         idx: 9,  type: 'rotax582_ivo' },
  r503:  { preset: 'rotax 503',         idx: 10, type: 'rotax503_wood' },
  io360: { preset: 'lycoming IO-360',   idx: 2,  type: 'io360_mccauley' },
  o320:  { preset: 'lycoming O-320',    idx: 17, type: 'o320_mccauley' },
  o540:  { preset: 'lycoming O-540',    idx: 18, type: 'o540_hartzell' },
};
// ...AND THEIR DIALS: the panel's own preset dict (_cage_eng.js applyEngPreset - what choosing the engine in the
// editor writes), as the A-65's dict + each engine's differences. Without them the panel's load audit reads the old
// engine's dials under the new index and turns the engine "custom" (measured on the page, G2280); GATE PROCURE holds
// every dict byte-equal to applyEngPreset's
const PROCURE_ENG_BASE = {engPower: 0, eng_tStyle: 0, eng_tCanD: 0.4, eng_tCanL: 1.05, eng_gearK: 1.2, eng_flatK: 1.26, eng_tRpm: 1900, eng_stackStyle: 0, eng_eStyle: 0, eng_canD: 0.0278, eng_canL: 0.026, eng_rpm: 2300, eng_volts: 11.1, eng_eFins: 0, eng_escOn: 1, eng_leads: 1, eng_plumb: 1, eng_liquid: 0, eng_geared: 0, eng_arch: 0, eng_cyl: 2, eng_radialRows: 1, eng_inlineAim: 1, eng_vee: 60, eng_bore: 0.0983, eng_stroke: 0.0921, eng_stagger: 0.5, eng_twoStroke: 0, eng_blower: 0, eng_boost: 1, eng_critAlt: 0, eng_finN: 14, eng_finR: 1.34, eng_headFins: 8, eng_rockerW: 0.95, eng_rockerH: 0.66, eng_rockerR: 0.24, eng_rockerBoss: 0.05, eng_rockerBossW: 0.52, eng_rodPos: 0, eng_finShape: 0, eng_rockerSpan: 0, eng_baseFins: 1, eng_injected: 0, eng_airStyle: 0, eng_airbox: 1, eng_intake: 1, eng_exStyle: 1, eng_exDrop: 1.5, eng_exOut: 0, eng_exAim: 0, eng_exOutX: 0, eng_exOutY: 0, eng_exOutZ: 0, eng_leadR: 0.034, eng_mags: 1, eng_genOn: 1, eng_oilFill: 1, eng_radX: 0, eng_radY: 0.55, eng_radZ: 0.55, eng_radW: 2, eng_radH: 0.75, eng_radD: 0.42, eng_starter: 1, eng_oilFilter: 1, eng_battOn: 1, eng_ecuOn: 0, eng_fuelX: 0, eng_fuelY: 0, eng_thrX: 0, eng_thrY: 0, eng_mount: 1, eng_mountX: 1, eng_mountGap: 0.85, eng_mountR: 1, eng_fwSpread: 1.5, eng_screws: 1};
const PROCURE_ENG_DIALS = {
  a65: {},
  o200: {eng_rpm: 2750, eng_bore: 0.1031875, eng_stroke: 0.098425},
  vw: {eng_rpm: 3200, eng_bore: 0.0922, eng_stroke: 0.0818, eng_rockerSpan: 1, eng_genOn: 0},
  r912: {eng_rpm: 5800, eng_liquid: 1, eng_geared: 1, eng_bore: 0.0795, eng_stroke: 0.0611, eng_airStyle: 1},
  r582: {eng_rpm: 6500, eng_liquid: 1, eng_geared: 1, eng_arch: 1, eng_cyl: 1, eng_bore: 0.076, eng_stroke: 0.064, eng_twoStroke: 1, eng_exStyle: 3},
  r503: {eng_rpm: 6800, eng_geared: 1, eng_arch: 1, eng_cyl: 1, eng_bore: 0.072, eng_stroke: 0.072, eng_twoStroke: 1, eng_exStyle: 3},
  io360: {eng_rpm: 2700, eng_bore: 0.13017499999999999, eng_stroke: 0.111125, eng_rodPos: 1, eng_injected: 1},
  o320: {eng_rpm: 2700, eng_bore: 0.13017499999999999, eng_stroke: 0.098425, eng_rodPos: 1},
  o540: {eng_rpm: 2575, eng_cyl: 3, eng_bore: 0.13017499999999999, eng_stroke: 0.111125, eng_rodPos: 1, eng_exStyle: 2},
};
// the liveries: a body tint and a wing tint (cosmetic: no fingerprint, no price)
const PROCURE_TINTS = { red: [0xb5342a, 0xf4f2ea], blue: [0x2b5d8a, 0xe8edf2], green: [0x3f6b45, 0xe9e4d4], white: [0xf2f0ea, 0xf2f0ea] };
const PROCURE_FINISH = {
  factory: { tint: null }, red: { tint: 'red' }, blue: { tint: 'blue' }, green: { tint: 'green' }, white: { tint: 'white' },
};
const PE_ = o => o;   // (a marker: a measured effect row — GATE PROCURE re-derives it; `--emit` prints the table)
const PROCURE_MODELS = {
  scout: {
    id: 'scout', maker: 'bramble', name: 'mdl.scout.name', line: 'mdl.scout.line', designs: { wheels: 'cub' },
    opts: {
      engine:   { def: 'a65', vals: { a65: { eng: 'a65', eff: { cub: {} } },
                                      o200: { eng: 'o200', eff: { cub: PE_({ cost: 15100, emptyKg: 8, massKg: 8, toM: -56, cruiseKmh: 17, rangeKm: -95, tankL: 0, seats: 0 }) } },
                                      r912: { eng: 'r912', eff: { cub: PE_({ cost: 8834, emptyKg: -28, massKg: -28, toM: -51, cruiseKmh: 8, rangeKm: -49, tankL: 0, seats: 0 }) } } } },
      tank:     { def: 'std', vals: { std: { tank: 1, eff: { cub: {} } },
                                      long: { tank: 1.5, eff: { cub: PE_({ cost: 836, emptyKg: 9, massKg: 25, toM: 25, cruiseKmh: 0, rangeKm: 188, tankL: 23.8, seats: 0 }) } } } },
      gear:     { def: 'wheels', vals: { wheels: { eff: { cub: {} } },
                                         tundra: { tyre: 'tundra', eff: { cub: PE_({ cost: 50, emptyKg: 8, massKg: 8, toM: 8, cruiseKmh: -2, rangeKm: -7, tankL: 0, seats: 0 }) } } } },
      avionics: { def: 'basic', vals: { basic: { fit: 'basic', eff: { cub: {} } },
                                        minimal: { fit: 'minimal', eff: { cub: PE_({ cost: -6355, emptyKg: -25, massKg: -25, toM: -22, cruiseKmh: 0, rangeKm: 1, tankL: 0, seats: 0 }) } },
                                        ifr: { fit: 'ifr', eff: { cub: PE_({ cost: 8872, emptyKg: 9, massKg: 9, toM: 8, cruiseKmh: 0, rangeKm: 0, tankL: 0, seats: 0 }) } } } },
      finish:   { def: 'factory', cosmetic: true, vals: PROCURE_FINISH },
    } },
  pinson: {
    id: 'pinson', maker: 'vernier', name: 'mdl.pinson.name', line: 'mdl.pinson.line', designs: { wheels: 'jodel' },
    opts: {
      engine:   { def: 'a65', vals: { a65: { eng: 'a65', eff: { jodel: {} } },
                                      o200: { eng: 'o200', eff: { jodel: PE_({ cost: 15112, emptyKg: 8, massKg: 8, toM: -67, cruiseKmh: 24, rangeKm: -96, tankL: 0, seats: 0 }) } },
                                      vw: { eng: 'vw', eff: { jodel: PE_({ cost: -3154, emptyKg: -19, massKg: -19, toM: 0, cruiseKmh: -5, rangeKm: 25, tankL: 0, seats: 0 }) } } } },
      tank:     { def: 'std', vals: { std: { tank: 1, eff: { jodel: {} } },
                                      long: { tank: 1.5, eff: { jodel: PE_({ cost: 868, emptyKg: 9, massKg: 25, toM: 31, cruiseKmh: -3, rangeKm: 195, tankL: 23.8, seats: 0 }) } } } },
      avionics: { def: 'basic', vals: { basic: { fit: 'basic', eff: { jodel: {} } },
                                        minimal: { fit: 'minimal', eff: { jodel: PE_({ cost: -6360, emptyKg: -24, massKg: -24, toM: -26, cruiseKmh: 3, rangeKm: 8, tankL: 0, seats: 0 }) } },
                                        ifr: { fit: 'ifr', eff: { jodel: PE_({ cost: 8857, emptyKg: 9, massKg: 9, toM: 11, cruiseKmh: -1, rangeKm: -4, tankL: 0, seats: 0 }) } } } },
      finish:   { def: 'factory', cosmetic: true, vals: PROCURE_FINISH },
    } },
  meridian: {
    id: 'meridian', maker: 'northline', name: 'mdl.meridian.name', line: 'mdl.meridian.line', designs: { wheels: 'c172', floats: 'c172f' },
    opts: {
      gear:     { def: 'wheels', vals: { wheels: { design: 'c172', eff: { c172: {}, c172f: {} } }, floats: { design: 'c172f', eff: { c172: {}, c172f: {} } } } },
      engine:   { def: 'o540', vals: { o540: { eng: 'o540', eff: { c172: {}, c172f: {} } },
                                       o320: { eng: 'o320', eff: { c172: PE_({ cost: -11047, emptyKg: -77, massKg: -77, toM: 31, cruiseKmh: -8, rangeKm: 50, tankL: 0, seats: 0 }),
                                                                   c172f: PE_({ cost: -11025, emptyKg: -77, massKg: -77, toM: 37, cruiseKmh: -29, rangeKm: 40, tankL: 0, seats: 0 }) } },
                                       io360: { eng: 'io360', eff: { c172: PE_({ cost: -724, emptyKg: -54, massKg: -54, toM: 13, cruiseKmh: -6, rangeKm: 27, tankL: 0, seats: 0 }),
                                                                     c172f: PE_({ cost: -710, emptyKg: -54, massKg: -54, toM: 11, cruiseKmh: -16, rangeKm: 24, tankL: 0, seats: 0 }) } } } },
      tank:     { def: 'std', vals: { std: { tank: 1, eff: { c172: {}, c172f: {} } },
                                      long: { tank: 1.5, eff: { c172: PE_({ cost: 728, emptyKg: 7, massKg: 17, toM: 6, cruiseKmh: 2, rangeKm: 52, tankL: 14.8, seats: 0 }),
                                                                c172f: PE_({ cost: 724, emptyKg: 7, massKg: 17, toM: 27, cruiseKmh: 2, rangeKm: 60, tankL: 14.8, seats: 0 }) } } } },
      seats:    { def: '4', vals: { 4: { seats: null, eff: { c172: {}, c172f: {} } },
                                    3: { seats: 1, eff: { c172: PE_({ cost: -1541, emptyKg: -16, massKg: -16, toM: -6, cruiseKmh: -2, rangeKm: -1, tankL: 0, seats: -1 }),
                                                          c172f: PE_({ cost: -1513, emptyKg: -15, massKg: -15, toM: -37, cruiseKmh: -1, rangeKm: -1, tankL: 0, seats: -1 }) } } } },
      avionics: { def: 'custom', vals: { custom: { fit: null, eff: { c172: {}, c172f: {} } },
                                         basic: { fit: 'basic', eff: { c172: PE_({ cost: -11252, emptyKg: -9, massKg: -9, toM: -3, cruiseKmh: -1, rangeKm: -1, tankL: 0, seats: 0 }),
                                                                       c172f: PE_({ cost: -11249, emptyKg: -9, massKg: -9, toM: -20, cruiseKmh: -1, rangeKm: -1, tankL: 0, seats: 0 }) } } } },
      finish:   { def: 'factory', cosmetic: true, vals: PROCURE_FINISH },
    } },
  tern: {
    id: 'tern', maker: 'driftwood', name: 'mdl.tern.name', line: 'mdl.tern.line', designs: { floats: 'twinf' },
    opts: {
      engine:   { def: 'r582', vals: { r582: { eng: 'r582', eff: { twinf: {} } },
                                       r503: { eng: 'r503', eff: { twinf: PE_({ cost: -3103, emptyKg: -14, massKg: -14, toM: 50, cruiseKmh: -2, rangeKm: 30, tankL: 0, seats: 0 }) } } } },
      tank:     { def: 'std', vals: { std: { tank: 1, eff: { twinf: {} } },
                                      long: { tank: 1.5, eff: { twinf: PE_({ cost: 517, emptyKg: 7, massKg: 13, toM: 24, cruiseKmh: 2, rangeKm: 57, tankL: 10.1, seats: 0 }) } } } },
      finish:   { def: 'factory', cosmetic: true, vals: PROCURE_FINISH },
    } },
};
const PROCURE_EFF_KEYS = ['cost', 'emptyKg', 'massKg', 'toM', 'cruiseKmh', 'rangeKm', 'tankL', 'seats'];

// ---- VALIDATED ONLY ---------------------------------------------------------------------------------------
const procureValidated = id => !!(typeof CONTRACT_DESIGNS !== 'undefined' && CONTRACT_DESIGNS[id] && CONTRACT_DESIGNS[id].build);
// the catalogue the screens read: the makers, each with the models whose every design is a validated build; an
// option value whose effect names no validated design of its model is dropped (never offered)
function procureCatalogue() {
  const out = [];
  for (const mk of Object.keys(PROCURE_MAKERS)) {
    const models = Object.keys(PROCURE_MODELS).filter(id => PROCURE_MODELS[id].maker === mk)
      .filter(id => Object.values(PROCURE_MODELS[id].designs).every(procureValidated));
    if (models.length) out.push({ maker: mk, models });
  }
  return out;
}
const procureModelIds = () => [].concat(...procureCatalogue().map(m => m.models));

// ---- THE OPTIONS SHEET --------------------------------------------------------------------------------------
function procureDefaults(modelId) {
  const M = PROCURE_MODELS[modelId], o = {};
  if (!M) return null;
  for (const r of Object.keys(M.opts)) o[r] = M.opts[r].def;
  o.reg = '';
  return o;
}
// the design an option set flies on: the gear row's design, else the model's first
function procureDesignOf(modelId, opts) {
  const M = PROCURE_MODELS[modelId];
  if (!M) return null;
  const g = M.opts.gear, v = g && opts && g.vals[opts.gear];
  return (v && v.design) || Object.values(M.designs)[0];
}
// the gear row of a model whose values name designs is a SWITCH between validated builds (priced by the model line,
// never as an option); otherwise (the tundra tyres) it is an option like any other
const prSwitch = (M, r) => r === 'gear' && Object.values(M.opts.gear.vals).some(v => v.design);
// a value is offered on a design when its effect row names that design
const prOffered = (M, row, val, design) => !!(M.opts[row] && M.opts[row].vals[val] && (M.opts[row].cosmetic || (M.opts[row].vals[val].eff && M.opts[row].vals[val].eff[design])));
// a registration: letters, digits and one or two dashes, 3-9 characters
const procureRegOk = r => typeof r === 'string' && /^[A-Z0-9]{1,3}-?[A-Z0-9]{1,6}$/.test(r) && r.length >= 3 && r.length <= 9;
// -> { ok, opts (filled: every row a value offered on its design; reg upper-cased), why }
function procureOpts(modelId, opts) {
  const M = PROCURE_MODELS[modelId];
  if (!M || !procureModelIds().includes(modelId)) return { ok: false, opts: null, why: 'no such model on sale: ' + modelId };
  const o = procureDefaults(modelId), why = [];
  opts = opts || {};
  if (opts.gear != null && M.opts.gear && M.opts.gear.vals[opts.gear]) o.gear = String(opts.gear);
  const design = procureDesignOf(modelId, o);
  for (const r of Object.keys(M.opts)) {
    if (opts[r] == null || r === 'gear') continue;
    const v = String(opts[r]);
    if (prOffered(M, r, v, design)) o[r] = v;
    else why.push(r + ' ' + v + ' is not offered on the ' + procureText(M.name) + (M.opts[r] ? ' (' + Object.keys(M.opts[r].vals).join(' / ') + ')' : ''));
  }
  for (const r of Object.keys(M.opts)) if (!prOffered(M, r, o[r], design)) o[r] = M.opts[r].def;
  if (opts.reg) { const g = String(opts.reg).toUpperCase().trim(); if (procureRegOk(g)) o.reg = g; else why.push('registration ' + opts.reg + ' is not a registration'); }
  return { ok: !why.length, opts: o, why: why.join('; ') };
}
// the rows a value writes, on a clone of the design's file spec -> the spec. `base` is the build file's spec
// (CONTRACT_DESIGNS[design].build; the twin's floats patch applied by procureBaseSpec)
function procureBaseSpec(design, fileSpec) {
  const s = prClone(fileSpec && fileSpec.spec ? fileSpec.spec : fileSpec);
  const D = CONTRACT_DESIGNS[design];
  if (D && D.patch === 'floats') { s.gear = Object.assign({}, s.gear, { type: 'floats' }); s.cage = Object.assign({}, s.cage, { gearFloats: 1 }); }
  return s;
}
function prWrite(s, row, val) {
  if (val.eng) {
    const E = PROCURE_ENGINES[val.eng];
    s.cage = Object.assign({}, s.cage, PROCURE_ENG_BASE, PROCURE_ENG_DIALS[val.eng], { engPreset: E.idx });
    s.engines = (s.engines || [{ mount: 'nose', place: { dx: 0, dy: 0 } }]).map(e => { const o = Object.assign({}, e, { type: E.type }); delete o.custom; delete o.sound; return o; });
  }
  if (val.tank != null && val.tank !== 1) {
    // THE LONG-RANGE TANK IS A SECOND TANK IN THE WING ROOTS (GEN_BAYS.wingRoot), never a bigger nose tank: the nose
    // bay is the cowl deck in front of the pilot's knees, and the energy layer caps a vessel to what fits there
    // (measured on the page, G2280: a 67.5 L Cub nose tank came back 29 L). The wing roots are where these
    // aeroplanes carry their extra fuel.
    s.energy = prClone(s.energy || {});
    const V = s.energy.vessels = s.energy.vessels || [];
    const v = V[0];
    if (v) V.push({ bay: 'wingRoot', capacity: +((+v.capacity || 0) * (val.tank - 1)).toFixed(1), along: null, lv: null, rot: 0, form: 'box',
                    finish: null, hue: null, tint: null });
  }
  if (val.seats != null) {
    // the rear bay's own abreast (_cage_join.js: perBay = paxAbreast): one seat where the row had two
    s.cage = Object.assign({}, s.cage, { paxAbreast: val.seats });
    const c = s.cabin = prClone(s.cabin || {});
    const n = Math.max(1, (c.seats || 2) - 1);
    c.seats = n;
    if (Array.isArray(c.seatsX)) c.seatsX = c.seatsX.slice(0, n);
    if (Array.isArray(c.occupied)) c.occupied = c.occupied.slice(0, n);
  }
  if (val.fit) {
    const t = (typeof GEN_SYSTEMS !== 'undefined' && GEN_SYSTEMS[val.fit]) || null;
    s.systems = Object.assign({}, s.systems || {}, { fit: val.fit });
    delete s.systems.items; delete s.systems.elec; delete s.systems.avionics;
    if (!t) s.systems.fit = 'basic';
  }
  if (val.tyre === 'tundra') {
    // the bush tyre: the tundra balloon carcass, smooth, a bigger radius (the join measures gear.wheelR off s1R)
    const r = +(((s.cage && +s.cage.s1R) || (s.gear && s.gear.wheelR) || 0.2) * 1.25).toFixed(3);
    s.cage = Object.assign({}, s.cage, { whProfile: 1, whTread: 1, s1R: r });
    s.gear = Object.assign({}, s.gear, { wheelR: r });
  }
  if (row === 'finish' && val.tint && PROCURE_TINTS[val.tint]) {
    const [body, wing] = PROCURE_TINTS[val.tint];
    s.finish = prClone(s.finish || {});
    const S = s.finish.sections = s.finish.sections || {};
    for (const k of ['body', 'waistband', 'ceilingLoop', 'floorLoop', 'pillarFront', 'pillarCabin', 'pillarWindow', 'pillarPassenger', 'pillarTail', 'cowlSkin', 'finSkin', 'stabSkin', 'tube', 'boomTube'])
      S[k] = Object.assign({}, S[k] || {}, { tint: body });
    S.wingSkin = Object.assign({}, S.wingSkin || {}, { tint: wing });
  }
  return s;
}
// THE CUSTOMISED SPEC: the design's file + every chosen value's rows + the registration. opts already filled
// (procureOpts). An ordinary spec: the garage loads it as it loads any build.
function procureSpec(modelId, opts, fileSpec) {
  const M = PROCURE_MODELS[modelId], design = procureDesignOf(modelId, opts);
  let s = procureBaseSpec(design, fileSpec);
  for (const r of Object.keys(M.opts)) {
    if (r === 'gear') { const v = M.opts.gear.vals[opts.gear]; if (v) s = prWrite(s, r, v); continue; }
    const v = M.opts[r].vals[opts[r]];
    if (v && opts[r] !== M.opts[r].def) s = prWrite(s, r, v);
  }
  s.meta = Object.assign({}, s.meta || {}, { name: procureText(M.name) });
  if (opts.reg) s.meta.reg = opts.reg;
  return s;
}

// ---- THE CERTIFICATE AND ITS FINGERPRINT ---------------------------------------------------------------------
// a CONTRACT_DESIGNS-shaped row: the design's numbers + every non-default value's measured effect
function procureCert(modelId, opts) {
  const M = PROCURE_MODELS[modelId], design = procureDesignOf(modelId, opts), D = CONTRACT_DESIGNS[design];
  if (!M || !D) return null;
  const c = prClone(D);
  let n = 0;
  for (const r of Object.keys(M.opts)) {
    if (M.opts[r].cosmetic || prSwitch(M, r) || opts[r] === M.opts[r].def) continue;
    const e = ((M.opts[r].vals[opts[r]] || {}).eff || {})[design];
    if (!e) continue;
    n++;
    // the masses, the cost, the speed and the tank add; the take-off run and the range COMPOUND (a longer tank on
    // a thirstier engine): each value's ratio to the design's own, multiplied
    c.cost += e.cost || 0; c.emptyKg += e.emptyKg || 0; c.massKg += e.massKg || 0; c.toM *= 1 + (e.toM || 0) / D.toM;
    c.cruiseKmh += e.cruiseKmh || 0; c.rangeKm *= 1 + (e.rangeKm || 0) / D.rangeKm; c.tankL = +((c.tankL || 0) + (e.tankL || 0)).toFixed(1); c.seats += e.seats || 0;
  }
  c.toM = Math.round(c.toM); c.rangeKm = Math.round(c.rangeKm);
  c.id = design; c.label = procureText(M.name); c.model = modelId; c.exact = n <= 1;
  return c;
}
function prCanon(v) {
  if (v === null || typeof v !== 'object') return JSON.stringify(v === undefined ? null : v);
  if (Array.isArray(v)) return '[' + v.map(prCanon).join(',') + ']';
  const ks = Object.keys(v).filter(k => v[k] !== undefined).sort();
  return '{' + ks.map(k => JSON.stringify(k) + ':' + prCanon(v[k])).join(',') + '}';
}
// the spec minus what is not the aeroplane (bench.js benchStripCosmetic's blocks and state rows; every other row
// counts) -> 8 hex digits, the physics version folded in (a certificate from an older physics is another's)
function procureFp(spec) {
  if (!spec || typeof spec !== 'object') return null;
  const c = prClone(spec);
  for (const k of PROCURE_COSMETIC.concat(PROCURE_READOUTS)) delete c[k];
  if (c.energy && typeof c.energy === 'object') {
    for (const k of PROCURE_LOOK.energy) delete c.energy[k];
    for (const v of (c.energy.vessels || [])) if (v && typeof v === 'object') for (const k of PROCURE_LOOK.vessel) delete v[k];
  }
  if (c.systems && typeof c.systems === 'object') for (const k of PROCURE_LOOK.systems) delete c.systems[k];
  if (c.cage && typeof c.cage === 'object') for (const k of Object.keys(c.cage)) if (PROCURE_STATE_ROWS.test(k)) delete c.cage[k];
  const tag = 'p1|v' + (typeof GEN_SPEC_V !== 'undefined' ? GEN_SPEC_V : 0) + '|p' + (typeof PHYSICS_V !== 'undefined' ? PHYSICS_V : 0) + '|';
  return ('0000000' + contractHash(tag + prCanon(c)).toString(16)).slice(-8);
}
// a ledger (buildGen's parts.ledger) as the airframe row keeps it: { key: [mass kg 0.01, cost 1] }
function procureLedgerOf(L) {
  const out = {};
  for (const k of Object.keys(L || {}).sort()) if (L[k] && typeof L[k] === 'object') out[k] = [Math.round((+L[k].mass || 0) * 100) / 100, Math.round(+L[k].cost || 0)];
  return out;
}
// dm11: an edit is billed at BUILD price - every ledger line the edit rebuilt (its mass or its cost moved, or it
// is new) at its own new build price; a line removed bills nothing -> { cost, lines: [{ k, cost }] }
function procureEditBill(L0, L1) {
  const a = L0 || {}, b = L1 || {}, lines = [];
  for (const k of Object.keys(b).sort()) {
    const o = a[k], n = b[k];
    if (!o || Math.abs(o[0] - n[0]) > 0.05 || Math.abs(o[1] - n[1]) > 1) lines.push({ k, cost: n[1] });
  }
  return { cost: lines.reduce((s, l) => s + l.cost, 0), lines };
}

// ---- THE PRICES (ECONOMY's book; the stub until it lands) ---------------------------------------------------
// procureEconStub(kind, item): 'model' { model, design, cost } -> the stock model (the ledger x the margin);
// 'option' { model, row, value, design, cost } -> the value's ledger delta x the margin (a credit when cheaper);
// 'delivery' { to: 'main' | 'side', km } ; 'build' { cost } (a design materialised: the ledger, no margin);
// 'used' { catalogue, condition } -> catalogue x condition; 'edit' { cost } -> the dm11 bill
function procureEconStub(kind, item) {
  item = item || {};
  if (kind === 'model') return prR100((+item.cost || 0) * PROCURE_MARGIN);
  if (kind === 'option') return prR100((+item.cost || 0) * PROCURE_MARGIN);
  if (kind === 'delivery') return item.to === 'side' ? prR100(PROCURE_DELIVERY.side + PROCURE_DELIVERY.perKm * (+item.km || 0)) : PROCURE_DELIVERY.main;
  if (kind === 'build') return prR100(+item.cost || 0);
  if (kind === 'used') return prR100((+item.catalogue || 0) * (+item.condition || 0));
  if (kind === 'edit') return Math.round(+item.cost || 0);
  return NaN;
}
// THE DOOR: ECONOMY's econPrice when it exists (same signature), else the stub - asked at call time
function procureEcon(kind, item) {
  if (typeof econPrice === 'function') { const v = econPrice(kind, item); if (typeof v === 'number' && isFinite(v)) return v; }
  return procureEconStub(kind, item);
}
const procureEconSource = () => (typeof econPrice === 'function' ? 'econPrice' : 'stub');
// the price sheet of a model + options -> { total, lines: [{ row, value, price }], design }
function procurePrice(modelId, opts) {
  const M = PROCURE_MODELS[modelId], design = procureDesignOf(modelId, opts), D = CONTRACT_DESIGNS[design];
  const lines = [{ row: 'model', value: modelId, price: procureEcon('model', { model: modelId, design, cost: D.cost }) }];
  for (const r of Object.keys(M.opts)) {
    if (M.opts[r].cosmetic || prSwitch(M, r) || opts[r] === M.opts[r].def) continue;
    const e = ((M.opts[r].vals[opts[r]] || {}).eff || {})[design];
    if (e) lines.push({ row: r, value: opts[r], price: procureEcon('option', { model: modelId, row: r, value: opts[r], design, cost: e.cost || 0 }) });
  }
  return { total: lines.reduce((s, l) => s + l.price, 0), lines, design };
}
// the words of an option value (the sheet's labels)
function procureOptWord(modelId, row, val) {
  const M = PROCURE_MODELS[modelId], v = M && M.opts[row] && M.opts[row].vals[val];
  if (!v) return '';
  if (row === 'engine') {
    const E = PROCURE_ENGINES[v.eng], R = (typeof POWERPLANTS !== 'undefined' && POWERPLANTS[E.type]) || null;
    const kw = R ? R.engine.powerW / 1000 : 0;
    return procureText('opt.engine.v', { n: Math.round(kw), k: Math.round(kw * 1.341), c: procureText(R && R.engine.cooling === 'liquid' ? 'opt.cool.liquid' : 'opt.cool.air') });
  }
  if (row === 'seats') return val === '3' ? procureText('opt.seats.3') : procureText('opt.seats.n', { n: val });
  return procureText('opt.' + row + '.' + val);
}
// THE SHEET a screen draws: rows with every value offered on the chosen design (its word, its price, chosen?)
function procureSheet(modelId, opts) {
  const F = procureOpts(modelId, opts);
  if (!F.opts) return null;
  const M = PROCURE_MODELS[modelId], o = F.opts, design = procureDesignOf(modelId, o);
  const rows = Object.keys(M.opts).map(r => ({
    row: r, word: procureText('opt.' + r), cosmetic: !!M.opts[r].cosmetic,
    vals: Object.keys(M.opts[r].vals).filter(v => r === 'gear' || prOffered(M, r, v, design)).map(v => {
      const e = ((M.opts[r].vals[v] || {}).eff || {})[design];
      const price = (M.opts[r].cosmetic || prSwitch(M, r) || v === M.opts[r].def || !e) ? 0 : procureEcon('option', { model: modelId, row: r, value: v, design, cost: e.cost || 0 });
      return { val: v, word: procureOptWord(modelId, r, v), price, on: o[r] === v };
    }),
  }));
  return { model: modelId, maker: M.maker, name: procureText(M.name), line: procureText(M.line), makerName: procureText(PROCURE_MAKERS[M.maker].name),
           design, opts: o, rows, price: procurePrice(modelId, o), cert: procureCert(modelId, o), why: F.why };
}

// ---- THE DRAWING BOARD (§5.4, G-DESIGN) ---------------------------------------------------------------------
// designs: every saved slot (the library; free, shared); airframes: the career's rows over the fleet ledger.
// -> { designs: [{ name, airframe: bool }], airframes: [{ slot, design?, model?, factory, modified, from }] }
function procureBoard(doc, slotNames) {
  const names = Array.from(new Set(slotNames || [])).sort();
  const c = doc && doc.career, af = (c && c.airframes) || {};
  const career = !!c;
  // the sandbox: every slot is both a design and an airframe (today's game)
  const isAf = n => (career ? !!af[n] : !!(doc && doc.fleet && doc.fleet[n]));
  return {
    mode: career ? 'career' : 'sandbox',
    designs: names.map(n => ({ name: n, airframe: isAf(n) })),
    airframes: Object.keys(career ? af : ((doc && doc.fleet) || {})).sort().map(n => {
      const A = af[n] || {};
      return { slot: n, design: A.design || null, model: A.model || null, factory: !!A.factory, modified: !!A.modified, from: A.from || (career ? null : 'slot') };
    }),
  };
}
// a fleet row for a new airframe at a base: inside a hangar of yours there if one has a slot and the floor (the
// hangar asked for first), else tied down (playerArrive's own rule and words)
function prStation(d, slot, aero, opts) {
  d.fleet[slot] = { hangar: null, aero };
  if (opts && opts.foot) d.fleet[slot].foot = parkFoot(opts.foot);
  const r = playerArrive(d, slot, aero, { prefer: opts && opts.hangar, foots: opts && opts.foot ? { [slot]: opts.foot } : null });
  const e = r.doc.fleet[slot];
  if (e && !e.hangar && typeof e.outSince !== 'number') e.outSince = Math.round(r.doc.clock || 0);
  return r;
}
const prSlotFree = (doc, slotNames, slot) => !!slot && !(doc.fleet && doc.fleet[slot]) && !(slotNames || []).includes(slot);
// "BUILD THIS DESIGN": a design (a slot of the library) materialised as an airframe in the main hangar's base.
// o: { cost (the design's ledger, genShakedown.cost, measured by the page), ledger?, fp?, hangar? } -> { ok, doc, price }
function procureBuildDesign(doc, slot, o) {
  o = o || {};
  if (!doc || !doc.career) return prNo(doc, 'the sandbox builds nothing: every saved design is already an aeroplane');
  if (doc.career.airframes[slot]) return prNo(doc, slot + ' is an airframe already');
  if (!(o.cost > 0)) return prNo(doc, 'the design\'s ledger is not read yet: open it in the garage');
  const price = procureEcon('build', { cost: o.cost, slot });
  if (doc.wallet < price) return prNo(doc, 'the wallet holds ' + Math.round(doc.wallet) + ', building it costs ' + price);
  const home = doc.sheds[PREM_MAIN] ? doc.sheds[PREM_MAIN].base : PREM_MAIN;
  const d = prClone(doc);
  let r = { doc: d };
  if (!d.fleet[slot]) r = prStation(d, slot, home, { hangar: o.hangar || PREM_MAIN, foot: o.foot });
  const D2 = r.doc;
  D2.career.airframes[slot] = { from: 'board', design: null, model: null, factory: false, modified: false, fp: o.fp || null,
                                ledger: o.ledger || null, price, at: Math.round(D2.clock || 0) };
  playerCharge(D2, price, 'build', slot);
  return { ok: true, doc: D2, price, why: '' };
}
// "SAVE AS DESIGN": an airframe's spec filed under a new slot name (free; the page writes the slot). The airframe
// row is untouched; the career's new slot is a DESIGN (no airframes row: the page's lift stations it nowhere ->
// procureDesignRows keeps it off the fleet). -> { ok, name, envelope }
function procureSaveDesign(doc, slot, spec, name, slotNames) {
  if (!spec) return { ok: false, why: 'no spec for ' + slot };
  const n = String(name || '').trim();
  if (!n) return { ok: false, why: 'a design needs a name' };
  if ((slotNames || []).includes(n)) return { ok: false, why: n + ' is a design already' };
  const s = prClone(spec);
  s.meta = Object.assign({}, s.meta || {}, { name: n });
  return { ok: true, name: n, why: '', envelope: procureEnvelope(n, s, { design: true, of: slot }) };
}
// the career's fleet ledger holds airframes only: a slot that is a design (no airframes row) is not an aeroplane
// that stands anywhere. -> the slot names the page's lift should treat as airframes (the sandbox: all of them)
function procureAirframeSlots(doc, slotNames) {
  const names = (slotNames || []).slice().sort();
  if (!doc || !doc.career) return names;
  const af = doc.career.airframes || {};
  return names.filter(n => !!af[n]);
}
// the slot envelope (garage.js `envelope`'s shape) a purchase writes; the log carries the factory record
function procureEnvelope(name, spec, factory) {
  return { what: 'flydiy-build', v: (typeof GEN_SPEC_V === 'number' ? GEN_SPEC_V : null), name, spec,
           plaque: null, log: { built: null, tests: [], flights: [], factory: factory || null } };
}

// ---- BUYING FROM A MAKER ------------------------------------------------------------------------------------
// procureBuyModel(doc, modelId, opts, o) — o: { slot (the new slot's name), slotNames (the shelf), fileSpec (the
// design's build file), hangar (the hangar it is delivered to: the main hangar by default, or a side hangar of
// yours: a delivery fee), ledger (buildGen's of the customised spec, for dm11 later; optional), foot? }
// -> { ok, doc, slot, envelope, price: { total, lines, delivery, voucher }, cert, why }
function procureBuyModel(doc, modelId, opts, o) {
  o = o || {};
  const F = procureOpts(modelId, opts);
  if (!F.ok) return prNo(doc, F.why);
  if (!o.fileSpec) return prNo(doc, 'the design\'s build file is not loaded');
  const slot = String(o.slot || '').trim();
  if (!prSlotFree(doc, o.slotNames, slot)) return prNo(doc, slot ? slot + ' is taken: name the aeroplane differently' : 'name the aeroplane');
  const hid = o.hangar || PREM_MAIN, shed = doc.sheds[hid];
  if (!shed) return prNo(doc, 'no hangar ' + hid + ' of yours to deliver to');
  const career = !!(doc.career);
  const opt = F.opts, spec = procureSpec(modelId, opt, o.fileSpec), cert = procureCert(modelId, opt), P = procurePrice(modelId, opt);
  const side = hid !== PREM_MAIN;
  const km = side ? contractKm(shed.base, PREM_MAIN) : 0;
  const delivery = procureEcon('delivery', { to: side ? 'side' : 'main', km: Math.round(km * 10) / 10, hangar: hid });
  // GQ23: the voucher pays for one STOCK model of its design (the maker's Cub): the options and a delivery are paid
  const V = career && doc.career.voucher;
  const stock = Object.keys(PROCURE_MODELS[modelId].opts).every(r => PROCURE_MODELS[modelId].opts[r].cosmetic || opt[r] === PROCURE_MODELS[modelId].opts[r].def);
  const voucher = !!(V && !V.used && V.kind === 'maker' && V.model === P.design && stock);
  const total = (voucher ? 0 : P.total) + delivery;
  if (career && doc.wallet < total) return prNo(doc, 'the wallet holds ' + Math.round(doc.wallet) + ', the ' + procureText(PROCURE_MODELS[modelId].name) + ' costs ' + total);
  const d = prClone(doc);
  const r = prStation(d, slot, shed.base, { hangar: hid, foot: o.foot });
  const D2 = r.doc;
  const fp = procureFp(spec);
  const row = { from: 'maker', maker: PROCURE_MODELS[modelId].maker, model: modelId, design: P.design, opts: prClone(opt), fp,
                cert: prClone(cert), factory: true, modified: false, price: total, at: Math.round(D2.clock || 0),
                ledger: o.ledger ? procureLedgerOf(o.ledger) : null };
  if (career) {
    D2.career.airframes[slot] = row;
    if (voucher) D2.career.voucher = Object.assign({}, D2.career.voucher, { used: true, slot });
  }
  playerCharge(D2, total, 'buy', slot);
  return { ok: true, doc: D2, slot, kind: r.kind, hangar: r.hangar || null, envelope: procureEnvelope(slot, spec, row), cert,
           price: { total, lines: P.lines, delivery, voucher }, why: '' };
}

// ---- THE USED MARKET (§5.3) ---------------------------------------------------------------------------------
// the listing's place: an aerodrome it can FLY FROM on its own certificate (CONTRACT-MODEL's gear and strip rules:
// contractCanDo on a take-off from there, the extra kilos counted)
function procureUsedCert(L) {
  const c = procureCert(L.model, L.opts);
  if (!c) return null;
  const x = L.kg || 0, w0 = c.massKg;
  c.emptyKg += x; c.massKg += x; c.toM = Math.round(c.toM * ((w0 + x) / w0) * ((w0 + x) / w0));
  c.exact = c.exact && !x;
  return c;
}
const procureFlyableAt = (cert, aero) => !!cert && contractCanDo(cert, [{ do: 'land', to: aero }]).ok;
const procureUsedEpoch = done => Math.floor(Math.max(0, done || 0) / PROCURE_USED_EVERY);
const PROCURE_REPAIRS = ['none', 'none', 'gear', 'prop', 'wing', 'skin'];
// one listing: f(seed, epoch, i) and nothing else
function procureUsedListing(seed, epoch, i) {
  const id = 'used:' + epoch + ':' + i;
  const rng = contractRng(String(seed) + '|' + id);
  const pick = a => a[Math.floor(rng() * a.length) % a.length];
  const models = procureModelIds();
  const model = pick(models), M = PROCURE_MODELS[model];
  const o = procureDefaults(model);
  if (M.opts.gear) o.gear = pick(Object.keys(M.opts.gear.vals));
  const design = procureDesignOf(model, o);
  // the engine and the tank as the first owner chose them (any value offered on its design)
  for (const r of ['engine', 'tank']) if (M.opts[r]) o[r] = pick(Object.keys(M.opts[r].vals).filter(v => prOffered(M, r, v, design)));
  // an older panel: one tier below the factory's, where the sheet has one
  const AV = M.opts.avionics, tiers = ['minimal', 'basic', 'ifr'];
  let older = false;
  if (AV && rng() < 0.6) {
    const cur = AV.vals[o.avionics].fit, ix = tiers.indexOf(cur || 'ifr');
    const down = tiers.slice(0, Math.max(0, ix)).reverse().find(t => Object.keys(AV.vals).some(v => AV.vals[v].fit === t && prOffered(M, 'avionics', v, design)));
    if (down) { o.avionics = Object.keys(AV.vals).find(v => AV.vals[v].fit === down); older = true; }
  }
  o.finish = pick(Object.keys(PROCURE_FINISH));
  const L3 = 'ABCDEFGHJKLMNPRSTUVWXYZ';
  o.reg = 'N' + (100 + Math.floor(rng() * 900)) + L3[Math.floor(rng() * L3.length)] + L3[Math.floor(rng() * L3.length)];
  const hours = 50 * Math.round((150 + rng() * 2850) / 50);
  const repair = pick(PROCURE_REPAIRS);
  const kg = Math.round(rng() * 15);
  const seller = Math.floor(rng() * 6);
  // condition 0.4-0.8: the hours, a repair, an older panel, the kilos
  let cond = PROCURE_COND[1] - 0.25 * hours / 3000 - (repair !== 'none' ? 0.08 : 0) - (older ? 0.03 : 0) - 0.04 * kg / 15;
  cond = Math.round(Math.max(PROCURE_COND[0], Math.min(PROCURE_COND[1], cond)) * 100) / 100;
  const L = { id, model, design, opts: o, hours, repair, older, kg, seller: 'used.seller.' + seller, condition: cond };
  // where it stands: an aerodrome it can fly from, drawn in the listing's own order
  const cert = procureUsedCert(L);
  const fields = Object.keys(CONTRACT_FIELDS).sort();
  const can = fields.filter(f => procureFlyableAt(cert, f));
  if (!can.length) return null;
  L.aero = can[Math.floor(rng() * can.length) % can.length];
  const cat = procurePrice(model, o).total;
  L.catalogue = cat;
  L.price = procureEcon('used', { catalogue: cat, condition: cond, model, id });
  return L;
}
// the listings on offer: the epoch's draws (at most PROCURE_USED_MAX, 3 or 4 of them), the ones sold gone
function procureMarket(seed, done, sold) {
  const epoch = procureUsedEpoch(done);
  const n = 3 + (contractHash(String(seed) + '|used|' + epoch) % 2);
  const out = [];
  for (let i = 0; i < Math.min(PROCURE_USED_MAX, n); i++) {
    const L = procureUsedListing(seed, epoch, i);
    if (L && !(sold || []).includes(L.id)) out.push(L);
  }
  return out;
}
const procureUsedById = (seed, id) => { const m = /^used:(\d+):(\d+)$/.exec(id || ''); return m ? procureUsedListing(seed, +m[1], +m[2]) : null; };
// the market of a document: the career's seed and completed count; the sandbox's own seed ('sandbox', epoch 0)
function procureMarketOf(doc) {
  const c = doc && doc.career;
  return procureMarket(c ? c.seed : 'sandbox', c ? c.contracts.done.length : 0, procureSold(doc));
}
function procureSold(doc) {
  const m = doc && ((doc.career && doc.career.market) || doc.market);
  return (m && Array.isArray(m.sold)) ? m.sold : [];
}
// the listing's words: its title, its facts, its seller
function procureUsedWords(L) {
  const M = PROCURE_MODELS[L.model];
  return {
    title: procureText('used.title', { m: procureText(M.name), h: L.hours }),
    facts: [procureText('used.hours', { h: L.hours }), procureText('used.repair.' + L.repair)]
      .concat(L.older ? [procureText('used.older')] : []).concat(L.kg ? [procureText('used.kg', { k: L.kg })] : []),
    seller: procureText(L.seller),
    where: procureText('used.where', { a: CONTRACT_FIELDS[L.aero] ? CONTRACT_FIELDS[L.aero].name : L.aero }),
  };
}
// the listing's spec: the model's, with its kilos carried (cargo.kg: fixed equipment, aboard on every flight)
function procureUsedSpec(L, fileSpec) {
  const s = procureSpec(L.model, L.opts, fileSpec);
  if (L.kg) s.cargo = Object.assign({}, s.cargo || { len: 0, kg: 0 }, { kg: ((s.cargo && +s.cargo.kg) || 0) + L.kg });
  return s;
}
// BUY IT WHERE IT STANDS: an airframe stationed at the listing's aerodrome (in a hangar of yours there if one has
// room, else tied down; 'away' where you hold nothing), the listing gone from the market.
// o: { slot, slotNames, fileSpec, ledger?, foot? } -> { ok, doc, slot, kind, envelope, price, why }
function procureBuyUsed(doc, listingId, o) {
  o = o || {};
  const seed = doc && doc.career ? doc.career.seed : 'sandbox';
  const L = procureMarketOf(doc).find(x => x.id === listingId);
  if (!L) return prNo(doc, listingId + ' is not for sale (sold, or the market has moved on)');
  if (!o.fileSpec) return prNo(doc, 'the design\'s build file is not loaded');
  const slot = String(o.slot || '').trim();
  if (!prSlotFree(doc, o.slotNames, slot)) return prNo(doc, slot ? slot + ' is taken: name the aeroplane differently' : 'name the aeroplane');
  const career = !!doc.career;
  if (career && doc.wallet < L.price) return prNo(doc, 'the wallet holds ' + Math.round(doc.wallet) + ', the seller asks ' + L.price);
  const spec = procureUsedSpec(L, o.fileSpec), cert = procureUsedCert(L);
  const d = prClone(doc);
  const r = prStation(d, slot, L.aero, { foot: o.foot });
  const D2 = r.doc;
  const row = { from: 'used', listing: L.id, seed, model: L.model, maker: PROCURE_MODELS[L.model].maker, design: L.design, opts: prClone(L.opts),
                fp: procureFp(spec), cert: prClone(cert), factory: true, modified: false, price: L.price, at: Math.round(D2.clock || 0),
                hours: L.hours, repair: L.repair, kg: L.kg, ledger: o.ledger ? procureLedgerOf(o.ledger) : null };
  const mk = career ? (D2.career.market = D2.career.market || { used: [], seen: 0 }) : (D2.market = D2.market || {});
  mk.sold = (Array.isArray(mk.sold) ? mk.sold : []).concat([L.id]);
  if (career) D2.career.airframes[slot] = row;
  playerCharge(D2, L.price, 'buy', slot);
  return { ok: true, doc: D2, slot, kind: r.kind, aero: L.aero, envelope: procureEnvelope(slot, spec, row), cert, price: L.price, why: '' };
}

// ---- SIGNED ON THE AEROPLANE THE GARAGE BUILDS --------------------------------------------------------------------
// The validated build FILES are not the editor's fixpoint: the garage's join re-measures their rows when it first
// builds them, and on the heavier builds it keeps settling for a few seconds (measured on the page, G2280: the C172's
// cabin box and seat stations, the twin's drawn engine stations and the floats' station move after the load door). So
// the factory certificate is signed on the aeroplane AS THE GARAGE BUILDS IT: PROVISIONALLY while it settles (the page
// re-signs until the build is stable or the player first touches an input), then FINAL, once. A final signature is
// never moved again; every later save is held to it. opts.provisional -> the signature stays open. -> { ok, doc, why }
function procureAnchor(doc, slot, spec, opts) {
  const A = doc && doc.career && doc.career.airframes && doc.career.airframes[slot];
  if (!A || !A.factory || A.anchored) return { ok: true, doc, why: A ? (A.anchored ? 'signed already' : 'not factory-certified') : 'not an airframe of the career' };
  const fp = procureFp(spec), fin = !(opts && opts.provisional);
  if (fp === A.fp && !fin) return { ok: true, doc, why: 'unchanged' };
  const d = prClone(doc), R = d.career.airframes[slot];
  if (!R.fpFile) R.fpFile = R.fp;
  R.fp = fp;
  if (fin) R.anchored = true;
  return { ok: true, doc: d, why: '' };
}

// ---- MODIFIED (GQ2): the full editor is allowed; the certificate goes, the change is billed -----------------------
// The page calls this on every SAVE of a slot (garage.js -> app.js playerSlotsChanged) with the saved spec and the
// ledger it measured (buildGen). An airframe whose spec no longer carries its certificate's fingerprint is MODIFIED:
// `factory` false, the certificate withdrawn (kept, struck, with the reason), the change billed (dm11) once; a save
// that only repainted it (the fingerprint unmoved) changes nothing. -> { ok, doc, modified, bill, why }
function procureOnSave(doc, slot, spec, ledger) {
  const c = doc && doc.career, A = c && c.airframes && c.airframes[slot];
  if (!A) return { ok: true, doc, modified: false, bill: null, why: 'not an airframe of the career' };
  const fp = procureFp(spec);
  // a save while the signature is still open (the garage settling, no input touched yet) is the aeroplane the garage
  // built: it signs, it does not withdraw
  if (A.factory && !A.anchored) return Object.assign(procureAnchor(doc, slot, spec), { modified: false, bill: null, why: 'signed on the garage\'s aeroplane' });
  if (!A.fp || fp === A.fp) return { ok: true, doc, modified: !!A.modified, bill: null, why: A.fp ? 'the same aeroplane (a repaint is not a change)' : 'no certificate to withdraw' };
  const L1 = ledger ? procureLedgerOf(ledger) : null;
  const B = procureEditBill(A.ledger || null, L1 || A.ledger || null);
  const cost = (A.ledger && L1) ? procureEcon('edit', { cost: B.cost, slot }) : 0;
  const d = prClone(doc), R = d.career.airframes[slot];
  if (R.factory) R.withdrawn = { cert: R.cert, why: 'modified in the editor: the maker\'s certificate is withdrawn', at: Math.round(d.clock || 0) };
  R.factory = false; R.modified = true; R.fp = fp; R.cert = null;
  if (L1) R.ledger = L1;
  if (cost > 0) playerCharge(d, cost, 'edit', slot);
  return { ok: true, doc: d, modified: true, bill: { cost, lines: B.lines }, why: '' };
}
