# processThis — Reaction System Design Document

**Version**: 2.5 — Phase 5 Complete  
**Author**: Design Authority  
**Date**: 2026-02-15  
**Baseline codebase**: processThis v8.5.0  
**Status**: APPROVED — Phases 1–5 implemented, Phase 6 (UI polish) pending

---

## Implementation Status

| Phase | Version | Description | Status | Tests |
|-------|---------|-------------|--------|-------|
| 1 | v8.1.0 | Component data enrichment (hf0, s0) | ✅ DONE | 110 (769 checks) |
| 2 | v8.2.0 | Formation enthalpy shift in ThermoAdapter | ✅ DONE | 113 (787 checks) |
| 3 | v8.3.0 | ReactionRegistry + Source (Mix) | ✅ DONE | 118 (824 checks) |
| 4 | v8.4.0 | Reactor — Fixed Conversion | ✅ DONE | 123 (860 checks) |
| 5 | v8.5.0 | Reactor — K(T) Equilibrium-Lite | ✅ DONE | 126 (878 checks) |
| 6 | v8.6.0 | UI Polish | ⬜ NEXT | — |
| — | v9.0.0 | Version bump (reactor operational) | ⬜ | — |

### Phase 5 Implementation Notes (v8.5.0)

- Mode B (`mode: 'equilibrium'`) added to reactor_adiabatic tick
- van 't Hoff: `ln K = -ΔH°/(R·T_eval) + ΔS°/R` using NIST standard data
- Bisection solver (60 iterations max) finds ξ_eq where ln Q(ξ) = ln K
- Activity model: ideal gas, `Q = Π(yᵢ·P/P_std)^νᵢ`
- Alpha parameter: `ξ = alpha × ξ_eq` (approach to equilibrium, 0–1)
- T_eval = T_in by default, `T_eval_override` for advanced use
- Edge cases handled: K so large ξ_eq → ξ_max; K so small ξ_eq → 0
- Guard: missing s0_JmolK → error + pass-through (not silent failure)
- Diagnostics on u.last: ln_K, xi_eq, alpha, T_eval, dH0, dS0
- Demo scene updated: H₂/Air feed → Combustor (equilibrium, alpha=1.0) → Flue Gas
- Grid expanded to 24×22 to accommodate reactor process at y=16

**Tests 124–126** (Section AF):
- 124: Products strongly favored at 800K — ln_K > 50, ξ_eq/ξ_max > 0.999, near-complete conversion, ΔH < 200W
- 125: Alpha scaling (0.5) — ξ = 0.5×ξ_eq, intermediate composition, mass+energy balance
- 126: T_eval override (500K) — T_eval used, ln_K > 100, ΔH adiabatic

Zero deviations from design.

### Previous Phase Notes

- **Phase 1** (v8.1.0): hf0/s0 for all 8 species
- **Phase 2** (v8.2.0): chemShift in hMolar(), §2.3 validated
- **Phase 3** (v8.3.0): ReactionRegistry + source_multi + R_H2_COMB
- **Phase 4** (v8.4.0): reactor_adiabatic Mode A (fixed conversion)

### Headless Test Runner

```bash
cd /home/claude && node run_tests.js && node _test_core.js
```

---

## Document Purpose

**Single authoritative reference** for the reaction system.
Supersedes all prior versions. Continuity anchor for cross-session work.

---

## 0. Executive Summary

Chemical reaction capability for processThis — **functionally complete**:

1. **Formation enthalpy shift** in ThermoAdapter.hMolar() ✅
2. **Component data** — hf0/s0 for all 8 species ✅
3. **ReactionRegistry** — validated reaction definitions ✅
4. **Multi-component source** — composition mix, default air ✅
5. **Adiabatic reactor — fixed conversion** ✅
6. **Adiabatic reactor — K(T) equilibrium-lite** ✅

Remaining: Phase 6 (UI polish) and version bump to v9.0.0.

---

## 1. Scope and Constraints

### In Scope — ALL FUNCTIONAL ITEMS COMPLETE

- ComponentRegistry: hf0/s0 ✅ | ThermoAdapter: formation shift ✅
- ReactionRegistry ✅ | source_multi ✅
- Reactor: fixed conversion ✅ | K(T) equilibrium ✅
- UI: icons, property panel, registry viewer (Phase 6)

### Out of Scope

Multi-reaction equilibrium, fugacity, coupled ξ–T solve, kinetics,
liquid-phase reactions, Cpig Shomate migration, exhaustive reactions.

### Governing NNG

NNG-L1/L2, NNG-A1/A2/A5, NNG-U1/U2/U3/U4, NNG-D1/D2/D3, NNG-T1/T2/T3, NNG-V1/V2.

---

## 2. Formation Enthalpy Shift ✅

chemShift = hf0 − h_phys(298.15K, 1e5, 'V'). In ThermoAdapter.hMolar().
Zero-impact on non-reactive flowsheets (§2.3 validated).

---

## 3. Component Data ✅

| Species | hf0_Jmol | s0_JmolK |
|---------|----------|----------|
| H₂O | −241826 | 188.835 |
| O₂ | 0 | 205.152 |
| H₂ | 0 | 130.680 |
| N₂ | 0 | 191.609 |
| Ar | 0 | 154.845 |
| CH₄ | −74870 | 186.251 |
| He | 0 | 126.153 |
| CO₂ | −393510 | 213.785 |

---

## 4. ReactionRegistry ✅

Static class, NNG-A5. 7-point registration validation. Frozen objects.
R_H2_COMB: 2H₂ + O₂ → 2H₂O, T∈[400,3000]K, P∈[0.5,50]bar.

---

## 5. Multi-Component Source ✅

`source_multi`: default dry air. Validates species.

---

## 6. Reactor Unit ✅

### 6.1 Identity

defId `'reactor_adiabatic'`, category REACTOR, size 2×3.
Ports: `mat_in` (IN, x:0,y:1), `mat_out` (OUT, x:2,y:1).

### 6.2 Parameters

| Param | Type | Default | Mode |
|-------|------|---------|------|
| reactionId | string | null | Both |
| mode | string | 'fixed' | — |
| conversion | number | 0 | A |
| alpha | number | 1.0 | B |
| P_out | number | sIn.P | Both |
| T_eval_override | number | null | B |

### 6.3 Mode A — Fixed Conversion ✅ (as built)

Guards → activation window → ξ_max → ξ = conversion × ξ_max →
n_out → H_in → PH-flash → diagnostics.

### 6.4 Mode B — K(T) Equilibrium-Lite ✅ (as built)

```
GUARDS + ACTIVATION + ξ_max: Same as Mode A

ENTROPY CHECK:
    All stoich species must have s0_JmolK → error if missing

THERMODYNAMIC EQUILIBRIUM:
    R = 8.314 J/(mol·K)
    ΔH° = Σ νᵢ × hf0_Jmol(i)
    ΔS° = Σ νᵢ × s0_JmolK(i)
    T_eval = T_eval_override ?? T_in
    ln K = −ΔH°/(R·T_eval) + ΔS°/R

BISECTION for ξ_eq:
    On [eps, ξ_max − eps] where eps = ξ_max × 1e-10
    Residual: ln Q(ξ) − ln K
    ln Q = Σ νᵢ × ln(yᵢ × P/P_std)
    Where yᵢ = n_i(ξ) / n_tot(ξ), P_std = 1e5
    60 iterations max, convergence tolerance = eps

    Edge cases:
    - f(lo) ≥ 0 → ξ_eq = 0 (reactants favored)
    - f(hi) ≤ 0 → ξ_eq = ξ_max (products overwhelmingly favored)

APPROACH TO EQUILIBRIUM:
    ξ = alpha × ξ_eq  (alpha ∈ [0, 1])

CLOSURE: Same as Mode A (PH-flash, adiabatic)
```

### 6.5 Diagnostics (u.last)

**Both modes**: reactionId, mode, xi, xi_max, status, H_in_kW

**Mode A additionally**: conversion

**Mode B additionally**: ln_K, xi_eq, alpha, T_eval, dH0, dS0

Access in tests: `t.ud(id).last`

### 6.6 PH-Flash Bracket Limitation

General bracket extends to [100, 3000]K. Undiluted H₂/O₂ exceeds this.
Use N₂ dilution. Documented as deferred item §14.6.

---

## 7–9. (Unchanged)

STREAM_CONTRACTS: no changes. Mass/Energy: by construction. UI: Phase 6.

---

## 10. Test Plan — ALL FUNCTIONAL TESTS COMPLETE

### Section AA ✅ — Component Data (Test 110, 46 checks)
### Section AB ✅ — Formation Shift (Tests 111–113, 18 checks)
### Section AC ✅ — Source (Mix) (Tests 114–115, 13 checks)

### Section AD ✅ — Reactor Fixed Conversion (Tests 119–123, 40 checks)

- 119: Full conversion + adiabatic closure (12 checks)
- 120: Partial conversion 25% (8 checks)
- 121: Limiting reactant (6 checks)
- 122: Inactive below T window (5 checks)
- 123: Inert pass-through (9 checks)

### Section AE ✅ — ReactionRegistry (Tests 116–118, 24 checks)

### Section AF ✅ — Reactor K(T) Mode (Tests 124–126)

**Test 124**: Products strongly favored at 800K (9 checks)
- ln_K > 50, ξ_eq/ξ_max > 0.999
- H2≈0, O2≈0, H2O≈2, ΔH adiabatic

**Test 125**: Alpha scaling (10 checks)
- alpha=0.5, ξ = 0.5×ξ_eq
- H2≈1.0, O2≈0.5, H2O≈1.0
- ΔH < 200W, mass balance

**Test 126**: T_eval override (4 checks)
- T_eval=500K, ln_K > 100, ΔH adiabatic

### Reference Values

```
ΔH°_298 = −483652 J/mol-rxn
ΔS°_298 = −88.842 J/(mol·K)
ln K(800) = 483652/(8.314×800) − 88.842/8.314 ≈ 72.7 − 10.7 ≈ 62.0
ln K(500) = 483652/(8.314×500) − 88.842/8.314 ≈ 116.3 − 10.7 ≈ 105.7
```

---

## 11. Implementation Phases

### Phase 1 ✅ v8.1.0 — Component Data (769 checks)
### Phase 2 ✅ v8.2.0 — Formation Shift (787 checks)
### Phase 3 ✅ v8.3.0 — ReactionRegistry + Source (824 checks)
### Phase 4 ✅ v8.4.0 — Reactor Fixed Conversion (860 checks)
### Phase 5 ✅ v8.5.0 — Reactor K(T) Equilibrium (878 checks)

### Phase 6: UI Polish (v8.6.0) ← NEXT

1. SVG icons for reactor_adiabatic and source_multi
2. Property panel: reaction selector dropdown, mode toggle, conversion/alpha sliders
3. Reaction Registry viewer in menu
4. Manual verification — no automated tests expected

### v9.0.0

After Phase 6: version bump, export version 10.

---

## 12. Risk Assessment

- **Absolute Hdot shift** ✅ Confirmed harmless
- **PH flash bracket** ⚠️ 3000K max. Use N₂ dilution. §14.6.
- **K(T) accuracy**: van 't Hoff with constant ΔH°/ΔS° is an approximation.
  True Cp-corrected ΔH°(T) deferred. Adequate for process simulation.
- **Save compatibility**: New defIds additive. Export bump at v9.

---

## 13. Design Decisions Log

| # | Decision | Rationale |
|---|----------|-----------|
| D1 | Shift in ThermoAdapter | Package-independent |
| D2 | chemShift = 0 without hf0 | Backward compatible |
| D3 | Single inlet/outlet reactor | Mixer handles upstream |
| D4 | T_eval = T_in for K(T) | No iteration in tick |
| D5 | phaseConstraint = 'V' default | Gas-phase K/Q valid |
| D6 | Bisection for ξ_eq | Robust convergence |
| D7 | Registration-time validation | NNG-D2 |
| D8 | hf0/s0 for ALL 8 species | Consistent data model |
| D9 | Separate phases | Testing isolation |
| D10 | Cpig deferred | Orthogonal, high impact |
| D11 | source_multi with air default | Practical, minimal |
| D12 | v8.x during implementation | Iterative safety |
| D13 | Activation window: inlet only | Outlet unknown |
| D14 | Export version bump at v9 | Behavioral change trigger |
| D15 | Frozen reaction objects | Prevent mutation |
| D16 | N₂ dilution in reactor tests | PH-flash bracket constraint |
| D17 | Diagnostics on u.last | Access via t.ud(id).last |
| D18 | Ideal gas activities for Q | Simplest, gas-phase only |
| D19 | 60-iteration bisection | 2^-60 ≈ 1e-18 precision |

---

## 14. Deferred Work

- **14.1** Cpig Shomate migration
- **14.2** Multi-reaction equilibrium
- **14.3** Kinetic reactor
- **14.4** Non-ideal VL equilibrium
- **14.5** Reaction registry expansion
- **14.6** PH-flash bracket widening
- **14.7** Cp-corrected ΔH°(T) for K(T) accuracy

---

## 15. File Placement Guide

| Component | Status |
|-----------|--------|
| hf0/s0 fields + data | ✅ |
| ThermoAdapter shift | ✅ |
| ReactionRegistry + R_H2_COMB | ✅ |
| source_multi | ✅ |
| reactor_adiabatic (Mode A + B) | ✅ |
| PG.ReactionRegistry | ✅ |
| Tests AA–AF | ✅ |
| Demo scene reactor | ✅ |
| UI icons/panels | Phase 6 |

---

## 16. Demo Scene

The demo process (loaded on startup) now includes:

**Construct C: H₂ Combustion Reactor**
- `src-rx` (source_multi): H2:2, O2:1, N2:8 at 800K, 2 bar, vapor
- `reactor` (reactor_adiabatic): R_H2_COMB, equilibrium mode, alpha=1.0
- `snk-rx` (sink): receives flue gas (H2O + N2, ~2000K)

This showcases: multi-component source → adiabatic reactor → high-temperature product.
Grid expanded to 24×22 to accommodate the new process at y=16.

---

*End of design document v2.5. Phases 1–5 complete. Phase 6 (UI polish) next.*
