# PROPELLER EFFECTS — THE GAP, ITS SIZE, AND WHETHER TO CLOSE IT
*2026-09-05. Written instead of code, at the user's ruling during the
UltraLight3 playtest pass ("pause this then, and replace with an assessment
of the physics gap we have there, impact, should we have it, how will it
move our existing fleet?").*

## 1. What the model has, and what it does not

The solver applies a propeller as ONE THING: a thrust force along the body
axis at each engine mount node (`30_solver.js` ~:234-253, `Tper = thr ·
max(0, Tstatic·kT − kV2·kV·V²)`, spread over `refs.engine`) and a scalar
propwash `wash` that raises the dynamic pressure of the strips flagged as
being in it. Nothing in it knows which way the propeller turns.

Four effects a real propeller has on a real aeroplane are therefore absent:

| effect | what it needs from the model | present? |
|---|---|---|
| **reaction torque** (the airframe rolls against the prop's spin) | a shaft speed: Q = P / ω | no rpm exists on a stock registry row (`60_gen_spec.js:1034` says it outright); custom rows carry one, defaulted 2300 |
| **P-factor** (asymmetric blade loading at alpha: the down-going blade pulls harder → yaw) | the disc's local angle of attack and a per-blade thrust distribution | no blade model; the disc is a point |
| **slipstream swirl** (the helical wash hits the fin off-centre → yaw) | a swirl velocity in the wash, and the fin's height above the thrust line | `wash` is a scalar; the fin strips read only its magnitude |
| **gyroscopic precession** (pitch rate → yaw, yaw rate → pitch, through the prop's angular momentum) | I_prop · ω | neither |

## 2. How big they are, on the aeroplanes we actually fly

Order-of-magnitude, from the registry's own numbers and standard estimates
(the wash swirl and the P-factor coefficients are the usual textbook
fractions; nothing here is measured on the sim).

**The user's ultralight** (two Rotax 582, 48 kW each, gearbox 2.62 → the
prop at ~2 480 rpm, D 1.91 m, wing-mounted at ±1.65 m):
- reaction torque per engine: Q = 48 000 / (2 480 · 2π / 60) ≈ **185 N·m**. Two
  engines same-hand: 370 N·m of roll — against a 11.8 m span, that is the
  roll of ~6° of aileron at cruise, ~15° at rotation speed. Counter-rotating:
  zero. On a wing-mounted pair the torque is a roll couple through the
  mounts, not a yaw.
- P-factor: at a 10° disc alpha (rotation, climb-out) the thrust vector walks
  ~4 % of D off-centre ≈ 4 cm; on a tractor pair with the thrust lines at
  ±1.65 m that is ±25 N·m of yaw per engine, cancelling in a counter-rotating
  pair, adding (50 N·m) same-hand. The fin's own authority at 15 m/s is ~350
  N·m per unit rudder; **0.15 of rudder** to hold straight — noticeable, not
  a departure.
- swirl on the fin: the wash of a wing-mounted engine does not pass over a
  single fin; on a twin-boom tail each fin sits in one engine's wash and the
  two swirls oppose. Same-hand: a small net yaw (~30 N·m); counter-rotating:
  none.
- gyroscopic: I_prop ≈ 0.4 kg·m² per 1.9 m carbon prop; at 260 rad/s and a
  rotation pitch rate of 0.3 rad/s: 30 N·m of yaw per engine. Small.

**A Cub-class single** (A-65, 48 kW at 2 300 rpm, D 1.88 m, nose-mounted,
one fin in the wash):
- torque: Q ≈ 200 N·m of LEFT roll at full power — the aileron holds it with
  ~5° at climb speed; the reason a real Cub's left wing is heavy on the
  climb.
- P-factor at 12° alpha on the roll: ≈ 40 N·m of left yaw; swirl on the fin:
  ≈ 60 N·m left; together **~100 N·m of left yaw at rotation** against a fin
  of ~250 N·m per unit rudder → ~0.4 of rudder, which is exactly the "right
  rudder on the take-off roll" every taildragger pilot is taught. This is the
  one place the gap is FELT: our single-engine taildraggers roll dead
  straight at full power, and a pilot who knows aeroplanes notices.
- gyroscopic on the tail-up: pitching the tail up at 0.4 rad/s swings the
  nose left by ~40 N·m for the second it takes. Part of the same lesson.

**A twin in general** (the game's wing pair): the effects that matter are
the ones that DIFFER between the two engines — which is exactly what
counter-rotation removes. With a `sense` per engine the model can say
"critical engine": one engine out, the live engine's P-factor and swirl
add to its thrust asymmetry on one side and subtract on the other.

## 3. Should we have it?

**The honest answer is: the single-engine taildragger take-off wants it,
and nothing else does yet.** The effects are 5–15 % of control authority
at the worst moment (rotation, full power, low q); the game's pilots would
hold them without difficulty, and the player would see a rudder deflection
on the roll where today there is none. Everything else — cruise, approach,
the twin — moves by an amount under the model's own noise.

Two of the four are cheap and honest; two are not:
- **torque and swirl are one line each** once there is a shaft speed:
  `Q = P/ω` as a roll couple at the mount, and a swirl yaw `N = k_s · T · D`
  on the fin strips in the wash (k_s ≈ 0.02–0.04 from the helix angle),
  signed by `sense`. Their whole cost is THE SHAFT SPEED: a registry row
  would need `rpm` (and the reduction) — a real number per engine, which the
  bench already has for the drawn ones (`engResolve` returns `rpm`).
- **P-factor needs a disc alpha**, which the point-thrust model can approximate
  (the body alpha at the mount, `N = k_p · T · D · alpha`) but cannot
  measure; and **gyroscopic needs I_prop**, which the drawn propeller could
  supply (blades, chord, material) and the registry cannot. Both would be
  declared constants dressed as physics.

**Recommendation.** Ship `sense` as spec truth now (it costs nothing and the
twin's `critical engine` question needs it later); add torque and swirl
TOGETHER with a shaft speed on every registry row, as one chantier, gated
by a roll test on the Cub-class default (measured aileron to hold wings
level at full power in the climb: 3–8°) and a yaw test on the roll (measured
rudder to hold the centreline: 0.2–0.5). Leave P-factor and gyroscopic on
this list until a blade model exists — a constant dressed as physics is the
"DEFDAMP claim" of G115 again. Until then, HANDOVER says what the registry
says of the R-1830's missing blower: same-hand and counter-rotating pairs
fly identically, and there is no critical engine.

## 4. How it would move the existing builds

- **Every single-engine build**: a standing left roll at full power (torque)
  and a left yaw on the take-off roll and the climb (swirl). The autopilots'
  `airLateral` already carries a standing-bank trim (`eTrim`, for wind) and
  the ground steer a P-D on heading; both would absorb a few degrees of
  standing input without retuning, but the CALM GATES' numbers move: the
  aileron and rudder traces stop being zero, the take-off run gains a metre
  or two of scrub, and every "straight roll" assertion needs the tolerance
  the crosswind cases already have (GATE TAKEOFF: 4 m calm / 8 m wind).
- **The wing-mounted twin, same-hand**: a roll couple of ~370 N·m — the
  ailerons hold it (measured authority ~2 000 N·m per unit at cruise) but it
  is a standing 0.2 of aileron on the climb, and the plaque's "flies a
  circuit" would still say so.
- **Counter-rotating pairs**: unchanged by construction.
- **Reference planes** (pa18, c172): they are display-only since G184, so
  nothing.
- **GATE GEN / ARCHETYPES**: ~20 archetypes re-flown; the singles' circuit
  numbers move by the trims above, none of them by more than the wind cases
  already move them. A one-day re-baseline, not a re-tune.

## 5. What was done instead, in the playtest pass

`engines[i].sense` (+1 clockwise from behind, the Lycoming hand; absent = 1)
is stored, survives the wing pair's mirror clamp as the one field the two
entries may disagree on, is set by the editor's `rotation (pair)` row, and
turns the drawn propellers the right way. The per-engine levers
(`ctl.eng[i] = { on, thr }`, a multiplier on the pilot's throttle) give the
twin a real yaw couple through its two mount nodes with no new physics at
all — an engine cut is 100 % asymmetric thrust, which the model already
carries exactly.
