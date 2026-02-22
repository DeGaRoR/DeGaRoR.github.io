# RELEASESPEC_S2_power_management.md
# processThis — S2: Power Management
# Baseline: v12.10.0 + S1

═══════════════════════════════════════════════════════════════════
GOVERNING SPEC
═══════════════════════════════════════════════════════════════════

  v13_power_spec.md — complete and authoritative.

This document adds implementation phasing and tests. The design
in v13_power_spec.md is unchanged.


═══════════════════════════════════════════════════════════════════
SUMMARY
═══════════════════════════════════════════════════════════════════

Four problems fixed:

  A. sink_electrical Infinity demand → ratedPower_kW param
  B. No overload/fry logic → severity-scaled overload detection
  C. Uniform hub allocation → priority-based load shedding
  D. Direct connections lack curtailment → formalized demand-response


═══════════════════════════════════════════════════════════════════
DEPENDENCY
═══════════════════════════════════════════════════════════════════

  Requires: S1 (alarm source infrastructure, _rationalize())
  Required by: S6 (electrochemical reactor power demand contract)


═══════════════════════════════════════════════════════════════════
IMPLEMENTATION NOTES
═══════════════════════════════════════════════════════════════════

### A. sink_electrical rated capacity

    Add param: ratedPower_kW (default 1000, min 0.1, max 100000)
    powerDemand = ratedPower (not Infinity)
    Hub: demands rated, curtailed like others
    Surplus port: absorbs up to rated
    Inspector: absorbed_W, headroom, overload status

### B. Overload/fry logic

    ratedPower on all consumers. Detection threshold:
      received_W > ratedPower × (1 + margin)
      margin = 0.05 (5% tolerance)

    Severity:
      5–20% over  → WARNING
      20–50% over → ERROR
      >50% over   → CRITICAL → fry state

    Fry state:
      Unit stops computing (ξ=0, Q=0, ΔP=0)
      Visual indicator (existing fry icon)
      Persists until user: replaces unit OR resets via inspector
      Alarm: "Equipment destroyed by electrical overload.
        Received X kW, rated for Y kW. Replace unit."

    Applies to: sink_electrical, compressor, pump, heater,
    reactor_equilibrium (fixed/isothermal mode).

### C. Hub priority allocation

    Priority levels: CRITICAL (1), NORMAL (2), DEFERRABLE (3)
    New param on all consumers: powerPriority (default NORMAL)

    Allocation when supply < demand:
      1. Allocate CRITICAL fully (up to supply)
      2. Remaining → NORMAL (curtailed uniformly if short)
      3. Remaining → DEFERRABLE (curtailed uniformly if short)
      4. If CRITICAL alone > supply → curtail CRITICAL uniformly

    Load shedding: shed DEFERRABLE first, then NORMAL.
    Surplus: cap at connected sink capacity.

### D. Direct connection model

    grid_supply → consumer (no hub):
      actualDraw = min(supply_capacity, consumer_demand)
      If actualDraw > consumer_rated → overload (per B)
      Curtailment factor = actualDraw / demand (passed to consumer)


═══════════════════════════════════════════════════════════════════
PHASE TRACKER
═══════════════════════════════════════════════════════════════════

  [ ] 2a  sink_electrical: ratedPower_kW, kill Infinity
  [ ] 2b  ratedPower on all electrical consumers
  [ ] 2c  Overload detection + severity scaling
  [ ] 2d  Fry state (persists, blocks compute, requires reset)
  [ ] 2e  Hub priority allocation (CRITICAL/NORMAL/DEFERRABLE)
  [ ] 2f  Load shedding logic
  [ ] 2g  Direct connection curtailment signaling
  [ ] 2h  Tests

  Tests: ~8 new
    - Hub: 3 priorities, supply < demand → DEFERRABLE shed first
    - Hub: supply < CRITICAL alone → CRITICAL curtailed
    - Surplus overload: hub surplus > sink rated → fry
    - Direct overload: oversized grid → undersized consumer → fry
    - Fry persistence: unit stays fried after overload removed
    - Fry reset: user intervention clears fry state
    - sink_electrical: ratedPower finite, curtailed on hub
    - Balance closure: overload energy accounted in system balance

  Gate: all S1 tests + ~8 new pass.
