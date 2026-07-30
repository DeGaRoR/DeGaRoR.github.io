# VIVARIUM — 00 · Vision & Design

**Document 00 of the Vivarium design set.** Foundational. Everything else refines this.

| | |
|---|---|
| **Status** | Authoritative for principle, scope, and roadmap |
| **Supersedes** | Nothing |
| **Revision R2** | Incorporates external design review. Changes: P1 and P3 restated · §5 collective-behaviour claim corrected · §6 Atlas becomes the authoring mechanism · §7 roadmap replaced by a vertical slice · §9 two risks corrected, two added · §11 generator gate strengthened. |
| **Superseded by** | Nothing |
| **Downstream** | 01 Architecture · 10 L1 · 11 L2 · 12 L3 · 20 Trunk · 21 UI · 30 Plan |

---

## 1. What this is

A phone game in which the player breeds procedurally generated creatures, tests them
against the inhabitants of a hostile world, and finds out whether their creature can
survive there.

Nothing about a creature is authored. Its body, its motion, its name, its capabilities
and its fate are all generated or measured. The player never designs a creature
directly — they shape the conditions under which creatures are produced, and choose
which ones reproduce.

The working title is Vivarium. It is a placeholder.

---

## 2. The thesis

Three claims, in order of how much rests on them.

**A generated specimen is nearly a game in itself.** If a procedural system produces
bodies worth looking at, and mutation produces recognisable variation on them, then
swiping through generations is already engaging before any objective exists. This is the
first bet and the prototype exists to settle it.

**A simulator does not tell you what to do.** A sandbox with no verdict is a tool, and
tools are consumed once. The system must render a judgment the player did not author,
or the player has nothing to be right or wrong about.

**Surprise requires an author who is not you.** Content the designer wrote is spoiled for
the designer. Content the designer *generated* is not. Everything in this game that
constitutes challenge — the creature's real capabilities, the outcome of a fight, the
behaviour of an ecosystem — is measured or emergent, never written.

---

## 3. Design principles

These are the constraints every downstream decision must satisfy. They were derived, not
assumed, and where one is violated the design has drifted.

**P1 · Author rules, constraints and presentation. Never author repeatable instances.**

Generation does not abolish authorship — it relocates it, into body grammars, mutation
distributions, world constants, probe definitions, social rules, survival thresholds,
and the curation of what gets kept. All of that is design work and should be done
deliberately and well.

What is forbidden is the *content backlog*: hand-drawn creatures, written species
descriptions, hand-balanced opponents, an authored difficulty ladder. Those are the
failure mode that kills projects of this shape.

Stated as "nothing is authored", this principle would eventually talk us out of a good
design intervention on ideological grounds. Stated correctly, it protects the schedule
without constraining the craft.

**P2 · No declared categories.** There is no herbivore flag, no predator type, no
"filter feeder" niche, no fitness function naming a strategy. Where a category seems
necessary, replace it with a continuous quantity and let the label be applied afterwards
by an observer. A creature is prey to whoever can catch it.

**P3 · Measure whenever practical; keep every abstraction traceable to an observed
trial; validate the reduction against full physics.**

Where the game needs to know how good a creature is at something, it runs the situation
in full physics and records what happened. No learned models, no fitted approximations
to abstract dummies, no hyperparameters, no convergence risk.

But honesty about what this buys: the probes and duels are measurements; **using them to
predict ecosystem behaviour is still a model.** A pairwise win rate does not become a
context-free truth by having come from physics — it was measured in one arena, at one
separation, with one starting orientation, with no third party present. Transfer error
between L2 and L3 is real and must be measured, not assumed away. Bridge validation test
6 exists for exactly this and is not optional.

**P4 · The verdict must be external.** Aesthetic selection alone has no judge but the
player, and the player cannot be surprised by their own taste. Every loop terminates in
an outcome the system determines.

**P5 · Reuse before invention.** Every mechanism should be traceable to a published
paper, a licensed implementation, or a textbook algorithm. Original work is reserved for
the places where nothing exists. See §10.

**P6 · Determinism.** Given a genome, a seed and a world, results reproduce. This is what
makes replay, sharing, and debugging possible, and it must be a constraint from the
first line rather than a retrofit.

**P7 · Every increment ships something keepable.** No step in the roadmap produces only
scaffolding. If development stops at any point, what exists is worth having on its own —
including as an art object, independent of the game.

---

## 4. The player's experience

Three nested loops at three timescales.

### Minutes — the Tank

Six creatures swim in a tank. You watch them. You tap the ones you like. You breed. Six
new creatures appear, resembling their parents and differing in ways you did not
specify. You adjust the world — thicker medium, lower gravity, food clumped instead of
dispersed — and the kind of body that thrives changes.

This is where beauty and originality are generated. It is the part that works with no
objective at all, and it is where most of the play time is spent.

### Tens of minutes — the Trials

You take a creature and compile it. It runs a battery of physical probes, then fights
every resident species of a chosen world, one on one. You watch a grid of matchups fill
in. Any cell can be replayed at full speed as a duel.

By the end you know what your creature is: fast but fragile, slow and unkillable,
lethal against the burrowers and helpless against the ram. **The compile step and the
arena are the same event** — the wait is the spectacle.

### Hours and days — the World

You introduce your species into an inhabited world with a fixed biomass budget: a small
creature gives you many individuals, a large one gives you few. Then you watch, or read
the report. Populations oscillate. Your species establishes, or is eaten, or eats
everything and starves.

The verdict sends you back to the tank with a specific problem to solve. **You are the
mutation operator**, and the slow evolutionary cycle runs at the timescale of your
sessions rather than inside the simulation.

### The collection, across all of it

Creatures that survive something earn the right to be **described**: given their derived
binomial name and a page in an Atlas that persists across every world and every run.
Naming is earned, so the Atlas is curated by construction rather than by discipline.

---

## 5. Architecture in principle

Three layers. Each is independently valuable and independently testable.

```
L1  TANK          full 3D physics · genome · morphogenesis · breeding by taste
                                    │
                       compiled by  ▼
L2  BRIDGE        probe battery + pairwise duels → capability record + matchup matrix
                                    │
                        consumed by ▼
L3  WORLD         particle ecosystem · fixed genomes · mass-conserving · emergent dynamics
```

### Why this shape

Physics is where beauty lives and it is far too slow to run an ecosystem in. Fifty
physically simulated agents is a research-grade result; an ecosystem wants thousands.

Ecology is where longevity lives and it is illegible on its own — if a population dies
and you cannot see why, the game is noise.

The bridge resolves both. It runs full physics *once*, in a situation the player watches
and understands, and reduces the outcome to a small record the ecosystem can consume
by the thousand. **The reduction is a measurement, not an approximation.**

### What survives the reduction, and what does not

Deliberate, and the central design trade of the project.

**Survives:** how fast it moves, how sharply it turns, how much energy it spends, how
much surface it presents, how likely it is to catch a given opponent and how long that
takes, how likely it is to be caught, whether it pursues, whether it flees.

**Lost:** within-encounter tactics, feints, grappling, terrain exploitation, postural
defence, body-part-specific damage, genuine three-body physical entanglement.

The justification: at ecosystem scale, two strategies that produce the same speed, cost,
and win rate against the same opponents are ecologically the same strategy. The
mechanism is beautiful and belongs in L2, where it is watched. The outcome is what
propagates.

**Collective behaviour is generated in L3 — it is a new layer, not a recovery.**

Spacing, cohesion, alignment, pursuit and avoidance come from local rules between
neighbours and need no physical measurement. Those we get natively, using Reynolds'
steering behaviours.

But the *effectiveness* of collective behaviour depends on physical facts the pairwise
duel never asked about: whether three bodies can actually restrain one, whether a school
degrades targeting, whether geometry permits dense formation, whether several attackers
interfere with each other. **L3 social behaviour is therefore an addition to the model,
not the restoration of something already measured**, and it must be scoped as such.

Consequence: in the first world, social parameters affect **spacing, cohesion, pursuit
and avoidance only.** No pack tactics, no cooperative restraint, no coordinated
encirclement — nothing whose physical validity was never tested.

---

## 6. What is authored and what is generated

The single most important table in this document, because it is what determines whether
the project is finishable.

| | Authored by hand | Generated / measured |
|---|---|---|
| Creature bodies | — | ✅ genome + morphogenesis |
| Creature motion | — | ✅ evolved oscillators |
| Creature capabilities | — | ✅ measured in L2 |
| Species names | — | ✅ derived from body topology |
| Fight outcomes | — | ✅ simulated in full physics |
| Resident species of a world | — | ✅ bred in the tank, auditioned in L3 |
| Ecosystem balance | — | ✅ auditioned, not tuned |
| World constants | ✅ ~6 numbers per world | — |
| Art direction | ✅ | — |
| UI and copy | ✅ | — |

### The Atlas is the authoring mechanism

The collection and the content pipeline are **the same system**. This is the structural
consequence of P1 done properly.

An Atlas entry is a species: genome, compiled capability record, and the world it was
compiled in. Entries have a provenance — `shipped` or `bred by you` — and nothing else
distinguishes them. Species compiled in a world are eligible to be **fauna** of that
world; habitat is not a rule but a consequence of the data model, since a record is only
valid for the world it was measured in.

So:

- During development, residents are bred in the tank, compiled, described into the Atlas, and auditioned in L3. That surviving set ships as a world's fauna.
- In play, the same act is available to the player. A creature you describe becomes a species that can inhabit the world it evolved in.
- The Atlas view is the registry of all known species, filtered by habitat, showing which are currently active fauna.

Three things fall out of this, all of them good:

**Describing acquires real consequence.** It is not naming a trophy; it is promoting a
creature to the standing fauna. That is the answer to "describing is free, therefore
meaningless" without inventing an arbitrary budget.

**Your past successes become your future obstacles.** A creature you established last
week is in the world you introduce into next week. This is the colonisation idea reached
without any evolution inside the ecosystem — the world fills up with your own history.

**Development and play use one tool.** There is no separate authoring mode, no content
editor, and no backlog. Building a world is a session of playing with a different
objective.

**Cost, stated honestly.** The matchup matrix becomes a property of a *fauna set*, built
incrementally: adding a species to a fauna of N costs N duels. Shipped fauna arrives with
its matrix precomputed; player additions extend it and are cached. This is the same order
of cost as one compile, and it is why the matrix is keyed by world rather than baked into
the world file.

**Scope note.** The Atlas *data model* — specimen + record + habitat + provenance — is
required from the first slice. The Atlas *UI* and the fauna-editing mode are not; see §7.

---

## 7. Roadmap — vertical slice first

**The change from R1, and the reason for it.** The previous roadmap validated each layer
before deepening the next. That is architecturally tidy and strategically wrong, because
the risk it leaves untested longest is the one that matters most:

> The Tank selects for elegance. The Trials reward compact, aggressive mobility. The
> World rewards cheap, efficient biomass. All three work; the assembled game teaches the
> player not to value the thing that attracted them.

Three layers that each work do not constitute a game that works. **The relationship
between the loops is the hypothesis, and it must be tested early and cheaply.**

The governing rule changes accordingly:

> ~~No subsystem starts until the previous one is fun on its own.~~
> **No subsystem becomes deep until a minimal end-to-end loop exists.**

Each phase remains independently keepable. What is no longer permitted is postponing the
discovery of whether the loops reinforce or undermine each other.

### The slice

**A · Minimal trunk.** Only what the loop needs: seeded RNG, save/load one run, screen
stack, developer panel, genome serialisation. Not the extractable framework. See doc 20
tier S.

**B · Constrained Tank.** Six creatures, one aquatic world (W1), *aggressively restricted
body grammar* — recursion depth ≤ 2, ≤ 8 bodies, no grafting, bounded asymmetry. Select
parents, one mutation-strength control, at most three environmental controls, breed.
**One tank slot is always an unrelated random genome** — non-negotiable, see §9.

The schema stays full; only the random factory and mutation operators are restricted.
Loosening later is a configuration change, not a migration.

**C · Tiny Trial.** Two probes, three frozen residents, one duel each, replayable, a
minimal capability card. No full battery, no matrix.

**D · Tiny World.** One small 2D arena, three residents, fixed biomass, a short run,
three outcomes: fails to establish · coexists · destabilises. One causal explanation tied
to a measured capability.

**E · Return to breeding.** After the verdict: what probably caused it, which trait was
implicated, and a direct route back to the lineage. **This closes the loop and is the
point of the whole slice.**

**F · Then deepen.** Beauty pass · full probe battery · Atlas UI and binomial naming ·
more worlds · fauna authoring · sharing.

### Postponed out of the slice

Full Atlas UI · share cards · export/import UI · fauna-editing mode · multiple worlds ·
asynchronous opponents · unrestricted 3D morphology · full social behaviour · complete
probe battery · cross-device reproducibility · the extractable trunk.

Two exceptions, both cheap and both load-bearing: **derived binomial naming** (a pure
function, no simulation cost, and it is what makes the Tank feel like collecting rather
than churning) and **the Atlas data model** (not its UI — but specimens must be storable
with their records from day one or §6 requires a migration later).

## 8. Scope discipline

**This project is not:**

- an artificial life research project. No open-ended evolution, no mutation inside the ecosystem, no emergence we are relying on but cannot guarantee.
- a physics engine. Rapier is used as delivered.
- a machine learning project. Nothing is trained.
- multiplayer infrastructure. No accounts, no server, no netcode; sharing is files.
- a 3D ecosystem. L3 is 2D.

**Standing scope rules:**

1. No subsystem starts until the previous one is fun on its own.
2. Any feature requiring hand-authored content per creature or per world is rejected by default.
3. The service worker goes in last.
4. If something can be measured instead of modelled, measure it.

---

## 9. Risks

| Risk | Severity | Mitigation |
|---|---|---|
| Generated creatures are ugly or broken | **Fatal to the thesis** | Timeboxed art pass inside Phase 1; capsules not boxes; oscillator control for organic motion; judge the bet on a fair test |
| The proxy loses the creature's identity | High | Turn-rate clamp; measured matchups instead of fitted curves; validation against full-physics duels |
| **Incentive divergence between layers** — Tank rewards elegance, Trials reward aggression, World rewards cheap biomass; the phenotypes that attracted the player get selected out | **Highest** | The vertical slice (§7) exists to detect this early. If it appears, the fix is in the Trial and World scoring, not in the Tank. |
| Ecosystem flatlines or collapses | High | Mass conservation **bounds total biomass and makes failures interpretable — it does not guarantee interesting dynamics.** It does not prevent monoculture, extinction cascade, sterile equilibrium, spatial deadlock, or oscillation too fast or slow to read. Auditioning and parameter constraint are still required. |
| Breeding by taste converges to one animal in ~5 generations | **Certain without the fix** | One tank slot is always an unrelated random genome. Non-negotiable; in the slice from day one. |
| Evolution finds crude dominant optima — maximise size, spin rapidly, ram, exploit contact detection, or stay still and conserve energy | High | Physical guardrails, not authored categories: energy cost proportional to actuation, bounded actuator power, real turning cost, contact rules resistant to numerical exploitation, biomass budget against size dominance |
| Content authoring burden | High historically | §6 — nothing per-creature is authored |
| Scope expansion into ALife research | High | No mutation in L3; explicit non-goals |
| Phone performance | Medium | Typed arrays, spatial hash, zero allocation in tick, documented fallback ladder |
| Determinism gaps break sharing | Medium | Same-device determinism promised; cross-device explicitly deferred |

---

## 10. Provenance

Where each part comes from, and how much of it is ours.

| Component | Source | Ours |
|---|---|---|
| Genome, morphogenesis, mutation, grafting | Sims, *Evolving Virtual Creatures*, SIGGRAPH '94 · reference impl `mycoolfin/the-simsulator` (MIT) | Port |
| Arena, contest scoring, capture-by-torso-contact | Sims, *Evolving 3D Morphology and Behavior by Competition*, ALife IV 1994 | Port |
| Eco-evolutionary structure, time scales, perception-radius constraint, frozen-resident methodology | Ito, Pinheiro Saraiva, Suzuki, Arita, *Artificial Life* 22(2), MIT Press, 2016 | Adaptation |
| Mass conservation, threshold reproduction, trophic recycling | `jobtalle/PredatorPreySystem` (MIT, © 2018 Job Talle) | Adopted |
| Steering, flocking, schooling | Reynolds 1987 / 1999 · reference impl `SebLague/Boids` (MIT) | Canonical |
| Oscillator control with phase propagation | Standard CPG practice | Standard |
| **Capability record + matchup matrix as the bridge** | — | **Original** |
| Game structure, verdict taxonomy, biomass budget, describe economy | — | **Original** |

Two components are genuinely new. Everything else is assembly from work that already
exists, which is the intended risk profile: the hard, well-trodden parts are ported, and
invention is spent only on the design questions nobody has answered.

---

## 11. Success criteria

**The Tank passes if** — voluntary reopening on four separate days is a useful internal
signal but is insufficient alone, because the maker is unusually vulnerable to novelty
and attachment. The real gate needs someone who did not build it:

- at least two outside players voluntarily breed past the point they were asked to;
- they can point at parent–offspring resemblance unprompted;
- they form a preference between lineages and can say why;
- at least one mutation strikes them as surprising without striking them as arbitrary.

**The slice passes if** a World verdict sends the player back to the Tank with a specific
intention. Not "I should try again" — "it was too slow, I need a faster one."


**The Trial passes if** a result changes what gets bred next, *and* the player can
explain the result without reading statistics or code. If the verdict does not alter
behaviour, it is decoration.

**The World passes if** a run produces an outcome that is surprising *and* explicable —
not predicted, but explicable afterwards. Both halves required: unpredictable and
inexplicable is noise; predictable is pointless.

**Test the explanation before showing the system's diagnosis.** Ask the player why they
think it happened, then reveal the causal readout. Otherwise the UI is manufacturing
apparent understanding after the fact, and the gate measures nothing.

**The project passes if** a hundred players end up with genuinely different creatures.
That is what the whole no-authoring architecture is for.

---

## 12. Open questions

Carried forward deliberately; each is resolved in a downstream document or by play.

1. Tank interaction layout — shared tank with pause, or grid of pods. *(21 UI)*
2. **Resolved (R2).** Describing promotes a creature to the world's standing fauna (§6). That is its cost and its meaning.
3. How much of an ecosystem run the player watches versus reads as a report. *(21 UI)*
4. Whether trials are one-on-one only, or eventually many-on-one. *(11 L2)*
5. Final name. Vivarium is a placeholder.
