> # ⛔ SUPERSEDED 2026-08-14 — ARCHIVE ONLY
>
> **`design/PLAN.md` is the only live planning document.** Do not plan from this
> file, and do not read its status table as current: it predates the perception
> work, `GENOME_V` 9, the breeding campaign and the duel repair, and it still
> lists as open two defects that were fixed on 2026-08-08 (Lamarckian inheritance
> and the viability re-rolls).
>
> Kept because §4's layer argument, the three Studies at the end, and §6's debt
> list are the evidence `design/PLAN.md` §6 was deduplicated from.

# Vivarioops — where we are and what happens next

Written because "what is C1?" has three answers in this repo and none of them is
wrong. This file is the reconciliation and the plan. It supersedes the ordering in
`PLAN-AFTER-B2.md` §5 onward and is the entry point before any handover.

---

## 1. Why the letters are confusing — three schemes, same letters

| scheme | lives in | "C1" means | "C2" means |
|---|---|---|---|
| **The roadmap** (A–F) | `design/VIVARIUM_00_VISION.md` §7, `design/VIVARIUM_30_IMPLEMENTATION_PLAN.md` | **Sensors and probes** | **Duels + capability card** |
| **Chantiers / steps** | `HANDOVER-B2.md`, `PLAN-AFTER-B2.md` | "chantier 1" = morphology variety | n/a |
| **Engine work C0–C6** | code comments and `tools/_z*.mjs` only | **the actuator normalisation** | n/a — C6 is hydrodynamics |

**Two of the three schemes are defined in documents that are not in this repo.**
`DESIGN-PHASE-B2` is cited by ~40 comments in `gate/*.js` and by `PLAN-AFTER-B2.md:3`;
the C0–C6 plan and `RECONCILIATION` are cited by `engine/l2/gait.js` and several tools.
Neither exists in the tree. `design/INDEX.md` claims nothing outside `design/` is
authoritative, and yet the last several sessions were planned entirely outside it.

**Convention from here on:** the roadmap letters A–F are the only milestone names.
Engine work gets a descriptive name, never a letter. The C0–C6 labels already in the
code stay as historical references and are not extended.

---

## 2. Where we actually are

The reliable status board is **the gate's own carried-obligations block** (`npm run gate`,
read the tail). `CHANGELOG.md` stops at 0.8.0 against a `version.json` of 0.8.8 —
treat it as abandoned until someone backfills it.

| milestone | goal | status |
|---|---|---|
| A0 · Contracts | remove silent decisions | ✅ done |
| A1 · Skeleton | boots, navigates, persists, gates | ✅ done |
| B1 · Genome | round-trips, randomises | ✅ done |
| B2 · Morphogenesis | a genome becomes a body | ✅ done, re-tuned since |
| B3 · Motion | "swims, looks alive not convulsive" | ✅ **SIGNED 2026-08-08** |
| B4 · Breeding | the toy loop, playable | ✅ **SIGNED 2026-08-08** |
| **B5 · First light** | the art pass; "would you show someone a screenshot?" | ✅ **SIGNED 2026-08-08** |
| C1 · Sensors + probes | measurable creatures | ✅ **checkpoint STRUCK** — C1 has no player-visible screen by design, so there was never anything to sign. Keep investing in the probes: `steeringAuthority` is what separates `eel` (45 °/s one way, 0 the other) from `eel-unison` (genuinely steerable), and nothing else can. The "hollow" complaint is about **S2 specifically** and is a per-field fix |
| **C2 · Duels** | "watch three fights, say what it's good at" | ⛔ **RETIRED as a milestone 2026-08-08.** Four measured reasons: closing is flat at 0.16–0.21 cm across a 4× separation range (drift, not pursuit); the spec asks for a 29 m separation inside a 16×24×16 m tank; three residents give one candidate cycle, so non-transitivity is weak evidence; the UI was correctly never built. Its recorded root cause ("turnRate ~0.2 °/s") is the **yaw** field, so even the diagnosis is partly an artifact — though the conclusion survives. **`duel.js` stays parked, not deleted**: `senseOpponent`/`bearingTo`/`turnPlane` is the only worked closed-loop sense→steer example in the codebase. **Duels return after Phase 4 as a coevolutionary pressure** rather than as a measurement of creatures that cannot aim |
| **Forage** (not a milestone) | food, a mouth, an energy ledger, six rivals | ✅ **built** — no gene, no death |
| **Vivarium** (not a milestone) | Tank + Forage merged; one screen that breeds AND feeds | ✅ **shipped** — see the merge Study, which this settles |
| **Vernacular** (not a milestone) | design 14; the name a player actually says | ✅ **shipped** — EN pools, FR deferred |
| D1 · Ecology core | a population lives and eats | ❌ not started |
| D2 · Verdict | the world judges | ❌ not started |
| E1 · The loop | verdict sends you back to breed | ❌ not started |

**Why you have never seen C1 or C2.** C1 has *no player-visible screen by design* —
its deliverable is numbers and a gate. C2's screen (capability card + tap-to-replay)
was **deliberately not built**: the matchup matrix was all zeros, so the card would
have shown three empty rows. That decision is recorded in `CHANGELOG.md:87` and is
still a live obligation at `gate/duel.js:394`.

**The C2 blocker was locomotion**, and it was named precisely: median closing
0.25–0.34 cm against a 6–8 cm start separation. Half of it (buoyancy) was fixed long
ago; the other half was the drag law, which is what the last several sessions have
been working on.

---

## 3. Did the engine finish reasonably?

**Yes — it is now finished, and it should stop here.** The fluid work closed out this
session: the lift term deleted, the quadrature corrected, the momentum guards fixed,
added mass shipped. Full account in `HANDOVER-FORAGE.md`. Gate green at 94. The fluid model is now a coherent, measured,
gate-guarded Newtonian blade-element law with added mass. What remains on the fluid
side is either blocked (`MUSCLE_STRESS`, which pins 83% of the corpus at the speed
ceiling) or out of reach without a different geometry (skin friction, wakes,
circulatory lift). None of it is what stands between the project and being fun.

**What the engine work did NOT fix, and cannot:** ~~the corpus swims at ~0.006
body-lengths/s~~ — **SUPERSEDED BY PHASE A. Re-measured 2026-08-08: 0.091 L/s p50**,
a 15× improvement, against a real swimmer's 1–10. That gap is **coordination and the
morphology grammar**, not fluid.

**Orientation — the figure below reproduces, but read what it is.** *"0.13–1.96 °/s"*
is S3's **yaw** `turnRate`, and re-measuring gives the same band (p10 0.20, p90 3.10).
But `probes.js` S3 reads a compass bearing while chains bend in **pitch**, so it
"reads near-zero for exactly the bodies that turn best" (`SESSION-10.md:601`). The
honest numbers, measured over n=20 with the shipped 3-D probe:

| | p10 | p50 | p90 |
|---|---|---|---|
| `turnRate3d` °/s | 0.80 | **1.57** | 4.31 |
| `steeringAuthority` | 0.123 | **0.668** | 0.995 |

So the corpus really is slow — 1.57 °/s is a 86-second 135° turn — **but the
mechanism works**: for the median creature the control input reliably decides which
way it curls. And the authored library already contains **eel-unison at 15.95 °/s,
authority 1.000**.

**`tools/_zlight.mjs` re-run post-Phase-A settles the consequence.** Taxis still
fails (mean control-subtracted closing **+0.0109, 1/7 helped**), and the declared
secondary says why: **corr(score, `turnRate3d`) = 0.91**, while corr(score, sensor
gain) = **0.07**. Turn rate is the entire mechanism, the threshold sits near 14 °/s,
and the corpus sits at 1.57.

**The consequence for planning:** aiming is still blocked — but **turn rate is a
selectable trait, not a broken mechanism**, and nothing in the project has ever
selected for it. That is the highest-leverage item now open. See
`design/PLAN-TO-INTELLIGENCE.md` Phase 3.

---

## 4. "A creature alone on a depletable food field" — which layer?

**Creature generation with a better selection criterion. Not L3.**

L3 is defined by its *representation*, not its subject matter: point agents
`{x, y, vx, vy, mass, age}` in 2D, driven by a compiled `Species` record, with **no
physics at all** (`design/VIVARIUM_12_L3_WORLD.md:41-47`, `01:156-162`). A creature
with real joints in real fluid cannot be represented there. And L2's probes produce
*identity*, which costs a `BRIDGE_V` bump per field.

An **objective** is the third category, and it was carved out deliberately for exactly
this (`engine/l2/objective.js:1-11`): it is what selection reads, it is not part of any
creature's identity, and it carries no schema and no version obligation. There is
already precedent — `tools/_zlight.mjs` scores against a light placed in the world and
feeds it straight into the shipped `autoBurst`.

So a food field is **a harness on `runSolo` plus an objective**, in the shape
`_zlight.mjs` already has. It becomes L3 when there are many agents, no physics, and a
compiled record — which is D1, and a different job.

**Four things that decide whether it works**, all already known:

1. **Local depletion is load-bearing.** If energy is gained from a field and spent by
   moving, the optimal strategy is to *not move*. Depletion is the only thing that
   makes the model non-degenerate (`PLAN-AFTER-B2.md:107-114`).
2. **Kinesis, not taxis.** Sense local field strength, modulate `control.effort`. One
   gene, sign evolved not declared. *E. coli* cannot orient either — it runs and
   tumbles. This is the whole reason food comes before light: **taxis needs
   orientation, which is broken; kinesis needs swimming, which works.**
3. **The objective must be control-subtracted.** Raw seek score correlates **0.90 with
   netSpeed** — selecting on it breeds fast swimmers and leaves the gene drifting.
   Run the identical trial with the gene zeroed and score the difference.
4. **It needs its own gait adapter.** `adaptGait` hill-climbs *net speed*
   (`objective.js:158-160`). Reusing it would optimise one quantity and select on
   another.

---

## 5. The plan

### Step 0 — DONE. The duel matrix was re-run, and the diagnosis changed.

**Result: C2 is still blocked, but not by what the obligations said.** The recorded
blocker was the drag law. The drag law is fixed and the duels still do not capture —
for a sharper reason.

Measured with `tools/c2duel.js`, `c2diag.js`, `c2sweep.js` after the C6 work:

| | before | after |
|---|---|---|
| captures, 84 duels at spec separation | 0 | **0** |
| duels aborting as unstable | ~16–33% | **0** |
| pairs ending nearer than they began | — | **26 / 28** |
| median closest approach, outside reach sum | — | **0.28 cm** (best pair **overlapped** by 6.06) |
| captures at 0.5× reach sum | 6/45 | **10/29** |

**The stability half is completely resolved**, and creatures now get within a third of
a centimetre of contact. But the sweep is what settles it:

```
 mult   duels  capture  stalemate  unstable   median closing
 0.50      29       10         19         0       0.17
 0.75      20        0         20         0       0.21
 1.00      14        0         14         0       0.18
 1.50       9        0          9         0       0.20
 2.00       5        0          5         0       0.16
```

**Closing is FLAT at ~0.2 cm across a 4× range of starting separation.** Closing that
does not depend on the gap is **drift, not approach** — a creature that were actually
closing would close further when it started further away. Captures happen only where
the envelopes already overlap and 0.2 cm of drift is enough to touch.

**So: C2 needs pursuit, pursuit needs orientation, and orientation is the open
problem** (turn rate ~0.2 °/s — a creature cannot aim at anything inside a 15 s duel).
**Locomotion is no longer the blocker. Aiming is.** Do not spend another session on
thrust for C2. The obligations in `gate/duel.js` have been rewritten to say this.

This *confirms* the ordering below rather than changing it: the food path needs no
aiming, and it is the one that can move now.

### Step 1 — B5, the art pass. SUBSTANTIALLY DONE. Still unsigned.

`B5 · First light` was never started as a session, but it has now been done in pieces
across several. The tank was critiqued and reworked: top scrim removed, chrome given
its own contrast over water (`--c-on-water`), the scale legend made legible, motes
spread over 27× the volume and slowed off a one-way drift that implied a current, sun
shafts given a third motion. **Forage** was built to the same look.

The Atlas/Evolution update finished the two things B5's question would still have
failed on — *"would you show someone a screenshot?"*:

- **Portraits.** They were framed against the bounding sphere about the wrong point
  (`buildCreature` does NOT centre on the centre of mass, whatever the old comment
  said), so elongated animals clipped — and A2 made elongated animals common.
  Replaced with `fitOrbit` + `FIT.portrait`, **which were already in the tree and
  referenced nowhere**. Studio plate, three-light rig, contact shadow, vignette, 1024
  px, `object-fit: contain`. `RENDER_TAG` finally has the re-render path it never had:
  nothing but `seedAtlas` had ever compared that tag, and only for authored records,
  so a player's own creatures kept their first photo forever.
- **Names.** `Scleromacrosomatus longiventissimus` was the actual complaint. Design 14
  ships: the rows and the sheet heading now read `the banded whipfoot`, and the Latin
  moved to the sheet where there is room for it.

**Still owed, and only a person can discharge it:** `B3` and `B4`'s human checkpoints.
Both say *"watch the tank screen with a person"*, both are unsigned, and the screen
they refer to no longer exists under that name — the checkpoint is now the Vivarium.

### Step 2 — food. DONE as a harness; the gene is not.

`engine/l2/forage.js`, `ui/screens/forage.js`, the **Forage** tab. Six creatures from
the Atlas share one tank and compete for one depleting field. See
`HANDOVER-FORAGE.md` §5 for the three model faults found and fixed along the way.

Against §4's four conditions:

1. **Local depletion** — yes. No diffusion at all, so depletion is strictly monotone
   and `eaten` is exactly the field's loss.
2. **Kinesis, not taxis** — **NOT DONE.** There is no gene. Creatures forage by
   swimming into food, not by sensing it. This is the next step.
3. **Control-subtracted** — **NOT DONE**, and it cannot be until (2) exists: there is
   no behaviour to disable. `eaten` is "food found", not "foraging skill".
4. **Its own gait adapter** — not yet needed, because nothing selects on food yet.

**Scope flag, honoured rather than drifted past:** this is D-tier work sitting before
C2 and D1, and it was taken knowingly. It is still L2 — real bodies, real fluid, no
compiled records — and it is not D1.

### Step 2b — the MOUTH GENE, and it is the next thing to do

`mouthsOf()` derives one mouth on the root body. Placement and **count** should be
genes: the same shape the sensor gains already have, and **the same shape eyes will
need**. That is one `GENOME_V` bump with a migration, factory support and a mutation
operator — worth spending once, and now is the once, because the model it serves has
been measured. **Only `mouthsOf()` changes.**

Do this before the kinesis gene: they are the same schema decision, and doing them
together costs one migration instead of two.

### Step 3 — orientation, and only then light

Light-following is the Sims demo and it is the natural finale. It has already been run
and it failed honestly: closest approach 2.92–2.99 cm against a 3.00 cm start —
*nobody gets near the light in either arm*. It needs orientation, and orientation is
the open research question. Do not attempt it before then.

### Not scheduled

`MUSCLE_STRESS → 2e6` (blocked on `STABLE_SPEED`), D1/D2/E1 (blocked on C2 and on
turn rate), skin friction / wake / circulatory lift (need a different geometry).

---

## 5b. The order, as it now stands

> **SUPERSEDED 2026-08-08 by `design/PLAN-TO-INTELLIGENCE.md`**, which recasts this
> into five phases. Kept here because the reasoning below is still the reasoning,
> and because step (1) is now done. The one substantive reordering: **removing the
> Lamarckian gait oracle and the viability re-rolls comes before all of it** — see
> that document's Phase 1.1.

1. ✅ **DONE** (`30a36f5`) — **Mouth + sensor placement genes**, `GENOME_V` 4 → 5.
   Mouth placement is genetic, count deliberately is not; node `sites` open the same
   shape to receptors. Unlocks eyes too.
2. **Kinesis gene** — sense local food, modulate `effort`. Sign evolved, not declared.
   **Reframed:** the gene, its `RANGE`, its mutation operator, the `sites` schema and
   the blind state all already exist. What is missing is that **nothing reads them** —
   `morphogen.js:218` says of the receptor normal, *"Nothing reads it yet."* The work
   is the wiring, not the gene.
3. **Control-subtracted forage objective**, which (2) makes possible for the first
   time. Only then may anything select on food. Needs **its own gait adapter** (§4.4).
4. **Turn rate, then orientation.** No longer a bare research question:
   corr(taxis score, `turnRate3d`) = **0.91**, the threshold is ~14 °/s, the corpus is
   at 1.57 °/s, and `eel-unison` proves 15.95 °/s is reachable in the existing grammar.
   **Select for it** — gated on `steeringAuthority` > 0.5 so it cannot be won by
   breeding circlers.
5. D1 / D2 / E1 → now **L3: fitness as persistence**, not a better auto-breeder.
   `engine/l3/` is empty while `w1_slice.js:127-187` already specifies the whole
   ecology and `forage.js:40` says **NO BIRTH AND NO DEATH**.

**SPEND THE `GENOME_V` 5 BUMP ONCE, ON FOUR THINGS.** Steps (1) and (2) already share
a migration. So do two more, and they have been waiting since 13 shipped:

| what | needs | who is waiting |
|---|---|---|
| mouth placement + count | a gene | this file, step 1 |
| kinesis | a gene | this file, step 2 |
| **author citations** (13 §8) | a genome field | `naming.js:214`, and 14 §3.6's possessive — `gate/vernacular.js` VN-11, PENDING |
| **recombination scars** (13 §10) | a genome field | `naming.js:214`, and 14 §3.5's `false` — VN-9, PENDING |

Four fields, one migration, one `worlds/seeds.js` edit — instead of three separate
bumps each invalidating every compiled record. The naming half is nearly free once
the field exists: `false` is one word in `RANK_EN` and one branch in `rankWord()`; the
possessive is one slot the grammar already reserves. It buys `Gauder's greater rowing
whipfoot` and `the false azure sunburst`, which are the two most legible events in the
Atlas and currently cannot be shown at all.

**The trap that has already bitten twice on a `GENOME_V` bump** is written at the top
of `HANDOVER-ATLAS-EVOLUTION.md` §0 and must be read before starting: `SCHEMA_OF` maps
`genome`, `specimen` AND `lineage` to `GENOME_V` (a missed migration made a player's
whole Atlas invisible), and `worlds/seeds.js` literals must gain any gene they claim
to have in the same edit.

**Not scheduled:** `MUSCLE_STRESS → 2e6` (blocked on `STABLE_SPEED`), skin friction,
wake modelling, circulatory lift.

### The harness that exists for step 3 already

`tools/_zselect.mjs` runs the breed loop against the ledger, and `_zcompare.mjs` grades
a winner on the columns the objective cannot see. When step (2) lands and a
control-subtracted objective becomes possible, **this is where it plugs in** — the
loop, the checkpointing and the reference comparison are done. Four things it learned
that a future objective must not re-learn:

1. **Never select on the ledger RATIO.** It is a margin, won by not spending, and the
   cheapest way not to spend is not to move. Drifter has the best margin in the corpus
   (70×) and nets the least energy of anything measured.
2. **Never run a forage trial under ~200 s.** `forage.js:98-113` swept it: at 60 s
   intake correlates 0.33 with mass and −0.06 with swimming. The cheap tell is two
   unrelated creatures reporting the same intake — they never left their spawn patch.
3. **Check `integrity()`.** `runForage` does not. A creature that comes apart reports
   fictional intake (HANDOVER-FORAGE: 7864 g against 31–49 for its rivals), so a run
   without the check breeds exploders and nothing else.
4. **Resumption must be exact or it is a different experiment.** Every rng in the loop
   is `rngFrom('zselect', 'breed', gen)` — pure in the generation number — which is the
   only reason a checkpoint is honest. Verified by replay: a fresh run reproduced 22
   generations of an earlier one to the digit, best and median.

---

## 6. Debts this file does not discharge

**ADDED 2026-08-08, from a measurement pass and an independent biological review.**

- **INHERITANCE IS LAMARCKIAN TODAY, AND IT WAS NEVER DECIDED.** `gait.js:105` —
  *"Adapt a whole population, **Lamarckian**: each body keeps the controller it
  learned"*; `objective.js` — *"the ADAPTED controller **REPLACES** the birth one…
  so selection and breeding both carry the learned gait."* `adaptGait` is a `(1+λ)`
  hill climb on net displacement **measured by the simulator**; the creature has no
  access to that objective and does not do the learning. This contradicts the
  standing Baldwinian decision, and it makes the Baldwin instrumentation
  unmeasurable — an innate probe cannot read a gap an oracle has already closed.
  **Highest-priority defect in the project.**
- **VIABILITY RE-ROLLS ERASE MUTATIONAL LOAD.** `VIABILITY.maxAttempts` = 12 tries
  per reproductive event, then copy the parent. A genotype with a fragile
  developmental neighbourhood has the same reproductive output as a robust one, so
  nothing selects for developmental robustness. Fine for the six-slot tank; **must
  be off wherever selection is measured.**
- **THE CREATURE IS HANDED EXACT WORLD-SPACE BEARINGS.** `duel.js:444` passes
  `simB.centreOfMass()` straight in, and `senseOpponent` has **no range test at all**
  despite `bearingTo`'s doc claiming "0 if none in range". Receptor `normal` is
  carried and unread. Perception is not causally coupled to anatomy.
- **THE TWO SENSOR GENES ARE NON-IDENTIFIABLE.** `duel.js:277` passes
  `sensorTurnBias(genome, bearing, bearing)`, so the phenotype sees
  `(preyGain + threatGain) × bearing` — a neutral ridge masquerading as two traits.
  Measured: corr(taxis score, |gain|) = **0.07**.
- **`sim.saturation` UNDER-REPORTS.** It reads **0.000000** while a ceiling-only
  change (`budgetScale 6→6e4`, touching no gain) moves **7 of 10** creatures by up
  to 1.21 cm / 30 s. A/A control is 0.000 on 10/10, so the sim is bit-deterministic
  and the difference is real. `physics.js:1240` names the cause; **`physics.js:565`'s
  "corpus saturation is 0.000, so `budgetScale` is inert" is false**, and it is what
  the `budgetScale = 6` decision rests on.
- ~~**13 SWEEP TOOLS REPORT PRE-PHASE-A NUMBERS.**~~ **DISCHARGED 2026-08-08, and
  the cause was smaller and more instructive than it looked.** All 14 `_z*` copies
  of `physics.js` in `engine/l1/` lacked `advancePhases`/`PHASE_COUPLE`, so every
  tool importing one measured the open-loop controller. **But they are generated,
  gitignored and disposable** — `tools/_zvariants.mjs` writes them from
  `physics.js` — and they were stale for exactly one reason: *the generator had not
  been re-run since Phase A.* One command fixed all thirteen. `_zphlog` is deleted
  outright: its only difference from `physics.js` was three logging lines, which are
  now the `FLOG` flag in `physics.js` itself.
  **Standing rule that falls out: a diagnostic that can be a flag must not be a
  copy, and `node tools/_zvariants.mjs` runs after every `physics.js` edit.**
  *(I earlier reported "112 archaeological files in the executable repository". That
  overstated it: the 14 engine forks were never committed — `.gitignore` has covered
  them since they were introduced. What WAS committed is corrected below.)*
- **SIX `.bak` FILES WERE COMMITTED INTO THE SOURCE TREE** at `de21670`
  ("vivarioops 0.7") — `breed`, `genome`, `mutate`, `naming`, `viability` inside
  `engine/l1/`, plus `ui/tank/sim.js.bak`. They are mutation-harness scratch
  (`tools/_mut*.mjs` copies `file -> file.bak` before mutating and restores in a
  `finally`), they were 40–60% the length of their live counterparts, and every grep
  of `engine/l1/` returned two hits per symbol with one from version 0.7.
  **Deleted, and `*.bak` added to `.gitignore`.** The harness recreates them at
  runtime. 86 `tools/_z*` files remain tracked and are genuine experiment scripts,
  not duplicates.
- **`FOOD_ENERGY: 2.7e3` IS LABELLED `erg/g` AND IS NOT `erg/g`** — calibrated so
  half the corpus sits near break-even. Real unit labels on a deliberately
  non-physical conversion is the dangerous option, because downstream equations look
  more grounded than they are. Go dimensionless.
- **ACTIVE ECCENTRIC WORK IS BILLED FREE.** `forage.js:476-488` charges only
  `workOut` — *"an animal does not eat to be pushed around"* — which conflates
  passive external loading with active negative muscle work. Eccentric contraction is
  cheaper than concentric, not free. An exploit surface.
- **VIABILITY PRE-SELECTS MOTILE LIFE.** The inertness check is **25.0% of all
  rejections**, so movement is required before ecological selection begins. No
  sessile organisms, no filter feeders, and on land it inverts entirely.
- **UNIT ANNOTATION DRIFT — swept 2026-08-08** in `genome.js` and `viability.js`,
  but check any comment quoting m/kg before trusting it. The stale gravity block in
  `w1_slice.js` misled three separate analyses before it was deleted.

- **Two normative planning docs are missing from the repo.** Recover or re-write
  `DESIGN-PHASE-B2` and the C0–C6 plan, or accept that ~40 gate comments cite
  documents nobody can read.
- **`CHANGELOG.md` is 8 patch versions stale.**
- ~~**Nothing has ever been persisted.**~~ **DISCHARGED.** `KEY.specimen` and
  `KEY.lineage` are both live — `ui/screens/vivarium.js` persists the lineage after
  every breed, undo and selection change and hydrates it on boot;
  `worlds/atlas_seed.js` plants the authored library idempotently by `genomeHash`. The
  Atlas is a real 46-record collection with portraits, binomials and vernaculars.
- **B3 and B4's human checkpoints are still unsigned.** Both say "watch the tank
  screen with a person". That is now overdue by many sessions — and the screen has
  since been rebuilt, so the checkpoint is against the **Vivarium** now.
- **THE FORAGE ECONOMY HAS BEEN SELECTED ON, AGAINST THIS FILE'S OWN ADVICE.**
  `tools/_zselect.mjs` ran 60 generations against the ledger while the debt below still
  stands. The animals it produced are real and the numbers reproduce, but read the
  claim narrowly: with no kinesis gene there is no foraging BEHAVIOUR to isolate, so
  intake bundles swimming. Both champions won on movement pattern, not on sensing.
  They are interesting animals; they are not evidence about foraging skill.
- **The forage objective is not control-subtracted** and must not be selected on
  **inside the app** — `OBJECTIVES` still ships only Speed / Size / Span, and
  `foodEaten` must stay out of it until step (2) exists.
- **NEITHER FORAGE ECONOMY IS SIZE-NEUTRAL, AND THEY BRACKET IT.** Measured over 24
  survivors: absolute `balance` runs pearson **+0.50** with mass and crowns a 37 g
  animal with the worst net energy per gram of anything compared; `balance / mass`
  runs **−0.86** and crowns a 0.30 g filament. The metabolic bill already scales as
  m^0.75 in `ledger`, so neither is a bug — they answer different questions. Any
  future forage objective must say which one it is answering.
- **`FOOD_ENERGY` is calibrated, not derived**, and has moved three times as the
  harvest model changed. Recalibrate whenever `forageStep` or the trial length moves.
- **The forage objective is not control-subtracted** and must not be selected on yet.
- **`_myria2.json` no longer reproduces the tear-apart**, so added mass's stability
  benefit is unproven and needs a fresh repro.
- **`_dragmicro.mjs`'s "ratio 1.000 to 30 m/s" is stale** — above `STABLE_SPEED` it
  measures the clamp.

---

## Study — can Tank and Forage be merged? (ASKED, ANSWERED "NOT YET", MERGED ANYWAY)

> **STATUS: SHIPPED, against the recommendation below, which is kept unedited.** The
> analysis was right about what was in the way; the recommendation was overtaken by a
> decision made in `HANDOVER-ATLAS-EVOLUTION.md`. Read the original first, then
> `### What actually shipped` at the end of this Study for what held, what did not,
> and the one cost that was genuinely paid.

**Short answer: the engine does not prevent it, and a Breed button on Forage would
work today. What is not ready is the automated half — Burst — and the reason is the
same one Step 2b names.**

### What is NOT in the way (checked, not assumed)

**Breeding never touches the on-screen simulation.** `doBreed()`
([tank.js:994](vivarioops/ui/screens/tank.js:994)) takes `genomes`, `selected` and an
rng, and calls `breed({ RAPIER, genomes, selected, rng, world: W1_SLICE })`. No slot,
no arena, no pose. `runBurst` scores through `scoreBy(RAPIER, obj, [pop[i]],
W1_SLICE)` and `adaptGait(...)` — **fresh headless sims in the canonical world**, never
the display arena. So "private tiled arenas" versus "one shared arena" cannot affect
what breeding produces. It only affects what you WATCH.

The selection state is already identical — Forage now carries the tank's `Set`, ring,
tap and long-press verbatim (HANDOVER-FORAGE §10a). Wiring `Breed` to `doBreed` is
genuinely "and off you go".

### What IS in the way

**1. The two arenas are mutually exclusive, and choosing between them chooses the
experiment.** The tank gives each creature a PRIVATE sim on an invisible 2×3 grid
(`layoutGrid`, [tank.js:212](vivarioops/ui/screens/tank.js:212)) precisely so they
cannot touch. Forage gives them ONE `createArena` + `stepAll`, so they collide and
compete. A merged screen must pick:

| | you see | "keep the best" means |
|---|---|---|
| private, six food fields | each creature's own foraging | its own performance — comparable, reproducible |
| shared, one field | rivalry | partly **who got the good spawn** |

`foodEaten()` already takes the first side for scoring — "A FRESH FIELD PER CREATURE,
or the trial order decides the result". A shared display tank next to private scoring
is defensible, but the screen would then be showing something other than what it
selects on, and that has to be said out loud rather than discovered.

**2. There is no trustworthy forage objective, and that is the real blocker.**
`OBJECTIVES` carries exactly three — Speed, Size, Span — each with a `trusted` flag
whose whole purpose is to record whether the number means anything.
`foodEaten()` would have to ship `trusted: false`: it is **not control-subtracted**,
and the seek objective already taught what that costs (raw seek score correlated 0.90
with netSpeed, so it bred fast swimmers and left the sensor gain drifting).
Subtraction needs a behaviour to disable; the kinesis gene does not exist.

So: **Breed (manual, by eye) is honest today. Burst on "Food eaten" is not.** That
split is the answer to the question.

**3. Small, real, and cheap:** Forage has no persistence (the tank has `vivariumSeed`,
`persistLineage`, one-step undo); the water/atmosphere is sized from the grid in one
and from `tankBounds` in the other; `R4` pins five tabs
([runtime.js:146](vivarioops/gate/runtime.js:146)) so dropping one is a literal edit;
and the combined per-frame load is six bodies plus 1400 proximity tests plus, during a
burst, dozens of headless sims.

### Recommendation

**Do not merge the screens yet. Add `Breed` to Forage instead** — it reuses machinery
that already exists, it makes food part of the loop rather than a museum, and
breeding-by-eye on a depleting field is exactly the fun the project is after. Keep
Tank as the controlled comparison, where a creature is measured on its own.

Revisit the merge **after Step 2b (the mouth gene)**, when placement and count are
heritable, a control subtraction has something to disable, and a forage objective can
be offered with `trusted: true`. At that point the two screens are answering the same
question and keeping both is the redundancy.

### What actually shipped

`ui/screens/vivarium.js`. `tank.js` and `forage.js` are retired, `TABS` is four, and
`R4` pins it.

**The blocker this Study identified was respected in full.** It said the real
obstacle was that there is no trustworthy forage objective, and that *"Breed (manual,
by eye) is honest today. Burst on 'Food eaten' is not."* That split is exactly what
shipped: **Breed is manual and by eye; Burst still offers only Speed / Size / Span,
scored in fresh headless sims in the canonical world.** `foodEaten` was not added to
`OBJECTIVES` and must not be until step (2). So the thing this Study was actually
protecting was never at risk.

**Two of the three "small, real and cheap" items are closed.** Forage had no
persistence — it does now, the tank's `vivariumSeed` / `persistLineage` / one-step
undo carried over verbatim. `R4`'s five-tab pin was a literal edit and was edited.

**THE ARENA CHOICE WENT TO `shared`, AND THIS STUDY'S WARNING IS NOW LIVE.** It asked
that it be *"said out loud rather than discovered"*, so:

> The ledger you read on the Vivarium is a **shared-field** number. Six creatures
> compete for one ocean, so a row's g/ratio is partly *who got the good spawn*. Burst
> scores privately and headlessly and is unaffected. **The screen and the selection
> are measuring different things, deliberately.**

**And one cost was genuinely paid rather than avoided.** This Study said *"keep Tank as
the controlled comparison, where a creature is measured on its own"*. Tank is gone, so
there is no longer any screen on which a creature meets its own identical field. What
replaced it is not a screen at all — it is `tools/_zselect.mjs` / `_zcompare.mjs`,
which run one creature per field (`makeFood(..., { seed: 0xF00D })`, the rule
`foodEaten` already argued for) and print the comparison. That is a strictly better
measurement and a strictly worse *experience*: you cannot watch it.

**If the private comparison is wanted back as a screen**, the aquarium habitat is
disabled, not deleted — `HABITATS` keeps both entries and `spawn()` keeps its
`bounded: true` branch, so re-enabling is a UI change rather than a physics one.
Per-creature private fields would be the further step, and (T) TILED TORUS below
already costs it.

---

## Study — why is tank size so deeply embedded, and can it be free? (MEASURED)

**The short version: it is not the SIZE that is embedded, it is the HASH, and the
hash is now over-broad. Measured, tank size does not reach a single number the game
selects on.**

### The measurement (`tools/_zsize.mjs`)

Same 10 genomes, same `Speed` objective, four tank sizes spanning 8×:

| | 1× (32³) | 2× | 4× | 8× | max rel. diff |
|---|---|---|---|---|---|
| every creature | — | — | — | — | **0.0e+0** |

**Bit-identical.** Not close — identical. The reason is in
[objective.js:62](vivarioops/engine/l2/objective.js:62): scoring already runs
`bounded: false, wrap: true`. **Selection happens on the torus, in a world with no
walls at all.** Tank size can only reach it through `wrapExtent`, the torus period,
and [physics.js:761](vivarioops/engine/l1/physics.js:761) reconstructs the centre as
if the tank were unbounded, so a wrap is invisible to a measurement — as designed.

Viability reads `tankBounds` too ([viability.js:225,238](vivarioops/engine/l1/viability.js:225))
but only to REJECT creatures too big for the tank. **Growing the tank can only ever
relax it** — 0 oversize rejections at every scale, against a corpus of radius
1.62–5.45 cm.

### So what does tank size actually change?

1. **Duel placement** — [duel.js:145](vivarioops/engine/l2/duel.js:145) starts the
   pair from the half-extents. This one is real. But C2 already records the tank as
   **too small for its own spec** (start separation `k × (reachA + reachB)` was
   "unsatisfiable" and had to be clamped), so a wider tank *repairs* that rather than
   breaking it.
2. **Food density** — [forage.js:165](vivarioops/engine/l2/forage.js:165) spreads
   `FOOD_COUNT` over the volume, so a bigger tank at fixed count is a sparser field.
   Fixed by scaling the count with volume.
3. **What the player watches**, which is the whole reason the question came up.

### What is possible, and what each costs

**(a) Bump and widen — 2× now.** `tankBounds → [64,48,64]`, `faunaVersion 5 → 6`, one
gate pin. ~30 minutes. Invalidates every compiled Species record, which is what the
mechanism is FOR and not a loss — but it buys a one-off, and the next size change
costs the same again.

**(b) SPLIT THE FIELD — this is the real answer.** One field is doing two jobs:

| meaning | who needs it | should it be stable? |
|---|---|---|
| **the habitat** — how much room, what you watch | the screens, the forage trial | **no — free** |
| **the measurement volume** — torus period, oversize limit | scoring, viability, records | **yes** |

Add an unhashed `habitatBounds`; keep `tankBounds` hashed as the canonical
measurement volume. **Adding an unhashed field does not change `worldHash`, so this
costs ZERO invalidation** — no bump, no re-freeze, K5 unaffected (it checks the hashed
path list, which does not move). Afterwards the habitat is freely editable forever,
including from a Settings slider. Cost: one schema entry, and a deliberate decision at
each of the ~7 `tankBounds` consumers about which of the two it actually wants —
which is work worth doing anyway, because right now they are all guessing.

**(c) No walls at all** — the boundless tank. Blocked by a real thing, and it is
written down: [physics.js:711](vivarioops/engine/l1/physics.js:711) — *"WRAPPING IS
SAFE HERE FOR A SPECIFIC REASON — creatures do not interact... The day that stops
being true this needs a periodic broad-phase, not a translate."* **Forage is that
day.** Wrapping a shared arena needs ghost copies of every body within one wrap
distance of each seam so contacts work across it; Rapier has no periodic world. One
to two sittings, and a genuine source of subtle bugs (a creature colliding with its
own ghost).

### Recommendation

**Do (b), and take the 2× as its first free consequence.** It is barely more work than
(a), it costs no invalidation at all, and it turns "the aquarium is too small" from a
session into a number anyone can change. Keep (c) available for when boundless
wandering is actually the point — it is a real feature, not a workaround, and it
should be costed on its own.

---

## Study — how to make the OPEN environment watchable, not just headless

**The measurement forced the question.** `tools/_zthrive.mjs` ran the player's own
Atlas cast for 66 minutes each, open water against walls (HANDOVER-FORAGE §12):

| creature | eaten OPEN | eaten WALLED | | multiplier |
|---|---|---|---|---|
| Drifter | 26.57 g | 5.79 g | **4.6×** | 8.90 → 8.41 |
| Polypoda multipes | 44.04 g | 11.05 g | **4.0×** | 0.22 → 0.22 |
| Darter | 22.07 g | 8.57 g | **2.6×** | **6.91 → 1.96** |
| Eel | 12.23 g | 5.92 g | 2.1× | 11.91 → 8.38 |
| Paddletail | 8.82 g | 8.72 g | 1.01× | 8.19 → 8.82 |
| **Flapper** | **5.641 g** | **5.641 g** | **1.00×** | **5.14 → 5.14** |

**Flapper is bit-identical in both arms** — it never travels far enough to meet a
wall, so the boundary costs it nothing. Darter changes VERDICT: walled it merely
survives, open it thrives. The walls do not add noise, they re-rank.

### THE KEY FACT: an unbounded SHARED arena already works

`createArena(RAPIER, world, { bounded: false })` is supported today —
[physics.js:255](vivarioops/engine/l1/physics.js:255), *"false builds an open
volume"*. The wall colliders are simply not created. **Creatures still collide with
each other normally. No wrap, therefore no periodic broad-phase, therefore none of
the blocker at physics.js:711.**

So the open world is not blocked by physics. It is blocked by **food**: `makeFood`
generates items inside `world.tankBounds`, and past that edge there is nothing to eat.
That is the entire gap.

### Two ways to close it

**(T) TILED TORUS — private wrapped sim per creature, laid out like the Tank.**
Exactly what `_zthrive` measures, so screen and harness would agree by construction.
Reuses the Tank's existing tiled-arena architecture; **no new physics at all**. The
creature wraps, so the trail needs a break at each wrap event (and optionally ghost
copies at ±extent so the seam reads as continuous). **Cost: they stop competing for
one field** — though `foodEaten` already argues a fresh field per creature is the
CORRECT comparison, so this is arguably a feature. ~1 sitting.

**(O) OPEN OCEAN — shared unbounded arena, procedurally chunked infinite food.**
`bounded: false`, and food generated on demand: hash a chunk coordinate into a
deterministic set of items, keep a sparse Map of what has been eaten. Infinite extent,
identical density everywhere, memory proportional only to where creatures have
actually been. Rivalry is preserved and the space is genuinely open — no wrap, no
seam, no ghosts.

  What it needs beyond the food: **a following camera** (they disperse, so a fixed
  frame loses them — auto-fit the cast's bounding box, plus a "follow the selected
  creature" mode that the new trail highlight already sets up), and the water/mote
  atmosphere re-anchored to the camera instead of to a box. ~1–2 sittings.

  Honest risk: with nothing to hold them together the cast spreads until an auto-fit
  camera shows six specks. That is a true picture of an open ocean and may simply not
  be fun to watch — which is an argument for making "follow one creature" the default
  view rather than a mode.

### Recommendation

**(O).** It is what was actually asked for — creatures wandering in unbounded space —
the physics flag already exists, and the only genuinely new component is a chunked
food field, which is self-contained and testable on its own. Keep (T) as the fallback
if the dispersal turns out to make it unwatchable, since it costs no new physics.

**Do NOT ship either as a replacement for the bounded screen.** The walls are a real
habitat and the crowded tank is a legitimate (different) experiment; the open world is
the one that measures foraging rather than cornering. Both should exist, and the
screen should say which one it is running.

---

## DESIGN — Aquarium vs Open ocean: one screen, two habitats

### The decision: a MODE inside Forage, not a new tab

**Not a new tab.** The two habitats share ~90% of the screen — cast picker, ledger,
trails, selection rings, layer toggles, speed, stats sheet. A second tab means either
duplicating ~900 lines (which will drift within two sittings) or a refactor into a
shared module that is more work than the feature. Six entries is also too many for a
phone tab bar.

**And comparing them IS the feature.** `_zthrive` measured Darter at 1.96× walled and
6.91× open — same animal, different verdict. One tap between arms is the whole point;
a tab switch that respawns from scratch is the same thing with more ceremony.

**But the mode must not hide in the chip row.** `Cast / Trails / Food / 4× / Reset` is
a row of adjustments; the habitat is not an adjustment, it is *which experiment you are
running*. It goes in the **title row as a two-segment control**, and the readout names
it, so a screenshot is self-describing:

```
  [ Aquarium | Open ocean ]   6 foraging · 6m 14s
  Food 279 g of 300 · 7% grazed
```

Switching **respawns** — different arena, different field, the clock restarts. That is
honest rather than convenient: the two are not the same trial.

### What differs, and it is a short list

| | Aquarium | Open ocean |
|---|---|---|
| arena | `bounded: true, bounds: habitatBounds` | **`bounded: false`** |
| food | finite field over `habitatBounds` | **chunked, infinite** |
| glass | drawn | none |
| camera | framed to the box | **follows** |
| readout | `279 g of 300 · 7% grazed` | `eaten 12.4 g · density 0.9x` |

Everything else is shared verbatim.

### The one new component: chunked food

**And it is already a drop-in.** `forageStep` no longer scans `food.items`; it reads
`food.grid` / `food.cellSide` / `food.tick`. Any object providing those three plus
`remaining()` / `eatenCount()` works. Measured: **8× the field costs 10% more wall
time** (1400 → 11200 items, 1.67 s → 1.84 s per 300 s trial), because the cost is now
O(mouths) rather than O(field). Before the grid it was a linear scan of every item on
every step, and an infinite field was simply impossible.

So `makeChunkedFood(world, opts)`:
- **Chunk** = a cube (start at 16 cm) identified by integer coords. Its items are
  generated deterministically from `hash3(cx, cy, cz, seed)` — the same hash the patchy
  field already uses — so the ocean is infinite, reproducible, and needs no storage
  until visited.
- `ensureAround(points)` each step: materialise the 3×3×3 chunks around every mouth and
  splice them into `grid`. Cost is bounded by mouths, not by ocean size.
- Density matches `habitatBounds`' exactly, so the ocean and the aquarium are the same
  water — which is what makes the A/B mean anything.
- Chunks are never evicted. Memory grows with **explored** volume only, the same way
  the trail buffer already does.

**A real consequence to design for, not paper over:** `initialTotal`, `remaining()` and
`% grazed` are meaningless in an infinite field. The ocean readout must switch to
absolute grams eaten plus *local* density, or it will print a lie.

### Camera: follow, and default to following

They disperse — that is the point — so a fixed frame loses them and an auto-fit frame
eventually shows six specks. **Default to following the selected creature**, which the
trail highlight already sets up, and fall back to auto-fitting the cast when nothing is
selected. Water and motes re-anchor to the camera instead of to a box.

### Order of work

1. `makeChunkedFood` + its own tool — testable alone, against the finite field.
2. The mode control and the `bounded: false` arm.
3. Follow camera, then the ocean readout.

