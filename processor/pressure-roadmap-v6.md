# processThis — Pressure & Flow Roadmap
# HERMES (W1) · FORGE (W2) · MERIDIAN (W3)
# Version: 6.0 — 2026-02-17
# Baseline: processThis v10.7.0 (225 tests, 1525 checks)


═══════════════════════════════════════════════════════════════════
SECTION A — OVERVIEW
═══════════════════════════════════════════════════════════════════

## A1. Executive Summary

processThis is a browser-based process simulator where you build
flowsheets, connect units, and run. It handles chemistry, thermo,
mass/energy balance, and phase equilibrium in real time.

Pressure modeling is currently decorative — values exist but aren't
enforced. This roadmap makes pressure real, across three waves:

  HERMES (v11.x)  Pressure is physically correct and enforced.
  FORGE  (v12.x)  Pressure has engineering consequences.
  MERIDIAN (v13.x) Pressure drives flow. Design only.

~100 new tests across Hermes + Forge. Meridian is scoped, not built.


## A2. Key Concepts

### Physics as playground, not prison

The simulator's job is to let you experiment with processes. Physics
are the boundaries of the playground — they tell you what's possible,
not what's forbidden. The design philosophy:

  - Let the player do anything within physical laws
  - Compromises on accuracy are fine; compromises on fundamentals are not
  - Values may not be exact, but they're always in the right ballpark
  - Physics never diverge significantly from reality
  - No convergence nightmares, no alarm floods, no PhD required
  - Blunt refusal to run is a last resort, not a first response

The result is a simulator that's CONVINCING — not Aspen-accurate, but
never physically absurd. An underpressured valve warns you; it doesn't
crash. An impossible configuration explains WHY it's impossible and
suggests what to fix.

### The realism ladder

Realism isn't a global setting. It emerges from which units you choose:

  IDEAL units (opt out of pressure):
    Ideal Source, Ideal Sink — magic faucets and drains. Use these to
    learn, to prototype, to focus on chemistry without worrying about
    pressure. They stamp whatever P/T you want. The system doesn't
    check if it makes sense. That's fine — they're training wheels.

  ENGINEERING units (participate in pressure):
    Tanks, valves, pumps, compressors, atmosphere sources/sinks —
    these have real pressure behavior. A sealed tank knows its own
    pressure from its contents. A valve drops pressure by a computed
    amount. An atmosphere sink anchors at 1 atm. When you use these,
    the pressure network activates and enforces consistency.

You can mix ideal and engineering units in the same flowsheet. The
ideal units simply opt out — they don't break the pressure network,
they just don't participate. As you learn, you replace ideal units
with engineering ones, and the simulation becomes more physical.

### Simulation vs Production

  SIMULATION (Test button):
    Computes everything. Shows everything. Blocks nothing.
    The clock does NOT advance. No accumulation. No consequences.
    Like sketching on paper — anything goes. You see pressure
    conflicts as red indicators, but you also see all the numbers.
    This is your sandbox for learning and debugging.

  PRODUCTION (Step / Play):
    The clock advances. Tanks fill. Batteries discharge. Results
    carry forward. Physical coherence is REQUIRED — you can't step
    time forward with contradictory physics. A pressure conflict
    that was just a warning in Simulation becomes a gate here.
    Like starting the plant: safety checks must pass first.

### The coupling wall

Our solver computes units one at a time. Flow starts at sources and
propagates forward. Pressure is checked afterward. This works well
for everything in Hermes and Forge.

What it CAN'T do: compute what flow WOULD result from a given
pressure field. That's a fundamentally different calculation needing
simultaneous equations. That's Meridian territory — scoped but not
built. Everything in this roadmap works without crossing that wall.


## A3. Key Design Decisions

### Tank — 5 ports, every outlet phase-constrained

A real vessel has separate nozzles for liquid (bottom) and gas (top).
You never draw a mixed stream from a settled tank — that composition
doesn't exist anywhere in the vessel.

  Feed in:          Any phase, left side
  Liquid product:   Draws from liquid phase only, bottom right
  Vapor product:    Draws from vapor phase only, top right
  Liquid overflow:  Safety — activates on high level, bottom center
  Gas vent:         Safety — activates on high pressure, top center

Safety ports raise fatal errors if unconnected when the tank fills
or overpressures. Connected safety ports activate with a warning.

Volume capped at 1000 m³ (beyond: our ideal gas isn't credible).
Pressure capped at 100 bar (beyond: compressibility factor too wrong).
Sealed tanks compute their own pressure. Vented tanks sit at P_atm.

### Boundary units — ideal vs engineering

  IDEAL (pressure opt-out, for learning):
    Ideal Source:   Any P, T, composition, flow rate. Magic faucet.
    Ideal Sink:     Absorbs everything. Magic drain.

  ENGINEERING (pressure anchor, for realism):
    Atmosphere Source: P = 1 atm, T = ambient, air composition,
                       user-set flow rate. Anchors in pressure network.
    Atmosphere Sink:   Absorbs at P = 1 atm. Anchors in pressure network.

Ideal Source absorbs the old source_multi — one unit handles any
number of species. Rule: anything that opts out of pressure is
called "Ideal [something]."

### Valves — three units, increasing realism

  Ideal Valve:        Sets outlet P or ΔP directly. Two ports.
                      Simple, intuitive, slightly magical.
                      defId: ideal_valve

  Flow Control Valve: Sets target flow rate. Excess to bypass.
                      Three ports. Physically correct.
                      defId: valve_flow

  Valve:              Cv model. Opening % controls how much flows.
                      Reads pressure from network to limit flow.
                      Three ports. The "real" valve.
                      defId: valve_cv_cap  (UI name: "Valve")

The Ideal Valve is the training wheel. The Valve (Cv) is what a
real plant has. Users graduate naturally. The Ideal Valve may be
retired later if the Cv valve proves intuitive enough.

### Pressure network

Every engineering unit declares a pressure role:
  Anchor: defines P (tanks, atmosphere units)
  Boost: increases P (pumps, compressors)
  Drop: decreases P (valves, turbines)
  Passthrough: P_out = P_in − ΔP, default ΔP = 0

Every passthrough unit gets a fixed ΔP parameter (default zero).
Any heater, cooler, reactor, or heat exchanger can model realistic
pressure loss from day one just by setting a number.

ΔP is at the outlet. A reactor at 10 bar inlet with ΔP = 0.5 bar
runs the reaction at 10 bar; its outlet goes to 9.5 bar.

### Alarm-driven unit highlighting

Unit severity maps to visual state on the canvas:

  OK / INFO:    Normal appearance
  WARNING:      Amber glow
  ERROR:        Red glow (pulsing in Production mode)
  CRITICAL:     Red glow + shake animation

This is driven by AlarmSystem — no ad-hoc color logic. When the
pressure system flags a conflict on a unit, that unit glows red
automatically because it has an ERROR-level alarm. This builds on
the existing alarm animation infrastructure (NNG-15) and extends
naturally to pressure diagnostics.

Note: advanced failure animations (sparks, smoke, rupture visuals)
are out of scope for this roadmap. The severity → color mapping is
the foundation they'll build on.


## A4. Unit Pressure Classification

Every unit in the simulator, its pressure role, and what it does:

### Ideal units (pressure opt-out)

    Unit               Pressure    What it does
    ────────────────── ─────────── ──────────────────────────────────
    Ideal Source        none       Stamps any P/T/flow. Magic faucet.
    Ideal Sink          none       Absorbs everything. Magic drain.
    Ideal Valve         drop       Sets P_out or ΔP directly.
                                   Participates in network, but the
                                   P values are user-imposed.

### Engineering units (pressure-participating)

    Unit               Pressure    What it does to pressure
    ────────────────── ─────────── ──────────────────────────────────
    Atmosphere Source    anchor     Anchors at P_atm. Air composition.
    Atmosphere Sink     anchor     Anchors at P_atm. Absorbs flow.
    Tank (sealed)       anchor     P from headspace physics.
    Tank (vented)       anchor     P from atmosphere.
    Valve (Cv)          passthru   Reads P, limits flow from Cv eq.
    Flow Control Valve  passthru   Splits flow. ΔP = 0.
    Pump                boost      P_out = P_in + ΔP (from shaft work)
    Compressor          boost      P_out = P_in + ΔP (from shaft work)
    Gas Turbine         drop       P_out = P_in − ΔP (extracts work)

### Process units (passthrough, ΔP = 0 default)

    Unit               ΔP param           Port pairs
    ────────────────── ────────────────── ─────────────────────────
    Heater              deltaP_bar         mat_in → mat_out
    Cooler              deltaP_bar         mat_in → mat_out
    HEX (hot side)      deltaP_hot_bar     hot_in → hot_out
    HEX (cold side)     deltaP_cold_bar    cold_in → cold_out
    Mixer               special            in1, in2 → out (min P)
    Splitter            deltaP_bar         mat_in → out1, out2
    Flash Drum          deltaP_bar         mat_in → vap, liq
    Reactor (equil.)    deltaP_bar         mat_in → mat_out
    Reactor (kinetic)   deltaP_bar         mat_in → mat_out

### Power units (not in pressure network)

    Battery, Grid Supply, Mechanical Source — electrical/mechanical only.


## A5. What's Excluded

  VT FLASH: Finding exact tank pressure by solving volume equations
  requires an advanced equation of state (Peng-Robinson or similar).
  Our ideal gas + Raoult VLE can't support this. The headspace
  heuristic (±5-15% accuracy) is the right approach for our thermo.
  VT flash is deferred to a future EOS upgrade. When that happens,
  key needs: cubic EOS solver, liquid density from EOS, fugacity-
  based VLE, enthalpy departures for Joule-Thomson.

  FLOW-PRESSURE COUPLING: Computing flow from pressure differences
  needs simultaneous equations. Deferred to Meridian (Wave 3).

  PID CONTROLLERS: Automatic valve adjustment over time. Meridian.

  CAREER/MISSION MODE: Success criteria, equipment constraints. Meridian.


## A6. Non-Negotiable Rules (16)

  1.  Conservation: mass and energy always balance.
  2.  Simulation computes all, blocks nothing. Production enforces.
  3.  Realism from unit choice. Ideal units are training wheels.
  4.  Single file. Core has no browser code. Tests are headless.
  5.  Registries for all data. ThermoAdapter for all thermo.
  6.  Streams follow STREAM_CONTRACTS.
  7.  Solver runs in fixed order. State in designated places.
  8.  Pressure derived from physics, never fabricated.
  9.  All tests pass. New features have tests.
  10. Every change: version bump + changelog.
  11. Data complete — no missing required fields.
  12. Diagnostics: natural language. Cause → consequence → fix.
  13. Severity gates actions. Critical stops. Error blocks Production.
  14. UI conventions: inspector zones, CSS-first, safe shortcuts.
  15. Visuals from alarms. Severity → color. Never stale.
  16. ΔP at outlet. Units operate at inlet pressure internally.


═══════════════════════════════════════════════════════════════════
SECTION B — IMPLEMENTATION REFERENCE
═══════════════════════════════════════════════════════════════════

For Claude. Contains all detail needed for implementation.
Human readers: skip to Section C (features) or D (tracker).

## B1. NNG Full Text

    NNG-1   CONSERVATION
            Mass: kg/s in = out for non-boundary, non-inventory units.
            Inventory: imbalance = accumulation. Global: Σsrc−Σsnk−Σacc=0.
            Energy: E_in = E_out (enthalpy + work + heat + reaction).
            Residuals > 100 W flagged.

    NNG-2   SIMULATION vs PRODUCTION
            solveScene() always computes fully — mode-unaware.
            Gate is EXTERNAL: TimeClock.step() and playLoop() check alarm
            severity before advancing time.
            Test button: solveScene() only. No gate. No time advance.
            Step button: check alarms → if ERROR/CRITICAL in pressure
              category → BLOCK (toast + highlight). Else: solve + step.
            Play button: same gate per tick. Alarm mid-play → auto-pause.
            Pressure propagation runs in BOTH modes. Difference is only
            whether time advances after.

    NNG-3   PHYSICAL REALISM
            Realism from unit choice. Ideal = pressure opt-out.
            Engineering = pressure participant. Consistent approximation
            depth. Prefer correctness when cost is small.

    NNG-4   SINGLE-FILE, DOM-FREE CORE
            One HTML. Block 1: zero DOM. Block 2: UI. Tests headless.
            Exports: PG.

    NNG-5   REGISTRY PATTERN
            Component/Unit/Reaction/ModelRegistry. All units registered.
            All thermo via ThermoAdapter.

    NNG-6   STREAM CONTRACTS
            STREAM_CONTRACTS = truth. H_target → PH flash. T → TP.
            Power: capacity → demand → actual → curtailment.

    NNG-7   SOLVER DISCIPLINE
            tick → validate → flash → ports → power → pressure → converge.
            Inter-iteration: scratch(). Inter-timestep: u.inventory.

    NNG-8   PRESSURE SYSTEM
            Tank P from inventory. Every unit declares role + ΔP.
            Nodes separate per port. BFS post-tick. Deterministic.
            Priority: anchor > derived > seeded > unknown.

    NNG-9   TESTING
            All pass. New: ≥1 positive + ≥1 edge. Deterministic.

    NNG-10  VERSIONING
            Change → bump + changelog (what, why, NNGs, tests).

    NNG-11  DATA COMPLETENESS
            Species: all ThermoPackage props. Reactions: balanced + Hf + kinetics.

    NNG-12  DIAGNOSTIC LANGUAGE
            AlarmSystem only. Natural: cause → consequence → fix.

    NNG-13  SEVERITY AND GATING
            CRITICAL > ERROR > WARNING > INFO > OK. Frozen.
            CRITICAL: faulted. ERROR: blocks Production. WARNING: caution.
            Maps to unit visuals: OK=normal, WARN=amber, ERR=red, CRIT=red+shake.

    NNG-14  UI CONVENTIONS
            Inspector: Header→Status→Params→Props→Diag. CSS-first.

    NNG-15  ALARM-DRIVEN VISUALS
            Severity → unit glow color. Gated by animation settings.

    NNG-16  ΔP DIRECTION
            Drop at outlet. Unit operates at P_inlet internally.
            P_outlet = P_inlet − ΔP. Boost: P_outlet = P_inlet + ΔP.

## B2. Tank Spec

### Ports (w:2, h:3)

        x:0       x:1        x:2
    y:0         [vent]     [vap_out]
    y:1 [mat_in]
    y:2         [liq_ov]   [liq_out]

    portId        dir  type      x  y  constraint  role
    ────────────────────────────────────────────────────────
    mat_in        IN   MATERIAL  0  1  any         Feed
    vap_out       OUT  MATERIAL  2  0  V           Vapor product
    vent          OUT  MATERIAL  1  0  V           Gas safety
    liq_out       OUT  MATERIAL  2  2  L           Liquid product
    liq_overflow  OUT  MATERIAL  1  2  L           Liquid safety

    optionalPorts: true

### Parameters

    key                 default  min              max     notes
    ──────────────────────────────────────────────────────────────
    volume_m3           50       0.1              1000    UI cap
    liqDrawRate_molps   1.0      0                1000
    vapDrawRate_molps   0        0                1000
    tankMode            'sealed' enum: sealed/vented
    P_design_bar        10       1                100     UI cap
    P_rupture_bar       15       P_design+0.5     100
    maxLiqLevel_pct     90       50               99

### Safety behavior

    VENT:
      P > P_design:  connected → WARNING  |  unconnected → ERROR
      P > P_rupture: connected → WARNING  |  unconnected → CATASTROPHIC

    LIQ_OVERFLOW:
      level > max:   connected → WARNING  |  unconnected → ERROR
      level = 100%:  connected → WARNING  |  unconnected → CATASTROPHIC

### computeTankState(n, T_K, V_total, thermo)

    Pure function. No side effects. Exported on PG.
    1. Classify species: condensable (T < 0.9×Tc heuristic) vs permanent
    2. Liquid volume: V_liq = Σ(n_cond × MW / ρ_liq) from ThermoAdapter
    3. V_headspace = max(0, V_total − V_liq)
    4. VLE on condensable: Raoult → n_V_condensable (vapor above liquid)
    5. P_headspace = (n_permanent + n_V_condensable) × R × T / V_headspace
    6. If V_headspace ≈ 0: P = high (all-liquid case)
    Returns: { P_Pa, V_liq_m3, V_vap_m3, n_L{}, n_V{}, level_pct }

    Heuristic. ±5-15% accuracy. Correct for our thermo stack.
    VT flash excluded — needs EOS (see A5).

### Pressure anchor

    sealed: P = computeTankState().P_Pa
    vented: P = SimSettings.atmosphere.P_Pa

## B3. Boundary Unit Specs

### Renames and port standardization

    Old defId        New defId            UI name             Port renames
    ──────────────── ──────────────────── ─────────────────── ────────────────
    source           ideal_source         Ideal Source         out → mat_out
    source_multi     (merged into above)  (removed)            —
    sink             ideal_sink           Ideal Sink           in → mat_in
    source_air       atmosphere_source    Atmosphere Source     out → mat_out
    (new)            atmosphere_sink      Atmosphere Sink       —  (mat_in)
    valve            ideal_valve          Ideal Valve           (in/out kept)

    Port renames: current source/sink use 'out'/'in'. Engineering units
    use 'mat_out'/'mat_in'. Standardize all material ports to mat_* for
    consistency. Migration: map old port IDs in scene import.

    source_multi merge: ideal_source already handles multiple species
    via its composition parameter. source_multi was redundant.

### ideal_source (was: source + source_multi)

    Pressure role: none
    Ports: mat_out (OUT, MATERIAL, x:2, y:1)
    Behavior: unchanged from current source. Stamps P, T, n from params.
    Multi-species: composition parameter accepts any species set
    (absorbs source_multi's n:{} param and composition editor).
    No pressure network participation.

### ideal_sink (was: sink)

    Pressure role: none
    Ports: mat_in (IN, MATERIAL, x:0, y:1)
    Behavior: unchanged. Absorbs all inflow.

### atmosphere_source (was: source_air)

    Pressure role: anchor at P_atm
    Ports: mat_out (OUT, MATERIAL, x:2, y:1)
    P: SimSettings.atmosphere.P_Pa (not user-settable — it's the atmosphere)
    T: SimSettings.atmosphere.T_K (not user-settable)
    Composition: { N2: 0.7808, O2: 0.2095, Ar: 0.0093 } × flowRate
    User sets: flowRate_molps only
    Behavior: anchors its outlet node at P_atm. Provides air.
    Why accurate: real atmosphere has fixed P, T, composition, infinite
    supply. This model matches exactly within our approximation level.

### atmosphere_sink (new)

    Pressure role: anchor at P_atm
    Ports: mat_in (IN, MATERIAL, x:0, y:0)
    w:2, h:1
    Behavior: absorbs all inflow at P_atm. Like ideal_sink but anchors.

### ideal_valve (was: valve)

    Pressure role: drop
    Ports: in (IN, x:0, y:1) → out (OUT, x:2, y:1)
    Modes: Pout | deltaP
    Participates in pressure network but imposes P directly (user sets it).
    The "ideal" is that a real valve doesn't set P — it presents
    resistance. But this is the intuitive, training-wheel version.
    Note: ideal_valve keeps port IDs 'in'/'out' (not renamed) since
    it is already a pressure-network unit with established behavior.

## B4. Valve Specs

### ideal_valve (Hermes — Phase 2)

    defId: 'ideal_valve'  |  UI: "Ideal Valve"
    Category: PRESSURE
    Ports: in (x:0,y:1) → out (x:2,y:1)
    Role: drop

    Params:
      controlMode  'Pout' | 'deltaP'  default 'Pout'
      Pout_bar     1.01325             min 0.001  max 100
      deltaP_bar   1                   min 0      max 100

    Tick (Pout):  P_out = min(P_in, Pout × 1e5). P_in < target → INFO.
    Tick (deltaP): P_out = max(0, P_in − ΔP × 1e5).
    Both: isenthalpic, PH flash, phaseConstraint 'VL'.

### valve_flow (Forge — Phase 7)

    defId: 'valve_flow'  |  UI: "Flow Control Valve"
    Category: PRESSURE
    Ports: in (x:0,y:1) → main_out (x:2,y:1) + bypass (x:1,y:2)
    Role: passthrough (ΔP=0 both outlets)

    Params: flowTarget_molps  default 1.0  min 0  max 10000

    Tick:
      fraction = min(1, target / Σ(inlet.n))
      main_out = fraction × inlet (isenthalpic)
      bypass = (1−fraction) × inlet (isenthalpic)
    Bypass unconnected + excess: ERROR

### valve_cv_cap (Forge — Phase 8)

    defId: 'valve_cv_cap'  |  UI: "Valve"
    Category: PRESSURE
    Ports: in (x:0,y:1) → main_out (x:2,y:1) + bypass (x:1,y:2)
    Role: passthrough (reads P from nodes, doesn't set P)

    Params:
      Cv           50     min 0.1  max 10000
      opening_pct  100    min 0    max 100

    Tick (after pressure propagation):
      ΔP = P_in_node − P_out_node (read from pressure graph)
      If ΔP ≤ 0: pass all, WARNING "No pressure drop"
      Q_max = Cv × (opening/100) × √(ΔP_Pa / (SG × 1e5))
      SG ≈ MW_avg / 18.015 (gas approximation)
      fraction = min(1, Q_max / n_total)
      Split as valve_flow.

    SIMPLIFIED model:
    - Reads ΔP one-way from network (no coupling)
    - Does NOT iterate (flow cap doesn't feed back to pressure)
    - Accurate when bypassed flow doesn't change pressure field
    - Full coupling (iterate ΔP↔Q) is Meridian scope

## B5. Pressure Network

### Role assignments — complete table

    defId                role         ΔP source            ports in network
    ──────────────────── ──────────── ──────────────────── ─────────────────────
    ideal_source         none         —                    —
    ideal_sink           none         —                    —
    atmosphere_source    anchor       P = P_atm            mat_out
    atmosphere_sink      anchor       P = P_atm            mat_in
    tank (sealed)        anchor       P = headspace        all 5 material ports
    tank (vented)        anchor       P = P_atm            all 5 material ports
    ideal_valve          drop         from tick (user P)   in → out
    valve_flow           passthrough  ΔP = 0 (fixed)       in → main_out, bypass
    valve_cv_cap         passthrough  reads nodes           in → main_out, bypass
    pump                 boost        from tick (work)      mat_in → mat_out
    compressor           boost        from tick (work)      mat_in → mat_out
    gas_turbine          drop         from tick (work)      mat_in → mat_out
    heater               passthrough  deltaP_bar param      mat_in → mat_out
    cooler               passthrough  deltaP_bar param      mat_in → mat_out
    hex (hot)            passthrough  deltaP_hot_bar        hot_in → hot_out
    hex (cold)           passthrough  deltaP_cold_bar       cold_in → cold_out
    mixer                passthrough  special: min(P)       in1, in2 → out
    splitter             passthrough  deltaP_bar            mat_in → out1, out2
    flash_drum           passthrough  deltaP_bar            mat_in → vap, liq
    reactor_equilibrium  passthrough  deltaP_bar            mat_in → mat_out
    reactor_kinetic      passthrough  deltaP_bar            mat_in → mat_out
    battery              none         —                     —
    grid_supply          none         —                     —
    source_mechanical    none         —                     —

### Node construction

    1. One node per material port on pressure-participating units
    2. Union nodes connected by wires (UnionFind)
    3. Result: zones (connected components), each with 0..N anchors

### BFS propagation

    1. Seed anchors (tank P, atmosphere P_atm). Mark priority 'anchor'.
    2. Queue anchors. BFS through ΔP relations:
       Know P_in → P_out = P_in − ΔP (drop/passthrough)
       Know P_out → P_in = P_out + ΔP (reverse inference)
       Boost: P_out = P_in + ΔP
    3. Conflict: node has P from higher priority, new P disagrees
       beyond tolerance → alarm.
    4. After BFS: unassigned nodes = 'unknown' (floating)

### Tolerances

    Conflict: max(500 Pa,  0.5% of max(P1,P2))
    Warning:  max(5000 Pa, 5%   of max(P1,P2))

### Mixer

    P_out = min(P_in1, P_in2). Written to outlet stream.
    Propagation reads as 'seeded'. Warning on large mismatch.

### Splitter / flash_drum

    Both outlets: same ΔP from single deltaP_bar param.

## B6. Test Scene Protocol

Before each implementation phase, build a test flowsheet in the UI
that exercises the features being added. Save as JSON. Include in
the phase delivery. This gives the user a ready-made manual test.

    Phase 0: Basic flowsheet with renamed units (ideal_source →
             heater → ideal_sink). Verify palette names and wiring.
    Phase 1: Tank with various contents (gas, liquid, mixed, empty,
             overfull). Both sealed and vented. Safety ports connected
             and unconnected.
    Phase 2: Ideal valve in both modes. Chain: source → valve → sink.
             Passthrough units with ΔP > 0.
    Phase 3: Multiple pressure zones. Connected and floating zones.
             Conflicting anchors.
    Phase 4: Tank → ideal_valve → atmosphere_sink chain.
             Atmosphere source feeding a process.
    Phase 5: Full propagation chain: sealed tank → heater(ΔP=0.5) →
             ideal_valve(ΔP=3) → atmosphere_sink.
    Phase 6: Flowsheet that starts with pressure errors, user fixes
             them, then enters Play successfully.
    Phase 7+: Forge phases build on Hermes scenes.


═══════════════════════════════════════════════════════════════════
SECTION C — FEATURE CATALOG
═══════════════════════════════════════════════════════════════════

Each feature: stable ID, spec, acceptance criteria, tests.
Complex features have additional implementation notes.

### F-001: NNG Consolidation
    Wave 1, Phase 0
    WHAT: Replace ~65 NNGs with 16 rules (B1). Add product philosophy
          as file header comment (from A2: physics as playground).
    HOW: Rewrite NON-NEGOTIABLES in processThis.html. Old rule IDs
         preserved as "Historical reference" subsection.
    ACCEPT: 16 active NNG rules. Philosophy comment present.
    TEST: T226 — NNG section has 16 numbered rules.

### F-002: Boundary Unit Renames
    Wave 1, Phase 0
    WHAT: source → ideal_source, sink → ideal_sink,
          source_air → atmosphere_source, valve → ideal_valve.
          Merge source_multi into ideal_source.
          Standardize port IDs: out → mat_out, in → mat_in (see B3).
    HOW: Change defId, name, port IDs, category where needed. Update
         all references (tests, inspector hooks, palette, tick functions,
         computeSystemBalance boundary checks). ideal_source gets
         multi-species composition param from source_multi.
         source_multi registration removed.
         Add migration mapping in scene import: old defIds → new,
         old portIds → new. This ensures saved scenes load correctly.
    ACCEPT: Old defIds gone. New names in palette. Port IDs standardized.
            Tests adapted. Old scenes import with migration.
    TESTS: T227 — ideal_source registered, old 'source' gone
           T228 — ideal_sink registered, old 'sink' gone
           T229 — atmosphere_source registered with anchor role
           T230 — ideal_valve registered, old 'valve' gone
           T231 — ideal_source handles multi-species composition
           T232 — source_multi gone (get() returns undefined)

### F-003: Diagnostic Language Upgrade
    Wave 1, Phase 0
    WHAT: Rewrite 4 diagnostics to NNG-12. Add remediation to all
          alarm sources.
    HOW: TANK_OVERFLOW_RUPTURE, COMPRESSOR_VAPOR_INLET,
         PUMP_VAPOR_INLET, ENERGY_RESIDUAL_HIGH → cause/consequence/fix.
         Every alarm source: add remediation field.
    ACCEPT: Messages human-readable. Remediation present everywhere.
    TESTS: T233 — 4 named alarms rewritten
           T234 — all sources have remediation field
           T235 — regression: existing alarm tests

### F-004: computeTankState
    Wave 1, Phase 1
    WHAT: Pure function computing tank thermo state from inventory.
    HOW: Per B2 algorithm. Export on PG.
    IMPLEMENTATION NOTES:
      Species classification heuristic: T < 0.9 × Tc → condensable.
      This catches water (Tc=647K) at typical tank temps (300-400K)
      but not N2 (Tc=126K) — which is correct. N2 stays gaseous.
      Edge case: near-critical species (e.g., CO2 at 290K, Tc=304K).
      The 0.9×Tc threshold puts CO2 as condensable at 290K (290 < 274?
      No — 0.9×304 = 274, so CO2 at 290K is NOT condensable). This is
      conservative: CO2 near its critical point is hard to model with
      ideal gas anyway. Acceptable for our accuracy level.
      Liquid density: use ThermoAdapter.getLiquidDensity(species, T).
      If not available (permanent gas species), skip — that species
      is all in the headspace.
      All-liquid edge case: V_headspace ≈ 0 → P would be infinite from
      ideal gas. Instead: set P = high sentinel (e.g., 200 bar) and
      emit WARNING "Tank nearly all liquid — headspace too small for
      reliable pressure calculation."
    ACCEPT: Returns correct structure. Pure gas = ideal gas P. Mixed =
            liquid volume + headspace. Empty = P ≈ 0.
    TESTS: T236 — pure N2: P = nRT/V
           T237 — pure water (liquid at 300K): V_liq ≈ V, high P
           T238 — water + N2 mix: liquid water, N2 in headspace
           T239 — empty: P ≈ 0, level = 0
           T240 — overfull (more liquid than V): clamped, warning
           T241 — deterministic (same input → same output)

### F-005: Tank 5-Port Rewrite
    Wave 1, Phase 1
    WHAT: Replace 3-port tank with 5-port per B2.
    HOW: Change port defs. Rewrite tick to use computeTankState.
         liq_out draws from n_L at liqDrawRate. vap_out draws from
         n_V at vapDrawRate. Vent + liq_overflow per B2 safety logic.
         initInventory: no P_Pa. updateInventory: no inlet P copy.
    IMPLEMENTATION NOTES:
      The existing overflow logic (v10.6.1) maps onto vent + liq_overflow.
      Current overflow port (x:1,y:0) becomes vent. New liq_overflow at
      (x:1,y:2). Current mat_out (x:2,y:2) becomes liq_out. New vap_out
      at (x:2,y:0). mat_in moves from (x:0,y:2) to (x:0,y:1).
      updateInventory must account for FOUR outflows: liq_out, vap_out,
      vent, liq_overflow. Species balance:
        Δn[sp] = (inFlow[sp] − liqOut[sp] − vapOut[sp] − vent[sp]
                  − liqOv[sp]) × dt
      Temperature mixing: existing weighted-average approximation
      (unchanged from v10.x behavior).
      Breaking change: old scenes with tank connections will break
      (port IDs changed). Migration: map mat_out→liq_out, overflow→vent.
    ACCEPT: 5 ports. Phase-constrained outlets. P from computeTankState.
    TESTS: T242 — liq_out draws liquid composition only
           T243 — vap_out draws vapor composition only
           T244 — no liquid → liq_out = 0, INFO diagnostic
           T245 — no vapor → vap_out = 0, INFO diagnostic
           T246 — sealed mode: P from headspace
           T247 — vented mode: P = P_atm
           T248 — vent: P > P_design, connected → WARNING + flow
           T249 — vent: P > P_rupture, unconnected → CATASTROPHIC
           T250 — liq_overflow: level > max, connected → WARNING
           T251 — liq_overflow: level 100%, unconnected → CATASTROPHIC
           T252 — param validation: V > 1000 rejected, P_rupt ≤ P_des rejected
           T253 — regression: adapted from existing tank tests

### F-006: Ideal Valve Rewrite
    Wave 1, Phase 2
    WHAT: Valve with Pout and deltaP modes, renamed ideal_valve.
    HOW: Per B4 spec. Already renamed in F-002.
    ACCEPT: Both modes correct. Isenthalpic. PH flash.
    TESTS: T254 — Pout mode: P_in > target
           T255 — Pout mode: P_in < target (clamped, INFO)
           T256 — deltaP mode: normal
           T257 — deltaP mode: clamped to 0
           T258 — isenthalpic (H_out = H_in)
           T259 — regression: existing valve tests adapted

### F-007: Pressure Role Declarations
    Wave 1, Phase 2
    WHAT: Every unit declares pressure role per B5.
    HOW: Add pressure: { role, pairs } to each UnitRegistry entry.
    IMPLEMENTATION NOTES:
      This is the big registration sweep. Every unit in the B5 table gets
      a pressure block. For passthrough units, the pattern is:
        pressure: {
          role: 'passthrough',
          pairs: [{ inPortId: 'mat_in', outPortId: 'mat_out',
                    paramKey: 'deltaP_bar' }]
        }
      For 'none' units: pressure: { role: 'none' }
      For anchor/boost/drop: pressure block includes a resolve function
      that returns { deltaP_Pa } computed from tick results.
      Mixer: pressure: { role: 'passthrough', special: 'min_inlet' }
    ACCEPT: Every registered unit has pressure declaration matching B5.
    TESTS: T260 — all units have pressure.role
           T261 — roles match B5 table (automated check)

### F-008: deltaP_bar on Passthrough Units
    Wave 1, Phase 2
    WHAT: Fixed ΔP parameter on every passthrough unit.
    HOW: Add param with default 0, validate min:0 max:50.
         HEX gets two params.
    ACCEPT: Param exists. Non-zero shows in resolve. Default = 0.
    TESTS: T262 — heater ΔP=2: resolve returns 2e5 Pa
           T263 — HEX hot ΔP independent of cold ΔP
           T264 — default 0: no change to existing behavior
           T265 — regression: all unit tests pass

### F-009: UnionFind + buildPressureNodes
    Wave 1, Phase 3
    WHAT: Data structure + node graph builder.
    HOW: UnionFind in Block 1 (DOM-free). buildPressureNodes creates
         one node per material port, unions by wire.
    ACCEPT: Connected ports share zone. Passthrough: in ≠ out node.
    TESTS: T266 — UnionFind ops
           T267 — connected ports same zone
           T268 — unconnected separate
           T269 — passthrough in/out different nodes

### F-010: analyzePressureTopology
    Wave 1, Phase 3
    WHAT: Pre-run analysis. Zones, anchors, conflicts, overrides.
    HOW: Count anchors per zone. Detect mismatches and overrides.
    ACCEPT: Report lists all issues.
    TESTS: T270 — two anchors same P: no conflict
           T271 — two anchors diff P: conflict
           T272 — ideal_source in anchored zone: override INFO
           T273 — floating zone: no errors

### F-011: Connection-Time Analysis
    Wave 1, Phase 3
    WHAT: Run topology check when user connects wires (Block 2).
    HOW: analyzePressureTopology after connect(). Gray out P on
         overridden ideal_sources.
    ACCEPT: Conflict visible on connect.
    TESTS: (Block 2 — manual verification via test scene)

### F-012: Tank Pressure Anchor
    Wave 1, Phase 4
    WHAT: Tank registers as pressure anchor.
    HOW: sealed → headspace P. vented → P_atm. Mode switch changes.
    TESTS: T274 — sealed at headspace P
           T275 — vented at P_atm
           T276 — mode switch changes value

### F-013: atmosphere_sink Unit
    Wave 1, Phase 4
    WHAT: New unit per B3.
    HOW: Register. Anchor at P_atm. Palette in PRESSURE category.
    TESTS: T277 — anchor at P_atm
           T278 — tracks SimSettings change
           T279 — two in same zone: no conflict
           T280 — palette renders

### F-014: atmosphere_source Anchor
    Wave 1, Phase 4
    WHAT: atmosphere_source (renamed in F-002) now anchors at P_atm.
    HOW: Add anchor resolve to existing registration.
    TESTS: T281 — atmosphere_source anchors at P_atm
           T282 — ideal_source does NOT anchor (still 'none')

### F-015: BFS Pressure Propagation
    Wave 1, Phase 5
    WHAT: propagatePressures(ctx, scene) per B5 algorithm.
    HOW: Block 1. Integrate into solveScene post-tick (NNG-7).
    IMPLEMENTATION NOTES:
      The BFS must handle bidirectional inference: if we know P on
      one side of a ΔP relation, we can compute the other side.
      This means: seed anchors, then propagate outward AND inward
      through drop/boost/passthrough relations.
      Key subtlety: a zone with one anchor and a chain of ΔP relations
      should propagate to all nodes in the chain, regardless of
      direction. E.g.: unknown ← valve(ΔP=3) ← tank(5bar) → heater →
      unknown. Both endpoints get computed: upstream of valve = 5bar,
      downstream = 2bar. Downstream of heater = 5bar (ΔP=0).
      Conflict: two paths arrive at same node with different P.
      Keep the higher-priority one. Emit alarm on disagreement.
      The propagation must NOT affect mass/energy balance — it only
      writes P values to streams and emits diagnostics.
    ACCEPT: Chains resolve. Conflicts detected. Mass/energy unchanged.
    TESTS: T283 — chain: tank(5) → valve(ΔP=4) → atm → middle=1bar
           T284 — reverse inference through valve
           T285 — boost: pump propagation
           T286 — conflict: two tanks, different P
           T287 — override: ideal_source overridden (INFO)
           T288 — floating: all unknown, no errors
           T289 — passthrough with ΔP > 0
           T290 — HEX: hot/cold independent
           T291 — mixer: warning on mismatch
           T292 — mass/energy unchanged

### F-016: Pressure Diagnostics
    Wave 1, Phase 5
    WHAT: AlarmSystem source for pressure issues.
    HOW: New source function. Messages NNG-12.
    TESTS: T293 — conflict = ERROR
           T294 — all messages causal

### F-017: Production Gating
    Wave 1, Phase 6
    WHAT: Step/Play blocked on pressure ERROR.
    HOW: Extend gate check in TimeClock/playLoop.
    TESTS: T295 — Step blocked on ERROR
           T296 — Step OK on WARNING
           T297 — Play blocked on ERROR
           T298 — Test always runs

### F-018: Traffic Light + Canvas + Demo
    Wave 1, Phase 6
    WHAT: Pressure dot in traffic light. Canvas annotations.
          End-to-end demo scene.
    HOW: Traffic light reads alarm state. Canvas shows P on connections
         (optional setting). Demo: tank → valve → atmosphere_sink.
    TESTS: T299 — traffic light green/amber/red
           T300 — ideal-only flowsheet: always green
           T301 — end-to-end: build, fix, Play
           T302 — regression: full suite
    SCENE: Demo flowsheet saved as test scene (see B6 protocol)

### F-019: valve_flow
    Wave 2, Phase 7
    WHAT: Flow control bypass valve per B4.
    TESTS: T303 — flow cap: inlet 10, target 5 → main=5, bypass=5
           T304 — target > inlet: all to main, bypass empty
           T305 — target = 0: all to bypass
           T306 — mass balance: main + bypass = inlet
           T307 — energy balance: H_main + H_bypass = H_in
           T308 — bypass unconnected + excess: ERROR
           T309 — multi-component: composition fractions preserved
           T310 — pressure passthrough: P unchanged

### F-020: valve_cv_cap
    Wave 2, Phase 8
    WHAT: Simplified Cv valve per B4.
    TESTS: T311 — open 100%: passes all (if Q_max > inlet)
           T312 — partial open: caps flow at Cv-computed limit
           T313 — closed 0%: all to bypass
           T314 — no ΔP available: warning, passes all
           T315 — mass balance exact
           T316 — does not change pressure node values

### F-021: HEX Effectiveness Fix
    Wave 2, Phase 9
    WHAT: Enthalpy-based ε when phase change detected. Display only —
          energy balance already correct via PH flash.
    HOW: Detect phase change (inlet vs outlet phase differ). When
         detected: ε = Q / Q_max_enthalpy instead of Q / (Cmin × ΔT).
    TESTS: T317 — gas-gas: effectiveness unchanged (Cp-based valid)
           T318 — condensing: effectiveness from enthalpy ratio
           T319 — outlet T/P unchanged (energy balance not touched)
           T320 — regression: existing HEX tests

### F-022: Live Parameter Changes
    Wave 2, Phase 10
    WHAT: Param edit during Play → re-solve. Blocking alarm → auto-pause.
    HOW: Inspector remains editable during Play. Next tick uses new
         values. If new solve produces blocking alarm → auto-pause +
         diagnostic toast. Topology change during Play → auto-pause.
    TESTS: T321 — change valve Pout during Play → next tick uses it
           T322 — change creates blocking alarm → auto-pause
           T323 — topology change → auto-pause
           T324 — resume after fix → Play continues

### F-023: Forge Integration
    Wave 2, Phase 11
    WHAT: NNG-12 audit, demo, edge cases, performance.
    HOW: Lint all alarm messages for NNG-12. Demo scenario with Cv valve.
         Every unit type connected to sealed tank. 30-unit perf check.
    TESTS: T325 — all alarms pass NNG-12 lint
           T326 — demo scenario runs clean
           T327 — every unit × tank: no crash
           T328 — performance: 30 units < 50ms
           T329 — export/import round-trip with pressure data
           T330 — full regression

### F-024 through F-029: Meridian (design only)
    F-024 Flow from pressure | F-025 ΔP correlations | F-026 PID
    F-027 Mission/career | F-028 Separator | F-029 Ideal valve retirement


═══════════════════════════════════════════════════════════════════
SECTION D — PHASE TRACKER
═══════════════════════════════════════════════════════════════════

[ ] → [x] when done. Add notes. Add BF-xx for bugfixes.

    ═══ WAVE 1: HERMES (v11.x) ═══════════════════════════

    PHASE 0: Foundation (v11.0.0) ─────────────────────────
    F-001 NNG consolidation
    F-002 Boundary unit renames
    F-003 Diagnostic upgrade
    [ ] 0a  NNG rewrite (16 rules + philosophy)
    [ ] 0b  Renames: source→ideal_source, sink→ideal_sink,
            source_air→atmosphere_source, valve→ideal_valve
    [ ] 0c  Merge source_multi into ideal_source
    [ ] 0d  Port ID standardization (out→mat_out, in→mat_in)
    [ ] 0e  Scene import migration (old defIds + portIds → new)
    [ ] 0f  4 diagnostic rewrites + remediation fields
    [ ] 0g  Build Phase 0 test scene
    Tests: T226-T235 | Gate: —/235
    Notes:

    PHASE 1: Vessel (v11.1.0) ─────────────────────────────
    F-004 computeTankState
    F-005 Tank 5-port rewrite
    [ ] 1a  computeTankState function
    [ ] 1b  Tank 5-port tick rewrite
    [ ] 1c  Phase-constrained outlets
    [ ] 1d  Safety ports (vent + liq_overflow)
    [ ] 1e  Inventory: no P_Pa, no P copy
    [ ] 1f  Param bounds + validation
    [ ] 1g  Export on PG + inspector update
    [ ] 1h  Build Phase 1 test scene
    Tests: T236-T253 | Gate: —/253
    Notes:

    BF-01: ────────────────────────────────────────────────
    [ ] (reserved for post-vessel bugfixes)
    Notes:

    PHASE 2: Causality (v11.2.0) ──────────────────────────
    F-006 Ideal valve rewrite
    F-007 Pressure role declarations
    F-008 deltaP_bar on passthrough units
    [ ] 2a  Ideal valve tick (Pout + deltaP)
    [ ] 2b  Pressure roles on ALL units
    [ ] 2c  deltaP_bar params everywhere
    [ ] 2d  HEX dual ΔP
    [ ] 2e  Build Phase 2 test scene
    Tests: T254-T265 | Gate: —/265
    Notes:

    BF-02: ────────────────────────────────────────────────
    [ ] (reserved)
    Notes:

    PHASE 3: Topology (v11.3.0) ───────────────────────────
    F-009 UnionFind + buildPressureNodes
    F-010 analyzePressureTopology
    F-011 Connection-time analysis
    [ ] 3a  UnionFind class
    [ ] 3b  buildPressureNodes
    [ ] 3c  analyzePressureTopology
    [ ] 3d  Integrate into solveScene
    [ ] 3e  Connection-time UI (Block 2)
    [ ] 3f  Build Phase 3 test scene
    Tests: T266-T273 | Gate: —/273
    Notes:

    PHASE 4: Anchors (v11.4.0) ────────────────────────────
    F-012 Tank pressure anchor
    F-013 atmosphere_sink
    F-014 atmosphere_source anchor
    [ ] 4a  Tank anchor resolve
    [ ] 4b  atmosphere_sink unit
    [ ] 4c  atmosphere_source → anchor
    [ ] 4d  Build Phase 4 test scene
    Tests: T274-T282 | Gate: —/282
    Notes:

    PHASE 5: Propagation (v11.5.0) ────────────────────────
    F-015 BFS propagation
    F-016 Pressure diagnostics
    [ ] 5a  propagatePressures BFS
    [ ] 5b  Integrate into solveScene
    [ ] 5c  Pressure AlarmSystem source
    [ ] 5d  NNG-12 messages
    [ ] 5e  Build Phase 5 test scene
    Tests: T283-T294 | Gate: —/294
    Notes:

    BF-03: ────────────────────────────────────────────────
    [ ] (reserved)
    Notes:

    PHASE 6: Gate (v11.6.0) ───────────────────────────────
    F-017 Production gating
    F-018 Traffic light + canvas + demo
    [ ] 6a  Step/Play gating
    [ ] 6b  Traffic light pressure dot
    [ ] 6c  Canvas annotations
    [ ] 6d  Demo scenario + test scene
    Tests: T295-T302 | Gate: —/302
    Notes:

    ═══════════════════════════════════════════════════════
    HERMES GATE: —/302 (77 new tests)
    ═══════════════════════════════════════════════════════

    ═══ WAVE 2: FORGE (v12.x) ════════════════════════════

    PHASE 7: Flow Valve (v12.0.0) ─────────────────────────
    F-019 valve_flow
    [ ] 7a-d  Implementation + test scene
    Tests: T303-T310 | Gate: —/310

    PHASE 8: Cv Valve (v12.1.0) ───────────────────────────
    F-020 valve_cv_cap
    [ ] 8a-d  Implementation + test scene
    Tests: T311-T316 | Gate: —/316

    PHASE 9: HEX (v12.2.0) ───────────────────────────────
    F-021 HEX effectiveness
    [ ] 9a-b  Implementation
    Tests: T317-T320 | Gate: —/320

    PHASE 10: Live Params (v12.3.0) ───────────────────────
    F-022 Live parameter changes
    [ ] 10a-c  Implementation
    Tests: T321-T324 | Gate: —/324

    PHASE 11: Integration (v12.4.0) ───────────────────────
    F-023 Forge integration
    [ ] 11a-d  Audit + demo + sweep
    Tests: T325-T330 | Gate: —/330

    ═══════════════════════════════════════════════════════
    FORGE GATE: —/330 (28 new tests)
    ═══════════════════════════════════════════════════════

    ═══ WAVE 3: MERIDIAN — design only ═══════════════════
    F-024 through F-029. Design after Forge.
    ═══════════════════════════════════════════════════════


═══════════════════════════════════════════════════════════════════
SECTION E — SESSION PROTOCOL
═══════════════════════════════════════════════════════════════════

    FOR ANY IMPLEMENTATION SESSION:

    1. Read THIS DOCUMENT
    2. Read processThis.html NNG section
    3. Find current phase (first unchecked in Section D)
    4. Read feature specs in Section C for that phase
    5. Build test scene FIRST (per B6 protocol)
    6. Implement. Run ALL tests after each change.
    7. Update Section D: check tasks, fill gate, add notes
    8. Present test scene + code to user

    RULES:
    - Phase N+1 requires Phase N gate green
    - ALL previous tests must still pass
    - Design seems wrong? Note it in D, ask before changing
    - Test numbers approximate — adjust, update range in D
    - Keep this document updated

═══════════════════════════════════════════════════════════════════
END OF DOCUMENT
═══════════════════════════════════════════════════════════════════
