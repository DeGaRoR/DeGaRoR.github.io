# SCENERY LIFE — 2026-09-23

The user: *"determine what kind of 'life' you can add procedurally. People in the streets, driving cars, props and
rubbish disposed next to walls and corners, random rubbish, small structures, communication antennas. All of that
can enrich our sceneries for free. They would need to have proper LODS, and just be discarded at high distances ...
Applying to all generic elements like roads, aprons, maybe lots? Controls in the world editor for that procedural
detail should be available, including turning off, and you will assess the performance impact at every step."*

Module: `src/viewer/scenery_life.js` (`SCENERY_LIFE`), made by the premises renderer (`render_premises.js`), in the
world pack before it. Gate: `GATE LIFE` (`tools/_life_check.js`, core tier, ~1 s). Record: `rec.life` (premises
contract v1.22). Editor: the world editor's **LIFE** section (the last on the rail).

## 1. What stands, and where — the laws

Nothing is authored. The renderer hands over what it has BUILT and the life is stood round it from the record's seed
(`hash(rec.seed, life.seed)` then per house / road / apron by id — deterministic, an edit elsewhere moves nothing).

| category | where | what |
|---|---|---|
| **people** | a door (12 %, a shop 35 %), two or three talking at a frontage (14 %, a shop 30 %), on a zone road's shoulder (every 60-150 m, 50 %), round each parked aeroplane (70 %) | the five scanned people (`person_*`), never the same scan twice in one group |
| **wall clutter** | against a house's back and side walls (the frontage wall 20 % of the time), corners first (55 %); a works or a hangar more; the apron's edges | recipes by the plot's category (`plot.cat`, written by VILLAGE_GEN.finishPlot): a home bins, the two tall propane bottles, tyres (stacked, on the tread), crates, jerrycans, a barrel, cartons; a shop cartons, crates, pallets, a dumpster; a works (a cannery, a yard, a harbour plot that is not a home) drums, pallets, cinder blocks, cement bags, crates, cones; a hangar drums, jerrycans, tyres; a landmark or a sports ground as an institution (no fuel tank, no mailbox) |
| **rubbish** | round every clutter pile (50 %), the yard's odd bit, by the dumpster, the road shoulders (1-2 per 100 m in a zone, 0.3 outside), the apron's edges | can, bottle, crumpled paper, flattened card, plastic bag, the odd tyre |
| **parked cars** | a zone road's shoulder, every 25-60 m on a 45 % chance, parked the way its side's traffic runs, never within 6 m of a frontage (a drive) | the everyday `auto_*` cars, pickups, SUVs, vans |
| **traffic** | every road the record left without `traffic` (0.8 vehicles a km at 1), never a taxiway (w ≥ 13 or `taxi` in its id), a track, or a stub under 150 m | G432's proto traffic, unchanged |
| **small structures** | a mailbox at a residential frontage (70 %); the house's fuel on a gable (55 %: a 500-gallon propane "pig" or a 275-gallon oil tank); a dumpster behind a shop or a works (60 %); road signs at each road end and every ~600 m; cones on the apron | procedural (the kit) |
| **antennas** | a satellite dish on the wall that faces the southern sky (+z), under the eaves and never over an opening (55 % of houses); a TV aerial on the ridge (22 %); a lattice mast with its equipment shelter by each aerodrome (70-160 m from its site) and each settlement (the highest free ground 150-500 m out), 700 m apart, out of the runway's funnel, 25 m off an apron, 40 m from a building; its red light lit at dusk | procedural |

**The building's own report is the map.** `HOUSE_GEN` publishes, per build, `stats.groundAO` (every rectangle and disc
it shaded the ground against: the walls, the deck, every stair flight and landing, the stoops, the woodpile, its
own yard props), `stats.doors`, `stats.openings` (side, s0..s1 along the wall, y0..y1), `eaveY`, `ridgeY`, `pitch`,
`chimney`. The renderer now keeps that report on each house (`HOUSES[].built`) and the life reads it: the largest
rectangle is the walls; walls[i] is the generator's side `[0, 2, 1, 3][i]` and `t` along it is its `s`; nothing is hung
over an opening, nothing stands before a door (2.4 m) or a knee-high opening, nothing inside a blocker; the
frontage wall is the one facing `-plot.n`. An outbuilding is stood the way placeBuilt places it (`plot.out`), as a
shed.

**The ground.** Not in water, not on a slope over 0.45, not on another item (8 m hash of discs), and the world's
pavement law (`world.coverAt(x, z, 1)`, v1.17.1): a yard thing never stands where `kill > 0.97` (the carriageway and
its gravel band - `kill` is the vegetation's fade, still 0.5 four metres past a gravel road, so it is not a
threshold of 0.5); a road's own things (the parked car, the sign, the litter, someone walking) and the apron's own ask
with `paved` and keep off the carriageway by their offset.

## 2. The record — `rec.life` (contract v1.22)

`{ on, dist, seed, people, clutter, rubbish, cars, traffic, small, antennas }`, every key optional; absent = `DEF`
(`on: true`, the multipliers 1, `seed` 1). The editor writes only the keys moved off their default ("back to the
defaults" deletes the block). The composer ignores it; the renderer hands it to the life at every rebuild and the
editor straight to `R.life.set()` - a slider re-stands the life (~40 ms on Jolene) without recomposing the premises.

## 3. The cost — how it is drawn

The frame is CPU-bound on its draw count (PERF 2026-09-23: ~7 µs of three.js per draw at 1080p), so:

* **No Object3D per item.** The items are parallel typed arrays (a world matrix, a kind, a tint), bucketed in 64 m
  cells. (The perf study measured the matrix walk at 12 % of the frame.)
* **Every procedural piece in ONE `BatchedMesh`** per shadow class (two draws): the kit is 27 pieces of
  position + normal + colour, non-indexed, 12-3 200 triangles (the mast), vertex-coloured, the ground contact
  darkened (`ao`); per-instance colour for variety (can colours, mailboxes, dumpsters, cartons, the scans' means).
* **Every scanned level one `InstancedMesh`** per material part (props.js's G515 shape), the scans' own shared
  geometry and materials, per-instance colour for a ±5 % variation.
* **Levels and a last distance for everything**: the scans their own baked cuts (a 350 k-triangle person starts at
  its 24 k cut, `skip0`), a scan with no cuts a procedural box / cylinder in its own mean colour (its base map read
  8 × 8) past 20-40 m, people a procedural figure past 90 m, cars a procedural two-box car past 120 m; nothing past
  its category's cut: rubbish 45 m, clutter 110, people 220, small structures 150-300, dishes 300, cars 450, the
  shelter 900, a mast 6 km — × `dist` × the GRAPHICS tier (potato 0.5, 5 years ago 0.7, current 0.85, gamer 1,
  ultra 1.3).
* **Shadows from the near levels only** (a level whose band starts inside 40 m; people 60 m; masts 400 m).
* **The lists are re-cut** when the eye has moved 3 m, or every 20 frames, over the cells within reach
  (0.1-0.5 ms; the first cut after a stand pays the scans' decode once).
* Masts and parked cars are **obstacles** (`world.obstacles`, OBSTACLES.box): the aeroplane can hit them.

## 4. Measurements (tools/frame_perf.js, msaa tier, RTX 3080, 1080p; `at:x:z:agl` places are new)

Life off → on → off inside ONE run (the probes), because the box is shared by a dozen sessions and absolute frame
times move by 3× over an hour (the club stand read 20.4 ms at 14:50 and 69.6 ms at 15:30 with life OFF). The draw
count is the honest figure.

| run | place | draw calls off → on → off | frame ms off / on / off |
|---|---|---|---|
| life1 (first cut) | club stand | 3 675 → 3 696 → 3 675 | 69.6 / 76.8 / 65.1 (GPU 53 % busy before) |
| life1 | village street, 25 m | 3 109 → 3 171 → 3 107 | 36.3 / 37.4 / 34.4 |
| life1 | village, 250 m | 2 067 → 2 079 → 2 070 | 39.1 / 34.0 / 36.1 |
| life2 (far stand-ins: a figure past 90 m, a car past 120 m; people cast from 60 m) | club stand | 2 507 → 2 525 → 2 508 → 2 524 | 33.9 / 31.8 / 56.3 / 22.6 (GPU 40-94 % busy) |
| life2 | village street, 25 m | 3 103 → 3 125 → 3 104 → 3 125 | 29.2 / 30.3 / 29.1 / 29.3 |
| life2 | village, 250 m | 2 049 → 2 049 → 2 046 → 2 053 | 21.2 / 21.8 / 21.1 / 21.4 |

The first cut cost 62 draws in the street: 29 scan batches (each person level of up to three material parts, each car level)
and their shadow copies. The far stand-ins move every person past 90 m and every car past 120 m into the one batched
draw: 22 draws in the street, none from 250 m. The frame difference is inside the run-to-run noise (≈ 0.5 ms at most,
the street); the life's own JS is the list cut (0.1-0.5 ms when the eye has moved 3 m) and the stand (~40 ms, once, at
boot and after an edit).

On Jolene the defaults stand ~650 items (clutter ~205, rubbish ~240, antennas ~70 incl. 4 masts, small ~80, people
~45, parked cars ~7) in ~40 ms at boot.

## 5. Owed

* **Walking people.** The five people are static scans (on a phone, hands in pockets); nothing in the library walks.
  A walk needs a rigged clip (Mixamo "Walking" through `tools/fbx_to_glb.py` + the animals' clip player, G498) - an
  asset the user has to fetch.
* The traffic's own owed list (G432): junctions, headlights at night.
* The premises bench (`tools/_premises.html`) does not load the life (the game's editor does).
* Per-zone overrides (`zone.rules.life`) if a harbour should be messier than a street.
