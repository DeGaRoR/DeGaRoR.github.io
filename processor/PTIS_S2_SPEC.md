# PTIS_S2_SPEC
## S2 — Power Management
### processThis v13.1.0 → v13.2.0 (post-S1)

---

## Overview

**What:** Separate power dispatch metadata from stream objects
(foundational cleanup). Replace sink_electrical's infinite demand with
a finite ratedPower_kW. Add overload detection with severity-scaled
consequences including fry state. Implement priority-based load
shedding on hubs. Formalize curtailment signaling on direct connections.

**Sessions:** 3 (dispatch separation, overload/fry logic, then priority
allocation + tests).

**Risk:** Low-medium. Contained changes to power dispatch; no new units,
no new physics models.

**Dependencies:** S1 (alarm source infrastructure, `_rationalize()`),
S1-pre-3 through S1-pre-6 (power read standardisation, Infinity fix).

**Required by:** S6 (electrochemical reactor power demand contract).

**Baseline state (post-S1):**
- Power system: hubs + batteries + grid_supply + three-tier dispatch
- `sink_electrical.powerDemand = Infinity` (line 7713)
- `allocatePower()` uses proportional allocation (line 7586)
- No overload detection, no fry trigger from electrical overload
- Consumers read power via `s.hubAllocated_W ?? sElec.actual`
- Power port streams carry mixed physical state + dispatch metadata
- `stripDemandFromPorts()` patches oscillation from demand on ports
- Step B monitors hard-coded unit list (misses reactor)

**After S2:**
- Power streams carry physical state only (capacity, actual)
- Dispatch metadata in solver scratch + ud.last
- All consumers have finite ratedPower
- Overload → WARNING/ERROR/CRITICAL → fry
- Hub uses priority-based shedding (CRITICAL > NORMAL > DEFERRABLE)
- Direct connections signal curtailment and check overload
- ~323 tests (312 from S1 + 1 S2-pre + 10 S2-A/F)

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

# S2-pre. Separate Power Dispatch Metadata from Stream Objects

**Files:** `processThis.html` — hub tick (~line 7663), Step C
(~line 11363), Step D (~line 11507), `streamSignature()` (~line
10010), `portsChanged()` ABS_TOL (~line 10043),
`stripDemandFromPorts()` (~line 10086), Step B (~line 11219)

## Problem

Power port stream objects currently carry two kinds of data mixed
together:

- **Physical state:** `capacity` (equipment rating), `actual`
  (power flowing) — analogous to T, P, n on material streams
- **Dispatch metadata:** `demand` (consumer request),
  `curtailmentFactor` (allocation ratio) — control-system concepts
  with no physical analogue on a wire

This mixing has three concrete consequences:

**1. `stripDemandFromPorts()` exists as a patch.** It was added
because `demand` on ports caused infinite oscillation (tick resets
demand to 0, Step C restores it → `portsChanged` fires every
iteration). The function strips `demand` but leaves
`curtailmentFactor`, which is an incomplete fix for a design
problem. With clean separation, this function is unnecessary.

**2. Latent convergence bug: reactor not in Step B.** Step B
monitors demand changes for pump, compressor, and electric_heater
— but NOT reactor_equilibrium, which also sets variable
`powerDemand` in heated/insulated mode. Currently masked because
`curtailmentFactor` on the hub port catches the change via
`portsChanged()`. If CF is below tolerance but the allocation
shift is above tolerance (narrow window: material ΔT < 0.001 K
but power Δ > 0.01 W), convergence terminates prematurely. This
is accidental correctness — the code relies on a port summary
field to compensate for an incomplete convergence check.

**3. Blocks clean S2 design.** S2 adds overload modelling, fry
alarms, and priority-based shedding. All of these build on the
power dispatch lifecycle. Starting S2 with a model where streams
mix physical state with dispatch metadata means every S2 feature
inherits the ambiguity.

## Design

After this change, power port streams carry only physical state:
```javascript
// hub elec_out — after refactoring
{
  type: StreamType.ELECTRICAL,
  capacity: totalSupply_W,    // bus headroom
  actual:   totalSupply_W     // power flowing
}
```

Dispatch metadata moves to `ud.last` (for inspector display) and
solver scratch (for inter-iteration convergence):
```javascript
// hub ud.last — after refactoring
ud.last = {
  totalCapacity_W,
  totalSupply_W,
  totalDemand_W,              // was on port as 'demand'
  curtailmentFactor,          // was on port
  surplus_W,
  consumerAllocation          // already here
};
```

This implements the reviewer-recommended demand-dispatch-allocation
model:
1. **Demand signals:** consumer ticks set `u.powerDemand`
2. **Allocation results:** Steps B/C/D compute and write
   `scratch.hubAllocated_W` per consumer
3. **Consumers act on allocation:** ticks read scratch, never port

## Fix (5 parts)

**A. Step C: add per-consumer allocation change detection**

Currently Step C writes scratch but doesn't detect changes — it
relies on `curtailmentFactor` on the port to trigger convergence.
Add explicit detection, mirroring what Step D already does:
```javascript
for (const conn of outConns) {
  const alloc = consumerAllocation[conn.to.unitId];
  if (alloc) {
    const cs = runtimeCtx.scratch(conn.to.unitId);
    // Detect allocation change → force another iteration
    if (cs.hubAllocated_W !== undefined &&
        Math.abs(cs.hubAllocated_W - alloc.allocated_W) > 0.01) {
      changed = true;
    }
    cs.hubAllocFactor = alloc.factor;
    cs.hubAllocated_W = alloc.allocated_W;
  }
}
```

**B. Step B: make generic instead of hard-coded unit list**

Replace:
```javascript
if (_u.defId === 'pump' || _u.defId === 'compressor'
    || _u.defId === 'electric_heater') {
```
With:
```javascript
if (_ud.powerDemand > 0 && isFinite(_ud.powerDemand)) {
```
Catches reactor, plus any future power consumer (including S6
electrolyzer), without maintaining a list. `sink_electrical`
(Infinity) is excluded by the `isFinite` guard — and after S2-A
replaces Infinity with finite `ratedPower`, sink joins the
generic check automatically.

**C. Remove dispatch fields from port writes**

Hub tick, Step C, Step D, grid_supply, battery: stop writing
`demand` and `curtailmentFactor` on port stream objects. Move
these to `ud.last` for each relevant unit.

**D. Clean up convergence infrastructure**

- Delete `stripDemandFromPorts()` entirely (~12 lines)
- Remove `curtailmentFactor` and `demand` from `streamSignature()`
- Remove `curtailmentFactor` and `available` from `ABS_TOL`
  (`available` already removed by S1-pre-5)

**E. Update STREAM_CONTRACTS.POWER schema**

Remove `demand` and `curtailmentFactor` from the POWER lifecycle
documentation. They remain documented in the solver dispatch
section (Steps B–D) where they belong.

## Convergence after refactoring

All six `changed = true` triggers in the solver, with their status:

| Trigger | What | Status |
|---|---|---|
| Line 11057 | Unit material/physical port changes | Unchanged |
| Line 11104 | Tick exception | Unchanged |
| Line 11227 | Step B: consumer demand change | **Fixed** — now generic |
| Line 11395 | Step C: hub port physical changes | Unchanged (checks capacity, actual only) |
| NEW | Step C: per-consumer allocation change | **Added** — explicit detection |
| Line 11532 | Step D: direct-bus scratch change | Unchanged |

Power convergence is now driven by explicit allocation tracking
(Steps B, C, D) rather than implicit port field side effects.

## What doesn't change

- No consumer tick changes — they already read
  `scratch.hubAllocated_W`, not port fields
- No player-visible changes — inspector reads `ud.last`
- No connection topology changes
- No solver structural changes
- Material stream convergence completely unaffected

## Line count estimate

- Added: ~15 lines (allocation detection in Step C, generic Step B)
- Removed: ~30 lines (`stripDemandFromPorts`, port field writes,
  signature/tolerance entries)
- Net: ~−15 lines

## Tests

- Existing power tests (T208–T215, T220) verify conservation and
  curtailment via `ud.last` — most need no changes
- Tests that assert `curtailmentFactor` directly on port streams
  need updating to assert on `ud.last` instead
- Add 1 new test: reactor demand change triggers convergence
  iteration (validates the Step B + Step C fix)

## Ordering

S2-pre depends on S1-pre-3 (power read standardisation), S1-pre-5
(available migration), and S1-pre-6 (direct-bus Infinity fix).
Implement S2-pre first, verify all tests pass, then proceed to
S2-A.

**Risk:** Low-medium. Largest single S2 item but touches only the
dispatch loop, not consumer ticks. Consumer ticks already read
scratch. Convergence mechanism is a direct copy of Step D's
existing pattern. If anything breaks, revert to CF-on-port and
add the Step B generic fix separately — that alone fixes the
latent reactor convergence bug.

## Acceptance Criterion

**Hard rule:** After S2-pre, stream state objects on power ports
are pure physical state (`type`, `capacity`, `actual`). Dispatch
metadata (`demand`, `curtailmentFactor`) lives exclusively in
solver scratch (inter-iteration) and `ud.last` (inspector/
diagnostics). No solver convergence logic depends on demand or
curtailment fields on stream objects. `stripDemandFromPorts()` is
deleted.

**Verification:** `grep -n 'demand\|curtailmentFactor'` on any
port write inside a tick function or Step C/D returns zero hits
(excluding `ud.last` and scratch writes).

**NNG-5 update note:** S0 NNG-5 currently says "Consumers read
input.actual, never input.capacity." After S2-pre, consumers read
`scratch.hubAllocated_W`, not port fields at all. NNG-5 wording
should be updated post-S2 to: "Consumers read allocation from
solver scratch, never from port fields directly." This is a
documentation-only change to S0 — no code impact.

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

## Fry Cascade: Hub Surplus with Fried Absorber

**Scenario:** Turbine 100kW, consumers 60kW, surplus sink rated 20kW
on `elec_surplus`. Sink receives 40kW → 100% overload → fried.
Next iteration: fried sink sets `powerDemand = 0` and absorbs nothing.
But the hub still computes `netSurplus = 40kW` and checks the surplus
connection. The wire to the fried sink still exists →
`surplusConnected = true` → **no CATASTROPHIC raised**.

Physically this is wrong. A fried dump load is an open circuit. 40kW
with nowhere to go means bus voltage spikes and everything on the bus
should be destroyed.

**Fix:** Extend the hub surplus CATASTROPHIC check (line ~11378) to
verify the connected absorber is functioning:

```javascript
// [S2] Check if surplus sink is actually functioning
const surplusConnected = _ud.ports.elec_surplus?._connected;
let surplusSinkFunctioning = false;
if (surplusConnected) {
  // Find units connected to elec_surplus
  const surpConns = scene.connections.filter(
    c => c.from.unitId === _id && c.from.portId === 'elec_surplus'
  );
  for (const sc of surpConns) {
    const sinkU = scene.units.get(sc.to.unitId);
    if (sinkU && !sinkU.fried) {
      surplusSinkFunctioning = true;
      break;
    }
  }
}

if (netSurplus_W > 1 && !surplusSinkFunctioning) {
  // Surplus with no functioning absorber → bus destruction
  _ud.errors.push({
    severity: ErrorSeverity.CATASTROPHIC,
    message: surplusConnected
      ? `${(netSurplus_W/1000).toFixed(1)} kW surplus — dump load destroyed, no functioning absorber`
      : `${(netSurplus_W/1000).toFixed(1)} kW surplus with no elec_surplus sink — connect a dump load`
  });
}
```

This creates a proper fry cascade: turbine overproduces → dump load
fries → hub detects no functioning absorber → CATASTROPHIC → hub
faults → all consumers lose power. The player sees a chain of
consequences from undersizing their dump load.

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

# S2-D. Direct Connection Safety

## D1. Grid/Battery Direct Overload Check (existing scope)

Direct connections (grid_supply → consumer, no hub) already compute
`actualDraw_W = min(supply_capacity, consumer_demand)` and pass a
`curtailmentFactor` (line ~11500). This works correctly after the
v12.9.0 finite demand fix.

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

## D2. Physics-Fixed Direct Connection: Overspeed Detection

**Problem:** Step D only processes `grid_supply` and `battery`
(line 11468). A turbine wired directly to a consumer bypasses
dispatch entirely. The consumer falls back to reading the port
(`sElec.actual`) and uses what it needs. But physically:

A turbine's shaft power is set by gas expansion — non-throttleable.
If a turbine produces 50 kW and the consumer draws only 30 kW,
the 20 kW surplus has no electrical path. Without a hub's surplus
management, the generator cannot dissipate the excess torque:
rotor accelerates → overspeed → bearing failure, blade
liberation, generator winding damage. The turbine destroys itself.

This is why real plants NEVER direct-connect a turbine to a single
load without a governor or dump load — the hub models that
governor/switchboard function.

**Fix:** Add a new Step E after Step D that detects physics-fixed
sources on direct connections (no hub):

```javascript
// Step E: Physics-fixed source direct-connection overspeed check
for (const [_id, _u] of scene.units) {
  if (_u.defId === 'grid_supply' || _u.defId === 'battery' ||
      _u.defId === 'power_hub') continue;
  const _def = UnitRegistry.get(_u.defId);
  if (!_def) continue;

  // Find electrical output ports
  const elecOutPorts = _def.ports.filter(
    p => p.dir === PortDir.OUT && p.type === StreamType.ELECTRICAL
  );
  if (elecOutPorts.length === 0) continue;

  const _ud = scene.runtime.unitData.get(_id);

  for (const p of elecOutPorts) {
    const portData = _ud?.ports?.[p.portId];
    const sourceOutput_W = portData?.actual ?? 0;
    if (sourceOutput_W < 0.01) continue;  // not producing

    // Check: is this port connected to a hub?
    const outConns = scene.connections.filter(
      c => c.from.unitId === _id && c.from.portId === p.portId
    );
    const connectedToHub = outConns.some(c =>
      scene.units.get(c.to.unitId)?.defId === 'power_hub'
    );
    if (connectedToHub) continue;  // hub handles surplus

    // Direct connection: sum downstream demand
    let downstreamDemand_W = 0;
    for (const conn of outConns) {
      const consumerUD = scene.runtime.unitData.get(conn.to.unitId);
      downstreamDemand_W += consumerUD?.powerDemand || 0;
    }

    // Surplus on a physics-fixed direct connection = overspeed
    const surplus_W = sourceOutput_W - downstreamDemand_W;
    if (surplus_W > 1) {
      _ud.errors = _ud.errors || [];
      _ud.errors.push({
        severity: ErrorSeverity.CATASTROPHIC,
        message: `Overspeed: ${(sourceOutput_W/1000).toFixed(1)} kW output `
          + `but only ${(downstreamDemand_W/1000).toFixed(1)} kW load. `
          + `${(surplus_W/1000).toFixed(1)} kW surplus with no hub to `
          + `manage it — turbine destroyed. Connect through a power hub.`,
        code: 'OVERSPEED_NO_HUB'
      });
      _u.fried = true;  // permanent destruction
      _ud.last = _ud.last || {};
      _ud.last.error = _ud.errors[_ud.errors.length - 1];
    }

    // Also write allocation to downstream consumers (like Step D)
    for (const conn of outConns) {
      const consumerUD = scene.runtime.unitData.get(conn.to.unitId);
      const cs = runtimeCtx.scratch(conn.to.unitId);
      const d = consumerUD?.powerDemand || 0;
      cs.hubAllocated_W = isFinite(d) ? Math.min(d, sourceOutput_W) : sourceOutput_W;
    }
  }
}
```

**Physics rationale:** This is exactly what happens to an
unloaded turbine-generator. The hub's three-tier dispatch
(physics-fixed → responsive → battery) with surplus routing to
`elec_surplus` is the game's model of a real switchboard with
governor control and dump loads. Bypassing it bypasses safety.

**Player experience:** Player connects turbine directly to a
compressor. If the compressor needs less power than the turbine
produces → turbine fries immediately with a clear message telling
them to use a hub. This teaches the engineering principle that
physics-fixed sources need managed distribution.

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
Session 0 — Dispatch Separation (S2-pre):
  [ ] Step C: add per-consumer allocation change detection
  [ ] Step B: replace hard-coded unit list with generic
      powerDemand > 0 && isFinite check
  [ ] Hub tick, Step C, Step D, grid_supply, battery: remove
      demand + curtailmentFactor from port stream writes
  [ ] Move demand + curtailmentFactor to ud.last on hub
  [ ] Delete stripDemandFromPorts()
  [ ] Remove curtailmentFactor + demand from streamSignature()
      and ABS_TOL
  [ ] Update STREAM_CONTRACTS.POWER lifecycle docs
  [ ] Update tests: port-level CF assertions → ud.last assertions
  [ ] Add test: reactor demand change triggers convergence
  [ ] Verify: all 312 S1 tests pass + 1 new

Session 1 — Overload/Fry:
  [ ] sink_electrical: add ratedPower_kW param (default 1000)
  [ ] sink_electrical: powerDemand = ratedPower (kill Infinity)
  [ ] sink_electrical: tick rewrite with overload check
  [ ] checkOverload() pure function
  [ ] Fry guard in compressor tick (~line 7978)
  [ ] Fry guard in pump tick (~line 8114)
  [ ] Fry guard in electric_heater tick (~line 8243)
  [ ] Fry guard in reactor_equilibrium tick (~line 9274, isothermal/fixed only)
  [ ] Hub surplus: check absorber functioning, not just connected
  [ ] Step E: physics-fixed direct-connection overspeed detection
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

Total S2: ~11 new tests → 323 cumulative
```

---

## Tests (~10)

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
| 9 | Turbine direct overspeed | Turbine (50kW output) → compressor (30kW demand), no hub | Surplus 20kW, no hub → turbine fried | turbine.fried === true, error.code === 'OVERSPEED_NO_HUB' |
| 10 | Fry cascade: dump load fries | Hub: turbine 100kW, consumers 60kW, surplus sink rated 20kW | Sink fries (100% overload), then hub detects no functioning absorber → CATASTROPHIC | sink.fried === true, hub CATASTROPHIC error |

**Gate:** All S1 tests (312) + 1 S2-pre + 10 new pass.

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
creates surplus that must be managed:
- **Hub path:** surplus routes to `elec_surplus` → dump load absorbs it.
  If dump load fries, hub detects no functioning absorber → CATASTROPHIC.
- **Direct path (no hub):** if load < output, surplus has no path →
  Step E detects overspeed → turbine fries immediately with
  `OVERSPEED_NO_HUB`. Player must use a hub for physics-fixed sources.

---

## What S2 Enables Downstream

| Consumer | What it uses from S2 |
|----------|---------------------|
| S6 (Electrochemical) | Power demand contract: `powerDemand = ξ_max × |ΔH_rxn| / η`. Uses same `checkOverload()` function. |
| S5 (Pressure) | Production gating reads power ERROR alarms to block flow in overloaded networks |
| S8 (Game) | Priority levels map to game mechanics: life support = CRITICAL, production = NORMAL, comfort = DEFERRABLE |
