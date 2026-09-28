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
      T.all = q !== null ? (q === '1' || q === 'all') : !!(g && g.town === 'all'); } catch (e) {}
    return T;
  })();
  const premisesPlaced = (() => {
    if (TOWN.all || !premisesAtBoot || typeof PREMISES_GEN === 'undefined') return premisesAtBoot;
    try { const U = PREMISES_GEN.unwrap(premisesAtBoot), D = PREMISES_GEN.dropPlaces(U.rec, TOWN.off);
      if (!D.n) return premisesAtBoot;
      TOWN.cut = D.cut; TOWN.n = D.n;
      return PREMISES_GEN.envelope(U.name, D.rec, U.plaque, U.log); } catch (e) { return premisesAtBoot; }
  })();
  if (typeof window !== 'undefined') window.FLYDIY_TOWN = TOWN;
  // THE GENERATORS ONLY SOME PLACES NAME (AS1, G909): _sport_gen.js and _marine_gen.js load on demand (build.js
  // MANIFEST.lazy) - asked for here when the placed record names a sport/ or marine/ key (Metlakatla's: the town on),
  // long before the roll-out composes the places (render_world's premises step waits for them)
  try { if (typeof premisesPlaced === 'string' && window.FLYDIY_LAZY && /"(sport|marine)\//.test(premisesPlaced)) window.FLYDIY_LAZY(['_sport_gen', '_marine_gen']); } catch (e) {}
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
  // THE TREES THIS MAP CAN REACH (AS1, G908: trees.js treeReachOf): the composed world (the premises' ttype stamps
  // in, the town filter applied) says which species can stand; every tree fetch after this line (the garage's, the
  // roll-out's) asks for those alone. The analytic world answers null: the whole pack, as before
  try { if (typeof treeReach === 'function' && typeof treeReachOf === 'function') treeReach(treeReachOf(world)); } catch (e) { console.warn('trees: the reach', e); }
  return { WIP_KEY, premisesAtBoot, TOWN, premisesPlaced, islandAtBoot, world };
};
