# flyDiy — INDEPENDENT REVIEW (architecture + bug hunt), 2026-10-04

Scope: the engine (solver, generator, aero/hydro/atmos, pilots, world), the editor (cage tools, garage,
design flow), the game loop and sim glue, the drawn aeroplane, and the release pipeline. Read on
`ccr-4c7cf662-zcpqoe` = master 44b7a38 (train 30). Method: a full read of 30_solver.js by the reviewer
plus eight parallel file-by-file reads of the other slices; every HIGH finding and most MEDIUM ones were
re-verified against the source, and the ones marked REPRO were reproduced with node against
`tools/flight_core.js` (scratch scripts, nothing in the tree touched). Nothing in this document is
guessed from the HANDOVER; the HANDOVER was only grepped to confirm a convention.

The core gate battery (`node tools/run_gates.js`, 147 jobs) was started on this machine as a baseline;
4 cores, so it runs for hours. Its verdict will be appended to this file when it lands. Note that every
reproduced finding below passes that battery: they live in configurations, combinations and doors the
gates do not drive.

## VERDICT IN ONE PARAGRAPH

The lattice generator, the strip/polar contract, the ISA/solar/climate models, the hydrology bake, the
fixed-step clock, the input model and the worker protocol are sound: a lot of careful work, well held by
gates. The defects cluster at four seams the gates do not cross: (1) the SPEC IS NOT A FIXED POINT of its
own pipeline (resolve/clamp re-applied, join-by-absence merged), so sheets and saved builds drift from the
aeroplane on the stand; (2) FRAME CONVENTIONS are never cross-checked between core and viewer (mirrored
house hitboxes, world-z crosswind gates, wind sampled at z=0); (3) the two older pilots are FORKS that did
not receive fixes landed in the third; (4) DELIVERY has no check after `git push` and the project's own
deploy workflow has never run. One physics-honesty item is large enough to be a ruling: the solver's
"deformation damper" damps rigid rotation with a 2 s time constant in vacuum.

## A. HIGH — fix before the content release

| # | Where | Defect | Status |
|---|---|---|---|
| A1 | `../.github/workflow/static.yml` | Folder is `workflow` (singular); GitHub reads `.github/workflows/`. The Pages workflow has never run; deployment is the legacy branch builder, which skipped trains 28–30 (HEAD is an empty "re-trigger"). The artifact `path: '.'` would upload the whole repo (~2.7 GB) against the 1 GB Pages limit. | CONFIRMED |
| A2 | `src/core/64_gen_build.js:856,769,809` + `60_gen_spec.js:4502,4673,3972`, `61_gen_frame.js:2735` | `genSpecAtFuel` clones `def.spec` (already RESOLVED) and `buildGen` re-resolves it; `resolveSpec` applies `place.dx`/`tailDx`/`tailY`/`gearDx` additively, so it is not idempotent. Every CG-corner, reserve and fuel-state sheet of a spec with any offset is a different aeroplane (REPRO: wing dx 0.5 / tail dx 0.4 → main xLE 0.88, hX 6.31; re-resolved 0.38, 5.41). `_cage_design.js:2305` bakes `wing.place.dx` into archetypes. GATE MASS only checks GEN_DEFAULT (offsets 0). Fix: consume offsets once (zero `place.*`/`tailY` after applying, keep them in `.auto`) or rebuild the corners from the normalised input (`S._raw`). | REPRO |
| A3 | `tools/_cage_join.js:425,495,570,577,240,594,254` + `src/viewer/garage.js:662` (merge) | The join writes `cabin.glazing='none'`, `fuselage.covering='open'`, `tail.type='v'/'twinBoom'` (+vAngle/boomX…), `wings[i].material`, `tail.finMaterial/stabMaterial`, `bracing.*` ONLY in the non-default state; the merge keeps absent keys (except finish/cage/arrays). Once set they can never be unset from the editor: set stab cant 30, back to 0 → the physics still flies a V-tail at the old angle under a conventional drawing; autosave persists it. The merge's own comment names this bug class for `cage`/`finish`; this is the fourth instance. GATE JOIN L394 asserts "default skinOn writes no covering", i.e. codifies it. Fix: every join-owned row is a complete statement (`'glass'|'none'`, `'skin'|'open'`, `'conventional'|'v'|'twinBoom'` with the dependent keys nulled; `material: null` when cons = 0) and GATE JOIN gets an "on → off → equals never-on" case. | CONFIRMED |
| A4 | `src/viewer/garage.js:1267` | `GARAGE_SPEC.set` loads with the CURRENT `slotName, plaque, log`; both doors that create a NEW aeroplane (`design_flow.birthApply`, `CAGE_RESET_BUILD` app.js:10983) use it. A newborn build inherits the previous build's name, "tested" plaque and flight hours; the first Save overwrites the old slot. Fix: `set` loads with `'' / null / newLog()`; only `update` retains the slot. | CONFIRMED |
| A5 | `src/core/24_world_aero.js:118-142` | The strip probe samples the centreline at 11 points (65 m apart); a 45 m river fits between. Seed 0 A2 "Pelham Field" (hdg 135): terrain 5.4 m under the record's `elev` at t=−233 with water on the runway (REPRO, own walk at 2 m). The grade is faded inside a carved bed by design, so the trench survives. Fix: probe every ≤10 m and reject any box touching a carve (`_cd > 0`); add a per-strip invariant gate (`elev ≈ terrainH` along every generated centreline). | REPRO |
| A6 | `src/core/20_world.js:730` vs `src/viewer/render_world.js:6005`, `29_obstacles.js:463` | Settlement houses register `yaw: b.rot`; the renderer places them with `setFromAxisAngle(up, -b.rot)`. OBSTACLES maps local x → (cos, −sin), THREE → (cos, +sin): every house hitbox is mirrored (rotated −2·rot from the mesh; at ±45° the box is 90° off). GATE OBSTACLE only checks `near()`. Fix: `yaw: -b.rot`, and a "same box, both frames" gate per registration site. | CONFIRMED |
| A7 | `src/viewer/app.js:4403-4405` | The dispose branch on rebuild is guarded by `model.gen`, set only by the legacy generator path (2899). The cage visual (`key === 'gen'`, entry at 3135) has no `gen` flag and is the one model never cached and rebuilt on every spec change: its GPU buffers and paint textures are never freed. VRAM grows per slider commit until context loss. Fix: `if (key === 'gen' \|\| model.gen)` and dispose the per-build textures. | CONFIRMED |
| A8 | `src/viewer/app.js:10662-10718, 7787` | `flCamera` reads `sim.axes()` every frame; after a divergence `flYawRate` (an EMA never reset) and `az` go NaN; `fullReset()` resets the sim and pilot but not the camera, and after a crash "Fly again" runs `fullReset` without the reveal (`flRevealStart` is the only resetter). Blank screen, no error. Also the inline divergence watchdog runs every 30th frame, feeding NaN to `WF.worldUpdate` and the renderer. Fix: reset `flYawRate/az/el` in `fullReset`, early-return `flCamera` on a non-finite heading, check every frame. | LIKELY (path traced, not run) |

## B. MEDIUM

**Solver (30_solver.js)**
- B1 `:1338` the body Munk term samples `world.wind(ax, ay, 0, simT)` — z literal 0 (the same mistake G72 fixed for the CG sample's y). The climate field is spatial (AGL via terrainH(x,z), linearised round the aeroplane); 11 km off centre it falls out of `LIN_R2` and does a FULL field evaluation every substep (performance) with the wrong terrain under it (wrong shear → wrong body incidence → pitch moment). Fix: compute `az` in that block and pass it; `blob()` two screens up samples correctly. CONFIRMED.
- B2 `:1063` ground effect reads `world.terrainH` under the wing; under water that is the carved lakebed/seabed, so a floatplane gets almost no ground effect on the water. Use `max(terrainH, waterH)`. CONFIRMED (honesty).

**Pilots (40/41/43)**
- B3 `40_autopilot.js:948-953`, `41_test_pilot.js:888-893` decrab rudder is the pre-G381 sign (43 documents and fixed it: `-K·e`, not `-K·hdg`); P and D fight in the hold-off. The gate harness flies 40, so the WIND anchors are calibrated on it. CONFIRMED.
- B4 same lines: decrab arms on `|windZ| > 0.5` — world z; only x-aligned strips (HOME) ever decrab in the classic/test pilots. 43 uses `|windZ|+|windX|`, still not the strip-frame cross component. CONFIRMED.
- B5 `43_pilot.js:1052-1075`, `40:323`, `41:258` `restAlt/refAlt/gearH` latch on the FIRST update; a flight started in manual and re-engaged at altitude latches `gearH ≈ cruise altitude` → flare 300 m up. Latch only while `onG > 0`. LIKELY.
- B6 `43:1733-1745` ceiling acceptance lowers `hCruise` but the legs' `L.h` are frozen, so `climbMode` flips back next step; the verdict is cosmetic. LIKELY.
- B7 `41:574-586` "out of runway" measured from the roll start, not the runway remaining. CONFIRMED.

**Generator (60–65)**
- B8 `60_gen_spec.js:4362-4371` clamp runs BEFORE derivation: derived `tail.hSpan/tailArm/hX` escape the envelope (span 18/chord 2.1/xLE 3.0 → hSpan 4.66 vs 4.5, tailArm 8.99 vs 6.5). Re-run the tail/arm clamps after the puts. CONFIRMED.
- B9 `60:4692` `tail.Sh/Sv/Svt` are never clamped: 0 or negative → NaN lattice (hand/console spec path; the join only writes Sh when > 0). CONFIRMED.
- B10 `61_gen_frame.js:1612` twin boom: HTL/HTR coincide with the boom chain's T nodes when `stabY` is null → two zero-length beams (REPRO: 2) → `strain = (L−0)/0` = Infinity on every twin-boom shakedown; `makeLoadTest` gets NaN members and skips them silently. Have `B()` refuse `L < 1e-6`; alias the nodes. REPRO.
- B11 `61:1327,2025,1961` tricycle + pusher/nacelle: `EL/ER` are reassigned to the engine nodes, and the nosewheel (and the mains when `gear.x < −0.1`) are then braced to them with 2.3 m gear-class "wires". GATE GEN never builds pusher+tricycle together. CONFIRMED.
- B12 `61:958,265` the cantilever spar box and the lift struts are built from the FUSELAGE material row: `sec('bracing')` switches `MB` as a ledger side effect and `B()` picks it for `cls 'wing'`. On the stock cantilever 96 of 158 wing-class members carry tubeFabric's k. Choose the row by class. CONFIRMED.
- B13 `60:3709` an explicit `null` on a non-derivable field becomes the clamp FLOOR (`chord: null` → 0.80 m, `naca: null` → 0209) while the header promises "null = derive". CONFIRMED.

**World**
- B14 `21_world_hydro.js:225-235` a lake whose outlet cell already has upstream `acc > A0` is vetoed as a head and never traced: 97 of 212 such lakes at seed 0 have no outlet river. CONFIRMED.
- B15 `20_world.js dayTick` `seaRelax(|day.utc − u0|)` across the midnight wrap gets dt ≈ 86 380 s; the sea state snaps to target in one tick (REPRO by the reviewer). Use `dt·day.rate`. CONFIRMED.
- B16 `20_world.js coverAt` early reject `|dx|+|dz| > …` discards the ends of rotated strips (A2, A4): grass on diagonal strip ends. CONFIRMED (visual).

**Editor / drawn aeroplane / loop**
- B17 `design_flow.js:71,138,148` one-slot design undo survives a fleet load → undo writes build A's rows into build B. CONFIRMED.
- B18 `design_flow.js:279` two window listeners added per `rowBlock` render, never removed. CONFIRMED.
- B19 `garage.js:614` `decalImages()` called twice per `writeWip` (one `toDataURL` per page each), and on quota `lsSet` returns false silently: the autosave dies with no sign. LIKELY.
- B20 `app.js:3073,3484` one spar-delta buffer sized from `rigs[0]`; plane-2 rigs (G185 own binding) read plane-1 deltas: wrong flex, or NaN (vanishing upper wing) if plane 2 has more stations. CONFIRMED (code).
- B21 `app.js:3491,3617-3646` deflected surfaces keep rest-pose normals (flaps 35–40°, rudder 27°) under clear-coat materials. CONFIRMED.
- B22 `_cage_join.js:901-906` V-tail ruddervator rudder drive carries no `k2`; all three consumers default it to 1 rad: full pedal draws 57° against the declared 27°. CONFIRMED.
- B23 `app.js:43-48, 12427` lazy-load chains with no catch: a rejected load leaves `PREM.loading = true` and the world editor can never open again that session. CONFIRMED.
- B24 `app.js:56,104-112` closing the world editor leaves `running = false` without `userPaused`: the aeroplane is held while the sea/trees/animals run. CONFIRMED.
- B25 `render_world.js:2688` the non-shader tier draws the far sea at −0.4 m while the floats ride `waterH = 0` (the lake half was fixed in G1335). CONFIRMED.

**Release**
- B26 `tools/run_gates.js:568,729` `--only=<unknown id>` selects nothing and prints `BATTERY: PASS` exit 0. CONFIRMED.
- B27 nothing verifies the committed index.html/dev.html/sw.js/flight_core.js against a rebuild of src/ (today byte-identical; src commits land between "(built)" commits). Gap.
- B28 `build.js:948` BUILD_ID hashes core+viewer+editor only: boot.js, CSS, vendor, world/lazy packs, audio are outside it, so the version line and the `?v=` cache-bust can lie after such a train.

## C. LOW (one line each; the reviewers' reports hold the detail)
- Solver: `trqOf` debug `console.log` left in; `wheelsOnGround` reads `p[NaN]` when `tw` is null; `blob()` hard-codes `/4` (61 always gives 4 nodes; `bodyMunk` next to it uses `.length`); the crank timer lives in `burn()`, which returns early without THERMO.
- Harness `circuit_harness.js:105` breaks the FIRST step STOPPED is seen (comment says 5 s after); `iW0/iW1 = −1` → NaN flap silently.
- Pilots: `39_ground_path.js:151` truncation at GP_MAXPTS leaves `len` inconsistent; `38_nav.js:65` one-waypoint plan without `from` has no leg; `42_crosswind.js:70` never restores the injected world's wind; 40/41 rate filters difference unwrapped heading error; `43 departFrom` keeps `rollN/gaN/committed`.
- Generator: `clampSpec` not idempotent on `fuselage.tailY`; twinBoom predicate differs between 61 and 62; `GEN_DEFAULT.cabin.glazing` declared twice ('glass' then 'bubble'); the floats branch shadows `NM`; wing-twin bills one prop; tests mutate `GEN_RULES` without restore.
- Aero/hydro: `32_hydro.js:185` rho 1000 at sea (should be 1025); `62:1347`/`60:4781` `params.engine` IS the registry row by reference (no writer today); `00_registry.js:667` the PAVED row is labelled "// BISECT"; aileron fraction binary per strip (roll plaque is a step function of the slider); strip area at the centre chord; `POLARS` is dead.
- World: strip grading C0 at its bbox (feather 6 m short); `07_day.js:97` sunUp uses the refracted elevation vs the events' geometric one; climate relief raster never rebuilt on `groundVer`; landlocked basins below 0 m are "sea".
- Editor: `GARAGE_SPEC.load` drops images; `designMerge(out, over.spec \|\| over)` merges function-valued PLAN rows; `sweep: +full.wgSweep` is NaN; `cabin.pilots` written only when ≥ 1.
- Loop: `sim_link.begin()` on a live flight detaches without `dropFlight`; `frameWait` single slot; input panel can run two tick loops; materials never disposed in `setAircraft`; `aeroSetCraft` allocates two Matrix4 per frame; `AERO_BUILT` pool unbounded; `makeSkinBinding` throws on a one-sided WF/WR station.
- Release: version.json's date rewritten by every battery; syntaxCheck skips MANIFEST.world externals, lazy, worklets and the emitted sw.js; the inert-typing regex rewrites `<script>` literals inside inlined JS with no `</script` assertion.

## D. PHYSICS HONESTY (not bugs; rulings)
- D1 (major) **The deformation damper damps rigid rotation.** `30_solver.js:1352/1573` damps `v − v_mean`, and a rigid rotation is not in the mean. Measured in vacuum (rho 1e-9, no world, stock build): L/L0 = 0.607 at 1 s, 0.368 at 2 s, 0.135 at 4 s on roll, pitch and yaw alike = exactly exp(−0.5 t). A 2 s time-constant angular damper on every aeroplane, independent of aero: it masks dutch roll, spiral divergence and spin, and every pilot gain and rate-damping measurement (G115's yaw probe included) was tuned with it present. Honest fix: subtract the rigid rotation (ω from the inertia tensor about the CG) before damping, keep the damper on true deformation only — then re-anchor. It is a ruling because every flying gate moves.
- D2 No Reynolds or Mach dependence in the polar synthesis (`62:65-79`): a 0.2 m chord park-flyer flies the same section as a 1.5 m chord (real ClMax ~0.9 and Cd0 ~2× at Re 1e5). The ClMax thickness trend is wrong below ~12 %. Small builds' Vs and L/D on the plaque are optimistic.
- D3 No windmilling or stopped-prop drag: the thrust law floors at 0, so engine-off L/D (and the SOAR gate's sink) is optimistic by ~10–20 % on a Cub-class build.
- D4 The V-tail is two nodes and eight members with no spar truss; GATE LOAD's stab/fin rigs find no tags and measure nothing, silently.
- D5 `kScale` scales every member class off the fuselage row's refMass; `relump` migrates mass to light nodes and the ledger's CG snapshot hides it.
- D6 Pilots: `gustAt` reads the wind 30 s into the future (a forecast, exact because the field is deterministic); the ROLL hump logic reads the floats' hydrodynamic force vectors (solver internals).
- D7 Fleet-fit constants are labelled as such (kvisc 0.845, tail e 0.70, Munk K 0.75, tailEta 0.9, washSpread, the hydro's INFERRED set); the body cross-flow blobs are Cub-calibrated and the plaque's neutral point leans on them.
- D8 "Sea" is a sign test (base < 0) in two files, not connectivity: 49 landlocked components at seed 0 are sea level water with no connection.

## E. ARCHITECTURE
- E1 **The resolved spec is not a fixed point** (A2, B8, B13, tailY): `resolveSpec` mutates in place with additive offsets and `buildGen` writes derived gear fields back. A `_raw` kept on the resolved spec, or offsets consumed once, closes the whole family.
- E2 **Merge-by-absence is the editor's structural hazard** (A3, A4): the join is written "write when non-default", the garage keeps what the join omits. Either the join states every row it owns or the garage replaces the join-owned sections wholesale. The mapping tables also exist twice (`cageJoinSpec` and `designBake`, already drifted: `sweep`, the position list).
- E3 **No field registry** in 60_gen_spec: default, clamp, resolve rule and join write are hand-kept in four places; three findings are drift between them.
- E4 **Three pilots are forks** (~600 lines of servos × 3); G381, G630 and G352 fixes exist only in 43. If 40/41 stay shipped (they are player-selectable), the servos should be one module.
- E5 **Frame conventions are never cross-checked** core ↔ viewer: obstacles R(yaw), THREE rotation.y, premises F.yaw, aerodrome hdg (rad from +x), premises slope hdg (deg from +z) coexist; A6, B1, B4 are the cost. One tiny "same point, both frames" gate per registration site.
- E6 **app.js is a 12.4k-line IIFE with ~150 closure flags**; `running` is written at 9 sites with three meanings; the state machine (shed/stand/flight/card/editor/scenery) is implicit in flag combinations. Page/worker logic is duplicated by hand (`manualEnding`, `resyncPhase`, `mkPilot`, `applyRoute`). A8, B23, B24 are direct consequences.
- E7 **Gates test single changes, not combinations**: pusher+tricycle, offsets+shakedown, mixed material rows, on→off→commit, rotated strips. A cheap sweep (rank / NaN / zero-length / mirror over paired configurations, and the join round trip through "off") would have caught B10, B11, A3, A5 immediately.
- E8 **Delivery has no post-push check** (A1, B26–B28): the build is deterministic and content-addressed (the strongest part), but freshness of the committed outputs rests on discipline and nothing confirms the live build id.

## F. WHAT THE REVIEWER WILL FIX IN THIS BRANCH (small, local, after this report)
Candidates that are one to a few lines, do not move any anchored gate number, and are verified by a cheap gate: A6 (house yaw), A7 (dispose guard), A8 (camera reset), B15 (sea midnight wrap), B17 (undo cleared on specApplied), B23 (lazy-load catch/finally), B26 (`--only` guard), the `trqOf` debug line. Everything that moves a flown number (B1, B3, B4, B10, D1) and the deploy workflow (A1, an infra change) is left to the coordination session with the fix described above.

## G. GATE BASELINE
(appended when the core battery finishes on this machine)
