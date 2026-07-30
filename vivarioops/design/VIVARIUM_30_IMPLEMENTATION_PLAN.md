# VIVARIUM — 30 · Implementation Plan

Per-session plan for the vertical slice. One session = one conversation message that
delivers working code and ends with a green gate.

| | |
|---|---|
| **Status** | Normative |
| **Reads** | 00 Vision R2 · 01 Architecture · 02 Worlds R2 · **03 Contracts** · 10 L1 · 11 L2 · 12 L3 · 20 Trunk · 21 UI |
| **Revision R3** | A0 added · S3 Turning moved into C1 · grafting removed from B4 · Conditions screen removed from the slice · Atlas UI removed from the slice · §1 process rule corrected · C2 exploit guards added |
| **Scope** | Slice steps A–E. Step F is not planned per-session until the slice is proven. |

---

## 1. Working method

Carried from PTIS and ROBOCLASH, where it worked.

1. **Read the actual code before editing it.** Never implement from a spec alone when the file exists. Flag any discrepancy between spec and code before writing.
2. **One session owns one deliverable, including its tests and debugging, until its gate is green.** A difficult deliverable may span several sessions. **No checkpoint or versioned package is declared complete while its gate is red.**

   *(R3 correction: the previous rules — "implementation and testing are separate sessions" and "green gate before any zip" every session — were incompatible as written. This replaces both.)*
3. **Show code that changed behaviour.** Not every diff — enough to review the decision. Ask when the spec is ambiguous; do not guess.
4. **Every session ends with:** files changed, gate result, `APP_V`, changelog entry, and the checkpoint answer.

**Session inputs.** Each session expects the current codebase attached plus the relevant
spec. Do not implement without reading the actual code first.

---

## 2. Session ledger

Estimates are for a session working from these documents. They are honest, not
optimistic — the review was right that Phase 1 is the hardest package in the project.

| # | Session | Delivers | Gate after | Risk |
|---|---|---|---|---|
| **A0** | Reconciliation | contracts as code, W1_SLICE fixture, pinned deps, reference commits | 8 | low |
| **A1** | Skeleton | repo, build, version.json, rng, store, nav, dev panel, gate runner | 8 | low |
| **B1** | Genome | schema, serialisation, constrained random factory | 14 | low |
| **B2** | Morphogenesis | body plan, static render, randomise | 22 | **high** |
| **B3** | Motion | Rapier, drag/buoyancy, CPG, phase propagation | 28 | **high** |
| **B4** | Breeding | mutation, crossover, viability, tank UI, stranger slot | 36 | medium |
| **B5** | First light | timeboxed art pass | 36 | low |
| **C1** | Sensors + probes | bearing sensors, gains, probe harness, 2 probes | 42 | medium |
| **C2** | Duels | duel probe, 3 residents, capability card, replay | 48 | medium |
| **D1** | Ecology core | SoA, spatial hash, steering, metabolism, lifecycle | 56 | medium |
| **D2** | Verdict | introduction, run, verdict, causal readout | 60 | medium |
| **E1** | The loop | verdict → breeding return, lineage continuity | 62 | low |

Twelve sessions to a closed loop. Sessions B2 and B3 carry most of the risk and may each
need a debugging session after them; budget fourteen.

---

## 3. Step A — reconciliation and trunk

### A0 · Contracts as code

**Goal.** Remove every decision an implementer would otherwise have to make silently.

**Deliver**
- `/contracts/species.js` · `/contracts/world.js` · `/contracts/matchup.js` — 03 §1–4 as executable schema with validators
- `/worlds/w1_slice.js` — 03 §5 verbatim, every constant present
- `package.json` with **exact** pinned versions and a committed lockfile; replace 03 §6 placeholders with what actually resolved
- Record reference-repo commit SHAs in 03 §6
- Determine whether the Rapier JS build exposes `enhanced-determinism`; record the answer
- `gate/contracts.js` — K1–K8 (03 §7); K1, K2, K5, K6 pass now, the rest activate as producers land

**Checkpoint.** No schema is defined in more than one place. `grep -r "massReproduce"`
returns the contract file and its consumers, never a second definition.

### A1 · Skeleton

**Goal.** An empty app that boots, navigates, persists, and runs a gate.

**Deliver**
- Repo layout per 01 §3, `/engine/` empty but present
- `tools/build.js` → generates `version.json`, injects into `trunk/version.js`
- `trunk/rng.js` — seeded PCG; the only PRNG construction site
- `trunk/store.js` — IndexedDB adapter, migration registry, `1→2` no-op written now
- `trunk/nav.js` — screen stack, `pushState`/`popstate`, tab roots
- Dev panel: run gate, seed override, version readout
- `gate/trunk.js` — N1, N2, N3, N5, N8, N14, N16 + version consistency

**Gate: 8 assertions.** They pass trivially on an empty `/engine/`; that is the point —
the checks exist before there is anything to violate them.

**Checkpoint.** Four empty screens, back button works on Android, a value survives
reload, gate runs green from the dev panel.

**Stop if** the back button needs special-casing per screen. That means the stack is
wrong and it will not get better.

---

## 4. Step B — constrained Tank

### B1 · Genome

**Goal.** A genome exists, round-trips, and randomises into connected graphs.

**Deliver**
- `engine/l1/genome.js` per 10 §A5 — full schema, no restrictions. **`GENOME_V = 2` from the start**, including `preyGain` and `threatGain`, present and dormant (R3: they were previously introduced by a migration at C1, contradicting 10 §8)
- `engine/l1/factory.js` — random genome per 10 §A17.1, **slice-constrained** (10 §3): ≤ 8 nodes, recursion ≤ 2, ≤ 3 connections per node
- Serialise / deserialise, `genomeHash`
- Migration registry exercised with a **real** `1 → 2` migration (adds both gains at 0), not a no-op
- `gate/l1.js` — determinism, round-trip byte identity, connectivity of 500 random genomes, caps respected

**Gate: 14.**

**Checkpoint.** 500 random genomes, all connected, all within caps, all round-trip clean.

**Note.** The schema is full; only the factory is constrained. Loosening at step F is a
config change, never a migration.

### B2 · Morphogenesis — **the first hard session**

**Goal.** A genome becomes a body you can look at.

**Deliver**
- `engine/l1/morphogen.js` per 10 §A6 — recursion semantics, reflection variants, face-anchored placement, cumulative scale, **parity**
- `render/creature.js` — capsules and ellipsoids over box proxies, flat shading
- Tank screen with a Randomise button
- Gate: N6, parity (N20), caps, cross-sectional area computation

**Gate: 22.**

**Checkpoint — this is a hard gate.** Tapping Randomise produces a visibly different,
*plausible* body every time. Not broken, not degenerate, not a pile of overlapping boxes.

**Stop if** bodies look wrong here. Everything downstream is judged through this, and no
amount of physics or shading rescues a bad morphogenesis.

**Expected difficulty.** Face-anchored placement, mirror parity, and cumulative scale
are the three places this goes wrong. `mycoolfin/the-simsulator` (MIT) has all three
working — read `LimbCreator.cs` rather than re-deriving. Roughly 150 lines of it are the
algorithm; the rest is object pooling.

### B3 · Motion — **the second hard session**

**Goal.** It swims, and it looks alive rather than convulsive.

**Deliver**
- `engine/l1/physics.js` — Rapier, fixed 1/120, drag, buoyancy per 02 W1
- `engine/l1/controller.js` — CPG per 10 §A7, **phase propagation down the body tree**
- Motor torque scaling by cross-sectional area (N19)
- Gate: determinism of 600 steps, N19, N22

**Gate: 28.**

**Checkpoint.** Creatures move, and at least some undulate rather than twitch. This is
the moment the generator concept is validated or not.

**The one detail that decides this.** Child joint phase = parent joint phase +
`phaseLag`. Independent per-joint phases produce noise; propagated phase produces
travelling waves — eels, rays, centipedes. Do not shortcut it.

**Stop if** motion is uniformly spastic after tuning `phaseLag` ranges. Fall back to
velocity motors (11 §7 note) before concluding the approach is wrong.

### B4 · Breeding

**Goal.** The toy loop, playable.

**Deliver**
- `engine/l1/mutate.js` per 10 §A9 — one mutation per call from a weighted tree
- **No grafting and no crossover in the slice** (R3). 10 §3 sets `allowGrafting: false`; scheduling it here was a contradiction. Offspring are mutated descendants of selected elites. Recombination returns at step F.
- Viability filter with repel-then-discard
- Tank UI per 21: tap-select, Pause, Breed, generation counter, undo. **No Conditions screen** (R3 — see §9)
- **Stranger slot (N17)** and **elites unchanged (N18)**
- Mutation viability rate reported in the gate diagnostics

**Gate: 36.** Plus the viability-rate diagnostic (target ≥ 60%).

**Checkpoint.** Six creatures, select, breed, repeat — and it holds attention for twenty
minutes. Offspring visibly resemble parents.

### B5 · First light

**Goal.** Judge the bet on a fair test.

**Deliver.** One session, timeboxed: dark water, key light, god rays, translucency, rim,
one fbm pattern with genetic parameters, particulate, mild DoF.

**Checkpoint.** Would you show someone a screenshot?

**Why here and not at the end.** The thesis is that a generated specimen is nearly a game
in itself. Testing that on flat-shaded capsules tests a different proposition.

---

## 5. Step C — tiny Trial

### C1 · Sensors and probes

**Goal.** Creatures can steer toward things, and probes can measure them.

**Deliver**
- **L1 amendment (11 §10):** `preyBearing` / `threatBearing` sensors, `preyGain` / `threatGain` genes, one line into the turn-bias mechanism. `GENOME_V` → 2, migration written.
- `engine/l2/probe.js` — the Probe interface, trace buffers, seed derivation
- **Three probes** (R3): **S1 morphometrics** (free) · **S2 locomotion** at three efforts with the `power = c₀v + c₁v³` fit, yielding `burstDuration` · **S3 turning**, yielding `turnRate`
- Gate: probe determinism, monotonicity of speed vs effort, K1 field coverage

**S3 is not optional.** D1 clamps all steering by measured `turnRate` and N21 makes that a
non-negotiable — it is the primary carrier of physical identity into L3. Omitting it, as
R2 did, left D1 with no value to clamp against.

**Gate: 43.**

**Checkpoint.** A creature has a measured cruise speed, burst ratio, cost of transport
and turn rate, reproducible twice.

**Deferred:** S4 pursuit and S5 evasion. The slice sets `pursuitGain = 0.6`,
`evasionGain = 0.6` as **explicit fixture defaults** in `w1_slice.js`, flagged in the
developer panel as unmeasured.

### C2 · Duels

**Goal.** An external verdict exists.

**Deliver**
- Three frozen residents, bred in the tank during this session and hard-coded for now
- `engine/l2/duel.js` — capture = contact with the opponent's **root body**; 15 s cap; 3 repeats
- **Canonical pair seeding** per 03 §2 — sorted hashes, so A-vs-B and B-vs-A are the same fights read from opposite ends
- Reduction to a symmetric **`PairMatchup`** (03 §2), recording *both* directions. Recording only the subject's side made the resident→player column unreconstructible.
- Fauna loader assembling the dense `Species.vs` from pair records
- **Exploit guards (10 §7), all three:** root-body capture · contact impulses above a plausibility threshold ignored · any duel decided in under 0.5 s flagged for review rather than recorded
- Capability card UI + tap-to-replay from seed
- Gate: K3, K4, determinism

**Gate: 49.**

**Checkpoint.** You compile a creature, watch three fights, and can say what it is good
and bad at.

---

## 6. Step D — tiny World

### D1 · Ecology core

**Goal.** A population lives, moves, eats, breeds and dies, conserving mass.

**Deliver** per 12: SoA typed arrays · counting-sort spatial hash · Reynolds steering with
**turn-rate clamp (N21)** · metabolism · substrate with fertility-biased diffusion ·
threshold reproduction by mass splitting · death returning mass.

**Slice restriction (00 R2 §5):** social parameters affect **spacing, cohesion, pursuit,
avoidance only.** No pack tactics.

- **Engagement-based capture** per 03 §4 — engagement opens at `4 × (reachA + reachB)`, exponential hazard calibrated so `P(capture within timeToCapture) = pCapture`. Not a per-contact roll: `pCapture` was measured as an engagement outcome starting several body lengths apart, and applying it at contact would be a different event.
- All constants from `w1_slice.js`; none hard-coded
- Gate: N12 mass conservation, N7 determinism, trophic pyramid, N21, K7 hazard calibration, K8

**Gate: 58.**

**Checkpoint.** Run residents alone for 5 000 ticks: populations oscillate, prey leads
predator, total mass drift is zero.

**Stop if** it flatlines. Adjust `noiseContrast` and `totalMass` before touching physics.

### D2 · Verdict

**Goal.** The world judges.

**Deliver**
- Introduction with `biomassBudget`
- Run to `runDuration`, population series recorded
- Three outcomes for the slice: **fails to establish · coexists · destabilises**
- Causal readout tied to a measured capability — one sentence, generated from the series and the record
- Simple population graph

**Gate: 62.**

**Checkpoint.** Introduce, watch, get a verdict you did not predict but can explain.

**Gate discipline (00 R2 §11).** Ask yourself why it happened *before* reading the
readout. If the readout is the only source of understanding, it is manufacturing
comprehension rather than reporting it.

---

## 7. Step E — close the loop

### E1 · The return

**Goal.** The verdict sends you back to breed with an intention.

**Deliver**
- Post-verdict screen: what happened · which measured trait was implicated · which lineage produced it
- One tap back to that lineage in the tank, ready to breed
- Lineage continuity across compile and run

**Gate: 64.**

**Checkpoint — the whole slice hangs on this.** After a verdict, do you go back with a
specific intention — *"too slow, I need a faster one"* — rather than a vague one?

**If yes, the game exists.** Proceed to F and deepen.
**If no, do not deepen anything.** The problem is in the relationship between the layers,
and building more of each layer will not fix it. That is precisely what the slice was for.

---

## 8. Decision points

Where the plan branches, so these are decided rather than drifted into.

| After | Question | If no |
|---|---|---|
| B2 | Are the bodies plausible? | Constrain the grammar further before proceeding |
| B3 | Does it look alive? | Try velocity motors; then reconsider CPG |
| B4 | Does the toy hold twenty minutes? | The generator thesis is in doubt; do B5 before judging |
| B5 | Is it beautiful? | Iterate here; this is the one place worth open-ended time |
| C2 | Does the trial change what you breed? | Trials are decoration; rethink scoring before D |
| D2 | Surprising *and* explicable? | Tune `noiseContrast`, `perceptionRadius`, mass scaling |
| E1 | Do you return with an intention? | **Stop and rethink the relationship, not the layers** |

---

## 9. Removed from the slice at R3

**Conditions screen.** The slice runs one fixed world. Editing medium density or drag
invalidates every compiled record; editing tank bounds changes probe outcomes; fertility
contrast has no meaning in L1, which has no substrate or feeding; and live edits create
world variants with no `worldHash` or resident matrix. Returns after E1, together with
explicit recompilation behaviour.

**Atlas UI.** 00 R2 §7 and this plan defer it to step F; 21 had it partly in the slice.
The plan wins. Specimens and records are **stored correctly from B1** and derived naming
is written at B4, but there is no Atlas tab functionality, no Describe flow and no
thumbnail pipeline before E1. An empty "not yet available" tab satisfies the navigation
skeleton.

---

## 10. Deferred to step F

Full probe battery · matchup matrix beyond three residents · Atlas UI · binomial naming
UI (the function is written at B4, the screen comes later) · fauna authoring · worlds
W2–W4 · share cards · export/import UI · profiles · i18n dictionaries · PWA and service
worker · unrestricted morphology · grafting in the random factory · cross-device
determinism.

---

## 11. What is true after twelve sessions

A single aquatic world. Constrained bodies that swim and are worth looking at. Breeding
by taste with a guaranteed stranger. Two probes and three duels producing a measured
identity. A small ecosystem that oscillates and judges. A return path that closes the
loop.

Not a finished game. **The proof that there is one.**
