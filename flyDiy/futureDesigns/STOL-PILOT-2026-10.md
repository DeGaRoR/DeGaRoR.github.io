# STOL-PILOT — the autopilot's short-field technique for a STOL wing
### (27 Oct 2026, cloud session STOL-PILOT; coordinator A0, the autopilot's owner PILOT reviews every line of 43_pilot.js)

STATUS: **v1 — plan + law + legs on `claude/stol-pilot`, NOT on a ready branch: PILOT reviews first** (HANDOVER, STOL-PILOT).

THE BRIEF (the user, 27 Oct): the stol-wing-2 session built a STOL Cub (`tools/fixtures/stol_cub_showcase.json`: full-span
fixed slot, VGs, drooped tips and ailerons, Rotax 915 iS 141 hp, a bigger tail, 31-inch tundras). Flown on the autopilot's
circuit against the stock Cub (`builds/cub_2026-09-20_corrected.json`): lift-off 46.7 m vs 96.1, **landing roll 61 vs 62 m
(no gain)**, Vref 56.6 vs 63.0 km/h - *"the autopilot touches down at about 14 m/s whatever the wing can do ... a proper STOL
landing technique would be an autopilot job"*. And: *"we need the matching STOL strategies it has detected are missing"*,
*"an actual internet research on the true techniques on top of that"*.

BASE: master d7e181f4e (train L27b had not landed) + `claude/ready/stol-wing` (f35d77353) + `claude/land-way` (302008a7,
PILOT's ap.landWayFrom / ap.finalFrom) + `claude/ready/final-cap` (5206f6c5e) - all three merged clean, nothing duplicated.

## 1. The real technique (sourced; the full notes: `STOL-PILOT-2026-10-research.md`)

| | the real thing | source |
|---|---|---|
| approach speed | <= 1.3 Vso (+ half the gust); bush practice ~1.2 Vso; Super Cub pilots 45-50 mph on a 43 mph Vso (1.05-1.15) | FAA-H-8083-3 ch. 9 (AFH), the ACS, AOPA 2022, backcountrypilot.org |
| path | power-on, full flap; pitch the path, power the speed on the back side; steeper over an obstacle: 50 ft cleared, the touch 300-500 ft on = 6-9.5 deg (derived) | AFH, AOPA "Insights" 2006 |
| aim | the touch 0..+200 ft (Private) / 0..+100 ft (Commercial) past the point chosen, never short | the ACS |
| flare | minimum float; the power off in the round-out (or carried to the touch and closed - the "dragged-in" STOL arrival); the touch at minimum controllable speed; a taildragger THREE-POINT (the shortest roll) | AFH, AvWeb (Stowell), AOPA 2022 |
| roll-out | flaps up at the touch, full aft stick, maximum braking without skidding; the stick back keeps the tail down (nose-over) | Cessna / Cirrus POHs via AOPA, AOPA "Proficient Pilot" 2019, ATSB |
| take-off | the sheet's flap (PA-18: flaps up, full flap popped at 30-35 mph); the tail slightly up, held tail-low; lift-off at the slowest controllable; Vx to 50 ft, then Vy | Piper PA-18 Information Manual, AFH, the ACS |
| sanity | PA-18-150: Vso 69 km/h, roll 61 m take-off / 107 m landing (book); Carbon Cub Vso 52 km/h, ~18 m / ~75 m; competition Cubs 17 m landing | Plane & Pilot, GlobalAir, AvWeb, AOPA |

(The research session could not fetch the pages themselves - the proxy refused - and worked from the search engines' quotes
of them; the [AFH, recalled] lines are marked in the notes.)

## 2. What the autopilot did (measured, node `tools/pilot_trace.js`, the merged base)

The STOL Cub's circuit off HOME (`stol_home.csv`, scratch): the final at **1.3 Vs0** (15.7 m/s, the sheet's Vref) on the
archetype's 5.7 deg, the aim 155 m in (20 % of the 1100 m strip), the flare armed at 7.3 m. In the flare:
- the throttle went to idle and **the elevator ran out at the AP's 0.35 stop** (`deTop`) with the nose at +1 deg;
- under 1.15 Vs0 the **slow-arrival cushion (G970's apAssist) came in at 0.40** of throttle - and held the speed: the wheels
  met the grass at **13.8 m/s = 1.14 Vs0, wheels first** (`three: false`), the pitch -0.9 deg;
- the roll-out braked at the 'normal' technique's `brakeMax 0.30`, ramped at 0.12 /s, from VBrakeOn (0.75 Vs): **61 m**.

The stock Cub touches at 13.9 m/s too - 1.03 of ITS Vs0. The touchdown speed is the elevator's and the cushion's, not the
wing's. On the 340 m A4 the 'short' technique (the strip length's) flew 1.2 Vs0 and full brakes, ramped at 0.24 /s, but the
same flare: 58 m.

**One more fact the law had to meet** (measured, scratch `stol_home3.csv`): with the cushion simply removed and the flare at
idle, the showcase's tail has NO authority without its slipstream - 0.65 of stick held the nose at -3 deg and it met the
ground at 2.8 m/s, 14 m short of the threshold. The 141 hp Rotax blows that tail. So the STOL flare is flown ON POWER
(the real "dragged-in" STOL arrival: the power carried to the touch and closed there), not at idle.

## 3. The law (43_pilot.js; every part behind `ap.stolFld` / `ap.dep.stol`)

**3.0 THE SHEET THAT SAYS THE WING CAN** (`stolSheet()`, published `ap.stol`): a build whose wing carries a stall-angle
device (`def.strips[].stol` with `dAs` / `sa` - genStolHeld's own test) AND whose machine-sheet Vs0 (the elevator-held one
when the tail cannot fly the slatted stall, G2826 - never the bare `gen.VsFlap`) is under **0.92 x the stall the same wing
would have without its devices** (`genStolGain`, 64_gen_build: the highest lift over an attitude sweep, prop off, the landing
flap, with and without the strips' `stol` keys). Never on the water.

| build | device | sheet Vs0 km/h | the wing without devices | ratio | the law |
|---|---|---|---|---|---|
| showcase STOL Cub | full-span slot + VG | 43.5 (the elevator holds the stall) | 51.3 | **0.848** | **on** |
| kit Cub (stol_cub_kit) | slot + VG | **48.6 held** (stall 41.8) | 49.0 | 0.992 | off - its tail cannot use the slot |
| stock Cub, Jodel, C172, metal Cessna, Cessna floats, twin floats, Rufus | none | - | - | - | `ap.stol === null`, never probed |

**3.1 THE APPROACH** (planArrival): technique `'short'` on every land strip that is not soft (a soft strip keeps its soft
technique; a profile's own field technique still wins - **the Student flies a normal approach everywhere, the STOL Cub
included**). `ap.appr.stol` records the sheet. The short technique's 1.20 x sheet Vs0 (+ half the gust); the aim **10 m in**
on any strip (the ACS's 0..+100 ft, and the touch arrives ~10-20 m past it); the slope **at least gsStol 0.12 (6.8 deg)**,
never past the sheet's own gsMax, an obstacle's steeper slope standing. The short final's 900 m / 30 s of straight-in,
the base flap, the float go-around (G1936/G1949) are the short technique's as before.

**3.2 THE FLARE** (FLARE): the hold-off's sink law unchanged, and three STOL parts:
- the attitude is brought to the **three-point attitude** (flCap, the rest attitude + 2 deg) as the height goes, reached at
  half the entry height (`flareStolK` 0.5) - the hold-off's own pitch law alone left it at +2 deg, 1.10 Vs0;
- the elevator gets the **stick's whole travel** (`deStol` 0.70, the deTop of the rotate-pull and the water) in FLARE and
  ROLLOUT, and the flare integrator's saturation reads that stop;
- the throttle is **kept from the approach and trimmed on the sink** (the water flare's PI, G3079: `flareStolP` 0.25,
  `flareStolI` 0.10, at most +0.4 over the approach's) - so G970's slow-arrival cushion, an idle flare's (thr mode IDLE),
  never runs. The throttle closes at the touch (ROLLOUT's thr 0).

DECK ANGLE vs STALL (stol-wing-2's warning): the three-point deck angle of the 31-inch-tundra Cub is 9.9 deg; the slatted
wing stalls at 26.9 deg of alpha. The law never asks "the stall": it asks the three-point attitude and lets the wing find its
speed there. Measured: the nose reaches +6.5 deg (the power then holds the sink, the speed already AT Vs0) and the touch
is tail-low - the mains at +5.8 deg, the stick to 0.70, the tailwheel down within a second - at **12.0 m/s = 0.99 Vs0**,
1.35 m/s of sink (the report's `three: false`: the deck angle was not reached in the air). Where the deck angle is the wing's limit,
the touch is that attitude's speed, above Vs0; where it is not (here), the wing stops flying first.

**3.3 THE ROLL-OUT**: the flaps come up at the touch (the roll-out's flapTgt 0, at the build's own flap rate - unchanged);
**the stick fully back** (0.70) from the touch on a three-point arrival and from 1.15 VRot otherwise; the short technique's
brakes to `brakeShort` 1.0 **at once** (`brakeStolRate` 1.0 /s: the limit in a second, against 0.24) - the tail-rising guard
(G1936: the brakes off the moment the tailwheel leaves the ground) unchanged.

**3.4 THE TAKE-OFF**: `ap.dep.stol` - technique `'short'` on every land strip that is not soft (the brakes held until the
power is up; a profile with its own field technique keeps it); the take-off flap is **half the landing flap** when that is
more than the sheet's take-off setting (`flapStolK` 0.5; the PA-18 Information Manual: "half or full flap can be applied
to reduce takeoff run ... the best angle of climb is attained with full flap") - held through the lift-off and the climb to
2 x hSafe, then up at the build's flap rate as before. Measured on the showcase off HOME (brake release to lift-off / to
15 m): the sheet's 0.25 **47 m / 155 m** (the climb-out still accelerating through Vx, 21.6 m/s at 15 m); **0.5 43 m /
134 m** (18.4 m/s at 15 m); 1.0 45 m / 120 m (the drag on the roll). Half flap: the shortest run, and the screen 13 %
nearer. **A CHOICE FOR PILOT** (the sheet says 0.25; the brief said "flaps per the sheet") - `flapStolK` 0 gives the
sheet's back. The rotation is the sheet's VRot (13.9 m/s); a taildragger rides its three-point attitude (9.9 deg) after
Vr and lifts off when the wing carries it - 15.6 m/s on 0.25, **14.4 on 0.5**: the early rotation is the flap's, the
attitude is already the wheels' limit. The lift-off accelerates to **Vx** only and **climbs at Vx to the 15 m (50 ft)
screen** whatever stands ahead (the obstacle climb, the ACS), then the cruise-climb as before. (The climb kit's own law
- climbKit, PILOT's - still overshoots Vx on the full-power 141 hp climb-out: Vx 16.9, 18.4 m/s at 15 m.)

NOT DONE (said): the flap POP on the take-off roll (flaps up, full flap at 30-35 mph - the build's flap motor runs at
0.15 /s, 5 s to full: no pop is possible on this lever); a slip on the STOL final (the bush profile's own slip stays); a Valdez
"behind the curve" drag-in at 1.05 Vs0 in ground effect (AOPA calls it borderline abusive); an anti-skid model (the solver's
brake friction is the wheel's).

## 4. The judge (legs) - see §5 for the table

- the STOL Cub vs the stock Cub on HOME (1100 m grass), A4 (Tyl Strip, 340 m, surface 6), the Jolene mine strip
  (`mn_strip`, Copperhead Mine Street, 250 m, surface 6) and w8 (strip 13, 392 m, surface 7 - SOFT: the soft technique
  stands, the STOL law does not engage), each flown by the **Expert** and the **Student** (`--profile student`);
- node `tools/pilot_trace.js` per leg (the rig: `reports/evidence/STOL-PILOT/legs.js`), the merged base's core against
  this branch's core.
- GATE PILOT part **STOL** (tools/test_pilot.js): the showcase qualifies (ratio < 0.92), the kit does not, no validated build
  (Cub, Jodel, metal Cessna, Cessna floats, twin floats, Rufus, C172) has `ap.stol`; the stock Cub flies 'normal' with no
  STOL key; the showcase flies the law, lands first time, touches at <= 1.05 Vs0 and <= 1.6 m/s, rolls <= 0.70 x the stock
  Cub, touches within 30 m of the aim, lifts off shorter.
- NO VALIDATED PLANE MOVES: by construction (`stolSheet()` is null without a device and every STOL branch reads
  `ap.stolFld` / `ap.dep.stol`, set only when it is on; `ap.appr.stol` / `ap.dep.stol` are absent keys otherwise) and BY
  FINGERPRINT: `tools/_stol_samebits.js` on the merged base and on this branch (§6).

## 5. The legs

node `tools/pilot_trace.js`, calm, one circuit per leg (HOME and A4: the circuit at that strip; "HOME->mine": Jolene AFB to
the mine strip), the merged base's core (49387ca8) against this branch's (`reports/evidence/STOL-PILOT/legs.js`, the jsons
beside it; lift-off = the run to the wheels' last contact, roll = the touch to the stop):

| build / field / pilot | base (merged, no law) | this branch | same? |
|---|---|---|---|
| kit / A4 340 m / expert | lift 94 / roll **59** / td 13.7 m/s 1.22 sink | lift 94 / roll **59** / td 13.7 m/s 1.22 sink | identical |
| kit / A4 340 m / student | lift 90 / roll **92** / td 15 m/s 1.98 sink | lift 90 / roll **92** / td 15 m/s 1.98 sink | identical |
| kit / HOME 1100 m / expert | lift 93 / roll **71** / td 14 m/s 1.47 sink | lift 93 / roll **71** / td 14 m/s 1.47 sink | identical |
| kit / HOME 1100 m / student | lift 88 / roll **83** / td 14.9 m/s 2.37 sink | lift 88 / roll **83** / td 14.9 m/s 2.37 sink | identical |
| kit / mine 250 m / expert | lift 98 / roll **63** / td 14.3 m/s 1.25 sink | lift 98 / roll **63** / td 14.3 m/s 1.25 sink | identical |
| kit / mine 250 m / student | lift 95 / roll **97** / td 15.2 m/s 1.88 sink | lift 95 / roll **97** / td 15.2 m/s 1.88 sink | identical |
| kit / HOME->mine 250 m / expert | lift 7 / roll **62** / td 14.3 m/s 1.2 sink | lift 7 / roll **62** / td 14.3 m/s 1.2 sink | identical |
| kit / HOME->mine 250 m / student | rejected-takeoff | rejected-takeoff | identical |
| kit / w8 392 m soft / expert | gave-up (lift 107) | gave-up (lift 107) | identical |
| kit / w8 392 m soft / student | gave-up (lift 103) | gave-up (lift 103) | identical |
| stock / A4 340 m / expert | lift 98 / roll **58** / td 13.7 m/s 1.18 sink | lift 98 / roll **58** / td 13.7 m/s 1.18 sink | identical |
| stock / A4 340 m / student | lift 95 / roll **72** / td 14.1 m/s 1.33 sink | lift 95 / roll **72** / td 14.1 m/s 1.33 sink | identical |
| stock / HOME 1100 m / expert | lift 96 / roll **62** / td 13.9 m/s 1.4 sink | lift 96 / roll **62** / td 13.9 m/s 1.4 sink | identical |
| stock / HOME 1100 m / student | lift 94 / roll **61** / td 13.9 m/s 0.79 sink | lift 94 / roll **61** / td 13.9 m/s 0.79 sink | identical |
| stock / mine 250 m / expert | lift 102 / roll **61** / td 14.1 m/s 1.07 sink | lift 102 / roll **61** / td 14.1 m/s 1.07 sink | identical |
| stock / mine 250 m / student | rejected-takeoff | rejected-takeoff | identical |
| stock / HOME->mine 250 m / expert | lift 5 / roll **60** / td 14.1 m/s 1.08 sink | lift 5 / roll **60** / td 14.1 m/s 1.08 sink | identical |
| stock / HOME->mine 250 m / student | rejected-takeoff | rejected-takeoff | identical |
| stock / w8 392 m soft / expert | gave-up (lift 108) | gave-up (lift 108) | identical |
| stock / w8 392 m soft / student | gave-up (lift 104) | gave-up (lift 104) | identical |
| stol / A4 340 m / expert | lift 47 / roll **55** / td 13.9 m/s 1.17 sink | lift 44 / roll **36** / td 12 m/s 1.35 sink [STOL] | moved |
| stol / A4 340 m / student | lift 48 / roll **73** / td 13.9 m/s 1.53 sink | lift 48 / roll **73** / td 13.9 m/s 1.53 sink | identical |
| stol / HOME 1100 m / expert | lift 47 / roll **61** / td 13.8 m/s 1.09 sink | lift 43 / roll **33** / td 12 m/s 1.35 sink [STOL] | moved |
| stol / HOME 1100 m / student | lift 48 / roll **67** / td 14 m/s 1.72 sink | lift 48 / roll **67** / td 14 m/s 1.72 sink | identical |
| stol / mine 250 m / expert | rejected-takeoff | rejected-takeoff | moved |
| stol / mine 250 m / student | rejected-takeoff | rejected-takeoff | identical |
| stol / HOME->mine 250 m / expert | rejected-takeoff | rejected-takeoff | moved |
| stol / HOME->mine 250 m / student | rejected-takeoff | rejected-takeoff | identical |
| stol / w8 392 m soft / expert | lift 49 / roll **51** / td 13.9 m/s 1.02 sink | lift 49 / roll **51** / td 13.9 m/s 1.02 sink | identical |
| stol / w8 392 m soft / student | lift 46 / roll **60** / td 13.9 m/s 1.43 sink | lift 46 / roll **60** / td 13.9 m/s 1.43 sink | identical |

READ IT: the showcase's landing roll **61 -> 33 m on HOME (-46 %), 55 -> 36 m on A4 (-35 %)**, the touch 13.8 -> 12.0 m/s
(1.14 -> 0.99 Vs0), its lift-off 47 -> 43 / 44 m; the stock Cub 62 / 58 m and the kit Cub 71 / 59 m - every leg of both the
same bits; the Student's legs on the showcase the same bits (a normal approach everywhere, the profile's own technique); w8 is
soft (surface 7: the soft technique stands). The two "moved" mine-strip rows are the same rejected take-off with the
departure planned 'short' (the verdict's numbers: 282 -> 339 m asked, 221 m left) - the BASE rejects them too: on the Jolene
island in node the showcase cannot take off from the mine strip nor from Jolene AFB (and `--stand` times out in the taxi);
the island has to be judged on the page (HANDOVER: what A0 runs).

## 6. The identity

`tools/_stol_samebits.js --root=<the merged base, 49387ca8, built>` and on this branch: the six validated builds (Cub, Jodel,
metal Cessna, Cessna floats, twin floats, Rufus - the game's load door) - def, 4 s of flight, drawing, design check + sheet,
the pilot's whole circuit - **identical, character for character** (`reports/evidence/STOL-PILOT/samebits_*.log`).
