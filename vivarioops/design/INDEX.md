# VIVARIUM — specification set

**Revision R4, 2026-08-14.** The normative set is the ten numbered `VIVARIUM_*`
documents below, plus 13, 14 and 15, which were written later and are canonical for
their subjects. **`PLAN.md` is the entry point and the only live planning
document** — the spec set says what the thing is, `PLAN.md` says what happens next.

**R4's change, and why.** R3 said "nothing outside this folder is authoritative",
and then several sittings were planned entirely outside it — `ROADMAP.md`,
`HANDOFF.md`, `PLAN-AFTER-B2.md` and the handovers all issued instructions, three of
them claiming to supersede each other. Those four are now archive and carry banners
saying so. `PLAN.md` §9 is the complete map of what is live, what is archive and
what is a session record.

---

## Reading order

| # | Document | Read | Purpose |
|---|---|---|---|
| — | **`PLAN.md`** | **first, before every session** | Where the project stands, the phase ordering, the live debts, the standing rules |
| 00 | Vision & Design | **first, fully** | Thesis, principles, roadmap, risks, success criteria |
| 01 | Architecture & Contracts | **fully** | Layer boundaries, purity rules, determinism, units, versioning |
| 02 | Worlds & Environments | **fully** | The World object; W1 The Soup is the only world in the slice |
| 03 | **Contracts & Fixtures** | **fully, and treat as law** | The *only* definition of `Species`, `PairMatchup`, `WorldKey`, `W1_SLICE`, pinned dependencies |
| 10 | L1 Creature | when implementing B1–B5 | Genome, morphogenesis, controller, physics, mutation. Amendments A1–A6 override the ANNEX below them |
| 11 | L2 Bridge | when implementing C1–C2 | Probe abstraction, solo battery, duels, caching |
| 12 | L3 World | when implementing D1–D2 | Ecosystem, mass conservation, steering, verdict |
| 20 | Common Trunk | when implementing A1 | Shell tiers, **§3 the 22 non-negotiables**, gate, bench, versioning, PWA |
| 21 | UI | when implementing any screen | Screens, controls, states, gestures |
| 30 | Implementation Plan | for the slice's gates and stop conditions | Twelve sessions, gates, checkpoints, stop conditions. **Its ordering is history; `PLAN.md` owns ordering now** |
| 13 | Nomenclature | when touching naming | The binomial, the epithet table, author citations, recombination scars |
| 14 | Vernacular | when touching naming | The name a player actually says |
| 15 | Breeding and selection | before any selection run | The breeding method. §8's R1–R10 are law for any experiment; §7 lists what is still open |

**If 21 and 30 disagree on slice scope, 30 wins.**
**If any document restates a schema from 03, 03 wins.**
**If any document disagrees with `PLAN.md` about what happens next, `PLAN.md` wins.**

---

## What is deliberately not here

Superseded and historical files are excluded so no override chain can be reconstructed by
accident: `VIVARIUM_MVP_SPEC.md` (merged verbatim into 10 as its ANNEX), `SHELL_SPEC.md`
(superseded by 20), `VIVARIUM_UI_FUNCTIONAL_SPEC.md` (superseded by 21),
`VIVARIUM_L3_WORLD_SPEC.md` (renamed to 12), `VIVARIUM_REVIEW_R1.md` (incorporated).

**Source papers are not included** and should be attached separately when relevant:

- Sims, *Evolving Virtual Creatures*, SIGGRAPH '94 — needed for sessions B1–B4
- Sims, *Evolving 3D Morphology and Behavior by Competition*, ALife IV 1994 — needed for C2
- Ito, Pinheiro Saraiva, Suzuki, Arita, *Artificial Life* 22(2), MIT Press, 2016 — needed for D1–D2

---

## Reference implementations

Read for structure. Licence status matters and is recorded in 10 §A16.

| Repo | Licence | Read for |
|---|---|---|
| `mycoolfin/the-simsulator` | **MIT** — may adapt with attribution | Morphogenesis (`LimbCreator.cs`), mutation, genome |
| `jobtalle/PredatorPreySystem` | **MIT** — may adapt with attribution | Mass conservation, threshold reproduction |
| `SebLague/Boids` | **MIT** | Steering reference |
| `hanzholahs/evolving-creatures`, `khourihan/evolved-creatures`, `keiwando/evolution` | **no licence — read only, do not copy** | Ideas only |

---

## Current state

**Stale as written, and left here as an example of exactly the failure R4 fixes.**
It said *"design is complete, no further design work is required; next session is
A0 — Contracts as code"*. A0 shipped, and so did A1, B1–B5, C1, the Atlas, the
naming set, the tissue laws, the breeding campaign and two schema bumps.

**Current state now lives in one place: `PLAN.md` §1.** It carries the gate result
it was verified against, and it is the file to update when a phase lands.
