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
- `src/core/20_world.js` — makeWorld(seed): v1 world contract (terrainH/
  waterH/surface/tile/aerodromes/settlements/wind) + v0 shim (trees/meadows/
  CELL/wind/setWind) on one object. Seed 0 / no arg = the validated world,
  bit-identical to pre-contract; nonzero seeds coherent but unvalidated.
  See futureDesigns/WORLD-CONTRACT.md.
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
   terrain). Cures are geometric and need MEASURED trials (probe with a
   lateral force, release, check elastic return): wide triangulated anchors
   (fin<->stab wires + stab<->tailwheel pyramid + boom->wing-box wires), a
   snap-blocking near-vertical member (drone TW->TPT), never more K. Wires
   that anchor to strip-force-carrying nodes re-rig the aeroelastics — anchor
   to box nodes (WB) and keep them soft.

## AUTOPILOT RULES
- **Gains scale with airframe timescale ~ span/V.** Cub 0.41, DC-3 0.41,
  C172 0.22, Jodel 0.17, drone 0.03. Wrong-scale D-gains create slew-rate
  limit cycles (drone pitch ±9° @2.3Hz; Jodel roll; C172-class chatter).
  The cure is always LOWER D + command slew, not more filtering.
- Trim-heavy stable aircraft need pitchI authority (DC-3: 0.05 → 0.25).
- holdPitch command filter thCA re-syncs to current attitude on re-engage
  (holdWas/holdActive) — its zero-init once nosed the DC-3 over at Vr.
  **KNOWN BUG, blocks the manual-controls session:** holdWas is assigned once
  at declaration and never updated; holdActive is never reset. The resync fires
  only on the very first holdPitch call — an AP re-engaged after manual flight
  will hit exactly the DC-3-at-Vr failure mode. Fix before session 4.
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
- v1 contract since 2026-08-03 (futureDesigns/WORLD-CONTRACT.md):
  makeWorld(seed) also exposes waterH/surface/SURFACE (minimal interiors:
  sea-only water, WATER/ROCK/GRASS), TILE=512 + lazy tile() (buckets the
  eager tree array — trees MUST stay flat and index-stable, treesNear
  returns indices into it), and W.aerodromes (runway 'HOME' + 3 meadows).
  The registry is DESCRIPTIVE until the AP-reads-aerodromes session: the
  AP still flies def.params.ap constants, and the carve/decals below are
  not yet driven from it (the runway exists 4× independently: carve, AP
  constants, decals, patchwork mask).
- Runway 1100 m: x +20 → −1080 (extended for the DC-3; physics flat pad
  x∈[−1180,130], |z|<90 blend). Takeoff heading −x, landing +x.
- Mountains −z side (~200 m peaks near (−5500..−6000, −2500) — DC-3 turnback
  clears by ~50-100 m; watch turn direction for new heavies), sea +z,
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
of load, accepted), field patchwork, instanced woodland (2-4 render-only
neighbours per collidable tree, corridor exclusion |z|<90 matches the world),
billboard cumulus, dynamic shadow frustum following the CG. The aircraft
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
  NOT 1:1 with sim.ctl (HUD shows raw ctl); it filters the AP's ~3.7 Hz
  roll/yaw limit cycle, whose core-side fix is still open (SKIN-PROC §8 e4).
- Known limits carried as-is: no twist, rigid tail/fuselage/glass, hinge
  about the undeformed line (visible only at ×4), P-side-only station keys
  in makeSkinBinding (exact for mirrored fiches — union+assert before
  skinning a non-mirrored aircraft), linkage+prop spin hardcode 1/60.
- The branch's flight_core.js was a fork of the INITIAL commit — never merge
  anything from it; the port cherry-picked only codec/payload/viewer/gates.

## FLEET & VALIDATION ANCHORS (re-verify after any physics change)
| Aircraft | Mass | Sub | Key validated numbers |
|---|---|---|---|
| Foam Trainer 1.4m | 1.108 kg | 48 | Vs 6.4; elevator ~ZERO authority w/o propwash (probe: 1 N·m) |
| Birdman Chinook 1S | 230 kg | 48 | glide 9.8:1 @15.6 (book 10:1 @35 mph); Vs 46 km/h; Vmax 99 km/h; TO 92 m / ldg 111 m w/ flaperons (book ~90 m: nearly closed; pre-bracing 86/91 was measured with the tail on the ground) |
| Piper J-3 Cub | 377 kg | 24 | Vs 54 km/h; L/D 9.3; top ~121 km/h |
| Piper PA-18 Super Cub | 377 kg | 24 | = J-3 geometry + slotted flaps: Vs ratio flapped/clean 0.900 (POH 43/48 mph), dCLmax 0.40, flap drag ×2.1; AP flies flapped approaches (flareThr 0.12, VAppr 20.5, brakes 0.18, VTailDown 99 — throttle-cut flares sank 2.0 m/s, and the tail-up rollout hold nosed it over under flap lift + dCm0 in crosswind: pin the tail from touchdown); carries the 3D skin |
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
    freeze added. Next on this branch: WORLD-GEN-PROC stage 1 (hydrology on
    the current terrain, gates first). AP-reads-aerodromes (contract rule 6)
    deferred to its own session.

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
