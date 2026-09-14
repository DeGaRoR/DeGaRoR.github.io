# JOLENE ISLAND — the first island, taken whole from Annette, seen on the bench the same day
## The ruling that replaced Admiralty, the data as found, the pipeline as run, the numbers, the layers
### (2026-09-14, from the user's design session; U1 done on the bench; §12 the same afternoon)

STATUS: **RULED AND RUN.** The island is on the bench (`tools/_terrain.html`
for the quadtree, `tools/_island.html` for every layer and the trees), the
pipeline runs end to end on this machine, the numbers below are measured.
**The game name is JOLENE ISLAND (§12.1)**; "Annette" below is the source.
Nothing is in the game yet: that is W2 → W4, in WORLD-V2 §11's order (§12.5).

SUPERSEDES, in part: `ISLAND-ADMIRALTY.md` (the island; its fantasy pass,
premise and gates STAND), `ISLAND-PREPACK.md` (the manifest and the
processing chain; its imagery argument STANDS and is sharpened in §6).

WHAT IT RELATES TO: `WORLD-V2.md` §2–§5, §11; `WORLD-QUEST-BRIEFING-2026-09-13.md`
§8 (the addendum); ROADMAP Phase 7; `tools/island_fetch.js`,
`tools/island_prep.py`, `tools/island_look.py`, `tools/terrain_bake.js`.

---

## 0. THE DECISION, IN ONE LINE

**Annette Island, Southeast Alaska, taken whole — one island, one asset, no
streaming, nothing live — and the world grows later by adding islands to the
same frame.** Admiralty (URSOY) is not abandoned; it is what "adding islands"
may one day reach, and the pipeline is the same.

---

## 1. WHY, AND WHAT THE PICTURE CONFIRMED

The user's own reading, on seeing Admiralty's size: *"admiralty is actually
huge… start with a smaller island, then maybe extend by adding islands."*
Annette: close by, the same climate and vegetation, a derelict airfield, a
basic road, and Gravina and Revillagigedo a stone's throw away.

It does more than make sense — it collapses two stages. WORLD-V2 §11 had
already ruled that *W4's 20 × 20 km slice IS the shipped world, for a long
time*. A slice of Admiralty has four cut edges and no reason to exist as a
place. Annette is that slice **with a closed coastline**: "sea level does the
edges", which both island documents asked for. W5 stops being "the whole
island, the step that invalidates every golden" and becomes **"add an
island"** — a wider domain baked by the same tool into the same frame.

**What the picture confirmed (`bench/jolene/dem.png`, 10 m, hillshade over
WorldCover):** a 1 096 m mountain (Tamgas) rising out of salt water in the
south-east with the island's one bare summit; a chain of inland lakes in the
middle; deeply indented harbours; muskeg flats on the south-west lobe; the
WWII runways as a red cross on that lobe; the town as a red patch on the
north-west lobe; and real drainage everywhere — the thing the real data was
chosen for.

**Corrections to the pitch, from memory — verify against the data, not
against this document:**
- *"Almost no houses"* is not quite right. Metlakatla is ~1 400 people —
  bigger than Angoon — but it sits in one corner (the NW lobe), and the whole
  island is the Annette Islands Reserve, so nothing else was ever built. The
  "basic path system" is the ~24 km Walden Point Road to the ferry landing on
  the north tip and the road to the airfield. Same question as Angoon (R3),
  same answer space: keep it, renamed, as the starting village — or erase it.
- *"Abandoned airport"* — derelict rather than abandoned: an ex-WWII army
  field and Coast Guard air station (closed 1977), still a public-use field
  with a ~2.3 km paved runway and next to no traffic. For the premise
  ("develop a virgin island") that is a BETTER opening than a village: a huge
  overgrown runway you carve back is subtractive — *produire, non
  reproduire* — and it is a real event on day one.
- Climate and vegetation are Admiralty's; Annette is the wettest station in
  Alaska. The fantasy pass (`ISLAND-ADMIRALTY.md` §4: lower the snowline,
  alpine palette, nothing inherited from a photograph) applies unchanged.
- Extension: **Gravina** (~245 km², roadless bar the Ketchikan airport
  corner) is the natural second island; Duke Island to the south is empty.
  **Revillagigedo carries Ketchikan** — 8 000 people, roads, cruise docks —
  and by the user's own rule that is the one to leave as a silhouette across
  the channel, not to load.

---

## 2. THE ISLAND — as measured today

| | |
|---|---|
| name | Annette Island, Alaska. The whole island is the Annette Islands Reserve (Metlakatla Indian Community). The game name is OPEN — §10 |
| land | **358 km²** at h > 0 on the IFSAR DTM at 5 m (357 at 10 m); the published figure is ~342 |
| footprint | ~23 × 31 km; domain with 4 km of open sea on every side **30.9 × 39.2 km** |
| highest | **1 095.7 m** (Tamgas Mountain) — read off the DEM |
| cover (of land, WorldCover 10 m) | tree 88.8 % · grassland 10.7 % (these are the muskeg flats — WorldCover calls the bogs grass here; class 90 wetland is ~0) · built 0.2 % · bare 0.2 % · moss/lichen 0.1 % |
| water | inland lakes come free as class 80 (the DEM holds them as flats above sea level); the sea is the DEM at h ≤ 0 |
| snowline | none in the data; §4.2's 900 m fiction puts snow on the top 200 m of Tamgas on its north faces |
| people | Metlakatla ~1 400, one corner (from memory — §1) |
| game frame | EPSG:3338 minus the origin (1 408 000 E, 808 000 N): x −15 300 … +15 650, z −18 890 … +20 305 |

---

## 3. THE DATA — as found, probed live 2026-09-14

| layer | Annette | note |
|---|---|---|
| IFSAR 5 m DTM | **one tile**, `Lower_Southeast_Alaska_Mid_Accuracy_DEM_1903.tif`, 845 MB, holds the whole island | a DIFFERENT project from Admiralty's (which came as 39 tiles of 15′): two big tiles per cell. Tiles 1896 and 1904 touch the island's box and are not needed |
| IFSAR DSM (canopy top) | `LowerSE_L3_C379` 813 MB + a sliver of `Chugach2_C391` 55 MB | not fetched; waits for the tree ladder |
| IFSAR ORI (radar, 2.5 m) | `LowerSE_L3_C379` 1 147 MB + `Chugach2_C391` 76 MB | not fetched; waits for the surface-variation work |
| ESA WorldCover v200 | **one tile** `N54W132`, 78 MB | fetched |
| NAIP optical | absent in SE Alaska (confirmed 2026-09-01) | — |

**Total for the first look: 0.9 GB** (DTM + WorldCover) instead of Admiralty's
1.6; **~3 GB for everything** instead of ~10. Under `assets/island/raw/jolene/`,
gitignored.

**The DEM's own frame is Alaska Albers.** The tile carries an Albers conic on
GRS80 with an unnamed datum — latitude of origin 50, central meridian −154,
parallels 55 and 65 — which is EPSG:3338 to the parameter. LZW, 256² blocks,
overviews to 32×. Nodata −999999 over open water.

**The API is not a dependency.** TNM Access timed out three times in a row on
the whole-island box and answered a quarter of it at once, and returned 504
on the DSM query. `island_fetch.js` now splits a box that times out, filters
every product by ITS OWN footprint against the island's (the query box catches
open water and the neighbours), and **pins** every URL it has resolved —
`--no-api` fetches from the pins alone. That is the user's rule applied to
the build side too: no live dependency on a third-party service.

---

## 4. THE GAME FRAME — R2, decided by the data

**EPSG:3338, Alaska Albers, with a fixed local origin per world.** Three
reasons, in order of weight:

1. **The elevation is delivered in it.** Taking the source's frame means the
   heights are never reprojected — only cropped and resampled. The only warp
   in the pipeline is WorldCover (EPSG:4326 → 3338, nearest neighbour), which
   is a class map and does not care.
2. **It does not have zones.** UTM 8N (the old default in `island_prep.py`)
   was wrong for Annette anyway — it is in zone 9 — and the zone boundary at
   132°W runs ~20 km west of the island, through where Gravina and Prince of
   Wales would extend. "Add islands" needs one frame with no seam.
3. **Its distortion is irrelevant at this scale.** An equal-area conic is not
   conformal, but across 40 km near its own standard parallel the scale error
   is a few parts in ten thousand — below anything the sim measures.

**The origin: (1 408 000 E, 808 000 N), Albers metres, in the island table
of `island_prep.py`, never moved.** Game coordinates are Albers minus the
origin. A float32 vertex at 1.4 × 10⁶ m has 12 cm of precision and jitters
(seen on the bench before the origin went in); at 20 km it has 2 mm. Every
island added to this world shares the origin, so they sit in one frame
without a conversion. The sidecar records both (`x0/z0` in the game frame,
`albers.x0/z0` and `origin` beside them).

*This project has paid twice for a quantity that lived in two frames. Pick
once; this is the pick.*

---

## 5. THE ARCHITECTURE RULING — easy and self-contained (the user, 2026-09-14)

> *"For as long as we can, we should keep the architecture easy and
> self-contained. No fancy streaming, just reduce the data size cleverly
> (where it doesn't matter), optimize performance, but try to have all the
> data manageable locally, no fancy streaming, no live dependency on third
> party services."*

The measurement that makes this not just a wish:

| source | ε (vertical error) | leaves | asset | bake |
|---|---|---|---|---|
| 10 m grid | 4 m | 1 507 | **1.15 MB** | 0.5 s |
| 10 m grid | 2 m | 3 235 | 2.56 MB | 1 s |
| 10 m grid | 1 m | 7 165 | 5.58 MB | 3 s |
| **5 m native** | **4 m** | 2 317 | **1.83 MB** | 1.1 s |
| **5 m native** | **2 m** | 5 800 | **4.44 MB** | 7.7 s |
| **5 m native** | **1 m** | 11 728 | **8.39 MB** | 44 s |

(`terrain_bake.js`, patch 32, gzip; the 10 m rows at ε ≤ 1 fit the bilinear
interpolation rather than data and are listed only to show the codec's
behaviour. The round trip is verified on every bake.)

**The whole island at ≤ 1 m vertical error is 8.4 MB, uniformly, with no
zones.** With zones (ε tight on the strips and around the sites, 2–4 m over
the rest, WORLD-V2 §7) it will land around 3–5 MB. Admiralty's plan budgeted
40 MB; the prepack's first draft had proposed 650 MB of streamed 5 m tiles on
a CDN. **None of that exists any more:**

- **one asset** (`.json` + `.topo` + `.bin`), committed once per world
  rebuild, fetched once by the browser like any other file in `media/`;
- **no tier-2 streaming, no object storage, no CDN**, no service the game
  talks to at runtime — the site stays static files on GitHub Pages;
- the raw data (~3 GB) is a BUILD INPUT on the developer's machine,
  reproducible from the pins, disposable;
- **"reduce the data size cleverly where it doesn't matter"** is exactly
  what the adaptive quadtree does: the error budget spends resolution on
  relief and on the places the aeroplane touches, and open sea and smooth
  slopes cost nothing.

**"Add islands" under this ruling:** widen the domain, bake again into the
same frame, ship the new asset. It stays one asset until one asset is too
big — and at these numbers, Gravina and Duke together would not double it.
The day the asset is tens of MB is the day to revisit; that day is not near.

---

## 6. IMAGERY — scoped, not dropped

The user's fear: *"without satellite imagery, we'll struggle doing convincing
textures."* Right about the problem, wrong about the cure; the prepack's §3
argument stands and is sharpened:

- **A satellite photo cannot be the texture at any altitude this game
  flies.** The free optical sources for SE Alaska are Sentinel-2 at 10 m and
  Landsat at 30 m. At 300 m AGL one 10 m texel is ~50 screen pixels wide;
  at 3 000 m it is still 3×. Plus baked shadows that fight the sun, cloud, a
  locked palette. MSFS drapes sub-metre imagery AND lays a procedural
  material over it. "Convincing" is won or lost in **W1, the splat
  material**, with detail textures — the same place MSFS wins it.
- **What imagery gives that noise never will is macro variation at
  100 m – 10 km**: the patchwork of muskeg, old growth, alder slides, beach
  fringe. The prepack already sources that from three registered,
  public-domain, colour-free layers — **ORI radar backscatter at 2.5 m**
  (finer than Sentinel), **DSM − DTM canopy height**, **WorldCover class** —
  and the first two are pinned in `island_fetch.js` for the day the trees
  ask.
- **The one thing those lack is colour variation.** For that, one more layer
  is ruled in: a **macro tint** at 30 m from **Landsat** (public domain) —
  blurred, desaturated, low weight, multiplying into the splat, never sampled
  as surface colour. Sentinel-2's licence was set aside for ShareAlike and is
  not needed for tint; the Alaska SDMI SPOT-5 2.5 m orthomosaic (via GINA) is
  the only higher-resolution optical candidate for the region and owes a
  licence check before anyone looks at it. *Not legal advice.*

So: imagery in, as a tint mask at the macro scale; nothing sampled as
surface colour; the look stays ours, which is what makes the alpine palette
over a rainforest island possible at all.

---

## 7. THE PIPELINE — as run today, on this machine

    py -3.11 -m pip install numpy rasterio scipy         # once
    node tools/island_fetch.js --island jolene --dtm-only   # 0.9 GB, resumable
    py -3.11 tools/island_prep.py --island jolene           # 10 m  -> bench/jolene/dem.{f32,u8,json}
    py -3.11 tools/island_prep.py --island jolene --cell 5 --out bench/jolene/dem5
    py -3.11 tools/island_look.py bench/jolene/dem          # -> dem.png, the quicklook
    node tools/terrain_bake.js --source grid --grid bench/jolene/dem5 --eps 2 --out bench/terrain/jolene5_e2
    node tools/_serve.js 8430   (from the repo root)
    http://localhost:8430/flyDiy/tools/_terrain.html?asset=flyDiy/bench/terrain/jolene5_e2

**The toolchain is rasterio, not the GDAL command line.** rasterio's wheel
bundles GDAL 3.10, so the whole raster side is one `pip install` — no
OSGeo4W, no conda, no PATH. The first `island_prep.py` shelled out to
`gdalbuildvrt`/`gdalwarp` and needed an installer this machine never had;
that is why U1 sat "blocked on GDAL" for two weeks. scipy is for one call
(`ndimage.label`, §8). Prep of the 5 m grid: 10 s. Bake at ε 2: 8 s.

**What `island_prep.py` does, in order:** the island's lon/lat box → 3338
plus the pad, snapped to the cell → crop + resample the DTM (average when
coarser than 5 m, bilinear at 5 m; no warp, §4) → nodata → 0 (open sea),
h < 0 → 0 (81 cells of radar noise at the tide line at 5 m) → the island
mask (§8) and the domain tightened to it → flip once so row 0 is SOUTH
(the baker indexes +z north) → WorldCover warped nearest onto the same grid,
the DEM's coast overriding its water class → `.f32` + `.u8` + `.json`.

**Machine traps, so nobody pays for them twice:**
- `python` on PATH is Inkscape's 3.10 without pip; the project's Python is
  **`py -3.11`** (3.11.9). Use it for everything here.
- **Avast Web Shield intercepts HTTPS.** Python's Windows trust store accepts
  its root; pip's bundled CA list does not, so pip fails with
  `CERTIFICATE_VERIFY_FAILED` while curl and node fetch work. This session
  installed with `--trusted-host pypi.org --trusted-host files.pythonhosted.org`;
  the clean fix is `pip install truststore` + `--use-feature=truststore`.
- The Browser pane's `preview_start` refused a sixth server (five belong to
  other chats); serve from Bash (`node flyDiy/tools/_serve.js 8430`) and
  `navigate`.
- `_terrain.html` fetches `'../../' + asset`, so from the repo root the asset
  is `flyDiy/bench/terrain/<name>`, not `bench/terrain/<name>` as its header
  says. Its `error` view samples the ANALYTIC world and means nothing for a
  grid asset; `depth` and `height` are the views. Its height palette
  saturates at 600 m (tuned for the analytic world).

---

## 8. ONE ISLAND, TAKEN WHOLE — the neighbours rule

The box around an island in an archipelago holds its neighbours' edges:
Gravina's tip is 3 km across Nichols Passage, Revillagigedo's south shore
runs along the top, Duke's tip is in the SW corner. The first run counted
1 290 km² of land in a 3 200 km² box. "Sea level does the edges" needs them
gone, and `island_prep.py` does it by default: label the land (`dem > 0`),
keep the component with the most area inside the island's own bbox, drown
the rest, tighten the domain to what is left plus the pad. Annette: component
47 of 244, **358 km² kept, 929 km² of neighbours drowned**. `--neighbours`
keeps them, for the day the domain is meant to hold more than one island.

Seen on the neighbours and NOT on Annette: rectangular nodata notches in the
DEM on the small islands to the east (they read as square bites out of the
coast at 50 m/px). If a later island shows them, they are the source's, not
the pipeline's, and the DSM or a coarser DEM would have to fill them.

---

## 9. WHAT THIS CHANGES, DOCUMENT BY DOCUMENT

| where | was | is |
|---|---|---|
| `ISLAND-ADMIRALTY.md` §0, §2, §7 | Admiralty whole; 145 × 56 km; tier 2 = 5 m streamed everywhere, 650 MB | **Annette whole**, 31 × 39 km domain, **one asset ≤ 10 MB**. §4 the fantasy pass, §9 the premise, §10 the gates STAND |
| `ISLAND-PREPACK.md` §1, §2, §5 | 39 DTM tiles; TNM API as the route; `.sh`/GDAL CLI | one tile; the API for discovery with pins; rasterio. §3 imagery STANDS, sharpened here (§6) |
| `ISLAND-PREPACK.md` §7.1 | UTM 8N or Albers, open | **EPSG:3338 + origin** (§4) |
| `WORLD-V2.md` §11 W4 / W5 | a 20 × 20 km slice; the whole island later | **W4 = Annette whole** (a closed coast instead of four cut edges); W5 = "add an island" |
| `WORLD-V2.md` §7 tier-2 streaming, `ISLAND-PREPACK.md` §5b R2/CDN | streamed tiles | **deleted** by the ruling in §5 — one asset, static files |
| ROADMAP Phase 7 items 0–2, 5 | Ursoy; U1 blocked on GDAL | Annette; **U1 done on the bench 2026-09-14** |
| R2 (projection) | open | **decided** (§4) |
| R3 (does Angoon survive?) | open | becomes "does Metlakatla survive, and is the derelict field the opening?" — §10 |
| `makeWorld(seed)` → `makeWorld(island)` | still owed at W2c | unchanged; the bounds now come from the sidecar, and they are not centred on the origin — every consumer that assumed a 24 km world around (0,0) must read `bounds` (the terrain bench already had to) |

---

## 10. OPEN QUESTIONS

1. ~~**The name.**~~ **RULED: JOLENE ISLAND** (§12.1).
2. ~~**Does Metlakatla survive?**~~ **RULED: it survives**, renamed and
   reimagined — the somewhere-to-fly-FROM (§12.1).
3. ~~**The derelict field as the opening airfield.**~~ **RULED: it is** —
   room for tests, weathered scenery (§12.1). Owed: its `sitePattern`.
4. **The muskeg.** WorldCover reads Annette's bogs as grassland (10.7 %) with
   almost no class 90. The ORI (wet, flat = dark backscatter) and the canopy
   height (short) will separate bog from meadow when they are fetched; until
   then "grassland on a flat below 200 m" is muskeg.
5. **ε and the zones** — numbers to be found by looking at W4 (WORLD-V2
   §12.3), now with a ladder to start from (§5).
6. **The tide line.** h = 0 on a DTM over a coast with 5 m tides is one
   instant's shoreline; 81 cells sat below it at 5 m. The sea in the game is
   flat at 0; where the DEM's beach reaches below it the beach is drowned.
   Fine for now; a real intertidal band is a W1 material question.

---

## 11. NEXT

In WORLD-V2 §11's order, unchanged: **W0.5b** (the TSL hooks) → **W2** the
quadtree in the game, proved on the analytic world first, then
"second world = first world" with `bench/terrain/jolene5_e2` as the first
real content → **W1** the splat material, WorldCover-driven, with the macro
tint → **W3** trees per class (fetch the DSM/ORI cells then) → **W4** the
island as THE SHIPPED WORLD → W6/W7. What changed today is that W4 no longer
waits on a data chantier: the asset exists, it is 4.4 MB, and it was looked
at.

---

## 12. THE SAME AFTERNOON — JOLENE, AND EVERY LAYER ON THE BENCH (2026-09-14)

### 12.1 Rulings taken (the user)

- **The name is JOLENE ISLAND.** The source name stays in this document, in
  the raw data and in tool comments; the island key everywhere else is
  `jolene` (`bench/jolene/`, `assets/island/raw/jolene/`, the island tables).
- **Metlakatla survives** — renamed, reimagined: the somewhere-to-fly-FROM.
- **The WWII field is the opening airfield** — *"plenty of room for tests
  and opportunity for great, weathered scenery."* A 2.3 km cross of paved
  runways on a flat muskeg lobe, at 33 m: the DTM is continuous across it
  (no pit, no bench), the built-up class marks it, the tint shows it.
- **The layers are managed on the bench BEFORE anything goes in the game.**

### 12.2 The layers, as sourced — what was found, and one verdict reversed

| layer | source | as found |
|---|---|---|
| class | ESA WorldCover 10 m | as before; the muskeg reads as grassland (10.7 %) |
| **canopy height** | **Meta/WRI global canopy height 1 m, CC-BY 4.0** — four quadkey tiles from the `dataforgood-fb-data` bucket (1.2 GB), decimated to the grid on read | over tree cover **mean 7 m, p90 15 m, max 38 m**: the tall stands stand out along the valleys and the sheltered slopes, the muskeg scrub is 2–6 m. Enough to SIZE trees; species come later from the ladder |
| ~~canopy from IFSAR DSM − DTM~~ | the prepack's "free canopy model" | **NOT the forest on this island.** At a lake shore in closed canopy the DSM equals the DTM to the metre (a 4 km native-resolution profile, §12.3); the pair only differ in patches on steep ground (≤ 22 m). Written as `.ifsar_canopy.u8` with its verdict in the sidecar; a fallback nobody should use |
| density | IFSAR ORI 2.5 m, twelve 15′ tiles from the two cells, averaged to the grid, stretched 5–95 % over non-water land | lakes black, closed canopy bright, the muskeg mid-grey — exactly the variation mask §3.1 of the prepack wanted |
| **macro tint** | **USGS Landsat 8 C2 L2 surface reflectance, two scenes of ONE pass, 27 July 2022, path 055 rows 022 + 021** (0.06 % and 3.2 % cloud); the island's window read from each band's COG through Microsoft's Planetary Computer mirror — 13 + 31 MB, not two 1 GB scenes | 3.3 % of land under cloud/shadow (the QA band says where); NDVI 0.76 over land; the seam between rows is invisible because it is one pass |
| GEDI-based height maps (GLAD, ETH) | — | **stop at 52° N**; the island is at 55°. Not available here, ever |

Tools: `island_landsat.py` (scenes pinned per island, `--search` to choose),
`island_prep.py` (every layer onto the grid: `.canopy.u8`, `.ori.u8`,
`.tint.rgb`, `.ndvi.u8`; each source warped alone onto the grid, first
non-empty wins, a source's declared nodata emptied first — a tile of
−999999 had claimed the whole grid), `island_look.py --layer all` (one
quicklook per layer; `layers.png` is the contact sheet).

### 12.3 The DSM verdict, so nobody re-derives it

Native 5 m, west–east through the lake chain (Albers 1 406 500 → 1 410 500 E
at 809 000 N): the lake at 71.6 m with ORI 1 (water); at the shore the DTM
rises 74.4 → 138.6 m over 250 m of forested slope and the DSM is the SAME
NUMBER at every sample. Across the runway (built class both sides): DTM 33.8
→ 34.0 m, no step. The GeoSAR metadata says X-band DSM and P-band DTM; on
this island the delivered pair do not carry the canopy. The DTM is fine to
fly over — that is all it has to be.

### 12.4 The bench — `tools/_island.html`

    node tools/_serve.js 8430   (repo root)
    /flyDiy/tools/_island.html?asset=flyDiy/bench/terrain/jolene5_e2&grid=flyDiy/bench/jolene/dem

The baked quadtree (drawn as `_terrain.html` draws it, distance LOD) under
ONE shader that samples every layer by world position: paint = composite ·
cover · canopy · radar · tint · NDVI · height. The composite is *class colour
→ tint (hue only; the tint's luminance is matched to the palette's so the
weight moves colour, not exposure) × radar variation × canopy shading, snow
above the line on north faces first*; every weight is a slider, every class
colour a picker. **Trees** are cones on stems, instanced, planted around the
camera from *class × canopy*: one per 10 m cell at full density in tree
cover (two where the canopy is over 15 m), fewer in shrub and muskeg, none
below a minimum canopy; height = the canopy layer × jitter; crown colour
from NDVI. 60–70 k trees in a 2.5 km radius, replanted when the target
moves. Nothing here is W1's material (that is written once, in TSL): this is
the calibration of what W1 is given.

First reading, by eye: the class palette at 10 m is blocky (WorldCover's
nearest-neighbour edges) — W1 blends across class boundaries with the radar
and the tint, and the bench already shows that the tint alone carries the
macro pattern; the canopy layer separates the tall stands from the scrub
convincingly enough to size trees; the runway cross reads from 3 km.

### 12.4b The stack, the contours, the radar bump (same day, G392.1)

The composite sliders became **a layer stack in Photoshop's model**: layers
bottom to top, each a SOURCE (class · tint · radar · canopy · NDVI · height ·
snow · normal) with a BLEND MODE (normal, multiply, screen, overlay, soft
light, hard light, darken, lighten, add, colour, luminosity, hue) at an
OPACITY; add / remove / reorder / solo; the stack persists in localStorage
and **`export`** prints the recipe (stack + knobs + class colours) — that
JSON is what W1 will be handed. Default stack = class → tint (colour 0.6) →
radar (overlay 0.5) → canopy (multiply 0.35) → snow. Lighting is applied
after the stack, with the sun on two knobs.

**Contour smoothing** for the class map (G392.2, after the user's screenshot
showed the first version still pixelated at max blur): the class map is
carried as **eight per-class weight fields** in two linearly-filtered RGBA
textures (built at load from the cover grid); the blur averages WEIGHTS over
a ring of 24 taps (metres) and the sample point is wobbled by a smooth value
noise (metres) — a smooth field by construction. The first version blurred
nearest-filtered class texels and pushed whole cells with a hash; a blur of
texels is still texels. Neither version invents a class.

**The radar as a normal map** — with a band-pass (G392.2). The raw radar has
single-texel speckle, and finite differences on a bilinear texture jump at
every texel edge (G345's "a texel's gradient is a sparkle"): the first
version bumped from the raw texture and drew a fine weave. `island_prep.py`
now writes a **Gaussian pyramid** of the ORI (levels at 10 / 25 / 60 / 140 m,
normalised convolution so the coast does not bleed sea), and the bump
height is *fine level − coarse level* — the features between two
wavelengths, both on knobs (`paint = bump band` shows what survives). The
radar COLOUR layer reads a level too (0 = raw speckle). `paint = normal`
shows the bent normal.

**Frame times** (the pane's canvas, 2334 × 1233, the bench's unoptimised
per-patch terrain at 2.5 M tris, RTX 3080): terrain alone with the 8-layer
stack and the bump **4.9 ms**; + 68 k instanced cones (2.5 km radius,
density 0.5) **6.4 ms**; + 685 k cones (every cell in 6 km) **17.8 ms** —
about 2 µs per instanced tree. The stack and the bump cost nothing
measurable. The real trees' cost is the ladder's (W0c: 0.6 ms for the
streamed forest); the bench cones are for placement and size only.

### 12.5 The game — how the world is chosen (answering "what boots first")

**LANDED the same evening (G397, the user: "just get the real trees from the
game in there, with their lods and everything ... see if we can afford the
whole island with impostors").** `dev.html?world=jolene` boots Jolene;
absent, the analytic world boots byte for byte (GATE WORLD green). What it
took: the codec into the core (`19_terrain_codec.js`, one global), the
island source (`28_island.js`: the quadtree as the ground, the cover grid
as the classifier, the canopy as the trees' size, the effective class with
the heath reclass), `makeWorld(seed, { island })` (the data's ground under
the same pad ramp — HOME's strip CUT into the lobe at 33.8 m, the field's
own height; hydrology baked on the real DEM — 1 819 river reaches, 237
lakes found; no settlements sited, no sea lane, HOME alone; the collidable
woodland where the effective class is tree cover, scaled by the canopy),
the renderer's 24 km constants read from `world.bounds` (the rings, the
forest mask, the fill's chunk cull, the outer patch uv), the loader
fetching the asset and the grids before any script runs. **THE FRAME
FLIPPED FIRST:** the game has north at −z; the grids are written north
row first and the origin moved to the WWII field's centre (1 406 524 E,
798 714 N).

**Measured (`tools/tree_perf.js --url dev.html?world=jolene`, the same
harness as W0c, alps rig, NG 100, 1080p, RTX 3080):** full AA **15.3 ms**
median (render 14.2) · AA off **9.5 ms** · 2 778 near-tier trees + 128 846
impostors live · 126 793 trees streamed in 68 chunks at 7.0 ms each,
worst frame 5.4 ms. The analytic world's own row on this harness was Off
10.2 ms. **The whole island is affordable because it is never resident:**
the streamer holds a 4 km ring (the fill) and the far tier is the domain
forest mask; Jolene's 318 km² of tree cover changes the mask's texel (76 m
over 39 km against 47 m over 24) and nothing else. The picture:
`bench/jolene/game_settled.png`.

Not built yet (owed): the GRAPHICS-menu row (the flag is the URL today);
the shipped pack in `media/` (the loader reads `bench/` on the developer's
machine); the terrain's COLOUR in the game is still the analytic palette
(W1 takes the bench's recipe); the fill's tree SIZE from the canopy (the
woodland has it, the fill does not yet); the far mask's resolution; the
WWII field as a `sitePattern`; `index.html` not rebuilt in G397 (the shared
tree carried peers' uncommitted sources at build time — the next quiet
build carries the island boot into the published page).

The plan as it was written the same afternoon, for the record:

- **A toggle, defaults unchanged.** `?world=jolene` on the URL and a row in
  the GRAPHICS menu (stored like `flydiy.cm`); absent, the analytic 24 km
  world boots exactly as today. This is W2's switch (WORLD-V2 §11 W2a).
- **What the switch changes:** `makeWorld(seed, { premises })` gains
  `{ island }` — the terrain sampler becomes `TERRAIN_CODEC.sampler` over
  the decoded asset (the bench already runs it for the trees), `bounds` come
  from the asset (not centred on 0: every consumer that assumed a 24 km world
  around the origin reads `bounds`), the surface classifier reads the cover
  grid, the tree ladder's density-by-class reads cover × canopy.
- **The editor works unchanged** — the premises compose over
  `makeWorld`'s own hooks (G385: terrain, surface, sites); an anchor is a
  position and a world; a Jolene premises record is a different world with
  the same contract. What is owed first is `sitePattern` at the WWII field:
  the opening airfield as a premises record, not a hardcoded rectangle.
- **The order stands:** W2 (the quadtree in the game — analytic first, then
  Jolene as the second world) → W1 (the material, with these layers) → W3
  (the ladder driven by cover × canopy) → W4 (Jolene as THE SHIPPED WORLD).
  The bench is where each layer's weights are settled before W1 is written.

### 12.6 Owed

The palette by eye (the composite runs dark at the shipped weights; the
sliders exist); the muskeg's own class (grassland below 200 m on flat ground
= bog, until ORI and canopy separate it properly); the 3.3 % cloud cells in
the tint (fill from the QA mask by neighbours, or a second date); the 20 m
overlay pack for the shipped asset (the bench reads the 10 m grids, ~85 MB
over localhost — the game asset is the quadtree + overlays at 20 m, ~10 MB);
a credit line check on the Meta/WRI licence text before anything ships.

### 12.7 WHAT IS FROM THE MAP — the bench against the sim (G399, 2026-09-14)

"Maps first, procedural on top" (the user). Every row says where each thing
comes from in `tools/_island.html` (the bench) and in `dev.html?world=jolene`
(the sim), so the gap is visible instead of felt.

| thing | source | the bench | the sim |
|---|---|---|---|
| ground relief | IFSAR 5 m DTM → quadtree asset (ε 2 m) | ✔ the asset | ✔ the same asset (`makeWorld({ island })`); HOME's strip CUT into it at 33.8 m |
| the sea's edge | the signed coast field off the DEM at 0 | ✔ smooth SDF line, shelf, rocky band, wet line | ✔ the sea FLOOR is a shelf off the same field (−1.5 → −12 m); the water plane covers it; the rocky band is in the albedo |
| ground colour | Landsat tint × radar overlay × canopy shade × shore × snow | ✔ live, every layer a slider (the stack) | ✔ the same stack BAKED unlit by `island_prep` (`.albedo.rgb`), mapped over both rings; not live |
| ground normal detail | radar band-pass bump | ✔ live, fading with camera distance | ✗ not yet (the game's terrain normal is the mesh's; W1) |
| land classes | WorldCover 10 m + the heath reclass (tree cover under 2.5 m canopy → shrub) | ✔ eight smooth weight fields, the contour blur | ✔ `effClass` → the classifier: tree → FOREST_FLOOR, built → PAVED, bare → ROCK/SCREE by slope, the rest GRASS, water → WATER |
| lakes | WorldCover class 80 ∪ Landsat NDWI, a signed field, flat in the DEM (G405–G407) | ✔ drawn as water class | ✔ one quad per lake at its level, the edge the field's own 4 m fade (G413 — no hard discard, the ground paint kept inside the line: the "deep vs pale" battle is gone); `waterAt` answers the class (t + 0.3) |
| rivers | — (no map source; WorldCover holds only the wide ones as water) | ✗ | ✔ THE BLEND (G413, the default `?hydro=blend`): the bake's rivers between the map's lakes — the lake field handed to the bake as its lakes (a reach ends where it enters one, restarts below), 1024 cells over the island (0.63 s), 1.2 km² of drainage to be a river, kW 0.22 / 28 m max (narrowed), routed round every premises strip by a drainage dome. `?hydro=map` = lakes alone, `?hydro=proc` = the bake's own lakes and rivers |
| where trees stand | effective class = tree cover | ✔ | ✔ `forestHere` reads the classifier |
| how MANY trees | the canopy height as a coverage ramp | ✔ stems per 100 m², thinned by canopy | ✔ (G399) the fill keeps a grid point with p = (canopy − `cover from`) / (`full cover` − `cover from`); F8 › trees › from the map |
| how TALL trees | the canopy height layer (Meta/WRI 1 m → 10 m) | ✔ height = canopy × jitter | ✔ (G399) the fill scales each tree to canopy × `size gain` / the model's own height (clamped `size min`..`max`), the mix's spread as jitter; the woodland too (canopy / 16) |
| which SPECIES | — | ✗ (cones) | procedural: the ladder's pool weighted by altitude / patches / wet-or-steep (W0c.29). By canopy: owed (W3) |
| the trees themselves | the ladder's five collections, three rungs, impostors | ✗ (cones for placement only) | ✔ the real ladder, measured |
| snow | the DEM above the snowline, SHED OFF STEEP GROUND (G409: full under 25°, none by 40° — the user: "no snow on high slopes") | ✔ live, north faces first, slope from the normal | ✔ live in the ground hook (slope from the world position's screen derivatives — `normal` is not yet defined at `map_fragment`); the baked albedo and the terrain type (900 m+, slope < 35°) carry the same rule |
| the light | — | the bench's sun knobs | the rig rows (`alps` at boot on an island), F8 › environment |
| fog | — | none | none on an island (20–90 km); F8 › environment › fog |

Measured with the map's coverage (`tree_perf`, alps, NG 100): full **15.0 ms** /
off **9.6 ms**, 1 855 near + 89 266 impostors, **78 793 trees** streamed in 68
chunks (against 129 041 uniform) — the frame is the same, the forest is the
island's.

**F8 regrouped (G399):** `trees` (from the map · density · mix; `ladder`,
`leaf`, `species` folded, each species its own fold) · `environment` (rig
row, sun, hemisphere, exposure, environment, **fog**; `shadows and floor`,
`the sea` folded) · `frame` · `camera`. Folds remember themselves. The
bench's world knobs that are NOT live in the sim (the stack's weights, the
snowline, the shore, the bump) are baked by `island_prep`; making them live
is W1's material, not a panel row.
