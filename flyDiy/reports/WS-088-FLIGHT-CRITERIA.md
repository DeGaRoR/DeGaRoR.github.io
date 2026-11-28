# WS-088: the flight test's criteria and the certificate's validity (READY note)

The user's register, WS-088 (PRIORITY): "Lazair and Chinook are certified despite flying extremely badly. Review
flight-test criteria and certification validity." A0, 28 Nov: "audit the bench / test flight's pass criteria (bench.js
'flight' judge, the design check rows in 60_gen_spec, the shakedown) against how a badly flying aeroplane should fail,
with concrete criteria (oscillation, control saturation, track, attitude excursions). Fix the rudder row's sideslip
number. Write the verdicts per check."

**Where it is:** a line on master `9d0b8bbeb`, carried on `claude/physics-audit` (its head is a merge commit whose SECOND
parent is this line's tip; A0 merges by sha). This session may push only `claude/physics-audit` and its own branch: the
user has not cleared a `claude/physics-audit-ws088` name, and a peer cannot.

**In one line:** the test flight certified on arrival alone; the pilot now measures the flight it flies and a badly
flown circuit is not certified. The rudder row's broken number is fixed. The user's Lazair and Chinook could not be
reproduced here (the Lazair is not in the repo, and the repo's Chinook flies a clean circuit); the cases for the box are
at the end.

## The verdicts, check by check

| check | how it judged | verdict | change |
|---|---|---|---|
| **The test flight** (`bench.js` BENCH_TESTS 'flight', `judge`) | `ok = !!f.arrived`: any arrival certified; what the pilot noticed only added "WITH NOTES" | **THE HOLE.** A circuit flown with the nose swinging 15 deg, the wings rocking 18 deg and the airspeed under the stall still read "FLEW THE CIRCUIT" | **FIXED.** The pilot measures the flight (below) and a FAIL withholds the certificate: "ARRIVED, BUT FLEW BADLY", the failing rows and their bounds in the fix line |
| **The bench check** (`shake`, `benchCircuit`) | climb >= 0.3 m/s, take-off within 1100 m | sound for what it is: power against weight, not handling | kept |
| **The design check** (`64b_gen_design.js`, 14 rows: static margin, tail volumes, short period, elevator and flare authority, weathercock and dihedral, spiral, dutch roll, roll mode, aileron, droop, rudder) | the linearised aeroplane, measured in the tunnel at its trim; a safe-tier FAIL withholds the certificate, a WARN certifies (GEN_CERT_TIER, the user 3 Nov) | a good static and dynamic screen: a negative static margin, no pitch stiffness, a weathercock stability at or under zero all fail it. Its blind spot is everything nonlinear or flown: one trim point, no stall near the circuit's speeds, no pilot loop. That is the flight's job, and the flight judged nothing | kept; the flight now covers the blind spot |
| **The rudder row** (`ctl.rudder`) | sideslip = Cn_dr / max(1e-6, Cn_beta) | **BROKEN NUMBER**, and worse: with Cn_beta <= 0 the divisor was floored, so the Risen's -0.001 printed "full rudder holds 5883796.03 deg of sideslip", and its crosswind read Va sin(0.6), the most any aeroplane could score, into the contracts' `xwindKt` | **FIXED** (`genRudderHold`, pure): Cn_beta <= 0 holds no sideslip, 0 kt, said in words ("no steady sideslip to hold: the weathercock stability is -0.0010 per rad ..."); past 0.6 rad the sideslip is printed capped at the fin's stall, as the crosswind always was. Every stable build's row is unchanged (the Cub: 13.62 kt, 19.68 deg) |
| **A hand-flown arrival** | "a landing is a landing" (ARRIVED, BY HAND) | kept: it is the person's flying, not the aeroplane's. **A ruling for the user** if hand flights should be judged too | unchanged |
| **WARN rows certify** | the tiers (the user, 3 Nov) | by design | unchanged |
| **WS-070 / WS-072** (results outdated on change, recomputed on request) | FLAGSHIP's | the flight's verdict is part of the flight's result, so it is outdated by the same fingerprint as the rest (taken at roll-out) | nothing here |

## The flight measure (43_pilot.js `PILOT_FQ`, `fqStep`, `pilotFqSummary`; report.quality)

The pilot records as it flies; it reads, never writes a control (GATE FLIGHTQ scans it, and the Cub's circuit is
bit-identical with it: 3650 samples, none different). The report carries `quality: { v, level, rows }`, kept fresh every
second of flight and at every phase change. Not counted: the ground, the take-off roll and lift-off, the flare and the
roll-out, anything under 10 m. Each row has a WARN and a FAIL bound; only a FAIL withholds.

| row | what | warn / fail | why it fails |
|---|---|---|---|
| `fq.pitch` | the nose's largest swing about its own 3 s mean on the settled leg (the downwind; else the cruise or route), deg | 5 / 8 | porpoising: a pitch oscillation the pilot cannot damp |
| `fq.bank` | the same for the wings, deg | 10 / 15 | wing rock, a dutch roll |
| `fq.vs` | the vertical speed's RMS about its mean on that leg, m/s | 0.6 / 1.0 | a phugoid, a height not held |
| `fq.att` | the steepest bank and the pitch limits anywhere airborne, deg | bank 35 / 45; pitch +25 / +30 and -15 / -20 | an attitude no circuit asks for: control lost |
| `fq.speed` | the slowest AIRSPEED airborne over the stall speed at the flap set (Vs to Vs0 by the flap) | 1.05 / 1.0 | a circuit flown at or under the stall |
| `fq.stops` | elevator, aileron or rudder on its stop: the share of the airborne time, and the longest spell | 3 % or 2 s / 10 % or 5 s | flown at the end of its control authority |
| `fq.leg` | no settled leg of 20 s | warn only | not measured: said, not judged |

**The evidence** (the pilot's own circuit on the default field, every validated and candidate card that flies it; the
numbers below are the probe's, at 10 Hz; the core's 60 Hz recorder reads within a few per cent of them):

Calm air:

| plane | settled leg s | pitch dev | bank dev | vs RMS | bank max | Vmin / Vs | stops |
|---|---|---|---|---|---|---|---|
| cub | 120 | 2.1 | 4.6 | 0.24 | 24 | 1.13 | 0 |
| jodel | 129 | 2.5 | 2.7 | 0.23 | 24 | 1.17 | 0 |
| jodel_geo | 120 | 1.5 | 3.4 | 0.19 | 24 | 1.06 | 0 |
| cessna 172R | 104 | 3.0 | 6.6 | 0.32 | 24 | 1.07 | 0 |
| chinook | 122 | 2.9 | 5.2 | 0.34 | 24 | 1.13 | 0 |
| electric trainer | 98 | 1.7 | 5.2 | 0.26 | 24 | 1.30 | 0 |
| pc6 | 69 | 1.5 | 5.1 | 0.30 | 25 | 1.16 | 0 |
| super petrel | 110 | 3.1 | 4.0 | 0.29 | 24 | 1.30 | 0 |
| ruckus | 149 | 2.5 | 5.0 | 0.19 | 27 | 1.15 | 0 |
| carbon cub ss | 69 | 1.6 | 5.2 | 0.24 | 24 | 1.10 | 0 |
| tiger moth | 103 | 1.4 | 3.3 | 0.18 | 24 | 1.30 | 0 |
| camel | 89 | 1.6 | 2.9 | 0.20 | 25 | 1.30 | 0 |
| stearman | 81 | 1.5 | 4.5 | 0.24 | 25 | 1.30 | 0 |
| dc-3 (does not complete the circuit) | 114 | 2.3 | 9.4 | 0.66 | 24 | 1.10 | 0 |
| **birdman** (the Chinook as first saved) | 148 | **14.9** | **18.2** | 0.62 | 24 | **0.87** | 0 |

6 m/s with 30 % gusts (the airspeed, not the ground speed):

| plane | pitch dev | bank dev | vs RMS | Vmin / Vs |
|---|---|---|---|---|
| cub | 1.8 | 5.5 | 0.28 | 1.18 |
| jodel | 2.6 | 3.9 | 0.31 | 1.17 |
| cessna 172R | 2.3 | 7.6 | 0.40 | 1.07 |
| chinook | 3.6 | 5.7 | 0.49 | 1.13 |
| electric trainer | 1.9 | 7.2 | 0.35 | 1.31 |
| ruckus | 2.7 | 5.3 | 0.31 | 1.16 |
| tiger moth | 1.8 | 4.6 | 0.27 | 1.26 |
| birdman | 2.9 | 5.8 | 0.38 | 1.21 |

The worst good aeroplane, calm or gusty: pitch 3.6, bank 7.6, vs 0.49, 1.06 Vs, no stops - each inside the WARN bound,
with room. The Birdman's calm circuit fails three rows (pitch 15, bank 18.5, speed 0.88 Vs, in the core). In gusts it
flew a clean circuit: the measure judges the flight that was flown, not the design (that is the design check's job, and
the Birdman fails it outright: static margin -0.167 MAC). No aeroplane here ever had a control on its stop in a circuit.

## The Lazair and the Chinook

- **The Chinook.** The repo's card (`builds/chinook_2026-09-21_corrected.json`) and the user's newer card A0 sent on
  22 Nov fly the same circuit to the sample. It is clean, calm and in gusts (pitch 2.9 / 3.6, 1.13 Vs), and its design
  check only warns: a static margin of 0.027 MAC at its worst loading corner. **Not reproduced here.**
- **The Lazair** is not in the repo.

**On the box, please** (the user's own cards; each prints the flight's verdict row by row and the design rows that are
not a pass):

```
node tools/flightq_fly.js <the user's Lazair card>
node tools/flightq_fly.js <the user's Lazair card> --wind 6,0.3
node tools/flightq_fly.js <the user's Chinook card>
node tools/flightq_fly.js <the user's Chinook card> --wind 6,0.3
node tools/flightq_fly.js <the Risen V-tail card>
```

Then the in-game test flight of each: the plaque now prints "ARRIVED, BUT FLEW BADLY" and the rows that failed, or the
measured values in the note when it certifies.

**If they pass and the user still sees them fly badly**, the measure has a gap only the user can name: what does "badly"
look like (the nose hunting, the wings wallowing, a height it cannot hold, a speed it cannot keep, a stall on the turn),
and is it on the autopilot or by hand? Each is a row to add with its bound. Two candidates I did not take on my own:

- **a tighter static margin**: the Chinook sits at 0.027 MAC. But the validated Cub sits at 0.028 at its worst corner,
  so a 0.05 bound fails the Cub too: a ruling, not a fix;
- **judging hand flights.**

## WS-080 (context): the Risen V-tail

The design check assumes nothing about a V-tail: it measures the weathercock stability on the whole aeroplane in the
tunnel. The repo's Cub with a V-tail at 30, 35 or 45 deg passes every tail row: Cn_beta 0.083-0.18 (the conventional
tail's 0.09), the dutch roll and the rudder all pass. Only the tail-volume rules of thumb warn (they count the projected
areas). So the Risen's Cn_beta of -0.001 is the Risen: a V too flat or too small for its side area ahead of the CG.
It is a design to change, not an assumption to correct. Its rudder row now says so in words, 0 kt, where it printed
5883796.03 deg. `flightq_fly.js` on its card prints the rest.

## The gates

Run on this line (the tree of the source commit, built), in the cloud container:

- **FLIGHTQ** (new: the summary's rows, the judge, the read-only scan, the Cub's clean circuit and the Birdman's failed
  one, the rudder row): **pass**.
- FLIGHTREC, GEN (4 shards), PILOT (3 shards), PILOTCANFLY, PILOTACT, JOIN, AIDS, DESIGN, COMMITHYGIENE: **pass**.
- DESIGNCHECK, DESIGNSIM, BENCH, ACCEPT, CONTRACTS: red, and **red on master `9d0b8bbeb` with the same checks** (run
  beside it here; no check name differs). For example: the Cub's spiral root, predicted against flown; the shipped
  Rufus's stamp; an app.js wiring scan in ACCEPT. Master's own.
- Not run: the rest of the core tier, and any browser page. Above all, the in-game test flight, which is the box's.

## Files

- `src/core/43_pilot.js`: `PILOT_FQ`, `pilotFqSummary`, the recorder `fqStep` and its call, `report.quality`
- `src/core/64b_gen_design.js`: `genRudderHold`, the rudder row through it
- `src/core/90_node_exports.js`: + `genRudderHold`, `pilotFqSummary`, `PILOT_FQ`
- `src/viewer/bench.js`: the flight judge
- `tools/_flightq_check.js` (GATE FLIGHTQ, new, core tier), `tools/run_gates.js` (its row)
- `tools/flightq_fly.js` (new): a build's test flight headless, as the bench would judge it
- this note
