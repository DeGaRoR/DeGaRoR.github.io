# PTIS_S6_SPEC
## S6 — Reactor Architecture
### processThis v13.5.0 → v13.6.0 (post-S5)

---

## Overview

**What:** Comprehensive reactor restructure. Split `reactor_equilibrium`
into three defIds with fixed, unconditional port layouts (NNG-3
compliance). Purge the HEAT port type from the reactor family. Revise
`reactor_electrochemical` (remove heat_out, raise η default). Revise
`fuel_cell` (replace heat_out with material cooling circuit). Five
reactor defIds total, all sharing two named trunks.

**Sessions:** 4 (S6a: 2 sessions, S6b: 2 sessions).

**Risk:** Medium. Touches reactor registration, port layouts, trunk
dispatch. All existing reactor tests must be migrated from
`reactor_equilibrium` to the appropriate new defId.

**Dependencies:**
- S1 (reaction data, ELECTROCHEMICAL kinetics model)
- S2 (power demand contract, `checkOverload()`, fry logic)
- S3 optional (PR EOS for better ΔH; works with ideal package)

**Required by:** S9 (fuel_cell registration, trunk table documentation).

**Can start as early as post-S2.** The dependency is S2→S6, not S5→S6.
There are ~10 sessions of slack on this parallel branch relative to the
critical path (S5a→S5b→S5c→S8).

**S4b dependency note:** `reactor_cooled` uses `heatExchangerTick`
logic internally. If S4b (HEX Cp fix) is complete before S6a,
reactor_cooled benefits. If not, it inherits the two-phase Cp bug
for its cooling jacket — acceptable until S4b merges.

**Baseline state (post-S5):**
- `reactor_equilibrium`: 1 defId, conditional elec_in port, heatDemand param (line 9150)
- `R_H2O_ELEC`, `R_CO2_ELEC`: registered in S1 with `model: 'ELECTROCHEMICAL'`
- `KineticsEval.rate()`: returns 0 for ELECTROCHEMICAL model (line 3593)
- No unit can use ELECTROCHEMICAL reactions
- Port type enum includes HEAT (unused by any shipped unit, but present)
- ~435 tests (post-S5c)

**After S6:**
- 5 reactor defIds, 2 trunks, all ports fixed and unconditional
- HEAT removed from port type enum
- `equilibriumTick` (was `reactorTick`): 3 defIds, config-branched
- `electrochemicalTick`: 2 defIds (consume + generate modes)
- η inspector range: 0.005–0.99 (unified, supports electrolysis and grow lights)
- ~451 tests (435 + ~16 new)

---

## Design Principles

**Fixed port layouts (NNG-3).** Every defId has exactly one port
layout, unconditionally. No `heatDemand` toggling port visibility.
Different port needs → different defId. This is the primary
motivation for splitting `reactor_equilibrium`.

**HEAT port type purged (NNG-2/NNG-3).** Heating is electrical
(cable). Cooling is material (pipe carrying coolant). No abstract
heat concept. Products exit hot from adiabatic units; the player
cools downstream with real equipment.

**Config-driven trunks.** The `equilibriumTick` trunk reads a
config object to determine whether the reactor is adiabatic,
jacketed, or cooled. The branching is minimal (one `if` chain
at the energy balance step). Shared code: reaction lookup,
stoichiometry, limiting reactant detection, diagnostics.

**Electrode separation is physical (WYSIWYG).** In all
electrochemical cells, a membrane physically separates cathode
and anode products. O₂ → anode, everything else → cathode.
Two electrodes, two outlets.

---

# S6a — Reactor Taxonomy Split (2 sessions)

## S6a-1. reactor_equilibrium Removal

The defId `reactor_equilibrium` ceases to exist. All code and tests
referencing it are migrated to the appropriate new defId.

| Old usage | New defId |
|-----------|-----------|
| Sabatier (M3), heatDemand='none' | `reactor_adiabatic` |
| Combustion (M4), heatDemand='none' | `reactor_adiabatic` |
| Haber (M7), heatDemand='none' | `reactor_adiabatic` |
| Human metabolism (composite) | `reactor_adiabatic` |
| heatDemand='isothermal' or 'fixed' | `reactor_jacketed` |
| Exothermic reaction + cooling need | `reactor_cooled` |

The trunk is renamed from `reactorTick` to `equilibriumTick`.

---

## S6a-2. reactor_adiabatic

| Field | Value |
|-------|-------|
| **defId** | `reactor_adiabatic` |
| **Category** | REACTION |
| **Footprint** | 2×2 |
| **Physical** | Insulated catalytic vessel — no heat exchange with surroundings |
| **Trunk** | `equilibriumTick` (config: `{ mode: 'adiabatic' }`) |
| **Game intro** | M3 (Sabatier), M4 (combustion chamber), M7 (Haber) |

**Ports (2):**

| portId | Direction | Type | Position |
|--------|-----------|------|----------|
| mat_in | IN | MATERIAL | left |
| mat_out | OUT | MATERIAL | right |

**Parameters**

| Param | Default | Unit | Notes |
|-------|---------|------|-------|
| reactionId | 'R_H2_COMB' | — | Must have model in KNOWN_KINETIC_MODELS |
| useKinetics | true | — | Use kinetic model |
| volume_m3 | 0.003 | m³ | Catalyst bed volume |
| alpha | 1.0 | — | Activity factor |

**Physics:** Q_external = 0. T_out from energy balance:
H_in + ΔH_rxn × ξ = H_out. All reaction heat goes into or
comes from the product stream.

**S-Size Limits**

| Param | LL | L | H | HH | Unit | Notes |
|-------|-----|---|---|-----|------|-------|
| T | 323 | 373 | 773 | 923 | K | Catalyst sintering limit at HH |
| P | 0.5 | — | — | 150 | bar | |
| ṁ | 0.001 | — | — | 0.08 | kg/s | |
| phase | — | — | — | — | — | REQUIRED: V |

**Registration:**

```javascript
UnitRegistry.register('reactor_adiabatic', {
  name: 'Reactor (Adiabatic)',
  category: UnitCategories.REACTOR,
  w: 2, h: 2,
  ports: [
    { portId: 'mat_in',  label: 'Feed',     dir: PortDir.IN,  type: StreamType.MATERIAL, x: 0, y: 1 },
    { portId: 'mat_out', label: 'Products',  dir: PortDir.OUT, type: StreamType.MATERIAL, x: 2, y: 1 }
  ],
  presentations: {
    'box/default': { w: 2, h: 2, ports: {
      mat_in: { x: 0, y: 1 }, mat_out: { x: 2, y: 1 }
    }}
  },
  pressure: { role: 'passthrough', pairs: [['mat_in', 'mat_out']], k: 500 },
  limitParams: ['T', 'P', 'mass'],
  limits: {
    S: {
      T_LL: 323, T_L: 373, T_H: 773, T_HH: 923,
      P_LL: 0.5e5, P_HH: 150e5,
      mass_HH: 0.08
    }
  }
});
```

---

## S6a-3. reactor_jacketed

| Field | Value |
|-------|-------|
| **defId** | `reactor_jacketed` |
| **Category** | REACTION |
| **Footprint** | 2×2 |
| **Physical** | Electrically heated catalytic vessel with heating jacket |
| **Trunk** | `equilibriumTick` (config: `{ mode: 'jacketed' }`) |
| **Game intro** | Sandbox |

**Ports (3):**

| portId | Direction | Type | Position |
|--------|-----------|------|----------|
| mat_in | IN | MATERIAL | left |
| mat_out | OUT | MATERIAL | right |
| elec_in | IN | ELECTRICAL | bottom |

**Parameters**

| Param | Default | Unit | Notes |
|-------|---------|------|-------|
| reactionId | 'R_H2_COMB' | — | |
| useKinetics | true | — | |
| volume_m3 | 0.003 | m³ | |
| alpha | 1.0 | — | |

**Physics:** `elec_in` provides Q_electrical (watts). If
Q_electrical ≥ Q required for isothermal operation → T_out ≈ T_in,
excess heat warms products slightly. If Q_electrical < Q_isothermal
→ T_out from energy balance with the Q actually provided.

NNG-2 compliant: Heating is electrical (resistive jacket, real cable).

**S-Size Limits:** Same as reactor_adiabatic.

**Registration:**

```javascript
UnitRegistry.register('reactor_jacketed', {
  name: 'Reactor (Jacketed)',
  category: UnitCategories.REACTOR,
  w: 2, h: 2,
  ports: [
    { portId: 'mat_in',  label: 'Feed',     dir: PortDir.IN,  type: StreamType.MATERIAL,   x: 0, y: 1 },
    { portId: 'mat_out', label: 'Products',  dir: PortDir.OUT, type: StreamType.MATERIAL,   x: 2, y: 1 },
    { portId: 'elec_in', label: 'Heater',    dir: PortDir.IN,  type: StreamType.ELECTRICAL, x: 1, y: 2 }
  ],
  presentations: {
    'box/default': { w: 2, h: 2, ports: {
      mat_in: { x: 0, y: 1 }, mat_out: { x: 2, y: 1 }, elec_in: { x: 1, y: 2 }
    }}
  },
  pressure: { role: 'passthrough', pairs: [['mat_in', 'mat_out']], k: 500 },
  limitParams: ['T', 'P', 'mass'],
  limits: {
    S: {
      T_LL: 323, T_L: 373, T_H: 773, T_HH: 923,
      P_LL: 0.5e5, P_HH: 150e5,
      mass_HH: 0.08
    }
  }
});
```

---

## S6a-4. reactor_cooled

| Field | Value |
|-------|-------|
| **defId** | `reactor_cooled` |
| **Category** | REACTION |
| **Footprint** | 2×3 |
| **Physical** | Catalytic vessel with cooling water jacket |
| **Trunk** | `equilibriumTick` (config: `{ mode: 'cooled' }`) |
| **Game intro** | Sandbox |

**Ports (4):**

| portId | Direction | Type | Position |
|--------|-----------|------|----------|
| mat_in | IN | MATERIAL | left-top |
| mat_out | OUT | MATERIAL | right-top |
| cool_in | IN | MATERIAL | left-bottom |
| cool_out | OUT | MATERIAL | right-bottom |

**Parameters**

| Param | Default | Unit | Notes |
|-------|---------|------|-------|
| reactionId | 'R_H2_COMB' | — | |
| useKinetics | true | — | |
| volume_m3 | 0.003 | m³ | |
| alpha | 1.0 | — | |
| UA | 500 | W/K | Heat transfer capacity of cooling jacket |

**Physics:** Internal HEX between reaction products and cooling
stream. UA parameter sets heat transfer capacity. Uses shared
`heatExchangerTick` logic for the internal HEX. If cooling is
insufficient → products exit hotter than target. If cooling
exceeds reaction heat → products exit cooler.

NNG-2 compliant: Cooling via material circuit (coolant through
jacket, real pipes).

**S-Size Limits**

| Param | LL | L | H | HH | Unit | Notes |
|-------|-----|---|---|-----|------|-------|
| T | 323 | 373 | 773 | 923 | K | Reaction side |
| P | 0.5 | — | — | 150 | bar | |
| ṁ | 0.001 | — | — | 0.08 | kg/s | Process side |

**Registration:**

```javascript
UnitRegistry.register('reactor_cooled', {
  name: 'Reactor (Cooled)',
  category: UnitCategories.REACTOR,
  w: 2, h: 3,
  ports: [
    { portId: 'mat_in',   label: 'Feed',       dir: PortDir.IN,  type: StreamType.MATERIAL, x: 0, y: 0.5 },
    { portId: 'mat_out',  label: 'Products',    dir: PortDir.OUT, type: StreamType.MATERIAL, x: 2, y: 0.5 },
    { portId: 'cool_in',  label: 'Coolant In',  dir: PortDir.IN,  type: StreamType.MATERIAL, x: 0, y: 2.5 },
    { portId: 'cool_out', label: 'Coolant Out', dir: PortDir.OUT, type: StreamType.MATERIAL, x: 2, y: 2.5 }
  ],
  presentations: {
    'box/default': { w: 2, h: 3, ports: {
      mat_in: { x: 0, y: 0.5 }, mat_out: { x: 2, y: 0.5 },
      cool_in: { x: 0, y: 2.5 }, cool_out: { x: 2, y: 2.5 }
    }}
  },
  pressure: {
    role: 'passthrough',
    pairs: [['mat_in', 'mat_out'], ['cool_in', 'cool_out']],
    k: 500
  },
  limitParams: ['T', 'P', 'mass'],
  limits: {
    S: {
      T_LL: 323, T_L: 373, T_H: 773, T_HH: 923,
      P_LL: 0.5e5, P_HH: 150e5,
      mass_HH: 0.08
    }
  }
});
```

---

## S6a-5. equilibriumTick Trunk

Renamed from `reactorTick`. Handles all three equilibrium reactor
defIds via a config-driven branch at the energy balance step.

```javascript
function equilibriumTick(u, ports, par, ctx) {
  const sIn = ports.mat_in;
  if (!sIn) return;

  // ── Reaction data ──
  const rxnId = par.reactionId || 'R_H2_COMB';
  const rxn = ReactionRegistry.get(rxnId);
  if (!rxn) {
    u.last = { error: { severity: ErrorSeverity.MAJOR,
      message: `Reaction '${rxnId}' not found in registry.` } };
    return;
  }

  const stoich = rxn.stoich;
  const dH_rxn = rxn._dH0_Jmol ?? _computeDeltaH(stoich);

  // ── Kinetics / equilibrium extent ──
  // ... (existing kinetics evaluation from baseline reactor_equilibrium)
  // Produces xi (mol/s extent of reaction)

  // ── Apply stoichiometry ──
  const n_out = { ...sIn.n };
  for (const [sp, nu] of Object.entries(stoich)) {
    n_out[sp] = (n_out[sp] || 0) + nu * xi;
    if (n_out[sp] < 0) n_out[sp] = 0;
  }

  const Q_rxn = dH_rxn * xi;  // W, negative = exothermic
  const H_in = thermo.getHdot_Jps(sIn);

  // ── Energy balance — mode-dependent ──
  const defId = u.defId;

  if (defId === 'reactor_adiabatic') {
    // Q_external = 0. All reaction heat stays in products.
    // H_out = H_in + Q_rxn (Q_rxn negative for exothermic)
    ports.mat_out = {
      type: StreamType.MATERIAL, P: sIn.P,
      n: n_out, phaseConstraint: 'VL',
      H_target_Jps: H_in + Q_rxn
    };
  }

  else if (defId === 'reactor_jacketed') {
    // Electrical heating. Q_elec offsets endothermic demand.
    const sElec = ports.elec_in;
    const P_avail_W = ctx?.scratch?.hubAllocated_W
                    ?? (sElec?.actual ?? sElec?.available ?? 0);
    // For endothermic: Q_needed = -Q_rxn (positive).
    // For exothermic: Q_needed = 0 (jacket only heats, doesn't cool).
    const Q_needed = Q_rxn > 0 ? 0 : -Q_rxn;  // watts needed for isothermal
    const Q_supplied = Math.min(P_avail_W, Q_needed);

    // H_out = H_in + Q_rxn + Q_supplied
    // If Q_supplied = Q_needed → isothermal (T_out = T_in)
    // If Q_supplied < Q_needed → partially compensated
    ports.mat_out = {
      type: StreamType.MATERIAL, P: sIn.P,
      n: n_out, phaseConstraint: 'VL',
      H_target_Jps: H_in + Q_rxn + Q_supplied
    };

    u.powerDemand = Q_needed;
  }

  else if (defId === 'reactor_cooled') {
    // Internal HEX between products and cooling stream.
    // First compute adiabatic product enthalpy:
    const H_products_adiabatic = H_in + Q_rxn;

    // Then run internal HEX logic (simplified):
    const sCoolIn = ports.cool_in;
    if (sCoolIn) {
      const UA = par.UA ?? 500;
      // Use heatExchangerTick logic to transfer heat from
      // products (hot) to coolant (cold). UA sets capacity.
      // ... (shared HEX effectiveness calculation)
      // Results in Q_transferred, product H adjusted, coolant H adjusted.

      ports.mat_out = {
        type: StreamType.MATERIAL, P: sIn.P,
        n: n_out, phaseConstraint: 'VL',
        H_target_Jps: H_products_adiabatic - Q_transferred
      };
      ports.cool_out = {
        type: StreamType.MATERIAL, P: sCoolIn.P,
        n: { ...sCoolIn.n }, phaseConstraint: 'VL',
        H_target_Jps: thermo.getHdot_Jps(sCoolIn) + Q_transferred
      };
    } else {
      // No coolant connected → adiabatic fallback with INFO alarm
      ports.mat_out = {
        type: StreamType.MATERIAL, P: sIn.P,
        n: n_out, phaseConstraint: 'VL',
        H_target_Jps: H_products_adiabatic
      };
      u.last = { ...u.last, info: {
        severity: ErrorSeverity.INFO,
        message: 'No coolant connected — operating adiabatically.'
      }};
    }
  }

  // ── Diagnostics (shared) ──
  u.last = {
    ...u.last,
    reactionId: rxnId,
    reactionName: rxn.name,
    xi_molps: xi,
    conversion_pct: /* ... */,
    limitingSpecies: /* ... */,
    Q_rxn_kW: Q_rxn / 1000,
    T_out: /* resolved from PH-flash */
  };
}
```

**Trunk dispatch registration:**

```javascript
TickDispatch.register('reactor_adiabatic',  equilibriumTick);
TickDispatch.register('reactor_jacketed',   equilibriumTick);
TickDispatch.register('reactor_cooled',     equilibriumTick);
```

---

## S6a-6. HEAT Port Type Removal

Remove `HEAT` from the `StreamType` enum. After S6a, only two
types remain:

| Type | Physical | Examples |
|------|----------|---------|
| MATERIAL | Pipe carrying fluid | mat_in, mat_out, cool_in, perm_out |
| ELECTRICAL | Cable carrying watts | elec_in, elec_out |

**Code location:** StreamType definition (line ~380). Remove
`HEAT: 'HEAT'` entry.

**Impact:** No shipped unit (post-S6a) uses HEAT. The
`reactor_electrochemical.heat_out` (old) is removed in S6b.
The `distillation_column.heat_out` is removed when S4 spec
is implemented. The fuel_cell heat_out is replaced in S6b.

**Port type enum update also goes to S0_SPEC** (NNG-3
documentation).

---

## S6a Tests (~8)

| # | Test | Setup | Assert |
|---|------|-------|--------|
| 1 | Adiabatic: exothermic | R_SABATIER, reactor_adiabatic | T_out > T_in, Q_external = 0 |
| 2 | Adiabatic: endothermic | R_SMR_OVERALL, reactor_adiabatic | T_out < T_in, Q_external = 0 |
| 3 | Jacketed: isothermal | R_SMR_OVERALL, reactor_jacketed, sufficient power | T_out ≈ T_in |
| 4 | Jacketed: insufficient power | R_SMR_OVERALL, reactor_jacketed, 50% power | T_in > T_out > T_adiabatic |
| 5 | Cooled: exothermic removal | R_SABATIER, reactor_cooled, coolant connected | T_out < T_adiabatic, coolant warms |
| 6 | Cooled: no coolant fallback | R_SABATIER, reactor_cooled, no cool_in | T_out = T_adiabatic, INFO alarm |
| 7 | Mass balance: all three | Each defId, same feed + reaction | Σn_in = Σn_out for all species |
| 8 | Migration: old tests pass | All pre-S6 reactor tests, remapped defId | Identical physics results |

**Gate:** 435 + 8 = 443 cumulative.

---

# S6b — Electrochemical Reactor & Fuel Cell (2 sessions)

## S6b-1. reactor_electrochemical (Revised)

| Field | Value |
|-------|-------|
| **defId** | `reactor_electrochemical` |
| **Category** | REACTION |
| **Footprint** | 2×3 |
| **Physical** | Electrochemical cell stack, membrane-separated outlets |
| **Trunk** | `electrochemicalTick` (config: `{ direction: 'consume' }`) |
| **Game intro** | M2 (electrolysis), M10 (photosynthesis inside greenhouse) |

**Ports (4) — revised from 5:**

| portId | Direction | Type | Position |
|--------|-----------|------|----------|
| mat_in | IN | MATERIAL | left |
| elec_in | IN | ELECTRICAL | top |
| mat_out_cat | OUT | MATERIAL | right-top |
| mat_out_ano | OUT | MATERIAL | right-bottom |

**Removed:** `heat_out`. Waste heat goes into product streams
(adiabatic on material side). Products exit hot. Player cools
downstream with air_cooler or HEX.

**Parameters**

| Param | Default | Min | Max | Notes |
|-------|---------|-----|-----|-------|
| reactionId | 'R_H2O_ELEC' | enum | | Must have `model: 'ELECTROCHEMICAL'` |
| efficiency | **0.90** | 0.005 | 0.99 | Was 0.70. Modern PEM: 0.85–0.95. Range supports greenhouse η=0.5–5%. |
| conversion_max | 0.80 | 0.01 | 0.99 | Max single-pass conversion of limiting reactant |

**Efficiency default revision:** 0.70 → **0.90**. At η=0.70,
product ΔT ≈ 2400K (absurd without cooling port). At η=0.90,
ΔT ≈ 240K (warm but physically sane for adiabatic operation).

**Efficiency technology reference:**

| Technology | η range |
|-----------|---------|
| PEM electrolysis | 0.60–0.80 |
| Alkaline | 0.55–0.70 |
| Solid oxide (SOEC) | 0.80–0.95 |
| Default (revised) | **0.90** (high-efficiency PEM/SOEC) |
| Grow lights (conventional LED) | 0.003–0.005 |
| Grow lights (targeted LED) | 0.005–0.02 |
| Default for R_PHOTOSYNTHESIS | **0.02** (2%) |

**S-Size Limits**

| Param | LL | L | H | HH | Unit |
|-------|-----|---|---|-----|------|
| T | 263 | 280 | 773 | 923 | K |
| P | 0.5 | — | — | 150 | bar |
| ṁ | — | — | — | 0.08 | kg/s |

**Registration:**

```javascript
UnitRegistry.register('reactor_electrochemical', {
  name: 'Electrochemical Reactor',
  category: UnitCategories.REACTOR,
  w: 2, h: 3,
  ports: [
    { portId: 'mat_in',      label: 'Feed',       dir: PortDir.IN,  type: StreamType.MATERIAL,   x: 0, y: 1.5 },
    { portId: 'elec_in',     label: 'Power in',   dir: PortDir.IN,  type: StreamType.ELECTRICAL, x: 1, y: 0 },
    { portId: 'mat_out_cat', label: 'Cathode',     dir: PortDir.OUT, type: StreamType.MATERIAL,   x: 2, y: 0.5 },
    { portId: 'mat_out_ano', label: 'Anode (O₂)',  dir: PortDir.OUT, type: StreamType.MATERIAL,   x: 2, y: 2.5 }
  ],
  presentations: {
    'box/default': { w: 2, h: 3, ports: {
      mat_in: { x: 0, y: 1.5 }, elec_in: { x: 1, y: 0 },
      mat_out_cat: { x: 2, y: 0.5 }, mat_out_ano: { x: 2, y: 2.5 }
    }}
  },
  pressure: {
    role: 'passthrough',
    pairs: [['mat_in', 'mat_out_cat'], ['mat_in', 'mat_out_ano']],
    k: 500
  },
  limitParams: ['T', 'P', 'mass'],
  limits: {
    S: {
      T_LL: 263, T_L: 280, T_H: 773, T_HH: 923,
      P_LL: 0.5e5, P_HH: 150e5,
      mass_HH: 0.08
    }
  }
});
```

---

## S6b-2. fuel_cell (Revised)

| Field | Value |
|-------|-------|
| **defId** | `fuel_cell` |
| **Category** | REACTION |
| **Footprint** | 2×3 |
| **Physical** | PEM/SOFC stack with mandatory cooling water loop |
| **Trunk** | `electrochemicalTick` (config: `{ direction: 'generate' }`) |
| **Game intro** | Future (not in current 10 missions). Sandbox available. |

**Ports (6) — revised from 5:**

| portId | Direction | Type | Position |
|--------|-----------|------|----------|
| mat_in_cat | IN | MATERIAL | left-top |
| mat_in_ano | IN | MATERIAL | left-bottom |
| mat_out | OUT | MATERIAL | right-center |
| elec_out | OUT | ELECTRICAL | top |
| cool_in | IN | MATERIAL | bottom-left |
| cool_out | OUT | MATERIAL | bottom-right |

**Removed:** `heat_out (HEAT/ELECTRICAL)`.
**Added:** `cool_in` + `cool_out` (MATERIAL).

**Rationale:** At η=0.60, waste heat is 40% of |ΔH|. Product flow
is tiny (water). ΔT would be thousands of K without cooling.
Real fuel cells have mandatory cooling water circuits. WYSIWYG:
not plugged = crazy temperatures / thermal alarm.

**Parameters**

| Param | Default | Min | Max | Notes |
|-------|---------|-----|-----|-------|
| reactionId | 'R_H2_FUELCELL' | enum | | Must be ELECTROCHEMICAL with ΔH < 0 |
| efficiency | 0.60 | 0.30 | 0.85 | Electrical generation efficiency |
| conversion_max | 0.80 | 0.01 | 0.99 | Max single-pass fuel conversion |
| UA | 500 | W/K | | Internal HEX capacity |

**Internal HEX model:** The cooling circuit shares `heatExchangerTick`
logic. UA parameter sets transfer capacity. cool_in receives cold
water, cool_out emits warm water. The reaction products are cooled
by the internal HEX before exiting mat_out. Temperature cross
checking applies (NNG guarantees T_hot_out ≥ T_cold_in).

**S-Size Limits**

| Param | LL | L | H | HH | Unit |
|-------|-----|---|---|-----|------|
| T | 293 | 323 | 473 | 523 | K |
| P | 0.5 | — | — | 50 | bar |
| ṁ | — | — | — | 0.05 | kg/s |

**Registration:**

```javascript
UnitRegistry.register('fuel_cell', {
  name: 'Fuel Cell',
  category: UnitCategories.REACTOR,
  w: 2, h: 3,
  ports: [
    { portId: 'mat_in_cat', label: 'Fuel (H₂)',     dir: PortDir.IN,  type: StreamType.MATERIAL,   x: 0, y: 0.5 },
    { portId: 'mat_in_ano', label: 'Oxidant (O₂)',  dir: PortDir.IN,  type: StreamType.MATERIAL,   x: 0, y: 1.5 },
    { portId: 'mat_out',    label: 'Exhaust',        dir: PortDir.OUT, type: StreamType.MATERIAL,   x: 2, y: 1 },
    { portId: 'elec_out',   label: 'Power out',      dir: PortDir.OUT, type: StreamType.ELECTRICAL, x: 1, y: 0 },
    { portId: 'cool_in',    label: 'Coolant In',     dir: PortDir.IN,  type: StreamType.MATERIAL,   x: 0, y: 2.5 },
    { portId: 'cool_out',   label: 'Coolant Out',    dir: PortDir.OUT, type: StreamType.MATERIAL,   x: 2, y: 2.5 }
  ],
  presentations: {
    'box/default': { w: 2, h: 3, ports: {
      mat_in_cat: { x: 0, y: 0.5 }, mat_in_ano: { x: 0, y: 1.5 },
      mat_out: { x: 2, y: 1 }, elec_out: { x: 1, y: 0 },
      cool_in: { x: 0, y: 2.5 }, cool_out: { x: 2, y: 2.5 }
    }}
  },
  pressure: {
    role: 'passthrough',
    pairs: [['mat_in_cat', 'mat_out'], ['mat_in_ano', 'mat_out'],
            ['cool_in', 'cool_out']],
    k: 500
  },
  limitParams: ['T', 'P', 'mass'],
  limits: {
    S: {
      T_LL: 293, T_L: 323, T_H: 473, T_HH: 523,
      P_LL: 0.5e5, P_HH: 50e5,
      mass_HH: 0.05
    }
  }
});
```

---

## S6b-3. electrochemicalTick Trunk

Handles both `reactor_electrochemical` (consume mode: P_elec → ξ)
and `fuel_cell` (generate mode: ξ → P_elec). Direction determined
by config or by sign of ΔH_rxn.

The tick function from the original S6 spec is preserved with
these modifications:

1. **heat_out removed.** All waste heat goes into product streams
   (adiabatic). The `if (ports.heat_out !== undefined)` block is
   deleted. Energy balance: `H_total_out = H_in + Q_chem_W + Q_waste_W`
   (consume mode) or `H_total_out = H_in - P_generated - Q_internal`
   (generate mode).

2. **Generate mode (fuel_cell).** When ΔH < 0, the trunk detects
   generate mode:
   - Two material inlets (mat_in_cat + mat_in_ano) merged internally
   - ξ from power demand / |ΔH| / η
   - P_generated = ξ × |ΔH| × η → routed to elec_out
   - Q_waste = ξ × |ΔH| × (1 − η) → stays in products
   - Internal HEX (cool_in/cool_out) removes waste heat from
     products using UA parameter (same as reactor_cooled)

3. **Electrode separation (consume mode only).** O₂ → anode,
   everything else → cathode. Fuel cell has single mixed outlet
   (exhaust = H₂O from H₂ fuel cell, or CO₂ from CO fuel cell).

```javascript
function electrochemicalTick(u, ports, par, ctx) {
  // ── Fry guard (S2) ──
  if (u.fried) {
    u.last = { fried: true, error: {
      severity: 'CRITICAL',
      message: 'Unit destroyed by electrical overload.' }};
    u.powerDemand = 0;
    return;
  }

  // ── Determine mode ──
  const defId = u.defId;
  const isGenerateMode = (defId === 'fuel_cell');

  // ── Feed stream(s) ──
  let sIn;
  if (isGenerateMode) {
    // Merge two inlets
    const sCat = ports.mat_in_cat;
    const sAno = ports.mat_in_ano;
    if (!sCat && !sAno) return;
    sIn = mergeStreams(sCat, sAno);  // helper: molar merge, H additive
  } else {
    sIn = ports.mat_in;
    if (!sIn) return;
  }

  // ── Reaction data ──
  const rxnId = par.reactionId || (isGenerateMode ? 'R_H2_FUELCELL' : 'R_H2O_ELEC');
  const rxn = ReactionRegistry.get(rxnId);
  if (!rxn) {
    u.last = { error: { severity: ErrorSeverity.MAJOR,
      message: `Reaction '${rxnId}' not found.` } };
    return;
  }

  const stoich = rxn.stoich;
  const eta = Math.max(0.001, Math.min(0.99, par.efficiency ?? 0.90));
  const conv_max = Math.max(0.01, Math.min(0.99, par.conversion_max ?? 0.80));
  const dH_rxn = rxn._dH0_Jmol ?? _computeDeltaH(stoich);
  const absDH = Math.abs(dH_rxn);

  if (absDH < 1) {
    u.last = { error: { severity: ErrorSeverity.MAJOR,
      message: 'Reaction ΔH ≈ 0 — no energy to drive.' } };
    return;
  }

  // ── Limiting reactant ──
  const reactants = Object.entries(stoich).filter(([sp, nu]) => nu < 0);
  let xi_max_reactant = Infinity;
  let limitingSpecies = '';

  for (const [sp, nu] of reactants) {
    const n_sp = sIn.n[sp] || 0;
    if (n_sp < 1e-15) {
      u.last = { xi: 0, error: { severity: ErrorSeverity.MAJOR,
        message: `No reactant ${sp} in feed.` } };
      u.powerDemand = 0;
      // Passthrough
      if (isGenerateMode) {
        ports.mat_out = { type: StreamType.MATERIAL, P: sIn.P,
          n: { ...sIn.n }, phaseConstraint: 'VL',
          H_target_Jps: thermo.getHdot_Jps(sIn) };
      } else {
        ports.mat_out_cat = { type: StreamType.MATERIAL, P: sIn.P,
          n: { ...sIn.n }, phaseConstraint: 'VL',
          H_target_Jps: thermo.getHdot_Jps(sIn) };
        ports.mat_out_ano = { type: StreamType.MATERIAL, P: sIn.P,
          n: {}, phaseConstraint: 'V' };
      }
      return;
    }
    const xi_limit = n_sp / Math.abs(nu);
    if (xi_limit < xi_max_reactant) {
      xi_max_reactant = xi_limit;
      limitingSpecies = sp;
    }
  }

  const xi_max = conv_max * xi_max_reactant;

  // ── CONSUME MODE (electrolysis, photosynthesis) ──
  if (!isGenerateMode) {
    // Power demand (S2 contract)
    const P_demand_W = xi_max * absDH / eta;
    u.powerDemand = P_demand_W;

    // Power available
    const sElec = ports.elec_in;
    const P_avail_W = ctx?.scratch?.hubAllocated_W
                    ?? (sElec?.actual ?? sElec?.available ?? 0);

    // Overload check (S2)
    checkOverload(P_avail_W, P_demand_W, u);
    if (u.fried) return;

    // No power → idle
    if (P_avail_W < 1) {
      u.last = {
        xi: 0, P_demand_kW: P_demand_W / 1000, P_avail_kW: 0,
        error: { severity: ErrorSeverity.INFO,
          message: 'No electrical power — reactor idle.' }
      };
      ports.mat_out_cat = { type: StreamType.MATERIAL, P: sIn.P,
        n: { ...sIn.n }, phaseConstraint: 'VL',
        H_target_Jps: thermo.getHdot_Jps(sIn) };
      ports.mat_out_ano = { type: StreamType.MATERIAL, P: sIn.P,
        n: {}, phaseConstraint: 'V' };
      return;
    }

    // Compute extent from available power
    const P_chem_W = P_avail_W * eta;
    let xi = Math.min(P_chem_W / absDH, xi_max, xi_max_reactant * 0.999);

    // Product composition
    const n_total = { ...sIn.n };
    for (const [sp, nu] of Object.entries(stoich)) {
      n_total[sp] = (n_total[sp] || 0) + nu * xi;
      if (n_total[sp] < 0) n_total[sp] = 0;
    }

    // Electrode separation: O₂ → anode, rest → cathode
    const { n_cathode, n_anode } = separateElectrodes(n_total);

    // Energy balance — adiabatic on material side
    // All waste heat stays in products (no heat_out port)
    const H_in = thermo.getHdot_Jps(sIn);
    const Q_chem_W = xi * absDH;
    const Q_waste_W = P_avail_W - Q_chem_W;
    const H_total_out = H_in + P_avail_W;  // all electrical input becomes enthalpy
    // (Q_chem absorbed by reaction + Q_waste warms products)

    const n_cat_total = Object.values(n_cathode).reduce((a, b) => a + b, 0);
    const n_ano_total = Object.values(n_anode).reduce((a, b) => a + b, 0);
    const n_total_out = n_cat_total + n_ano_total;
    const frac_cat = n_total_out > 1e-15 ? n_cat_total / n_total_out : 1;

    ports.mat_out_cat = {
      type: StreamType.MATERIAL, P: sIn.P,
      n: n_cathode, phaseConstraint: 'VL',
      H_target_Jps: H_total_out * frac_cat
    };
    ports.mat_out_ano = {
      type: StreamType.MATERIAL, P: sIn.P,
      n: n_anode, phaseConstraint: 'V',
      H_target_Jps: H_total_out * (1 - frac_cat)
    };

    // Diagnostics
    const powerLimited = P_avail_W < P_demand_W - 1;
    u.last = {
      reactionId: rxnId, reactionName: rxn.name,
      xi_molps: xi,
      conversion_pct: xi_max_reactant > 0 ? (xi / xi_max_reactant) * 100 : 0,
      limitingSpecies, efficiency: eta,
      P_demand_kW: P_demand_W / 1000, P_avail_kW: P_avail_W / 1000,
      Q_chem_kW: Q_chem_W / 1000, Q_waste_kW: Q_waste_W / 1000,
      n_O2_anode: n_anode.O2 || 0, powerLimited
    };
  }

  // ── GENERATE MODE (fuel cell) ──
  else {
    // ξ from power demand on the electrical output
    const P_demand_W = xi_max * absDH * eta;  // max power output
    // (ξ_max × |ΔH| × η = useful electrical from max conversion)

    // Compute extent (fuel cells run at max conversion unless load-limited)
    let xi = xi_max;

    // Apply stoichiometry
    const n_out = { ...sIn.n };
    for (const [sp, nu] of Object.entries(stoich)) {
      n_out[sp] = (n_out[sp] || 0) + nu * xi;
      if (n_out[sp] < 0) n_out[sp] = 0;
    }

    // Energy balance
    const H_in = thermo.getHdot_Jps(sIn);
    const P_generated_W = xi * absDH * eta;
    const Q_waste_W = xi * absDH * (1 - eta);

    // Products carry waste heat (adiabatic before internal HEX)
    const H_products = H_in - P_generated_W;
    // Note: H_in includes the chemical bond energy. Reaction releases
    // |ΔH|×ξ. Of that, η fraction → electricity, (1−η) → products.

    // Internal HEX cooling
    const sCoolIn = ports.cool_in;
    if (sCoolIn) {
      const UA = par.UA ?? 500;
      // ... (shared HEX effectiveness calculation)
      // Q_transferred from products to coolant

      ports.mat_out = {
        type: StreamType.MATERIAL, P: sIn.P,
        n: n_out, phaseConstraint: 'VL',
        H_target_Jps: H_products - Q_transferred + Q_waste_W
      };
      ports.cool_out = {
        type: StreamType.MATERIAL, P: sCoolIn.P,
        n: { ...sCoolIn.n }, phaseConstraint: 'VL',
        H_target_Jps: thermo.getHdot_Jps(sCoolIn) + Q_transferred
      };
    } else {
      // No coolant → WARNING, products very hot
      ports.mat_out = {
        type: StreamType.MATERIAL, P: sIn.P,
        n: n_out, phaseConstraint: 'VL',
        H_target_Jps: H_products + Q_waste_W
      };
      u.last = { ...u.last, error: {
        severity: ErrorSeverity.WARNING,
        message: 'No coolant connected — exhaust extremely hot.'
      }};
    }

    // Electrical output
    ports.elec_out = {
      type: StreamType.ELECTRICAL,
      capacity: P_generated_W,
      actual: P_generated_W,
      available: P_generated_W
    };

    // Diagnostics
    u.last = {
      ...u.last,
      reactionId: rxnId, reactionName: rxn.name,
      xi_molps: xi,
      conversion_pct: xi_max_reactant > 0 ? (xi / xi_max_reactant) * 100 : 0,
      limitingSpecies, efficiency: eta,
      P_generated_kW: P_generated_W / 1000,
      Q_waste_kW: Q_waste_W / 1000
    };
  }
}
```

**Trunk dispatch registration:**

```javascript
TickDispatch.register('reactor_electrochemical', electrochemicalTick);
TickDispatch.register('fuel_cell',               electrochemicalTick);
```

---

## S6b-4. Electrode Separation Rule

Unchanged from original S6 spec. Pure function:

```javascript
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

---

## S6b-5. ReactionRegistry ΔH Precomputation

Unchanged from original S6 spec. Added to `ReactionRegistry.register()`:

```javascript
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

---

## S6b-6. KineticsEval ELECTROCHEMICAL Branch

Unchanged from original S6 spec:

```javascript
if (kin.model === 'ELECTROCHEMICAL') {
  // Rate determined by power input, not temperature/concentration.
  // Return 0 — actual rate computed in electrochemicalTick.
  return 0;
}
```

---

## S6b-7. Inspector

**reactor_electrochemical inspector:** Updated from original S6 spec.
Remove waste heat port display. Add note about adiabatic products.
η range 0.005–0.99 (unchanged).

**fuel_cell inspector:** New.

```javascript
UnitInspector.fuel_cell = {
  params(u) {
    const fcReactions = ReactionRegistry.getAll()
      .filter(r => r._kinetics?.model === 'ELECTROCHEMICAL' && r._dH0_Jmol < 0);

    return [
      { label: 'Reaction', type: 'select',
        options: fcReactions.map(r => ({ value: r.id, label: r.name })),
        get: () => u.params.reactionId,
        set: v => u.params.reactionId = v },
      { label: 'Efficiency (η)',
        get: () => u.params.efficiency ?? 0.60,
        set: v => u.params.efficiency = Math.max(0.30, Math.min(0.85, v)),
        step: 0.01, decimals: 2 },
      { label: 'Max conversion',
        get: () => u.params.conversion_max ?? 0.80,
        set: v => u.params.conversion_max = Math.max(0.01, Math.min(0.99, v)),
        step: 0.01, decimals: 2 },
      { label: 'UA (cooling)',
        get: () => u.params.UA ?? 500,
        set: v => u.params.UA = Math.max(10, Math.min(5000, v)),
        step: 10, decimals: 0 }
    ];
  },
  power(u, ud) {
    if (!ud?.last) return [];
    return [
      { label: 'P generated', value: fmt.kW((ud.last.P_generated_kW || 0) * 1000), tone: 'good' },
      { label: 'Q waste', value: fmt.kW((ud.last.Q_waste_kW || 0) * 1000),
        tone: ud.last.Q_waste_kW > 0.1 ? 'warn' : '' }
    ];
  },
  kpis(u, ud) {
    if (!ud?.last) return [];
    return [
      { label: 'Reaction', value: ud.last.reactionName || '—' },
      { label: 'Conversion', value: `${(ud.last.conversion_pct || 0).toFixed(1)}%` },
      { label: 'ξ', value: `${(ud.last.xi_molps || 0).toFixed(4)} mol/s` },
      { label: 'Limiting', value: ud.last.limitingSpecies || '—' },
      { label: 'Efficiency', value: `${((ud.last.efficiency || 0) * 100).toFixed(0)}%` }
    ];
  }
};
```

---

## S6b Tests (~8)

| # | Test | Setup | Assert |
|---|------|-------|--------|
| 1 | EC: No power → idle | reactor_electrochemical, no elec_in | xi=0, INFO, cathode=passthrough |
| 2 | EC: Full power → max conversion | R_H2O_ELEC, η=0.90, excess power | xi = 0.8 × n_H2O / 2 |
| 3 | EC: Partial power → proportional ξ | 50% of demand power | xi ≈ 50% of max |
| 4 | EC: Electrode separation H₂O | R_H2O_ELEC | cathode: H₂+H₂O, anode: O₂ only |
| 5 | EC: Electrode separation CO₂ | R_CO2_ELEC | cathode: CO+CO₂, anode: O₂ only |
| 6 | EC: Adiabatic products (no heat_out) | η=0.90, check product T | T_out > T_in (waste heat in stream) |
| 7 | FC: Generate mode | R_H2_FUELCELL, H₂+O₂ feed | elec_out.capacity > 0, mat_out has H₂O |
| 8 | FC: No coolant → WARNING | fuel_cell, no cool_in | WARNING alarm, products very hot |

**Gate:** 443 + 8 = 451 cumulative.

---

## Trunk Table (Post-S6)

| Trunk | defIds sharing | Change from baseline |
|-------|---------------|---------------------|
| `equilibriumTick` | reactor_adiabatic, reactor_jacketed, reactor_cooled | Was `reactorTick` with 1 defId. Now 3, config-branched. |
| `electrochemicalTick` | reactor_electrochemical, fuel_cell | EC loses heat_out (4 ports). FC gains cool_in/cool_out (6 ports). |
| `vesselTick` | tank, tank_cryo, reservoir | Unchanged |
| `heatExchangerTick` | hex, air_cooler | Unchanged. Also used internally by reactor_cooled and fuel_cell. |
| `expanderTick` | gas_turbine, steam_turbine | Unchanged |
| `compressorTick` | compressor | Unchanged |
| `separatorTick` | membrane_separator | Unchanged |

---

## Implementation Checklist

```
S6a Session 1 (taxonomy split):
  [ ] Remove reactor_equilibrium from UnitRegistry
  [ ] Register reactor_adiabatic (2 ports)
  [ ] Register reactor_jacketed (3 ports)
  [ ] Register reactor_cooled (4 ports, w:2 h:3)
  [ ] Rename reactorTick → equilibriumTick
  [ ] Implement mode branching in equilibriumTick
  [ ] reactor_cooled internal HEX via heatExchangerTick logic
  [ ] initParams cases for all three defIds
  [ ] Migrate existing reactor tests to new defIds

S6a Session 2 (cleanup + tests):
  [ ] Remove HEAT from StreamType enum
  [ ] Inspector for reactor_adiabatic, reactor_jacketed, reactor_cooled
  [ ] 8 new tests (adiabatic/jacketed/cooled energy balance, mass balance, migration)
  [ ] Verify all pre-S6 tests still pass with migrated defIds

S6b Session 1 (electrochemical + fuel_cell):
  [ ] Revise reactor_electrochemical registration (4 ports, remove heat_out)
  [ ] Revise initParams: efficiency default 0.70 → 0.90
  [ ] Update electrochemicalTick: remove heat_out block, adiabatic products
  [ ] Register fuel_cell (6 ports)
  [ ] Implement generate mode in electrochemicalTick
  [ ] fuel_cell internal HEX for cooling circuit
  [ ] separateElectrodes() pure function (unchanged)
  [ ] ReactionRegistry._dH0_Jmol precomputation (unchanged)
  [ ] KineticsEval ELECTROCHEMICAL branch (unchanged)

S6b Session 2 (inspector + tests):
  [ ] Inspector: reactor_electrochemical (updated, no waste heat display)
  [ ] Inspector: fuel_cell (reaction selector, η, conv_max, UA)
  [ ] 8 new tests (EC idle/full/partial/separation/adiabatic, FC generate/no-coolant)
  [ ] Verify EC test regression (heat_out removal doesn't break mass/energy balance)

Total S6: ~16 new tests → 451 cumulative
```

---

## What S6 Enables Downstream

| Consumer | What it uses from S6 |
|----------|---------------------|
| S7 (Perf Maps) | Reactor conversion maps for all 5 defIds; electrolyzer power curves |
| S9 (Engine Ext) | fuel_cell registration complete; electrochemicalTick trunk shared |
| S9b (Validation) | reactor_adiabatic used inside human composite; reactor_electrochemical inside greenhouse |
| S10 (Game) | M2: O₂ from anode. M3: Sabatier in reactor_adiabatic. M4: combustion adiabatic. M7: Haber adiabatic. M10: photosynthesis in reactor_electrochemical. |
