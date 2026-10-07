# PILOT PERSONALITY — one pilot, many people (2026-10-05, PILOT-ONE G1943)

The user, 5 Oct: "The ultimate objective is to emulate pilot personalities, so we'll need the full model that can be
tuned, the most advanced possible, that we might even downgrade for emulating pilot quirks or abilities."

**The rule this design rests on: a downgrade is a PROFILE, never a fork.** There is one pilot (`43_pilot.js`, THE
PILOT, since PILOT-ONE retired the classic `40` and the test pilot `41`) and one servo module (`39b_servos.js`). A
personality is a set of numbers handed to `makePilot(sim, def, world, { profile })`. The servos' laws, the phase
machine, the planner and the judge are the same code for every person; what changes is how the person *uses* them:
how fast they see, how smoothly they move, what they choose, how far they will push.

## 1. The parameter set

`PILOT_PROFILES` (43_pilot.js) / `pilotProfile(p)` resolves a name or an object. Every field defaults to the expert's.

| group | field | unit | expert | what it does today (hook) |
|---|---|---|---|---|
| skill | `reaction` | s | 0 | a pure delay line on the stick and pedals (de, da, dr), per physics step |
| skill | `smooth` | × | 1 | multiplies the servo slew (`SV.slewK`): < 1 smoother and slower, > 1 snatchier |
| skill | `hamFist` | stick units rms | 0 | a deterministic Ornstein-Uhlenbeck disturbance (0.3 s) on de / da / dr, fixed seed |
| quirks | `overRotate` | rad | 0 | added to the rotation's attitude target (ROLL) |
| quirks | `flareK` | × | 1 | multiplies the flare height (< 1: a late flare) |
| limits | `bankK` | × | 1 | multiplies the circuit's bank limit (on top of the style's) |
| limits | `comfortG` | g | none | caps the bank at acos(1/g) |
| technique | `field` | — | null | forces the approach technique ('short' / 'normal'); null: the pilot's own choice from the strip |
| technique | `slip` | bool | false | the forward slip on ANY final high on energy at idle (the expert slips on short finals only) |
| technique | `stepHold` | bool | false | the step-attitude hold on the water (`servoStepHold`) |

The `style` (cautious / normal / brisk, `PILOT_STYLES`) stays what it was — the *margins* the planner and the judge
use (reject fraction, go-around heights, reserves). Style and profile compose: a cautious student, a brisk bush pilot.

**Bit-identity.** `PILOT_PROFILES.expert.active` is false and every hook is behind `PRA` (profile active): the expert
pilot is today's pilot to the bit (no delay line allocated, no random numbers drawn, `SV.slewK` unset; the slew's
`A.slew * (S.slewK || 1) * dt` is the same float as before).

**Determinism.** The ham-fist's disturbance comes from a fixed-seed generator (mulberry32, seed 1935) advanced once
per step; a profile's flight is the same flight every time, so a gate can hold a profile to numbers.

**Frame cost.** The pilot runs per physics step. The hooks cost a ring-buffer write and read (3 floats) and, for a
ham-fist, three Gaussian draws per step — nothing against the solver's step.

## 2. The example profiles

| profile | reaction | smooth | hamFist | quirks | limits | technique | who |
|---|---|---|---|---|---|---|---|
| `expert` | 0 | 1 | 0 | — | — | the pilot's own | today's pilot: the servo laws as tuned |
| `club` | 0.25 s | 0.8 | 0.005 | flare 0.95 | bank 0.9, 1.3 g | the pilot's own | a weekend pilot: a beat late, gentle hands |
| `student` | 0.45 s | 0.7 | 0.015 | over-rotates 2°, flares late (0.8) | bank 0.7, 1.15 g | always 'normal' | twenty hours in: slow, careful, flares late |
| `bush` | 0.15 s | 1.1 | 0.003 | — | bank 1.15, 1.6 g | always 'short', slips any final | lands in clearings: steep, slow, slips |
| `hamfist` | 0.2 s | 1.6 | 0.05 | over-rotates 1° | — | the pilot's own | big snatchy inputs, the aeroplane always moving |

GATE INPUT flies the `club` profile through the hand-flown handoff (its second slot, where the retired test pilot
flew), so the personality layer is exercised by the battery from day one.

## 3. What a personality is NOT

- Not a gain table. The servo gains (`SERVO_GAINS`, `SERVO_TUNE.pilot`) are the AEROPLANE's loop tuning — DMG-DAMP
  re-tunes them when the solver's damping changes; a person does not change the aeroplane's loop. A person changes
  what goes INTO the loops (targets, timing, noise) and what they CHOOSE (technique, limits).
- Not a second phase machine. Quirks are perturbations of the one machine's targets and timings.
- Not randomness per flight. A profile is a deterministic person; variety between flights is a seed (§5).

## 4. The hooks still to cut (the model to come)

Each of these is a numbered seam in 43, listed so the next session cuts one at a time and gates it:

1. **Tracking accuracy** — the pilot's tolerances: the slope's capture window (4 m), the centreline's (GA at gaXT), the
   speed band. A `precision` × on those windows (a student accepts 8 m off the slope where the expert corrects at 4).
2. **Drift** — a slow bias in the held heading / height (a student's attention): an integrated random walk on
   `ap.targetDir` and the altitude target, bounded, from the same seeded generator.
3. **Over-control** — a gain *the person* applies on top of the servo: the commanded attitude change × `overControl`
   (the ham-fist chases the needle). Distinct from `hamFist` (noise): this is a bias on the response.
4. **Late / early decisions** — the go-around's dwell (`gaT > 3`), the reject's (`phaseT > 7`), the flare trigger
   (`flareK`, done), the rotation speed (`vrK` × Vr), the gear/flap timings: a `decisionK` × on every dwell.
5. **Crab or slip** — the crosswind technique on final: the expert crabs and decrabs at 3.5 m (DECRAB); a `xwind:
   'slip'` profile flies wing-low from the FAF (the slip's rudder law is G1936's, signed by the crosswind).
6. **Soft / short field preferences** — `field` (done) plus the soft-field take-off (tail low, unstick early).
7. **Comfort** — `comfortG` (done for bank); a vertical-speed comfort (a passenger-carrying pilot descends at 500 fpm)
   and a pitch-attitude comfort.
8. **Fatigue** — reaction and precision degrading with flight time (a late-afternoon landing after a cross-country).
9. **Skill growth** — the player's own pilot learning: `reaction` and `precision` relaxing toward the expert's with
   logged landings (a profile is data; it can be saved with the player).

## 5. How a profile is chosen (UI, owed)

The flight menu keeps its three styles (auto / cautious / brisk). A profile row (Expert / Club / Student / Bush /
Ham-fist, and "the player's own" when §4.9 lands) belongs in the same flyout; `mkPilot` (app.js) and the worker's
(`sim_host.js`) pass `{ profile }` through as they pass `{ style }`. Not wired in PILOT-ONE: the hooks and the gate
come first; the menu is a one-line change once a profile has been flown and seen.

## 6. Measuring a person

A personality is judged with the instruments the expert is: pilot_trace's summary (the slope's rms, the touchdown
sink and point, the control reversals per minute per phase — GATE PILOTACT's counter), pilot_one_trace (the take-off
technique), pilot_one_turnaround. A profile ships with its own expected band (a student's sink 1.0-1.6 m/s, a bush
pilot's touchdown within 20 m of the aim) so a change to the pilot that moves a person is seen as such.
