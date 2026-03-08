# PTIS S5-advanced SPEC (DEFERRED)
## S5-advanced — Full Pressure Network
### Prerequisite: S5-lite complete (v14.0.0)

**Status:** Deferred. S5-lite's trace is mathematically equivalent to
S5-full's algebraic solver for K_path = 0. This document preserves
the residual scope for future implementation if gameplay demands it.

---

## What S5-lite Delivers

| Capability | Mechanism |
|---|---|
| Tank headspace pressure | computeTankState() pure function |
| Cv-based flow from vessels | Tank/reservoir tick, Q from ΔP |
| Downstream pressure discovery | resolveDownstreamPressures() trace |
| Valve = pressure regulator | Anchor when setpoint valid; look-through + WARNING when not |
| Restriction = fixed ΔP | Drop — trace accumulates, continues |
| Pump/compressor = boost | Trace adds to driving force, uses Pout_actual for curtailment |
| Gas turbine = drop | Trace subtracts from driving force |
| Process boundary | Enhanced sink at P_atm, isenthalpic expansion reporting |
| Active flow splitting | Flow divider enforces ratio (gear-type), check valve per branch |
| Mixer pressure conflict | Existing check valve zeros weaker inlet |
| Backflow prevention | Check valves on valve, turbine, divider; reverse pressure alarm on vessels |
| Power curtailment | Natural time-stepping convergence via Pout_actual |

### S5-lite Limitations (Quantified)

| Limitation | Max error at pilot scale | Player workaround |
|---|---|---|
| K_path = 0 (no equip ΔP) | ~0.025 bar | Add restriction unit |
| Regulator look-through | Slight overestimate | Set Pout above downstream P |

The flow divider's ratio-based split is not a limitation — it is a
different device (active divider) from a passive tee.

---

## S5-advanced Residual Scope

### 1. Equipment Resistance (k_resistance)

Add `k_resistance` parameter to transparent units (heater, reactor,
HEX, mixer). The trace accumulates `k × Q²` as additional drops.

**Formula change:**
```
Q = √( ΔP_static / (1/C + K_path) )
K_path = Σ(k_i) for all equipment on the path
```

**Impact:** ~0.025 bar at pilot-scale flow rates. Only matters for
very long pipe runs or intentionally high-resistance equipment.

**Estimate:** ~50 lines. Add k_resistance to each unit's limitParams,
accumulate in trace, modify Cv equation to include K_path denominator.

### 2. Passive Tee (New defId)

New unit: `tee` — splits flow by downstream conductance, not by set
ratio. Requires solving a system of equations to determine the split
based on each branch's total resistance.

**Requires:** K_path computation (item 1 above) to calculate
per-branch conductance. Without equipment resistance, all branches
have identical conductance and the tee degenerates to equal split.

**Design:** The tee would compute per-branch conductance from the
trace results, then split flow proportionally:
```
Q_branch_i = Q_total × (C_i / Σ(C_j))
```

The flow divider (existing splitter) remains available for active
ratio control. Player chooses between active (divider) and passive
(tee) based on their design intent.

**Estimate:** ~80 lines. New defId, registration, profile, tick that
reads per-branch conductance from trace.

### 3. Zone Diagnostics

Visual overlay showing pressure zones — groups of units at the same
nominal pressure connected by transparent equipment. Traffic-light
coloring: green (balanced), amber (marginal ΔP), red (reverse/zero).

**Requires:** BFS zone identification from trace results. Pure
visualization — does not change any computation.

**Estimate:** ~200 lines. BFS grouping, SVG overlay rendering,
legend, toggle in toolbar.

### 4. Pressure Loops (Convergence)

Outer convergence loop for flowsheets with pressure cycles (e.g.,
tank → heater → tank with restrictions in both directions). The
current trace handles self-loops naturally (anchor terminates), but
multi-unit cycles through transparent equipment could oscillate.

**Current mitigation:** visited-set cycle guard returns P_atm.
Sufficient for S5-lite because all P-stamping devices are anchors
and naturally terminate the trace.

**S5-advanced enhancement:** Iterative convergence for cycles through
transparent equipment with k_resistance. Successive substitution on
zone pressures until ΔP residuals converge.

**Estimate:** ~150 lines. Outer loop wrapper around trace, convergence
check, max-iteration guard.

---

## Dependency Graph

```
1. k_resistance (standalone)
   ↓
2. Passive tee (requires k_resistance)

3. Zone diagnostics (standalone, uses trace results)

4. Pressure loops (requires k_resistance for non-trivial cases)
```

Items 1 and 3 are independent. Item 2 requires 1. Item 4 requires 1
for meaningful behavior.

---

## Total Estimate

| Feature | Lines | Priority |
|---|---|---|
| k_resistance | ~50 | Low |
| Passive tee | ~80 | Low |
| Zone diagnostics | ~200 | Medium |
| Pressure loops | ~150 | Low |
| **Total** | **~480** | |

---

## When to Implement

When gameplay demands it. Specific triggers:

- Player feedback requesting visible ΔP through heaters → k_resistance
- Mission design requiring automatic passive splitting → passive tee
- UX testing showing players confused by pressure relationships → zones
- Flowsheet designs with unavoidable pressure cycles → convergence loop

None of these are currently blocking. S5-lite covers all pilot-scale
physics with bounded, negligible error.
