# processThis — Reaction System Design Document

**Version**: 2.1 — Phase 1 Complete  
**Author**: Design Authority  
**Date**: 2026-02-15  
**Baseline codebase**: processThis v8.1.0  
**Status**: APPROVED — Phase 1 implemented, Phases 2–6 pending

---

## Implementation Status

| Phase | Version | Description | Status | Tests |
|-------|---------|-------------|--------|-------|
| 1 | v8.1.0 | Component data enrichment (hf0, s0) | ✅ DONE | 110 total (769 checks, 0 fail) |
| 2 | v8.2.0 | Formation enthalpy shift in ThermoAdapter | ⬜ NEXT | — |
| 3 | v8.3.0 | ReactionRegistry + Source (Mix) | ⬜ | — |
| 4 | v8.4.0 | Reactor — Fixed Conversion | ⬜ | — |
| 5 | v8.5.0 | Reactor — K(T) Equilibrium-Lite | ⬜ | — |
| 6 | v8.6.0 | UI Polish | ⬜ | — |
| — | v9.0.0 | Version bump (reactor operational) | ⬜ | — |

### Phase 1 Implementation Notes

- All 8 species populated with `hf0_Jmol` and `s0_JmolK` from NIST Chemistry WebBook
- Fields added to `register()`, `getPropertyNames()`, `validate()` (warnings)
- Test 110 (Section AA): 46 checks covering data presence, types, NIST spot-checks, validation warnings
- Zero deviations from design
- Test numbering note: Design called this "Test 113" but actual test number in
  the suite is 110 (because section numbering is sequential by insertion order).
  Test sections are labeled AA, AB, etc. regardless of absolute number.

### Headless Test Runner

Tests run via Node.js extraction of all 4 script blocks. Block 2 requires DOM
mocks because `streamMass_kgps` and `computeSystemBalance` (pure functions used
by tests) are co-located with UI code. This is a pre-existing architectural quirk.

The runner script (`run_tests.js`) extracts blocks, wraps block 2 in try/catch
for DOM init failures, and invokes `PG.runTests()`. Command:

```bash
node run_tests.js && node _test_core.js
```

---

## Document Purpose

This is the **single authoritative reference** for the reaction system implementation.
It captures every design decision, architectural constraint, implementation phase,
and test expectation. Work may span multiple sessions — this document is the
continuity anchor. Any implementation must conform to this document. Any deviation
requires updating this document first.

**Supersedes**: DESIGN_reactions_v1.md (deleted) and DESIGN_reactions_v2.md (replaced).

---

## Table of Contents

0. [Executive Summary](#0-executive-summary)
1. [Scope and Constraints](#1-scope-and-constraints)
2. [Formation Enthalpy Shift](#2-formation-enthalpy-shift)
3. [Component Data Enrichment](#3-component-data-enrichment)
4. [ReactionRegistry](#4-reactionregistry)
5. [Multi-Component Source Unit](#5-multi-component-source-unit)
6. [Reactor Unit](#6-reactor-unit)
7. [STREAM_CONTRACTS Impact](#7-stream_contracts-impact)
8. [Mass and Energy Balance Verification](#8-mass-and-energy-balance-verification)
9. [UI Integration](#9-ui-integration)
10. [Test Plan](#10-test-plan)
11. [Implementation Phases](#11-implementation-phases)
12. [Risk Assessment](#12-risk-assessment)
13. [Design Decisions Log](#13-design-decisions-log)
14. [Deferred Work](#14-deferred-work)
15. [File Placement Guide](#15-file-placement-guide)

---

## 0. Executive Summary

Add chemical reaction capability to processThis via:

1. **Formation enthalpy shift** in `ThermoAdapter.hMolar()` — reaction heat emerges
   naturally from composition change. Proven zero-impact on non-reactive flowsheets.
2. **Component data enrichment** — add `hf0_Jmol` and `s0_JmolK` for ALL 8 existing
   species. ✅ DONE (v8.1.0).
3. **ReactionRegistry** — validates reactions at registration time (mass balance,
   species existence, data completeness). By-design elimination of runtime errors.
4. **Multi-component source** — emits a user-defined composition mix. Default: air.
5. **Adiabatic reactor unit** — fixed conversion (Phase 4), then K(T) equilibrium-lite
   (Phase 5). Follows established tick → PH-flash → solver pattern.

**Versioning strategy**: All implementation work occurs under v8.x.y. The version
bumps to v9 only when a working reactor with at least one reaction is operational
and all tests pass.

---

## 1. Scope and Constraints

### 1.1 In Scope

- ComponentRegistry: add `hf0_Jmol` and `s0_JmolK` fields for ALL 8 species ✅
- ThermoAdapter: formation enthalpy shift in `hMolar()`
- ReactionRegistry: new static registry class
- Multi-component source unit (`source_multi`)
- Reactor unit: adiabatic, fixed conversion + K(T) equilibrium-lite
- First reaction: 2 H₂ + O₂ → 2 H₂O
- UI: reactor in palette, property panel, reaction registry viewer
- Comprehensive tests at every layer

### 1.2 Explicitly Out of Scope

- Multi-reaction equilibrium (multiple simultaneous reactions)
- Fugacity/activity models (non-ideal phase equilibrium)
- True adiabatic equilibrium (coupled ξ–T self-consistent solve)
- Kinetics (rate laws, residence time, catalyst deactivation)
- Liquid-phase reactions (K/Q uses gas-phase ideal activities)
- Cpig polynomial form change (Shomate migration — see §14)
- Exhaustive reaction registry population (one reaction for now)

### 1.3 Governing NNG

| NNG | Relevance |
|-----|-----------|
| NNG-L1 | Mass: reactor conserves total mass by stoichiometric design |
| NNG-L2 | Energy: formation shifts ensure ΔH_rxn captured in enthalpy |
| NNG-A1 | Single-file HTML — all code in processThis.html |
| NNG-A2 | DOM-free core — reactor logic, registries, tests in script block 1 |
| NNG-A5 | Registry pattern — ReactionRegistry follows ComponentRegistry pattern |
| NNG-U1 | SI units: J/mol, K, Pa, mol/s internally |
| NNG-U2 | Reactor registered via UnitRegistry.register() |
| NNG-U3 | All thermo through ThermoAdapter — no direct EOS/package calls in units |
| NNG-U4 | No direct package method calls from units |
| NNG-D1 | All species in streams must exist in ComponentRegistry |
| NNG-D2 | Reaction species: hf0_Jmol required, stoich mass-balanced at registration |
| NNG-D3 | Reactor cannot produce unregistered species |
| NNG-T1 | All existing tests must pass after every change |
| NNG-T2 | New features must include tests |
| NNG-T3 | Tests must be deterministic |
| NNG-V1 | Version increment + changelog for each functional change |
| NNG-V2 | Changelog: what, why, which NNG, which tests |

---

## 2. Formation Enthalpy Shift (Thermochemistry)

### 2.1 Problem Statement

Current `hMolar(comp, T, P, phase)` returns "physical enthalpy" — Cp integrated
from T_ref = 298.15 K, with a vapor offset for boiling-point continuity. Reference:
h_L(298.15 K) = 0 per component. This makes ΔH meaningless across composition
changes — the heat of reaction is invisible.

### 2.2 Solution: Chemical Shift

Define a constant per component:

```
chemShift(comp) = hf0_Jmol(comp) − h_phys(comp, 298.15 K, P_std, 'V')
```

Where:
- `hf0_Jmol`: standard enthalpy of formation at 298.15 K, gas phase, 1 bar (NIST)
- `h_phys`: current physical enthalpy from the active thermo package
- `P_std` = 1e5 Pa

Total (reaction-aware) enthalpy:

```
h_total(comp, T, P, phase) = h_phys(comp, T, P, phase) + chemShift(comp)
```

**Verification at standard state**:

```
h_total(comp, 298.15, P_std, 'V') = h_phys(298.15,'V') + hf0 − h_phys(298.15,'V') = hf0  ✓
```

**For components without hf0_Jmol**: chemShift = 0. Existing behavior preserved.

### 2.3 Zero-Impact Proof for Non-Reactive Units

**Theorem**: For any unit where the outlet molar flow vector equals the inlet
molar flow vector (same composition), the formation shift has zero effect on
energy balance residuals, outlet temperatures, and all computed values.

**Proof**: Let CS_i = chemShift(species i), constant per species.

For any unit with identical inlet/outlet composition:

```
ΔH_new = Σ_i n_i × [h_phys(i,T_out) + CS_i] − Σ_i n_i × [h_phys(i,T_in) + CS_i]
       = Σ_i n_i × [h_phys(i,T_out) − h_phys(i,T_in)] + Σ_i n_i × [CS_i − CS_i]
       = Σ_i n_i × [h_phys(i,T_out) − h_phys(i,T_in)]
       = ΔH_old
```

For PH-flash: solver seeks T such that Σ n_i × h_total(i,T) = H_target.
Both sides include the same Σ n_i × CS_i (same composition), which cancels.
The root T is identical to pre-shift. ∎

**Consequence**: All existing tests pass without modification (NNG-T1).

### 2.4 Implementation in ThermoAdapter

The shift is applied in `ThermoAdapter.hMolar()`, NOT in `IdealRaoultPackage.hMolar()`.

Rationale:
- Package-independent: applies automatically to all current and future packages
- Invisible to existing code: no call-site changes needed
- Clean separation: packages compute physical enthalpy, adapter adds chemical reference

```javascript
// In ThermoAdapter class:

_chemShiftCache = {};

/** Molar enthalpy [J/mol] — physical enthalpy + formation shift */
hMolar(comp, T_K, P_Pa, phaseHint = null) {
    const h_phys = this._pkg.hMolar(comp, T_K, P_Pa, phaseHint);
    return h_phys + this._getChemShift(comp);
}

_getChemShift(comp) {
    if (this._chemShiftCache[comp] !== undefined) {
        return this._chemShiftCache[comp];
    }
    const compData = ComponentRegistry.get(comp);
    if (!compData || compData.hf0_Jmol === undefined || compData.hf0_Jmol === null) {
        this._chemShiftCache[comp] = 0;
        return 0;
    }
    const h_phys_ref = this._pkg.hMolar(comp, 298.15, 1e5, 'V');
    const shift = compData.hf0_Jmol - h_phys_ref;
    this._chemShiftCache[comp] = shift;
    return shift;
}
```

**Cache invalidation**: `_chemShiftCache = {}` added to `setPackage()` path
(the existing `clearCaches()` call chain).

**No changes needed to**: `computeStreamEnthalpy()`, `getHdot_Jps()`, `phFlash()` —
they all call `hMolar()` which now returns shifted values transparently.

---

## 3. Component Data Enrichment ✅ DONE (v8.1.0)

### 3.1 New Fields

Added to `ComponentRegistry.register()`:

```javascript
hf0_Jmol: spec.hf0_Jmol ?? null,   // Std enthalpy of formation (J/mol), gas, 298.15 K, 1 bar
s0_JmolK: spec.s0_JmolK ?? null,   // Std molar entropy (J/(mol·K)), gas, 298.15 K, 1 bar
```

### 3.2 Data for ALL 8 Existing Species

Source: NIST Chemistry WebBook, gas phase, standard state 1 bar, 298.15 K.

| Species | hf0_Jmol (J/mol) | s0_JmolK (J/(mol·K)) | Notes |
|---------|-------------------|------------------------|-------|
| H₂O | −241826 | 188.835 | Gas-phase ΔfH° |
| O₂ | 0 | 205.152 | Element, reference state |
| H₂ | 0 | 130.680 | Element, reference state |
| N₂ | 0 | 191.609 | Element, reference state |
| Ar | 0 | 154.845 | Element, reference state |
| CH₄ | −74870 | 186.251 | Gas-phase ΔfH° |
| He | 0 | 126.153 | Element, reference state |
| CO₂ | −393510 | 213.785 | Gas-phase ΔfH° |

### 3.3 Property Display

Added to `getPropertyNames()`:

```javascript
{ key: 'hf0_Jmol', name: 'Std Formation Enthalpy', unit: 'J/mol' },
{ key: 's0_JmolK', name: 'Std Molar Entropy', unit: 'J/(mol·K)' },
```

### 3.4 Validation

Added to `ComponentRegistry.validate()` as warnings (not errors):

```javascript
if (comp.hf0_Jmol === null || comp.hf0_Jmol === undefined)
    warnings.push('Missing formation enthalpy (hf0_Jmol) — required for reactions');
if (comp.s0_JmolK === null || comp.s0_JmolK === undefined)
    warnings.push('Missing standard entropy (s0_JmolK) — required for equilibrium reactions');
```

### 3.5 Note on Cpig Polynomial Form

The current Cpig correlations use `Cp = A + BT + CT² + DT³ + ET⁴` (raw polynomial
in K), labeled "NIST WebBook" in comments. NIST actually publishes Shomate
parameters using `t = T(K)/1000` with a different functional form. The current
coefficients are adapted fits, not native Shomate.

**Decision**: Cpig migration **deferred** (see §14). The formation shift is
independent of Cp convention.

---

## 4. ReactionRegistry

### 4.1 Pattern

Follows NNG-A5: static class with `_map`, `register()`, `get()`, `all()`, `exists()`.

### 4.2 Reaction Object Schema

```javascript
{
    id:          String,    // Stable unique ID (e.g., 'R_H2_COMB')
    name:        String,    // Display name
    equation:    String,    // Human-readable balanced equation
    stoich:      Object,    // { compId: νᵢ } — negative=reactant, positive=product
    reversible:  Boolean,   // true if equilibrium mode applicable (default: true)
    Tmin_K:      Number,    // Activation window lower T (K)
    Tmax_K:      Number,    // Activation window upper T (K)
    Pmin_Pa:     Number,    // Activation window lower P (Pa)
    Pmax_Pa:     Number,    // Activation window upper P (Pa)
    notes:       String,    // Optional description
    references:  Array,     // [{ source: 'NIST'|'literature', detail: String }]
}
```

### 4.3 Registration-Time Validation (NNG-D2)

Every `ReactionRegistry.register(id, spec)` call validates:

1. **Uniqueness**: `id` not already registered → throw if duplicate
2. **Species existence**: every key in `stoich` exists in ComponentRegistry → throw
3. **Formation enthalpy completeness**: every species in `stoich` has
   `hf0_Jmol !== null` → throw (NNG-L2 requires this for energy balance)
4. **Stoichiometric structure**: at least one νᵢ < 0 (reactant) and one νᵢ > 0
   (product) → throw
5. **Mass balance**: |Σ νᵢ × MW_i| < 0.01 g/mol → throw if violated
6. **Window validity**: Tmin < Tmax, Pmin < Pmax → throw
7. **Entropy completeness** (warning only): if `reversible: true`, check all
   species have `s0_JmolK`. Missing → console.warn

### 4.4 First Reaction

```javascript
ReactionRegistry.register('R_H2_COMB', {
    name: 'Hydrogen Combustion',
    equation: '2 H₂ + O₂ → 2 H₂O',
    stoich: { H2: -2, O2: -1, H2O: 2 },
    reversible: true,
    Tmin_K: 400,
    Tmax_K: 3000,
    Pmin_Pa: 50000,       // 0.5 bar
    Pmax_Pa: 5000000,     // 50 bar
    notes: 'Strongly exothermic. K >> 1 at all practical temperatures.',
    references: [
        { source: 'NIST', detail: 'Formation enthalpies/entropies from NIST Chemistry WebBook' }
    ]
});
```

### 4.5 API

```javascript
class ReactionRegistry {
    static _map = new Map();
    static register(id, spec)    // Validates, stores. Throws on failure.
    static get(id)               // Returns reaction object or undefined.
    static all()                 // Returns array of all reactions.
    static list()                // Alias for all().
    static exists(id)            // Boolean.
    static validateAll()         // Re-validates all. Returns { id: {valid, errors} }.
}
```

Export: `PG.ReactionRegistry = ReactionRegistry;`

---

## 5. Multi-Component Source Unit

### 5.1 Purpose

The existing `source` unit emits a single species. `source_multi` emits a
user-defined composition mix. Default: dry air.

### 5.2 Design

| Field | Value |
|-------|-------|
| defId | `'source_multi'` |
| name | `'Source (Mix)'` |
| category | `UnitCategories.SOURCE` |
| size | 2×2 |

**Ports**: Single `out` (MATERIAL, OUT).

**Parameters**:

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `n` | Object | `{ N2: 0.78, O2: 0.21, Ar: 0.01 }` | Molar flow map (mol/s) |
| `T` | Number | 298.15 | Temperature (K) |
| `P` | Number | 101325 | Pressure (Pa) |
| `phaseConstraint` | String | `'V'` | Phase constraint |

**Tick logic**: Validates all species exist in ComponentRegistry, clamps T,
emits TP-specified material stream.

---

## 6. Reactor Unit

### 6.1 Identity

| Field | Value |
|-------|-------|
| defId | `'reactor_adiabatic'` |
| name | `'Reactor (Adiabatic)'` |
| category | `UnitCategories.REACTOR` |
| size | 2×2 |

### 6.2 Ports

| portId | dir | type | position |
|--------|-----|------|----------|
| `mat_in` | IN | MATERIAL | (0, 1) |
| `mat_out` | OUT | MATERIAL | (2, 1) |

### 6.3 Parameters

| Parameter | Type | Default | UI |
|-----------|------|---------|-----|
| `reactionId` | string | `null` | Dropdown from ReactionRegistry |
| `mode` | string | `'fixed'` | `'fixed'` / `'equilibrium'` |
| `conversion` | number | `0.0` | Slider 0–1 (Mode A) |
| `alpha` | number | `1.0` | Slider 0–1 (Mode B) |
| `P_out` | number | `null` | Optional, Pa. Default = inlet P |
| `T_eval_override` | number | `null` | Optional K, Mode B advanced |

### 6.4 Tick Logic — Mode A (Fixed Conversion)

```
GUARDS:
    if (!sIn) → return
    if (!reaction) → error, return

STEP 1 — Activation window (inlet T/P only):
    Outside window → pass-through TP spec, status 'inactive'

STEP 2 — ξ_max = min over reactants of (n_in[i] / (−νᵢ))

STEP 3 — ξ = clamp(conversion, 0, 1) × ξ_max

STEP 4 — n_out[i] = n_in[i] + νᵢ × ξ (clamp negatives to 0)

STEP 5 — H_in = thermo.getHdot_Jps(sIn)

STEP 6 — Emit PH-flash: { P, n: n_out, H_target_Jps: H_in }

STEP 7 — Diagnostics on u.last
```

### 6.5 Tick Logic — Mode B (K(T) Equilibrium-Lite)

```
STEPS 1–2: Same as Mode A

STEP 3 — ln K = −ΔH°/(R·T_eval) + ΔS°/R

STEP 4 — Bisection: find ξ_eq where ln Q(ξ) = ln K

STEP 5 — ξ = alpha × ξ_eq

STEPS 6–7: Same as Mode A
```

T_eval = T_in (not rigorous adiabatic equilibrium — documented limitation).

### 6.6 Phase Handling

K/Q uses ideal-gas activities. Default `phaseConstraint: 'V'`. Gas-phase only for v1.

---

## 7. STREAM_CONTRACTS Impact

No changes needed. Reactor emits standard PH-flash or TP specs.

---

## 8. Mass and Energy Balance Verification

### 8.1 Mass (NNG-L1)

By construction: ReactionRegistry validates |Σ νᵢ × MW_i| < 0.01.
Therefore mass_out = mass_in + ξ × 0 = mass_in.

### 8.2 Energy (NNG-L2)

By construction: H_target = H_in (adiabatic). Solver guarantees H_out = H_target.
Formation shifts make T_out absorb reaction heat.

---

## 9. UI Integration

Reactor icon in REACTOR category. Property panel with reaction selector,
mode toggle, conversion/alpha inputs. Reaction Registry viewer in menu.
UI is last phase — correctness first.

---

## 10. Test Plan

### Section AA: Component Thermochemical Data ✅ DONE

**Test 110** (implemented as "All species have thermochemical reference data"):
- All 8 species have finite hf0_Jmol and positive finite s0_JmolK
- Spot-checks: H2O, CH4, CO2 formation enthalpies; H2, O2, N2 = 0
- No hf0/s0 validation warnings for any species
- 46 assertions, all passing

### Section AB: Formation Shift (Phase 2)

**Test 111**: Formation enthalpy alignment at standard state
- hMolar('H2O', 298.15, 1e5, 'V') ≈ −241826 (±500)
- hMolar('H2', 298.15, 1e5, 'V') ≈ 0 (±500)
- hMolar('CH4', 298.15, 1e5, 'V') ≈ −74870 (±500)
- hMolar('CO2', 298.15, 1e5, 'V') ≈ −393510 (±500)

**Test 112**: Non-reactive invariance regression
- Mirror of Test 1 (Water Throttling Flash) — all original assertions hold

**Test 113**: Reaction enthalpy sanity
- ΔH°_rxn for H₂ combustion ≈ −483652 J/mol-rxn (±2000)

### Section AC: Multi-Component Source (Phase 3)

**Test 114**: Air source baseline (3 species, valid flash)
**Test 115**: Custom H2/O2 composition

### Section AD: Reactor Fixed Conversion (Phase 4)

**Test 116**: Full conversion + adiabatic closure
**Test 117**: Partial conversion (25%)
**Test 118**: Limiting reactant
**Test 119**: Inactive — T below window
**Test 120**: Inert pass-through

### Section AE: ReactionRegistry Validation (Phase 3)

**Test 121**: Valid registration and retrieval
**Test 122**: Validation rejects bad reactions
**Test 123**: Mass balance computation

### Section AF: Reactor K(T) Mode (Phase 5)

**Test 124**: K(T) strongly favors products (ξ_eq/ξ_max > 0.999)
**Test 125**: Alpha scaling
**Test 126**: T_eval override

### Reference Values

```
ΔH°_298 = 2×(−241826) − 0 − 0 = −483652 J/mol-rxn
ΔS°_298 = 2×188.835 − 2×130.680 − 205.152 = −88.842 J/(mol·K)
ln K(800) ≈ 62.0 → K >> 1
```

---

## 11. Implementation Phases

### Phase 1: Component Data Enrichment ✅ DONE (v8.1.0)

- Added hf0_Jmol, s0_JmolK to all 8 species
- Added to getPropertyNames(), validate()
- Test 110 (Section AA): 46 checks, all pass
- Full suite: 110/110 tests, 769/769 checks, 0 failures

### Phase 2: Formation Enthalpy Shift (v8.2.0) ← NEXT

**What changes**:
1. Add `_chemShiftCache` and `_getChemShift()` to ThermoAdapter
2. Modify `ThermoAdapter.hMolar()` to add shift
3. Add cache clearing to `setPackage()` / `clearCaches()` path

**Tests added**: Tests 111–113 (Section AB)

**Critical**: Run ALL existing tests. §2.3 guarantees they pass.

### Phase 3: ReactionRegistry + Source (Mix) (v8.3.0)

**What changes**:
1. ReactionRegistry class
2. Register R_H2_COMB
3. source_multi unit
4. Export ReactionRegistry on PG

**Tests added**: Section AC (source_multi) + Section AE (registry)

### Phase 4: Reactor — Fixed Conversion (v8.4.0)

**What changes**:
1. reactor_adiabatic unit with Mode A
2. SVG icons
3. Property panel

**Tests added**: Section AD (reactor E2E)

### Phase 5: Reactor — K(T) Equilibrium-Lite (v8.5.0)

**What changes**: Mode B logic, bisection solver, alpha parameter

**Tests added**: Section AF

### Phase 6: UI Polish (v8.6.0)

**What changes**: Reaction selector, mode toggle, registry viewer

### Version Bump to v9.0.0

After Phase 5 or 6: reactor operational → v9.0.0, export version 10.

---

## 12. Risk Assessment

### 12.1 Absolute Hdot Values Change (Phase 2)

When hf0 is added to hMolar, absolute Hdot_J_s values shift. Harmless: energy
balance checks use differences that cancel for same-composition streams.

### 12.2 PH Flash Convergence for Reactor (Phase 4)

Formation shift is constant → monotonicity preserved. Bracket [1, 6000] K
sufficient for H₂ combustion (adiabatic flame T ≈ 3000–4000 K).

### 12.3 Save File Compatibility (NNG-C1)

New defIds don't appear in old saves. Export version bumped at v9.

---

## 13. Design Decisions Log

| # | Decision | Rationale |
|---|----------|-----------|
| D1 | Shift in ThermoAdapter.hMolar(), not package | Package-independent |
| D2 | chemShift = 0 for species without hf0 | Backward compatible |
| D3 | Single inlet/outlet reactor | Simplest, mixer handles upstream |
| D4 | T_eval = T_in for K(T) | No iteration in tick |
| D5 | phaseConstraint = 'V' default | Gas-phase K/Q valid |
| D6 | Bisection for ξ_eq | Robust, guaranteed convergence |
| D7 | Registration-time validation | NNG-D2 mandates |
| D8 | hf0/s0 for ALL 8 species | Strong consistent data model |
| D9 | Separate phase for data enrichment | Careful testing isolation |
| D10 | Cpig form change deferred | Orthogonal, massive impact |
| D11 | source_multi with air default | Practical, minimal complexity |
| D12 | v8.x during implementation | Iterative, tests never broken |
| D13 | Activation window: inlet T/P only | Outlet unknown before reaction |
| D14 | Export version bump at v9 | Only when behavior truly changes |

---

## 14. Deferred Work

### 14.1 Cpig Polynomial Form (Shomate Migration)

Current: `Cp = A + BT + CT² + DT³ + ET⁴`. NIST Shomate: different form with `t=T/1000`.
Impact: changes every enthalpy value, all test tolerances. Own major version.

### 14.2 Multi-Reaction Equilibrium

Multiple simultaneous reactions, Gibbs minimization. Significant complexity.

### 14.3 Kinetic Reactor

Rate laws, residence time. Requires time dimension.

### 14.4 Non-Ideal Phase Equilibrium

Fugacity coefficients for VL. Requires PR departures.

### 14.5 Reaction Registry Expansion

Sabatier, methane combustion, water-gas shift, electrolysis, etc.

---

## 15. File Placement Guide

All code in `processThis.html`, script block 1 (core logic).

| Component | Location | After | Before |
|-----------|----------|-------|--------|
| hf0/s0 fields in register() | ✅ Done | rhoLiq | Safety fields |
| hf0/s0 data on species | ✅ Done | In each register() call | — |
| ReactionRegistry class | Phase 3 | ComponentRegistry registrations | ModelRegistry |
| R_H2_COMB registration | Phase 3 | ReactionRegistry class | ModelRegistry |
| ThermoAdapter._chemShiftCache | Phase 2 | constructor | hMolar() |
| ThermoAdapter._getChemShift() | Phase 2 | _chemShiftCache | hMolar() |
| ThermoAdapter.hMolar() mod | Phase 2 | cpMolar() | computeStreamEnthalpy() |
| source_multi registration | Phase 3 | source registration | sink registration |
| reactor_adiabatic registration | Phase 4 | After all units | Before Scene class |
| Tests (Sections AA–AF) | Progressive | After last test section | RUNNER |
| PG.ReactionRegistry | Phase 3 | PG.UnitRegistry | end of PG object |

---

*End of design document v2.1. Phase 1 complete. Phase 2 next.*
