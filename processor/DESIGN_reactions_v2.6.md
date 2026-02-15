# processThis — Reaction System Design Document

**Version**: 2.6 — ALL PHASES COMPLETE  
**Author**: Design Authority  
**Date**: 2026-02-15  
**Baseline codebase**: processThis v8.6.0  
**Status**: ✅ COMPLETE — Ready for v9.0.0 version bump

---

## Implementation Status

| Phase | Version | Description | Status | Tests |
|-------|---------|-------------|--------|-------|
| 1 | v8.1.0 | Component data enrichment (hf0, s0) | ✅ DONE | 110 (769 checks) |
| 2 | v8.2.0 | Formation enthalpy shift in ThermoAdapter | ✅ DONE | 113 (787 checks) |
| 3 | v8.3.0 | ReactionRegistry + Source (Mix) | ✅ DONE | 118 (824 checks) |
| 4 | v8.4.0 | Reactor — Fixed Conversion | ✅ DONE | 123 (860 checks) |
| 5 | v8.5.0 | Reactor — K(T) Equilibrium-Lite | ✅ DONE | 126 (878 checks) |
| 6 | v8.6.0 | UI Polish | ✅ DONE | 126 (878 checks) |
| — | v9.0.0 | Version bump (reactor operational) | ⬜ NEXT | — |

**Total growth**: 110 → 126 tests, 769 → 878 checks, 0 regressions across all 6 phases.

---

## Phase Implementation Notes

### Phase 1 (v8.1.0): Component Data

- hf0_Jmol and s0_JmolK for all 8 species from NIST Chemistry WebBook
- Fields in register(), getPropertyNames(), validate()
- Test 110 (Section AA): 46 checks

### Phase 2 (v8.2.0): Formation Shift

- chemShift = hf0 − h_phys(298.15K, 1e5, 'V'), cached, invalidated on setPackage()
- §2.3 zero-impact proof validated: all 110 pre-existing tests unchanged
- Tests 111–113 (Section AB): alignment, regression, ΔH°_rxn

### Phase 3 (v8.3.0): ReactionRegistry + Source (Mix)

- Static class, NNG-A5, 7-point registration validation, frozen objects
- R_H2_COMB: 2H₂ + O₂ → 2H₂O, T∈[400,3000]K, P∈[0.5,50]bar
- source_multi: default dry air, validates species
- Tests 114–118 (Sections AC + AE)

### Phase 4 (v8.4.0): Reactor Fixed Conversion

- reactor_adiabatic Mode A: guards → activation window → ξ_max → ξ → PH-flash
- Inerts pass through, no negative flows, mass+energy balance verified
- Tests 119–123 (Section AD): full conv, partial, limiting, inactive, inert

### Phase 5 (v8.5.0): K(T) Equilibrium

- Mode B: van 't Hoff ln K = −ΔH°/(RT) + ΔS°/R, bisection for ξ_eq
- Alpha parameter, T_eval override, ideal gas activities
- Demo scene: H₂/Air → Combustor (equilibrium) → Flue Gas
- Tests 124–126 (Section AF): K(T) products, alpha scaling, T_eval override

### Phase 6 (v8.6.0): UI Polish

- SVG icons: reactor_adiabatic (rounded rect + chevron arrows), source_multi (multi-dot + arrow)
- Default params: source_multi (dry air, 298K, 1atm, V), reactor (R_H2_COMB, fixed, 50%)
- Property panel — source_multi:
  - Composition editor: per-species number inputs + add-species dropdown
  - T, P (with unit conversion), phase selector
- Property panel — reactor_adiabatic:
  - Reaction selector dropdown (all registered reactions)
  - Mode toggle (Fixed Conversion / Equilibrium K(T))
  - Mode-dependent: conversion slider (fixed) or alpha + T_eval (equilibrium)
  - Optional P_out override
- Reactor results display:
  - Status badge (active/inactive/error with color)
  - Reaction equation, mode
  - ln K, T_eval, alpha (equilibrium) or conversion % (fixed)
  - ξ/ξ_max with progress bar
  - Inactive reason text
- Palette: both units appear automatically via UnitRegistry.listByCategory()
- No new automated tests (UI-only); all 126 existing pass

---

## Next Step: v9.0.0

The reactor system is functionally complete. The version bump to v9.0.0 requires:

1. Update version string and title to v9.0.0
2. Bump export version to 13 (new defIds: source_multi, reactor_adiabatic)
3. Changelog entry summarizing the full reaction capability
4. Git tag

This is a mechanical step — no code changes to logic or tests.

---

## Architecture Summary (as built)

```
ComponentRegistry          ← hf0_Jmol, s0_JmolK for all 8 species
      ↓
ThermoAdapter.hMolar()     ← h_phys + chemShift (formation-referenced)
      ↓
ReactionRegistry           ← validated reactions (R_H2_COMB)
      ↓
source_multi               ← multi-species feed (air, H₂/O₂, custom)
      ↓
reactor_adiabatic          ← Mode A (fixed ξ) or Mode B (K(T) equilibrium)
  tick: stoichiometry → H_target_Jps = H_in → PH-flash → T_out
      ↓
Solver                     ← resolves PH-flash, finds T_out
```

**Key insight**: Reaction heat emerges naturally. The formation shifts align
all enthalpies to a common thermochemical reference. When the reactor changes
composition, the enthalpy difference between products and reactants is exactly
ΔH_rxn. The PH-flash then finds the temperature that satisfies H_out = H_in.

---

## Component Data (NIST)

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

## Reactor Modes

### Mode A: Fixed Conversion (default)

User specifies conversion (0–1). ξ = conversion × ξ_max.
Best for: design studies, kinetically-limited reactions, education.

### Mode B: K(T) Equilibrium-Lite

Thermodynamic calculation. ln K = −ΔH°/(RT) + ΔS°/R.
Bisection finds ξ_eq. ξ = alpha × ξ_eq.
Best for: equilibrium-limited reactions, thermodynamic analysis.

Both share the same adiabatic PH-flash closure. Both preserve mass and energy.

---

## Test Plan Summary

| Section | Tests | Checks | Description |
|---------|-------|--------|-------------|
| AA | 110 | 46 | Component data |
| AB | 111–113 | 18 | Formation shift |
| AC | 114–115 | 13 | Source (Mix) |
| AD | 119–123 | 40 | Reactor fixed conversion |
| AE | 116–118 | 24 | ReactionRegistry |
| AF | 124–126 | 18 | Reactor K(T) equilibrium |
| **Total new** | **16 tests** | **159 checks** | |
| **Grand total** | **126 tests** | **878 checks** | **0 failures** |

---

## Design Decisions Log

| # | Decision | Rationale |
|---|----------|-----------|
| D1 | Shift in ThermoAdapter, not package | Package-independent |
| D2 | chemShift = 0 without hf0 | Backward compatible |
| D3 | Single inlet/outlet reactor | Mixer handles upstream |
| D4 | T_eval = T_in for K(T) | No iteration in tick |
| D5 | phaseConstraint = 'V' default | Gas-phase K/Q valid |
| D6 | Bisection for ξ_eq | Robust (2^-60 precision) |
| D7 | Registration-time validation | NNG-D2, no runtime errors |
| D8 | hf0/s0 for ALL 8 species | Consistent data model |
| D9 | Separate phases | Testing isolation |
| D10 | Cpig deferred | Orthogonal, high impact |
| D11 | source_multi with air default | Practical, minimal |
| D12 | v8.x during implementation | Iterative safety |
| D13 | Activation window: inlet only | Outlet T unknown pre-flash |
| D14 | Export version bump at v9 | Behavioral change trigger |
| D15 | Frozen reaction objects | Prevent runtime mutation |
| D16 | N₂ dilution in reactor tests | PH-flash bracket [100,3000]K |
| D17 | Diagnostics on u.last | Access via t.ud(id).last |
| D18 | Ideal gas activities for Q | Gas-phase only scope |
| D19 | 60-iteration bisection | 2^-60 ≈ 1e-18 precision |
| D20 | Both reactor modes kept | Fixed for design, K(T) for thermo |

---

## Deferred Work

| # | Item | Priority |
|---|------|----------|
| 14.1 | Cpig Shomate migration | HIGH (own major version) |
| 14.2 | Multi-reaction equilibrium | MEDIUM |
| 14.3 | Kinetic reactor | MEDIUM |
| 14.4 | Non-ideal VL equilibrium | LOW |
| 14.5 | Reaction registry expansion | LOW |
| 14.6 | PH-flash bracket widening | LOW |
| 14.7 | Cp-corrected ΔH°(T) for K(T) | LOW |

---

## Demo Scene

Construct C (new in v8.5.0):
- `src-rx` (source_multi): H2:2, O2:1, N2:8 at 800K, 2 bar, vapor
- `reactor` (reactor_adiabatic): R_H2_COMB, equilibrium mode, alpha=1.0
- `snk-rx` (sink): flue gas (H2O + N2, ~2000K)

Grid: 24×22 tiles.

---

## Headless Test Runner

```bash
cd /home/claude && node run_tests.js && node _test_core.js
```

---

*End of design document v2.6. ALL PHASES COMPLETE. Ready for v9.0.0.*
