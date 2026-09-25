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

### 5. Frame pacing - the sim is tied to requestAnimationFrame

`loop()` steps exactly 1/60 s per rAF whatever the real frame time. Below 60 fps the game runs in slow motion; on a
120-240 Hz display with frames to spare it would run 2-4x fast AND pay the physics 2-4x per second. A fixed-step
accumulator (step 1/60 per 16.7 ms of wall clock, at most N steps a frame, the render interpolating or not) is the
standard answer; it is a gameplay ruling (what a slow machine should feel: slow motion or dropped sim time).

### 6. The first frames after the roll-out: the solver's JIT warm-up - ALREADY PAID BEHIND THE SCREEN

The bench's longest frames fall in the solver's first 0.5 s (150-300 ms: V8 optimising substep / aeroPass / the
hydro). In the game that cost is already hidden: rollOut() resets the sim and sets `running` before the roll-out
screen's steps, and loop() steps the sim BEFORE its `holdRender` return, so the solver runs every frame under the
overlay (the tree ring, the pictures, the compile - seconds of it) and V8's optimised code is shared by every later
sim of the page. Nothing to do.

### 7. The climate (only when a rich preset is on)

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
- `tools/_hypot_check.js` GATE HYPOT (core); `tools/physics_perf.js` the bench.
