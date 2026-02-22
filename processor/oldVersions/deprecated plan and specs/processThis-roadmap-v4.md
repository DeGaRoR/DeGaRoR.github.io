# processThis — Development Roadmap
## Engine-First, Then Game
### February 2026 (rev 4 — final)

---

## Overview

processThis is a single-file browser-based process simulator (v12.10.0, 289 tests, 1,810 assertions). The long-term goal is a survival-engineering game where players build life-sustaining chemical processes on a hostile planet.

This roadmap grounds the physics engine before adding game infrastructure. Every physical system is correct and extensible first, so that missions and game mechanics are purely additive — reading from a stable engine, never requiring rework.

---

## Current State

**Working:** Thermodynamics (Shomate + PR stub), 22 unit types, 9 species, 3 reactions, power management with hubs/batteries/curtailment, alarm system, SVG flowsheet with inspector, multi-select + copy/paste.

**Gaps:**

| Gap | Stage |
|---|---|
| No equipment operating envelopes | S1 |
| Chemistry: two disconnected clusters, no CO bridge | S1 |
| H₂O cpig Tmin=500 (should be 298), CO₂ Antoine sublimation only | S1 |
| sink_electrical Infinity demand, no overload/fry, uniform allocation | S2 |
| VLE Raoult only, hardcoded liquid density, range warnings console-only | S3 |
| No multi-stage separation (column) | S4 |
| HEX UA/NTU misses latent heat in effective Cp | S4 |
| Pressure decorative, flow user-stamped, tanks don't compute P | S5 |
| No electrochemical reactor | S6 |
| No operating envelope visualization | S7 |
| No missions, campaigns, or game shell | S8 |

---

## Sequence

```
S1  Equipment Limits + Chemistry    Envelopes · CO · 7 reactions · thermo fixes
 │
S2  Power Management                Overload · fry · priority allocation
 │
S3  Peng-Robinson EOS               Non-ideal thermo · departures · range alarms
 │
S4  Process Operations              Distillation · HEX fix · refrigeration tests
 │
S5  Pressure & Flow                 Reservoir model · Cv · algebraic flow solver
 │
S6  Electrochemical Reactor         Power-driven chemistry · 2 electrochem reactions
 │
S7  Performance Maps                Phase envelopes · feasibility maps · limit overlays
 │
S8  Game Infrastructure             Dual-scene · missions · campaign · shell
```

**Critical path:** S1 → S2 → S3 → S5 (longest sequential chain).
S4 branches from S3 (column needs PR K-values).
S6 branches from S2 (power demand contract).
S7 merges S1 + S3 + S4.
S8 reads all engine stages, modifies none.

---

## Chemistry Palette (after S1 + S6)

### Species (10)

N₂, O₂, H₂, H₂O, CO₂, CH₄, NH₃, **CO** (new), Ar, He.

### Reactions (10)

| ID | Reaction | Stage |
|---|---|---|
| R_H2_COMB | 2H₂ + O₂ → 2H₂O | existing |
| R_SABATIER | CO₂ + 4H₂ → CH₄ + 2H₂O | existing |
| R_H2O_FORM | H₂ + ½O₂ → H₂O | existing |
| R_HABER | N₂ + 3H₂ → 2NH₃ | S1 |
| R_SMR | CH₄ + H₂O → CO + 3H₂ | S1 |
| R_WGS | CO + H₂O ↔ CO₂ + H₂ | S1 |
| R_RWGS | CO₂ + H₂ → CO + H₂O | S1 |
| R_CH4_COMB | CH₄ + 2O₂ → CO₂ + 2H₂O | S1 |
| R_H2O_ELEC | 2H₂O → 2H₂ + O₂ | S1 data / S6 unit |
| R_CO2_ELEC | 2CO₂ → 2CO + O₂ | S1 data / S6 unit |

After S1+S6, every C/H/O/N species reaches every other through at least one reaction pathway. Ar, He: inert (separation challenge, not reaction).

### Expansion (not in this roadmap)

| System | When |
|---|---|
| Sulfur (H₂S, SO₂) + absorber unit | Chapter 2 |
| Phosphorus (PH₃, P₂O₅) | Chapter 2 |
| Methanol (CH₃OH) | Chapter 2 |
| Chlorine (HCl, Cl₂, NaCl) | Chapter 3 |

---

## S1: Equipment Limits + Chemistry Palette

**Goal:** Physical operating envelopes on all units. Complete C/H/O/N chemistry web. Thermo data fixes.

**Spec:** `final_equipment_limits_S.md` (limit data), `RELEASESPEC_heatStream_perfmaps.md` (Ph2+6: limit infrastructure), `AUDIT_thermo_ranges.md` (data fixes).

**Delivers:**
- `LIMIT_PARAM_TEMPLATES`, `limitParams`, S-size limit data on 13 unit types
- `getEffectiveLimits()`, `evaluateLimits()`, `getLimitParam()` — three-layer limit system
- Alarm source + schema extension for limit violations
- `_rationalize()` skeleton for alarm dedup
- Default param fixes: tank 50→0.15 m³, reactor 1.0→0.003 m³
- H₂O cpig Tmin 500→298, CO₂ Antoine liquid-vapor range added
- CO species + 7 new reactions (data registration only for electrochemical)

**Exit:** All 13 units have limits. CO passes ComponentRegistry validation. 7 new reactions pass mass balance. H₂O at 400 K: no console warning. CO₂ flash at 250 K / 20 bar: reasonable K-values. ~15 new tests.

---

## S2: Power Management

**Goal:** Overload has consequences. Hub allocation respects priority.

**Spec:** `v13_power_spec.md` — current, no revision needed.

**Delivers:**
- `ratedPower_kW` on sink_electrical (kill Infinity demand)
- Overload detection + severity scaling on all consumers
- Fry state (persists until user intervention)
- Hub priority allocation: critical / normal / deferrable
- Load shedding: shed deferrable first
- Direct connection model formalized

**Exit:** Oversize source → undersized consumer → fry. Hub sheds deferrable first. ~8 new tests.

---

## S3: Peng-Robinson EOS

**Goal:** Non-ideal thermodynamics. PR stub becomes working cubic EOS. Thermo range warnings surface through alarm system.

**Spec:** New spec needed — PR EOS implementation.

**Delivers:**
- Cubic solver (Cardano/Newton), root selection, α(T) with quantum gas guard
- Mixing rules (kij table for key pairs), fugacity coefficients → `kValue()`
- Enthalpy departure → `hMolar()`, Cp departure → `cpMolar()`
- Liquid density from Z_liq → `density()`
- Saturation pressure via bubble-P iteration
- Compressor isentropic work from entropy departures
- Convergence fallback to Raoult K
- Package selector (UI toggle Ideal/PR)
- Range-exceeded alarm source (thermo data boundary violations → AlarmSystem)

**Exit:** PR passes pure-component + mixture VLE spot checks. Quantum gases handled. JT cooling through valve produces T_out < T_in for NH₃. Range alarms fire. Fallback works. ~15 new tests.

---

## S4: Process Operations

**Goal:** Multi-stage separation. Correct HEX effective Cp. Verified refrigeration loops.

**Spec:** New spec needed — distillation column + HEX fix + refrigeration test plan.

**Delivers:**
- Shortcut distillation column (Fenske-Underwood-Gilliland)
- HEX UA/NTU effective-Cp fix for phase-changing streams (~15 lines)
- Refrigeration loop end-to-end tests (NH₃ and CO₂ transcritical)

**Column:** `distillation_column` unit, category SEPARATION. Ports: mat_in, mat_out_D, mat_out_B, elec_in (reboiler), heat_out (condenser). Params: N_stages, R/R_min, feed_stage_frac, P_column. Uses K-values from ThermoAdapter (PR after S3). Fenske → N_min, Underwood → R_min, Gilliland → actual N. Component splits from Fenske distribution.

**HEX fix:** Apply air cooler's effective-Cp pattern (`C_eff = Q/ΔT`) to general HEX in UA/NTU mode when phase change detected. Approach and setpoint modes already handle two-phase correctly via PH-flash.

**Refrigeration tests:** Valve JT (NH₃ 20→2 bar), HEX evaporator/condenser, end-to-end loop, CO₂ near-critical. All verified architecturally ready by thermo audit — these tests confirm with PR EOS live.

**Exit:** Column produces correct N₂/O₂ splits. HEX UA/NTU matches approach mode for condensing service (within 5%). NH₃ loop converges sub-ambient. ~12 new tests.

---

## S5: Pressure & Flow

**Goal:** Pressure is physical. Flow emerges from ΔP through Cv. No user types a flow rate in engineering mode.

**Spec:** `RELEASESPEC_pressure_flow.md` v7.0 — complete, written against v12.10.0. Supersedes `RELEASESPEC_pressure_path.md` v6.0.

**Delivers:**
- Reservoir unit: 5-port tank with Cv on product outlets, finite/reservoir modes
- Replaces all source concepts (source, source_air → deprecated, reservoir is canonical)
- atmosphere_sink (pressure anchor at P_atm)
- Resistance parameter k on all passthrough units (flow-dependent ΔP)
- ΔP valve: existing valve enhanced with pressure role, reverse flow check
- UnionFind + BFS pressure propagation (bidirectional)
- Algebraic path solver: single path (closed form), branching (linear/bisection)
- Implicit check valves: all flows ≥ 0, backflow detected + alarmed
- Production gating on pressure ERROR
- Traffic light, canvas annotations, connection-time analysis
- NNG-17 (no flow-pressure iteration) and NNG-18 (implicit check valves)

**Exit:** Tank P from headspace. Cv determines flow. Branching distributes by conductance. Backflow zeroed + alarmed. Production gated. 79 new tests per spec.

---

## S6: Electrochemical Reactor

**Goal:** Third reactor paradigm. Power drives chemistry.

**Spec:** `spec-electrochemical-reactor.md` — add R_CO2_ELEC to scope, otherwise current.

**Delivers:**
- `reactor_electrochemical`: 4 ports (mat_in, power_in, mat_out, heat_out)
- ELECTROCHEMICAL kinetics: ξ = f(power), not f(T)
- Power demand contract, efficiency η, conversion_max
- Waste heat = P_available − Q_chem
- R_H2O_ELEC and R_CO2_ELEC activation

**Exit:** Mass/energy balance for both reactions. Power-limited operation works. ~8 new tests.

---

## S7: Performance Maps

**Goal:** Engine physics made visible on interactive canvases.

**Spec:** `RELEASESPEC_heatStream_perfmaps.md` (Ph1,3–5,7) + column operating map (new, small).

**Delivers:**
- Canvas infrastructure (HiDPI, axes, pointer, color scale)
- Species VP envelopes (PR EOS curves, Tc dots)
- Dynamic phase maps (bubble/dew P from inlet composition)
- Reactor feasibility maps (T×P, conversion % as color)
- Column operating map (Gilliland curve + current operating point)
- Limit region overlays (LL/HH shading from S1 data)
- Inspector map hooks, operating point marker

**Exit:** Maps render for flash drum, pump, compressor, reactors, column. ~5 new tests.

---

## S8: Game Infrastructure

**Goal:** Missions, campaigns, and game shell — purely additive on stable engine.

**Spec:** `processThis-game-spec-v2.md` — minor update (line numbers shifted).

**Delivers:**
- Dual-scene refactor (EditorSession.activeScene, ProductionClock, UndoStack scoping)
- Mission engine (MissionDefinition, MissionRegistry, paramLocks → S1 limits, ObjectiveEvaluator, built-in evaluators, HUD, flow)
- Sim/prod state machine (enter/commit/revert)
- Economy (EconomyEngine, ProductionLedger, InventoryReport, runway)
- Campaign (CampaignDefinition, CampaignState, parts accumulation, scene inheritance, save/load)
- Shell + UI (home screen, mission select, sandbox save slots, mode switcher, resource HUD)

**Exit:** Player launches from home screen, plays mission with restricted parts, commits to production, sees survival HUD, saves/loads campaign. ~30 new tests.

---

## Mission Design Space

| Archetype | Key units | Key physics | Design tension |
|---|---|---|---|
| Air separation | Column, compressor, HEX, valve | Cryo VLE (S3), stages (S4) | Stages vs. energy |
| Water electrolysis | Electrochem, tank | Power budget (S2) | Power allocation |
| Haber synthesis | Reactor, compressor, column | High-P equil (S3,S5), recycle | Pressure vs. conversion |
| Sabatier / ISRU | Reactor, electrochem, column | CO₂ feed, water mgmt | Pathway selection |
| Syngas chain | 2 reactors, column | High-T reforming | Temperature staging |
| Refrigeration | Compressor, HEX×2, valve | JT cooling (S3), two-phase HEX (S4) | Working fluid choice |
| Power generation | Turbine, reactor, compressor | Combustion T, expansion ratio | Efficiency vs. limits (S1) |
| Mars bootstrap | Electrochem, reactor, column, tank | Full chain | Resource sequencing |

---

## Spec Documents

| Document | Stage | Status |
|---|---|---|
| `final_equipment_limits_S.md` | S1 | Ready |
| `RELEASESPEC_heatStream_perfmaps.md` | S1 (Ph2+6), S7 (Ph1,3–5,7) | Ready (Phase 0 done in v12) |
| `AUDIT_thermo_ranges.md` | S1, S3 | Ready (extracted from roadmap rev 3) |
| `v13_power_spec.md` | S2 | Ready |
| *New: PR EOS spec* | S3 | Needed |
| *New: Distillation + HEX + refrig spec* | S4 | Needed |
| `RELEASESPEC_pressure_flow.md` v7.0 | S5 | Ready (supersedes pressure_path v6.0) |
| `spec-electrochemical-reactor.md` | S6 | Minor update (add R_CO2_ELEC) |
| `processThis-game-spec-v2.md` | S8 | Minor update (line numbers) |

---

## Test Projection

| Stage | New tests | Cumulative |
|---|---|---|
| Baseline (v12.10.0) | — | 289 |
| S1 | ~15 | ~304 |
| S2 | ~8 | ~312 |
| S3 | ~15 | ~327 |
| S4 | ~12 | ~339 |
| S5 | ~79 | ~418 |
| S6 | ~8 | ~426 |
| S7 | ~5 | ~431 |
| S8 | ~30 | ~461 |

All existing tests pass at every stage boundary.

---

## Parked

| Item | Needs | Notes |
|---|---|---|
| Narrative system | S8 | Content delivery |
| Bible of Thermodynamics | S7+S8 | Static content + maps |
| 3D view (Three.js) | S8 | Large independent workstream |
| Advanced valves (real Cv standalone) | S5 stable | Full flow-pressure coupling — excluded per NNG-17 |
| M/L equipment sizes | S1 | Data exercise |
| Mission editor | S8 | Author JSON by hand first |
| Alarm extensions | S1 | Cascade suppression, shelving |
| Inspector limit bars | S1 | Visual LL/HH envelope bars |
| Hub rated throughput | S2 | Design question |
| PID controllers | S5 | Layer on Cv — adjusts opening_pct over time |
| Sulfur chemistry + absorber | Chapter 2 | H₂S, SO₂, Claus |
| Phosphorus chemistry | Chapter 2 | PH₃, P₂O₅ |
