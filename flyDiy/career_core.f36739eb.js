// GENERATED FILE - DO NOT EDIT. Built from src/core/ (MANIFEST.career) by tools/build.js (G2685 CAREER-LAZY).
// The career-only core: fetched by index.html's career loader with ?career=1 / ?map=1 / ?freight=1 or the career mode,
// run right after the page's core. tools/flight_core.js carries these modules too (the gates, the workers).
// ===========================================================================
// THE CONTRACT DATA (G2240 CONTRACT-MODEL) — the five providers, their goods,
// job tables and arcs; the fields the work runs between; the five validated
// designs the work is judged against; and every word as a TEXT KEY.
// futureDesigns/GAME-2026-10-06.md §R (G-PROV, G-COST, GQ26/GQ31), §6, §7,
// §11.2, §12.3. GATE CONTRACTS (tools/_contracts_check.js) holds it.
// ===========================================================================
// THE TEXT IS KEYS. No prose lives in a record: a record names keys
// (`title: 'ct.minedock.02.title'`), and CONTRACT_TEXT holds the plain DRAFT
// English beside each key, marked `draft: true`. The narrative pack
// (futureDesigns/game/NARRATIVE-PROMPT-PACK-2026-10-06.md, Block 5) replaces it
// later through contractImportPack (73_contracts.js), which keeps the keys.
// A `{slot}` in a text is filled at read time (contractText): {from} {to}
// {load} {at} {n}.
//
// THE PEOPLE AND ORGANISATIONS ARE FICTIONAL (GQ20, a hard constraint): the
// working names below are placeholders for the pack, and the island's real
// community is not depicted. The fields' NAMES are geography and come from the
// premises record (CONTRACT_FIELDS mirrors tools/fixtures/island_jolene.json;
// the gate holds it to the record).
//
// Pure data: no DOM, no THREE, no storage. Read by 73_contracts.js and
// 74_career.js at call time.
// ===========================================================================

// ---- THE FIELDS (the 8 runways of Jolene; GATE CONTRACTS holds every row to the record) -------------------
//   x, z     the strip's centre (the record's `c`, metres) — distances are centre to centre
//   len      the strip's length (m); surf the vocabulary word (25_airfield.js stripSurface)
//   alti     an altiport (the record's `altiport`): sloped, high, a surface bonus
//   lit      (G2665 NIGHT-OPS) the strip carries edge lights at night: 25_airfield.js runwayLightStrips' rule - every land
//            strip is lit, a water lane is not (contractFieldsOf derives it off the record, so a new site says it too)
//   glide    the record's glideslope lights (`papi`): 'vasi' (Jolene AFB's two-bar VASI) | 'papi'; absent: none
const CONTRACT_FIELDS = {
  HOME:     { id: 'HOME',     name: 'Jolene AFB 13/31',         x: -301,  z: 221,    len: 2325, surf: 'concrete', lit: true, glide: 'vasi' },
  w2:       { id: 'w2',       name: 'Jolene AFB 02/20',         x: 584,   z: -94,    len: 1835, surf: 'concrete', lit: true },
  w3:       { id: 'w3',       name: 'Tamgas Hill Strip',        x: -800,  z: -2400,  len: 520,  surf: 'gravel', lit: true, glide: 'papi' },
  SEA:      { id: 'SEA',      name: 'Annette Dock',             x: 361,   z: -3661,  len: 1500, surf: 'water', lit: false },
  mk_sea:   { id: 'mk_sea',   name: 'Metlakatla Seaplane Base', x: -3980, z: -9420,  len: 1500, surf: 'water', lit: false },
  mn_strip: { id: 'mn_strip', name: 'Jumbo Mine Street',        x: 7250,  z: -15429, len: 250,  surf: 'gravel', lit: true },
  nv_strip: { id: 'nv_strip', name: 'East Point Clearing',      x: 10030, z: -11660, len: 150,  surf: 'gravel', lit: true },
  tw_ski:   { id: 'tw_ski',   name: 'Skyline Altiport',         x: 257,   z: -7707,  len: 380,  surf: 'grass', alti: true, lit: true },
};

// ---- THE VALIDATED DESIGNS (the user's five; HANDOVER G1985's LB.VALIDATED, _treecrash_lib's BUILDS) -------
// The certificate's numbers, as genShakedown reads the build FILE (GATE CONTRACTS re-derives every number from
// the file each run, within 3 %, so this table cannot drift from the aeroplanes):
//   gear       'wheels' | 'floats' (stripGear's words)
//   seats      the cabin's seats (genShakedown envelope.seats); one is the pilot's
//   bagKg      the baggage allowance (spec.cabin.baggage)
//   massKg     the take-off mass solo with full fuel (genShakedown mass) — the TORun's mass
//   emptyKg    nobody aboard, no fuel (genShakedown empty)
//   toM        the take-off distance at massKg (genShakedown TORun: the roll + the air segment)
//   cruiseKmh  VCruise × 3.6; rangeKm genShakedown rangeKm; spanM span; cost the ledger (genShakedown cost)
//   tankL      the vessel's litres (energyL); power the energy kind (fuel | electric)
// What a design CAN DO is judged from these alone (contractCanDo, 73_): the load against the cabin, the loaded
// take-off distance against both strips, the gear against both surfaces, the range against the leg.
const CONTRACT_DESIGNS = {
  cub:    { id: 'cub',    label: 'Cub',             build: 'builds/cub_2026-09-20_corrected.json',
            gear: 'wheels', seats: 2, bagKg: 10, massKg: 476, emptyKg: 354, toM: 156,
            cruiseKmh: 113, rangeKm: 376, spanM: 10.7, cost: 31203, tankL: 47.7, power: 'fuel' },
  jodel:  { id: 'jodel',  label: 'Jodel',           build: 'builds/jodel_2026-09-20_corrected.json',
            gear: 'wheels', seats: 2, bagKg: 10, massKg: 463, emptyKg: 341, toM: 205,
            cruiseKmh: 127, rangeKm: 422, spanM: 8.3, cost: 34363, tankL: 47.7, power: 'fuel' },
  c172:   { id: 'c172',   label: 'metal Cessna',    build: 'bugReports/cessnaMetal (1).json',
            gear: 'wheels', seats: 4, bagKg: 40, massKg: 883, emptyKg: 663, toM: 147,
            cruiseKmh: 177, rangeKm: 102, spanM: 11, cost: 93783, tankL: 29.7, power: 'fuel' },
  c172f:  { id: 'c172f',  label: 'Cessna floats',   build: 'bugReports/cessnaFloatsWOrks.json',
            gear: 'floats', seats: 4, bagKg: 40, massKg: 1018, emptyKg: 798, toM: 1207,
            cruiseKmh: 204, rangeKm: 117, spanM: 11, cost: 95731, tankL: 29.7, power: 'fuel' },
  twinf:  { id: 'twinf',  label: 'twin floatplane', build: 'tools/fixtures/build_v7_ultralight_2026-09-05.json',
            patch: 'floats',
            gear: 'floats', seats: 1, bagKg: 0, massKg: 475, emptyKg: 382, toM: 310,
            cruiseKmh: 130, rangeKm: 110, spanM: 11.8, cost: 35551, tankL: 20.1, power: 'fuel' },
};

// ---- THE TRACKS (§11.2 as amended by §R G-PROV: the mine and the dock are ONE track, two projects) ----------
// Each track's stages in order, as text keys (the construction look and the finished look; STAGES draws them).
const CONTRACT_TRACKS = {
  field:    { max: 2, stages: ['trk.field.1', 'trk.field.2'] },
  minedock: { max: 4, stages: ['trk.minedock.1', 'trk.minedock.2', 'trk.minedock.3', 'trk.minedock.4'] },
  resort:   { max: 3, stages: ['trk.resort.1', 'trk.resort.2', 'trk.resort.3'] },
  survey:   { max: 3, stages: ['trk.survey.1', 'trk.survey.2', 'trk.survey.3'] },
  clients:  { max: 2, stages: ['trk.clients.1', 'trk.clients.2'] },
};

// ---- THE PROVIDERS (§R G-PROV: five) ----------------------------------------------------------------------
// id, name / desc (keys), fields (its OWN fields, its yard first), track, base (the job pay's provider base,
// credits), goods (what its jobs carry: kind kg | pax | bulk, the draw range), jobs (the job TABLE, below), arc
// (its authored contracts, in order), builds (its standalone build contracts, offered beside the arc).
//
// THE JOB TABLE (G2430 CONTRACT-ROUTES, §R.3: "most missions should involve 2 destinations, or more ... not
// everything should start from Jolene AFB"). A template names WHERE its legs may run as POOLS, never as route
// pairs, and the SHAPES it comes in (weights); the generator (73_ contractJob) draws a shape, then a route of
// that shape among the pools that ONE validated design can fly end to end, then a load per leg:
//   from / to / on   the pools of the pickup (A), the first stop (B) and the onward stop (C):
//                    'own'  the provider's `fields`        'away'  the island's job fields that are not its own
//                    'all'  the island's job fields         [ids]   a list (an overflight site may be any field)
//   back             the goods of the SECOND leg (a backhaul / an onward load; default: the same goods)
//   shapes           p2p    A -> B                          one leg
//                    back   A -> B, then goods `back` B -> A   ("maybe take that back")
//                    onward A -> B, then goods `back` B -> C   (picked up at B)
//                    milk   A -> B -> C: part of the load left at B, the rest on to C
//   survey           { from, at, to }: a survey template's pools, its shapes
//                    loop   over X from A, back to A        pair   over X and Y, back to A
//                    transit over X from A, land at B (pool `to`)
// THE ISLAND'S JOB FIELDS are every provider's `fields`, in provider order (73_ contractSites): A NEW SITE JOINS
// THE JOBS BY DATA ALONE - its row in CONTRACT_FIELDS (the island record's runway, held by GATE CONTRACTS), then
// its id in the `fields` of each provider that works there (the lake cabins: the clients' and the survey's).
// The Field Trust's second runway (w2) and East Point (no validated design lands there) are in no provider's list.
// THE NIGHT WORK (G2665 NIGHT-OPS, §R.3 "do we have some night missions? Night VFR is terrorizing"): a provider's
// `night` list holds its AUTHORED night contracts (a time-of-day window on the sim clock: after dusk, before dawn,
// arrive hh-hh), offered beside the arc once their `needs` are met, each once. The generated jobs carry night windows
// too (73_ CONTRACT_NIGHT: a share of the carry jobs, weighted toward moonlit nights). A night contract no validated
// design can fly is HELD OUT (74_ careerOfferIds), as the aerobatic box is: the stretcher case waits for a door.
const C_ = (o) => o;   // (a marker: an authored record)
const CONTRACT_PROVIDERS = {
  field: {
    id: 'field', name: 'prov.field.name', desc: 'prov.field.desc', track: 'field', base: 250,
    fields: ['HOME', 'w3'],
    goods: [
      { id: 'mail',  kind: 'kg',  kg: [10, 40],  word: 'goods.mail' },
      { id: 'tools', kind: 'kg',  kg: [20, 80],  word: 'goods.tools' },
      { id: 'crew',  kind: 'pax', pax: [1, 2],   word: 'goods.crew' },
    ],
    jobs: [
      { id: 'mail',  goods: 'mail',  w: 3, title: 'job.field.mail.title',  brief: 'job.field.mail.brief',
        from: 'all', to: 'all', shapes: { p2p: 1, back: 2, milk: 2 } },
      { id: 'tools', goods: 'tools', w: 2, title: 'job.field.tools.title', brief: 'job.field.tools.brief',
        from: 'own', to: 'all', back: 'mail', shapes: { p2p: 1, back: 1, onward: 2 } },
      { id: 'crew',  goods: 'crew',  w: 2, title: 'job.field.crew.title',  brief: 'job.field.crew.brief',
        from: 'own', to: 'all', shapes: { p2p: 1, back: 2, milk: 1 } },
    ],
    arc: [
      C_({ id: 'field.01', provider: 'field', kind: 'contract', title: 'ct.field.01.title', brief: 'ct.field.01.brief',
           stages: [{ subs: [{ do: 'land', to: 'w3' }] }, { subs: [{ do: 'land', to: 'HOME' }] }],
           pay: { base: 1200 }, rep: { provider: 'field', gain: 0.5 } }),
      C_({ id: 'field.02', provider: 'field', kind: 'contract', title: 'ct.field.02.title', brief: 'ct.field.02.brief',
           stages: [{ subs: [{ do: 'carry', from: 'w3', to: 'HOME', load: { kg: 40, pax: 0 } }] }],
           pay: { base: 1800 }, rep: { provider: 'field', gain: 0.5 }, needs: { after: ['field.01'] } }),
      C_({ id: 'field.03', provider: 'field', kind: 'contract', title: 'ct.field.03.title', brief: 'ct.field.03.brief',
           stages: [{ subs: [{ do: 'carry', from: 'HOME', to: 'w3', load: { kg: 25, pax: 0 } },
                             { do: 'carry', from: 'HOME', to: 'tw_ski', load: { kg: 25, pax: 0 } }] }],
           pay: { base: 2600 }, rep: { provider: 'field', gain: 0.75 }, unlock: { stage: 'field:1' },
           needs: { after: ['field.02'] } }),
      C_({ id: 'field.04', provider: 'field', kind: 'contract', title: 'ct.field.04.title', brief: 'ct.field.04.brief',
           stages: [{ subs: [{ do: 'carry', from: 'HOME', to: 'w3', load: { kg: 0, pax: 1 } }] },
                    { subs: [{ do: 'carry', from: 'w3', to: 'HOME', load: { kg: 0, pax: 1 } }] }],
           pay: { base: 3000 }, rep: { provider: 'field', gain: 0.75 }, needs: { after: ['field.03'] } }),
      C_({ id: 'field.05', provider: 'field', kind: 'contract', title: 'ct.field.05.title', brief: 'ct.field.05.brief',
           stages: [{ subs: [{ do: 'carry', from: 'w3', to: 'HOME', load: { kg: 120, pax: 0 } }] }],
           pay: { base: 4500 }, rep: { provider: 'field', gain: 1 }, unlock: { stage: 'field:2' },
           needs: { rep: 1, after: ['field.04'] } }),
    ],
    builds: [],
    // (G2665) THE NIGHT MAIL into the lit field (its VASI): the boat's sacks from Tamgas Hill, arriving past midnight
    night: [
      C_({ id: 'field.n1', provider: 'field', kind: 'contract', title: 'ct.field.n1.title', brief: 'ct.field.n1.brief',
           stages: [{ subs: [{ do: 'carry', from: 'w3', to: 'HOME', goods: 'goods.mail', load: { kg: 30, pax: 0 }, when: { arrive: [0, 1] } }] }],
           pay: { base: 1900 }, rep: { provider: 'field', gain: 0.25 }, needs: { after: ['field.02'] } }),
    ],
  },

  minedock: {
    id: 'minedock', name: 'prov.minedock.name', desc: 'prov.minedock.desc', track: 'minedock', base: 400,
    fields: ['mn_strip', 'SEA', 'mk_sea'],
    goods: [
      { id: 'parts',   kind: 'kg',   kg: [20, 160], word: 'goods.parts' },
      { id: 'samples', kind: 'kg',   kg: [15, 60],  word: 'goods.samples' },
      { id: 'crew',    kind: 'pax',  pax: [1, 2],   word: 'goods.crew' },
      { id: 'rods',    kind: 'bulk', kg: [60, 110], word: 'goods.rods' },
      { id: 'mail',    kind: 'kg',   kg: [10, 60],  word: 'goods.mail' },
      { id: 'fish',    kind: 'none',                word: 'goods.fish' },
    ],
    jobs: [
      { id: 'parts',   goods: 'parts',   w: 3, title: 'job.minedock.parts.title',   brief: 'job.minedock.parts.brief',
        from: 'away', to: 'own', back: 'samples', shapes: { p2p: 1, back: 2 } },
      { id: 'samples', goods: 'samples', w: 2, title: 'job.minedock.samples.title', brief: 'job.minedock.samples.brief',
        from: 'own', to: 'away', back: 'parts', shapes: { p2p: 1, back: 2, onward: 1 } },
      { id: 'crew',    goods: 'crew',    w: 2, title: 'job.minedock.crew.title',    brief: 'job.minedock.crew.brief',
        from: 'own', to: 'away', shapes: { p2p: 1, back: 2, milk: 1 } },
      { id: 'rods',    goods: 'rods',    w: 1, title: 'job.minedock.rods.title',    brief: 'job.minedock.rods.brief',
        from: 'away', to: 'all', shapes: { p2p: 1 } },
      { id: 'mail',    goods: 'mail',    w: 2, title: 'job.minedock.mail.title',    brief: 'job.minedock.mail.brief',
        from: 'own', to: 'own', shapes: { p2p: 1, back: 2 } },
      { id: 'fish',    goods: 'fish',    w: 2, title: 'job.minedock.fish.title',    brief: 'job.minedock.fish.brief',
        survey: { from: 'own', at: ['SEA', 'mk_sea', 'w3'] }, shapes: { loop: 1, pair: 2 } },
    ],
    arc: [
      C_({ id: 'minedock.01', provider: 'minedock', kind: 'contract', title: 'ct.minedock.01.title', brief: 'ct.minedock.01.brief',
           stages: [{ subs: [{ do: 'survey', from: 'HOME', at: 'mn_strip' }] }, { subs: [{ do: 'land', to: 'HOME' }] }],
           pay: { base: 2200 }, rep: { provider: 'minedock', gain: 0.5 } }),
      C_({ id: 'minedock.02', provider: 'minedock', kind: 'contract', title: 'ct.minedock.02.title', brief: 'ct.minedock.02.brief',
           stages: [{ subs: [{ do: 'carry', from: 'HOME', to: 'mn_strip', load: { kg: 0, pax: 2 } }] }],
           pay: { base: 3500 }, rep: { provider: 'minedock', gain: 0.75 }, unlock: { stage: 'minedock:1' },
           needs: { after: ['minedock.01'] } }),
      C_({ id: 'minedock.03', provider: 'minedock', kind: 'contract', title: 'ct.minedock.03.title', brief: 'ct.minedock.03.brief',
           stages: [{ subs: [{ do: 'carry', from: 'HOME', to: 'mn_strip', load: { kg: 120, pax: 0 } }] },
                    { subs: [{ do: 'carry', from: 'mn_strip', to: 'w3', load: { kg: 40, pax: 0 } }] }],
           pay: { base: 5200 }, rep: { provider: 'minedock', gain: 0.75 }, needs: { after: ['minedock.02'] } }),
      C_({ id: 'minedock.04', provider: 'minedock', kind: 'build', title: 'ct.minedock.04.title', brief: 'ct.minedock.04.brief',
           stages: [{ subs: [{ do: 'deliver', to: 'mn_strip', crit: [
             { k: 'seats', op: '>=', v: 4 },
             { k: 'tasKmh', op: '>=', v: 200, at: { pax: 3, kg: 0 } },
             { k: 'landAt', op: '==', v: 'mn_strip', at: { pax: 3, kg: 0 } }] }] }],
           pay: { base: 52000, bonus: [{ crit: 'tasKmh', by: 0.1, pct: 10 }] },
           rep: { provider: 'minedock', gain: 1 }, unlock: { stage: 'minedock:2' },
           needs: { rep: 1, after: ['minedock.03'] }, followUp: { prefer: ['tasKmh', 'seats'] } }),
      C_({ id: 'minedock.05', provider: 'minedock', kind: 'contract', title: 'ct.minedock.05.title', brief: 'ct.minedock.05.brief',
           stages: [{ subs: [{ do: 'carry', from: 'SEA', to: 'mk_sea', load: { kg: 30, pax: 0 } },
                             { do: 'survey', from: 'mk_sea', at: 'SEA' }] }],
           pay: { base: 4200 }, rep: { provider: 'minedock', gain: 0.75 }, unlock: { stage: 'minedock:3' },
           needs: { after: ['minedock.04'] } }),
      C_({ id: 'minedock.06', provider: 'minedock', kind: 'contract', title: 'ct.minedock.06.title', brief: 'ct.minedock.06.brief',
           stages: [{ subs: [{ do: 'carry', from: 'mk_sea', to: 'SEA', load: { kg: 60, pax: 0 } }] }],
           pay: { base: 6000 }, rep: { provider: 'minedock', gain: 1 }, unlock: { stage: 'minedock:4' },
           needs: { rep: 2, after: ['minedock.05'] } }),
    ],
    builds: [
      C_({ id: 'minedock.b1', provider: 'minedock', kind: 'build', title: 'ct.minedock.b1.title', brief: 'ct.minedock.b1.brief',
           stages: [{ subs: [{ do: 'deliver', to: 'SEA', crit: [
             { k: 'hydro', op: '==', v: true },
             { k: 'landAt', op: '==', v: 'SEA', at: { pax: 0, kg: 150 } }] }] }],
           pay: { base: 48000 }, rep: { provider: 'minedock', gain: 1 }, needs: { rep: 1 },
           followUp: { prefer: ['tankL', 'costMax'], add: [{ k: 'costMax', op: '<=', v: 110000 }] } }),
      C_({ id: 'minedock.b2', provider: 'minedock', kind: 'build', title: 'ct.minedock.b2.title', brief: 'ct.minedock.b2.brief',
           stages: [{ subs: [{ do: 'deliver', to: 'mn_strip', crit: [
             { k: 'takeoffAt', op: '==', v: 'mn_strip', at: { pax: 0, kg: 200 } },
             { k: 'landAt', op: '==', v: 'mn_strip', at: { pax: 0, kg: 200 } }] }] }],
           pay: { base: 56000 }, rep: { provider: 'minedock', gain: 1 }, needs: { rep: 2 },
           followUp: { add: [{ k: 'costMax', op: '<=', v: 120000 }, { k: 'rangeKm', op: '>=', v: 150 }] } }),
    ],
    // (G2665) A LATE RETURN from the mine: the shift's engineer down to the field after dusk
    night: [
      C_({ id: 'minedock.n1', provider: 'minedock', kind: 'contract', title: 'ct.minedock.n1.title', brief: 'ct.minedock.n1.brief',
           stages: [{ subs: [{ do: 'carry', from: 'mn_strip', to: 'HOME', load: { kg: 0, pax: 1 }, when: { after: 'dusk' } }] }],
           pay: { base: 2400 }, rep: { provider: 'minedock', gain: 0.25 }, needs: { after: ['minedock.02'] } }),
    ],
  },

  resort: {
    id: 'resort', name: 'prov.resort.name', desc: 'prov.resort.desc', track: 'resort', base: 350,
    fields: ['tw_ski'],
    goods: [
      { id: 'guests',   kind: 'pax', pax: [1, 3],  word: 'goods.guests' },
      { id: 'supplies', kind: 'kg',  kg: [20, 90], word: 'goods.supplies' },
      { id: 'sights',   kind: 'none',              word: 'goods.sights' },
    ],
    jobs: [
      { id: 'guests',   goods: 'guests',   w: 3, title: 'job.resort.guests.title',   brief: 'job.resort.guests.brief',
        from: 'own', to: 'away', shapes: { p2p: 1, back: 2, milk: 1 } },
      { id: 'supplies', goods: 'supplies', w: 2, title: 'job.resort.supplies.title', brief: 'job.resort.supplies.brief',
        from: ['HOME', 'w3'], to: 'own', back: 'guests', shapes: { p2p: 1, back: 2 } },
      { id: 'sights',   goods: 'sights',   w: 2, title: 'job.resort.sights.title',   brief: 'job.resort.sights.brief',
        survey: { from: 'own', at: ['w3', 'mk_sea', 'mn_strip', 'SEA'], to: 'away' }, shapes: { loop: 1, pair: 1, transit: 1 } },
    ],
    arc: [
      C_({ id: 'resort.01', provider: 'resort', kind: 'contract', title: 'ct.resort.01.title', brief: 'ct.resort.01.brief',
           stages: [{ subs: [{ do: 'carry', from: 'HOME', to: 'tw_ski', load: { kg: 0, pax: 1 } }] }],
           pay: { base: 1800 }, rep: { provider: 'resort', gain: 0.5 } }),
      C_({ id: 'resort.02', provider: 'resort', kind: 'contract', title: 'ct.resort.02.title', brief: 'ct.resort.02.brief',
           stages: [{ subs: [{ do: 'carry', from: 'w3', to: 'tw_ski', load: { kg: 80, pax: 0 } }] }],
           pay: { base: 2800 }, rep: { provider: 'resort', gain: 0.75 }, unlock: { stage: 'resort:1' },
           needs: { after: ['resort.01'] } }),
      C_({ id: 'resort.03', provider: 'resort', kind: 'contract', title: 'ct.resort.03.title', brief: 'ct.resort.03.brief',
           stages: [{ subs: [{ do: 'survey', from: 'tw_ski', at: 'w3' }] }, { subs: [{ do: 'land', to: 'tw_ski' }] }],
           pay: { base: 2400 }, rep: { provider: 'resort', gain: 0.5 }, needs: { after: ['resort.02'] } }),
      C_({ id: 'resort.04', provider: 'resort', kind: 'build', title: 'ct.resort.04.title', brief: 'ct.resort.04.brief',
           stages: [{ subs: [{ do: 'deliver', to: 'tw_ski', crit: [
             { k: 'powertrain', op: '==', v: 'electric' },
             { k: 'seats', op: '>=', v: 2 },
             { k: 'enduranceMin', op: '>=', v: 30, at: { pax: 1, kg: 0, reserveMin: 10 } },
             { k: 'landAt', op: '==', v: 'tw_ski', at: { pax: 1, kg: 0 } }] }] }],
           pay: { base: 46000, bonus: [{ crit: 'enduranceMin', by: 0.2, pct: 10 }] },
           rep: { provider: 'resort', gain: 1 }, unlock: { stage: 'resort:2' },
           needs: { rep: 1, after: ['resort.03'] }, followUp: { prefer: ['enduranceMin', 'seats'] } }),
      C_({ id: 'resort.05', provider: 'resort', kind: 'contract', title: 'ct.resort.05.title', brief: 'ct.resort.05.brief',
           stages: [{ subs: [{ do: 'carry', from: 'HOME', to: 'tw_ski', load: { kg: 0, pax: 2 } },
                             { do: 'carry', from: 'w3', to: 'tw_ski', load: { kg: 40, pax: 0 } }] }],
           pay: { base: 5800 }, rep: { provider: 'resort', gain: 1 }, unlock: { stage: 'resort:3' },
           needs: { rep: 2, after: ['resort.04'] } }),
    ],
    builds: [
      C_({ id: 'resort.b1', provider: 'resort', kind: 'build', title: 'ct.resort.b1.title', brief: 'ct.resort.b1.brief',
           stages: [{ subs: [{ do: 'deliver', to: 'tw_ski', crit: [
             { k: 'seats', op: '>=', v: 4 },
             { k: 'landAt', op: '==', v: 'tw_ski', at: { pax: 3, kg: 0 } },
             { k: 'takeoffAt', op: '==', v: 'tw_ski', at: { pax: 3, kg: 0 } }] }] }],
           pay: { base: 50000 }, rep: { provider: 'resort', gain: 1 }, needs: { rep: 1 },
           followUp: { prefer: ['seats'], add: [{ k: 'tasKmh', op: '>=', v: 180, at: { pax: 3, kg: 0 } }] } }),
      C_({ id: 'resort.b2', provider: 'resort', kind: 'build', title: 'ct.resort.b2.title', brief: 'ct.resort.b2.brief',
           stages: [{ subs: [{ do: 'deliver', to: 'tw_ski', crit: [
             { k: 'xwindKt', op: '>=', v: 15 },
             { k: 'landAt', op: '==', v: 'tw_ski', at: { pax: 1, kg: 0 } }] }] }],
           pay: { base: 38000 }, rep: { provider: 'resort', gain: 1 }, needs: { rep: 2 },
           followUp: { prefer: ['xwindKt'], add: [{ k: 'costMax', op: '<=', v: 60000 }] } }),
    ],
  },

  survey: {
    id: 'survey', name: 'prov.survey.name', desc: 'prov.survey.desc', track: 'survey', base: 300,
    fields: ['HOME', 'w3', 'mk_sea', 'SEA'],
    goods: [
      { id: 'count',   kind: 'none',             word: 'goods.count' },
      { id: 'samples', kind: 'kg',   kg: [10, 40], word: 'goods.water' },
      { id: 'gear',    kind: 'kg',   kg: [20, 70], word: 'goods.gear' },
    ],
    jobs: [
      { id: 'count',   goods: 'count',   w: 3, title: 'job.survey.count.title',   brief: 'job.survey.count.brief',
        survey: { from: 'own', at: ['nv_strip', 'mn_strip', 'mk_sea', 'tw_ski'], to: 'all' }, shapes: { loop: 1, pair: 2, transit: 1 } },
      { id: 'samples', goods: 'samples', w: 2, title: 'job.survey.samples.title', brief: 'job.survey.samples.brief',
        from: 'own', to: 'own', shapes: { p2p: 1, back: 2 } },
      { id: 'gear',    goods: 'gear',    w: 2, title: 'job.survey.gear.title',    brief: 'job.survey.gear.brief',
        from: 'own', to: 'all', back: 'samples', shapes: { p2p: 1, back: 1, milk: 1 } },
    ],
    arc: [
      C_({ id: 'survey.01', provider: 'survey', kind: 'survey', title: 'ct.survey.01.title', brief: 'ct.survey.01.brief',
           stages: [{ subs: [{ do: 'survey', from: 'HOME', at: 'nv_strip' }] }, { subs: [{ do: 'land', to: 'HOME' }] }],
           pay: { base: 2000 }, rep: { provider: 'survey', gain: 0.5 } }),
      C_({ id: 'survey.02', provider: 'survey', kind: 'contract', title: 'ct.survey.02.title', brief: 'ct.survey.02.brief',
           stages: [{ subs: [{ do: 'carry', from: 'mk_sea', to: 'SEA', load: { kg: 20, pax: 0 } }] }],
           pay: { base: 2600 }, rep: { provider: 'survey', gain: 0.5 }, needs: { after: ['survey.01'] } }),
      C_({ id: 'survey.03', provider: 'survey', kind: 'survey', title: 'ct.survey.03.title', brief: 'ct.survey.03.brief',
           stages: [{ subs: [{ do: 'survey', from: 'HOME', at: 'nv_strip' }, { do: 'survey', from: 'HOME', at: 'mn_strip' }] },
                    { subs: [{ do: 'land', to: 'HOME' }] }],
           pay: { base: 3400 }, rep: { provider: 'survey', gain: 0.75 }, unlock: { stage: 'survey:1' },
           needs: { after: ['survey.02'] } }),
      C_({ id: 'survey.04', provider: 'survey', kind: 'build', title: 'ct.survey.04.title', brief: 'ct.survey.04.brief',
           stages: [{ subs: [{ do: 'deliver', to: 'nv_strip', crit: [
             { k: 'takeoffAt', op: '==', v: 'nv_strip', at: { pax: 0, kg: 0, fuelMin: 60 } },
             { k: 'landAt', op: '==', v: 'nv_strip', at: { pax: 0, kg: 0, fuelMin: 60 } }] }] }],
           pay: { base: 44000 }, rep: { provider: 'survey', gain: 1 }, unlock: { stage: 'survey:2' },
           needs: { rep: 1, after: ['survey.03'] },
           followUp: { add: [{ k: 'seats', op: '>=', v: 2 }, { k: 'emptyKg', op: '<=', v: 380 }] } }),
      C_({ id: 'survey.05', provider: 'survey', kind: 'contract', title: 'ct.survey.05.title', brief: 'ct.survey.05.brief',
           stages: [{ subs: [{ do: 'carry', from: 'HOME', to: 'w3', load: { kg: 100, pax: 0 } }] },
                    { subs: [{ do: 'carry', from: 'w3', to: 'HOME', load: { kg: 20, pax: 0 } }] }],
           pay: { base: 4800 }, rep: { provider: 'survey', gain: 1 }, unlock: { stage: 'survey:3' },
           needs: { rep: 2, after: ['survey.04'] } }),
    ],
    builds: [],
  },

  clients: {
    id: 'clients', name: 'prov.clients.name', desc: 'prov.clients.desc', track: 'clients', base: 300,
    fields: ['HOME', 'w3', 'tw_ski', 'SEA', 'mk_sea'],
    goods: [
      { id: 'pax',   kind: 'pax', pax: [1, 3],  word: 'goods.pax' },
      { id: 'kit',   kind: 'kg',  kg: [15, 60], word: 'goods.kit' },
      { id: 'canoe', kind: 'bulk', kg: [40, 70], word: 'goods.canoe' },
    ],
    jobs: [
      { id: 'charter', goods: 'pax',   w: 3, title: 'job.clients.charter.title', brief: 'job.clients.charter.brief',
        from: 'own', to: 'all', shapes: { p2p: 1, back: 2, milk: 1, onward: 1 } },
      { id: 'kit',     goods: 'kit',   w: 2, title: 'job.clients.kit.title',     brief: 'job.clients.kit.brief',
        from: 'all', to: 'all', shapes: { p2p: 1, onward: 1, milk: 1 } },
      { id: 'canoe',   goods: 'canoe', w: 1, title: 'job.clients.canoe.title',   brief: 'job.clients.canoe.brief',
        from: 'own', to: 'all', shapes: { p2p: 1, back: 1 } },
    ],
    arc: [
      C_({ id: 'clients.01', provider: 'clients', kind: 'contract', title: 'ct.clients.01.title', brief: 'ct.clients.01.brief',
           stages: [{ subs: [{ do: 'carry', from: 'HOME', to: 'w3', load: { kg: 0, pax: 1 } }] },
                    { subs: [{ do: 'carry', from: 'w3', to: 'tw_ski', load: { kg: 0, pax: 1 } }] }],
           pay: { base: 1500 }, rep: { provider: 'clients', gain: 0.5 } }),
      C_({ id: 'clients.02', provider: 'clients', kind: 'build', title: 'ct.clients.02.title', brief: 'ct.clients.02.brief',
           stages: [{ subs: [{ do: 'deliver', to: 'HOME', crit: [
             { k: 'emptyKg', op: '<=', v: 300 },
             { k: 'spanM', op: '<=', v: 9 },
             { k: 'seats', op: '>=', v: 1 }] }] }],
           pay: { base: 30000, bonus: [{ crit: 'emptyKg', by: 0.1, pct: 10 }] },
           rep: { provider: 'clients', gain: 1 }, needs: { after: ['clients.01'] },
           followUp: { prefer: ['emptyKg', 'spanM'], add: [{ k: 'costMax', op: '<=', v: 30000 }] } }),
      C_({ id: 'clients.03', provider: 'clients', kind: 'challenge', title: 'ct.clients.03.title', brief: 'ct.clients.03.brief',
           stages: [{ subs: [{ do: 'fly', from: 'tw_ski', to: 'HOME',
                               medals: [{ medal: 'gold', le: 300 }, { medal: 'silver', le: 420 }, { medal: 'bronze', le: 540 }] }] }],
           pay: { base: 2000, bonus: [{ crit: 'medal', by: 'gold', pct: 100 }, { crit: 'medal', by: 'silver', pct: 50 }] },
           rep: { provider: 'clients', gain: 0.75 }, unlock: { stage: 'clients:1' }, needs: { after: ['clients.02'] } }),
      C_({ id: 'clients.04', provider: 'clients', kind: 'build', title: 'ct.clients.04.title', brief: 'ct.clients.04.brief',
           stages: [{ subs: [{ do: 'deliver', to: 'HOME', crit: [
             { k: 'costMax', op: '<=', v: 25000 },
             { k: 'xwindKt', op: '>=', v: 12 },
             { k: 'seats', op: '>=', v: 2 }] }] }],
           pay: { base: 26000 }, rep: { provider: 'clients', gain: 1 }, needs: { rep: 1, after: ['clients.03'] },
           followUp: { prefer: ['costMax', 'xwindKt'] } }),
      C_({ id: 'clients.05', provider: 'clients', kind: 'build', title: 'ct.clients.05.title', brief: 'ct.clients.05.brief',
           stages: [{ subs: [{ do: 'deliver', to: 'HOME', crit: [
             { k: 'ultimateG', op: '>=', v: 6 },
             { k: 'tasKmh', op: '>=', v: 160, at: { pax: 0, kg: 0 } }] }] }],
           pay: { base: 42000 }, rep: { provider: 'clients', gain: 1 }, unlock: { stage: 'clients:2' },
           needs: { rep: 2, after: ['clients.04'] }, followUp: { prefer: ['ultimateG', 'tasKmh'] } }),
    ],
    builds: [
      C_({ id: 'clients.b1', provider: 'clients', kind: 'build', title: 'ct.clients.b1.title', brief: 'ct.clients.b1.brief',
           stages: [{ subs: [{ do: 'deliver', to: 'HOME', crit: [
             { k: 'tankL', op: '<=', v: 20 },
             { k: 'enduranceMin', op: '>=', v: 60, at: { pax: 0, kg: 0, reserveMin: 15, tasKmh: 110 } }] }] }],
           pay: { base: 34000, bonus: [{ crit: 'enduranceMin', by: 0.15, pct: 10 }] },
           rep: { provider: 'clients', gain: 1 }, needs: { rep: 0.5 },
           followUp: { prefer: ['tankL', 'enduranceMin'], add: [{ k: 'hydro', op: '==', v: true }] } }),
    ],
    // (G2665) THE NIGHT MEDEVAC (FREIGHT §4b; the lake cabins are not built yet, so from Tamgas Hill Strip): the doctor up,
    // then the patient and the doctor down to the ambulance at Jolene AFB before dawn. The patient SITS: no validated
    // design's door takes the 2.0 m stretcher (GATE FREIGHT), so the stretcher case (n2, FREIGHT_STRETCHER's item) is
    // authored and HELD OUT until a door takes it - never a job the player cannot fly
    night: [
      C_({ id: 'clients.n1', provider: 'clients', kind: 'contract', title: 'ct.clients.n1.title', brief: 'ct.clients.n1.brief',
           stages: [{ subs: [{ do: 'carry', from: 'HOME', to: 'w3', load: { kg: 0, pax: 1 } }] },
                    { subs: [{ do: 'carry', from: 'w3', to: 'HOME', load: { kg: 0, pax: 2 }, when: { before: 'dawn' } }] }],
           pay: { base: 2800 }, rep: { provider: 'clients', gain: 0.5 }, needs: { after: ['clients.01'] } }),
      C_({ id: 'clients.n2', provider: 'clients', kind: 'contract', title: 'ct.clients.n2.title', brief: 'ct.clients.n2.brief',
           stages: [{ subs: [{ do: 'carry', from: 'w3', to: 'HOME', when: { before: 'dawn' },
                               load: { kg: 95, pax: 1, items: [{ id: 'stretcher', kind: 'stretcher', kg: 95, dims: [2.0, 0.6, 0.5] }] } }] }],
           pay: { base: 3400 }, rep: { provider: 'clients', gain: 0.5 }, needs: { after: ['clients.n1'] } }),
    ],
  },
};

// ---- THE TEXT (draft English, every key; the narrative pack replaces it, keeping the keys) ------------------
const CT_ = t => ({ t, draft: true });
const CONTRACT_TEXT = {
  // the providers (working names; GQ20: fictional)
  'prov.field.name': CT_('The Field Trust'),
  'prov.field.desc': CT_('The old Army field\'s landlord. They lease it to anyone who will bring it back to life.'),
  'prov.minedock.name': CT_('Jumbo Mine & Dock Co.'),
  'prov.minedock.desc': CT_('One company reopening the old mine up the street strip and shipping through Annette Dock.'),
  'prov.resort.name': CT_('Skyline Resort'),
  'prov.resort.desc': CT_('A small lodge above the hill, with a sloped strip and guests who want to see it all.'),
  'prov.survey.name': CT_('The Survey Office'),
  'prov.survey.desc': CT_('Two desks and a lot of coast. Counts, samples, and new places to land.'),
  'prov.clients.name': CT_('Private clients & the Club'),
  'prov.clients.desc': CT_('People who want an aeroplane nobody sells, and a club that likes a challenge.'),
  // (G2320 CAREER-WIRE) the providers' short names (the MAP's tabs)
  'prov.field.short': CT_('Trust'), 'prov.minedock.short': CT_('Mine & Dock'), 'prov.resort.short': CT_('Resort'),
  'prov.survey.short': CT_('Survey'), 'prov.clients.short': CT_('Clients'),
  // the tracks' stages (what goes up; STAGES draws them)
  'trk.field.1': CT_('The second hangar\'s shell, under repair'),
  'trk.field.2': CT_('The second hangar restored and the old tower lit'),
  'trk.minedock.1': CT_('The headframe\'s frame on the hill'),
  'trk.minedock.2': CT_('The headframe and the ore shed'),
  'trk.minedock.3': CT_('The pier extension, under way'),
  'trk.minedock.4': CT_('The cold store and the slipway'),
  'trk.resort.1': CT_('The lodge\'s frame'),
  'trk.resort.2': CT_('The lodge'),
  'trk.resort.3': CT_('The strip lengthened'),
  'trk.survey.1': CT_('A windsock and tie-downs at East Point'),
  'trk.survey.2': CT_('East Point becomes a station'),
  'trk.survey.3': CT_('The weather mast on Tamgas Hill'),
  'trk.clients.1': CT_('The club house'),
  'trk.clients.2': CT_('A small museum hangar for your best design'),
  // goods (the load words)
  'goods.mail': CT_('mail'), 'goods.tools': CT_('tools'), 'goods.crew': CT_('crew'),
  'goods.parts': CT_('parts'), 'goods.samples': CT_('ore samples'), 'goods.rods': CT_('drill rods'),
  'goods.fish': CT_('fish spotting'), 'goods.guests': CT_('guests'), 'goods.supplies': CT_('supplies'),
  'goods.sights': CT_('sightseeing'), 'goods.count': CT_('a wildlife count'), 'goods.water': CT_('water samples'),
  'goods.gear': CT_('survey gear'), 'goods.pax': CT_('passengers'), 'goods.kit': CT_('a client\'s kit'),
  'goods.canoe': CT_('a canoe'),
  // the load as a line ({n}: a number)
  'load.kg': CT_('{n} kg of {what}'), 'load.pax1': CT_('1 passenger'), 'load.pax': CT_('{n} passengers'),
  'load.bulk': CT_('{what} ({n} kg, the cabin cleared)'), 'load.none': CT_('{what}'),
  // the job table (templates; {from} {to} {load} {at})
  'job.field.mail.title': CT_('Mail to {to}'), 'job.field.mail.brief': CT_('{load}, {from} to {to}.{then}'),
  'job.field.tools.title': CT_('Tools for {to}'), 'job.field.tools.brief': CT_('The Trust needs {load} at {to}, from {from}.{then}'),
  'job.field.crew.title': CT_('A lift to {to}'), 'job.field.crew.brief': CT_('{load} from {from} to {to}.{then}'),
  'job.minedock.parts.title': CT_('Parts for the mine'), 'job.minedock.parts.brief': CT_('{load} from {from} up to {to}.{then}'),
  'job.minedock.samples.title': CT_('Samples out'), 'job.minedock.samples.brief': CT_('{load} from {from} to {to}.{then}'),
  'job.minedock.crew.title': CT_('Crew change'), 'job.minedock.crew.brief': CT_('{load}, {from} to {to}.{then}'),
  'job.minedock.rods.title': CT_('Drill rods'), 'job.minedock.rods.brief': CT_('{load}. Long and awkward: {from} to {to}.{then}'),
  'job.minedock.mail.title': CT_('Mail off the water'), 'job.minedock.mail.brief': CT_('{load}, {from} to {to}.{then}'),
  'job.minedock.fish.title': CT_('Spot the fish'), 'job.minedock.fish.brief': CT_('Fly out over {at}{then} Tell the boats what you see.'),
  'job.resort.guests.title': CT_('Guests for the lodge'), 'job.resort.guests.brief': CT_('{load}, {from} to {to}.{then}'),
  'job.resort.supplies.title': CT_('Supplies uphill'), 'job.resort.supplies.brief': CT_('{load} for the kitchen, {from} to {to}.{then}'),
  'job.resort.sights.title': CT_('A sightseeing loop'), 'job.resort.sights.brief': CT_('Over {at}, slowly{then}'),
  'job.survey.count.title': CT_('Count over {at}'), 'job.survey.count.brief': CT_('Fly over {at} for the count{then}'),
  'job.survey.samples.title': CT_('Water samples'), 'job.survey.samples.brief': CT_('{load}, {from} to {to}. Keep them upright.{then}'),
  'job.survey.gear.title': CT_('Gear to {to}'), 'job.survey.gear.brief': CT_('{load} for a field team at {to}, from {from}.{then}'),
  'job.clients.charter.title': CT_('A charter to {to}'), 'job.clients.charter.brief': CT_('{load}, {from} to {to}.{then}'),
  'job.clients.kit.title': CT_('A parcel for {to}'), 'job.clients.kit.brief': CT_('{load}, {from} to {to}.{then}'),
  'job.clients.canoe.title': CT_('A canoe to {to}'), 'job.clients.canoe.brief': CT_('{load}. Do not ask why. {from} to {to}.{then}'),
  // (G2430 CONTRACT-ROUTES) a job's next leg, as its brief's {then} (73_ contractVars: {from} {to} {load} {at} are
  // the NEXT leg's; a one-leg job's {then} is empty)
  'job.then.back': CT_(' Then {load} back to {to}.'),
  'job.then.onward': CT_(' Then {load} from {from} on to {to}.'),
  'job.then.milk': CT_(' Part of it stays at {from}; {load} on to {to}.'),
  'job.then.loop': CT_(', then back to {from}.'),
  'job.then.pair': CT_(', then over {at}, then back to {from}.'),
  'job.then.transit': CT_(', then land at {to}.'),
  // the arcs
  'ct.field.01.title': CT_('Wake the field'), 'ct.field.01.brief': CT_('Show us the old field still flies: over to Tamgas Hill and back.'),
  'ct.field.01.done': CT_('Two landings, no drama. The Trust is listening.'),
  'ct.field.02.title': CT_('Tools from the hill'), 'ct.field.02.brief': CT_('A crate of hand tools waits at Tamgas Hill. Bring it home.'),
  'ct.field.02.done': CT_('The bench has tools again.'),
  'ct.field.03.title': CT_('The first mail run'), 'ct.field.03.brief': CT_('Two mail sacks: one for the hill, one for the lodge. Any order.'),
  'ct.field.03.done': CT_('The Trust starts on the second hangar.'),
  'ct.field.04.title': CT_('The inspector'), 'ct.field.04.brief': CT_('Take the Trust\'s inspector to the hill, and bring her back.'),
  'ct.field.04.done': CT_('She signed the form without looking up.'),
  'ct.field.05.title': CT_('Light the tower'), 'ct.field.05.brief': CT_('The tower\'s new lamp is at Tamgas Hill, and it is heavy.'),
  'ct.field.05.done': CT_('The tower is lit and the second hangar stands.'),
  'ct.minedock.01.title': CT_('Look at the road'), 'ct.minedock.01.brief': CT_('Fly over the mine street and tell us if it is still a strip.'),
  'ct.minedock.01.done': CT_('Rough, short, landable. The company is in.'),
  'ct.minedock.02.title': CT_('Engineers in'), 'ct.minedock.02.brief': CT_('Two engineers, from the field to the mine street.'),
  'ct.minedock.02.done': CT_('The headframe\'s frame goes up.'),
  'ct.minedock.03.title': CT_('The pump'), 'ct.minedock.03.brief': CT_('Take the pump up to the mine, then bring the first samples down to Tamgas Hill, for the boat.'),
  'ct.minedock.03.done': CT_('The pump runs. The samples look good.'),
  'ct.minedock.04.title': CT_('Four of us, fast'), 'ct.minedock.04.brief': CT_('I need to get my team of four to the mine fast.'),
  'ct.minedock.04.follow': CT_('The team loves it. Same again, with one thing changed.'),
  'ct.minedock.04.done': CT_('The headframe and the ore shed are finished.'),
  'ct.minedock.05.title': CT_('The dock side'), 'ct.minedock.05.brief': CT_('Mail to the seaplane base, then a look over the dock on the way back.'),
  'ct.minedock.05.done': CT_('The pier extension starts.'),
  'ct.minedock.06.title': CT_('The cold store'), 'ct.minedock.06.brief': CT_('The cold store\'s fittings, from the seaplane base to the dock.'),
  'ct.minedock.06.done': CT_('The cold store and the slipway are open.'),
  'ct.minedock.b1.title': CT_('Mail off the water'), 'ct.minedock.b1.brief': CT_('Mail to the dock, every week, off the water.'),
  'ct.minedock.b1.follow': CT_('The mail never missed. One more thing, though.'),
  'ct.minedock.b2.title': CT_('Ore out of the street'), 'ct.minedock.b2.brief': CT_('Two hundred kilos out of the mine street, in one go.'),
  'ct.minedock.b2.follow': CT_('It works. Now the accountant has a request.'),
  'ct.resort.01.title': CT_('The first guest'), 'ct.resort.01.brief': CT_('Our first guest is at the field. Bring her up.'),
  'ct.resort.01.done': CT_('She wants to stay a week.'),
  'ct.resort.02.title': CT_('A kitchen uphill'), 'ct.resort.02.brief': CT_('The kitchen\'s first order came in on the boat: from Tamgas Hill to the altiport.'),
  'ct.resort.02.done': CT_('The lodge\'s frame goes up.'),
  'ct.resort.03.title': CT_('Show them the hill'), 'ct.resort.03.brief': CT_('Fly our photographer over Tamgas Hill, and back to the altiport.'),
  'ct.resort.03.done': CT_('The brochure has a cover.'),
  'ct.resort.04.title': CT_('Quiet, please'), 'ct.resort.04.brief': CT_('Electric. The guests hate the noise.'),
  'ct.resort.04.follow': CT_('The guests noticed. Can it do a little more?'),
  'ct.resort.04.done': CT_('The lodge is finished.'),
  'ct.resort.05.title': CT_('The VIP weekend'), 'ct.resort.05.brief': CT_('Two guests from the field, and their luggage from the hill. Any order.'),
  'ct.resort.05.done': CT_('The strip is lengthened.'),
  'ct.resort.b1.title': CT_('Four guests at once'), 'ct.resort.b1.brief': CT_('A family of four, up the hill and back down, in one aeroplane.'),
  'ct.resort.b1.follow': CT_('The family is back, and brought friends.'),
  'ct.resort.b2.title': CT_('Every day, any wind'), 'ct.resort.b2.brief': CT_('The wind on the slope is never straight. We need to land anyway.'),
  'ct.resort.b2.follow': CT_('It landed every day. Now the budget.'),
  'ct.survey.01.title': CT_('A look at East Point'), 'ct.survey.01.brief': CT_('Fly over East Point Clearing and come back with what you saw.'),
  'ct.survey.01.done': CT_('The clearing is real. Short, but real.'),
  'ct.survey.02.title': CT_('Water samples'), 'ct.survey.02.brief': CT_('Samples from the seaplane base to the dock, upright.'),
  'ct.survey.02.done': CT_('The lab is happy.'),
  'ct.survey.03.title': CT_('Two sites'), 'ct.survey.03.brief': CT_('Over East Point and over the mine street, any order, then home.'),
  'ct.survey.03.done': CT_('East Point gets a windsock.'),
  'ct.survey.04.title': CT_('In and out of East Point'), 'ct.survey.04.brief': CT_('A plane for the East Point clearing: in and out, with an hour of fuel.'),
  'ct.survey.04.follow': CT_('It works. Could it take a second person?'),
  'ct.survey.04.done': CT_('East Point is a station.'),
  'ct.survey.05.title': CT_('The weather mast'), 'ct.survey.05.brief': CT_('The mast\'s sections, from the field to Tamgas Hill, and the old instruments back to the office.'),
  'ct.survey.05.done': CT_('The mast is up.'),
  'ct.clients.01.title': CT_('A ride for the doctor'), 'ct.clients.01.brief': CT_('The doctor has a clinic on the hill today, and an evening call at the lodge.'),
  'ct.clients.01.done': CT_('The doctor tells everyone.'),
  'ct.clients.02.title': CT_('Push it out alone'), 'ct.clients.02.brief': CT_('Something I can push out of my shed alone. The door is nine metres.'),
  'ct.clients.02.follow': CT_('I love it. Could the next one be even lighter?'),
  'ct.clients.02.done': CT_('A happy owner with a small shed.'),
  'ct.clients.03.title': CT_('Skyline to home'), 'ct.clients.03.brief': CT_('The club\'s oldest challenge: from the altiport to the field, as fast as you dare.'),
  'ct.clients.03.done': CT_('The club house goes up.'),
  'ct.clients.04.title': CT_('A trainer for the club'), 'ct.clients.04.brief': CT_('A trainer for the club, cheap and forgiving.'),
  'ct.clients.04.follow': CT_('The students love it. The treasurer has a wish.'),
  'ct.clients.04.done': CT_('The club has a trainer.'),
  'ct.clients.05.title': CT_('The aerobatic box'), 'ct.clients.05.brief': CT_('Something that will take the aerobatic box, and get there quickly.'),
  'ct.clients.05.follow': CT_('The crowd wants more. So do I.'),
  'ct.clients.05.done': CT_('A museum hangar for your best design.'),
  'ct.clients.b1.title': CT_('A ridiculous tank'), 'ct.clients.b1.brief': CT_('An hour in the air on a ridiculous tank: twenty litres, no more.'),
  'ct.clients.b1.follow': CT_('An hour was fun. One more thing.'),
  // (G2665 NIGHT-OPS) the night work
  'ct.field.n1.title': CT_('The night mail'), 'ct.field.n1.brief': CT_('The boat\'s mail sacks wait at Tamgas Hill. Into the field between midnight and one: the runway lights and the VASI are on.'),
  'ct.field.n1.done': CT_('The mail made the morning sort.'),
  'ct.minedock.n1.title': CT_('The late shift'), 'ct.minedock.n1.brief': CT_('The shift engineer is stuck at the mine street. Bring them down to the field after dusk.'),
  'ct.minedock.n1.done': CT_('Home for supper, late.'),
  'ct.clients.n1.title': CT_('Night medevac'), 'ct.clients.n1.brief': CT_('A climber fell on Tamgas Hill. Take the doctor up, then bring them both down to the ambulance at the field before dawn. The patient can sit.'),
  'ct.clients.n1.done': CT_('The ambulance was waiting on the apron.'),
  'ct.clients.n2.title': CT_('A stretcher case'), 'ct.clients.n2.brief': CT_('This one cannot sit: a stretcher and the doctor, from Tamgas Hill to the ambulance at the field, before dawn.'),
  'ct.clients.n2.done': CT_('The stretcher went straight into the ambulance.'),
  // the criteria (labels; {v} the value, {at} the load or the strip)
  'crit.seats': CT_('{v} seats occupied'), 'crit.emptyKg': CT_('empty mass at most {v} kg'),
  'crit.powertrain': CT_('{v} power'), 'crit.tankL': CT_('a tank of at most {v} L'),
  'crit.batteryKWh': CT_('a battery of at most {v} kWh'), 'crit.spanM': CT_('a span of at most {v} m'),
  'crit.costMax': CT_('costs at most {v} credits'), 'crit.ultimateG': CT_('strong to {v} g'),
  'crit.xwindKt': CT_('lands in {v} kt of crosswind'), 'crit.hydro': CT_('operates from water'),
  'crit.tasKmh': CT_('cruises at {v} km/h or more {at}'), 'crit.enduranceMin': CT_('{v} min in the air plus a reserve {at}'),
  'crit.rangeKm': CT_('{v} km on a tank'), 'crit.takeoffAt': CT_('takes off from {v} {at}'),
  'crit.landAt': CT_('lands at {v} {at}'),
  // the follow-up's change lines (GQ26)
  'follow.more': CT_('{k}: more than before'), 'follow.less': CT_('{k}: less than before'), 'follow.add': CT_('and now: {k}'),
  // medals
  'medal.gold': CT_('gold'), 'medal.silver': CT_('silver'), 'medal.bronze': CT_('bronze'),
  // (G2320 CAREER-WIRE) a flight's stop, as the arrival card says it ({t} the contract, {n} a number or a reason, {at} a field)
  'ev.picked': CT_('{t}: loaded at {at}'), 'ev.sub': CT_('{t}: done at stage {n}'), 'ev.stage': CT_('{t}: stage {n} done'),
  'ev.done': CT_('{t}: complete, paid {n}'), 'ev.unlock': CT_('built: {n}'), 'ev.follow': CT_('the client asks again: {t}'),
  'ev.pending': CT_('{t}: acceptance pending - {n}'), 'ev.none': CT_('{t}: {n}'), 'ev.wallet': CT_('wallet {n}'),
  // (G2705 CAREER-DAMAGE) a crash in the career: back where the flight departed from ({n} the place), repaired, free
  'ev.crash': CT_('crashed - back at {n}, repaired'),
};
// ===========================================================================
// THE CONTRACTS (G2240 CONTRACT-MODEL) — the record, its kinds and criteria,
// what a validated design can physically do, the pay, the seeded job
// generator, the follow-up build contract, and a stage's acceptance from a
// flight's end. futureDesigns/GAME-2026-10-06.md §R, §6, §7.3, §11, §12.3.
// ===========================================================================
// THE RECORD (§7.3, exactly):
//   { id, provider, kind: 'contract'|'job'|'challenge'|'build'|'survey',
//     title, brief,                                    text KEYS (72_'s CONTRACT_TEXT)
//     stages: [ { subs: [ { do, from?, to?, at?, load?: {kg, pax, bulk?}, when?: (G2650 windows), crit?: [...],
//                           medals? } ] } ],           stages IN ORDER, a stage's subs in ANY order
//     pay: { base, perKm?, km?, total?, bonus?: [ {crit, by, pct} ] },
//     rep: { provider, gain },
//     unlock?: { stage: '<track>:<n>' },              §11: a construction stage
//     needs?: { rep?, after?: [id] },
//     repeat?: false | { every: <contracts done> },
//     followUp?: { prefer?: [k], add?: [crit], changed: [ {k, how, from, to} ], n } }   build contracts (GQ26)
//   `do`: carry (a load from -> to) | fly (from? -> to, a challenge's medals) | land (at `to`) |
//         survey (over `at`, departing `from`) | deliver (a build contract: the airframe lands at `to`, its
//         `crit` judged by ACCEPT's hook) | accept (the criteria alone, judged by the hook, anywhere).
//
// RULINGS THIS FILE HOLDS (GATE CONTRACTS proves each, --selftest breaks each):
//   G-COST  pay depends on the JOB, never on the aeroplane: contractPay reads the job and the fields, and
//           nothing else. No running costs anywhere.
//   az      no validated design does every job class — through PHYSICAL gates only (contractCanDo): the
//           gear against the surface, the loaded take-off distance against the strip, the cabin against
//           the load, the bulk against the cabin, the range against the leg.
//   GQ26    one build contract = one delivery; a happy client offers a FOLLOW-UP with ONE criterion
//           changed (contractFollowUp), paid +15 % (GQ31), never repeating a change.
//   (g1)    a build contract states performance, never a configuration (CONTRACT_CONFIG_WORDS).
//   GQ17    no wall-clock deadlines: a `when` is a condition of the flight ("before dusk"); amended (§R.3, G2650):
//           a time-of-day window on the sim clock ("after dusk", "arrive 06:00-08:00"), met by flying or waiting.
//
// Pure: no DOM, no THREE, no storage. Reads 72_'s tables, and (when present) 25_'s stripAllows /
// 70_-71_'s player helpers at call time.
// ===========================================================================

const CONTRACT_KINDS = ['contract', 'job', 'challenge', 'build', 'survey'];
const CONTRACT_DO = ['carry', 'fly', 'land', 'survey', 'deliver', 'accept'];
const CONTRACT_OPS = ['>=', '<=', '=='];

// ---- THE CRITERION KINDS (data: ACCEPT implements each kind, MAP labels each) -----------------------------
//   k        the key a criterion names            unit   the value's unit ('' for a word, 'strip' for a field id)
//   when     'static' (judged without flying: the phone may do it, GQ19) | 'flown' (a flight decides it)
//   how      'spec' | 'ledger' | 'cert' (the structural certificate) | 'bench' (a BENCH_TESTS run) |
//            'leg' (the flown acceptance leg) | 'strip' (flown at that strip: the delivery or a demonstration)
//   src      where today's number comes from (GAME §6.2)
//   op       the operators the kind takes; band the sane values [lo, hi] (a criterion outside is invalid)
//   at       the conditions the kind may carry: pax / kg (the load it is judged at), reserveMin, fuelMin, tasKmh
//   follow   the follow-up's change (GQ26): `mul` or `add` toward the harder side, `round` its step; null =
//            this kind is never the one changed (a strip, a powertrain: the follow-up ADDs those)
//   values   the words a word-valued kind takes
const CONTRACT_CRIT_KINDS = {
  seats:        { k: 'seats',        unit: 'seats', when: 'static', how: 'spec',   src: 'cabin.seats + the occupied stations',
                  op: ['>='], band: [1, 8], follow: { add: 1 } },
  emptyKg:      { k: 'emptyKg',      unit: 'kg',    when: 'static', how: 'ledger', src: 'genShakedown empty (nobody aboard, no fuel)',
                  op: ['<='], band: [150, 2500], follow: { mul: 0.9, round: 5 } },
  powertrain:   { k: 'powertrain',   unit: '',      when: 'static', how: 'spec',   src: 'the energy module (60c_gen_energy.js) energyKind',
                  op: ['=='], values: ['electric', 'fuel', 'diesel'], follow: null },
  tankL:        { k: 'tankL',        unit: 'L',     when: 'static', how: 'spec',   src: 'the vessel litres (genShakedown energyL)',
                  op: ['<='], band: [5, 400], follow: { mul: 0.8, round: 1 } },
  batteryKWh:   { k: 'batteryKWh',   unit: 'kWh',   when: 'static', how: 'spec',   src: 'the cells\' kWh (60c_gen_energy.js)',
                  op: ['<='], band: [2, 200], follow: { mul: 0.85, round: 1 } },
  spanM:        { k: 'spanM',        unit: 'm',     when: 'static', how: 'spec',   src: 'genShakedown span (and GAME-PREMISES\' door rule)',
                  op: ['<='], band: [5, 20], follow: { add: -0.5, round: 0.5 } },
  costMax:      { k: 'costMax',      unit: 'credits', when: 'static', how: 'ledger', src: 'genShakedown cost (the bill)',
                  op: ['<='], band: [5000, 300000], follow: { mul: 0.9, round: 500 } },
  ultimateG:    { k: 'ultimateG',    unit: 'g',     when: 'static', how: 'cert',   src: 'the structural certificate (66_gen_cert.js ultimate)',
                  op: ['>='], band: [3, 12], follow: { add: 0.5, round: 0.5 } },
  xwindKt:      { k: 'xwindKt',      unit: 'kt',    when: 'flown',  how: 'bench',  src: 'BENCH_TESTS xwind (genCrosswindLimit)',
                  op: ['>='], band: [5, 30], follow: { add: 3, round: 1 } },
  hydro:        { k: 'hydro',        unit: '',      when: 'flown',  how: 'bench',  src: 'BENCH_TESTS hydro + the delivery on water',
                  op: ['=='], values: [true], follow: null },
  tasKmh:       { k: 'tasKmh',       unit: 'km/h',  when: 'flown',  how: 'leg',    src: 'the acceptance leg: TAS in a stabilised cruise at the load (`at`)',
                  op: ['>='], band: [60, 450], at: ['pax', 'kg'], follow: { mul: 1.1, round: 5 } },
  enduranceMin: { k: 'enduranceMin', unit: 'min',   when: 'flown',  how: 'leg',    src: 'the acceptance leg: the measured flow x the tank, less the reserve',
                  op: ['>='], band: [10, 600], at: ['pax', 'kg', 'reserveMin', 'tasKmh'], follow: { add: 15, round: 5 } },
  rangeKm:      { k: 'rangeKm',      unit: 'km',    when: 'flown',  how: 'leg',    src: 'the acceptance leg: groundspeed x the measured endurance, calm air',
                  op: ['>='], band: [20, 3000], at: ['pax', 'kg', 'reserveMin'], follow: { mul: 1.2, round: 10 } },
  takeoffAt:    { k: 'takeoffAt',    unit: 'strip', when: 'flown',  how: 'strip',  src: 'flown at that strip: the logbook row\'s departure',
                  op: ['=='], at: ['pax', 'kg', 'fuelMin'], follow: null },
  landAt:       { k: 'landAt',       unit: 'strip', when: 'flown',  how: 'strip',  src: 'flown at that strip: the delivery\'s arrival',
                  op: ['=='], at: ['pax', 'kg', 'fuelMin'], follow: null },
};

// ---- (g1) A BUILD CRITERION NEVER NAMES A CONFIGURATION ---------------------------------------------------
// The words (whole words, any case) no build contract's criteria or text may hold: wing positions, gear
// layouts, engine and airframe makers and models, structures. "floats" / "water" are an OPERATION (hydro),
// not a configuration, and are allowed (GQ26 names "floats" as a follow-up change).
const CONTRACT_CONFIG_WORDS = ['high wing', 'high-wing', 'low wing', 'low-wing', 'mid wing', 'shoulder wing',
  'parasol', 'tricycle', 'nosewheel', 'nose wheel', 'nose-wheel', 'taildragger', 'tail dragger', 'tail-dragger',
  'tailwheel', 'tail wheel', 'conventional gear', 'biplane', 'monoplane', 'canard', 'pusher', 'tractor',
  'twin boom', 'twin-boom', 'twin engine', 'twin-engine', 'retractable', 'strut', 'struts', 'braced',
  'cantilever', 'tube-and-fabric', 'rotax', 'lycoming', 'continental', 'jabiru', 'cessna', 'piper', 'cub',
  'jodel', 'beaver', 'cherokee', 'citabria', 'super cub', 'two-stroke', 'four-stroke', 'flat four', 'flat-four'];

// ---- THE FIT RULES (what a validated design can physically do; az through physical gates) ------------------
//   occKg    an occupant's mass (the envelope's station mass: 80 kg)
//   surf     the take-off distance's factor on each surface (a soft or rough strip lengthens the run)
//   bulkSeats a bulk load needs the rear seats out of a cabin of at least this many seats
//   rangeUse the share of the certified range a leg may use (the rest is the reserve)
// The loaded take-off distance is the certificate's toM scaled by (W / W0)^2 — the textbook first-order law
// (the run goes as W^2 / (rho S CLmax T)); it is the conservative side of genTORunAt's lift-only probe.
// BOTH ends are held to it: the aeroplane lands there loaded and must leave again.
const CONTRACT_FIT = {
  occKg: 80,
  surf: { concrete: 1.0, asphalt: 1.0, paved: 1.0, gravel: 1.1, dirt: 1.1, sand: 1.25, grass: 1.15, snow: 1.3, water: 1.0 },
  bulkSeats: 4,
  rangeUse: 0.75,
};

// ---- THE PAY (§12.3 as amended by G-COST: net, no running costs) -----------------------------------------
//   job pay = base(provider) + perKm x km x (1 + payload factor) + surface bonus + conditions
//   payload factor = kg / kgUnit + pax x paxF (+ bulkF for a bulk load)
//   surface bonus per distinct field the job touches: short (a strip <= shortM), water, snow, altiport
//   conditions: a `when` adds condPct of the rest
//   (G2665 NIGHT-OPS) the NIGHT: a night window adds nightPct of the rest (§R.3 "a night premium"), and a job drawn for
//   a MOONLESS night (its stamped `night.dark`: the moon down, new, or under an overcast) adds darkPct more - the
//   named factors `night` and `dark` of contractPay
//   (G2430 CONTRACT-ROUTES) PER LEG: each stage pays its own km x (1 + its own load's factor), and a job with more
//   than one destination (contractDests) adds chainPct % of the legs' pay per destination beyond the first. A
//   one-leg job pays exactly what it did. The positioning flight to the first stop is the player's, never paid.
// Arcs and build contracts carry an authored base; a follow-up pays followPct more (GQ31).
// G2260 (ECONOMY owns these numbers: the calibration, 76_economy.js ECON_BANDS, GATE ECON):
//   baseF   the provider's job base (CONTRACT_PROVIDERS[p].base, its relative weight) x this
//   story   an authored contract / survey / challenge's base x this (a build contract's base is priced against
//           the airframe it asks for and is paid as written)
const CONTRACT_PAY = {
  perKm: 160, kgUnit: 150, paxF: 0.5, bulkF: 0.5,
  surf: { short: 1100, water: 800, snow: 950, altiport: 1350 }, shortM: 400,
  condPct: 15, round: 10,
  nightPct: 15, darkPct: 20,
  chainPct: 10,
  followPct: 15,
  baseF: 2.7, story: 2.6,
};
// an authored record's base as paid (the story factor on everything but a build contract)
const contractStoryBase = rec => ((rec.pay && rec.pay.base) || 0) * (rec.kind === 'build' ? 1 : CONTRACT_PAY.story);

// ---- THE GENERATOR (seeded: the career seed + the completed count) ---------------------------------------
//   refreshEvery  the offers refresh after this many completed contracts (the epoch = floor(done / it))
//   perProvider   jobs offered per provider per epoch
//   tries         a drawn job no validated design can do is shrunk (its load halved, a passenger dropped) or
//                 redrawn up to this many times
//   condP         the chance a job carries a condition (before dusk)
//   repLoad       the load drawn grows with the provider's reputation: lo + (hi-lo) x (repLoad[0] + repLoad[1] x rep/5)
const CONTRACT_GEN = { refreshEvery: 3, perProvider: 3, tries: 8, condP: 0.25, repLoad: [0.4, 0.6], repMax: 5 };
const CONTRACT_DUSK_H = 19.5;          // "before dusk": the world's local hour at the stop (stopRecord.hour)
const CONTRACT_DAWN_H = 5;             // (G2650) "before dawn" / the end of "after dusk": the same local hour
// ---- THE TIME-OF-DAY WINDOWS (G2650 SIM-CLOCK; GQ17 amended, §R.3: no wall-clock deadline, but a window on the
// sim clock, met by flying or by WAITING it out on the ground). A sub's `when` is one of:
//   { before: 'dusk' }      arrive while it is still day: the hour < dusk                     (as since G2240)
//   { after: 'dusk' }       arrive in the night: the hour >= dusk or < dawn (the night wraps midnight)
//   { before: 'dawn' }      arrive in the small hours: midnight <= the hour < dawn
//   { arrive: [h0, h1] }    arrive between two LOCAL hours, h0 <= hour < h1 (h0 > h1 wraps midnight: [22, 2])
// judged on stop.hour (the world's local hour at the stop) against dusk / dawn: the stop's own `duskH` / `dawnH`
// when it carries them (the almanac's, 07b_clock.js dayDuskDawnH - NIGHT-OPS' call to pass them), else the
// constants above. An unknown hour refuses nothing (the decision needs the fact).
const CONTRACT_WHEN_KINDS = ['before:dusk', 'after:dusk', 'before:dawn', 'arrive'];
const ctHours = v => typeof v === 'number' && isFinite(v) && v >= 0 && v <= 24;
// '' when the window is one of the vocabulary's, else why not
function contractWhenWhy(w) {
  if (!w || typeof w !== 'object' || Array.isArray(w)) return '`when` must be an object';
  const k = Object.keys(w);
  if (k.length !== 1) return '`when` takes one time of day, got ' + (k.join(', ') || 'none');
  if (w.before === 'dusk' || w.after === 'dusk' || w.before === 'dawn') return '';
  if ('arrive' in w) {
    const a = w.arrive;
    if (!Array.isArray(a) || a.length !== 2 || !a.every(ctHours) || a[0] === a[1]) return '`when.arrive` must be two different local hours [h0, h1] in 0-24';
    return '';
  }
  return '`when` must be {before: \'dusk\'}, {after: \'dusk\'}, {before: \'dawn\'} or {arrive: [h0, h1]} (a time of day, never a deadline: GQ17)';
}
const ctPad2 = n => String(n).padStart(2, '0');
const ctHhmm = h => { const m = Math.round(h * 60) % 1440; return ctPad2(Math.floor(m / 60)) + ':' + ctPad2(m % 60); };
// the window in words, for the paragraph and the route line: "before dusk", "arrive 06:00-08:00"
function contractWhenWords(w) {
  if (!w || contractWhenWhy(w)) return '';
  if (w.before === 'dusk') return 'before dusk';
  if (w.after === 'dusk') return 'after dusk';
  if (w.before === 'dawn') return 'before dawn';
  return 'arrive ' + ctHhmm(w.arrive[0]) + '-' + ctHhmm(w.arrive[1]);
}
// '' when the stop's hour is inside the window (or unknown), else why not ("after dusk (21.0 h)")
function contractWhenOk(w, stop) {
  const h = stop && stop.hour;
  if (!w || typeof h !== 'number' || !isFinite(h)) return '';
  const dusk = typeof stop.duskH === 'number' && isFinite(stop.duskH) ? stop.duskH : CONTRACT_DUSK_H;
  const dawn = typeof stop.dawnH === 'number' && isFinite(stop.dawnH) ? stop.dawnH : CONTRACT_DAWN_H;
  const at = ' (' + h.toFixed(1) + ' h)';
  if (w.before === 'dusk') return h >= dusk ? 'after dusk' + at : '';
  if (w.after === 'dusk') return (h >= dusk || h < dawn) ? '' : 'before dusk' + at;
  if (w.before === 'dawn') return h < dawn ? '' : 'after dawn' + at;
  if (Array.isArray(w.arrive)) {
    const a = w.arrive[0], b = w.arrive[1];
    const inside = a < b ? (h >= a && h < b) : (h >= a || h < b);
    return inside ? '' : 'outside ' + ctHhmm(a) + '-' + ctHhmm(b) + at;
  }
  return '';
}

// ---- THE NIGHT (G2665 NIGHT-OPS, §R.3: night jobs; the route line says lit / unlit; the moon) -----------------------
// The user: "do we have some night missions? Night VFR is terrorizing" - and (via A0) full-moon nights make night VFR
// possible though dangerous; a moonless or overcast night stays truly dark. RULED (§R.3): night jobs (a night medevac,
// the night mail into the lit field, late returns), an unlit strip at night is the player's call (never a ✗), a night
// premium, the job states the moon; night jobs weighted toward moonlit nights, a premium for moonless ones.
//   p          the chance a generated CARRY job is a night one, before the moon's weight (a survey counts by day)
//   moonW      the moon's weight on it: p x (moonW[0] + moonW[1] x light) - light the moon's at the night's middle
//              (its illuminated fraction while it is up, 0 down or under an overcast): a full moon up ~3x a dark night
//   overcast   the day's cloud cover (07_day.js cloudCover) at or above which no moon light reaches the ground
//   darkLight  a night window whose light is under this is MOONLESS (the dark premium, CONTRACT_PAY.darkPct)
//   kinds      the night window's kind (weights): after dusk, before dawn, or an hour's arrival inside the night
//   sky0       the local date a generator call without a sky draws under: the game's first day (74_ CAREER_DAY0)
// THE SKY OF AN OFFER (contractSky): a local date + the day's cloud cover -> that night's dusk / dawn (07b's almanac,
// dayDuskDawnH) and the moon at any hour of it (07b dayMoonAt; an hour before noon is the next morning's). A job is
// drawn under its offer's sky (74_ careerOfferSky: the career's clock when its offers were made) and STAMPS the night it
// was drawn for (`rec.night`): the window's hours, the moon at the window's middle, overcast, dark - the pay reads it.
// The window itself is a time of day (GQ17): flown on any night it is met; the job line states the moon of the NEXT
// opening from the career's clock (75_ careerNightLine).
const CONTRACT_NIGHT = { p: 0.2, moonW: [0.5, 1.0], overcast: 0.75, darkLight: 0.1,
                         kinds: { 'after:dusk': 3, 'before:dawn': 1, arrive: 2 }, sky0: '2026-06-21' };
// the window's local hours [h0, h1) on a night of this dusk / dawn (h0 > h1 wraps midnight)
function contractWhenSpan(w, duskH, dawnH) {
  if (!w || contractWhenWhy(w)) return null;
  const dusk = typeof duskH === 'number' ? duskH : CONTRACT_DUSK_H, dawn = typeof dawnH === 'number' ? dawnH : CONTRACT_DAWN_H;
  if (w.before === 'dusk') return [0, dusk];
  if (w.after === 'dusk') return [dusk, dawn];
  if (w.before === 'dawn') return [0, dawn];
  return [w.arrive[0], w.arrive[1]];
}
const ctMod24 = h => ((h % 24) + 24) % 24;
// the window's middle hour (the hour its moon is told at)
function contractWhenMid(w, duskH, dawnH) {
  const S = contractWhenSpan(w, duskH, dawnH);
  return S ? ctMod24(S[0] + ctMod24(S[1] - S[0]) / 2) : null;
}
// is the window a NIGHT one: after dusk / before dawn always; an arrival whose middle is in the night
function contractWhenNight(w, duskH, dawnH) {
  if (!w || contractWhenWhy(w)) return false;
  if (w.after === 'dusk' || w.before === 'dawn') return true;
  if (w.before === 'dusk') return false;
  const dusk = typeof duskH === 'number' ? duskH : CONTRACT_DUSK_H, dawn = typeof dawnH === 'number' ? dawnH : CONTRACT_DAWN_H;
  const m = contractWhenMid(w, dusk, dawn);
  return m >= dusk || m < dawn;
}
// WAIT IT OUT (§R.3, the career's Wait "until the window opens"): at the local hour `hour`, null when the window is
// open now, else { target, h0 } - what DAY_CLOCK.wait takes: 'dusk' (the presets' own civil dusk, the almanac's) for
// after dusk, else the opening's local hours
function contractWhenWait(w, hour, duskH, dawnH) {
  const S = contractWhenSpan(w, duskH, dawnH);
  if (!S || typeof hour !== 'number' || !isFinite(hour)) return null;
  if (!contractWhenOk(w, { hour, duskH, dawnH })) return null;
  return { target: w.after === 'dusk' ? 'dusk' : S[0], h0: S[0] };
}
// THE SKY OF A NIGHT: the local date's dusk / dawn and its moon, memoised per date + cover (pure arithmetic on a
// scratch DAY on Jolene's geo: 07_day.js makeDay, 07b_clock.js dayDuskDawnH / dayMoonAt)
const ctSkyMemo = new Map();
function contractSky(date, cover) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date)) || typeof DAY === 'undefined' || typeof dayMoonAt !== 'function') return null;
  const cv = Math.max(0, Math.min(1, +cover || 0)), key = date + '|' + cv;
  if (ctSkyMemo.has(key)) return ctSkyMemo.get(key);
  // the scratch day at the local date's noon (the offset of the default geo: AKDT in summer, AKST in winter)
  const day = DAY.makeDay({ date, utc: 72000 });
  const dd = dayDuskDawnH(day);
  const sky = { date, cover: cv, overcast: cv >= CONTRACT_NIGHT.overcast, duskH: +dd.duskH.toFixed(2), dawnH: +dd.dawnH.toFixed(2), day };
  if (ctSkyMemo.size > 512) ctSkyMemo.clear();
  ctSkyMemo.set(key, sky);
  return sky;
}
// the next local date
const ctDateNext = date => dayFromAbs(dayAbs({ date, utc: 43200 }) + 86400).date;
// THE MOON AT AN HOUR OF THE NIGHT that starts on the sky's date (an hour before noon is the next morning's):
// { date, hour, phase, illum, up, light, dark } - light the moon's on the ground (0 when down or overcast)
function contractMoonAt(sky, hour) {
  if (!sky) return null;
  const h = ctMod24(hour), date = h < 12 ? ctDateNext(sky.date) : sky.date;
  const m = dayMoonAt(sky.day, date, h);
  const light = sky.overcast || !m.up ? 0 : m.illum;
  return { date, hour: +h.toFixed(2), phase: m.phase, illum: +m.illum.toFixed(3), up: m.up, overcast: sky.overcast,
           light: +light.toFixed(3), dark: light < CONTRACT_NIGHT.darkLight };
}
// the moon in words (the job line): "full moon, up", "half moon, down", "no moon", "overcast: no moon light"
function contractMoonWords(m) {
  if (!m) return '';
  if (m.overcast) return 'overcast: no moon light';
  if (m.phase === 'new') return 'no moon';
  return m.phase + ' moon, ' + (m.up ? 'up' : 'down');
}
// THE NIGHT A JOB IS DRAWN FOR (its own rng: the rest of the draw is the same with or without it) -> null (a day job)
// or { when, night: { date, h0, h1, duskH, dawnH, hour, phase, illum, up, overcast, light, dark } }
function ctNightOf(key, sky) {
  if (!sky) return null;
  const N = CONTRACT_NIGHT, rng = contractRng(key + '|night');
  const mid = ctMod24(sky.duskH + ctMod24(sky.dawnH - sky.duskH) / 2);
  const m0 = contractMoonAt(sky, mid);
  if (rng() >= N.p * (N.moonW[0] + N.moonW[1] * m0.light)) return null;
  const kind = ctPick(rng, Object.keys(N.kinds), k => N.kinds[k]);
  let when;
  if (kind === 'after:dusk') when = { after: 'dusk' };
  else if (kind === 'before:dawn') when = { before: 'dawn' };
  else {
    // an hour's arrival wholly inside this night: a whole hour from the first after dusk to the last before dawn
    const hs = [];
    for (let h = Math.ceil(sky.duskH); ; h++) { const a = ctMod24(h); if (ctMod24(a + 1 - sky.duskH) > ctMod24(sky.dawnH - sky.duskH)) break; hs.push(a); if (hs.length > 24) break; }
    if (!hs.length) when = { after: 'dusk' };
    else { const a = ctPick(rng, hs); when = { arrive: [a, ctMod24(a + 1)] }; }
  }
  const S = contractWhenSpan(when, sky.duskH, sky.dawnH), hour = contractWhenMid(when, sky.duskH, sky.dawnH);
  const m = contractMoonAt(sky, hour);
  return { when, night: { date: sky.date, h0: +S[0].toFixed(2), h1: +S[1].toFixed(2), duskH: sky.duskH, dawnH: sky.dawnH,
                          hour: m.hour, phase: m.phase, illum: m.illum, up: m.up, overcast: m.overcast, light: m.light, dark: m.dark } };
}
const CONTRACT_FOLLOW_MAX = 3;         // a chain of follow-ups stops after this many (or when no change is left)

// ---- small pure helpers ------------------------------------------------------------------------------------
const ctClone = o => JSON.parse(JSON.stringify(o));
// FNV-1a 32 over a string, then mulberry32: the same string, the same numbers, on every machine
function contractHash(s) {
  let h = 0x811c9dc5;
  s = String(s);
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h >>> 0;
}
function contractRng(key) {
  let a = contractHash(key);
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const ctField = (id, fields) => (fields || CONTRACT_FIELDS)[id] || null;
function contractKm(a, b, fields) {
  const A = ctField(a, fields), B = ctField(b, fields);
  if (!A || !B) return NaN;
  return Math.hypot(A.x - B.x, A.z - B.z) / 1000;
}
const ctWet = f => !!f && f.surf === 'water';

// THE FIELDS OF A WORLD: the same rows off the world's aerodromes (a premises record's runways or
// world.aerodromes: `c` or x/z, len, the surface through 25_'s stripSurface). GATE CONTRACTS holds
// CONTRACT_FIELDS equal to this over Jolene's record.
function contractFieldsOf(aerodromes) {
  const out = {};
  for (const a of (aerodromes || [])) {
    if (!a || !a.id || a.kind === 'meadow') continue;
    const x = Array.isArray(a.c) ? a.c[0] : a.x, z = Array.isArray(a.c) ? a.c[1] : a.z;
    const S = typeof stripSurface === 'function' ? stripSurface(a) : null;
    const row = { id: a.id, name: a.name || a.id, x: Math.round(x), z: Math.round(z), len: Math.round(a.len || 0),
                  surf: S ? S.key : (+a.surface === 4 ? 'water' : 'grass') };
    if (a.altiport) row.alti = true;
    // (G2665 NIGHT-OPS) lit at night: 25_'s rule (runwayLightStrips - a land strip; a water lane none); the record's
    // glideslope lights: a VASI, else a PAPI at either end
    const wet = row.surf === 'water';
    row.lit = typeof runwayLightStrips === 'function' ? runwayLightStrips([{ kind: a.kind || (wet ? 'water' : 'strip'), len: a.len, wid: a.wid || 1 }]).length > 0 : !wet;
    const pp = Array.isArray(a.papi) ? a.papi : [];
    if (row.lit && pp.includes('vasi')) row.glide = 'vasi'; else if (row.lit && pp.includes(true)) row.glide = 'papi';
    out[a.id] = row;
  }
  return out;
}

// ---- THE TEXT ----------------------------------------------------------------------------------------------
// a key's words with its {slots} filled; an unknown key reads as the key itself in brackets (visible, never a
// crash) and contractTextOk says so
function contractText(key, vars, text) {
  const T = text || CONTRACT_TEXT;
  const e = T[key];
  let s = e ? e.t : '[' + key + ']';
  if (vars) s = s.replace(/\{(\w+)\}/g, (m, k) => (vars[k] != null ? String(vars[k]) : m));
  return s;
}
const contractTextOk = (key, text) => typeof key === 'string' && !!(text || CONTRACT_TEXT)[key]
  && typeof (text || CONTRACT_TEXT)[key].t === 'string';
// the load as words: "40 kg of tools", "2 passengers", "drill rods (80 kg, the cabin cleared)"
function contractLoadWords(load, goodsWord, text) {
  const what = goodsWord ? contractText(goodsWord, null, text) : '';
  if (!load) return what;
  if (load.bulk) return contractText('load.bulk', { what, n: load.kg || 0 }, text);
  if (load.pax > 0 && !(load.kg > 0)) return load.pax === 1 ? contractText('load.pax1', null, text) : contractText('load.pax', { n: load.pax }, text);
  if (load.kg > 0) return contractText('load.kg', { n: load.kg, what }, text);
  return contractText('load.none', { what }, text);
}
// every key a record names (title, brief, a build's follow-up line, its criteria's labels, the goods word)
function contractKeys(rec) {
  const ks = [rec.title, rec.brief];
  if (rec.goods) ks.push(rec.goods);
  if (rec.shape && CONTRACT_THEN[rec.shape]) ks.push(CONTRACT_THEN[rec.shape]);
  for (const st of rec.stages || []) for (const s of st.subs || []) if (s.goods) ks.push(s.goods);
  if (rec.kind === 'build') ks.push(contractFollowKey(rec));
  const ch = rec.followUp && rec.followUp.changed && rec.followUp.changed[rec.followUp.changed.length - 1];
  if (ch) ks.push('follow.' + ch.how);
  for (const st of rec.stages || []) for (const s of st.subs || []) for (const c of s.crit || []) ks.push('crit.' + c.k);
  return ks;
}
const contractFollowKey = rec => 'ct.' + String(rec.base || rec.id).split('+')[0] + '.follow';
// a criterion as words (MAP's card): its label with the value (a strip by its name) and the load it is judged at
function contractCritWords(c, fields, text) {
  const F = fields || CONTRACT_FIELDS, K = CONTRACT_CRIT_KINDS[c.k] || {};
  const v = K.unit === 'strip' ? (F[c.v] ? F[c.v].name : c.v) : (c.v === true ? '' : c.v);
  let at = '';
  if (c.at && (c.at.pax || c.at.kg)) at = 'with ' + contractLoadWords({ kg: c.at.kg || 0, pax: c.at.pax || 0 }, 'goods.kit', text);
  return contractText('crit.' + c.k, { v, at }, text).replace(/\s+$/, '');
}
// a follow-up's change as words (GQ26): "and now: ...", or "<criterion>: more / less than before"
function contractFollowLine(rec, text) {
  const ch = rec && rec.followUp && rec.followUp.changed && rec.followUp.changed[rec.followUp.changed.length - 1];
  if (!ch) return '';
  const c = contractCrit(rec).find(x => x.k === ch.k);
  return contractText('follow.' + ch.how, { k: c ? contractCritWords(c, null, text) : ch.k }, text);
}

// ---- THE NORMALISER --------------------------------------------------------------------------------------
// Fills what is missing, carries what is present verbatim (unknown fields ride along: a newer game's field
// survives a round trip). Pure: returns a new object.
function contractNormalise(r) {
  const o = (r && typeof r === 'object') ? ctClone(r) : {};
  if (typeof o.id !== 'string') o.id = '';
  if (typeof o.provider !== 'string') o.provider = '';
  if (!CONTRACT_KINDS.includes(o.kind)) o.kind = 'contract';
  if (typeof o.title !== 'string') o.title = '';
  if (typeof o.brief !== 'string') o.brief = '';
  if (!Array.isArray(o.stages)) o.stages = [];
  o.stages = o.stages.map(st => {
    const S = (st && typeof st === 'object') ? st : {};
    S.subs = Array.isArray(S.subs) ? S.subs.map(s => {
      const u = (s && typeof s === 'object') ? s : {};
      if (u.load && typeof u.load === 'object') {
        u.load.kg = Math.max(0, +u.load.kg || 0);
        u.load.pax = Math.max(0, Math.round(+u.load.pax || 0));
        if (u.load.bulk == null) delete u.load.bulk;
        // (G2340 FREIGHT) a load's items ride along, each normalised (76_freight.js freightItem)
        if (u.load.items != null) {
          if (Array.isArray(u.load.items) && typeof freightItem === 'function') u.load.items = u.load.items.map(freightItem);
          else if (!Array.isArray(u.load.items)) delete u.load.items;
        }
      }
      if (u.crit != null && !Array.isArray(u.crit)) u.crit = [];
      return u;
    }) : [];
    return S;
  });
  if (!o.pay || typeof o.pay !== 'object') o.pay = { base: 0 };
  if (typeof o.pay.base !== 'number' || !isFinite(o.pay.base)) o.pay.base = 0;
  if (!o.rep || typeof o.rep !== 'object') o.rep = { provider: o.provider, gain: 0 };
  if (typeof o.rep.provider !== 'string') o.rep.provider = o.provider;
  if (typeof o.rep.gain !== 'number' || !isFinite(o.rep.gain)) o.rep.gain = 0;
  if (o.needs != null && typeof o.needs !== 'object') delete o.needs;
  if (o.needs) {
    if (!Array.isArray(o.needs.after)) o.needs.after = [];
    if (typeof o.needs.rep !== 'number' || !isFinite(o.needs.rep)) o.needs.rep = 0;
  }
  if (o.repeat == null) o.repeat = o.kind === 'job' ? { every: CONTRACT_GEN.refreshEvery } : false;
  if (o.kind === 'build') {
    if (!o.followUp || typeof o.followUp !== 'object') o.followUp = {};
    if (!Array.isArray(o.followUp.changed)) o.followUp.changed = [];
    if (!Array.isArray(o.followUp.prefer)) o.followUp.prefer = [];
    if (!Array.isArray(o.followUp.add)) o.followUp.add = [];
    if (typeof o.followUp.n !== 'number') o.followUp.n = o.followUp.changed.length;
  }
  return o;
}

// ---- THE VALIDATOR -----------------------------------------------------------------------------------------
// -> [ 'reason', ... ] (empty = valid). opts.text: the text table; opts.fields; opts.ids: the ids `after` may name
function contractCritWhy(c) {
  const K = c && CONTRACT_CRIT_KINDS[c.k];
  if (!K) return 'unknown criterion kind ' + (c && c.k);
  if (!K.op.includes(c.op)) return c.k + ': operator ' + c.op + ' not one of ' + K.op.join(' ');
  if (K.unit === 'strip') { if (!ctField(c.v)) return c.k + ': no field ' + c.v; }
  else if (K.values) { if (!K.values.includes(c.v)) return c.k + ': ' + c.v + ' not one of ' + K.values.join(' '); }
  else if (typeof c.v !== 'number' || !isFinite(c.v) || c.v < K.band[0] || c.v > K.band[1])
    return c.k + ': ' + c.v + ' outside ' + K.band[0] + '..' + K.band[1] + ' ' + K.unit;
  if (c.at != null) {
    if (typeof c.at !== 'object') return c.k + ': `at` is not an object';
    for (const a of Object.keys(c.at)) if (!(K.at || []).includes(a)) return c.k + ': `at.' + a + '` not a condition of this kind';
  }
  return '';
}
function contractConfigWord(s) {
  const t = ' ' + String(s || '').toLowerCase().replace(/[^a-z0-9-]+/g, ' ') + ' ';
  for (const w of CONTRACT_CONFIG_WORDS) if (t.includes(' ' + w + ' ')) return w;
  return '';
}
function contractValidate(rec, opts) {
  opts = opts || {};
  const T = opts.text || CONTRACT_TEXT, F = opts.fields || CONTRACT_FIELDS;
  const why = [];
  const r = rec || {};
  const id = r.id || '(no id)';
  if (typeof r.id !== 'string' || !r.id) why.push(id + ': no id');
  if (!CONTRACT_KINDS.includes(r.kind)) why.push(id + ': kind ' + r.kind + ' is not one of ' + CONTRACT_KINDS.join(' '));
  if (!CONTRACT_PROVIDERS[r.provider]) why.push(id + ': no provider ' + r.provider);
  for (const k of ['title', 'brief']) if (!contractTextOk(r[k], T)) why.push(id + ': ' + k + ' key ' + r[k] + ' does not resolve');
  if (!Array.isArray(r.stages) || !r.stages.length) why.push(id + ': no stages');
  (r.stages || []).forEach((st, i) => {
    if (!st || !Array.isArray(st.subs) || !st.subs.length) { why.push(id + ': stage ' + i + ' has no subs'); return; }
    st.subs.forEach((s, j) => {
      const at = id + ' ' + i + '.' + j;
      if (!CONTRACT_DO.includes(s.do)) { why.push(at + ': do ' + s.do + ' is not one of ' + CONTRACT_DO.join(' ')); return; }
      for (const f of ['from', 'to', 'at']) if (s[f] != null && !F[s[f]]) why.push(at + ': no field ' + s[f]);
      if ((s.do === 'carry' || s.do === 'fly') && (!s.to || (s.do === 'carry' && !s.from))) why.push(at + ': ' + s.do + ' needs from and to');
      if (s.goods != null && !contractTextOk(s.goods, T)) why.push(at + ': goods key ' + s.goods + ' does not resolve');
      if ((s.do === 'land' || s.do === 'deliver') && !s.to) why.push(at + ': ' + s.do + ' needs to');
      if (s.do === 'survey' && (!s.at || !s.from)) why.push(at + ': survey needs at and from');
      if (s.do === 'carry') {
        const L = s.load;
        if (!L || !(L.kg >= 0) || !(L.pax >= 0) || !(L.kg > 0 || L.pax > 0)) why.push(at + ': carry needs a load (kg or pax)');
        // (G2340 FREIGHT) items, when the load has them: known kinds, three dims, and they ARE the load's kilos
        if (L && L.items != null) {
          if (!Array.isArray(L.items)) why.push(at + ': load.items is not a list');
          else {
            if (L.items.some(it => !it || !(typeof FREIGHT_KINDS === 'undefined' || FREIGHT_KINDS[it.kind]) || !Array.isArray(it.dims) || it.dims.length !== 3 || !it.dims.every(v => v > 0)))
              why.push(at + ': an item with an unknown kind or no dims');
            const sum = L.items.reduce((a, it) => a + (+(it && it.kg) || 0), 0);
            if (Math.abs(sum - (L.kg || 0)) > 0.01) why.push(at + ': the items weigh ' + sum + ' kg, the load is ' + L.kg + ' kg');
          }
        }
      }
      if (s.crit != null) {
        if (r.kind !== 'build') why.push(at + ': criteria on a ' + r.kind + ' (build contracts only)');
        for (const c of s.crit) { const w = contractCritWhy(c); if (w) why.push(at + ': ' + w); }
      }
      if ((s.do === 'deliver' || s.do === 'accept') && r.kind !== 'build') why.push(at + ': ' + s.do + ' on a ' + r.kind);
      if (s.when != null) { const ww = contractWhenWhy(s.when); if (ww) why.push(at + ': ' + ww); }
      if (s.medals != null) {
        if (r.kind !== 'challenge' || s.do !== 'fly') why.push(at + ': medals on a non-challenge');
        else if (!s.medals.length || s.medals.some(m => !['gold', 'silver', 'bronze'].includes(m.medal) || !(m.le > 0)))
          why.push(at + ': a medal is {medal: gold|silver|bronze, le: seconds}');
      }
    });
  });
  if (r.kind === 'build') {
    const crit = contractCrit(r);
    if (!crit.length) why.push(id + ': a build contract with no criteria');
    if (!(r.stages || []).some(st => (st.subs || []).some(s => s.do === 'deliver'))) why.push(id + ': a build contract with no delivery');
    if (!r.followUp || !Array.isArray(r.followUp.changed)) why.push(id + ': a build contract with no followUp');
    if (!contractTextOk(contractFollowKey(r), T)) why.push(id + ': follow-up key ' + contractFollowKey(r) + ' does not resolve');
    const seen = {};
    for (const c of crit) { if (seen[c.k]) why.push(id + ': criterion ' + c.k + ' named twice'); seen[c.k] = 1; }
    // (g1) never a configuration: the criteria, and the words the client says
    for (const c of crit) { const w = contractConfigWord(JSON.stringify(c)); if (w) why.push(id + ': criterion ' + c.k + ' names a configuration (' + w + ')'); }
    for (const k of [r.title, r.brief, contractFollowKey(r)]) {
      const w = T[k] && contractConfigWord(T[k].t);
      if (w) why.push(id + ': ' + k + ' names a configuration (' + w + ')');
    }
    for (const c of crit) if (!contractTextOk('crit.' + c.k, T)) why.push(id + ': no label crit.' + c.k);
  }
  if (!r.pay || typeof r.pay.base !== 'number' || !isFinite(r.pay.base) || r.pay.base < 0) why.push(id + ': pay.base must be >= 0');
  for (const b of ((r.pay && r.pay.bonus) || [])) {
    if (b.crit === 'medal') { if (!['gold', 'silver', 'bronze'].includes(b.by)) why.push(id + ': a medal bonus by ' + b.by); }
    else if (!contractCrit(r).some(c => c.k === b.crit)) why.push(id + ': a bonus on ' + b.crit + ', which is not a criterion');
    if (!(b.pct > 0)) why.push(id + ': a bonus with no pct');
  }
  if (!r.rep || !CONTRACT_PROVIDERS[r.rep.provider] || !(r.rep.gain >= 0)) why.push(id + ': rep {provider, gain >= 0}');
  if (r.unlock != null) {
    const m = /^(\w+):(\d+)$/.exec((r.unlock && r.unlock.stage) || '');
    if (!m || !CONTRACT_TRACKS[m[1]] || +m[2] < 1 || +m[2] > CONTRACT_TRACKS[m[1]].max) why.push(id + ': unlock ' + JSON.stringify(r.unlock) + ' is not <track>:<1..max>');
  }
  if (r.needs != null) {
    if (r.needs.after != null && !Array.isArray(r.needs.after)) why.push(id + ': needs.after is not a list');
    for (const a of ((r.needs && r.needs.after) || [])) if (opts.ids && !opts.ids.includes(a)) why.push(id + ': needs.after names ' + a + ', which does not exist');
  }
  return why;
}

// every criterion of a record, in stage / sub order
function contractCrit(rec) {
  const out = [];
  for (const st of (rec && rec.stages) || []) for (const s of st.subs || []) for (const c of s.crit || []) out.push(c);
  return out;
}

// ---- WHAT THE CERTIFICATE CAN SAY (G2320, §R's follow-up to ACCEPT) ------------------------------------------
// The structural certificate is the NORMAL category only (65_gen_loadtest.js: +3.8 g limit, 5.7 g ultimate for every
// certified build): a criterion asking a stronger ultimate (the aerobatic box, "+6 g") is unwinnable until the
// certificate takes a category. Such a contract is HELD OUT: never offered (74_career.js careerOfferIds), so never
// accepted. It stays in the data, ready for the day the certificate can answer it.
const contractCertUlt = () => (typeof GEN_LOAD_ULT === 'number' ? GEN_LOAD_ULT : 5.7);
function contractCertifiable(rec) {
  const ult = contractCertUlt();
  return !contractCrit(rec).some(c => c.k === 'ultimateG' && typeof c.v === 'number' && c.v > ult + 1e-9);
}

// (G2665 NIGHT-OPS) A NIGHT CONTRACT NO VALIDATED DESIGN CAN FLY is held out the same way (74_ careerOfferIds: the
// stretcher case, until a door takes the 2.0 m stretcher) - the ✗ stays the hard no-no of the player's own fleet only
const contractFlyable = (rec, fields) => contractDoers(contractSubsOf(rec).filter(s => s.do !== 'deliver' && s.do !== 'accept'), fields).length > 0;

// ---- THE AUTHORED CONTRACTS (the arcs, the standalone builds and the night work, normalised, by id) ---------------
function contractAuthored() {
  const out = {};
  for (const p of Object.keys(CONTRACT_PROVIDERS)) {
    const P = CONTRACT_PROVIDERS[p];
    for (const r of P.arc.concat(P.builds || [], P.night || [])) out[r.id] = contractNormalise(r);
  }
  return out;
}

// ---- WHAT A VALIDATED DESIGN CAN DO (az: physical gates only) ------------------------------------------------
// the gear on a field: floats on water only, wheels anywhere but water (25_'s stripAllows; GATE CONTRACTS
// holds this to it on every field x gear)
function contractGearOk(gear, f) {
  if (!f) return false;
  if (gear === 'amphibian') return true;
  if (gear === 'floats') return ctWet(f);
  if (gear === 'skis') return f.surf === 'snow' || f.surf === 'grass';
  return !ctWet(f);
}
// the loaded take-off distance on a field (the certificate's toM, (W/W0)^2, the surface's factor)
function contractTakeoffM(design, loadKg, f) {
  const W0 = design.massKg, W = W0 + Math.max(0, loadKg || 0);
  return design.toM * (W / W0) * (W / W0) * ((f && CONTRACT_FIT.surf[f.surf]) || 1.2);
}
const ctCapKg = D => Math.max(0, D.seats - 1) * CONTRACT_FIT.occKg + (D.bagKg || 0);
// one sub, one design -> { ok, why }
function contractSubFit(D, s, fields) {
  const F = fields || CONTRACT_FIELDS;
  const no = why => ({ ok: false, why: D.label + ': ' + why });
  const ends = [];
  let kg = 0, km = 0;
  if (s.do === 'carry') {
    const L = s.load || {};
    kg = (L.kg || 0) + (L.pax || 0) * CONTRACT_FIT.occKg;
    if ((L.pax || 0) > D.seats - 1) return no((L.pax || 0) + ' passengers, ' + (D.seats - 1) + ' seats beside the pilot');
    if (kg > ctCapKg(D)) return no(kg + ' kg aboard, the cabin takes ' + ctCapKg(D) + ' kg');
    if (L.bulk && D.seats < CONTRACT_FIT.bulkSeats) return no('a bulk load needs a cabin of ' + CONTRACT_FIT.bulkSeats + ' seats cleared');
    // (G2340 FREIGHT) THE VOLUME: a load's items pass a door of this design and pack in its hold with the
    // passengers seated (the empty seats out if need be: the player's call) - the card measured off its mesh
    if (Array.isArray(L.items) && L.items.length && typeof freightFits === 'function') {
      const card = freightCardOf(D);
      if (card) { const v = freightFits(card, L.items, { pax: L.pax || 0 }); if (!v.ok) return no(v.why); }
    }
    ends.push(s.from, s.to); km = contractKm(s.from, s.to, F);
  } else if (s.do === 'fly') { if (s.from) ends.push(s.from); ends.push(s.to); km = s.from ? contractKm(s.from, s.to, F) : 0; }
  else if (s.do === 'land') { ends.push(s.to); }
  else if (s.do === 'survey') { ends.push(s.from); km = 2 * contractKm(s.from, s.at, F); }
  else return { ok: true, why: '' };   // deliver / accept: the delivered design is judged by ACCEPT, not here
  for (const e of ends) {
    const f = F[e];
    if (!f) return no('no field ' + e);
    if (!contractGearOk(D.gear, f)) return no(D.gear + ' cannot use ' + f.name + ' (' + f.surf + ')');
    const run = contractTakeoffM(D, kg, f);
    if (run > f.len) return no('take-off ' + Math.round(run) + ' m with ' + kg + ' kg, ' + f.name + ' is ' + f.len + ' m');
  }
  if (km > D.rangeKm * CONTRACT_FIT.rangeUse) return no(km.toFixed(1) + ' km, the range allows ' + Math.round(D.rangeKm * CONTRACT_FIT.rangeUse));
  return { ok: true, why: '' };
}
// a list of subs (a stage, or a whole job) by ONE design
function contractCanDo(D, subs, fields) {
  for (const s of subs) { const r = contractSubFit(D, s, fields); if (!r.ok) return r; }
  return { ok: true, why: '' };
}
// the validated designs that can fly these subs -> [id]
function contractDoers(subs, fields, designs) {
  const DS = designs || CONTRACT_DESIGNS;
  return Object.keys(DS).filter(k => contractCanDo(DS[k], subs, fields).ok);
}
const contractSubsOf = rec => [].concat(...((rec && rec.stages) || []).map(st => st.subs || []));
const ctFlying = s => s.do !== 'deliver' && s.do !== 'accept';

// ---- THE JOB CLASSES (az: every class has a doer, no design does every class) ---------------------------------
const CONTRACT_JOB_CLASSES = {
  water:    { test: (subs, F) => subs.some(s => ['from', 'to', 'at'].some(k => s[k] && ctWet(F[s[k]]) && !(k === 'at' && s.do === 'survey'))) },
  short:    { test: (subs, F) => subs.some(s => ['from', 'to'].some(k => s[k] && F[s[k]] && !ctWet(F[s[k]]) && F[s[k]].len <= 300)) },
  altiport: { test: (subs, F) => subs.some(s => ['from', 'to'].some(k => s[k] && F[s[k]] && F[s[k]].alti)) },
  group:    { test: subs => subs.some(s => s.load && s.load.pax >= 2) },
  heavy:    { test: subs => subs.some(s => s.load && (s.load.kg || 0) + (s.load.pax || 0) * CONTRACT_FIT.occKg >= 120) },
  bulk:     { test: subs => subs.some(s => s.load && s.load.bulk) },
  survey:   { test: subs => subs.some(s => s.do === 'survey') },
};
function contractClasses(rec, fields) {
  const F = fields || CONTRACT_FIELDS, subs = contractSubsOf(rec);
  return Object.keys(CONTRACT_JOB_CLASSES).filter(k => CONTRACT_JOB_CLASSES[k].test(subs, F));
}

// ---- THE PAY (G-COST: the job's, never the aeroplane's) ----------------------------------------------------
// -> { base, perKm, km, factor, surface, chain, cond, night, dark, total }. Reads the record and the fields. Nothing else.
function contractPay(rec, fields) {
  const F = fields || CONTRACT_FIELDS, P = CONTRACT_PAY;
  const prov = CONTRACT_PROVIDERS[rec.provider];
  let km = 0, factor = 0, legs = 0, cond = false, night = false;
  const NT = rec.night && typeof rec.night === 'object' ? rec.night : null;
  const touched = {};
  // (G2430) each stage is a leg: its km x (1 + its own load's factor)
  for (const st of rec.stages || []) {
    let skm = 0, kg = 0, pax = 0, bulk = false;
    for (const s of st.subs || []) {
      if (s.do === 'carry' || (s.do === 'fly' && s.from)) skm += contractKm(s.from, s.to, F);
      if (s.do === 'survey') skm += 2 * contractKm(s.from, s.at, F);
      for (const k of ['from', 'to']) if (s[k]) touched[s[k]] = 1;
      if (s.load) { kg = Math.max(kg, s.load.kg || 0); pax = Math.max(pax, s.load.pax || 0); bulk = bulk || !!s.load.bulk; }
      if (s.when) { cond = true; if (contractWhenNight(s.when, NT ? NT.duskH : null, NT ? NT.dawnH : null)) night = true; }
    }
    const f = kg / P.kgUnit + pax * P.paxF + (bulk ? P.bulkF : 0);
    km += skm; factor = Math.max(factor, f); legs += skm * (1 + f);
  }
  let surface = 0;
  for (const id of Object.keys(touched)) {
    const f = F[id];
    if (!f) continue;
    if (ctWet(f)) surface += P.surf.water;
    else if (f.len <= P.shortM) surface += P.surf.short;
    if (f.surf === 'snow') surface += P.surf.snow;
    if (f.alti) surface += P.surf.altiport;
  }
  const base = rec.kind === 'job' ? ((prov && prov.base) || 0) * P.baseF : contractStoryBase(rec);
  const perKm = rec.kind === 'job' ? P.perKm : 0;
  const legPay = perKm * legs;
  const chain = rec.kind === 'job' ? legPay * P.chainPct / 100 * Math.max(0, contractDests(rec) - 1) : 0;
  const rest = base + legPay + chain + (rec.kind === 'job' ? surface : 0);
  const condAdd = cond ? rest * P.condPct / 100 : 0;
  const nightAdd = night ? rest * P.nightPct / 100 : 0;
  const darkAdd = night && NT && NT.dark ? rest * P.darkPct / 100 : 0;
  let total = Math.round((rest + condAdd + nightAdd + darkAdd) / P.round) * P.round;
  // G2260 (ECONOMY, GQ6): the Trust's loan job pays what it was offered at (76_ econLoanJob), not a job's rate
  if (rec.loan && rec.pay && typeof rec.pay.total === 'number' && isFinite(rec.pay.total)) total = rec.pay.total;
  return { base, perKm, km: +km.toFixed(2), factor: +factor.toFixed(3), surface: rec.kind === 'job' ? surface : 0,
           chain: Math.round(chain), cond: Math.round(condAdd), night: Math.round(nightAdd), dark: Math.round(darkAdd), total };
}

// ---- THE ROUTES (G2430 CONTRACT-ROUTES, §R.3: two destinations or more, not everything from Jolene AFB) ----------
// THE ISLAND'S JOB FIELDS: every provider's `fields`, in provider order, each once - 72_'s one table to edit (a new
// site named there joins the jobs; one named in no provider's list joins none)
function contractSites(fields) {
  const F = fields || CONTRACT_FIELDS, out = [];
  for (const p of Object.keys(CONTRACT_PROVIDERS)) for (const f of CONTRACT_PROVIDERS[p].fields || []) if (F[f] && !out.includes(f)) out.push(f);
  return out;
}
// a template's pool -> [field id]: 'own' (the provider's fields), 'away' (the job fields not its own), 'all', [ids]
function ctPool(P, pool, F) {
  if (Array.isArray(pool)) return pool.filter(f => F[f]);
  const own = (P.fields || []).filter(f => F[f]);
  if (pool === 'own') return own;
  const sites = contractSites(F);
  return pool === 'away' ? sites.filter(f => !own.includes(f)) : sites;
}
// THE STOPS a record sends the aeroplane to, in order -> [{ at, what: pick|depart|drop|over|land, stage }]. A stage's
// pickups (its departure) come first, then its drops / overflights / landings as written (a stage's subs are in any
// order: this is one order that does them); the same field twice in a row is ONE stop (the chain's hinge: the load
// dropped at B and the next one taken on at B). The positioning flight to the first stop is not a stop: the job
// starts where its first load waits.
function contractStops(rec) {
  const out = [], rank = { pick: 0, depart: 0, land: 1, over: 2, drop: 2 };
  const put = (at, what, stage) => {
    if (!at) return;
    const last = out[out.length - 1];
    if (last && last.at === at) { if (rank[what] > rank[last.what]) last.what = what; return; }
    out.push({ at, what, stage });
  };
  ((rec && rec.stages) || []).forEach((st, i) => {
    const subs = st.subs || [], seen = [];
    for (const s of subs) {
      const f = (s.do === 'carry' || s.do === 'survey' || s.do === 'fly') ? s.from : null;
      if (f && !seen.includes(f)) { seen.push(f); put(f, s.do === 'carry' ? 'pick' : 'depart', i); }
    }
    for (const s of subs) {
      if (s.do === 'carry') put(s.to, 'drop', i);
      else if (s.do === 'survey') put(s.at, 'over', i);
      else if (s.do === 'fly' || s.do === 'land' || s.do === 'deliver') put(s.to, 'land', i);
    }
  });
  return out;
}
// THE DESTINATIONS: the stops after the first, a plain landing back where the job began not counted (a survey's
// "and back to the dock" is the way home; a backhaul's load delivered there IS a destination)
function contractDests(rec) {
  const S = contractStops(rec);
  return S.slice(1).filter(x => !(x.what === 'land' && x.at === S[0].at)).length;
}
const CONTRACT_SHAPES = { carry: ['p2p', 'back', 'onward', 'milk'], survey: ['loop', 'pair', 'transit'] };
// a shape's {then} text key (the brief's next leg; p2p has none)
const CONTRACT_THEN = { back: 'job.then.back', onward: 'job.then.onward', milk: 'job.then.milk',
                        loop: 'job.then.loop', pair: 'job.then.pair', transit: 'job.then.transit' };
// a route of a shape -> its stages' subs. A carry route is [A, B] (p2p), [A, B, A] (back) or [A, B, C]; L1 / L2 the
// two legs' loads (L2: the second leg's, null on a one-leg job); g2 the second leg's goods word when it differs
function ctCarryStages(shape, r, L1, L2, g2) {
  const leg = (from, to, load, goods) => Object.assign({ do: 'carry', from, to, load }, goods ? { goods } : {});
  if (shape === 'p2p') return [[leg(r[0], r[1], L1)]];
  return [[leg(r[0], r[1], L1)], [leg(r[1], r[2], L2, g2)]];
}
// a survey route: loop [A, X], pair [A, X, Y] (over both, back to A), transit [A, X, B] (over X, land at B)
function ctSurveyStages(shape, r) {
  if (shape === 'pair') return [[{ do: 'survey', from: r[0], at: r[1] }, { do: 'survey', from: r[0], at: r[2] }], [{ do: 'land', to: r[0] }]];
  return [[{ do: 'survey', from: r[0], at: r[1] }], [{ do: 'land', to: shape === 'transit' ? r[2] : r[0] }]];
}
const ctGoods = (P, id) => P.goods.find(g => g.id === id) || { kind: 'none' };
const ctFloor = G => ({ kg: G.kind === 'kg' || G.kind === 'bulk' ? G.kg[0] : 0, pax: G.kind === 'pax' ? G.pax[0] : 0 });
// THE ROUTES a template may draw in a shape: every route of the shape among its pools, no leg from a field to
// itself, no stop twice in a row, that ONE validated design flies end to end at the goods' floor (the ✗ rule: never
// a wheels / water mix no single aeroplane can do). In pool order (deterministic); memoised per fields table.
const ctRouteMemo = new WeakMap();
function ctRoutes(P, tpl, shape, F) {
  let m = ctRouteMemo.get(F);
  if (!m) ctRouteMemo.set(F, m = new Map());
  const key = P.id + '|' + tpl.id + '|' + shape;
  if (m.has(key)) return m.get(key);
  const raw = [];
  let subsOf;
  if (tpl.survey) {
    const S = tpl.survey, A = ctPool(P, S.from || 'own', F), X = ctPool(P, S.at || 'all', F), B = ctPool(P, S.to || 'own', F);
    for (const a of A) X.forEach((x, xi) => {
      if (x === a) return;
      if (shape === 'loop') raw.push([a, x]);
      else if (shape === 'pair') { for (const y of X.slice(xi + 1)) if (y !== a) raw.push([a, x, y]); }
      else if (shape === 'transit') { for (const b of B) if (b !== a && b !== x) raw.push([a, x, b]); }
    });
    subsOf = r => [].concat(...ctSurveyStages(shape, r));
  } else {
    const A = ctPool(P, tpl.from || 'own', F), B = ctPool(P, tpl.to || 'all', F), C = ctPool(P, tpl.on || 'all', F);
    for (const a of A) for (const b of B) {
      if (a === b) continue;
      if (shape === 'p2p') raw.push([a, b]);
      else if (shape === 'back') raw.push([a, b, a]);
      else for (const c of C) if (c !== a && c !== b) raw.push([a, b, c]);
    }
    const G = ctGoods(P, tpl.goods), G2 = tpl.back ? ctGoods(P, tpl.back) : G;
    subsOf = r => [].concat(...ctCarryStages(shape, r, ctFloor(G), ctFloor(shape === 'milk' ? G : G2)));
  }
  const out = raw.filter(r => contractDoers(subsOf(r), F).length > 0);
  m.set(key, out);
  return out;
}
// a load drawn from goods G (the reputation's share of its range); its items (FREIGHT: the goods gain dims). `tag`
// prefixes the item ids of a second, separate load (a backhaul of the same goods is other crates, not the same ones)
function ctLoadOf(rng, G, frac) {
  const L = { kg: 0, pax: 0 };
  if (G.kind === 'pax') L.pax = ctDraw(rng, G.pax[0], G.pax[1], frac, 1);
  else if (G.kind === 'kg' || G.kind === 'bulk') L.kg = ctDraw(rng, G.kg[0], G.kg[1], frac, 5);
  if (G.kind === 'bulk') L.bulk = G.id;
  return L;
}
function ctItemsOf(L, G, tag) {
  if (L.kg > 0 && typeof freightItems === 'function') {
    L.items = freightItems(L, G.word);
    if (tag) L.items = L.items.map(it => Object.assign(it, { id: tag + it.id }));
  } else delete L.items;
  return L;
}
// a load shrunk one step toward the goods' floor (a passenger dropped, else the kilos halved); false at the floor
function ctShrink(L, G) {
  if (L.pax > (G.pax ? G.pax[0] : 0)) { L.pax--; return true; }
  const lo = G.kg ? G.kg[0] : 0;
  if (L.kg > lo) { L.kg = Math.max(lo, Math.round(L.kg / 2 / 5) * 5); return true; }
  return false;
}
// THE MILK RUN'S SECOND LEG: part of the first leg's load goes on (the later half of its items, or all but one of its
// passengers); null when the load does not split (one item, one passenger)
function ctMilkPart(L1) {
  if (L1.pax >= 2) return { kg: 0, pax: L1.pax - 1 };
  if (Array.isArray(L1.items) && L1.items.length >= 2) {
    const items = ctClone(L1.items.slice(Math.ceil(L1.items.length / 2)));
    const L = { kg: freightKg(items), pax: 0, items };
    if (L1.bulk) L.bulk = L1.bulk;
    return L;
  }
  return null;
}

// ---- THE JOB GENERATOR (seeded, deterministic, order-independent) ------------------------------------------
// A job is f(seed, provider, epoch, index) and NOTHING else (the provider's reputation scales its load: a
// value of the career that changes only when the completed count does). Its id says so: job:<prov>:<epoch>:<i>,
// so a job is regenerated from its id (contractJobById) — no job is stored until it is accepted.
// (G2430) A draw: the template (its weight), the condition, the SHAPE (its weight, among the shapes the template
// has a flyable route in), the ROUTE (uniform among ctRoutes), then the loads, leg by leg; shrunk until one
// validated design flies the whole chain, else redrawn. The record says its shape (`shape`); a second leg of other
// goods names them (`sub.goods`).
// (G2665 NIGHT-OPS) opts.sky: the offer's sky (contractSky: its date's dusk / dawn / moon / overcast) the night work is
// drawn under; undefined: the game's first day (CONTRACT_NIGHT.sky0); null: no night work at all
function contractEpoch(done) { return Math.floor(Math.max(0, done || 0) / CONTRACT_GEN.refreshEvery); }
function ctPick(rng, list, w) {
  if (!w) return list[Math.floor(rng() * list.length) % list.length];
  const tot = list.reduce((a, x) => a + (w(x) || 0), 0);
  let r = rng() * tot;
  for (const x of list) { r -= (w(x) || 0); if (r < 0) return x; }
  return list[list.length - 1];
}
function ctDraw(rng, lo, hi, frac, round) {
  const top = lo + (hi - lo) * Math.min(1, frac);
  const v = lo + (top - lo) * rng();
  return Math.max(lo, Math.round(v / round) * round);
}
function contractJob(seed, providerId, epoch, i, opts) {
  opts = opts || {};
  const P = CONTRACT_PROVIDERS[providerId];
  if (!P || !P.jobs || !P.jobs.length) return null;
  const F = opts.fields || CONTRACT_FIELDS;
  const rep = Math.max(0, Math.min(CONTRACT_GEN.repMax, +opts.rep || 0));
  const frac = CONTRACT_GEN.repLoad[0] + CONTRACT_GEN.repLoad[1] * rep / CONTRACT_GEN.repMax;
  const id = 'job:' + providerId + ':' + epoch + ':' + i;
  for (let t = 0; t < CONTRACT_GEN.tries; t++) {
    const rng = contractRng(seed + '|' + id + '|' + t);
    const tpl = ctPick(rng, P.jobs, x => x.w || 1);
    const G = ctGoods(P, tpl.goods);
    const cond = rng() < CONTRACT_GEN.condP;
    const W = tpl.shapes || { p2p: 1 };
    const shapes = Object.keys(W).filter(k => W[k] > 0 && ctRoutes(P, tpl, k, F).length);
    if (!shapes.length) continue;
    let shape = ctPick(rng, shapes, k => W[k]);
    const route = ctPick(rng, ctRoutes(P, tpl, shape, F));
    let subs, g2 = null;
    if (tpl.survey) subs = ctSurveyStages(shape, route);
    else {
      const G2 = shape === 'milk' ? G : (tpl.back ? ctGoods(P, tpl.back) : G);
      if (G2 !== G) g2 = G2.word;
      const L1 = ctItemsOf(ctLoadOf(rng, G, frac), G);
      const L2 = shape === 'back' || shape === 'onward' ? ctItemsOf(ctLoadOf(rng, G2, frac), G2, 'leg2.') : null;
      // (G2340 FREIGHT) THE GOODS GAIN DIMS: each leg's load is its items, re-made at every shrink
      const build = () => {
        let second = L2;
        if (shape === 'milk' || (shape === 'onward' && !L2)) {
          second = ctMilkPart(L1);
          // a load that does not split rides on as a fresh one of the same goods, picked up at B
          if (!second) { shape = 'onward'; second = ctItemsOf(ctFloor(G), G, 'leg2.'); }
          else shape = 'milk';
        }
        return ctCarryStages(shape, route, L1, second, g2);
      };
      subs = build();
      // shrink until a validated design can fly the chain: a passenger dropped, the kilos halved (never below the
      // goods' floor) - the job keeps its route and its kind
      for (let k = 0; k < 6 && !contractDoers([].concat(...subs), F).length; k++) {
        const a = ctShrink(L1, G), b = L2 ? ctShrink(L2, G2) : false;
        if (!a && !b) break;
        ctItemsOf(L1, G);
        if (L2) ctItemsOf(L2, G2, 'leg2.');
        subs = build();
      }
    }
    // (G2665 NIGHT-OPS) a share of the carry jobs is NIGHT work: the last leg's arrival in a night window, drawn under
    // the offer's sky (its own rng: the rest of this draw is the same either way); else the day's condition as before
    const nt = tpl.survey ? null : ctNightOf(seed + '|' + id + '|' + t, opts.sky !== undefined ? opts.sky : contractSky(CONTRACT_NIGHT.sky0, 0));
    if (nt) subs[subs.length - 1][0].when = nt.when;
    else if (cond) subs[subs.length - 1][0].when = { before: 'dusk' };
    if (!contractDoers([].concat(...subs), F).length) continue;
    const rec = contractNormalise(Object.assign({
      id, provider: providerId, kind: 'job', title: tpl.title, brief: tpl.brief, goods: G.word, tpl: tpl.id, shape,
      stages: subs.map(s => ({ subs: s })),
      pay: { base: 0 }, rep: { provider: providerId, gain: 0.1 }, repeat: { every: CONTRACT_GEN.refreshEvery },
      seed: String(seed), epoch, i,
    }, nt ? { night: nt.night } : {}));
    rec.pay = contractPay(rec, F);
    return rec;
  }
  return null;
}
// the jobs a provider offers at a completed count -> [record]
function contractJobs(seed, providerId, done, opts) {
  const e = contractEpoch(done), out = [];
  for (let i = 0; i < CONTRACT_GEN.perProvider; i++) {
    const j = contractJob(seed, providerId, e, i, opts);
    if (j) out.push(j);
  }
  return out;
}
function contractJobById(seed, id, opts) {
  const m = /^job:(\w+):(\d+):(\d+)$/.exec(id || '');
  return m ? contractJob(seed, m[1], +m[2], +m[3], opts) : null;
}
// the vars a record's text fills: {from} {to} {at} {load} of its first leg, and (G2430) {then}: the next leg as words
// (job.then.<shape> with THAT leg's {from} {to} {load} {at}; empty on a one-leg job or an authored record)
function contractVars(rec, fields, text) {
  const F = fields || CONTRACT_FIELDS, subs = contractSubsOf(rec);
  const s = subs.find(x => x.do === 'carry') || subs.find(x => x.do === 'survey') || subs[0] || {};
  const nm = id => (F[id] ? F[id].name : id);
  const words = u => contractLoadWords(u.load, u.goods || rec.goods, text);
  const v = { from: nm(s.from), to: nm(s.to), at: nm(s.at), load: words(s), then: '' };
  const key = rec && rec.shape && CONTRACT_THEN[rec.shape];
  if (key) {
    const st = rec.stages || [];
    let n = null;
    if (rec.shape === 'pair') { const u = (st[0] && st[0].subs[1]) || {}; n = { from: nm(u.from), to: '', at: nm(u.at), load: '' }; }
    else if (rec.shape === 'loop' || rec.shape === 'transit') { const u = (st[1] && st[1].subs[0]) || {}; n = { from: nm(s.from), to: nm(u.to), at: nm(s.at), load: '' }; }
    else { const u = (st[1] && st[1].subs[0]) || null; if (u) n = { from: nm(u.from), to: nm(u.to), at: '', load: words(u) }; }
    if (n) v.then = contractText(key, n, text);
  }
  return v;
}

// ---- THE FOLLOW-UP BUILD CONTRACT (GQ26, GQ31) --------------------------------------------------------------
// The same story with ONE criterion changed: the first of `followUp.prefer`, then the kind order, whose kind
// has a `follow` rule and has not been changed before in this chain; else the first `followUp.add` not yet
// present. Paid +followPct % on the delivered contract's base. Never repeats a change (the chain's `changed`
// list rides on every follow-up). null when nothing is left to change or the chain is CONTRACT_FOLLOW_MAX long.
function contractFollowUp(rec) {
  const r = contractNormalise(rec);
  if (r.kind !== 'build') return null;
  const fu = r.followUp;
  if (fu.changed.length >= CONTRACT_FOLLOW_MAX) return null;
  const done = new Set(fu.changed.map(c => c.k));
  const crit = contractCrit(r);
  const order = fu.prefer.concat(Object.keys(CONTRACT_CRIT_KINDS)).filter((k, i, a) => a.indexOf(k) === i);
  let pick = null;
  for (const k of order) {
    const c = crit.find(x => x.k === k), K = CONTRACT_CRIT_KINDS[k];
    if (!c || !K || !K.follow || done.has(k)) continue;
    let v = K.follow.mul ? c.v * K.follow.mul : c.v + K.follow.add;
    const st = K.follow.round || 1;
    v = Math.round(v / st) * st;
    if (v === c.v) v = c.v + (K.follow.mul ? (K.follow.mul > 1 ? st : -st) : Math.sign(K.follow.add) * st);
    if (v < K.band[0] || v > K.band[1]) continue;
    pick = { k, how: (K.follow.mul ? K.follow.mul > 1 : K.follow.add > 0) ? 'more' : 'less', from: c.v, to: v };
    break;
  }
  let add = null;
  if (!pick) {
    add = fu.add.find(a => a && CONTRACT_CRIT_KINDS[a.k] && !crit.some(c => c.k === a.k) && !done.has(a.k)) || null;
    if (!add) return null;
    pick = { k: add.k, how: 'add', from: null, to: add.v };
  }
  const n = ctClone(r);
  const base = String(r.base || r.id).split('+')[0];
  n.base = base;
  n.id = base + '+' + (fu.changed.length + 1);
  n.follows = r.id;
  n.followUp = Object.assign({}, fu, { changed: fu.changed.concat([pick]), n: fu.changed.length + 1 });
  // the change, in the one sub that holds it (a new criterion joins the delivery)
  if (add) {
    const dv = n.stages.map(st => st.subs.find(s => s.do === 'deliver')).find(Boolean);
    dv.crit = (dv.crit || []).concat([ctClone(add)]);
  } else {
    for (const st of n.stages) for (const s of st.subs) for (const c of s.crit || []) if (c.k === pick.k) c.v = pick.to;
  }
  n.pay = Object.assign({}, r.pay, { base: Math.round(r.pay.base * (1 + CONTRACT_PAY.followPct / 100) / CONTRACT_PAY.round) * CONTRACT_PAY.round });
  delete n.unlock;                               // the stage was the first delivery's
  n.needs = { rep: 0, after: [r.id] };
  return n;
}
// a follow-up by id ('<build>+<n>'), regenerated down its chain from the authored contract
function contractFollowById(id, authored) {
  const m = /^(.+)\+(\d+)$/.exec(id || '');
  if (!m) return null;
  let r = (authored || contractAuthored())[m[1]];
  for (let i = 0; r && i < +m[2]; i++) r = contractFollowUp(r);
  return r && r.id === id ? r : null;
}
// the one difference between a contract and its follow-up -> [ {k, from, to} ] (the gate's row: exactly one)
function contractCritDiff(a, b) {
  const A = {}, B = {}, out = [];
  for (const c of contractCrit(a)) A[c.k] = JSON.stringify(c);
  for (const c of contractCrit(b)) B[c.k] = JSON.stringify(c);
  for (const k of Object.keys(Object.assign({}, A, B))) if (A[k] !== B[k]) out.push({ k, from: A[k] || null, to: B[k] || null });
  return out;
}

// ---- A STAGE'S ACCEPTANCE FROM A FLIGHT'S END ------------------------------------------------------------------
// THE STOP RECORD (what the page hands over at DEST-TO's STOPPED; app.js playerFlightEnd is where it is made):
//   { how: 'stopped', aero: '<aerodrome id>' | null (flightWhere's id when flightCanDepart),
//     wrecked?: bool, slot?: '<fleet slot>', gear?: 'wheels'|'floats',
//     load: { kg, pax, bulk?, items? }    what is aboard at the stop (cargo kg beside the pilot, passengers; the
//                                         loaded items when there are any - G2340 FREIGHT: then they are the load)
//     row: { from, to, t, ... }           the logbook row (logFlight): `from` the leg's departure, `t` seconds
//     overflew?: [aerodrome id]           the sites the flight passed over (a survey's evidence)
//     hour?: number                       the world's local hour at the stop (a `when` is judged on it)
//     duskH?, dawnH?: number              (G2650) the day's dusk / dawn as local hours (else the constants)
//     accept?: { ... }                    ACCEPT's recording, passed through to the hook untouched }
// THE HOOK (supplied by ACCEPT, G2270): hooks.acceptVerdict(contract, sub, stopRecord, career) ->
//   { ok: true, got?: {k: value} } | { ok: false, why } | { ok: null, why } (pending). A missing hook = pending.
//
// One sub against one stop -> { st: 'done'|'picked'|'no', why, got?, medal? }
function contractSubOnStop(rec, sub, prog, stop, hooks, career) {
  const at = stop.aero, row = stop.row || {}, aboard = stop.load || {};
  const F = CONTRACT_FIELDS;
  const nm = id => (F[id] ? F[id].name : id || 'nowhere');
  // (G2340 FREIGHT) THE LOAD ABOARD IS THE LOADED ITEMS when the stop carries them: every item of the job's load
  // (by id) is aboard; with no items loaded, the typed kilos stand in (the fallback, as before)
  const itemsMissing = L => (Array.isArray(L.items) && L.items.length && Array.isArray(aboard.items))
    ? L.items.filter(it => !aboard.items.some(a => a && a.id === it.id)).map(it => it.id) : null;
  const loadOk = L => {
    const miss = itemsMissing(L);
    if (miss) return !miss.length && (aboard.pax || 0) >= (L.pax || 0);
    return (aboard.kg || 0) >= (L.kg || 0) && (aboard.pax || 0) >= (L.pax || 0) && (!L.bulk || aboard.bulk === L.bulk);
  };
  const loadWhy = L => { const miss = itemsMissing(L); return miss && miss.length ? 'not aboard: ' + miss.join(', ') + ' (' + aboard.items.length + ' items loaded)'
    : 'aboard ' + (aboard.kg || 0) + ' kg / ' + (aboard.pax || 0) + ' pax' + (aboard.bulk ? ' / ' + aboard.bulk : '')
    + ', the job is ' + (L.kg || 0) + ' kg / ' + (L.pax || 0) + ' pax' + (L.bulk ? ' / ' + L.bulk : ''); };
  const whenWhy = () => (sub.when ? contractWhenOk(sub.when, stop) : '');
  // (G2705 CAREER-DAMAGE) AN ACCEPTANCE FLOWN BENT FAILS: a build contract's acceptance ('accept' / 'deliver' with
  // crit) and a timed challenge ('fly' with medals) judge the airframe as it stopped - stop.structural, the stop
  // record's { damaged, why } (Deform's sim.damage().structural; absent = not damaged). A transport job that
  // arrives damaged still delivers (the repair is free).
  const S = stop.structural;
  const bentWhy = () => (S && S.damaged && (rec.kind === 'build' || rec.kind === 'challenge')
    && (((sub.do === 'accept' || sub.do === 'deliver') && Array.isArray(sub.crit) && sub.crit.length) || (sub.do === 'fly' && sub.medals)))
    ? 'flown with structural damage' + (S.why ? ' (' + S.why + ')' : '') : '';
  if (sub.do === 'carry') {
    if (at === sub.to) {
      if (!(prog.picked || row.from === sub.from)) return { st: 'no', why: 'the load was not taken on at ' + nm(sub.from) };
      if (!loadOk(sub.load)) return { st: 'no', why: loadWhy(sub.load) };
      const w = whenWhy(); if (w) return { st: 'no', why: w };
      return { st: 'done', why: '' };
    }
    if (at === sub.from) {
      if (prog.picked) return { st: 'no', why: 'already loaded' };
      if (!loadOk(sub.load)) return { st: 'no', why: loadWhy(sub.load) };
      return { st: 'picked', why: 'loaded at ' + nm(at) };
    }
    return { st: 'no', why: 'stopped at ' + nm(at) + ': the job runs ' + nm(sub.from) + ' to ' + nm(sub.to) };
  }
  if (sub.do === 'land') {
    if (at !== sub.to) return { st: 'no', why: 'stopped at ' + nm(at) + ', not ' + nm(sub.to) };
    const w = whenWhy(); if (w) return { st: 'no', why: w };
    return { st: 'done', why: '' };
  }
  if (sub.do === 'fly') {
    if (at !== sub.to) return { st: 'no', why: 'stopped at ' + nm(at) + ', not ' + nm(sub.to) };
    if (sub.from && row.from !== sub.from) return { st: 'no', why: 'the leg left ' + nm(row.from) + ', not ' + nm(sub.from) };
    const w = whenWhy(); if (w) return { st: 'no', why: w };
    const b = bentWhy(); if (b) return { st: 'no', why: b };
    if (sub.medals) {
      const t = +row.t;
      if (!isFinite(t)) return { st: 'no', why: 'no time in the logbook row' };
      const m = sub.medals.slice().sort((a, b) => a.le - b.le).find(x => t <= x.le);
      if (!m) return { st: 'no', why: t + ' s: ' + Math.max(...sub.medals.map(x => x.le)) + ' s or less for a medal' };
      return { st: 'done', why: '', medal: m.medal };
    }
    return { st: 'done', why: '' };
  }
  if (sub.do === 'survey') {
    if (at === sub.at || (Array.isArray(stop.overflew) && stop.overflew.includes(sub.at))) return { st: 'done', why: '' };
    return { st: 'no', why: nm(sub.at) + ' was not overflown' };
  }
  if (sub.do === 'deliver' || sub.do === 'accept') {
    if (sub.do === 'deliver' && at !== sub.to) return { st: 'no', why: 'delivered at ' + nm(sub.to) + ', stopped at ' + nm(at) };
    const b = bentWhy(); if (b) return { st: 'no', why: 'refused: ' + b };
    const H = hooks && typeof hooks.acceptVerdict === 'function' ? hooks.acceptVerdict : null;
    if (!H) return { st: 'no', pending: true, why: 'acceptance pending: no verdict yet' };
    let v;
    try { v = H(rec, sub, stop, career); } catch (e) { v = { ok: null, why: 'the verdict failed: ' + (e && e.message) }; }
    if (!v || v.ok == null) return { st: 'no', pending: true, why: (v && v.why) || 'acceptance pending' };
    if (v.ok === false) return { st: 'no', why: 'refused: ' + (v.why || 'a criterion is not met') };
    return { st: 'done', why: '', got: v.got || {} };
  }
  return { st: 'no', why: 'unknown do ' + sub.do };
}

// the pay a completed contract earns: the total (a job) or the base, plus the bonuses its margins and medal earn
function contractPayTotal(rec, got, medal) {
  const P = rec.pay || {};
  let total = (typeof P.total === 'number' && isFinite(P.total)) ? P.total : Math.round(contractStoryBase(rec));
  const crit = contractCrit(rec);
  let pct = 0;
  for (const b of P.bonus || []) {
    if (b.crit === 'medal') { if (medal === b.by) pct += b.pct; continue; }
    const c = crit.find(x => x.k === b.crit), g = got && got[b.crit];
    if (!c || typeof g !== 'number' || typeof c.v !== 'number') continue;
    const beat = c.op === '>=' ? g >= c.v * (1 + b.by) : c.op === '<=' ? g <= c.v * (1 - b.by) : false;
    if (beat) pct += b.pct;
  }
  return Math.round(total * (1 + pct / 100) / CONTRACT_PAY.round) * CONTRACT_PAY.round;
}

// ---- THE NARRATIVE PACK'S IMPORT (Block 5's JSON shape; a bonus) -------------------------------------------
// -> { ok, text: a new text table (the old keys kept, the pack's words over them, draft: false), why: [] }.
// Every airfield id must exist, every contract / build id must be ours, no build text names a configuration,
// and a job title's slots are {from} {to} {load} {at} {then} only. Pure: the table handed in is not changed.
function contractImportPack(pack, text) {
  const T = ctClone(text || CONTRACT_TEXT), why = [];
  const ids = contractAuthored();
  const put = (k, s, check) => {
    if (typeof s !== 'string' || !s) return;
    if (check) { const w = contractConfigWord(s); if (w) { why.push(k + ' names a configuration (' + w + ')'); return; } }
    T[k] = { t: s, draft: false };
  };
  const P = (pack && typeof pack === 'object') ? pack : {};
  for (const p of P.providers || []) {
    if (!CONTRACT_PROVIDERS[p.id]) { why.push('no provider ' + p.id); continue; }
    put('prov.' + p.id + '.name', p.name); put('prov.' + p.id + '.desc', p.desc);
  }
  for (const c of P.contracts || []) {
    if (!ids[c.id]) { why.push('no contract ' + c.id); continue; }
    for (const st of c.stages || []) for (const f of ['from', 'to']) if (st[f] && !CONTRACT_FIELDS[st[f]]) why.push(c.id + ': no airfield ' + st[f]);
    const b = ids[c.id].kind === 'build';
    put('ct.' + c.id + '.title', c.title, b); put('ct.' + c.id + '.brief', c.brief, b); put('ct.' + c.id + '.done', c.done, b);
  }
  for (const b of P.builds || []) {
    if (!ids[b.id] || ids[b.id].kind !== 'build') { why.push('no build contract ' + b.id); continue; }
    for (const s of b.criteria || []) { const w = contractConfigWord(s); if (w) why.push(b.id + ': a criterion names a configuration (' + w + ')'); }
    put('ct.' + b.id + '.brief', b.brief, true);
    if (b.followUp) put('ct.' + b.id + '.follow', b.followUp.brief, true);
  }
  const seen = {};
  for (const j of P.jobs || []) {
    const Pr = CONTRACT_PROVIDERS[j.provider];
    if (!Pr) { why.push('no provider ' + j.provider + ' for a job'); continue; }
    const slots = (String(j.title || '') + ' ' + String(j.brief || '')).match(/\{(\w+)\}/g) || [];
    const bad = slots.filter(s => !['{from}', '{to}', '{load}', '{at}', '{then}'].includes(s));
    if (bad.length) { why.push(j.provider + ' job: unknown slot ' + bad.join(' ')); continue; }
    // the pack's jobs are matched to the provider's templates in order, by the load's word where it names one
    const n = seen[j.provider] = (seen[j.provider] || 0);
    const tpl = Pr.jobs.find(t => t.goods === j.load) || Pr.jobs[n % Pr.jobs.length];
    seen[j.provider]++;
    put(tpl.title, j.title); put(tpl.brief, j.brief);
  }
  return { ok: !why.length, text: T, why };
}
// ===========================================================================
// THE CAREER DOCUMENT (G2240 CONTRACT-MODEL) — `flydiy.career.<id>`: a player
// document (70_player.js) with mode 'career' and a `career` block; its
// creation from the grant, its normaliser, the offers, accepting and tracking,
// and a flight's end applied to it. futureDesigns/GAME-2026-10-06.md §13.2,
// §R (GQ23 the grant, GQ26 the follow-up, GQ28 per-provider reputation,
// G-COST net pay), §11 (the tracks).
// ===========================================================================
// THE SHAPE (§13.2; the player document's v2 fields untouched, PLAYER_V unchanged — the `career` block rides
// along a v2 document exactly as any unknown field does, so no version step is spent here):
//   { what: 'flydiy-player', v, wallet, mode: 'career', here, clock, sheds, fleet, ledger,
//     career: {
//       id, seed, started, name, cv: CAREER_V,
//       day: { date: 'YYYY-MM-DD', utc: s },                            G2650 the sim clock's instant (forward only)
//       voucher: { kind: 'maker', model: 'cub', used: false },          GQ23
//       providers: { <id>: { rep: 0..5, arc: <arc contracts done> } },  GQ28
//       contracts: { offered: [id], accepted: [id], tracked: id|null, done: [ {id, at, pay, medal?} ],
//                    live: { <id>: { stage, subs: [bool], picked: [bool], got: {} } },
//                    sky: { epoch, date, cover } },                    G2665 the offers' sky (the night work's)
//       cover: 0..1,                                                    G2665 the day's cloud cover, as the page saw it
//       tracks: { field, minedock, resort, survey, clients },            §11.2 (mine + dock = one track)
//       pilots: {}, roster: [], market: { used: [], seen: 0 }, airframes: {} } }   (PILOTS / PROCURE fill these)
// A contract is NEVER stored whole: an authored one is looked up by id, a job regenerated from its id and the
// career seed, a follow-up from its chain (careerContract). `live` holds progress only.
//
// Pure: every operation works on a clone and returns { ok, doc, why, ... }; a refusal hands back the very
// document it was given, untouched. No DOM, no storage (app.js owns the localStorage glue, a later session).
// ===========================================================================
// v2 (G2650 SIM-CLOCK): the career carries its DAY - `career.day: { date, utc }`, the sim clock's instant (07_day.js
// DAY's date + UT second) - saved at a flight's end, a wait, a stop: the next session starts where the last one stopped.
// A v1 career had none; its day is the one its flown clock implies (CAREER_DAY0 + doc.clock seconds: the clock ran
// with flown time from the game's first day), lifted once by the normaliser. The career's day only moves FORWARD
// (careerDaySet refuses an earlier instant); the sandbox keeps its pref (day_clock.js) and every control.
const CAREER_V = 2;
// the career's first day: the game's day (viewer/day_clock.js GAME_DAY, 2026-06-21 16:00 AKDT) as UT
const CAREER_DAY0 = Object.freeze({ date: '2026-06-22', utc: 0 });
const CAREER_KEY = 'flydiy.career.';
const CAREER_GRANT = 60000;                                   // GQ23: the grant ...
const CAREER_VOUCHER = { kind: 'maker', model: 'cub' };      // ... and a free maker's Cub
const careerKey = id => CAREER_KEY + (id || 'main');
const crClone = o => JSON.parse(JSON.stringify(o));
const crNo = (doc, why) => ({ ok: false, doc, why });

function careerBlockDefault(o) {
  o = o || {};
  const providers = {};
  for (const p of Object.keys(CONTRACT_PROVIDERS)) providers[p] = { rep: 0, arc: 0 };
  const tracks = {};
  for (const t of Object.keys(CONTRACT_TRACKS)) tracks[t] = 0;
  return {
    id: o.id || 'main', seed: String(o.seed != null ? o.seed : 'jolene'), started: o.started || null,
    name: o.name || '', cv: CAREER_V,
    day: careerDayOk(o.day) ? careerDayNorm(o.day) : { date: CAREER_DAY0.date, utc: CAREER_DAY0.utc },
    voucher: Object.assign({}, CAREER_VOUCHER, { used: false }),
    providers,
    contracts: { offered: [], accepted: [], tracked: null, done: [], live: {} },
    tracks,
    pilots: {}, roster: [], market: { used: [], seen: 0 }, airframes: {},
  };
}

// THE CAREER'S MAIN HANGAR (G2315 WORKS-COZY; GAME-2026-10-06 §R GQ22: "it should be updated to the largest hangar
// probably, even though I find the medium one less intimidating and warmer. Main garage should be cozy"): the WORKS
// shell at its own 40 x 40 m, every kit, stood in the `cozy` layout (26_hangar_fit HANGAR_LAYOUTS) - the bench corner,
// the woodshop bay, the office, the lounge round the build bay. The sandbox keeps today's club (GQ29).
// G2318: the HEARTH (the cozy works with the life brought to the stand) was the default; 'cozy' (the rooms along the
// walls) kept beside it for the user's pick (GARAGE_ENV.setLayout in a career).
// G2319.1 (train 44; the user, 10 Oct, on the stills: "not sure what the hearth adds" - KEEP TODAY'S HANGAR for now, the
// hearth later; long term a derelict giant beside a small good hangar, HANGAR-STORAGE): the career's main hangar is
// TODAY'S CLUB again (the player default's: no layout, careerMainShed null), with its resident (the garage's club + 1:
// the room moved under the stand). The works' layouts stay selectable (GARAGE_ENV.setLayout takes the shell with it).
const CAREER_MAIN = { shell: 'club', layout: null };
// the train-43 default, recognised so a dev career made under it comes back to the club (careerNormalise, once)
const CAREER_MAIN_T43 = { shell: 'works', layout: 'hearth' };
function careerMainShed() {
  if (!CAREER_MAIN.layout) return null;                        // today's club: the player default's main hangar stands
  const L = (typeof HANGAR_LAYOUTS !== 'undefined') ? HANGAR_LAYOUTS[CAREER_MAIN.layout] : null;
  const S = (typeof SHELLS !== 'undefined') ? SHELLS[CAREER_MAIN.shell] : null;
  if (!L || !S) return null;                                   // a core without the hangar tables: the default stands
  return { shell: CAREER_MAIN.shell, dims: Object.assign({}, S.dims), kits: L.kits.slice(), layout: CAREER_MAIN.layout,
           base: 'HOME', tenure: 'own' };
}
// a main hangar nobody has touched yet: the player default's club (no dims, no dress, the default kits, no layout) -
// what every career made before G2315 holds; careerNormalise hands it the career's main hangar, once
function careerMainUntouched(h) {
  if (!h || typeof h !== 'object' || h.shell !== 'club' || h.layout || h.dims || h.parts) return false;
  const def = (typeof HANGAR_KITS_DEFAULT !== 'undefined') ? HANGAR_KITS_DEFAULT : null;
  return !!def && Array.isArray(h.kits) && h.kits.join() === def.join();
}
// ...and the train-43 default nobody touched (the works at its own dims, every kit, the hearth, no dress): a dev career
// made under it (?career=1, train 43 only) is handed today's club back, once (G2319.1)
function careerMainT43Untouched(h) {
  if (!h || typeof h !== 'object' || h.shell !== CAREER_MAIN_T43.shell || h.layout !== CAREER_MAIN_T43.layout || h.parts) return false;
  const S = (typeof SHELLS !== 'undefined') ? SHELLS[h.shell] : null, def = (typeof HANGAR_KITS_DEFAULT !== 'undefined') ? HANGAR_KITS_DEFAULT : null;
  return !!S && !!def && !!h.dims && h.dims.HW === S.dims.HW && h.dims.HD === S.dims.HD && h.dims.EAVE === S.dims.EAVE &&
    Array.isArray(h.kits) && h.kits.join() === def.join();
}

// A NEW CAREER (GQ23): a fresh player document in career mode — the main hangar at HOME, an empty fleet —
// the grant written into the ledger as income (so the history says where the money came from), the voucher
// unspent, every track at 0, and the first offers.
function careerNew(o) {
  o = o || {};
  const d = playerDefault();
  d.mode = 'career';
  const main = careerMainShed();
  if (main) d.sheds.HOME = main;
  d.career = careerBlockDefault(o);
  playerCharge(d, -CAREER_GRANT, 'grant', null);
  // G2290 (PILOTS): the companion arrives with the career (76_pilots.js; §9.2 "the first pilot comes with the opening")
  if (typeof pilotsCompanion === 'function') pilotsCompanion(d);
  return careerRefresh(d);
}

// THE NORMALISER: the player document's own (its walk first), then the career block filled where missing and
// carried verbatim where present (unknown fields ride along).
function careerNormalise(r) {
  const d = playerNormalise(playerMigrate(r && typeof r === 'object' ? r : null));
  d.mode = 'career';
  // G2315: a career made before the cozy works holds the player default's untouched club - it becomes the career's
  // main hangar (the base, the tenure and anything else on the record kept); a touched one is the player's, kept
  if (careerMainUntouched(d.sheds.HOME)) { const m = careerMainShed(); if (m) d.sheds.HOME = Object.assign({}, d.sheds.HOME, m, { base: d.sheds.HOME.base, tenure: d.sheds.HOME.tenure }); }
  // G2319.1: the train-43 works back to today's club when that is the main hangar again (the base, the tenure kept)
  else if (!CAREER_MAIN.layout && careerMainT43Untouched(d.sheds.HOME)) {
    const h = d.sheds.HOME, c = playerDefault().sheds.HOME;
    d.sheds.HOME = Object.assign({}, h, { shell: c.shell, kits: c.kits.slice() }, { base: h.base, tenure: h.tenure });
    delete d.sheds.HOME.dims; delete d.sheds.HOME.layout;
  }
  const def = careerBlockDefault();
  const c = (d.career && typeof d.career === 'object') ? d.career : (d.career = def);
  for (const k of ['id', 'seed', 'name']) if (typeof c[k] !== 'string') c[k] = def[k];
  if (typeof c.cv !== 'number') c.cv = 1;
  // v1 -> v2 (G2650): the day the flown clock implies, when the career has none of its own
  if (!careerDayOk(c.day)) c.day = careerDayNorm(dayFromAbs(dayAbs(CAREER_DAY0) + Math.max(0, +d.clock || 0)));
  else c.day = careerDayNorm(c.day);
  if (c.cv < CAREER_V) c.cv = CAREER_V;
  if (!c.voucher || typeof c.voucher !== 'object') c.voucher = def.voucher;
  if (!c.providers || typeof c.providers !== 'object') c.providers = {};
  for (const p of Object.keys(def.providers)) {
    const P = c.providers[p] = (c.providers[p] && typeof c.providers[p] === 'object') ? c.providers[p] : { rep: 0, arc: 0 };
    if (typeof P.rep !== 'number' || !isFinite(P.rep)) P.rep = 0;
    P.rep = Math.max(0, Math.min(CONTRACT_GEN.repMax, P.rep));
    if (typeof P.arc !== 'number' || !isFinite(P.arc) || P.arc < 0) P.arc = 0;
  }
  const C = c.contracts = (c.contracts && typeof c.contracts === 'object') ? c.contracts : def.contracts;
  for (const k of ['offered', 'accepted', 'done']) if (!Array.isArray(C[k])) C[k] = [];
  if (typeof C.tracked !== 'string' || !C.accepted.includes(C.tracked)) C.tracked = C.accepted[0] || null;
  if (!C.live || typeof C.live !== 'object') C.live = {};
  for (const id of C.accepted) if (!C.live[id] || typeof C.live[id] !== 'object') C.live[id] = { stage: 0, subs: [], picked: [], got: {} };
  if (!c.tracks || typeof c.tracks !== 'object') c.tracks = {};
  for (const t of Object.keys(def.tracks))
    if (typeof c.tracks[t] !== 'number' || !isFinite(c.tracks[t]) || c.tracks[t] < 0) c.tracks[t] = 0;
  for (const k of ['pilots', 'airframes']) if (!c[k] || typeof c[k] !== 'object' || Array.isArray(c[k])) c[k] = {};
  if (!Array.isArray(c.roster)) c.roster = [];
  if (!c.market || typeof c.market !== 'object') c.market = def.market;
  // G2290 (PILOTS): the roster's rows (76_pilots.js pilotsBlock: unknown ids dropped, a hired pilot always has a row)
  if (typeof pilotsBlock === 'function') pilotsBlock(d);
  return d;
}

// ---- THE CAREER'S DAY (G2650 SIM-CLOCK) ---------------------------------------------------------------------------
const careerDayOk = o => !!(o && typeof o === 'object' && /^\d{4}-\d{2}-\d{2}$/.test(o.date) && typeof o.utc === 'number' && isFinite(o.utc));
// one instant, one spelling: the utc in [0, 86400) on its own UT date (whole seconds: the document is a save)
const careerDayNorm = o => { const r = dayFromAbs(Math.round(dayAbs(o))); return { date: r.date, utc: r.utc }; };
function careerDay(doc) {
  const c = doc && doc.career;
  return careerDayOk(c && c.day) ? careerDayNorm(c.day) : careerDayNorm(dayFromAbs(dayAbs(CAREER_DAY0) + Math.max(0, +(doc && doc.clock) || 0)));
}
// the career's day moves to `o` ({date, utc}) - FORWARD ONLY: an earlier instant is refused (the career never goes
// back; a wait, a flight's end, a stop all move it on). The same instant is a no-op that still answers ok.
function careerDaySet(doc, o) {
  if (!doc || !doc.career) return crNo(doc, 'not a career');
  if (!careerDayOk(o)) return crNo(doc, 'not a day: ' + JSON.stringify(o));
  const now = careerDay(doc), to = careerDayNorm(o), dt = dayAbs(to) - dayAbs(now);
  if (dt < 0) return crNo(doc, 'the career\'s clock only moves forward (' + now.date + ' ' + Math.round(now.utc) + ' s UT, asked ' + to.date + ' ' + Math.round(to.utc) + ' s)');
  const d = crClone(doc);
  d.career.day = to;
  return { ok: true, doc: d, why: '', dt };
}

// ---- THE OFFERS' SKY (G2665 NIGHT-OPS) -----------------------------------------------------------------------------
// The night work is drawn under the sky of the day the offers were made (73_ contractSky): the career's LOCAL date
// when this epoch's offers came, and the day's cloud cover as the page last saw it (`career.cover`, 0..1: overcast = no
// moon light). Stamped as `contracts.sky = { epoch, date, cover }` by careerRefresh (a refresh that keeps the epoch keeps
// the stamp), so an offer holds while the clock moves on; a career with no stamp (or a new epoch not yet refreshed)
// reads it live off its clock. careerOfferSky(doc) -> 73_'s sky (or null: no night work).
function careerLocalDate(doc) {
  const d = careerDay(doc);
  try { return DAY.makeDay({ date: d.date, utc: d.utc }).localDate; } catch (e) { return d.date; }
}
function careerSkyStamp(doc) {
  const c = doc.career, e = contractEpoch(careerDoneIds(doc).length), S = c.contracts && c.contracts.sky;
  if (S && S.epoch === e && /^\d{4}-\d{2}-\d{2}$/.test(S.date) && typeof S.cover === 'number') return S;
  const cover = Math.max(0, Math.min(1, +c.cover || 0));
  return { epoch: e, date: careerLocalDate(doc), cover: Math.round(cover * 100) / 100 };
}
function careerOfferSky(doc) {
  if (!doc || !doc.career || typeof contractSky !== 'function') return null;
  const S = careerSkyStamp(doc);
  return contractSky(S.date, S.cover);
}

// ---- WHICH CONTRACT AN ID IS --------------------------------------------------------------------------------
const careerDoneIds = doc => doc.career.contracts.done.map(x => x.id);
function careerContract(doc, id) {
  if (!id) return null;
  const A = contractAuthored();
  if (A[id]) return A[id];
  const c = doc && doc.career;
  // an ACCEPTED generated job is the record as it was offered (its load drew on the reputation of that moment;
  // a later contract moving the reputation must not change a job already taken)
  const L = c && c.contracts && c.contracts.live && c.contracts.live[id];
  if (L && L.rec && typeof L.rec === 'object') return L.rec;
  if (/^job:/.test(id)) {
    const m = /^job:(\w+):/.exec(id);
    return contractJobById(c ? c.seed : '', id, { rep: c && m && c.providers[m[1]] ? c.providers[m[1]].rep : 0, sky: careerOfferSky(doc) });
  }
  if (/\+\d+$/.test(id)) return contractFollowById(id, A);
  // G2260 (ECONOMY, GQ6): the Field Trust's loan job, offered below the wallet's floor (76_ econLoanJob)
  if (/^loan:/.test(id) && typeof econLoanJob === 'function') return econLoanJob(doc, id);
  return null;
}
function careerNeedsOk(doc, rec) {
  const N = rec.needs || {}, P = doc.career.providers[rec.provider] || { rep: 0 };
  if ((N.rep || 0) > P.rep + 1e-9) return false;
  const done = careerDoneIds(doc);
  return (N.after || []).every(a => done.includes(a));
}

// ---- THE OFFERS -------------------------------------------------------------------------------------------------
// Per provider: the NEXT arc contract (its needs met), its standalone build contracts (needs met, not done),
// a follow-up for each delivered build contract (GQ26: the happy client comes back), and the jobs of this
// epoch (seed + completed count). Nothing accepted or done is offered again (a job's id carries its epoch, so
// the next epoch's jobs are new ones). Reputation never hides a tab (g7): it scales the jobs' loads.
function careerOfferIds(doc) {
  const c = doc.career, C = c.contracts;
  const done = careerDoneIds(doc), taken = new Set(done.concat(C.accepted));
  const out = [];
  const A = contractAuthored(), sky = careerOfferSky(doc);
  for (const p of Object.keys(CONTRACT_PROVIDERS)) {
    const P = CONTRACT_PROVIDERS[p];
    const next = P.arc.find(r => !done.includes(r.id));
    // (G2320) a contract the certificate cannot answer is HELD OUT (73_ contractCertifiable: the aerobatic box)
    if (next && !taken.has(next.id) && careerNeedsOk(doc, A[next.id]) && contractCertifiable(A[next.id])) out.push(next.id);
    for (const b of P.builds || []) if (!taken.has(b.id) && careerNeedsOk(doc, A[b.id]) && contractCertifiable(A[b.id])) out.push(b.id);
    // (G2665 NIGHT-OPS) the provider's authored night work, each once its needs are met - held out while no validated
    // design can fly it (73_ contractFlyable: the stretcher case)
    for (const r of P.night || []) if (!taken.has(r.id) && careerNeedsOk(doc, A[r.id]) && contractFlyable(A[r.id])) out.push(r.id);
    for (const j of contractJobs(c.seed, p, done.length, { rep: c.providers[p].rep, sky })) if (!taken.has(j.id)) out.push(j.id);
  }
  // G2260 (ECONOMY, GQ6): no bankruptcy - below the floor the Field Trust offers its loan job (76_ econLoanOffer)
  const loan = typeof econLoanOffer === 'function' ? econLoanOffer(doc) : null;
  if (loan && !taken.has(loan)) out.unshift(loan);
  // follow-ups: the last of each delivered build contract's chain
  const builds = done.filter(id => { if (/^job:/.test(id)) return false; const r = careerContract(doc, id); return r && r.kind === 'build'; });
  for (const id of builds) {
    const r = careerContract(doc, id), f = contractFollowUp(r);
    if (f && !taken.has(f.id) && contractCertifiable(f)) out.push(f.id);
  }
  return out;
}
function careerRefresh(doc) {
  doc.career.contracts.sky = careerSkyStamp(doc);          // (G2665) the offers' sky, held for the epoch
  doc.career.contracts.offered = careerOfferIds(doc);
  return doc;
}
function careerOffers(doc) {
  const d = careerRefresh(crClone(doc));
  return { ok: true, doc: d, offers: d.career.contracts.offered.map(id => careerContract(d, id)).filter(Boolean), why: '' };
}

// ---- ACCEPT, TRACK, ABANDON ---------------------------------------------------------------------------------------
// Accept many, track one (§8.2): accepting puts the contract in the list and, when none is tracked, tracks it.
function careerAccept(doc, id) {
  const C = doc.career && doc.career.contracts;
  if (!C) return crNo(doc, 'not a career');
  if (C.accepted.includes(id)) return crNo(doc, id + ' is already accepted');
  if (!careerOfferIds(doc).includes(id)) return crNo(doc, id + ' is not on offer');
  const rec = careerContract(doc, id);
  if (!rec) return crNo(doc, 'no contract ' + id);
  const d = crClone(doc), D = d.career.contracts;
  D.accepted.push(id);
  D.live[id] = { stage: 0, subs: rec.stages[0].subs.map(() => false), picked: rec.stages[0].subs.map(() => false), got: {} };
  if (rec.kind === 'job') D.live[id].rec = rec;            // the job as offered (careerContract reads it back)
  if (!D.tracked) D.tracked = id;
  careerRefresh(d);
  return { ok: true, doc: d, why: '' };
}
function careerTrack(doc, id) {
  const C = doc.career && doc.career.contracts;
  if (!C || (id !== null && !C.accepted.includes(id))) return crNo(doc, id + ' is not accepted');
  const d = crClone(doc);
  d.career.contracts.tracked = id;
  return { ok: true, doc: d, why: '' };
}
function careerAbandon(doc, id) {
  const C = doc.career && doc.career.contracts;
  if (!C || !C.accepted.includes(id)) return crNo(doc, id + ' is not accepted');
  const d = crClone(doc), D = d.career.contracts;
  D.accepted = D.accepted.filter(x => x !== id);
  delete D.live[id];
  if (D.tracked === id) D.tracked = D.accepted[0] || null;
  careerRefresh(d);
  return { ok: true, doc: d, why: '' };
}

// ---- A FLIGHT'S END, ON ONE CONTRACT ------------------------------------------------------------------------------
// contractOnStop(career, contract, stopRecord, hooks) -> { ok, doc, why, events }
//   ok true: the document ADVANCED (a sub done or a load picked up, a stage, the contract completed: paid, the
//   reputation, the stage unlock, the follow-up offered); ok false: the very document handed in, untouched,
//   with the reason. A build contract's criteria are never judged here: hooks.acceptVerdict (ACCEPT) is asked,
//   and a missing hook is "pending" (events carry { k: 'pending' }).
function contractOnStop(doc, contract, stop, hooks) {
  if (!doc || !doc.career) return crNo(doc, 'not a career');
  const id = typeof contract === 'string' ? contract : contract && contract.id;
  const C = doc.career.contracts;
  if (!id || !C.accepted.includes(id)) return crNo(doc, (id || 'no contract') + ' is not accepted');
  const rec = (typeof contract === 'object' && contract) ? contractNormalise(contract) : careerContract(doc, id);
  if (!rec) return crNo(doc, 'no contract ' + id);
  if (!stop || typeof stop !== 'object') return crNo(doc, 'no stop record');
  if (stop.wrecked) return crNo(doc, 'the aeroplane is wrecked: nothing is delivered');
  if (!stop.aero) return crNo(doc, 'stopped off an aerodrome: nothing is delivered');
  const L = C.live[id] || { stage: 0, subs: [], picked: [], got: {} };
  const st = rec.stages[L.stage];
  if (!st) return crNo(doc, id + ' has no stage ' + L.stage);
  const res = st.subs.map((s, j) => L.subs[j] ? { st: 'was' } : contractSubOnStop(rec, s, { picked: !!L.picked[j] }, stop, hooks, doc));
  if (!res.some(r => r.st === 'done' || r.st === 'picked')) {
    const r = res.find(x => x.st === 'no') || { why: 'nothing to do here' };
    const out = crNo(doc, r.why);
    if (r.pending) out.events = [{ k: 'pending', id, why: r.why }];
    return out;
  }
  const d = crClone(doc), D = d.career.contracts;
  const live = D.live[id] = D.live[id] || { stage: 0, subs: [], picked: [], got: {} };
  const events = [];
  let medal = live.medal || null;
  res.forEach((r, j) => {
    if (r.st === 'done') {
      live.subs[j] = true; live.picked[j] = false;
      Object.assign(live.got, r.got || {});
      if (r.medal) medal = live.medal = r.medal;
      events.push({ k: 'sub', id, stage: live.stage, sub: j });
    } else if (r.st === 'picked') {
      live.picked[j] = true;
      events.push({ k: 'picked', id, stage: live.stage, sub: j, at: stop.aero });
    }
  });
  if (st.subs.every((s, j) => live.subs[j])) {
    events.push({ k: 'stage', id, stage: live.stage });
    live.stage++;
    if (live.stage < rec.stages.length) {
      live.subs = rec.stages[live.stage].subs.map(() => false);
      live.picked = rec.stages[live.stage].subs.map(() => false);
    } else {
      careerComplete(d, rec, live, medal, events);
    }
  }
  return { ok: true, doc: d, why: '', events };
}
// the contract completed: paid net (G-COST), the provider's reputation (GQ28), the arc, the stage unlock (§11),
// the done list (the completed count the generator reads), and the offers refreshed (the follow-up among them)
function careerComplete(d, rec, live, medal, events) {
  const c = d.career, C = c.contracts;
  const pay = contractPayTotal(rec, live.got, medal);
  playerCharge(d, -pay, rec.loan ? 'loan' : 'contract', rec.id);   // G2260: the Trust's loan job writes a `loan` line
  const P = c.providers[rec.rep.provider] || (c.providers[rec.rep.provider] = { rep: 0, arc: 0 });
  P.rep = Math.max(0, Math.min(CONTRACT_GEN.repMax, +(P.rep + (rec.rep.gain || 0)).toFixed(3)));
  const prov = CONTRACT_PROVIDERS[rec.provider];
  if (prov && prov.arc.some(r => r.id === rec.id)) c.providers[rec.provider].arc++;
  let unlocked = null;
  if (rec.unlock && rec.unlock.stage) {
    const m = /^(\w+):(\d+)$/.exec(rec.unlock.stage);
    if (m) { c.tracks[m[1]] = Math.max(c.tracks[m[1]] || 0, +m[2]); unlocked = rec.unlock.stage; }
  }
  const row = { id: rec.id, at: Math.round(d.clock || 0), pay };
  if (medal) row.medal = medal;
  C.done.push(row);
  C.accepted = C.accepted.filter(x => x !== rec.id);
  delete C.live[rec.id];
  if (C.tracked === rec.id) C.tracked = C.accepted[0] || null;
  careerRefresh(d);
  events.push({ k: 'done', id: rec.id, pay, medal: medal || null, unlock: unlocked,
                followUp: rec.kind === 'build' ? ((contractFollowUp(rec) || {}).id || null) : null });
}

// ---- A FLIGHT'S END, ON THE CAREER -----------------------------------------------------------------------------------
// Every accepted contract (the tracked one first) meets the stop; the document comes back advanced by each that
// moved, with every event and, for those that did not move, why.
function careerOnStop(doc, stop, hooks) {
  if (!doc || !doc.career) return crNo(doc, 'not a career');
  const C = doc.career.contracts;
  const order = (C.tracked ? [C.tracked] : []).concat(C.accepted.filter(x => x !== C.tracked));
  let d = doc, moved = false;
  const events = [], why = {};
  for (const id of order) {
    const r = contractOnStop(d, id, stop, hooks);
    if (r.ok) { d = r.doc; moved = true; events.push(...r.events); }
    else { why[id] = r.why; if (r.events) events.push(...r.events); }
  }
  return moved ? { ok: true, doc: d, why: '', events, untouched: why } : { ok: false, doc, why: 'no contract moved', events, untouched: why };
}
// ===========================================================================
// THE CAREER, WIRED TO THE PAGE (G2320 CAREER-WIRE) — the pure half of the
// wiring: the MAP's record built off the career document (careerMapRecord), a
// certificate's facts off a validated design or a saved build's shakedown, the
// stop record a flight's end hands to careerOnStop (careerStopRecord), the
// sites a flight passed over (careerOverflewAdd), ACCEPT's verdict as
// CONTRACT-MODEL's hook (careerAcceptHook), and the events as words for the
// arrival card (careerEventLines). futureDesigns/GAME-2026-10-06.md §R, §7.3,
// §8.3, §13.2; HANDOVER G2240 / G2250 / G2270 "OPEN / FOR THE COORDINATOR".
// ===========================================================================
// THE RECORD THE MAP READS (map_menu.js mapAdapt; the shape of tools/fixtures/contracts_sample.json, §7.3):
//   { what: 'flydiy-career-map', v, source: 'career',
//     providers: [ { id, name, short, colour, home, line, rep, track } ],
//     contracts: [ the accepted (in order) then the offers: { id, provider, kind, title, brief (RESOLVED words),
//                  stages: [ { subs: [ {do, from?, to?, at?, load?, when?, crit?: [ {k, op, v, at?, words} ]} ] } ],
//                  pay: contractPay(rec) + { bonus }, rep, unlock?, followLine?, classes,
//                  mark: { ok, gear: {ok, why}, door: {ok, why, items} } | null (G2340: the ✓ / ✗, freightMark) } ],
//     career: { accepted, tracked, stage: {id: n}, live: {id: {stage, subs, picked}}, wallet, clock, done, voucher },
//     fleet: [ { slot, name, where: playerWhere, cert | null } ],    the player document's own airframes
//     board: [ { name, cert } ] }                                     (opts.board: designs not materialised)
// A certificate (`cert`, the map's facts): { seats, payloadKg, emptyKg, toRunM, gear, power, tasKmh, enduranceMin,
// spanM, cost, tankL, ult, from } — from the career's own airframe row (`career.airframes[slot].design`, a
// CONTRACT_DESIGNS id: the voucher's maker Cub, PROCURE's purchases), else the page's reading of the saved build's
// shakedown (opts.certs[slot], careerDesignOfShake's row), else null: "certificate not read yet".
//
// Pure: no DOM, no storage, no clock (the gate scans this file as it scans 72-74).
// ===========================================================================

// THE LOOK of the providers on the map (a UI colour per tab; the names are text keys)
const CAREER_MAP_LOOK = { field: '#d9a441', minedock: '#c2603e', resort: '#5f9fd0', survey: '#79a86a', clients: '#a98bc4' };
const CAREER_MAP_V = 1;
const cwClone = o => JSON.parse(JSON.stringify(o));

// ---- A CERTIFICATE'S FACTS --------------------------------------------------------------------------------
// a CONTRACT_DESIGNS-shaped row -> the facts the map's card states (the cabin's payload is CONTRACT-MODEL's own
// rule: the seats beside the pilot x the station mass + the baggage)
function careerDesignCert(D, from) {
  if (!D || typeof D !== 'object') return null;
  const seats = D.seats | 0;
  return {
    seats, payloadKg: Math.max(0, seats - 1) * CONTRACT_FIT.occKg + (D.bagKg || 0),
    emptyKg: D.emptyKg, toRunM: D.toM, gear: D.gear || 'wheels', power: D.power || 'fuel',
    tasKmh: D.cruiseKmh, enduranceMin: D.cruiseKmh > 0 ? Math.round(D.rangeKm / D.cruiseKmh * 60) : null,
    spanM: D.spanM, cost: D.cost, tankL: D.tankL, ult: contractCertUlt(), massKg: D.massKg, rangeKm: D.rangeKm,
    from: from || D.id || null,
  };
}
// a saved build's shakedown (genShakedown's object, as the page's memo keeps it) -> a CONTRACT_DESIGNS row,
// measured the way GATE CONTRACTS measures the five validated designs
function careerDesignOfShake(s, spec, label) {
  if (!s || !s.envelope) return null;
  const floats = s.gearType === 'floats' || (spec && typeof stripGear === 'function' && stripGear(spec) === 'floats');
  return { id: null, label: label || '', gear: floats ? 'floats' : 'wheels', seats: s.envelope.seats,
           bagKg: (spec && spec.cabin && spec.cabin.baggage) || 0, massKg: s.mass, emptyKg: s.empty, toM: s.TORun,
           cruiseKmh: s.VCruise * 3.6, rangeKm: s.rangeKm, spanM: s.span, cost: s.cost, tankL: s.energyL, power: s.energyKind };
}

// ---- THE MAP'S RECORD -----------------------------------------------------------------------------------------
function cwSub(u, F) {
  const s = cwClone(u);
  if (s.crit) s.crit = s.crit.map(c => Object.assign({}, c, { words: contractCritWords(c, F) }));
  return s;
}
function careerMapContract(doc, id, F, opts) {
  const rec = careerContract(doc, id);
  if (!rec) return null;
  const vars = contractVars(rec, F);
  const pay = Object.assign(contractPay(rec, F), { bonus: cwClone((rec.pay && rec.pay.bonus) || []) });
  const out = {
    id: rec.id, provider: rec.provider, kind: rec.kind,
    title: contractText(rec.title, vars), brief: contractText(rec.brief, vars),
    stages: rec.stages.map(st => ({ subs: st.subs.map(u => cwSub(u, F)) })),
    pay, rep: cwClone(rec.rep || null), classes: contractClasses(rec, F),
  };
  if (rec.unlock) out.unlock = cwClone(rec.unlock);
  if (rec.kind === 'build') out.followLine = contractFollowLine(rec);
  // (G2665 NIGHT-OPS) the window, the runways lit / unlit, the moon: the job line's facts (careerNightLine)
  const nl = careerNightLine(doc, rec, Object.assign({ fields: F }, opts || {}));
  if (nl) out.night = nl;
  return out;
}

// ---- THE NIGHT ON THE JOB LINE (G2665 NIGHT-OPS; §R.3: "the route line says lit / unlit", the job states the moon) -----
// A contract whose route has a time-of-day window -> the line's facts, or null (no window):
//   { when: 'after dusk', night: bool, open: bool (the window is open at the career's hour), opens: 'HH:MM',
//     date: the night's local date (the NEXT opening from the career's clock, or tonight's while it is open),
//     stops: [{ id, name, lit, glide }] (every runway of the route: 25_airfield's rule - land strips lit, water lanes
//     not; an unlit strip at night is the player's call, never a ✗), moon: 73_ contractMoonAt at the window's middle
//     | null (a day window), moonWords, pay: { night, dark } (the premiums the job's pay holds), line: the words }
// opts: { day: a DAY (the page's world.day; else the career's own instant on the default geo), cover: the day's cloud
// cover now (else the career's last seen), fields }
const cwBase = n => String(n || '').replace(/\s+\d{2}[LRC]?\/\d{2}[LRC]?$/, '');
const cwHhmm = h => { const m = Math.round((((h % 24) + 24) % 24) * 60) % 1440; return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'); };
// the career's local date and hour (the page's day when handed, else a scratch day at the career's instant)
function careerLocalNow(doc, day) {
  let d = day;
  if (!d || !d.localDate) { const o = careerDay(doc); try { d = DAY.makeDay({ date: o.date, utc: o.utc }); } catch (e) { return null; } }
  return { date: d.localDate, hour: d.localSeconds / 3600 };
}
const cwDateAdd = (date, n) => dayFromAbs(dayAbs({ date, utc: 43200 }) + n * 86400).date;
// the night (its evening's local date) the window next stands open in, from the local date + hour: the current one while
// it is open, else the next to open. A night N's hours >= 12 are N's evening, < 12 the next morning's.
function careerWindowNight(w, now, cover) {
  let best = null;
  for (const k of [-1, 0, 1, 2]) {
    const N = cwDateAdd(now.date, k), sky = contractSky(N, cover);
    if (!sky) return null;
    const S = contractWhenSpan(w, sky.duskH, sky.dawnH);
    const at = h => k * 24 + (h >= 12 ? h : h + 24);            // hours from the start of today, local
    let t0 = at(S[0]), len = ((S[1] - S[0]) % 24 + 24) % 24;
    if (w.before === 'dusk') { t0 = k * 24; len = S[1]; }        // the day's window: midnight to dusk of that date
    const t1 = t0 + len, T = now.hour;
    if (T >= t0 && T < t1) return { N, sky, open: true, h0: S[0] };
    if (t0 > T && !best) best = { N, sky, open: false, h0: S[0] };
  }
  return best;
}
function careerNightLine(doc, rec, opts) {
  opts = opts || {};
  const F = opts.fields || CONTRACT_FIELDS;
  const subs = contractSubsOf(rec), u = subs.find(x => x.when && !contractWhenWhy(x.when));
  if (!u || typeof contractSky !== 'function') return null;
  const w = u.when, now = careerLocalNow(doc, opts.day);
  const cover = typeof opts.cover === 'number' ? opts.cover : +((doc && doc.career && doc.career.cover) || 0);
  const nt = now ? careerWindowNight(w, now, cover) : null;
  const sky = nt ? nt.sky : contractSky(CONTRACT_NIGHT.sky0, cover);
  const night = contractWhenNight(w, sky ? sky.duskH : null, sky ? sky.dawnH : null);
  const stops = [];
  for (const st of contractStops(rec)) {
    if (st.what === 'over' || stops.some(x => x.id === st.at)) continue;
    const f = F[st.at]; if (!f) continue;
    stops.push({ id: st.at, name: cwBase(f.name), lit: f.lit != null ? !!f.lit : f.surf !== 'water', glide: f.glide || null });
  }
  const moon = night && sky ? contractMoonAt(sky, contractWhenMid(w, sky.duskH, sky.dawnH)) : null;
  const P = contractPay(rec, F);
  const out = { when: contractWhenWords(w), night, open: !!(nt && nt.open), opens: nt ? cwHhmm(nt.h0) : '', date: nt ? nt.N : null,
                stops, moon, moonWords: contractMoonWords(moon), pay: { night: P.night || 0, dark: P.dark || 0 } };
  const parts = [out.when + (nt ? (nt.open ? ' · open now' : (w.arrive ? '' : ' · opens ' + out.opens)) : '')];
  if (night) {
    for (const x of stops) parts.push(x.name + (x.lit ? ' lit' + (x.glide ? ' (' + x.glide.toUpperCase() + ')' : '') : ' unlit'));
    if (out.moonWords) parts.push(out.moonWords);
    if (P.night) parts.push('night pay +' + CONTRACT_PAY.nightPct + ' %' + (P.dark ? ', moonless +' + CONTRACT_PAY.darkPct + ' %' : ''));
  }
  out.line = parts.join(' · ');
  return out;
}
// THE TRACKED CONTRACT'S WINDOW NOW (G2665): the first open sub of its current stage that carries a `when` -> { id, sub,
// when, words, to } or null - the route row's "until the window opens" wait and the night-shy pilot's leg read it
function careerTrackedWhen(doc) {
  const C = doc && doc.career && doc.career.contracts;
  if (!C || !C.tracked) return null;
  const rec = careerContract(doc, C.tracked), L = C.live[C.tracked] || { stage: 0, subs: [] };
  const st = rec && rec.stages[L.stage];
  if (!st) return null;
  const j = st.subs.findIndex((s, i) => !L.subs[i] && s.when && !contractWhenWhy(s.when));
  if (j < 0) return null;
  const s = st.subs[j];
  return { id: rec.id, sub: j, when: cwClone(s.when), words: contractWhenWords(s.when), to: s.to || null, from: s.from || null };
}
// the Wait "until the window opens" for the tracked contract at the page's day -> null (nothing tracked with a window,
// or the window is open now) | { target (DAY_CLOCK.wait's: 'dusk' or local hours), words: 'after dusk', h0, id }
function careerWaitWindow(doc, day) {
  const T = careerTrackedWhen(doc);
  if (!T) return null;
  const now = careerLocalNow(doc, day);
  if (!now) return null;
  const sky = contractSky(now.date, 0), dd = day && typeof dayDuskDawnH === 'function' ? dayDuskDawnH(day) : sky;
  const r = contractWhenWait(T.when, now.hour, dd.duskH, dd.dawnH);
  return r ? { target: r.target, h0: r.h0, words: T.words, id: T.id } : null;
}
// (G2340 FREIGHT) THE MARK (§R.2: ✓ / ✗ only for the hard no-no's - surface vs gear, and NO DOOR FITS: an item that
// passes no door of any of the player's planes; a build contract carries none). The fleet's designs: the career's
// airframe rows (CONTRACT_DESIGNS + their FREIGHT_CARDS), opts.certs' shakedown rows (no card: their doors are not
// known, so they never make a ✗), opts.cards[slot] (a card the page measured) -> freightMark's { ok, gear, door }
function careerMapMark(doc, id, fleet, F) {
  const rec = careerContract(doc, id);
  return rec && typeof freightMark === 'function' ? freightMark(rec, fleet, F) : null;
}
// careerMapRecord(careerDoc, world, opts) -> the record above. `world` names the fleet's places (playerPlace);
// opts: { certs: {slot: design row}, board: [{name, design}], fields, cards: {slot: freight card} }.
function careerMapRecord(doc, world, opts) {
  opts = opts || {};
  const F = opts.fields || CONTRACT_FIELDS;
  const c = doc && doc.career;
  if (!c) return { what: 'flydiy-career-map', v: CAREER_MAP_V, source: 'career', providers: [], contracts: [], fleet: [], board: [], career: {} };
  const C = c.contracts;
  const providers = Object.keys(CONTRACT_PROVIDERS).map(id => {
    const P = CONTRACT_PROVIDERS[id];
    return { id, name: contractText(P.name), short: contractText('prov.' + id + '.short'), colour: CAREER_MAP_LOOK[id] || '#888',
             home: (P.fields && P.fields[0]) || null, line: contractText(P.desc),
             rep: (c.providers[id] || {}).rep || 0, track: (c.tracks || {})[P.track] || 0 };
  });
  const offered = careerOfferIds(doc).filter(id => !C.accepted.includes(id));
  const nightOpts = { day: opts.day || (world && world.day) || null, cover: typeof opts.cover === 'number' ? opts.cover : (world && world.day && typeof world.day.cloudCover === 'number' ? world.day.cloudCover : undefined) };
  const contracts = C.accepted.concat(offered).map(id => careerMapContract(doc, id, F, nightOpts)).filter(Boolean);
  const stage = {}, live = {};
  for (const id of C.accepted) {
    const L = C.live[id] || { stage: 0, subs: [], picked: [] };
    stage[id] = L.stage | 0;
    live[id] = { stage: L.stage | 0, subs: (L.subs || []).slice(), picked: (L.picked || []).slice() };
  }
  const af = c.airframes || {}, certs = opts.certs || {};
  const certOf = n => {
    const A = af[n];
    // (G2280 PROCURE) a maker's or a used airframe carries its own certificate (the options' measured effects); a
    // MODIFIED one has none (withdrawn): its facts are the saved build's shakedown, if this browser read it
    if (A && A.modified) return certs[n] ? careerDesignCert(certs[n], 'the saved build\'s shakedown') : null;
    if (A && A.cert && typeof A.cert === 'object') return careerDesignCert(A.cert, A.design || null);
    if (A && A.design && CONTRACT_DESIGNS[A.design]) return careerDesignCert(CONTRACT_DESIGNS[A.design], A.design);
    if (certs[n]) return careerDesignCert(certs[n], 'the saved build\'s shakedown');
    return null;
  };
  const fleet = Object.keys(doc.fleet || {}).sort().map(n => {
    const W = typeof playerWhere === 'function' ? playerWhere(doc, n) : { kind: 'none', aero: null, hangar: null };
    return { slot: n, name: n, where: { kind: W.kind, aero: W.aero, hangar: W.hangar }, cert: certOf(n) };
  });
  // the designs the mark reads, per airframe: the career's design row (its card), else the shakedown's row
  const cards = opts.cards || {};
  const markFleet = Object.keys(doc.fleet || {}).sort().map(n => {
    const A = af[n];
    const design = (A && A.design && CONTRACT_DESIGNS[A.design]) || certs[n] || null;
    return { slot: n, design, card: cards[n] || (A && A.design && typeof freightCardOf === 'function' ? freightCardOf(CONTRACT_DESIGNS[A.design]) : null) };
  });
  for (const c of contracts) c.mark = careerMapMark(doc, c.id, markFleet, F);
  const board = (opts.board || []).map(b => ({ name: b.name, cert: careerDesignCert(b.design, b.name) }));
  return {
    what: 'flydiy-career-map', v: CAREER_MAP_V, source: 'career',
    providers, contracts,
    career: { accepted: C.accepted.slice(), tracked: C.tracked || null, stage, live, wallet: doc.wallet, clock: doc.clock || 0,
              done: C.done.length, voucher: cwClone(c.voucher || null) },
    fleet, board,
    // G2290 (PILOTS): the Pilots tab - the hired pilots and the 2-3 looking for work (76_pilots.js pilotsCard: text
    // resolved, the place by the fleet ledger)
    pilots: typeof pilotsCard === 'function' ? PILOTS_ORDER.map(id => pilotsCard(doc, id, world)).filter(p => p && (p.hired || p.onOffer)) : [],
  };
}

// ---- THE FLIGHT'S EVIDENCE: the sites it passed over, and the stop record ----------------------------------------
// the aerodromes within their field radius (38b_dest.js FLIGHT_FIELD_R, from the strip's rectangle) of (x, z),
// added to `set` (an array of ids, kept in the order first passed) -> set
function careerOverflewAdd(world, x, z, set) {
  const out = set || [];
  for (const a of ((world && world.aerodromes) || [])) {
    if (!a || !a.id || a.kind === 'meadow' || out.includes(a.id)) continue;
    if (flightStripGeom(a, x, z).d <= FLIGHT_FIELD_R) out.push(a.id);
  }
  return out;
}
// THE STOP RECORD (74_career.js contractOnStop's): o = { how, aero (flightWhere's id when flightCanDepart, else null),
// wrecked, slot, gear, occupants (everyone aboard, the pilot counted), cargoKg, items, row: {from, to, t}, overflew,
// hour, duskH?, dawnH?, structural } -> { how, aero, wrecked, structural: {damaged, why}, slot, gear, load: {kg, pax, items?},
// row, overflew, hour, duskH?, dawnH? }. (G2705) `structural` is Deform's sim.damage().structural as the page read it
// ({ damaged, broken, separated, why }; absent before train 41 = not damaged): an acceptance or a challenge flown bent fails
// (73_ contractSubOnStop). Only a STOP delivers:
// an ending that is not 'stopped' carries no aerodrome. (G2340 FREIGHT) THE LOAD IS THE LOADED ITEMS: with items
// aboard (FREIGHT-LOAD's accepted packing), `load.items` is them and `load.kg` their sum; with none, the typed
// cargo kg stands (the fallback).
function careerStopRecord(o) {
  o = o || {};
  const occ = Math.max(0, Math.round(+o.occupants || 0));
  const items = Array.isArray(o.items) && o.items.length && typeof freightItem === 'function' ? freightSplit(o.items) : null;
  const load = items ? { kg: freightKg(items), pax: Math.max(0, occ - 1), items }
                     : { kg: Math.max(0, Math.round(+o.cargoKg || 0)), pax: Math.max(0, occ - 1) };
  const out = {
    how: o.how || 'stopped',
    aero: (o.how === 'stopped' || o.how == null) && o.aero ? o.aero : null,
    wrecked: !!o.wrecked, slot: o.slot || null, gear: o.gear || null,
    structural: { damaged: !!(o.structural && o.structural.damaged), why: (o.structural && o.structural.why) || null },
    load,
    row: { from: (o.row && o.row.from) || null, to: (o.row && o.row.to) || null, t: Math.max(0, Math.round(+(o.row && o.row.t) || 0)) },
    overflew: Array.isArray(o.overflew) ? o.overflew.slice() : [],
    hour: (typeof o.hour === 'number' && isFinite(o.hour)) ? Math.round(o.hour * 100) / 100 : null,
  };
  // (G2650 SIM-CLOCK) the day's own dusk / dawn (07b_clock.js dayDuskDawnH), only when the page hands them in: a
  // time-of-day window is judged on them (73_ contractWhenOk), else on the constants as before
  for (const k of ['duskH', 'dawnH']) if (typeof o[k] === 'number' && isFinite(o[k])) out[k] = Math.round(o[k] * 100) / 100;
  return out;
}
// (G2705 CAREER-DAMAGE, §R.4: "free repair everywhere, but after a crash you reset to your STARTING PLACE") A CRASH
// IN THE CAREER: the aeroplane is back where the flight departed from, repaired. Nothing moves in the document while
// it flies (71_ playerArrive), so the row normally stands there already; a departure aerodrome `from` it does not
// stand at puts it there through playerArrive (the hangar it left when it fits, else tied down). The damage record
// (D5's, a write-off too) is cleared and the wear reset - free, no ledger line; GQ5's recovery line at 0 says what
// happened. The clock is not touched (playerClock already took the flown time). The stop itself delivers nothing
// (contractOnStop: wrecked). (doc, slot, from) -> { ok, doc, why, where: playerWhere, line: { k: 'crash', ok: false, text } }
function careerCrashReset(doc, slot, from) {
  if (!doc || !doc.career) return { ok: false, doc, why: 'not a career' };
  if (!slot || !doc.fleet || !doc.fleet[slot]) return { ok: false, doc, why: (slot || 'no airframe') + ' is not in the fleet' };
  let d = doc;
  const W0 = playerWhere(d, slot);
  if (from && W0.aero !== from) { const r = playerArrive(d, slot, from, {}); if (r.ok) d = r.doc; }
  d = playerRecover(d, slot, {}).doc;                          // a clone: the free recovery line (GQ5, at 0)
  delete d.fleet[slot].damage;
  if (typeof playerWearReset === 'function') d = playerWearReset(d, slot).doc;
  const W = playerWhere(d, slot);
  const place = W.aero ? (CONTRACT_FIELDS[W.aero] ? CONTRACT_FIELDS[W.aero].name : W.aero) : 'its hangar';
  return { ok: true, doc: d, why: '', where: W, line: { k: 'crash', ok: false, text: contractText('ev.crash', { n: place }) } };
}
// the load the tracked contract asks for now (the plate's default cargo): the first open sub's load
function careerTrackedLoad(doc) {
  const C = doc && doc.career && doc.career.contracts;
  if (!C || !C.tracked) return null;
  const rec = careerContract(doc, C.tracked), L = C.live[C.tracked] || { stage: 0, subs: [] };
  const st = rec && rec.stages[L.stage];
  if (!st) return null;
  const j = st.subs.findIndex((s, i) => !L.subs[i] && s.load);
  if (j < 0) return null;
  const out = { kg: st.subs[j].load.kg || 0, pax: st.subs[j].load.pax || 0, sub: j };
  // (G2340 FREIGHT) the items the job's load is (what FREIGHT-LOAD packs and the stop record carries)
  if (typeof freightSubItems === 'function') { const it = freightSubItems(st.subs[j], rec); if (it.length) out.items = it; }
  return out;
}
// the tracked build contract's criteria that need the acceptance LEG (a cruise flown: tasKmh, enduranceMin,
// rangeKm) -> [crit] (empty when nothing tracked, not a build, or none flown)
function careerLegCrit(doc) {
  const C = doc && doc.career && doc.career.contracts;
  if (!C || !C.tracked) return [];
  const rec = careerContract(doc, C.tracked);
  if (!rec || rec.kind !== 'build') return [];
  return contractCrit(rec).filter(c => c.k === 'tasKmh' || c.k === 'enduranceMin' || c.k === 'rangeKm');
}

// ---- ACCEPT AS THE HOOK (G2270's acceptVerdict -> G2246's hooks.acceptVerdict) -------------------------------------
// verdictOf(crit[]) -> acceptVerdict's { rows, ok, needsFlight, needsTest } over the build that flew (the page:
// ACCEPT_REC.verdict). Every criterion met -> { ok: true, got: {k: measured} } (the margins feed the bonus);
// any criterion failed -> { ok: false, why }; otherwise pending (a flight or a test still to do) -> { ok: null, why }.
function careerAcceptHook(verdictOf) {
  return function (rec, sub, stop) {
    if (typeof verdictOf !== 'function') return { ok: null, why: 'no acceptance evidence on this page' };
    const crit = (sub && sub.crit) || [];
    if (!crit.length) return { ok: true, got: {} };
    let v;
    try { v = verdictOf(crit, stop); } catch (e) { return { ok: null, why: 'the verdict failed: ' + (e && e.message) }; }
    if (!v || !Array.isArray(v.rows)) return { ok: null, why: 'no verdict' };
    const got = {};
    for (const r of v.rows) if (r.ok && typeof r.value === 'number') got[r.k] = r.value;
    if (v.ok) return { ok: true, got };
    const bad = v.rows.filter(r => r.status === 'fail');
    if (bad.length) return { ok: false, why: bad.map(r => r.k + ' ' + (r.value != null ? r.value : '?') + ' (needs ' + (r.need || (r.op + ' ' + r.v)) + ')').join('; ') };
    const todo = v.rows.filter(r => r.status === 'needs-flight' || r.status === 'needs-test');
    return { ok: null, why: todo.map(r => r.k + ': ' + (r.status === 'needs-flight' ? 'needs a flight' : 'needs a test') + (r.source ? ' (' + r.source + ')' : '')).join('; ') };
  };
}

// ---- THE EVENTS AS WORDS (the arrival card) ----------------------------------------------------------------------
// events (careerOnStop's) -> [{ k, ok, text }]: a load taken on, a sub done, a stage done, the contract done and
// paid (a medal, a building unlocked, the follow-up offered), pending; then the wallet line.
function careerEventLines(res, before, after) {
  const out = [], T = contractText;
  const title = id => { const r = careerContract(after || before, id) || careerContract(before, id); return r ? T(r.title, contractVars(r)) : id; };
  const nm = id => (CONTRACT_FIELDS[id] ? CONTRACT_FIELDS[id].name : id);
  const ev = (res && res.events) || [];
  // one line for what moved: a sub inside its finished stage says nothing more, a finished stage inside its finished
  // contract neither
  const has = (k, id, stage) => ev.some(x => x.k === k && x.id === id && (stage == null || x.stage === stage));
  for (const e of ev) {
    if ((e.k === 'sub' && has('stage', e.id, e.stage)) || (e.k === 'stage' && has('done', e.id))) continue;
    if (e.k === 'picked') out.push({ k: e.k, ok: true, text: T('ev.picked', { t: title(e.id), at: nm(e.at) }) });
    else if (e.k === 'sub') out.push({ k: e.k, ok: true, text: T('ev.sub', { t: title(e.id), n: e.stage + 1 }) });
    else if (e.k === 'stage') out.push({ k: e.k, ok: true, text: T('ev.stage', { t: title(e.id), n: e.stage + 1 }) });
    else if (e.k === 'done') {
      out.push({ k: e.k, ok: true, text: T('ev.done', { t: title(e.id), n: cwMoney(e.pay) }) + (e.medal ? ' · ' + T('medal.' + e.medal) : '') });
      if (e.unlock) {
        const m = /^(\w+):(\d+)$/.exec(e.unlock), tr = m && CONTRACT_TRACKS[m[1]];
        out.push({ k: 'unlock', ok: true, text: T('ev.unlock', { n: tr ? T(tr.stages[+m[2] - 1]) : e.unlock }) });
      }
      if (e.followUp) out.push({ k: 'follow', ok: true, text: T('ev.follow', { t: title(e.followUp) }) });
    } else if (e.k === 'pending') out.push({ k: e.k, ok: null, text: T('ev.pending', { t: title(e.id), n: e.why || '' }) });
  }
  if (!out.length && res && res.untouched) {
    const C = before && before.career && before.career.contracts;
    const id = (C && C.tracked) || Object.keys(res.untouched)[0];
    if (id && res.untouched[id]) out.push({ k: 'none', ok: false, text: T('ev.none', { t: title(id), n: res.untouched[id] }) });
  }
  if (after && before && typeof after.wallet === 'number') {
    const d = after.wallet - (before.wallet || 0);
    out.push({ k: 'wallet', ok: d > 0 ? true : null, text: T('ev.wallet', { n: cwMoney(after.wallet) }) + (d ? ' (' + (d > 0 ? '+' : '−') + cwMoney(Math.abs(d)) + ')' : '') });
  }
  return out;
}
const cwMoney = n => String(Math.round(n || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
// ===========================================================================
// THE ECONOMY (G2260 ECONOMY, P5a) — ONE PRICE BOOK, THE CAREER WALLET'S
// RULES, THE CALIBRATION AS DATA, AND THE REFERENCE CAREER THAT HOLDS IT.
// futureDesigns/GAME-2026-10-06.md §R (binding: G-COST no running costs,
// contracts pay net, hangars bought never rented, a pilot's one-time sign-on
// fee, GQ5 bring-it-home free, GQ6 no bankruptcy + the Trust's loan job below
// -20 000, GQ23 the 60 000 grant + a Cub voucher), §12, §15 row 8;
// DEFORM-AND-BREAK §10 + dm9-dm12 (the repair bill); §R.4 of 10 Oct (G2705
// CAREER-DAMAGE: REPAIR IS FREE everywhere - the bill is read, never charged).
// ===========================================================================
// CREDITS ARE NOT DOLLARS. Every price here is a RATIO to the one number the
// game already prices honestly: the ledger's airframe (genFrame's bill of
// materials, genShakedown `cost`). The reference is the stock Cub's ledger
// (CONTRACT_DESIGNS.cub.cost, re-derived from its build file by GATE
// CONTRACTS each run): a field shed, a kit, a sign-on fee, a maker's margin
// are so many Cubs, and move with it.
//
// WHAT COSTS MONEY (G-COST): airframes (materialised from the drawing board,
// or a maker's catalogue), hangars (bought), kits and upgrades, a pilot's
// sign-on fee. NOTHING ELSE: no repair (§R.4, G2705: free), no fuel, no
// maintenance reserve, no wage, no rent, no landing fee, no recovery (GQ5).
// A career's ledger holds grant / contract / loan lines (income) and purchase
// lines (spending; the book keeps its `repair` kind, which nothing writes
// since G2705); `econLedgerClass` names each line's class, and a line of any
// other class is a running cost (GATE ECON refuses one).
//
// THE WALLET'S RULE (GQ6): a PURCHASE needs the cash (refused, the same
// document handed back, with why). A repair is free (G2705), so nothing takes
// the wallet below 0 by itself any more. Below ECON_BOOK.loanBelow
// (-20 000) the Field Trust offers its LOAN JOB: a CONTRACT-MODEL record,
// kind 'job', provider 'field', that any airframe can fly, paying the wallet
// back to ECON_BOOK.loanTo.
//
// THE SANDBOX RECORDS, NEVER CHARGES (71_ playerCharge): every rule below in
// a sandbox document writes its "would cost" line `free: true` and leaves the
// wallet alone; the page's sandbox calls none of them (byte for byte today's).
//
// Pure: no DOM, storage, THREE, clock or random (GATE ECON scans for each).
// ===========================================================================
const ECON_V = 1;

// ---- THE PRICE BOOK ---------------------------------------------------------------------------------------------
//   ref          the reference airframe: CONTRACT_DESIGNS[ref].cost (the ledger's stock Cub, ~31 200)
//   shells       a hangar shell bought on a plot: x the reference, x the plot's price factor (BASE_OFFERS pf).
//                A field shed (one aeroplane, honestly) is ~1.5 Cubs, a club ~3, the works ~5 - property costs
//                more than the aeroplane it shelters, and is never rented (G-COST)
//   kits         a kit fitted (nothing refunds a kit): x the reference. The workshop kits are what buys the
//                labour factor (PREM_RATES.labourFit 0.8 against 1.0) - the metal shop pays for itself within
//                its first C172-class airframe, the woodshop within its first few wooden ones
//   makerMargin  a maker's catalogue price = the scratch price (the ledger in a fully fitted works: x labourFit)
//                x this margin - PROCURE's catalogue; what you pay a maker for not building it yourself
//   signOn       a pilot's ONE-TIME sign-on fee by tier (G-COST: no wage), x the reference - PILOTS' roster
//   round        every price rounds to this
//   loanBelow    GQ6: the Trust's loan job is offered while the wallet is BELOW this
//   loanTo       ...and pays the wallet back up to this (rounded up to `loanRound`)
const ECON_BOOK = {
  ref: 'cub',
  shells: { field: 1.8, club: 3.2, works: 5.4 },
  kits: { park: 0, bench: 0.05, wood: 0.16, metal: 0.24, store: 0.02, handling: 0.05,
          office: 0.1, comfort: 0.06, curio: 0, wip: 0 },
  makerMargin: 1.35,
  signOn: { rookie: 0.08, pilot: 0.16, ace: 0.32 },
  round: 100,
  loanBelow: -20000,
  loanTo: 0,
  loanRound: 1000,
};
const econRound = v => Math.round((+v || 0) / ECON_BOOK.round) * ECON_BOOK.round;
// the reference airframe's ledger price (the unit every ratio is in)
function econRefPrice() {
  const D = (typeof CONTRACT_DESIGNS !== 'undefined') && CONTRACT_DESIGNS[ECON_BOOK.ref];
  return D ? D.cost : 31203;
}
// a hangar shell's price before the plot's factor (71_ shellPrice reads this: the club is the starter at HOME,
// and a club bought elsewhere is priced like any other shell)
function econShellPrice(shell) {
  const r = ECON_BOOK.shells[shell];
  return typeof r === 'number' ? econRound(r * econRefPrice()) : NaN;
}
// what a kit costs to fit (71_ playerUpgradeCost reads KIT_PRICES): the book's ratios, as credits
const KIT_PRICES = (() => {
  const o = {};
  for (const k of Object.keys(ECON_BOOK.kits)) o[k] = econRound(ECON_BOOK.kits[k] * econRefPrice());
  return o;
})();

// ---- AIRFRAMES -------------------------------------------------------------------------------------------------
// the ledger's total: genFrame's bill per section (def.parts.ledger: { <section>: { mass, cost } }) - what
// genShakedown reports as `cost`
function econLedgerCost(ledger) {
  let c = 0;
  for (const k of Object.keys(ledger || {})) { const e = ledger[k]; if (e && isFinite(+e.cost)) c += +e.cost; }
  return Math.round(c);
}
// THE AIRFRAME PRICE: a design materialised from the drawing board in the main hangar = the ledger x the main
// hangar's labour factor for what the design wants (hangarWants: wood, tube, metal, composite) - a fully fitted
// works builds at 0.8, a shed short of the verb at 1.0
function econAirframePrice(cost, shed, wants) {
  const L = typeof playerLabourFactor === 'function' ? playerLabourFactor(shed || null, wants || []) : 1;
  return econRound((+cost || 0) * L);
}
// THE MAKERS' CATALOGUE PRICE (PROCURE): the scratch price (the ledger in a fully fitted works) x the margin
function econCatalogPrice(cost, margin) {
  const m = typeof margin === 'number' && margin > 0 ? margin : ECON_BOOK.makerMargin;
  return econRound((+cost || 0) * PREM_RATES.labourFit * m);
}
// A PILOT'S SIGN-ON FEE (PILOTS): one time, by tier ('rookie' | 'pilot' | 'ace'); unknown tiers cost a pilot's
function econSignOn(tier) {
  const r = ECON_BOOK.signOn[tier];
  return econRound((typeof r === 'number' ? r : ECON_BOOK.signOn.pilot) * econRefPrice());
}
// THE REPAIR (dm9; G2705 CAREER-DAMAGE, the user's ruling of 10 Oct, §R.4): REPAIR IS FREE everywhere. DMG-D5's
// bill [{ section | event, line, cost }] stays on the damage record (what broke, in its lines) and costs nothing,
// wherever the aeroplane stands; the punishment for a crash is the reset to where the flight departed from
// (75_ careerCrashReset), never a bill. (bill, labour) -> 0, the signature kept for its callers.
function econRepairCost(bill, labour) {
  return 0;
}

// ---- THE LEDGER'S CLASSES (G-COST: no running cost anywhere) ---------------------------------------------------
// Every ledger kind the game writes, by class. income: grant, contract, loan. purchase: an airframe, a hangar
// (acquire), its upgrades / kits (upgrade), a sign-on fee. repair: a bill paid. free: a "bring it home" (GQ5:
// always 0) and a hangar released (a refund). Anything else is a running cost.
const ECON_LEDGER = {
  grant: 'grant', contract: 'contract', loan: 'loan',
  airframe: 'purchase', acquire: 'purchase', upgrade: 'purchase', signon: 'purchase', catalogue: 'purchase',
  repair: 'repair',
  recover: 'free', release: 'free',
};
const econLedgerClass = k => ECON_LEDGER[k] || null;

// ---- THE WALLET'S DOORS (pure; { ok, doc, why, cost }; a refusal hands back the very document) -----------------
const ecClone = o => JSON.parse(JSON.stringify(o));
const ecNo = (doc, why) => ({ ok: false, doc, why });
// can the wallet take this purchase? (the sandbox always can: it records)
const econAfford = (doc, cost) => !doc || doc.mode !== 'career' || doc.wallet >= cost;
// A PURCHASE: needs the cash in a career (GQ6); the sandbox records it free. k: a purchase kind of ECON_LEDGER.
function econBuy(doc, cost, k, ref) {
  cost = Math.max(0, Math.round(+cost || 0));
  if (econLedgerClass(k) !== 'purchase') return ecNo(doc, k + ' is not a purchase');
  if (!econAfford(doc, cost)) return ecNo(doc, 'the wallet holds ' + Math.round(doc.wallet) + ', this costs ' + cost);
  const d = ecClone(doc);
  playerLedger(d, k, cost, ref);
  return { ok: true, doc: d, cost, why: '' };
}
// MATERIALISING A DESIGN (the first Save of a new airframe): the airframe price, from the ledger and the main
// hangar; the career's airframe row remembers what it cost (`paid`) and how it was made (PROCURE: 'catalogue')
function econMaterialise(doc, slot, cost, wants, opts) {
  opts = opts || {};
  const main = doc && doc.sheds && doc.sheds[PREM_MAIN];
  const price = opts.price != null ? Math.round(opts.price) : econAirframePrice(cost, main, wants);
  const r = econBuy(doc, price, opts.k || 'airframe', slot);
  if (!r.ok) return r;
  const C = r.doc.career;
  if (C && C.airframes && typeof C.airframes === 'object')
    C.airframes[slot] = Object.assign({}, C.airframes[slot] || {}, { paid: price, how: opts.how || 'scratch', at: Math.round(r.doc.clock || 0) });
  return { ok: true, doc: r.doc, cost: price, why: '' };
}
// a hangar bought (71_ playerAcquire: needs the cash) / changed (playerUpgrade: shell, size, kits)
const econAcquire = (doc, aero, plot, shell) => playerAcquire(doc, aero, plot, shell, 'own');
const econUpgrade = (doc, hangarId, change, opts) => playerUpgrade(doc, hangarId, change, opts);
// the airframes in the fleet that could fly now (a damaged one is grounded until repaired: dm10)
const econFlyable = doc => Object.keys((doc && doc.fleet) || {}).filter(n => !(doc.fleet[n] && doc.fleet[n].damage && doc.fleet[n].damage.damaged));
// THE REPAIR (dm9, dm10; G2705: FREE): an explicit Repair, in both modes, wherever it stands - nothing in the
// wallet, no ledger line (the sandbox records no "would cost" either: there is no cost). A write-off has no
// Repair (dm10). The fleet row's `damage` (D5's record) is cleared; the wear resets (G2230). (opts: unused, kept)
function econRepair(doc, slot, opts) {
  const e = doc && doc.fleet && doc.fleet[slot];
  if (!e) return ecNo(doc, slot + ' is not in the fleet');
  const D = e.damage;
  if (!D || !D.damaged) return ecNo(doc, slot + ' is not damaged');
  if (D.writeOff) return ecNo(doc, slot + ' is a write-off: scrap it or sell it as salvage');
  let d = ecClone(doc);
  delete d.fleet[slot].damage;
  if (typeof playerWearReset === 'function') d = playerWearReset(d, slot).doc;
  return { ok: true, doc: d, cost: econRepairCost(D.bill), why: '' };
}

// ---- THE TRUST'S LOAN JOB (GQ6) ----------------------------------------------------------------------------------
// Offered while the wallet is below ECON_BOOK.loanBelow (74_ careerOfferIds asks econLoanOffer). A job record
// (CONTRACT-MODEL's shape, kind 'job', provider 'field'): a short errand from HOME to Tamgas Hill that every
// validated design on wheels can fly, paying the wallet back up to loanTo. Its id carries the loans taken
// (`loan:field:<n>`), so a second loan is a new job; its pay is fixed when it is offered (careerAccept snapshots a
// job as offered), and completed it writes a `loan` ledger line (74_ careerComplete reads rec.loan).
const ECON_TEXT = {
  'job.field.loan.title': { t: 'The Trust stands by you', draft: true },
  'job.field.loan.brief': { t: 'The Field Trust has an errand to {to}, and an advance against it. Fly it and start again.', draft: true },
};
if (typeof CONTRACT_TEXT !== 'undefined') for (const k of Object.keys(ECON_TEXT)) if (!CONTRACT_TEXT[k]) CONTRACT_TEXT[k] = ECON_TEXT[k];
const econLoans = doc => ((doc && doc.ledger) || []).filter(l => l && l.k === 'loan').length;
function econLoanOffer(doc) {
  if (!doc || doc.mode !== 'career' || !(doc.wallet < ECON_BOOK.loanBelow)) return null;
  return 'loan:field:' + (econLoans(doc) + 1);
}
function econLoanPay(wallet) {
  const R = ECON_BOOK.loanRound;
  return Math.max(R, Math.ceil((ECON_BOOK.loanTo - (+wallet || 0)) / R) * R);
}
function econLoanJob(doc, id) {
  if (!/^loan:field:\d+$/.test(id || '')) return null;
  const rec = contractNormalise({
    id, provider: 'field', kind: 'job', title: 'job.field.loan.title', brief: 'job.field.loan.brief', loan: true,
    stages: [{ subs: [{ do: 'carry', from: 'HOME', to: 'w3', load: { kg: 10, pax: 0 } }] }],
    pay: { base: 0 }, rep: { provider: 'field', gain: 0 }, repeat: false,
  });
  rec.pay = Object.assign(contractPay(rec), { total: econLoanPay(doc ? doc.wallet : 0) });
  return rec;
}

// ---- THE CALIBRATION (stated as data, held by GATE ECON) ---------------------------------------------------------
// With CONTRACT-MODEL's pay (CONTRACT_PAY: ECONOMY's since G2260), a career that flies the matched validated
// design reaches, in CONTRACTS COMPLETED (not hours: there are no running costs):
// (G2430 CONTRACT-ROUTES, RE-DERIVED) most jobs are now chains of two legs (73_ contractJob's shapes), so a contract
// is ~1.7 legs where it was ~1.35, and pays per leg (+ a 10 % chain bonus). Measured on the reference careers below,
// THE PACE IN LEGS FLOWN DID NOT MOVE (the first hangar at 12 legs, the C172 at 27-31 before / 30-31 after, the
// arc at 28-32 / 31-32, the second hangar at 35-38 / 36-38); only the unit did. The brief's bands (G2260: 6-10,
// 15-25, 25-35, 20-40) are scaled by the measured contracts-per-leg ratio, 0.78 (the reference's 21-22 / 26-28 / 22-23
// contracts at the airframe / hangar2 / arc before, 17-18 / 21-22 / 18-19 after); the first hangar is unchanged (it
// is bought inside the arc-only opening, 8 contracts both ways).
const ECON_BANDS = {
  hangar1:  [6, 10],     // the first side hangar
  airframe: [12, 20],    // a C172-class airframe (CONTRACT_DESIGNS.c172, materialised in the main hangar)   (G2260: 15-25)
  hangar2:  [20, 27],    // the second side hangar                                                         (G2260: 25-35)
  arc:      [16, 31],    // a full arc: the first provider whose whole arc is complete (its track at its last stage) (G2260: 20-40)
};
// THE REFERENCE CAREER the bands are measured on (econReference). Stated, so the numbers mean something:
//   start   careerNew (GQ23: the 60 000 grant, the voucher Cub - the fleet's first airframe, free)
//   float   the grant is the career's FLOAT - its first airframe of its own, a build contract's airframe (a
//           repair was one; free since G2705) - and the milestones are bought from what contracts pay: a purchase is made the moment the
//           wallet would keep the float after it. (A player may spend the grant on a hangar on day one - the
//           wallet allows it; the bands measure the pace of the work, not the grant.)
//   fly     each completed contract is ONE contract: the next arc contract the fleet can physically fly (the
//           providers in order: the story is what a player follows), else the best-paying job the fleet can fly
//           (ties by id); flown by the design that can do it (contractDoers within the fleet). Build contracts
//           are left out (their airframe is the player's own design: their pay is held against it separately)
//   buy     in order: a field shed at Tamgas Hill (w3), the C172-class airframe (scratch in the main hangar),
//           a field shed at Skyline (tw_ski)
//   seeds   the bands hold on every one of these career seeds
const ECON_REF = {
  seeds: ['jolene', 'dev', 'econ-a', 'econ-b', 'econ-c', 'econ-d', 'econ-e', 'econ-f'],
  max: 60,
  wish: [
    { m: 'hangar1', k: 'acquire', aero: 'w3', plot: 'w3', shell: 'field' },
    { m: 'airframe', k: 'airframe', design: 'c172' },
    { m: 'hangar2', k: 'acquire', aero: 'tw_ski', plot: 'tw_ski', shell: 'field' },
  ],
  // what each validated design wants of a hangar (hangarWants on its build file; GATE ECON re-derives it)
  wants: { cub: ['tube'], jodel: ['wood'], c172: ['metal'], c172f: ['metal'], twinf: ['tube'] },
  hour: 12,
};

// the stops that fly one sub (the journey's synthesis: GATE CONTRACTS' own)
function ecStopsFor(sub, hour) {
  const stop = (aero, o) => Object.assign({ how: 'stopped', aero, load: { kg: 0, pax: 0 }, row: { from: null, to: aero, t: 600 }, hour }, o || {});
  const ld = () => ecClone(sub.load || { kg: 0, pax: 0 });
  if (sub.do === 'carry') return [stop(sub.from, { load: ld(), row: { from: 'HOME', to: sub.from, t: 600 } }), stop(sub.to, { load: ld(), row: { from: sub.from, to: sub.to, t: 600 } })];
  if (sub.do === 'land') return [stop(sub.to, { row: { from: 'HOME', to: sub.to, t: 600 } })];
  if (sub.do === 'fly') return [stop(sub.to, { row: { from: sub.from, to: sub.to, t: sub.medals ? Math.min(...sub.medals.map(m => m.le)) - 1 : 600 } })];
  if (sub.do === 'survey') return [stop(sub.from, { row: { from: sub.from, to: sub.from, t: 600 }, overflew: [sub.at] })];
  return [stop(sub.to, { row: { from: 'HOME', to: sub.to, t: 600 } })];
}
const ecFlying = rec => contractSubsOf(rec).filter(s => s.do !== 'deliver' && s.do !== 'accept');
function ecCanFly(rec, fleet) {
  if (!rec || rec.kind === 'build') return null;
  const DS = {};
  for (const k of fleet) if (CONTRACT_DESIGNS[k]) DS[k] = CONTRACT_DESIGNS[k];
  for (const st of rec.stages) { if (!contractDoers(st.subs.filter(s => s.do !== 'deliver' && s.do !== 'accept'), null, DS).length) return null; }
  return contractDoers(ecFlying(rec), null, DS)[0] || Object.keys(DS)[0];
}
// THE POLICY: the next arc contract the fleet can fly (providers in order), else the best-paying job
function econRefPick(doc, fleet) {
  const ids = careerOfferIds(doc), A = contractAuthored();
  for (const p of Object.keys(CONTRACT_PROVIDERS)) {
    const id = ids.find(x => A[x] && CONTRACT_PROVIDERS[p].arc.some(r => r.id === x));
    if (id && ecCanFly(A[id], fleet)) return id;
  }
  let best = null, bp = -1;
  for (const id of ids.slice().sort()) {
    const r = careerContract(doc, id);
    if (!r || r.kind !== 'job' || !ecCanFly(r, fleet)) continue;
    const p = contractPay(r).total;
    if (p > bp) { best = id; bp = p; }
  }
  return best;
}
// fly one contract to its completion (synthesised stops; ACCEPT's hook approving) -> the document. (G2665 NIGHT-OPS) A
// leg with a time-of-day window is flown at its window's middle - the reference WAITS IT OUT, as a player does - on the
// night the job was drawn for (its stamped dusk / dawn) or the constants
function econRefFly(doc, id, hour) {
  let d = careerAccept(doc, id).doc;
  const rec = careerContract(d, id), hooks = { acceptVerdict: () => ({ ok: true, got: {} }) };
  const NT = rec.night || null, alm = NT ? { duskH: NT.duskH, dawnH: NT.dawnH } : {};
  const at = sub => (sub.when && typeof contractWhenMid === 'function' ? contractWhenMid(sub.when, alm.duskH, alm.dawnH) : hour);
  for (const st of rec.stages) for (const sub of st.subs) for (const s of ecStopsFor(sub, at(sub)).map(x => Object.assign(x, sub.when ? alm : {}))) {
    const q = contractOnStop(d, id, s, hooks);
    if (q.ok) d = q.doc;
  }
  return d;
}
// THE REFERENCE CAREER -> { at: { hangar1, airframe, hangar2, arc } (the completed count at each), arcBy, pays,
// spent, doc }. Deterministic: f(seed) and the tables.
function econReference(seed, opts) {
  opts = opts || {};
  const R = Object.assign({}, ECON_REF, opts.ref || {});
  let d = careerNew({ id: 'ref', seed });
  const fleet = ['cub'];
  const float = CAREER_GRANT, at = {}, pays = [];
  let wi = 0, spent = 0, arcBy = null;
  const priceOf = w => w.k === 'acquire' ? plotPrice(w.aero, w.plot, w.shell)
    : econAirframePrice(CONTRACT_DESIGNS[w.design].cost, d.sheds[PREM_MAIN], R.wants[w.design]);
  for (let n = 0; n < R.max; n++) {
    const id = econRefPick(d, fleet);
    if (!id) break;
    const before = d.career.contracts.done.length;
    d = econRefFly(d, id, R.hour);
    const done = d.career.contracts.done;
    if (done.length !== before + 1) break;                      // a contract the synthesis could not complete
    pays.push(done[done.length - 1].pay);
    if (at.arc == null) {
      for (const p of Object.keys(CONTRACT_PROVIDERS)) {
        const arc = CONTRACT_PROVIDERS[p].arc.filter(r => contractCertifiable(contractAuthored()[r.id]));
        if (arc.length && arc.every(r => done.some(x => x.id === r.id))) { at.arc = done.length; arcBy = p; break; }
      }
    }
    while (wi < R.wish.length) {
      const w = R.wish[wi], price = priceOf(w);
      if (d.wallet - price < float) break;
      const r = w.k === 'acquire' ? econAcquire(d, w.aero, w.plot, w.shell)
        : econBuy(d, price, 'airframe', w.design);
      if (!r.ok) break;
      d = r.doc; spent += price; at[w.m] = done.length;
      if (w.k === 'airframe') fleet.push(w.design);
      wi++;
    }
  }
  return { at, arcBy, pays, spent, fleet, doc: d };
}
// every band, on every reference seed -> [{ seed, at, arcBy, ok, why }]
function econCalibration(opts) {
  return ((opts && opts.seeds) || ECON_REF.seeds).map(seed => {
    const r = econReference(seed, opts);
    const why = Object.keys(ECON_BANDS).filter(k => !(r.at[k] >= ECON_BANDS[k][0] && r.at[k] <= ECON_BANDS[k][1]))
      .map(k => k + ' at ' + (r.at[k] == null ? 'never' : r.at[k]) + ', the band ' + ECON_BANDS[k].join('-'));
    return { seed, at: r.at, arcBy: r.arcBy, ok: !why.length, why, wallet: r.doc.wallet, pays: r.pays };
  });
}
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
const PRT_ = t => ({ t, draft: true });
const PROCURE_TEXT = {
  // the makers (GQ20: fictional organisations; no real brand: the gate holds every word against CONTRACT_CONFIG_WORDS)
  'mk.bramble.name':   PRT_('Bramble Light Aircraft'),
  'mk.bramble.line':   PRT_('Fabric over steel tube, built for short fields and long days. Two seats, one behind the other.'),
  'mk.vernier.name':   PRT_('Ateliers Vernier'),
  'mk.vernier.line':   PRT_('A wood shop that builds aeroplanes: light, quick and kind to its pilot.'),
  'mk.northline.name': PRT_('Northline Aero'),
  'mk.northline.line': PRT_('Metal four-seaters for real work, on wheels or on water.'),
  'mk.driftwood.name': PRT_('Driftwood Ultralights'),
  'mk.driftwood.line': PRT_('Two small engines, one seat and a pair of floats: the bay is the runway.'),
  // the models
  'mdl.scout.name':    PRT_('Bramble Scout'),
  'mdl.scout.line':    PRT_('The two-seat bush hauler: slow, forgiving, at home on gravel.'),
  'mdl.pinson.name':   PRT_('Vernier Pinson'),
  'mdl.pinson.line':   PRT_('Two seats side by side in a wooden fuselage; quicker than it looks.'),
  'mdl.meridian.name': PRT_('Northline Meridian'),
  'mdl.meridian.line': PRT_('Four seats and a baggage bay; wheels for the strips, floats for the dock.'),
  'mdl.tern.name':     PRT_('Driftwood Tern'),
  'mdl.tern.line':     PRT_('A single seat between two engines, on floats: fish-spotting and survey work.'),
  // the option rows
  'opt.engine': PRT_('engine'), 'opt.tank': PRT_('fuel tank'), 'opt.seats': PRT_('seats'), 'opt.gear': PRT_('gear'),
  'opt.avionics': PRT_('panel and radios'), 'opt.finish': PRT_('finish'), 'opt.reg': PRT_('registration'),
  'opt.engine.v': PRT_('{n} kW ({k} hp), {c}'),
  'opt.tank.std': PRT_('standard tank'), 'opt.tank.long': PRT_('long-range: wing-root tanks (+50 %)'),
  'opt.seats.n': PRT_('{n} seats'), 'opt.seats.3': PRT_('3 seats (one rear seat out, more room for bags)'),
  'opt.gear.wheels': PRT_('wheels'), 'opt.gear.tundra': PRT_('tundra tyres'), 'opt.gear.floats': PRT_('floats'),
  'opt.avionics.minimal': PRT_('minimal: day VFR, no radio'), 'opt.avionics.basic': PRT_('basic VFR, a radio'),
  'opt.avionics.ifr': PRT_('IFR panel and radios'), 'opt.avionics.custom': PRT_('the factory\'s working panel'),
  'opt.finish.factory': PRT_('factory colours'), 'opt.finish.red': PRT_('signal red'), 'opt.finish.blue': PRT_('harbour blue'),
  'opt.finish.green': PRT_('forest green'), 'opt.finish.white': PRT_('plain white'),
  'opt.cool.air': PRT_('air-cooled'), 'opt.cool.liquid': PRT_('liquid-cooled'),
  // the used market
  'used.title': PRT_('{m}, {h} hours'),
  'used.hours': PRT_('{h} hours on the engine since its last overhaul'),
  'used.repair.none': PRT_('no damage history'),
  'used.repair.gear': PRT_('the gear was replaced after a hard landing'),
  'used.repair.prop': PRT_('a new propeller after a prop strike'),
  'used.repair.wing': PRT_('a wing tip rebuilt after a hangar rash'),
  'used.repair.skin': PRT_('a skin panel patched after hail'),
  'used.older': PRT_('an older panel than the factory\'s'),
  'used.kg': PRT_('{k} kg of extra equipment fitted over the years'),
  'used.seller.0': PRT_('"She never let me down. I just don\'t fly enough any more."'),
  'used.seller.1': PRT_('"Selling for a bigger one. Logbooks all there."'),
  'used.seller.2': PRT_('"It sat a winter outside, but it starts on the second blade."'),
  'used.seller.3': PRT_('"My late uncle\'s. Make me a fair offer and fly it away."'),
  'used.seller.4': PRT_('"A club aeroplane, flown hard, looked after."'),
  'used.seller.5': PRT_('"Bought it for a job that never came. Hardly used."'),
  'used.where': PRT_('stands at {a}'),
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
// ===========================================================================
// FREIGHT (G2340-G2344 FREIGHT-MODEL) — WEIGHT AND VOLUME, FITTED INSIDE THE AIRFRAME.
// futureDesigns/game/FREIGHT-2026-10-07.md §1, §2, §4 (RULED by the user, 7 Oct).
// ===========================================================================
// A LOAD IS ITEMS: { id, kind: crate|box|bag|drum|long|bulk|stretcher, kg, dims: [L, W, H] m, rigid, stack }.
// A contract's goods carry their dims (FREIGHT_GOODS), so "120 kg of crated parts" is two crates; a BULK load is
// split into bags (ruled). An item goes aboard only through a DOOR, in some orientation, and then packs into the
// HOLD beside the others and the occupants.
//
// THE AIRFRAME'S SIDE IS MEASURED, NOT RULED HERE. A FREIGHT CARD (FREIGHT_CARDS, below) is what
// tools/_freight_site.js reads off the airframe's own mesh with the fuel path's machinery: the hold is
// _bay_site.js's inset sections (GEN_BAY_WALL off along the edge normals) swept from the front row's seat pan to
// GEN_BAYS.aftCabin's end, the doors are _cage_gen.js cageDoorEdges' outlines, the seats the join's measured
// stations, the mass and the CERTIFIED CG RANGE the plaque's (designGross, the four corners). GATE FREIGHT
// re-measures every validated build's card from its build file each run and holds this table to it.
//
// THE RULES ARE HERE, AND THEY ARE STATED:
//   the door      an item passes a door if, held at some axis and roll, its slice in the door's plane fits one of
//                 the door's clear rectangles AND, once wholly inside, it fits the hold's section at the door
//                 (the swing-in: a long item goes in at a slant and is laid down inside; straight in is the case
//                 of an axis square to the door). The fuel tank never needed this; freight is all about it.
//   the hold      a placed item is a box that stands inside the inset section at every station it spans, on the
//                 highest floor under it, clear of the seats (an empty seat is geometry the packer works around,
//                 unless the player takes it out: ruled), the occupants and the other items.
//   the limits    FREIGHT_FLOOR kg/m2 under each item (and what is stacked on it), the baggage placard on the
//                 baggage bay, the MTOW and the CERTIFIED CG RANGE. The packer keeps to them when it can and SAYS
//                 when it cannot: a placement out of range is REPORTED, NEVER FORBIDDEN (the spine: the aeroplane
//                 flies what you loaded, and you find out).
//   the packer    first fit, biggest and heaviest first, low, then near the CG the range wants, then the middle.
//                 Deterministic: no clock, no random, a fixed candidate order; a tie goes to the first candidate.
//
// Pure: no DOM, storage, clock or random (GATE FREIGHT scans for each). Reads CONTRACT_DESIGNS / CONTRACT_FIT
// (72_), contractGearOk (73_) where the map's mark asks.
// ===========================================================================

const FREIGHT_V = 1;

// ---- THE ITEMS -----------------------------------------------------------------------------------------------
// what each kind is: rigid (a box keeps its shape), stack (things may go on top), upright (its H stays vertical:
// a full drum is not laid down), flat (its H stays vertical once placed: a stretcher with a patient), split (never
// placed itself: split into bags, the ruling), squeeze (a soft item gives: its dims times this through a door)
const FREIGHT_KINDS = {
  crate:     { rigid: true,  stack: true },
  box:       { rigid: true,  stack: true },
  bag:       { rigid: false, stack: true, squeeze: 0.85 },
  drum:      { rigid: true,  stack: false, upright: true },
  long:      { rigid: true,  stack: true },
  bulk:      { rigid: false, stack: true, split: true, squeeze: 0.85 },
  stretcher: { rigid: true,  stack: false, flat: true },
};
// THE BAG a bulk load is split into: a 25 kg sack (what one person carries from the strip)
const FREIGHT_BAG = { kg: 25, dims: [0.60, 0.40, 0.15] };
// THE GOODS GAIN DIMS (CONTRACT-MODEL's goods words -> what one unit is). `unit` is the most one item weighs; a
// load is split into ceil(kg / unit) items of equal mass. The parts row is the study's own example (120 kg of
// crated parts = 2 crates 0.8 x 0.6 x 0.5 m). The canoe is a FOLDING canoe in its two packs: a rigid canoe is an
// external load (BELLY-POD, later). Supplies are the bulk row: flour, sugar and feed, split into sacks.
const FREIGHT_GOODS = {
  'goods.mail':     { kind: 'bag',   unit: 20, dims: [0.65, 0.40, 0.30] },
  'goods.tools':    { kind: 'box',   unit: 25, dims: [0.60, 0.35, 0.30] },
  'goods.parts':    { kind: 'crate', unit: 60, dims: [0.80, 0.60, 0.50] },
  'goods.samples':  { kind: 'box',   unit: 20, dims: [0.40, 0.30, 0.25] },
  'goods.rods':     { kind: 'long',  unit: 30, dims: [1.50, 0.20, 0.20] },
  'goods.supplies': { kind: 'bulk',  unit: 90, dims: [0.60, 0.40, 0.45] },
  'goods.water':    { kind: 'box',   unit: 15, dims: [0.45, 0.30, 0.30] },
  'goods.gear':     { kind: 'bag',   unit: 15, dims: [0.80, 0.35, 0.30] },
  'goods.kit':      { kind: 'bag',   unit: 20, dims: [0.70, 0.35, 0.35] },
  'goods.canoe':    { kind: 'bag',   unit: 25, dims: [0.95, 0.40, 0.30] },
};
// a load with no goods word (an authored arc's "40 kg"): boxes
const FREIGHT_GENERIC = { kind: 'box', unit: 20, dims: [0.50, 0.40, 0.30] };
// THE MEDEVAC LOAD (§4b, listed, not built): a stretcher with the patient
const FREIGHT_STRETCHER = { id: 'stretcher', kind: 'stretcher', kg: 95, dims: [2.0, 0.6, 0.5] };

// ---- THE LIMITS (stated) ----------------------------------------------------------------------------------
//   floor     kg/m2 under an item (with what is stacked on it): the cabin's floorboards, the baggage bay's
//             lighter floor (the light-aircraft placards' order: ~100 lb/ft2 cabin, ~20 lb/ft2 baggage)
//   seat      an empty seat is its pan (`pan` deep, `panH` high) and its back (`backD` deep, `seatH` high); an
//             occupant is one envelope from the legs (`legs` ahead of the back) to `occH`, `occW` wider than the seat
const FREIGHT_FLOOR = { cabin: 300, baggage: 100 };
const FREIGHT_SEAT = { pan: 0.50, panH: 0.40, backD: 0.12, legs: 0.95, backT: 0.05, seatH: 1.00, occH: 1.30, occW: 0.06 };
const FREIGHT_PACK = { step: 0.05, zStep: 0.025, eps: 1e-6 };

const frR3 = v => Math.round(v * 1000) / 1000;
const frClone = o => JSON.parse(JSON.stringify(o));

// one item, normalised: kind known, kg >= 0, three positive dims, the kind's rigid / stack
function freightItem(it) {
  const K = FREIGHT_KINDS[it && it.kind] ? it.kind : 'box';
  const T = FREIGHT_KINDS[K];
  const d = (Array.isArray(it && it.dims) ? it.dims : []).slice(0, 3).map(v => Math.max(0.01, +v || 0.01));
  while (d.length < 3) d.push(0.3);
  return { id: String((it && it.id) || K), kind: K, kg: Math.max(0, frR3(+(it && it.kg) || 0)), dims: d.map(frR3),
           rigid: it && it.rigid != null ? !!it.rigid : T.rigid, stack: it && it.stack != null ? !!it.stack : T.stack };
}
// a load's kg split into n equal items (kg to 0.5, the rest on the last: the sum is the load exactly)
function frSplitKg(kg, unit) {
  const n = Math.max(1, Math.ceil(kg / Math.max(1e-9, unit) - 1e-9));
  const each = Math.floor(kg / n * 2) / 2, out = [];
  for (let k = 0; k < n; k++) out.push(k < n - 1 ? each : frR3(kg - each * (n - 1)));
  return out;
}
// BULK SPLITS INTO BAGS (ruled): a bulk item -> 25 kg sacks
function freightSplit(items) {
  const out = [];
  for (const raw of items || []) {
    const it = freightItem(raw);
    if (!FREIGHT_KINDS[it.kind].split) { out.push(it); continue; }
    frSplitKg(it.kg, FREIGHT_BAG.kg).forEach((kg, k) =>
      out.push(freightItem({ id: it.id + '.' + (k + 1), kind: 'bag', kg, dims: FREIGHT_BAG.dims })));
  }
  return out;
}
// A LOAD -> ITEMS: { kg, pax, bulk? } and the goods word (the job's `goods`) -> [item]. Deterministic: a load is
// always the same items. Passengers are seats, not items (they board, they don't fit).
function freightItems(load, goods) {
  const kg = Math.max(0, +(load && load.kg) || 0);
  if (!(kg > 0)) return [];
  const G = FREIGHT_GOODS[goods] || FREIGHT_GENERIC;
  const tag = (goods && FREIGHT_GOODS[goods] ? goods.replace(/^goods\./, '') : 'load');
  if (G.kind === 'bulk') return freightSplit([{ id: tag, kind: 'bulk', kg, dims: G.dims }]);
  return frSplitKg(kg, G.unit).map((m, k) => freightItem({ id: tag + '.' + (k + 1), kind: G.kind, kg: m, dims: G.dims }));
}
const freightKg = items => frR3((items || []).reduce((s, it) => s + (+it.kg || 0), 0));

// ---- THE HOLD ------------------------------------------------------------------------------------------------
const frHoldX1 = H => H.x0 + H.n * H.dx;
const frFloorAt = (H, i) => H.y0 + H.floor[i] / 100;
// the stations a box over [x0, x1] spans (the bracketing ones included: the conservative side)
function frStations(H, x0, x1) {
  const a = Math.floor((x0 - H.x0) / H.dx + 1e-9), b = Math.ceil((x1 - H.x0) / H.dx - 1e-9);
  if (a < 0 || b > H.n) return null;
  const out = [];
  for (let i = a; i <= b; i++) out.push(i);
  return out;
}
// the floor a box over [x0, x1] rests on: the highest floor under it
function freightRestY(card, x0, x1) {
  const H = card && card.hold, st = H && frStations(H, x0, x1);
  if (!st) return null;
  return Math.max(...st.map(i => frFloorAt(H, i)));
}
// the clear half-width a box over [x0, x1] x [y0, y1] may reach at every station it spans (m), or -1 when it cannot
// stand there at all (off the hold's ends, below a floor, above the roof)
function frZMax(card, x0, x1, y0, y1) {
  const H = card && card.hold;
  if (!H) return -1;
  const a = Math.floor((x0 - H.x0) / H.dx + 1e-9), b = Math.ceil((x1 - H.x0) / H.dx - 1e-9);
  if (a < 0 || b > H.n) return -1;
  const j0 = Math.floor((y0 - H.y0) / H.dy + 1e-6), j1 = Math.ceil((y1 - H.y0) / H.dy - 1e-6) - 1;
  if (j0 < 0 || j1 >= H.ny) return -1;
  let m = Infinity;
  for (let i = a; i <= b; i++) {
    if (y0 < H.y0 + H.floor[i] / 100 - 1e-6) return -1;
    const row = H.half[i];
    for (let j = j0; j <= j1; j++) if (row[j] < m) m = row[j];
  }
  return m / 100;
}
// does a box { x0, x1, y0, y1, z0, z1 } stand inside the hold's clear section at every station it spans?
function freightHoldFits(card, b) {
  const zm = frZMax(card, b.x0, b.x1, b.y0, b.y1);
  return zm >= 0 && Math.max(Math.abs(b.z0), Math.abs(b.z1)) <= zm + 1e-8;
}
// the clear width of the hold at station i over a band of height h above its floor (m)
function frRoomW(H, i, h) {
  const row = H.half[i], f = frFloorAt(H, i);
  const j0 = Math.floor((f - H.y0) / H.dy + 1e-6), j1 = Math.ceil((f + h - H.y0) / H.dy - 1e-6) - 1;
  if (j0 < 0 || j1 >= H.ny) return 0;
  let m = Infinity;
  for (let j = j0; j <= j1; j++) m = Math.min(m, row[j]);
  return isFinite(m) ? 2 * m / 100 : 0;
}

// ---- THE DOOR --------------------------------------------------------------------------------------------------
// One door, one item -> { ok, how: 'straight' | 'swung', axis } . The door's plane is (x aft, y up), its normal z
// inward. The item is held with its long axis u (phi from the door's plane, psi round it) and a roll rho; its
// slice in the door's plane is the parallelogram of its two cross dims projected along u — that must fit one of the
// door's clear rectangles. Wholly inside, its depth across the hold and its height must fit the hold's section at
// the door (frRoomW): then it is laid down along the hold. A deterministic grid, coarse enough to be cheap and
// memoised by the item's dims (kg plays no part in a door).
const FREIGHT_DOOR_GRID = { phi: 3, psi: 10, rho: 15 };
const frDoorMemo = new Map();
function freightDoorPass(card, door, item) {
  const H = card && card.hold;
  if (!door || !H || !door.rects || !door.rects.length) return { ok: false, why: 'no door' };
  const it = freightItem(item), K = FREIGHT_KINDS[it.kind];
  // keyed by what decides it (the openings, the hold at the door, the dims): a pair of mirrored doors asks once
  const key = (card.id || '') + '|' + JSON.stringify(door.rects) + '|' + door.st + '|' + it.dims.join(',') + '|' + (K.upright ? 'u' : '') + (K.squeeze || '');
  if (frDoorMemo.has(key)) return frDoorMemo.get(key);
  const st = door.st == null ? 0 : door.st;
  const hMax = (() => { let h = 0; for (let k = 1; k <= H.ny; k++) if (frRoomW(H, st, k * H.dy) > 0) h = k * H.dy; return h; })();
  const rects = door.rects;
  const holeOk = (X, Y) => rects.some(r => X <= r[0] + 1e-9 && Y <= r[1] + 1e-9);
  const D = it.dims.map(v => v * (K.squeeze || 1)), G = FREIGHT_DOOR_GRID, rad = Math.PI / 180;
  let res = { ok: false, why: it.id + ' (' + D.join(' x ') + ' m) passes no opening of ' + door.id };
  // which dim runs along the axis (the other two are the cross section); an upright item keeps its H vertical and
  // goes in straight (a full drum is not tipped)
  const axes = K.upright ? [[0, 1, 2], [1, 0, 2]] : [[0, 1, 2], [1, 2, 0], [2, 0, 1]];
  search:
  for (const [ia, ib, ic] of axes) {
    const L = D[ia], w = D[ib], d = D[ic];
    if (K.upright) {
      // straight in, H vertical: the hole w x d(H), the depth L across the hold at d's height
      if (holeOk(w, d) && L <= frRoomW(H, st, d) + 1e-9 && d <= hMax + 1e-9) { res = { ok: true, how: 'straight', axis: ia }; break; }
      continue;
    }
    for (let phi = 90; phi >= G.phi; phi -= G.phi) {
      const sp = Math.sin(phi * rad), cp = Math.cos(phi * rad);
      for (let psi = 0; psi < 180; psi += (phi === 90 ? 180 : G.psi)) {
        const ss = Math.sin(psi * rad), cs = Math.cos(psi * rad);
        const u = [cp * cs, cp * ss, sp];
        const e1 = [-ss, cs, 0];
        const e2 = [u[1] * e1[2] - u[2] * e1[1], u[2] * e1[0] - u[0] * e1[2], u[0] * e1[1] - u[1] * e1[0]];
        for (let rho = 0; rho < 180; rho += G.rho) {
          const cr = Math.cos(rho * rad), sr = Math.sin(rho * rad);
          const a2x = cr * e1[0] + sr * e2[0], a2y = cr * e1[1] + sr * e2[1], a2z = cr * e1[2] + sr * e2[2];
          const a3x = -sr * e1[0] + cr * e2[0], a3y = -sr * e1[1] + cr * e2[1], a3z = -sr * e1[2] + cr * e2[2];
          // the slice in the door's plane: v = a - (a_z / u_z) u, its (x, y)
          const X = w * Math.abs(a2x - a2z / sp * u[0]) + d * Math.abs(a3x - a3z / sp * u[0]);
          const Y = w * Math.abs(a2y - a2z / sp * u[1]) + d * Math.abs(a3y - a3z / sp * u[1]);
          if (!holeOk(X, Y)) continue;
          // wholly inside at this attitude: its depth across the hold and its height
          const Zx = L * Math.abs(u[2]) + w * Math.abs(a2z) + d * Math.abs(a3z);
          const Yx = L * Math.abs(u[1]) + w * Math.abs(a2y) + d * Math.abs(a3y);
          if (Yx > hMax + 1e-9 || Zx > frRoomW(H, st, Yx) + 1e-9) continue;
          res = { ok: true, how: (phi === 90 && rho % 90 === 0) ? 'straight' : 'swung', axis: ia };
          break search;
        }
      }
    }
  }
  frDoorMemo.set(key, res);
  return res;
}
// an item against every door of a card -> { ok, door, how } (the first door that takes it, in the card's order)
function freightDoorAny(card, item) {
  for (const d of (card && card.doors) || []) { const r = freightDoorPass(card, d, item); if (r.ok) return Object.assign({ door: d.id }, r); }
  return { ok: false, door: null, why: freightItem(item).id + ' passes no door' };
}
// THE HARD NO-NO: the items of a load that pass no door of this card -> [id]
function freightNoDoor(card, items) {
  return freightSplit(items).filter(it => !freightDoorAny(card, it).ok).map(it => it.id);
}

// ---- THE SEATS, THE OCCUPANTS, THE SPACES --------------------------------------------------------------------
// who sits where: the pilot in seat 0, `pax` passengers in the next seats in order; `seatsOut` the seats the player
// took out (only an empty seat can go). -> [{ i, x, back, z, w, occ, out }]
function freightSeats(card, opts) {
  const o = opts || {}, pax = Math.max(0, o.pax | 0), out = new Set(o.seatsOut || []);
  return ((card && card.seats) || []).map(s => {
    const occ = s.i === 0 || (s.i <= pax);
    return Object.assign({}, s, { occ, out: !occ && out.has(s.i) });
  });
}
// the obstacles in the hold: each seat still in (its pan and its back), an occupant's envelope on an occupied one
function freightObstacles(card, seats) {
  const F = FREIGHT_SEAT, H = card.hold, ob = [];
  const box = (id, s, fore, aft, h, w) => {
    const x0 = Math.max(fore, H.x0), x1 = Math.min(aft, frHoldX1(H));
    if (!(x1 > x0)) return;
    const y = freightRestY(card, x0, x1), y0 = y == null ? H.y0 : y;
    ob.push({ id, seat: s.i, x0, x1, y0, y1: y0 + h, z0: s.z - w / 2, z1: s.z + w / 2 });
  };
  for (const s of seats) {
    if (s.out) continue;
    if (s.occ) { box('occupant ' + s.i, s, s.back - F.legs, s.back + F.backT, F.occH, s.w + F.occW); continue; }
    box('seat ' + s.i, s, s.back - F.pan, s.back + F.backT, F.panH, s.w);
    box('seat back ' + s.i, s, s.back - F.backD, s.back + F.backT, F.seatH, s.w);
  }
  return ob;
}
// the spaces: the cabin floor behind the crew (to the cabin's aft ring), the baggage bay aft of it — each with its
// floor limit and its station (where its floor's middle is: the CG lever of what sits in it)
function freightSpaces(card) {
  const H = card && card.hold;
  if (!H) return [];
  const xb = Math.min(Math.max(card.cabinX1, H.x0), frHoldX1(H));
  const sp = [{ id: 'cabin', x0: H.x0, x1: xb, kgM2: FREIGHT_FLOOR.cabin }];
  if (frHoldX1(H) - xb > 0.05) sp.push({ id: 'baggage', x0: xb, x1: frHoldX1(H), kgM2: FREIGHT_FLOOR.baggage, maxKg: card.mass && card.mass.bagKg });
  for (const s of sp) s.station = frR3(0.5 * (s.x0 + s.x1));
  return sp;
}
const frSpaceOf = (spaces, x) => (spaces.find(s => x >= s.x0 - 1e-9 && x < s.x1 - 1e-9) || spaces[spaces.length - 1] || { id: null }).id;

// ---- THE REPORT: a set of placed items -> the CG, the mass, the margins ----------------------------------------
// placed: [{ id, kg, at: {x0,x1,y0,y1,z0,z1}, on? }]. Everything said, nothing refused.
function freightReport(card, placed, opts) {
  const o = opts || {}, Mm = card.mass, occKg = (typeof CONTRACT_FIT !== 'undefined' && CONTRACT_FIT.occKg) || 80;
  const seats = freightSeats(card, o), spaces = freightSpaces(card);
  const pax = seats.filter(s => s.occ && s.i > 0);
  const paxWanted = Math.max(0, o.pax | 0);
  let kg = Mm.base.kg, mx = Mm.base.kg * Mm.base.x;
  for (const s of pax) { kg += occKg; mx += occKg * s.x; }
  for (const p of placed) { const xc = 0.5 * (p.at.x0 + p.at.x1); kg += p.kg; mx += p.kg * xc; }
  const x = mx / kg;
  const pct = v => (Mm.mac && Mm.mac[1]) ? frR3((v - Mm.mac[0]) / Mm.mac[1] * 100) : null;
  const [fwd, aft] = Mm.cg;
  const cgMargin = Math.min(x - fwd, aft - x);
  // the floor: each item resting on the floor carries itself and everything on it
  const load = {};
  for (const p of placed) {
    let b = p; const seen = new Set();
    while (b.on && !seen.has(b.on)) { seen.add(b.on); const s = placed.find(q => q.id === b.on); if (!s) break; b = s; }
    load[b.id] = (load[b.id] || 0) + p.kg;
  }
  const floor = [];
  for (const p of placed) {
    if (p.on) continue;
    const A = (p.at.x1 - p.at.x0) * (p.at.z1 - p.at.z0);
    const space = frSpaceOf(spaces, 0.5 * (p.at.x0 + p.at.x1)), S = spaces.find(s => s.id === space);
    const kgM2 = A > 0 ? (load[p.id] || 0) / A : Infinity;
    floor.push({ id: p.id, space, kgM2: frR3(kgM2), limit: S ? S.kgM2 : null, ok: !S || kgM2 <= S.kgM2 + 1e-9 });
  }
  const bagS = spaces.find(s => s.id === 'baggage');
  const bagKg = frR3(placed.filter(p => bagS && frSpaceOf(spaces, 0.5 * (p.at.x0 + p.at.x1)) === 'baggage').reduce((s, p) => s + p.kg, 0));
  const out = {
    mass: { kg: frR3(kg), mtow: Mm.mtow, margin: frR3(Mm.mtow - kg), ok: kg <= Mm.mtow + 1e-6 },
    cg: { x: frR3(x), pct: pct(x), range: [fwd, aft], pctRange: [pct(fwd), pct(aft)], margin: frR3(cgMargin), ok: cgMargin >= -1e-6,
          side: x < fwd ? 'forward' : x > aft ? 'aft' : null },
    floor, floorOk: floor.every(f => f.ok),
    baggage: { kg: bagKg, limit: bagS ? (bagS.maxKg || 0) : 0, ok: !bagS || bagKg <= (bagS.maxKg || 0) + 1e-9 },
    seats: { pax: pax.length, wanted: paxWanted, ok: pax.length >= paxWanted, out: seats.filter(s => s.out).map(s => s.i) },
    cargoKg: freightKg(placed),
  };
  out.ok = out.mass.ok && out.cg.ok && out.floorOk && out.baggage.ok && out.seats.ok;
  out.why = [];
  if (!out.seats.ok) out.why.push(paxWanted + ' passengers, ' + pax.length + ' seats beside the pilot');
  if (!out.mass.ok) out.why.push(frR3(kg - Mm.mtow) + ' kg over the MTOW (' + Mm.mtow + ' kg)');
  if (!out.cg.ok) out.why.push('the CG ' + out.cg.pct + ' % MAC is ' + out.cg.side + ' of the certified ' + out.cg.pctRange.join('-') + ' %');
  for (const f of floor) if (!f.ok) out.why.push(f.id + ': ' + Math.round(f.kgM2) + ' kg/m2 on the ' + f.space + ' floor (' + f.limit + ')');
  if (!out.baggage.ok) out.why.push(bagKg + ' kg in the baggage bay, the placard says ' + out.baggage.limit);
  return out;
}

// ---- THE PACKER -------------------------------------------------------------------------------------------------
// the orientations a kind allows -> [[lx, ly(height), lz]] (deduplicated, in a fixed order)
function frOrients(it) {
  const K = FREIGHT_KINDS[it.kind], [a, b, c] = it.dims;
  const all = (K.upright || K.flat) ? [[a, c, b], [b, c, a]] : [[a, c, b], [b, c, a], [a, b, c], [c, b, a], [b, a, c], [c, a, b]];
  return all.filter((o, i) => all.findIndex(q => q[0] === o[0] && q[1] === o[1] && q[2] === o[2]) === i);
}
const frOverlap = (p, q) => p.x0 < q.x1 - 1e-6 && q.x0 < p.x1 - 1e-6 && p.y0 < q.y1 - 1e-6 && q.y0 < p.y1 - 1e-6 && p.z0 < q.z1 - 1e-6 && q.z0 < p.z1 - 1e-6;
// freightPack(card, items, opts) -> { ok, placed, unplaced, report, how }
//   opts: { pax (passengers beside the pilot), seatsOut ([seat i] the player took out), limits: false (geometry only),
//           doors: false (the room alone, no door asked: a report's "would it fit inside") }
// ok = every item placed (the geometry); report.ok = and within every limit. An item no door takes, or no room
// holds, is `unplaced` with why; a limit not met is in report.why. Nothing is refused.
function freightPack(card, itemsIn, opts) {
  const o = opts || {}, P = FREIGHT_PACK;
  const items = freightSplit(itemsIn);
  const res = { ok: false, placed: [], unplaced: [], report: null };
  if (!card || !card.hold) {
    res.unplaced = items.map(it => ({ id: it.id, why: 'this aeroplane has no hold' }));
    res.report = card && card.mass ? freightReport(card, [], o) : null;
    return res;
  }
  const H = card.hold, spaces = freightSpaces(card);
  const seats = freightSeats(card, o), obst = freightObstacles(card, seats);
  const Mm = card.mass, occKg = (typeof CONTRACT_FIT !== 'undefined' && CONTRACT_FIT.occKg) || 80;
  // biggest, then heaviest, then by id: a fixed order
  const order = items.slice().sort((p, q) => (q.dims[0] * q.dims[1] * q.dims[2]) - (p.dims[0] * p.dims[1] * p.dims[2]) || q.kg - p.kg || (p.id < q.id ? -1 : p.id > q.id ? 1 : 0));
  // the running mass and moment (the base, the passengers), so "near the CG" is near where the range wants it
  let kg = Mm.base.kg, mx = Mm.base.kg * Mm.base.x;
  for (const s of seats) if (s.occ && s.i > 0) { kg += occKg; mx += occKg * s.x; }
  // NEAR THE CG: an item goes where it moves the CG least - at the CG itself while the CG is in the certified
  // range; when it is out, where it brings the CG back to the nearer limit
  const xHi = frHoldX1(H);
  const placed = [];
  // the strict pass's running sums: the load on each floor-standing item (itself and its stack), the baggage bay's
  const baseLoad = {}, baseOf = id => { let p = placed.find(q => q.id === id); while (p && p.on) p = placed.find(q => q.id === p.on); return p ? p.id : id; };
  const bagS = spaces.find(q => q.id === 'baggage');
  let bagKg = 0;
  for (const it of order) {
    // (opts.doors === false: the room alone - "would it fit if it could get in", a report's question)
    const door = o.doors === false ? { ok: true, door: null, how: null } : freightDoorAny(card, it);
    if (!door.ok) { res.unplaced.push({ id: it.id, why: door.why || 'passes no door' }); continue; }
    const cgNow = mx / kg, cgWant = Math.min(Mm.cg[1], Math.max(Mm.cg[0], cgNow));
    const xt = ((kg + it.kg) * cgWant - mx) / Math.max(1e-9, it.kg);
    let best = null;
    for (const strict of (o.limits === false ? [false] : [true, false])) {
      for (const [lx, ly, lz] of frOrients(it)) {
        // x candidates: the whole hold at the pack step, nearest the target first (ties: forward first)
        const xs = [];
        for (let x0 = H.x0; x0 + lx <= xHi + 1e-9; x0 += P.step) xs.push(frR3(x0));
        xs.sort((a, b) => Math.abs(a + lx / 2 - xt) - Math.abs(b + lx / 2 - xt) || a - b);
        // z candidates: the middle outward, at the z step
        const zs = [];
        for (let k = 0; k * P.zStep <= 1.2; k++) { zs.push(frR3(-lz / 2 + k * P.zStep)); if (k) zs.push(frR3(-lz / 2 - k * P.zStep)); }
        let floorHit = false, stackHit = false;
        for (const x0 of xs) {
          if (floorHit) break;                       // a farther x can only score worse
          const x1 = x0 + lx;
          // the floor first, then the top of each stackable item already placed under the whole footprint
          const ys = [];
          const rest = freightRestY(card, x0, x1);
          if (rest != null) ys.push({ y: rest, on: null, level: 0 });
          if (!stackHit) for (const p of placed) if (p.stack && p.at.x0 <= x0 + 1e-9 && p.at.x1 >= x1 - 1e-9) ys.push({ y: p.at.y1, on: p.id, sup: p, level: 1 });
          for (const { y, on, sup, level } of ys) {
            if (level && stackHit) continue;
            const zm = frZMax(card, x0, x1, y, y + ly);
            if (zm < lz / 2 - 1e-8) continue;          // not even the middle is wide enough here
            for (const z0 of zs) {
              const z1 = z0 + lz;
              if (Math.max(-z0, z1) > zm + 1e-8) continue;   // the hold's walls (freightHoldFits, at this x and y)
              if (sup && (z0 < sup.at.z0 - 1e-9 || z1 > sup.at.z1 + 1e-9)) continue;   // wholly on its support
              const b = { x0, x1: frR3(x1), y0: y, y1: y + ly, z0, z1: frR3(z1) };
              if (obst.some(q => frOverlap(b, q)) || placed.some(q => frOverlap(b, q.at))) continue;
              const cand = { id: it.id, kind: it.kind, kg: it.kg, dims: it.dims, stack: it.stack && FREIGHT_KINDS[it.kind].stack,
                             at: { x0: frR3(b.x0), x1: frR3(b.x1), y0: frR3(b.y0), y1: frR3(b.y1), z0: frR3(b.z0), z1: frR3(b.z1) },
                             on, door: door.door, how: door.how };
              if (strict) {
                // the floor under it (or under the item at the bottom of its stack) and the baggage placard, kept
                // incrementally: the same numbers freightReport states
                const baseId = on ? baseOf(on) : it.id;
                const bp = on ? placed.find(q => q.id === baseId) : cand;
                const A = (bp.at.x1 - bp.at.x0) * (bp.at.z1 - bp.at.z0);
                const S = spaces.find(q => q.id === frSpaceOf(spaces, 0.5 * (bp.at.x0 + bp.at.x1)));
                if (S && ((baseLoad[baseId] || 0) + it.kg) / A > S.kgM2 + 1e-9) continue;
                const inBag = frSpaceOf(spaces, 0.5 * (b.x0 + b.x1)) === 'baggage';
                if (inBag && bagS && bagKg + it.kg > (bagS.maxKg || 0) + 1e-9) continue;
              }
              // the score: on the floor before stacked, LOW (its middle's height, to the cell), near the target
              // station, near the middle - compared in that order, a tie keeping the first candidate
              const sc = [level, Math.round((0.5 * ly + b.y0 - H.y0) / H.dy), frR3(Math.abs(0.5 * (b.x0 + b.x1) - xt)), frR3(Math.abs(0.5 * (b.z0 + b.z1)))];
              let better = !best;
              for (let k = 0; !better && k < sc.length; k++) { if (sc[k] < best.sc[k] - 1e-9) better = true; else if (sc[k] > best.sc[k] + 1e-9) break; }
              if (better) best = { sc, cand };
              if (level) stackHit = true; else floorHit = true;
              break;    // the nearest z at this x and this level
            }
          }
        }
      }
      if (best) break;
    }
    if (!best) { res.unplaced.push({ id: it.id, why: it.id + ' (' + it.dims.join(' x ') + ' m) finds no room in the hold' }); continue; }
    best.cand.space = frSpaceOf(spaces, 0.5 * (best.cand.at.x0 + best.cand.at.x1));
    placed.push(best.cand);
    const bId = best.cand.on ? baseOf(best.cand.on) : it.id;
    baseLoad[bId] = (baseLoad[bId] || 0) + it.kg;
    if (best.cand.space === 'baggage') bagKg += it.kg;
    kg += it.kg; mx += it.kg * 0.5 * (best.cand.at.x0 + best.cand.at.x1);
  }
  res.placed = placed;
  res.ok = res.unplaced.length === 0;
  res.report = freightReport(card, placed, o);
  return res;
}

// ---- WHAT A DESIGN CAN CARRY (the contracts' physical gate gains the volume) --------------------------------------
// freightFits(card, items, {pax}) -> { ok, seatsOut, why, room }: the load has a LEGAL loading on this design -
// every item through a door, the whole load packed with the passengers seated, and the packer's proposal within
// every limit (the MTOW, the certified CG range, the floors, the baggage placard) - with the seats in, else with
// the empty seats taken out (the player's call, ruled). `room` says whether it fits at all (the geometry), so a
// caller can tell "no room" from "only out of limits". Memoised by the load and the passengers.
const frFitMemo = new Map();
function freightFits(card, items, opts) {
  const pax = Math.max(0, (opts && opts.pax) | 0);
  const its = freightSplit(items);
  if (!its.length) return { ok: true, seatsOut: [], why: '', room: true };
  if (!card || !card.hold) return { ok: false, seatsOut: [], why: 'no hold', room: false };
  const key = (card.id || JSON.stringify(card.mass)) + '|' + pax + '|' + its.map(i => i.id + ':' + i.kind + ':' + i.kg + ':' + i.dims.join(',')).sort().join(';');
  if (frFitMemo.has(key)) return frFitMemo.get(key);
  let r;
  const nd = its.filter(it => !freightDoorAny(card, it).ok);
  if (nd.length) r = { ok: false, seatsOut: [], why: nd.map(i => i.id).join(', ') + ' (' + nd[0].dims.join(' x ') + ' m) passes no door', room: false };
  else {
    const empty = (card.seats || []).filter(s => s.i > pax).map(s => s.i);
    const tries = empty.length ? [[], empty] : [[]];
    let room = false, why = '';
    for (const out of tries) {
      const a = freightPack(card, its, { pax, seatsOut: out });
      if (a.ok) room = true;
      if (a.ok && a.report.ok) { r = { ok: true, seatsOut: out, why: '', room: true }; break; }
      why = a.ok ? 'loaded only out of limits: ' + a.report.why.join('; ') : a.unplaced.map(u => u.why).join('; ');
    }
    if (!r) r = { ok: false, seatsOut: empty, why, room };
  }
  frFitMemo.set(key, r);
  return r;
}
// a design row (CONTRACT_DESIGNS) -> its card, or null (no card measured: the volume is not known)
const freightCardOf = D => (D && D.id && typeof FREIGHT_CARDS !== 'undefined' && FREIGHT_CARDS[D.id]) || null;
// the items a sub carries (a job's own list; an authored load's kilos as boxes)
function freightSubItems(sub, rec) {
  if (!sub || !sub.load) return [];
  if (Array.isArray(sub.load.items)) return freightSplit(sub.load.items);
  return freightItems(sub.load, rec && rec.goods);
}

// ---- THE MAP'S MARK (§R.2: ✓ / ✗ only for the hard no-no's; build contracts carry no mark) ------------------------
// rec (a contract record) + the fleet's designs ([{ slot, design: CONTRACT_DESIGNS row | null, card }]) ->
//   { ok: true | false | null, gear: {ok, why}, door: {ok, why, items} }
// gear: some airframe's gear uses both ends of every flying sub (water vs wheels, land vs floats-only);
// door: every item passes some door of one airframe that also takes the gear (THE HARD NO-NO: an item that passes
// no door of any of your planes). null when nothing about the fleet is known; a build contract -> null.
function freightMark(rec, fleet, fields) {
  if (!rec || rec.kind === 'build') return null;
  const F = fields || CONTRACT_FIELDS;
  const subs = [].concat(...((rec.stages || []).map(st => st.subs || [])));
  const ends = [];
  for (const s of subs) for (const k of ['from', 'to']) if (s[k] && F[s[k]] && (s.do === 'carry' || s.do === 'fly' || s.do === 'land' || (s.do === 'survey' && k === 'from'))) ends.push(F[s[k]]);
  const items = [].concat(...subs.map(s => freightSubItems(s, rec)));
  const known = (fleet || []).filter(f => f && f.design);
  if (!known.length) return { ok: null, gear: { ok: null, why: 'no airframe with a certificate' }, door: { ok: null, why: '', items: [] } };
  const gearOk = f => ends.every(e => contractGearOk(f.design.gear, e));
  const gearers = known.filter(gearOk);
  const gear = gearers.length ? { ok: true, why: '' }
    : { ok: false, why: 'no airframe of yours uses ' + ends.filter((e, i, a) => a.indexOf(e) === i).map(e => e.name + ' (' + e.surf + ')').join(', ') };
  let door = { ok: true, why: '', items: [] };
  if (items.length) {
    const pool = gearers.length ? gearers : known;
    const cards = pool.map(f => f.card || freightCardOf(f.design));
    if (cards.some(c => !c)) {
      door = cards.some(c => c && !freightNoDoor(c, items).length) ? { ok: true, why: '', items: [] } : { ok: null, why: 'a hold not measured yet', items: [] };
    } else {
      const bad = items.filter(it => cards.every(c => !freightDoorAny(c, it).ok)).map(it => it.id);
      // the same airframe must take every item through its doors
      const one = cards.some(c => !freightNoDoor(c, items).length);
      door = one ? { ok: true, why: '', items: [] }
        : { ok: false, items: bad.length ? bad : items.map(i => i.id),
            why: 'no door fits: ' + (bad.length ? bad.join(', ') : 'no one airframe of yours takes every item through its doors') };
    }
  }
  return { ok: gear.ok === false || door.ok === false ? false : (gear.ok && door.ok) ? true : null, gear, door };
}

// FREIGHT_CARDS-BEGIN (written by `node tools/_freight_site.js --write`; GATE FREIGHT re-measures each from its build)
const FREIGHT_CARDS = {
  cub: {"v":1,"id":"cub","label":"Cub","hold":{"x0":0.3,"dx":0.1,"n":24,"y0":-0.35,"dy":0.05,"ny":21,"floor":[5,5,4,4,4,3,3,3,3,4,5,6,7,7,8,9,10,11,12,12,13,14,15,15,16],"half":[[0,33,33,33,33,33,32,32,32,31,31,30,30,29,29,28,28,27,27,7,0],[33,33,33,33,33,33,33,32,32,31,31,30,30,29,29,28,28,27,27,7,0],[33,33,33,33,33,33,33,33,32,31,31,30,30,29,29,28,28,27,27,7,0],[33,33,33,33,33,33,33,33,32,32,31,31,30,29,29,28,28,27,27,7,0],[33,33,33,33,33,33,33,33,32,32,31,31,30,30,29,28,28,27,27,7,0],[34,34,34,33,33,33,33,33,33,32,32,31,30,30,29,29,28,27,27,7,0],[34,34,34,34,34,34,34,34,33,32,32,31,31,30,29,29,28,27,27,7,0],[34,34,34,34,34,34,34,34,34,33,32,32,31,30,30,29,28,27,27,7,0],[34,34,34,34,34,34,34,34,34,33,32,32,31,30,29,29,28,27,27,7,0],[34,34,34,34,34,34,34,34,34,33,32,31,31,30,29,29,28,27,26,7,0],[34,34,34,34,34,34,34,34,34,33,32,31,31,30,29,28,28,27,9,7,0],[0,34,34,34,34,34,34,34,34,33,32,31,31,30,29,28,28,27,7,0,0],[0,34,34,34,34,34,34,34,34,33,32,31,30,30,29,28,27,26,7,0,0],[0,34,34,34,34,34,34,34,34,33,32,31,30,29,29,28,27,0,0,0,0],[0,34,34,34,34,34,34,34,34,33,32,31,30,29,28,28,27,7,0,0,0],[0,34,34,34,34,34,34,34,34,33,32,31,30,29,28,27,26,0,0,0,0],[0,34,34,34,34,34,34,34,34,33,32,31,30,29,28,27,0,0,0,0,0],[0,0,34,34,34,34,34,34,34,33,32,31,30,29,28,27,0,0,0,0,0],[0,0,34,34,34,34,34,34,34,33,32,31,30,28,27,23,7,0,0,0,0],[0,0,34,34,34,34,34,34,34,32,31,30,29,28,27,7,0,0,0,0,0],[0,0,34,34,34,34,34,34,34,32,31,30,29,28,27,7,0,0,0,0,0],[0,0,33,33,33,33,33,33,32,31,30,29,28,27,26,7,0,0,0,0,0],[0,0,32,32,32,32,32,32,31,30,29,28,27,26,25,7,0,0,0,0,0],[0,0,0,30,30,30,30,30,30,29,28,27,26,25,24,0,0,0,0,0,0],[0,0,0,29,29,29,29,29,29,28,27,26,25,24,23,6,0,0,0,0,0]]},"cabinX1":2.304,"seats":[{"i":0,"x":0.62,"back":0.82,"row":0,"z":0,"w":0.5},{"i":1,"x":2.003,"back":2.203,"row":1,"z":0,"w":0.5}],"doors":[{"id":"pilot:M","side":-1,"x0":0.031,"x1":0.989,"y0":-0.53,"y1":0.561,"rects":[[0.916,0.1],[0.916,0.22],[0.916,0.36],[0.916,0.48],[0.831,0.66],[0.737,0.78],[0.627,0.92],[0.534,1.04]],"st":2},{"id":"pilot:P","side":1,"x0":0.031,"x1":0.989,"y0":-0.53,"y1":0.561,"rects":[[0.916,0.1],[0.916,0.22],[0.916,0.36],[0.916,0.48],[0.831,0.66],[0.737,0.78],[0.627,0.92],[0.534,1.04]],"st":2}],"mass":{"mtow":556.195,"base":{"kg":466.195,"x":0.637},"cg":[0.637,0.921],"mac":[0.285,1.7],"bagKg":10,"seats":2}},
  jodel: {"v":1,"id":"jodel","label":"Jodel","hold":{"x0":0.2,"dx":0.1,"n":19,"y0":-0.35,"dy":0.05,"ny":19,"floor":[4,4,4,3,3,2,2,2,7,10,11,12,13,13,14,15,16,17,18,18],"half":[[49,49,49,49,48,48,48,48,47,44,40,37,34,31,28,24,21,0,0],[49,49,49,49,49,48,48,48,46,43,40,37,34,31,27,24,21,0,0],[49,49,49,49,49,48,48,48,46,43,40,37,34,31,27,24,21,0,0],[49,49,49,49,49,48,48,48,46,43,40,37,34,31,27,24,21,6,0],[49,49,49,49,49,49,48,48,46,43,40,37,34,30,27,24,21,6,0],[49,49,49,49,49,49,49,48,46,43,40,37,34,31,28,24,21,0,0],[50,50,50,50,50,49,49,49,46,43,40,37,34,31,28,25,22,6,0],[51,51,51,50,50,50,50,50,49,48,46,45,43,41,39,34,25,0,0],[0,50,50,50,50,50,50,50,49,48,46,45,43,41,38,34,24,6,0],[0,0,49,49,49,49,49,49,48,46,45,44,42,40,37,33,22,6,0],[0,0,47,47,47,47,47,47,46,45,44,42,41,38,36,31,18,6,0],[0,0,46,46,46,46,46,46,45,43,42,41,39,37,34,29,13,5,0],[0,0,44,44,44,44,44,44,43,42,41,39,38,36,33,27,8,5,0],[0,0,43,43,43,43,43,42,42,40,39,38,36,34,31,25,5,0,0],[0,0,41,41,41,41,41,41,40,39,38,36,35,33,30,23,5,0,0],[0,0,0,40,40,40,40,39,39,37,36,35,33,31,28,21,5,0,0],[0,0,0,38,38,38,38,38,37,36,35,34,32,30,27,19,5,0,0],[0,0,0,37,37,37,37,36,36,34,33,32,31,28,25,16,4,0,0],[0,0,0,35,35,35,35,35,34,33,32,31,29,27,24,12,4,0,0],[0,0,0,33,33,33,33,33,33,32,31,29,28,26,22,8,0,0,0]]},"cabinX1":1.457,"seats":[{"i":0,"x":0.466,"back":0.666,"row":0,"z":-0.241,"w":0.482},{"i":1,"x":0.466,"back":0.666,"row":0,"z":0.241,"w":0.482}],"doors":[{"id":"pilot:M","side":-1,"x0":0.035,"x1":0.851,"y0":-0.487,"y1":0.401,"rects":[[0.77,0.1],[0.77,0.28],[0.769,0.36],[0.765,0.46],[0.733,0.56],[0.65,0.66],[0.586,0.74],[0.512,0.84]],"st":2},{"id":"pilot:P","side":1,"x0":0.035,"x1":0.851,"y0":-0.487,"y1":0.401,"rects":[[0.77,0.1],[0.77,0.28],[0.769,0.36],[0.765,0.46],[0.733,0.56],[0.65,0.66],[0.586,0.74],[0.512,0.84]],"st":2}],"mass":{"mtow":542.955,"base":{"kg":452.955,"x":0.413},"cg":[0.413,0.479],"mac":[-0.012,1.672],"bagKg":10,"seats":2}},
  c172: {"v":1,"id":"c172","label":"metal Cessna","hold":{"x0":0.2,"dx":0.1,"n":29,"y0":-0.4,"dy":0.05,"ny":24,"floor":[6,5,5,4,4,3,2,1,1,1,1,1,1,1,1,1,1,1,2,2,3,3,4,4,5,5,5,5,6,6],"half":[[0,52,52,53,53,54,54,54,54,54,54,53,51,49,48,46,44,42,40,39,37,35,10,0],[0,52,53,53,54,54,54,54,54,54,54,53,51,50,48,46,44,42,40,39,37,35,10,0],[52,52,53,53,54,54,54,54,54,54,54,53,52,50,48,46,44,42,40,39,37,35,10,0],[52,52,53,53,54,54,54,54,55,55,54,54,52,50,48,46,44,42,41,39,37,35,10,0],[52,52,53,53,54,54,54,55,55,55,55,54,52,50,48,46,44,42,41,39,37,35,10,0],[52,52,53,54,54,54,55,55,55,55,55,54,52,50,48,46,44,43,41,39,37,35,10,0],[52,53,53,54,54,55,55,55,55,55,55,54,52,50,49,47,45,43,41,39,37,35,10,0],[52,53,54,54,55,55,55,55,56,56,56,55,53,51,49,47,45,43,41,39,37,35,10,0],[53,53,54,55,55,56,56,56,56,56,56,56,55,55,55,54,54,53,52,51,49,42,10,0],[53,53,54,55,55,56,56,56,56,56,56,56,55,55,55,54,54,53,52,51,49,42,10,0],[53,53,54,55,55,56,56,56,56,56,56,56,55,55,54,54,53,53,52,51,49,42,10,0],[53,53,54,55,55,56,56,56,56,56,56,56,55,55,54,54,53,53,52,51,49,42,10,0],[53,53,54,55,55,56,56,56,56,56,56,56,55,55,54,54,53,53,52,51,49,42,10,0],[53,53,54,55,55,56,56,56,56,56,56,56,55,55,54,54,53,53,52,51,49,42,10,0],[53,53,54,55,55,56,56,56,56,56,56,56,55,55,55,54,54,53,52,51,49,42,10,0],[53,53,54,55,55,56,56,56,56,56,56,56,55,55,55,54,54,53,52,51,49,42,10,0],[53,53,54,55,55,56,56,56,56,56,56,56,55,55,54,54,53,53,52,51,49,42,10,0],[52,53,54,54,54,55,55,55,56,56,55,55,54,54,53,53,52,51,51,49,45,0,0,0],[51,52,52,53,53,54,54,54,54,54,54,54,53,52,52,51,50,49,47,38,10,0,0,0],[50,50,51,51,52,52,53,53,53,53,53,52,52,51,50,50,48,45,0,0,0,0,0,0],[48,49,50,50,51,51,51,51,52,52,51,51,50,49,48,47,41,10,0,0,0,0,0,0],[47,48,48,49,49,50,50,50,50,51,50,49,49,47,45,9,0,0,0,0,0,0,0,0],[46,46,47,48,48,48,49,49,49,49,49,48,46,43,9,0,0,0,0,0,0,0,0,0],[45,45,46,46,47,47,47,48,48,48,47,45,32,0,0,0,0,0,0,0,0,0,0,0],[44,44,45,45,46,46,46,46,47,47,45,9,0,0,0,0,0,0,0,0,0,0,0,0],[43,43,44,45,45,45,46,46,46,46,44,9,0,0,0,0,0,0,0,0,0,0,0,0],[0,42,43,43,44,44,44,45,45,45,43,8,0,0,0,0,0,0,0,0,0,0,0,0],[0,41,42,42,43,43,43,43,44,44,41,8,0,0,0,0,0,0,0,0,0,0,0,0],[0,40,40,41,41,42,42,42,42,42,40,0,0,0,0,0,0,0,0,0,0,0,0,0],[0,38,39,40,40,40,41,41,41,41,38,0,0,0,0,0,0,0,0,0,0,0,0,0]]},"cabinX1":1.848,"seats":[{"i":0,"x":0.499,"back":0.699,"row":0,"z":-0.272,"w":0.5},{"i":1,"x":0.499,"back":0.699,"row":0,"z":0.272,"w":0.5},{"i":2,"x":1.523,"back":1.723,"row":1,"z":-0.279,"w":0.5},{"i":3,"x":1.523,"back":1.723,"row":1,"z":0.279,"w":0.5}],"doors":[{"id":"pilot:M","side":-1,"x0":0.035,"x1":0.949,"y0":-0.507,"y1":0.591,"rects":[[0.869,0.1],[0.869,0.22],[0.869,0.34],[0.858,0.58],[0.781,0.68],[0.69,0.8],[0.598,0.92],[0.508,1.04]],"st":3},{"id":"pilot:P","side":1,"x0":0.035,"x1":0.949,"y0":-0.507,"y1":0.591,"rects":[[0.869,0.1],[0.869,0.22],[0.869,0.34],[0.858,0.58],[0.781,0.68],[0.69,0.8],[0.598,0.92],[0.508,1.04]],"st":3}],"mass":{"mtow":1043.41,"base":{"kg":763.41,"x":0.806},"cg":[0.806,0.944],"mac":[0.336,1.68],"bagKg":40,"seats":4}},
  c172f: {"v":1,"id":"c172f","label":"Cessna floats","hold":{"x0":0.2,"dx":0.1,"n":29,"y0":-0.4,"dy":0.05,"ny":24,"floor":[6,5,5,4,4,3,2,1,1,1,1,1,1,1,1,1,1,1,2,2,3,3,4,4,5,5,5,5,6,6],"half":[[0,52,52,53,53,54,54,54,54,54,0,0,0,0,0,0,0,0,0,0,0,0,0,0],[0,52,53,53,54,54,54,54,54,54,0,0,0,0,0,0,0,0,0,0,0,0,0,0],[52,52,53,53,54,54,54,54,54,54,54,0,0,0,0,0,0,0,0,0,0,0,0,0],[52,52,53,53,54,54,54,54,55,55,54,0,0,0,0,0,0,0,0,0,0,0,0,0],[52,52,53,53,54,54,54,55,55,55,55,0,0,0,0,0,0,0,0,0,0,0,0,0],[52,52,53,54,54,54,55,55,55,55,55,0,0,0,0,0,0,0,0,0,0,0,0,0],[52,53,53,54,54,55,55,55,55,55,55,0,0,0,0,0,0,0,0,0,0,0,0,0],[52,53,54,54,55,55,55,55,56,56,56,56,0,0,0,0,0,0,0,0,0,0,0,0],[53,53,54,55,55,56,56,56,56,56,56,56,55,55,55,54,54,53,52,51,49,42,10,0],[53,53,54,55,55,56,56,56,56,56,56,55,53,51,49,47,45,43,41,39,37,35,10,0],[53,53,54,55,55,56,56,56,56,56,56,55,53,51,49,47,45,43,41,39,37,35,10,0],[53,53,54,55,55,56,56,56,56,56,56,55,53,51,49,47,45,43,41,39,37,35,10,0],[53,53,54,55,55,56,56,56,56,56,56,55,53,51,49,47,45,43,41,39,37,35,10,0],[53,53,54,55,55,56,56,56,56,56,56,55,53,51,49,47,45,43,41,39,37,35,10,0],[53,53,54,55,55,56,56,56,56,56,56,55,53,51,49,47,45,43,41,39,37,35,10,0],[53,53,54,55,55,56,56,56,56,56,56,55,53,51,49,47,45,43,41,39,37,35,10,0],[53,53,54,55,55,56,56,56,56,56,56,56,55,55,55,54,54,53,52,51,49,42,10,0],[52,53,54,54,54,55,55,55,56,56,55,55,55,54,54,53,53,52,51,49,45,0,0,0],[51,52,52,53,53,54,54,54,54,54,54,54,53,53,52,52,51,49,47,38,10,0,0,0],[50,50,51,51,52,52,53,53,53,53,53,52,52,51,51,50,48,45,0,0,0,0,0,0],[48,49,50,50,51,51,51,51,52,52,51,51,50,49,48,47,41,10,0,0,0,0,0,0],[47,48,48,49,49,50,50,50,50,51,50,49,49,47,45,9,0,0,0,0,0,0,0,0],[46,46,47,48,48,48,49,49,49,49,49,48,46,43,9,0,0,0,0,0,0,0,0,0],[45,45,46,46,47,47,47,48,48,48,47,45,32,0,0,0,0,0,0,0,0,0,0,0],[44,44,45,45,46,46,46,46,47,47,45,9,0,0,0,0,0,0,0,0,0,0,0,0],[43,43,44,45,45,45,46,46,46,46,44,9,0,0,0,0,0,0,0,0,0,0,0,0],[0,42,43,43,44,44,44,45,45,45,43,8,0,0,0,0,0,0,0,0,0,0,0,0],[0,41,42,42,43,43,43,43,44,44,41,8,0,0,0,0,0,0,0,0,0,0,0,0],[0,40,40,41,41,42,42,42,42,42,40,0,0,0,0,0,0,0,0,0,0,0,0,0],[0,38,39,40,40,40,41,41,41,41,38,0,0,0,0,0,0,0,0,0,0,0,0,0]]},"cabinX1":1.848,"seats":[{"i":0,"x":0.499,"back":0.699,"row":0,"z":-0.272,"w":0.5},{"i":1,"x":0.499,"back":0.699,"row":0,"z":0.272,"w":0.5},{"i":2,"x":1.523,"back":1.723,"row":1,"z":-0.279,"w":0.5},{"i":3,"x":1.523,"back":1.723,"row":1,"z":0.279,"w":0.5}],"doors":[{"id":"pilot:M","side":-1,"x0":0.035,"x1":0.949,"y0":-0.507,"y1":0.591,"rects":[[0.869,0.1],[0.869,0.22],[0.869,0.34],[0.858,0.58],[0.781,0.68],[0.69,0.8],[0.598,0.92],[0.508,1.04]],"st":3},{"id":"pilot:P","side":1,"x0":0.035,"x1":0.949,"y0":-0.507,"y1":0.591,"rects":[[0.869,0.1],[0.869,0.22],[0.869,0.34],[0.858,0.58],[0.781,0.68],[0.69,0.8],[0.598,0.92],[0.508,1.04]],"st":3}],"mass":{"mtow":1178.699,"base":{"kg":898.186,"x":0.896},"cg":[0.896,0.997],"mac":[0.336,1.68],"bagKg":40,"seats":4}},
  twinf: {"v":1,"id":"twinf","label":"twin floatplane","hold":null,"cabinX1":1.546,"seats":[{"i":0,"x":0.491,"back":0.691,"row":0,"z":0,"w":0.5}],"doors":[],"mass":{"mtow":471.728,"base":{"kg":475.416,"x":0.946},"cg":[0.946,0.97],"mac":[0.483,1.5],"bagKg":0,"seats":1}},
};
// FREIGHT_CARDS-END
// ===========================================================================
// THE PILOTS YOU HIRE (G2290 PILOTS) — the roster, hiring, who flies, refusals
// by trait, a pilot's place, and skill growth from the logbook.
// futureDesigns/GAME-2026-10-06.md §9 (the spec), §R (binding: GQ13 four
// recruits on the existing bodies, no download; G-COST a one-time sign-on fee,
// no wages; GQ14 pilots are physical, the free boat home; GQ30 refusals by
// trait only, no morale); futureDesigns/game/NARRATIVE-PROMPT-PACK-2026-10-06.md
// Block 3 (the four pilots' FIXED knobs and traits: THIS FILE'S DATA, gated
// against the pack by GATE PILOTS).
// ===========================================================================
// A PILOT IS A PERSON WRAPPED AROUND A PROFILE (§9.1): the flying is PILOT-PERSONA's profile (43_pilot.js
// PILOT_PROFILES + PILOT_PROFILE_KNOBS, clamped through pilotProfile / pilotProfileSpec), one pilot, never a fork.
// The body is a Mixamo character already in the game (tools/chars_table.py; the crew's `pilotWho`): ch20 stays the
// TEST PILOT and ch02 is kept for the user's own purposes, so neither is a recruit. The words (name, tagline, bio,
// barks, "flies like", the pitch) are TEXT KEYS: draft until the user's external-AI run (GQ21) is imported
// (pilotsImportPack, Block 5's "pilots"). The portrait is null until that run too.
//
// THE CAREER BLOCK (74_career.js reserved `pilots: {}` and `roster: []` for this session; PLAYER_V / CAREER_V
// unchanged, the fields ride along):
//   career.roster: [id]              the hired pilots, in hiring order (the companion first)
//   career.pilots: { <id>: {         one row per pilot ever hired (a fired pilot keeps the row: the logbook stays)
//       hired: <clock s> | null,     null: not on the roster now (fired)
//       fee:   <the sign-on paid>,
//       aero:  <aerodrome id>,       where the pilot was left (the boat home: HOME; a flight flown: where it stopped)
//       plane: <slot> | null,        the aeroplane the pilot is WITH: their place follows it (the fleet ledger)
//       log:   [ { n, at, slot, from, to, landed, tw, t } ] } }   their logbook: every flight they flew
//   career.pilotPick: <id> | 'me'    who flies the next flight ('me' = by hand / the expert, "I fly")
//   career.pilotN: <count>           flights logged by hired pilots (the row number `n`)
//
// Pure: every operation works on a clone and returns { ok, doc, why, ... }; a refusal hands back the very document
// it was given, untouched (74_career.js's contract). No DOM, no storage, no clock, no random.
// ===========================================================================
const PILOTS_V = 1;
const PILOTS_ORDER = ['kit', 'rafe', 'remy', 'sky'];
const PILOTS_COMPANION = 'kit';                       // arrives with the player (§9.2, the pack's COMPANION)
const PILOTS_RESERVED = { ch20: 'the test pilot', ch02: 'kept for the user\'s own purposes' };   // GQ13: not recruits
const PILOTS_MARKET = { min: 2, max: 3 };             // recruitables shown at a time, refreshed with the market
const PILOTS_GROW = { fast: 30, steady: 60 };         // logged landings to reach the ceiling (§9.4)
const PILOTS_WEATHER = { windKt: 18 };                // a cautious pilot's limit: the surface wind at the decision
const PILOTS_SHORT_M = 300;                           // short-strip nerves: refuses strips under this (m)
const PILOTS_PAVED = ['concrete', 'asphalt'];         // paved-only: the surfaces it will use
// G-COST: the one-time sign-on fee. ECONOMY (G2260) owns the price book (econPrice('signon', id)); until it lands,
// this stub - the order is the pack's (remy the cheapest, sky the priciest; the companion comes with the opening).
const PILOTS_SIGNON_STUB = { kit: 0, remy: 1500, rafe: 4000, sky: 7000 };

// ---- THE TRAITS: hooks, never prose (§9.3). Each names what it does; the pack's phrase is its label key. --------------
//   refuse     a refusal kind (pilotsRefusal): 'weather' | 'night' | 'short' | 'unpaved' | 'water' | 'snow'
//   keeps      the refusals this trait switches OFF ('*' every one)
//   labourK    x the repair LABOUR on an aeroplane the pilot is with, in the field (no hangar of yours around it)
//   billK      x the whole repair bill on an aeroplane the pilot is with
//   fixes      the knobs the trait holds (growth never moves them)
//   growOn     the landings that count for growth ('tw': tailwheel types only)
const PILOTS_TRAITS = {
  mechanic:             { labourK: 0.9 },
  cautious:             { refuse: 'weather' },
  'night-shy':          { refuse: 'night' },
  fearless:             { keeps: ['weather'] },
  'hard-on-airframes':  { billK: 1.1 },
  eager:                {},
  'short-field':        { fixes: ['field', 'slip'] },
  'loves-taildraggers': { growOn: 'tw' },
  'refuses-nothing':    { keeps: '*' },
  // the hooks no recruit carries today (a later pilot, or the user's text, may): GATE PILOTS fires each of them
  'short-strip-nerves': { refuse: 'short' },
  'paved-only':         { refuse: 'unpaved' },
  'no-water':           { refuse: 'water' },
  'no-snow':            { refuse: 'snow' },
};
const PILOTS_REFUSALS = ['weather', 'night', 'short', 'unpaved', 'water', 'snow'];

// ---- THE ROSTER: the pack's Block 3, verbatim in numbers (GATE PILOTS parses the pack and compares) ----------------
//   who       the chars_table key (the body; tools/chars_table.py)
//   profile   { base: a PILOT_PROFILES name, knobs: the pack's overrides } -> pilotsProfile clamps it
//   style     PILOT_STYLES name
//   traits    PILOTS_TRAITS ids (the pack's TRAITS column)
//   grow      { rate: PILOTS_GROW key, ceiling: a PILOT_PROFILES name } | null (the pack: "grows ... (ceiling: X)")
//   signOn    'stub' (the price book's, pilotsSignOn) - the companion's is 0
//   pack      what the pack left unsaid that this table decided (HANDOVER G2290 lists them)
const PILOTS_ROSTER = {
  kit:  { id: 'kit', who: 'ch01', companion: true,
          profile: { base: 'club', knobs: { reaction: 0.25, smooth: 0.8, bankK: 0.85, comfortG: 1.25 } },
          style: 'cautious', traits: ['mechanic', 'cautious', 'night-shy'], grow: { rate: 'steady', ceiling: 'bush' },
          portrait: null },
  rafe: { id: 'rafe', who: 'ch42',
          profile: { base: 'hamfist', knobs: { hamFist: 0.04, comfortG: 1.9, bankK: 1.25 } },
          style: 'normal', traits: ['fearless', 'hard-on-airframes'], grow: null,
          portrait: null, pack: { style: 'not given: normal', grow: 'not given: none (the rough hands stay)' } },
  remy: { id: 'remy', who: 'remy',
          profile: { base: 'student', knobs: { reaction: 0.40, overRotate: 0.03, flareK: 0.85 } },
          style: 'normal', traits: ['eager'], grow: { rate: 'fast', ceiling: 'expert' },
          portrait: null, pack: { style: 'not given: normal' } },
  sky:  { id: 'sky', who: 'ch22',
          profile: { base: 'bush', knobs: { reaction: 0.12, smooth: 1.0, slip: true, field: 'short', bankK: 1.2, comfortG: 1.7 } },
          style: 'normal', traits: ['short-field', 'loves-taildraggers', 'refuses-nothing'], grow: { rate: 'steady', ceiling: 'expert' },
          portrait: null, pack: { style: 'not given: normal', grow: 'not given: steady to the expert, on tailwheel types only (loves taildraggers)' } },
};

// ---- THE TEXT: draft keys until the user's AI run (GQ21); the same { t, draft } shape as CONTRACT_TEXT ------------
const PLT_ = t => ({ t, draft: true });
const PILOTS_TEXT = {
  'pilot.kit.name': PLT_('Kit'), 'pilot.rafe.name': PLT_('Rafe'), 'pilot.remy.name': PLT_('Remy'), 'pilot.sky.name': PLT_('Sky'),
  'pilot.kit.tagline': PLT_('Fixes engines, flies a little, came with you.'),
  'pilot.rafe.tagline': PLT_('Loud, brave, rough on the stick.'),
  'pilot.remy.tagline': PLT_('A brand-new licence and no hours.'),
  'pilot.sky.tagline': PLT_('Grew up landing on gravel bars.'),
  'pilot.kit.bio': PLT_('[draft] The one who came with you. The text comes from the narrative run.'),
  'pilot.rafe.bio': PLT_('[draft] Ex-crop-duster and airshow ground crew turned pilot.'),
  'pilot.remy.bio': PLT_('[draft] Just finished the commercial licence. Wants hours.'),
  'pilot.sky.bio': PLT_('[draft] A bush pilot from the gravel bars.'),
  'pilot.kit.pitch': PLT_('[draft] I believed in this before you did.'),
  'pilot.rafe.pitch': PLT_('[draft] Weather? I fly in it.'),
  'pilot.remy.pitch': PLT_('[draft] Give me the hours, I\'ll give you the landings.'),
  'pilot.sky.pitch': PLT_('[draft] Show me the strip. Any strip.'),
  // the eight barks (Block 3), one draft line per moment, shared until the pack writes each pilot's own
  'pilot.bark.hired': PLT_('{name} is on the roster.'),
  'pilot.bark.takeoff': PLT_('{name}: rolling.'),
  'pilot.bark.goodLanding': PLT_('{name}: nice and soft.'),
  'pilot.bark.badLanding': PLT_('{name}: that one bounced.'),
  'pilot.bark.refuse': PLT_('{name} won\'t fly this one.'),
  'pilot.bark.weather': PLT_('{name}: look at that sky.'),
  'pilot.bark.idle': PLT_('{name} is waiting by the aeroplane.'),
  'pilot.bark.longDay': PLT_('{name}: long day.'),
  // THE REFUSALS (GQ30: by trait only), one line per kind; {name} {to} {len} {hour} {wind}
  'pilot.refuse.weather': PLT_('{name} won\'t fly in this wind ({wind} kt).'),
  'pilot.refuse.night': PLT_('{name} won\'t fly a leg that ends in the dark ({hour} h).'),
  'pilot.refuse.short': PLT_('{name} won\'t land on a {len} m strip.'),
  'pilot.refuse.unpaved': PLT_('{name} only flies from paved runways.'),
  'pilot.refuse.water': PLT_('{name} won\'t land on water.'),
  'pilot.refuse.snow': PLT_('{name} won\'t land on snow.'),
  'pilot.refuse.away': PLT_('{name} is at {at}, not with the aeroplane.'),
  'pilot.refuse.boat': PLT_('{name} is at {at}: take the boat home first.'),
  // the traits' chips
  'pilot.trait.mechanic': PLT_('mechanic'), 'pilot.trait.cautious': PLT_('cautious'), 'pilot.trait.night-shy': PLT_('night-shy'),
  'pilot.trait.fearless': PLT_('fearless'), 'pilot.trait.hard-on-airframes': PLT_('hard on airframes'), 'pilot.trait.eager': PLT_('eager'),
  'pilot.trait.short-field': PLT_('short-field'), 'pilot.trait.loves-taildraggers': PLT_('loves taildraggers'),
  'pilot.trait.refuses-nothing': PLT_('refuses nothing'), 'pilot.trait.short-strip-nerves': PLT_('short-strip nerves'),
  'pilot.trait.paved-only': PLT_('paved runways only'), 'pilot.trait.no-water': PLT_('no water'), 'pilot.trait.no-snow': PLT_('no snow'),
  'pilot.trait.mechanic.how': PLT_('field repairs: labour x0.9'), 'pilot.trait.hard-on-airframes.how': PLT_('repair bills x1.1'),
  'pilot.trait.cautious.how': PLT_('refuses strong wind'), 'pilot.trait.night-shy.how': PLT_('refuses legs ending after dusk'),
  'pilot.trait.fearless.how': PLT_('no weather refusals'), 'pilot.trait.eager.how': PLT_('the cheapest sign-on, grows fast'),
  'pilot.trait.short-field.how': PLT_('short-field technique, slips'), 'pilot.trait.loves-taildraggers.how': PLT_('grows on tailwheel types'),
  'pilot.trait.refuses-nothing.how': PLT_('flies anything'),
  'pilot.me': PLT_('I fly'), 'pilot.me.how': PLT_('by hand, or the expert autopilot'),
  'pilot.boat': PLT_('takes the boat home'),
};
const pilotsText = (key, vars, text) => contractText(key, vars, Object.assign({}, PILOTS_TEXT, text || {}));
const pilotsName = id => pilotsText('pilot.' + id + '.name');

const plClone = o => JSON.parse(JSON.stringify(o));
const plNo = (doc, why, extra) => Object.assign({ ok: false, doc, why }, extra || {});
const plHome = doc => (doc && doc.sheds && doc.sheds[PREM_MAIN] && doc.sheds[PREM_MAIN].base) || PREM_MAIN;

// ---- THE PROFILE: base + the pack's knobs (+ growth), clamped -------------------------------------------------------
// The knob -> section map is PILOT_PROFILE_KNOBS' own when PILOT-PERSONA is in the core (train 40); before it, the
// same eleven names in PILOT-ONE's sections (43's pilotProfile reads both shapes).
const PILOTS_KNOB_SEC = { reaction: 'skill', smooth: 'skill', hamFist: 'skill', gain: 'skill', overRotate: 'quirks', flareK: 'quirks',
                          bankK: 'limits', comfortG: 'limits', field: 'technique', slip: 'technique', stepHold: 'technique' };
function pilotsKnobs() {
  if (typeof PILOT_PROFILE_KNOBS !== 'undefined') return PILOT_PROFILE_KNOBS.map(K => ({ k: K.k, sec: K.sec, kind: K.kind, lo: K.lo, hi: K.hi, d: K.d }));
  return Object.keys(PILOTS_KNOB_SEC).map(k => ({ k, sec: PILOTS_KNOB_SEC[k], kind: k === 'field' ? 'pick' : (k === 'slip' || k === 'stepHold') ? 'bool' : 'range',
                                                  d: pilotProfile('expert')[k] }));
}
// the flat knobs (pilotProfile's shape) of the pilot as signed on: the base person, the pack's knobs over it
function pilotsBaseFlat(id) {
  const R = PILOTS_ROSTER[id];
  if (!R) return null;
  const F = Object.assign({}, pilotProfile(R.profile.base));
  for (const k of Object.keys(R.profile.knobs)) F[k] = R.profile.knobs[k];
  return F;
}
// flat -> what makePilot is handed: an OBJECT profile { name, active, skill, quirks, limits, technique }, clamped
// to the knobs by pilotProfile (PILOT-PERSONA) and written back as the knobs that differ from the expert's
// (pilotProfileSpec). Before PILOT-PERSONA: the same object unclamped (the roster is in range: GATE PILOTS proves it
// against PILOT-PERSONA's own clamp).
function pilotsProfile(flat, name) {
  const o = { name: name || 'custom', active: true };
  for (const K of pilotsKnobs()) {
    const v = flat[K.k];
    if (v === undefined) continue;
    if (v === K.d || (K.d == null && v == null) || (K.d === false && !v)) continue;
    (o[K.sec] || (o[K.sec] = {}))[K.k] = v;
  }
  if (typeof pilotProfileSpec === 'function') return Object.assign({ name: o.name, active: true }, pilotProfileSpec(pilotProfile(o)));
  return o;
}

// ---- SKILL GROWTH (§9.4, PILOT-PERSONALITY §4.9): deterministic from the logbook ------------------------------------
// Each logged landing (a flight that stopped on an aerodrome, whole) moves the knobs a step toward the CEILING (a
// PILOT_PROFILES name): f = min(1, landings / PILOTS_GROW[rate]). A numeric knob moves s -> s + (c - s) f, ONLY when
// the ceiling's value is nearer the expert's than the start (a pilot never grows away from the expert: the ceiling
// caps, it never drags back; one on the far side of the expert stops at the expert's); a pick / bool takes the ceiling's at f >= 1/2; a knob a trait fixes never moves; a
// null (comfort g off: no cap) ceiling is reached through the knob's top and becomes null at f = 1. No ceiling: no
// growth. Rounded to 1e-4 so a replay is the same bytes.
function pilotsLandings(rec, R) {
  const on = (R.traits || []).map(t => (PILOTS_TRAITS[t] || {}).growOn).find(Boolean);
  return ((rec && rec.log) || []).filter(r => r && r.landed && (!on || (on === 'tw' && r.tw))).length;
}
function pilotsGrowth(id, landings) {
  const R = PILOTS_ROSTER[id];
  const s = pilotsBaseFlat(id);
  if (!R || !R.grow || !(landings > 0)) return { flat: s, f: 0 };
  const c = pilotProfile(R.grow.ceiling), E = pilotProfile('expert');
  const f = Math.min(1, landings / (PILOTS_GROW[R.grow.rate] || PILOTS_GROW.steady));
  const fixed = new Set([].concat(...(R.traits || []).map(t => (PILOTS_TRAITS[t] || {}).fixes || [])));
  const out = Object.assign({}, s);
  for (const K of pilotsKnobs()) {
    const k = K.k;
    if (fixed.has(k) || !(k in s)) continue;
    if (K.kind === 'range') {
      const top = K.hi != null ? K.hi : (k === 'comfortG' ? 2 : null);
      const num = v => (v == null ? top : v);
      const sv = num(s[k]), ev = num(E[k]);
      let cv = num(c[k]);
      if (sv == null || cv == null || ev == null) continue;
      if ((sv - ev) * (cv - ev) < 0) cv = ev;                                  // a ceiling past the expert: the expert's
      if (!(Math.abs(cv - ev) < Math.abs(sv - ev) - 1e-9)) continue;          // the ceiling must be nearer the expert
      if (f >= 1 && c[k] == null) { out[k] = null; continue; }
      out[k] = Math.round((sv + (cv - sv) * f) * 1e4) / 1e4;
    } else if (f >= 0.5 && c[k] !== s[k]) out[k] = c[k];   // the ceiling's technique (the expert's: the strip decides)
  }
  return { flat: out, f };
}
// the pilot as they fly today (the career's logbook): what makePilot is handed
function pilotsFlatOf(doc, id) {
  const rec = doc && doc.career && doc.career.pilots && doc.career.pilots[id];
  return pilotsGrowth(id, pilotsLandings(rec, PILOTS_ROSTER[id])).flat;
}
function pilotsProfileOf(doc, id) {
  const F = pilotsFlatOf(doc, id);
  return F ? pilotsProfile(F, id) : null;
}

// "FLIES LIKE": the profile in plain words (the card's line; the pack's "fliesLike" replaces it when imported)
function pilotsFliesLike(F) {
  if (!F) return '';
  const w = [];
  w.push(F.reaction <= 0.15 ? 'quick' : F.reaction <= 0.3 ? 'a beat late' : 'slow to react');
  w.push(F.smooth >= 1.3 ? 'snatchy hands' : F.smooth <= 0.85 ? 'gentle hands' : 'steady hands');
  if (F.hamFist >= 0.02) w.push('never still on the stick');
  if (F.overRotate >= 0.02) w.push('over-rotates');
  if (F.flareK <= 0.9) w.push('flares late');
  const t = [];
  if (F.field === 'short') t.push('short fields');
  if (F.field === 'normal') t.push('a normal approach everywhere');
  if (F.slip) t.push('slips every final');
  const l = [];
  l.push(F.bankK >= 1.1 ? 'steep turns' : F.bankK <= 0.9 ? 'shallow turns' : 'normal turns');
  if (F.comfortG != null) l.push('pulls ' + F.comfortG.toFixed(2).replace(/0$/, '') + ' g at most');
  return [w.join(', '), t.join(', '), l.join(', ')].filter(Boolean).join('; ');
}

// ---- THE SIGN-ON (G-COST: one-time, no wages) --------------------------------------------------------------------
function pilotsSignOn(id) {
  if (PILOTS_ROSTER[id] && PILOTS_ROSTER[id].companion) return 0;
  if (typeof econPrice === 'function') { const p = econPrice('signon', id); if (typeof p === 'number' && isFinite(p)) return Math.max(0, Math.round(p)); }
  return PILOTS_SIGNON_STUB[id] || 0;
}

// ---- THE CAREER BLOCK ----------------------------------------------------------------------------------------------
function pilotsBlock(doc) {
  const c = doc.career;
  if (!c.pilots || typeof c.pilots !== 'object' || Array.isArray(c.pilots)) c.pilots = {};
  if (!Array.isArray(c.roster)) c.roster = [];
  c.roster = c.roster.filter((id, i, a) => PILOTS_ROSTER[id] && a.indexOf(id) === i);
  for (const id of Object.keys(c.pilots)) {
    const P = c.pilots[id];
    if (!PILOTS_ROSTER[id] || !P || typeof P !== 'object') { delete c.pilots[id]; continue; }
    if (!Array.isArray(P.log)) P.log = [];
    if (typeof P.aero !== 'string' || !P.aero) P.aero = plHome(doc);
    if (P.plane !== null && typeof P.plane !== 'string') P.plane = null;
  }
  for (const id of c.roster) if (!c.pilots[id]) c.pilots[id] = { hired: 0, fee: 0, aero: plHome(doc), plane: null, log: [] };
  for (const id of Object.keys(c.pilots)) if (!c.roster.includes(id)) c.pilots[id].hired = null;
  if (c.pilotPick !== 'me' && !c.roster.includes(c.pilotPick)) c.pilotPick = c.roster[0] || 'me';
  if (typeof c.pilotN !== 'number' || !isFinite(c.pilotN) || c.pilotN < 0) c.pilotN = 0;
  return doc;
}
// the companion arrives with a new career (careerNew calls this; §9.2 "the first pilot comes with the opening")
function pilotsCompanion(doc) {
  const c = doc.career;
  c.roster = [PILOTS_COMPANION];
  c.pilots = { [PILOTS_COMPANION]: { hired: Math.round(doc.clock || 0), fee: 0, aero: plHome(doc), plane: null, log: [] } };
  c.pilotPick = PILOTS_COMPANION;
  c.pilotN = 0;
  return doc;
}
const pilotsHired = doc => (doc && doc.career && Array.isArray(doc.career.roster)) ? doc.career.roster.filter(id => PILOTS_ROSTER[id]) : [];

// ---- THE MARKET: 2-3 recruitables at a time, refreshed with the job market (contractEpoch) --------------------------
function pilotsOffers(doc) {
  const c = doc && doc.career;
  if (!c) return [];
  const hired = new Set(pilotsHired(doc));
  const pool = PILOTS_ORDER.filter(id => !hired.has(id));
  const epoch = contractEpoch(((c.contracts && c.contracts.done) || []).length);
  const rng = contractRng(String(c.seed) + ':pilots:' + epoch);
  const n = Math.min(pool.length, PILOTS_MARKET.min + Math.floor(rng() * (PILOTS_MARKET.max - PILOTS_MARKET.min + 1)));
  const left = pool.slice(), pick = [];
  while (pick.length < n) pick.push(left.splice(Math.floor(rng() * left.length) % left.length, 1)[0]);
  return PILOTS_ORDER.filter(id => pick.includes(id));
}

// ---- HIRE / FIRE --------------------------------------------------------------------------------------------------
function pilotsHire(doc, id) {
  if (!doc || !doc.career) return plNo(doc, 'not a career');
  if (!PILOTS_ROSTER[id]) return plNo(doc, 'no pilot ' + id);
  if (pilotsHired(doc).includes(id)) return plNo(doc, pilotsName(id) + ' is already on the roster');
  if (!pilotsOffers(doc).includes(id)) return plNo(doc, pilotsName(id) + ' is not looking for work right now');
  const fee = pilotsSignOn(id);
  if (doc.mode === 'career' && (doc.wallet || 0) < fee) return plNo(doc, 'the sign-on is ' + fee + ' credits; the wallet holds ' + Math.round(doc.wallet || 0));
  const d = pilotsBlock(plClone(doc)), c = d.career;
  c.roster.push(id);
  const old = c.pilots[id];
  c.pilots[id] = { hired: Math.round(d.clock || 0), fee, aero: plHome(d), plane: null, log: old ? old.log : [] };
  if (fee) playerCharge(d, fee, 'signon', id);
  return { ok: true, doc: d, fee, why: '' };
}
// firing is free (G-COST); the logbook stays with the row (a re-hire brings their hours back); the next flight's
// pick falls to the roster's first, else "I fly"
function pilotsFire(doc, id) {
  if (!doc || !doc.career) return plNo(doc, 'not a career');
  if (!pilotsHired(doc).includes(id)) return plNo(doc, (PILOTS_ROSTER[id] ? pilotsName(id) : id) + ' is not on the roster');
  const d = pilotsBlock(plClone(doc)), c = d.career;
  c.roster = c.roster.filter(x => x !== id);
  c.pilots[id].hired = null; c.pilots[id].plane = null;
  if (c.pilotPick === id) c.pilotPick = c.roster[0] || 'me';
  return { ok: true, doc: d, why: '' };
}
function pilotsPick(doc, id) {
  if (!doc || !doc.career) return plNo(doc, 'not a career');
  if (id !== 'me' && !pilotsHired(doc).includes(id)) return plNo(doc, id + ' is not on the roster');
  const d = plClone(doc);
  d.career.pilotPick = id;
  return { ok: true, doc: d, why: '' };
}
const pilotsPicked = doc => {
  const c = doc && doc.career;
  if (!c) return 'me';
  return c.pilotPick === 'me' ? 'me' : (pilotsHired(doc).includes(c.pilotPick) ? c.pilotPick : (pilotsHired(doc)[0] || 'me'));
};

// ---- PILOTS ARE PHYSICAL (GQ14) ------------------------------------------------------------------------------------
// A pilot is where their last aeroplane is: with `plane` set, the fleet ledger's place of that aeroplane (it follows
// it: "bring it home" brings them too); else where they were left (`aero`). -> aerodrome id
function pilotsPlace(doc, id) {
  const P = doc && doc.career && doc.career.pilots && doc.career.pilots[id];
  if (!P) return plHome(doc);
  if (P.plane && doc.fleet && doc.fleet[P.plane]) { const W = playerWhere(doc, P.plane); if (W.aero) return W.aero; }
  return P.aero || plHome(doc);
}
// "TAKES THE BOAT HOME": free, to HOME, between flights (never while flying: the page offers it on the ground only)
function pilotsBoatHome(doc, id) {
  if (!pilotsHired(doc).includes(id)) return plNo(doc, id + ' is not on the roster');
  const home = plHome(doc);
  if (pilotsPlace(doc, id) === home) return plNo(doc, pilotsName(id) + ' is already at ' + home);
  const d = plClone(doc), P = d.career.pilots[id];
  P.aero = home; P.plane = null;
  return { ok: true, doc: d, why: '' };
}

// ---- REFUSALS (GQ30: by trait only) ----------------------------------------------------------------------------------
// leg: { to: CONTRACT_FIELDS row (len, surf, alti) | id, from?: row | id, gear: stripGear's word, windKt?, endHour?,
//        duskH?, dawnH? (G2665: the day's almanac), night?: true + nightHour? (G2665: the leg is a night job's window) }
// -> null (flies it) | { kind, trait, key, vars, why }. In the pilot's trait order; 'refuses-nothing' keeps every
// one; 'fearless' keeps the weather. An unknown wind or hour refuses nothing (the decision needs the fact).
function pilotsRefusal(id, leg) {
  const R = PILOTS_ROSTER[id];
  if (!R || !leg) return null;
  const T = R.traits.map(t => PILOTS_TRAITS[t] || {});
  if (T.some(t => t.keeps === '*')) return null;
  const kept = new Set([].concat(...T.map(t => Array.isArray(t.keeps) ? t.keeps : [])));
  const F = x => (typeof x === 'string' ? (CONTRACT_FIELDS[x] || null) : x) || null;
  const to = F(leg.to), from = F(leg.from), gear = leg.gear || 'wheels';
  const ends = [to, from].filter(Boolean);
  const name = pilotsName(id);
  const fires = {
    weather: () => typeof leg.windKt === 'number' && leg.windKt > PILOTS_WEATHER.windKt ? { wind: Math.round(leg.windKt) } : null,
    // (G2665 NIGHT-OPS) the night is the almanac's when the leg carries it (07b dayDuskDawnH: duskH / dawnH), else the
    // constants; the hour wraps midnight (a leg ending at 01:00 ends in the night); `night: true` - the leg is a night
    // job's (its window: the tracked contract asks for a night arrival), refused whatever the hour now
    night: () => {
      const dusk = typeof leg.duskH === 'number' ? leg.duskH : CONTRACT_DUSK_H, dawn = typeof leg.dawnH === 'number' ? leg.dawnH : CONTRACT_DAWN_H;
      if (leg.night === true) return { hour: typeof leg.nightHour === 'number' ? (((leg.nightHour % 24) + 24) % 24).toFixed(1) : dusk.toFixed(1) };
      if (typeof leg.endHour !== 'number' || !isFinite(leg.endHour)) return null;
      const h = ((leg.endHour % 24) + 24) % 24;
      return h >= dusk || h < dawn ? { hour: h.toFixed(1) } : null;
    },
    short: () => { const s = ends.find(e => e.surf !== 'water' && e.len > 0 && e.len < PILOTS_SHORT_M); return s ? { len: s.len, to: s.name } : null; },
    unpaved: () => { const s = ends.find(e => e.surf !== 'water' && !PILOTS_PAVED.includes(e.surf)); return s ? { to: s.name } : null; },
    water: () => (gear === 'floats' || gear === 'amphibian' || ends.some(e => e.surf === 'water')) ? {} : null,
    snow: () => (gear === 'skis' || ends.some(e => e.alti || e.surf === 'snow')) ? {} : null,
  };
  for (let i = 0; i < R.traits.length; i++) {
    const k = T[i].refuse;
    if (!k || kept.has(k)) continue;
    const v = fires[k]();
    if (v) {
      const vars = Object.assign({ name }, v);
      return { kind: k, trait: R.traits[i], key: 'pilot.refuse.' + k, vars, why: pilotsText('pilot.refuse.' + k, vars) };
    }
  }
  return null;
}
// can THIS pilot fly THIS aeroplane now? The refusals, then the place: the pilot must be where the aeroplane is
// (`at`: its aerodrome; the page passes playerRollFrom's). Away from it: refused, and when the aeroplane is at HOME
// the boat brings them (`boat: true`). "I fly" ('me') is never refused.
function pilotsCanFly(doc, id, at, leg) {
  if (id === 'me') return { ok: true, why: '' };
  if (!pilotsHired(doc).includes(id)) return { ok: false, kind: 'roster', why: id + ' is not on the roster' };
  const r = pilotsRefusal(id, leg);
  if (r) return { ok: false, kind: r.kind, trait: r.trait, key: r.key, vars: r.vars, why: r.why };
  const here = pilotsPlace(doc, id);
  if (at && here !== at) {
    const boat = at === plHome(doc);
    const F = CONTRACT_FIELDS[here];
    const vars = { name: pilotsName(id), at: F ? F.name : here };
    const key = boat ? 'pilot.refuse.boat' : 'pilot.refuse.away';
    return { ok: false, kind: 'away', key, vars, boat, why: pilotsText(key, vars) };
  }
  return { ok: true, why: '' };
}

// ---- THE FLIGHT'S END: the logbook, the place, growth ---------------------------------------------------------------
// f: { pilot: id | 'me', slot, from, to, landed (stopped on an aerodrome, whole), tw (a tailwheel type), t (s) }.
// Call it AFTER the fleet ledger moved the aeroplane (playerArrive): the flyer goes WITH the aeroplane (plane = slot,
// aero = where it now stands); anyone else who was with that aeroplane stays where it left from. An unsaved build
// (no slot): the flyer is left at the stop, or at the field it left from.
function pilotsOnFlightEnd(doc, f) {
  if (!doc || !doc.career || !f) return plNo(doc, 'not a career');
  const d = pilotsBlock(plClone(doc)), c = d.career;
  const who = f.pilot && f.pilot !== 'me' && c.roster.includes(f.pilot) ? f.pilot : null;
  const fromAero = f.from || null;
  if (f.slot) for (const id of c.roster) {
    const P = c.pilots[id];
    if (id !== who && P.plane === f.slot) { P.aero = fromAero || pilotsPlace(doc, id); P.plane = null; }
  }
  if (!who) return { ok: true, doc: d, why: '', logged: null };
  const P = c.pilots[who];
  const row = { n: ++c.pilotN, at: Math.round(d.clock || 0), slot: f.slot || null, from: f.from || null, to: f.to || null,
                landed: !!f.landed, tw: !!f.tw, t: Math.max(0, Math.round(+f.t || 0)) };
  P.log.push(row);
  if (f.slot && d.fleet && d.fleet[f.slot]) { P.plane = f.slot; P.aero = playerWhere(d, f.slot).aero || P.aero; }
  else { P.plane = null; P.aero = (f.landed && f.to) || f.from || P.aero; }
  return { ok: true, doc: d, why: '', logged: row };
}

// ---- THE TRAITS' MONEY HOOKS: the repair bill (DMG-D5's labour lines x playerLabourFactor) --------------------------
// -> { labour, bill }: the factors for a repair on `slot`, from the pilot WITH it (pilots.plane). The mechanic's
// labour counts in the field only (no hangar of yours around the aeroplane: playerWhere kind 'out' / 'away').
function pilotsRepairK(doc, slot) {
  const out = { labour: 1, bill: 1, pilot: null };
  const c = doc && doc.career;
  if (!c || !slot) return out;
  const id = pilotsHired(doc).find(x => c.pilots[x] && c.pilots[x].plane === slot);
  if (!id) return out;
  out.pilot = id;
  const field = playerWhere(doc, slot).kind !== 'in';
  for (const t of PILOTS_ROSTER[id].traits) {
    const T = PILOTS_TRAITS[t] || {};
    if (T.labourK && field) out.labour *= T.labourK;
    if (T.billK) out.bill *= T.billK;
  }
  return out;
}

// ---- THE CARD (the Pilots tab's model; text resolved, nothing the DOM computes) ------------------------------------
function pilotsCard(doc, id, world) {
  const R = PILOTS_ROSTER[id];
  if (!R) return null;
  const hired = pilotsHired(doc).includes(id);
  const rec = doc && doc.career && doc.career.pilots && doc.career.pilots[id];
  const landings = pilotsLandings(rec, R);
  const G = pilotsGrowth(id, landings);
  const at = hired ? pilotsPlace(doc, id) : null;
  const L = (world && world.aerodromes) || [];
  const atRow = at ? (L.find(a => a.id === at) || CONTRACT_FIELDS[at] || null) : null;
  const name = pilotsName(id);
  const initials = name.split(/\s+/).map(s => s[0] || '').join('').slice(0, 2).toUpperCase();
  return {
    id, who: R.who, name, initials, portrait: R.portrait || null, companion: !!R.companion,
    tagline: pilotsText('pilot.' + id + '.tagline'), bio: pilotsText('pilot.' + id + '.bio'), pitch: pilotsText('pilot.' + id + '.pitch'),
    fliesLike: (PILOTS_TEXT['pilot.' + id + '.flies'] && !PILOTS_TEXT['pilot.' + id + '.flies'].draft) ? pilotsText('pilot.' + id + '.flies') : pilotsFliesLike(G.flat),
    style: R.style,
    traits: R.traits.map(t => ({ id: t, label: pilotsText('pilot.trait.' + t), how: PILOTS_TEXT['pilot.trait.' + t + '.how'] ? pilotsText('pilot.trait.' + t + '.how') : '' })),
    signOn: pilotsSignOn(id), hired, onOffer: !hired && pilotsOffers(doc).includes(id),
    at, atName: atRow ? (atRow.name || at) : null, atXZ: atRow ? [atRow.c ? atRow.c[0] : atRow.x, atRow.c ? atRow.c[1] : atRow.z] : null,
    plane: rec && hired ? rec.plane || null : null,
    flights: rec ? rec.log.length : 0, landings, grown: Math.round(G.f * 100), ceiling: R.grow ? R.grow.ceiling : null,
    picked: pilotsPicked(doc) === id,
  };
}

// ---- THE IMPORT (Block 5's "pilots"): the user's AI run over the draft keys; ids must be the roster's ---------------
function pilotsImportPack(pack, text) {
  const T = plClone(text || PILOTS_TEXT), why = [];
  const put = (k, s) => { if (typeof s === 'string' && s) T[k] = { t: s, draft: false }; };
  for (const p of ((pack && pack.pilots) || [])) {
    if (!p || !PILOTS_ROSTER[p.id]) { why.push('no pilot ' + (p && p.id)); continue; }
    const b = 'pilot.' + p.id + '.';
    put(b + 'name', p.name); put(b + 'tagline', p.tagline); put(b + 'bio', p.backstory); put(b + 'voice', p.voice);
    put(b + 'flies', p.fliesLike); put(b + 'pitch', p.pitch);
    for (const k of Object.keys(p.barks || {})) put(b + 'bark.' + k, p.barks[k]);
  }
  return { ok: !why.length, text: T, why };
}
// ===========================================================================
// FREIGHT-LOAD (G2345-G2349) — THE FITTING INTERFACE'S PURE HALF: THE PLAYER'S HAND ON THE PACKER'S PROPOSAL.
// futureDesigns/game/FREIGHT-2026-10-07.md §2 and §4 (RULED by the user, 7 Oct): no loading time, no crew, no load
// failure - but THE FITTING INTERFACE. The packer proposes (76_freight.js freightPack); the player may move an item,
// leave it on the ground, turn it, take an EMPTY seat out or put it back ("if the load fits, nobody cares whether a
// seat is there"), and ask for the packer's answer again. The report is freightReport's, live. Out of range (the
// CG, the MTOW, a floor) is REPORTED, NEVER REFUSED: the aeroplane flies what you loaded.
//
// WHAT IS REFUSED is only what is physically impossible (each refusal says why):
//   the door     an item no door of this aeroplane takes never goes aboard (freightDoorAny)
//   the hold     a box stands inside the hold's clear section at every station it spans (freightHoldFits), on the
//                highest thing under it: the floor, or WHOLLY on one stackable item (the packer's own rule - an
//                overhang or a bridge does not stand); nothing on a drum or a stretcher
//   the room     clear of the seats still in, the occupants and the other items
//   the stack    an item carrying another is not pulled from under it (move the top one first)
//   the seats    the pilot's seat and an occupied seat stay in; a seat goes back only where nothing stands
// THE SNAP: an item's fore end on the hold's stations and their middles (FREIGHT_PACK.step, the packer's grid built
// on card.hold.dx), across on FREIGHT_PACK.zStep; a drop near a wall slides off it to the clear section (the room at
// that height), a drop on a stackable item stays wholly on it.
//
// THE SESSION (a plain object, the view's state; nothing here mutates its inputs):
//   { v, card: id, pax, seatsOut: [i], items: [freightItem] (the whole load, bulk split), placed: [row] }
//   a row is freightPack's placed row: { id, kind, kg, dims, stack, at: {x0..z1}, on, door, how, space }
//   the items not placed are ON THE GROUND (freightLoadAshore)
// ACCEPT (freightLoadRecord / freightLoadAccept) writes THE PLACEMENT into the career document (`career.load`):
// the items aboard with their boxes, the seats out, the passengers, the contract / stage / sub it was loaded for and
// the airframe's slot and design. CAREER-WIRE's stop (careerStopRecord's `items`) reads it - the load is the items,
// not a typed number - and FREIGHT-STRAP (G2400) reads `freightAccepted(doc)`: every item's box and centre in the
// card's frame (the gen frame: x m aft of the windscreen-base ring, y up, z to the right - the frame def.nodes are
// built in) and its kilos, which become the point masses and the strapped props.
//
// Pure: no DOM, storage, clock or random (GATE FREIGHT scans for each). Reads 76_freight.js, 74_ / 75_.
// ===========================================================================

const FREIGHT_LOAD_V = 1;
const flR3 = v => Math.round(v * 1000) / 1000;
const flClone = o => JSON.parse(JSON.stringify(o));
const flNo = (why, extra) => Object.assign({ ok: false, why }, extra || {});
const flBox = r => ({ x0: r.at.x0, x1: r.at.x1, y0: r.at.y0, y1: r.at.y1, z0: r.at.z0, z1: r.at.z1 });
const flOverXZ = (p, q) => p.x0 < q.x1 - 1e-6 && q.x0 < p.x1 - 1e-6 && p.z0 < q.z1 - 1e-6 && q.z0 < p.z1 - 1e-6;
const flSameDims = (a, b) => Math.abs(a[0] - b[0]) < 1e-6 && Math.abs(a[1] - b[1]) < 1e-6 && Math.abs(a[2] - b[2]) < 1e-6;
// the seats the player may take out: empty ones (never the pilot's, never a passenger's)
function flSeatsOutOk(card, pax, out) {
  const ok = new Set(((card && card.seats) || []).filter(s => s.i > 0 && s.i > pax).map(s => s.i));
  return [...new Set((out || []).map(v => v | 0))].filter(i => ok.has(i)).sort((a, b) => a - b);
}

// ---- THE SESSION ---------------------------------------------------------------------------------------------
// freightLoadNew(card, items, { pax, seatsOut }) -> the session, the packer's proposal placed
function freightLoadNew(card, items, opts) {
  const o = opts || {}, pax = Math.max(0, o.pax | 0);
  const its = freightSplit(items || []);
  const seatsOut = flSeatsOutOk(card, pax, o.seatsOut);
  const P = freightPack(card, its, { pax, seatsOut });
  return { v: FREIGHT_LOAD_V, card: (card && card.id) || null, pax, seatsOut, items: its, placed: P.placed };
}
// "Propose again": the packer's answer for the load, the passengers and the seats as they are now
function freightLoadPropose(card, st) {
  return freightLoadNew(card, st.items, { pax: st.pax, seatsOut: st.seatsOut });
}
// the items on the ground (not aboard), each with why the packer left it (no door / no room) when it did
function freightLoadAshore(card, st) {
  const on = new Set(st.placed.map(p => p.id));
  return st.items.filter(it => !on.has(it.id)).map(it => {
    const d = card && card.hold ? freightDoorAny(card, it) : { ok: false, why: 'this aeroplane has no hold' };
    return Object.assign({}, it, { door: !!d.ok, why: d.ok ? '' : (d.why || it.id + ' passes no door') });
  });
}
// THE REPORT: freightReport's own (the parity GATE FREIGHT holds), plus what stays on the ground
function freightLoadReport(card, st) {
  const R = freightReport(card, st.placed, { pax: st.pax, seatsOut: st.seatsOut });
  const ash = freightLoadAshore(card, st);
  return Object.assign(R, { ashore: ash.map(a => a.id), ashoreKg: freightKg(ash), aboard: st.placed.length, items: st.items.length });
}

// ---- THE HAND: where an item would go, and why not ------------------------------------------------------------
// freightLoadTarget(card, st, id, want) -> { ok, row, why }
//   want: { x, z } the item's middle the pointer asks for (card frame, m), turn: true for a quarter turn about the
//   vertical from its present orientation (or the kind's first, from the ground)
function freightLoadTarget(card, st, id, want) {
  const H = card && card.hold;
  if (!H) return flNo('this aeroplane has no hold');
  const it = st.items.find(q => q.id === id);
  if (!it) return flNo('no item ' + id);
  const door = freightDoorAny(card, it);
  if (!door.ok) return flNo(it.id + ' (' + it.dims.join(' x ') + ' m) passes no door of this aeroplane', { door: false });
  const cur = st.placed.find(p => p.id === id);
  const atop = st.placed.filter(p => p.on === id);
  if (atop.length) return flNo(atop.map(p => p.id).join(', ') + ' is on it: move that first');
  let L = cur ? [flR3(cur.at.x1 - cur.at.x0), flR3(cur.at.y1 - cur.at.y0), flR3(cur.at.z1 - cur.at.z0)] : frOrients(it)[0];
  if (want && want.turn) L = [L[2], L[1], L[0]];
  if (!frOrients(it).some(o => flSameDims(o, L))) return flNo(it.id + ' does not lie that way');   // (a turn keeps the height: always one of the kind's)
  const [lx, ly, lz] = L, P = FREIGHT_PACK, xHi = H.x0 + H.n * H.dx;
  if (lx > xHi - H.x0 + 1e-9) return flNo(it.id + ' is longer than the hold');
  const wx = want && isFinite(want.x) ? +want.x : 0.5 * (H.x0 + xHi), wz = want && isFinite(want.z) ? +want.z : 0;
  // THE SNAP: the fore end on the packer's grid (the stations and their middles), inside the hold's length
  let x0 = H.x0 + Math.round((wx - lx / 2 - H.x0) / P.step) * P.step;
  x0 = flR3(Math.max(H.x0, Math.min(x0, H.x0 + Math.floor((xHi - lx - H.x0) / P.step + 1e-9) * P.step)));
  const x1 = flR3(x0 + lx);
  let z0 = flR3(Math.round((wz - lz / 2) / P.zStep) * P.zStep);
  const others = st.placed.filter(p => p.id !== id);
  // WHAT IT RESTS ON: the highest thing under its footprint - the floor, or the top of an item
  const floorY = freightRestY(card, x0, x1);
  if (floorY == null) return flNo('off the hold');
  const fp = { x0, x1, z0, z1: z0 + lz };
  const under = others.filter(p => flOverXZ(fp, p.at));
  let y0 = floorY, sup = null;
  const top = under.reduce((m, p) => Math.max(m, p.at.y1), -Infinity);
  if (top > floorY + 1e-6) {
    // on the item under its middle (the largest overlap): wholly on it, so the footprint slides onto it
    const ov = p => Math.max(0, Math.min(fp.x1, p.at.x1) - Math.max(fp.x0, p.at.x0)) * Math.max(0, Math.min(fp.z1, p.at.z1) - Math.max(fp.z0, p.at.z0));
    sup = under.filter(p => p.at.y1 > top - 1e-6).sort((a, b) => ov(b) - ov(a))[0];
    if (!sup.stack) return flNo('nothing goes on the ' + sup.id + ' (' + sup.kind + ')');
    if (lx > sup.at.x1 - sup.at.x0 + 1e-6 || lz > sup.at.z1 - sup.at.z0 + 1e-6) return flNo(it.id + ' is bigger than the ' + sup.id + ' under it: it would not stand');
    if (fp.x0 < sup.at.x0 - 1e-9 || fp.x1 > sup.at.x1 + 1e-9) return flNo(it.id + ' overhangs the ' + sup.id + ': it would not stand');
    z0 = flR3(Math.max(sup.at.z0, Math.min(z0, sup.at.z1 - lz)));
    y0 = sup.at.y1;
  }
  const y1 = flR3(y0 + ly);
  // THE HOLD'S WALLS at that height: off the wall to the clear section
  const zm = frZMax(card, x0, x1, y0, y1);
  if (zm < 0) return flNo('no room for ' + it.id + ' there: the hold closes above it');
  if (zm < lz / 2 - 1e-8) return flNo('no room for ' + it.id + ' there: ' + (zm < 0.05 ? 'the roof is too low' : 'the hold is ' + Math.round(200 * zm) + ' cm wide at that height'));
  z0 = flR3(Math.max(-zm, Math.min(z0, zm - lz)));
  if (sup && (z0 < sup.at.z0 - 1e-9 || z0 + lz > sup.at.z1 + 1e-9)) return flNo('the ' + sup.id + ' is against the wall there: ' + it.id + ' would not stand on it');
  const at = { x0, x1, y0: flR3(y0), y1, z0, z1: flR3(z0 + lz) };
  if (!freightHoldFits(card, at)) return flNo('no room for ' + it.id + ' there');
  // CLEAR OF THE SEATS STILL IN, THE OCCUPANTS AND THE OTHER ITEMS
  const ob = freightObstacles(card, freightSeats(card, st)).find(q => frOverlap(at, q));
  if (ob) return flNo(/^occupant/.test(ob.id) ? (ob.seat === 0 ? 'the pilot is there' : 'the passenger in seat ' + ob.seat + ' is there') : 'seat ' + ob.seat + ' is there (an empty seat can be taken out)');
  const hit = others.find(q => frOverlap(at, q.at));
  if (hit) return flNo('the ' + hit.id + ' is there');
  const spaces = freightSpaces(card);
  return { ok: true, why: '', row: { id: it.id, kind: it.kind, kg: it.kg, dims: it.dims, stack: it.stack && FREIGHT_KINDS[it.kind].stack,
                                     at, on: sup ? sup.id : null, door: door.door, how: door.how,
                                     space: frSpaceOf(spaces, 0.5 * (at.x0 + at.x1)) } };
}
// the move itself -> { ok, st, row, why } (the session unchanged on a refusal)
function freightLoadMove(card, st, id, want) {
  const t = freightLoadTarget(card, st, id, want);
  if (!t.ok) return Object.assign({ st }, t);
  const placed = st.placed.filter(p => p.id !== id).concat([t.row]);
  return { ok: true, why: '', row: t.row, st: Object.assign({}, st, { placed }) };
}
// LEFT ON THE GROUND: an item taken out of the aeroplane (refused only from under another)
function freightLoadUnload(card, st, id) {
  if (!st.placed.some(p => p.id === id)) return { ok: true, why: '', st };
  const atop = st.placed.filter(p => p.on === id);
  if (atop.length) return { ok: false, why: atop.map(p => p.id).join(', ') + ' is on it: move that first', st };
  return { ok: true, why: '', st: Object.assign({}, st, { placed: st.placed.filter(p => p.id !== id) }) };
}
// A SEAT OUT / IN (ruled: the player chooses; only an empty seat goes, and it goes back only where nothing stands)
function freightLoadSeat(card, st, i, out) {
  const s = ((card && card.seats) || []).find(q => q.i === (i | 0));
  if (!s) return { ok: false, why: 'no seat ' + i, st };
  const isOut = st.seatsOut.includes(s.i), want = out == null ? !isOut : !!out;
  if (want === isOut) return { ok: true, why: '', st };
  if (want) {
    if (s.i === 0) return { ok: false, why: 'the pilot\'s seat stays', st };
    if (s.i <= st.pax) return { ok: false, why: 'a passenger sits in seat ' + s.i, st };
    return { ok: true, why: '', st: Object.assign({}, st, { seatsOut: flSeatsOutOk(card, st.pax, st.seatsOut.concat([s.i])) }) };
  }
  const back = Object.assign({}, st, { seatsOut: st.seatsOut.filter(v => v !== s.i) });
  const ob = freightObstacles(card, freightSeats(card, back)).filter(q => q.seat === s.i);
  const hit = st.placed.find(p => ob.some(q => frOverlap(p.at, q)));
  if (hit) return { ok: false, why: 'the ' + hit.id + ' stands where seat ' + s.i + ' goes: move it first', st };
  return { ok: true, why: '', st: back };
}

// ---- ACCEPT: THE PLACEMENT INTO THE CAREER'S RECORD ------------------------------------------------------------
// freightLoadRecord(card, st, ctx) -> the accepted load: ctx { slot, contract, stage, sub } (the airframe and the
// job's open sub it was loaded for). The items aboard keep their boxes; the ones left on the ground are named.
function freightLoadRecord(card, st, ctx) {
  const c = ctx || {}, R = freightLoadReport(card, st);
  const ash = freightLoadAshore(card, st);
  return {
    v: FREIGHT_LOAD_V, slot: c.slot != null ? String(c.slot) : null, design: (card && card.id) || st.card || null,
    contract: c.contract || null, stage: c.stage != null ? c.stage | 0 : null, sub: c.sub != null ? c.sub | 0 : null,
    pax: st.pax, seatsOut: st.seatsOut.slice(),
    items: st.placed.map(p => ({ id: p.id, kind: p.kind, kg: p.kg, dims: p.dims.slice(), at: Object.assign({}, p.at), on: p.on || null, space: p.space || null })),
    ashore: ash.map(a => ({ id: a.id, kind: a.kind, kg: a.kg, dims: a.dims.slice() })),
    kg: R.cargoKg, mass: R.mass.kg, cg: { x: R.cg.x, pct: R.cg.pct }, ok: R.ok, why: R.why.slice(),
  };
}
// -> { ok, doc, rec, why }: the career document with `career.load` = the record (a copy; the input untouched)
function freightLoadAccept(doc, card, st, ctx) {
  if (!doc || !doc.career) return { ok: false, doc, rec: null, why: 'not a career' };
  const rec = freightLoadRecord(card, st, ctx);
  const d = flClone(doc);
  d.career.load = rec;
  return { ok: true, doc: d, rec, why: '' };
}
// THE ACCEPTED LOAD, AS FREIGHT-STRAP READS IT: a career document (or the record itself, the sandbox's) ->
// { slot, design, contract, stage, sub, pax, seatsOut, items: [{ id, kind, kg, dims, at, c: [x, y, z], on, space }],
//   ashore, kg, cg, ok } or null. `c` is the box's centre in the card's frame (the gen frame of def.nodes).
function freightAccepted(doc) {
  const r = doc && (doc.career ? doc.career.load : (Array.isArray(doc.items) && doc.v ? doc : null));
  if (!r || typeof r !== 'object' || !Array.isArray(r.items)) return null;
  const out = flClone(r);
  out.items = out.items.filter(p => p && p.at && isFinite(p.kg)).map(p =>
    Object.assign(p, { c: [flR3(0.5 * (p.at.x0 + p.at.x1)), flR3(0.5 * (p.at.y0 + p.at.y1)), flR3(0.5 * (p.at.z0 + p.at.z1))] }));
  out.kg = freightKg(out.items);
  if (!Array.isArray(out.ashore)) out.ashore = [];
  if (!Array.isArray(out.seatsOut)) out.seatsOut = [];
  return out;
}
// the session again from an accepted record (the view reopened on the same job): the items aboard where they were,
// the rest on the ground
function freightLoadFromRecord(card, rec) {
  const items = freightSplit((rec.items || []).concat(rec.ashore || []));
  const pax = Math.max(0, rec.pax | 0), spaces = freightSpaces(card);
  const placed = (rec.items || []).map(p => {
    const it = items.find(q => q.id === p.id) || freightItem(p);
    const d = freightDoorAny(card, it);
    return { id: it.id, kind: it.kind, kg: it.kg, dims: it.dims, stack: it.stack && FREIGHT_KINDS[it.kind].stack, at: Object.assign({}, p.at),
             on: p.on || null, door: d.door, how: d.how, space: frSpaceOf(spaces, 0.5 * (p.at.x0 + p.at.x1)) };
  });
  return { v: FREIGHT_LOAD_V, card: card.id, pax, seatsOut: flSeatsOutOk(card, pax, rec.seatsOut), items, placed };
}

// ---- THE CAREER'S SIDE --------------------------------------------------------------------------------------------
// the airframe's card: the career's airframe row (PROCURE's design), else a build envelope's factory row (a model
// taken in the sandbox), else null (a player's own build: its hold is not measured - FREIGHT-MODEL's open point)
function freightLoadCard(doc, slot, env) {
  const A = doc && doc.career && doc.career.airframes && slot != null ? doc.career.airframes[slot] : null;
  const id = (A && A.design) || (env && env.log && env.log.factory && env.log.factory.design) || null;
  return (id && typeof FREIGHT_CARDS !== 'undefined' && FREIGHT_CARDS[id]) || null;
}
// what the loading view opens on in the career: the tracked contract's current stage's load -> { items, pax, ctx,
// rec (the accepted placement for this very sub and airframe, to reopen on), why }
function freightLoadJob(doc, slot) {
  const L = typeof careerTrackedLoad === 'function' ? careerTrackedLoad(doc) : null;
  if (!L) return { items: [], pax: 0, ctx: null, rec: null, why: 'no tracked contract with a load: open the MAP' };
  const C = doc.career.contracts, live = C.live[C.tracked] || { stage: 0 };
  const ctx = { slot: slot != null ? String(slot) : null, contract: C.tracked, stage: live.stage | 0, sub: L.sub };
  const r = doc.career.load;
  const same = r && r.contract === ctx.contract && r.stage === ctx.stage && r.sub === ctx.sub && r.slot === ctx.slot;
  return { items: L.items || [], pax: L.pax || 0, kg: L.kg || 0, ctx, rec: same ? r : null,
           why: (L.items && L.items.length) ? '' : (L.pax ? 'passengers only: they board, they don\'t fit' : 'no items in this load') };
}
// the stop record's items: the accepted load when it rides THIS airframe (else null: the typed kilos, the fallback)
function freightStopItems(doc, slot) {
  const A = freightAccepted(doc);
  if (!A || (slot != null && A.slot != null && A.slot !== String(slot))) return null;
  return A.items.map(p => ({ id: p.id, kind: p.kind, kg: p.kg, dims: p.dims }));
}
// after a stop: the accepted load leaves the record once the sub it was loaded for is done (delivered), its contract
// is no longer accepted or its stage has moved on -> the document (a copy when it changes)
function freightLoadSettle(doc) {
  const r = doc && doc.career && doc.career.load;
  if (!r) return doc;
  const C = doc.career.contracts, L = C && C.live && C.live[r.contract];
  const open = C && C.accepted.includes(r.contract) && L && (L.stage | 0) === r.stage && !(L.subs && L.subs[r.sub]);
  if (open) return doc;
  const d = flClone(doc);
  delete d.career.load;
  return d;
}

//# sourceURL=career_core.js
