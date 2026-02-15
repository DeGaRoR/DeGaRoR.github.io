# processThis — Reaction System Design Document

**Version**: 2.3 — Phase 3 Complete  
**Author**: Design Authority  
**Date**: 2026-02-15  
**Baseline codebase**: processThis v8.3.0  
**Status**: APPROVED — Phases 1–3 implemented, Phases 4–6 pending

---

## Implementation Status

| Phase | Version | Description | Status | Tests |
|-------|---------|-------------|--------|-------|
| 1 | v8.1.0 | Component data enrichment (hf0, s0) | ✅ DONE | 110 (769 checks) |
| 2 | v8.2.0 | Formation enthalpy shift in ThermoAdapter | ✅ DONE | 113 (787 checks) |
| 3 | v8.3.0 | ReactionRegistry + Source (Mix) | ✅ DONE | 118 (824 checks) |
| 4 | v8.4.0 | Reactor — Fixed Conversion | ⬜ NEXT | — |
| 5 | v8.5.0 | Reactor — K(T) Equilibrium-Lite | ⬜ | — |
| 6 | v8.6.0 | UI Polish | ⬜ | — |
| — | v9.0.0 | Version bump (reactor operational) | ⬜ | — |

### Phase 1 Notes (v8.1.0)

- All 8 species populated with hf0_Jmol and s0_JmolK from NIST
- Test 110 (Section AA): 46 checks

### Phase 2 Notes (v8.2.0)

- chemShift in ThermoAdapter.hMolar(). Cache + invalidation on setPackage().
- §2.3 zero-impact proof validated: all 110 pre-existing tests unchanged.
- Tests 111–113 (Section AB): alignment, regression, ΔH°_rxn

### Phase 3 Notes (v8.3.0)

- ReactionRegistry class: static, NNG-A5 pattern, 7-point registration validation
- R_H2_COMB registered: 2H₂ + O₂ → 2H₂O, T∈[400,3000]K, P∈[0.5,50]bar
- source_multi unit: default dry air (N2:0.78, O2:0.21, Ar:0.01), validates species
- PG.ReactionRegistry exported
- Tests 114–115 (Section AC): source_multi air default + custom H2/O2
- Tests 116–118 (Section AE): registry retrieval, bad reaction rejection (7 cases), mass balance
- Zero deviations from design. ReactionRegistry frozen objects prevent mutation.

### Headless Test Runner

```bash
node run_tests.js && node _test_core.js
```

---

## Document Purpose

**Single authoritative reference** for the reaction system implementation.
Supersedes all prior versions (v1, v2.0, v2.1, v2.2).

---

## Table of Contents

0. Executive Summary
1. Scope and Constraints
2. Formation Enthalpy Shift
3. Component Data Enrichment
4. ReactionRegistry
5. Multi-Component Source Unit
6. Reactor Unit
7. STREAM_CONTRACTS Impact
8. Mass and Energy Balance Verification
9. UI Integration
10. Test Plan
11. Implementation Phases
12. Risk Assessment
13. Design Decisions Log
14. Deferred Work
15. File Placement Guide

---

## 0. Executive Summary

Add chemical reaction capability to processThis via:

1. **Formation enthalpy shift** in ThermoAdapter.hMolar() ✅ (v8.2.0)
2. **Component data enrichment** — hf0/s0 for all 8 species ✅ (v8.1.0)
3. **ReactionRegistry** — validated reaction definitions ✅ (v8.3.0)
4. **Multi-component source** — composition mix, default air ✅ (v8.3.0)
5. **Adiabatic reactor** — fixed conversion (Phase 4), K(T) (Phase 5)

Versioning: v8.x.y during implementation. v9 when reactor operational.

---

## 1. Scope and Constraints

### 1.1 In Scope

- ComponentRegistry: hf0/s0 for all 8 species ✅
- ThermoAdapter: formation enthalpy shift ✅
- ReactionRegistry ✅
- source_multi unit ✅
- Reactor unit: adiabatic, fixed conversion + K(T) equilibrium-lite
- First reaction: 2 H₂ + O₂ → 2 H₂O ✅
- UI: reactor in palette, property panel, registry viewer

### 1.2 Out of Scope

Multi-reaction equilibrium, fugacity models, true adiabatic equilibrium,
kinetics, liquid-phase reactions, Cpig Shomate migration, exhaustive reactions.

### 1.3 Governing NNG

NNG-L1 (mass), NNG-L2 (energy), NNG-A1 (single file), NNG-A2 (DOM-free core),
NNG-A5 (registry pattern), NNG-U1 (SI), NNG-U2 (UnitRegistry), NNG-U3/U4 (thermo
via adapter), NNG-D1/D2/D3 (data validation), NNG-T1/T2/T3 (tests), NNG-V1/V2.

---

## 2. Formation Enthalpy Shift ✅ (v8.2.0)

chemShift(comp) = hf0 − h_phys(298.15K, 1e5Pa, 'V'). Applied in ThermoAdapter.hMolar().
Zero-impact on non-reactive flowsheets (§2.3 proof validated). Cache invalidated
on setPackage().

---

## 3. Component Data ✅ (v8.1.0)

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

Cpig Shomate migration deferred (§14).

---

## 4. ReactionRegistry ✅ (v8.3.0)

### 4.1 As Built

Static class, NNG-A5 pattern. Registration validates: uniqueness, species existence,
hf0 completeness, stoichiometric structure, mass balance < 0.01 g/mol, window
validity, entropy completeness (warning). Registered objects frozen (immutable).

API: `register(id, spec)`, `get(id)`, `exists(id)`, `all()`, `list()`, `validateAll()`.
Exported on PG.

### 4.2 First Reaction

```javascript
ReactionRegistry.register('R_H2_COMB', {
    name: 'Hydrogen Combustion',
    equation: '2 H₂ + O₂ → 2 H₂O',
    stoich: { H2: -2, O2: -1, H2O: 2 },
    reversible: true,
    Tmin_K: 400, Tmax_K: 3000,
    Pmin_Pa: 50000, Pmax_Pa: 5000000
});
```

Mass balance: −0.001 g/mol ✓

---

## 5. Multi-Component Source ✅ (v8.3.0)

### As Built

defId `'source_multi'`, category SOURCE, 2×2, port `out` (MATERIAL, OUT).
Default: dry air {N2:0.78, O2:0.21, Ar:0.01}. Validates species, clamps T∈[1,5000].
Emits TP-specified material stream.

---

## 6. Reactor Unit

### 6.1 Identity

defId `'reactor_adiabatic'`, category REACTOR, size 2×2.
Ports: `mat_in` (IN, x:0,y:1), `mat_out` (OUT, x:2,y:1).

### 6.2 Parameters

`reactionId` (string), `mode` ('fixed'/'equilibrium'), `conversion` (0–1),
`alpha` (0–1), `P_out` (optional Pa), `T_eval_override` (optional K).

### 6.3 Mode A — Fixed Conversion (Phase 4)

```
GUARDS: no input → return; no reaction → error

1. Activation window (inlet T/P only):
   Outside → pass-through TP spec, status 'inactive'

2. ξ_max = min over reactants of (n_in[i] / |νᵢ|)
   If ξ_max ≤ 0 → pass-through, status 'no_reactants'

3. ξ = clamp(conversion, 0, 1) × ξ_max

4. n_out[i] = n_in[i] + νᵢ × ξ
   Clamp negatives to 0, preserve inerts, remove zero entries

5. H_in = thermo.getHdot_Jps(sIn)

6. Emit PH-flash: { P, n: n_out, H_target_Jps: H_in, phaseConstraint }

7. Diagnostics on u.last
```

Architecture: no direct flash (NNG-U3/U4), PH-flash solved by solver (NNG-S1),
all thermo via adapter, mass by stoichiometry, energy by H_target = H_in.

### 6.4 Mode B — K(T) Equilibrium-Lite (Phase 5)

Steps 1–2 same. Then ln K = −ΔH°/(R·T_eval) + ΔS°/R.
Bisection for ξ_eq where ln Q = ln K. ξ = alpha × ξ_eq.
T_eval = T_in (not rigorous coupled solve).

### 6.5 Phase Handling

Gas-phase ideal activities. phaseConstraint='V' default.

---

## 7. STREAM_CONTRACTS

No changes. Reactor emits standard PH-flash or TP specs.

---

## 8. Mass and Energy Balance

Mass: Σ νᵢ×MW_i = 0 at registration. Energy: H_target = H_in (adiabatic).

---

## 9. UI Integration

Last phase. Reactor icon, property panel, registry viewer.

---

## 10. Test Plan

### Section AA ✅ — Component Data (Test 110, 46 checks)
### Section AB ✅ — Formation Shift (Tests 111–113, 18 checks)
### Section AC ✅ — Source (Mix) (Tests 114–115)

**Test 114**: Air default — 3 species, flows, T, P, total ≈ 1 mol/s (7 checks)
**Test 115**: Custom H2/O2 at 800K — flows, no N2, T, P, phase (6 checks)

### Section AE ✅ — ReactionRegistry (Tests 116–118)

**Test 116**: Valid registration — exists, get, fields, all, list, validateAll (14 checks)
**Test 117**: Bad reactions — 7 rejection cases (unknown species, mass imbalance,
no reactants, no products, bad T/P windows, duplicate ID) (7 checks)
**Test 118**: Mass balance — stored value, independent calc, consistency (3 checks)

### Section AD — Reactor Fixed Conversion (Phase 4) ← NEXT

**Test 119**: Full conversion + adiabatic closure
- source_multi(H2:2, O2:1, T=800K, P=1e5, V) → Reactor(R_H2_COMB, fixed, conv=1.0) → Sink
- n_out: H2 ≈ 0, O2 ≈ 0, H2O ≈ 2
- T_out > 800K (exothermic)
- |H_out − H_in| < 100 W, mass_in ≈ mass_out

**Test 120**: Partial conversion (25%)
- Same feed, conversion = 0.25
- n_out: H2 ≈ 1.5, O2 ≈ 0.75, H2O ≈ 0.5
- T_out between T_in and full conversion T

**Test 121**: Limiting reactant
- source_multi(H2:2, O2:0.2) → conv=1.0
- ξ_max = 0.2 (O2 limited), H2 ≈ 1.6, H2O ≈ 0.4, no negatives

**Test 122**: Inactive — T below window
- T=300K < Tmin=400K → pass-through, status 'inactive'

**Test 123**: Inert pass-through
- source_multi(H2:2, O2:1, N2:5) → conv=1.0
- N2=5 unchanged, H2/O2 consumed, H2O produced

### Section AF — Reactor K(T) Mode (Phase 5)

**Test 124**: K(T) strongly favors products (ξ_eq/ξ_max > 0.999)
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
### Phase 2 ✅ v8.2.0 — Formation Shift
### Phase 3 ✅ v8.3.0 — ReactionRegistry + Source (Mix)

### Phase 4: Reactor — Fixed Conversion (v8.4.0) ← NEXT

1. Register `reactor_adiabatic` unit with Mode A tick logic
2. SVG icons for reactor and source_multi
3. Property panel support
4. Tests: Section AD (Tests 119–123)

Risk: MEDIUM — first unit changing composition. Verify mass/energy carefully.

### Phase 5: Reactor — K(T) Equilibrium-Lite (v8.5.0)

Mode B logic, bisection, alpha. Tests: Section AF.

### Phase 6: UI Polish (v8.6.0)

Reaction selector, mode toggle, registry viewer.

### v9.0.0: reactor operational, export version 10.

---

## 12. Risk Assessment

- **Absolute Hdot shift** ✅ Confirmed harmless (Phase 2)
- **PH flash convergence** (Phase 4): Shift constant, monotonicity OK.
  Bracket [1, 6000]K covers adiabatic flame T. May need widening check.
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
| D9 | Separate phases for isolation | Testing safety |
| D10 | Cpig deferred | Orthogonal, high impact |
| D11 | source_multi with air default | Practical, minimal |
| D12 | v8.x during implementation | Iterative safety |
| D13 | Activation window: inlet only | Outlet unknown |
| D14 | Export version bump at v9 | Behavioral change trigger |
| D15 | Frozen reaction objects | Prevent runtime mutation |

---

## 14. Deferred Work

- **14.1** Cpig Shomate migration (own major version)
- **14.2** Multi-reaction equilibrium
- **14.3** Kinetic reactor
- **14.4** Non-ideal VL equilibrium
- **14.5** Reaction registry expansion

---

## 15. File Placement Guide

| Component | Status | Location in processThis.html |
|-----------|--------|------------------------------|
| hf0/s0 fields + data | ✅ | ComponentRegistry register() calls |
| ThermoAdapter shift | ✅ | _chemShiftCache, _getChemShift(), hMolar() |
| ReactionRegistry class | ✅ | After ComponentRegistry, before ModelRegistry (~L1842) |
| R_H2_COMB | ✅ | After ReactionRegistry class |
| source_multi | ✅ | After source, before sink (~L4961) |
| PG.ReactionRegistry | ✅ | In PG export object |
| reactor_adiabatic | Phase 4 | After all units, before Scene |
| Tests AA–AE | ✅ | Before RUNNER |
| Tests AD, AF | Phase 4, 5 | Before RUNNER |

---

*End of design document v2.3. Phases 1–3 complete. Phase 4 next.*
