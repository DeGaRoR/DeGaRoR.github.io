# Glider launch study (2026-11-10)

A quick, independent code study. **The question:** what would it take to launch sailplanes, which today have no way
to get airborne? Three scenarios:

- **A — aerotow:** a C172-like tug, a rope, and two aircraft flying at once, each with its own autopilot.
- **B — ground tow:** a vehicle drives down a long runway and tows the glider (auto-tow).
- **C — bonus, the trailer:** a vehicle carries a floatplane on a trailer down the runway and the floatplane takes off
  from it, like a real wheeled take-off dolly.

No gates were run. The four probes in this folder are headless node scripts, each taking about a minute. They fly the
real solver on real ARCHETYPES cards. They are prototypes for the study, not gates.

## TL;DR

| | Physics | AI / pilot | Game page (worker, render, UI) | Effort | Risk |
|---|---|---|---|---|---|
| **B ground tow** | **proven in a probe** (rope on one sim) | glider: new TOWED-ROLL + pitch law; driver: exists (not bundled) | car mesh + kinematic mover or vehicle.js bundled; rope line; release key | **S-M (2-3 sessions)** | low |
| **A aerotow** | **proven in a probe** (two sims + rope) | tug: mostly existing modes; glider: new station-keeping law | **two-aircraft worker + second flexing mesh**: this is the cost | **L (5-8 sessions)** | medium (CPU, app.js single-aircraft) |
| **C trailer** | **proven in a probe** (cradle springs, no new contact model) | the pilot's ROLL must accept a ground roll on a cradle | car + trailer mesh, rule exceptions (floats: water only) | **S-M (2-3 sessions)** if B lands first | low-medium |

**Recommendation:** do B first. It delivers "gliders can fly" for the least effort and builds most of the shared
pieces: the rope, the release, the towed-roll pilot, the glider card with no engine, and the car on the runway. C reuses
the car. A is the big one, and almost all of its cost is the second aircraft in the game page, not the physics.

## What exists today (the facts that set the effort)

### Gliders
- **No spec can have zero engines.** `genDefaults` refills an empty `engines` array with the default A-65
  (`src/core/60_gen_spec.js:4477`). `genAlias` reads `engines[0]` unguarded (`:4559`). The clamp keeps 1-2 entries
  (`:5791`). Thrust consumers read `nEngines || 1`: `64_gen_build.js:790`, `30_solver.js:1907/2713/3012/4158`,
  `43_pilot.js:404/413/458`.
- **The closest thing to a glider is a motorglider with its engine switched off.** The `sail` class with the
  `glider` role is the motorglider archetype (`tools/_cage_design.js:2802`). GATE SOAR (`tools/test_soar.js`) already
  flies it that way: an air start, then `setEngine(0, {key:'off'})`.
  - A true engineless sailplane needs the 0-engine path above. It is a small change, but it touches the spec, the
    sheet and the shakedown, so the gates must agree with it.
  - It also needs a gear row: monowheel plus wing-tip rest. Today the choices are tail, trike, floats or hull
    (`_cage_design.js:1846`). There are no spoilers either (`44_machine_sheet.js:102`).
- **There is no air start in play.** Flights start on the ground (`39c_placement.js`). Air starts exist only in the
  story skip (`app.js:10883`), GATE SOAR and the cert.

### The autopilot and gliders
- **It already flies an unpowered aircraft in the air.** The layer is TECS-style (Total Energy Control, as in real
  autopilots), with throttle and pitch separate. `SEL.deadThr` forces the throttle to zero, so speed is held by pitch
  alone (`43_pilot.js:2603`). The GLIDE phase (`:3380`) and the AP box (`engage/select`, `:1049`) use it, and GATE SOAR
  proves it.
- **The ground phases assume thrust:**
  - DEPART switches the engines on (`:3405`).
  - ROLL rejects the take-off when acceleration stays below 0.08 m/s² for 8 s (`:4010`).
  - CLIMB has a "wont-climb" check (`:2716`). GOAROUND and the circuit legs are planned on `climbMax`.
- **There is no glider circuit and no landing pattern.** Dead-stick handling is only GLIDE → FLARE.
- **There is no formation, station-keeping or moving-target logic.** TRK flies to a fixed point. Re-selecting the
  target every frame works: G780 turns target steps into a turn rate, and GATE SOAR re-selects every 0.25 s.
- **Two pilots on two sims are fine.** The pilot has no module-level mutable state; everything lives in the
  `makePilot` closure. The hydroplane test already runs a second sim and pilot in the page (`app.js:12516`).

### The solver with two aircraft and a rope
- **Two sims coexist exactly.** All state lives in the `makeSim` closure. **Measured (probe_two_sims):** a C172-alike
  and the motorglider stepped alternately in one world give bit-identical node positions and velocities to each one
  flown alone.
- **External forces need no solver change for a probe.** `sim.onSubstep = fn(s, dt)` runs after each substep
  (`30_solver.js:4114-4125`), and `sim.impulse(node, Ix, Iy, Iz)` adds to `v` (`:4217`). A rope is a tension-only
  spring-damper applied as `impulse(F·dt)` every substep. The load test uses the same trick.
  - For production, a small `extF` hook before `integrate()` would be cleaner. It is optional.
- **Two sims have no common substep clock.** Each build has its own substep count (24/75/120). The probe couples the
  two sims frame-lagged: it takes the far end of the rope from the other sim's frame-start state, extrapolated with its
  velocity. With a nylon rope (k ≈ 2.5-3 kN/m) this was stable in every run.
- **Cost:** about 5.2 ms per frame for the C172-alike and 4.9 ms for the motorglider (node, this container). The pair
  ran at 12-14 ms per frame with the rope. HANDOVER's metal Cessna is 8-9 ms alone, so a metal tug plus a glider in one
  worker is at the edge of 60 Hz. A lighter tug (Cub-class, about 2.5 ms) fits. HANDOVER also warns that the shared beam
  loop slows down when two builds with different beam shapes share one thread (JIT polymorphism, HANDOVER:83592).
- **Ground contact is static world height.** There is no moving platform and no ground-velocity term in the friction
  (`30_solver.js:3871-3975`). This matters for C, and probe_trailer works around it.

### The game page (the real cost of A)
- **One aircraft everywhere.** `let def, sim, ap` (`app.js:50`): 450 `sim.` refs, about 200 each of `ap.` and `def.`.
  The camera director, HUD, audio, damage overlay, recorder, career stop and `poseModel` all read the single globals.
- **The sim worker hosts one sim, one pilot and one snapshot layout** (`sim_host.js:439-760`). The page's `sim` is a
  proxy (`sim_view.js`). The rope has to live in the worker, so the worker needs a second sim slot and a second
  snapshot.
- **Rendering a second garage build as a flying, flexing mesh has no precedent.** The core skin functions take
  parameters and can be reused (`poseSkinGen`, `makeSkinBinding`, `sparDeltas`, `applySkinDeform`), but the viewer's
  `buildModel/poseModel` and AEROSKIN's uniform block are about "THE aeroplane". The cheapest first cut is a rigid
  `PARKED.place` group posed from `sim2.bodyOrigin()/axes()`: no flex, but it moves.

### Vehicles
- **`src/vehicle/vehicle.js` + `vehicle_drive.js` is a real physics car with an AI driver**: the G2940 spike, the
  1989 Conquer pickup, GATE VEHICLE. It is **not in the bundle yet**; the steps left to integrate it are in
  `futureDesigns/GROUND-VEHICLE-2026-10.md` §8. The driver follows any polyline, so a runway centreline is just a
  road. It has no hitch.
- **The cars seen in the game are kinematic**: they slide along a road by arc length (`render_premises.js:2067`).
  That is enough for a tow car on a runway.
- **Runways:** Jolene AFB has 2325 m and 1758 m paved strips. The analytic HOME strip is 1100 m of grass.

## The probes (measured 2026-11-10)

Run any of them with `node futureDesigns/glider-launch/<probe>.js` from `flyDiy/`. Each takes about 30-90 s.

1. **probe_two_sims.js**: two sims in one world. They coexist bit-exactly; cost per frame as above.
2. **probe_car_tow.js `[card] [Vcar] [hold]`**: a kinematic car tows the motorglider (engine off, 249 kg) on a 40 m
   rope.
   - **Hands-off:** at 28 m/s the glider rides tail-up but never lifts off. The elevator stays neutral, as expected.
   - **With a 6-line pitch-hold:** wheels off at 12.5 s at about 26 m/s, then a climb to **34 m**. That is the geometric
     ceiling of a 40 m rope. Peak tension 6.8 kN, from snatch on the short rope.
   - **What this means for B:** a real auto-tow uses 300-600 m of line and reaches about one third of the runway
     length. On Jolene's 2.3 km that is about 300-500 m, a usable thermal-hunting start.
3. **probe_aerotow.js**: the C172-alike tug plus the motorglider, two sims, a 50 m rope, coupled frame-lagged.
   Both aircraft fly crude pitch, bank and centreline holds written for the probe, not the game's pilot.
   - **First run, pitch-only:** the glider swung out sideways on the rope like a kite and crashed at 40 s.
   - **With wings-level and line-up holds on both:** a clean formation take-off. Both lift off at about 30-36 m/s and
     climb together at 36.5 m/s and about 1 m/s. The rope stays at 50.2-50.3 m, the glider sits 2-3 m above the tug
     (high tow), the lateral offset stays within 3 m, and peak tension is 1.3 kN.
   - The 1 m/s climb is low. The tug's pitch target is crude, so this says nothing yet about the tug card.
4. **probe_trailer.js `[Vdeck]`**: the floatplane archetype (509 kg) on a kinematic deck 1 m up.
   - **The cradle:** four spring-damper pads under the float keels. They push up only and hold sideways like chocks.
     A latch opens when the cradle load averages below 10 % of the weight.
   - **First version, pads that also held down:** the plane could never rotate and stayed latched forever. Pads that
     only push up are what make it work, and that is how a real dolly behaves.
   - **With up-only pads:** release at 15.1 s and 37 m/s, then a clean climb at about 3.5 m/s. That probe run used
     only full throttle and a pitch-hold.
   - **No new contact model is needed:** the trailer is four latched pads on the aircraft, not a moving ground. That
     avoids the static-ground assumptions in the solver (the clearance cone, the ceiling box, the terrainH memo).
   - **Design note:** the car has to reach the floatplane's rotation speed, about 135 km/h here. A float build is also
     heavy, so the plane's own thrust does most of the work and the car mostly keeps pace. A free-rolling dolly that the
     aeroplane pushes would be the realistic variant.

## Work breakdown

### Shared foundation (any scenario): about 1 session
- **The rope module** (`src/core/3x_tow.js`): tension-only spring-damper, rope stiffness from length and material, a
  weak link (a break above N kN), release, snatch damping, and the hook nodes from `def.refs`:
  - glider nose hook: the `noseFrame` lower pair;
  - tug tail hook: `tailMid` / `tw`;
  - spread the load over two or more nodes rather than one light node.
  - Applied through `onSubstep` + `impulse`, or a 5-line `extF` hook before `integrate()` (the hot loop; needs
    HANDOVER's perf care).
- **A gate for it**, modelled on probe_car_tow: wheels-off within X s and a height above Y m on a 400 m line.

### Engineless glider card: about 1 session (optional; the motorglider with its engine off works now)
- The 0-engine path through spec, alias, build, sheet and shakedown (the `nEngines || 1` sites).
- A monowheel + tip-skid gear row.
- Optionally spoilers or airbrakes: the machine sheet already reserves the effector.
- A pure-sailplane archetype.

### B — ground tow: about 2 sessions on top of the foundation
- **The car:**
  - cheap: a kinematic car on the runway centreline, the proto-traffic pattern, with an acceleration and speed
    profile;
  - full: bundle `vehicle.js`, as §8 of the vehicle design already plans.
  - Either way, add a hitch point.
- **Glider pilot: a TOWED-ROLL phase.** Wings level on ailerons, runway steering, an elevator schedule, lift-off at Vr
  with no throttle logic. The probe's pitch-hold is the seed.
  - Then CLIMB-ON-LINE: a pitch law for the steep winch-style climb, limited by line tension or angle.
  - Then RELEASE, which hands over to the existing GLIDE/BOX glider recipe.
- **Page:** the rope drawn as a line, a release key, the car mesh (the Conquer pack exists), a start position "on the
  line" at the runway threshold, and the rope living in the worker (one sim, so the current worker shape is enough).
- **What is missing after B:** a glider landing pattern. GLIDE→FLARE exists; a proper glider circuit with
  airbrake-controlled approach is its own session.

### A — aerotow: about 5-8 sessions on top of the foundation
- **The worker hosts two sims** (`sim_host` H × 2, a second snapshot, a second `sim_view`), and the rope lives in the
  worker. Start both sims' `simT` together so they fly the same gusts.
- **The second aircraft in the page:**
  - posing a second build: at first rigid via `PARKED.place`, later flexing via the parameterised skin functions;
  - its own AEROSKIN block (the `parked.js` clone pattern);
  - audio for the second engine.
  - This is the largest single item, because `app.js` assumes one aircraft throughout.
- **Tug pilot:** mostly existing.
  - ROLL / LIFTOFF need tow-aware reject thresholds (or a tow flag).
  - Then a TOW phase: BOX with HDG/PATH + TECS at the tow speed, a bank limit of about 15-20°, and a climb to the
    release height.
  - After release, `disengage('auto')` resumes the circuit home.
- **Glider-on-tow pilot: new.**
  - Lateral: track the tug's path. TRK re-selected every frame to a point behind the tug works as a first cut.
  - Vertical: hold a position relative to the tug (high tow) with pitch. There is no throttle to use; the rope sets the
    distance along it.
  - The probe shows the minimum: without roll and line-up control the glider kites out and crashes.
- **The player's seat:** the player flies one aircraft and the AI flies the other. The camera, HUD, recorder, damage
  and career stop all follow "the player's sim". Switching seats is a later nicety.
- **CPU:** a light tug (Cub-class) plus a glider fits in one worker. A metal C172 plus a glider is about 12-14 ms per
  frame in node, which is tight. The fallback is fewer substeps on the passive aircraft. The JIT polymorphism in the
  shared beam loop is a risk to measure first.
- **Collision between the two aircraft:** none exists. Out of scope; the rope keeps them apart.

### C — trailer launch of floatplanes: about 2 sessions on top of B's car
- **The cradle module:** pads on the float keel nodes that push up only, hold sideways like chocks, and open on a load
  latch. It is the same `onSubstep`+`impulse` mechanism as the rope. probe_trailer is the seed.
- **The trailer and car mesh**, a placement "on the trailer", and the car's speed profile (it must reach Vr; for the
  Twin-582 floatplane, about 37 m/s).
- **Rule exceptions:**
  - `stripAllows`: "floats land on water only" (`25_airfield.js:1027`);
  - the start that forces floats onto water (`app.js:6932`).
- **The pilot:** ROLL must accept a roll on the cradle as a normal take-off roll.
- **Landing:** the floatplane comes back to water as today. Landing on the trailer is out of scope.
- **What it gives the game:** float builds can fly from land bases, so the career's land-only contracts open to them.

## Open questions for the user
1. A: which seat does the player take, tug or glider? Glider is the natural fantasy; the tug is the AI.
2. B: a winch (fixed drum at the far end, the cable reeled in) is physically the same rope with a fixed anchor.
   It is even simpler than the car, and it is the classic club launch. Worth adding as B'?
3. A true sailplane card (0 engines + monowheel), or keep launching the motorglider with its engine off?

## Addendum 2026-11-13: the winch (B')

**The model.**
- `tools/_winch_gen.js` is a procedural prop in the tower generator's grammar: DEF, ROWS, PRESETS, PAINTS and
  `build(P)`, which returns a THREE.Group. DIM and KIT hold the numbers a placer reads.
- It draws a twin-drum trailer winch: the chassis with its drawbar; the engine housing (V8, diesel or electric); the
  drums with their brakes and levelwinds; the fairleads with the guillotines; the mesh cage; the cab with its aft
  grille and beacon; and the cable out to the drogue, strop, weak link and rings.
- `tools/_winch.html` is its page: orbit, presets and toggles. `tools/winch_shot.js` renders headless stills into
  `reports/evidence/WINCH-LAUNCH/`. `tools/winch_page.js` builds the one-file phone page.

**The physics probe (`probe_winch.js [L0] [vReel] [Tcap]`).**
- It is the car tow's line with the far end fixed at the drum's fairlead. The rest length shrinks at the drum speed,
  and the stretch rate is d(L − Lrest)/dt = −v_hook·u + v_drum.
- **The drum:** the driver opens up to 24 m/s over 3 s and backs off when the line pulls over 4.5 kN.
- **The glider:** the motorglider with its engine off holds a pitch schedule: tail up on the run, rotate at 22 m/s, a
  34° climb from 10 m, eased when slow.
- **Release:** when the line passes 65° at the glider.
- **Measured:**
  - 600 m line: released at **126 m**, 20.9 s, 58 m short of the drum; peak tension 6.0 kN.
  - 1000 m line: released at **239 m**, 32.3 s, 111 m short of the drum; peak tension 5.1 kN.
- **Release speed is 43.6 m/s, too fast.** The probe's drum holds 24 m/s even as the line steepens. A real driver
  eases off in the second half of the climb; the production law should govern on the glider's airspeed. That is the
  first tuning item.

## Addendum 2026-11-13: the winch's weathering

The user asked for full weathering, using the aeroplane method, the building method, or both. It uses both.
`tools/_winch_weather.js` (WINCH_WX) hooks every MeshStandardMaterial of a built winch.

**From the buildings:**
- the house library's scanned sets, read triplanar at their own tile: `steelgrey` for the paint (a neutral-map grain
  under the tint), `steelrust` and `rust` under the chips, `galv` on the deck and the bright work;
- DIRT_EXPR, the splash line up from the ground;
- the age tone (chroma out, value down) and the low-frequency repetition breaker.

**From the aeroplanes:**
- the four macros, resolved into the layers by aeroWxResolve's rule (age, use = launches, field = grass and mud, rain);
- the grunge sheet (aeroWxGrunge) and the AERO_WX_COL colours;
- placed sources: the exhaust plume from the stack, wheel mud, and grease (tar, the one glossy dirt) at the generator's
  `userData.wx` points;
- chips at the edges exposing the substrate (primer, then rusting steel). Each part carries `aBox` (its half extents
  and kind), so a chip finds its own box edge or cylinder rim;
- the NO-SHINY-DIRT invariants.

**The page:** three looks (new, club, tired) and four dials. `?pin={"layer":v}` forces layers for a bench read. The
stills of all three looks are in `reports/evidence/WINCH-LAUNCH/`.

**Tuning finding.** Fade, age tone and rain streaks together washed the yellow out to cream at the club setting. Each
was halved and the fade now bleaches toward the paint's own lighter colour, never toward grey.

## Addendum 2026-11-13: the winch, built

Scenario B' is now in the game, on the tow-launch branch's plumbing.
- **The physics:** `src/vehicle/winch.js`, the line to a fixed drum with the drum, its driver and the CG hook.
- **The page:** `src/viewer/winch_mode.js`. The start chooser's "A winch launch" places the winch at the far end of
  Jolene AFB 13/31.
- **The gate:** GATE WINCH, `tools/_winch_check.js`.
- **The record:** HANDOVER.md "WINCH".

**What the launch showed:**
- On the probe's nose hook the climb could not hold its pitch, and the launch made 187 m off 1000 m. The CG hook (a
  point on the belly 0.25 m ahead of the CG) gives **275 m**, close to the club figures (about a third of the cable).
- The driver must cap the pull on the ground run. Full power at once snatched the 249 kg glider off its weak link in
  3 s.
