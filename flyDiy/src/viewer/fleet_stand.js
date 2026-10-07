// fleet_stand.js - G2225 FLEET-STAND (FLEET-PROPS B; GAME-2026-10-06 §4.1): THE FLEET STOOD ON THE APRONS.
//
// FLEET-PROPS A made a saved airframe a prop (parked.js: baked in the garage on save, decoded at the roll-out, the draw
// rules) and the tie-down spots (25_airfield.js fleetSpots); PREM-S2 made the ledger say where each one stands. Nothing
// stood them. This does, and only this:
//   WHO   the airframes tied down OUTSIDE (no hangar: playerWhere 'out' / 'away') at the aerodrome the roll-out starts
//         from, but the airframe being flown (its prop hides: the live aeroplane is it), at most the draw cap of them
//         (PARKED.fleetCap: 6, 4 on a light preset) - THE DRAWN SET. Every other row (another aerodrome, past the cap) is
//         counted in `held`, never stood and never baked (the game coordinator's bound: a 40-build sandbox bakes at most
//         the cap, once). Residents inside a hangar are not drawn here (a closed shed costs nothing, §4.4; the side
//         hangars' open doors are PREM-S3's, the main hangar's slots WORKS-COZY's).
//   WHERE that aerodrome's spots IN ORDER (the planner's: the painted stands, then the apron ring, then the rows), the
//         rows taken by slot name, the flown one's spot left empty - the same fleet always stands the same way, and
//         rolling one out never moves the others. The planner needs every solid thing round the field (the taxi
//         census's set, which the page does not hold), so it runs offline: the spots are src/viewer/fleet_spots_pack.js
//         (tools/fleet_spots.js --cook; GATE TAXICLEAR 10 holds it to a fresh census). A row past its aerodrome's
//         spots, or on a world the pack is not for, stands nothing (counted in `miss`).
//   HOW   PARKED.place('mine:<slot>') - parked.js's fleet door: decoded from the garage's bake, never captured here; an
//         unbaked one leaves its spot EMPTY (no placeholder) and is queued for the garage. The fleet ladder (L1 inside
//         30 m, L3 alone on a light preset) and the count (the nearest 6; 4 on a light preset). On the light presets
//         this stands them although GFX.budget().parked is false: the agreed exception (GQ9).
//   WHEN  the roll-out (app.js 'parking' step, under the roll-out screen, the boot's included): the set changes at
//         roll-out / roll-in only. The same set at the next roll-out keeps its holders.
//   THE QUEUE'S BOUND: wants(key) - parked.js fleetQueue bakes only a key of the drawn set as it is now, the airframe on
//         the stand counted in it (app.js hands the context: setCtx), so at most the cap is ever baked and a save of an
//         airframe that would not be drawn queues nothing.
// BEHIND FLYDIY_FLEET (parked.js fleetOn: ?fleet=1 or window.FLYDIY_FLEET = true): with it off nothing is stood and
// the step's key and work are what they were. ?fleetn=N stands the first N of the drawn set (the perf rig's 0 / 3 / 6).
(function () {
  'use strict';
  const W = window;
  const ST = { grp: null, key: null, holders: [], plan: null, limit: null, ctx: null,
               stats: { stands: 0, placed: 0, kept: 0, miss: 0, held: 0, waitMs: 0 } };
  try { const q = /[?&]fleetn=(\d+)(?:&|$)/.exec((W.location && W.location.search) || ''); if (q) ST.limit = +q[1]; } catch (e) {}
  const on = () => !!(W.PARKED && typeof W.PARKED.fleetOn === 'function' && W.PARKED.fleetOn());
  const capNow = () => (W.PARKED && typeof W.PARKED.fleetCap === 'function' ? W.PARKED.fleetCap() : 6);

  // THE ROWS (pure): the airframes tied down outside at an aerodrome, by slot name - the one flown among them (it keeps
  // its spot, left empty while it flies: rolling one out never moves the others)
  function rows(doc) {
    const F = (doc && doc.fleet) || {};
    return Object.keys(F).sort().filter(n => F[n] && !F[n].hangar && F[n].aero).map(n => ({ slot: n, aero: F[n].aero }));
  }
  // THE PLAN (pure): every outside row on its aerodrome's next spot (the flown one's spot kept, empty). THE DRAWN SET: the
  // rows at `from` (every aerodrome when from is null), the first `cap` of them by slot name - the flown one among them
  // takes its place in the count and stands nothing (so the set to BAKE, plan(doc, null, ..), is the drawn set plus the
  // airframe on the stand: at most `cap`, whatever is flown) - and of the stood at most `limit` (?fleetn)
  // -> { stand: [{ slot, key, aero, x, z, ry, spot }], held: [{ slot, aero, why }], miss: [{ slot, aero, why }] }
  function plan(doc, flown, pack, island, limit, from, cap) {
    const stand = [], held = [], miss = [], used = {};
    const A = pack && island && pack.island === island ? pack.aero : null;
    const C = cap != null ? cap : Infinity;
    let n = 0;
    for (const r of rows(doc)) {
      const L = A && A[r.aero], i = used[r.aero] || 0;
      if (!L || i >= L.length) { if (r.slot !== flown) miss.push({ slot: r.slot, aero: r.aero, why: !A ? 'no spots for this world' : !L || !L.length ? 'no spots at ' + r.aero : 'every spot at ' + r.aero + ' taken' }); continue; }
      used[r.aero] = i + 1;
      if (from && r.aero !== from) { if (r.slot !== flown) held.push({ slot: r.slot, aero: r.aero, why: "not the roll-out's aerodrome" }); continue; }
      if (n >= C) { if (r.slot !== flown) held.push({ slot: r.slot, aero: r.aero, why: 'past the draw cap' }); continue; }
      n++;
      if (r.slot === flown) continue;
      const s = L[i];
      stand.push({ slot: r.slot, key: 'mine:' + r.slot, aero: r.aero, x: s[0], z: s[1], ry: s[2], spot: s[3] });
    }
    if (limit != null) for (const p of stand.slice(limit)) held.push({ slot: p.slot, aero: p.aero, why: 'past ?fleetn' });
    return { stand: limit != null ? stand.slice(0, limit) : stand, held, miss };
  }
  const islandOf = world => (world && world.island && world.island.id) || null;
  const keyOf = (P, island) => (island || '-') + '|' + P.stand.map(p => p.slot + '@' + p.spot).join(',');
  const planOf = c => plan(c.doc, c.flown, W.FLEET_SPOTS_PACK, islandOf(c.world), ST.limit, c.from || null, c.cap != null ? c.cap : capNow());
  // the 'parking' step's key: what would stand (nothing with the flag off - the step's key is then what it was)
  function key(c) {
    if (!on() || !c) return '';
    return keyOf(planOf(c), islandOf(c.world));
  }
  // THE QUEUE'S BOUND: is `key` in the drawn set as it is now? (no context handed: yes - the gates' headless module)
  function wants(k) {
    const c = ST.ctx ? (() => { try { return ST.ctx(); } catch (e) { return null; } })() : null;
    if (!c) return true;
    return planOf(Object.assign({}, c, { flown: null })).stand.some(p => p.key === k);   // the airframe on the stand is baked too (a prop once another is loaded)
  }
  function clear() {
    // the holders leave their group first: a decode landing later fills nothing (parked.js fillPending) and the
    // count forgets their levels (fleetDrawn keeps a level whose holder still hangs in the scene)
    if (ST.grp) { for (const h of ST.holders) ST.grp.remove(h); if (ST.grp.parent) ST.grp.parent.remove(ST.grp); }
    ST.grp = null; ST.key = null; ST.holders = [];
  }
  // stand the set: c = { THREE, scene, world, doc, flown, from, cap } -> a promise once every prop decoded (or refused),
  // at most `waitMs` (the roll-out screen never waits on a stuck store)
  function stand(c) {
    if (!on() || !c || !c.scene || !c.world || !W.PARKED || !W.PARKED.place) { clear(); return Promise.resolve(null); }
    const isl = islandOf(c.world);
    const P = ST.plan = planOf(c);
    ST.stats.miss = P.miss.length; ST.stats.held = P.held.length;
    const k = keyOf(P, isl);
    if (k === ST.key && ST.grp && ST.grp.parent === c.scene) { ST.stats.kept++; return loads(P, c.waitMs); }
    clear();
    ST.key = k; ST.stats.stands++;
    const g = ST.grp = new c.THREE.Group();
    g.name = 'fleetStand';
    c.scene.add(g);
    for (const p of P.stand) {
      let y = c.world.terrainH(p.x, p.z);
      if (typeof c.world.waterH === 'function') { const w = c.world.waterH(p.x, p.z); if (Number.isFinite(w) && w > y) y = w; }
      const h = W.PARKED.place(c.THREE, p.key, p.x, y, p.z, p.ry);
      h.userData.fleetSlot = p.slot;
      g.add(h);
      ST.holders.push(h);
      ST.stats.placed++;
    }
    return loads(P, c.waitMs);
  }
  function loads(P, waitMs) {
    const t0 = performance.now();
    const L = P.stand.map(p => (W.PARKED.fleetLoad ? W.PARKED.fleetLoad(p.key) : Promise.resolve(null)));
    const cap = new Promise(res => setTimeout(res, waitMs || 10000));
    return Promise.race([Promise.all(L), cap]).then(() => { ST.stats.waitMs = Math.round(performance.now() - t0); return P; });
  }
  W.FLEET_STAND = { on, rows, plan, key, wants, stand, clear, state: ST,
                    // app.js hands the game's context (the world, the player's document, the airframe on the stand, the
                    // roll-out's aerodrome, the cap): ctx() -> { world, doc, flown, from, cap }
                    setCtx: f => { ST.ctx = f; } };
})();
