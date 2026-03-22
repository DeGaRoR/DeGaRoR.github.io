# S-CONTROLLER: Boolean Process Controller

### processThis v15.0.0

**Status:** DESIGN — not yet implemented.
**Depends on:** S-STATUS (unit operating modes must exist for the
controller to write mode changes).
**Priority:** LOW-MEDIUM — becomes urgent at Stabilize mission phase
(buffer management, production cycling).
**Estimated scope:** 1 session.

---

## Philosophy

A real pilot plant has a PLC (Programmable Logic Controller) that
reads sensor values and switches equipment on/off based on rules.
This unit models exactly that: a box on the flowsheet with a list
of boolean rules, each reading a process variable and writing a
unit mode.

The controller is deliberately simple.  It does not do PID, does
not manipulate continuous setpoints, does not iterate with the
solver.  It evaluates once between timesteps and writes discrete
mode changes.  This eliminates all convergence coupling risk.

Future versions may add continuous actions (setpoint manipulation,
PID loops), but v1 is boolean-only: the output is always a unit
mode (`on | off | bypass`).

---

## Controller Unit

### Registration

```javascript
UnitRegistry.register('controller', {
  name: 'Process Controller',
  category: UnitCategories.CONTROL,  // new category
  w: 2, h: 2,
  ports: [],  // no material or electrical ports
  inventory: false,
  tick(u, ports, par, ctx) {
    // No-op during solve.  Controller evaluates between timesteps.
    // Tick only records rule status for inspector display.
    u.last = { rules: u._ruleStatus || [] };
  }
});
```

The controller is a physical unit on the flowsheet with no ports.
It is visible, selectable, moveable, deletable.  It participates
in export/import and checkpoints like any unit.

### NNG-3 Compliance

A PLC is a real, purchasable piece of equipment you could point at
in a pilot plant.  It has no fluid connections (no ports).  It
draws negligible power (no elec_in in v1 — could add later for
realism under mission power budgets).

### NNG-9 Compliance

The controller does NOT evaluate during `solveScene`.  Its tick is
a no-op that records status for the inspector.  All rule evaluation
happens in `TimeClock.step()`, between timesteps, outside the
solver.  The controller reads converged state from the previous
solve and writes mode changes for the next solve.

---

## Rule Data Model

Rules live on `u.params.rules` (array of rule objects):

```javascript
Rule = {
  id:          String,    // unique within controller: 'r1', 'r2', ...
  enabled:     Boolean,   // player can disable without deleting

  // Sensor (what to read)
  sensorId:    String,    // unit ID or connection ID
  sensorType:  'unit' | 'stream',
  param:       String,    // readable value key (see Readable Values)

  // Condition
  op:          '>' | '<' | '>=' | '<=',
  threshold:   Number,    // trigger value (SI units)
  band:        Number,    // deadband (positive, SI units)

  // Action (what to do when triggered)
  targetId:    String,    // unit ID
  actionFired: 'off' | 'bypass' | 'on',  // mode when condition fires
  actionReset: 'on' | 'off' | 'bypass',  // mode when condition resets
}
```

### Deadband Semantics

For `op: '>'`:
- **Fires** when value crosses above `threshold`
- **Resets** when value drops below `threshold - band`

For `op: '<'`:
- **Fires** when value crosses below `threshold`
- **Resets** when value rises above `threshold + band`

`>=` and `<=` follow the same pattern with inclusive comparison on
the trigger side.

The deadband is mandatory.  Minimum enforced: `Math.max(1, threshold * 0.01)`
for relative parameters (T, P, flow), fixed minimum for percentage
parameters (1% for level_pct).  If the player enters 0 or leaves it
blank, the minimum is auto-applied.

### Latch State

Each rule has runtime latch state (not serialized — reconstructed
from current process state on load):

```javascript
RuleState = {
  fired: Boolean,     // true if condition is active
  lastValue: Number,  // last sensor reading (for display)
  stale: Boolean,     // true if sensor or target unit deleted
  error: String|null, // error message if evaluation failed
}
```

Latch state stored on `u._ruleStatus` (array parallel to
`u.params.rules`).  Prefixed with `_` because it's transient
runtime state, not serialized.

---

## Evaluation Cycle

### Execution Point

In `TimeClock.step()`, immediately before `solveScene()`:

```javascript
step(scene) {
  // 1. Update inventories (existing)
  ...

  // 2. Advance time (existing)
  TimeClock.t += dt;
  TimeClock.frame += 1;

  // 3. Controller evaluation (NEW)
  _evaluateControllers(scene);

  // 4. Solve (existing)
  const solveResult = solveScene(scene);
  ...
}
```

### Evaluation Function

```javascript
function _evaluateControllers(scene) {
  for (const [id, u] of scene.units) {
    if (u.defId !== 'controller') continue;
    const rules = u.params.rules;
    if (!rules || rules.length === 0) continue;

    if (!u._ruleStatus) u._ruleStatus = rules.map(() => ({
      fired: false, lastValue: null, stale: false, error: null
    }));

    for (let i = 0; i < rules.length; i++) {
      const rule = rules[i];
      const state = u._ruleStatus[i];

      if (!rule.enabled) { state.error = 'disabled'; continue; }

      // Read sensor value
      const reading = _readSensor(scene, rule);
      if (reading.error) {
        state.stale = true;
        state.error = reading.error;
        continue;
      }
      state.stale = false;
      state.lastValue = reading.value;

      // Evaluate with deadband
      const target = scene.units.get(rule.targetId);
      if (!target) {
        state.stale = true;
        state.error = 'Target unit deleted';
        continue;
      }

      const shouldFire = _evalCondition(
        reading.value, rule.op, rule.threshold);
      const shouldReset = _evalReset(
        reading.value, rule.op, rule.threshold, rule.band);

      if (!state.fired && shouldFire) {
        state.fired = true;
        target.mode = rule.actionFired;
      } else if (state.fired && shouldReset) {
        state.fired = false;
        target.mode = rule.actionReset;
      }
      // else: in deadband zone, no action (hysteresis)
    }
  }
}
```

### Sensor Reading

```javascript
function _readSensor(scene, rule) {
  if (rule.sensorType === 'unit') {
    const u = scene.units.get(rule.sensorId);
    if (!u) return { error: 'Sensor unit deleted' };
    // Read from u.last (converged results from previous solve)
    const val = _resolveDotPath(u.last, rule.param)
             ?? _resolveDotPath(u.inventory, rule.param)
             ?? _resolveDotPath(u.params, rule.param);
    if (val == null || !isFinite(val))
      return { error: `Param "${rule.param}" not available` };
    return { value: val };
  }

  if (rule.sensorType === 'stream') {
    // sensorId is a connection ID (from→to encoded)
    const conn = scene.connections.find(c => _connId(c) === rule.sensorId);
    if (!conn) return { error: 'Stream connection deleted' };
    const ud = scene.runtime?.unitData?.get(conn.from.unitId);
    const stream = ud?.ports?.[conn.from.portId];
    if (!stream) return { error: 'Stream data unavailable' };
    const val = _resolveStreamParam(stream, rule.param);
    if (val == null || !isFinite(val))
      return { error: `Stream param "${rule.param}" not available` };
    return { value: val };
  }

  return { error: 'Unknown sensor type' };
}
```

### Connection ID Stability

Connections don't have persistent IDs in the current data model
(they're stored as `{ from: {unitId, portId}, to: {unitId, portId} }`).
For stream sensor references, use a deterministic ID derived from
the connection endpoints:

```javascript
function _connId(conn) {
  return `${conn.from.unitId}:${conn.from.portId}->${conn.to.unitId}:${conn.to.portId}`;
}
```

This is stable as long as the connection exists.  If the player
deletes and re-creates the same connection, the ID is identical.
If the player rewires, the old ID breaks (stale reference detected).

---

## Readable Values

### Unit Parameters (sensorType: 'unit')

The param dropdown is populated dynamically from the selected unit.
Available keys depend on the unit type:

**All units:** Keys from `u.last` that are finite numbers.
Common examples:

| Unit type | Available params |
|---|---|
| tank | `fillPct`, `P_Pa`, `T_K`, `mass_kg`, `n_total` |
| pump | `Pin`, `Pout_actual`, `absorbed_W`, `rated_W` |
| reactor | `T_out`, `conversion`, `Q_reaction_W` |
| gas_turbine | `W_shaft_kW`, `Pout_actual` |
| power_hub | `surplus_W`, `curtailmentFactor` |
| battery | `soc_pct` (from inventory) |

**Atmosphere:** If sensorId points to a special `'__atmosphere__'`
token, read from `SimSettings.atmosphere`:
`T_K`, `P_Pa`, `air.CO2`, `air.H2O`, etc.

### Stream Parameters (sensorType: 'stream')

| Param key | Description | Unit |
|---|---|---|
| `T` | Temperature | K |
| `P` | Pressure | Pa |
| `totalFlow` | Total molar flow | mol/s |
| `massFlow` | Total mass flow | kg/s |
| `species.CO2` | Molar flow of CO₂ | mol/s |
| `species.H2O` | Molar flow of H₂O | mol/s |
| `Hdot_J_s` | Enthalpy flow | W |

The `species.*` keys are generated from the stream's `n` object.

---

## Properties Panel UI

When the controller unit is selected, the properties panel shows:

```
Process Controller
──────────────────

Rules:
┌─────────────────────────────────────────────────────┐
│ Rule 1                                    [✓] [🗑]  │
│ IF [Tank 'Buffer' ▼].[fillPct ▼] [> ▼] [90  ]     │
│ band [10  ]                                         │
│ → [Source 'Feed' ▼] [off ▼]                         │
│ Status: ● fired (value: 94.2%)                      │
└─────────────────────────────────────────────────────┘
┌─────────────────────────────────────────────────────┐
│ Rule 2                                    [✓] [🗑]  │
│ IF [Tank 'Buffer' ▼].[fillPct ▼] [< ▼] [20  ]     │
│ band [10  ]                                         │
│ → [Compressor ▼] [off ▼]                            │
│ Status: ○ idle (value: 94.2%)                       │
└─────────────────────────────────────────────────────┘

[+ Add Rule]
```

### Dropdown Contents

**Sensor unit dropdown:** All placed units grouped by category.
Format: `"Unit Name (Type)"` or just `"Type"` if unnamed.
Special entry: `"Atmosphere"` at the top.

```
── Sources ──
  Source 'Feed'
  Source 'Air Intake'
── Reactors ──
  Reactor 'Sabatier'
── Storage ──
  Tank 'Buffer'
  Battery
── Topology ──
  Splitter
  Mixer
── Atmosphere ──
  Planet Atmosphere
── Streams ──
  Source 'Feed' → Mixer
  Mixer → Reactor 'Sabatier'
  ...
```

**Param dropdown:** Populated dynamically after sensor selection.
Shows only keys that are currently finite numbers (from last solve).
Display label includes engineering unit: `"fillPct (%)"`,
`"T_K (K)"`, `"P_Pa (Pa)"`.

**Operator dropdown:** `>`, `<`, `>=`, `<=`.

**Target unit dropdown:** All placed units (same grouping as sensor).
Controllers are excluded (no controller controlling another
controller in v1).

**Action dropdown:** `On`, `Off`, `Bypass`.

### Status Display

Each rule row shows live status after last evaluation:

| Symbol | Meaning |
|---|---|
| ● fired | Condition active, action applied |
| ○ idle | Condition not active |
| ⚠ stale | Sensor or target unit deleted — rule skipped |
| — disabled | Rule disabled by player |

Value display: `"(value: 94.2%)"` — last sensor reading, formatted
with engineering unit.

### Stale Reference Handling

When a sensor or target unit is deleted:
- Rule status → `⚠ stale`
- Rule row highlighted amber
- Rule skipped during evaluation
- WARNING alarm on controller: `"Rule N: sensor/target unit deleted"`
- Dropdown for the stale field shows `"⚠ [deleted unit]"` in red

The player can fix by selecting a new unit in the dropdown, or
delete the broken rule.

---

## Alarms

The controller emits alarms through the standard AlarmSystem:

| Condition | Severity | Message |
|---|---|---|
| Stale sensor reference | WARNING | `Rule N sensor missing — unit deleted` |
| Stale target reference | WARNING | `Rule N target missing — unit deleted` |
| Sensor param unavailable | INFO | `Rule N: param "X" not available on unit` |

Alarm IDs: `ctrl_{controllerId}_rule_{ruleIndex}_{type}`.

AlarmSystem source: registered like any other source.  Reads
`u._ruleStatus` for all controller units, emits alarms for
stale/error states.

---

## Timing Considerations

The controller sees state that is one full `dt` behind.  For
`dt = 3600s` (1 hour), a tank filling at 5%/hour crosses 90%
mid-hour but the controller only fires at the hour boundary.
Worst-case overshoot: `rate × dt` beyond threshold.

This is physically accurate — a real PLC with a 1-hour scan cycle
behaves identically.  But players may find it confusing.

Mitigation: inspector tooltip on controller unit:
`"Evaluates once per timestep (currently every {dt}s).
  Reduce dt for tighter control."`

---

## Serialization

### Export

Rules are on `u.params.rules` — serialized automatically by the
existing unit params export path.  No special handling.

Latch state (`u._ruleStatus`) is NOT serialized — it's transient.
On import/load, latch state is reconstructed: each rule evaluates
its current condition and sets `fired` accordingly (without
triggering actions, since we're just syncing state).

### Checkpoints

Checkpoints capture `u.params` (including rules).  They also
capture `u.mode` on all target units.  On revert, modes are
restored and controller latch state is reconstructed.

---

## NNG Impact

| NNG | Impact |
|---|---|
| NNG-1 | Controller doesn't touch mass/energy. Mode changes are mass-conserving (handled by S-STATUS). |
| NNG-2 | No heat/work implications — controller writes modes, not temperatures. |
| NNG-3 | PLC is real equipment on flowsheet. No ports (correct). Visible, selectable. |
| NNG-4 | No pressure-flow coupling. Controller is outside solver. |
| NNG-5 | Controller may switch power units off/on — power lifecycle handles mode changes naturally. |
| NNG-6 | Controller evaluates between timesteps, not during solve. No protocol impact. |
| NNG-7 | Stale reference alarms follow frozen schema. New AlarmSystem source. |
| NNG-8 | All thresholds in SI. Display converts at UI boundary. |
| NNG-9 | Controller tick is a no-op. Evaluation is outside solver. Tick isolation preserved. |
| NNG-10 | New UnitCategories.CONTROL. Controller registered via UnitRegistry. |
| NNG-11 | Evaluation logic is DOM-free. UI is properties panel only. |
| NNG-14 | Version bump, changelog, tests. |
| NNG-15 | Unit names in rule display pass through esc(). |

---

## Tests

| ID | Description |
|---|---|
| T-CT01 | Rule fires when value crosses threshold. Target mode changed. |
| T-CT02 | Rule resets when value crosses threshold - band. Target mode restored. |
| T-CT03 | Deadband hysteresis: value between threshold and threshold-band → no change. |
| T-CT04 | Stale sensor: deleted unit → rule skipped, WARNING alarm. |
| T-CT05 | Stale target: deleted unit → rule skipped, WARNING alarm. |
| T-CT06 | Disabled rule: enabled=false → skipped, no alarm. |
| T-CT07 | Multiple rules on same controller, independent evaluation. |
| T-CT08 | Multiple controllers, independent evaluation. |
| T-CT09 | Controller evaluation order: runs before solveScene in step(). |
| T-CT10 | Export/import: rules serialized, latch state reconstructed. |
| T-CT11 | Checkpoint revert: target modes restored, latch state reconstructed. |
| T-CT12 | Minimum deadband enforced (player enters 0 → auto-applied). |
| T-CT13 | Stream sensor: reads T/P/flow from connection. |
| T-CT14 | Atmosphere sensor: reads T_K, P_Pa from SimSettings. |

---

## Future Extensions (Not in v1)

**Continuous setpoint actions:** Rule writes `u.params.X = value`
instead of `u.mode`.  Requires: rate limiting (prevent oscillation),
output clamping, parameter validation.

**PID loops:** Separate rule type with Kp/Ki/Kd, output range,
anti-windup.  Still evaluates between timesteps (sampled PID).

**Cascade control:** One controller's output feeds another's sensor.
Requires: evaluation ordering (upstream controller first).

**Pick-on-canvas selection:** Click crosshair → click unit/stream
on canvas → auto-fills dropdown.  Pure UI enhancement, no data
model change.

**Controller power draw:** Add `elec_in` port, small rated demand.
Controller goes dark (all rules paused) when unpowered — adds
gameplay consequence to power management.

---

## Scope

- `controller` UnitRegistry entry: ~15 lines.
- `UnitCategories.CONTROL`: ~3 lines.
- `_evaluateControllers`: ~80 lines.
- `_readSensor` + `_resolveStreamParam`: ~40 lines.
- AlarmSystem source for stale rules: ~20 lines.
- Properties panel: ~120 lines (rule editor, dropdowns, status).
- CSS for rule rows: ~20 lines.
- Palette entry + icon: ~10 lines.
- Tests: 14 new.
