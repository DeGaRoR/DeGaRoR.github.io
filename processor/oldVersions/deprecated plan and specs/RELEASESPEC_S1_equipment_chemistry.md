# RELEASESPEC_S1_equipment_chemistry.md
# processThis — S1: Equipment Limits + Chemistry Palette
# Baseline: v12.10.0 (289 tests)

═══════════════════════════════════════════════════════════════════
GOVERNING SPECS
═══════════════════════════════════════════════════════════════════

  Limit infrastructure:  RELEASESPEC_heatStream_perfmaps.md (Ph2 + Ph6)
  Limit data:            final_equipment_limits_S.md
  Thermo fixes:          AUDIT_thermo_ranges.md
  Haber reaction:        final_equipment_limits_S.md (appendix)

All remain valid and authoritative. This document adds only what
is not covered there: chemistry palette (new reactions, CO species)
and the integration checklist.


═══════════════════════════════════════════════════════════════════
SCOPE
═══════════════════════════════════════════════════════════════════

Three concerns, one stage. All are data registration or data
correction — zero refactoring risk.

  1. Equipment limits    13 units get LL/L/H/HH envelopes
  2. Thermo data fixes   H₂O cpig Tmin, CO₂ Antoine, CO species
  3. Chemistry palette   7 new reactions completing C/H/O/N web


═══════════════════════════════════════════════════════════════════
1. EQUIPMENT LIMITS
═══════════════════════════════════════════════════════════════════

Implementation per RELEASESPEC_heatStream_perfmaps Ph2 + Ph6:

  Ph2 delivers:
    LIMIT_PARAM_TEMPLATES — shared T/P/mass/phase metadata
    limitParams per unit def — which params are limitable
    S-size limit data — LL/L/H/HH on 13 units (from limits spec)
    getEffectiveLimits() — three-layer merge
    evaluateLimits() — pure function: def + unit + runtime → violations
    getLimitParam() — reads actual T/P/mass/phase from runtime
    Alarm source — limit violations → AlarmSystem
    Alarm schema extension — paramName, paramValue, limitTag, etc.

  Ph6 delivers:
    _rationalize() skeleton — dedup by alarm id, highest severity wins

  Default param fixes (from limits spec):
    tank.volume_m3:   50 → 0.15
    reactor.volume_m3: 1.0 → 0.003
    air_cooler.T_approach: (new) 10 K


═══════════════════════════════════════════════════════════════════
2. THERMO DATA FIXES
═══════════════════════════════════════════════════════════════════

Per AUDIT_thermo_ranges.md. Three fixes:

### H₂O cpig Tmin (1 line)

    ComponentRegistry H₂O Shomate: Tmin: 500 → Tmin: 298
    Same NIST coefficients (A=30.092, B=6.833...), valid 298–1700 K.
    Eliminates spurious extrapolation warnings for all steam < 227°C.

### CO₂ Antoine liquid-vapor range (2 lines)

    Add range to CO₂ Antoine:
    { A: 7.5789, B: 861.82, C: 271.88, Tmin: 217, Tmax: 304,
      desc: 'Liquid-vapor (above triple point)' }

    Current coverage: sublimation only (154–196 K). At 250 K, Antoine
    returns ~0.1 bar; real Psat ~17 bar. Raoult K-values qualitatively
    wrong above 200 K. This fix makes CO₂ flash reasonable in the
    ideal package until PR EOS (S3) takes over.

### CO species registration (~30 lines)

    ComponentRegistry.register('CO', {
      name: 'Carbon monoxide',
      MW: 28.010,
      Tc: 132.9,
      Pc: 3499000,
      omega: 0.048,
      Vc: 0.0000930,
      Zc: 0.292,
      Tb: 81.6,
      Hv: 6040,
      antoine: [
        { A: 6.24021, B: 230.272, C: 260.000, Tmin: 68, Tmax: 132 }
      ],
      cpig: [
        { type: 'shomate', A: 25.568, B: 6.0961, C: 4.0547,
          D: -2.6713, E: 0.1310, F: -118.01, G: 227.37, H: -110.53,
          Tmin: 298, Tmax: 1300 },
        { type: 'shomate', A: 35.151, B: 1.3006, C: -0.2059,
          D: 0.0135, E: -3.2825, F: -127.83, G: 231.71, H: -110.53,
          Tmin: 1300, Tmax: 6000 }
      ],
      cpLiq: 60.6,
      rhoLiq: 789,
      hf0: -110530,
      s0: 197.66,
      references: [{ source: 'NIST WebBook', detail: 'Chase 1998' }]
    });


═══════════════════════════════════════════════════════════════════
3. CHEMISTRY PALETTE
═══════════════════════════════════════════════════════════════════

7 new reactions. After S1, every C/H/O/N species connects to every
other through at least one pathway. Electrochemical reactions
registered as data only — the reactor_electrochemical unit comes in S6.

### R_HABER — Haber Synthesis
    N₂ + 3 H₂ ⇌ 2 NH₃
    ΔH° = −91,796 J/mol (exothermic)
    ΔS° = −198.11 J/(mol·K), Δν = −2
    Full registration in final_equipment_limits_S.md (appendix).

### R_SMR — Steam Methane Reforming
    CH₄ + H₂O → CO + 3 H₂
    ΔH° = +206,000 J/mol (strongly endothermic)
    T range: 700–1200 K. P range: 1–30 bar.
    kinetics: { model: 'POWER_LAW', A: 4.225e15, beta: 0,
      Ea_Jmol: 240100, orders: { CH4: 1, H2O: 0 } }
    Ref: Xu & Froment 1989 (simplified global fit for Ni catalyst).
    Note: H₂O order = 0 (excess steam assumed in industrial practice).

### R_WGS — Water-Gas Shift
    CO + H₂O ⇌ CO₂ + H₂
    ΔH° = −41,200 J/mol (mildly exothermic)
    ΔS° = −42.1 J/(mol·K), Δν = 0
    T range: 450–750 K. P range: 1–50 bar.
    kinetics: { model: 'POWER_LAW', A: 2.77e6, beta: 0,
      Ea_Jmol: 67100, orders: { CO: 1, H2O: 0.5 } }
    Ref: Rase 1977 (Fe-Cr catalyst, simplified).

### R_RWGS — Reverse Water-Gas Shift
    CO₂ + H₂ → CO + H₂O
    ΔH° = +41,200 J/mol (endothermic)
    T range: 600–1100 K. P range: 1–50 bar.
    kinetics: { model: 'POWER_LAW', A: 6.6e8, beta: 0,
      Ea_Jmol: 108000, orders: { CO2: 1, H2: 0.5 } }
    Ref: Daza & Kuhn 2016 review (adapted for Cu/ZnO catalyst).

### R_CH4_COMB — Methane Combustion
    CH₄ + 2 O₂ → CO₂ + 2 H₂O
    ΔH° = −802,600 J/mol (strongly exothermic)
    T range: 500–2500 K. P range: 0.5–50 bar.
    Full registration in spec-electrochemical-reactor.md.

### R_H2O_ELEC — Water Electrolysis (data only)
    2 H₂O → 2 H₂ + O₂
    ΔH° = +571,660 J/mol (endothermic, electrically driven)
    kinetics: { model: 'ELECTROCHEMICAL' }
    Full registration in spec-electrochemical-reactor.md.
    Unit comes in S6.

### R_CO2_ELEC — CO₂ Electrolysis (data only)
    2 CO₂ → 2 CO + O₂
    ΔH° = +566,000 J/mol (endothermic, electrically driven)
    T range: 280–1100 K. P range: 0.5–50 bar.
    kinetics: { model: 'ELECTROCHEMICAL' }
    Ref: Küngas 2020 (SOEC review).
    Unit comes in S6.


═══════════════════════════════════════════════════════════════════
PHASE TRACKER
═══════════════════════════════════════════════════════════════════

  [ ] 1a  LIMIT_PARAM_TEMPLATES + limitParams on all 13 units
  [ ] 1b  S-size limit data in UnitRegistry
  [ ] 1c  getEffectiveLimits(), evaluateLimits(), getLimitParam()
  [ ] 1d  Alarm source for limit violations
  [ ] 1e  _rationalize() skeleton
  [ ] 1f  Default param fixes (tank vol, reactor vol, air cooler)
  [ ] 1g  H₂O cpig Tmin fix
  [ ] 1h  CO₂ Antoine liquid-vapor range
  [ ] 1i  CO species registration
  [ ] 1j  R_HABER registration + thermo data
  [ ] 1k  R_SMR, R_WGS, R_RWGS registrations
  [ ] 1l  R_CH4_COMB registration
  [ ] 1m  R_H2O_ELEC, R_CO2_ELEC data-only registrations
  [ ] 1n  Tests

  Tests: ~15 new
    - evaluateLimits: compressor exceeds T_HH → CRITICAL
    - evaluateLimits: pump below P_LL → CRITICAL
    - evaluateLimits: phase violation (liquid in compressor) → CRITICAL
    - evaluateLimits: within H/HH → WARNING
    - evaluateLimits: within envelope → OK
    - getEffectiveLimits: returns S-size data
    - alarm source: limit violations appear in AlarmSystem
    - CO passes ComponentRegistry validation
    - R_HABER mass balance (N₂+3H₂→2NH₃: Δmass=0)
    - R_SMR mass balance
    - R_WGS mass balance
    - R_CH4_COMB mass balance
    - R_H2O_ELEC + R_CO2_ELEC: data registered, model=ELECTROCHEMICAL
    - H₂O at 400K: no console warning (Tmin fixed)
    - CO₂ Antoine at 250K: returns ~17 bar (not ~0.1 bar)

  Gate: all 289 existing + ~15 new pass.
