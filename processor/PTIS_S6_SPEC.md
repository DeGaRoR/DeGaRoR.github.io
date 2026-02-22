# PTIS_S6_SPEC
## S6 — Electrochemical Reactor
### processThis v13.5.0 → v13.6.0 (post-S5)

---

## Overview

**What:** New reactor unit type driven by electrical power instead of
temperature. Rate is set by power input, not Arrhenius kinetics. Two
physically separated product outlets (cathode + anode) reflecting real
electrode membrane separation. First use case: water electrolysis
(2 H₂O → 2 H₂ + O₂). Also activates CO₂ electrolysis (2 CO₂ →
2 CO + O₂). Adds ELECTROCHEMICAL branch to `KineticsEval.rate()`.

**Sessions:** 2 (unit registration + tick, then inspector + tests).

**Risk:** Low. Self-contained new unit. No changes to existing reactor
or kinetics code. Power demand contract follows S2 pattern exactly.

**Dependencies:**
- S1 (R_H2O_ELEC + R_CO2_ELEC data registrations, ELECTROCHEMICAL in KNOWN_KINETIC_MODELS)
- S2 (power demand contract, `checkOverload()`, fry logic)
- S3 optional (PR EOS for better ΔH; works with ideal package via formation enthalpies)

**Required by:** S8 (M2 mission: O₂ production via water electrolysis).

**Baseline state (post-S5):**
- `reactor_equilibrium`: driven by temperature/kinetics (line 9150)
- `R_H2O_ELEC` and `R_CO2_ELEC`: registered in S1 with `model: 'ELECTROCHEMICAL'`
- `KineticsEval.rate()`: returns 0 for unrecognized models (line 3593)
- No unit type can use ELECTROCHEMICAL reactions
- ~434 tests

**After S6:**
- `reactor_electrochemical`: new unit, power-driven ξ, 2 product outlets
- `KineticsEval.rate()` handles ELECTROCHEMICAL model
- Power demand = ξ_max × |ΔH_rxn| / η
- ~442 tests (434 + 8 new)

---

## Design Principles

**Power drives the reaction:** Unlike equilibrium reactors where
temperature and kinetics determine conversion, the electrochemical
reactor's extent ξ is set by how much electrical power is available.
More power → more conversion, up to the limiting reactant cap.

**Electrode separation is physical (WYSIWYG):** In every real
electrochemical cell, a membrane or solid electrolyte physically
separates the cathode and anode compartments. Products never mix:

| Reaction | Cathode product | Anode product |
|----------|----------------|---------------|
| R_H2O_ELEC: 2 H₂O → 2 H₂ + O₂ | H₂ + unreacted H₂O | O₂ |
| R_CO2_ELEC: 2 CO₂ → 2 CO + O₂ | CO + unreacted CO₂ | O₂ |

O₂ is always the anode product. The reduced species (H₂, CO) exit
the cathode side alongside unreacted feed. This is not a modeling
convenience — it's how PEM, alkaline, and SOEC cells work. Two
electrodes, two outlets. No downstream flash drum required.

**Energy balance is exact:** Every watt of electrical input becomes
either chemical energy (absorbed by the endothermic reaction) or
waste heat (from inefficiency). `P_elec = Q_chem + Q_waste`, always.

**Relationship to existing reactors:**

| Reactor | What drives ξ | T behavior | Outlets |
|---------|--------------|------------|---------|
| reactor_equilibrium | Temperature + kinetics | T changes | 1 (mixed) |
| reactor_electrochemical | Electrical power | ≈ isothermal | 2 (separated) |

Both share: ReactionRegistry reactions, stoichiometric mass balance,
enthalpy-based energy balance. The differences are rate mechanism and
product separation.

---

# S6-1. Unit Registration

**Insert location:** After `reactor_equilibrium` registration (after
line ~9350), within the REACTOR section.

```javascript
// ═══════════════════════════════════════════════════════════════════════════════
// ELECTROCHEMICAL REACTOR — Power-Driven, Electrode-Separated [v13.6.0]
// ═══════════════════════════════════════════════════════════════════════════════
// Rate set by electrical power input, not Arrhenius kinetics.
// ξ = P_chemical / |ΔH_rxn|, capped by limiting reactant × conversion_max.
// Two product outlets: cathode (reduced species + unreacted feed) and
// anode (O₂) — reflecting physical membrane/electrolyte separation.
// Waste heat exits via heat_out port (ELECTRICAL type — v12.6.0 convention).
UnitRegistry.register('reactor_electrochemical', {
  name: 'Electrochemical Reactor',
  category: UnitCategories.REACTOR,
  w: 2,
  h: 3,
  ports: [
    { portId: 'mat_in',      label: 'Feed',          dir: PortDir.IN,  type: StreamType.MATERIAL,   x: 0, y: 1 },
    { portId: 'elec_in',     label: 'Power in',      dir: PortDir.IN,  type: StreamType.ELECTRICAL, x: 1, y: 0 },
    { portId: 'mat_out_cat', label: 'Cathode',       dir: PortDir.OUT, type: StreamType.MATERIAL,   x: 2, y: 0 },
    { portId: 'mat_out_ano', label: 'Anode (O₂)',    dir: PortDir.OUT, type: StreamType.MATERIAL,   x: 2, y: 2 },
    { portId: 'heat_out',    label: 'Waste heat',    dir: PortDir.OUT, type: StreamType.ELECTRICAL, x: 1, y: 3 }
  ],
  presentations: {
    'box/default': { w: 2, h: 3, ports: {
      mat_in:{x:0,y:1.5}, elec_in:{x:1,y:0},
      mat_out_cat:{x:2,y:0.5}, mat_out_ano:{x:2,y:2.5},
      heat_out:{x:1,y:3}
    }}
  },
  pressure: { role: 'passthrough', pairs: [['mat_in', 'mat_out_cat'], ['mat_in', 'mat_out_ano']], k: 500 },
  limitParams: ['T', 'P', 'mass'],
  limits: {
    S: {
      T_LL: 263, T_L: 280, T_H: 773, T_HH: 923,
      P_LL: 0.5e5, P_HH: 150e5,
      mass_HH: 0.08
    }
  },
  // tick defined in S6-3
});
```

**Port notes:**
- `mat_out_cat` (cathode): Reduced products + unreacted feed. For
  R_H2O_ELEC: H₂ + leftover H₂O. For R_CO2_ELEC: CO + leftover CO₂.
- `mat_out_ano` (anode): O₂ only. Pure oxygen stream in all supported
  reactions. This is always the oxidation product from the anode.
- `heat_out` is ELECTRICAL type (not HEAT — HEAT streams retired in
  v12.6.0). Consistent with the power hub surplus pattern. The waste
  heat port carries the energy that didn't go into chemistry. Connect
  to a dump load, heat recovery HEX, or leave unconnected (INFO alarm,
  heat dissipated to ambient).
- Unit is h: 3 (not h: 2) to accommodate the 5 ports cleanly.

**Product separation logic:** The tick function classifies each product
species as cathode or anode based on stoichiometry and oxidation state.
For all ELECTROCHEMICAL reactions in this engine, the rule is simple:
**O₂ → anode. Everything else → cathode.** This holds for both
R_H2O_ELEC and R_CO2_ELEC and generalizes to any future electrolysis
reaction (O₂ is always the oxidation product at the anode).

---

# S6-2. Parameters and initParams

```javascript
case 'reactor_electrochemical':
  unit.params = {
    reactionId: 'R_H2O_ELEC',
    efficiency: 0.70,
    conversion_max: 0.80,
    powerPriority: 2  // NORMAL (S2 convention)
  };
  break;
```

| Parameter | Default | Min | Max | Notes |
|-----------|---------|-----|-----|-------|
| reactionId | 'R_H2O_ELEC' | enum | | Must have `model: 'ELECTROCHEMICAL'` |
| efficiency | 0.70 | 0.30 | 0.95 | Electrical → chemical conversion |
| conversion_max | 0.80 | 0.01 | 0.99 | Max single-pass conversion of limiting reactant |

**Efficiency rationale:**
| Technology | η range | Notes |
|-----------|---------|-------|
| PEM electrolysis | 0.60–0.80 | Commercial range |
| Alkaline | 0.55–0.70 | Mature, lower cost |
| Solid oxide (SOEC) | 0.80–0.95 | High T, highest efficiency |
| Default 0.70 | — | Mid-range PEM |

**Reaction selector:** Inspector dropdown filters ReactionRegistry to
show only reactions with `kinetics.model === 'ELECTROCHEMICAL'`. After
S1, this includes R_H2O_ELEC and R_CO2_ELEC.

---

# S6-3. Tick Function

```javascript
tick(u, ports, par, ctx) {
  // ── Fry guard (S2) ──
  if (u.fried) {
    u.last = { fried: true, error: {
      severity: 'CRITICAL',
      message: 'Unit destroyed by electrical overload. Replace or reset.' }};
    u.powerDemand = 0;
    if (ports.mat_in) {
      // Passthrough all feed to cathode, empty anode
      ports.mat_out_cat = { type: StreamType.MATERIAL, P: ports.mat_in.P,
        n: { ...ports.mat_in.n }, phaseConstraint: 'VL',
        H_target_Jps: thermo.getHdot_Jps(ports.mat_in) };
      ports.mat_out_ano = { type: StreamType.MATERIAL, P: ports.mat_in.P,
        n: {}, phaseConstraint: 'V' };
    }
    return;
  }

  const sIn = ports.mat_in;
  if (!sIn) return;

  // ── Reaction data ──
  const rxnId = par.reactionId || 'R_H2O_ELEC';
  const rxn = ReactionRegistry.get(rxnId);
  if (!rxn) {
    u.last = { error: { severity: ErrorSeverity.MAJOR,
      message: `Reaction '${rxnId}' not found in registry.` } };
    return;
  }

  const stoich = rxn.stoich;
  const eta = Math.max(0.01, Math.min(0.99, par.efficiency ?? 0.70));
  const conv_max = Math.max(0.01, Math.min(0.99, par.conversion_max ?? 0.80));

  // ── ΔH_rxn from formation enthalpies ──
  const dH_rxn = rxn._dH0_Jmol ?? _computeDeltaH(stoich);
  const absDH = Math.abs(dH_rxn);
  if (absDH < 1) {
    u.last = { error: { severity: ErrorSeverity.MAJOR,
      message: `Reaction ΔH ≈ 0 — no energy to drive.` } };
    return;
  }

  // ── Limiting reactant ──
  const reactants = Object.entries(stoich).filter(([sp, nu]) => nu < 0);
  let xi_max_reactant = Infinity;
  let limitingSpecies = '';

  for (const [sp, nu] of reactants) {
    const n_sp = sIn.n[sp] || 0;
    if (n_sp < 1e-15) {
      u.last = {
        xi: 0, Q_chem_kW: 0, Q_waste_kW: 0,
        error: { severity: ErrorSeverity.MAJOR,
          message: `No reactant ${sp} in feed — reaction cannot proceed. Ensure the feed stream contains ${sp}.` }
      };
      u.powerDemand = 0;
      // Passthrough to cathode, empty anode
      ports.mat_out_cat = { type: StreamType.MATERIAL, P: sIn.P,
        n: { ...sIn.n }, phaseConstraint: 'VL',
        H_target_Jps: thermo.getHdot_Jps(sIn) };
      ports.mat_out_ano = { type: StreamType.MATERIAL, P: sIn.P,
        n: {}, phaseConstraint: 'V' };
      return;
    }
    const xi_limit = n_sp / Math.abs(nu);
    if (xi_limit < xi_max_reactant) {
      xi_max_reactant = xi_limit;
      limitingSpecies = sp;
    }
  }

  // ── Maximum extent from conversion limit ──
  const xi_max = conv_max * xi_max_reactant;

  // ── Power demand (S2 contract) ──
  const P_demand_W = xi_max * absDH / eta;
  u.powerDemand = P_demand_W;

  // ── Power available ──
  const sElec = ports.elec_in;
  const s = ctx ? ctx.scratch : {};
  const P_avail_W = s.hubAllocated_W ?? (sElec?.actual ?? sElec?.available ?? 0);

  // ── Overload check (S2) ──
  const overloadInfo = checkOverload(P_avail_W, P_demand_W, u);
  if (u.fried) return;

  // ── No power → idle ──
  if (P_avail_W < 1) {
    u.last = {
      xi: 0, conversion_pct: 0, Q_chem_kW: 0, Q_waste_kW: 0,
      P_demand_kW: P_demand_W / 1000, P_avail_kW: 0,
      limitingSpecies, reactionId: rxnId,
      error: { severity: ErrorSeverity.INFO,
        message: 'No electrical power connected — reactor idle. Connect a power source to the power input port.' },
      ...overloadInfo
    };
    // Passthrough to cathode, empty anode
    ports.mat_out_cat = { type: StreamType.MATERIAL, P: sIn.P,
      n: { ...sIn.n }, phaseConstraint: 'VL',
      H_target_Jps: thermo.getHdot_Jps(sIn) };
    ports.mat_out_ano = { type: StreamType.MATERIAL, P: sIn.P,
      n: {}, phaseConstraint: 'V' };
    return;
  }

  // ── Compute extent from available power ──
  const P_chem_W = P_avail_W * eta;
  let xi = P_chem_W / absDH;                 // mol/s from power
  xi = Math.min(xi, xi_max);                  // cap by conversion limit
  xi = Math.min(xi, xi_max_reactant * 0.999); // never exceed feed

  // ── Product composition with electrode separation ──
  // Apply stoichiometry to get total product moles
  const n_total = { ...sIn.n };
  for (const [sp, nu] of Object.entries(stoich)) {
    n_total[sp] = (n_total[sp] || 0) + nu * xi;
    if (n_total[sp] < 0) n_total[sp] = 0;  // numerical guard
  }

  // Separate into cathode and anode streams
  const { n_cathode, n_anode } = separateElectrodes(n_total);

  // ── Energy balance ──
  const Q_chem_W = xi * absDH;                // chemical energy absorbed
  const Q_waste_W = P_avail_W - Q_chem_W;     // waste heat from inefficiency

  // ── Outlet streams ──
  // Both outlets approximately isothermal: waste heat exits via heat_out.
  // Enthalpy split proportional to molar flow.
  const H_in = thermo.getHdot_Jps(sIn);
  const n_cat_total = Object.values(n_cathode).reduce((a, b) => a + b, 0);
  const n_ano_total = Object.values(n_anode).reduce((a, b) => a + b, 0);
  const n_total_out = n_cat_total + n_ano_total;

  // Chemical energy absorbed goes into the product streams (bond energy)
  // Split H_in + Q_chem proportional to molar flow
  const H_total_out = H_in + Q_chem_W;
  const frac_cat = n_total_out > 1e-15 ? n_cat_total / n_total_out : 1;

  ports.mat_out_cat = {
    type: StreamType.MATERIAL,
    P: sIn.P,
    n: n_cathode,
    phaseConstraint: 'VL',
    H_target_Jps: H_total_out * frac_cat
  };

  ports.mat_out_ano = {
    type: StreamType.MATERIAL,
    P: sIn.P,
    n: n_anode,
    phaseConstraint: 'V',  // O₂ always gas at process conditions
    H_target_Jps: H_total_out * (1 - frac_cat)
  };

  // ── Waste heat port ──
  if (ports.heat_out !== undefined) {
    ports.heat_out = {
      type: StreamType.ELECTRICAL,
      capacity: Q_waste_W,
      actual: Q_waste_W,
      available: Q_waste_W
    };
  }

  // ── Diagnostics ──
  const conversion_pct = xi_max_reactant > 0
    ? (xi / xi_max_reactant) * 100 : 0;
  const powerLimited = P_avail_W < P_demand_W - 1;

  u.last = {
    reactionId: rxnId,
    reactionName: rxn.name,
    xi_molps: xi,
    conversion_pct,
    limitingSpecies,
    efficiency: eta,
    P_demand_kW: P_demand_W / 1000,
    P_avail_kW: P_avail_W / 1000,
    Q_chem_kW: Q_chem_W / 1000,
    Q_waste_kW: Q_waste_W / 1000,
    n_O2_anode: n_anode.O2 || 0,
    n_cathode_total: n_cat_total,
    powerLimited,
    ...overloadInfo
  };

  // Power-limited diagnostic
  if (powerLimited) {
    u.last.info = {
      severity: ErrorSeverity.INFO,
      message: `Power-limited — achieving ${conversion_pct.toFixed(0)}% conversion. Available: ${(P_avail_W/1000).toFixed(1)} kW, needed: ${(P_demand_W/1000).toFixed(1)} kW.`
    };
  }
}
```

---

# S6-4. ΔH Computation Helper

If `rxn._dH0_Jmol` is not precomputed (it should be by ReactionRegistry),
fall back to computing from formation enthalpies:

```javascript
function _computeDeltaH(stoich) {
  let dH = 0;
  for (const [sp, nu] of Object.entries(stoich)) {
    const cd = ComponentRegistry.get(sp);
    if (!cd || cd.hf0_Jmol === undefined) return 0;
    dH += nu * cd.hf0_Jmol;
  }
  return dH;
}
```

For R_H2O_ELEC: `ΔH = 2×0 + 1×0 − 2×(−241826) = +483,652 J/mol` (endothermic).
For R_CO2_ELEC: `ΔH = 2×(−110530) + 1×0 − 2×(−393510) = +565,960 J/mol` (endothermic).

This should also be called during `ReactionRegistry.register()` to
precompute and cache `_dH0_Jmol` on each reaction object, so tick
functions don't recompute it every frame.

---

# S6-5. KineticsEval ELECTROCHEMICAL Branch

**File:** `processThis.html`
**Line:** 3590 (KineticsEval.rate dispatch)

**Current:**
```javascript
rate(kin, T_K, P_i, K_eq, stoich) {
  if (!kin) return 0;
  if (kin.model === 'POWER_LAW') {
    return KineticsEval.ratePowerLaw(kin, T_K, P_i, K_eq, stoich);
  }
  return 0;  // unrecognized model
}
```

**Change:**
```javascript
rate(kin, T_K, P_i, K_eq, stoich) {
  if (!kin) return 0;
  if (kin.model === 'POWER_LAW') {
    return KineticsEval.ratePowerLaw(kin, T_K, P_i, K_eq, stoich);
  }
  if (kin.model === 'ELECTROCHEMICAL') {
    // Rate determined by power input, not temperature/concentration.
    // Return 0 here — actual rate computed in reactor_electrochemical tick.
    // This branch exists so KineticsEval.rate() doesn't log errors
    // for ELECTROCHEMICAL reactions used in the equilibrium reactor
    // (which would be a user error — wrong reactor type).
    return 0;
  }
  return 0;  // unrecognized model
}
```

---

# S6-6. ReactionRegistry ΔH Precomputation

Add to `ReactionRegistry.register()`, after validation:

```javascript
// Precompute ΔH° from formation enthalpies
let dH0 = 0;
let canComputeDH = true;
for (const [sp, nu] of Object.entries(rxnDef.stoich)) {
  const cd = ComponentRegistry.get(sp);
  if (!cd || cd.hf0_Jmol === undefined) { canComputeDH = false; break; }
  dH0 += nu * cd.hf0_Jmol;
}
if (canComputeDH) {
  rxnObj._dH0_Jmol = dH0;
}
```

Runs once at registration time. Every reaction carries `_dH0_Jmol`.

---

# S6-7. Electrode Separation Rule

The product separation is driven by a simple, physically correct rule:

```javascript
/**
 * Classify product species into cathode and anode streams.
 * Rule: O₂ → anode. Everything else → cathode.
 *
 * Physical basis: in all electrolysis cells (PEM, alkaline, SOEC),
 * the membrane/electrolyte separates the oxidation product (O₂,
 * always produced at the anode) from the reduction products
 * (H₂, CO, etc., produced at the cathode). Feed species that
 * are not consumed remain on the cathode side where they entered.
 *
 * @param {Object} n_total - { species: mol/s } after stoichiometry applied
 * @returns {{ n_cathode: Object, n_anode: Object }}
 */
function separateElectrodes(n_total) {
  const n_cathode = {}, n_anode = {};
  for (const [sp, mol] of Object.entries(n_total)) {
    if (mol < 1e-18) continue;
    if (sp === 'O2') {
      n_anode[sp] = mol;
    } else {
      n_cathode[sp] = mol;
    }
  }
  return { n_cathode, n_anode };
}
```

**Verification against all supported reactions:**

| Reaction | Stoich | Cathode out | Anode out | Correct? |
|----------|--------|------------|-----------|----------|
| R_H2O_ELEC | 2H₂O → 2H₂ + O₂ | H₂ + unreacted H₂O | O₂ | ✅ PEM: H₂ at cathode, O₂ at anode |
| R_CO2_ELEC | 2CO₂ → 2CO + O₂ | CO + unreacted CO₂ | O₂ | ✅ SOEC: CO at cathode, O₂ at anode |

**Future-proofing:** If a future electrolysis reaction produces
something other than O₂ at the anode (e.g., Cl₂ from brine
electrolysis), the separation rule would be extended. For now, O₂
is the universal anode product across all registered ELECTROCHEMICAL
reactions.

---

# S6-8. Inspector

```javascript
UnitInspector.reactor_electrochemical = {
  params(u) {
    const ecReactions = ReactionRegistry.getAll()
      .filter(r => r._kinetics?.model === 'ELECTROCHEMICAL');

    return [
      { label: 'Reaction', type: 'select',
        options: ecReactions.map(r => ({ value: r.id, label: r.name })),
        get: () => u.params.reactionId,
        set: v => u.params.reactionId = v },
      { label: 'Efficiency (η)',
        get: () => u.params.efficiency ?? 0.70,
        set: v => u.params.efficiency = Math.max(0.30, Math.min(0.95, v)),
        step: 0.01, decimals: 2 },
      { label: 'Max conversion',
        get: () => u.params.conversion_max ?? 0.80,
        set: v => u.params.conversion_max = Math.max(0.01, Math.min(0.99, v)),
        step: 0.01, decimals: 2 },
      { type: 'info', html: () => {
        const rxn = ReactionRegistry.get(u.params.reactionId);
        return rxn ? `${rxn.equation}<br>ΔH° = ${(rxn._dH0_Jmol/1000).toFixed(1)} kJ/mol` : '';
      }}
    ];
  },
  power(u, ud) {
    if (!ud?.last) return [];
    return [
      { label: 'P demand', value: fmt.kW((ud.last.P_demand_kW || 0) * 1000) },
      { label: 'P available', value: fmt.kW((ud.last.P_avail_kW || 0) * 1000),
        tone: ud.last.powerLimited ? 'warn' : '' },
      { label: 'Q chemical', value: fmt.kW((ud.last.Q_chem_kW || 0) * 1000), tone: 'info' },
      { label: 'Q waste', value: fmt.kW((ud.last.Q_waste_kW || 0) * 1000),
        tone: ud.last.Q_waste_kW > 0.1 ? 'warn' : '' }
    ];
  },
  kpis(u, ud) {
    if (!ud?.last) return [];
    return [
      { label: 'Reaction', value: ud.last.reactionName || '—' },
      { label: 'Conversion', value: `${(ud.last.conversion_pct || 0).toFixed(1)}%`,
        tone: ud.last.powerLimited ? 'warn' : '' },
      { label: 'ξ', value: `${(ud.last.xi_molps || 0).toFixed(4)} mol/s` },
      { label: 'Limiting', value: ud.last.limitingSpecies || '—' },
      { label: 'O₂ (anode)', value: `${(ud.last.n_O2_anode || 0).toFixed(4)} mol/s` },
      { label: 'Efficiency', value: `${((ud.last.efficiency || 0) * 100).toFixed(0)}%` }
    ];
  }
};
```

---

## Tests (~8)

| # | Test | Setup | Assert |
|---|------|-------|--------|
| 1 | No power → idle | EC reactor, no elec_in connected | xi === 0, INFO alarm, cathode = passthrough, anode empty |
| 2 | Full power → max conversion | R_H2O_ELEC, η=0.7, conv_max=0.8, excess power | xi = 0.8 × n_H2O / 2 |
| 3 | Partial power → proportional ξ | R_H2O_ELEC, η=0.7, power = 50% of demand | xi ≈ 0.5 × xi_max, powerLimited=true |
| 4 | Mass balance exact | Any ELEC reaction, sum cathode + anode | Σ(n_cat + n_ano) = Σ(n_in + ν×ξ) for all species |
| 5 | Energy balance exact | Check P_elec = Q_chem + Q_waste | abs(P_avail − Q_chem − Q_waste) < 0.01 |
| 6 | Electrode separation: H₂O | R_H2O_ELEC, check outlets | cathode has H₂ + H₂O, anode has O₂ only, no H₂ on anode |
| 7 | Electrode separation: CO₂ | R_CO2_ELEC, CO₂ feed | cathode has CO + CO₂, anode has O₂ only, no CO on anode |
| 8 | No reactant → ξ = 0 | R_H2O_ELEC, feed is pure N₂ | xi === 0, MAJOR alarm, N₂ passes through cathode |

**Gate:** All previous (434) + 8 new pass → 442 cumulative.

---

## Implementation Checklist

```
Session 1 (unit + tick):
  [ ] reactor_electrochemical registration (5 ports, presentations, pressure, limits)
  [ ] initParams case
  [ ] _computeDeltaH() helper function
  [ ] ReactionRegistry._dH0_Jmol precomputation (in register())
  [ ] KineticsEval.rate() ELECTROCHEMICAL branch (line 3590)
  [ ] separateElectrodes() pure function (O₂ → anode, rest → cathode)
  [ ] Full tick function with:
      - Fry guard (S2)
      - Reaction lookup + ΔH
      - Limiting reactant detection
      - Power demand contract (ξ_max × |ΔH| / η)
      - Power allocation reading (hubAllocated_W)
      - Overload check (S2)
      - ξ from available power, capped by conversion
      - Product composition with electrode separation
      - Enthalpy split proportional to molar flow
      - Two outlet streams (cathode + anode)
      - Waste heat port (ELECTRICAL)
      - NNG-14 diagnostics (idle, power-limited, no reactant)

Session 2 (inspector + tests):
  [ ] Inspector: reaction selector (ELECTROCHEMICAL filter), η, conv_max
  [ ] Inspector: power section (demand, available, Q_chem, Q_waste)
  [ ] Inspector: KPIs (reaction, conversion%, ξ, limiting species, O₂ anode, η)
  [ ] 8 tests passing (including 2 electrode separation tests)

Total S6: 8 new tests → 442 cumulative
```

---

## What S6 Enables Downstream

| Consumer | What it uses from S6 |
|----------|---------------------|
| S7 (Perf Maps) | Electrolyzer conversion vs power curves; η sensitivity |
| S8 (Game) | M2: O₂ from anode feeds life support directly. M5: CO₂ splitting. M9: O₂ from electrolyzer feeds cryogenic column. Two outlets eliminate need for downstream separation. |
| Future | Fuel cell (`fuel_cell` defId, S8+): shares `electrochemicalTick` trunk. 2 mat_in (fuel + oxidant), 1 mat_out (exhaust), elec_out (power). Trunk detects ΔH<0 → generate mode. Uses R_H2_FUELCELL, R_CO_FUELCELL (registered in S1). See S8 §S8c-3b. |
