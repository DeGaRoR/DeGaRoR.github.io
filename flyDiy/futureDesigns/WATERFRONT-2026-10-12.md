# WATERFRONT — breakwaters, docks and piers drawn in the scenery editor (G3030-G3039)

2026-10-12. The user (00:15): *"I need a tool to do waterfront and docks for real. Something that generates a mesh
with blocks in the sea and everything... in the editor, more flexible, and higher quality."* References: the user's
aerials of **Walden Point** (a rubble jetty off reclaimed fill with a grassy crest track, riprap fill edges, a
pile trestle to a T-head, a floating dock with finger slips, a log boom) and **Metlakatla Boat Harbor** (two rubble
breakwaters, an L and a dogleg with round heads; four main floats with fingers and boats; gangways; a riprap shore;
the paved lot).

Prototype: `tools/_waterfront_gen.js` (the generator, headless) + GATE WATERFRONT `tools/_waterfront_check.js`
(30 rows, ~1 s, core tier). Branch `claude/waterfront-g3030`. Nothing is wired into the game yet.

## 1. What exists, and why it isn't enough

- **MARINE_GEN** (`tools/_marine_gen.js`, Metlakatla 2026-09-22): trestle pier, float dock, breakwater, wharf deck
  and net pens, each a **site item**: one rectangle in a house frame. Metlakatla's moles are 15 straight items, one
  per segment, over a terrain flatten, a ROCK surface and a rock ttype, all authored separately by
  `metlakatla_author.py`. The "armour" is `round(L*1.4)` axis-aligned boxes (about one per 8 m² of face) in one flat
  grey bag. `boats` is declared and never read. Items have no LOD 1 and stay out of the far-town merge.
- **Kept and reused**: the frame conventions (y up, sea at `waterY`, `bed(x, z)` the seabed), pile-to-seabed, the
  float's freeboard and pile guides, the gangway hinged at the shore, the weed band (`applyFinish`: `uDirtTop =
  waterY + tide`), the beacon light format; the areas-v2 inspector, the road line tools and handles; the dock marks;
  the cover ring's BatchedMesh idiom; the obstacle raster; the GR terrain raster; the premises cook.
- **The world**: sea level 0, **no tide** (the tide is a visual band only), and no bathymetry finer than the island's
  shelf (-5 m at the waterline to -14 m 500 m out). The coast field is ~30 m a texel, too coarse for the water
  shader to "see" a 16 m mound, so the mound needs its own contact.

## 2. The feature model

One new layer, **`layers.waterfront`**, of LINES (the road's tools work on them unchanged), plus one AREA property.

| kind | the line is | key fields (`P`) |
|---|---|---|
| `breakwater` | the crest's axis, root first | `crest` width, `crestH` over the water, `slopeL`/`slopeR` (h:1), `block` (median stone, m), `blockVar`, `band` (laid down to this depth), `head` round/butt, `track` width + `trackLook` gravel/grass, `light` |
| `revetment` (riprap shore / seawall) | the top edge, water on one side | `crestH`, `slope`, `block`, `wall` 0/1 (a vertical bulkhead instead of rock), `side` (auto from the water) |
| `pier` (trestle) | the deck's axis, shore first | `w`, `deck` over the water, `bay`, `pileR`, `pilesPerBent`, `batter`, `head` none/T/L + `headL`/`headW`, `rail`, `lamps`, `ladder`, `fenders`, `bollards` |
| `float` (floating dock) | the main float, gangway end first | `w`, `freeboard`, `fingers` both/alt/left/right, `pitch`, `fingerL`, `fingerW`, `gangway` + `gangW` + `abut`, `guideSpc`, `boats` (share of slips filled) |
| `boom` (log boom) | the anchors | `logD`, `logL`, `sag`, `chain` |

Record: `{ id: 'f<n>', kind, name?, pts: [[x, z], ...], P: {...}, seed? }`. A **fill / reclaimed pad** is an area
with a new `fill` property — `{ deck, edge: 'riprap' | 'wall' | 'none', block, slope }` — which raises the area to
`deck` and lays a revetment along every edge whose outside is water (the dock marks' `waterEdges` already measures
it). With `draw` concrete and `marks: dock`, that is Metlakatla's paved lot with its quay line.

**Contract v1.42** (fixed with SCENERY-ED-2 on 12 Oct: v1.37 ROAD-GRAPH, v1.38 PLACER-FAST, v1.39 SCENERY-SHIP,
v1.40 RUNWAY-ED, v1.41 BIOME-PAINT, each kept reserved even if unused). **No record bump** (PREMISES_V stays 2):
`waterfront` goes into LAYERS and DEF, so `normalise` gives a missing layer `[]`, as ROAD-GRAPH's `junctions` did.
LAYERS also drives findById, newId and issues. Ids are **`f<n>`**, because `w` is the runways' prefix. Every
existing record composes bit-equal (a GATE PREMISES identity row).
Rebase after SCENERY-SHIP lands, with these hunks:
- `'fill'` goes after `'roadside'` in AREA_PROPS.
- `'waterfront'` goes into the editor's `groundLayer`.
- `dirty()`'s fourth argument is null for the new lines.
- `tools/scenery_ship.js`'s layer list gains `'waterfront'`, or the user's next ship drops the breakwaters.
- Paved footprints enter `roadBuildKeys` correctly.
**`marine/*` site items keep composing as they are**, including the user's own trestle sites in their live save.

## 3. The mesh

**The mound is ONE height field**, so the mesh, the stones and the wheels agree:
`M = crest - max(0, d - hw) / slope(side)`, `H = max(bed, M)`, where `d` is the distance to the line. That distance
gives the **round head** and the round outside of every bend for free; `butt` squares the head off.

- **Core**: stations every 2 m with a mitred section (crest + 7 flank samples to the toe found on the real bed) and a
  half fan of rays at each end. Dark mottled vertex colour, darker under water. It is the far LOD's whole look and
  shows in the gaps between stones (the underlayer).
- **Armour = individual stones**: blue-noise placement on the core's own triangles above `band` (dart throwing,
  biggest first), three relaxation rounds, then **chinking** stones (0.45-0.7 of the median) in the gaps. Each stone
  is tabular (its long axes lie in the slope), seated about 55 % of its half-height into the surface, turned and
  tilted at random, and greyed ±10 % with a little warm or cool. There are 6 fractured quarry-stone prototypes at
  **three rungs of the same stone**: 48 triangles (≤ 40 m), 20 (an icosahedron, ≤ 120 m), 12 (≤ 450 m). Past
  450 m, the core's mottle carries the look.
- **Drawn as one BatchedMesh per material** (the cover ring's idiom): per instance, chosen when the camera moves —
  the rung, frustum culling, and a **back-flank cull** (a stone whose surface normal faces away from the eye sits on
  the far face of a convex mound and is hidden by it). **Shadows** come from the core plus the stones of rung 0
  only; a stone past 40 m is under one texel of the sun map. (Batched meshes are never near-shadow casters, as for
  the cover ring's rocks.)
- **Wet line / algae**: the stones' and piles' material darkens and greens from the water up through a visual tide
  band. This is MARINE_GEN's weed band applied in world y, with its own program cache key (the trap of three.js
  reusing cached programs with stale uniforms).
- **Contact with the water**: a thin waterline ribbon along the mound's y = 0 contour (known analytically: the
  width at the waterline is `hw + crestH × slope`), broken by noise between the stones and animated. **Off by
  default, behind a pill**, because the user called the shore lap "white bands" (G798); they decide from a still.
- **Floats**: pontoon modules along the line, square joints at bends, fingers at the pitch, cleats, pile guides,
  a gangway down to the float from where the ground stands `abut` over the water. **Boats** are procedural low-poly
  hulls (troller, seiner, cruiser, skiff × 4 hull colours, about 90 triangles; rung 1 is a block). The repo's CC-BY
  boats are 30-370k triangles each. A boat moors alongside a finger with 0.35 m for fenders, bow to the main float.
- **Piers**: MARINE_GEN's trestle pieces (`bent`, `planking`, `railRun`, ladder, lamps) walked along the line with
  mitred bents at bends; a T/L head at the end. At integration all the timber moves onto HOUSE_KIT's bags, so the
  finish and weathering stay MARINE_GEN's.

**Ground and collision**:
- Breakwaters, revetments and fill reach the **GR terrain raster as an abs `grade` line**, built the way ROAD-BED
  is (SCENERY-ED-2's ruling, 12 Oct). A `max(h, M)` modifier is NOT affine in the height under it, and the raster
  bakes `A h + B` (G614): it would flatten everything to the crest.
  - At compose, sample the line every 6 m and set each floor to `max(T1r(p), crest)`.
  - Emit `makeModifier({ kind: 'grade', pts, width: crest, falloff, abs: true })`, with
    `falloff = (crest - seabed) / slope`. Split the line where that varies.
  - The crest is exact. The banks fall along the grade's falloff curve rather than exactly at 1:slope, so the
    target is sunk ~0.3 m under the drawn law, and a G3032 row holds **the terrain under the core law everywhere
    and within 0.6 m of it on the flanks**. That way no ground pokes through the stones and wheels on the crest
    track meet it exactly.
  - Wheels, floats and walkers meet that ground; the stones stand 0.3-0.5 m proud of the law as visual roughness.
- Decks (floats, piers, gangway ramps) go to OBSTACLES as **analytic rectangles from the generator's `decks`
  list**, not rasterised triangles. This avoids the 0.15 m flat-bag trap and is cheaper. The same list is the
  CHARACTERS walkers' surfaces.
- Boats are obstacle boxes, so a taxiing seaplane hits them.
- **Boats in the slips are part of the float feature** (batched instances), not `objects[]`. They follow
  BIOME-PAINT's waterline convention for placed objects: draft below the surface (`waterline`, here the hull
  prototype's own draft) and a gentle bob in flight. The bob goes in the boat material's vertex shader, with a phase
  from the instance's position, so no matrix is re-uploaded.
- A hand-placed boat (`objects[]` with `on: 'water'`) stays SCENERY-ED-2's, built by `PG.objectRecord`.
- One difference on purpose: slip boats DO take an obstacle hit, because a seaplane taxiing through a marina must
  not pass through the boats.
- The footprint (toe polygon) excludes plots and trees and stamps the rock surface and ttype: the four layers
  Metlakatla authors by hand today come from one entry.

## 4. Metlakatla's migration (G3038: `tools/waterfront_patch.py`)

The patch edits the fixture **by id** and does not re-run the author. Since SCENERY-SHIP, `island_jolene.json`
carries the user's own edits (rev25), and a re-author would undo them. It follows ROAD-GRAPH's `road_patch.py`:
- indent-1 JSON dumped exactly as it was read;
- a record that doesn't round-trip that way is refused untouched;
- `--dry` reports and writes nothing.

What it does:
- **Drops** each mole's four hand-authored layers (terrain `mk_bw_*`, surface `mk_y_bw_*`, ttype `mk_tt_bw_*`,
  armour items `mk_ma_*`) and the three harbour floats (`mk_mf_harb_a`, `mk_mf_harb_b`, `mk_mf_small`).
- **Adds** the moles as breakwater lines and the floats as float lines:
  - Crest corrected to the photo's ~8 m on the two harbour moles (the user's YES; 7 m on the small two; the author
    had 16.8 / 14.8 / 12.8 m).
  - The outer hook runs root first, with its light on its head.
  - The floats keep their axis, pitch and fingers (`'alt'`, as MARINE_GEN laid them), now with boats in 3/4 of the
    slips.
- **Leaves alone** the trestles, the seaplane float, the wharves and the net pens (MARINE_GEN sites).

Afterwards: the re-cook (`premises_cook --island jolene`) in a CPU window, then the plots hash (GATE PREMISES 21d).
A mole's footprint is wider than the old flatten polygon, so any plot it refuses is reported before the cook is
accepted. Re-laying the basin as in the photo (four main floats about 45 m apart) is the user's to draw with the
tool, not this patch's.

## 5. Budget per harbour, and the prototype's numbers

The caps (Metlakatla's whole basin = both moles + four main floats, from any viewpoint, on the preset at a stable
30): **≤ 150k triangles drawn, ≤ 100k casting, ≤ 12 draws, ≤ 8 MB on the GPU, built off the main thread**. These
are unproven until the GPU slot times them.

| GATE WATERFRONT (node, 12 Oct) | value |
|---|---|
| A — Metlakatla outer mole, 279 m, crest 8 m × 4 m, 1.8 m stones | 2 949 stones (455 chinking) = 1 058 / 100 m; core 2.0k tris / 100 m; 136 ms |
| B — Walden jetty, 160 m, crest 12 m, 6 m grass track, 1.4 m stones | 2 519 stones; 112 ms |
| armour coverage of the band, every metre of height | A 90 % (89-93 %), B 90 % (89-93 %); none floating (seat 0.45-0.63) |
| head / toe / crest | round to 0 cm on 7 rays; toe on the bed to 0 cm; crest flat to 0 mm |
| C — Metlakatla main float, 110 m | 24 fingers, 22 slips, 15 boats (68 %, dial 75 %), all clear by 0.25 m; gangway 1:5.6; 3.4k tris; 4 ms |
| basin from the lot by the harbour master | 81k tris, 26k casting |
| basin from the crest of the outer mole | 127k tris, 55k casting (the worst view) |
| basin from a seaplane taxiing in the basin | 109k tris, 47k casting |
| basin on the approach, 600 m out, 150 m up | 23k tris (stones past their rings: the core) |
| basin draws / memory / build | 26 built → 6 merged by material; 2.4 MB; 268 ms on one node core |

## 6. Order of work (G3032-G3039) — after the user's OK

1. **G3032 compose**: layer (contract v1.42, no record bump), the abs grade line (ROAD-BED's way), surface/ttype/exclude from the footprint;
   GATE PREMISES identity rows.
2. **G3033 render**: BatchedMesh stones (rungs + back-flank cull in a per-camera pass), core/track merged, the
   wet/algae material; in the house worker.
3. **G3034** piers + floats on lines (MARINE_GEN pieces, HOUSE_KIT bags).
4. **G3035** revetment, `fill` area property, boom.
5. **G3036 editor**: a Waterfront section (line tools, inspector rows, presets "Metlakatla mole", "Walden jetty",
   "harbour float", "seaplane float", "trestle + T"); a slider rebuilds only that feature, and a drag shows the
   core only. Done with SCENERY-ED-2 on `premises_ui.js`, `render_premises.js` and `27_premises.js`.
6. **G3037 collision**: decks to OBSTACLES, boats, walkers.
7. **G3038** Metlakatla's migration + re-cook.
8. **G3039 GPU proof**: a TIMED ABBA in an A0 window at Metlakatla, basin on/off, 3 views, light pass. Stills only if
   the user asks. Strict gates are unaffected while the layer is empty, which it is everywhere until G3038.

## 7. Questions for the user

1. Metlakatla's moles: correct them to the photo's ~8 m crest (today 16.8 m)?
2. Contact foam at the waterline: try it as an off-by-default pill, given the "white bands" ruling?
3. Boats: procedural low-poly (no licence, light) only, or the CC-BY boats decimated for the nearest rung?
4. No tide in the world: the wet/algae band is visual only (as MARINE_GEN's). OK?
