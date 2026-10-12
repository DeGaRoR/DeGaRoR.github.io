# GROUND-VEHICLE — the vehicle shell, the boat seam, the road's route (G2940, 2026-10-11)

The physics spike for driveable vehicles, **node only** (no page, no bundle). The user's MVP (11 Oct 2026),
the target this prepares:

> "a long drive on the road I have traced and back, the ability to set a new destination (like the autopilot's
> in-flight re-routing - use the same thing), chase view, single vehicle, acceptable physics, NO manual
> take-over, the ability to U-turn properly for manoeuvres. A solid base for ground vehicles. All of this will be
> applied to BOATS at some point. Roadside aprons (gravel pull-outs) where vehicles can U-turn or stop, like runway
> aprons."

Not a car sim: scenic cruising. What landed:

| file | what |
|---|---|
| `src/vehicle/vehicle.js` | THE SHELL: `vehicleDef(sheet, tune)` (a data sheet -> the generic vehicle), `makeVehicle(def, world)` (the rigid chassis + its providers), `VEH_TUNES`, `VEH_SURF` |
| `src/vehicle/vehicle_drive.js` | THE DRIVER: the road sampler (`vehPath`), the follower (`vehSteer`), the governor (`vehSpeedTarget`, `vehProfile`), the pedals (`vehPedals`), the U-turn planner (`vehUturnPlan`), the road graph (`vehRoadGraph`) and `makeDriver(car, graph)` with `setDest` |
| `src/cars/car_conquer.json` | car #1's data sheet in `tools/car_prep.py`'s schema (see §1.3: authored, not yet measured) |
| `tools/_vehicle_check.js` | GATE VEHICLE (core tier, ~13 s): the acceptance list, §6 |

`src/vehicle/` is **not** in `tools/build.js` `MANIFEST.core`: the aeroplane's core, its body hash, the page and
every aircraft gate are untouched by construction (GATE VEHICLE's BITS row holds it). The integration lands the
two files as `45_vehicle.js` / `45b_vehicle_drive.js` (§8).

---

## 1. The vehicle shell

### 1.1 Why not makeSim

The aeroplane's solver (`30_solver.js`) is a node-beam airframe whose ground pass is an aeroplane's gear: the
wheels on `refs.mains` and one `refs.tw` roll freely, the ONLY steering is the tailwheel's (`twSteer * ctl.dr`),
the brakes are on the mains, and the only propulsion is the propeller. No wheel is driven, nothing steers at the
front, there is no reverse, no suspension travel (a tyre is a penalty spring under a node), and the rolling
coefficient below 0.5 m/s is a placement damper (G121.3). A car through that pass means `if car` checks in the
hottest loop the fleet's anchored gates fly. So the car is a **shell of its own** beside it.

### 1.2 The model

One **rigid chassis** (six degrees of freedom: the limit of a stiff cluster, no beams) and **providers** that put
forces on it, at 240 Hz (4 substeps a 60 Hz frame; 0.43 ms a frame on the world's terrain):

- **`wheels` (contact).** Each wheel casts its strut down the chassis' -up axis onto the terrain's PLANE under it
  (`world.terrainH` + its normal by finite differences, 0.35 m). The compression gives a spring + damper load `Fn`
  (each corner's rate from the static load and a ride frequency: 1.35 Hz front, 1.55 Hz rear, zeta 0.38; a bump
  stop), pushed along the terrain normal at the contact point - **a slope is felt through the normal**, and the
  tyre's frame (rolling direction, side) lies in the ground's plane. The springs are sized so the static car
  stands exactly at the sheet's wheel centres (the mesh's wheels where the physics' are).
- **`wheels` (propulsion).** A power curve at the wheels: forward `min(F0, P / v)` (7.2 kN, 80 kW for the
  Conquer), REVERSE a geared ramp fading to 0 at `vRev` (8 m/s), the engine's drag with the throttle closed
  (never a hold). Shared over the DRIVEN wheels that touch the ground, each share capped at `tc x mu x Fn`
  (traction control): **an airborne driven wheel delivers nothing**, its share is lost (an open differential's
  honest half).
- **The tyres** - sequential impulses on the stepped velocities (Catto's velocity-level contacts, 8 iterations):
  along the wheel, rolling resistance + the brake as a friction capped at `(crr Fn + brake)` - so **a braked car
  holds on a grade** (0.1 mm in 10 s on 10 %) instead of creeping; across it a SOFT constraint whose compliance is
  `|v| / (C_alpha Fn)` - at speed the linear tyre `F = C_alpha Fn alpha`, parked a rigid no-slip; both inside
  the **friction ellipse** `mu Fn` with the drive. The brake is ABS-capped at 0.85 mu Fn, so a braking car still
  steers; at the limit it understeers mildly.
- **`proxy` (contact).** The sheet's two collision boxes' corners as penalty contacts with friction: an overturned
  or bottomed car scrapes, it does not sink. GATE VEHICLE's LONG row counts their frames (0 on the drive).
- **The air.** `0.5 rho CdA v^2` (CdA 1.25 m^2).
- **Ackermann steering.** The driver asks a BICYCLE angle (the rear axle's centre turns on `R = wb / tan delta`);
  each steered wheel takes its own angle round that centre (`ackermann` 1 = full). The lock is set by the inner
  wheel's (35 deg -> the bicycle's 31 deg, R 5.0 m, 13.0 m kerb to kerb). The steering slews at 0.75 rad/s.
- **Surfaces.** `VEH_SURF` keys the world's SURFACE enum with a TYRE's `[mu, crr]` (the aeroplane's GROUND_SURF
  rows are a light aircraft's tyres on the calibration lawn - crr 0.05 - and not a car's): PAVED 0.9 / 0.013,
  GRAVEL 0.65 / 0.02, GRASS 0.55 / 0.035, WATER 0.1 / 0.2 ...

Frames: the world's (x, y up, z); the chassis +x forward, y up, +z right - the data sheet's. `hdg = atan2(fwd.z,
fwd.x)`; a positive steer and a positive path curvature (39_ground_path.js's `kap`) are both a turn to the RIGHT.

### 1.3 The definition: a sheet + a tune

`vehicleDef(sheet, tune)`:

- **the sheet** is geometry + mass (`src/cars/car_<key>.json`, `tools/car_prep.py`'s schema, measured off the asset):
  `wheels{FL,FR,RL,RR}.centre/radius/width`, `wheelbase`, `track`, `ground`, `collision.boxes`, `box`,
  `estimates.{mass_kg, cg, inertia_kgm2, cameras}`. The shell reads ONLY these fields.
- **the tune** (`VEH_TUNES[key]`) is what the sheet does not measure: the drive (which wheels, P, F0, Frev, vRev),
  the brakes (force, front share, ABS, the hand brake's wheels), the steering (which wheels, the inner lock,
  Ackermann, rate), the springs, the tyre (C_alpha), the air. A re-bake never loses a tuning.
- the result is generic: `{ kind: 'ground', mass, I, cg, wheels: [{ at, r, steer, drive, brake, hand, k, c, ... }],
  contacts: ['wheels', 'proxy'], propulsion: 'wheels', steer: { dMax, xRef }, rMin, foot }` - N wheels with role
  flags; a six-wheeler, a rear-steered forklift (the steer flag on the rear, `xRef` the front axle) or a 4x4
  (`drive.wheels` all four) is a sheet and a tune, not code.

**car_conquer.json is AUTHORED, not measured.** ASSETS-OCT G2908 committed `tools/car_prep.py` but not the sheet
it writes (the asset is local), and `reports/CAR-FEASIBILITY-STUDY-2026-10-02.md` is in no branch of the repo.
The sheet carries the brief's numbers (wheelbase 3.01 m, track 1.41 m, wheel radius 0.35 m, ~1 850 kg) and the
estimates' formulae from car_prep.py (56 % front, CG 0.72 m up, a uniform box's inertia), the frame's origin
between the axles on the ground, a placeholder body box (5.1 x 1.76 x 1.78 m) and lamps. Its `authored` field
says so. Running `python tools/car_prep.py` on the asset overwrites it field for field; GATE VEHICLE's DEF row
pins wheelbase / track / radius / mass and will tell if the measured sheet moves them.

### 1.4 The API

```js
const car = makeVehicle(vehicleDef(sheet), world);   // world: { terrainH(x, z), surface?(x, z) }
car.place(x, z, hdg);            // stood on the terrain's plane, springs at their static length
car.ctl = { thr, brake, steer /* -1..1 of dMax, + right */, gear /* 1 D, -1 R, 0 N */, hand };
car.step(1 / 60);                // 4 substeps
car.out    // u (forward speed, signed), V, hdg, onGround, driveOn, Fdrive, aLong, aLat, delta, proxyHit
car.wheels // per wheel: s (strut), delta (its steer), spin (rad - the renderer's), on, Fn, Fd, slipT
car.toWorld(pBody); car.refPoint() /* the rear axle's centre */; car.axes(); car.footprint(); car.snap() / unsnap()
```

The chase view reads `sheet.estimates.cameras.chase` (body frame) through `car.toWorld`, smoothed in the page.

---

## 2. The boat seam

The shell is a rigid body plus providers; a boat swaps the providers, not the shell:

| seam | car (today) | boat (later) |
|---|---|---|
| `def.contacts` | `'wheels'` (struts on `terrainH`), `'proxy'` (the body's boxes) | `'hull'`: buoyancy + hydrodynamic drag over the hull's panels/points on `world.waterH(x, z, t)` (the sea state the floats already read, 32_hydro.js's panel law the reference), `'proxy'` for a grounding on `terrainH` |
| `def.propulsion` | `'wheels'`: the power curve through the driven, contacted wheels | `'thrust'`: a propeller at a point along the keel (the same power curve; reverse = astern), cavitation/ventilation when the point leaves the water (the aeroplane's `drown` test inverted) |
| steering | Ackermann on the steered wheels: a curvature is kinematic (`tan delta / wb`) | a rudder: a side force in the propeller's wash and the flow; curvature is NOT kinematic - the follower asks a YAW RATE `r = kap u` and a rate loop sets the rudder |
| the driver | `vehSteer`: `delta = atan(wb kap_cmd)` | the same law up to `kap_cmd`, then `r_cmd = kap_cmd u` -> rudder (PI on the measured yaw rate) |
| the U-turn | the planner's families (two/three-point, reverse) on road + apron | a turning circle in the navigable water (a forward-only `loop` family; the corridor = the water's polygon minus a depth margin); astern for a harbour |
| the graph | roads + aprons + stops | water lanes + pontoons/moorings (the seaplane's lanes, 25_airfield.js, are the first data) |

What must not change for the boat: `makeVehicle`'s integrator, `ctl`, `out`, `snap`, the driver's state machine
and `setDest`. A provider is today a block in `substep` (explicit forces, then the tyre impulses); the integration
pass turns each into `{ forces(S, R, dt), solve?(S, it) }` registered by `def.contacts` / `def.propulsion` - kept
inline for the spike so its numbers are read in one place.

---

## 3. The route and the destination: the flight's To, on the road

The user: "the ability to set a new destination (like the autopilot's in-flight re-routing - use the same thing)".
`makeDriver(car, graph).setDest(to)` IS the flight's To (38b_dest.js, 43_pilot.js `ap.setDest`):

- ONE To (a place id: an apron or a stop); the From is derived (where the vehicle is on the graph), never chosen;
- a new To is re-planned FROM HERE: `route(to)` locates the vehicle on the graph (its edge, the node ahead along
  its heading) and takes the cheaper of **straight on** (Dijkstra from the node ahead, the vehicle's own edge
  blocked - no U-turn on the road itself) and **a U-turn at an apron ahead** (the distance to it + 80 m for the
  turn + Dijkstra back from it, the far side blocked);
- the answer words are the autopilot's: `'replan'` (re-planned from here), `'uturn'` (the new To is behind:
  re-routed through an apron), `'queued'` (a manoeuvre is running: planned when it ends - the flight's FLARE /
  ROLLOUT), `'same'`, `'none'`;
- the UI is the flight's To picker (`flightToChoices` -> the graph's places), the same row in the same panel.
  NO manual take-over (MVP): the pedals and the wheel are the driver's.

Phases: `IDLE -> DRIVE (road legs) -> [MANOEUVRE (the U-turn's moves)] -> DRIVE -> ARRIVED`, plus `rejoin`
(more than 5 m off the road: planned again from here - the flight's planFromHere) and `STUCK` (20 s on the
throttle, not moving).

The FOLLOWER is the taxi follower's law (43_pilot.js TAXI: the path's curvature fed forward, the cross-track and
the heading error trimmed), retuned for a FRONT-steered car: the tracked point is the **rear axle's centre** (the
unsteered axle - its path's curvature is exactly `tan(delta) / wb`, forward and reversing alike), and

    kap_cmd = kap(s + 0.15 s of travel) - ey / L^2 - 2 zeta sin(e_psi) / L,   L = 2 m + 0.4 s x u (<= 25 m)
    delta   = atan(wb kap_cmd)   (forward)   |   atan(-wb kap_cmd)   (reversing: kap_travel = -tan(delta) / wb)

i.e. `e'' + (2 zeta / L) e' + e / L^2 = 0` per metre run: the same settling distance at any speed, the lookahead
speed-scaled. Tuned on the 300 m road (a longer preview / lookahead cut the curve's entry: 0.54 m off at
L = 3 + 0.9 s; 0.27 m at the values above). The SPEED is the road's: the cruise, each sample ahead within the
braking distance at 2.2 m/s^2 lateral, the road's PROFILE at 2.0 m/s^2 vertical (`vehProfile`: the ground's
curvature along the path - a crest, a dip, a ford), the stop at the end; the profile's deceleration is fed forward
to the pedals (the stop lands within 0.05 m) and the grade, the rolling and the air are fed forward to the
throttle (the hill start rolls back 0 mm).

---

## 4. The path traps (and why the road has its own sampler)

`39_ground_path.js` is the aeroplane's, and stays bit-identical. Its shape is reused (samples `{ x, z, hdg, kap,
s }`, `kap` toward increasing atan2, fillets, a `from` join), its sampler is not, for two reasons GATE VEHICLE's
TRAPS row measures:

1. **The 2-degree dots.** patternPath treats a vertex that bends less than 2 deg as a drawn dot and runs STRAIGHT
   from corner to corner. A traced road (SCENERY-ED-1's C2 spline, dense vertices) bends about a degree a vertex
   all round a gentle curve - so patternPath sees no corner at all and draws the CHORD: on an R 150 m curve at
   2.5 m vertices it strays **62.9 m** off the road with zero curvature. `vehPath` fillets every vertex with its
   tangent clamped to half its legs - on a dense spline that gives back the spline's own radius (0.002 m off).
2. **GP_MAXPTS (4 000).** A path past 4 000 samples is RESAMPLED coarser (review C: never cut short). The world's
   road 3 (9.65 km) as one path: 3 196 samples at **3.02 m**; a 40 km route at 10 m, the fillets then 2-3 samples
   and the look-ahead heading stepping sample to sample. The fix: the driver samples a WINDOW of the leg (1 500 m
   at 1 m) and re-samples it as it runs out (400 m left) - **from the vertex BEFORE the segment the vehicle is
   on**, so the corners it shares with the window before are drawn the same and the path under the wheels does not
   move (the first cut re-planned from the vehicle's own pose with a join: a 36 deg heading step in the middle of
   a 90 deg corner spun the pickup off the world's road 0). The LONG row runs 5 windows on 5 km.

Also: a road corner's fillet is cut to the ROAD'S WIDTH (`w`): the arc's middle is `r (1/cos(th/2) - 1)` inside
the vertex, kept under `w/2 - 1.3 m` and never tighter than 1.15 x the vehicle's own turn. The world's settlement
roads turn 45 and 90 deg at single vertices: the default 60 m fillet put the wheels 4.6 m and 9 m inside them, off
the 4.5 m graded bed, airborne over its feathered shoulder.

pathLocate's monotonic window (+60 samples) and pathLook's 8 m look-ahead cap are the aeroplane's taxi constants;
`vehLocate` interpolates on the segment (+120), `vehSteer` scales to 25 m. A later unification can give
patternPath a `mode: 'road'` whose default is today's bits; not in a spike.

---

## 5. Roadside aprons and the road graph (SCENERY-ED-2: the data shape)

The ROAD-GRAPH G-block is SCENERY-ED-2's. What the vehicle needs from it, as `vehRoadGraph(spec)` reads it today:

```js
{ roads:  [{ id, pts: [[x, z], ...] /* the traced centreline, dense is fine */, w /* m */, r? /* the fillet a corner
             wants */, surface? }],
  places: [{ id, name, road /* index */, s /* m along its drawn direction */, kind: 'apron' | 'stop',
             side /* +1 right of the drawn direction, -1 left */, len, depth /* m, from the road's edge */ }] }
```

`pts` is the COMPOSED centreline - for a traced road with `curve` (SCENERY-ED-1's C2 spline) the spline's own
samples, not its clicked points: three clicks with 400 m legs are a 300 m-radius curve as drawn (GATE PREMISES 19),
and `vehPath` would fillet the bare points at its 60 m default. Roads meet where their vertices coincide (0.5 m). A place is a node of the graph (inserted at `s`); every place is
a destination; an APRON is also where a vehicle may U-turn or stop. The planner takes, per apron, the straight road
either side of it (`ahead` / `back`: within 0.3 m of the tangent, measured off `pts`) as its corridor - so:

- **put aprons on straight stretches** (>= 20-30 m straight both ways);
- **size them for the vehicle** - this pickup (13 m kerb-to-kerb), at a 0.25 m margin, the planner finds:

  | road width | apron depth needed | the move |
  |---|---|---|
  | 3 m (single track) | 8.5 m | nose-in (forward in, reverse out steering away) |
  | 4 m | 7.5 m | back-in (past it, reverse in, drive out the other way) |
  | 5 m | 5.0 m | back-in |
  | 6 m | 4.5 m | back-in |
  | 7 m | 4.0 m | back-in |

  (any length >= 14 m; back-in swings the 3.86 m front over the far edge - 0.4 m past a 3 m road's edge at any
  radius - so the narrow road's turn goes in nose first);
- **grade them flat and class them GRAVEL** like the road bed (world.surface inside the rectangle) - a pull-out on
  the feathered shoulder is driven, but on its slope;
- the apron is drawn as a rectangle beside the road today (`len` x `depth`); tapered entries are a planner
  refinement (the corridor test takes any `inside(X, Z)`).

Runway aprons (the user's comparison) are the same idea on the aerodrome's pattern graph: a node where the vehicle
may turn and stop.

---

## 6. The acceptance list (GATE VEHICLE, measured)

| row | what | measured |
|---|---|---|
| DEF | the sheet -> the definition, parked on the flat | wb 3.01, track 1.41, r 0.35, 1 850 kg, 56.0 % front; R 5.00 m; 0.000 mm in 2 s |
| ACCEL | 0-100 km/h; 40 s of full throttle | 11.9 s; 150 km/h |
| COAST | throttle closed from 25 m/s | 0.55 m/s^2 |
| BRAKE | full brake from 100 km/h | 47.7 m, 3.5 s (0.81 g), straight |
| REVERSE | full throttle in reverse | 7.4 m/s (the gear's 8) |
| AIRBORNE | dropped at full throttle; the driven axle over a ledge | 0 N of drive, 0 mm/s gained; 0 N (the fronts on the ground) |
| TURN | full lock both ways | 12.99 m kerb to kerb both sides; rear axle 4.99 m (kinematic 5.00); inner 35.0 / outer 27.8 deg |
| HILL | 10 % grade | parked 0.1 mm in 10 s; released it rolls (0.85 m/s after 1 s); hill start 0 mm back, 5 m/s in 2.5 s; down from 15 m/s stopped in 16.7 m, held 1.2 mm in 10 s |
| ROAD | a 300 m traced road (2.5 m vertices, R 60 and R 40) | cross-track 0.27 m max, 0.14 m rms; stopped 0.05 m from the end |
| UTURN | re-routed back mid-road: a U-turn at a gravel apron | 3 m road + 9 m apron: nose-in, 2 moves; 6 m road + 5 m apron on the left: back-in, 2 moves; the body never outside road + apron; home facing 180.0 deg, 0.04 m off |
| LONG | the MVP's drive on the world's road 0 (graded, gravel) | 5.0 km: out, a new To behind -> U-turn at MID, home, out again -> U-turn at HOME, to END; 5 windows; 0.27 m max, 0.04 m rms; at END 0.04 m; body on the ground 0 frames |
| FORD | the world's road 0 across its stream (§7) | crossed at 6.5 m/s, no contact (or STUCK said, never silent) |
| TRAPS | §4 | patternPath 62.9 m off a gentle traced curve; road 3 at 3.02 m |
| BITS | the aeroplane untouched | not in MANIFEST.core; flight_core fresh |

The aircraft gates (PILOT, TAKEOFF, GEN, SIMWORKER, GE, the DMG core set) run on this branch with `src/core`
unchanged: the HANDOVER block lists them.

---

## 7. Findings for the world

- **The world's roads FORD their streams.** Every road of the analytic world has 2-8 places where the terrain is
  0.5-2.7 m off the road's own grade (`roadNet.roads[i].tgt`) - the hydrology's carve wins over the road's grading
  at a stream. Road 0 at s 2 696 m: a 2.7 m dip 15 m past a 45 deg corner, 0.4 m of water, banks to ~50 %, crossed
  diagonally (a ~25 % side slope). Before the road profile limited the speed, the pickup took it at 12.6 m/s and
  struck its body (approach angle 18 deg); with the limit it crosses from rest 250 m before (GATE VEHICLE FORD: 6.5
  m/s in the water, no contact), but met at the corner's speed it slid 2 m down the bank and stalled on the water's
  tyre row (the driver now says STUCK after 20 s). The LONG row stays before it. Fix in the world: the road's grade
  wins at a crossing (a culvert: the bed filled over the channel) or a bridge (`cls: 'bridge'` exists - road 8).
- **90 deg single-vertex corners** (the world's chevrons) are at the vehicle's own turn on a 7 m road: the
  follower holds 1.2 m there at 3.3 m/s. Traced roads (splines) do not have them.
- **No tree / obstacle collision** in the shell yet: the aeroplane's TREE_HITS + obstacles (29_obstacles.js)
  against the proxy boxes is the integration's (the road corridor keeps the MVP's vehicle off them).

---

## 8. Integration (the next blocks)

1. **The bundle.** `src/vehicle/vehicle.js` -> `src/core/45_vehicle.js`, `vehicle_drive.js` -> `45b_vehicle_drive.js`
   in MANIFEST.core (after 44_), exported in 90_node_exports.js; 63 KB of source (comments included) against GATE MEDIA's
   wire budget (4.05 MiB temporary) - the landing trims or minifies.
   The per-substep arrays (the spike allocates small vectors) become scratch Float64Arrays first.
2. **The page.** A drive mode beside the flight: the car's props (ASSETS-OCT's `car_conquer_*`: the body in
   'mount', the wheels at `car.toWorld(at)` turned by `car.wheels[i].delta` and `spin`, dropped by `s`), the chase
   camera on `estimates.cameras.chase`, the lamps (brake on `ctl.brake`, reverse on `ctl.gear < 0`).
3. **The To picker.** The flight's picker over the graph's places; `driver.setDest(to)`; the status line from
   `driver.log`.
4. **The road graph.** SCENERY-ED-2's traced roads + aprons in the §5 shape; the world's settlement roads
   (`world.roadNet`) as a second source.
5. **The worker.** The physics worker hosts a vehicle like an aeroplane (`snap` / `unsnap` exist).
6. **The boat** (§2): the `hull` and `thrust` providers, the yaw-rate steering, the water graph.
