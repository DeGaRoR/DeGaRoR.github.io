# PTIS S5-lite SPEC (v4 — FINAL)
## S5-lite — Tank Physics + Cv Flow
### processThis v13.6.0 → v14.0.0

---

## Overview

**What:** Replace the broken tank model with physics-based vessels.
Tanks compute headspace P from contents via `computeTankState()`. Flow
through tank/reservoir outlets is governed by Cv valve equations. A
pre-tick pressure trace resolves downstream pressures algebraically
by walking the flow path, tracking cumulative boosts and drops. The
enhanced sink is a process boundary at P_atm. New `restriction` unit
(fixed ΔP, isenthalpic). Valve becomes a true pressure regulator with
setpoint validation. Splitter reclassified as active flow divider.

**Sessions:** 4 (S5a-0, S5a-1, S5a-2, S5a-3).

**Risk:** Medium. Tank defId replaced (breaking change with migration).
Two new units (reservoir, restriction). Sink enhanced (zero regression
risk — terminal unit, no test reads u.last). Valve tick migrated to
shared function (behavior unchanged when setpoint is valid). Pre-tick
trace added to solver (~60 lines).

**Dependencies:** S3 (PR liquid density for computeTankState). S1
(alarm infrastructure: ErrorSeverity, ctx.warn, alarm bridge).

**Baseline state (v13.6.0):**
- Tank: 3-port (mat_in, mat_out, overflow), P = inlet P, drawRate = magic
- Valve: isenthalpic, Pout mode only
- Sink: absorbs everything, no physics
- Pump/compressor: Pout setpoint with power curtailment
- Gas turbine: Pout setpoint with check valve
- 399 tests, 2407 assertions

**After S5-lite:**
- Tank: 5-port (mat_in, gas_out, liq_out, vent, overflow), P from computeTankState(), dual Cv outlets (vapor/liquid), adiabatic mixing, relief + overflow safety, 2h×3w footprint
- Reservoir: 1-port (mat_out), infinite volume, constant P, Cv outlet
- Sink: process boundary at P_atm with isenthalpic expansion reporting
- Restriction: fixed ΔP, isenthalpic (shares tick with valve)
- Valve: pressure regulator with setpoint validation (look-through when unable to regulate)
- Splitter: active flow divider with check valve alarm
- Pre-tick resolveDownstreamPressures() with P_current tracking
- ~448 tests

---

## Design Principles

**Fix the tank, don't rewrite the world.** S5-lite delivers correct
vessel physics. Downstream pressures are resolved by a path trace that
is mathematically equivalent to S5-full's algebraic solver for
K_path = 0 (no equipment resistance).

**S5-full equivalence.** S5-full computes:
```
Q = √( ΔP_static / (1/C + K_path) )
ΔP_static = P_source − P_sink + Σ(boosts) − Σ(drops)
```
With K_path = 0 this simplifies to:
```
Q = Cv × (opening/100) × √(ΔP_static / (SG × 1e5))
```
The trace computes ΔP_static by accumulating boosts and drops along
the path. Identical result, no BFS, no zones, no iteration.

**NNG-3 compliance:** Tank and reservoir are separate defIds (different
port topology and computation). Valve and restriction are separate
defIds (different pressure network role: anchor vs drop). Shared tick
function for DRY (same isenthalpic physics).

**NNG-9 tick isolation:** `computeTankState()` is pure. Ticks read
cached P_downstream from solver pre-tick, never from other units.

**Alarm pattern:** `u.last.error` + `ctx.warn()` with ErrorSeverity.
Bridge at line 18709 converts to AlarmSystem (MINOR → WARNING,
CATASTROPHIC → CATASTROPHIC). All S5-lite alarms are PLANT domain.

---

## Pressure Trace Design

### Unit Classification

Every unit in the flowsheet has exactly one role in the pressure trace:

| Role | Behavior | Units |
|---|---|---|
| **Anchor** | Declares a known P. Trace terminates. | tank, reservoir, sink |
| **Regulator** | Maintains Pout setpoint if valid. Terminates when valid; looks through when invalid. | valve |
| **Drop** | Consumes driving force. P_current decreases. Trace continues. | restriction, gas_turbine |
| **Boost** | Adds driving force. P_current increases. Trace continues. | pump, compressor |
| **Transparent** | Zero ΔP. Trace continues. | All other units |

### Anchor Pressures

| defId | P_anchor source |
|---|---|
| tank (sealed) | computeTankState().P_Pa |
| tank (vented) | P_atm |
| reservoir | par.P_bar × 1e5 |
| sink | P_atm |

### Boost / Drop Computation

Boost and drop magnitudes depend on P_current at the device inlet.
The trace carries P_current forward from the source vessel.

| defId | Computation | Source |
|---|---|---|
| pump | boost = Pout_actual − P_current | u.last.Pout_actual (curtailed) or par.Pout |
| compressor | boost = Pout_actual − P_current | u.last.Pout_actual (curtailed) or par.Pout |
| gas_turbine | drop = P_current − Pout | par.Pout or P_current/2 |
| restriction | drop = par.deltaP | Fixed parameter |

**Power curtailment convergence:** First tick uses par.Pout (setpoint).
Subsequent ticks use u.last.Pout_actual from the pump/compressor's
curtailment computation (existing lines 13504/13656). Converges in
1–2 ticks via natural time-stepping — not iteration.

**Zero-power pump/compressor:** Pout_actual = P_in (existing code).
Boost = 0. Device becomes transparent. Physically correct.

### Regulator (Valve) Setpoint Validation

A pressure regulator maintains its outlet at Pout — but only if
Pout ≥ P_downstream. If the downstream pressure exceeds the setpoint,
the regulator cannot maintain it and opens fully.

During the trace, when a valve is encountered:
1. Peek downstream: trace beyond the valve to the next anchor,
   accumulating any further drops/boosts.
2. Compute effective downstream pressure P_beyond.
3. If valve Pout ≥ P_beyond: valve regulates. Treat as anchor at Pout.
4. If valve Pout < P_beyond: valve cannot regulate. Look through —
   treat as transparent. Flag valve in solver cache.

The valve tick reads the solver cache:
- `canRegulate = true`: isenthalpic expansion to par.Pout (existing).
- `canRegulate = false`: pass-through at sIn.P. WARNING alarm.

This ensures the isenthalpic flash uses the actual outlet pressure,
keeping thermo calculations consistent.

### Forking (Flow Divider, Flash Drum)

The splitter (UI name: "Flow Divider") is an active flow divider. It
mechanically enforces the player's set ratio independent of downstream
conditions. Real-world equivalents: hydraulic flow dividers (gear-type),
ratio-controlled valve pairs, volumetric dosing pumps. This is not an
approximation of a passive tee — it is a different, more capable device.

Each branch is traced independently. The trace returns max(P_downstream)
across branches. This max is used for the UPSTREAM vessel's Cv
equation only — the flow divider itself does not use downstream P
to compute the split.

### Flow Divider Check Valve

The flow divider uses the same backflow detection as other devices:
`P_downstream ≥ P_inlet → check valve`. Since the divider has
multiple outlets, the check is per-branch. One blocked branch stalls
the entire device (gear-type behavior).

The trace records per-branch P_eff in `dividerStatus`. The divider
tick reads this and the inlet pressure:

```javascript
// At end of splitter tick, after normal split logic:
const ds = scene.runtime.dividerStatus?.get(u.id);
if (ds && ds.branches && sIn) {
  const P_in = sIn.P;
  const blocked = ds.branches.filter(b => b.P_eff >= P_in);
  if (blocked.length > 0) {
    // Check valve: branch backpressure ≥ inlet → stall
    u.last.error = {
      severity: ErrorSeverity.MINOR,
      message: `Check valve — ${blocked.map(b =>
        `${b.portId} at ${(b.P_eff/1e5).toFixed(1)} bar`
      ).join(', ')} exceeds inlet ${(P_in/1e5).toFixed(1)} bar`
    };
  } else if (ds.P_max - ds.P_min > 50000) {
    // Branches differ significantly — informational
    u.last.error = {
      severity: ErrorSeverity.MINOR,
      message: `Branch backpressures differ: `
        + ds.branches.map(b =>
            `${b.portId} = ${(b.P_eff/1e5).toFixed(1)} bar`
          ).join(', ')
        + ` — flow limited by highest`
    };
  }
}
```

**Alarm pairing example:**

Tank(5 bar) → flow divider(50/50) → [out1: sink(0.9)] + [out2: TankB(100)]

- Tank: MINOR — "Reverse pressure — downstream at 100.0 bar
  exceeds vessel at 5.0 bar."
- Flow divider: MINOR — "Check valve — out2 at 100.0 bar exceeds
  inlet 5.0 bar."

### P_downstream Formula

```
P_downstream = P_anchor + Σ(drops) − Σ(boosts)
```

The vessel computes: `ΔP = P_vessel − P_downstream`

- ΔP > 0: Q from Cv equation.
- ΔP = 0: Q = 0. MINOR: "Pressures equalized — no flow."
- ΔP < 0: Q = 0. MINOR: "Reverse pressure — downstream at X bar
  exceeds vessel at Y bar."

### Scenario Validation

| # | Scenario | Trace | P_downstream | ΔP |
|---|---|---|---|---|
| 1 | Tank(5) → sink(0.9) | anchor 0.9, no drops/boosts | 0.9 | 4.1 |
| 2 | Tank(5) → valve(Pout=2) → sink | valve regulates (2>0.9), anchor 2 | 2.0 | 3.0 |
| 3 | Tank(5) → restr(dP=2) → sink | drop 2, anchor 0.9 | 2.9 | 2.1 |
| 4 | Tank(5) → heater → valve(Pout=1) → sink | transparent, anchor 1 | 1.0 | 4.0 |
| 5 | Tank(5) → restr(1) → restr(1) → sink | drops 1+1, anchor 0.9 | 2.9 | 2.1 |
| 6 | Tank(5) → Tank B(3) | anchor 3 | 3.0 | 2.0 |
| 7 | Tank(5) → restr(1) → Tank B(3) | drop 1, anchor 3 | 4.0 | 1.0 |
| 8 | Tank(5) → comp(Pout=10) → sink | P_cur=5, boost=5, anchor 0.9 | −4.1 | 9.1 |
| 9 | Tank(5) → restr(1) → comp(Pout=10) → sink | P_cur 5→4, boost 6, anchor 0.9 | −4.1 | 9.1 |
| 10 | Tank(5) → turbine(Pout=2) → sink | P_cur=5, drop=3, anchor 0.9 | 3.9 | 1.1 |
| 11 | Tank(5) → comp(10) → valve(Pout=3) → sink | P_cur 5→10, valve regulates, anchor 3 | −2.0 | 7.0 |
| 12 | Tank(5) → valve(Pout=3) → comp(10) → sink | valve regulates, anchor 3 | 3.0 | 2.0 |
| 13 | Tank(5) → valve(Pout=2) → Tank B(3) | peek: P_beyond=3 > Pout=2 → look-through, anchor 3 | 3.0 | 2.0 |
| 14 | Tank(5) → divider(50/50) → sink + TankB(3) | max(0.9, 3.0) | 3.0 | 2.0 |
| 15 | Tank(5) → divider(50/50) → [comp(10)→sink] + sink | max(−4.1, 0.9) | 0.9 | 4.1 |
| 16 | Tank(5) → heater → Tank A (loop back) | anchor 5 (self) | 5.0 | 0.0 |
| 17 | Tank(5) → pump(10) → Tank A (recirc) | P_cur 5→10, boost 5, anchor 5 | 0.0 | 5.0 |
| 18 | Tank(5) → restr(6) → Tank A (loop) | drop 6, anchor 5 | 11.0 | −6.0 → Q=0 |
| 19 | Tank(5) → comp(Pout_actual=7, curtailed) → sink | boost=2, anchor 0.9 | −1.1 | 6.1 |
| 20 | Tank(5) → dead-compressor(Pout_actual=5) → sink | boost=0, anchor 0.9 | 0.9 | 4.1 |

All scenarios match S5-full algebraic solver for K_path = 0.

### Implementation

```javascript
/**
 * Pre-tick: resolve P_downstream for each vessel outlet.
 * Walks forward from vessel, tracking P_current.
 * Accumulates drops and boosts. Stops at anchors.
 * Validates regulator setpoints (look-through if invalid).
 * Records flow divider branch diagnostics.
 *
 * Returns: Map<unitId, number> — P_downstream per vessel
 * Side effects: populates valveStatus, dividerStatus caches
 */
function resolveDownstreamPressures(scene) {
  const P_atm = SimSettings.getAtmosphere().P_Pa;
  const valveStatus = new Map();
  const dividerStatus = new Map();

  // 1. Compute anchor pressures
  const anchorP = new Map();
  for (const [id, u] of scene.units) {
    const ud = scene.runtime?.unitData?.get(id);
    switch (u.defId) {
      case 'tank': {
        const inv = ud?.inventory || u.inventory || { n:{}, T_K:298 };
        const V = u.params.volume_m3 || 0.15;
        const state = computeTankState(inv.n, inv.T_K, V, thermo);
        anchorP.set(id, state.P_Pa);
        break;
      }
      case 'reservoir':
        anchorP.set(id, (u.params.P_bar || 5) * 1e5);
        break;
      case 'sink':
        anchorP.set(id, P_atm);
        break;
    }
  }

  // 2. Trace from each vessel outlet
  // Tank has two Cv outlets (gas_out, liq_out); trace each independently.
  // Reservoir has one (mat_out).
  // Result: Map<string, number> keyed by "unitId:portId"
  const result = new Map();
  for (const [id, u] of scene.units) {
    if (u.defId === 'tank') {
      const P_vessel = anchorP.get(id);
      for (const portId of ['gas_out', 'liq_out']) {
        const trace = traceToAnchor(
          scene, id, portId, P_vessel,
          anchorP, P_atm, new Set(),
          valveStatus, dividerStatus);
        result.set(id + ':' + portId,
          trace.P_anchor + trace.dP_sum - trace.boost_sum);
      }
    }
    if (u.defId === 'reservoir') {
      const P_vessel = anchorP.get(id);
      const trace = traceToAnchor(
        scene, id, 'mat_out', P_vessel,
        anchorP, P_atm, new Set(),
        valveStatus, dividerStatus);
      result.set(id + ':mat_out',
        trace.P_anchor + trace.dP_sum - trace.boost_sum);
    }
  }

  // 3. Store caches in solver context for unit ticks
  scene.runtime.valveStatus = valveStatus;
  scene.runtime.dividerStatus = dividerStatus;
  return result;
}

/**
 * Walk downstream from a port to the nearest anchor.
 * Tracks P_current for boost/drop computation.
 * Validates regulator setpoints.
 * Records flow divider branch diagnostics.
 *
 * @returns {{ P_anchor, dP_sum, boost_sum }}
 */
function traceToAnchor(scene, unitId, portId, P_current,
                        anchorP, P_atm, visited,
                        valveStatus, dividerStatus) {
  const key = unitId + ':' + portId;
  if (visited.has(key)) return { P_anchor: P_atm, dP_sum: 0, boost_sum: 0 };
  visited.add(key);

  // Find connection from this port
  const conn = scene.connections.find(
    c => c.from.unitId === unitId && c.from.portId === portId);
  if (!conn) return { P_anchor: P_atm, dP_sum: 0, boost_sum: 0 };

  const nextId = conn.to.unitId;
  const nextU = scene.units.get(nextId);
  if (!nextU) return { P_anchor: P_atm, dP_sum: 0, boost_sum: 0 };

  // ANCHOR (tank, reservoir, sink)
  if (anchorP.has(nextId)) {
    return { P_anchor: anchorP.get(nextId), dP_sum: 0, boost_sum: 0 };
  }

  // REGULATOR (valve) — validate setpoint
  if (nextU.defId === 'valve') {
    const Pout = nextU.params.Pout || 101325;
    // Peek downstream to check if valve can regulate
    const beyond = traceToAnchor(
      scene, nextId, 'out', Pout,
      anchorP, P_atm, new Set(visited),
      valveStatus, dividerStatus);
    const P_beyond = beyond.P_anchor + beyond.dP_sum - beyond.boost_sum;
    if (Pout >= P_beyond) {
      // Valve can regulate — act as anchor
      valveStatus.set(nextId, { canRegulate: true, Pout });
      return { P_anchor: Pout, dP_sum: 0, boost_sum: 0 };
    } else {
      // Valve cannot regulate — look through (transparent)
      valveStatus.set(nextId, { canRegulate: false, P_beyond });
      return beyond;
    }
  }

  // RESTRICTION (drop)
  if (nextU.defId === 'restriction') {
    const dP = nextU.params.deltaP ?? 100000;
    const downstream = traceToAnchor(
      scene, nextId, 'out', P_current - dP,
      anchorP, P_atm, visited, valveStatus, dividerStatus);
    return { P_anchor: downstream.P_anchor,
             dP_sum: downstream.dP_sum + dP,
             boost_sum: downstream.boost_sum };
  }

  // GAS TURBINE (drop)
  if (nextU.defId === 'gas_turbine') {
    const Pout = nextU.params.Pout
              || nextU.last?.Pout_actual
              || (P_current / 2);
    const drop = Math.max(0, P_current - Pout);
    const downstream = traceToAnchor(
      scene, nextId, 'mat_out', Pout,
      anchorP, P_atm, visited, valveStatus, dividerStatus);
    return { P_anchor: downstream.P_anchor,
             dP_sum: downstream.dP_sum + drop,
             boost_sum: downstream.boost_sum };
  }

  // PUMP / COMPRESSOR (boost)
  if (nextU.defId === 'pump' || nextU.defId === 'compressor') {
    const Pout = nextU.last?.Pout_actual
              || nextU.params.Pout
              || (nextU.defId === 'pump'
                   ? P_current + 500000
                   : P_current * 2);
    const boost = Math.max(0, Pout - P_current);
    const downstream = traceToAnchor(
      scene, nextId, 'mat_out', Pout,
      anchorP, P_atm, visited, valveStatus, dividerStatus);
    return { P_anchor: downstream.P_anchor,
             dP_sum: downstream.dP_sum,
             boost_sum: downstream.boost_sum + boost };
  }

  // TRANSPARENT / FORK — find material output ports
  const nextDef = UnitRegistry.get(nextU.defId);
  const outPorts = nextDef.ports.filter(
    p => p.dir === PortDir.OUT && p.type === StreamType.MATERIAL);

  if (outPorts.length === 0) {
    return { P_anchor: P_atm, dP_sum: 0, boost_sum: 0 };
  }

  if (outPorts.length === 1) {
    return traceToAnchor(
      scene, nextId, outPorts[0].portId, P_current,
      anchorP, P_atm, visited, valveStatus, dividerStatus);
  }

  // FORK: trace each branch, return worst (highest P_downstream)
  // Record per-branch diagnostics for flow divider alarm.
  const branches = [];
  let worst = null;
  let worstP = -Infinity;
  for (const op of outPorts) {
    const branch = traceToAnchor(
      scene, nextId, op.portId, P_current,
      anchorP, P_atm, new Set(visited),
      valveStatus, dividerStatus);
    const effP = branch.P_anchor + branch.dP_sum - branch.boost_sum;
    branches.push({ portId: op.portId, P_eff: effP });
    if (effP > worstP) { worstP = effP; worst = branch; }
  }

  // Divider diagnostics
  if (branches.length > 1) {
    const minP = Math.min(...branches.map(b => b.P_eff));
    const maxP = Math.max(...branches.map(b => b.P_eff));
    if (maxP - minP > 1000) {  // > 0.01 bar difference
      dividerStatus.set(nextId, {
        branches,
        P_max: maxP, P_min: minP
      });
    }
  }

  return worst;
}
```

### Quantified Limitations vs S5-full

| Limitation | Max error at pilot scale | Detectable? | Player workaround |
|---|---|---|---|
| K_path = 0 (no equip ΔP) | k×Q² ≈ 0.025 bar | No (negligible) | Add restriction unit |
| Regulator look-through | Slight overestimate (no valve ΔP) | Yes (WARNING) | Set Pout above downstream P |

**Not a limitation:** The flow divider's ratio-based split is not an
approximation of a passive tee. It is an active device (hydraulic flow
divider) that enforces the set ratio. A passive tee (conductance-based
splitting) could be added as a separate defId in S5-advanced if needed.

---

## Feature Specifications

### F-001. computeTankState()

Pure function. No side effects. Placed in Block 1 (DOM-free core).

```javascript
/**
 * Compute tank state from inventory.
 * @param {Object}  n       — { species: mol } inventory
 * @param {number}  T_K     — Temperature [K]
 * @param {number}  V_total — Tank volume [m³]
 * @param {Object}  thermo  — ThermoAdapter instance
 * @returns {{ P_Pa, V_liq_m3, V_vap_m3, n_L, n_V, level_pct }}
 */
function computeTankState(n, T_K, V_total, thermo) {
  const R = 8.314;
  const species = Object.keys(n).filter(sp => n[sp] > 1e-15);
  if (species.length === 0) {
    return { P_Pa: 0, V_liq_m3: 0, V_vap_m3: V_total,
             n_L: {}, n_V: {}, level_pct: 0 };
  }

  // 1. Classify: condensable (T < 0.9 × Tc) vs permanent gas
  const condensable = [], permanent = [];
  for (const sp of species) {
    const cd = ComponentRegistry.get(sp);
    if (cd && T_K < 0.9 * cd.Tc) condensable.push(sp);
    else permanent.push(sp);
  }

  // 2. Liquid volume from condensable species
  const n_L = {}, n_V = {};
  let V_liq = 0;
  for (const sp of condensable) {
    n_L[sp] = n[sp]; n_V[sp] = 0;
    const cd = ComponentRegistry.get(sp);
    const rho = thermo.density
      ? thermo.density(sp, T_K, 101325, 'L') : (cd.rhoLiq || 1000);
    V_liq += n[sp] * (cd.MW / 1000) / rho;
  }

  // 3. Headspace
  let V_headspace = Math.max(0, V_total - V_liq);

  // 4. VLE: vapor pressure contribution from condensables
  let n_vap_cond = 0;
  if (V_headspace > 0.001 * V_total) {
    for (const sp of condensable) {
      const Psat = thermo.saturationPressure
        ? thermo.saturationPressure(sp, T_K) : 0;
      if (Psat > 0) {
        const n_v_est = Psat * V_headspace / (R * T_K);
        const n_actual = Math.min(n_v_est, n[sp] * 0.5);
        n_V[sp] = n_actual;
        n_L[sp] = n[sp] - n_actual;
        n_vap_cond += n_actual;
      }
    }
  }

  // 5. Permanent gas: all in headspace
  let n_perm = 0;
  for (const sp of permanent) {
    n_V[sp] = n[sp]; n_L[sp] = 0; n_perm += n[sp];
  }

  // 6. Headspace pressure (ideal gas)
  const n_gas_total = n_perm + n_vap_cond;
  let P_Pa;
  if (V_headspace < 1e-6) {
    P_Pa = 200e5;  // 200 bar sentinel (all liquid)
  } else {
    P_Pa = n_gas_total * R * T_K / V_headspace;
  }

  // 7. Level
  const level_pct = V_total > 0
    ? Math.min(100, (V_liq / V_total) * 100) : 0;

  return { P_Pa, V_liq_m3: V_liq, V_vap_m3: V_headspace,
           n_L, n_V, level_pct };
}
```

**Edge cases:** Empty → P ≈ 0. All liquid → 200 bar sentinel + WARNING.
Overfull → V_headspace clamped to 0, CATASTROPHIC.

**Export:** `PG.computeTankState = computeTankState`

---

### F-002. Tank Unit (Replacement)

**Replaces** current tank at line 12618. Same defId `tank`. Removes
drawRate. Adds gas_out, liq_out, vent ports. Removes mat_out.
No `tankMode` parameter — tank is always sealed. "Atmospheric" behavior
is achieved by topology (connect vent to sink) and a low P_relief.

**Footprint:** 2h × 3w (unique wide shape).

**Ports:**

| portId | Dir | Type | Position | Phase | Player-controlled? |
|---|---|---|---|---|---|
| mat_in | IN | MATERIAL | (0, 1) left | Any | Via upstream |
| gas_out | OUT | MATERIAL | (1, 0) top-left | Vapor (n_V) | Cv + opening slider |
| vent | OUT | MATERIAL | (3, 0) top-right | Vapor (n_V) | P_relief setpoint only |
| liq_out | OUT | MATERIAL | (1, 2) bottom-left | Liquid (n_L) | Cv + opening slider |
| overflow | OUT | MATERIAL | (3, 2) bottom-right | Liquid (n_L) | overflow_level only |

All optional (optionalPorts: true). Port labels displayed on canvas.

**Parameters:**

| Key | Default | Visible | Range | Notes |
|-----|---------|---------|-------|-------|
| volume_m3 | 0.15 | Yes | 0.001–1000 | Fixed at placement |
| initialComposition | { N2: 1.0 } | At placement | — | Mol fractions |
| T_init | T_atm | At placement | 50–2000 K | Initial temperature |
| P_init | P_atm | At placement | 1e3–200e5 Pa | Gas fill → back-computes moles |
| level_init | — | At placement | 0–95 % | Liquid fill → back-computes moles. Mutually exclusive with P_init |
| P_relief | 200000 | Yes | 1e5–200e5 Pa | Safety valve set pressure |
| overflow_level | 90 | Yes | 50–95 % | Overflow nozzle height |
| Cv_gas | 50 | Advanced | 0.1–10000 | Gas draw valve coefficient |
| opening_gas_pct | 0 | Yes (slider) | 0–100 | Gas draw opening |
| Cv_liq | 50 | Advanced | 0.1–10000 | Liquid draw valve coefficient |
| opening_liq_pct | 0 | Yes (slider) | 0–100 | Liquid draw opening |

**initInventory:**

```javascript
initInventory(par) {
  const atm = SimSettings.getAtmosphere();
  const V = par.volume_m3 || 0.15;
  const T = par.T_init ?? atm.T_K;
  const comp = par.initialComposition || { N2: 1.0 };

  // Normalize fractions
  const total = Object.values(comp).reduce((a, b) => a + b, 0);
  const fracs = {};
  for (const [sp, f] of Object.entries(comp)) fracs[sp] = f / total;

  let n = {};
  if (par.level_init != null && par.level_init > 0) {
    // Liquid fill mode: back-compute moles from level
    const V_liq = (par.level_init / 100) * V;
    for (const [sp, frac] of Object.entries(fracs)) {
      const cd = ComponentRegistry.get(sp);
      const rho = cd?.rhoLiq || 1000;  // kg/m³
      const MW_kg = (cd?.MW || 0.018);  // kg/mol
      n[sp] = frac * V_liq * rho / MW_kg;
    }
  } else {
    // Gas fill mode: back-compute moles from P_init
    const P = par.P_init ?? atm.P_Pa;
    const n_total = P * V / (8.314 * T);
    for (const [sp, frac] of Object.entries(fracs)) {
      n[sp] = frac * n_total;
    }
  }

  return { n, T_K: T };
}
```

After init, computeTankState re-derives P from actual moles. Player
sees true P in inspector immediately.

**Safety valve sizing:**

Both safety systems use k-values proportional to tank volume.
Hardcoded constants, not in profiles, not player-editable.

```javascript
const K_RELIEF_BASE = 1.5e-3;    // mol/(s·Pa·m³)
const K_OVERFLOW_BASE = 80;      // mol/(s·%·m³)
```

Relief: `Q_vent = K_RELIEF_BASE × V × (P_tank − P_relief)`
Overflow: `Q_overflow = K_OVERFLOW_BASE × V × (level − overflow_level)`

Both self-correcting. Safety devices overwhelm reasonable process
inflows at pilot scale.

**Tick logic:**

```javascript
tick(u, ports, par) {
  const sIn = ports.mat_in;
  const V = par.volume_m3 || 0.15;
  const inv = u.inventory;
  const dt = SimSettings.dt;

  // 1. Compute tank state
  const state = computeTankState(inv.n, inv.T_K, V, thermo);
  const P_tank = state.P_Pa;

  // 2. Gas draw (from vapor phase)
  const P_down_gas = scene.runtime.P_downstream
    ?.get(u.id + ':gas_out') ?? P_tank;
  const dP_gas = P_tank - P_down_gas;
  let Q_gas = 0;
  if (dP_gas > 0 && (par.opening_gas_pct || 0) > 0
      && state.n_V && Object.values(state.n_V).some(v => v > 1e-15)) {
    const n_V_total = Object.values(state.n_V).reduce((a,b) => a+b, 0);
    const MW_V = _inventoryMW(state.n_V);
    const SG_V = (P_tank * MW_V) / (8.314 * inv.T_K * 1.225);
    Q_gas = (par.Cv_gas || 50) * (par.opening_gas_pct / 100)
          * Math.sqrt(Math.max(0, dP_gas) / (SG_V * 1e5));
    Q_gas = Math.min(Q_gas, n_V_total / dt);

    const gas_frac = {};
    for (const [sp, n] of Object.entries(state.n_V)) {
      gas_frac[sp] = n / n_V_total;
    }
    const n_out_gas = {};
    for (const [sp, frac] of Object.entries(gas_frac)) {
      n_out_gas[sp] = frac * Q_gas;
    }
    ports.gas_out = {
      type: StreamType.MATERIAL,
      T: inv.T_K, P: P_tank, n: n_out_gas,
      phaseConstraint: 'V'
    };
  } else {
    ports.gas_out = {
      type: StreamType.MATERIAL,
      T: inv.T_K, P: P_tank, n: {},
      phaseConstraint: 'V'
    };
    if (dP_gas < -100) {
      u.last = { ...(u.last || {}), error: {
        severity: ErrorSeverity.MINOR,
        message: `Gas outlet: reverse pressure — downstream at `
          + `${(P_down_gas/1e5).toFixed(1)} bar exceeds vessel `
          + `at ${(P_tank/1e5).toFixed(1)} bar`
      }};
    }
  }

  // 3. Liquid draw (from liquid phase)
  const P_down_liq = scene.runtime.P_downstream
    ?.get(u.id + ':liq_out') ?? P_tank;
  const dP_liq = P_tank - P_down_liq;
  let Q_liq = 0;
  if (dP_liq > 0 && (par.opening_liq_pct || 0) > 0
      && state.n_L && Object.values(state.n_L).some(v => v > 1e-15)) {
    const n_L_total = Object.values(state.n_L).reduce((a,b) => a+b, 0);
    const MW_L = _inventoryMW(state.n_L);
    const rho_L = thermo.density
      ? thermo.density(Object.keys(state.n_L)[0], inv.T_K, P_tank, 'L')
      : 1000;
    const SG_L = rho_L / 1000;
    Q_liq = (par.Cv_liq || 50) * (par.opening_liq_pct / 100)
          * Math.sqrt(Math.max(0, dP_liq) / (SG_L * 1e5));
    Q_liq = Math.min(Q_liq, n_L_total / dt);

    const liq_frac = {};
    for (const [sp, n] of Object.entries(state.n_L)) {
      liq_frac[sp] = n / n_L_total;
    }
    const n_out_liq = {};
    for (const [sp, frac] of Object.entries(liq_frac)) {
      n_out_liq[sp] = frac * Q_liq;
    }
    ports.liq_out = {
      type: StreamType.MATERIAL,
      T: inv.T_K, P: P_tank, n: n_out_liq,
      phaseConstraint: 'L'
    };
  } else {
    ports.liq_out = {
      type: StreamType.MATERIAL,
      T: inv.T_K, P: P_tank, n: {},
      phaseConstraint: 'L'
    };
    if (dP_liq < -100) {
      u.last = { ...(u.last || {}), error: {
        severity: ErrorSeverity.MINOR,
        message: `Liquid outlet: reverse pressure — downstream at `
          + `${(P_down_liq/1e5).toFixed(1)} bar exceeds vessel `
          + `at ${(P_tank/1e5).toFixed(1)} bar`
      }};
    }
  }

  // 4. Relief valve (automatic — vapor phase)
  let Q_vent = 0;
  const P_relief = par.P_relief || 200000;
  if (P_tank > P_relief) {
    const n_V_total = Object.values(state.n_V || {})
      .reduce((a,b) => a+b, 0);
    Q_vent = K_RELIEF_BASE * V * (P_tank - P_relief);
    Q_vent = Math.min(Q_vent, n_V_total / dt);

    if (Q_vent > 0) {
      const vent_n = {};
      for (const [sp, n] of Object.entries(state.n_V || {})) {
        vent_n[sp] = (n / n_V_total) * Q_vent;
      }
      // Connected vent → stream to port
      // Unconnected vent → removed from inventory + WARNING
      const ventConnected = scene.connections.some(
        c => c.from.unitId === u.id && c.from.portId === 'vent');
      if (ventConnected) {
        ports.vent = {
          type: StreamType.MATERIAL,
          T: inv.T_K, P: P_tank, n: vent_n,
          phaseConstraint: 'V'
        };
      }
      ctx.warn({
        severity: ventConnected
          ? ErrorSeverity.MINOR : ErrorSeverity.MINOR,
        message: `Relief valve open at ${(P_tank/1e5).toFixed(1)} bar `
          + `(set: ${(P_relief/1e5).toFixed(1)} bar)`
          + (ventConnected ? '' : ' — venting to atmosphere')
      });
    }
  }

  // 5. Overflow (automatic — liquid phase)
  let Q_overflow = 0;
  const overflow_lvl = par.overflow_level ?? 90;
  if (state.level_pct > overflow_lvl) {
    const n_L_total = Object.values(state.n_L || {})
      .reduce((a,b) => a+b, 0);
    Q_overflow = K_OVERFLOW_BASE * V
      * (state.level_pct - overflow_lvl);
    Q_overflow = Math.min(Q_overflow, n_L_total / dt);

    if (Q_overflow > 0) {
      const ov_n = {};
      for (const [sp, n] of Object.entries(state.n_L || {})) {
        ov_n[sp] = (n / n_L_total) * Q_overflow;
      }
      const ovConnected = scene.connections.some(
        c => c.from.unitId === u.id && c.from.portId === 'overflow');
      if (ovConnected) {
        ports.overflow = {
          type: StreamType.MATERIAL,
          T: inv.T_K, P: P_tank, n: ov_n,
          phaseConstraint: 'L'
        };
      }
      ctx.warn({
        severity: ovConnected
          ? ErrorSeverity.MINOR : ErrorSeverity.MINOR,
        message: `Overflow active at ${state.level_pct.toFixed(0)}% `
          + `(threshold: ${overflow_lvl}%)`
          + (ovConnected ? '' : ' — draining to ground')
      });
    }
  }

  // 6. Diagnostics
  u.last = {
    ...u.last,
    P_Pa: P_tank, P_bar: P_tank / 1e5,
    T_K: inv.T_K,
    level_pct: state.level_pct,
    V_liq_m3: state.V_liq_m3,
    V_vap_m3: state.V_vap_m3,
    Q_gas, Q_liq, Q_vent, Q_overflow,
    vent_status: P_tank > P_relief ? 'OPEN' : 'CLOSED',
    overflow_status: state.level_pct > overflow_lvl ? 'ACTIVE' : 'OK'
  };
}
```

**updateInventory:**

```javascript
updateInventory(inventory, resolvedPorts, dt) {
  const inv = { ...inventory, n: { ...inventory.n } };
  const inFlow  = resolvedPorts.mat_in?.n || {};
  const gasFlow = resolvedPorts.gas_out?.n || {};
  const liqFlow = resolvedPorts.liq_out?.n || {};
  const ventFlow = resolvedPorts.vent?.n || {};
  const ovFlow  = resolvedPorts.overflow?.n || {};

  const allSp = new Set([
    ...Object.keys(inv.n), ...Object.keys(inFlow),
    ...Object.keys(gasFlow), ...Object.keys(liqFlow),
    ...Object.keys(ventFlow), ...Object.keys(ovFlow)
  ]);

  for (const sp of allSp) {
    const cur = inv.n[sp] || 0;
    const inN = (inFlow[sp] || 0) * dt;
    const outN = ((gasFlow[sp]||0) + (liqFlow[sp]||0)
               + (ventFlow[sp]||0) + (ovFlow[sp]||0)) * dt;
    inv.n[sp] = Math.max(0, cur + inN - outN);
  }

  // Adiabatic mixing: T evolves from enthalpy balance
  // T_new = (H_inventory + H_in - H_out) / Cp_inventory
  // Simplified for S5-lite: weighted average by moles
  if (resolvedPorts.mat_in?.T && resolvedPorts.mat_in.n) {
    const n_in = Object.values(inFlow).reduce((a,b) => a+b, 0) * dt;
    const n_inv = Object.values(inv.n).reduce((a,b) => a+b, 0);
    if (n_inv > 0 && n_in > 0) {
      inv.T_K = (inventory.T_K * (n_inv - n_in) + resolvedPorts.mat_in.T * n_in) / n_inv;
    }
  }

  return inv;
}
```

**Profiles:**

| profileId | Name | Key defaults |
|---|---|---|
| tank_atmospheric | Atmospheric Tank | P_relief=150000 (1.5 bar), overflow_level=90, T_init=T_atm, P_init=P_atm, initialComposition={N2:1} |
| tank_pressure | Pressure Vessel | P_relief=1000000 (10 bar), overflow_level=90, T_init=T_atm, P_init=500000, initialComposition={N2:1} |

"Atmospheric" tank: low P_relief means any pressure buildup gets
vented. Connect vent to sink for clean accounting.

**Inspector layout:**

```
┌─ Status (read-only, computed) ─────────┐
│ P: 2.34 bar    T: 298.1 K              │
│ Level: 45.2%   V_liq: 0.068 m³         │
├─ Gas Outlet ───────────────────────────┤
│ Opening: ████████░░ 80%    Q: 0.42 mol/s│
│ Cv: 50  (advanced)                      │
├─ Liquid Outlet ────────────────────────┤
│ Opening: ██████████ 100%   Q: 1.23 mol/s│
│ Cv: 50  (advanced)                      │
├─ Safety ───────────────────────────────┤
│ P_relief: 5.0 bar   Vent: CLOSED       │
│ Overflow: 90%        Status: OK         │
├─ Initial Fill (placement only) ────────┤
│ Composition: { N₂: 1.0 }               │
│ T_init: 298 K  P_init: 1.01 bar        │
└─────────────────────────────────────────┘
```

---

### F-003. Reservoir Unit

New defId. Infinite volume, constant P, Cv outlet. Inexhaustible
supply — the "well head."

**Ports:** mat_out (OUT) only.

**Parameters:**

| Key | Default | Unit | Range | Notes |
|-----|---------|------|-------|-------|
| T | 298.15 | K | 50–2000 | Constant |
| P_bar | 5 | bar | 0.1–200 | Constant |
| composition | {N2:1} | mol fracs | — | Constant |
| Cv | 50 | — | 0.1–10000 | Outlet valve coefficient |
| opening_pct | 100 | % | 0–100 | 0 = closed |
| phaseConstraint | 'V' | — | V / L / VL | Outlet phase hint |

**Tick:** Same Cv equation and ΔP logic as tank. No inventory
tracking, no depletion, no vent, no overflow.

**Profiles:**

| profileId | Name | Key defaults |
|---|---|---|
| reservoir_gas | Gas Supply | P=5, N₂, Cv=50, opening=100, V |
| reservoir_liquid | Liquid Supply | P=5, H₂O, Cv=50, opening=100, L |
| reservoir_air | Air Supply | P=0.8975, Planet X atm, Cv=100, opening=100, V |

---

### F-004. Sink Enhancement (Process Boundary)

**Modifies** existing sink at line 12505. Same defId, same port.

The sink is a boundary condition declaring P = P_atm. When a
pressurized stream arrives, isenthalpic expansion occurs at the
boundary. The sink reports both inlet (process) and outlet
(atmospheric) conditions for display and mass balance bookkeeping.

```javascript
tick(u, ports, par) {
  const sIn = ports.in;
  if (!sIn) return;

  const atm = SimSettings.getAtmosphere();
  const P_atm = atm.P_Pa;
  const absorbed = Object.values(sIn.n || {}).reduce((a,b) => a+b, 0);

  // Process side
  const inlet = { T_K: sIn.T, P_Pa: sIn.P, Q_mol_s: absorbed };

  // Atmosphere side (isenthalpic expansion)
  // Ideal gas: T_out ≈ T_in. Real gas J-T correction deferred.
  const outlet = { T_K: sIn.T, P_Pa: P_atm };

  u.last = {
    absorbed_mol_s: absorbed,
    inlet,
    outlet,
    P_atm_bar: P_atm / 1e5,
    expansion_ratio: sIn.P > 0 ? (sIn.P / P_atm).toFixed(2) : '—',
    stream: { ...sIn }  // backward compat fallback
  };

  if (sIn.P > P_atm * 2) {
    u.last.error = {
      severity: ErrorSeverity.MINOR,
      message: `Stream at ${(sIn.P/1e5).toFixed(1)} bar expanding `
             + `to ${(P_atm/1e5).toFixed(2)} bar at process boundary`
    };
  }
}
```

**Regression:** Zero risk. All tests read sink inlet via `t.port(snk, 'in')`
(solver port data, unchanged). No test asserts on sink u.last.

---

### F-005. Restriction Unit

New defId. Fixed ΔP, isenthalpic. Shares tick function with valve.

**Ports:** in (IN), out (OUT).

**Parameters:**

| Key | Default | Unit | Range | Notes |
|-----|---------|------|-------|-------|
| deltaP | 100000 | Pa | 0–50e5 | Fixed pressure drop |

**Profile:**

| profileId | Name |
|---|---|
| restriction | Restriction |

---

### F-006. Valve Refactor (Pressure Regulator)

**Display name:** "Pressure Regulator" (defId stays `valve`).

**Shared tick function** with restriction:

```javascript
/**
 * Isenthalpic throttle — shared by valve and restriction.
 * Valve: Pout from setpoint (or pass-through if unable to regulate).
 * Restriction: Pout = Pin − deltaP.
 */
function _isenthalpicThrottleTick(u, ports, par) {
  const sIn = ports.in || ports.mat_in;
  if (!sIn) return;

  let Pout;
  if (u.defId === 'restriction') {
    Pout = Math.max(0, sIn.P - (par.deltaP ?? 100000));
  } else {
    // Valve — check solver cache for regulation status
    const status = scene.runtime.valveStatus?.get(u.id);
    if (status && !status.canRegulate) {
      // Cannot maintain setpoint — pass through
      Pout = sIn.P;
      u.last = {
        Pin: sIn.P, Pout, deltaP: 0,
        mode: 'pass-through',
        error: {
          severity: ErrorSeverity.MINOR,
          message: `Cannot maintain setpoint `
            + `${((par.Pout||101325)/1e5).toFixed(1)} bar — `
            + `downstream at ${(status.P_beyond/1e5).toFixed(1)} bar`
        }
      };
      ports.out = ports.mat_out = {
        type: StreamType.MATERIAL, P: Pout,
        n: { ...sIn.n }, phaseConstraint: 'VL',
        H_target_Jps: thermo.getHdot_Jps(sIn)
      };
      return;
    }
    Pout = par.Pout || 101325;
  }

  // Check valve: Pout >= Pin → zero flow
  if (Pout >= sIn.P) {
    ports.out = ports.mat_out = {
      type: StreamType.MATERIAL, P: sIn.P,
      n: {}, phaseConstraint: 'VL', H_target_Jps: 0
    };
    u.last = {
      Pin: sIn.P, Pout, deltaP: 0, mode: 'check-valve',
      error: {
        severity: ErrorSeverity.MINOR,
        message: `Check valve closed — downstream pressure `
               + `${(Pout/1e5).toFixed(2)} bar ≥ inlet `
               + `${(sIn.P/1e5).toFixed(2)} bar`
      }
    };
    return;
  }

  // Isenthalpic expansion
  const H_in_Jps = thermo.getHdot_Jps(sIn);
  ports.out = ports.mat_out = {
    type: StreamType.MATERIAL, P: Pout,
    n: { ...sIn.n }, phaseConstraint: 'VL',
    H_target_Jps: H_in_Jps
  };

  u.last = {
    Pin: sIn.P, Pout, deltaP: sIn.P - Pout,
    ratio: (sIn.P / Pout).toFixed(2),
    mode: 'isenthalpic',
    H_in_kW: (H_in_Jps / 1000).toFixed(2)
  };
}
```

**Existing valve behavior is unchanged** when the regulator can
maintain its setpoint (the normal case in all existing tests/scenes).

---

### F-007. Profile Registrations

```javascript
// Tank (replaces old 'tank' profile at line 15574)
ProfileRegistry.register('tank_atmospheric', {
  defId: 'tank', name: 'Atmospheric Tank',
  category: UnitCategories.VESSEL, tiers: [1],
  limits: { 1: { T_LL:263, T_L:278, T_H:333, T_HH:353,
                  P_LL:5000, P_HH:200000,
                  level_H:90, level_HH:100 } },
  defaults: { 1: { volume_m3:0.15, P_relief:150000,
                    overflow_level:90,
                    Cv_gas:50, opening_gas_pct:0,
                    Cv_liq:50, opening_liq_pct:0,
                    initialComposition:{N2:1}, P_init:101325 } }
});

ProfileRegistry.register('tank_pressure', {
  defId: 'tank', name: 'Pressure Vessel',
  category: UnitCategories.VESSEL, tiers: [1],
  limits: { 1: { T_LL:233, T_L:263, T_H:473, T_HH:523,
                  P_LL:5000, P_HH:5000000,
                  level_H:90, level_HH:100 } },
  defaults: { 1: { volume_m3:0.15, P_relief:1000000,
                    overflow_level:90,
                    Cv_gas:50, opening_gas_pct:0,
                    Cv_liq:50, opening_liq_pct:0,
                    initialComposition:{N2:1}, P_init:500000 } }
});

// Reservoir
ProfileRegistry.register('reservoir_gas', {
  defId: 'reservoir', name: 'Gas Supply',
  category: UnitCategories.SOURCE, tiers: [1],
  limits: {}, boundary: true,
  defaults: { 1: { P_bar:5, T:298.15, composition:{N2:1},
                    Cv:50, opening_pct:100, phaseConstraint:'V' } }
});

ProfileRegistry.register('reservoir_liquid', {
  defId: 'reservoir', name: 'Liquid Supply',
  category: UnitCategories.SOURCE, tiers: [1],
  limits: {}, boundary: true,
  defaults: { 1: { P_bar:5, T:298.15, composition:{H2O:1},
                    Cv:50, opening_pct:100, phaseConstraint:'L' } }
});

ProfileRegistry.register('reservoir_air', {
  defId: 'reservoir', name: 'Air Supply',
  category: UnitCategories.SOURCE, tiers: [1],
  limits: {}, boundary: true,
  defaults: { 1: { P_bar:0.8975, T:288.15,
                    composition: { N2:0.693, O2:0.208, CO2:0.0792,
                                   Ar:0.0099, H2O:0.0095 },
                    Cv:100, opening_pct:100, phaseConstraint:'V' } }
});

// Restriction
ProfileRegistry.register('restriction', {
  defId: 'restriction', name: 'Restriction',
  category: UnitCategories.PRESSURE, tiers: [1],
  limits: { 1: { T_LL:243, T_L:263, T_H:523, T_HH:623,
                  P_H:12000000, P_HH:15000000, mass_HH:0.25 } }
});
```

**Removed:** Old `ProfileRegistry.register('tank', ...)` at line 15574.

---

### F-008. Helper Functions

```javascript
/** Average MW from inventory {species: mol} */
function _inventoryMW(n) {
  let totalMol = 0, totalMass = 0;
  for (const [sp, mol] of Object.entries(n)) {
    if (mol <= 0) continue;
    const cd = ComponentRegistry.get(sp);
    if (!cd) continue;
    totalMol += mol;
    totalMass += mol * cd.MW;
  }
  return totalMol > 0 ? totalMass / totalMol : 28.97;
}

/** Average MW from composition {species: fraction} */
function _compositionMW(comp) {
  let totalFrac = 0, totalMW = 0;
  for (const [sp, frac] of Object.entries(comp)) {
    if (frac <= 0) continue;
    const cd = ComponentRegistry.get(sp);
    if (!cd) continue;
    totalFrac += frac;
    totalMW += frac * cd.MW;
  }
  return totalFrac > 0 ? totalMW / totalFrac : 28.97;
}
```

---

### F-009. Pressure Alarm Source

Replace placeholder at line 18701:

```javascript
AlarmSystem.register((scene) => {
  const alarms = [];
  if (!scene.runtime?.unitData) return alarms;
  const P_downstream = scene.runtime.P_downstream;

  for (const [id, ud] of scene.runtime.unitData) {
    const u = scene.units.get(id);
    if (!u) continue;
    const uName = u.name || UnitRegistry.get(u.defId)?.name || id;

    // Vessel empty
    if (u.defId === 'tank' && ud.last?.totalMol < 1e-12) {
      alarms.push({
        id: `vessel_empty_${id}`, domain: AlarmDomain.PLANT,
        category: AlarmCategory.PRESSURE, severity: AlarmSeverity.INFO,
        message: 'Vessel is empty — no outlet flow.',
        unitId: id, unitName: uName
      });
    }

    // Reservoir no driving force
    if (u.defId === 'reservoir' && ud.last?.status === 'no_dP') {
      alarms.push({
        id: `reservoir_no_dp_${id}`, domain: AlarmDomain.PLANT,
        category: AlarmCategory.PRESSURE, severity: AlarmSeverity.INFO,
        message: 'No driving force — reservoir P ≤ downstream P.',
        unitId: id, unitName: uName
      });
    }
  }
  return alarms;
});
```

---

### F-010. Scene Import Migration

```javascript
for (const [id, u] of scene.units) {
  if (u.defId === 'tank') {
    // Remove obsolete params
    delete u.params.drawRate;
    delete u.params.tankMode;
    delete u.params.P_design_bar;

    // Migrate old mat_out connections → liq_out (safest default:
    // old tank drew mixed phase from bottom, closest to liquid draw)
    for (const conn of scene.connections) {
      if (conn.from.unitId === id && conn.from.portId === 'mat_out') {
        conn.from.portId = 'liq_out';
      }
    }
  }
}
```

---

### F-011. UI Display Name Changes

defId unchanged in all cases. Display name updated in registration
and profile. Equipment annotations added as comments for future help
system generation.

```javascript
// valve registration:
//   name: 'Pressure Regulator'
//   Equipment: Spring-loaded diaphragm pressure regulator.
//     Maintains outlet at setpoint Pout (isenthalpic).
//     Opens fully if downstream P exceeds setpoint.
//     Real-world: Fisher, Swagelok KBP, Tescom 44-2200.

// splitter registration:
//   name: 'Flow Divider'
//   Equipment: Active flow divider — enforces set ratio
//     independent of downstream conditions.
//     Real-world: hydraulic gear-type flow dividers,
//     ratio-controlled valve pairs, volumetric dosing systems.
//     NOT a passive tee (which splits by downstream resistance).

// restriction registration:
//   name: 'Restriction'
//   Equipment: Fixed orifice plate or restriction orifice.
//     Imposes constant ΔP (isenthalpic).
//     Real-world: orifice plates, restriction orifices,
//     capillary tubes, partially-open manual valves.
```

---

### F-012. TimeClock Fixes (Pre-requisite)

Six bugs in the time system that will break S5-lite tank physics if
left unfixed. Implemented as S5a-0 before any tank/trace work.

**Bug inventory:**

| # | Bug | Root cause | Impact on S5-lite |
|---|---|---|---|
| 1 | Import sets t=0, reset sets t=43200 | Hardcoded literals disagree | Minor: cosmetic time jump |
| 2 | Test button poisons reset snapshot | btnTest sets mode='test' without restoring inventory; next Step captures modified state as "initial" | **Critical:** reset never works after Test→Step cycle |
| 3 | Tank tick uses dt in steady-state Cv cap | `actualDraw = min(drawRate, total/dt)` — dt-dependent flow inside solver iteration | **Critical for old model only** — S5-lite Cv equation has no dt. Documenting as root cause of Denis's observed "first run ≠ subsequent run" behavior |
| 4 | Units placed mid-sim have no reset snapshot | `_captureInitial` runs once on first Step | Moderate: reset leaves mid-sim units at current state |
| 5 | Export loses time context | t, frame, _initial not serialized | Moderate: exported scenes lose timeline |
| 6 | `_reinitInventoryIfTest` silent in paused mode | Guard `mode !== 'test'` blocks param changes from reinitializing | Minor: known, by design. Documented. |

**Fix 1: T0 constant.**

```javascript
// At module level, next to TimeClock:
const T0_SECONDS = 43200;  // noon Day 1 — universal base time

// TimeClock initialization:
const TimeClock = {
  t: T0_SECONDS,
  // ...
};

// TimeClock.reset:
reset(scene) {
  TimeClock._restoreInitial(scene);
  TimeClock.t = T0_SECONDS;
  // ...
}

// importJSON:
TimeClock.t = T0_SECONDS;  // was: 0
```

**Fix 2: Test button restores inventory.**

The Test button means "go back to design mode and re-solve the
initial state." It must restore inventories, not just flip the mode
flag. Without this, reset is permanently broken after any Test→Step
cycle.

```javascript
btnTest.addEventListener('click', () => {
  stopPlay();
  // Restore inventories to initial snapshot (same as reset)
  TimeClock._restoreInitial(scene);
  TimeClock.t = T0_SECONDS;
  TimeClock.frame = 0;
  TimeClock.mode = 'test';
  const solveResult = solveScene(scene);
  setStatus(describeSolve());
  afterSolve(solveResult);
});
```

This makes Test equivalent to Reset except the UI stays in
"design mode" (test). Player experience: Test = "start over and
let me re-solve without advancing time."

**Fix 3: Document old tank dt bug (no code change).**

The old tank tick computes `actualDraw = min(drawRate, total / dt)`.
This cap is dt-dependent: with dt=3600, a 6 mol inventory caps draw
to 0.0017 mol/s — the solver converges to a false steady-state where
inlet ≈ outlet and level appears static. On the second run (after
one updateInventory call adds 3600 mol), the cap lifts and behavior
changes.

S5-lite eliminates this: the Cv equation `Q = Cv × (opening/100)
× √(ΔP / (SG × 1e5))` has no dt. Flow is purely a function of
tank state (P, composition) and downstream pressure. dt only
appears in updateInventory where it belongs.

No code change — the old tank tick is being replaced entirely.
Documenting for the test migration: old tests 170–172 used
drawRate and will be deleted, not adapted.

**Fix 4: Capture mid-sim units.**

```javascript
step(scene) {
  if (TimeClock.mode === 'test') {
    // Initialize inventories on first step
    for (const [uid, u] of scene.units) {
      const def = UnitRegistry.get(u.defId);
      if (def && def.inventory && def.initInventory && !u.inventory) {
        u.inventory = def.initInventory(u.params);
      }
    }
    TimeClock._captureInitial(scene);
    TimeClock.mode = 'paused';
  }

  // ── NEW: capture any units added since last capture ──
  if (TimeClock._initial) {
    for (const [uid, u] of scene.units) {
      if (u.inventory && !TimeClock._initial.has(uid)) {
        TimeClock._initial.set(uid,
          JSON.parse(JSON.stringify(u.inventory)));
      }
    }
  }

  // ... rest of step unchanged
}
```

**Fix 5: Export/import time context.**

Export version bump: 16 → 17.

```javascript
// exportJSON additions:
data.version = 17;
data.time = {
  t: TimeClock.t,
  frame: TimeClock.frame,
  mode: TimeClock.mode   // 'test' | 'paused'
};
// Per-unit: save initial snapshot alongside current inventory
for (const unitData of data.units) {
  if (TimeClock._initial) {
    const init = TimeClock._initial.get(unitData.id);
    if (init) unitData.inventoryInitial = init;
  }
}

// importJSON additions (version ≥ 17):
if (data.time) {
  TimeClock.t = data.time.t ?? T0_SECONDS;
  TimeClock.frame = data.time.frame ?? 0;
  TimeClock.mode = data.time.mode === 'paused' ? 'paused' : 'test';
} else {
  // Legacy (version ≤ 16): reset to base
  TimeClock.t = T0_SECONDS;  // was: 0
  TimeClock.frame = 0;
  TimeClock.mode = 'test';
}

// Restore _initial from saved data
TimeClock._initial = null;
for (const u of data.units) {
  if (u.inventoryInitial) {
    if (!TimeClock._initial) TimeClock._initial = new Map();
    TimeClock._initial.set(u.id, u.inventoryInitial);
  }
}
```

**Fix 6: No code change.** `_reinitInventoryIfTest` is correct — param
changes during simulation should NOT reset inventory. Documented in
Bug 6 rationale above. If a player needs to fix initial fill, they
reset first.

---

## Tests (~55 new)

### TimeClock Fixes (T-TC01–T-TC08)

| # | Test | Assert |
|---|------|--------|
| TC01 | Step from test mode | t = T0 + dt, frame = 1, mode = 'paused' |
| TC02 | Reset after stepping | t = T0, frame = 0, mode = 'test', inventory = initial |
| TC03 | Test button after stepping restores inventory | Step 5×, click Test (mode='test' + restore), Step again → _captureInitial captures ORIGINAL state, not stepped state |
| TC04 | Test→Step→Test→Step cycle: reset still works | Step 3×, Test, Step 3×, Reset → inventory = original |
| TC05 | Unit placed mid-sim gets snapshot | Step 2×, place new inventory unit, Step 1×, Reset → new unit inventory = state at placement |
| TC06 | Export at frame 5, import: t/frame/mode restored | Export, import, check t = T0 + 5×dt, frame = 5 |
| TC07 | Export _initial, import, reset: original inventory restored | Step 5×, export, import, reset → inventory = original |
| TC08 | Legacy import (version ≤ 16): t = T0 (not 0) | Import v16 JSON, check t = 43200 |

### computeTankState (T-PS01–T-PS06)

| # | Test | Assert |
|---|------|--------|
| 01 | Pure N₂ gas, 1 mol, 0.15 m³, 300K | P ≈ nRT/V ±5% |
| 02 | Pure H₂O liquid, 100 mol, 300K | V_liq > 0, level > 0 |
| 03 | H₂O + N₂ mix | H₂O condensable, N₂ headspace |
| 04 | Empty inventory | P ≈ 0, level = 0 |
| 05 | All liquid | P = 200 bar sentinel |
| 06 | Deterministic | Two calls identical |

### Tank (T-PS07–T-PS20)

| # | Test | Assert |
|---|------|--------|
| 07 | Gas draw: opening_gas=50%, N₂ 5 bar → sink | Q_gas > 0, Cv equation, vapor composition |
| 08 | Liquid draw: opening_liq=100%, H₂O 50% level → sink | Q_liq > 0, Cv equation, liquid composition |
| 09 | Both draws open simultaneously | Q_gas + Q_liq, each from correct phase |
| 10 | Opening=0% on both | Q_gas=0, Q_liq=0 |
| 11 | Gas draw reverse pressure | ΔP < 0 → Q=0, MINOR alarm |
| 12 | Depletion over 2 dt | inventory ↓, Q ↓ |
| 13 | Relief valve: P > P_relief, vent connected | gas flows to vent port, WARNING |
| 14 | Relief valve: P > P_relief, vent unconnected | gas removed, WARNING "venting to atmosphere" |
| 15 | Overflow: level > threshold, overflow connected | liquid flows to port, WARNING |
| 16 | Overflow: level > threshold, overflow unconnected | liquid removed, WARNING "draining to ground" |
| 17 | Both safeties active simultaneously | P > P_relief AND level > threshold, both fire |
| 18 | Empty tank (gas phase) | Q_gas=0, MINOR |
| 19 | initInventory gas mode | P_init=5 bar → n = PV/RT, computeTankState matches |
| 20 | initInventory liquid mode | level_init=50% → V_liq, computeTankState level matches |
| 21 | updateInventory mass balance | in − gas − liq − vent − overflow = accumulation |
| 22 | updateInventory T evolution | Hot feed → T rises (adiabatic mixing) |

### Reservoir (T-PS23–T-PS27)

| # | Test | Assert |
|---|------|--------|
| 23 | Gas, opening=100%, 5 bar → sink | Q > 0, Cv match |
| 24 | Opening=0% | Q=0, MINOR |
| 25 | P_res ≤ P_downstream | Q=0, MINOR |
| 26 | Composition | outlet fractions correct |
| 27 | No depletion | Q constant across ticks |

### Sink (T-PS28–T-PS29)

| # | Test | Assert |
|---|------|--------|
| 28 | Absorbs all flow | absorbed_mol_s correct |
| 29 | Reports expansion | inlet.P_Pa, outlet.P_Pa |

### Restriction (T-PS30–T-PS32)

| # | Test | Assert |
|---|------|--------|
| 30 | Pin=5, dP=2 | Pout=3 bar, isenthalpic |
| 31 | dP > Pin | Pout clamped, check valve |
| 32 | Shared tick | H_in = H_out |

### Pressure Trace (T-PS33–T-PS42)

| # | Test | Assert |
|---|------|--------|
| 33 | Tank gas_out → sink | P_down = P_atm |
| 34 | Tank liq_out → sink (separate trace) | P_down = P_atm (independent) |
| 35 | Tank → valve(Pout=2) → sink | P_down = 2 (regulates) |
| 36 | Tank → restr(dP=2) → sink | P_down = P_atm + 2 |
| 37 | Tank → divider → sink + TankB(3) | max = 3 |
| 38 | Tank → comp(Pout=10) → sink | P_down = −4.1, ΔP=9.1 |
| 39 | Tank → turbine(Pout=2) → sink | P_down = 3.9, ΔP=1.1 |
| 40 | Tank → valve(Pout=2) → TankB(3) | look-through, P_down = 3, WARNING |
| 41 | Tank → pump(Pout=10) → Tank (recirc) | P_down = 0, ΔP=5 |
| 42 | Dead end (unconnected) | P_down = P_atm |

### Valve Setpoint Validation (T-PS43–T-PS44)

| # | Test | Assert |
|---|------|--------|
| 43 | Valve Pout > downstream: regulates | Pout = par.Pout, canRegulate=true |
| 44 | Valve Pout < downstream: pass-through | Pout = sIn.P, WARNING alarm |

### Flow Divider Diagnostics (T-PS45–T-PS46)

| # | Test | Assert |
|---|------|--------|
| 45 | Divider branch P_eff ≥ P_in | MINOR: check valve alarm, names blocked port |
| 46 | Divider branches differ by >0.5 bar, all < P_in | MINOR alarm |

### Regression (T-PS47)

| # | Test | Assert |
|---|------|--------|
| 47 | All 393 surviving pre-S5 tests pass | zero delta |

**Gate:** 393 + 8 + 47 = 448 cumulative.

---

## Implementation Checklist

```
S5a-0 (TimeClock fixes — prerequisite):
  [ ] T0_SECONDS constant (43200) — replace all hardcoded literals
  [ ] Fix import: t = T0_SECONDS (was 0)
  [ ] Fix Test button: restore inventories + reset t/frame before re-solve
  [ ] Fix _captureInitial gap: step() captures mid-sim units
  [ ] Export version 17: save t, frame, mode, inventoryInitial
  [ ] Import version 17: restore t, frame, mode, _initial
  [ ] Legacy import (≤ 16): t = T0_SECONDS (backward compat)
  [ ] Delete old tank tests 169–174 (old model, replaced in S5a-2)
  [ ] Adapt tests 160–161 (t=0 start → T0_SECONDS)
  [ ] Tests T-TC01–T-TC08
  [ ] Regression gate: 399 − 6 (deleted) + 8 (new) = 401

S5a-1 (computeTankState + trace):
  [ ] computeTankState() pure function (Block 1)
  [ ] K_RELIEF_BASE, K_OVERFLOW_BASE constants
  [ ] _inventoryMW, _compositionMW helpers
  [ ] resolveDownstreamPressures() + traceToAnchor()
      Tank: trace gas_out and liq_out independently
      Reservoir: trace mat_out
      Result keyed by "unitId:portId"
  [ ] valveStatus + dividerStatus caches in solver context
  [ ] Export on PG
  [ ] Tests T-PS01–T-PS06 (computeTankState)
  [ ] Tests T-PS33–T-PS42 (trace, incl. dual outlet)
  [ ] Regression gate: 401 + 16 = 417

S5a-2 (units + profiles):
  [ ] Replace tank registration (5-port, 2h×3w footprint)
      Ports: mat_in, gas_out, liq_out, vent, overflow
      Dual Cv outlets (vapor/liquid phase draws)
      Relief valve (automatic, P > P_relief)
      Overflow (automatic, level > overflow_level)
      Connected/unconnected safety port logic
  [ ] Tank initInventory (gas mode: P_init, liquid mode: level_init)
  [ ] Tank updateInventory (5-port mass balance, adiabatic T mixing)
  [ ] Tank inspector layout (status, gas/liq outlets, safety, init)
  [ ] Port labels on canvas
  [ ] Reservoir registration (1-port, Cv tick)
  [ ] Sink enhancement (boundary, dual reporting)
  [ ] Restriction registration (fixed ΔP)
  [ ] _isenthalpicThrottleTick shared function
  [ ] Valve migration to shared tick + setpoint validation
  [ ] Valve display name → "Pressure Regulator"
  [ ] Splitter display name → "Flow Divider"
  [ ] Splitter check valve alarm (reads dividerStatus)
  [ ] Equipment annotation comments (valve, splitter, restriction)
  [ ] 7 profile registrations (2 tank, 3 reservoir, 1 restriction)
  [ ] Remove old tank profile
  [ ] Scene import migration (remove drawRate, remove tankMode)
  [ ] Pressure alarm source
  [ ] Tests T-PS07–T-PS32 (tank, reservoir, sink, restriction)
  [ ] Tests T-PS43–T-PS46 (valve validation, divider diagnostics)

S5a-3 (integration + regression):
  [ ] Full regression gate T-PS47 (448 tests)
  [ ] Version bump v14.0.0
```

---

## Deferred

| Topic | Status |
|---|---|
| Source consolidation | Separate cleanup session |
| Port naming harmonization | Separate cleanup session |
| S5-advanced (k_resistance, passive tee, zones) | ~480 lines, on demand |
| Sink J-T correction (PR real gas) | Future enhancement |
| Alarm refinement | Dedicated sprint: `code` field, cause→consequence format, INFO path through bridge |
| Tank sub-stepping (internal dt subdivision) | Future: accurate safety valve integration at large dt |
| Adaptive dt | Future: auto-adjust dt based on inventory rate-of-change |
