# PILOT-ROADMAP — from the circuit pilot to the autonomous, hirable one
### (2026-09-14, a gap analysis on the user's brief; the base for the pilot track of ROADMAP.md)

STATUS: **v0.1 — a gap analysis with its critique (§6), not a plan yet.** Every "today" line below is a measured fact of the
tree at G381.1 (`src/core/43_pilot.js`, `38_nav.js`, `39_ground_path.js`, `25_airfield.js`); every
"target" line is the user's brief; every "gap" names the file and the mechanism that is missing.
Sizes are sessions (S = a session or less, M = two to three, L = a chantier).

THE USER'S BRIEF (2026-09-14): *"I plan for the autopilot to be central to the game, and to fly
routes autonomously. It will know the specs of the runways, and possibly an approach protocol, yet it
needs to be clever and reactive enough. We could even imagine to have sliders for this one too, so we
could simulate hiring pilots with stats. The strips will vary from medium airport, all amenities to
sand bars, and glorified forest path. Yet all runways will be defined and have their metadata like
length, surface, touchpoint, geometry, profile, elevation, etc. And this will be available to the
autopilot, as well as the environment geometry, including the vegetation. […] design the best pilot
there is first, then downgrade it to make small mistakes, then bigger ones, through stats and
sliders. It should also know the basics of flying different types of machines, and adapt its behaviour
according to the runway type and length. That includes water landing and taxiing. […] following the
taxi path accurately, with feedback on actual rolling speed, be able to do a proper U-turn according
to the defined patterns."*

WHAT IT RELATES TO:
- `PREMISES-CONTRACT-2026-09-13.md` §1.2 `runways[]` — the record the editor writes: `c, hdg, len,
  wid, surface, elev, profile [[t, y]] | null, pattern` — and v1.7 (a stand, a taxi road, a harbour).
  This document is the pilot's ASK against that contract (§3 below).
- `WATER-2026-09-13.md` — H4 "the water-taxi autopilot" is the water half of §2.E; G382/G383 put the
  floats in the solver and the seaplane in the game with NO pilot ("fly it by hand").
- `WORLD-CONTRACT.md` — the world is a pure data API; the pilot must read it the same way
  (`terrainH`, `surface`, `wind`, `treesNear`), never a mesh.
- HANDOVER G202 (the three layers: servos / AFCS / phase machine), G381 (arc turns, the hold-off,
  the tail), G381.1 (the power assist, the U-turn under test).

---

## 0. WHERE WE ARE — the inventory, measured

**The architecture holds.** Three layers, and they are the right three: the SERVOS (pitch, lateral,
speed, VS, ground steer, taxi governor, path follower), sized per aeroplane by `genTuneAP` from the
tunnel; the AFCS (lateral HDG/TRK/NAV/LOC/RWY/TAXI/DECRAB, vertical ALT/VS/FLC/GS/PITCH/DE, thrust
SPD/FULL/IDLE/SET/TAXI, a flight director, the AP box the hand can share); the PILOT, a bounded
phase machine that only selects modes and targets. Nothing below is an argument against it; every
gap is a fourth thing missing beside it (a PLANNER that reads records) or a filter in front of it
(a PERCEPTION layer the sliders bite on).

**What is proven, today** (calm, HOME, the 19 archetypes, GATE PILOT's 12 cases):
- the rectangular circuit into wind, arc turns joining every leg within 4-22 m, a latched level
  segment, the slope held within ±2 m, the hold-off flare (0.5-1.2 m/s on 17 of 19 builds), a
  straight roll-out (max heading swing 0.1-5 deg calm, 10-11 deg in 2 m/s across on the
  taildraggers), the accelerate-stop call and V1, rotation on every gear type, the put-down;
- land, turn around on the strip (the U-turn at the pose, a backtrack), hold, take off again;
- the departure from a stand along a declared taxi graph (curvature fed forward, the speed
  governed by the bend ahead and the stop), the hold-short line, the line-up;
- a cross-country: climb to cruise on the runway heading, an enroute leg at a terrain-floored
  altitude (`terrainAhead` 7.5 km, +130 m), a 3 deg descent onto the destination's circuit height,
  a pattern entry or a straight-in, the terrain go-around;
- three STYLES (cautious / normal / brisk) scaling margins, reject fraction, bank, speeds;
- the AP box (a device the hand shares, axis by axis) and the NAV (waypoints, legs, direct-to,
  DTK/TRK/XTK/CDI/ETE, VNAV's one number).

**What the pilot assumes, today, that the brief breaks:**
1. **One flat plane per aerodrome.** `refAlt`/`altRef` is one number; `agl` (the flare, the screen
   height, the balk guard, the lift-off) is height above it. `aglT` (above the terrain under the CG)
   exists and only the terrain go-around reads it.
2. **Grass, level, dry.** `stopDist` and the acceleration prediction carry no gradient and no
   surface; the solver already rolls on `GROUND_SURF` per surface class (rock, scree, forest floor,
   water, paved, gravel, sand), the pilot does not know which it is on.
3. **A runway is a rectangle with a heading.** `siteRunway` derives every point from `x, z, hdg,
   len, wid, elev`; the contract's `profile` is not read; there is no obstacle surface, no
   displaced threshold, no width-dependent rule.
4. **The approach is one recipe.** Circuit height, slope, flap policy, aim, go-around rules are
   genTuneAP's constants per aeroplane, not a function of the runway or a protocol record.
5. **The machine is known through genAP's constants**, not through what the bench certified: the
   plaque's Vs, TORun, landing run, climb gradient exist (`genShakedown`, the certificates) and the
   pilot does not read them.
6. **It cannot fly on water** (WATER H4): a seaplane spawns on the sea and "the pilot does not know
   it is on water".
7. **Wheel contact is the truth.** `onG` (a tyre within 3 cm) is the touchdown, the skip and the
   settle-back detector; one bump on a rough strip is a skip.
8. **A style is three presets.** There is no PROFILE, no stat, no error model; the pilot reads the
   sim's truth (position, speed, attitude) with no perception in between, so there is nothing for a
   slider to degrade except gains and margins.
9. **The test bed is a set of cases, not a matrix.** GATE PILOT's 12 cases, ARCHETYPES (19 builds,
   calm, HOME), HOTHIGH; no crosswind touchdown case (WIND blows along the strip), no slope, no bump,
   no short strip, no water. The trace runner that found every G381 defect is a scratch file.

---

## 1. THE TARGET, AS CAPABILITIES

A pilot that, handed a machine, a route and the world's records, (a) plans the flight from data,
(b) flies it with the servos it has, (c) reacts to what the data did not say (gusts, a bounce, an
engine, terrain), (d) says what it is doing and what it decided, and (e) can be made worse along
named axes without touching (b). The order of building: the best pilot first (§4 P0-P3), the
downgrade last (§4 P4), because an error model needs a correct model to subtract from.

---

## 2. THE GAPS, BY CAPABILITY

Legend — TODAY: the measured state. TARGET: the brief. GAP: the missing mechanism, where it goes.
SIZE: S / M / L. NEEDS: the data or the peer work it waits on.

### A. The runway as data (the record the pilot flies)

| | |
|---|---|
| TODAY | `siteRunway(home)` from `x, z, hdg, len, wid, elev`; `td0/td1` at 20 % (G381); `holdIn` 110 m; `aim0/1` derived; the pattern's `approaches[k]` = `{u, thr, td, aimAP, gs: null, ga}`. |
| TARGET | The pilot reads every runway of the world from the premises contract: profile (longitudinal), width, surface, thresholds (displaced or not), touchdown zone per direction, lighting/PAPI, the pattern, the approach protocol, the obstacle environment. |
| GAP | A **RUNWAY MODEL** (`25_airfield.js`, pure): `hAt(s)` and `gradeAt(s)` from `profile`, `surfaceAt(s)`, `usable[k]` (from a displaced threshold), `obstacle(k)` = the highest obstacle in a cone off each threshold from `terrainH` + the CANOPY height (§3.2), giving a required approach slope and a required climb gradient per direction; `approaches[k].gs` filled (today null) and `.protocol` (§3.3). One keeper, as `siteRunway` is now; the paint, the pattern, the pilot and the gates read it. |
| SIZE | M |
| NEEDS | §3.1 (profile per end or `profile[]`), §3.2 (a canopy height API), §3.3 (the protocol record). |

### B. Approach and landing

| | |
|---|---|
| TODAY | Level until the slope, GS on ground speed, `VAppr × style`, flaps to landing at the start of final, the hold-off on `agl`, the power assist, decrab in the last 3.5 m, go-arounds on high/off-centre/terrain/past-the-aim/float; xAim clamped for short strips (`sThr + 40`, `< 700 m`: 12 % in, `VApprShort`). |
| TARGET | The approach chosen from the runway and the weather: slope from the obstacles, Vref + a gust factor, the flap setting from the wind and the strip, the aim from the usable length, a short-field arrival on a 300 m bar, a soft-field arrival on sand or forest floor (nose held off, no brakes), a wheel or three-point choice, a landing on a slope (uphill preferred, no downhill into a short strip), the go-around policy from the protocol. |
| GAP | (1) **flare, screen and balk on `aglT`**, and the last 300 m of the slope on the profile's height (S — the biggest effect for the least code); (2) an **APPROACH PLAN** object built by the planner from the runway model: `{gs, Vref, flap, aim, technique: 'normal'|'short'|'soft'|'wheel'|'three', gaRules}`, replacing the constants `planArrival` reads (M); (3) a gust factor on Vref (half the gust, from `world.wind`'s spec) (S); (4) the short-field technique: full flap, Vref 1.3 Vs, aim ON the threshold + 30 m, max braking, the reject at the fence (S); (5) the soft-field technique: nose off through the roll, no brakes, a rolling turn-around (S); (6) the slope rule: land uphill when the gradient exceeds ~2 % and the wind allows, never downhill on a strip under 1.5 × the landing run (S, needs A). |
| SIZE | M overall |
| NEEDS | A. |

### C. Take-off and climb-out

| | |
|---|---|
| TODAY | Accelerate-stop with five reject rules on flat grass; rotation at VRot; LIFTOFF's put-down and V1; CLIMB at VClimb then 1.1 Vy; the crosswind turn at 0.6 hC; the ground-effect fixture. |
| TARGET | Gradient and surface in the run prediction; an obstacle-clearance climb (Vx until clear, then Vy); a soft-field take-off (tail low / nosewheel light, lift off in ground effect, accelerate level); a short-field take-off (brakes, full power, rotate at the book speed); the choice of direction from wind AND slope AND obstacles; a departure track per protocol (the noise-abatement turn of a strip in a valley). |
| GAP | (1) `stopDist` and the `dVr` prediction with `g·gradient` and the surface's CRR (S); (2) `dirAt`'s choice from three terms — wind, gradient (downhill), the obstacle gradient per end (S, needs A); (3) an obstacle-clearance segment in LIFTOFF/CLIMB: hold Vx while `obstacle(k)` is not cleared by 15 m (S, needs A); (4) the soft/short techniques as ROLL sub-modes (M). |
| SIZE | M |
| NEEDS | A. |

### D. Ground operations

| | |
|---|---|
| TODAY | The declared graph, `patternPath` (fillets, curvature), `pathLocate/pathLook/pathSpeed`, the taxi governor on GROUND speed (`Vg`, the CG's), the U-turn at the pose, the hold, the line-up, the stand, the backtrack lanes, taxi-out routes, `taxiVFast` on a long straight. |
| TARGET | Accurate path following on any surface and slope with real rolling-speed feedback, the U-turn per the defined pattern, parking at a stand, shutdown, a taxi on water. |
| GAP | (1) the governor's feed-forward from the SURFACE's CRR and the GRADIENT (a hold rolls back on a slope; sand needs 2× the grass throttle) (S); (2) the hold's brake and throttle from the gradient (S); (3) **wheel speed** as the feedback: the solver knows each wheel's contact and its ground velocity — publish `sim.wheelSpeed()` and let the governor read the mains, so a skidding or a lifted wheel is seen (S, solver); (4) a bump DEBOUNCE on `onG` (0.3 s) for the skip/settle-back detectors and the ROLLOUT elevator law (S); (5) the stand: a precise stop on the stand's mark and heading (today 2 m / the hold's 6 deg) and a shutdown sequence (S); (6) water taxi = E. |
| SIZE | M |
| NEEDS | the solver's wheel-speed readout. |

### E. Water

| | |
|---|---|
| TODAY | Floats in the solver (H0/H1), the seaplane placed on the sea, flown by hand. WATER's H4 "the water-taxi autopilot" is the placeholder. No `kind: 'water'` runway; `SURFACE.WATER` is a ditching row in `GROUND_SURF`. |
| TARGET | The pilot lands and takes off on a lake or the sea into wind on a heading it chooses, taxis at displacement speed with the water rudder, steps onto the plane, beaches or docks, knows glassy water and swell. |
| GAP | (1) a **WATERWAY record** in the premises contract: a polygon (the usable water), a shore line, a dock/beach hook, sheltering; the runway model builds a runway of `kind: 'water'` from it per wind direction (heading = into wind, length = the chord of the polygon along it) (M, contract + A); (2) the hydro readouts the pilot needs: `sim.hydro` state (displacement / hump / planing), the water rudder as a control, the wetted area; (3) phases: WATER-TAXI (idle, water rudder), STEP-TAXI (a plow to the step), the take-off run on the step (rotate = lift off the step, no VRot rule), the landing (a hold-off to a flat touch, no flare to a stall; glassy water = a set attitude + a set sink, 0.5 m/s, flown on the VS servo), the docking approach; (4) the crosswind on water (a downwind wing dip). |
| SIZE | L |
| NEEDS | WATER H2/H3 (the peer's), §3.4. |

### F. Knowing the machine

| | |
|---|---|
| TODAY | `genTuneAP` sizes gains and speeds from the tunnel; trike / taildragger / three-point / wheel; flaps; per-engine levers; the power assist. The plaque's numbers (`genShakedown`: TORun, Vs, climbRate, LDbest, noseOver…) and the bench certificates exist and the pilot does not read them. |
| TARGET | The pilot flies the class it is given: a glider (no go-around, an energy circuit), a twin (asymmetric thrust after a failure, Vmc), a seaplane (E), a motorglider (engine off en route), an electric (energy, not fuel), a turboprop (the beta/feather regime), a biplane, a canard, an ultralight in a gust. It knows the book numbers and flies them. |
| GAP | (1) **the pilot flies the plaque**: a `MachineSheet` from the certificate + shakedown (Vs, Vs-flap, Vref, Vx, Vy, TORun, LDG run, best glide, Vmc, energy endurance) read at `makePilot`, genAP's constants as the fallback (M); (2) the glider circuit (no throttle mode: the slope is the speed brake's, the circuit joins high, no go-around: a committed landing with a field choice) (M); (3) the twin's engine-out (a rudder trim, a bank, Vyse, the drift-down) (M, needs the multi-engine failure in the sim); (4) the electric's energy planning with `60c_gen_energy` (S); (5) the seaplane = E. |
| SIZE | L overall |
| NEEDS | the certificate as data (`plaque.js` publishes it). |

### G. Flying routes

| | |
|---|---|
| TODAY | `setRoute(from, to)`: one enroute leg on a terrain floor, a descent onto the destination, a pattern entry. The NAV: a database of aerodromes, legs, direct-to, readouts, VNAV. Weather: one wind vector + gusts, ISA with OAT/QNH. |
| TARGET | A FLIGHT PLAN with waypoints and altitudes through a mountain world (valleys, passes, ridges), fuel/energy and time planning, a wind aloft, diversions (weather, energy, daylight, a closed strip), the circuit join per protocol (overhead, 45°, straight-in, downwind), a hold. |
| GAP | (1) **terrain routing**: a pathfinder over the height field (a coarse graph of passes and valleys, or an A* on a 250 m grid with a climb-gradient cost) producing legs at MSA (S-M); (2) legs WITH altitudes and a VNAV descent per leg (the NAV has the number; the pilot's ENROUTE flies one) (S); (3) energy and time: the plaque's endurance vs the plan's distance and wind; a diversion when the margin dies (M, needs F.4); (4) circuit joins from the protocol (S, needs §3.3); (5) weather aloft in the world (wind by height and by valley) is the world's, not the pilot's — consumed as `world.wind` already is. |
| SIZE | M |
| NEEDS | §3.3; the world's wind-by-height when it exists. |

### H. Reactivity and robustness

| | |
|---|---|
| TODAY | Bounded phases with timeouts and fallbacks, two go-arounds then committed, the watchdog budget, the terrain go-around, the balked take-off, the float go-around, DECRAB through a skip. |
| TARGET | An engine failure handled (a forced landing on the best field within glide, from the terrain and vegetation data), a bounce recovered (a balked landing after touchdown), a gust on short final, a fouled strip (a stopped vehicle, a herd — later), a missed hold, a too-hot brake, a runway incursion by the plan (a strip that is not there). |
| GAP | (1) the **forced landing**: on engine loss, a field search within `LDbest × height` over the terrain — flat (gradient < 4 %), clear (canopy = 0), long enough (LDG run × 1.3), into wind — then a glide approach with the glider circuit (M, needs F.2, §3.2); (2) the bounce: a touchdown with `vs < -2` and a rebound above 0.5 m re-enters the hold-off (not ROLLOUT) once, then goes around (S); (3) the gust: Vref's gust factor (B.3) + a sink-rate guard on short final (S); (4) the clean rejection when the plan's runway record is unusable for THIS machine (length < TORun × 1.25, surface not allowed, obstacle gradient > the climb) — said before the roll, on the record (S, needs A, F.1). |
| SIZE | M |
| NEEDS | A, F. |

### I. The pilot as a person — stats and sliders

| | |
|---|---|
| TODAY | `PILOT_STYLES`: three presets over 10 margins. The pilot reads `sim.cgPos/cgVel/axes` — the truth. |
| TARGET | A hirable pilot with stats; the best one first; then small mistakes, then big ones, through sliders. |
| GAP | A **PILOT PROFILE** record and TWO mechanisms the stats drive: (1) a **PERCEPTION layer** — the pilot reads instruments through it: altitude and speed with a lag and a noise (attention), a heading with a bias (compass skill), height-above-ground judged, not measured, below 10 m (the flare is judged by eye: a stat), the wind estimated from drift (a stat) — so the servos stay exact and the errors are the pilot's; (2) a **DECISION layer** — margins (`ST.*` today), reaction delays on phase changes (0.3-2 s), the reject fraction, the go-around threshold, the technique CHOICE (a low-stat pilot lands a soft field like a hard one, forgets the flap, rounds out high), the plan's quality (a low-stat planner picks the nearer end, not the into-wind one). Stats: `precision, judgment, knowledge[class], surfaces{short,soft,water,obstacle}, discipline, nerve (go-around readiness), reaction, fatigue` — each 0-1, the best pilot all 1 = today's servos with no perception noise and every technique known. The sliders are the stats. An error LOG per flight (what it misjudged, by how much) is the game's scoring input. |
| SIZE | L (the layers S each; the mapping and its tuning is the work) |
| NEEDS | P0-P3 first: an error model needs a correct model to subtract from. |

### J. The test bed

| | |
|---|---|
| TODAY | GATE PILOT (12 cases, HOME, calm + along-strip wind), ARCHETYPES (19 calm circuits, 60 min), HOTHIGH; a scratch trace runner and summariser that found every G381 defect. |
| TARGET | A pilot regression MATRIX: machines × runways × weather × profiles, with per-run metrics (sink, V/Vs at touchdown, pastAim, off-centre, max heading swing, run, time, go-arounds, verdicts) and thresholds per cell, runnable in minutes for a subset and overnight for the whole. |
| GAP | `tools/pilot_trace.js` (the scratch runner made a tool: any archetype or saved build, any aerodrome, any weather, any style/profile, a CSV + a JSON summary) and `tools/pilot_matrix.js` (the cells, the thresholds, a report), the GATE on a chosen subset (crosswind touchdown, a 340 m strip, a 4 % slope, a bumpy strip, water). This is P0's first deliverable because every later phase is measured on it. |
| SIZE | S-M |
| NEEDS | the fixtures: a sloped strip and a rough strip in the world (or on a plateau copy, as HOTHIGH does). |

---

## 3. THE DATA THE PILOT ASKS FOR (the contract, from the pilot's side)

3.1 **Runway record** (PREMISES-CONTRACT §1.2 `runways[]`, mostly there): `profile [[t, y]]` — keep;
add `thr: [d0, d1]` (displaced thresholds, m from each end, default 5 as painted), `tdz: [f0, f1]`
(touchdown fraction per direction, default 0.20), `lights: { edge, papi: [k0, k1] }`, `kind:
'strip' | 'water'`, and `allow: { classes, maxMass }` when a strip is closed to a class.

3.2 **An obstacle API on the world** (WORLD-CONTRACT): `world.canopyH(x, z)` — the top of the
vegetation at (x, z), 0 in the clear — from the tree pack's placement and species heights
(`treesNear` + the species' canopy formula already used for shading). The runway model's
`obstacle(k)` and the forced-landing field search are built on `terrainH + canopyH`. Buildings
join it through the premises' footprints and heights (they publish both).

3.3 **An approach protocol record** per runway and direction (new, small):
```js
protocol: { join: 'overhead'|'45'|'straight'|'downwind', side: 'L'|'R', hC: 300,
            gs: 0.052, faf: 2500, gaTrack: { hdg, hTurn }, noise: null | { avoid: [x, z, r] },
            night: false }
```
Absent → the pilot derives every field from the runway model (obstacles → gs; terrain → side).

3.4 **A waterway record** (E): `{ id, kind: 'water', poly: [[x, z]...], shore: [...], dock: {x, z,
hdg} | null, beach: ... | null, shelter: 0..1 }`.

3.5 **The certificate as data** (F.1): `plaque.js` publishes the machine sheet the bench measured;
the pilot reads it from the build, the shakedown as the fallback.

3.6 **Wheel speed** (D.3): `sim.wheelSpeed()` — per wheel, ground contact and ground velocity.

---

## 4. THE ROADMAP — phases, each measured on the matrix

| Phase | What lands | Size | Unblocks |
|---|---|---|---|
| **P0 — THE INSTRUMENT AND THE GROUND** | `pilot_trace` + `pilot_matrix` tools (J); the runway model (A) reading `profile`; flare / screen / balk on `aglT` and the last 300 m on the profile (B.1); gradient + surface in the accelerate-stop and the taxi governor (C.1, D.1-2); the bump debounce (D.4); GATE PILOT gains a crosswind touchdown, a 4 % slope and a 340 m strip. | M | everything |
| **P1 — THE APPROACH FROM DATA** | the approach plan (B.2) with obstacles (A) and the gust factor (B.3); short / soft / slope techniques (B.4-6, C.4); the obstacle-clearance climb (C.3) and the direction choice (C.2); the protocol record (§3.3) with circuit joins (G.4); the pre-roll rejection on the record (H.4). | M-L | G, H, I |
| **P2 — THE MACHINE** | the pilot flies the plaque (F.1); the glider circuit (F.2); the electric's energy (F.4); the bounce recovery (H.2); wheel-speed feedback and the stand stop (D.3, D.5). | M | E, H.1 |
| **P3 — ROUTES AND WATER** | terrain routing + legs with altitudes (G.1-2); energy/time and diversions (G.3); the forced landing (H.1); WATER H4 on the waterway record (E), after the peer's H2/H3. | L | I |
| **P4 — THE PERSON** | the pilot profile, the perception layer, the decision layer, the error log (I); the hiring UI reads the profile; the matrix runs the profiles. | L | the game's scoring |
| **P5 — THE REST** | the twin's engine-out (F.3); traffic and a fouled strip; night. | later | — |

**The order's logic.** P0 is the instrument (nothing in P1-P4 can be judged without the matrix) and
the two assumptions that break first on the editor's strips (a flat datum, a level grass run). P1 is
where the runway's metadata is CONSUMED — the brief's "adapt its behaviour according to the runway
type and length". P2 makes the pilot read the aeroplane the way it reads the runway. P3 is the
autonomy. P4 is the game: the best pilot exists by then, and the stats subtract from it.

---

## 5. RULINGS OWED (the user's)

1. Does a stat degrade PERCEPTION (the pilot misreads), DECISION (the pilot misjudges), or both?
   (§2.I proposes both, with the servos never touched.)
2. Are the techniques (short / soft / wheel / three-point) chosen by the pilot from the record, or
   set by the player in the flight brief with the pilot judging whether it can? (The brief's "clever
   and reactive" reads as the former, with the player able to override.)
3. Where does the approach protocol live — on the runway record (the editor writes it) or on the
   aerodrome's site (the premises writes it)? §3.3 assumes the runway.
4. The forced landing's field search over the vegetation: is the canopy API the world's (§3.2), or
   does the tree pack publish a coarse "clear ground" mask?

---

## 6. THE CRITIQUE — against real autopilots, the literature, and sim AI

The user (2026-09-14): *"how do we do against real autopilots, and real literature? And real sim AI
pilots? Let's criticize our approach, and also ensure that we have great principles, so we should not
code exceptions and specifics all the time."* Written before P0 is started, because the honest answer
changes P0.

### 6.1 What the real things are made of

**A certified autopilot / autoland** (Boeing, Airbus, Garmin GFC + Autoland 2019) is three separate
things, and the separation is the whole point:
- **Guidance** produces a REFERENCE TRAJECTORY from data: a localizer/glidepath (or an FMS path of
  legs with altitudes and speeds), a flare law, a rollout centreline. The flare is not a phase with a
  pitch schedule: it is the trajectory `h_dot_cmd = -(h + h0)/tau` from the radio altimeter — an
  exponential that never reaches zero sink, with the throttle retarded at a fixed height. Rollout is
  the localizer flown with rudder and nosewheel, gains scheduled on ground speed; decrab at ~5 ft.
- **Control** tracks the reference. The longitudinal reference is tracked by ONE law in every phase:
  in the airliners a speed/path law with pitch and thrust coupled; in the research and open-source
  world, **TECS** — Total Energy Control System (Lambregts, AIAA 1983): the throttle commands the
  total energy rate (kinetic + potential), the elevator commands the energy DISTRIBUTION between
  speed and height. One controller for climb, level, descent, approach; speed-on-pitch versus
  speed-on-throttle is not a mode switch but a weighting; when one effector saturates the other
  carries the demand by construction. The lateral reference is tracked by one law too — **L1 / NLGL**
  (Park, Deyst, How, AIAA GNC 2004): a look-ahead point on the path at distance L1, the lateral
  acceleration `2 V^2 / L1 * sin(eta)`; it follows straight lines and arcs with the same equation, so
  turn anticipation is a property of the path, not a heuristic. ArduPilot and PX4 fly TECS + L1 (and
  its successor NPFG), documented and open, with the TECS limits (max climb, min sink, cruise
  throttle) taken from the airframe's MEASURED performance.
- **Management** (the FMS, Garmin Autoland's runway selection) decides: it holds the performance
  database (V-speeds, runs, climb gradients by weight and density altitude), the procedure database
  (approaches, missed approaches, patterns), and scores runways (length, surface, weather, distance,
  terrain, fuel) — then hands guidance a path. It never touches a gain.

**Paths** in that world are geometric objects: Dubins paths (1957) — turn / straight / turn at the
aeroplane's own radius — are how a fly-by and a fly-over are PLANNED; the follower then needs no
"anticipation distance" of its own.

**The human pilot in the literature** is a model, and a simple one: McRuer's crossover model (1974)
— the pilot is a gain, a pure time delay (0.2-0.5 s) and a neuromuscular lag, plus a "remnant" noise;
Hess's structural model adds the inner proprioceptive loop. Skill = gain adaptation speed, delay,
remnant. Nobody models a worse pilot by changing the aeroplane's control law.

**Sim AI.** X-Plane's and MSFS's AI traffic fly canned procedures on scripted flight plans; they are
not a benchmark. DCS and IL-2 degrade their AI by skill level through reaction time, aiming noise
and decision aggressiveness — the same three knobs as the human-pilot model, and the proven way to
make "worse" feel human rather than broken. FlightGear's route manager is an FMS whose fly-by
overshoots corners the way our pursuit did before G381.

### 6.2 Where we stand — the honest score

| Area | Real practice | Ours | Verdict |
|---|---|---|---|
| Longitudinal control | ONE law (TECS or coupled speed/path) | FIVE modes (ALT/VS/FLC/GS/PITCH) with their own gains, the throttle a sixth (SPD), and now a POWER ASSIST patching the saturation TECS handles by design | **the structural gap**; G381.1's assist, G208.3's LIFTOFF cap, the FLC/ALT switching in `altMode`, the level latch, the flare's own P+I are all exceptions the one law would not need |
| Lateral control | one path-following law (L1) over lines and arcs | pursuit + a runtime ARC mode + an anticipation formula (`navLeg`'s `ant`, G381's `arcInto/arcFly`) | works (4-22 m joins) but is two laws and a switch; L1 over a Dubins path is one |
| The flare | `h_dot_cmd = -(h+h0)/tau` off the radio altimeter | `h_dot_cmd = -max(0.35, agl/tau)` (G381) — the same law | **right**; the pitch tracker under it is ad hoc and the datum is flat (P0 fixes the datum) |
| Rollout | localizer + rudder/nosewheel, gains on ground speed | RWY + `groundSteer` scheduled on (VTailUp/V)^2 or (VSteer/V)^2 | right in kind; two schedules where one (dynamic pressure) would do |
| Decrab | ~5 ft, rudder to align, wing down into wind | 3.5 m, `-K e`, wing-low bias on the ground | right (after the G381 sign fix) |
| Runway selection / suitability | Autoland scores length, surface, weather, terrain, distance | `dirAt` (wind, else the run ahead), a length clamp on `xAim`, nothing on surface or obstacles | the planner of §2.A / §2.H.4 is exactly Autoland's scorer |
| Performance data | a database by weight and density altitude | genAP constants + `genTuneAP`'s dimensionless fits; the plaque exists and is not read | §2.F.1 — and the shakedown already measures what TECS needs: max climb rate, best L/D, `gammaClimb`, `VsFlap` |
| Phase logic | few phases; bounded; a missed-approach PROCEDURE from data | many phases, each bounded (G202 rule 6 — good), the go-around a fixed climb-then-circuit | keep the bounding; make the missed approach a path |
| Pilot degradation | delay + gain + remnant (McRuer); sims: reaction, accuracy, aggressiveness | three presets over margins | §2.I is the literature's answer; nothing built yet |
| Perception | a sensor model / air data / radio altimeter | the sim's truth | §2.I; and a WIND ESTIMATE from drift is missing (real FMS derive wind from GS/TAS/track/heading — the NAV has all four) |
| Test | flight-test matrices by configuration and weather | 12 cases + 19 calm circuits | §2.J |

The score in one line: **the guidance ideas are right (the flare law, the arc, the schedules, the
bounded phases), the control layer is where the exceptions have been accreting, and the management
layer does not exist yet.** Every one of the seven G381 / G381.1 tunings was a patch on a symptom
that a single energy law and a single path law would not have shown.

### 6.3 The principles — so that specifics stop being coded

1. **One law per axis, every phase.** Longitudinal: TECS (throttle = total energy rate, elevator =
   energy distribution; limits from the plaque: max climb, min sink, cruise throttle, Vs, Vne).
   Lateral: L1 over a path of lines and arcs. A phase never carries a gain; it carries a REFERENCE
   (a path, a speed, a height or an energy rate) and a weighting.
2. **Everything is a trajectory.** Climb, level, slope, flare, go-around, the taxi lane, the water
   run: each is a reference the same tracker follows. The flare is `-(h+h0)/tau` on the terrain
   datum; the slope is a line in (s, h); the climb is an energy rate. "Modes" are references.
3. **Plans are geometry, planned once.** The planner emits Dubins paths at the aeroplane's own radius
   at the planned speed and bank — the fly-by is in the path, and the follower has no anticipation
   logic. A pattern, a taxi route, a missed approach and a circuit join are all paths from records.
4. **Saturation is handled by the law, not by a patch.** TECS moves the demand to the effector that
   has room; the assist, the caps and the "hold the arrival attitude until 1.15 VRot" rules go.
   Where an effector genuinely cannot (the drawn-tail Caravan), the PLANNER sees it in the plaque
   (elevator authority at idle -> Vref up, or "carry power" as a technique parameter) before the roll.
5. **The machine is a sheet of measured numbers, and the sheet is the only source.** Vs, Vs-flap,
   Vref = 1.3 Vs0, Vx, Vy, Va, max climb, min sink, L/D, TORun, LDG run, elevator authority at idle,
   crosswind limit — measured on the bench (the plaque), the same for a Cub and a flying boat. No
   per-class constants in the pilot; a class differs by what its sheet says and which effectors it
   has (throttle / spoiler / water rudder / a second engine).
6. **Techniques are parameter sets, not code paths.** Short, soft, wheel, three-point, glassy water:
   `{aim, VrefK, flap, brake, noseAttitudeOnRoll, powerInFlare, touchdownSink}` chosen by the
   planner from the runway record, the sheet and the weather; the tracker does not know which
   technique it is flying.
7. **Gains schedule on physics, not on phase.** Dynamic pressure for every aerodynamic loop, ground
   speed and the steering wheel's load for the ground loops. The tail-up / tail-down / trike split of
   `groundSteer` becomes one schedule on the wheel that steers.
8. **Dimensionless, fleet-measured, gated** — genTuneAP's doctrine stands: no constant without a
   ratio that clusters across the archetypes, and no change without the matrix.
9. **The person is a filter, never a gain.** Degradation = delay + remnant noise on PERCEPTION, and
   thresholds + choices on DECISION (McRuer / DCS). The control laws are the same for every pilot.
10. **Decisions are scored, not branched.** Runway and direction choice, the forced-landing field,
    the diversion: one scoring function over the records (length margin, surface, wind, gradient,
    obstacles, distance, energy), with the stats as weights. No `if (short) ... else if (soft) ...`.
11. **Every phase stays bounded** (G202 rule 6) — the one rule of the current pilot the real ones
    do not have and we keep: a timeout and a fallback each, said on the record.

### 6.4 What this does to the roadmap

P0 gains a chantier before the techniques are added, or every technique of P1 becomes another
exception on the mode zoo: **the control layer rebuilt on TECS + L1 over Dubins paths, behind a
flag, judged by the matrix.** The order inside P0:

1. The matrix and the trace tool (§2.J) — the judge exists before the change.
2. The machine sheet from the plaque (§2.F.1) — TECS' limits come from it.
3. TECS as `vert: 'TECS'` beside the existing modes; L1 over a path as `lat: 'PATH'`; the planner
   emitting Dubins paths for the circuit; the flare as a TECS reference on `aglT`. The old modes stay
   selectable (as `flareMode: 'ramp'` stayed) until the matrix says the new ones win on every cell,
   then the old ones retire with their exceptions: the assist, the caps, `altMode`'s switching,
   `arcInto/arcFly`, the LIFTOFF cap, the level latch.
4. Only then the datum, the gradient, the surface and the bump debounce — most of which become
   trivial once the references are geometric (the flare on the terrain datum is one line).

The risk, stated: 19 archetypes and 12 cases pass today on the mode zoo; a control rewrite can
regress every one, and TECS has its own tuning surface (ArduPilot's has ~15 parameters, most of them
airframe limits we measure, four of them loop gains we would fit dimensionlessly as genTuneAP does).
That is why it goes behind a flag with the matrix as the judge and the fleet's dimensionless doctrine
for its gains — the same way every servo gain in this pilot was landed.
