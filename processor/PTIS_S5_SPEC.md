# PTIS_S5_SPEC
## S5 — Pressure & Flow Network
### processThis v13.4.0 → v13.5.0 (post-S4)

---

## Overview

**What:** Make pressure real. Tanks compute headspace P from contents
via `computeTankState()`. A pressure network propagates P through the
flowsheet via BFS. Flow emerges from ΔP through Cv restrictions —
no user-typed flow rates. New reservoir unit (enhanced 5-port tank),
new atmosphere_sink, algebraic path solver (NNG-4: no flow-pressure
iteration).

**Sub-sessions:** S5a (4), S5b (3) — 7 sessions total.

**Risk:** High. Largest stage by scope. Core architectural change to
how flow originates. Mitigated by algebraic-only solver (no iteration),
phase-gated rollout, and 79 dedicated tests.

**Dependencies:** S3 (PR liquid density for `computeTankState` headspace
calculation). S1 (alarm infrastructure for pressure alarms).

**Required by:** S8 (game missions use reservoir + Cv for player-designed
flow control).

**Baseline state (post-S4):**
- Tank: 3-port (mat_in, mat_out, overflow), P = inlet P, volume default 0.15 m³ (corrected S1)
- Valve: isenthalpic, P_out mode only (line 7853)
- Sources: user stamps rate. No pressure participation.
- No pressure network, no Cv, no headspace model
- ~355 tests

**After S5:**
- Reservoir (5-port, Cv, finite/infinite, sealed/vented)
- atmosphere_sink (P_atm anchor)
- computeTankState() pure function
- Pressure roles on all 22+ units
- UnionFind + BFS pressure propagation
- Algebraic path solver (single, parallel, branch)
- Production gating on pressure ERROR
- ~434 tests (355 + 79 new)

---

## Design Principles

**Flow from pressure, not from user input:** All flow originates from
ΔP through resistance. In engineering mode, no unit stamps a flow rate.
The player designs systems by choosing vessel sizes, valve openings, and
routing. Flow rate is a consequence, not an input.

**NNG-4: Pressure-flow network.** Flow through Cv restrictions is
computed algebraically from anchor pressures, path resistances, and ΔP
budgets. The solver never iterates between flow and pressure fields.
Every topology computes in bounded time with deterministic results.
All flows ≥ 0 everywhere. Backflow detected, zeroed, alarmed — never
computed.

**The realism ladder:** Ideal units (source, sink) opt out of pressure
with `pressure.role = 'none'`. Engineering units (reservoir, valve,
process units) participate. Both can coexist. A visual indicator marks
non-participating units.

---

## Phased Rollout

The spec is implemented in 4 phases within 2 sub-sessions:

| Phase | Scope | Features | Tests |
|-------|-------|----------|-------|
| 1 | Vessel | computeTankState, reservoir, atmosphere_sink | T-PS01–T-PS23 (23) |
| 2 | Network structure | Pressure roles, k resistance, valve enhancement, UnionFind, topology analysis | T-PS24–T-PS43 (20) |
| 3 | Propagation + solver | BFS, algebraic path solver, branching, density correction | T-PS44–T-PS64 (21) |
| 4 | Gating + UX | Production gating, traffic light, connection-time analysis, demo scene | T-PS65–T-PS79 (15) |

**S5a** covers Phases 1–2 (4 sessions). **S5b** covers Phases 3–4 (3 sessions).

---

# S5a — Vessel + Network Structure (Phases 1–2)

## Phase 1: Vessel Layer

### F-001. computeTankState()

Pure function. No side effects. Placed in Block 1 (DOM-free core).

```javascript
/**
 * Compute tank/reservoir state from inventory.
 * @param {Object} n       - { species: mol } inventory
 * @param {number} T_K     - Temperature [K]
 * @param {number} V_total - Tank volume [m³]
 * @param {Object} thermo  - ThermoAdapter instance
 * @returns {{ P_Pa, V_liq_m3, V_vap_m3, n_L, n_V, level_pct }}
 */
function computeTankState(n, T_K, V_total, thermo) {
  const R = 8.314;
  const species = Object.keys(n).filter(sp => n[sp] > 1e-15);
  if (species.length === 0) {
    return { P_Pa: 0, V_liq_m3: 0, V_vap_m3: V_total, n_L: {}, n_V: {}, level_pct: 0 };
  }

  // 1. Classify species: condensable (T < 0.9 × Tc) vs permanent gas
  const condensable = [], permanent = [];
  for (const sp of species) {
    const cd = ComponentRegistry.get(sp);
    if (cd && T_K < 0.9 * cd.Tc) {
      condensable.push(sp);
    } else {
      permanent.push(sp);
    }
  }

  // 2. Liquid volume from condensable species
  const n_L = {}, n_V = {};
  let V_liq = 0;
  for (const sp of condensable) {
    // All condensable moles assumed liquid (simplified — no VLE iteration)
    n_L[sp] = n[sp];
    n_V[sp] = 0;
    const cd = ComponentRegistry.get(sp);
    const rho = thermo.density ? thermo.density(sp, T_K, 101325, 'L')
      : (cd.rhoLiq || 1000);
    const MW_kg = cd.MW / 1000;
    V_liq += n[sp] * MW_kg / rho;
  }

  // 3. Headspace volume
  let V_headspace = Math.max(0, V_total - V_liq);

  // 4. VLE on condensable: add vapor pressure contribution
  let n_vap_cond = 0;
  if (V_headspace > 0.001 * V_total) {
    for (const sp of condensable) {
      const Psat = thermo.saturationPressure
        ? thermo.saturationPressure(sp, T_K) : 0;
      if (Psat > 0) {
        // Estimate moles of condensable vapor in headspace
        const n_v_est = Psat * V_headspace / (R * T_K);
        const n_actual = Math.min(n_v_est, n[sp] * 0.5);  // cap at half
        n_V[sp] = n_actual;
        n_L[sp] = n[sp] - n_actual;
        n_vap_cond += n_actual;
      }
    }
  }

  // 5. Permanent gas: all in headspace
  let n_perm = 0;
  for (const sp of permanent) {
    n_V[sp] = n[sp];
    n_L[sp] = 0;
    n_perm += n[sp];
  }

  // 6. Headspace pressure: ideal gas
  const n_gas_total = n_perm + n_vap_cond;
  let P_Pa;
  if (V_headspace < 1e-6) {
    // All liquid, no headspace → sentinel pressure
    P_Pa = 200e5;  // 200 bar sentinel
  } else {
    P_Pa = n_gas_total * R * T_K / V_headspace;
  }

  // 7. Level
  const level_pct = V_total > 0 ? Math.min(100, (V_liq / V_total) * 100) : 0;

  return { P_Pa, V_liq_m3: V_liq, V_vap_m3: V_headspace, n_L, n_V, level_pct };
}
```

**Accuracy:** ±5–15% with ideal gas. After S3 (PR active), liquid density
from Z_liq and VLE from fugacity improve accuracy to ±2–5%.

**Edge cases:** Empty → P ≈ 0. All liquid → 200 bar sentinel + WARNING.
Overfull (V_liq > V_total) → clamp + CATASTROPHIC. CO₂ at 290K:
0.9×Tc = 274K, 290 > 274 → classified as permanent gas (conservative).

---

### F-002. Reservoir Unit Registration

**New unit.** Insert after tank registration. Does NOT replace tank —
tank stays for backward compatibility, deprecated in palette.

```javascript
UnitRegistry.register('reservoir', {
  name: 'Reservoir',
  category: UnitCategories.VESSEL,
  w: 2,
  h: 3,
  optionalPorts: true,
  ports: [
    { portId: 'feed_in', dir: PortDir.IN,  type: StreamType.MATERIAL, x: 0, y: 1 },
    { portId: 'liq_out', dir: PortDir.OUT, type: StreamType.MATERIAL, x: 2, y: 2 },
    { portId: 'vap_out', dir: PortDir.OUT, type: StreamType.MATERIAL, x: 2, y: 0 },
    { portId: 'overflow',dir: PortDir.OUT, type: StreamType.MATERIAL, x: 1, y: 3 },
    { portId: 'vent',    dir: PortDir.OUT, type: StreamType.MATERIAL, x: 1, y: 0 }
  ],
  presentations: { 'box/default': { w: 2, h: 3, ports: {
    feed_in:{x:0,y:1.5}, liq_out:{x:2,y:2.5}, vap_out:{x:2,y:0.5},
    overflow:{x:1,y:3}, vent:{x:1,y:0}
  }}},
  inventory: true,
  pressure: { role: 'anchor', pairs: [] },
  limitParams: ['T', 'P', 'mass', 'level'],
  limits: {
    S: {
      T_LL: 73, T_L: 100, T_H: 473, T_HH: 523,
      P_LL: 0.05e5, P_HH: 200e5,
      mass_HH: 0.25,
      level_H: 90, level_HH: 100
    }
  },
  // ... initInventory, updateInventory, tick defined below
});
```

**Parameters:**

| Key | Default | Min | Max | Notes |
|-----|---------|-----|-----|-------|
| volume_m3 | 0.15 | 0.001 | 1000 | ∞ in reservoir mode |
| tankMode | 'sealed' | enum | sealed/vented | |
| reservoirMode | false | bool | | true = infinite supply |
| T_K | 298.15 | 50 | 2000 | |
| composition | {} | | | mol fractions for init |
| P_charge_bar | 5 | 0.1 | 200 | sealed reservoir init P |
| liq_Cv | 50 | 0.1 | 10000 | liquid outlet sizing |
| liq_opening_pct | 0 | 0 | 100 | 0 = closed |
| vap_Cv | 50 | 0.1 | 10000 | vapor outlet sizing |
| vap_opening_pct | 0 | 0 | 100 | |
| P_design_bar | 10 | 1 | 100 | vent trigger |
| P_rupture_bar | 15 | P_design+0.5 | 200 | CATASTROPHIC trigger |
| maxLiqLevel_pct | 90 | 50 | 99 | overflow trigger |

**Pressure anchor logic:**
- Sealed finite: P = computeTankState().P_Pa
- Vented: P = SimSettings.atmosphere.P_Pa
- Reservoir sealed: P = P_charge_bar × 1e5 (constant)
- Reservoir vented: P = P_atm (constant)

**Outlet flow (Cv equation):**
```
Q_out = Cv × (opening/100) × √(ΔP_net / (SG × 1e5))
```
Where `ΔP_net = P_tank − P_downstream` (from path solver).
`SG = MW_avg / 18.015` (water reference, ISA convention).
If `ΔP_net ≤ 0`: Q = 0 (implicit check valve).

**Phase-constrained outlets:**
- `liq_out`: draws only from `n_L` (liquid inventory from computeTankState)
- `vap_out`: draws only from `n_V` (vapor inventory)
- No liquid → `liq_out` Q = 0 + INFO alarm
- No vapor → `vap_out` Q = 0 + INFO alarm

**Safety ports:**
- `vent`: opens when P > P_design. Connected → WARNING. Unconnected → ERROR/CATASTROPHIC.
- `overflow`: opens when level > maxLiqLevel_pct. Same severity logic.

**Palette presets:**
| Preset | reservoirMode | tankMode | composition | Notes |
|--------|--------------|----------|-------------|-------|
| Empty vessel | false | sealed | {} | Physical vessel |
| Air supply | true | vented | air | Atmosphere proxy |
| Gas cylinder | true | sealed | user | Pressurized gas |
| Liquid tank | false | sealed | user | Liquid storage |

---

### F-003. Atmosphere Sink

```javascript
UnitRegistry.register('atmosphere_sink', {
  name: 'Atmosphere',
  category: UnitCategories.SINK,
  w: 2, h: 2,
  ports: [
    { portId: 'mat_in', dir: PortDir.IN, type: StreamType.MATERIAL, x: 0, y: 1 }
  ],
  pressure: { role: 'anchor', P_source: 'atmosphere' },
  tick(u, ports, par) {
    const atm = SimSettings.getAtmosphere();
    u.last = {
      absorbed_mol_s: ports.mat_in
        ? Object.values(ports.mat_in.n || {}).reduce((a,b) => a+b, 0) : 0,
      P_atm_bar: atm.P_Pa / 1e5
    };
  }
});
```

Anchor at P_atm. Absorbs all inflow. Tracks atmosphere preset changes.

---

## Phase 2: Network Structure

### F-004. Pressure Role Declarations

Add `pressure: { role, pairs, k }` to every unit registration.

| defId | role | k (Pa·s²/mol²) | pairs |
|-------|------|-----------------|-------|
| source | none | — | — |
| source_multi | none | — | — |
| source_air | none | — | — |
| grid_supply | none | — | — |
| sink | none | — | — |
| sink_electrical | none | — | — |
| battery | none | — | — |
| power_hub | none | — | — |
| electric_heater | passthrough | 500 | mat_in→mat_out |
| air_cooler | passthrough | 500 | mat_in→mat_out |
| hex | passthrough | 1000 | hot_in→hot_out, cold_in→cold_out |
| mixer | passthrough | 0 | in1,in2→out |
| splitter | passthrough | 0 | mat_in→out1,out2 |
| flash_drum | passthrough | 100 | mat_in→vap_out,liq_out |
| reactor_equilibrium | passthrough | 5000 | mat_in→mat_out |
| distillation_column | passthrough | 10000 | mat_in→mat_out_D,mat_out_B |
| valve | drop | 0 | mat_in→mat_out |
| pump | boost | 0 | mat_in→mat_out |
| compressor | boost | 0 | mat_in→mat_out |
| gas_turbine | drop | 0 | mat_in→mat_out |
| tank | anchor | — | — |
| reservoir | anchor | — | — |
| atmosphere_sink | anchor | — | — |

**Implementation:** Add `pressure` property to each `UnitRegistry.register()` call.
Non-material units (battery, power_hub, grid_supply, sink_electrical) have
`role: 'none'` — they don't participate in the pressure network.

### F-005. Resistance Parameter k

k is added as an inspector parameter on all passthrough units (collapsed
in "Advanced" section). Default values from the table above. Player-adjustable.

```javascript
// Add to each passthrough unit's initParams:
unit.params.k_resistance = /* default per table */;
```

**ΔP formula:** `ΔP_unit = k × Q²` where Q is molar flow (mol/s).
Applied only in path solver (not in individual tick functions).

### F-006. Valve Enhancement

**Current:** Valve at line 7853 has `P_out` mode only.

**Add:**
- `pressure: { role: 'drop', pairs: [['mat_in','mat_out']], k: 0 }`
- `deltaP` mode: `P_out = P_in − deltaP`
- Reverse flow check: if `P_out > P_in` after network propagation → Q = 0, INFO alarm
- Existing isenthalpic + PH-flash behavior unchanged

### F-007. UnionFind

New data structure in Block 1:

```javascript
class UnionFind {
  constructor() { this.parent = new Map(); this.rank = new Map(); }
  find(x) {
    if (!this.parent.has(x)) { this.parent.set(x, x); this.rank.set(x, 0); }
    if (this.parent.get(x) !== x) this.parent.set(x, this.find(this.parent.get(x)));
    return this.parent.get(x);
  }
  union(x, y) {
    const rx = this.find(x), ry = this.find(y);
    if (rx === ry) return;
    const rankX = this.rank.get(rx), rankY = this.rank.get(ry);
    if (rankX < rankY) this.parent.set(rx, ry);
    else if (rankX > rankY) this.parent.set(ry, rx);
    else { this.parent.set(ry, rx); this.rank.set(rx, rankX + 1); }
  }
  components() { /* return Map<root, Set<members>> */ }
}
```

### F-008. buildPressureNodes + analyzePressureTopology

```javascript
/**
 * Build pressure node graph from scene.
 * One node per material port on participating units. Union by wire.
 * @returns {{ zones: Map, anchors: Map, conflicts: [] }}
 */
function buildPressureNodes(scene) { ... }

/**
 * Pre-run analysis: detect conflicts, floating zones, overrides.
 */
function analyzePressureTopology(scene) { ... }
```

Zones = connected components. Each zone has 0..N anchors.
Multiple anchors at same P (within tolerance) → OK.
Multiple anchors at different P → conflict ERROR.
No anchors → floating zone (INFO, ideal units present).

---

# S5b — Propagation + Path Solver + UX (Phases 3–4)

## Phase 3: BFS + Path Solver

### F-009. BFS Pressure Propagation

```javascript
/**
 * Propagate pressures through the network via BFS.
 * Seeds from anchors, traverses drop/passthrough/boost units.
 * Bidirectional: forward (know P_in → compute P_out) and
 * reverse (know P_out → infer P_in).
 */
function propagatePressures(scene) {
  // 1. Seed anchor pressures
  // 2. BFS queue: process each zone
  // 3. For each edge:
  //    - drop: P_out = P_in − ΔP
  //    - passthrough: P_out = P_in − k×Q² (Q from previous tick or 0)
  //    - boost: P_out = P_in + ΔP_boost
  // 4. Conflict detection at tolerance thresholds
  // 5. Write P to each port in scene.runtime
}
```

**Tolerances:**
- Conflict: `max(500 Pa, 0.5% of max(P1, P2))`
- Warning: `max(5000 Pa, 5% of max(P1, P2))`

**Mixer:** P_out = min(P_in_i). Per-inlet Q clamped ≥ 0. Warning if
inlet pressures differ by > warning tolerance. If estimated junction P
exceeds a weak source's anchor P → that inlet Q = 0 + alarm.

### F-010. Algebraic Path Solver

**Single path (closed form):**
```
Q = √( ΔP_static / (1/C + K_path) )

ΔP_static = P_source − P_sink + Σ(boost) − Σ(valve_ΔP)
C = (Cv × opening/100)² / (SG × 1e5)
K_path = Σ(k_i)
```

If ΔP_static ≤ 0 → Q = 0 + alarm.
If K_path = 0 and C → ∞ → clamp Q at maximum + WARNING.

**Parallel paths, same downstream anchor:**
```
G_i = 1/√K_i  (path conductance)
G_sum = ΣG_i
P_junction = (C × P_source + G_sum² × P_sink) / (C + G_sum²)
Q_total = √(C × (P_source − P_junction))
Q_i = (G_i / G_sum) × Q_total
```
Direct algebra. No iteration.

**Parallel paths, different downstream anchors:**
Single equation in P_junction. Monotonic. Bisection ≤ 20 iterations.
Always converges (NNG-4).

**Density correction (gas paths):**
```
SG_eff = √(SG_inlet × SG_outlet_est)
SG_outlet_est = SG_inlet × P_outlet / P_inlet
```
One multiplication. ≤10% error for P_ratio ≤ 5:1.

**Recycle loops:** Existing successive substitution. Cv/resistance
self-limits: more recycle → more total flow → more resistance → lower Q.

**Boost elements (compressor, pump):** Add to ΔP_static budget.
Compressor stamps ΔP from P_out setpoint. Exceeds capacity → overload
alarm (S2). Below minimum → surge alarm (S1 limits).

---

## Phase 4: Gating + UX

### F-011. Production Gating

```javascript
// In TimeClock step/play gate check:
const pressureErrors = AlarmSystem.getActive()
  .filter(a => a.category === 'PRESSURE' && a.severity === 'ERROR');
if (pressureErrors.length > 0) {
  // Block Step/Play, show message
  return { blocked: true, reason: pressureErrors[0].message };
}
// Simulation (Test button) always runs — never blocked
```

### F-012. Traffic Light + Canvas

- Pressure dot in traffic light: green (OK), amber (WARNING), red (ERROR)
- Non-participating units: visual indicator (dimmed pressure icon or badge)
- Optional P annotations on connections (toggle in view settings)
- Ideal-only flowsheets: pressure dot absent (no participating units)

### F-013. Connection-Time Analysis

Run `analyzePressureTopology()` when wires connect/disconnect. Show
conflicts immediately in real-time, before the user presses Simulate.

### F-014. Live Parameter Changes

Parameter edits during Play → next tick uses new values. If a param
change creates a blocking alarm → auto-pause. Topology change →
auto-pause.

### F-015. End-to-End Demo Scene

```
Reservoir(5bar, N₂) → heater(k=500) → ΔP valve(ΔP=3bar) → atmosphere_sink
Second reservoir(3bar, O₂) → mixer (both feed to same process)
Tank(finite, sealed, 0.15m³) draining over time
```

Exercises: anchor propagation, Cv flow, resistance ΔP, mixer pressure
matching, inventory depletion, safety venting.

---

## Solve Order (within one tick)

```
1. computeTankState() on all tanks/reservoirs → anchor P
2. BFS pressure propagation → zone P, path structure
3. For each reservoir/tank outlet with opening > 0:
   a. Trace path(s) to downstream anchor(s)
   b. Sum K_path, ΔP_fixed (valves, boosts)
   c. Compute ΔP_static
   d. If branching: solve P_junction (algebra or bisection)
   e. Compute Q per path. Clamp ≥ 0.
4. Set flow on each outlet port → propagate through units sequentially
5. Units tick: reactions, heat exchange, phase equilibrium
6. Update tank inventories: n += (Σn_in − Σn_out) × dt

Steps 1–3: pressure-flow layer (new).
Steps 4–5: existing sequential solver (unchanged).
Step 6: inventory integration (enhanced).
```

---

## Migration

| Current unit | Action |
|-------------|--------|
| source | Keep. Add `pressure.role = 'none'`. Deprecate in palette. |
| source_multi | Keep. `role = 'none'`. Deprecate. |
| source_air | Keep. `role = 'none'`. Deprecate. |
| sink | Keep. `role = 'none'`. |
| tank | Keep (backward compat). Add `pressure.role = 'anchor'`. Deprecate in palette in favor of reservoir. |
| valve | Keep defId. Add `pressure.role = 'drop'`. Add deltaP mode. |
| (new) reservoir | New registration. Full pressure participation. |
| (new) atmosphere_sink | New registration. Anchor at P_atm. |

**Scene import:** Map old tank port IDs if needed. Old source/sink/valve
unchanged. No defId renames.

---

## Tests (79 new)

### Phase 1 Tests (T-PS01–T-PS23)

| # | Test | Assert |
|---|------|--------|
| 01 | computeTankState: pure N₂ gas | P ≈ nRT/V |
| 02 | computeTankState: pure H₂O liquid 300K | V_liq ≈ V, P high |
| 03 | computeTankState: H₂O + N₂ mix | liquid water, N₂ in headspace |
| 04 | computeTankState: empty | P ≈ 0, level = 0 |
| 05 | computeTankState: overfull | clamped, CATASTROPHIC |
| 06 | computeTankState: deterministic | same input → same output |
| 07 | Reservoir: liq_out draws liquid only | n_out ⊆ n_L |
| 08 | Reservoir: vap_out draws vapor only | n_out ⊆ n_V |
| 09 | Reservoir: no liquid → liq_out Q = 0 | INFO alarm |
| 10 | Reservoir: no vapor → vap_out Q = 0 | INFO alarm |
| 11 | Reservoir: sealed P from headspace | P = computeTankState().P_Pa |
| 12 | Reservoir: vented P = P_atm | P = atmosphere.P_Pa |
| 13 | Reservoir: reservoir mode P constant | P unchanged after flow |
| 14 | Reservoir: Cv opening=0 → Q=0 | zero flow |
| 15 | Reservoir: Cv opening=100, ΔP=4bar | Q matches Cv equation |
| 16 | Reservoir: vent on P > P_design | WARNING |
| 17 | Reservoir: overflow on level > max | WARNING |
| 18 | Reservoir: CATASTROPHIC if vent unconnected | severity check |
| 19 | Reservoir: inventory integration | n changes with dt |
| 20 | Reservoir: volume > 1000 rejected | param validation |
| 21 | atmosphere_sink: anchor at P_atm | P = P_atm |
| 22 | atmosphere_sink: tracks preset change | P updates |
| 23 | atmosphere_sink: two in zone no conflict | no ERROR |

### Phase 2 Tests (T-PS24–T-PS43)

| # | Test | Assert |
|---|------|--------|
| 24 | All units have pressure.role | sweep all registrations |
| 25 | Roles match spec table | automated comparison |
| 26 | HEX: k > 0, ΔP increases with Q | ΔP = k × Q² |
| 27 | Reactor: k > 0 | default 5000 |
| 28 | Mixer: k = 0 | no resistance |
| 29 | k=0 gives same behavior as pre-S5 | regression |
| 30 | Valve Pout: P_in > target | P_out = target |
| 31 | Valve Pout: P_in < target → INFO | alarm fires |
| 32 | Valve deltaP: normal | P_out = P_in − ΔP |
| 33 | Valve: reverse flow → Q = 0 | alarm fires |
| 34 | Valve: isenthalpic H_out = H_in | enthalpy check |
| 35 | Valve: regression vs existing tests | all pass |
| 36 | UnionFind: find/union/components | basic correctness |
| 37 | Connected ports share zone | same component |
| 38 | Unconnected = separate zones | different components |
| 39 | Passthrough: in/out different nodes | structural check |
| 40 | Two anchors same P: no conflict | OK |
| 41 | Two anchors diff P: conflict ERROR | alarm |
| 42 | Source (role=none) in anchored zone: INFO | info-only |
| 43 | Floating zone: no error | passes clean |

### Phase 3 Tests (T-PS44–T-PS64)

| # | Test | Assert |
|---|------|--------|
| 44 | Chain: tank(5bar)→valve(ΔP=3)→sink | P correct through chain |
| 45 | Reverse inference through valve | P_in inferred from P_out |
| 46 | Boost: pump propagation | P_out = P_in + ΔP |
| 47 | Conflict: two tanks, different P | ERROR alarm |
| 48 | Floating: all unknown, no errors | clean run |
| 49 | Passthrough k>0: ΔP depends on Q | ΔP = k×Q² |
| 50 | HEX: hot/cold independent | separate zones |
| 51 | Mixer: warning on large P mismatch | WARNING |
| 52 | Mass/energy balance unchanged | regression |
| 53 | Single path: Q matches closed-form | algebraic equation |
| 54 | Single path with boost | compressor adds to budget |
| 55 | Single path with valve | valve consumes budget |
| 56 | ΔP_static ≤ 0: Q=0 + alarm | check |
| 57 | Branching same anchor: proportional | G_i split |
| 58 | Branching diff anchors: bisection | converges |
| 59 | Merge: independent sources, mixer sums | Q_total = ΣQ_i |
| 60 | Mixer backflow: weak source Q=0 | alarm |
| 61 | Cv=0 (closed): Q=0 | zero |
| 62 | Zero resistance path: Q clamped | WARNING |
| 63 | Density correction applied | SG_eff used |
| 64 | Finite tank draining: Q decreases | P drops over dt |

### Phase 4 Tests (T-PS65–T-PS79)

| # | Test | Assert |
|---|------|--------|
| 65 | Step blocked on pressure ERROR | blocked = true |
| 66 | Step OK on WARNING | blocked = false |
| 67 | Play blocked on ERROR | auto-pause |
| 68 | Test (simulate) always runs | never blocked |
| 69 | Traffic light green/amber/red | correct states |
| 70 | Ideal-only flowsheet: pressure dot absent | no dot |
| 71 | Non-participating unit: visual indicator | badge present |
| 72 | Change valve ΔP during Play | next tick uses new value |
| 73 | Change creates blocking alarm → auto-pause | paused |
| 74 | Topology change → auto-pause | paused |
| 75 | Demo scene runs clean | no errors |
| 76 | Export/import round-trip | pressure data preserved |
| 77 | All units × reservoir: no crash | sweep |
| 78 | Performance: 30 units < 50ms | timing check |
| 79 | Full regression | all previous + 79 new |

**Gate:** All previous (355) + 79 new pass → 434 cumulative.

---

## Implementation Checklist

```
S5a session 1 (computeTankState):
  [ ] computeTankState() pure function (Block 1)
  [ ] Species classification (condensable vs permanent)
  [ ] Liquid volume from density
  [ ] Headspace pressure from ideal gas
  [ ] Edge cases: empty, overfull, all-liquid
  [ ] Tests T-PS01–T-PS06

S5a session 2 (reservoir unit):
  [ ] reservoir registration (5 ports, presentations)
  [ ] initParams, initInventory, updateInventory
  [ ] Phase-constrained outlets (liq_out, vap_out)
  [ ] Safety ports (vent, overflow) with severity logic
  [ ] Cv flow equation in tick
  [ ] Pressure anchor logic (sealed/vented/reservoir)
  [ ] Inspector (params, kpis, power sections)
  [ ] Palette presets (4 variants)
  [ ] Tests T-PS07–T-PS20

S5a session 3 (atmosphere_sink + roles):
  [ ] atmosphere_sink registration
  [ ] Pressure role declarations on ALL units (22+)
  [ ] k resistance parameter on passthrough units
  [ ] Tests T-PS21–T-PS29

S5a session 4 (network structure):
  [ ] UnionFind class
  [ ] buildPressureNodes()
  [ ] analyzePressureTopology()
  [ ] Valve enhancement (deltaP mode, reverse flow check)
  [ ] Tests T-PS30–T-PS43

S5b session 1 (BFS propagation):
  [ ] propagatePressures() with BFS
  [ ] Bidirectional traversal (forward + reverse inference)
  [ ] Conflict detection at tolerance thresholds
  [ ] Mixer P_out = min(P_in_i) logic
  [ ] Tests T-PS44–T-PS52

S5b session 2 (path solver):
  [ ] Single-path algebraic solver
  [ ] Parallel paths same anchor (conductance algebra)
  [ ] Parallel paths diff anchors (bisection ≤ 20 iter)
  [ ] Merge/mixer backflow detection
  [ ] Density correction (SG_eff)
  [ ] Pressure AlarmSystem source (NNG-14 messages)
  [ ] Tests T-PS53–T-PS64

S5b session 3 (gating + UX + integration):
  [ ] Production gating (Step/Play blocked on ERROR)
  [ ] Traffic light pressure dot
  [ ] Non-participating unit visual indicator
  [ ] Connection-time topology analysis
  [ ] Live parameter → re-solve + auto-pause
  [ ] Demo scene (reservoir→heater→valve→atmosphere_sink)
  [ ] Performance check (30 units < 50ms)
  [ ] Export/import round-trip with pressure data
  [ ] Full regression
  [ ] Tests T-PS65–T-PS79

Total S5: 79 new tests → 434 cumulative
```

---

## What This Model Cannot Do (NNG-4 Trade-offs)

| Limitation | Mitigation |
|-----------|-----------|
| No compressor curve intersection | S1 equipment limit alarms: Q < surge, Q > choke |
| Density: geometric mean approx | ≤10% error at P_ratio ≤ 5:1 |
| No pressure transients | Out of scope permanently |
| ΔP valve doesn't interact with Cv | Clear alarm on budget overrun |

These are permanent trade-offs. The algebraic model always computes,
always converges, always gives qualitatively correct results.

---

## What S5 Enables Downstream

| Consumer | What it uses from S5 |
|----------|---------------------|
| S7 (Perf Maps) | Reservoir P vs level curves; Cv flow vs opening maps |
| S8 (Game) | All missions: reservoir replaces magic sources, Cv gives player flow control, pressure network enforces physical coherence |
