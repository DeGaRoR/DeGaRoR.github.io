# processThis — Pressure & Flow Specification
# Version 7.0 — 2026-02-21
# Baseline: processThis v12.10.0 (289 tests, 1810 assertions)
# Supersedes: RELEASESPEC_pressure_path v6.0


═══════════════════════════════════════════════════════════════════
SECTION A — DESIGN
═══════════════════════════════════════════════════════════════════

## A1. Summary

Pressure is currently decorative — values exist but don't drive flow.
This spec makes pressure real: tanks compute headspace P, a pressure
network propagates it, and flow emerges from ΔP through Cv restrictions
on vessel outlets. No user types a flow rate in engineering mode.

## A2. Philosophy

  - Physics as playground, not prison
  - Let the player do anything within physical laws
  - Compromises on accuracy are fine; compromises on fundamentals are not
  - Values may not be exact, but they're always in the right ballpark
  - No convergence nightmares, no alarm floods, no PhD required
  - Blunt refusal to run is a last resort, not a first response
  - The system ALWAYS produces a result

The result is a simulator that's CONVINCING — not Aspen-accurate, but
never physically absurd. An underpressured valve warns you; it doesn't
crash. An impossible configuration explains WHY and suggests a fix.

## A3. Core Concepts

### Flow from pressure, not from user input

All flow originates from pressure difference through resistance. In
engineering mode, no unit stamps a flow rate from user input. The player
designs systems by choosing vessel sizes, valve openings, and routing.
The flow rate is a consequence, not an input.

    Old model:  User types rate → flow propagates → pressure checked after
    New model:  Anchors set P → path resistance computed → Q = f(ΔP, Cv, k)

### NNG-17: No Flow-Pressure Iteration

Flow through Cv restrictions is computed algebraically from anchor
pressures, path resistances, and ΔP budgets. The solver never iterates
between flow and pressure fields. Every topology computes in bounded
time with deterministic results. The solver never refuses to compute
or fails to converge. This is a permanent architectural constraint.

### The realism ladder

Realism emerges from unit choice:

  IDEAL (pressure opt-out):
    source, sink — magic faucet and drain. User stamps P/T/rate.
    They don't participate in pressure. Training wheels for learning.
    Future missions may restrict or remove them.

  ENGINEERING (pressure participating):
    Reservoir/tank, ΔP valve, atmosphere_sink, pump, compressor, and
    all process units. These have real pressure behavior. A sealed
    tank computes P from contents. Cv on outlet ports determines flow.
    The pressure network enforces consistency.

Ideal and engineering units can coexist. Ideal units opt out — they
don't break the pressure network, they just don't participate. A
visual indicator on the canvas marks non-participating units.

No renames. Existing defIds stay. The visual indicator replaces the
"Ideal [X]" naming convention from the previous spec.

### Simulation vs Production

  SIMULATION (Test button):
    Computes everything. Shows everything. Blocks nothing.
    Clock does NOT advance. No accumulation. Pressure conflicts
    shown as indicators but don't block. Sandbox for debugging.

  PRODUCTION (Step / Play):
    Clock advances. Tanks fill/drain. Physical coherence required.
    Pressure ERROR blocks Step/Play. Must fix before advancing.

### Implicit check valves

All flows clamp ≥ 0 at every point. No unit produces negative flow.
Mixers clamp each inlet independently. Reservoir outlets clamp at 0
when ΔP_net ≤ 0. ΔP valves zero flow on reverse gradient. Backflow
is detected, zeroed, and alarmed — never computed.

This is physically correct: every real piping header has check valves.
The model integrates them implicitly rather than requiring a separate
check valve unit.


## A4. Unit Inventory

### Reservoir (enhanced tank)

Single unit, two modes. Replaces: current tank, source, source_multi,
source_air, atmosphere_source. Existing defIds preserved until
retirement — reservoir is the new registration, old units stay but
are deprecated in the palette.

    Mode          Inventory    P source              Use case
    ─────────── ─────────── ──────────────────────── ──────────────
    Finite       depletes     computeTankState()      Physical vessel
    Reservoir    infinite     user P or P_atm         Gas supply, atmosphere

Five ports:

    Port           Dir    Phase      Cv    Notes
    ──────────── ────── ────────── ───── ──────────────────────────
    feed_in        IN     Any        —    Passive receiver
    liq_out        OUT    Liq only   Yes  Draws from liquid inventory
    vap_out        OUT    Vap only   Yes  Draws from vapor headspace
    overflow       OUT    Liq        —    Safety: high level
    vent           OUT    Vap        —    Safety: high pressure

### ΔP Valve

Two ports (in, out). Sets P_out or ΔP. Does not determine flow —
consumes pressure budget. Isenthalpic, PH-flash on outlet.
Pressure role: drop.

Replaces: current valve (same defId, enhanced with pressure role).

### Atmosphere Sink

Absorbs all inflow. Pressure anchor at P_atm. One port (mat_in).
Unchanged from previous spec.

### Source / Sink (existing, kept)

Training wheels. pressure.role = 'none'. No Cv, no pressure network.
User stamps rate. Visual indicator on canvas shows non-participation.
Not renamed. May be restricted or retired by missions.

### Process Units (passthrough)

Every process unit declares resistance coefficient k and optional
fixed ΔP_min:

    ΔP_unit = ΔP_min + k × Q²

    Unit               k default  ΔP_min  Role          Port pairs
    ────────────────── ────────── ─────── ──────────── ───────────────
    Heater              500        0       passthrough   mat_in → mat_out
    Cooler              500        0       passthrough   mat_in → mat_out
    HEX (hot side)      1e3        0       passthrough   hot_in → hot_out
    HEX (cold side)     1e3        0       passthrough   cold_in → cold_out
    Mixer               0          0       passthrough   in1,in2 → out
    Splitter            0          0       passthrough   mat_in → out1,out2
    Flash drum          100        0       passthrough   mat_in → vap,liq
    Reactor (equil.)    5e3        0       passthrough   mat_in → mat_out
    Reactor (kinetic)   5e3        0       passthrough   mat_in → mat_out
    Column              1e4        0       passthrough   (per S4 spec)

    Pump                0          0       boost         mat_in → mat_out
    Compressor          0          0       boost         mat_in → mat_out
    Gas turbine         0          0       drop          mat_in → mat_out

    Battery             —          —       none          —
    Grid supply         —          —       none          —
    Source mechanical    —          —       none          —

k units: Pa·s²/mol². Defaults are pilot-plant order-of-magnitude,
tuned alongside S1 equipment limits. Player-adjustable (inspector,
advanced section, collapsed by default).


## A5. Non-Negotiable Rules

All 16 NNGs from previous spec remain. Add:

  17. No flow-pressure iteration. Flow from Cv is algebraic from
      anchor pressures. The solver never iterates ΔP↔Q. Every
      topology always produces a result.
  18. Implicit check valves. All flows ≥ 0 everywhere. Backflow
      detected, zeroed, alarmed — never computed.


## A6. What's Excluded (permanently, per NNG-17)

  - Full flow-pressure coupling (Newton-Raphson on network)
  - Compressor operating point from head-vs-flow curve intersection
  - Pressure transients (water hammer, startup dynamics)
  - PID controllers (future addition on top of Cv, not in this spec)


═══════════════════════════════════════════════════════════════════
SECTION B — IMPLEMENTATION
═══════════════════════════════════════════════════════════════════

## B1. Reservoir Parameters

    key                 default  min          max      notes
    ──────────────────────────────────────────────────────────────
    volume_m3           0.15     0.001        1000     ∞ in reservoir mode
    tankMode            'sealed' enum: sealed/vented
    reservoirMode       false    bool                  true = infinite
    T_K                 298.15   50           2000
    composition         {}       species map           mol fractions
    P_charge_bar        —        0.1          200      sealed reservoir init P
    liq_Cv              50       0.1          10000    outlet valve sizing
    liq_opening_pct     0        0            100      0 = closed
    vap_Cv              50       0.1          10000
    vap_opening_pct     0        0            100
    P_design_bar        10       1            100
    P_rupture_bar       15       P_design+0.5 200
    maxLiqLevel_pct     90       50           99

### Safety behavior

    VENT:
      P > P_design:  connected → WARNING  |  unconnected → ERROR
      P > P_rupture: connected → WARNING  |  unconnected → CATASTROPHIC

    LIQ_OVERFLOW:
      level > max:   connected → WARNING  |  unconnected → ERROR
      level = 100%:  connected → WARNING  |  unconnected → CATASTROPHIC

### computeTankState(n, T_K, V_total, thermo)

    Pure function. No side effects. Exported on PG.
    1. Classify species: condensable (T < 0.9×Tc) vs permanent gas
    2. Liquid volume: V_liq = Σ(n_cond × MW / ρ_liq) from ThermoAdapter
    3. V_headspace = max(0, V_total − V_liq)
    4. VLE on condensable: Raoult (or PR after S3) → n_V_condensable
    5. P_headspace = (n_permanent + n_V_condensable) × R × T / V_headspace
    6. If V_headspace ≈ 0: P = 200 bar sentinel + WARNING
    Returns: { P_Pa, V_liq_m3, V_vap_m3, n_L{}, n_V{}, level_pct }

    Heuristic. ±5–15% accuracy. Sufficient for ideal gas / Raoult.
    After S3 (PR EOS): liquid density from Z_liq, VLE from fugacity.

    Edge cases:
    - CO₂ at 290K: 0.9×Tc = 0.9×304 = 274. 290 > 274 → NOT condensable.
      Conservative. CO₂ near critical is hard to model with ideal gas.
    - Empty tank: P ≈ 0. level = 0.
    - All liquid: V_headspace ≈ 0 → sentinel P + warning.
    - Overfull (V_liq > V_total): clamp, CATASTROPHIC alarm.

### Pressure anchor

    sealed: P = computeTankState().P_Pa
    vented: P = SimSettings.atmosphere.P_Pa
    reservoir(sealed): P = P_charge_bar × 1e5 (constant)
    reservoir(vented): P = P_atm (constant)

### Outlet flow

    Q_out = Cv × (opening/100) × √(ΔP_net / (SG × 1e5))

    ΔP_net = P_tank − P_downstream_anchor + Σ(ΔP_boost) − Σ(ΔP_valve) − K_path × Q²

    This is implicit in Q (Q appears on both sides via K_path × Q²).
    Rearranged:

    Q = √( ΔP_static / (1/C + K_path) )

    where:
      ΔP_static = P_tank − P_anchor + Σ(boost) − Σ(valve_ΔP)
      C = (Cv × opening/100)² / (SG × 1e5)
      K_path = Σ(k_i) for all passthrough units in path

    If ΔP_static ≤ 0: Q = 0.

    SG = MW_avg / 18.015 (water reference, consistent with ISA convention)

### Density correction (gas paths)

    SG_eff = √(SG_inlet × SG_outlet_est)
    SG_outlet_est = SG_inlet × P_outlet / P_inlet

    One multiplication. No iteration. ≤10% error for P_ratio ≤ 5:1.

### Inventory integration (finite mode)

    n_sp(t+dt) = n_sp(t) + (Σn_in_sp − Σn_out_sp) × dt

    Four outflows: liq_out, vap_out, vent, overflow.
    Temperature mixing: weighted-average (existing v12 behavior).


## B2. ΔP Valve

    Modes:
      Pout:   P_out = min(P_in, target). P_in < target → INFO alarm.
      deltaP: P_out = P_in − ΔP. Result < 0 → P_out = 0, ERROR alarm.

    Isenthalpic. PH-flash. phaseConstraint = 'VL'.
    Reverse flow (P_out > P_in after network propagation): Q = 0.
    Pressure role: drop. ΔP consumed from path budget.


## B3. Pressure Network

### Node construction

    1. One node per material port on participating units (role ≠ 'none')
    2. Union nodes connected by wires (UnionFind)
    3. Result: zones (connected components), each with 0..N anchors

### BFS propagation

    1. Seed anchors (tank/reservoir P, atmosphere P_atm)
    2. BFS through ΔP relations:
       Know P_in → P_out = P_in − ΔP (drop/passthrough)
       Know P_out → P_in = P_out + ΔP (reverse inference)
       Boost: P_out = P_in + ΔP
    3. Conflict: same node reached with different P beyond tolerance → alarm
    4. Unassigned nodes after BFS = 'floating'

    BFS establishes the pressure field. The path solver (B4) then uses
    the anchor pressures and path structure to compute flows.

### Tolerances

    Conflict: max(500 Pa,  0.5% of max(P1, P2))
    Warning:  max(5000 Pa, 5%   of max(P1, P2))

### Mixer

    P_out = min(P_in_i). Per-inlet Q clamped ≥ 0 (implicit check valve).
    Warning if inlet pressures differ by > warning tolerance.
    If estimated junction P > weak source anchor P → that inlet Q = 0,
    alarm: "[Source] outlet blocked — mixer pressure exceeds source
    pressure ([P_source] bar < [P_est] bar). Increase source pressure
    or close outlet."

### Splitter / Flash drum

    Both outlets: same ΔP from single k / deltaP param.


## B4. Path Solver (algebraic, NNG-17 compliant)

### Definitions

    Anchor: unit that defines P (reservoir, tank, atmosphere_sink)
    Path:   sequence from Cv outlet → passthrough units → downstream anchor
    Zone:   connected ports sharing pressure (from UnionFind)

### Single path: closed form

    Q = √( ΔP_static / (1/C + K_path) )

    ΔP_static = P_source − P_sink + Σ(boost) − Σ(valve_ΔP)
    C = (Cv × open/100)² / (SG × 1e5)
    K_path = Σ(k_i)

    If ΔP_static ≤ 0 → Q = 0, alarm.
    If K_path = 0 and C → ∞ → clamp Q at max, WARNING.

### Parallel paths, same downstream anchor

    G_i = 1/√K_i  (path conductance, excluding Cv)
    G_sum = ΣG_i

    P_junction = (C × P_source + G_sum² × P_sink) / (C + G_sum²)

    Q_total = √(C × (P_source − P_junction))
    Q_i = (G_i / G_sum) × Q_total

    Direct algebra. No iteration.

### Parallel paths, different downstream anchors

    Single equation in P_junction. Monotonic in range
    [max(P_sink_i), P_source]. Bisection: ≤20 iterations.
    Always converges.

### Independent sources merging

    Each reservoir computes Q from its own path independently.
    Mixer sums. No interaction between source computations.

### Boost elements (compressor, pump)

    Add to ΔP_static budget. Compressor stamps ΔP from user-set
    pressure_ratio or P_out. Flow passes through at delivered rate.
    Exceeds capacity → overload alarm (S2). Below minimum → surge
    alarm (S1 equipment limits).

### Recycle loops

    Existing successive substitution. Cv/resistance self-limits:
    more recycle → more total flow → more resistance → lower Q.


## B5. Solve Order (within one tick)

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
    Step 6: inventory integration (enhanced from existing tank tick).


## B6. Topology Diagnostics

    Topology          Behavior     Alarm
    ───────────────── ──────────── ──────────────────────────────────
    No downstream     Q = 0        ERROR: No pressure boundary
     anchor                        downstream. Connect to sink/vessel.
    ΔP_net ≤ 0        Q = 0        INFO: Insufficient pressure to
                                    drive flow from [A] to [B].
    All outlets        Q = 0        (none — deliberate)
     closed
    Zero-resistance    Q → clamp    WARNING: Zero-resistance path.
     (K=0, Cv=∞)                    Flow clamped. Add restriction.
    Reverse gradient   Q = 0        INFO: Downstream P > upstream P.
                                    Insert compressor/pump.
    Mixer backflow     Q_weak = 0   WARNING: [Source] outlet blocked —
     risk                           junction P exceeds source P.
    Pressure conflict  (BFS)        ERROR: Conflicting anchors in zone.
    Floating zone      (BFS)        (no error — ideal units present)
    ΔP > budget        Q = 0        WARNING: Valve ΔP exceeds available
                                    pressure budget.


## B7. Migration

    Current unit         Action
    ──────────────────── ──────────────────────────────────────────
    source               Keep. Add pressure.role = 'none'. Deprecate in palette.
    source_multi         Merge into source (already has multi-species).
    source_air           Keep. Add pressure.role = 'none'. Deprecate in palette.
    sink                 Keep. Add pressure.role = 'none'.
    tank                 Rewrite: 5-port, Cv on outlets, reservoir mode.
                         Port migration: mat_out→liq_out, overflow→vent.
    valve                Keep defId. Add pressure.role = 'drop'. Add k=0.
    (new) reservoir      New registration. Full pressure participation.
    (new) atmosphere_sink  New registration. Anchor at P_atm.

    Scene import: map old tank port IDs. Old source/sink/valve: unchanged.
    No defId renames. No port renames except tank (structural change).

    Reservoir presets in palette:
      "Empty vessel"    — finite, sealed, empty
      "Air supply"      — reservoir, vented, air composition
      "Gas cylinder"    — reservoir, sealed, user P/T/composition
      "Liquid tank"     — finite, sealed, user composition


═══════════════════════════════════════════════════════════════════
SECTION C — FEATURES
═══════════════════════════════════════════════════════════════════

### F-001: computeTankState
    WHAT: Pure function: inventory → P, phase split, level.
    HOW:  Per B1 algorithm. Export on PG.
    TESTS:
      T-PS01 — pure N₂: P = nRT/V
      T-PS02 — pure water (liq at 300K): V_liq ≈ V, high P
      T-PS03 — water + N₂ mix: liquid water, N₂ in headspace
      T-PS04 — empty: P ≈ 0, level = 0
      T-PS05 — overfull: clamped, CATASTROPHIC
      T-PS06 — deterministic: same input → same output

### F-002: Reservoir Registration
    WHAT: New unit with 5 ports, Cv on product outlets, finite/reservoir modes.
    HOW:  Per B1. Palette presets per B7.
    TESTS:
      T-PS07 — liq_out draws liquid composition only
      T-PS08 — vap_out draws vapor composition only
      T-PS09 — no liquid → liq_out = 0, INFO
      T-PS10 — no vapor → vap_out = 0, INFO
      T-PS11 — sealed: P from headspace
      T-PS12 — vented: P = P_atm
      T-PS13 — reservoir mode: P constant, inventory constant
      T-PS14 — Cv: opening=0 → Q=0
      T-PS15 — Cv: opening=100, ΔP=4bar → Q matches equation
      T-PS16 — safety: vent on P > P_design
      T-PS17 — safety: overflow on level > max
      T-PS18 — safety: CATASTROPHIC if unconnected
      T-PS19 — inventory integration: n changes over dt
      T-PS20 — param validation: V > 1000 rejected

### F-003: Atmosphere Sink
    WHAT: Absorbs inflow. Anchor at P_atm. One port.
    TESTS:
      T-PS21 — anchor at P_atm
      T-PS22 — tracks SimSettings.atmosphere change
      T-PS23 — two in same zone: no conflict

### F-004: Pressure Role Declarations
    WHAT: Every unit declares pressure role + port pairs per A4 table.
    HOW:  Add pressure: { role, pairs, k } to each UnitRegistry entry.
    TESTS:
      T-PS24 — all units have pressure.role
      T-PS25 — roles match A4 table (automated sweep)

### F-005: Resistance Parameter k
    WHAT: Flow-dependent ΔP on all passthrough units.
    HOW:  Add k param per A4 table. Default per unit type.
    TESTS:
      T-PS26 — HEX: k > 0, ΔP increases with Q
      T-PS27 — reactor: k > 0
      T-PS28 — mixer: k = 0 (junction, no resistance)
      T-PS29 — default k = 0 gives same behavior as current

### F-006: ΔP Valve Enhancement
    WHAT: Existing valve gets pressure.role = 'drop', reverse flow check.
    HOW:  Per B2. No defId change.
    TESTS:
      T-PS30 — Pout mode: P_in > target
      T-PS31 — Pout mode: P_in < target (clamped, INFO)
      T-PS32 — deltaP mode: normal
      T-PS33 — reverse flow: Q = 0, alarm
      T-PS34 — isenthalpic: H_out = H_in
      T-PS35 — regression: existing valve tests

### F-007: UnionFind + buildPressureNodes
    WHAT: Data structure + node graph.
    HOW:  UnionFind in Block 1 (DOM-free). One node per material port on
          participating units. Union by wire.
    TESTS:
      T-PS36 — UnionFind: find, union, components
      T-PS37 — connected ports share zone
      T-PS38 — unconnected = separate zones
      T-PS39 — passthrough: in/out different nodes

### F-008: analyzePressureTopology
    WHAT: Pre-run analysis. Zones, anchors, conflicts, overrides.
    HOW:  Count anchors per zone. Detect conflicts and floating zones.
    TESTS:
      T-PS40 — two anchors same P: no conflict
      T-PS41 — two anchors diff P: conflict ERROR
      T-PS42 — source (role=none) in anchored zone: INFO
      T-PS43 — floating zone: no error

### F-009: BFS Pressure Propagation
    WHAT: propagatePressures(ctx, scene) per B3. Bidirectional.
    HOW:  Block 1. Integrate into solveScene post-tick.
    TESTS:
      T-PS44 — chain: tank(5bar) → valve(ΔP=3) → sink → P correct
      T-PS45 — reverse inference through valve
      T-PS46 — boost: pump propagation
      T-PS47 — conflict: two tanks, different P
      T-PS48 — floating: all unknown, no errors
      T-PS49 — passthrough with k > 0: ΔP depends on Q
      T-PS50 — HEX: hot/cold independent
      T-PS51 — mixer: warning on large P mismatch
      T-PS52 — mass/energy balance unchanged by propagation

### F-010: Path Solver
    WHAT: Algebraic flow computation per B4.
    HOW:  After BFS, trace paths from each Cv outlet to downstream
          anchors. Compute Q per B4 equations.
    TESTS:
      T-PS53 — single path: Q matches closed-form equation
      T-PS54 — single path with boost: compressor adds to budget
      T-PS55 — single path with ΔP valve: valve consumes budget
      T-PS56 — ΔP_static ≤ 0: Q = 0, alarm
      T-PS57 — branching, same anchor: split proportional to G_i
      T-PS58 — branching, diff anchors: bisection converges
      T-PS59 — merge: independent sources, mixer sums
      T-PS60 — mixer backflow: weak source Q = 0, alarm
      T-PS61 — Cv = 0 (closed): Q = 0
      T-PS62 — zero resistance path: Q clamped, WARNING
      T-PS63 — density correction: SG_eff applied for gas
      T-PS64 — finite tank draining: Q decreases as P drops over dt

### F-011: Production Gating
    WHAT: Step/Play blocked on pressure ERROR.
    HOW:  Extend gate check in TimeClock/playLoop.
    TESTS:
      T-PS65 — Step blocked on pressure ERROR
      T-PS66 — Step OK on WARNING
      T-PS67 — Play blocked on ERROR
      T-PS68 — Test (simulate) always runs

### F-012: Traffic Light + Canvas
    WHAT: Pressure dot in traffic light. Optional P annotations on canvas.
    HOW:  Traffic light reads alarm state. Canvas shows P on connections.
    TESTS:
      T-PS69 — traffic light green/amber/red
      T-PS70 — ideal-only flowsheet: pressure dot absent
      T-PS71 — non-participating unit: visual indicator present

### F-013: Connection-Time Analysis
    WHAT: Run topology check when wires connect/disconnect.
    HOW:  analyzePressureTopology after connect(). Show conflict immediately.
    TESTS: (Block 2 — manual verification via test scene)

### F-014: Live Parameter Changes
    WHAT: Param edits during Play → next tick uses new values.
          Blocking alarm → auto-pause. Topology change → auto-pause.
    TESTS:
      T-PS72 — change valve ΔP during Play → next tick uses it
      T-PS73 — change creates blocking alarm → auto-pause
      T-PS74 — topology change → auto-pause

### F-015: End-to-End Demo
    WHAT: Demo scene exercising full pressure-flow system.
    HOW:  Reservoir(5bar) → heater(k>0) → ΔP valve → atmosphere_sink.
          Second reservoir feeding mixer. Tank draining over time.
    TESTS:
      T-PS75 — demo runs clean
      T-PS76 — export/import round-trip with pressure data
      T-PS77 — all units × reservoir: no crash (sweep)
      T-PS78 — performance: 30 units < 50ms
      T-PS79 — full regression


═══════════════════════════════════════════════════════════════════
SECTION D — PHASE TRACKER
═══════════════════════════════════════════════════════════════════

    PHASE 1: Vessel ─────────────────────────────────────────
    F-001 computeTankState
    F-002 Reservoir registration
    F-003 Atmosphere sink
    [ ] 1a  computeTankState function (pure, Block 1)
    [ ] 1b  Reservoir unit: 5-port, Cv, finite/reservoir modes
    [ ] 1c  Phase-constrained outlets
    [ ] 1d  Safety ports (vent + overflow)
    [ ] 1e  Reservoir presets in palette
    [ ] 1f  atmosphere_sink unit
    [ ] 1g  Inventory integration tick
    [ ] 1h  Param validation
    [ ] 1i  Build Phase 1 test scene
    Tests: T-PS01–T-PS23 | Gate: —/23

    PHASE 2: Network Structure ──────────────────────────────
    F-004 Pressure role declarations
    F-005 Resistance parameter k
    F-006 ΔP valve enhancement
    F-007 UnionFind + buildPressureNodes
    F-008 analyzePressureTopology
    [ ] 2a  Pressure roles on ALL units
    [ ] 2b  k param on all passthrough units
    [ ] 2c  ΔP valve: role=drop, reverse flow check
    [ ] 2d  UnionFind class (Block 1)
    [ ] 2e  buildPressureNodes
    [ ] 2f  analyzePressureTopology
    [ ] 2g  Build Phase 2 test scene
    Tests: T-PS24–T-PS43 | Gate: —/43

    PHASE 3: Propagation + Path Solver ──────────────────────
    F-009 BFS pressure propagation
    F-010 Path solver
    [ ] 3a  BFS propagatePressures (bidirectional)
    [ ] 3b  Integrate into solveScene
    [ ] 3c  Path tracer: Cv outlet → anchor
    [ ] 3d  Single-path algebraic solve
    [ ] 3e  Branching solve (linear + bisection)
    [ ] 3f  Merge / mixer backflow detection
    [ ] 3g  Density correction
    [ ] 3h  Pressure AlarmSystem source (NNG-12 messages)
    [ ] 3i  Build Phase 3 test scene
    Tests: T-PS44–T-PS64 | Gate: —/64

    PHASE 4: Gating + UX + Integration ──────────────────────
    F-011 Production gating
    F-012 Traffic light + canvas
    F-013 Connection-time analysis
    F-014 Live parameter changes
    F-015 End-to-end demo
    [ ] 4a  Step/Play gating on pressure ERROR
    [ ] 4b  Traffic light pressure dot
    [ ] 4c  Non-participating unit visual indicator
    [ ] 4d  Connection-time topology check
    [ ] 4e  Live param → re-solve
    [ ] 4f  Demo scene + sweep
    [ ] 4g  Performance check
    [ ] 4h  Full regression
    Tests: T-PS65–T-PS79 | Gate: —/79

    ═══════════════════════════════════════════════════════════
    TOTAL: 79 new tests
    ═══════════════════════════════════════════════════════════


═══════════════════════════════════════════════════════════════════
SECTION E — WHAT THIS MODEL CANNOT DO
═══════════════════════════════════════════════════════════════════

    Limitation                            Mitigation
    ──────────────────────────────────── ──────────────────────────────
    No compressor curve intersection      S1 equipment limit alarms:
                                          Q < surge_min, Q > choke_max
    Density: geometric mean approx        ≤10% error at P_ratio ≤ 5:1
    No pressure transients                Out of scope permanently
    ΔP valve doesn't interact with Cv     Clear alarm on budget overrun

    These are permanent NNG-17 trade-offs. The algebraic model always
    computes, always converges, always gives qualitatively correct
    results. That's the right trade for a game.


═══════════════════════════════════════════════════════════════════
SECTION F — SESSION PROTOCOL
═══════════════════════════════════════════════════════════════════

    FOR ANY IMPLEMENTATION SESSION:

    1. Read THIS DOCUMENT
    2. Read processThis.html NNG section
    3. Find current phase (first unchecked in Section D)
    4. Read feature specs in Section C for that phase
    5. Build test scene FIRST
    6. Implement. Run ALL tests after each change.
    7. Update Section D: check tasks, fill gate, add notes
    8. Present test scene + code to user

    RULES:
    - Phase N+1 requires Phase N gate green
    - ALL previous tests must still pass
    - Design seems wrong? Note it in D, ask before changing
    - Keep this document updated


═══════════════════════════════════════════════════════════════════
END OF DOCUMENT
═══════════════════════════════════════════════════════════════════
