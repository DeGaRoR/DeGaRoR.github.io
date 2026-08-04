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
   script blob, runs the full battery, exits non-zero on any FAIL. Never deliver
   on a non-zero exit. (`node tools/build.js` for a standalone build;
   `--only=ID[,ID]`, `--verbose`, `--no-build` on the runner.)
4. New aircraft checklist: new `src/core/1x_aircraft_*.js` fiche + MANIFEST entry
   in `tools/build.js` + thin gate config (see any `test_*.js`) + entry in
   `test_stress.js` + `<option>` in the aircraft select in
   `src/viewer/body.html` + AIRCRAFT map entry in `src/viewer/app.js` +
   line in the fleet table below.

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
  whole 3D world look lives here), app.js (renderer, camera, aircraft mesh,
  shadow proxy, phase rail, HUD, loop).
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
(+~2 s WORLD).
GATE XCTY4 (~32 s) is the W13.2 short-field leg: PA-18 HOME -> Stein
(340 m gravel fly-in) in the viewer BREEZE preset — touch in the first
40%, bounded skip, on-strip stop, UPRIGHT tail-down, tail rig intact.
GATE C172M (appended after PA18, ~2 s) is the second skin's contract:
payload decode, span/length, tricycle mount calibration at BOTH gear ends,
hinge axes (unit + aero-consistent signs) for the non-cardinal C172 hinges,
nose-gear steering across four payload groups, flex-band containment and
L/R symmetry, and that the strut fittings ride the wing while the fuel caps
stay rigid. The pa18's MODEL/SKIN/CTRL gates are untouched.
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
  the fiche.
- Balked-takeoff guard requires LOW SPEED (V < 0.9·VRot), else wheel-brush
  during liftoff flickers ROLL/LIFTOFF forever.

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

## TREE FIELD — measured state + the LOD ladder (next up, 2026-08-05)
Measured with GL draw hooks + EXT_disjoint_timer_query, C172 loaded, 1.3 Mpx:
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
Trunks additionally switch off past 900 m (they were 45% of the frame and are
sub-pixel from cruise). **Size the sphere against RELIEF, not just the
horizontal half-diagonal** — GATE WORLDRENDER caught a tree on a 148 m ridge
2 m outside a 736 m sphere. The same bug class had the village buildings
culled against a 1 m sphere at the origin (fixed).

NOT DONE — the LOD ladder, which is what buys real density:
1. near (<400 m): current 3D canopy + trunk, unchanged.
2. mid (400 m-2 km): **octahedral impostors** — pre-render each species from
   9-16 directions into one atlas with a WebGLRenderTarget at boot (the
   source is the tree meshes already in the scene, so NO external art and the
   look is preserved), 2 tris/tree, shader picks the nearest view. Plain
   camera-facing billboards are wrong here: from 160 m up they read as lying
   down. Insertion point: `coneF`/`blobF` in the streamed fill block.
3. far (>2 km): no geometry — blend a canopy texture into the terrain.
Cheap first step if the atlas is too much in one sitting: the far-tier
broadleaf canopy is `IcosahedronGeometry(1.9, 0)` = 20 tris and blobs are
89 588 of 124 848 canopy instances — an 8-tri octahedron is a one-line swap
for 2.5x on the dominant class.
Then raise density: the user wants forests several times denser, and the
whole point of the above is to buy that headroom. NOT by cutting trees —
see [[import-models-as-is]]'s sibling rule: quality is not the budget knob.

## FLEET & VALIDATION ANCHORS (re-verify after any physics change)
| Aircraft | Mass | Sub | Key validated numbers |
|---|---|---|---|
| Foam Trainer 1.4m | 1.108 kg | 48 | Vs 6.4; elevator ~ZERO authority w/o propwash (probe: 1 N·m) |
| Birdman Chinook 1S | 230 kg | 48 | glide 9.8:1 @15.6 (book 10:1 @35 mph); Vs 46 km/h; Vmax 99 km/h; TO 92 m / ldg 111 m w/ flaperons (book ~90 m: nearly closed; pre-bracing 86/91 was measured with the tail on the ground) |
| Piper J-3 Cub | 377 kg | 24 | Vs 54 km/h; L/D 9.3; top ~121 km/h |
| Piper PA-18 Super Cub | 377 kg | 24 | = J-3 geometry + slotted flaps: Vs ratio flapped/clean 0.900 (POH 43/48 mph), dCLmax 0.40, flap drag ×2.1; AP flies flapped approaches (flareThr 0.12, VAppr 20.5, brakes 0.18, VTailDown 99 — throttle-cut flares sank 2.0 m/s, and the tail-up rollout hold nosed it over under flap lift + dCm0 in crosswind: pin the tail from touchdown); short-field VApprShort 18.5 + VPinFull 16: lands 340 m benches into wind (XCTY4); carries the 3D skin |
| Jodel DR-1050 Speedjojo | 611 kg | 48 | Vmax 136.1 kt (record 137.5, Dec 2024); Vs 82 km/h; 1247 fpm @150 km/h |
| Cessna 172S | 998 kg | 48 | Vs 46 kt; Vmax 123 KTAS (POH 126); 899 fpm @Vy (POH-scaled ~880); margin 20% (authentic) |
| Douglas DC-3 | 10.9 t | 72 | Vs 32.8 clean / 29.5 flapped (book 34.5 / ~29-30); NP margin 13%; unstick 46 m/s ~945 m w/ TO flaps 1/4; wheel landing 146 km/h @0.56 sink, flaps 0.7 on gs 0.060 |

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
Analytic polars (no Re), global-AR induced drag per strip, no wind,
no P-factor/swirl/slipstream-over-wing for tractors, no windmilling-prop drag
(Chinook glide slightly optimistic for exactly this reason), fuel/battery mass
frozen, friction plane horizontal, no compressibility (<M0.35 fleet).
Flaps (added session 2): polar-delta model per strip (no slat modeling, no
Fowler area growth — dCl0 stands in for both), flap deltas scale linearly with
setting, no asymmetric-flap failure mode, Chinook flaperon droop partial (0.6)
by AP policy.
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

## ROADMAP (with implementation anchors)
SCOPE DECISION (user, 2026-08-02): sessions 1-3 only (fidelity), then the
project BRANCHES to graphics/world/editor work (specced separately by the
user). Sessions 4-6 below stay documented as reference but are NOT next.
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
