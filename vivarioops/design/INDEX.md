# VIVARIUM — specification set

**Revision R3.** Ten documents. This is the complete and exclusive normative set.
Nothing outside this folder is authoritative.

---

## Reading order

| # | Document | Read | Purpose |
|---|---|---|---|
| 00 | Vision & Design | **first, fully** | Thesis, principles, roadmap, risks, success criteria |
| 01 | Architecture & Contracts | **fully** | Layer boundaries, purity rules, determinism, units, versioning |
| 02 | Worlds & Environments | **fully** | The World object; W1 The Soup is the only world in the slice |
| 03 | **Contracts & Fixtures** | **fully, and treat as law** | The *only* definition of `Species`, `PairMatchup`, `WorldKey`, `W1_SLICE`, pinned dependencies |
| 10 | L1 Creature | when implementing B1–B5 | Genome, morphogenesis, controller, physics, mutation. Amendments A1–A6 override the ANNEX below them |
| 11 | L2 Bridge | when implementing C1–C2 | Probe abstraction, solo battery, duels, caching |
| 12 | L3 World | when implementing D1–D2 | Ecosystem, mass conservation, steering, verdict |
| 20 | Common Trunk | when implementing A1 | Shell tiers, **§3 the 22 non-negotiables**, gate, bench, versioning, PWA |
| 21 | UI | when implementing any screen | Screens, controls, states, gestures |
| 30 | Implementation Plan | **before every session** | Twelve sessions, gates, checkpoints, stop conditions |

**If 21 and 30 disagree on slice scope, 30 wins.**
**If any document restates a schema from 03, 03 wins.**

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

**Design is complete. No further design work is required.**

Next session is **A0 — Contracts as code** (30 §3): schemas as executable modules,
`w1_slice.js`, exact pinned dependencies with a committed lockfile, reference commit
SHAs, and the answer on whether Rapier's JS build exposes `enhanced-determinism`.
