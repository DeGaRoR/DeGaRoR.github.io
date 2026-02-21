# RELEASESPEC_S3_peng_robinson.md
# processThis — S3: Peng-Robinson Equation of State
# Baseline: v12.10.0 + S1 + S2

═══════════════════════════════════════════════════════════════════
SCOPE
═══════════════════════════════════════════════════════════════════

Replace the ideal-gas + Raoult VLE package with Peng-Robinson cubic
EOS as the default thermodynamic engine. Ideal package stays available
for sandbox/learning. All existing functionality preserved — PR adds
accuracy, not features.


═══════════════════════════════════════════════════════════════════
WHAT PR EOS PROVIDES
═══════════════════════════════════════════════════════════════════

  1. Non-ideal PVT:  Z = PV/nRT ≠ 1. Liquid density from Z_liq.
  2. Fugacity VLE:   K_i = φ_i^L / φ_i^V replaces Raoult K = Psat/P.
  3. Enthalpy departures: H = H_ig + H_dep(T,P). JT cooling emerges.
  4. Entropy departures: S = S_ig + S_dep(T,P). Isentropic work exact.
  5. Liquid Cp from EOS: Cp = Cp_ig + Cp_dep. Replaces constant cpLiq.


═══════════════════════════════════════════════════════════════════
IMPLEMENTATION
═══════════════════════════════════════════════════════════════════

## Core: Cubic Solver

    P = RT/(V-b) − a(T)/[V(V+b) + b(V-b)]

    a(T) = 0.45724 × R²Tc²/Pc × α(T)
    b    = 0.07780 × RTc/Pc
    α(T) = [1 + κ(1 − √(T/Tc))]²
    κ    = 0.37464 + 1.54226ω − 0.26992ω²

    Cubic in Z: Z³ − (1−B)Z² + (A−3B²−2B)Z − (AB−B²−B³) = 0
    A = aP/(R²T²), B = bP/(RT)

    Solver: Cardano analytical for 3 real roots, Newton polish.
    Root selection: Z_vap = largest real root > B.
                    Z_liq = smallest positive real root > B.
    Single real root: supercritical or single-phase.

### Quantum gas guard

    H₂, He have ω < 0 or anomalous critical properties.
    At T >> Tc (always the case for H₂/He at process T):
      α(T) → very small, a(T) → ~0, Z → 1.
    Guard: if T > 2×Tc, force α = 0 (ideal gas behavior).
    This is correct — H₂ and He are effectively ideal at all
    temperatures we care about.

## Mixing Rules

    a_mix = ΣΣ y_i y_j √(a_i a_j) (1 − k_ij)
    b_mix = Σ y_i b_i

### k_ij table (symmetric, k_ii = 0)

    Initial set — pairs that matter for our species:

    Pair          k_ij    Source
    ──────────── ─────── ──────────────────────────
    H₂O–CO₂      0.12    Søreide & Whitson 1992
    H₂O–CH₄      0.50    Peng & Robinson 1976
    H₂O–N₂       0.32    Peng & Robinson 1976
    H₂O–H₂       0.55    estimated (highly non-ideal)
    H₂O–NH₃      0.25    Rizvi & Experiment. 1987
    CO₂–CH₄      0.10    Peng & Robinson 1976
    CO₂–N₂       0.02    Peng & Robinson 1976
    CO₂–H₂       0.10    estimated
    N₂–H₂        0.00    nearly ideal mixture
    N₂–O₂        0.00    nearly ideal
    CH₄–H₂       0.02    Peng & Robinson 1976
    CO–H₂        0.00    nearly ideal
    CO–CO₂       0.02    estimated

    All other pairs: k_ij = 0 (default, no interaction).
    Stored in ThermoAdapter as symmetric lookup.

## Fugacity Coefficients

    ln φ_i = (b_i/b_mix)(Z−1) − ln(Z−B)
            − A/(2√2 B) × (2Σ_j y_j a_ij/a_mix − b_i/b_mix)
            × ln[(Z + (1+√2)B) / (Z + (1−√2)B)]

    Computed for both liquid and vapor roots.
    K_i = φ_i^L / φ_i^V

    Integration point: ThermoAdapter.kValue(species, T, P, x, y)
    returns K from fugacity ratio. Falls back to Raoult if PR
    fails to converge.

## Enthalpy Departure

    H_dep = RT(Z−1) + [T(da/dT) − a] / (2√2 b)
            × ln[(Z + (1+√2)B) / (Z + (1−√2)B)]

    da/dT = −0.45724 R²Tc²/Pc × κ/√(T·Tc) × [1 + κ(1−√(T/Tc))]
    (for mixtures: use a_mix, da_mix/dT with mixing rules)

    Integration: H(T,P) = H_ig(T) + H_dep(T,P)
    H_ig(T) from existing Shomate integration. H_dep adds the
    non-ideal correction.

    This is what makes JT cooling work: H_dep varies with P,
    so isenthalpic expansion (H constant, P drops) requires T
    to change to compensate.

## Entropy Departure

    S_dep = [da/dT] / (2√2 b)
            × ln[(Z + (1+√2)B) / (Z + (1−√2)B)]
            + R ln(Z−B)

    Integration: S(T,P) = S_ig(T,P) + S_dep(T,P)
    Used for isentropic compression/expansion work.

## Liquid Density

    ρ_liq = P × MW / (Z_liq × R × T)

    Replaces constant rhoLiq from ComponentRegistry.
    Integration: ThermoAdapter.getLiquidDensity(species, T, P)
    gains optional P argument. Without P: falls back to constant.

## Saturation Pressure (Bubble/Dew Point)

    Bubble P: given T, x_i, find P where Σ(K_i × x_i) = 1.
    Dew P: given T, y_i, find P where Σ(y_i / K_i) = 1.

    Iteration: bisection on P (bounded [0.1×Psat_est, 10×Psat_est]).
    K_i from fugacity at each trial P. Converges in ~15 iterations.

    Falls back to Antoine/Raoult if bisection fails to converge
    within 30 iterations.

## Compressor Isentropic Work (enhancement)

    Current: W_s = H(T2s, P2) − H(T1, P1) using ideal Cp integration.
    With PR: W_s = H_ig(T2s) + H_dep(T2s, P2) − H_ig(T1) − H_dep(T1, P1)

    T2s found by: S(T2s, P2) = S(T1, P1).
    Bisection on T2s using S_ig + S_dep. ~15 iterations.

## Package Selector

    SimSettings.thermoPackage = 'IDEAL' | 'PR'
    Default: 'PR' after S3. Inspector toggle.

    IDEAL: existing behavior (Shomate + Raoult + constant cpLiq).
    PR: cubic EOS + fugacity + departures.

    ThermoAdapter dispatches to appropriate implementation based
    on package setting. All existing functions keep same signature.

## Convergence Fallback

    If PR cubic solver finds no valid root (rare, usually at
    extreme conditions):
      1. Log warning
      2. Fall back to ideal gas Z = 1 for that call
      3. Alarm source: "Thermodynamic convergence issue at T=X, P=Y.
         Using ideal gas approximation." (INFO severity)

    If fugacity VLE fails to converge:
      1. Fall back to Raoult K-values
      2. Alarm: "VLE convergence fallback to Raoult at T=X, P=Y." (INFO)

    System always computes. Never crashes on thermo failure.

## Range-Exceeded Alarm Source

    Current: console.warn only, via _warnedRanges Set.
    New: registered alarm source in AlarmSystem.

    When Shomate/Antoine called outside valid T range:
      Within 20% extrapolation → INFO
      Beyond 20% extrapolation → WARNING
      Beyond 50% extrapolation → ERROR

    Messages per NNG-12:
      "H₂O Cp evaluated at 250 K, below valid range (298 K).
       Using boundary extrapolation. Error ~3%.
       Consider checking operating temperature."


═══════════════════════════════════════════════════════════════════
WHAT CHANGES IN EXISTING CODE
═══════════════════════════════════════════════════════════════════

  ThermoAdapter gains:
    .prSolve(T, P, composition) → { Z_vap, Z_liq, a_mix, b_mix }
    .fugacityCoeff(T, P, Z, composition) → { phi_i[] }
    .enthalpyDeparture(T, P, Z, composition) → H_dep (J/mol)
    .entropyDeparture(T, P, Z, composition) → S_dep (J/(mol·K))

  ThermoAdapter existing methods enhanced:
    .kValue()  — dispatches to fugacity or Raoult
    .hMolar()  — adds H_dep when PR active
    .cpMolar() — adds Cp_dep when PR active
    .getLiquidDensity() — uses Z_liq when PR active

  Flash functions (PH-flash, bubble/dew): use new K-values.
  No changes to flash algorithm — only K source changes.

  ComponentRegistry: no changes. All species data already present.
  k_ij table: new data structure in ThermoAdapter.


═══════════════════════════════════════════════════════════════════
PHASE TRACKER
═══════════════════════════════════════════════════════════════════

  [ ] 3a  Cubic solver (Cardano + Newton polish)
  [ ] 3b  Root selection (Z_vap, Z_liq, single-phase)
  [ ] 3c  Quantum gas guard (H₂, He)
  [ ] 3d  Mixing rules (a_mix, b_mix, k_ij table)
  [ ] 3e  Fugacity coefficients (ln φ_i)
  [ ] 3f  K-values from fugacity (replaces Raoult in PR mode)
  [ ] 3g  Enthalpy departure
  [ ] 3h  Entropy departure
  [ ] 3i  Liquid density from Z_liq
  [ ] 3j  Bubble/dew point iteration
  [ ] 3k  Compressor isentropic work enhancement
  [ ] 3l  Package selector (IDEAL / PR toggle)
  [ ] 3m  Convergence fallback (cubic + VLE)
  [ ] 3n  Range-exceeded alarm source
  [ ] 3o  Tests

  Tests: ~15 new
    - Pure N₂: Z(300K, 50bar) ≈ 0.98 (near ideal, sanity)
    - Pure CO₂: Z(300K, 70bar) ≈ 0.3 (liquid-like, supercritical)
    - Pure H₂O: bubble P at 373K ≈ 1 atm
    - H₂ quantum guard: α → 0 at 300K (T >> Tc=33K)
    - Binary N₂/O₂: K-values match literature at 90K
    - H_dep: CO₂ at 300K/70bar ≠ 0 (non-ideal)
    - JT cooling: NH₃ valve 20→2 bar → T_out < T_in
    - S_dep: isentropic compression T2s > T2s_ideal
    - Fallback: extreme conditions → Raoult K + alarm
    - Package toggle: IDEAL gives same results as pre-S3
    - Range alarm: H₂O Cp at 250K → INFO in AlarmSystem
    - Range alarm: CO₂ Cp at 100K → WARNING (>20% extrap)
    - Liquid density: H₂O at 300K/1bar ≈ 55.5 mol/L from Z_liq
    - k_ij symmetry: k_ij = k_ji for all registered pairs
    - Full regression: all S1+S2 tests pass in both packages

  Gate: all previous + ~15 new pass.
