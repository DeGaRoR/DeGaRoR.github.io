# PTIS_S4_SPEC
## S4 — Process Operations
### processThis v13.3.0 → v13.4.0 (post-S3)

---

## Overview

**What:** Three deliverables: (1) shortcut distillation column as new
unit type using Fenske-Underwood-Gilliland method, (2) HEX UA/NTU
effective-Cp fix for phase-changing streams, (3) refrigeration loop
verification test suite.

**Sub-sessions:** S4a (2), S4b (1) — 3 sessions total.

**Risk:** Medium. FUG method is well-defined but involves multiple
sequential calculations. HEX fix is small. Refrigeration tests are
integration-level and may expose convergence issues.

**Dependencies:** S3 (PR K-values for meaningful relative volatility;
PR enthalpy departures for JT cooling in refrigeration tests).

**Parallel with:** S5 (no dependency between S4 and S5).

**Baseline state (post-S3):**
- `flash_drum` is the only separator (line 9054)
- `hex` supports three modes: setpoint, UA/NTU, approach (line 8719)
- `hxSolveUaNtu` uses `streamCp` which returns sensible-only Cp (line 8510)
- PR EOS provides fugacity K-values, H_dep, S_dep
- 21 registered unit types (no distillation column)

**After S4:**
- 22 unit types (+distillation_column)
- HEX UA/NTU correct for condensing/evaporating service
- Refrigeration loops verified end-to-end
- ~355 tests (343 + 12 new)

---

# S4a — Distillation Column

**Sessions:** 2 (unit registration + FUG core, then energy balance + diagnostics).

## S4a-1. Unit Registration

**Insert location:** After flash_drum registration (after line ~9132),
within the SEPARATOR section.

```javascript
// ═══════════════════════════════════════════════════════════════════════════════
// DISTILLATION COLUMN — Shortcut FUG Method [v13.4.0]
// ═══════════════════════════════════════════════════════════════════════════════
// Fenske-Underwood-Gilliland shortcut distillation.
// Computes product splits from relative volatility (K-values from thermo).
// Two product streams: distillate (light) and bottoms (heavy).
// Electrical power input drives the reboiler.
// Condenser heat is output as electrical (recoverable, or dump).
UnitRegistry.register('distillation_column', {
  name: 'Distillation Column',
  category: UnitCategories.SEPARATOR,
  w: 2,
  h: 3,
  ports: [
    { portId: 'mat_in',    dir: PortDir.IN,  type: StreamType.MATERIAL,   x: 0, y: 1 },
    { portId: 'elec_in',   dir: PortDir.IN,  type: StreamType.ELECTRICAL, x: 1, y: 0 },
    { portId: 'mat_out_D', dir: PortDir.OUT, type: StreamType.MATERIAL,   x: 2, y: 0 },
    { portId: 'mat_out_B', dir: PortDir.OUT, type: StreamType.MATERIAL,   x: 2, y: 2 },
    { portId: 'elec_surplus', dir: PortDir.OUT, type: StreamType.ELECTRICAL, x: 1, y: 3 }
  ],
  presentations: {
    'box/default': { w: 2, h: 3, ports: {
      mat_in:{x:0,y:1.5}, elec_in:{x:1,y:0}, mat_out_D:{x:2,y:0.5},
      mat_out_B:{x:2,y:2.5}, elec_surplus:{x:1,y:3}
    }}
  },
  // ... tick function defined in S4a-5
});
```

**Port notes:**
- `elec_in`: Reboiler power supply. Column demands Q_R.
- `elec_surplus`: Condenser heat output. Connected to a dump load or
  recovered via another HEX. Uses ELECTRICAL stream type because
  HEAT streams were deleted in v12.6.0 — this is consistent with
  how the hub surplus port works.

---

## S4a-2. Parameters and initParams

```javascript
// In initParams switch:
case 'distillation_column':
  unit.params = {
    N_stages: 20,
    R_over_Rmin: 1.3,
    feed_stage_frac: 0.5,
    P_column_bar: 1.0,
    lightKey: '',
    heavyKey: '',
    xD_lightKey: 0.95,
    xB_heavyKey: 0.95,
    powerPriority: 2  // NORMAL (S2 convention)
  };
  break;
```

| Parameter | Default | Min | Max | Notes |
|-----------|---------|-----|-----|-------|
| N_stages | 20 | 3 | 100 | Theoretical stages |
| R_over_Rmin | 1.3 | 1.05 | 5.0 | Operating reflux / minimum reflux |
| feed_stage_frac | 0.5 | 0.1 | 0.9 | Feed location (0 = top, 1 = bottom) |
| P_column_bar | 1.0 | 0.1 | 50 | Operating pressure (bar) |
| lightKey | '' | — | — | Light key species ID (enum from feed) |
| heavyKey | '' | — | — | Heavy key species ID (enum from feed) |
| xD_lightKey | 0.95 | 0.50 | 0.999 | Desired purity of LK in distillate |
| xB_heavyKey | 0.95 | 0.50 | 0.999 | Desired purity of HK in bottoms |

---

## S4a-3. FUG Method — Pure Functions

All FUG calculations are pure functions, testable independently.

### Fenske: Minimum Stages

```javascript
/**
 * Fenske equation — minimum stages at total reflux.
 * @param {number} xD_LK - LK mole fraction in distillate
 * @param {number} xD_HK - HK mole fraction in distillate (= 1 − xD_LK for binary)
 * @param {number} xB_LK - LK mole fraction in bottoms (= 1 − xB_HK)
 * @param {number} xB_HK - HK mole fraction in bottoms
 * @param {number} alpha_LK - Relative volatility of LK w.r.t. HK
 * @returns {number} N_min (minimum theoretical stages)
 */
function fenskeNmin(xD_LK, xD_HK, xB_LK, xB_HK, alpha_LK) {
  if (alpha_LK <= 1.001) return Infinity;  // no separation possible
  return Math.log((xD_LK / xD_HK) * (xB_HK / xB_LK)) / Math.log(alpha_LK);
}
```

### Non-Key Distribution (Fenske)

```javascript
/**
 * Distribute non-key components at total reflux.
 * (d_i / b_i) = (d_LK / b_LK) × α_i^N_min
 *
 * @param {Object} z_feed - { species: moleFraction } in feed
 * @param {Object} alphas - { species: relativeVolatility }
 * @param {number} N_min
 * @param {string} LK, HK
 * @param {number} xD_LK, xB_HK - key purities
 * @returns {{ d: {species: mol/s}, b: {species: mol/s} }}
 */
function fenskeDistribution(z_feed, F_total, alphas, N_min, LK, HK, xD_LK, xB_HK) {
  const d = {}, b = {};

  // Key component material balance
  const z_LK = z_feed[LK] || 0;
  const z_HK = z_feed[HK] || 0;

  // From purity specs and feed composition:
  // d_LK = xD_LK × D,  b_HK = xB_HK × B
  // F × z_LK = d_LK + b_LK,  F × z_HK = d_HK + b_HK
  // D + B = F (overall)
  // Solve for D, B from key component balances:
  const F = F_total;
  const D = F * (z_LK * xB_HK + z_HK * (xD_LK - 1))
          / (xD_LK * xB_HK - (1 - xD_LK) * (1 - xB_HK));
  const B = F - D;

  if (D <= 0 || B <= 0) {
    // Infeasible split
    return { d: { ...z_feed }, b: {}, D: F, B: 0, feasible: false };
  }

  d[LK] = xD_LK * D;
  b[LK] = F * z_LK - d[LK];
  d[HK] = (1 - xB_HK) * B;  // HK leaking to distillate
  b[HK] = xB_HK * B;

  // Non-keys: use Fenske distribution ratio
  const dLK_over_bLK = d[LK] / Math.max(b[LK], 1e-30);

  for (const [sp, zi] of Object.entries(z_feed)) {
    if (sp === LK || sp === HK) continue;
    const alpha_i = alphas[sp] || 1.0;
    const ratio = dLK_over_bLK * Math.pow(alpha_i, N_min);
    const f_i = F * zi;
    d[sp] = f_i * ratio / (1 + ratio);
    b[sp] = f_i - d[sp];
  }

  return { d, b, D, B, feasible: true };
}
```

### Underwood: Minimum Reflux

```javascript
/**
 * Underwood equation — minimum reflux ratio.
 * Finds θ root from: Σ[α_i × z_i / (α_i − θ)] = 1 − q
 * Then: R_min = Σ[α_i × xD_i / (α_i − θ)] − 1
 *
 * @param {Object} z_feed - feed mole fractions
 * @param {Object} x_D    - distillate mole fractions
 * @param {Object} alphas  - relative volatilities
 * @param {number} q       - feed thermal condition (1=sat liq, 0=sat vap)
 * @returns {{ theta, R_min }}
 */
function underwoodRmin(z_feed, x_D, alphas, q) {
  const species = Object.keys(z_feed);
  const alpha_vals = species.map(sp => alphas[sp] || 1.0);
  const z_vals = species.map(sp => z_feed[sp] || 0);
  const xD_vals = species.map(sp => x_D[sp] || 0);

  // Find θ by bisection: f(θ) = Σ[α_i z_i / (α_i − θ)] − (1 − q) = 0
  // θ lies between α_HK and α_LK (both > 0)
  const alpha_sorted = [...alpha_vals].sort((a, b) => a - b);
  let lo = alpha_sorted[0] + 0.001;
  let hi = alpha_sorted[alpha_sorted.length - 1] - 0.001;
  if (lo >= hi) lo = 0.5;

  let theta = (lo + hi) / 2;
  for (let iter = 0; iter < 50; iter++) {
    theta = (lo + hi) / 2;
    let sum = 0;
    for (let i = 0; i < species.length; i++) {
      const denom = alpha_vals[i] - theta;
      if (Math.abs(denom) < 1e-10) { sum += 1e10 * Math.sign(z_vals[i]); continue; }
      sum += alpha_vals[i] * z_vals[i] / denom;
    }
    const target = 1 - q;
    if (Math.abs(sum - target) < 1e-6) break;
    if (sum > target) lo = theta; else hi = theta;
  }

  // R_min from second Underwood equation
  let R_min = -1;
  for (let i = 0; i < species.length; i++) {
    const denom = alpha_vals[i] - theta;
    if (Math.abs(denom) < 1e-10) continue;
    R_min += alpha_vals[i] * xD_vals[i] / denom;
  }

  return { theta, R_min: Math.max(0, R_min) };
}
```

### Gilliland: Actual Stages

```javascript
/**
 * Gilliland correlation (Molokanov form).
 * Given N_min and R_min, compute actual stages N.
 *
 * @param {number} N_min - Fenske minimum stages
 * @param {number} R_min - Underwood minimum reflux
 * @param {number} R     - Actual reflux ratio
 * @returns {number} N_actual (theoretical stages needed)
 */
function gillilandStages(N_min, R_min, R) {
  if (R <= R_min) return Infinity;  // below minimum reflux
  const X = (R - R_min) / (R + 1);
  if (X <= 0 || X >= 1) return N_min * 2;  // fallback

  const Y = 1 - Math.exp(
    ((1 + 54.4 * X) / (11 + 117.2 * X)) * ((X - 1) / Math.sqrt(X))
  );

  if (Y >= 1 || Y < 0) return N_min * 2;
  return (N_min + Y) / (1 - Y);
}
```

---

## S4a-4. Feed Thermal Condition

```javascript
/**
 * Compute feed thermal condition q.
 * q = 1.0 for saturated liquid, 0.0 for saturated vapor.
 * q = (H_sat_vap − H_feed) / (H_sat_vap − H_sat_liq)
 */
function feedThermalCondition(stream, P_col_Pa) {
  const nTotal = Object.values(stream.n).reduce((a, b) => a + b, 0);
  if (nTotal <= 0) return 1.0;

  // Normalize to mole fractions
  const z = {};
  for (const [sp, n] of Object.entries(stream.n)) z[sp] = n / nTotal;

  // Estimate bubble and dew temperatures at column pressure
  // (using thermo package — PR or ideal)
  const H_feed = thermo.getHdot_Jps(stream) / nTotal;  // J/mol

  // Saturated liquid: compute enthalpy at bubble T
  // Saturated vapor: compute enthalpy at dew T
  // Approximate: use feed T as estimate, compute H at both phase constraints
  const H_liq = thermo.hMolar_mix(z, stream.T, P_col_Pa, 'L');
  const H_vap = thermo.hMolar_mix(z, stream.T, P_col_Pa, 'V');

  if (Math.abs(H_vap - H_liq) < 1) return 1.0;  // no phase change
  const q = (H_vap - H_feed) / (H_vap - H_liq);
  return Math.max(0, Math.min(1.5, q));  // allow subcooled (q > 1)
}
```

**Note:** `thermo.hMolar_mix` is a new helper that computes mixture molar
enthalpy — Σ(y_i × h_i) using the active package. This is a small addition
to ThermoAdapter (~5 lines), wrapping existing per-species `hMolar` calls.

---

## S4a-5. Tick Function

```javascript
tick(u, ports, par, ctx) {
  // Fry guard (S2)
  if (u.fried) { /* standard fry return */ return; }

  const sIn = ports.mat_in;
  if (!sIn) return;

  const P_col = (par.P_column_bar ?? 1.0) * 1e5;
  const LK = par.lightKey;
  const HK = par.heavyKey;

  // ── Validation ──
  const nTotal = Object.values(sIn.n).reduce((a, b) => a + b, 0);
  if (nTotal < 1e-15) {
    u.last = { error: { severity: ErrorSeverity.MAJOR, message: 'Empty feed' } };
    return;
  }

  const species = Object.keys(sIn.n).filter(sp => sIn.n[sp] > 1e-15);
  if (species.length < 2) {
    u.last = { error: { severity: ErrorSeverity.MAJOR,
      message: 'Feed is single-component — distillation requires at least two species.' } };
    return;
  }

  if (!LK || !HK || !sIn.n[LK] || !sIn.n[HK]) {
    u.last = { error: { severity: ErrorSeverity.MAJOR,
      message: `No ${!LK ? 'light' : 'heavy'} key ${!LK ? '' : `(${HK})`} in feed. Set key species in inspector.` } };
    return;
  }

  // ── K-values and relative volatility ──
  const z = {};
  for (const sp of species) z[sp] = sIn.n[sp] / nTotal;

  const K = {};
  for (const sp of species) {
    K[sp] = thermo.kValue(sp, sIn.T, P_col, z);
  }
  const K_HK = K[HK] || 1e-10;
  const alphas = {};
  for (const sp of species) {
    alphas[sp] = K[sp] / K_HK;
  }

  const alpha_LK = alphas[LK];
  if (alpha_LK < 1.05) {
    u.last = { error: { severity: ErrorSeverity.WARNING,
      message: `α(${LK}/${HK}) = ${alpha_LK.toFixed(2)} — separation very difficult. Try different pressure or keys.` } };
  }

  // ── FUG calculations ──
  const xD_LK = par.xD_lightKey ?? 0.95;
  const xB_HK = par.xB_heavyKey ?? 0.95;
  const xD_HK = 1 - xD_LK;  // simplified binary assumption for key balance
  const xB_LK = 1 - xB_HK;

  const N_min = fenskeNmin(xD_LK, xD_HK, xB_LK, xB_HK, alpha_LK);
  const dist = fenskeDistribution(z, nTotal, alphas, N_min, LK, HK, xD_LK, xB_HK);

  if (!dist.feasible) {
    u.last = { error: { severity: ErrorSeverity.MAJOR,
      message: 'Infeasible separation — check purity specs vs feed composition.' } };
    return;
  }

  // Distillate composition (mole fractions)
  const x_D = {};
  for (const sp of species) x_D[sp] = (dist.d[sp] || 0) / dist.D;

  const q = feedThermalCondition(sIn, P_col);
  const uw = underwoodRmin(z, x_D, alphas, q);
  const R = (par.R_over_Rmin ?? 1.3) * uw.R_min;
  const N_actual = gillilandStages(N_min, uw.R_min, R);

  // ── Column sizing check ──
  const N_user = par.N_stages ?? 20;
  const undersized = N_actual > N_user;
  if (undersized) {
    u.last = u.last || {};
    u.last.warning = {
      severity: ErrorSeverity.WARNING,
      message: `Column has ${N_user} stages but ${N_actual.toFixed(0)} needed. Increase stages, reduce purity, or adjust R/R_min.`
    };
  }

  // ── Energy balance ──
  const H_D_vap = thermo.hMolar_mix(x_D, sIn.T, P_col, 'V');
  const H_D_liq = thermo.hMolar_mix(x_D, sIn.T, P_col, 'L');
  const lambda = H_D_vap - H_D_liq;  // J/mol (latent heat at distillate composition)

  const Q_condenser_W = R * dist.D * lambda;       // W (condenser duty)
  const H_in = thermo.getHdot_Jps(sIn);            // W (feed enthalpy flow)
  const H_D_out = dist.D * H_D_liq;                // W (distillate enthalpy)
  const x_B = {};
  for (const sp of species) x_B[sp] = (dist.b[sp] || 0) / Math.max(dist.B, 1e-30);
  const H_B_liq = thermo.hMolar_mix(x_B, sIn.T, P_col, 'L');
  const H_B_out = dist.B * H_B_liq;                // W (bottoms enthalpy)
  const Q_reboiler_W = Q_condenser_W + H_D_out + H_B_out - H_in;

  // ── Power demand / allocation ──
  u.powerDemand = Math.max(0, Q_reboiler_W);

  const sElec = ports.elec_in;
  const s = ctx ? ctx.scratch : {};
  const W_avail = s.hubAllocated_W ?? (sElec?.actual ?? sElec?.available ?? 0);

  // Overload check (S2)
  const overloadInfo = checkOverload(W_avail, u.powerDemand, u);
  if (u.fried) return;

  // Power-limited separation
  let separationFactor = 1.0;
  if (Q_reboiler_W > 0 && W_avail < Q_reboiler_W - 1) {
    separationFactor = W_avail / Q_reboiler_W;
  }

  // ── Output streams ──
  // Scale product splits by separationFactor (partial separation if power-limited)
  const d_actual = {}, b_actual = {};
  for (const sp of species) {
    const d_full = dist.d[sp] || 0;
    const b_full = dist.b[sp] || 0;
    d_actual[sp] = z[sp] * nTotal * (1 - separationFactor) + d_full * separationFactor;
    b_actual[sp] = z[sp] * nTotal * (1 - separationFactor) + b_full * separationFactor;
    // Ensure mass balance: if power = 0, both streams = feed composition
  }

  // Distillate outlet (PH-flash resolves T and phase)
  ports.mat_out_D = {
    type: StreamType.MATERIAL,
    P: P_col,
    n: d_actual,
    phaseConstraint: 'VL',
    H_target_Jps: dist.D * H_D_liq * separationFactor
      + (1 - separationFactor) * H_in * (dist.D / nTotal)
  };

  // Bottoms outlet
  ports.mat_out_B = {
    type: StreamType.MATERIAL,
    P: P_col,
    n: b_actual,
    phaseConstraint: 'VL',
    H_target_Jps: dist.B * H_B_liq * separationFactor
      + (1 - separationFactor) * H_in * (dist.B / nTotal)
  };

  // Condenser duty on surplus port
  if (ports.elec_surplus) {
    const Q_C_actual = Q_condenser_W * separationFactor;
    ports.elec_surplus = {
      type: StreamType.ELECTRICAL,
      capacity: Q_C_actual,
      actual: Q_C_actual,
      available: Q_C_actual
    };
  }

  // ── Diagnostics ──
  u.last = {
    N_min: N_min,
    N_actual: N_actual,
    N_stages: N_user,
    undersized,
    R_min: uw.R_min,
    R: R,
    theta: uw.theta,
    q: q,
    alpha_LK: alpha_LK,
    Q_reboiler_kW: Q_reboiler_W / 1000,
    Q_condenser_kW: Q_condenser_W / 1000,
    Q_reboiler_actual_kW: (W_avail / 1000),
    separationFactor,
    D_molps: dist.D,
    B_molps: dist.B,
    LK, HK,
    ...overloadInfo
  };
}
```

---

## S4a-6. Inspector

```javascript
UnitInspector.distillation_column = {
  params(u) {
    const sIn = /* find feed stream */;
    const feedSpecies = sIn ? Object.keys(sIn.n).filter(sp => sIn.n[sp] > 1e-15) : [];

    return [
      { label: 'Theoretical stages', get: () => u.params.N_stages ?? 20,
        set: v => u.params.N_stages = Math.max(3, Math.min(100, Math.round(v))),
        step: 1, decimals: 0 },
      { label: 'R / R_min', get: () => u.params.R_over_Rmin ?? 1.3,
        set: v => u.params.R_over_Rmin = Math.max(1.05, Math.min(5, v)),
        step: 0.05, decimals: 2 },
      { label: 'Column P (bar)', get: () => u.params.P_column_bar ?? 1.0,
        set: v => u.params.P_column_bar = Math.max(0.1, Math.min(50, v)),
        step: 0.5, decimals: 1 },
      { label: 'Light key', type: 'select',
        options: feedSpecies, get: () => u.params.lightKey,
        set: v => u.params.lightKey = v },
      { label: 'Heavy key', type: 'select',
        options: feedSpecies, get: () => u.params.heavyKey,
        set: v => u.params.heavyKey = v },
      { label: 'LK purity in distillate', get: () => u.params.xD_lightKey ?? 0.95,
        set: v => u.params.xD_lightKey = Math.max(0.5, Math.min(0.999, v)),
        step: 0.01, decimals: 3 },
      { label: 'HK purity in bottoms', get: () => u.params.xB_heavyKey ?? 0.95,
        set: v => u.params.xB_heavyKey = Math.max(0.5, Math.min(0.999, v)),
        step: 0.01, decimals: 3 }
    ];
  },
  kpis(u, ud) {
    if (!ud?.last?.alpha_LK) return [];
    return [
      { label: 'α (LK/HK)', value: ud.last.alpha_LK.toFixed(2) },
      { label: 'N_min / N_actual', value: `${ud.last.N_min?.toFixed(1)} / ${ud.last.N_actual?.toFixed(1)}` },
      { label: 'R_min / R', value: `${ud.last.R_min?.toFixed(2)} / ${ud.last.R?.toFixed(2)}` },
      { label: 'q (feed)', value: ud.last.q?.toFixed(2) },
      { label: 'Separation', value: `${(ud.last.separationFactor * 100).toFixed(0)}%`,
        tone: ud.last.separationFactor < 1 ? 'warn' : '' }
    ];
  },
  power(u, ud) {
    if (!ud?.last) return [];
    return [
      { label: 'Q reboiler', value: fmt.kW(ud.last.Q_reboiler_kW * 1000) },
      { label: 'Q condenser', value: fmt.kW(ud.last.Q_condenser_kW * 1000) },
      { label: 'Q supplied', value: fmt.kW(ud.last.Q_reboiler_actual_kW * 1000),
        tone: ud.last.separationFactor < 1 ? 'warn' : '' }
    ];
  }
};
```

---

## S4a-7. Limit Parameters

Add to unit definition:

```javascript
limitParams: ['T', 'P', 'mass'],
limits: {
  S: {
    T_LL: 73,  T_L: 100, T_H: 473, T_HH: 523,   // K (cryogenic to moderate)
    P_LL: 0.05e5, P_HH: 50e5,                      // 0.05–50 bar
    mass_HH: 0.15                                    // kg/s
  }
}
```

Wide T range to accommodate cryogenic air separation (77 K) and
higher-pressure distillation.

---

# S4b — HEX Fix + Refrigeration Verification

**Session:** 1.

## S4b-1. HEX UA/NTU Effective-Cp Fix

**Problem:** `hxCapacityRates()` (line 8509) computes `C = streamCp()`
which returns sensible-only Cp. Phase-changing streams have effective
Cp → ∞ because latent heat dominates, but `streamCp` doesn't capture
this. Result: NTU underpredicted, ε underpredicted, Q too low.

**Fix location:** `hxCapacityRates()` function (line 8509).

**Current code (~6 lines):**
```javascript
function hxCapacityRates(sHot, sCold) {
  const C_hot  = thermo.streamCp(sHot);
  const C_cold = thermo.streamCp(sCold);
  const Cmin   = Math.min(C_hot, C_cold);
  const Cmax   = Math.max(C_hot, C_cold);
  const Cr     = Cmax > 1e-12 ? Cmin / Cmax : 0;
  return { C_hot, C_cold, Cmin, Cmax, Cr };
}
```

**Replace with (~20 lines):**
```javascript
function hxCapacityRates(sHot, sCold) {
  // Effective Cp: for phase-changing streams, use Q_max / ΔT
  // which captures latent heat. For single-phase, falls back to streamCp.
  const C_hot  = _effectiveCp(sHot, sCold.T, 'hot');
  const C_cold = _effectiveCp(sCold, sHot.T, 'cold');
  const Cmin   = Math.min(C_hot, C_cold);
  const Cmax   = Math.max(C_hot, C_cold);
  const Cr     = Cmax > 1e-12 ? Cmin / Cmax : 0;
  return { C_hot, C_cold, Cmin, Cmax, Cr };
}

/**
 * Effective heat capacity rate [W/K] including latent heat.
 * For isothermal phase change (ΔT < 1K), returns 1e12 (infinite Cp).
 */
function _effectiveCp(stream, T_other, role) {
  const H_in = thermo.getHdot_Jps(stream);
  // Target T: the other stream's inlet T (maximum possible heat exchange)
  const T_target = role === 'hot'
    ? Math.max(T_other, stream.T - 200)  // hot side cools toward cold inlet
    : Math.min(T_other, stream.T + 200); // cold side heats toward hot inlet
  const H_target = hxEnthalpy(stream, T_target);
  const deltaT = Math.abs(stream.T - T_target);
  const deltaH = Math.abs(H_in - H_target);

  if (deltaT < 1.0) {
    return 1e12;  // isothermal phase change — not the limiting stream
  }
  return deltaH / deltaT;
}
```

**Impact:** Only affects UA/NTU mode. Approach mode and setpoint mode
use PH-flash directly and are already phase-change-safe. Existing
air_cooler uses this same `hxCapacityRates` function, so it also
benefits from the fix.

---

## S4b-2. Refrigeration Loop Tests

No new code — these verify that existing units (valve, HEX, compressor)
work together with PR EOS for refrigeration cycles.

### Test A: NH₃ JT Cooling

```
Setup: source(NH₃, 40°C, 20 bar, 0.1 mol/s) → valve(P_out=2 bar) → sink
Expected: T_out ≈ −33°C (240 K, saturation at 2 bar)
Assert: T_out < 260 K
```

Verifies PR H_dep makes JT cooling automatic through isenthalpic
expansion (valve passes H_in directly to outlet PH-flash).

### Test B: HEX as Evaporator

```
Setup:
  Cold: NH₃ two-phase (from valve, ~240 K, 2 bar, 0.1 mol/s)
  Hot: air (300 K, 1 bar, 1 mol/s)
Expected: NH₃ exits as superheated vapor near 240-260 K
Assert: cold_out.phase === 'V' or cold_out.T > cold_in.T
```

### Test C: HEX as Condenser

```
Setup:
  Hot: NH₃ superheated (353 K, 20 bar, 0.1 mol/s, from compressor)
  Cold: H₂O (293 K, 1 bar, 0.5 mol/s)
Expected: NH₃ exits as subcooled liquid
Assert: hot_out.phase === 'L' or hot_out.T < 320 K
```

### Test D: Full NH₃ Loop

```
Setup: compressor(20 bar) → HEX(condenser) → valve(2 bar) → HEX(evaporator) → recycle
Expected: loop converges, T_evap ≈ 240 K, T_cond ≈ 313 K
Assert: recycle converges within 5 iterations
```

### Test E: CO₂ Near-Critical

```
Setup: source(CO₂, 35°C=308K, 80 bar) → valve(50 bar) → sink
Expected: T drops, possibly enters two-phase
Assert: T_out < T_in, Z_vap ≈ 0.3–0.5 (supercritical/near-critical)
```

---

## Tests (~12)

| # | Test | Assert |
|---|------|--------|
| 1 | Column: N₂/O₂ at 5 bar, LK=N₂ | distillate enriched in N₂ (x_D_N2 > 0.9) |
| 2 | Column: mass balance | abs(F − D − B) < 1e-10 per species |
| 3 | Column: energy balance | abs(Q_R − Q_C − ΔH) < 1% |
| 4 | Column: undersized N < N_actual | warning.severity === 'WARNING' |
| 5 | Column: single-component feed | error.severity === 'MAJOR' |
| 6 | Column: α ≈ 1 (CH₄/N₂ at 1 bar) | warning about difficult separation |
| 7 | HEX UA/NTU: condensing steam Q | matches approach mode within 5% |
| 8 | HEX UA/NTU: evaporating NH₃ Q | matches approach mode within 5% |
| 9 | Refrig A: NH₃ JT | T_out < 260 K |
| 10 | Refrig B: evaporator | cold outlet is vapor |
| 11 | Refrig C: condenser | hot outlet is liquid |
| 12 | Refrig D: NH₃ loop convergence | stable within 5 iterations |

**Gate:** All previous (343) + 12 new pass.

---

## Implementation Checklist

```
S4a session 1 (unit + FUG core):
  [ ] distillation_column unit registration (ports, presentations)
  [ ] initParams case with all 8 parameters
  [ ] fenskeNmin() pure function
  [ ] fenskeDistribution() pure function
  [ ] underwoodRmin() pure function (θ bisection)
  [ ] gillilandStages() pure function
  [ ] feedThermalCondition() + thermo.hMolar_mix helper

S4a session 2 (energy + diagnostics):
  [ ] Tick function with FUG pipeline
  [ ] Energy balance (Q_R, Q_C)
  [ ] Power demand + curtailed separation
  [ ] Condenser output on elec_surplus port
  [ ] Inspector (params, kpis, power sections)
  [ ] Limit parameters (T, P, mass)
  [ ] NNG-12 diagnostic messages (4 distinct messages)
  [ ] 6 column tests passing

S4b session (HEX fix + refrigeration):
  [ ] _effectiveCp() function
  [ ] hxCapacityRates() rewrite (~15 lines)
  [ ] 2 HEX UA/NTU regression tests
  [ ] 4 refrigeration loop tests (+ CO₂ near-critical)

Total S4: ~12 new tests → 355 cumulative
```

---

## What S4 Enables Downstream

| Consumer | What it uses from S4 |
|----------|---------------------|
| S7 (Perf Maps) | Column α vs P curves; HEX effectiveness maps |
| S8 (Game) | M9 cryogenic O₂ reserves: column separates atmospheric N₂/O₂ |
| S5 (Pressure) | Refrigeration loops validate pressure drop propagation through recycles |
