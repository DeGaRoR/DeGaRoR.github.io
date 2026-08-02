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
| B3 · Motion | "swims, looks alive not convulsive" | ⚠️ **gate green, human checkpoint never signed** |
| B4 · Breeding | the toy loop, playable | ⚠️ same — green, unsigned |
| **B5 · First light** | the art pass; "would you show someone a screenshot?" | ❌ **never started** |
| C1 · Sensors + probes | measurable creatures | ⚠️ green but **hollow** — S2 yields 1 trustworthy number of 8 |
| **C2 · Duels** | "watch three fights, say what it's good at" | ❌ **engine done, UI never built, checkpoint unanswerable** |
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

**Yes, and it should stop here.** The fluid model is now a coherent, measured,
gate-guarded Newtonian blade-element law with added mass. What remains on the fluid
side is either blocked (`MUSCLE_STRESS`, which pins 83% of the corpus at the speed
ceiling) or out of reach without a different geometry (skin friction, wakes,
circulatory lift). None of it is what stands between the project and being fun.

**What the engine work did NOT fix, and cannot:** the corpus swims at ~0.006
body-lengths/s against a real swimmer's 0.5–10, and slip (`U/V_wave`) is 0.00–0.05
against 0.5–0.8. That gap is **coordination and the morphology grammar**, not fluid.
Orientation is worse: 0.13–1.96 °/s, so a 135° turn takes about four minutes.

**The consequence for planning:** anything that needs a creature to *aim* is blocked.
Anything that needs it only to *move* is not.

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

### Step 1 — B5, the art pass (it is already happening)

`B5 · First light` was never started, and the tank is being critiqued organically
anyway. Fold that in: it is the milestone whose checkpoint is *"would you show someone
a screenshot?"*, and it is the cheapest route to the project feeling like something.

### Step 2 — food + kinesis (the playable one)

Per `PLAN-AFTER-B2.md` §2–3, with the four constraints in §4 above. This is the first
thing since B4 that changes what the player *does* rather than what the numbers say.

**Scope flag, stated as the plan itself states it:** this is D-tier work arriving
before C2 and D1. That may be exactly right — but do it knowingly, not by drift.

### Step 3 — orientation, and only then light

Light-following is the Sims demo and it is the natural finale. It has already been run
and it failed honestly: closest approach 2.92–2.99 cm against a 3.00 cm start —
*nobody gets near the light in either arm*. It needs orientation, and orientation is
the open research question. Do not attempt it before then.

### Not scheduled

`MUSCLE_STRESS → 2e6` (blocked on `STABLE_SPEED`), D1/D2/E1 (blocked on C2 and on
turn rate), skin friction / wake / circulatory lift (need a different geometry).

---

## 6. Debts this file does not discharge

- **Two normative planning docs are missing from the repo.** Recover or re-write
  `DESIGN-PHASE-B2` and the C0–C6 plan, or accept that ~40 gate comments cite
  documents nobody can read.
- **`CHANGELOG.md` is 8 patch versions stale.**
- **Nothing has ever been persisted.** `store.js` has the whole envelope/migration
  layer; grepping for `KEY.` outside it returns nothing. The Atlas is nine lines and
  its comment is false.
- **B3 and B4's human checkpoints are still unsigned.** Both say "watch the tank
  screen with a person". That is now overdue by many sessions.
