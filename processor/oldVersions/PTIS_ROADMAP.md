# PTIS_ROADMAP
## Process This In Space — Development Roadmap
### Baseline: v12.10.0 (289 tests, 20 registered units, 9 species, 3 reactions)

---

## Stages at a Glance

| Stage | Title | Sessions | Risk | New Tests | Cumulative | Key Deliverable |
|-------|-------|----------|------|-----------|------------|-----------------|
| S1 | Thermo & Chemistry Foundation | 4 | Low | ~23 | ~312 | 10 species, 11 reactions, equipment limits |
| S2 | Power Management | 2 | Low | ~8 | ~320 | Overload/fry, priority shedding |
| S3 | Peng-Robinson EOS | 3 | Medium | ~15 | ~335 | Real-gas VLE, fugacity K-values |
| S4 | Separation & HEX Fix | 3 | Medium | ~12 | ~347 | Distillation column, UA/NTU fix |
| S5 | Pressure-Driven Flow | 4 | **High** | ~79 | ~426 | Reservoir, pressure network, Cv solver |
| S6 | Electrochemical Reactor | 1 | Low | ~8 | ~434 | Power-driven chemistry |
| S7 | Performance Maps | 2 | Low | ~5 | ~439 | VP envelopes, reactor/column maps |
| S8 | Game Layer | 6 | Medium | ~30 | ~469 | Build/Run loop, missions, campaign |
| | **Total** | **25** | | **~180** | **~469** | |

---

## S1 — Thermo & Chemistry Foundation

**What:** Fix thermodynamic data errors, register CO as 10th species,
expand from 3 to 11 reactions, build equipment limits infrastructure
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
- **S5a** (2 sessions): Reservoir unit (5-port, finite/reservoir modes,
  headspace pressure from PR density). atmosphere_sink (P_atm anchor).
  Resistance parameter k on passthrough units. UnionFind + BFS pressure
  propagation. Implicit check valves (all flows ≥ 0). Source backward
  compatibility.
- **S5b** (2 sessions): ΔP valve with Cv. Algebraic path solver (single
  path closed-form, branching linear/bisection). Production gating on
  pressure ERROR. Traffic light annotations.

**Why here:** This is the deepest engine change — replaces the fundamental
flow model. S5a provides pressure as physical quantity; S5b adds flow from
ΔP. Split so S8 game development can proceed with S5a alone if needed.

**Risk note:** 79 tests — more than all other engine stages combined.
Recommend S5a as a stable checkpoint before S5b.

**Spec:** `PTIS_S5_SPEC.md`

---

## S6 — Electrochemical Reactor

**What:** Third reactor paradigm: power drives chemistry instead of
temperature. Extent of reaction proportional to electrical power input.

**Sub-sessions:** 1.

**What it enables:** Water electrolysis (R_H2O_ELEC), CO₂ electrolysis
(R_CO2_ELEC). Campaign M2 electrolyzer, M10 greenhouse.

**Spec:** `PTIS_S6_SPEC.md`

---

## S7 — Performance Maps

**What:** Interactive canvas overlays on unit inspectors showing
operating envelopes, phase boundaries, and limit regions.

**Sub-sessions:** 2 (canvas infrastructure + VP/phase maps, then
reactor/column/limit maps with inspector hooks).

**Why last engine stage:** Needs PR curves (S3), column data (S4),
and limit regions (S1c) to display meaningful content.

**Spec:** `PTIS_S7_SPEC.md`

---

## S8 — Game Layer

**What:** Transform the simulator into a playable survival-engineering
game with Kerbal-style Build/Run loop, 10-mission campaign, equipment
scarcity, and narrative integration.

**Sub-sessions:**
- **S8a** (2 sessions): Build/Run state machine. Auto-checkpoint on Play.
  Revert on catastrophic failure. Time warp with auto-decelerate. Topology
  edit guards. Scene serialization fix.
- **S8b** (2 sessions): MissionDefinition schema. MissionRegistry.
  6 objective evaluator types. Star ratings. Palette scarcity (count badges).
  paramLocks enforcement. Progressive hint system. Mission flow
  (briefing → build → run → evaluate → debrief).
- **S8c** (2 sessions): Depletable supply units (O₂ bottles, LiOH, water,
  MREs). Room unit (shelter as atmospheric tank). Campaign state + equipment
  inheritance. Save/load. Home screen + sandbox mode. M10 composites
  (greenhouse, human, CH₂O species, R_PHOTOSYNTHESIS, R_METABOLISM).

**Governing design:** `game_arch_part_*.md` (Parts I–IV, VII–VIII).

**Spec:** `PTIS_S8_SPEC.md`

---

## Critical Path

```
S1a → S1b → S1c → S2 → S3a → S3b → S5a → S5b → S8a → S8b → S8c
```

Longest chain: 11 sub-sessions on the critical path.

## Parallel Branches

| Branch | Branches from | Merges at |
|--------|--------------|-----------|
| S4a → S4b | S3b | S7 (column maps) |
| S6 | S2 | S8c (electrochemical units) |
| S7 | S1c + S3b + S4a | S8 (inspector integration) |

See `PTIS_DEPENDENCY_MAP.md` for the full visual graph.

---

## Open Game Design Questions (Do Not Block Engine Work)

1. Tank variants: LP / HP / Dewar as separate defIds or one unit?
2. Electrolyzer: dedicated unit (2 gas outlets) or generic reactor_electrochemical?
3. Reactor visual variants: combustion chamber vs catalytic bed presentation?
4. M10 power budget: 82 kW grow lights — multiple Brayton units, solar, or tunable LED efficiency?
5. Distillation column: sandbox-only or possible in future campaign chapters?
6. CH₂O registration: with M10 composites in S8c, or earlier for engine completeness?

These are recorded and deferred. The engine spec for each stage is complete
without resolving them. Game architecture docs hold the design context.
