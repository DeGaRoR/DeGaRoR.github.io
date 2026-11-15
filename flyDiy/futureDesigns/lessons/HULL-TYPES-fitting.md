# HULL-TYPES: fitting a plane to its references (the Super Petrel LS), lessons learnt

Session: HULL-TYPES (cloud), branch `claude/hull-types`, 5-7 Nov 2026, entries HULL-B36 to HULL-B80 in `flyDiy/HANDOVER.md`. The Super Petrel match was this session's work. The handover for the code is `flyDiy/reports/HANDOVER-HULL-2026-11-07.md` on `claude/hull-types`.

## 1. The projection tool: `flyDiy/tools/outline.js`

Added in commit bbb6bb71 (HULL-B36), used at every step from HULL-B37 on.

```
node tools/outline.js build.json [--out=file.png] [--target=target.json] [--ppm=110]
```

**Input: a build.** A saved `{spec}` file or a bare spec. The Petrel's builds come from the card table:

```
node tools/hull_matrix.js --one=classic:superPetrel --fitonly=1 --nofit=1 --save=x.json
```

- `--nofit=1` is essential. It draws the card's own rows. Without it the hull fit re-solves the step and the floats, and moves what you are matching.
- `--fitonly=1` skips the flight.

**What it does.**

- It loads the build through the page's own load path, as `quick_view.js` does: `_load_build.js --child` with `FLYDIY_JOIN_PROBE=_quick_view_probe.js`. The result is every visible mesh of the editor's scene, in world metres.
- It projects the triangles ORTHOGRAPHICALLY into three filled silhouettes:
  - side: z forward to the right, y up;
  - top: z, x;
  - front: x, y.
- Each view is drawn on a 0.5 m grid with its extents printed.

**Input: a target (optional).** `target.json` holds polylines in metres, in each view's own axes, plus `dims`. The Petrel's is `tools/ref_match/refs/super_petrel/target.json`.

- `"zFrom": "bow" | (default) tail`, `"yFrom": "keel"`.
- The target is drawn in red over the silhouette.

**Output.** A PNG with the three views, and JSON on stdout: the overall measured dimensions, plus each view's silhouette extents.

**Why it worked.**

- **It measures what the game draws.** Same load path, same meshes. Hand-computed dimensions from rows had lied before: cage units, offsets, frame rows that are absolute heights.
- **It is orthographic, at a fixed scale, on a fixed grid.** A blueprint is orthographic, so the comparison is like for like. No perspective camera is guessed.
- **It is silhouette-filled.** Overall length, span, height and the step's station read off directly. A two-pixel misfit is visible.
- **It is stateless and quick** (seconds): render, read, change one row, render again.

**Other tools in the loop.**

- `tools/quick_view.js build.json --out=x.html`, then a headless screenshot at a fixed camera. Used for the visual and rib checks at 3/4, side, front and top. Caveat: it does NOT pose retract gear or cut wells (see 3).
- `tools/quickshot.js build.json out --views side,q,qb,front --gear g [--over '{"row":v}'] [--crop z0,z1,y0,y1] [--fit]`. Used for everything gear-related. `--over` tries a row without saving; `--fit` (added in HULL-B55) prints the gear fit's red rows (`CAGE_ROW_BAD`) and the knee's / L's solved geometry.
- Scratch probes, recommended as tools (see 5):
  - **The hull's stations in the cage frame:** keel / chine / gunwale y and beam per station, the step's z. Via `G.cageFromSpec(spec)` → `G.cageHullTable(G.cageHullLines(P), FS)`.
  - **The stability sheet:** static margin, CG and neutral point in % MAC, the water CG vs the centre of buoyancy. Via `C.genShakedown(def)` plus a bisection on `HYDRO.secAreaTo`.

## 2. The workflow, as it finally worked

1. **Gather and settle the references first.**
   - The user's three-view and side drawing, eyeballed into `target.json` (polylines, metres).
   - The type's numbers into a study file: `futureDesigns/SUPER-PETREL-2026-11.md`, with length, spans, areas, masses and the stall. Mark each number's source and doubt.
2. **Start from the nearest existing card,** not from defaults. The Petrel started on the Cessna boat's cabin plus the Icon's pod-and-rod (`hull_matrix` ENGINES `superPetrel`, "keep the hull/fuselage architecture of the cessna"). One card in `hull_matrix.js` holds every row. Variants are cards built with `Object.assign` on it (`superPetrelV2`, `superPetrelV4`).
3. **Global dimensions before detail.** Run `outline.js` against the target and fix in this order:
   1. overall length;
   2. spans;
   3. wing heights and stations;
   4. stagger and dihedral;
   5. fin box;
   6. the hull's keel line.

   One row per iteration. Re-render each time.
4. **Shapes from photographs.** Read each one head-on or side-on and convert it into the card's rows, never into new geometry:
   - The bottom's V, measured off the front photograph (HULL-B47): `hullBeta`, `hullBetaBow`, `hullBetaA`, `hullFlute`, `hullFluteAt`, `hullSkirt`.
   - Then cut sections from the drawn hull and check the keel's depth under the skirt against the photo (0.2-0.27 of the half-beam).
5. **Write missing controls as rows** (a "garage gap"), and only then use them on the card. Every value lands on a garage row: `hullStepZ`, the hull's flute / strake / skirt / rocker rows, `engPylonFwd`, `bpCabPylon`, the Upturned tip kind. Never put a hand constant in a card.
6. **Fly after every structural change.** The match is judged by the physics as much as by the outline.
   - Water: `hull_matrix --nofit=1` (settle, hump, airborne).
   - Land and the reference comparison: `perf_study.js --build=x --vs=petrel [--fly]`.
   - Stability: the stability sheet.
   - Several "good-looking" changes failed here: an engine moved aft grounded the take-off; a nose leg shortened put the tail on the runway.
7. **Version the milestones as builds** next to each other (`builds/candidates/superpetrel_V0..V4_1.json`) so the user can compare. Keep the last flying build (V0) before a risky feature.

## 3. Where I struggled, and why

- **Eyeballed targets.** The target's polylines were eyeballed from images that were never committed. Every later correction was the user's eye against a photograph, not a measured overlay. Cause: no tool to digitise an image into target polylines.
- **Axes, units and frames.**
  - Cage rows are in cage units: metres / planeScale (0.745).
  - Wing rows are metres. Frame rows (`frPostBotY` ...) are ABSOLUTE heights, not offsets.
  - Cage z is forward-positive; the flight frame's x is aft-positive.
  - Each cost at least one wrong iteration.
- **Relative rows that move with something else.**
  - `engPylonH` is measured from the deck under the pylon. Moving the engine aft over a falling deck sank the engine 16 cm, and the user caught it ("keep the engine at the same height relative to the top wing").
  - Rule: when moving a part, re-read its absolute position from the spec (`spec.engines[0].y`) and compensate.
- **Shortcuts that looked fine in one number.**
  - The nose leg was shortened (`s2Drop -0.04`) to level the stance. The stance number was right, but the wheel jammed into its doors and well, and a fit red ("14 mm out of the body") went unread.
  - Rule: after every row change, read ALL the fit's reds and look at the part close up, not just the number you were fixing.
- **Renderer blind spots.** `quick_view.js` neither poses the retract mechanism nor cuts wells. It drew a raw bar under the hull, and the user saw it as a mess. quickshot draws no frame lines. Pick the renderer by what you must check.
- **Wrong facts stated confidently.** I claimed the real Petrel had a trailing-edge cut-out; it does not. The cabin was too tall twice. Read the reference before asserting.
- **Editing cards with sed.** The same strings exist in other cards (`engPylonH: 0.55` in the `icon` card got changed). Scope every card edit to the card's own text (python: index of the card key to its `note:`).
- **Brochure numbers are not one condition.** The Petrel's stall and climb are solo figures. Measured at gross they looked 11-24 % off; at solo / half fuel they matched (HULL-B76). Measure at both bounds before calling a deficit.

## 4. What a new session must know on minute one

- Read `tools/REF_MATCH.md` (CLAUDE.md points to it) and this file.
- Render with `outline.js --target` BEFORE changing anything, to get the starting error.
- Build with `hull_matrix ... --fitonly=1 --nofit=1 --save=`. Never let a fitter move what you are matching.
- One row per iteration, re-render, keep a before/after pair.
- Units: cage rows ÷ 0.745 → metres; wing rows in metres; frame rows absolute; cage z forward; flight x aft.
- Every value goes on a garage row. A missing control is built as a row first.
- Fly it (water and land) after each structural milestone; read the fit's reds after each gear change.
- Save each milestone as `builds/candidates/<plane>_Vn.json`.

## 5. Missing tooling

1. **An image digitiser.** A reference image plus two scale marks and a view, giving `target.json` polylines (click or edge-trace). It removes the eyeballing, and the reference images should then live in `ref_match/refs/<plane>/`.
2. **Photo overlays.** A perspective overlay of the build on a photograph: camera solved from 4-6 marked points. Most user references were photographs, not blueprints.
3. **Card overrides on the command line.** `hull_matrix.js --over '{"row":v}'`, as quickshot has. I copied the card file with sed for every variant.
4. **The probes as tools.**
   - `tools/hull_stations.js`: the hull table in cage metres.
   - `tools/stab_sheet.js`: static margin, CG / NP % MAC, water CG vs centre of buoyancy, the step aft of CG.
5. **outline.js reporting a dims diff** against `target.dims` (per key: ours / target / %), and a section view at a given station.
6. **quick_view posing the gear** (`--gear g`) and cutting wells, so one renderer serves for both the look and the gear.
