# THE PRE-PACKAGE — every source Ursoy needs, resolved
## Elevation · terrain type · radar imagery · the fetch manifest
### (2026-09-01)

STATUS: **RESOLVED.** Every endpoint below was probed live on 2026-09-01 and
every open question from the first draft is closed. `tools/island_fetch.js`
implements this document.

COMPANION TO: `ISLAND-ADMIRALTY.md` (the island and the fantasy pass),
`WORLD-V2.md` (the terrain architecture the data feeds).

---

## 0. THE HEADLINE

**Every layer exists, every endpoint answers unauthenticated, and the total
acquisition is about 10 GB. Attribution owed for the entire world: one line,
for WorldCover.**

Two findings changed the plan while resolving it: the imagery problem answers
itself out of the elevation programme (§3), and a canopy height model comes
free with it (§3.2).

---

## 1. THE MANIFEST — resolved

| # | layer | res | licence | tiles for Ursoy | size |
|---|---|---|---|---|---|
| 1 | **IFSAR DTM** — the ground | 5 m | **public domain** | **39** | ~1.5 GB |
| 2 | **IFSAR DSM** — the canopy top | 5 m | public domain | 10 cells (2-4 relevant) | ~4 GB |
| 3 | **IFSAR ORI** — radar intensity | 2.5 m | public domain | 10 cells (2-4 relevant) | ~5 GB |
| 4 | **ESA WorldCover v200** — terrain type | 10 m | **CC-BY 4.0** | **2** (N57W135, N57W138) | 116 MB |
| 5 | NLCD Alaska — cross-check | 30 m | public domain | — | small |
| — | ~~NAIP~~ | — | — | **0 — confirmed absent** | — |
| — | ~~Sentinel-2~~ | — | CC BY-SA 3.0 IGO | avoided — §3.3 | — |

**Everything in rows 1-3 and 5 is US federal public domain and owes nothing.**
USGS asks for citation as a courtesy; give it. Row 4 is the only obligation.

---

## 2. ELEVATION — the access route, settled

**THE API IS THE ROUTE, NOT THE BUCKET.** Walking `prd-tnm.s3.amazonaws.com`
by hand fails, and the first draft of this document failed at it: the Alaska
5 m project directory is named `Alaska_Mid_Accuracy_DEM_Summer_2015`, so it
does not appear under an `AK` prefix scan. There is no `5m/` prefix.

Use **TNM Access**, which takes a bounding box and returns download URLs:

    https://tnmaccess.nationalmap.gov/api/v1/products
      ?datasets=<tag>&bbox=W,S,E,N&outputFormat=JSON&max=100&offset=N

The three dataset tags, verbatim:

    Alaska IFSAR 5 meter DEM
    Ifsar Digital Surface Model (DSM)
    Ifsar Orthorectified Radar Image (ORI)

`https://tnmaccess.nationalmap.gov/api/v1/datasets?f=json` lists all of them.

### What it returns for Ursoy

**DTM — 39 tiles.** Individual GeoTIFFs, 19-62 MB each, on the S3 bucket:

    StagedProducts/Elevation/OPR/Projects/Alaska_Mid_Accuracy_DEM_Summer_2015/
      AK_IFSAR-Sum-L4-C352_2010/TIFF/
        USGS_AK5M_Alaska_Mid_Accuracy_DEM_Summer_2015_DTM_N5700W13415P.tif

Tile naming is `DTM_N<ddmm>W<dddmm>P` — the SE corner in degrees and minutes,
on a 15′ grid. **The API reports `format: ArcGrid` and delivers `.tif`. Trust
the extension, not the field.**

**DSM and ORI — 10 regional cells each**, as zips, e.g.

    .../Elevation/DSM/TIFF/USGS_NED_DSM_AK_IfSAR_Lower_SE_L2_C364_2012_TIFF_2016.zip   (495 MB)
    .../Elevation/ORI/TIFF/USGS_NED_ORI_AK_IfSAR_Lower_SE_L2_C364_2012_TIFF_2016.zip   (679 MB)

`Lower_SE_L2_C364` is the Southeast Alaska cell and is the one that matters;
`GB_339` is Glacier Bay, to the north. **Fetch the cells that intersect the
ISLAND, not the bounding box** — the bbox catches eight cells of open water
and neighbouring islands.

### DTM, never DSM, for the ground

In this rainforest the DSM is the canopy top, roughly 40 m above the surface
across most of Ursoy. The DSM exists here for exactly one purpose: §3.2.

### Bounding box

    -135.2, 57.0, -133.5, 58.3     (W, S, E, N)

Approximate; confirm against the data. The island runs NW-SE, so its bounding
box (~130 × 100 km) is larger than its 145 × 56 km dimensions.

---

## 3. IMAGERY — the answer was in the elevation programme

The ask: *"possibly images, as we'll need to break the uniformity of
procedural generation"* — against a standing worry that imagery drags its own
colour in.

### 3.1 ORI — Orthorectified Radar Intensity

**The right answer, and it ships from the same acquisition as the DEM.**

Four properties beat any optical source for this job:

1. **It has no colour.** Radar backscatter is one channel. It is physically
   incapable of polluting the palette — which was the whole objection.
2. **It is perfectly registered to the DEM.** Same flight, same processing. No
   co-registration, no two vendors disagreeing about where the coast is.
3. **It shows real surface variation at 2.5 m** — closed canopy against
   muskeg against bare rock against water against radar shadow. Exactly the
   macro-variation that kills a uniform procedural splat.
4. **Public domain.** No attribution, no ShareAlike.

**Use it as a variation mask, never as a texture.** It multiplies into the
splat weights and breaks class boundaries; it modulates detail amplitude and
tint slightly; it is never sampled as surface colour. Radar carries speckle and
layover that would read as noise if drawn — a low-pass and a histogram stretch
are part of the pipeline (§6 step 7).

### 3.2 The canopy height model — free, and rarely available

**DSM − DTM.** Both public domain, both 5 m, perfectly registered: a real
per-pixel forest height across the whole island.

The vegetation layer therefore has **three independent real inputs** before a
line of procedural scatter is written:

    WorldCover  →  what grows here      (class)
    DSM − DTM   →  how tall it is       (height)
    ORI         →  how dense it is      (backscatter)

Old growth in the valleys, stunted stuff on the ridges and the bogs, and a
treeline that was measured rather than invented.

### 3.3 What was rejected, and why

**NAIP** — 60 cm, public domain, and would have been ideal. **Queried for the
Ursoy bbox: 0 products.** Southeast Alaska is outside the programme. Closed;
do not look again.

**Sentinel-2** — CC BY-SA 3.0 IGO. The ShareAlike plausibly reaches a derived
texture, which is a poor trade when public-domain radar sits in the same
pipeline. *Not legal advice; verify if ever revisited.*

**Landsat** — public domain, 30 m. Remains the clean option if a long-distance
macro colour reference is ever wanted. Too coarse for anything near the ground,
which is fine: near the ground is ORI's job and the materials' job.

---

## 4. TERRAIN TYPE

**ESA WorldCover v200, 10 m, CC-BY 4.0.** Bucket lists publicly:

    https://esa-worldcover.s3.amazonaws.com/v200/2021/map/
      ESA_WorldCover_10m_2021_v200_N57W135_Map.tif    (64 MB)  ← confirmed
      ESA_WorldCover_10m_2021_v200_N57W138_Map.tif    (52 MB)  ← confirmed

Tiles are 3° × 3°, named by SW corner. Two cover Ursoy.

Classes Ursoy will use:

    10 tree cover · 20 shrubland · 30 grassland · 60 bare/sparse
    70 snow and ice · 80 permanent water · 90 herbaceous wetland

**Class 90 matters more than it looks: muskeg.** Admiralty's bogs are a real,
distinctive, hard-to-invent feature, and they are the strongest single argument
for observed cover over a synthesised rule — see `ISLAND-ADMIRALTY.md` §4.1 and
why the training-set escape hatch is a fallback rather than a default.

**Cross-check against NLCD Alaska** (30 m, public domain, tuned for Alaska) on
the stage-C slice. Finer is not automatically better when the classifier was
trained elsewhere.

---

## 5. THE FETCH — `tools/island_fetch.js`

Written and committed alongside this document. It is idempotent and resumable
(`curl -C -`), pages the API, and writes into a scratch directory that is **not
in the repository**.

    node tools/island_fetch.js --list       # what it would fetch. Free.
    node tools/island_fetch.js --dtm-only   # ~1.5 GB — enough to SEE the island
    node tools/island_fetch.js              # everything, ~10 GB

**Only `node` is required** — the same one that runs the gates and the server.
An earlier draft shipped this as a `.sh` needing `curl` and `jq`, which is a
Unix assumption on a Windows machine and was simply wrong. Resumable: stop with
Ctrl-C, run it again tomorrow, finished files are skipped.

**Start with `--dtm-only`.** 1.5 GB gets the ground — the whole island, and
everything the baker needs. The other 8.5 GB is the canopy model and the radar
mask, neither of which is needed until trees and surface variation.

`assets/island/raw/` must be in `.gitignore` **before anybody runs it**. The
repository receives only the processed tiers — ~15-25 MB resident, ~650 MB of
streamed tiles (WORLD-V2 §7).

---

## 5b. WHO DOWNLOADS WHAT — the three places

**A player never touches USGS, and never streams anything.** The 10 GB is a
BUILD INPUT on the developer's machine. Three distinct places, and conflating
them is how a project ends up shipping raw radar to a browser.

| | what lives there | size | moves how |
|---|---|---|---|
| **1 · your machine** | the raw USGS/ESA download | **~10 GB** | `tools/island_fetch.js`, once. Gitignored. Never published. |
| **2 · the site** | **one baked asset** | **~40 MB** | committed once per world rebuild |
| **3 · the browser** | that asset | ~40 MB, cached | one HTTP fetch |

### What ships: one file, ~40 MB

`WORLD-V2.md` §4 has the derivation. In summary: an adaptive quadtree of
33 × 33 height patches whose depth follows an error budget — 22 m over ordinary
ground, 5.5 m on complex relief, 2.75 m around sites, 0.69 m on the strips —
which is ~30 MB compressed, plus ~9 MB of 20 m raster overlays (splat weights,
canopy height, ORI mask).

**There is no streaming, no object storage and no CDN**, because at 40 MB there
is nothing to stream. An earlier draft of this section proposed Cloudflare R2
for ~650 MB of 5 m tiles; that number was an artefact of holding the whole
island at a uniform 5 m, and the adaptive structure removes it.

### It fits where the game already lives

The published site is ~87 MB today (`media/` 79, `index.html` 4, `src/` 3,
`vendor/` 1). Adding 40 MB reaches ~130 MB against GitHub Pages' 1 GB soft
limit and 100 GB/month of bandwidth. Comfortable.

*Assumption to confirm:* that `assets/` (409 MB of Poly Haven and Sketchfab
sources), `archiveSingle/` (99 MB) and `assetsSketchfab/` (70 MB) are NOT
tracked by git — the repository root is one level above `flyDiy/`, out of
reach from here. If they are tracked, that is a 595 MB problem worth solving on
its own account, and `archiveSingle/` is the urgent half: 99 MB in one file
that, once committed, stays in the history forever.

### Why the SCRIPT matters more than the download

The 10 GB is reproducible and disposable; a dead disk costs an afternoon, not a
project. That is why `island_fetch.js` is idempotent and lives in the
repository while its output does not.

---

## 6. THE PROCESSING CHAIN

Steps 1-4 are a human with the data. Steps 5-11 are the repeatable tool, and it
must run end to end unattended, because the palette and the thresholds will be
tuned dozens of times.

     1  mosaic the 39 DTM tiles; fix projection and vertical datum
     2  clip to the working domain (~180 × 100 km, island centred, open sea all round)
     3  derive the coastline at h = 0
     4  clean Angoon's harbour works and any cut benches
     5  CANOPY = DSM − DTM, cleaned and clamped
     6  reproject WorldCover and NLCD onto the DTM grid
     7  reproject, de-speckle and histogram-stretch ORI
     8  resample: tier-1 base at 25 m + tier-2 tiles at 5 m native
     9  run the EXISTING bakeHydrology on the result
    10  export the guide fields: slope, flow accumulation, curvature, aspect
    11  strip every toponym; emit the Ursoy manifest

**k = 1.0.** No vertical exaggeration — `ISLAND-ADMIRALTY.md` §4.1.

---

## 7. WHAT IS STILL OPEN

Three of the first draft's five questions are now closed (the DTM prefix, the
ORI cell, NAIP). What remains:

1. **The game frame projection.** Alaska Albers or UTM 8N. Pick one, write it
   down, and never convert again — this project has already paid twice for a
   quantity that lived in two frames.
2. **Does Angoon survive?** (`ISLAND-ADMIRALTY.md` §12.3.) Step 4 needs the
   answer, and it is a game-design decision, not a data one.
3. **Which DSM/ORI cells actually intersect the island**, as opposed to the
   bounding box. `Lower_SE_L2_C364` is certainly one. Resolve by footprint on
   first fetch and pin the list in the script.
