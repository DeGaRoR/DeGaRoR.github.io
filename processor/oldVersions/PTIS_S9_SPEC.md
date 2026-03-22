# PTIS_S9_SPEC
## S9 — Game Engine Extensions
### processThis v13.8.0 → v13.9.0 (post-S8)

---

## Overview

**What:** Register new unit defIds, species, and reactions required by
the campaign but architecturally part of the simulation engine. These
units share tick trunks with existing units and follow all NNG rules.
They work in sandbox mode regardless of whether the game layer (S10) is
loaded. No game mechanics — pure engine registrations and tests. S9b
adds a validation gate verifying composites and mission flowsheets
before S10.

**Sub-sessions:** 2 (registrations + trunk wiring, then tests +
regression) + 3–5 (validation gate S9b).

**Risk:** Low. All new defIds reuse existing trunk functions with
config-driven branching. No new solver infrastructure. The membrane
separator is the only new trunk (`separatorTick`), and it is a simple
selectivity-map permeation with optional depletion logic.

**Dependencies:**
- S8 (GroupTemplateRegistry — composites in S10c will use these units
  inside group templates, but S9 itself only registers standalone defIds)
- S6 (electrochemicalTick trunk — shared by fuel_cell, includes
  mandatory cooling water circuit)
- S2 (power contracts — fuel_cell in generate mode)
- S1b (reaction registry — R_PHOTOSYNTHESIS and R_METABOLISM follow
  existing ELECTROCHEMICAL and POWER_LAW models)
- S7.3 (time-series recorder — used during validation gate)

**Required by:** S10c (greenhouse and human composite templates reference
membrane_separator, and use R_PHOTOSYNTHESIS / R_METABOLISM).

**Baseline state (post-S8):** Full simulation engine with PR EOS,
distillation, pressure network, electrochemical reactor (2-outlet),
performance maps, unit grouping with templates, scaling mechanism.
476 tests. No steam_turbine, tank_cryo, membrane_separator, or
fuel_cell. No CH₂O species. No photosynthesis/metabolism reactions.

**After S9:** All game-required units, species, and reactions registered.
Sandbox users can place and connect all unit types. Validation gate
confirms composite and mission correctness. ~486 tests (476 + ~10 new).

---

## ⚙ Game Gate

S9 sits immediately after the game gate. Everything S0–S8 is the
general-purpose simulation engine. S9 extends it with registrations
that are motivated by the campaign but are not game-specific — they
are real process equipment, real species, and real reactions that
belong in the engine.

The distinction: S9 adds physics to the engine. S10 adds game
mechanics (state machine, missions, scoring) on top.

---

# S9-1 — Unit Registrations (1 session)

## Shared Tick Trunk Architecture (NNG-3, NNG-10)

Multiple defIds share identical physics via named trunk functions.
No frameworks, no inheritance — just shared function references
with per-defId config:

```javascript
function expanderTick(u, ports, par, ctx) {
  const config = UnitRegistry.get(u.defId).config || {};
  // Shared isentropic expansion logic
  if (config.moistureCheck && outletLiqFrac > config.maxWetness) {
    // Steam turbine only: wet exhaust warning
  }
}
```

### Trunk Inventory

| Trunk | DefIds sharing it | New in S9 |
|---|---|---|
| `vesselTick` | tank, tank_cryo, reservoir | tank_cryo |
| `heatExchangerTick` | hex, air_cooler | — |
| `expanderTick` | gas_turbine, steam_turbine | steam_turbine |
| `compressorTick` | compressor | — |
| `electrochemicalTick` | reactor_electrochemical, fuel_cell | fuel_cell |
| `equilibriumTick` | reactor_adiabatic, reactor_jacketed, reactor_cooled | — |
| `separatorTick` | membrane_separator | membrane_separator (new trunk) |

Note: `fuel_cell` has 6 ports (incl. cool_in/cool_out for mandatory
cooling water circuit). See S6 spec for full electrochemicalTick
trunk implementation.

### When to Create a New defId (NNG-3 Decision Tree)

1. **Different ports** → new defId
2. **Different physics branching** (config flags) → new defId, shared trunk
3. **Different ratings/limits only** → same defId, mission paramLocks
4. **Different capacity only** → same defId, different size (S/M/L)

**Future extension:** If variant count grows beyond paramLocks
(3+ rating variants × 3 sizes per trunk), a profile system could
layer on: `unit.profile` field, profile-specific limit overrides,
palette key `defId/profile`. Not needed for current 10 missions.

---

## steam_turbine

Separate defId sharing `expanderTick` trunk with `gas_turbine`.

| Field | Value |
|-------|-------|
| defId | `steam_turbine` |
| Name | Steam Turbine |
| Category | TURBOMACHINERY |
| Footprint | 2×2 |
| Physical | Axial steam expander with moisture tolerance limit |
| Game intro | M8 — Rankine bottoming cycle |
| Trunk | `expanderTick` (shared with gas_turbine) |
| Config | `{ moistureCheck: true, maxWetness: 0.12 }` |

**Ports** — same as gas_turbine:

| portId | Direction | Type |
|--------|-----------|------|
| mat_in | IN | MATERIAL |
| mat_out | OUT | MATERIAL |
| elec_out | OUT | ELECTRICAL |

**S-Size Limits:**

| Param | LL | L | H | HH | Unit | Notes |
|-------|-----|---|---|-----|------|-------|
| T | 373 | 423 | 773 | 823 | K | Lower max than gas turbine |
| P | 1.5 | — | — | 100 | bar | |
| ṁ | 0.005 | — | — | 0.12 | kg/s | |
| phase | — | — | — | — | — | V preferred, tolerates wet steam ≤12% |

**Moisture check:** If exhaust liquid fraction > 12%, WARNING alarm
("Wet exhaust — blade erosion risk"). CRITICAL if > 25%.

---

## tank_cryo

Separate defId sharing `vesselTick` trunk with `tank`.

| Field | Value |
|-------|-------|
| defId | `tank_cryo` |
| Name | Dewar Tank |
| Category | VESSEL |
| Footprint | 2×2 |
| Physical | Vacuum-insulated storage vessel, multi-layer insulation, boil-off vent |
| Game intro | M9 — cryogenic reserves |
| Trunk | `vesselTick` (shared with tank, reservoir) |

**Ports** — same as tank:

| portId | Direction | Type |
|--------|-----------|------|
| mat_in | IN | MATERIAL |
| mat_out | OUT | MATERIAL |
| overflow | OUT | MATERIAL |

**S-Size Limits:**

| Param | LL | L | H | HH | Unit | Notes |
|-------|-----|---|---|-----|------|-------|
| T | 20 | 50 | 250 | 300 | K | Cryo-rated (vs 263–353 for standard tank) |
| P | 0.5 | — | — | 10 | bar | Fragile vessel (vs 5 bar standard) |
| ṁ | — | — | — | 0.05 | kg/s | |
| level | — | — | 90 | 100 | % | |

**Inventory:** Yes — same as tank. Tracks `{ n: {species: mol}, T, P }`.

---

## membrane_separator

New defId with new dedicated `separatorTick` trunk.

| Field | Value |
|-------|-------|
| defId | `membrane_separator` |
| Name | Membrane Separator |
| Category | SEPARATOR |
| Footprint | 2×2 |
| Physical | Selective membrane unit — not VLE, not flash |
| Game intro | M10 — internal to greenhouse (leaf) and human (kidney) composites. Day-0 LiOH scrubber also uses this defId. |
| Trunk | `separatorTick` (new, dedicated) |

**Ports:**

| portId | Direction | Type |
|--------|-----------|------|
| mat_in | IN | MATERIAL |
| perm_out | OUT | MATERIAL |
| ret_out | OUT | MATERIAL |

**Parameters:**

| Param | Default | Unit | Notes |
|-------|---------|------|-------|
| selectivity | {} | map | `{ species: fraction_to_permeate }`. Unlisted species default to 1.0 (fully permeate). |
| depletable | false | bool | If true, unit has finite sorbent capacity |
| sorbentCapacity | 0 | mol | Total sorbent capacity (e.g. 268 mol for LiOH) |
| sorbentRemaining | 0 | mol | Current sorbent remaining (decremented each tick) |
| maxRate | Infinity | mol/hr | Maximum absorption rate |

**Configurations:**

| Use case | selectivity | depletable | sorbentCapacity | maxRate | Physical analogue |
|----------|------------|-----------|----------------|---------|-------------------|
| Greenhouse leaf | `{ CH2O: 0.05, NH3: 0.05 }` | false | — | — | Stomatal membrane |
| Human kidney | `{ NH3: 0.01 }` | false | — | — | Renal tubule |
| Day-0 LiOH scrubber | `{ CO2: 0.01 }` | true | 268 | 5 | LiOH cartridge stack |

**Physics (`separatorTick`):**

```javascript
function separatorTick(u, ports, par, ctx) {
  const feed = ports.mat_in;
  if (!feed || feed.totalMol < 1e-15) {
    ports.perm_out = emptyStream();
    ports.ret_out  = emptyStream();
    return;
  }

  // Depletion check
  let effectiveSel = par.selectivity || {};
  if (par.depletable) {
    if (par.sorbentRemaining <= 0) {
      // Sorbent depleted — selectivity drops to 0 for all targeted species
      effectiveSel = {};  // everything permeates, nothing captured
    } else {
      // Rate-limit absorption
      const dt_hr = ctx.dt / 3600;
      const maxAbsorb = Math.min(par.sorbentRemaining, par.maxRate * dt_hr);
      // Decrement sorbent based on actual absorbed amount (computed below)
    }
    // WARNING at < 20% remaining
    if (par.sorbentRemaining > 0 &&
        par.sorbentRemaining < 0.2 * par.sorbentCapacity) {
      u._alarms.push({ id: 'sorbent_low', severity: 'WARNING',
        message: `Sorbent at ${(par.sorbentRemaining/par.sorbentCapacity*100).toFixed(0)}%` });
    }
  }

  const permN = {};
  const retN  = {};

  for (const [sp, mol] of Object.entries(feed.n)) {
    const frac = (sp in effectiveSel) ? effectiveSel[sp] : 1.0;
    permN[sp] = mol * frac;
    retN[sp]  = mol * (1 - frac);
  }

  // Decrement sorbent for depletable units
  if (par.depletable && par.sorbentRemaining > 0) {
    const absorbed = Object.entries(retN)
      .filter(([sp]) => sp in (par.selectivity || {}))
      .reduce((sum, [, mol]) => sum + mol, 0);
    const dt_hr = ctx.dt / 3600;
    par.sorbentRemaining = Math.max(0, par.sorbentRemaining - absorbed * dt_hr);
  }

  // Both outlets at feed T, P (no phase change, no energy change)
  ports.perm_out = makeStream(permN, feed.T, feed.P);
  ports.ret_out  = makeStream(retN,  feed.T, feed.P);
}
```

No energy balance needed — membrane permeation at constant T, P.
Mass balance is exact by construction (perm + ret = feed for every
species). This is a simplification of real membrane physics (no
pressure-driven flux, no temperature dependence) appropriate for
the biological abstractions it models.

**Same defId serves greenhouse, human, and LiOH scrubber** with
different selectivity maps and depletion params via config. Follows
NNG-3: same machine, different operating parameters.

---

## fuel_cell (data registration only)

Separate defId sharing `electrochemicalTick` trunk with
`reactor_electrochemical`. **Not used in current 10 missions.**
Registered for sandbox availability and future campaign extensions.

| Field | Value |
|-------|-------|
| defId | `fuel_cell` |
| Name | Fuel Cell |
| Category | REACTION |
| Footprint | 2×3, h:3 |
| Physical | PEM/SOFC stack — reverse electrolysis, generates power |
| Trunk | `electrochemicalTick` (shared with reactor_electrochemical) |
| Config | `{ direction: 'generate' }` |

**Ports (6):**

| portId | Label | Direction | Type |
|--------|-------|-----------|------|
| mat_in_cat | Fuel (H₂) | IN | MATERIAL |
| mat_in_ano | Oxidant (O₂) | IN | MATERIAL |
| mat_out | Exhaust | OUT | MATERIAL |
| elec_out | Power out | OUT | ELECTRICAL |
| cool_in | Coolant in | IN | MATERIAL |
| cool_out | Coolant out | OUT | MATERIAL |

**Mandatory cooling water circuit (NNG-2).** Fuel cell waste heat
is removed via an internal HEX model using UA parameter. Coolant
enters cool_in, absorbs waste heat, exits cool_out. If cool_in is
unconnected, waste heat stays in exhaust products (degraded mode,
WARNING alarm). No HEAT port type — cooling is material flow through
a pipe (NNG-3).

**Reactions:** R_H2_FUELCELL (2H₂+O₂→2H₂O), R_CO_FUELCELL
(2CO+O₂→2CO₂). Both registered in S1b. Trunk detects ΔH<0
→ generate mode (power OUT via elec_out, waste heat removed via
cool_in/cool_out circuit).

---

# S9-2 — Species, Reactions & Tests (1 session)

## New Species

| ID | Formula | Friendly name | MW (g/mol) | Tc (K) | Pc (bar) | ω | ΔHf° (J/mol) | Notes |
|----|---------|---------------|-----------|--------|----------|---|---------------|-------|
| CH2O | CH₂O | Formaldehyde | 30.026 | 408.0 | 65.9 | 0.282 | −115,900 | Food proxy for carbohydrates |

**Registration:**
```javascript
ComponentRegistry.register('CH2O', {
  name: 'Formaldehyde',
  friendlyName: 'Food (CH₂O)',
  formula: 'CH₂O',
  MW: 0.030026,
  Tc: 408.0,
  Pc: 65.9e5,
  omega: 0.282,
  hf0_Jmol: -115900,
  cpigCoeffs: [...],  // NIST Shomate 298–1500 K
  antoineCoeffs: [...] // NIST 254–408 K range
});
```

CH₂O is a gas at 295 K (Tb = 254 K). On the pipe from greenhouse to
human, "food" flows as vapor. Physically odd but thermodynamically
consistent. The composite units abstract this at their boundaries.

**Species total after S9:** 11 (9 baseline + CO from S1a + CH₂O).

## New Reactions

| ID | Friendly name | Equation | ΔH° (J/mol) | Model | Notes |
|----|--------------|----------|-------------|-------|-------|
| R_PHOTOSYNTHESIS | Photosynthesis | CO₂ + H₂O → CH₂O + O₂ | +519,400 | ELECTROCHEMICAL | Light energy = electrical input |
| R_METABOLISM | Metabolism | CH₂O + O₂ → CO₂ + H₂O | −519,400 | POWER_LAW | Complete conversion (K >> 10⁵⁰ at 310 K) |

**R_PHOTOSYNTHESIS** uses ELECTROCHEMICAL model: extent of reaction
proportional to electrical power input ÷ |ΔH|, scaled by efficiency η.
This is the same model as water electrolysis (R_H2O_ELEC) — light
energy replaces electrical energy. The greenhouse's grow lights are
the "electrodes."

**R_METABOLISM** uses POWER_LAW with effectively complete conversion.
At 310 K (body temperature), the equilibrium constant for combustion
of CH₂O is astronomical. `reactor_adiabatic` running R_METABOLISM
achieves >99.999% conversion automatically via the equilibrium
calculation — no special-casing needed.

**Reaction ΔH derivation:**
```
ΔH = ΔHf°(CH₂O,g) + ΔHf°(O₂) − ΔHf°(CO₂) − ΔHf°(H₂O,g)
   = (−115,900) + (0) − (−393,510) − (−241,830)
   = +519,440 J/mol  ≈ +519.4 kJ/mol

R_METABOLISM = −R_PHOTOSYNTHESIS = −519,400 J/mol
```

These are exact reverses. The biosphere energy balance is perfect:
the greenhouse absorbs 519.4 kJ/mol as light, the human releases
519.4 kJ/mol as body heat.

**Friendly names:** All reactions carry both an internal ID (e.g.
`R_H2O_ELEC`) and a user-facing `friendlyName` (e.g. "Water
Electrolysis") displayed in the inspector reaction selector and
mission briefings.

| Internal ID | Friendly Name |
|---|---|
| R_PHOTOSYNTHESIS | Photosynthesis |
| R_METABOLISM | Metabolism |
| R_H2O_ELEC | Water Electrolysis |
| R_CO2_ELEC | CO₂ Electrolysis |
| R_SABATIER | Sabatier Reaction |
| R_CH4_COMB | Methane Combustion |
| R_HABER | Haber Synthesis |
| R_H2_COMB | Hydrogen Combustion |
| R_SMR_OVERALL | Steam Methane Reforming |
| R_SMR | Partial Steam Reforming |
| R_WGS | Water-Gas Shift |
| R_RWGS | Reverse Water-Gas Shift |
| R_COELEC | Co-Electrolysis |
| R_H2_FUELCELL | Hydrogen Fuel Cell |
| R_CO_FUELCELL | CO Fuel Cell |

**Reaction total after S9:** 16 (14 from S1b + 2 new).

---

## Tests (~10)

| # | Test | Assert |
|---|------|--------|
| 1 | steam_turbine registered | UnitRegistry.get('steam_turbine') exists, expanderTick trunk |
| 2 | steam_turbine moisture WARNING | Wet exhaust > 12% → WARNING alarm |
| 3 | tank_cryo registered | UnitRegistry.get('tank_cryo') exists, vesselTick trunk |
| 4 | tank_cryo limits | T_LL=20K, P_HH=10 bar enforced |
| 5 | membrane_separator mass balance | perm + ret = feed for every species |
| 6 | membrane_separator selectivity | NH₃ at selectivity 0.01 → 99% to retentate |
| 7 | membrane_separator depletable | sorbentRemaining decrements; selectivity→0 at depletion; WARNING at <20% |
| 8 | fuel_cell: 6 ports registered | cool_in + cool_out present, no heat_out |
| 9 | CH₂O species registered | ComponentRegistry.get('CH2O') exists, MW ≈ 30.026 |
| 10 | R_PHOTOSYNTHESIS + R_METABOLISM | Both registered, ΔH equal and opposite |

**Gate:** All previous (476) + 10 new → 486 cumulative.

---

# S9b — Validation Gate (3–5 sessions)

**Purpose:** Systematic verification that all composites and mission
scenarios produce physically correct results before S10 game layer
development begins. Uses the S7.3 time-series recorder for data capture.

**Dependencies:** All S0–S9 complete. Recorder (S7.3). Composite
models defined in `PTIS_COMPOSITE_MODELS.md`.

## V-0: Composite Sub-Gate (1 session)

| Step | Test | Pass criteria |
|------|------|--------------|
| V-0a | Human standalone (air + food + water connected, 1 hr) | Rates match PTIS_COMPOSITE_MODELS.md §2.6 |
| V-0b | Human air cut → buffer depletion | WARNING ~3 min, CRITICAL ~5.5 min |
| V-0c | Human water cut → dehydration | WARNING ~36 hr, CRITICAL ~68 hr |
| V-0d | Human food cut → starvation | WARNING ~4 days, CRITICAL ~17 days |
| V-0e | Greenhouse standalone (CO₂ + nutrients + power, 1 hr) | O₂ and CH₂O at expected rates |
| V-0f | Greenhouse nutrient cut → soil buffer depletion | WARNING ~4 hr |
| V-0g | Human + Greenhouse closed loop via room | O₂/CO₂ stabilize, mass balance closes |

## V-1: Core Missions (2 sessions)

M1 (water extraction), M4 (Brayton power), M10 (full biosphere).
End-to-end flowsheets built, run to steady-state, recorder captures
key variables. Verify against PTIS_COMPOSITE_MODELS.md power
budgets and the 82 kW NASA validation target.

## V-2: Remaining Missions (1 session)

M2, M3, M5, M6, M7, M8, M9 spot-checked for convergence, mass
balance closure, and alarm correctness.

## V-gate Session Estimate

| Phase | Sessions |
|-------|----------|
| Composite sub-gate (V-0) | 1 |
| M1, M4, M10 (V-1) | 2 |
| M2–M9 spot checks (V-2) | 1 |
| **Total** | **3–5** |

**No new automated tests from V-gate.** Validation is manual
inspection of recorder traces and mass/energy balances. Results
documented as validation reports. Issues found feed back as
spec amendments before S10.

---

## Implementation Checklist

```
S9-1 (unit registrations):
  [ ] steam_turbine defId registration (expanderTick, moistureCheck config)
  [ ] steam_turbine limits (T_HH=823K, P_HH=100 bar)
  [ ] tank_cryo defId registration (vesselTick, cryo limits)
  [ ] tank_cryo limits (T_LL=20K, P_HH=10 bar)
  [ ] membrane_separator defId registration (new separatorTick trunk)
  [ ] separatorTick implementation (selectivity-map permeation + depletion)
  [ ] Depletable params: sorbentCapacity, sorbentRemaining, maxRate
  [ ] Sorbent WARNING at < 20%, selectivity → 0 when depleted
  [ ] fuel_cell defId registration (electrochemicalTick, generate config)
  [ ] fuel_cell: 6 ports incl. cool_in/cool_out (mandatory cooling)
  [ ] Trunk sharing documentation in code comments

S9-2 (species, reactions, tests):
  [ ] CH₂O species registration (ComponentRegistry)
  [ ] R_PHOTOSYNTHESIS reaction registration (ELECTROCHEMICAL model)
  [ ] R_METABOLISM reaction registration (POWER_LAW model)
  [ ] friendlyName field on all reactions
  [ ] Tests S9 1–10
  [ ] Full regression (476 prior tests pass)

S9b (validation gate — 3–5 sessions):
  [ ] V-0: Composite standalone + closed-loop verification
  [ ] V-1: M1, M4, M10 end-to-end flowsheets
  [ ] V-2: M2–M9 spot checks
  [ ] Recorder traces captured for each validation step
  [ ] Issues documented, amendments filed before S10

Total S9: ~10 new tests → 486 cumulative
  + 3–5 validation sessions (no new automated tests)
```

---

## What S9 Delivers

A complete simulation engine with all process units needed for the
10-mission campaign — plus full sandbox availability. A user who
never touches the game layer can still place a membrane separator,
run photosynthesis in an electrochemical reactor, model a Rankine
cycle with a steam turbine, store cryogenic fluids in a Dewar
tank, or test a fuel cell with mandatory cooling water circuit.

The membrane_separator supports both continuous operation (greenhouse
leaf, human kidney) and depletable sorbent mode (Day-0 LiOH scrubber)
via the same defId with different params.

The validation gate (S9b) confirms that all composite designs from
`PTIS_COMPOSITE_MODELS.md` produce correct steady-state behavior
and that mission-critical flowsheets converge with physically
realistic results before any game layer code is written.

The engine is game-agnostic; the game layer (S10) is
engine-dependent.
