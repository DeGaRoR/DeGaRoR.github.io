# PERF-WORLDBUILD - handover (23 Nov 2026)

Branch `claude/perf-worldbuild-next`; landed ref `claude/ready/perf-worldbuild-2` = 43f58e871 (off `claude/perf-codex`
4421e5416, on `claude/ready/perf-worldbuild-1`). The canonical entry is HANDOVER.md "PERF-WORLDBUILD 2"; this file is the
working picture for whoever takes the world build next.

The mission was: no main-thread task over 50 ms while the world is built, no visible change. The architecture PERF-LEAD
chose on 23 Nov is the world built BEHIND A LIVE GARAGE (`?boot=garagefirst`), so a long task is a frozen garage frame.

## 1. What landed, and under which switch

Everything is OFF by default. A page with no switch and no host budget builds the world it built before, in the steps it
had (the loading screen's text and bar are the build's yields, so a new yield on the default path would move them).

| Switch | What it does | Gate |
|---|---|---|
| `?stripw=1` | the strips' geometry is built in the house worker and landed as bytes | STRIPWORKER |
| `?nearfirst=1` (with stripw) | strips coarse at the load, the one under the stand first, fine ones land after. THE ONE SWITCH WITH A VISIBLE STATE: show it to the user in game before it is ever a default | STRIPWORKER (strips only) |
| `?patchw=1` | the premises patch's ground queries and the material map's raster are asked of the house worker | PATCHWORKER |
| `?roadw=1` | the roads' and the paved polygons' geometry in the house worker | PATCHWORKER |
| `?compsteps=1` | the premises' second composition (one task of 2.3-2.9 s) runs in steps; the standing premises stay in force until the swap | COMPSTEPS |
| `?hworder=fifo` | the worker's queue in arrival order (A/B against "what the page reads first") | PATCHWORKER 0 |
| `?settle=near` | PERF-LEAD's host rule in app.js: settle near the stand first | none of mine |
| host budget (JS, section 3) | every budget-led step below, and the probe bake's program linked ahead | COMPSTEPS with `COMPSTEPS_BUDGET=0` |

On every path (not opt-in), same bytes: the far terrain's cache sweep keeps the patches a still-stale quadrant wants
(node: 'far terrain sink' 76 ms / longest 47 -> 10 / 6); three bakes are generators drained in one go when no host asks.
The default load's cost of that, named (node, one run each, a hot box): the forest mist's map 456 -> 478 ms, the one-code
flags 183 -> 191, the water's tile 185 -> 192.

Earlier, landed as `claude/ready/perf-worldbuild-1`: the two exact pavement short-cuts are the default (`?pavepolybound=0`,
`?pavereuse=0` turn them off), GATE PAVEXACT.

## 2. The world build's steps, as they stand

Two label conventions, and they differ by one: `tools/perf/world_build_node.js` files a step under the label that OPENED
it (the work after that yield); PERF-LEAD's browser rows file a slice under the label it ENDED on (the work before it).
The table uses the node convention and names the browser's label where it differs.

Node ms: `world_build_all6.json`, 23 Nov, the six switches on, d9bf9cc0a, a hot shared box (compare ratios, not absolutes).
Browser ms: PERF-LEAD's garage-first row of 10:44 on 2a644ca981ef, 5K headed, cold, one run - BEFORE d9bf9cc0a /
a9fa841d6. Its rows on the build that carries a9fa841d6 are in `D:/Dev/flydiy-notes/evidence/perf-gf-2026-11-23/`.

| Step (node label) | What runs | Node ms (longest) | Browser, before (its label) | State |
|---|---|---|---|---|
| sky | the atmosphere's tables, the mist field, the forest mist map, two probe bakes | 861 (861) | 2 037 ('light'), of which 1 421 was one program's link | SLICE under the budget: five parts, the map by rows; the clouds' dome linked ahead and slept on. The link is browser-only: not proven yet |
| ground colour | the 512^2 ground bake's rows | 1 398 (159) | 12 slices, 895, longest 149 | SLICE: a row a check under the budget (blocks of 32 without) |
| ground | the drawn lakes' field, the albedo's texels | 165 (165) | 161 ('island ground') | SLICE: two parts under the budget |
| island ground | tint, fields, the one-code flags (191), four 12 M-texel uploads, calm field, the splat's make | 488 (488) | 459 ('ground bake') | SLICE: parts, flags every 32 rows, an upload a step |
| ground fields / ring / ring normals | field bake, three's geometry and normals | 115 / 100 / 64 | 112 / 125 / - | STUCK (small; three's own calls) |
| ring heights, ground under the premises | heights through the raster (tile decodes) | 466 (79), 582 (68) | under 100 each | already in steps |
| ground programs (far terrain) | measure of the quadtree's node errors (66), the first cut | 200 (200) | 354 ('water') | SLICE: a quadrant a step under the budget; `measure` (one task, ~65 node ms) is left |
| water | the detail tile's bake (192) | 227 (227) | 199 ('rivers') | SLICE: by rows under the budget |
| premises: a station / a site | the composition's placement | 516 (114) / 567 (103) | a site 84; the built links 5 slices, longest 97-125 | STUCK on the page unless the placement goes to the worker |
| premises: plots / a wood / the built links | the composition's sowers and planters | 701 (15) / 907 (16) / 29 (8) | - | SLICE (`?compsteps=1`) |
| premises: the shelves / the roads / the swap | composition | 80 / 80 / 72 | - | STUCK (one task each, 70-100 ms) |
| premises made | RENDER_PREMISES.make after the swap | 167 (167) | was 2 257 with the composition inside | SLICE with compsteps; the 167 left is make's own body |
| patch ground, patch block | the patch's chunks | 739 (126), 1 923 (61) | 88-116 | WORKER (`?patchw=1`) for the queries; the page's assembly is in steps |
| roads | per road: marks, material, the rail, the power line | 2 069 (555) | 9 slices, 1 323, longest 452 | WORKER (`?roadw=1`) for the geometry; SLICE under the budget for the rail and the line. What is on top is raster tile decodes on first touch (767 node ms under this label) |
| strips | the strips | 60 with the worker | was ~6.5 s on the page | WORKER (`?stripw=1`) |
| houses | the town kit's host build (decodeLod 105, octDec, mirrorOf), a cabin's preparation | 390 (390) | 306-384 (its 'trees' slice) | STUCK: one constructor (townkit.js host). Next step 2 below |
| lots (material map) | the raster of the material map | ~0 with the worker | 903 before | WORKER (`?patchw=1`) |

What the browser alone sees: the links. PERF-LEAD's rows have the world READY 100-108 s after the garage shows, most of
it 'compiling the world' waiting on the pavement's and the ground's programs. The stand-ins for those links are in this
branch (section 3); handing them early is PERF-LEAD's host.

## 3. The host's contract

- `window.FLYDIY_WORLD_BUDGET = { left: () => ms }`. `left() <= 0` means "yield now". The build reads the hook ONCE, right
  after its 'sky' yield (`HOSTB` in render_world.js): arm it before the generator is stepped past 'sky'. Every budget-led
  step exists only then. The inner guards (rows, stations, texels) ask `left()` each time, so a host may change its
  answer between frames (a few ms while a slider moves, ~25 ms at rest).
- `window.FLYDIY_WORLD_ASYNC === true` tells the build the host can sleep; then a step may set
  `window.FLYDIY_WORLD_WAIT = <promise>` and yield. The host ends its slice there and steps again when the promise
  settles, or 250 ms later (app.js buildWorldSliced: a wake that never comes costs a look again). The build always
  re-checks its own condition after the yield.
- Labels: the generator yields a string before the work it names. Budget-led labels: 'sky: the mist field', 'sky: the
  forest mist', 'sky: the probe', 'sky: the probe programs', 'sky: the cabin probe', 'ground: the albedo', 'island
  ground: the fields / the types / an upload / the calm field / the sets', 'far terrain: a quadrant', 'water: the tile',
  'roads: its rail', 'roads: its line'.
- Stand-ins for early links, made only when asked: `scene.userData.groundWarm()` at the yield 'ground programs'
  (island-ring, island-fine, island-outer; also `WORLD.ground.warm()` after the build), `scene.userData.patchWarm()` at
  'premises made' (`WORLD.premises.patchWarm()` after), `PAVEMENT.warmMesh`. Each entry is `{ name, key, material, mesh }`:
  the drawn material itself on one bare triangle, never in the scene.
- The probe bake's program: the build makes `CLOUDS.domeMesh(0, 20, 24)` after the sky's tables and hands it to
  `renderer.compileAsync` in a bare scene with a render target bound (the bake's own key: linear out, no tone map), then
  sleeps on it before the bake. `scene.userData.skyLink = { linked, linkMs, sleptMs }`. If the browser shows a second
  'sky / clouds / dome' program into PMREM.cubeUv, the two keys differ: compare their `defs`.

## 4. The gates, and how to run them

On the box every node run goes through the token wrapper, in the background:
`bash D:/Dev/flydiy-notes/cpu_token.sh run <NAME> -- node tools/run_gates.js --only=<IDS> --no-build --jobs=1`.
The gates read `src/` at boot: never edit while one is queued.

- STRIPWORKER (`tools/_stripworker_check.js`, ~5 min): two loads (`?stripw=1`, `?nearfirst=1`) against the page's own
  build - meshes, vertices, digests; 2c: the stand-ins are the drawn materials at the step and at the end.
  `STRIPWORKER_QUERY=<switches>` adds switches to both loads.
- PATCHWORKER (`tools/_patchworker_check.js`, ~4 min): the patch, roads, paved polygons, rails, poles and far terrain on
  the page's digests with the worker on; 0: the queue's order on a bare port.
- COMPSTEPS (`tools/_compsteps_check.js`, ~4 min): the composition in steps against one task - 11 records, seven
  families, the standing premises in force at every yield. `COMPSTEPS_QUERY=<switches>` adds switches to the steps
  side; `COMPSTEPS_BUDGET=0` runs the steps side under a budget that always says "yield now" (every guard of the build
  yields: the strongest check of the budget-led steps; it also compares the build's big texture uploads, hashed on their
  way up).
- PAVEXACT (`tools/_pavexact_check.js`): the pavement short-cuts against the old paths.
- Function-level checks added to existing gates: FMIST (the map in steps = the one-task map), WATER (the tile), SPLAT
  (the one-code flags).
- PREMISES throws in any perf-codex tree on `tools/fixtures/premises_v1_perf_town_third.json`; on an export with that
  file out of the gate's pattern it passes (541 checks).
- Red on the base, by check name, in the HANDOVER entry: FMIST 3, GFX 1, TERRAINMATCH 6, LAKEBED 1, PREMRASTER 2,
  STAGES 19, MEDIA 1, ASSETS 4.
- The profiler: `node --max-old-space-size=6144 tools/perf/world_build_node.js --out <dir> --workers --label <name>
  --query "<switches>"` - every label's ms, slices, longest slice and top functions; `--census`, `--units`, `--mats`,
  `--composesplit` for more.

## 5. Next, in order

1. THE RASTER'S TILE DECODES ON FIRST TOUCH (27_premises.js rasterTileDecode: 767 node ms under 'roads', 340 under
   'ground under the premises', 311 under 'ring heights'; 134 + 114 ms of the browser's longest road slice). The cache is
   capped at 48 MB and the build thrashes it: 48 235 decodes and 46 854 evictions by the time the garage shows. The
   cache is exact whatever is evicted (GATE PREMRASTER), so a larger cap during the load is the same bits: measure the
   decodes at 2x and 4x the cap first (the option exists: `rasterCap`), name the memory, shrink it back after the build.
   Estimate: half a day with its gate run; the gain is whatever share of the decodes are re-decodes (not measured).
2. THE TOWN KIT'S HOST BUILD (townkit.js `host`, called from render_premises cityBuild / ktBuild in the 'houses' step:
   306-390 ms in one constructor). The decode of each (archetype, mirror)'s three rungs is separable: decode them a step
   each into a memo on the pack before `host` runs, and let `host` take them from it. What is left is the looks and the
   instanced meshes. Estimate: a day; GATE TOWNKIT, CITYHOST and HOUSEWORKER cover it.
3. THE COMPOSITION'S PLACEMENT FROM THE WORKER ('premises: a station' 114-125 ms, 'a site' 103-122: stuck on the page
   today; fix B, "the worker composes early", is the same piece of work). The worker already composes the record for its
   own jobs; the page would take the placement's result instead of running it. Estimate: two days; GATE COMPSTEPS's
   records are the match.

Noted, not started: the far terrain's `measure` (node errors: a cook candidate); the island's one-code flags as a
cooked table; the zone memo (5 hits / 22 misses: which key input moves); near first for the roads and the patch.
