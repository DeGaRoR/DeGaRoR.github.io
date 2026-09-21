# BIOMES IN THE GAME — the study (2026-09-20)

The user: "study how we will integrate these biomes in-game. Another session has just
finished integrating the alpha-splatting to the core game, and we need to exploit the same
regions to map biomes. Then we need a biome editor, similar to the bench, minimized by
default. Study the architecture first, in order to integrate gracefully and to map
everything nicely to the terrain categorization system. No integration yet."

Read: the splat session's uncommitted tree (worktree `jolene-bench-mounting-766707`:
`src/viewer/splat_ground.js`, `splat_tex.js`, `src/core/28b_ground_fields.js` with the
RECIPE, `render_world.js` +19, `tools/island_prep.py` +30), `render_world.js` (the fill
streamer, the pool, the island rule), `20_world.js` / `28_island.js` (the classifier, the
cell API), `tree_prep.py` (what the payload is), `dev_panel.js` (F8 > trees), `clouds_ui.js`
(the newest rail panel), `premises_ui.js` + `27_premises.js` (the editor's zones), and the
bench's own mix model (`tools/_trees.html`, `_trees_tuning.json`).

## 1. What is there (as found)

### 1.1 The terrain categorisation — ONE grid, three consumers

`tools/island_prep.py` writes `<island>.ttype.u8`, one byte per DEM cell (Jolene at 10 m
and 5 m), derived from WorldCover class x NDVI x canopy x slope x coast:

    0 sea  1 lake  2 heath/grass  3 muskeg  4 sand  5 scree  6 rock  7 scrub  8 forest
    9 snow  10 built  11 shingle (the rocky beach; G452-era shore rule)

The game loads it as `ISLA.ttype`, published at `world.island.ttype` with `cellAt(x, z)`
(28_island.js) — the SAME index `canopyAt` / `ndvi` use. The ground programs read it from
`uGPackB.g` (the packed layers, G424). Three derived codes exist ONLY in the splat shader
(`splat_ground.js`, `sSplat`): 12 cliff = rock by slope (knobs `cliffLo/Hi`, 32–42°),
13 forest old = forest by canopy (`oldLo/Hi`, 14–20 m), 14 scrub dense = scrub by canopy
(`denseLo/Hi`, 1–2.5 m). The ground blends codes over a 5x5 cell kernel of radius
`splatBlend` (1.6 cells) after a 23 m value-noise wobble of `splatWobble` (8 m) — the
boundaries are soft and jittered on purpose.

`GROUND_FIELDS.RECIPE` (28b_ground_fields.js, the peer's newest) is the master table:
per code the near sets + scales, the far sets, the mask `[cell, sharp, biasAB, biasC]`,
the vary `[hue, value, cell]`, orient; then the knobs and the per-set grades; the library
in layer order. `CODES[k]` (what the bench's tufts read) is DERIVED from it. The
bench's mixes already name their `ttype` and take that row — parity with the ground by
construction (G454.7). F8 > environment > ground has a "terrain type" view.

### 1.2 The trees in the game — the fill streamer, and what it does NOT know

`render_world.js`:
- `plantWoodland()` — the analytic world's collidable woodland (`world.trees`), off the
  cone/blob until the pack lands.
- THE FILL STREAMER: 1024 m chunks on one NG grid (160 on an island = 6.4 m), a BASE part
  (the even sub-lattice, to `R_ACT`) and a FILL part (the rest, inside `FILL_ACT`, thinned
  in the shader by `uThin`), every point hashed on its grid index (`hsh(ix, iz)`) so the same
  point is the same tree for ever; the walk sliced and budgeted per frame (`FILL.budgetMs`);
  `forestHere(x, z)` = the corridor, the exclusions, the surface class (`FOREST_FLOOR`),
  water — and on an island the premises' forest/clear zones through the classifier.
- THE ISLAND RULE (G406, in `walk`): `ttype -> kind` (8: 1.0, 7: 0.5, 3: 0.12, 2: 0.04,
  else none; 2/3 stunted to 3 m canopy), canopy -> the ramp (`from`/`full`) and the size
  (`gain`, `min`, `max`), NDVI -> vigour, slope > 0.7 -> a third. So the terrain type
  already decides HOW MUCH stands. It does not decide WHAT.
- THE SPECIES: `treePool()` = every collection of `TREE_PACK` x `place.proportion` / its
  subjects; `poolPick` weights by `SPECIES_PREF` (altitude band, a per-species zone noise,
  wet = within 60 m of water, steep) — five conifers, hand-written. The series
  (specimen / stand / snag) by `place.dead` and `TREE_MIX.furnished`; the three-band
  ladder (150/300/450) + impostors beyond (`treesSettled` before any bake — G452).
- NOTHING ELSE GROWS: no shrub, no cover, no rock, no flower in the game. `tree_prep.py`
  bakes `included` collections and only their `trees` subjects (`a.get('trees')`); the
  bench's shrubs / covers / rocks / flowers are kinds the payload has no slot for.

### 1.3 The dials, the panel, the editor

- F8 > trees (`dev_panel.js` 119–175): the island knobs (from/full/gain/min/max), fill
  density, thinning, lightness, furnished / spread, the ladder, the leaf, per-collection
  tints. The pattern: a `fold`, sliders that call the world's setters.
- The newest rail panel is `clouds_ui.js` (G436.9): `mount(host, H, ctx)` with the rail's
  own row helpers, a whitelist of DIALS saved as `flydiy.clouds`, presets that SET the
  fields (no modes), every row writing through the same setters F8 uses. That is the
  pattern the biome panel should copy — one panel, both rails (G436.10).
- The world editor (`premises_ui.js`, records only, the renderer rebuilds): sections
  TERRAIN / AIRFIELD / ROADS / ZONES / TREES / SITES / OBJECTS / FILE / VIEW. ZONES are
  polygons with a `kind` in `ZONE_KINDS` (`residential … forest, clear`); the forest zone
  plants (27_premises.js 1184), the clear zone is a derived exclude (1013). A biome is one
  more polygon kind.

### 1.4 The bench's model (what has to travel)

`_trees_tuning.json`: `tuning[species]` (kind tree/shrub/cover/dead/rock, file, subjects,
size, hMin/hMax, density, patch/patchShare, vary, lift, contrast, maps/aspect for a
flower, bury for a rock) and `mixes[name]` = `{ species: { key: { proportion, density,
patch, size } }, forest: { count, under, rocks, reach, coverNear, taper, holes, blotch,
coverSpread, ttype, ground overrides… } }`. Five mixes: conifer, deciduous, muskeg,
grassland, borders. The cover rules (fade, holes, beds, blotch, the tuft's colour = the
ground's at its foot through `GF.groundColor` + `shade` x `lift`, capped) live in
`_trees.html` — bench-side JS, not yet a module.

## 2. The mapping — a biome IS a terrain-type row

The ground already has the region map; the vegetation must read the same byte, blended
the same way, or the grass will stand on the wrong set. So:

**One table, beside RECIPE**: `BIOMES[code]` in a new `src/core/28c_biomes.js` (or a
second block of 28b), keyed by the SAME codes 0–14, each row a bench mix (the mix's
`species` + `forest` blocks as they are). The bench's `mixes` become this table's source
(`tree_prep.py` copies them into the payload; the bench keeps editing them).

| code | ground row (RECIPE) | biome (bench mix) | note |
|---|---|---|---|
| 2 heath | dry + grass | **grassland** | fireweed packs, few rocks |
| 3 muskeg | mud + lush, pools | **muskeg** | stunted pines, dead sticks, dry + reed beds |
| 7 scrub | grass + lush | **borders** | plates, ash, shrubs 0.5–3 m, rocks medium |
| 14 scrub dense | lush + grass | borders, denser (`under` x2) | derived by canopy |
| 8 forest | leaves + mud | **conifer** | saplings + bushes under, dead herbs in the holes, rocks 10 |
| 13 forest old | leaves + rocksG | conifer, older: size gain, more snags, `under` half, rocks x1.5 | derived by canopy |
| 5 scree / 6 rock / 12 cliff | rocks | **scree**: rocks only, no cover (a new small mix) | |
| 4 sand / 11 shingle | beach / pebble | none (rocks on the shingle, a little) | |
| 9 snow, 10 built, 0/1 water | — | none | the lots dress their own ground |

**Deciduous is not a code.** Annette's broadleaf (alder, cottonwood, birch) stands where
the ground is disturbed or wet — the river strips, the shore flats, the low fans. That is
exactly `SPECIES_PREF`'s `wet` ground (within 60 m of water) and its altitude band. So
the deciduous mix is a PREFERENCE inside codes 8 / 7: the biome row lists birch + ash with
a `where: { wet: 1.6, alt: [0, 120] }` weight, the conifers with theirs, and the draw is
the existing `speciesWeight` over the biome's own pool. No new byte in the map. (A
"deciduous" polygon in the editor can still force it — §4 L5.)

**The derived codes must exist on the CPU.** 12/13/14 are computed in the fragment
shader from slope/canopy against `R.knobs`. The vegetation walks on the CPU, so the same
derivation goes into 28b as `deriveCode(tt, slopeDeg, canopyM, knobs)` and the shader keeps
its copy of the thresholds (one knob set, two readers — the sampler census forbids a
texture for it). `codeAt(x, z)`: the island cell's byte -> deriveCode -> then the premises'
biome polygons (§4 L5) override.

**Boundaries.** The ground blends five cells with an 8 m wobble; the vegetation samples
`codeAt` at the SAME wobbled position (23 m value noise, the `gVnoise` of the shader
re-done in JS — 28b already has `vnoiseT`) and draws the biome of that one cell. With
the point hash that gives a jittered, blended edge for free, and never a tree of biome A
on the ground of biome B beyond one cell.

## 3. What travels into the game (the payload)

`tree_prep.py` today: `included` collections, `trees` subjects only, `place` + `tint` as
data. Needed:
- KINDS in the payload: shrub, cover, rock, flower (the bench's index already tags them;
  `build_subject` is the same for all — a cover has no series, a rock no ladder).
- The flowers: the seven PNGs at 512 px (1–3 MB each today) with `aspect`; the rock pack's
  three 2k PNGs (5 MB) re-encoded 1k JPEG like the trees' maps (base as shipped, normals
  half — TREE-IMPORT §7).
- `biomes.json` (the mixes) and the species tuning the cover needs (`density`, `patch`,
  `lift`, `contrast`, `vary`, `hMin/hMax`, `bury`, `size`).
- `included` is what gets baked — and `tree_fit.js` had been overwriting it with the
  species it was fitting (eight commits at `["grass_scan"]`; fixed G454.11: the fit keeps
  the committed list). GATE TREES should assert the five conifers stay in it.

## 4. The integration, in layers (each shippable alone)

- **L0 — the table and the codes.** `28c_biomes.js` (BIOMES rows = the bench mixes),
  `deriveCode` + `codeAt` in 28b, `tree_prep.py` copying the mixes. GATE: every code has
  a row or an explicit `null`; every species a row names is in the payload.
- **L1 — species by biome in the fill walker.** In `walk`: `code = codeAt(x, z)`, the
  row's `kind` factor replaces the hard-coded 1.0/0.5/0.12/0.04, `poolPick` runs over the
  row's pool (its `proportion`s x `SPECIES_PREF`), the row's `size` / `dead` / `under`
  ride on the record. Same hash, same point, same tree — a replant is a re-walk.
  The far tier is untouched (the canopy map is the map's, not the biome's).
- **L2 — the understory.** Shrubs as a second record on the same walk (the bench's
  `under` per 1000 m², `hMin/hMax` uniform in metres, no impostor: geometry to ~300 m,
  the L2 rung beyond, nothing past 600 m). Its own InstancedMesh per chunk part; the
  partition on the CPU like the trees'.
- **L3 — the cover ring.** Grass, flowers, rocks in a ring around the EYE (not the
  chunk): `coverNear` 50 / `reach` 220 as the bench, in 64 m cells hashed on the cell
  index and rebuilt as the eye crosses cells; per cell one InstancedMesh per prototype;
  the tuft's colour = `GF.groundColor(row, GROUND_MEANS)` x `shade` x `lift` (capped) on
  `instanceColor` — so `splat_tex_prep.js` must publish each set's MEAN colour in
  `SPLAT_TEX_SETS` (the bench measured the images at load; the game must not read pixels).
  The rules to port from `_trees.html` into a module (`28d_cover_rules.js`): the fade
  `keep = (1-t)^(1+2·taper)`, the holes, the beds (`patch`/`patchShare`), the blotch,
  `coverSpread`, the flower cards (`flowerCards`), the rock bury. Covers cast no shadow.
  **The AGL switch**: a 220 m ring is nothing from 300 m up — the ring is built only
  while the eye is under ~120 m AGL, faded out above, and its budget (instances per
  frame, cells per frame) is a knob. The bench measured the cost per coverage
  (GRASS-RULING-2026-09-20.md: plates cheapest); grassland is 240 k instances at full
  ring in the bench — the game's number must be measured against the 20 ms dense-stand
  frame before the ring goes wider than 150 m.
- **L4 — F8.** A `biomes` fold: the code at the eye (readout), per-row density / size /
  under / cover / rocks dials, the ring's reach / near / AGL. All through the same setters
  the panel (L6) uses.
- **L5 — the editor.** A `biome` polygon kind in ZONES (kind = a code name or a mix name);
  `codeAt` consults the premises first (like `forestHere` consults forest/clear). ONE
  record moves both the ground and the vegetation — the splat's `sCodeAt` reads the packed
  texture, so a biome polygon also has to be baked into `uGPackB.g` when the premises
  rebuild (the premises patch already carries its own ground material; the cheap route is
  to stamp the polygon's code into the island's ttype buffer on load, since both
  consumers read that buffer).
- **L6 — the biome panel.** `biomes_ui.js` on the clouds_ui pattern: `mount(host, H,
  ctx)`, presets = the bench's five mixes, per-biome rows (species proportion / density /
  patch, `under`, `rocks`, `count`, the cover dials), the DIALS whitelist saved as
  `flydiy.biomes`, `export` = the same JSON the bench reads (a round trip: bench ↔ game
  edit one file). Mounted collapsed ("minimized by default"), on both rails (G436.10).

Order: L0 → L1 (the visible win: deciduous by the water, muskeg stunted, borders) → L3
(the grass is what the user judges) → L2 → L4/L6 → L5.

## 5. Budgets and traps

- **Samplers**: the ground programs stand at 10 / 14 / 15 of 16 (splat_ground.js head).
  The cover and the understory are their OWN programs — nothing here touches the
  ground's count. The tuft reads no ground texture (its colour is CPU-side).
- **The frame**: the dense stand is 20 ms at 1920x1080 (TREE-IMPORT §8). The cover ring
  and the understory are additive; the A2C shimmer (owed) worsens with instance count.
- **The walk**: `world.surface` is 2.4 µs a call and the tree walk is sliced for it;
  `codeAt` is a byte read + a slope (two terrainH) — keep it under that.
- **The bake race** (G452): shrub atlases, if any, go through `treesSettled` too.
- **The tuft's colour** needs the set means from the manifest (not the images).
- **The deciduous/conifer share** by `wet` depends on `world.hydro.distW` — on the island
  that is the lake field + the bake's rivers; the shore is `coastAt` (add it to `groundAt`).

## 6. Rocks: LODs?

The pack's rocks are 68–658 triangles each (5 740 for all seventeen), one material,
three 2k PNGs. Planted at 0.15–10 per 1000 m², half buried, 1–3 m across in the conifer
(size 14 x a 0.06–0.19 unit model) and knee-high in the meadow. Inside the 220 m cover
ring that is ~1 500 rocks x ~350 tris ≈ 0.5 M triangles, instanced in one draw per
subject — under a millisecond, and the ring already cuts them at its reach; a 2 m rock at
300 m is three pixels. So: **no geometry LOD.** Two things instead: (1) the ring's fade
applies to rocks as to grass (they stop with the cover — the far ground's rock SETS carry
the look beyond), and (2) the maps are the cost: 5 MB of PNG becomes 1k JPEG (base +
normal) in the media step. Cast shadows only inside the near shadow box.

## 7. Open rulings (the user's)

1. Deciduous as a preference (wet / low) inside forest and scrub — or a code of its own
   (needs island_prep to write it; nothing in the imagery says broadleaf vs conifer).
2. The AGL cutoff for the cover ring (proposal: full under 60 m, gone by 150 m).
3. Does a biome polygon in the editor move the GROUND too (proposal: yes, one record).
4. The payload's size once shrubs + covers + rocks + flowers + deciduous are in
   (today's five conifers: 4.5 MB of geometry + 7.3 MB of maps).

## THE MAP AS IT STANDS (2026-09-21, G473) - terrain type -> biome on Jolene

Measured offline (tools/island_node + 28c, one point per 100 m over the 334 km2 of land; the
derived codes at the split's midpoint). Bold = the three conifer biomes of 2026-09-21. The
game plants min(1, mix trees/m2 x grid spacing^2 x biomeGain 3.5) of the grid, so the GRAPHICS
density is the ceiling: sparse 95 /ha, normal 156, dense 244, very dense 380.

| code | terrain type (island_prep) | share of the land | mean canopy | mix (biome)      | trees/ha (mix) | what stands there |
|-----:|----------------------------|------------------:|------------:|------------------|---------------:|-------------------|
| 8    | forest                     | 49.9 % (167 km2)  | 8.7 m       | **conifer_young**| 329            | spruce 2 / fir pack 3 / fir 1 / cedar 0.6 / larch 0.4, saplings under, few dead, rocks 4/1000 m2 |
| 7    | scrub                      | 21.5 % (72 km2)   | 0.2 m       | borders          | 5              | deciduous shrubs, holly, raspberry, a birch/oak/maple here and there, plates + foam |
| 12   | cliff (rock, slope > 32-42 deg) | 9.6 % (32 km2) | 8.1 m    | **conifer_steep**| 131            | the young stand at half, holes 0.4, rocks 20/1000 m2 (forested rock - Annette's slopes) |
| 2    | heath                      | 6.8 % (23 km2)    | 0.3 m       | grassland        | 2              | grass_dry / reed / plates, fireweed, a bush, a birch, rocks |
| 14   | scrub dense (scrub, canopy > 1-2.5 m) | 4.2 % (14 km2) | 2.0 m | borders      | 5              | as scrub |
| 13   | forest old (forest, canopy > 14-20 m) | 3.3 % (11 km2) | 20.4 m | **conifer**  | 164            | the old growth: cedar / fir / larch / fir pack 2.85 / spruce, 8-12 % dead, rocks 10/1000 m2 |
| 3    | muskeg                     | 3.2 % (11 km2)    | 0.1 m       | muskeg           | 18             | stunted pines (georgeous 1.6 / evolveduk 1.45), spruce, fir, dead conifers + sticks, reed beds |
| 11   | shingle                    | 0.5 %             | 0.2 m       | shore            | 0              | rocks 2/1000 m2 |
| 6    | rock (slope > 38 deg or bare > 28) | 0.4 %     | 7.2 m       | **conifer_steep**| 131            | as cliff |
| 10   | built                      | 0.2 %             | -           | none             | 0              | nothing planted |
| 4    | sand                       | 0.1 %             | -           | shore            | 0              | rocks |
| 5    | scree                      | 0.1 % (547 m)     | -           | scree            | 0              | rocks 8/1000 m2 |
| 9    | snow                       | 0.1 % (970 m)     | -           | none             | 0              | nothing planted |
| 0, 1 | sea, lake                  | -                 | -           | none             | 0              | - |

To change a row: F8 > trees > biomes > code -> mix (live), export, paste over tools/_trees_tuning.json's
`biomes` + `mixes`, `python tools/tree_prep.py --biomes`.
