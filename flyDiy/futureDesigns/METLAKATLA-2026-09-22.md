# METLAKATLA — the island's one real town, and how a real place gets authored (2026-09-22)

The user: *"YOU know that there is a single town on Anette island, and it's metlakata. It's very small,
we should have traces of it in our own map … It is essential you try and understand well the city
structure."*

Jolene **is** Annette, cut from real IFSAR elevation and real Landsat imagery. Its one settlement
existed in the game only as a patch of `ttype 10 built`: no road, no street, no building, no name.
The village already in `island_jolene.json` is 2.8 km north of the airfield and invented — the user's
ruling was to keep it and put the real town where it really is.

---

## 1. The frame, and why it does the work

| | |
|---|---|
| projection | EPSG:3338 Alaska Albers (`tools/island_prep.py` ISLANDS) |
| origin | E 1 406 524, N 798 714 — the WWII field's centre |
| game x / z | `x = E − originE`, `z = originN − N`; **north is −z** |
| convergence | grid north leans **19.32° east of true** (`src/core/28_island.js` ISLAND_GEO) |
| Metlakatla | x −4300 … −2400, z −9150 … −7650; the built cluster's centroid **(−3369, −8770)** |

**The town's own grid** is two families of parallel streets: the numbered avenues on grid bearing
**43°**, about **46 m** apart, and the named cross streets on **133°**, 46–100 m apart. That is
measured, not assumed — every road-like pixel of a registered view votes on the perpendicular offset
of the line it lies on, and both families show as a comb of peaks.

## 2. The instruments (all new, all reusable for the next real place)

- **`tools/geo.py`** — `lonlat_to_game` / `game_to_lonlat` through rasterio (**pyproj is not installed
  on this machine**), and `hdg_of` for a true compass bearing. Until now nothing in the repo could
  turn a latitude into a game coordinate; every number in `jolene_author.py` was read off a picture.
- **`tools/met_fit.py`** — registers a north-up satellite view onto the frame **by its coastline**.
  The rotation is **pinned** at the convergence, not searched: let free, the fit peaks at 15–16° with
  a very flat maximum (Metlakatla's coast is one long convex arc and hardly constrains an angle) and
  the town lands 30–50 m off at both ends. Pinned, both ends sit on the radar's own returns. Scale and
  offset come from one FFT cross-correlation of the view's water/land split against `dem.coast.u8`.
  Water is **blue minus green** over an Otsu threshold — open sea reads 0.12–0.13 on these views and
  every land cover under 0.04; a darkness rule put shadowed forest in the water and fitted the wrong
  shape. A close view with **no coastline** (the civic core, the harbour, the piers) is fitted with
  `--ref` against an already-registered view, on a high-passed greyscale: same projection, same
  rotation, so only scale and offset are open and the streets themselves correlate.
- **`tools/met_streets.py`** — the grid off a registered view, by the vote described above, each peak
  walked to its ends. A road detector worth the name is a project; a vote is not fooled by roofs.
- **`tools/met_trace.py`** — the drawing board **and the check**: any layer of the island's own
  rasters (`ori` the radar, `albedo`, `ttype`, `coast`, `height`, `ndvi`, `canopy`) cropped in game
  coordinates with a labelled grid, the **record drawn over it**, optionally a registered view warped
  into it, optionally the island's own waterline on top. Every verification picture came from here.

The user's Google views are **not in the repo** (they are Google's); the numbers they produced are, in
`tools/metlakatla_author.py`.

## 3. What is authored

`tools/metlakatla_author.py` holds the town; `tools/jolene_author.py` imports it and splices its
layers in, because **one record per island** is all the runtime composes (`src/viewer/app.js` ~:34,
`20_world.js setPremises`). `rev 5`, the extent the union of the two places.

73 streets · 11 zones · 63 sites · 11 ttype polygons · 40 poles · the `MKSEA` sea lane.
The zone sower cuts **348 plots**; the real town is about 350 houses.

**The waterline is not the beach.** The 10 m grid's coastline sits some 30 m inland of the real one
here, so a street traced at its true position lands in the sea. Rather than invent fill under the
whole waterfront — which would cut a step through the town behind it — a point that is not far enough
inland **walks up the coast field's own gradient** until it is (`pull_inland`); a straight street that
still crosses a cove is trimmed to its longest dry run; what cannot be got ashore is dropped, and the
author says which and why. A pier's root walks the other way, to the waterline.

**A street detector finds floats.** The marina's finger floats and the cannery's dock read exactly
like a bright grey line on a dark ground: five came back as streets and are refused.

**The DEM is clamped at 0 over the sea** — there is no bathymetry in it; the seabed is synthesised by
`28_island.js seaFloor`. So `dem <= −1` is never true anywhere, and everything that looked for water
by height looked for ever. The **coast field** is the test.

## 4. The harbour kit — `tools/_marine_gen.js`

The fifth generator. None of it existed: the wooden `pier_*` props are a fixed piled kit reachable
only as a slot on a house standing in the tide, and `placeSite` turns that off for every hand-placed
item (`27_premises.js` ~:803).

| entry | what it is |
|---|---|
| `marine/trestle pier` (+ `, long`) | a piled walkway on bents, T or L head, handrail, lamps, ladder |
| `marine/float dock` — `landing float`, `seaplane float`, `boat harbour floats` | a **real float**: pontoons at water level, finger floats at a slip pitch, a hinged gangway that leans with the tide, pile **guides** the collar rides |
| `marine/breakwater` (+ `, light`) | a rubble mound: trapezoidal section to its toes, armour stone on the flanks, a light on the head |
| `marine/wharf deck` (+ `, small`) | a planked platform on timber bents — the thing BIG_GEN cannot do (no stance, no water) |
| `marine/net pens` (+ `, large`) | the fish farm: a collar grid, net cones under it, a feed shed on a float, mooring buoys |

Every entry's `ground.need` is `'none'`: it stands in the water on its own piles or floats on it, and
cutting a shelf under a pier would flatten the seabed into a table. All eleven presets build headless.

**The bug that hid the whole harbour.** `render_premises.js placeBuilt` iterates `stats.lit.lights`.
MARINE_GEN published a **number** there; the loop threw inside the renderer's own `try`, and all 26
items silently built nothing — while the record said they were placed and the gate said the record was
clean. GATE PREMISES rule **14m** now builds every placed item and asserts the lamp **list**.

## 5. Contract amendments (§9)

- **v1.19 road `smooth`** — a circular fillet at each interior vertex, applied once in `compose`
  before anything reads `pts`, so the ribbon, the grade, the surface strip, the cover query, the
  traffic and the guardrails see one line and the record keeps the polyline the editor drew.
- **v1.20 the `ttype` layer** — `{ id, poly, code }` stamps a terrain type into the island's own
  `ttype` grid, the one grid the ground's packed texture, the tree fill and the cover ring all read.
  Sea and lake are skipped unless this premises has raised that cell clear of the water (the
  breakwater case); the derived codes 12/13/14 may not be stamped at all.
- **v1.21** — `P.waterY` measured **at the item** (it was one number read at the anchor, inland,
  `−Infinity`: every pier was built at minus infinity), and `P.floorOverWater`, which stands a
  building on a **deck**.

## 6. Terrain type 15 `lush`

The user: *"you will notice some more lush vegetation. We should identify this as new terrain type and
give them the border biome for now … that's where we have to use the border biome exactly."*

Code 15 carries the **`borders`** mix — deciduous shrubs, holly, raspberry, a birch here and there —
which had been **orphaned** since codes 7 and 14 were re-pointed on 2026-09-21; the `lush` texture set
(library index 12) had been unused since the same day. It needed the shader's raster clamp lifted from
11 to 15 and `NCODE` widened to 16, **in both the viewer and the bench**: a byte over the clamp read
as shingle. 42 ha stamped along Walden Point Road and its old clearings.

## 7. What is deferred, and what is owed

Deferred by the user's own choice: the **fuel tank farm** (`big/fuel shed` stands, with a gravel yard;
its comment already said *"the tanks are the theme's props"* and no tank prop exists), the **ferry
linkspan** at the road's far end, and the **quarry**.

Owed:
- a **Tsimshian longhouse**. The Metlakatla Long House has no equivalent in any generator;
  `totem/park`'s clan house (`house/log cabin`) stands in for it.
- Walden Point Road stops at Bayside. The real road runs on to the ferry terminal; the trace past
  Bayside is not done.
- the town's **civic buildings are placed from the registered close views to about ±10 m**; the
  residential fabric is sown, not placed. A pass by the user's eye is the right next step.
- the world editor has **no tool for the `ttype` layer** yet: the record carries it, `normalise`
  keeps it and `findById` finds it, but there is no polygon tool and no inspector row, so a lush
  corridor is authored in the script and not by the mouse. The terrain section is where it belongs.
- **perf**. `tools/met_perf.js` (new) is the town's own benchmark and the airfield is its control
  station, but it does not yet produce a number here: the headless page never lifts its boot
  overlay, and the first run printed 0.4 ms medians with **one draw call and twelve triangles** —
  a number that looks like a result and is not. The tool now refuses a frame under 50 calls and
  says why. What can be said honestly is static: **2.48 M triangles, 1210 ground chunks, 415 built
  things, 1.9 s to compose**. The frame time, and the tuning of the zone densities and the LOD
  ladder that follows from it, are owed.

---

# The second day (2026-09-23) — the town by the user's own hand

Everything below came from the user looking at the town and drawing on the picture. That is the
method this half of the chantier is really about: **`tools/met_axes.py` reads an annotation back**,
so a correction is a measurement rather than a description of one.

## 8. The instrument: reading a drawing

`met_axes.py --colour red|green|blue --shape lines|region|marks|hulls [--pixels]`.

- The picture's own **orange grid** (drawn by `met_trace.py`) gives the calibration — as a fitted
  LATTICE, not as whatever peaks survive a threshold: half the grid is buried under roofs and labels,
  one threshold found four of eight columns, and the mean gap between *those* came out at exactly
  half the real scale. A calibration wrong by a factor of two looks perfectly reasonable.
- The strokes are masked by pen, closed, blob-filtered, **thinned** (Zhang–Suen, twenty lines) and
  read as a **graph**. Three traps, all of them worth the ink:
  - `np.roll(a, -dy, 0)` is the neighbour at `+dy`. With the sign the other way the ring runs
    backwards, Zhang–Suen's c1/c2 test the wrong triples, and **8989 pixels came back as 8989**.
  - A one-pixel 8-connected DIAGONAL has three neighbours at every step — the pixel beside it and the
    two diagonals — so a plain degree test called 1108 staircase pixels junctions and returned 2470
    two-pixel "branches" for nine drawn lines. A diagonal edge whose ends share a 4-neighbour is
    redundant and is dropped; then the graph is the network.
  - A hand-drawn stroke grows a SPUR at every bump on its edge. Shaved (leaf to junction, under 12 px,
    repeated), 11 branches remain.
- A stroke is carried THROUGH a junction it merely crosses, by tangent (`--turn`, 55 deg default): a
  graph gives branches, a person draws roads.
- `--pixels` for a GAME screenshot, which has no grid: 0..1 picture coordinates out, for something
  else to unproject.

**Measured: 8989 red pixels -> 11 branches -> 10 axes over 4089 m, the two picture axes agreeing on
the scale to 0.24 %.**

## 9. The three passes

**Pass 1 — the axes** (*"you have been too approximative in your grid ... I have traced in red some
axis ... that would break your absolute grid pattern"*). The grid came from a vote, and a vote over a
rotated regular grid answers with a rotated regular grid: 73 straight segments on two bearings, every
one defensible and the whole visibly wrong, because Metlakatla's arterials curve round the hill and
cut the blocks at their own angles. The ten drawn axes are authored as arterials (paved, 6.5 m,
`smooth: 26`, traffic); a voted street lying on one for more than 55 % of its length is dropped.

**Pass 2 — three pens on one picture.** GREEN: the seafront road, `mk_r_shore`, 329 m. BLUE (ticks):
seven marks, each within 4.6 m of `mk_sa27` and nothing else — a tick is a PLACE, so the rule is a
place rule, not an id. RED (a closed loop): 17.5 ha of the south-western quarter where the drawn axes
ARE the street plan; 17 voted streets dropped inside it.

**Pass 3 — four blue strokes** (*"highlighted in blue the roads you should delete"*). Each matched one
road at 100 % of the STROKE's own points. **The test runs the other way round from the axes' one and
getting that back to front cost an hour**: a stroke is drawn over PART of a street — it says *this
one*, not *all of this* — so the share that matters is the stroke's on the street. Tested the wrong
way the three marked roads scored 0.31–0.54 and none was dropped. A traced road is TRIMMED rather
than dropped (the Skaters Lake stroke covers the straight head the hill axis replaces; the road runs
on east past the lake where nothing was drawn over it).

## 10. What the roads do to each other — `tools/met_cross.js`

A record's roads are authored one at a time and nothing had ever looked at what they do to EACH OTHER.
Four faults, all visible from the air before any of them is visible in a diff: **doubles** (two roads
side by side — the same street traced twice), **slivers** (a crossing under 28 deg, where the two
ribbons overlap for tens of metres and the paint, the band and the guardrails fight inside the lens),
**near misses** (an end 1–12 m short of another road: a junction the network does not have — the
traffic will not turn there, the pole line stops, the sower reads two unconnected frontages), and
**stubs**.

| | before | after |
|---|---|---|
| doubles | 3 | 1 (a legitimate Y in the invented village) |
| near misses | 26 | **0** |
| slivers | 2 | 2 (both voted streets meeting Walden Point Road at 24 deg) |

Fixed by two passes in the author, in the order **snap -> drop -> snap**: two streets 10 m apart score
as a 19 % double and survive, and snapping their ends onto each other makes the same pair a 52 % one,
which is the honest reading — they were always the same street.

## 11. The fabric

- **528 plots** (was 344). 31 of 73 streets had their middle outside every zone and 21 cut no plot at
  all — bare tarmac with nothing along it. Fixed by a CATCH-ALL zone sown LAST: `sowPlots` rejects a
  plot overlapping one already sown and the zones are walked in ARRAY ORDER, so the named quarters
  claim their own and the envelope fills the rest. **The catch-all silently sowed nothing at first**
  because `pull_inland` broke the hull's winding — three corners came back two metres apart and out
  of order, a polygon that crosses itself, and `compose` drops such a zone where it stands. It is
  hulled again after the walk.
- **744 garden trees** (was 0) — contract v1.22.
- **The ball field takes its block.** Streets are 46 m apart and the smallest honest baseball park is
  91 x 76 m even with the outfield cut from 80 m to 56, so NO position within 120 m clears the grid.
  Any street entering the field's box is cut at its fence; a street the box would cut in two keeps its
  longer half.
- **Seventeen civic buildings stood in the carriageway** and now none does (`tools/met_nudge.js`,
  which uses the composer's own test on the COMPOSED roads — a corner test of my own missed the half
  of it where a road runs THROUGH a foot without either corner being near its centreline). Three
  oscillated between two streets of a corner block, so the direction is chosen by SEARCH; one had no
  clear offset at all, which is the tool saying the POSITION is wrong, not the nudge.

## 12. Terrain type 16 `residential`

*"fill the empty patches and in-between land with a new biome, small and medium conifers from the
forest pack, high density, occasional bushes. We'll call this residential vegetation."*

NOT a premises `forest` zone, and the reason is a number: at that density the gaps inside Metlakatla
are ~39 ha, which `planForest` would put some twenty thousand INDIVIDUAL trees into the record — and
`render_premises` builds one `THREE.LOD` per record tree. The island's own fill draws that density
instanced and chunked for nothing, and it is driven by the TERRAIN TYPE. So the new thing is a
**biome** (`residential` in `_trees_tuning.json`: count 5200, under 4, holes 0.35, canopyFloor 6.5)
and the premises' job is only to say WHERE — the town's own zone polygons with `clear: true`.
**38.75 ha stamped**, and the scribble is the confirmation rather than the definition: what the green
marks point at is a rule that holds everywhere in the town, which no hand-traced polygon could follow
round three hundred and fifty plots.

## 13. The lawn's grade, measured

*"the plot grass luminosity/tint ... pale bright green against dark intense green around. There should
be a difference, but not that big."* A four-step ladder from one boot (`LOT_GROUND.grade()`), the
lawn's own pixels found as the ones the grade moves and the island's wood as the green it cannot:

| sat / value / warm | lawn luma | lawn sat | x the wood |
|---|---|---|---|
| 0.70 / 0.93 / 0.50 (was) | 0.199 | 0.34 | 2.08x |
| 0.80 / 0.80 / 0.35 | 0.172 | 0.38 | 1.79x |
| 0.88 / 0.72 / 0.25 | 0.159 | 0.41 | 1.66x |
| **0.95 / 0.64 / 0.15 (now)** | **0.146** | **0.44** | **1.52x** |

The wood sits at luma 0.096, sat 0.37. At the old grade a lawn was twice the wood's brightness and
two thirds its saturation — bright and washed out, exactly "pale bright green". At the new one it is
half again as bright and a shade MORE saturated, which is what mown grass is beside a conifer stand.

## 14. The clipping, and why it was everywhere

The user: *"terrain clips through roads all the time, and that's unacceptable"*, and then *"but also
plot textures clipping"*. **They are one bug.** The inner ring is a fixed 9 km square about the
ORIGIN and it is the only ground tier that has ever heard of a premises — `world.terrainH` for its
vertices, `groundSink` to drop it 4 m under the premises' own 2 m patch. Everything past 4.5 km is
the baked quadtree at its raw DEM height, no modifier, no sink. Metlakatla is **9.4 km** out. So the
town's road cuts were carved into a ground nothing drew, and the un-cut mesh stood through every
ribbon and every lot patch alike. `sinkFar` applies the ring's own rule to the far tier after the
patch stands: **30 369 vertices at Metlakatla**. Any premises more than 4.5 km from the origin
depended on this and nobody had ever put one there.

## 15. Where it stands, honestly

**Verified:** the record composes with **zero issues**; GATE PREMISES green at 338 checks (the new
rules are 14n lot-refusal, 14o the `from` filter and the overlapping undo, 14p the garden trees,
14q the far sink); GATE SPLAT and GATE TREES green with `NCODE` 17; the lawn grade measured and set;
`sinkFar` confirmed live in the game (the page logs its vertex count); code 16 confirmed live
(`TREE_FILL.at` answers `residential` over the gaps, on FOREST_FLOOR and GRASS ground).

**NOT verified, and the user asked for the box back before it could be:**
- the full gate battery has not been run since the second day's changes;
- the clipping fix has not been looked at in a picture from low over a graded road — the vertex count
  says it moved, the eye has not said it is gone;
- the residential vegetation has been probed, not judged: `TREE_FILL` was still building (1164 chunks
  queued, 53 752 trees) when the last shot was taken;
- **perf is still owed** and is now a bigger question than it was: 528 plots, 744 garden trees, 39 ha
  of new dense biome and a far-terrain sink over a 7 x 12 km extent.

## 16. Owed, in the order I would do it

1. **Run the full gate battery** and fix what the second day broke, if anything.
2. **Look at a graded road from low** — Walden Point Road at (-1508, -8305) is the worst cut measured
   (-8.09 m) and is the one to photograph.
3. **Perf.** `tools/met_perf.js` still cannot lift the boot overlay; `tools/island_shot.js` can, and
   its rig is the one to steal for it.
4. The two SLIVER crossings, if they look as bad as they measure.
5. Everything from the first day's list: Walden Point Road past Bayside to the ferry, the Tsimshian
   longhouse, the `ttype` editor tool, the civic buildings by the user's eye.

## 17. The rebase, and what must survive it

Five sessions are authoring into `island_jolene.json`. The agreed protocol (proposed by the roads
session, accepted here) is `tools/jolene_parts/<name>.py`, one per session, each exporting `PART`;
`jolene_author.py` imports them in a fixed order and extends the layers. Prefixes: `mk_` the town
(mine, already asserted in GATE PREMISES §14), `af_` the airfield, `nv_` native area, `mn_` mining
village, `tw_` tramway. **The fixture is regenerated, never hand-merged** — on a conflict take either
side and re-run the author. `rev` must go up or `localStorage` shadows the new record.

Two things in that record are order-sensitive and must not be "tidied":
- **Zones are sown in ARRAY ORDER** and `sowPlots` refuses to overlap a plot already sown. The named
  quarters claim their frontages and the catch-all `mk_z_town` fills the rest. Re-sorting the zones
  layer within a part silently re-cuts the whole town.
- The drawn axes have precedence over traced roads over voted streets (`rank()` in the author).

**A known conflict, named so nobody resolves it as a choice.** In `render_premises.js`'s `rebuild()`,
the GAME branch's early-return block now carries two independent additions after `syncHouses()`:

    syncHouses();
    if (LIFE) { LIFE.set(rec.life); LIFE.dirty(); stats.life = 1; }   // G519, the scenery-life session
    buildTrees();                                                     // G511.1, this session

Either order works; **both must survive.** Without the second, no premises record tree is drawn at
all — which is the bug this session found and is invisible from the diff.

Also landing on master while this branch was out, and relevant here:
- **G508.1** validates a road's `pav`, `band` and `look` — checks that had never run on a road since
  the v1.16 port. Metlakatla's 61 roads pass (`look` is `worn` or absent, `pav` is `{marks:'none'}`).
- **The native-area session is porting `sinkFar` to master** with two improvements: it sinks to
  `min(raw, terrainH) - d` so a cut deeper than 4 m cannot poke through, and it lives in
  `patchOf` + `FARLOD.resink(bb)` because master's far terrain is now a view-dependent LOD that would
  undo a one-off vertex walk. **Take theirs over mine on the rebase.**
- They also found that a record reaching past ±4440 m switches the WHOLE patch to the far terrain's
  material, and on master that material plus `injectMaterials` is 17 texture units against a limit of
  16 — the program fails to link and every patch chunk draws black. Their fix picks the material per
  64 m chunk; past the ring a `set` material polygon will not draw. **Metlakatla uses no `set`
  materials** (all five of its material entries are `look`), so this does not bite here — but it is
  the reason not to add one.
- **G519 scenery life** stands people, clutter, rubbish, parked cars, mailboxes, dishes and a mast
  round every premises road and house. Measured by that session: draws are bounded by the number of
  KINDS near the eye, not by plots (+18 to +22 in a street, ~0 from 250 m), and the one-time stand is
  ~0.4 ms a house, so ~200 ms at Metlakatla's 510 plots. **It is left ON at the default here.**
