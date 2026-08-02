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
   `test_stress.js` + button in `src/viewer/body.html` + AIRCRAFT map/selBtns
   entries in `src/viewer/app.js` + line in the fleet table below.

## FILES
Everything under `src/` is SOURCE. `tools/flight_core.js`, `index.html`,
`dev.html` are GENERATED — edit parts, never outputs; run_gates.js rebuilds
before every battery so stale hand-edits get overwritten, loudly.

- `src/core/00_registry.js` — RHO, POWERPLANTS/POLARS registries, PAR
  (rudderSign is live in the solver hot loop), wheel-friction consts CRR/MU_*.
- `src/core/10..15_aircraft_*.js` — one fiche per aircraft (cub, dc3, chinook,
  c172, jodel, drone). Fully self-contained builders; only POLARS is external.
  The ideal parallel-agent boundary: one agent per fiche, zero conflicts.
- `src/core/20_world.js` — makeWorld: deterministic terrain/trees/meadows.
- `src/core/30_solver.js` — makeSim: node-beam solver + strip aero + ground.
- `src/core/40_autopilot.js` — makeAutopilot: 9-phase circuit FSM.
- `src/core/90_node_exports.js` — guarded module.exports (inert in browser,
  inlined as-is; keep it single-statement, no nested braces).
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
  circuit pipeline; `test_*.js` — thin per-aircraft configs + stress + tree.
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
Runtimes: DC-3 dominates (~50 s of ~140 s total).

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

## FLEET & VALIDATION ANCHORS (re-verify after any physics change)
| Aircraft | Mass | Sub | Key validated numbers |
|---|---|---|---|
| Foam Trainer 1.4m | 1.108 kg | 48 | Vs 6.4; elevator ~ZERO authority w/o propwash (probe: 1 N·m) |
| Birdman Chinook 1S | 230 kg | 48 | glide 9.8:1 @15.6 (book 10:1 @35 mph); Vs 46 km/h; Vmax 99 km/h; TO 92 m / ldg 122 m (GE era; pre-bracing 86/91 was measured with the tail on the ground; ldg vs book ~90 m OPEN, flaps/brake sessions) |
| Piper J-3 Cub | 377 kg | 24 | Vs 54 km/h; L/D 9.3; top ~121 km/h |
| Jodel DR-1050 Speedjojo | 611 kg | 48 | Vmax 136.1 kt (record 137.5, Dec 2024); Vs 82 km/h; 1247 fpm @150 km/h |
| Cessna 172S | 998 kg | 48 | Vs 46 kt; Vmax 123 KTAS (POH 126); 899 fpm @Vy (POH-scaled ~880); margin 20% (authentic) |
| Douglas DC-3 | 10.9 t | 72 | Vs 32.8 (book 34.5); NP margin 13%; unstick ~49 m/s, ~950 m (GE); wheel landing 150 km/h @1.05 m/s sink |

Notable fiche quirks: Chinook is a PUSHER (wing wash=0, tail wash 0.6, thrust
line above CG = power pitches DOWN). C172 prop refit to cruise-pitch reality
(Ts 2290, flat curve). Drone flies on blown tail only.

## DIVERGENCE LEDGER (model vs reference — what the roadmap buys, per line)
Living table: every roadmap session must close or re-anchor its lines and add
new references where marked TBD. "Session" = roadmap entry that addresses it.
| Aircraft | Metric | Model | Reference | Session |
|---|---|---|---|---|
| all | approach speed | 1.25·Vs CLEAN (no flaps exist) | type-specific flapped approach | 2 |
| all | flare/float behaviour | ground effect DONE (session 1); tail-in-GE still excluded | — | ~~1~~ done |
| all | crosswind ops | impossible (no wind) | — | 3 |
| Chinook | landing roll | 122 m | book ~90 m (TBD exact brochure figure) | 2 (+brake retune) |
| Chinook | glide | 9.8:1 | book 10:1 (gap = no windmilling-prop drag, honest cut) | rider (energy/jets) |
| DC-3 | unstick run | ~950 m (was ~1000 pre-GE) | real ~450-600 m loaded (TBD source) | 2 |
| DC-3 | wheel-landing speed | 152 km/h | real ~120-135 km/h flapped (TBD) | 2 |
| DC-3 | Vs | 32.8 m/s | book 34.5 m/s (-5%, accepted M1) | watch at 1 |
| C172 | landing distance | not comparable (clean) | POH ~175 m ground roll flaps 30 | 2 |
| C172 | Vmax | 123 KTAS | POH 126 (-2.4%, accepted) | — |
| Jodel | approach targets | clean only | MV blog speeds (to extract) | 2 |
| Cub | Vs / top speed | 54 / ~121 km/h | commonly cited ~61 / ~140 km/h — RE-SOURCE before touching; M1 accepted current values | audit at 1 |
| Drone | Vs | 6.4 m/s | design 6.5-7 (ok) | — |

## HONEST CUTS
Analytic polars (no Re), global-AR induced drag per strip,
no flaps/slats (Chinook flaperons modeled as ailerons!), no wind, no P-factor/
swirl/slipstream-over-wing for tractors, no windmilling-prop drag (Chinook glide
slightly optimistic for exactly this reason), fuel/battery mass frozen, friction
plane horizontal, no compressibility (<M0.35 fleet).
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
2. **High-lift devices** — flaps/slats/flaperons as per-strip polar deltas +
   one control channel + flap-trim schedules.
   WHERE: add `flap` to the ctl object and reset() in 30_solver.js; per-strip
   effect must be an EFFECTIVE POLAR object ({Cl0+d, Cd0+d, aStall−d, Cm0+d})
   built before the polar() call — an alpha shift alone is wrong (no drag, no
   stall margin change). TRAP: the Cm0 spar couple reads P_.polarWing.Cm0
   directly — it must read the effective polar or flap pitching moment is
   silently ignored. PREREQ: unify the six per-fiche `wingStrip` helpers
   (six different signatures today) before adding a `flap:` strip field.
   AP: slew block handles only de/da/dr — add a flap rate limit; flap-trim
   schedules per fiche. GATES: Chinook flaperons (validates vs the modeled-as-
   ailerons cut), DC-3 real approach speeds, Jodel MV blog approach targets.
3. **Wind & gusts** — environment velocity field into strip relative flow +
   Dryden-ish gusts + crosswind AP work (crab, decrab, gust rejection).
   WHERE: `wind(x,y,z,t)` lives in makeWorld (20_world.js); add the wind
   vector at the strip position into the relative-flow assembly in aeroPass,
   AND into the fuselage drag blobs (else no weathercocking — the yaw response
   would be missing exactly where it matters). DECISION UP FRONT: out.V/alpha
   and every AP speed loop (speedThrottle, VRot/VClimb/VCruise/VAppr
   comparisons) are groundspeed-based today; with wind, IAS ≠ groundspeed and
   the choice affects every gate. Heavy forensic session expected. Same
   plumbing later = ridge lift/thermals.
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
