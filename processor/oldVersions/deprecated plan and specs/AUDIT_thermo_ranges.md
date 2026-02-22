# processThis — Thermodynamic Property Range Audit
## v12.10.0 Baseline · February 2026

Code-level audit of all species registrations, HEX/air cooler architecture,
and valve isenthalpic behavior. Findings feed into S1 (data fixes) and S3
(range alarm source).

---

## HEX / Air Cooler Architecture: Shared, Sound

Air cooler is a purpose-built shortcut of the general HEX. Both share
`hxEnthalpy`, `hxCapacityRates`, `hxSolveUaNtu`. Air cooler fabricates
synthetic cold side from atmosphere, calls `hxSolveUaNtu`.

Both write outlets via PH-flash (H_target, not T directly). Condensation
and evaporation handled correctly on outlet.

| HEX mode | Two-phase safe? | Notes |
|---|---|---|
| Approach | ✅ | Bisection calls PH-flash each iteration |
| Setpoint | ✅ on specified side | Q from ΔH includes latent heat |
| UA/NTU | ⚠️ Underpredicts | streamCp = sensible only. Fix in S4. |

## Valve: Isenthalpic, PR-Ready

Valve sets `H_target = H_in` at `P_out`, PH-flash finds T. Zero code
changes needed for PR EOS. JT cooling emerges from H_departure(T,P).

- Ideal gas: T_out = T_in (correct, μ_JT = 0)
- PR EOS: T_out < T_in for most gases (JT cooling automatic)

## Shomate (Cp_ig) Ranges

| Species | Tmin (K) | Tmax (K) | Demand (K) | Status |
|---|---|---|---|---|
| H₂O | **500** | 1700 | 273–1500 | ⚠️ Fix: Tmin→298 (same NIST coefficients) |
| O₂ | 100 | 2000 | 77–1500 | OK (<1% extrap error at 77K) |
| H₂ | 298 | 2500 | 20–1000 | OK (always supercritical, Cp≈29 constant) |
| N₂ | 100 | 2000 | 77–1500 | OK (<1% extrap error at 77K) |
| Ar | 100 | 5000 | 87–300 | ✅ (monatomic, Cp = 5/2 R) |
| CH₄ | 298 | 6000 | 112–1000 | OK (~7% overprediction at 112K) |
| He | 100 | 2000 | 4–300 | OK (always supercritical, Cp = 5/2 R) |
| CO₂ | 298 | 6000 | 195–1500 | OK (<5% extrap error at 195K) |
| NH₃ | 298 | 6000 | 200–800 | OK (~3% extrap error at 200K) |

Extrapolation uses clamped boundary Cp (integrateShomateCp). Conservative.

## Antoine (Psat) Ranges

| Species | Tmin (K) | Tmax (K) | Tc (K) | Status |
|---|---|---|---|---|
| H₂O | 274 | 647 | 647 | ✅ Full (two ranges) |
| O₂ | 60 | 154 | 155 | ✅ |
| H₂ | 14 | 33 | 33 | ✅ (supercritical placeholder) |
| N₂ | 63 | 126 | 126 | ✅ |
| Ar | 84 | 151 | 151 | ✅ |
| CH₄ | 91 | 191 | 191 | ✅ |
| He | 2 | 5 | 5 | ✅ (supercritical placeholder) |
| CO₂ | 154 | 196 | 304 | ⚠️ Fix: add liquid-vapor range 217–304K |
| NH₃ | 164 | 372 | 405 | ✅ Full (two ranges) |

**CO₂ problem:** Current Antoine covers sublimation (154–196K) only.
Above triple point (216.6K, 5.18 bar) liquid CO₂ exists but Antoine
returns sublimation P. At 250K: Antoine gives ~0.1 bar, real Psat ~17 bar.
Raoult K-values qualitatively wrong above 200K. Fix: add
`{ A: 7.5789, B: 861.82, C: 271.88, Tmin: 217, Tmax: 304 }`.

## cpLiq (Constant)

| Species | cpLiq (J/mol·K) | Worst error | Notes |
|---|---|---|---|
| H₂O | 75.3 | <1% (273–373K) | Excellent |
| O₂ | 52.8 | ~1% at 77K | Fine |
| N₂ | 54.4 | ~3% at 65K | Acceptable |
| NH₃ | 80.8 | ~12% at 200K | Largest; PR improves |
| CH₄ | 52.6 | ~3% at 100K | Fine |

## Warning System

Range violations emit `console.warn` only (deduplicated via `_warnedRanges`
Set). Player never sees them. S3 adds alarm source for player visibility.

## Fixes by Stage

| Fix | Lines | Stage |
|---|---|---|
| H₂O cpig Tmin 500→298 | 1 | S1 |
| CO₂ Antoine liquid-vapor range | 2 | S1 |
| CO species registration | ~30 | S1 |
| Thermo range-exceeded alarm source | ~20 | S3 |
| HEX UA/NTU effective-Cp | ~15 | S4 |

## Confirmed Non-Issues

| Concern | Resolution |
|---|---|
| Valve JT cooling | Correct (ideal: μ_JT=0; PR: automatic via H_dep). Zero code changes. |
| HEX two-phase handling | Correct in approach/setpoint modes. UA/NTU underpredicts, doesn't crash. |
| Refrigeration loop feasibility | Architecturally ready. JT activates with PR. |
| N₂/O₂ Shomate below 100K | <1% error. Diatomic Cp constant at cryo T. |
| NH₃ cpLiq for refrigeration | ~12% worst case. Acceptable. PR improves. |
