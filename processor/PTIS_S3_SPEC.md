# PTIS_S3_SPEC
## S3 — Peng-Robinson Equation of State
### processThis v13.2.0 → v13.3.0 (post-S2)

---

## Overview

**What:** Replace the ideal-gas + Raoult VLE thermodynamic package with
Peng-Robinson cubic EOS as the default. Adds non-ideal PVT, fugacity-based
VLE, enthalpy/entropy departure functions, liquid density from cubic roots,
and isentropic work via entropy matching. Ideal package stays available.

**Sub-sessions:** S3a (2), S3b (1) — 3 sessions total.

**Risk:** Medium. Numerical solver complexity (cubic roots, fugacity iteration,
entropy bisection). Well-established equations but many edge cases.

**Dependencies:** S2 (sequential discipline; no hard dependency on power
management, but alarm infrastructure from S1 used for convergence alarms).

**Required by:** S4 (PR K-values for meaningful distillation separation),
S5 (PR density for tank headspace pressure).

**Baseline state (post-S2):**
- `IdealRaoultPackage` (line 4089): Shomate Cp, ideal gas H, Raoult K = Psat/P
- `PengRobinsonPackage` (line 4333): stub extending IdealRaoultPackage, all methods fallback
- `thermo = new ThermoAdapter(idealRaoultPkg)` (line 5848)
- `thermo.setPackage(pkg)` exists (line 4393)
- `computeCompressorWork`: ideal gas γ = Cp/(Cp−R), T₂s from P ratio (line 5648)
- No enthalpy departure, no entropy departure, no fugacity coefficients

**After S3:**
- PR cubic solver with Cardano + Newton polish
- Fugacity-based K-values (K_i = φ_i^L / φ_i^V)
- H_dep, S_dep, Cp_dep for non-ideal enthalpy/entropy
- Liquid density ρ = P·MW/(Z_liq·R·T)
- Isentropic work via entropy-matched T₂s bisection
- Package toggle: IDEAL | PR (default PR)
- ~335 tests (328 + 7 from S3a, then +8 from S3b → maybe ~343 total, call it ~15 net)

---

# S3a — PR EOS Core (Cubic + Fugacity)

**Sessions:** 2 (cubic solver + mixing rules, then fugacity + K-values).

## S3a-1. PR Constants and Pure-Component Parameters

**Insert location:** Inside `PengRobinsonPackage` class, after constructor.

```javascript
// PR EOS constants
static Omega_a = 0.45724;
static Omega_b = 0.07780;
static R = 8.314;  // J/(mol·K)
static SQRT2 = Math.SQRT2;

/**
 * Pure-component PR parameters.
 * @param {string} comp - Component ID
 * @param {number} T_K  - Temperature [K]
 * @returns {{ a, b, kappa, alpha, dadT }}
 */
_pureParams(comp, T_K) {
  const cd = ComponentRegistry.get(comp);
  const Tc = cd.Tc, Pc = cd.Pc, omega = cd.omega;
  const R = PengRobinsonPackage.R;

  const kappa = 0.37464 + 1.54226 * omega - 0.26992 * omega * omega;

  // Quantum gas guard: H₂, He at T >> Tc → α = 0 (ideal gas)
  let alpha, dadT;
  if (T_K > 2 * Tc && (comp === 'H2' || comp === 'He')) {
    alpha = 0;
    dadT = 0;
  } else {
    const sqrtTr = Math.sqrt(T_K / Tc);
    const bracket = 1 + kappa * (1 - sqrtTr);
    alpha = bracket * bracket;
    // da/dT for departure functions
    dadT = -PengRobinsonPackage.Omega_a * R * R * Tc * Tc / Pc
           * kappa / Math.sqrt(T_K * Tc) * bracket;
  }

  const a = PengRobinsonPackage.Omega_a * R * R * Tc * Tc / Pc * alpha;
  const b = PengRobinsonPackage.Omega_b * R * Tc / Pc;

  return { a, b, kappa, alpha, dadT };
}
```

---

## S3a-2. k_ij Binary Interaction Parameters

```javascript
// Symmetric k_ij table — stored as 'comp1:comp2' with comp1 < comp2 (sorted)
static _kij = {
  'CO2:H2O': 0.12,   // Søreide & Whitson 1992
  'CH4:H2O': 0.50,   // Peng & Robinson 1976
  'H2O:N2':  0.32,   // Peng & Robinson 1976
  'H2:H2O':  0.55,   // estimated (highly non-ideal)
  'H2O:NH3': 0.25,   // Rizvi & Experiment. 1987
  'CH4:CO2': 0.10,   // Peng & Robinson 1976
  'CO2:N2':  0.02,   // Peng & Robinson 1976
  'CO2:H2':  0.10,   // estimated
  'H2:N2':   0.00,   // nearly ideal
  'N2:O2':   0.00,   // nearly ideal
  'CH4:H2':  0.02,   // Peng & Robinson 1976
  'CO:H2':   0.00,   // nearly ideal
  'CO:CO2':  0.02,   // estimated
};

static getKij(comp1, comp2) {
  if (comp1 === comp2) return 0;
  const key = [comp1, comp2].sort().join(':');
  return PengRobinsonPackage._kij[key] ?? 0;
}
```

13 pairs. All other pairs default to 0. Symmetric: k_ij = k_ji enforced
by sorted key.

---

## S3a-3. Mixing Rules

```javascript
/**
 * Mixture a_mix, b_mix, and da_mix/dT for PR EOS.
 * @param {Object} composition - { species: moleFraction }
 * @param {number} T_K
 * @returns {{ a_mix, b_mix, da_mix_dT, pureParams: Map }}
 */
_mixParams(composition, T_K) {
  const species = Object.keys(composition);
  const y = composition;
  const pure = {};
  for (const sp of species) {
    pure[sp] = this._pureParams(sp, T_K);
  }

  let a_mix = 0, b_mix = 0, da_mix_dT = 0;
  for (const i of species) {
    b_mix += y[i] * pure[i].b;
    for (const j of species) {
      const kij = PengRobinsonPackage.getKij(i, j);
      const a_ij = Math.sqrt(pure[i].a * pure[j].a) * (1 - kij);
      a_mix += y[i] * y[j] * a_ij;

      // da_mix/dT for departure functions
      if (pure[i].a > 0 && pure[j].a > 0) {
        const da_ij_dT = 0.5 * (1 - kij) * (
          pure[i].dadT * Math.sqrt(pure[j].a / pure[i].a) +
          pure[j].dadT * Math.sqrt(pure[i].a / pure[j].a)
        );
        da_mix_dT += y[i] * y[j] * da_ij_dT;
      }
    }
  }

  return { a_mix, b_mix, da_mix_dT, pure };
}
```

---

## S3a-4. Cubic Solver

The PR EOS in Z:

    Z³ − (1−B)Z² + (A−3B²−2B)Z − (AB−B²−B³) = 0

where A = a_mix·P/(R²T²), B = b_mix·P/(RT).

```javascript
/**
 * Solve PR cubic for compressibility factor Z.
 * Cardano analytical solution for 3 real roots + Newton polish.
 *
 * @param {number} A - Dimensionless a parameter
 * @param {number} B - Dimensionless b parameter
 * @returns {{ Z_vap, Z_liq, roots[], converged }}
 */
_solveCubic(A, B) {
  // Coefficients: Z³ + c₂Z² + c₁Z + c₀ = 0
  const c2 = -(1 - B);
  const c1 = A - 3 * B * B - 2 * B;
  const c0 = -(A * B - B * B - B * B * B);

  // Cardano's method
  const p = c1 - c2 * c2 / 3;
  const q = c0 - c2 * c1 / 3 + 2 * c2 * c2 * c2 / 27;
  const D = q * q / 4 + p * p * p / 27;

  let roots = [];
  if (D > 1e-14) {
    // One real root
    const sqrtD = Math.sqrt(D);
    const u = Math.cbrt(-q / 2 + sqrtD);
    const v = Math.cbrt(-q / 2 - sqrtD);
    roots.push(u + v - c2 / 3);
  } else {
    // Three real roots
    const r = Math.sqrt(-p * p * p / 27);
    const theta = Math.acos(Math.max(-1, Math.min(1, -q / (2 * r))));
    const m = 2 * Math.cbrt(r);
    roots.push(m * Math.cos(theta / 3) - c2 / 3);
    roots.push(m * Math.cos((theta + 2 * Math.PI) / 3) - c2 / 3);
    roots.push(m * Math.cos((theta + 4 * Math.PI) / 3) - c2 / 3);
  }

  // Newton polish (3 iterations per root)
  for (let i = 0; i < roots.length; i++) {
    let z = roots[i];
    for (let k = 0; k < 3; k++) {
      const f = z * z * z + c2 * z * z + c1 * z + c0;
      const fp = 3 * z * z + 2 * c2 * z + c1;
      if (Math.abs(fp) > 1e-30) z -= f / fp;
    }
    roots[i] = z;
  }

  // Filter: Z must be > B (physical constraint)
  const valid = roots.filter(z => z > B + 1e-10).sort((a, b) => a - b);

  if (valid.length === 0) {
    return { Z_vap: 1.0, Z_liq: null, roots: [1.0], converged: false };
  }

  return {
    Z_vap: valid[valid.length - 1],  // largest root = vapor
    Z_liq: valid.length > 1 ? valid[0] : null,  // smallest root = liquid
    roots: valid,
    converged: true
  };
}
```

---

## S3a-5. prSolve — Top-Level EOS Call

New method on `PengRobinsonPackage` (and exposed on `ThermoAdapter`):

```javascript
/**
 * Solve PR EOS for a mixture at T, P.
 * @param {number} T_K
 * @param {number} P_Pa
 * @param {Object} composition - { species: moleFraction } (must sum to ~1)
 * @returns {{ Z_vap, Z_liq, A, B, a_mix, b_mix, da_mix_dT, pure, converged }}
 */
prSolve(T_K, P_Pa, composition) {
  const R = PengRobinsonPackage.R;
  const mix = this._mixParams(composition, T_K);
  const A = mix.a_mix * P_Pa / (R * R * T_K * T_K);
  const B = mix.b_mix * P_Pa / (R * T_K);

  const cubic = this._solveCubic(A, B);

  return {
    ...cubic,
    A, B,
    a_mix: mix.a_mix,
    b_mix: mix.b_mix,
    da_mix_dT: mix.da_mix_dT,
    pure: mix.pure
  };
}
```

**ThermoAdapter proxy** (line ~4440 area):
```javascript
prSolve(T_K, P_Pa, composition) {
  if (this._pkg.prSolve) return this._pkg.prSolve(T_K, P_Pa, composition);
  return { Z_vap: 1.0, Z_liq: null, converged: false };  // ideal fallback
}
```

---

## S3a-6. Fugacity Coefficients

```javascript
/**
 * Compute ln(φ_i) for each species at given Z root.
 * @param {number} T_K
 * @param {number} P_Pa
 * @param {number} Z - Compressibility factor (Z_vap or Z_liq)
 * @param {Object} composition - { species: moleFraction }
 * @param {Object} prResult - Output from prSolve()
 * @returns {Object} { species: lnPhi }
 */
fugacityCoeff(T_K, P_Pa, Z, composition, prResult) {
  const { A, B, a_mix, b_mix, pure } = prResult;
  const R = PengRobinsonPackage.R;
  const S2 = Math.SQRT2;
  const species = Object.keys(composition);
  const y = composition;

  const lnPhi = {};
  const logArg = (Z + (1 + S2) * B) / (Z + (1 - S2) * B);
  const lnLogArg = Math.log(Math.max(logArg, 1e-30));

  for (const i of species) {
    // Σ y_j * a_ij
    let sum_ya = 0;
    for (const j of species) {
      const kij = PengRobinsonPackage.getKij(i, j);
      sum_ya += y[j] * Math.sqrt(pure[i].a * pure[j].a) * (1 - kij);
    }

    const bi_over_bm = pure[i].b / b_mix;

    lnPhi[i] = bi_over_bm * (Z - 1)
      - Math.log(Math.max(Z - B, 1e-30))
      - A / (2 * S2 * B) * (2 * sum_ya / a_mix - bi_over_bm) * lnLogArg;
  }

  return lnPhi;
}
```

**ThermoAdapter proxy:**
```javascript
fugacityCoeff(T_K, P_Pa, Z, composition, prResult) {
  if (this._pkg.fugacityCoeff) return this._pkg.fugacityCoeff(T_K, P_Pa, Z, composition, prResult);
  return {};
}
```

---

## S3a-7. K-Values from Fugacity

Override `kValue()` in `PengRobinsonPackage`:

```javascript
/**
 * VLE K-value: K_i = φ_i^L / φ_i^V
 * Falls back to Raoult if PR fails to produce two roots.
 */
kValue(comp, T_K, P_Pa, composition) {
  if (!composition) {
    // Single-component or no composition → Raoult fallback
    return super.kValue(comp, T_K, P_Pa);
  }

  const pr = this.prSolve(T_K, P_Pa, composition);
  if (!pr.converged || !pr.Z_liq) {
    // Single phase — fall back to Raoult
    return super.kValue(comp, T_K, P_Pa);
  }

  const lnPhi_V = this.fugacityCoeff(T_K, P_Pa, pr.Z_vap, composition, pr);
  const lnPhi_L = this.fugacityCoeff(T_K, P_Pa, pr.Z_liq, composition, pr);

  const phi_V = Math.exp(lnPhi_V[comp] || 0);
  const phi_L = Math.exp(lnPhi_L[comp] || 0);

  if (phi_V < 1e-30) return super.kValue(comp, T_K, P_Pa);  // degenerate
  return phi_L / phi_V;
}
```

**Signature change note:** The existing `kValue(comp, T_K, P_Pa)` gains
an optional 4th argument `composition`. The ideal package ignores it.
All existing callers pass 3 arguments and continue to work unchanged.

The ThermoAdapter's flash functions will be updated to pass composition
when available, enabling rigorous VLE in PR mode.

---

## S3a-8. Convergence Fallback + Alarm

When `_solveCubic` returns `converged: false`:

```javascript
// In prSolve, after cubic:
if (!cubic.converged) {
  this._convergenceAlarms.push({
    id: `pr_cubic_${Date.now()}`,
    category: 'THERMO_CONVERGENCE',
    severity: 'INFO',
    message: `PR cubic: no valid root at T=${T_K.toFixed(1)}K, P=${(P_Pa/1e5).toFixed(1)}bar. Using Z=1 (ideal gas).`,
    source: 'pr_convergence'
  });
}
```

When fugacity K-value falls back to Raoult:
```javascript
this._convergenceAlarms.push({
  id: `pr_vle_${comp}_${Date.now()}`,
  category: 'THERMO_CONVERGENCE',
  severity: 'INFO',
  message: `VLE: single PR root at T=${T_K.toFixed(1)}K — using Raoult K for ${comp}.`,
  source: 'pr_convergence'
});
```

Register alarm source:
```javascript
AlarmSystem.register('thermo_convergence', (scene) => {
  const alarms = [...pengRobinsonPkg._convergenceAlarms];
  pengRobinsonPkg._convergenceAlarms = [];  // drain per tick
  return alarms;
});
```

---

## S3a Tests (~8)

| # | Test | Expected | Assert |
|---|------|----------|--------|
| 1 | Pure N₂: Z(300K, 50bar) | ≈ 0.98 (near ideal) | abs(Z_vap − 0.98) < 0.02 |
| 2 | Pure CO₂: Z(300K, 70bar) | ≈ 0.3 (liquid-like, supercritical) | Z_vap < 0.5 |
| 3 | H₂ quantum guard: α at 300K | α ≈ 0 (T >> 2×Tc=66K) | alpha === 0 |
| 4 | Pure H₂O: bubble P at 373K | ≈ 1 atm (101,325 Pa) | abs(P_bubble − 101325) < 5000 |
| 5 | Binary N₂/O₂: K-values at 90K, 1 bar | K_N₂ > 1, K_O₂ < 1 (N₂ more volatile) | K_N2 > K_O2 |
| 6 | k_ij symmetry | k_ij('H2O','CO2') === k_ij('CO2','H2O') | symmetric for all 13 pairs |
| 7 | Cubic failure → fallback | T=1K, P=1e9 Pa (extreme) | Z_vap = 1.0, converged = false |
| 8 | VLE fallback | Single-root conditions → Raoult K + alarm | alarm source fires |

**Gate:** All S2 tests (328) + 8 new pass.

---

# S3b — PR Integration (Departures + UI)

**Session:** 1.
**Depends on:** S3a.

## S3b-1. Enthalpy Departure

```javascript
/**
 * Enthalpy departure H_dep [J/mol] for a mixture.
 * H(T,P) = H_ig(T) + H_dep(T,P)
 *
 * H_dep = RT(Z−1) + [T·(da_mix/dT) − a_mix] / (2√2·b_mix)
 *         × ln[(Z + (1+√2)B) / (Z + (1−√2)B)]
 */
enthalpyDeparture(T_K, P_Pa, Z, prResult) {
  const R = PengRobinsonPackage.R;
  const S2 = Math.SQRT2;
  const { a_mix, b_mix, da_mix_dT, B } = prResult;

  if (b_mix < 1e-30) return 0;  // no PR correction (pure quantum gas)

  const logArg = (Z + (1 + S2) * B) / (Z + (1 - S2) * B);
  const lnTerm = Math.log(Math.max(logArg, 1e-30));

  return R * T_K * (Z - 1)
    + (T_K * da_mix_dT - a_mix) / (2 * S2 * b_mix) * lnTerm;
}
```

**ThermoAdapter proxy:** `enthalpyDeparture(T, P, Z, prResult)`.

---

## S3b-2. Entropy Departure

```javascript
/**
 * Entropy departure S_dep [J/(mol·K)] for a mixture.
 * S(T,P) = S_ig(T,P) + S_dep(T,P)
 *
 * S_dep = R·ln(Z−B) + (da_mix/dT) / (2√2·b_mix)
 *         × ln[(Z + (1+√2)B) / (Z + (1−√2)B)]
 */
entropyDeparture(T_K, P_Pa, Z, prResult) {
  const R = PengRobinsonPackage.R;
  const S2 = Math.SQRT2;
  const { b_mix, da_mix_dT, B } = prResult;

  if (b_mix < 1e-30) return 0;

  const logArg = (Z + (1 + S2) * B) / (Z + (1 - S2) * B);
  const lnTerm = Math.log(Math.max(logArg, 1e-30));

  return R * Math.log(Math.max(Z - B, 1e-30))
    + da_mix_dT / (2 * S2 * b_mix) * lnTerm;
}
```

**ThermoAdapter proxy:** `entropyDeparture(T, P, Z, prResult)`.

---

## S3b-3. Enhanced hMolar (H_ig + H_dep)

Override `hMolar` in `PengRobinsonPackage`:

```javascript
hMolar(comp, T_K, P_Pa, phaseHint = null) {
  // Ideal gas contribution (existing Shomate integration)
  const H_ig = super.hMolar(comp, T_K, P_Pa, 'V');

  // For liquid phase: H_ig(gas) + H_dep(liquid root)
  // For vapor phase: H_ig(gas) + H_dep(vapor root)
  const composition = { [comp]: 1.0 };
  const pr = this.prSolve(T_K, P_Pa, composition);
  if (!pr.converged) return H_ig;  // fallback

  const Z = (phaseHint === 'L' && pr.Z_liq) ? pr.Z_liq : pr.Z_vap;
  const H_dep = this.enthalpyDeparture(T_K, P_Pa, Z, pr);

  return H_ig + H_dep;
}
```

This is what makes JT cooling work: H_dep varies with P, so isenthalpic
expansion (valve: H_out = H_in, P_out < P_in) requires T to change.

---

## S3b-4. Liquid Density

Override `density` in `PengRobinsonPackage`:

```javascript
density(comp, T_K, P_Pa, phase = 'L') {
  const composition = { [comp]: 1.0 };
  const pr = this.prSolve(T_K, P_Pa, composition);

  if (!pr.converged) return super.density(comp, T_K, P_Pa, phase);

  const Z = (phase === 'L' && pr.Z_liq) ? pr.Z_liq : pr.Z_vap;
  const cd = ComponentRegistry.get(comp);
  const R = PengRobinsonPackage.R;

  // ρ = P·MW / (Z·R·T)  → kg/m³
  return P_Pa * (cd.MW / 1000) / (Z * R * T_K);
}
```

Replaces constant `rhoLiq` from ComponentRegistry when PR is active.

---

## S3b-5. Bubble/Dew Point Iteration

```javascript
/**
 * Find bubble pressure at given T, liquid composition x.
 * Σ(K_i × x_i) = 1 at bubble point.
 * Bisection on P, using fugacity K-values.
 */
bubblePressure(T_K, x) {
  // Initial estimate from Raoult
  let P_est = 0;
  for (const [comp, xi] of Object.entries(x)) {
    const Psat = super.saturationPressure(comp, T_K);
    if (Psat) P_est += xi * Psat;
  }
  if (P_est <= 0) P_est = 101325;

  let P_lo = P_est * 0.1, P_hi = P_est * 10;

  for (let iter = 0; iter < 30; iter++) {
    const P_mid = (P_lo + P_hi) / 2;
    let sumKx = 0;
    for (const [comp, xi] of Object.entries(x)) {
      sumKx += this.kValue(comp, T_K, P_mid, x) * xi;
    }
    if (Math.abs(sumKx - 1) < 1e-6) return P_mid;
    if (sumKx > 1) P_lo = P_mid; else P_hi = P_mid;
  }

  return null;  // failed to converge
}

/**
 * Find dew pressure at given T, vapor composition y.
 * Σ(y_i / K_i) = 1 at dew point.
 */
dewPressure(T_K, y) {
  let P_est = 0;
  for (const [comp, yi] of Object.entries(y)) {
    const Psat = super.saturationPressure(comp, T_K);
    if (Psat) P_est += yi / (Psat > 0 ? Psat : 101325);
  }
  P_est = P_est > 0 ? 1 / P_est : 101325;

  let P_lo = P_est * 0.1, P_hi = P_est * 10;

  for (let iter = 0; iter < 30; iter++) {
    const P_mid = (P_lo + P_hi) / 2;
    let sumYoverK = 0;
    for (const [comp, yi] of Object.entries(y)) {
      const K = this.kValue(comp, T_K, P_mid, y);
      sumYoverK += yi / (K > 1e-30 ? K : 1e-30);
    }
    if (Math.abs(sumYoverK - 1) < 1e-6) return P_mid;
    if (sumYoverK > 1) P_hi = P_mid; else P_lo = P_mid;
  }

  return null;
}
```

---

## S3b-6. Compressor Isentropic Work Enhancement

Override `computeCompressorWork` in `PengRobinsonPackage`:

```javascript
computeCompressorWork(inStream, Pout, eta) {
  const R = PengRobinsonPackage.R;
  const nTotal = Object.values(inStream.n).reduce((a, b) => a + b, 0);
  if (nTotal <= 0) return { W_isentropic_W: 0, W_shaft_W: 0, H_target_Jps: 0 };

  // Normalize composition
  const y = {};
  for (const [sp, n] of Object.entries(inStream.n)) y[sp] = n / nTotal;

  // Inlet state
  const pr1 = this.prSolve(inStream.T, inStream.P, y);
  const H1 = this._mixH(inStream.T, inStream.P, pr1.Z_vap, y);
  const S1 = this._mixS(inStream.T, inStream.P, pr1.Z_vap, y);

  // Find T2s by bisection: S(T2s, Pout) = S1
  let T_lo = inStream.T, T_hi = inStream.T * 3;
  let T2s = inStream.T;
  for (let iter = 0; iter < 30; iter++) {
    const T_mid = (T_lo + T_hi) / 2;
    const pr2 = this.prSolve(T_mid, Pout, y);
    const S2 = this._mixS(T_mid, Pout, pr2.Z_vap, y);
    if (Math.abs(S2 - S1) < 0.01) { T2s = T_mid; break; }
    if (S2 < S1) T_hi = T_mid; else T_lo = T_mid;
    T2s = T_mid;
  }

  const pr2s = this.prSolve(T2s, Pout, y);
  const H2s = this._mixH(T2s, Pout, pr2s.Z_vap, y);

  const W_isentropic_W = nTotal * (H2s - H1);  // J/s
  const W_shaft_W = W_isentropic_W / eta;

  const H_in_Jps = nTotal * H1;
  const H_target_Jps = H_in_Jps + W_shaft_W;

  return {
    W_isentropic_W, W_shaft_W, H_in_Jps, H_target_Jps,
    T_isentropic_K: T2s,
    gammaMix: null,  // not applicable for PR
    cpMix: null
  };
}

// Helper: mixture molar enthalpy [J/mol]
_mixH(T_K, P_Pa, Z, y) {
  let H = 0;
  for (const [sp, yi] of Object.entries(y)) {
    H += yi * super.hMolar(sp, T_K, P_Pa, 'V');  // H_ig per species
  }
  const pr = this.prSolve(T_K, P_Pa, y);
  H += this.enthalpyDeparture(T_K, P_Pa, Z, pr);
  return H;
}

// Helper: mixture molar entropy [J/(mol·K)]
_mixS(T_K, P_Pa, Z, y) {
  const R = PengRobinsonPackage.R;
  let S = 0;
  for (const [sp, yi] of Object.entries(y)) {
    // S_ig = ∫Cp/T dT − R·ln(P/P°) + s0
    const cd = ComponentRegistry.get(sp);
    const cpig = cd.cpig;
    // Numerical integration of Cp/T (trapezoidal, 20 steps from 298.15 to T_K)
    S += yi * this._integrateEntropy_ig(sp, T_K);
    S -= yi * R * Math.log(P_Pa / 1e5);  // pressure contribution
  }
  // Mixing entropy
  for (const [sp, yi] of Object.entries(y)) {
    if (yi > 1e-30) S -= yi * R * Math.log(yi);
  }
  const pr = this.prSolve(T_K, P_Pa, y);
  S += this.entropyDeparture(T_K, P_Pa, Z, pr);
  return S;
}
```

Similarly override `computeTurbineWork` and `computePumpWork`.

---

## S3b-7. Package Selector

**UI toggle:** Add to SimSettings or Models panel:

```javascript
SimSettings.thermoPackage = 'PR';  // default after S3

// Toggle handler:
function setThermoPackage(pkgId) {
  if (pkgId === 'IDEAL') {
    thermo.setPackage(idealRaoultPkg);
  } else {
    thermo.setPackage(pengRobinsonPkg);
  }
  SimSettings.thermoPackage = pkgId;
}
```

Inspector: dropdown or toggle in the Simulation Settings panel.
Both IDEAL and PR selectable. All tests must pass in both modes.

---

## S3b-8. Range-Exceeded Alarm Source

Replace existing `console.warn` calls for out-of-range Shomate/Antoine
evaluations with alarm source:

```javascript
AlarmSystem.register('thermo_range', (scene) => {
  const alarms = [];
  const pkg = thermo.getPackage();
  for (const [key, info] of pkg._rangeExceeded || []) {
    const extrapPct = info.extrapPct;
    let severity = 'INFO';
    if (extrapPct > 50) severity = 'ERROR';
    else if (extrapPct > 20) severity = 'WARNING';

    alarms.push({
      id: `thermo_range_${key}`,
      category: 'THERMO_RANGE',
      severity,
      message: info.message,
      source: 'thermo_range'
    });
  }
  // Drain per tick
  if (pkg._rangeExceeded) pkg._rangeExceeded = new Map();
  return alarms;
});
```

This replaces the existing `_warnedRanges` Set with a more informative
alarm-system-integrated approach. The `console.warn` calls become
`pkg._rangeExceeded.set(key, { message, extrapPct })`.

---

## S3b-9. HEX Error Passthrough Fallback

**File:** `processThis.html`, HEX tick (~line 8766)

**Current:** When `hxSolveApproach` (or any HEX mode solver) returns
`result.error`, the tick writes `u.last = result` and returns
without writing `ports.hot_out` or `ports.cold_out`. Downstream
units receive null inputs and silently stop producing output.

**Problem:** With PR thermodynamics, HEX approach bisection explores
a wider enthalpy landscape (phase-change latent heat). Edge cases
that currently don't trigger errors under ideal-gas Cp may produce
infeasible approach constraints under PR. A hard stop in the HEX
kills the entire downstream chain with no diagnostic trail.

**Fix:** After the error-return block, add passthrough fallback:
```javascript
if (result.error) {
  // Passthrough: inlet → outlet unchanged, flagged degraded
  ports.hot_out = {
    type: StreamType.MATERIAL, T: sHot.T, P: sHot.P,
    n: { ...sHot.n },
    phaseConstraint: sHot.phaseConstraint || 'VL'
  };
  ports.cold_out = {
    type: StreamType.MATERIAL, T: sCold.T, P: sCold.P,
    n: { ...sCold.n },
    phaseConstraint: sCold.phaseConstraint || 'VL'
  };
  u.last = {
    ...result,
    status: 'degraded',
    Q: 0, hxDuty_W: 0,
    T_hot_in: sHot.T, T_hot_out: sHot.T,
    T_cold_in: sCold.T, T_cold_out: sCold.T
  };
  return;
}
```

**Rationale:** Downstream units always receive valid streams.
The `status: 'degraded'` field (and the existing error object)
give the alarm system and game layer a clear signal. The solver
can still converge the rest of the flowsheet. No heat is transferred
— the player sees "HEX not operating" rather than a broken chain.

**Risk:** None. The error path currently produces no output at all;
passthrough is strictly more informative. Zero duty is physically
conservative (no energy created).

---

## S3b Tests (~7)

| # | Test | Expected | Assert |
|---|------|----------|--------|
| 1 | H_dep: CO₂ at 300K/70bar | ≠ 0 (non-ideal) | abs(H_dep) > 100 J/mol |
| 2 | JT cooling: NH₃ valve 20→2 bar | T_out < T_in | T_out < T_in − 5 |
| 3 | S_dep: isentropic compression T2s | T2s_PR > T2s_ideal (more work) | T2s_PR > T2s_ideal |
| 4 | Liquid density: H₂O at 300K/1bar | ≈ 55,500 mol/m³ (55.5 mol/L) | abs(ρ/MW − 55500) < 2000 |
| 5 | Package toggle: IDEAL mode | Same results as pre-S3 | All baseline values match ±0.1% |
| 6 | Range alarm: H₂O Cp at 250K | INFO in AlarmSystem | alarm.severity === 'INFO' |
| 7 | **Full regression: both packages** | All S1+S2 tests pass | 336 tests pass in IDEAL, 336 in PR |

**Gate:** All previous (336) + 7 new pass. Full regression in both IDEAL and PR mode.

---

## Implementation Checklist

```
S3a session 1 (cubic + mixing):
  [ ] _pureParams() with quantum gas guard (H₂, He)
  [ ] k_ij table (13 pairs, symmetric)
  [ ] _mixParams() (a_mix, b_mix, da_mix/dT)
  [ ] _solveCubic() (Cardano + Newton polish)
  [ ] prSolve() top-level
  [ ] ThermoAdapter proxy: .prSolve()

S3a session 2 (fugacity + K-values):
  [ ] fugacityCoeff() (ln φ_i for V and L roots)
  [ ] kValue() override (K_i = φ_L/φ_V, Raoult fallback)
  [ ] ThermoAdapter proxy: .fugacityCoeff()
  [ ] _convergenceAlarms array + drain
  [ ] AlarmSystem.register('thermo_convergence', ...)
  [ ] 8 tests passing

S3b session (departures + integration):
  [ ] enthalpyDeparture() (H_dep from PR)
  [ ] entropyDeparture() (S_dep from PR)
  [ ] hMolar() override (H_ig + H_dep)
  [ ] density() override (ρ from Z_liq)
  [ ] bubblePressure() / dewPressure() (bisection)
  [ ] computeCompressorWork() override (entropy-matched T₂s)
  [ ] computeTurbineWork() override (same pattern)
  [ ] _mixH(), _mixS(), _integrateEntropy_ig() helpers
  [ ] Package selector: SimSettings.thermoPackage toggle
  [ ] Range-exceeded alarm source
  [ ] HEX error passthrough fallback (S3b-9, ~line 8766)
  [ ] 7 tests passing
  [ ] Full regression in BOTH packages

Total S3: ~15 new tests → 343 cumulative
```

---

## What S3 Enables Downstream

| Consumer | What it uses from S3 |
|----------|---------------------|
| S4a (Distillation) | Fugacity K-values for meaningful α in Fenske equation |
| S4b (HEX/Refrig) | JT cooling through H_dep; phase-change HEX accuracy |
| S5a (Pressure) | PR liquid density for tank headspace P computation |
| S7 (Perf Maps) | VP envelopes from PR Psat; reactor conversion vs T×P |
| S8 (Game) | All missions benefit from realistic thermodynamics |
