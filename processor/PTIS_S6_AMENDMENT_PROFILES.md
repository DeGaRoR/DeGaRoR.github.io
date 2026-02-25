# PTIS_S6_AMENDMENT_PROFILES
## S6 Amendment — Combustion Chamber Profile & Diaphragm Compressor
### Addendum to PTIS_S6_SPEC.md

---

## Overview

**What:** Two additions to S6, building on the tier/profile
infrastructure from PTIS_TIER_PROFILE_SPEC.md:

1. **Combustion chamber** — a profile of `reactor_adiabatic` with
   Hastelloy X / TBC limits.  First profile where two equipment
   variants share a defId.  Reverts the provisional T_HH=1573
   widening on the general reactor.

2. **Compressor (Diaphragm)** — a new defId `compressor_diaphragm`
   with 5 ports (mat_in/out + cool_in/out + elec_in).  Shares
   `compressorTick` trunk with `compressor` (piston) but adds
   internal cooling HEX.  Different ports → different defId per
   NNG-3.

**Sessions:** Folded into S6a (reactor work) and S6b (new defId).
No additional sessions — these are organic extensions of planned
S6 work.

**Risk:** Low.  Combustion chamber is pure data (new profile, no
code).  Diaphragm compressor reuses compressorTick + internal HEX
pattern from reactor_cooled (also S6).

**Dependencies:**
- PTIS_TIER_PROFILE_SPEC.md (ProfileRegistry, tier system)
- S6a (reactor_adiabatic defId exists, equilibriumTick trunk)
- S4b (heatExchangerTick logic for internal cooling HEX — optional,
  works with ideal Cp if S4b not yet merged)

---

## 1. Combustion Chamber Profile

### Design Rationale

A gas turbine combustion can is physically an adiabatic reactor:
feed enters, combustion occurs, hot products exit.  The "cooling"
in a real combustion chamber is dilution air — the player controls
this via fuel/air ratio (lean burn).  There is no separate cooling
circuit.  Therefore: same defId as `reactor_adiabatic`, same ports
(mat_in, mat_out), same tick function.

What differs is the metallurgy: Hastelloy X liner with thermal
barrier coating (TBC) instead of SS316L.  This gives dramatically
higher T_HH.  Different ratings, same topology → **profile**.

### Profile Registration

```javascript
ProfileRegistry.register('general_reactor', {
  defId: 'reactor_adiabatic',
  name: 'Reactor (Adiabatic)',
  category: UnitCategories.REACTOR,
  tiers: [1, 2, 3],
  limits: {
    1: { T_LL: 323, T_L: 373, T_H: 773, T_HH: 923,
         P_LL: 50000, P_HH: 15000000, mass_HH: 0.08 },
    2: { T_LL: 273, T_L: 323, T_H: 923, T_HH: 1073,
         P_LL: 50000, P_HH: 25000000, mass_HH: 0.5 },
    3: { T_LL: 223, T_L: 273, T_H: 1073, T_HH: 1273,
         P_LL: 50000, P_HH: 40000000, mass_HH: 5.0 }
  },
  defaults: { reactionId: 'R_SABATIER', useKinetics: true,
              volume_m3: 0.003, alpha: 1.0 },
  config: { mode: 'adiabatic' }
});

ProfileRegistry.register('combustion_chamber', {
  defId: 'reactor_adiabatic',
  name: 'Combustion Chamber',
  category: UnitCategories.REACTOR,
  tiers: [1, 2],
  limits: {
    1: { T_LL: 323, T_L: 373, T_H: 1273, T_HH: 1573,
         P_LL: 50000, P_HH: 5000000, mass_HH: 0.08 },
    2: { T_LL: 323, T_L: 373, T_H: 1573, T_HH: 1873,
         P_LL: 50000, P_HH: 10000000, mass_HH: 0.5 }
  },
  defaults: { reactionId: 'R_H2_COMB', useKinetics: true,
              volume_m3: 0.01, alpha: 1.0 },
  config: { mode: 'adiabatic' },
  milestone: 'M4'
});
```

### Key Differences

| Property | general_reactor | combustion_chamber |
|---|---|---|
| T_HH (T1) | 923 K (SS316L) | 1573 K (Hastelloy X + TBC) |
| P_HH (T1) | 150 bar | 50 bar (thin-walled can) |
| Tiers | [1, 2, 3] | [1, 2] (no T3 — industrial uses ceramic) |
| Default reaction | R_SABATIER | R_H2_COMB |

Note: combustion chamber has *lower* P_HH than general reactor.
A combustion can is a thin-walled liner optimized for thermal
resistance, not pressure containment.  This is a meaningful
engineering tradeoff for the player.

### Revert Provisional T_HH Widening

The v13.1.2 hack that widened reactor_equilibrium T_HH from 923
to 1573 is reverted.  The general_reactor profile gets T_HH=923
(original value).  The combustion_chamber profile gets T_HH=1573.
The TODO comment is removed.

### Demo Scene Update

The demo Brayton combustor unit changes from:
```javascript
{ profileId: 'reactor_equilibrium', tier: 1 }
```
to:
```javascript
{ profileId: 'combustion_chamber', tier: 1 }
```

No other demo changes needed — the combustion chamber profile has
T_HH=1573, so the H₂ combustion at ~700K is well within limits.

---

## 2. Compressor (Diaphragm) — compressor_diaphragm

### Design Rationale

A diaphragm compressor has 5 ports: gas in/out + cooling water
in/out + electrical motor.  The piston compressor has 3 ports
(gas in/out + motor).  Different ports → different defId per NNG-3.

Both share the isentropic compression core (`compressorTick`), but
the diaphragm adds an internal HEX that removes heat from the
compressed gas using the cooling water circuit.  This follows the
exact same pattern as `reactor_cooled` in S6a: adiabatic core
computation first, then internal HEX subtracts heat.

### Spec (from PTIS_COMPRESSOR_HP_SPEC.md, refined)

| Field | Value |
|-------|-------|
| **defId** | `compressor_diaphragm` |
| **Category** | PRESSURE |
| **Footprint** | 2×3 (same as reactor_cooled) |
| **Physical** | Diaphragm compressor with integrated cooling jacket |
| **Trunk** | `compressorTick` (shared with compressor), config: `{ cooled: true }` |

**Ports (5):**

| portId | Direction | Type | Position | Label |
|--------|-----------|------|----------|-------|
| mat_in | IN | MATERIAL | left, y=1 | Gas In |
| mat_out | OUT | MATERIAL | right, y=1 | Gas Out |
| cool_in | IN | MATERIAL | left, y=2 | Coolant In |
| cool_out | OUT | MATERIAL | right, y=2 | Coolant Out |
| elec_in | IN | ELECTRICAL | bottom, x=1 | Motor |

**Parameters:**

| Param | Default | Unit | Notes |
|-------|---------|------|-------|
| Pout | 5000000 | Pa | Discharge pressure (default 50 bar) |
| eta | 0.65 | — | Isentropic efficiency (lower than piston) |
| UA | 500 | W/K | Internal HEX conductance |

### Profiles

```javascript
ProfileRegistry.register('compressor_diaphragm', {
  defId: 'compressor_diaphragm',
  name: 'Compressor (Diaphragm)',
  category: UnitCategories.PRESSURE,
  tiers: [1, 2],
  limits: {
    1: { T_LL: 243, T_L: 263, T_H: 333, T_HH: 353,
         P_LL: 50000, P_L: 100000, P_H: 12000000, P_HH: 15000000,
         mass_HH: 0.05 },
    2: { T_LL: 223, T_L: 243, T_H: 373, T_HH: 393,
         P_LL: 50000, P_L: 100000, P_H: 20000000, P_HH: 25000000,
         mass_HH: 0.2 }
  },
  defaults: { Pout: 5000000, eta: 0.65, UA: 500 },
  config: { cooled: true },
  milestone: 'M5'
});
```

Note: T_HH is low (FKM diaphragm thermal limit) — this is why
the cooling circuit exists.  Without coolant connected, the unit
falls back to adiabatic operation and the diaphragm overheats →
WARNING alarm.

For reference, the piston compressor profile:

```javascript
ProfileRegistry.register('compressor_piston', {
  defId: 'compressor',
  name: 'Compressor (Piston)',
  category: UnitCategories.PRESSURE,
  tiers: [1, 2],
  limits: {
    1: { T_LL: 243, T_L: 263, T_H: 473, T_HH: 523,
         P_LL: 50000, P_L: 80000, P_H: 1200000, P_HH: 1500000,
         mass_HH: 0.08 },
    2: { T_LL: 223, T_L: 243, T_H: 573, T_HH: 623,
         P_LL: 50000, P_L: 80000, P_H: 3000000, P_HH: 5000000,
         mass_HH: 0.3 }
  },
  defaults: { Pout: 300000, eta: 0.80 },
  config: { cooled: false },
  milestone: 'M4'
});
```

### Physics: compressorTick with Cooling

The existing `compressorTick` trunk gains a cooling branch:

```javascript
function compressorTick(u, ports, par, ctx) {
  const config = UnitRegistry.get(u.defId).config || {};

  // ── Step 1: Adiabatic isentropic compression (existing code) ──
  // T_out_adiabatic, W_shaft — unchanged

  if (config.cooled) {
    // ── Step 2: Internal HEX ──
    const coolIn = ports.cool_in;
    if (!coolIn || !coolIn.T) {
      // No coolant → adiabatic fallback + WARNING
      ports.mat_out = { /* adiabatic result */ };
      ports.cool_out = null;
      u.last = { ...u.last, error: {
        severity: ErrorSeverity.WARNING,
        message: 'No coolant — diaphragm overheating.'
      }};
      return;
    }

    // UA-based heat exchange: Q = UA × LMTD
    // Hot side: compressed gas (T_out_adiabatic → T_gas_cooled)
    // Cold side: coolant (T_cool_in → T_cool_out)
    const UA = par.UA || 500;
    // ... LMTD calculation, energy balance ...
    // Same pattern as reactor_cooled internal HEX

    ports.mat_out = { /* cooled gas */ };
    ports.cool_out = { /* warmed coolant */ };
  } else {
    // ── Piston: no cooling (existing code path) ──
    ports.mat_out = { /* adiabatic result */ };
  }
}
```

### Inspector Additions

**compressor_diaphragm inspector** extends compressor inspector:

```javascript
// Additional params beyond Pout and eta:
{ label: 'UA (cooling)', get: () => par.UA ?? 500,
  set: v => par.UA = clamp(v, 10, 5000), step: 10 }

// Additional KPIs:
{ label: 'Q removed', value: fmt.kW(last.Q_removed_W) }
{ label: 'Coolant ΔT', value: fmt.K(last.coolant_dT) }
{ label: 'Gas T after cooling', value: fmt.T(last.T_gas_cooled) }
```

---

## S6 Implementation Checklist Additions

```
S6a (folded into reactor session):
  [ ] ProfileRegistry.register('general_reactor', ...) — T1 limits = original
  [ ] ProfileRegistry.register('combustion_chamber', ...) — T_HH=1573
  [ ] Revert provisional T_HH=1573 on reactor_equilibrium
  [ ] Demo combustor: profileId='combustion_chamber', tier=1
  [ ] 2 new tests: combustion_chamber at 1200K → no alarm;
      general_reactor at 1200K → CATASTROPHIC

S6b (folded into new defId session):
  [ ] UnitRegistry.register('compressor_diaphragm', { 5 ports, w:2 h:3 })
  [ ] compressorTick: config.cooled branch with UA-based internal HEX
  [ ] ProfileRegistry.register('compressor_diaphragm', { tiers: [1,2] })
  [ ] ProfileRegistry.register('compressor_piston', { tiers: [1,2] })
  [ ] Inspector: UA param, Q removed, coolant ΔT
  [ ] No-coolant fallback: adiabatic + WARNING
  [ ] 4 new tests:
      - Diaphragm with coolant: T_out < adiabatic T_out
      - Diaphragm without coolant: WARNING, adiabatic fallback
      - Diaphragm P_HH=150 bar: can reach M5 CO₂ scrubbing pressure
      - Piston P_HH=15 bar: correctly limited for M4 Brayton
```

---

## Affected Specs

This amendment affects:

| Spec | Change |
|---|---|
| PTIS_S6_SPEC.md | Add combustion_chamber profile to S6a. Add compressor_diaphragm defId to S6b. Update trunk table. |
| PTIS_S9_SPEC.md | steam_turbine and tank_cryo: evaluate whether these should be profiles (same ports) or defIds (different physics). Decision tree in NNG-3 applies. |
| PTIS_S10_SPEC.md | Mission palette uses profileId × tier. M4 palette entry: `combustion_chamber: { tier: 1, count: 1 }`. M5: `compressor_diaphragm: { tier: 1, count: 1 }`. |
| PTIS_EQUIPMENT_MATRIX.md | Add combustion_chamber profile limits. Add compressor_diaphragm limits. Add tier columns to all equipment tables. |
| PTIS_ROADMAP.md | Amend S6 scope to include profile POC. Note tier/profile system as S2 continuation. |

---

## Game Progression Impact

| Mission | Equipment | Profile | Tier | What it enables |
|---|---|---|---|---|
| M3 | Sabatier reactor | general_reactor | T1 | CO₂ + H₂ → CH₄ + H₂O |
| M4 | Combustion chamber | combustion_chamber | T1 | H₂ burn → TIT for Brayton |
| M4 | Piston compressor | compressor_piston | T1 | Air to 3-5 bar |
| M5 | Diaphragm compressor | compressor_diaphragm | T1 | CO₂ to ~55 bar for scrubbing |
| M8 | Piston compressor | compressor_piston | T2 | Higher pressure Rankine cycle |
| M10 | General reactor | general_reactor | T2 | SMR at industrial temperatures |
