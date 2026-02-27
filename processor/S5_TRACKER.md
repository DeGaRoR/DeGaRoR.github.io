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
- [x] Flow divider check valve alarm (per-branch P_eff ≥ P_in detection)
- [x] Tank ΔP alarm: distinguishes equalized (ΔP=0) from reverse (ΔP<0)
- [x] S5-advanced scope reduced (~480 lines residual, passive tee if needed)
- [x] 20 scenarios validated against S5-full formula
- [x] S5-lite spec v4 FINAL

## Open Design Decisions

- [ ] Sink J-T correction: ideal (T_out≈T_in) vs PR correction?
  Recommendation: ideal for S5-lite, defer PR to future.
- [ ] Source consolidation: confirmed deferred?
  Recommendation: yes, separate cleanup session.

---

## S5a-1: computeTankState + trace + helpers

- [ ] computeTankState() pure function (Block 1)
- [ ] _inventoryMW, _compositionMW helpers
- [ ] resolveDownstreamPressures() + traceToAnchor()
- [ ] valveStatus + dividerStatus caches in solver context
- [ ] Export on PG
- [ ] Tests T-PS01–T-PS06 (computeTankState)
- [ ] Tests T-PS27–T-PS36 (pressure trace)
- [ ] Regression gate: 399 + 16 = 415

## S5a-2: units + profiles

- [ ] Replace tank registration (4-port, Cv tick, ΔP alarms)
- [ ] Reservoir registration (1-port, Cv tick)
- [ ] Sink enhancement (boundary, dual reporting)
- [ ] Restriction registration (fixed ΔP)
- [ ] _isenthalpicThrottleTick shared function
- [ ] Valve migration to shared tick + setpoint validation
- [ ] Valve display name → "Pressure Regulator"
- [ ] Splitter display name → "Flow Divider"
- [ ] Splitter check valve alarm (reads dividerStatus)
- [ ] Equipment annotation comments (valve, splitter, restriction)
- [ ] 7 profile registrations (2 tank, 3 reservoir, 1 restriction, remove old tank)
- [ ] Scene import migration (mat_in→feed_in, remove drawRate)
- [ ] Pressure alarm source (replace placeholder)
- [ ] Tests T-PS07–T-PS26 (tank, reservoir, sink, restriction)
- [ ] Tests T-PS37–T-PS40 (valve validation, divider diagnostics)

## S5a-3: integration + regression

- [ ] Full regression gate T-PS41 (440 tests)
- [ ] Version bump v14.0.0

---

## Deferred (not S5-lite scope)

| Topic | When |
|---|---|
| Source consolidation (3 defIds → 1) | Cleanup session |
| Port naming harmonization | Cleanup session |
| S5-advanced: k_resistance | On demand (~50 lines) |
| S5-advanced: passive tee | On demand (~80 lines, needs k_resistance) |
| S5-advanced: zone diagnostics | On demand (~200 lines) |
| S5-advanced: pressure loop convergence | On demand (~150 lines) |
| Sink J-T correction (PR real gas) | Future enhancement |
| Alarm refinement (code field, cause→consequence, INFO path) | Alarm sprint |
