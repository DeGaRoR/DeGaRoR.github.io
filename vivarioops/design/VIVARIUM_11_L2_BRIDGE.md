# VIVARIUM — 11 · L2 Bridge

**The compiler.** Takes a genome and a world; returns a measured record that L3 can
consume by the thousand.

| | |
|---|---|
| **Status** | Normative |
| **Supersedes** | Nothing (new component) |
| **Requires** | An amendment to L1 — see §10. Do not skip it. |
| **Consumed by** | 12 L3 World |
| **Revision R3** | §4 seeding replaced by canonical pair derivation (03 §2) · §6 output is now a symmetric `PairMatchup` · §7 schema deleted, deferred to **03 Contracts** · §12 proxy-fidelity test corrected |

---

## 1. Contract

```
compile(genome, world, residents[]) → CapabilityRecord
```

A **pure function**. Same inputs, same output, always, on the same device. No wall
clock, no `Math.random`, no network, no learning, no fitting to anything other than the
creature's own measured points.

Everything L3 knows about a creature comes from this record and nothing else. If a
property is not in the record, L3 cannot behave as if it exists.

---

## 2. Design principles

**Measurement, not modelling.** Every number is the reduction of a physical trace. There
is no formula that estimates a creature's speed from its morphology — we run it and see.

**One abstraction.** There is exactly one extensible concept, the `Probe`. Adding a new
measurement means adding a probe, never touching the pipeline.

**No abstract opponents.** Matchup numbers come from duels against the *actual* resident
creatures in the *actual* world. Dummies were a fiction: a dummy cannot shield its
torso, counter-attack, or flee. Measuring the real matchup removes extrapolation error
rather than reducing it, and it produces non-transitive matchups — A beats B, B beats C,
C beats A — which a scalar model can never yield.

**The compile is the spectacle.** Duels are the arena. The player watches the matrix fill
in and can replay any cell. The wait *is* the content.

**Energy is mechanical work.** No invented cost stat. Power is `Σ|τ·ω|` summed over
joints, which is a real quantity the solver already has.

---

## 3. The Probe abstraction

The whole layer is this interface plus a list of instances.

```js
Probe = {
  id:        string,          // stable; part of the seed derivation
  kind:      'solo' | 'duel',
  duration:  number,          // simulated seconds
  repeats:   number,          // deterministic variations

  setup(world, rng, subject, opponent?) → SceneSpec,
  //   returns initial placement, orientation, separation, control overrides

  reduce(trace, trace2?) → { key: value, ... }
  //   pure reduction of the recorded trace(s) to named measurements
}
```

**Trace** is fixed-size and preallocated — no growth during simulation:

```js
Trace = {
  n:        int,                    // samples recorded
  t:        Float32Array,
  com:      Float32Array,           // centre of mass, 3/sample
  vel:      Float32Array,           // 3/sample
  heading:  Float32Array,           // 1/sample, yaw
  work:     Float32Array,           // cumulative Σ|τ·ω| , 1/sample
  contacts: Int32Array,             // encoded contact events
  flags:    Uint8Array              // NaN / instability / termination cause
}
```

Sampling at 20 Hz regardless of the 120 Hz physics step. A 15 s duel is 300 samples.

---

## 4. Determinism and seeding

**Solo probes:**
```js
seedFor(probeId, repeat, subjectHash, worldHash) =
    fnv1a(`${BRIDGE_V}|${worldHash}|${subjectHash}|${probeId}|${repeat}`)
```

**Duels — canonical unordered pair (R3).** The previous form was order-dependent, which
contradicted validation test 4. See 03 §2.
```js
[lo, hi] = [aHash, bHash].sort()
pairSeed = fnv1a(`${BRIDGE_V}|${worldHash}|${lo}|${hi}|${repeat}`)
```
Placement order and which body reports as "subject" derive separately from `pairSeed`, so
A-vs-B and B-vs-A run identical fights read from opposite ends.

Every stochastic decision inside a probe — initial separation, approach angle, beacon
path — draws from a PRNG seeded by exactly this. Consequences:

- The matrix is reproducible; a replay needs only the seed.
- Repeats are varied but not random: repeat 3 of a matchup is always the same fight.
- `BRIDGE_VERSION` bumps invalidate every cached record. This is the only invalidation mechanism and it must be respected.

Physics runs at fixed `dt = 1/120`, substepped, with the same Rapier build. Cross-device
identity is **not** promised; see 01 Architecture.

---

## 5. Solo battery

Preamble for every solo probe: **settle** — instantiate, no control, 2 s, let it come to
rest. Not measured; it removes instantiation transients that would otherwise pollute
every reading.

### S1 · Morphometrics — no simulation

Read directly from the body plan. Free.

| Measure | Definition |
|---|---|
| `mass` | Σ body mass |
| `volume` | Σ body volume |
| `boundingRadius` | max distance from CoM to any body surface |
| `longestAxis` | principal axis extent |
| `frontalArea` | projected area on the forward axis |
| `surfaceArea` | Σ exposed body surface (harvest surface in L3) |
| `reach` | max distance from root body centre to any extremity |
| `bodyCount`, `jointCount`, `dofCount` | counts |
| `torsoExposure` | fraction of the root body's solid angle not occluded by other bodies, sampled over 64 rays |

`torsoExposure` is the cheap geometric half of defence. Capture in L3 and in duels is
defined as contact with the **root body** (the paper's rule, modelling a weak point that
morphology can evolve to protect), so a well-shielded root is measurably harder to
reach. It costs 64 ray casts, once.

### S2 · Locomotion — three efforts, one curve

Run the creature freely with a global multiplier on `omega`: **0.6, 1.0, 1.5**. 12 s
each, measure over the final 8 s.

Per run: `speed` (mean |velocity|), `power` (mean d`work`/dt), `straightness` (net
displacement / path length), `gaitFrequency` (dominant frequency of vertical CoM
oscillation, by zero-crossing count).

Then fit, over three points, two coefficients:

```
power(v) = c₀·v + c₁·v³
```

Physically motivated: drag force ∝ v², power = force × velocity ∝ v³, with a linear
term for internal losses. Two unknowns from three points, least squares, well
determined.

Derived:

| Measure | From |
|---|---|
| `cruiseSpeed` | speed at effort 1.0 |
| `burstSpeed` | speed at effort 1.5 |
| `burstRatio` | burstSpeed / cruiseSpeed — **decides ambush vs coursing in L3** |
| `cotC0`, `cotC1` | the fit |
| `basalRate` | power at effort 0, extrapolated, floored at `KLEIBER · mass^0.75` |
| `straightness`, `gaitFrequency` | effort 1.0 run |

This single probe replaces what would otherwise be separate cruise, burst, acceleration
and efficiency probes. Three runs, one fit.

### S3 · Turning

Apply a constant differential bias to the oscillator: mirrored joint instances receive
`+turnBias`, non-mirrored receive `−turnBias`. (Mirror provenance is known from
morphogenesis; for radial or asymmetric bodies, fall back to the sign of the body's
lateral offset from the root.) 8 s.

| Measure | Definition |
|---|---|
| `turnRate` | mean d(heading)/dt, rad/s |
| `turnRadius` | cruiseSpeed / turnRate |
| `turnSpeedRatio` | speed while turning / cruiseSpeed |

`turnRate` is the most important number the bridge produces, because L3 clamps every
steering decision by it. It is what physically prevents a lumbering creature from
behaving like an agile one in the ecosystem.

### S4 · Pursuit · S5 · Evasion

Both require the sensor amendment in §10.

**S4:** a beacon emitting the *prey* channel moves on a fixed path at 0.5×, 1.0× and
1.5× the subject's cruise speed. 10 s each. Measure mean closing rate, normalised.
`pursuitGain` = clamp(mean normalised closing rate, 0, 1). The speed at which closing
rate crosses zero is recorded as `maxChaseSpeed`.

**S5:** a beacon emitting the *threat* channel approaches at 1.2× cruise speed. 10 s.
`evasionGain` = clamp(mean normalised separation rate, 0, 1).

These two measure **disposition** — what the creature does — as distinct from capability.
Without them a fast creature that ignores prey and a fast creature that chases it are
identical in L3, which would be wrong.

---

## 6. Duel probe

One probe, run once per (subject, resident) pair per repeat. This is the whole matchup
mechanism.

**Setup.** Both creatures settled, placed at separation `d = k · (reachA + reachB)` with
`k` drawn per repeat from {2, 3, 4, 5, 6}, at a relative bearing drawn per repeat from
{0°, 72°, 144°, 216°, 288°}. Each sees the other on its threat *and* prey channel —
the creature's own evolved gains decide whether it approaches or avoids. **Nothing
assigns roles.**

**Termination**, whichever comes first: A's body contacts B's root body · B's body
contacts A's root body · 15 s elapse.

**Per-duel record:** `outcome ∈ {A, B, none}` · `timeToOutcome` · `workA`, `workB` ·
`minDistance`.

**Reduction over `repeats = 5`:**

| Field | From |
|---|---|
| `pCapture` | fraction of repeats where subject captured resident |
| `pCaptured` | fraction where resident captured subject |
| `pStalemate` | fraction with no capture |
| `timeToCapture` | median `timeToOutcome` over subject's wins; if none, `duration` |
| `energyCost` | mean `workA` per engagement, per second |

Those five fields **are** the `vs[]` row in L3's species table. No transformation, no
interpretation. `pCapture` and `timeToCapture` are read directly by L3's predation roll.

Five repeats is the default. It gives probability resolution of 0.2, which is coarse but
honest; the alternative is a longer compile. `repeats` is a world constant so a
"championship" world can raise it.

---

## 7. The record — see **03 Contracts**

**Deleted at R3.** The schema previously stated here diverged from 01 and 12. The single
canonical definition of `Species`, `PairMatchup` and `WorldKey` now lives in **03
Contracts** and is shipped as `/contracts/*.js`. No other document restates it.

L2 produces **`PairMatchup` records and measured fields**. It does *not* assemble the
dense `Species.vs` matrix — the fauna loader does that (03 §3), which is why L2's output
is per-pair rather than per-species.

## 8. Pipeline and caching

```
compile(genome, world, residents):
  bodyPlan  = morphogenesis(genome)            // L1, deterministic
  if (!viable(bodyPlan)) return invalid

  morph     = S1(bodyPlan)                      // no simulation
  loco      = S2(...) ∪ S3(...)                 // 3 + 1 runs
  disp      = S4(...) ∪ S5(...)                 // 3 + 1 runs
  vs        = for each resident r, for each repeat i: duel(subject, r, i)

  record    = assemble(...)
  cache.put(key(genomeHash, worldId, BRIDGE_VERSION), record)
```

**Cache key** is `genomeHash ⊕ worldId ⊕ BRIDGE_VERSION`. The residents' mutual matrix is
computed once when a world is built and **shipped with the world** — the player's
compile is O(residents), never O(residents²).

**Parallelism:** every probe and every duel repeat is independent. Dispatch across Web
Workers, one physics world per worker, no shared state. This is the payoff for L1's
purity rule.

---

## 9. Cost

| Stage | Simulated seconds | Notes |
|---|---|---|
| Settles | ~20 | 2 s × 10 runs |
| S2 locomotion | 36 | 3 × 12 s |
| S3 turning | 8 | |
| S4 pursuit | 30 | 3 × 10 s |
| S5 evasion | 10 | |
| Duels | 8 residents × 5 × 15 = **600** | two creatures each |
| **Total** | **~700** | |

At 120 Hz that is ~84 000 solo steps and ~72 000 duel steps. Measured against typical
Rapier cost for a 20-body island, single-threaded this lands around **8–10 seconds**;
across four workers, **2–3 seconds**. Acceptable as a deliberate "preparing the
expedition" beat with a progress display, and cached permanently afterwards.

The duel stage dominates at ~85% of cost, which is correct — it is also the part the
player watches.

---

## 10. Required amendment to L1 — the steering sensor

**This is a real change to the L1 spec and must not be skipped or the bridge is
meaningless.**

As specified, the L1 controller is a pure oscillator with an empty sensor vector. Such a
creature cannot steer toward or away from anything. It therefore cannot pursue, cannot
evade, and cannot meaningfully duel — two creatures would simply follow their gaits and
collide by accident. `pursuitGain` and `evasionGain` would be unmeasurable.

The minimal fix, and it is genuinely minimal:

**Two sensor channels**, following Sims' competition paper, which used two photosensor
colours — one on the contested cube, one on the opponent:

```
sensors = { preyBearing, threatBearing }    // signed, normalised to [-1, 1], 0 if none in range
```

**Two genes on the genome**, mutating like everything else:

```
ControllerGenes += { preyGain: -1..1, threatGain: -1..1 }
```

**One line in the controller**, reusing the differential bias mechanism already needed
for the turning probe:

```
turnBias = preyGain · preyBearing + threatGain · threatBearing
// applied as +turnBias to mirrored joint instances, −turnBias to non-mirrored
```

Negative gain produces avoidance, positive produces approach; the sign is evolved, not
declared. A creature that flees prey and chases threats is possible and will simply lose.

Cost: two genes, two scalars, one line. Everything else in L1 is unchanged. Schedule it
for Phase 3, not Phase 1 — the tank does not need it.

---

## 11. Failure handling

Every failure produces a **valid record with honest numbers**, never an exception.
A creature that cannot move is not an error; it is a creature that will die in the world.

| Condition | Detection | Result |
|---|---|---|
| Inert | `cruiseSpeed < 0.05` | recorded as is; `valid` stays true |
| Physics instability | NaN or `|v| > 1000` in trace | probe aborted, `valid = false`, reason `unstable` |
| Non-viable body | L1 viability filter | `valid = false`, reason `nonviable` |
| Degenerate power fit | efforts produce indistinguishable speeds | fall back to `c₀ = power/v`, `c₁ = 0` |
| Duel never terminates | duration cap | counted as stalemate — the correct answer |
| Zero residents | world misconfigured | `vs` empty; L3 must handle |

---

## 12. Validation

1. **Determinism.** Same genome, world and seed → byte-identical record, twice.
2. **Cache soundness.** Compiling twice with a cache clear between yields identical records.
3. **Monotonicity.** Scaling a creature's `omega` up increases `cruiseSpeed` and increases `power` faster than linearly. If not, the work accumulator is wrong.
4. **Symmetry.** `pCapture(A vs B)` measured from A's compile equals `pCaptured(B vs A)` measured from B's — same duels, opposite viewpoints. Divergence means the seed derivation is not order-independent.
5. **Non-transitivity exists.** Across a resident set, find at least one A>B>C>A cycle. Its absence suggests the duels are decided by a single dominant capability, which would mean the matchup matrix adds nothing over a scalar.
6. **Proxy fidelity — corrected at R3, and this correction matters.**

   The previous test compared 100 full-physics duels against a `pCapture` derived from
   full-physics duels. That is physics against physics: it measures sampling noise, not
   the reduction. It did not test the thing 00 R2 §P3 promises to test.

   The transfer boundary is **L3's reduced encounter model versus L2's full physics.** So:

   - run 500 isolated L3 encounters between two species using only their `Species` records and the 03 §4 hazard;
   - run 100 full-physics L2 duels for the same pair;
   - compare **capture frequency** *and* **capture-time distribution** (KS statistic), not just the mean.

   Agreement in frequency within ±0.1 and no KS rejection at p = 0.05. **This is the test
   that says the bridge is honest**, and it gates the start of D2.

---

## 13. UI hooks

The compile screen is a **matchup grid**: residents down one axis, the five reduced
values across. Cells populate as workers report. Each cell is tappable → replays that
exact duel at normal speed from its seed, free, because it is deterministic.

Progress is expressed in duels completed, not percent. The player should be able to read
"I am losing badly to the ram" before the compile finishes.

---

## 14. Open questions

1. **Many-on-one duels.** Pairwise cannot represent pack hunting. Deferred: L3 approximates multiplicity with its own rules (accumulating threat response, separation). Revisit only if ecosystem behaviour looks wrong.
2. **Repeat count.** 5 is a cost/resolution compromise. If matchups feel noisy in play, raise to 9 and accept a longer compile.
3. **Should the player choose the world before compiling?** Currently yes — records are world-specific, since medium and gravity change everything. This means switching worlds requires recompiling. Acceptable; it is cached per world.
