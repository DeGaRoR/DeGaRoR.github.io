# GARAGE FLIGHT SIM — HANDOVER

Node-beam chassis + strip-theory aero flight sim. Single-file HTML artifact, headless
node gates. Six validated aircraft, one solver, untouched since M1. This document
carries everything the code can't: conventions, hard-won rules, validation anchors,
and the agreed roadmap.

## SESSION RITUAL (PTIS-style, non-negotiable)
1. Upload this zip. Read this file and the relevant code BEFORE editing.
2. One chantier per session. Trace-first debugging: measure before hypothesizing —
   this beat guessing in every single forensic episode of this project.
3. Green gate battery (`sh run_gates.sh`) before building the artifact (`python3 build.py`).
   Never deliver red. Syntax-check inlined artifact scripts with `node --check`.
4. New aircraft = new fiche + new gate + entry in test_stress.js + template button.

## FILES
- `flight_core.js` — everything: POWERPLANTS/POLARS registries, six build functions
  (buildCub, buildDrone, buildDC3, buildJodel, buildC172, buildChinook), makeWorld,
  makeSim, makeAutopilot. Export line stripped by build.py when inlining.
- `m3_template.html` — viewer; `/*__CORE__*/` marker is where the core inlines.
- `test_*.js` — per-aircraft circuit gates + test_stress (full-deflection abuse,
  all six) + test_tree. Gates use PERTURBED starts (lateral offset + velocity
  noise) on purpose: symmetric ICs mask directional instabilities.
- `build.py`, `run_gates.sh`.

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
  in tunnel-only makeSim calls).

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

## AUTOPILOT RULES
- **Gains scale with airframe timescale ~ span/V.** Cub 0.41, DC-3 0.41,
  C172 0.22, Jodel 0.17, drone 0.03. Wrong-scale D-gains create slew-rate
  limit cycles (drone pitch ±9° @2.3Hz; Jodel roll; C172-class chatter).
  The cure is always LOWER D + command slew, not more filtering.
- Trim-heavy stable aircraft need pitchI authority (DC-3: 0.05 → 0.25).
- holdPitch command filter thCA re-syncs to current attitude on re-engage
  (holdWas/holdActive) — its zero-init once nosed the DC-3 over at Vr.
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

## FLEET & VALIDATION ANCHORS (re-verify after any physics change)
| Aircraft | Mass | Sub | Key validated numbers |
|---|---|---|---|
| Foam Trainer 1.4m | 1.108 kg | 48 | Vs 6.4; elevator ~ZERO authority w/o propwash (probe: 1 N·m) |
| Birdman Chinook 1S | 230 kg | 48 | glide 9.8:1 @15.6 (book 10:1 @35 mph); Vs 46 km/h; Vmax 99 km/h; TO 86 m / ldg 91 m |
| Piper J-3 Cub | 377 kg | 24 | Vs 54 km/h; L/D 9.3; top ~121 km/h |
| Jodel DR-1050 Speedjojo | 611 kg | 48 | Vmax 136.1 kt (record 137.5, Dec 2024); Vs 82 km/h; 1247 fpm @150 km/h |
| Cessna 172S | 998 kg | 48 | Vs 46 kt; Vmax 123 KTAS (POH 126); 899 fpm @Vy (POH-scaled ~880); margin 20% (authentic) |
| Douglas DC-3 | 10.9 t | 72 | Vs 32.8 (book 34.5); NP margin 13%; unstick ~50 m/s, ~1000 m; wheel landing 152 km/h |

Notable fiche quirks: Chinook is a PUSHER (wing wash=0, tail wash 0.6, thrust
line above CG = power pitches DOWN). C172 prop refit to cruise-pitch reality
(Ts 2290, flat curve). Drone flies on blown tail only.

## HONEST CUTS (unchanged)
Analytic polars (no Re), global-AR induced drag per strip, no ground effect,
no flaps/slats (Chinook flaperons modeled as ailerons!), no wind, no P-factor/
swirl/slipstream-over-wing for tractors, no windmilling-prop drag (Chinook glide
slightly optimistic for exactly this reason), fuel/battery mass frozen, friction
plane horizontal, no compressibility (<M0.35 fleet).

## AGREED ROADMAP (5 sessions)
1. **Ground effect** — passive per-strip induced-term scaling by height/span.
   Expect full-fleet flare retune. Recalibrates the ruler.
2. **High-lift devices** — flaps/slats/flaperons as per-strip polar deltas +
   one control channel + flap-trim schedules. Validates on Chinook flaperons,
   DC-3 real approach, Jodel MV (blog approach speeds as targets). Watch Cm0.
3. **Wind & gusts** — environment velocity field into strip relative flow +
   Dryden-ish gusts + crosswind AP work (crab, decrab, gust rejection). Heavy
   forensic session expected. Same plumbing later = ridge lift/thermals.
4. **Manual controls** — touch/keyboard on the artifact; AP becomes toggle.
5. **STOL competition mode + Valdez-Special-lite** — measured distances, scoring
   lines, meadow course, per-attempt wind; competition Chinook = stock fiche +
   slats polar + bigger Rotax registry line. Proves the mod pathway.
Riders: energy module (fuel burn + electric packs; refresh mass-derived contact
arrays ~1 Hz, NOT per-substep) fits session 2 or 5. Then: gliders (atmosphere
is the feature; winch trivial, aerotow deferred; high-AR wing = structural final
exam), small jets (registry + spool-lag module + Vmax dive stress case + spool-
aware AP margins). Graphics pass stays deferred until it's a game.
