# RELEASESPEC_S4_process_operations.md
# processThis — S4: Process Operations
# Baseline: v12.10.0 + S1 + S2 + S3

═══════════════════════════════════════════════════════════════════
SCOPE
═══════════════════════════════════════════════════════════════════

Three deliverables:

  1. Shortcut distillation column (new unit)
  2. HEX UA/NTU effective-Cp fix (~15 lines)
  3. Refrigeration loop verification (test cases, no new code)

All require PR EOS (S3) for meaningful K-values.


═══════════════════════════════════════════════════════════════════
1. DISTILLATION COLUMN
═══════════════════════════════════════════════════════════════════

## Unit Definition

    defId:    'distillation_column'
    name:     'Distillation Column'
    category: UnitCategories.SEPARATION
    w: 2, h: 3

## Ports

    portId      dir  type        x  y   notes
    ─────────── ──── ─────────── ── ── ─────────────────────
    mat_in      IN   MATERIAL    0  1   Feed (any phase)
    elec_in     IN   ELECTRICAL  1  0   Reboiler duty
    mat_out_D   OUT  MATERIAL    2  0   Distillate (top)
    mat_out_B   OUT  MATERIAL    2  2   Bottoms (bottom)
    heat_out    OUT  ELECTRICAL  1  3   Condenser duty (removable)

## Parameters

    key               default  min    max     notes
    ───────────────── ──────── ────── ─────── ──────────────────────
    N_stages          20       3      100     Number of theoretical stages
    R_over_Rmin       1.3      1.05   5.0     R/R_min ratio
    feed_stage_frac   0.5      0.1    0.9     Feed location (0=top, 1=bottom)
    P_column_bar      1.0      0.1    50      Column operating pressure
    lightKey          ''       enum            Light key species
    heavyKey          ''       enum            Heavy key species
    xD_lightKey       0.95     0.5    0.999   Light key purity in distillate
    xB_heavyKey       0.95     0.5    0.999   Heavy key purity in bottoms

## Method: Fenske-Underwood-Gilliland (FUG)

### Step 1: K-values

    For each species: K_i = ThermoAdapter.kValue(species, T_avg, P_column)
    T_avg = (T_bubble_feed + T_dew_feed) / 2  (estimated)
    α_i = K_i / K_heavyKey  (relative volatility)

### Step 2: Fenske — Minimum stages

    N_min = ln[(xD_LK/xD_HK) × (xB_HK/xB_LK)] / ln(α_LK)

    Component distribution at total reflux (non-keys):
    (d_i/b_i) = (d_LK/b_LK) × α_i^N_min

### Step 3: Underwood — Minimum reflux

    Find θ (Underwood root) from:
    Σ [α_i × z_i / (α_i − θ)] = 1 − q

    where q = feed thermal condition:
      q = 1.0 for saturated liquid feed
      q = 0.0 for saturated vapor feed
      q = (H_sat_vap − H_feed) / (H_sat_vap − H_sat_liq)

    Then: R_min = Σ [α_i × x_D_i / (α_i − θ)] − 1

### Step 4: Gilliland — Actual stages

    R = R_over_Rmin × R_min

    Gilliland correlation (Molokanov form):
    X = (R − R_min) / (R + 1)
    Y = 1 − exp[(1 + 54.4X)/(11 + 117.2X) × (X−1)/√X]
    N_actual = (N_min + Y) / (1 − Y)

    If N_actual > N_stages: column undersized → WARNING
    "Column has [N] stages but [N_actual] needed for specified
     separation. Increase stages, reduce purity, or adjust R/R_min."

### Step 5: Product splits

    From Fenske distribution, compute d_i and b_i for all species.
    F_i = d_i + b_i (mass balance per component).

### Step 6: Energy balance

    Condenser duty: Q_C = R × D × (H_vap − H_liq) at T_top
    Reboiler duty:  Q_R = Q_C + F × (H_D − H_F) + B × (H_D − H_B)
                    (simplified: Q_R ≈ Q_C for large R)

    Power demand: Q_R from elec_in. If power < Q_R → partial
    separation, WARNING "Reboiler power limited."

    Condenser output: Q_C to heat_out (recoverable).

### Step 7: Outlet streams

    Distillate: T = T_bubble at P_column for x_D composition.
    Bottoms: T = T_bubble at P_column for x_B composition.
    PH-flash on both outlets for consistency.

## Pressure

    role: passthrough
    k: 1e4 (tray hydraulics resistance)
    Both outlets at P_column (same pressure, ΔP internal only).

## Diagnostics (NNG-12)

    "No light key [species] in feed — column cannot separate.
     Ensure feed contains the specified light key."

    "Feed is single-component — distillation requires at least
     two species. Check feed composition."

    "Relative volatility α ≈ 1.0 for [LK]/[HK] — separation
     very difficult. Consider different operating pressure or keys."

    "Column undersized: [N_actual] stages needed, [N] available.
     Increase N_stages or relax purity specification."


═══════════════════════════════════════════════════════════════════
2. HEX UA/NTU EFFECTIVE-Cp FIX
═══════════════════════════════════════════════════════════════════

## Problem

UA/NTU mode computes: C = m_dot × Cp (sensible only).
Phase-changing streams have effective Cp → ∞ (latent heat dominates).
Result: NTU underpredicted, effectiveness underpredicted,
Q_transferred too low.

Approach and setpoint modes handle this correctly (PH-flash on
outlet, enthalpy-based Q). UA/NTU is the only broken mode.

## Fix

Apply the air cooler's effective-Cp pattern to general HEX:

    C_eff = |Q_max_stream| / |ΔT_stream|

Where Q_max_stream = m_dot × (H(T_in) − H(T_target)) and
T_target is estimated from the other stream's inlet T.

If |ΔT_stream| < 1 K (isothermal phase change):
  C_eff = 1e12 (effectively infinite — this stream is not limiting)

~15 lines in hxSolveUaNtu. Existing approach/setpoint unaffected.

## Verification

After fix, UA/NTU mode should match approach mode within 5%
for condensing/evaporating service. Test with:
  - Steam condensation (100°C, 1 bar → subcooled 80°C)
  - NH₃ evaporation (−33°C, 1 bar → superheated 0°C)


═══════════════════════════════════════════════════════════════════
3. REFRIGERATION LOOP VERIFICATION
═══════════════════════════════════════════════════════════════════

No new code — these are test cases confirming the engine handles
refrigeration loops correctly with PR EOS live. All components
existed before S4; this verifies they work together.

### Test A: Valve JT cooling (NH₃)

    NH₃ at 40°C / 20 bar → valve → 2 bar
    Expected: T_out ≈ −33°C (saturation at 2 bar)
    Verifies: PR enthalpy departure makes JT cooling automatic.

### Test B: HEX as evaporator

    Cold side: NH₃ two-phase (from valve, −33°C, 2 bar)
    Hot side: air at 25°C
    Expected: NH₃ exits as vapor near −33°C, air cooled.
    Verifies: PH-flash handles two-phase cold inlet.

### Test C: HEX as condenser

    Hot side: NH₃ superheated vapor (from compressor, 80°C, 20 bar)
    Cold side: water at 20°C
    Expected: NH₃ exits as subcooled liquid.
    Verifies: PH-flash handles condensation on hot side.

### Test D: End-to-end NH₃ loop

    Compressor(20 bar) → condenser(HEX, water-cooled)
    → valve(2 bar) → evaporator(HEX, air-cooled) → compressor
    Expected: loop converges, T_evap ≈ −33°C, T_cond ≈ 40°C.
    Verifies: recycle convergence with PR + JT + phase change.

### Test E: CO₂ near-critical

    CO₂ at 35°C / 80 bar (supercritical) → valve → 50 bar
    Expected: T drops, enters two-phase region.
    Verifies: PR handles near-critical CO₂ (Tc=304K, Pc=73.8 bar).


═══════════════════════════════════════════════════════════════════
PHASE TRACKER
═══════════════════════════════════════════════════════════════════

  [ ] 4a  distillation_column unit registration
  [ ] 4b  FUG method (Fenske, Underwood, Gilliland)
  [ ] 4c  Feed thermal condition (q calculation)
  [ ] 4d  Component distribution + product streams
  [ ] 4e  Energy balance (reboiler demand, condenser duty)
  [ ] 4f  Column diagnostics (NNG-12)
  [ ] 4g  HEX UA/NTU effective-Cp fix
  [ ] 4h  Refrigeration loop tests
  [ ] 4i  Column + HEX regression

  Tests: ~12 new
    - Column: N₂/O₂ at 5 bar → D enriched in N₂, B enriched in O₂
    - Column: mass balance F = D + B per component
    - Column: energy balance Q_R − Q_C = ΔH
    - Column: undersized (N < N_actual) → WARNING
    - Column: single-component feed → alarm
    - Column: α ≈ 1 → alarm
    - HEX UA/NTU: condensing steam matches approach mode within 5%
    - HEX UA/NTU: evaporating NH₃ matches approach mode within 5%
    - Refrig A: NH₃ JT cooling T_out < T_in
    - Refrig B: evaporator outlet is vapor
    - Refrig C: condenser outlet is liquid
    - Refrig D: NH₃ loop converges (recycle stable within 3 iterations)

  Gate: all previous + ~12 new pass.
