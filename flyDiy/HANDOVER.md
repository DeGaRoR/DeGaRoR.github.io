# GARAGE FLIGHT SIM — HANDOVER

Node-beam chassis + strip-theory aero flight sim. Six validated aircraft, one
solver, untouched since M1. Split into part files (src/) with a node build;
headless node gates that actually fail. This document carries everything the
code can't: conventions, hard-won rules, validation anchors, and the roadmap.

## SESSION RITUAL (PTIS-style, non-negotiable)
1. Read this file and the relevant code BEFORE editing.
2. One chantier per session. Trace-first debugging: measure before hypothesizing —
   this beat guessing in every single forensic episode of this project.
3. `node tools/run_gates.js` — rebuilds every generated file, syntax-checks every
   script blob, runs the **CORE** battery (~10 min), exits non-zero on any FAIL.
   **`node tools/run_gates.js --all` (~19 min) is the DELIVERY verdict** — core
   skips the reference fiches and says so in its summary. Never deliver on a
   non-zero exit, and never deliver on a core-only pass.
   (`node tools/build.js` for a standalone build; `--only=ID[,ID]`, `--verbose`,
   `--no-build` on the runner; `--only=` implies full, it is an explicit ask.)
   TIERS (2026-08-11, user call): the garage and the two mesh aircraft are the
   product and the hand fiches are reference that will eventually be replaced by
   procedural builds, so core = PA18 + C172 + GEN + FLEX + STRESS + UISMOKE +
   XCTY4 + the cheap world/skin/codec gates, and fleet = WIND, M3, DRONE, DC3,
   JODEL, CHINOOK, XCTY/2/3/5. The runner exports `GATES_CORE=1` so gates can
   scope themselves; FLEX uses it to measure the two mesh aircraft instead of
   all seven fiches (82 s -> 42 s).
4. New aircraft checklist: new `src/core/1x_aircraft_*.js` fiche + MANIFEST entry
   in `tools/build.js` + thin gate config (see any `test_*.js`) + entry in
   `test_stress.js` + `<option>` in the aircraft select in
   `src/viewer/body.html` + AIRCRAFT map entry in `src/viewer/app.js` +
   line in the fleet table below.
5. The GARAGE aircraft (`gen`) is GENERATED, not a fiche: its numbers move when
   the spec does. Never hand-edit its anchors — re-read them off GATE GEN's own
   SHAKEDOWN line. See THE GARAGE.

## FILES
Everything under `src/` is SOURCE. `tools/flight_core.js`, `index.html`,
`dev.html` are GENERATED — edit parts, never outputs; run_gates.js rebuilds
before every battery so stale hand-edits get overwritten, loudly.

- `src/core/00_registry.js` — RHO, POWERPLANTS/POLARS registries, PAR
  (rudderSign is live in the solver hot loop), wheel-friction consts CRR/MU_*.
- `src/core/10..16_aircraft_*.js` — one fiche per aircraft (cub, dc3, chinook,
  c172, jodel, drone, pa18). Fully self-contained builders; only POLARS is
  external. The ideal parallel-agent boundary: one agent per fiche, zero
  conflicts. The pa18 is a byte-copy of the cub geometry + flap physics and
  carries the 3D skin; the J-3 stays wireframe (may retire later).
- `tools/glb_inspect.py` / `glb_render.py` / `glb_extract.py` — the GLB branch
  of the model import (docs/MODEL-IMPORT-PROC.md Step 0b). inspect =
  world-space inventory + textures + animation channels; render = orthographic
  contact sheets, which is how parts get identified when the exporter has
  named everything `Plane.002_1`; extract = axis/scale convert, skip staging
  props, split fused L/R meshes, mirror missing sides → a plain OBJ the
  existing bake consumes unchanged. The mesh is carried through AS-IS; the
  extractor has no decimation and must not grow one.
  Per-model config: `tools/models/<key>_src.py`.
- `src/core/20_world.js` — makeWorld(seed): v1 world contract (terrainH/
  waterH/surface/tile/aerodromes/settlements/wind) + v0 shim (trees/meadows/
  CELL/wind/setWind) on one object. Seed 0 / no arg = the validated world,
  bit-identical to pre-contract; nonzero seeds coherent but unvalidated.
  See futureDesigns/WORLD-CONTRACT.md.
- `src/core/21_world_hydro.js` — bakeHydrology(sample, cfg): stage-1
  hydrology (priority-flood, D8, accumulation, river polylines, lakes,
  distance-to-water transform, O(1) carve/water queries). Pure +
  deterministic; exported for gates. As-built: WORLD-GEN-PROC stage 1.
- `src/core/22_world_biomes.js` — makeBiomes(deps): stage-2 analytic
  biome classifier (drives W.surface) + per-point tree placement
  (density, species 0-4, stand clustering). As-built: WORLD-GEN-PROC
  stage 2.
- `src/core/23_world_settle.js` — bakeSettlements(deps): stage-3 sites,
  organic road network (grown from the airfield), bridges, road-grading
  SDF, building footprints. As-built: WORLD-GEN-PROC stage 3.
- `src/core/24_world_aero.js` — bakeAerodromes(deps): stage-4 town
  fields + fly-in backcountry strips, oriented grading SDF, surface
  patches, tree exclusion, AP-ready registry records. As-built:
  WORLD-GEN-PROC stage 4.
- `src/core/30_solver.js` — makeSim: node-beam solver + strip aero + ground.
- `src/core/40_autopilot.js` — makeAutopilot: 9-phase circuit FSM.
- `src/core/50_model_codec.js` — flexbody skin codec (decode, spanwise flex
  binding, control-surface hinges, visual linkage). Pure JS, no THREE; ported
  byte-identical from the flexbody branch except the linkage's flap channel.
  See docs/SKIN-PROC.md.
- `src/core/6x_gen_*.js` — THE GARAGE: procedural airframe generator. One
  parameter spec drives both the structure and the covering, so there is no
  second place a number about a generated aeroplane lives. `60_gen_spec.js`
  schema/materials/defaults + resolveSpec (nulls mean "derive it") + clampSpec;
  `61_gen_frame.js` the lattice, and where the STRUCTURAL RULES below are
  enforced by construction; `62_gen_aero.js` strips + polar synthesis from the
  NACA digits; `63_gen_skin.js` tubes/panels/formers/wing loft in the
  decodeModel shape, with per-vertex node weights; `64_gen_build.js`
  `buildGen(spec)` + the tunnel trim + `genShakedown()`. See the GARAGE
  section below.
- `src/core/90_node_exports.js` — guarded module.exports (inert in browser,
  inlined as-is; keep it single-statement, no nested braces).
- `src/models/` — GENERATED baked model payloads (tools/model_prep.py output;
  never hand-edit). Inlined via build.js MODELS slot; NOT part of
  tools/flight_core.js, so `node --check` and the node gates don't parse
  781 KB of base64 twice per build.
- `assets/pa18/` — the PA-18 source model (OBJ+MTL+textures, helijah;
  see CREDITS.md). `docs/` — MODEL-IMPORT-PROC.md + SKIN-PROC.md.
- `src/viewer/` — shell.html (slot markers), style.css (theme + vendored
  @font-face), body.html (UI markup), render_world.js (buildWorldScene — the
  whole 3D world look lives here), hangar.js (the GARAGE's room: a procedural
  shed with its own lights and four moods, built on demand and only if THREE can
  carry it — see G6), garage.js (the builder's panel + the procedurally baked
  paint — anything needing a canvas, which core cannot use),
  app.js (renderer, camera, aircraft mesh, shadow proxy, phase rail, HUD, loop).
  MANIFEST.viewer.scripts: the LAST entry fills the APP slot, everything before
  it fills RENDER.
- `tools/build.js` — MANIFEST is the single ordering authority (registry →
  fiches → world → solver → autopilot → exports). Concats core →
  tools/flight_core.js (gates require it unchanged); assembles `index.html`
  (single-file artifact: three.js + fonts + everything inlined, zero external
  requests) and `dev.html` (plain <script src> refs — edit a part, refresh the
  browser, no build; regenerate only when markup or MANIFEST changes).
  All slot substitution uses replacer functions ($-pattern safety).
- `tools/run_gates.js` — gate runner; `tools/circuit_harness.js` — shared
  circuit pipeline; `test_*.js` — thin per-aircraft configs + stress + tree
  + the flexbody battery (test_model/skin/ctrl/ui_smoke/pa18).
- `tools/test_flex.js` — GATE FLEX, the structural-realism instrument. Not a
  bound: it measures deflection/g, torsion, softness and load margin against
  real-aeroplane figures and prints both. Read STRUCTURAL REALISM before
  changing any `k`, `c` or strain threshold on the strength of an impression.
- `tools/make_perf.js` — FLEET PERFORMANCE instrument: static thrust, Vs, Vmax,
  best climb, best glide and the FLOWN takeoff run to 2.5 m agl, for all eight
  aircraft. This is where the FLEET & VALIDATION ANCHORS rows are re-read from;
  before it existed those numbers had no instrument and could only be hand-edited,
  which is the one thing the session ritual forbids. NOT a gate: no verdict line,
  no bounds. `--json` for A/B diffing across a physics change. See G4.9.
- `tools/make_probe.js` — renderer measurement instrument (hand-pumped frames,
  GL draw counters, before/after against the previous commit's viewer, and
  handles on scene/renderer/camera/WF that are otherwise sealed in app.js's
  closure). Not part of the artifact; output is gitignored. See TREE FIELD for
  why it has to exist.
- `tools/model_prep.py` (generic bake, needs Pillow) + `tools/models/<key>.py`
  (per-model config: groups, SURFACES hinge table, texture settings) +
  `tools/model_inspect.py` (OBJ inventory + hinge-line probe). Procedure:
  docs/MODEL-IMPORT-PROC.md.
- `vendor/` — three.js r128 PINNED (renderer code targets r128 APIs; do not
  upgrade casually) + IBM Plex woff2 (latin).
- Multi-agent etiquette: core agents own `src/core/`, viewer agents own
  `src/viewer/`, either regenerates via build.js. Fiche agents never touch the
  solver; solver changes re-anchor the whole fleet table.

## GATES
Verdict contract: every gate prints exactly one final `GATE <ID>: PASS|FAIL`
line and sets a non-zero exit code on failure; the runner requires BOTH.
Failed checks are listed by label. Gates use PERTURBED starts (lateral offset
+ velocity noise) on purpose: symmetric ICs mask directional instabilities.
The battery is deterministic — full-output log diffs are a valid checkpoint
and the cheapest regression instrument this project has.
The harness auto-appends a settle-uprightness check (max lateral node drift
from def geometry after settle, net of the perturbation shift, < 0.25 m) —
added after the chinook flew a whole green circuit with its tail folded.
Runtimes: WIND dominates (~150 s), then DC-3 (~55 s); full battery ~5.5 min
(+~2 s WORLD). Those are quiet-machine numbers and the whole battery scales
with load — measured 2026-08-08, the SAME committed core ran M3 in 10.5 s and
14.0 s hours apart. The per-gate spawn timeout is therefore 900 s, not the 300 s
it was: WIND reached 297 s on a busy machine and the battery went red with no
failed check to point at. A timeout is not a verdict. If timing itself is the
question, A/B the two cores on the same machine minutes apart (`git show
HEAD:flyDiy/tools/flight_core.js`, swap, `--only=<gate> --no-build`, swap back)
— an absolute number from a previous session proves nothing.
GATE GEN (after STRESS) audits a GENERATED airframe rather than a fixed one:
symmetry (nodes, beams AND masses — an asymmetric mass flies a wing low),
orphans/duplicates, a full RIGIDITY test (rank 3n-6, which is the real form of
structural rule 4 — see THE GARAGE), mass/CG/static-margin bounds, the two
geometric gear constraints, determinism by double-generate, fiche-schema
completeness, skin/structure coherence (every skin vertex an affine blend of
nodes that exist), a clampSpec envelope probe with deliberately wild inputs,
the parked-tailwind dwell, and the standard full circuit.
GATE FLEX (appended LAST, ~2.5 min) is the structural-realism instrument, and
the only gate in the battery that measures rather than bounds. Two halves.
FLEET: tip deflection per g as % of semispan, STATIC torsion under an
antisymmetric tip couple at two torques, the confounded in-flight torsion beside
it, `k` against `EA/L`, and peak member load against `sigY*A`, over all seven
fiches and all four generated materials, printed against a reality column.
GARAGE MATRIX: the same static instruments across 26 points of the generator's
configuration space (span 7-14, panels 2-5, three wing positions, both bracings,
four materials, cargo).
**The DOUBLING RATIO is the load-bearing measurement in both halves** — a linear
structure twists twice as far under twice the couple, and anything materially
under 2 started near a mechanism. It condemned the chinook wing AND found the
strut fan skipping stations at 4-5 panels; the rank test sees neither, because
the framework stays infinitesimally rigid throughout.
Verdict: finiteness, determinism, and `doubling >= 1.80 everywhere`. Deflection
bounds are still NOT asserted — they would be preferences until argued about.
See STRUCTURAL REALISM.
GATE LOAD (appended after FLEX, ~16 s) is the SANDBAG TEST: FAR 23 normal
category limit (+3.8 g) and ultimate (+5.7 g), bags over the wing strips,
fuselage bolted to the rig, deflection from the unloaded jig shape, for all four
materials x both bracings plus the two mesh aircraft. It asserts survival,
monotonicity and LINEARITY (3.8 g of bags must give 3.8x the deflection — the
check that caught three broken versions of the rig); the yield margin is
reported, not gated, because the allowable is a class average and the
worst-loaded member is usually the lift strut. `LOAD_JSON=1` dumps the
measurements on stderr so a report page is built from the gate's own numbers.
See GATE LOAD under STRUCTURAL REALISM.
GATE XCTY4 (~32 s) is the W13.2 short-field leg: PA-18 HOME -> Stein
(340 m gravel fly-in) in the viewer BREEZE preset — touch in the first
40%, bounded skip, on-strip stop, UPRIGHT tail-down, tail rig intact.
GATE C172M (appended after PA18, ~2 s) is the second skin's contract:
payload decode, span/length, tricycle mount calibration at BOTH gear ends,
hinge axes (unit + aero-consistent signs) for the non-cardinal C172 hinges,
nose-gear steering across four payload groups, flex-band containment and
L/R symmetry, and that the strut fittings ride the wing while the fuel caps
stay rigid. The pa18's MODEL/SKIN/CTRL gates are untouched.
GATE WORLDRENDER (~3 s) is the only coverage render_world.js has — UISMOKE
stubs buildWorldScene out entirely — and runs the real builder against a THREE
stub that records what gets created. Its renderer stub carries the whole
draw-state surface the two boot-time bakes touch, so both the impostor atlas
loop and the W18 environment bake RUN (they render nothing, but their plain-JS
half is covered): the gate asserts the PMREM is built exactly once, that
scene.environment ends up holding it, that the env scene has its dome and its
ground, that the generator is disposed, and that every atlas tile got its own
viewport. It holds the chunked-instancing invariants
(every instance inside the sphere its chunk is culled by, culling left ON,
sphere bigger than a chunk, instances stored chunk-LOCAL) and, since W17, the
LOD ladder: both tiers hold the same trees, impostors cast no shadow, every
shadow-casting chunk carries the depth-material cull, the shape sphere the
impostor bake reads is tree-sized rather than the chunk ball, and the tiers
actually switch by distance. The bake itself is GL and cannot be gated headless
(the stub renderer has no setRenderTarget, so the atlas comes back
texture-less); what is gated is the bookkeeping around it, which is where the
cull bugs live.
GATE AERO (appended after SETTLE, ~2.5 s) holds the stage-4 invariants:
counts/size mix, centreline flat + slope, dry, tree-free boxes, surface
patches, tdz on pad, reachable-or-fly-in, spacing, determinism.
GATE SETTLE (appended after BIOME, ~1 s) holds the stage-3 invariants:
settlement sanity/spacing/dry, road-graph connectivity, bridges on water,
cross-slope bound, pad clearance, buildings sane + tiled, tree clearance,
determinism, bake budget.
GATE BIOME (appended after HYDRO, ~1 s) holds the stage-2 invariants:
surface distribution + classifier semantics, trees only on grass/forest
floor, species diversity + stand clustering, riparian ratio, exclusion
zones, determinism, classifier perf.
GATE HYDRO (appended after WORLD, ~1 s) holds the stage-1 invariants:
river termination, monotone water surfaces, beds below water, bounded bank
slopes, pad/meadow-core dryness, hydrology determinism, A0 sweep, bake
budget.
GATE WORLD (appended last) freezes the seed-0 world with golden hashes
(101² terrain grid + all tree records + meadows + exact anchors, captured
from the pre-contract build) and checks determinism, the tile/treesNear
contracts, aerodrome invariants and the terrainH perf budget. **Any
intentional terrain change must re-capture the goldens (snippet in
WORLD-CONTRACT §4) in the same commit, with the change explained.**
Flexbody gates (appended, keeping the physics log prefix diffable): MODEL
(payload decode + wheel calibration), SKIN (flex binding), CTRL (hinges +
linkage), UISMOKE (executes the built artifact's core+models+app blocks in a
node vm with DOM/THREE stubs — the vendor and render blocks are deliberately
NOT executed, buildWorldScene is stubbed), PA18 (flapped circuit).

## AXES & SIGNS (the rudder saga lives here — reread twice)
- x AFT (nose = −x), y UP, z... **+z is physically the LEFT side** when the nose
  points −x. zRt = yUp × xAft is true right.
- Probe: +pitchUp = nose-up (= −Mz), +yawLeft = nose-left (= +My).
- Controls: dr>0 = nose-left, da>0 = roll-right, de>0 = nose-up.
  Track error e>0 = left of target.
- **MEASURE SIGNS EMPIRICALLY** for anything new. Elevator sign probe and the
  nosewheel taxi test are the templates. Never derive a steering/control sign
  from reasoning alone; both times we tried, we were wrong.
- Nosewheel steering (C172) needs OPPOSITE twSteer sign vs tailwheel (steered
  wheel ahead of CG yaws opposite). Verified by taxi test.

## SOLVER INVARIANTS
- Semi-implicit Euler; deformation-only damping (DEFDAMP 0.5, relative to
  mass-weighted mean velocity).
- Per-aircraft substeps in params.substeps (Cub 24=1440Hz, drone 48, Jodel 48,
  C172 48, DC-3 72, Chinook 48). Stability: omega·dt = sqrt(2k/m)·dt < ~0.6,
  AND damping c·dt/m < ~0.3. The Chinook boom exploded at K=1.5e6 despite
  omega·dt≈0.5 — keep real margin, light nodes bite.
  The viewer calls `sim.step(1/60)` with NO substep argument — never hardcode
  one there; that once destabilised 5 of 6 aircraft in a prototype.
- Ground contact per-node, mass-scaled PIECEWISE (preserves old fleets exactly):
  `KGn = m<=6 ? min(9e4, 2.5e5·m) : 1.5e4·m` ; `CGn = 1.6·sqrt(KGn·m)`.
  The DC-3 buried its wheels half a meter before the heavy branch existed.
- Thrust: per-engine. `Tper = thr·max(0, Ts − kV2·V²)`, `T = nE·Tper`,
  wash from Tper and single-disk area. Registry values are PER ENGINE.
- Strip forces at c/4 via 0.80/0.20 front/rear spar weights (spars at 15%/65%
  chord); chord/span dirs from LIVE node positions (aeroelasticity is emergent —
  and so are its failure modes, see structural rules).
- Wing incidence = rear spar lowered by 0.5·c·tan(incidence). Chord-vector tilt
  gives the alpha; verified sign.
- wheelsOnGround is terrain-aware (uses world.terrainH; world may be undefined
  in tunnel-only makeSim calls — null-guard anything new that touches it).
- Latent debug hooks on `sim.out` (trq/trqAero/trqTotal, dump, gndDump,
  trqDebugOnce) are used by ad-hoc tuning scripts — don't prune.

## STRUCTURAL RULES (each one paid for in blood)
1. **Spar box always.** Planar wing + shallow fan = snap-through fold (drone).
   Anchor offset sets the barrier; the Cub survives only because its strut root
   is a full meter below the wing.
2. **Full-depth TWO-spar torsion box for anything that cruises fast.** Front-box-
   only = elastic axis ahead of AC = aeroelastic washout (DC-3, 60% lift loss)
   or torsional divergence at a specific speed (Jodel, 54 m/s, just under
   cruise). No exceptions anymore.
3. **Box depth through the root.** Both chords to one fuselage node = zero couple
   arm = the biggest moment in the aircraft through a point (DC-3 squat). Keel
   nodes through the belly (DC-3, Jodel).
4. **Every quad panel needs its diagonal.** Missing bottom drag truss = mechanism:
   geometry moves 0.5 m at <1% member strain (DC-3). If a settle test shows big
   shape change with tiny strains, hunt the unbraced parallelogram.
5. **Slender bays are geometrically soft** regardless of k: web diagonal vertical
   fraction = depth/bayLength. Densify stations before cranking stiffness.
6. **A line of nodes has no bending stiffness.** "Single pole" = small triangular
   tube (Chinook boom, drone boom).
7. **Gear needs a longitudinal (drag) load path** anchored well fore/aft of the
   axle, into HEAVY nodes — never into light keel/box nodes (Jodel: keel link
   crushed 25% and latched folded).
8. Attitude reference frames (refs.noseFrame/tailMid) go on RIGID structure,
   never on flexible booms (drone: boom whip fed theta noise fed elevator fed
   boom whip).
9. Material strain limits (empirical fleet table): steel/alu chassis ~6%,
   wood 6%, fabric+tube 11.5%, foam 16%. Gear beams separately, ~40%.
   **These are 15-30x the real elastic limits** (4130 yields at 0.22% strain,
   spruce crushes at 0.36%, 2024-T3 at 0.47%, carbon UD breaks at 1.1%) and that
   is not a bug in the table — it is the honest record of a lattice whose `k` is
   softer than `EA/L` by x5-20 through the wing, x39-85 through the fuselage and
   x300-900 in the gear (the last deliberately: it is the suspension). Do NOT
   tighten them to look realistic; measure with GATE FLEX instead. And note the
   measured consequence is milder than that arithmetic suggests — tip deflection
   comes out 2-7x a real aeroplane's, not 40x, because a lattice spreads the
   load. See STRUCTURAL REALISM.
10. **Near-axial truss chains have second-order torsion/lateral stiffness and
   can LATCH.** The Chinook tail fell on its side and stayed there with every
   structural strain under 0.8% — no strain gate can see a mechanism. Reset
   levels the aircraft on its mains, so a taildragger's tail slams down
   through the full deck angle every reset: that impact is what kicks
   latch-prone geometry over its catch point (chinook boom torsion; drone
   tailwheel tripod folding UP until the bare tail post rested on the
   terrain; cub/pa18 2026-08-04: PARKED IN A TAILWIND after the slam, the
   tailwheel folded up-and-SIDEWAYS about TPB and latched at 4% strain —
   the wind gate never dwells parked, the W13 viewer wind presets do; the
   rigid skin then showed the tail diving below ground). Cures are
   geometric and need MEASURED trials (probe with a lateral force, release,
   check elastic return): wide triangulated anchors
   (fin<->stab wires + stab<->tailwheel pyramid + boom->wing-box wires), a
   snap-blocking near-vertical member (drone TW->TPT), never more K. The
   cub/pa18 needed BOTH: TW->TPT alone left a shallower lateral latch;
   TW->HTL/HTR (the pyramid) killed it — dev <3.5% through fresh-wind
   dwell, elastic. GATE WIND now ends with W-PARK-PA18/CUB (12 s parked
   in the viewer breeze, tail-rig deviation <10%, post stays up). Wires
   that anchor to strip-force-carrying nodes re-rig the aeroelastics — anchor
   to box nodes (WB) and keep them soft.
11. **A near-mechanism shows as a NON-LINEAR load/deflection response, and
   nothing else in the battery can see it.** Rank is necessary, not sufficient
   (rule 4's own lesson); strain gates cannot see it (rule 10's); and a single
   load case cannot either, because the structure is stiff by the time you
   measure it. Apply the load at TWO magnitudes: a linear structure doubles its
   deflection when you double the load, and a doubling ratio materially under 2
   means it stiffened geometrically on the way, i.e. it started near a
   mechanism. Measured, this found three defects nothing else had: the chinook
   wing (16.4 deg @200 N.m at 1.50x), the generated strut fan at 4-5 panels
   (21.4 at 1.56x / 28.7 at 1.46x) and the cranked generated wing (22.9 at
   1.34x). GATE FLEX runs it as an antisymmetric tip couple — self-equilibrated,
   so no aerodynamics and nothing accelerates — and asserts >= 1.80 across the
   whole garage configuration space.
12. **A strut fan must reach EVERY spar station.** It is the lumped stand-in for
   a box the planar wing does not have (rule 1), so a station it skips is a
   station with no barrier. The generated fan covered `0`, `mid` and `last`:
   exact at three stations, leaking at four or more — and station count is
   driven by TWO independent inputs, `panels` AND `crankAt`. Any new planform
   feature that inserts a station leaks the same way; put it in the GARAGE
   MATRIX. Corollary, paid for: the cure does NOT extend to a cranked outer
   panel, because a stiff member from the fuselage to a station well up the
   crank re-rigs the aeroelastics of strip-force nodes (rule 10) and the
   aeroplane stops flying. A cranked wing gets the box instead.

## AUTOPILOT RULES
- **Gains scale with airframe timescale ~ span/V.** Cub 0.41, DC-3 0.41,
  C172 0.22, Jodel 0.17, drone 0.03. Wrong-scale D-gains create slew-rate
  limit cycles (drone pitch ±9° @2.3Hz; Jodel roll; C172-class chatter).
  The cure is always LOWER D + command slew, not more filtering.
  W16 lateral quiet (2026-08-04, user report "PA-18 rocks L/R 2-3x/s"):
  cub/pa18 rode the DEFAULT rollD 2.0 on the RF-lagged rate estimate —
  aileron limit-cycled 8-12 deg p2p at ~4 Hz (bank ~1 deg: surface flail
  + wing rock, obvious on the skin). Fiche rollD 0.8 kills it to 0.2 deg;
  a FASTER rate filter makes it WORSE (measured 13 deg) — the doctrine
  holds. The Jodel was a different disease at the same symptom: 11 deg of
  REAL bank at 1.8 Hz with rollP 1.1/rollD 0.30 — aileron-LOOP unstable
  (freeze test: ailerons frozen -> dead calm; rudder frozen -> unchanged,
  so NOT dutch roll; raising servo slew made it worse). HARD-WON second
  half: quieting the roll loop ALONE trades away capture + decrab —
  rollP 0.4 landed 11-13 m off centreline (calm gate bound 5.5) and the
  pure-roll candidate P0.7/D0.20 drifted -6.3 m/s through the crosswind
  touchdown (bound 1.8). The fix is a PAIR: rollP 0.5 + rollD 0.15 for
  quiet, hdgP 0.5 -> 0.65 so the course loop carries what the roll loop
  gave up — final numbers BEAT the old gains (calm tdZ 2.4 vs ~3;
  crosswind drift -0.24 vs -1.64, tdZ 2.9 vs -6.9). Wind response after
  all fixes: slow gust tracking, no cycles (bank p2p 0.7 pa18 / ~4.5
  jodel in 3 m/s + gusts). MEASURE with the zero-cross instrument
  (scratch osc probe) before and after any lateral gain change — the
  circuit gates do NOT see cruise smoothness, and cruise-quiet probes do
  NOT see capture/decrab: run BOTH.
- Trim-heavy stable aircraft need pitchI authority (DC-3: 0.05 → 0.25).
- **W10 runway frames (contract rule 6 DONE)**: all along/cross geometry
  runs in a runway frame {origin, unit axis} from a W.aerodromes record;
  the frame puts the tdz at s=-450 so fiche xTurn/xAim/gs transfer to
  ANY strip unchanged. Axis components are snapped: the HOME frame is
  exactly s=x, cross=z and the whole battery was NUMBER-IDENTICAL
  through the refactor. makeAutopilot(sim, def, world) + ap.setRoute
  (from, to); cross-country replaces TURNBACK with ENROUTE.
  HARD-WON, in order: (1) an "s > xTurn" arrival handoff is a trap from
  abeam (along-track instantly inside while cross-track is km out) — fly
  to the approach FIX at (xTurn-1200, 0) instead; (2) the terrain guard
  must sample along the LEG TRACK, not velocity (at the turn, velocity
  still points down the old leg while the belt rises on the new one:
  1 m clearance measured), densely (1.5 km gaps let warped ridges slip
  through: 16 m), with a 7.5 km horizon; (3) the fleet cannot outclimb
  the belt head-on — ENROUTE climbs FIRST on the flat climb-out heading
  until within 60 m of the leg altitude, then turns; (4) high fix
  arrivals need INBOUND to descend onto the slope (min(hCruise, hGS+15),
  clamp -3.5, APPROACH gated to cg-hGS<40) or they overfly forever;
  (5) fiche aim points assume 1100 m of runway — clamp xAim inside the
  destination threshold + 40 m on xc arrivals (C172 touched grass 28 m
  short of a 650 m strip). All five no-ops for standard circuits.
- **W13.2 short-field arrivals (fly-in benches, len < 450)**, hard-won in
  order: (1) the landing DIRECTION is picked INTO THE WIND when |wind| >
  0.7 at the destination (else by leg bearing as before) — a quartering
  tailwind at Stein bounced/veered/nosed-over every arrival; (2) the aim
  must come from the ACTUAL approach threshold of the chosen frame
  (sThr = sCentre - len/2): the old "-450 - 0.25*len" assumed the
  record's canonical direction and aimed 0.5*len (195 m at Stein) deep
  on flipped arrivals — identical for canonical frames, so calm gates
  held; (3) the APPROACH VS feedforward must use GROUNDSPEED (-Vg*gs):
  -V*gs in a headwind commands W*gs too much sink and the +0.5 clamp
  never closes the standing low (5.6 m under the slope at the Stein
  threshold, touch 83 m short of aim). Identical in calm; (4) full-aft
  rollout pin AT TOUCH SPEED re-flies a flapped taildragger (3 m balloon,
  18 deg nose-up, 4 s — HOME's 1100 m always absorbed it): thPinMax
  relaxes the pin above ~3-point attitude, VPinFull (fiche, pa18 16)
  holds moderate aft until below flying speed; (5) short strips fly
  A.VApprShort (pa18 18.5 = 1.37*Vs flapped; cub 18.8 = 1.25*Vs floor)
  and aim sThr + 75 (measured touch scatter -50..+20 about the aim).
  GATE XCTY4 = the original user repro (PA-18 HOME -> Stein, breeze) and
  asserts touch point, bounded skip, on-strip stop AND upright attitude —
  the first assertion set that would have caught the nose-over. The J-3
  at 340 m remains marginal (flapless float: calm overruns ~90 m) —
  honest envelope limit, fly the PA-18 into short benches.
- holdPitch command filter thCA re-syncs to current attitude on re-engage
  (holdWas/holdActive) — its zero-init once nosed the DC-3 over at Vr.
  FIXED in W14 (2026-08-04): holdWas updates per-frame at the end of
  ap.update, so the resync fires after ANY holdPitch gap. For manual
  controls, ALSO call ap.reEngage() on AP re-engage: it re-latches every
  filter/integrator/servo memory from the live state on the next update
  (the manual-flight gap leaves them stale even with the resync fixed).
- Guidance is pure pursuit; **lookahead must scale with turn radius**
  (lookRoll/lookAppr/lookCruise per aircraft). DC-3 flew 600 m weaves with
  Cub lookahead.
- Takeoff classes: fly-off (Cub/drone/Chinook), rotate w/ tail-up sequence
  (DC-3: thTailUp then thRotate, CAPPED BELOW DECK ANGLE — a taildragger
  cannot rotate past 3-point, the tailwheel wins over full elevator),
  trike (C172: VTailUp=99 disables tail-up; rotate lifts nosewheel).
- Landing classes: attitude-ramp flare (Cub), VS-targeted flare (fast VS loops:
  drone/Jodel/C172/Chinook, params flareMode/flareThr/flareThMax),
  wheel landing (DC-3: flareThMax BELOW L=W attitude kills float),
  trike rollout (rolloutMode:'trike': hold attitude, derotate at VDerotate,
  brake only nose-down — full-aft at flying speed re-launches the aircraft).
  Flapped taildragger rollout: VTailDown (default VTailUp) — above it the
  taildragger rollout holds the tail UP; the PA-18 sets 99 (pin the tail from
  touchdown) because flap lift + dCm0 turned the tail-up hold into a −25°
  noseover in the crosswind gate.
- Approach: glideslope needs DECEL MARGIN vs idle equilibrium (gs below the
  idle-balance slope, thrFloor param) or overspeed persists forever (DC-3 74 s
  float; Jodel; C172). Clean airframes gain energy downhill.
- AP flies 1.25·Vs approaches. 1.13·Vs stalled the Chinook into a −79° drop.
- ARI (ariK) is DESTABILIZING on high-effective-dihedral wings (Jodel 14° crank:
  aileron→rudder→sideslip→dihedral→opposite roll positive feedback; proven by
  ablation). Jodel ariK=0.
- TURNBACK and INBOUND both use speedThrottle(A.VTurn ?? fallback) — the
  hardcoded-24 and VCruise-in-TURNBACK bugs are fixed; keep phase speeds in
  the fiche. **CORRECTED W19**: only TURNBACK was fixed. INBOUND still
  carries the literal `?? 24`, and the GENERATOR never emitted VTurn at all,
  so every garage build flew the Cub's turn speed whatever it was — 0.6x trim
  on a 39 m/s build (throttle to the floor, 100 m lost over the leg, the last
  1.5 km at 1 m agl) and 1.04x on a 23 m/s one (full throttle, float, touch
  240 m past the aim). genTuneAP now emits VTurn, so the literal is reached
  only by cub/pa18/drone, which is the family it was tuned on.
  **DO NOT "make the default explicit" in those three fiches.** TURNBACK and
  INBOUND read the SAME key with DIFFERENT fallbacks — VCruise and 24 — so
  those aeroplanes fly 26/26/13 on the turnback and 24 on the inbound, and no
  single VTurn value can express that. Writing `VTurn: 24` into them was
  tried: it silently moved TURNBACK and took the drone's elevator chatter
  from 0.3 to 5.5 deg/s, the M3 stop 1 m and the PA18 stop 5 m.
- Balked-takeoff guard requires LOW SPEED (V < 0.9·VRot), else wheel-brush
  during liftoff flickers ROLL/LIFTOFF forever.
- **W19 GARAGE OUTER LOOPS (2026-08-13)** — user report: "the autopilot
  struggles with the garage builds; it keeps climbing forever, lands several
  hundred metres away from the fields". Root cause was NOT a tuning slip:
  `genAP` emitted 34 keys, the autopilot dereferences 69, and the other 35
  fell through to `??` defaults that are the CUB's — as did the dozen circuit
  constants genAP hardcoded. `genTuneAP` (62_gen_aero.js) now derives them
  all from the tunnel, method exactly as GEN_LOOP: propose a dimensionless
  ratio, tabulate the seven fiches, adopt only if it CLUSTERS, and say so
  where it does not. Instrument: `tools/gen_ap_probe.js` (asserts nothing).
  Ratios that cluster, measured: VTurn = (VCruise+VAppr)/2 (0.987 ± 0.067,
  the tightest in the set, and it retrodicts the literal 24);
  climbThBase = 0.60·thMax (± 4.7%); lookAppr = lookCruise/1.45 (± 4.4%);
  thMax = 0.67·aStall (± 6%); liftoffTh = 0.79·thMax (± 6%);
  flareAgl = 3.2·VAppr·gs (± 12% — every fiche flares ~3.2 s out);
  hSafe = 0.125·hCruise; hCruise = 7·Vs; xTurn from 1.2·hCruise/gs.
  Derived rather than fitted: thrFloor from idle-thrust-over-weight (0.0125
  ± 0.0035), gs = 0.55·gsIdle (0.574 ± 0.13 — the decel-margin rule made
  numeric), thrAppr exact from the approach drag, vsFloor as a REACHABILITY
  condition on holdVS's pitch clamp. NO CLUSTER, fallback taken and labelled:
  lookCruise (time 2.7x, turn-radius 5.7x — the DC-3 and C172 have the same
  V and the same R and lookaheads of 900 vs 450), xAim, climbThGain, rollDe,
  altVSGain, vsP/vsI absolute, VBrakeOn, yawDampK, pitchI (deferred).
- **W19 traps, in the order they cost time:**
  1. **An airframe failure is not an autopilot failure.** Three of the first
     eight probe specs could not stand up or could not fly: `onWheels` is an
     ATTITUDE check (both axles within 6 cm) and reads false for a healthy
     nose-high trike — the collapse instrument is `gearFolded` (susShift,
     geometric). And changing a wing alone walks the static margin out of
     GATE GEN's own 5-35% band (a 6.5 m wing reads 43%, the radial 68%), so
     every probe spec now carries the `wings[].place.dx` that rebalances it.
  2. **"Climbs forever" was not the vsFloor pin** (that is the chinook's, and
     real). CLIMB had exactly ONE exit — reaching hCruise — so an aeroplane
     that could not reach the Cub's 100 m stayed in it until the clock ran
     out: 286 s measured on a short-span build, 350 s on a 28 hp one. Fixed
     two ways: hCruise is capped by 90 s of the build's own measured climb
     gradient, AND CLIMB now accepts the height it has after 60 s below
     0.15 m/s. Fleet-unreachable (they climb 3-5 m/s, topping out in 14-47 s).
  3. **Partial fixes are worse than none.** Fixing VTurn alone took a fast
     build from "stumbles into a landing 2.8 m off" to "142 m off at 10.7 m/s
     sink", because holding altitude EXPOSES the cross-track the ground
     skimming was hiding. Land the energy fix, the lateral fix and the
     INBOUND guard together.
  3b. **The three "no-op" guards were NOT no-ops, and only the battery said
     so.** All three faults were in the same direction — a threshold that
     looked obviously safe against the Cub and was not safe against the
     drone, whose whole circuit is 60 m and whose INBOUND speed is 2.7x its
     VAppr. (i) `VTurn: 24` in the fiches, above. (ii) A ground floor at
     `max(hSafe, 25)` forced a climb in the middle of the drone's INBOUND
     descent — it is `hSafe` alone, which is already per-aeroplane. (iii) An
     overspeed go-around at `V > 1.35*VAppr` fired TWICE on the drone, which
     reaches 1.48 (cub 1.11, pa18 1.16); the trigger was removed rather than
     retuned, because a genuine float is caught by the FLARE timeout without
     any speed threshold. MEASURE THE MARGIN ON THE DRONE, not the Cub,
     before calling a new autopilot condition fleet-unreachable.
  4. **MEASURED AND REJECTED**: flareMode 'vs' for generated fiches, which is
     what drone/Jodel/C172/Chinook all carry. Every sink got WORSE (stock
     1.13 -> 1.63, heavyLoad 2.53 -> 3.39) even with the VS loop moved onto
     the fast family to fly it. What actually helped was sizing the ramp to
     REACH flareThMax in 1.5 s instead of just arriving at it by the end of
     the flare: worth 1.3-1.9 m/s of sink.
  5. VCruise is solved from the power curve (drag = 0.65·Tavail), which
     guarantees thrCruise ~0.65 and so authority in both directions — the old
     flat 1.71·Vs left builds pinned at the 0.95 clamp with nothing to climb
     on. The clamp is [1.55, 2.2]·Vs and NOT the fleet's own 2.68: at 2.8 the
     radial build solved to 69.7 m/s and flew a 1037 m wide circuit.
- **W19 autopilot-side gaps** that no parameter value can cover, all
  fleet-unreachable by measured margin: (1) INBOUND past the aim was a
  PERMANENT TRAP — hGS collapses to refAlt, hTgt to refAlt+15, and the
  APPROACH handoff is gated on d > 0, so the aeroplane levelled at 15 m agl
  and flew straight on for ever (fiches hand off at d = 800-4200 m);
  (2) no go-around existed anywhere — `GOAROUND` now triggers on high-on-slope,
  overspeed, an endless flare or past-the-aim, capped at 2 attempts, and
  rejoins outbound so the whole arrival is re-flown; (3) no ground floor on
  the cruise legs (a build flew 1.5 km of INBOUND at 1 m agl and nothing
  objected; fleet minimum on those legs is 87-90 m).
- **W19 the garage now reports what it cannot fix**: `flyableCircuit` in
  genShakedown (climb rate >= 0.3 m/s against the fleet's 3-5, TORun <= the
  1100 m runway) and `apprTrimFail` / `landsFlapless` from a measured
  elevator-to-trim-on-final budget of 0.18 (fleet worst is the Jodel at
  0.118; half the servo stop). Reported, never enforced — same doctrine as
  noseOver and gearFolded. A 28 hp two-seater reads 0.09 m/s and TORun
  1508 m: it runs off the end of the strip and mushes at 1 m agl on full
  power, and no autopilot can fly that.

## WORLD
- Stage 4 aerodromes since W9 (2026-08-04): W.aerodromes now carries 12
  records — HOME + 3 meadows + 5 town fields (Morford 900 m PAVED, four
  grass 480-650 m, all within ~80 m of a road) + 3 GRAVEL fly-in
  backcountry strips (all on archipelago benches at seed 0 — post-warp
  mountains are too rough, honest). Strip grading composes into terrainH
  (carve-depth-masked like roads: never fills river beds), tree
  exclusion +30 m, PAVED/GRAVEL surface patches live, tdz + hdg ready
  for the AP session. Registry STILL DESCRIPTIVE for the AP.
- Domain warp since W7 (2026-08-04): IQ-style warp (2-octave channels,
  320 m field / 700 m masks) + 5th fBm octave. FIRST change to home h0:
  meadow heights moved (M1 24.3→32.7), pad still exactly 0; DC-3
  turnback re-verified EMPIRICALLY (turns seaward, the new 268 m peak at
  (−6460,−2680) is never approached — measure, don't map-read).
  terrainH 0.47 µs/call. Coast has bays/headlands; ridges wind.
- 24 × 24 km domain since W6 (2026-08-04): bounds ±12000. Far-field
  shape (mountain-belt falloff to northern plains beyond z≈−6500,
  archipelago z>3800, ±65 m long-wave relief) is exactly zero inside
  the home box + 1.5 km (x∈[−6300,600], z∈[−3300,2600]). Seed-0 (post
  W7): ~25k trees, 274 reaches / 113 km rivers, 369 lakes, 9
  settlements, 46 km roads. makeWorld ~0.6 s. Hydrology thresholds are
  physical (A0m2; widths/depths from drainage area) — resolution-
  independent. Renderer: two-ring terrain mesh (17.6 m polys over
  ±4500, ~100 m strips to ±12000 tucked 2 m under the inner rim),
  per-ring colour bakes.
- Stage 1 hydrology since 2026-08-03 (WORLD-GEN-PROC): 63 river reaches /
  24 km + 62 lakes carved into terrainH (seed 0), waterH reports reach
  surfaces + lake spills + sea; trees re-laid with water rejection (still
  2200). Rivers route AROUND the runway pad and meadows (bake-only
  drainage domes; carve masked on the pad, meadow blend applied after the
  carve — pad exactly 0, meadow cores exactly flat, GE gate untouched).
  WATER IS RENDERED since the W3 water session (same day): river ribbons
  (renderer-side Chaikin smoothing + cross-reach width taper; creeks
  < 12 m wide stay dry — under mesh resolution) and per-cell lake quads
  incl. the shallow connected rim (render-only `lakeSurf` from the bake),
  one merged mesh sharing the sea material; edges trimmed by terrain
  intersection. Terrain mesh SEG 256→512 so carves register. KNOWN LIMIT:
  flat-corridor pools show cell-granular outlines — contour-traced lake
  edges belong to the full renderer overhaul. M2 meadow quirk:
  it has sat at −47.9 m in the sea basin since v0 — waterH now honestly
  floods it; relocate/regrade at stage 4. Terrain change re-anchored the
  battery: pre-hydro logs are no longer diffable baselines.
- Stage 3 settlements & roads since 2026-08-04: W.settlements is live
  (5 at seed 0: Home Field hamlet by the airfield + 4 procedurally named
  towns, all outside the circuit band), ~13.5 km of roads grown from the
  airfield with a wooden bridge, 76 buildings, GRAVEL surface on roads,
  shallow road grading in terrainH (masked at pad/meadows — pad exactly
  0, meadow centres exact). Buildings have NO physics collision (honest
  cut). W.roadNet = informative block (roads/buildings/roadNear/bakeMs).
- Stage 2 biomes since 2026-08-03: W.surface is the real classifier
  (WATER/SAND/ROCK/SCREE/FOREST_FLOOR/GRASS); trees are biome-placed
  with species (tree.sp 0-4: spruce/pine/oak/birch/willow) on a
  deterministic jittered 64 m grid — the v0 LCG loop is gone, exclusions
  kept verbatim. 2336 trees at seed 0.
- v1 contract since 2026-08-03 (futureDesigns/WORLD-CONTRACT.md):
  makeWorld(seed) also exposes waterH/surface/SURFACE, TILE=512 + lazy
  tile() (buckets the eager tree array — trees MUST stay flat and
  index-stable, treesNear returns indices into it), and W.aerodromes
  (runway 'HOME' + 3 meadows).
  The registry is DESCRIPTIVE until the AP-reads-aerodromes session: the
  AP still flies def.params.ap constants, and the carve/decals below are
  not yet driven from it (the runway exists 4× independently: carve, AP
  constants, decals, patchwork mask).
- Runway 1100 m: x +20 → −1080 (extended for the DC-3; physics flat pad
  x∈[−1180,130], |z|<90 blend). Takeoff heading −x, landing +x.
- Mountains −z side (peaks to ~268 m near (−6460, −2680) since W7 — the
  DC-3 turnback turns SEAWARD (+z) and never approaches them, verified by
  trace 2026-08-04; watch turn direction for new heavies), sea +z,
  corridor flattened x∈[−3400,400] |z|<750. 2200 collidable trees, exclusion
  covers the corridor. 3 landing meadows with beacons.
- Physics ground uses terrainH; friction plane still horizontal (known cut).
- The RENDERED airfield (src/viewer/render_world.js) is scaled to this runway
  (strip 1100 m centred x=−520, thresholds +20/−1060). A world-geometry change
  invalidates six fiches' xTurn/xAim/gs AND the airfield decals — re-anchor
  both, and rerun the whole battery.

## GRAPHICS (post-redesign, 2026-08)
Golden-hour look: ACES tonemap, sRGB, PCF shadows, camera-parented sky-dome
shader, baked 2048² terrain texture (~512k terrainH calls at startup — seconds
of load, accepted), 513² terrain mesh (bumped from 257² for the river
carves), stage-1 water (rivers + lakes + sea, one MeshStandard material;
see WORLD), W8 upland palette (grass -> olive heath -> dry alpine grass ->
rock — the old sandy DRY band read as desert on the warped uplands) with
two-scale vegetation-patch mottling fading out by ~260 m,
field patchwork, instanced woodland (2-4 render-only
neighbours per collidable tree, corridor exclusion |z|<90 matches the world,
water-rejected via waterH), billboard cumulus, dynamic shadow frustum
following the CG. W13 viewer pass (2026-08-04): dense
render-only woodland fill streamed in 1024 m chunks around the aircraft,
minimap panel (baked underlay + live route/aircraft/wind), wind presets
wired to world.setWind with live windsocks, flatness-gated field
patchwork, second close-range detail octave — see roadmap W13.
W18 (2026-08-05): the aircraft skin is PBR and the world has a boot-baked
reflection map off its own sky — see PBR & REFLECTIONS, and read the RGBE
trap there before touching the sky shader or anything that renders into an
offscreen target.
W17 (2026-08-05): the forest is a three-rung LOD ladder — 3D inside 450 m,
boot-baked octahedral impostors out to 4 km, canopy texture on the terrain
beyond — and 2.05x denser for it. The full as-built lives under TREE FIELD;
read it before touching anything in the tree block or the ground shader's
canopyHook.
The aircraft
itself stays the untinted wireframe: strain ramp neutral→amber (tension) /
cyan (compression) — deliberate contrast, don't "fix" it.
The shadow proxy (app.js) stitches an invisible skin across WF/WR tips +
engine + tailplane nodes; ENGL/ENGR exist only on Cub and DC-3, single-engine
fiches fall back to ENG — keep that fallback when adding aircraft.

## FLEXBODY SKIN (ported from the web team's branch, 2026-08)
The PA-18 flies with a real textured mesh (helijah's FlightGear model, baked
to `src/models/pa18_model.js`): rigid body-frame mount + spanwise flex
binding to the WF/WR spar stations + hinged control surfaces (ailerons,
elevator, rudder w/ fin ramp, steered tailwheel, flaps) + full interior
(cabin, seats, panel, six gauges) visible through the glass. The sim is the
truth; the skin never feeds back. Full contract: docs/SKIN-PROC.md; import
procedure for the next aircraft: docs/MODEL-IMPORT-PROC.md.
- Calibration `SKIN_CFG.pa18 = { off:[1.690,-0.070,0], tags:['WF','WR'],
  zRoot:1.30, xMax:1.5 }` — measured on the cub geometry, valid because the
  pa18 fiche is a byte-copy of it.
- bSkin cycles Skin → Flex ×4 → Frame. In skin modes the mesh casts the sun
  shadow and the proxy hides; Frame restores wireframe + proxy shadow.
- Drawn surfaces run through a two-pole linkage low-pass (LINK_TAU 0.15) —
  NOT 1:1 with sim.ctl (HUD shows raw ctl); it was added to filter the
  AP's ~3.7 Hz roll/yaw limit cycle. That cycle's core-side fix landed in
  W16 (fiche rollD 0.8, see AUTOPILOT RULES) — the linkage lag stays for
  realism, but it no longer masks anything.
- Known limits carried as-is: no twist, rigid tail/fuselage/glass, hinge
  about the undeformed line (visible only at ×4), P-side-only station keys
  in makeSkinBinding (exact for mirrored fiches — union+assert before
  skinning a non-mirrored aircraft), linkage+prop spin hardcode 1/60.
- The branch's flight_core.js was a fork of the INITIAL commit — never merge
  anything from it; the port cherry-picked only codec/payload/viewer/gates.

### C172 skin (2026-08-04) — second model, GLB source
`src/models/c172_model.js` (6.2 MB, 27 groups, 186 k tris) from a Sketchfab GLB
("FREE Cessna 172SP" by NLM, CC-BY 4.0, `assetsSketchfab/`). New GLB branch of
the import procedure: `tools/glb_inspect.py` (inventory / textures /
animations), `tools/glb_render.py` (**ortho contact sheets** — the only way to
identify parts in a Sketchfab export, whose names are all `Plane.002_1`),
`tools/glb_extract.py` + `tools/models/c172_src.py` (axis/scale convert, skip
staging props, split fused L/R meshes, mirror the missing strut) →
`assets/c172/c172.obj`, then the unchanged OBJ bake.
- **IMPORT AS-IS. Do not decimate, weld or clip the mesh, and do not re-encode
  the textures** (`fmt='copy'`). Detailed models are supposed to be detailed;
  the artifact is ~7.9 MB and that is fine, because loading is handled by a
  loading screen (body.html `#boot`, dropped on frame 1 by `dismissBoot`).
  An earlier pass decimated to 35% and it was rejected — the capability was
  removed from the extractor rather than left switchable.
- Calibration `SKIN_CFG.c172 = { off:[1.694,-1.420,0], zRoot:2.00, xMax:1.5,
  rig:['skin','metal','tyre','hub','gear'] }`. Mains 0.0 cm / nose 0.6 cm off
  the settled contact plane.
- **`rig` is new and matters**: hinges + flex used to run on `skin` only. The
  C172's steering nose gear spans four materials, so it spans four groups.
  Default `['skin']` — the pa18 path is unchanged.
- **`prop*` groups all spin.** Getting this wrong is very visible: the
  cowling's front panel (the ring around the spinner) was briefly in a prop
  group and rotated with the blades. x cannot separate it from the spinner
  backplate — same station — so the C172M gate asserts by RADIUS: nothing
  wider than 0.25 m may spin aft of the blade disc.
- **Flat-colour materials are opaque** unless `opacity < 1`. Previously every
  untextured material was forced transparent + `depthWrite:false`, which was
  right for the pa18's two translucent groups and wrong for a whole cabin.
- **Hinge axes are least-squares fits, not cardinal** — dihedral tilts the
  flap/aileron hinges, aileron taper sweeps them 7°, the rudder rakes 24°.
  `model_inspect.py --edge` now prints the fit; keep axes canonical
  (dominant component positive) and let `sgn` carry direction.
- Fiche `13_aircraft_c172.js` gear was re-matched to the model: track
  2.62 m, wheelbase 1.74 m (was 1.97), tyre radii 0.173/0.174 (were
  0.28/0.24), LEVEL static stance (was 2.7° nose down), wing 2.25 m over
  ground (was 2.35). Static deflection 4.4 cm mains / 1.1 cm nose.
  **Do not shorten the main legs further**: the axle attaches to the belly
  rail at y 0.05, |z| 0.60, so at this track the legs already splay ~47° —
  taking the drop below ~0.55 sends the gear over-centre and it folds up
  under static load (observed: axle rose 0.42 m, aircraft sat on nose wheel
  and tailpost). Gate: `C172M` (tools/test_c172_model.js).
- The fiche's `twSteer: -0.35` carried a comment saying its sign was
  unverified. It is correct: the solver rotates the rolling direction by
  `-twSteer*dr` about +y, so a negative twSteer points a NOSE wheel left for
  nose-left, which is what a nosewheel does (a tailwheel wants the positive
  sign the taildraggers carry). Comment corrected.

## TREE FIELD — the LOD ladder (W17, DONE 2026-08-05)
Baseline that started this arc, GL draw hooks + EXT_disjoint_timer_query,
C172 loaded, 1.3 Mpx:
**203 draw calls, 4.36 M tris/frame, 3.45 ms GPU** (2.25 ms with all trees
skipped). Share: far clutter 1.97 M (45%), near trees 1.25 M drawn twice
(camera + shadow), ground 0.52 M, **whole C172 skin 0.06 M — 1.3%**. The
aircraft is not the cost; the forest is. Resolution barely moved it (3.7x
fewer pixels saved 6%), so this is geometry submission + the fixed-size
shadow pass, NOT fill.

DONE: both tree layers are chunked and genuinely culled. three culls an
InstancedMesh on its GEOMETRY's bounding sphere, and the geometry is shared —
which is why the streamed layer had `frustumCulled = false` and the woodland
layer was one world-sized mesh. Fix: instance matrices are chunk-LOCAL, each
chunk mesh sits at its chunk centre, and the shared sphere is inflated once.
(Trunks also switched off past 900 m; W17 superseded that rule — they now stop
at the near band.) **Size the sphere against RELIEF, not just the
horizontal half-diagonal** — GATE WORLDRENDER caught a tree on a 148 m ridge
2 m outside a 736 m sphere. The same bug class had the village buildings
culled against a 1 m sphere at the origin (fixed).

DONE 2026-08-05 — **the LOD ladder** (W17), all three rungs, in
render_world.js. Constants live together at the top of buildWorldScene
(`NEAR_R 450 / FAR_FILL 4000 / FAR_WOOD 5400 / FAR_FADE 500`) because the
ground shader owns one rung and the tree block owns the other two, and they
have to agree at the seams.
1. near (< 450 m): 3D canopy + trunk + shadows, unchanged.
2. mid (450 m .. FAR): **octahedral impostors**, 2 tris/tree.
3. far (> FAR): no geometry; the terrain wears a canopy texture.

Measured before/after on the SAME machine, same viewpoint, same pumped frame
count (tools/make_probe.js — see below), PA-18 over the Tyl forest at 197 m,
800x450:
| | draw calls | tris/frame | ms/frame |
|---|---|---|---|
| before (HEAD~) | 568 | 5.54 M | 15.2 |
| after | 150 | 0.98 M | 3.9 |
Calls and triangles are exact (counters wrapped around the GL draw entry
points); the ms column is same-protocol wall clock in a pane that is not
compositing, so treat it as indicative, not as a GPU time.
**3.8x the calls, 5.7x the triangles, ~3.9x the frame — while the streamed
forest got 2.05x DENSER.** (Parked at HOME, where there is far less forest in
frame, the same pair reads 653/5.73 M vs 254/1.37 M.) The old 203/4.36 M figure
at the top of this section was a
different rig, aircraft and resolution; it is kept as the historical anchor,
not as a comparand.

How it works, and the parts that are not obvious:
- **The atlas is baked at boot from the live tree geometry** (`bakeImpostorAtlas`)
  into a 512² WebGLRenderTarget, 4x4 tiles, one atlas per source shape (four:
  woodland cone/blob, fill cone/blob — the fill shapes are shorter because they
  have no trunk under them, and the impostor's size and centre height come off
  the source geometry's own bounding sphere). No external art; the silhouette
  matches across the switch by construction.
- Bake the mesh **WHITE with `toneMapped = false`**, and multiply by the same
  per-instance species colour the near tier uses. Bake it tinted and every tree
  in the forest is the same green. Render targets get LinearEncoding and the
  toneMapping parameter follows `material.toneMapped`, so the tile holds pure
  linear shading and tone mapping still happens once, at the final draw.
- **The light stays fixed in world space while the bake camera walks the
  hemisphere.** That is what lets impostors carry no yaw and need no lighting at
  draw time: every tile is already lit for the sun this world has, and the whole
  forest is lit from the same side. (Instances DO carry a random yaw for the 3D
  tier; the impostor shader reads only position and scale out of the matrix.)
- Clear the target to transparent **black** and **unpremultiply after sampling**
  (`texelColor.rgb /= max(texelColor.a, 1e-4)`). The canvas is premultiplied, so
  a white transparent clear comes back black anyway; premultiplied texels are
  exactly the ones bilinear filtering and mipmaps are correct on, and this kills
  the dark fringe at every distance. The 12% ortho gutter is what keeps mipmap
  bleed between tiles off the tree.
- Non-uniform instance scale (pines narrow, willows squat) is handled by doing
  **everything in the unscaled shape's space**: divide the direction-to-camera
  by the scale, pick the view, lay the quad out on that direction's canonical
  frame, then scale the offsets back componentwise. The orthographic silhouette
  of an affinely scaled object IS the affine image of the unscaled silhouette,
  so this is exact. `sv.x === sv.z` in both layers, which is what makes it work.
- The quad's frame comes from the VIEW DIRECTION, not the screen — same
  `upRef` rule in the shader as in the bake (`|dir.y| > 0.999 -> (0,0,1)`).
  Build it from the camera's right/up instead and a rolling aircraft smears the
  atlas. The pole is a genuine (measure-zero) discontinuity: pass exactly over a
  tree and its impostor spins 180 deg. Every octahedral impostor has this.
- 3 taps, barycentric over the grid cell. A nearest-view pick flips the whole
  forest at once when the aircraft turns; 16 views is UE's foliage default and
  with the blend it reads continuous.
- **Impostors carry no trunk.** A trunk is 1.9 m x 0.4 m — a fifth of a pixel at
  450 m (the same argument that already switched trunks off at 900 m), and a
  brown trunk cannot ride a per-species tint. The old 900 m trunk rule is gone,
  superseded by the near band.
- The 3D tier collapses per instance in the vertex shader: **view-space length
  IS the camera distance**, so it costs one compare and no uniform. Chunk-level
  `.visible` on top of that (lodUpdate), because an off chunk costs nothing at
  all — not even the vertex shader.
- **The shadow pass renders through its own depth material**, so the collapse
  above never reaches it — that is the "drawn twice" in the measurement above.
  A shared `customDepthMaterial` with the same radius, measured from the CG
  (the sun's shadow camera follows the aircraft, not the eye), fixes it.
  Consequence to know: tree shadows now stop at NEAR_R, where before they
  stopped at the shadow frustum's own 540 m cap at altitude.
- `uCam` is fed from the CHASE CAMERA, not the CG: the impostor picks its view
  from the direction to the eye, and 30 m of chase offset is 4 deg of parallax.
  One frame stale (the viewer places the camera after worldUpdate) is fine.
- **TRAP, cost real time:** `chunkBounds` overwrites the geometry's
  boundingSphere with the 1.5 km chunk ball. The bake needs the SHAPE's sphere,
  so chunkBounds now stashes it in `geo.userData.shape` — call
  `computeBoundingSphere()` again anywhere downstream and you silently undo the
  inflation and put the tree field back to being culled per tree. GATE
  WORLDRENDER asserts the stash is tree-sized.
- **FAR_FILL was first set at 2700 and that was wrong.** Measured against the
  pre-ladder build at the same viewpoint, the 2.7-5.2 km shore went from
  forested to pasture: a canopy texture cannot stand in for trees on ground that
  is still only half hazed. At 4000 the fog is ~74% by the time the last
  impostor has shrunk away. Impostors are 2 triangles — buying that 1.3 km back
  cost almost nothing, and this is the knob to reach for if the far field ever
  reads thin again.
- The far tier fades in over exactly the band the impostors shrink out in
  (FAR_FILL-FAR_FADE .. FAR_FILL), keyed to a 512² FOREST_FLOOR mask baked
  beside the outer colour pass, looked up from WORLD position (the inner mesh
  and the outer ring have different uv layouts; the mask is one domain-wide
  bake). The crown texture multiplies at **1.45**, not the 2.0 that would
  preserve the mean: a canopy is DARKER than the grass it stands on, and a
  mean-preserving multiply left the hills reading as pasture.
- Impostors **shrink** to nothing over the last FAR_FADE metres rather than
  clipping. An alpha fade would need blending and sorting; at 2 px tall,
  shrinking is indistinguishable from dissolving.

Density: the streamed fill grid went 13.1 -> 9.1 m (NG 78 -> 112, 2.05x) and its
ring came in 5.6 -> 4.1 km. Chunk size stayed 1024 m ON PURPOSE — generation
cost is per grid POINT, so halving the spacing at a constant chunk size would
have quadrupled the per-chunk hitch (~3 -> 12 ms); at 2x it lands near 6 ms,
and the streamer's cadence doubled (24 -> 12 frames) with the burst halved
(6/2 -> 3/1) to keep a fresh spawn filling in ~2-3 s. Memory is the real price
of the ladder: both tiers are built per chunk from the same records, so
instance buffers roughly doubled (~50 MB of matrices/colours across both
layers). If that ever bites, build the fill layer's 3D tier lazily — only ~9
chunks are ever inside NEAR_R.
Room left if more density is wanted: the near band is the only tier paying per
triangle, so raising density costs ~16 tris/tree inside 450 m and 2 tris/tree
out to 4 km. NOT by cutting trees — see [[import-models-as-is]]'s sibling rule:
quality is not the budget knob.

**Instrument: `node tools/make_probe.js --base`** (tools/_probe.html +
_probe_base.html, both gitignored). The agent Browser pane stops compositing
when it is not displayed, which throttles rAF to nothing — the sim boots, never
draws, and every live measurement silently reads zero. The probe is dev.html's
exact markup and script list plus a hand-pumped rAF (`__pump(n)`), an error
trap, draw-call/triangle counters wrapped around the GL entry points, and a
wrapper that catches `buildWorldScene`'s return value into `window.__WF`
(otherwise it is sealed in app.js's closure). `--base` writes a second page
running the PREVIOUS COMMIT's render_world.js, which is how the table above is
same-machine rather than same-memory. `__WF.treeLod.near.value = 0` turns the
whole forest into impostors — that is the fidelity test: at 30 m the impostor
canopies matched the geometry blob for blob, differing only by the trunks they
deliberately drop.

## PBR & REFLECTIONS (W18, DONE 2026-08-05)
The aircraft skin is `MeshStandardMaterial` and the world has a reflection map.
Everything else — terrain, trees, buildings, decals — stays Lambert on purpose:
it is cheap, it is tuned, and r128 routes `scene.environment` to Standard
materials ONLY, so the switch could be made surgically.

- **The cube is baked at boot from the world's own sky** (`render_world.js`,
  right after the sky dome): a throwaway Scene holding the same sky-shader dome
  plus a ground hemisphere, through `PMREMGenerator.fromScene(es, 0.035, 1, 100)`.
  No HDRI file, no network, nothing added to the artifact, and the reflections
  are of THIS sky at THIS hour by construction. The sky shader is now a factory
  (`skyMat`) shared by the on-screen dome and the bake — one source of truth, so
  a reflection can never drift from the sky it reflects.
- **THE TRAP — cost most of the session.** r128's PMREM render target is
  **RGBE**: alpha is an EXPONENT, not opacity. The sky is a hand-written
  ShaderMaterial that includes none of three's chunks, so nothing converted its
  output to the target encoding and it wrote `alpha = 1.0` — which the RGBE
  decoder reads as 2^(255-128) ≈ 1.7e38. The IBL term goes infinite, inf-inf is
  NaN, and **every MeshStandardMaterial in the scene renders PURE BLACK** while
  the Lambert world looks perfectly fine. Aircraft and water both, with no
  console error. Fix: `skyMat(encode)` appends `#include <encodings_fragment>`
  for the bake variant ONLY — adding it to the on-screen dome would change the
  sky, whose palette was tuned against the un-converted output.
  What found it: swapping in a PMREM baked from a plain `MeshBasicMaterial`
  dome (a built-in material, which DOES encode). It lit up instantly, and that
  narrowed a whole-scene symptom to one shader in one line of the bake.
  Same family as the impostor atlas's `toneMapped = false`: **anything rendered
  into an offscreen target owes that target its encoding.**
- **Material table lives in app.js (`PBR`), keyed by payload material name** —
  the names are already semantic (model_prep.py takes them from the source MTL's
  usemtl groups). So: no payload re-bake, no new bake-time dependency, and one
  readable table instead of two generated 6 MB files. A new aircraft gets
  sensible defaults from `PBR._` and only needs entries for what it names
  differently.
- **Metalness is not shininess.** Paint over aluminium is a dielectric: `skin`
  stays at metalness 0 however glossy it looks. Only genuinely bare metal (hub,
  prophub, gearmetal, the c172's `metal`) goes high — set the fuselage metallic
  and the livery turns grey and takes its colour from the sky.
- Transparency semantics are deliberately unchanged: `opacity < 1` in the
  payload is still the only thing that makes a group transparent, so the gauge
  textures carrying real cutout alpha behave exactly as before.
- Measured (canonical viewpoint, C172, mean over a wing box): Lambert
  [144, 152, 129] -> PBR [152, 164, 150]. Brighter and markedly bluer — that is
  sky IBL landing on white paint. Full-frame means moved < 2%, i.e. the Lambert
  world really is untouched. Draw calls and triangles are unchanged (152 /
  0.96 M over the Tyl forest vs 150 / 0.98 M before): this is a shader-cost
  change, not a submission change.
- The clearest win is the SHADED side. Backlit at golden hour the Lambert C172
  was a flat black silhouette with only its lit interior showing through the
  glass; with the reflection map the wing, fin, fuselage and strut all read.
  The water gained a real sky reflection for free — it was already Standard.
- Knob if the sky ambient is ever too strong for the art direction:
  `PBR.skin.e` (envMapIntensity), currently the neutral 1.0.

### W18b — the C172's PBR is IMPORTED, not guessed (2026-08-05)
The name-keyed table above is now only a FALLBACK, for payloads with no PBR of
their own (the PA-18, whose OBJ+MTL source has none to import). The C172 is a
glTF, and glTF materials *are* PBR: the factors, the packed metalRough map, the
normal map and the emissive map all came across.

Pipeline, end to end, with no new per-material config:
- `glb_extract.py` writes `assets/c172/pbr.json` beside the OBJ, keyed by glTF
  material name — **which is also the OBJ's `usemtl` name**, so `model_prep.py`
  joins them by walking the faces each group claims and taking the dominant
  source material. Nothing to declare, and a group spanning several source
  materials reports the split instead of silently picking.
- Payload v4 adds `rough`/`metal` per material, plus `mr`/`nrm` naming entries
  in `texs` and `emis` (a factor; the emissive map IS the base map on this
  model, so it is reused and costs zero bytes). `decodeModel` was untouched —
  the group binary layout has not changed since v2, and the only version test
  in the viewer is `data.v >= 2`.
- The viewer prefers payload values over the table: a guess must never override
  a measurement. metalRough goes into BOTH `roughnessMap` and `metalnessMap` —
  that is one glTF texture whose G and B channels three reads separately, not
  a copy-paste slip. Normal mapping needs no tangents; three derives them.

**Measure before importing — most of those maps were worth nothing.** Of 8
metalRough maps, four are perfectly constant, and of 6 normal maps one is the
identity normal and three more perturb by under 1% (stdev 1.2-2.9 of 255). The
extractor therefore FOLDS a constant metalRough into the two scalars it already
implies, drops an identity normal, and keeps the rest: 3.8 MB of source maps
became 186 KB of payload carrying everything that actually varies. Thresholds
`FLAT_MR`/`FLAT_NRM` in glb_extract.py, deliberately tight.
The one judgement call left to config: the pedals' normal map is the strongest
in the model (stdev 23.7) and its worst value — 204 KB for 336 triangles down
in the footwell — so `c172.py` declines it with `nrm=False`.
Cost: payload 6308 -> 6557 KB (+4%), artifact 8.10 -> 8.36 MB.

What the artist's numbers actually said, against the guesses they replaced:
| material | guessed r/m | imported r/m |
|---|---|---|
| skin (painted alloy) | 0.42 / 0.00 | **0.221** / 0.00 |
| metal (bare) | 0.34 / 0.85 | **0.139** / **1.00** |
| glass | 0.06 / 0.00 | 0.00 / 0.00 |
| hub | 0.28 / 0.90 | **0.00** / **0.456** |
The airframe is markedly glossier than guessed and the bare metal glossier
still — which is exactly the kind of thing a table of plausible numbers gets
wrong, and the reason to import.

**THE TRAP, and it cost two phantom bug-hunts.** Texture decode is ASYNC. A PBR
material whose base map has not landed yet is a *white dielectric under a
reflection probe* — i.e. a mirror. Switching to the C172 (13 maps) flashed a
chrome aeroplane, and every screenshot taken in the first second showed it. I
"fixed" that twice before measuring: once by linearising the env bake, once by
halving envMapIntensity on dielectrics. Neither was the cause.
  - What found it: shooting the same viewpoint twice in one call, before and
    after poking a material. Identical settings, different pictures — so the
    difference was TIME, not the setting. `__texReady()` in the probe now
    reports decode state, and **no frame should be judged before it says ready**.
  - The real fix is in the product, not the test: `buildModel` counts its
    texture loads and `applySkinVis` holds the WIREFRAME until they land
    (onError counts too, so a missing map degrades to untextured rather than
    invisible). Under Lambert this gap merely showed white, which is why it
    never mattered before PBR.
  - KEPT from the false starts: the env bake linearises the sky
    (`sRGBToLinear`) before packing. The palette is authored in display space —
    the on-screen dome writes gl_FragColor raw into an sRGB target and nothing
    converts it — while a reflection probe must hold scene-linear radiance.
    That is right on its own terms, worth ~2.4x, and stays.
  - REVERTED: scaling dielectric envMapIntensity to 0.3. Neutral 1.0 is
    verified good once the textures are actually there. The double-ambient it
    was reasoning about is real (HemisphereLight *and* an env map) but measures
    small — a white rough probe lit by the env alone reads ~0.07 linear.
GATE C172M now asserts the import: factors in range, every named map present in
`texs`, emissive only where a base map exists to reuse, and the two the import
exists to get right — painted skin is a dielectric, bare metal is not.

## THE GARAGE — procedural airframes (G1, DONE 2026-08-08)

The project's original intent: build small aircraft in a shed, not fly someone
else's. `src/core/6x_gen_*.js` + `src/viewer/garage.js`, gate `GEN`, aircraft
key `gen`. Design note: futureDesigns/spec_progen_v1.md is the ancestor — its
§1 naming, §2 schema shape and §4 QC table survive; its "generate a skeleton,
import a mesh as a ghost" framing does not.

**ONE ROOT.** The spec is the source of truth and the mesh is never an input.
Physics-from-geometry is a dead end (a mesh has no mass, no material, no spar
location), so instead:

    spec -> genFrame -> {nodes, beams, refs, parts}
              parts  -> genStrips + genParams -> the fiche  (30_solver.js eats it)
              parts  -> genSkin              -> mesh groups (app.js eats them)

Three things in the existing code made this cheap rather than speculative, and
they are worth knowing before changing any of them:
1. `30_solver.js:16-25` derives mass, CG and wingspan FROM THE NODE GEOMETRY.
   There is no `wingArea` or `mass` fiche parameter. Feed it a lattice and
   every downstream quantity follows.
2. `decodeModel()` returns plain `{nv,nt,pos,uv,idx,sid}` groups, so a
   generator can emit that shape in memory — no base64, no python bake, and
   hinges/PBR/shadows/gates all work unchanged.
3. `POLARS` is already the right six numbers to synthesise.

**The covering is the truss, extrapolated.** Every skin vertex is an affine
blend (weights summing to 1) of the truss nodes it sits on. Consequences:
- `SKIN_CFG.gen.off` is `[0,0,0]` BY CONSTRUCTION. Every imported model needs
  its mount measured; this one cannot be wrong.
- Fuselage flex comes free, which SKIN-PROC.md §6 lists as deferred for
  imported skins. Binding a foreign mesh to a truss is the hard part;
  generating the mesh from the truss is not.
- Hinge axes are analytic, not least-squares fits off a mesh.
- FORMERS: a bare truss has flat faces, so `crown` blends each station from the
  truss rectangle (0) to a rounded former outline (1). Formers are visual only,
  carry no mass, and are still affine on the same four corner nodes — a vertex
  standing proud of the truss simply has |u| > 1 and extrapolates.

**Calibrated against the fleet, not invented.** Every constant that could have
been a free parameter was fitted to a hand-written fiche and the agreement is
the reason to trust it:
- thin-airfoil integration on the NACA mean line: NACA 2412 -> aL0 -2.08 deg,
  Cm0 -0.0531 (book -2.1, -0.053).
- `genTailPolar` reproduces `POLARS.flat_tail_cub`: a3d 3.34 vs 3.4,
  aStall 0.239 vs 0.24.
- `Cd0 = 0.0055 + 0.018 t/c + material` reproduces the Cub's 0.010 and the
  C172's 0.008. `GEN_KVISC 0.845` is the viscous deficit reconstructed from the
  registry's own (a3d, eAR) pairs — a0 lands 5.7-5.9 /rad, not 2*pi.
- propwash fraction `max(0, 1 - (z/(1.12 R))^2)` reproduces the Cub's hand
  values exactly (centre 1.0, first outboard strip 0.5, rest 0).
- `fusCdA` coefficients (0.75 frontal / 0.57 fwd side / 0.31 aft side)
  reproduce the Cub's hand-tuned [0.55,0.8,0.8] / [0,0.5,0.5] from its own
  geometry. Fwd and aft differ because the aft body is tapered and cleaner.
- gear: `axleY = engY - propR + wheelR - 0.40` lands within 2 cm of the Cub's.

**The garage puts it in the tunnel.** Two numbers cannot be reasoned out of
geometry, so `genTrim()` measures them with `sim.probe()` (deterministic, one
strip pass per call): `stabTrim` by a secant solve for pitch balance at the
aeroplane's own cruise speed and trimmed alpha, and `thrCruise` from the drag
that solve measured. `genShakedown()` is the same instrument as the player-
facing readout, and it runs on ANY fiche — comparability with the fleet is the
whole point. Measured side by side with the Cub:

| | mass | Sw | w/l | VCr | L/D | cgX | SM | thrCr | stabTrim |
|---|---|---|---|---|---|---|---|---|---|
| Cub (hand) | 377 | 16.0 | 23.6 | 26.0 | 8.24 | 0.80 | 0.22 | 0.70 | -0.098 |
| GEN preset | 393 | 16.0 | 24.5 | 27.9 | 7.95 | 0.86 | 0.20 | 0.69 | -0.079 |

**Hard-won, in order:**
1. **Do not fix the deck angle and derive the tailwheel height.** A real
   tailwheel leg has a LENGTH and the attitude is what falls out of it. Fixing
   the angle instead pushes the tailwheel up into the tailpost as the tail arm
   grows: measured, the parked tailpost clearance halved (0.30 -> 0.16 m) and
   the tail-rig deviation went 3.3% -> 5.6%. `GEN_RULES.twLeg` hangs the wheel
   off the tailpost foot and the deck angle is reported and gated (8-15 deg).
2. **GATE GEN's G4 is a RIGIDITY TEST, not a face audit.** spec_progen_v1
   proposed "every quad face has a diagonal", which is a proxy for the thing
   that actually hurts — a mechanism. The DC-3 moved 0.5 m at under 1% strain;
   the Chinook latched with everything under 0.8%. So the gate assembles the
   framework's rigidity matrix and requires rank 3n-6. It catches mechanisms no
   face audit would see, and it is the only instrument in the battery that can.
3. **The generated paint texture needs `encoding = sRGBEncoding`.** Canvas
   colours are sRGB; left as linear the renderer encodes them a second time on
   output and every colour comes out washed pale. The imported payloads are
   deliberately NOT changed — their look is calibrated as-is.
4. **Structure and drawing are not the same list of members.** The strut fan
   (six members) is the lumped stand-in for a spar box this planar wing does
   not have — rule 1. Drawing all six is a birdcage. Only the two real lift
   struts are marked `ext` (drawn outside the fabric); the rest live under it.
5. **A window that runs frame to frame reads as a missing panel.** Glazing is
   inset both along the body (`GEN_LSEG` slices per bay) and around the section.
   That is why a skin vertex carries up to `GEN_INFL = 8` influences: a section
   between two frames blends both frames' four corners.
6. The cowl must close ON the spinner backplate (same radius) or the nose is an
   open tube you can see down.

### G1.7 — the fuselage rework (2026-08-09, user playtest)

Verdict was "the fuselage is really too ugly". Three separate causes, all fixed:

1. **The nose was a carrot.** The cowl was the front of the fuselage loft,
   blending a firewall section smoothly into a spinner. A light aeroplane is
   not that shape: it is a straight-sided box with an engine in it and a cowl
   over the engine. The **ENGINE BAY is now its own component** — group `cowl`,
   holding full section for `cowl.straight` of its length and only then necking
   in — and the **engine block is DRAWN** (group `engine`: crankcase, four
   cylinders, prop shaft, scaled off the registry mass). Frame mode shows the
   chassis with the engine hung on its mount; Covered mode puts the cowl over
   it, exactly as fabric goes over the truss.
   - **The cowl does not neck to a spinner. It is an EXTRUSION** of the
     firewall's own section (same crown, so the joint cannot ridge), drawing in
     by `cowl.taper`, rolled over a quarter-round of radius `cowl.fillet` onto
     a FLAT nose, with the propeller mounted directly on that face. Two necking
     shapes were tried first and both were rejected on sight: the eye reads a
     smoothly-narrowing nose as a carrot, and a hole in it as an air intake.
   - The fillet is an ABSOLUTE inset (`fil * (1 - cos a)` off both half-width
     and half-depth), not a scale — scaling rounds the corners by pulling the
     face oval instead of filleting it.
   - Cap the nose IN THE PLANE of the last ring. It was inset 12 mm once, which
     left a lip you could see into: the user reported it as "a big opening…
     either the prop attachment, really badly calibrated, or an air intake".
     The spinner backplate then sits 6 mm PROUD so the two faces do not z-fight.
2. **The top line ran smoothly from spinner to tail.** There is now a COWL DECK
   (`fuse.cowlDeck`, a fraction of cabin height) and the windscreen is the step
   up from it to the cabin roof over `fuse.windRun`. The skin holds the deck
   level through bay 0 and then rises — a smoothstep on the top line only.
3. **The crown stepped at the waterline.** `genRing` blended crownTop for the
   upper half and crownSide for the lower, which kinks exactly along the line
   the eye reads. Now crownTop fades to crownSide by `max(0, cos θ)`. Defaults
   went to 0.72 top / 0.07 side: a tube-and-fabric fuselage has FLAT sides and
   belly with a rounded turtledeck, and those are very different numbers.

**Window cutouts are OUT** (user call). They cut real holes in the covering,
and at this vertex budget a hole reads as a missing panel. When glazing returns
it should be a painted pane on a solid surface or a separate inset frame.

**The paint stripe was a grey slab.** A wide swept band wrapped round a
flat-sided fuselage reads as a slab with a notch, not a livery. It is now a
thin straight cheat line at the waterline (halfwidth 0.013 in u) plus a slightly
darker belly. On this airframe thin and straight beats wide and swept.

### G1.8 — the undercarriage (2026-08-09, user playtest)

Report: "the largest engines just make it collapse". True, and it turned out to
be THREE independent faults, each of which alone puts the aeroplane on its nose
while every aerodynamic number stays perfectly healthy. All three now have a
line of defence, and GATE GEN walks the whole POWERPLANTS registry.

1. **Gear stiffness was a material constant.** The tubeFabric k/c are the Cub's,
   and the Cub is ~390 kg. You do not build the same undercarriage for a 1074 kg
   machine. Structure now scales `pow(mass / material.refMass, 0.85)`, clamped
   0.45–4. Sub-linear because a bigger aeroplane is not stiffer in proportion.
2. **Gear anchors were hard-coded to rings 0 and 1**, but the axle position is
   DERIVED from the CG. A light engine pushes the CG aft, the rake rule pushes
   the axle aft with it, and it landed behind BOTH anchors — so nothing resisted
   the axle swinging back and the tripod folded (rule 7's drag path, inverted).
   The anchors are now chosen by position to STRADDLE the axle. When the axle is
   ahead of every frame (heavy engine, tall gear) the forward leg hangs off the
   ENGINE MOUNT, which is what a real aeroplane does and keeps rule 7's "into
   heavy nodes" satisfied.
3. **Gear length came from prop clearance alone.** A tiny propeller therefore
   bought a tiny undercarriage, whose legs were near-horizontal — and a
   near-horizontal leg has almost no vertical stiffness whatever k it is given
   (rule 5). `GEN_RULES.legDrop` sets a floor of 0.35 m from the fuselage
   underside to the axle; it subsumes belly clearance, being stronger always.

**The suspension knob, and the trap in it.** `gear.stiffness` (0.35–3, sliders
in the panel) multiplies gear k. Damping must NOT follow it linearly: critical
damping is 2·sqrt(k·m), so at constant mass c goes as sqrt(k). Scaling c
linearly piled damping onto the axle node until Σc·dt/m passed 1 and the
explicit integrator diverged — the gear pinned at 100% strain and HELD there,
which reads exactly like a structural collapse and is nothing of the kind.
`c` scales with the mass factor linearly and with the suspension knob as
sqrt. Gated: stiffer must deflect less, and 3× must stay under 10% strain.

**The shakedown now answers "does it stand up" first**, because it is the one
question the aerodynamic block cannot fail on. Settled on a flat plane (world
= null, so it does not depend on which patch of grass it is parked on): stands
on wheels / what it is resting on instead, static gear strain, and a nose-over
angle MEASURED off the settled geometry rather than derived — the derivation
has to guess the attitude, and got it wrong twice. The preset measures 23.2°,
inside the textbook 16–25°, which is independent confirmation that the derived
gear placement is sound.

**Left failing on purpose:** the model-aircraft outrunner (0.1 kg, 1267 kg/hp)
on a 306 kg two-seater rests on its tailwheel. That is a category error, not a
design, and the gate excludes it by power loading rather than the generator
pretending it works. Engine power and mass are now in the picker's labels so
the choice is informed.

### G1.9 — substeps and the mirrored wing (2026-08-09, user playtest)

**"Selecting spruce+ply makes the game crash (simulation diverged)."** The
solver is EXPLICIT, so the timestep has to suit the stiffest oscillator — which
is exactly why the hand fiches carry 24 / 48 / 72 rather than one number, and
the generator was silently taking the 24 default for every material. Measured at
24 substeps: tubeFabric runs at omega*dt 0.352 / c*dt 0.518, spruce+ply at
0.615 / 0.947. The fleet's own worst values are 0.50 (Jodel) and 0.73 (Cub),
both stable, so wood was well outside anything proven — and c*dt approaching 1
is the explicit-damping stability limit. `genSubsteps()` in 62_gen_aero.js
derives the count from `sqrt(k/m_reduced)` and `c/m_reduced` over every beam,
bounded at omega*dt <= 0.45 and c*dt <= 0.65, floored at 24 (the fleet minimum,
and what the gated preset runs at, so the preset is bit-unchanged). Wood lands
on 35. GATE GEN now flies EVERY material to cruise.
Worth carrying: **the damping limit binds before the stiffness limit**. Reaching
for substeps because a structure "feels stiff" looks at the wrong number.

**"The wings are wrongly mirrored, the profile is the wrong way round on one."**
`wingSection` derived the section's thickness axis as `chord x (sign(z) * zHat)`,
which points UP on one wing and DOWN on the other — the left wing's aerofoil was
built upside down, and the centre section came out twisted between the two. The
axis is now taken as `chord x zHat`, flipped to always point up. Separately, the
left wing is the mirror of the right, so the same index pattern winds every
triangle the other way and `computeVertexNormals` lit that whole wing from
inside; `emitLoft`/`capLoft` take a `flip`.

**The instrument that was missing.** GATE GEN tested the LATTICE for mirror
symmetry from day one and it passed throughout — the structure was always
symmetric, and the aerofoil is placed by the SKIN generator. Two checks added,
and they are the general lesson: **the skin must mirror too**, and **the camber
must point up on BOTH wings** (symmetry alone is satisfied by an aeroplane with
two upside-down wings). The mirror test immediately found a second asymmetry in
the propeller — which is correct and exempt, because both blades twist the same
way and a prop that mirrored about the centreline would make no thrust.

## G2.1 — COMPONENT PLACEMENT (2026-08-09)

User: *"we need to be able to edit placement of the components. There's no room
for mistake here, and that's bad."* That last sentence is the design brief, not
a complaint about a bug: every position was derived from a rule, so every build
came out the same shape and you could not make an interesting mistake.

**Offsets, not positions — and they RIDE ALONG** (user decision). `spec.place`
holds `wingDx/Dy`, `engineDx/Dy`, `tailDx`, `gearDx/Dtrack`, each an offset from
whatever the rules derived. Change something upstream and the derived base
moves; the nudge stays the same size on top of it. Gated three ways: derived
xLE 0.380 stock / 0.320 at chord 2.0 m / 0.710 at noseGap 0.95 m, and a +0.4
nudge holds at exactly +0.400 through all three. The alternative — pinning to an
absolute x — leaves a moved part behind when the aeroplane changes around it.
`wingDx` lands BEFORE the tail arm is derived, so pulling the wing back takes
the empennage with it and the aeroplane stays a coherent shape; `tailDx` then
moves the tail relative to that.

**The wing had to be decoupled first, and that was the real work.** Its spar
roots WERE two fuselage frame nodes (`F[1].TR`, `F[2].TR`). Nudging the wing
moved the outboard stations and left the root welded to the cabin — the wing
was structurally unmovable, and no amount of UI would have changed that. Now:
- the wing owns its spar roots, and a **carry-through** runs across the top of
  the cabin (both spars plus rule-4 diagonals) — which is what makes it a wing
  rather than two half-wings bolted to a fuselage;
- each root ties to the TOP nodes of the frames that **straddle** it, chosen by
  position, so a moved wing re-attaches to different frames. Rule 3 (box depth
  through the root) is satisfied because front and rear roots land on different
  frames wherever the geometry allows;
- the strut root picks the nearest ring by position, not a hard-coded one;
- the centre-section strip hangs off the wing's roots, not the fuselage frames,
  or its lift stays behind when the wing moves;
- `sparRear` is now a constant 0.65 of chord. It used to be derived from the
  CABIN FRAME SPACING, which is precisely the coupling that made the wing part
  of the fuselage. 54 nodes now, up from 50.

**Unclamped on purpose.** `clampSpec` bounds the offsets only enough to keep the
geometry from going degenerate. Everything else is reported, not prevented — the
shakedown's static margin, nose-over angle and stands-on line are the feedback.
Measured across the gate's matrix: wing back 0.4 m takes the margin 19% -> 35%,
wing forward 0.3 m -> 7%, gear back 0.4 m tips it onto its nose (nose-over -43°,
resting on ENGL) and says so.

**GATE GEN's placement matrix asserts STRUCTURE, not flight** — 12 displaced
variants, each required to be rigid (full rank), mirror-symmetric and
schema-complete. Whether a displaced aeroplane still flies is the player's
problem; a gate that demanded it would quietly re-impose the very limits
placement exists to remove. Two more checks carry the intent: *the whole wing
moves, root included* (8 front-spar nodes, worst deviation from a clean 0.400 m
shift < 1e-6 — this is the assertion that would have failed before G2), and
*the shakedown reports a placement that breaks it*.

**The wing root attachment, twice wrong before it was right** — worth reading
before touching `mkWing`, because both failures were invisible to the checks
that were already there:
1. `straddle()` has a dead band, so a root sitting almost exactly over a frame
   got the two frames either SIDE of it and NO direct tie to the one beneath.
   The wing then hung on long diagonals, soft in torsion, and **folded through
   under full-deflection abuse at ~1% strain** — 88 degrees of wing flap.
   GATE GEN's rigidity test passed throughout: the framework was
   infinitesimally rigid and had a LARGE-DISPLACEMENT snap-through, which is
   rule 1, and which only GATE STRESS can see. Rank is necessary, not
   sufficient. The nearest frame is now attached as well as the straddling
   pair, plus a full-depth tie to the bottom longeron (rule 3).
2. That direct tie then landed on a frame node at the IDENTICAL position, so
   `L0 = 0` and strain read Infinity. The fix is not a degenerate-beam guard —
   it is `GEN_RULES.wingStandoff`, because a carry-through spar genuinely sits
   ON the longerons rather than inside them. Guarding the beam would have hidden
   two coincident unconnected nodes in the middle of the wing attachment.

## G2.2 — AUTOPILOT GAIN SYNTHESIS (2026-08-09)

The generated fiche used to inherit the Cub's attitude gains wholesale (only
`rollD` was scaled). Fine while the airframe was Cub-shaped; wrong the moment
it was not. **`genPlant` + `genGains` in 62_gen_aero.js** now derive rollP/rollD
and pitchP/pitchD/pitchI from the plant the airframe actually is.

**The doctrine's own words needed correcting by measurement.** "Gains scale with
airframe timescale ~ span/V" reads as omega ~ 1/tau. Reconstructing every hand
fiche's gains through a rigid-body plant model says otherwise: omega*tau(span/V)
scatters 0.6-3.6 across the fleet, so span/V is NOT the normaliser. Normalise by
the plant's OWN damping time constant — Ixx/-Lp for roll, Iyy/-Mq for pitch —
and gains tuned independently over many sessions collapse:

| | cub | jodel | c172 | dc3 | chnk | drone |
|---|---|---|---|---|---|---|
| roll omega*tau | 0.66 | 0.49 | 0.82 | 0.56 | 0.58 | 1.30 |
| roll zeta | 1.63 | 1.68 | 1.57 | 1.91 | 2.38 | 1.34 |
| pitch omega*tau | 1.11 | 1.88 | 1.30 | 1.37 | 1.25 | 1.33 |
| pitch zeta | 2.92 | 1.72 | 2.15 | 1.78 | 1.31 | 0.95 |

A 10.9 t DC-3 and a 230 kg Chinook inside a factor of 1.7 is the physics showing
through. `GEN_LOOP` targets those centres (roll 0.62 / zeta 1.70, pitch 1.30 /
zeta 1.90) and places a second-order loop against the measured plant.

The plant is analytic from the strips, i.e. the same model the solver
integrates: `Lda` from the aileron strips' area*arm, `Lp` from every wing
strip's area*z^2 (the roll subsidence), `Mde`/`Mq` from the stab area and arm,
and Ixx/Iyy from the node masses about the CG. No search, no simulation, so it
is free and deterministic.

**Where it actually earns its keep — measured, and not where I expected.**
Placement offsets barely move the loop (roll omega*tau holds 0.61-0.62 across
every offset). **WING SPAN is what breaks it**: at 13 m the untuned loop fell to
omega*tau 0.43 with zeta 2.50, outside everything the fleet has flown; it now
lands at 0.62/1.70 with rollP 4.17 instead of the inherited 2.0. The stock
preset also sat at the over-damped edge (zeta 2.06 roll, 2.78 pitch) — the same
condition the Cub's W16 limit-cycle cure moved AWAY from.

**Both instruments, as the doctrine demands.** "The circuit gates do NOT see
cruise smoothness, and cruise-quiet probes do NOT see capture/decrab: run BOTH."
GATE GEN now carries the cruise-quiet half as well as the circuit.
- The probe reads ZERO for everything in calm air — these loops are perfectly
  still with no disturbance, and the doctrine's published numbers are quoted in
  wind. It supplies 3 m/s + gusts.
- Validated against the HANDOVER's own figures: it reads **pa18 0.75 deg** bank
  p2p against the quoted 0.7, and **jodel 4.95** against ~4.5.
- The synthesised gains give **0.38 deg** — quieter than any hand-tuned fiche.
- Capture held: calm touchdown tdZ -0.0; crosswind (3 m/s + gusts) tdZ -1.08 and
  stop z -0.17, between the pa18 (0.10 / -0.19) and the C172 (-4.03 / -0.07).
- Side effect worth noting: the pitch change (pitchP 1.2 -> 1.50, pitchD 1.8 ->
  1.30) improved the flare — touchdown moved from 92 to 73 km/h, much closer to
  a real three-point at Vs 16.5.

## G2.3 — CONFIGURATIONS (2026-08-09)

Four options the player asked for ahead of 3D handles. They are structurally
different aeroplanes, not settings on one, and GATE GEN flies all eleven
combinations.

**Wing position** (`wing.position` high/mid/low) moves the spar roots and picks
which longeron pair carries them; the strut braces from the OPPOSITE longeron,
so it goes down from a high wing and up from a low one.

**Bracing** (`wing.strut`). Cantilever gets a real four-chord torsion box —
lower caps under both spars at every station, webs, ribs, shear diagonals on all
four faces, and its own carry-through across the fuselage. That is rule 1 being
paid for properly instead of leaning on a strut, and it is the Jodel's
construction. 54 nodes becomes 70.

**Gear type** (`gear.type`). A tricycle is not a cosmetic swap: the placement
rule inverts (mains BEHIND the CG), the rest attitude goes nose-high to level,
`twSteer` flips sign, and the AP needs `rolloutMode: 'trike'` to de-rotate onto
the nosewheel instead of pinning a tail that is not there.

**Springing** (`gear.suspension` bungee/spring/oleo), multipliers read off the
fleet's own gear constants normalised by mass — cub 74 k/kg (bungee), c172 160
and chinook 152 (spring steel), jodel 206. Damping is given per archetype rather
than derived from k, because an oleo genuinely damps harder than a rubber cord;
`genSubsteps` then picks a timestep that can integrate it (the oleo lands on 52
substeps against the bungee's 24, on its own).

**Cargo bay** (`fuse.cargoLen`, `cargoKg`): full-section fuselage aft of the
cabin. The fuselage grows, so the tail arm and the frames the wing and gear
attach to all move with it — which the G2.1 straddle logic already handles.

**Three things measured, each of which looked like something else:**
1. **The tricycle sat on its tailpost.** `noseLoad` is 0.25, not the textbook
   8-15%: at 0.12 and 0.18 the aeroplane rocked back until the TAILPOST touched
   and stayed there on mains-plus-tail with the nosewheel in the air. The
   fleet's only tricycle, the C172 fiche, sits at 26%. A soft-body airframe on a
   long nose leg needs the margin a rigid one does not.
2. **The tricycle's rest attitude was inverted.** Rotating the body so BOTH
   contacts reach the ground gives tan(deck) = (y_third - y_main) /
   (x_third - x_main). The nosewheel is AHEAD, so the denominator is negative
   and a nose-UP attitude needs its contact BELOW the mains — the opposite of a
   tailwheel. Getting it backwards read as "deck 178.8 deg". The shakedown also
   needs `atan`, not `atan2`, for the same reason.
3. **THE ONE WORTH REMEMBERING — the mid-wing strut aeroplane.** It stood,
   settled, and strained at 0.7% while saturating its ailerons and spiralling
   into the ground. Rule 1 says "the Cub survives only because its strut root is
   a full metre below the wing": a mid wing can only give a strut about HALF a
   cabin height, and measured, that is not enough — the wing twists under
   aileron load and the roll loop never wins. The identical wing with a
   cantilever box flew and landed. `GEN_RULES.strutMinOffset` (0.60 m) now
   turns an unbraceable strut into a box and the panel says `bracing:
   cantilever box` so the substitution is visible.
   **Every static instrument was green on an aeroplane that could not fly.**
   That is why the configuration matrix flies a leg rather than settling one.

**Still open in this arc:** 3D drag handles that write back into `place` (the
data model is ready for them); AP gain auto-tuning, which matters more now that
a displaced airframe may limit-cycle — without it "it won't fly" is ambiguous
between the aeroplane and the autopilot; then save/persistence, the materials
economy and missions.

**Open for G2** (deliberately out of G1): low wing, tricycle gear, cantilever
wings, cranked wings, tip-shape library, V-tail, 3D drag handles, AP gain
auto-tuning (G1 seeds from the Cub rescaled by the span/V timescale and ships
ONE gate-verified preset), save/persistence, materials economy, missions.

## G3.1 — SECTIONS AND THE LEDGER (2026-08-10)

The spec was one flat object and the editor one long list of controls. That
blocked everything the Garage is asked for next — an editor organised by
component, per-component weight and price, more than one wing, more than one
engine. This phase is a reshape, not a feature: **the generated lattice is
byte-identical through it**, which is the only reason a change touching every
generator file is safe.

**The spec is sectioned.** `GEN_DEFAULT` is now blocks —
`cabin / cargo / fuel / fuselage / cowl / engines[] / wings[] / bracing / tail /
gear / paint`. `engines` and `wings` are ARRAYS (one entry today; a twin or a
biplane is a second entry), everything else stays a named block. A general
component tree would be more elegant and much riskier.

Three things keep the blast radius at one file:
- `genNormaliseSpec(raw)` accepts the OLD flat shape or the new one. A spec
  written before today still builds the same aeroplane.
- `genAlias(S)` republishes flat aliases (`S.wing`, `S.fuse`, `S.cab`,
  `S.material`, `S.engine`, `S.fuelL`, `S.place`, …) as references to the same
  objects, so `61`–`64` were not touched by the reshape at all.
- `genClampN` — nullable clamp. `genClamp(null, lo, hi)` coerces null to 0 and
  returns `lo`, which would silently turn every AUTO field into a pinned one.
  Every derived-but-now-editable field goes through `genClampN`.

**The ledger.** `61_gen_frame.js` accumulates `{mass, cost}` per section as it
builds. Rather than tag every call site, the file carries a moving marker —
`sec('wings')` at each existing section boundary — and `B()` / `cover()` / `pt()`
bill whatever is current. Structure is priced by its own mass (`GEN_MATERIALS[
].price`, cr/kg); things that are BOUGHT rather than built call `spend()`
(`POWERPLANTS[].price`, `GEN_SUSPENSION[].price`, `GEN_PRICES` for wheels,
instruments, seats, paint). It surfaces as `parts.ledger` and `genShakedown`'s
`out.ledger` / `out.cost`.

GATE GEN checks the ledger **balances the lattice mass to 1e-6**. Attribution
that quietly loses a kilogram would still look plausible in the panel; the
lattice is the only thing that can contradict it. Stock aeroplane: 406 kg /
21 984 cr across 11 sections.

Note what the ledger does NOT do: it attributes mass that already existed and
adds cost, which is not in the lattice. **Paint has a price but no mass** — a
finish weight is a real thing and belongs in G3.3 with the materials, where it
can be calibrated instead of guessed. Adding it here would have broken the
byte-identity that made the whole reshape provable.

**The panel is nine sections**, `<details>` each, closed by default, with what
that part weighs and costs on the header. Nine lines of `58 kg · 2.4k cr` is
the most useful single view of an aeroplane you are building, and open-all runs
several screens deep. Fields the generator derives show the derived value in
italic and stop being italic the moment you drag them.

Two bugs found and fixed on the way:

1. **`rebuild()` pinned every derived field.** It wrote the built value back
   into the spec unconditionally, so the first rebuild froze `tailArm`, gear
   `track` and the tail sizes at whatever they happened to be — the aeroplane
   stopped re-deriving as soon as you touched anything. It now writes back only
   where the player owns the field. Verified: fitting the 750 kg radial moves
   the gear track 1.73 → 2.60 m and it stays AUTO.
2. **Sliders whose range could not reach the derived value.** `cabin.len`
   derives to 0.78 m against a 0.80 m minimum. resolveSpec fills nulls AFTER
   clamping, so a derived value is never clamped — the ranges have to cover
   what the generator actually produces, not what a player should ask for.

**dev.html now content-hashes its script refs.** `python -m http.server` sends
no `Cache-Control`, so Chrome falls back to heuristic freshness — a tenth of the
file's age — and serves a stale copy of an older file without revalidating.
`00_registry.js` had a `price` field that the page could not see, on a fresh tab,
on a fresh port, with a cache-busted URL: the file was months old, so its
heuristic freshness window was long. This is the "browser shows old code" flake
this document has blamed on the server three times. It was never the server.
`?v=<sha>` per ref, content not mtime, so a no-op rebuild leaves dev.html
byte-identical.

**Instrument worth keeping.** The byte-identity harness (18 specs written in the
OLD flat shape, dumping everything the solver reads — nodes, beams, strips,
refs, params) proved both halves at once: the reshape changed no geometry, AND
a legacy spec still loads. Any future spec surgery should re-capture it first.

**Open for G3:** garage as a place (physics off while building, roll out to
commit); materials properly, with metal and composite calibrated, fuselage shape
families and frame count; control surfaces and flaps; wing sweep, then biplanes;
wing-mounted engines (propwash is single-disc today and would be quietly wrong);
floats and skis; persistence LAST, now that the shape has stopped moving.

## G3.2 — THE GARAGE IS A PLACE (2026-08-10)

Building used to happen on the runway threshold with the solver running, so a
slider drag threw away whatever flight was in progress and the aeroplane was
always mid-settle. Now the Garage is somewhere you go.

**Physics off while building.** The loop guard is the whole mechanism:

```js
if (running && !inGarage) { script(1/60); sim.step(1/60); }
```

With the solver idle the sim stays exactly where `reset()` put it, which IS the
rest lattice rigidly placed — so `genNodeBody` returns the rest positions, the
skin poses to its rest shape for free, and no special "draw it undeformed" path
was needed. Nothing sags, nothing settles, nothing can diverge while you edit,
and the shakedown stays as expensive as it likes.

**The apron.** `APRON = {hdg: PI - 0.62, spawn: [26, 40]}` — in front of the
hangars the airfield already has at (42,62) and (16,54), quartered to the strip.
Terrain there is flat at 0 and it is 35 m from the strip edge. ROLL OUT is
`fullReset()`, which is the same reset-then-`placeAtAerodrome` the game always
did, so the flight path is byte-for-byte the one the gates already fly.

**standOnWheels().** The design lattice is drawn LEVEL — the deck angle is
something the aeroplane *acquires* by settling onto its third wheel under
gravity. With the solver stopped that never happens, so a taildragger stood in
the garage with its tailwheel 0.9 m in the air. This rotates the whole lattice
rigidly about the main axle until the third contact meets the mains':

    ux·sin a + uy·cos a = rTail - rMain

Rigid, so the skin still poses to rest and nothing is faked — it is the same
aeroplane, put down on its wheels. Measured against the shakedown's own
`deckAngle`: taildragger -10.25 vs 10.23, tricycle -1.20 vs 1.20, radial -15.02
vs 14.99. All three contacts land coplanar to 1e-3 on every configuration.

**That equation has two roots, and the far one flips the aeroplane onto its
back with all three contacts still perfectly coplanar.** It rotated a tricycle
170 degrees and the arithmetic never complained — the contact condition is
satisfied upside down. `asin` picks one root; take the one nearest zero.
Same family as the rest-attitude sign inversion in G2.3 (`atan` vs `atan2`):
ground-geometry solutions come in pairs and the wrong one always satisfies the
equation you wrote down.

**Build indicators.** CG and neutral point as upright posts, and the three
ground contacts as crosses. The GAP between the two posts IS the static margin
— the number that decides whether it flies, and the one thing a picture of an
aeroplane never shows you. 32 vertices; rebuilt on entering the garage and on
every spec change, static after that because in the garage nothing moves.

**genShakedown is now memoised on the fiche.** The panel and the indicators both
want it and it runs a trim solve in the wind tunnel — the expensive half of a
rebuild. One solve per aeroplane, not one per reader.

### The gate, and the gate that did not work

GATE UISMOKE gained: select the garage build, assert the rail says GARAGE, run
240 frames, assert it still does, then ROLL OUT and assert it flies.

**The first version of that check passed with the guard deliberately removed.**
`enterGarage` had been poking `phName.textContent = 'GARAGE'` over the rail
while leaving `railPhase` null — so when `script()` ran and called
`setRail(null)`, it matched the stale `railPhase` and returned early without
rewriting the text. The rail read GARAGE while the solver was stepping.

The fix was to make GARAGE a real state of the rail (`setRail('GARAGE')`) rather
than a caption written over it, which repaired the display bug and gave the gate
a genuine observable at the same time. Re-verified by negative control: guard
removed -> **FAIL**, guard restored -> **PASS**.

Worth keeping as a habit. A new gate should be run once against the broken code
it is meant to catch, because a check on an observable that cannot change is
indistinguishable from a check that works.

**Seen in the browser.** The aeroplane stands three-point on the apron beside
the hangars, the rail reads GARAGE, ROLL OUT commits it to the strip and the
autopilot flies. One thing the screenshot caught that no gate would have: the
indicator posts came out washed to near-white. Vertex colours go straight into
a LINEAR pipeline with ACES tone mapping, so feeding `--amber` and `--cyan`
raw as if they were sRGB lifts them almost to white and the two markers stop
being tellable apart. They are converted now:

| | sRGB | linear |
|---|---|---|
| amber | `#ffb257` | 1.000, 0.445, 0.095 |
| cyan  | `#63d3cc` | 0.125, 0.651, 0.604 |
| pale  | `#d3c3ae` | 0.651, 0.546, 0.423 |

The conversion itself is unverified visually — the Browser pane stopped
compositing again before it could be re-shot. Worth a glance next session; the
code path is exercised by GATE UISMOKE, so only the appearance is open.

A hidden Browser tab gets no `requestAnimationFrame`, so the sim does not step
and nothing renders. That reads exactly like a frozen simulation and cost time
before `document.visibilityState` settled it — check that first when the game
looks stuck in a pane that is not on screen.

## G3.3 — MATERIALS, AND FUSELAGE SHAPE (2026-08-10)

Two rows became four, and the aft body gained a shape family. Both are purely
ADDITIVE — the default aeroplane is still byte-identical to the pre-G3 lattice,
because `tubeFabric` and `wood` were left exactly as they were. They are
calibrated against the Cub and the Jodel, and widening a spread by editing a
measurement would be trading a fact for a preference.

### Aluminium is measured, not invented

`alloy`'s k/c are read straight off the C172 fiche — 8.0e5/500 through the
fuselage, 2.2e6/900 through the wing, 1.6e5/2600 in the gear — with
`refMass: 998`, that aeroplane's mass. The fleet already flies one metal light
aircraft, so it sets the numbers rather than a guess. refMass being high is
also what makes a SMALL alloy aeroplane come out in thinner sheet.

### Carbon's damping is the interesting number

First pass gave carbon 64 substeps against wood's 41. Lowering `k` moved
`omega*dt` and changed nothing: **the damping limit was binding, not the
stiffness limit** — the same trap this document already records. The fix was
not a fudge, it was a correction: composites are *lightly* damped. A carbon
structure rings where a bolted metal or glued wooden one does not. Setting
c to 250/500/1800 (the lowest of the four rows, by some way) is what the
material actually does, and it costs 50 substeps instead of 64.

Worth generalising: when the timestep is expensive, look at `c` before `k`.
`c*dt` binds first and the binding member is the GEAR in every row measured.

### The four rows, measured on the stock airframe

| | structure | all-up | substeps | Vs | L/D | price | chassis strain @400 kg freight |
|---|---|---|---|---|---|---|---|
| 4130 tube + fabric | 182 kg | 406 | 24 | 60 | 7.97 | 22.0k | 0.50% |
| spruce + ply | 180 kg | 404 | 41 | 59 | 8.20 | 24.0k | 0.65% |
| 2024 alloy sheet | 197 kg | 421 | 31 | 60 | 8.21 | 29.1k | 0.39% |
| carbon + epoxy | 144 kg | 368 | 50 | 55 | 8.23 | 35.8k | 0.08% |

**Wood was repriced 30 -> 55.** At 30 it was strictly cheaper AND lighter AND
stiffer AND slipperier than tube+fabric, which is not a choice. The `price`
field is defined as the FINISHED cost with labour in it, and a wooden airframe
is thousands of hours of gluing and clamping where a tube fuselage is a
fortnight of welding. Cost only, so no physics moved.

**Alloy's axis is stiffness under load, not weight.** It is the heaviest row and
dearer than wood, and on mass/price/drag alone it would be dominated. What it
buys is deflection: 0.39% chassis strain at 400 kg of freight against wood's
0.65%. Further up, at 1393 kg all-up (radial + 300 kg), tube+fabric stops
standing at all and rests on S0BL while the other three hold. That ranking is
measured, not asserted, and it is the reason the row exists.

Also worth stating plainly: `cd0` barely moves L/D (7.97 -> 8.23 across the
whole range) because induced drag and the strut dominate at these speeds. The
material's aerodynamic benefit is real but small; carbon is bought for mass and
stiffness, and the honest headline is Vs 60 -> 55.

### Fuselage shape families

The aft body tapers from the cabin box to the tailpost, and the family is the
PROFILE of that taper — an exponent on the station fraction, applied to width,
floor and deck together. `straight` 1.00, `waisted` 1.80, `boom` 0.45.

Deliberately NOT a preset over `crownTop`/`crownSide`. Roundness is already a
continuous knob, and a family that reset it would fight the sliders; this
changes geometry the sliders cannot reach. Half-widths, stock airframe:

    straight  0.36  0.29  0.23  0.17  0.10
    waisted   0.36  0.34  0.29  0.21  0.10     holds, then necks down
    boom      0.36  0.22  0.17  0.13  0.10     drops fast, then runs out

Mass follows: 406 / 409 / 402 kg. `straight` at exponent 1.0 takes the
untouched code path, which is why byte-identity survives.

Frame count was already a parameter (`fuselage.tailBays`, 3-6) and is exposed
in the panel; the shape family is what was missing.

### Gates

GATE GEN is 50 checks. Its MATERIALS block already walked the registry, so the
two new rows were gated the moment they existed — each must integrate inside
`omega*dt <= 0.50` / `c*dt <= 0.73` and fly to CRUISE. A new SHAPES block
checks each family tapers monotonically, differs from the default, and flies a
leg. **A shape that merely looked different while folding in the air would pass
a picture and fail an aeroplane** — which is the same lesson as the mid-wing
strut, and the reason no configuration in this generator is ever checked
statically.

All three families and all four materials were also confirmed in the browser.

## G3.4 — CONTROL SURFACES, TANKS, SYSTEMS (2026-08-10)

The solver and the autopilot have supported flaps since the fleet was written.
The generated aeroplane simply never had any: every strip carried `flap: 0` and
`params.flaps` was undefined. This wires them up, and makes the other surfaces
parameters rather than constants.

Purely additive again — default flap type is `none`, default chords reproduce
the fleet's taus exactly, default tank is `nose`, default systems fit is the old
hard-coded 12 kg / 2400 cr. **BYTE-IDENTICAL across all 18 baseline cases.**

### The pitching moment is derived, not chosen

Both flapped fiches agree on the ratio of flap pitching moment to flap lift:

    PA-18   dCm0 -0.40 / dCl0 1.60 = -0.250
    C172    dCm0 -0.29 / dCl0 1.15 = -0.252

So `GEN_FLAP_CM = -0.25` and `dCm0 = GEN_FLAP_CM * dCl0`. Two numbers that
looked independent turned out to be one, and the moment can no longer drift
away from the lift it belongs to. The gate asserts the ratio to 1e-9.

### Control effectiveness from chord

Thin-airfoil flap theory gives the hinge-line effectiveness

    tau = 1 - (theta - sin theta) / pi,   cos theta = 2c - 1

Raw theory OVERSTATES a real surface — gaps, limited throw, adverse yaw, a
fuselage in the way. At 22% chord it predicts 0.573 where the fleet flies 0.35.
So `genTauAt(c, refC, refTau)` scales theory so the fleet's own calibrated value
is reproduced at that surface's reference chord, and theory supplies only the
TREND away from it. Stock chords give back 0.500 / 0.550 / 0.350 exactly.

### `st.flap` is a fraction, not a flag

First cut flagged whole strips, and flap spans 0.50 and 0.62 produced the
IDENTICAL aeroplane — both caught the same strip centres. Each strip is half a
bay and has a real sub-span, so `flap` is now the fraction of that strip covered
by the device and the span slider is continuous (flapped area 2.05 -> 8.13 m2
across the range). The aileron flag is deliberately left binary: it is validated
and quantised the same way, but making it fractional would change roll authority
on the default aeroplane to buy nothing but slider smoothness.

### The bug the gate caught: Vref must come from the FLAPS-DOWN stall

`genAP` derives the approach speed as `1.42 * Vs`, and `Vs` is the CLEAN stall.
That is right for a flapless aeroplane and wrong the moment you fit a big
high-lift device. Measured on a Fowler-flapped build:

    t=192  APPROACH  V=83  alt=64  x=-961  aoa=-4.0  flap=1.00  thr=0.65
    t=258  APPROACH  V=85  alt=16  x=+590  aoa=-4.2  flap=1.00  thr=0.62

Stable, controlled, and flying a nearly flat glide at MINUS four degrees alpha
on two-thirds power — too fast for the wing it now had, so it sailed over the
touchdown zone and out the far side of the airfield, 1.6 km past the strip,
never landing. Nothing diverged and no static check would have blinked.

Fixed the way the real world does it: **Vref scales off Vso, the flaps-down
stall.** `buildGen` measures the flapped CLmax in the tunnel after trim (the
same second-pass pattern `genTrim` already uses for `stabTrim`) and rescales
`VAppr` / `VApprShort` by `VsFlap / Vs`. Every type now approaches at 1.42x its
OWN stall: none 84.6, plain 76.3, slotted 71.2, fowler 68.1 km/h.

| flap | dCl0 | dCm0 | CLmax | Vs (km/h) | ratio |
|---|---|---|---|---|---|
| none | — | — | 1.51 | 59.7 | — |
| plain | 0.95 | -0.237 | 1.82 | 53.8 | 0.911 |
| slotted | 1.60 | -0.400 | 2.09 | 50.2 | 0.850 |
| fowler | 2.05 | -0.512 | 2.28 | 48.0 | 0.813 |

The slotted row IS the PA-18's, and the PA-18's own measured ratio is 0.900
against this build's 0.850 at a wider flap span — the model is in the right
place.

### Tanks and systems

`fuel.tank` puts the fuel on the firewall (`nose`, the Cub's and the default),
the spar carry-through (`wing`), or out in the panel (`panel`, which relieves
the wing in flight and slows the roll). Mass only — burn is not modelled, so
this is the full-tanks case. `systems.fit` is minimal / basic / IFR at 6 / 12 /
26 kg and 700 / 2400 / 9500 cr.

### Gates

GATE GEN is 54 checks. New: every flap type must lower the stall by at least 4%,
keep `dCm0/dCl0` at exactly -0.25, and **fly a complete circuit to a full stop**
— which is the check that caught the Vref bug. Plus: stock chords must reproduce
the fleet taus, and chord must move effectiveness monotonically.

`genShakedown` now reports `ClMaxClean`, `ClMaxFlap`, `VsFlap` and `VsRatio`,
and the panel shows "stall, flap" next to the clean stall. Without that a flap
was a line in the spec that changed no number anyone could see.

## G3.5a — WING SWEEP (2026-08-10)

Additive: default sweep is 0, and `Math.tan(0)` is exactly 0, so the straight
wing takes the untouched path. **BYTE-IDENTICAL across all 18 baseline cases.**

### What sweep is FOR here

At 100 km/h sweep buys nothing aerodynamically — it is a compressibility device
and there is no compressibility in this game. It is in the Garage as a BALANCE
tool: it walks the aerodynamic centre aft **without moving the spar root off its
frame**. The root rib, the strut anchor and the carry-through all stay exactly
where they were; only the outboard structure moves. That is what makes it a knob
rather than a redesign.

Three pieces, and the interesting thing is how little code the third needed:

1. **Geometry.** `xFat(z) = xF + (z - zRoot) * tan(sweep)`, same for the rear
   spar, applied at the outboard spar stations and at the cantilever box's lower
   caps. The skin lofts its sections from the spar NODE positions, so it follows
   for free; only the aileron hinge marker needed the swept x.
2. **Aero.** Simple-sweep theory: only the velocity component normal to the
   quarter-chord line lifts, so `a0` and `ClMax` both take `cos(sweep)`. It goes
   with |sweep| — **forward sweep costs exactly as much as aft**, which is the
   honest reason forward sweep is not a free way to move the CG.
3. **Balance.** Nothing. The neutral point is MEASURED by probing the sim
   (`dM/dalpha / dL/dalpha`), so moving the spars aft moves the NP by itself.
   The one place a formula was needed is `xAC`, because the tail arm is derived
   from it — the AC sits at the quarter chord of the MAC, and sweep carries that
   aft by `yMac * tan(sweep)` with `yMac = (b/6)(1+2L)/(1+L)`. Without that a
   swept aeroplane would get a tail sized for a straight one.

### Measured

| sweep | a3d | CLmax | Vs km/h | np | static margin | tail arm | mass |
|---|---|---|---|---|---|---|---|
| -15 | 4.095 | 1.430 | 60.4 | 0.59 | **-4.2%** | 4.27 | 401 |
| -8 | 4.170 | 1.466 | 59.7 | 0.87 | 7.2% | 4.59 | 403 |
| 0 | 4.200 | 1.480 | 59.7 | 1.19 | 20.0% | 4.94 | 406 |
| 8 | 4.170 | 1.466 | 60.2 | 1.51 | 33.0% | 5.29 | 409 |
| 16 | 4.081 | 1.423 | 61.3 | 1.84 | 46.4% | 5.66 | 412 |
| 30 | 3.777 | 1.282 | 65.4 | 2.52 | **73.7%** | 6.38 | 422 |

Note the tail arm growing with sweep: it is derived from `xAC`, so a swept
aeroplane automatically gets a longer fuselage to keep its tail volume, which
makes it heavier and MORE stable again. That compounding is real and is why the
static margin leaves the 5-35% band by about 10 degrees either way.

The clamp is -15..+30 and deliberately wider than the sensible range. Forward
sweep to -15 gives a statically UNSTABLE aeroplane at -4.2% margin, and the
panel paints that red. Same policy as the too-soft undercarriage: a mistake the
player is allowed to make and be told about.

### Everything flew, so I looked harder

All seven angles flew a full circuit to a stop, including the unstable one —
the AP's gains are synthesised from the plant (G2.2), so it augments a mildly
unstable airframe the way a real SAS would. "It completed the circuit" is
exactly the evidence this document keeps warning about, so cruise elevator
activity was measured as well:

    sweep   de mean    de sd    peak rate
     -15    -0.98      0.074    0.1 deg/s
       0    -2.83      0.124    0.1 deg/s
     +30    -7.76      0.406    0.2 deg/s

Quiet everywhere — the autopilot is not fighting anything. The trim deflection
growing steadily with sweep is the honest signature of a more stable, more
nose-heavy aeroplane needing more download on the tail, not of a control problem.

### Gate

GATE GEN is 57 checks. The SWEEP block proves the purpose and the price
separately: the np must move aft **monotonically** across seven angles, `a3d`
must fall at every non-zero sweep and fall **symmetrically** (+8 and -8 identical
to 1e-12), and -15 / +12 / +30 must each fly a circuit. A sweep that moved the
CG for free would pass a picture and fail the second check.

**Not yet done in this phase:** biplanes (G3.5b). Sweep was the geometry-plus-a-
correction half; a second wing needs an interference model on each wing's
induced drag and a cabane/interplane structure, which is a larger piece.

## G3.5b — PLANFORM: TIPS, CRANK, DRONE, LABELS (2026-08-10)

Additive throughout. **BYTE-IDENTICAL across all 18 baseline cases.**

### Root and tip chord

The spec stores a root chord and a taper RATIO; a builder thinks in root chord
and tip chord. The panel's `@chordTip` / `@stabRoot` / `@stabTip` are DERIVED
controls (same mechanism as the NACA digit pair) rather than new spec fields, so
there is still exactly one number for the shape. Writing the tip holds the root;
writing the root holds the TAPER, so the tip scales with it — measured 1.60/1.00
-> 1.80/1.13. That is the simpler mental model, but it is a choice, not a law.

`tail.hChord` is the stabiliser's MEAN chord and `Sh = hSpan * hChord` is what
the strips' area comes from, so tapering holds the mean: root = 2c/(1+lambda).
**Tail taper is planform only** — area and aspect ratio are unchanged, so it
shapes the stabiliser without quietly re-tuning the pitch authority under it.
Verified: Sh 2.046 and static margin 20.0% at hTaper 1.00, 0.60 and 0.35.

### The cranked wing (two sections, and only two)

`crankAt` is the break as a fraction of semispan (0 = a single straight panel);
`dihedralOut` is the outer panel's angle. This is the Jodel wing — a flat centre
section and sharply dihedralled outer panels — and it is a real structure, not
styling: the crank is where the outer panel bolts on.

The break gets **its own spar station**, because the dihedral changes across it
and without a node at the kink the two panels would be joined by a straight
member cutting the corner. A station landing within 0.12 m of the crank is
dropped rather than left as a zero-length bay. Measured at crankAt 0.5:
stations 0.36 / 1.91 / **2.68** / 3.45 / 5.00, spar heights 1.10 / 1.18 / 1.22 /
1.41 / 1.80 — shallow to the break, steep beyond.

### Tip treatment

`GEN_TIPS` = square / rounded / Hoerner / winglet, carrying an Oswald multiplier
and a shape. Measured eAR 14.77 / 15.22 / 15.53 / 16.29, L/D 7.90 -> 8.11. The
multiplier is applied BEFORE the Raymer cap, so a winglet on an already
efficient wing cannot conjure e past the ceiling. The same table drives the
stabiliser and fin tips.

### The drone body

A fourth seating row. The step between the firewall top and the cabin top IS
the windscreen (63_gen_skin.js), so a drone is expressed by making that step
zero: `deck` moved from a hard-coded 0.70 into the seating rows, `cowlDeck`
became nullable and derives from it, and the drone's is 1.00 — the nose runs
continuously into the body with nothing to break. 0.20 half-width, 0.30 high,
no crew, 352 kg all-up.

### CG and NP, labelled

Canvas-texture sprites, `sizeAttenuation` off so they stay legible at any zoom,
in the same amber and teal as the posts.

**They are CG and NEUTRAL POINT — not centre of lift.** The NP is where the
pitching moment stops changing with alpha: the aft limit the CG must stay ahead
of, and the gap between the posts IS the static margin. The centre of lift is a
different thing and moves with alpha; labelling it that way would say something
false about what the gap means.

### Gates

GATE GEN is 62 checks. The PLANFORM block requires span efficiency to be ORDERED
across the four tips, the crank to put a node exactly at the kink AND break the
dihedral slope there, the drone to have no step and no crew — and winglet, Jodel
crank and drone each to fly a circuit.

GATE UISMOKE caught the label code the moment it existed: `THREE.CanvasTexture
is not a constructor`. The headless stub had no sprite classes. Fixed in the
STUB, not by guarding the app — production code should not carry defences for a
test double.

### Still open from this request

**The V-tail (Bonanza) is NOT in this pass.** It is not a planform change: the
strip frames are per-kind in the shared solver (`stab` takes `yUp` as its
normal, `fin` takes `zRt`), so a V needs a new `kind` with a normal tilted by
the panel dihedral and BOTH control inputs mixed into it — symmetric deflection
for pitch, antisymmetric for yaw. On top of that, one surface doing both jobs
changes the tail sizing (Vh and Vv come from the same area now) and the AP's
pitch and yaw gains are synthesised from that plant. That is its own phase, with
its own gate.

## G3.5c — THE V-TAIL (2026-08-10)

Additive: default `tail.type` is `conventional`. **BYTE-IDENTICAL across all 18
baseline cases.** This is the first change to touch `30_solver.js`, which the
whole fleet shares, so it is a new strip KIND rather than an edit to an existing
one — no hand-written fiche can see it.

### The mixing falls out of the geometry

A V panel's normal is canted INWARD, which is the same geometry that gives a
dihedralled wing its roll stability:

    n = cos G * up  -  side * sin G * right

Both panels then lift upward together (their lateral parts cancel in symmetric
flight) and oppositely in yaw. The ruddervator is one line:

    al = (1-downwash)*al + stabTrim - elevTau*de - rudTau*dr*rudderSign*side

Symmetric in `de`, antisymmetric in `dr`. Nothing asserts that the mixing works;
the solver resolves it from the strip normals.

### Two projections, not one

Sizing and the plant model both need cos G, but not the same power of it, and
conflating them is the easy mistake:

- A pitch RATE reaches the panel only through its tilted normal, and then only
  the vertical part of the resulting force makes a pitching moment: **cos^2 G**.
- A ruddervator DEFLECTION makes alpha in the panel's own frame, so only the
  force needs projecting: **cos G**.

So `genPlant` accumulates two areas — `ShC` for control power (Mde) and `ShD`
for damping (Mq) — which are the same number on a conventional tail and differ
on a V. One number for both would have over-damped every V-tail by cos G and
mis-tuned its pitch loop. Sizing follows the same rule:

    S = max( Sh / cos^2 G , Sv / sin^2 G )

whichever volume coefficient binds. At 33 degrees yaw binds (3.03 vs 2.92 m2);
at 45 pitch does. That is why real V-tails are big.

### The bug the circuit could not find

**A V-tail with its ruddervator sign inverted flew a complete circuit and
landed.** The autopilot coordinates turns mostly with roll, so reversed rudder
read as slightly sloppy rather than broken. Only a direct probe showed it:

    conventional   d(yawLeft)/d(dr) = +3814
    V-tail 33      d(yawLeft)/d(dr) = -6991

I had written `+ side` reasoning from the panel going "outboard and up". The
normal leans INWARD, so the panel that goes nose-up pushes the tail toward the
centreline, not away from it.

**Control POLARITY needs a probe, not a lap of the circuit.** This document has
said repeatedly that static checks pass on aeroplanes that cannot fly; this is
the mirror image — a flight test passing on an aeroplane whose controls are
wired backwards. The gate now measures d(yaw)/d(dr) and d(pitch)/d(de) against
the conventional tail's signs, and requires rudder-to-pitch cross-talk under 2%
of pitch authority (measured 0.3-1.2%).

### The second bug: an index contract in a file this work never touched

Dropping the rudder from the skin's `surfaces` array for a V-tail renumbered
every entry after it. `sid` on a skin vertex is an index INTO that array
(`surfaces[sid-1]`), so the ailerons started reading past the end —
"Cannot read properties of undefined (reading 'ramp')" from `50_model_codec.js`
on the first V-tail rebuild. The entry now always exists and is made inert with
`k: 0`. Gated: every `sid` any group emits must resolve to a surface.

**Known visual limit:** the V panels carry the elevator's surface id, so they
deflect with pitch and not with yaw. The physics is right; the picture only
shows half of what the ruddervators are doing.

### Measured

| V angle | S (m2) | eff Sh | eff Sv | dYaw/dr | dPitch/de | x-talk | SM |
|---|---|---|---|---|---|---|---|
| conventional | — | 2.05 | 0.90 | 3814 | 7807 | 0.2% | 20.0% |
| 25 | 5.02 | 4.12 | 0.90 | 9068 | 17509 | 0.3% | 31.1% |
| 33 | 3.02 | 2.13 | 0.90 | 6991 | 9742 | 0.3% | 20.4% |
| 45 | 4.09 | 2.05 | 2.05 | 12234 | 11166 | 0.6% | 17.7% |
| 55 | 6.22 | 2.05 | 4.17 | 21532 | 13870 | 1.2% | 14.1% |

### The Bonanza test

Built a V35B-alike: alloy waisted body, side-by-side, low cantilever wing at
10.20 m span and 0.58 taper, tricycle on oleos, slotted flaps, IFR panel, wing
tanks, V-tail at 33 degrees.

| | real V35B | built | |
|---|---|---|---|
| span | 10.21 m | 10.2 | -0% |
| wing area | 16.5 m2 | 16.9 | +2% |
| all-up | 1542 kg | 662 | **-57%** |
| wing loading | 93.5 | 39.2 | -58% |
| Vs flaps | 107 km/h | 63 | -41% |

It stands, it flies a circuit, it lands at 2.20 m/s.

**The shape is right and the mass is not, and the reason is specific.** The
aerodynamics scale correctly — ballasted to 1070 kg the loading went to 63.3 and
Vs to 79 km/h, against `Vs ~ sqrt(W/S)` predicting 79.6 — and extrapolating to
the real 93.5 kg/m2 gives 95 km/h against the actual 107, the remaining gap
being the Bonanza's laminar 23000-series wing having a lower CLmax than the
NACA 2412 the generator assumed.

The mass shortfall is in identifiable places: engine 144 kg (an IO-360 and its
prop) where an IO-520 is nearer 240; two seats where a Bonanza has four; 27 kg
of fixed gear where a retractable on a 1500 kg aeroplane is nearer 70; and
242 kg of airframe structure where a certified 1000 kg-empty machine carries
closer to 450. **The generator builds homebuilt-class structure. A certified
1500 kg retractable is outside what its `lin`/`cover` rows are calibrated for,**
and no V-tail work would change that — it is a materials-and-scale question.

GATE GEN is 64 checks.

## STRUCTURAL REALISM — how bendy are we? (GATE FLEX, 2026-08-10)

User report: *"the planes twist like they're gum sometimes"* — worst on the
GARAGE build, least on the skinned fleet, *"but the underlying physical model
also seems a little flimsy"*. There was no deflection instrument in the battery
— the circuit harness's outer-panel flap ANGLE is a safety bound and says
nothing about whether the angle is realistic — so the first job was to build one.
`tools/test_flex.js`, GATE FLEX, appended last so the battery log prefix stays
diffable. It asserts only finiteness and determinism, deliberately: asserting
realism targets nobody has agreed to would trade a fact for a preference.

**The headline is not what the arithmetic predicted, and that is the point of
measuring.** Reasoning from `k` alone says the truss is 40-90x too soft (below),
which would imply absurd deflections. Measured, the tip deflections are **2-7x**
a real aeroplane's, not 40x — a lattice distributes load across many members and
the geometry carries most of it. Two of the four materials are already realistic.

### A — tip deflection, % of semispan, from a quasi-static elevator ramp

Slope of tip rise against load factor, fitted over the whole sweep. Reality
column is handbook / static-test class figures: a strut-braced light aircraft
does ~0.3-1 %/g and a glass sailplane — the bendiest certified thing that flies
— about 4-6 %. **The SLOPE is the measured quantity.** A hands-off ramp at
de = 0.35 runs out of energy around n = 1.5-2.8, so the 3.8 g column is the
fitted line carried past the data — legitimate for a linear structure, but it is
an extrapolation and the gate prints it marked EXTRAP.

| | %/g | at 1 g | at 3.8 g | verdict |
|---|---|---|---|---|
| GEN carbon + epoxy | **0.39** | 0.39 | 1.48 | realistic |
| GEN spruce + ply | **0.72** | 0.67 | 2.69 | realistic |
| GEN 2024 alloy | **0.86** | 0.77 | 3.20 | realistic |
| drone | 0.32 | 0.08 | 0.96 | realistic |
| cub / pa18 | 1.70 | 1.37 | 6.13 | ~2x soft |
| **GEN 4130 tube + fabric** | **1.79** | 1.56 | 6.58 | ~2x soft — **and it is the DEFAULT** |
| c172 | 2.56 | 1.61 | 8.77 | ~3x |
| dc3 | 3.61 | 2.46 | 12.58 | ~4x |
| jodel | 4.51 | 3.18 | 15.80 | sailplane territory, on a wooden two-seater |
| chinook (before) | **6.73** | 6.82 | 25.66 | beyond anything real — **FIXED, see below** |
| chinook (after) | 0.22 | 0.24 | 0.87 | now the stiffest in the fleet |

**The player builds in the default and the default is the bendiest generated
row.** That single fact explains most of the report: switch the stock airframe to
wood, alloy or carbon and it is already inside the real band.

### B — torsion, and the surprise

Root-to-tip change in section incidence under full aileron. Real GA wings twist
1-2 deg. Measured: **cub 0.71, c172 0.21, dc3 0.09, jodel 0.06, GEN rows
0.19-0.68**. The wings are *stiffer in torsion than reality*, not softer.

**But read the STATIC row, not this one.** The in-flight number is confounded by
anything the aeroplane does while you are measuring it — the chinook's 29.92 deg
turned out to be mostly a spiral dive to -89 deg of bank, not a soft wing. GATE
FLEX therefore also applies a **static antisymmetric tip couple** (equal and
opposite couples at the two tips: zero net force, zero net moment, so nothing
accelerates and no aerodynamics are involved), at TWO torques. The second torque
is the point: a linear structure doubles its twist, and anything well under 2x
stiffened geometrically on the way, which means it started near a mechanism.
That ratio is the only instrument in the battery that sees it, and it is what
condemned the chinook.

| deg @200 N.m | @400 | doubling | |
|---|---|---|---|
| jodel 0.45 | 1.00 | 2.21x | stiffest — the cantilever box |
| carbon GEN 0.39 | 0.82 | 2.10x | |
| alloy GEN 1.07 | 2.10 | 1.97x | |
| c172 1.29 | 2.64 | 2.04x | |
| chinook 2.22 | 4.68 | 2.11x | **after the fix — was 16.4 / 24.6 at 1.50x** |
| tubeFabric GEN 2.37 | 4.63 | 1.96x | |
| cub / pa18 2.72 | 5.51 | 2.03x | |

**So "twist like gum" is NOT wing torsion.** It is bending, plus whole-airframe
deformation, plus the ×4 bug below. Two outliers earned their own line: the
**drone 2.59 deg**, and the **chinook 29.92 deg**, which together with its 6.73
%/g made it the fleet's one genuinely gum airframe. **The chinook is FIXED** —
see THE CHINOOK WING below; it now reads 0.68 deg and 0.22 %/g. The drone's
2.59 deg is inside the real 1-2 band's neighbourhood and is left alone.

### C — softness: `k` against the structure it claims to be

`F = k*(L-L0)` with `k` an absolute N/m per member, carrying no length and no
cross-section. Physics says `k = EA/L`. The area is **not a new number**: `lin`
is kg/m, so `A = lin/rho` is already implied by the mass model — and it comes out
right, tubeFabric's fuselage A is 0.58/7850 = 7.4e-5 m2, which IS 1" x 0.035"
4130 tube. `GEN_MATERIALS[*].phys` (E, rho, sigY) exists only so GATE FLEX can
divide; **nothing in the solver, the generator or the viewer reads it.**

Mean over the class, with the per-member range beside it:

| material | A fus | fus | wing | gear |
|---|---|---|---|---|
| tubeFabric | 0.74 cm2 | x85 (x53..x665) | x20 (x6..x384) | x873 (x547..x3772) |
| wood | 11.11 cm2 | x51 (x32..x401) | x5 (x2..x100) | x316 (x188..x1298) |
| alloy | 1.80 cm2 | x40 (x25..x311) | x9 (x3..x168) | x345 (x214..x1500) |
| carbon | 2.45 cm2 | x39 (x24..x311) | x14 (x4..x262) | x541 (x321..x2198) |

The WING path is the stiffest relative to physics and the FUSELAGE is 4-8x
softer than it — which is why the GARAGE build, whose skin rigs every vertex to
the truss, shows body deformation the fleet's wing-band-only skins cannot. The
gear is soft on purpose: it is the suspension.

**THE SPREAD IS THE BIGGER FINDING.** Within a single class it runs 12-60x —
x6 to x384 across the tubeFabric wing. `k` is a constant per class and `EA/L` is
not, so softness scales LINEARLY with member length: **the compliance is wrong in
SHAPE by more than it is wrong in level**, and the short members are the softest
relative to the structure they stand for. That is the argument for a length-aware
`k` (`k_ref * L_ref/L`) ahead of any global multiplier. It is not free, though —
making the short members honest RAISES their omega, and omega*dt is what
`genSubsteps` bounds. Measure before committing.

### D — load against allowable, and what it means for a failure model

Peak `|k*(L-L0)|` during the sweep, against `sigY*A`: **tubeFabric 13 %, wood
8.9 %, alloy 6.8 %, carbon 0.9 %**. This was the question that decides whether
rupture is worth building, and the answer has a sting in it:

**Failure is a FORCE threshold, not a strain threshold.** `F = k*eps*L0`, so a
limit written as `Fy = sigY*A` is physically correct *even though the springs are
40x too soft* — softness only exaggerates the displacement on the way there. That
means yield, buckling and rupture can be added with **no change to `k`, no change
to substeps, and no re-anchoring of a single existing gate**. But at 13 % of
yield under a 1.8 g pull with full aileron, **a force-calibrated failure model
would never trigger in flight** — it would be a crash-only phenomenon. Whether
that is right (an aeroplane you cannot pull the wings off) or wrong (no over-g
consequence at all) is a design call, not a physics one, and it needs an explicit
knockdown either way.

### THE CHINOOK WING — fixed 2026-08-10, and what it cost

The one airframe GATE FLEX condemned outright. Fixed in `12_aircraft_chinook.js`;
the trap is that the wing was the *easy* part.

**The diagnosis needed three instruments, and the first two lied.** In flight
under full aileron the twist ran to 29.92 deg — but a time trace showed it
tracking BANK, not aileron: the aeroplane was in a spiral dive at -89 deg. At
MATCHED bank it still twisted 10x the Cub, so something was real. A **static
antisymmetric tip couple** (equal and opposite couples at the two tips: zero net
force, zero net moment, so the aeroplane does not accelerate and no aerodynamics
are involved) settled it: **132 deg/kN.m against cub 15.3, gen 12.1, c172 6.8,
jodel 2.4** — and it was the only airframe in the fleet with a NON-LINEAR
response (16.4 deg at 200 N.m, 24.6 at 400), the signature of a near-mechanism.
Per-station, the twist was all OUTBOARD: +9.3 and +8.2 deg in the two outer bays
against -1.1 in the strut-braced inner one.

**Cause.** The struts braced station 1 (z=2.00) and nothing beyond, leaving
3.34 m — 63% of the semispan — hanging on a triangular box whose bays are 1.70 m
long and 0.16 m deep. Ratio 9.3%: **structural rule 5, which this aeroplane's own
BOOM had already paid for** ("la section 8 cm etait un mecanisme, depth/bay 7%")
without anyone applying it to the WING.

**Four cures measured, not argued:**

| | 200 N.m | 400 N.m | cost |
|---|---|---|---|
| baseline | 16.4 | 24.6 | — (non-linear) |
| + X under the box | 15.0 | 24.2 | 6 beams — the faces were not the problem |
| + four-chord box (rule 2) | 8.4 | 15.1 | 46 beams, 8 nodes, 72 substeps — and still non-linear |
| + struts to station 2 only | 8.8 | 13.8 | 4 beams — STILL non-linear |
| **+ strut fan to the tip** | **2.2** | **4.7** | **8 beams, 0 nodes, 0 mass, 0 substeps — LINEAR** |

Linearity was the acceptance criterion, not the value. It is the Cub's own cure
and for the Cub's own reason — the HANDOVER calls that six-member fan "the lumped
stand-in for a spar box this planar wing does not have". At 0.16 m of depth no
in-wing structure competes with an anchor 1.25 m BELOW the wing (rule 1).

**Then it cost three more re-anchors, because the fiche was sitting on knife
edges.** Worth reading as a set — a stiffer wing stops washing out under load, so
it keeps lift the autopilot was tuned to lose:
1. **`vsFloor` -0.11 -> -0.15.** `holdVS` clamps the PITCH command, and -0.11 rad
   is -6.30 deg. Measured, the aeroplane sat at theta -6.30 EXACTLY — pinned —
   climbing 0.48 m/s for ever (208 m against hCruise 120 on a long leg). Level
   now needs -7.51 deg. Swept: -0.13 ends 23 m high, -0.14 holds exactly (and is
   the drone's value, the fleet's widest), -0.15 gives 1.1 deg for gusts.
2. **`maxS` 300 -> 330** in the gate. Touchdown moved 295.5 -> 300.2 s: the gate
   reported "touchdown FAILED" because it had stopped watching 0.2 s early. The
   aeroplane had landed properly. **A budget is not a verdict.**
3. **`rolloutPitchMin` -4 -> -7.** The braked transient deepened -3.6 -> -5.1.
   Measured before moving it, because that check exists to catch NOSE-OVER: the
   closest structure stays **0.640 m** off the ground through the whole rollout,
   nose-over is at 26.07 deg, and the Rotax 277 is a PUSHER so there is no
   prop-strike path at any attitude.

**Result:** tip deflection 6.73 -> **0.22 %/g**, torsion 29.92 -> **0.68 deg**,
peak chassis strain 7.08% -> **1.06%**, cruise-hold peak-to-peak 1.32% -> 0.01%.
Roll authority came back with it — the wing had been twisting away half the
aileron, and roll rate went -30 -> -47 deg/s at full deflection.

**Honest caveat: it is now the STIFFEST wing in the fleet** (0.22 %/g against a
real light aircraft's 0.3-1), which is arguable for a 230 kg ultralight. The knob
is `K_W`, documented at the fix site. Lower it if wanted — but never by returning
to a non-linear response, and re-run all three anchors above if you do.

### THE GARAGE MATRIX — the configuration space, measured (2026-08-11)

Until this block existed the Garage's structure was verified at **exactly one
point** of a space spanning 6.5-14 m of wing, 2-5 panels, three wing positions,
strut or cantilever, four materials and a cargo bay. GATE GEN flies eleven
configurations but measures no deflection; GATE FLEX's fleet half measures
deflection but only at the stock spec. Nothing crossed the two.

GATE FLEX now walks 28 configurations statically (no world, no autopilot, no
aero — cheap and deterministic) and **asserts the doubling ratio >= 1.80**. That
assertion is a structural invariant rather than a preference: a linear structure
twists twice as far under twice the couple, and anything materially under 2
stiffened geometrically on the way, i.e. started near a mechanism.

**Two traps in the instrument itself, both found by stiffening the wing and both
worth knowing before trusting a ratio.** (1) SETTLE UNDER GRAVITY BEFORE TAKING
THE BASELINE. The aeroplane sits on its gear in the tunnel and droops onto the
springs over the ten-second run — an offset that does not scale with the couple.
While the wings were soft that droop was a few percent of the twist; once
`wingK` landed it was the whole reading, and `strut span 7` reported 0.10 deg at
BOTH torques (ratio 0.99x). The instrument was measuring the undercarriage.
(2) A RATIO NEEDS A DEFLECTION TO BE A RATIO OF. Below `TORS_FLOOR` (0.05 deg at
200 N.m) the honest answer is "too stiff to rate", not a verdict — two
configurations now sit there. Both traps read as "your stiffest airframe is a
mechanism", which is the diagnostic to recognise.

**It found two near-mechanisms immediately, both reachable from the panel, both
older than this chantier, and both invisible to the whole existing battery.**

#### The strut fan skipped stations — FIXED

`61_gen_frame.js`'s fan reached exactly three stations: `0`, `mid = 1`, and
`WF.length - 1`. `wing.panels` is a player slider clamped 2..5, so at 4 panels
the fan skips station 2 and at 5 panels it skips 2 AND 3. Those stations then
hang between fan members on a planar two-spar wing with no box — rule 1 with the
barrier taken out. Measured, span 13 / chord 1.6, deg @200 N.m and doubling:

| panels | before | after |
|---|---|---|
| 2 | 2.38 / 1.98x | unchanged |
| 3 | 3.84 / 1.97x | unchanged (byte-identical) |
| **4** | **21.41 / 1.56x** | **4.18 / 2.01x** |
| **5** | **28.73 / 1.46x** | **4.53 / 2.06x** |

Worse than the chinook's pre-fix 16.4 / 1.50x, and **invisible to every other
instrument in the battery** — the rank test passes throughout because the
framework stays infinitesimally rigid. Cure is the chinook's and the Cub's: fan
to every station. Appended after the existing members so the emission order is
untouched and panels <= 3 stays bit-identical (LATTICE 208 beams before and
after, and the matrix numbers for `stock` are unchanged to the last digit). One
known wart left alone: at panels 2, `mid` and `length-1` are the same station, so
that pair is emitted twice — a duplicated beam is double stiffness; it measures
linear and stiff, and unpicking it belongs in its own commit.

#### The cranked wing was the same defect from another direction — FIXED

**A crank INSERTS a spar station**, so at the DEFAULT 3 panels the jodel-crank
preset already has four, and the fan already leaves the outer panel unbraced.
Measured, it was the worst corner in the whole space: **22.95 deg @200 N.m at a
doubling ratio of 1.34x** — worse than panels 5, worse than the chinook. It had
been there since G3.5b, passing GATE GEN's circuit every time.

**And it could not be cured by extending the fan.** Doing so made the aeroplane
stop completing a circuit: a stiff member from the pod bottom up to a station
14 deg along the outer panel re-rigs the aeroelastics of nodes that carry strip
force, which is rule 10's "wires that anchor to strip-force-carrying nodes
re-rig the aeroelastics" arriving from a new direction. Two measurements, both
needed — the static one to see the mechanism, the circuit to see the cure break
the aeroplane.

So `useStrut` now also requires `!(w.crankAt > 0)`: **a cranked wing gets the
box**, which is what the real aeroplane this planform comes from actually has —
the Jodel fiche is a cantilever. It measures 2.76 / 5.39 at 1.95x and flies.
Same shape of rule as `strutMinOffset`, and visible the same way: the panel
reports `bracing: cantilever box`, so the substitution is never silent.

**The general lesson, which is the one to carry:** the fan covers `0`, `mid` and
`last`, so it is exact at three stations and leaks at four or more — and
station count is driven by TWO independent inputs, `panels` and `crankAt`.
Anything else that inserts a station will leak the same way. The doubling ratio
is the guard; keep new planform features in the GARAGE MATRIX.

#### The cantilever box is the Garage's real gum — NOT fixed, decision needed

No mechanism anywhere in the matrix now (every doubling 1.89-2.13x). But
bending, under 2 kN DISTRIBUTED over the stations, splits hard by bracing:

    strut        0.6 - 1.2 %   flat across span 7-14 AND panels 2-5
    cantilever   2.0 - 7.3 %   (tubeFabric 6.7, alloy 3.1, carbon 2.3, wood 2.0)

Confirmed in flight, which is the number that matters:

| config | %/g | at 1 g | vs reality (0.3-1 %/g) |
|---|---|---|---|
| stock (strut) | 1.80 | 1.46 % | ~2x soft |
| **high cantilever** | **14.90** | **12.64 %** | **~15x** |
| low cantilever | 9.57 | 12.92 % | ~10x |
| cantilever span 13 | 5.07 | 15.37 % | |
| carbon cantilever | 3.64 | 3.19 % | ~4x |

**12.6% of semispan at 1 g is twice a glass sailplane** — the bendiest certified
thing that flies sits at 4-6% — and it is one click in the panel. It is worse
than the chinook wing ever was (6.82%).

**Why, and why there is no free fix.** The box depth is `sparBoxDepth 0.13 *
chord` = 0.159 m at the default chord, over 1.67 m bays: depth/bay 9.5%, rule 5
again, the same slenderness that condemned the chinook wing and the chinook
boom. Geometry is already exhausted — 0.13*chord is slightly MORE than the
NACA 2412's max thickness, and the spars sit at 15% and 65% chord where the
section is thinner still, so the box cannot be made deeper. Densifying does not
help either: cantilever panels 2->5 moves bending only 7.3 -> 6.6.

**The insight worth keeping: the strut fan was HIDING the global `k` softness.**
A strut works through a geometric lever arm 1+ m below the wing, so it does not
care that `k` is 5-20x softer than `EA/L` through the wing. A cantilever has no
lever arm and shows the true stiffness of the material model. The Garage's
cantilever is therefore not a separate bug — it is STRUCTURAL REALISM's own
finding, arriving through the one configuration that cannot paper over it.

**FIXED 2026-08-11 — `GEN_RULES.wingK = 4.0`. Read the constant for the full
measurement set; the summary is below and the rest of this subsection is kept as
the diagnosis that led to it.**

| | before | after (wingK 4) | reality |
|---|---|---|---|
| stock (strut), the default build | 1.80 %/g, 1.46% at 1 g | **0.80 %/g, 0.69%** | 0.3-1 %/g |
| high cantilever | 14.90 %/g, 12.64% at 1 g | **3.37 %/g, 2.88%** | |
| low cantilever | 9.57 | 3.30 | |
| cantilever span 13 | 5.07 | 4.50 | |
| carbon cantilever | 3.64 | **0.89** | |
| substeps, strut / cantilever | 24 / 28 | 45 / 55 | |

**The default build is now inside the real band.** The cantilever is out of the
absurd (it was twice a glass sailplane in level flight) and into sailplane
territory; x8 would take it near-real at 2.7x the solver cost instead of 1.9x,
and the only reason not to is that substeps are gate time. Mass, CG, Sw and L/D
are untouched — this changes no geometry.

Across the whole GARAGE MATRIX, static bend under 2 kN distributed:

    before   strut 0.6-1.2 %   cantilever 2.0-7.3 %
    after    strut 0.3-0.9 %   cantilever 1.0-4.5 %

**The price is gate time, and it is not small.** GATE GEN flies eleven circuits
with the generated aeroplane, so its cost tracks substeps almost exactly: it
went **372 s -> 635 s**. The core battery lands at ~14.6 min against the old
full battery's ~19, i.e. tiering bought about 9 minutes and the stiffening gave
about 4.4 of them back. If the battery ever needs to be faster, `wingK` is the
first dial to look at and the honest trade is written above.

**The lever is `k.wing`, and it is a CORRECTION rather than a buff — the mass
model has already paid for it.** `lin.wing` 0.62 kg/m over rho 7850 is 0.79 cm2
of cap, and `E*A/L` at a 1.7 m bay is **9.5e6 N/m against the 5.0e5 in use: x19
soft**. The aeroplane is already carrying the mass of a cap nineteen times
stiffer than the spring it gets. So this is not "heavier caps for cantilevers",
which was the first (wrong) reading — it is the wing half of STRUCTURAL
REALISM's own softness column, and the strut fan's lever arm is what let it hide
everywhere except here.

Measured cost, `k.wing` multiplied, bend % and the substeps `genSubsteps` then
demands:

| k.wing x | strut bend | cantilever bend | substeps |
|---|---|---|---|
| x1 (today) | 1.00 | 6.48 | 24 / 28 |
| x2 | 0.52 | 3.25 | 32 / 39 |
| x4 | 0.30 | 1.61 | 45 / 55 |
| x8 | 0.19 | 0.76 | 63 / 78 |
| x16 (~physical) | 0.13 | 0.33 | 89 / 110 |

**This also corrects the pessimistic estimate earlier in this section.** "Full
physical stiffness needs 240-500 substeps, past the cap of 200" assumed a GLOBAL
multiplier against the fuselage's x39-85. The WING alone is only x19 soft, and
taking just the wing all the way costs **110 substeps, comfortably inside the
cap** — roughly 4x the generated aircraft's solver cost. At x4 the strut lands
at 0.30 (~0.5 %/g in flight, inside the real 0.3-1 band) and the cantilever at
1.61 (~3 %/g), for 45-55 substeps. That is the cheapest honest fix in this whole
chantier and it fixes BOTH bracings at once.

**The chinook lesson did NOT repeat, and that is worth recording.** The fear was
that a wing which stops washing out keeps lift the autopilot was tuned to lose,
producing `vsFloor`-class saturation. It did not happen: both bracings fly a
full circuit unchanged, because the generated fiche's autopilot gains are
SYNTHESISED from the plant (`genGains`, G2.2) rather than inherited, so they
move with the aeroplane. The hand fiches are the ones that carry hand-tuned
constants — which is exactly why the chinook needed three re-anchors and the
generator needed none.

### BUILD -> LOAD TEST -> FLY, in the garage (2026-08-11)

The order a homebuilt actually goes in, and now the order the game does: you
build it, you put the bags on the wing, and only then do you roll out. The rig
lives in **`src/core/65_gen_loadtest.js`** — NOT in the gate — because the
garage ticks the same object per frame that GATE LOAD ticks headlessly. One
computation, so an in-game verdict and a battery verdict cannot disagree.

- `makeLoadTest(sim, def, cfg)` returns `{ step(dt), state }`. It runs IN PLACE
  on the live sim: lifts the aeroplane clear of the ground, bolts every non-wing
  node down, and hangs the bags on the wing. **The covering bends for free** —
  the generated skin is an affine blend of the same nodes carrying the load.
- Panel: `Load test the wing` sits ABOVE `Roll out`, with a live readout that
  climbs with the load (+g, tip in % and cm, worst member vs yield) and ends on
  a verdict. Roll out is not locked — it is your aeroplane — but it reads
  **"Roll out untested"** in amber until the wing has held.
- **A changed spec loses its certificate.** Every edit comes back through
  `enterGarage()`, which clears `rigTested`: you tested the aeroplane you had,
  not the one you now have.
- **The rig marks the build tested, not the panel.** The panel is a view; when
  it owned that flag a headless run left a tested aeroplane marked untested, and
  GATE UISMOKE caught exactly that. `markTested` was removed from the bridge and
  the gate now asserts the panel *cannot* write model state.
- GATE UISMOKE drives the whole flow — it stubs `garageInit` to capture the
  bridge (the render block is not executed there, so the bridge would otherwise
  be skipped entirely), runs the rig to completion and asserts deflection grows
  with load. It logs `load test: HELD — limit 2.94% ultimate 4.34% of semispan`
  then `garage -> roll out -> TAKEOFF ROLL`.

Known cut: the aeroplane does not visibly go onto trestles and no sandbags are
drawn — the fuselage simply holds still while the wing bends. Both are art, not
physics, and the physics is the part that had to be right.

### GATE LOAD — the sandbag test (2026-08-11)

The real proof-of-structure for an amateur-built aeroplane, and the load case
every deflection number above was approximating. FAR 23 normal category: **+3.8 g
LIMIT** with no permanent set, **+5.7 g ULTIMATE** (1.5x limit) without failure.
`tools/test_load.js`, core tier, **16 s** — it is static, so it is cheap.

Bags are laid over the wing strips in proportion to `st.area` and applied through
each strip's own `st.w` weights, i.e. down the same path the solver applies lift,
so the load sits where the lift does by construction rather than by a second
approximation that could drift from it.

**THE RIG TOOK THREE GOES, and each wrong one was confidently wrong.** Worth
reading before building any other load case in this project:
1. **Load the wing, let the aeroplane's own INERTIA react it.** A legitimate
   pull-up on paper. But only the wing is loaded and nothing balances the
   pitching moment, so it rotated under the measurement: the C172 read 1.25 % at
   1 g and **-0.95 % at 3.8 g**.
2. **React at the wing root stations**, making it self-equilibrated in FORCE.
   Net MOMENT still is not zero — the wing load's x-centroid is not the root
   nodes' — so it rotated slowly instead of quickly, and at 5.7 g the body frame
   flipped mid-run and the trace jumped from 5.10 to 0.22.
3. **Bolt the fuselage down.** Every non-wing node is pinned each step, which is
   what trestles ARE. No moment to balance, nothing to tumble.
Plus: **ramp the load and relax the deformation velocity.** DEFDAMP is a rate
with tau = 2 s, and a step load left the wing ringing past fifteen seconds
(measured, second by second at 1 g: 2.03 -> 0.51 -> 0.97 %). Averaging that
samples the ring. Dynamic relaxation — bleeding only the velocity relative to
the mass-weighted mean, so rigid motion is untouched — converges to the same
static answer quickly, and is legitimate because only the settled state is wanted.

**The assertion that keeps it honest is LINEARITY**: 3.8 g of bags must give
3.8x the deflection, within 15%. All three broken rigs above failed it, and the
working one passes at 3.73x / 5.58x. Cross-check worth having: the stock build
reads **0.74 % at 1 g here against 0.69 % from GATE FLEX's in-flight sweep** —
two unrelated instruments, one static and one flown, agreeing to 0.05 points.

Measured, tip deflection as % of semispan (1 g / limit / ultimate):

| | 1.0 g | 3.8 g | 5.7 g | worst member at ultimate |
|---|---|---|---|---|
| tubeFabric strut (stock) | 0.74 | 2.76 | 4.13 | 64% of yield |
| wood strut | 0.85 | 3.31 | 4.94 | **282%** |
| alloy strut | 0.51 | 1.94 | 2.95 | 88% |
| carbon strut | 0.16 | 0.62 | 0.92 | 8% |
| tubeFabric cantilever | 4.56 | 17.06 | 25.31 | **144%** |
| wood cantilever | 1.36 | 5.14 | 7.69 | 93% |
| alloy cantilever | 2.29 | 8.62 | 12.85 | 77% |
| carbon cantilever | 1.15 | 4.36 | 6.53 | 10% |
| PA-18 | 2.29 | 8.90 | 13.61 | n/a |
| C172 | 3.17 | 11.64 | 17.11 | n/a |

**PERMANENT SET IS PROXIED, NOT SIMULATED** — the solver has no yield model (see
the costed design below), so it is read as peak member force against `sigY*A`,
which IS the load at which the member takes a set and is correct even on soft
springs because failure is a force threshold.

**The two over-yield rows are REPORTED, NOT GATED, and the reason matters.** The
load is right and the force is right (the root bending moment checks out by
hand), but the ALLOWABLE is coarse: `A = lin/rho` gives ONE area for the whole
wing class, and the worst-loaded member in those rows is not a spar cap — it is
the **3.4 m LIFT STRUT**, which a real aeroplane sizes separately. Wood is the
loud case because it pairs a big section (12.9 cm2) with a small allowable
(39 MPa crushing): a WOODEN lift strut, which nobody builds — wooden aeroplanes
use steel struts, and the Jodel is a cantilever precisely to avoid the joint.
Gating that would gate the proxy, not the aeroplane. **What it is really saying
is that strut sizing wants its own area**, which is a materials-model change and
the obvious next piece of work here.

### RUPTURE AND PERMANENT SET — the costed design (NOT implemented)

Asked for in the same report; deferred by the user to measure first. Recorded
here so it can be built without re-deriving it. It is one chantier, it does not
touch the flight model, and it is additive in the G3.3/G3.4 sense: **a beam with
no limits declared behaves exactly as today**, so the log diff stays empty.

- `60_gen_spec.js` — `phys` already exists. Add `sigU`, `eBreak`, `brittle`.
- `61_gen_frame.js` — in `B()` (the beam constructor, which already has `cls`
  and `L`), stamp `Fy = sigY*A`, `Fu = sigU*A`, and
  `Fc = min(Fy, pi^2*E*I/L^2)`. **The compressive/buckling limit is the highest
  value line in the whole change**: a slender tube buckles far below yield, it
  makes LONG members fail first, and buckling is the failure mode that actually
  happens in a crash. It also uses the length that `k` currently ignores.
- `30_solver.js:284` — about twenty lines:

      if (b.broken) { b.strain = 0; continue; }        // no force at all
      let Fe = b.k * (L - b.L0);
      if (b.Fy) {                                      // undeclared = today
        const lim = Fe >= 0 ? b.Fy : -b.Fc;
        if (Math.abs(Fe) > Math.abs(lim)) {
          const dLp = (Fe - lim) / b.k;                // plastic flow
          b.L0 += dLp; b.plast += Math.abs(dLp) / b.L0;
          Fe = lim;
          if (b.plast > b.eBreak || Math.abs(Fe) > b.Fu) b.broken = true;
        }
      }
      const Fb = Fe + b.c * vrel;

- **Permanent set falls out of moving `L0`.** That IS the bent tube; there is no
  second system to keep in sync. `reset()` already recomputes `L0` from `def`,
  so RESET REPAIRS THE AEROPLANE FOR FREE — clear `broken`/`plast` there too.
- `k` never increases, so omega never rises: **every existing substep count
  stays valid** and `genSubsteps` needs no change.
- The covering is an affine blend of the truss nodes, so a bent or broken
  airframe deforms its own skin for nothing — and it lands hardest on the GARAGE
  build, which is where the user is looking.
- One numerical trap to design against: RATE-LIMIT the plastic flow per substep,
  or an oscillating member ratchets its way to destruction.
- **The calibration question, from section D:** peak in-flight load is 0.8-13 %
  of yield, so straight `sigY*A` limits would make failure crash-only. Decide
  deliberately whether that is the game you want; if over-g must have a
  consequence, the knockdown has to be explicit and written down, not tuned
  until it feels right.

### The ×4 bug — the user's own confusion was a real defect

*"The ×4 deformation is confusing, because it's unclear what's applied in the
view structure."* It was applied. `poseModel` read `SKIN_GAINS[min(skinMode,1)]`,
so mode 2 got gain 4 — and for a generated aeroplane `showSkin` is true in every
mode, so Bare frame drew the welded truss at **four times its real deflection
with no ×1 reference on screen**. The fleet's Frame mode returns early and was
always honest; the two disagreed silently. Fixed: only mode 1 exaggerates, and
every mode's gain is now in the button (`Covered ×1 / Flex ×4 / Frame ×1`).

### Left open, deliberately

Stiffness is NOT touched here. `genSubsteps` bounds `omega*dt <= 0.45` and
substeps go as sqrt(k) with `aeroPass` inside every one, so x4 stiffer costs x2
substeps and physical stiffness (x40) would need 150-300 — past the cap of 200.
Full realism is out of reach for an explicit integrator at 60 Hz. Options, all
fleet re-anchoring events and all cheaper than they look now that only two rows
are actually out of band: (i) make `k` length-aware (`k_ref * L_ref/L`) — fixes
the SHAPE of the compliance without raising its level, so substeps barely move;
(ii) a bounded global multiplier; (iii) the chinook alone.

**Two things NOT to do.** Do not reach for `DEFDAMP` — it is a rate, tau = 2 s,
and raising it damps flight behaviour, not just the look. Do not raise the gate
strain thresholds to match: they are 15-30x real elastic limits (4130 yields at
0.22 %, spruce crushes at 0.36 %, 2024-T3 at 0.47 %, carbon UD breaks at 1.1 %)
and that gap is the honest record of how soft the lattice is.

## G3.6 — PLAYTEST FIXES (2026-08-10)

A feedback pass. The full list became the G4 plan; these are the items that were
unambiguous and cheap. **BYTE-IDENTICAL across all 18 baseline cases.**

**Boundary:** another thread owns STIFFNESS and RUPTURE (`tools/test_flex.js`,
`GEN_MATERIALS.k/c`, the beam law in `30_solver.js`). Nothing here touches them.
The "too bendy from the tail" report is answered as GEOMETRY — a deeper tailpost
truss — which is a different lever on the same complaint.

### The wheel track ran away to its clamp

Reported as "the track gets reset to the max value every time I change
something, like it's getting incremented". It was.

`genFrame` computes `tr = (S.gear.track ?? derived) + place.dtrack`, and
`buildGen` writes that offset-INCLUSIVE result back onto `S.gear.track`. The
panel then displayed the built value and, for any field the player owned, copied
it into its own spec — so `dtrack` was added again on every rebuild. `gear.x`
has the identical flaw with `place.gearDx`.

The rule is now one line and has no special cases:

    an AUTO field shows what the generator DERIVED;
    a field the player owns shows what the player SET.

and nothing is written back. Verified: track holds at 1.90 through six unrelated
slider edits.

Worth keeping in mind generally — **a value that is derived from an offset must
never round-trip through the control that feeds it.** The G3.1 writeback was
introduced so a clamped value would display as clamped; it did that, and it also
built an accumulator.

### The propeller wobbled and drifted off the thrustline

`buildModel` rigs EVERY skin group for flex, and that included `prop`. So the
blades were vertex-deformed toward the engine nodes while the mesh was spinning
about its hub — a correction applied in a rotating frame, which is a wobble, and
which also walks the disc off the thrustline as the engine node moves.

Props are rigid bodies. The rig list now excludes any group named `prop*`.

The geometry itself was never wrong: measured about the hub, the blades are
symmetric to 0.0003 m and the hub tracks `place.dy` correctly. Measuring that
first is what pointed at the render path instead of the generator.

### Smaller

- **Shakedown is a section.** Its own collapsible, first in the panel, header
  reading price / weight / power / span, so a fully collapsed panel still says
  what you have built.
- **Disclosure arrows** on every section header.
- **Tail-end section is settable.** `tailW` / `tailBot` / `tailTop` were in the
  spec from the beginning with no control, so every aeroplane got the same
  0.10 m half-width tailpost whatever its size. Three sliders, and clamps.
- **Rounded tips are actually round.** The tip was ONE shrunk station — a blunt
  corner. Now `arc` stations swept round a quarter circle of radius
  `reach x tip chord`. Default `rounded` is a true half-round; added `clipped`
  and `elliptical`.

### Fixed, measured, and reverted

The drone's cowl collapsing below its engine. Flooring the firewall ring on
engine size widened EVERY aeroplane's nose and broke the baseline — and the
premise was wrong: **a Cub's cylinders stick out of its cowl on purpose.** A
cowl is not obliged to enclose its engine. The right fix is cowl diameter as its
own parameter, which is a G4 item.

### Known inconsistency introduced

A rounded tip now reaches about half a tip chord PAST the last spar station, so
visible span exceeds aerodynamic span by ~1 m on a 10 m wing. Real wings do this
(the spar stops short of the tip bow) but `span` here means the aero span. To be
resolved in G4.

### Measured, for the G4 plan: can the cabin be cut?

The body skin is `GEN_RADIAL = 20` segments AROUND each section but only ONE
quad ALONG each bay, and the bays ARE the structural rings — the whole cabin is
two bays. So a canopy or window as a TRANSPARENT MATERIAL BAND works today, but
a window or door as an actual HOLE does not: there is no longitudinal resolution
inside a bay to cut against, and cutting on ring boundaries would put the
opening exactly where the frames are. Real openings need a skin-subdivision pass
(extra rows per bay that are not structural stations) before anything is built
on top of them.

## G4.1 — CONTROL SURFACES THAT MOVE (2026-08-10)

Skin only. No physics touched, and nothing near the other thread's stiffness
work. **BYTE-IDENTICAL across all 18 baseline cases.**

Before this: ailerons, elevator and rudder hinged; flaps did not exist visually
at all; and a V-tail's panels carried the ELEVATOR's surface id, so ruddervators
never showed yaw. Now every surface the aeroplane has deflects.

### The sign trap, and the bug it had been hiding

The left and right hinge AXES are mirrored — each runs outboard along its own
semispan — so an equal `sgn` on the two sides produces **opposite** motion in
the world, and a mirrored `sgn` produces the **same** motion. That inversion is
the whole difficulty, and it reads backwards at a glance:

    ailerons   ANTIsymmetric  ->  equal sgn
    flaps      symmetric      ->  mirrored sgn

Measuring every surface under every input found four sign errors, one of them
**pre-existing since G1.4: the ailerons deflected TOGETHER** (both wings
+0.020 m on `da`). Four chantiers of screenshots never caught it, because a
surface animating smoothly in the wrong direction looks exactly like one
animating correctly unless you look at both wings at once and know which way
they should go. The generated elevator was also inverted — `de` is a NOSE-UP
command and nose-up is trailing edge UP, and it was going down.

Measured after the fix, mean vertical displacement of each surface's own
vertices:

| input | conventional | V-tail |
|---|---|---|
| de = +0.3 | elevator +0.031 | vtailR +0.073, vtailL +0.073 |
| da = +0.3 | ailR -0.018, ailL +0.020 | same |
| dr = +0.3 | rudder moves 0.081 | vtailR +0.073, vtailL -0.073 |
| flap = 1 | flapR -0.136, flapL -0.136 | same |

### Two drives on one surface

A vertex carries ONE surface id, but a ruddervator is the elevator and the
rudder at once. `applyHinges` gained an optional second drive:

    ang = sgn * k * ctl[drive]  +  sgn2 * k2 * ctl[drive2]

An additive, backward-compatible change to `50_model_codec.js` — the imported
PA-18/C172 surfaces have no `drive2` and are untouched. The V panel is then
symmetric on `de` (mirrored sgn) and antisymmetric on `dr` (equal sgn), which
matches the solver's own mixing.

### The surface table is now fixed at eight

    1 elevator  2 rudder  3 ailR  4 ailL
    5 flapR     6 flapL   7 vtailR  8 vtailL

**Every entry is always present.** A configuration that lacks a surface gets it
with `k: 0` rather than having it removed, because the array index IS the
per-vertex `sid` and dropping an entry renumbers everything after it — which is
exactly how the V-tail work sent the ailerons reading past the end of the array
(G3.5c). Making the table fixed-length removes that failure mode by
construction rather than by care.

### Hinge lines follow the specified chords

`AIL_HINGE` was a hard-coded 0.72 and `aStart` a hard-coded 0.62 of semispan,
both predating the control-surface parameters. They now come from
`controls.aileron.chord` / `.span`, and the flap band from
`controls.flap.chord` / `.span`, so a 30% aileron looks like a 30% aileron.

### Known limit — FIXED in G4.2 below

The span boundaries quantised to spar stations: a flap asked for 0.50 semispan
rendered out to 1.91 m instead of 2.50, and the aileron started at 3.45 m
instead of 3.10. The aero was always exact (G3.4's fractional strip coverage);
only the picture stepped.

### Gate

GATE GEN is 65 checks. The new SURFACES MOVE block asserts, for a conventional
and a V-tail build: pitch surfaces are trailing-edge UP on positive `de` (and
symmetric on a V), ailerons are antisymmetric, flaps are symmetric AND down, and
the yaw surface moves (antisymmetrically on a V). Every one of those would have
passed silently as a "the surfaces animate" eyeball check.

## G4.2 — WING SKIN SUBDIVISION (2026-08-10)

Skin only. **BYTE-IDENTICAL across all 18 baseline cases.**

### First, a correction

I reported in G3.6 that the body skin has "only ONE quad ALONG each bay" and
that cabin openings would therefore need a subdivision pass before anything
could be built on them. **That was wrong.** `GEN_LSEG = 3` — the fuselage has
had three lengthwise slices per bay since G1.4, with `sectionRow(i, s)`
interpolating both the section and the node influences (`kA = 1-s`, `kB = s`).
The cabin is two bays, so it already has six divisions lengthwise against
twenty around.

The error came from measuring badly: I histogrammed skin vertices by x and read
the result as fuselage stations, but the count is dominated by the WING, which
lofts along z and so scatters x across hundreds of distinct values. The number
was real and the interpretation was invented. **A measurement of the wrong
quantity is worse than no measurement, because it carries the authority of one.**

So the body was never the problem, and cabin openings are less blocked than I
said. The WING was the problem.

### What was actually wrong

Wing skin rows existed only at spar stations — four of them for the default
three panels. Every control-surface boundary snapped to the nearest one.

Now the spanwise station list is: every spar station, PLUS the surface edges as
breakpoints, with each resulting interval subdivided `GEN_WSEG = 2` ways. A
boundary therefore lands ON a row.

`wingSectionAt(pF, pR, wF, wR, ...)` takes spar POINTS and influence LISTS
rather than two node indices, so an intermediate row carries four influences —
the chordwise blend times the spanwise one, which is what the loft was already
doing implicitly between stations. Subdividing adds resolution on the same ruled
surface and moves no geometry, which is why the lattice is untouched.

Measured, across three span settings:

    flap -> 2.50 (want 2.50)   aileron <- 3.10 (want 3.10)
    flap -> 1.75 (want 1.75)   aileron <- 3.50 (want 3.50)
    flap -> 2.90 (want 2.90)   aileron <- 4.00 (want 4.00)

One subtlety worth the comment it now carries: **both boundaries have to be
INCLUSIVE of the row sitting on them.** The aileron test was `z > aStart - eps`
and the flap's `z < fEnd - eps`, so the flap band stopped one subdivision short
while the aileron was exact. Asymmetric epsilons in a pair of tests that look
symmetric.

Wing skin cost: 1770 -> 2400 vertices with flaps fitted.

### Gate

GATE GEN is 66 checks. SURFACE BANDS asserts each band's edge lands within
2 cm of `span x semi` at three different settings — the check that would catch
the snapping coming back.

### Still open

The rounded tip arc reaches past the last spar station, so the aileron band
extends to 5.89 m on a 5.00 m semispan and the visible span exceeds the
aerodynamic span. That is the G3.5b tip/span inconsistency, still unresolved,
and it is now visible in the surface bands as well as the outline.

## G4.3 — THE TIP IS THE PLANFORM (2026-08-10)

**This one intentionally changes physics.** The baseline was re-captured; the
default aeroplane's reference area moves 16.00 -> 15.55 m2 and its stall 59.7 ->
60.4 km/h. Asked for directly: "update the lifting behaviour so we get WYSIWYG".

### What was wrong

G3.5b put the rounded tip in the SKIN: extra rows pushed OUTWARD past the last
spar station, with the section scaled by `1 - (1-round)*sin(theta)`. Two
consequences, both visible in the playtest screenshot:

- the scale bottomed out at `round` = 0.30, so the tip ended in a **30%-chord
  slab** — a parallelepiped, not a curve
- the rows reached half a tip chord PAST the tip, so the wing you saw was ~1 m
  wider than the wing that flew

### What it is now

The tip lives in `chordAt()`. The planform runs straight to `semi - R`, then the
chord closes to nothing on a half-ellipse whose tip is at exactly `semi`:

    chord(z) = c_joint * sqrt(1 - ((z - zJoint)/R)^2)

`R` is `bow` x the chord AT the joint, which is implicit, so it settles by three
fixed-point iterations. `bow: 0.5` is a true half-round of the tip chord.

Because it is in the planform, **one function feeds the rib masses, the covered
area, the strip areas, the reference area and the outline.** A tip that existed
only in the mesh was a wing that lifted where there was no wing. Reference area
now subtracts the bow analytically — a half-ellipse of span R and chord c_joint
loses `(1 - pi/4)` of the rectangle it replaces, both tips.

Measured, default wing: chordAt tracks the ellipse to the digit at every
station, and max |z| over the whole skin is 4.999 against a 5.00 semispan on
every tip type. WYSIWYG.

### Drawing it: step in ANGLE, not in span

The bow rows are placed at `zJoint + R*sin(theta)` for theta up to 0.965 x 90
degrees. Uniform z spacing would crowd every row into the first third of the
curve and leave the last quarter — where all the curvature is — drawn by two
quads, which is the other half of why the old tip read as a box. Measured: 8
rows over the bow, max angular step 12.4 degrees, sagitta 4.7 mm on an 800 mm
radius (0.6%).

### The trap it set, and the rule that removed it

`chordAt` now returns ZERO at the tip, and the cantilever spar box takes its
depth from the chord. That put a **zero-length beam** between the upper and
lower caps at the tip station — the strain = Infinity trap from G2.3d, back
again by a different road.

Fixed the way rule 1 says: geometrically, not with a degenerate-beam guard. The
box follows the STRUCTURAL chord (`linC`, the linear taper); the bow is a light
fairing outboard of the spar box, which is what it is on a real wing. Verified:
minimum beam length 0.0815 m across all six tip types on a cantilever wing.

| tip | R (m) | joint z | Sw | AR |
|---|---|---|---|---|
| square | 0 | 5.00 | 16.00 | 6.25 |
| clipped | 0.24 | 4.76 | 15.84 | 6.32 |
| rounded | 0.80 | 4.20 | 15.55 | 6.47 |
| elliptical | 1.28 | 3.72 | 15.18 | 6.61 |
| Hoerner | 0.48 | 4.52 | 15.67 | 6.38 |
| winglet | 0.32 | 4.68 | 15.78 | 6.34 |

### The garage control check

Reported as "I still see no moving surfaces". The surfaces DO move — G4.1
measured every one and the flaps are visible on approach — but **the garage
stops the solver, so every control sits at zero and nothing ever deflects where
you spend all your time.** The report was right about the experience.

The garage now sweeps them: four sine periods (0.90 / 0.62 / 0.45 / 0.33 rad/s)
so nothing syncs up and each surface can be watched on its own — a control check,
which is what you do before flight anyway. Physics is off in the garage so
writing `ctl` there has no consequence, and roll-out zeroes it in `reset()`.

## G4.4 — CONTROL SURFACES ARE SEPARATE MESHES (2026-08-11)

Skin and viewer only; no physics. The per-vertex hinge path is **retired for
generated aeroplanes** — zero tagged vertices remain. It stays for the imported
PA-18 and C172, which are baked that way.

### Why the old approach had to go

G4.1 tagged skin vertices with a surface id and rotated them in place. User
verdict: "you deform a single mesh, that's rubbish and causes a lot of issues...
Right now the ailerons are affecting the wing tip, that's ridiculous."

Correct, and the tip case shows exactly why it was a design fault rather than a
bug. Per-vertex rotation moves *whatever carries the tag*. When G4.3 ran the
planform out to the tip, the bow rows inherited the aileron's tag and the whole
rounded tip swung with the stick. Every fix would have been another exception in
a scheme whose default was wrong.

The propeller was the one thing in the file that always behaved — because it was
already a rigid mesh with a pivot.

### The cut

A control surface is now its own group, its own closed mesh, its own pivot and
axis. The enabling piece is sampling the aerofoil as EVALUATORS instead of a
fixed point list:

    genAfEval(naca)          -> { up(x), lo(x) }
    genAfSeg(naca, a, b, n)  -> closed loop over chord fractions a..b

The fixed skin lofts [0..hinge] and the surface [hinge..1], both with constant
row counts, so each stitches on its own. Sampling BOTH at the same parameter
`hinge` makes the cove and the surface's leading edge the same points by
construction — there is no gap to close and no tolerance to tune. `emitLoft`
gained a `close` flag to wrap the loop, which a cut section needs and an intact
aerofoil does not (its ends meet at the trailing edge).

Rows already landed on the band boundaries from G4.2, so the cut lines existed
before the cut did.

Six meshes on a conventional aeroplane — `ailR ailL flapR flapL elev rud` — and
six on a V-tail, where `vtR`/`vtL` carry two drives each.

### In the viewer

Each surface is a mesh whose geometry is translated so the pivot IS its origin,
positioned at the pivot, and turned with `quaternion.setFromAxisAngle`. Exactly
how the propeller is handled. They are excluded from the flex rig for the same
reason the prop is: a vertex deform applied inside a frame that is itself
turning fights its own rotation.

They do ride the deflection of the spar they hang on — a rigid translation from
the attachment node's motion — so a bending wing does not leave its aileron
behind.

### Three things measurement caught that the design did not

**1. The cut silently did nothing.** `wingSectionAt` had been changed in G4.2 to
take a point list — except it never was. It still mapped the module-level `af`
and my new argument landed in its `sid` parameter, so the "fixed" skin and the
"surface" were both built FULL CHORD and the aeroplane grew a second wing that
rotated. User: "it looks like a duplicated wing that rotates". Measured: both
spanned x -0.492..1.108, identical. The tail was right the whole time because
`panel()` builds its own points directly.

Worth the scar: an argument added to a signature that the body never reads is
invisible to every test that only asks whether the output is plausible. The
measurement that found it took one line — the chordwise extent of each group.

**2. The cuts came out triangular.** A cut row next to a full-chord row lofts as
a RAMP from the hinge line out to the trailing edge, so each band end was a
wedge. The flap's root end looked right only because the band starts at the
first station and has no neighbour to ramp from. Fixed with an edge loop: the
boundary station is emitted twice, once with each neighbour's chord range, and
the zero-width step between them IS the end wall — the rib face at the end of a
real aileron.

The wall has to sit on the station INSIDE the band. Placing it on the far side
left the cutout a subdivision longer than the surface filling it (a flap ending
at 2.50 left the wing open to 2.80). Verified by counting triangles whose three
vertices share one z: walls at exactly +/-2.50, +/-3.10, +/-4.20 against meshes
spanning 0.36..2.50 and 3.10..4.20.

**3. The corners shaded wrong.** Rows do not share vertices, but a single
boundary row was shared between the wall strip and the skin strip beside it, so
`computeVertexNormals` averaged a near-vertical face into a near-horizontal one
— a dark smear on every cutout corner. Each wall row is now emitted twice: the
wall gets its own vertices, and the zero-area strip between the pair
contributes no normal at all.

### Signs, again

The mirroring rule reappears because it was never about the mechanism: with the
hinge axes running outboard on each side, **a mirrored `sgn` produces the SAME
world motion and an equal `sgn` produces OPPOSITE motion.** Ailerons want equal,
flaps want mirrored. Got flaps backwards on the first pass — both went up
together, symmetric and useless — and the gate caught it.

And they had to be re-measured once the cut became real: while the "surface"
was still a full-chord copy its centroid sat FORWARD of the hinge, so every wing
sign came out inverted and had been calibrated against the wrong body. The tail
never moved, because `panel()` was cutting correctly from the start.

Measured on the finished geometry: elevator +0.037 (TE up on positive de),
ailerons -0.052/+0.052, flaps -0.100/-0.100, V-tail +0.038/+0.038 on de and
antisymmetric on dr.

### Gate

GATE GEN is 68 checks. SURFACE MESHES rotates each mesh about its own pivot and
asserts the same senses as before, plus **zero vertices may still carry a hinge
tag** — which is what proves the old path is actually gone rather than merely
unused. AILERON EXTENT asserts the aileron stops at the bow joint (4.20 m
against a 5.00 m semispan), the specific absurdity that started this.

### Also

UV `v` is now the true span fraction rather than the row index. With the
surfaces lofted separately, row-index `v` gave every one of them its own copy of
the paint's tip stripe at its inboard end; span fraction makes the paint
continuous across the cut, which is the point of cutting there.

## G4.5 — THE REGISTRATION IS A DECAL (2026-08-11)

Skin and viewer only. Reported as "the UV mapping is screwed up, the writing is
all squeezed at the back. It either needs to be a decal, or we need to live UV
map better."

### Why it squeezed

The body's `u` is NORMALISED ANGLE — every station spans 0..1 around its own
section — while the fuselage circumference shrinks toward the tail. So a glyph
of fixed u-width covers less and less physical distance the further aft it sits.
The text was painted into the body texture, so it inherited that compression.

Nothing was wrong with the paint. The parameterisation is right for what it was
designed for: the cheat line and the belly shading are ANGLE features and should
follow the section as it narrows. It is only wrong for anything that has to keep
its own proportions, which is exactly what a decal is.

### What it is now

A `decal` group: two patches built from the body's OWN rows, so they conform to
whatever shape the fuselage happens to be, lifted 6 mm along the local outward
normal, carrying a plain 0..1 grid of their own. The registration cannot
distort because none of the body's parameterisation reaches it — the sheet is
drawn in `genRegDataURI` and appears on the aeroplane as drawn.

`u` runs ALONG the body and `v` around it, so the sheet's long axis is the
aeroplane's long axis. The far side is flipped so the registration reads the
same way round from either beam, which is what it does on a real aeroplane.

70 vertices, 96 triangles, spanning 45%..78% of the run to the tailpost on the
two side arcs (u 0.15..0.35 and its mirror).

### Two things wrong with the first cut

**It came out black.** `transparent` in the mats table was never read —
transparency was inferred from `opacity` alone, so a material carrying its alpha
in the TEXTURE rendered fully opaque and its clear pixels showed as black. Fixed
with `alphaTest`, not blending: a decal is a cut-out, and cut-outs belong in the
opaque pass where they write depth and never need sorting.

**The far side read backwards and upside down.** Walking both side arcs in the
same index direction gives them opposite handedness when each is seen from
outside, so flipping `u` on the far side was a SECOND flip and the two composed
into a 180-degree rotation. The fix is to walk the far arc BACKWARDS and flip
nothing: then both sides share one (u, v) frame relative to their own outward
normal. Verified: u = 0 at x = 1.12 and u = 1 at x = 2.89 on both sides, so the
registration reads nose-to-tail from either beam.

### WIRE and UV

Two diagnostics, because the squeeze was invisible from outside the mesh and
obvious the moment its parameterisation was laid out flat.

**Wire** flips `wireframe` across the material cache — one pass, keyed by
material name, so it catches the whole aeroplane and survives a rebuild.

**UV** draws every group's triangles in texture space over the paint sheet at
55% opacity, one colour per group, with a legend. `v` is flipped because texture
space is bottom-up and canvas is top-down. This is the tool that makes a
stretched or mirrored island visible BEFORE it is on the aeroplane.

### What this does NOT fix

The general `u`-compression is still there for anything else painted on the aft
body. That is deliberate — the user's own note was "maybe we can keep the
reskinning for later" — and the decal mechanism is now the answer for any future
marking that must hold its shape: squadron codes, roundels, trim that has to
stay straight. A proper arc-length remap of the body would change every existing
painted feature and belongs with the material-appearance work, not here.

### The decal was 180 degrees out, and the numeric check could not see it
FIXED in G4.6 below, along with the rule and the gate. Left here as the record:
this section shipped "verified numerically but unseen", and it was wrong.

## G4.6 — THE UNDERCARRIAGE (2026-08-11)

Playtest items **11, 12, 4, 18** — one chantier, because they are all the same
hardware, and the user's own ordering ("undercarriage first, it is the ugliest
thing on the aeroplane and it is all cheap geometry with no physics risk").
No solver constant moved. Verified in the viewer, with pictures, which is how
three of the five defects below were found at all.

### 11 — the wheels

A wheel was a 14-segment cylinder with two flat lids, `v = 0` on one lid and
`v = 1` on the other. It is now a REVOLVED PROFILE in two meshes:
- `tyre` — bead, sidewall bulge (widest at 80% of the radius), shoulder, crown.
- `wheelhub` — hub cap, dished disc, rim barrel. Its flange point IS the tyre's
  bead point, so the two meet exactly with no gap to close.
Both from `genRevolveInto`, whose UV is **u = angle around, v = ARC LENGTH along
the section**. That is the whole of "sane UV": a band at v = 0.5 is the crown, a
band near 0 or 1 is a sidewall, and nothing stretches. The lids it replaced were
a single texel row smeared over a triangle fan — nothing could be painted on
them, which is what "badly UV mapped" meant.

Sizes are tied to the radius: half-width 0.40 R (an 8.00-6 is 0.20 m across a
0.44 m diameter; the old wheels were 0.055 m on a 0.20 m radius and read as
hockey pucks) and the bead at 0.42 R (a 6 inch rim in a 16 inch tyre; drawn
first at 0.55 and the wheel came out as a pale disc with a band of rubber round
it). 24 segments, not 18 — a wheel's silhouette is a circle and the eye knows.

`genTyreDataURI` (garage.js) is the sheet: rubber, sidewall moulding rings, and
four **circumferential ribs**, which is the tread an aviation tyre actually
wears. That choice does real work: ribs are u-invariant, so **a wheel that never
spins still reads correctly**, and no wheel-rotation machinery was needed. A
block tread would have been periodic in u and its stillness obvious at every
taxi speed. Same reason the hub is deliberately axisymmetric with no bolt circle.

### 12 + 4 — one mechanism: `vis`

A beam now carries `vis`, which says what the member IS. It never touches k, c,
mass or the rigidity matrix — `ext`/`vis` are read ONLY by 63_gen_skin.js, so the
physics is untouched by construction, and gear beam count/k/c/L are identical
across every variant (measured).

    null     hexagonal tube, as before
    'wire'   9 mm bracing wire or tie rod
    'leg'    the suspension leg, drawn as bungee / spring steel / oleo
    'inner'  structural, but inside the covering: goes in the `frame` mesh, so
             it stands in Frame mode and is absent from the covered aeroplane

`'inner'` is the honest form of "hide it": Frame mode's whole job is to show the
structure that was welded, so a member is never dropped, only moved under the
skin. The tailwheel's near-vertical snap-blocker (rule 10) runs from below the
wheel to the TOP of the tailpost — straight up through the fuselage — and is the
one member that qualifies.

Thirteen gear members, and what they are now:
| | taildragger | tricycle |
|---|---|---|
| leg | tailpost member + 2 main fore legs | 2 firewall legs + 2 main fore legs |
| tube | axle + 2 main drag braces | same |
| wire | 2 tailwheel side braces, 2 stab-tip pyramid, 2 belly cross | 4 nose links, 2 belly cross |
| inner | 1 snap-blocker | — |

That is item 12: six fat tubes at the tailwheel became one leg, four wires and
one internal. The belly cross members went to wire for the same reason — as
48 mm tubes they made the undercarriage read as a cage, and an X of bracing wires
under the belly is both what a tube-and-fabric aeroplane has and the same load
path. 12 mm wires were tried first and left the tailwheel looking braced by
scaffolding poles.

Item 4, the springing, is three genuinely different pieces of hardware:
- **bungee** — a thin steel leg with the cord wrapped round its lower third.
  The wrap is a revolve about the LEG axis whose radius ripples, so one ripple
  is one turn of cord, in its own `rubber` group.
- **spring** — a flat tapered BLADE, 76 x 20 mm at the top. `genBladeInto` puts
  the broad face perpendicular to the leg and horizontal, which comes out
  fore-and-aft on a main leg (a Cessna leg, bending vertically) and across the
  aeroplane on a tailwheel leg. One rule, correct on both.
- **oleo** — two stages with a visible step: piston below, cylinder above.

GATE GEN now hashes the gear meshes for all three and requires all three to
differ. If they ever collapse back to one mesh the feature is silently gone and
nothing else in the battery would notice.

### 18 — camber and the split suspension height

Three new spec fields, all nullable, all defaulting to today's numbers:
- `gear.legDrop` — main axle drop below the fuselage underside.
- `gear.twLeg` — the third leg's length. For a tailwheel it replaces the
  GEN_RULES constant; for a NOSEwheel it replaces the trikeDeck derivation, so
  the rest attitude falls out of the leg instead of the leg being solved from a
  fixed attitude. Left null, the trike still lands on trikeDeck exactly.
  It is resolved in genFrame, not resolveSpec, for the same reason gear.x and
  gear.track are: a nosewheel's default is only knowable once the wheelbase is.
- `gear.camber` — degrees, tops-outboard positive, MAINS ONLY (a cambered
  castor is a shimmy). `S.gear.contactR = wheelR * cos(camber)` is published on
  the spec because five places have to agree about it: the solver's node radius,
  the prop-clearance rule, the track derivation, the shakedown's ground line and
  the wheel mesh.

Measured (`genShakedown`, default airframe):

| case | deck | propClear | main legs | third leg | stands |
|---|---|---|---|---|---|
| default | 10.23 | 0.400 | 0.760 | 0.230 | wheels |
| camber 20 | 10.22 | **0.400** | **0.772** | 0.230 | wheels |
| legDrop 0.9 | 11.69 | 0.540 | 0.900 | 0.230 | wheels |
| twLeg 0.10 | **11.66** | 0.400 | 0.760 | 0.100 | wheels |
| twLeg 0.45 | **7.78** | 0.400 | 0.760 | 0.450 | wheels |
| trike, auto | **1.20** | 0.400 | 0.760 | 0.887 | wheels |
| trike, leg 0.55 | -13.29 | 0.400 | 0.760 | 0.550 | **TW** |
| trike, leg 0.95 | 3.94 | 0.400 | 0.760 | 0.950 | wheels |

Two things to read off it. **Camber's clearance effect is second order and the
rule absorbs it**: cos(20 deg) costs 12 mm of contact radius on 0.20 m wheels,
and `gear.y` simply lengthens the legs by 12 mm to hold the clearance at exactly
0.400. Camber is mostly a look; `legDrop` is the clearance knob. **And the
third leg is the rest-AoA knob** — 0.10 to 0.45 m walks the three-point angle
from 11.7 to 7.8 degrees.

**legDrop is inert through most of its range and the panel now says so.**
`gear.y = min(byProp, byLeg)` picks the LOWER axle, i.e. the longer leg, so any
legDrop shorter than prop clearance demands changes nothing — on the default
aeroplane the prop wants 0.76 m and everything under that is ignored. The prop
keeps winning on purpose (a leg shortened into a prop strike is not a bad
aeroplane, it is a broken one on the first landing), so `S.gear.yBoundBy` is
published and the readout marks `main legs` AUTO when the prop bound it.
Without that the slider looks broken.

NOT modelled: camber also moves the contact patch inboard by R sin(camber). The
solver contacts directly under the node, so the effective track stays the axle
track. At the clamp (20 deg, 0.40 m wheels) that is 14 cm on a track of about
1.5 m — the only cut camber makes.

### Five defects the pictures found, and one the pictures fixed

Numbers said all four items were done. Then they were looked at.

1. **`genTubeInto` wound its two end caps the same way**, so every A-end cap in
   the aeroplane was lit from inside. Invisible on the engine cylinders it was
   written for (they are buried in the block), very visible on a gear leg.
2. **The bungee wrap's valleys dipped inside the leg** it wraps (0.72 +- 0.28 of
   a 1.15 r0 wrap against a 0.55 r0 tube), so steel showed between the turns and
   the whole thing read as a chain of pale beads. 0.80 +- 0.20 of 1.30 r0.
3. **FLAT MATERIAL COLOURS IN THIS PROJECT ARE LINEAR, NOT sRGB.** r128 hands
   `material.color` to the shader unconverted while a texture declared
   `sRGBEncoding` IS converted — and this scene's sun is a 2.75-intensity
   directional. A hex chosen like a paint chip renders about three times as
   light as it looks. Measured on the hub cap, dead-on, in full sun:
   `0x1a1c20 -> 181 164 139`, `0x33373d -> 214 202 181`. **And there is a
   specular FLOOR**: pure black at metal 0.85 still read 107 83 53, so no base
   colour could have saved a "chrome" hub. The bungee at a charcoal 0x2d2f34
   was a pale grey sausage; it is 0x08090b now, and the hub 0x101216 at metal
   0.12. Every other flat colour in the file carries the same bias and is left
   alone — they were all chosen by eye against it.
4. **The registration decal was 180 degrees out on both beams** — G4.5's, not
   this chantier's, and listed as "verified numerically but unseen". Near side
   glyphs upside down, far side rotated a full 180. The rule that was missing:
   **a sheet reads correctly when u runs to the VIEWER'S RIGHT and v UPWARD as
   seen from outside the side it is on, and those are different BODY directions
   on the two beams** — the nose is on your left from one beam and your right
   from the other, so u runs aft on one side and forward on the other. Each side
   needs exactly one flip and they are DIFFERENT flips: reverse the arc on the
   near side (v), reverse u on the far side. G4.5 reversed the arc on the far
   side only, on the theory that arc direction and u were the same flip. They
   are independent axes.
   Why the numbers missed it: the check was "u = 0 at x = 1.12 and u = 1 at
   x = 2.89 on both sides". A v flip is invisible to that, and a 180-degree
   rotation preserves it exactly.
5. **`tools/make_probe.js` had been silently broken** by the `?v=<hash>` cache
   busters build.js now writes: its injection anchor was the literal
   `<script src="../src/viewer/app.js">`, so the probe page loaded, drew frames,
   reported no error, and `__renderer`/`__WF` were simply never there. Both
   anchors are patterns now and a miss throws. **This is the tool that makes
   visual verification possible at all** (the agent Browser pane stops
   compositing when it is not displayed), so a silent failure in it is what
   "verified numerically but unseen" was actually made of.

### Verifying by eye when the pane will not composite

The loop that found all of the above, worth reusing: `node tools/make_probe.js`,
then in the page — render by hand through the caught `__renderer`/`__camera`,
downscale into an offscreen canvas, `toDataURL('image/jpeg')`, and **POST it to a
throwaway node sink that writes it to a file**. Screenshots then never travel
through the conversation. Pixel MEASUREMENT beats looking at the picture: the
whole linear-colour finding came from sampling the hub across five (colour,
roughness, metalness) triples in one pass, and "it looks pale" would never have
got there.

### Gate

Four new checks in GATE GEN (70 checks, was 66):
- `groups with their own sheet map all of it` — a group with its OWN texture
  must span it in both axes and carry no UV-degenerate triangle. Groups that
  SHARE the paint sheet are exempt on span: an aileron is a small island in an
  atlas and is supposed to be.
- `the registration reads the right way round on both beams` — per triangle,
  from the uv gradient: `dv` points up, and `sign(z) * cross(du, dv).z > 0`.
  Both winding-independent, and together they pin the frame completely, which
  span and handedness alone do not.
- `G4.6 camber and split leg heights` — camber 0 is bit-identical to no camber;
  contactR is exactly R cos(camber) AND is the solver's node radius; camber
  holds prop clearance and pays for it in leg length; twLeg sets the deck angle
  on both gear types; trike-auto still lands on trikeDeck; every variant stands.
- `G4.6 the three suspensions look different` + `the undercarriage is mostly not
  fat tubes` (at most 3 tube members, at least 3 legs).

Cost: the skin went 5643 -> 6228 verts and 8180 -> 9200 triangles on the default
aeroplane (the whole undercarriage is about 3900 of them, of which the bungee
wraps are 960 — spring steel is 192 and oleo 348, if that ever matters).

### Left open

- The wheels do not spin. Deliberate — see the rib-tread argument above — but if
  wheel rotation is ever wanted, the `moving` list already does everything
  needed (a rigid mesh on a pivot that rides its node's deflection); it needs a
  synthetic `spin` channel carrying distance travelled and `k = 1/R` per wheel.
- The `cowl` group maps to a 0.009-tall sliver of the paint sheet (measured
  while writing the UV check). It works today because the paint's features are
  u-based, but any cowl marking will have nothing to sit on. Belongs with
  item 13.
- Camber's lateral contact offset, above.

## G4.7 — THE NOSE (2026-08-11)

Playtest items **20, 15, 13, 6** — one chantier, because they are all the same
end of the aeroplane and 20 blocked 15. No fleet number moves: the solver change
is a fallback that no fiche takes, and the default GARAGE build's thrust is
reproduced to 1%.

### 20 — the cowl has a section of its own

`cowl.halfW`, `cowl.top` and `cowl.bot`, and they are measured **about the
THRUSTLINE**, which is the datum a cowl actually has: it is a cover over an
engine, and the engine sits on the thrustline. Left null they are derived from
the firewall section, tapered about that datum — the same shape that was there
before wherever the two datums nearly coincide.

Top and bottom are separate because that is item 13's "top and bottom profile
control": a flat-top Cub cowl and a round-top Cessna with a chin scoop are the
same three numbers.

The cowl is now a LOFT between two sections (firewall aft, its own forward)
rather than a scaled extrusion of one. The engine block's size moved onto the
spec as `S.engBox`, so the cover, the block and the shakedown all read one
number — the same discipline as `contactR` in G4.6.

### 15 — the drone cowl collapsed below its engine, and so did seven others

**Measured first, and it was much wider than the report.** The section AT THE
ENGINE'S OWN STATION, over all 24 seating x powerplant combinations: the
crankcase hung outside the cover in 8 of them, and the drone's cowl axis sat
**4.6 cm above its thrustline on a 30 cm cowl** (its deck line IS its cabin
roof, so the firewall's centre is nowhere near the engine).

Two instrument mistakes on the way, both worth remembering:
- The whole-cowl BOUNDING BOX cannot see this. It is dominated by the firewall
  ring, which is the fuselage's section and is not in question. Both before and
  after the first fix it read identical.
- The mesh is in the ROTATED body frame, so a ring at one station is not at one
  body-x. Grouping vertices by x to find rings found nothing at all; a
  tolerance sweep instead landed PARTIAL rings and reported a 4 cm tall cowl.
  Un-rotate to spec coordinates first (`genRestFrame` is exported for this).

The fix is a floor on the derived section: **the cowl clears the CRANKCASE.**
Drawn at the case and not at the cylinders on purpose — a J-3's cylinder heads
stick out, and enclosing everything by default would make every aeroplane a
cowled Cessna. And it is not enough to floor the NOSE section: the fillet is an
inset from every side and the case's forward face sits inside it, so flooring the
nose alone still left 1.7 cm of case below the belly (down from 4.3, but there).
So the nose section is solved for coverage AT THE CASE'S OWN STATIONS, four
fixed passes (a while-loop would break the determinism GATE GEN byte-compares).

Result, measured: the case is covered on all 24 combinations, cylinder heads
still stick out on 9 of them, and every seating but the drone moved by **under
2 mm**. That is what the reverted G3.6 attempt was reaching for — it floored the
FUSELAGE ring on engine size and had to be backed out because it widened every
nose. The cowl having a section of its own is what makes the same idea safe.

The verdict is REPORTED, not enforced (`cowl: encloses engine` /
`engine out: sides`), and it is measured at each part's narrowest station —
the case where its forward face is, the cylinders where the forward one is.
Getting that wrong by using the block's midpoint instead made the panel claim
"enclosed" for a cylinder poking through 6 mm further forward; and a cylinder is
a TILTED tube, so its outer cap ring reaches 15 mm further out than its axis
(`engBox.cylReach`, which is what the test uses). Spec and mesh now agree on all
24 cases, which is the point of publishing a claim at all.

### 13 — cowl shape and intakes

The three sliders above, plus the cowl finally having **its own texture sheet**.
It used to sample the body's paint at `v = 0.02 * (1 - t)` — the entire cover
squeezed into a 2%-tall sliver of the shared sheet, measured at 0.009 of it,
which is ONE texel row at 512 and nothing an intake could be drawn on. (That
measurement fell out of writing G4.6's UV check; it is why this item was flagged
as inheriting a problem.)

`genCowlDataURI` (garage.js): u = angle around, v = firewall to nose, and the top
12% of the sheet is the **flat nose face as a rim strip** (`GEN_COWL_V`). That
band is not decoration — a fan whose whole ring sits at one v has no texture area
at all, which G4.6's own gate check would have failed.

The sheet has to read as the same aeroplane as the body, which shares no pixels
with it, so the two livery features that cross the joint — the belly shade and
the cheat line — are drawn at the body's own u. Verified from the beam: the
stripe runs onto the cowl with no seam.

`GEN_INTAKES`: none / chin scoop / twin cheek / ring (radial). Texture only, and
deliberately so — a modelled duct costs a hole in the one panel whose whole job
since G1.7 has been to have none ("a big opening… either the prop attachment or
an air intake"). Each slot is a near-black opening with a lighter lip and n
louvres; the cover also gets three cooling gills along the joint.

### 6 — the propeller is not part of the engine

`prop: { D, blades, material, pitch }`. `D` null keeps the diameter the chosen
powerplant shipped with, so an untouched build is unchanged. Everything else is
derived, and the solver reads the aeroplane's prop (`params.prop`) in preference
to the registry's — a fiche sets none, so the fleet is untouched by construction.

- **Static thrust** is momentum theory: `fm * (2 rho A)^(1/3) * P^(2/3)`.
- **Pitch** is the figure of merit, and it is the whole trade. A fine prop bites
  hard standing still and runs out of pitch early.
- **Blades** add disc solidity, 5.5% of fm each past two.
- **Material** is mass: per blade at 1.88 m, scaling `(D/1.88)^2.5`. Anchors —
  a 1.88 m two-blade wooden prop is 4.8 kg, a 1.73 m three-blade carbon one 3.9
  (an E-Props Durandal is about 4).
- **Disc area** feeds the propwash the tail flies in, which the solver already
  computed from `D` — so that came free the moment D became a spec field.

**The zero-thrust speed is the part momentum theory does not give you**, and the
first cut got the trade BACKWARDS. Tabling a `v0k` per pitch alongside `fm` put a
fine prop's thrust running out at 86 km/h on an aeroplane that cruises at 103.
`P / Tstatic` is the only velocity scale available without a shaft rpm, and ONE
constant on it (`GEN_RULES.propV0K = 1.10`) does the whole job: a fine prop's
higher Tstatic lowers `P/Tstatic` and therefore lowers its own zero-thrust speed,
so the trade falls out instead of being asserted.

MEASURED against the six registry props, same diameter and power:

| powerplant | Tstatic reg/model | err | kV2 reg/model | err |
|---|---|---|---|---|
| a65_sensenich74 | 900 / **907** | **+1%** | 0.260 / **0.262** | **+1%** |
| r1830_hs23e50 | 11000 / 9403 | -15% | 0.543 / 0.858 | +58% |
| io360_mccauley | 2290 / 1818 | -21% | 0.136 / 0.276 | +103% |
| rotax277_pusher | 800 / 431 | -46% | 0.545 / 0.150 | -73% |
| o200_eprops | 1700 / 1144 | -33% | 0.177 / 0.222 | +25% |
| outrunner2212 | 8 / 5 | -33% | 0.015 / 0.004 | -75% |

The A-65 row is the calibration and it is exact; **the rest are not supposed to
match.** Those numbers were fitted per AEROPLANE and carry its drag as well as
its prop — the implied `fm` across them runs 0.36 to 0.67, which is real spread
between a Sensenich cruise prop and a slow-fly wooden one. The default preset is
`pitch: 'cruise'` because that is what an A-65 swings, not to make the table look
good; that is also why the default build's performance did not move.

The knobs, on the default airframe:

| case | T0 N | thrust out at | prop kg | all-up | TO run | cruise thr |
|---|---|---|---|---|---|---|
| default (cruise, 2 x 1.88 wood) | 907 | 212 km/h | 4.8 | 402 | 129 m | 73% |
| fine pitch | 1461 | 131 km/h | 4.8 | 402 | 72 m | 90% |
| 6 blades | 1107 | 174 km/h | 14.4 | 412 | 106 m | 73% |
| D 3.00 m | 1239 | 155 km/h | 15.4 | 418 | 95 m | 79% |
| 2.6 m / 3 blade / fine / carbon | 1914 | 100 km/h | 10.8 | 411 | 55 m | 95% |

Read the last row: a big fine climb prop halves the take-off run and needs 95%
throttle to hold cruise. That is the trade being real rather than a slider.

Note the prop mass replaced a crude `2.0 * D` (3.76 kg for the A-65, now 4.8),
which moved the default build's CG forward slightly and with it the derived gear
position — the only baseline number this chantier moves, and it moves because the
mass model got better.

**NOT modelled, and worth stating:** the prop has no ROTATIONAL inertia. No
gyroscopic precession, no P-factor, no torque roll. Item 6 said "blade mass ->
inertia" and what it buys here is the aeroplane's inertia — real mass at the
front, moving the CG and the all-up weight. The blades' mass lands on the mount
nodes rather than at the hub 0.10 m further forward; worth 3 cm of CG with the
heaviest prop the clamps allow, and there is no node out there to hang it on.

### Gate

Two new checks in GATE GEN, and one suspension check replaced (73, from 71
after G4.6):
- `G4.7 the cowl has its own section and covers its case` — the case is covered
  on all 24 seating x engine combinations; at least one still leaves the
  cylinders out (a gate demanding full enclosure would quietly cowl every
  aeroplane); the default cowl width is still the firewall taper; and a 0.7 m
  cowl encloses an A-65 while moving **zero** fuselage coordinates, which is
  item 20's actual claim.
- `G4.7 the propeller is its own component` — the model reproduces its
  calibration entry within 2%; the solver reads `params.prop`; diameter, pitch
  and blade count each raise static thrust AND lower the zero-thrust speed;
  blade material shows up in the all-up mass; a 3 m disc lengthens the gear while
  prop clearance stays pinned at the rule; and the drawn prop has as many blades
  as the spec bought.

### The suspension knob was folding the undercarriage, and 1 kg found it

Not a nose item. GATE GEN went red on two SUSPENSION checks after item 6, and the
cause is worth the space because it is rule 1 and rule 10 in one place.

`gear.stiffness` scaled EVERY gear member, so turning the suspension down
softened the drag braces and the belly cross-bracing along with the spring — and
the undercarriage snapped through. Traced, at 0.6x: the aeroplane settles on its
BELLY with the axle 0.75 m in the air, **fully at rest** (vmax 0.000 m/s after
1800 frames, so not a bounce), at 1.4% strain. HEAD stood at 0.6x and folded at
0.35x; item 6's honest prop mass added 1 kg at the nose and moved the barrier.
**The barrier was one kilogram away and nothing in the battery said so.**

The fix uses G4.6's own `vis`: the knob scales the SPRING (`vis === 'leg'`) and
the bracing keeps the archetype's stiffness without the knob. Real gear behaves
that way — a soft spring gives long travel and the drag brace is a tube either
way. **Identical at stiffness 1.0 for every archetype**, which is the whole
default fleet, so no anchor moved.

Measured, which member matters:

| what the knob scales | 0.35x | 1x | 3x |
|---|---|---|---|
| spring only (now) | stands, 52 mm travel | stands, 23 mm | stands, 10 mm |
| spring + same-side drag brace | **FOLDED** | stands | stands |
| every gear member (pre-G4.7) | **FOLDED** | stands | stands |

So **the aft drag brace is the anti-fold member** and must not follow the knob.
The price is honest and worth stating: the knob's TRAVEL authority is now small
(52 -> 10 mm across the range) because the vertical load runs through a fan of
three members and only one of them is the spring. The spring's own deflection
still moves 5x (4.84% -> 0.93% strain), which is what distinguishes a bungee from
an oleo. Making the knob strong AND fold-proof is geometry, not more k-scaling —
rule 1's anchor offset, i.e. a gear fan with real depth. That is its own chantier.

**Two instruments had to be fixed to see any of this**, and both mistakes are the
kind that make a gate lie:
- `gearStrain` is the worst-loaded gear MEMBER, and with the split that is
  normally the drag brace — whose load goes UP with stiffness, because a stiffer
  spring hands it more. Asserting "stiffer deflects less" on it read BACKWARDS
  while the suspension was behaving perfectly. The gate now measures the SPRING.
- Travel cannot be measured as a vertical node difference. The main leg is long
  and raked into the FIREWALL, so the axle moves ALONG it: 5 mm of vertical
  change for 52 mm of real compression, and the remainder of any node-difference
  is the body pitching. Travel is the spring's own compression, `strain * L`.
- And the FOLD cannot be measured by strain at all — the folded case sat at 1.4%
  while the working one sat at 4.8%, **less strain in the mechanism than in the
  sound structure**, which is rule 10 stated as a number. It is measured
  geometrically instead: how far the axle has moved RELATIVE to the airframe node
  its leg hangs on, as a fraction of the leg. Validated against a real fold —
  working 5.5-13.7%, folded **142%** — so the 50% threshold sits an order of
  magnitude clear of both.

`genShakedown` now reports `springStrain`, `susTravel`, `susShift` and
`gearFolded`, and GATE GEN's fourth suspension check is
`the undercarriage never folds across the suspension range`. That replaces
`too-soft suspension is reported, not hidden`, which was accidentally detecting
the fold and could not name it — with the fold cured, 0.35x simply works.

### Delivered against a red UISMOKE that is not this chantier's

`node tools/run_gates.js --all`: **30 of 31 gates PASS**, including GEN (73/73
checks) and every fleet and cross-country gate — which is the evidence the solver
change is inert for the fiches. UISMOKE fails on
`GARAGE_SPEC.loadTest is not wired`, which belongs to the LOAD TEST work landing
in parallel: HEAD's test_ui_smoke.js contains no such check, and the
`window.GARAGE_SPEC` surface it asserts does not exist in app.js — the garage
bridge is an object passed straight to `garageInit(...)`. Proven not to be this
chantier's: HEAD's own test_ui_smoke.js run against THIS build passes.
Left alone deliberately rather than wired from here, because it is another
thread's live feature in a file they are editing.

### Left open

- The knob's travel authority, above — a geometric cure for the gear fan.
- The cowl's loft is linear between two sections. A bulged chin or a drooped top
  line — a curve rather than a taper — would need a third section.
- Intakes are texture. A modelled scoop is a separate chantier and needs the
  skin-subdivision pass that window cutouts also wait on.
- Prop rotational inertia, above.

## G4.8 — THE TAIL JOIN (2026-08-11)

Playtest item **22**. Item 21 (T-tail) is NOT in this — see the end.

### The V-tail was not attached to the aeroplane

Reported as "most visible on the V-tail, which currently just intersects".
Measured, in spec coordinates off the built mesh: each panel's root row started at
**10% of the semispan out from the centreline and 10% of the way up**, which put
it 46 mm clear of the fuselage envelope with nothing between the two halves. From
directly above you could see the ground between the panel root and the body. It
was not intersecting the fuselage — it was floating beside it.

The fix is a **fixed centre section**: a full-chord loft from the centreline out
to each panel's root, flared 28% in chord at the middle. The flare IS the fillet,
and it is where a real V-tail carries its root fairing. It has to be FIXED and
separate from the ruddervators, which is the whole reason not to simply extend
them inboard: the two panels deflect DIFFERENTIALLY on rudder, so panels meeting
at the centreline would saw through each other at every rudder input.

**Two lofts, one per side, not one loft through the middle.** `panel()` takes its
span direction from its first two rows and then uses that single normal for every
section, so one V-shaped loft gets the far half's thickness axis wrong — measured
immediately by GATE GEN's mirror check as 42 skin vertices with no twin. Building
each side from the centreline outward gives each its own span direction and the
symmetry is exact.

### And the fin got its dorsal fillet

The conventional tail had no gap — the fin's root is already buried 22 mm in the
tail cone — but the joint was a hard corner where a real aeroplane has a fairing
running aft along the turtledeck. One extra fixed row 70 mm below the root with
30% more chord: `finRow` holds the leading edge and grows the chord AFT, which is
the direction a dorsal fillet actually goes.

Cost: the skin goes 1502 -> 1534 vertices on a conventional tail (the fillet) and
1502 -> 1550 on a V-tail (the centre section).

### The instrument trap that cost the most time here

**`tools/make_probe.js` must be re-run after every build.** dev.html carries
`?v=<hash>` cache busters per script, build.js regenerates them when a file's
content changes, and the probe page is a COPY of dev.html — so a probe generated
before a build keeps the old hashes and the browser serves the previous build from
cache. The screenshot then shows the code you had, not the code you wrote, with no
error anywhere. It cost one wrong conclusion here ("the fairing did nothing" —
the fairing was fine, the page was stale), and it is the second time this session
that make_probe has silently shown the wrong thing (see G4.6 for the first).
The check that catches it: compare a vertex count read from the page against the
same count from node. They match or the page is stale.

### Item 21, the T-tail, is not started — and why

It is the other half of this chantier and it is FRAME work: the stabiliser moves
to the top of the fin, the fin has to carry it (new members, and a real risk of
emitting a mechanism that only GATE GEN's rigidity-rank check would catch), the
strips must hang off the FIN node, and `stabWash` should drop because a T-tail's
stabiliser is out of the propwash — which is most of the reason to build one.
That means 60_gen_spec, 61_gen_frame, 62_gen_aero and 63_gen_skin.

Not started because the parallel thread was editing 30_solver.js and
62_gen_aero.js within the last ten minutes (the nEngines rework above), and
62_gen_aero's `genStrips` tail section is exactly where a T-tail's strips go. A
structural change verified against a tree that another agent is rewriting gives a
red gate nobody can attribute — which already cost one 25-minute battery this
session. It wants a serialised run: land the nEngines work, then build the T-tail
against a still tree with the fleet table in hand.

**What scoping it turned up, so the next session does not rediscover it.** The
item says "the fin carries it, so it is frame work" and that is right, but the
consequences reach further than the empennage:

- **Two members are not enough at each stab tip.** HTL braced to FIN and TPT
  only is a MECHANISM — it can rotate about the FIN-TPT axis, and nothing but
  GATE GEN's rigidity-rank check would report it (rule 10: no strain gate can).
  The set that works is FIN-TPT + FIN-last.TL + FIN-last.TR for the fin, then
  HTL-FIN, HTR-FIN, HTL-HTR (the spar straight through the fin head) and
  HTL-TPT, HTR-TPT. Three independent directions per tip; verify the rank.
- **THE TAILWHEEL LOSES ITS BRACING.** Rule 10's cure for the near-axial latch
  is a wide lateral pyramid from the tailwheel up to the STAB TIPS
  (`B(TW, HTL, 'gear', false, 'wire')`, G4.6). On a T-tail those tips are at the
  top of the fin, so those wires become absurd and the pyramid has to be re-based
  on `last.TL/TR`. That is a GEAR change riding on a tail option, and it is the
  reason this is not a skin-level switch.
- The stabiliser's covering mass (`cover(1.9 * t.Sh, [...])`) and the skin's root
  influences (`post = [[TPB, .5], [TPT, .5]]`) both hang off the tailpost and must
  move to FIN, or the stab's mass and its flex stay behind where the stab no
  longer is.
- **`stabWash` is the point of the exercise.** GEN_RULES has it at 0.60 for a
  conventional tail; a T-tail's stabiliser is out of the propwash entirely and
  should be near 0.15. Expect the elevator to lose most of its static authority
  with it — which is the real trade a T-tail makes, and the reason to measure the
  three-point elevator moment before and after rather than assume.

## G4.9 — ONE ENGINE, TWO MOUNTS (2026-08-11)

The HONEST CUTS entry that said "if it is ever fixed, do it as its own chantier
with the fleet table in hand, and expect every TORun and climb anchor to move".
This is that chantier. They moved.

### The defect

`30_solver.js` computed `T = Tper * def.refs.engine.length`. `refs.engine` is the
list of NODES the thrust is applied at, and how many of those there are has
nothing to do with how many engines there are: the DC-3 has one node per nacelle
(2 engines, 2 nodes, right by coincidence), while the Cub, the PA-18 and every
generated aeroplane hang ONE engine on TWO mount nodes. Measured at full throttle
from rest, read off `sim.out.thrust`:

| | refs.engine | registry Tstatic | solver static thrust |
|---|---|---|---|
| cub / pa18 | 2 | 900 | **1800** |
| gen | 2 | 907 | **1814** |
| dc3 | 2 | 11000 | 22000 (right — it is a twin) |
| c172 / jodel / chinook / drone | 1 | — | right |

### Which way to fix it, settled by measurement rather than taste

The other option was to "re-fit": double `a65_sensenich74.Tstatic` to 1800 so the
Cub keeps flying exactly as its validated numbers describe, and move the lie from
the solver into the registry. The propeller says no. Momentum theory gives the
ideal static thrust of a disc absorbing P as `(2 rho A)^(1/3) * P^(2/3)`, and a
real propeller reaches a fraction `fm` of it — the same relation `60_gen_spec.js`
already uses to synthesise a garage prop:

| powerplant | fm implied by the registry | fm if doubled |
|---|---|---|
| A-65 / Sensenich 74CK | 0.357 | 0.714 |
| R-1830 / HS 23E50 | 0.421 | 0.842 |
| IO-360 / McCauley | 0.454 | 0.907 |
| O-200 / E-Props | 0.535 | **1.070** |
| 2212 outrunner | 0.539 | **1.078** |
| Rotax 277 | 0.669 | **1.338** |

A figure of merit above 1.0 beats an ideal actuator disc, which no propeller
does. The registry's numbers are honest per-PROP figures and the solver was
simply wrong. Doubling the A-65 entry would also have put a COARSE CRUISE prop at
fm 0.714, above every other prop in the fleet including the Rotax's slow-fly
wooden one — and it would have contradicted `GEN_PROP_PITCH`, whose fm table was
derived from these same entries on the assumption that they are per-prop. So: fix
the structure, re-anchor the numbers.

### The separation

`refs.engine` keeps ONE meaning — the mount nodes, which is what
`per = T / refs.engine.length` spreads the force over. `params.nEngines` carries
the count. All seven fiches state it; the garage takes `spec.engines.length`, so
a twin is right the day `engines` grows a second entry. `genShakedown` reports
`propTstatic * nEngines` using the same expression the solver uses, so the panel
and the aeroplane cannot silently disagree again. Propwash is unchanged and
deliberately per-DISC: the tail flies in the wake of the prop ahead of it, not in
the sum of the aeroplane's engines.

### It moved the fleet TOWARD reality

Free-air tunnel, `tools/make_perf.js`, before -> after:

| | static thrust | Vs km/h | Vmax km/h | best climb | L/D | TO run to 2.5 m |
|---|---|---|---|---|---|---|
| cub | 1800 -> 900 | 53.9 -> 53.9 | 149.8 -> **119.3** | 1381 -> **433 fpm** | 9.30 -> 9.30 | 67 -> **151 m** |
| pa18 | 1800 -> 900 | 53.9 -> 53.9 | 149.8 -> 119.3 | 1381 -> 433 fpm | 9.30 -> 9.30 | 67 -> 151 m |
| gen | 1814 -> 907 | 59.6 -> 59.6 | 151.7 -> 120.8 | 1295 -> 384 fpm | 9.16 -> 9.16 | 103 -> 292 m |
| drone / chinook / jodel / c172 / dc3 | unchanged | unchanged | unchanged | unchanged | unchanged | unchanged |

Three things to read off that table:
- **Vs and L/D do not move anywhere.** They are thrust-free, so they are the
  control: any change in them would have meant the fix touched something it
  should not have. Five of the eight aircraft are identical in every column.
- **The Cub now matches the anchor this document already carried.** The table
  said "top ~121 km/h" while the aeroplane was actually doing 149.8; on honest
  thrust it does 119.3. The recorded number had been the undoubled one all along,
  which is its own small piece of evidence about which figure was the real one.
- **A real J-3 climbs about 450 fpm.** The model was doing 1381. It now does 433.
  That is a divergence closed, not opened, and the same goes for the takeoff run
  (151 m to 2.5 m agl, against a real ground roll of ~110 m and ~220 m to 50 ft -
  the measure belongs between those two, and now sits there).

The one place the model got FURTHER from a reference is the Cub's top speed,
119.3 against a commonly cited ~140 km/h. That line was already open in the
DIVERGENCE LEDGER marked "RE-SOURCE before touching" and it stays open. It is not
evidence against the fix: the alternative was a J-3 that climbs three times too
fast to buy it.

### What had to be re-fitted, and why none of it is a fudge

1. **`pa18.ap.flareThr` 0.12 -> 0.24.** It is a THROTTLE FRACTION, and the fix
   halved what a fraction buys. The flare keeps the THRUST it was tuned with:
   `0.12 * 1800 N == 0.24 * 900 N`. Touchdown sink 1.71 (over the 1.5 bound) ->
   0.95, against 0.78 before the fix.
2. **`cub` / `pa18` `ap.TORun` 60 -> 151.** Re-read off the flown measurement,
   not adjusted by hand.
3. **The garage's TORun estimate, rebuilt.** Below.
4. **The taxi governor.** Below.
5. **Two GATE GEN instruments.** Below. Neither of them was the aeroplane.

### The takeoff estimate was two compensating errors

`genTrim` estimated the run as `1.35 * Vlof^2 / (2*acc)` with ONE constant
acceleration off `0.92*Tstatic`, and `Vlof = 1.05*VRot`. Both parts are wrong and
the doubled thrust hid both: it read 119 m against the 103 m the over-powered
aeroplane actually flew, which looked exactly like the deliberate conservative
bias the comment claimed. On honest thrust the same formula read 119 m against
**292 m flown** - optimistic by 2.4x. This number decides whether the AP
backtracks, so optimistic is the dangerous direction.

- It does not unstick at `1.05*VRot`. VRot is where the autopilot starts asking;
  the wheels leave when the wing can carry the aeroplane AT THE LIFTOFF ATTITUDE,
  which is a tunnel question. Solved that way it predicts gen 21.4 m/s against
  20.8 flown, and cub 19.0 against 17.6 — a few per cent, high rather than low.
- The acceleration is not constant. Thrust falls as `kV2*V^2` all the way down
  the roll while drag climbs, so the mean is nothing like the standing value.

It now integrates `s = INT V dV / a(V)` to the measured unstick speed, at zero
body alpha (which over-reads the weight on the wheels, deliberately), and carries
the air segment as 0.8 of the roll — above the worse of the two measured ratios
(0.53 gen, 0.18 cub), because this number's whole job is to be long. Reads 320 m
against 292 m flown.

### The taxi governor had no authority left

GATE XCTY5's backtrack crept 16 m in 120 s and timed out onto the wrong end of
the strip. Traced: the governor is `thr = clamp(0.08 + 0.06*(Vt — Vg), 0, 0.35)`,
and at rest it asked for 0.20 — which on 900 N is 180 N, against `CRR*W` = 185 N
of rolling resistance. **Dead break-even.** On 1800 N the same command had been
360 N and the aeroplane simply went.

A fraction of throttle is not a fixed amount of push, and what it has to beat is
`CRR*W`, a property of the AEROPLANE. The bias is now the throttle that exactly
cancels rolling resistance, derived per aeroplane from the registry
(`CRR * m * g / (Tstatic * nEngines)`), with the same 0.27 of authority above
break-even that 0.35 used to mean. Nothing is tuned here: both terms were already
in the registry. TAXI is only reached on a short-strip departure, so XCTY5 is the
only gate that exercises it.

### Two instruments lied, and re-tuning against either would have done damage

Both GATE GEN failures were the gate, not the aeroplane — the project's oldest
lesson, arriving twice in one session.

- **`cruise is quiet in wind`** read bank p2p 13.07 deg against a 3.0 limit while
  the ailerons barely moved (0.55 deg/s against a 2.0 limit): "blown about while
  the autopilot does nothing", which reads exactly like an authority problem at
  the new trim state. It is not. The probe measures a flat 24 s, and that window
  sat inside the cruise leg only because the over-powered aeroplane reached the
  top of the climb early — CRUISE at x=-683 with 1618 m to the turn (~50 s). On
  honest thrust it enters CRUISE at x=-1616 with 685 m to run (~24 s), so the
  tail of the window catches the 180 deg TURNBACK. The trace is unambiguous: bank
  within **±0.33 deg** for the 21 s that are actually cruise, then the roll-in,
  with heading error going to 170 deg. The window now stops at the phase boundary,
  and a sample shorter than 10 s fails rather than passing on nothing.
- **`every configuration stands, is rigid and flies a leg`** dropped
  `low+trike+cargo` (538 kg on 907 N). It flies the leg and lands at sink 1.34
  against its 2.0 bound — it just needs 382 s, against a 300 s budget sized when
  it had twice the thrust. Budget 300 -> 480 s. Every other configuration still
  stops well under 300 s, so nothing else pays for it.

Worth stating plainly for anyone reading the notes written while this was in
flight: the A/B showing "forcing `nEngines = 2` takes bank p2p from 17.27 to
0.00" is fully explained by the window artefact — the doubled thrust moves the
turn back out of the window — and is NOT evidence about `genGains`, VCruise or
the AP schedule. Re-tuning those against this instrument would have broken loops
that were behaving correctly.

### The instrument that had to exist first

`tools/make_perf.js`. The fleet table's Vs / Vmax / climb / takeoff-run figures
were each measured by an ad-hoc probe in the session that produced them and then
lived only in this document, which meant "re-read every anchor off the
instrument's own output, never hand-edit it" was a rule the fleet rows could not
actually obey. This chantier could not re-anchor them without one, so it built
one — and validated it against the numbers already in the table before trusting
it: cub Vs 53.9 against a recorded 54 and L/D 9.30 against 9.3; c172 46.3 kt
against 46, 123.8 KTAS against 123, 907 fpm against 899; chinook 46.0 / 99.0 /
9.78 against 46 / 99 / 9.8. It reproduces the hand-measured table, so its
readings on the three aircraft that moved can be believed.

It reads its thrust multiplier off the SOLVER (static thrust divided by the
prop's own Tstatic) rather than from `params`, on purpose: an instrument built to
compare a build that multiplies by the engine count against one that multiplied
by the mount count would otherwise have measured its own opinion of that number
instead of the aeroplane.

### Gate

`node tools/run_gates.js --all`: **BATTERY: PASS**, 31 gates, 1677 s, exit 0.
The baseline battery on the unmodified tree was taken first and was also
green (34 gate lines, 1521 s), so the two are comparable rather than one
being an alibi. The fleet is the evidence that the change is
inert where it should be: WIND (7 aircraft), M3, DRONE, DC3, JODEL, C172,
CHINOOK, PA18, STRESS and all five XCTYs, plus the world, skin, codec, FLEX and
LOAD batteries. GEN is **73/73** with its two instruments corrected, and its
SHAKEDOWN moved in exactly ONE field — `TORun 129 -> 320`.
Mass, area, wing loading, Vs, VCruise, L/D, alphaCruise, cg, np, static margin,
deck angle, prop clearance, thrCruise and every prop figure are byte-identical
across the fix.

### Left open

- The Cub's top speed against the ~140 km/h commonly cited (ledger line, already
  open, marked RE-SOURCE).
- The garage's air segment in the takeoff estimate is a measured ratio, not a
  model. Integrating the climb-out properly needs the energy split between height
  and speed, which varies 0.18-0.53 across the two aeroplanes measured.
- `low+trike+cargo` at 538 kg on 65 hp is a legitimately marginal aeroplane
  (thrCruise clamps at 0.95). It flies, and the garage now says so honestly
  rather than flattering it. Whether the builder should be warned about it is a
  design question, not a physics one.

## G5 — THE CABIN, GLAZING AND THE STUDIO (2026-08-12)

Merged the Claude Design session's two passes (a look pass, then a cabin/glazing
pass) into the trunk, decoupled the editor from the simulation, and re-grouped
the panel. The bundle — both handoff documents, the session's edited files, and
the pristine pre-session copies — is committed at
`futureDesigns/transfer-glazing/` **because `gen/orig/` is the only copy of the
merge base that exists.** The session forked from an UNCOMMITTED working tree:
63_gen_skin.js was 47.9 kB at `55866fb`, 55.9 kB in `gen/orig/`, 68.8 kB in the
tree when the bundle arrived, and no git object matches the middle one. A
three-way merge cannot be reproduced without those files.

### WHAT THE HANDOFF DOCUMENTS GET WRONG

They are careful documents and most of the work is very good — the topology-
aligned cut in particular. But five statements in them disagree with their own
shipped code, and following the prose would have broken working behaviour.
Recorded here because the bundle is not the source of truth; this file is.

1. **`cabin.wingBay` does not exist.** TRANSFER-GLAZING §2.1 documents it and §3
   gives it a panel row. Zero occurrences in all four session files. The real
   path is **`wings[].centre`**, enum **`solid|glass|open`** — not `skylight`.
   The documented row would have bound to a dead path and silently done nothing.

2. **Reach must be a FRACTION, not metres.** §2.2 exposes `cabin.canopy.x1` in
   absolute metres. The prototype harness wraps it in a fraction and says why:
   *absolute x could not survive a cabin-length change.* It cannot — stretch the
   cabin and the window stays put while the cabin moves out from under it.
   `cabin.canopy.reach` (0..1) is now the control, resolved to `x1` in
   `resolveSpec` where the derived cabin length is known. Setting `x1` still
   wins, so a build can pin the window. Measured: cabin 0.60 -> 2.40 m moves x1
   1.57 -> 3.37 m, always 0.35 m aft of the cabin.

3. **The sill is a RING INDEX, and §5 says the opposite.** §5 states as an
   invariant that it is a height plane. The code deliberately went back to an
   index at the user's request ("the plane-based cut makes it look ugly"). A
   maintainer following §5 would revert approved work. An index also always
   lands on ring vertices, which is what keeps the seam exact — and it is why
   GEN_RADIAL sets how finely the sill can be placed.

4. **Do NOT restore the propeller from `gen/orig/`.** §1 says to, and it was
   right when written. `orig` predates the trunk's own propeller rebuild: `prop`
   is now a top-level, PHYSICS-BEARING spec group (disc area drives static
   thrust and propwash, blades weigh something at the front) whose `pitch` is a
   string enum. The session's is per-engine `engines[0].prop` with a numeric
   pitch — decoration. The propeller here is the TRUNK's.

5. **The two docs give different `COVER` sets and both are wrong.** Neither
   accounts for the trunk's `rubber`; the doc names `sunscr`, `seatpipe`,
   `seatframe`, `pilot`, `pilotjoint` and the real groups are `ctop`, `spipe`,
   `sframe`, `dumm`, `dumj`. So the list no longer lives in the viewer at all —
   `63_gen_skin.js` returns `cover` in the payload and `applySkinVis` reads it.
   A list maintained at a distance from the thing it describes drifted twice,
   once per handoff; asking the generator cannot.

   Moving it there immediately found a THIRD bug, older than either handoff:
   `applySkinVis` hid only `skin` and `cowl`, so **Frame mode showed the painted
   fabric ailerons, elevator and rudder floating at the trailing edges of a bare
   truss** — the wing carries 68 real beams, so there was structure underneath
   them the whole time. Control surfaces have been their own groups since G4.4
   and nobody added them to the literal. They are appended to `cover` from
   `moving` rather than listed, so the next surface added is covered by
   construction. Measured in the probe: Frame mode went 2205 -> 1974 lit pixels,
   which is the surfaces going away.

### WHAT HOLDS (the question was "do these resist other parameters changing?")

Mostly yes, and the important one holds by construction: **every glazing vertex
is an affine blend of existing lattice nodes with weights summing to 1.**
Measured across all 28 groups, worst |sum(w) - 1| = 7.45e-8, i.e. float32
rounding. That is what keeps GATE GEN's skin/structure coherence green without
the cut having to be checked. Anything that samples the shell independently of
the body's rings reintroduces the gaps this pass removed.

Also guarded: the canopy is skipped for `seating === 'drone'` and for a
degenerate body (`F.length > 2`); `x0`/`wsAngle` are nullable-derived so they
track the cabin; `kCut1 <= kCut0` is repaired; the window snaps to slice
boundaries. Geometry is deterministic — two builds of the same spec are
identical over all 94 401 position floats.

**ONE CONTROL READS AS DEAD ON THE STOCK AEROPLANE, and it is not broken.**
Measured, canopy peak height against `cabin.canopy.height`:

| height | high wing | low wing |
|---|---|---|
| 0.00 | 0.6246 | 0.7999 |
| 0.15 | 0.6356 | 0.8785 |
| 0.45 | 0.6356 | 1.0660 |
| 0.90 | 0.6356 | 1.2493 |

The low wing tracks the slider all the way. The high wing saturates at 0.15,
because the carry-through is in the envelope and lowers the lid — which is the
documented behaviour and the ONE thing a high wing does differently. But
GEN_DEFAULT is high-wing, so out of the box "Rise above deck" appears to do
nothing past its first notch. Worth surfacing in the panel eventually (grey it,
or show the wing as the binding constraint the way `gear.yBoundBy` already names
what bound the leg) rather than leaving the player to conclude it is broken.

`wsAngle` and `fuselage.windRun` are now ONE control: the angle drives the run
in `resolveSpec`, so the body's step and the canopy's front bow cannot drift
apart. Left null the angle is read back OUT of the run, so an untouched build is
bit-identical — measured 49.09 deg against the 0.30/0.26 the fuselage shipped.

### GEN_RADIAL 20 -> 40, AND WHAT IT COSTS

Taken, because the sill is a ring index scaled by GEN_RADIAL/2: at 20 the slider
reaches half as many sill positions and the opening's lower edge steps visibly.
It also fixed a latent bug — the trunk's registration decal used HARD-CODED arc
indices (3,7 / 13,17) that were the two sides at 20 segments and would have
become the upper side and the BELLY at 40. The session's decal derives them as
fractions of GEN_RADIAL, which is why its version was taken wholesale.

Cost, stock covered build: **47.8k triangles** (54.1k including the hidden
truss). The transfer document predicted ~28k; it is higher because GEN_RADIAL
also drives the canopy's own resolution. Against a 186k-triangle C172 and a ~1M
forest this is still nothing, but the distribution is worth knowing:

| group | tris | what |
|---|---|---|
| cframe | 11 200 | the canopy FRAME — see below |
| canopy | 9 408 | the shell |
| spipe | 5 760 | seat welt piping |
| skin | 3 922 | the whole fuselage covering |

`cframe` and `spipe` are built as hundreds of individually CAPPED 10-sided
tubes (`genTubeInto(..., 0.011, 10, ...)`) rather than as swept rails: ~311
segments, ~36 triangles each, for what reads as two bars. That is the obvious
efficiency target if the count ever matters, and it is a construction change,
not a decimation pass. Left alone for now — it is the design session's geometry
and it looks right.

**THE SILL SLIDER IS ALSO THE COST SLIDER**, and nothing in the panel says so.
Measured across the range (all-groups totals, stock otherwise):

| build | tris | note |
|---|---|---|
| `sill` 0.10 | 43.6k | |
| `sill` 0.30 (stock) | 54.1k | |
| `sill` 0.85 | **83.1k** | canopy 26.7k + cframe 23.5k |
| `facet: true` | 38.8k | CHEAPER — bars per section edge beat the rails |
| `glazing: none` | 33.9k | seats, panel and occupant remain |
| `pilot.show: false` | 48.9k | the dummy is ~5.2k |
| `seating: drone` | 20.6k | no cabin at all |

A deeper sill wraps the opening further down the section, so both the shell and
its frame grow with it. Worth knowing before blaming GEN_RADIAL for a heavy
build — and worth knowing that the faceted canopy is the cheap one, which is the
opposite of what "more frame bars" suggests.

**ROBUSTNESS, measured rather than asserted.** 74 builds: every seating layout
(single / side2 / tandem2 / drone) x every glazing route (none / windshield /
bubble / greenhouse) x high and low wing, plus BOTH STOPS of all 21 new canopy,
panel and seat knobs with side lights forced on. All 74 built cleanly, no NaN
vertex anywhere, and worst |sum(w) - 1| = 8.2e-8 across the lot. Triangle counts
ranged 20.6k to 85.1k. That is the answer to "do these resist other parameters
changing?" — they do.

### THE STUDIO — the editor is not the simulation

The garage already stopped the solver (G3.2). It still lived in the WORLD:
terrain, sky, fog and weather paged every frame around an aeroplane parked on an
apron. Now everything that IS the aeroplane lives in one `craft` group, and
entering the garage reparents it into a `studio` scene — neutral background,
three-light room, a shadow-catching floor placed under the wheels, and a PMREM
environment baked from a small gradient dome (without one, every
MeshStandardMaterial's metal reads black in there — the same trap the gear legs
and spinner fell into against a dim sky). Same renderer, same canvas, same
camera: switching reloads nothing. `WF.worldUpdate` is not called in the garage.

Worth recording because it was the assumption going in: **the sim OBJECT was
never the cost.** Measured, `makeSim` is 0.0 ms; `buildGen` is 9 ms and
`genSkin` 37 ms. What the garage was paying for was the world and the stepping,
not the physics object, so there is nothing to be gained by tearing `sim` out of
the editor — the skin poses off its rest lattice and that is free.

### TWO REGRESSION PINS HAD TO BE RESCOPED, AND WHY THAT IS NOT A WEAKENING

Lowering prop clearance failed `G4.6 camber and split leg heights` and
`G4.7 the propeller is its own component` on the same sentence in two places:

    if (Math.abs(big.propClear - base.propClear) > 1e-6) fail(...)

Both asserted that prop clearance is EQUAL across builds — which held only
because it was the binding constraint on every one of them. It set ride height,
so every aeroplane sat exactly at the rule and never above it. Now `legDrop`
owns ride height, a stock build sits at 0.300 on a 0.229 floor, and a big-disc
build comes back down onto it. Equality would now be asserting that the floor is
always active — the inverse of what the pin was written to catch.

They now assert the property that actually keeps the blades off the ground and
that the old equality only IMPLIED: **no build sits below the floor**, on stock
and on a 3 m disc, plus the floor still binds when it should. The G4.6 intent —
camber is paid for in leg length, clearance held — is kept and tested where the
rule is genuinely the active constraint, on a prop-bound build: measured, camber
lengthens its leg 1.149 -> 1.161 m and holds clearance at 0.2290 either side.

The rule of thumb this leaves: a pin that says "X equals Y" is often really
saying "this constraint is always the active one". When the constraints change
hands, that pin fails for the right reason and needs re-aiming, not deleting.

### THE PANEL — two levels

Fifteen sections is past what one scroll holds, so `SECTIONS` is now grouped by
subsystem: **Airframe / Power / Cabin / Gear / Finish**, with the existing
sections as the inner level. `led` stays on the SECTION, where the ledger keys
live; a group's badge is the sum of its sections'. `SECTIONS` is still derived
flat, so `ITEMS`, the AUTO refresh and `report()` are untouched.

A section may carry `when(spec)` and is hidden when it does not apply — Side
windows only appear for a windscreen build, because with a full canopy the two
openings meet. It hides the knob; it does not clamp the value, which is the
house style. Any section named in no group is collected into "Other" rather than
silently vanishing.

New control type `t: 'chk'` (five booleans arrived with the glazing). Checkboxes
re-read on refresh, and they must: `clampSpec` rewrites `glazing: 'greenhouse'`
as a bubble with `facet` set.

### GATE GEN's MIRROR CHECK, AND WHAT IT CAUGHT

The merge failed GATE GEN at 73/74: `asymmetric skin groups: gearmetal(40)
belt(64) buckle(32) dumm(1280) dumj(1040)`. Both causes are real and neither is
a defect, but the diagnosis mattered and the fix is not "exempt the failures".

`gearmetal(40)` was the PITOT, at z = -1.9: an aeroplane has one pitot mast, on
one wing. Exempting `gearmetal` would have bought that at the price of no longer
checking the struts, gear legs and boarding steps that share the group — so the
mast is now its OWN group (`pitot`), and only that is exempt. The symmetric
hardware stays checked.

The occupant is genuinely not a mirror-symmetric object: the harness runs
diagonally over one shoulder and the calibration roundel is on one side of the
chest. Its limbs ARE posed symmetrically — `sd` signs every splay angle — but
the capsules swept between the joints do not land on bit-identical mirrored
vertices, so the check cannot say anything useful about the figure. Verified
that this is a primitive-generation detail and not a posing bug by measuring the
seat furniture built alongside it: `seat`, `spipe` and `sframe` mirror EXACTLY
(0 asymmetric vertices each) and are deliberately left in the check.

Exempt set is now `prop`, `pitot`, and the five occupant groups. Each entry
carries its reason in `test_gen.js`; an exemption is a hole in the one check
that catches a wing built upside down, so it should stay hard to add to.

The UISMOKE stub gained `DirectionalLight.shadow`, `ShadowMaterial`,
`SphereGeometry` and `BackSide` — the studio uses them. `PMREMGenerator` is
deliberately left OUT of the stub so the guarded no-environment path is the one
exercised headlessly.

### THE PITOT

Its root was a hardcoded 0.10 m below a front-spar NODE, and a spar node is
inside the wing — how far depends on the aerofoil's thickness at that station.
Measured, the root sat 0.9 to 5.5 cm INSIDE the skin depending on naca, chord
and taper, which is the "not well connected" the user reported. It is now placed
by `wingSectionAt` with a single lower-surface point from the same `genAfEval`
the loft uses, so it lands ON the surface with correct node weights and flexes
with the wing. Same rule as the glazing: put the part on the emitted surface
rather than near it.

### GEN_SPEC_V 3 -> 4

The cabin gained its whole glazing surface, plus `fuselage.tailY`,
`paint.regX`, `wings[].centre`. NOTHING READS the number — `genNormaliseSpec`
defaults every missing field and an explicit null stays null and keeps being
derived, so an older spec loads correctly without being told what it is. Bumped
to be honest about the shape, not because a migration is needed. **Do not add a
migration that only re-does what normalisation already does.**

### ALSO

`matFor` no longer renders a group WHITE when its named sheet is missing: it
falls back to the material's own colour, and every textured material in the
payload now carries one. A missing bake used to read as a modelling error.

### STILL OPEN

Carried from TRANSFER-GLAZING §7: strut and tube attachment fittings (never
started), instruments on the panel face, interior trim, and rib tape count as a
constant (13 per semispan) rather than the rib count 61_gen_frame.js already
derives from 0.4 m spacing — one line, left alone because it moves the UV pitch
of every existing build. The dummy has no hands or face on purpose.

## G6 — THE HANGAR (2026-08-12)

The design session sent a second bundle: a procedural hangar, and it is now the
garage's default room. The studio stays as the other option — they answer
different questions. The hangar gives the aeroplane a floor, a scale to be
judged against and light with a direction; the studio is a neutral field with
nothing in it, which is what you want when the question is about the SHAPE and
the room is in the way. Source preserved at
`futureDesigns/transfer-glazing/hangar.html`; the port is `src/viewer/hangar.js`.

The room: 26 m deep by 36 m wide, 8.4 m to the eaves, 11.6 m to the ridge, with
a 31 m door — a DC-3's 28.96 m span with a metre either side. Everything is
built from primitives and canvas-baked sheets (no external art, no network) off
a seeded PRNG, so it is the same shed every time. 1107 meshes, 26 440
triangles, 223 ms to build.

### IT IS BUILT IN THE AEROPLANE'S OWN FRAME

Worth knowing before touching either: the hangar's axes ARE the model's. x is
depth with the door at -x, z is span, the floor is y = 0 — and the model frame
is x aft, z spanwise. So the room needs no alignment maths at all, PROVIDED the
aeroplane is at the origin.

Which is why `enterGarage` no longer calls `placeAtAerodrome`. That apron
placement was the last thread tying the editor to the world — G5 stopped
rendering the world, and this stops standing in it. Rolling out re-places from
scratch (`fullReset` -> `applyRoute`), so nothing downstream depended on it.
Only the room's y is set, to the contact plane `standOnWheels` levelled on.

### THE PORT, AND THE ONE THAT COST AN HOUR

Four r128 differences, all marked at their sites. Three are small: colour space
is an `encoding`, `MeshPhysicalMaterial.thickness` is r132+, and there is no
`scene.environmentIntensity` (the moods scale each material's own
`envMapIntensity`, captured once — scaling a scaled value compounds).

The fourth is the whole ball game. **Lights are physically correct by default in
0.184 and legacy by default in r128.** The room's shop lamps are
`PointLight(colour, 90, 26, 2)` — 90 candela with inverse-square falloff, which
under the legacy model is not a lamp but a small sun. The first render came out
**255,255,255 in every pixel**, and it read as a missing scene rather than as an
exposure fault; what proved it was drawing was the draw-call counter sitting at
1509. r128 has `renderer.physicallyCorrectLights`, so the room turns it on for
itself and hands it back on the way out — the world and the two mesh aircraft
are calibrated under the legacy model and must not inherit it. The environment
bake is wrapped in the same switch, or the room reflects a different sun than
the one lighting the aeroplane in it.

After the fix, luma histogram across the frame: 0.7 / 12.8 / 63.8 / 20.4 / 2.3 %
from black to white. A room, not a whiteout.

NOT copied: the session's `PCFShadowMap`, which is an r184 deprecation
workaround. Soft PCF is fine in r128 and the viewer's own shadow settings are
better, so they are left alone.

### THE ROOM LIGHTS ITSELF

A cube camera on the floor sees the glazing, the roof lights and the open door,
and a PMREM of that is what every glossy thing reflects — the aeroplane above
all, since it is the glossiest thing in there. The dust shafts are hidden for
the bake (they are cards, not geometry to reflect) and the cards are turned to
face the camera each frame.

Four moods — AFTERNOON, OVERCAST, GOLDEN, NIGHT — each carrying key intensity
and colour, hemi, lamp power, exposure, fog colour and environment level.

### COST, AND THE ONE NUMBER THAT IS WRONG

| room | draw calls | tris/frame | ms/frame |
|---|---|---|---|
| hangar | 1509 | 85 210 | 3.5 |
| studio | 33 | 51 758 | 1.1 |

3.5 ms is not a problem here, but **1509 draw calls for 26 440 triangles is**:
that is 1107 separate meshes averaging 24 triangles each, plus the shadow pass.
Every workshop prop is its own mesh with its own material. The geometry is
explicitly static (`G` is "everything static"), so merging by material would
take it to roughly the number of materials — about fifteen draws instead of
fifteen hundred. It is a construction change, not a decimation, and it is the
obvious next move if the garage ever feels heavy on a weaker machine. Left
alone for now: it is the design session's geometry and it is fast enough here.

### THE SWITCH

`bEnv` (Hangar/Studio) and `bMood` cycle, both garage-only and both hidden
outside it; the mood button additionally hides in the studio, which has one
light and no weather — offering "Golden hour" for a white void would be a lie.
The choice is a VIEWER preference in localStorage, deliberately NOT in the spec,
so it never lands in a saved build or a shared design.

The room is built ON DEMAND and once: a session that never opens the garage does
not pay 223 ms for a shed. `genHangarSupported(THREE)` is ASKED rather than
assumed — the headless smoke gate stubs THREE with what the viewer needed before
this file existed, so a missing constructor degrades to the studio instead of
throwing on boot. That is the path GATE UISMOKE actually exercises.

## G7 — SAVING A BUILD (2026-08-13)

Raised by losing one. A build lived ONLY in `garageInit`'s closure: nothing was
written anywhere, and `window.GARAGE_SPEC` — which the comment at the top of
`app.js` had described since G3 as "the editor's handle on it" — was never
actually assigned. So a reload was destructive and there was no way to get a
build out of the page, not even from a console. A user lost an aeroplane they
liked, which is the only kind of bug report this feature needed.

### WHAT IS SAVED IS THE SPEC, NULLS AND ALL

The one rule worth keeping. A field left `null` is one the generator DERIVES,
and it has to stay null in the file:

- freeze the derived number into the save and it stops following what it was
  derived from — a build reloaded after a cabin change quietly stops fitting its
  own cabin;
- and an old save keeps benefiting from later generator work, because the fields
  nobody set are recomputed by today's rules rather than yesterday's.

Measured on the stock aeroplane: 28 of its fields are null. A round trip
preserves all 28, verified by comparing the null PATHS before and after, not
just the count.

`genNormaliseSpec` fills anything a file predates, so a partial or older spec
loads rather than being refused. That is also why the envelope's `v` is written
but not read — same reasoning as `GEN_SPEC_V` itself: it is there for a future
migration to branch on, not because one is needed. Do not add a migration that
only re-does what normalisation already does.

### THE PIECES

- **Named slots** in localStorage under `flydiy.build.<name>`. Save, Save-as,
  Delete, and a select to load from.
- **The working build** is written to `flydiy.wip` on every rebuild — which is
  already debounced, and is the point at which the spec is a build rather than a
  half-dragged slider. Restored on `garageInit` instead of `GEN_DEFAULT`. This
  is the part that makes a reload non-destructive.
- **The slot association survives too**, so Save still knows its target after a
  reload — but only if that slot still exists, or a name pointing at a deleted
  build would make Save silently resurrect it. Semantics are a document
  editor's: unsaved changes come back, and they come back as unsaved changes to
  the build they belong to.
- **Export** writes a `.json` the user can keep or hand to somebody else.
  **Import** takes it back by file picker or by dropping it anywhere on the
  panel. Both accept a BARE spec as well as an envelope, because a spec pasted
  out of a console is a perfectly reasonable thing to want to load.
- **`window.GARAGE_SPEC` is real now**: `get`, `set`, `resolved`, `json`,
  `list`, `save`, `load`. The comment stops lying, and a build can never again
  be trapped in a closure with no way out.

### DELIBERATE

**Load replaces, it never merges.** A build is a whole aeroplane; merging one
into another gives a third thing nobody designed.

**Storage is best-effort everywhere.** Every localStorage call is guarded, and a
browser with storage disabled must still build aeroplanes — it loses saving, not
the session. The slot controls disable themselves rather than pretending. That
guarding is also what keeps GATE UISMOKE green: its DOM stub has no storage and
no `Blob`, and every one of these paths is either guarded or inside a click
handler the gate never fires.

**Saving is not part of the aeroplane**, so the bar sits above the sections
rather than in `SECTIONS`, and nothing about it reaches the spec.

**A bad file is refused with a message**, and the build on the bench is left
alone — verified by dropping `{"hello":"world"}` on the panel.

### VERIFIED

- build -> save -> wreck (span 12.4 -> 9.0) -> load: restored EXACTLY, byte for
  byte, all 28 null paths identical
- reload with an UNSAVED edit: span 13.7 came back from `flydiy.wip`
- reload with a slot association: slot `alpha` held 10.9, the unsaved edit was
  11.3, and the reload gave 11.3 still pointing at `alpha`
- export -> drop-import round trip through the real drop handler
- bare-spec import
- garbage file refused, build intact

## G8 — THE PROPELLER (2026-08-13)

The design session's propeller, imported at last, plus the ground-clearance rule
it made worth re-reading.

### WHERE IT CAME FROM, since this took three tries to establish

There is no propeller work in the second or third bundle. Both are byte-identical
to each other in every code and doc file (verified by hashing each entry; the zip
hashes differ only in timestamps), and their only prop-related content is
`leaningProp`, an ornament against the hangar wall. The propeller work has been
sitting in `gen/63_gen_skin.js` since the FIRST bundle — it is the work that was
marked dismissed at the time, and it is unchanged in all three.

### THE IMPORT, AND THE ONE THING THAT HAD TO CHANGE

Taken: a revolved ogive spinner (cone / dome / none as one exponent family),
aerofoil-section blades on a real twist law, a planform widest a third out and
closing to a round tip, and the outboard tenth as its own `proptip` group so a
painted tip is paint rather than a UV band that moves when the blade's shape
does. Nine stations, thirteen points, about 193 triangles a blade.

NOT taken: its spec. The session drove all of it from a per-engine
`engines[0].prop` with a NUMERIC pitch and no physics behind it. The trunk has
since promoted `prop` to a top-level group the solver pulls on — disc area sets
static thrust and the wash the tail flies in, blade mass sits at the very front
where it costs the most CG, and pitch is an enum carrying a momentum-theory
figure of merit. Restoring the session's spec would have unhooked the propeller
you can see from the propeller that makes the thrust. So the geometry is driven
from the trunk's group, and the group gained three VISUAL-only fields —
`chord`, `root`, `spinner{shape,len,dia}` — marked in the spec as the half that
does not move the aeroplane.

**`pd` beside `fm`, and not derived from it.** The twist law is
`beta(r) = atan(P / 2 pi r)` and needs pitch as a fraction of the DIAMETER — the
number written on a real prop, a 74x45 being a P/D of 0.61. `fm` is a
momentum-theory efficiency, it runs the OTHER WAY ROUND (climb 0.58, cruise
0.36), and its spread is nothing like a pitch ratio's. Using it would have given
a fine prop a coarser twist than a cruise prop: backwards, and visible. So
GEN_PROP_PITCH carries both, climb/standard/cruise = 0.55/0.70/0.85.

**The blade is the material it is made of.** `prop.material` already carries
mass and price (GEN_PROP_MATS), so the colour follows it — wood, aluminium,
carbon — rather than being a second decision that can disagree with the first.

**NOTHING THE PROPELLER OWNS TOUCHES THE COWL**, enforced rather than hoped for:
the whole blade is walked forward until its aft-most vertex clears the nose
face. Measured across stock, a fat blade at fine pitch, six fat blades, no
spinner, a tiny spinner and a 3.2 m disc — clearance held between 5.8 and 7.4 mm
in every case. That check is what makes the parametrisation safe, because a
coarse wide blade swings a long way back.

`proptip` joins `prop` in GATE GEN's mirror exemption, for the same reason and no
other. `spinner` is NOT exempt: it is a revolve about the thrust axis and mirrors
exactly, so it stays checked.

### PROP CLEARANCE, AND THE RULE THAT HAD NEVER ONCE BOUND

`GEN_RULES.propClear` was 0.40 m, which is a Cub's actual 0.42 rounded down:
what a real aeroplane HAS, not what it is allowed. FAR 23.925 — the same
regulation GATE LOAD already works to — asks nine inches on a taildragger and
seven on a nosewheel, tyres flat and strut deflated. So it is now 0.229 /
0.178 m, and the two gear types get their own figure instead of sharing the
stricter.

**And that alone broke four undercarriage checks and GATE FLEX**, which is the
part worth recording. Prop clearance had been setting RIDE HEIGHT: it always
won against `legDrop`, so `legDrop` — the rule that is actually supposed to own
leg length — had never once been the binding constraint, and its 0.35 m had
therefore never been validated. Lowering prop clearance exposed it, and 0.35
turned out to be nowhere near enough. GATE GEN failed "every plausible engine
stands on its wheels", "stiffer suspension deflects less", "usable suspension
range stands up" and "the undercarriage never folds", and GATE FLEX called the
gear a mechanism. Exactly what `legDrop`'s own comment had predicted all along:
a near-horizontal leg has almost no vertical stiffness and the aeroplane squats
onto its belly.

Measured, sweeping each in turn:

| prop clearance | leg | softest suspension |
|---|---|---|
| 0.40 → 0.28 | 0.76 → 0.64 | stands |
| 0.26 and below | 0.62 and below | rests on the tailwheel |

| legDrop (at propClear 0.229) | axle | soft / std / hard |
|---|---|---|
| 0.35 – 0.58 | -0.609 (prop-bound) | NO / yes / yes |
| 0.62 | -0.640 | NO / yes / yes |
| **0.64** | -0.660 | yes / yes / yes |
| 0.66 (taken) | -0.680 | yes / yes / yes |

0.64 is the edge and 0.66 is that with enough headroom not to sit on the cliff.

The result is the right way round for the first time: **the leg sets ride height
and prop clearance is the floor beneath it.** The stock aeroplane still ends up
0.10 m lower than it was (axle -0.78 -> -0.68), `gear.yBoundBy` now reports
`legDrop` rather than `prop clearance`, and a builder who wants the blades
closer can lower `legDrop` and will be allowed to — until the prop stops them at
the certificated minimum, which is what a minimum is for.

The level attitude is still the right one to measure a taildragger in: the
critical moment is the take-off roll with the tail already up, not the
three-point stand where the nose is high and the disc is well clear.

### THE PANEL

"Engine, cowl & blades" is now **Engine & cowl** — they stay together, user call
— plus **Propeller** as its own subsection under Power, carrying the four
physics fields and the five shape ones. The Power group's section list names it,
or it would have landed in the "Other" bucket the grouping keeps for exactly
that mistake.

### A METHOD NOTE, because it cost a battery

Do not run `tools/build.js` while a battery is running. The runner builds once at
the start and every gate then reads `tools/flight_core.js`; rebuilding under it
means the gates before and after the rebuild tested different code, and the
summary is one verdict over two artifacts. Two runs were thrown away learning
this. Either let a battery finish, or use `--only=...` with `--no-build` after a
clean build of your own.

## G9 — THE CONTROL SURFACES FLEX (2026-08-13)

User: "the elevators do not seem connected to the torsion model. When using the
rudder, there is big torsion on the tail, everything moves but the control
surfaces." Correct, and the mechanism was not quite what it looked like.

### WHAT IT ACTUALLY WAS

The surfaces DID ride the structure. A `moving` group got a hinge quaternion for
its deflection plus a translation of its pivot by the weighted average of its
influence nodes — so a bending wing did not leave its aileron behind, which is
what that translation was added for. What it could not do is TWIST: one averaged
translation carries no rotation, by construction. So the tail wound up under
rudder and the rudder hanging off it slid sideways and stayed straight.

### WHY THE OBVIOUS FIX WAS ALREADY FORBIDDEN

There is a comment in `app.js`, from whoever made them rigid in the first place:

    Neither the PROP nor a CONTROL SURFACE is a flex body. Both are rigid
    meshes with a pivot: deforming their vertices applies a correction in a
    frame that is itself turning, which is what made the blades wobble and
    what used to let an aileron drag the wing tip around with it.

That is a real bug and the warning is right: a body-frame correction added to a
mesh that ALSO carries a quaternion is applied inside a frame that is turning,
and comes out wrong by exactly that rotation.

The way past it is not to add a deform on top of the rotation. It is to stop
having a rotating frame at all. The geometry now stays in the BODY frame, the
mesh keeps an identity transform, and the hinge is applied per vertex about the
pivot (Rodrigues); the structural displacement is then added in the same frame it
was measured in — which is precisely what the fixed skin has always done, and
what `poseSkinGen`'s `hinged` path exists for. The imported aircraft have worked
this way since the codec was written; the generated ones now do too.

### MEASURED

Synthetic tail torsion of 11 degrees at the tailpost, rudder NOT deflected,
comparing the top and bottom rudder vertices:

| | top vertex moved | bottom vertex moved | differential |
|---|---|---|---|
| old | [0, -0.0094, 0.0955] | [0, -0.0094, 0.0955] | **0.00000 m** |
| new | [0, -0.0202, 0.2047] | [0, 0.0014, -0.0136] | **0.21934 m** |

Identical vectors is the bug, in one number: the surface could only translate.

And the hinge is still an exact rigid rotation — checked on rudder, elevator and
aileron at 0.30 rad with no structural motion: distance to the pivot preserved to
2e-7 (float32), vertices ON the hinge axis move by exactly zero.

Cost is nothing: 24 vertices on the rudder, 32 on the elevator, 50 on an
aileron, two passes each.

It applies to ailerons and flaps as much as the tail — one change for the whole
aeroplane — and it is a VIEWER change only. The surfaces already carried correct
node weights (GATE GEN checks every group's sum to 1); nothing about the physics
moved.

### ALSO, A BUG THIS SESSION INTRODUCED AND CAUGHT

`isProp` was `name.lastIndexOf('prop', 0) === 0` — "every group named prop*". It
caught `proptip` by luck and missed `spinner` entirely, which G8 had just added:
a nose cone standing still in front of spinning blades. It is an explicit list of
three names now. A prefix match over a namespace anyone can add to is a trap.

## G10 — THE TAIL OUTLINE (2026-08-13)

User, with a Cub three-view: "the tips options do not work. We need them for the
fin and the stabs... we need the elevators to be able to be rounded too. Think of
the piper cub, both the fins and the rudder are rounded in a single movement."

### WHY THE TIP OPTIONS DID NOTHING — a renamed field, and nobody noticed

The tail read `TTIP.round` and `VT.round`. **No GEN_TIPS entry has ever had a
`round`.** They carry `{ name, e, bow, arc, fin }`, and the wing reads
`arc`/`bow`/`fin`. So `undefined > 0` was false, all three rounding branches were
dead, and every one of the six tip options produced BYTE-IDENTICAL tail geometry
— same vertex count and same position hash, measured across all six, while the
wing changed both. The control existed, the lookup existed, and the result was
thrown away one line later.

Worth the general lesson: a dead read of a renamed field is invisible to every
test that only checks the thing still builds. What caught it was asking the much
dumber question — does changing this control change ANY number at all?

### THE OUTLINE, AND THE HINGE

`panel(rows, hinge, mv)` already built the whole surface and cut it at the hinge,
so the "design the full mesh, then cut it" the user asked for was half present.
What it cut at was a constant chord FRACTION. That bends with taper and, once the
outline curves into a rounded tip, curves into the tip and drags the control
surface with it.

It now takes a STATION — `{ x }` — and converts per row. Every three-view shows
why: rudder and elevator hinges are straight lines. The Cub's shape then falls
out for free rather than being drawn in. Its fin is the small forward slice and
the rudder the large aft one, and near the top the swept leading edge crosses the
hinge, so up there the section is ALL rudder and there is no fin at all. In
`panel` that is simply a row whose fixed part has no chord left; such rows are
dropped and the fin is capped where it ends. Measured: fin top 1.346 m, rudder
top 1.386 m — the rudder owns the rounded top, as drawn.

The bow itself is the wing's own two fields, `bow` and `arc`, on a quarter
ellipse: a builder who picks "Elliptical" means one thing and should get it on
every surface. Result — every option now moves the geometry:

| tip | elevator nv | rudder nv |
|---|---|---|
| square | 32 | 24 |
| clipped | 48 | 40 |
| rounded | 112 | 80 |
| elliptic | 144 | 96 |

`square` (bow 0) reproduces the old counts exactly, so nothing moved silently.

**Planform only.** Mass, stall speed, static margin and deck angle are identical
across square / rounded / elliptic — the outline changes what you see without
re-tuning the aeroplane under it, which is the same rule the stab taper follows.

### PER-SURFACE TIPS

`tail.tipV` and `tail.tipH` override the shared `tail.tip`, null meaning "as
tail" so an older save keeps its shape. A Cub has a big round fin and a
near-elliptical tailplane and should not be forced to match. `tail.tip` remains
the V-tail's, which is one surface.

Panel labels: the section already had a "Stab tip" — a chord LENGTH in metres —
so the shape controls are "Tail outline / Fin outline / Stab outline". Two rows
called "Stab tip" meaning a length and a shape is the kind of collision that
reads as a bug in the control.

### TWO MISTAKES MADE HERE, BOTH CAUGHT BY MEASURING

**The left tip bow grew inward.** `sgn` was 1 for both sides, so the port bow ran
toward the centreline: 80 of 112 elevator vertices with no mirror twin. Both
surfaces mirror exactly now (0 asym). GATE GEN's mirror check would have caught
it; measuring caught it first.

**A hinge that looked bent and was not.** The rudder's leading edge spread 0.21 m
in x over its height, which reads as a curved hinge. It is the REST FRAME: group
positions go through `B()`, and the aeroplane sits pitched up 9.16 deg on its
tailwheel, so a vertical line becomes a sloping one — 1.05 m of rudder times
tan(9.16) is 0.17 m of it. The hinge is straight by construction: the moving part
starts at `le.x + frac * len` where `frac = (hinge.x - le.x) / len`. Anything
measured on emitted geometry is in the rest frame; the spec is not.

## G11 — THE TAIL, IN THE FRAME (2026-08-13)

Fin rake, stab height and a real dorsal fin. The first two move the TRUSS, so
unlike G10 they move mass, CG and the aeroplane's balance.

### FIN RAKE

`tail.vSweep`, degrees of leading-edge sweep, nullable and derived from what the
fin already had — the skin swept its LE by a hardcoded 0.30 of chord over the
fin's height, which works out at **8.97 deg** on the stock build. Three constants
(0, 0.14, 0.30 at root, mid and tip) described very nearly a straight line and
are now exactly one.

| rake | mass | margin | FIN node x |
|---|---|---|---|
| 0 | 402.1 | 20.2% | 5.543 |
| 8.97 (auto) | 402.2 | 20.0% | 5.709 |
| 25 | 402.5 | 19.8% | 6.034 |
| 45 | 403.2 | 19.1% | 6.595 |

Fin AREA is constant at 0.866 m^2 throughout — rake is planform, not size —
while mass rises as the members lengthen and the margin drops as that mass goes
aft. Both fall out of the geometry rather than being tuned.

**THIS CHANGES EVERY EXISTING BUILD, slightly, and that is deliberate.** The FIN
node had always sat at `t.vX`, upright, inside a fin the skin drew swept: the
truss and the surface disagreed. The node now follows the rake, which moves it
5.543 -> 5.709 on the stock aeroplane and takes mass from 402.11 to 402.2 kg and
the static margin from 20.2% to 20.0%. That is a correction, not a regression —
but it is a change, and the first draft of this section claimed the default was
untouched, which was wrong.

### STAB HEIGHT, AND WHERE THE T-TAIL WENT

`tail.stabH`: 0 leaves the tailplane on the tail cone where it has always been,
1 puts it level with the fin tip. The stab node rises 0.299 -> 1.432 m, mass goes
402.2 -> 405.4 kg and the static margin 20.0% -> 17.7%.

**Y ONLY.** `hX` is the tail ARM and stays the builder's, because moving it here
would re-tune pitch authority behind their back — measured, tail volume `Sh` is
1.976 at every stab height. The old backlog's #21 "T-tail" is therefore this
control at its limit rather than its own chantier.

### THE DORSAL FIN RAN THE WRONG WAY

What was called a dorsal fillet grew the root chord 30% **AFT** — a wider root,
not a dorsal. A real one goes forward: the Cub three-view the user supplied shows
a fairing leaving the turtledeck well ahead of the fin and sweeping up into its
leading edge. It now does that: the LE is extended forward at the bottom and the
extension fades out (as (1-u)^1.6) where it blends into the fin, which is what
makes the join a fillet instead of a corner.

Measured, the geometry the dorsal adds:

| len | forward edge | x span | half-thickness |
|---|---|---|---|
| 0.34 | 4.069 | 1.039 | 0.0245 |
| 0.80 | 3.609 | 1.499 | 0.0356 |

`width` scales thickness linearly (0.15 -> 1.6 gives 0.0067 -> 0.0712 m); `panel`
gained a thickness multiplier for it, because the 9-series section is 9% of
chord, which is right for a flying surface and far too fat for a fairing whose
chord is most of the tail cone.

**FOUR CONTROLS FOR A THREE-CORNERED SHAPE.** The user asked for height, length,
width and angle, and a triangle is fixed by two of the three lengths — so
`angle` is nullable: set it and it drives `len` from `height`; leave it and it is
derived from the two lengths and reads AUTO (25.20 deg on the stock build).
Verified both ways: angle 20 gives len 0.44, angle 45 gives len 0.16. That is the
same bargain every other over-determined control in this spec makes, rather than
letting two knobs quietly fight.

## PLAYTEST BACKLOG (the numbered list, kept HERE from G4.6 on)
The user's playtest items were tracked in a session table and nowhere in the
repo, which meant re-deriving them every session. Numbering is theirs and does
not renumber. 22 raised, 18 done.

| # | Item | What it needs | Where |
|---|---|---|---|
| 2 | Structure has no visual feedback | Per-material appearance: fabric weave, ply grain, alloy panel lines + rivets, carbon weave. Four materials look identical. G5 brought the bump/metal-rough sheets, so the machinery is there — what is missing is a set PER MATERIAL | waits on UV work |
| 19 | Role-play details | Pitot DONE (G5, and its attachment fixed). Radio antenna/mast and garage-only ribbons/covers remain | free-standing |
| 21 | T-tail | Stabiliser on top of the fin — the fin carries it, so it is FRAME work, not a skin option | tail chantier |

Groupings that hold: **2** still waits on material appearance (14 is done: G5 built the glazing routes as real geometry, not the material/transparency band this line assumed). **21 is now
alone** — its partner 22 is done, so a T-tail chantier is free-standing frame
work. (11+12+4+18 were the undercarriage chantier, G4.6; 20+15+13+6 the nose,
G4.7; 22 the tail join, G4.8.)

Done: 1, 3, 5, 7, 8, 9, 10, 16, 17 (G1.7-G3.6, G4.1-G4.5), 4, 11, 12, 18
(G4.6), 6, 13, 15, 20 (G4.7), 22 (G4.8) and 14 (G5). Plus the two extras the user asked for since — wireframe view and UV
projection view (G4.5) — both now visually verified along with the decal.

## G12 — THE TEMPLATE CAGE (2026-08-14)

The fuselage-topology rework has its primitive. The user hand-built ONE
Blender control cage in three layered meshes (Downloads/
templatePlaneProcedural_{0,1,2}_nocc.obj + .mtl) and the session reverse-
engineered them into a generator that reproduces all three exactly:

- **mesh 0 — zones** (56 v / 54 q): the conceptual anatomy only. Stations are
  the zone boundaries (tail cap, tailpost, aft-cabin pillar, cabin pillar,
  window ring, windshield frame, nose ring); levels are keel / waist / roof.
  Materials name the zones: body, windshield, skyWindows, pilotWindow,
  pasengerWindow.
- **mesh 1 — pillars + rings** (164 v): every anatomy station gains a TWIN
  loop (the pillar band: pillarTail/-Passenger/-Cabin/-Window/-Front), and
  three longitudinal RAILS appear: floor line, ceiling line, waistband top
  (y = 0.1537 CONSTANT — a painted stripe is straight; the waist y = 0.0911
  is the other global constant).
- **mesh 2 — CC control** (320 v): pure loop cuts that pin Catmull-Clark so
  zones keep their edges and materials do not bleed. ALL DERIVED: guard rings
  are constant-t lerps of the two rings bounding their bay (t table per bay);
  guard levels are in-ring 3D lerps (waistG = lerp(waist, floor, 0.269721),
  bandG = lerp(band, ceil, 0.019837)) applied everywhere including caps,
  windshield slope and centreline chain.

Two more derivation rules fell out (each verified ~1e-5 against the file):
band x = Ww − 0.081740·(Ww − Wr), ceiling x = Ww − 0.939852·(Ww − Wr) —
the upper-wall rails sit at fixed FRACTIONS of the waist→roof width span,
not at their y-interpolated positions. Floor = designed y, x/z lerped along
the keel→waist wall.

**THE WINDSHIELD IS NOT A SPECIAL SURFACE.** The global lines continue onto a
slanted plane: glass sits between the waistband line and the ceiling line —
the SAME rails the side windows use — the A-pillar is a full 18-vertex ring
whose upper half lies on the slope, and the waistband flows around the
windshield base. Forward of it the upper levels fold onto the centreline
chain (roofC/ceilC/bandC/waistC columns, base bow 0.559, ceiling bow 0.129);
the cowl is a flat deck at waist level closed by a 3-col grid cap (no pole,
no subsurf pinch). That is why windows and doors can be cut anywhere the
rails run, and why the old loft's windscreen crank cannot exist here.

Tools (all gitignored under flyDiy/tools/_cage*, never in MANIFEST):
- `_cage_gen.js` — the generator. CAGE_DEFAULT is the fiche (every measured
  number, commented); buildCage2(spec, step) emits step 0/1/2; cageSpec(P)
  is the slider layer (CAGE_PARAMS defaults are the identity); orientCage
  makes windings coherent+outward.
- `_cage_fit.js` — THE VERDICT: parses the three reference OBJs, matches
  vertices (nearest-neighbour) and faces (cycles up to rotation/reflection)
  and materials. Current state: step 0 exact (dev 1e-6), step 1 exact
  geometry + 3 material diffs that are the REFERENCE's own transitional
  bleed (boom band tagged pasengerWindow in mesh 1, corrected by mesh 2 —
  report-only), step 2 EXACT: 320/320 v, 318/318 f, materials 100%, max dev
  3.6e-5 (the floor-rail wall-lerp, below the OBJ's 6-decimal rounding).
  Also asserts the cageSpec identity and would catch fiche drift.
- `_cage2.html` — demonstrator: sliders (layout / section / aft+tail /
  windshield / nose), step + subsurf selectors, ghost overlay of the
  reference OBJs (byte-copies at _cage_ref_N.obj), OBJ export of the
  control cage. Verified in-browser: closed quad manifold at every slider
  combination tried (paxCount 0-3, squash/stretch), skylight/windshield/
  waistband all crisp under L2 subsurf.

Modularity: pax bays repeat ([pax bay + pillarPassenger] units), pax 0-4
all emit closed all-quad manifolds (Euler 2, coherent windings, verified
programmatically across the slider space).

### G12.1 — THE BUBBLE CANOPY (same day, user ask)

"Could we get a proper canopy by relaxing or deleting some rings?" — yes,
and no topology change was needed. The box template's roof is flat for ONE
reason: the ceiling loop hugs the roof and pins Catmull-Clark. `top` mode in
_cage_gen.js (round 0..1, angCeil/angRoof, comp, bubble) re-places the upper
levels of EVERY ring on a waist-to-crown elliptical arc — ceil and roofF
become arc samples (~52/81 deg), roofC becomes the crown, comp (~1.03) fades
in with sin(theta) so the waist stays exact and only the dome inflates
against CC shrinkage. The waistband pair is deliberately NOT relaxed: the
sill keeps its crease, which is what a bubble canopy on a round fuselage
looks like. bubble=1 turns the ceiling band + windshield top frame to glass
so the canopy reads sill-to-crown. round=0 is the bit-identical box path —
the fit guards it (FIT: OK after the change).

`_cage3.html` is the demonstrator (Jodel-ish defaults: roofY 0.72 ≈ near-
semicircular top on the 0.554 half-width, wsRun 0.95 / baseBow 0.45 /
ceilBow 0.30 raked front, roundness slider fades box->bubble live).
Verified: round mode is closed-quad-manifold at pax 0-3 and a true
semicircle preset; side/front/top screenshots read as a proper glasshouse
with round turtledeck. _cage2.html untouched (the faithful box template).

### G12.2 — CREASES + CONFIGURATIONS (2026-08-15)

User review of G12/G12.1 raised two defects and a capability ask; the full
9-point roadmap is in the session plan and mirrored below as chantiers.

**THE FROWN WAS GEOMETRY DENSITY, AND CREASES ARE THE FIX (user-confirmed
cause).** `cageSubdivide` in _cage_gen.js is now a crease-aware semi-sharp
Catmull-Clark (Pixar rules: creased edge-points use the midpoint rule,
child edges inherit weight−1, fractional weights lerp; 2 sharp edges at a
vertex -> (E1+6P+E2)/8 crease rule, >=3 -> corner). `buildCage2(spec,
'crease')` is the CANONICAL output (user decision): step-1 geometry (164 v
vs step 2's 320; L2 render mesh 2594 v vs 5090) + edge tags derived from
the same bay/level tables that place the guard loops — the two modes
cannot drift. Weight families in spec.crease: pillar/sill/band/frame/cap/
frontCap, all sliders. Steps 0/1/2 remain fit-verified against the Blender
templates (`node tools/_cage_fit.js`, still FIT: OK, bit-guarded). The
A-pillar frown cannot form in crease mode (no guard cluster); the round-
mode A-pillar widths are additionally pulled to their mean (box path
untouched). Before/after evidence: loop mode shows the heavy wavy browline,
crease mode a clean hairline frame.

**CONFIGURATIONS — same topology, routing choices** (user ask: pushers,
aero noses, full-round, bizjet/sailplane):
- `top.botRound` mirrors the round-top machinery below the waist (floor
  and keel-corner rows on the lower arc, keel centre = bottom crown):
  round top + round bottom = the oval tube.
- `config.noseMode 'aero'`: NO fold at the windshield — full rings
  continue through the screen zone (windshield = a MATERIAL ZONE on the
  upper bands with crease-weighted frame hoop, the C172/loft_fit lesson)
  and a shrinking drooping cone (aeroWs pillar pair + noseMid + noseTip)
  to a front grid cap. Cap style = crease weight: ~0.3 domes (radome),
  high = flat cut.
- `config.rearAperture`: the tail cap becomes the flat pillarFront face —
  the pusher prop disc. Tractor/pusher are symmetric cap styles.
- `config.boomMid {t, pinch}`: one optional control ring for the
  sailplane pod-to-boom waist (the boom is a single CC span otherwise).
- Least-geometry principle held: configs add only their optional stations
  (aero +4 rings, boomMid +1); crease mode meanwhile halves the template.

Presets in _cage3.html prove it (screenshots taken): bizjet, sailplane
(pod + pinched boom + bubble, softer crPillar 0.5), pusher (round nose,
flat aperture disc at the tail). Health sweep: 32 config x step cases all
closed-quad-manifold including crease-mode L2.

**G12.2b — user correction on the nose (same day).** The first aero-nose
implementation rebuilt topology and read ugly (smoothstep taper + droop =
concave tip). USER RULING, now implemented: the goal is the BASE geometry
— the existing cowl/deck/nose-ring assembly must itself go round; the
aero-nose continuous-rings path stays only as an EXPERIMENT under its
slider. Base-topology round nose:
- `noseCrown`: the deck CENTRE line rises (convex cowl top); the lift
  fades toward the ceiling line so the windshield centre profile stays
  monotone — the glass base arches over the crown (the gracious link).
- `noseH` / `noseDroop`: the nose ring shrinks vertically about the deck
  and droops — with `noseW` the "shrink the current nose" is now 3-axis.
- `config.cowlMid {t, bulge}`: ONE optional intermediate cowl loop
  (lerp of windshield base and nose twin, bulged) = the convex side
  profile. `crNoseCap` low domes the nose cap (radome), high keeps the
  flat engine aperture.
- The bizjet preset is BASE topology now (user: bizjet windscreens are
  framed/discontinuous — the fold IS the frame): round body + crowned
  drooped shrunken nose + raked screen. Verified by screenshot; reads
  like a Citation/Falcon front. Jodel defaults gained noseCrown 0.16 +
  cowlMid (the cowl top is convex, no more flat deck sliver).
- The aero experiment's tip: ellipse-quadrant taper (slope 0 at cabin,
  steep at tip — CONVEX outline merging into a point; the smoothstep it
  replaces plateaued while the droop pulled down = the concave look).
  Sailplane/pusher presets stay on the experiment with small tips.

**G12.2c — vertical base lift + the cowl profile (same day, user ask).**
- `ws.baseLift` rounds the BASE OF THE WINDSHIELD VERTICALLY: the base
  edge and the waistband rise above the waist line (wsFront full,
  wsAft x0.85 so it ramps through the quarter bay; the centre chain adds
  it to the crown), giving the section below the glass more arc — the
  glass sits high on a round nose shoulder like real aircraft.
- The single cowlMid became THE COWL PROFILE: `config.cowl {loops 0-2,
  ease, bulge}` samples loops between the windshield-base section and the
  nose end with DIMS eased by an ellipse blend while z stays linear — the
  lag is the convexity, never concave. `config.noseFinish`:
  - 'engine' (default): loops -> twin ring -> aperture ring + pillarFront
    band + flat-ish cap. THIS IS ALL FUSELAGE BEFORE ENGINE ATTACHMENT —
    the game's cowl assembly bolts onto the aperture (user reminder).
  - 'aero': loops -> tiny drooped nose ring + domed cap (crNoseCap low),
    NO aperture band — the FINAL nose, nicely convex.
- Bizjet preset now: baseLift 0.14, noseFinish aero, 2 loops ease 0.8,
  noseW/H 0.16/0.15, droop 0.26 — screenshot reads like a real bizjet
  (high framed screen on a round shoulder, drooped radome to a point).
  Jodel defaults: engine finish, crown 0.16, lift 0.05, 1 loop ease 0.35.
- Old cowlMidOn/T/Bulge params replaced by cowlLoops/cowlEase/cowlBulge.

**Pages refactored**: _cage_ui.js is the shared runtime (thin _cage2/
_cage3 shells): step select incl. 'crease' (default), curvature debug
shading (max dihedral heat — the frown detector), MACRO sliders (length/
width/height/belly/waist/rake/tail/aft/nose multipliers resolved before
cageSpec) with the detailed sliders in collapsed groups, preset menu,
ghost overlay, OBJ export.

### G12.3 — WINDOWS (2026-08-15, C3; v2 after user review)

`cageWindows` in _cage_gen.js — a post-pass on the CREASE-mode cage only
(the loop steps stay the fit-verified template). Faces are MARKED during
emission (glass-band quads of window zones -> `win`, the pilot-cabin door
band -> `door`); marked faces are grouped into ZONES (union-find over
shared edges, same material) — so the pilot side glass and the quarter
glass merge into ONE window across the window ring, as on the real
aircraft. Each zone gets a proper inset: the inner ring mirrors the
zone's boundary 1:1 (all-quad, no T-junctions), recessed `winDepth` along
the per-vertex normal (`winBlow` backs it out), frame quads in body
material, pane keeps the zone material.

**HARD-WON #1 (v1->v2):** a creased LOOP is still a smooth B-spline CURVE
under Catmull-Clark — a creased rectangle renders as an ellipse. Sharp
surface != sharp outline. Corners hold only under the Pixar CORNER rule
(vertex with >= 3 sharp edges) — hence ring + spoke creasing.

**HARD-WON #2 (v2->v3, user report "mesh gets messy"):** CREASE LINES MUST
NOT CROSS. Every crossing gives a vertex >= 3 sharp edges -> corner-pinned
-> a kink; fractional weights wobble. Consequences now in force: pillar
loops default weight 0 (the tight ring PAIR holds them — the template's
own mechanism), rails carry INTEGER weights (sill 2, band 1, ceil 1 — the
ceil rail also anchors window top edges), and the window construction is
SELF-CONTAINED: triple ring (untouched smooth boundary -> reveal ring ->
frame/glass ring), so window creases never touch the rails.

**HARD-WON #3 (v3 tearing):** corner-PINNED vertices stay on the control
cage while the smooth surface converges INSIDE it — a frame placed at
cage positions stands proud on a collapsing rim and the reveal band folds
(measured 148 inverted quads). Fix: place the frame rings at the LIMIT
positions (Halstead-Kass-DeRose stencil; crease vertices on rails use the
B-spline curve limit (E1+4P+E2)/6 blended by weight). Inset directions
are also projected into the local tangent plane (zones that bend across
the flank->slope junction would otherwise spike outward).

**G12.3 v4 — USER RULING: INSETS DISMISSED, RIM JOINTS INSTEAD.** Windows
are MATERIAL ZONES on the untouched surface (no cuts, no subsurf fights);
the joint is `cageRims`: a separate closed tube bead (diamond section,
material 'joint') swept along each zone outline — the same idiom as the
game's cframe/gframe canopy rails. The inset pass (`cageWindows`) stays
dormant behind winFrameW=0. Sweep construction, each item bought with a
failure: path points at the crease-aware LIMIT positions; the path is
DENSIFIED with corner-hugging points (sparse control ring -> oval — the
B-spline ellipse lesson, third appearance); each edge BENT through its CC
edge-point as a quadratic bezier (a straight chord dips under the domed
surface and the bead sinks into dashes); section frames PARALLEL-
TRANSPORTED along the path (recomputing the binormal per station twists
the tube into culled dashes — and do NOT flip per-station afterwards,
seed once). Viewer fix (user report): painter sort now keys on the
FARTHEST corner instead of the centroid — crease-stretched slivers with a
near centroid used to pop through covering faces.

**G12.3 v9/v10 — CONTINUOUS DOOR SILL, MESH-PARALLEL (final).** Two user
corrections in sequence: (a) row-peeling (doorDrop) was a jagged
staircase — deleted; (b) a constant-WORLD-HEIGHT iso cut slopes across
the lattice rows, because the rows follow the drooping keel line — the
bottom edge must stay PARALLEL TO THE MESH. Final form: `doorSill` is an
absolute offset (0..0.25) and the clip field is height ABOVE THE ZONE'S
OWN BOTTOM LINE: bottomY(z) is binned per z-column from the zone's
vertices — LOWER-REGION VERTICES ONLY (y < 40% of the zone height; in the
quarter bay the upper rows ride the windshield slope at shifted z and
poison the bins with mid-height minima — measured, fixed) — and the
outline is clipped at g = y - (bottomY(z) + sill) = 0 with the generic
field-clip machinery (ring crossings + per-face zero-line segments
chained between side crossings, loose snap on the first/last hops since
joints are limit-space vs raw-mesh segments). Verified: the sill line is
smooth and monotone, tracking the belly droop at constant offset
(y -0.717 fwd -> -0.804 aft at sill 0.05 on the jodel); doorSill 0 =
untouched full-depth outline; fit green. doorDeep stays as the coarse
band switch beneath it.

**G12.3 v8 — DOOR SPAN CORRECTED (user annotation).** The pilot door now
spans pillar to pillar in the REAL sense: from the cabin pillar forward
THROUGH THE QUARTER BAY to the A-pillar, its front edge following the
windshield slant (the quarter bay starts at the window ring — the earlier
version stopped there and missed half the width). `doorDrop` (default 1)
peels N subdivided rows off the door's LOWER boundary at the displayed
level ("a tad too low, up by 1 unit" — the unit is one row, so its
absolute size follows the subsurf level). Verified: door outline z 2.01
-> 3.32 on the jodel (cabin pillar to A-pillar), bottom one row above the
belly edge; fit green.
USER OPTION FOR LATER (not built): the whole door can become a WINDOW —
glass propagating down past the waistline — via a `sillDepth` parameter
that extends the glass material zone down the mesh; same dispositive for
the pax bays. Natural implementation: post-subdivision material
reassignment of door-zone faces above a y-threshold, so the window
outline/joint follows automatically via the material marks.

**G12.3 v7 — WINDSHIELD JOINT, THE REAL DOOR, OUTLINES AS OBJECTS (session
end state).**
- The windshield glass is rim-marked too; left and right share the
  centre-chain edges, so the union-find yields ONE zone and ONE seal loop
  around the whole screen (works in cowl and aero modes — any face with
  material 'windshield' in the glass bands).
- THE DOOR (user spec): encompasses the whole window and runs from the
  window top (ceil line — only the thin ceiling band remains above it)
  down to the belly edge, pillar to pillar. Marked bands: glass +
  waistband + door band + floor band (`doorDeep` drops the floor band to
  stop at the floor line instead). Doors per side on the pilot bay
  (`doorOn`) and on every pax bay (`doorPax`). A face can belong to BOTH
  its window zone and its door zone — the two kinds are grouped in
  independent union-find passes; the window seal nests inside the door
  seal, like the real aircraft.
- OUTLINES ARE FIRST-CLASS OBJECTS: `cageRims(mesh, spec)` records
  `mesh.outlines = [{kind: 'win'|'door', mat, ids, pts}]` — the ordered
  boundary vertex ids AND limit-surface points of every zone, at the
  displayed subsurf level, recorded EVEN when a tube is disabled. This is
  the manipulation handle for later sessions (reshape, offset, hinge
  lines, cut-outs).
- Options (sliders + spec): `rimW` size, `rimWin`/`rimWs`/`rimDoor`
  per-family tube toggles, `doorOn`/`doorPax`/`doorDeep`. Door tube at
  0.85 x rim. Verified: fit green, manifold at L2 with pax doors on 2
  bays, outline inventory correct (1 windshield, 2 per-side windows/doors
  per bay), screenshots show the nested door + window seals and the
  windscreen loop.

**G12.3 v6 — RIMS SWEEP THE DISPLAYED LEVEL (user spec, final form).**
`cageRims(mesh, spec)` now runs AFTER subdivision (the page calls it on
the L-level mesh): zone marks (`win`/`door`) propagate through
`cageSubdivide` children, the zone boundary is traced on the subdivided
mesh (interior vertices allowed — only the boundary cycle matters), and
the octagon-section tube is swept along that REAL surface polyline with
its centre ON the surface: half the tube buried, half showing (user
spec). No estimation left anywhere: no corner densification, no CC
compensation, no bezier — the path IS the displayed geometry, so the
joint sticks at any subsurf level by construction. The tube is final
geometry (never subdivided). Verified L0-L3: manifold, chi 2, joint face
counts scale with the level; screenshots show clean half-round seals
hugging pane and door outlines including corners. NOTE: rims are runtime
attachments — the OBJ export ships the control cage only.

**G12.3 v5 — THE RENDERER WAS THE LAST PROBLEM (user verdict: "I'm fed up
diagnosing renderer issues" — correctly).** The demonstrators' hand-rolled
canvas painter (inherited from _cage.html and extended far past its
competence) caused the residual "dashing", far-side bleed-through and
sort popping — all renderer, not geometry. _cage_ui.js now renders with
THE PROJECT'S OWN three.js (vendor/three.min.js, r128): indexed
BufferGeometry with per-material groups (welded verts -> the same smooth
vertex normals the game viewer computes), z-buffer, Lambert + hemisphere
lighting, preserveDrawingBuffer for the screenshot sink. Wireframe and
curvature-heat modes reimplemented; cage overlay and OBJ-ghost as
LineSegments. Verified: rims render as continuous straight seals from
every angle, no occlusion errors. RIM PATHS are straight chords with
corner densification + parallel-transported frames (user ruling: straight
pieces STRAIGHT — the CC-edge-point bezier that bowed them is reverted);
the bead rides higher (embed -0.25r). The post-subdivision sweep remains
the exact endgame for beads on extreme dome curvature, but under the real
renderer the current beads already read clean.

Also (user asks): view drag now starts ONLY on the canvas (slider drags no
longer rotate), wheel = manual zoom (dblclick refits), and the preset row
gained SAVE (named configs in localStorage, listed as "* name") and LOG
(non-default params -> console + clipboard — use this to lift numbers into
built-in presets).

OPEN from C3: true blown-bubble centre vertex (needs an all-quad 3x3
inset — the 4->8 annulus does not quad-mesh without T-junctions; either
accept the proud-pane approximation or inset twice), windshield glass
inset on the slope (frames exist as zones already), door on pax bays.

OPEN (chantier order per user): C4 parameter-space UVs
(u anchored at the waistband so the livery stripe is straight by
construction), C5 game swap (contract mapped: replace 63_gen_skin
:516-1305 behind fuselage.family='cage'; bind cage verts bilinearly to
frame corners like sectionRow, weights survive CC because it is affine,
prune to GEN_INFL=8; glazing route 'bubble' == round mode), C6 cowl (own
cage off the nose-ring contract + aperture grammar: eyes/smile/gills/
annular), C7 pillar editor (edit ONLY non-subsurf control points — the
named rings; guards/creases derive). Also still open from G12: real
Cub/C172 dim presets; canopy glass one-tint in the real skin.
NOTE mesh 1's boom glass-band bleed above — if the user re-exports the
templates from Blender, re-run `node tools/_cage_fit.js` before trusting a
new fiche; source of truth stays in Downloads.

## POST-G6 BACKLOG — tail, propeller, fairings (raised 2026-08-12)

The user's list after playing the merged build, grouped into sessions. Numbering
is new (T/C/P/G) and does not collide with the old playtest numbers. Each item
records what was VERIFIED before it was written down, because two of them turned
out to be different problems from what they looked like.

### T — THE TAIL. Skin-only first, then frame.  (T1, T2, T3 DONE in G10)

**T1 — the tip options are DEAD on the tail.** Not "hard to see": measured, all
six of `GEN_TIPS` give byte-identical geometry on `elev` and `rud` — same vertex
count, same position hash — while the wing changes both (1780/11889 square vs
2260/13973 elliptic). The control exists in the panel (`tail.tip`) and
`63_gen_skin.js` does look it up at both tail sites, so the lookup result is
being read and then not applied. Skin-only, and the prerequisite for T2/T3.

**T2 — one tip field for the whole tail; the fin and the stabs need their own.**
`tail.tip` is shared. Splitting it is a spec change (`tail.tipV` / `tail.tipH`,
or per-surface blocks) plus panel rows. Do it with T1, since T1 is the machinery
that makes either of them mean anything.

**T3 — a rounded fin+rudder and stab+elevator as ONE outline.** The Cub is the
reference: the fin and the rudder are a single rounded shape with a hinge line
through it, not a rounded fin next to a rounded rudder. So the outline has to be
generated for the WHOLE surface and then cut at the hinge, which is the opposite
of the current order (build the fixed part, build the moving part, each with its
own tip). Same for the tailplane and the elevator. This is the interesting one
and it subsumes T1/T2 — worth designing before starting.

**T4 — fin angle.** Rake/sweep of the fin as a control.

**T5 — the fin's leading edge: a dorsal fin / fillet**, with height, length,
width and angle. New geometry, and the first tail item that is not just an
outline.

**T6 — stab height.** Where the tailplane sits up the fin. Pairs with the old
backlog #21 (T-tail), which is the same control at its limit — a T-tail is a
stab height of 1.0, so #21 may fall out of T6 rather than needing its own
chantier.

T4/T5/T6 (DONE in G11) all move the TRUSS (`61_gen_frame.js`) and therefore mass, CG and tail
volume (`62_gen_aero.js`). They are a different kind of change from T1-T3 and
should be a separate session: the gates that matter for them are FLEX, LOAD and
the per-aircraft circuit gates, not the skin's coherence check.

### C — CONTROL SURFACES AND THE TORSION MODEL  (C1 DONE in G9)

**C1 — the control surfaces do not flex with the airframe.** Verified, and the
mechanism is exactly what the user described. The fixed skin is deformed
PER-VERTEX from the node lattice (`poseSkinGen`, weights against
`model.rest`/`model.nodeBody`), so it follows the truss when the tail twists
under rudder. The control surfaces are not: they are `moving` groups, and the
viewer poses them with `mv.mesh.quaternion.setFromAxisAngle(mv.axis, ang)` — a
RIGID rotation of the whole group about a pivot that never moves. So the tail
twists and the rudder hanging off it does not.

The fix is to compose the two rather than choose between them: deform the group
by its node weights like any other skin, THEN apply the hinge rotation about a
pivot that has itself been carried by the deformation. Both halves already
exist; nothing new has to be invented. It affects ailerons and flaps as much as
the tail, so it is one change for the whole aeroplane.

Note this is a VIEWER change, not a solver change — the surfaces already have
correct node weights (GATE GEN checks they sum to 1). Nothing about the physics
moves.

### P — THE PROPELLER  (P1, P2 DONE in G8)

**P1 — import the design session's propeller.** IMPORTANT, because it is easy to
get wrong twice: there is no propeller work in the SECOND bundle. Its only
prop-related content is `leaningProp` (an ornament against the hangar wall) and
a PBR table row. The propeller work is in the FIRST bundle and is the work that
was dismissed at the time — an ogive `GEN_SPIN_SECT` spinner, aerofoil-section
blades on a proper pitch law (`genAfEval(4412)`, nine stations), and a painted
`proptip` group.

It cannot be imported as it was written. The session drives it from a per-engine
`engines[0].prop` with a NUMERIC pitch, and it is decoration. The trunk has
since promoted `prop` to a top-level, PHYSICS-BEARING group where `pitch` is a
string enum and the disc area drives static thrust and propwash while blade mass
drives CG. So: take the GEOMETRY, drive it from the trunk's spec, and do not
restore the session's spec shape. See G5's defect list, item 4.

**P2 — the taildragger prop clearance margin is too generous.** The rule is
`GEN_RULES.propClear` in `resolveSpec`, and it wins over `legDrop` by design
(`gear.yBoundBy` names which bound applied). Measured on the default aeroplane
the prop wants 0.76 m of leg. The user wants the blades closer to the ground.
This is a one-constant change plus a decision about how much margin is honest —
and the reason it is deliberately conservative is in the comment there: a leg
shortened into a prop strike is a broken aeroplane on the first landing, not a
bad one. Worth re-reading that before moving it.

### U — THE PANEL  (U1 DONE in G8)

**U1 — split the powerplant section.** "Engine, cowl & blades" becomes
**Engine & cowl** (they stay together, user call) and **Propeller** as its own
subsection under the Power group. Trivial, and it should ride along with P1
since that is what fills the new section.

### G — THE UNDERCARRIAGE

**G1 — wheel fairings (spats).** New geometry hanging off the gear nodes, with
the same rule the pitot now follows: put it ON the emitted surface rather than
near it. Almost certainly wants an on/off plus a shape or size control, and it
has a real drag consequence, so it is not purely cosmetic — `62_gen_aero.js`
should know about it.

### Suggested session order

1. **C1** — standalone, affects the whole aeroplane, and every tail session
   after it is easier to judge with the surfaces flexing correctly.
2. **T1+T2+T3** — design the single-outline approach first; T1 and T2 fall out
   of it rather than being done twice.
3. **P1+P2+U1** — one powerplant session, geometry and panel together.
4. **T4+T5+T6** — the frame-moving tail controls, with #21 (T-tail) folded in.
5. **G1** — fairings, geometry and drag.

## FLEET & VALIDATION ANCHORS (re-verify after any physics change)
| Aircraft | Mass | Sub | Key validated numbers |
|---|---|---|---|
| Foam Trainer 1.4m | 1.108 kg | 48 | Vs 6.4; elevator ~ZERO authority w/o propwash (probe: 1 N·m) |
| Birdman Chinook 1S | 230 kg | 48 | glide 9.8:1 @15.6 (book 10:1 @35 mph); Vs 46 km/h; Vmax 99 km/h; TO 89 m / ldg 114 m w/ flaperons (book ~90 m). **RE-ANCHORED 2026-08-10 with the wing bracing** (was TO 92 / ldg ~59): tip 0.22 %/g, torsion 0.68°, td x=-515 sink 0.77, rolloutPitchMin -5.1, ap.vsFloor -0.15, gate maxS 330. Glide/Vs/Vmax are rigid-tunnel numbers and did NOT move — genShakedown reads the undeformed geometry. See STRUCTURAL REALISM. |
| Piper J-3 Cub | 377 kg | 24 | Vs 53.9 km/h; L/D 9.30; top 119.3 km/h; **best climb 433 fpm; TO run 151 m** — RE-ANCHORED G4.9 (engine-count fix, thrust 1800 -> 900 N). Vs/L/D did not move (thrust-free); the top speed the table already carried was the UNDOUBLED figure, so the aeroplane now matches its own anchor (it was flying 149.8). Climb was 1381 fpm, ~3x a real J-3's 450. TORun 60 -> 151 |
| Piper PA-18 Super Cub | 377 kg | 24 | = J-3 geometry + slotted flaps: Vs ratio flapped/clean 0.900 (POH 43/48 mph), dCLmax 0.40, flap drag ×2.1; AP flies flapped approaches (flareThr **0.24** — G4.9: it is a THROTTLE fraction and the engine-count fix halved what one buys, so the flare keeps the THRUST it was tuned with, 0.12*1800 == 0.24*900; sink 0.95 against 0.78 before, bound 1.5. VAppr 20.5, brakes 0.18, VTailDown 99 — throttle-cut flares sank 2.0 m/s, and the tail-up rollout hold nosed it over under flap lift + dCm0 in crosswind: pin the tail from touchdown); short-field VApprShort 18.5 + VPinFull 16: lands 340 m benches into wind (XCTY4); carries the 3D skin; **TO run 151 m** (was 67), same re-anchor as the Cub |
| Jodel DR-1050 Speedjojo | 611 kg | 48 | Vmax 136.1 kt (record 137.5, Dec 2024); Vs 82 km/h; 1247 fpm @150 km/h |
| Cessna 172S | 998 kg | 48 | Vs 46 kt; Vmax 123 KTAS (POH 126); 899 fpm @Vy (POH-scaled ~880); margin 20% (authentic) |
| Douglas DC-3 | 10.9 t | 72 | Vs 32.8 clean / 29.5 flapped (book 34.5 / ~29-30); NP margin 13%; unstick 46 m/s ~945 m w/ TO flaps 1/4; wheel landing 146 km/h @0.56 sink, flaps 0.7 on gs 0.060 |
| ⚒ Garage build (`gen`) | 402 kg | 45 | GENERATED, not a fiche — numbers move with the spec. Preset anchors, read off GATE GEN's SHAKEDOWN line 2026-08-11: S 15.6 m2, w/l 25.9 kg/m2, Vs 16.8 m/s (60.5 km/h), VCruise 28.7 m/s, L/D 7.86, aCruise 4.48 deg, static margin 20.4%, deck 10.2 deg, propClear 0.40 m, thrCruise 0.73, **TO run est. 320 m** (flown 292). G4.9 moved ONLY the takeoff estimate — every other field above is byte-identical across the engine-count fix. Re-anchor from GATE GEN's own SHAKEDOWN line, never by hand |

Notable fiche quirks: Chinook is a PUSHER (wing wash=0, tail wash 0.6, thrust
line above CG = power pitches DOWN). C172 prop refit to cruise-pitch reality
(Ts 2290, flat curve). Drone flies on blown tail only.

## DIVERGENCE LEDGER (model vs reference — what the roadmap buys, per line)
Living table: every roadmap session must close or re-anchor its lines and add
new references where marked TBD. "Session" = roadmap entry that addresses it.
| Aircraft | Metric | Model | Reference | Session |
|---|---|---|---|---|
| all | approach speed | flapped approaches flown (C172 64 kt/flaps 30 = POH normal; DC-3 ~84 kt) | — | ~~2~~ done |
| all | flare/float behaviour | ground effect DONE (session 1); tail-in-GE still excluded | — | ~~1~~ done |
| all | crosswind ops | 3 m/s cross + gusts: circuits gated (Cub, C172), decrab bounded | — | ~~3~~ done |
| Chinook | landing roll | 111 m (was 122 clean) | book ~90 m (TBD exact brochure figure) | nearly closed |
| Chinook | glide | 9.8:1 | book 10:1 (gap = no windmilling-prop drag, honest cut) | rider (energy/jets) |
| DC-3 | unstick run | ~945 m, unstick 46 m/s w/ TO flaps | real ~450-600 m loaded (TBD source) | OPEN — flaps didn't close it; suspect thrust/power loading, audit later |
| DC-3 | wheel-landing speed | 146 km/h (flaps 0.7) | real ~120-135 km/h flapped (TBD) | closing; full flaps + slower VAppr would finish |
| DC-3 | Vs | 32.8 clean / 29.5 flapped | book 34.5 / ~29-30 | flapped matches; clean -5% accepted M1 |
| C172 | landing ground roll | ~450 m (touchdown 61 kt) | POH ~175 m (touchdown ~49 kt + max brake) | OPEN — short-field AP technique, not physics |
| C172 | Vmax | 123 KTAS | POH 126 (-2.4%, accepted) | — |
| Jodel | approach targets | clean only | MV blog speeds (to extract) | 2 |
| Cub | Vs / top speed | 54 / ~121 km/h | commonly cited ~61 / ~140 km/h — RE-SOURCE before touching; M1 accepted current values | audit at 1 |
| Drone | Vs | 6.4 m/s | design 6.5-7 (ok) | — |

## HONEST CUTS
**`refs.engine` was overloaded — FOUND G4.7, FIXED and RE-ANCHORED G4.9
(2026-08-11).** Kept here because the shape of the bug is worth keeping: the
solver did `T = Tper * refs.engine.length`, and that length is TWO ENGINES on the
DC-3 but the two MOUNT NODES of one engine on the Cub, the PA-18 and every
generated aeroplane — so those single-engine aircraft pulled twice their registry
static thrust (the Cub flew on 1800 N against a registry 900). One field was
being asked two different questions, and the wrong answer stayed invisible for as
long as every reader agreed on it. `params.nEngines` now says how many engines
there are, `refs.engine` still says where the force is applied, every fiche
states its count, and the garage reads `spec.engines.length`.

The re-anchoring is DONE and is written up in full in G4.9 — what moved, what
did not, and why re-fitting the registry instead was rejected on the propeller
figure of merit. The fleet's numbers moved TOWARD reality, not away from it.

Two corrections to what was written here while the work was in flight:
- The garage's TORun estimate is NOT unchanged. It was computing off the
  per-disc figure while the solver flew on twice it, so the two errors cancelled;
  with the thrust honest the old formula read 119 m against 292 m flown. It is
  now integrated rather than averaged (G4.9) and reads 320 m. `thrCruise` really
  is unchanged, at 0.73 — and is now correct rather than double.
- The two red GATE GEN checks were NOT a call to re-tune `genGains`, VCruise or
  the AP schedule, and doing that would have broken loops that were behaving.
  `cruise is quiet in wind` was an INSTRUMENT fault: its 24 s window sat inside
  the cruise leg only because the over-powered aeroplane reached the top of the
  climb early, and on honest thrust the last seconds of the window caught the
  180 deg TURNBACK. Traced: bank stays within +-0.33 deg for the 21 s that are
  actually cruise, then the roll-in. The `nEngines = 2` A/B that read
  "17.27 deg to 0.00" is explained by exactly this — the doubled thrust moves the
  turn back out of the window — and is not evidence about the gains. The window
  now stops at the phase boundary. `flies a leg` was a BUDGET fault of the same
  kind: the heaviest configuration climbs at a realistic rate now and needs 382 s
  to fly the circuit, against a 300 s budget sized when it had twice the thrust;
  it lands inside every touchdown bound it always had.

Analytic polars (no Re), global-AR induced drag per strip, no wind,
no P-factor/swirl/slipstream-over-wing for tractors, no windmilling-prop drag
(Chinook glide slightly optimistic for exactly this reason), fuel/battery mass
frozen, friction plane horizontal, no compressibility (<M0.35 fleet).
Flaps (added session 2): polar-delta model per strip (no slat modeling, no
Fowler area growth — dCl0 stands in for both), flap deltas scale linearly with
setting, no asymmetric-flap failure mode, Chinook flaperon droop partial (0.6)
by AP policy.
The GARAGE (G1): one airframe family only (strut-braced high-wing taildragger,
tractor prop, conventional tail); no flaps on generated wings; NACA 4-digit
sections only, so a generated wing reaches Clmax ~1.4-1.5 rather than the 1.64
of the Cub's USA-35B — a real difference, not a fudge, and the AP speeds are
derived from the aeroplane's own stall speed accordingly. Skin offsets that
stand proud of the truss are baked in the REST body frame, so a former or an
airfoil's thickness does not follow local twist (flex is under 5 deg; the
bending the wing actually does IS exact, because the spar stations carry it).
TORun is an analytic estimate deliberately biased high (119 m for an airframe
in the Cub's 60 m class) — the AP only uses it to decide whether to backtrack,
and over-estimating errs toward backtracking.
Wind (added session 3): no shear/boundary-layer profile (wind constant with
height), gusts are 4 deterministic sine components per axis, not true Dryden
spectra; no thermals/ridge lift YET (the wind(x,y,z,t) plumbing is exactly
where they plug in); tunnel probes with a wind-bearing world sample wind too
(set none, or makeSim without world, for clean tunnel numbers).
Ground effect (added session 1, 2026-08): wing strips only — TAIL EXCLUDED
(would need a per-surface span datum); one terrain sample per aero pass (flat
within a span where GE matters); McCormick sigma = (16h/b)^2/(1+(16h/b)^2)
scaling the induced term and the lift slope via 1/a3d = 1/a0 + 1/eAR. No
stall-margin reduction in GE. Free-air tunnel = makeSim without world.
**THE VIEWER'S TIMESTEP IS NOT WALL CLOCK.** `app.js` calls `sim.step(1/60)`
once per `requestAnimationFrame` and never measures the real frame delta, so
the sim's timescale IS the display's refresh rate: on a 144 Hz monitor the
aeroplane lives 2.4x faster than real time, and **on a machine that drops
frames it runs in SLOW MOTION** — structural oscillation played back at half
speed reads exactly as rubber, which is a live suspect for the "gum sometimes"
in the report that produced GATE FLEX. Check it in the console with
`let n=0,t0=performance.now(); const f=()=>{if(++n<120)requestAnimationFrame(f);
else console.log('mean frame ms', (performance.now()-t0)/120)};
requestAnimationFrame(f)` — 16.7 means the sim runs at true speed. Fixing it
needs a fixed-step accumulator, which changes how many steps a given wall
second contains and therefore re-anchors nothing in the gates (they call
`sim.step` directly) but everything in the feel. Not attempted here.
The linkage and prop spin hardcode 1/60 for the same reason and must move with it.

## ROADMAP (with implementation anchors)
SCOPE DECISION (user, 2026-08-02): sessions 1-3 only (fidelity), then the
project BRANCHES to graphics/world/editor work (specced separately by the
user). Sessions 4-6 below stay documented as reference but are NOT next.

SCOPE DECISION (user, 2026-08-08): back to the original intent — the game is a
crossover of mission game and flight game, in which you BUILD the aeroplane.
Start on a remote island with a garage and materials, reach the next strip,
then a farther one. Aircraft are generated, not imported; the imported PA-18
and C172 stay as "found aircraft" to measure a build against. The editor is
player-facing and maximally procedural, with manual override everywhere — not
the developer tool spec_progen_v1 describes.

G1. **The Garage — procedural airframes** — DONE 2026-08-08: one spec drives
    the structure, the aero and the covering; one preset (strut-braced
    high-wing taildragger) boots as aircraft `gen`, flies the standard circuit,
    and is edited live from a panel. Full as-built, the calibration table and
    the traps under THE GARAGE above. GATE GEN (28 QC checks + a rigidity test
    + the parked-tailwind dwell + a full circuit), plus a `gen` entry in GATE
    STRESS. No terrain touched, no world re-golden, no physics change — the
    solver, autopilot and codec are untouched.
    Next in this arc, in order: (G2) widen the envelope — low wing, tricycle,
    cantilever, cranked wings, tip shapes — with AP gain auto-tuning, since G1
    seeds gains from the Cub and ships one gate-verified preset; (G3) 3D drag
    handles that write back into the spec; (G4) save/persistence + the
    materials economy; (G5) missions over the existing 24 km world (aerodromes
    are already the authoritative registry, and the archipelago already has
    fly-in strips). Manual controls (item 4 below) is the other half of the
    game and stays its own chantier.
One chantier per session. Every session ends with the battery green AND the
fleet table re-anchored if physics moved.

World branch (futureDesigns/WORLD-CONTRACT.md + WORLD-GEN-PROC.md):
W1. **World contract v1** — DONE 2026-08-03: pure restructuring of
    20_world.js (seed plumbing, waterH/surface, tile(), aerodromes registry,
    v0 shim), battery log byte-identical (timing aside), GATE WORLD golden
    freeze added. AP-reads-aerodromes (contract rule 6) deferred to its own
    session.
W2. **Stage 1 hydrology** — DONE 2026-08-03: 21_world_hydro.js bake
    (priority-flood/D8/accumulation/rivers/lakes) composed into terrainH/
    waterH/tile, GATE HYDRO added, WORLD goldens re-captured (terrain
    change, documented procedure).
W3. **Water rendering** — DONE 2026-08-03: river ribbons + lake surfaces
    in render_world.js (see WORLD + GRAPHICS). Remaining renderer-overhaul
    backlog: contour-traced lake outlines, animated water shader, chunked
    LOD, triplanar splat, tree impostors.
W4. **Stage 2 biomes** — DONE 2026-08-03: 22_world_biomes.js classifier
    (W.surface: sand/scree/forest-floor live) + biome tree placement with
    species (2200 LCG trees -> 2336 biome trees, sp field), distW added
    to the stage-1 bake, renderer species silhouettes/colours + ground
    tint, GATE BIOME. Terrain untouched (grid golden identical); TREES
    golden re-captured. Solver-side surface->friction (contract rule 7)
    is unblocked — the enum is real.
W5. **Stage 3 settlements & roads** — DONE 2026-08-04: 23_world_settle.js
    (sites, organic road network from the airfield, bridges, grading,
    buildings), GRAVEL surface, renderer tint/buildings/decks, GATE
    SETTLE. GRID+TREES goldens re-captured (grading is a terrain change;
    meadows/anchors held).
W6. **Domain growth 9→24 km** — DONE 2026-08-04: bounds ±12000, belt
    falloff + archipelago + far relief (exact-zero in the home box),
    physical hydrology thresholds, two-ring render mesh. Every stage
    re-ran unmodified on the new bounds — the proceduralness test.
    Hard-won: DP-simplified river polylines carry water the grid masks
    don't know (site scoring must check the QUERY); road grading must
    never refill a carved bed (mask by carve depth).
W7. **Domain warp** — DONE 2026-08-04: IQ warp + 5th octave + warped
    continental masks (see WORLD). First home-h0 change; full re-golden
    incl. meadow hash; DC-3 clearance re-verified by trace. Road-grading
    targets re-subdivided ≤50 m for the rougher ground.
W8. **Terrain colour pass** — DONE 2026-08-04: renderer-only (no world
    data change, no re-golden) — upland palette + vegetation mottling
    (see GRAPHICS).
W9. **Stage 4 aerodromes** — DONE 2026-08-04: 24_world_aero.js (see
    WORLD), GATE AERO, strip decals + windsocks, town pops rank-spread
    (stage-3 saturation fix). GRID+TREES re-goldened; meadows/anchors
    held. THE WORLD-GEN-PROC PIPELINE IS COMPLETE THROUGH STAGE 4.
W12. **Stage 5 cliffs** — DONE 2026-08-04: mountain component terraced
    into 22 m strata above 120 m amplitude (see WORLD-GEN-PROC stage 5
    as-built). Belt slopes reach ~1.5; risers classify ROCK/SCREE via
    the unchanged stage-2 rules; tarns perch on treads; strata banding
    tint. Road clamp ±8, HYDRO bank bound 2.0 (re-scoped to carve
    continuity). GRID+TREES re-goldened; meadows/anchors held. THE
    WORLD-GEN-PROC PIPELINE (STAGES 0-5) IS COMPLETE. Remaining world
    backlog: renderer overhaul (chunked LOD shows far cliffs, contour
    lakes, water shader, tree impostors), M2 meadow relocation, manual
    controls (holdWas bug first), STOL competition mode.
W11. **Spawn-at-aerodrome** — DONE 2026-08-04: aerodrome records carry a
    `spawn` point (takeoff-run start); `placeAtAerodrome(sim, a)` in
    40_autopilot.js rotates the def geometry onto the strip heading
    (theta = pi - hdg; HOME is a BIT-EXACT no-op) and translates to
    spawn at strip elevation. Viewer: departure select (default Home) +
    destination select (default circuit-at-departure) — legs chain by
    picking your landing field as the next departure. Harness cfg.from;
    GATE XCTY3 (Cub Morford -> HOME return leg, lands in the standard
    HOME windows). Harness uprightness drift now references the PLACED
    rest geometry (a 6.5 km rigid spawn shift is not a fall); note the
    instrument measures WORLD-z drift, least sensitive for strips
    heading near ±z. W9 strip tdz moved to the APPROACH side (threshold
    +25% — the old rollout-end tdz made XCTY2 roll ~len/2 past the
    drawn strip; frame math was self-consistent so nothing else moved).
W13. **Wind / minimap / forest-density viewer pass** — DONE 2026-08-04
    (user-batched small chantiers; viewer+renderer ONLY, no world data
    change, no re-golden, physics untouched):
    - Wind presets (selWind: calm / 2.5 / 4+gusts / 6+gusts) drive
      world.setWind LIVE — no reset, the AP flies IAS. Direction fixed
      quartering (headwind-ish for a +x HOME landing). FRESH 6 m/s is
      beyond the 3 m/s the wind gate validates, on purpose.
    - Windsocks (HOME + stage-4) are wind-driven: WF.setWindVis aims the
      mouth upwind, sag grows as wind drops, calm socks hang. The old
      static rotations are gone.
    - Minimap (172 px panel, right edge, #mid band): 384² underlay baked
      with the outer-ring colour pass + waterH override + river/road
      polylines; 10 Hz overlay draws route line, aerodrome dots (amber =
      active route, meadows faint), aircraft arrow, wind chip. Map frame
      = world frame (mountains −z at top).
    - Dense woodland fill: render-only canopies on a ~13 m jittered grid
      wherever surface()==FOREST_FLOOR, streamed in 1024 m chunks within
      5.6 km of the CG (the 5.2 km fog wall hides the ring edge), evicted
      at 6.4 km, one InstancedMesh pair per chunk. Prefilter: collidable
      tree within 90 m (128 m bins) — stands always hold one; species
      inherited from the nearest stand tree. No trunks, no shadows, no
      physics; strips keep len/2+70 m exclusion discs, corridor exclusion
      matches the world. Measured in-browser: ~55k instances resident at
      HOME, ~3 ms/chunk gen, ~0.5 ms/frame amortized streaming; stand
      density ~2.4/ha (collidable grid) → ~52/ha rendered.
    - Field patchwork is flatness-gated: corner-sample the ~160 m patch,
      >3.2 m relief kills it, near-threshold fades — no more hillside
      terraces. (Fields were never world data; bake-time only.)
    - Second detail octave on the ground shader (same grain re-sampled
      6.31× finer, fading in under 150 m) for flare-height texture.
    W13.1 follow-ups (same day, user playtest): (1) the wind presets
    EXPOSED the cub/pa18 parked-tailwind tripod latch — structural fix
    (TW->TPT + TW->HT pyramid, both fiches byte-identical) + W-PARK
    gates; see rule 10. Validation anchors untouched (no aero/mass
    change); the user's exact repro (PA-18 HOME -> Stein, breeze) flown
    headless end-to-end: stopped 43 m past tdz, sink 1.28. (2) Parking
    brake (ctl.brake 0.6) while HOLDING — a free taildragger drifted
    downwind while picking a route; ROLL clears it. (3) Minimap v2:
    click toggles 172 px <-> 74vmin (backing 344/1024), top-right chip
    toggles north-up (full domain) <-> nose-up (6 km, aircraft-centred,
    wind arrow co-rotates), aerodrome names on the big map, outer/mini
    bake 384 -> 512. NOTE: every aerodrome except HOME renders on the
    OUTER ring (~100 m polys, tucked 2 m low) — strips visually float
    ~2-3 m above the coarse ground there; fine-mesh patches around
    aerodromes belong to the renderer-overhaul/W15 family.

    W13.2 (2026-08-04, user playtest round 2): (1) short-field arrival
    overhaul + GATE XCTY4 — see AUTOPILOT RULES W13.2 (into-wind
    direction, threshold-exact aim, groundspeed slope FF, rollout pin
    guards, VApprShort); the reported Stein failure (late touch, bounce,
    nose-over, wheels under the drawn strip) is fixed and gated. (2)
    Aerodrome ground patches: every strip outside the inner ring gets a
    local ~9 m mesh following terrainH exactly (the graded bench + banks
    were always in terrainH — unrenderable at the outer ring's ~100 m,
    which also sits 2 m LOW; that mismatch was the "floating plane" and
    the "wheels through the runway"), edge-blended 2.2 m down to tuck
    under the outer ring; strip decals are now DRAPED (per-vertex
    terrainH + 7 cm) instead of flat planes at elev; patches share the
    outer texture + the close-range grain shader (detailApply hook).

W14. **Multi-hop autopilot + manual-controls prep** — DONE 2026-08-04:
    - holdWas/holdActive bug FIXED (the session-4 blocker): holdWas now
      updates per-frame at the end of ap.update, so holdPitch resyncs
      thCA from the live attitude after ANY gap (ROLL retries, manual
      flight), not just on the AP's first-ever call. Continuous phase
      chains behave identically — battery paths unchanged.
    - ap.reEngage() (the manual-controls session API): flags a full
      state re-latch on the next update — attitude/rate/VS filters from
      live values, servo memories from the CURRENT surfaces, integrators
      zeroed, trims cleared. restAlt intentionally kept (it anchors the
      current route). Never called by the AP's own flow. Probed 8 s of
      frozen-controls "manual" flight at cruise then resume, pa18 + DC-3:
      both recover airborne with or without reEngage (the holdWas fix
      alone supplies the attitude resync; reEngage matters for windup
      states the probe doesn't reach). HONEST LIMIT for session 4: the
      AP has NO upset recovery — resuming from a badly upset state
      (near-stall nose-high) wallows through ±50-78 deg pitch before
      settling. Manual-controls UI should re-engage from sane attitudes
      or session 4 adds an upset-recovery mode.
    - ap.departFrom(from, to): departs from WHEREVER the aircraft stands
      on `from` (fresh makeAutopilot + departFrom — no reset, no
      teleport). DEPART plans on its first update: takeoff INTO the wind
      (>0.7 m/s at the field) else along the current nose, snapped to
      the strip axis; straight to LINEUP when runway-ahead covers
      A.TORun + 60, else TAXI backtracks to the run start (the target
      sits behind the tail — nose-referenced steering saturates and
      U-turns naturally) and LINEUP turns onto the centreline (pursuit,
      dirX=-1), gating ROLL on alignment > 0.988 + |cross| < 8 m. Taxi
      governor: 4.5 m/s straight / ~2.3 turning, brake above +1.2,
      stick aft (A.taxiDe 0.30) so the tailwheel bites.
    - A.TORun per fiche (measured run to 2.5 m agl at HOME): cub/pa18
      60, drone 15, chinook 105, c172 400, jodel 410, dc3 960.
    - Viewer: picking a destination while STOPPED chains the next leg
      seamlessly (fromId follows the aircraft; telemetry time offset by
      telBase); mid-flight changes still fullReset. Rail gains
      DEPART/TAXI/LINE UP ticks.
    - GATE XCTY5: PA-18 HOME -> Stein -> HOME in ONE sim, calm — calm
      chosen because the Stein stop leaves < TORun+60 ahead, so the
      departure MUST backtrack. Asserts both landings, taxi confined to
      the strip box, the leg actually flown, final upright, rig intact.
    - Re-anchor note: the dynamic fix moved XCTY2's enroute min terrain
      clearance 86 -> 54 m (floor 35, still passing) — the C172's high
      belt arrival now extends its final along a slightly different
      track. If a future change eats more of that margin, look here.

W16. **Lateral quiet** — DONE 2026-08-04: the fleet-wide aileron limit
    cycles (pa18/cub 4 Hz surface flail; Jodel 1.8 Hz real 11-deg weave)
    diagnosed by freeze-test + gain sweep and killed with fiche-level
    gains (pa18/cub rollD 0.8; jodel rollP 0.5/rollD 0.15/hdgP 0.65 —
    the first battery caught pure-roll quieting breaking capture and
    crosswind decrab; full detail under AUTOPILOT RULES gains doctrine).
    C172/DC-3/Chinook measured clean, untouched. Closes the SKIN-PROC §8
    e4 core-side item. Battery re-anchored minus C172/C172M, which were
    red/new from the PARALLEL c172-3D-model session's in-progress fiche
    rework (their chantier validates those; not this session's scope).

W18b. **Imported PBR for the C172** — DONE 2026-08-05: the GLB's own
    roughness/metalness factors, metalRough maps, normal maps and emissive
    come across via a pbr.json sidecar joined by usemtl; constant maps fold
    to scalars (3.8 MB of source maps -> 186 KB of payload). Payload v4,
    +4% size. The viewer's name table is now only the fallback. Also fixes
    the texture-decode race that PBR made visible. See PBR & REFLECTIONS
    W18b — including the trap that cost two phantom bug-hunts.

W18. **PBR skin + reflection map** — DONE 2026-08-05: a PMREM environment
    cube baked at boot from this world's own sky dome + a ground hemisphere
    (no HDRI, no network, nothing shipped), assigned to `scene.environment`;
    the aircraft skin moved MeshLambert -> MeshStandard with roughness /
    metalness / envMapIntensity keyed off the payload material names. Full
    as-built and the RGBE trap under PBR & REFLECTIONS. Viewer-only — no
    payload re-bake, no world data change, no re-golden, physics untouched.

W17. **Tree LOD ladder + forest density** — DONE 2026-08-05: octahedral
    impostors for the mid band, canopy texture for the far band, per-instance
    3D collapse for the near band, a shadow-pass cull, and 2.05x the streamed
    forest density on the headroom that bought. Full as-built, measurements and
    traps under TREE FIELD; GATE WORLDRENDER extended. Renderer-only — no world
    data change, no re-golden, physics untouched. Remaining renderer-overhaul
    backlog after this: GPU disposal for non-current aircraft models, full PBR,
    chunked terrain LOD (far cliffs), contour-traced lake outlines, animated
    water shader, triplanar splat.

W15. **Close-range ground detail** (planned, renderer-overhaul family) —
    options in ascending effort: (a) DONE in W13, second grain octave;
    (b) per-surface detail: bake a surface-ID map beside the colour bake,
    shader picks per-class detail (grass blades / gravel / rock
    striations) from a small atlas, triplanar on steep slopes so cliffs
    stop smearing; (c) near-field clutter: instanced grass tufts / stones
    / scrub streamed in a ~300 m ring (reuse the W13 chunk streamer);
    (d) ultra-inner 2-4 m/texel bake patches around each aerodrome for
    crisp short final. Recommendation: b+c together sell low flight most
    per effort; d is cheap once b exists.

W10. **AP-reads-aerodromes (contract rule 6)** — DONE 2026-08-04: runway
    frames in 40_autopilot.js (see AUTOPILOT RULES), ENROUTE phase with
    approach-fix guidance + terrain-aware altitude, destination select
    in the viewer, GATES XCTY (Cub -> Morford paved) + XCTY2 (C172 ->
    Holtorham: over the belt, from abeam, onto 650 m grass — the route
    that broke four ways in development). W.aerodromes is now
    AUTHORITATIVE for arrivals AND departures (see W11).

0. **Flexbody port** — DONE 2026-08-03 (graphics-branch chantier). The web
   team's flexbody branch (a fork of the initial commit) cherry-picked onto
   trunk exactly: codec → 50_model_codec.js, payload → src/models/ + build
   MODELS slot, viewer block → app.js, gates on the trunk verdict contract;
   then finished: flaps rigged (voletG/D, measured hinge), full interior
   baked (payload v3, per-material groups), pa18 fiche = cub + flap physics
   (tunnel 0.900 Vs ratio) carries the skin and boots by default, PA18/
   W-PA18/STRESS-PA18 gates added, docs ported fixed to docs/, CREDITS.md +
   footer credit. Flexbody open increments (SKIN-PROC §6): twist, fuselage
   binding, gauge-needle animation, per-model payload splitting for the
   six-aircraft budget, J-3 retirement decision.

1. **Ground effect** — DONE 2026-08-02. McCormick sigma per wing strip in
   30_solver.js (induced term + lift slope via the 1/a3d = 1/a0 + 1/eAR
   reconstruction); span derived from wing-strip def geometry; one terrain
   sample per aero pass, null-guarded for tunnel sims. GATE GE: height sweep
   on the Cub probe — drag cut 16.6% and lift gain 8.1% at h/b=0.05,
   monotonic, free-air converged by h/b=5. Fleet retune outcome: only the two
   CLEAN airframes needed it, and in the ROLLOUT, not the flare — in GE the
   wing keeps lifting on the ground, weight comes off the wheels, and the
   brakes fade: DC-3 overran to x=+124 (fix: brake 0.45->0.50, VBrakeOn
   36->39, VAppr 44->43), Jodel to x=+51 (fix: VBrakeOn 12->20). Draggy
   aircraft (Cub, drone, Chinook, C172) passed untouched.
2. **High-lift devices** — DONE 2026-08-02. ctl.flap channel; per-strip polar
   deltas {dCl0, dCd0, dAStall, dCm0} + optional tau alpha-shift for flaperon
   droop, scaled by ctl.flap x st.flap; the Cm0 spar couple reads the flap
   delta (the "watch Cm0" trap was real — see below). AP: rate-limited flap
   servo, phase-scheduled (TO setting / clean / landing setting / retract on
   rollout for brake grip). Fiches: C172 + DC-3 + Jodel flaps, Chinook
   flaperons; Cub and drone flapless (authentic). Tunnel-calibrated: C172
   Vs0/Vs1 = 0.882 (POH 40/46 kt), DC-3 flapped Vs 29.5 m/s (book ~29-30).
   GATE FLAPS asserts both + servo rate limit. NOTE: the "unify six wingStrip
   helpers" prerequisite was NOT done — a per-fiche `flap:` field on 4 fiches
   was smaller-risk than unifying six different closures; still open.
   HARD-WON, in order: (1) dCm0 ~ -0.25*dCl0 (thin-airfoil TE device) or the
   flap lift increment pitches the nose UP and the AP balloons above the
   glideslope forever (DC-3 overflew the runway by 4 km, Chinook never got
   below flareAgl). (2) Flapped approaches need a STEEPER gs — with
   split-flap drag on the clean-era shallow slope the DC-3 railed throttle
   AND pitch integrators into a powered 1 m/s mush 60 m above the slope
   (vsFloor deepens too: flaps need a lower nose for the same VS). (3) The
   wheel-landing flareThMax cap comes DOWN with flaps — they raise CL at a
   given attitude, the clean cap sat above L=W and the float came back
   (117 km/h touchdown 300 m past the window). (4) Small plain flaps at FULL
   deflection are mostly harshness (Jodel sink 1.45, gear strain 3x) — land
   at partial (ldg 0.65). (5) Flapped landings arrive flatter: the Jodel
   tail-up rollout attitude guard recalibrated -2 -> -5 deg (measured
   brake-independent).
3. **Wind & gusts** — DONE 2026-08-02. world.wind(x,y,z,t) + setWind({base,
   gust}): steady vector + deterministic sum-of-sines gusts with spatial
   phase (advecting waves; gates can rely on exact repeatability). Wind feeds
   the strip relative flow (per-strip sample -> gusts produce roll/twist
   forcing), the fuselage blobs (weathercocking), and the prop advance term.
   SPEED SPLIT: out.V/alpha are now AIR-relative (true IAS), out.Vg is
   groundspeed; the AP flies IAS for aero speeds and Vg for wheels
   (VBrakeOn/VStop). All wind terms are EXACT ZEROS with no wind set — the
   calm battery was byte-identical through the plumbing change (that
   instrument caught nothing because nothing was broken; it then retired
   when the guidance change below legitimately altered calm trajectories).
   GATE WIND: the WHOLE FLEET flies full circuits in 3 m/s crosswind + gusts
   (foam trainer at a scaled 1.5 m/s — half its stall speed is not weather,
   it is an emergency). Touchdown offsets: DC-3 0.7 m, Chinook 1.0, Cub ~1,
   drone 3.3, C172 ~3, Jodel 7.3. Decrab: below decrabAgl the rudder aligns
   the nose while airLateral keeps killing drift — worked first try.
   HARD-WON: (1) NOSE-referenced pursuit parks at a standing cross-track
   offset ~ L*(crab - slip) with e EXACTLY ZERO (C172 froze at z=+21..26 m;
   two wrong integrator theories died before the trace showed e=0.0 at
   offset). Air guidance must steer COURSE OVER GROUND (velocity-referenced
   pursuit, eA/eAR chain) — crab becomes implicit and the offset vanishes
   (0.8/3.2 m). Ground steering keeps the nose error (velocity is noise at
   taxi speeds; gate Vg>5). (2) A track INTEGRATOR is the wrong tool: the
   800 m lateral capture after glideslope intercept rails it and the stored
   bias re-creates the offset at the flare (classic windup, measured).
   (3) The settle-uprightness harness check false-fires in wind — a parked
   aircraft WEATHERVANES (rigid yaw), which a node-drift instrument cannot
   tell from a structural fall: wind gates set uprightCheck:false, the calm
   battery keeps the guard. (4) Slip-heavy airframes (Jodel ariK=0 + 14
   dihedral; DC-3) need a STANDING BANK to hold a crosswind course; P-only
   course loops hang 10-20 m off centreline. Cure: a trim integrator that
   engages ONLY in the trim regime (|eA| < 0.2, leak otherwise) — clamped
   +-0.10, wind-gated to exact zero in calm air. (5) Align-before-descend
   (hold altitude until laterally captured, then intercept) is a TRAP with
   this geometry: the level leg raises the descent start by gs*(leg length),
   beyond the catch-up authority — Jodel/DC-3 landed 0.6-1.1 km long. The
   approach catch-up clamp now scales with the aircraft's own slope rate
   (min(-3, -1.6*V*gs)); capture happens in-descent and the trim integrator
   closes the residual.
4. **Manual controls** — touch/keyboard on the artifact; AP becomes toggle.
   sim.ctl is externally writable (test_stress already drives it mid-flight) —
   injection needs no refactor. MUST FIX FIRST: the holdWas/holdActive bug
   (see AUTOPILOT RULES) + reset AP integrators (Ith, It, thcI, thrC, phCA,
   servo filters) + re-latch ap.restAlt on re-engage, or the first AP
   re-engage after manual flight noses over. UI: buttons keep focus after
   click — blur() them or Space re-fires the last button. HUD/telemetry read
   ap.dbg — source-switch to sim.out/cgPos when AP is off. GATE: headless
   scripted-input sequence (deflection script like test_stress) + AP re-engage
   recovery assertion.
5. **STOL competition mode + Valdez-Special-lite** — measured distances,
   scoring lines, meadow course, per-attempt wind; competition Chinook = stock
   fiche + slats polar + bigger Rotax registry line. The chinook gate already
   measures xLiftoff/xTD/xStop — promote to scored, gated numbers. Proves the
   mod pathway.

6. **Jet module + SubSonex JSX-2 fiche** — new powerplant TYPE in the
   registry: jet thrust is ~flat with V at low Mach (the prop law
   Ts − kV2·V² is wrong for it), spool-lag module (idle→full ~3-4 s,
   spool-aware AP go-around margins), idle residual thrust in the glide,
   NO propwash (every blown-surface term gets zero — the drone flies on wash
   alone; the SubSonex is the opposite extreme, control authority must come
   from speed), Vmax dive stress case. TJ-100 class ~1.1 kN static. Vmax
   ~390 km/h stays under M0.35 — still no compressibility. High wing loading
   + speed = the two-spar torsion-box final exam. New fiche + gate + stress
   entry + button per ritual.

Riders: energy module (fuel burn + electric packs; refresh mass-derived contact
arrays ~1 Hz, NOT per-substep) fits session 2 or 5. Then: gliders (atmosphere
is the feature; winch trivial, aerotow deferred; high-AR wing = structural
final exam).
