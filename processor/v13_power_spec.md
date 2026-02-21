# v13 Power Management Revision — Spec

## Context
v12 unified all energy transport onto ELECTRICAL streams, retiring HEAT streams.
This exposed several design gaps in the power allocation model that were patched
but not properly resolved. v13 addresses these systematically.

## Problems Identified in v12

### 1. sink_electrical has powerDemand = Infinity
- Zero-impedance bolted fault — starves every other consumer on a shared bus
- No user-visible parameter (not WYSIWYG)
- Physical mapping: dump load / grid export / generic load — all have finite capacity
- Currently only used as hub surplus visualizer, not an independent unit with physics

### 2. No electrical overload/fry logic
- Curtailment exists (underpowered: compressor can't reach setpoint, reactor starved)
- But no overload detection: "you received more power than your rating"
- Fry concept exists visually (icon state) but has no electrical trigger in engine
- Real equipment has rated power — exceeding it has consequences

### 3. Hub allocation model is simplistic
- Single curtailment factor applied uniformly to all consumers
- Real systems have priority levels (critical vs deferrable loads)
- No load-shedding logic — everything dims equally
- Surplus computation works but surplus port behavior is underspecified

### 4. Direct connections bypass demand-response
- grid_supply → consumer without hub: allocation uses `actualDraw_W = min(capacity, demand)`
- Works after v12.9.0 finite demand fix, but no curtailment signaling
- Consumer sees full allocation or nothing — no partial response

## v13 Scope

### A. sink_electrical rated capacity
- Add `ratedPower_kW` parameter (default 1 MW)
- powerDemand = ratedPower (kill Infinity)
- On shared hub: demands rated power, gets curtailed like everything else
- On surplus port: absorbs up to ratedPower
- Inspector: absorbed_W, headroom, overload status

### B. Electrical overload/fry logic
- Define `ratedPower` for all electrical consumers (or use existing params as proxy)
- Detection: `received_W > ratedPower * (1 + margin)` → overload error
- Severity scaling: minor (5% over) → major (20% over) → catastrophic (50%+ over)
- Fry state triggers visual indicator (already exists in rendering)
- Applies to: sink_electrical, compressor, pump, electric_heater, reactor (fixed mode)

### C. Hub allocation revision
- Priority-based allocation (critical / normal / deferrable)
- Load-shedding: when supply < demand, shed deferrable first
- Surplus handling: cap at connected sink capacity, flag overload if exceeded
- Consider: should hub itself have a rated throughput?

### D. Direct connection model
- Formalize demand-response for hubless connections
- Partial allocation signaling (curtailment factor on direct wires)
- Consider: should direct connections be deprecated in favor of mandatory hubs?

## Design Principles (from v12 discussions)

**WYSIWYG (NNG-3)**: Physics doesn't judge intent. User connects 500 kW to a 50 kW
load → 500 kW flows → load fries. User sees parameters, physics executes.

**Finite demand everywhere**: No unit should declare Infinity demand. Every consumer
has a physical basis for its demand: isothermal duty, compression work, heating
setpoint, rated absorption capacity.

**Overload is not curtailment**: Curtailment = not enough power (graceful degradation).
Overload = too much power (equipment damage). Different failure modes, different
severity, different user response.

## Test Plan Sketch
- Shared hub: 3 consumers with different priorities, supply < total demand
- Surplus overload: hub surplus exceeds sink rating → fry
- Direct overload: oversized grid → undersized consumer → fry  
- Mixed network: reactor (isothermal) + compressor + sink on one hub
- Fry state persistence: unit stays fried until user intervenes
- Balance closure: all overload energy accounted for in system balance
