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
const CONTRACT_FIELDS = {
  HOME:     { id: 'HOME',     name: 'Jolene AFB 13/31',         x: -301,  z: 221,    len: 2325, surf: 'concrete' },
  w2:       { id: 'w2',       name: 'Jolene AFB 02/20',         x: 584,   z: -94,    len: 1835, surf: 'concrete' },
  w3:       { id: 'w3',       name: 'Tamgas Hill Strip',        x: -800,  z: -2400,  len: 520,  surf: 'gravel' },
  SEA:      { id: 'SEA',      name: 'Annette Dock',             x: 361,   z: -3661,  len: 1500, surf: 'water' },
  mk_sea:   { id: 'mk_sea',   name: 'Metlakatla Seaplane Base', x: -3980, z: -9420,  len: 1500, surf: 'water' },
  mn_strip: { id: 'mn_strip', name: 'Jumbo Mine Street',        x: 7250,  z: -15429, len: 250,  surf: 'gravel' },
  nv_strip: { id: 'nv_strip', name: 'East Point Clearing',      x: 10030, z: -11660, len: 150,  surf: 'gravel' },
  tw_ski:   { id: 'tw_ski',   name: 'Skyline Altiport',         x: 257,   z: -7707,  len: 380,  surf: 'grass', alti: true },
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
