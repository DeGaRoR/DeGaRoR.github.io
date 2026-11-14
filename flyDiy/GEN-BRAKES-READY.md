# GEN-BRAKES — ready (12 Nov 2026, REAL-FIGURES)

Branch claude/gen-brakes, onto master L39b 23ce68c1f:
- cd8343b92: the sources;
- 997c09ba0: built.

## What

The brakes as a choice, with their hold, their mass and their price. From claude/practical-cerf-7fjpwp 57e18a499 (its
GEN_BRAKES half) and 39831863c (the tile's icons).

**No 43_pilot.js change.** The Pilot Coordinator ports the feel stop / feel arrival and `brkMu` (the planned stop
reading the brakes) into claude/pilot-unify, on top of this.

| row | per main wheel | pair | price |
|---|---|---|---|
| drum (heel / cable, J-3, D.112) | 600 N | 2.4 kg | 400 |
| disc (Cleveland 30-9 class) | 1400 N | 3.6 kg | 1300 |
| double (Beringer / Grove class) | 2600 N | 5.4 kg | 3200 |

The figures are estimates, stated as such in 60_gen_spec.

- **The solver:** a main's braking friction is min(the surface's, perWheelN / the wheel's load). No `brakeN` gives the
  surface's, the old line exactly.
- **The frame:** the pair's mass sits on the mains, and its price goes with the wheels.
- **The garage:** the 'Brakes' tile (brkHold 0-3, with icons; it writes its own row only) and the gear page's row. The
  join writes `spec.gear.brakes` only when chosen.

## Absent is as it was (measured)

No saved build has brakes chosen.
- **Fleet scan** (`tools/fleet_scan.js` from claude/real-perennial, the game's load path), every build of the tree, base
  23ce68c1f vs this branch: 0 of 40 moved (margin 0.01 point, mass 0.5 kg), no errors.
- **Gates** (this branch, then plain 23ce68c1f, same box):

| gate | this branch | 23ce68c1f |
|---|---|---|
| STOL | PASS | PASS |
| TAKEOFF | PASS | PASS |
| TAILWHEEL | PASS | PASS |
| WEIGHT | PASS | PASS |
| PARTS | PASS | PASS |
| DESIGN | PASS | PASS |
| CERTGATES | PASS | PASS |
| PROCURE | PASS | PASS |
| BUILT | PASS | PASS |
| DESIGNSIM | FAIL | FAIL |

DESIGNSIM fails the same way on both: cub's spiral root 0.0457 predicted, 0.0966 flown; mosquito_3's -0.0461, 0.0188.

## Who uses it

The canon's `jodel_geo` (drum) and both Ruckus cards (disc) choose brakes. They land after this.
