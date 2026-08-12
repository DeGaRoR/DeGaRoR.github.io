# 15 — BREEDING AND SELECTION

The methodology. What to select on, how to structure the population, when to
outcross, and what has to be re-measured after a genome change.

**Scope.** This document is about *how to run a selection programme*, not about
any one objective. The current objective — speed and orientation, a creature
that reaches a beacon and stays there — is the worked example throughout, and
the rules are written so that replacing it does not invalidate them.

**Discipline, inherited from `PLAN-TO-INTELLIGENCE.md`.** A number enters this
document only with the script that produced it and the `n`. Figures below were
measured on 2026-08-11 against the working tree at `GENOME_V 8`, by
`tools/_zherit.mjs` and `tools/_zbreed.mjs`, both of which ship with it.

---

## 0. The one-paragraph version

Founders are random draws, never authored animals. The objective is
**`closedCm`** — how many centimetres closer to the mark steering got the animal
than its own unsteered body would have — because that number is in centimetres,
is control-subtracted, contains speed and aim together, and does not change
meaning when the task changes. Selection is **two independent culling levels**:
cull half the population on how far it travels, then rank the survivors on
`closedCm`. The population is **three isolated lines**, not one population,
because progress here is limited by the supply of beneficial mutations and
isolated lines search in parallel. A line that stops improving for three
generations is **outcrossed** to the ark's most complementary animal. Everything
ever selected is kept in an **ark**, which is also the instrument that tells you
whether a genome bump changed what the scores mean.

---

## 1. Four sources, compared

### 1.1 What the breeding world actually does

Animal and plant breeding solved most of these problems between 1930 and 1970,
and the parts that transfer are the parts about *structure*, not about genetics.

| technique | what it is | transfers? |
|---|---|---|
| **Truncation selection** | rank, keep the top fraction `p` | yes, and it is what every tool here already does |
| **The breeder's equation** | `R = h² S`; response is heritability times the selection differential | yes — and §2 measures `h²` here for the first time |
| **Index selection** (Hazel & Lush) | weight several traits into one number by their economic values and genetic covariances | **no.** It needs a genetic covariance matrix nobody here can estimate, and the weights would be exactly the ungrounded coefficients this project forbids |
| **Independent culling levels** | a separate threshold per trait, applied in sequence | **yes, and it is the recommendation.** Weight-free, scale-free, survives a genome bump, and it is what Denis already does by hand |
| **Tandem selection** | improve trait A for some generations, then trait B | partly. Classically the weakest scheme — but it is correct when trait B is *unmeasurable* until trait A clears a threshold, which is the situation here (§2.4) |
| **Two-stage selection** (Cochran; Young) | screen many candidates on a cheap trait, trial the survivors on the expensive one | yes, and it is also the compute-optimal shape. The two motivations coincide |
| **Line breeding + outcross/topcross** | keep several closed lines, cross when one plateaus | **yes, and this is the most valuable transfer.** §4 |
| **Reciprocal recurrent selection / combining ability** | select lines on how well their *crosses* perform, not on the lines themselves | later. It needs the crossover path characterised first (§7 open) |
| **Corrective / compensatory mating** | mate an animal to a partner strong exactly where it is weak | yes; it is what `outcrossPartner()` implements |
| **Gene banks, frozen semen** | keep every good animal forever, reintroduce later | yes — the ark |
| **Control populations and a genetic base** | maintain an unselected reference so that *genetic* gain can be separated from a change in the measuring environment | **yes, and its absence is why every genome bump here has silently invalidated the score history.** §6 |
| **Effective population size; ΔF = 1/(2Nₑ)** | inbreeding accumulates as the reciprocal of twice the effective size; livestock practice keeps it under ~1% per generation | **noted and deliberately ignored.** There is no inbreeding depression in this system: no dominance, no recessive load, no heterozygosity. The thing small `Nₑ` costs here is *variance*, not vigour, and variance is restored by mutation and by the ark rather than by outbreeding |

Two further ideas come from the evolutionary-computation side rather than from
breeding, and both are load-bearing here:

- **Clonal interference** (Gerrish & Lenski). In an asexual population, two
  beneficial mutations that arise in different individuals compete, and only one
  can fix. The larger the population, the more of the good mutations are wasted.
  Splitting into isolated lines converts that waste into parallel search.
- **Deception and proxy gaming** (Goodhart; and Lehman & Stanley's novelty-search
  critique). Select on a proxy and you get the proxy. This project has three
  recorded instances (§1.4) and the rule that comes out of it is R3 in §8.

### 1.2 The mathematics — and the measurement that changed which mathematics applies

The default model is the breeder's equation. **`tools/_zherit.mjs`, n = 40
parents × 4 clonal offspring, one zygote per child, measured it directly** —
parent–offspring regression of the mean of a family on its parent:

| trait | b | s.e. | b/se | σ_founders | σ_mutational | f/m | p(mutation improves) | neutral |
|---|---|---|---|---|---|---|---|---|
| cruise speed | 0.999 | 0.016 | 64 | 0.0333 | 0.0061 | 5.5 | 0.18 | 0.66 |
| closure (live − blind) | 0.971 | 0.022 | 43 | 0.1047 | 0.0305 | 3.4 | 0.22 | 0.57 |
| raw closure | 0.974 | 0.018 | 55 | 0.1193 | 0.0255 | 4.7 | 0.22 | 0.57 |
| arrival fraction | 0.750 | 0.042 | 18 | 0.0726 | 0.0385 | 1.9 | **0.00** | **0.99** |
| straightness | 0.924 | 0.022 | 42 | 0.1847 | 0.0539 | 3.4 | 0.18 | 0.66 |
| loop closure | 0.752 | 0.005 | 157 | 0.0679 | 0.0355 | 1.9 | **0.03** | **0.96** |
| planarity | 0.929 | 0.015 | 61 | 0.0609 | 0.0140 | 4.3 | 0.19 | 0.66 |
| \|preyGain+threatGain\| | 0.992 | 0.008 | 130 | 0.4448 | 0.0416 | 10.7 | 0.03 | 0.95 |
| mass | 0.997 | 0.010 | 96 | 8.06 | 0.871 | 9.3 | 0.11 | 0.84 |
| bodies | 0.967 | 0.024 | 41 | 7.10 | 1.944 | 3.7 | 0.07 | 0.89 |

And `R = b·S` was checked rather than assumed, by truncating the same parents at
the top third and comparing predicted with realised response. **Ratios 0.93 to
1.12 across all ten traits.** The linear model is exactly right here.

**Three consequences, and they redirect the whole programme.**

**(a) Heritability is not the problem. It is ~1.** Reproduction is clonal —
`mutate(parent)`, one parent, no recombination in the tools — so there is no
factor of two to argue about and no environmental variance at all: the simulation
is deterministic, so the same genome scores the same number every time. A child
is its parent plus a small perturbation. Everything the breeder's equation
predicts about *slow* progress under low heritability is irrelevant here.

**(b) So the founding draw is the single largest step the programme will ever
take, and after generation 1 the model changes.** With `b = 1`, the response in
generation 1 is the entire founding selection differential — the population
simply becomes its best founder. The founding spread is 3.4 to 5.5 times the
per-mutation spread, so *the founding draw is worth roughly four generations of
subsequent mutational progress*, and it is bought at one-sixth of the cost. Spend
the budget on a wide draw.

**(c) After that, this is a mutation-limited adaptive walk, not a
variance-limited breeding programme.** The founding variance is spent in one
generation. Every step after it is paid for by new mutation, and the numbers that
govern *that* regime are in the last three columns: about 60% of mutations are
neutral for any given trait (one mutation touches one of ~15 operator branches),
about 20% improve it, about 20% hurt it, and the effect sizes are symmetric. The
governing quantity is the **supply of beneficial mutations**, `N · p₊`, and the
enemy is clonal interference.

That reframing predicts, quantitatively, the plateau this project has already
recorded. `tools/_zselect.mjs` ran sixty generations at population 24 and gained
5%, converging to a single species. That is not a bug in the objective; it is
what an adaptive walk does once it is on a local peak and every line in the
population is the same animal.

**(d) And then the same tool was run through the shipped `breed()` path, and it
inverted a decision every previous tool in this project made.**

`tools/_zherit.mjs 40 4 40 4.5 recombinant`: 20 pairs of *unrelated* random
parents, offspring produced by `breed()` with both parents selected, midparent
regression, `crossoverRate: 1` — crossover fired on 80/80 zygotes.

| | clonal `mutate()` | recombinant `breed()` |
|---|---|---|
| b (closure) | **0.971** ± 0.022 | **0.545** ± 0.146 |
| b (cruise speed) | 0.999 | 0.851 |
| σ per event / σ founding, closure | **0.29** | **1.04** |
| p(improves), closure | 0.22 | **0.47** |
| E[Δ \| improves], closure | 0.021 | **0.047** |
| **neutral events**, closure | **57%** | **0%** |
| child survival, one zygote each | (per run) | **80%** |

**One reproductive event through `breed()` generates as much variance in the
objective as the entire founding draw contains.** It never produces a neutral
child, its steps are twice as large, and it improves the child twice as often.
What it costs is fidelity — half the heritability — and a 20% zygote mortality.

Mutation is a high-fidelity, mostly-neutral, small-step operator: safe, slow, and
prone to plateau. Recombination is a low-fidelity, never-neutral, large-step
operator: fast, and it only works while the parents differ.

**This explains the plateaus directly.** `_zgoalevo`, `_zgoalch2` and
`_evolve_seek` all switched crossover **off** — reasonably, to avoid confounding
two operators while measuring one — and all three are among the runs that
plateaued. `_zselect` kept crossover on, ran sixty generations, gained 5%, and
"converged to one species": once a population has converged, crossing two of its
members is crossing an animal with itself, and the operator that was carrying the
search quietly stops existing.

> **The one thing the whole methodology turns on:** *crossover's power is
> proportional to how different the parents are, and truncation selection
> destroys exactly that difference.* Everything in §4 — isolated lines, an ark
> that is never emptied, an outcross fired by a stall detector — is machinery for
> keeping divergence alive so that recombination still has something to work
> with. This is also the quantitative form of Denis's rut protocol, and it is why
> that protocol beats a plain selection loop.

⚠ **The limit on this claim.** These pairs are *unrelated random draws* —
maximum divergence. It is the right number for an **outcross event** and it is an
upper bound for crossover **within** a line, where the parents are close
relatives. Measuring the within-line figure is open item §7.2.

**Pre-declared prediction for the run in §5.** With eight new offspring per line
per generation, the expected gain per generation is about the expected maximum of
eight draws from the mutational distribution, ≈ 1.42 σ_m — which at
σ_m(closure) = 0.0305 and a 4.5 cm task is **≈ 0.20 cm of `closedCm` per
generation, declining as a line approaches its peak**, against a founding step of
≈ 0.95 cm. So: expect roughly 2× the founder after ten generations, not 10×. Any
result far above that is a result about the landscape, not about the selection.

**What the mathematics says about the optimum:**

- **Proportion selected.** Robertson's limit-to-selection argument puts the `p`
  that maximises *long-run* response near 0.5, because a harder cut buys a bigger
  step now at the cost of the variance that would have paid for later ones. Here
  the two culling levels compose to `0.5 × 0.33 ≈ 1/6`, which is harder than
  that — and it is defensible only because the variance is regenerated by
  mutation and by the ark rather than carried in the population. **This is the
  parameter most worth sweeping** (§7).
- **Population versus generations, at a fixed budget.** Response per generation
  grows only as the expected maximum of `n` draws — logarithmically. Generations
  add linearly until the peak is reached. So generations beat population size,
  until the line stalls; after which neither helps and only an outcross does.
  This is precisely why §4's stall detector exists.
- **Isolated lines beat one big population** whenever the walk is
  mutation-limited and the landscape has more than one peak. `L` lines of size
  `N/L` find `L` peaks and combine them; one population of size `N` finds one.

### 1.3 Denis's protocol, read as a breeding programme

Translated into the vocabulary above, and checked against the measurements.

| the step, as described | the technique | verdict |
|---|---|---|
| start from random candidates | founding from an unselected base | **right, and it is the highest-value step.** σ_f/σ_m = 3.4–5.5 |
| keep 2 or 3 | truncation at very high intensity | right *for the first cut*, because `b ≈ 1` makes the generation-1 response the full differential. Wrong as a permanent setting — see Robertson above |
| select on controlled movement first | the first independent culling level | **right, and it is not optional.** §2.4: nothing in a random corpus arrives, so an arrival-flavoured objective has no gradient until this is done |
| run generations, then look at ledgers | tandem (sequential) selection | classically the weakest scheme, **correct here** for the same threshold reason |
| eliminate the ones going in circles | culling on trajectory shape | real, but **it has nothing to bite on in a founding population.** Measured: loop closure p50 = 1.00 and only 3% of mutations move it. Circling is a property of the fast lineages Denis is already looking at, not of the draw. Keep the cull for later rungs |
| eliminate the 100% planar | culling on trajectory planarity | **measured, and the advice changes.** Planarity p50 = 0.978 — a hard cull removes nearly the whole corpus. Worse, planarity correlates with speed at **r = −0.56**, so culling flat trajectories is partly a *speed* cull wearing another name. Read the **out-of-plane band of `closedCm`** instead: it measures the thing the planar cull is actually for, and it costs nothing because the scorer already reports it |
| compare bent trajectories against straight ones near the beacon | a control-subtracted objective | **this is `closedCm`, exactly.** Independently arrived at from the two ends — Denis by eye, `_zgoal.mjs` by measurement — and the agreement is the strongest evidence either has |
| dismiss creatures barely moving | independent culling level on reach | right; it is stage 1 |
| swap candidates against the best ledgers, provided speed is kept | selection with a restriction | right |
| in a rut: save the best, hybridise with lines carrying the traits I lack | **line breeding + outcross + gene bank + complementarity mating** | **the most valuable part of the protocol, and no automated run in this project has ever done any of it.** In a mutation-limited regime it is the only escape from a local peak |

**On authored breeding stock.** The objection is not only aesthetic and it should
not be overridden. A run founded on eels measures the eel's neighbourhood in
genome space, which is the one region already known to work; the project's own
standing rule 10 says as much, and `tools/_zgoalevo.mjs` prints the warning at
the top of every authored run. `tools/_zwild.mjs` already showed the constraint
is affordable — its wild-bred WILD 1 scored 15.6 against the authored Darter's
9.0 and the Eel's 6.0 on the forage objective.

**But the constraint has one hard consequence and it must be stated.** The tank's
beacon task — 8 cm in 120 s — is calibrated to eel-class speed, about 0.5 cm/s.
A random draw cruises at **0.017 cm/s** at the median, thirty times slower, and
**3% of a random corpus travels even 4.5 cm in 40 s** (§2.4). Founding from
random draws therefore means either many generations of pure locomotion
selection, or a task that starts where the animals are and is ratcheted up. §4.4
takes the second route, because the first spends the entire budget before the
steering question is ever asked.

### 1.4 The previous automated attempts, and how each one failed

Every one of these is in the tree and worth reading before repeating it.

| tool | selected on | outcome | the failure, named |
|---|---|---|---|
| `_evolve.mjs` | displacement | proved locomotion has gradient | — (it worked; it was a feasibility check) |
| `_evolve_run.mjs` | forage benefit | 28× in three generations, then converged to one genotype and stopped | **convergence with no variance source.** The fix named in the handover — immigration and untouched elites — treats the symptom |
| `_zturn.mjs` | turn capability | capability 5.4 → 21.2 °/s, reachability stayed 0/5, speed collapsed | **proxy gaming.** It bred creatures that spin brilliantly in place |
| `_zreach.mjs` envelope | a kinematic reachability envelope | retired at 62% agreement against a declared 75%; **10 of 26 disagreements one-directional** | **a necessary condition mistaken for a sufficient one** |
| `_evolve_seek.mjs` | control-subtracted closing | found seekers and **discarded the animals** | **no ark.** No seeker it ever found survived its own run |
| `_zgoalevo.mjs` round 1 | closure, target scaled per creature | 10.9× the null arm; then **5 of 56 cells arrived** in the tank against a declared 50% | **the objective normalised range away.** Winners aim beautifully and travel 2.3 cm against an 8 cm task. The anti-spin guard checked only that speed had not *collapsed* — it rose, from a base that was never going to be enough |
| `_zgoalevo.mjs` round 2 | closure, absolute 8 cm, authored founders | tank 9–17% | authored founders; the claim is "selection improves competent founders", not discovery |
| `_zgoalch2.mjs` first run | second steering channel, free vs locked | +0.16 in favour of free — **drift, read as signal** | **the rng stream was keyed on the arm**, so the arms drew different mutations and were two runs rather than one comparison |
| `_zgoalch2.mjs` second run | same | unanswerable in the length run | **mutational reachability.** A gene inserted at 0 with σ = 0.10, drawn once per ~23 mutations, needs ~36 generations before it can change a trajectory |
| `_zselect.mjs` | ledger ratio | winner scored 45× by moving 1.5 cm | **a ratio is a margin, and a margin is won by not spending.** Switched to `balance` |
| `_zselect.mjs` | ledger balance, 60 generations | **converged, same species, +5%** | **the plateau.** Exactly what §1.2(c) predicts once the founding variance is spent |
| `_zwild2.mjs` | forage, three isolated lines | three genuinely distinct winners | — (the line structure worked, and it is carried forward here) |

**The pattern.** Twelve entries, and only two of the failures are about
selection. The rest are **instrument** failures: the wrong quantity measured, the
right quantity measured at the wrong operating point, a control arm missing, an
arm-keyed random stream, a ratio where a difference was meant. §8's standing
rules are written against this table, one rule per recurring failure.

### 1.5 Where the four sources agree, and where they do not

**All four agree on:** truncation selection; culling on movement before judging
aim; keeping the best animals rather than only their scores; and treating a
plateau as a signal to bring in outside genes rather than to wait.

**The breeding world and the mathematics correct Denis on two points:**
keeping 2–3 permanently is harder truncation than Robertson's optimum, and the
planarity cull is partly a speed cull and should be replaced by reading the
out-of-plane band.

**Denis corrects the automated attempts on three points, and each is a hole in
every tool in the tree:** there is no ark, there is no stall detection, and there
is no hybridisation step. Those three are the difference between his results and
theirs, and they are §4.5, §4.6 and §4.7 below.

**The mathematics corrects everyone on one point:** this is not a heritability
problem. It is a mutational-supply problem, and the interventions that matter are
the ones that add variance — a wide founding draw, isolated lines, and the
outcross — not the ones that sharpen selection.

---

## 2. The measured baseline

`tools/_zherit.mjs 40 4 40`, `GENOME_V 8`, random draws, W1.

### 2.1 Yield of the draw

132 draws → 40 subjects. **92 rejected before any trial** (inviable or jointless);
**0 viable-but-unscorable**. So roughly **30% of random draws are usable**, and
the screen is cheap enough that this is not a constraint.

### 2.2 Developmental load, honestly counted

One zygote per child, no re-rolls: **survival is reported per run by the tool**.
The tank's `VIABILITY.maxAttempts = 12` conceals this — `breed()`'s own
doc-comment measures 0/30 fallbacks at 12 attempts against 3/30 at 1 — so every
measurement here runs at `viabilityAttempts: 1`.

### 2.3 What one mutation does

~60% of mutations are **neutral** for any given trait, ~20% improve it, ~20% hurt
it, and `E[Δ|+] ≈ |E[Δ|−]|`. Mutation is an unbiased random walk with a large
neutral fraction, which is exactly what `mutate.js`'s one-operator-per-call
structure implies: one call touches one of ~15 branches.

### 2.4 The range problem, which is the central practical fact

Blind excursion in 40 s, over 40 random subjects:

| p10 | p50 | p75 | p90 | max |
|---|---|---|---|---|
| 0.21 cm | 0.60 cm | 1.59 cm | 3.11 cm | 4.94 cm |

**3% of the corpus travels 4.5 cm. None travels 8 cm.** Every conclusion in §1.3
about staging, and the ratchet in §4.4, follows from this row.

### 2.5 Trait correlations, n = 40

| | speed | closure | live | arrived | straight | planar |
|---|---|---|---|---|---|---|
| speed | — | **0.17** | 0.46 | **0.73** | −0.21 | **−0.56** |
| closure | 0.17 | — | 0.85 | 0.60 | −0.20 | 0.05 |
| straightness | −0.21 | −0.20 | −0.27 | −0.20 | — | **0.70** |
| planarity | −0.56 | 0.05 | −0.23 | −0.42 | 0.70 | — |

**Speed and aim are nearly independent (r = 0.17).** They are two traits, not
one, and an objective containing only one of them will not deliver the other.
This is the quantitative form of Denis's "speed + orientation".

> ⚠ **An n = 8 pilot of the same tool read r = 0.96 and it was noise** — one fast
> animal in a small draw. It is recorded here because acting on it would have
> been this project's `turnCapability` mistake in a new place, and the only thing
> that caught it was re-running at a usable `n`.

---

## 3. The objective

### 3.1 `closedCm`

    closedCm  =  mean over directions of  ( d_blind − d_live )

`d_live` is the closest the creature ever came to the mark with its sensor
driving the turn; `d_blind` is the closest the *same body*, from the *same
settle*, came to the *same* mark with no steering command at all. Both in
centimetres.

Five properties, and each one is a failure from §1.4 closed:

1. **In centimetres.** Not a fraction of the task, so moving the task does not
   move the objective. This is `_zgoalevo` round 1's failure, closed.
2. **Control-subtracted.** A creature that wanders into an 8 cm sphere in a
   bounded tank scores 0.333 on raw closure; `snarlback-teal` did. Subtracting
   the blind arm on identical geometry is not optional and never has been.
3. **Contains speed and aim together, with no weights.** A slow animal cannot
   close many centimetres however well it aims; a fast blind one has its own
   travel subtracted out. No coefficient to justify, no index to estimate.
4. **Cannot be won by spinning.** `_zturn`'s failure mode scores zero.
5. **Bounded above by the task distance**, which is what makes §4.4's ratchet
   necessary rather than decorative.

### 3.2 What is reported but not selected on, and why

`arrived` and `dwell` (station-keeping — the "stay there" half of the
requirement) are computed on every trial and selected on by **nobody at the
current rung**, because §2.3 measures `arrived` at **p₊ = 0.00 and 99% neutral**:
no mutation in 160 moved it. A term that is zero for every candidate cannot rank
them. They become selection criteria at rung C (§4.8), when the population can
reach the mark at all.

### 3.3 The trajectory-shape readout

`tools/_zgoal.mjs` now returns, free, from the blind traverse it already runs:
`straightness`, `loopClosure`, `planarity`, `excursion`. These are Denis's
by-eye culls, computed. **They are sampled at 1 Hz, not at the path's own 15 Hz**
— the centre of mass oscillates at 12–22 Hz, so a path length summed at 15 Hz is
mostly gait wobble and every creature reads as a thrasher. That aliasing is what
made the older `straightness` field useless.

---

## 4. The protocol

Implemented by `tools/_zbreed.mjs`. Reproduction goes through the shipped
`engine/l1/breed.js` — N17's stranger slot, N18's untouched elites, crossover,
the graft ladder — so a conclusion drawn here is a statement about the game and
not about a private harness.

### 4.1 Rung structure

| rung | select on | leave when |
|---|---|---|
| **A — locomotion** | reach (blind excursion) | the reach cull stops binding, i.e. the median subject travels the task distance |
| **B — orientation** *(current)* | `closedCm`, over a reach cull | arrivals become non-zero |
| **C — arrival and station-keeping** | `closedCm`, then `dwell` | — |

Rungs are not modes to switch between. **The two culling levels produce the
staging automatically**: while nothing travels, the reach cull binds and reach is
what is being bred for; once everything travels, the same cull stops binding and
`closedCm` decides. Nothing has to notice the transition.

### 4.2 Founding — prospect wide, trial narrow

Draw `PROSPECT_DRAWS` (240) random genomes. Screen each on morphogenesis,
viability, and a 6 s cruise — 0.48 s. Trial the fastest `PROSPECT_TRIAL` (24) on
the full objective — 2.4 s each. **The screen is not a cheap proxy for the
objective** (r = 0.17, §2.5); it is stage one of the same two-level cull, applied
to the founding draw. Speed against `arrived` is r = 0.73, which is the trait it
is meant to screen on.

The top `L` become the founders of `L` lines. **Everything else trialled goes
into the ark**, and that is what makes a stall rescuable later.

### 4.3 Selection — two independent culling levels, in Denis's order

1. Discard non-subjects (will not build, will not cruise, has no steering plane)
   and anything that came apart. **A non-subject is not a score of zero**:
   "cannot be simulated" and "can be simulated and does not steer" are different
   facts, and averaging them is how a burst creature comes to look like a
   champion.
2. **Stage 1 — reach.** Keep the top 50% by blind excursion.
3. **Stage 2 — aim.** Rank the survivors by `closedCm`, keep the top third.

No weights, no calibration constants, scale-free, and unchanged by a genome bump.

### 4.4 The ratchet — the task follows the population

`closedCm` cannot exceed the task distance. A saturated objective has no variance
and therefore no selection differential, so the task has to move:

    D ← max( D,  clamp( 2 × p90(closedCm),  4.5 cm,  8 cm ) )

**Monotonically upward, never down**, so a generation-20 number is not measuring
an easier exam than a generation-5 one. Ceiling 8 cm is the distance
`ui/screens/vivarium.js` puts the beacon at; reaching it is the programme's
terminal condition and from there the numbers are the tank's.

**When `D` moves, the whole arm is re-scored.** `closedCm` carries no factor of
the distance, but it is not literally invariant to one — a target 8 cm out is a
different bearing history from one 4.5 cm out, so a row taken at the old distance
is a row from a different experiment. The ratchet fires rarely, so this is cheap;
and without it the run would be quietly comparing across two exams, which is the
whole failure §1.4 records twice.

### 4.5 Lines — three of them, isolated

Each line is founded by **one** prospected animal plus its mutant offspring:
line breeding from a single progenitor. Lines do not exchange genes until one
stalls. The justification is §1.2(c): in a mutation-limited walk, one population
finds one peak and wastes every other beneficial mutation to clonal interference;
`L` lines find `L` peaks. `_zwild2.mjs` reached the same structure from the
observation that "the top N of a converged population ARE siblings".

Stranger slots (N17, `max(1, round(N/6))` per generation) are kept and filled
with fresh random draws. They are cheap immigration and they are the shipped
rule; **they are not the anti-plateau mechanism.** The recorded hit rate for a
random stranger beating an elite is 3%.

### 4.6 The stall detector

A line is stalled when its best `closedCm` has not risen by 5% for 3
generations. This is measured **before** the generation's champion is written
into `line.best` — asking the question afterwards compares a number to itself and
no line would ever register as stalled.

### 4.7 The outcross — corrective mating from the ark

On a stall, the stalled line's champion is z-scored on both axes — reach and
`closedCm` — against the whole ark. Its **weaker** axis picks the direction, and
the ark's leader on that axis is the donor. The donor is injected into the
line's stranger slot (`breed()`'s `injectStrangers`, which exists for exactly
this) and **forced to breed the following generation** whether or not it
out-ranks the line's own animals — appended last in the selected list, so it can
never displace a selected animal, only add to them.

This is Denis's "hybridise with creatures having traits I miss", and it is
compensatory mating as dairy and horse breeders practise it. An empty ark or a
tie falls back to the ark's best `closedCm`, which is the ordinary topcross.

### 4.8 Restocking

A line reduced to fewer than two subjects is **restocked from the ark**, not
abandoned. A breeding programme does not delete a line because one generation
failed.

---

## 5. Validation

### 5.1 The gates, pre-declared

> **Amended after run 3.** Gate 1 below was declared on *best-ever* and it has
> now failed twice for a reason that is structural (§5.4): best-ever is a maximum
> over an equal number of evaluations, and a diverse arm wins it while losing
> everywhere else. **Gate 3 — the population median — is the discriminating test
> and it is now the primary one.** Gate 1 is still computed and printed so a tie
> stays visible. Both were declared before run 3; neither was chosen afterwards.

1. **Paired null arm ≥ 2×.** Both arms start from a byte-identical generation 0
   and share the random stream; the only difference is that the null arm keeps
   the same number of parents *at random* from the same subject set. Anything
   else confounds selection with the founding draw. ⚠ The founding rng key must
   **not** contain the arm name — `_zgoalch2` shipped with it in and produced a
   +0.16 result that was pure drift.
2. **Winners re-scored on the canonical trial.** The 3-direction, 40 s trial
   *ranks*; nothing is quoted until re-scored at 6 directions × 90 s against the
   tank's own 8 cm beacon.
3. **No spin collapse.** Champion cruise speed at the end must not be below the
   founder's.
4. **The prediction in §1.2 checked, not just the direction.** ≈ 0.20 cm per
   generation, ≈ 0.95 cm from the founding step. A result far above that is a
   result about the landscape and should be reported as one.

### 5.2 Results — run 1, seed 1

`node tools/_zbreed.mjs 20 12 3 40 both 1`, 3 lines × 12 × 20 generations, both
arms, 40 s trials, ~45 minutes wall. Full log in `tools/_zbreed_run1.txt`.

**The headline, and it is the thing the constraint was supposed to make
impossible.** Winners re-scored on the canonical trial — 6 directions × 90 s at
the tank's own 8 cm beacon:

| arm | closedCm | cruise | **arrives** | dwell | in-plane / out |
|---|---|---|---|---|---|
| score, all three lines | 5.109 | 0.688 cm/s | 0.33 | 0.181 | 3.64 / 6.49 |
| null L0 | 5.917 | 0.522 | 0.33 | 0.238 | 6.06 / 6.42 |
| null L1, L2 | 6.131 | 0.616 | **0.83** | 0.228 | 5.31 / 6.55 |

**From random founders, with no authored stock, a lineage arrives within 1.5 cm
of an 8 cm beacon in five of six directions — including the two placed ninety
degrees out of its own steering plane.** `HANDOVER-STEERING.md`'s Gate 4, run on
the authored library, was 5 of 56 cells. Cruise rose from 0.017 cm/s (the random
median) to 0.62–0.69 cm/s, which is above the authored `eel`.

The constraint is affordable. It does not need eels; it needs a wider draw and
twenty generations.

**Gate 1 — FAILED. 0.84×, against a pre-declared ≥ 2×.** The null arm's
best-ever animal beat the score arm's. Not re-thresholded, not explained away.

**Gate 2 — response over the founder.** Best-ever per line against its own
generation-0 best:

| | L0 | L1 | L2 |
|---|---|---|---|
| score | 1.29× | 1.77× | 3.26× |
| null | 1.53× | 2.32× | 4.25× |

The null arm wins here too.

**And the statistic that goes the other way, reported as the post-hoc
observation it is rather than as a rescue of the gate.** Median `closedCm` of the
final generation, across the three lines:

| | | | | mean |
|---|---|---|---|---|
| score | 1.161 | 0.729 | 1.965 | **1.285** |
| null | 0.062 | 0.047 | 0.059 | **0.056** |

**Selection moved the population by 23×. It did not move the best animal.**

### 5.3 Why, and the three fixes it forces

This is a coherent result and it is the mechanism §1.2(d) predicted, observed.

1. **Truncation selection destroyed the divergence that crossover runs on.** The
   score arm converged — all twelve slots in a line become one animal's family —
   so every crossover in it is a cross between near-identical parents and
   contributes nothing. It is running on mutation alone: 57% neutral, small
   steps. The null arm keeps random parents, stays diverse, and its crossovers
   are the never-neutral, double-step operator. §1.2(d) says one recombination
   event between diverged parents carries as much variance as the whole founding
   draw, and this is what that looks like from the other end.
   → **Fix: selection must be diversity-preserving.** Cap how many parents may
   come from one family, or penalise by genome distance, or use within-family
   selection — the standard livestock answer, which halves the rate of
   convergence for the same response.
2. **The stall detector fired continuously and merged the lines.** 13 outcross
   events in the score arm and 14 in the null arm over 20 generations, i.e. every
   line was stalled essentially always, so an occasional rescue became permanent
   gene flow. All three score lines returned **the same animal**. Line
   independence — the entire reason for having lines — was destroyed by the
   mechanism meant to protect the lines from stalling.
   → **Fix: `STALL_GENS` 3 / `STALL_EPS` 5% is far too tight, and a donor must be
   refused if it is already in the line's ancestry.** The real fix is §7.1:
   fire the outcross on measured *divergence*, not on a plateau.
3. **"Best-ever" cannot separate a converged arm from a diverse one.** It is a
   maximum over an equal number of evaluations, and a diverse arm samples more
   distinct regions, so it wins the max while losing everywhere else. The gate
   was pre-declared on it and it failed on it; but the primary statistic for the
   next run should be the population median, with best-ever alongside.
   → **Fix: declare both, in advance, and require the median.**

Run 1 also executed the **defective outcross donor rule** documented in
`outcrossPartner()` — it picked the ark's fastest wanderer (`closedCm = −0.111`)
for three different lines and re-picked it after every stall. Both rules are
repaired in the tool; run 1's numbers are from before the repair and are labelled
as such.

**What survives all of this.** The objective, the two culling levels, the wide
founding draw, the ratchet, the ark, and the no-authored-stock constraint all did
their job — a random-founded lineage reaches the tank's own task. What failed is
the *population management*: the run converged, and then the outcross merged what
was left.

### 5.4 Results — run 3, seed 3, with all four fixes

`node tools/_zbreed.mjs 20 12 3 40 both 3`, same shape as run 1, ~41 minutes.
The four changes between the runs are the family cap, the median-based stall
test, the outcross cooldown, and the foreign-donor rule.

| | run 1 | **run 3** |
|---|---|---|
| **Gate 3 — population median vs null** | 23× | **64.8×** ✓ |
| **Gate 2 — response over founder, score** | 1.29 / 1.77 / 3.26× | **2.75 / 3.55 / 2.87×** |
| Gate 2 — response over founder, null | 1.53 / 2.32 / 4.25× | 1.67 / 4.59 / 2.39× |
| **Gate 1 — best-ever vs null** | 0.84× | **0.96×** ✗ (still short of 2×) |
| distinct animals returned by the 3 lines | **1** | **3** |
| outcross events, score arm | 13 | **6** |
| distinct families surviving in a line at gen 20 | (not measured) | 3–4 of 12 |

**Line independence is restored.** Run 1's three score lines returned literally
the same animal. Run 3's returned three different ones, and the stall detector
fired half as often with donors that were genuinely complementary — the outcrosses
that fired were onto animals with reach 8.1 and 10.1 cm against stalled champions
that could not travel.

**The score arm now wins the response measure** on two of three lines and is far
more consistent (2.75–3.55× against the null's 1.67–4.59×), which is what
selection is supposed to look like against a lucky random walk.

**Gate 1 still fails, and the reason is structural rather than fixable by
tuning.** Both arms share generation 0 and both keep an ark, so best-ever is a
maximum over an equal number of evaluations; a diverse arm samples more distinct
regions and wins the max while losing everywhere else. In run 3 the score arm's
best-ever is 96% of the null's while its *population* is 65× better. **Gate 1 is
retired as a discriminating test and Gate 3 replaces it**, with Gate 1 still
printed so the tie is visible rather than hidden. That is a change to the
instrument, declared here, not a re-threshold of a failed result.

**And the animal — but read §5.5 before crediting it to selection.** Score line 2
returned `Euryprotea dentinodata`:

    closedCm 6.871 of an 8 cm task   arrives in 6 of 6 directions   dwell 0.391
    in-plane 7.49 / out-of-plane 6.23   cruise 0.077 cm/s

Six of six, including both placements ninety degrees out of its own steering
plane, and it *stays*: 39% of the trial inside two capture radii, against run 1's
best at 23%. It is also slow — a fifth of run 1's winner's cruise — so it is not
solving the task by being fast.

**It was also never bred, and that is §5.5.**

### 5.5 CORRECTION — how much of this was selection, and how much was the draw

`origin.generations` is incremented by exactly one line in the codebase:
`breed()`'s live-birth counter in `makeOffspring`. So `generations: 0` means an
animal never went through a reproductive event — it is a founding draw, a
founding mutant, or an **N17 stranger**, the fresh random genome that
`breed()` puts into `max(1, round(N/6))` slots every generation.

Audited across both arks, that is not a footnote:

| | run 1 | run 3 |
|---|---|---|
| ark animals never bred | **27 / 39** | **30 / 40** |
| deepest lineage | 13 births | 13 births |
| **top scorer bred?** | yes, 7 births deep | **NO — `generations: 0`** |

**Run 3's headline animal walked in as a random stranger at generation 17.** Line
2's best went 1.19 → 2.69 in the generation it appeared, and it carries no
births at all. Run 1's leaders are genuinely bred (7, 1, 8, 13, 8, 9 births
deep), so run 1's result stands as written; **run 3's top line does not, and the
statement "the programme bred it" was wrong.**

The best genuinely bred animal in run 3's score arm is `291b8a3e7b72fe18` —
6.208 cm closed, arrives in 2 of 6, dwell 0.279, six births deep, no authored
ancestor. That is the number run 3 is entitled to quote, and it is still ahead of
the null arm's best bred animal on the response measure.

**The confound, stated plainly.** At population 12 the stranger slot is 2 of 12
per line per generation. Over 3 lines and 20 generations that is **120 fresh
random draws per arm** — five times the 24-candidate founding shortlist. A run
structured like this is a breeding programme *and* a large random search sharing
one ark, and nothing in it separated the two. Every arrival-rate and best-ever
figure in §5.2 and §5.4 is a figure for the pair, not for selection.

**This does not touch Gate 3**, which compares population medians: a stranger
that is not selected does not enter the next generation, so the median is a
statement about what the arms bred. It is precisely the best-ever statistics —
Gate 1 and Gate 2 — that the stranger slot contaminates, which is a third
independent reason to prefer the median.

**Three fixes, none applied yet:**

1. **Report `origin.generations` on every champion.** Implemented in
   `_zbreed.mjs`'s verdict — a champion that was never bred now says so on the
   line it is printed on. This should have been there from the first run.
2. **Score the stranger slot as its own arm.** The random draws are already being
   evaluated; tallying what fraction of the ark and of each generation's top
   quartile they supply costs nothing and turns a confound into a measurement.
3. **Consider lowering the immigration rate for measured runs.** N17's 1-in-6 is
   a rule about keeping a *player's* six-slot tank from going stale (20 §3), and
   carrying it to a 20-generation experiment imports a random search the
   experiment did not ask for. The rate is right for the game and wrong here.

---

## 6. Surviving a genome change — the ark as instrument

This is the part that makes the methodology durable rather than a description of
one run, and it is what animal breeding uses a **control population** and a
**genetic base** for: to separate genetic gain from a change in the measuring
environment.

`tools/_zbreed_ark_<seed>.json` stores every champion, serialised, with the
`GENOME_V` it was minted under. **After any change to `GENOME_V`, `BRIDGE_V`, the
world, the actuator or the probe set:**

1. Re-score the entire ark on the current build.
2. **Rank correlation, old scores against new.** Spearman ≥ 0.9 → the metric
   still means what it meant, and the score history stands. Below 0.9 → **it does
   not**, and every number quoted before the change must be re-derived or
   retired. This is the check whose absence has silently invalidated score
   histories across three genome bumps.
3. **Regress new on old** to get the affine rebase, so the history can be
   replotted on one scale rather than thrown away.
4. The ark is also the founding stock for the next programme — which is the one
   place authored-free purity is preserved *and* progress is not lost.

Two known ways a bump breaks a metric, both already recorded in this tree: a new
gene arriving at a neutral value is **unreachable by mutation** for tens of
generations (`preyGain2`: σ = 0.10, drawn once per ~23 mutations, ~36 generations
at population 16), so an A/B run shorter than that measures nothing; and a probe
measured at a saturated operating point measures the mechanism at the point where
it stops working (`S3` at `turnBias = ±1.0`).

---

## 7. Open, and the order to take them

1. **Measure divergence, and make the outcross fire on it rather than on a
   stall.** §1.2(d) says crossover's value is proportional to how different the
   parents are, and nothing in the loop currently measures that. A genome-distance
   metric would let a line be crossed *before* it plateaus, and would tell the
   stall detector whether an outcross can possibly help. **Highest value of
   anything here**, because it is the mechanism the whole structure rests on.
2. **Crossover within a line, not just between unrelated draws.** Every
   recombinant figure in §1.2(d) is from *unrelated* parents — an upper bound.
   Re-run `_zherit.mjs … recombinant` on pairs drawn from a converged line to get
   the number that applies inside the loop.
3. **Sweep the selected proportion.** `0.5 × 1/3 ≈ 1/6` is harder than
   Robertson's optimum and is defensible only if the ark and recombination
   regenerate the variance. Test `p` ∈ {1/6, 1/3, 1/2} at fixed budget.
4. **Reciprocal recurrent selection.** Select lines on how well their *crosses*
   perform rather than on the lines themselves — the technique behind hybrid
   maize, and the natural structure now that §1.2(d) shows the cross is where the
   variance comes from.
5. **Lines: how many, and how big?** Three is Denis's number and `_zwild2`'s. The
   clonal-interference argument says more, smaller lines up to the point where a
   line is too small to hold a beneficial mutation.
6. **Does the ratchet reach 8 cm from random founders at all**, or does the
   locomotion rung need its own dedicated budget first?
7. **Station-keeping.** `dwell` is measured and unused. It needs a rung where
   something arrives.
8. **Is truncation selection actively harmful here?** §5.2 records the score arm
   converging while the null arm, which keeps random parents, retained diversity
   and produced good animals by drift. If that reproduces across seeds it is an
   argument for a diversity-preserving selection rule — tournament with a
   distance penalty, or explicit within-family selection, which halves the rate
   of convergence for the same response and is standard livestock practice.

---

## 8. Standing rules

One per recurring failure in §1.4. These are the part meant to survive genome
changes and increasing intelligence.

**R1 — Score the outcome, never a kinematic proxy for it.** If compute forces a
proxy, prove Spearman ≥ 0.5 against the outcome at n ≥ 15 first, and re-prove it
after every genome change. `turnCapability` was anti-correlated with arriving.

**R2 — Every objective is control-subtracted against an information-ablated arm
on identical geometry.** Same body, same settle, same targets, no sense. This is
the rule that generalises to any level of intelligence: as controllers get
smarter, add ablation arms (sensor scrambled, delayed, ablated) rather than
inventing new proxies.

**R3 — Every objective has a cheat detector, and a cheat scores −∞, not 0.**
Bodies that come apart sweep at the speed ceiling and report fiction; one such
creature reported 7864 g against 31–49 g for its rivals.

**R4 — One exam per generation, in absolute units.** Never normalise the task to
the individual. If the task must change, ratchet it monotonically and re-score.

**R5 — Measure `b` before selecting on a new trait.** `b/se < 2` means it is not
a trait yet. `p₊ = 0` means no mutation can reach it and no number of generations
will help.

**R6 — Both arms of a comparison share the random stream, and the arm name is
never in the key.** Common random numbers; a paired control or none.

**R7 — One zygote per reproductive event wherever selection is measured.**
Re-rolling a dead child pays every lineage's mutational load uniformly and erases
selection for developmental robustness.

**R8 — Keep the animals, not the scores.** Nothing selected is ever discarded;
the ark is both the outcross stock and the cross-version instrument.

**R9 — The cheap trial ranks; the canonical trial reports.** Nothing is quoted
until re-scored on the full direction set at full length.

**R9b — Check `origin.generations` before crediting a result to selection.**
A run that includes immigration is a breeding programme and a random search
sharing one ark. An animal with `generations: 0` was never bred, however good it
is and whatever generation it was found in. §5.5 — this was missed once, on the
headline animal of the run that was supposed to validate the method.

**R10 — No authored stock in a discovery claim.** A run founded on authored
animals shows that selection improves competent founders. Both results are worth
having; neither is quoted as the other.

---

## 9. Running it

```bash
# Is a trait worth selecting on at all? (R5)
node tools/_zherit.mjs 40 4 40 4.5 clonal
node tools/_zherit.mjs 40 4 40 4.5 recombinant

# The programme. `both` runs the paired null arm; `score` alone is half the cost.
node tools/_zbreed.mjs 20 12 3 40 both 1

# Establish the cross-version baseline — BEFORE the next schema bump, not after.
node tools/_zark.mjs tools/_zbreed_ark_1.json --stamp
# ...and after it:
node tools/_zark.mjs tools/_zbreed_ark_1.json
```

`_zbreed` checkpoints every generation and resumes exactly: the rng is a pure
function of the seed, the line and the generation, so continuing at generation N
produces byte-identically what an uninterrupted run would have. Widen the
founding draw with `ZB_PROSPECT` / `ZB_TRIAL`.

---

## 10. The path into the app

Nothing here needs to stay offline. The mapping, in order of cost:

| protocol element | where it goes | what is missing |
|---|---|---|
| the objective | `engine/l2/objective.js` alongside `netSpeed`/`size`/`span` | a headless beacon trial. `tools/_zbeacon.mjs` is already "the `vivarium.js` beacon loop verbatim", so the arithmetic exists |
| **the ark** | **the Atlas already is one.** Records are keyed `specimen:<genomeHash>` and persist | store `canonCm` and the build stamp (`GENOME_V`, `BRIDGE_V`, `faunaVersion`) on the record. Then §6's re-score is an Atlas maintenance pass, and it is the same pass that already re-renders stale portraits |
| two culling levels | `autoBurst` (`objective.js`) currently selects on one scalar | a second, prior cull on reach |
| the ratchet | the beacon's placement radius | it is already a distance in the screen; make it monotone and per-lineage |
| lines | three saved lineages, or a `line` field on the lineage record | the tank holds one population of six |
| **the stall detector and outcross** | this is the one that becomes a *feature* rather than a setting | "this lineage has not improved in three breeds — here are three Atlas specimens strong exactly where it is weak." Import already exists; the ranking is `outcrossPartner()` |

The last row is worth building first even without the rest. It turns the ark
from a scrapbook into the thing that unblocks a stuck player, and it is the step
of Denis's own protocol that the app currently makes him do by memory.

---

## 10b. Can an eel happen by itself? — the theory, before the run

`tools/_zspine.mjs` (600 draws) and `tools/_zeel.mjs` (400 draws). An eel is two
separate things and they are drawn by different parts of the generator.

**The CHAIN happens spontaneously and is not rare.** 70% of draws carry a
self-connection, 61% on the axial face, **12.3% reach a run of 4** and 2.7% reach
6; 27% of those are viable. So roughly **one draw in twenty to thirty is a viable
four-segment chain** — a 1200-draw prospect found 133 chains and 66 usable ones.
The embryo is already in every founding pool the programme has ever drawn.

**The WAVE is structurally guaranteed and quantitatively crippled.** On a spine
every segment is the *same node*, so `computePhases`'s accumulation
`phase[j] = phase[parent] + phaseLag` advances linearly down the body: a drawn
chain is a travelling wave by construction, with wavenumber `phaseLag`
rad/segment. But:

| | |
|---|---|
| the factory draws | `phaseLag ~ U[−0.32, +0.32]` (`RANGE.phaseDeviation`) |
| mutation may reach | `[−π, +π]` (`RANGE.phaseLag`) |
| the authored eel is | **π/2 = 1.571** |

Measured on drawn chains: median \|phaseLag\| **0.150**, max 0.308, **total phase
across the whole body 0.54 rad against the eel's 7.85**. Zero of 42 drawn chains
exceed 1.0 rad. **The generator can draw the body but not the gait.**

**Deepening the wave helps — modestly on the mean, enormously on the tail.**
Sweeping `phaseLag` on ten drawn chains with every other gene untouched:

| lag | 0.00 | 0.16 | 0.32 | 0.60 | 1.00 | 1.57 | 2.20 | 3.14 |
|---|---|---|---|---|---|---|---|---|
| mean cruise cm/s | 0.0765 | 0.0752 | 0.0780 | 0.0801 | 0.0843 | **0.0887** | 0.0866 | 0.0838 |

1.14× from the best drawable lag to the best anywhere — but **9 of 10 chains have
their own optimum outside the draw's reach**, and one chain went 0.030 → 0.127
(4.3×). Selection acts on the tail, not the mean, so 1.14× understates it.

**The blocker is reachability, not value.** Walking \|phaseLag\| from a drawn
value to 1.0 rad took a **median of 354 mutations, and only 2 of 60 walks got
there inside 400** — about 177 generations of one lineage at `breed()`'s 1–3
mutations per offspring. This is the `preyGain2` trap exactly (§1.4): a gene
whose value is real and whose reach is not.

**And chains dissolve faster than they extend.** `_zspine`: half-life **8
generations**, 28% surviving at 20 against A2's 50% target, and **49% of the
kills are `removeConnection` deleting the self-edge**.

### Pre-declared prediction for the run in §12

Founding on drawn chains and selecting on `closedCm`, expect: **the chain erodes
(median run falls, spine count drops), `phaseLag` does not move measurably, and
whatever speed is gained comes from somewhere else.** If that is what happens,
the eel is not reachable by breeding as the generator currently stands, and the
fix is one of two one-line changes — draw spine `phaseLag` from the full range
rather than from `phaseDeviation`, or give it a dedicated operator — both already
justified by the 9-of-10 measurement above. If instead the chain holds and the
lag climbs, this prediction is wrong and the reachability figure was measured on
the wrong walk.

## 10c. The eel run — the prediction held on the gait and failed on the body

`ZB_FOUNDERS=spine ZB_PROSPECT=1200 node tools/_zbreed.mjs 20 12 3 40 both 7`.
1200 draws → 133 chains (11.1%, matching §10b) → 66 through the cheap screen.
Three lines founded on drawn chains, no authored stock. Full log in
`tools/_zbreed_eel.txt`.

**The gait: predicted exactly.** Maximum \|phaseLag\| anywhere in any line, in any
generation of either arm, stayed between **0.10 and 0.29 rad** — it never once
left the draw's own ±0.32 band in 20 generations. §10b's reachability figure
(median 354 mutations) said it could not, and it did not.

**The body: the prediction was wrong, and usefully.** The chain did *not*
uniformly erode. The score arm's line 1 champion is a **five-segment chain, nine
births deep** — `Streptorthohydra longicorpissima`, 5.834 cm closed, cruise 0.329
cm/s — so a spine can be carried through nine live births under selection. Lines
0 and 2 lost theirs (champions at chain 1), and per-generation spine counts swung
hard (10 → 0 in one line, 1 → 8 in another). So the honest statement is **the
chain survives selection in some lines and not others**, not `_zspine`'s flat
8-generation half-life, which was measured under mutation with no selection
pushing back.

**Gate 3: 4.34×** (score 0.421 vs null 0.097). Gate 1: 0.97×, the same structural
tie as before. **Only 5 of 30 animals in the score ark were bred** — the stranger
slot again supplying most of the shelf (§5.5).

### The conclusion, and it is a one-line fix

**An eel's BODY is reachable by breeding today. Its GAIT is not.** The chain is
drawn at ~11%, survives nine births under selection, and needs nothing new. The
wavenumber is drawn at a fifth of what the animal needs and mutation reaches it
in ~354 draws, so no run of an affordable length will ever find it.

The fix is in the generator, not in the breeding: **draw a spine edge's
`phaseLag` from `RANGE.phaseLag` rather than from `RANGE.phaseDeviation`.** The
narrow band is right for a general joint — a per-node independent draw of a full
circle is noise — but a spine's repeats all share one lag, so on a chain that
same number is not deviation, it is *wavenumber*, and the two want opposite
ranges. That is the same class of finding as `spineAxialRate`: a constant that is
correct for the general case and wrong for the one the sub-grammar exists to
make. It belongs beside the other three spine constants in `SLICE_LIMITS`.

Not applied here: it is a change to what every creature in the game is drawn
from, the evidence for it is 10 chains, and §7's list is already long.

## 10d. The joint limit — the cap is not the defect, the product is

`tools/_zjoint.mjs`, 300 draws, 12 subjects, every driven joint set to one
absolute limit with everything else untouched.

**What the corpus actually swings.** The commanded stroke is
`amplitude × angleLimits[0]`, a product of two independent uniforms —
`amplitude ~ U[0,1]` and `angleLimits ~ U[0, π/2]`:

| | p10 | median | mean | max |
|---|---|---|---|---|
| stroke half-amplitude, rad | **0.005** | **0.105 (6°)** | 0.183 | 1.212 |

The authored eel is `0.8 × 0.9 = 0.720 rad (41°)`. **88% of drawn joints swing
less than half of that, and the p10 joint swings a third of a degree** — a
revolute joint wearing a rigid one's behaviour. A cap of 90° is generous; a
product of two uniforms is what makes the corpus barely bend, and those are
different defects with different fixes.

**The cap does bind for cruise, though.** Mean cruise by limit:

| limit rad | 0.20 | 0.40 | 0.60 | 0.90 | 1.20 | **1.571 (cap)** | 2.00 | 2.60 | 3.14 |
|---|---|---|---|---|---|---|---|---|---|
| mean cm/s | 0.0205 | 0.0240 | 0.0254 | 0.0294 | 0.0320 | **0.0357** | 0.0451 | 0.0478 | **0.0540** |

Monotone throughout. Best inside the shipped cap 0.0357, best anywhere 0.0540 —
**raising the cap is worth 1.51× on cruise, and 9 of 12 subjects have their own
optimum outside it.** Given §2.4 (3% of the corpus travels 4.5 cm in 40 s), a
1.5× on cruise is not a small thing.

**It does not carry to steering.** The shared-budget hypothesis — that the turn
command and the gait compete for one joint range — predicts that widening the
limit should buy goal closure. Re-run at the cap against π on the goal trial:
**mean delta −0.046 cm, 3 of 5 improved.** No signal at that n. The hypothesis is
not supported by this test and is not claimed.

### Three cautions, and they change the recommendation

1. **The optimum sits at the boundary of the sweep, which is a warning, not a
   result.** π rad is ±180°: `setLimits` then imposes nothing and the joint can
   fold through itself. That is exactly the "barber-pole spin that made jointed
   creatures read as non-physical" which `RANGE.twistLimit` was *narrowed* to
   0.35 to stop. Speed bought by an anatomically absurd joint is speed the game
   should probably decline.
2. **2.0 rad (115°) already gets most of it** — 0.0451 against the cap's 0.0357,
   1.26× — without a joint that can close on itself.
3. **n = 12 subjects, one seed.** Direction is clear, magnitude is not.

### The recommendation, in order of confidence

**First, raise the FLOOR of the limit draw, not the ceiling.** The measured
defect is 88% of joints under half the eel's stroke and a p10 of 0.3°, and that
is caused by the bottom of `U[0, π/2]`, not the top. A `SLICE_LIMITS` band with a
non-zero floor — the same shape as `spineScale` and `twistLimit`, both of which
narrowed a schema range for a measured reason — targets the defect directly,
produces no absurd joints, and needs no schema change because every drawn value
stays inside `RANGE.angleLimit`.

**Second, and separately, test a ceiling of ~2.0 rather than π/2.** Worth 1.26×
on cruise on this evidence, and it is a `RANGE` change, so it is a schema
decision rather than a config one.

**Do not raise the amplitude draw to fix this.** It is the other half of the same
product, but `amplitude` is what selection uses to turn a joint off, and
compressing its low end removes a degree of freedom the controller genuinely
uses.

## 10e. The joint-limit A/B — the floor wins, the ceiling does not pay on its own

Four arms, 20 generations x 3 lines x 12, score arm only, same seed and the same
draw sequence — so generation 0 is the *same genomes* differing only in what
bending joints were drawn with. Twist joints untouched in every arm.

| arm | band | med closedCm | ÷ task | response | task reached | spines/line | **best BRED, canonical** |
|---|---|---|---|---|---|---|---|
| control | [0, 1.571] | 0.557 | 0.113 | 1.88× | 4.91 | 1.3 | **1.610** |
| **floor** | [0.35, 1.571] | 0.570 | 0.127 | 2.81× | 4.50 | 1.0 | **5.297** |
| ceiling | [0, 2.0] | 0.532 | 0.105 | 2.55× | 5.05 | 0.7 | 1.526 |
| **both** | [0.35, 2.0] | **4.798** | **0.600** | **5.34×** | **8.00** | **5.7** | **5.340** |

**⚠ The median column is confounded and the canonical column is not.** The
ratchet is population-driven, so a better arm faces a harder exam — `both`
finished at the tank's own 8 cm while control was still at 4.91, and `closedCm`
is bounded by the task. The `÷ task` column normalises for it (the effect
survives: `both` is still 4.7× control) but the honest comparison is the last
one, where all four are re-scored on **one fixed exam**: 6 directions × 90 s at
8 cm.

**On that fixed exam the finding is clean, and it is the floor.**

- **floor 5.297 against control 1.610 — 3.3×.** A floor under what a bending
  joint is drawn with is worth more than tripling the best bred animal.
- **ceiling 1.526 — no better than control**, and its ark contains **zero bred
  animals**, so nothing it produced came from the programme at all.
- **both 5.340 — 1% over floor alone.** The ceiling adds essentially nothing to
  the champion once the floor is there.

**`both` does look better for the POPULATION**, though: 4.7× the normalised
median, 5.7 spines per line against 1.0, and it is the only arm that drove the
ratchet to the terminal 8 cm task. So the two statistics disagree — the champion
says "floor is enough", the population says "the pair is better" — and at one
seed per arm that disagreement is not resolvable.

**Recommendation, and the asymmetry in cost decides it.**

- **Ship the floor.** `SLICE_LIMITS.revoluteLimitBand = [0.35, RANGE.angleLimit[1]]`
  is a **config change**: every drawn value stays inside the schema range, no
  migration, no stored genome invalidated, and `factory.js` already takes the
  band (added for this experiment, defaulting to the current behaviour exactly).
- **Do not move the ceiling yet.** It requires `RANGE.angleLimit` to change,
  which is a schema decision that invalidates every stored genome's validation
  bound; it buys 1% on the champion; §10d's sweep found its optimum at the
  *boundary* of the swept range, where a joint can fold through itself — the
  failure `RANGE.twistLimit` was narrowed to 0.35 to prevent. If the population
  result is real it is worth revisiting, but it wants 2–3 seeds first.

**A defect this A/B found by dying of it.** The first floor arm crashed on
`validateGenome`: `RANGE.angleLimit` is checked against **every** joint including
twist, whose own band is the subrange [0, 0.35], so raising the schema floor
invalidates every twist joint in the corpus at once. That is why the floor is a
`SLICE_LIMITS` band and not a schema edit, and the reasoning is recorded at the
draw site in `factory.js`.

Neither change is applied to the shipped defaults. `factory.js` carries the band
and ignores it unless it is set.

## 10f. THE CAMPAIGN — a segmented plan, run in stages rather than in one block

**The priority order asked for**: beacon-seeking first (it is the one that
demonstrates perception AND orientation), then viability, then speed, then food
taken on the way. Viability is not a culling level — a creature that will not
build is never scored — so what remains is three levels, applied in order by
`ZB_METHOD` rather than weighted against each other.

**Shared settings, all from measurements in this document.**

| | | why |
|---|---|---|
| `ZB_ANGLE_MIN=0.35` | on every arm | §10e: 3.3× on the best bred animal, config-only |
| `ZB_PROSPECT` 400 (1500 for spine arms) | wide founding draw | §1.2(b): the founding draw is worth ~4 generations |
| `SECONDS=25` | short trials | the cheap trial ranks; §5.1 R9 re-scores winners at 6×90 s |
| pop 12 × 3 lines, family cap 2 | | §5.3: plain truncation starves recombination |
| score arm only | no paired null | the arms are each other's controls; a null arm would double the cost for a comparison §5.4 already made |

**The four methods and the sixteen runs.**

| method | levels, in order | seeds |
|---|---|---|
| `seekfirst` | closedCm → speed | 101–104 |
| `forage` | closedCm → grams eaten *(food field in the trial)* | 111–114 |
| `dwell` | closedCm → station-keeping | 121–124 |
| `seek` (control) | reach → closedCm — the validated protocol | 131–132 |
| `seekfirst` + `ZB_FOUNDERS=spine` | as above, founded on drawn chains | 141–142 |

**Segments.** Every run checkpoints per generation and resumes exactly (§9), so
the campaign is run in stages and reviewed between them rather than waited out.

1. **Segment 1** — all 16 to generation 10. Review; drop the dead.
2. **Segment 2** — resume the survivors to generation 22.
3. **Segment 3** — score every BRED champion from every ark on the canonical
   trial, pick 5–10, promote them as labelled champions.

## 10g. THE CAMPAIGN — what it produced

Sixteen runs, four methods, 22 generations each, in three reviewed segments.
Every run resumed exactly from its checkpoint at generation 11 (§9).

**Method ranking**, mean normalised population median (Gate 3's statistic):

| method | ÷task median | response | bred/ark | spines/line |
|---|---|---|---|---|
| **forage** | **0.206** | 4.73× | 8.0 | 4.1 |
| **dwell** | 0.189 | **5.32×** | **8.8** | 1.8 |
| seek (control) | 0.161 | 2.42× | 5.0 | 2.3 |
| seekfirst | 0.112 | 3.06× | 4.5 | 0.3 |
| spine founders | 0.104 | 2.98× | 5.0 | **9.8** |

**The finding that matters for the method, and it vindicates the original
ordering.** `seekfirst` — rank on perception first, speed only as a tie-break —
is the WORST arm, below the `seek` control that culls on reach first. That is
§2.4's prediction confirmed: a population that cannot travel has no seek
gradient to rank on. **But `forage` and `dwell`, which are `seekfirst` plus a
third culling level, both beat the control.** So the seek-first ordering is not
wrong in itself; it is wrong with only two levels. A third trait to break the
ties among the good aimers is what makes perception-first work.

**The spine arms held chains at 9.8 of 12 slots** against 0.3–4.1 elsewhere, and
still produced bred champions — so a coherent segmented body plan survives
selection when the founders carry it, which is §10c's result at four seeds
instead of one.

**The champions.** `tools/_zchampions.mjs` reads the canonical scores each run
already stored (6 directions × 90 s at the tank's own 8 cm beacon), takes only
BRED animals, and picks one per niche and one per binomial:

| niche | closedCm | arrives | dwell | cruise | in/out plane | run | births |
|---|---|---|---|---|---|---|---|
| **seeker** | **7.89 / 8** | **6/6** | 0.67 | 0.040 | 7.8 / 7.9 | 1 | 9 |
| **arriver** | 7.46 | **6/6** | 0.62 | 0.113 | 7.9 / 6.8 | 2 | 12 |
| **station-keeper** | 7.32 | **6/6** | **0.65** | 0.217 | 6.8 / 7.6 | 5 | 2 |
| spined | 4.53 | 1/6 | 0.04 | 0.376 | 5.3 / 4.1 | **7** | 7 |
| sprinter | 3.25 | 3/6 | 0.21 | **0.478** | 1.6 / 3.4 | 3 | 14 |
| out-of-plane | 4.70 | 3/6 | 0.23 | 0.160 | 2.4 / **7.7** | 3 | 7 |
| in-plane | 4.43 | 3/6 | 0.21 | 0.402 | **7.1** / 1.4 | 6 | 1 |
| runner-up | 6.97 | **6/6** | 0.29 | 0.028 | 6.3 / 7.3 | 1 | 5 |

**Four of eight arrive in all six directions and close better than 7 of the 8 cm
task.** The best previous animal in this document closed 6.87 and was never bred;
these are 9, 12 and 2 births deep with `origin.founder: null`.

**A defect this list found by producing it.** The first cut returned **five
`Macroprotea torticorpata` in eight slots** — different hashes, so a hash filter
admitted them all; siblings of one line, so the shelf was one animal wearing five
labels. Champions are now de-duplicated by BINOMIAL as well, because a shelf is
only worth having if §4.7's outcross can find something in it that is strong
where a stalled line is weak.

## 10h. STEPPING BACK — where the roadmap actually stands

### Did we enlarge perception? No.

We enlarged what a creature **does with one bearing**. We did not enlarge the
bearing.

The beacon loop's sensor is `bearingTo` → `sensorTurnBias`, and
`controller.js:176` already names it: **the omniscient compass**. Unlimited
range, no occlusion, no noise, no latency, no field of view, and no distance —
`brakeGain` was deliberately built to read `|bearing|` only *because* "no
creature in this project has a range sense".

The genuinely receptor-mediated sense exists and is not what we bred on:
`sites` with position and outward normal, `senseAt` reading local concentration
through `forageStep`'s own spatial grid with a **finite** `SENSE_REACH` of 6 cm,
`chemoGain`, and a bit-identical blind control. Mutation reaches it — 40/40
lineages acquire a site and a non-zero gain within 200 mutations, median 53.
**Its Phase 2 gate failed** (−0.087 g mean control-subtracted, 3 of 16 helped)
and has not been re-run since. `proprioGain` still ships inert at 0. The second
steering channel came out roughly neutral.

> **And the failed gate deserves a retry rather than a headstone.** It was run on
> a corpus whose median blind excursion is 0.6 cm in 40 s (§2.4). A creature that
> cannot travel cannot act on a concentration gradient, so that gate measured
> "can these animals move" as much as "does the receptor work" — the same
> confound that broke the seek objective in §5.3. The champions travel now.

### Have we nailed perception, locomotion, direction?

| | verdict |
|---|---|
| **Direction / orientation** | **Yes, within the compass assumption.** Four of eight champions arrive in 6 of 6 directions, closing 7.89 of an 8 cm task, dwell 0.65, control-subtracted on the canonical trial, bred from random founders with no authored ancestor. It is the strongest result in this project. |
| **Locomotion** | **No — much better, and the largest known lever is unshipped.** Cruise went from a random median of 0.017 cm/s to 0.478 in the sprinter champion. But §10e's joint-limit floor (3.3× on the best bred animal) is measured and **not applied**, and §10b's eel gait is unreachable by mutation. |
| **Perception** | **No, and not close.** Nothing bred in this campaign used a receptor. |

### Can we move to co-evolution, survival and ecology? Not yet — and the
### obstacle is not what the handover says it is.

`tools/_zduelchamp.mjs` runs the **shipped** duel harness over the champions with
a random pool as control, in one process:

| | captures | stalemate | separation clamped |
|---|---|---|---|
| random corpus | **0 / 84** | 84 | **84 / 84** |
| campaign champions | **0 / 84** | 84 | **84 / 84** |

`HANDOFF.md` diagnosed C2 as *"C2 needs pursuit, pursuit needs orientation, and
orientation is the open problem… LOCOMOTION IS NO LONGER THE BLOCKER; AIMING
IS."* **That diagnosis is wrong, and it is wrong the same way its predecessor
was.** At 0.2 °/s aiming was impossible — but so was arriving, and the second
failure hid behind the first.

The arithmetic, measured:

    requested separation   27 – 68 cm   (k x reach-sum, k in 2..5)  — CLAMPED, always
    duel duration          15 s
    ground a champion covers in 15 s    0.4 – 7.2 cm

**The duel asks for a 20–30 cm crossing in fifteen seconds from animals whose
best covers 7.2 cm.** For comparison, the beacon trial these champions win gives
**90 s for 8 cm** — the duel is roughly forty times harder by construction, and
no amount of aiming closes that.

The fix is the discipline this document already established for `_zgoal`: derive
the task from measured capability instead of from a spec constant. `GOAL_MIN_DIST`
is three capture radii *because arriving is a physical event*; `duelDuration` and
the separation should likewise come from cruise × window, not from reach × k.

### The order that follows

1. ✅ **DONE — the duel task is re-derived from measured cruise.** §10i.
2. ✅ **DONE — the joint-limit floor ships.** §10e; `SLICE_LIMITS.revoluteLimitBand`.
3. **Decide perception BEFORE co-evolution, not after.** This is the strategic
   one and it is the one left. Co-evolution on an omniscient compass will breed
   animals that exploit perfect information, and receptors added afterwards
   invalidate every one of them. Re-running Phase 2's gate on creatures that can
   now travel is the cheapest way to find out whether the receptor path is alive.

## 10i. THE DUEL TASK, FIXED — and C2's matrix is no longer all zeros

**Two changes, `BRIDGE_V` 8 → 9.**

`duelDuration` **15 → 90 s**, derived by `tools/_zduelfit.mjs` from the only
quantity that decides whether a duel can happen: `reachSum / (cruiseA + cruiseB)`,
the time a pair needs to close its own touching range. Below touching range the
duel measures the spawn, so a shorter window cannot produce a capture by any
amount of aiming.

| window | random pairs that can meet | champion pairs |
|---|---|---|
| **15 s (was)** | **0%** | **14%** |
| 30 s | 5% | 54% |
| 60 s | 15% | 89% |
| **90 s (now)** | 26% | **96%** |
| 120 s | 41% | 100% |

90 s admits 96% of champion pairs and is `GOAL_SECONDS` exactly, so the duel and
the beacon trial these animals were bred on pose tasks of comparable length
instead of differing forty-fold. The random corpus still mostly fails, and that
is correct — an unselected creature should not catch anything.

**Separation gains a ceiling at what the pair can cross**, `(cruiseA + cruiseB) ×
duelDuration`, and `duelSetup` now returns **`unreachable`** when even touching
range is beyond them. `wanted` was `k × reachSum` — a *size* — while whether a
duel is possible is a question about *speed*; the two were never reconciled and
the harness played out the difference as a stalemate. The bound is conservative
by measurement rather than by a fudge factor: `netSpeed` is a 6 s torus window
and the champions sustain ~1.8× it over 90 s.

**Result** (`tools/_zduelchamp.mjs`, same harness, random pool as control):

| | captures | cannot meet |
|---|---|---|
| random corpus | **0 / 84** | 63 / 84 |
| campaign champions | **4 / 84** | 3 / 84 |

Median time to capture 7.3 s, fastest 6.1 s. **C2's matchup matrix was all zeros
for three sessions; it is not any more**, and the new flag separates "the task
was impossible" from "the animal failed to catch" — a conflation that let an
impossible task read as a failure of the creatures.

**And the deadlock is closed.** `V1` asserts the three version files agree,
`build.js` is their only writer, and it refuses to write while the gate is red —
so any schema bump made the gate red and the only tool that could fix it would
not run. HANDOVER-STEERING hit this at `BRIDGE_V` 8 and escaped by hand-editing
the file V1 exists to protect. It recorded the fix; this session hit it again at
9, so the fix is now built: `node tools/build.js --bootstrap-version` mirrors the
schema versions and nothing else, leaving `app`/`build`/`commit` untouched so it
cannot be mistaken for a release.

## 11. What ran, and what it produced

**2026-08-11.** `GENOME_V 8`, `BRIDGE_V 8`, `faunaVersion 11`.

| tool | what it established |
|---|---|
| `_zherit.mjs … clonal` | n = 40 × 4. `b ≈ 1` for every trait; `R = b·S` holds at 0.93–1.12; 57% of mutations neutral; the founding draw is worth ~4 generations of mutation |
| `_zherit.mjs … recombinant` | n = 20 pairs × 4. `b = 0.545` for closure; **0% neutral**, `p₊ = 0.47`, double the step, one event ≈ the whole founding spread. §1.2(d) |
| `_zbreed.mjs 20 12 3 40 both 1` | 45 min. Random founders → a lineage that **arrives in 5 of 6 directions at the tank's 8 cm beacon**. Gate 1 failed at 0.84×; the population median went 23× the null; the three lines collapsed onto one animal. §5.2, §5.3 |
| `_zbreed.mjs 20 12 3 40 both 3` | 41 min, with the four fixes. **Gate 3 at 64.8×**, line independence restored, and a lineage that **arrives in 6 of 6 directions and holds station**. §5.4 |
| `_zark.mjs … --stamp` | every distinct animal from each run re-scored on the canonical trial and stamped as the cross-version baseline |

### 11.1 The arks — the animals this produced

Canonical trial, 6 directions × 90 s at 8 cm. `tools/_zark.mjs` re-scored 39
animals from run 1 and 40 from run 3; **0 failed to deserialise and 0 dropped out
of being subjects** in either.

**Run 3** (`tools/_zbreed_ark_3.json`), top five:

| canonCm | cruise | arrives | dwell | in-plane / out | name |
|---|---|---|---|---|---|
| **6.871** | 0.077 | **1.00** | **0.391** | 7.49 / 6.23 | *Euryprotea dentinodata* |
| 6.263 | 0.010 | 0.67 | 0.174 | 6.99 / 6.87 | *Oligosphalmatops subrobustilateratis* |
| 6.208 | 0.235 | 0.33 | 0.279 | 5.85 / 5.95 | *Euryprotea dentinodata* |
| 5.977 | 0.059 | 0.67 | 0.344 | 6.46 / 4.69 | *Dolichoprotea dentarticata* |
| 5.797 | 0.096 | 0.67 | 0.174 | 4.09 / 6.61 | *Isothetia denticorpissima* |

**Run 1** (`tools/_zbreed_ark_1.json`), top five:

| canonCm | cruise | arrives | dwell | in-plane / out | name |
|---|---|---|---|---|---|
| 6.131 | 0.616 | 0.83 | 0.228 | 5.31 / 6.55 | *Orthothetia denticaudissima* |
| 5.917 | 0.522 | 0.33 | 0.238 | 6.06 / 6.42 | *Orthothetia dentifibrissima* |
| 5.263 | 0.620 | 0.50 | 0.179 | 2.99 / 7.16 | *Orthothetia dentidorsissima* |
| 5.109 | 0.688 | 0.33 | 0.181 | 3.64 / 6.49 | *Orthothetia denticaudissima* |
| 2.972 | 0.238 | 0.67 | **0.390** | 3.55 / 2.14 | *Streptisohydra longifrontissima* |

**Read the two tables side by side and the diversity fixes are visible without a
statistic.** Run 1's top five are four *Orthothetia* and one other — one lineage
that swept. Run 3's are five different genera. Same budget, same objective, same
number of evaluations; the difference is the family cap and the outcross rules.

**And the two runs solved the task in opposite ways.** Run 1's leaders cruise at
0.52–0.69 cm/s — they *outrun* the problem. Run 3's leaders cruise at
0.01–0.24 cm/s and arrive more often, with roughly twice the dwell. There is more
than one way to reach a beacon, the objective does not prejudge which, and a
programme that keeps its lines apart finds both.

**Two things in these tables are worth more than the ranking.**

- **Out-of-plane closure beats in-plane for most of the leaders.** The concern
  that a single-plane bender could not be bred to reach a target ninety degrees
  out of its own steering plane does not survive this: they corkscrew, and
  selection finds it. It is the same mechanism `_zgoal.mjs`'s header records for
  the authored `eel`, arrived at independently from random stock.
- **`dwell` and `closedCm` do not rank the same animal.** In run 1,
  *Streptisohydra longifrontissima* is fourth on closure and **first on staying
  there** — 0.390 against the leader's 0.228, at a third of the speed. Rung C is
  therefore a real rung and not a formality: "reach it" and "stay there" are
  separate traits, and the current objective selects only the first. (Run 3
  happens to have found an animal that leads on both, which is the existence
  proof that they are not in conflict — only uncorrelated.)

### 11.2 Status

`_zbreed.mjs 20 12 3 40 both 3` (§5.4) is the validating run: the four fixes in
§5.3 land Gate 3 at **64.8×**, restore line independence, and put the score arm
ahead on the response measure. So:

> **Validated, at n = 2 seeds.** The objective, the two culling levels, the wide
> founding draw, the ratchet, the ark, the family cap, the median-based stall
> test, the outcross cooldown, the foreign-donor rule, and the
> no-authored-stock constraint. Random founders produce a lineage that arrives
> at the tank's own 8 cm beacon **in all six directions** and holds station
> there.
>
> **Not validated.** Gate 1 (best-ever) fails at 0.96× and is retired for the
> structural reason in §5.4 — it cannot separate a converged arm from a diverse
> one. Anything in §7 is untested by construction.

**Two seeds is two seeds.** The gate margins are large enough that direction is
not in doubt, but nothing here is a precision claim, and §5.4's per-line numbers
show how much line-to-line spread there is (2.75–3.55×).
