// ============================================================
// THE POSITIONAL EMITTERS' NUMBERS (G1660, SND-AMB-2; SOUND-2026-10-04 §6.3 / §5 / §2.4).
// PURE: no Web Audio, no DOM - runs in node; GATE AUDIO (EMIT*) and the evidence (tools/audio/emitters_render.js) drive
// it on the synthetic island and on the real Jolene.
//
// WHAT CALLS, WHERE, WHEN, around the LISTENER (the camera). The ambience's features are READ, not re-sampled: the bed
// mixer's state (AMBIENCE_MODEL: the cover shares, the coast's signed distance and its shore point, the lake, the
// village / harbour zones, the sun, the height above the ground) is handed in as `amb`.
//
//   NATURE    random one-shots placed in the world: crows and eagles in nearby trees (the island's canopy raster; the
//             analytic world's forest surface), gulls over the shore (the ambience's shore point, seaward) and the
//             harbour's water, loons on a lake at dawn and dusk (declared: no recording ships yet), the owl at night in
//             the forest. SPECIES below: a habitat x an hour (the sun's elevation, DAY_CLOCK's) -> a weight; a call is
//             a Poisson event at weight / mean seconds; never the same species twice within its gap; each call a
//             random pitch +-1.5 semitones and gain +-2 dB (the source applies them).
//   OBJECTS   each world object's generator DECLARES its sound (DECLARED below - the premises rule: the record names
//             a generator, never an asset): the village's zones a dog (rare: the user, "don't abuse this, here and
//             there") and a door; the road traffic (scenery_life / render_premises' proto traffic) a pickup's pass
//             bound to the car that passes, with the doppler; the cable link (tram_run.js's jig-back) a rope hum loop
//             per cabin, a cabin creak while it runs and a bell at the station when a cabin leaves or docks; the
//             Kennecott mill (HOUSE_GEN's P.mill) a rumble loop; the house piers' boats (HOUSE_GEN's pier.boats, each
//             with its outboard) an outboard idling now and then. Positions: the movers (cabins, cars, boats) from a
//             PROVIDER read every frame (prov.objects(out) - render_premises' read-only soundObjects in the page, a
//             simulation in node);
//             the static anchors (the mill) from the premises record, once per record.
//   THE CEILING  everything fades from 60 m AGL and is silent above 150 m (the beds' rule: ground level and low flight).
//   THE CAP   at most `cap` one-shots sounding at once (gamer 6, potato 3: TIERS), `loops` local loops (3 / 2).
//   NOTHING NEAR, NOTHING DONE  no habitat and no object within reach -> no voice, no load, no buffer, no param.
//
// emittersState(tier) -> st;  emittersStep(st, P, amb, world, prov, dt) -> the number of new one-shots this frame.
// THE VOICES (st.v*): a slot per sounding one-shot (kind, species / sound, position, follow, gain, rate, the time it
//   ends); vNew[i] = 1 for the source to start. THE LOOPS (st.l*): a slot per local loop (sound, position, the gain
//   target, the rate). st.want[k] = 1 while a sample key could be called (the source loads it; released when 0 for
//   long). st.n* counters (fires per sound, the cap's refusals) for the gate and the evidence; st.log (null in the
//   page) receives [t, sound, x, y, z, d] rows when a harness sets an array.
// Allocation-free per frame (GATE AUDIO EMITALLOC); a new world or premises record re-reads its anchors once (rare).
// ============================================================
var EMITTERS_MODEL = (function () {
  'use strict';
  const G = typeof globalThis !== 'undefined' ? globalThis : {};
  const AM = G.AMBIENCE_MODEL || (typeof AMBIENCE_MODEL !== 'undefined' ? AMBIENCE_MODEL : null) ||
             (typeof require === 'function' ? require('./ambience_model.js') : null);
  const F = AM ? AM.F : null;

  const CEIL_LO = 60, CEIL = 150;          // the AGL fade (m): full below 60, silent from 150
  const MOVER_DT = 0.1;                    // the movers' velocity is smoothed over this (s); they are read every frame
  const MAXOBJ = 192;                      // rows the provider may write (6 a row)
  const TIERS = {
    full: { cap: 6, loops: 3, budget: 8 * 1048576 },
    mid: { cap: 4, loops: 2, budget: 5 * 1048576 },
    light: { cap: 3, loops: 2, budget: 3 * 1048576 },
  };
  const NV = 6, NL = 3;                    // the slots (the tier's cap and loops are at most these)

  // THE SOUNDS: [name, sample key (null: procedural), kind (0 one-shot, 1 loop), level dB, ref distance m, seconds]
  // (the seconds: the catalogue's longest variant - a node harness's stand-in; the source uses the buffer's own)
  const SOUNDS = [
    ['crow', 'bird.crow', 0, -6, 12, 0.39], ['eagle', 'bird.eagle', 0, -4, 25, 4.91], ['gull', 'bird.gull', 0, -6, 15, 6.01],
    ['owl', 'bird.owl', 0, -8, 15, 4.39], ['loon', 'bird.loon', 0, -10, 40, 4],
    ['dog', 'dog', 0, -2, 20, 6.01], ['door', 'mech.door', 0, -8, 8, 0.46],
    ['pickup', 'vehicle.pickup', 0, -3, 10, 6.01], ['creak', 'mech.creak', 0, -12, 6, 3.14], ['bell', null, 0, -10, 20, 3.2],
    ['tramhum', null, 1, -12, 18, 0], ['mill', null, 1, -6, 30, 0], ['boat', null, 1, -10, 12, 0],
  ];
  const NS = SOUNDS.length;
  const S = {}; SOUNDS.forEach((s, i) => { S[s[0]] = i; });

  // THE SPECIES and the village's sounds (the random ones): [sound, mean s between calls at weight 1, the gap s (never
  // the same sooner), place, dMin, dMax, series (calls in a burst: a crow's caws), habitat]
  //   habitat: 'woods' crows (the forest, the village's edge, a little in the open), 'coast' eagles (near the sea, in
  //   the trees), 'shore' gulls (the shore, the harbour), 'night' owls (the forest at night), 'lake' loons (on and near
  //   a lake at dawn and dusk), 'village' the dog and the door (a village zone or built cover, by day)
  //   place: 'tree' a tree within dMin..dMax (else the call is not made - an owl does not hoot from a field), 'treeOr'
  //   a tree or a roof / a pole (6 m), 'soar' a tree or the sky over the ground (40-80 m up), 'sea' over the water
  //   seaward of the shore point, 'lake' on a lake, 'yard' a point in the village (a yard, a street)
  const SPECIES = [
    [S.crow, 28, 9, 'treeOr', 20, 90, 3, 'woods'],
    [S.eagle, 110, 55, 'soar', 50, 220, 1, 'coast'],
    [S.gull, 18, 8, 'sea', 15, 140, 1, 'shore'],
    [S.owl, 55, 35, 'tree', 35, 150, 1, 'night'],
    [S.loon, 45, 30, 'lake', 40, 400, 1, 'lake'],
    // THE DOG: the user's "here and there" - a call at most every 150 s, ~one in 5 minutes inside a village by day
    [S.dog, 300, 150, 'yard', 30, 120, 1, 'village'],
    [S.door, 200, 90, 'yard', 12, 60, 1, 'village'],
  ];
  const NSP = SPECIES.length;
  const HAB = { woods: 0, coast: 1, shore: 2, night: 3, lake: 4, village: 5 };
  const PLACE = { tree: 0, treeOr: 1, soar: 2, sea: 3, lake: 4, yard: 5 };
  const SPT = new Float64Array(NSP * 8);
  SPECIES.forEach((r, i) => { const o = i * 8; SPT[o] = r[0]; SPT[o + 1] = r[1]; SPT[o + 2] = r[2]; SPT[o + 3] = PLACE[r[3]]; SPT[o + 4] = r[4]; SPT[o + 5] = r[5]; SPT[o + 6] = r[6]; SPT[o + 7] = HAB[r[7]]; });

  // THE OBJECTS' rules (the declarations' numbers)
  const PASS = { reach: 140, tLo: 2.4, tHi: 3.6, dCpa: 40, vMin: 3, gap: 10 };     // a pickup's pass: the CPA 2.4-3.6 s ahead, within 40 m
  const TRAM = { reach: 320, bellReach: 600, creakReach: 160, creakMean: 9, creakGap: 4, vMax: 6 };
  const MILL = { reach: 380 };
  const BOAT = { reach: 160, mean: 160, gap: 90, tMin: 12, tMax: 32 };
  // THE DECLARATIONS (the premises rule: each generator owns its sound; a generator that carries its own `SOUND` table
  // - window.<GEN>.SOUND = { <trait or preset>: <sound> } - is read first; until the generators carry them, this is
  // where the sound of each kind of object is declared, keyed by what the GENERATOR says, never by a record's asset)
  const DECLARED = [
    { gen: 'HOUSE_GEN', trait: 'mill', sound: 'mill', what: 'a preset with P.mill (the Kennecott mill): its rumble' },
    { link: 'cable', sound: 'tramhum', what: 'a cable link run by tram_run.js: the rope hum per cabin, the creak, the station bell' },
    { traffic: 'road', sound: 'pickup', what: 'a road with traffic (render_premises proto traffic / SCENERY_LIFE.trafficOf): a pass bound to the car' },
    { zone: 'residential,commercial,park,industrial', sound: 'dog,door', what: 'a village zone: a dog (rare), a door' },
    { gen: 'HOUSE_GEN', trait: 'pier.boats', sound: 'boat', what: 'a house pier\'s boats (each with its outboard): an outboard idling now and then' },
  ];
  const KIND_TRAM = 1, KIND_CAR = 2, KIND_BOAT = 3;

  const sat = x => (x < 0 ? 0 : x > 1 ? 1 : x);

  function emittersState(tier) {
    const T = TIERS[tier] || TIERS.full;
    const st = {
      tier: TIERS[tier] ? tier : 'full', cap: T.cap, loops: T.loops, budget: T.budget,
      clk: new Float64Array(8),            // 0 time (s), 1 -, 2 agl k, 3 the frame's dt, 4 frames, 5 objects near, 6 the mill's hours, 7 day
      rng: new Uint32Array([0x9e3779b9]),
      w: new Float64Array(NSP),            // the species' weights now (habitat x hour x height)
      last: new Float64Array(NS).fill(-1e9),   // the last time each sound was made
      want: new Uint8Array(NS), wantT: new Float64Array(NS),   // a key wanted (the source loads it), since when unwanted
      ready: new Uint8Array(NS),           // the source says: the key is decoded (a node harness sets them all)
      dur: new Float64Array(NS),
      // THE VOICES
      vOn: new Uint8Array(NV), vNew: new Uint8Array(NV), vS: new Int16Array(NV), vF: new Int16Array(NV).fill(-1),
      vX: new Float64Array(NV), vY: new Float64Array(NV), vZ: new Float64Array(NV), vVx: new Float64Array(NV), vVy: new Float64Array(NV), vVz: new Float64Array(NV),
      vT0: new Float64Array(NV), vT1: new Float64Array(NV), vG: new Float64Array(NV), vR: new Float64Array(NV), vD: new Float64Array(NV),
      // THE LOOPS
      lOn: new Uint8Array(NL), lS: new Int16Array(NL).fill(-1), lF: new Int16Array(NL).fill(-1),
      lX: new Float64Array(NL), lY: new Float64Array(NL), lZ: new Float64Array(NL), lG: new Float64Array(NL), lR: new Float64Array(NL),
      lT0: new Float64Array(NL), lT1: new Float64Array(NL),
      // THE MOVERS: the provider's rows now and before (6 a row: kind, x, y, z, a, b), their velocity
      obj: new Float64Array(MAXOBJ * 6), objP: new Float64Array(MAXOBJ * 6), nObj: new Int32Array(2),
      vel: new Float64Array(MAXOBJ * 3), moving: new Uint8Array(MAXOBJ), boatNear: new Int32Array(1),
      // THE ANCHORS (static: the mill), from the record
      anc: new Float64Array(0), ancS: new Int16Array(0), wref: null, prem: null,
      // the listener: position, smoothed velocity
      L: new Float64Array(8),
      tmp: new Float64Array(8), pos: new Float64Array(4),
      n: new Float64Array(NS), refused: new Float64Array(2), queries: new Float64Array(1),
      log: null,
    };
    SOUNDS.forEach((s, i) => { st.dur[i] = s[5] > 0 ? s[5] : 2; });
    return st;
  }
  // the seeded random (xorshift32): one call site per use keeps it cheap; a value in [0, 1)
  function rnd(st) {
    const r = st.rng; let x = r[0];
    x ^= x << 13; x >>>= 0; x ^= x >>> 17; x ^= x << 5; x >>>= 0;
    r[0] = x;
    return x / 4294967296;
  }
  function seed(st, s) { st.rng[0] = (s >>> 0) || 1; }

  // ---- THE ANCHORS: the static objects that sound, read once per world / premises record ---------------------------
  // the mill: the record's site items whose generator preset says P.mill (the page's HOUSE_GEN; a harness hands `gens`)
  function prepAnchors(st, world, gens) {
    st.wref = world;
    const pm = world && world.premises, rec = pm ? pm.rec : null, ov = pm ? pm.overlay : null;
    st.prem = rec || null;
    const out = [];
    const PGN = G.PREMISES_GEN || (typeof PREMISES_GEN !== 'undefined' ? PREMISES_GEN : null);
    const HG = (gens && gens.HOUSE_GEN) || G.HOUSE_GEN || null;
    const F0 = ov && ov.frame && typeof ov.frame.toWorld === 'function' ? ov.frame : null;
    const sites = rec && rec.layers && Array.isArray(rec.layers.sites) ? rec.layers.sites : [];
    for (const s of sites) for (const it of s.items || []) {
      const key = String(it.key || ''), sl = key.indexOf('/');
      const ns = key.slice(0, sl), preset = key.slice(sl + 1);
      let sound = -1;
      // the generator's own declaration first (window.<GEN>.SOUND), then DECLARED's traits
      const own = HG && HG.SOUND && ns === 'house' ? HG.SOUND[preset] : null;
      if (own && S[own] != null) sound = S[own];
      else if (ns === 'house' && HG && HG.PRESETS && HG.PRESETS[preset] && HG.PRESETS[preset].mill) sound = S.mill;
      if (sound < 0) continue;
      const a = s.at || { x: 0, z: 0, yaw: 0 }, c = Math.cos(a.yaw || 0), sn = Math.sin(a.yaw || 0);
      const lx = +it.x || 0, lz = +it.z || 0;
      const px = PGN && PGN.siteFrame ? PGN.siteFrame(s).toLocal(lx, lz) : [a.x + lx * c + lz * sn, a.z - lx * sn + lz * c];
      const w = F0 ? F0.toWorld(px[0], px[1]) : px;
      let y = world && typeof world.terrainH === 'function' ? +world.terrainH(w[0], w[1]) : 0;
      if (!(y === y)) y = 0;
      out.push([+w[0], y + 8, +w[1], sound]);
    }
    st.anc = new Float64Array(out.length * 3); st.ancS = new Int16Array(out.length);
    out.forEach((r, i) => { st.anc[3 * i] = r[0]; st.anc[3 * i + 1] = r[1]; st.anc[3 * i + 2] = r[2]; st.ancS[i] = r[3]; });
  }

  // ---- THE HABITATS: the species' weights from the ambience's features (each 0..1) -------------------------------------
  // (every clamp written out: a helper called with a double V8 did not inline boxes it - this runs every frame)
  function weights(st, f) {
    const sun = f[F.sun], ak = st.clk[2];
    let q;
    q = (sun + 6) / 6; const day = q < 0 ? 0 : q > 1 ? 1 : q;
    q = (-5 - sun) / 5; const night = q < 0 ? 0 : q > 1 ? 1 : q;
    const tw = 1 - Math.abs(sun + 3) / 9, twi = tw < 0 ? 0 : tw;
    q = f[F.tree] * 1.6; const forest = q > 1 ? 1 : q;
    const vil = f[F.village];
    q = f[F.built] * 1.2; const built = q > 1 ? 1 : q;
    q = f[F.grass] + f[F.shrub] + f[F.bare]; const open = q > 1 ? 1 : q;
    const c = f[F.coast], ac = c < 0 ? -c : c, lake = f[F.lake];
    q = (ac - 60) / 240; const shore = 1 - (q < 0 ? 0 : q > 1 ? 1 : q);
    const town = vil > built ? vil : built;
    const w = st.w;
    q = (sun + 6) / 4; st.clk[6] = q < 0 ? 0 : q > 1 ? 1 : q; st.clk[7] = day;
    // crows: the woods, the village, a little in the open
    w[0] = day * (0.15 + 0.85 * (forest > town ? forest : town) + 0.15 * open) * ak;
    // eagles: by the sea (inland within ~1 km, in the trees, or the shore)
    q = 1 - (c > 0 ? c : 0) / 1000;
    w[1] = day * (q < 0 ? 0 : q) * (0.35 + 0.65 * (forest > shore ? forest : shore)) * ak;
    // gulls: the shore, the harbour (a little before sunrise too)
    q = (sun + 4) / 6;
    w[2] = (q < 0 ? 0 : q > 1 ? 1 : q) * (shore > f[F.harbour] ? shore : f[F.harbour]) * ak;
    // owls: the forest at night
    w[3] = night * forest * ak;
    // loons: dawn and dusk (and a little at night) on and within 400 m of a lake
    q = 1 + lake / 400;
    w[4] = (twi > 0.3 * night ? twi : 0.3 * night) * (lake >= 0 ? 1 : q < 0 ? 0 : q) * ak;
    // the dog and the door: a village (its zone or built cover around), by day (the sun up a few degrees)
    q = (sun - 1) / 5;
    const vd = (q < 0 ? 0 : q > 1 ? 1 : q) * (vil > 0.8 * built ? vil : 0.8 * built) * ak;
    w[5] = vd; w[6] = vd;
  }

  // ---- PLACING A CALL (an event: allocation is allowed, the world's samplers are asked) -------------------------------
  // the island's canopy (m) at (x, z), or -1 off the raster / no canopy raster; the analytic world: 14 m on its forest
  function canopyAt(world, x, z) {
    const I = world && world.island;
    if (I && I.grid && I.cover) {
      const g = I.grid, i = Math.floor((x - g.x0) / g.cell), j = Math.floor((z - g.z0) / g.cell);
      if (i < 0 || j < 0 || i >= g.w || j >= g.h) return -1;
      const k = j * g.w + i;
      if (I.cover[k] !== 10) return -1;
      return I.canopy ? I.canopy[k] : 12;
    }
    return world && typeof world.surface === 'function' && world.surface(x, z) === 3 ? 14 : -1;
  }
  function groundAt(world, x, z) {
    let g = world && typeof world.terrainH === 'function' ? +world.terrainH(x, z) : 0;
    if (!(g === g)) g = 0;
    return g;
  }
  function waterAt(world, x, z) {
    let w = world && typeof world.waterH === 'function' ? +world.waterH(x, z) : -1e9;
    if (!(w === w)) w = -1e9;
    return w;
  }
  function inVillage(amb, x, z) {
    const zk = amb.zk, zp = amb.zp, zb = amb.zb, t = amb.tmp;
    if (zk) for (let i = 0; i < zk.length; i++) {
      if (zk[i] !== 1) continue;
      if (x < zb[4 * i] || x > zb[4 * i + 2] || z < zb[4 * i + 1] || z > zb[4 * i + 3]) continue;
      AM.polyDist(zp[i], x, z, t, 7);
      if (t[7] === 0) return true;
    }
    return false;
  }
  // a place for species row r around the listener -> st.pos [x, y, z] and 1, else 0 (no place: no call)
  function place(st, r, amb, world) {
    const o = r * 8, pl = SPT[o + 3], d0 = SPT[o + 4], d1 = SPT[o + 5];
    const L = st.L, p = st.pos, f = amb.f;
    st.queries[0]++;
    if (pl === 3) {
      // over the water seaward of the shore point, along the shore +-100 m; the harbour: any water around
      const ck = amb.clk, c = f[F.coast];
      if (c > -500 && c < 500 && ck[10] < 500) {
        const nx = ck[6], nz = ck[7], al = (rnd(st) - 0.5) * 200, out = 10 + rnd(st) * 60;
        const x = ck[8] - nz * al - nx * out, z = ck[9] + nx * al - nz * out;
        const dx = x - L[0], dz = z - L[2];
        if (dx * dx + dz * dz < d1 * d1 * 2.5) { p[0] = x; p[2] = z; p[1] = Math.max(0, waterAt(world, x, z)) + 6 + rnd(st) * 18; return 1; }
      }
    }
    for (let k = 0; k < 10; k++) {
      const a = rnd(st) * 2 * Math.PI, d = d0 + (d1 - d0) * Math.sqrt(rnd(st));
      const x = L[0] + d * Math.cos(a), z = L[2] + d * Math.sin(a);
      if (pl === 0 || pl === 1 || pl === 2) {
        const cn = canopyAt(world, x, z);
        if (cn >= 4) { p[0] = x; p[2] = z; p[1] = groundAt(world, x, z) + cn * (0.6 + 0.3 * rnd(st)); return 1; }
        if (pl === 2 && k >= 4) { p[0] = x; p[2] = z; p[1] = groundAt(world, x, z) + 40 + 40 * rnd(st); return 1; }
        if (pl === 1 && k >= 6 && (f[F.village] > 0.3 || f[F.built] > 0.1)) { p[0] = x; p[2] = z; p[1] = groundAt(world, x, z) + 6; return 1; }
      } else if (pl === 3 || pl === 4) {
        const g = groundAt(world, x, z), wv = waterAt(world, x, z);
        if (wv > g + 0.3 && (pl === 3 || waterIsLake(world, x, z))) { p[0] = x; p[2] = z; p[1] = wv + (pl === 3 ? 6 + rnd(st) * 18 : 0.3); return 1; }
      } else if (pl === 5) {
        if (inVillage(amb, x, z) || (f[F.built] > 0.1 && isBuilt(world, x, z))) { p[0] = x; p[2] = z; p[1] = groundAt(world, x, z) + 1; return 1; }
      }
    }
    return 0;
  }
  function waterIsLake(world, x, z) {
    const I = world && world.island;
    if (I && I.lake && I.grid) {
      const g = I.grid, i = Math.floor((x - g.x0) / g.cell), j = Math.floor((z - g.z0) / g.cell);
      return i >= 0 && j >= 0 && i < g.w && j < g.h && I.lake[j * g.w + i] > 128;
    }
    return waterAt(world, x, z) > 0.5;   // the analytic world: water above the sea's level
  }
  function isBuilt(world, x, z) {
    const I = world && world.island;
    if (I && I.grid && I.cover) {
      const g = I.grid, i = Math.floor((x - g.x0) / g.cell), j = Math.floor((z - g.z0) / g.cell);
      return i >= 0 && j >= 0 && i < g.w && j < g.h && I.cover[j * g.w + i] === 50;
    }
    return world && typeof world.surface === 'function' && world.surface(x, z) === 5;
  }

  // ---- THE SLOTS -------------------------------------------------------------------------------------------------------
  function voicesOn(st) { let n = 0; for (let i = 0; i < NV; i++) n += st.vOn[i]; return n; }
  // a one-shot of sound s at st.pos (follow: a mover's row, or -1) -> its slot, or -1 (the cap, the gap, not ready)
  function fire(st, s, follow, gain) {
    const t = st.clk[0];
    if (!st.ready[s]) return -1;
    let slot = -1, n = 0;
    for (let i = 0; i < NV; i++) { if (st.vOn[i]) n++; else if (slot < 0) slot = i; }
    if (n >= st.cap || slot < 0) { st.refused[0]++; return -1; }
    const p = st.pos, i = slot;
    st.vOn[i] = 1; st.vNew[i] = 1; st.vS[i] = s; st.vF[i] = follow;
    st.vX[i] = p[0]; st.vY[i] = p[1]; st.vZ[i] = p[2]; st.vVx[i] = 0; st.vVy[i] = 0; st.vVz[i] = 0;
    // the jitter (SOUND §6.3): +-1.5 semitones, +-2 dB
    st.vR[i] = Math.pow(2, (2 * rnd(st) - 1) * 1.5 / 12);
    st.vG[i] = gain * Math.pow(10, (SOUNDS[s][3] + (2 * rnd(st) - 1) * 2) / 20);
    st.vT0[i] = t; st.vT1[i] = t + st.dur[s] / st.vR[i] + 0.05;
    const dx = p[0] - st.L[0], dy = p[1] - st.L[1], dz = p[2] - st.L[2];
    st.vD[i] = Math.sqrt(dx * dx + dy * dy + dz * dz);
    st.last[s] = t; st.n[s]++;
    if (st.log) st.log.push([+t.toFixed(3), SOUNDS[s][0], +p[0].toFixed(1), +p[1].toFixed(1), +p[2].toFixed(1), +st.vD[i].toFixed(1)]);
    return i;
  }
  // a loop of sound s (follow a mover's row, or an anchor's -(index + 2)) -> its slot, or -1
  function loopOn(st, s, follow) {
    for (let i = 0; i < NL; i++) if (st.lOn[i] && st.lS[i] === s && st.lF[i] === follow) return i;
    let n = 0, slot = -1;
    for (let i = 0; i < NL; i++) { if (st.lOn[i]) n++; else if (slot < 0) slot = i; }
    if (n >= st.loops || slot < 0) { st.refused[1]++; return -1; }
    st.lOn[slot] = 1; st.lS[slot] = s; st.lF[slot] = follow; st.lG[slot] = 0; st.lR[slot] = 1; st.lT0[slot] = st.clk[0]; st.lT1[slot] = 1e9;
    st.n[s]++;
    if (st.log) st.log.push([+st.clk[0].toFixed(3), SOUNDS[s][0] + ':on', +st.pos[0].toFixed(1), +st.pos[1].toFixed(1), +st.pos[2].toFixed(1), 0]);
    return slot;
  }

  // ---- THE FRAME -----------------------------------------------------------------------------------------------------
  // P: the parameter block (P.s, P.I: the listener, the garage); amb: the ambience model's state (its features, its
  // shore point, its zones); world: AUDIO.world; prov: { objects(out) -> rows } or null; dt: seconds.
  function emittersStep(st, P, amb, world, prov, dt, gens) {
    const s = P.s, I = P.I, f = amb.f, clk = st.clk, L = st.L;
    const d = dt > 0 && dt < 1 ? dt : 0;
    const t = clk[0] += d; clk[4]++;
    // the listener and its velocity (the doppler's other end)
    const x = s[I.listenerX], y = s[I.listenerY], z = s[I.listenerZ];
    if (L[7] > 0 && d > 1e-4) {
      const jx = x - L[0], jz = z - L[2];
      if (jx * jx + jz * jz > 625) { L[4] = L[5] = L[6] = 0; }   // a cut: no velocity across it
      else { const k = d / (d + 0.15); L[4] += ((x - L[0]) / d - L[4]) * k; L[5] += ((y - L[1]) / d - L[5]) * k; L[6] += ((z - L[2]) / d - L[6]) * k; }
    }
    L[0] = x; L[1] = y; L[2] = z; L[7] = 1;
    // the voices that ended free their slot; a follower rides its mover
    for (let i = 0; i < NV; i++) {
      if (!st.vOn[i]) continue;
      if (t >= st.vT1[i]) { st.vOn[i] = 0; st.vNew[i] = 0; st.vF[i] = -1; continue; }
      if (st.vF[i] >= 0) { st.vX[i] += st.vVx[i] * d; st.vY[i] += st.vVy[i] * d; st.vZ[i] += st.vVz[i] * d; }
    }
    // THE CEILING, the garage, under water: nothing is called (what sounds rings out); the loops fade
    const agl = f[F.agl];
    const ak = s[I.inGarage] > 0 || f[F.under] > 0 ? 0 : agl <= CEIL_LO ? 1 : agl >= CEIL ? 0 : 1 - (agl - CEIL_LO) / (CEIL - CEIL_LO);
    clk[2] = ak;
    if (world !== st.wref || (world && world.premises && world.premises.rec !== st.prem)) prepAnchors(st, world, gens);
    weights(st, f);
    // THE SPECIES: a Poisson call at weight / mean, never within the gap, placed (or not made)
    const rg = st.rng;
    for (let r = 0; r < NSP; r++) {
      const o = r * 8, sd = SPT[o], wv = st.w[r];
      // the key is wanted while its habitat says it could be called (the source loads it; released when long unwanted)
      if (wv > 0.03) { st.want[sd] = 1; st.wantT[sd] = t; } else if (t - st.wantT[sd] > 0.5) st.want[sd] = 0;
      if (wv <= 0.001 || t - st.last[sd] < SPT[o + 2]) continue;
      // (the random inline: a double returned by a call V8 does not inline is a fresh heap box, every frame)
      let xr = rg[0]; xr ^= xr << 13; xr >>>= 0; xr ^= xr >>> 17; xr ^= xr << 5; xr >>>= 0; rg[0] = xr;
      if (xr / 4294967296 >= wv * d / SPT[o + 1]) continue;
      if (!st.ready[sd]) continue;
      if (!place(st, r, amb, world)) { st.last[sd] = t - SPT[o + 2] * 0.5; continue; }   // no tree here: try again later
      const n = SPT[o + 6] > 1 ? 1 + Math.floor(rnd(st) * SPT[o + 6]) : 1;
      // a series (a crow's caws): the first now, the others as their own voices 0.35-0.7 s apart at the same place
      for (let k = 0; k < n; k++) {
        const v = fire(st, sd, -1, 1);
        if (v < 0) break;
        if (k > 0) { const dl = k * (0.35 + 0.35 * rnd(st)); st.vT0[v] += dl; st.vT1[v] += dl; }
      }
    }
    // THE OBJECTS: the movers read EVERY frame (a few dozen rows: microseconds) - a reader called 10 times a second runs
    // in V8's lower tiers, where every double it touches is a fresh heap box (G1672's finding, AMB-1's rule): measured
    // ~100 B a frame for three rows at 10 Hz; the chances (a creak, an outboard) are rates x dt
    clk[3] = d;
    movers(st, prov);
    anchors(st);
    // the loops' slots: off when their gain has faded and nothing wants them
    for (let i = 0; i < NL; i++) if (st.lOn[i] && t > st.lT1[i]) { st.lOn[i] = 0; st.lS[i] = -1; st.lF[i] = -1; }
    let nn = 0; for (let i = 0; i < NV; i++) nn += st.vNew[i];
    return nn;
  }

  // the movers: the provider's rows (cabins, cars, boats) -> their velocity, the passes, the tram's sounds, the boats
  function movers(st, prov) {
    const o = st.obj, op = st.objP, L = st.L, t = st.clk[0], ak = st.clk[2], dt = st.clk[3];
    const np = st.nObj[0];
    for (let k = 0; k < np * 6; k++) op[k] = o[k];
    let nn = 0;
    if (ak > 0 && prov && prov.objects) { nn = prov.objects(o) | 0; if (nn > MAXOBJ) nn = MAXOBJ; }
    st.nObj[1] = np; st.nObj[0] = nn;
    const n = nn, nPrev = np;
    if (!n && !st.lOn[0] && !st.lOn[1] && !st.lOn[2]) { st.clk[5] = 0; st.boatNear[0] = -1; st.want[S.pickup] = 0; st.want[S.creak] = 0; st.want[S.bell] = 0; st.want[S.tramhum] = 0; st.want[S.boat] = 0; return; }
    let near = 0;
    st.boatNear[0] = -1;
    st.want[S.pickup] = 0; st.want[S.creak] = 0; st.want[S.bell] = 0; st.want[S.tramhum] = 0;
    let boatD = 1e18;
    for (let r = 0; r < n; r++) {
      const q = r * 6, kd = o[q];
      const dx = o[q + 1] - L[0], dy = o[q + 2] - L[1], dz = o[q + 3] - L[2];
      const d2 = dx * dx + dy * dy + dz * dz;
      // the velocity from the last frame's read of the same row (rows keep their order while the set does not change),
      // smoothed over ~0.1 s (a car's pose moves every tick; a cabin's too)
      if (r < nPrev && op[q] === kd && dt > 1e-4) {
        const ex = o[q + 1] - op[q + 1], ey = o[q + 2] - op[q + 2], ez = o[q + 3] - op[q + 3];
        if (ex * ex + ez * ez < 100) { const k = dt / (dt + MOVER_DT);
          st.vel[3 * r] += (ex / dt - st.vel[3 * r]) * k; st.vel[3 * r + 1] += (ey / dt - st.vel[3 * r + 1]) * k; st.vel[3 * r + 2] += (ez / dt - st.vel[3 * r + 2]) * k; }
        else { st.vel[3 * r] = st.vel[3 * r + 1] = st.vel[3 * r + 2] = 0; }
      } else if (!(r < nPrev && op[q] === kd)) { st.vel[3 * r] = st.vel[3 * r + 1] = st.vel[3 * r + 2] = 0; }
      if (kd === KIND_CAR) {
        if (d2 > PASS.reach * PASS.reach) continue;
        near++; st.want[S.pickup] = 1;
        passCheck(st, r);
      } else if (kd === KIND_TRAM) {
        const mv = o[q + 5] > 0 ? 1 : 0;
        // the bell: a cabin leaving or docking, within reach
        if (r < nPrev && op[q] === kd && (op[q + 5] > 0 ? 1 : 0) !== mv && d2 < TRAM.bellReach * TRAM.bellReach) {
          st.pos[0] = o[q + 1]; st.pos[1] = o[q + 2] + 6; st.pos[2] = o[q + 3];
          fire(st, S.bell, -1, 1);
        }
        st.moving[r] = mv;
        if (d2 < TRAM.bellReach * TRAM.bellReach) st.want[S.bell] = 1;
        if (d2 > TRAM.reach * TRAM.reach) continue;
        near++; st.want[S.tramhum] = 1; st.want[S.creak] = 1;
        st.pos[0] = o[q + 1]; st.pos[1] = o[q + 2] + 5; st.pos[2] = o[q + 3];
        const li = st.ready[S.tramhum] ? loopOn(st, S.tramhum, r) : -1;
        if (li >= 0) {
          const v = o[q + 4] < 0 ? -o[q + 4] : o[q + 4], vk0 = v / TRAM.vMax, vk = vk0 > 1 ? 1 : vk0;
          st.lX[li] = st.pos[0]; st.lY[li] = st.pos[1]; st.lZ[li] = st.pos[2];
          st.lG[li] = ak * (0.12 + 0.88 * vk); st.lR[li] = 0.8 + 0.25 * vk; st.lT1[li] = t + 1.5;
        }
        // a creak while it runs
        if (mv && d2 < TRAM.creakReach * TRAM.creakReach && t - st.last[S.creak] > TRAM.creakGap && rnd(st) < dt / TRAM.creakMean) {
          fire(st, S.creak, r, 1);
        }
      } else if (kd === KIND_BOAT) {
        if (d2 > BOAT.reach * BOAT.reach) continue;
        near++;
        if (d2 < boatD) { boatD = d2; st.boatNear[0] = r; }   // the nearest boat
      }
    }
    st.clk[5] = near;
    // the tram's loops for cabins gone out of reach (or the rows gone) fade out
    for (let i = 0; i < NL; i++) {
      if (!st.lOn[i] || st.lS[i] !== S.tramhum) continue;
      const r = st.lF[i];
      if (r >= n || o[r * 6] !== KIND_TRAM) st.lG[i] = 0;
      else { const dx = o[r * 6 + 1] - L[0], dz = o[r * 6 + 3] - L[2]; if (dx * dx + dz * dz > TRAM.reach * TRAM.reach) st.lG[i] = 0; }
      if (st.lG[i] === 0 && st.lT1[i] > t + 1.5) st.lT1[i] = t + 1.5;
    }
    // THE BOATS: now and then (by day) one boat near idles its outboard for a while
    const bw = st.clk[7] > 0.2 ? ak : 0;   // by day
    st.want[S.boat] = st.boatNear[0] >= 0 && bw > 0 ? 1 : 0;
    if (st.boatNear[0] >= 0 && bw > 0 && st.ready[S.boat] && t - st.last[S.boat] > BOAT.gap && rnd(st) < dt / BOAT.mean) {
      const r = st.boatNear[0], q = r * 6;
      st.pos[0] = o[q + 1]; st.pos[1] = o[q + 2] + 0.5; st.pos[2] = o[q + 3];
      const li = loopOn(st, S.boat, r);
      if (li >= 0) {
        st.last[S.boat] = t;
        st.lX[li] = st.pos[0]; st.lY[li] = st.pos[1]; st.lZ[li] = st.pos[2];
        st.lG[li] = ak; st.lR[li] = 0.9 + 0.2 * rnd(st); st.lT1[li] = t + BOAT.tMin + (BOAT.tMax - BOAT.tMin) * rnd(st);
      }
    }
  }
  // a car near: when its closest approach is 2.4-3.6 s ahead and within 40 m, its pass starts on it (one at a time)
  function passCheck(st, r) {
    const t = st.clk[0], q0 = r * 6, dx = st.obj[q0 + 1] - st.L[0], dz = st.obj[q0 + 3] - st.L[2];
    if (t - st.last[S.pickup] < PASS.gap || !st.ready[S.pickup]) return;
    const vx = st.vel[3 * r], vz = st.vel[3 * r + 2];
    const sp = Math.sqrt(vx * vx + vz * vz);
    if (sp < PASS.vMin) return;
    const rx = vx - st.L[4], rz = vz - st.L[6], v2 = rx * rx + rz * rz;
    if (v2 < 1) return;
    const tc = -(dx * rx + dz * rz) / v2;
    if (tc < PASS.tLo || tc > PASS.tHi) return;
    const cx = dx + rx * tc, cz = dz + rz * tc;
    if (cx * cx + cz * cz > PASS.dCpa * PASS.dCpa) return;
    for (let i = 0; i < NV; i++) if (st.vOn[i] && st.vS[i] === S.pickup) return;
    const q = r * 6;
    st.pos[0] = st.obj[q + 1]; st.pos[1] = st.obj[q + 2] + 0.8; st.pos[2] = st.obj[q + 3];
    const v = fire(st, S.pickup, r, 1);
    if (v >= 0) { st.vVx[v] = vx; st.vVy[v] = st.vel[3 * r + 1]; st.vVz[v] = vz; }
  }
  // the static anchors (the mill): a loop within reach, by day and the evening (the sun above -6 deg)
  function anchors(st) {
    const A = st.anc, L = st.L, n = st.ancS.length, t = st.clk[0], ak = st.clk[2];
    st.want[S.mill] = 0;
    if (!n) return;
    for (let i = 0; i < n; i++) {
      const dx = A[3 * i] - L[0], dz = A[3 * i + 2] - L[2];
      const d2 = dx * dx + dz * dz;
      const fol = -(i + 2);
      if (d2 > MILL.reach * MILL.reach) {
        for (let k = 0; k < NL; k++) if (st.lOn[k] && st.lF[k] === fol) { st.lG[k] = 0; if (st.lT1[k] > t + 1.5) st.lT1[k] = t + 1.5; }
        continue;
      }
      if (ak <= 0 || st.clk[6] <= 0) continue;
      st.want[st.ancS[i]] = 1;
      if (!st.ready[st.ancS[i]]) continue;
      st.pos[0] = A[3 * i]; st.pos[1] = A[3 * i + 1]; st.pos[2] = A[3 * i + 2];
      const li = loopOn(st, st.ancS[i], fol);
      if (li >= 0) { st.lX[li] = A[3 * i]; st.lY[li] = A[3 * i + 1]; st.lZ[li] = A[3 * i + 2]; st.lG[li] = ak * st.clk[6]; st.lR[li] = 1; st.lT1[li] = t + 1.5; }
    }
  }

  // ---- THE PROCEDURAL SOUNDS (no recording ships for these): mono Float32Array at sr, seconds s -----------------------
  // seeded noise; loops are made seamless by an equal-power crossfade of the tail into the head (samples.js's rule)
  function noise(seed0) { let x = seed0 >>> 0 || 1; return () => { x ^= x << 13; x >>>= 0; x ^= x >>> 17; x ^= x << 5; x >>>= 0; return x / 2147483648 - 1; }; }
  function seamless(y, sr) {
    const X = Math.floor(0.4 * sr), n = y.length - X, out = new Float32Array(n);
    for (let i = 0; i < n; i++) out[i] = y[i];
    for (let i = 0; i < X; i++) { const u = (i + 0.5) / X; out[i] = y[i] * Math.sin(0.5 * Math.PI * u) + y[n + i] * Math.cos(0.5 * Math.PI * u); }
    return out;
  }
  function normalise(y, peak) { let m = 0; for (let i = 0; i < y.length; i++) { const a = Math.abs(y[i]); if (a > m) m = a; } if (m > 0) for (let i = 0; i < y.length; i++) y[i] *= peak / m; return y; }
  function synth(name, sr) {
    const R = noise(name.length * 7919 + 17);
    if (name === 'tramhum') {
      // the haul rope over the sheaves: a band of noise round 110 Hz and its octave, the sheave's tick at 4.3 Hz
      const n = Math.floor(4.4 * sr), y = new Float32Array(n);
      let b1 = 0, b2 = 0, c1 = 0, c2 = 0, lp = 0;
      const f1 = 2 * Math.sin(Math.PI * 112 / sr), f2 = 2 * Math.sin(Math.PI * 226 / sr), q = 0.04;
      for (let i = 0; i < n; i++) {
        const e = R(), t = i / sr;
        b1 += f1 * c1; c1 += f1 * (e - b1 - q * c1);  // a two-pole resonator (Chamberlin) at 112 Hz
        b2 += f2 * c2; c2 += f2 * (e - b2 - q * c2);
        lp += (e - lp) * 0.02;
        const tick = Math.exp(-((t * 4.3) % 1) * 40) * R() * 0.6;
        y[i] = 0.5 * b1 + 0.25 * b2 + 0.6 * lp + 0.08 * tick + 0.04 * Math.sin(2 * Math.PI * 56 * t);
      }
      return normalise(seamless(y, sr), 0.5);
    }
    if (name === 'mill') {
      // a stamp mill and its crusher: a low rumble, the stamps' thuds at 1.6 Hz (the cams in turn), a belt's whine
      const n = Math.floor(5.4 * sr), y = new Float32Array(n);
      let lp1 = 0, lp2 = 0, th = 0;
      for (let i = 0; i < n; i++) {
        const e = R(), t = i / sr;
        lp1 += (e - lp1) * 0.008; lp2 += (lp1 - lp2) * 0.05;
        const ph = (t * 1.6) % 1, stamp = Math.exp(-ph * 22) * Math.sin(2 * Math.PI * 48 * ph / 1.6);
        th += (R() * Math.exp(-ph * 30) - th) * 0.3;
        y[i] = 2.2 * lp2 + 0.55 * stamp + 0.2 * th + 0.035 * Math.sin(2 * Math.PI * 740 * t) * (0.7 + 0.3 * Math.sin(2 * Math.PI * 0.4 * t));
      }
      return normalise(seamless(y, sr), 0.6);
    }
    if (name === 'boat') {
      // a small outboard at idle: a two-stroke's firing at ~14 Hz, each a noisy pop through a low resonance, gurgling
      const n = Math.floor(3.4 * sr), y = new Float32Array(n);
      let b = 0, c = 0, g = 0;
      const fr = 2 * Math.sin(Math.PI * 180 / sr);
      for (let i = 0; i < n; i++) {
        const t = i / sr, ph = (t * 14.2 + 0.03 * Math.sin(2 * Math.PI * 0.7 * t)) % 1;
        const pop = Math.exp(-ph * 9) * (0.6 + 0.4 * R());
        b += fr * c; c += fr * (pop * R() - b - 0.12 * c);
        g += (R() - g) * 0.01;
        y[i] = b + 0.3 * pop * Math.sin(2 * Math.PI * 95 * t) + 0.4 * g * Math.sin(2 * Math.PI * 3 * t);
      }
      return normalise(seamless(y, sr), 0.5);
    }
    if (name === 'bell') {
      // a station bell, struck twice: inharmonic partials (a small bronze bell's: 1, 2.0, 2.4, 3.0, 4.2) decaying
      const n = Math.floor(3.2 * sr), y = new Float32Array(n);
      const P = [[880, 1, 1.4], [1760, 0.6, 1.0], [2112, 0.5, 0.8], [2640, 0.35, 0.6], [3700, 0.2, 0.35]];
      for (const at of [0, 0.55]) for (const [fq, a, tau] of P) {
        const i0 = Math.floor(at * sr);
        for (let i = i0; i < n; i++) { const t = (i - i0) / sr; y[i] += a * Math.exp(-t / tau) * Math.sin(2 * Math.PI * fq * t) * (t < 0.002 ? t / 0.002 : 1); }
      }
      return normalise(y, 0.8);
    }
    return null;
  }

  return { emittersState, emittersStep, weights, place, fire, seed, rnd, synth, prepAnchors,
           SOUNDS, NS, S, SPECIES, NSP, HAB, PLACE, TIERS, NV, NL, CEIL, CEIL_LO, PASS, TRAM, MILL, BOAT, DECLARED,
           KIND_TRAM, KIND_CAR, KIND_BOAT, MOVER_DT, MAXOBJ };
})();
if (typeof window !== 'undefined') window.EMITTERS_MODEL = EMITTERS_MODEL;
if (typeof module !== 'undefined' && module.exports) module.exports = EMITTERS_MODEL;
