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

## Gates

| gate | tier | runtime | self-test |
|---|---|---|---|
| SINKVIS | core | ~3 s | 4 doctored laws red |
| MUDCOAT | core | ~8 s | 5 red |
| MUDFLY | full | ~9 min | - |
| SNOWMUDFX | core | ~1 s | 7 red |
| SOFTGROUND | core | ~2 min | re-recorded fixture |
