# Process Grid v3.4.0 — Comprehensive Code Review

## PART 1: GENERAL CODE REVIEW

---

### 1.1 BUGS

**BUG-1 (HIGH): Energy balance validator multiplies power streams by 1000x**

Lines 5979-5988. The post-solve energy balance check assumes heat/mechanical/electrical stream `available` values are in kW and multiplies by 1000 to convert to J/s. However, **all power streams store `available` in W (J/s) already**. Evidence:
- Generator (line 4241): `available: W_elec_W`
- Power hub (line 5772): `available: totalSupply_W`
- Electric heater (line 4331): `available: Q_available_W`
- Pump work (line 3285): `W_hydraulic_W = V_m3ps * deltaP` — clearly in W.

The `* 1000` on lines 5981, 5983, 5987 inflates the energy contribution by 1000x, making the energy balance check meaningless for any unit with power or heat ports. Similarly, on line 5983, it reads `stream.demand` for heat output, which is often zero (demand writeback happens elsewhere), so heat outputs are underreported.

Additionally, line 5983 reads `stream.demand` for heat output ports, but no unit ever sets `demand` on a `heat_out` port — they set `available`. So heat outputs are always counted as zero. The validator should read `stream.available` on output heat ports too.

**Root cause**: The file header (lines 25-27) and registry comments (lines 3821-3823) document stream formats as `{ QkW }` and `{ WkW }`, implying kilowatts. But the actual implementation uses `{ available, demand }` properties in **watts**. This documentation-code mismatch is what led to the erroneous `*1000` conversion. The documentation should be updated to reflect the actual `available`/`demand` pattern in watts.

**Fix:** Remove the `* 1000` multiplier, use `stream.available` directly (already in J/s = W), and on line 5983 read `stream.available` instead of `stream.demand` for heat output ports. Update the header/registry docs to match actual stream format.

**BUG-2 (MEDIUM): Duplicate `flash_drum` registration**

The `flash_drum` unit is registered twice:
- Line 4878: `name: 'L-V Separator'`, port `in` for inlet
- Line 5114: `name: 'Flash Drum'`, port `mat_in` for inlet

The second registration silently overwrites the first (JavaScript `Map.set` behavior). The first has port ID `in`, the second has `mat_in`. If any saved scene was created with the first definition, its connections to port `in` would break on reload. The dead code at line 4878 should be removed.

**BUG-3 (LOW): Generator does not account for loss heat**

The generator converts `W_mech` to `W_elec = W_mech × η`. The lost energy `W_mech × (1 - η)` vanishes — it is not emitted as heat to any port. For strict energy balance, the generator should have a `heat_out` port for dissipation losses, or at minimum track the loss in diagnostics so the global balance checker doesn't flag it.

Same issue applies to the motor (line 4285): `W_elec_W * eta` becomes mechanical, `W_elec_W * (1 - eta)` disappears.

**BUG-4 (LOW): Source unit has no temperature validation**

The source unit (line 3885) converts `par.T + 273.15` to Kelvin. If a user enters T = -300°C, the resulting T would be -26.85 K, which is below absolute zero. No clamp or validation exists. This could cause NaN cascades in downstream Cp/enthalpy calculations.

---

### 1.2 CODING BEST PRACTICES

**GOOD:**

- Consistent `"use strict"` mode
- Clean class hierarchy: `ThermoPackage → IdealRaoultPackage → PengRobinsonPackage`
- `ThermoAdapter` as a single-entrypoint pattern is excellent — prevents the bypassing of the package system
- Comprehensive inline documentation with ASCII art diagrams (power hub, battery)
- `ErrorSeverity` enum with natural-language `ErrorCatalog` is user-friendly and extensible
- Warning deduplication via `_warnedRanges` Set
- Thoughtful handling of VL-undefined-quality edge case in enthalpy calculations

**AREAS FOR IMPROVEMENT:**

- **Monolithic file**: ~13,900 lines in a single HTML file. This is becoming unwieldy. Even if staying as a single HTML file for deployment simplicity, the logical sections (thermo, units, solver, UI, tests) should be clearly delimited. Consider splitting into ES modules for development with a build step that concatenates.

- **Magic numbers**: `1e-12`, `1e-15`, `0.9999`, `1.0001`, `100000` appear frequently without named constants. E.g., `const FLOW_EPSILON = 1e-12` and `const P_ATMOSPHERE = 101325` would improve readability.

- **Test suite coupled to production code**: The ~3000-line test suite is embedded in the production HTML, loaded unconditionally, and auto-runs on every page load. This should be a separate file loaded conditionally (e.g., `?test=true` query param).

- **`u.last` is both diagnostic and state**: The `u.last` object serves as both runtime state storage (read by the solver and demand rollup) and display diagnostics (read by the UI). These concerns should be separated. A `u.state` for solver-relevant data and `u.display` for UI-only data would prevent accidental coupling.

- **JSON serialization for change detection**: The solver uses `JSON.stringify` comparison (line 5553/5646) which is expensive and brittle (key order sensitivity). A hash or version counter on each port would be faster and more reliable.

---

### 1.3 THERMODYNAMICS — BACKGROUND & IMPLEMENTATION

**Excellent aspects:**

- Enthalpy reference state (liquid at 298.15K) is correctly and consistently maintained through the `_getVaporEnthalpyOffset` mechanism. The path-independent H(T, phase) formulation using `Hv`, `Tb`, and Cp integration is thermodynamically sound.
- Clausius-Clapeyron-consistent Antoine equation implementation with multi-range support for water.
- Correct Rachford-Rice with Newton-Raphson for multi-component VLE.
- PH flash with single-component special handling (lever rule in two-phase region) is a nice touch.
- Isentropic work calculations for compressor/turbine use the correct `T₂/T₁ = (P₂/P₁)^((γ-1)/γ)` relation.

**Areas needing attention:**

- **γ evaluated at inlet only**: `computeCompressorWork` and `computeTurbineWork` compute `γ` from Cp at the inlet T only. For large compression ratios, the outlet temperature is significantly different, and `γ = Cp/Cv` varies. The correct approach would be to integrate along the isentropic path or use a mean Cp. For educational purposes this is acceptable, but it introduces error at high compression ratios (>3:1).

- **Missing departure functions for non-ideal gas**: The PR EOS stub correctly falls back to ideal gas. When implementing it, the departure function approach (`H = H_ig + H_dep`) is the right architecture but will require solving the cubic for Z-factor roots at every temperature step in PH flash, which is computationally expensive.

- **No entropy**: The absence of entropy calculations means the code cannot validate isentropic processes independently. Currently, "isentropic" temperature is computed from the ideal gas relation, not from actually finding T where `S_out = S_in`. When PR is implemented, this distinction becomes critical.

- **Heat exchanger approach temperature mode**: The 0.8 scaling factor on line 4788/4795 is a heuristic, not a proper heat exchanger calculation. For educational purposes, implementing ε-NTU or LMTD would be valuable.

---

### 1.4 POWER MANAGEMENT SYSTEM

The power management architecture is well-designed for its scope. The four-step demand rollup (A: copy demands, B: propagate through converters, C: hub balancing, D: battery direct writeback) runs inside the solver loop and converges naturally through successive substitution.

**Strengths:**
- Battery vs. fixed source distinction enables realistic dispatch (merit order)
- Curtailment factor propagation through converters (motor, e-heater) is elegant
- Surplus → heat dissipation closes the energy balance for overproduction
- The `_hubDemand_W` writeback to batteries is clean

**Weaknesses (detailed in Part 2):**
- No protection against hub-to-hub connections
- No protection against power loops
- Mechanical pathway is underdeveloped
- Direct coupling (turbine → compressor) doesn't model physical reality

---

### 1.5 ROBUSTNESS

**Good:**
- Phase checks on compressor (liquid = CATASTROPHIC) and pump (vapor = MAJOR) with appropriate severity
- Flash calculation guards: zero-flow, bracket checks, convergence metadata
- Graceful fallback for missing Antoine data, missing Cp, etc.
- The VL-undefined-quality pathway never passes `'VL'` to single-phase functions

**Needs improvement:**
- **No NaN propagation guards**: If any thermo calculation returns NaN (e.g., from out-of-range polynomial), it silently propagates through enthalpy sums and contaminates the entire downstream chain. A NaN check after each `hMolar` call would be cheap.
- **No infinite loop protection in the power demand rollup**: If a power cycle exists (hub → motor → generator → hub), the demand rollup will oscillate forever. The outer solver's MAX_ITER=20 caps this, but the solver will report "not converged" without identifying the circular power loop as the cause.
- **No temperature sanity bounds**: Nothing prevents a PH flash from returning 50,000K or -100K as a "converged" solution if the enthalpy input is nonsensical.

---

### 1.6 ARCHITECTURE & SEPARATION OF CONCERNS

**Layer separation assessment:**

| Layer | Status | Notes |
|-------|--------|-------|
| Component Registry | ✅ Clean | Self-contained, well-validated |
| Thermo Package System | ✅ Excellent | Clean abstraction, proper delegation |
| Model Registry | ✅ Good | Extensible, handles package switching |
| Unit Registry | ⚠️ Fair | Unit `tick` functions reference global `thermo` directly |
| Solver | ⚠️ Mixed | Forward computation is clean; power rollup is tightly coupled |
| Rendering/UI | ⚠️ Mixed | SVG rendering and property editing are inline |
| Tests | ❌ Coupled | Embedded in production, shares global state |

The biggest structural issue is that **unit tick functions reference the global `thermo` adapter**. If the thermo adapter were passed as a parameter to `tick(u, ports, par, thermo)`, units would be testable independently and the architecture would support multiple simultaneous thermo contexts.

---

### 1.7 RANKED FEATURE PRIORITIES

Based on the current codebase maturity and impact:

1. **Fix BUG-1 (energy balance validator)** — trivial fix, high impact on validation trustworthiness
2. **Remove duplicate flash_drum** — trivial, prevents confusion
3. **NaN propagation guards** — low effort, prevents cascading silent failures
4. **Entropy implementation** — unlocks proper isentropic validation and future Rankine/Brayton cycle analysis
5. **Temperature sanity bounds in source/PH flash** — guards against user input errors
6. **Separate test suite from production** — improves load time and maintainability
7. **Direct mechanical coupling (turbine↔compressor overdriven mode)** — requested feature
8. **Hub-to-hub and power loop protection** — prevents user from creating unsolvable circuits
9. **Peng-Robinson implementation** — unlocks non-ideal gas accuracy
10. **Reactor unit** — major new functionality (indicated by empty REACTOR category)
11. **ε-NTU heat exchanger** — more physically meaningful than the current heuristic
12. **State of Charge (SOC) for batteries** — transforms battery from static to dynamic

The codebase is in strong shape for adding new units. The `UnitRegistry.register` pattern, the `ThermoAdapter` delegation, and the `StreamType` system make it straightforward to add new equipment. The main prerequisite for more advanced features is entropy.

---

## PART 2: CRITICAL REVIEW OF POWER MANAGEMENT SYSTEM

---

### A. Consumer Behavior Audit: Pump, Compressor, and All Power Consumers

**Compressor** (line 4525): ✅ Correctly implemented.
- Sets `u.powerDemand = workFull.W_shaft_W` (full setpoint demand)
- Checks `sPower.available` for actual limit
- Computes partial compression via `computeCompressorFromWork` when curtailed
- Produces an outlet at reduced pressure with correct enthalpy balance

**Pump** (line 4401): ⚠️ Mostly correct, but with a subtle gap.
- Sets `u.powerDemand = workFull.W_shaft_W` ✅
- Checks `sPower.available` for actual limit ✅
- Computes partial pressurization via `computePumpFromWork` when curtailed ✅
- **Gap**: The pump checks `W_avail = sPower ? sPower.available : Infinity` (line 4437). When `sPower` is null (no mechanical connection), `W_avail = Infinity` and the pump operates at full setpoint with no power cost. The compressor has the identical pattern at line 4551. This is consistent between the two units, and works as a "self-powered" fallback, but it means `powerDemand` is set without any source consuming that energy. A cleaner approach: either (a) require power connection (emit a warning if disconnected) or (b) add an explicit `selfPowered: true` parameter that suppresses `powerDemand` and skips energy balance checking for the power port. The current behavior creates a hidden energy source for any unit without a power connection.

**Test case for the pump through the full chain:**

```
Source(H2O, 25°C, 1 bar, L) → Pump(10 bar, η=0.70) → Sink
                                 ↑ power_in
Battery(5kW) → Motor(η=0.92) → mech_out
```

Expected behavior:
1. Pump computes `W_shaft = V·ΔP / η`. For 1 mol/s H2O: V ≈ 1.8e-5 m³/s, ΔP = 9e5 Pa → W_hyd ≈ 16.2 W → W_shaft ≈ 23.1 W. This is tiny, well within 5kW.
2. Motor reads pump's `powerDemand` = 23.1 W, converts to electrical: 23.1/0.92 ≈ 25.1 W.
3. Hub (or battery) sees 25.1 W demand, supplies it.
4. Pump reaches full setpoint (10 bar).

This chain should work correctly with the current code. The demand propagation path:
- Step A: `ud.powerDemand = u.powerDemand` (23.1 W for the pump)
- Step B: Motor finds downstream pump, reads 23.1 W, converts to 25.1 W electrical demand
- Step C (or D): Hub/battery provides 25.1 W

**Electric heater** (line 4303): ✅ Correctly uses curtailment-aware pattern. Reads `curtailmentFactor` from `elecIn` and caps at available. Demand propagation through Step B is handled.

**Motor** (line 4266): ✅ Correctly uses curtailment-aware pattern. The `_powerDemand_W` carry-forward ensures the motor requests the right amount on re-tick.

**All consumers use the same demand propagation mechanism**: Yes. The chain is:
1. Consumer sets `u.powerDemand` in its `tick()`
2. Step A copies to `ud.powerDemand`
3. Step B: If a motor/heater is upstream, it reads downstream `powerDemand` and converts to electrical demand
4. Step C: Hub aggregates demands and dispatches supply

---

### B. Multiple Power Hubs Connected Together

**Current behavior if Hub1.elec_out → Hub2.elec_in:**

Hub2 would treat Hub1 as a non-battery source (since Hub1's `defId !== 'battery'`). Hub1's `elec_out.available` would be added to Hub2's `fixedSupply_W`. This creates several problems:

1. **Supply double-counting**: The same power that Hub1 distributes to its own consumers also appears as "available" to Hub2. There is no mechanism for Hub1 to reduce its advertised availability based on its own consumer load.

2. **Demand non-propagation**: Hub2's consumers' demands are never propagated back to Hub1. Hub1 sees only its direct consumers' demands. Hub2's demand for "more power from Hub1" has no pathway.

3. **Curtailment incompatibility**: If Hub1 emits `curtailmentFactor = 0.8` on its `elec_out`, Hub2 treats `elec_out.available` as a fixed supply number (it reads `available`, not `curtailmentFactor`). Hub2 would not know it's receiving curtailed power.

4. **Oscillation risk**: If Hub1 → Hub2 and Hub2 has consumers, the solver could oscillate: Hub2 demands X from Hub1, Hub1 can only provide Y < X, Hub2 curtails, demand drops, Hub1 has surplus, Hub2 sees more available, etc.

**Recommendation**: In the near term, **prevent hub-to-hub connections** at the `connect()` validation level. In the longer term, implement a hierarchical hub protocol where hubs can communicate available capacity and demand.

---

### C. Direct Turbine-to-Compressor Mechanical Coupling

**Current behavior:**

If turbine's `mech_out` connects to compressor's `power_in`:
- Turbine produces `W_shaft_W` as `mech_out.available`
- Compressor reads `sPower.available = W_shaft_W`
- If `W_shaft_W > W_shaft_setpoint`: compressor uses only setpoint demand, excess mechanical power is wasted (no surplus pathway)
- If `W_shaft_W < W_shaft_setpoint`: compressor is curtailed to achievable pressure

**What's missing — the "overdriven" compressor:**

In a real direct-coupled system (e.g., a gas turbine driving a compressor on the same shaft), the compressor **must absorb all the shaft power**. It cannot "refuse" excess power — the shaft RPM would increase until the aerodynamic loading matches. This manifests as a higher-than-setpoint compression ratio.

The requested behavior is:
- `W_available > W_setpoint` → Compressor is driven ABOVE setpoint pressure
- `W_available < W_setpoint` → Compressor is driven BELOW setpoint pressure (already works)
- `W_available = W_setpoint` → Compressor hits setpoint exactly

**Proposed design:**

Add a **coupling mode** parameter to the compressor (and pump):

```
couplingMode: 'setpoint' | 'absorb_all'
```

- `setpoint` (default, current behavior): Compressor consumes min(demand, available).
- `absorb_all`: Compressor consumes ALL available mechanical power. The achievable outlet pressure is computed via the existing `computeCompressorFromWork()` reverse calculation, but **without capping at Pout_setpoint**.

In `absorb_all` mode:
1. Compute `W_shaft_available` from `sPower.available`
2. Use `computeCompressorFromWork(sIn, W_shaft_available, eta)` → get `P_actual`
3. If `P_actual > Pout_setpoint`, set a diagnostic: "Overdriven: actual Pout exceeds setpoint"
4. If `P_actual < Pout_setpoint`, set the existing curtailment diagnostic
5. Use `P_actual` as outlet pressure (not clamped to setpoint)

The setpoint becomes a "controller target" — it's what the operator wants, but the actual result depends on available power. The UI would display both setpoint and actual, with color coding (green = at setpoint, yellow = above, red = below).

**Implementation phases:**

Phase 1: Add `couplingMode` parameter, default to `'setpoint'`.
Phase 2: Implement `'absorb_all'` in compressor `tick()` — remove the `Math.min(rev.P_actual, Pout_setpoint)` cap.
Phase 3: Same for pump.
Phase 4: UI indication (over/under setpoint badges).

---

### D. Edge Cases and Failure Modes

**D1: Circular power loop (hub → motor → generator → hub)**

A user could create: Hub.elec_out → Motor → mech → Generator → elec → Hub.elec_in. This creates infinite power from nothing. The generator's output would be added to Hub's `fixedSupply_W`, which increases `elec_out.available`, which increases Motor input, which increases Generator output... This diverges.

**Mitigation**: The solver's MAX_ITER=20 caps it, but the error message would be cryptic ("Max iterations reached"). 

**Recommended fix**: During connection validation, do a depth-first cycle check on power-type connections. If connecting A.power_out → B.power_in would create a cycle in the power graph, reject it with a clear message: "Power cycle detected — would create infinite energy."

**D2: Zero-flow material stream through compressor/pump**

If a compressor has `power_in` connected but `mat_in` has zero flow, `nTotal = 0` and `cpMix = 0`. The `gamma = Cp/Cv` calculation divides by `cvMix = cpMix - R = -8.314`, giving negative gamma. `Math.pow(ratio, negative/negative)` still works but is physically meaningless.

**Mitigation**: Add an early return in `computeCompressorWork` if `nTotal < 1e-12`:
```javascript
if (nTotal < 1e-12) return { W_isentropic_W: 0, W_shaft_W: 0, ... };
```

**D3: Negative pressure in reverse compressor calculation**

`computeCompressorFromWork` computes `P_actual = P_in * (T_isen / T_in)^(γ/(γ-1))`. If `W_shaft_avail_W` is zero or negative (e.g., from a hub with zero supply), `T_isen ≤ T_in` and the guard returns `P_actual = P_in`. This is correct. No issue here.

**D4: Hub with only batteries (no fixed sources)**

`fixedSupply_W = 0`, `gap_W = totalDemand_W`, `batteryDraw_W = min(totalDemand_W, batteryMax_W)`. Surplus calculation: `max(0, 0 - totalDemand_W) = 0`. Curtailment: `totalSupply_W / totalDemand_W`. This is all correct. No edge case.

**D5: Hub with no consumers connected**

`totalDemand_W = 0`. Curtailment: `if (totalDemand_W > 0 && ...) { ... }` — skipped, stays at 1.0. `surplus_W = max(0, fixedSupply_W - 0) = fixedSupply_W`. All fixed supply goes to heat. This is correct — a hub with sources but no load dumps everything as heat.

**D6: Multiple consumers sharing one elec_out port**

Hub's `elec_out` is a single port. Multiple consumers connect to it. In the solver (line 5528-5539), standard single-connect ports only read from ONE connection: `const conn = scene.connections.find(...)`. But wait — that's for the consumer's `elec_in` port, not the hub's `elec_out`. Each consumer has its own `elec_in` port that connects to the hub's `elec_out`. The hub's `elec_out` stream is shared by all consumers. This works because:
- All consumers read the SAME `elec_out` stream (same `available`, same `curtailmentFactor`)
- Each consumer independently decides how much to draw based on its own `_powerDemand_W * curtailmentFactor`
- The hub's Step C sums all consumers' demands for balancing

This is correct and analogous to a shared bus voltage.

**D7: Race condition between hub Step C and converter Step B**

Steps B and C run in sequence within each iteration. Step B propagates demand through motors/heaters. Step C reads those demands for hub balancing. The order is correct: B runs first, C reads B's results. On the next iteration, C's curtailment affects tick() results, which affect demands, which B propagates again. This converges.

---

### E. Mechanical Pathway Assessment

The mechanical pathway is currently minimal:

**What exists:**
- `StreamType.MECHANICAL` with purple color
- `source_mechanical`: fixed-output mechanical source
- Turbine produces `mech_out`
- Compressor/pump consumes `power_in` (MECHANICAL)
- Motor converts electrical → mechanical
- Generator converts mechanical → electrical

**What's missing:**

1. **No mechanical hub/bus**: Electrical has a hub; mechanical has nothing equivalent. If a turbine needs to drive both a compressor and a generator simultaneously (common in real plants), there's no way to split the shaft power. You'd need a "mechanical splitter" or a "shaft bus."

2. **No mechanical demand rollup**: Step B only handles motors and electric heaters. If a generator is connected downstream of a turbine, there's no demand propagation from generator back to turbine. The turbine just produces what the thermodynamics dictate — it doesn't modulate based on load.

3. **No shaft speed concept**: Real mechanical coupling is through rotational speed, not power. A turbine-compressor pair on the same shaft must rotate at the same speed, which determines both the turbine power output and compressor power input simultaneously. This is a fundamentally different model from the current "power bus" approach.

**Is it robust enough right now?**

For the current scope (turbine → generator → hub → motor → compressor), yes. The mechanical pathway is simply a passthrough: turbine produces X watts, generator converts to electrical, hub distributes, motor converts back to mechanical, compressor consumes. There's no mechanical splitting, no speed matching, no multiple mechanical consumers.

**What would break:**
- Two generators on one turbine (no mechanical splitter)
- Two turbines driving one compressor (no mechanical merger)
- Turbine speed matching with compressor characteristic curve (no shaft speed model)

**Recommendation for near-term:**

Don't try to model shaft speed — that's a deep rabbit hole involving compressor maps and turbine characteristics. Instead:

Phase 1: Add a **mechanical splitter** (analogous to electrical hub but simpler). Takes one `mech_in`, has multiple `mech_out` ports, splits power proportionally to downstream demands.

Phase 2: Add demand rollup for mechanical connections (analogous to Step B for electrical). This would allow a turbine to "see" its downstream load.

Phase 3 (optional, advanced): Add the `absorb_all` coupling mode from section C, which is the simplest approximation of shaft coupling without modeling speed.

---

## PHASED IMPLEMENTATION PLAN

### Phase 0: Bug Fixes (effort: ~1 hour)
- Fix BUG-1: Remove `*1000` in energy balance validator (lines 5981, 5983, 5987)
- Fix BUG-2: Remove duplicate flash_drum registration (line 4878 block)
- Add NaN guard after `hMolar` calls in `computeStreamEnthalpy`
- Add temperature validation to source unit (clamp to [1, 5000] K)

### Phase 1: Power Robustness (effort: ~4 hours)
- Add connection validation: reject hub-to-hub power connections
- Add power cycle detection (DFS on power-type connections)
- Add zero-flow guard in `computeCompressorWork` / `computeTurbineWork`
- Add `source_mechanical` icon if missing (it has the `ico-mechanical` symbol, verify linkage)
- Add test case for pump through full chain (Battery → Motor → Pump)

### Phase 2: Direct Coupling Mode (effort: ~6 hours)
- Add `couplingMode` parameter to compressor and pump
- Implement `absorb_all` mode: remove Pout cap in `computeCompressorFromWork` when overdriven
- Add UI display: setpoint vs actual with color indicator
- Add test cases: overdriven compressor, underdriven compressor, turbine→compressor chain
- Add documentation: coupling mode behavior, when to use each

### Phase 3: Mechanical Pathway (effort: ~8 hours)
- Implement mechanical splitter/bus unit
- Add demand rollup for mechanical connections (extend Step B)
- Add generator demand propagation (generator reads downstream electrical demand, reports mechanical demand upstream)
- Test: Turbine → [mechanical bus] → Generator + Compressor

### Phase 4: Architecture Cleanup (effort: ~6 hours)
- Separate test suite into conditional-load module
- Split `u.last` into `u.state` (solver) and `u.display` (UI)
- Pass `thermo` as parameter to `tick()` instead of global reference
- Extract magic numbers into named constants
- Replace JSON.stringify change detection with port version counters

### Phase 5: Entropy & Advanced Thermo (effort: ~12 hours)
- Implement entropy calculation in `IdealRaoultPackage`
- Add isentropic validation (compare T_isentropic from relation vs. from entropy matching)
- Prepare entropy framework for PR EOS departure functions
- Add Brayton/Rankine cycle validation test cases
