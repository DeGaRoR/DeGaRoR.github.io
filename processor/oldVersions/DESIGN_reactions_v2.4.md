# processThis — Reaction System Design Document

**Version**: 2.4 — Phase 4 Complete  
**Author**: Design Authority  
**Date**: 2026-02-15  
**Baseline codebase**: processThis v8.4.0  
**Status**: APPROVED — Phases 1–4 implemented, Phases 5–6 pending

---

## Implementation Status

| Phase | Version | Description | Status | Tests |
|-------|---------|-------------|--------|-------|
| 1 | v8.1.0 | Component data enrichment (hf0, s0) | ✅ DONE | 110 (769 checks) |
| 2 | v8.2.0 | Formation enthalpy shift in ThermoAdapter | ✅ DONE | 113 (787 checks) |
| 3 | v8.3.0 | ReactionRegistry + Source (Mix) | ✅ DONE | 118 (824 checks) |
| 4 | v8.4.0 | Reactor — Fixed Conversion | ✅ DONE | 123 (860 checks) |
| 5 | v8.5.0 | Reactor — K(T) Equilibrium-Lite | ⬜ NEXT | — |
| 6 | v8.6.0 | UI Polish | ⬜ | — |
| — | v9.0.0 | Version bump (reactor operational) | ⬜ | — |

### Phase 4 Implementation Notes (v8.4.0)

- `reactor_adiabatic` unit registered: category REACTOR, 2×3, ports mat_in/mat_out
- Fixed conversion Mode A implemented exactly per §6.3 pseudocode
- Tick emits PH-flash spec (`H_target_Jps = H_in`) — solver resolves T_out
- Formation shifts make T_out absorb ΔH_rxn: exothermic → T_out > T_in
- Activation window (inlet T/P only, per D13): pass-through when outside
- Limiting reactant: ξ_max = min(n_in[i]/|νᵢ|), no negative flows
- Inert species: pass through unchanged, contribute to dilution
- Diagnostics on `u.last`: reactionId, mode, conversion, xi, xi_max, status, H_in_kW
- Test accessor: `t.ud(rx).last` (not `t.unit(rx)` which returns scene unit)

**PH-flash bracket discovery**: The general PH-flash bracket extends to [100, 3000]K.
Stoichiometric H₂/O₂ without dilution gives adiabatic flame T >> 3000K (estimated
~5000–6000K). Tests use N₂ dilution (N2:10) to keep T_out within bracket (~2000K).
This is more realistic (combustion in air-like mix). Future: consider widening
bracket for reactor applications if undiluted feeds needed.

**Tests 119–123** (Section AD):
- 119: Full conversion with N₂ dilution — stoichiometry, T_out >> T_in, ΔH < 200W, mass balance
- 120: Partial conversion 25% — intermediate composition, lower T_out
- 121: Limiting reactant (O₂ limited) — correct ξ_max, no negatives
- 122: Inactive (T < Tmin) — pass-through, status 'inactive'
- 123: Inert pass-through (N₂ + Ar) — inerts exact, reactants consumed, mass+energy balance

Zero deviations from design except test feed compositions (N₂ dilution for bracket).

### Previous Phase Notes

- **Phase 1** (v8.1.0): hf0/s0 for all 8 species. Test 110 (46 checks).
- **Phase 2** (v8.2.0): chemShift in hMolar(). §2.3 validated. Tests 111–113.
- **Phase 3** (v8.3.0): ReactionRegistry + source_multi + R_H2_COMB. Tests 114–118.

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

Chemical reaction capability for processThis:

1. **Formation enthalpy shift** in ThermoAdapter.hMolar() ✅ (v8.2.0)
2. **Component data** — hf0/s0 for all 8 species ✅ (v8.1.0)
3. **ReactionRegistry** — validated reaction definitions ✅ (v8.3.0)
4. **Multi-component source** — composition mix, default air ✅ (v8.3.0)
5. **Adiabatic reactor — fixed conversion** ✅ (v8.4.0)
6. **Adiabatic reactor — K(T) equilibrium-lite** (Phase 5)

Versioning: v8.x.y during implementation. v9 when reactor fully operational.

---

## 1. Scope and Constraints

### In Scope

- ComponentRegistry: hf0/s0 for all 8 species ✅
- ThermoAdapter: formation enthalpy shift ✅
- ReactionRegistry ✅ + source_multi ✅
- Reactor: fixed conversion ✅, K(T) equilibrium-lite (Phase 5)
- UI: icons, property panel, registry viewer (Phase 6)

### Out of Scope

Multi-reaction equilibrium, fugacity models, true coupled ξ–T solve,
kinetics, liquid-phase reactions, Cpig Shomate migration, exhaustive reactions.

### Governing NNG

NNG-L1/L2, NNG-A1/A2/A5, NNG-U1/U2/U3/U4, NNG-D1/D2/D3, NNG-T1/T2/T3, NNG-V1/V2.

---

## 2. Formation Enthalpy Shift ✅ (v8.2.0)

chemShift = hf0 − h_phys(298.15K, 1e5, 'V'). In ThermoAdapter.hMolar().
Zero-impact on non-reactive flowsheets (§2.3 validated). Cache on setPackage().

---

## 3. Component Data ✅ (v8.1.0)

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

## 4. ReactionRegistry ✅ (v8.3.0)

Static class, NNG-A5. 7-point registration validation. Frozen objects.
R_H2_COMB: 2H₂ + O₂ → 2H₂O, T∈[400,3000]K, P∈[0.5,50]bar.

---

## 5. Multi-Component Source ✅ (v8.3.0)

`source_multi`: default dry air (N2:0.78, O2:0.21, Ar:0.01). Validates species.

---

## 6. Reactor Unit

### 6.1 Identity ✅ (as built)

defId `'reactor_adiabatic'`, category REACTOR, size 2×3.
Ports: `mat_in` (IN, x:0,y:1), `mat_out` (OUT, x:2,y:1).

### 6.2 Parameters

`reactionId`, `mode` ('fixed'/'equilibrium'), `conversion` (0–1),
`alpha` (0–1), `P_out` (optional Pa), `T_eval_override` (optional K).

### 6.3 Mode A — Fixed Conversion ✅ (as built)

```
GUARDS: no input → return; no reaction → error + pass-through

1. Activation window (inlet T/P only):
   Outside → pass-through TP spec, status 'inactive'

2. ξ_max = min over reactants of (n_in[i] / |νᵢ|)
   If ξ_max ≤ 0 → pass-through, status 'no_reactants'

3. ξ = clamp(conversion, 0, 1) × ξ_max

4. n_out = { ...sIn.n } (preserves inerts)
   For each stoich species: n_out[sp] += ν × ξ
   Clamp < 1e-15 to 0, delete zero entries

5. H_in = thermo.getHdot_Jps(sIn)

6. Emit PH-flash: { type, P, n: n_out, phaseConstraint, H_target_Jps: H_in }

7. Diagnostics: u.last = { reactionId, mode, conversion, xi, xi_max, status, H_in_kW }
```

Access diagnostics in tests via `t.ud(id).last` (NOT `t.unit(id)`).

### 6.4 Mode B — K(T) Equilibrium-Lite (Phase 5)

Steps 1–2 same. Then ln K = −ΔH°/(R·T_eval) + ΔS°/R.
Bisection for ξ_eq. ξ = alpha × ξ_eq. Same PH-flash closure.

### 6.5 Phase Handling

Gas-phase ideal activities. phaseConstraint='V' default.

### 6.6 PH-Flash Bracket Limitation

General PH-flash bracket: [Tmin_adaptive, 2000]K, extends to [100, 3000]K.
Stoichiometric H₂/O₂ full conversion produces adiabatic flame T >> 3000K.
**Mitigation**: Use N₂ dilution in tests and practical flowsheets.
**Future**: Consider widening bracket for reactor applications.

---

## 7–9. (Unchanged)

STREAM_CONTRACTS: no changes. Mass/Energy: by construction. UI: Phase 6.

---

## 10. Test Plan

### Section AA ✅ — Component Data (Test 110, 46 checks)
### Section AB ✅ — Formation Shift (Tests 111–113, 18 checks)
### Section AC ✅ — Source (Mix) (Tests 114–115, 13 checks)

### Section AD ✅ — Reactor Fixed Conversion (Tests 119–123)

**Test 119**: Full conversion + adiabatic closure (12 checks)
- Feed: H2:2, O2:1, N2:10, T=800K, P=1bar, V
- H2≈0, O2≈0, H2O≈2, N2=10
- T_out >> 800K, |ΔH| < 200W, mass balanced, status active, ξ=ξ_max

**Test 120**: Partial conversion 25% (8 checks)
- H2≈1.5, O2≈0.75, H2O≈0.5, N2=10
- T_out > 800K, ΔH < 200W, mass balanced

**Test 121**: Limiting reactant (6 checks)
- Feed: O2:0.2 (limiting), ξ_max=0.2
- H2≈1.6, O2≈0, H2O≈0.4, all flows ≥ 0

**Test 122**: Inactive below T window (5 checks)
- T=300K < Tmin=400K, composition unchanged, status 'inactive'

**Test 123**: Inert pass-through (9 checks)
- N2:5, Ar:2 unchanged; H2/O2 consumed, H2O:2 produced
- 3 outlet species, mass+energy balance

### Section AE ✅ — ReactionRegistry (Tests 116–118, 24 checks)

### Section AF — Reactor K(T) Mode (Phase 5) ← NEXT

**Test 124**: K(T) strongly favors products (ξ_eq/ξ_max > 0.999)
**Test 125**: Alpha scaling (alpha=0.5 → ξ ≈ 0.5×ξ_eq)
**Test 126**: T_eval override

### Reference Values

```
ΔH°_298 = −483652 J/mol-rxn
ΔS°_298 = −88.842 J/(mol·K)
ln K(800) ≈ 62.0  →  K >> 1
```

---

## 11. Implementation Phases

### Phase 1 ✅ v8.1.0 — Component Data (769 checks)
### Phase 2 ✅ v8.2.0 — Formation Shift (787 checks)
### Phase 3 ✅ v8.3.0 — ReactionRegistry + Source (824 checks)
### Phase 4 ✅ v8.4.0 — Reactor Fixed Conversion (860 checks)

### Phase 5: Reactor — K(T) Equilibrium-Lite (v8.5.0) ← NEXT

1. Add Mode B logic to reactor tick (detect `mode === 'equilibrium'`)
2. Compute ΔH°, ΔS° from registered species data
3. ln K = −ΔH°/(R·T_eval) + ΔS°/R
4. Bisection solver for ξ_eq where ln Q(ξ) = ln K
5. ξ = alpha × ξ_eq, then same PH-flash closure as Mode A

Tests: Section AF (Tests 124–126)
Risk: LOW — builds on proven Phase 4 infrastructure.

### Phase 6: UI Polish (v8.6.0)

Icons, property panels, registry viewer. Manual testing.

### v9.0.0

After Phase 5: reactor operational with both modes → v9.0.0, export version 10.

---

## 12. Risk Assessment

- **Absolute Hdot shift** ✅ Confirmed harmless (Phase 2)
- **PH flash bracket** ⚠️ 3000K max. Undiluted H₂/O₂ exceeds this. Mitigated by
  N₂ dilution in tests. Document as known limitation.
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

---

## 14. Deferred Work

- **14.1** Cpig Shomate migration
- **14.2** Multi-reaction equilibrium
- **14.3** Kinetic reactor
- **14.4** Non-ideal VL equilibrium
- **14.5** Reaction registry expansion
- **14.6** PH-flash bracket widening for reactor applications

---

## 15. File Placement Guide

| Component | Status | Location |
|-----------|--------|----------|
| hf0/s0 fields + data | ✅ | ComponentRegistry |
| ThermoAdapter shift | ✅ | _chemShiftCache, _getChemShift(), hMolar() |
| ReactionRegistry | ✅ | After ComponentRegistry, before ModelRegistry |
| source_multi | ✅ | After source, before sink |
| reactor_adiabatic | ✅ | After flash_drum, before Scene class (~L6762) |
| PG.ReactionRegistry | ✅ | In PG export |
| Tests AA–AE | ✅ | Before RUNNER |
| Tests AF | Phase 5 | Before RUNNER |

---

*End of design document v2.4. Phases 1–4 complete. Phase 5 next.*
