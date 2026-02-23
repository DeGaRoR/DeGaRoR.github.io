# PTIS_ROADMAP
## Process This In Space — Development Roadmap
### Baseline: v12.10.0 (289 tests, 20 registered units, 9 species, 3 reactions)

---

## Stages at a Glance

| Stage | Title | Sessions | Risk | New Tests | Cumulative | Key Deliverable |
|-------|-------|----------|------|-----------|------------|-----------------|
| S0 | NNG Consolidation | 1 | Low | ~2 | ~291 | 15 NNG rules, renumbered, sentinel |
| S1 | Thermo & Chemistry Foundation | 4 | Low | ~26 | ~317 | 10 species, 14 reactions, equipment limits |
| S2 | Power Management | 2 | Low | ~8 | ~325 | Overload/fry, priority shedding, shared allocation |
| S3 | Peng-Robinson EOS | 3 | Medium | ~15 | ~340 | Real-gas VLE, fugacity K-values, ice detection |
| S4 | Separation & HEX Fix | 3 | Medium | ~12 | ~352 | Distillation column, UA/NTU fix |
| S5 | Pressure-Driven Flow | **8** | **High** | **~83** | **~435** | Reservoir, pressure network, Cv solver, splitter/mixer manifold |
| S6 | **Reactor Architecture** | **4** | **Medium** | **~16** | **~451** | 5 reactor defIds, HEAT purge, electrochemical |
| S7 | Performance Maps | **5** | Low | **~7** | **~458** | VP envelopes, reactor/column maps, time-series recorder |
| S8 | Unit Groups & Sub-Assemblies | **5** | Medium | **~18** | **~476** | GroupTemplateRegistry, scaling, stream visuals, level display |
| | | | | | | ⚙ **GAME GATE** ⚙ |
| S9 | Game Engine Extensions | 2 | Low | **~10** | **~486** | New defIds, CH₂O, membrane depletable params |
| **S9b** | **Validation Gate** | **3–5** | **Low** | **0** | **~486** | **Manual integration QC — composite + mission mock-builds** |
| S10 | Game Layer | 10 | Medium | ~22 | ~508 | Build/Run loop, missions, campaign |
| | **Total** | **~50–52** | | **~219** | **~508** | |

### Renumbering History (February 2026)

| Old | New | Reason |
|-----|-----|--------|
| S7b | **S8** | Promoted to full stage — grouping is core engine infrastructure |
| S8 (engine registrations) | **S9** | Extracted from old S8c — new defIds, species, reactions are engine work |
| S8 (game mechanics + content) | **S10** | Pure game layer — state machine, missions, campaign |
| — | **S9b** | Validation gate inserted between engine completion and game layer |

### Amendment History (February 2026)

Design Amendment S2 introduced the following structural changes:

| Change | Impact |
|--------|--------|
| NNG-2, NNG-3 additions (heating/cooling, no HEAT type, no conditional ports) | S0 |
| HEAT port type purge | S0, S6, S9, Equipment Matrix |
| Reactor taxonomy: `reactor_equilibrium` → 5 defIds | S6 expanded to S6a/S6b |
| Splitter/mixer manifold | S5c sub-session added |
| Generic allocation algorithm | S2 (forward-looking for S5c reuse) |
| Ice detection (solidRisk) | S3b |
| Composite models extracted to PTIS_COMPOSITE_MODELS.md | S8, S9, S10 reference |
| Scaling mechanism for group templates | S8 |
| Stream visual coding + level display | S8 |
| Time-series recorder (in-house, no dependencies) | S7 |
| Validation gate | S9b |
| T_amb(t) + PlanetRegistry | S5a |
| membrane_separator depletable params (LiOH) | S9 |
| Greenhouse η default 1% → 2% | S6, S9, S10, Biosphere Reconciliation |

---

## S0 — NNG Consolidation

**What:** Consolidate NNG rules from 17 to 15. Renumber for
physics-first ordering. Absorb 3 redundant rules, extend 3, add 1
new (pressure-flow network). Update sentinel test. Update all
codebase NNG references.

**Amendment additions:**
- NNG-2: Heating electrical, cooling via material circuit. No exceptions.
- NNG-3: No port without a physical pipe or cable. No abstract HEAT
  type. Only MATERIAL and ELECTRICAL port types exist.
- NNG-3: No conditional port visibility. Every defId has a fixed,
  unconditional port layout.
- Port type enum: Remove HEAT. Only MATERIAL + ELECTRICAL remain.

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
signaling on direct connections. Includes generic `allocateByPriority()`
utility shared with S5c.

**Sub-sessions:** 2 (hub logic + fry persistence, then curtailment).

**Shared allocation utility:** `allocateByPriority(supply, demands, strategy)`
is implemented here as a generic function supporting both `proportional`
and `priority` strategies. Power dispatch calls it internally. S5c
splitter manifold reuses it for flow allocation. Domain-agnostic by
design — takes a total supply, a list of `{id, amount, priority}`
demands, and a strategy string. Returns `{id, allocated}` array.

**Why here:** S6 electrochemical reactor needs power demand contracts.
S5 production gating needs power ERROR integration.

**Spec:** `PTIS_S2_SPEC.md`

---

## S3 — Peng-Robinson Equation of State

**What:** Cubic EOS solver with fugacity-based VLE. Replaces Raoult
K-values with thermodynamically consistent fugacity coefficients.
Enthalpy/entropy departures for real compressor/JT calculations.
Ice detection in S3b.

**Sub-sessions:**
- **S3a** (2 sessions): Cardano cubic solver, root selection, quantum gas
  guard (H₂/He), mixing rules (13 binary k_ij pairs), fugacity coefficients,
  K-values from φ_L/φ_V. Convergence fallbacks with alarms.
- **S3b** (1 session): H_dep/S_dep departure functions. Liquid density
  from Z_liq. Bubble/dew iteration. Compressor isentropic work via S_dep.
  Package selector (IDEAL/PR toggle). **Ice detection:** `solidRisk`
  flag in flash calculation (T < 273.15 && x_H2O_liquid > 1e-6), with
  per-unit alarm consequences (HEX frost, pipe blockage, valve damage).
  Full regression both packages.

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
propagation via BFS, algebraic Cv flow solver. Splitter/mixer manifold
with flow control. PlanetRegistry for ambient conditions.

**Sub-sessions:**
- **S5a** (4 sessions): Reservoir unit (5-port, finite/reservoir modes,
  headspace pressure from PR density). atmosphere_sink (P_atm anchor).
  Pressure roles on all units. Resistance parameter k on passthrough
  units. UnionFind + BFS pressure propagation. Implicit check valves
  (all flows ≥ 0). Source backward compatibility. **PlanetRegistry:**
  atmosphere composition, surface P, T_mean, diurnal T variation
  (sinusoidal ±amplitude with noise). `T_amb(t)` computed from registry.
  Diurnal toggle: campaign on, sandbox off (fixed T_amb for debugging).
- **S5b** (3 sessions): ΔP valve with Cv. Algebraic path solver (single
  path closed-form, branching linear/bisection). Production gating on
  pressure ERROR. Traffic light annotations. No-silent-clamping
  acceptance gate.
- **S5c** (1 session): Splitter manifold (`splitter_manifold`, N outlets,
  `flow_controlled` + `ratio` modes). Mixer manifold (N inlets, passive
  merge). Curtailment via `allocateByPriority()` from S2. +4 tests.

**Why here:** This is the deepest engine change — replaces the fundamental
flow model. S5a provides pressure as physical quantity; S5b adds flow from
ΔP; S5c adds controlled flow distribution needed for life support.

**Critical path dependency:** S5b → S5c → S8.

**Risk note:** 83 tests — more than all other engine stages combined.
Recommend S5a as a stable checkpoint before S5b.

**Naming convention:** All units simulating a control loop use consistent
mode names: `pressure_controlled` (compressor, pump, valve),
`flow_controlled` (splitter_manifold), `temperature_controlled`
(heater, air_cooler).

**Splitter progression in campaign:**

| Mission | Equipment | Capability |
|---------|-----------|-----------|
| M3 | `splitter` (simple 2-outlet tee) | Ratio mode only |
| M7 | `splitter_manifold` (N outlets, flow control) | flow_controlled mode, priority curtailment |

**Spec:** `PTIS_S5_SPEC.md`

---

## S6 — Reactor Architecture

**What:** Comprehensive reactor restructure. Split `reactor_equilibrium`
into three defIds with fixed port layouts (NNG-3 compliance). Revise
electrochemical reactor and fuel cell to remove HEAT port type. Five
reactor defIds total, all sharing two named trunks.

**Sub-sessions:**
- **S6a** (2 sessions): Remove `reactor_equilibrium`. Create
  `reactor_adiabatic` (2 ports, mat_in + mat_out),
  `reactor_jacketed` (3 ports, + elec_in for heating),
  `reactor_cooled` (4 ports, + cool_in/cool_out for cooling jacket).
  Rename trunk `reactorTick` → `equilibriumTick`. Config-driven
  branching. `reactor_cooled` embeds HEX logic via `heatExchangerTick`
  internally.
- **S6b** (2 sessions): `reactor_electrochemical` (4 ports — remove
  heat_out, adiabatic on material side, η default 0.90). `fuel_cell`
  (6 ports — replace heat_out with cool_in/cool_out MATERIAL, mandatory
  cooling water circuit with internal HEX). `electrochemicalTick` trunk
  shared by both. Inspector, KPIs, ~16 tests.

**Trunk table after S6:**

| Trunk | defIds sharing |
|-------|---------------|
| `equilibriumTick` | reactor_adiabatic, reactor_jacketed, reactor_cooled |
| `electrochemicalTick` | reactor_electrochemical, fuel_cell |

**reactor_equilibrium removal:** The defId ceases to exist after S6a.
All references in S7+ specs use the new defIds. Pre-S6 specs (S0–S5)
retain `reactor_equilibrium` references because it exists during their
implementation.

**S4b dependency note:** `reactor_cooled` uses `heatExchangerTick`
internally. If S4b (HEX Cp fix) is complete before S6a, reactor_cooled
benefits. If not, it inherits the two-phase Cp bug for its cooling
jacket — acceptable until S4b merges.

**S6 can optionally start as early as post-S2.** The dependency is
S2→S6, not S5→S6. There are ~10 sessions of slack on the parallel
branch.

**Spec:** `PTIS_S6_SPEC.md`

---

## S7 — Performance Maps

**What:** Interactive canvas overlays on unit inspectors showing
operating envelopes, phase boundaries, and limit regions. In-house
time-series recorder for monitoring simulation variables.

**Sub-sessions:** S7.1 (2), S7.2 (2), S7.3 (1) — 5 sessions total.

- **S7.1** (2 sessions): VP envelope overlays, reactor conversion maps.
- **S7.2** (2 sessions): Column separation maps, compressor curves.
- **S7.3** (1 session): Time-series recorder. Generic variable recorder
  built in vanilla JS (no external dependencies). Ring buffer with
  configurable time window. Canvas line renderer with zoom/pan. Legend
  toggling. Any numeric value from any unit can be recorded. Player
  toggles recording on inspector values. Multiple channels overlay on
  shared chart.

**Why no external dependency:** The application is a zero-dependency
28,000-line single-file HTML app. The recorder's requirements (3–8
channels, ~1000 visible points, time axis) are modest. In-house
implementation (~550 lines) preserves the offline-capable architecture.
Renderer is swappable if a library is justified later.

**Why last pure-engine stage before grouping:** Needs PR curves (S3),
column data (S4), and limit regions (S1c) to display meaningful content.

**Spec:** `PTIS_S7_SPEC.md`

---

## S8 — Unit Groups & Sub-Assemblies

**What:** Canvas-level grouping system. Players can select multiple
units, group them into a named box with boundary ports, and
navigate into groups via an expand-in-place overlay. Includes
GroupTemplateRegistry for reusable templates and locked campaign
composites (greenhouse, human). Generic scaling mechanism for
population/rack growth. Stream visual coding and liquid level display.

**Sub-sessions:**
- **S8-1** (2 sessions): Data model (group fields on scene, units,
  connections). createGroup()/disbandGroup(). Boundary port
  auto-detection from cross-boundary connections. GroupTemplateRegistry
  with register/get/all/instantiate. Serialization round-trip.
  **Scaling mechanism:** `scaleParam`, `scaleDefault`, `scaleRules`
  on GroupTemplate. Solver applies `baseValue × scale × factor` to
  each rule's target parameter per tick. Generic: human uses
  `population`, greenhouse uses `racks`.
- **S8-2** (2 sessions): Expand-in-place overlay (dimmed parent +
  expanded container + active interior). Group header bar with ×
  close. Context menus (Open, Rename, Save as Template, Ungroup,
  Delete). Locked group overlay with selective editableParams.
  Campaign composite palette integration. Edge case tests +
  T-GR-INVARIANT (group/ungroup physics invariant).
- **S8-3** (1 session): **Stream visual coding:** Color encodes
  temperature (blue→white→red gradient), thickness encodes mass
  flow rate (logarithmic, 1–6px). Configurable modes via toolbar
  dropdown (temperature, phase, pressure, species highlight).
  Electrical streams: fixed yellow/gold, thickness = power.
  **Liquid level display:** All inventory units show fill level.
  Tanks, flash drums, buffers animate level between ticks. Empty
  vessels show dry. Full vessels show overflow alarm color.

**Key design decisions:**
- **Solver transparency:** Groups are canvas-only. The solver
  iterates flat unit lists and flat connections — no nesting
  in the solve cycle.
- **Expand-in-place overlay:** Group expands from collapsed position;
  parent canvas dims to 30% opacity.
- **Locked composites with selective parameter exposure:**
  `editableParams` field allows specific parameters to be editable
  even in locked groups (e.g., greenhouse lighting efficiency).

**Why here (after S7, before S9):** Engine-first strategy — sandbox
gets full grouping infrastructure before the game layer constrains it
with locked composites. S10 composites (greenhouse, human) are
registered as S8 group templates, not opaque units.

**Composite model source of truth:** `PTIS_COMPOSITE_MODELS.md`.
S8 provides the GroupTemplate infrastructure; composite definitions
reference the models document for template registration code,
internal unit lists, and boundary port mappings.

**Spec:** `PTIS_S8_SPEC.md`

---

### ⚙ GAME GATE ⚙

Everything above (S0–S8) constitutes the complete simulation engine:
476 tests, all physics, all grouping infrastructure, all inspector
overlays, stream visuals. The simulator works as a standalone sandbox.

Everything below (S9–S10) adds game-specific content and mechanics.
S9 extends the engine with units and chemistry needed by the campaign.
S9b validates composite integration. S10 wraps the engine in a
playable game.

---

## S9 — Game Engine Extensions

**What:** Register new defIds, species, and reactions required by
the campaign but architecturally part of the engine. These units
share tick trunks with existing units and follow the same NNG rules.
They work in sandbox mode regardless of whether the game layer is
loaded.

**Sub-sessions:** 2 (defId registrations + tests).

**Content:**
- **New defIds:** `steam_turbine` (expanderTick trunk, moistureCheck),
  `tank_cryo` (vesselTick trunk, Dewar limits), `membrane_separator`
  (new separatorTick trunk), `fuel_cell` (electrochemicalTick trunk,
  generate mode — data registration only, not in current 10 missions).
- **membrane_separator depletable params:** Optional `depletable: false`,
  `sorbentCapacity: Infinity`, `sorbentRemaining: Infinity` parameters.
  When `depletable: true`, the trunk decrements sorbent per absorbed
  moles. When sorbent = 0, selectivity drops to 0 (passthrough).
  Alarm at sorbent < 20%. Used by LiOH scrubber instance in S10.
- **New species:** CH₂O (formaldehyde, food proxy, MW 30.026).
- **New reactions:** R_PHOTOSYNTHESIS (CO₂ + H₂O → CH₂O + O₂,
  +519.4 kJ/mol, ELECTROCHEMICAL), R_METABOLISM (CH₂O + O₂ → CO₂ + H₂O,
  −519.4 kJ/mol, POWER_LAW complete conversion).
- **Trunk architecture:** Shared tick trunk documentation and
  config-driven branching for all defId families.

**Dependencies:** S8 (GroupTemplateRegistry — composites use these
units inside group templates). S6 (electrochemicalTick trunk shared
by fuel_cell). S2 (power contracts for fuel_cell generate mode).

**Spec:** `PTIS_S9_SPEC.md`

---

## S9b — Validation Gate

**What:** Manual integration QC step. Build biosphere models by hand
in the simulator (all S9 units available in sandbox) and verify they
work before the game layer wraps them. No new code artifacts — test
scenes and documented results. Outputs are bug reports that patch
S6–S9 and composite models.

**Sessions:** 3–5.

**Structure:**

**V-0 — Composite Sub-Gate (mandatory, ~2 sessions):**

| Step | What you build | Pass criteria |
|------|---------------|---------------|
| V-0a | Human standalone (air + food + water, 1 hr) | Rates match PTIS_COMPOSITE_MODELS §1 |
| V-0b | Human air cut → buffer depletion | WARNING ~3 min, CRITICAL ~5.5 min |
| V-0c | Human water cut → dehydration | WARNING ~36 hr, CRITICAL ~68 hr |
| V-0d | Human food cut → starvation | WARNING ~4 days, CRITICAL ~17 days |
| V-0e | Greenhouse standalone (CO₂ + water + NH₃ + power, 1 hr) | O₂ and CH₂O at expected rates |
| V-0f | Greenhouse water cut → soil buffer depletion | WARNING ~4 hr |
| V-0g | Human + Greenhouse + Room closed loop | O₂/CO₂ stabilize, mass balance closes |

**V-1 — Milestone Mission Mock-Builds (prioritized, ~2 sessions):**

| Step | Mission | What you build | Key validation |
|------|---------|---------------|---------------|
| V-1a | M1 Water | Vent → cooler → flash → tank | 100 mol H₂O stored |
| V-1b | M4 Power | Brayton cycle from vent gas | ~5 kW sustained |
| V-1c | M10 Biosphere | Full closed loop at scale (7 ppl) | Mass balance closes, power achievable |

**V-2 — Remaining Missions (best-effort, ~1 session):**

Quick sanity checks for M2, M3, M5–M9. Equipment placement,
flow direction, star criteria math. Not full transient runs.

**Dependencies:** S9 (all units available), S8 (grouping for composites).

**Required by:** S10 (composites verified before game layer wraps them).

---

## S10 — Game Layer

**What:** Transform the simulator into a playable survival-engineering
game with Kerbal-style Build/Run loop, 10-mission campaign, equipment
scarcity, and narrative integration. Composites (greenhouse, human)
implemented via S8 GroupTemplateRegistry using S9-registered units.

**Sub-sessions:**
- **S10a** (3 sessions): Build/Run state machine. Auto-checkpoint on Play.
  Revert on catastrophic failure. Time warp with auto-decelerate. Topology
  edit guards. Scene serialization.
- **S10b** (4 sessions): MissionDefinition schema. MissionRegistry.
  6 objective evaluator types. Star ratings. Palette scarcity (count badges).
  paramLocks enforcement. Progressive hint system. Mission flow
  (briefing → build → run → evaluate → debrief).
- **S10c** (3 sessions): Depletable supply units (O₂ bottles, LiOH
  scrubber via membrane_separator with depletable params, water jerricans
  EMPTY, MRE crate 3000 mol CH₂O, battery 75 kWh). Room unit
  (shelter as atmospheric tank, see PTIS_COMPOSITE_MODELS §3).
  Campaign state + equipment inheritance. Save/load. Home screen +
  sandbox mode. Greenhouse and human composite templates registered
  via S8 GroupTemplateRegistry (see PTIS_COMPOSITE_MODELS §1–§2).
  10 mission data definitions. M10 fabrication unlock.

**Governing design:** `PTIS_GAME_DESIGN.md` (unified game design
document covering philosophy, missions, equipment stories, biosphere
concept, UX vision).

**Composite model source of truth:** `PTIS_COMPOSITE_MODELS.md`.

**Spec:** `PTIS_S10_SPEC.md`

---

## Critical Path

```
S0 → S1a → S1b → S1c → S2 → S3a → S3b → S5a → S5b → S5c → S8 → S9 → S9b → S10a → S10b → S10c
```

Longest chain: 16 sub-sessions on the critical path.

Note: S8 is on the critical path because S10c composites (greenhouse,
human) require GroupTemplateRegistry. S7 (Performance Maps) is NOT on
the critical path — it merges at S10 as a visual enrichment, not a gate.

## Parallel Branches

| Branch | Branches from | Merges at |
|--------|--------------|-----------|
| S4a → S4b | S3b | S7 (column maps) |
| S6a → S6b | S2 | S9 (reactor defIds + electrochemicalTick for fuel_cell) |
| S7 | S1c + S3b + S4a | S8 (inspector hooks), S10 (visual feedback) |

S6 note: S6 can optionally start as early as post-S2 if there is
development bandwidth. The dependency is S2→S6, not S5→S6.

See `PTIS_DEPENDENCY_MAP.html` for the full visual graph.

---

## Document Map

### Roadmap & Reference
| Document | Purpose |
|----------|---------|
| `PTIS_ROADMAP.md` | This file — stage overview, critical path, open questions |
| `PTIS_DEPENDENCY_MAP.html` | Visual dependency graph |
| `PTIS_EQUIPMENT_MATRIX.md` | Canonical equipment, species, reaction, and progression tables |
| `PTIS_BIOSPHERE_POWER_RECONCILIATION.md` | Biosphere derivations, cross-spec consistency checks |
| `PTIS_COMPOSITE_MODELS.md` | Human, greenhouse, room models — conceptual + implementation |

### Engine Specs (S0–S9)
| Document | Stage | Content |
|----------|-------|---------|
| `PTIS_S0_SPEC.md` | S0 | NNG consolidation |
| `PTIS_S1_SPEC.md` | S1 | Thermo & chemistry foundation |
| `PTIS_S2_SPEC.md` | S2 | Power management + shared allocation utility |
| `PTIS_S3_SPEC.md` | S3 | Peng-Robinson EOS + ice detection |
| `PTIS_S4_SPEC.md` | S4 | Separation & HEX fix |
| `PTIS_S5_SPEC.md` | S5 | Pressure-driven flow + splitter/mixer manifold + PlanetRegistry |
| `PTIS_S6_SPEC.md` | S6 | Reactor architecture (5 defIds, HEAT purge) |
| `PTIS_S7_SPEC.md` | S7 | Performance maps + time-series recorder |
| `PTIS_S8_SPEC.md` | S8 | Unit groups, scaling, stream visuals, level display |
| `PTIS_S9_SPEC.md` | S9 | Game engine extensions (new defIds, species, reactions) |

### Game Specs (S9b–S10)
| Document | Stage | Content |
|----------|-------|---------|
| *(S9b defined in this roadmap)* | S9b | Validation gate — composite QC, mission mock-builds |
| `PTIS_S10_SPEC.md` | S10 | Game layer implementation (state machine, missions, campaign) |
| `PTIS_GAME_DESIGN.md` | — | Unified game design (philosophy, narrative, missions, UX) |

### Archived
| Document | Replaced by |
|----------|-------------|
| `game_arch_part_1_to_3_description.md` | `PTIS_GAME_DESIGN.md` Parts I–III |
| `game_arch_part_4_missions.md` | `PTIS_GAME_DESIGN.md` Part IV + `PTIS_S10_SPEC.md` |
| `game_arch_part_5_biosphere.md` | `PTIS_GAME_DESIGN.md` Part V + `PTIS_COMPOSITE_MODELS.md` |
| `game_arch_part_6_room.md` | `PTIS_GAME_DESIGN.md` Part VI + `PTIS_COMPOSITE_MODELS.md` |
| `game_arch_part_7_equipment.md` | `PTIS_GAME_DESIGN.md` Part VII + `PTIS_EQUIPMENT_MATRIX.md` |
| `game_arch_part_8_ux.md` | `PTIS_GAME_DESIGN.md` Part VIII |
| `biosphere-loop-design-v3.md` | `PTIS_BIOSPHERE_POWER_RECONCILIATION.md` + `PTIS_COMPOSITE_MODELS.md` |
| `PTIS_DESIGN_AMENDMENT_S2_FINAL.md` | Propagated into all target specs (this roadmap, S0–S10, Equipment Matrix, Biosphere Reconciliation, Composite Models) |

---

## Open Game Design Questions

### Resolved

1. ~~Tank variants~~ → `tank` defId with mission paramLocks for LP/HP
   rating differences. `tank_cryo` (Dewar) as separate defId (different
   physical machine). See NNG-3 decision tree in S9 spec.
2. ~~Electrolyzer outlets~~ → S6 specifies 2 outlets: mat_out_cat
   (cathode) + mat_out_ano (anode). Electrode separation by design.
3. ~~Reactor visual variants~~ → Deferred. Same defId, cosmetic
   presentations only. No engine impact.
4. ~~M10 power budget~~ → Greenhouse η = 2% (default, editable 0.5–5%),
   7 colonists, ~42 kW electrical demand. Achievable with 2–3 combined
   cycle power blocks. Player can chase η=1% for ★★★ challenge.
   See `PTIS_BIOSPHERE_POWER_RECONCILIATION.md`.
5. ~~Distillation column restrictions~~ → No restrictions. Available
   in sandbox and campaign. Mission palette controls availability.
6. ~~CH₂O registration~~ → S9 session 1.
7. ~~Composites as opaque units vs transparent groups~~ → S8 locked
   group templates. Greenhouse and human are composed of real units
   (`reactor_adiabatic`, `reactor_electrochemical`, `membrane_separator`)
   that the player can inspect. Not opaque defIds with bespoke ticks.
8. ~~Human drinking water port~~ → Human template has 5 boundary
   ports: air_in, food_in, water_in, air_out, waste_out. Drinking
   water enters via water_in, exits as H₂O + NH₃ via waste_out
   (urine analogue). No biomass waste — all carbon is oxidized by
   R_METABOLISM.
9. ~~Reactor taxonomy~~ → `reactor_equilibrium` split into
   `reactor_adiabatic`, `reactor_jacketed`, `reactor_cooled` in S6a.
   Electrochemical reactor revised in S6b. Fuel cell revised in S6b.
   HEAT port type removed entirely. See S6 spec.
10. ~~LiOH scrubber~~ → `membrane_separator` instance with
    `depletable: true` and finite `sorbentCapacity`. Same defId,
    optional depletion params. See `PTIS_COMPOSITE_MODELS.md` §4.2.

### Still Open

None. All open design questions resolved.

### Architecture Decisions (2026-02)

Cross-cutting decisions on shared tick trunks, port labels, equipment
variant strategy, fuel cell, steam turbine, co-electrolysis recorded
in S9 spec (trunk architecture, decision tree, future extension path).

S8 expand-in-place overlay model, editableParams selective parameter
exposure, scaling mechanism, and GroupTemplateRegistry design recorded
in `PTIS_S8_SPEC.md`.

Biosphere composite models (human, greenhouse, room) and Day-0
depletable configuration recorded in `PTIS_COMPOSITE_MODELS.md`.

Biosphere power reconciliation (metabolic rates, greenhouse efficiency,
M10 power supply resolution) recorded in
`PTIS_BIOSPHERE_POWER_RECONCILIATION.md`.
