# PTIS_ROADMAP
## Process This In Space — Development Roadmap
### Baseline: v12.10.0 (289 tests, 20 registered units, 9 species, 3 reactions)

---

## Stages at a Glance

| Stage | Title | Sessions | Risk | New Tests | Cumulative | Key Deliverable |
|-------|-------|----------|------|-----------|------------|-----------------|
| S0 | NNG Consolidation | 1 | Low | ~2 | ~291 | 15 NNG rules, renumbered, sentinel |
| S1 | Thermo & Chemistry Foundation | 4 | Low | ~26 | ~317 | 10 species, 14 reactions, equipment limits |
| S2 | Power Management | 2 | Low | ~8 | ~325 | Overload/fry, priority shedding |
| S3 | Peng-Robinson EOS | 3 | Medium | ~15 | ~340 | Real-gas VLE, fugacity K-values |
| S4 | Separation & HEX Fix | 3 | Medium | ~12 | ~352 | Distillation column, UA/NTU fix |
| S5 | Pressure-Driven Flow | 7 | **High** | ~79 | ~431 | Reservoir, pressure network, Cv solver |
| S6 | Electrochemical Reactor | 2 | Low | ~8 | ~442 | Power-driven chemistry, electrode separation |
| S7 | Performance Maps | 4 | Low | ~5 | ~447 | VP envelopes, reactor/column maps |
| S7b | Unit Groups & Sub-Assemblies | 4 | Medium | ~18 | ~465 | GroupTemplateRegistry, overlay navigation, campaign composites |
| S8 | Game Layer | 12 | Medium | ~30 | ~495 | Build/Run loop, missions, campaign |
| | **Total** | **42** | | **~206** | **~495** | |

---

## S0 — NNG Consolidation

**What:** Consolidate NNG rules from 17 to 15. Renumber for
physics-first ordering. Absorb 3 redundant rules, extend 3, add 1
new (pressure-flow network). Update sentinel test.

**Sessions:** 1. Pure documentation + sentinel test. No functional
code changes.

**Governing design:** NNG-1 through NNG-15 defined in full in
`PTIS_S0_SPEC.md`.

**Spec:** `PTIS_S0_SPEC.md`

---

## S1 — Thermo & Chemistry Foundation

**What:** Fix thermodynamic data errors, register CO as 10th species,
expand from 3 to 14 reactions, build equipment limits infrastructure
with alarm integration.

**Sub-sessions:**
- **S1a** (1 session): H₂O cpig Tmin 500→298, CO₂ Antoine liquid-vapor
  range, CO species registration, KNOWN_KINETIC_MODELS += ELECTROCHEMICAL.
- **S1b** (1 session): Rename R_STEAM_REFORM → R_SMR_OVERALL. Register
  7 new reactions (R_HABER, R_SMR, R_WGS, R_RWGS, R_CH4_COMB, R_H2O_ELEC,
  R_CO2_ELEC). Every C/H/O/N species reachable.
- **S1c** (2 sessions): LIMIT_PARAM_TEMPLATES, limitParams on 12 process
  units. S-size limit data. getEffectiveLimits(), evaluateLimits(), alarm
  source. Default param fixes (tank 50→0.15 m³, reactor 1.0→0.003 m³).

**Why first:** Everything downstream needs correct thermo data and the
limits infrastructure. Reactions needed for S6. Limits needed for S7 overlays.

**Spec:** `PTIS_S1_SPEC.md`

---

## S2 — Power Management

**What:** Replace sink_electrical Infinity hack with ratedPower_kW.
Add overload/fry logic, priority-based load shedding, curtailment
signaling on direct connections.

**Sub-sessions:** 2 (hub logic + fry persistence, then curtailment).

**Why here:** S6 electrochemical reactor needs power demand contracts.
S5 production gating needs power ERROR integration.

**Spec:** `PTIS_S2_SPEC.md`

---

## S3 — Peng-Robinson Equation of State

**What:** Cubic EOS solver with fugacity-based VLE. Replaces Raoult
K-values with thermodynamically consistent fugacity coefficients.
Enthalpy/entropy departures for real compressor/JT calculations.

**Sub-sessions:**
- **S3a** (2 sessions): Cardano cubic solver, root selection, quantum gas
  guard (H₂/He), mixing rules (13 binary k_ij pairs), fugacity coefficients,
  K-values from φ_L/φ_V. Convergence fallbacks with alarms.
- **S3b** (1 session): H_dep/S_dep departure functions. Liquid density
  from Z_liq. Bubble/dew iteration. Compressor isentropic work via S_dep.
  Package selector (IDEAL/PR toggle). Full regression both packages.

**Why here:** S4 column needs PR K-values. S5 reservoir needs PR density.
S7 VP envelopes need PR Psat curves.

**Spec:** `PTIS_S3_SPEC.md`

---

## S4 — Separation & HEX Fix

**What:** FUG-method distillation column. Fix the UA/NTU two-phase
Cp bug in hxSolveUaNtu.

**Sub-sessions:**
- **S4a** (2 sessions): distillation_column unit (2×3 footprint, 5 ports).
  Fenske→Underwood→Gilliland method. Component distribution, energy balance,
  PH-flash on outlets.
- **S4b** (1 session): ~15-line fix to hxSolveUaNtu effective Cp at line 8561.
  Five refrigeration loop test cases (NH₃ JT, evaporator, condenser,
  end-to-end, CO₂ near-critical).

**Why here:** Column needs PR K-values from S3. HEX fix exposed by
PR-accurate JT cooling.

**Spec:** `PTIS_S4_SPEC.md`

---

## S5 — Pressure-Driven Flow

**What:** Replace user-stamped flow rates with pressure-driven flow
from ΔP across valves and resistances. New reservoir unit, pressure
propagation via BFS, algebraic Cv flow solver.

**Sub-sessions:**
- **S5a** (4 sessions): Reservoir unit (5-port, finite/reservoir modes,
  headspace pressure from PR density). atmosphere_sink (P_atm anchor).
  Pressure roles on all units. Resistance parameter k on passthrough
  units. UnionFind + BFS pressure propagation. Implicit check valves
  (all flows ≥ 0). Source backward compatibility.
- **S5b** (3 sessions): ΔP valve with Cv. Algebraic path solver (single
  path closed-form, branching linear/bisection). Production gating on
  pressure ERROR. Traffic light annotations. No-silent-clamping
  acceptance gate.

**Why here:** This is the deepest engine change — replaces the fundamental
flow model. S5a provides pressure as physical quantity; S5b adds flow from
ΔP. Split so S8 game development can proceed with S5a alone if needed.

**Split caveat:** S5a without S5b means flows are clamped to zero in
certain topologies with no visible alarm. This violates NNG-4 ("detected,
zeroed, and alarmed"). If S5b is deferred, a minimal alarm bridge (INFO
on every clamped flow) must ship with S5a to prevent silent failures.

**Risk note:** 79 tests — more than all other engine stages combined.
Test coverage spans four categories: (1) topology validation — invalid
networks fail predictably with alarms, (2) failure modes — every flow
clamped to zero produces a visible reason, (3) conservation — mass
balance closes across the pressure network, (4) performance — bounded
solve time, no pressure-flow iteration. Recommend S5a as a stable
checkpoint before S5b.

**Spec:** `PTIS_S5_SPEC.md`

---

## S6 — Electrochemical Reactor

**What:** Third reactor paradigm: power drives chemistry instead of
temperature. Extent of reaction proportional to electrical power input.

**Sub-sessions:** 2 (unit registration + tick, then inspector + tests).

**What it enables:** Water electrolysis (R_H2O_ELEC), CO₂ electrolysis
(R_CO2_ELEC). Campaign M2 electrolyzer, M10 greenhouse.

**Spec:** `PTIS_S6_SPEC.md`

---

## S7 — Performance Maps

**What:** Interactive canvas overlays on unit inspectors showing
operating envelopes, phase boundaries, and limit regions.

**Sub-sessions:** S7.1 (2), S7.2 (2) — 4 sessions total.
(Internal sub-sessions renamed from S7a/S7b to S7.1/S7.2 to avoid
collision with stage S7b.)

**Why last engine stage:** Needs PR curves (S3), column data (S4),
and limit regions (S1c) to display meaningful content.

**Spec:** `PTIS_S7_SPEC.md`

---

## S7b — Unit Groups & Sub-Assemblies

**What:** Canvas-level grouping system. Players can select multiple
units, group them into a named box with boundary ports, and
navigate into groups via an expand-in-place overlay. Includes
GroupTemplateRegistry for reusable templates and locked campaign
composites (greenhouse, human).

**Sub-sessions:**
- **S7b-1** (2 sessions): Data model (group fields on scene, units,
  connections). createGroup()/disbandGroup(). Boundary port
  auto-detection from cross-boundary connections. GroupTemplateRegistry
  with register/get/all/instantiate. Serialization round-trip.
- **S7b-2** (2 sessions): Expand-in-place overlay (dimmed parent +
  expanded container + active interior). Group header bar with ×
  close. Context menus (Open, Rename, Save as Template, Ungroup,
  Delete). Locked group overlay with selective editableParams.
  Campaign composite palette integration. Edge case tests +
  T-GR-INVARIANT (group/ungroup physics invariant).

**Key design decisions:**
- **Solver transparency:** Groups are canvas-only. The solver
  iterates flat unit lists and flat connections — no nesting
  in the solve cycle. NNG-3: a grouped scene produces identical
  physics to the same scene ungrouped.
- **Expand-in-place overlay:** Group expands from collapsed position;
  parent canvas dims to 30% opacity. Player maintains spatial
  context (sees where group sits in process). Not Blender's
  full-isolation Tab model.
- **UI accessibility:** Every action has a click/touch path.
  Keyboard shortcuts (Ctrl+G, Escape) are accelerators only.
- **Locked composites with selective parameter exposure:**
  `editableParams` field on TemplateUnit allows specific
  parameters to be editable even in locked groups (e.g.,
  greenhouse lighting efficiency).

**Why here (after S7, before S8):** Engine-first strategy — sandbox
gets full grouping infrastructure before campaign constrains it with
locked composites. S8c composites (greenhouse, human) are registered
as S7b group templates, not opaque units.

**Risk:** Medium. Expand-in-place overlay rendering is the most
complex canvas work. Boundary port delegation and solver invariant
are architecturally simple but require exhaustive testing.

**Spec:** `PTIS_S7b_SPEC.md`

---

## S8 — Game Layer

**What:** Transform the simulator into a playable survival-engineering
game with Kerbal-style Build/Run loop, 10-mission campaign, equipment
scarcity, and narrative integration. Composites (greenhouse, human)
implemented via S7b GroupTemplateRegistry.

**Sub-sessions:**
- **S8a** (4 sessions): Build/Run state machine. Auto-checkpoint on Play.
  Revert on catastrophic failure. Time warp with auto-decelerate. Topology
  edit guards. Scene serialization fix.
- **S8b** (4 sessions): MissionDefinition schema. MissionRegistry.
  6 objective evaluator types. Star ratings. Palette scarcity (count badges).
  paramLocks enforcement. Progressive hint system. Mission flow
  (briefing → build → run → evaluate → debrief).
- **S8c** (4 sessions): Depletable supply units (O₂ bottles, LiOH, water,
  MREs). Room unit (shelter as atmospheric tank). Campaign state + equipment
  inheritance. Save/load. Home screen + sandbox mode. M10 composites
  (greenhouse, human) as S7b locked group templates. membrane_separator
  defId. CH₂O species, R_PHOTOSYNTHESIS, R_METABOLISM. M10 fabrication
  unlock (unlimited equipment for power scaling).

**Governing design:** `game_arch_part_*.md` (Parts I–IV, VII–VIII).
S7b templates for greenhouse/human composites.

**Spec:** `PTIS_S8_SPEC.md`

---

## Critical Path

```
S0 → S1a → S1b → S1c → S2 → S3a → S3b → S5a → S5b → S7b-1 → S7b-2 → S8a → S8b → S8c
```

Longest chain: 14 sub-sessions on the critical path.

Note: S7b is on the critical path because S8c composites
(greenhouse, human) require GroupTemplateRegistry. S7 (Performance
Maps) is NOT on the critical path — it merges at S8 as an
enrichment, not a gate.

## Parallel Branches

| Branch | Branches from | Merges at |
|--------|--------------|-----------|
| S4a → S4b | S3b | S7 (column maps) |
| S6 | S2 | S8c (electrochemical units) |
| S7 | S1c + S3b + S4a | S7b (inspector hooks), S8 (visual feedback) |

See `PTIS_DEPENDENCY_MAP.html` for the full visual graph.

---

## Open Game Design Questions

### Resolved

1. ~~Tank variants~~ → `tank` defId with mission paramLocks for LP/HP
   rating differences. `tank_cryo` (Dewar) as separate defId (different
   physical machine). See NNG-3 decision tree in S8 §S8c-3b.
2. ~~Electrolyzer outlets~~ → S6 specifies 2 outlets: mat_out_cat
   (cathode) + mat_out_ano (anode). Electrode separation by design.
3. ~~Reactor visual variants~~ → Deferred. Same defId, cosmetic
   presentations only. No engine impact.
4. ~~M10 power budget (85 kW)~~ → Greenhouse η = 1% (validated
   against NASA data), 7 colonists, 85 kW electrical demand.
   Resolution: (a) M10 unlocks fabrication — unlimited equipment
   counts, player builds 4–5 combined cycle power blocks at ~20 kW
   each; (b) S7b group templates make building at scale manageable;
   (c) greenhouse lighting efficiency (η) is editable on the locked
   template (0.5–5%), letting the player trade realism for
   practicality. See `PTIS_BIOSPHERE_POWER_RECONCILIATION.md`.
5. ~~Distillation column restrictions~~ → No restrictions. Available
   in sandbox and campaign. Mission palette controls availability.
6. ~~CH₂O registration~~ → S8c session 1.
7. ~~Composites as opaque units vs transparent groups~~ → S7b locked
   group templates. Greenhouse and human are composed of real units
   (reactor_electrochemical, reactor_equilibrium, membrane_separator)
   that the player can inspect. Not opaque defIds with bespoke ticks.

### Still Open

None. All open design questions resolved.

### Architecture Decisions (2026-02-22)

Cross-cutting decisions on shared tick trunks, port labels, equipment
variant strategy, fuel cell, steam turbine, co-electrolysis recorded
in S8 §S8c-3b (trunk architecture, decision tree, future extension
path).

S7b expand-in-place overlay model, editableParams selective parameter
exposure, and GroupTemplateRegistry design recorded in `PTIS_S7b_SPEC.md`.

Biosphere power reconciliation (metabolic rates, greenhouse efficiency,
M10 power supply resolution) recorded in
`PTIS_BIOSPHERE_POWER_RECONCILIATION.md`.
