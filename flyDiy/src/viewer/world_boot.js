// world_boot.js - THE WORLD THE BOOT COMPOSES, IN A TASK OF ITS OWN (G999, A5-LOAD, the Jolene playtest's R4)
//
// app.js made the world during its own evaluation: the premises record (the saved copy or the island's fixture),
// the town switch, the island, makeWorld - 0.6-0.8 s of Jolene inside the garage boot's longest task (the island
// loader's promote: app.js's evaluation, 1.3-2.2 s). The composition lives here, moved verbatim, as one function;
// the promote (build.js) runs it in a task of its own right before app.js's and keeps what it made on
// window.FLYDIY_WORLD_MADE, which app.js takes (and clears). Anywhere nothing ran it first (dev.html, a harness),
// app.js calls FLYDIY_WORLD_COMPOSE itself, at the same point as before.
window.FLYDIY_WORLD_COMPOSE = function () {
  'use strict';
  // THE PREMISES (G386): the world editor's saved record composes into the world at boot -
  // localStorage flydiy.premises.game (what the WORLD rail saves), or ?premises=<name> for a
  // fixture from tools/fixtures (a test's door; read synchronously because the world is made
  // here, during the script's own evaluation)
  // THE WIP KEY IS THE MAP'S (G434): an island's saved premises must never compose onto the analytic
  // world (nor Skarvik's edits onto the island) now that the GRAPHICS menu swaps maps
  const WIP_KEY = 'flydiy.premises.game' + ((typeof window !== 'undefined' && window.ISLAND_BOOT) ? '.' + window.ISLAND_BOOT.id : '');
  const premisesAtBoot = (() => {
    try {
      const q = new URLSearchParams(location.search).get('premises');
      if (q) { const x = new XMLHttpRequest(); x.open('GET', 'tools/fixtures/premises_v1_' + q + '.json', false); x.send(); if (x.status === 200) return x.responseText; }
      if (q === 'none') return null;
      const saved = localStorage.getItem(WIP_KEY);
      // an island brings its own premises: tools/fixtures/island_<island>.json (its own prefix: GATE
      // PREMISES composes every premises_v1_* fixture on the ANALYTIC world). G401: Jolene's old field.
      // A saved copy (the WORLD rail's WIP) wins unless it is the SAME premises at an older `rev`
      // (G404: a stale first version had shadowed the field)
      let fixture = null;
      if (window.ISLAND_BOOT) {
        if (typeof window.ISLAND_BOOT.premFixture === 'string') fixture = window.ISLAND_BOOT.premFixture;   // G998: the loader fetched it with the island
        else { const x = new XMLHttpRequest(); x.open('GET', 'tools/fixtures/island_' + window.ISLAND_BOOT.id + '.json', false); x.send(); if (x.status === 200) fixture = x.responseText; }
      }
      // THE OFFICIAL PREMISES OF THE ANALYTIC WORLD (G398.3, the user: "a new airport somewhere, with
      // scenery ... that should impact the real game, and become a new official airport"): Skarvik,
      // authored in the editor, shipped as a fixture and composed at every boot; its strip is an
      // aerodrome of the world, so it is a destination like any other
      else { const x = new XMLHttpRequest(); x.open('GET', 'tools/fixtures/premises_v1_official.json', false); x.send(); if (x.status === 200) fixture = x.responseText; }
      if (saved && fixture) {
        try { const S = JSON.parse(saved), F = JSON.parse(fixture); const sp = S.premises || S, fp = F.premises || F;
          if (sp.id === fp.id && (sp.rev || 0) < (fp.rev || 0)) { localStorage.removeItem(WIP_KEY); return fixture; } } catch (e) {}
      }
      return saved || fixture;
    } catch (e) { return null; }
  })();
  // THE TOWN SWITCH (G590, the 2026-09-26 playtest): Metlakatla (every `mk_` entry of the record) held the Jolene
  // taxi at 12-15 fps, so it is OFF unless the GRAPHICS 'town' row says 'all' or the URL ?town=1 - dropped at load,
  // code and data kept; the editor's autosave puts the cut back (below), so a save made with it off keeps it
  const TOWN = (() => {
    const T = { all: false, off: ['mk_'], cut: null, n: 0 };
    try { const q = new URLSearchParams(location.search).get('town'); const g = window.GFX && window.GFX.get ? window.GFX.get() : null;
      // G1526 (POTATO-DEEP): the row under the build budget's cap - potato / laptop / the software rung never build Metlakatla
      T.all = q !== null ? (q === '1' || q === 'all') : (window.GFX && window.GFX.townAll ? window.GFX.townAll() : !!(g && g.town === 'all')); } catch (e) {}
    return T;
  })();
  let premisesPlaced = (() => {
    if (TOWN.all || !premisesAtBoot || typeof PREMISES_GEN === 'undefined') return premisesAtBoot;
    try { const U = PREMISES_GEN.unwrap(premisesAtBoot), D = PREMISES_GEN.dropPlaces(U.rec, TOWN.off);
      if (!D.n) return premisesAtBoot;
      TOWN.cut = D.cut; TOWN.n = D.n;
      return PREMISES_GEN.envelope(U.name, D.rec, U.plaque, U.log); } catch (e) { return premisesAtBoot; }
  })();
  if (typeof window !== 'undefined') window.FLYDIY_TOWN = TOWN;
  // THE STAGES (G2300 STAGES, contract v1.33; 76_stages.js, 27_premises.js stageView): the buildings the career's
  // missions put up. THE SANDBOX stands every track at its max - the record's stageView(null), which is today's island
  // byte for byte (the kits and the construction looks are below the max; GATE STAGES holds it against the island
  // cook's hash). THE DEV CAREER (?career=1, CAREER-WIRE) stands its document's tracks, read here off the same key app.js
  // keeps it under (careerKey('dev')) - a first load (no document yet) is careerNew's: every track 0. The staged record is
  // what the world, the physics worker and the house worker compose (premisesPlaced below); the whole one stays for the
  // roll-out's recompose when a stage advances (app.js 'stages' trip step) and for the editor's save (stageRestore)
  const STAGE = (() => {
    const S = { tracks: null, key: 'sandbox', view: null, text: null };
    try {
      if (!premisesPlaced || typeof PREMISES_GEN === 'undefined' || !PREMISES_GEN.stageView || typeof stageKey !== 'function') return S;
      if (/[?&]career=1(&|$)/.test(location.search || '') && typeof careerKey === 'function' && typeof stageTracksOf === 'function') {
        let doc = null; try { doc = JSON.parse(localStorage.getItem(careerKey('dev')) || 'null'); } catch (e) {}
        S.tracks = stageTracksOf(doc) || stageTracksOf({ career: { tracks: {} } });
        // the stills' door (tools/stages_shot.js): ?stages=field:1,minedock:3 composes those values over the document's,
        // for this load only (nothing is written; with ?career=1 alone)
        const m = /[?&]stages=([\w:,]+)/.exec(location.search || '');
        if (m) for (const kv of m[1].split(',')) { const q = /^(\w+):(\d+)$/.exec(kv); if (q && q[1] in S.tracks) S.tracks[q[1]] = +q[2]; }
      }
      const U = PREMISES_GEN.unwrap(premisesPlaced);
      S.view = PREMISES_GEN.stageView(U.rec, S.tracks); S.key = stageKey(S.tracks); S.name = U.name; S.plaque = U.plaque; S.log = U.log;
      if (S.view.staged) S.text = PREMISES_GEN.envelope(U.name, S.view.rec, U.plaque, U.log);
    } catch (e) { console.warn('stages: the record is composed whole -', e && e.message); }
    return S;
  })();
  if (typeof window !== 'undefined') window.FLYDIY_STAGE = STAGE;
  const premisesWhole = premisesPlaced;
  premisesPlaced = STAGE.text || premisesPlaced;
  // (G1430, TOWN-COOK) the island loader fetched the raster cells of the variant IT read (build.js FLYDIY_TOWN_VARIANT, this
  // rule before GFX was in): a disagreement is a cook refused (lazy bakes), never a wrong ground - said, not hidden
  try { const v = window.FLYDIY_TOWN_VARIANT; if (v && v !== (TOWN.all ? 'town' : 'default')) console.warn('flyDiy: the loader fetched the ' + v + ' raster cells, the page composes ' + (TOWN.all ? 'town' : 'default') + ' - those cells bake lazily'); } catch (e) {}
  // THE GENERATORS ONLY SOME PLACES NAME (AS1, G909): _sport_gen.js and _marine_gen.js load on demand (build.js
  // MANIFEST.lazy) - asked for here when the placed record names a sport/ or marine/ key (Metlakatla's: the town on),
  // long before the roll-out composes the places (render_world's premises step waits for them)
  // G1190 (METLA-RETURN): both read window.HOUSE_KIT at load, and on index.html this line runs in the promote's composition
  // task, before the world pack's external tags (tools/_house_kit.js among them) are appended - asked for now they ran
  // first and threw ("Cannot destructure property 'clamp' of 'K'"). So they are asked for once HOUSE_KIT is in: at
  // once when it is (dev.html), else from the load event of the script that brings it (a script's load fires right
  // after it runs; the generators are then queued behind the pack's remaining tags, long before the roll-out)
  try { if (typeof premisesPlaced === 'string' && window.FLYDIY_LAZY && /"(sport|marine)\//.test(premisesPlaced)) {
    const gens = () => window.FLYDIY_LAZY(['_sport_gen', '_marine_gen']);
    if (window.HOUSE_KIT) gens();
    else { const kit = () => { if (!window.HOUSE_KIT) return; document.removeEventListener('load', kit, true); gens(); };
      document.addEventListener('load', kit, true); }
  } } catch (e) {}
  // THE ISLAND (W2): the loader fetched the data world's files when ?world= named one
  // G999: the island loader's promote decoded it in a task of its own (window.ISLAND_MADE, build.js) - taken when it is
  // this boot's island, decoded here otherwise (dev.html, a harness)
  const islandAtBoot = (typeof window !== 'undefined' && window.ISLAND_BOOT && typeof ISLAND_GEN !== 'undefined')
    ? ((window.ISLAND_MADE && window.ISLAND_MADE.boot === window.ISLAND_BOOT && window.ISLAND_MADE.island) || ISLAND_GEN.makeIsland(window.ISLAND_BOOT)) : null;
  if (typeof window !== 'undefined') window.ISLAND_MADE = null;   // the decode's arrays are the world's from here
  // THE BOOT OBJECT KEEPS ONLY WHAT IS READ AFTER THE DECODE (AS1, G906): the two quadtrees' varint payloads and
  // topologies (22.2 + 9.8 MB gunzipped) are the decoded trees now (world.island.root / farRoot), and the premises
  // fixture's text is the record composed below. The grids stay: they ARE the island's (the same arrays), read by
  // the core and the viewer for the session. The physics worker fetches its own boot (sim_host.js simHostFetchBoot).
  if (islandAtBoot) { const B = window.ISLAND_BOOT; B.topo = B.payload = null; if (B.far) B.far.topo = B.far.payload = null; B.premFixture = null; }
  const world = makeWorld(0, { premises: premisesPlaced, island: islandAtBoot });
  // THE HOUSES' OWN THREAD (G830, src/viewer/house_worker.js): it makes this same world from the same premises text and
  // the island's own files - its ~5 s beside the garage's boot - so the town step finds it ready to generate
  try { if (window.HOUSE_WORKER && premisesPlaced && window.ISLAND_BOOT) window.HOUSE_WORKER.start({ premises: premisesPlaced, island: window.ISLAND_BOOT.id }); } catch (e) { console.warn('house worker:', e && e.message); }
  // THE TREES THIS MAP CAN REACH (AS1, G908: trees.js treeReachOf): the composed world (the premises' ttype stamps
  // in, the town filter applied) says which species can stand; every tree fetch after this line (the garage's, the
  // roll-out's) asks for those alone. The analytic world answers null: the whole pack, as before
  try { if (typeof treeReach === 'function' && typeof treeReachOf === 'function') treeReach(treeReachOf(world)); } catch (e) { console.warn('trees: the reach', e); }
  return { WIP_KEY, premisesAtBoot, TOWN, STAGE, premisesWhole, premisesPlaced, islandAtBoot, world };
};
