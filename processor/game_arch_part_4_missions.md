# PROCESS THIS IN SPACE — Part IV: THE MISSIONS

---

# PART IV — THE MISSIONS

---

## 17. Mission Format

A mission is a self-contained challenge defined as a data object. It specifies everything needed to play: available equipment, chemistry, objectives, constraints, narrative hooks, and rewards.

### Schema

```
MissionDefinition {
  id              String          Unique identifier (e.g. 'px_m3_fuel')
  title           String          Display name
  description     String          One-line summary
  chapter         String          Phase A/B/C/D label

  atmosphere      String          Atmosphere preset ('planet_x')
  settings        { dt }          Solver timestep

  palette         { defId: count }        Which equipment types and how many
  inventory       { defId: max }          Placement caps (how many on-field total)
  paramLocks      { defId: { param: val }} Fixed parameter values (greyed, read-only)
  paramAllowed    { defId: { param: [values] }}  Dropdown filters
  tease           { defId: reason }       Greyed palette entries with narrative text

  species         [String]        Available compound IDs
  reactions       [String]        Available reaction IDs

  initialScene    JSON | null     Pre-built starting flowsheet (room + depletables)
  inheritScene    Boolean         Start from previous mission's final state
  inheritParts    Boolean         Carried palette adds to campaign inventory

  demands         [{ species, rate, label, critical }]   Survival demands on room
  objectives      [Objective]     Win conditions (see below)
  stars           [StarCriterion] 1-3 star thresholds

  briefing        [NarrativeBeat] Expert dialogue before mission
  events          [MidMissionEvent] Triggered during play
  debriefing      { success: [Beat], failure: [Beat] }

  hints           [{ after: trigger, text }]   Progressive Expert hints
  requires        [DependencyRef]  Prerequisite missions

  rewards {
    unlockedParts     { defId: count }
    unlockedMissions  [String]
    unlockedSpecies   [String]
    unlockedReactions [String]
  }
}
```

### Objective Types

| Type | What it checks | Key parameters |
|------|---------------|----------------|
| `convergence` | Solver converged | — |
| `store_component` | Tank contains target moles | species, minMoles, minPurity, requiredPhase |
| `sustained_flow` | Flow above threshold for duration | species, minFlow, duration_s, targetSink |
| `maintain_conditions` | T/P/composition in bounds at target | targetUnit, conditions, duration_s |
| `power_output` | Net electrical output above threshold | minPower_W, duration_s |
| `parts_remaining` | Unused parts in inventory | min count |

### Star Criteria

Stars reward efficiency, not just completion:
- ★ Complete all primary objectives
- ★★ Complete bonus objective (tighter spec, less equipment, faster)
- ★★★ Exceptional efficiency (parts remaining, energy efficiency, minimal waste)

---

## 18. Campaign Structure

```
PLANET X CAMPAIGN — "Planetfall"

  Phase A — SURVIVE (M1–M3)
    You build fragile, improvised supply chains.
    Everything is scarce. Every mistake costs battery.

  Phase B — STABILIZE (M4–M6)
    Steady power. Safe air. Warmth.
    The colony stops dying and starts living.

  Phase C — EXPAND (M7–M9)
    Nitrogen chemistry. Double power. Cryogenic reserves.
    The base becomes an industrial plant.

  Phase D — SUSTAIN (M10)
    Close the loop. Ecosystem as process network.
    The colony becomes self-sustaining.

  Dependency chain:
    M1 → M2 → M3 → M4 → M5 → M6 → M7 → M8 → M9 → M10
    (strictly linear — each mission builds on the last)
```

---

## 19. Timeline & Reserve Budget

### Starting Reserves

| Resource | Quantity | Unit | Daily burn (2 ppl) | Lifetime |
|----------|----------|------|--------------------|----------|
| O₂ cylinders | 4 × 75 = 300 mol | Pressurized bottles | 24 mol/day | 12.5 days |
| Shelter O₂ (atm.) | 94 mol usable (21%→16%) | Atmosphere drawdown | 24 mol/day | 3.9 days |
| LiOH cartridges | 20 × 13.4 = 268 mol CO₂ | Solid absorbent | 20 mol CO₂/day | 13.4 days |
| Water jerricans | 40 L = 2,222 mol | 4 × 10L cans | 166 mol/day | 13.4 days |
| Battery bank | 75 kWh | Li-ion modules | ~4.8 kWh/day baseline | 15.6 days |
| Emergency rations | 200 MREs | ~100 kg total | 4/day (2 ppl) | 50 days |

### Vent Gas (Primary Resource)

| Parameter | Value |
|-----------|-------|
| Flow rate | 0.002 kg/s (single vent) |
| Composition | 30% H₂O, 35% CO₂, 25% N₂, 10% CH₄ |
| Molar flow | 0.068 mol/s |
| Temperature | 500 K |
| Pressure | ~1 atm |

Species flows: H₂O 0.0204, CO₂ 0.0238, N₂ 0.0170, CH₄ 0.0068 mol/s

Second vent (discovered M4): 0.005 kg/s, same composition.
Combined: 0.007 kg/s total → CH₄ 0.0170 mol/s.

### Production Rate Summary

| Mission | Target | Production Rate | Time to Target | Energy Cost |
|---------|--------|-----------------|----------------|-------------|
| M1 Water | 100 mol H₂O | 61.8 mol/hr | 1.6 hr | 0.4 kWh |
| M2 Oxygen | 50 mol O₂ | 5.18 mol/hr | 9.6 hr | 11.6 kWh |
| M3 Fuel | 20 mol CH₄ | 20.5 mol/hr | 1.0 hr | 0.25 kWh |
| M4 Power | 5 kW continuous | Instant once built | — | Net producer |
| M5 Air | 500 mol clean air | ~1,270 mol/hr | 24 min | ~4 kW draw |
| M6 Warmth | 5 kW heat at 295K | Continuous | — | 2 kW draw |
| M7 Fertilizer | 10 mol NH₃ | 9.9 mol/hr | 1.0 hr | 0.7 kW draw |
| M8 More Power | +3 kW (→8 kW total) | Instant once built | — | Net producer |
| M9 Reserves | 50 mol liq O₂ | 338 mol/hr (steady) | ~9 min + cooldown | ~4 kW draw |
| M10 Biosphere | Close CO₂/O₂/H₂O loop | Continuous | — | ~82 kW (grow lights) |

### Day-by-Day Reserve Depletion

```
DAY  BATTERY  WATER     O₂        CO₂ CARTS  FOOD   EVENT
     (kWh)    (mol)     (mol)     (of 20)    (MREs)
───  ───────  ────────  ────────  ─────────  ─────  ──────────────────
 0   75.0     2,222     394       20         200    CRASH (2 survivors)
 2   65.6     ▶SUPPLY   346       18         192    ██ M1 WATER
 4   49.2     ═══════   ▶SUPPLY   16         184    ██ M2 OXYGEN
 7   40.0     ═══════   ═══════   14         176    ██ M3 FUEL
10   25.8     ═══════   ═══════   10         160    ██ M4 POWER ⚡
     ═════════════════ FIRST AUTONOMY ════════════════════════
     Battery recharging. Water, O₂ flowing. Power independent.
15   GRID     ═══════   ═══════   ▶AIR       140    ██ M5 AIR
     ═════════════════ FULL SURVIVAL AUTONOMY ════════════════
     All countdowns stopped. Remaining threat: FOOD.
17   GRID     ═══════   ═══════   ═══════    132    +1 survivor (3)
22   GRID     ═══════   ═══════   ═══════    102    ██ M6 WARMTH
                                                    +2 survivors (5)
29   GRID     ═══════   ═══════   ═══════     40    ██ M7 FERTILIZER
                                                    +2 survivors (7)
                                                    🌱 Greenhouse ON
36   GRID     ═══════   ═══════   ═══════      0    ██ M8 MORE POWER
                                                    Food: greenhouse only
42   GRID     ═══════   ═══════   ═══════     ——    ██ M9 RESERVES
45+  GRID     ═══════   ═══════   ═══════     ——    ██ M10 BIOSPHERE
```

### Margin Analysis

| Reserve | Fatal day | Saved by | Save day | Margin | Feel |
|---------|-----------|----------|----------|--------|------|
| Water | 14 | M1 | 2 | 12 days | Comfortable |
| O₂ | 17 | M2 | 4 | 13 days | Comfortable |
| Battery | 16 | M4 | 10 | 6 days | Moderate |
| CO₂ carts | 19 | M5 | 15 | 4 days | Tight |
| Food | ~36 | M7+M8 | 29+36 | ~0 days | Razor edge |

Design intent: early missions have comfortable margins (player is learning). CO₂ is tighter (player is experienced by M5). Food is razor-edge (maximum tension for M7-M8).

### Slow Player Tolerance

| Player speed | Days to M4 | Battery at M4 | Days to M5 | CO₂ margin |
|-------------|------------|---------------|------------|------------|
| Fast (1.5d/mission) | 6 | 51 kWh | 9 | 10 days |
| Normal (2.5d/mission) | 10 | 26 kWh | 15 | 4 days |
| Slow (4d/mission) | 16 | ~0 kWh | 22 | **DEAD** |

A very slow player runs out of battery before M4 and CO₂ scrubbing before M5. Progressive hints from Dr. Vasquez activate after time thresholds. If the player is truly stuck, a "Vasquez takes over" option provides a reference solution to study.

---

## 20. Mission 1 — Water

> *"That vent gas is 500 Kelvin and 30% water vapor. Cool it, and life falls out of the sky."*

### Targets

| Objective | Type | Parameters | Primary |
|-----------|------|------------|---------|
| Collect 100 mol liquid H₂O | `store_component` | species: H2O, minMoles: 100, requiredPhase: L | ✓ |
| Process converges | `convergence` | — | ✓ |
| Collect 200 mol H₂O | `store_component` | minMoles: 200 | bonus |

### Equipment Palette

| Unit | Count | Notes |
|------|-------|-------|
| source (vent) | 1 | Pre-placed, 500K vent gas |
| air_cooler | 1 | **NEW** — improvised from radiator panels |
| flash_drum | 1 | **NEW** — damaged pressure vessel |
| tank | 2 | **NEW** — storage containers |

Total: 4 types, 5 units. Simplest possible flowsheet.

### Chemistry

Species: H₂O, CO₂, N₂, CH₄, Ar
Reactions: none (pure phase separation)

### Reference Flowsheet

```
[Vent 500K] → [Air Cooler →303K] → [Flash Drum] → liquid: [H₂O Tank]
                                          ↓ vapor
                                    [Off-gas Tank] (CO₂+N₂+CH₄)
```

### Production Analysis

H₂O condensation at 303K: 84.2% of inlet water condenses.
Rate: 61.8 mol/hr liquid water.
Time to 100 mol: **1.6 hours.**
Power: 250W (baseline + fan). Battery cost: 0.4 kWh.

### Constraints

| Parameter | Lock | Reason |
|-----------|------|--------|
| Air cooler T_approach | min 10K | Physical limit (fin-fan) |
| Source flow | fixed at vent rate | Natural fissure, not adjustable |

### Stars

- ★ Collect 100 mol H₂O, process converges
- ★★ Collect 200 mol H₂O (run longer, prove stability)
- ★★★ Collect 200 mol H₂O using only 1 tank (efficient layout)

### Expert Hooks

- On first placement of air cooler: "The planet is 288K. Your air cooler can get the gas close to that — but never below it. That's the second law."
- On flash drum inspection: "Gravity does the work here. Hot gas in, liquid falls, vapor rises. Oldest separation trick in engineering."
- Hint (after 2 failed attempts): "Check the cooler outlet temperature. Is it cold enough for water to condense? Look at the saturation temperature."

### Carries Forward

- Water supply connected to shelter → water gauge stops
- Off-gas tank with CO₂ + CH₄ → feedstock for M3
- Air cooler, flash drum, tanks in inventory

---

## 21. Mission 2 — Oxygen

> *"We can make oxygen from that water. Same reaction a fuel cell runs backwards."*

### Targets

| Objective | Type | Parameters | Primary |
|-----------|------|------------|---------|
| Store 50 mol O₂ | `store_component` | species: O2, minMoles: 50 | ✓ |
| Process converges | `convergence` | — | ✓ |
| Store 100 mol H₂ | `store_component` | species: H2, minMoles: 100 | bonus |

### Equipment Palette

New + carried from M1:

| Unit | Count | Notes |
|------|-------|-------|
| source (vent) | 1 | From M1 |
| air_cooler | 1 | From M1 |
| flash_drum | 1 | From M1 |
| tank | 3 | M1's 2 + 1 new (for H₂ storage) |
| electrolyzer | 1 | **NEW** — life support spare |
| battery | 1 | Pre-placed, 75 kWh, depleting |

### Chemistry

Species: + H₂, O₂ (newly available)
Reactions: R_WATER_SPLIT (2 H₂O → 2 H₂ + O₂, electrochemical)

### Reference Flowsheet

```
[H₂O Tank] → [Electrolyzer ⚡←Battery] → [O₂ Tank] → shelter O₂ port
                                         → [H₂ Tank] (stored for M3)
```

M1 keeps running in background (water supply).

### Production Analysis

Electrolyzer at 1 kW: 5.18 mol/hr O₂, 10.37 mol/hr H₂.
Time to 50 mol O₂: **9.6 hours.**
Battery draw: 11.6 kWh total (baseline + electrolyzer).
Battery remaining after M2: ~59 kWh (from 70.5 post-M1).

Byproduct: 100 mol H₂ stored. Essential for M3.

### Constraints

| Parameter | Lock | Reason |
|-----------|------|--------|
| Electrolyzer power | max 1 kW | Small unit, damaged |
| Cell voltage | fixed 1.8V | PEM cell characteristic |

### Stars

- ★ Store 50 mol O₂, converged
- ★★ Store 100 mol H₂ alongside (proves H₂ recovery)
- ★★★ Complete using ≤10 kWh total battery (efficient operation)

### Expert Hooks

- On electrolyzer placement: "1.8 volts per cell. That's the minimum to split water, plus overpotential losses. Thermodynamics sets the floor — engineering adds the tax."
- On battery inspection: "Watch that charge level. Every kilowatt-hour we spend here is one we can't spend later."
- Hint: "The electrolyzer needs liquid water in. Make sure your M1 chain is still feeding the water tank."

### Carries Forward

- O₂ supply connected to shelter → O₂ gauge stops
- 100 mol H₂ in tank → feedstock for M3 Sabatier
- Electrolyzer in inventory

---

## 22. Mission 3 — Fuel

> *"CO₂ plus hydrogen gives methane and water. The water recycles. The methane is fuel."*

### Targets

| Objective | Type | Parameters | Primary |
|-----------|------|------------|---------|
| Store 20 mol CH₄ | `store_component` | species: CH4, minMoles: 20, minPurity: 0.9 | ✓ |
| Process converges | `convergence` | — | ✓ |
| Recycle water back to electrolyzer | `sustained_flow` | species: H2O, minFlow: 0.001, duration: 600s | bonus |

### Equipment Palette

New + carried:

| Unit | Count | Notes |
|------|-------|-------|
| All M2 units | — | Carried |
| mixer | 1 | **NEW** — static inline section |
| reactor_equilibrium | 1 | **NEW** — catalyst bed (50L) |
| hex | 1 | **NEW** — brazed plate |

### Chemistry

Species: all previous + CH₄ (now producible)
Reactions: + R_SABATIER (CO₂ + 4H₂ → CH₄ + 2H₂O, ΔH = −165 kJ/mol)

### Constraints

| Parameter | Lock | Reason |
|-----------|------|--------|
| reactor_equilibrium.reactionId | fixed: R_SABATIER | Only catalyst available |
| reactor_equilibrium.mode | allowed: [adiabatic, insulated] | No electrical jacket yet |
| reactor_equilibrium.volume | fixed: 0.05 m³ | Physical vessel size |

### Reference Flowsheet

```
[CO₂ Tank] ──→ [Mixer] → [Reactor (Sabatier)] → [HEX cool] → [Flash Drum]
[H₂ Tank]  ──→    ↑                                            ├→ CH₄ vapor → [CH₄ Tank]
                   │                                            └→ H₂O liquid → [H₂O Tank]
                   └── recycle H₂O → electrolyzer (M2) ────────────────────────┘
```

### Production Analysis

Reactor: 0.05 m³, GHSV 50,000 hr⁻¹. Sabatier at 92% conversion.
CH₄ production: **20.5 mol/hr.**
Time to 20 mol: **~1 hour.**
Feed: 20 mol CO₂ (from M1 off-gas, plentiful), 80 mol H₂ (from M2 storage, 100 mol available).
Power: 250W (negligible — reaction is exothermic).

### Stars

- ★ Store 20 mol CH₄ at 90% purity, converged
- ★★ Sustain water recycle loop for 10 min (proves integration)
- ★★★ Complete with ≤85 mol H₂ consumed (stoichiometric efficiency)

### Expert Hooks

- On reactor placement: "The Sabatier reaction is exothermic. It doesn't need heating — it makes its own heat. Your job is cooling the products enough to separate them."
- On HEX placement: "The heat exchanger lets you cool the reactor output against something cold. What's cold here? The vent water, or just ambient air through a cooler."
- Hint: "If your flash drum isn't separating well, check the temperature. CH₄ and CO₂ are gases at room temperature. Water is liquid. You need to be cold enough for water to condense, but that's easy — it's the same trick as M1."

### Carries Forward

- 20 mol CH₄ stored → turbine fuel for M4
- Sabatier reactor, HEX, mixer in inventory
- First experience with recycle loops (water back to electrolyzer)

---

## 23. Mission 4 — Power

> *"We need our own power. That methane isn't just fuel for later — it's fuel for right now."*

### Targets

| Objective | Type | Parameters | Primary |
|-----------|------|------------|---------|
| Sustain 5 kW net electrical output | `power_output` | minPower: 5000, duration: 300s | ✓ |
| Process converges | `convergence` | — | ✓ |
| Battery charging (positive net) | `maintain_conditions` | battery SoC increasing, duration: 300s | bonus |

### Equipment Palette

New + carried:

| Unit | Count | Notes |
|------|-------|-------|
| All M3 units | — | Carried |
| source (atmosphere) | 1 | **NEW** — planet air feed |
| source (vent #2) | 1 | **NEW** — second vent, discovered during salvage |
| compressor | 1 | **NEW** — diaphragm, from propulsion wreck |
| gas_turbine | 1 | **NEW** — micro radial expander (APU) |
| reactor_adiabatic | 1 | **NEW** — combustion chamber |

### Chemistry

Reactions: + R_CH4_COMB (CH₄ + 2O₂ → CO₂ + 2H₂O, ΔH = −890 kJ/mol)
Species: all previous (CH₄ combustion products already registered)

### Constraints

| Parameter | Lock | Reason |
|-----------|------|--------|
| reactor_adiabatic.reactionId | fixed: R_CH4_COMB | Combustion configuration |
| compressor.P_out | max: 5 bar | Small diaphragm unit |
| gas_turbine.eta | fixed: 0.75 | Salvaged, not perfect |

### Reference Flowsheet

```
[Atm Source] → [Compressor ⚡] → [Combustor (+CH₄ fuel)] → [Gas Turbine ⚡→] → exhaust
                                        ↑
                            [CH₄ from Sabatier + vent direct]
```

Sabatier (M3) and both vents must run simultaneously to supply enough CH₄.

### Production Analysis

CH₄ demand at 5 kW: 80.9 mol/hr.
Supply: Sabatier 20.5 + vent CH₄ direct 61.2 = **81.7 mol/hr.** ✓ (1% margin)
TIT: ~900K (within 1023K gas turbine limit).
Startup: stored CH₄ (20 mol) fires combustor. Battery provides compressor startup power (2 kW, 30 sec).

### Stars

- ★ Sustain 5 kW for 5 minutes, converged
- ★★ Battery charging (net positive power to colony)
- ★★★ Sustain 5 kW using ≤4 total process units in the Brayton loop

### Expert Hooks

- On Brayton concept: "Compress air, add heat, expand through a turbine. The expansion gives more work than the compression costs because the gas is hotter — and hot gas has more energy per unit of pressure drop."
- On second vent discovery: "Two vents. That changes everything. We're not fuel-limited anymore — we're equipment-limited."
- Hint: "The turbine needs a combustible mixture. Pure air won't burn. You need to inject fuel — methane — into the combustor."

### Carries Forward

- 5 kW continuous power → battery recharging → all future equipment powered
- Compressor, gas turbine, combustion reactor in inventory
- Two vent sources available
- Colony is power-independent

---

## 24. Mission 5 — Breathable Air

> *"Four days of CO₂ cartridges left. The planet has the oxygen we need — if we can strip the poison out."*

### Targets

| Objective | Type | Parameters | Primary |
|-----------|------|------------|---------|
| Store 500 mol clean air (<0.5% CO₂) | `store_component` | species: N2+O2, minMoles: 500, CO2 maxFrac: 0.005 | ✓ |
| Process converges | `convergence` | — | ✓ |
| Collect liquid CO₂ byproduct | `store_component` | species: CO2, minMoles: 50, requiredPhase: L | bonus |

### Equipment Palette

New + carried:

| Unit | Count | Notes |
|------|-------|-------|
| All M4 units | — | Carried |
| compressor | +1 (total 2) | Second unit for multi-stage |
| air_cooler | +1 (total 2) | Second unit for intercooling |
| valve | 1 | **NEW** — fabricated from spare parts |
| flash_drum | +1 (total 2) | Additional separator |

### Chemistry

No new reactions. Phase separation of CO₂ from air at high pressure.

### Constraints

| Parameter | Lock | Reason |
|-----------|------|--------|
| compressor.P_out | max: 150 bar | Diaphragm unit limit |

### Reference Flowsheet

```
[Atm Source] → [Comp #1] → [Air Cool #1] → [Comp #2] → [Air Cool #2] → [Flash Drum]
                                                                          ├→ vapor (clean air) → [Valve] → [Tank]
                                                                          └→ liquid CO₂ → [Tank]
```

### Production Analysis

Two-stage compression to ~70 bar. At 298K: CO₂ liquefies (below T_crit 304K).
Power-limited flow: 0.42 mol/s at ~4 kW compressor draw.
Clean air: ~1,270 mol/hr. Time to 500 mol: **~24 minutes.**
Total power budget: 4 kW compressors + 0.8 kW baseline = 4.8 kW of 5 kW available. Tight.

### Stars

- ★ Store 500 mol clean air <0.5% CO₂, converged
- ★★ Collect 50 mol liquid CO₂ (proves separation quality)
- ★★★ Achieve <0.1% CO₂ in product (exceptional purity)

### Expert Hooks

- On multi-stage compression: "One compressor to 70 bar would overheat. Two stages with intercooling — cool between each stage. Same total pressure ratio, much less temperature rise."
- On CO₂ critical point: "CO₂'s critical temperature is 304 K. We're at 288 K. That means if we push the pressure high enough, CO₂ becomes a liquid. N₂ and O₂? Their critical temperatures are way below ambient — they stay gaseous no matter what. That difference is our separation."
- Hint: "Check the CO₂ phase at your flash drum conditions. Is it actually liquid? If not, you need more pressure or lower temperature."

### Carries Forward

- Clean air supply to shelter → CO₂ cartridges retired
- Valve in inventory
- Two compressors, two air coolers available
- **Full survival autonomy achieved**

---

## 25. Mission 6 — Warmth

> *"A heat pump moves heat uphill. It costs electricity, but you get more heat than you pay for."*

### Targets

| Objective | Type | Parameters | Primary |
|-----------|------|------------|---------|
| Room temperature ≥ 293K for 30 min | `maintain_conditions` | T min: 293, duration: 1800s | ✓ |
| Room temperature ≤ 300K (not overheating) | `maintain_conditions` | T max: 300, duration: 1800s | ✓ |
| COP ≥ 2.5 | custom | Q_hot / W_compressor ≥ 2.5 | bonus |

### Equipment Palette

No new unit types. Uses existing inventory:

| Unit | Count | Notes |
|------|-------|-------|
| compressor | 1 (from existing 2) | Dedicated to heat pump loop |
| hex | 2 | 1 from M3 + 1 **NEW** (salvaged from bow section) |
| valve | 1 | From M5 |
| source (CO₂ charge) | 1 | Working fluid charge |

**New equipment: 0 new types.** The closed-cycle concept is the novelty.

### Chemistry

No new reactions. Pure thermodynamic cycle with CO₂ working fluid.

### Reference Flowsheet

```
  ┌──────────────────────────────────────────────────────────┐
  │                  closed CO₂ loop                          │
  │                                                           │
  └→ [Compressor ⚡] → [HEX #1 (hot side → room)] → [Valve] → [HEX #2 (cold side ← ambient)] → ┘
                         rejects heat to room              absorbs heat from outside
```

### Production Analysis

Compressor: 2 kW electrical.
At COP 2.5: Q_hot = 5 kW to room.
At COP 3.0 (achievable transcritical CO₂): Q_hot = 6 kW.

Room thermal model: Q_loss = UA × (T_in − T_out), UA ≈ 250 W/K.
Without pump (2 people): T = 288 + 200/250 = 288.8K (16°C).
With 5 kW pump: T = 288 + 5200/250 = 308.8K **(too hot!)**.
Player must tune. Intermittent operation or reduced compressor speed.

Power budget: 2 kW heat pump + 4.8 kW other = 6.8 kW of 5 kW available.
Must cycle: heat pump runs intermittently. Room coasts on thermal mass.
Average draw ~0.7 kW at 33% duty. Fits within 5 kW.

Teaching: can't run everything at once. Power budgeting. Motivates M8.

### Stars

- ★ Room 293-300K sustained 30 min, converged
- ★★ Achieve COP ≥ 2.5
- ★★★ Achieve COP ≥ 3.0 (optimal cycle design)

### Expert Hooks

- On closed loops: "This is the first time you're circulating a working fluid in a closed loop. Nothing enters, nothing leaves. The fluid just carries heat from one place to another. Forever."
- On COP: "Coefficient of Performance. You put in 2 kW of electricity, you get 5 kW of heat. That's not magic — it's not free energy. You're moving heat that already exists in the outside air. The compressor just pumps it uphill."
- Hint: "If the room is overheating, you're delivering too much heat. Either reduce the compressor speed or run it intermittently."

### Carries Forward

- Room temperature controlled (display: 22°C)
- Player understands closed cycles and COP
- Second HEX in inventory
- Power budget is tight → motivation for M8

---

## 26. Mission 7 — Fertilizer

> *"Nitrogen plus hydrogen gives ammonia. Fifteen percent conversion per pass. You'll need a recycle loop."*

### Targets

| Objective | Type | Parameters | Primary |
|-----------|------|------------|---------|
| Store 10 mol liquid NH₃ | `store_component` | species: NH3, minMoles: 10, requiredPhase: L | ✓ |
| Process converges | `convergence` | — | ✓ |
| Maintain purge stream (Ar removal) | `sustained_flow` | species: Ar, minFlow: 0.0001, duration: 600s | bonus |

### Equipment Palette

New + carried:

| Unit | Count | Notes |
|------|-------|-------|
| All M6 units | — | Carried |
| splitter | 1 | **NEW** — pipe tee for purge/recycle |
| heater | 1 | **NEW** — inline electric, preheats syngas |

### Chemistry

Reactions: + R_HABER (N₂ + 3H₂ ⇌ 2NH₃, ΔH = −92 kJ/mol)
Species: NH₃ (already registered, now produced)

### Constraints

| Parameter | Lock | Reason |
|-----------|------|--------|
| reactor_equilibrium.reactionId | allowed: [R_SABATIER, R_HABER] | Two reactions now available |
| heater.T_out | max: 923K | Equipment limit |

### Reference Flowsheet

```
                              recycle (N₂ + H₂ + Ar)
                    ┌───────────────────────────────────────────────┐
                    ↓                                               │
[N₂] → [Mixer] → [Comp →100bar] → [Heater →723K] → [Reactor] → [Air Cool] → [Flash Drum] → [Splitter]
[H₂] →    ↑                          (Haber)                       ├→ NH₃ liq → [Tank]    │
           │                                                        └→ gas ↑──────────────→┤
           └────────────────────────────────────────────────────────── recycle ←────────────┤
                                                                                  purge → [Sink] (Ar)
```

### Production Analysis

Fresh feed: 0.01 mol/s stoichiometric (N₂:H₂ = 1:3).
Per-pass: 15% conversion. With 80% recycle: ~55% overall.
NH₃ production: **9.9 mol/hr.**
Time to 10 mol: **~1 hour.**
Compressor: ~200W. Heater: ~334W. Total: ~734W. Within budget.

The Ar in the N₂ feed (1% of planet atmosphere) accumulates in the recycle loop. Without purge, Ar dilutes the reactor feed and kills conversion. The purge/recycle split ratio is the central design challenge.

### Stars

- ★ Store 10 mol liquid NH₃, converged
- ★★ Maintain Ar purge for 10 min (proves loop stability)
- ★★★ Achieve >50% overall N₂ conversion (optimized recycle ratio)

### Expert Hooks

- On Haber: "This reaction won the Nobel Prize. Twice. Fritz Haber for the chemistry, Carl Bosch for the engineering. It feeds half the world. And now it's going to feed us."
- On equilibrium: "Only 15% converts each pass. The rest recycles. That's not failure — that's equilibrium. You can't fight thermodynamics. You work around it."
- On purge: "See that argon building up in the loop? It doesn't react. It doesn't condense. It just accumulates. You need a bleed — a small purge stream. Lose a little reactant to remove the inert."
- Hint: "If your conversion is dropping over time, check the argon content in the reactor feed. It's probably climbing."

### Carries Forward

- NH₃ supply → greenhouse activation → food supplementation
- Splitter and heater in inventory
- Player understands recycle loops, inert accumulation, purge strategy
- Haber reaction available for future use

---

## 27. Mission 8 — More Power

> *"That exhaust is still 600 Kelvin. We're venting enough heat to run a second generator."*

### Targets

| Objective | Type | Parameters | Primary |
|-----------|------|------------|---------|
| Sustain 8 kW net electrical | `power_output` | minPower: 8000, duration: 300s | ✓ |
| Process converges | `convergence` | — | ✓ |
| Pump work < 5W (prove liquid compression) | custom | W_pump < 5 | bonus |

### Equipment Palette

New + carried:

| Unit | Count | Notes |
|------|-------|-------|
| All M7 units | — | Carried |
| pump | 1 | **NEW** — gear/metering pump from propulsion |
| gas_turbine | +1 (total 2) | Second turbine for steam expansion |

### Chemistry

No new reactions. Uses M4 combustion. Rankine cycle is pure thermodynamics.

### Reference Flowsheet

```
=== BRAYTON TOP (existing M4) ===
[Atm] → [Comp] → [Combustor +CH₄] → [Gas Turbine #1 ⚡5kW] → hot exhaust (600K)
                                                                     ↓
=== RANKINE BOTTOM (new) ===                                         ↓
    ┌──────────────────────────────────────────────────────┐         ↓
    │                 closed H₂O loop                       │         ↓
    │                                                       │         ↓
    └→ [Pump ⚡~1W] → [HEX (boiler, heated by exhaust)] → [Gas Turbine #2 ⚡3kW] → [Air Cool (condenser)] → ┘
```

### Production Analysis

Brayton: 5 kW (existing).
Rankine addition: exhaust at 600K, exit at 400K.
Available heat: 0.05 kg/s × 1050 J/(kg·K) × 200K = 10.5 kW thermal.
Steam cycle at 30% efficiency: **3.15 kW additional.**
Total: **~8 kW net.** Pump work: ~1 W. Negligible.

"Compressing a liquid costs almost nothing" is the teaching moment.

### Stars

- ★ Sustain 8 kW for 5 minutes, converged
- ★★ Pump work < 5W demonstrated
- ★★★ Achieve combined cycle efficiency > 35%

### Expert Hooks

- On combined cycle: "Same fuel. Nearly double the electricity. The exhaust heat that was going to waste is now running a second cycle. This is how every modern power plant works."
- On pump vs compressor: "Notice the pump power? One watt. The compressor? Thousands. That's because liquid water is nearly incompressible. Pumping a liquid is basically free."
- Hint: "The steam turbine needs steam, not water. Make sure the boiler HEX is getting the water hot enough to vaporize."

### Carries Forward

- 8 kW total power → all systems run simultaneously
- Pump in inventory
- Player understands waste heat recovery, Rankine cycle, combined efficiency
- Greenhouse at full power → food crisis resolved

---

## 28. Mission 9 — Reserves

> *"Liquids store dense. If we can liquefy our O₂ and CH₄, we have weeks of reserve instead of hours."*

### Targets

| Objective | Type | Parameters | Primary |
|-----------|------|------------|---------|
| Store 50 mol liquid O₂ | `store_component` | species: O2, minMoles: 50, requiredPhase: L | ✓ |
| Store 50 mol liquid CH₄ | `store_component` | species: CH4, minMoles: 50, requiredPhase: L | ✓ |
| Process converges | `convergence` | — | ✓ |

### Equipment Palette

Uses existing inventory heavily. Key additions:

| Unit | Count | Notes |
|------|-------|-------|
| All M8 units | — | Carried |
| tank (cryo Dewar) | 2 | **NEW** — vacuum-insulated from cargo hold |
| Additional compressor, air_cooler, hex, valve, splitter, flash_drum as needed from accumulated inventory |

The mission uses many pieces. The player's full equipment library is available. The challenge is design, not scarcity.

### Chemistry

No new reactions. Pure thermodynamics.

O₂: T_crit 154.6K, T_boil 90.2K, P_crit 50.4 bar.
CH₄: T_crit 190.6K, T_boil 111.7K, P_crit 46.0 bar.

### Reference Flowsheet (O₂ train)

```
                          recycle cold vapor
                 ┌──────────────────────────────────────────────┐
                 ↓                                              │
[O₂ feed] → [Comp →80bar] → [Air Cool →288K] → [HEX (warm)] → [Splitter]
                                                                  ├→ [Gas Turbine (expander→cold)] → [HEX (cold side)] → recycle
                                                                  └→ [Valve (J-T)] → [Flash Drum]
                                                                                       ├→ liquid O₂ → [Cryo Tank]
                                                                                       └→ cold vapor → [HEX (cold side)] → recycle
```

Duplicate for CH₄ (easier — higher T_crit).

### Production Analysis

After cool-down (1-2 hours): Linde cycle at ~10% liquefaction per pass.
O₂ at 0.03 kg/s compressor: 0.094 mol/s liquid.
Time to 50 mol: **~9 minutes** at steady state.
Total power: ~4 kW per train. Both trains: 8 kW. Uses full power budget.

### Stars

- ★ Store 50 mol each of liquid O₂ and liquid CH₄, converged
- ★★ Achieve liquefaction in single continuous run (no stop/restart)
- ★★★ Use turboexpander work to offset compression (net power recovery)

### Expert Hooks

- On the turboexpander: "Remember the gas turbine from M4? Same machine, different job. There you expanded hot gas to make power. Here you expand warm gas to make cold. The physics is identical — you're just using the other end of the temperature change."
- On counterflow HEX: "This is the workhorse of cryogenics. Cold vapor coming back from the bottom cools the warm gas going down. The longer the exchanger, the colder you can get. It's a temperature ladder."
- Hint: "If nothing is liquefying, your cycle isn't cold enough yet. The counterflow HEX needs time to cool down. Let it run — the temperature at the J-T valve should drop steadily."

### Carries Forward

- Cryogenic reserves (weeks of backup supply)
- Liquid propellant for rover
- Player understands cryogenic cycles, turboexpander applications
- Full equipment library for M10

---

## 29. Mission 10 — Closed Biosphere

> *"Plants are process units. An ecosystem is a process network."*

### Targets

| Objective | Type | Parameters | Primary |
|-----------|------|------------|---------|
| Room CO₂ < 0.5% for 1 hour (greenhouse as scrubber) | `maintain_conditions` | CO2 maxFrac: 0.005, duration: 3600s | ✓ |
| Room O₂ 19-23% for 1 hour | `maintain_conditions` | O2 minFrac: 0.19, maxFrac: 0.23, duration: 3600s | ✓ |
| Food production > 0 (CH₂O flowing to humans) | `sustained_flow` | species: CH2O, minFlow: 0.001, duration: 3600s | ✓ |
| Process converges | `convergence` | — | ✓ |

### Equipment Palette

All previous + composites:

| Unit | Count | Notes |
|------|-------|-------|
| Full accumulated inventory | — | Everything from M1-M9 |
| greenhouse (composite) | 1 | **NEW** — agricultural pod from cargo |
| human (composite) | 1 | **NEW** — represents colonists (already in room, now explicit) |

### Chemistry

Species: + CH₂O (formaldehyde — food proxy)
Reactions:
- R_PHOTOSYNTHESIS (CO₂ + H₂O → CH₂O + O₂, ΔH = +519 kJ/mol, electrochemical/light-powered)
- R_METABOLISM (CH₂O + O₂ → CO₂ + H₂O, ΔH = −519 kJ/mol, complete conversion)

### Reference Flowsheet

```
  ┌──── Room (50m³ tank) ────────────────────────────────────────────────┐
  │  N₂ + O₂ + CO₂ + H₂O + Ar                                          │
  │          ↕ breathing air                                             │
  │  [Human ×7] ←── food (CH₂O + NH₃) ←── [Greenhouse]                 │
  │      │              │                       ↑                        │
  │      │ exhaust      │ clean air             │ room air               │
  │      └──→ room ←────┘                       └── room ───────────────→┘
  │                                                                      │
  │      water_in ←── [M1 water supply]                                  │
  │      waste_out ──→ [Liquid sink]                                     │
  │      nh3_in ←── [M7 Haber supply]                                   │
  │      power ←── [M8 combined cycle]                                   │
  │      cooling ←── [Air cooler (rejects to ambient)]                   │
  └──────────────────────────────────────────────────────────────────────┘
```

### Production Analysis (7 colonists)

Human metabolic load (7 ppl): O₂ consumed 6.6 mol/hr, CO₂ produced 5.7 mol/hr.
Greenhouse must fix 5.7 mol/hr CO₂ + produce 5.7 mol/hr O₂.
CH₂O (food) production: 5.7 mol/hr.
Power for grow lights: ~82 kW at 1% LED efficiency.

This requires M8 combined cycle × several units, or accept that M10
operates at reduced colonist load or higher LED efficiency parameter.
The power requirement is deliberately enormous — it's the biggest
constraint, and it's physically real. Growing food with artificial
light is expensive. This is why real space colony designs use sunlight.

External dependencies at steady state:
- Drinking water: 27.8 mol/hr (from M1 vent — trivially available)
- NH₃ makeup: 0.21 mol/hr (from M7 Haber — trivially available)
- Electricity: ~84 kW (requires significant power infrastructure)
- Cooling: ~82 kW waste heat rejection (air coolers to ambient)

### Stars

- ★ All primary objectives met (CO₂, O₂, food, converged)
- ★★ Sustain for 4 hours (proves long-term stability)
- ★★★ Achieve wastewater recycle — close the nitrogen loop entirely

### Expert Hooks

- Vasquez: "Every process you've built in the last nine missions was leading here. The greenhouse is a reactor. The humans are reactors. The room is a tank. You've been building a biosphere all along."
- Priya: "Give me light, water, CO₂, and a little nitrogen. I'll give you air and food. That's what a plant does. That's what an ecosystem does."
- On the wastewater hidden achievement: "If you boil the waste stream and pipe the vapor back to the greenhouse... the water recycles, the NH₃ recycles, and the Haber process becomes startup-only. That's a closed ecosystem. That's what we came to prove could be done."

### Carries Forward

- Self-sustaining colony (almost — electricity and N₂ makeup still external)
- Complete understanding of process networks
- **Campaign complete. Hook: orbital signal.**

---

## 30. Cumulative Progression Tables

### Equipment by Mission

| Unit | M1 | M2 | M3 | M4 | M5 | M6 | M7 | M8 | M9 | M10 |
|------|----|----|----|----|----|----|----|----|----|----|
| source (vent) | ★ | · | · | +1 | · | · | · | · | · | · |
| source (atm) | | | | ★ | · | · | · | · | · | · |
| air_cooler | ★ | · | · | · | +1 | · | · | · | · | · |
| flash_drum | ★ | · | · | · | +1 | · | · | · | · | · |
| tank | ★★ | +1 | · | · | · | · | · | · | +2 | · |
| electrolyzer | | ★ | · | · | · | · | · | · | · | · |
| battery | | ★ | · | · | · | · | · | · | · | · |
| mixer | | | ★ | · | · | · | · | · | · | · |
| reactor_eq | | | ★ | · | · | · | · | · | · | · |
| hex | | | ★ | · | · | +1 | · | · | · | · |
| compressor | | | | ★ | +1 | · | · | · | · | · |
| gas_turbine | | | | ★ | · | · | · | +1 | · | · |
| reactor_adi | | | | ★ | · | · | · | · | · | · |
| valve | | | | | ★ | · | · | · | · | · |
| splitter | | | | | | | ★ | · | · | · |
| heater | | | | | | | ★ | · | · | · |
| pump | | | | | | | | ★ | · | · |
| greenhouse | | | | | | | | | | ★ |
| human | | | | | | | | | | ★ |

★ = introduced  · = carried  +N = additional units of existing type

### Species by Mission

| Species | Available from |
|---------|---------------|
| H₂O, CO₂, N₂, CH₄, Ar | M1 (vent gas composition) |
| H₂, O₂ | M2 (electrolysis products) |
| NH₃ | M7 (Haber product) — already registered, now produced |
| CH₂O | M10 (food proxy — photosynthesis product) |

### Reactions by Mission

| Reaction | Available from | Used in |
|----------|---------------|---------|
| R_WATER_SPLIT | M2 | M2, ongoing |
| R_SABATIER | M3 | M3, M4 fuel supply, ongoing |
| R_CH4_COMB | M4 | M4, M8 Brayton cycle |
| R_HABER | M7 | M7, ongoing NH₃ makeup |
| R_PHOTOSYNTHESIS | M10 | M10 greenhouse |
| R_METABOLISM | M10 | M10 human unit |

### Population Timeline

| Event | Game day | Survivors | Daily food (MREs) | Notes |
|-------|----------|-----------|-------------------|-------|
| Crash | 0 | 2 (Kael + Vasquez) | 4 | Emergency rations only |
| M4 salvage | ~10 | +1 (Jin) = 3 | 6 | Found near second vent |
| M6 salvage | ~22 | +2 (Amara, Tomás) = 5 | 10 | Found in bow section |
| M7 salvage | ~27 | +2 (Priya, Erik) = 7 | 14 | Found in chemistry lab area |
| M8 complete | ~36 | 7 | ~8 net | Greenhouse at full power, MREs exhausted |

### Power Budget Evolution

| Phase | Available | Major loads | Surplus |
|-------|-----------|-------------|---------|
| M1-M3 | Battery (75 kWh depleting) | 200W baseline + intermittent electrolyzer | Decreasing |
| M4 | 5 kW (turbine) | 800W baseline + 1kW electrolyzer | ~3 kW |
| M5 | 5 kW | +4 kW compressors | ~0.2 kW (tight) |
| M6 | 5 kW | +0.7 kW avg heat pump | Power-limited |
| M7 | 5 kW | +0.7 kW Haber | Power-limited |
| M8 | 8 kW (combined) | All previous | ~2 kW surplus |
| M9 | 8 kW | +4 kW cryo per train | Tight during cryo |
| M10 | 8 kW+ (need expansion) | +82 kW grow lights | **Massive deficit — requires multiple power units** |

M10's power requirement is deliberately enormous and unresolvable with a single combined cycle. This is physically honest — artificial photosynthesis at scale requires enormous energy. The game can either: (a) allow the player to build multiple Brayton+Rankine units, (b) introduce a solar array as late-game equipment, or (c) make the LED efficiency a tunable parameter that rewards optimization. This is an open design question flagged for resolution.
