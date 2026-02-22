# PTIS_S1_SPEC
## S1 — Thermo & Chemistry Foundation
### processThis v12.10.0 → v13.1.0

---

## Overview

**What:** Fix thermodynamic data errors, register CO as 10th species,
expand from 3 to 14 reactions, build equipment limits infrastructure
with alarm integration, fix default parameters.

**Sub-sessions:** S1a (1), S1b (1), S1c (2) — 4 sessions total.

**Risk:** Low. Data registration and pure-function infrastructure.
No refactoring of existing tick functions.

**Dependencies:** None. This is the first stage.

**Baseline state:**
- 20 registered unit types
- 9 species (H₂O, O₂, H₂, N₂, Ar, CH₄, He, CO₂, NH₃)
- 3 reactions (R_H2_COMB, R_SABATIER, R_STEAM_REFORM)
- 289 tests (1,810 assertions)

**After S1:**
- 20 unit types (unchanged count; limits added to 12)
- 10 species (+CO)
- 14 reactions (+10 new, +1 rename)
- ~312 tests (+23)

---

# S1-pre — Solver & Power Stream Hardening (Pre-Fix)

Eight fixes identified during solver, power-stream, and code-quality
audits. Most are micro-fixes that close gaps before they become real
problems. S1-pre-6 is a genuine conservation bug on direct-bus
topologies with mixed finite/infinite demand consumers.

**Do these before S1a. No new tests required — existing tests
validate that behaviour is unchanged.**

---

## S1-pre-1. Reactor Skip-When-Clean Cache Hash

**File:** `processThis.html`, reactor_equilibrium tick (~line 9279)

**Current hash:**
```javascript
let _hash = sIn.T * 1e6 + sIn.P + Q_in_W * 1e-3;
for (let i = 0; i < nKeys.length; i++)
  _hash += (sIn.n[nKeys[i]] || 0) * (i + 1) * 7919;
```

**Problem:** Hash captures inlet stream and Q_in but not reactor
parameters. If a player changes reactionId, alpha, volume_m3,
useKinetics, or heatDemand between solves without changing the inlet
stream, the gen-guard prevents a skip within the same solve — but the
warm-start bracket (±10 K from cached T_out) may be wrong for the
new parameters. Completing the hash is cheap insurance.

**Fix:** Add parameter fingerprint to hash:
```javascript
let _hash = sIn.T * 1e6 + sIn.P + Q_in_W * 1e-3;
for (let i = 0; i < nKeys.length; i++)
  _hash += (sIn.n[nKeys[i]] || 0) * (i + 1) * 7919;
// Parameter fingerprint — bust cache on any config change
if (par.reactionId)  _hash += hashString(par.reactionId) * 1e-6;
if (par.alpha != null) _hash += par.alpha * 3571;
if (par.volume_m3)   _hash += par.volume_m3 * 6271;
if (par.useKinetics) _hash += 9901;
if (par.heatDemand)  _hash += hashString(par.heatDemand) * 1e-7;
```

Where `hashString` is a simple DJB2 or FNV hash (add as a 5-line
utility if not already present, or inline with char-code sum).

**Risk:** None. Cache misses more often (correctly), warm start
still narrows bracket when hash matches.

---

## S1-pre-2. Tear Stream Blend Normalization

**File:** `processThis.html`, `blendMaterialStream()` (~line 10453)

**Current:** After blending molar flows with relaxation factor α,
individual species are clamped ≥ 0. Total flow is not renormalized.

**Problem:** Clamping a negative blended flow to zero without
adjusting other species creates a tiny mass imbalance on the tear
stream. For current flowsheets (small recycle fractions, few
species) the effect is below tolerance. With 10 species and deep
recycles (S5 pressure-driven flow), accumulated drift could trigger
spurious mass-balance alarms.

**Fix:** After the clamping loop, add total-flow renormalization:
```javascript
// Renormalize: preserve pre-clamp total to avoid mass drift
if (nTotal > 1e-15) {
  const preClampTotal = Object.values(newS.n).reduce((a,b) => a+b, 0);
  if (preClampTotal > 1e-15 && Math.abs(preClampTotal - nTotal) > 1e-15) {
    const scale = nTotal / preClampTotal;
    for (const sp of species) newS.n[sp] *= scale;
  }
}
```

Where `nTotal` is the sum of raw blended flows before clamping
(capture it before the clamp loop).

**Risk:** None. Only activates when clamping changed the total,
which means a species went negative — an already-abnormal state.

---

## S1-pre-3. Power Read Infinity Fallback

**File:** `processThis.html`, pump tick (~line 7978), compressor tick
(~line 8114), electric_heater tick (~line 8243)

**Current patterns (inconsistent across units):**
```
Pump:       hubAllocated_W ?? (actual ?? available ?? Infinity)
Compressor: hubAllocated_W ?? (actual ?? available ?? Infinity)
Heater:     hubAllocated_W ?? available ?? capacity ?? Infinity
Reactor:    hubAllocated_W ?? available ?? capacity ?? 0        ← correct
```

**Problem:** If `hubAllocated_W` is unset (edge case: consumer
connected to a non-hub, non-grid source that only sets `capacity`),
pump and compressor fall through to `Infinity` and run uncurtailed.
The heater skips `actual` entirely. The reactor is the only unit
that fails safe to 0.

**Fix:** Standardize all four to the same canonical read order:
```javascript
const W_avail = s.hubAllocated_W
  ?? sElec.actual ?? sElec.capacity ?? 0;
```

`actual` first (solver-dispatched value), `capacity` second
(equipment rating), `0` last (fail safe — no power, no work).
Drop `available` from the read chain entirely (it's a deprecated
alias normalized to `capacity` by `normalizeNonMaterialStream()`).

**Risk:** None for hub/direct-bus paths (hubAllocated_W is always
set). Fixes behaviour for edge-case direct connections.

---

## S1-pre-4. Stale HEAT/MECHANICAL Doc Strings

**File:** `processThis.html`, STREAM_CONTRACTS.POWER block (~line 6196),
power_hub header block (~line 7540)

**Current (STREAM_CONTRACTS):**
```javascript
// Applies to ELECTRICAL, MECHANICAL, HEAT.          ← line 6196
doc: 'Applies to ELECTRICAL and HEAT. ...',          ← line 6240
```

**Current (power_hub header):**
```
heat_out (HEAT, OUT) — surplus dissipated as heat    ← line 7548
surplus = ... → heat_out                              ← line 7559
distributes ... and dissipates surplus as heat.       ← line 7543
```

**Problem:** StreamType.HEAT deleted in v12.7.0, MECHANICAL deleted
in v12.6.0. Two authoritative reference points — the stream contract
and the hub architecture header — still describe deleted types and
ports. The hub header describes `heat_out (HEAT, OUT)` but the actual
port is `elec_surplus (ELECTRICAL, OUT)` since v11.0.0.

**Fix (STREAM_CONTRACTS):**
- Line 6196: `// Applies to ELECTRICAL.`
- Line 6240: `doc: 'Applies to ELECTRICAL. All values in watts (W).'`
- Line 6228: Remove `source_mechanical` from the PRODUCER list
  (already migrated to grid_supply in v11.0.0).

**Fix (power_hub header, lines 7540–7570):**
- Line 7543: `distributes to consumers on elec_out, and routes surplus to elec_surplus.`
- Line 7548: `elec_surplus (ELECTRICAL, OUT) — surplus power for dump loads`
- Line 7559: `surplus = max(0, fixed_supply − total_demand) → elec_surplus`

**Risk:** None. Documentation-only changes.

---

## S1-pre-5. Stop Emitting Deprecated `available` on Producers

**File:** `processThis.html`, grid_supply tick (~line 7217),
battery hub output (~line 7667), power_hub Step C outputs
(~lines 11366, 11374), multiConnect aggregation (~line 10859),
`streamSignature()` (~line 10013)

**Current:** Several producers write `available: X` as the primary
field alongside or instead of `capacity`. Consumers then read
`available` in their fallback chains. The `normalizeNonMaterialStream()`
function copies `available` → `capacity`, making it operationally
safe but creating a half-migrated codebase where some paths use
`capacity` and others use `available`.

Additionally, `streamSignature()` includes `available` in the
convergence signature. If any path sets `available` inconsistently
with `capacity` after normalization, `portsChanged()` sees a
spurious delta and forces extra solver iterations.

**Problem:** Not a bug today, but increases risk of future
inconsistency. S2 (Power Management) builds directly on the power
stream contract — starting S2 with a clean single-field convention
avoids carrying the alias debt forward.

**Fix (producers):** At each producer, ensure `capacity` is the
primary field. Keep `available` as a write-through alias for backward
compatibility with any external scene JSON that reads it:
```javascript
// grid_supply example
capacity: maxPower_W,
available: maxPower_W,  // deprecated alias — remove after S2
```

**Fix (streamSignature):** Remove `available` from the convergence
signature (~line 10013). After normalization, `capacity` carries
the same value. Removing the alias from convergence detection
eliminates a class of spurious iteration.

No consumer-side changes needed (S1-pre-3 already removes
`available` from the read chain).

**Risk:** None. `normalizeNonMaterialStream()` already handles
both fields. This makes the code match the documented contract.

---

## S1-pre-6. Direct-Bus Infinity Demand Over-Allocation

**File:** `processThis.html`, Step D (~line 11489)

**Current:** Step D sums downstream demands including Infinity
(from `sink_electrical`), then allocates per consumer:
```javascript
downstreamDemand_W += consumerUD.powerDemand || 0;  // can be Infinity
// ...
curtailmentFactor = isFinite(downstreamDemand_W)
  ? actualDraw_W / downstreamDemand_W : 1.0;        // → 1.0
// ...
allocated = isFinite(consumerDemand)
  ? consumerDemand * curtailmentFactor               // finite: full demand
  : actualDraw_W;                                     // infinite: full draw
```

**Bug:** With grid_supply (20 kW) → [compressor (5 kW) +
sink_electrical (∞)]:
- curtailmentFactor = 1.0 (Infinity guard)
- Compressor gets 5000 × 1.0 = 5000 W
- Sink gets actualDraw_W = 20000 W
- Sum allocated = 25000 > 20000 actual. **Conservation violation.**

The hub path (Step C, line 11293) handles this correctly by clamping
Infinity to total supply before allocation. Step D does not.

**Fix:** Separate finite and infinite consumers, allocate finite
first, give infinite the remainder:
```javascript
// Partition consumers
let finiteDemand_W = 0;
const finiteConsumers = [], infiniteConsumers = [];
for (const conn of outConns) {
  const consumerUD = scene.runtime.unitData.get(conn.to.unitId);
  const d = consumerUD?.powerDemand || 0;
  if (isFinite(d)) {
    finiteDemand_W += d;
    finiteConsumers.push({ conn, demand: d });
  } else {
    infiniteConsumers.push({ conn });
  }
}

const actualDraw_W = Math.min(
  finiteDemand_W + (infiniteConsumers.length > 0 ? maxPower_W : 0),
  maxPower_W
);

// Finite consumers: proportional curtailment
const finiteDraw = Math.min(finiteDemand_W, actualDraw_W);
const finiteFactor = finiteDemand_W > 0
  ? finiteDraw / finiteDemand_W : 1.0;

for (const { conn, demand } of finiteConsumers) {
  const cs = runtimeCtx.scratch(conn.to.unitId);
  cs.hubAllocated_W = demand * finiteFactor;
  cs.hubAllocFactor = finiteFactor;
}

// Infinite consumers: remainder
const remainder = Math.max(0, actualDraw_W - finiteDraw);
const perInf = infiniteConsumers.length > 0
  ? remainder / infiniteConsumers.length : 0;
for (const { conn } of infiniteConsumers) {
  const cs = runtimeCtx.scratch(conn.to.unitId);
  cs.hubAllocated_W = perInf;
  cs.hubAllocFactor = finiteFactor;
}
```

**Risk:** Changes allocation behaviour for direct-bus topologies
with `sink_electrical`. Current behaviour is wrong (over-allocates),
so the change is a correction. All existing tests use hub paths.

---

## S1-pre-7. Zero-Flow Flash Falsy T Guard

**File:** `processThis.html`, solver flash loop (~line 10943)

**Current:**
```javascript
if (!stream.T) stream.T = 298.15;
```

**Problem:** `!stream.T` is true for T=0 (absolute zero) and T=NaN.
T=0 is physically impossible (below flash bounds), but the test
should match the project's convention for "missing" — `undefined` or
`null` — not falsiness. Other T guards in the codebase use explicit
null checks.

**Fix:**
```javascript
if (stream.T == null) stream.T = 298.15;
```

**Risk:** None. T=0 never occurs in practice. Aligns with existing
style conventions throughout the thermo layer.

---

## S1-pre-8. Enforce Structured ud.errors

**File:** `processThis.html`, solver loop and `ctx.warn` definition

**Current:** `ud.errors` receives a mix of structured objects
(`{ severity, message, code }`) and raw strings. The CATASTROPHIC
scan at line 11042 only detects objects:
```javascript
if (err && typeof err === 'object' && err.severity &&
    err.severity.level >= ErrorSeverity.CATASTROPHIC.level)
```

Raw string errors can never trigger `unitFaulted`, even if they
represent fatal conditions. Current raw-string pushes:
- Line 10711: power cycle message (string)
- Line 10741: hub-to-hub message (string)
- Line 10990: flash warning (string)
- Line 11005: flash catch error (string)
- Line 11020: stream type mismatch (string)

Additionally, `ctx.warn` (line 10411) is defined as
`(msg) => ud.errors.push(msg)` with no type enforcement. A future
tick doing `ctx.warn("fatal problem")` would silently fail to
trigger faulted status.

**Fix (solver string pushes):** Wrap each raw string push:
```javascript
// Before:
ud.errors.push(`Flash failed on ${p.portId}: ${err.message}`);
// After:
ud.errors.push({ severity: ErrorSeverity.MINOR,
  message: `Flash failed on ${p.portId}: ${err.message}`,
  code: 'FLASH_EXCEPTION' });
```

Apply to all five string-push sites. Assign appropriate severities:
- Power cycle, hub-to-hub: CATASTROPHIC (already short-circuit)
- Flash warning: INFO
- Flash catch: MAJOR
- Stream type mismatch: MAJOR

**Fix (ctx.warn):** Auto-wrap raw strings:
```javascript
warn: (msg) => {
  if (typeof msg === 'string') {
    ud.errors.push({ severity: ErrorSeverity.MINOR, message: msg });
  } else {
    ud.errors.push(msg);
  }
},
```

**Risk:** Low. Changes the shape of some error entries from string
to object. Any code that reads `ud.errors` as strings (e.g., for
display) already handles both types or uses `.message`. The
`diagnoseErrors()` aggregator already extracts `.message` from
objects.

---

# S1a — Thermo Fixes + CO Species

## S1a-1. H₂O cpig Tmin Fix

**File:** `processThis.html`
**Line:** 3013
**Current:**
```javascript
cpig: { A: 30.09200, B: 6.832514, C: 6.793435, D: -2.534480, E: 0.082139, Tmin: 500, Tmax: 1700 },
```
**Change:** `Tmin: 500` → `Tmin: 298`

**Rationale:** The Shomate coefficients are NIST data valid from 298 K.
The Tmin: 500 triggers unnecessary console warnings for any stream
between 298–500 K (common operating range). The Cp values extrapolate
well — Cp(H₂O,g) varies only 33–35 J/(mol·K) over 200–500 K.

**Risk:** None. Same coefficients, wider validity window.

---

## S1a-2. CO₂ Antoine Liquid-Vapor Range

**File:** `processThis.html`
**Line:** 3189
**Current:**
```javascript
antoine: { A: 9.8106, B: 1347.8, C: 273.0, Tmin: 154, Tmax: 196 },
```
**Change:** Replace single object with array:
```javascript
antoine: [
  { A: 9.8106, B: 1347.8, C: 273.0, Tmin: 154, Tmax: 196, desc: 'Sublimation' },
  { A: 7.5789, B: 861.82, C: 271.88, Tmin: 217, Tmax: 304, desc: 'Liquid-vapor' }
],
```

**Rationale:** The existing Antoine covers only solid-vapor (sublimation,
154–196 K). Liquid CO₂ exists above the triple point (216.6 K, 5.18 bar)
and is important for CO₂ compression, liquefaction, and near-critical
operations. Without this range, `thermo.antoineP(CO2, 250)` returns
nonsense (~0.1 bar instead of correct ~17 bar).

**Code impact:** The existing `thermo.antoineP()` function already handles
array-of-ranges Antoine data (H₂O uses it — see line 3007). No changes
to the Antoine evaluation function needed.

**Data source:** NIST Chemistry WebBook. Liquid-vapor coefficients from
Ambrose (1956), validated range 217–304 K (triple point to critical).

---

## S1a-3. CO Species Registration

**Insert after:** Line 3200 (after CO₂ registration closing `});`)

**New code (~30 lines):**
```javascript
ComponentRegistry.register('CO', {
  name: 'Carbon Monoxide',
  CAS: '630-08-0',
  MW: 28.01040,    // IUPAC 2021: 12.01100 + 15.99940
  Tc: 132.9,       // K
  Pc: 3499000,     // Pa (34.99 bar)
  omega: 0.048,
  Vc: 0.0000930,   // m³/mol
  Zc: 0.292,
  Tb: 81.6,        // K (boiling point at 1 atm)
  Tm: 68.1,        // K (melting point)
  Hv: 6040,        // J/mol (heat of vaporization at NBP)
  phase298: 'gas',
  antoine: { A: 6.24021, B: 230.272, C: 260.0, Tmin: 68, Tmax: 133 },
  // NIST Chemistry WebBook — Shomate equation, gas phase (two ranges)
  cpig: [
    { A: 25.56759, B: 6.096130, C: 4.054656, D: -2.671301, E: 0.131021, Tmin: 298, Tmax: 1300 },
    { A: 35.15070, B: 1.300095, C: -0.205921, D: 0.013550, E: -3.282780, Tmin: 1300, Tmax: 6000 }
  ],
  cpLiq: 60.2,     // J/(mol·K) for liquid CO at ~82 K (NIST)
  rhoLiq: 789,     // kg/m³ (liquid CO at NBP)
  // NIST Chemistry WebBook — gas phase, 298.15 K, 1 bar
  hf0_Jmol: -110530,  // Std enthalpy of formation (J/mol)
  s0_JmolK: 197.660   // Std molar entropy (J/(mol·K))
});
```

**Validation:** CO must pass `ComponentRegistry.validate()` — all required
fields present, MW > 0, Tc > 0, Pc > 0, Shomate ranges cover 298 K.

**Data source:** All values from NIST Chemistry WebBook and NIST-JANAF
Thermochemical Tables (Chase, 1998).

---

## S1a-4. KNOWN_KINETIC_MODELS Update

**File:** `processThis.html`
**Line:** 3329
**Current:**
```javascript
const KNOWN_KINETIC_MODELS = ['POWER_LAW'];
```
**Change:**
```javascript
const KNOWN_KINETIC_MODELS = ['POWER_LAW', 'ELECTROCHEMICAL'];
```

**Rationale:** S1b registers 5 ELECTROCHEMICAL reactions (R_H2O_ELEC,
R_CO2_ELEC, R_COELEC, R_H2_FUELCELL, R_CO_FUELCELL) with
`kinetics: { model: 'ELECTROCHEMICAL' }`. Without this change,
`ReactionRegistry.register()` would throw at line 3331. The
ELECTROCHEMICAL model is data-only until S6 activates it in
`KineticsEval.rate()`.

---

## S1a Tests (~5)

| # | Test | Expected | Assert |
|---|------|----------|--------|
| 1 | `thermo.cpMolar('H2O', 400, 101325)` | Returns value, no console warning | Cp ≈ 34 J/(mol·K) ± 2 |
| 2 | `thermo.antoineP('CO2', 250)` | ≈ 17 bar (1.7 MPa) | Within ± 2 bar of NIST |
| 3 | `thermo.antoineP('CO2', 180)` | Sublimation Psat (uses first range) | > 0 and < 1 bar |
| 4 | `ComponentRegistry.get('CO')` | Returns valid component | MW ≈ 28.01, Tc ≈ 132.9 |
| 5 | `thermo.cpMolar('CO', 500, 101325)` | ≈ 29.2 J/(mol·K) | Within ± 1 of NIST |

**Gate:** All 289 existing + 5 new pass.

---

# S1b — Chemistry Palette

**Depends on:** S1a (CO species must exist for CO-containing reactions;
ELECTROCHEMICAL must be in KNOWN_KINETIC_MODELS).

## S1b-1. Rename R_STEAM_REFORM → R_SMR_OVERALL

**File:** `processThis.html`
**Line:** 3500 (R_STEAM_REFORM registration)
**Current:** `ReactionRegistry.register('R_STEAM_REFORM', { ... })`
**Change:** `ReactionRegistry.register('R_SMR_OVERALL', { ... })`

Also change `name:` from `'Steam Methane Reforming'` to
`'Steam Methane Reforming (Overall)'`.

**importJSON migration** — add to the import migration path:
```javascript
// In scene import, after unit param migration:
for (const [id, u] of scene.units) {
  if (u.params?.reactionId === 'R_STEAM_REFORM') {
    u.params.reactionId = 'R_SMR_OVERALL';
  }
}
```

This ensures saved scenes referencing the old ID continue to load.

---

## S1b-2. New Reaction Registrations

All reactions follow the existing registration pattern (see R_H2_COMB
at line 3435 and R_SABATIER at line 3462 as templates). Insert after
the R_SMR_OVERALL registration.

### R_HABER — Ammonia Synthesis

```javascript
ReactionRegistry.register('R_HABER', {
  name: 'Haber-Bosch Ammonia Synthesis',
  equation: 'N₂ + 3 H₂ ⇌ 2 NH₃',
  stoich: { N2: -1, H2: -3, NH3: 2 },
  reversible: true,
  Tmin_K: 573,
  Tmax_K: 873,
  Pmin_Pa: 5000000,     // 50 bar
  Pmax_Pa: 30000000,    // 300 bar
  notes: 'Exothermic, Δν = −2. Favored at low T, high P. Fe₃O₄ or Ru catalyst.',
  references: [{ source: 'NIST-JANAF', detail: 'Chase 1998' }],
  kinetics: {
    model: 'POWER_LAW',
    A: 8.85e4,
    beta: 0,
    Ea_Jmol: 170000,    // ~170 kJ/mol (dissociative N₂ adsorption)
    orders: { N2: 1, H2: 1.5 },
    references: [{ source: 'Temkin & Pyzhev (adapted)',
      detail: 'Global power-law fit for educational use.' }]
  }
});
```
**ΔH° = −91,796 J/mol** (computed from NIST formation enthalpies).

### R_SMR — Steam Methane Reforming (Stepwise)

```javascript
ReactionRegistry.register('R_SMR', {
  name: 'Steam Methane Reforming',
  equation: 'CH₄ + H₂O → CO + 3 H₂',
  stoich: { CH4: -1, H2O: -1, CO: 1, H2: 3 },
  reversible: true,
  Tmin_K: 700,
  Tmax_K: 1200,
  Pmin_Pa: 100000,
  Pmax_Pa: 5000000,
  notes: 'Strongly endothermic. First step of industrial SMR (produces syngas). Ni catalyst.',
  references: [{ source: 'NIST-JANAF', detail: 'Chase 1998' }],
  kinetics: {
    model: 'POWER_LAW',
    A: 2.0e5,
    beta: 0,
    Ea_Jmol: 100000,
    orders: { CH4: 1, H2O: 0.5 },
    references: [{ source: 'Xu & Froment 1989 (adapted)',
      detail: 'AIChE J. 35, 88-96.' }]
  }
});
```
**ΔH° = +206,000 J/mol.**

### R_WGS — Water-Gas Shift

```javascript
ReactionRegistry.register('R_WGS', {
  name: 'Water-Gas Shift',
  equation: 'CO + H₂O ⇌ CO₂ + H₂',
  stoich: { CO: -1, H2O: -1, CO2: 1, H2: 1 },
  reversible: true,
  Tmin_K: 473,
  Tmax_K: 1073,
  Pmin_Pa: 100000,
  Pmax_Pa: 5000000,
  notes: 'Mildly exothermic. Δν = 0 (pressure-independent). Fe₃O₄ (HTS) or Cu/ZnO (LTS).',
  references: [{ source: 'NIST-JANAF', detail: 'Chase 1998' }],
  kinetics: {
    model: 'POWER_LAW',
    A: 1.0e4,
    beta: 0,
    Ea_Jmol: 47400,
    orders: { CO: 1, H2O: 0.5 },
    references: [{ source: 'Moe 1962 (adapted)',
      detail: 'Chem. Eng. Progress 58(3), 33-36.' }]
  }
});
```
**ΔH° = −41,200 J/mol.**

### R_RWGS — Reverse Water-Gas Shift

```javascript
ReactionRegistry.register('R_RWGS', {
  name: 'Reverse Water-Gas Shift',
  equation: 'CO₂ + H₂ → CO + H₂O',
  stoich: { CO2: -1, H2: -1, CO: 1, H2O: 1 },
  reversible: true,
  Tmin_K: 573,
  Tmax_K: 1200,
  Pmin_Pa: 100000,
  Pmax_Pa: 5000000,
  notes: 'Endothermic. Reverse of WGS. Favored at high T. CO₂ utilization pathway.',
  references: [{ source: 'NIST-JANAF', detail: 'Chase 1998' }],
  kinetics: {
    model: 'POWER_LAW',
    A: 1.0e4,
    beta: 0,
    Ea_Jmol: 47400,
    orders: { CO2: 1, H2: 0.5 },
    references: [{ source: 'Moe 1962 (adapted)', detail: 'Reverse direction.' }]
  }
});
```
**ΔH° = +41,200 J/mol.**

### R_CH4_COMB — Methane Combustion

```javascript
ReactionRegistry.register('R_CH4_COMB', {
  name: 'Methane Combustion',
  equation: 'CH₄ + 2 O₂ → CO₂ + 2 H₂O',
  stoich: { CH4: -1, O2: -2, CO2: 1, H2O: 2 },
  reversible: false,
  Tmin_K: 500,
  Tmax_K: 3000,
  Pmin_Pa: 50000,
  Pmax_Pa: 5000000,
  notes: 'Strongly exothermic. Complete combustion. Primary fuel for Brayton cycle (M4).',
  references: [{ source: 'NIST-JANAF', detail: 'Chase 1998' }],
  kinetics: {
    model: 'POWER_LAW',
    A: 1.3e8,
    beta: 0,
    Ea_Jmol: 125000,
    orders: { CH4: 0.7, O2: 0.8 },
    references: [{ source: 'Westbrook & Dryer 1981 (adapted)',
      detail: 'Combust. Sci. Tech. 27, 31-43.' }]
  }
});
```
**ΔH° = −802,600 J/mol.**

### R_H2O_ELEC — Water Electrolysis (Data Only)

```javascript
ReactionRegistry.register('R_H2O_ELEC', {
  name: 'Water Electrolysis',
  equation: '2 H₂O → 2 H₂ + O₂',
  stoich: { H2O: -2, H2: 2, O2: 1 },
  reversible: false,
  Tmin_K: 298,
  Tmax_K: 473,
  Pmin_Pa: 100000,
  Pmax_Pa: 10000000,
  notes: 'Electrochemical. Power drives the reaction. PEM or alkaline cell. Primary O₂ source (M2).',
  references: [{ source: 'NIST-JANAF', detail: 'Chase 1998' }],
  kinetics: {
    model: 'ELECTROCHEMICAL'
    // No A, Ea, orders — rate determined by power input (S6 implementation)
  }
});
```
**ΔH° = +483,600 J/mol** (reverse of R_H2_COMB).

### R_CO2_ELEC — CO₂ Electrolysis (Data Only)

```javascript
ReactionRegistry.register('R_CO2_ELEC', {
  name: 'CO₂ Electrolysis',
  equation: '2 CO₂ → 2 CO + O₂',
  stoich: { CO2: -2, CO: 2, O2: 1 },
  reversible: false,
  Tmin_K: 298,
  Tmax_K: 1273,
  Pmin_Pa: 100000,
  Pmax_Pa: 5000000,
  notes: 'Electrochemical (SOEC). CO₂ → CO + O₂. Sandbox option alongside R_H2O_ELEC.',
  references: [{ source: 'NIST-JANAF', detail: 'Chase 1998' }],
  kinetics: {
    model: 'ELECTROCHEMICAL'
  }
});
```
**ΔH° = +566,000 J/mol** (computed from NIST formation enthalpies of CO₂ and CO).

### R_COELEC — Co-Electrolysis (Data Only)

```javascript
ReactionRegistry.register('R_COELEC', {
  name: 'Co-Electrolysis (SOEC)',
  equation: 'CO₂ + H₂O → CO + H₂ + O₂',
  stoich: { CO2: -1, H2O: -1, CO: 1, H2: 1, O2: 1 },
  reversible: false,
  Tmin_K: 923,
  Tmax_K: 1273,
  Pmin_Pa: 100000,
  Pmax_Pa: 3000000,
  notes: 'SOEC co-electrolysis. Produces syngas (CO+H₂) + O₂ in one step. More efficient than separate H₂O + CO₂ electrolysis. Late-game unlock.',
  references: [{ source: 'NIST-JANAF', detail: 'Chase 1998' }],
  kinetics: { model: 'ELECTROCHEMICAL' }
});
```
**ΔH° = +524,806 J/mol** (sum of CO₂→CO and H₂O→H₂ bond energies).
Electrode separation: CO + H₂ + unreacted feed → cathode, O₂ → anode.

### R_H2_FUELCELL — Hydrogen Fuel Cell (Data Only)

```javascript
ReactionRegistry.register('R_H2_FUELCELL', {
  name: 'Hydrogen Fuel Cell',
  equation: '2 H₂ + O₂ → 2 H₂O',
  stoich: { H2: -2, O2: -1, H2O: 2 },
  reversible: false,
  Tmin_K: 298,
  Tmax_K: 1273,
  Pmin_Pa: 100000,
  Pmax_Pa: 5000000,
  notes: 'Reverse electrolysis — generates power. H₂ at cathode, O₂ at anode. Data only until fuel_cell unit registered.',
  references: [{ source: 'NIST-JANAF', detail: 'Chase 1998' }],
  kinetics: { model: 'ELECTROCHEMICAL' }
});
```
**ΔH° = −483,652 J/mol** (exothermic — generates electrical power).

### R_CO_FUELCELL — CO Fuel Cell (Data Only)

```javascript
ReactionRegistry.register('R_CO_FUELCELL', {
  name: 'CO Solid Oxide Fuel Cell',
  equation: '2 CO + O₂ → 2 CO₂',
  stoich: { CO: -2, O2: -1, CO2: 2 },
  reversible: false,
  Tmin_K: 923,
  Tmax_K: 1273,
  Pmin_Pa: 100000,
  Pmax_Pa: 5000000,
  notes: 'SOFC — CO as fuel. Generates power. CO at cathode, O₂ at anode. Data only until fuel_cell unit registered.',
  references: [{ source: 'NIST-JANAF', detail: 'Chase 1998' }],
  kinetics: { model: 'ELECTROCHEMICAL' }
});
```
**ΔH° = −565,960 J/mol** (exothermic — generates electrical power).

---

## S1b Reaction Summary After Completion (14 total)

| # | ID | Equation | ΔH° (kJ/mol) | Kinetics | Status |
|---|-----|----------|-------------|----------|--------|
| 1 | R_H2_COMB | 2H₂ + O₂ → 2H₂O | −484 | POWER_LAW | existing |
| 2 | R_SABATIER | CO₂ + 4H₂ → CH₄ + 2H₂O | −165 | POWER_LAW | existing |
| 3 | R_SMR_OVERALL | CH₄ + 2H₂O → CO₂ + 4H₂ | +165 | POWER_LAW | **renamed** |
| 4 | R_HABER | N₂ + 3H₂ ⇌ 2NH₃ | −92 | POWER_LAW | **new** |
| 5 | R_SMR | CH₄ + H₂O → CO + 3H₂ | +206 | POWER_LAW | **new** |
| 6 | R_WGS | CO + H₂O ⇌ CO₂ + H₂ | −41 | POWER_LAW | **new** |
| 7 | R_RWGS | CO₂ + H₂ → CO + H₂O | +41 | POWER_LAW | **new** |
| 8 | R_CH4_COMB | CH₄ + 2O₂ → CO₂ + 2H₂O | −803 | POWER_LAW | **new** |
| 9 | R_H2O_ELEC | 2H₂O → 2H₂ + O₂ | +484 | ELECTROCHEMICAL | **new (data)** |
| 10 | R_CO2_ELEC | 2CO₂ → 2CO + O₂ | +566 | ELECTROCHEMICAL | **new (data)** |
| 11 | R_COELEC | CO₂ + H₂O → CO + H₂ + O₂ | +525 | ELECTROCHEMICAL | **new (data)** |
| 12 | R_H2_FUELCELL | 2H₂ + O₂ → 2H₂O | −484 | ELECTROCHEMICAL | **new (data)** |
| 13 | R_CO_FUELCELL | 2CO + O₂ → 2CO₂ | −566 | ELECTROCHEMICAL | **new (data)** |
| 14 | ~~R_H2O_FORM~~ | ~~phantom — never existed in code~~ | — | — | removed from specs |

**Species coverage after S1b:** 10 species (H₂O, O₂, H₂, N₂, Ar, CH₄, He, CO₂, NH₃, CO).
Every C/H/O/N species reachable via at least one reaction.

---

## S1b Tests (~8)

| # | Test | Expected | Assert |
|---|------|----------|--------|
| 1 | R_HABER mass balance: N₂ + 3H₂ → 2NH₃ | Δmass = 0 | abs(Σ(ν×MW)) < 1e-6 |
| 2 | R_SMR mass balance: CH₄ + H₂O → CO + 3H₂ | Δmass = 0 | abs(Σ(ν×MW)) < 1e-6 |
| 3 | R_WGS mass balance: CO + H₂O → CO₂ + H₂ | Δmass = 0 | abs(Σ(ν×MW)) < 1e-6 |
| 4 | R_CH4_COMB mass balance | Δmass = 0 | abs(Σ(ν×MW)) < 1e-6 |
| 5 | R_H2O_ELEC: registered, model = 'ELECTROCHEMICAL' | No throw | .kinetics.model === 'ELECTROCHEMICAL' |
| 6 | R_CO2_ELEC: registered, model = 'ELECTROCHEMICAL' | No throw | .kinetics.model === 'ELECTROCHEMICAL' |
| 7 | R_COELEC: registered, mass balance | No throw | abs(Σ(ν×MW)) < 1e-6, .kinetics.model === 'ELECTROCHEMICAL' |
| 8 | R_H2_FUELCELL: registered, ΔH < 0 | No throw | ._dH0_Jmol < 0, .kinetics.model === 'ELECTROCHEMICAL' |
| 9 | R_CO_FUELCELL: registered, ΔH < 0 | No throw | ._dH0_Jmol < 0, .kinetics.model === 'ELECTROCHEMICAL' |
| 10 | R_SMR_OVERALL: import migration | Scene with old 'R_STEAM_REFORM' loads | unit.params.reactionId === 'R_SMR_OVERALL' |
| 11 | Demo scene (Sabatier loop) still loads + solves | No regression | Same CH₄ production ± 1% |

**Gate:** All S1a tests + 11 new pass.

---

# S1c — Equipment Limits Infrastructure

**Depends on:** S1a (alarm schema extensions used by limit alarms).
**Sessions:** 2 (one for infrastructure code, one for limit data + tests).

## S1c-1. LIMIT_PARAM_TEMPLATES Dictionary

**Insert location:** After UnitRegistry definition, before unit registrations.

```javascript
const LIMIT_PARAM_TEMPLATES = {
  T: {
    label: 'Temperature',
    unit: 'K',
    tags: ['LL', 'L', 'H', 'HH'],
    severity: { LL: 'CRITICAL', L: 'WARNING', H: 'WARNING', HH: 'CRITICAL' },
    getter: 'T'   // key for getLimitParam dispatch
  },
  P: {
    label: 'Pressure',
    unit: 'bar',
    tags: ['LL', 'L', 'H', 'HH'],
    severity: { LL: 'CRITICAL', L: 'WARNING', H: 'WARNING', HH: 'CRITICAL' },
    getter: 'P'
  },
  mass: {
    label: 'Mass flow',
    unit: 'kg/s',
    tags: ['LL', 'L', 'H', 'HH'],
    severity: { LL: 'CRITICAL', L: 'WARNING', H: 'WARNING', HH: 'CRITICAL' },
    getter: 'mass'
  },
  phase: {
    label: 'Phase constraint',
    type: 'enum',
    severity: { violation: 'CRITICAL' },
    getter: 'phase'
  },
  level: {
    label: 'Fill level',
    unit: '%',
    tags: ['H', 'HH'],
    severity: { H: 'WARNING', HH: 'CRITICAL' },
    getter: 'level'
  }
};
```

---

## S1c-2. limitParams on 12 Unit Definitions

Add `limitParams` array to each unit definition object (inside the
`UnitRegistry.register(...)` call). This tells the limit system which
parameters to evaluate for this unit type.

```
compressor:          limitParams: ['T', 'P', 'mass', 'phase']
pump:                limitParams: ['T', 'P', 'mass', 'phase']
gas_turbine:         limitParams: ['T', 'P', 'mass', 'phase']
electric_heater:     limitParams: ['T', 'P', 'mass']
air_cooler:          limitParams: ['T', 'P', 'mass']
hex:                 limitParams: ['T', 'P', 'mass']
valve:               limitParams: ['T', 'P', 'mass']
flash_drum:          limitParams: ['T', 'P', 'mass']
mixer:               limitParams: ['T', 'P', 'mass']
splitter:            limitParams: ['T', 'P', 'mass']
reactor_equilibrium: limitParams: ['T', 'P', 'mass', 'phase']
tank:                limitParams: ['T', 'P', 'mass', 'level']
```

12 units total. `reactor_adiabatic` does not exist — subsumed by
`reactor_equilibrium` in v12.0.0 (line 9133 confirms deletion).

---

## S1c-3. S-Size Limit Data

Add `limits` object to each unit definition, nested under a `S` key
(size tier). Values from PTIS_EQUIPMENT_MATRIX §1 Limits tables.

```javascript
// Example: compressor
limits: {
  S: {
    T_LL: 243, T_L: 263, T_H: 333, T_HH: 353,  // K
    P_LL: 0.5e5, P_HH: 150e5,                    // Pa (0.5–150 bar)
    mass_HH: 0.05,                                 // kg/s
    phase_required: 'V'
  }
}

// Example: tank
limits: {
  S: {
    T_LL: 263, T_L: 278, T_H: 333, T_HH: 353,
    P_LL: 0.8e5, P_HH: 5e5,
    mass_HH: 0.05,
    level_H: 90, level_HH: 100
  }
}
```

**Full limit data table (all values in SI):**

| defId | T_LL | T_L | T_H | T_HH | P_LL (Pa) | P_HH (Pa) | ṁ_LL | ṁ_HH | phase | level_H | level_HH |
|-------|------|-----|-----|------|-----------|-----------|------|------|-------|---------|----------|
| compressor | 243 | 263 | 333 | 353 | 0.5e5 | 150e5 | — | 0.05 | V | — | — |
| pump | 263 | 278 | 353 | 393 | 0.5e5 | 50e5 | — | 0.12 | L | — | — |
| gas_turbine | 323 | 373 | 873 | 1023 | 1.5e5 | 150e5 | 0.005 | 0.12 | V | — | — |
| electric_heater | 253 | 273 | 723 | 823 | 0.2e5 | 150e5 | 0.002 | 0.12 | — | — | — |
| air_cooler | 253 | 273 | 623 | 723 | 0.2e5 | 150e5 | — | 0.12 | — | — | — |
| hex | 243 | 263 | 573 | 673 | 0.2e5 | 150e5 | — | 0.12 | — | — | — |
| valve | 243 | 263 | 523 | 623 | — | 150e5 | — | 0.25 | — | — | — |
| flash_drum | 243 | 263 | 523 | 623 | 0.2e5 | 150e5 | — | 0.15 | — | — | — |
| mixer | 243 | 263 | 623 | 723 | 0.2e5 | 150e5 | — | 0.25 | — | — | — |
| splitter | 243 | 263 | 623 | 723 | 0.2e5 | 150e5 | — | 0.25 | — | — | — |
| reactor_equilibrium | 323 | 373 | 773 | 923 | 0.5e5 | 150e5 | 0.001 | 0.08 | V | — | — |
| tank | 263 | 278 | 333 | 353 | 0.8e5 | 5e5 | — | 0.05 | — | 90 | 100 |

**Note:** `—` means limit tag not defined (no alarm for that boundary).
P values stored in Pa internally. Displayed as bar in inspector.

---

## S1c-4. getLimitParam()

Pure function. Reads the actual runtime value for a given limit parameter
from a unit's stream data.

```javascript
function getLimitParam(param, def, unit, unitData) {
  const stream = _findPrimaryStream(def, unit, unitData);
  if (!stream) return null;

  switch (param) {
    case 'T': return stream.T;           // K
    case 'P': return stream.P;           // Pa
    case 'mass': return _computeMassRate(stream);  // kg/s
    case 'phase': return stream.phase;   // 'V', 'L', 'VL'
    case 'level': return unitData?.last?.fillLevel_pct ?? null;
    default: return null;
  }
}
```

**_findPrimaryStream(def, unit, unitData):** Returns the stream most
representative of the unit's operating state. For most units this is the
outlet stream. For the tank it's the stored inventory. The function walks
`unitData.last` for stream data already computed by the tick function.

**_computeMassRate(stream):** Σ(n_i × MW_i) over stream.n, in kg/s.

---

## S1c-5. getEffectiveLimits()

Three-layer merge: definition → mission → player. Currently only the
definition layer exists. The function signature includes `mission` for
future use (S8).

```javascript
function getEffectiveLimits(def, unit, mission) {
  const base = def.limits?.[unit.params?.size || 'S'] || {};
  const missionOverrides = mission?.limitOverrides?.[def.defId] || {};
  const playerOverrides = unit.limitOverrides || {};
  return { ...base, ...missionOverrides, ...playerOverrides };
}
```

5 lines. This is the sole indirection point between raw limit data and
all consumers (evaluateLimits, performance maps, inspector bars).

---

## S1c-6. evaluateLimits()

Pure function. Returns array of limit violation objects.

```javascript
function evaluateLimits(def, unit, unitData, mission) {
  if (!def.limitParams) return [];

  const limits = getEffectiveLimits(def, unit, mission);
  const violations = [];

  for (const param of def.limitParams) {
    const tmpl = LIMIT_PARAM_TEMPLATES[param];
    if (!tmpl) continue;

    const actual = getLimitParam(param, def, unit, unitData);
    if (actual == null) continue;

    if (tmpl.type === 'enum') {
      // Phase constraint check
      const required = limits[`${param}_required`];
      if (required && actual !== required && actual !== 'VL') {
        violations.push({
          id: `${unit.id}_limit_${param}`,
          category: 'EQUIPMENT_LIMIT',
          severity: tmpl.severity.violation,
          message: `${def.name}: ${tmpl.label} violation — ${actual} (required: ${required})`,
          unitId: unit.id,
          paramName: param,
          paramValue: actual,
          limitTag: 'required',
          limitValue: required,
          source: 'evaluateLimits'
        });
      }
      continue;
    }

    // Numeric limit checks: LL, L, H, HH
    for (const tag of (tmpl.tags || [])) {
      const limitVal = limits[`${param}_${tag}`];
      if (limitVal == null) continue;

      let violated = false;
      if (tag === 'LL' || tag === 'L') violated = actual < limitVal;
      if (tag === 'H' || tag === 'HH') violated = actual > limitVal;

      if (violated) {
        violations.push({
          id: `${unit.id}_limit_${param}_${tag}`,
          category: 'EQUIPMENT_LIMIT',
          severity: tmpl.severity[tag],
          message: `${def.name}: ${tmpl.label} ${tag} — ${actual.toFixed(1)} ${tmpl.unit} (limit: ${limitVal})`,
          unitId: unit.id,
          paramName: param,
          paramValue: actual,
          limitTag: tag,
          limitValue: limitVal,
          source: 'evaluateLimits'
        });
      }
    }
  }

  return violations;
}
```

**Alarm schema extension:** Each violation object includes `paramName`,
`paramValue`, `limitTag`, `limitValue`, and `source` — extending the
existing alarm schema (see ErrorSeverity at line 6036).

---

## S1c-7. Alarm Source Registration

Register a limit-evaluation alarm source in the existing alarm pipeline.
This runs once per `AlarmSystem.evaluate(scene)` call.

```javascript
AlarmSystem.register('equipment_limits', (scene) => {
  const violations = [];
  for (const [id, unit] of scene.units) {
    const def = UnitRegistry.get(unit.defId);
    if (!def?.limitParams) continue;
    const ud = scene.unitData?.get(id) || unit;
    violations.push(...evaluateLimits(def, unit, ud, scene.mission));
  }
  return violations;
});
```

---

## S1c-8. _rationalize() Skeleton

If `AlarmSystem._rationalize` does not yet exist, add it. Dedup by `id`,
keeping highest severity when duplicates exist.

```javascript
AlarmSystem._rationalize = function(alarms) {
  const byId = new Map();
  const severityRank = { CRITICAL: 4, ERROR: 3, WARNING: 2, INFO: 1, OK: 0 };
  for (const a of alarms) {
    const existing = byId.get(a.id);
    if (!existing || (severityRank[a.severity] || 0) > (severityRank[existing.severity] || 0)) {
      byId.set(a.id, a);
    }
  }
  return [...byId.values()];
};
```

---

## S1c-9. Default Parameter Fixes

### Tank volume

**File:** `processThis.html`
**Line:** 9457
**Current:**
```javascript
unit.params = { volume_m3: 50, drawRate: 1.0 };  // 50 m³, 1 mol/s draw
```
**Change:**
```javascript
unit.params = { volume_m3: 0.15, drawRate: 1.0 };  // 0.15 m³ S-size, 1 mol/s draw
```

**Rationale:** 50 m³ is industrial scale. The S-size pilot plant scale
is 0.15 m³ (150 liters). See PTIS_EQUIPMENT_MATRIX §1.3.

### Reactor volume

**File:** `processThis.html`
**Line:** 9493
**Current:**
```javascript
unit.params = { reactionId: 'R_H2_COMB', useKinetics: true, volume_m3: 1.0, alpha: 1.0, heatDemand: 'none', variant: 'insulated' };
```
**Change:** `volume_m3: 1.0` → `volume_m3: 0.003`

**Rationale:** 1.0 m³ is industrial. S-size is 3 liters (0.003 m³),
consistent with GHSV 10,000–50,000 hr⁻¹ at pilot flows.

### Air cooler default params

**File:** `processThis.html`
**Line:** ~9485 (add case before the comment `// ── Units with no params`)
**Add:**
```javascript
case 'air_cooler':
  unit.params = { T_approach: 10 };  // 10 K above ambient
  break;
```

**Note:** The air_cooler tick function already reads `par.T_out` with a
fallback to `T_amb + 10`. This default makes the approach explicit and
inspectable. The `T_approach` param name is used for S7 performance map
consistency; the tick function should be updated to use
`par.T_approach || par.T_out || (T_amb + 10)` for backward compatibility.

---

## S1c Tests (~10)

| # | Test | Expected | Assert |
|---|------|----------|--------|
| 1 | evaluateLimits: compressor T = 400 K | T > T_HH (353 K) → CRITICAL | violations[0].severity === 'CRITICAL' |
| 2 | evaluateLimits: pump P = 30,000 Pa | P < P_LL (0.5 bar) → CRITICAL | violations[0].limitTag === 'LL' |
| 3 | evaluateLimits: compressor phase = 'L' | Phase violation → CRITICAL | violations[0].paramName === 'phase' |
| 4 | evaluateLimits: compressor T = 340 K | T between H (333) and HH (353) → WARNING | violations[0].severity === 'WARNING' |
| 5 | evaluateLimits: compressor T = 300 K, P = 5e5 Pa | Within envelope → empty array | violations.length === 0 |
| 6 | getEffectiveLimits: compressor size S | Returns S-size data | result.T_HH === 353 |
| 7 | getLimitParam: reads T from stream | Correct temperature | result ≈ stream.T |
| 8 | Alarm source: violations appear in AlarmSystem | evaluateLimits output flows to pipeline | alarms.some(a => a.source === 'evaluateLimits') |
| 9 | _rationalize: two alarms same id → highest severity kept | Dedup | result.length === 1 |
| 10 | Default params: new tank has volume_m3 = 0.15, new reactor has volume_m3 = 0.003 | Correct defaults | unit.params.volume_m3 |

**Gate:** All previous + 10 new pass.

---

## Implementation Checklist

```
S1-pre (before S1a, same session):
  [ ] S1-pre-1: Reactor cache hash: add reactionId, alpha, volume_m3,
      useKinetics, heatDemand to _hash (~line 9279)
  [ ] S1-pre-2: blendMaterialStream: renormalize total flow after
      clamp (~line 10476)
  [ ] S1-pre-3: Power read standardization: pump (~7978), compressor
      (~8114), heater (~8243) → actual ?? capacity ?? 0
  [ ] S1-pre-4: Stale docs: remove HEAT/MECHANICAL from
      STREAM_CONTRACTS (~6196, 6228, 6240) AND power_hub header
      (~7543, 7548, 7559)
  [ ] S1-pre-5: Producer available→capacity: ensure capacity is
      primary on grid_supply, battery, hub outputs, multiConnect.
      Remove available from streamSignature() (~10013)
  [ ] S1-pre-6: Direct-bus Infinity fix: partition finite/infinite
      consumers in Step D (~11489), allocate finite first,
      remainder to infinite
  [ ] S1-pre-7: Zero-flow flash: !stream.T → stream.T == null
      (~line 10943)
  [ ] S1-pre-8: Structured ud.errors: wrap 5 raw string pushes
      (~10711, 10741, 10990, 11005, 11020) + auto-wrap in
      ctx.warn (~10411)
  [ ] Verify: all 289 existing tests still pass

S1a (1 session):
  [ ] Line 3013: H₂O cpig Tmin 500 → 298
  [ ] Line 3189: CO₂ Antoine → array with liquid-vapor range
  [ ] After line 3200: CO species registration (~30 lines)
  [ ] Line 3329: KNOWN_KINETIC_MODELS += 'ELECTROCHEMICAL'
  [ ] 5 tests passing

S1b (1 session):
  [ ] Line 3500: R_STEAM_REFORM → R_SMR_OVERALL (rename)
  [ ] importJSON migration for old reactionId
  [ ] 10 new reaction registrations (R_HABER through R_CO_FUELCELL)
  [ ] 8 tests passing

S1c session 1 (infrastructure):
  [ ] LIMIT_PARAM_TEMPLATES dictionary
  [ ] limitParams arrays on 12 unit definitions
  [ ] getLimitParam() + _findPrimaryStream() + _computeMassRate()
  [ ] getEffectiveLimits() with future merge point
  [ ] evaluateLimits() pure function
  [ ] AlarmSystem.register('equipment_limits', ...)
  [ ] AlarmSystem._rationalize() skeleton

S1c session 2 (data + tests):
  [ ] S-size limit data on 12 unit definitions
  [ ] Alarm schema extensions (paramName, paramValue, limitTag, limitValue)
  [ ] Line 9457: tank volume_m3 50 → 0.15
  [ ] Line 9493: reactor volume_m3 1.0 → 0.003
  [ ] Air cooler default params case
  [ ] 10 tests passing

Total S1: ~23 new tests → 312 cumulative
```

---

## What S1 Enables Downstream

| Consumer | What it uses from S1 |
|----------|---------------------|
| S2 (Power) | Alarm infrastructure for overload/fry alarms; S1-pre power stream cleanup (capacity primary, Infinity fix, stale docs) |
| S3 (PR EOS) | CO species for CO-containing reaction validation |
| S6 (Electrochemical) | R_H2O_ELEC, R_CO2_ELEC, R_COELEC reaction data; R_H2_FUELCELL, R_CO_FUELCELL data for future fuel_cell; ELECTROCHEMICAL model |
| S7 (Perf Maps) | Limit data for overlay rendering; limitParams for inspector hooks |
| S8 (Game) | Reactions for all campaign missions; limits for paramLocks |
