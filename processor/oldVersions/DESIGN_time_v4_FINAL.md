# DESIGN: Time, Inventory & Transport Controls — FINAL

**Revision**: v4 (final, for implementation)  
**Base**: processThis v9.0.0 (22,189 lines, 159 tests, 1174 checks)  
**Target**: v9.0.1 → v9.0.x → v9.1.0  

---

## 1. Concept

Discrete time over a purely steady-state simulation. Each timestep is a
full steady-state solve. Between solves, inventory-holding units (tanks,
batteries) update their stored quantities from the net flows of the
previous solve. The solver itself is unchanged.

```
Reset:  Set initial inventories → Solve(t=0) → Display
Step:   Update inventories from last-solve flows × Δt → t += Δt → Solve
Play:   Repeat Step at configurable rate
Pause:  Halt Play on current frame
Test:   Current behavior — single solve, no time, no inventory
```

---

## 2. NNG Audit & Amendments

This section lists every NNG clause, its status under this design, and
any required amendments. Amendments are marked **[AMEND]** and must be
applied to the NNG header block during implementation.

### CONSERVATION LAWS

**NNG-L1 — Mass balance**  
Current: "kg/s in = kg/s out for every non-boundary unit."  
Impact: Tank has both IN and OUT material ports; it is not a boundary unit.
In test mode, tank is pass-through (in ≈ out). In time mode, mass
accumulates: in − out = d(inventory)/dt. The instantaneous steady-state
solve still sees in ≠ out for the tank — the difference is the
accumulation rate.  
**[AMEND]** Add: "Inventory units (tank, battery) are exempt from the
instantaneous in = out check. Their mass imbalance equals the
accumulation rate, verified by the time-stepping layer. The global system
balance becomes: Σ(sources) − Σ(sinks) − Σ(accumulation) = 0."

**NNG-L2 — Energy balance**  
Current: "E_in = E_out for every non-boundary unit."  
Impact: Battery accumulates electrical energy. Tank accumulates thermal
energy (enthalpy of stored fluid).  
**[AMEND]** Add: "Inventory units are exempt from instantaneous E_in =
E_out. Energy accumulation is tracked by the time-stepping layer. Global:
Σ(E_in) − Σ(E_out) − Σ(E_accumulated) = 0."

### ARCHITECTURE

**NNG-A1** — Single-file HTML. ✓ No change.  
**NNG-A2** — DOM-free block 1. ✓ TimeClock is block 1, DOM-free.  
**NNG-A3** — Headless tests. ✓ Time tests use TimeClock.step(), no DOM.  
**NNG-A4** — Export on PG. ✓ TimeClock exported.  
**NNG-A5** — Registry pattern. ✓ Tank, battery via UnitRegistry.

### UNITS & CONVENTIONS

**NNG-U1 — SI units internally**  
Current: "Pa, K, mol/s, W (=J/s), J/mol, J/(mol·K), kg/m³."  
Impact: Battery stored energy. Wh is not SI base. Using J internally:  
  `charge_J -= netPower_W × dt_s` — clean, no conversion factor.  
  Display converts J → kWh (÷ 3,600,000).  
  Tank volume: m³ (SI). ✓  
**Decision:** Internal unit for stored energy = **J (joules)**.  
No amendment needed — J is already covered by W = J/s.

**NNG-U2** — All units via UnitRegistry. ✓ Tank, battery, grid_supply.  

**NNG-U3 — Thermo through ThermoAdapter**  
Current: "All thermodynamic calculations go through ThermoAdapter."  
Impact: Tank temperature mixing in `updateInventory()` uses a
mole-weighted average: `T_new = (n_stored·T_stored + ṅ_in·T_in·Δt) /
(n_stored + ṅ_in·Δt)`. This is an engineering approximation (assumes
equal Cp across species and temperatures), not a full enthalpy balance.  
**[AMEND]** Add: "NNG-U3a: Inventory update temperature mixing uses
mole-weighted average as a documented approximation. A future
enhancement may replace this with a full PH-flash via ThermoAdapter.
The approximation is acceptable because (a) it conserves energy to
first order, (b) Cp variation is small for ideal-gas species over
typical ΔT, (c) the rigorous alternative requires PH-flash on mixed
composition which adds significant complexity."

**NNG-U4** — Thermo models via ThermoPackage. ✓ Not directly affected.  
**NNG-U5** — Error severity. ✓ Tank overflow = CATASTROPHIC.

### STREAMS & VALIDATION

**NNG-M1** — STREAM_CONTRACTS is source of truth. ✓ Must update POWER
contract documentation (see NNG-M4).

**NNG-M2** — Two-phase validation. ✓ Not affected.  
**NNG-M3** — Material stream spec inference. ✓ Tank outputs have T.  

**NNG-M4 — Power stream fields**  
Current: "capacity/actual/demand/curtailmentFactor. actual ≤ capacity."  
Impact: Battery charging produces `actual < 0` on its port.  
`STREAM_CONTRACTS.POWER.required: { actual: 'finite_nonneg' }` at line
5294 would reject this. `validateStream()` at line 5584 flags
`actual < 0` as MAJOR.  
**[AMEND]** Add to NNG-M4: "Battery ports marked `bidirectional: true`
in port definition allow negative `actual` (indicating reverse flow /
charging). This is the sole exception to the non-negative actual rule.
STREAM_CONTRACTS.POWER gains an optional `bidirectional` context flag.
validateStream() skips the non-negative check when `ctx.bidirectional`
is true."  
Implementation: port def `{ portId: 'elec', ..., bidirectional: true }`.
`validateUnitPorts()` passes `bidirectional: p.bidirectional` in ctx.
`validateStream()` line 5584: `stream.actual < 0 && !ctx.bidirectional`.

**[AMEND]** Add new clause: "**NNG-M5** — Bidirectional ports. A port may
be declared `bidirectional: true` in its definition. This allows its
`actual` field to be negative, indicating power flow opposite to the
port's declared direction. Only the `battery` unit uses this. The
underlying solver may track forward and reverse flows as separate scratch
fields, unified on the port by the tick function."

### SOLVER

**NNG-S1 — Solver step ordering**  
Current: "... Steps B → C (hub) → D (battery direct) → E (source direct)"  
Impact: `battery` is renamed to `responsive_grid`. Step D becomes
"responsive_grid direct." Step C hub algorithm is extended to handle
new `battery` (SOC-aware) charging from surplus.  
**[AMEND]** Update step names: "D (responsive_grid/battery direct) →
E (source direct)". Document Step C extension: "Hub surplus is allocated
to battery charging before heat dissipation."

**NNG-S2** — Scratch for inter-iteration state. ✓ Battery charge/discharge
communicated via scratch fields `hubCharge_W`, `hubDischarge_W`.

**NNG-S3** — PH flash guarantee. ✓ Not affected.  

**NNG-S4 — Power lifecycle**  
Current: "capacity (tick) → demand (solver) → actual (solver, ≤ capacity)"  
Impact: Battery `actual` may be negative (charging).  
**[AMEND]** Add: "For bidirectional ports (battery): actual ∈
[−maxCharge, +capacity]. Negative actual indicates reverse flow."

**NNG-S5 (new)**  
> **NNG-S5** Inter-timestep persistent state lives on `u.inventory`.
> This field is invisible to `solveScene()` — never read, written, or
> cleared during a solve. Only `TimeClock` modifies it between solves.
> Tick functions may read `u.inventory` to determine port output; they
> never write it. The solver's inter-*iteration* state (scratch,
> convergence) remains governed by NNG-S2.

### DATA COMPLETENESS

**NNG-D1** — Species must be in ComponentRegistry. ✓ Tank initialized
with N₂ (registered). Tank contents come from inlet streams, which only
carry registered species. Tank cannot create species.

**NNG-D3** — No unit may produce unregistered species. ✓ Tank outlet
composition = inventory composition, which was built from inlet flows.
All species in inventory trace back to upstream sources via registered
components.

**NNG-D4** — Registry field completeness. ✓ Tank and battery definitions
include all required fields plus the new inventory protocol fields
(`inventory`, `initInventory`, `updateInventory`).  
**[AMEND]** Add to NNG-D4: "Units with `inventory: true` must also
provide `initInventory(par)` and `updateInventory(inventory, ports, dt)`
functions. These are optional fields — units without inventories omit
them."

### COMPATIBILITY

**NNG-C1** — Breaking changes OK in pre-release. ✓ Applies to:
`battery` → `responsive_grid` rename, new `battery` unit, version bump.

**NNG-C3** — No physics changes in refactors. ✓ The rename is NOT a
refactor — it's a functional reorganization. New battery is a new unit.
Responsive grid produces identical computed values to old battery.
Existing tests verify this after rename.

### TESTING

**NNG-T1** — All existing tests pass. ✓ After responsive_grid rename.  
**NNG-T2** — New features have tests. ✓ Detailed test list in §14.  
**NNG-T3** — Tests are deterministic. ✓  

**NNG-T4 (new)**  
> **NNG-T4** Time-related tests must be deterministic. Use explicit
> `TimeClock.step()` calls. No real-time playback, no `setTimeout`,
> no `setInterval` in tests. All time tests restore TimeClock and
> SimSettings to defaults after completion.

### VERSIONING

**NNG-V1/V2** — Version bump + changelog. ✓ Each phase increments version.

---

## 3. TimeClock — Block 1 (NNG-A2)

```javascript
const TimeClock = {
  t:     0,        // seconds
  dt:    60,       // timestep (seconds), stored in SimSettings.dt
  frame: 0,        // integer (0 = initial state)
  mode:  'test',   // 'test' | 'paused' | 'playing'
  _initial: new Map(),  // unitId → deep copy of initial inventory
};
```

### Mode state machine

- **test** → Step → **paused** (captures initial snapshot first)
- **paused** → Step → **paused** (frame++)
- **paused** → Play → **playing**
- **playing** → Pause → **paused**
- **paused** / **playing** → Reset → **test**
- **test** → Play → **playing** (captures initial, starts stepping)

### step(scene)

```
1. If mode === 'test':
     For each inventory unit: u.inventory = def.initInventory(u.params)
     captureInitial(scene)
     mode = 'paused'
2. Read resolved ports from scene.runtime.unitData (previous solve)
3. For each inventory unit:
     def.updateInventory(u.inventory, ud.ports, dt)
     → returns new inventory, assigned to u.inventory
4. t += dt, frame++
5. solveScene(scene)  // solve with updated inventories
```

### reset(scene)

```
1. restoreInitial(scene)  // u.inventory = snapshot
2. t = 0, frame = 0, mode = 'test'
3. solveScene(scene)
```

Exported on `PG.TimeClock`.

---

## 4. Unit State Layers

| Layer | Lifetime | Written by | Wiped by |
|-------|----------|------------|----------|
| `u.params` | Permanent | User, import | User edits |
| `u.last` | Per-solve | Tick | Solver (each solve start) |
| `u.inventory` | Per-session | TimeClock | TimeClock.reset() |

The solver NEVER touches `u.inventory` (NNG-S5).

---

## 5. Inventory Unit Protocol

```javascript
UnitRegistry.register('example', {
  inventory: true,
  initInventory(par) { return { /* initial state */ }; },
  updateInventory(inventory, resolvedPorts, dt) { return { /* updated */ }; },
  tick(u, ports, par, ctx) { /* reads u.inventory */ }
});
```

UnitRegistry.register() stores `inventory`, `initInventory`,
`updateInventory` on the def object (NNG-D4 amendment).

---

## 6. Tank — Material Inventory

### 6.1 Registration

```
defId:      'tank'
name:       'Tank'
category:   VESSEL (new, distinct color)
w: 2, h: 3

ports:
  mat_in    (MATERIAL, IN,  x:0, y:2)    left side, lower
  mat_out   (MATERIAL, OUT, x:2, y:2)    right side, lower
  overflow  (MATERIAL, OUT, x:1, y:0)    top center

params:
  volume_m3     default: 50       (50 m³ ≈ medium industrial tank)
  drawRate      default: 1.0      mol/s outlet rate

inventory: true
```

### 6.2 initInventory(par)

```javascript
{
  n: { N2: n_atmospheric },  // N₂ at atmospheric T, P
  T_K: SimSettings.atmosphere.T_K,
  P_Pa: SimSettings.atmosphere.P_Pa
}
```

Where `n_atmospheric = P × V / (R × T)` — ideal gas fill of the tank
volume at atmospheric conditions with pure N₂.

### 6.3 Volume → molar capacity

Gas-only for v1 (NNG-U3a simplification; liquid deferred):

```javascript
const n_max = (inv.P_Pa * par.volume_m3) / (8.314 * inv.T_K);
```

Fill fraction = `Σn / n_max`. This is condition-dependent: hot gas
fills more of the volume per mole.

### 6.4 Tank tick

```javascript
tick(u, ports, par, ctx) {
  const inv = u.inventory || { n: {}, T_K: 288.15, P_Pa: 101325 };
  const total = Object.values(inv.n).reduce((a,b) => a+b, 0);
  const n_max = (inv.P_Pa * (par.volume_m3 || 50)) / (8.314 * inv.T_K);
  const drawRate = par.drawRate ?? 1.0;

  // Outlet: proportional composition at drawRate, capped by content
  const actualDraw = total > 1e-12 ? Math.min(drawRate, total / TimeClock.dt) : 0;
  const n_out = {};
  if (total > 1e-12) {
    for (const [sp, mol] of Object.entries(inv.n)) {
      n_out[sp] = (mol / total) * actualDraw;
    }
  }
  ports.mat_out = {
    type: StreamType.MATERIAL,
    T: inv.T_K,
    P: inv.P_Pa,
    n: n_out
    // NO phaseConstraint — let flash determine LV mix from T, P, composition
    // This ensures a V-dominated tank still produces correct VL equilibrium
  };

  // Overflow: computed in updateInventory, tick just reports it
  // (overflow only active during time-stepping, not during test solve)
  ports.overflow = {
    type: StreamType.MATERIAL,
    T: inv.T_K,
    P: inv.P_Pa,
    n: {}  // empty unless overflow computed
  };

  // Diagnostics
  u.last = {
    totalMol: total,
    n_max,
    fillPct: n_max > 0 ? (total / n_max) * 100 : 0,
    drawRate: actualDraw,
    status: total < 1e-12 ? 'empty'
          : total >= n_max ? 'full'
          : 'active',
    T_K: inv.T_K,
    P_Pa: inv.P_Pa,
    type: 'tank'
  };
}
```

**Phase handling (V → VL output):** The tick does NOT set phaseConstraint.
The solver's flash step (TP flash) runs on the output stream, which may
produce a VL mix if conditions are below the dew point. This means a
"gas tank" that gets cooled can produce a two-phase outlet — physically
correct behavior that defers the need for explicit liquid tank support.

### 6.5 Tank updateInventory

```javascript
updateInventory(inventory, resolvedPorts, dt) {
  const inv = { ...inventory, n: { ...inventory.n } };
  const inFlow  = resolvedPorts.mat_in?.n || {};
  const outFlow = resolvedPorts.mat_out?.n || {};
  const ovFlow  = resolvedPorts.overflow?.n || {};

  // Species set: union of inventory + inlet + outlet
  const allSp = new Set([
    ...Object.keys(inFlow),
    ...Object.keys(outFlow),
    ...Object.keys(inv.n)
  ]);
  for (const sp of allSp) {
    const net = (inFlow[sp] || 0) - (outFlow[sp] || 0) - (ovFlow[sp] || 0);
    inv.n[sp] = Math.max(0, (inv.n[sp] || 0) + net * dt);
  }

  // Pressure = inlet pressure (if inlet connected), else unchanged
  if (resolvedPorts.mat_in?.P) {
    inv.P_Pa = resolvedPorts.mat_in.P;
  }

  // Temperature: energy-balanced mixing (NNG-U3a approximation)
  const inTotal = Object.values(inFlow).reduce((a,b) => a+b, 0);
  const prevTotal = Object.values(inventory.n).reduce((a,b) => a+b, 0);
  const newTotal = Object.values(inv.n).reduce((a,b) => a+b, 0);
  if (inTotal > 0 && newTotal > 1e-12) {
    const inT = resolvedPorts.mat_in?.T || inv.T_K;
    const storedH = prevTotal * inv.T_K;  // proportional to enthalpy
    const inH = inTotal * dt * inT;
    inv.T_K = (storedH + inH) / (prevTotal + inTotal * dt);
  }

  // Check overflow (will be reported as CATASTROPHIC if overflow port unconnected)
  // (Overflow handling is done by the tick + diagnostics, not here — 
  //  updateInventory just tracks moles honestly)

  return inv;
}
```

### 6.6 Empty port tolerance

Tank is the **only** unit that tolerates disconnected material ports.
Implementation: `validateUnitPorts()` or the solver's disconnected-port
check must skip tank ports. Add a `optionalPorts: true` flag to the tank
definition, checked during validation.

### 6.7 Overflow and catastrophic failure

The tank tick checks fill percentage each solve. If `fillPct >= 100` and
the overflow port has no connection:

```javascript
// In tick, after computing fillPct:
if (u.last.fillPct >= 100) {
  const overflowConnected = /* check if overflow port has a connection */;
  if (!overflowConnected) {
    ctx.warn({
      severity: ErrorSeverity.CATASTROPHIC,
      message: 'Tank overflow — catastrophic rupture! No overflow path connected.',
      code: 'TANK_OVERFLOW_RUPTURE'
    });
  }
}
```

If overflow IS connected, excess exits through the overflow port. The
overflow flow rate = inlet flow − (available capacity / dt) − outlet flow,
clamped to ≥ 0.

### 6.8 Visual fill indicator

In `drawUnits()` (block 2), the tank icon includes a dynamic rectangle:

```javascript
// Read fill from u.last.fillPct (0-100)
const fillH = (iconH * fillPct / 100);  // height of filled region
// Draw filled rectangle from bottom of icon, using a lighter variant
// of the VESSEL category color
```

This provides immediate visual feedback of tank level directly on the
flowsheet, without needing to open the properties panel.

### 6.9 Tank property editor display

```
TANK
  Fill: ████████░░ 78.5%  (785 / 1000 mol)
  Volume: 50 m³   Capacity: 1000 mol (at current T, P)
  T = 305.2 K  |  P = 101325 Pa
  ┌──────────────────────┐
  │  N₂     620.0 mol    │
  │  O₂     165.0 mol    │
  └──────────────────────┘
  Net flow: +2.3 mol/s (filling)
  Time to full: ~1:34
```

---

## 7. Grid Supply (renamed from battery)

### 7.1 Rename

| Old | New |
|-----|-----|
| defId: `battery` | defId: `grid_supply` |
| name: "Battery" | name: "Grid Supply" |
| u.last.type: 'battery' | u.last.type: 'grid_supply' |

**Behavior is 100% identical.** Infinite-capacity responsive power source.
The hub algorithm Step C checks `srcU?.defId === 'battery'` → change to
`srcU?.defId === 'grid_supply'`. Steps D/E similarly updated.

All existing tests referencing `'battery'` updated to `'grid_supply'`.
NNG-C3 compliance verified: no computed value changes.

---

## 8. Battery — SOC-Tracked Energy Storage

### 8.1 Registration

```
defId:      'battery'
name:       'Battery'
category:   POWER_MANAGEMENT
w: 2, h: 2
inventory:  true

ports:
  elec  (ELECTRICAL, OUT, x:2, y:1, bidirectional: true)
    ← sole exception: actual may be negative (NNG-M5)

params:
  peakPower_kW     default: 20      (max instantaneous power, kW)
  capacity_J       default: 36000000 (= 10 kWh, internal SI unit)
  initialSOC       default: 0.9     (90% state of charge)
```

User-facing display: capacity in kWh, charge in kWh, peak power in kW.
Internal: all in J and W (NNG-U1).

### 8.2 initInventory(par)

```javascript
{
  charge_J:    (par.capacity_J || 36000000) * (par.initialSOC ?? 0.9),
  capacity_J:  par.capacity_J || 36000000
}
```

### 8.3 Battery tick

```javascript
tick(u, ports, par, ctx) {
  const peakPower_W = (par.peakPower_kW || 20) * 1000;
  const inv = u.inventory;
  const s = ctx ? ctx.scratch : {};
  const dt = TimeClock.dt || 60;

  // SOC-limited discharge: can't extract more energy than stored
  let maxDischarge_W = peakPower_W;
  if (inv) {
    if (inv.charge_J <= 0) maxDischarge_W = 0;
    else maxDischarge_W = Math.min(peakPower_W, inv.charge_J / dt);
  }

  // SOC-limited charge: can't store more than remaining capacity
  let maxCharge_W = peakPower_W;
  if (inv) {
    const headroom_J = inv.capacity_J - inv.charge_J;
    if (headroom_J <= 0) maxCharge_W = 0;
    else maxCharge_W = Math.min(peakPower_W, headroom_J / dt);
  }

  // Read hub/solver decisions from scratch
  const discharge_W = s.hubDischarge_W ?? (s.actualDraw_W ?? maxDischarge_W);
  const charge_W    = s.hubCharge_W ?? 0;
  const netPower_W  = discharge_W - charge_W;
  // netPower > 0 → discharging, < 0 → charging

  ports.elec = {
    type: StreamType.ELECTRICAL,
    capacity:    maxDischarge_W,
    actual:      netPower_W,       // may be negative (NNG-M5)
    demand:      s.hubDemand_W || 0,
    curtailmentFactor: s.directCurtailment ?? 1.0,
    _maxCharge_W:    maxCharge_W,     // hub reads this
    _maxDischarge_W: maxDischarge_W   // hub reads this
  };

  u.last = {
    peakPower_W, maxDischarge_W, maxCharge_W,
    discharge_W, charge_W, netPower_W,
    soc: inv ? inv.charge_J / inv.capacity_J : 0.9,
    charge_J:   inv?.charge_J,
    capacity_J: inv?.capacity_J,
    status: netPower_W > 0 ? 'discharging'
          : netPower_W < 0 ? 'charging' : 'idle',
    type: 'battery'
  };
}
```

### 8.4 Battery updateInventory

```javascript
updateInventory(inventory, resolvedPorts, dt) {
  const inv = { ...inventory };
  const netPower_W = resolvedPorts.elec?.actual || 0;
  // positive actual = discharged, negative = charged
  inv.charge_J = Math.max(0, Math.min(
    inv.capacity_J,
    inv.charge_J - netPower_W * dt
  ));
  return inv;
}
```

Formula: `charge_J -= netPower_W × dt`. No unit conversion (NNG-U1). ✓

### 8.5 Hub Step C extension — charging from surplus

The hub algorithm (solver, ~line 10020) is extended:

```
EXISTING FLOW:
  fixedSupply    = Σ capacity of source_electrical on elec_in
  responsiveMax  = Σ capacity of grid_supply on elec_in
  totalDemand    = Σ consumer demands on elec_out
  responsiveDraw = clamp(totalDemand − fixedSupply, 0, responsiveMax)
  totalSupply    = fixedSupply + responsiveDraw

ADDITION (between responsive_draw and surplus):
  // Battery discharge: if demand still unmet after responsive grid
  batteryMax     = Σ _maxDischarge_W from battery sources on elec_in
  remainingGap   = max(0, totalDemand − totalSupply)
  batteryDraw    = clamp(remainingGap, 0, batteryMax)
  totalSupply   += batteryDraw

  // Consumer allocation
  allocation = allocatePower(consumers, totalSupply)

  // Surplus → charge batteries before heat
  surplus        = max(0, fixedSupply + responsiveDraw − totalDemand)
  chargeAvail    = Σ _maxCharge_W from battery sources on elec_in
  batteryCharge  = min(surplus, chargeAvail)
  heatSurplus    = surplus − batteryCharge

ENERGY BALANCE (exact):
  fixedSupply + responsiveDraw + batteryDraw
    = demand_served + batteryCharge + heatSurplus
```

Hub writes to each battery's scratch:
- `hubDischarge_W`: proportional share of batteryDraw
- `hubCharge_W`: proportional share of batteryCharge
- `hubDemand_W`: total demand seen by this battery

### 8.6 Direct connection mode (no hub)

When battery connects directly to a consumer (Steps D/E), it behaves as
discharge-only (like old battery/grid_supply). SOC limits capacity. No
charging in direct mode.

### 8.7 Battery property editor

```
BATTERY
  Charge: ██████████████░░ 90%  (9.0 / 10.0 kWh)
  Peak power: 20 kW
  Status: Discharging at 5.0 kW
  Time to empty: ~1:48:00
```

---

## 9. Transport Controls — Block 2

### 9.1 Layout

Replace "▶ Run" with transport group + time display:

```
[⟳ Test] [▶ Step] [▶▶ Play] [⏸ Pause] [↺ Reset]  t=5:00 f5 Δt=60s
```

Time display visible only when `mode ≠ 'test'`.

### 9.2 Button states

| Mode | Test | Step | Play | Pause | Reset |
|------|------|------|------|-------|-------|
| test | active | enabled | enabled | — | — |
| paused | enabled | enabled | enabled | — | enabled |
| playing | — | — | — | enabled | — |

### 9.3 Auto-pause triggers

- Unit added/deleted (topology change)
- Connection added/deleted (topology change)
- Solver CATASTROPHIC error

Parameter changes during play are **live** (no auto-pause).

### 9.4 "Test" at frame N

Pressing Test while at frame 50: solves once with current inventories
(no reset). Equivalent to Step minus the inventory update. Reset is the
explicit "go to t=0."

---

## 10. Settings

New "Time" section in Settings modal:

```
TIME
  Timestep (Δt):  [60    ] s
  Play speed:     [1x  ▼]    (1x, 2x, 5x, 10x, max)
```

`SimSettings.dt` default 60, persisted in JSON settings block.

---

## 11. Scene Persistence

Version bump to **14**.

```json
{
  "version": 14,
  "settings": { "cheatsEnabled": true, "atmospherePreset": "earth_isa", "dt": 60 },
  "time": {
    "t": 300, "frame": 5,
    "inventories": { "tank-3": {...}, "battery-4": {...} },
    "initialInventories": { "tank-3": {...}, "battery-4": {...} }
  }
}
```

Import v ≤ 13: no time block → test mode, inventories from initInventory.
Import v14+: restore time state, mode = paused.

---

## 12. Balance with Accumulation

```
Global: Σ(sources) − Σ(sinks) − Σ(accumulation) = 0
```

Mass accumulation = Σ(tank net inflow) in kg/s.  
Energy accumulation = Σ(battery net charge) in W + Σ(tank ΔH) in W.

In test mode: accumulation = 0 (current behavior).

Balance display gains "Accumulation" column with per-unit breakdown.

---

## 13. Implementation Phases

### Phase 0 — TimeClock + Transport UI (v9.0.1)

- TimeClock namespace in block 1 (t, dt, frame, mode, step, reset)
- step(): increment t/frame, call solveScene() (no inventory yet)
- captureInitial / restoreInitial: stubs
- SimSettings.dt = 60
- NNG-S5, NNG-T4 clauses in header
- Transport buttons replacing "▶ Run"
- Time display (hidden in test mode)
- Play loop with speed control
- Auto-pause on topology change
- Settings: Time section
- Tests: clock increment, reset, mode transitions
- **~200 lines, low risk**

### Phase 1 — Responsive Grid Rename + Inventory Protocol (v9.0.2)

- `battery` → `grid_supply` (defId, name, all references, hub Step C/D)
- Inventory protocol on UnitRegistry (inventory, initInventory, updateInventory)
- TimeClock.step(): scan inventory units, call updateInventory
- captureInitial / restoreInitial: deep-copy u.inventory
- Scene.placeUnit(): call initInventory for inventory units
- NNG-D4 amendment, NNG-M5 clause, NNG-M4 amendment in header
- bidirectional flag support in validateUnitPorts/validateStream
- Tests: all existing battery tests pass as grid_supply,
  inventory protocol coverage
- **~150 lines, medium risk (rename breadth)**

### Phase 2 — Tank (v9.0.3)

- UnitCategories.VESSEL
- Tank unit: registration, initInventory (N₂ atmospheric), updateInventory,
  tick (drawRate, overflow, fill calculation)
- Volume → capacity derivation (ideal gas PV=nRT)
- Overflow port + CATASTROPHIC on unconnected overflow at 100%
- Empty port tolerance (optionalPorts flag)
- Visual fill indicator in drawUnits()
- Tank SVG icon
- Tank property editor
- Scene persistence: version 14, time.inventories
- NNG-L1, NNG-L2 amendments in header
- NNG-U3a amendment in header
- Tests: fill, drain, overflow catastrophic, empty tank, reset,
  T mixing, test-mode stability, VL output from flash
- **~400 lines, medium-high**

### Phase 3 — Battery with SOC (v9.0.4)

- New `battery` unit: inventory, initInventory (90% SOC), updateInventory,
  tick (bidirectional port, SOC limits)
- Hub Step C extension: battery discharge + surplus charging
- NNG-S1, NNG-S4 amendments in header
- Battery property editor (charge bar, peak power, status)
- Direct-bus fallback (discharge-only)
- Tests: discharge, SOC depletion, hub charging, full stops charge,
  energy balance, direct-bus mode
- **~300 lines, high complexity**

### Phase 4 — Balance + Polish (v9.0.5)

- computeSystemBalance: accumulation term
- Balance display: In − Out − Accum
- Time-to-full / time-to-empty estimates
- Transport styling refinements
- **~150 lines, low risk**

### Phase 5 — Milestone (v9.1.0)

- Demo with tank + battery
- Full regression (target: 180+ tests)
- Version bump

---

## 14. Test Plan

### Phase 0 tests

| # | Description |
|---|-------------|
| T160 | TimeClock.step() increments t by dt and frame by 1 |
| T161 | TimeClock.reset() restores t=0, frame=0, mode='test' |
| T162 | Mode transitions: test→paused on first step, paused→test on reset |
| T163 | step() triggers solveScene (scene.runtime.lastSolve updates) |

### Phase 1 tests

| # | Description |
|---|-------------|
| T164 | grid_supply produces identical output to old battery |
| T165 | Hub Step C works with grid_supply (renamed) |
| T166 | Inventory protocol: initInventory called on placeUnit |
| T167 | captureInitial / restoreInitial round-trips inventory |
| T168 | bidirectional port validation: negative actual accepted |

### Phase 2 tests

| # | Description |
|---|-------------|
| T169 | Tank init: N₂ at atmospheric T/P, correct mol count |
| T170 | Tank fill: 5 steps with inlet, inventory grows |
| T171 | Tank drain: 5 steps outlet only, inventory decreases |
| T172 | Tank empty: drain until 0, output goes to zero |
| T173 | Tank overflow + no overflow connection → CATASTROPHIC |
| T174 | Tank overflow + connection → excess exits safely |
| T175 | Tank reset restores initial inventory |
| T176 | Tank T mixing: inlet at different T → T_tank changes |
| T177 | Tank test-mode: inventory unchanged after solve |
| T178 | Tank output flash: V composition → correct VL from TP flash |

### Phase 3 tests

| # | Description |
|---|-------------|
| T179 | Battery 90% SOC: outputs at peakPower |
| T180 | Battery discharge over steps: charge_J decreases |
| T181 | Battery at 0% SOC: output = 0 |
| T182 | Hub charges battery from surplus: charge_J increases |
| T183 | Battery at 100% SOC: charging stops |
| T184 | Battery energy balance: fixedSupply = served + charge + heat |
| T185 | Battery direct-bus: discharge-only, no charging |
| T186 | Battery reset: SOC restored to initial |

### Phase 4 tests

| # | Description |
|---|-------------|
| T187 | System balance with tank: In − Out − Accum ≈ 0 |
| T188 | System balance with battery: electrical accum term |

---

## 15. Decided Questions

| # | Question | Decision |
|---|----------|----------|
| 1 | Tank default content | N₂ at atmospheric T/P (ideal gas fill) |
| 2 | Battery default SOC | 90% (0.9) |
| 3 | Overflow drama | Error styling only. Cinematic effects deferred. |
| 4 | "Test" at frame N | Solve with current inventories (no reset) |
| 5 | Tank phase | Gas-only storage (V). Output gets proper VL flash from solver. Liquid tank deferred. |
| 6 | Grid Supply name | "Grid Supply" (defId: `grid_supply`) |
| 7 | Internal energy unit | J (joules). Display as kWh. NNG-U1 compliant. |
| 8 | Tank T model | Mole-weighted average (NNG-U3a approximation) |
| 9 | Tank P model | Fixed = inlet pressure |
| 10 | Param changes during play | Live (no auto-pause). Only topology changes pause. |
| 11 | Battery port | Single, bidirectional (NNG-M5). Negative actual = charging. |
| 12 | Battery charging | Hub-only. Surplus → charge before heat dissipation. |
