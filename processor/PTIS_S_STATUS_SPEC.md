# S-STATUS: Unit Operating Modes

### processThis v14.9.0

**Status:** DESIGN — not yet implemented.
**Depends on:** S-SPLIT (splitter branch deactivation should land first
so the off-mode source-killing post-pass doesn't reintroduce the
splitter mass gap).
**Priority:** MEDIUM — prerequisite for S-CONTROLLER; standalone value
for manual testing and fried replacement.
**Estimated scope:** 1 session.

---

## Philosophy

Every unit has an operating mode that determines how the solver
handles it.  The mode is a first-class property on the unit object,
evaluated by the solver before tick dispatch.  Individual tick
functions never check mode — the solver handles it uniformly.

This replaces the 6 existing bespoke fried guards and covers the
11 units that currently lack them.

---

## Three Modes

| Mode | Physical meaning | Solver behavior |
|---|---|---|
| **on** | Normal operation | Tick runs as usual. Default for all units. |
| **bypass** | Fluid passes through, no work done | Passthrough: primary mat_in → primary mat_out, preserving T/P/n/H. Zero power demand. Tick skipped entirely. |
| **off** | Shut down, no flow | All output ports zeroed. Zero power demand. Tick skipped. Unit marked for post-pass source-killing (same mechanism as check-valve blocking). |

### Data Model

```javascript
// On unit object:
u.mode = 'on' | 'bypass' | 'off'   // default: 'on'
u.fried = true | undefined          // hardware destruction flag
```

### Fried Override

`u.fried` is a separate boolean, not a mode value.  When
`u.fried === true`, the solver forces bypass regardless of `u.mode`.
The player cannot change mode while fried — the dropdown is locked.
Only the "⚡ Reset Equipment" button clears `u.fried`, after which
`u.mode` takes effect again.

Fried is a hardware state (irreversible without reset).  Mode is an
operational state (freely changeable by player or controller).  Two
layers, clearly separated.

---

## Solver Integration

### Evaluation Point

Mode evaluation happens at the top of the unit-processing loop in
`solveScene`, before the tick call.  This is a guard clause, not a
protocol change.

```javascript
// Inside solveScene unit iteration, before try { def.tick(...) }:
const effectiveMode = u.fried ? 'bypass' : (u.mode || 'on');

if (effectiveMode === 'bypass') {
  _applyBypass(u, def, ud);
  continue;  // skip tick, validate, flash
}
if (effectiveMode === 'off') {
  _applyOff(u, def, ud);
  continue;  // skip tick; post-pass handles upstream
}
// else: effectiveMode === 'on' → normal tick
```

### Bypass Implementation

```javascript
function _applyBypass(u, def, ud) {
  u.powerDemand = 0;

  // Find primary material passthrough: first mat_in → first mat_out
  const matIn = def.ports.find(
    p => p.dir === PortDir.IN && p.type === StreamType.MATERIAL);
  const matOut = def.ports.find(
    p => p.dir === PortDir.OUT && p.type === StreamType.MATERIAL);

  if (matIn && matOut) {
    const sIn = ud.ports[matIn.portId];
    if (sIn && sIn.n) {
      ud.ports[matOut.portId] = {
        type: StreamType.MATERIAL,
        T: sIn.T, P: sIn.P,
        n: { ...sIn.n },
        phaseConstraint: sIn.phaseConstraint || 'VL',
        H_target_Jps: thermo.getHdot_Jps(sIn)
      };
    }
  }

  // Multi-output units: secondary outputs get zero flow
  // (bypass routes everything through primary path)
  for (const p of def.ports) {
    if (p.dir !== PortDir.OUT || p.type !== StreamType.MATERIAL) continue;
    if (matOut && p.portId === matOut.portId) continue;  // primary already set
    const refIn = ud.ports[matIn?.portId];
    ud.ports[p.portId] = {
      type: StreamType.MATERIAL,
      T: refIn?.T || 298.15, P: refIn?.P || 101325,
      n: {}, phaseConstraint: 'VL'
    };
  }

  // Electrical outputs: zero
  for (const p of def.ports) {
    if (p.dir !== PortDir.OUT || p.type !== StreamType.ELECTRICAL) continue;
    ud.ports[p.portId] = {
      type: StreamType.ELECTRICAL, capacity: 0, available: 0, actual: 0
    };
  }

  // Status
  ud.last = u.last || {};
  ud.last.mode = 'bypass';
  if (u.fried) {
    ud.last.fried = true;
    ud.last.error = {
      severity: ErrorSeverity.CATASTROPHIC,
      message: 'Equipment destroyed — bypassed'
    };
  }
}
```

Mass conservation: every mole entering mat_in exits mat_out.  No
moles created or destroyed.  For multi-output units (splitter,
flash, distillation), the primary output gets everything and
secondary outputs get zero — this is the physical "fluid flows
straight through" interpretation.

### Off Implementation

```javascript
function _applyOff(u, def, ud) {
  u.powerDemand = 0;

  // All material outputs: zero flow
  for (const p of def.ports) {
    if (p.dir !== PortDir.OUT) continue;
    if (p.type === StreamType.MATERIAL) {
      const refIn = ud.ports[def.ports.find(
        q => q.dir === PortDir.IN && q.type === StreamType.MATERIAL
      )?.portId];
      ud.ports[p.portId] = {
        type: StreamType.MATERIAL,
        T: refIn?.T || 298.15, P: refIn?.P || 101325,
        n: {}, phaseConstraint: 'VL'
      };
    }
    if (p.type === StreamType.ELECTRICAL) {
      ud.ports[p.portId] = {
        type: StreamType.ELECTRICAL, capacity: 0, available: 0, actual: 0
      };
    }
  }

  // Mark for source-killing post-pass
  // Uses same _blockedInlet mechanism as check-valve system
  const matIn = def.ports.find(
    p => p.dir === PortDir.IN && p.type === StreamType.MATERIAL);
  if (matIn) {
    ud.last = u.last || {};
    ud.last._blockedInlet = matIn.portId;
    ud.last.mode = 'off';
  }
}
```

The `_blockedInlet` flag feeds into the existing backward-trace
post-pass.  The post-pass traces upstream from the off unit's inlet
to find and zero boundary sources.  This shares infrastructure with
check-valve blocking — no new mechanism.

### Interaction with S-SPLIT

An off splitter blocks all branches.  This is equivalent to the
"all branches blocked" case in S-SPLIT: the splitter sets
`_blockedInlet = 'mat_in'` and the existing post-pass traces
upstream.  No special handling needed — S-SPLIT's all-blocked
case already covers this.

---

## Bypass Port Mapping

Most units have one mat_in and one mat_out — trivial passthrough.
Multi-port units need explicit primary port definitions:

| Unit | Primary in | Primary out | Notes |
|---|---|---|---|
| pump | mat_in | mat_out | Standard |
| compressor | mat_in | mat_out | Standard |
| electric_heater | mat_in | mat_out | Standard |
| air_cooler | mat_in | mat_out | Standard |
| valve | mat_in | mat_out | Standard |
| gas_turbine | mat_in | mat_out | elec_out → zero |
| reactor_equilibrium | mat_in | mat_out | elec_in ignored |
| hex | mat_in_hot | mat_out_hot | Cold side: mat_in_cold → mat_out_cold (separate passthrough) |
| mixer | mat_in_1 | mat_out | mat_in_2 discarded — problematic, see below |
| splitter | mat_in | mat_out_1 | mat_out_2 → zero |
| flash_drum | mat_in | vap_out | bot_out → zero (all flow to primary) |
| distillation_column | mat_in | dist_out | bot_out → zero |
| tank | mat_in | gas_out | Inventory bypass — special case |
| battery | (electrical) | (electrical) | No material passthrough |
| power_hub | (electrical) | (electrical) | No material passthrough |
| sink_electrical | (electrical) | — | No output ports |

### HEX Special Case

The heat exchanger has two independent flow paths (hot and cold).
Bypass means both paths are straight passthrough, independently.
Neither side transfers heat to the other.

### Mixer Bypass Concern

A bypassed mixer with two inlets has a semantic problem: which
inlet passes through?  For bypass, the answer is: the first
connected inlet.  The other inlet's flow is discarded — this is
a mass conservation issue identical to the check-valve problem.

Resolution: a bypassed mixer should set `_blockedInlet` on the
secondary inlet, triggering the post-pass to handle the discarded
flow upstream.  This is exactly the same mechanism as a mixer
check-valve block — no new code needed.

### Electrical-Only Units

Battery, power_hub, sink_electrical: no material flow to pass
through.  Bypass and off both zero power demand and outputs.
The distinction is cosmetic — both mean "not participating."

### Inventory Units

Tank and reservoir are special.  Bypass means fluid flows through
without entering inventory (no accumulation).  Off means no flow
in or out (tank isolated).  Inventory is not modified in either
mode — only the `on` mode's normal tick + `updateInventory` cycle
changes inventory.

---

## Fried Guard Replacement

The 6 existing bespoke fried guards (pump, compressor,
electric_heater, air_cooler, distillation_column,
reactor_equilibrium) are deleted.  The solver-level bypass handler
replaces all of them uniformly.

The `u.fried` flag remains for:
- Visual rendering (red X, desaturated, dashed border)
- Save/load serialization
- Properties panel "Reset Equipment" button
- Inspector display ("Equipment destroyed")

The behavioral consequence is now: fried → solver forces bypass.
One mechanism, all units.

---

## Properties Panel UI

When a unit is selected, the properties panel shows a mode control
below the unit name/type:

```
[Mode: On ▼]       ← dropdown: On / Bypass / Off
```

When fried:
```
[Mode: Bypass 🔒]   ← greyed out, locked, tooltip: "Equipment
                      destroyed — reset to change mode"
[⚡ Reset Equipment]
```

The dropdown is a standard HTML `<select>` in the properties panel
builder.  On change, it sets `u.mode`, pushes undo, and triggers
auto-solve (paused mode) or takes effect next tick (playing mode).

---

## Canvas Visual

| Mode | Visual indicator |
|---|---|
| on | Normal rendering (no change) |
| bypass | Dashed border (stroke-dasharray: 10 5), dimmed fill (opacity 0.5), "⤳" bypass icon |
| off | Solid dark border, very dimmed fill (opacity 0.25), "⏻" power icon |
| fried+bypass | Existing fried overlay (red X, desaturated) — takes precedence over bypass visual |

The mode visual is applied in the render function alongside the
existing alarm glow and fried overlay logic.

---

## Serialization

### Export (v19)

```javascript
// In exportJSON, per unit:
if (u.mode && u.mode !== 'on') unitData.mode = u.mode;
// u.fried already serialized
```

### Import

```javascript
// In importJSON, per unit:
if (unitData.mode) unit.mode = unitData.mode;
// else defaults to 'on' (undefined → 'on' in solver check)
```

### Checkpoints

`_createCheckpointData` already captures the full unit object.
Mode is included automatically.

---

## NNG Impact

| NNG | Impact |
|---|---|
| NNG-1 | Bypass: mass conserved (passthrough). Off: mass conserved (zero output + source-killing post-pass). |
| NNG-2 | Bypass: no work done (T/P/H unchanged). Off: no work done. Neither violates second law. |
| NNG-3 | Mode visible on canvas (visual indicators). Dropdown in properties. Fried lock visible. |
| NNG-4 | Off mode integrates with existing post-pass. No new pressure-flow coupling. |
| NNG-5 | Both modes: powerDemand = 0. Hub skips naturally. Gas turbine bypass: elec_out = 0, alarm. |
| NNG-6 | Guard clause before tick. No protocol change. Bypass/off skip tick → validate → flash entirely. |
| NNG-9 | Mode check is solver-level, not inside tick. Tick never runs for bypass/off. Isolation preserved. |
| NNG-14 | Version bump, changelog, tests. |

---

## Tests

| ID | Description |
|---|---|
| T-ST01 | Bypass mode: mat_in passthrough to mat_out (pump). T/P/n/H preserved. |
| T-ST02 | Bypass mode: powerDemand = 0 (pump, compressor). |
| T-ST03 | Off mode: all outputs zero (pump). |
| T-ST04 | Off mode: _blockedInlet set, post-pass zeros upstream source. |
| T-ST05 | Fried override: u.fried=true + u.mode='on' → bypass forced. |
| T-ST06 | Fried reset: clear fried → mode takes effect. |
| T-ST07 | HEX bypass: both paths independent passthrough. |
| T-ST08 | Mixer bypass: primary inlet passes, secondary triggers _blockedInlet. |
| T-ST09 | Splitter bypass: all flow to mat_out_1, mat_out_2 = zero. |
| T-ST10 | Off tank: no flow, inventory unchanged. |
| T-ST11 | Export/import: mode serialized, fried serialized. |
| T-ST12 | Checkpoint captures and restores mode. |
| T-ST13 | Gas turbine bypass: mat passthrough, elec_out = 0. |

Existing fried tests (T407, T408): updated to verify bypass behavior
instead of bespoke guard behavior.  All 6 bespoke guards removed.

---

## Scope

- `solveScene`: ~60 lines — mode guard clause, `_applyBypass`,
  `_applyOff`.
- Splitter/mixer/hex/flash/distillation: primary port definitions
  (data, not logic — the solver reads them).
- Properties panel: ~20 lines — mode dropdown, fried lock.
- Render: ~15 lines — bypass/off visual classes.
- CSS: ~10 lines — bypass and off visual styles.
- Delete: 6 bespoke fried guards (~80 lines removed).
- Tests: 13 new, ~6 updated.
- Export/import: ~5 lines.
