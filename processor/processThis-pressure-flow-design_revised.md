# processThis — Pressure-Driven Flow Design
## Reservoir + Resistance Model
### February 2026

---

## Principle

All flow originates from pressure difference through resistance. No unit in the game stamps a flow rate from user input. The player designs systems by choosing vessel sizes, valve openings, and equipment — the flow rate is a consequence, not an input.

---

## NNG-17: No Flow-Pressure Iteration

Flow through Cv restrictions is computed algebraically from anchor pressures, path resistances, and ΔP budgets. The solver never iterates between flow and pressure fields. Standalone valves specify ΔP only. Cv exists only on reservoir/tank outlet ports. Every topology computes in bounded time with deterministic results. The solver never refuses to compute or fails to converge.

This is a permanent architectural constraint.

---

## Units

### Reservoir (enhanced tank)

Single unit, two modes.

**Finite mode:** Physical vessel. Has volume, inventory (mol per species), temperature. `computeTankState()` derives P from headspace gas via ideal gas / PR EOS. Inventory integrates over time: `n(t+dt) = n(t) + (Σn_in − Σn_out) × dt`. Tank drains, fills, pressurizes, depressurizes dynamically.

**Reservoir mode:** Infinite source. Fixed P, T, composition. Inventory never depletes. Atmosphere = reservoir(vented, air composition). Gas cylinder = reservoir(sealed, user P, user composition).

**Ports (5):**

| Port | Direction | Phase | Cv params | Notes |
|---|---|---|---|---|
| feed_in | IN | Any | — | Passive. Accepts whatever arrives. |
| liq_out | OUT | Liquid only | Cv, opening_pct | Draws from liquid inventory |
| vap_out | OUT | Vapor only | Cv, opening_pct | Draws from vapor headspace |
| overflow | OUT | Liquid | — | Safety. Activates on high level. |
| vent | OUT | Vapor | — | Safety. Activates on high pressure. |

**Outlet flow equation:**

```
Q_out = Cv × (opening/100) × √(ΔP_net / (SG × 1e5))
```

Where ΔP_net is the net pressure budget from this anchor to the downstream anchor, accounting for all path resistances, ΔP valves, and boost elements. SG = MW_avg / MW_ref (species-appropriate reference). Q clamped ≥ 0.

**Parameters:**

| Param | Default | Range | Notes |
|---|---|---|---|
| volume_m3 | 0.15 | 0.001–1000 | ∞ in reservoir mode |
| tankMode | sealed | sealed / vented | Vented → P = P_atm |
| reservoirMode | false | bool | true = infinite inventory |
| T_K | 298.15 | 50–2000 | Fixed in reservoir mode, evolves in finite |
| composition | {} | species map | mol fractions |
| P_charge_bar | — | 0.1–200 | Initial P for sealed reservoir mode |
| liq_Cv | 50 | 0.1–10000 | Outlet valve sizing |
| liq_opening_pct | 0 | 0–100 | 0 = closed |
| vap_Cv | 50 | 0.1–10000 | |
| vap_opening_pct | 0 | 0–100 | |
| P_design_bar | 10 | 1–100 | Vent alarm threshold |
| P_rupture_bar | 15 | P_design+0.5–200 | Catastrophic threshold |
| maxLiqLevel_pct | 90 | 50–99 | Overflow alarm threshold |

**Replaces:** source, source_multi, source_air, atmosphere_source, current tank. All consolidated into one unit with mode selection.

### ΔP Valve

Simple pressure drop. Two ports. Does not determine flow — consumes pressure budget.

| Port | Direction |
|---|---|
| in | IN |
| out | OUT |

**Modes:**
- `Pout`: P_out = min(P_in, target). If P_in < target → INFO alarm.
- `deltaP`: P_out = P_in − ΔP. If result < 0 → clamp to 0, ERROR alarm.

Isenthalpic. PH-flash on outlet. phaseConstraint = 'VL'.

Pressure role: **drop**. Consumes from the ΔP budget between anchors.

**Replaces:** current valve, ideal_valve. Single unit, two modes.

### Atmosphere Sink

Absorbs all inflow at P_atm. Pressure anchor. Unchanged from existing spec.

### Ideal Source / Ideal Sink

Training wheels. No pressure participation. User stamps rate (source) or absorbs all (sink). Pressure role: none. Available in sandbox/tutorial. Game mode uses reservoirs.

### All Other Units

Pressure role: **passthrough**. Each declares a resistance coefficient k and optionally a fixed ΔP_min.

```
ΔP_unit = ΔP_min + k × Q²
```

Where ΔP_min is a minimum drop (e.g. gravity head) and k captures flow-dependent friction.

| Unit | k default | ΔP_min | Physical basis |
|---|---|---|---|
| HEX (per side) | 1e3 | 0 | Tube-bundle friction |
| Reactor | 5e3 | 0 | Packed bed / catalyst |
| Column | 1e4 | 0 | Tray hydraulics |
| Mixer | 0 | 0 | Junction |
| Splitter | 0 | 0 | Junction |
| Compressor | 0 | 0 | Active boost (role: boost) |
| Pump | 0 | 0 | Active boost (role: boost) |
| Heater / Cooler | 500 | 0 | Coil friction |
| Flash drum | 100 | 0 | Inlet nozzle |

k units: Pa·s²/mol². Values above are order-of-magnitude pilot-plant defaults — tuned during S1 alongside equipment limits. The player can adjust k in the inspector (advanced parameter, collapsed by default).

---

## Solver: Path Analysis

### Definitions

**Anchor:** A unit that defines P at its ports. Tanks (from headspace), reservoirs (from setting), atmosphere_sink (P_atm).

**Path:** A sequence of units/connections from one anchor to another, passing through passthrough units and at most one boost/drop chain.

**Zone:** A connected set of ports sharing the same pressure (between resistance elements). The pressure graph from S5's BFS identifies zones and anchors.

### Single path: closed form

From anchor P₁ (source reservoir) through n passthrough units (with resistances k_i) and m ΔP valves (with drops ΔP_j) to anchor P₂ (destination):

```
ΔP_total = P₁ − P₂ + Σ(ΔP_boost) − Σ(ΔP_valve_j)

Q = √(ΔP_total / (1/C + K_path))
```

Where:
- `C = (Cv × opening/100)² / (SG × 1e5)` — outlet Cv conductance
- `K_path = Σ(k_i)` — total path resistance
- `ΔP_boost` = compressor/pump contributions (positive = adds to budget)
- `ΔP_valve_j` = ΔP valve contributions (positive = consumes budget)

If ΔP_total ≤ 0: Q = 0, alarm "Insufficient pressure to drive flow."

One equation, closed form, always computes.

### Parallel paths from same outlet: conductance addition

Source reservoir outlet splits into paths A and B reaching possibly different downstream anchors.

Each path i has total resistance R_i = 1/C_outlet + K_path_i (all resistances in series, including the shared Cv). But the Cv is shared — it limits total flow, not per-path flow.

Reformulate: let G_i = path conductance = 1/√K_i (excluding the Cv). Each path's flow if unrestricted: Q_i = G_i × √(P_junction − P_anchor_i).

**Same downstream anchor (P_A = P_B = P₀):**

```
Q_total = G_sum × √(P_s − P₀)     where G_sum = G_A + G_B
Q_total = √(C × (P₁ − P_s))       from Cv equation

Solve: P_s = (C × P₁ + G_sum² × P₀) / (C + G_sum²)
```

Linear in P_s. Direct solution. Then Q_A = G_A/G_sum × Q_total, Q_B = G_B/G_sum × Q_total.

**Different downstream anchors (P_A ≠ P_B):**

Single equation in P_s, monotonic, bounded between max(P_A, P_B) and P₁. Bisection converges in ≤20 iterations. Still always computes.

### Merge: independent sources

Two reservoir outlets feeding a mixer. Each computes Q independently from its own ΔP to the mixer node. Mixer sums flows, P_out = min(P_i). No interaction between sources.

### Recycle loops

Handled by existing successive substitution. Iteration 1: recycle = 0. Subsequent iterations: Q adjusts via Cv/resistance as pressure profile develops. Self-limiting (more recycle → more total flow → more resistance → lower Q). Converges naturally.

### Boost elements (compressor, pump)

Add to ΔP budget. Compressor stamps ΔP from user-set pressure_ratio or P_out target. Flow passes through at whatever rate the path delivers. If flow exceeds rated capacity → overload alarm (S2 mechanism). If flow below minimum → surge alarm (S1 equipment limits).

No operating-point iteration. The compressor trusts the upstream flow and boosts P. This is the NNG-17 trade: we lose self-consistent operating point for guaranteed convergence.

### Density correction

Gas density changes along a path as pressure drops. Using upstream SG everywhere overpredicts flow for large pressure ratios.

**Correction:** Geometric mean SG along the path.

```
SG_eff = √(SG_inlet × SG_outlet_est)
SG_outlet_est = SG_inlet × P_outlet / P_inlet    (ideal gas approximation)
```

One extra multiplication. No iteration. Gets within ~10% for pressure ratios up to 5:1. Sufficient for pilot-plant game scope.

---

## Solve Order (within one tick)

```
1. computeTankState() on all tanks/reservoirs → anchor pressures
2. BFS pressure propagation → zone pressures, identify paths
3. For each reservoir outlet with opening > 0:
   a. Trace path(s) to downstream anchor(s)
   b. Sum K_path = Σ(k_i), sum ΔP_fixed (valves, boosts)
   c. Compute ΔP_net
   d. If branching: solve for P_junction (linear or bisection)
   e. Compute Q per path
4. Set flow on each outlet port → propagate through units sequentially
5. Units tick: process Q through their models (reactions, heat exchange, etc.)
6. Update tank inventories: n += (Σn_in − Σn_out) × dt
```

Steps 1–3 are the pressure-flow layer. Step 4 feeds into the existing sequential solver unchanged. Step 6 closes the dynamic loop for the next tick.

---

## Topology Validation

The pressure solver handles every topology algebraically. No topology is refused. But some produce diagnostics:

| Topology | Behavior | Alarm |
|---|---|---|
| No downstream anchor | Q = 0 | ERROR: "No pressure boundary downstream of [unit]. Connect to a sink or vessel." |
| ΔP_net ≤ 0 | Q = 0 | INFO: "Insufficient pressure to drive flow from [tank] to [destination]." |
| All outlets closed (opening = 0) | Q = 0 | None (deliberate) |
| Zero-resistance path (K=0, no Cv limit) | Q → clamp | WARNING: "Zero-resistance path. Flow clamped at [max]. Add a valve or reduce opening." |
| Downstream P > upstream P | Q = 0 | INFO: "Reverse pressure gradient. Insert compressor/pump." |

---

## Migration from Current Model

| Current unit | Migration |
|---|---|
| source | → Reservoir(reservoir=true, sealed, user P/T/composition, vap_opening=100%) |
| source_multi | Same |
| source_air | → Reservoir(reservoir=true, vented, air composition, vap_opening from old flow rate) |
| sink | → Ideal Sink (unchanged) |
| tank | → Tank/Reservoir(reservoir=false) with Cv on outlets |
| valve | → ΔP Valve |
| atmosphere_source | → Reservoir(reservoir=true, vented) |

Old scenes: import maps old defIds → new. `flowRate_molps` on sources converts to an equivalent `opening_pct` given default Cv and estimated ΔP. Approximate but preserves behavior.

---

## What This Model Cannot Do

| Limitation | Impact | Mitigation |
|---|---|---|
| No compressor operating point (head-vs-flow curve intersection) | Player can't see surge/choke emerge naturally | Equipment limit alarms (S1): Q < surge_min or Q > choke_max |
| Density uses geometric mean approximation | ~10% flow error at pressure ratios > 5:1 | Acceptable for game accuracy. PR EOS improves SG estimate. |
| No pressure transients (water hammer, startup dynamics) | No time-dependent pressure waves | Out of scope permanently. Quasi-steady per tick. |
| ΔP valves don't interact with Cv (they consume fixed budget) | Valve can consume entire budget, leaving zero for Cv | Clear alarm. Player learns ΔP budgeting. |

These are permanent trade-offs for NNG-17 compliance. Full flow-pressure coupling (Newton-Raphson on network) would resolve the first three but at the cost of convergence reliability, solver opacity, and implementation complexity. The algebraic model always computes, always converges, and gives qualitatively correct answers. That's the right trade for a game.

---

## Roadmap Impact

This design folds into S5 as a unified stage (no a/b split):

- Tank rewrite: 5-port with Cv on outlets, reservoir mode, computeTankState()
- ΔP valve: replaces current valve
- Resistance parameter k: added to all passthrough units
- Path solver: ~50 lines algebraic solver (single path, branching, density correction)
- BFS propagation: identifies anchors, zones, paths (already scoped)
- Source migration: old sources → reservoir equivalents
- Ideal source/sink: kept for sandbox/learning

The Cv mechanism is not a separate feature bolted onto the pressure network — it IS the pressure network's reason for existing. Without it, pressures propagate but don't determine flow. With it, every flow has a physical origin.

---

## Constants and Units

| Symbol | Meaning | Unit |
|---|---|---|
| Q | Molar flow rate | mol/s |
| Cv | Valve flow coefficient | (mol/s) / √(Pa / (SG × 1e5)) |
| opening | Valve opening | % (0–100) |
| SG | Specific gravity | MW_mix / MW_ref (dimensionless) |
| k | Resistance coefficient | Pa·s²/mol² |
| ΔP | Pressure drop | Pa |
| K_path | Total path resistance | Pa·s²/mol² (= Σk_i) |
| C | Cv conductance | mol²·Pa⁻¹·s⁻² (= (Cv·open/100)²/(SG×1e5)) |
| G | Path conductance | mol·Pa⁻⁰·⁵·s⁻¹ (= 1/√K) |

Note: Cv here is defined in process-sim units (mol/s based), not in the traditional ANSI/ISA definition (gpm based). The conversion is straightforward but the internal representation uses SI-compatible units throughout, consistent with the rest of the thermo engine.
