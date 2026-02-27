# S5-lite Phase Tracker
## v13.6.0 → v14.0.0

---

## Pre-Implementation Design — COMPLETE

- [x] Original S5 spec review + stale refs identified
- [x] Architecture: 2 vessel defIds (tank + reservoir) per NNG-3
- [x] Architecture: 2 throttle defIds (valve + restriction) per NNG-3
- [x] Trace with P_current tracking: boosts (pump/comp), drops (restriction/turbine)
- [x] Trace mathematically equivalent to S5-full algebraic solver for K_path=0
- [x] Valve = pressure regulator with setpoint validation (look-through when invalid)
- [x] Sink = process boundary at P_atm (not a device)
- [x] Pump/compressor curtailment: Pout_actual from previous tick
- [x] Splitter = active flow divider (gear-type, not passive tee)
- [x] Flow divider check valve alarm (per-branch P_eff >= P_in detection)
- [x] Tank 5-port model: mat_in, gas_out, liq_out, vent, overflow
- [x] Tank: P emergent from computeTankState(), no tankMode parameter
- [x] Tank: dual Cv outlets (vapor/liquid phase draws)
- [x] Tank: relief valve (P_relief) + overflow (overflow_level), both always active
- [x] Tank: safety k-values hardcoded proportional to V, not in profiles
- [x] Tank: initInventory from (composition, T_init, P_init) or (composition, T_init, level_init)
- [x] Tank: adiabatic mixing for T evolution in updateInventory
- [x] Tank: 2h x 3w footprint with port labels
- [x] Tank dP alarm: distinguishes equalized (dP=0) from reverse (dP<0)
- [x] TimeClock audit: 6 bugs identified, F-012 spec written
- [x] S5-advanced scope reduced (~480 lines residual, passive tee if needed)
- [x] 20 scenarios validated against S5-full formula
- [x] S5-lite spec v6 FINAL

## Open Design Decisions

- [ ] Sink J-T correction: ideal (T_out~T_in) vs PR correction?
  Recommendation: ideal for S5-lite, defer PR to future.
- [ ] Source consolidation: confirmed deferred to S-CLEAN.

---

## S5a-0: TimeClock fixes (prerequisite)

- [ ] T0_SECONDS constant (43200) — replace all hardcoded literals
- [ ] Fix import: t = T0_SECONDS (was 0)
- [ ] Fix Test button: restore inventories + reset t/frame before re-solve
- [ ] Fix _captureInitial gap: step() captures mid-sim units
- [ ] Export version 17: save t, frame, mode, inventoryInitial
- [ ] Import version 17: restore t, frame, mode, _initial
- [ ] Legacy import (<=16): t = T0_SECONDS (backward compat)
- [ ] Delete old tank tests 169-174 (old model, replaced in S5a-2)
- [ ] Adapt tests 160-161 (t=0 start -> T0_SECONDS)
- [ ] Tests T-TC01-T-TC08
- [ ] Regression gate: 399 - 6 + 8 = 401

## S5a-1: computeTankState + trace + helpers

- [ ] computeTankState() pure function (Block 1)
- [ ] K_RELIEF_BASE, K_OVERFLOW_BASE constants
- [ ] _inventoryMW, _compositionMW helpers
- [ ] resolveDownstreamPressures() + traceToAnchor()
      Tank: trace gas_out and liq_out independently
      Reservoir: trace mat_out
      Result keyed by "unitId:portId"
- [ ] valveStatus + dividerStatus caches in solver context
- [ ] Export on PG
- [ ] Tests T-PS01-T-PS06 (computeTankState)
- [ ] Tests T-PS33-T-PS42 (trace, incl. dual outlet)
- [ ] Regression gate: 401 + 16 = 417

## S5a-2: units + profiles

- [ ] Replace tank registration (5-port, 2h x 3w footprint)
      Ports: mat_in, gas_out, liq_out, vent, overflow
      Dual Cv outlets (vapor/liquid phase draws)
      Relief valve (automatic, P > P_relief)
      Overflow (automatic, level > overflow_level)
      Connected/unconnected safety port logic
- [ ] Tank initInventory (gas mode: P_init, liquid mode: level_init)
- [ ] Tank updateInventory (5-port mass balance, adiabatic T mixing)
- [ ] Tank inspector layout (status, gas/liq outlets, safety, init)
- [ ] Port labels on canvas
- [ ] Reservoir registration (1-port, Cv tick)
- [ ] Sink enhancement (boundary, dual reporting)
- [ ] Restriction registration (fixed dP)
- [ ] _isenthalpicThrottleTick shared function
- [ ] Valve migration to shared tick + setpoint validation
- [ ] Valve display name -> "Pressure Regulator"
- [ ] Splitter display name -> "Flow Divider"
- [ ] Splitter check valve alarm (reads dividerStatus)
- [ ] Equipment annotation comments (valve, splitter, restriction)
- [ ] 7 profile registrations (2 tank, 3 reservoir, 1 restriction)
- [ ] Remove old tank profile
- [ ] Scene import migration (remove drawRate/tankMode, mat_out->liq_out)
- [ ] Pressure alarm source (replace placeholder)
- [ ] Tests T-PS07-T-PS32 (tank, reservoir, sink, restriction)
- [ ] Tests T-PS43-T-PS46 (valve validation, divider diagnostics)

## S5a-3: integration + regression

- [ ] Full regression gate T-PS47 (448 tests)
- [ ] Version bump v14.0.0

---

## Deferred (not S5-lite scope)

| Topic | When |
|---|---|
| Source consolidation (3 defIds -> 1) | S-CLEAN phase |
| Port naming harmonization | S-CLEAN phase |
| Distillation P_column_bar -> Pa | S-CLEAN phase |
| S5-advanced: k_resistance | On demand (~50 lines) |
| S5-advanced: passive tee | On demand (~80 lines, needs k_resistance) |
| S5-advanced: zone diagnostics | On demand (~200 lines) |
| S5-advanced: pressure loop convergence | On demand (~150 lines) |
| Sink J-T correction (PR real gas) | Future enhancement |
| Alarm refinement (code field, cause->consequence, INFO path) | Alarm sprint |
| Tank sub-stepping (internal dt subdivision) | Future: accurate safety integration at large dt |
| Adaptive dt (auto-adjust based on inventory rate-of-change) | Future |
