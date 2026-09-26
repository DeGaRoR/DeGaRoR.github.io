# PHYSICS PERFORMANCE AUDIT (2026-09-24, G572)

The user's brief: "we have been, and still are optimizing the graphics hard, but it seems like there's a CPU floor
we're hitting. I'm wondering if the physics have been audited for performance as well as the graphics have ...
including floats and water ... In particular, we're getting bad performance when getting out of the hangar ... There
has been an holistic climate manager too, I'm not sure if that one could have introduced physics changes?"

PERF-2026-09-23 measured the frame as the RENDERER's JavaScript (the draw count) and never timed the other half of
the main thread. This is that half: `script(1/60)` + `sim.step(1/60)` in app.js `loop()`, which runs before the
render, on the same thread, every frame.

## THE ANSWER IN FIVE LINES

1. **Yes, the physics is a CPU floor of its own, and on the user's own builds it is bigger than the renderer's.**
   Taxiing out of the door on Jolene, before this audit: the stock build 11-18 ms a frame of solver alone, the
   birdman 19-29, the metal Cessna 31-49, the Cessna on floats 36-50 (this container; the gamer box's i7 is perhaps
   1.5x quicker). A frame is 16.7 ms.
2. **Why the roll-out**: the aeroplane sits on the island's composed ground (the DEM + the premises' pads and road
   grades), and on that ground the solver asks for the terrain height under EVERY node EVERY substep (the clearance
   cone that saves this on the analytic world is off: "the island's raster and a premises layer declare none yet").
   That was ~45 % of the solver on the stand.
3. **Why it got bad quickly**: the substep count. A generated build's step is set by its stiffest beam; an alloy
   wing box on 0.9 kg nodes asks 225 substeps (capped at 200), a tailwheel damper on 0.55 kg fuselage nodes 121.
   Every cost in the solver multiplies by it - the stock build flies 70.
4. **The climate manager** changed no physics on the default day (calm: its zero mode, no cost). A RICH preset
   (breeze, ridge, thermal, front, gale - and a player's saved day keeps one) costs ~20-30 % more solver: the
   linearisation is re-centred every substep (4 field evaluations + 5 terrain reads) and every wind call inside the
   surface layer reads the terrain exactly.
5. **Landed (G572), bit-identical**: 9-30 % off the solver, proven by 12 trajectory hashes. **Ruled levers**
   measured below: the island's clearance cone (-40 %, same trajectory), the vortex kernel once a frame (-17 to
   -33 %), the substep drivers (up to -60 % on the metal builds), the hydro at a fixed rate (-30 % on floats), and
   frame pacing.

## How it was measured

- `tools/physics_perf.js` (new, gate-less): the game's own road, headless - Jolene composed with its premises
  (`tools/fixtures/island_jolene.json`), the build placed on the site's stand (`placeAtStand`) and THE PILOT's
  `departFrom` taxiing it out of the door, exactly as `applyRoute` does; a float build on the SEA lane. It times the
  pilot's `update` and the solver's `step` per frame, per phase of the pilot, lists the longest frames and where they
  fall, and `--hash` prints an FNV hash of every node's p and v to the bit. `--core <file>` flies another
  flight_core.js (the A of an A/B); `--preset` a WEATHER_UI wind; `--arch` an archetype; `--world none` the analytic
  world. `node --cpu-prof tools/physics_perf.js ...` for a V8 profile.
- The container's CPU speed drifts between runs (a scenario with no change moved 28 %), so every before/after
  timing below is PAIRED: A and B launched at the same moment, two scenarios at a time on the four cores.
- Not measurable headless: the obstacles the VIEWER registers at runtime (the hangar, the parked aeroplanes, props:
  the solver's obstacle pass rejects each in a few ns - ~1-2 ms a frame at 200 substeps with ~10 near records, an
  estimate), and the viewer's own per-frame water work (syncWaterFx, WATER.fieldStep, syncFloats).

## Before: what the solver costs (ms a frame, this container, run 4 at a time)

| scenario | nodes / beams / strips | substeps | solver ms (mean) |
|---|---|---|---|
| stock, Jolene, taxi out of the door | 93 / 394 / 28 | 70 | 18.4 |
| stock, analytic world, the circuit (cone on) | 93 / 394 / 28 | 70 | 7.3 |
| bugReports/birdman.json, Jolene taxi | 91 / 387 / 28 | 121 | 28.8 |
| bugReports/cessnaMetal (1).json, Jolene taxi | 103 / 442 / 28 | **200** | 48.7 |
| bugReports/cessnaFloats.json, the SEA lane | 130 / 533 / 27 | **200** | 50.2 |
| stock, thermal day, Jolene taxi | 93 / 394 / 28 | 70 | 22.2 |
| archetype c172, ridge day, Jolene taxi | 107 / 457 / 32 | 200 | 65.6 |
| archetype stearman (biplane), circuit | 165 / 758 / 54 | 144 | 49.4 |

The pilot is never the problem: 0.06-0.15 ms a frame (a one-off 15-40 ms when it plans the taxi).

Where the stock roll-out's solver time went (V8 profile, Jolene, stand): the composed terrain ~47 % (the premises'
road grades alone 28 %: `Math.hypot` per segment), the beams ~16 % (one `Math.hypot` per beam per substep), the aero
pass ~22 % of which the vortex kernel's rebuild ~10 %, GC ~4 %. On floats the hydro pass is ~30 %.

## LANDED - G572: the same bits, faster

Every change below leaves every node's p and v bit-identical: 12 scenarios (stock / birdman / metal / floats on
Jolene; stock thermal; c172 ridge; the floatplane archetype in a breeze; stock, stearman, cub hot-and-high, jodel
gale and da62 on the analytic world through a full circuit), 25-150 s each, the same FNV hash before and after.

1. **`hyp2` / `hyp3` (00_registry.js)**: V8's `Math.hypot` is a builtin call (47 ns); `sqrt(x*x+y*y+z*z)` is 2 ns
   but a different number in 36 % of calls (every anchored gate would move). These are V8's own algorithm
   (Infinity, NaN, the max, the scaled Kahan sum) written out so the JIT inlines them: 6-7 ns, `Object.is`-equal on
   4e7 random triples over forty decades and every special. **GATE HYPOT** (`tools/_hypot_check.js`, core) holds it.
   Used in the solver (all 17 sites: the beam loop, the wheels, the strips, the blobs), the hydro (`len`, the
   water rudder), the climate's field (`smooth`, the thermal lattice) and the premises (`distPtSeg`, the grades).
   Files loaded alone (GATE PREMISES requires 27_premises.js by itself) fall back to `Math.hypot`.
2. **The premises' pads need no distance at their two ends** (27_premises.js flatten / raise / ramp): the feather's
   weight is 1 for any point inside the polygon (sdPoly is -d there) and 0 past the falloff, so the edge distance is
   computed only in the feather band; outside, plain squared distances screen the band with a 1e-9 relative margin
   (the two roundings differ by 1e-16).
3. **The road grade's segment scan** screens a segment that cannot beat the best with the same squared-distance
   margin; every segment that can is measured exactly, in the list's order (same winner, same tie-break).
4. **The aero pass stops allocating per substep**: the engines' constant bookkeeping (`engineOf`, the per-engine
   counts, the lever closure) once per sim; the wing's pitching couple through two fixed arrays instead of four new
   pairs per strip.

Paired timings (A = HEAD, B = G572, same moment, solver ms a frame):

| scenario | A | B | |
|---|---|---|---|
| stock, Jolene taxi | 11.1 | 8.6 | -22 % |
| metal Cessna, Jolene taxi | 31.2 | 21.9 | -30 % |
| Cessna on floats, SEA lane | 36.2 | 30.6 | -16 % |
| birdman, Jolene taxi | 18.8 | 13.4 | -29 % |
| stock, thermal day, Jolene taxi | 14.2 | 10.1 | -29 % |
| stock, analytic world, circuit | 5.0 | 4.5 | -9 % |

## THE LEVERS THAT NEED A RULING (measured, NOT landed)

Measured on an experimental copy of the core with each lever on a switch, paired against G572 (solver ms a frame).

### 1. The clearance cone on the island -> LANDED as THE GROUND'S CEILING (G575, below)

(Measured first as a slope cone with a declared S = 12, below. It is NOT what landed: the island's raster steps by up
to 1.99 m along 968 240 probed leaf edges where a coarse leaf meets a fine one, so no slope bound is true there.)

| scenario | G572 | cone S = 12 | trajectory |
|---|---|---|---|
| stock, Jolene taxi | 8.1 | 4.6 (-43 %) | hash identical |
| metal Cessna, Jolene taxi | 22.0 | 13.3 (-40 %) | hash identical |

The cone (30_solver.js, 2026-09-14) skips a node's ground sample inside a frame while it provably cannot reach the
ground: c > S d with S a Lipschitz bound the world declares. The analytic world declares 12 (GATE GE measures 4.46
and pins measured <= bound / 2); the island and a premises layer declare none, so every node samples every
substep. In flight the cone skips every node above a few metres (the whole ground pass). The trajectory is the same
bits for as long as the bound is true, which is why both hashes above held.

What landing it needs: a bound that is TRUE on the composed ground. The island's DEM is a mesh (its slope is the
steepest triangle's, computable exactly at load); the premises' feathers are smoothsteps whose slope is bounded by
1.5 x the height they bridge / their falloff (a shelf's margin can be 0.5 m); the coast blend has its own. Two ways:
(a) a global bound = max of those, measured once, pinned by a gate like GE's (simple; a steep sea cliff anywhere
raises S everywhere and costs the taxi some of the gain); (b) a LOCAL bound per 64 m cell (`world.slopeNear(x, z)`,
read once a frame for the aeroplane's cell and its neighbours), computed lazily from the mesh and the modifiers
touching the cell. (b) keeps the taxi's gain on a flat apron beside a cliff. Proposed: (b), with a gate that
re-measures every cell the premises touch at 0.25 m and pins measured <= bound / 2.

### 2. The vortex kernel once a frame, as its own comment says (-17 % on the ground, -33 % in flight)

Every garage build flies the vortex downwash since TAIL CHANTIER 2 P5 (`downwashModel: 'vortex'`, 2026-09-07), so
the horseshoe kernel (buildAIC: two horseshoes per pair, the ground image) is physics on every aeroplane. Its note
says "called once per frame in flight ... never per substep"; what runs is a rebuild whenever `aicSig` changes, and
it hashes the node positions, which move every substep - so it is rebuilt every substep (10-16 % of the solver).
Rebuilding on the frame's first substep only (the circulations still update every substep):

| scenario | G572 | once a frame | effect |
|---|---|---|---|
| stock, Jolene taxi | 8.0 | 6.6 (-18 %) | cg 0.05 mm off after 30 s |
| metal Cessna, Jolene taxi | 21.1 | 17.5 (-17 %) | cg 0.4 mm off after 20 s |
| stock, analytic world, 150 s circuit | 4.1 | 2.7 (-33 %) | cg 3 cm off after 150 s |
| metal Cessna, cone + kernel together | 21.8 | **8.9 (-59 %)** | |

Not bit-identical, so the GEN / PILOT / BIPLANE anchors want a re-read; the geometry a frame moves is millimetres.

### 3. The substep count - the multiplier on everything

`genSubsteps` sizes the step to the stiffest beam (omega dt <= 0.45, c dt <= 0.65), floor 24, CAP 200:

- **The metal wing box** (cessnaMetal, cessnaFloats): the WB beams on 0.9 kg nodes need 225 (omega); 34 beams need
  more than 150, 74-136 more than 100. The cap at 200 already flies them at omega dt 0.51, past the 0.45 bound (inside
  the fleet's proven 0.50-ish envelope, barely). An alloy build pays 200 substeps for a kilohertz mode of its wing
  box that no flight dynamics can see. Options, each a physics ruling: lump the wing box into fewer, heavier nodes;
  treat the stiffest axial springs implicitly (a per-substep constraint projection like the tube's shape-matching,
  G294); or cap the axial stiffness the solver flies at what 100 substeps holds (x0.2 on those beams - the load test,
  which reads strain, would keep the true k).
- **The birdman**: 121 substeps come from TWO beams - the tailwheel leg's damper (TW, 3.45 kg) into the fuselage's
  S6BL / S6BR (0.55 kg), c dt; the next beam needs 77. A damper capped at c dt 0.65 on those two, or a heavier
  anchor, takes the build to 77 substeps (-36 % of everything).
- `tools/physics_perf.js`'s header prints each build's substeps; a per-build "what sets my step" line on the plaque
  would let the player see it (the sheet already posts `powerOver` the same way).

### 4. The hydro at a fixed rate (-30 % on floats)

`HYDRO_EVERY = 8` substeps (G451.1: "360 Hz is more than the water needs" - at the 45 substeps it was measured on).
At 200 substeps it is 1 500 Hz. Every = round(substeps x 60 / 360): floats 31.2 -> 21.7 ms, the cg 1 mm off after
20 s. GATE HYDRODYN / FLOATS / WIPLINE / SEAPLANE are the anchors to re-read.

### 5. Frame pacing - LANDED as G586 (the frame clock, below)

### 6. The first frames after the roll-out: the solver's JIT warm-up - ALREADY PAID BEHIND THE SCREEN

The bench's longest frames fall in the solver's first 0.5 s (150-300 ms: V8 optimising substep / aeroPass / the
hydro). In the game that cost is already hidden: rollOut() resets the sim and sets `running` before the roll-out
screen's steps, and loop() steps the sim BEFORE its `holdRender` return, so the solver runs every frame under the
overlay (the tree ring, the pictures, the compile - seconds of it) and V8's optimised code is shared by every later
sim of the page. Nothing to do.

### 7. The climate (only when a rich preset is on) -> the surface layer's ground LANDED as G611 (below)

- `wind()` re-centres its linearisation every substep (keyed on `t`), although `smooth()` does not read `t` (only
  the gusts do, exactly, per call). Keying it per frame measured NO gain (the cost is elsewhere): dropped.
- The cost that is there: inside the surface layer (LIN_GROUND_H) every wind call reads the terrain exactly - ~30
  calls a substep on the ground, each a composed-terrain query on Jolene - and it would fall with lever 1's cheaper
  ground only if the climate had a cone of its own (the same slope bound gives it one: the AGL's linearisation error
  is bounded by S x the distance to the reference).
- `convNow()` builds a string cache key on every call (4 a substep under breeze / thermals); a numeric key or the
  day's version counter would do.

## LANDED - G575: THE GROUND'S CEILING (the island's skip, bit-identical)

The cone's sibling for a world that declares no slope bound. Once a frame the solver asks the world for an upper
bound of the ground over the nodes' footprint (grown by 0.5 m + twice the fastest node's frame travel):
`world.groundMaxRect(ax, az, bx, bz)`. A node still inside that box whose bottom is above the ceiling cannot touch
the ground this substep - exactly the `pen <= 0 -> continue` its sample would have taken - so it skips the sample;
a node that leaves the box samples as before. The ceiling is true stage by stage, by construction:

- the raster: a bilinear patch never exceeds its highest corner, so the highest vertex of every leaf cell the
  rectangle touches (19_terrain_codec.js `maxRect`, a cell of slack each side); the coast's `min` only lowers it;
- the pad blend (a convex blend toward PADH), the carve (a depth >= 0, then a `min`), the meadows (convex), the
  island's settlements (no road delta);
- the premises (27_premises.js `hMaxRect`): every modifier blends h toward a target with a weight in [0, 1] (a raise
  adds at most dh), so max(B, every target touching the rectangle) + the raises, whatever the order. Each modifier
  says its target's highest: a level, a plane's highest corner, a grade's highest segment end in the cells the
  rectangle touches, a shelf's level.

It carries the terrainH it bounds (`groundMaxRect.of`): a world re-wrapped with another ground (HOTHIGH's tilt,
pilot_trace --slope) keeps the function but not the ground, and the solver then samples as before.
FLYDIY_EXACT_GROUND=1 turns it off with the cone.

GATE GE holds it: 1 077 rectangles (400 random over the whole island 6-200 m, 12 around every aerodrome, every
premises modifier's own box), 2.76 M points on a grid and at random - none above the ceiling (mean slack 5.4 m); a
ceiling a metre low is caught by the same check; the stock build taxied 30 s out of HOME's stand with the skip on and
off, every p and v identical every frame, 80 % of node samples skipped.

Paired against G572 (solver ms a frame, the same FNV hash every time):

| scenario | G572 | G575 | |
|---|---|---|---|
| stock, Jolene taxi | 8.5 | 6.1 | -29 % |
| metal Cessna, Jolene taxi | 22.0 | 13.1 | -40 % |
| birdman, Jolene taxi | 13.9 | 9.7 | -31 % |
| stock, thermal day, Jolene taxi | 10.3 | 7.6 | -26 % |
| Cessna on floats, SEA lane | 31.4 | 25.9 | -17 % |

In flight every node is far above the ceiling of its own footprint and the whole ground pass goes.

## THE SUBSTEP DRIVERS, per build (genSubsteps' two limits; `need` = substeps each asks)

| build | substeps | need (stiffness) | need (damping) | the damping beam |
|---|---|---|---|---|
| cub, pietenpol, pittsAlike, ul1, mw5, pusherPod, archaeopteryx, twinBush, caravan | 70-126 | = | below | - |
| tigermoth, sesqui, c172, rv, motorglider, etrainer, ttail, vtail, da62, skymaster, p38 | 146-200 (cap) | 146-265 | below | - (the wing box, WB-WB) |
| cessnaMetal, cessnaFloats, cessna (2) (the user's) | 200 (cap) | 222-229 | 94-127 | - |
| stearman | 134 | 89 | 134 | TW-S6BL (the tailwheel) |
| chinook | 110 | 67 | 109 | TW-S6BL |
| savannah | 113 | 103 | 113 | TW-TPT |
| floatplane | 142 | 78 | 142 | FLK-FLK (the float keel) |
| beaver | 200 (cap) | 108 | 285 | TW-TPB |
| jodel | 200 (cap) | 184 | 213 | TW-S6BL |
| radial | 200 (cap) | 213 | 263 | TW-TPT |
| birdman (the user's) | 121 | 77 | 120 | TW-S6BL |

Fourteen archetypes and all three of the user's metal Cessnas fly at the cap, most asking 213-265: the cap already
runs them past the omega dt bound. The alloy wing box is the multiplier the metal builds pay; the tailwheel's damper
(and the float keel's) is the one the taildraggers pay.

## G578 - THE VORTEX KERNEL ONCE A FRAME (landed)

Lever 2. The horseshoe coefficients (buildAIC: two horseshoes and the ground image per pair) are rebuilt on the
frame's first substep, from the frame-start geometry; the circulations and the induced field still update every
substep, and a probe (the design sheet) rebuilds whenever its geometry moves, as before. The geometry a frame moves
is millimetres: measured 0.05-0.4 mm off after a 20-30 s taxi, 3 cm after a 150 s circuit. Solver -17 % on the
ground, -33 % in flight. Not bit-identical; the core battery (GEN, PILOT, FLEX, LOAD, TAKEOFF, BIPLANE, DRAG, the
floats) passed on it.

## G579 - THE WATER AT A RATE, NOT A COUNT (landed)

Lever 4. The hydro's sub-rate was 8 substeps on every build: 360 Hz on the 45-substep 172 G451.1 measured it on,
1 500 Hz on a 200-substep alloy build. Now round(substeps x 60 / 360) - the old 8 at 45 substeps - and
params.hydroEvery still overrides. Cessna on floats: -30 %, the cg 1 mm off after 20 s. FLOATS, HYDRODYN, WIPLINE,
WATER passed; SEAPLANE's three known reds unchanged.

## G580 - THE DAMPER THE STEP CAN CARRY (landed)

The tailwheel's damper set the step of every taildragger it limited, at zeta ~5 - dead-beat five times over. Now
genSubsteps sizes the step on the SPRINGS; a damper past the c dt bound at that step is cut to it, and the cut is
only taken if the whole NETWORK stays inside the integrator's stability with a margin. The per-beam rule is not
enough: a node joined to several dampers adds them, and the network's own highest frequency is always at or above
any single beam's (the metal Cessna capped per beam to 80 substeps diverged at once). Symplectic Euler on a damped
mode holds while (omega dt)^2 + 2 gamma dt < 4; the builder asks <= 3.0 of the network's own highest omega^2 and
damping rate (genNetEig: power iteration, 600 passes + 5 %), takes the smallest step that holds (bisection), never
more than the old rule's, and leaves a build whose springs set the step untouched (the same number, no beam
changed - the stock build, the metal Cessnas, most archetypes). Today's fleet flies with the network measure up to
3.84 (caravan) and 4.22 (floatplane - its 82 float-keel dampers keep their old step here).

| build | substeps | dampers cut (zeta after) | network | circuit (frames per phase, old / new) | solver ms |
|---|---|---|---|---|---|
| birdman (the user's) | 121 -> 78 | 2 (>= 3.44) | 2.45 | downwind 6 814 / 6 814, base 917 / 916 | 9.8 -> 6.8 |
| chinook | 110 -> 68 | 2 (>= 3.37) | 2.50 | downwind 4 658 / 4 656, final 2 803 / 2 808 | 10.1 -> 5.5 |
| stearman | 134 -> 89 | 4 (>= 3.71) | 2.49 | downwind 5 007 / 5 007, base 1 794 / 1 794 | 37.5 -> 13.8 |
| beaver | 200 -> 131 | 4 (>= 2.67) | 2.84 | downwind 6 595 / 6 593, base 1 287 / 1 289 | 17.3 -> 10.5 |
| jodel | 200 -> 185 | 2 (>= 4.64) | 2.42 | | |
| pietenpol | 79 -> 75 | 1 (>= 3.59) | 2.75 | | |

GATE SUBSTEP (`tools/_substep_check.js`, core) holds it over every active archetype and fixture build: never above
the old rule; untouched where the springs set the step; every cut damper overdamped; the network <= 3.0 re-measured
with 4 000-pass eigenvalues.

## THE METAL WING BOX (measured, not landed - the next chantier) -> LANDED as G610 (below)

The alloy wing box (WB-WB beams on ~0.9 kg nodes) asks 213-265 substeps per beam; 14 archetypes and the user's
three metal Cessnas fly at the 200 cap. Measured on the metal Cessna, a 150 s circuit on the analytic world:

| step | springs cut | circuit | wing bend in cruise (tip over root) | solver ms |
|---|---|---|---|---|
| 200 (today) | - | the same phases | 15-19 mm | 8.8 |
| 120 | 66 (to x0.28 at most) | the same phases, the cg 3.5 m off after 150 s | 17-22 mm | 5.2 (-41 %) |
| 80 | 196 (to x0.13) | DIVERGED at once (per-beam caps; the network is not) | - | - |

So a softer box flies the same aeroplane for a few mm more bend, and the step must be sized on the network, as
G580 does for the dampers. The honest version keeps the TRUE stiffness where it matters - the load test (65_gen_
loadtest) reads strain and must fly the real k - and gives the flight a box whose highest mode (a kilohertz axial
mode no flight dynamics can see) is bounded; or lumps the box's nodes. A chantier of its own, with the load test's
verdicts as its anchor.

## G586 - THE FRAME CLOCK: the game on the wall clock, the frame capped (auto by default)

The user: "shouldn't we do frame pacing at 30 fps? The benchmarks on the local box, which is already an rtx 3080
barely reaches 60 fps anywhere" - and the ruling: all three parts, the default auto.

1. THE GAME RUNS ON THE WALL CLOCK. app.js `PACE.frame(ts)` gives each rendered frame its real dt and the solver
   steps it owes (each the solver's own 1/60 s): floor(acc x 60 + 0.25) - a steady 30 fps owes exactly 2 every
   frame, a steady 60 exactly 1 - at most 4 (under 15 fps the game slows rather than spiralling; a stall's time is
   forgotten). Before it every rAF stepped 1/60: at the gamer box's ~50 fps the game ran at 83 % of real time.
   The pilot runs per step (script(1/60) inside the loop); the day in flight on the sim's time, in the shed on the
   frame's; the panel (CK.frame) on the sim's; 2x flies twice the steps.
2. THE CAP: the graphics menu's `frame rate` - auto / 60 / 30 / uncapped (gfx_settings.js `fps`, a FREE option: no
   preset sets it, a pick leaves the preset). A cap renders on the display refreshes that fall due (every 2nd at 30
   on a 60 Hz screen). AUTO: two readings (60 frames) with the median frame over 18.5 ms -> 30; at 30, the frame's
   own work with ONE step (the loop's JavaScript, the extra step taken out) under 12.5 ms for two readings -> a
   trial of 60; a trial that misses -> 30, the next trial held 20 s, doubling to 5 min. The auto render scale
   (aa_resolve.js `autoTarget`) is told the budget: it holds 30 at 30 (it would otherwise blur the picture chasing a
   60 the cap never shows) and may raise it back. The menu's frame readout reads the RENDERED frames and says
   what auto holds.
3. THE FRAME-COUNTED PARTS ON TIME: the orbit ease (0.28 of the gap a 60th of a second), the roll-out and
   director's slow reveal (360 sixtieths), the chase view's yaw-rate lead (the rate over the frame's dt, its filter
   a tenth a 60th), the cockpit head's level ease, the propeller's spin, the readouts (every 0.1 s), the spray and
   the water's interaction field, the near sea and the climate link (render_world), the mirror, the shed's control
   sweep. Already on the wall clock and left alone: the trams, traffic and animals, the free and cockpit eyes'
   motion, the premises' ease, the clouds (the day's clock).
A RIG (webdriver / headless Chrome: the gates, frame_perf.js, the shot tools) and a call with no timestamp (GATE
UISMOKE's vm) keep the old clock exactly - one 1/60 step a call, uncapped - so every measurement reads the frame it
always read (?pace=1 turns the clock on). GATE PACE (tools/_pace_check.js, core) drives the app.js block as written
with synthetic refreshes: 60 Hz at a 30 cap is every 2nd refresh with 2 steps each; 144 Hz capped and uncapped keeps
the sim on the wall clock; a 50 ms frame owes 3 steps, a stall 4; auto drops, trials, holds and backs off; the rigs
keep the old clock. GFX / WATER / PANEL / BENCH's wiring checks read the new calls.

## G610-G613 - THE JOLENE PLAYTEST (2026-09-26): THE METAL BOX, THE GROUND UNDER THE WHEELS, THE STEP DEBT

The playtest: Jolene, the user's aluminium Cessna 172 out of the garage - the FPS "unacceptable" at the stand,
the roll-out and the taxi, "much better FPS as soon as we're off the ground". Four levers, measured here first
(trace-first: the doc's 47 % of composed-terrain sampling was the pre-G575 figure - on this tree the ground
reads were 4 % of the metal Cessna's solver on the taxi and 11 % of the stock build's; the substep count was
the metal build's multiplier, and on a rich day the wind's surface-layer ground reads were a third).

### G610 - THE FLIGHT BOX (the metal wing box, network-sized; the load test keeps the actual wing)

The user's rule: "I'm OK with it, but I don't want to fake the test. Let the test test the actual wing."

- `genSubsteps` (62_gen_aero.js) is now two stages. `genSubstepsTrue` is the old rule and G580's dampers,
  unchanged: the TRUE step. `genFlightBox`: where that step is over GEN_BOX_N = 120, every WING spring (cls
  'wing': spars, ribs, diagonals, the carry-through) past omega dt 0.45 at a softer step is cut to it, its damper
  by the same sqrt (each softened beam keeps its damping ratio: measured, it is the box's DAMPERS that break the
  network first - 2 gamma dt 2.7 of the metal Cessna's 3.57 at 120 with the dampers left whole, 2.76 in all with
  the ratio kept), a damper anywhere past c dt cut as G580 does; taken only if the whole network holds <= 3.0
  (genNetEig) and no spring flies under x0.25 of its true k; the smallest such step at or over 120 and over every
  non-wing spring's own need; never more than the true one. The beams keep `kTrue` / `cTrue`; the params carry
  `substeps` (flown) and `substepsTrue` (only where they differ).
- THE ACTUAL WING, everywhere a structural number is read: `sim.trueBox()` (30_solver.js) puts every true k and c
  back and makes the true step the default until the next `reset()` (a reset is the aeroplane as it flies - the
  garage's sandbag test runs on the game's own sim, and the roll-out's fullReset gives the flight box back).
  `makeLoadTest` (65_gen_loadtest.js) calls it on the sim it is handed and steps at its return. PROVEN on the
  user's two metal Cessnas (they fly 120): the sandbag test run to ultimate on this core and on HEAD's ends in the
  same bits (an FNV hash of every node's p and v), the same limit / ultimate deflection (1.17 / 1.72 % of semispan,
  1.29 / 1.87 %) and yield (52 / 77 %, 47 / 67 %). Flown on the softened box it would have read 1.60 / 2.35 % -
  the wing 36 % bendier than built: the fake the rule forbids. GATE FLEX calls it after every reset.
  In flight, a softened beam's STRAIN is reported against its true k (`sK = k / kTrue`: the force it carries over
  the actual stiffness - the real wing's strain under the same load), so the strain-coloured frame and the 'peak
  strain' readout read the actual wing too. `genTrueBox(def)` is the def-side twin for a reader that builds its own
  sim.
- Who flies it (GATE SUBSTEP's roll): 13 of 38 builds - the user's two metal Cessnas and the c172 archetype 200 ->
  120-121 (66 wing springs, x0.26-0.29 at most), tigermoth 200 -> 120, jodel 185 -> 120, rv 142, motorglider 134,
  vtail 134, ttail 135, skymaster 138, p38 145, radial 149, etrainer 153, da62 179, sesqui 147 -> 120 (2 springs);
  742 substeps saved between them. NOT the Cessna on floats: its float keel's dampers already break the network
  margin at 200 (3.61; 5.67 at 120) - that is the float keel's step, not the wing box's, and it keeps 200.
- The metal Cessna's circuit, the analytic world, 150 s, paired (true box / flight box): the same phases to three
  frames (TAXI 2284 / 2278, STOP 35 / 38, HOLD 121 / 121, ROLL 618 / 617, LIFTOFF 271 / 271, CLIMB 856 / 856,
  CROSSWIND 1678 / 1679, DOWNWIND 3137 / 3140), the cg 3.5 m apart after 150 s; solver 10.28 -> 6.62 ms (-36 %).
- THE WING-BEND DELTA (tools/physics_perf.js --tip, now per phase: the two tips' mean, the median [p10..p90]):
  | phase | true box | flight box | delta |
  |---|---|---|---|
  | parked / taxi (the wing's own weight) | -5.9 mm [-6.6..-5.1] | -6.8 mm [-7.5..-6.0] | -0.9 mm |
  | climb | 16.3 mm [8.4..19.8] | 19.1 mm [9.7..23.3] | +2.8 mm |
  | **cruise (the downwind leg, level)** | **18.0 mm [17.2..19.0]** | **21.1 mm [20.1..22.2]** | **+3.1 mm (+17 %)** |
  On a 5.5 m semispan the cruise bend is 0.33 % -> 0.38 % of it; the load test and every strain read the true one.

### G611 - THE GROUND UNDER THE WHEELS (the ceiling over the pad, the wind's lattice, the premises query)

- THE CEILING OVER THE PAD (27_premises.js `hMaxRect`, bit-identical): measured at the stand, the ceiling sat at
  the raw DEM's 30.99 m over a pad at 30.60, so the belly's 13 nodes (0.33-0.38 m up) sampled every substep with the
  wheels (857 samples a frame of the stock build). The bound now runs in the order a point applies the modifiers
  (`M.ord`): a flatten / slope pad / shelf whose full weight covers the whole rectangle (its corners inside, no edge
  touching it) sets every point to its target, so the bound restarts there (+1 nm, the blend's rounding) and what
  lay under it is out of it. At the stand: 857 -> 210 samples a frame (the three wheels). GATE GE: 0 of 2.76 M
  points above it, the 30 s taxi A/B identical, 88.5 % of samples skipped (80 % before).
- THE SURFACE LAYER'S GROUND ON A LATTICE (09_climate.js, rich days only): inside LIN_GROUND_H every wind call read
  the composed ground exactly - ~2 100 reads a frame at 70 substeps, a third of the stock build's solver at the
  stand under a thermal day. Now a 0.5 m lattice of the world's own heights (a direct-mapped cache, each read once),
  bilinear between them; the re-centre's ground and slope read it too; sample(), a far call and the legacy field
  stay exact (GATE CLIMATE holds the legacy verbatim; its linearised-sampler figures 0.1165 -> 0.1163 m/s). The
  world bumps a ground version on setPremises and the lattice empties. After 30 s of taxi the cg is the same to the
  micrometre (not the same bits).
- The premises' height query without allocation (toLocal's arithmetic in place), the road grade's segments in one
  typed array (the same operations, done once), and exact squared-distance screens before `Math.hypot` in the
  analytic pad ramp and the meadow blend (both read per ground query on the island, 540 m from the pad box): the
  composed terrainH 617 -> ~500 ns a call on the solver's own captured queries. Bit-identical (the stock build's
  and the birdman's hashes unchanged).
- Not done, measured: the wheels' `world.surface` (123 ns x 3 wheels a substep: 0.03-0.07 ms a frame).

### G612 - THE STEP-DEBT GUARD (app.js PACE)

G586 makes a frame owe floor(acc x 60 + 0.25) steps, at most 4. Where a step costs too much the debt cannot be
repaid: the frame owes more because it was long, and is longer because it owed more - it runs away to the 4-step
ceiling, where the frames stall AND the game dilates anyway. Modelled on the clock as written (60 Hz, capped at
30, the frame = its other work + steps x a step, the next refresh after it), the unguarded clock at 15 ms + 16 ms a
step: 12.1 fps at 80 % time. The guard keeps two EMAs - a step's cost (end()'s physMs over the steps actually
run) and the frame's time that is not the solver (its interval less its solver: JavaScript, GPU, the wait) - and
only where holding real time is impossible (other / (1/60 s - step) > 4 steps, or a step >= a 60th) caps the
frame's catch-up steps at what max(the cap's budget, the rest of the frame) carries (the solver may at most double
the frame), never under the cap's own steps (2 at 30, 1 at 60). The same case: 20.1 fps at 67 %. Wherever real
time can be held it is the G586 clock to the step (a naive budget cap was modelled too and rejected: at 15 ms +
12 ms it turned 15 fps at 100 % into 20 fps at 67 %). The dilation (sim seconds over wall seconds, the last
second), the frames capped, the time let go, the step and the rest are in PACE.state(); the graphics menu's frame
readout adds "the game at N % speed" under 97 %. GATE PACE drives it (the runaway capped, the dilation reported
to the sim's own; heavy-but-holdable untouched; a light 30 at 100 %).

### G613 - THE LINKAGE ON THE FRAME'S TIME

`model.link.step(sim.ctl, 1/60)` ran per rendered frame: at 30 fps the control surfaces' visual linkage lag
(SKIN-PROC) moved at half speed. Now `frameDt()` (the frame clock's dt; 1/60 for a rig and the old clock).

### G614 - THE PREMISES' GROUND: the query indexes (landed, exact) and the height raster (built, gated, OPT-IN)

The A0 baseline (futureDesigns/PLAYTEST-2026-09-26.md §0.3): in the browser the stock solver cost 11 ms a frame
with Jolene's premises (no Metlakatla) against 2.1 with ?premises=none, and the roll-out's ring 7.5-9.4 s against
1.4; the ask: bake the composed terrain into a height raster. Measured here first:
- HEADLESS, THE PREMISES NO LONGER COST THE SOLVER: the stock build's 30 s from the stand, the same moment -
  HEAD 5.76 ms, this branch 5.20, this branch with no premises 5.43. What the browser adds with premises that the
  bench does not have: the obstacles the viewer registers (the hangar, the parked aeroplanes, the houses, the
  props - the solver's obstacle pass, per node per substep) and whatever wind the day carries (G611's lattice).
  The browser's 11 vs 2.1 was HEAD's, before G611; it wants re-reading with tools/rollout_perf.js.
- THE RING IS NOT THE HEIGHT QUERY. The forest fill asks, per lattice point, coverAt, world.surface, the premises'
  tree exclude and terrainH (render_world.js openHere / forestHere). A ring-like walk (a 4 m grid over 3 km round
  the stand, 564 k points, cold): the premises' part was cover 185 + surface 732 + exclude 234 + height 123 ms -
  world.surface costs 1.3 us a point with premises (0.37 without): PM.surfaceAt scanned every surface polygon and
  every road, and the registry's classifier took a cos and a sin per aerodrome per point.
LANDED (the default, bit-identical): PM.surfaceAt reads a 64 m cell index (the surface polygons by box, the roads by
the segments within half their width of the cell, in the scan's priority order); PM.excludeAt the same (an OR:
rebuilt when an exclude is added); the registry's strip test rejects past the box's corner radius before its trig.
The walk: 1 274 -> 816 ms (surface 732 -> 415, exclude 234 -> 110); world.surface 635 -> 360 ms on its own; the
answers the same bits on 564 k + 5.5 M (surface) and 14 M (exclude) points; the stock and metal trajectories the
same hashes.
THE HEIGHT RASTER (built, proven, opt-in: `makeWorld(0, { ..., groundRaster: true })`, physics_perf `--raster`).
Every premises modifier is AFFINE in the ground under it (h + (T - h) w, h + dh w, L + (h - L) sm - w, T, sm
functions of the point alone), so is their stack: terrainH(x, z, h) = A h + B. The raster bakes A and B lazily per
16 m tile of the premises frame (the analytic path is the bake's source and stays the editor's), at a quarter of the
finest feather touching the tile and halved to 0.25 m while a cell's midpoint misses by more than 1 cm; a query is A
h + B bilinear with h, the DEM and its seams, read exactly - a pad's interior is its level to the bit. The ceiling
(hMaxRect) grows by the lattice cell under it. GATE PREMRASTER: p99 1.7 mm, p99.9 5.3 mm, worst 18 mm (a concave
pad corner, where the feather itself kinks) over 136 k points; the stand's pad exact; the ceiling bounds the raster
ground on 116 k points. WHY OPT-IN: a tile costs 1-1.6 ms to bake; the world's own make-time walks bake 1 100 tiles
(+1.2 s to the make), a 2 m walk over the same square goes 65 -> 623 ms and even a 0.5 m walk 920 -> 1 017 ms; the
solver gains 4-7 % (two clean pairs: stock 4.09 / 3.99 -> 3.94 / 3.72 ms, metal 6.97 / 7.19 -> 6.62 / 6.75) and
loses its bit-identity. It pays only where one tile is asked thousands of times - a consumer that is, and wants
millimetres, can turn it on.

### G615 - AUTO RECOVERS (the frame cap)

The A0 baseline: the procedural island - 16 ms of loop JavaScript - sat at the 30 cap for 94 % of its frames; auto
dropped at a hitch and trialled 60 only when the one-step work read under 12.5 ms, a miss holding 20 s doubling to
5 min. Now: a frame over three times the cap's interval is a hitch, not a reading (the readout still shows it); the
drop needs three slow readings running (3 s at 60, where it was two); the trial needs the one-step work under 60's
own budget (16.7 ms - the trial is the measurement: its median frame decides, as before); a missed trial holds 5 s,
doubling to 30 s. GATE PACE: a 2 s burst of 22 ms frames holds 60 (HEAD: dropped), 14 ms of one-step work earns a
trial that holds (HEAD: stuck at 30), missed trials hold 28 s at most (HEAD: 39 s and climbing); isolated 120 ms
hitches never drop it (both - the median already ignored them). Not seen on a real display.

### The full tier (ARCHETYPES, PILOTMATRIX, SEAPLANE, HOTHIGH, SOAR), HEAD and this branch side by side

The same verdicts, check for check: ARCHETYPES red on the same five archetypes (Caravan, Tiger Moth, Beaver,
Motorglider, Twin bush - "gave up", each at the same phase), PILOTMATRIX red on the same cells (14 cells, the same
outcomes; the c172, flying the box at 121, lands its circuits 332.7 -> 332.9 s and 338.4 -> 338.5 s), SEAPLANE's
three known reds (44.5 m off the lane both), HOTHIGH and SOAR green. The branch ran the tier in 3 990 s of gate
time against HEAD's 4 914.

### Paired, before (HEAD 3da1c82) / after, the same moment (solver ms a frame, 30 s from Jolene's stand)

| build | day | A (HEAD) | B (G610-G613) | | trajectory |
|---|---|---|---|---|---|
| stock (70 substeps) | calm | 5.11 | 4.64 | -9 % | the same bits (591d1827) |
| birdman (78) | calm | 7.12 | 5.96 | -16 % | the same bits (df7520e8) |
| metal Cessna (200 -> 120) | calm | 11.89 | 7.38 | -38 % | the flight box |
| stock | thermal | 9.72 | 7.44 | -23 % | cg the same to 1 um |
| birdman | thermal | 11.45 | 8.30 | -28 % | cg the same to 1 um |
| metal Cessna | thermal | 24.87 | 11.50 | -54 % | the flight box + the lattice |

## Viewer-side notes (not timed)

- `syncWaterFx`: per live droplet per frame, `world.waterH` and two new arrays for the sprite's set - a few hundred
  a frame during a splash.
- `syncFloats` (only when the floats fly as the physics hull): `computeVertexNormals` every frame.
- The obstacles: see "Not measurable headless" above; the parked aeroplanes and the hangar are records the solver
  tests every substep while the aeroplane is within their radius + 15 m.

## Files

- `src/core/00_registry.js` hyp2 / hyp3; `src/core/90_node_exports.js` exports them.
- `src/core/30_solver.js` hyp2 / hyp3; the engine bookkeeping and the wing couple's arrays hoisted.
- `src/core/27_premises.js` HYP2; the pads' two ends; the grade's screened scan.
- `src/core/32_hydro.js`, `src/core/09_climate.js` HYP3 / HYP2.
- `tools/_hypot_check.js` GATE HYPOT (core); `tools/physics_perf.js` the bench (`--tip`: the bend per phase, G610).
- G610: `src/core/62_gen_aero.js` genSubstepsTrue / genFlightBox / genTrueBox; `30_solver.js` sK, trueBox(),
  reset(); `65_gen_loadtest.js` the rig flies the true box; `tools/_substep_check.js` GATE SUBSTEP, `tools/test_flex.js`.
- G611: `27_premises.js` hMaxRect's order and `covers`, the grade's flat segments, the query in place;
  `09_climate.js` the lattice; `20_world.js` groundVer, padRamp / blendM screens.
- G612: `src/viewer/app.js` PACE (the guard), `gfx_settings.js` the readout; `tools/_pace_check.js` GATE PACE.
- G613: `src/viewer/app.js` the linkage's dt.
- G614: `27_premises.js` the surface / exclude cell indexes (+ the scans kept as the reference), the A / B lattice
  (grBake / grHeight / terrainFast, `raster`), `20_world.js` terrainFast, `groundRaster`, regSurf's reject;
  `tools/_premraster_check.js` GATE PREMRASTER; physics_perf `--premises none`, `--raster`.
- G615: `src/viewer/app.js` PACE auto's readings, trial and backoff; `gfx_settings.js` the menu line; GATE PACE.
