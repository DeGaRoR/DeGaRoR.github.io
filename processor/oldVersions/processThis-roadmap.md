# processThis — Development Roadmap
## Engine-First, Then Game
### February 2026 (rev 3 — final)

---

## Overview

processThis is a single-file browser-based process simulator (v12.10.0, 28,845 lines, 289 tests, 1,810 assertions). It models chemical processes with rigorous thermodynamics, power management, and an alarm system. The long-term goal is a survival-engineering game where players build life-sustaining chemical processes on a hostile planet.

This roadmap grounds the physics engine completely before adding game infrastructure. The principle: every physical system should be correct and extensible first, so that missions, campaigns, and game mechanics are purely additive — reading from a stable engine, never requiring it to be reworked.

Eight sequential stages take the codebase from "good simulator with known gaps" to "fully grounded engine with game layer on top."

---

## Current State

**What works well:** Thermodynamics (Shomate + Peng-Robinson stub), 22 unit types, 9 species, 3 reactions, power management with hubs/batteries/curtailment, alarm system with severity taxonomy, SVG flowsheet with inspector, multi-select + copy/paste, demo scene.

**Known gaps the roadmap closes:**

| Gap | Impact | Closed in |
|---|---|---|
| No equipment operating envelopes | Units accept any T/P/flow without consequence | S1 |
| Chemistry web is two disconnected clusters | CH₄↔CO₂ and N₂↔NH₃ have no bridge via CO | S1 |
| Missing reactions | No SMR, WGS, CO₂ electrolysis | S1 |
| H₂O cpig Tmin=500 (should be 298) | Spurious console warnings, unnecessary extrapolation | S1 |
| CO₂ Antoine covers sublimation only | VLE wrong above 200 K under Raoult (K-values use garbage Psat) | S1 |
| sink_electrical demands Infinity power | Starves every other consumer on shared bus | S2 |
| No overload/fry logic | Connecting 500 kW to a 50 kW load has no consequence | S2 |
| Uniform hub allocation | All consumers dim equally, no priority | S2 |
| VLE uses Raoult's law only | Non-ideal mixtures, high-P systems, refrigeration loops inaccurate | S3 |
| Liquid density hardcoded | Tank volumes, pump sizing, flash drum behavior approximate | S3 |
| Thermo range warnings go to console only | Player never sees out-of-range conditions | S3 |
| Only single-stage separation | Every "produce pure X" mission has the same trivial flash solution | S4 |
| HEX UA/NTU mode misses latent heat in Cp | Underpredicts duty for phase-changing streams | S4 |
| Pressure is decorative | Values exist but aren't enforced or propagated | S5 |
| Tanks don't know their own pressure | P copied from inlet, not computed from contents | S5 |
| No electrochemical reactor | Can't model electrolysis (water splitting, CO₂ splitting) | S6 |
| No operating envelope visualization | Player can't see where limits/phases are | S7 |
| Single global scene | Can't support simulation + production simultaneously | S8 |
| No mission/campaign framework | No restricted parts, objectives, or progression | S8 |

---

## Sequence

```
S1  Equipment Limits + Chemistry    Physical envelopes · CO · 7 new reactions · thermo data fixes
 │
S2  Power Management                Overload, fry, priority allocation
 │
S3  Peng-Robinson EOS               Non-ideal thermo · liquid density · range alarm source
 │
S4  Process Operations              Distillation column · HEX effective-Cp fix · refrig tests
 │
S5  Pressure Network                Tank headspace, propagation, gating
 │
S6  Electrochemical Reactor         Third reactor paradigm + 2 electrochem reactions
 │
S7  Performance Maps                Operating envelope visualization
 │
S8  Game Infrastructure             Dual-scene, missions, campaign, shell
```

**Critical path:** S1 → S2 → S3 → S5 is the longest engine chain.
S4 branches after S3 (column needs PR K-values for non-ideal systems).
S6 branches after S2 (power demand contract).
S7 merges S1 + S3 + S4.
S8 reads all seven engine stages but modifies none.

---

## Chemistry Palette (after S1 + S6)

### Species (10)

| Formula | Role | Notes |
|---|---|---|
| N₂ | Atmosphere, Haber feed | Inert in most contexts |
| O₂ | Breathing, combustion oxidizer | Product of electrolysis |
| H₂ | Fuel, Haber/WGS/Sabatier feed | Universal reductant |
| H₂O | Water, steam, electrolysis feed | Ubiquitous |
| CO₂ | Atmosphere (Mars), combustion product | Sabatier/rWGS feed |
| CH₄ | Fuel, reforming feed | Sabatier product |
| NH₃ | Fertilizer, refrigerant | Haber product |
| CO | **NEW** — syngas intermediate | Bridges carbon and hydrogen clusters |
| Ar | Inert, separation challenge | Air component |
| He | Inert, cryogenic coolant | Ultra-light, hard to contain |

### Reactions (10)

| ID | Reaction | Type | Registered in |
|---|---|---|---|
| R_H2_COMB | 2H₂ + O₂ → 2H₂O | Existing (exothermic) | — |
| R_SABATIER | CO₂ + 4H₂ → CH₄ + 2H₂O | Existing (exothermic) | — |
| R_H2O_FORM | H₂ + ½O₂ → H₂O | Existing (exothermic) | — |
| R_HABER | N₂ + 3H₂ → 2NH₃ | Thermal equilibrium | S1 |
| R_SMR | CH₄ + H₂O → CO + 3H₂ | Thermal equilibrium (endothermic) | S1 |
| R_WGS | CO + H₂O ↔ CO₂ + H₂ | Thermal equilibrium (mildly exo) | S1 |
| R_CO2_ELEC | 2CO₂ → 2CO + O₂ | Electrochemical (endothermic) | S1 (data) / S6 (unit) |
| R_H2O_ELEC | 2H₂O → 2H₂ + O₂ | Electrochemical (endothermic) | S1 (data) / S6 (unit) |
| R_CH4_COMB | CH₄ + 2O₂ → CO₂ + 2H₂O | Thermal (strongly exothermic) | S1 |
| R_RWGS | CO₂ + H₂ → CO + H₂O | Thermal equilibrium (endothermic) | S1 |

*Note: R_WGS and R_RWGS are thermodynamic reverses. Both registered so the equilibrium reactor can select direction from ΔG. Alternatively, register only R_WGS and let the equilibrium solver compute negative extent. Design decision at implementation time.*

### Chemistry graph connectivity

After these additions, every C/H/O/N species can reach every other through at least one reaction pathway. This is the minimum requirement for a mission designer to create "find the route" challenges by restricting which units/reactions are available:

```
                    R_SMR
          CH₄ ←──────────────→ CO + 3H₂
           │                      │
  R_CH4_COMB│              R_WGS  │  R_H2_COMB
           ↓                      ↓
      CO₂ + H₂O ←─────────→ CO₂ + H₂ ──→ H₂O
           ↑      R_RWGS              
           │                           
      R_SABATIER                  N₂ + 3H₂
    CO₂ + 4H₂ → CH₄ + H₂O         │
                                R_HABER
                                    ↓
                                  2NH₃

  Electrochemical:
    2H₂O ──[power]──→ 2H₂ + O₂     (R_H2O_ELEC)
    2CO₂ ──[power]──→ 2CO + O₂      (R_CO2_ELEC)
```

Ar, He: inert. Their challenge is separation, not reaction.

### Expansion points (not in this roadmap)

| System | Species | Reactions | What it enables | When |
|---|---|---|---|---|
| Sulfur | H₂S, SO₂, S | H₂S combustion, Claus | Contamination missions, catalyst poisoning | Chapter 2 |
| Phosphorus | PH₃, P₂O₅ | Phosphoric acid route | Full fertilizer chain (N+P) | Chapter 2 |
| Methanol | CH₃OH | CO + 2H₂ → CH₃OH | Alternative fuel, solvent | Chapter 2 |
| Chlorine | HCl, Cl₂, NaCl | Chlor-alkali | Water treatment, materials | Chapter 3 |

Each expansion is pure data registration (species + reactions) plus potentially one new unit type (absorber for sulfur, solid handling for Claus). The engine architecture supports unlimited species and reactions through the registries.

---

## Thermo & Infrastructure Audit (completed)

A code-level audit of the valve, HEX, air cooler, and all species thermo data was performed against v12.10.0. The findings below are incorporated into the stage where each fix lands.

### HEX / Air Cooler Architecture — Confirmed Sound

The air cooler is a purpose-built shortcut of the general HEX. Both share the same function library (`hxEnthalpy`, `hxCapacityRates`, `hxSolveUaNtu`, `hxSolveApproach`, `hxSolveSetpoint`, `hxCheckFeasibility`). The air cooler fabricates a synthetic cold-side stream from `SimSettings.getAtmosphere()` and calls `hxSolveUaNtu` — it is effectively HEX(mode=UA/NTU, cold_side=atmosphere).

Both units write outlets identically via PH-flash:

```
ports.mat_out = { P, n, phaseConstraint: 'VL', H_target_Jps }
```

Neither computes outlet T directly. They compute outlet H, then PH-flash resolves T and phase split. Condensation and evaporation are handled correctly on the outlet — if enthalpy lands in the two-phase dome, PH-flash returns Tsat and vapor fraction.

**Two-phase duty by mode:**

| HEX mode | Two-phase safe? | Method |
|---|---|---|
| Approach (default) | ✅ Fully | Bisection calls PH-flash at every Q iteration. Latent heat captured automatically. |
| Setpoint | ✅ On specified side | Q from `hxEnthalpy(stream, T_target)` which includes latent heat via `getHdot_Jps`. |
| UA/NTU | ⚠️ Underpredicts | `hxCapacityRates` uses `streamCp` (sensible only). Phase-change streams have effective Cp >> sensible Cp. Air cooler works around this with `C_proc_eff = Q_demand / ΔT`. General HEX does not. |

The UA/NTU gap is documented and fixed in S4 (apply the air cooler's effective-Cp pattern to the general HEX).

### Valve Isenthalpic Expansion — Confirmed PR-Ready

The valve (line 7883) is correctly isenthalpic:

```
H_in_Jps = thermo.getHdot_Jps(sIn);
ports.out = { P: Pout, n: {...sIn.n}, phaseConstraint: 'VL', H_target_Jps: H_in_Jps };
```

H preserved, P dropped, PH-flash finds T. **Zero valve code changes needed for PR EOS.**

**Ideal gas (current):** `hMolar` returns `∫Cp(T)dT + const` — no pressure dependence. PH-flash solves H(T_out, P_out) = H(T_in, P_in) and finds T_out = T_in. This is physically correct: μ_JT = 0 for an ideal gas because T(∂V/∂T)_P = V.

**PR EOS (after S3):** `hMolar` returns `H_ig(T) + H_departure(T, P)`. Since H_dep depends on P through the cubic equation (Z, a_mix, b_mix, da/dT), the PH-flash must adjust T_out to balance the departure difference. The Joule-Thomson effect emerges automatically from the enthalpy departure — no valve logic changes. For most real gases, T_out < T_in (cooling). For hydrogen above its inversion temperature (~200 K at low P), T_out > T_in (heating). Both physically correct.

**Refrigeration loop readiness:** With ideal thermo, the loop can be built and phase changes resolve correctly in evaporator/condenser via PH-flash. The valve won't cool the stream (μ_JT = 0), so no sub-ambient temperatures are achieved. The moment PR EOS goes live in S3, JT cooling activates and refrigeration loops produce real sub-ambient cold. The architecture is ready; only the thermo package needs upgrading.

### Shomate (Cp_ig) Range Audit

| Species | Tmin (K) | Tmax (K) | Mission demand (K) | Status |
|---|---|---|---|---|
| H₂O | **500** | 1700 | 273–1500 | ⚠️ Tmin should be 298 (NIST uses same coefficients 298–1700) |
| O₂ | 100 | 2000 | 77–1500 | OK — extrapolation 77→100 K: <1% error (Cp nearly constant) |
| H₂ | 298 | 2500 | 20–1000 | OK — always supercritical above 33 K; Cp≈29 J/mol·K, constant |
| N₂ | 100 | 2000 | 77–1500 | OK — extrapolation 77→100 K: <1% error (Cp nearly constant) |
| Ar | 100 | 5000 | 87–300 | ✅ Full coverage (monatomic, Cp = 5/2 R exactly) |
| CH₄ | 298 | 6000 | 112–1000 | OK — extrapolation 112→298 K: ~7% overprediction at 112 K |
| He | 100 | 2000 | 4–300 | OK — always supercritical above 5.2 K; Cp = 5/2 R exactly |
| CO₂ | 298 | 6000 | 195–1500 | OK — extrapolation 195→298 K: Cp slowly varying, <5% error |
| NH₃ | 298 | 6000 | 200–800 | OK — extrapolation 200→298 K: ~3% error |

**H₂O Tmin fix:** Change `Tmin: 500` → `Tmin: 298` in the H₂O cpig registration. The NIST Shomate coefficients (A=30.092, B=6.833...) are valid for 298–1700 K as a single range. The current Tmin=500 triggers spurious "below range" console warnings and forces unnecessary linear extrapolation for all steam below 227°C. One-character fix, lands in S1.

**Extrapolation behavior:** The `integrateShomateCp` function already handles below-range conditions with clamped linear extrapolation at boundary Cp. This is correct behavior — for the small extrapolation distances involved (N₂/O₂: 23 K below range; CH₄: 186 K below range), the error is bounded and acceptable for game accuracy. The extrapolation is conservative (uses Cp at boundary, which is close to the true value for these species).

### Antoine (Psat) Range Audit

| Species | Tmin (K) | Tmax (K) | Tc (K) | Coverage | Status |
|---|---|---|---|---|---|
| H₂O | 274 | 647 | 647 | Full (two ranges: 274–373, 372–647) | ✅ |
| O₂ | 60 | 154 | 155 | Full cryogenic range | ✅ |
| H₂ | 14 | 33 | 33 | Placeholder (supercritical at all operating T) | ✅ |
| N₂ | 63 | 126 | 126 | Full cryogenic range | ✅ |
| Ar | 84 | 151 | 151 | Full cryogenic range | ✅ |
| CH₄ | 91 | 191 | 191 | Full LNG range | ✅ |
| He | 2 | 5 | 5 | Placeholder (supercritical at all operating T) | ✅ |
| CO₂ | 154 | 196 | 304 | **Sublimation only** | ⚠️ Liquid-vapor range missing |
| NH₃ | 164 | 372 | 405 | Full (two ranges: 164–240, 240–372) | ✅ |

**CO₂ Antoine fix:** The registered Antoine covers 154–196 K (solid→vapor sublimation). CO₂ has no liquid phase at 1 atm. Above the triple point (216.6 K, 5.18 bar), liquid CO₂ exists, but the current Antoine returns sublimation pressure, not vapor pressure. At 250 K, Antoine extrapolation gives Psat ≈ 0.1 bar; real vapor pressure is ~17 bar.

This means Raoult K-values for CO₂ are qualitatively wrong above ~200 K. K = Psat/P is vastly underpredicted, so CO₂ is erroneously predicted as mostly liquid. In practice, the `T > Tb` heuristic catches the most obvious cases, but any flash involving CO₂ mixtures at moderate temperatures is unreliable.

**Fix:** Add a liquid-vapor Antoine range: `{ A: 7.5789, B: 861.82, C: 271.88, Tmin: 217, Tmax: 304, desc: 'Liquid-vapor (above triple point)' }`. Two lines of data. Lands in S1 alongside the chemistry palette work.

PR EOS (S3) ultimately replaces Antoine for VLE via fugacity coefficients, but fixing Antoine ensures the ideal package gives reasonable CO₂ behavior for early testing and sandbox mode.

### cpLiq (Constant Liquid Cp) Assessment

| Species | cpLiq (J/mol·K) | Valid near | Worst-case error | Notes |
|---|---|---|---|---|
| H₂O | 75.3 | 298 K | <1% over 273–373 K | Excellent |
| O₂ | 52.8 | 90 K | ~1% at 77 K (real: 53.5) | Fine |
| N₂ | 54.4 | 77 K | ~3% at 65 K (real: 56) | Acceptable |
| NH₃ | 80.8 | 240 K | ~12% at 200 K (real: 72) | Largest variation; PR departure functions improve |
| CH₄ | 52.6 | 112 K | ~3% at 100 K (real: 54) | Fine |

Constant cpLiq is the standard ideal-package simplification. PR EOS departure functions provide temperature-dependent corrections.

### Warning System Status

Range-exceeded warnings currently go to `console.warn` only, deduplicated via `_warnedRanges` Set. The player never sees them. S3 adds a new alarm source for thermo range violations, surfacing them through the existing AlarmSystem with appropriate severity.

### Summary of Fixes by Stage

| Fix | Effort | Stage |
|---|---|---|
| H₂O cpig `Tmin: 500` → `Tmin: 298` | 1 line | S1 |
| CO₂ Antoine: add liquid-vapor range (217–304 K) | 2 lines | S1 |
| CO species registration (MW, Tc, Pc, ω, Antoine, Shomate, cpLiq, rhoLiq, hf0, s0) | ~30 lines | S1 |
| Thermo range-exceeded alarm source | ~20 lines | S3 |
| HEX UA/NTU effective-Cp for phase-changing streams | ~15 lines | S4 |

### Confirmed Non-Issues

| Concern | Resolution |
|---|---|
| Valve doesn't compute JT cooling | Correct with ideal gas (μ_JT = 0). Automatic with PR EOS (H_departure). Zero code changes. |
| HEX can't handle evaporating/condensing | Handles correctly in approach and setpoint modes via PH-flash. UA/NTU underpredicts but doesn't crash. |
| Refrigeration loop impossible | Architecturally ready. Phase changes resolve in HEX. JT cooling activates with PR. |
| N₂/O₂ Shomate below 100 K | Extrapolation < 1% error. Diatomic Cp nearly constant at cryogenic T. |
| cpLiq accuracy for NH₃ refrigeration | ~12% variation at worst. Acceptable for game. PR improves it. |

---

## S1: Equipment Limits + Chemistry Palette

**Goal:** Every unit has a physical operating envelope. The chemistry web is complete for C/H/O/N. Thermo data fixes applied.

| Item | Source | What |
|---|---|---|
| **Equipment limits** | | |
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
| **Thermo data fixes** | | |
| H₂O cpig Tmin | audit finding | `Tmin: 500` → `Tmin: 298` — eliminates spurious extrapolation warnings |
| CO₂ Antoine liquid-vapor | audit finding | Add range `{ A: 7.5789, B: 861.82, C: 271.88, Tmin: 217, Tmax: 304 }` for VLE above triple point |
| **Chemistry palette** | | |
| CO species registration | new | MW=28.010, Tc=132.9, Pc=3499000, ω=0.048, Vc=0.0000930, Zc=0.292, Tb=81.6, Hv=6040; Antoine, cpig Shomate (two ranges), cpLiq=60.6, rhoLiq=789, hf0=-110530, s0=197.66. All NIST. |
| R_HABER | `equipment_limits_S.md` | N₂ + 3H₂ → 2NH₃ + thermo data + kinetics block |
| R_SMR | new | CH₄ + H₂O → CO + 3H₂, endothermic, equilibrium kinetics |
| R_WGS | new | CO + H₂O → CO₂ + H₂, mildly exothermic, equilibrium kinetics |
| R_RWGS | new | CO₂ + H₂ → CO + H₂O, endothermic (reverse WGS) |
| R_CH4_COMB | new | CH₄ + 2O₂ → CO₂ + 2H₂O, strongly exothermic |
| R_H2O_ELEC (data only) | `spec-electrochemical-reactor` | 2H₂O → 2H₂ + O₂, reaction data registered; unit comes in S6 |
| R_CO2_ELEC (data only) | new | 2CO₂ → 2CO + O₂, reaction data registered; unit comes in S6 |

**Rationale:** Three concerns addressed in one stage. Equipment limits are the data layer everything else reads (alarm presentation, inspector bars, performance maps, mission constraints). The chemistry palette makes the C/H/O/N reaction web fully connected. The thermo data fixes resolve silent inaccuracies identified by audit — H₂O's spurious extrapolation and CO₂'s broken Raoult VLE above 200 K. All are pure data registration or data correction — zero refactoring risk.

**Exit criteria:** All 13 units have limits. `evaluateLimits()` produces correct violations. CO species passes ComponentRegistry validation. All 7 new reactions pass mass balance check (Σνᵢ·MWᵢ = 0). Existing reactor runs R_SMR / R_WGS correctly at equilibrium. H₂O steam at 400 K produces no console range warning. CO₂ flash at 250 K / 20 bar produces reasonable K-values. All existing tests pass + ~15 new.

---

## S2: Power Management

**Goal:** Electrical overload has consequences. Hub allocation respects priority. Every power pathway is physically grounded.

| Item | Source | What |
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

## S3: Peng-Robinson EOS

**Goal:** Non-ideal thermodynamics. The existing `PengRobinsonPackage` stub becomes a working cubic EOS. Thermo range warnings surface through the alarm system.

### PR EOS Implementation

| Item | What |
|---|---|
| Cubic solver | Cardano or Newton for Z³ − (1−B)Z² + (A−3B²−2B)Z − (AB−B²−B³) = 0 |
| Root selection | Largest real positive Z = vapor, smallest = liquid; Gibbs test if ambiguous |
| α(T) function | Standard PR: α = [1 + κ(1 − √Tr)]², κ = f(ω) |
| Quantum gas guard | Modified α for ω < 0 (H₂, He): Boston-Mathias or Twu, or floor α > 0 |
| Mixing rules | a_mix, b_mix with kij (van der Waals one-fluid) |
| kij data table | Key pairs: H₂O-CO₂, H₂O-NH₃, CH₄-CO₂, CO-H₂, CO-CO₂ from literature; rest = 0 |
| Fugacity coefficients | ln φᵢ closed-form → override `kValue()` |
| Enthalpy departure | H_dep(T,P) from a, da/dT, Z, A, B → override `hMolar()` |
| Cp departure | Cp_dep from −T·d²a/dT² → override `cpMolar()` |
| Liquid density | ρ = P·MW / (Z_liq·R·T) → override `density()` |
| Compressibility | `compressibilityZ(n_map, T, P)` → mixture Z from cubic |
| Saturation pressure | Iterative bubble-P via φ_L = φ_V → override `saturationPressure()` |
| Compressor work | Entropy-based isentropic calc using departures |
| Convergence fallback | If PR flash doesn't converge in N iters → fall back to Raoult K |
| Package selector | UI toggle Ideal/PR in settings; default remains Ideal |

### Thermo Range Alarm Source

| Item | What |
|---|---|
| Range-exceeded alarm | New alarm source: if any unit operates with a species outside its Shomate/Antoine valid range → WARNING via AlarmSystem |
| Alarm fields | species, paramName (Cp_ig / Psat), T_actual, T_range_min, T_range_max |
| Severity | WARNING for extrapolation within 2× range; MAJOR for extreme extrapolation |
| Deduplication | One alarm per species per unit (not per tick) |

**Rationale:** PR EOS is the single largest physics upgrade. Enthalpy departure functions make the valve produce real Joule-Thomson cooling (audit confirmed valve is architecturally ready — just needs `hMolar` to include H_dep). Fugacity-based K-values replace Antoine/Raoult for VLE, fixing CO₂ and other non-ideal systems structurally. Liquid density from Z_liq replaces hardcoded ρ. The range alarm source surfaces the audit's console-only warnings through the player-visible alarm system.

### Known Deviations (document, don't hide)

| Issue | Severity | Mitigation |
|---|---|---|
| H₂, He: standard α(T) goes negative at high Tr | NaN if unguarded | Modified α or positive floor; test explicitly |
| Near-critical CO₂ (Tc = 304 K): root convergence | Phase oscillation | Hysteresis or near-critical classification |
| H₂O Psat: PR underpredicts by ~5-10% | Visible on VP envelope | Document; acceptable for game accuracy |

**Exit criteria:** PR passes pure-component and mixture VLE spot checks. Quantum gases handled. Departure functions within literature tolerance. JT cooling through valve produces T_out < T_in for NH₃ throttling. Range-exceeded alarms fire. Fallback fires on non-convergence. All prior tests pass unchanged + ~15 new.

---

## S4: Process Operations Completeness

**Goal:** The unit operation palette covers the fundamental separation and heat-exchange patterns. Specifically: multi-stage separation (distillation), corrected HEX effective Cp for phase-changing streams, and verified refrigeration loop behavior with PR EOS.

### Shortcut Distillation Column

| Item | What |
|---|---|
| Unit registration | `distillation_column` — new unit type, category SEPARATION |
| Ports | mat_in (feed), mat_out_D (distillate/overhead), mat_out_B (bottoms) |
| Energy ports | elec_in (reboiler duty from power), heat_out (condenser duty to cooling) |
| Core params | N_stages, reflux_ratio (R/R_min multiplier), feed_stage_frac, P_column |
| Fenske shortcut | N_min from log(x_D/x_B · x_B_heavy/x_D_heavy) / log(α_avg) |
| Underwood | R_min from Underwood equations using feed quality and relative volatilities |
| Gilliland | Actual N from Gilliland correlation at specified R/R_min |
| Component splits | From Fenske distribution at actual N: d_i/f_i = α_i^N / (1 + α_i^N) |
| K-values | From ThermoAdapter.kValue() — PR after S3 |
| Energy balance | Q_reboiler from boilup ratio, Q_condenser from reflux + distillate condensing |
| Feed thermal state | q parameter from feed enthalpy vs bubble/dew points |
| Diagnostics | Feasibility check: can specified separation be achieved? Pinch warning. |
| Inspector | N_stages slider, R/R_min slider, component split display, Q_reb/Q_cond KPIs |
| Presentation | Tall vertical unit (1×3 cells), tray lines, condenser/reboiler symbols |

**Process engineering justification:** A flash drum is a single equilibrium stage. It can separate components with very different volatilities (water from permanent gases) but cannot produce high-purity products from close-boiling mixtures. Without a column:

- Air separation (N₂/O₂, Tb diff = 13 K) tops out at ~35% O₂. Breathable grade needs >90%.
- Haber loop purification of NH₃ from unreacted N₂/H₂ needs multiple stages at cryogenic conditions.
- Syngas cleanup (CO/CO₂/H₂) requires fractionation.
- Every "produce pure X" mission has the same trivial flash-drum answer.

The shortcut method (Fenske-Underwood-Gilliland) is the standard preliminary design tool. It uses the same K-values the flash drum already calls, wrapped in algebraic correlations rather than stage-by-stage iteration. Rigorous tray-by-tray (MESH equations) is Aspen territory and unnecessary for the game's accuracy level.

### HEX UA/NTU Effective-Cp Fix

| Item | What |
|---|---|
| Audit finding | `hxCapacityRates` uses `streamCp` (sensible Cp only). For condensing/evaporating streams, effective Cp >> sensible Cp. UA/NTU mode underpredicts duty. |
| Existing workaround | Air cooler already computes `C_proc_eff = Q_demand / ΔT` which includes latent heat. |
| Fix | Apply the same effective-Cp pattern to `hxCapacityRates` (or to `hxSolveUaNtu` directly) when a stream's inlet phase differs from what PH-flash would give at the estimated outlet conditions. |
| Scope | ~15 lines in the `hxSolveUaNtu` function. |
| Impact | UA/NTU mode correctly sizes condensers and evaporators. Approach and setpoint modes already handle this correctly and are unaffected. |

### Refrigeration Loop Verification

The audit confirmed the architecture is sound. The valve is isenthalpic via PH-flash (H_target = H_in at P_out). HEX approach and setpoint modes handle two-phase correctly. JT cooling activates automatically through PR departure functions (S3). The tests below verify end-to-end behavior post-S3:

| Item | What |
|---|---|
| Valve JT test | NH₃ liquid at 20 bar → valve → 2 bar. Confirm T_out < T_in (JT cooling via PR H_departure). Confirm VL phase at outlet. |
| HEX evaporator test | VL NH₃ (cold side) at 2 bar exchanges heat with warm process stream. Confirm Q transferred matches latent heat. Approach mode. |
| HEX condenser test | Superheated NH₃ (hot side) at 20 bar cooled against ambient. Confirm condensation occurs, Q includes desuperheating + condensing duty. |
| End-to-end loop | Compressor → HEX(condenser, approach mode) → valve(JT) → HEX(evaporator, approach mode) → back to compressor. NH₃ working fluid. Confirm: loop converges, T_cold < T_ambient, energy balance closes. |
| CO₂ transcritical loop | Same pattern at 50–70 bar. Confirm PR EOS handles near-critical root selection. |
| UA/NTU phase-change test | HEX in UA/NTU mode with condensing hot side. Confirm effective-Cp fix produces correct duty (compare against approach mode result). |

**Exit criteria:** Distillation column produces correct splits for N₂/O₂ system (verified against handbook α values). Energy balance closes. HEX UA/NTU duty matches approach mode for phase-changing streams (within 5%). NH₃ refrigeration loop converges with sub-ambient cold side. CO₂ transcritical loop stable. All prior tests pass + ~12 new.

---

## S5: Pressure Network

**Goal:** Pressure is physically real. Tanks know their own pressure. It propagates through chains. Production won't advance with inconsistent pressure.

*Prerequisite: revision pass on `pressure_path` spec against v12.10.*

| Item | Source | What |
|---|---|---|
| Spec revision | `pressure_path` | Reconcile with v12.10 — drop/remap stale renames, confirm unit table |
| computeTankState() | `pressure_path` F-004 | Pure fn: inventory → headspace P, liquid volume, VLE phase split (uses S3 PR) |
| Tank 5-port rewrite | `pressure_path` F-005 | vap_out (top), liq_out (bottom), vent (safety), liq_overflow (safety) |
| Pressure role declarations | `pressure_path` F-007 | anchor/boost/drop/passthrough/none on every registered unit |
| deltaP_bar params | `pressure_path` F-008 | Fixed ΔP on all passthrough units, HEX gets hot + cold independently |
| Column pressure | new | Distillation column from S4 declares P_column as anchor for its zone |
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

**Rationale:** Largest and highest-risk engine workstream. After S5, pressure emerges from physics rather than being stamped by the user. With S3's PR EOS in place, `computeTankState()` uses real liquid densities and non-ideal VLE. With S4's column registered, the pressure network includes column operating pressure as an anchor. The ideal/engineering split preserves backward compatibility. BFS propagation is deterministic. Pressure gating blocks production on inconsistent physics.

**Exit criteria:** Tank P from headspace. BFS resolves chains. Conflicts detected. Production gated. Column P integrated. Ideal flowsheets unaffected. All prior tests pass + ~40 new.

---

## S6: Electrochemical Reactor + Reactions

**Goal:** Third reactor paradigm. Power drives chemistry. Two electrochemical reactions become usable.

| Item | Source | What |
|---|---|---|
| reactor_electrochemical | `spec-electrochemical-reactor` | New unit: 4 ports (mat_in, power_in, mat_out, heat_out) |
| ELECTROCHEMICAL kinetics | `spec-electrochemical-reactor` | New KineticsEval branch: ξ = f(power), not f(T, concentration) |
| Power demand contract | `spec-electrochemical-reactor` | Declares `ξ_max × |ΔH| / η` before receiving actual allocation |
| Efficiency + conversion | `spec-electrochemical-reactor` | η (0.30–0.95, default 0.70), conversion_max (0.01–0.99, default 0.80) |
| Energy balance: heat_out | `spec-electrochemical-reactor` | Waste heat = P_available − Q_chem exits via heat port |
| R_H2O_ELEC activation | S1 data | Water splitting now usable: 2H₂O → 2H₂ + O₂ |
| R_CO2_ELEC activation | S1 data | CO₂ splitting now usable: 2CO₂ → 2CO + O₂ |
| R_CH4_COMB activation | S1 data | Combustion available in thermal reactors (already registered) |

**Rationale:** The three reactor paradigms now cover every practical driving force: thermal kinetics (adiabatic), thermodynamic equilibrium, and electrical input (electrochemical). The electrochemical reactor gets two reactions (H₂O and CO₂ splitting) — it's not a one-trick unit. CO₂ electrolysis is the keystone of Mars ISRU: split CO₂ from atmosphere electrically → CO + O₂, then WGS the CO with water for H₂, then Haber the H₂ with N₂ for fertilizer. That's three missions from one unit + reaction pair.

**Exit criteria:** Electrochemical reactor passes mass/energy balance for both reactions. Power-limited operation works. CO₂ electrolysis produces CO + O₂ at correct stoichiometry. All prior tests pass + ~8 new.

---

## S7: Performance Maps

**Goal:** The engine's physics become visible. Operating envelopes, phase boundaries, and reaction feasibility rendered on interactive canvases.

| Item | Source | What |
|---|---|---|
| Canvas infrastructure | `heatStream_perfmaps` Ph1 | HiDPI setup, lin/log axes, tick generation, pointer tracking, color scale |
| Species VP envelopes | `heatStream_perfmaps` Ph3 | Psat(T) curves per species (PR EOS from S3), Tc dots, Tb ticks |
| Dynamic phase maps | `heatStream_perfmaps` Ph4 | Bubble P / dew P from actual inlet composition, cached by hash |
| Reactor feasibility maps | `heatStream_perfmaps` Ph5 | T×P field maps, conversion % as color, contours |
| Column operating map | new | Reflux vs. stages (Gilliland curve) with current operating point |
| Inspector map hooks | `heatStream_perfmaps` Ph7 | `config?.map` in inspector rendering, click-to-expand |
| Limit region overlays | `heatStream_perfmaps` near-term | LL/HH shading on maps — reads S1 limit data |
| Operating point marker | `heatStream_perfmaps` Ph1 | Crosshair at current T/P on all maps |

**Rationale:** Visualization of what the engine already knows. VP envelopes show phase boundaries with non-ideal corrections from S3. Column operating maps show where the current design sits on the Gilliland curve from S4. Limit overlays show equipment envelope from S1. Together they make the engine legible without requiring a ChemE degree.

**Exit criteria:** Maps render for flash drum, pump, compressor, reactors, column. Limit regions visible. Operating point tracks. All prior tests pass + ~5 new.

---

## S8: Game Infrastructure

**Goal:** The engine is fully grounded. Now add missions, campaigns, and the game shell — purely additive, reading from stable engine APIs.

| Item | Source | What |
|---|---|---|
| **Dual-scene refactor** | | |
| Global scene extraction | `game-spec` §0.1 | `EditorSession.activeScene` replaces global `scene` everywhere |
| ProductionClock | `game-spec` §0.2 | Independent clock alongside TimeClock |
| UndoStack scoping | `game-spec` §0.3 | Scoped to active scene, disabled in production |
| SimSettings save/restore | `game-spec` §0.4 | Snapshot/restore for mission context switching |
| Inventory serialization | `game-spec` §0.5 | exportJSON/importJSON + inventory + pos3d + clock → scene version 17 |
| placeUnit guard | `game-spec` §0.6 | Parts enforcement wrapper (no-op in sandbox) |
| **Mission engine** | | |
| MissionDefinition schema | `game-spec` §3.3 | Frozen JSON: parts, locks, objectives, rewards, narrative hooks |
| MissionRegistry | `game-spec` §12.1 | Register/get/freeze/unlock |
| EditorSession.start() | `game-spec` §1.2 | Configure settings, load parts, enter mission context |
| Palette restriction | `game-spec` §4.1 | Count badges, greying, tease reasons |
| paramLocks | `game-spec` §4.3 | Fixed/range/readonly — plugs into S1's getEffectiveLimits() |
| ObjectiveEvaluator | `game-spec` §5.1 | Evaluator registry + built-in types |
| Built-in evaluators | `game-spec` §5.2 | convergence, produce_pure, maintain_conditions, store_component, sustained_flow, total_produced |
| Objective HUD | `game-spec` §1.6 | ✓/◐/○ indicators |
| Mission flow | `game-spec` §1.7 | Briefing → editor → check → debrief → stars |
| **Sim/prod state machine** | | |
| enterSimulation() | `game-spec` §2.2 | Deep-clone, snapshot, mode switch |
| commitToProduction() | `game-spec` §2.2 | Diff, parts check, inventory-preserving merge |
| revertSimulation() | `game-spec` §2.2 | Discard + restore |
| ProductionClock.tick() | `game-spec` §2.3 | Warp speeds, background ticking |
| **Economy** | | |
| EconomyEngine | `game-spec` §6.2 | Demand evaluation from sink flows |
| ProductionLedger | `game-spec` §7.2 | Cumulative tracking, history ring buffer |
| InventoryReport | `game-spec` §7.4 | Tank/battery summary snapshot |
| Runway calculation | `game-spec` §7.3 | f(current rates, storage, demands) |
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

**Rationale:** The engine doesn't move anymore. S8 is purely additive. `paramLocks` reads S1 limits. Power-limited missions use S2 overload. PR EOS from S3 makes high-pressure missions credible and JT cooling real. The distillation column from S4 enables purity-based objectives. Pressure gating from S5 adds a physics difficulty axis. The electrochemical reactor from S6 provides ISRU mission variety. Performance maps from S7 populate the player's reference tools. Nothing in S8 requires revisiting engine code.

**Exit criteria:** Player can launch from home screen, play a mission with restricted parts, commit to production, see survival HUD, save/load campaign. All prior tests pass + ~30 new.

---

## Mission Design Space (what the engine enables after S1–S7)

The combination of units, reactions, and physics creates fundamentally different process challenges:

| Mission archetype | Key units | Key reactions | Key physics | Design tension |
|---|---|---|---|---|
| Air separation | Column, compressor, HEX, valve | — (separation only) | Cryogenic VLE (S3), column stages (S4) | Stages vs. energy: more stages = purer O₂ but more reboiler duty |
| Water electrolysis | Electrochem reactor, tank | R_H2O_ELEC | Power budget (S2) | Power allocation: splitting water vs. running life support |
| Haber synthesis | Reactor, compressor, column, recycle | R_HABER | High-P equilibrium (S3, S5), recycle convergence | Pressure vs. conversion: higher P = more NH₃ but more compression energy |
| Sabatier / ISRU | Reactor, electrochem, column | R_SABATIER, R_CO2_ELEC | CO₂ feed, water management | CO₂ vs. H₂O as O₂ source: two pathways, different energy profiles |
| Syngas chain | 2 reactors in series, column | R_SMR, R_WGS | High-T reforming, equilibrium shift | Temperature staging: SMR wants heat, WGS wants cooling |
| Refrigeration loop | Compressor, HEX ×2, valve | — (phase change only) | JT cooling (S3), two-phase HEX (S4) | Working fluid choice: NH₃ (high ΔH_vap) vs. CO₂ (high P, compact) |
| Power generation | Gas turbine, reactor, compressor | R_CH4_COMB | Expansion ratio, combustion T | Efficiency vs. materials: hotter combustion = more power but equipment limits (S1) |
| Mars bootstrap | Electrochem, reactor, column, tank | R_CO2_ELEC, R_WGS, R_HABER | Full chain: CO₂ atm → O₂ + fuel + fertilizer | Resource sequencing: what do you build first with limited parts? |

Without S4 (column), the Haber, air separation, and syngas missions collapse to trivial flash-drum solutions.
Without S1 (CO + reactions), the syngas and Mars bootstrap missions don't exist at all.
Without S3 (PR EOS), refrigeration loops have no JT cooling and high-P VLE is unreliable.

---

## Parked

| Item | Prerequisites | Notes |
|---|---|---|
| Narrative system | S8 | Content delivery. Purely additive. |
| Bible of Thermodynamics | S7 + S8 | Static content + S7 maps in slide-over. |
| 3D view (Three.js) | S8 | Large independent workstream. |
| Advanced valves (Cv) | S5 | Reads pressure nodes. |
| M/L equipment sizes | S1 | Data exercise. |
| Mission editor | S8 | Author JSON by hand until format stabilizes. |
| Alarm pipeline extensions | S1 | Cascade suppression, shelving, dead-banding. |
| Inspector limit bars | S1 | Visual bars in LL/L/H/HH envelope. |
| Hub rated throughput | S2 | Hub power rating design question. |
| Absorber unit | S4 + Chapter 2 species | Needed for sulfur/acid gas removal. New mass-transfer paradigm. |
| Sulfur chemistry | Chapter 2 | H₂S, SO₂, S species + Claus/combustion reactions + absorber unit. |
| Phosphorus chemistry | Chapter 2 | PH₃, P₂O₅ + phosphoric acid route. |

---

## Spec Document Status

| Document | Consumed in | Revision needed? |
|---|---|---|
| `final_equipment_limits_S.md` | S1 | No — data ready as-is |
| `RELEASESPEC_heatStream_perfmaps.md` | S1 (Ph2+6), S7 (Ph1,3–5,7) | Minor — Phase 0 done in v12 |
| `v13_power_spec.md` | S2 | No — current |
| *(new spec needed)* | S3 | PR EOS implementation spec |
| *(new spec needed)* | S4 | Distillation column spec |
| `RELEASESPEC_pressure_path.md` | S5 | **Yes** — written for v10.7, needs v12.10 reconciliation |
| `spec-electrochemical-reactor.md` | S6 | Minor — add R_CO2_ELEC to scope |
| `processThis-game-spec-v2.md` | S8 | Minor — line numbers shifted |

---

## Test Projection

| Stage | Estimated new tests | Cumulative |
|---|---|---|
| Baseline (v12.10.0) | — | 289 |
| S1: Limits + Chemistry | ~15 | ~304 |
| S2: Power Management | ~8 | ~312 |
| S3: Peng-Robinson EOS | ~15 | ~327 |
| S4: Process Operations | ~12 | ~339 |
| S5: Pressure Network | ~40 | ~379 |
| S6: Electrochemical Reactor | ~8 | ~387 |
| S7: Performance Maps | ~5 | ~392 |
| S8: Game Infrastructure | ~30 | ~422 |

All existing tests must pass at every stage boundary. No test may be deleted without documented justification.
