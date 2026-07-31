# Session 10 — the plant, not the controller

Fresh pass over the code with the handover in hand. Three of the handover's own
priorities turn out to rest on claims that do not survive measurement, and the
thing that does block locomotion is one layer below where sessions 5–9 were
looking: not the actuator's *strength*, its *bandwidth*, and not the controller's
command, the body's reproduction of it.

Gate at close: **GREEN, 80 assertions, 76 passed, 0 failed, 4 pending, 3310
checks** — unchanged. Everything added is a tool or a default-off option.

## 57. Headline: a 13-segment chain swims at efficiency 0.93

`tools/_wave.mjs`, 12-segment self-connected chain, gravity 0, 15 s:

| actuator | lag | net m/s | CoM path m/s | efficiency |
|---|---|---|---|---|
| pd (shipped) | pi/2 | 0.137 | 3.263 | **0.042** |
| solver, budget gains | pi/2 | 0.150 | 0.161 | **0.933** |
| solver, 25 Hz zeta 0.9 | pi/2, omega 8 | **0.578** | 0.810 | 0.714 |
| solver, 25 Hz zeta 0.9 | pi/4, omega 8 | **0.734** | 2.389 | 0.307 |

Against the previous best anywhere in this project — net 0.03–0.10 m/s,
efficiency 0.19 designed / 0.03 random. **Six times the speed and twenty times
the efficiency, at once**, and 0.93 is a fish.

And the physics check §56 asks for lands hard. Through the shipped PD a pi/2
travelling wave beats unison on efficiency by **1.6x**. Through the solver motor
it beats it by **68x**. The signal was always there; the PD was eating it.

## 58. Why the serpent was never a serpent — and it is not `maxRecursion`

§49 concluded "the slice cannot build a serpent: `SLICE_LIMITS.maxRecursion` is
2, so a self-connected chain terminates at three segments", and the handover
lists raising it as priority 2, "one line".

**`SLICE_LIMITS.maxRecursion` is not in the path.** It is read by
`factory.js:103` and `mutate.js:226` — the *random* genome generator. Hand-written
seeds go straight to `morphogenesis`, which never consults it. Raising it changes
nothing about any designed body.

What actually caps the chain is the seed genome's own `parentFace: 0`.
`makeJointData` attaches the child by **its own -Z face**, so a connection on the
parent's **+X** face is a ninety-degree turn. The chain is a staircase, it
spirals back into itself, and `obbOverlap` rejects the fourth segment. Measured,
`recursiveLimit` 4, 6, 8 and 10 all give exactly 4 bodies, `rejected.overlap` 1.

Attach on the face the child grows out of and the same slice, unmodified:

    parentFace 0  ->  3 bodies   rejected {overlap: 1}   span [0.79, 0.00, 0.71]
    parentFace 4  ->  9 bodies   rejected {}             span [0.00, 2.14, 1.93]
    parentFace 5  -> 13 bodies   rejected {}             span [0.00, 0.00, 6.49]

Thirteen bodies, 6.5 m, zero rejections, `recursiveLimit` 12. **The slice could
always build a serpent.** Every efficiency figure in §48 was measured on a
3+1 staircase, and §51's "raise maxRecursion before drawing conclusions about
morphology" should be struck and replaced with "fix the seed's parentFace".

## 59. The actuator is parametrised by the wrong two numbers

Both shipped paths set the joint's spring and damper **from the torque budget**:
`k = budget * MOTOR_STIFFNESS`, `c = budget * MOTOR_DAMPING`, with
`budget = MUSCLE_STRESS * A^1.5 * momentArm`. That fixes the joint's *strength*
and leaves its dynamics to fall out of whatever inertia the limb happens to have.

`MOTOR_STIFFNESS 1.0` and `MOTOR_DAMPING 0.12` were tuned for the PD, where they
scaled a torque **clamp** and were dimensionless fractions. In the solver they
are the spring and damper **coefficients**. Nobody re-derived them, and the
resulting second-order system is nobody's decision. Measured (`tools/_gains.mjs`,
161 joints):

    omega_n = sqrt(k/I)      p05    2      p50    9      p95   38   rad/s
    zeta = c/(2 sqrt(kI))    p05  0.1      p50  0.5      p95  2.3

The controller commands 1–3 rad/s. **The slowest joints sit at or below their own
corner frequency** while the fastest sit a decade above it, and a second-order
system's phase lag is a function of omega/omega_n. So each joint adds its own
uncontrolled lag, set by its geometry.

The reference specifies the *other* two numbers — SpringFrequency 10 Hz,
DampingRatio 0.9 — and lets torque follow. At 10 Hz against a 1–3 rad/s command
every joint sits at omega/omega_n < 0.05, where gain is 1.00 and lag is a few
degrees **for every joint whatever its size**. That is not a tuning preference.
It is what makes a commanded phase relationship a real phase relationship, and
it is the reason their creatures can carry a travelling wave and ours could not.

Added as `opts.motorFreqHz` / `opts.motorZeta`, default off, in the solver branch.

## 60. The measurement that shows it: per-joint gain and phase

`tools/_bode.mjs` — lock-in (quadrature) detection of each joint's achieved angle
against its own commanded sine, on the joint's real axis, 12 s after settle.
Random corpus, 90 joints:

| | tracking gain p50 | within 20% of 1.0 | lag p50 | lag p05–p95 |
|---|---|---|---|---|
| pd | 0.57 | 17% | 62 deg | **7 – 162** |
| solver, budget gains | 0.66 | 12% | 38 deg | **4 – 152** |
| solver, 10 Hz | 0.78 | 23% | 29 deg | 1 – 153 |

**A commanded pi/2 travelling wave cannot survive a plant that adds an
uncontrolled 150 degrees of its own.** This is the mechanism behind §11's "phase
made no difference", §12's weak morphology correlations, and §53's "steering is
downstream of gait coherence" — the gait was never coherent as commanded.

Raising the natural frequency moves the median hard (62 -> 29 deg) and leaves the
p95 tail at 150. The tail has a name, below.

## 61. 42% of joints have no solver motor at all

Rapier's JS binding exposes motors on revolute-family joints only. `physics.js`
records this — "spherical has no `configureMotorPosition`, so those joints keep
the PD" — as a caveat. It is not a caveat, it is nearly half the actuators, and
it is the worse half. Split by drive path at 10 Hz:

    solver-driven (revolute, twist)   n=52   gain p50 0.78  p95  1.08   lag p50 12  p95 140
    PD fallback (spherical)           n=38   gain p50 0.96  p95 10.88   lag p50 61  p95 160

Gain p95 **10.9** — those joints move eleven times the amplitude they are told
to. That is the relay, still running, on 42% of the corpus after the solver motor
"lands". **"Default the solver motor" is not a complete fix and the handover
should not read as though it were.** Either drive spherical joints as three
revolute constraints, or exclude spherical from the slice for locomotion work,
or accept that a measured corpus mixes two actuators with a 10x amplitude
difference between them.

## 62. There is no `setMotorMaxForce` in this binding

§44 planned to preserve N19 by setting "the motor's max force from the same
`minCrossSectionalArea` the current clamp uses, with a comment". Checked against
rapier3d-compat 0.19.3: the `ImpulseJoint` prototype chain exposes
`configureMotor`, `configureMotorModel`, `configureMotorPosition`,
`configureMotorVelocity`, `setLimits`, `setContactsEnabled` — **and nothing for
maximum force or impulse**. The reference's `MaxImpulse = 2 * A` has no
equivalent here.

So the current code did the only thing available: it put the budget in the
*stiffness*. That is a different physical statement — it bounds torque per unit
of tracking error rather than bounding torque — and **bounded actuator power
(00 §9) is silently not enforced on the solver path**. The comment claiming N19
survives the move is true about where the number comes from and false about what
it does. Either the binding needs a newer version, or the bound has to be
reimposed outside the solver, or 00 §9 needs amending for this path. It should
not stay unstated.

## 63. Two tools have been measuring the wrong axis

`tools/_track.mjs:35` and `tools/_amp.mjs:35` both read

    swingTwistAngle(..., j.axisLocal ?? [1,0,0])

There is no `axisLocal` field anywhere in `engine/`. The fallback always fires,
so both have measured the swing-twist angle about the **parent body's X axis**
rather than about the joint's axis, which `physics.js` computes as
`normalise(qrot(parentLimbRotation, j.axes.x | j.axes.z))` and does not export.
Every achieved-versus-commanded sweep those two tools produced is about an
arbitrary axis. §29's tracking table is in that category.

`_bode.mjs`, `_bias.mjs` and `_wave.mjs` recompute the axis correctly. Exporting
`jointAxisAtSpawn` would stop this recurring.

## 64. A hypothesis that failed, recorded so it is not re-run

`TURN_AUTHORITY` is 1.0 and the steering term is `side * turnBias * 1.0 * range`,
added on top of `bias + amplitude*range*sin(...)`, against a joint limited to
+/- range. At |turnBias| = 1 the steering term alone consumes the joint's entire
travel. The obvious hypothesis — steering does not merely fail to aim the gait,
it *erases* it — is **wrong**. Measured (`tools/_bias.mjs`, PD, n=25):

    turnBias   clipped%   gait gain   CoM path m/s   net m/s   eff
       0          15        0.515        2.700       0.0972   0.048
       1          50        0.741        2.481       0.0849   0.036

Commanded clipping does rise from 15% to 50% of joint-steps, exactly as
predicted. The gait amplitude does not collapse — it *rises*, because more
command offset means more saturation means a livelier limit cycle. §53's reading
stands as written.

Worth keeping anyway: **15% of joint-steps are commanded outside the joint's own
limit at turnBias 0**, and 62% of joints overrun for part of every cycle. The
genome can ask for `|bias| + amplitude*range > range` and routinely does.

## 65. What this changes about the ordered next steps

The handover's list, revised:

1. **Finish the solver motor and default it** — stands, and it is still first.
   Its two blockers are unchanged and both confirmed: `work` does not accumulate
   on the solver path (visible as `CoT n/a` in every solver row above), and L1-18
   needs model-agnostic treatment. Add a third: **spherical joints (§61)**.
2. ~~Raise `maxRecursion`~~ — **strike it.** It is not in the path for designed
   bodies (§58). Fix `tools/_seed.mjs`'s `parentFace` instead.
3. **Cost of transport into fitness** — stands, and it is blocked on 1, because
   the solver path has no energy number at all.
4. **Enable grafting** — stands, untouched this session.
5. **Run evolution properly** — stands, and it is now worth doing, because for
   the first time there is a fitness landscape with a real optimum in it: net
   speed rises monotonically with gait frequency under the solver motor
   (0.06 -> 0.19 m/s across omega 1 to 8 at budget gains) and *falls* under the
   PD (0.13 -> 0.03). Selection on the PD was climbing a hill that was not there.
6. **Re-measure steering** — stands, and §60 says why it should be re-measured
   rather than engineered: at lag spread 150 degrees there was no coherent
   velocity vector for a bias to rotate. Re-run `_aim.mjs` on the solver motor
   with a chain body before concluding anything.
7. Sensors and an evolved controller — unchanged, still L2/L3 scope.

New, and cheap:

8. **Decide the actuator parametrisation deliberately** (§59). `motorFreqHz`
   makes it a choice rather than an accident. The sweep says budget gains buy
   efficiency (0.93) and high natural frequency buys speed (0.73 m/s at 25 Hz),
   and that trade is a design decision about what a creature is, not a constant
   to tune.
9. **State the 00 §9 gap** (§62) rather than leaving a comment that says N19
   survives when what survives is the number, not the bound.
10. **Export `jointAxisAtSpawn`** and fix the two tools (§63).

## 66. The assertion §56 asked for, now cheap and sharp

    A pi/2 travelling wave on a self-connected chain must beat unison on
    efficiency.

Through the shipped PD this passes at 1.6x — weakly enough that it would have
been argued about. Through the solver motor it passes at 68x. Assert it at,
say, 3x, on `_wave.mjs`'s chain: it is a two-second test, it is a direct
statement about the fluid model, and it fails loudly the moment the actuator
stops reproducing commanded phase.

## 67. Tools added

| tool | answers |
|---|---|
| `_gains.mjs` | what natural frequency and damping ratio do the shipped gains actually produce? |
| `_bode.mjs` | per-joint tracking gain and phase lag, by joint type and drive path |
| `_wave.mjs` | the travelling-wave test on a real long chain, across actuator tunings |
| `_sweep.mjs` | gait frequency x actuator tuning, net speed / efficiency / CoT |
| `_bias.mjs` | what `turnBias` does to clipping, gait amplitude and travel |

## 68. Diff

`engine/l1/physics.js` only, additive:

- new `opts.motorFreqHz` (default `null`) and `opts.motorZeta` (default `0.9`);
- in the solver-motor branch, when `motorFreqHz` is set, `k = I*wn^2` and
  `c = 2*zeta*I*wn` from the child limb's smallest principal inertia instead of
  from the torque budget.

Default path is byte-identical. Gate unchanged at 80/76/0/4.

---

# Session 10b — they can orient. The loop was open by construction.

## 69. Pursuit closes to 1 cm

Same 12-segment chain, solver motor, target 6 m away at ninety degrees off the
initial heading, 60 s, `turnBias` set from the bearing every step
(`tools/_plane.mjs`):

| actuator | plane the bearing is taken in | sign | closest approach |
|---|---|---|---|
| solver, budget gains | yaw (x,z) | + | 6.00 m — never closed |
| solver, budget gains | yaw (x,z) | − | 6.00 m — never closed |
| solver, budget gains | **pitch (z,y)** | + | **0.01 m** |
| solver, 10 Hz | yaw (x,z) | ± | 6.00 m — never closed |
| solver, 10 Hz | **pitch (z,y)** | + | **0.20 m** |
| solver, 10 Hz | **pitch (z,y)** | − | **0.98 m** |

**Three of four pitch-plane runs reach the target. All four yaw-plane runs fail
to close a single centimetre.** Same body, same actuator, same controller, same
gain — the only difference is which two coordinates the bearing is computed from.

## 70. The mechanism: the input and the feedback are in different planes

`jointAxisAtSpawn` gives a `revolute` joint the limb's **local X**. A Z-axial
chain therefore bends in the **Y-Z plane**: it pitches. Uniform bias curls it in
that plane, and the undulation runs in that plane too, so the creature is a fish
swimming *vertically*.

`turnSides` decides which side a joint is on from
`bodies[child].position[0] - rootX` — the lateral offset **along X**, which is
the axis the joint rotates *about*. For a chain with no X extent the fallback
gives `+1` to every joint, which the controller's comment already anticipates
("a uniform bias curls the whole chain into an arc, and a curled swimming body
turns"). That part is right and it works.

What is not right is everything downstream. `duel.js:189`:

    export function bearingTo(sim, target) { ... Math.atan2(fx, fz) ... }

with a comment stating the choice outright — "horizontal: a bearing is a compass
bearing, and an opponent directly above is..." — and `duel.js:172` places the
opponent at `[dir[0]*half*sign, 0, dir[2]*half*sign]`, purely horizontal
separation, same height. `tools/_aim.mjs` does the same. So the sensor measures
yaw, `sensorTurnBias` converts it to `turnBias`, and `turnBias` actuates pitch.

**The control loop has never been closed. Not poorly closed — open, by
construction, in the coordinate convention.** No amount of gait quality could
have fixed that, which is why session 9's 0/30 was a hard zero rather than a
weak signal.

## 71. Session 9's conclusion is wrong, and its test was the wrong test

§53: "Direction control is DOWNSTREAM of gait coherence... at efficiency 0.19
there is not enough coherent thrust for a bias to steer." Measured on a body at
efficiency 0.93, yaw response is still **exactly zero** (0.0, −0.2, −0.2, 0.2,
−0.1, 0.9, −1.2 deg/s across the full bias sweep). Gait coherence was not the
gate.

The open-loop **monotonicity** criterion was also the wrong instrument. Even in
the pitch plane the open-loop map is not monotone, and pursuit closes anyway: a
feedback loop does not need a monotone plant, it needs the right sign locally
and enough authority. §52's "3% monotone, therefore chaos not control" drew a
conclusion about controllability from a test that does not measure it. The
closed-loop run is cheap; it should have been the primary measurement all along.

What `turnBias` does deliver, on the good swimmer: total turn rate rises from
4.3 deg/s at bias 0 to **41.4 deg/s at bias 1**, and costs efficiency
(0.90 → 0.30) and speed (0.27 → 0.15 m/s). That is a normal steering trade, and
it is plenty of authority.

## 72. What to fix, and it is small

Two candidate repairs, and they are not equivalent:

1. **Make the convention match the mechanism.** Have `bearingTo` and the S3
   `turnRate` probe work in the creature's own bend plane rather than in world
   xz, and let `duel.js` separate opponents in that plane too. Correct, and it
   generalises to bodies whose bend plane is neither horizontal nor vertical —
   but "the creature's bend plane" is not currently a quantity anything computes.
2. **Make the mechanism match the convention.** Give the creature a second
   steering channel on a perpendicular axis, so `turnBias` can command yaw
   directly. That is what a real fish has (pectoral fins pitch, body yaw), and
   it is what `turnSides`'s mirrored-limb path was designed for — it just never
   fires, because `SLICE_LIMITS` caps reflections at 1 and most factory genomes
   set none.

The honest reading is that (1) is the bug fix and (2) is the feature. Do (1)
first: it is a coordinate change, it is testable in an afternoon, and it turns
`0/30 pursuit` into something that already works.

## 73. Distance to "creatures that orient themselves and swim to a target"

For a **hand-authored** body: **done**, today, 0.01 m closest approach on a 6 m
target. It needs the bearing taken in the right plane and nothing else.

For an **evolved** body, the remaining chain is short and all of it is already
on the list:

- close the coordinate mismatch (§72) — days;
- default the solver motor, which needs `work` accounting and the spherical-joint
  hole (§61) — the largest remaining piece;
- put efficiency or cost of transport in the objective, so selection can see the
  difference between a swimmer and a vibrator;
- run evolution with a *turning* fitness. Sims' light-following creatures were
  not evolved for displacement and then asked to turn; they were selected on
  reaching the light. Nothing here has ever been selected for turning, and the
  bias→heading map is a property of the body that only selection can shape.

That last point is the real remaining gap and it is a scope question, not a
defect: an open-loop `turnBias` on an unselected morphology has no reason to be
well-behaved. Sensors and an evolved controller remain L2/L3 scope — but the
demo does not need them. A fixed CPG, a bearing sensor in the right plane, and
selection on distance-to-target is enough, and every piece of that exists now.

## 74. Tools added, 10b

| tool | answers |
|---|---|
| `_orient.mjs` | open-loop turn authority and closed-loop pursuit on a swimming body |
| `_plane.mjs` | which plane does `turnBias` steer in, and does pursuit close in that plane? |

---

# Session 10c — a correction, and the authored library

## 75. CORRECTION: §69 was wrong. Pursuit does not close.

§69 reported closest approach 0.01 m and called it "they can orient". **The
target was directly ahead.** `_plane.mjs`'s pursuit placed it at
`target[a] += TARGET_R` where `a` is the *first* axis of the plane pair — for the
pitch plane `[2,1]` that is **z**, which is the axis the chain already swims
along. The comment on the line says "90 degrees off the initial heading". It was
zero degrees off. The creature swam in a straight line and arrived.

Measured properly (`tools/_chase.mjs`), closest approach against target bearing
*in the bend plane*, 6 m target, 60 s:

| body / actuator | 0° | 30° | 60° | 90° | 135° | 180° |
|---|---|---|---|---|---|---|
| 7-seg, solver | 5.20 | 5.25 | 5.65 | 5.95 | 6.00 | 6.00 |
| 7-seg, solver 10 Hz | 2.93 | 3.79 | 5.35 | 5.82 | 5.92 | 5.95 |
| 13-seg, solver | **0.01** | 2.87 | 5.13 | 5.99 | 6.00 | 6.00 |
| 13-seg, solver 10 Hz | **0.20** | 2.65 | 5.04 | 5.97 | 5.76 | 5.95 |

Only the 0° column closes. At 30° the creature recovers about half the distance;
at 60° it barely moves toward the target; at 90° and beyond it does not close a
single centimetre.

**What is true:** a creature can hold a heading and home on a target inside a
narrow forward cone, roughly ±30°. **What is not true:** that it can orient. It
cannot turn to face something beside or behind it, and §69's headline should be
struck.

The rest of 10b stands and is unaffected: turnBias produces near-zero yaw and a
real out-of-plane turn (4 → 41 deg/s), the `duel.js` bearing is horizontal while
the actuation is not, and gait coherence was not the gate. The convention
mismatch is still a real defect. It is just not the *only* thing between here and
a creature that orients — steering authority is genuinely short as well, and
§72's option (2), a second steering channel, moves from "the feature" to
"probably required".

Recorded at length because this is the §33 failure repeating: a striking number
was produced, it agreed with what I wanted, and I did not check the one line that
made it. The bearing sweep costs ninety seconds and would have caught it.

## 76. The Atlas: what exists

`ui/screens/atlas.js` is nine lines and a placeholder:

    // Specimens and records are stored correctly from B1; the Atlas UI is step F.

**That comment is false.** `trunk/store.js` exports a full envelope + migration +
quota layer and `KEY.specimen`, `KEY.lineage`, `KEY.run` — and grepping the whole
tree for `KEY.` outside `store.js` returns nothing. The only three writes in the
app are `vivarium:seed` in `tank.js` and two dev-panel preferences. **No genome,
no specimen and no record has ever been persisted.** The tank is regenerated from
one integer on every load.

So the honest state is: the storage *machinery* is built and gated; the
*call sites* do not exist; the Atlas tab is a stub. That is a smaller gap than it
sounds, because the hard parts — `serialise` / `deserialise` / `genomeHash` /
`validateGenome` / the migration registry / the `FutureVersionError` path — are
all present and all tested.

## 77. `worlds/seeds.js` — authored creatures as real genomes

Six hand-written specimens in the shipping schema. Every one passes
`validateGenome`, round-trips `serialise -> deserialise -> serialise` byte-exact,
and hashes stably:

| id | name | bodies | pd eff | solver eff | note |
|---|---|---|---|---|---|
| `eel` | Eel | 7 | 0.023 | **0.787** | the reference undulator, pi/2 wave |
| `eel-fast` | Darter | 7 | 0.013 | 0.128 | pi/4 wave at omega 6 |
| `eel-slow` | Drifter | 7 | 0.010 | 0.786 | long wave, omega 1.5 |
| `eel-unison` | Flapper | 7 | 0.035 | **0.015** | CONTROL: zero lag |
| `eel-finned` | Paddletail | 7 | 0.014 | **0.935** | eel + caudal fin |
| `staircase` | Staircase | 3 | 0.006 | 0.101 | counter-example, parentFace 0 |

The pi/2 wave beats unison on efficiency by **52x** on a legal genome, and the
shipped PD scores 0.006–0.035 across the entire library — a range narrower than
the measurement noise, which is what "the relay erased the difference between a
designed swimmer and a random tangle" looks like when you can see all six at once.

## 78. Two illegal genomes, found only by validating

Session 10's headline body was **not a legal genome**, and nothing caught it
because hand-written seeds never went through `validateGenome`:

    RANGE.recursiveLimit  [1, 6]      the 13-segment chain used 12
    RANGE.omega           [0.5, 6.0]  the fastest sweep rows used 8

The physics was real; the creature was not expressible, could not be saved, could
not be bred and could not be shared. `SLICE_LIMITS` is not this bound — that
clamps the random factory only — and neither is `CAPS.maxBodies`. On legal genes
the result survives, smaller: efficiency 0.94 rather than 0.93, 7 bodies rather
than 13. The speed numbers do not survive: omega 8 is simply unavailable.

**Everything hand-authored must go through `validateGenome` at the door.**
`tools/_atlas.mjs` now does, and the library is clean.

## 79. `tools/_atlas.mjs` and `atlas.html`

Validates, round-trips, hashes, swims and chases every seed, then writes a
self-contained page: two orthographic projections drawn straight from
`morphogenesis` output (top z-x and side z-y, the second being the bend plane),
the measured numbers, and the genome JSON in a copyable block.

It is not the Atlas screen. It is the Atlas screen's data layer, proved out
headlessly, plus something to look at today.

## 80. What the in-game Atlas needs, smallest first

1. **Write specimens.** `store.set(KEY.specimen(hash), envelope(genome, 'genome'))`
   on selection in the tank. One call site; everything under it exists.
2. **List them.** `store.list('specimen:')` -> the Atlas grid. The card content is
   already specified by what `_atlas.mjs` renders.
3. **Import / export.** `serialise` and `deserialise` are the fiche format
   already. A textarea and two buttons; `FutureVersionError` is already the
   right failure.
4. **Ship `worlds/seeds.js` as the starting Atlas** so the tab is not empty on
   first run, and strip it at release if the authored bodies should not be part
   of the shipped fauna — one import.
5. Only then: rendering the creature in the Atlas card from the live three.js
   renderer rather than from a baked SVG.

Steps 1–3 are an afternoon and they turn authored creatures into things the game
owns rather than things a tool prints.

## 81. Tools added, 10c

| tool | answers |
|---|---|
| `_chase.mjs` | closest approach against target BEARING — the test §69 should have run |
| `_atlas.mjs` | validate, round-trip, hash, measure and draw the authored library |

---

# Session 10d — where the incentive comes from, and why the obvious objective is a fraud

## 82. The incentive model, stated plainly

A creature has no motivation. It cannot want the light. What every creature
already has is `engine/l2/duel.js senseOpponent`:

    bearing  = bearingTo(sim, target)                  // sensed, -1..+1
    turnBias = preyGain*bearing + threatGain*bearing   // sensorTurnBias()

`preyGain` and `threatGain` are **genes**, `RANGE [-1, 1]`, and `genome.js` says
of them: *"sign is EVOLVED, not declared (P2)"*. `duel.js` says it again: *"Each
sees the other on its threat AND its prey channel — the creature's own evolved
gains decide whether it approaches or avoids. NOTHING ASSIGNS ROLES."*

So the closed loop from "where is the target" to "which way do I bend" is
**already wired in every creature that exists**. A creature with net gain +0.8
turns toward, one with −0.8 turns away, one with 0.0 ignores the target
completely. All three are legal today and nothing in the code prefers any of them.

**The incentive is not in the creature. It is in the trial.** Put a target at a
random bearing, run 30 s, score the fraction of distance closed, breed the top
scorers. Lineages whose gain has the right sign close distance; the rest do not;
after enough generations the population chases. That is the whole of Sims'
light-following, and the only missing piece is the trial. Manual selection —
looking at six creatures and picking two — is exactly the same operator with the
player as the fitness function; the automated version replaces the eye with a
number, and needs nothing else.

## 83. The obvious objective is a speed metric wearing a costume

Wrote the trial. It discriminates beautifully — seek score p10 0.04, p90 0.41,
CV 0.85 over a 26-creature corpus. Then checked what it was measuring.

    Spearman, seek score vs ...
      netSpeed                     0.90
      preyGain + threatGain       -0.02

**The score is 90% explained by raw speed and has no relationship to the sensor
gene at all.** A fast creature closes distance on a target at any bearing simply
by covering ground. Select on this and you breed fast swimmers while the sensor
gain drifts free — the session 9 trap ("displacement-only selection breeds
efficient thrashers") one level up, and it would have looked like it was working.

The fix is a **control run**. Score the creature twice, once with its sensor live
and once with `turnBias` forced to zero, and take the difference:

    benefit = score(sensor live) - score(sensor disabled)

Measured over 20 creatures:

| | |
|---|---|
| score vs control — *is score just speed?* | **0.98** |
| benefit vs control — *is benefit just speed?* | **0.07** |
| benefit vs netGain — *does the gene move it?* | **0.49** |

Control subtraction works. The raw score is 98% the control; the benefit is
independent of speed and is a real function of the gene. **That is the objective
to auto-breed on, and it costs exactly one extra run per creature.**

## 84. But there is nothing to select yet

    benefit: mean 0.003   min -0.006   max 0.034
    sensor HELPS (benefit > 0.02):  2/20
    sensor HURTS (benefit < -0.02): 0/20

And on fixed authored bodies, sweeping the gain by hand:

| body | −1 | −0.5 | **0** | 0.5 | 1 | 2 |
|---|---|---|---|---|---|---|
| eel | 0.144 | 0.121 | **0.130** | 0.147 | 0.078 | 0.045 |
| eel-finned | 0.148 | 0.136 | **0.156** | 0.158 | 0.126 | 0.116 |

Column 0 is the sensor switched off. **No gain reliably beats swimming straight.**
The best swimmer in the library, at efficiency 0.94, gets its highest seek score
with the sensor disabled.

So the objective is now correctly designed and the plant has nothing for it to
grip. That is a cleaner statement of the same gap as §75: steering authority in
the plane the feedback is measured in is approximately zero, and until that is
fixed, selection on seeking is selection on noise.

## 85. S3's `turnRate` is measuring the wrong plane

`probes.js` S3 is careful work — it runs the bias both ways and takes half the
difference precisely so that an intrinsic curl cancels, which is the right idea
and a real improvement on 11 §5. But it reads `headingOf`, which is

    Math.atan2(f[0], f[2])                        // probe.js:116

a compass bearing. A chain bends about its limbs' local X and turns in **pitch**,
where a compass bearing is identically zero. So `turnRate` — *the field N21
clamps every L3 steering decision by* — reads near-zero for exactly the bodies
that turn best. Measured in 3-D on the same corpus, `turnRate3d` spreads p10 0.02
to p90 0.23, CV 0.83: there is a real quantity there, and S3 cannot see it.

Same defect as `bearingTo`, in a second place, and this one is recorded in the
contract as a producer.

## 86. THE PARAMETER SET — what to select on, and what to ignore

The question that matters for auto-breeding. Grouped by whether the number can
be trusted **today**:

**Trustworthy now, selectable now**

| field | what it is | why |
|---|---|---|
| `netSpeed` | net displacement / duration | the honest travel speed |
| `comSpeed` | CoM path length / duration | how hard the body is working |
| `efficiency` | `netSpeed / comSpeed` | 0.9 fish, 0.02 thrasher. The single best one-number discriminator in the project |
| `massBase`, `boundingRadius`, `frontalArea`, `reach` | S1 morphometrics | free, no simulation, no actuator in the path |
| `bodyCount`, `jointCount`, `dofCount` | structure | ditto |

**Correct once the solver motor defaults** (blocked on `work` accounting, §65)

| field | why blocked |
|---|---|
| `costOfTransport` | `work` does not accumulate on the solver path — reads `n/a` in every solver run this session |
| `basalRate`, `cotC0`, `cotC1` | same accumulator |

**Do not select on these yet**

| field | why |
|---|---|
| `turnRate`, `turnRadius`, `turnSpeedRatio` | S3 measures yaw; the bodies turn in pitch (§85) |
| `burstSpeed`, `burstRatio`, `burstDuration` | the handover already says the actuator cannot produce the burst these describe |
| `pursuitGain`, `evasionGain` | `producer: 'fixture'` — never measured, S4/S5 deferred |
| raw seek score | 0.98 a speed proxy (§83) |

**To add**

| field | definition |
|---|---|
| `turnRate3d` | S3's both-directions differencing, in 3-D instead of yaw |
| `intrinsicCurl` | the half-*sum* S3 already computes and discards — a strong curl is a real property |
| `seekBenefit` | `score(sensor live) − score(sensor off)`, over targets spread around the creature |
| `steerCost` | efficiency at full bias / efficiency at zero bias — measured 0.90 → 0.30, a real trade the player should see |

Four numbers is the whole of "agility" and each one is a separate run, so a full
card is roughly 8 short simulations. That is affordable per creature and it is
what an auto-breeder needs.

## 87. `atlas.html` now shows the card

The authored library page carries the measured set per specimen, including the
control-subtracted seek score displayed as `score · control · benefit` so the
speed contribution is visible rather than hidden inside one number. The eel's
+0.034 and the Paddletail's −0.004 sit side by side, which is the honest picture:
the better swimmer is the worse seeker, because it is fast enough to blunder into
targets and its sensor makes that worse.

## 88. Tools added, 10d

| tool | answers |
|---|---|
| `_capability.mjs` | the full parameter card; does each candidate objective discriminate? |
| `_objective.mjs` | is the seek score a steering measure or a speed proxy? does control subtraction fix it? |

---

# Session 10e — the sensor gene is hardcoded to zero

## 89. No creature has ever had a sensor

`engine/l1/factory.js:216`:

    controller: {
      omega: uniform(rng, RANGE.omega),
      // A3: present and DORMANT until C1 wires the sensors. Present from B1 so
      // that C1 is a behaviour change, not a schema migration.
      preyGain: 0,
      threatGain: 0,
      jointGenes,
    },

**Every random genome ever generated has `preyGain = 0` and `threatGain = 0`.**
And `mutate.js:95` copies both straight through — there is no mutation branch for
either. So the value is not merely initialised to zero, it is *unreachable*: no
sequence of mutations can move it, and no breeding can recombine it, because
nothing ever differs.

The comment says "dormant until C1 wires the sensors". C1 wired them.
`controller.js sensorTurnBias` reads them; `duel.js senseOpponent` calls it;
`SPECIES_FIELDS` lists `pursuitGain`/`evasionGain` as their downstream. The
sensor path is complete from gene to torque — and the gene is a constant zero at
the only place it is ever created.

That is why §84's benefit was 0.003 with two outliers, and why the ten random
creatures in §88's table scored **exactly** 0.000 in all three planes: not "close
to zero", *identically* zero, because `sensorTurnBias` returns
`clamp(0*bearing + 0*bearing)` for every creature in the corpus. The only
non-zero benefits in this entire session came from the six authored specimens,
where I wrote the gains by hand.

**Selection could never have produced a seeker, because a seeker was never born.**
This predates every locomotion finding and is independent of all of them.

The fix is two lines in the factory and one mutation branch. It is the smallest
change with the largest consequence found in this project so far, and it should
land before any evolution run is attempted.

## 90. The objective also has a floor

Random corpus, solver motor, 30 s, the distance the trial asks them to cover:

    1 of 14 random creatures can travel 6 m in 30 s at all

A creature that cannot reach the target scores zero whatever its sensor does, so
the objective cannot rank it — and cannot rank its offspring either. Thirteen of
fourteen would be tied at the bottom, and selection on a mostly-tied population
is selection on the tie-break.

Two repairs, and both are needed:

- **scale the trial to the creature**: target range as a multiple of the
  creature's own measured `netSpeed × duration`, so a slow creature gets a near
  target and is still ranked against its own siblings;
- **score continuously rather than by arrival**: closest approach already does
  this, but it saturates at "never got closer than the start". Better is the
  *time-integrated* bearing error, which is non-zero the moment the creature
  moves at all and is defined even for a creature that never arrives.

## 91. The measured steering plane works, and it is now computable

§72 said "the creature's bend plane is not currently a quantity anything
computes". It is computable from a probe S3 already runs. S3 applies the bias in
both directions so intrinsic curl cancels in the *rate*; do the same to the
*rotation axis*:

    axis(+bias) - axis(-bias), normalised  =  the creature's own steering axis
    |axis(+bias) - axis(-bias)| / 2        =  authority, 0 .. 1

`authority` is the quantity §85 needed and neither S3 nor S1 has: 1.0 means the
two bias directions turn the creature in exactly opposite senses, 0.0 means the
input does not change which way it curls whatever the rate says. Measured, it
separates cleanly — `eel` 1.00, `eel-finned` 0.00, `staircase` 0.98 — and it is
not a restatement of `turnRate3d`, which ranks those three 0.202 / 0.179 / 0.090.

**A creature can have a large turn rate and zero steering authority.** That is
precisely the confusion S3's both-directions design was built to prevent for the
rate, left unfixed for the axis.

Restricted to the nine creatures with authority > 0.5, mean sensor benefit by
plane: world yaw **0.0022**, fixed bend plane **0.0044**, measured steering plane
**0.0082**. The measured plane wins, by roughly 4x over what `duel.js` does
today. The absolute numbers are meaningless until §89 lands — nine of those
creatures have no sensor gene — but the ordering is the design answer.

## 92. Revised order, and what each step unblocks

1. **Give `preyGain` and `threatGain` real values** (§89): `uniform(rng, RANGE.preyGain)`
   in the factory, and a mutation branch for each. Two lines and a branch.
   *Unblocks: any selection on seeking at all.*
2. **Add `steeringAxis` and `steeringAuthority` to S3** (§91), computed from the
   two runs S3 already performs. No new simulation.
   *Unblocks: a correct bearing, and a real agility number for the card.*
3. **Take the bearing in the measured plane** — `bearingTo` and `headingOf`.
   *Unblocks: the closed loop. 4x sensor benefit before any selection.*
4. **Scale the seek trial to the creature and score continuously** (§90).
   *Unblocks: a rankable population instead of a mostly-tied one.*
5. Then, and only then, run selection on `seekBenefit`.

Steps 1–3 are small, and 1 is nearly trivial. None of them is a search.

## 93. Tools added, 10e

| tool | answers |
|---|---|
| `_steerplane.mjs` | measures each creature's own steering axis and authority; compares sensor benefit across yaw / fixed-bend / measured planes |
| `_floor.mjs` | can the corpus reach the target at all? |

---

# Session 10f — the edits, and selection moves

Gate: **GREEN, 80 assertions, 76 passed, 0 failed, 4 pending, 3309 checks.**

## 94. The sensor genes are live

`engine/l1/factory.js`

    -  preyGain: 0,
    -  threatGain: 0,
    +  preyGain: uniform(rng, RANGE.preyGain),
    +  threatGain: uniform(rng, RANGE.threatGain),

drawn over the full [-1, 1] because 11 §10 and the RANGE comment both say the
sign is evolved, not declared.

`engine/l1/mutate.js` gains `mutateSensorGain`, one gene per call like every
other operator, wired into the `controller` branch. Without it the factory draw
alone would give an initial population variation and no lineage could ever move.

**The physical creature a seed produces is bit-identical.** Two extra draws shift
the stream, but morphology, joints and the rest of the controller are drawn
earlier; only `social` moves, which is L3 and unmeasured. Verified: the random
corpus's net speeds are unchanged to four decimals (0.2453, 0.0042, 0.0172, …)
while the gains went from `0.00 / 0.00` on every creature to `-0.13 / -0.58`,
`0.81 / -0.95`, `-0.99 / -0.83`, …

## 95. The gate's own diff was blind to both genes

Adding the operator turned the gate red, twice, and both failures were correct.

**L1-23** demands every operator appear in an `EXPECTED` contract table naming
what it changes — a good gate, and it caught the new operator immediately. But
writing that entry exposed the deeper hole: `diffGenome` had **no field for
`preyGain` or `threatGain` at all**. A mutation that moved one reported
`total: 0` and tripped the no-op check. The gate could not see the change even in
principle — consistent with the factory hardcoding both to zero and mutate.js
copying them through. Nothing ever moved, so nothing ever noticed that nothing
could.

**L1-26** asserts a morphology-locked mutation must change *something in the
controller*, and tested it as `!omegaChanged && jointGenesChanged.length === 0`.
That enumeration was written when those were the only reachable controller genes.
A locked mutant that drew `mutateSensorGain` three times changed the controller
and was counted as unchanged. Amended in what the controller *is*, not in what
the assertion claims.

Both are recorded in the code with the reasoning, not silently patched.

## 96. Selection moves

`tools/_evolve_seek.mjs`. Population 16, 30% elites, mutation only, solver motor.
Fitness is `score(sensor live) − score(sensor disabled)` — not distance closed,
which is 98% a speed proxy. The bearing is taken in each creature's own measured
steering plane; the target range is scaled to what that creature could cover
swimming straight, so a slow creature is ranked against its siblings rather than
tying at zero.

    gen   benefit p50   benefit best   |gain| p50   authority p50   speed p50
      0       0.0103        0.1789        0.424          0.489      0.0272
      1       0.1745        0.2857        0.724          0.565      0.0188
      2       0.1754        0.2857        0.701          0.691      0.0262
      3       0.2857        0.2857        0.365          0.565      0.1286
      4       0.2857        0.2857        0.365          0.565      0.1286
      5       0.2857        0.2857        0.365          0.565      0.1286

**Median sensor benefit 0.0103 → 0.2857 in three generations, 28x.** For the
first time in this project a population has been selected for a behaviour rather
than for a number that correlates with one, and it responded.

## 97. And it converges by generation 3

Best equals median from gen 3, and `|gain|`, `authority` and `speed` all freeze
together: the population is one genotype and its identical copies. That is the
same failure the handover records at 8 generations, arriving faster because this
harness breeds elites only — the shipped `breed()` has N17's stranger slot and
N18's untouched-elite rule, and both exist precisely for this.

So the number to quote is 28x **in three generations of a run that then stops
searching**, not 28x as a converged result. Diversity maintenance is now the
binding constraint on this experiment, exactly where the handover said it would
be — it was simply unreachable before, because the gene selection acts on did
not vary.

## 98. State, and what is left

Landed this session: solver-motor parametrisation (`motorFreqHz`), the authored
library, the Atlas data layer, the control-subtracted objective, the measured
steering plane, the sensor genes, and one working selection run.

Still open, in order:

1. **Diversity maintenance** (§97) — run through `breed()` rather than a bespoke
   elite loop, so N17 and N18 apply.
2. **Register `steeringAxis`, `steeringAuthority` and `seekBenefit`** on the
   species record, which needs a BRIDGE_V bump. `authority` is the honest agility
   number and S3 already runs the two trials it needs.
3. **`bearingTo` and `headingOf` in the measured plane** — the engine change the
   tools have been simulating. 4x sensor benefit before any selection.
4. **Default the solver motor**: `work` accounting, L1-18, and the spherical-joint
   hole (42% of joints still on the PD).
5. Atlas write path: `store.set(KEY.specimen(hash), …)` on selection.

## 99. Tools added, 10f

| tool | answers |
|---|---|
| `_evolve_seek.mjs` | does selection on control-subtracted benefit breed seekers? |

---

# Session 10g — the control matched. The 28x was the harness.

## 100. RETRACTION: §96's selection result is not evidence

§96 reported median sensor benefit 0.0103 -> 0.2857 in three generations and
called it selection working. **It ran without a control.** Run the identical
machinery — same population, same N18 elitism, same N17 immigration, same
mutation, same fitness *measurement* — but choose the survivors **at random**:

| | gen 0 median | gen 8 median | gen 0 best | gen 8 best |
|---|---|---|---|---|
| selected on benefit | 0.0516 | **0.2486** | 0.2055 | 0.3836 |
| **selected at random** | 0.0464 | **0.2142** | 0.2590 | **0.4598** |

The control climbs as fast, and its best individual is *higher*. **The rising
median is a property of the harness, not of selection.**

The mechanism is not subtle once looked for. Benefit is right-skewed across a
random corpus: most creatures sit near zero, a few sit high. Carry any six of
twenty forward and fill the rest with their offspring, and the population's
median moves toward the mean of those six — which, from a right-skewed
distribution, is above the median whichever six you take. Selection is not
required. Neither run is evidence about the gene.

The tell was in the run I already had and I did not read it: `|gain| p50` went
0.662 -> 0.022 -> 0.480 across generations, wandering rather than converging. If
selection were acting on the sensor, that is the number that should rise and
stay. It does not, in either arm.

**A rising median under selection is not a result unless a randomly-selected
control fails to produce one.** That is the whole content of §96, corrected.

## 101. Why: the metric's signal-to-noise is 1.9

Re-measured the same genome five times, rotating the target bearings by 20
degrees each time. Nothing about the creature changes; only where the targets sit.

    creature        0deg    20deg    40deg    60deg    80deg    within-sd
    0             -0.170   -0.068   -0.234    0.022    0.011      0.100
    5              0.307    0.323    0.179    0.012    0.050      0.128
    7             -0.261   -0.284   -0.255   -0.304   -0.088      0.077

    within-creature  sd (measurement noise)   0.0508
    between-creature sd (the signal)          0.0974
    SIGNAL / NOISE                            1.92

Creature 0 scores −0.234 and +0.022 — opposite signs — for the same genome, on
the same actuator, with the targets moved 40 degrees. Creature 5 spans 0.012 to
0.323.

**At S/N 1.9, a fitter creature and a luckier one are close to
indistinguishable**, and a selection step picks partly on which bearings a
creature happened to be given. Four bearings is too few. Noise falls as
1/sqrt(n), so the fix is arithmetic rather than clever: 16 bearings would take
S/N to about 3.8 for four times the compute, and averaging over repeated
placements would do the same.

That number should be measured before any evolution run, not after. It costs ten
evaluations.

## 102. What DID hold up

- **Diversity maintenance works.** N17-style immigration held distinct genotypes
  at **20/20 for all nine generations** in both arms, against the bespoke
  elite-only loop that collapsed to one genotype by generation 3. The handover
  named this as the blocker and the fix is real.
- **`breed()` cannot be used for auto-breeding as written.** `POPULATION = 6` is
  a module constant and `breed()` throws on any other length. Correct for the
  tank — six slots is the player's screen — and it means `POPULATION` has to
  become an argument before a population of hundreds is possible. The two rules
  transplant cleanly; only the constant is in the way.
- **The sensor genes are live and mutable** (§94), and that is unaffected by any
  of this. The gate is green at 76/0/4.
- The evaluation cost is fine: **130 evaluations in 99 s**, cached by genome
  hash. A serious run is affordable; it was never compute that was missing.

## 103. Revised next steps

1. **Raise the trial's bearing count until S/N > 3**, and re-measure it rather
   than assuming. 16 bearings, or 4 bearings x 4 repeats with the creature's
   start orientation varied.
2. **Re-run both arms.** The claim to be tested is "selected beats control",
   and no other number from that run means anything.
3. **Generalise `POPULATION`** in `breed.js` so the real breeding path can be
   used at size.
4. Then, and only then: registering `steeringAuthority`/`seekBenefit` on the
   species record, the `bearingTo` plane change, and the solver-motor default.

## 104. Method note

This is the third time this session that a striking number came from a missing
control or an unchecked line: the 0.01 m pursuit that was a target dead ahead
(§75), the seek score that was 98% a speed proxy (§83), and now a 28x that a
coin flip reproduces. The pattern is consistent — the failure is never in the
measurement, it is in not measuring the thing the measurement is being compared
against. The three cheap habits that would have caught all three: place the
target somewhere the creature is not already going; correlate any new metric
against speed before believing it; and run the null arm.

## 105. Tools added, 10g

| tool | answers |
|---|---|
| `_evolve_run.mjs` | selection at size, with N17/N18 and a random-selection control arm |
| `_noise.mjs` | signal-to-noise of the fitness metric — the number to check first |

---

# Session 10h — the arms separate. Selection works.

## 106. How many bearings the trial needs, measured rather than predicted

§101 predicted S/N ~3.8 at sixteen bearings from 1/sqrt(n). The assumption behind
that — per-bearing errors as independent draws — is exactly the kind this session
keeps getting punished for, so it was measured.

The simulation is fully deterministic and the creature always starts identically,
so the *only* thing that varies between two evaluations of one genome is which
bearings the trial used. That makes the noise characterisable from **one dense
sweep per creature**: score every bearing on a 36-point grid once, then compute
what any n-bearing trial would have returned by subsampling. No re-simulation,
and every trial size falls out of the same data. Ten creatures, 15 s each.

    n bearings   within-sd    between-sd     S/N    1/sqrt(n) predicts
             2      0.1004        0.0922    0.92          —
             3      0.0651        0.0922    1.42          —
             4      0.0561        0.0922    1.64        1.64
             6      0.0377        0.0922    2.45        2.01
             9      0.0346        0.0922    2.66        2.46
            12      0.0189        0.0922    4.87        2.85
            18      0.0176        0.0922    5.25        3.48

More bearings help **more** than 1/sqrt(n) predicts, because the per-bearing
error is not independent noise — it is a smooth function of bearing, and an
evenly spaced set averages a smooth function far better than random sampling
does. Caveat, and it is a real one: `within` at n = 12 is the spread over only
36/12 = 3 distinct rotations, and at n = 18 over 2. **Those two rows are
small-sample sd estimates and will be optimistic.** The trustworthy rows are
n = 2, 3, 4 and 6, and they alone justify going well above four.

Twelve was chosen and then tested, which is the only defensible order.

## 107. The per-bearing spread is enormous, and it is not noise

    creature   true benefit   per-bearing sd     min      max
    0              -0.0756          0.3721    -0.686    0.799
    5               0.1644          0.2836    -0.209    0.883
    7              -0.2321          0.3221    -0.797    0.527
    2              -0.0029          0.0049    -0.013    0.004

Creature 0's sensor **helps it by 0.80 at one bearing and hurts it by 0.69 at
another**. Its all-bearing mean is −0.076. That is not measurement error; it is
the creature. A body whose sensor closes hard on targets ahead and drives it away
from targets behind is a real phenotype, and averaging over bearings describes it
as mediocre.

Worth keeping in view: the between-creature signal (sd 0.092) is *small* compared
with within-creature bearing dependence (sd up to 0.37). All-bearing benefit is
the right objective for omnidirectional orientation, but it is a harsh summary of
what these creatures actually do, and a per-bearing profile would say more.

Also note several creatures have genuinely **negative** benefit — creature 7 at
−0.232, its sensor actively driving it away. That is the wrong-sign half of a
uniform [-1,1] gain draw showing up exactly as it should, and it is the variation
selection needs.

## 108. Both arms, twelve bearings, two replicates

    replicate 1                 gen 0 median   gen 8 median   gen 8 best
      SELECTED on benefit           0.0515        0.4498        0.5466
      CONTROL, chosen at random     0.0556        0.1681        0.3577

    replicate 2                 gen 0 median   gen 8 median   gen 8 best
      SELECTED on benefit           0.0664        0.4037        0.4037
      CONTROL, chosen at random     0.0273        0.1099        0.4072

**The arms separate.** Selected reaches 2.7x and 3.7x the control's median. The
control still climbs — §100's harness effect is real and has not gone away — but
it no longer accounts for the result.

The decisive tell is the one §100 said to watch. Median |sensor gain|:

    selected  r1:  0.662  0.640  0.965  0.965  0.965  0.965  0.965  0.965  0.965
    selected  r2:  ...    1.089  1.089  1.089  1.582  1.655  1.582  1.582  1.582
    control   r1:  0.727  0.727  0.727  0.706  0.642  0.577  0.836  0.939  0.836

**Under selection the gain converges and locks; under random selection it
wanders.** That is selection acting on the sensor gene, and it is visible in both
replicates and absent from both controls.

Selected medians also rise monotonically — 0.0515, 0.1185, 0.2240, 0.3008,
0.3847, 0.4391, 0.4498 — while the control's fall as often as they rise
(0.1525, 0.1384, 0.1528, 0.0846, 0.0635, 0.0846).

Diversity held at 20/20 distinct genotypes in every generation of all four runs.

**This is the first demonstrated case in this project of a population being
selected for a behaviour and acquiring it.**

## 109. What the claim is, precisely

Two replicates per arm, one population size, one world, mutation only, no
crossover, hand-fixed morphology-agnostic objective, and a metric whose S/N at
the chosen trial size is estimated from three rotations. **Suggestive and
consistent, not conclusive.** The honest statement is:

> At twelve bearings, selection on control-subtracted seek benefit produces a
> median 2.7-3.7x a matched random-selection control over nine generations, and
> converges the sensor gain in both replicates where the control does not.

What would make it conclusive: five or more replicates per arm, a population
above 50, and the S/N re-derived from a finer grid so the n = 12 row rests on
more than three rotations.

## 110. Revised next steps

1. **Replicate.** Five seeds per arm at population 50. Roughly an hour of compute
   at the current cost, which is affordable and is the difference between a
   result and an anecdote.
2. **Generalise `POPULATION`** in `breed.js` so the shipped breeding path can run
   this instead of the harness.
3. **Register `steeringAuthority` and `seekBenefit`** on the species record; both
   are now measured quantities with known noise characteristics, which is the
   precondition the record should have had all along.
4. `bearingTo` / `headingOf` in the measured plane, then the solver-motor default.
5. Keep a **per-bearing profile** rather than only the mean (§107) — the Atlas
   card should show where a creature can and cannot seek, because that is the
   interesting fact about it.

## 111. Tools added, 10h

| tool | answers |
|---|---|
| `_grid.mjs` | dense bearing sweep; derives S/N for every trial size by subsampling |

---

# Session 10i — chunked, checkpointed, and the first paired seed

## 112. Why the big runs kept dying

Two separate causes, and the first was hiding the second.

**Output was buffered through a pipe.** Every run was printing a line per
generation, but piped into `grep` those lines sat in a buffer, so a killed
process showed *nothing at all* — the run looked like it had hung immediately
when it was in fact three generations in. Two chunks were abandoned on that
misreading. Writing to a log file and reading the file afterwards makes partial
progress visible whatever happens to the process.

**And the sizing was optimistic.** 1.46 s per evaluation was inferred from a run
where the hash cache did most of the work. Measured properly: **population 20
over 6 generations at 12 bearings is 186–232 s.** Population 40 over 8
generations is roughly four times that and cannot fit a ten-minute budget.

## 113. The harness is now chunked and checkpointed

    node tools/_evo.mjs <selected|control> <seed> [pop] [gens]   ->  runs/<arm>-<seed>.json
    node tools/_evosum.mjs                                       ->  the paired table

Three properties that matter for work split across messages:

- **One invocation is one complete, independently meaningful unit** — a single
  arm at a single seed. Ten invocations can be interrupted nine times and the
  work is still nine tenths done.
- **A wall-clock guard.** `BUDGET` (default 420 s) stops at a *generation
  boundary* and writes what it has. A five-generation result is a partial
  result; a killed process is not a result at all. This is the same lesson as
  the handover's SIGKILL gotcha, arrived at again from the other direction.
- **The metric lives in one file.** `tools/_evolib.mjs` holds the evaluation
  machinery, extracted verbatim, because a run split across sessions is only
  comparable if the metric is one definition in one place.

## 114. Seed S1, both arms, population 20 over 6 generations

    selected-S1   median 0.0347 -> 0.2341    |gain| 0.58 -> 1.35
    control-S1    median 0.0347 -> 0.0027    |gain| 0.58 -> 0.32

Generation 0 is identical between the arms by construction — same seed, same
init loop — so this is a properly paired comparison, and the corpus cancels.

The control **fell**, 0.0347 to 0.0027, where at population 20 over 9 generations
(§108) it rose. That is the harness effect being weaker than the noise at this
size, not evidence of anything, and it is why the ratio prints as 86x. **That
number is an artefact of a near-zero denominator and should not be quoted.** The
quotable facts are the direction — selected up, control down — and the gain
trajectory, 0.58 -> 1.35 under selection against 0.58 -> 0.32 under random.

One paired seed. A sign test needs five for p < 0.05.

## 115. The plan, in ten-minute chunks

Each chunk is two runs, about 7 minutes:

| chunk | contents |
|---|---|
| 1 ✅ | `selected S1`, `control S1` — done |
| 2 | `selected S2`, `control S2` |
| 3 | `selected S3`, `control S3` |
| 4 | `selected S4`, `control S4` |
| 5 | `selected S5`, `control S5` |
| 6 | `_evosum` + write-up; sign test over 5 paired seeds |

After that, and only after: generalise `POPULATION` in `breed.js`, register
`steeringAuthority` and `seekBenefit` on the species record, and the `bearingTo`
plane change.

Ratios are not the statistic to aggregate — with denominators this close to zero
they are unbounded. The sign test over paired seeds is, and the mean paired
*difference* is the effect size.

## 116. Tools added, 10i

| tool | answers |
|---|---|
| `_evolib.mjs` | the shared evaluation machinery, one definition |
| `_evo.mjs` | one arm-replicate, checkpointed, wall-clock guarded |
| `_evosum.mjs` | reads every checkpoint, pairs the arms, no simulation |

---

# Session 10j — chunk 2, and the ratio is retired

## 117. Seed S2, both arms

    selected-S2   median 0.0135 -> 0.3992    |gain| 0.35 -> 1.44   6 gens
    control-S2    median 0.0135 -> -0.0148   |gain| 0.35 -> 0.24   5 gens (budget)

The control's median went **negative** — the randomly-chosen survivors drifted
toward creatures whose sensor actively drives them away from the target, which is
exactly what a uniform [-1,1] gain draw should produce when nothing selects
against it. The wall-clock guard fired after generation 4 and checkpointed; the
run is short one generation and is still a usable pair, which is the point of
the guard.

## 118. The ratio was retired from the summary, not just avoided

§114 flagged that the 86x at S1 was a small-denominator artefact and said it
should not be quoted. At S2 the control's final median is **negative**, so the
ratio printed as infinity — the same defect one step further along.

A caveat in prose does not survive being read quickly. `tools/_evosum.mjs` now
reports the **paired difference** instead, which is bounded, carries the units of
the metric, and is what a sign test consumes. The ratio is gone from the code, so
it cannot be quoted by accident.

    seed    selected final   control final   difference   wins?
    S1             0.2341          0.0027      +0.2314    yes
    S2             0.3992         -0.0148      +0.4139    yes

    mean paired difference  +0.3227   sd 0.1291
    sign test, 2/2: two-sided p = 0.500

**p = 0.500 at 2/2 is the honest reading**: two coin flips both landing heads is
not evidence. The design needs five paired seeds to reach p < 0.05, and that was
known before the runs started — it is why the plan is five.

## 119. The mechanism check now prints alongside

The median is the outcome; the sensor gain is the mechanism, and it is
independent of whatever the median does.

    seed    selected |gain|      control |gain|
    S1      0.58 -> 1.35         0.58 -> 0.32
    S2      0.35 -> 1.44         0.35 -> 0.24

**Both arms start identically and separate in opposite directions in both
seeds.** Under selection the gain roughly triples and locks; under random
selection it roughly halves. This is a stronger signal than the median because it
names *what* was selected, and it does not depend on the benefit metric's noise
floor at all — it is read straight off the genomes.

Four out of four run-directions agree. Still two seeds.

## 120. Chunk status

| chunk | contents | state |
|---|---|---|
| 1 | `selected S1`, `control S1` | done, 186 s / 232 s |
| 2 | `selected S2`, `control S2` | done, 253 s / 299 s |
| 3 | `selected S3`, `control S3` | next |
| 4 | `selected S4`, `control S4` | |
| 5 | `selected S5`, `control S5` | |
| 6 | `_evosum` + write-up | |

Chunk wall time is 418–552 s for the pair, comfortably inside ten minutes, and
the guard means an overrun costs a generation rather than the run.

---

# Session 10k — chunk 3, and the mechanism check dissents

## 121. Seed S3, both arms

    selected-S3   median 0.0212 -> 0.4357   |gain| 0.39 -> 0.39   distinct 20 -> 18
    control-S3    median 0.0212 -> 0.0233   |gain| 0.39 -> 0.23   distinct 20 -> 20

Third paired seed, third win on the median:

    seed    selected final   control final   difference   wins?
    S1             0.2341          0.0027      +0.2314    yes
    S2             0.3992         -0.0148      +0.4139    yes
    S3             0.4357          0.0233      +0.4125    yes

    mean paired difference  +0.3526   sd 0.1050
    sign test, 3/3: two-sided p = 0.250

## 122. But the sensor gain did NOT rise at S3

§119 called the gain trajectory "a stronger signal than the median because it
names what was selected". At S3 it dissents:

    seed    selected |gain|                      control |gain|
    S1      0.58 -> 1.35   rose                  0.58 -> 0.32   fell
    S2      0.35 -> 1.44   rose                  0.35 -> 0.24   fell
    S3      0.39 -> 0.39   FLAT                  0.39 -> 0.23   fell

The selected run's gain went 0.389 -> 0.870 -> 0.592 -> 0.389 and stayed, ending
**exactly where it started** while its median more than doubled the control's.

So the mechanism claim is **2/3, not 3/3**, and the honest statement is narrower
than §119's. What holds in all three is the *control's* gain falling — 0.32,
0.24, 0.23 — which is drift toward the wrong-sign half of the draw when nothing
selects against it, and is a statement about the control rather than about
selection.

Two readings, and this run cannot separate them:

- Selection at S3 found a **body** that seeks well at a modest gain, rather than
  a bigger gain on a mediocre body. Benefit is a property of the pair, and
  nothing in the objective prefers one route.
- Or the winning lineage was already present at generation 0 — its benefit at
  gen 0 was 0.4357, the population maximum, and the median simply climbed to
  meet it. Selection would then have *preserved* rather than *found*.

The second is testable and cheap: compare each run's final best against its own
generation-0 best. S1 0.1969 -> 0.2353 and S3 0.4357 -> 0.4608 both improved only
slightly, S2 0.3992 -> 0.3992 not at all. **In all three selected runs the final
best is within a few percent of the generation-0 best.** Six generations of
mutation on a population of 20 is not finding new optima; it is concentrating the
population onto the best individual the initial draw happened to contain.

That is still selection working — it is what selection does — but it is a
weaker claim than "evolves seekers", and the median difference is largely
measuring how fast the population concentrates.

## 123. Diversity dipped for the first time

`selected-S3` fell to 17/20 and 18/20 distinct genotypes in the last three
generations, against 20/20 everywhere else in every run so far. Small, and
consistent with concentration onto one strong lineage. Worth watching in chunks
4 and 5 rather than acting on: N17's immigration is holding, just not perfectly
once a clear winner exists.

## 124. What the next chunks should also record

Nothing about the runs changes — the design is fixed and changing it mid-series
would make the seeds incomparable. But the write-up at chunk 6 should report
**final best against generation-0 best** alongside the median difference, because
§122 shows the two answer different questions and only one of them is about
evolution.

## 125. Chunk status

| chunk | contents | wall |
|---|---|---|
| 1 | `S1` both arms | 186 s / 232 s |
| 2 | `S2` both arms | 253 s / 299 s |
| 3 | `S3` both arms | 206 s / 227 s |
| 4 | `S4` both arms | next |
| 5 | `S5` both arms | |
| 6 | `_evosum` + write-up | |

---

# Session 10l — chunk 4, and the sharpest statement yet

## 126. Seed S4, and four for four

    selected-S4   median 0.0101 -> 0.4511   |gain| 0.67 -> 1.14
    control-S4    median 0.0101 -> 0.0371   |gain| 0.67 -> 1.07

    seed    selected final   control final   difference   wins?
    S1             0.2341          0.0027      +0.2314    yes
    S2             0.3992         -0.0148      +0.4139    yes
    S3             0.4357          0.0233      +0.4125    yes
    S4             0.4511          0.0371      +0.4140    yes

    mean paired difference  +0.3679   sd 0.0910
    sign test, 4/4: two-sided p = 0.125

The differences are remarkably tight — three of the four sit within 0.0015 of
each other. One more paired seed reaches p = 0.0625 at 5/5, which is the design's
ceiling and still not below 0.05; the plan's "5 seeds for p < 0.05" in §115 was
**wrong arithmetic**. A two-sided exact sign test at 5/5 gives 2/32 = 0.0625.
Six seeds at 6/6 gives 0.031. The series should run to six.

## 127. The gain check discriminates in only two of four

§119 promoted the sensor-gain trajectory to "a stronger signal than the median".
Four seeds in, it is the weaker one:

    seed    selected        control         discriminates?
    S1      0.58 -> 1.35    0.58 -> 0.32    yes
    S2      0.35 -> 1.44    0.35 -> 0.24    yes
    S3      0.39 -> 0.39    0.39 -> 0.23    control only
    S4      0.67 -> 1.14    0.67 -> 1.07    NO — both rose

At S4 the control's gain rose almost as far as the selected arm's. A gain can
drift up under random selection as easily as down; there is no reason it should
not. **§119 is retracted as stated.** It was a two-seed observation promoted to a
mechanism, which is the same error as §96 in a different costume.

## 128. What DOES hold in all four, both directions

Best individual, generation 0 to final:

    seed    selected            control
    S1      0.1969 -> 0.2353    0.1969 -> 0.1656
    S2      0.3992 -> 0.3992    0.3992 -> 0.0267
    S3      0.4357 -> 0.4608    0.4357 -> 0.1547
    S4      0.4511 -> 0.4938    0.4511 -> 0.1591

**Selection preserves the best seeker in 4/4 and improves it in 3/4. Random
selection loses it in 4/4** — catastrophically at S2, where the best fell from
0.399 to 0.027.

This is not a tautology of elitism, because **the control has elitism too**. N18
is identical in both arms; the only difference is whether the six survivors are
chosen by fitness or at random. Random elitism drops the best individual with
probability (14/20) per generation and never recovers it, because mutation on a
population of 20 does not rediscover it — which §122 already showed.

So the cleanest statement the series supports is not "selection evolves seekers".
It is:

> **Selection retains and marginally improves the best seeker; random selection
> loses it.** The +0.37 median difference is that retention propagating through
> the population.

The improvements are real but small: +0.038, 0.000, +0.025, +0.043. Mutation
contributes something, and not much, at this population size over six
generations.

## 129. Chunk status

| chunk | contents | wall |
|---|---|---|
| 1–4 | `S1`–`S4`, both arms | 182–299 s per run |
| 5 | `S5` both arms | next |
| 6 | `S6` both arms | added — see §126, five seeds cannot reach p < 0.05 |
| 7 | `_evosum` + write-up | |

---

# Session 10m — chunk 5, and mutation does generate

## 130. Seed S5, and five for five

    selected-S5   median 0.0637 -> 0.4221   best 0.4221 -> 0.6225
    control-S5    median 0.0637 -> -0.0155  best 0.4221 -> 0.0829

    mean paired difference  +0.3819   sd 0.0848
    sign test, 5/5: two-sided p = 0.063

Five unanimous seeds, and the differences are tighter still (sd 0.085 on a mean
of 0.382). p = 0.063 is the ceiling for five; **six unanimous seeds gives
p = 0.031**, which is why chunk 6 was added in §129.

## 131. §128's "retention, not generation" was too pessimistic

Best individual, generation 0 to final, as a percentage of the starting best:

    seed    selected            control
    S1      0.1969 -> 0.2353    +20%      -> 0.1656   -16%
    S2      0.3992 -> 0.3992      0%      -> 0.0267   -93%
    S3      0.4357 -> 0.4608     +6%      -> 0.1547   -65%
    S4      0.4511 -> 0.4938     +9%      -> 0.1591   -65%
    S5      0.4221 -> 0.6225    +47%      -> 0.0829   -80%

**S5 improved the best individual by 47%, appearing at the final generation.**
Mean improvement across five seeds is +16%, and it is non-negative in 5/5.

§128 concluded from four seeds that "six generations of mutation on a population
of 20 is not finding new optima; it is concentrating the population onto the best
individual the initial draw contained". That was the right reading of four
seeds — the improvements were +20%, 0%, +6%, +9% and easy to dismiss as
concentration. S5's +47% is not concentration; a creature better than anything in
the initial draw was constructed by mutation. **The honest revision: mutation
does generate, slowly and unevenly, and six generations is barely enough to see
it.**

The pattern across both retractions this series — §119's gain check and §128's
retention claim — is the same shape: a statement true of the seeds in hand,
promoted to a general one, and falsified by the next seed. Four seeds was not
enough to make either claim. Five is not obviously enough to make this one
either, which is worth writing down before it happens a third time.

## 132. What is unanimous at five seeds, in both directions

| statistic | selected | control |
|---|---|---|
| final median beats its pair | 5/5 | — |
| best individual preserved or improved | **5/5** | 0/5 |
| best individual lost | 0/5 | **5/5**, by 16–93% |

The control's losses are severe: it ends at −65% or worse in four of five. Random
elitism drops the best individual with probability 14/20 per generation and
mutation does not reliably rebuild it inside six generations — which is the same
fact §131 reports from the other side, and the two together are consistent.

The sensor-gain check remains 3/5 at best (§127) and should not be quoted.

## 133. The tool's arithmetic was wrong and is fixed

`_evosum.mjs` printed "a sign test needs 5 paired seeds for p < 0.05", which was
carried from §115's error and stayed in the code after §126 corrected it in
prose. **Wrong arithmetic printed by a tool outlives any correction made in
prose**, so the footer now computes the required n rather than asserting one, and
the best-individual table is printed alongside because it is the statistic that
has held 5/5 in both directions.

## 134. Chunk status

| chunk | contents | wall |
|---|---|---|
| 1–5 | `S1`–`S5`, both arms | 155–299 s per run |
| 6 | `S6` both arms | next — takes p to 0.031 if unanimous |
| 7 | `_evosum` + write-up | |

---

# Session 10n — chunk 6. The series completes at p = 0.031.

## 135. Seed S6, and the primary endpoint

    selected-S6   median 0.0224 -> 0.2993   best 0.2211 -> 0.4263
    control-S6    median 0.0224 -> 0.0263   best 0.2211 -> 0.2605

    seed    selected final   control final   difference
    S1             0.2341          0.0027      +0.2314
    S2             0.3992         -0.0148      +0.4139
    S3             0.4357          0.0233      +0.4125
    S4             0.4511          0.0371      +0.4140
    S5             0.4221         -0.0155      +0.4376
    S6             0.2993          0.0263      +0.2729

    selected beats its own control in 6/6 seeds
    mean paired difference  +0.3637   sd 0.0879
    sign test, 6/6: two-sided p = 0.031

**The result the series was designed to test.** Six paired seeds, generation 0
identical within each pair by construction, the only difference between arms
being whether the six survivors are chosen by fitness or at random.

> Selection on control-subtracted seek benefit produces a final median
> **+0.364 ± 0.088** above a matched random-selection control, unanimous over six
> seeds, two-sided sign test **p = 0.031**.

## 136. And mutation generates, more clearly than five seeds suggested

Best individual, generation 0 to final:

    seed    selected                control
    S1      0.1969 -> 0.2353  +20%    0.1969 -> 0.1656   -16%
    S2      0.3992 -> 0.3992    0%    0.3992 -> 0.0267   -93%
    S3      0.4357 -> 0.4608   +6%    0.4357 -> 0.1547   -65%
    S4      0.4511 -> 0.4938   +9%    0.4511 -> 0.1591   -65%
    S5      0.4221 -> 0.6225  +47%    0.4221 -> 0.0829   -80%
    S6      0.2211 -> 0.4263  +93%    0.2211 -> 0.2605   +18%

**S6 nearly doubled its best individual.** With S5's +47%, that is two of six
seeds where mutation built a creature substantially better than anything the
initial random draw contained. Mean improvement +29%, non-negative in 6/6.

§128's "retention, not generation" is now firmly wrong, and §131's hedged
revision was right to hedge. The series ran long enough to see the thing it was
too short to see at four seeds.

## 137. The control's best rose at S6, which is why the control exists

`control-S6` improved its best individual by 18% — the only such case, against
losses of 16–93% in the other five. Random selection can stumble upward. A
single-arm run that happened to land on S6's control would have shown a rising
median AND a rising best and looked like a result.

So the both-directions claim is **6/6 selected, 5/6 control**, not 6/6 and 6/6,
and the primary endpoint is the paired difference — which is unaffected, because
S6's selected arm rose further still.

## 138. What is claimed, and what is not

**Claimed, at p = 0.031 over six paired seeds:**

- Selection on control-subtracted seek benefit beats random selection.
- Selection preserves or improves the best seeker in every seed (6/6).
- Mutation can construct seekers better than the initial draw, in roughly a third
  of runs at this size.

**Not claimed:**

- Anything about the sensor gain as a mechanism. It discriminates in 3/6 and was
  retracted in §127.
- Anything at population sizes other than 20, or beyond six generations.
- That the creatures orient well. Benefit +0.43 means the sensor closes 43% more
  of the distance than swimming straight does — real, measurable, and a long way
  from a fish turning to face a light.
- Any of this in the shipped code path. It runs in `tools/`, on a harness, with
  `bearingTo` still measuring the wrong plane.

## 139. Method, for the next session

Three claims were made and retracted inside this one series — §119's gain
mechanism at four seeds, §128's "retention not generation" at five, and §115's
p-value arithmetic. Each was true of the data in hand and false as stated. The
series survived them because the design was fixed in advance and the runs were
paired; the retractions cost write-up, not results.

The habit worth carrying: **state the endpoint and the n before the first run,
and treat everything else the runs produce as an observation, not a finding.**
The primary endpoint here was declared at §110 and never moved. Everything that
had to be retracted was a secondary reading promoted mid-series.

## 140. State at close

Gate **GREEN, 80 assertions, 76 passed, 0 failed, 4 pending**.

Engine changes, all with the reasoning in the code:

| file | change |
|---|---|
| `engine/l1/physics.js` | `opts.motorFreqHz` / `motorZeta` — reference actuator parametrisation, default off |
| `engine/l1/factory.js` | `preyGain` / `threatGain` drawn instead of hardcoded 0 |
| `engine/l1/mutate.js` | `mutateSensorGain` operator |
| `gate/breed.js` | `diffGenome` sees the sensor genes; L1-23 contract entry; L1-26 amended |
| `worlds/seeds.js` | new — the authored creature library |

Next, in order, none of it a search:

1. Generalise `POPULATION` in `breed.js` so the shipped breeding path can run
   this instead of a harness.
2. Register `steeringAuthority` and `seekBenefit` on the species record
   (BRIDGE_V bump).
3. `bearingTo` and `headingOf` in the measured steering plane.
4. Default the solver motor: `work` accounting, L1-18, spherical joints.
5. Atlas write path: `store.set(KEY.specimen(hash), …)`.

---

# Session 10o — `breed()` generalised, tank behaviour bit-identical

## 141. What was in the way

`POPULATION = 6` was a module constant and `breed()` threw on any other length,
so `tools/_evo.mjs` had to reimplement N17 and N18 in a harness. **The shipped
path and the experiment were two pieces of code that only looked alike** — the
six-seed result in §135 was never a statement about `breed()`.

## 142. The rate generalises, not the slot

The naive change is to keep "one slot is always a stranger". At two hundred that
is 0.5% immigration, which is not the rule, it is the rule's corpse: 20 §3's
finding is that selection converges to a single animal in about five generations,
and one immigrant in two hundred does not slow that at all. **The invariant is
the rate.**

    export const strangerCount = (population) => Math.max(1, Math.round(population / 6));

    6 -> 1    12 -> 2    20 -> 3    50 -> 8    200 -> 33

Exactly 1 at six, so the tank is untouched, and one in six everywhere else.
`eliteCap` follows as `population - strangerCount(population)`, which is 5 at
six, exactly as the constant was.

## 143. Bit-identical at 6, verified two ways

The stranger allocation became a loop. At population 6 it runs once and draws
once, so the rng stream is unchanged and every seeded result still holds —
`rng.fork(\`stranger:${slot}\`)` keys on the slot index, so the stream is also
independent of how many strangers there are.

**Gate GREEN, 80 assertions, 76 passed, 0 failed, 4 pending.** N17, N18, the
provenance assertions and the seeded breed reproducibility checks all pass
unmodified, which is the real test: a change that preserved behaviour would look
exactly like this, and a change that did not would not.

And at other sizes (`tools/_breedsize.mjs`):

    pop   elite cap   strangers   next generation                 N18 elites unchanged
      6           5           1   elite  2, offspring  3, str  1  yes
     12          10           2   elite  4, offspring  6, str  2  yes
     20          17           3   elite  6, offspring 11, str  3  yes
     50          42           8   elite 15, offspring 27, str  8  yes

`seedPopulation` takes `population` too, defaulting to `POPULATION`, so an
auto-breeder can open a run of a hundred through the path the tank uses rather
than through a copy of it.

## 144. What this does and does not change

**Does:** the selection experiment can now run through the shipped breeding code.
Re-running the six seeds through `breed()` would make §135 a statement about the
game rather than about a harness, and that is the version worth quoting.

**Does not:** anything the player sees. The tank is six slots, one stranger, five
elite cap, same rng draws, same creatures from the same seed.

One caveat worth stating rather than discovering later: `breed()` takes
`selected` as *indices in the order tapped*, which is a player gesture. An
auto-breeder passes a fitness ranking into that argument, and the round-robin
parent draw then favours whatever it puts first. At six that is invisible; at
fifty, rank order determines how offspring are distributed and should be a
deliberate choice rather than an inherited one.

## 145. Next

1. ~~Generalise `POPULATION`~~ — done.
2. Re-run one seed through `breed()` to confirm the harness and the shipped path
   agree, then the remaining five.
3. Register `steeringAuthority` and `seekBenefit` on the species record.
4. `bearingTo` / `headingOf` in the measured steering plane.
5. Default the solver motor.

---

# Session 10p — the finding replicates through the shipped path

## 146. Same experiment, `breed()` instead of a harness

`tools/_evobreed.mjs` runs the identical selection experiment through
`seedPopulation()` and `breed()`. The two paths are **not the same algorithm**,
and the differences are all the shipped path being richer:

1. `mutateTimes` applies **1–3** mutations per offspring; the harness applied 1.
2. `seedPopulation` draws **viable** strangers — `assessViability` in the real
   world, with gravity — where the harness only required a joint.
3. N18 elites keep their **slot**; the harness moved them to the front.
4. `selected` is "indices in the order tapped", a player gesture; an auto-breeder
   puts a fitness ranking there and the round-robin parent draw then favours
   whatever comes first (§144).

So this is not a numerical comparison. The question is whether the **finding**
replicates.

## 147. It does

Seed S1, compared at generation 4 — the selected arm hit its wall-clock budget
and checkpointed there, which is what the guard is for:

    breed() path        median      best    |gain|
      selected          0.2706    0.3734     1.171
      control           0.0336    0.2783     0.246
      difference       +0.2369

    harness path, same seed, same generation
      difference       +0.2100

**+0.2369 through `breed()` against +0.2100 through the harness.** Two different
reproduction algorithms, the same direction and nearly the same magnitude.

Best individual, generation 0 to final:

    selected   0.2706 -> 0.3734   +38%
    control    0.2706 -> 0.2783    +3%

And the sensor gain separates cleanly here — 0.427 to **1.171** selected against
0.427 to **0.246** control — though §127 stands and one seed is not a mechanism.

## 148. Two things the shipped path shows that the harness could not

**Viability is real and small.** Generation 0 reported 19/20 viable, every later
generation 20/20. `seedPopulation` filters at the door and `breed()` keeps doing
so, which the harness never did — it required only `jointCount >= 1`. So the
harness was evaluating a slightly worse population throughout, and the shipped
path's slightly higher numbers are consistent with that rather than with anything
about selection.

**Diversity holds at 20/20 with 3 strangers.** §142's rate rule gives
`strangerCount(20) = 3`, and the run held 20/20 distinct genotypes in every
generation but one. N17 generalised by rate does the job it was written for at a
size it was never written for.

## 149. What is now true

> The six-seed result (§135, p = 0.031) was produced by a harness. Seed S1 has
> now been reproduced through the shipped `breed()` path with a larger paired
> difference (+0.237 vs +0.210) under a different mutation regime. **One seed,
> not six** — but the finding is no longer an artefact of code that only the
> experiment used.

Re-running S2–S6 through `breed()` would make the p = 0.031 claim a statement
about the game. That is five chunks and no new machinery.

## 150. Next

1. ~~Generalise `POPULATION`~~ — done (§142).
2. ~~Confirm the shipped path agrees on one seed~~ — done, +0.237 vs +0.210.
3. S2–S6 through `breed()`, five chunks — optional, and the honest way to quote
   p = 0.031 as a property of the game.
4. Register `steeringAuthority` and `seekBenefit` on the species record.
5. `bearingTo` / `headingOf` in the measured steering plane.
6. Default the solver motor.

---

# Session 10q — the two fields registered. Compute stopped.

## 151. Replication of S2–S6 through `breed()` is not worth its cost

Five chunks, roughly 37 minutes of simulation, to move one qualifier: "the
finding was reproduced on one seed through the shipped path" becomes "on six".
S1 already agreed in direction and in magnitude (+0.237 vs +0.210) across two
different reproduction algorithms. **Dropped.** If it matters later it is five
mechanical chunks and no new machinery.

The remaining work is code, gate-verified, and costs one gate run each.

## 152. `turnRate3d` and `steeringAuthority`, registered

`probe.js` gains `turn3d(trace, from, to, stride)`: the turn of the DIRECTION OF
TRAVEL, read from the `com` channel, in whatever plane it happens in, plus the
axis it happens about. `stride` defaults to 12 samples because the CoM oscillates
at 12–22 Hz with the stroke and consecutive samples are dominated by that wobble
rather than by the turn.

S3 already runs the bias in both directions so intrinsic curl cancels in the
rate. The same differencing now applies to the 3-D rate and to the **axis**:

    turnRate3d        = |rate3d(+bias) - rate3d(-bias)| / 2
    steeringAuthority = |axis(+bias) - axis(-bias)| / 2      clamped to 1

Authority is the quantity S3 lacked. **A creature can have a large turn rate and
zero steering authority** — 1 means the two bias directions turn it in exactly
opposite senses, 0 means the input does not change which way it curls whatever
the rate says. Measured across the authored library it separates cleanly where
`turnRate3d` does not: eel 1.00, eel-finned 0.00, staircase 0.98, against rates
of 0.202 / 0.179 / 0.090.

`turnRate` is **not** replaced. It remains the yaw component and N21 still clamps
by it, because changing what N21 clamps by is a separate decision with its own
consequences and should be made deliberately, not as a side effect of adding a
field.

## 153. BRIDGE_V 2 → 3, and the gate earned its keep three times

Every failure was correct and specific:

- **L2-9** — "no solo field left unassigned: got `turnRate3d,steeringAuthority`".
  I had registered the fields and edited `compile.js`, but the edit to S3's
  `return` had silently not applied: my pattern assumed `turnRate, intrinsicRate`
  and the code reads `turnRate, turnRadius`. The fields were registered,
  forwarded, and never produced. A string replace that matches nothing fails
  silently; the gate does not.
- **L2-17** — the fauna loader surfaced the same gap per species, which is the
  same defect seen through the join.
- **V1** — `version.json` and `trunk/version.js` still said bridge 2. Then said
  it again, because `trunk/version.js` is a generated mirror whose `bridge: 2`
  did not match the `sed` pattern that worked on the JSON.

**Gate GREEN, 80 assertions, 76 passed, 0 failed, 4 pending.**

## 154. Files changed this session

| file | change |
|---|---|
| `engine/l1/physics.js` | `opts.motorFreqHz` / `motorZeta`, default off |
| `engine/l1/factory.js` | sensor gains drawn instead of hardcoded 0 |
| `engine/l1/mutate.js` | `mutateSensorGain` operator |
| `engine/l1/breed.js` | `POPULATION` generalised; N17 as a rate |
| `engine/l2/probe.js` | `turn3d` |
| `engine/l2/probes.js` | S3 returns `turnRate3d`, `steeringAuthority` |
| `engine/l2/compile.js` | forwards both |
| `contracts/species.js` | both registered |
| `contracts/versions.js`, `version.json`, `trunk/version.js` | BRIDGE_V 2 → 3 |
| `gate/breed.js` | diff sees the sensor genes; L1-23 entry; L1-26 amended |
| `worlds/seeds.js` | new — authored creature library |

## 155. Left, cheapest first

1. **`bearingTo` / `headingOf` in the measured plane.** `steeringAuthority` and
   the axis now exist as measured fields, so the plane a creature steers in is a
   quantity the record carries — which is what §72 said was missing. This is now
   a small change rather than a research question.
2. **Atlas write path** — `store.set(KEY.specimen(hash), …)` on selection, then
   `store.list('specimen:')` into the grid. One afternoon; everything under it
   exists and none of it has ever been called.
3. **Default the solver motor** — `work` accounting on the solver path, L1-18
   model-agnostic, and the spherical-joint hole (42% of joints still on the PD).
   The largest remaining piece, and the one every measured number depends on.
4. S2–S6 through `breed()`, if the six-seed claim ever needs to be about the
   shipped path rather than about a harness.
