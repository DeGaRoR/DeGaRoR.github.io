# Feature Spec: Electrochemical Reactor
# processThis — standalone unit spec
# Status: DESIGN — 2026-02-17

## Summary

A reactor driven by electrical power rather than temperature.
Converts electrical energy into chemical energy via electrolysis.
First use case: water splitting (2 H₂O → 2 H₂ + O₂).

## Unit Definition

    defId:    'reactor_electrochemical'
    name:     'Electrochemical Reactor'
    category: UnitCategories.REACTOR
    w: 2, h: 2

## Ports

    portId     dir  type        x  y   role
    ────────── ──── ─────────── ── ── ────────────────────────
    mat_in     IN   MATERIAL    0  1   Liquid/gas feed
    power_in   IN   ELECTRICAL  1  0   Drives the reaction
    mat_out    OUT  MATERIAL    2  1   Product stream
    heat_out   OUT  HEAT        1  2   Waste heat (inefficiency)

## Parameters

    key             default   min    max     notes
    ─────────────── ───────── ────── ─────── ─────────────────────
    reactionId      (required)                from ReactionRegistry
    efficiency      0.70      0.30   0.95    electrical → chemical
    conversion_max  0.80      0.01   0.99    max single-pass conversion

    efficiency rationale:
      PEM electrolysis: 0.60–0.80 (commercial range)
      Alkaline: 0.55–0.70
      Solid oxide (high T): 0.80–0.95
      Default 0.70 = mid-range PEM

## Physics

    The reaction extent ξ (mol/s) is set by available electrical power:

      P_available = power_in.actual (W)
      P_chemical = P_available × efficiency (W)
      ξ = P_chemical / |ΔH_rxn| (mol/s)

    ΔH_rxn from ReactionRegistry (precomputed _dH0_Jmol).

    ξ is then capped by:
      1. Limiting reactant: ξ ≤ n_limiting / |ν_limiting|
      2. Max conversion: ξ ≤ conversion_max × n_limiting / |ν_limiting|

    Product composition:
      n_out[sp] = n_in[sp] + ν[sp] × ξ  (for all species)

    Energy balance:
      Chemical energy absorbed: Q_chem = ξ × |ΔH_rxn| (W)
      Waste heat: Q_waste = P_available − Q_chem (W)
      This goes to heat_out port.
      Outlet enthalpy: H_out = H_in + P_available
        (all electrical input becomes either chemical energy or heat,
         both carried by the outlet stream or heat port)

    Temperature:
      Outlet T ≈ inlet T (isothermal assumption for electrolysis).
      The waste heat exits via heat_out, not into the stream.
      Implementation: set H_target for PH flash at T_in, P_in.
      Minor correction: actual H_out may differ slightly from
      H(T_in) due to composition change — PH flash resolves this.

    Pressure: passthrough (P_out = P_in − deltaP_bar × 1e5)

## Power demand contract

    The reactor declares power demand before receiving actual:

      u.powerDemand = ξ_max × |ΔH_rxn| / efficiency

    where ξ_max = conversion_max × n_limiting / |ν_limiting|

    The power dispatch system allocates actual ≤ demand.
    The reactor then computes ξ from actual power received.

    No power connected → ξ = 0, INFO "No power — reactor idle"
    Power < demand → partial conversion, INFO "Power-limited"

## Diagnostic messages (NNG-12)

    "No electrical power connected — reactor cannot drive the reaction.
     Connect a power source (solar panels, grid, battery) to the
     power input port."

    "Power supply limited — reactor achieving X% of maximum conversion.
     Available: Y kW, needed for full conversion: Z kW."

    "No reactant [species] in feed — reaction cannot proceed.
     Ensure the feed stream contains [species]."

    "Feed temperature outside reaction range (T_in = X K,
     valid range Y–Z K). Adjust feed temperature."

## New Reaction: Water Electrolysis

    ReactionRegistry.register('R_H2O_ELECTROLYSIS', {
      name: 'Water Electrolysis',
      equation: '2 H₂O → 2 H₂ + O₂',
      stoich: { H2O: -2, H2: 2, O2: 1 },
      reversible: false,
      Tmin_K: 280,
      Tmax_K: 373,        // PEM range (liquid water)
      Pmin_Pa: 50000,     // 0.5 bar
      Pmax_Pa: 5000000,   // 50 bar
      notes: 'PEM water electrolysis. Endothermic, electrically driven.',
      references: [
        { source: 'NIST WebBook',
          detail: 'Formation enthalpies for H2O, H2, O2' }
      ],
      kinetics: {
        model: 'ELECTROCHEMICAL',
        references: [
          { source: 'Carmo et al. 2013',
            detail: 'Int. J. Hydrogen Energy 38, 4901. PEM review.' }
        ]
      }
    });

    New kinetics model: 'ELECTROCHEMICAL'
    Unlike POWER_LAW, rate is not from Arrhenius.
    Rate = f(electrical power), not f(T, concentration).
    KineticsEval needs a new branch:
      if (model === 'ELECTROCHEMICAL') → rate from power input
    This keeps the ReactionRegistry validation happy (kinetics block
    present) while signaling a fundamentally different rate mechanism.

## New Reaction: Methane Combustion

    Not electrochemical, but needed for the game progression:

    ReactionRegistry.register('R_CH4_COMB', {
      name: 'Methane Combustion',
      equation: 'CH₄ + 2 O₂ → CO₂ + 2 H₂O',
      stoich: { CH4: -1, O2: -2, CO2: 1, H2O: 2 },
      reversible: true,
      Tmin_K: 500,
      Tmax_K: 2500,
      Pmin_Pa: 50000,
      Pmax_Pa: 5000000,
      notes: 'Strongly exothermic. K >> 1 at practical T.',
      references: [
        { source: 'NIST-JANAF', detail: 'Chase 1998' }
      ],
      kinetics: {
        model: 'POWER_LAW',
        A: 1.0e6,
        beta: 0,
        Ea_Jmol: 125000,    // ~125 kJ/mol
        orders: { CH4: 1, O2: 0.5 },
        references: [
          { source: 'Westbrook & Dryer 1981 (adapted)',
            detail: 'Combust. Sci. Technol. 27, 31-43. Global one-step.' }
        ]
      }
    });

## Inspector

    Header: "Electrochemical Reactor"
    Status: reaction name, conversion %, power consumption
    Params: reaction selector, efficiency slider, max conversion
    Props: ξ (mol/s), Q_chem (kW), Q_waste (kW), P_demand (kW)
    Diagnostics: power status, reactant availability

## Tests (indicative — numbered at implementation time)

    - No power → ξ = 0, idle diagnostic
    - Full power → ξ = conversion_max × limiting
    - Partial power → proportional ξ
    - Mass balance: n_in + ν×ξ = n_out (exact)
    - Energy balance: P_elec = Q_chem + Q_waste (exact)
    - No reactant → ξ = 0, diagnostic
    - Efficiency 1.0 → Q_waste = 0
    - Efficiency 0.5 → Q_waste = Q_chem

## Relationship to existing reactors

    reactor_adiabatic:       Rate from kinetics, T changes. Cheat.
    reactor_equilibrium:     Equilibrium conversion, T-dependent.
    reactor_electrochemical: Rate from electrical power. New.

    All share: ReactionRegistry reactions, stoichiometric mass balance,
    enthalpy-based energy balance. The difference is what drives ξ.
