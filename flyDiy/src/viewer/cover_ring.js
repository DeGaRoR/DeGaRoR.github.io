// ============================================================================
// cover_ring.js — THE COVER RING (G454.13, BIOMES-IN-GAME-2026-09-20.md L2 + L3):
// the grass, the flowers, the rocks and the bushes of the biome, in a ring
// around the EYE.
//
// The trees stream in 1 km chunks because a tree is seen from 5 km; a tuft is
// seen from 200 m and only from low, so the cover is not a chunk layer - it is
// a ring of 32 m CELLS around the camera's ground point, each cell planted
// once (hashed on its index, so the same cell is the same cover for ever),
// kept while it is within reach, dropped beyond. Nothing is regenerated as
// the eye moves inside the ring: the fade is in the vertex shader (trees.js
// fadeHook: full to `near`, (1 - t)^(1 + 2 taper) to nothing at `reach`, and
// gone above `aglOff` metres of height), so a cell is planted at FULL density
// and thins per frame by its distance to the eye. The rules are the bench's
// (tools/_trees.html, G454.5-G454.10), read from the same numbers:
//   the mix's row per species: proportion, density (per m2), patch (beds of
//     `patch` metres holding `patchShare` of the area at density / share),
//     size (a rock's, per setting); the mix's forest: under (shrubs / 1000 m2),
//     rocks (/ 1000 m2), reach, coverNear, taper, blotch / blotchM (a species'
//     density drifts by area), coverSpread (the tufts' size jitter);
//   the species' place: hMin / hMax (a bush, uniform in metres), bury (a rock,
//     the fraction of its height under the ground), vary (a tuft's own
//     lightness jitter), lift + contrast (the tuft's colour: THE GROUND'S AT
//     ITS FOOT - the two set means of the code's row through the shared
//     fields' mixK and shade, x lift, the max channel capped at 0.7 - and the
//     texel flattened toward its map's mean by contrast), noTint (a flower
//     keeps its picture), aspect + maps (a flower: three crossed cards).
// The biome at a point is the walker's (ctx.biomeAt: the terrain-type code at
// the ground's wobbled position -> the mix), so the grass stands on the set the
// ground draws there. The set means are the splat manifest's
// (SPLAT_TEX_SETS[i].mean, linear) or the table below measured from the same
// files. Covers cast no shadow (the bench's rule); bushes and rocks do.
//
//   COVER_RING.make(THREE, ctx) -> ring
//     ctx = { scene, world, camera, treeBuild, treeList, LEAF (TREE_LEAF), BIO, GF,
//             biomeAt(x, z, r) -> mixName | null, okAt(x, z) -> bool (land, not paved) }
//     ring.update()            once a frame, after the camera is placed
//     ring.get() / ring.set(o) the dials (F8): on, reach, near, taper, aglFull,
//                              aglOff, density, budgetMs, cell
//     ring.stat()              cells live / queued, instances, the last build's ms
//     ring.scar(prims)         G2358 (DMG-SCAR): a crash's scar culls the grass (and the shrubs, the debris) under it;
//                              ring.scar(null) plants it back
//     ring.dispose()
// ============================================================================
'use strict';
var COVER_RING = (() => {
  // the library's means (linear rgb, the importer's measure, carried by ground_tex.js), until the
  // manifest carries them (SPLAT_TEX_SETS[i].mean)
  const MEANS = { beach: [0.2826, 0.2371, 0.196], rocksA: [0.2155, 0.1901, 0.107], rocksB: [0.1648, 0.1158, 0.046], mud: [0.0897, 0.0702, 0.0458],
    leaves: [0.2264, 0.1177, 0.0461], cliff: [0.3136, 0.1726, 0.11], rocksG: [0.2521, 0.2134, 0.1638], rockyA: [0.0807, 0.0773, 0.0122],
    rockyB: [0.0855, 0.053, 0.0176], grassRock: [0.169, 0.1211, 0.0241], forestAir: [0.1259, 0.083, 0.026], snowAir: [0.2491, 0.2483, 0.3039],
    lush: [0.0584, 0.1065, 0.0218], grass: [0.119, 0.1528, 0.0305], pebble: [0.2178, 0.2034, 0.1649], dry: [0.3005, 0.2486, 0.1239], dirt: [0.1326, 0.1085, 0.0826] };
  const meanRaw = key => {
    if (typeof SPLAT_TEX_SETS !== 'undefined' && SPLAT_TEX_SETS) { const s = SPLAT_TEX_SETS.find(x => x.key === key); if (s && s.mean) return s.mean; }
    return MEANS[key] || [0.15, 0.15, 0.08];
  };
  // THE SET'S MEAN IN THE BENCH'S UNITS - which is the whole of why the game's grass was a
  // black mask while the bench's, on the SAME dials, is a meadow.
  //
  // The bench (tools/_trees.html, GROUND_MEANS) measures a ground set by drawing it to a
  // canvas and averaging the BYTES, then stores that through `new THREE.Color(r/255, ...)`,
  // which reads its arguments in the WORKING (linear) space. So the number the tuft is
  // multiplied by is the texture's sRGB mean USED AS IF IT WERE LINEAR. That is not
  // colour-managed, and it is also the number every cover dial in the payload was fitted
  // against - `lift`, `contrast`, `light`, all of them.
  // This file instead took means.json, which holds the TRUE LINEAR means, and then applied
  // the splat's hand grade and G485's normalisation to the imagery on top. Measured on the
  // two sets the grassland mix uses:
  //     dry    bench 0.581,0.533,0.383   here 0.3005 x 0.19 = 0.057   -> 10.2x darker
  //     grass  bench 0.378,0.426,0.190   here 0.1190 x 0.37 = 0.044   ->  8.6x darker
  // With the same `lift` that lands a tuft's instanceColor at ~0.006 - an albedo where grass
  // is 0.10-0.20 - so the texel was multiplied into nothing and what reached the screen was
  // sky ambient on a silhouette. It is also why setting `contrast` and `sat` changed nothing
  // in an A/B: they are upstream of a multiply by zero.
  //
  // So the mean is handed over the bench's way: the set's mean sRGB-ENCODED, and no grade and
  // no normalisation, because the bench has neither. srgbEncode(linear mean) reproduces the
  // bench's measured GROUND_MEANS to within 1 % on both sets (dry 0.584 vs 0.581 measured,
  // grass 0.380 vs 0.378), so no second table has to ship.
  // If the drawn ground then reads dark under the tufts, it is the GROUND that moves: the
  // bench's other rule is that the ground wears the grass's colour, not the reverse.
  const srgbEnc = v => (v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055);
  const meanOf = key => meanRaw(key).map(srgbEnc);
  const hsh = (ix, iz) => { let h = (ix * 374761393 + iz * 668265263 + 1013904223) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
  const rng = seed => { let s = seed >>> 0 || 1; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; };
  const hashStr = str => { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
  const vnoise = (x, z, cell, seed) => {
    const fx = x / cell, fz = z / cell, ix = Math.floor(fx), iz = Math.floor(fz);
    const tx = fx - ix, tz = fz - iz, sx = tx * tx * (3 - 2 * tx), sz = tz * tz * (3 - 2 * tz);
    const n = (a, b) => hsh(a * 7 + seed * 131, b * 13 + seed * 17);
    return (n(ix, iz) * (1 - sx) + n(ix + 1, iz) * sx) * (1 - sz) + (n(ix, iz + 1) * (1 - sx) + n(ix + 1, iz + 1) * sx) * sz;
  };
  const smooth = (lo, hi, v) => { const t = Math.max(0, Math.min(1, (v - lo) / Math.max(1e-6, hi - lo))); return t * t * (3 - 2 * t); };
  // ---- THE BEDS: where a cover row with a `patch` grows (fireweed, foam, bunchberry) ----------
  // The bench plants a bed as a DISC of radius `patch` round a random centre, beds covering
  // 0.25 x patchShare of the ground - the user: "super circular spots". This file thresholded
  // one octave of value noise at 1 - bedFrac instead, and that never delivered the area: a
  // bilinear value noise has thin tails, so measured on the game's own noise the beds covered
  // 0.87 % where foam and bunchberry intend 6.25 % (14 % of it) and 0.21 % where fireweed
  // intends 3 % (7 %) - a handful of specks at the noise's peaks, which is why fireweed was
  // never seen. The count was scaled up for an area that never materialised.
  // THE BENCH'S SHAPE, LESS ROUND. A thresholded noise field cannot hold a bed's SIZE and the
  // beds' SPACING at once (tried: a fine field shreds into slivers, a coarse one makes a few huge
  // blobs), and the bench's own method can: centres, and a radius of `patch`. So its structure
  // is kept and only the outline changes -
  //   - one bed per square of side patch x sqrt(pi / share), its centre jittered inside it: the
  //     beds cover the intended share by construction, as the bench's centres do
  //   - its radius `patch` x a scale of its own (0.7 - 1.3: the bench gives every bed its own
  //     density; here its own size), turned by three low harmonics of the angle, so a bed is
  //     lobed rather than a disc
  //   - a rim that wobbles with a small noise, and a soft ramp across it, so the tufts thin out
  //     raggedly into the grass instead of stopping on an outline
  // Deterministic and world-anchored: a bed is where it is whatever the eye does.
  const BED_NORM = 1.0;    // measured: with this the three flowers realise their intended share to within a few %
  const bedKeep = (x, z, patch, seed, frac) => {
    const sp = patch * Math.sqrt(Math.PI / frac), cx0 = Math.floor(x / sp), cz0 = Math.floor(z / sp);
    let best = 0, near = 0;
    for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
      const ci = cx0 + i, cj = cz0 + j;
      const bx = (ci + 0.15 + 0.7 * hsh(ci * 3 + seed, cj * 5 - seed)) * sp;
      const bz = (cj + 0.15 + 0.7 * hsh(ci * 7 - seed, cj * 11 + seed)) * sp;
      const sc = 0.7 + 0.6 * hsh(ci * 13 + seed * 3, cj * 17 + 1);
      const dx = x - bx, dz = z - bz;
      if (dx * dx + dz * dz > (patch * sc * 2.4) * (patch * sc * 2.4)) continue;
      // its own oval: stretched 1 - 1.6x along an axis of its own, then its outline turned by
      // weak low harmonics - irregular, and never one repeated motif
      const psi = hsh(ci * 29 + 3, cj * 31 - seed) * 3.1416, el = 1 + 0.6 * hsh(ci * 37 - 5, cj * 41 + seed);
      const cs = Math.cos(psi), sn = Math.sin(psi), u = (dx * cs + dz * sn) / Math.sqrt(el), v = (dz * cs - dx * sn) * Math.sqrt(el);
      const d = Math.hypot(u, v), th = Math.atan2(v, u), ph = hsh(ci * 19 + 7, cj * 23 + seed * 5) * 6.2832;
      const r = patch * sc * BED_NORM * (1 + 0.20 * Math.sin(2 * th + ph) + 0.12 * Math.sin(3 * th + ph * 1.7) + 0.07 * Math.sin(5 * th + ph * 2.3));
      const rim = r * (1 + 0.5 * (vnoise(x, z, patch * 0.55, seed + 91) - 0.5));
      const k = 1 - smooth(rim * 0.8, rim * 1.12, d);
      if (k > best) best = k;
      const nr = 1 - smooth(rim * 1.1, rim * 2.2, d);                  // FLOWER-CLUMPS: how near a bed's outskirts (the strays)
      if (nr > near) near = nr;
    }
    BED.near = near;
    return best; };
  // FLOWER-CLUMPS (the user 8 Nov: "the flowers ... lack variation, in size, in value, in spread, in the way they clump"):
  // bedKeep's last outskirts reading (0 .. 1 out to about twice a bed's radius), for the strays the planting loop lets out
  const BED = { near: 0 };

  // ---- THE GRASS FIELD'S TABLES (GRASS-DENSE G2563; GRASS-STUDY §4.4) ---------------------------------------------------
  // the species the field plants (the reed, the one grass of every biome since G551) and, per MIX, the tuft's length: `h` its
  // median top (m), `sigma` the lognormal spread, `dens` a factor on the field's tufts a square metre (1 = the meadow), and the
  // clump field's cell / amplitude (neighbours share a length). A mix row of the reed may carry its own h / sigma / dens (the
  // biome's grass card, TYPES > biome) - the row wins. A mix not named is the meadow's.
  const FIELD_SPECIES = ['grass_reed'];
  // THE ROOT GRADIENT (G2571, trees.js ROOT_FS): one uniform for the reed's material, whichever ring plants it - the field's
  // `root` / `rootH` write it each frame (x strength, y the height share, z the tufts' top in the model's units); 0 = today's
  const ROOT_U = { value: (typeof THREE !== 'undefined' && THREE.Vector4) ? new THREE.Vector4(0.6, 0.8, 100, 0) : { x: 0.6, y: 0.8, z: 100, w: 0, set() {} } };   // the field is grass_reed: MID
  // THE ROOT ON EVERY SMALL PLANT (VEG-ROOT, LOOK-1 9 Nov; the user: "apply it to every single grass in the game ... even the
  // bushes ... even the flowers", NOT the trees - they never take the ring's fade): ONE ROW PER KIND, [strength, the share of
  // the plant's height it fades out by], a collection's own `place.root` / `place.rootH` wins; one vec4 per species, z its top
  // in the model's units. The depth is the sheds' (_hangar_gen footDirt: the dark foot 0.5 strong), on the plant's own height.
  // Rocks and debris: none (a stone is not shaded by its own foot). The reed keeps ROOT_U (the field's dials, live).
  // THREE LEVELS (the user, 10 Nov ~21:30): LOW for every grass and flower (a little under the first day's 0.6), MID the first day's
  // value, HIGH the strong one; HIGH on the dead grass and the three flowers that read too bright (fireweed, bunchberry, foam flower),
  // MID on the grasses in the medium tones. Bushes: none (the 17:00 verdict). [strength, the share of the height it fades out by]
  const FIELD_MATS = [];
  // (the key's weight, fieldKeyW, is in the ring: it needs the ring's tintMean)
  const ROOT_LEVEL = { low: [0.5, 0.7], mid: [0.6, 0.8], high: [0.95, 1.3] };   // (22:20, the user: the fade over half the height was what read too light - LOW fades out at 70 %, MID at 80 %, the darkness kept)
  const ROOT_SPECIES = { grass_dry: 'high', flower_fireweed: 'high', flower_bunchberry: 'high', flower_foam: 'high', grass_scan: 'mid', grass_plates: 'mid', grass_reed: 'mid' };
  // (17 Nov, the user's review: "apply the bottom-up gradient that we have applied to everything" - on ALL the little bushes: the
  // shrub kind takes MID, the 10 Nov "bushes: none" verdict superseded)
  const ROOT_KIND = { cover: ROOT_LEVEL.low, flower: ROOT_LEVEL.low, shrub: ROOT_LEVEL.mid };
  const ROOT_SP = new Map();
  const rootOf = (c, kind, top) => {
    let u = ROOT_SP.get(c.name);
    if (!u) { const d = ROOT_LEVEL[ROOT_SPECIES[c.name]] || ROOT_KIND[kind], pl = c.place || {};
      u = { value: new THREE.Vector4(pl.root != null ? +pl.root : d[0], pl.rootH != null ? +pl.rootH : d[1], 1e-3, 0), kind }; ROOT_SP.set(c.name, u); }
    u.value.z = Math.max(u.value.z, top); return u;
  };
  // the rig's and the rail's handle: VEG_ROOT.set('grass_dry', 0.95, 1.3) (a species, a kind, or 'all'; strength null keeps it); rows() reads them
  if (typeof window !== 'undefined') window.VEG_ROOT = {
    rows: () => { const o = {}; for (const [n, u] of ROOT_SP) o[n] = [u.kind, +u.value.x.toFixed(3), +u.value.y.toFixed(3), +u.value.z.toFixed(3)]; return o; },
    set: (kind, x, y) => { let n = 0; for (const [nm, u] of ROOT_SP) if (kind === 'all' || u.kind === kind || nm === kind) {
      if (x != null) u.value.x = Math.max(0, Math.min(1, +x)); if (y != null) u.value.y = Math.max(0.01, +y); n++; } return n; },
  };
  // THE LAWN'S DEFAULTS (GRASS-CARDS; the ring's dials over the field's). dens: cards / m2 where the ground is fully cut; cutH / cutSigma
  // the mown length and its lognormal spread; tallH / tallSigma the cut beside a soft strip (coverAt `tall`); stripH a grass strip's
  // running surface; lean: the three leaning plates drawn too (1) or the upright three alone (0); reach / near: the fade's (m); hRef the
  // size fade's reference length (LOOK-1: never the reed's 0.3 - an 8 cm card would fade at the eye)
  const LAWN_ON = true;   // ON (GRASS-CARDS 17 Nov, the user: "d is best looking" - the top rung D; the GRAPHICS row 'mown grass' picks the rung per preset; ?lawn=0 the A/B)
  const LAWN_DEF = { cell: 4, block: 8, reach: 20, near: 6, taper: 1, aglFull: 20, aglOff: 70, aglPre: 110, budgetMs: 2, preBudgetMs: 1, maxCells: 600,
    dens: 300, cutH: 0.10, cutSigma: 0.2, tallH: 0.4, tallSigma: 0.3,   /* tallH 0.4: grass-edge's tall band (the user: 'taller grass on the strip side') */ stripH: 0.06, stripSigma: 0.15, lean: 1, hRef: 0.08, sizeFade: 1, sizeMax: 1.5,
    colour: 1, match: 1, vary: 0.06, tier: 1, trunc: 1, minCut: 0.05, lawnWet: 0.3, tallCards: 0, green: 0, texGrass: 0, weeds: 0, root: 0 };   // lawnWet: a square's ground over the drawn water it needs (m)
  const LAWN_SPECIES = ['grass_plates'];
  const LAWN_BUF = { cap: 0, xs: [], col: [], rand: [] };   // buildLawn's scratch (emitField copies out of it)
  // THE ALPINE ROCKS (MOUNTAIN-VEG 22 Nov; the user: "we need a lot more rocks in the alpine section ... in the mountain region where there
  // are no trees anymore, then rocks are a bit like trees" and "not to land very easily on mountain tops"): ?alprocks=0 = as before. On:
  // a mix's forest.rockUp [h0, h1, k] multiplies its rocks by 1 + k x smoothstep(h0, h1, the cell's ground) and fades the rows' exposed
  // rule out over the same band (the flat summits keep their rocks); forest.alpRockK multiplies a mix's rocks (the scree); the rocks'
  // own ring registers its big rocks as trunk-law hit sets (TREE_HITS.lying, world.treeHits: the solver meets them as it meets trees)
  // (THE LAB BUILD ONLY, PERF-LEAD 22 Nov: OFF unless ?alprocks=1. MOUNTAIN-VEG's own verdict in game this morning: almost no
  // visible change for 45.6 k rocks, 621 hit sets and a worst cell of 27.8 ms; it is being retuned. So the lab's BASE rows
  // are the game as it ships, and ?alprocks=1 is the scatter's price tag. Its own branch keeps its default.)
  let ALP_ON = false; try { const m = /[?&]alprocks=([01])/.exec(location.search); if (m) ALP_ON = m[1] === '1'; } catch (e) {}
  const FIELD_ON = true;   // the grass field's default (train 43: off; train 44: on - its cost under today's on every view, G2567)
  // (the size fade's ceiling is the field's `sizeMax`: a tuft taller than the reference reaches at most sizeMax x the reach - trees.js FADE_VS uFadeSizeMax)
  const FIELD_TYPES = {
    grassland:     { h: 0.30, sigma: 0.35, dens: 1.0 },                      // heath (2): the meadow, the reference
    muskeg:        { h: 0.40, sigma: 0.30, dens: 0.8, clumpM: 1.5, clumpAmp: 0.4 },   // muskeg (3) and scrub (7): sedge-like tussocks
    conifer_scrub: { h: 0.35, sigma: 0.35, dens: 0.9 },                      // dense scrub (14)
    conifer:       { h: 0.20, sigma: 0.30, dens: 0.35 },                     // the forest floor: short, sparse, shaded (13)
    conifer_young: { h: 0.20, sigma: 0.30, dens: 0.35 },                     // forest (8)
    conifer_steep: { h: 0.20, sigma: 0.30, dens: 0.35 },                     // rock / cliff (6, 12)
    deciduous:     { h: 0.25, sigma: 0.35, dens: 0.5 },
    borders:       { h: 0.40, sigma: 0.40, dens: 1.1 },                      // lush (15): the field edge
    village:       { h: 0.18, sigma: 0.25, dens: 0.6 },                      // built (10)
    city_trees:    { h: 0.15, sigma: 0.25, dens: 0.5 },                      // the town's wood (16)
    // (16 Nov, with MOUNTAIN-VEG: its mix 'subalpine', BIOMES 19 via BIO.mixHere above the 450 -> 600 m ramp; the user: 'the ground
    //  covers in these altitudes need a lot more grass') short, dense, in clumps - the alpine turf between the blueberries
    subalpine:     { h: 0.18, sigma: 0.30, dens: 0.9, clumpM: 2, clumpAmp: 0.35 },
    // THE BARE BIOMES (the user 9-10 Oct: "add grass where it is bare"): no reed row and no cover in their mixes, so nothing grew
    // there; `fill` plants the field's own sparse grass in them all the same (a mix row of the reed, once the user adds one on the
    // biome's card, wins). The land test still keeps it off sand, water and paving (okAt): what grows is on their grassy ground
    shore:         { h: 0.45, sigma: 0.35, dens: 0.15, fill: 1 },           // sand (4): dune grass inland of the beach
    scree:         { h: 0.15, sigma: 0.30, dens: 0.2, fill: 1 },            // scree (5): short tufts between the stones
    shingle:       { h: 0.30, sigma: 0.35, dens: 0.1, fill: 1 },            // shingle (11): the upper shore's tufts
    // 19 SUBALPINE (the user 16 Nov: "not fields of grass ... patches of bushes, weeds, moss carpets, and a lot rocks"): the grass in
    // patches (fieldPatch m, over fieldShare of the ground), the rest left to the shrub cards, the flowers and the stones
    // (17 Nov, the user's review: "You would expect to see that with some lush grass there. That is just not there") lush over most of it
    subalpine:     { h: 0.50, sigma: 0.35, dens: 1.1, fieldPatch: 12, fieldShare: 0.75 },
    // 18 LAKESHORE (the user 17 Nov, the floatplane lake: "Tall, lush grass is what strikes me first"): tall, dense, lifted toward a lush
    // green over the ground's colour (tint, a multiplier) and never dark (its own floor over the field's minAlb)
    lakeshore:     { h: 0.85, sigma: 0.30, dens: 1.8, tint: [0.85, 1.25, 0.75], minAlb: 0.10 },
  };
  const FIELD_MEADOW = FIELD_TYPES.grassland;
  // GRASS ON GREEN (LOOK-1 15 Nov; the user: "everything green should get some grass ... Flight simulator would spawn grass on
  // anything colored greenish. Green ground without grass looks bad"): the ground AS DRAWN decides too, not only its type's row.
  // greenOf(linear rgb) -> 0..1: how green the drawn ground reads - its green over its red past `lo` across `span`, its blue
  // under its green, and not black. The library's sets: lush 1.82 -> 1, grass 1.28 -> 0.77; dry 0.83, dirt 0.82, mud 0.78,
  // grassRock 0.72, forest floor 0.66, snow (blue over green) -> 0. A green node grows at least `greenDens` x its greenness,
  // the length its type's row (or the meadow's where the type has none) - so a green verge, field or slope is never bare.
  // GRASS BY THE TEXTURE DRAWN (16 Nov; the user: 'several ground layers might use the same texture ... the texture rocks+grass'): the
  // grass each splat set shows, 0..1 - so the same picture grows the same grass whatever its class (grassRock is heath's 2, the scrub's 7
  // and the dense scrub's 14, at 1.0 / 0.2 / 0.9 by their rows). A set not named grows none (dirt, mud, sand, rock faces, snow)
  const SET_GRASS = { grass: 1, lush: 1, grassRock: 0.8, dry: 0.6, forestAir: 0.35, rocksA: 0.3, rockyA: 0.2, rockyB: 0.15, leaves: 0.15, rocksG: 0.1 };
  const greenOf = (c, lo, span) => {
    if (!c || !(c[1] > 0.02) || c[2] >= c[1]) return 0;
    const t = (c[1] / Math.max(1e-3, c[0]) - lo) / span; if (!(t > 0)) return 0;
    const s = Math.min(1, t); return s * s * (3 - 2 * s);
  };
  // THE TUFT (GRASS-STUDY §4.2): the shipped patch's CARDS (its connected strips, by the index buffer) grouped K nearest to
  // nearest, each group one small geometry - the patch's own vertices, normals, uvs and AO, the group moved as a whole so its
  // foot is at the origin (a card is not bent, cut or redrawn). Of all the tufts the `keep` closest to the median one (its top,
  // its triangles) are the variants a draw holds, as the three patches were. -> [{ geo, top (units), tris }]
  function tuftsOf(THREE, geos, K, keep) {
    const all = [];
    for (const geo of geos) {
      const P = geo.attributes.position, I = geo.index; if (!P || !I) continue;
      const nv = P.count, idx = I.array, nt = idx.length / 3;
      const par = Int32Array.from({ length: nv }, (_, i) => i), f = i => { while (par[i] !== i) i = par[i] = par[par[i]]; return i; };
      const u = (a, b) => { a = f(a); b = f(b); if (a !== b) par[a] = b; };
      for (let t = 0; t < nt; t++) { u(idx[t * 3], idx[t * 3 + 1]); u(idx[t * 3], idx[t * 3 + 2]); }
      const comp = new Map();
      for (let t = 0; t < nt; t++) { const r = f(idx[t * 3]); let c = comp.get(r); if (!c) comp.set(r, c = { tris: [], vs: new Set() }); c.tris.push(t); for (let k = 0; k < 3; k++) c.vs.add(idx[t * 3 + k]); }
      const cards = [...comp.values()].map(c => { let sx = 0, sz = 0; for (const i of c.vs) { sx += P.getX(i); sz += P.getZ(i); } return Object.assign(c, { x: sx / c.vs.size, z: sz / c.vs.size }); });
      cards.sort((a, b) => (b.x * b.x + b.z * b.z) - (a.x * a.x + a.z * a.z));   // outermost first (the study's greedy groups)
      const used = new Set();
      for (const a of cards) { if (used.has(a)) continue; used.add(a);
        const near = cards.filter(b => !used.has(b)).sort((p, q) => Math.hypot(p.x - a.x, p.z - a.z) - Math.hypot(q.x - a.x, q.z - a.z)).slice(0, K - 1);
        near.forEach(b => used.add(b));
        all.push({ geo, cards: [a, ...near] }); }
    }
    for (const t of all) { let sx = 0, sz = 0, n = 0, top = 0, tris = 0;
      for (const c of t.cards) { for (const i of c.vs) { sx += t.geo.attributes.position.getX(i); sz += t.geo.attributes.position.getZ(i); n++; top = Math.max(top, t.geo.attributes.position.getY(i)); } tris += c.tris.length; }
      t.cx = sx / n; t.cz = sz / n; t.top = top; t.tris = tris; }
    const med = k => { const a = all.map(t => t[k]).sort((x, y) => x - y); return a[a.length >> 1] || 1; };
    const mTop = med('top'), mTris = med('tris');
    const pick = all.slice().sort((a, b) => (Math.abs(a.top - mTop) / mTop + Math.abs(a.tris - mTris) / mTris) - (Math.abs(b.top - mTop) / mTop + Math.abs(b.tris - mTris) / mTris)).slice(0, keep);
    return pick.map(t => {
      const src = t.geo, map = new Map(), out = new THREE.BufferGeometry(), ix = [];
      for (const c of t.cards) for (const tri of c.tris) for (let k = 0; k < 3; k++) { const v = src.index.array[tri * 3 + k]; if (!map.has(v)) map.set(v, map.size); ix.push(map.get(v)); }
      const order = [...map.keys()];
      for (const name in src.attributes) {   // the raw stored values, the same type (a normalised byte stays one)
        const A = src.attributes[name], sz = A.itemSize, IL = A.isInterleavedBufferAttribute, raw = IL ? A.data.array : A.array, st = IL ? A.data.stride : sz, o0 = IL ? A.offset : 0;
        const arr = new raw.constructor(order.length * sz);
        order.forEach((v, j) => { for (let q = 0; q < sz; q++) arr[j * sz + q] = raw[v * st + o0 + q]; });
        if (name === 'position') for (let j = 0; j < order.length; j++) { arr[j * 3] -= t.cx; arr[j * 3 + 2] -= t.cz; }   // the tuft's foot to the origin, whole
        out.setAttribute(name, new THREE.BufferAttribute(arr, sz, A.normalized)); }
      out.setIndex(ix); out.computeBoundingSphere();
      return { geo: out, top: t.top, tris: t.tris };
    });
  }

  function make(THREE, ctx) {
    const { scene, world, camera, treeBuild, treeList, LEAF, BIO, GF } = ctx;
    // THE GRASS FIELD (GRASS-DENSE G2563, futureDesigns/GRASS-STUDY-2026-10.md §4): ctx.layer 'grass' makes a SECOND ring of
    // this file that plants the grass alone - the same cards cut into tufts of `cards` (protosOf: tuftsOf), on 16 m cells
    // drawn by 2 x 2 blocks, ten times the cards a square metre a third the height, the length by the ground (FIELD_TYPES),
    // cut beside and on the runways (the premises' coverAt `cut` / `surf`), in the ground's drawn colour (ctx.groundMeanAt),
    // to its own reach by its own fade set (trees.js fadeSet, with the size fade), and planted by TIERS (a cell keeps the
    // prefix of its candidate stream its nearest distance can show). The first ring then leaves the grass to it (ctx.owned).
    // THE LAWN (GRASS-CARDS, 16 Nov; the user: "when the grass is really small, they look just like little dots ... all mown grass needs
    // to be addressed through grass cards"): ctx.layer 'lawn' is a THIRD ring of this file, the field's machinery (its own S, fade set,
    // reach, tiers, blocks), planting the bench's crossed-blade cards `grass_plates` (realtime_grass.glb: 6 plates of 6 triangles, MASK,
    // a 2.2 m strip of blades 0.87 m tall) on the MOWN ground alone - coverAt's `cut` (the paved fields' bands, the aprons, the verges,
    // the field-wide cut, the tall band beside a soft strip, a grass strip's running surface), at the mown lengths with no floor (a
    // card 8 cm tall is a 20 cm strip of ~40 blades: a sward, not a dot). The grass field leaves the cut ground to it while it is on
    // (ctx.lawnOn there: keep x (1 - cut)); the wild grass and the town plots' lawns are untouched. buildLawn below
    const LAWN = ctx.layer === 'lawn';
    const FIELD = ctx.layer === 'grass' || LAWN;
    // THE ROCKS' OWN RING (MOUNTAIN-VEG 17 Nov; the user: "rock should be visible for a little while ... yours maybe don't have to go
    // that far, but have to go a bit further"): ctx.layer 'rocks' plants the rock rows ALONE (no debris, no cover, no shrub), on the
    // first ring's own 32 m cells and stream (placeRocks: the same rocks, the same places - and the rock map's sprites under them),
    // keeping the BIG ones (the model's height x its scale >= rockSplit m) out to its own reach and height cut, on its own fade set;
    // the first ring then keeps the small ones (render_world sets its rockSplit while this ring runs): no rock is drawn twice
    const ROCKS = ctx.layer === 'rocks';
    const FSET = (FIELD || ROCKS) && LEAF.fadeSet ? LEAF.fadeSet() : null;
    const S = ROCKS
      ? { on: true, cell: 32, reach: 380, near: 140, taper: 0.5, aglFull: 200, aglOff: 450, aglPre: 520, preBudgetMs: 1, density: 2, shrubs: 0, rocks: 1, rockSplit: 0.45,
          rockSkin: 1, hitMin: 0.5, farBush: 0, budgetMs: 2, maxCells: 1000, blockBudget: 2, debrisKinds: 4, castMinH: 0.35, castMinDebris: 1.0, batch: true, lead: 4, grow: 0.8, growNear: 140, trunc: 1 }
      : FIELD
      ? { on: true, cell: 16, reach: 90, near: 15, taper: 1, aglFull: 27, aglOff: 90, density: 1, shrubs: 0, rocks: 0, budgetMs: 3, maxCells: 1400, blockBudget: 4, debrisKinds: 4, castMinH: 99, batch: false,
          aglPre: 150, preBudgetMs: 2, lead: 4, grow: 0.8, growNear: 60,
          // (G2567, the box 11 Oct 11:03 TIMED, cost3/: 2 tuft shapes + the size fade capped at 1.0 + 70 tufts / m2 - the forest view
          // 2.57 -> 2.23 ms, app10 4.21 -> 2.07, app30 3.85 -> 1.03 on gamer, every view under train 43's; draws +6..+9)
          rootKey: true,           // VEG-ROOT 11 Nov (the user, "by colour per tuft"): a brown/yellow tuft HIGH, a green one this row (MID)
          root: 0.6, rootH: 0.8,   // (VEG-ROOT 10 Nov ~21:30: the field is grass_reed, MID; 22:20 its fade to 80 %) G2571: the root gradient's strength (0 = none) and the share of the tuft's height it fades out by (VEG-ROOT 9 Nov: on, the cover's row)
          lakeMargin: 0.03,      // G2572: how far ABOVE a lake's water the ground must stand for a tuft (m; render_world okAt; the sea keeps 0.3)
          tufts: 70, cards: 3, variants: 2, block: 2, sizeFade: 1, sizeMax: 1, hRef: 0.3, blotch: 0.05, clumpM: 4, clumpAmp: 0.3, hK: 1, sigmaK: 1, tier: 1, trunc: 1, minAlb: 0.06,
          colour: 1, match: 1, vary: 0.05, cutH: 0.08, cutSigma: 0.1, cutDens: 1.2, tallH: 0.4, tallSigma: 0.3, minH: 0.3,   // tallH: the cut beside a soft strip (GRASS TO THE EDGE, the user: "taller grass on the strip side"); minH: THE SHORTEST GRASS - a floor on every mown height (the user, 16 Nov eve: "no grass should be smaller than 30 cm I think, even mown"; 0 = as before); a grass strip's running surface (stripH) is the runway's, not floored
          stripH: 0.07, stripDens: 1,
          green: 1, greenDens: 0.8, greenLo: 1.05, greenSpan: 0.3,   // GRASS ON GREEN (15 Nov): green 0 = today's (the A/B)
          feather: 0,
          cutFloor: 0,
          weeds: 1, weedsH: 1.8, weedsD: 1.3,   // (16 Nov, FOREST-EDGE with MOUNTAIN-VEG) the wild grass taller + denser in the weeds band outside a forest's edge (ctx.edgeD; inert without it)
          texGrass: 0 }   // (16 Nov) the density floor by the texture drawn: texGrass x SET_GRASS over the near sets' weights (0 = today)   // (16 Nov; the user: "maybe you have a cut grass setting that does not work") a MOWN node's density floor, whatever the type it is cut from (0 = today: the type's, 0.2 by a forest strip)   // (16 Nov) the density blended across class boundaries, 0..1 - off until the user's frame says (the A/B)
      : { on: true, cell: 32, reach: 220, near: 50, taper: 0.5, aglFull: 60, farBush: 3, rockSkin: 1,   // rockSkin: the rocks wear the rock ring's boulder skin when it runs (17 Nov; 0 = their scans' pictures)   // farBush: the bushes' far tier, n cards a sprite (0 = off; 17 Nov: 6 -> 3, a finer grain - the user: "smooth out rather than looking like blotches")
        aglOff: 150, density: 2, shrubs: 1, rocks: 1, budgetMs: 4, maxCells: 400, blockBudget: 2, debrisKinds: 4, castMinH: 0.35, castMinDebris: 1.0, batch: true,
          aglPre: 260, preBudgetMs: 2, lead: 4, grow: 0.8, growNear: 140, trunc: 1 };   // G670/G671: the grow, the pre-grow and the lead (update)   // density 2 (2026-09-22, the user: "the grass is really too sparse")
    // THE FIELD SHIPS OFF until its cost is cut (A0, train 43: the dials early, the field behind its editor switch - VEGETATION > the
    // grass field > 'the field'; the world look keeps the user's choice). ?grassfield=1 / 0 forces it for a rig; FIELD_ON the default
    if (ROCKS) { try { const m = /[?&]rocklayer=([01])/.exec(location.search); if (m) S.on = m[1] === '1'; } catch (e) {} }   // ?rocklayer=0: the rocks as before (the first ring's, to 220 m)
    if (FIELD && !LAWN) { S.on = FIELD_ON; try { const m = /[?&]grassfield=([01])/.exec(location.search); if (m) S.on = m[1] === '1'; } catch (e) {} }
    // the lawn's own dials over the field's (its cards a square metre of FULLY cut ground, the mown lengths, a short reach - a card is
    // small - and the size fade's reference at the lawn's own length, so an 8 cm card is drawn to the whole reach). ?lawn=1 / 0 forces it
    if (LAWN) { Object.assign(S, LAWN_DEF, { on: LAWN_ON }); try { const m = /[?&]lawn=([01])/.exec(location.search); if (m) S.on = m[1] === '1'; } catch (e) {} }
    const pack = (typeof TREE_PACK !== 'undefined') ? TREE_PACK : null;
    const cells = new Map();            // cellKey(cx, cz) -> { n, parts, inst, by, cx, cz, box }
    // G603 (A1-STAND): a cell's key is a NUMBER - update() asked the map for ~290 cells a frame by a fresh 'cx,cz'
    // string each, and split every live cell's key back into numbers to test its reach
    const cellKey = (cx, cz) => (cx + 32768) * 65536 + (cz + 32768);
    const protos = new Map();           // species key -> [{ key, w, parts:[{geo, mat}], h, kind }]
    const STAT = { built: 0, lastMs: 0, maxMs: 0, live: 0, queued: 0, instances: 0, agl: 0, mixAt: null, by: {}, scarSkip: 0, floorSkip: 0 };
    const ALP = { cells: 0, worstMs: 0, sets: 0, ops: 0, hits: 0, logged: '', t: 0 };   // the alpine rocks' counter (PERF-LEAD's line)
    let flowerTex = new Map();
    const root = new THREE.Group(); root.name = LAWN ? 'coverRingLawn' : 'coverRing'; scene.add(root);   // (water.js skips /^coverRing/: both)

    // ---- the prototypes: every species of the kinds the ring plants, built once ------
    // (debris - the logs, sticks and stumps of vegetation/branches - is the rock machinery on its own density: F.debris)
    // (the field plants FIELD_SPECIES alone; the first ring every cover kind but what the field holds while it is on - ctx.owned)
    const SHAPES = ['carpet', 'cluster', 'crown', 'float'];   // the shaped cards' shapes (shapedCards below; 'float': one flat quad on the water, the lily pads - 17 Nov)
    const shapedOf = c => !!(c.maps && c.place && SHAPES.includes(c.place.shape));
    // ?alpshrubs=0 (MOUNTAIN-VEG): the shaped species left out - the A/B of their cost (the subalpine mix plants the rest as before)
    let SHAPED_ON = true; try { const m = /[?&]alpshrubs=([01])/.exec(location.search); if (m) SHAPED_ON = m[1] === '1'; } catch (e) {}
    const speciesOf = () => (pack ? pack.collections : []).filter(c => ROCKS ? c.kind === 'rock' : LAWN ? LAWN_SPECIES.includes(c.name) : FIELD ? FIELD_SPECIES.includes(c.name)
      : ['cover', 'shrub', 'rock', 'debris'].includes(c.kind) && !(ctx.owned && ctx.owned(c.name)) && (SHAPED_ON || !shapedOf(c)));
    const rockish = c => c.kind === 'rock' || c.kind === 'debris';
    // THE ROCK SKIN (MOUNTAIN-VEG 17 Nov; the user: "keep your models, which are good and different ... and texture them using the
    // method of the rocks there"): a rock's material (not the debris) takes the ROCK RING's boulder look - rock_ring.js skin(sh): the
    // game's 'cliff' photograph triplanar, toned to the ground's rock, moss on what looks up, the foot darker - with that ring's LIVE
    // uniforms, so a tune of the rock ring's boulders reaches these too. Inert without the rock ring (window.ROCK_RING_LIVE, set by
    // render_world when ROCK-STUDY's ring runs); the ring may come up after these materials compile, so update() recompiles them
    // when it appears (or goes). S.rockSkin 0 = the scans' own pictures (the A/B)
    const skinMats = new Set(); let skinLive = null;
    const skinRing = () => { if (!S.rockSkin) return null; const R = (typeof window !== 'undefined') ? window.ROCK_RING_LIVE : null; return R && R.skin ? R : null; };
    function rockSkin(mat) {
      skinMats.add(mat); const prev = mat.onBeforeCompile, key0 = mat.customProgramCacheKey;
      mat.onBeforeCompile = sh => { if (prev) prev(sh); const R = skinRing(); if (R) R.skin(sh); };
      mat.customProgramCacheKey = () => (key0 ? key0() : '') + (skinRing() ? '-rockskin' : '');
    }
    const measureMean = mat => {   // the map's mean lightness (HSL l of the sRGB mean over the kept texels) - the bench's measureMats
      const img = mat.map && mat.map.image; if (!img || !img.width) return;
      try {
        const c = measureMean.cnv || (measureMean.cnv = document.createElement('canvas')); c.width = c.height = 64;
        const g = c.getContext('2d', { willReadFrequently: true }); g.clearRect(0, 0, 64, 64); g.drawImage(img, 0, 0, 64, 64);
        const d = g.getImageData(0, 0, 64, 64).data; let R = 0, G = 0, B = 0, n = 0;
        const lin = v => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
        let lr = 0, lg = 0, lb = 0;
        for (let i = 0; i < d.length; i += 4) { if (d[i + 3] < 128) continue; R += d[i]; G += d[i + 1]; B += d[i + 2]; lr += lin(d[i]); lg += lin(d[i + 1]); lb += lin(d[i + 2]); n++; }
        if (!n) return;
        const mx = Math.max(R, G, B) / n / 255, mn = Math.min(R, G, B) / n / 255;
        mat.userData.uFlatMean.value = (mx + mn) / 2;
        const had = !!mat.userData.texMean;
        mat.userData.texMean = [lr / n, lg / n, lb / n];   // G2562: the kept texels' mean, linear (the field's colour is the ground's over it)
        if (FIELD && !had && cells.size) api.replant();
      } catch (e) {}
    };
    function flowerCards(H, aspect, seed) {
      const r = rng(seed), W = H * aspect, pos = [], uv = [], idx = [];
      for (let c = 0; c < 3; c++) {
        const a = c * Math.PI / 3 + (r() - 0.5) * 0.3, tilt = (r() - 0.5) * 0.17, dx = Math.cos(a), dz = Math.sin(a), ox = (r() - 0.5) * 0.15 * W, oz = (r() - 0.5) * 0.15 * W;
        const y0 = -0.05 * H, y1 = 0.95 * H, lean = Math.sin(tilt) * H, b = pos.length / 3;
        pos.push(ox - dx * W / 2, y0, oz - dz * W / 2, ox + dx * W / 2, y0, oz + dz * W / 2,
                 ox + dx * W / 2 - dz * lean, y1, oz + dz * W / 2 + dx * lean, ox - dx * W / 2 - dz * lean, y1, oz - dz * W / 2 + dx * lean);
        uv.push(0, 1, 1, 1, 1, 0, 0, 0); idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
      return g;
    }
    // THE SHAPED CARDS (MOUNTAIN-VEG, the user 15 Nov: "something between the basic cross and the full bush geometry ... a few
    // angled cards, possibly with breaks in them"; picked on the shrub bench the same night: the CARPET for the heath and the
    // low shrubs, the CLUSTER + CROWN for the big grey-red thicket). A picture species whose `place.shape` names one of these is
    // built here instead of flowerCards; the shapes are the bench's (cardInto / shapeGeo of the MOUNTAIN-VEG page) at unit
    // height. Each card is a grid of quads bent along its height; the normals point into the upper half and lean halfway to
    // the sky (the bench's uUp 0.5), and the material keeps them on both faces (shapedMat) - a card tilted past 45 degrees
    // shows its back to the sky half the time, and three's back-face flip would draw it black from above.
    const CARD_DEF = { bend: 0.22, lean: 0.18, tilt: 60, upright: 0.85 };
    function cardInto(G, o) {
      const rows = o.rows || 1, base = G.pos.length / 3, ax = Math.cos(o.yaw), az = Math.sin(o.yaw), nx = -az, nz = ax, tl = o.tilt || 0;
      const u0 = o.u0 === undefined ? 0 : o.u0, u1 = o.u1 === undefined ? 1 : o.u1, v0 = o.v0 || 0, v1 = o.v1 === undefined ? 1 : o.v1;
      for (let r = 0; r <= rows; r++) for (let c = 0; c <= 1; c++) {
        const t = r / rows, s = c - 0.5;
        const out = (o.lean || 0) * t * Math.cos(tl) + Math.sin(tl) * t + (o.bend || 0) * t * t;
        const y = (o.y0 || 0) + o.h * t * Math.cos(tl) * Math.cos(Math.atan(o.lean || 0) * 0.5);
        G.pos.push(o.cx + ax * s * o.w + nx * out * o.h, y, o.cz + az * s * o.w + nz * out * o.h);
        G.uv.push(u0 + (s + 0.5) * (u1 - u0), 1 - (v0 + t * (v1 - v0)));   // the picture's top row is v = 0 (flipY false)
      }
      for (let r = 0; r < rows; r++) { const a = base + r * 2, b = a + 1, d = a + 2, e = d + 1; G.idx.push(a, b, e, a, e, d); }
    }
    function shapedCards(shape, W, seed, pl) {
      const r = rng(seed), G = { pos: [], uv: [], idx: [] }, B = pl.bend === undefined ? CARD_DEF.bend : +pl.bend, L = pl.lean === undefined ? CARD_DEF.lean : +pl.lean;
      if (shape === 'float') {   // the water plants (17 Nov): one flat quad, its picture from above, W wide and as deep, a hair over the water (W = place.aspects[v]: the user's lily slices carry their own width in metres at size 1, tools/lily_prep.py)
        // (17 Nov 16:00: 0.012 m lost to the lake quad's depth - 9 782 pads planted, one seen)
        // (VEG-NIGHT 23 Nov: that note once sat at the end of the next line and swallowed its uv and index - four corners, no triangle, no pad drawn for six days; GATE COVER 12 counts the triangles now)
        const h = W / 2, y = 0.05; G.pos.push(-h, y, -h, h, y, -h, h, y, h, -h, y, h);
        G.uv.push(0, 0, 1, 0, 1, 1, 0, 1); G.idx.push(0, 2, 1, 0, 3, 2);
      } else if (shape === 'cluster' || shape === 'crown') {
        cardInto(G, { cx: 0, cz: 0, yaw: r() * Math.PI, w: W * 0.8, h: 1, y0: -0.04, rows: 2, bend: B * 0.5 });
        for (let k = 0; k < 5; k++) {
          const a = k * 2 * Math.PI / 5 + r() * 0.4, u0 = [0, 0.2, 0.4, 0.1, 0.3][k];
          cardInto(G, { cx: Math.cos(a) * 0.2 * W, cz: Math.sin(a) * 0.2 * W, yaw: a + Math.PI / 2, w: W * 0.6, h: 0.7 + r() * 0.2, y0: -0.04, rows: 2, lean: L + 0.1, bend: B, u0, u1: u0 + 0.6, v0: 0, v1: 0.75 + r() * 0.25 });
        }
        if (shape === 'crown') for (let k = 0; k < 3; k++) { const a = k * 2 * Math.PI / 3 + 0.5 + r() * 0.3;
          cardInto(G, { cx: Math.cos(a) * 0.08 * W, cz: Math.sin(a) * 0.08 * W, yaw: a + Math.PI / 2, w: W * 0.55, h: 0.5, y0: 0.38, rows: 2, lean: 1.1, bend: 0.2, u0: 0.2, u1: 0.8, v0: 0.4, v1: 1 }); }
      } else {   // 'carpet': 4 cards tilted past 45 degrees in a rosette (seen from above) and 2 upright ones (its volume)
        const tl = (pl.tilt === undefined ? CARD_DEF.tilt : +pl.tilt) * Math.PI / 180, up = pl.upright === undefined ? CARD_DEF.upright : +pl.upright;
        for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2 + r() * 0.5;
          cardInto(G, { cx: Math.cos(a) * 0.06 * W, cz: Math.sin(a) * 0.06 * W, yaw: a + Math.PI / 2, w: W * 0.75, h: 1.1, y0: -0.02, rows: 3, tilt: tl, bend: -B * 0.6 }); }
        const a0 = r() * Math.PI;
        for (let k = 0; k < 2; k++) cardInto(G, { cx: 0, cz: 0, yaw: a0 + k * Math.PI / 2, w: W * 0.7, h: up, y0: -0.03, rows: 1 });
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(G.pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(G.uv, 2)); g.setIndex(G.idx);
      g.computeVertexNormals();
      const N = g.getAttribute('normal');
      for (let i = 0; i < N.count; i++) { let x = N.getX(i), y = N.getY(i), z = N.getZ(i); if (y < 0) { x = -x; y = -y; z = -z; } y += 1; const l = Math.hypot(x, y, z) || 1; N.setXYZ(i, x / l, y / l, z / l); }
      g.computeBoundingBox(); g.computeBoundingSphere();
      return g;
    }
    const flowerMat = (url, c) => {
      let t = flowerTex.get(url);
      if (!t) { t = new THREE.TextureLoader().load(url); t.colorSpace = THREE.SRGBColorSpace; t.flipY = false; t.anisotropy = 4; flowerTex.set(url, t); }
      // a shaped species' own cut (the user 15 Nov: "they would all need the alpha fairly low"): its tint's alpha; a flower keeps 0.5
      const cut = c && shapedOf(c) && c.tint && c.tint.alpha > 0 ? +c.tint.alpha : 0.5;
      const m = MATLIB.make(THREE, 'cut', { map: t, alphaTest: cut, alphaToCoverage: true, side: THREE.DoubleSide, roughness: 1, metalness: 0 }, 'cover / ring / cards (grass, flowers, shrubs)');
      // no normal override (the bench has none): upHook forced the object normal up on this
      // DoubleSide card, which three flips to (0,-1,0) on the back face - half of every flower dark
      LEAF.fadeHook(m); if (LEAF.flowerHook) LEAF.flowerHook(m);   // G2566: the flowers' colour (VEGETATION > the flowers' colour)
      if (c && shapedOf(c)) {   // the shaped cards' normals hold on both faces (see shapedCards): three's back-face flip undone, as a leaf's crown (trees.js uCrownN)
        const prev = m.onBeforeCompile;
        m.onBeforeCompile = sh => { if (prev) prev(sh);
          sh.fragmentShader = sh.fragmentShader.replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\nif (faceDirection < 0.0) { normal = -normal; nonPerturbedNormal = normal; }'); };
        const key = m.customProgramCacheKey ? m.customProgramCacheKey() : '';
        m.customProgramCacheKey = () => key + '-shaped';
      }
      return m;
    };
    // VEG-ROOT: a flower's cards are built at unit height, the picture's top at 0.95 (flowerCards)
    const flowerRoot = (m, c) => { m.userData.uRoot = rootOf(c, 'flower', 0.95); return m; };
    function protosOf(c) {
      let P = protos.get(c.name);
      if (P) return P;
      P = [];
      const place = c.place || {};
      if (c.maps && c.maps.length && shapedOf(c)) {          // a shaped species (MOUNTAIN-VEG): its pictures on the bench's shapes
        c.maps.forEach((url, v) => { const asp = (place.aspects && place.aspects[v]) || place.aspect || 1, geo = shapedCards(place.shape, asp, hashStr(c.name) + v * 977, place);
          const m = flowerMat(url, c); m.userData.uRoot = rootOf(c, 'flower', geo.boundingBox.max.y);   // VEG-ROOT on its own top (place.root / rootH win)
          P.push({ key: c.name + '|' + v, w: 1 / c.maps.length, kind: 'cover', h: place.size || 1, noTint: true, parts: [{ geo, mat: m }], tris: geo.index.count / 3 }); });
      } else if (c.maps && c.maps.length) {                  // a flower: its pictures on cards
        c.maps.forEach((url, v) => P.push({ key: c.name + '|' + v, w: 1 / c.maps.length, kind: 'cover', h: place.size || 1, noTint: true,
                                            // built at UNIT height: the instance scale carries `size`, in metres, once -
                                            // as the bench (flowerCards(t.size) and a jitter). Built at size AND scaled by
                                            // it, fireweed stood 1.7 x 1.7 = 2.75 m, bunchberry 0.19 m against 0.43.
                                            parts: [{ geo: flowerCards(1, place.aspect || 1, hashStr(c.name) + v * 977), mat: flowerRoot(flowerMat(url), c) }] }));
      } else {
        let subs = treeList('all').filter(e => e.col === c);
        // THE DEBRIS'S VARIETY IS ITS DRAW COUNT (PERF 2026-09-23): every model is a draw in every block and a shadow
        // draw - the two stick packs alone were 32 models, ~600 draws in a forest view. A debris pack keeps
        // S.debrisKinds of its models, evenly across its size range; the planting is the same (the pack's density,
        // spread over fewer shapes)
        if (c.kind === 'debris' && S.debrisKinds > 0 && subs.length > S.debrisKinds) {
          const hOf = e => (e.sub.bb ? e.sub.bb[4] - e.sub.bb[1] : (e.sub.h || 1));
          const sorted = subs.slice().sort((a, b) => hOf(a) - hOf(b)), n = S.debrisKinds;
          subs = Array.from({ length: n }, (_, k) => sorted[Math.round(k * (sorted.length - 1) / Math.max(1, n - 1))]);
        }
        // ONE MATERIAL PER MAP (G585): a rock's material is a plain copy made per part - the same values, the same
        // program - and a species' models mostly share one picture (the census: 16 rock parts on 4 maps). Shared, the
        // parts that wear the same picture can be one batch (below) instead of one draw each
        const plain = new Map();
        for (const e of subs) {
          let b = null; try { b = treeBuild(THREE, e.key, 0, 'rungs'); } catch (err) { continue; }
          if (!b || !b.parts.length) continue;
          const parts = b.parts.map(q => {
            let mat = q.mat;
            if (rockish(c) && plain.has(q.mat.map || null)) mat = plain.get(q.mat.map || null);
            else if (rockish(c)) {                              // the leaf hook's AO attribute drew the rocks black (the bench): a plain copy
              mat = MATLIB.make(THREE, 'std', { map: q.mat.map || null, roughness: 1, metalness: 0 }, 'cover / ring / rocks');   // the ring's own: its fade (and a cut) hook it
              plain.set(q.mat.map || null, mat);
              // THE SKIRT IS CUT (2026-09-22, the coast scans): a photoscanned strip carries the sand round its rocks, and
              // that skirt lay on the terrain as a pale plate wherever the ground fell away under it. A rock row's
              // `cut` (metres above the subject's floor - its own ground level, coast_rocks_tune.py) discards every
              // fragment below it in the rock's own frame: the rocks stand out of the real ground, the sand is the ground's
              if (place.cut > 0) {
                const uCut = { value: place.cut };
                mat.onBeforeCompile = sh => { sh.uniforms.uCut = uCut;
                  sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>' + String.fromCharCode(10) + 'varying float vRockY;')
                    .replace('#include <begin_vertex>', '#include <begin_vertex>' + String.fromCharCode(10) + 'vRockY = position.y;');
                  sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>' + String.fromCharCode(10) + 'varying float vRockY; uniform float uCut;')
                    .replace('#include <map_fragment>', 'if (vRockY < uCut) discard;' + String.fromCharCode(10) + '#include <map_fragment>'); };
              }
              LEAF.fadeHook(mat, ROCKS ? FSET : null); if (place.cut > 0) mat.customProgramCacheKey = () => 'fade-rockcut';   // (the rocks' ring: its own fade set)
              if (c.kind === 'rock') rockSkin(mat);
              if (ROCKS) mat.userData.progOwner = 'scenery / alpine rocks / scatter';   // (PERF-TRACE's program registry)   // (17 Nov: the rock ring's boulder skin, when it runs - below)
            } else {
              LEAF.fadeHook(mat, FIELD ? FSET : null);   // (the field's own fade set: its reach, its size fade)
              // NO NORMAL OVERRIDE ON A COVER - the bench has none (tools/_trees.html builds a
              // cover's material from the pack's own and never touches its normal), and the
              // game's `upHook` (G484's UP_VS) was worse than a divergence: it forces the OBJECT
              // normal up on a DoubleSide material, and three's normal_fragment_begin then flips
              // it to (0,-1,0) on every back face - half the tufts black, by where the camera
              // stood. The mesh's own normals, as the bench draws them (and the flowers too, in
              // flowerMat above).
              // THE COVER KEEPS THE BENCH'S MASTER, because the game's was retuned for the
              // CONIFER CANOPY and the grass was collateral. trees.js says so itself: "the
              // conifer sheets' mean albedo as baked is 0.043 linear; the imagery's forest
              // cells read 0.026 ... light 1.12 -> 0.6 puts the rendered canopy on the
              // imagery's level; sat 1.58 -> 1.2". That measurement is about spruce, and it
              // takes the cover down with it - uLight 3 x 0.6 = 1.8 where the bench, on the
              // same payload dial, renders 3 x 1.12 = 3.36. A further 1.87x on top of the
              // tint's ~9x (see meanOf above). The bench's committed master is the one every
              // cover dial was fitted under, so cover is given it back; the trees keep theirs.
              // (G1385: trees.js retint now applies it - COVER_BASE, the same numbers - and the grass's own master on top,
              // so a master or a species tint moved later keeps it; asked again here for a material hooked before)
              if (c.kind === 'cover' && mat.userData.uLight && LEAF.retint) LEAF.retint(mat);
              if (FIELD_SPECIES.includes(c.name)) { if (c.kind === 'cover') { mat.userData.uRoot = ROOT_U; if (!FIELD_MATS.includes(mat)) FIELD_MATS.push(mat); } }   // G2571: the reed's root gradient (trees.js fadeInject)
              else if (ROOT_KIND[c.kind]) mat.userData.uRoot = rootOf(c, c.kind, e.sub.bb ? e.sub.bb[4] : (e.sub.h || 1));   // VEG-ROOT: its kind's row, its own top
              if (c.kind === 'cover' && mat.userData.uFlat) { mat.userData.uFlat.value = place.contrast === undefined ? 1 : place.contrast; measureMean(mat);
                if (mat.map && !(mat.map.image && mat.map.image.width)) { const t0 = mat.map; const poll = () => { if (t0.image && t0.image.width) measureMean(mat); else setTimeout(poll, 500); }; setTimeout(poll, 500); } }
            }
            // A COVER CARRIES NO BAKED OCCLUSION - the bench forces it to 1 at load
            // (tools/_trees.html, `ensureAoAttr(o.geometry, 1)` over every cover group: "a grass
            // clump is eight triangles at ground level and the bake under aoBake 4 blackened its
            // base"). tree_prep never learnt that, so grass_reed ships 0.565..1.0 in its bin,
            // which at uAoBake 4 is pow(0.565, 4) = 0.10 of the ambient at its darkest vertices.
            // The bench's rule, applied here to the only geometry that is cover.
            if (c.kind === 'cover') { const A = q.geo.getAttribute('aoV'); if (A) { A.array.fill(1); A.needsUpdate = true; } }
            return { geo: q.geo, mat };
          });
          const h = (e.sub.bb ? e.sub.bb[4] - e.sub.bb[1] : (e.sub.h || 1)) * (place.size || 1);
          P.push({ key: e.key, w: 1 / subs.length, kind: c.kind, h, h0: (e.sub.bb ? e.sub.bb[4] - e.sub.bb[1] : (e.sub.h || 1)), parts, size: place.size || 1, bb: e.sub.bb || null,
                   r0: e.sub.bb ? Math.max(e.sub.bb[3] - e.sub.bb[0], e.sub.bb[5] - e.sub.bb[2]) / 2 : 1 });   // half its footprint: a slab's tilt is read over its own extent
        }
        // THE FIELD'S TUFTS: the patches' cards in groups of S.cards, the three median ones the variants (tuftsOf above); one
        // material (the patches share the reed's), h0 the tuft's own top in the model's units (the height a scale is asked for)
        if (FIELD && !LAWN && c.kind === 'cover' && P.length && P[0].parts.length) {
          const mat = P[0].parts[0].mat, T = tuftsOf(THREE, P.map(p => p.parts[0].geo), Math.max(1, S.cards | 0), Math.max(1, S.variants | 0));   // (`variants`: the draws a block - each is one)
          P.length = 0;
          T.forEach((t, i) => P.push({ key: c.name + '|tuft' + i, w: 1 / T.length, kind: 'cover', h: t.top, h0: t.top, parts: [{ geo: t.geo, mat }], size: 1, r0: 1, tris: t.tris }));
        }
      }
      if (P.length) protos.set(c.name, P);   // G908: an empty set is not kept - its bins may come later (a grown tree catalogue)
      P.species = c.name;
      for (const p of P) p.all = P;   // a prototype knows its species' set (the batches are sized from it)
      return P;
    }
    const draw = (P, r) => { let acc = r; for (const p of P) { acc -= p.w; if (acc <= 0) return p; } return P[P.length - 1]; };

    // ---- the tuft's colour: the ground's at its foot -------------------------------
    const rowOf = code => (GF && GF.CODES && GF.CODES[code]) || null;
    const colAt = (x, z, code) => {   // the ground's colour at lift 1, uncapped (the cap is per species, below)
      const row = rowOf(code);
      if (!row || !GF.groundColor) return null;
      const A = meanOf(row.sets[0]), B = row.sets[1] ? meanOf(row.sets[1]) : A;
      const c = GF.groundColor(x, z, row.period, row.bias, row.sharp, A, B), sh = GF.shade(x, z, row.vary[2]);
      const t = GF.hueTurn(c, sh.hue * row.vary[0] * Math.PI / 180), k = 1 + sh.value * row.vary[1];
      return [t[0] * k, t[1] * k, t[2] * k];
    };
    const lifted = (c, lift) => { const mx = Math.max(c[0], c[1], c[2]) * lift, sc = mx > 0.7 ? 0.7 / mx : 1;   // the max channel capped at 0.7
      return [c[0] * lift * sc, c[1] * lift * sc, c[2] * lift * sc]; };
    // THE CELL'S SUB-GRID (the cost): the code, the mix, the land test and the ground's colour
    // are smooth over metres (the fields' cells are 15-40 m, the map's 10 m), so a cell samples
    // them on a 4 m lattice once and every tuft reads the nearest node - a point-by-point
    // biomeAt (four terrainH, a canopy, two noises) at 2 500 tufts a cell was 50 ms a cell
    // (the bench's cover master - tools/_trees_tuning.json `master`, sat 1.58 light 1.12 - is trees.js COVER_BASE since G1385)
    const SG = 4;
    // THE IMAGERY AT A POINT (linear rgb): the tuft's colour where no CODES row stands (code 10 'built' -
    // the pale-beige tufts on the village's ground) and where the mix has no ground of its own
    const imageryAt = (x, z) => {
      const I = world.island; if (!I || !I.albedo || !I.cellAt) return null;
      const k = I.cellAt(x, z); if (k < 0) return null;
      const lin = v => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
      return [lin(I.albedo[k * 3]), lin(I.albedo[k * 3 + 1]), lin(I.albedo[k * 3 + 2])];
    };
    // THE COVER'S QUERY (v1.17, the roads session's world.coverAt through ctx.coverAt): per lattice node -
    // kill (1 on a pavement and its band, falling over the fade), boost (the border past a band), kind
    // (0 the biome's, 1 a plot's LAWN, 2 a plot's meadow, 3 none), the lawn's height and density factor,
    // and `col` (the linear colour the DRAWN ground has beside a pavement) taken as the tuft's ground
    const KIND = { lawn: 1, meadow: 2, none: 3 };
    // G1385 (EDITOR-VEG): the strips' own clearances that keep the bushes out (20_world.js bushAeroBlocked)
    const bushOff = world.bushAeroBlocked || null;
    // IS THERE A PAVEMENT AT THIS NODE? (v1.17 coverAt's `cls`). The vocabulary is the premises' own -
    // grass, asphalt, concrete, worn, gravel, dirt, sand - plus the analytic world's asphalt / gravel / grass,
    // so the test is "a class at all", not a list to keep in step. The debris reads it because a GRASS strip's
    // `kill` never passes 0.6 (it is the world's grass, mown), and kill alone would leave a log lying across a
    // grass runway (the roads session, 2026-09-22).
    function subGrid(x0, z0, C) {
      const N = Math.round(C / SG) + 1, mix = new Array(N * N), code = new Int16Array(N * N), ok = new Uint8Array(N * N), col = new Float32Array(N * N * 3);
      const bush = new Uint8Array(N * N);   // G1385: inside a strip's own clearance that keeps the bushes out
      const kill = new Float32Array(N * N), boost = new Float32Array(N * N), kind = new Uint8Array(N * N), lawnH = new Float32Array(N * N), lawnD = new Float32Array(N * N), cls = new Uint8Array(N * N);
      const cut = new Float32Array(N * N), surf = new Uint8Array(N * N), tall = new Float32Array(N * N);   // G2565: the premises' cut grass (the 'sides' law)
      const shore = new Uint8Array(N * N); let nShore = 0;   // G3430: the lake shore's band (the cover ring's; the grass field has none)
      for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
        const x = x0 + i * SG, z = z0 + j * SG, k = j * N + i, r = hsh(Math.round(x * 3.7), Math.round(z * 5.3));
        let cd = ctx.codeAt ? ctx.codeAt(x, z, r) : -1;
        // THE LAKE'S 10 m CELLS (G2572): the island's type grid marks a cell LAKE (1) though its edge is dry bank - no mix, no grass
        // to a cell's width from the water. Dry land (the land test passes) under a lake code takes the nearest land code round it
        // (6 then 12 m, eight ways); the sea (0) keeps its own. The grass field's alone (the first ring's flowers, bushes and
        // stones on a lake's bank are another call - A0)
        if (FIELD && cd === 1 && ctx.codeAt && ctx.okAt(x, z)) {
          find: for (const rr of [6, 12]) for (let a = 0; a < 8; a++) { const c2 = ctx.codeAt(x + Math.cos(a * 0.7854) * rr, z + Math.sin(a * 0.7854) * rr, r); if (c2 >= 2) { cd = c2; break find; } }
        }
        code[k] = cd; mix[k] = BIO.mixHere ? BIO.mixHere(cd, x, z) : (cd < 0 ? null : BIO.mixAt(cd)); bush[k] = bushOff && bushOff(x, z) ? 1 : 0; ok[k] = (ctx.okAt(x, z) && !(ctx.poolAt && (cd === 3 || cd === 7) && ctx.poolAt(x, z) > 0.5)) ? 1 : 0;   // no tuft in a puddle (the shader's pools, in JS)
        if (!FIELD && ok[k] && BIO.shoreHere && BIO.shoreHere(x, z)) { shore[k] = 1; nShore++; }
        // the grass field on the lake's band takes the lakeshore's own type (17 Nov, the user's lush lake borders: tall, dense, green)
        if (FIELD && ok[k] && BIO.SHORE !== undefined && BIO.shoreHere && BIO.shoreHere(x, z)) { const sm = BIO.mixAt(BIO.SHORE); if (sm) mix[k] = sm; }
        let cv = null; try { cv = ctx.coverAt ? ctx.coverAt(x, z) : null; } catch (e) { cv = null; }
        if (cv) { kill[k] = cv.kill || 0; boost[k] = cv.boost || 0; kind[k] = KIND[cv.kind] || 0; cls[k] = cv.cls ? 1 : 0; cut[k] = cv.cut || 0; surf[k] = cv.surf ? 1 : 0; tall[k] = cv.tall || 0;
          if (cv.grass) { lawnH[k] = cv.grass.h || 0.12; lawnD[k] = cv.grass.density === undefined ? 1 : cv.grass.density; }
          // a plot is the biome's ground with a lawn on it: the tuft stands, the mix does not
          if (kind[k] && !mix[k]) mix[k] = 'lawn'; if (kind[k] && !ok[k] && ctx.okAt(x, z)) ok[k] = 1; }
        // THE FIELD'S COLOUR IS THE GROUND AS DRAWN (G2562): the splat's mean at the point (splat_ground meanAt, through
        // ctx.groundMeanAt) - except ON a grass pavement, which draws its own (cv.col: the class's set as graded)
        // (G3430) A SHORE node on the lake's 10 m cells (code 1) takes the colour of the land round it, as the grass field's code
        // does above (G2572): the lake code's colour is black, and 30 of 76 lake-shore ferns stood black in the Mon 20:20 still
        let cdC = cd;
        if (shore[k] && cd === 1 && ctx.codeAt) {
          find2: for (const rr of [6, 12]) for (let a = 0; a < 8; a++) { const c2 = ctx.codeAt(x + Math.cos(a * 0.7854) * rr, z + Math.sin(a * 0.7854) * rr, r); if (c2 >= 2) { cdC = c2; break find2; } }
        }
        let c;
        if (FIELD && S.colour && ctx.groundMeanAt) c = (cv && cv.col && (cv.surf || (cv.cls === 'grass' && cv.kill > 0.5))) ? cv.col : (cd >= 0 ? ctx.groundMeanAt(x, z, cd) : null) || imageryAt(x, z);
        else c = (cv && cv.col) ? cv.col : (cdC >= 0 ? colAt(x, z, cdC) : null) || imageryAt(x, z);
        if (c) { col[k * 3] = c[0]; col[k * 3 + 1] = c[1]; col[k * 3 + 2] = c[2]; } else { col[k * 3] = 0.3; col[k * 3 + 1] = 0.3; col[k * 3 + 2] = 0.15; }
      }
      const at = (x, z) => Math.round((z - z0) / SG) * N + Math.round((x - x0) / SG);
      let bmax = 0, lawn = 0, paved = false; for (let k = 0; k < N * N; k++) { if (boost[k] > bmax) bmax = boost[k]; if (kind[k] === 1) lawn++; if (kill[k] > 0 || cut[k] > 0 || boost[k] > 0 || kind[k]) paved = true; }
      const G = { N, mix, code, ok, col, kill, boost, kind, cls, lawnH, lawnD, at, bmax, lawn, bush, cut, surf, tall, shore, nShore };
      if (FIELD) {
        // GRASS ON GREEN (15 Nov): each node's greenness, from the colour the field already reads (the ground as drawn); none on
        // mud or snow (SNOW-MUD's surfaces, by name - absent before it lands) whatever the colour says
        const green = G.green = new Float32Array(N * N), texd = G.tex = new Float32Array(N * N);
        if (S.green > 0 || S.texGrass > 0) {
          const SF = world.SURFACE || {}, soft = [SF.SNOW_PACKED, SF.SNOW_POWDER, SF.SNOW_WET, SF.MUD_FIRM, SF.MUD_SOFT].filter(v => v !== undefined);
          for (let j = 0, k = 0; j < N; j++) for (let i = 0; i < N; i++, k++) {
            if (!ok[k] || code[k] === 0 || code[k] === 1) continue;   // (the sea and a lake's code: water's, whatever colour - G2572 above
            //  already gave a lake's DRY bank its land code)
            if (soft.length && world.surface && soft.includes(world.surface(x0 + i * SG, z0 + j * SG))) { ok[k] = 0; continue; }
            if (S.green > 0) green[k] = greenOf([col[k * 3], col[k * 3 + 1], col[k * 3 + 2]], S.greenLo, S.greenSpan);
            if (S.texGrass > 0 && ctx.groundSetsAt && code[k] >= 2) { const L = ctx.groundSetsAt(x0 + i * SG, z0 + j * SG, code[k]); if (L) { let t = 0; for (const [key, w] of L) t += w * (SET_GRASS[key] || 0); texd[k] = t; } }
          }
        }
        // the colour between the nodes (bilinear: the imagery is 10 m, the nodes 4 m - a tuft's root on its own colour)
        G.colB = (x, z) => { const fx = Math.min(N - 1.001, Math.max(0, (x - x0) / SG)), fz = Math.min(N - 1.001, Math.max(0, (z - z0) / SG)), i = Math.floor(fx), j = Math.floor(fz), tx = fx - i, tz = fz - j;
          const o = [0, 0, 0]; for (const [di, dj, w] of [[0, 0, (1 - tx) * (1 - tz)], [1, 0, tx * (1 - tz)], [0, 1, (1 - tx) * tz], [1, 1, tx * tz]]) { const k = (j + dj) * N + i + di; o[0] += col[k * 3] * w; o[1] += col[k * 3 + 1] * w; o[2] += col[k * 3 + 2] * w; }
          return o; };
        // THE GROUND'S HEIGHT ON A 2 m LATTICE (bilinear): a tuft a terrainH was the planting's cost at ten times the count
        const HG = 2, NH = Math.round(C / HG) + 1, hg = new Float32Array(NH * NH);
        for (let j = 0; j < NH; j++) for (let i = 0; i < NH; i++) hg[j * NH + i] = world.terrainH(x0 + i * HG, z0 + j * HG);
        G.hAt = (x, z) => { const fx = Math.min(NH - 1.001, Math.max(0, (x - x0) / HG)), fz = Math.min(NH - 1.001, Math.max(0, (z - z0) / HG)), i = Math.floor(fx), j = Math.floor(fz), tx = fx - i, tz = fz - j, k = j * NH + i;
          return (hg[k] * (1 - tx) + hg[k + 1] * tx) * (1 - tz) + (hg[k + NH] * (1 - tx) + hg[k + NH + 1] * tx) * tz; };
        // A CELL BY A PAVEMENT ASKS THE PREMISES EVERY METRE (the 4 m node is 2.8 m from the tuft it decides, and the drawn side
        // is 1.8 m): kill, cut, surf, boost, kind and the land test on a 1 m lattice, the tuft reads the nearest
        if (paved && ctx.coverAt) {
          const NF = C + 1, F = { NF, kill: new Float32Array(NF * NF), cut: new Float32Array(NF * NF), surf: new Uint8Array(NF * NF), tall: new Float32Array(NF * NF), boost: new Float32Array(NF * NF), kind: new Uint8Array(NF * NF), ok: new Uint8Array(NF * NF) };
          for (let j = 0; j < NF; j++) for (let i = 0; i < NF; i++) {
            const x = x0 + i, z = z0 + j, k = j * NF + i, cd = code[at(x, z)];
            let cv = null; try { cv = ctx.coverAt(x, z); } catch (e) { cv = null; }
            if (cv) { F.kill[k] = cv.kill || 0; F.cut[k] = cv.cut || 0; F.surf[k] = cv.surf ? 1 : 0; F.tall[k] = cv.tall || 0; F.boost[k] = cv.boost || 0; F.kind[k] = KIND[cv.kind] || 0; }
            F.ok[k] = (ctx.okAt(x, z) && !(ctx.poolAt && (cd === 3 || cd === 7) && ctx.poolAt(x, z) > 0.5)) || (cv && cv.surf) ? 1 : 0;
          }
          F.at = (x, z) => Math.round(z - z0) * NF + Math.round(x - x0);
          G.fine = F;
        }
      }
      return G;
    }

    // ---- THE ROCKS OF ONE CELL (2026-09-22, the rock map) --------------------------------
    // The rock species plant on a stream of their OWN (the cell's seed xor the species' hash), so
    // the far tier's map (rock_map.js) can reproduce a cell's rocks without planting its grass:
    // one placement, two readers - the near cell's instances and the map's sprites agree by
    // construction. emit(p, x, y, z, s, yaw, col, tx, tz) per rock; returns the count.
    const coastAt = world.island && world.island.coastAt ? world.island.coastAt : null;
    function placeRocks(c, row, F, G, centreMix, cx, cz, C, emit) {
      const place = c.place || {};
      const P = protosOf(c); if (!P.length) return 0;
      const per = ((c.kind === 'debris' ? F.debris : F.rocks) || 0) / 1000 * S.rocks * (row.proportion === undefined ? 1 : row.proportion);
      if (per <= 0) return 0;
      const x0 = cx * C, z0 = cz * C, sSeed = hashStr(c.name);
      // the alpine rocks (above): the cell's own ground on the mix's band; the rows' exposed rule fades out over it
      const up = ALP_ON && F.rockUp ? smooth(F.rockUp[0], F.rockUp[1], world.terrainH(x0 + C / 2, z0 + C / 2)) : 0;
      const perA = per * (ALP_ON ? (F.alpRockK || 1) * (1 + (F.rockUp ? F.rockUp[2] : 0) * up) : 1), exposedA = (row.exposed || 0) * (1 - 0.6 * up);
      const Rq = rng((((hsh(cx, cz) * 4294967295) >>> 0) ^ sSeed) >>> 0);
      const blotch = F.blotch || 0, blotchM = F.blotchM || 18;
      const blotchAt = (x, z, seed) => (GF && GF.blotch) ? GF.blotch(x, z, seed) : 1 - blotch * vnoise(x, z, blotchM, seed % 1000);
      const vary = place.vary === undefined ? 0.05 : place.vary;
      const n = Math.round(perA * C * C); let made = 0;
      for (let i = 0; i < n; i++) {
        const x = x0 + Rq() * C, z = z0 + Rq() * C, r1 = Rq(), r2 = Rq(), r3 = Rq();
        // the bench's GF.blotch: keeps 1 - blotch .. 1 by area; a rock takes it only when its row says `cluster`
        // (THE ROCKY SHORE: a foreshore's rocks lie in beds along the tide line, not evenly)
        if (blotch && row.cluster && r1 > blotchAt(x, z, sSeed)) continue;
        // THE SHORE: a rock row's `shore` culls by the distance inland (the island's coast field, positive inland):
        // 1 keeps the water's edge and none past 15 m, 0 keeps all
        if (row.shore > 0 && coastAt) { const sd = coastAt(x, z); if (sd < -2 || Rq() > 1 - row.shore * smooth(2, 15, sd)) continue; }
        // THE WRACK LINE (2026-09-22, the user: "they are usually packed at the beach far end, where the highest
        // tide takes them"): `band` [lo, hi] metres INLAND of the waterline - the drift piles where the highest
        // tide left it, not at the water's edge; kept full inside the band and fading a couple of metres either side
        if (row.band && coastAt) { const sd = coastAt(x, z);
          const k = Math.min(smooth(row.band[0] - 3, row.band[0] + 1, sd), 1 - smooth(row.band[1] - 1, row.band[1] + 4, sd));
          if (k <= 0 || Rq() > k) continue; }
        // THE POOLS (2026-09-22, the user: "floating in the muskeg ponds as well", then: "it should not be
        // restricted to ponds"): a row's `pool` is the SHARE of its pieces that float - this draw is a floating
        // one with that probability, and then it wants the shared pool field (28b_ground_fields, the muskeg's
        // puddles), lies flat on the water (no tilt) and is barely sunk; the rest are ordinary dry pieces on the
        // ground the ok[] test keeps (a tuft is never planted in a puddle). One row, both halves.
        // DECIDED HERE, not below: the hollow test reads it, and a `const` further down put that read in its
        // temporal dead zone - every row carrying `hollow` threw and its cell lost all its debris (2026-09-22)
        const floats = row.pool > 0 && Rq() < row.pool;
        // THE HOLLOWS (the same: "probably in packs in depressions"): `hollow` keeps a piece by how much the ground
        // DISHES under it - the Laplacian over its own footprint (the mean of four neighbours minus the centre,
        // positive in a dish) in centimetres per metre; 0 keeps everything, 1 keeps only a real hollow
        if (row.hollow > 0 && !floats) {
          const rr = Math.max(6, 2.5 * (row.size || 1)), y0 = world.terrainH(x, z);
          const lap = (world.terrainH(x + rr, z) + world.terrainH(x - rr, z) + world.terrainH(x, z + rr) + world.terrainH(x, z - rr)) / 4 - y0;
          if (Rq() > (1 - row.hollow) + row.hollow * smooth(0, 0.35, lap)) continue;
        }
        // THE EXPOSED GROUND (the user 16 Nov: the mountain tops are "patches of bushes, weeds, moss carpets, and a lot rocks ... identify
        // where it would be likely to have quite a few rocks dispersed"): `exposed` keeps a rock by how bare the soil likely is - a knob or
        // a ridge (the ground CONVEX over 8 m: the Laplacian under 0) or a slope (the gradient over 8 m) - 0 keeps all, 1 only there
        if (exposedA > 0 && !floats) {
          const r8 = 8, y0 = world.terrainH(x, z), hx1 = world.terrainH(x + r8, z), hx0 = world.terrainH(x - r8, z), hz1 = world.terrainH(x, z + r8), hz0 = world.terrainH(x, z - r8);
          const lap = (hx1 + hx0 + hz1 + hz0) / 4 - y0, sl = Math.hypot(hx1 - hx0, hz1 - hz0) / (2 * r8);
          const L = Math.max(smooth(0.05, 0.6, -lap), smooth(0.25, 0.7, sl));
          if (Rq() > (1 - exposedA) + exposedA * L) continue;
        }
        const gk = G.at(x, z);
        if (G.mix[gk] !== centreMix) continue;
        // NOTHING LIES ON A PAVEMENT (2026-09-22; G502's rule, kept whole, asked PER PIECE). A log has no
        // business on a runway, an apron, a road or a track. `kill` is 1 over a hard surface AND its drawn
        // band, falling to 0 over the 6 m fade past it - but a GRASS strip only ever thins the cover to 0.6,
        // so kill alone would leave a log across a grass runway at 40 %: the piece is refused wherever the
        // pavement has a CLASS and a grip on the ground (kill 0.5), and thinned by what is left of the fade
        // beyond it, which is what a graded gravel verge looks like.
        // The QUERY, not the node: the ring's lattice is 4 m, so a node's answer can be 2.8 m from the piece
        // it is deciding - and the whole of this law happens within 7 m of an edge. `pave` is the cheap half
        // of the query (0.19 us against 1.34: no plot walk, no drawn colour), which is what makes a call per
        // piece affordable here, and the far rock map shares this function.
        { const cv = ctx.coverAt ? ctx.coverAt(x, z, 1) : null;
          if (cv && cv.kill > 0) {
            if (cv.kill >= 1 || (cv.cls && cv.kill >= 0.5)) continue;
            if (Rq() > 1 - cv.kill) continue;
          } }
        if (floats) { if (!(ctx.poolAt && ctx.poolAt(x, z) > 0.6)) continue; }
        else if (!G.ok[gk]) continue;
        const p = draw(P, r2);
        const y = world.terrainH(x, z);
        const s = (row.size !== undefined ? row.size : (place.size || 1)) * Math.exp((Rq() * 2 - 1) * (place.sizeVar === undefined ? 0.35 : place.sizeVar));
        const yaw = r3 * Math.PI * 2;
        // a rock's row may say how deep it sits (`bury`, a fraction of its height; the shore's lie deeper)
        const yy = y - p.h0 * s * (floats ? (row.poolBury === undefined ? 0.06 : row.poolBury)
                                          : (row.bury !== undefined ? row.bury : (place.bury === undefined ? 0.45 : place.bury)));
        let col = null;
        // `dim` (2026-09-23, the user: "the debris are still much too bright ... look at the dead trunks,
        // debris should be barely brighter"): a straight factor on the instance colour, measured rather than
        // guessed - the log's map is 0.249 linear luma against the dead trunks' bark at 0.081, three times
        // brighter; the two stick packs 0.10-0.11 with single maps at 0.216. The row's factor lands each
        // species in the dead trunks' family. It multiplies AFTER the tint (which turns hue, not level).
        const dim = row.dim === undefined ? 1 : row.dim;
        if (row.tint > 0) {
          // the rock takes the ground's colour at its foot, by `tint` (0 = the pack's pale grey as it is, 1 = the
          // tufts' rule): the free_rock pack is one pale texture and read as gravel thrown on the dark foreshore -
          // the ground's CHROMA (its colour at full brightness), not its value: a straight multiply by a dark
          // foreshore left the pack's own blue-grey showing through as lavender
          const g = [G.col[gk * 3], G.col[gk * 3 + 1], G.col[gk * 3 + 2]], gm = Math.max(g[0], g[1], g[2], 1e-3);
          const j = (1 + (Rq() * 2 - 1) * vary) * (1 - 0.35 * row.tint);   // and a third darker at full tint (the pack is pale)
          col = [(1 + (g[0] / gm - 1) * row.tint) * j, (1 + (g[1] / gm - 1) * row.tint) * j, (1 + (g[2] / gm - 1) * row.tint) * j];
        }
        if (dim !== 1) { if (!col) col = [1, 1, 1]; col = [col[0] * dim, col[1] * dim, col[2] * dim]; }
        // `tilt`: the rock leans to the ground's slope over its OWN footprint (a 10 m strip read at +-1.5 m stood on
        // the wrong plane and showed its skirt as a plate), scaled by the row's tilt (1 = the ground's own)
        let tx = 0, tz = 0;
        if (row.tilt > 0 && !floats) { const rr = Math.max(1.5, 0.45 * p.r0 * s); tx = (world.terrainH(x + rr, z) - world.terrainH(x - rr, z)) / (2 * rr) * row.tilt; tz = (world.terrainH(x, z + rr) - world.terrainH(x, z - rr)) / (2 * rr) * row.tilt; }
        emit(p, x, yy, z, s, yaw, col, tx, tz); made++;
      }
      return made;
    }
    // THE ROCK MAP'S READ (rock_map.js): a cell's rocks as records, if its mix asks for a far tier
    // (`rockMap` on the mix's forest row), else null. The same subGrid, the same placeRocks.
    function rockPlan(cx, cz) {
      const C = S.cell, x0 = cx * C, z0 = cz * C;
      const cd = ctx.codeAt ? ctx.codeAt(x0 + C / 2, z0 + C / 2, hsh(Math.round((x0 + C / 2) * 3.7), Math.round((z0 + C / 2) * 5.3))) : -1;
      const centreMix = BIO.mixHere ? BIO.mixHere(cd, x0 + C / 2, z0 + C / 2) : (cd < 0 ? null : BIO.mixAt(cd));
      if (!centreMix) return null;
      const M = BIO.mixOf(centreMix), F = (M && M.forest) || {};
      if (!F.rockMap) return null;
      const G = subGrid(x0, z0, C);
      const out = [];
      for (const c of speciesOf()) { if (!rockish(c)) continue; const row = M.species && M.species[c.name]; if (!row) continue;
        placeRocks(c, row, F, G, centreMix, cx, cz, C, (p, x, y, z, s, yaw, col) => out.push({ p, x, z, s, yaw, col })); }
      // THE BUSHES' FAR TIER (17 Nov, the user: "Bushes should almost be visible as far as the trees"): the shaped cards of the mix
      // on the same beds the ring plants them (bedKeep), their own stream, farK as one sprite sqrt(farK) wider, their own colour
      if (S.farBush > 0) for (const c of speciesOf()) { if (!shapedOf(c)) continue; const row = M.species && M.species[c.name]; if (!row) continue;
        const place = c.place || {}, P = protosOf(c); if (!P.length) continue;
        const per = (row.density !== undefined ? row.density : (place.density || 0)) * (F.cover === undefined ? 1 : F.cover) * S.density; if (!(per > 0)) continue;
        const K = Math.max(1, +S.farBush), patch = row.patch !== undefined ? row.patch : (place.patch || 0), share = place.patchShare || row.patchShare || 0.35;
        const bedFrac = patch ? Math.min(1, 0.25 * share) : 1, sSeed = hashStr(c.name), n = Math.round(per * C * C / K * (patch ? 1 / bedFrac : 1));
        const Rq = rng((((hsh(cx + 7, cz - 7) * 4294967295) >>> 0) ^ sSeed ^ 0x5eed) >>> 0), mu = place.mul || [1, 1, 1];
        for (let i = 0; i < n; i++) { const x = x0 + Rq() * C, z = z0 + Rq() * C, r1 = Rq(), r2 = Rq(), r3 = Rq();
          if (patch && !(bedKeep(x, z, patch, sSeed % 1000, bedFrac) >= r1)) continue;
          const gk = G.at(x, z); if (!G.ok[gk] || G.mix[gk] !== centreMix || G.kind[gk] === 1 || G.kind[gk] === 3 || G.cut[gk] > 0.05 || G.bush[gk]) continue;
          out.push({ p: draw(P, r2), x, z, s: (place.size || 1) * Math.sqrt(K) * (0.85 + 0.3 * r3), yaw: r3 * 6.2831853, col: mu }); }
      }
      return out;
    }

    // ---- THE BATCHES (G585) ---------------------------------------------------------
    // The rocks, the debris and the shrubs drew one InstancedMesh per prototype PART per block, and cast from each: at
    // the airfield stand ~1 400 draws a frame between them (rock 252 + 270 shadow, debris 340 + 181, shrub 192 + 198 -
    // the user's count). The tufts (cover) stay by block: 60 000+ instances, culled cheaply by the block's sphere.
    // A part's instances in a block are a handful, and every one of them paid the whole three.js draw. They are
    // BatchedMeshes now: one per (species, material, casts or not) ACROSS THE RING - the parts that share a picture
    // are one draw (a multi-draw of their ranges), three culls each INSTANCE against each camera and each shadow
    // camera (so no block is drawn for the one rock of it in view), and the block's reach test (below) switches its
    // instances instead of its meshes. The picture: the same geometry, material, matrices and colours, and the
    // fade's threshold carried in the colour's alpha (trees.js BATCH_RAND_VS) - the same instances thin at the same
    // distances. `batch: false` is the per-block instanced path, as before (the A/B).
    const batched = kind => S.batch && (kind === 'rock' || kind === 'debris' || kind === 'shrub');
    // (DEBRIS-SHADOW, the user 26 Oct: "keep the 131 debris, no shadows on small ones") the debris has its own floor, castMinDebris:
    // a stick, a log or a stump under it casts nothing - at the muskeg's 131 a thousand it was the taxi view's shadow pass doubled
    const castOf = p => p.kind !== 'cover' && !((p.kind === 'debris' || p.kind === 'rock') && p.h < S.castMinH) && !(p.kind === 'debris' && p.h < (+S.castMinDebris || 0));
    const attrSig = g => Object.keys(g.attributes).sort().map(k => k + g.attributes[k].itemSize).join(',') + (g.index ? '|i' : '');
    const batches = new Map();   // key -> BatchedMesh
    const V4 = new THREE.Vector4();
    // keyed by the SPECIES too: two species of one file share its material objects (trees.js, PACK.materials), and a
    // batch is sized for, and holds, the geometries of the one species it was made for
    function batchFor(P, part, cast) {
      const key = P.species + '|' + part.mat.uuid + '|' + (cast ? 1 : 0) + '|' + attrSig(part.geo);
      let bm = batches.get(key);
      if (bm) return bm;
      // every geometry this batch will ever draw is known now: the species' prototypes are built together (protosOf)
      const geos = [];
      for (const p of P) if (castOf(p) === cast) for (const q of p.parts) if (q.mat === part.mat && attrSig(q.geo) === attrSig(part.geo) && !geos.includes(q.geo)) geos.push(q.geo);
      let nv = 0, ni = 0; for (const g of geos) { nv += g.attributes.position.count; ni += g.index ? g.index.count : 0; }
      bm = new THREE.BatchedMesh(64, nv, ni, part.mat);
      bm.userData.geoIds = new Map(geos.map(g => [g, bm.addGeometry(g)]));
      bm.userData.nVis = 0; bm.visible = false;
      bm.perObjectFrustumCulled = true; bm.sortObjects = false; bm.frustumCulled = false;   // three's per-instance culling, each camera
      bm.matrixAutoUpdate = false; bm.renderOrder = -1;   // at the origin for ever; an occluder before the ground (render_world.js ORDER_NOTE)
      bm.castShadow = cast; bm.receiveShadow = true;
      bm.userData.coverKind = P[0].kind;
      bm.name = 'cover:' + P[0].kind;
      batches.set(key, bm); root.add(bm);
      return bm;
    }
    // a batch with no instance shown draws nothing at all (three would still set its program up, every pass): the
    // count of its shown instances decides its own visibility
    function batchVis(bm, id, v) {
      if (bm.getVisibleAt(id) === v) return;
      bm.setVisibleAt(id, v); bm.userData.nVis += v ? 1 : -1;
      const on = bm.userData.nVis > 0; if (bm.visible !== on) bm.visible = on;
    }
    function batchAdd(bm, geo) {
      if (bm.instanceCount >= bm.maxInstanceCount) bm.setInstanceCount(bm.maxInstanceCount * 2);   // full (no id to reuse): twice the room
      return bm.addInstance(bm.userData.geoIds.get(geo));
    }

    // ---- THE FIELD'S CELL (G2563) ---------------------------------------------------------------------------------------
    // the fade's keep at a distance (FADE_VS, before the height term): the planting's tiers and the draw's truncation read it
    const keepD = d => { const t = Math.max(0, Math.min(1, (d - S.near) / Math.max(1, S.reach - S.near))); return Math.pow(1 - t, 1 + 2 * S.taper); };
    const bandNow = () => (LEAF.grow ? LEAF.grow(null, null, null)[1] : 0.25);
    // the tinted texel's mean on the CPU (trees.js TINT_GLSL on the kept texels' mean): the field's colour is the ground's OVER it,
    // so a tuft's albedo lands on the ground's own (x `match`, the level the box fits)
    const tintMean = mat => {
      const U = mat.userData, c = U.texMean; if (!c || !U.uLight) return [0.4, 0.4, 0.4];
      const a = -(U.uHue ? U.uHue.value : 0) * 6.2831853, co = Math.cos(a), si = Math.sin(a);
      const c0 = [0.299 + 0.701 * co + 0.168 * si, 0.587 - 0.587 * co + 0.330 * si, 0.114 - 0.114 * co - 0.497 * si];
      const c1 = [0.299 - 0.299 * co - 0.328 * si, 0.587 + 0.413 * co + 0.035 * si, 0.114 - 0.114 * co + 0.292 * si];
      const c2 = [0.299 - 0.300 * co + 1.250 * si, 0.587 - 0.588 * co - 1.050 * si, 0.114 + 0.886 * co - 0.203 * si];
      const dot = (u, v) => u[0] * v[0] + u[1] * v[1] + u[2] * v[2], rot = [dot(c, c0), dot(c, c1), dot(c, c2)], y = 0.2126 * rot[0] + 0.7152 * rot[1] + 0.0722 * rot[2];
      const sat = U.uSat ? U.uSat.value : 1, fl = U.uFlat ? U.uFlat.value : 1, fm = U.uFlatMean ? U.uFlatMean.value : 0.4, L = U.uLight.value;
      return rot.map(v => Math.max(0.02, Math.min(1, (fm + ((y + (v - y) * sat) - fm) * fl) * L)));
    };
    // VEG-ROOT 12 Nov: the field key's weight - the TINTED texel mean's red-to-green (what each tuft's colour is divided by, above), so
    // in the vertex vColor r/g x w is the tuft's albedo r/g, the ground's own (grass 0.78, lush 0.55; dry 1.21, grassRock 1.40). The raw
    // texture mean (r/g 1.72, where the reed's tint takes the sat to 0.24: 1.09) put every tuft at 2.2-2.35 in the 15:04 probe, all HIGH.
    const fieldKeyW = () => { let r = 0, g = 0; for (const m of FIELD_MATS) { if (!m.userData.texMean) continue; const M = tintMean(m); r += M[0]; g += M[1]; } return g > 0 ? Math.max(0.05, r / g) : 1; };
    let fieldH0 = 1;   // the variants' mean top (model units): the size fade's reference is S.hRef over it
    // one 16 m cell of the field, planted for an eye no nearer than dTier (0: the whole stream). The candidate stream is the
    // cell's own (hashed on it) and draws the same eight numbers for every candidate whatever is kept, so a tier is a PREFIX of
    // the next: a candidate stands at dTier when its fade threshold (aRand, its own rand) is under what its own size can show
    // from there (x the shrink band) - nearer, the cell is planted again and only adds (G2563 tiers).
    // the field's row per mix (its length, spread, density, clumps): the mix's own reed row, else a bare biome's `fill` row, else
    // none - a fresh table per call (a cell's build, or the instrument below)
    function fieldTypes(c) {
      const types = new Map();
      return mix => {
        if (types.has(mix)) return types.get(mix);
        const M = mix ? BIO.mixOf(mix) : null, row = M && M.species && M.species[c.name];
        let T = null;
        const D = FIELD_TYPES[mix] || FIELD_MEADOW;
        if (row || (M && D.fill)) { const F = M.forest || {}, R0 = row || {}, pick = (k, d) => (R0[k] !== undefined ? R0[k] : (F[k] !== undefined ? F[k] : (D[k] !== undefined ? D[k] : d)));
          // (a bare biome's `forest.cover` is 0 - its own flowers' and the old patches' - so the field's own density stands there)
          const cov = (R0.dens !== undefined || D.fill) ? 1 : (F.cover === undefined ? 1 : F.cover);
          T = { h: pick('h', 0.3), sigma: pick('sigma', 0.35), dens: pick('dens', 1) * cov, clumpM: pick('clumpM', S.clumpM), clumpAmp: pick('clumpAmp', S.clumpAmp),
                fieldPatch: pick('fieldPatch', 0), fieldShare: pick('fieldShare', 1), tint: pick('tint', null), minAlb: pick('minAlb', 0) }; }   // MOUNTAIN-VEG: the type's grass patches (the subalpine), its colour lift and floor (the lakeshore)
        types.set(mix, T); return T; };
    }
    // THE FIELD AT A POINT (the instrument, 16 Nov - the false-colour frame): what the field plants at (x, z) by the same rules as
    // buildField, before the blotch, the tiers and the fade - its tufts per m2, the length, and why (the node's class, the land
    // test, the kill, the cut, the drawn colour's greenness). The cells' sub-grids are kept until fieldAtReset() (or a replant)
    const FA = new Map();
    // THE WEEDS BAND (16 Nov, FOREST-EDGE; the user's 25 Oct spec across an edge: weeds 6-3 m OUTSIDE, shrubs 3-0 m outside): 0..1 at
    // a node from ctx.edgeD (signed metres to the forest's edge, + inside): 1 from -edgeWeedOut to -edgeShrubOut, thinning to 0 at the
    // edge, 0 inside and past -edgeWeedOut - 1. Null when the field has no edgeD, weeds is 0 or BIOMES.edgeOn is false (?forestedge=0)
    function weedsGrid(G, x0, z0) {
      if (!(S.weeds > 0) || !ctx.edgeD || !BIO || BIO.edgeOn === false) return null;
      const K = BIO.knobs ? BIO.knobs() : {}, wo = K.edgeWeedOut > 0 ? K.edgeWeedOut : 6, so = K.edgeShrubOut > 0 ? Math.min(K.edgeShrubOut, wo) : 3;
      const W = new Float32Array(G.N * G.N); let any = 0;
      for (let j = 0; j < G.N; j++) for (let i = 0; i < G.N; i++) { const d = ctx.edgeD(x0 + i * SG, z0 + j * SG);
        const w = !(d < 0) || !(d > -wo - 1) ? 0 : d >= -so ? -d / so : d >= -wo ? 1 : d + wo + 1; if (w > 0) { W[j * G.N + i] = Math.min(1, w) * S.weeds; any = 1; } }
      return any ? W : null;
    }
    function fieldAt(x, z) {
      if (!FIELD || !BIO) return null;
      const c = speciesOf()[0]; if (!c) return null;
      const C = S.cell, cx = Math.floor(x / C), cz = Math.floor(z / C), key = cellKey(cx, cz);
      let E = FA.get(key); if (!E) { if (FA.size > 4096) FA.clear(); E = { G: subGrid(cx * C, cz * C, C), typeOf: fieldTypes(c) }; E.W = weedsGrid(E.G, cx * C, cz * C); FA.set(key, E); }
      const G = E.G, k = G.at(x, z), T0 = E.typeOf(G.mix[k]), gD = S.green > 0 ? Math.max(0, +S.greenDens || 0) : 0;
      const dT = T0 ? T0.dens : 0, dG = gD * (G.green ? G.green[k] : 0), dX = S.texGrass > 0 && G.tex ? S.texGrass * G.tex[k] : 0, d0 = Math.max(dT, dG, dX), d = G.cut[k] > 0 && S.cutFloor > 0 ? d0 + (Math.max(d0, S.cutFloor) - d0) * G.cut[k] : d0;
      const ok = !!G.ok[k], kill = G.kill[k], cut = G.cut[k], surf = G.surf[k], kind = G.kind[k], boost = G.boost[k];
      const cutF = cut > 0 ? 1 + ((surf ? S.stripDens : S.cutDens) - 1) * cut : 1;
      const live = ok && kill < 1 && kind !== 1 && kind !== 3;
      const wd = E.W && !surf ? E.W[k] * (1 - cut) : 0, wD = 1 + (S.weedsD - 1) * wd;
      const tl = G.tall ? G.tall[k] : 0, T = T0 || FIELD_MEADOW, hw = T.h * S.hK * (1 + (S.weedsH - 1) * wd), hc = surf ? S.stripH : Math.max(S.minH, S.cutH + (S.tallH - S.cutH) * tl);
      return { mix: G.mix[k], code: G.code[k], ok, kill: +kill.toFixed(3), cut: +cut.toFixed(3), tall: +tl.toFixed(3), surf: !!surf, cls: !!G.cls[k], kind,
        green: G.green ? +G.green[k].toFixed(3) : 0, col: [G.col[k * 3], G.col[k * 3 + 1], G.col[k * 3 + 2]],
        dType: dT, dGreen: +dG.toFixed(3), dTex: +dX.toFixed(3), weed: +wd.toFixed(3), perM2: live ? +(S.on ? S.tufts * d * cutF * wD * (1 - kill) * (1 + boost) * (ctx.lawnOn && ctx.lawnOn() ? 1 - cut * (1 - (G.tall ? G.tall[k] : 0) * (1 - (ctx.lawnTall ? +ctx.lawnTall() || 0 : 0))) : 1) : 0).toFixed(2) : 0,
        h: +(hw + (hc - hw) * cut).toFixed(3), why: !S.on ? 'field off' : !ok ? 'land test' : kill >= 1 ? 'kill' : kind === 1 ? 'lawn' : kind === 3 ? 'none' : !(d > 0) ? 'no row, not green' : cut > 0.5 ? 'mown' : 'wild' };
    }
    function buildField(cx, cz, dTier, born) {
      const t0 = performance.now();
      const C = S.cell, x0 = cx * C, z0 = cz * C;
      const R = rng((hsh(cx, cz) * 4294967295) >>> 0);
      const cell = { n: 0, parts: new Map(), inst: [], by: {}, cx, cz, dTier, born, field: true };
      cells.set(cellKey(cx, cz), cell); markBlock(cx, cz);
      const lawnTake = !!(ctx.lawnOn && ctx.lawnOn()), lawnTall = ctx.lawnTall ? +ctx.lawnTall() || 0 : 0;   // GRASS-CARDS: the mown ground is the lawn's while it is on (keep x (1 - cut) below)
      const c = speciesOf()[0], P = c ? protosOf(c) : [];
      if (!P.length || !BIO) { STAT.lastMs = performance.now() - t0; return cell; }
      for (const p of P) for (const q of p.parts) if (LEAF.fadeOwn) LEAF.fadeOwn(q.mat, FSET);
      fieldH0 = P.reduce((a, p) => a + p.h0, 0) / P.length;
      const G = subGrid(x0, z0, C);
      const typeOf = fieldTypes(c);
      // GRASS ON GREEN (15 Nov): a node's density is at least greenDens x its greenness; a green node of a type with no row of
      // its own (a bare biome, no mix) grows the meadow's length at that floor
      const gD = S.green > 0 ? Math.max(0, +S.greenDens || 0) : 0, GR = G.green;
      const tD = S.texGrass > 0 ? +S.texGrass : 0, TX = G.tex;
      const densAt = (T, k) => Math.max(T ? T.dens : 0, gD * GR[k], tD * (TX ? TX[k] : 0));
      const FIELD_GREEN_T = { h: FIELD_MEADOW.h, sigma: FIELD_MEADOW.sigma, dens: 0, clumpM: S.clumpM, clumpAmp: S.clumpAmp };
      // THE FEATHER (16 Nov; the user: "grass covers more of the transition between zones"): a node's density blended bilinearly
      // over the four nodes round a candidate instead of the nearest one's alone (`feather` 0..1), so the grass runs through a
      // class boundary instead of stopping on it. The land test, the kill and the plot's kind stay the candidate's own node's
      // (never onto a runway, into water or a lawn); only the density between grassy classes is feathered
      const NN = G.N * G.N, Dn = new Float32Array(NN), fth = Math.max(0, Math.min(1, +S.feather || 0));
      let dmax = 0; for (let k = 0; k < NN; k++) { const d = Dn[k] = densAt(typeOf(G.mix[k]), k); if (d > dmax) dmax = d; }
      const densB = (x, z) => { const fx = Math.min(G.N - 1.001, Math.max(0, (x - x0) / SG)), fz = Math.min(G.N - 1.001, Math.max(0, (z - z0) / SG)), i = Math.floor(fx), j = Math.floor(fz), tx = fx - i, tz = fz - j, k = j * G.N + i;
        return Dn[k] * (1 - tx) * (1 - tz) + Dn[k + 1] * tx * (1 - tz) + Dn[k + G.N] * (1 - tx) * tz + Dn[k + G.N + 1] * tx * tz; };
      const cutMax = Math.max(1, S.cutDens, S.stripDens);
      // the weeds band (weedsGrid): bilinear over the nodes (a 3 m band on 4 m nodes); its density raises the envelope by wMax
      const WG = weedsGrid(G, x0, z0), wMax = WG ? Math.max(1, S.weedsD) : 1;
      const weedB = WG ? (x, z) => { const fx = Math.min(G.N - 1.001, Math.max(0, (x - x0) / SG)), fz = Math.min(G.N - 1.001, Math.max(0, (z - z0) / SG)), i = Math.floor(fx), j = Math.floor(fz), tx = fx - i, tz = fz - j, k = j * G.N + i;
        return WG[k] * (1 - tx) * (1 - tz) + WG[k + 1] * tx * (1 - tz) + WG[k + G.N] * (1 - tx) * tz + WG[k + G.N + 1] * tx * tz; } : null;
      const env = S.tufts * dmax * cutMax * wMax * (1 + G.bmax);   // the candidates' density: every keep below is a share of it
      if (env <= 0) { STAT.lastMs = performance.now() - t0; return cell; }
      const n = Math.round(env * C * C), band = bandNow(), tierOn = S.tier && dTier > 0, blotchM = 18;
      const items = new Map(), mats = new Map();
      const F = G.fine;
      // (the tier's bound for ANY tuft of the cell - the tallest the size fade lets reach farthest: a rand over it is out at once)
      const tierMax = tierOn ? keepD(dTier / Math.max(1, 1 + (S.sizeMax - 1) * S.sizeFade)) * (1 + band) * 1.05 : 2;
      for (let i = 0; i < n; i++) {
        const x = x0 + R() * C, z = z0 + R() * C, rand = R(), rA = R(), rV = R(), rY = R(), rH1 = R(), rH2 = R(), rJ = R();
        if (rand >= tierMax) continue;
        const gk = G.at(x, z), T0 = typeOf(G.mix[gk]), dK = fth > 0 ? Dn[gk] + (densB(x, z) - Dn[gk]) * fth : Dn[gk]; if (!(dK > 0)) continue;
        const T = T0 || FIELD_GREEN_T;
        const fk = F ? F.at(x, z) : -1;
        const kill = fk >= 0 ? F.kill[fk] : G.kill[gk], kind = fk >= 0 ? F.kind[fk] : G.kind[gk], ok = fk >= 0 ? F.ok[fk] : G.ok[gk];
        if (!ok || kill >= 1 || kind === 1 || kind === 3) continue;   // a plot's lawn is the first ring's (grass_dry); 'none' plants nothing
        const cut = fk >= 0 ? F.cut[fk] : G.cut[gk], surf = fk >= 0 ? F.surf[fk] : G.surf[gk], boost = fk >= 0 ? F.boost[fk] : G.boost[gk], tl = fk >= 0 ? (F.tall ? F.tall[fk] : 0) : (G.tall ? G.tall[gk] : 0);
        // THE DENSITY: the type's, more where it is cut; the blotch's holes (fewer than the first ring's, none in the cut);
        // the pavement's kill and the verge's boost - one draw against the share of the envelope
        // (16 Nov) mown grass is a lawn: at least cutFloor whatever the forest it is cut from - beside a forest strip the type's 0.2 x 1.2 made
        // ~5 tufts / m2 of 8 cm, unreadable (the 15 Nov probe)
        const dC = cut > 0 && S.cutFloor > 0 ? dK + (Math.max(dK, S.cutFloor) - dK) * cut : dK;
        const wd = weedB && !surf ? weedB(x, z) * (1 - cut) : 0;
        let keep = dC * (cut > 0 ? 1 + ((surf ? S.stripDens : S.cutDens) - 1) * cut : 1) * (1 + (wMax - 1) * wd) / (dmax * cutMax * wMax);
        if (S.blotch > 0) keep *= 1 - S.blotch * (0.5 + 0.5 * vnoise(x, z, blotchM, 4242)) * (1 - cut);
        keep *= (1 - kill) * (1 + boost) / (1 + G.bmax);
        if (T.fieldPatch > 0 && T.fieldShare < 1) keep *= smooth(-0.06, 0.06, T.fieldShare - vnoise(x, z, T.fieldPatch, 515));   // the type's grass patches
        // (the stream is drawn the same: the wild grass is today's tuft for tuft). The TALL band beside a soft strip stays the field's
        // tufts (GRASS-CARDS 17 Nov: 40 cm cards read as dark blocks there; the user validated the tufts) unless the lawn's tallCards
        if (lawnTake) keep *= 1 - cut * (1 - tl * (1 - lawnTall));
        if (rA >= keep) continue;
        // THE LENGTH (GRASS-STUDY §4.4): the type's median x a lognormal x the clump field (wild); cut: its own length, uniform
        let nz = Math.sqrt(-2 * Math.log(Math.max(1e-9, rH1))) * Math.cos(6.2831853 * rH2); nz = Math.max(-2.5, Math.min(2.5, nz));
        const clump = 1 + T.clumpAmp * (vnoise(x, z, T.clumpM, 977) - 0.5) * 2;
        const hw = T.h * S.hK * (1 + (S.weedsH - 1) * wd) * Math.exp(T.sigma * S.sigmaK * nz) * clump, hc = (surf ? S.stripH : Math.max(S.minH, S.cutH + (S.tallH - S.cutH) * tl)) * Math.exp((surf ? S.cutSigma : S.cutSigma + (S.tallSigma - S.cutSigma) * tl) * nz);
        const h = hw + (hc - hw) * cut;
        // THE TIER: what this tuft's own size can show from dTier (the size fade: a short one fades nearer) - its scale over the
        // reference exactly as FADE_VS reads it (h / its variant's top, over hRef / the variants' mean top). Every test is the
        // candidate's own fixed numbers, so the tuft kept from dTier is kept from any nearer one: the tiers nest
        const p = draw(P, rV);
        if (tierOn && rand >= keepD(dTier / Math.max(0.05, 1 + (Math.min(S.sizeMax, Math.max(0.05, (h / p.h0) / (S.hRef / fieldH0))) - 1) * S.sizeFade)) * (1 + band) * 1.05) continue;
        const mat = p.parts[0].mat;
        let col;
        if (S.colour && ctx.groundMeanAt) {
          let M = mats.get(mat); if (!M) mats.set(mat, M = tintMean(mat));
          const g = G.colB(x, z), j = (1 + (rJ * 2 - 1) * S.vary) * S.match;
          col = [Math.min(3, g[0] / M[0] * j), Math.min(3, g[1] / M[1] * j), Math.min(3, g[2] / M[2] * j)];
          // THE DARKEST TUFT (17 Nov, the user: the dead grass "too dark and desaturated ... almost black. It's not believable"): the tuft's
          // albedo (its multiplier x the picture's mean) under minAlb (linear luminance) is blended toward the picture's own colour at
          // that floor - the dark muskeg soil no longer paints black grass; 0 = off
          if (T.tint) col = [col[0] * T.tint[0], col[1] * T.tint[1], col[2] * T.tint[2]];   // a type's colour lift (the lakeshore's lush green)
          const mA = Math.max(S.minAlb || 0, T.minAlb || 0);
          if (mA > 0) { const L = 0.2126 * col[0] * M[0] + 0.7152 * col[1] * M[1] + 0.0722 * col[2] * M[2];
            if (L < mA) { const t = Math.min(1, 1 - L / mA) * 0.8, Lt = 0.2126 * M[0] + 0.7152 * M[1] + 0.0722 * M[2], s0 = mA / Math.max(1e-4, Lt);
              col = col.map(v => v * (1 - t) + s0 * t); } }
        } else {   // the sets' means x lift (G551), the A/B
          const place = c.place || {}, l = place.lift === undefined ? 1 : place.lift, k3 = gk * 3, j = 1 + (rJ * 2 - 1) * S.vary;
          col = lifted([G.col[k3], G.col[k3 + 1], G.col[k3 + 2]], l).map(v => v * j);
        }
        if (ctx.floorAt && ctx.floorAt(x, z)) { STAT.floorSkip++; continue; }   // SHED-FLOOR: not on a standing shed's floor (after the draws)
        let it = items.get(p); if (!it) { it = { p, xs: [], col: [], rand: [] }; items.set(p, it); }
        it.xs.push(x, G.hAt(x, z), z, h / p.h0, rY * 6.2831853, 0, 0); it.col.push(col[0], col[1], col[2]); it.rand.push(rand);
      }
      return emitField(cell, items, c, G, x0, z0, C, t0);
    }
    // the cell's instances written out, per prototype (the field's and the lawn's): the matrices, the colours, the fade's rands, the box
    function emitField(cell, items, c, G, x0, z0, C, t0) {
      let yLo = Infinity, yHi = -Infinity;
      for (const it of items.values()) {
        const k = it.xs.length / 7, mm = new Float32Array(k * 16); let smax = 0;
        // the matrix written out (a turn about up and one scale: Matrix4.compose's own result, without its quaternion round trip)
        for (let i = 0; i < k; i++) { const o = i * 7, s = it.xs[o + 3], a = it.xs[o + 4], co = Math.cos(a) * s, si = Math.sin(a) * s, e = i * 16;
          mm[e] = co; mm[e + 2] = -si; mm[e + 5] = s; mm[e + 8] = si; mm[e + 10] = co; mm[e + 12] = it.xs[o]; mm[e + 13] = it.xs[o + 1]; mm[e + 14] = it.xs[o + 2]; mm[e + 15] = 1;
          if (s > smax) smax = s; if (it.xs[o + 1] < yLo) yLo = it.xs[o + 1]; if (it.xs[o + 1] > yHi) yHi = it.xs[o + 1]; }
        for (const part of it.p.parts) cell.parts.set(part, { n: k, mats: mm, col: new Float32Array(it.col), rand: new Float32Array(it.rand), cast: false, kind: 'cover', cell, smax });
        cell.n += k; cell.by[c.name] = (cell.by[c.name] || 0) + k; STAT.by[c.name] = (STAT.by[c.name] || 0) + k;
      }
      if (!isFinite(yLo)) { yLo = yHi = G.hAt(x0 + C / 2, z0 + C / 2); }
      cell.box = [x0, yLo - 1, z0, x0 + C, yHi + 2, z0 + C];
      STAT.built++; STAT.lastMs = performance.now() - t0; STAT.maxMs = Math.max(STAT.maxMs, STAT.lastMs); STAT.sumMs = (STAT.sumMs || 0) + STAT.lastMs;
      return cell;
    }

    // ---- THE LAWN'S CELL (GRASS-CARDS) -----------------------------------------------------------------------------------
    // the cut 1 m squares of a 16 m cell (the premises' fine lattice by a pavement, the 4 m nodes elsewhere), each planted with
    // round(dens x its most-cut corner + a rand) candidates from the cell's own stream - a square with no cut draws nothing, so a
    // cell of wild ground costs its sub-grid alone. A candidate stands by its own corner's cut (the band's soft edge thins the cards
    // as the field's (1 - cut) brings the tufts in), never where the field would not: off the land test, a kill of 1, a plot (the
    // first ring's lawn), a 'none' zone, a shed's floor. Its length: a grass strip's surface stripH, the tall band beside a soft strip
    // tallH, else cutH - each x its own lognormal; the card's scale is that over its plate's top. The tiers nest as the field's do
    // (every candidate draws its nine numbers whatever is kept)
    function buildLawn(cx, cz, dTier, born) {
      const t0 = performance.now();
      const C = S.cell, x0 = cx * C, z0 = cz * C;
      const cell = { n: 0, parts: new Map(), inst: [], by: {}, cx, cz, dTier, born, field: true };
      cells.set(cellKey(cx, cz), cell); markBlock(cx, cz);
      const c = speciesOf()[0], P0 = c ? protosOf(c) : [];
      if (!P0.length || !BIO) { STAT.lastMs = performance.now() - t0; return cell; }
      for (const p of P0) for (const q of p.parts) if (LEAF.fadeOwn) LEAF.fadeOwn(q.mat, FSET);
      // the three upright plates (top 0.87 m) and, with `lean`, the three leaning copies (the scene's .001 nodes, top ~0.53 m)
      const up = P0.filter(p => p.h0 > 0.75), P = S.lean || !up.length ? P0 : up;
      fieldH0 = P.reduce((a, p) => a + p.h0, 0) / P.length;
      const G = subGrid(x0, z0, C), F = G.fine;
      let anyCut = false; for (let k = 0; k < G.N * G.N && !anyCut; k++) if (G.cut[k] > 0) anyCut = true;
      if (F) for (let k = 0; k < F.cut.length && !anyCut; k++) if (F.cut[k] > 0) anyCut = true;
      if (!anyCut || !(S.dens > 0)) { STAT.lastMs = performance.now() - t0; return cell; }
      const cutAt = (x, z) => F ? F.cut[F.at(x, z)] : G.cut[G.at(x, z)], killAt = (x, z) => F ? F.kill[F.at(x, z)] : G.kill[G.at(x, z)];
      const band = bandNow(), tierOn = S.tier && dTier > 0, mc = Math.max(0, +S.minCut || 0);
      const tierMax = tierOn ? keepD(dTier / Math.max(1, 1 + (S.sizeMax - 1) * S.sizeFade)) * (1 + band) * 1.05 : 2;
      // THE CANDIDATES ARE HASHED, NOT STREAMED (the cost, 16 Nov: a fully mown cell is ~38 000 cards at dens 150): candidate q of the
      // square (xa, za) draws its numbers from its own integer hash, so a card the tier leaves out costs one hash and is the same card
      // from any eye (the tiers nest as the field's do). Per square, once: the cut and kill corners, the ground's colour (at its
      // centre: the imagery is 10 m, the nodes 4 m) and its four heights; per card only what is its own
      const imul = Math.imul, mmin = Math.min, mmax = Math.max, mfloor = Math.floor, msqrt = Math.sqrt, mlog = Math.log, mcos = Math.cos, mexp = Math.exp;   // (the loop's own: ~10 000 cards a cell)
      const items = new Map(), cols = [];
      for (const p of P) cols.push(tintMean(p.parts[0].mat));
      // one 32-bit hash per draw, two 16-bit numbers out of most of them (u / v, the keep test / the plate, the normal's pair, the
      // jitter / the yaw); the fade's threshold `rand` keeps all 32 bits
      const hq = (k, n) => { let h = imul(k ^ imul(n, 0x27d4eb2d), 0x9e3779b1); h ^= h >>> 15; h = imul(h, 0x85ebca77); h ^= h >>> 13; h = imul(h, 0xc2b2ae3d); return (h ^ (h >>> 16)) >>> 0; };
      const I16 = 1 / 65536, I32 = 1 / 4294967296;
      const NF = F ? F.NF : 0, colOn = S.colour && ctx.groundMeanAt, np = P.length, vary = S.vary, match = S.match;
      // the cell's scratch, per plate (typed, grown once and kept: a fully mown 8 m cell is ~10 000 cards at dens 150)
      const cap = Math.ceil(S.dens * C * C * 1.1 / np) + 64, LB = LAWN_BUF;
      if (LB.cap < cap) { LB.cap = cap; LB.xs = []; LB.col = []; LB.rand = []; }
      const nOf = new Int32Array(np);
      for (let v = 0; v < np; v++) { if (!LB.xs[v]) { LB.xs[v] = new Float32Array(LB.cap * 7); LB.col[v] = new Float32Array(LB.cap * 3); LB.rand[v] = new Float32Array(LB.cap); } }
      for (let j = 0; j < C; j++) for (let i = 0; i < C; i++) {
        const xa = x0 + i, za = z0 + j;
        const c00 = cutAt(xa, za), c10 = cutAt(xa + 1, za), c01 = cutAt(xa, za + 1), c11 = cutAt(xa + 1, za + 1), cm = mmax(c00, c10, c01, c11);
        if (!(cm > mc)) continue;
        const k00 = killAt(xa, za), k10 = killAt(xa + 1, za), k01 = killAt(xa, za + 1), k11 = killAt(xa + 1, za + 1);
        if (mmin(k00, k10, k01, k11) >= 1) continue;
        const base = (imul(xa | 0, 73856093) ^ imul(za | 0, 19349663) ^ 0x5bd1e995) | 0;
        const nq = mfloor(S.dens * cm + hq(base, 0x3ff) * I32);
        if (!nq) continue;
        const g = colOn ? G.colB(xa + 0.5, za + 0.5) : null;
        const h00 = G.hAt(xa, za), h10 = G.hAt(xa + 1, za), h01 = G.hAt(xa, za + 1), h11 = G.hAt(xa + 1, za + 1);
        // NEVER IN DRAWN WATER (A0 17 Nov, L40e's LOOKS 5: grass in a lake's margin): a square whose lowest corner stands within
        // lawnWet of the water drawn at its centre plants nothing (a mown bank keeps its cards to the dry metre)
        if (world.waterH) { const w = world.waterH(xa + 0.5, za + 0.5); if (Number.isFinite(w) && w > mmin(h00, h10, h01, h11) - S.lawnWet) continue; }
        for (let q = 0; q < nq; q++) {
          const kq = base + imul(q + 1, 0x632be5ab);
          const rand = hq(kq, 1) * I32;
          if (rand >= tierMax) continue;
          const huv = hq(kq, 2), u = (huv >>> 16) * I16, v = (huv & 0xffff) * I16, x = xa + u, z = za + v;
          // the cut and the kill BETWEEN the square's corners (a card is never planted by its nearest node alone: half a metre onto
          // the paving, the gate's 1b) - the pavement's edge is a 1 m ramp of thinning cards
          const cut = (c00 * (1 - u) + c10 * u) * (1 - v) + (c01 * (1 - u) + c11 * u) * v; if (!(cut > mc)) continue;
          const kill = (k00 * (1 - u) + k10 * u) * (1 - v) + (k01 * (1 - u) + k11 * u) * v;
          const hkp = hq(kq, 3);
          if ((hkp >>> 16) * I16 >= cut / cm * (1 - kill)) continue;   // its own cut over the square's (the band's soft edge) and the kill (a trail's thinned lanes)
          const fk = F ? (j + (v >= 0.5 ? 1 : 0)) * NF + i + (u >= 0.5 ? 1 : 0) : -1, gk = fk >= 0 ? 0 : G.at(x, z);
          const kind = fk >= 0 ? F.kind[fk] : G.kind[gk], ok = fk >= 0 ? F.ok[fk] : G.ok[gk];
          if (!ok || kind === 1 || kind === 3) continue;
          const surf = fk >= 0 ? F.surf[fk] : G.surf[gk], tl = fk >= 0 ? (F.tall ? F.tall[fk] : 0) : (G.tall ? G.tall[gk] : 0);
          if (tl > 0 && hq(kq, 6) * I32 >= 1 - tl * (1 - S.tallCards)) continue;   // the tall band: the field's tufts (tallCards 0), or cards
          const hn = hq(kq, 4), r1 = mmax(1e-5, ((hn >>> 16) + 0.5) * I16), r2 = (hn & 0xffff) * I16;
          let nz = msqrt(-2 * mlog(r1)) * mcos(6.2831853 * r2); nz = mmax(-2.5, mmin(2.5, nz));
          const h = surf ? S.stripH * mexp(S.stripSigma * nz)
                         : (S.cutH + (S.tallH - S.cutH) * tl) * mexp((S.cutSigma + (S.tallSigma - S.cutSigma) * tl) * nz);
          const pv = mmin(np - 1, ((hkp & 0xffff) * np) >>> 16), p = P[pv];
          if (tierOn && rand >= keepD(dTier / mmax(0.05, 1 + (mmin(S.sizeMax, mmax(0.05, (h / p.h0) / (S.hRef / fieldH0))) - 1) * S.sizeFade)) * (1 + band) * 1.05) continue;
          if (ctx.floorAt && ctx.floorAt(x, z)) { STAT.floorSkip++; continue; }
          const hj = hq(kq, 5), jit = 1 + ((hj >>> 16) * I16 * 2 - 1) * vary;
          const n = nOf[pv]++, X = LB.xs[pv], o = n * 7;
          X[o] = x; X[o + 1] = (h00 * (1 - u) + h10 * u) * (1 - v) + (h01 * (1 - u) + h11 * u) * v; X[o + 2] = z; X[o + 3] = h / p.h0; X[o + 4] = (hj & 0xffff) * I16 * 6.2831853; X[o + 5] = 0; X[o + 6] = 0;
          LB.rand[pv][n] = rand;
          const CO = LB.col[pv], o3 = n * 3;
          if (g) { const M = cols[pv], jj = jit * match; CO[o3] = mmin(3, g[0] / M[0] * jj); CO[o3 + 1] = mmin(3, g[1] / M[1] * jj); CO[o3 + 2] = mmin(3, g[2] / M[2] * jj); }
          else { const k3 = (fk >= 0 ? G.at(x, z) : gk) * 3; CO[o3] = G.col[k3] * jit; CO[o3 + 1] = G.col[k3 + 1] * jit; CO[o3 + 2] = G.col[k3 + 2] * jit; }
        }
      }
      for (let v = 0; v < np; v++) if (nOf[v]) items.set(P[v], { p: P[v], xs: LB.xs[v].subarray(0, nOf[v] * 7), col: LB.col[v].subarray(0, nOf[v] * 3), rand: LB.rand[v].subarray(0, nOf[v]) });
      return emitField(cell, items, c, G, x0, z0, C, t0);
    }
    // THE LAWN AT A POINT (the instrument): its cards a square metre and the length it draws there, by buildLawn's rules
    function lawnAt(x, z) {
      if (!LAWN || !BIO) return null;
      const C = S.cell, cx = Math.floor(x / C), cz = Math.floor(z / C), key = cellKey(cx, cz);
      let E = FA.get(key); if (!E) { if (FA.size > 4096) FA.clear(); E = { G: subGrid(cx * C, cz * C, C) }; FA.set(key, E); }
      const G = E.G, F = G.fine, fk = F ? F.at(x, z) : -1, gk = G.at(x, z);
      const cut = fk >= 0 ? F.cut[fk] : G.cut[gk], kill = fk >= 0 ? F.kill[fk] : G.kill[gk], kind = fk >= 0 ? F.kind[fk] : G.kind[gk], ok = fk >= 0 ? F.ok[fk] : G.ok[gk];
      const surf = fk >= 0 ? F.surf[fk] : G.surf[gk], tl = fk >= 0 ? (F.tall ? F.tall[fk] : 0) : (G.tall ? G.tall[gk] : 0);
      const live = !!ok && kill < 1 && kind !== 1 && kind !== 3 && cut > (+S.minCut || 0);
      return { cut: +cut.toFixed(3), kill: +kill.toFixed(3), surf: !!surf, tall: +tl.toFixed(3), kind, ok: !!ok,
        perM2: live && S.on ? +(S.dens * cut * (1 - kill) * (1 - tl * (1 - S.tallCards))).toFixed(2) : 0, h: surf ? S.stripH : +(S.cutH + (S.tallH - S.cutH) * tl).toFixed(3) };
    }

    // ---- FOREST-EDGE's band (the user 16 Nov: "a ramp of tree sizes on the surroundings, then bushes"; the spec of 25 Oct:
    // shrubs 3-0 m outside the forest, weeds 6-3 m outside; 28c_biomes KNOBS edge*). ctx.edgeD is the tree fill's signed distance
    // to the forest's edge (+ in). Its own stream (the points' hashes), so the cell's R() - every other species - is untouched; the
    // cover's land tests (a strip's bush clearance, a lawn, a pavement, the mown sides, the lake band); none on a cell far from an edge
    // the bushes: the user 16 Nov eve - "you may use the new cards as bushes ... don't put everything in everything": the lowland
    // edge takes the blueberry and the Elliottia cards (no Cassiope: subalpine) with today's raspberry and sapling meshes
    // (17 Nov, the user: the ferns "almost better used in the forest biome, particularly on the borders": the fern joins the weeds)
    const EDGE_SHRUB = [['alp_vaccinium', 1], ['alp_elliottia', 0.7], ['raspberry', 0.6], ['sapling_deciduous', 0.6]], EDGE_WEED = [['flower_fireweed', 1], ['flower_foam', 0.7], ['reed_marsh', 1.2]];
    function edgeBand(G, x0, z0, C, push, cell) {
      // past the outward band's trees (28c edgeBandAt): bushes from edgeShrubIn x its local reach R out to R + edgeShrubOut, the
      // weeds from there to R + edgeWeedOut (d < 0 outside)
      const K = BIO.knobs(), D = ctx.edgeD, reach = C * 0.75 + (BIO.edgeReachMax ? BIO.edgeReachMax() : 0) + K.edgeWeedOut;
      if ([[0.5, 0.5], [0, 0], [1, 0], [0, 1], [1, 1]].every(([u, v]) => Math.abs(D(x0 + u * C, z0 + v * C)) > reach)) return;
      const cols = speciesOf(), set = L => { const out = []; let tot = 0;
        for (const [n, w] of L) { const c = cols.find(q => q.name === n), P = c && protosOf(c); if (P && P.length) { out.push([c, P, w]); tot += w; } }
        return { out, tot }; };
      const SH = set(EDGE_SHRUB), WD = set(EDGE_WEED);
      const nS = Math.round(K.edgeShrubDens * C * C), nW = Math.round(K.edgeWeedDens * C * C);   // drawn over the cell, kept in their band: the density there
      const ix0 = Math.round(x0), iz0 = Math.round(z0);
      for (let i = 0; i < nS + nW; i++) {
        const weed = i >= nS, x = x0 + hsh(ix0 + i * 7919, iz0 - 31) * C, z = z0 + hsh(ix0 - 17, iz0 + i * 104729) * C;
        const d = D(x, z), R = BIO.edgeReachAt ? BIO.edgeReachAt(x, z) : 0, o = -d;
        if (weed ? (o < R + K.edgeShrubOut || o > R + K.edgeWeedOut) : (o < K.edgeShrubIn * R || o > R + K.edgeShrubOut)) continue;
        const gk = G.at(x, z);
        if (!G.ok[gk] || G.shore[gk] || G.kind[gk] === 1 || G.kind[gk] === 3 || G.cut[gk] > 0.05 || G.kill[gk] > 0.01) continue;
        if (!weed && G.bush[gk]) continue;   // a strip's own bush clearance
        if (!weed && ctx.rockExpoAt && ctx.rockExpoAt(x, z) > 0.5) continue;   // (18 Nov: not on the stone)
        if (!weed && G.mix[gk] === 'subalpine') continue;   // the user 16 Nov: "I don't want deciduous over there": the edge's bushes are all deciduous
        const S0 = weed ? WD : SH; if (!S0.out.length) continue;
        let r = hsh(ix0 + i * 31, iz0 + i * 17) * S0.tot, pick = S0.out[0]; for (const e of S0.out) { r -= e[2]; if (r <= 0) { pick = e; break; } }
        const [c, P] = pick, place = c.place || {}, p = draw(P, hsh(ix0 + i * 13, iz0 - i * 7)), rr = hsh(ix0 - i * 11, iz0 + i * 23);
        const j = 1 + (hsh(ix0 + i * 5, iz0 + i * 3) * 2 - 1) * 0.12;
        let s;
        if (!weed && place.hMin !== undefined && place.hMax !== undefined && p.h0 > 0)   // the bush's own range, smaller the further out
          s = (place.hMin + rr * (place.hMax - place.hMin)) * (0.75 + 0.25 * Math.max(0, Math.min(1, (R + K.edgeShrubOut - o) / Math.max(1, R + K.edgeShrubOut - K.edgeShrubIn * R)))) / p.h0;
        else s = (place.size || 1) * (0.8 + 0.35 * rr);
        push(p, x, world.terrainH(x, z) - (place.sink || 0), z, s, hsh(ix0 + i * 3, iz0 - i * 5) * Math.PI * 2, [j, j, j], 0, 0);
        STAT.by[c.name] = (STAT.by[c.name] || 0) + 1; cell.by[c.name] = (cell.by[c.name] || 0) + 1; STAT.edge = (STAT.edge || 0) + 1;
      }
    }

    // ---- THE WATER PLANTS (17 Nov, the user's floatplane lake: "the addition of some water plants could really blend things together")
    // The lakeshore mix's rows with `onWater` [from, to] (metres out from the drawn line: ctx.lakeSD, + in the lake) and `depth` [lo, hi]
    // (the water over the bed: ctx.waterY - terrainH) are planted on the shallow lake, in beds (bedKeep), at the water's drawn level -
    // the ring's own land test (G.ok) refuses water, so they have this planter of their own; their own stream (the cell's untouched)
    function waterBand(G, x0, z0, C, push, cell) {
      const sm = BIO.SHORE !== undefined ? BIO.mixAt(BIO.SHORE) : null, M = sm && BIO.mixOf(sm); if (!M || !M.species) return;
      const rows = []; for (const c of speciesOf()) { const row = M.species[c.name]; if (row && Array.isArray(row.onWater) && shapedOf(c)) rows.push([c, row]); }
      if (!rows.length) return;
      const far = Math.max(...rows.map(([, r]) => r.onWater[1])) + C * 0.75, D = ctx.lakeSD;
      if ([[0.5, 0.5], [0, 0], [1, 0], [0, 1], [1, 1]].every(([u, v]) => { const d = D(x0 + u * C, z0 + v * C); return d < -C * 0.75 || d > far; })) return;
      const ix0 = Math.round(x0), iz0 = Math.round(z0);
      for (const [c, row] of rows) {
        const place = c.place || {}, P = protosOf(c); if (!P.length) continue;
        const per = (row.density || 0) * S.density; if (!(per > 0)) continue;
        const patch = row.patch || 0, share = row.patchShare || 0.35, bedFrac = patch ? Math.min(1, 0.25 * share) : 1, sSeed = hashStr(c.name);
        const n = Math.round(per * C * C * (patch ? 1 / bedFrac : 1)), Rw = rng((((hsh(ix0 + 3, iz0 - 3) * 4294967295) >>> 0) ^ sSeed ^ 0x3a7e) >>> 0), mu = place.mul || [1, 1, 1];
        const dep = row.depth || [0.05, 2];
        for (let i = 0; i < n; i++) {
          const x = x0 + Rw() * C, z = z0 + Rw() * C, r1 = Rw(), r2 = Rw(), r3 = Rw();
          const d = D(x, z); if (d < row.onWater[0] || d > row.onWater[1]) continue;
          if (patch && !(bedKeep(x, z, patch, sSeed % 1000, bedFrac) >= r1)) continue;
          const wy = ctx.waterY(x, z); if (wy === null || !Number.isFinite(wy)) continue;
          const depth = wy - world.terrainH(x, z); if (depth < dep[0] || depth > dep[1]) continue;
          const s = (place.size || 1) * (0.7 + 0.6 * r2), j = 1 + (r3 * 2 - 1) * (place.vary || 0.06);
          push(draw(P, r3), x, wy, z, s, r2 * Math.PI * 2, [j * mu[0], j * mu[1], j * mu[2]], 0, 0);
          STAT.by[c.name] = (STAT.by[c.name] || 0) + 1; cell.by[c.name] = (cell.by[c.name] || 0) + 1; STAT.water = (STAT.water || 0) + 1;
        }
      }
    }

    // ---- one cell -------------------------------------------------------------------
    function buildCell(cx, cz, dTier, born) {
      if (BIO && BIO.hold && !BIO.held) { BIO.hold(true); try { return buildCell(cx, cz, dTier, born); } finally { BIO.hold(false); } }   // the biomes' knobs once a pass (28c hold)
      if (LAWN) return buildLawn(cx, cz, dTier || 0, born);
      if (FIELD) return buildField(cx, cz, dTier || 0, born);
      const t0 = performance.now();
      STAT.building = cx + ',' + cz;
      const C = S.cell, x0 = cx * C, z0 = cz * C;
      const seed = (hsh(cx, cz) * 4294967295) >>> 0;
      const R = rng(seed);
      // the mix at the cell's centre says which species to plant; each point checks its own
      const G = subGrid(x0, z0, C);
      const centreMix = G.mix[G.at(x0 + C / 2, z0 + C / 2)];
      // THE CELL HOLDS ITS INSTANCES, NOT MESHES (PERF 2026-09-23): the block it falls in (below) draws them
      const cell = { n: 0, parts: new Map(), inst: [], by: {}, cx, cz, hits: [], hitKey: null };   // inst: [batch, id, ...] - the batched instances (G585)   // by: this cell's tally per species (STAT.by is the live sum)
      cells.set(cellKey(cx, cz), cell); markBlock(cx, cz);
      if (!centreMix && !G.lawn && !G.nShore) { STAT.lastMs = performance.now() - t0; return cell; }
      const M = BIO.mixOf(centreMix) || { species: {}, forest: {} }, F = M.forest || {};   // a cell of plots alone ('lawn' stands for a mix) plants its lawn and nothing else
      const items = new Map();   // proto -> { pos: [], col: [] | null }
      // the instance record: x y z s yaw tx tz - tx/tz the ground's slope under a rock that `tilt`s to it (0 0 = upright)
      // (G2358: none where a crash scarred the ground - after the draws, so the cell's stream is the same either way)
      const push = (p, x, y, z, s, yaw, col, tx, tz) => { if (SCR.n && scarCut(p.kind, x, z)) { STAT.scarSkip++; return; } if (ctx.floorAt && ctx.floorAt(x, z)) { STAT.floorSkip++; return; } let it = items.get(p); if (!it) { it = { p, xs: [], col: col ? [] : null }; items.set(p, it); } it.xs.push(x, y, z, s, yaw, tx || 0, tz || 0); if (col) it.col.push(col[0], col[1], col[2]); };
      // THE LAWN (a plot's, kind 1): the dry tuft short and dense - the height from the plot's rule (0.10-0.15 m),
      // LAWN_D tufts a m2 x the rule's density factor - on the lawn nodes alone, the biome's rows skip them
      if (G.lawn > 0 && !ROCKS) {
        const c = speciesOf().find(q => q.name === 'grass_dry');
        const P = c && protosOf(c);
        if (P && P.length) {
          const place = c.place || {}, LAWN_D = 6, n = Math.round(LAWN_D * C * C * G.lawn / (G.N * G.N)) * 2;   // twice the lawn share's count: half the draws fall off the lawn nodes
          const h0 = P[0].h0 || 1, lift = place.lift === undefined ? 1 : place.lift;
          for (let i = 0; i < n; i++) {
            const x = x0 + R() * C, z = z0 + R() * C, r2 = R(), r3 = R();
            const gk = G.at(x, z); if (G.kind[gk] !== 1 || !G.ok[gk]) continue;
            if (G.kill[gk] > 0 && R() < G.kill[gk]) continue;
            if (G.lawnD[gk] < 1 && R() > G.lawnD[gk]) continue;
            const p = draw(P, r2), y = world.terrainH(x, z);
            const s = ((G.lawnH[gk] || 0.12) / h0) * (0.85 + 0.3 * R());
            const col = lifted([G.col[gk * 3], G.col[gk * 3 + 1], G.col[gk * 3 + 2]], lift);
            push(p, x, y, z, s, r3 * Math.PI * 2, col); STAT.by.lawn = (STAT.by.lawn || 0) + 1; cell.by.lawn = (cell.by.lawn || 0) + 1;
          }
        }
      }
      // G3430 LAKESHORE (code 18, the user 25 Oct: "a proper biome with its mask"): the cell plants its centre's mix on that
      // mix's points, then THE LAKE SHORE'S rows on the band's points (G.shore: BIO.shoreHere) whatever the centre says - the
      // band is metres wide and a 32 m cell's one mix would miss it or swallow the cell; the centre's rows skip the band.
      // A cell with no band point plants exactly as before
      const passes = centreMix ? [[M, F, false]] : [];
      if (G.nShore) { const MS = BIO.mixOf(BIO.mixAt(BIO.SHORE)); if (MS) passes.push([MS, MS.forest || {}, true]); }
      for (const [M, F, band] of passes) {
        const blotch = F.blotch || 0, blotchM = F.blotchM || 18, spread = F.coverSpread === undefined ? 0.08 : F.coverSpread;
        if (GF && GF.C && GF.C.blotch) { GF.C.blotch.amount = blotch; GF.C.blotch.cellM = blotchM; }
        const blotchAt = (x, z, seed) => (GF && GF.blotch) ? GF.blotch(x, z, seed) : 1 - blotch * vnoise(x, z, blotchM, seed % 1000);
        for (const c of speciesOf()) {
          const row = M.species && M.species[c.name]; if (!row) continue;
          if (row.onWater) continue;   // a water plant (17 Nov): the water band plants it, on the lake, never on the land
          const place = c.place || {};
          const P = protosOf(c); if (!P.length) continue;
          if (c.kind === 'cover' && LEAF.fadeOwn) for (const p of P) for (const q of p.parts) LEAF.fadeOwn(q.mat, null);   // (the reed back from the field: the shared fade)
          const sSeed = hashStr(c.name);
          const isRock = rockish(c), isShrub = c.kind === 'shrub', tallCard = shapedOf(c) && (place.size || 0) >= 0.8;
          if (isRock) {   // the rocks and the debris: their own stream, shared with the rock map (placeRocks above)
            if (band) continue;   // (the lake shore's band: its tufts, flowers and bushes; the stones stay the centre's)
            // (the split with the rocks' own ring: that ring keeps the big rocks, this one the small - by the rock's height in metres)
            const split = c.kind === 'rock' && (ROCKS || S.rockSplit > 0) ? S.rockSplit : 0;
            const made = placeRocks(c, row, F, G, centreMix, cx, cz, C, !split ? push : (p, x, y, z, s, yaw, col, tx, tz) => { if (((p.h0 || 1) * s >= split) === ROCKS) { push(p, x, y, z, s, yaw, col, tx, tz);
              // the obstacle (the alpine rocks): a big rock of the rocks' own ring is a chain of low trunk-law cylinders, its drawn foot to its top
              if (ROCKS && ALP_ON && p.bb && (p.h0 || 1) * s >= S.hitMin && typeof TREE_HITS !== 'undefined') { const L = TREE_HITS.lying(p.bb, s, false, x, z, y, yaw); if (L) for (const q of L) cell.hits.push(q[0], q[1], q[2], q[3], q[4]); } } });
            if (made) { STAT.by[c.name] = (STAT.by[c.name] || 0) + made; cell.by[c.name] = (cell.by[c.name] || 0) + made; }
            continue;
          }
          let per = 0;   // per m2
          if (isShrub) { const tot = Object.keys(M.species).filter(k => { const cc = pack.collections.find(q => q.name === k); return cc && cc.kind === 'shrub'; }).reduce((a, k) => a + (M.species[k].proportion === undefined ? 1 : M.species[k].proportion), 0) || 1;
            per = (F.under || 0) / 1000 * S.shrubs * (row.proportion === undefined ? 1 : row.proportion) / tot; }
          // THE BENCH'S COUNT: a cover's density times the MIX's own `forest.cover` (1 for every
          // shipped mix), then the ring's global `density` dial on top. The game used to skip the
          // mix's multiplier and lean on S.density alone.
          else per = (row.density !== undefined ? row.density : (place.density || 0)) * (F.cover === undefined ? 1 : F.cover) * S.density;   // no proportion, as the bench
          if (per <= 0) continue;
          const patch = row.patch !== undefined ? row.patch : (place.patch || 0), share = place.patchShare || row.patchShare || 0.35;
          // the bench's beds: centres for 0.25 x patchShare of the area, each of radius `patch`,
          // so a bed stands at density / (0.25 share) - here the beds are the top slice of a noise
          const bedFrac = patch ? Math.min(1, 0.25 * share) : 1;
          const n = Math.round(per * C * C * (patch ? 1 / bedFrac : 1) * (1 + G.bmax));   // (1 + bmax): the border's boost is drawn from this envelope
          const lift = place.lift === undefined ? 1 : place.lift, noTint = !!place.noTint || !!c.maps;
          const vary = place.vary === undefined ? 0.05 : place.vary;
          for (let i = 0; i < n; i++) {
            const x = x0 + R() * C, z = z0 + R() * C, r1 = R(), r2 = R(), r3 = R();
            // the bed (see bedKeep): its own hash for the draw, so the cell's stream R() - and every
            // other species' positions in the cell - are not disturbed by a flower's beds
            // FLOWER-CLUMPS (the user 8 Nov: "they lack variation, in size, in value, in spread, in the way they clump"): inside a
            // bed a clump field of its own (a sub-bed noise) thins the bed into dense knots, sparse fringes and gaps - only ever a
            // SUBSET of what master keeps - and a few strays stand out to about twice a bed's radius. The cell's stream R() stays
            // master's: a flower master keeps draws from R() exactly as before (and is dropped only at the end, after its draws),
            // a stray master would not keep draws from its own position hash (RR) - so every other species' positions are untouched.
            let keepMine = true, mKeep = true, local = 1, hc = 0;
            if (patch) { const kp = bedKeep(x, z, patch, sSeed % 1000, bedFrac), near = BED.near, hv = hsh(Math.round(x * 13.7) + 5, Math.round(z * 11.3) - 3);
              mKeep = kp > 0 && hv <= kp;
              const kc = smooth(0.18, 0.6, vnoise(x, z, patch * 0.45, sSeed % 1000 + 307));
              keepMine = mKeep && hv <= kp * (0.1 + 0.9 * kc); local = kp * kc;
              if (!mKeep) { if (hsh(Math.round(x * 5.3) + 17, Math.round(z * 4.9) - 11) < 0.05 * near) { keepMine = true; local = 0.3; } else continue; } }
            const RR = mKeep ? R : () => hsh(Math.round(x * 17.1) + 31 * ++hc, Math.round(z * 19.3) - 7 * hc);
            if (blotch && r1 > blotchAt(x, z, sSeed)) continue;   // the bench's GF.blotch: keeps 1 - blotch .. 1 by area
            const gk = G.at(x, z);
            if (!G.ok[gk] || (band ? !G.shore[gk] : (G.mix[gk] !== centreMix || G.shore[gk]))) continue;
            if ((isShrub || tallCard) && G.bush[gk]) continue;
            if ((isShrub || shapedOf(c)) && ctx.rockExpoAt && ctx.rockExpoAt(x, z) > 0.5) continue;   // (18 Nov, the user's yes: the bushes grow in the rock's greenery, never on the stone itself)   // G1385: a strip's own clearance with `bushes` keeps the tall vegetation out (and a shaped bush's cards, MOUNTAIN-VEG)
            // the cover's query: nothing on a pavement (kill), more on a border (boost), a plot's lawn or
            // meadow or nothing instead of the biome's rows (the LAWN row is planted below, on its own)
            if (G.kind[gk] === 1 || G.kind[gk] === 3) continue;
            if (G.cut[gk] > 0.05) continue;   // G2565: the mown ground by a runway ('sides' law) grows the field's cut grass, no flower, no bush
            if (G.bmax > 0 || G.kill[gk] > 0) { const keep = (1 - G.kill[gk]) * (1 + G.boost[gk]) / (1 + G.bmax); if (keep < 1 && RR() > keep) continue; }   // a rejection sampler: n was drawn at (1 + bmax) x
            // BERRY-THICKETS (the user 8 Nov, via A0: "keep optimizing what we have, the flowers and the berry bushes"): the bushes
            // stood as an even scatter. A clump field of the species' own (16 m) gathers them into thickets with open ground
            // between, WITHOUT ONE BUSH MORE: a bush in a gap walks up the field (three steps at most, inside its cell, each landing
            // where the same land tests pass), so the count - the cost - is master's; the cell's stream R() is untouched (the walk
            // reads the field, no draw)
            let px = x, pz = z, kc = 0.5;
            if (isShrub) {
              const kAt = (u, v) => vnoise(u, v, 16, sSeed % 1000 + 511);
              const fits = (u, v) => { const g = G.at(u, v); return !!G.ok[g] && (band ? !!G.shore[g] : (G.mix[g] === centreMix && !G.shore[g])) && !G.bush[g] && G.kind[g] !== 1 && G.kind[g] !== 3 && !(G.cut[g] > 0.05) && !(G.kill[g] > 0.01); };
              let k0 = kAt(px, pz);
              for (let st = 0; st < 3 && k0 < 0.6; st++) {
                const e = 1.5, gx = kAt(px + e, pz) - kAt(px - e, pz), gz = kAt(px, pz + e) - kAt(px, pz - e), gl = Math.hypot(gx, gz);
                if (gl < 1e-6) break;
                const step = 1.5 + 5 * (0.6 - k0) / 0.6;
                const nx = Math.min(x0 + C - 0.01, Math.max(x0, px + gx / gl * step)), nz = Math.min(z0 + C - 0.01, Math.max(z0, pz + gz / gl * step));
                if (!fits(nx, nz)) break;
                px = nx; pz = nz; k0 = kAt(px, pz);
              }
              kc = smooth(0.3, 0.75, k0);
            }
            const p = draw(P, r2);
            const y = world.terrainH(px, pz);
            let s = 1, yaw = r3 * Math.PI * 2, col = null;
            if (isShrub && place.hMin !== undefined && place.hMax !== undefined && p.h0 > 0) {
              s = (place.hMin + RR() * (place.hMax - place.hMin)) / p.h0;
              // BERRY-THICKETS: bigger in a thicket's heart, smaller at its edge; a few old big bushes and young small ones; a value
              // spread (+-12 %), some in the shade of their thicket, a few paler - each from the bush's own hash (no draw)
              const ho = hsh(Math.round(px * 4.3) + 3, Math.round(pz * 5.7) - 17);
              s *= (0.82 + 0.36 * kc) * (ho < 0.06 ? 1.3 : ho > 0.9 ? 0.62 : 1);
              const jj = 1 + (hsh(Math.round(px * 3.3) - 29, Math.round(pz * 2.9) + 7) * 2 - 1) * 0.12, hs = hsh(Math.round(px * 2.1) + 13, Math.round(pz * 2.6) - 31);
              const m = (kc > 0.7 && hs < 0.35) ? [0.8, 0.8, 0.8] : hs > 0.92 ? [1.08, 1.1, 1.0] : [1, 1, 1];
              col = [jj * m[0], jj * m[1], jj * m[2]];
            }
            // the species' size ALWAYS (the reed's 0.012 is absolute); a MIX ROW may scale it (`size`, a factor:
            // a village's grass is shorter than a moor's - 2026-09-22)
            else s = (place.size || 1) * (row.size === undefined ? 1 : row.size) * Math.exp((RR() * 2 - 1) * spread);
            const yy = y - (place.sink || 0);
            if (!noTint && !isShrub) {
              col = lifted([G.col[gk * 3], G.col[gk * 3 + 1], G.col[gk * 3 + 2]], lift);
              if (vary) { const j = 1 + (RR() * 2 - 1) * vary; col = [col[0] * j, col[1] * j, col[2] * j]; }
              // THE DARKEST TUFT here too (17 Nov 16:00, the user's "almost black" grass at the forest's edge: the field's floor never reached the
              // first ring's tufts, coloured by the dark forest-floor ground): under minAlb (linear luminance, 0.06 as the field) toward grey at it
              { const mA = S.minAlb === undefined ? 0.06 : S.minAlb, L = 0.2126 * col[0] + 0.7152 * col[1] + 0.0722 * col[2];
                if (mA > 0 && L < mA) { const t = Math.min(1, 1 - L / mA) * 0.8; col = col.map(v => v * (1 - t) + mA * t); } }
              // a species' own hue swing (G3430, the user: "random colouration"): place.hueTurn [lo, hi] degrees about the grey
              // axis, from the tuft's own hash so the cell's stream R() - every other species' tufts - is untouched; the
              // lake-shore fern runs green -> yellow -> bronze (negative is toward red)
              if (place.hueTurn && GF && GF.hueTurn) {
                const h = hsh(Math.round(x * 7.3) + 11, Math.round(z * 6.1) - 7), a = place.hueTurn[0] + h * (place.hueTurn[1] - place.hueTurn[0]);
                col = GF.hueTurn(col, a * Math.PI / 180).map(v => Math.max(0, v));
              }
            } else if (noTint && !isShrub && vary) { const j = 1 + (RR() * 2 - 1) * vary, mu = place.mul || [1, 1, 1]; col = [j * mu[0], j * mu[1], j * mu[2]];   // place.mul: an untinted picture's own colour (17 Nov: the shrub cards half as bright, less yellow)
              // an untinted species' small hue swing (G3430, the user 27 Oct: "don't color them as the ground", the reeds on their
              // own hue/sat/light and "a small variation per instance"): the multiplier that turns place.hueRef (the tinted texel's
              // mean, relative) by hueTurn [lo, hi] degrees - a grey multiplier has no hue to turn; the tuft's own hash, as above
              if (place.hueTurn && place.hueRef && GF && GF.hueTurn) {
                const h = hsh(Math.round(x * 7.3) + 11, Math.round(z * 6.1) - 7), a = place.hueTurn[0] + h * (place.hueTurn[1] - place.hueTurn[0]);
                const rf = place.hueRef, t = GF.hueTurn(rf, a * Math.PI / 180);
                col = [0, 1, 2].map(i => j * Math.max(0, t[i]) / Math.max(1e-3, rf[i]));
              }
            }
            if (patch) {   // FLOWER-CLUMPS: taller at a clump's heart, shorter at its fringe; a wider value spread, some faded, some in shade
              s *= (0.72 + 0.45 * local) * Math.exp((hsh(Math.round(x * 6.7) - 13, Math.round(z * 7.9) + 29) - 0.5) * 0.44);
              if (hsh(Math.round(x * 8.9) + 61, Math.round(z * 9.7) - 43) < 0.04) s *= 1.35;   // VEG-1: a few spikes over the bed
              const jj = 1 + (hsh(Math.round(x * 3.1) + 41, Math.round(z * 2.7) - 19) * 2 - 1) * 0.18, hv2 = hsh(Math.round(x * 2.3) - 5, Math.round(z * 3.9) + 23);
              const m = hv2 < 0.22 ? [1.0, 1.14, 1.12] : hv2 > 0.84 ? [0.7, 0.7, 0.7] : [1, 1, 1], b = col || [1, 1, 1];
              col = [b[0] * jj * m[0], b[1] * jj * m[1], b[2] * jj * m[2]];
              if (!keepMine) continue;
            }
            push(p, px, yy, pz, s, yaw, col, 0, 0); STAT.by[c.name] = (STAT.by[c.name] || 0) + 1; cell.by[c.name] = (cell.by[c.name] || 0) + 1;
          }
        }
      }
      if (cell.hits.length && world.treeHits) { cell.hitKey = 'alprocks:' + cellKey(cx, cz); world.treeHits.set(cell.hitKey, cell.hits); ALP.sets++; ALP.ops++; ALP.hits += cell.hits.length / 5; }   // (one op to the sim worker, sim_link)
      if (!ROCKS && ctx.edgeD && BIO.edgeOn) edgeBand(G, x0, z0, C, push, cell);   // FOREST-EDGE: the bushes and weeds on the open side of an edge
      if (!ROCKS && ctx.lakeSD && ctx.waterY && S.water !== false) waterBand(G, x0, z0, C, push, cell);   // THE WATER PLANTS: the lily pads on the shallow lake
      // the meshes: one InstancedMesh per prototype part
      const T = new THREE.Matrix4(), Q = new THREE.Quaternion(), V = new THREE.Vector3(), SC = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0);
      let yLo = Infinity, yHi = -Infinity; for (const it of items.values()) for (let i = 1; i < it.xs.length; i += 7) { if (it.xs[i] < yLo) yLo = it.xs[i]; if (it.xs[i] > yHi) yHi = it.xs[i]; }
      const NRM = new THREE.Vector3(), QT = new THREE.Quaternion();
      if (!isFinite(yLo)) { yLo = yHi = world.terrainH(x0 + C / 2, z0 + C / 2); }
      const yMid = (yLo + yHi) / 2, ySpan = (yHi - yLo) / 2;
      cell.box = [x0, yLo - 1, z0, x0 + C, yHi + 6, z0 + C];   // the instances' feet +- a bush's height: the reach test below
      for (const it of items.values()) {
        const n = it.xs.length / 7; if (!n) continue;
        const rand = new Float32Array(n); for (let i = 0; i < n; i++) rand[i] = R();
        const mats = new Float32Array(n * 16);
        for (let i = 0; i < n; i++) {
          const o = i * 7; Q.setFromAxisAngle(UP, it.xs[o + 4]); V.set(it.xs[o], it.xs[o + 1], it.xs[o + 2]); SC.setScalar(it.xs[o + 3]);
          if (it.xs[o + 5] || it.xs[o + 6]) { NRM.set(-it.xs[o + 5], 1, -it.xs[o + 6]).normalize(); QT.setFromUnitVectors(UP, NRM); Q.premultiply(QT); }   // the lean: up -> the ground's normal, after the yaw
          T.compose(V, Q, SC); T.toArray(mats, i * 16);
        }
        const col = it.col ? new Float32Array(it.col) : null;
        // every part of the prototype draws the same instances (a bark part and a leaf part)
        // (a twig or a pebble under S.castMinH casts no shadow: a texel of the map at most, and a shadow draw per model per
        // block; 0.5 m since G585 - the user: "shadows only for the kinds/sizes that show one (rocks > ~0.5 m)")
        const cast = castOf(it.p);
        if (batched(it.p.kind)) {   // into the ring's batches, hidden until the block they fall in is (re)built (buildBlock)
          for (const part of it.p.parts) {
            const bm = batchFor(it.p.all, part, cast);
            for (let i = 0; i < n; i++) {
              const id = batchAdd(bm, part.geo);
              T.fromArray(mats, i * 16); bm.setMatrixAt(id, T);
              V4.set(col ? col[i * 3] : 1, col ? col[i * 3 + 1] : 1, col ? col[i * 3 + 2] : 1, rand[i]); bm.setColorAt(id, V4);
              bm.setVisibleAt(id, false);
              cell.inst.push(bm, id);
            }
          }
        } else for (const part of it.p.parts) cell.parts.set(part, { n, mats, col, rand, cast, kind: it.p.kind, cell });
        cell.n += n;
      }
      STAT.built++; STAT.lastMs = performance.now() - t0; STAT.maxMs = Math.max(STAT.maxMs, STAT.lastMs); STAT.building = null;
      if (ROCKS && STAT.lastMs > ALP.worstMs) ALP.worstMs = STAT.lastMs;
      return cell;
    }
    function dropCell(key) {
      const cell = cells.get(key); if (!cell) return;
      markBlock(cell.cx, cell.cz);
      for (let k = 0; k < cell.inst.length; k += 2) { batchVis(cell.inst[k], cell.inst[k + 1], false); cell.inst[k].deleteInstance(cell.inst[k + 1]); }   // the batched ones go now (past Rdrop: out of reach)
      cell.inst.length = 0;
      for (const k in cell.by) { STAT.by[k] -= cell.by[k]; if (STAT.by[k] <= 0) delete STAT.by[k]; }   // the tally is LIVE (it ran up for the page's life before L4)
      if (cell.hitKey && world.treeHits) { world.treeHits.drop(cell.hitKey); ALP.sets--; ALP.ops++; ALP.hits -= cell.hits.length / 5; }
      cell.dead = true;   // (a grow in flight lets go of it)
      cells.delete(key);
    }

    // ---- THE BLOCKS (PERF 2026-09-23) -----------------------------------------------
    // A cell is 32 m because that is the planting's grain; it was also the DRAW's - one InstancedMesh
    // per prototype part per cell, ~10 a cell, 1 000 draws and 1 100 shadow draws at 120 m AGL over
    // a forest (the frame study's census), each of them a round of GL state through the command
    // buffer. The draw's grain is now a BLOCK of B x B cells: one InstancedMesh per part per block,
    // the cells' instance arrays copied in, rebuilt when a cell of it comes or goes (nearest first,
    // `blockBudget` a frame; until then the block draws what it held). Culling is the block's own
    // sphere (the frustum) and the fade's reach (below); the instances and the shader are the
    // cells' own, so the picture is the same.
    let B = FIELD ? S.block : 4;   // (the field's: `block` x `block` of its 16 m cells - the near band must not submit 128 m; a dial: draws against truncation's grain)
    const blocks = new Map();
    const now = () => performance.now() / 1000;   // the grow's clock (trees.js uFadeNow / aBorn)
    // THE BATCHES GROW ON THE CPU (G670): a BatchedMesh instance has a matrix and a colour and no attribute of its own
    // (the fade's threshold already rides the colour's alpha), so a near cell's rocks, debris and shrubs are scaled
    // about their own origins, frame by frame, for S.grow s - [cell, t0, [bm, id, matrix x16, ...]]
    const growing = [], GM = new THREE.Matrix4();
    function growTick(t) {
      for (let g = growing.length - 1; g >= 0; g--) {
        const G = growing[g], cell = G[0], k = Math.min(1, (t - G[1]) / Math.max(1e-3, S.grow)), L = G[2];
        if (cell.dead) { growing.splice(g, 1); continue; }
        for (let i = 0; i < L.length; i += 3) {
          GM.fromArray(L[i + 2]); const e = GM.elements;
          if (k < 1) for (const j of [0, 1, 2, 4, 5, 6, 8, 9, 10]) e[j] *= Math.max(1e-3, k);
          L[i].setMatrixAt(L[i + 1], GM);
        }
        if (k >= 1) growing.splice(g, 1);
      }
    }
    const blockOf = (cx, cz) => Math.floor(cx / B) + ',' + Math.floor(cz / B);
    function markBlock(cx, cz) {
      const k = blockOf(cx, cz); let b = blocks.get(k);
      if (!b) { b = { key: k, bx: Math.floor(cx / B), bz: Math.floor(cz / B), group: new THREE.Group(), meshes: [], box: null, dirty: true }; root.add(b.group); blocks.set(k, b); }
      b.dirty = true;
    }
    function buildBlock(b) {
      for (const m of b.meshes) { b.group.remove(m); m.geometry.dispose(); if (m.dispose) m.dispose(); }   // the wrapper and the instance buffers; the prototype's own are shared
      b.meshes = []; b.dirty = false;
      const parts = new Map(); let box = null, live = 0;
      b.instCells = []; b.instVis = null;   // the cells whose batched instances this block switches with its reach (update) - cells, not
                                            // ids: a dropped cell's ids are handed to the next instances made
      const t = now(), ex = camera.position.x, ez = camera.position.z;
      for (let dz = 0; dz < B; dz++) for (let dx = 0; dx < B; dx++) {
        const cell = cells.get(cellKey(b.bx * B + dx, b.bz * B + dz)); if (!cell) continue;
        live++;
        // the first block that holds a cell is the moment it can be seen: its birth for the grow (a cell planted
        // while the ring is hidden - the pre-grow - is old by the time the fade lets it show, and does not grow)
        if (cell.born === undefined) {
          cell.born = root.visible ? t : -1e9;
          const mx = (cell.cx + 0.5) * S.cell - ex, mz = (cell.cz + 0.5) * S.cell - ez;
          if (cell.born > 0 && cell.inst.length && S.grow > 0 && mx * mx + mz * mz < S.growNear * S.growNear) {
            const L = [];
            for (let k = 0; k < cell.inst.length; k += 2) { const bm = cell.inst[k], id = cell.inst[k + 1]; bm.getMatrixAt(id, GM); L.push(bm, id, Float32Array.from(GM.elements)); }
            growing.push([cell, t, L]); growTick(t);
          }
        }
        if (cell.inst.length) b.instCells.push(cell);
        if (cell.box) { const c = cell.box; box = box ? [Math.min(box[0], c[0]), Math.min(box[1], c[1]), Math.min(box[2], c[2]), Math.max(box[3], c[3]), Math.max(box[4], c[4]), Math.max(box[5], c[5])] : c.slice(); }
        for (const [part, d] of cell.parts) { let a = parts.get(part); if (!a) parts.set(part, a = []); a.push(d); }
      }
      b.box = box;
      if (!live) { root.remove(b.group); blocks.delete(b.key); return; }
      if (!box) return;
      const sph = new THREE.Sphere(new THREE.Vector3((box[0] + box[3]) / 2, (box[1] + box[4]) / 2, (box[2] + box[5]) / 2),
                                   Math.hypot(box[3] - box[0], box[4] - box[1], box[5] - box[2]) / 2 + 8);
      for (const [part, list] of parts) {
        let n = 0; for (const d of list) n += d.n; if (!n) continue;
        // (made EMPTY and given its buffer: three's constructor writes an identity matrix into every instance, all of
        // them overwritten on the next line - most of a rebuilt block's cost at the stand's 66 000 tufts; G603)
        const m = new THREE.InstancedMesh(part.geo, part.mat, 0);
        m.instanceMatrix = new THREE.InstancedBufferAttribute(new Float32Array(n * 16), 16); m.count = n;
        const hasCol = list.some(d => d.col), col = hasCol ? new Float32Array(n * 3).fill(1) : null, rand = new Float32Array(n), born = new Float32Array(n);
        let o = 0, smax = 0;
        for (const d of list) { m.instanceMatrix.array.set(d.mats, o * 16); if (d.col) col.set(d.col, o * 3); rand.set(d.rand, o); born.fill(d.cell.born, o, o + d.n); o += d.n; if (d.smax > smax) smax = d.smax; }
        // THE COUNT TRUNCATION (GRASS-DENSE G2561; GRASS-STUDY §4.3.1): an instance is drawn while the fade's keep x (1 + band)
        // is over its aRand, so the block's instances are put in order of aRand (a counting sort into BINS) and each frame
        // submits only the prefix the block's NEAREST point can show (update: mesh.count) - the ones left out are those the
        // vertex shader would have thrown off screen anyway, so the picture is the same to the pixel and the vertex work is
        // not paid for the ~70 % the fade has already collapsed. The matrices, colours, births move with their aRand (the
        // sway's phase is the instance's own aRand, never re-derived).
        let bins = null;
        // (not a mesh that CASTS - the batch: false A/B's rocks and shrubs: three's depth pass has no fade, so a collapsed instance
        // still casts, and leaving it out would move a shadow; the tufts never cast)
        if (S.trunc && !list[0].cast && part.mat.userData && part.mat.userData.fade) {
          const NB = 32, cnt = new Uint32Array(NB + 1);
          for (let i = 0; i < n; i++) cnt[Math.min(NB - 1, (rand[i] * NB) | 0) + 1]++;
          for (let b2 = 1; b2 <= NB; b2++) cnt[b2] += cnt[b2 - 1];
          bins = Uint32Array.from(cnt);   // bins[b] = the instances with aRand under b / NB
          const pos = Uint32Array.from(cnt), M0 = m.instanceMatrix.array, M1 = new Float32Array(n * 16), C1 = col ? new Float32Array(n * 3) : null, R1 = new Float32Array(n), B1 = new Float32Array(n);
          for (let i = 0; i < n; i++) { const b2 = Math.min(NB - 1, (rand[i] * NB) | 0), j = pos[b2]++;
            for (let q = 0; q < 16; q++) M1[j * 16 + q] = M0[i * 16 + q];
            if (C1) { C1[j * 3] = col[i * 3]; C1[j * 3 + 1] = col[i * 3 + 1]; C1[j * 3 + 2] = col[i * 3 + 2]; }
            R1[j] = rand[i]; B1[j] = born[i]; }
          m.instanceMatrix.array.set(M1); if (C1) col.set(C1); rand.set(R1); born.set(B1);
        }
        m.userData.bins = bins; m.userData.n = n; m.userData.smax = smax;
        if (col) m.instanceColor = new THREE.InstancedBufferAttribute(col, 3);
        // the prototype's buffers shared, the instanced aRand per mesh: a thin geometry wrapper
        const geo = part.geo, g2 = new THREE.BufferGeometry(); g2.index = geo.index; for (const k in geo.attributes) g2.setAttribute(k, geo.attributes[k]);
        g2.setAttribute('aRand', new THREE.InstancedBufferAttribute(rand, 1));
        g2.setAttribute('aBorn', new THREE.InstancedBufferAttribute(born, 1));   // G670: each instance its cell's birth (trees.js FADE_VS)
        // the block's own sphere (the instances hold world positions, the mesh stands at the origin),
        // on the geometry AND the object: r186 culls an InstancedMesh on its own, and would union the
        // geometry's at every instance otherwise
        g2.boundingSphere = sph; m.geometry = g2; m.boundingSphere = sph;
        m.frustumCulled = true; m.matrixAutoUpdate = false;   // at the origin, for ever
        m.renderOrder = -1;   // occluders before the ground (render_world.js ORDER_NOTE)
        m.castShadow = list[0].cast; m.receiveShadow = true;
        m.userData.coverKind = list[0].kind;   // cover / shrub / rock / debris: the instruments' read (PERF 2026-09-23)
        if (LAWN) m.userData.lawn = true;      // GRASS-CARDS: the lawn's draws apart (the cost rig, tools/perf/lawn_rig.js)
        m.instanceMatrix.needsUpdate = true;
        b.group.add(m); b.meshes.push(m);
      }
    }

    // ---- G2358 (DMG-SCAR): THE SCAR'S CULL ----------------------------------------------
    // A crash's scar (34_scar.js primitives, sealed once an event: sim_view.js dmgS.scar) takes the grass out of its
    // FOOTPRINT (the craters' discs, the gouges' strips) and the shrubs and the debris out of the footprint and the
    // SWEEP (the band the wreck itself swept); the rocks stay. On the CPU, once, at the event: each live cell under it
    // drops those instances from its arrays (its block rebuilt - the instances re-uploaded once, by the frames' own block
    // budget) and the batched ones are deleted; a cell planted later skips them (push above). No shader, no uniform, no
    // program key moves: the fade's program draws fewer instances. `scar(null)` lets it go: the cells it touched are
    // dropped and plant again whole (the planting is hashed on the cell: the same cover as before the crash).
    const SCR = { n: 0, prims: [], boxF: null, boxS: null, bx: null };   // (bx: each primitive's box - scarBoxes, G2382)
    const inBox = (b, x, z) => !!b && x >= b[0] && x <= b[2] && z >= b[1] && z <= b[3];
    // (scarIn is the core's, 34_scar.js: the one footprint the page and the gate test)
    function scarCut(kind, x, z) {
      if (kind === 'cover') return inBox(SCR.boxF, x, z) && scarIn(SCR.prims, x, z, false, SCR.bx);
      if (kind === 'shrub' || kind === 'debris') return inBox(SCR.boxS, x, z) && scarIn(SCR.prims, x, z, true, SCR.bx);
      return false;
    }
    const cellIn = (cell, b) => !!b && (cell.cx + 1) * S.cell >= b[0] && cell.cx * S.cell <= b[2] && (cell.cz + 1) * S.cell >= b[1] && cell.cz * S.cell <= b[3];
    function scarApply(prims) {
      const t0 = performance.now();
      const was = SCR.boxS;
      SCR.prims = (prims && prims.length && typeof scarIn === 'function') ? prims.slice() : []; SCR.n = SCR.prims.length;
      SCR.boxF = SCR.n ? scarBox(SCR.prims, false) : null; SCR.boxS = SCR.n ? scarBox(SCR.prims, true) : null;
      SCR.bx = SCR.n && typeof scarBoxes === 'function' ? scarBoxes(SCR.prims) : null;
      let cut = 0, cells0 = 0, dropped = 0;
      // the cells under the scar before: planted again whole (or under the new scar, by push)
      if (was) for (const [k, cell] of [...cells]) if (cellIn(cell, was)) { dropCell(k); dropped++; }
      if (SCR.n) for (const cell of cells.values()) {
        if (!cellIn(cell, SCR.boxS)) continue;
        let n0 = cut;
        // the per-block instances (the tufts, the flowers; the shrubs on the A/B's instanced path): a prototype's parts
        // share one record's arrays - compacted once
        const done = new Map();
        for (const [part, d] of cell.parts) {
          if (d.kind !== 'cover' && d.kind !== 'shrub' && d.kind !== 'debris') continue;
          let c = done.get(d.mats);
          if (!c) {
            const keep = [];
            for (let i = 0; i < d.n; i++) if (!scarCut(d.kind, d.mats[i * 16 + 12], d.mats[i * 16 + 14])) keep.push(i);
            c = { n: keep.length, cut: d.n - keep.length };
            if (c.cut) {
              c.mats = new Float32Array(c.n * 16); c.rand = new Float32Array(c.n); c.col = d.col ? new Float32Array(c.n * 3) : null;
              keep.forEach((i, j) => { c.mats.set(d.mats.subarray(i * 16, i * 16 + 16), j * 16); c.rand[j] = d.rand[i]; if (c.col) { c.col[j * 3] = d.col[i * 3]; c.col[j * 3 + 1] = d.col[i * 3 + 1]; c.col[j * 3 + 2] = d.col[i * 3 + 2]; } });
              cut += c.cut; cell.n -= c.cut;
            }
            done.set(d.mats, c);
          }
          if (c.cut) { d.n = c.n; d.mats = c.mats; d.rand = c.rand; d.col = c.col; }
        }
        // the batched shrubs and debris: their instances deleted (a block's reach switch no longer meets them)
        let gone = null;
        for (let k = 0; k < cell.inst.length; k += 2) {
          const bm = cell.inst[k], id = cell.inst[k + 1], kind = bm.userData.coverKind;
          if (kind !== 'shrub' && kind !== 'debris') continue;
          bm.getMatrixAt(id, GM); const e = GM.elements;
          if (!scarCut(kind, e[12], e[14])) continue;
          batchVis(bm, id, false); bm.deleteInstance(id); cut++; cell.n--;
          (gone || (gone = new Set())).add(k);
        }
        if (gone) {
          const keep = []; for (let k = 0; k < cell.inst.length; k += 2) if (!gone.has(k)) keep.push(cell.inst[k], cell.inst[k + 1]);
          // a cell still growing lets go of the deleted ids (growTick would write a deleted instance)
          for (const G of growing) if (G[0] === cell) { const L = G[2], L2 = [];
            for (let i = 0; i < L.length; i += 3) if (keep.some((x, j) => j % 2 === 0 && x === L[i] && keep[j + 1] === L[i + 1])) L2.push(L[i], L[i + 1], L[i + 2]);
            G[2] = L2; }
          cell.inst = keep;
        }
        if (cut > n0) { cells0++; markBlock(cell.cx, cell.cz); }
      }
      STAT.scarCut = cut; STAT.scarCells = cells0; STAT.scarDropped = dropped; STAT.scarMs = performance.now() - t0; STAT.scarPrims = SCR.n;
      return { cut, cells: cells0, dropped, ms: STAT.scarMs };
    }

    // ---- per frame ------------------------------------------------------------------
    let queue = [];
    const EYE = { x: NaN, z: NaN, t: 0, vx: 0, vz: 0 };   // the eye's ground velocity, smoothed (the lead)
    function updateBody() {
      { const live = skinRing(); if (live !== skinLive) { skinLive = live; for (const m of skinMats) m.needsUpdate = true; } }
      // THE ALPINE ROCKS' LINE (PERF-LEAD, 22 Nov): every 15 s while it changes - the cells, the instances, the worst cell's main-thread ms,
      // the hit sets live and the ops sent to the sim worker (one per set landed or dropped)
      // (PERF-LEAD 22 Nov: the runner reads GLOBALS at a run's end - window.FLYDIY_ALPROCKS, refreshed every second; the line every 15 s)
      if (ROCKS && ALP_ON && typeof performance !== 'undefined') { const tn = performance.now(); if (tn - (ALP.tg || 0) > 1000) { ALP.tg = tn;
        let ni = 0; for (const c of cells.values()) ni += c.n;
        const G = { cells: cells.size, instances: ni, worstMs: +ALP.worstMs.toFixed(1), sets: ALP.sets, cyl: Math.round(ALP.hits), ops: ALP.ops };
        if (typeof window !== 'undefined') window.FLYDIY_ALPROCKS = G;
        if (tn - ALP.t > 15000) { ALP.t = tn;
          const line = 'alprocks: cells ' + G.cells + ', instances ' + G.instances + ', worst cell ms ' + G.worstMs + ', obstacles ' + G.sets + ' sets / ' + G.cyl + ' cylinders, worker ops ' + G.ops;
          if (line !== ALP.logged) { ALP.logged = line; console.log(line); } } } }   // (the rock skin: on when the rock ring is)
      if (!S.on || S.off || !pack || !BIO) { if (root.visible) root.visible = false; return; }   // (S.off: the GRAPHICS row's 'off' - the field's own `on` is the A/B)
      const ex = camera.position.x, ez = camera.position.z, gy = world.terrainH(ex, ez);
      const agl = Math.max(0, camera.position.y - gy); STAT.agl = agl;
      const aglK = 1 - smooth(S.aglFull, S.aglOff, agl); STAT.aglK = aglK;   // (the rock map reads the fade's height term)
      const t = now();
      LEAF.fade(S.near, S.reach, S.taper, aglK, FSET);   // (the field: its own set, and its size fade; the first ring: the shared one)
      if (FIELD && LEAF.fadeSize) LEAF.fadeSize(S.sizeFade, S.hRef / Math.max(1e-6, fieldH0), FSET, S.sizeMax);
      if (FIELD && !LAWN) ROOT_U.value.set(Math.max(0, Math.min(1, +S.root || 0)), Math.max(0.01, +S.rootH || 0.4), fieldH0, S.rootKey ? fieldKeyW() : 0);   // (w: the field by colour, 11 Nov)   // G2571 (live: a uniform)
      if (LEAF.grow) LEAF.grow(t, null, S.grow);
      { const dt = t - EYE.t;
        if (dt > 0 && dt < 0.5 && isFinite(EYE.x)) { const a = Math.min(1, dt / 0.5); EYE.vx += ((ex - EYE.x) / dt - EYE.vx) * a; EYE.vz += ((ez - EYE.z) / dt - EYE.vz) * a; }
        else if (!(dt > 0 && dt < 0.5)) { EYE.vx = 0; EYE.vz = 0; }   // a jump (a teleport, a pause): no lead from it
        EYE.x = ex; EYE.z = ez; EYE.t = t; }
      root.visible = aglK > 0.001;
      if (growing.length) growTick(t);
      // THE PRE-GROW (G671, A2-FADES; the playtest: "grass too late on approach"). The ring used to be dropped whole
      // above aglOff (150 m) and planted again from nothing on the way down - at budgetMs a frame, nearest first -
      // so the field was still filling while the fade was already letting it show. Below aglPre it now keeps
      // PLANTING while hidden (on preBudgetMs: it draws nothing, the fade holds every instance at 0), so on a
      // descent the ring is there when the height term opens; over aglPre it is dropped, as before.
      const hidden = aglK <= 0.001; STAT.hidden = hidden;
      if (hidden && agl > S.aglPre) { if (cells.size) for (const k of [...cells.keys()]) dropCell(k); for (const b of [...blocks.values()]) buildBlock(b); queue.length = 0; STAT.live = 0; return; }
      const C = S.cell, reachP = S.reach * (FIELD && S.sizeFade > 0 ? Math.max(1, S.sizeMax) : 1);   // (the field plants as far as its tallest tuft shows)
      const R2 = (reachP + C) * (reachP + C), Rdrop = (reachP + 2 * C) * (reachP + 2 * C);
      const cx0 = Math.floor(ex / C), cz0 = Math.floor(ez / C), nr = Math.ceil((reachP + C) / C);
      // THE LEAD (G671): what the aeroplane is flying toward is planted first - the queue is ordered by the distance
      // to where the eye will be in S.lead s (at most 60 % of the reach ahead), still only the cells within the reach
      let lx = EYE.vx * S.lead, lz = EYE.vz * S.lead; { const l = Math.hypot(lx, lz), m = 0.6 * S.reach; if (l > m) { lx *= m / l; lz *= m / l; } }
      STAT.lead = Math.round(Math.hypot(lx, lz));
      queue.length = 0;
      for (let dz = -nr; dz <= nr; dz++) for (let dx = -nr; dx <= nr; dx++) {
        const cx = cx0 + dx, cz = cz0 + dz;
        const mx = (cx + 0.5) * C - ex, mz = (cz + 0.5) * C - ez, d2 = mx * mx + mz * mz;
        if (d2 > R2) continue;
        if (!cells.has(cellKey(cx, cz))) { const ax = mx - lx, az = mz - lz; queue.push([Math.min(d2, ax * ax + az * az), cx, cz]); }
      }
      queue.sort((a, b) => a[0] - b[0]);
      const t0 = performance.now(), budget = hidden ? S.preBudgetMs : S.budgetMs;
      // THE FIELD'S TIERS (G2563): a cell is planted for the nearest the eye now is to it (3-D: across the ground to its square,
      // and the height), less 40 % - the eye may come that much closer before the cell needs its next slice; within `near`
      // the whole stream. Nearer than that, it is planted again (the prefix and the next slice; its birth kept, so nothing
      // that stood grows again), nearest first, on the same budget after the new cells.
      const ey = camera.position.y;
      const nearOf = cell => { const dx = Math.max(0, Math.abs((cell.cx + 0.5) * C - ex) - C / 2), dz = Math.max(0, Math.abs((cell.cz + 0.5) * C - ez) - C / 2);
        return Math.hypot(dx, dz, Math.max(0, ey - (cell.box ? cell.box[4] : gy))); };
      const tierFor = d => (!FIELD || !S.tier || d <= S.near * 0.5) ? 0 : d * 0.6;
      while (queue.length && performance.now() - t0 < budget && cells.size < S.maxCells) { const [, cx, cz] = queue.shift();
        const dx = Math.max(0, Math.abs((cx + 0.5) * C - ex) - C / 2), dz = Math.max(0, Math.abs((cz + 0.5) * C - ez) - C / 2);
        buildCell(cx, cz, FIELD ? tierFor(Math.hypot(dx, dz, Math.max(0, ey - world.terrainH((cx + 0.5) * C, (cz + 0.5) * C) - 4))) : 0); }   // (the cell's own ground, a hill's tufts are nearer than the AGL)
      if (FIELD && S.tier && performance.now() - t0 < budget) {
        const up = [];
        for (const cell of cells.values()) if (cell.dTier > 0) { const d = nearOf(cell); if (d < cell.dTier) up.push([d, cell]); }
        up.sort((a, b) => a[0] - b[0]); STAT.tierUp = up.length;
        for (const [d, cell] of up) { if (performance.now() - t0 >= budget) break; const born = cell.born; dropCell(cellKey(cell.cx, cell.cz)); buildCell(cell.cx, cell.cz, tierFor(d), born); }
      }
      STAT.plantMs = performance.now() - t0;
      for (const [k, cell] of cells) { const mx = (cell.cx + 0.5) * C - ex, mz = (cell.cz + 0.5) * C - ez; if (mx * mx + mz * mz > Rdrop) dropCell(k); }
      // A CELL PAST THE REACH DRAWS NOTHING (PERF 2026-09-23): the fade collapses every instance whose
      // 3D distance to the eye is past `reach` (trees.js FADE_VS), so a cell whose NEAREST point is past
      // it is only vertex work, a draw and a shadow draw - in flight most of the ring (at 120 m AGL the
      // whole outer band). Hidden, the picture is the same to the pixel; what goes with it is the shadow
      // those collapsed instances still cast (three's depth material has no fade), which was a phantom.
      { const ey = camera.position.y, R2r = S.reach * S.reach, dist2 = b => { const x = b.box; if (!x) return 0;
          const dx = Math.max(x[0] - ex, 0, ex - x[3]), dy = Math.max(x[1] - ey, 0, ey - x[4]), dz = Math.max(x[2] - ez, 0, ez - x[5]); return dx * dx + dy * dy + dz * dz; };
        const dirty = []; for (const b of blocks.values()) if (b.dirty) dirty.push(b);
        if (dirty.length) { const tb = performance.now(); dirty.sort((a, b) => dist2(a) - dist2(b)); for (const b of dirty.slice(0, S.blockBudget)) { buildBlock(b); STAT.blockN++; } STAT.blockMs += performance.now() - tb; }   // (blockN / blockMs: update()'s report)
        STAT.dirty = Math.max(0, dirty.length - S.blockBudget);   // G1119: the blocks still to rebuild after this frame (0: the ring is idle)
        let shown = 0, draws = 0, sub = 0, all = 0;
        const band = bandNow(), href = S.hRef / Math.max(1e-6, fieldH0), sizeK = FIELD ? S.sizeFade : 0;
        for (const b of blocks.values()) { const d2 = b.box ? dist2(b) : 0, v = !!b.box && d2 < R2r * (sizeK > 0 ? Math.max(1, S.sizeMax) ** 2 : 1); if (b.group.visible !== v) b.group.visible = v;
          if (v) { shown++;
            // THE TRUNCATION (G2561, buildBlock): the prefix the block's nearest point can show - its largest instance's size
            // fade taken, so no instance that would draw is left out; a block that shows none is not drawn at all
            const d = Math.sqrt(d2);
            for (const m of b.meshes) { const N0 = m.userData.n;
              if (S.trunc && m.userData.bins) { const ratio = sizeK > 0 ? Math.max(0.05, 1 + (Math.min(S.sizeMax, Math.max(0.05, m.userData.smax / href)) - 1) * sizeK) : 1;
                const th = keepD(d / ratio) * aglK * (1 + band), NB = m.userData.bins.length - 1, cnt = th >= 1 ? N0 : m.userData.bins[Math.min(NB, Math.ceil(th * NB))];
                if (m.count !== cnt) m.count = cnt; const vis = cnt > 0; if (m.visible !== vis) m.visible = vis; }
              else if (m.count !== N0) { m.count = N0; m.visible = true; }
              if (m.visible) { draws++; sub += m.count; } all += N0; } }
          if (b.instCells && b.instVis !== v) { for (const cell of b.instCells) for (let k = 0; k < cell.inst.length; k += 2) batchVis(cell.inst[k], cell.inst[k + 1], v); b.instVis = v; } }
        STAT.shown = shown; STAT.blocks = blocks.size; STAT.draws = draws + batches.size; STAT.batches = batches.size; STAT.submitted = sub; STAT.inBlocks = all; }
      STAT.live = cells.size; STAT.queued = queue.length;
      let ni = 0; for (const c of cells.values()) ni += c.n; STAT.instances = ni;
      STAT.mixAt = ctx.biomeAt(ex, ez, 0.5);
    }
    // PERF-TRACE (PERF-LEAD, 22 Nov: "the cover slot's time - one block rebuilt, or spread over the frame's updates?"). The
    // recorder's `cover` slot is ONE push round five updates (render_world.js: this file's four layers and the rock ring), and
    // the evening's journeys show it as a REGIME, not a spike: 10-15 ms a frame for hundreds of frames below 100 m. A layer
    // whose update took 4 ms or more says what it was made of, by the streamers' contract ('deliver': the freeze ledger,
    // tools/slot_frames.js): the cells planted and the planting's ms (each layer has its OWN budgetMs, and they add up), the
    // blocks rebuilt and their ms; the rest of the ms is the per-block visibility pass. Nothing under 4 ms: one small event
    // a slow update, none in cruise.
    const LAYER_NAME = 'cover ring: ' + (ctx.layer || 'cover');
    function update() {
      const t0 = performance.now(), b0 = STAT.built; STAT.plantMs = 0; STAT.blockMs = 0; STAT.blockN = 0;
      updateBody();
      const ms = performance.now() - t0;
      if (ms >= 4) { const FR = (typeof window !== 'undefined' && window.FLIGHT_REC) || null, r1 = x => Math.round((x || 0) * 10) / 10;
        if (FR && FR.event) FR.event('deliver', ms, { s: LAYER_NAME, n: STAT.built - b0, what: 'planted ' + (STAT.built - b0) + ' cells in ' + r1(STAT.plantMs) + ' ms, rebuilt ' + STAT.blockN + ' blocks in ' + r1(STAT.blockMs) + ' ms',
          plantMs: r1(STAT.plantMs), blocks: STAT.blockN, blockMs: r1(STAT.blockMs), queued: STAT.queued || 0 }); }
    }
    // REVEAL-HITCH (19 Oct): THE CELLS ROUND AN EYE, PLANTED NOW. The shed's loop never runs the world's update, so the first
    // flight frame after a roll-out found the stand's ring unplanted - or planted from the boot's settle eye, 6 m up and 22 m
    // off, at a coarser tier - and built the cell under the reveal's eye whole, its full stream (the field's 'near' tier),
    // in that frame: the ~0.2 s of the reveal's hitch. app.js plants the reveal's eyes ahead (under the boot's overlay, and
    // a cell a slice during the roll-out shot): every cell whose square lies within `rad` m of (ex, ez), at the tier
    // `update` gives it from that eye (the same rule, the same height term), nearest first; a cell already planted as fine
    // or finer is left, a coarser one planted again (its birth kept). `ms`: the time it may take (checked before each
    // cell). Returns { built, done }
    function plantNear(ex, ey, ez, rad, ms) {
      if (!S.on || S.off || !pack || !BIO) return { built: 0, done: true };
      const C = S.cell, t0 = performance.now(), want = [];
      const tierFor = d => (!FIELD || !S.tier || d <= S.near * 0.5) ? 0 : d * 0.6;
      const n = Math.ceil(rad / C) + 1, cx0 = Math.floor(ex / C), cz0 = Math.floor(ez / C);
      for (let dz = -n; dz <= n; dz++) for (let dx = -n; dx <= n; dx++) {
        const cx = cx0 + dx, cz = cz0 + dz;
        const gx = Math.max(0, Math.abs((cx + 0.5) * C - ex) - C / 2), gz = Math.max(0, Math.abs((cz + 0.5) * C - ez) - C / 2);
        if (Math.hypot(gx, gz) > rad) continue;
        const tier = FIELD ? tierFor(Math.hypot(gx, gz, Math.max(0, ey - world.terrainH((cx + 0.5) * C, (cz + 0.5) * C) - 4))) : 0;
        const have = cells.get(cellKey(cx, cz));
        if (have && !(have.dTier > tier)) continue;   // planted, as fine or finer (a first-ring cell has no tier: whole)
        want.push([Math.hypot(gx, gz), cx, cz, tier, have]);
      }
      want.sort((a, b) => a[0] - b[0]);
      let built = 0;
      for (const [, cx, cz, tier, have] of want) {
        if (performance.now() - t0 > ms) return { built, done: false };
        if (!have && cells.size >= S.maxCells) break;
        let born; if (have) { born = have.born; dropCell(cellKey(cx, cz)); }
        buildCell(cx, cz, tier, born); built++;
      }
      return { built, done: true };
    }
    const api = {
      update, root, plantNear,
      get: () => Object.assign({}, S),
      set: o => { const was = Object.assign({}, S); Object.assign(S, o || {});
        if (FIELD && (S.cards !== was.cards || S.variants !== was.variants)) protos.clear();   // the tufts are cut again
        if (FIELD && S.block !== was.block) { const nb = Math.max(1, S.block | 0); S.block = was.block; api.replant(); B = S.block = nb; }   // the old blocks emptied under the old grain, then the new one
        // what the planting reads (a replant); the fade's dials (near, reach, taper, AGL, the size fade's strength) are live
        const PLANT = LAWN ? ['cell', 'dens', 'cutH', 'cutSigma', 'tallH', 'tallSigma', 'stripH', 'stripSigma', 'lean', 'hRef', 'sizeMax', 'colour', 'match', 'vary', 'tier', 'trunc', 'minCut', 'lawnWet', 'tallCards', 'lakeMargin']
                    : FIELD ? ['cell', 'cards', 'variants', 'tufts', 'sizeMax', 'lakeMargin', 'hK', 'sigmaK', 'blotch', 'clumpM', 'clumpAmp', 'tier', 'hRef', 'colour', 'match', 'vary', 'cutH', 'tallH', 'tallSigma', 'minH', 'cutSigma', 'cutDens', 'stripH', 'stripDens', 'trunc', 'weeds', 'weedsH', 'weedsD', 'green', 'greenDens', 'greenLo', 'greenSpan', 'feather', 'cutFloor', 'texGrass', 'minAlb']
                            : ['cell', 'density', 'shrubs', 'rocks', 'batch', 'castMinH', 'castMinDebris', 'trunc', 'rockSplit'];   // (rockSplit: the rocks' own ring's split, 17 Nov)
        if (PLANT.some(k => S[k] !== was[k])) api.replant(); return api.get(); },
      species: () => (LAWN ? LAWN_SPECIES.slice() : FIELD ? FIELD_SPECIES.slice() : []),   // what the field plants (the first ring leaves it to it: ctx.owned)
      layer: ROCKS ? 'rocks' : LAWN ? 'lawn' : FIELD ? 'grass' : 'cover',
      fadeSet: () => FSET,   // the field's own fade uniforms (null: the shared set) - GATE COVER reads them
      lakeMargin: () => (FIELD ? Math.max(0, +S.lakeMargin || 0) : 0.3),   // G2572: render_world okAt reads it (both rings), no copy a call
      field: FIELD, lawn: LAWN, alp: ALP_ON, alpStat: () => Object.assign({ cells: cells.size }, ALP),
      fieldAt: LAWN ? lawnAt : fieldAt, fieldAtReset: () => FA.clear(),   // (16 Nov) the instrument: what the field plants at a point, and why
      replant: () => { FA.clear(); for (const k of [...cells.keys()]) dropCell(k); for (const b of [...blocks.values()]) buildBlock(b); growing.length = 0; },
      // WORLD-RAIL-VEG: a shaped species re-built (the world editor's alpine shrub rows moved its pack row's place - size, aspect,
      // bend, lean, tilt, upright - or its cut, tint.alpha): its prototypes dropped (geometry and material; the picture is kept),
      // the ring replanted. A shaped card is a per-block InstancedMesh (kind cover, never batched), so nothing else holds them
      reshape: name => { const old = protos.get(name); if (!old) return false; protos.delete(name); api.replant();
        for (const p of old) for (const q of p.parts) { if (q.geo && q.geo.dispose) q.geo.dispose(); if (q.mat && q.mat.dispose) q.mat.dispose(); }
        return true; },
      shapes: () => (FIELD || !pack ? [] : pack.collections).filter(shapedOf).map(c => c.name),   // the shaped species (the editor's rows; none on the grass field)
      cardDef: () => Object.assign({}, CARD_DEF),   // the shaped cards' defaults where a species' place says nothing
      // SHED-FLOOR: only the cells a box touches (a shed stood or came down: render_world floorsChanged) - dropped, so the
      // ring plants them again on its budget, nearest first, with what the land test now says
      replantBox: (x0, z0, x1, z1) => { const C = S.cell; let n = 0;
        for (const [k, cell] of [...cells]) { const ax = cell.cx * C, az = cell.cz * C; if (ax <= x1 && ax + C >= x0 && az <= z1 && az + C >= z0) { dropCell(k); n++; } }
        return n; },
      rockPlan,                                                           // the rock map's read (above)
      // G2358 (DMG-SCAR): a crash's scar (its primitives; null or [] lets it go) - the cull above, once; scarIn(x, z, kind):
      // is an instance of that kind cut there (the gate's read)
      scar: prims => scarApply(prims), scarNow: () => SCR.prims, scarCut: (kind, x, z) => SCR.n > 0 && scarCut(kind, x, z),
      // every live instance by kind, with its position (the gate's census: [kind, x, z, ...]) - the batched ones read back
      census: () => { const out = []; for (const cell of cells.values()) {
        const seen = new Set(); for (const d of cell.parts.values()) { if (seen.has(d.mats)) continue; seen.add(d.mats); for (let i = 0; i < d.n; i++) out.push(d.kind, d.mats[i * 16 + 12], d.mats[i * 16 + 14]); }
        for (let k = 0; k < cell.inst.length; k += 2) { cell.inst[k].getMatrixAt(cell.inst[k + 1], GM); out.push(cell.inst[k].userData.coverKind, GM.elements[12], GM.elements[14]); } }
        return out; },
      // WHAT THE RING SEES AT A POINT (the instrument, 2026-09-22): the sub-grid node's own answers -
      // the mix, the pavement's kill and class, the land test - so a "why is there a log on the runway"
      // is one call instead of a guess
      nodeAt: (x, z) => { const C = S.cell, cx = Math.floor(x / C), cz = Math.floor(z / C), G = subGrid(cx * C, cz * C, C), k = G.at(x, z);
        return { cell: [cx, cz], mix: G.mix[k], code: G.code[k], ok: !!G.ok[k], kill: +G.kill[k].toFixed(3), cls: G.cls[k], kind: G.kind[k], boost: +G.boost[k].toFixed(3),
          cut: +G.cut[k].toFixed(3), green: G.green ? +G.green[k].toFixed(3) : null, col: [G.col[k * 3], G.col[k * 3 + 1], G.col[k * 3 + 2]].map(v => +v.toFixed(4)) }; },
      rockProtos: () => speciesOf().filter(c => rockish(c) || (S.farBush > 0 && shapedOf(c))).map(c => ({ c, P: protosOf(c) })),   // (+ the shaped shrub cards: the bushes' far tier, 17 Nov)   // the sprites' subjects (rocks and debris)
      stat: () => Object.assign({}, STAT, { by: Object.assign({}, STAT.by) }),   // a copy of the tally too (a shallow copy shared it)
      dispose: () => { api.replant(); for (const bm of batches.values()) { root.remove(bm); bm.dispose(); } batches.clear(); scene.remove(root); },
    };
    return api;
  }
  return { make, FIELD_TYPES, FIELD_SPECIES, greenOf, SET_GRASS, LAWN_DEF, LAWN_SPECIES };   // greenOf: GRASS ON GREEN (GATE GREENGRASS) // (the field's table: the biome card's defaults, world_rail)
})();
if (typeof window !== 'undefined') window.COVER_RING = COVER_RING;
