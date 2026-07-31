# Handover — the locomotion investigation

> ## ⚠ SUPERSEDED IN PART — read `HANDOVER-SESSION10.md` first
>
> Session 10 measured several claims in this document and found them false. The
> corrections, so that nothing below is acted on as written:
>
> **§3 priority 2, "the slice cannot build a serpent — `SLICE_LIMITS.maxRecursion`
> is 2, one line".** WRONG, and it is not one line. `maxRecursion` is read only by
> `factory.js` and `mutate.js` — the RANDOM genome generator. Hand-written seeds go
> straight to `morphogenesis` and never consult it. What actually capped the chain
> was `tools/_seed.mjs`'s `parentFace: 0`: `makeJointData` attaches a child by its
> own −Z face, so a self-connection on +X is a ninety-degree turn, the chain
> spirals into itself, and `obbOverlap` rejects the fourth segment. Attach on +Z
> (`parentFace: 5`) and the same unmodified slice builds 13 bodies over 6.5 m with
> zero rejections. Every efficiency figure measured on a "6-segment serpent" was
> taken on a 3+1 staircase.
>
> **§3 priority 5, "direction control does not work and should not be built —
> steering is downstream of gait coherence".** The conclusion is right; the reason
> is wrong. Measured on a body at efficiency 0.93, yaw response to `turnBias` is
> still exactly zero. Gait coherence was not the gate. `bearingTo` computes a
> horizontal compass bearing while a chain bends about its limbs' local X and turns
> in PITCH — the sensor measures one plane and the actuator drives another, so the
> loop has never been closed. Not poorly closed: open, by construction, in the
> coordinate convention.
>
> **§3 priority 1, "default the solver motor".** Necessary and not sufficient.
> Rapier's JS binding exposes motors on revolute-family joints only, so ~42% of
> corpus joints stay on the PD with a tracking gain p95 of 10.9. Also
> `setMotorMaxForce` does not exist in rapier3d-compat 0.19.3, so §44's plan to
> preserve N19 via max force is not implementable and 00 §9's bounded actuator
> power is currently unenforced on the solver path.
>
> **§7, `_track.mjs` / `_amp.mjs`.** Both read `j.axisLocal`, a field that does not
> exist, and measured about the parent's X axis. Fixed in session 10 by exporting
> `jointAxisAtSpawn`.
>
> **§6, "one assertion worth adding".** Still worth adding, and now cheap: through
> the solver motor a π/2 travelling wave beats unison on efficiency by 68×.



Nine sessions, opened by "buoyancy makes them move faster than they can move on
their own". Gate at close: **GREEN, 80 assertions, 76 passed, 0 failed, 4
pending.** Full detail in `HYDRODYNAMICS.md`; this is the operational summary.

Run `npm install && npm run vendor && npm run gate` — the zip ships
`vendor/VENDOR.json` but not `vendor/`, so V2 reds on packaging alone until you
vendor.

---

## 1. The one-line story

The creatures were never swimming. An explicit PD joint controller saturated its
torque clamp 52% of the time, which makes it a bang-bang relay, and relays
limit-cycle. Everything downstream — the buoyancy symptom, the "slow" locomotion,
the missing morphology correlation, the absent steering — was that oscillator
seen from a different angle.

Buoyancy was real and is fixed. It was also the smaller of the two problems, and
the one that was loud.

---

## 2. What is verified correct — stop re-examining

| | evidence |
|---|---|
| buoyancy | neutral by construction, `SLICE_LIMITS.density [1,1]`, matches the reference exactly |
| the drag law | measured against analytic at 0.1–30 m/s, ratio **1.000** at every point |
| fluid model behaviour | a π/2 travelling wave beats unison **3.3× on efficiency**, unprompted — textbook undulatory locomotion |
| derived actuator physics | muscle stress 2e5 Pa, Hill force–velocity, tendon moment arm 0.2 — three real constants, no dials |
| genome + morphology | an essentially exact port of `mycoolfin/the-simsulator` |
| selection | median displacement **0.181 → 5.546 m in 8 generations**, 30× |

---

## 3. What is broken, in priority order

**1. The actuator is still the PD by default.** `opts.motor = 'solver'` exists and
works (CoM path speed 5.52 → 0.77 m/s, 7× calmer). Two items block defaulting it:

- solver-driven joints do not accumulate `work` — the PD path owns that line and
  the solver path returns before it. Rapier computes the motor torque internally
  and this binding does not expose it, so it needs an estimate from
  `stiffness*(target−θ) − damping*ω`. **Energy accounting is not optional**; cost
  of transport depends on it.
- `L1-18` asserts a spin ratio the torque model predicts, and the solver motor
  reaches its target differently in one step. Needs the same model-agnostic
  treatment it already got for `'stress'`.

**Nothing else can be measured honestly until this lands.** Every number from
sessions 2–6 was taken through the relay.

**2. The slice cannot build a serpent.** `SLICE_LIMITS.maxRecursion` is 2, so a
self-connected chain terminates at three segments. Undulation wants a travelling
wave along many. One line, and it should be raised before anyone concludes
anything about body plans.

**3. Selection cannot see what the eye sees.** Fixed for display this session
(§4), but `cost of transport` is still not in the fitness function. Measured:
displacement-only selection improved distance 30× and left efficiency flat at
0.047. **It breeds efficient thrashers.** In the reference, distance alone
suffices because thrashing does not produce distance there; here it does.

**4. Grafting is off.** 30% of the reference's reproductions, `allowGrafting:
false` in our slice. It is the operator that moves whole limbs between lineages.

**5. Direction control does not work and should not be built.** 3% of creatures
have a monotone steering response; 0/30 closed a 6 m pursuit target; bilateral
symmetry does not fix it. Steering is **downstream of gait coherence** — a static
differential deflection can only rotate a velocity vector that already exists.
Re-measure after the actuator lands; do not engineer around it.

---

## 4. What changed in the closing session

**The displayed speed was 18× the real travel speed.**

    cruiseSpeed (mean |v|, what the screen showed)   4.382 m/s
    comSpeed    (true CoM path / dt)                 5.115 m/s
    netSpeed    (actual travel)                      0.235 m/s
    efficiency                                       0.030

And `straightness` — which already existed and already was net/path — was
**aliased**. `SAMPLE_HZ` is 20 against a 120 Hz physics step, and the centre of
mass oscillates at 12–22 Hz, straight through the 10 Hz Nyquist limit. Path
length integrated from trace samples missed the wobble entirely and reported
thrashing creatures as nearly straight.

Changed:

- `engine/l2/probe.js` — CoM path length now accumulates **every physics step**,
  stored as a new `trace.path` channel. New helpers `pathLength`, `comSpeed`,
  `netSpeed`; `straightness` reads the true path.
- `engine/l2/probes.js` — S2 exposes `comSpeed`, `netSpeed`, `efficiency`.
- `contracts/species.js` — three new S2 fields registered.
- `engine/l2/compile.js` — forwards them.
- `contracts/versions.js`, `version.json`, `trunk/version.js` — **BRIDGE_V 1 → 2**,
  because every stored record's efficiency was over-reported.
- `ui/screens/tank.js` — the selection sheet now shows **Travel**, **Body path**
  and **Efficiency** beside Speed, with a `· thrashing` marker below 0.05.
  Accumulated from CoM position every frame, not from the smoothed display
  velocity, which would flatter exactly the creatures this exposes.
- `gate/runtime.js` — **N9 amended.** It asserted `SCHEMA_OF.record !==
  SCHEMA_OF.genome`, which was an accident of where two independent counters sat,
  and went red on a bump that changed nothing about the mechanism. It now asserts
  each kind draws its version from its own source.

---

## 5. Ordered next steps

1. Finish the solver motor (§3.1) and default it.
2. Raise `maxRecursion`.
3. Put cost of transport into fitness, not just the display.
4. Enable grafting.
5. Run evolution properly — hundreds of individuals, tens of generations. The
   8-generation run converged to a single genotype by generation 7, so diversity
   maintenance comes first.
6. Re-measure steering (§3.5).
7. Sensors and an evolved controller remain the path to Sims' light-following
   demo. That is L2/L3 scope and an **absence**, not a defect.

---

## 6. One assertion worth adding

**A π/2 travelling wave must beat unison on efficiency.** Cheap, sharper than any
corpus statistic, and it would have caught the relay six sessions earlier —
through the PD every design scored identically, and that identity was itself the
evidence.

---

## 7. Tools left in `tools/`

| tool | answers |
|---|---|
| `hydro.js` + `_hydro_physics.mjs` | drag-law comparison harness |
| `_dragmicro.mjs` | is the drag law right? (ratio vs analytic) |
| `_efficiency.mjs` | efficiency + heading persistence over a corpus |
| `_reconcile.mjs` | net vs CoM-path vs body speed, sampled every step |
| `_relay.mjs` | PD saturation sweep — how the relay was found |
| `_spin.mjs` | is the spin from motors or fluid? |
| `_evolve.mjs` | does selection improve locomotion? |
| `_seed.mjs` | hand-authored serpents vs random |
| `_aim.mjs` / `_aimdesign.mjs` | steering monotonicity and closed-loop pursuit |
| `_arm.mjs`, `_torque.mjs`, `_track.mjs` | actuator characterisation |
| `_mut_dens.mjs` | crash-safe mutation testing (writes the N24 sentinel) |

---

## 8. Gotchas that cost time

- **Background jobs are SIGKILLed between steps, so `try/finally` cannot protect
  the tree.** A mutation runner left a mutant behind and the gate went red for
  reasons unrelated to the edit. Hence the sentinel and assertion **N24**.
- **Read the failure detail, not the assertion title.** "L2-1 probe determinism"
  was reported as an unexplained determinism failure for a whole session. Every
  trace comparison passed; the one failing check was `the reference creature
  compiles`.
- **Sign-change counting is not a chatter metric.** With motors off it reads
  18.3/s while the CoM does not move at all.
- **Net travel is too noisy to test a hypothesis with.** It produced the wrong
  conclusion twice; CoM path speed is the sensitive measure.
- **Anomalous numbers are the finding.** A tortuosity of 119 was measured in
  session 2, described as "a per-stroke wobble on a steady drift", and walked
  past. It was the entire answer, four sessions early.
