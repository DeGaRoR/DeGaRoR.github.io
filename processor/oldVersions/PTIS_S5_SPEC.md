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

**Sub-sessions:** S5a (4), S5b (3), S5c (1) — 8 sessions total.

**Risk:** High. Largest stage by scope. Core architectural change to
how flow originates. Mitigated by algebraic-only solver (no iteration),
phase-gated rollout, and 91 dedicated tests.

**Dependencies:** S3 (PR liquid density for `computeTankState` headspace
calculation). S1 (alarm infrastructure for pressure alarms). S2
(`allocateByPriority()` utility reused by S5c splitter manifold).

**Required by:** S8 (game missions use reservoir + Cv for player-designed
flow control). S5c splitter manifold on critical path to S8.

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
- PlanetRegistry with T_amb(t) sinusoidal diurnal model
- Splitter manifold (N-port, ratio + flow_controlled modes)
- Mixer manifold (N-port passive)
- `allocateByPriority()` reused from S2 for flow curtailment
- ~443 tests (352 + 91 new)

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

**Floating zone rule:** When a pressure zone contains no anchors (all
connected units have `role = 'none'`), the pressure-flow layer is
skipped entirely for that zone. Flow originates from source tick
functions exactly as in pre-S5: each source stamps Q on its outlet,
and the sequential solver propagates it through downstream units
unchanged. A floating zone produces an INFO alarm ("No pressure
anchor — using ideal flow") but never blocks Step/Play. An
all-ideal flowsheet (source → process units → sink) runs identically
to v12 behavior. This is the backward-compatibility guarantee.

**Zone boundary at role=none interfaces:** BFS pressure propagation
stops when it reaches a port whose wire connects to a `role = 'none'`
unit. That port becomes an open boundary of the pressure zone.
Consequences:

- **Ideal source feeding a pressure zone:** The source tick stamps Q.
  The pressure solver does not compute Q for that inlet — it accepts
  the source-stamped value as an external feed. ΔP across downstream
  passthrough units is computed from that Q (for display and alarms)
  but does not override the stamped flow. If the resulting pressure
  at the zone's anchor conflicts with the stamped flow's implied
  pressure, an INFO alarm notes the inconsistency but flow proceeds.
  This lets players prototype with ideal sources before graduating
  to reservoirs.
- **Pressure zone feeding an ideal sink:** The path solver computes Q
  to the zone boundary. The ideal sink accepts whatever arrives. No
  anchor needed on the sink side.
- **Mixed flowsheet:** Each zone is solved independently. Ideal zones
  use stamped flow. Pressure zones use the algebraic solver. The two
  never interfere.

**Per-zone isolation on errors:** If a pressure zone has an
unresolvable conflict (multiple anchors at incompatible pressures),
that zone's flow is set to zero on all paths within it, with ERROR
alarms on each affected connection. **Other zones solve normally.**
The player can still Step to observe healthy parts of the flowsheet
while debugging the broken zone. Test (Simulate) always runs
regardless of errors in any zone.

---

## Network Invariants (Acceptance Criteria)

These invariants hold after every solver tick. Every invariant maps
to specific tests. S5 is not complete until all pass.

**INV-1. Non-negative flow.** Every material flow ≥ 0. Backflow is
never computed — it is detected, zeroed, and alarmed.
*Tests: T-PS33 (reverse flow), T-PS60 (mixer backflow)*

**INV-2. No silent clamping.** Every flow forced to zero by the
pressure network produces a visible alarm stating the cause. Causes
include: backflow (P_out > P_in), pressure conflict (two anchors
disagree), empty vessel (no liquid/vapor), zero-resistance path
(Q clamped), insufficient ΔP (ΔP_static ≤ 0), and closed valve
(opening = 0).
*Tests: T-PS09, T-PS10 (empty vessel), T-PS14 (closed valve),
T-PS31 (valve P_in < target), T-PS33 (reverse), T-PS41/T-PS47
(conflicts), T-PS56 (ΔP ≤ 0), T-PS60 (mixer backflow), T-PS62
(zero resistance)*

**INV-3. Single anchor per zone.** Every pressure zone has exactly
one anchor pressure, or an ERROR alarm fires identifying the
conflict.
*Tests: T-PS41, T-PS47 (conflict detection)*

**INV-4. Conservation.** Mass balance closes across the pressure
network. Total mass in = total mass out + accumulation, within
tolerance.
*Tests: T-PS75 (demo scene clean), T-PS79 (full regression)*

**INV-5. Bounded time.** No pressure-flow iteration. Every topology
solves in O(n) BFS + O(paths) algebra. Deterministic results.
*Tests: T-PS78 (30 units < 50ms)*

**INV-6. Backward compatibility.** Any flowsheet that uses only
`role = 'none'` units (sources, sinks, process units without
reservoirs) produces bit-identical output to the pre-S5 solver.
The pressure-flow layer is transparent — it adds capability without
changing existing behavior. All 352 pre-S5 tests pass unchanged.
*Tests: T-PS43 (floating zone stamped Q), T-PS48 (pressure layer
skipped), T-PS80–T-PS82 (ideal-only regression), T-PS87 (full
pre-S5 regression gate)*

---

## Phased Rollout

The spec is implemented in 5 phases within 2 sub-sessions:

| Phase | Scope | Features | Tests |
|-------|-------|----------|-------|
| 1 | Vessel | computeTankState, reservoir, atmosphere_sink | T-PS01–T-PS23 (23) |
| 2 | Network structure | Pressure roles, k resistance, valve enhancement, UnionFind, topology analysis | T-PS24–T-PS43 (20) |
| 3 | Propagation + solver | BFS, algebraic path solver, branching, density correction | T-PS44–T-PS64 (21) |
| 4 | Gating + UX | Per-zone isolation, traffic light, connection-time analysis, demo scene | T-PS65–T-PS79 (15) |
| 5 | Backward compat + isolation | Ideal-only regression, mixed flowsheets, per-zone isolation | T-PS80–T-PS87 (8) |

**S5a** covers Phases 1–2 (4 sessions). **S5b** covers Phases 3–5 (3 sessions).

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
| splitter_manifold | passthrough | 0 | mat_in→out1..outN |
| mixer_manifold | passthrough | 0 | in1..inN→mat_out |
| flash_drum | passthrough | 100 | mat_in→vap_out,liq_out |
| membrane_separator | passthrough | 500 | mat_in→perm_out,ret_out |
| reactor_adiabatic | passthrough | 5000 | mat_in→mat_out |
| reactor_jacketed | passthrough | 5000 | mat_in→mat_out |
| reactor_cooled | passthrough | 5000 | mat_in→mat_out, cool_in→cool_out |
| reactor_electrochemical | passthrough | 5000 | mat_in→mat_out_cat,mat_out_ano |
| fuel_cell | passthrough | 5000 | mat_in_cat,mat_in_ano→mat_out, cool_in→cool_out |
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
Multiple anchors at different P → conflict ERROR (per-zone isolation:
flow zeroed in this zone only, other zones unaffected — see Design
Principles §Per-zone isolation).
No anchors → floating zone (INFO, ideal units present — pressure-flow
layer skipped, source-stamped Q used, see §Floating zone rule).

**Zone boundary detection:** `buildPressureNodes` only creates nodes
for ports on participating units (`role !== 'none'`). Wires to
`role = 'none'` units are recorded as boundary edges. For each
boundary edge, the analysis returns:
- `boundaryFeeds`: Map of zone → list of `{ port, direction: 'in'|'out' }`
  identifying where ideal sources inject flow into or ideal sinks
  extract flow from the zone.

The path solver uses `boundaryFeeds` to accept source-stamped Q at
inlet boundaries and terminate paths at outlet boundaries.

---

## S5a — PlanetRegistry (Ambient Conditions)

Planet-level ambient conditions used by air_cooler (T_approach
referenced to T_amb), room wall conduction (UA × (T_room − T_amb)),
and future atmospheric intake units.

```javascript
PlanetRegistry.register('planet_x', {
  name: 'Planet X',
  atmosphere: {
    composition: { N2: 0.693, O2: 0.208, CO2: 0.0792,
                   Ar: 0.0099, H2O: 0.0095 },
    P_surface_Pa: 89750,
    T_mean_K: 288
  },
  diurnal: {
    enabled: true,
    amplitude_K: 10,
    period_s: 86400,
    noise_K: 2
  }
});
```

**T_amb(t) model:**

```
T_amb(t) = T_mean + A × sin(2π × t / t_day) + noise(t)
```

| Parameter | Value |
|-----------|-------|
| T_mean | 288 K |
| Amplitude | 10 K |
| Range | 278–298 K (never freezing) |
| Period | 24 hr game-time |
| Noise | ±2 K random walk, capped |

**Toggle:** `diurnal.enabled`. Campaign: on. Sandbox: off by
default (fixed T_amb for debugging).

**Planet registry is not vent data.** Vents are mission-specific
`reservoir` units defined in mission data (see `PTIS_COMPOSITE_MODELS.md`
§6). Planet conditions are global ambient state.

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
 * Stops at zone boundaries (ports wired to role='none' units).
 * Skips floating zones entirely (no anchors → source-stamped flow).
 */
function propagatePressures(scene) {
  // 1. Seed anchor pressures
  // 2. For each zone:
  //    - If zone has no anchors (floating): skip. Mark as floating.
  //    - If zone has conflicting anchors: zero all flows, ERROR alarms.
  //      Do NOT propagate BFS in this zone — other zones unaffected.
  // 3. BFS queue: process each healthy zone
  // 4. For each edge:
  //    - drop: P_out = P_in − ΔP
  //    - passthrough: P_out = P_in − k×Q² (Q from previous tick or 0)
  //    - boost: P_out = P_in + ΔP_boost
  //    - boundary edge (to role=none): stop. Do not propagate beyond.
  // 5. Conflict detection at tolerance thresholds
  // 6. Write P to each port in scene.runtime
  //    (floating zone ports: P = undefined, not displayed)
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

**Per-zone isolation (not global blocking).** A pressure ERROR in one
zone does not block the entire flowsheet. The solver handles broken
zones by zeroing their flow and raising ERROR alarms. Healthy zones
solve normally. The player can Step/Play to observe the working parts
while debugging the broken zone.

```javascript
// In propagatePressures(), per zone:
if (zone.hasConflict) {
  zone.paths.forEach(p => p.Q = 0);
  zone.units.forEach(u => AlarmSystem.raise(u.id, {
    category: 'PRESSURE', severity: 'ERROR',
    message: `Pressure conflict in zone: ${zone.conflictDescription}`
  }));
  // This zone is dead — other zones proceed normally.
}
// Floating zones (no anchors) are not errors — skip pressure layer,
// source-stamped flow proceeds in sequential solver step.
```

**Step/Play is only blocked by CATASTROPHIC alarms** (e.g., overfull
vessel, structural integrity). Pressure ERRORs are serious but
survivable — the affected zone has zero flow, which the player can
see and fix.

**Test (Simulate) always runs** — never blocked by any alarm severity.
This is the player's diagnostic tool.

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
   - Floating zones (no anchors): skip. Mark as floating.
   - Conflicting zones: zero all flows in zone, ERROR alarms.
     Other zones unaffected.
   - Boundary edges (to role=none units): BFS stops at boundary.
3. For each reservoir/tank outlet with opening > 0:
   a. Trace path(s) to downstream anchor(s) or boundary
   b. Sum K_path, ΔP_fixed (valves, boosts)
   c. Compute ΔP_static
   d. If branching: solve P_junction (algebra or bisection)
   e. Compute Q per path. Clamp ≥ 0.
   f. At inlet boundaries: accept source-stamped Q as external feed.
4. Set flow on each outlet port → propagate through units sequentially
   - Floating zones: sources stamp Q here (pre-S5 behavior, unchanged)
   - Pressure zones: Q already computed in step 3
5. Units tick: reactions, heat exchange, phase equilibrium
6. Update tank inventories: n += (Σn_in − Σn_out) × dt

Steps 1–3: pressure-flow layer (new). Skipped for floating zones.
Steps 4–5: existing sequential solver (unchanged). Handles all zones.
Step 6: inventory integration (enhanced).
```

**Key guarantee:** For an all-ideal flowsheet (every zone floating),
steps 1–3 do nothing. The tick reduces to steps 4–5–6, which is
exactly the pre-S5 solver. Output is bit-identical to v12.

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

**"Deprecate in palette" means:**

- **Campaign mode:** Sources/sinks hidden from palette. Missions use
  reservoir + atmosphere_sink exclusively. Old scenes containing sources
  still load and work (backward compat) but new placements are blocked.
- **Sandbox mode:** Sources/sinks remain visible in the palette with an
  "ideal" badge (dimmed border, italic label). They are grouped under
  an "Ideal / Legacy" subsection at the bottom of the relevant category.
  Reservoir and atmosphere_sink appear above them as the recommended
  defaults.
- **Old tank:** Same treatment — visible in sandbox with "legacy" badge,
  hidden in campaign. Reservoir is the recommended replacement.

This ensures sandbox users always have access to ideal units for quick
prototyping and debugging, while campaign players experience the
pressure-driven design from the start.

---

## Tests (87 new)

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
| 43 | Floating zone: source-stamped Q flows | source→heater→sink: Q, T, H identical to pre-S5 |

### Phase 3 Tests (T-PS44–T-PS64)

| # | Test | Assert |
|---|------|--------|
| 44 | Chain: tank(5bar)→valve(ΔP=3)→sink | P correct through chain |
| 45 | Reverse inference through valve | P_in inferred from P_out |
| 46 | Boost: pump propagation | P_out = P_in + ΔP |
| 47 | Conflict: two tanks, different P | ERROR alarm |
| 48 | Floating zone: pressure layer skipped, sequential solver runs | steps 1–3 produce no Q; step 4–5 source stamps Q; output identical to no-S5 baseline |
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
| 65 | Step NOT blocked on pressure ERROR | per-zone: broken zone Q=0, healthy zones run |
| 66 | Step OK on WARNING | blocked = false |
| 67 | Play NOT blocked on pressure ERROR | per-zone isolation, auto-pause only on CATASTROPHIC |
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

### Phase 5 Tests (T-PS80–T-PS87) — Backward Compatibility & Zone Isolation

| # | Test | Assert |
|---|------|--------|
| 80 | Ideal-only: source(N₂)→heater(+50K)→sink | Q, T_out, H_out bit-identical to pre-S5 baseline |
| 81 | Ideal-only: source→splitter→2×heater→mixer→sink | all streams identical to pre-S5 |
| 82 | Ideal-only: source→reactor_adiabatic(R_SABATIER)→flash→sink | conversion, phase split identical to pre-S5 |
| 83 | Mixed: source(role=none)→heater(k=500)→reservoir(anchor) | source stamps Q; heater ΔP computed for display; reservoir accepts flow; no ERROR |
| 84 | Mixed: reservoir(anchor)→valve→sink(role=none) | path solver computes Q to boundary; sink accepts; no ERROR |
| 85 | Per-zone isolation: zone A conflict, zone B healthy | zone A: Q=0, ERROR alarms. zone B: Q correct, no alarms. Step runs. |
| 86 | Per-zone isolation: zone A floating + zone B anchored | zone A: source-stamped Q. zone B: solver Q. Both run simultaneously. |
| 87 | All 352 pre-S5 tests pass unchanged | zero-delta regression gate |

**Gate (S5a+S5b):** All previous (352) + 87 new pass → 439 cumulative.
All six network invariants (INV-1 through INV-6) verified by
mapped tests above. S5c adds 4 more → 443 total.

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
  [ ] Per-zone isolation (conflict → zero flow in zone, others unaffected)
  [ ] Zone boundary detection (BFS stops at role=none interfaces)
  [ ] Floating zone skip (no anchors → source-stamped Q, no pressure layer)
  [ ] Traffic light pressure dot (per-zone: green/amber/red)
  [ ] Non-participating unit visual indicator ("ideal" badge)
  [ ] Connection-time topology analysis
  [ ] Live parameter → re-solve + auto-pause on CATASTROPHIC only
  [ ] Demo scene (reservoir→heater→valve→atmosphere_sink)
  [ ] Performance check (30 units < 50ms)
  [ ] Export/import round-trip with pressure data
  [ ] Backward compat regression (T-PS80–T-PS82, T-PS87)
  [ ] Mixed flowsheet tests (T-PS83–T-PS84)
  [ ] Per-zone isolation tests (T-PS85–T-PS86)
  [ ] Tests T-PS65–T-PS87

S5a extra (PlanetRegistry):
  [ ] PlanetRegistry.register() with atmosphere, diurnal params
  [ ] T_amb(t) computation: sinusoidal + noise
  [ ] Diurnal toggle (campaign on, sandbox off)
  [ ] air_cooler references T_amb from PlanetRegistry

S5c session (manifolds):
  [ ] splitter_manifold registration (N-port, dynamic outlets)
  [ ] ratio mode (existing splitter behavior, N outlets)
  [ ] flow_controlled mode with Q_setpoints
  [ ] Curtailment via allocateByPriority() from S2
  [ ] mixer_manifold registration (N-port passive)
  [ ] Inspector for both manifolds
  [ ] Tests S5c-1 through S5c-4

Total S5: 91 new tests → 443 cumulative
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

# S5c — Splitter/Mixer Manifold + Flow Control (1 session)

**Session:** 1. On critical path: S5b → S5c → S8.

**Dependencies:** S2 (`allocateByPriority()` utility). S5b (pressure
network operational).

## S5c-1. Splitter Manifold

N-outlet (2–10) splitter with two operating modes:

| Mode | Behavior | Outlet config |
|------|----------|---------------|
| `ratio` (existing) | Fixed split fractions, ΣR = 1.0 | `ratio` per outlet (0–1) |
| `flow_controlled` (new) | N−1 outlets have Q setpoints, last gets remainder | `Q_setpoint` (mol/s), `priority` (int 1–10), `isRemainder` (bool) |

**Curtailment** when Σ(Q_setpoints) > Q_total: uses
`allocateByPriority()` from S2 with either 'proportional' or
'priority' strategy. The remainder outlet receives
Q_total − Σ(allocated). If negative, remainder = 0.

**No pressure iteration.** Consistent with S5 architecture: Cv
valves only inside tanks, dP valves everywhere else.

**Registration:**

```javascript
UnitRegistry.register('splitter_manifold', {
  name: 'Splitter Manifold',
  category: UnitCategories.TOPOLOGY,
  w: 2, h: 2,
  ports: [
    { portId: 'mat_in', label: 'Feed', dir: PortDir.IN, type: StreamType.MATERIAL, x: 0, y: 1 },
    // Outlets created dynamically based on params.outlets (2–10)
    // Default: 2 outlets at registration
  ],
  // Dynamic port generation handled by outletCount param
});
```

**Campaign progression:**

| Mission | Equipment | Capability |
|---------|-----------|-----------|
| M3 | `splitter` (simple 2-outlet tee) | Ratio mode only |
| M7 | `splitter_manifold` (N outlets, flow control) | flow_controlled + priority curtailment |

## S5c-2. Mixer Manifold

N-inlet (2–10) mixer merging into 1 outlet. Purely passive. Flows
merge at common node pressure. Enthalpy-averaged T. Molar-averaged
composition.

```javascript
UnitRegistry.register('mixer_manifold', {
  name: 'Mixer Manifold',
  category: UnitCategories.TOPOLOGY,
  w: 2, h: 2,
  ports: [
    // Inlets created dynamically based on params.inlets (2–10)
    { portId: 'mat_out', label: 'Out', dir: PortDir.OUT, type: StreamType.MATERIAL, x: 2, y: 1 }
  ]
});
```

## S5c-3. Naming Convention

All units simulating control loops use consistent mode names:

| Unit | Mode name | What it controls |
|------|-----------|-----------------|
| compressor | `pressure_controlled` | Outlet P |
| pump | `pressure_controlled` | Outlet P |
| valve | `pressure_controlled` | Outlet P |
| splitter_manifold | `flow_controlled` | Outlet Q |
| heater | `temperature_controlled` | Outlet T |
| air_cooler | `temperature_controlled` | Outlet T |

## S5c Tests (~4)

| # | Test | Setup | Assert |
|---|------|-------|--------|
| 1 | Ratio mode: 3 outlets, 30/30/40 | 1 mol/s feed | Outlets: 0.3, 0.3, 0.4 mol/s |
| 2 | Flow controlled: excess supply | Q_set [0.3, 0.5], feed=1.0 | Out1=0.3, Out2=0.5, remainder=0.2 |
| 3 | Flow controlled: curtailment | Q_set [0.6, 0.6], feed=1.0, strategy=proportional | Each gets 0.5 |
| 4 | Mixer manifold: 3 inlets | Three different feeds | Mass balance, H conserved |

**Gate:** All previous S5a+S5b (439) + 4 new → 443 cumulative.

---

## What S5 Enables Downstream

| Consumer | What it uses from S5 |
|----------|---------------------|
| S7 (Perf Maps) | Reservoir P vs level curves; Cv flow vs opening maps |
| S8 (Game) | All missions: reservoir replaces magic sources, Cv gives player flow control, pressure network enforces physical coherence. Splitter manifold (S5c) provides flow distribution for M7+ recycle loops. |
| S10 (Biosphere) | PlanetRegistry T_amb(t) drives room wall conduction and air_cooler T_approach |
