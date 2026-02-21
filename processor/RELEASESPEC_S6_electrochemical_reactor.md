# RELEASESPEC_S6_electrochemical_reactor.md
# processThis — S6: Electrochemical Reactor
# Baseline: v12.10.0 + S1–S5

═══════════════════════════════════════════════════════════════════
GOVERNING SPEC
═══════════════════════════════════════════════════════════════════

  spec-electrochemical-reactor.md — complete and authoritative.

This document adds only the R_CO2_ELEC scope extension and
integration notes. All design, physics, and diagnostics per
the governing spec.


═══════════════════════════════════════════════════════════════════
SCOPE EXTENSION: R_CO2_ELEC
═══════════════════════════════════════════════════════════════════

The governing spec covers R_H2O_ELEC (water electrolysis) and
R_CH4_COMB (methane combustion, thermal). S1 registers both as
data. S6 adds R_CO2_ELEC:

    ReactionRegistry.register('R_CO2_ELEC', {
      name: 'CO₂ Electrolysis',
      equation: '2 CO₂ → 2 CO + O₂',
      stoich: { CO2: -2, CO: 2, O2: 1 },
      reversible: false,
      Tmin_K: 280,
      Tmax_K: 1100,        // SOEC can run hot
      Pmin_Pa: 50000,
      Pmax_Pa: 5000000,
      notes: 'Solid oxide or PEM CO₂ electrolysis.',
      references: [
        { source: 'Küngas 2020',
          detail: 'J. Electrochem. Soc. 167, 044508. SOEC review.' }
      ],
      kinetics: {
        model: 'ELECTROCHEMICAL',
        references: [
          { source: 'Küngas 2020',
            detail: 'Faradaic efficiency ~100% for SOEC at 800°C.' }
        ]
      }
    });

Data registered in S1. S6 activates it alongside the unit.


═══════════════════════════════════════════════════════════════════
DEPENDENCY
═══════════════════════════════════════════════════════════════════

  Requires: S2 (power demand contract, overload/fry logic)
  Requires: S1 (R_H2O_ELEC + R_CO2_ELEC data registrations)
  Uses: S3 if available (PR EOS for better enthalpy), but works
        with ideal package (ΔH from formation enthalpies).


═══════════════════════════════════════════════════════════════════
INTEGRATION NOTES
═══════════════════════════════════════════════════════════════════

### heat_out port

The governing spec defines heat_out as HEAT type. Since v12 retired
heat streams, heat_out should be ELECTRICAL type (waste heat as
recoverable electrical equivalent, consistent with heater/cooler
waste heat pattern). Update port type in registration.

### Pressure role

    pressure: { role: 'passthrough',
                pairs: [{ inPortId: 'mat_in', outPortId: 'mat_out',
                          paramKey: 'deltaP_bar' }],
                k: 500 }

### Equipment limits (from S1)

    T: same as reactor_equilibrium (323–923 K)
    P: same (50000–15000000 Pa)
    Power: ratedPower from elec_in allocation (S2)


═══════════════════════════════════════════════════════════════════
PHASE TRACKER
═══════════════════════════════════════════════════════════════════

  [ ] 6a  reactor_electrochemical unit registration
  [ ] 6b  ELECTROCHEMICAL kinetics branch in KineticsEval
  [ ] 6c  Power demand contract (ξ_max × |ΔH| / η)
  [ ] 6d  heat_out as ELECTRICAL port
  [ ] 6e  Pressure role + k
  [ ] 6f  Inspector (reaction selector, efficiency, conversion)
  [ ] 6g  R_CO2_ELEC activation test
  [ ] 6h  Tests

  Tests: ~8 new (per governing spec test plan)
    - No power → ξ = 0, idle diagnostic
    - Full power → ξ = conversion_max × limiting
    - Partial power → proportional ξ
    - Mass balance: n_in + ν×ξ = n_out (exact)
    - Energy balance: P_elec = Q_chem + Q_waste (exact)
    - No reactant → ξ = 0, diagnostic
    - Efficiency 1.0 → Q_waste = 0
    - R_CO2_ELEC: CO₂ → CO + O₂ mass balance correct

  Gate: all previous + ~8 new pass.
