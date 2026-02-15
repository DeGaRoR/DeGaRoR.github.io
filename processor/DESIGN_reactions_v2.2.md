# processThis — Reaction System Design Document

**Version**: 2.2 — Phase 2 Complete  
**Author**: Design Authority  
**Date**: 2026-02-15  
**Baseline codebase**: processThis v8.2.0  
**Status**: APPROVED — Phases 1–2 implemented, Phases 3–6 pending

---

## Implementation Status

| Phase | Version | Description | Status | Tests |
|-------|---------|-------------|--------|-------|
| 1 | v8.1.0 | Component data enrichment (hf0, s0) | ✅ DONE | 110 (769 checks) |
| 2 | v8.2.0 | Formation enthalpy shift in ThermoAdapter | ✅ DONE | 113 (787 checks) |
| 3 | v8.3.0 | ReactionRegistry + Source (Mix) | ⬜ NEXT | — |
| 4 | v8.4.0 | Reactor — Fixed Conversion | ⬜ | — |
| 5 | v8.5.0 | Reactor — K(T) Equilibrium-Lite | ⬜ | — |
| 6 | v8.6.0 | UI Polish | ⬜ | — |
| — | v9.0.0 | Version bump (reactor operational) | ⬜ | — |

### Phase 1 Implementation Notes (v8.1.0)

- All 8 species populated with `hf0_Jmol` and `s0_JmolK` from NIST Chemistry WebBook
- Fields added to `register()`, `getPropertyNames()`, `validate()` (warnings)
- Test 110 (Section AA): 46 checks — data presence, types, NIST spot-checks
- Zero deviations from design

### Phase 2 Implementation Notes (v8.2.0)

- `_chemShiftCache` added to ThermoAdapter constructor
- `_getChemShift(comp)` method added — computes and caches `hf0 − h_phys(298.15K, 1e5, 'V')`
- `hMolar()` modified: returns `h_phys + chemShift` (one-line change)
- Cache invalidated in `setPackage()`
- §2.3 zero-impact proof **validated**: all 110 pre-existing tests pass with identical values
- Test 111: Standard-state alignment — all 8 species hMolar@298.15K match hf0 (±500 J/mol)
- Test 112: Water Throttling Flash regression — exact mirror of Test 1, all assertions identical
- Test 113: ΔH°_rxn for H₂ combustion = −483652 J/mol-rxn (±2000) ✓
- Zero deviations from design

### Headless Test Runner

```bash
node run_tests.js && node _test_core.js
```

Extracts all 4 script blocks, wraps block 2 (UI) in try/catch for DOM mocks.

---

## Document Purpose

This is the **single authoritative reference** for the reaction system implementation.
It captures every design decision, architectural constraint, implementation phase,
and test expectation. Work may span multiple sessions — this document is the
continuity anchor. Any implementation must conform to this document. Any deviation
requires updating this document first.

**Supersedes**: All prior versions (v1, v2.0, v2.1).

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
   naturally from composition change. ✅ DONE (v8.2.0). Proven zero-impact on
   non-reactive flowsheets (§2.3 validated with all 110 pre-existing tests).
2. **Component data enrichment** — `hf0_Jmol` and `s0_JmolK` for ALL 8 species.
   ✅ DONE (v8.1.0).
3. **ReactionRegistry** — validates reactions at registration time. By-design
   elimination of runtime errors.
4. **Multi-component source** — emits a user-defined composition mix. Default: air.
5. **Adiabatic reactor unit** — fixed conversion (Phase 4), then K(T) equilibrium-lite
   (Phase 5). Follows established tick → PH-flash → solver pattern.

**Versioning**: v8.x.y during implementation. Bump to v9 when reactor operational.

---

## 1. Scope and Constraints

### 1.1 In Scope

- ComponentRegistry: `hf0_Jmol` and `s0_JmolK` for ALL 8 species ✅
- ThermoAdapter: formation enthalpy shift in `hMolar()` ✅
- ReactionRegistry: new static registry class
- Multi-component source unit (`source_multi`)
- Reactor unit: adiabatic, fixed conversion + K(T) equilibrium-lite
- First reaction: 2 H₂ + O₂ → 2 H₂O
- UI: reactor in palette, property panel, reaction registry viewer
- Comprehensive tests at every layer

### 1.2 Explicitly Out of Scope

- Multi-reaction equilibrium, fugacity/activity models
- True adiabatic equilibrium (coupled ξ–T solve)
- Kinetics, liquid-phase reactions
- Cpig polynomial form change (Shomate — see §14)
- Exhaustive reaction registry population

### 1.3 Governing NNG

| NNG | Relevance |
|-----|-----------|
| NNG-L1 | Mass: reactor conserves total mass by stoichiometric design |
| NNG-L2 | Energy: formation shifts ensure ΔH_rxn captured in enthalpy |
| NNG-A1 | Single-file HTML |
| NNG-A2 | DOM-free core |
| NNG-A5 | Registry pattern for ReactionRegistry |
| NNG-U1 | SI units internally |
| NNG-U2 | Reactor via UnitRegistry.register() |
| NNG-U3 | All thermo through ThermoAdapter |
| NNG-U4 | No direct package calls from units |
| NNG-D1 | Species must exist in ComponentRegistry |
| NNG-D2 | Reaction species: hf0 required, mass-balanced at registration |
| NNG-D3 | Reactor cannot produce unregistered species |
| NNG-T1 | All existing tests pass after every change |
| NNG-T2 | New features include tests |
| NNG-T3 | Deterministic tests |
| NNG-V1/V2 | Version + changelog |

---

## 2. Formation Enthalpy Shift ✅ DONE (v8.2.0)

### 2.1 Problem

Current physical enthalpy uses per-component reference h_L(298.15K) = 0.
ΔH across composition changes doesn't capture reaction heat.

### 2.2 Solution

```
chemShift(comp) = hf0_Jmol(comp) − h_phys(comp, 298.15K, 1e5 Pa, 'V')
h_total(comp, T, P, phase) = h_phys(comp, T, P, phase) + chemShift(comp)
```

At standard state: h_total = hf0. For species without hf0: chemShift = 0.

### 2.3 Zero-Impact Proof

For any unit with n_out = n_in (same composition), chemShift cancels in
all enthalpy differences and PH-flash targets. All existing tests pass
by mathematical necessity. **Validated**: 110/110 pre-existing tests unchanged.

### 2.4 Implementation (as built)

In `ThermoAdapter`:

```javascript
constructor(pkg) {
    ...
    this._chemShiftCache = {};
}

hMolar(comp, T_K, P_Pa, phaseHint = null) {
    return this._pkg.hMolar(comp, T_K, P_Pa, phaseHint) + this._getChemShift(comp);
}

_getChemShift(comp) {
    if (this._chemShiftCache[comp] !== undefined) return this._chemShiftCache[comp];
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

setPackage(pkg) {
    ...
    this._chemShiftCache = {};  // invalidate on package switch
    ...
}
```

No changes to `computeStreamEnthalpy()`, `getHdot_Jps()`, `phFlash()` — they
call `hMolar()` which now returns shifted values transparently.

---

## 3. Component Data Enrichment ✅ DONE (v8.1.0)

### 3.1 New Fields

```javascript
hf0_Jmol: spec.hf0_Jmol ?? null,   // J/mol, gas, 298.15 K, 1 bar
s0_JmolK: spec.s0_JmolK ?? null,   // J/(mol·K), gas, 298.15 K, 1 bar
```

### 3.2 Data (NIST Chemistry WebBook)

| Species | hf0_Jmol | s0_JmolK | Notes |
|---------|----------|----------|-------|
| H₂O | −241826 | 188.835 | Gas-phase ΔfH° |
| O₂ | 0 | 205.152 | Element |
| H₂ | 0 | 130.680 | Element |
| N₂ | 0 | 191.609 | Element |
| Ar | 0 | 154.845 | Element |
| CH₄ | −74870 | 186.251 | Gas-phase ΔfH° |
| He | 0 | 126.153 | Element |
| CO₂ | −393510 | 213.785 | Gas-phase ΔfH° |

### 3.3 Cpig Note

Current Cp polynomials are adapted fits, not native Shomate. Migration deferred (§14).

---

## 4. ReactionRegistry

### 4.1 Pattern

Static class following NNG-A5. `register()`, `get()`, `all()`, `exists()`.

### 4.2 Schema

```javascript
{
    id: String, name: String, equation: String,
    stoich: { compId: νᵢ },  // negative=reactant, positive=product
    reversible: Boolean,
    Tmin_K: Number, Tmax_K: Number, Pmin_Pa: Number, Pmax_Pa: Number,
    notes: String, references: Array
}
```

### 4.3 Registration-Time Validation (NNG-D2)

1. ID uniqueness → throw
2. Species exist in ComponentRegistry → throw
3. All species have hf0_Jmol → throw
4. At least one reactant and one product → throw
5. |Σ νᵢ × MW_i| < 0.01 → throw
6. Tmin < Tmax, Pmin < Pmax → throw
7. Entropy completeness → warning if reversible but missing s0

### 4.4 First Reaction

```javascript
ReactionRegistry.register('R_H2_COMB', {
    name: 'Hydrogen Combustion',
    equation: '2 H₂ + O₂ → 2 H₂O',
    stoich: { H2: -2, O2: -1, H2O: 2 },
    reversible: true,
    Tmin_K: 400, Tmax_K: 3000,
    Pmin_Pa: 50000, Pmax_Pa: 5000000,
    notes: 'Strongly exothermic. K >> 1 at all practical temperatures.',
    references: [{ source: 'NIST', detail: 'NIST Chemistry WebBook' }]
});
```

Mass balance: 2×(−2.016) + 1×(−31.999) + 2×(18.015) = −0.001 ✓

---

## 5. Multi-Component Source Unit

| Field | Value |
|-------|-------|
| defId | `'source_multi'` |
| name | `'Source (Mix)'` |
| category | SOURCE |
| size | 2×2 |

**Port**: `out` (MATERIAL, OUT)

**Parameters**: `n` (Object, default dry air: {N2:0.78, O2:0.21, Ar:0.01}),
`T` (K, 298.15), `P` (Pa, 101325), `phaseConstraint` ('V')

**Tick**: Validate species, clamp T, emit TP-specified material stream.

---

## 6. Reactor Unit

### 6.1 Identity

defId `'reactor_adiabatic'`, category REACTOR, size 2×2.
Ports: `mat_in` (IN), `mat_out` (OUT).

### 6.2 Parameters

`reactionId`, `mode` ('fixed'/'equilibrium'), `conversion` (0–1),
`alpha` (0–1), `P_out` (optional), `T_eval_override` (optional).

### 6.3 Mode A — Fixed Conversion

1. Activation window check (inlet T/P) → inactive pass-through if outside
2. ξ_max = min(n_in[i] / |νᵢ|) over reactants
3. ξ = conversion × ξ_max
4. n_out = n_in + ν×ξ (clamp negatives, preserve inerts)
5. H_in = thermo.getHdot_Jps(sIn)
6. Emit PH-flash: {P, n_out, H_target_Jps: H_in} (adiabatic)

### 6.4 Mode B — K(T) Equilibrium-Lite

1–2 same. Then: ln K = −ΔH°/(R·T_eval) + ΔS°/R.
Bisection for ξ_eq where ln Q = ln K. ξ = alpha × ξ_eq.
T_eval = T_in (not rigorous coupled solve — documented limitation).

### 6.5 Phase Handling

Gas-phase ideal activities only. phaseConstraint='V' default.

---

## 7. STREAM_CONTRACTS Impact

No changes. Reactor emits standard PH-flash or TP specs.

---

## 8. Mass and Energy Balance Verification

**Mass**: Σ νᵢ×MW_i = 0 enforced at registration. mass_out = mass_in by construction.
**Energy**: H_target = H_in (adiabatic). Solver guarantees H_out = H_target.

---

## 9. UI Integration

Last phase. Reactor icon, property panel, reaction registry viewer.

---

## 10. Test Plan

### Section AA: Component Data ✅ DONE

**Test 110**: All 8 species have finite hf0/s0, NIST spot-checks, no warnings. (46 checks)

### Section AB: Formation Shift ✅ DONE

**Test 111**: Standard-state alignment — 8 species hMolar@298.15K ≈ hf0 (±500).
Plus sanity: H2O@500K > H2O@298K and still negative. (10 checks)

**Test 112**: Non-reactive regression — exact mirror of Test 1 (Water Throttling
Flash). T, beta, nV, nL, phase, ΔH all match. (6 checks)

**Test 113**: ΔH°_rxn for H₂ combustion ≈ −483652 J/mol (±2000). Exothermic. (2 checks)

### Section AC: Multi-Component Source (Phase 3)

**Test 114**: Air source (3 species, valid flash)
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

**Test 124**: K(T) strongly favors products
**Test 125**: Alpha scaling
**Test 126**: T_eval override

### Reference Values

```
ΔH°_298 = −483652 J/mol-rxn
ΔS°_298 = −88.842 J/(mol·K)
ln K(800) ≈ 62.0
```

---

## 11. Implementation Phases

### Phase 1 ✅ v8.1.0 — Component Data

Added hf0/s0 for all 8 species. Test 110. 769 checks, 0 fail.

### Phase 2 ✅ v8.2.0 — Formation Shift

chemShift in ThermoAdapter.hMolar(). Tests 111–113. 787 checks, 0 fail.
All 110 pre-existing tests pass unchanged (§2.3 validated).

### Phase 3: ReactionRegistry + Source (Mix) (v8.3.0) ← NEXT

1. ReactionRegistry class (after ComponentRegistry, before ModelRegistry)
2. Register R_H2_COMB
3. source_multi unit (after source, before sink)
4. Export ReactionRegistry on PG

Tests: Sections AC + AE

### Phase 4: Reactor — Fixed Conversion (v8.4.0)

reactor_adiabatic with Mode A. SVG icons. Property panel.
Tests: Section AD

### Phase 5: Reactor — K(T) Equilibrium-Lite (v8.5.0)

Mode B, bisection, alpha. Tests: Section AF

### Phase 6: UI Polish (v8.6.0)

Reaction selector, mode toggle, registry viewer. Manual testing.

### v9.0.0: reactor operational, export version 10.

---

## 12. Risk Assessment

- **Absolute Hdot shift** (Phase 2): ✅ Confirmed harmless — differences cancel.
- **PH flash convergence** (Phase 4): Shift is constant, monotonicity preserved.
  Bracket [1, 6000]K covers adiabatic flame T.
- **Save compatibility**: New defIds additive. Export bump at v9.

---

## 13. Design Decisions Log

| # | Decision | Rationale |
|---|----------|-----------|
| D1 | Shift in ThermoAdapter, not package | Package-independent |
| D2 | chemShift = 0 without hf0 | Backward compatible |
| D3 | Single inlet/outlet reactor | Mixer handles upstream |
| D4 | T_eval = T_in for K(T) | No iteration in tick |
| D5 | phaseConstraint = 'V' default | Gas-phase K/Q valid |
| D6 | Bisection for ξ_eq | Robust convergence |
| D7 | Registration-time validation | NNG-D2 |
| D8 | hf0/s0 for ALL 8 species | Consistent data model |
| D9 | Separate phase for data enrichment | Testing isolation |
| D10 | Cpig form change deferred | Orthogonal, high impact |
| D11 | source_multi with air default | Practical, minimal |
| D12 | v8.x during implementation | Iterative safety |
| D13 | Activation window: inlet only | Outlet unknown |
| D14 | Export version bump at v9 | Behavioral change trigger |

---

## 14. Deferred Work

### 14.1 Cpig Polynomial Form (Shomate Migration)

Own major version. Changes all enthalpy values and test tolerances.
Formation shift independent of Cp form.

### 14.2–14.5

Multi-reaction equilibrium, kinetics, non-ideal VL, registry expansion.

---

## 15. File Placement Guide

| Component | Status | Location |
|-----------|--------|----------|
| hf0/s0 fields + data | ✅ | ComponentRegistry register() calls |
| ThermoAdapter shift | ✅ | _chemShiftCache, _getChemShift(), hMolar() |
| ReactionRegistry | Phase 3 | After ComponentRegistry, before ModelRegistry |
| R_H2_COMB | Phase 3 | After ReactionRegistry class |
| source_multi | Phase 3 | After source, before sink |
| reactor_adiabatic | Phase 4 | After all units, before Scene |
| Tests AA–AF | Progressive | Before RUNNER |
| PG.ReactionRegistry | Phase 3 | In PG export object |

---

*End of design document v2.2. Phases 1–2 complete. Phase 3 next.*
