# PTIS_S2_SPEC
## S2 — Power Management
### processThis v13.1.0 → v13.2.0 (post-S1)

---

## Overview

**What:** Replace sink_electrical's infinite demand with a finite
ratedPower_kW. Add overload detection with severity-scaled consequences
including fry state. Implement priority-based load shedding on hubs.
Formalize curtailment signaling on direct connections.

**Sessions:** 2 (overload/fry logic, then priority allocation + tests).

**Risk:** Low-medium. Contained changes to power dispatch; no new units,
no new physics models.

**Dependencies:** S1 (alarm source infrastructure, `_rationalize()`).

**Required by:** S6 (electrochemical reactor power demand contract).

**Baseline state (post-S1):**
- Power system: hubs + batteries + grid_supply + three-tier dispatch
- `sink_electrical.powerDemand = Infinity` (line 7713)
- `allocatePower()` uses proportional allocation (line 7586)
- No overload detection, no fry trigger from electrical overload
- Consumers read power via `s.hubAllocated_W ?? sElec.actual`

**After S2:**
- All consumers have finite ratedPower
- Overload → WARNING/ERROR/CRITICAL → fry
- Hub uses priority-based shedding (CRITICAL > NORMAL > DEFERRABLE)
- Direct connections signal curtailment and check overload
- ~328 tests (320 + 8 new)

---

## Design Principles

**WYSIWYG (NNG-3):** Physics doesn't judge intent. Connect 500 kW to a
50 kW load → 500 kW flows → load fries. User sees parameters, physics
executes consequences.

**Finite demand everywhere:** No unit declares Infinity demand. Every
consumer has a physical basis: compression work, heating setpoint, rated
absorption capacity.

**Overload ≠ curtailment:** Curtailment = not enough power (graceful
degradation, unit produces less). Overload = too much power (equipment
damage, escalating to destruction). Different failure modes, different
severity, different user response.

---

# S2-A. sink_electrical Rated Capacity

## Current State

**File:** `processThis.html`
**Line:** 7713
```javascript
u.powerDemand = Infinity;
```

The sink_electrical currently acts as a zero-impedance bolted fault —
it absorbs all available power with no limit, starving every other
consumer on a shared bus. No user-visible parameter controls this.

## Changes

### A1. Add ratedPower_kW parameter

**Line:** ~9497 (in the `initParams` switch — add case before the
`// Units with no params` comment)

```javascript
case 'sink_electrical':
  unit.params = { ratedPower_kW: 1000 };  // 1 MW default (generous)
  break;
```

### A2. Replace Infinity demand

**Line:** 7713
**Current:**
```javascript
u.powerDemand = Infinity;
```
**Replace with:**
```javascript
u.powerDemand = (par.ratedPower_kW ?? 1000) * 1000;  // W
```

### A3. Update tick function

**Line:** 7709–7715 (sink_electrical tick)
**Replace entire tick with:**
```javascript
tick(u, ports, par) {
  const rated_W = (par.ratedPower_kW ?? 1000) * 1000;
  u.powerDemand = rated_W;

  const sIn = ports.in;
  const received_W = sIn ? (sIn.actual ?? sIn.available ?? 0) : 0;

  // Overload check (see S2-B)
  const overloadInfo = checkOverload(received_W, rated_W, u);

  u.last = {
    absorbed_W: received_W,
    rated_W: rated_W,
    headroom_W: rated_W - received_W,
    ...overloadInfo
  };
}
```

### A4. Inspector update

**File:** `processThis.html` — `UnitInspector.sink_electrical`

Add to `params()`:
```javascript
{ label: 'Rated power (kW)',
  get: () => u.params.ratedPower_kW ?? 1000,
  set: v => u.params.ratedPower_kW = Math.max(0.1, v),
  step: 10, decimals: 1, validate: { gt: 0 } }
```

Add to `power()`: headroom indicator, overload status.

---

# S2-B. Overload/Fry Logic

## Overload Detection Function

New pure function, placed near the power dispatch section:

```javascript
/**
 * Check if a unit is receiving more power than its rating.
 * @param {number} received_W  - Actual power received
 * @param {number} rated_W     - Unit's rated power capacity
 * @param {object} unit        - Unit instance (reads/writes unit.fried)
 * @returns {object} { overload, overloadPct, overloadSeverity, fried }
 */
function checkOverload(received_W, rated_W, unit) {
  if (unit.fried) {
    return {
      overload: false,
      overloadPct: 0,
      overloadSeverity: null,
      fried: true,
      error: {
        severity: 'CRITICAL',
        message: `Equipment destroyed by electrical overload. Replace unit or reset.`
      }
    };
  }

  if (rated_W <= 0 || received_W <= rated_W * 1.05) {
    return { overload: false, overloadPct: 0, overloadSeverity: null, fried: false };
  }

  const pct = ((received_W - rated_W) / rated_W) * 100;

  let severity;
  if (pct > 50) {
    severity = 'CRITICAL';
    unit.fried = true;  // Permanent damage
  } else if (pct > 20) {
    severity = 'ERROR';
  } else {
    severity = 'WARNING';
  }

  return {
    overload: true,
    overloadPct: pct,
    overloadSeverity: severity,
    fried: unit.fried || false,
    error: {
      severity,
      message: severity === 'CRITICAL'
        ? `Overload ${pct.toFixed(0)}% — equipment destroyed. Received ${(received_W/1000).toFixed(1)} kW, rated ${(rated_W/1000).toFixed(1)} kW.`
        : `Overload ${pct.toFixed(0)}% — received ${(received_W/1000).toFixed(1)} kW, rated ${(rated_W/1000).toFixed(1)} kW.`
    }
  };
}
```

## Overload Severity Thresholds

| Overload % | Severity | Consequence |
|-----------|----------|-------------|
| 0–5% | OK | Within tolerance margin |
| 5–20% | WARNING | Alarm. Unit operates normally. |
| 20–50% | ERROR | Alarm. Unit still operates but flagged. |
| > 50% | CRITICAL | **Fry state.** Unit permanently stops computing. |

## Fry State Behavior

When `unit.fried = true`:
- Tick function returns immediately (ξ = 0, Q = 0, ΔP = 0, no output)
- Output ports produce zero-flow passthrough
- Visual indicator: existing fry icon/rendering state
- **Persists** across solver iterations and ticks
- **Cleared by:** user replaces unit OR clicks "Reset" in inspector
- Serialized in exportJSON: `unit.fried: true`

## Fry guard in tick functions

Each electrical consumer's tick function gains a fry guard at the top:

```javascript
// Fry guard (S2)
if (u.fried) {
  u.last = { fried: true, error: {
    severity: 'CRITICAL',
    message: 'Unit destroyed by electrical overload. Replace or reset.' }};
  u.powerDemand = 0;
  // Passthrough zero-flow on material ports
  if (ports.mat_in) {
    ports.mat_out = { type: StreamType.MATERIAL, P: ports.mat_in.P,
      n: { ...ports.mat_in.n }, phaseConstraint: 'VL',
      H_target_Jps: thermo.getHdot_Jps(ports.mat_in) };
  }
  return;
}
```

## Units Receiving Overload Logic

| defId | ratedPower source | Notes |
|-------|-------------------|-------|
| sink_electrical | `par.ratedPower_kW × 1000` | New param (S2-A) |
| compressor | `workFull.W_shaft_W` at setpoint | Already computed (line 7974) |
| pump | `workFull.W_shaft_W` at setpoint | Already computed (line 8110) |
| electric_heater | `Q_demand_W` in T_setpoint mode, `par.power_kW × 1000` in power_setpoint | Already computed |
| reactor_equilibrium | `abs(iso_Q_duty_W)` in isothermal/fixed mode | Only when heatDemand ≠ 'none' |

For compressor, pump, and heater: the rated power is the power they
*request* (their `u.powerDemand`). If they receive more than
`u.powerDemand × 1.05`, overload triggers. This can happen on direct
connections when a grid_supply has higher capacity than the consumer
demands and delivers its full output.

### Overload check insertion points

**Compressor** (line ~7978):
```javascript
const W_avail = s.hubAllocated_W ?? (sElec.actual ?? sElec.available ?? Infinity);
// S2: Overload check
const overloadInfo = checkOverload(W_avail, workFull.W_shaft_W, u);
if (u.fried) { /* fry guard return */ }
```

**Pump** (line ~8114): Same pattern.

**Electric heater** (line ~8243): Same pattern, rated = `u.powerDemand`.

**Reactor** (line ~9274): Only in isothermal/fixed modes where `elec_in`
is active. Rated = `u.powerDemand` (the computed isothermal duty).

---

# S2-C. Hub Priority Allocation

## Priority Levels

```javascript
const PowerPriority = Object.freeze({
  CRITICAL: 1,     // Life support, controls — shed last
  NORMAL: 2,       // Standard process equipment
  DEFERRABLE: 3    // Non-essential, battery charging — shed first
});
```

## New Parameter on All Consumers

Add `powerPriority` to consumers connected to hubs. Default: `NORMAL` (2).

```javascript
// In initParams for pump, compressor, electric_heater, reactor_equilibrium:
unit.params.powerPriority = PowerPriority.NORMAL;

// sink_electrical default:
unit.params.powerPriority = PowerPriority.DEFERRABLE;
```

Inspector addition: dropdown selector for each consumer showing
CRITICAL / NORMAL / DEFERRABLE.

## Revised allocatePower()

**File:** `processThis.html`
**Line:** 7586
**Replace** the existing `allocatePower` function:

```javascript
function allocatePower(consumers, totalSupply_W) {
  const allocation = {};
  if (consumers.length === 0) return allocation;

  // Handle infinite demand (unchanged from v12.9.0)
  const hasInfinite = consumers.some(c => !isFinite(c.demand_W));
  if (hasInfinite) {
    // ... existing infinite-demand logic preserved unchanged ...
    // (See current code at line 7604–7630)
    return allocation;
  }

  // Group by priority tier
  const tiers = [[], [], []];  // [CRITICAL, NORMAL, DEFERRABLE]
  for (const c of consumers) {
    const tier = Math.min(2, Math.max(0, (c.priority ?? 2) - 1));
    tiers[tier].push(c);
  }

  let remaining_W = totalSupply_W;

  for (const tier of tiers) {
    const tierDemand = tier.reduce((s, c) => s + c.demand_W, 0);
    if (tierDemand <= 0) {
      for (const c of tier) {
        allocation[c.unitId] = {
          demand_W: 0, allocated_W: 0, factor: 1.0,
          priority: c.priority ?? 2
        };
      }
      continue;
    }

    const tierSupply = Math.min(remaining_W, tierDemand);
    const tierFactor = tierDemand > 0 ? tierSupply / tierDemand : 1.0;

    for (const c of tier) {
      const allocated = c.demand_W * tierFactor;
      allocation[c.unitId] = {
        demand_W: c.demand_W,
        allocated_W: allocated,
        factor: tierFactor,
        priority: c.priority ?? 2
      };
    }

    remaining_W -= tierSupply;
  }

  return allocation;
}
```

**Behavior:**
1. Allocate CRITICAL tier fully (up to remaining supply)
2. Remaining → NORMAL tier (curtailed uniformly within tier if short)
3. Remaining → DEFERRABLE tier (curtailed uniformly within tier if short)
4. If CRITICAL alone exceeds supply → curtail CRITICAL uniformly

This is a backwards-compatible change: existing scenes with no
`powerPriority` set default to NORMAL (2), which reproduces the current
proportional allocation behavior.

## Hub Consumer List Update

**Line:** ~11283 (Step C consumer list building)
**Current:**
```javascript
const priority = consumerU?.params?.hubPriority ?? 1;
```
**Change:**
```javascript
const priority = consumerU?.params?.powerPriority ?? PowerPriority.NORMAL;
```

Note: the existing code reads `hubPriority` which defaults to 1.
This is a leftover — no unit currently sets `hubPriority`. The change
to `powerPriority` with default NORMAL (2) is semantically correct.

---

# S2-D. Direct Connection Curtailment

## Current State

Direct connections (grid_supply → consumer, no hub) already compute
`actualDraw_W = min(supply_capacity, consumer_demand)` and pass a
`curtailmentFactor` (line ~11500). This works correctly after the
v12.9.0 finite demand fix.

## S2 Addition: Overload Check

After the existing `actualDraw_W` computation (line ~11499), add:

```javascript
// S2: Overload check for direct connections
// If supply capacity exceeds consumer's rated power, the consumer
// receives more than it can handle.
for (const conn of outConns) {
  const consumerU = scene.units.get(conn.to.unitId);
  const consumerUD = scene.runtime.unitData.get(conn.to.unitId);
  if (!consumerU || !consumerUD) continue;

  const consumerRated = consumerUD.powerDemand || 0;
  const allocated = isFinite(consumerRated)
    ? Math.min(maxPower_W, consumerRated)
    : maxPower_W;

  // Write allocation to scratch
  const cs = runtimeCtx.scratch(conn.to.unitId);
  cs.hubAllocated_W = allocated;
  cs.hubAllocFactor = consumerRated > 0 ? allocated / consumerRated : 1.0;
}
```

The key change: for direct connections, the allocated power is capped
at `min(supply, demand)` — the consumer never receives more than it
requests. This prevents accidental overload from a direct connection
where the source has higher capacity than the consumer's demand.

**Exception:** If the consumer has `powerDemand = 0` (idle) but is
still connected to a live source, no power flows (allocated = 0).

---

# S2-E. Fry State Serialization

## exportJSON

Add to unit serialization:
```javascript
if (unit.fried) unitJSON.fried = true;
```

## importJSON

Add to unit deserialization:
```javascript
if (unitJSON.fried) unit.fried = true;
```

## Inspector Reset

Add to each consumer's inspector a "Reset Fry" button that appears
only when `unit.fried === true`:

```javascript
{ type: 'button',
  label: '⚡ Reset (replace equipment)',
  visible: () => u.fried,
  action: () => { delete u.fried; } }
```

In game mode (S8), this may require a spare part from inventory.
In sandbox mode, reset is free.

---

# S2-F. Alarm Integration

## Overload Alarm Source

Register a new alarm source for power overload events. This runs in
the existing AlarmSystem pipeline alongside the equipment_limits source
from S1.

```javascript
AlarmSystem.register('power_overload', (scene) => {
  const alarms = [];
  for (const [id, unit] of scene.units) {
    const ud = scene.runtime?.unitData?.get(id) || unit;
    const last = ud.last || unit.last || {};

    if (last.overload || last.fried) {
      alarms.push({
        id: `${id}_power_overload`,
        category: 'POWER_OVERLOAD',
        severity: last.overloadSeverity || (last.fried ? 'CRITICAL' : 'WARNING'),
        message: last.error?.message || 'Power overload detected',
        unitId: id,
        paramName: 'power',
        paramValue: last.absorbed_W || last.W_avail,
        limitTag: 'overload',
        limitValue: last.rated_W || unit.powerDemand,
        source: 'power_overload'
      });
    }
  }
  return alarms;
});
```

---

## Implementation Checklist

```
Session 1 — Overload/Fry:
  [ ] sink_electrical: add ratedPower_kW param (default 1000)
  [ ] sink_electrical: powerDemand = ratedPower (kill Infinity)
  [ ] sink_electrical: tick rewrite with overload check
  [ ] checkOverload() pure function
  [ ] Fry guard in compressor tick (~line 7978)
  [ ] Fry guard in pump tick (~line 8114)
  [ ] Fry guard in electric_heater tick (~line 8243)
  [ ] Fry guard in reactor_equilibrium tick (~line 9274, isothermal/fixed only)
  [ ] Fry state serialization (export/import)
  [ ] Inspector "Reset Fry" button
  [ ] AlarmSystem.register('power_overload', ...)

Session 2 — Priority + Tests:
  [ ] PowerPriority enum (CRITICAL=1, NORMAL=2, DEFERRABLE=3)
  [ ] powerPriority param on all consumers (default NORMAL)
  [ ] Rewrite allocatePower() for priority tiers
  [ ] Hub consumer list: hubPriority → powerPriority
  [ ] Direct connection overload check
  [ ] Inspector: priority dropdown for consumers
  [ ] 8 tests passing

Total S2: ~8 new tests → 328 cumulative
```

---

## Tests (~8)

| # | Test | Setup | Expected | Assert |
|---|------|-------|----------|--------|
| 1 | Priority shedding | Hub: grid 100W. Consumer A (CRITICAL, 60W), B (NORMAL, 60W), C (DEFERRABLE, 60W) | A gets 60W, B gets 40W, C gets 0W | alloc[A].factor === 1.0, alloc[C].factor === 0 |
| 2 | CRITICAL curtailment | Hub: grid 40W. Consumer A (CRITICAL, 60W), B (CRITICAL, 60W) | Both get 20W (proportional) | alloc[A].factor ≈ 0.333 |
| 3 | Surplus overload | Hub: turbine 100W, sink_electrical rated 50W on surplus port | Surplus 100W > rated 50W → fry | sink.fried === true |
| 4 | Direct overload | grid_supply 200W → sink_electrical rated 50W (no hub) | Allocated = min(200, 50) = 50W, no overload | sink.fried === false |
| 5 | Fry persistence | Compressor receives 200% rated → fried. Remove overload source. | Unit stays fried | unit.fried === true after next tick |
| 6 | Fry reset | Fried compressor. Call delete unit.fried. | Unit computes normally | unit.fried === undefined, unit.last has output |
| 7 | sink_electrical finite demand | sink_electrical rated 500 kW on hub with 1000 kW supply | Demands 500 kW, receives 500 kW. No overload. | u.powerDemand === 500000 |
| 8 | Energy balance closure | Hub: 100W grid, 3 consumers totaling 80W demand | Supply = demand + surplus, Σallocated ≤ supply | Math.abs(totalAllocated - supply) < 0.01 |

**Gate:** All S1 tests (312) + 8 new pass.

---

## Edge Cases

**Infinity demand migration:** Existing saved scenes with sink_electrical
have no `ratedPower_kW` param. The fallback `par.ratedPower_kW ?? 1000`
ensures they get a 1 MW default — generous enough to not break existing
behavior while being finite.

**Reactor overload:** Only applies when `heatDemand !== 'none'` (isothermal
or fixed mode). In insulated mode (`heatDemand === 'none'`), the reactor
has no elec_in connection and cannot be overloaded electrically.

**Battery as consumer:** Batteries don't have `powerPriority` — they're
sources, not consumers. Battery charging is managed by the hub's surplus
path, not by consumer allocation.

**Gas turbine output:** Turbines are physics-fixed sources — their output
is determined by fluid conditions, not electrical load. They cannot be
overloaded because they produce, not consume. However, their output
creates surplus that must be absorbed (existing CATASTROPHIC surplus logic
in hub, line ~11395).

---

## What S2 Enables Downstream

| Consumer | What it uses from S2 |
|----------|---------------------|
| S6 (Electrochemical) | Power demand contract: `powerDemand = ξ_max × |ΔH_rxn| / η`. Uses same `checkOverload()` function. |
| S5 (Pressure) | Production gating reads power ERROR alarms to block flow in overloaded networks |
| S8 (Game) | Priority levels map to game mechanics: life support = CRITICAL, production = NORMAL, comfort = DEFERRABLE |
