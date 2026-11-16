# SNOW-MUD FINISH (15 Nov 2026)

A0's brief for the user (Sun 00:50):
1. Visual sinking.
2. Mud flight tests: Cub, C172 (list:50), PC-6.
3. Mud splash on the aeroplane.
4. Particles for all, on the dust's one system.

Rules: a gate per feature, the frame cost said, no world content. The branch is claude/snow-mud-finish, based on master
6a8d705c4 (L40a) with claude/ready/snow-mud (ae0c12609) merged in. That branch rides L40d.

THE MERGE. Master's brake hold (GEN_BRAKES) and the soft layer's drag now share one rolling line. GATE SOFTGROUND's legacy
fixture was re-recorded off master 6a8d705c4's own flight_core in a clean worktree, because L40a moved the ground roll
itself. This merge rolls bit-for-bit as pure L40a on all 16 rolls.

## 1. Visual sinking (GATE SINKVIS)

- The physics contact stays at the hard ground (SNOW-MUD's named cut). The DRAWN aeroplane stands in the layer instead.
- `sim.out.softW` holds `[main 0, main 1, tail 1, tail 2]`, each wheel's own sinkage, on soft frames only, slotted by
  `def.refs` node.
- `groundSinkPose` (00_registry) fits the plane through the contacts:
  - one contact: level;
  - two contacts: through both, level across them;
  - three or more: least squares.
- `groundSinkMatrix` turns that plane into the rigid motion about the CG: a drop, a pitch and a roll. It is checked
  against THREE's own composition to 1e-17.
- app.js `sinkPoseApply` eases it over 0.2 s, holds the slopes to 0.08, and premultiplies `model.grp.matrix` right after
  the solver's basis.
- Off soft ground, once eased back, it costs one compare. On soft ground the fit and the matrix cost 0.45 us a frame.
- SKIS (their contract, 15 Nov): `def.refs.skis[k] = { nodes: [node], w, L, fwd, aft, main, kind, posed }`.
  - A POSED unit is already low by its rut in the solver's own pose (SKIS' moving datum). It enters the fit at nought, so
    it is never sunk twice, and its node's softW is dropped.
  - An unposed unit enters by `out.skiSink[k]`.
  - Without refs.skis, the first shape (`def.parts.ski`) is read.
- Stock Cub at rest on soft mud: mains 4.0 / 4.1 cm, tail 3.9 cm. Every drawn wheel stands its own sinkage within 5 mm.
  With a 12 cm tail and one main at 7 cm, the drawn wheels still match their sinkage (the tilt's sign checked).

## 2. Mud flight tests (GATE MUDFLY, full tier, ~9 min, three child processes)

THE PILOT flies a full circuit from HOME (1100 m). For the mud runs, HOME and everything within 900 m of it is mud, and
the aerodrome record says so too.

Take-off roll (to the wheels leaving) / landing roll (touchdown to the stop):

| aeroplane | grass | firm mud (11) | soft mud (12) |
|---|---|---|---|
| Piper Cub (list:1) | 104 / 95 m | 105 (x1.01) / 104 m | 119 (x1.14) / 79 m |
| Cessna 172 (list:50) | 312 / 228 m | 379 (x1.22) / 194 m | REJECTED at 8 s: the pilot's "will not reach Vr" |
| PC-6 (drafting card, wheels) | 59 / 227 m | 59 / 211 m | 61 / 148 m |

The STUCK LIMITS. No pilot: full power from rest, the heading held, the stick neutral. The run to 0.9 Vs within 60 s and
1100 m, on soft mud with its stiffness k scaled by f:

| aeroplane | f 1 | 0.7 | 0.5 | 0.35 | 0.25 | 0.15 | at rest on soft mud (main, main, third) |
|---|---|---|---|---|---|---|---|
| Cub | 79 m | 92 m | does not move | - | - | - | 3.3, 3.3, 5.6 cm |
| C172 | does not move | - | - | - | - | - | 8.6, 8.7, 15.6 cm |
| PC-6 | 38 m | 39 m | 40 m | 42 m | 46 m | 57 m | 3.4, 3.5, 20.1 cm |

What it says:
- FIRM MUD is every light aeroplane's ground: all three complete, and the C172 needs +22 %.
- SOFT MUD bogs the tricycle: its 0.28 m nose wheel at ~310 kPa sinks 15.6 cm and cannot break out. The pilot rejects
  and stops on the strip, as it must.
- The Cub gets off soft mud at +14 % and is stuck on mud half as stiff.
- The PC-6's turbine power gets off anything here.
- Mud shortens the landing roll: its drag is the brake.

THE FIRST FIT WAS RETUNED HERE. On firm mud of k 3.3e6 Pa/m^0.8 and 6 cm deep, the C172's nose wheel bottomed and it reached
13 m/s in 60 s. Firm mud is now k 1.2e7 and 3 cm deep: the C172's straight run is +36 %, the Cub's +2 %. GATE SOFTGROUND,
SNOWMUDFX and MUDCOAT pass on it. The snow rows are unchanged.

Not covered: the soft-field technique. The pilot keeps no stick back on a soft roll. A stick-back run belongs to the Pilot
session if wanted.

## 3. The mud coat (GATE MUDCOAT)

aeroweather.js `AERO_MUD` + `aeroMudStep` is pure. One number, m (0 clean .. 1 caked), and it is the FLIGHT'S, not the
career's wear.

The law:
- It builds while the mains roll on SURFACE 11 / 12: `kAcc 0.08 x share on mud x min(V, 25) / 10 x (0.4 + min(1, sink / 5 cm)) x (1 - m)`.
- The day's rain washes it: `rain x (1 + V / 30) / 600 s`.
- Water washes it faster: `(0.3 + V / 5) / 25 s`.

`aeroWxSetMud` draws it through the layers that already put mud where a wheel throws it:
- the WHEEL MUD cone (gear legs, the belly and the flap undersides aft of the tyres, the tyres' grooves) at m;
- the BELLY dirt at 0.6 m;
- the depressions at 0.3 m.

These are added over the macros' strengths. At nought it is the old look exactly, and a pinned bench layer wins.

app.js `mudCoatFrame` steps it beside the dust:
- the mains' surface is read only on the ground (two world.surface reads);
- the sinkage is the solver's own;
- the rain is `soilNow.rainNow`;
- water is WC.water or out.hydroWet;
- a new aeroplane starts clean, and the garage draws the build without it.

Numbers:
- The stock Cub's soft-mud take-off run cakes it to 0.57, firm mud 0.22, grass nothing.
- Ten minutes of rain parked: 0.8 -> 0.29.
- A 20 s water run: 0.8 -> 0.13.
- The law costs 0.09 us a frame; the block is refreshed only when the coat moved (>= 0.004).

## 4. Particles for all (GATE SNOWMUDFX: the ski and cost rows)

- Each contact uses its OWN sinkage: a wheel's softW, a ski unit's skiSink.
- A SKI has no tread to shed. Its bow wave runs from its toe (refs.skis fwd) across its width, x W / 0.25 m of a tyre's.
  On powder it ploughs wider with a bigger puff.
- A retracted wheel-ski runs as a tyre.
- The prop's wall jet was already everyone's.
- On powder at a 6 cm sinkage, a 0.45 m ski throws 10062 clumps against a tyre's 5757. On mud at 18 m/s with no sink, a
  ski throws nothing where a wheel throws 28419.

THE COST: one draw, as before. Node, gamer tier:
- a soft-mud take-off: 47 us median, 397 us p99 a frame, at most 588 instances;
- a powder take-off: 104 us median, 450 us p99, at most 327 instances.
The puffs' overdraw stays under the tier's existing cover budget.

## The PC-6 on wheels on powder (SKIS' observation, 15 Nov)

SKIS' Ardent run, downhill 15 %: the PC-6 on WHEELS on powder rolls as on gravel (67 m against 67 m). On the flat it is
39 m against 36 m.

The physics is honest by its law:
- Its 0.69 m mains at ~100 kPa sink 7 cm. That is about 0.8-1 kN of compaction drag at the start, falling as the wing
  takes the load.
- The 30 cm softZ SKIS read is the 0.14 m tail wheel bottoming, and the tail lifts in 3 s.
- Against 7.1 kN of static thrust on 1277 kg, plus 1.5 m/s^2 of slope, the drag barely shows.

(SUPERSEDED the same day by section 5: the user asked for it - deep snow is now a virgin layer and the tyre's bulldozing is
modelled; on wheels the PC-6 is held at 15 m/s in powder.)

The probe also found a readout bug, fixed here: sim.out.softF was summed over the substeps. It is now the frame's mean (N),
the compaction drag the wheels pay when rolling.

## 5. DEEP SNOW STOPS A WHEEL (the user, 15 Nov; GATE SNOWFLY, full tier, ~9 min)

The user: "model the deep snow wheel effect ... your tests should cover simple wheels and deep snow, and I would expect this to
fail without skis. That's the whole point".

THE MODEL:
- Powder (9) and wet snow (10) are now a VIRGIN layer, no longer a settled strip.
  - Powder: Bekker's fresh-snow stiffness (Wong's table: n 1.6, k ~2e5 at a tyre's width), 30 cm over the base.
  - Wet snow: k 4e5, n 1.2, 15 cm over the base.
  - SKIS' soles read the same fresh snow.
- A light aeroplane's tyre (100-300 kPa) goes through to the base.
- There it pays its BULLDOZING (`bull` on the row; 00_registry groundBullWheel, added to the wheel's drag in 30_solver):
  F = b min(z, D) (sig + rho v^2). That is the snow shoved ahead of the buried face, by its strength (sig: 5 kPa powder,
  8 kPa wet) and by its momentum driven to the wheel's speed (rho: 150 kg/m^3 powder, 400 wet).
  - The ram grows as v^2, so no power gets a wheel to flying speed.
  - The stock tyre at 3 kN in powder: 430 N of compaction + 192 / 768 / 2496 N at 0 / 10 / 20 m/s.
- Packed snow (8) and the muds pay compaction only, as before. MUDFLY's numbers do not move.
- The FAA's wheel limits (4 in of dry snow, 1 in of wet) are far under these layers.

THE RESULT (GATE SNOWFLY: the pilot's circuits and the no-pilot full-power runs, all on WHEELS):

| aeroplane | grass | packed snow | powder (30 cm) | wet snow (15 cm) |
|---|---|---|---|---|
| Cub | 104 m, flies | 101 m, flies | REJECTED; held at 0.2 m/s | REJECTED; held at 0.3 m/s |
| C172 | 312 m, flies | 320 m, flies | REJECTED; held at 4.9 m/s | REJECTED; held at 5.1 m/s |
| PC-6 | 59 m, flies | 58 m, flies | REJECTED; held at 15.2 of 18.6 m/s | REJECTED; held at 13.7 of 18.6 m/s |

A SKI GETS THROUGH. This is checked on the law: a ski of the build's class at the same load and 15 m/s against its tyre. On
powder: the Cub's 302 N against 2110, the C172's 665 against 1774, the PC-6's 797 against 3309. Every ski resists under half
its tyre, and under 80 % of the static thrust's share for its main.

FLOWN ON SKIS: the PC-6 on skis on powder, with SKIS' fixture (tools/fixtures/skis/pc6_skis.json). The row is PENDING here
and switches on, asserting that it gets off, the moment SKIS lands. The observatory's final test (PC-6 + skis + snow) is that
row in the world.

SKIS' optional `fresh` on rows 9 and 10: my first note here said it "reads the same" kept on the virgin rows. It did not
(SKIS, 15 Nov): their sole adds the fresh top to the row's own sinkage, so on the virgin rows the law counted twice, and the
Carbon Cub's skis sank 20.5 cm and never lifted off. SKIS fixed it on claude/skis-pc6 (a809ac6ae): the fresh top applies
only over a row stiffer than itself, so it is off on 9 and 10. Their ruts are 29.7 / 18.3 / 11.5 cm and the Cub is off in
89 m; SNOWFLY passes merged (the PC-6 on skis off powder in 53 m). A wheel-ski's tyre pays groundBullWheel at its own rut in
SKIS' ski pass.

## 6. IN MUD A SMALL WHEEL STRUGGLES (the user, 15 Nov; GATE WHEELSIZE, core, ~45 s)

The user: "for the mud, there I would expect small wheels to struggle more than large wheels, would that be right? Maybe we
can test that too". Yes, by the law already in: in the rigid regime the drag goes as sqrt(z / D), and a smaller, narrower or
harder tyre sinks deeper (its load over its footprint). The gate flies it. The Cub (list:1) with only its main wheels changed
(gear.wheelR, cage.whProfile): full power from rest, heading held, to 0.9 Vs.

| main wheels | grass | soft mud: penalty (time / grass) | sinkage at rest on soft mud |
|---|---|---|---|
| 0.15 m standard | 61 m | STUCK | 8.5 cm |
| 0.22 m standard (as built) | 63 m | x1.40 | 3.3 cm |
| 0.30 m standard | 68 m | x1.18 | 1.6 cm |
| 0.36 m tundra | 74 m | x1.12 | 0.6 cm |

Firm mud is every wheel's ground (penalty under x1.15, never growing with the wheel). Grass is the control: the runs stay
within 25 % of one another (a bigger wheel's own mass and drag).

## 7. ON STONES A BIG SOFT WHEEL SWALLOWS WHAT A SMALL HARD ONE CLIMBS (the user, 15 Nov; GATE ROUGHWHEEL, core, ~100 s)

The user: "does a large tundra wheel help on a bumpy road with stones? Normally we should have one". It did not.

THE FINDING. The solver read the ground at ONE POINT under each node. A wheel met a stone when its axle stood over it: a step
of the stone's whole height in one substep, whatever the wheel. No stone cost any wheel any speed (a 26 cm stone: 100 % kept).
On the strip's own field the 0.36 m tundra wheel jolted HARDER than the 0.15 m one (peaks 14.2 against 12.3 m/s^2).

THE MODEL: the TANDEM CAM (Schmeitz & Pacejka, "A semi-empirical three-dimensional model of the pneumatic tyre rolling over
arbitrarily uneven road surfaces", Vehicle System Dynamics 41, 2004; Zegelaar's thesis, TU Delft 1998), in 30_solver:
- Only on a bumpy strip: `world.roughAt(x, z)` is true on a micro strip's box grown a metre (27_premises roughAt).
- Two cams of the tyre's radius R, one footprint length l apart. l is the carcass's own: tyreFootprint's 4A / (pi b), the
  soft law's footprint. That is 0.15 m on the 0.15 m wheel, 0.23 m on the stock 0.22 m, 0.31 m on 0.30 m, 0.46 m on the tundra.
- Each cam rides the profile: the highest of h(x + s u) less the rim's rise R - sqrt(R^2 - s^2), |s| < 0.95 R, along the
  wheel's heading u (and the profile under the cam's own centre, so a flat road reads flat to the bit).
- The axle's ground is the cams' MEAN. The road's effective slope is their DIFFERENCE over l, and the stone pushes the wheel
  back along u by it (Fn x slope, capped at 3).
- So a stone shorter than the footprint lifts the axle by about half its height and over the footprint's length. A hole
  narrower than the footprint is bridged.

WHY NOT A RIGID ARC ALONE. Tried first: the highest point under the rigid rim. On the strip's stones (paraboloid caps,
56 deg flanks at the foot, R <= 0.27 m: the biggest stands 20 cm proud), every wheel climbs the same flank. And the work
to lift the aeroplane over a stone, m g H, is the same for every rigid wheel. So the rigid arc made the stone an obstacle
but did not separate the wheels. The real tundra advantage is the tyre ENVELOPING the stone, and that is what the tandem
cam carries.

THE COST. The ground is read ONCE A FRAME per wheel on the strip: a profile along u every 5 cm over the cams' reach and the
frame's travel the way the wheel rolls (envFrame). The substeps take the cams off it, arithmetic only. That is 49 reads a frame
on the 0.15 m wheels, 76 on the tundra at 10 m/s (`out.envN`): under 2 a substep, against the solver's own ground reads
per node per substep. Off a bumpy strip it is one roughAt compare a wheel a frame; a world without roughAt (every stub,
every gate's flat world) reads nothing, the bytes as before.

THE RESULT (the Cub; one of the strip's stones under each main, 6 m ahead, from rest at a fixed throttle; the share of its
speed a wheel keeps over the stone, and the CG's peak vertical acceleration there):

| stone, throttle | 0.15 m | 0.22 m (built) | 0.30 m | 0.36 m tundra |
|---|---|---|---|---|
| 15 cm, 0.3 | STOPPED | 33 %, 5.2 | 49 %, 4.0 | 61 %, 4.3 |
| 20 cm (the strip's biggest), 0.4 | 25 %, 11.1 | 48 %, 10.7 | 61 %, 9.1 | 74 %, 7.7 |
| 15 cm, 0.3, the OLD point read | 100 %, 10.3 | 100 %, 10.6 | 100 %, 11.0 | 100 %, 10.8 |

At a 10 m/s taxi over a row of 15 cm stones, the jolt falls 13.2 / 12.9 / 11.5 / 10.1 m/s^2 and the gear's peak strain
8.40 / 8.16 / 7.51 / 7.42 %.

NOT CLAIMED, a garage gap for the DIRT session: a softer ride on the strip's LUMPS (1.8-3.5 m waves). No tyre filters a wave
longer than its footprint, so the rms is the same for every wheel (~2.0 m/s^2 at chaos 0.8), as it should be. But the peak
there still grows with the wheel (10.3 on the 0.15 m, 12.9 on the tundra). The solver's ground spring scales with the node's
mass (KGn = 1.5e4 x m above 6 kg), so a heavier wheel rides STIFFER (9e4 N/m on the 0.15 m wheel, 2.8e5 on the tundra), and
a low-pressure carcass's vertical rate is nowhere. A carcass's vertical rate (beside TYRE_SOFT) is the row to build. It moves
every fixture that rolls, so it belongs to a session that owns the ground's calibration.

## 8. THE GROUND'S WEATHER LADDER (the user, 15 Nov; GATE MUDLADDER, core, ~65 s; branch claude/snow-mud-ladder)

The user: "should we have a mud ladder? Dirt to firm mud to soft mud as a function of the weather? ... these 3 options, and
maybe an auto setting? So we can keep doing tests, or mark a runway as always dry or muddy, and let some evolve with the
weather." Then: grass and sand the same (wet sand firmer and "slightly darker ... don't make the sand go too dark", because the
aprons and the ground around would not follow); "the more soft the mud is, the deeper the ruts and the holes ... they sort of
firm up slightly with the dry setting"; "match the color of the projections to what we are doing here, so to unify these two
systems"; the Hiking Strip and the Old Community Runway on it, the New Community Runway kept clear (the story's). Snow and
gravel climb no ladder (the user's ruling).

THE RAIN WAS ALREADY THERE. The weather plan's days carry a rain curve (the gale, the storm, the showers), and DIRT-DUST's
SOIL_WET (07e) keeps the top soil's water as a 96 h bucket per class (dirt, sand, gravel, grass): the rain fills it, the sun
and the wind dry it, the subsoil re-wets it overnight; pure in the instant, so the page, the physics worker and a gate read
the same. Until now it drove the dust, the puddles and the mud coat's wash - never the wheels.

THE SETTING IS THE LOOK. The fixed rungs: dirt, mud (firm), mud (soft), grass, grass (wet), sand, sand (wet). The WEATHER
looks: dirt (weather), grass (weather), sand (weather) - their feel a code 20 / 21 / 22 that 20_world resolves where the
ground is read (07f GROUND_WX off the soil now):

| look | rung by the soil's water S (of its class) | surface codes | worn relief | drawn |
|---|---|---|---|---|
| dirt (weather) | mud = smoothstep(0.55, 0.9, S): < 0.25 dirt, < 0.75 firm mud, else soft mud | 6 / 11 / 12 | x 0.85 / 1 / 1.3 | 30 % darker at S 1, toward the mud's colour by its mud |
| grass (weather) | S < 0.5 dry, else wet | 0 / 13 | x 1 | 12 % darker at S 1 |
| sand (weather) | S < 0.45 dry, else wet | 7 / 14 | x 1 / 0.9 (wet sand firms) | 10 % darker at S 1 |

New rows: 13 wet grass [0.080, 0.20, 0.45] (Raymer table 17.1: wet grass rolls 0.08, brakes 0.2), 14 wet sand
[0.050, 0.40, 0.65] (ESTIMATE: a packed damp beach - firm where dry sand is loose). Every code-keyed side table to 15.

THE SEASON (the plan's first storm, 27 May, at 17:00): the dirt's water 0.90 - the Old Community Runway is SOFT MUD; the next
afternoon 0.47 (dirt again: the bucket drains and the sun dries it), then 0.09, 0.04 ... A light rain makes firm mud.

THE WHEELS (the Cub, full power from rest to 0.9 Vs; a weather code at each rung rolls bit for bit as the fixed code):
dirt 63 m, firm mud 65 m, soft mud 80 m (x1.27 - the soft rows' operational fit, 20-50 %); dry sand 74 m, wet sand 64 m;
braked from 0.6 Vs: dry grass 10 m, wet grass 20 m.

THE BUMPS: on a bumpy weather strip the world adds (wear - 1) x the field's WORN relief (26b wearUV: the aeroplanes' lanes,
the vehicles' ways and berms, the holes, the lumps - each linear in its knob, so the scaled field is the field of the scaled
knobs) to the composed ground - exact (1e-14 m over 16 408 points), not memoised on the box, the ceiling widened by
0.35 x its bound; the raster and the cook are the record's (nothing to re-cook). The ribbon is re-drawn on the same ground:
render_world reads each vertex's worn relief once and re-drapes it when the rung moves; the shader's rows scale the same
knobs. The Hiking Strip relooked dirt (weather) in the gate: its deepest trough 6.7 / 7.9 / 10.3 cm dry / firm / soft.

THE COLOUR, ONE LAW: PAVEMENT.groundWxMult(cls, st) - 1 - dark, and a dirt toward 'mud' / 'dirt' channel by channel by its
mud (a soaked dirt strip IS the mud's colour) - is the drawn strip's (applyOne, the row re-packed when the rung moves) and
the projections' (app.js: the strip under the aeroplane, world.wxAt -> PAVEMENT.groundWxColor -> the dust's setGround, its
class and the mud's); a mud rung throws MUD (dust class by the surface code). dust.js and aeroweather untouched (GROUND-FX's).

FOR TESTS: the weather panel's 'the ground' row (the weather / dry / firm mud / soft mud) = world.setGround - the soil held
at 0.05 / 0.70 / 0.95 for every reader (the wheels, the drawn ground, the dust, the puddles), replayed on the physics worker
and handed at a flight's start; ?ground=dry|firm|soft at load. The fixed looks never move; every gate's sandbox day is dry.

JOLENE: w6 Old Community Runway gravel -> dirt (weather) (its CONTRACT_FIELDS word 'dirt'); w8 HIKING STRIP sand -> dirt
(weather), THE SHOWCASE (the user: "Do the hiking strip as our showcase"): its chaos-0.4 bumps climb the ladder - the deepest
trough 6.7 / 7.9 / 10.3 cm dry / firm / soft, its colour toward the mud's, its dust and mud its colour; w7 (the story's)
untouched. The stills (pavement bench, the real shader): dirt dry / firm / soft, sand dry / wet, grass dry / wet.

THE APRONS (the user: "the aprons around should probably follow the same trend"): a pad, an apron or a road drawn with a
weather look feels its rung and is re-tinted on it (PAVEMENT.resolve carries the look's code to make; groundWxTick re-applies
every weather pavement when its rung moves; the strips stay render_world's, which also re-drapes them). The island's own
ground (the terrain, the grass around) does not darken - why the sand's step is a shade (10 %).

NOT DONE: the terrain's own ground does not take the soil's water (a renderer's question); a bumpy ROAD or pad has no worn
relief to scale (only strips carry `micro`). The editor's look lists carry the five new looks.

## Gates

| gate | tier | runtime | self-test |
|---|---|---|---|
| SINKVIS | core | ~3 s | 4 doctored laws red |
| MUDCOAT | core | ~8 s | 5 red |
| MUDFLY | full | ~9 min | - |
| SNOWMUDFX | core | ~1 s | 7 red |
| SNOWFLY | full | ~9 min | - |
| SOFTGROUND | core | ~2 min | re-recorded fixture |
| WHEELSIZE | core | ~45 s | - (the table's order is the check) |
| ROUGHWHEEL | core | ~100 s | the old point read fails A |
| MUDLADDER | core | ~65 s | the rungs, the island, the season, the Cub, the bumps, the colour, the worker |
