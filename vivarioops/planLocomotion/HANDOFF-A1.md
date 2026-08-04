# Handoff — Phase A investigation

Companion to `DESIGN-LOCOMOTION-TO-INTENT.md`, which holds the plan. This file
holds only what you need to *re-run* it.

## Setup

```
node tools/_zvariants.mjs        # regenerate engine/l1/_z*.js, ~1 s
echo 'engine/l1/_z*.js' >> .gitignore
```

The generator rebuilds every instrumented copy of `physics.js` that the
diagnostics import. **Run it after any edit to `physics.js`.** It asserts on its
anchors, so if the source has moved it fails loudly rather than silently
measuring a stale copy. Nothing under `engine/` is modified.

Corpus for every tool is `rngFrom('decay', 'corpus', i)` filtered to
`viability.ok && jointCount >= 3`, so results are comparable across tools.

## What is established

| # | Claim | Evidence | Tool |
|---|---|---|---|
| 1 | **The simulation is not converged in time.** Path speed falls 3–4.5× from `dt=1/120` to `1/960`, monotone, no plateau at 8× refinement. `work` flat or rising, so cost of transport is ~10× wrong in the flattering direction. | 6 creatures × 4 timesteps | `_zconv` |
| 2 | **One defect, not two.** Passive coast ratio 0.414 ≈ active swim ratio 0.501. Drag and thrust corrupted identically. | 8 creatures | `_zdecay2` |
| 3 | **The fluid law does not inject energy.** `F·v < 0` at every step, `sc = 1.000` throughout. | 40 steps, real plan | `_zforce` |
| 4 | **The CPG never commanded a coherent wave.** Commanded inter-joint coherence 0.615 and flat; achieved 0.43–0.48. `phaseLag` is an independent uniform draw per node, accumulated along the tree — a random walk, not a gradient. | 16 creatures × 300 s | `_zcoh` |
| 5 | **Saturation is real and progressive.** 0.018 → 0.129 across 30 s windows over 300 s. | 16 creatures | `_zcoh` |
| 6 | **`work` cannot distinguish injection from dissipation.** `work += abs(tau*relOmega)*dt`. | code read | — |
| 7 | **Commanded coherence is dt-invariant** (ratio exactly 1.000), so **A2 can be built in parallel** and none of its gates move when A1 lands. | 6 creatures | `_zfluid` |

## What is disproven — do not re-investigate

| Hypothesis | Result | Tool |
|---|---|---|
| Torque budget / saturation causes the instability | `budgetScale` 1→24: saturation → **0.000**, KE runaway unchanged or worse | `_zstiff` |
| Added mass | ratio 0.475 vs baseline 0.554 | `_zarm` |
| The torque bound | 0.444 | `_zarm` |
| Motor strength | 0.479 | `_zarm` |
| Implicit solver spring | solver 0.554 vs explicit PD 0.544 — both paths equally affected | `_zarm` |
| Fluid energy/momentum guard | mean `sc` **1.000**, bind **0.0%** at 0.5 / 2 / 20 cm/s, both dt | `_zguard`, `_zguard2` |
| Semi-implicit drag correction on the body | coast ratio **0.622 → 0.623**, a no-op; `λ_body·dt ≈ 0.11` | `_zv1`, `_zsolo4` |
| **Joint solver convergence** | iterations 8→128: ratio 2.50 / 2.14 / 2.17 / 2.09 / 2.85. No trend. **Do not bump `SOLVER_ITERATIONS` again.** | `_zsolver` |

## The one remaining candidate

Fluid force sampling rate against limb speed. Evaluated once per step per
quadrature sample from the local velocity `v + ω × r`. Every sample is
dissipative (#3), but thrust is net momentum transfer, and how finely that is
sampled across the step is the only remaining thing `dt` touches.

Directional support (`_zomega`): slowing the CPG 4× moves the fine/coarse ratio
0.562 → 0.714. Two points at n=5.

**Two earlier mechanisms in this investigation were stated confidently and were
wrong.** Treat this as the leading candidate, not as established.

### The confirmation test — run this before building anything

Substep the fluid force alone, leaving solver and motor at `FIXED_DT`. In
`applyEnvironment`, evaluate the quadrature at `n` sub-samples across the step by
advancing `v`, `ω` and body rotation ballistically, and apply the averaged
impulse.

> **If `n = 4` at `dt = 1/120` reproduces the `dt = 1/480` speed to within 10%,
> the mechanism is confirmed and the substep is the fix.**

If it fails, the mechanism is wrong too and the elimination list has a gap. Say
so and stop — do not propose a sixth mechanism without a new measurement.

Cost: the quadrature is already 96 samples per body, so `n = 4` is 4× the hot
loop. Set `n` from a local Courant number rather than as a constant, and measure
the frame budget on the largest corpus body plan.

## Tools

**Keep as permanent gates** — run against any change to the fluid model:

| tool | question | gate |
|---|---|---|
| `_zconv` | does path speed converge in `dt`? | within 10% at `dt/4`, ≥ 90% of corpus |
| `_zdecay2` | passive drag vs active thrust under refinement | same criterion, passive arm |
| `_zcoh` | commanded vs achieved inter-joint coherence | commanded ≥ 0.90, achieved ≥ 0.90 × commanded |
| `_zforce` | does the fluid law inject energy? | 0 steps with `F·v > 0` |

**Diagnostics** — `_zdt`, `_zarm`, `_zfluid`, `_zpump`, `_zdecay`, `_zsolo5`,
`_zsolo6`.

**Archived negatives** — `_zstiff`, `_zguard`, `_zguard2`, `_zv1`, `_zsolo4`,
`_zsolver`, `_zomega`. Keep rather than delete: *a retired finding can un-retire*,
as C6.1 already demonstrated once in this repo.

## Two caveats on my own work

- **`_zsolo` and `_zsolo5` build a single-body plan by carving a literal**
  (`{...plan, bodies:[b0], joints:[], jointCount:0}`). The engine may not
  consider that well-formed. Their oscillation result was superseded by `_zforce`
  and `_zsolo6` on the real plan — the ringing is internal joint sloshing at
  `effort = 0` (motors still hold bias), which is expected behaviour, not a
  tether. Do not build on the carved-plan result.
- **Corpus-median KE ratios are confounded by startup transient.** A creature
  accelerating from rest to cruise looks identical to a runaway over one window.
  Use window-to-window ratios (150–300 s vs 60–150 s), which is what the A1 gate
  specifies.

## Consequences when A1 lands

- Cruise speeds fall ~3×. A correction, not a regression.
- `FOOD_ENERGY` needs its largest recalibration yet. Do it once, at the end of
  Phase A.
- Every trajectory-derived figure must be re-measured: cruise speed, cost of
  transport, the 68× fluid finding, duel closing rates, forage `eaten`, and the
  interpretation of the 0.347 tracking gain. `_zplate`'s force micro-tests
  measure forces directly and survive.
- Re-measure the KE runaway subset (5 of 16 at 300 s) before opening any separate
  stability chantier. It may not survive the fix.
