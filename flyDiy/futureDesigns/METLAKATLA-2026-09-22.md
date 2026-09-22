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
