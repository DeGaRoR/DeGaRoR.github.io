# Vivarioops — THE PLAN

**This is the only live planning document.** If another file in this repository
tells you what to do next, it is archive and it is wrong. The document map in §9
says which is which.

| | |
|---|---|
| **Written** | 2026-08-14 |
| **Supersedes** | `design/PLAN-TO-INTELLIGENCE.md` (whole), `../ROADMAP.md` (whole), `../HANDOFF.md` (whole), `../PLAN-AFTER-B2.md` (whole), the "next, in order" list in `../HANDOVER-STEERING.md`, and `15-BREEDING.md` §10h's ordering |
| **Does not supersede** | `VIVARIUM_00`–`30` (the spec set), `13-NOMENCLATURE`, `14-VERNACULAR`, `15-BREEDING` — those remain canonical for their subjects. This document plans; they specify |
| **Verified against the tree** | gate green on the working tree 2026-08-14: **114 assertions, 106 passed, 0 failed, 8 pending, 5738 checks**. App 0.8.14, `GENOME_V` 9, `BRIDGE_V` 9, `faunaVersion` 12 |

### How this document handles numbers

Standing rule M1 says a number enters a plan only with the script that produced
it, the `n`, and a re-run. **This document did not re-run anything.** Every figure
in it is *carried* — tagged with the script and the date it was measured — and by
M1 a carried number is a memory, not a measurement. Where a decision below rests
on a carried number, it says so, and re-measuring is the first item of the phase
that spends it.

What *was* verified directly for this document: the gate result above, and the
code claims in §1.3 (each cites a file and line).

---

# 1. Where the project actually stands

## 1.1 The slice, against `VIVARIUM_00` §7

| | status |
|---|---|
| **A · Minimal trunk** | ✅ done |
| **B · Constrained Tank** | ✅ done, rebuilt twice — now the Vivarium (breeds *and* feeds) |
| **C · Tiny Trial** | ⚠️ engine done; the capability card was never built. C2 was retired as a milestone in August and partially un-retired once the duel task was re-derived from measured cruise: **4 captures in 84 champion duels against 0 in 84 random** (`_zduelchamp.mjs`, 2026-08-13) |
| **D · Tiny World** | ❌ `engine/l3/` contains `.gitkeep` and nothing else |
| **E · Return to breeding — closing the loop** | ❌ never started |
| **F · Deepen** | ✅ done extensively and out of order: Atlas, binomials, vernacular, art pass, portraits, open ocean, tissue laws, satiety, the whole breeding programme |

**The structural fact that governs everything below.** `VIVARIUM_00` §7 changed
its own governing rule to *"no subsystem becomes deep until a minimal end-to-end
loop exists"*, precisely because the untested risk was how the three loops
interact. Since then the project has spent roughly fifteen sittings deepening B
and C. D and E have never existed. **The rule the roadmap was rewritten to enforce
is the one being broken**, and the plan below does not pretend otherwise — it
accepts a deliberate deferral of the loop in exchange for perception, intelligence
and interaction, and it says at each phase what that costs.

## 1.2 The two capability questions, answered

**Seeking — good, with one asterisk.** Random founders, no authored ancestry
(rule R10), a paired null arm, re-scored on the canonical 6 × 90 s trial: a
lineage that **arrives in 6 of 6 directions** at an 8 cm beacon, closing 6.871 of
8 cm, **64.8× the null arm** (`_zbreed.mjs`, 2026-08-11, n = 2 seeds). Two runs
solved it in opposite ways — outrun it, or aim and dwell — which is what an
objective that does not prejudge strategy is supposed to produce.

> **The asterisk, and it is the whole of Phase 1:** it steers on `bearingTo`,
> which `engine/l1/controller.js:176` itself calls **the omniscient compass** —
> unlimited range, no noise, no field of view, no distance. This is a validated
> result about **control and actuation**, not about perception.

**Foraging — not yet, and honestly so.** Creatures eat by swimming into food.

- **Kinesis is measured harmful to good foragers.** Benefit against blind intake
  runs Pearson **−0.83** over eight champions: the wire helps an animal that was
  not finding food and hurts one that was, at *both* signs of the gain, because it
  modulates `effort` and a creature already sweeping water loses by throttling
  (`_zsense.mjs`, 2026-08-12).
- **Tropotaxis is the right wire.** Receptor left/right contrast → `turnBias`
  scores **+2.211 g at the better sign, 6 of 8 helped**, against kinesis's −0.344
  on the same animals — and pays 5.8× more to animals that can travel.
- **But selection has not confirmed it.** With the gene drawn rather than started
  at zero, three seeds × 20 generations give free-vs-locked deltas of −4.473,
  **+12.349**, −0.214 g. **1 of 3.** Reported unresolved, not as a win
  (`_ztaxevo.mjs`, 2026-08-13).

## 1.3 Fundamentals — verified, not carried

**Right, and these are the expensive-to-fix-later ones:**

- Determinism and seeded RNG throughout; gate assertions N1/N2/N5 hold.
- **Both invisible gods are gone.** `engine/l2/objective.js:290` defaults to
  `inheritance: 'weismann'` — the adapted gait scores the body and is discarded,
  breeding sees the birth genome. `tools/_zbreed.mjs:778` and
  `tools/_ztaxevo.mjs:188` both pass `viabilityAttempts: 1`, so mutational load is
  paid where selection is measured. `design/PLAN-TO-INTELLIGENCE.md` still calls
  this "the highest-priority item in the plan"; it was fixed on 2026-08-08 and the
  document never learned.
- Contracts with real migrations, provenance and ancestry on every specimen, the
  ark as a cross-version instrument, control-subtracted objectives with paired
  null arms, CGS units audited, `MUSCLE_STRESS` split from `MOTOR_GAIN_STRESS`,
  N21 clamping by `turnCapability` rather than yaw, the saturation counter
  repaired.
- The culture of retracting a finding **with its cause** is the most valuable
  artefact in the repository. Rules M1–M11 and R1–R10 are what it produced.

**Wrong or missing, in order of how much they distort what comes next:**

1. **Two perception systems, and the one that works has no anatomy.** The
   omniscient compass drives every success; receptors (finite 6 cm reach,
   position and outward normal from morphogenesis) drive nothing that reliably
   pays. Sense-organ morphology therefore cannot evolve for the task selection
   actually rewards.
2. **Organs are not metered.** Standing rule M4 is knowingly broken — a receptor
   costs nothing, so expression-on and expression-off are indistinguishable to
   selection, receptor count drifts up, and the cave-fish regression gate cannot
   be run. This pollutes every perception and intelligence number measured after
   it.
3. **The loop is open.** No birth, no death, no offspring count. `P4` says the
   verdict must be external; today it is a fitness function, not a world.
4. **The best result in the project is unreachable in the game.**
   `engine/l2/objective.js` ships `OBJECTIVES` = Speed / Size / Span. There is no
   goal objective and no ledger objective, so a player cannot breed for the thing
   the campaign proved breedable.
5. **Documentation entropy, including the gate's own status board.** Five
   documents claimed to be the plan — this one fixes that — and the gate's
   carried-obligations block, which `ROADMAP.md` §2 called "the reliable status
   board", still prints *"orientation is the open problem (turnRate median 0.0032
   rad/s)"* and *"LOCOMOTION IS NO LONGER THE BLOCKER; AIMING IS"*. Both are
   superseded. **Rewriting that block is the last item of Phase 0.**

---

# 2. The ordering, and the four revisions to it

The owner's ordering, adopted:

> perception → a world with uneven food and ledger-based breeding → intelligence →
> playable breeding → predator/prey and the interaction model → *then* C, fitting
> interaction models → *then* ecology, coevolution, life and death.

It is kept intact. Four things move **inside** phases, each for a measured reason:

1. **The patchy field is built as perception's instrument, not as a later world.**
   Measured signal at a receptor over a 220 s trial: shipped field **0.087**,
   `SPOTTY_FOOD` **0.360**. Phase 2's own post-mortem: *"on the shipped field there
   is almost nothing to smell."* Perception cannot be validated in the current
   world, so the field is step 1.1 and the full world with its breeding programme
   is still Phase 2.
2. **Metering comes first inside perception.** See §1.3 defect 2. This is the one
   place where a small piece of work protects two entire phases.
3. **The omniscient compass dies inside Phase 1**, not after it. Intelligence
   built on a handed-over bearing measures nothing — the argument
   `PLAN-TO-INTELLIGENCE` §3.4 already makes for deferring tropotaxis, generalised.
4. **Predation gets an energy consequence in Phase 5; birth and death stay in
   Phase 7.** A capture that yields nothing is a tag game. Energy transfer into the
   existing ledger is cheap and reuses `reserveAfter` verbatim; the population loop
   is expensive and stays where the owner put it.

---

# 3. Phase 0 · Reconciliation

**Half a sitting. In progress.**

| item | state |
|---|---|
| One live plan document | ✅ this file |
| Superseded banners on the four documents that claimed to be the plan | ✅ `ROADMAP.md`, `HANDOFF.md`, `PLAN-AFTER-B2.md`, `PLAN-TO-INTELLIGENCE.md` |
| `design/INDEX.md` updated — it claimed "design is complete, next session is A0" | ✅ |
| Rewrite the gate's carried-obligations block | ✅ reviewed suite by suite against this file. Dead entries are rewritten as `SUPERSEDED — <what they said>` and kept briefly rather than deleted, so a figure met in an older document is recognisable as dead rather than merely unfamiliar (M11). `orchestrator.js` now prints where the live list lives, and carries the two rules that review produced: **review the block when a decision lands, do not only append to it** — two obligations in the same gate had contradicted each other for several sittings — and **flag that figures quoted in m or kg predate the CGS audit** |
| Commit the working tree | ❌ **the remaining item**, and the owner's to do — ~30 files uncommitted, including a behaviour change (`tropoGain` drawn) and the new autosave |
| `CHANGELOG.md` | ❌ stops at 0.8.0 against 0.8.14. **Decide in writing**: backfill, or declare abandoned and delete. A changelog that is fourteen versions stale is worse than none |

---

# 4. The phases

Each phase states what it does, what it explicitly does not do, and a gate that
**can fail**. A gate that cannot fail is not a gate.

## Phase 1 · The Sense — perception that is earned

**Goal:** one perception system instead of two, and it is the anatomical one.

| step | content |
|---|---|
| **1.1 The rig** | The patchy field becomes a world parameter rather than a tool flag: contrast 4.0, floor 0.10. The floor is derived, not chosen — below ~0.10 the creature spawns outside every patch and the outcome is decided by where it landed (`makeFood` records this) |
| **1.2 The bill** | Receptors gain **mass and drag**. They are inert anatomy today. This is M4's metering, and it needs **no invented coefficient** — the cost is the physics, which is what M5 demands. ⚠️ It breaks bit-identical insertion (M4's other half); take the trade explicitly, as the `tropoGain` draw already did, and record it |
| **1.3 The range sense** | Nothing in this project has one. `brakeGain` reads \|bearing\| *because* of that, and the interception residual — approach, overshoot, orbit — is a range problem. It is also a required Phase 3 input |
| **1.4 The compass dies** | `bearingTo` → a bearing derived from the receptor array with finite reach. `senseOpponent` gets the same treatment; it has **no range test at all** today despite `bearingTo`'s doc claiming one |
| **1.5 Settle tropotaxis** | Re-run free-vs-locked at **≥8 seeds** in the patchy field, gains drawn, `viabilityAttempts: 1`, common random numbers with the arm out of the key (R6) |

**Gate — and it is the one that decides whether perception is good.** The campaign
champions are re-scored on the canonical 6 × 90 s trial with the bearing **earned**
instead of handed over, blind arm subtracted. **Declare the retained fraction of
closure before running it.** A collapse is not a failed phase; it is the phase's
finding, and it is one the project has never been able to learn.

**Does not do:** occlusion, noise, latency, multi-channel senses, tropotaxis
refinement beyond settling the sign question.

**Watch for:** receptor `side` is assigned from the *body* a site sits on, not from
where on the body it sits — a creature with one site has no differential at all.
That is a live structural limit on 1.4 and 1.5.

**Cost:** 2–3 sittings. 1.4 carries the risk.

---

## Phase 2 · The Programme — a world where the ledger decides

**Goal:** a second real world, `worldId`-keyed so the Atlas is untouched, with
unevenly distributed food; and lineages bred on the energy economy rather than on
a kinematic task.

**Three things are already known and must not be re-learned:**

- **The ledger asks two different questions and they crown different animals.**
  Absolute `balance` runs Pearson **+0.50** with mass and crowns a 37 g animal with
  the worst net energy per gram; `balance / mass` runs **−0.86** and crowns a 0.30 g
  filament (n = 24 survivors). The objective must declare which question it is
  answering, **in the constant**.
- **Never select on the ledger ratio.** It is a margin, won by not spending, and
  the cheapest way not to spend is not to move. The corpus drifter has the best
  margin (70×) and nets the least energy of anything measured.
- **It needs its own gait adapter.** `adaptGait` hill-climbs *net speed*, so
  handing it a forage burst tunes each body for travel and then scores it on
  eating. Owed since the forage work; now due.

Also here, because it is free: the **`habitatBounds` / `tankBounds` split**. An
unhashed habitat field costs zero record invalidation and turns "the aquarium is
too small" from a session into a number anyone can change.

Trial hygiene is not optional: ≥200 s trials (below that, intake correlates with
mass and not with swimming), `integrity()` checked so a creature that comes apart
cannot report fiction (R3), a blind arm on identical geometry (R2), absolute units
(R4), and `FOOD_ENERGY` recalibrated because the harvest model moved (M8).

**Gate:** a ledger-bred lineage beats a paired null arm over ≥3 seeds **and** beats
a *speed-selected* lineage on the ledger. The second clause is the one that
matters — without it you cannot tell an energy economy from a re-run of the speed
objective.

**Does not do:** land, air, the density unpin — that is Track W and it is deferred
(§5).

**Cost:** 3–4 sittings, dominated by run time. Reference: the validated beacon run
was 41 minutes at 20 generations × population 12 × 40 s trials; ledger trials are
300 s.

---

## Phase 3 · The Brain — sufficient intelligence

**Order inside the phase: inputs, then outputs, then topology.** Intelligence lives
in what a creature can sense and do, not in the layers between; topology search on
a narrow map has nowhere to go.

1. **Pay the rename once.** `preyGain` / `threatGain` are duel vocabulary on what
   is now the generic sensory layer. Key gains by channel id —
   `controller.sensorGains: { food, obstacle, kin }` — following the `jointGenes`
   precedent, which is keyed by `nodeId` because *"a positional array would
   silently rebind"*. Cost: 6 engine files and ~29 under `tools/`. It only ever
   gets more expensive.
2. **Break the neutral ridge.** Both channels are fed the same bearing today, so
   the phenotype sees `(preyGain + threatGain) × bearing` — two genes that are
   mathematically one. Free, and it makes the controller genuinely 2-input for the
   first time.
3. **Widen inputs** to 6–10: receptor concentration, left/right contrast, earned
   bearing, earned range, satiety, own speed, joint load.
4. **Widen outputs** — `turnBias` is the only one today. Add `effort` and beat
   frequency.
5. **Then** NEAT-style complexification, with three non-optional costs:
   **innovation numbers** (so crossover survives differing topologies),
   **speciation** (without it new structure is culled before it can be tuned), and
   **per-node metabolic cost** (without it networks bloat). Prefer **recurrence
   over depth**: depth adds nonlinearity, a self-connection adds *state*.

> **The caution from this project's own history.** Exactly one gene has ever
> carried a behavioural result here — the sensor gain — and it only moved once
> something selected on it. **Capacity without pressure does nothing.** Every new
> channel needs a mutation operator, a test that it fires (M3), and a task that
> rewards it.

**Gate:** bit-identical at neutral weights, or the migration is not a migration.
|r| > 0.5 between satiety and effort. **Failure signature:** hidden-node count
drifting to zero means speciation is missing.

**Expect modest quantitative gains.** The literature is honest that
complexification improves scores and rarely produces categorically new behaviour.
Qualitative jumps come from new sensors, new selective regimes and coevolution —
Phases 1, 2 and 5.

**Cost:** 4–6 sittings. The largest phase before ecology.

---

## Phase 4 · The Bench — breeding that is playable

The campaign method exists and works; **none of it is in the game.**

> **Confront the wall-clock first, because it constrains the design.** A burst
> already costs ~13 s against `VIVARIUM_30`'s 5.7 s budget, and a real programme
> run is 40+ minutes. Two honest architectures: a **background worker** with a
> progress affordance and a come-back-later contract; or surfacing the tools' own
> **cheap-trial-ranks / canonical-trial-reports** split (R9) as a game mechanic —
> shortlist, then trial. Pick deliberately.

Then: ship `goal` and `ledger` objectives with real `trusted` flags. Make the three
isolated lines, the stall detector and the outcross-from-the-Atlas into visible
mechanics rather than tool internals. Ratchet the task with the population (R4).
Show `dwell` — it is measured, unused, and it ranks a different animal than closure
does.

**And sign B3 and B4's human checkpoints here.** They have been open since before
the screen existed; this is the phase where a person is finally looking at the
right screen. `VIVARIUM_30` §4's stop conditions are worth rereading first, so the
judgement is made against them rather than against hope.

**Gate:** a player, in one sitting, breeds an animal that measurably beats its
founders on a declared objective — and can say why it won.

**Cost:** 3–4 sittings.

---

## Phase 5 · The Chase — predator and prey

**Prerequisites, all met or scheduled:** shared unbounded arena (exists), duel
window derived from measured cruise (done — `duelDuration` 15 → 90 s, and
`duelSetup` now returns `unreachable` rather than playing an impossible task out as
a stalemate), creature–creature perception (Phase 1.4).

- **No declared categories** (`VIVARIUM_00` P2). No predator flag. Capture is
  contact, and a creature is prey to whoever can catch it.
- **The interaction model is an energy transfer.** A capture moves biomass into
  the winner's reserve and out of the loser's. That is what makes predation an
  economy instead of a tag game, and it reuses `ledger` and `reserveAfter`
  verbatim — no new machinery, no new coefficient.
- **Coevolution needs an ancestor benchmark or it measures nothing.** Score each
  generation against **frozen opponents from earlier generations**, not against the
  contemporary one; otherwise Red Queen drift and real progress are
  indistinguishable. The ark already keeps every animal, so this is free (R8).

**Gate:** two curves that can fail to appear — pursuer closure rising *and* evader
escape rising, both against the frozen ancestor set, ≥3 seeds.

**Does not do:** birth, death, population dynamics.

**Cost:** 4–5 sittings.

---

## Phase 6 · The Card — fitting the interaction model

C, finished properly: the matchup matrix, the capability card and tap-to-replay
(deliberately never built, because three all-zero rows would have shown the player
nothing — that is no longer the situation), and non-transitivity asserted rather
than reported once the fauna is large enough for the claim to have teeth.

**And the honest part: bridge validation.** `VIVARIUM_00` P3 already warns that
using probes to predict ecosystem behaviour **is a model** — a pairwise win rate
does not become context-free by having come from physics; it was measured in one
arena, at one separation, with one starting orientation, with no third party
present. Transfer error between L2 and L3 must be measured, not assumed away.

This phase is also what makes Phase 7 affordable: a compiled `Species` record is
what lets the ecology run 2D point agents with no physics at all.

**Cost:** 2–3 sittings.

---

## Phase 7 · The World — ecology, coevolution, life and death

**The owner's reading is right, including the last line:** the missing quantity is
**number of offspring**, and it is ecology's to define. Two additions:

- You are also missing a **lifetime** and a **death** — and the contracts pre-wired
  both. `VIVARIUM_03` §3 already specifies `massMin = MASS_MIN_RATIO × massBase`
  → death and `massReproduce = MASS_REPRO_RATIO × massBase` → split; both ratios
  (0.5, 2.0) sit in the world fixture; `reserveAfter` already computes the reserve
  and `satiety` is already normalised 0–1 between the two. **More of this phase is
  built than it looks.**
- **On the cost worry:** L3 is 2D point agents with **no physics**, precisely so the
  population loop is cheap. The expensive part is the L2 probe battery that compiles
  each species — and that is once per species, not once per timestep. Phase 6 buys
  it.

**Three prior results to reckon with before any auto-selection is scheduled:**
+5% over 60 generations with *"short bursts work and long ones do not"*;
convergence to a single animal in ~5 generations; and *"more strangers makes it
worse"*, which rules out the obvious fix for the second.

**Report every generation how many creatures reach `intake / spend > 1`.** Rank
selection keeps a population alive even when every member is starving, so it will
breed a lineage of failures and show a rising curve regardless. That one number
says whether the world is survivable at all.

**Score solo, not in a shared tank**, wherever a small effect is being measured —
six creatures on one depleting field makes fitness frequency-dependent and adds
variance exactly where it hurts. The Vivarium screen is a shared field and is
deliberately showing something other than what selection measures; keep saying so.

**Cost:** unknown, and larger than anything above. Do not schedule it until Phase 6
has landed.

---

# 5. Deferred deliberately

| | why |
|---|---|
| **Track W — land, air, the density unpin** | The best variety lever in the project and a genuine second niche, but it breaks the fluid model's damping (drag and added mass drop ~800× in air), inverts viability (inertness is 25% of rejections; on land standing still is the *first* achievement), and needs a stance phase the CPG cannot express — a sinusoid has no stance. **It is its own project.** Prerequisite if ever taken: rebuild the tear-apart repro, since `_myria2.json` no longer reproduces it |
| **Baldwinian learning and genetic assimilation** | Needs a lifetime and a death to be measurable, so it belongs after Phase 7. Its hard prerequisite is already discharged — inheritance defaults to Weismann and the viability re-rolls are off where selection is measured |
| **Strouhal** | The corpus beats at ~2–3 against an efficient band of 0.2–0.4 — 5–8× off, real and unflattering. Slip is in band (0.594). Not on the critical path for anything above |
| **`SLICE_LIMITS.density` unpin** | Belongs with Track W's W3 as one change, not two. Derived density from the tissue mix depends on it |
| **Rotational symmetry, moulting, a full GRN genome** | See §8 — killed with reasons, do not resurface |

---

# 6. Live debts

Deduplicated from `ROADMAP.md` §6 and the handovers; discharged items removed.
**This list and the gate's obligations block must agree** — Phase 0's last item.

**Blocking a phase above:**

- Perception is not causally coupled to anatomy (Phase 1.4).
- Organs are not metered; M4 is knowingly broken (Phase 1.2).
- The two sensor genes are non-identifiable — one bearing feeds both (Phase 3.2).
- Receptor `side` comes from the body, not from position on the body (Phase 1).
- No forage-specific gait adapter (Phase 2).
- Neither forage economy is size-neutral, and they bracket it (Phase 2).
- `OBJECTIVES` cannot express the two capabilities the project has bred (Phase 4).
- A burst costs ~13 s against a 5.7 s design budget (Phase 4).
- B3 and B4's human checkpoints unsigned (Phase 4).

**Live but unscheduled:**

- `turnCapability` needs *replacing*, not repairing, if anything is to clamp by it.
- The `bestBias` steering-plane question, at n ≥ 15. Moving the plane is a
  different experiment, not a better measurement — `_zgoal` places its targets in
  that plane as well as sensing through it.
- Viability pre-selects motile life: the inertness check is 25% of all rejections.
  Harmless in water, inverts on land.
- `FOOD_ENERGY` is calibrated, not derived, and has moved three times (M8).
- `_myria2.json` no longer reproduces the tear-apart, so added mass's stability
  benefit is unproven.
- `DESIGN-PHASE-B2` and the C0–C6 plan are cited by ~40 gate comments and **do not
  exist in this repository**. Either recover them or accept that those comments
  point nowhere.
- `CHANGELOG.md` is fourteen versions stale (Phase 0).

---

# 7. Standing rules

Two sets, deliberately kept separate because both are cited by number elsewhere in
the tree.

## 7.1 Method rules M1–M11

*Renamed from the unprefixed "standing rules 1–11" of `PLAN-TO-INTELLIGENCE.md`;
the numbering is unchanged, so "standing rule 4" in any older comment is M4.*

1. **M1** — A number enters a plan only with the script that produced it, the `n`,
   and a re-run. A number that has not been reproduced is a memory.
2. **M2** — Do not add realism where it does not create a new evolutionary
   trade-off.
3. **M3** — Every new gene needs a mutation operator **and a test that it fires**.
4. **M4** — Every organ: neutral at insertion, **metered on expression**. Without a
   cost, expression-off and expression-on are indistinguishable and everything
   drifts to on.
5. **M5** — Every coefficient cites a measurable biological quantity **in the
   constant itself**. No source → it is a parameter → it does not belong.
6. **M6** — Costs, not filters. Rejection collapses the acceptance rate.
7. **M7** — Units are load-bearing. This is CGS. A stale unit comment becomes a
   wrong constant six months later, and has already misled three analyses.
8. **M8** — Recalibrate `FOOD_ENERGY` whenever `forageStep`, trial length,
   metabolic cost or body mass changes, and say so in the constant.
9. **M9** — Freeze each phase's population to the Atlas before starting the next.
10. **M10** — Authoring a phenotype and shipping it as an outcome is cheating;
    authoring the space and the pressures is the job.
11. **M11** — A retired finding can un-retire. **A knob that delays a failure has
    not explained it.**

## 7.2 Selection rules R1–R10

**Canonical in `15-BREEDING.md` §8** — listed here as one-liners only, and that
file wins on any disagreement.

R1 score the outcome, never a kinematic proxy · R2 every objective control-subtracted
against an information-ablated arm · R3 every objective has a cheat detector, and a
cheat scores −∞ · R4 one exam per generation, in absolute units · R5 measure `b`
before selecting on a new trait · R6 both arms share the random stream and the arm
name is never in the key · R7 one zygote per reproductive event where selection is
measured · R8 keep the animals, not the scores · R9 the cheap trial ranks, the
canonical trial reports · R9b check `origin.generations` before crediting a result
to selection · R10 no authored stock in a discovery claim.

---

# 8. Withdrawn — do not resurface

Carried from `PLAN-TO-INTELLIGENCE.md`, which killed each of these with a
measurement. The reasons are compressed here; that file holds the full account.

| Proposal | Killed by |
|---|---|
| `plan.bodies[].depth` is a bug | It is per node type by design; the phase gradient deliberately does not read it. "Fixing" it would break a working field |
| `MUSCLE_STRESS → 2e6` is a labelling correction with zero behavioural change | The A4 sweep: `workOut` 2.5e3 → 5.2e7, L1-18/N19 and L2-19 red. Superseded by the ceiling/gain split, which is a different change and shipped |
| Make bilateral symmetry the default prior | 100% of viable creatures already carry ≥1 reflected connection |
| Add a penetration term so parts can be skinned | 997/997 parent–child OBB pairs already overlap |
| Creatures are star topologies, hence clumps | depth p50 2, max 8; root branching p50 2 |
| "Rung 0: gravity → 981" | Already done and verified inert. The open item is the density unpin, which is Track W |
| Semi-implicit drag correction | coast ratio 0.622 → 0.623, a no-op |
| Raise `SOLVER_ITERATIONS` | 8 → 128, no trend |
| Constrained morphology priors to mimic observed shapes | cosmetic; replaced by the tissue laws |
| Full GRN / morphogen-diffusion genome | A rewrite of all of L1 except physics and controller; kills the taxonomy and the inspectability. Vivarioops 2, not a migration |
| Growth by moulting | Delivered by satiety with no joint destroy/recreate and no rename-mid-life problem |
| A rotational `repeatCount` gene | Odd-order symmetry is genuinely unreachable, but variety is a niche problem first |
| Select on turn rate, or on the reachability envelope | Turn capability quadrupled and reachability never moved — it breeds creatures that spin brilliantly in place. The envelope agrees with arriving 62% of the time, one-directionally, and is a **necessary condition only** |
| Any kinematic steering proxy | `turnCapability` −0.152, `turnRate3d` −0.309, `steeringAuthority` 0.005 against actually arriving (R1) |

---

# 9. Document map

**Live — plan from these.**

| file | authority |
|---|---|
| `design/PLAN.md` | **this file.** What happens next, and why |
| `design/VIVARIUM_00`–`30` | the spec set. Principles, architecture, contracts, layers, trunk, UI. `03` is law for schemas |
| `design/13-NOMENCLATURE.md`, `14-VERNACULAR.md` | naming, canonical |
| `design/15-BREEDING.md` | the breeding method, canonical. §8's R1–R10 and §7's open questions are live. **Its §10h ordering is superseded by this file** |
| `HYDRODYNAMICS.md` | the fluid model, as reference for what it is and is not |

**Archive — read for history, never for instructions.** Each now carries a
superseded banner: `ROADMAP.md`, `HANDOFF.md`, `PLAN-AFTER-B2.md`,
`design/PLAN-TO-INTELLIGENCE.md`.

**Session records — evidence, not instructions.** `HANDOVER-ATLAS-EVOLUTION.md`,
`HANDOVER-B2.md`, `HANDOVER-FORAGE.md`, `HANDOVER-LOCOMOTION.md`,
`HANDOVER-SESSION10.md`, `HANDOVER-STEERING.md`, `SESSION-10.md`,
`NEXT-CREATURE-VARIETY.md`, `planLocomotion/`. They hold measurements this file
cites and should not be deleted; their "next steps" sections are all superseded.

**And one rule about this file.** When a phase lands, its gate result goes in
here — pass or fail, with the script and the `n`. A plan that only records
successes is a memory too.
