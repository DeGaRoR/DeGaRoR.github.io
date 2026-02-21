# processThis — Development Roadmap
## Engine-First, Then Game
### February 2026

---

## Overview

processThis is a single-file browser-based process simulator (v12.9.4, 28,380 lines, 289 tests, 1,810 assertions). It models chemical processes with rigorous thermodynamics, power management, and an alarm system. The long-term goal is a survival-engineering game where players build life-sustaining chemical processes on a hostile planet.

This roadmap grounds the physics engine completely before adding game infrastructure. The principle: every physical system should be correct and extensible first, so that missions, campaigns, and game mechanics are purely additive — reading from a stable engine, never requiring it to be reworked.

Seven sequential stages take the codebase from "good simulator with known gaps" to "fully grounded engine with game layer on top."

---

## Current State

**What works well:** Thermodynamics (Shomate + Peng-Robinson stub), 22 unit types, 9 species, 3 reactions, power management with hubs/batteries/curtailment, alarm system with severity taxonomy, SVG flowsheet with inspector, demo scene.

**Known gaps the roadmap closes:**

| Gap | Impact | Closed in |
|---|---|---|
| No equipment operating envelopes | Units accept any T/P/flow without consequence | S1 |
| sink_electrical demands Infinity power | Starves every other consumer on shared bus | S2 |
| No overload/fry logic | Connecting 500 kW to a 50 kW load has no consequence | S2 |
| Uniform hub allocation | All consumers dim equally, no priority | S2 |
| VLE uses Raoult's law only | Non-ideal mixtures, high-P systems, refrigeration loops inaccurate | S3 |
| Liquid density hardcoded | Tank volumes, pump sizing, flash drum behavior approximate | S3 |
| Pressure is decorative | Values exist but aren't enforced or propagated | S4 |
| Tanks don't know their own pressure | P copied from inlet, not computed from contents | S4 |
| No electrochemical reactor | Can't model electrolysis (water splitting) | S5 |
| Missing reactions | No water electrolysis, no combustion, no Haber | S1+S5 |
| No operating envelope visualization | Player can't see where limits/phases are | S6 |
| Single global scene | Can't support simulation + production simultaneously | S7 |
| No mission/campaign framework | No restricted parts, objectives, or progression | S7 |

---

## Sequence

```
S1  Equipment Limits          Physical envelopes on every unit
 │
S2  Power Management          Overload, fry, priority allocation
 │
S3  Peng-Robinson EOS         Non-ideal thermo, cubic VLE, liquid density
 │
S4  Pressure Network          Tank headspace, propagation, gating
 │
S5  Electrochemical Reactor   Third reactor paradigm + 2 reactions
 │
S6  Performance Maps          Operating envelope visualization
 │
S7  Game Infrastructure       Dual-scene, missions, campaign, shell
```

Each stage gates the next. S3 directly strengthens S4 (tank headspace gets real liquid volumes and non-ideal VLE). S6 builds on S1 data and S3 phase envelopes. S7 is purely additive — it reads from a stable engine and never modifies physics.

---

## S1: Equipment Limits + Alarm Rationalization

**Goal:** Every unit has a physical operating envelope. Violations feed the alarm system.

| Item | Source spec | What |
|---|---|---|
| Limit param templates | `heatStream_perfmaps` Ph2 | `LIMIT_PARAM_TEMPLATES` — shared T/P/mass/phase metadata dictionary |
| limitParams per unit | `heatStream_perfmaps` Ph2 | Each unit def declares which params are limitable |
| S-size limit data | `equipment_limits_S.md` | `limits: { S: {...} }` with LL/L/H/HH on all 13 unit types |
| getEffectiveLimits() | `heatStream_perfmaps` Ph2 | Three-layer merge: equipment base → mission tightening → player tuning |
| evaluateLimits() | `heatStream_perfmaps` Ph2 | Pure function: def + unit + runtime → violation list |
| getLimitParam() | `heatStream_perfmaps` Ph2 | Reads actual T/P/mass/phase from runtime for comparison |
| Alarm source | `heatStream_perfmaps` Ph2 | Limit violations registered as AlarmSystem source |
| Alarm schema extension | `heatStream_perfmaps` Ph2 | Fields: paramName, paramValue, limitTag, limitValue, source |
| Rationalization skeleton | `heatStream_perfmaps` Ph6 | `_rationalize()` — dedup by alarm id, highest severity wins |
| Default param fixes | `equipment_limits_S.md` | Tank volume 50→0.15 m³, reactor volume 1.0→0.003 m³ |
| R_HABER | `equipment_limits_S.md` | Haber synthesis reaction registration + thermo data |

**Rationale:** The operating envelope is the foundation everything else reads. Alarm presentation, inspector limit bars, performance map overlays, and future mission constraints all call `getEffectiveLimits()`. The three-layer merge hook costs 5 lines now and prevents a restructuring when missions arrive. Alarm rationalization is the skeleton for all future alarm pipeline work (cascade suppression, shelving, aggregation, dead-banding). The Haber reaction rounds out the chemistry palette at zero risk — it's pure data registration.

**Exit criteria:** All 13 units have limits. `evaluateLimits()` produces correct violations. Alarm pipeline includes limit source + dedup. All 289 existing tests pass + ~10 new.

---

## S2: Power Management

**Goal:** Electrical overload has consequences. Hub allocation respects priority. Every power pathway is physically grounded.

| Item | Source spec | What |
|---|---|---|
| sink_electrical ratedPower | `v13_power_spec` §A | New `ratedPower_kW` param, kill Infinity demand |
| Overload detection | `v13_power_spec` §B | `received > rated × (1 + margin)` on all consumers |
| Severity scaling | `v13_power_spec` §B | Minor (5% over) → major (20%) → catastrophic (50%+) |
| Fry state | `v13_power_spec` §B | Persists until user intervenes, triggers existing visual infra |
| ratedPower on all consumers | `v13_power_spec` §B | Compressor, pump, heater, reactor — from existing params or explicit |
| Hub priority allocation | `v13_power_spec` §C | Critical / normal / deferrable load classes |
| Load shedding | `v13_power_spec` §C | Supply < demand → shed deferrable first, then normal |
| Direct connection model | `v13_power_spec` §D | Formalize demand-response for hubless wires, partial signaling |

**Rationale:** Completes the power lifecycle symmetrically. Curtailment (underpowered) already exists; overload (overpowered) doesn't. Real equipment fails in both directions. Priority-based shedding makes the power network behave like a real electrical system — life support doesn't dim when you turn on a compressor. After S2, the engine enforces thermal/pressure envelopes (S1) and electrical envelopes (S2) consistently.

**Exit criteria:** Oversize source → undersized consumer → fry. Hub sheds deferrable loads first. sink_electrical has finite demand. All prior tests pass + ~8 new.

---

## S3: Peng-Robinson Equation of State

**Goal:** Non-ideal thermodynamics. The existing `PengRobinsonPackage` stub becomes a working cubic EOS, replacing Raoult's law VLE with fugacity-based phase equilibrium and ideal gas PVT with cubic compressibility.

### Architecture (already in place)

The codebase is pre-wired for this:

- `PengRobinsonPackage` extends `IdealRaoultPackage` with every override point commented (line 4332)
- All 9 species have Tc, Pc, ω, Vc, Zc in ComponentRegistry
- `compressibilityZ` hook in `streamVolFlow_m3ps()` (line 5609)
- `computeCompressorWork` notes "PR EOS would override this" (line 5660)
- Flash uses K-values from the package — swap Raoult K for fugacity K, Rachford-Rice unchanged
- `ThermoAdapter.setPackage()` switches in one call; all downstream reads go through the adapter

### Implementation

| Item | What |
|---|---|
| Cubic solver | Cardano (or Newton) for Z³ − (1−B)Z² + (A−3B²−2B)Z − (AB−B²−B³) = 0 |
| Root selection | Largest real positive Z = vapor, smallest = liquid; Gibbs test if ambiguous |
| α(T) function | Standard PR: α = [1 + κ(1 − √Tr)]², κ = f(ω) |
| Quantum gas guard | Modified α for ω < 0 (H₂, He): Boston-Mathias or Twu correlation, or floor α > 0 |
| Mixing rules | a_mix = ΣΣ xᵢxⱼ√(aᵢaⱼ)(1−kᵢⱼ), b_mix = Σ xᵢbᵢ (van der Waals one-fluid) |
| kij data table | Binary interaction parameters: H₂O-CO₂, H₂O-NH₃, CH₄-CO₂ from literature; rest = 0 |
| Fugacity coefficients | ln φᵢ from standard PR closed-form expression → override `kValue()` |
| Enthalpy departure | H_dep(T,P) closed-form from a, da/dT, Z, A, B → override `hMolar()` |
| Cp departure | Cp_dep from −T·d²a/dT² term → override `cpMolar()` |
| Liquid density | ρ = P·MW / (Z_liq·R·T) from liquid root → override `density()` |
| Compressibility | `compressibilityZ(n_map, T, P)` → mixture Z from cubic solve |
| Saturation pressure | Iterative bubble-P: find P where φ_L = φ_V → override `saturationPressure()` |
| Compressor work | Entropy-based isentropic calculation using departure functions → override `computeCompressorWork()` |
| Convergence fallback | If PR flash doesn't converge in N iterations → fall back to Raoult K for that flash call |
| Package selector | UI toggle between Ideal/PR in settings; default remains Ideal for stability |

### Known Deviations (document, don't hide)

| Issue | Severity | Mitigation |
|---|---|---|
| H₂ (ω = −0.216), He (ω = −0.390): standard α(T) goes negative at high Tr | NaN propagation if unguarded | Modified α correlation or positive floor; test explicitly |
| Near-critical CO₂ (Tc = 304 K): liquid/vapor roots converge | Phase oscillation between solver iterations | Hysteresis or "near-critical vapor" classification |
| H₂O Psat: standard PR underpredicts by ~5-10% | Visible on VP envelope | Acceptable per "convincing, not Aspen-accurate"; document deviation |
| Mixture bubble/dew: iterative K-value loop | Extra 5-8 outer iterations per flash | ~20-40 ms added per tick for typical 15-unit flowsheet; invisible to player |

### Test Strategy

| Test | What |
|---|---|
| Pure species Psat | H₂O at 373 K ≈ 101325 Pa ± 10%; NH₃, CO₂ spot checks |
| Cubic roots | Known Z values for pure CH₄ at several T/P; vapor > liquid root |
| Quantum guard | H₂ at 300 K / 100 bar: α > 0, finite Z, no NaN |
| Departure functions | H_dep for CH₄ against literature values ± 5% |
| Fugacity VLE | H₂O-NH₃ bubble point shifted vs pure H₂O (qualitative) |
| Liquid density | H₂O at 300 K: ρ ≈ 1000 kg/m³ ± 15% (PR is approximate for polar) |
| Mass/energy closure | Full flowsheet tick: conservation holds with PR active |
| Fallback | Force non-convergence → Raoult fallback fires, no crash |
| Round-trip | Switch Ideal → PR → Ideal: identical results in ideal-gas regime |

**Rationale:** Raoult's law VLE breaks down exactly where the game gets interesting: high-pressure Haber (100 bar NH₃/H₂/N₂), refrigeration loops (NH₃ or CO₂ near saturation), CO₂ processing near its critical point, and any mixture where activity coefficients deviate from unity. PR won't make Raoult wrong — it makes Raoult honest. The existing architecture was designed for this swap: every thermo call routes through ThermoAdapter, every K-value comes from the package, every override point is marked. Keeping the Ideal package as default and PR as opt-in means zero risk to existing test suite. The fallback path (revert to Raoult K on non-convergence) means PR can't crater a simulation — worst case, one flash call degrades to ideal for one tick.

S3 directly strengthens S4: `computeTankState()` needs liquid density and VLE. With PR, sealed tank headspace pressure reflects real liquid volumes and non-ideal vapor behavior instead of crude heuristics. It also strengthens S6: performance maps showing VP envelopes and phase boundaries reflect actual non-ideal behavior rather than Antoine/Raoult approximations.

**Exit criteria:** PR package passes pure-component and mixture VLE spot checks. Quantum gases handled without NaN. Departure functions within literature tolerance. Fallback fires on non-convergence. All prior tests pass unchanged (Ideal is still default). ~12 new tests.

---

## S4: Pressure Network

**Goal:** Pressure is physically real. Tanks know their own pressure. It propagates through chains. Production won't advance with inconsistent pressure.

*Prerequisite: revision pass on `pressure_path` spec against v12.9 naming/architecture.*

| Item | Source spec | What |
|---|---|---|
| Spec revision | `pressure_path` | Reconcile with v12.9 — drop/remap stale renames, confirm unit table |
| computeTankState() | `pressure_path` F-004 | Pure fn: inventory → headspace P, liquid volume, VLE phase split |
| Tank 5-port rewrite | `pressure_path` F-005 | vap_out (top), liq_out (bottom), vent (safety), liq_overflow (safety) |
| Pressure role declarations | `pressure_path` F-007 | anchor/boost/drop/passthrough/none on every registered unit |
| deltaP_bar params | `pressure_path` F-008 | Fixed ΔP on all passthrough units, HEX gets hot + cold independently |
| UnionFind + node graph | `pressure_path` F-009 | One node per material port, union by wire → zones |
| Topology analysis | `pressure_path` F-010 | Zones, anchor count, conflicts, override reporting |
| Connection-time analysis | `pressure_path` F-011 | Run topology on connect, grey out overridden ideal sources |
| Tank pressure anchor | `pressure_path` F-012 | Sealed → headspace P from computeTankState, vented → P_atm |
| atmosphere_sink | `pressure_path` F-013 | New unit, pressure anchor at P_atm |
| atmosphere_source anchor | `pressure_path` F-014 | Existing source_air becomes pressure anchor |
| BFS propagation | `pressure_path` F-015 | Bidirectional inference through ΔP/boost chains |
| Pressure diagnostics | `pressure_path` F-016 | AlarmSystem source, NNG-12 causal messages |
| Production gating | `pressure_path` F-017 | Step/Play blocked on pressure ERROR |
| Traffic light + canvas | `pressure_path` F-018 | Pressure dot in traffic light, optional P annotations |

**Rationale:** Largest and highest-risk engine workstream. After S4, pressure emerges from physics rather than being stamped by the user. The ideal/engineering split preserves backward compatibility — ideal sources opt out, engineering units opt in. The realism ladder is the player's choice. Tank headspace physics is the keystone: a sealed vessel's pressure comes from its contents, not from an input parameter. With S3's PR EOS in place, `computeTankState()` uses real liquid densities and non-ideal VLE rather than heuristics — the pressure it computes is physically grounded. BFS propagation makes pressure chains deterministic without crossing the coupling wall (flow-from-pressure is Meridian scope, not built here). Pressure gating means production won't advance with inconsistent physics.

**Exit criteria:** Tank P from headspace. BFS resolves chains. Conflicts detected. Production gated. Ideal flowsheets unaffected. All prior tests pass + ~40 new.

---

## S5: Electrochemical Reactor + Reactions

**Goal:** Third reactor paradigm. Power drives chemistry. Two new reactions fill palette gaps.

| Item | Source spec | What |
|---|---|---|
| reactor_electrochemical | `spec-electrochemical-reactor` | New unit: 4 ports (mat_in, power_in, mat_out, heat_out) |
| ELECTROCHEMICAL kinetics | `spec-electrochemical-reactor` | New KineticsEval branch: ξ = f(power), not f(T, concentration) |
| Power demand contract | `spec-electrochemical-reactor` | Declares `ξ_max × |ΔH| / η` before receiving actual allocation |
| Efficiency + conversion params | `spec-electrochemical-reactor` | η (0.30–0.95, default 0.70), conversion_max (0.01–0.99, default 0.80) |
| Energy balance: heat_out | `spec-electrochemical-reactor` | Waste heat = P_available − Q_chem exits via heat port |
| R_H2O_ELECTROLYSIS | `spec-electrochemical-reactor` | 2H₂O → 2H₂ + O₂, PEM range (280–373 K), endothermic |
| R_CH4_COMB | `spec-electrochemical-reactor` | CH₄ + 2O₂ → CO₂ + 2H₂O, strongly exothermic |

**Rationale:** The three reactor types now cover every practical driving force: thermal kinetics (adiabatic), thermodynamic equilibrium (equilibrium), and electrical input (electrochemical). All three share ReactionRegistry, stoichiometric mass balance, and enthalpy-based energy balance — only what drives ξ differs. Water electrolysis enables H₂/O₂ production from electrical input. Combustion enables power generation from fuel. Together with Haber (S1), the engine now has the full reaction vocabulary for any reasonable process scenario. The electrochemical reactor also exercises S2's power demand contract in a new way — it's a consumer whose demand depends on feed composition, creating a natural feedback loop.

**Exit criteria:** Electrochemical reactor passes mass/energy balance. Power-limited operation works. Idle/partial/full diagnostics correct. All prior tests pass + ~8 new.

---

## S6: Performance Maps

**Goal:** The engine's physics become visible. Operating envelopes, phase boundaries, and reaction feasibility rendered on interactive canvases.

| Item | Source spec | What |
|---|---|---|
| Canvas infrastructure | `heatStream_perfmaps` Ph1 | HiDPI setup, lin/log axes, tick generation, pointer tracking, color scale |
| Species VP envelopes | `heatStream_perfmaps` Ph3 | Psat(T) curves per species, Tc dots, Tb ticks, supercritical notes |
| Dynamic phase maps | `heatStream_perfmaps` Ph4 | Bubble P / dew P from actual inlet composition, cached by composition hash |
| Reactor feasibility maps | `heatStream_perfmaps` Ph5 | T×P field maps, conversion % as color, marching-squares contours |
| Inspector map hooks | `heatStream_perfmaps` Ph7 | `config?.map` in inspector rendering, click-to-expand modal |
| Limit region overlays | `heatStream_perfmaps` near-term | LL/HH shading on maps — reads S1 limit data directly |
| Operating point marker | `heatStream_perfmaps` Ph1 | Crosshair at current T/P on all maps |

**Rationale:** Visualization of what the engine already knows. VP envelopes show where phase changes happen — with S3's PR EOS, these reflect real non-ideal behavior rather than Antoine approximations. Reactor maps show where conversion is feasible. Limit overlays show where equipment breaks. The operating point marker shows where you are right now. Together they make the engine legible without requiring a ChemE degree. The canvas infrastructure carries forward to any future chart type. Limit overlays directly consume S1's `getEffectiveLimits()`.

**Exit criteria:** Maps render in inspector for flash drum, pump, compressor, reactors. Limit regions visible. Operating point tracks. Click-to-expand works. All prior tests pass + ~5 new.

---

## S7: Game Infrastructure

**Goal:** The engine is fully grounded. Now add missions, campaigns, and the game shell — purely additive, reading from stable engine APIs.

| Item | Source spec | What |
|---|---|---|
| **Dual-scene refactor** | | |
| Global scene extraction | `game-spec` §0.1 | `EditorSession.activeScene` replaces global `scene` everywhere |
| ProductionClock | `game-spec` §0.2 | Independent clock alongside TimeClock, both take scene param |
| UndoStack scoping | `game-spec` §0.3 | Scoped to active scene, disabled in production mode |
| SimSettings save/restore | `game-spec` §0.4 | Snapshot/restore for mission context switching |
| Inventory serialization | `game-spec` §0.5 | exportJSON/importJSON + inventory + pos3d + clock → scene version 16 |
| placeUnit guard | `game-spec` §0.6 | Parts enforcement wrapper (no-op in sandbox) |
| **Mission engine** | | |
| MissionDefinition schema | `game-spec` §3.3 | Frozen JSON format: parts, locks, objectives, rewards, narrative hooks |
| MissionRegistry | `game-spec` §12.1 | Register/get/freeze/unlock |
| EditorSession.start() | `game-spec` §1.2 | Configure settings, load parts, enter mission context |
| Palette restriction | `game-spec` §4.1 | Count badges, greying, tease reasons from mission parts dict |
| paramLocks | `game-spec` §4.3 | Fixed/range/readonly — plugs into S1's getEffectiveLimits() |
| ObjectiveEvaluator | `game-spec` §5.1 | Evaluator registry + built-in types |
| Built-in evaluators | `game-spec` §5.2 | convergence, produce_pure, maintain_conditions, store_component, sustained_flow, total_produced |
| Objective HUD | `game-spec` §1.6 | ✓/◐/○ indicators on editor |
| Mission flow | `game-spec` §1.7 | Briefing → editor → check → debrief → stars |
| **Sim/prod state machine** | | |
| enterSimulation() | `game-spec` §2.2 | Deep-clone, snapshot, mode switch |
| commitToProduction() | `game-spec` §2.2 | Diff, parts check, inventory-preserving merge |
| revertSimulation() | `game-spec` §2.2 | Discard + restore |
| ProductionClock.tick() | `game-spec` §2.3 | Warp speeds, background ticking during simulation |
| **Economy** | | |
| EconomyEngine | `game-spec` §6.2 | Demand evaluation from sink flows |
| ProductionLedger | `game-spec` §7.2 | Cumulative tracking, history ring buffer |
| InventoryReport | `game-spec` §7.4 | Tank/battery summary snapshot |
| Runway calculation | `game-spec` §7.3 | f(current rates, storage, demands) — no prediction, no smoothing |
| **Campaign** | | |
| CampaignDefinition | `game-spec` §3.4 | Chapters, starting parts, atmosphere |
| CampaignRegistry | `game-spec` §12.1 | Register/get/complete |
| CampaignState | `game-spec` §3.5 | Persistent save: parts, unlocks, scene, ledger, clock |
| Parts accumulation | `game-spec` §4.4 | Starting → rewards → inventory across missions |
| Scene inheritance | `game-spec` §4.4 | inheritScene carries production forward |
| Dependency checking | `game-spec` §12.2 | Mission/star/campaign prerequisites |
| Save/load | `game-spec` §4.6 | localStorage or IndexedDB |
| **Shell + UI** | | |
| Home screen | `game-spec` §5.1 | Campaign / Missions / Sandbox / Options |
| Mission select | `game-spec` §4.7 | Lock/star display, chapter grouping |
| Sandbox save slots | `game-spec` §5.2 | Named slots, import/export |
| Mode/view switcher | `game-spec` §11.1 | Sim/prod × flowsheet/3D toggle |
| Production ticker | `game-spec` §11.3 | Background status during simulation |
| Commit dialog | `game-spec` §11.6 | Itemized diff, parts delta |
| Resource HUD | `game-spec` §11.4 | Rate/need/status/runway per demand |
| Ambient mode signals | `game-spec` §11.2 | Border color, palette state, name prefix |

**Rationale:** The engine doesn't move anymore — S1 through S6 are done. S7 is purely additive infrastructure that reads engine APIs. `paramLocks` calls `getEffectiveLimits()` from S1. Power-limited missions use S2's overload logic. PR EOS from S3 makes high-pressure and refrigeration missions physically credible. Pressure-based missions use S4's gating. Electrochemical missions use S5's reactor. Inspector maps from S6 populate the player's reference tools. Nothing in S7 requires revisiting engine code. The game layer is a consumer, not a modifier.

**Exit criteria:** Player can launch from home screen, select campaign or sandbox, play a mission with restricted parts, commit to production, see survival HUD, save/load campaign progress. All prior tests pass + ~30 new.

---

## Parked

Items that are valuable but not sequenced. Each can slot in independently once its prerequisites exist.

| Item | Prerequisites | Notes |
|---|---|---|
| Narrative system (beats, dialogue, choices) | S7 | Content delivery layer. Purely additive. |
| Bible of Thermodynamics | S6 + S7 | Static content + S6 maps in a slide-over panel. |
| 3D view (Three.js) | S7 | Large independent workstream. Auto-layout, manual positioning, blueprint ghosts. |
| Advanced valves (Cv, flow control) | S4 | `pressure_path` FORGE phases. Reads pressure nodes. |
| M/L equipment sizes | S1 | Data exercise — new limit tables, size selector in inspector. |
| Mission editor | S7 | In-game form → MissionDefinition JSON. Author by hand until format stabilizes. |
| Alarm pipeline extensions | S1 | Cascade suppression, aggregation, shelving, dead-banding. |
| Inspector limit bars | S1 | Visual bars showing current value within LL/L/H/HH envelope. |
| Hub rated throughput | S2 | Should the hub itself have a power rating? Design question. |
| VT flash (exact tank pressure) | S3 | Requires PR liquid density from cubic roots. Deferred until real need emerges. |
| Entropy-based isentropic compression | S3 | PR departure functions enable s(T,P)-based compressor work. Upgrade path noted in code. |

---

## Spec Document Status

| Document | Consumed in | Revision needed? |
|---|---|---|
| `final_equipment_limits_S.md` | S1 | No — data ready as-is |
| `RELEASESPEC_heatStream_perfmaps.md` | S1 (Ph2+6), S6 (Ph1,3–5,7) | Minor — Phase 0 already done in v12 |
| `v13_power_spec.md` | S2 | No — scope and design are current |
| `RELEASESPEC_pressure_path.md` | S4 | **Yes** — written for v10.7, needs reconciliation with v12.9 |
| `spec-electrochemical-reactor.md` | S5 | No — design is current |
| `processThis-game-spec-v2.md` | S7 | Minor — some API line numbers may have shifted |
| *(new spec needed)* | S3 | PR EOS implementation spec — no existing document covers this |
