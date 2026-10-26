// G3660 (2026-10-26): THE METEO STATION in the game - this generator, written on the house bench on 25 Oct as the
// Śnieżka observatory (futureDesigns/OBSERVATORY-SNIEZKA-2026-10-25.md), renamed: window.METEO_GEN, the presets
// 'meteo station' / 'meteo station 1974', the catalogue keys meteo/<preset> (27_premises GEN_NS meteo). Loaded on demand
// (build.js MANIFEST.lazy; world_boot.js asks for it when the placed record names a meteo/ key; house_worker HW_LAZY),
// so a page without one pays nothing. One stands on Mount Ardent's summit (island_jolene.json site mt_s_meteo).
// _observatory_gen.js — THE ŚNIEŻKA OBSERVATORY (the user, 2026-10-25: "This
// is the Sniezka meteo station. It's perfect for flyDiy. Can you give your
// best shot at modeling this building? Only the geometry for now and
// placeholder materials, the real ones would use the in-game library ... use
// the methods of the houses and weathering of the mine. It does not have to
// reproduce exactly, but the feel, the main features and the quality should
// be there, including a good amount of detail").
//
// The Wysokogórskie Obserwatorium Meteorologiczne on Śnieżka (1603 m, the
// Karkonosze), Witold Lipiński and Waldemar Wawrzyniak, built 1966-1974:
// three flying saucers on a bare rocky summit. What the photographs agree on,
// and what this draws:
//
//   THE TWO-TIER DISC (about 20.6 m, the "middle" one in the sources): a ground
//     storey of dry-laid schist rubble with small wood-framed windows, a skirt
//     of patinated copper flaring out over it with radial seams, a band of tall
//     wood-framed windows set back on the skirt's lip, a thin eave with a
//     copper edge and a shallow cone of tarred roof with radial battens, a
//     glazed lantern at its middle, vent pipes and a tall square stack.
//   THE FLAT DISC (about 29 m, the old restaurant): a stone plinth, a ring of
//     glazing from floor to eave, a very flat cone roof with its lantern,
//     roof hatches and mushroom vents. Its eave ducks under the first disc's
//     skirt where the two meet - the junction in every front photograph.
//   THE TOWER: a battered dark core (an elongated octagon in plan, so it reads
//     narrow end-on and broad from the flank, as it does in the photos) rising
//     from the junction, and on it THE TOP SAUCER (about 14 m): a steep dark
//     underside with its panel seams, a gallery all round with a rail, a band
//     of glazing set well back, a roof cap, a railed roof deck with the mast,
//     the instruments and a steel stair up from the gallery.
//   THE SUMMIT: the concrete triangulation pillar beside it (the obelisk of
//     the east photograph).
//
// HOW IT IS BUILT: the house kit's primitives through `face()` (no winding
// bugs, UVs in metres), and a REVOLVE of its own for the saucers - every disc
// is a section turned round its axis, mapped by DEVELOPING each cone (an
// unrolled frustum is an annulus sector, so a scan lies on it without
// stretching, with one seam per ring at the back). Walls with openings are
// the kit's `wall()` per facet of the drum, dressed by the house's own
// `dressOpening` / `buildDoor` (casings, sills, the reflective glass with its
// glow, the lamp at the door). LOD 1 is a construction, not a decimation: the
// same numbers, coarser rings, no seams, frames, rails' mid rails or
// instruments' small parts.
//
// THE FINISH is the house's (shadeHouse: the dirt line, the baked occlusion,
// the repetition breaker) with THE MINE'S WEATHER on top (G329's cloud fields
// on the sheet, the stone and the concrete; the roofs greyed and dusty in
// their own mode; G342's steel mix on the structural steel) plus two hooks of
// its own: RAIN STREAKS down the dark sheet and the core (every photograph
// shows them), and A RUBBLE PATTERN on the ground storey (3-D cells in world
// space, flattened into slabs, mortar dark, each stone its own tone, a bump
// at the joints) - a PLACEHOLDER until a rubble-masonry scan joins the
// library. Library sets stand in for the rest: the tarred roofs are the
// render scan in charcoal, the copper is the galvanised sheet in seafoam, the
// core is the concrete in charcoal. Same API as the other generators
// (DEF/ROWS/PRESETS/BAGS/MAT/build/applyFinish/makeFinish/catOf/CATALOGUE);
// the build itself needs no THREE (the bags are plain arrays), the finish does.
(() => {
'use strict';
const K = window.HOUSE_KIT;
const HG = window.HOUSE_GEN;
const { clamp, sub, add, mul, len, nrm, dot, crs, Bag, face, uvFrame, boxAB, beam, plate, cyl, wall } = K;
const D2R = Math.PI / 180, TAU = Math.PI * 2;

// ---- the materials ------------------------------------------------------------
// Slots by WHAT THE THING IS on the building; each slot lists the library sets
// it may wear (house library keys) and is tinted from the house's paint pot.
const SETS = {
  roof:   ['render', 'galv', 'steelgrey', 'boxprof', 'corrworn', 'shingle'],   // render in charcoal = the tar membrane (placeholder)
  copper: ['galv', 'steelgrey', 'rust', 'render'],                             // galv in seafoam = the patinated copper (placeholder)
  dark:   ['steelgrey', 'galv', 'render', 'rust'],                             // the saucer's underside, the fascias, the hatches
  shaft:  ['concrete', 'concretec', 'render', 'steelgrey'],                    // the core's cladding
  stone:  ['concretec', 'concrete', 'render'],                                 // the ground storey (+ the rubble hook)
  steel:  ['steelgrey', 'steelrust', 'galv'],                                  // mullions, masts, stringers (+ the steel mix)
  rail:   ['galv', 'steelgrey', 'rust'],                                       // the rails, the stair's handrails, the vent pipes
  flue:   ['rust', 'steelrust', 'galv'],
  paint:  ['render', 'paintwood'],                                             // the instrument screens, the vent caps
  conc:   ['concrete', 'concretec'],                                           // the obelisk, the deck slabs, the steps
  deck:   ['concrete', 'concretec', 'steelgrey'],                              // the gallery deck, the roof deck
  patch:  ['render', 'steelgrey'],                                             // the membrane's repairs, newer and blacker
};
const SET_IDX = (role, key) => Math.max(0, SETS[role].indexOf(key));
const setNames = role => SETS[role].slice();
const COL = name => Math.max(0, HG.COL_NAMES.indexOf(name));
const std = (c, o) => new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: 0.92, metalness: 0 }, o || {}));
const OWN = ['roof', 'copper', 'dark', 'shaft', 'stone', 'steel', 'rail', 'flue', 'paint', 'conc', 'deck', 'patch'];
function makeMats() {
  if (typeof THREE === 'undefined') { const M = {}; for (const k of OWN) M[k] = { color: { setHex() {} }, userData: {} }; return M; }
  return {
    roof: std(0x34383a), copper: std(0x6f9a86, { metalness: 0.3, roughness: 0.6 }), dark: std(0x2f3336, { metalness: 0.4, roughness: 0.55 }),
    shaft: std(0x4a4e51), stone: std(0x55574f), steel: std(0x8d9296, { roughness: 0.6, metalness: 0.8 }),
    rail: std(0xb4bcc2, { roughness: 0.45, metalness: 0.8 }), flue: std(0x7a4a33, { roughness: 0.8, metalness: 0.4 }),
    paint: std(0xe4e2dc), conc: std(0x9a9890), deck: std(0x77797a), patch: std(0x202224),
  };
}
// the house owns the casing, the glass, the far pane, the smoke and the skirt;
// `siding`, `post` and `metal` are there because the house's opening and door
// dressers reach for them (a lamp's bracket, a porch post) - they share the house's
const BAGS = ['roof', 'patch', 'copper', 'dark', 'shaft', 'stone', 'steel', 'rail', 'flue', 'paint', 'conc', 'deck', 'trim', 'pane', 'glass', 'siding', 'post', 'metal'];
const EXTRA = ['aoskirt', 'smoke'];
const HOUSE_OWNED = { trim: 1, pane: 1, glass: 1, smoke: 1, aoskirt: 1, siding: 1, post: 1, metal: 1 };
const makeFinish = () => {
  const HF = HG.makeFinish(); const M = makeMats();
  for (const k in HOUSE_OWNED) M[k] = HF.MAT[k];
  return { MAT: M, SHADE_U: HG.makeShadeU(), HF };
};
const DEFAULT_FINISH = (typeof THREE !== 'undefined') ? makeFinish() : { MAT: makeMats(), SHADE_U: null, HF: null };
const MAT = DEFAULT_FINISH.MAT;
function houseP(P) {
  return Object.assign({}, HG.DEF, {
    trimSet: HG.SET_IDX('trim', P.trimSet || 'veneerwarm'), trimCol: P.trimCol || 0, trimW: 0.07,
    dirt: P.dirt, dirtH: P.dirtH, noise: P.noise, clouds: P.clouds, weather: 0.5, paintPunch: 0.9,
    curtains: 0, muntin: 0, doorLight: 0, doorAjar: 0, hand: 0, bevel: 0.006,
    lights: P.lights ? 1 : 0, winLit: 0.5, winLink: 0, porchLamp: 1, lampKind: 1, lightSeed: P.seed || 1,
    floorY: 0, slopeX: P.slopeX, slopeZ: P.slopeZ, ground: P.ground,
    smoke: 0, ao: P.ao, aoRange: P.aoRange, aoDirect: P.aoDirect,
  });
}

// ---- the dials ----------------------------------------------------------------
const GROUNDS = ['rubble', 'panels'];
const SHAFTS = ['battered', 'round'];
const DEF = {
  seed: 7,
  // the two-tier disc, its centre the origin; its floor the datum
  d1R: 10.3, d1Ground: 3.3, d1Skirt: 1.7, d1Glaze: 2.05, d1Rise: 1.7, d1Win: 44, d1Lantern: 1,
  groundKind: 0,
  // the flat disc
  d2On: 1, d2R: 14.5, d2x: -19, d2z: -8, d2Floor: 0.25, d2Glaze: 2.1, d2Rise: 2.1, d2Win: 60,
  // the tower
  tx: -7, tz: -11.5, towerH: 10.6, shaftKind: 0, shaftW: 7.2, shaftD: 4.8,
  topR: 7.0, topGlaze: 1.9, topWin: 22,
  // the fittings
  instruments: 1, stair: 1, stack: 1, obelisk: 1, obX: 15.5, obZ: 6.5, lights: 0,
  slopeX: 0, slopeZ: 0,
  // the finish
  roofSet: SET_IDX('roof', 'render'), roofCol: COL('charcoal'), roofTone: 0.5,
  copperSet: SET_IDX('copper', 'galv'), copperCol: COL('seafoam'),
  darkSet: SET_IDX('dark', 'steelgrey'), darkCol: COL('charcoal'),
  shaftSet: SET_IDX('shaft', 'concrete'), shaftCol: COL('charcoal'),
  stoneSet: SET_IDX('stone', 'concretec'), stoneCol: 0,
  trimSet: 'veneerwarm', trimCol: COL('ochre'),
  rubble: 1, rubbleS: 0.34, streaks: 0.55, rust: 0.18,
  dirt: 0.5, dirtH: 1.1, noise: 0.18, clouds: 0.45, roofClouds: 0.15,
  ao: 0.85, aoRange: 0.7, aoDirect: 0.35, aoGround: 1,
};
const ROWS = [
  ['the two-tier disc', [
    ['d1R', 'eave radius', 8, 14, 0.05], ['d1Ground', 'ground storey', 2.6, 4.5, 0.05], ['d1Skirt', 'copper skirt height', 0.8, 2.4, 0.05],
    ['d1Glaze', 'window band', 1.4, 3.0, 0.05], ['d1Rise', 'roof rise', 0.6, 3.0, 0.05], ['d1Win', 'windows round', 24, 64, 2],
    ['d1Lantern', 'lantern', 0, 1, 1], ['groundKind', 'ground storey', 0, 1, 1, GROUNDS],
  ]],
  ['the flat disc', [
    ['d2On', 'flat disc', 0, 1, 1], ['d2R', 'eave radius', 9, 17, 0.05, null, P => !!P.d2On],
    ['d2x', 'centre x', -26, -14, 0.1, null, P => !!P.d2On], ['d2z', 'centre z', -16, 4, 0.1, null, P => !!P.d2On],
    ['d2Floor', 'floor above datum', -0.5, 1.5, 0.05, null, P => !!P.d2On], ['d2Glaze', 'window band', 1.5, 3.0, 0.05, null, P => !!P.d2On],
    ['d2Rise', 'roof rise', 0.8, 3.5, 0.05, null, P => !!P.d2On], ['d2Win', 'windows round', 32, 84, 2, null, P => !!P.d2On],
  ]],
  ['the tower', [
    ['tx', 'centre x', -14, 0, 0.1], ['tz', 'centre z', -16, -6, 0.1], ['towerH', 'saucer underside', 8.5, 15, 0.05],
    ['shaftKind', 'core', 0, 1, 1, SHAFTS], ['shaftW', 'core width (base)', 4, 9, 0.1], ['shaftD', 'core depth (base)', 3, 7, 0.1],
    ['topR', 'saucer radius', 5, 8.5, 0.05], ['topGlaze', 'window band', 1.4, 2.6, 0.05], ['topWin', 'windows round', 14, 32, 2],
  ]],
  ['the fittings', [
    ['instruments', 'roof instruments', 0, 1, 1], ['stair', 'stair to the roof', 0, 1, 1], ['stack', 'stack and vents', 0, 1, 1],
    ['obelisk', 'the pillar', 0, 1, 1], ['lights', 'lights', 0, 1, 1],
    ['slopeZ', 'ground slope z', -8, 8, 0.5], ['slopeX', 'ground slope x', -6, 6, 0.5],
  ]],
  ['finish', [
    ['roofSet', 'roofs', 0, SETS.roof.length - 1, 1, setNames('roof')], ['roofCol', 'roof paint', 0, HG.COLS.length - 1, 1, HG.COL_NAMES], ['roofTone', 'roof tone', 0.3, 1.2, 0.01],
    ['copperSet', 'skirt and edges', 0, SETS.copper.length - 1, 1, setNames('copper')], ['copperCol', 'skirt paint', 0, HG.COLS.length - 1, 1, HG.COL_NAMES],
    ['darkSet', 'saucer and fascias', 0, SETS.dark.length - 1, 1, setNames('dark')], ['darkCol', 'saucer paint', 0, HG.COLS.length - 1, 1, HG.COL_NAMES],
    ['shaftSet', 'core', 0, SETS.shaft.length - 1, 1, setNames('shaft')], ['shaftCol', 'core paint', 0, HG.COLS.length - 1, 1, HG.COL_NAMES],
    ['stoneSet', 'ground storey', 0, SETS.stone.length - 1, 1, setNames('stone')], ['stoneCol', 'ground storey paint', 0, HG.COLS.length - 1, 1, HG.COL_NAMES],
    ['trimCol', 'window frames', 0, HG.COLS.length - 1, 1, HG.COL_NAMES],
    ['rubble', 'rubble pattern', 0, 1, 0.05], ['rubbleS', 'stone size', 0.2, 0.9, 0.01], ['streaks', 'rain streaks', 0, 1, 0.05],
    ['rust', 'steel rust', 0, 1, 0.05], ['dirt', 'dirt', 0, 1, 0.05], ['dirtH', 'dirt height', 0.3, 2.5, 0.05],
    ['clouds', 'weather clouds', 0, 1, 0.05], ['roofClouds', 'roof weather', 0, 1, 0.05],
    ['ao', 'baked occlusion', 0, 1, 0.05], ['aoGround', 'ground skirt', 0, 1, 1],
  ]],
];
// TWO ERAS. Today: tarred roofs, patinated copper, a dark core, rubble at the
// foot, varnished frames. 1974, as it opened: the discs "glittering in the sun
// thanks to their aluminium covering" (the sources), a light concrete core
// round and ribbed, rendered panels at the foot, light frames.
const PRESETS = {
  'meteo station': {},
  'meteo station 1974': {
    groundKind: 1, shaftKind: 1,
    roofSet: SET_IDX('roof', 'galv'), roofCol: 0, roofTone: 1.0, copperSet: SET_IDX('copper', 'galv'), copperCol: 0,
    darkSet: SET_IDX('dark', 'galv'), darkCol: 0, shaftSet: SET_IDX('shaft', 'concrete'), shaftCol: 0,
    stoneSet: SET_IDX('stone', 'render'), stoneCol: COL('white'), trimSet: 'veneerpale', trimCol: COL('white'),
    rubble: 0, streaks: 0.3, rust: 0.05, dirt: 0.25, clouds: 0.15, roofClouds: 0.08, obelisk: 1,
  },
};
const CATS = { 'meteo station': 'landmark', 'meteo station 1974': 'landmark' };
const catOf = name => CATS[name] || null;
function rng(seed) { let st = ((seed | 0) * 2654435761 + 11) >>> 0; return () => { st = (st + 0x6D2B79F5) >>> 0; let t = st; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// ---- the kit of parts -----------------------------------------------------------
const ring = (cx, cz, r, th, y) => [cx + r * Math.cos(th), y, cz + r * Math.sin(th)];

// THE REVOLVE. `prof` is a polyline of [r, y] walked so the outside is on the
// right of the direction of travel - inward-up for a roof, outward for a
// soffit, upward for a wall - and the outward normal of each run is then
// (dy, -dr). Long runs are cut into rings `o.sub` apart (the bake lands per
// vertex). UV: a cylinder is (arc, y); a cone is developed - ρ from its apex,
// φ = θ·sin(half-angle) - so a scan lies on it flat; a flat ring is plan xz.
// The normal is the true one of the surface of revolution, per run, so the
// disc is smooth round and crisp at every fold of its section.
function revolve(bag, cx, cz, prof, o) {
  const opt = o || {};
  const N = opt.segs || 64, a0 = opt.a0 || 0, a1 = opt.a1 === undefined ? a0 + TAU : opt.a1;
  const dA = (a1 - a0) / N;
  for (let s = 0; s + 1 < prof.length; s++) {
    const p0 = prof[s], p1 = prof[s + 1];
    const DR = p1[0] - p0[0], DY = p1[1] - p0[1], L = Math.hypot(DR, DY);
    if (L < 1e-6) continue;
    const n2 = [DY / L, -DR / L];
    const cylr = Math.abs(DR) < 1e-5;
    const apexY = cylr ? 0 : p0[1] - p0[0] * DY / DR;
    const sinA = cylr ? 0 : Math.abs(DR) / L;
    const nSub = opt.sub ? Math.max(1, Math.ceil(L / opt.sub)) : 1;
    for (let k = 0; k < nSub; k++) {
      const ra = p0[0] + DR * k / nSub, ya = p0[1] + DY * k / nSub;
      const rb = p0[0] + DR * (k + 1) / nSub, yb = p0[1] + DY * (k + 1) / nSub;
      for (let i = 0; i < N; i++) {
        const t0 = a0 + i * dA, t1 = t0 + dA, tm = t0 + dA / 2;
        const q = [ring(cx, cz, ra, t0, ya), ring(cx, cz, ra, t1, ya), ring(cx, cz, rb, t1, yb), ring(cx, cz, rb, t0, yb)];
        const th = [t0, t1, t1, t0], rr = [ra, ra, rb, rb], yy = [ya, ya, yb, yb];
        const uvAt = j => {
          if (cylr) return [(th[j] - a0) * rr[j], yy[j]];
          const rho = Math.hypot(rr[j], yy[j] - apexY), ph = (th[j] - a0) * sinA;
          return [rho * Math.cos(ph), rho * Math.sin(ph)];
        };
        const uvs = [uvAt(0), uvAt(1), uvAt(2), uvAt(3)];
        const wantN = [n2[0] * Math.cos(tm), n2[1], n2[0] * Math.sin(tm)];
        // the ring through `face` (orientation and degenerate apexes handled there);
        // the per-vertex uv is matched back by position
        const uvf = p => { let b = 0, bd = 1e9; for (let j = 0; j < 4; j++) { const d = Math.abs(p[0] - q[j][0]) + Math.abs(p[1] - q[j][1]) + Math.abs(p[2] - q[j][2]); if (d < bd) { bd = d; b = j; } } return uvs[b]; };
        const nf = opt.flat ? null : p => { const a = Math.atan2(p[2] - cz, p[0] - cx); return [n2[0] * Math.cos(a), n2[1], n2[0] * Math.sin(a)]; };
        face(bag, q, wantN, uvf, nf);
      }
    }
  }
}
// a radial run of battens / standing seams on a cone, ON the polygon's vertex
// lines (where the faceted surface is exactly the cone)
function seams(bag, cx, cz, rA, yA, rB, yB, N, every, lift, hw, ht, o) {
  const opt = o || {};
  const DR = rB - rA, DY = yB - yA, L = Math.hypot(DR, DY) || 1;
  const n2 = [DY / L, -DR / L];
  for (let i = 0; i < N; i += every) {
    const t = (opt.a0 || 0) + i * TAU / N;
    if (opt.skip && opt.skip(t)) continue;
    const up = [n2[0] * Math.cos(t), n2[1], n2[0] * Math.sin(t)];
    const a = ring(cx, cz, rA, t, yA), b = ring(cx, cz, rB, t, yB);
    beam(bag, add(a, mul(up, lift)), add(b, mul(up, lift)), hw, ht, up, 0);
  }
}
// a polygonal rail ring: top rail, `mids` intermediate rails, posts every
// `postEvery` vertices, `gaps` as [θ0, θ1] arcs left open (a stair arriving)
function railRing(bags, cx, cz, r, y, h, n, o) {
  const opt = o || {}, gaps = opt.gaps || [], lod = opt.lod || 0;
  const inGap = t => gaps.some(g => { let a = t - g[0]; a -= Math.floor(a / TAU) * TAU; let w = g[1] - g[0]; w -= Math.floor(w / TAU) * TAU; return a < w; });
  const pe = opt.postEvery || 1, mids = lod ? [] : (opt.mids || [0.36, 0.68]);
  let posts = 0;
  for (let i = 0; i < n; i++) {
    const t0 = i * TAU / n, t1 = (i + 1) * TAU / n;
    const ok0 = !inGap(t0 + 1e-4), segOk = !inGap((t0 + t1) / 2);
    if (ok0 && i % pe === 0) { const p = ring(cx, cz, r, t0, y); beam(bags.rail, p, [p[0], p[1] + h, p[2]], 0.022, 0.022, [Math.cos(t0), 0, Math.sin(t0)], 0); posts++; }
    if (!segOk) {
      // close the run with a post on each side of the gap
      if (ok0 && i % pe !== 0) { const p = ring(cx, cz, r, t0, y); beam(bags.rail, p, [p[0], p[1] + h, p[2]], 0.022, 0.022, [Math.cos(t0), 0, Math.sin(t0)], 0); posts++; }
      continue;
    }
    if (inGap(t1 - 1e-4) === false && inGap(t1 + 1e-4)) { const p = ring(cx, cz, r, t1, y); beam(bags.rail, p, [p[0], p[1] + h, p[2]], 0.022, 0.022, [Math.cos(t1), 0, Math.sin(t1)], 0); posts++; }
    const a = ring(cx, cz, r, t0, y), b = ring(cx, cz, r, t1, y);
    beam(bags.rail, [a[0], y + h, a[2]], [b[0], y + h, b[2]], 0.024, 0.02, [0, 1, 0], 0.012);
    for (const m of mids) beam(bags.rail, [a[0], y + h * m, a[2]], [b[0], y + h * m, b[2]], 0.012, 0.012, [0, 1, 0], 0.006);
  }
  return posts;
}
// THE GLAZING BAND: n flat facets whose faces sit at r. Each facet: the
// house's reflective glass (its glow, its window size for the shader), the
// room a hand behind it in the far-pane bag (it carries the glow), a frame of
// varnished trim (jambs, head, sill, an optional transom) and a dark
// structural mullion at its corner, proud. `skip(A, B)` drops a facet that is
// buried (in the other disc, in the core). LOD 1: glass, room, mullion.
function glazeBand(bags, Q, cx, cz, r, y0, y1, n, o) {
  const opt = o || {};
  const rc = r / Math.cos(Math.PI / n);
  const rot = opt.rot || 0;
  const rnd = opt.rnd || (() => 0.5);
  let panes = 0, lit = 0;
  for (let i = 0; i < n; i++) {
    const ta = rot + i * TAU / n, tb = ta + TAU / n, tm = (ta + tb) / 2;
    const A = ring(cx, cz, rc, ta, 0), B = ring(cx, cz, rc, tb, 0);
    if (opt.skip && opt.skip(A, B)) continue;
    const Nf = [Math.cos(tm), 0, Math.sin(tm)];
    const X = nrm(sub(B, A)), Lf = len(sub(B, A));
    const at = (s, y, d) => [A[0] + X[0] * s + Nf[0] * d, y, A[2] + X[2] * s + Nf[2] * d];
    const fw = opt.fw || 0.075;                       // the frame's width in the plane
    const isDoor = opt.doorAt !== undefined && Math.abs(Math.atan2(Math.sin(tm - opt.doorAt), Math.cos(tm - opt.doorAt))) < Math.PI / n;
    const gy0 = y0 + (isDoor ? 0.02 : fw), gy1 = y1 - fw;
    const on = opt.lights && rnd() < (opt.litK === undefined ? 0.5 : opt.litK) ? 1 : 0;
    const g = [at(fw, gy0, -0.025), at(Lf - fw, gy0, -0.025), at(Lf - fw, gy1, -0.025), at(fw, gy1, -0.025)];
    bags.glass.setGlow(on); bags.glass.setWin(Lf - 2 * fw, gy1 - gy0, 0);
    face(bags.glass, g, Nf, uvFrame(g[0], X, [0, 1, 0]));
    bags.glass.setWin(0); bags.glass.setGlow(0);
    const b = [at(0, y0, -0.55), at(Lf, y0, -0.55), at(Lf, y1, -0.55), at(0, y1, -0.55)];
    bags.pane.setGlow(on);
    face(bags.pane, b, Nf, uvFrame(b[0], X, [0, 1, 0]));
    bags.pane.setGlow(0);
    panes++; lit += on;
    // the structural mullion at A (the next facet's A closes the run)
    const mb = opt.mullionBag || bags.dark;
    beam(mb, at(0, y0 - 0.01, 0.01), at(0, y1 + 0.01, 0.01), opt.mw || 0.05, 0.055, Nf, 0);
    if (Q.lod === 0) {
      const tb2 = opt.frameBag || bags.trim, th = 0.03;
      const bev = null;
      beam(tb2, at(fw * 0.5 + 0.02, y0, -0.005), at(fw * 0.5 + 0.02, y1, -0.005), fw * 0.5, th, Nf, 0, bev);
      beam(tb2, at(Lf - fw * 0.5 - 0.02, y0, -0.005), at(Lf - fw * 0.5 - 0.02, y1, -0.005), fw * 0.5, th, Nf, 0, bev);
      beam(tb2, at(0.05, y1 - fw * 0.5, -0.005), at(Lf - 0.05, y1 - fw * 0.5, -0.005), th, fw * 0.5, [0, 1, 0], 0, bev);
      if (!isDoor) beam(tb2, at(0.05, y0 + fw * 0.5, 0.0), at(Lf - 0.05, y0 + fw * 0.5, 0.0), th + 0.012, fw * 0.5, [0, 1, 0], 0, bev);
      if (opt.transom) { const yt = y0 + (y1 - y0) * opt.transom; beam(tb2, at(fw, yt, -0.01), at(Lf - fw, yt, -0.01), th * 0.8, 0.03, [0, 1, 0], 0, bev); }
      if (isDoor) {
        // a glazed double door: the meeting stiles, a kick plate, two pull bars
        const sm = Lf / 2;
        beam(tb2, at(sm, y0, -0.005), at(sm, y1 - fw, -0.005), 0.045, th, Nf, 0, bev);
        beam(tb2, at(fw, y0 + 0.16, -0.008), at(Lf - fw, y0 + 0.16, -0.008), th, 0.14, [0, 1, 0], 0);
        for (const s of [sm - 0.12, sm + 0.12]) beam(bags.rail, at(s, y0 + 0.9, 0.03), at(s, y0 + 1.25, 0.03), 0.012, 0.012, Nf, 0);
      }
    }
  }
  return { panes, lit };
}
// a straight flight of steel stairs, a (the foot) to b (the top): two
// stringers, treads every riser, a handrail on each side
function flight(bags, a, b, w) {
  const run = sub(b, a), rise = run[1], horiz = Math.hypot(run[0], run[2]);
  if (rise < 0.2 || horiz < 0.2) return null;
  const dir = nrm([run[0], 0, run[2]]), side = nrm(crs([0, 1, 0], dir));
  const n = Math.max(2, Math.round(rise / 0.2)), riser = rise / n, tread = horiz / n;
  for (const s of [-1, 1]) {
    const o1 = mul(side, s * (w / 2 + 0.025));
    beam(bags.steel, add(add(a, o1), [0, 0.1, 0]), add(add(b, o1), [0, 0.1, 0]), 0.02, 0.1, [0, 1, 0], 0.04);
  }
  for (let i = 1; i <= n; i++) {
    const c = add(a, [dir[0] * tread * (i - 0.5), riser * i, dir[2] * tread * (i - 0.5)]);
    beam(bags.steel, add(c, mul(side, -w / 2)), add(c, mul(side, w / 2)), Math.min(0.13, tread * 0.5), 0.018, [0, 1, 0], 0);
  }
  for (const s of [-1, 1]) {
    const o1 = mul(side, s * (w / 2 + 0.05));
    const p0 = add(a, o1), p1 = add(b, o1);
    const nP = Math.max(1, Math.round(horiz / 1.0));
    for (let k = 0; k <= nP; k++) { const p = K.lerp3(p0, p1, k / nP); beam(bags.rail, p, [p[0], p[1] + 0.95, p[2]], 0.018, 0.018, dir, 0); }
    beam(bags.rail, [p0[0], p0[1] + 0.95, p0[2]], [p1[0], p1[1] + 0.95, p1[2]], 0.02, 0.018, [0, 1, 0], 0.03);
    beam(bags.rail, [p0[0], p0[1] + 0.5, p0[2]], [p1[0], p1[1] + 0.5, p1[2]], 0.012, 0.012, [0, 1, 0], 0.02);
  }
  return { n, riser, tread, dir, side };
}
// a box turned by yaw about y: centre (x, y0..y1, z), half sizes hx (along the yaw) and hz
function yawBox(bag, x, z, y0, y1, hx, hz, yaw) {
  const d = [Math.cos(yaw), 0, Math.sin(yaw)];
  beam(bag, [x, y0, z], [x, y1, z], hz, hx, d, 0);
}
// THE STEVENSON SCREEN: a white louvred box on four legs with a pitched lid
function screenBox(bags, Q, p, yaw) {
  const [x, y, z] = p, d = [Math.cos(yaw), 0, Math.sin(yaw)], s = [-d[2], 0, d[0]];
  const hx = 0.32, hz = 0.27, legH = 1.05, boxH = 0.62;
  for (const a of [-1, 1]) for (const b of [-1, 1]) {
    const q = add(add(p, mul(d, a * (hx - 0.04))), mul(s, b * (hz - 0.04)));
    beam(bags.paint, q, [q[0], y + legH + 0.02, q[2]], 0.02, 0.02, d, 0);
  }
  yawBox(bags.paint, x, z, y + legH, y + legH + boxH, hx, hz, yaw);
  yawBox(bags.paint, x, z, y + legH + boxH, y + legH + boxH + 0.05, hx + 0.06, hz + 0.06, yaw);
  if (Q.lod === 0) {
    // the louvres, a hair proud on the long faces and the ends
    for (let k = 0; k < 6; k++) {
      const yy = y + legH + 0.07 + k * 0.09;
      for (const b of [-1, 1]) {
        const c = add([x, yy, z], mul(s, b * (hz + 0.008)));
        beam(bags.paint, add(c, mul(d, -hx + 0.03)), add(c, mul(d, hx - 0.03)), 0.006, 0.018, [0, 1, 0], 0);
        const e = add([x, yy, z], mul(d, b * (hx + 0.008)));
        beam(bags.paint, add(e, mul(s, -hz + 0.03)), add(e, mul(s, hz - 0.03)), 0.006, 0.018, [0, 1, 0], 0);
      }
    }
  }
}
// a mushroom vent: a pipe, a cap and the cap's cone
function mushroom(bags, Q, p, r, h, capBag, pipeBag) {
  const segs = Q.lod === 0 ? 10 : 6;
  cyl(pipeBag, [p[0], p[1] - 0.15, p[2]], [0, 1, 0], r, h + 0.15, segs, false, { smooth: true });
  const y = p[1] + h;
  K.prismRings(capBag, K.ringN(p[0], p[2], r * 1.9, segs, 0, y + 0.06), K.ringN(p[0], p[2], r * 1.9, segs, 0, y + 0.12), true, false);
  K.apexTo(capBag, K.ringN(p[0], p[2], r * 1.9, segs, 0, y + 0.12), [p[0], y + 0.12 + r * 1.1, p[2]]);
  if (Q.lod === 0) for (let k = 0; k < 3; k++) { const a = k * TAU / 3; beam(pipeBag, [p[0] + Math.cos(a) * r, y - 0.02, p[2] + Math.sin(a) * r], [p[0] + Math.cos(a) * r * 1.4, y + 0.07, p[2] + Math.sin(a) * r * 1.4], 0.008, 0.008, [0, 1, 0], 0); }
}

// THE REPAIRS: a tar roof that has seen fifty winters is a quilt of newer
// membrane - rectangles laid between the battens, a little blacker. Each is
// a sliver of the cone itself (a partial revolve), a centimetre proud.
function patches(bag, rnd, cx, cz, R, rTop, roofAt, n, N, skip) {
  let k = 0;
  for (let i = 0; i < n * 3 && k < n; i++) {
    const L = 0.9 + rnd() * 2.4, r1 = rTop + 0.8 + rnd() * (R - rTop - 1.6 - L), r2 = r1 + L;
    const span = 2 + Math.floor(rnd() * 3), i0 = Math.floor(rnd() * N), a0 = i0 * TAU / N, a1 = (i0 + span) * TAU / N;
    if (r2 > R - 0.5 || (skip && skip(ring(cx, cz, (r1 + r2) / 2, (a0 + a1) / 2, 0)))) continue;
    revolve(bag, cx, cz, [[r2, roofAt(r2) + 0.012], [r1, roofAt(r1) + 0.012]], { segs: span, a0, a1 });
    k++;
  }
  return k;
}

// ---- the build -------------------------------------------------------------------
function plan(P) {
  // every derived dimension in one place: the build, the catalogue and the gate read the same numbers
  const d1 = { x: 0, z: 0, R: P.d1R };
  d1.drum = d1.R * 0.79; d1.lip = d1.R * 0.967; d1.glz = d1.R * 0.915;
  d1.yDrum = P.d1Ground; d1.yLip = d1.yDrum + P.d1Skirt; d1.yG0 = d1.yLip + 0.06; d1.yG1 = d1.yG0 + P.d1Glaze;
  d1.ySoff = d1.yG1 + 0.05; d1.yEave = d1.ySoff + 0.3; d1.rTop = 2.2; d1.yTop = d1.yEave + P.d1Rise;
  d1.roofAt = r => d1.yEave + (d1.R - clamp(r, d1.rTop, d1.R)) / (d1.R - d1.rTop) * P.d1Rise;
  const d2 = P.d2On ? { x: P.d2x, z: P.d2z, R: P.d2R } : null;
  if (d2) {
    d2.glz = d2.R - 1.1; d2.yF = P.d2Floor; d2.yG0 = d2.yF + 0.1; d2.yG1 = d2.yG0 + P.d2Glaze;
    d2.ySoff = d2.yG1 + 0.05; d2.yEave = d2.ySoff + 0.3; d2.rTop = 3.2; d2.yTop = d2.yEave + P.d2Rise;
    d2.roofAt = r => d2.yEave + (d2.R - clamp(r, d2.rTop, d2.R)) / (d2.R - d2.rTop) * P.d2Rise;
  }
  const t = { x: P.tx, z: P.tz, R: P.topR };
  t.yU = P.towerH; t.rIn = 3.05; t.yR = t.yU + 2.4; t.yDeck = t.yR + 0.35; t.glz = t.R - 1.9;
  t.yG0 = t.yDeck + 0.05; t.yG1 = t.yG0 + P.topGlaze; t.yC = t.yG1 + 0.05; t.rCap = t.R - 1.1; t.yRoof = t.yC + 0.4;
  // the core: an elongated octagon, battered (or a ribbed cylinder, 1974)
  t.hx0 = P.shaftW / 2; t.hz0 = P.shaftD / 2; t.hx1 = t.hx0 * 0.78; t.hz1 = t.hz0 * 0.8;
  return { d1, d2, t };
}
function octRing(t, y, yb, yt, round, n) {
  const f = clamp((y - yb) / Math.max(0.01, yt - yb), 0, 1);
  const hx = t.hx0 + (t.hx1 - t.hx0) * f, hz = t.hz0 + (t.hz1 - t.hz0) * f;
  if (round) return K.ringN(t.x, t.z, (hx + hz) / 2 * 0.72, n, 0, y);
  const c = Math.min(hx, hz) * 0.32;
  return [[hx, -hz + c], [hx, hz - c], [hx - c, hz], [-hx + c, hz], [-hx, hz - c], [-hx, -hz + c], [-hx + c, -hz], [hx - c, -hz]]
    .map(q => [t.x + q[0], y, t.z + q[1]]);
}
const inPoly = (poly, x, z, grow) => {
  // convex, plan only, grown by `grow` along each edge's outward normal
  let cx = 0, cz = 0; for (const p of poly) { cx += p[0]; cz += p[2]; } cx /= poly.length; cz /= poly.length;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    let nx = b[2] - a[2], nz = -(b[0] - a[0]); const nl = Math.hypot(nx, nz) || 1; nx /= nl; nz /= nl;
    if ((cx - a[0]) * nx + (cz - a[2]) * nz > 0) { nx = -nx; nz = -nz; }
    if ((x - a[0]) * nx + (z - a[2]) * nz > (grow || 0)) return false;
  }
  return true;
};

function build(P0, lod, F) {
  const P = Object.assign({}, DEF, P0 || {});
  const Q = { lod: lod | 0 }, hi = Q.lod === 0;
  const bags = {};
  for (const k of BAGS.concat(EXTRA)) bags[k] = Bag(k);
  const g = HG.groundFn(P);
  const Ph = houseP(P);
  const LIT = HG.litBegin();
  const rnd = rng(P.seed);
  const { d1, d2, t } = plan(P);
  const SEG = hi ? 96 : 40;
  const occ = [];
  let openings = 0, doors = 0, battens = 0;
  const gMinAround = (cx, cz, r) => { let m = Infinity; for (let i = 0; i < 16; i++) { const a = i * TAU / 16; m = Math.min(m, g(cx + r * Math.cos(a), cz + r * Math.sin(a))); } return Math.min(m, g(cx, cz)); };
  const inD1 = (x, z, pad) => Math.hypot(x - d1.x, z - d1.z) < d1.drum + (pad || 0);
  const inD2 = (x, z, pad) => d2 && Math.hypot(x - d2.x, z - d2.z) < d2.glz + (pad || 0);
  const round = Math.round(P.shaftKind) === 1;
  const shaftFoot = octRing(t, 0, 0, 1, round, 24);
  const inShaft = (x, z, grow) => inPoly(shaftFoot, x, z, grow);

  // ==== THE TWO-TIER DISC ====================================================
  // THE GROUND STOREY: the kit's wall, facet by facet, walked clockwise (so +N is
  // out), the openings dressed by the house; rubble (or panels) 45 cm thick
  {
    const n = hi ? 40 : 24, tW = 0.45, rm = d1.drum - tW / 2, rc = rm / Math.cos(Math.PI / n);
    const y0 = gMinAround(d1.x, d1.z, d1.drum) - 0.5;
    const e = tW / 2 * Math.tan(Math.PI / n);
    const doorAt = [0.0, 1.75];                    // the service door east, the front door south-south-west
    let uAcc = 0;
    for (let i = 0; i < n; i++) {
      const ta = TAU - i * TAU / n, tb = ta - TAU / n, tm = (ta + tb) / 2;
      const A = [d1.x + rc * Math.cos(ta), d1.z + rc * Math.sin(ta)], B = [d1.x + rc * Math.cos(tb), d1.z + rc * Math.sin(tb)];
      const Lf = Math.hypot(B[0] - A[0], B[1] - A[1]);
      const mx = d1.x + d1.drum * Math.cos(tm), mz = d1.z + d1.drum * Math.sin(tm);
      const buried = inD2(mx, mz, 0.6) || inShaft(mx, mz, 0.5);
      const holes = [];
      const isDoor = doorAt.some(a => ((Math.round((TAU - a) / (TAU / n) - 0.5) % n) + n) % n === i);
      if (!buried) {
        if (isDoor) holes.push({ s0: Lf / 2 - 0.58, s1: Lf / 2 + 0.58, y0: 0.0, y1: 2.25, kind: 'door' });
        else if (i % 3 === 1) holes.push({ s0: Lf / 2 - 0.42, s1: Lf / 2 + 0.42, y0: 1.05, y1: 2.0, kind: 'window' });
      }
      const v0 = bags.stone.verts;
      const W = wall(bags.stone, { A, B, y0, t: tW, topAt: () => d1.yDrum + 0.02, holes: hi ? holes : [], ext: [e, e], inner: false,
                                   endCap: [false, false], capBot: false, capTop: false, sub: hi ? 1.2 : 0 });
      // the arc runs on round the drum (the kit restarts u at every panel)
      const raw = bags.stone.raw();
      for (let v = v0; v < bags.stone.verts; v++) raw.uv[v * 2] += uAcc;
      uAcc += Lf;
      if (!W) continue;
      // THE PANELS (1974): a cover strip at every facet joint
      if (hi && Math.round(P.groundKind) === 1) { const j0 = W.P(-e, y0 + 0.3, 1), j1 = W.P(-e, d1.yDrum - 0.02, 1); beam(bags.stone, add(j0, mul(W.N, 0.012)), add(j1, mul(W.N, 0.012)), 0.03, 0.012, W.N, 0); }
      if (hi) for (const h of holes) {
        HG.dressOpening(h.kind === 'door' ? Object.assign({}, bags, { trim: bags.dark }) : bags, Ph, Q, W, h, h.y1); openings++;   // G3660: the door dark (its leaf and casing in the dark sheet's slot)
        if (h.kind === 'door') {
          doors++;
          // the step: a concrete slab at the threshold, down to the ground
          const c0 = W.P(h.s0 - 0.2, 0, 1), c1 = W.P(h.s1 + 0.2, 0, 1), o = mul(W.N, 0.65);
          const gy = Math.min(g(c0[0], c0[2]), g(c1[0], c1[2]));
          plate(bags.conc, [[c0[0], 0.0, c0[2]], [c1[0], 0.0, c1[2]], [c1[0] + o[0], 0.0, c1[2] + o[2]], [c0[0] + o[0], 0.0, c0[2] + o[2]]], Math.max(0.15, -gy + 0.25), [0, -1, 0]);
        }
      } else for (const h of holes) {
        // far: the opening is a dark pane proud of an unpierced wall
        const q = [W.P(h.s0, h.y0, 1), W.P(h.s1, h.y0, 1), W.P(h.s1, h.y1, 1), W.P(h.s0, h.y1, 1)].map(p => add(p, mul(W.N, 0.012)));
        face(bags.pane, q, W.N, uvFrame(q[0], W.X, [0, 1, 0]));
      }
    }
    occ.push({ x: d1.x, z: d1.z, r: d1.drum + 0.2, k: 0.75, soft: 1.4 });
  }
  // THE COPPER SKIRT: flaring out from the drum's head to the lip, the ledge on
  // top, radial seams
  revolve(bags.copper, d1.x, d1.z, [[d1.drum - 0.03, d1.yDrum - 0.04], [d1.lip, d1.yLip], [d1.lip, d1.yLip + 0.06], [d1.glz - 0.05, d1.yLip + 0.06]], { segs: SEG, sub: hi ? 0.9 : 0 });
  if (hi) {
    seams(bags.copper, d1.x, d1.z, d1.drum + 0.02, d1.yDrum - 0.02, d1.lip - 0.02, d1.yLip - 0.02, SEG, 1, 0.012, 0.01, 0.018);
    // the course joint half way down, a welted bead
    const f = 0.55, rm = d1.drum + (d1.lip - d1.drum) * f, ym = d1.yDrum + (d1.yLip - d1.yDrum) * f, dr = (d1.lip - d1.drum), dy = (d1.yLip - d1.yDrum), L = Math.hypot(dr, dy), nr = dy / L, ny = -dr / L;
    revolve(bags.copper, d1.x, d1.z, [[rm - dr / L * 0.03, ym - dy / L * 0.03], [rm - dr / L * 0.03 + nr * 0.018, ym - dy / L * 0.03 + ny * 0.018], [rm + dr / L * 0.03 + nr * 0.018, ym + dy / L * 0.03 + ny * 0.018], [rm + dr / L * 0.03, ym + dy / L * 0.03]], { segs: SEG });
  }
  // THE WINDOW BAND
  const skipD1 = (A, B) => false;
  const gl1 = glazeBand(bags, Q, d1.x, d1.z, d1.glz, d1.yG0, d1.yG1, Math.round(P.d1Win / 2) * 2, { skip: skipD1, lights: P.lights, litK: 0.45, rnd, transom: 0.8 });
  // THE EAVE AND THE ROOF: soffit, the copper edge, the tarred cone with its battens
  revolve(bags.dark, d1.x, d1.z, [[d1.glz - 0.06, d1.ySoff], [d1.R, d1.ySoff]], { segs: SEG, sub: hi ? 0.6 : 0 });
  revolve(bags.copper, d1.x, d1.z, [[d1.R, d1.ySoff], [d1.R, d1.yEave], [d1.R - 0.18, d1.yEave + 0.035]], { segs: SEG });
  revolve(bags.roof, d1.x, d1.z, [[d1.R - 0.18, d1.yEave + 0.035], [d1.rTop, d1.yTop]], { segs: SEG, sub: hi ? 1.1 : 0 });
  if (hi) seams(bags.roof, d1.x, d1.z, d1.R - 0.2, d1.yEave + 0.04, d1.rTop + 0.05, d1.yTop, SEG, 2, 0.018, 0.022, 0.024);
  const membrane = SETS.roof[clamp(Math.round(P.roofSet || 0), 0, SETS.roof.length - 1)] === 'render';
  if (hi && membrane) patches(bags.patch, rnd, d1.x, d1.z, d1.R - 0.2, d1.rTop, r => d1.roofAt(r) + 0.035 * (1 - 0), 9, SEG / 2, p => Math.hypot(p[0] - 4.6, p[2] + 5.4) < 1.6);
  // THE LANTERN: a curb, a short glazed drum, a shallow cap
  let lantern1 = null;
  if (P.d1Lantern) {
    const rl = d1.rTop - 0.4, y0 = d1.yTop + 0.18, y1 = y0 + 0.85;
    revolve(bags.dark, d1.x, d1.z, [[d1.rTop, d1.yTop - 0.02], [d1.rTop, d1.yTop + 0.18], [rl - 0.02, d1.yTop + 0.18]], { segs: hi ? 32 : 16 });
    glazeBand(bags, Q, d1.x, d1.z, rl, y0, y1, 16, { lights: P.lights, litK: 0.8, rnd, fw: 0.06, mw: 0.035 });
    revolve(bags.dark, d1.x, d1.z, [[rl - 0.04, y1 + 0.04], [rl + 0.32, y1 + 0.04], [rl + 0.32, y1 + 0.16]], { segs: hi ? 32 : 16 });
    revolve(bags.roof, d1.x, d1.z, [[rl + 0.32, y1 + 0.16], [0.0, y1 + 0.42]], { segs: hi ? 32 : 16 });
    lantern1 = { r: rl, top: y1 + 0.42 };
  }
  // the stack, the mast beside it, the vents and the flues
  let stack = null;
  if (P.stack) {
    const sx = d1.x + 4.6, sz = d1.z - 5.4, sr = Math.hypot(sx - d1.x, sz - d1.z), yb = d1.roofAt(sr + 0.8) - 0.15;
    const yt = d1.yTop + 2.6;
    boxAB(bags.shaft, [sx - 0.72, yb, sz - 0.72], [sx + 0.72, yt, sz + 0.72], { ny: true });
    boxAB(bags.dark, [sx - 0.82, yt, sz - 0.82], [sx + 0.82, yt + 0.12, sz + 0.82]);
    if (hi) {
      // the cladding's joints: battens up the four faces, a band at mid height
      for (const f of [-0.36, 0, 0.36]) {
        beam(bags.dark, [sx + f, yb, sz + 0.735], [sx + f, yt, sz + 0.735], 0.02, 0.012, [0, 0, 1], 0);
        beam(bags.dark, [sx + f, yb, sz - 0.735], [sx + f, yt, sz - 0.735], 0.02, 0.012, [0, 0, -1], 0);
        beam(bags.dark, [sx + 0.735, yb, sz + f], [sx + 0.735, yt, sz + f], 0.02, 0.012, [1, 0, 0], 0);
        beam(bags.dark, [sx - 0.735, yb, sz + f], [sx - 0.735, yt, sz + f], 0.02, 0.012, [-1, 0, 0], 0);
      }
      // the louvred vent near the top on the two faces you see
      for (const s of [1, -1]) boxAB(bags.dark, [sx - 0.4, yt - 0.8, sz + s * 0.72 - (s > 0 ? 0 : 0.04)], [sx + 0.4, yt - 0.3, sz + s * 0.72 + (s > 0 ? 0.04 : 0)]);
    }
    occ.push({ x: sx, z: sz, hx: 0.9, hz: 0.9, k: 0, soft: 0.5 });
    // the thin mast at its corner
    const mx = sx - 0.95, mz = sz + 0.3;
    cyl(bags.steel, [mx, d1.roofAt(Math.hypot(mx, mz)) - 0.1, mz], [0, 1, 0], 0.045, yt + 3.6 - d1.roofAt(Math.hypot(mx, mz)), hi ? 8 : 5, true, { smooth: true });
    if (hi) beam(bags.steel, [mx - 0.45, yt + 2.8, mz], [mx + 0.45, yt + 2.8, mz], 0.015, 0.015, [0, 1, 0], 0);
    stack = { x: sx, z: sz, top: yt + 0.12, mast: yt + 3.6 };
    // the galvanised vents by the lantern, the rusty flues toward the core
    for (const v of [[2.9, 1.3], [3.3, -0.8]]) mushroom(bags, Q, [d1.x + v[0], d1.roofAt(Math.hypot(v[0], v[1])), d1.z + v[1]], 0.11, 1.15, bags.rail, bags.rail);
    for (const v of [[-3.4, -4.1], [-4.1, -3.4]]) {
      const x = d1.x + v[0], z = d1.z + v[1], y = d1.roofAt(Math.hypot(v[0], v[1]));
      cyl(bags.flue, [x, y - 0.1, z], [0, 1, 0], 0.13, 2.5, hi ? 10 : 6, false, { smooth: true });
      K.prismRings(bags.flue, K.ringN(x, z, 0.2, hi ? 10 : 6, 0, y + 2.4), K.ringN(x, z, 0.2, hi ? 10 : 6, 0, y + 2.46), true, true);
      K.prismRings(bags.flue, K.ringN(x, z, 0.24, hi ? 10 : 6, 0, y + 2.62), K.ringN(x, z, 0.24, hi ? 10 : 6, 0, y + 2.67), true, false);
      K.apexTo(bags.flue, K.ringN(x, z, 0.24, hi ? 10 : 6, 0, y + 2.67), [x, y + 2.8, z]);
      if (hi) for (let k = 0; k < 3; k++) { const a = k * TAU / 3; beam(bags.flue, [x + 0.15 * Math.cos(a), y + 2.45, z + 0.15 * Math.sin(a)], [x + 0.15 * Math.cos(a), y + 2.63, z + 0.15 * Math.sin(a)], 0.01, 0.01, [0, 1, 0], 0); }
    }
  }

  // ==== THE FLAT DISC ========================================================
  let gl2 = { panes: 0, lit: 0 };
  if (d2) {
    const gm = gMinAround(d2.x, d2.z, d2.glz) - 0.45;
    // the plinth: rubble like the ground storey, from below the ground to the sill
    revolve(bags.stone, d2.x, d2.z, [[d2.glz + 0.08, gm], [d2.glz + 0.08, d2.yG0], [d2.glz - 0.1, d2.yG0]], { segs: SEG, sub: hi ? 1.0 : 0, a0: 0 });
    // the window band: skip what is buried in the drum or in the core; the entrance faces south
    const skip2 = (A, B) => (inD1(A[0], A[2], -0.05) && inD1(B[0], B[2], -0.05)) || (inShaft(A[0], A[2], -0.05) && inShaft(B[0], B[2], -0.05));
    const n2 = Math.round(P.d2Win / 2) * 2;
    gl2 = glazeBand(bags, Q, d2.x, d2.z, d2.glz, d2.yG0, d2.yG1, n2, { skip: skip2, lights: P.lights, litK: 0.15, rnd, doorAt: Math.PI / 2 + 0.12 });
    // the door's step: a concrete slab out from the threshold, down into the ground
    if (hi) {
      const ta = Math.PI / 2 + 0.12, c = ring(d2.x, d2.z, d2.glz + 0.08, ta, d2.yF), Nf = [Math.cos(ta), 0, Math.sin(ta)], Tn = [-Nf[2], 0, Nf[0]];
      const step = [add(c, mul(Tn, -1.0)), add(c, mul(Tn, 1.0)), add(add(c, mul(Tn, 1.0)), mul(Nf, 0.8)), add(add(c, mul(Tn, -1.0)), mul(Nf, 0.8))];
      plate(bags.conc, step, Math.max(0.2, d2.yF - g(c[0], c[2]) + 0.25), [0, -1, 0]);
    }
    // the eave, the copper edge and the flat cone
    revolve(bags.dark, d2.x, d2.z, [[d2.glz - 0.06, d2.ySoff], [d2.R, d2.ySoff]], { segs: SEG, sub: hi ? 0.7 : 0 });
    revolve(bags.copper, d2.x, d2.z, [[d2.R, d2.ySoff], [d2.R, d2.yEave], [d2.R - 0.18, d2.yEave + 0.03]], { segs: SEG });
    revolve(bags.roof, d2.x, d2.z, [[d2.R - 0.18, d2.yEave + 0.03], [d2.rTop, d2.yTop]], { segs: SEG, sub: hi ? 1.1 : 0 });
    const buriedSeam = th => { const p = ring(d2.x, d2.z, d2.R * 0.75, th, 0); return inD1(p[0], p[2], 1.0); };
    if (hi) seams(bags.roof, d2.x, d2.z, d2.R - 0.2, d2.yEave + 0.035, d2.rTop + 0.05, d2.yTop, SEG, 2, 0.018, 0.022, 0.024, { skip: buriedSeam });
    if (hi && membrane) patches(bags.patch, rnd, d2.x, d2.z, d2.R - 0.2, d2.rTop, r => d2.roofAt(r) + 0.03, 14, SEG / 2, p => inD1(p[0], p[2], 1.5) || inShaft(p[0], p[2], 1.0));
    // its lantern
    {
      const rl = d2.rTop - 0.4, y0 = d2.yTop + 0.18, y1 = y0 + 0.8;
      revolve(bags.dark, d2.x, d2.z, [[d2.rTop, d2.yTop - 0.02], [d2.rTop, d2.yTop + 0.18], [rl - 0.02, d2.yTop + 0.18]], { segs: hi ? 40 : 20 });
      glazeBand(bags, Q, d2.x, d2.z, rl, y0, y1, 20, { lights: P.lights, litK: 0.3, rnd, fw: 0.06, mw: 0.035 });
      revolve(bags.dark, d2.x, d2.z, [[rl - 0.04, y1 + 0.04], [rl + 0.35, y1 + 0.04], [rl + 0.35, y1 + 0.16]], { segs: hi ? 40 : 20 });
      revolve(bags.roof, d2.x, d2.z, [[rl + 0.35, y1 + 0.16], [0.0, y1 + 0.45]], { segs: hi ? 40 : 20 });
    }
    // the roof's furniture: skylight hatches, mushroom vents, a louvred box
    if (hi) {
      const hatch = (r, a) => {
        const p = ring(d2.x, d2.z, r, a, 0), y = d2.roofAt(r);
        if (inD1(p[0], p[2], 1.2) || inShaft(p[0], p[2], 0.8)) return;
        yawBox(bags.dark, p[0], p[2], y - 0.12, y + 0.32, 0.5, 0.5, a);
        const tq = K.ringN(p[0], p[2], 0.42 * Math.SQRT2, 4, a + Math.PI / 4, y + 0.325);
        face(bags.glass, tq, [0, 1, 0], q => [q[0], q[2]]);
      };
      for (const [r, a] of [[7.5, 2.4], [8.2, 3.3], [6.8, 4.1], [9.0, 1.6], [7.2, 5.2]]) hatch(r, a);
      for (const [r, a] of [[5.2, 1.0], [5.6, 2.9], [4.9, 4.6]]) {
        const p = ring(d2.x, d2.z, r, a, 0);
        if (!inD1(p[0], p[2], 1.0)) mushroom(bags, Q, [p[0], d2.roofAt(r), p[2]], 0.16, 0.45, bags.dark, bags.rail);
      }
      { const r = 6.0, a = 3.8, p = ring(d2.x, d2.z, r, a, 0), y = d2.roofAt(r);
        yawBox(bags.dark, p[0], p[2], y - 0.1, y + 0.6, 0.55, 0.38, a);
        for (let k = 0; k < 4; k++) beam(bags.dark, add(ring(d2.x, d2.z, r + 0.39, a, y + 0.12 + k * 0.12), mul([-Math.sin(a), 0, Math.cos(a)], -0.45)), add(ring(d2.x, d2.z, r + 0.39, a, y + 0.12 + k * 0.12), mul([-Math.sin(a), 0, Math.cos(a)], 0.45)), 0.008, 0.03, [0, 1, 0], 0); }
    }
    occ.push({ x: d2.x, z: d2.z, r: d2.glz + 0.2, k: 0.7, soft: 1.6 });
  }

  // ==== THE TOWER ============================================================
  // THE CORE: battered octagon (rings every two metres for the bake) with its
  // cladding battens, a few small windows; or the 1974 ribbed cylinder
  {
    let yb = Infinity; for (const p of shaftFoot) yb = Math.min(yb, g(p[0], p[2])); yb -= 0.4;
    const yt = t.yU + 0.35;
    const nr = round ? (hi ? 28 : 14) : 8;
    const levels = []; const nL = Math.max(2, Math.ceil((yt - yb) / (hi ? 2.0 : 6.0)));
    for (let k = 0; k <= nL; k++) levels.push(yb + (yt - yb) * k / nL);
    let prev = octRing(t, levels[0], yb, yt, round, nr);
    for (let k = 1; k < levels.length; k++) {
      const cur = octRing(t, levels[k], yb, yt, round, nr);
      K.prismRings(bags.shaft, prev, cur, false, false);
      prev = cur;
    }
    const rb = octRing(t, yb, yb, yt, round, nr), rt = octRing(t, yt, yb, yt, round, nr);
    if (hi) {
      // the battens: on every face of the octagon but the chamfers, every metre or so; on the cylinder, ribs every 15 degrees
      const nF = rb.length;
      for (let f = 0; f < nF; f++) {
        if (!round && f % 2 === 1) continue;
        const a0 = rb[f], a1 = rb[(f + 1) % nF], b0 = rt[f], b1 = rt[(f + 1) % nF];
        const Lb = len(sub(a1, a0));
        const nb = round ? 1 : Math.max(1, Math.round(Lb / 1.05));
        const fn = nrm(crs(sub(a1, a0), sub(b0, a0)));
        const outN = dot(fn, [a0[0] - t.x, 0, a0[2] - t.z]) > 0 ? fn : mul(fn, -1);
        for (let k = round ? 0 : 1; k < (round ? 1 : nb); k++) {
          const f2 = round ? 0 : k / nb;
          const p0 = K.lerp3(a0, a1, f2), p1 = K.lerp3(b0, b1, f2);
          if (round && f % 2) continue;
          beam(bags.dark, add(p0, mul(outN, 0.02)), add(p1, mul(outN, 0.02)), round ? 0.05 : 0.035, 0.02, outN, 0);
          battens++;
        }
      }
      // the small windows: up the east end, and on the north flank (the stair inside)
      const winOn = (fi, ys) => {
        const a0 = rb[fi], a1 = rb[(fi + 1) % rb.length], b0 = rt[fi], b1 = rt[(fi + 1) % rt.length];
        for (const y of ys) {
          const f = (y - yb) / (yt - yb);
          const L0 = K.lerp3(a0, b0, f), L1 = K.lerp3(a1, b1, f);
          const c = K.lerp3(L0, L1, 0.5), X = nrm(sub(L1, L0));
          const up = nrm(sub(K.lerp3(b0, b1, 0.5), K.lerp3(a0, a1, 0.5)));
          let Nf = nrm(crs(X, up)); if (dot(Nf, [c[0] - t.x, 0, c[2] - t.z]) < 0) Nf = mul(Nf, -1);
          if (inD2(c[0], c[2], 0.3) && y < d2.roofAt(Math.hypot(c[0] - d2.x, c[2] - d2.z)) + 0.8) continue;
          const w = 0.32, h = 0.6;
          const q = [add(add(c, mul(X, -w)), mul(up, -h)), add(add(c, mul(X, w)), mul(up, -h)), add(add(c, mul(X, w)), mul(up, h)), add(add(c, mul(X, -w)), mul(up, h))].map(p => add(p, mul(Nf, 0.025)));
          bags.glass.setGlow(P.lights ? 1 : 0); bags.glass.setWin(2 * w, 2 * h, 0);
          face(bags.glass, q, Nf, uvFrame(q[0], X, up));
          bags.glass.setWin(0); bags.glass.setGlow(0);
          beam(bags.dark, add(add(add(c, mul(X, -w - 0.07)), mul(up, -h - 0.04)), mul(Nf, 0.04)), add(add(add(c, mul(X, w + 0.07)), mul(up, -h - 0.04)), mul(Nf, 0.04)), 0.05, 0.03, up, 0);
          beam(bags.dark, add(add(add(c, mul(X, -w - 0.07)), mul(up, h + 0.04)), mul(Nf, 0.035)), add(add(add(c, mul(X, w + 0.07)), mul(up, h + 0.04)), mul(Nf, 0.035)), 0.04, 0.025, up, 0);
          for (const s of [-1, 1]) beam(bags.dark, add(add(add(c, mul(X, s * (w + 0.035))), mul(up, -h - 0.04)), mul(Nf, 0.035)), add(add(add(c, mul(X, s * (w + 0.035))), mul(up, h + 0.04)), mul(Nf, 0.035)), 0.035, 0.025, Nf, 0);
          openings++;
        }
      };
      const yw = f => yb + (t.yU - 0.9 - yb) * f;
      if (!round) { winOn(0, [yw(0.5), yw(0.75), yw(1.0)]); winOn(6, [yw(0.62), yw(0.9)]); }
      else { winOn(0, [yw(0.55), yw(0.9)]); winOn(Math.round(nr * 0.75), [yw(0.68), yw(1.0)]); }
    }
    occ.push({ x: t.x, z: t.z, hx: t.hx0 + 0.3, hz: t.hz0 + 0.3, k: 0.7, soft: 1.0 });
  }
  // THE TOP SAUCER
  const SEGT = hi ? 72 : 32;
  revolve(bags.dark, t.x, t.z, [[0.01, t.yU], [t.rIn, t.yU], [t.R, t.yR]], { segs: SEGT, sub: hi ? 0.9 : 0 });
  if (hi) seams(bags.dark, t.x, t.z, t.rIn + 0.05, t.yU + 0.03, t.R - 0.05, t.yR - 0.03, SEGT, 2, 0.012, 0.015, 0.015);
  revolve(bags.dark, t.x, t.z, [[t.R, t.yR], [t.R, t.yDeck]], { segs: SEGT });
  revolve(bags.deck, t.x, t.z, [[t.R, t.yDeck], [t.glz - 0.05, t.yDeck]], { segs: SEGT, sub: hi ? 0.6 : 0 });
  const gl3 = glazeBand(bags, Q, t.x, t.z, t.glz, t.yG0, t.yG1, Math.round(P.topWin / 2) * 2, { lights: P.lights, litK: 0.7, rnd, transom: 0.0 });
  revolve(bags.dark, t.x, t.z, [[t.glz - 0.06, t.yC], [t.rCap, t.yC], [t.rCap, t.yRoof], [t.rCap - 0.12, t.yRoof]], { segs: SEGT, sub: hi ? 0.5 : 0 });
  revolve(bags.deck, t.x, t.z, [[t.rCap - 0.12, t.yRoof], [0.0, t.yRoof + 0.12]], { segs: SEGT, sub: hi ? 1.0 : 0 });
  const roofY = r => t.yRoof + 0.12 * (1 - clamp(r / (t.rCap - 0.12), 0, 1));
  // the stair: a chord across the gallery, from the deck to the cap's rim, a landing onto the roof
  const sA = 3.35;                                    // where it climbs: the west side, seen from the east road
  let stairInfo = null, gapsRoof = [];
  if (P.stair) {
    const rs = t.glz + (t.R - t.glz) * 0.62, half = 1.55 / rs;
    const foot = ring(t.x, t.z, rs, sA - half, t.yDeck), top = ring(t.x, t.z, rs, sA + half, t.yRoof);
    stairInfo = flight(bags, foot, top, 0.62);
    // the landing, from the stair's head over the cap's rim onto the deck
    const Tn = [-Math.sin(sA + half), 0, Math.cos(sA + half)], Rn = [Math.cos(sA + half), 0, Math.sin(sA + half)];
    const c = add(top, mul(Tn, 0.35));
    const lc = [add(add(c, mul(Tn, -0.35)), mul(Rn, 0.4)), add(add(c, mul(Tn, 0.35)), mul(Rn, 0.4)), add(add(c, mul(Tn, 0.35)), mul(Rn, -1.0)), add(add(c, mul(Tn, -0.35)), mul(Rn, -1.0))];
    plate(bags.steel, lc.map(p => [p[0], t.yRoof + 0.02, p[2]]), 0.05, [0, -1, 0]);
    gapsRoof.push([sA + half - 0.08, sA + half + 0.22]);
  }
  // the rails: round the gallery, and round the roof deck with the gap where the landing arrives
  const railPostsG = railRing(bags, t.x, t.z, t.R - 0.12, t.yDeck, 1.1, SEGT, { postEvery: hi ? 2 : 4, lod: Q.lod });
  const rRail = t.rCap - 0.35;
  const railPostsR = railRing(bags, t.x, t.z, rRail, roofY(rRail), 1.05, hi ? 48 : 24, { postEvery: hi ? 2 : 4, gaps: gapsRoof, lod: Q.lod });
  // the instruments
  let mastTop = t.yRoof + 0.12, beacon = null;
  if (P.instruments) {
    const yr = t.yRoof + 0.12;
    // the mast: a steel pole on a base plate, a thinner top section, crossarms with whips
    boxAB(bags.steel, [t.x - 0.3, yr - 0.02, t.z - 0.3], [t.x + 0.3, yr + 0.08, t.z + 0.3]);
    cyl(bags.steel, [t.x, yr, t.z], [0, 1, 0], 0.08, 6.6, hi ? 10 : 6, true, { smooth: true });
    cyl(bags.steel, [t.x, yr + 6.6, t.z], [0, 1, 0], 0.035, 2.6, hi ? 8 : 5, true, { smooth: true });
    mastTop = yr + 9.2;
    if (hi) {
      for (const [y, a, L] of [[4.4, 0.4, 0.9], [5.9, 2.0, 0.7]]) {
        const d = [Math.cos(a), 0, Math.sin(a)];
        beam(bags.steel, [t.x - d[0] * L, yr + y, t.z - d[2] * L], [t.x + d[0] * L, yr + y, t.z + d[2] * L], 0.02, 0.02, [0, 1, 0], 0);
        for (const s of [-1, 1]) beam(bags.steel, [t.x + s * d[0] * L, yr + y - 0.5, t.z + s * d[2] * L], [t.x + s * d[0] * L, yr + y + 0.9, t.z + s * d[2] * L], 0.01, 0.01, d, 0);
      }
      // the stays, to the deck
      for (let k = 0; k < 3; k++) { const a = 0.6 + k * TAU / 3; beam(bags.steel, [t.x + Math.cos(a) * 2.6, roofY(2.6), t.z + Math.sin(a) * 2.6], [t.x, yr + 4.2, t.z], 0.008, 0.008, [0, 1, 0], 0); }
    }
    // the red obstruction light at the top (glows on the switch)
    {
      const yb = mastTop - 0.05, rb = 0.08;
      bags.glass.setGlow(P.lights ? 2 : 0);
      K.prismRings(bags.glass, K.ringN(t.x, t.z, rb, 8, 0, yb), K.ringN(t.x, t.z, rb, 8, 0, yb + 0.16), false, false);
      bags.glass.setGlow(0);
      K.apexTo(bags.steel, K.ringN(t.x, t.z, rb * 1.1, 8, 0, yb + 0.16), [t.x, yb + 0.24, t.z]);
      if (P.lights) { beacon = { kind: 'beacon', x: t.x, y: yb + 0.08, z: t.z, nx: 0, nz: 0, col: [1.0, 0.12, 0.08], k: 2.0, range: 60.0, beacon: 1 }; LIT.lights.push(beacon); }
    }
    // the anemometer and the vane on their own pole
    {
      const a = 0.7, r = 2.7, p = ring(t.x, t.z, r, a, roofY(r)), h = 3.2;
      cyl(bags.steel, [p[0], p[1] - 0.02, p[2]], [0, 1, 0], 0.045, h, hi ? 8 : 5, true, { smooth: true });
      if (hi) {
        const y = p[1] + h;
        cyl(bags.steel, [p[0], y, p[2]], [0, 1, 0], 0.03, 0.12, 8, true);
        for (let k = 0; k < 3; k++) {
          const b = k * TAU / 3, d = [Math.cos(b), 0, Math.sin(b)], e = add([p[0], y + 0.08, p[2]], mul(d, 0.24));
          beam(bags.steel, [p[0], y + 0.08, p[2]], e, 0.006, 0.006, [0, 1, 0], 0);
          cyl(bags.paint, add(e, mul([-d[2], 0, d[0]], -0.03)), [-d[2], 0, d[0]], 0.045, 0.06, 8, true);
        }
        // the vane, on a short arm below
        beam(bags.steel, [p[0], y - 0.45, p[2]], [p[0] + 0.5, y - 0.45, p[2]], 0.008, 0.008, [0, 1, 0], 0);
        beam(bags.paint, [p[0] + 0.5, y - 0.3, p[2]], [p[0] + 0.5, y - 0.15, p[2]], 0.004, 0.04, [0, 0, 1], 0);
        beam(bags.steel, [p[0] + 0.5, y - 0.6, p[2]], [p[0] + 0.5, y - 0.1, p[2]], 0.01, 0.01, [1, 0, 0], 0);
        beam(bags.paint, [p[0] + 0.32, y - 0.24, p[2]], [p[0] + 0.62, y - 0.24, p[2]], 0.003, 0.09, [0, 1, 0], 0);
      }
    }
    // the small sensors clamped on the roof rail (white radiation shields on short arms)
    if (hi) for (const a of [0.2, 1.3, 2.4, 4.0, 5.6]) {
      const p = ring(t.x, t.z, rRail, a, roofY(rRail) + 1.05), o = ring(t.x, t.z, rRail + 0.28, a, roofY(rRail) + 1.05);
      beam(bags.rail, p, o, 0.012, 0.012, [0, 1, 0], 0);
      for (let k = 0; k < 4; k++) K.prismRings(bags.paint, K.ringN(o[0], o[2], 0.075 - k * 0.006, 10, 0, o[1] - 0.05 + k * 0.07), K.ringN(o[0], o[2], 0.075 - k * 0.006, 10, 0, o[1] - 0.02 + k * 0.07), true, true);
    }
    // two Stevenson screens, a ceilometer box, a rain gauge, the roof hatch
    for (const [r, a] of [[3.6, 4.5], [3.5, 5.3]]) screenBox(bags, Q, ring(t.x, t.z, r, a, roofY(r)), a + Math.PI / 2);
    { const r = 3.7, a = 1.9, p = ring(t.x, t.z, r, a, roofY(r));
      yawBox(bags.conc, p[0], p[2], p[1] - 0.02, p[1] + 0.12, 0.42, 0.42, a);
      yawBox(bags.paint, p[0], p[2], p[1] + 0.12, p[1] + 0.95, 0.3, 0.3, a);
      if (hi) { const tq = K.ringN(p[0], p[2], 0.2 * Math.SQRT2, 4, a + Math.PI / 4, p[1] + 0.955); face(bags.glass, tq, [0, 1, 0], q => [q[0], q[2]]); } }
    if (hi) { const r = 2.0, a = 2.9, p = ring(t.x, t.z, r, a, roofY(r));
      beam(bags.steel, [p[0], p[1], p[2]], [p[0], p[1] + 0.9, p[2]], 0.025, 0.025, [1, 0, 0], 0);
      cyl(bags.paint, [p[0], p[1] + 0.9, p[2]], [0, 1, 0], 0.1, 0.42, 10, true, { smooth: true }); }
    { const r = t.rCap - 1.25, a = sA + 0.42, p = ring(t.x, t.z, r, a, roofY(r));
      yawBox(bags.dark, p[0], p[2], p[1] - 0.05, p[1] + 0.5, 0.55, 0.45, a);
      yawBox(bags.dark, p[0], p[2], p[1] + 0.5, p[1] + 0.56, 0.6, 0.5, a); }
  }

  // ==== THE PILLAR ===========================================================
  let pillar = null;
  if (P.obelisk) {
    const x = P.obX, z = P.obZ, gy = g(x, z), H = 5.8;
    const lv = [[gy - 0.4, 0.62], [gy + 1.5, 0.56], [gy + 3.6, 0.47], [gy + H, 0.39]];
    for (let k = 0; k + 1 < lv.length; k++) K.prismRings(bags.conc, K.ringN(x, z, lv[k][1] * Math.SQRT2, 4, Math.PI / 4, lv[k][0]), K.ringN(x, z, lv[k + 1][1] * Math.SQRT2, 4, Math.PI / 4, lv[k + 1][0]), false, false);
    boxAB(bags.conc, [x - 0.5, gy + H, z - 0.5], [x + 0.5, gy + H + 0.2, z + 0.5]);
    // the formwork's joints, a ring every lift
    if (hi) for (const y of [1.2, 2.4, 3.6, 4.8]) {
      const hw = 0.62 + (0.39 - 0.62) * (y / H) + 0.006;
      boxAB(bags.conc, [x - hw, gy + y - 0.015, z - hw], [x + hw, gy + y + 0.015, z + hw]);
    }
    // the stones heaped round its foot
    if (hi) for (let k = 0; k < 9; k++) {
      const a = rnd() * TAU, r = 0.8 + rnd() * 0.7, sx = x + r * Math.cos(a), sz = z + r * Math.sin(a), sy = g(sx, sz);
      const hs = 0.12 + rnd() * 0.18;
      beam(bags.conc, [sx, sy - 0.1, sz], [sx, sy + hs, sz], 0.15 + rnd() * 0.25, 0.1 + rnd() * 0.2, [Math.cos(a + rnd()), 0, Math.sin(a + rnd())], 0);
    }
    occ.push({ x, z, hx: 0.75, hz: 0.75, k: 0.6, soft: 0.8 });
    pillar = { x, z, top: gy + H + 0.2 };
  }

  // ==== THE GROUND SKIRT AND THE BAKE =========================================
  for (const o of occ) o.dry = true;
  if (P.aoGround) HG.buildGroundAO(bags.aoskirt, occ.filter(o => o.k > 0), g);
  const aoInfo = K.bakeAO(BAGS.map(k => bags[k]), { strength: P.ao === undefined ? 0.85 : P.ao, range: P.aoRange || 0.7, ground: g });
  let tris = 0, verts = 0; const per = {};
  const bb = { x0: Infinity, y0: Infinity, z0: Infinity, x1: -Infinity, y1: -Infinity, z1: -Infinity };
  for (const k of BAGS) {
    const d = bags[k].data(); per[k] = bags[k].tris; tris += bags[k].tris; verts += bags[k].verts;
    for (let i = 0; i < d.pos.length; i += 3) { const x = d.pos[i], y = d.pos[i + 1], z = d.pos[i + 2]; if (x < bb.x0) bb.x0 = x; if (x > bb.x1) bb.x1 = x; if (y < bb.y0) bb.y0 = y; if (y > bb.y1) bb.y1 = y; if (z < bb.z0) bb.z0 = z; if (z > bb.z1) bb.z1 = z; }
  }
  LIT.panes = gl1.panes + gl2.panes + gl3.panes; LIT.windows = gl1.lit + gl2.lit + gl3.lit;
  const stats = {
    tris, verts, per, bbox: bb, footprint: Math.PI * (d1.R * d1.R + (d2 ? d2.R * d2.R : 0)), eaveY: d1.yEave, ridgeY: mastTop, floorY: 0,
    role: 'observatory',
    discs: { d1: { R: d1.R, eave: d1.yEave, top: d1.yTop, windows: gl1.panes }, d2: d2 ? { R: d2.R, eave: d2.yEave, top: d2.yTop, windows: gl2.panes } : null,
             top: { R: t.R, underside: t.yU, deck: t.yDeck, roof: t.yRoof, windows: gl3.panes } },
    lantern: lantern1, stack, pillar, stair: stairInfo ? { kind: 'straight', steps: stairInfo.n } : null,
    rails: { gallery: railPostsG, roof: railPostsR }, openings, doors, battens, mast: P.instruments ? { top: mastTop, beacon: !!beacon } : null,
    front: { x: 0, z: d1.drum + 2.5, side: 1, depth: 0 },
    ground: g, groundAO: occ, aoFoot: null, ao: aoInfo, path: [], people: null, pier: null, lit: LIT, smoke: null, sign: null, yard: [],
  };
  return { bags, stats, P, V: { L: 2 * d1.R, w: 2 * d1.R, wallT: 0.45, floorY: 0 }, R: null, MAT: F ? F.MAT : MAT };
}

// ---- the finish: the house's, the mine's weather, and two hooks of its own ---------
// RAIN STREAKS: thin vertical runs down a surface (a noise stretched along y,
// read in world space so it runs on over every facet), darker or lighter by
// the slot. The dark sheet takes pale lime runs, the copper dark ones.
const STREAK_GLSL = `
  {
    float _s1 = hNoise(vHouseP * vec3(2.6, 0.075, 2.6) + vec3(3.0, 0.0, 7.0));
    float _s2 = hNoise(vHouseP * vec3(7.0, 0.22, 7.0) + vec3(11.0, 5.0, 2.0));
    float _st = smoothstep(0.58, 0.9, _s1 * 0.7 + _s2 * 0.3) * uStreakK;
    diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * uStreakTint, _st);
    obsStreak = _st;
  }`;
function streaks(m, k, tint) {
  const ud = m.userData || (m.userData = {});
  if (ud.obsStreaked) { ud.uStreakK.value = k; ud.uStreakTint.value.setRGB(tint[0], tint[1], tint[2]); return; }
  ud.obsStreaked = true;
  ud.uStreakK = { value: k }; ud.uStreakTint = { value: new THREE.Color(tint[0], tint[1], tint[2]) };
  const prev = m.onBeforeCompile;
  m.onBeforeCompile = sh => {
    if (prev) prev(sh);
    sh.uniforms.uStreakK = ud.uStreakK; sh.uniforms.uStreakTint = ud.uStreakTint;
    sh.fragmentShader = 'uniform float uStreakK; uniform vec3 uStreakTint; float obsStreak;\n' + sh.fragmentShader
      .replace('#include <map_fragment>', '#include <map_fragment>\n' + STREAK_GLSL)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n  roughnessFactor = clamp(roughnessFactor + obsStreak * 0.15, 0.04, 1.0);');
  };
  m.needsUpdate = true;
}
// THE RUBBLE (a placeholder for a scan): Worley cells in world space,
// squashed to slabs, each stone its own tone between two colours, the joints
// dark and rough, and a bump at the joints through the screen derivatives.
const RUBBLE_GLSL = `
  {
    vec3 _q = vHouseP / (uRubS * vec3(1.0, 0.36, 1.0));
    vec3 _ip = floor(_q), _fp = fract(_q);
    float _d1 = 9.0, _d2 = 9.0; vec3 _id = vec3(0.0);
    for (int k = -1; k <= 1; k++) for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
      vec3 _o = vec3(float(i), float(j), float(k));
      vec3 _h = rubHash3(_ip + _o);
      vec3 _r = _o + 0.1 + _h * 0.8 - _fp;
      float _d = dot(_r, _r);
      if (_d < _d1) { _d2 = _d1; _d1 = _d; _id = _h; } else if (_d < _d2) _d2 = _d;
    }
    float _e = sqrt(_d2) - sqrt(_d1);
    rubM = (1.0 - smoothstep(0.035, 0.12, _e)) * uRubK;
    rubH = smoothstep(0.0, 0.45, _e) * uRubK;
    vec3 _base = diffuseColor.rgb;
    float _bl = dot(_base, vec3(0.3, 0.59, 0.11));
    vec3 _sc = mix(uRubA, uRubB, _id.x) * (0.72 + 0.56 * _id.y);
    _sc = mix(_sc, _sc * vec3(1.05, 0.98, 0.86), step(0.78, _id.z));
    vec3 _stone = _sc * (0.55 + 0.9 * _bl / max(0.05, uRubL));
    vec3 _mortar = vec3(0.028, 0.026, 0.024);
    diffuseColor.rgb = mix(_base, mix(_stone, _mortar, rubM / max(uRubK, 0.001)), uRubK);
  }`;
function rubble(m, P) {
  const ud = m.userData || (m.userData = {});
  const K2 = clamp(P.rubble === undefined ? 1 : P.rubble, 0, 1) * (Math.round(P.groundKind) === 0 ? 1 : 0);
  if (ud.obsRubble) { ud.uRubK.value = K2; ud.uRubS.value = P.rubbleS || 0.42; return; }
  ud.obsRubble = true;
  ud.uRubK = { value: K2 }; ud.uRubS = { value: P.rubbleS || 0.42 };
  ud.uRubA = { value: new THREE.Color(0.042, 0.047, 0.043) }; ud.uRubB = { value: new THREE.Color(0.105, 0.096, 0.074) }; ud.uRubL = { value: 0.34 };
  const prev = m.onBeforeCompile;
  m.onBeforeCompile = sh => {
    if (prev) prev(sh);
    for (const k of ['uRubK', 'uRubS', 'uRubA', 'uRubB', 'uRubL']) sh.uniforms[k] = ud[k];
    sh.fragmentShader = 'uniform float uRubK, uRubS, uRubL; uniform vec3 uRubA, uRubB; float rubM; float rubH;\n' +
      'vec3 rubHash3(vec3 p) { p = vec3(dot(p, vec3(127.1, 311.7, 74.7)), dot(p, vec3(269.5, 183.3, 246.1)), dot(p, vec3(113.5, 271.9, 124.6))); return fract(sin(p) * 43758.5453); }\n' +
      sh.fragmentShader
      .replace('#include <map_fragment>', '#include <map_fragment>\n' + RUBBLE_GLSL)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n  roughnessFactor = clamp(mix(roughnessFactor, 1.0, rubM * 0.6), 0.04, 1.0);')
      .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\n' +
        '  { vec3 _dpx = dFdx(-vViewPosition), _dpy = dFdy(-vViewPosition); float _hx = dFdx(rubH) * 0.03, _hy = dFdy(rubH) * 0.03;\n' +
        '    vec3 _r1 = cross(_dpy, normal), _r2 = cross(normal, _dpx); float _det = dot(_dpx, _r1);\n' +
        '    vec3 _gr = sign(_det) * (_hx * _r1 + _hy * _r2); normal = normalize(abs(_det) * normal - _gr); }');
  };
  m.needsUpdate = true;
}
function applyFinish(P0, F) {
  const P = Object.assign({}, DEF, P0 || {});
  const M = F ? F.MAT : MAT;
  const SU = F ? F.SHADE_U : DEFAULT_FINISH.SHADE_U;
  const HF = F ? F.HF : DEFAULT_FINISH.HF;
  if (HF) HG.applyFinish(houseP(P), HF);
  for (const k of OWN) HG.shadeHouse(M[k], SU);
  // THE MINE'S WEATHER (G329): broad bleached / browned / blackened fields on
  // the sheet, the stone, the core and the concrete; the roofs greyed and
  // dusty in their own mode; never the deck slabs (a slab clouded reads as mud)
  const ck = P.clouds === undefined ? 0.45 : P.clouds;
  HG.cloudWeather(M.roof, P.roofClouds === undefined ? 0.35 : P.roofClouds, 1);
  HG.cloudWeather(M.patch, (P.roofClouds === undefined ? 0.35 : P.roofClouds) * 0.5, 1);
  HG.cloudWeather(M.copper, ck * 0.9, 0);
  HG.cloudWeather(M.dark, ck * 0.5, 0);
  HG.cloudWeather(M.shaft, ck * 0.7, 0);
  HG.cloudWeather(M.stone, ck * 0.5, 0);
  HG.cloudWeather(M.conc, ck * 0.7, 0);
  // the dressing: the house's dresser (paint maps, worn paint, the palette)
  const pick = (role, i) => SETS[role][clamp(Math.round(i || 0), 0, SETS[role].length - 1)];
  const S = HG.libSets();
  const dress = (m, role, set, col, o) => {
    const key = pick(role, set);
    HG.dressMat(m, key, col || 0, Object.assign({ flat: m.color && m.color.getHex ? m.color.getHex() : 0xaaaaaa }, o || {}));
    if (o && o.metal !== undefined && S && S[key]) m.metalness = o.metal;
  };
  dress(M.roof, 'roof', P.roofSet, P.roofCol, { nrm: 1.4, metal: pick('roof', P.roofSet) === 'galv' ? 0.75 : undefined });
  if (M.roof.color && M.roof.color.multiplyScalar) M.roof.color.multiplyScalar(P.roofTone === undefined ? 1 : P.roofTone);
  // a tar membrane is matte: the render scan's roughness is a wall's, so the roof takes a flat 0.9 instead
  if (pick('roof', P.roofSet) === 'render') { M.roof.roughnessMap = null; M.roof.roughness = 0.9; M.roof.needsUpdate = true; }
  dress(M.copper, 'copper', P.copperSet, P.copperCol, { nrm: 1.0, metal: P.copperCol ? 0.3 : undefined });
  dress(M.dark, 'dark', P.darkSet, P.darkCol, { nrm: 1.0, metal: P.darkCol ? 0.35 : undefined });
  dress(M.shaft, 'shaft', P.shaftSet, P.shaftCol, { nrm: 1.2 });
  dress(M.stone, 'stone', P.stoneSet, P.stoneCol, { nrm: 1.6 });
  dress(M.steel, 'steel', 0, 0, { nrm: 1.2, rough: 0.9 });
  HG.steelMix(M.steel, 'steelrust', P.rust === undefined ? 0.18 : P.rust);
  dress(M.rail, 'rail', 0, 0, { nrm: 1.0, rough: 0.8 });
  dress(M.flue, 'flue', 0, 0, { nrm: 1.2 });
  dress(M.paint, 'paint', 0, COL('white'), { nrm: 0.8 });
  dress(M.conc, 'conc', 0, 0, { nrm: 1.3 });
  dress(M.deck, 'deck', 0, COL('charcoal'), { nrm: 1.2 });
  dress(M.patch, 'patch', 0, Math.round(P.roofCol) ? P.roofCol : 0, { nrm: 1.6 });
  if (M.patch.color && M.patch.color.multiplyScalar) M.patch.color.multiplyScalar((P.roofTone === undefined ? 1 : P.roofTone) * 0.72);
  if (pick('patch', 0) === 'render') { M.patch.roughnessMap = null; M.patch.roughness = 0.82; M.patch.needsUpdate = true; }
  // the two hooks of its own, chained after the house's and the weather
  const sk = P.streaks === undefined ? 0.55 : P.streaks;
  const light = Math.round(P.darkCol) !== 0;
  streaks(M.dark, sk, light ? [1.55, 1.5, 1.42] : [0.72, 0.72, 0.7]);
  streaks(M.shaft, sk, Math.round(P.shaftCol) !== 0 ? [1.4, 1.37, 1.3] : [0.75, 0.74, 0.72]);
  streaks(M.copper, sk, Math.round(P.copperCol) !== 0 ? [0.62, 0.66, 0.62] : [0.75, 0.75, 0.73]);
  streaks(M.roof, sk * 0.5, Math.round(P.roofCol) !== 0 ? [1.3, 1.28, 1.22] : [0.8, 0.8, 0.78]);
  rubble(M.stone, P);
  // every slot its own program: the chains differ, the outermost hook's source does not
  for (const k of OWN) if (M[k] && !M[k].obsKeyed) { const key = 'obs:' + k; M[k].customProgramCacheKey = () => key; M[k].obsKeyed = true; }
  // the dirt: the house's line, a little higher on the rubble and the plinth
  const g = HG.groundFn(P);
  SU.uDirtTop.value = g(0, 0) + (P.dirtH || 1.1) * 0.6; SU.uDirtH.value = Math.max(0.05, P.dirtH || 1.1);
  SU.uDirtK.value = P.dirt === undefined ? 0.5 : P.dirt; SU.uNoiseK.value = P.noise === undefined ? 0.18 : P.noise;
  SU.uAOd.value = P.aoDirect === undefined ? 0.35 : P.aoDirect; SU.uSag.value = 0;
  for (const k of OWN) {
    const ud = M[k].userData && M[k].userData.dirt; if (!ud) continue;
    ud.uDirtGain.value = k === 'stone' || k === 'conc' ? 1.3 : (k === 'shaft' ? 0.8 : 0.6);
    ud.uAgeDesat.value = k === 'conc' ? 0.35 : 0.15; ud.uAgeDark.value = k === 'conc' ? 0.04 : 0.05;
    ud.uDirtOwn.value.setHex(k === 'stone' || k === 'conc' ? 0x3c372f : 0x5e5346); ud.uWander.value = 0;
  }
}
function finishReport() {
  return BAGS.map(k => { const m = MAT[k], flat = k === 'glass' || k === 'pane'; return { slot: k, map: !!m.map, nor: !!m.normalMap, rough: !!m.roughnessMap, full: flat || (!!m.map && !!m.normalMap && !!m.roughnessMap), glassy: flat }; });
}
// the bench's dice: the same building, its proportions nudged
function randomObservatory(seed) {
  const r = rng(seed); const names = Object.keys(PRESETS);
  const P = Object.assign({}, DEF, PRESETS[names[Math.floor(r() * names.length)]]);
  P.d1R = +(P.d1R * (0.9 + r() * 0.2)).toFixed(2); P.d2R = +(P.d2R * (0.85 + r() * 0.25)).toFixed(2);
  P.towerH = +(P.towerH * (0.9 + r() * 0.25)).toFixed(2); P.topR = +(P.topR * (0.9 + r() * 0.2)).toFixed(2);
  P.lights = r() < 0.3 ? 1 : 0; P.seed = seed | 0;
  return P;
}

window.METEO_GEN = { DEF, ROWS, PRESETS, BAGS, EXTRA, MAT, SETS, SET_IDX, GROUNDS, SHAFTS, CATS, catOf, plan, build, applyFinish, makeFinish, finishReport, randomObservatory };
// THE CATALOGUE: a landmark complex; its way in is the flat disc's door on the +z side
window.METEO_GEN.CATALOGUE_V = 1;
window.METEO_GEN.CATALOGUE_ALIASES = {};
// G3660 THE PAD'S OUTLINE (27_premises ground need 'ramp'): the convex hull of the drum, the flat disc and the core, each
// + 1.5 m (the user: "Keep the level pad tight around the building"); the triangulation pillar stands on its own stones
const outlineOf = p => {
  const m = 1.5, pts = [];
  const circ = (x, z, r) => { for (let i = 0; i < 24; i++) { const a = i * Math.PI / 12; pts.push([x + (r + m) * Math.cos(a), z + (r + m) * Math.sin(a)]); } };
  circ(0, 0, p.d1R); if (p.d2On) circ(p.d2x, p.d2z, p.d2R); circ(p.tx, p.tz, 4.5);
  pts.sort((u, v) => u[0] - v[0] || u[1] - v[1]);
  const cr = (o, u, v) => (u[0] - o[0]) * (v[1] - o[1]) - (u[1] - o[1]) * (v[0] - o[0]), lo = [], hi = [];
  for (const q of pts) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
  for (let i = pts.length - 1; i >= 0; i--) { const q = pts[i]; while (hi.length >= 2 && cr(hi[hi.length - 2], hi[hi.length - 1], q) <= 0) hi.pop(); hi.push(q); }
  return lo.slice(0, -1).concat(hi.slice(0, -1)).map(q => [+q[0].toFixed(2), +q[1].toFixed(2)]);
};
window.METEO_GEN.CATALOGUE = Object.keys(PRESETS).map(name => {
  const Pd = Object.assign({}, DEF, PRESETS[name]);
  const ext = P => { const p = Object.assign({}, Pd, P || {}); const x0 = Math.min(-p.d1R, p.d2On ? p.d2x - p.d2R : 0, p.tx - p.topR) - 2, x1 = Math.max(p.d1R, p.obelisk ? p.obX + 1.5 : 0) + 2;
    const z0 = Math.min(-p.d1R, p.d2On ? p.d2z - p.d2R : 0, p.tz - p.topR) - 2, z1 = Math.max(p.d1R, p.d2On ? p.d2z + p.d2R : 0, p.obelisk ? p.obZ + 1.5 : 0) + 3; return { x0, x1, z0, z1 }; };
  return { key: 'meteo/' + name, kind: 'complex', gen: 'METEO_GEN', preset: name, P: Object.assign({}, Pd), frame: 'house',
    foot: P => { const e = ext(P); return [[e.x0, e.z0], [e.x1, e.z0], [e.x1, e.z1], [e.x0, e.z1]]; }, keepOut: 4,
    ground: { need: 'ramp', maxSlope: 0.06, falloff: 8, standing: 'slab', outline: P => outlineOf(Object.assign({}, Pd, P || {})) },
    size: P => { const e = ext(P); return { L: e.x1 - e.x0, w: e.z1 - e.z0 }; },
    hooks: P => [{ name: 'door', kind: 'path', p: [0, 0, ext(P).z1], dir: [0, 0, 1] }], hooksOf: () => [],
    lod: { dist: [0, 300, 900, 2500] }, slots: { lights: 'stats.lit.lights', ao: 'stats.groundAO' },
    tags: ['landmark', 'meteo', 'observatory', 'mountain'], role: 'meteo', cat: catOf(name), headless: true, gate: 'HOUSE' };
});
})();
