# S-SIM: Simulation Loop Redesign

### processThis v14.0.0 → v14.1.0

**Status:** DESIGN — not yet implemented.
**Depends on:** S5-lite (tank/reservoir need inventory physics to test against).
**Replaces:** F-012 TimeClock fixes (S5a-0 provides interim bridge).

---

## Philosophy

Kerbal-inspired: you build, you run, you watch it work (or explode).
There is no "safe preview" — the simulation IS the game. Pause mode
IS the editor. Time moves forward; you can only go back to a
checkpoint.

**Old model (test-centric):**
```
Design (test) → Preview (solve, no time) → Commit (step) → Reset
```

**New model (Kerbal-style):**
```
Pause (edit) → Play/Step (commit) → Pause (edit more) → Catastrophe? → Restore
```

---

## Two Modes Only

| Mode | Player action | Engine behavior |
|---|---|---|
| **Paused** | Place/delete/reroute, change params, adjust setpoints | Auto-solve-on-edit (flow preview). No inventory update. No time advance. |
| **Playing** | Watch, adjust sliders (opening_pct, setpoints) | Tick loop: updateInventory → advance t → solveScene → render |

Step = Play one tick, then auto-pause.

**Removed concepts:**

| Concept | Why it existed | Why it's gone |
|---|---|---|
| mode='test' | Pre-inventory single-solve | Every solve is stateful now |
| Test button (⟳) | "Preview without committing" | Preview IS the paused auto-solve |
| _captureInitial | Snapshot "clean" state | Replaced by checkpoint |
| test→paused transition | Gate between design and sim | No gate — always in the sim |
| initInventory in step() | Lazy init | placeUnit already handles this |

---

## Auto-Solve-on-Edit (Paused Mode)

While paused, the solver runs after every topology or parameter
change — same as the old "test" behavior but without a dedicated
mode. This gives immediate visual feedback: flow arrows, port
values, alarm indicators.

**Rule: solve, never updateInventory.**

Flows shown while paused are "what would happen right now if you
unpaused." Inventory only changes during Step/Play.

Triggers (already exist in codebase, just remove test-mode guards):
- Connection added/removed
- Unit placed/deleted
- Parameter changed in inspector
- Profile changed

```javascript
// After any topology/param change while paused:
if (TimeClock.mode === 'paused') {
  const solveResult = solveScene(scene);
  afterSolve(solveResult);
}
```

---

## Checkpoint System

Replaces _captureInitial / _restoreInitial with a proper save/restore
mechanism.

### Checkpoint Structure

```javascript
Checkpoint = {
  t:           Number,    // TimeClock.t at capture
  frame:       Number,    // TimeClock.frame at capture
  units:       Map<unitId, {
    defId, profileId, name, params, inventory, x, y, w, h, fried
  }>,
  connections: Array<{ from: {unitId, portId}, to: {unitId, portId} }>,
  settings:    { dt, atmosphere, ... }
}
```

### Auto-Checkpoint Triggers

| Trigger | When | Rationale |
|---|---|---|
| First play | Just before first-ever tick | Captures "Day 1 noon" baseline |
| Manual save | Player clicks 💾 checkpoint button | Explicit safe point |
| Periodic | Every game-hour (configurable) with no MAJOR+ alarms | Rolling safe point |
| Before catastrophe | Immediately on CATASTROPHIC detection | Last good state before disaster |

### Restore

The Restore button (↺, replaces Reset) loads the most recent
checkpoint. Everything reverts: inventories, time, connections,
params.

```javascript
TimeClock = {
  t: T0_SECONDS,
  frame: 0,
  mode: 'paused',          // only 'paused' | 'playing'
  _checkpoint: null,

  step(scene) {
    // Auto-checkpoint on first-ever step
    if (!TimeClock._checkpoint) {
      TimeClock._saveCheckpoint(scene);
    }

    // Update inventories from last solve
    const dt = TimeClock.dt;
    for (const [uid, u] of scene.units) {
      const def = UnitRegistry.get(u.defId);
      if (!def?.inventory || !def.updateInventory || !u.inventory) continue;
      const ud = scene.runtime.unitData.get(uid);
      const resolvedPorts = ud ? ud.ports : {};
      u.inventory = def.updateInventory(u.inventory, resolvedPorts, dt);
    }

    TimeClock.t += dt;
    TimeClock.frame += 1;

    const solveResult = solveScene(scene);

    // Auto-checkpoint: every game-hour with no CATASTROPHIC
    if (TimeClock.frame % Math.round(3600 / dt) === 0) {
      const hasCatastrophic = solveResult?.diagnostics?.some(
        d => d.severity.level >= ErrorSeverity.CATASTROPHIC.level
      );
      if (!hasCatastrophic) {
        TimeClock._saveCheckpoint(scene);
      }
    }

    return { t: TimeClock.t, frame: TimeClock.frame, solveResult };
  },

  restore(scene) {
    if (!TimeClock._checkpoint) return { solveResult: null };
    TimeClock._loadCheckpoint(scene);
    const solveResult = solveScene(scene);
    syncPlanetBgTime('snap');
    return { solveResult };
  },

  _saveCheckpoint(scene) {
    TimeClock._checkpoint = {
      t: TimeClock.t,
      frame: TimeClock.frame,
      units: new Map(),
      connections: JSON.parse(JSON.stringify(scene.connections)),
      settings: {
        dt: SimSettings.dt,
        atmospherePreset: SimSettings.getPresetKey()
      }
    };
    for (const [uid, u] of scene.units) {
      TimeClock._checkpoint.units.set(uid,
        JSON.parse(JSON.stringify(u)));
    }
  },

  _loadCheckpoint(scene) {
    const cp = TimeClock._checkpoint;
    TimeClock.t = cp.t;
    TimeClock.frame = cp.frame;
    TimeClock.mode = 'paused';
    scene.connections = JSON.parse(JSON.stringify(cp.connections));
    scene.units.clear();
    for (const [uid, data] of cp.units) {
      scene.units.set(uid, JSON.parse(JSON.stringify(data)));
    }
  }
};
```

### Checkpoint Stack (Future Enhancement)

Single checkpoint for S-SIM. Future: stack of N checkpoints with
scrubber UI ("rewind 3 hours"). Not in scope here.

---

## Catastrophic Event Handling

### Auto-Pause on CATASTROPHIC

When any unit reaches CATASTROPHIC severity, the engine auto-pauses
and presents a modal:

```
╔═══════════════════════════════════════╗
║  ⚠ CATASTROPHIC FAILURE              ║
║                                       ║
║  Tank T-01: Overpressure rupture!     ║
║  No overflow path connected.          ║
║                                       ║
║  [↺ Restore Checkpoint]  [Continue]   ║
╚═══════════════════════════════════════╝
```

### Restore Checkpoint

Reverts to last auto-checkpoint (captured just before the
CATASTROPHIC tick). Player is back in paused mode at the last
known good state. Can fix the problem, then resume.

### Continue with Damage

The failed unit(s) are marked `u.fried = true`. Fried equipment:
- Produces zero output on all ports (tick returns empty streams)
- Visual: damage overlay (cracks, smoke, red tint)
- Inspector shows "DESTROYED — must replace"
- Cannot be repaired — must delete and place a new one
- Connections remain (downstream units see zero flow)

This is the game penalty: you lose the equipment and whatever
was in its inventory. Downstream processes starve. You scramble
to re-route or rebuild.

```javascript
// In tick dispatch (solveScene loop):
if (u.fried) {
  // Emit zero on all output ports
  for (const [portId, portDef] of Object.entries(pres.ports)) {
    if (portDef.dir === PortDir.OUT) {
      ud.ports[portId] = { type: portDef.type, n: {}, T: 0, P: 0 };
    }
  }
  continue;  // skip tick function entirely
}
```

### Which Events Trigger Catastrophic?

| Event | Unit | Condition |
|---|---|---|
| Overpressure rupture | Tank | P > P_HH (200 bar sentinel), no vent connected |
| Overflow rupture | Tank | level = 100%, no overflow connected |
| Thermal failure | Any | T > T_HH or T < T_LL |
| Power cycle | Hub | Circular power dependency |
| Compressor surge | Compressor | Outlet P < inlet P (future) |

---

## Transport UI Changes

### Buttons

```
Before: [⟳ Test] [▶| Step] [▶ Play] [⏸ Pause] [↺ Reset] [speed]
After:  [▶| Step] [▶ Play] [⏸ Pause] [↺ Restore] [💾 Save] [speed]
```

| Button | Available | Action |
|---|---|---|
| ▶\| Step | Paused | One tick + auto-pause |
| ▶ Play | Paused | Continuous ticking |
| ⏸ Pause | Playing | Stop ticking |
| ↺ Restore | Paused (checkpoint exists) | Load last checkpoint |
| 💾 Save | Paused | Manual checkpoint |
| Speed | Playing | Cycle play speed |

### Enable/Disable Logic

```javascript
function updateTransportUI() {
  const mode = TimeClock.mode;
  const hasCheckpoint = TimeClock._checkpoint != null;

  btnStep.disabled    = mode === 'playing';
  btnPlay.disabled    = mode === 'playing';
  btnPause.disabled   = mode !== 'playing';
  btnRestore.disabled = mode === 'playing' || !hasCheckpoint;
  btnSave.disabled    = mode === 'playing';

  // ...time display, speed indicator unchanged
}
```

---

## Paused Mode Editing Behavior

### Place Unit While Paused

initInventory runs with **current** atmosphere at **current game
time**. If future T_atm(t) is implemented, a tank placed at midnight
fills with colder gas than one placed at noon. Physically correct.

Auto-solve fires. Player sees immediate flow preview.

### Delete Unit While Paused

Unit removed, connections severed. Downstream units lose feed.
Auto-solve fires. If Restore is used, deleted unit comes back
(from checkpoint).

### Change Params While Paused

Live edit. Inventory stays. Auto-solve fires with new params.
May cause instant alarm (e.g., shrink tank volume → instant
overpressure). That's realistic — you modified the equipment.

No `_reinitInventoryIfTest` equivalent. Inventory is sacred once
simulation has started. The only way to "reset" a unit's inventory
is to delete it and place a new one, or Restore a checkpoint.

---

## Day/Night Temperature Variation (Preparation)

Not implemented in S-SIM, but the architecture supports it.

```javascript
// Future: SimSettings.atmosphere becomes time-dependent
get T_K() {
  if (!this._T_amplitude) return this._T_mean;
  const hour = (TimeClock.t % 86400) / 3600;
  // Peak at 14:00, trough at 02:00
  return this._T_mean - this._T_amplitude *
    Math.cos(2 * Math.PI * (hour - 14) / 24);
}
```

Requirements for compatibility:
- Solver reads T_atm once per tick (already true)
- Tank computeTankState gets T from inventory (already true)
- Source uses T from params or atmosphere (already true)
- CSS background phase tracks TimeClock.t (already true, v13.7.0)

Only new work: per-planet T_amplitude and optional humidity curve.
Orthogonal to S-SIM checkpoint/mode mechanics.

---

## Export/Import

### Version 18 Format

```javascript
data.version = 18;
data.time = {
  t: TimeClock.t,
  frame: TimeClock.frame
  // mode not saved — always imports as 'paused'
};

// Checkpoint saved alongside
if (TimeClock._checkpoint) {
  data.checkpoint = {
    t: TimeClock._checkpoint.t,
    frame: TimeClock._checkpoint.frame
    // Unit state is reconstructed from the checkpoint's unit map
    // on import, not stored separately
  };
  // Per-unit: save checkpoint inventory
  for (const unitData of data.units) {
    const cpUnit = TimeClock._checkpoint.units.get(unitData.id);
    if (cpUnit?.inventory) {
      unitData.checkpointInventory = cpUnit.inventory;
    }
  }
}
```

### Import Behavior

- Always imports to paused mode
- Restores t, frame from saved data
- If checkpoint data present: reconstruct _checkpoint
- If no checkpoint (legacy v17 or earlier): _checkpoint = null
  (first Play will create one)
- Legacy v16 import: t = T0_SECONDS (backward compat, already in v13.7.0)
- Legacy v17 import: map _initial → _checkpoint

---

## Migration from Current System

### Code Removals

| Remove | Lines (est.) | Notes |
|---|---|---|
| mode='test' in TimeClock | ~15 | Replace with 'paused' |
| Test button HTML + handler | ~10 | Delete from DOM and JS |
| _captureInitial() | ~8 | Replaced by _saveCheckpoint |
| _restoreInitial() | ~8 | Replaced by _loadCheckpoint |
| _reinitInventoryIfTest() | ~5 | No longer needed |
| test-mode guards in wSet callback | ~3 | Remove guard |
| test-mode check in startPlay | ~4 | startPlay always works from paused |
| btnTest references in updateTransportUI | ~3 | Remove |

### Code Additions

| Add | Lines (est.) | Notes |
|---|---|---|
| _saveCheckpoint() | ~15 | Full scene snapshot |
| _loadCheckpoint() | ~12 | Full scene restore |
| Auto-checkpoint logic in step() | ~8 | Periodic + pre-catastrophe |
| Catastrophic prompt modal | ~30 | HTML + handler |
| u.fried handling in solver | ~10 | Zero-output bypass |
| Fried visual overlay | ~15 | CSS + render hook |
| Restore button HTML + handler | ~8 | Replaces Reset |
| Save button HTML + handler | ~5 | Manual checkpoint |
| Auto-solve-on-edit (remove guards) | ~5 | Simplify existing code |

Net: remove ~56 lines, add ~108 lines. Small delta for a
significant UX improvement.

---

## Tests (~12 new)

### Mode and Checkpoint (T-SM01–T-SM06)

| # | Test | Assert |
|---|------|--------|
| SM01 | Fresh scene starts paused | mode='paused', no checkpoint |
| SM02 | Step creates auto-checkpoint | _checkpoint captured before first tick |
| SM03 | Restore after 5 steps | t, frame, inventory all match checkpoint |
| SM04 | Manual save overwrites checkpoint | _saveCheckpoint captures current state |
| SM05 | No mode='test' anywhere | TimeClock.mode only 'paused' or 'playing' |
| SM06 | Auto-solve-on-edit while paused | Place unit → solve fires, inventory unchanged |

### Catastrophic Handling (T-SM07–T-SM09)

| # | Test | Assert |
|---|------|--------|
| SM07 | CATASTROPHIC auto-pauses play | mode='paused' after catastrophic tick |
| SM08 | u.fried produces zero output | All ports empty, tick skipped |
| SM09 | Pre-catastrophe checkpoint captured | Restore goes to last good state |

### Auto-Checkpoint (T-SM10–T-SM12)

| # | Test | Assert |
|---|------|--------|
| SM10 | Periodic checkpoint every game-hour | _checkpoint.t advances with clean ticks |
| SM11 | No checkpoint during MAJOR+ alarms | _checkpoint.t stays at last clean state |
| SM12 | Unit placed mid-sim included in checkpoint | Next checkpoint captures new unit |

---

## Implementation Checklist

```
S-SIM-1 (mode elimination + checkpoint):
  [ ] T0_SECONDS constant (if not done in S5a-0)
  [ ] Remove mode='test' from TimeClock
  [ ] Remove Test button (HTML + JS handler)
  [ ] Remove _captureInitial / _restoreInitial
  [ ] Remove _reinitInventoryIfTest and wSet guards
  [ ] Add _saveCheckpoint / _loadCheckpoint
  [ ] Auto-checkpoint on first step
  [ ] Periodic auto-checkpoint (every game-hour, clean ticks only)
  [ ] Rename Reset → Restore (button text + handler)
  [ ] Add Save (💾) button
  [ ] Auto-solve-on-edit (remove test-mode guards)
  [ ] Import always → paused (no mode='test' in import)
  [ ] Tests T-SM01–T-SM06
  [ ] Regression gate

S-SIM-2 (catastrophic events):
  [ ] Auto-pause on CATASTROPHIC
  [ ] Pre-catastrophe auto-checkpoint
  [ ] Catastrophic prompt modal (Restore / Continue)
  [ ] u.fried flag + zero-output bypass in solver
  [ ] Fried visual overlay (CSS + render)
  [ ] "Continue with damage" flow
  [ ] Tests T-SM07–T-SM09

S-SIM-3 (polish + regression):
  [ ] Export version 18 (checkpoint serialization)
  [ ] Import version 18 (checkpoint restore)
  [ ] Legacy import migration (v16/v17 → no checkpoint)
  [ ] Speed indicator unchanged
  [ ] syncPlanetBgTime integration with Restore
  [ ] Tests T-SM10–T-SM12
  [ ] Full regression gate
  [ ] Version bump
```

---

## Deferred (not S-SIM scope)

| Topic | When |
|---|---|
| Checkpoint stack (N checkpoints + scrubber) | Future UX sprint |
| Day/night T_atm(t) curve | S-CLIMATE phase |
| Humidity variation | S-CLIMATE phase |
| Equipment repair mechanic | Future game design |
| "Fast forward until quota met" | Future: skip-to-target with abort on catastrophe |
| Damage visual effects (smoke, cracks) | Art pass |
| Sound effects on catastrophe | Art pass |
