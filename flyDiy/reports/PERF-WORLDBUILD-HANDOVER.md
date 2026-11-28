# PERF-WORLDBUILD - handover (23 Nov 2026)

Branch `claude/perf-worldbuild-next`. Landed ref for L40M: `claude/ready/perf-worldbuild-2` = 43f58e871 (off
`claude/perf-codex` 4421e5416, on `claude/ready/perf-worldbuild-1`). After it, on the branch: round three = 72d9aa4db
(gated), round four = b49b8a4cd, round five = 369ad0ec9 (`claude/ready/perf-worldbuild-3` = a226782a7 carries both), round six = 55fcb24fb
(`claude/ready/perf-worldbuild-4`; its browser row is below). The canonical entry is HANDOVER.md "PERF-WORLDBUILD 2"; this file is the working picture for
whoever takes the world build next.

The mission: no main-thread task over 50 ms while the world is built, no visible change. The architecture PERF-LEAD chose
on 23 Nov is the world built BEHIND A LIVE GARAGE (`?boot=garagefirst`), so a long task of the build is a frozen garage
frame. The user's word on it (23 Nov, 12:45): the garage must not freeze - no task over 100 ms, then none over 50.

## 1. What landed, and under which switch

WITH NO HOST everything is off: a page with no switch and no host budget (`?boot=loadfirst`, node, every gate) builds the
world it built before, in the steps it had (the loading screen's text and bar are the build's yields, so a new yield on
that path would move them). UNDER THE GARAGE-FIRST HOST (the default boot since the user's word of 23 Nov 21:05), since
`claude/ready/perf-worldbuild-5`: stripw, patchw, roadw and compsteps are ON by default (each off with `?name=0`); nearfirst
and settle=near are on by the host's word (`window.FLYDIY_WORLD_DEFAULTS = { nearfirst: true, settle: 'near' }`, the
user 22:10: "turn them on by default ... we can turn them off easily afterwards"; off with `?nearfirst=0`, `?settle=0`).

| Switch | What it does | Gate |
|---|---|---|
| `?stripw=1` | the strips' geometry is built in the house worker and landed as bytes | STRIPWORKER |
| `?nearfirst=1` (with stripw) | strips coarse at the load, the one under the stand first, fine ones land after. THE ONE SWITCH WITH A VISIBLE STATE: show it to the user in game before it is ever a default | STRIPWORKER (strips only) |
| `?patchw=1` | the premises patch's ground queries and the material map's raster are asked of the house worker | PATCHWORKER |
| `?roadw=1` | the roads' and the paved polygons' geometry in the house worker | PATCHWORKER |
| `?compsteps=1` | the premises' second composition (one task of 2.3-2.9 s) runs in steps; the standing premises stay in force until the swap | COMPSTEPS |
| `?hworder=fifo` | the worker's queue in arrival order (A/B against "what the page reads first") | PATCHWORKER 0 |
| `?settle=near` | PERF-LEAD's host rule in app.js: settle near the stand first | none of mine |
| host budget (JS, section 3) | every budget-led step of section 2, the probe bake's program linked ahead | COMPSTEPS with `COMPSTEPS_BUDGET=0` |

On every path (not opt-in), same bytes: the far terrain's cache sweep keeps the patches a still-stale quadrant wants
(node: 'far terrain sink' 76 ms / longest 47 -> 10 / 6); five bakes and builds are generators drained in one go when no
host asks (the forest mist's map, the one-code flags, the water's tile, the guardrail's plan and build, the town's host).
The default load's cost of the first three, named (node, one run each, a hot box): 456 -> 478 ms, 183 -> 191, 185 -> 192.

Earlier, landed as `claude/ready/perf-worldbuild-1`: the two exact pavement short-cuts are the default (`?pavepolybound=0`,
`?pavereuse=0` turn them off), GATE PAVEXACT.

What is in which commit: the ready (43f58e871) has the switches, the sky's link and five parts, 'ground colour' by rows,
the island ground in parts, the first cut a quadrant a step, the water's tile, the roads' rail and line. Round three
(72d9aa4db) adds the town's host in steps, the ring's heights, the drawn lakes' field, the far terrain a patch a step,
the fields texture's bytes, the bake's fields by rows. Round four adds the capped geometry flush, the sheds' textures a
tick each, the patch's chunks a check each. Round five adds the far terrain's node errors' measure in steps ('far
terrain: the measure').

Measured in the browser so far (PERF-LEAD, quiet box, six switches, tasks of 50 ms+ behind the garage): the ready against
no switch at all - the world step 35.6 -> 25.4 s, the settle 20.8 -> 8.6 s, the garage's tasks over 100 ms 57 -> 35, the
worst world-build slice 2.0 -> 0.38 s; round three against the same build without it (16:00) - trees 296 -> 64 ms, far
terrain: a quadrant 142 -> 114 + 72, ring 122 / ground albedo 102 / island ground: the types 65 -> under 50, 61 tasks
with 16 over 100 (70 and 17 without). Rounds four and five (17:42, 369ad0ec9, a BUSY box: times ~1.2-1.3x) - the far
terrain's cut and quadrant, the ring, the albedo and the island's types gone from the list; the one unlabelled slice
left (194 ms) is a cabin's preparation and an asset load, not the build; patch ground 83, its fields 113, roads 92, the
built links 116, a site 83, houses 79, forest mist 84. AND ROUND FOUR'S UPLOAD CUTS DID NOT WORK: right after the world
step two tasks of 902 + 566 ms (622 + 207 before) - three uploads the world's textures (516 ms) and buffers (177 ms) AT
THE DRAW of the garage's first frame that meets them (renderBufferDirect). The sheds' textures "one a tick" lost the
race with that frame, and the capped flush left buffers pending for it. Round six answers it (below); it has no row yet.

Round six (under the budget): when the generator ends and BEFORE worldBuilt hands the world over, app.js
buildWorldSliced drains the waiting geometry (24 MB a tick) and initTextures every texture the scene's materials hold
(worldPreUpload: the boot's 'upload' list, a texture a tick at least, 6 ms a tick); the side sheds, made inside
worldBuilt, are hidden while their textures go up one a tick, then shown - in garage first they appear a moment after
the world: THE ONE VISIBLE EFFECT of these rounds, only under the host (PERF-LEAD tells the user).

Round six in the browser (PERF-LEAD, 19:57, a quiet box, the evening build 79648c6c155f): after the world step the
freeze is gone - one task of 87 ms between the steps (622 + 207 quiet, 902 + 566 busy before). OPEN: one task of 648 ms
INSIDE the world step under no label (texture calls 432 ms, bufferData 118 ms; a 750 ms gap between frames) - see
section 5, step 0. Totals: 55 tasks of 50 ms+ behind the garage, 14 over 100 ms, the worst 648 (61 / 16 / 1 419 at
16:00; 104 tasks and a worst of 3 456 ms on the morning's builds). The world step 26.9 s, ready at 90.3 s: no cost seen.

## 2. The world build's steps, as they stand

Two label conventions, and they differ by one: `tools/perf/world_build_node.js` files a step under the label that OPENED
it (the work after that yield); PERF-LEAD's browser rows file a slice under the label it ENDED on (the work before it).
The table is by what runs; the browser's label is the one its slice ended on.

Node ms: `world_build_all6.json`, 23 Nov, the six switches on, d9bf9cc0a, a hot shared box (compare ratios, not absolutes).
Browser ms: PERF-LEAD's garage-first rows, 5K headed, cold, one run each - 10:44 on 2a644ca981ef (before any budget-led
step), 11:49 and 14:19 on builds that carry a9fa841d6 (the ready). Rows on round three and four:
`D:/Dev/flydiy-notes/evidence/perf-gf-2026-11-23/` and `perf-check-*-2026-11-23/`.

| What runs | Node ms (longest) | Browser 10:44 | Browser on the ready | State after rounds three and four |
|---|---|---|---|---|
| The sky: tables, mist field, forest mist map, two probe bakes | 861 (861) | 'light' 2 037, of which 1 421 one program's link | worst slice 0.38 s (11:49); 'forest mist' 71-98 | SLICE: five parts, the map by rows; the clouds' dome linked ahead and slept on ('sky: the probe programs') - whether the bake takes that program is the browser's word (scene.userData.skyLink) |
| The ground bake's rows | 1 398 (159) | 'ground colour' 12 slices, 895 | not over 50 | SLICE: a row a check |
| The ground bake's fields (per bake) | 115 | - | 'ring' 130-135 | SLICE (round three): a row of fields a check |
| The drawn lakes' field, the albedo's texels | 165 | 'island ground' 161 | 'ground: the albedo' 99-196 | SLICE (round three): the lakes' field in steps ('ground: the lakes') |
| The island ground: tint, fields, one-code flags, four 12 M-texel uploads, calm field, the splat's make | 488 (488) | 'ground bake' 459 | 'island ground: the types' 137, 'the fields' 54 | SLICE: parts; the flags every 32 rows; an upload a step; (round three) the fields texture's bytes a million texels a step |
| The ring: plane, turn, heights, UVs | 100 + 466 (79) | 'ring' 125 | 'ring heights' 313 (a busy box) | SLICE (round three): 'ring: its plane', heights 64 vertices a check |
| The ring's normals, the detail canvases | 64 | - | 'ground material' 62-68 | STUCK (three's computeVertexNormals) |
| The far terrain: node errors' measure, the first cut | 200 (200) | 'water' 354 | 'far terrain: a quadrant' 141-191, 'far terrain patch' 64-72 | SLICE (round three): the cut alone, a patch a step, a quadrant only assembles; (round five) the measure between two nodes - it was the 114 ms slice ending on 'far terrain: the cut' at 16:00 |
| The water's detail tile | 227 (227) | 'rivers' 199 | not over 50 | SLICE: by rows |
| The composition: plots, woods, links | 701 (15), 907 (16), 29 (8) | 'premises made' 2 257 in one task | - | SLICE (`?compsteps=1`) |
| The composition: a site, the shelves, the roads, the swap | 567 (103), 80, 80, 72 | 'a site' 84 | 'a site' 80-92, 'the shelves' 73 | STUCK unless the placement goes to the worker |
| The composition: a station's build (its AO bake) | 516 (114-126) | - | 'the built links' 117-145 (6 tasks, 2 over 100) | STUCK: one call into the renderer's builder |
| RENDER_PREMISES.make after the swap | 167 | - | 'the renderer' 66 | one task |
| The patch: its chunks' heights, normals, blocks | 739 (126), 1 923 (61) | 88-116 | 'patch ground: its fields' 109-130, 'patch block' 90-107, 'patch ground' 87-101 | WORKER (`?patchw=1`) for the queries; SLICE (round four): a chunk a check. 'patch ground: its fields' is only where the build sleeps on the worker |
| The roads: marks, material, the rail, the power line | 2 069 (555) | 9 slices, 1 323, longest 452 | 'roads' 88-127 | WORKER (`?roadw=1`) for the geometry; SLICE: the rail (its plan every 8 stations, each run) and the line |
| The strips | 60 with the worker | ~6.5 s on the page | not over 50 | WORKER (`?stripw=1`) |
| The material map's raster | ~0 with the worker | 'lots' 903 | - | WORKER (`?patchw=1`) |
| Trams, traffic, animals | 69 | - | 'houses' 78-102 | one task |
| The town's host (decode, mirrors, geometry, batch, far cells) | 390 (390) | 'trees' 306 | 'trees' 305-386 | SLICE (round three): townkit.js hostSteps / townSteps |
| Geometry uploads after a slice (GPU_ONLY_GEO.flush) | not seen in node | - | two unlabelled slices 290 + 203 (my reading); 522 buffers, 244 MB in the task after the build | Round four's cap alone made it WORSE at the first draw (17:42); round six drains it BEFORE the world is handed over: the after-world freeze is gone (19:57) |
| The side sheds' textures (worldBuilt, shedTexWarm) | not seen in node | - | most of a 622 ms task right after the world step (304 texture calls) | Round four's "one a tick" lost the race with the frame (17:42); round six uploads the scene's textures before the hand-over and hides the sheds until theirs are up: 87 ms after the world step (19:57); one 648 ms task of the hand-over itself is open |

Not the build's generator, named by PERF-LEAD's 14:19 profile and NOT cut:
- The tree impostor sheets' readbacks (render_world.js sheetCheckAsync: three's readRenderTargetPixelsAsync 164 + 279 ms,
  sheetStat 46 ms, in the tasks after the world step). The read is queued at the bake because the render target is
  shared by the next sheet, so it cannot simply be deferred; the whole sheet comes back to count its drawn texels. The
  cut: blit the sheet to a small target of its own at the bake and read that (kilobytes), or read one row of tiles.
  The check's numbers (atlas.check, tools/imp_audit.js) change with it: an empty or black sheet is still shouted.
- The settle's worldUpdate calls that do not yield (27_premises.js plane / roadDist / rasterTileDecode / inPoly,
  scenery_life.js freeForMast, 29_obstacles.js hull, cover_ring.js buildCell: 260-321 ms): PERF-LEAD's to name.

What the browser alone sees: the links. PERF-LEAD's rows have the world READY 100-150 s after the garage shows, most of
it waiting on the pavement's and the ground's programs. The stand-ins for those links are in this branch (section 3);
handing them early is PERF-LEAD's host.

## 3. The host's contract

- `window.FLYDIY_WORLD_BUDGET = { left: () => ms }`. `left() <= 0` means "yield now". The build reads the hook ONCE, right
  after its 'sky' yield (`HOSTB` in render_world.js): arm it before the generator is stepped past 'sky'. Every budget-led
  step exists only then. The inner guards (rows, stations, texels, chunks) ask `left()` each time, so a host may change
  its answer between frames (a few ms while a slider moves, ~25 ms at rest). The premises' renderer, the worker-side
  helpers, assets.js and app.js read the hook where they need it (render_premises buildRoadsSteps / buildPatchSteps /
  the 'houses' step, GPU_ONLY_GEO.flush, shedTexWarm).
- `window.FLYDIY_WORLD_ASYNC === true` tells the build the host can sleep; then a step may set
  `window.FLYDIY_WORLD_WAIT = <promise>` and yield. The host ends its slice there and steps again when the promise
  settles, or 250 ms later (app.js buildWorldSliced: a wake that never comes costs a look again). The build always
  re-checks its own condition after the yield.
- Labels: the generator yields a string before the work it names. Budget-led labels: 'sky: the mist field', 'sky: the
  forest mist', 'sky: the probe', 'sky: the probe programs', 'sky: the cabin probe', 'ground: the lakes', 'ground: the
  albedo', 'island ground: the fields / the types / an upload / the calm field / the sets', 'ring: its plane', 'far
  terrain: the measure / the cut / a patch / a quadrant', 'water: the tile', 'roads: its rail', 'roads: its line', 'houses: the kit',
  'houses: the town'. Under the budget 'ground colour', 'ground fields', 'ring heights' and 'patch ground' come more
  often (a row, a chunk a check).
- After a slice the host calls `GPU_ONLY_GEO.flush(renderer)` (app.js geoFlush). Under the budget a call uploads at most
  24 MB and leaves the rest pending (`GPU_ONLY_GEO.pending()`); buildWorldSliced drains it a tick at a time once the
  build has ended. A geometry not flushed yet uploads at its first draw.
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
The gates read `src/` at boot: never edit while one is queued. Several gates LIFT source text and run it (LOOKS and
LAKEBED lift the drawn lakes' closure; LOOKS quotes the fields texture's line): before changing a line, search
`tools/_*_check.js` for it.

- STRIPWORKER (`tools/_stripworker_check.js`, ~5 min): two loads (`?stripw=1`, `?nearfirst=1`) against the page's own
  build - meshes, vertices, digests; 2c: the stand-ins are the drawn materials at the step and at the end.
  `STRIPWORKER_QUERY=<switches>` adds switches to both loads.
- PATCHWORKER (`tools/_patchworker_check.js`, ~4 min): the patch, roads, paved polygons, rails, poles and far terrain on
  the page's digests with the worker on; 0: the queue's order on a bare port.
- COMPSTEPS (`tools/_compsteps_check.js`, ~4 min): the composition in steps against one task - 11 records, nine
  families (the patch, pavement, road, pave, rail, poles, far terrain, the town's batch, its far cells), the standing
  premises in force at every yield. `COMPSTEPS_QUERY=<switches>` adds switches to the steps side; `COMPSTEPS_BUDGET=0`
  runs the steps side under a budget that always says "yield now": every guard of the build yields, the header lists
  the budget-led labels seen, and the build's big texture uploads are hashed on their way up. It is the one check of
  the budget-led steps. It does NOT see the geometry flush (the gate keeps the arrays) nor any link.
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

0. THE 648 ms TASK WAS THE TREE IMPOSTORS' BAKE, not the hand-over (cut from `GF_READY.cpuprofile.json` at 66.4 s:
   plantWoodland < impMatsFor < bakeImpostorAtlas < bakeImpostorAtlasNow < drawAll - the bake's draws were the tree models'
   first: maps 377 ms, buffers 115-142 ms, a link wait 50 ms). `claude/ready/perf-worldbuild-6` uploads the tree pool's
   packs (maps a step each, geometry 16 MB a step) before plantWoodland, under the budget. THAT BLOCK HAS NEVER RUN IN
   NODE (the tree maps do not settle there): look for `scene.userData.treeWarm` and the 'trees: ' labels in the first
   browser row, and for the bake's task gone. If the bake is still long, what is left is its own draws and the link.
0b. THE SETTLE'S LONG TASKS (evening row: 371 / 270 / 133 / 100 / 96 ms at 79.6-81.6 s; cut the same profile there).
   Every streamer honours the slice's clock (`FLYDIY_SLICE.until`) only before STARTING a unit, and the unit is atomic:
   scenery_life.js tick < place < mastLife < freeForMast < offRoad < roadDist (the life's whole stand in one call, with
   ground reads that decode raster tiles on first touch); render_premises hlodTick < hlodCell < hlodBake (one far-town
   cell's merge; three's getDataURL under bandOf); render_premises hitPendingStep < aircraftOf < 29_obstacles
   aircraftShape < hull (one parked aeroplane). Each has to become resumable - its loop keeping its place across calls -
   and each runs in flight too: a day each with its own gate, in that order by size.
1. THE IMPOSTOR SHEETS' READBACKS (section 2, "not cut"): 164 + 279 ms on the garage's frames right after the world
   step. A small copy to read back instead of the whole sheet. Estimate: half a day, with a browser row to prove it (a
   GPU path: node cannot see it).
2. A STATION'S BUILD (the composition's 'a station': 114-126 node ms, 117-145 in the browser, two tasks over 100): the AO
   bake inside the renderer's builder (bakeAO 186 node ms over six stations). Either the bake in steps (the builder's
   memo holds a build as a pure function of its generator and parameters - keep that) or the placement and its builds
   from the worker, which is the larger piece: 'a site' (103-122 node ms) and the shelves, the roads, the swap (70-100
   each) are stuck on the page for the same reason. Estimate: a day for the bake in steps, two for the worker; GATE
   COMPSTEPS's records are the match.
3. THE RASTER'S TILE DECODES ON FIRST TOUCH (27_premises.js rasterTileDecode: 767 node ms under the roads, 340 under
   'ground under the premises', 311 under 'ring heights'). The cache is capped at 48 MB and the build thrashes it:
   48 235 decodes and 46 854 evictions by the time the garage shows. The cache is exact whatever is evicted (GATE
   PREMRASTER), so a larger cap during the load is the same bits: measure the decodes at 2x and 4x the cap first (the
   option exists: `rasterCap`), name the memory, shrink it back after the build. They are no longer long tasks (the
   steps around them are led by the budget); this is total time. Estimate: half a day.

Noted, not started: the far terrain's node errors as a cooked table (the measure is in steps now); the island's
one-code flags as a cooked table; the zone memo (5 hits / 22 misses: which key input moves); near first for the roads
and the patch; trams, traffic and animals in steps ('houses' 78-102 ms).
