# PTIS Design Amendment — Session 2 (Consolidated)
## February 2026

---

> **Scope.** This document records ALL design decisions made during
> session 2. Once approved, these amendments propagate to the
> relevant spec files (S0, S5, S8, S9, S10), Equipment Matrix,
> Biosphere Reconciliation, and Mission Validation Reference.
>
> **Supersedes:** PTIS_DESIGN_AMENDMENT_S2.md and
> PTIS_DESIGN_AMENDMENT_S2_ADDENDUM.md (both now obsolete).

---

# 1. NNG Updates (to be added to s0)

## 1.1 NNG-2 — Second Law (Addition)

Add to NNG-2:

> **Heating and cooling.** Everything that needs to be heated
> directly shall be heated electrically (resistive element, real
> cable). Everything that needs to be cooled shall use a cooling
> material circuit (coolant flow, real pipes). No exceptions.

This formalizes: electrical heating via `elec_in` (real wire),
material cooling via `cool_in`/`cool_out` (real pipes with
coolant). The asymmetry is physical — resistive heating is
lossless by first law (all electricity → heat), but cooling
requires moving heat FROM the process TO a coolant stream, which
must flow somewhere.

## 1.2 NNG-3 — WYSIWYG (Addition)

Add to NNG-3:

> **No port without a physical pipe or cable.** If you cannot
> point to the pipe or wire on the real plant, it does not exist
> in the model. No abstract HEAT type. Only MATERIAL (pipe) and
> ELECTRICAL (cable) port types exist.

This retroactively condemns all `heat_out` ports in the current
specs (see §2).

## 1.3 NNG-3 — Conditional Ports (Reinforcement)

Reinforce existing rule 1 ("Different ports → new defId"):

> **No conditional port visibility.** Every defId has a fixed,
> unconditional port layout. A port is never shown/hidden based
> on a parameter value. If two configurations have different
> port sets, they are different defIds sharing a trunk.

---

# 2. Heat Port Purge

## 2.1 Port Type Enum

Remove `HEAT` from the port type enumeration. Only two types
remain:

| Type | Physical | Examples |
|------|----------|---------|
| MATERIAL | Pipe carrying fluid | mat_in, mat_out, cool_in, perm_out |
| ELECTRICAL | Cable carrying watts | elec_in, elec_out |

## 2.2 Units Affected

| Unit | Current port | Resolution |
|------|-------------|------------|
| `reactor_electrochemical` | `heat_out (ELECTRICAL)` | **Remove.** Products exit hot (adiabatic). Player cools downstream with air_cooler. |
| `fuel_cell` | `heat_out (HEAT)` | **Replace with** `cool_in` + `cool_out` (MATERIAL). Mandatory cooling water circuit. |
| `distillation_column` | `heat_out (ELECTRICAL)` | **Remove.** Condenser heat rejection goes into product streams. Sandbox-only; defer to S4. |

## 2.3 Documents Requiring Edits

| Document | Lines/sections | Change |
|----------|---------------|--------|
| PTIS_EQUIPMENT_MATRIX §3.1 | Line 555 | Remove `heat_out` row from reactor_electrochemical ports |
| PTIS_EQUIPMENT_MATRIX §3.2 | Line 589 | Remove `heat_out` row from distillation_column ports |
| PTIS_EQUIPMENT_MATRIX §3.6 | Line 706 | Replace `heat_out` with `cool_in` + `cool_out` on fuel_cell |
| PTIS_S9_SPEC (fuel_cell) | Line 266 | Replace `heat_out (HEAT)` with `cool_in/cool_out (MATERIAL)` |
| PTIS_S10_SPEC §S10c-2 | Line 459 | Replace "exits heat_out port" with "carried by ventilation cooling air" |
| PTIS_S8_SPEC (greenhouse template) | §S8 Impact | Remove any heat_out reference from greenhouse composite |
| PTIS_BIOSPHERE_POWER_RECONCILIATION §2.3 | Waste heat section | Update to reference cooling ventilation, not heat_out port |

---

# 3. Reactor Taxonomy — 5 defIds

## 3.1 Rationale

The current `reactor_equilibrium` has a conditional `elec_in` port
(present only when heatDemand ≠ 'none'). This violates NNG-3
(no conditional ports). The electrochemical reactor had a `heat_out`
port that violates NNG-2/NNG-3 (no heat abstraction). Clean split
into 5 defIds, each with a fixed port layout.

The reactor update needs to be redefined S6, which becomes a global reactor update, with the split of the current reactor_equilibrium and the creation of both the electrochemical reactor and the fuel cells.

## 3.2 Definitions

### reactor_adiabatic

| Field | Value |
|-------|-------|
| defId | `reactor_adiabatic` |
| Category | REACTION |
| Footprint | 2×2 |
| Physical | Insulated catalytic vessel — no heat exchange with surroundings |
| Trunk | `equilibriumTick` (config: `{ adiabatic: true }`) |
| Game intro | M3 (Sabatier), M4 (combustion chamber) |

**Ports (2):**

| portId | Direction | Type |
|--------|-----------|------|
| mat_in | IN | MATERIAL |
| mat_out | OUT | MATERIAL |

**Physics:** Q_external = 0. T_out from energy balance:
H_in + ΔH_rxn × ξ = H_out. All reaction heat goes into or
comes from the product stream.

**Campaign uses:** Sabatier (M3), combustion (M4), Haber (M7),
human metabolism (inside composite).

### reactor_jacketed

| Field | Value |
|-------|-------|
| defId | `reactor_jacketed` |
| Category | REACTION |
| Footprint | 2×2 |
| Physical | Electrically heated catalytic vessel with heating jacket |
| Trunk | `equilibriumTick` (config: `{ adiabatic: false, heated: true }`) |
| Game intro | Sandbox |

**Ports (3):**

| portId | Direction | Type |
|--------|-----------|------|
| mat_in | IN | MATERIAL |
| mat_out | OUT | MATERIAL |
| elec_in | IN | ELECTRICAL |

**Physics:** `elec_in` provides Q_electrical (watts). If
Q_electrical ≥ Q required for isothermal operation → T_out = T_in,
excess heat warms products slightly. If Q_electrical < Q_isothermal
→ T_out from energy balance with the Q actually provided.

**NNG-2 compliant:** Heating is electrical (resistive jacket,
real cable). Consistent with heater unit.

### reactor_cooled

| Field | Value |
|-------|-------|
| defId | `reactor_cooled` |
| Category | REACTION |
| Footprint | 2×3 |
| Physical | Catalytic vessel with cooling water jacket |
| Trunk | `equilibriumTick` (config: `{ adiabatic: false, cooled: true }`) |
| Game intro | Sandbox |

**Ports (4):**

| portId | Direction | Type |
|--------|-----------|------|
| mat_in | IN | MATERIAL |
| mat_out | OUT | MATERIAL |
| cool_in | IN | MATERIAL |
| cool_out | OUT | MATERIAL |

**Physics:** Internal HEX between reaction products and cooling
stream. UA parameter sets heat transfer capacity. Uses the shared
`heatExchangerTick` logic for the internal HEX. If cooling is
insufficient → products exit hotter than target. If cooling
exceeds reaction heat → products exit cooler.

**NNG-2 compliant:** Cooling via material circuit (coolant
through jacket, real pipes).

### reactor_electrochemical (revised)

| Field | Value |
|-------|-------|
| defId | `reactor_electrochemical` |
| Category | REACTION |
| Footprint | 2×3 |
| Physical | Electrochemical cell stack, membrane-separated outlets |
| Trunk | `electrochemicalTick` (config: `{ direction: 'consume' }`) |
| Game intro | M2 (electrolysis), M10 (photosynthesis inside greenhouse) |

**Ports (4) — revised from 5:**

| portId | Direction | Type |
|--------|-----------|------|
| mat_in | IN | MATERIAL |
| mat_out_cat | OUT | MATERIAL |
| mat_out_ano | OUT | MATERIAL |
| elec_in | IN | ELECTRICAL |

**Removed:** `heat_out`. Waste heat goes into product streams
(adiabatic on material side). At revised default η=0.90, product
temperature rise is manageable (~240K at 200W input). Player cools
downstream with air_cooler.

**Efficiency default revision:** 0.70 → **0.90**. Modern PEM
electrolyzers achieve 0.85–0.95. At η=0.70, product ΔT ≈ 2400K
(absurd without cooling). At η=0.90, ΔT ≈ 240K (warm but
physically sane). The inspector range remains 0.005–0.99 (per
biosphere reconciliation S6 amendment) to support greenhouse
η=0.5–5%.

### fuel_cell (revised)

| Field | Value |
|-------|-------|
| defId | `fuel_cell` |
| Category | REACTION |
| Footprint | 2×3 |
| Physical | PEM/SOFC stack with mandatory cooling water loop |
| Trunk | `electrochemicalTick` (config: `{ direction: 'generate' }`) |
| Game intro | Future (not in current 10 missions). Sandbox available. |

**Ports (6) — revised from 5:**

| portId | Direction | Type |
|--------|-----------|------|
| mat_in_cat | IN | MATERIAL |
| mat_in_ano | IN | MATERIAL |
| mat_out | OUT | MATERIAL |
| elec_out | OUT | ELECTRICAL |
| cool_in | IN | MATERIAL |
| cool_out | OUT | MATERIAL |

**Removed:** `heat_out (HEAT)`.
**Added:** `cool_in`, `cool_out` (MATERIAL).

**Rationale:** At η=0.60, waste heat is 40% of |ΔH|. Product flow
is tiny (water). ΔT would be thousands of K without cooling.
Real fuel cells have mandatory cooling water circuits. WYSIWYG:
not plugged = crazy temperatures / thermal alarm.

**Internal HEX model:** The cooling circuit shares `heatExchangerTick`
logic. UA parameter sets transfer capacity. cool_in receives cold
water, cool_out emits warm water. The reaction products are cooled
by the internal HEX before exiting mat_out. Temperature cross
checking applies (same as any HEX — NNG guarantees T_hot_out ≥
T_cold_in).

## 3.3 Trunk Table (Revised)

| Trunk | defIds sharing | Change |
|-------|---------------|--------|
| `equilibriumTick` | reactor_adiabatic, reactor_jacketed, reactor_cooled | Was `reactorTick` with 1 defId (`reactor_equilibrium`). Now 3 defIds, config-branched. |
| `electrochemicalTick` | reactor_electrochemical, fuel_cell | reactor_electrochemical loses heat_out. fuel_cell gains cool_in/cool_out, loses heat_out. |
| `vesselTick` | tank, tank_cryo, reservoir | Unchanged |
| `heatExchangerTick` | hex, air_cooler | Unchanged. Also used internally by reactor_cooled and fuel_cell for their cooling jackets. |
| `expanderTick` | gas_turbine, steam_turbine | Unchanged |
| `compressorTick` | compressor | Unchanged |
| `separatorTick` | membrane_separator | Unchanged |

## 3.4 reactor_equilibrium Removal

The defId `reactor_equilibrium` ceases to exist. All references
to it after its implementation need to change

| Old reference | New reference |
|--------------|--------------|
| `reactor_equilibrium` (Sabatier, M3) | `reactor_adiabatic` |
| `reactor_equilibrium` (combustion, M4) | `reactor_adiabatic` |
| `reactor_equilibrium` (Haber, M7) | `reactor_adiabatic` |
| `reactor_equilibrium` (metabolism, human) | `reactor_adiabatic` |
| `reactor_equilibrium` (heatDemand='isothermal') | `reactor_jacketed` |
| `reactor_equilibrium` (heatDemand='fixed') | `reactor_jacketed` |
| `reactor_equilibrium` (exothermic + cooling) | `reactor_cooled` |

---

# 4. Human Composite — Final Design

need to update the human model in the appropriate document

## 4.1 Architecture

11 internal units, 5 boundary ports, 4×2 footprint.

```
air_in → [fan] → [air_splitter]
             ├── 8% → [air_buffer] → [feed_mixer] ← [food_buffer] ← food_in
             │          (5L/pp)        ↑              (12L/pp)
             │                         │
             │                    [metabolism]
             │                    (reactor_adiabatic
             │                     R_METABOLISM, T=310K)
             │                    products exit ~500K
             │                         ↓ (hot side)
             └── 92% ──────→ [body_hex] (cold side)
                                  ↓ hot out (~310K)     ↓ cold out (~320K)
                              [kidney]              [air_mixer]
                              (membrane,                 ↓
                               NH3: 0.01)             air_out
                                  ↓ ret_out
water_in → [water_buffer] → [waste_mixer]
            (6.3L/pp)             ↓
                              waste_out
```

## 4.2 Internal Units

| # | localId | defId | Key params | Role |
|---|---------|-------|-----------|------|
| 1 | fan | compressor | P_ratio: 1.001, ~1W | Respiratory muscles + body convection |
| 2 | air_splitter | splitter | splitPct: 8 | 8% to lungs (process), 92% to skin (cooling) |
| 3 | air_buffer | tank | 5L/pp, gas, T:310K, 1 atm | Lungs + blood O₂ reserve |
| 4 | food_buffer | tank | ~12L/pp, CH₂O gas | Body energy reserves (3 weeks) |
| 5 | feed_mixer | mixer | — | Combines air (from buffer) + food (from buffer) |
| 6 | metabolism | reactor_adiabatic | R_METABOLISM, complete conversion | Products exit ~500K (all 121W in stream) |
| 7 | body_hex | hex | UA: scaled per population | Hot: metabolism products → ~310K. Cold: room air → ~320K |
| 8 | kidney | membrane_separator | { NH3: 0.01 } | NH₃ 99% to retentate. All gases permeate. |
| 9 | air_mixer | mixer | — | Merges kidney permeate + body_hex cold out |
| 10 | water_buffer | tank | 6.3L/pp, liquid H₂O | Hydration reserve (3 days) |
| 11 | waste_mixer | mixer | — | Combines kidney retentate + water drainage |

## 4.3 Internal Connections

| From | To |
|------|-----|
| fan.mat_out | air_splitter.mat_in |
| air_splitter.mat_out_1 (8%) | air_buffer.mat_in |
| air_splitter.mat_out_2 (92%) | body_hex.cold_in |
| air_buffer.mat_out | feed_mixer.mat_in_A |
| food_buffer.mat_out | feed_mixer.mat_in_B |
| feed_mixer.mat_out | metabolism.mat_in |
| metabolism.mat_out | body_hex.hot_in |
| body_hex.hot_out | kidney.mat_in |
| body_hex.cold_out | air_mixer.mat_in_A |
| kidney.perm_out | air_mixer.mat_in_B |
| kidney.ret_out | waste_mixer.mat_in_A |
| water_buffer.mat_out | waste_mixer.mat_in_B |

## 4.4 Boundary Ports (5)

| portId | Label | Dir | Type | Delegates to |
|--------|-------|-----|------|-------------|
| air_in | Air In | IN | MATERIAL | fan.mat_in |
| food_in | Food In | IN | MATERIAL | food_buffer.mat_in |
| water_in | Water In | IN | MATERIAL | water_buffer.mat_in |
| air_out | Exhaled Air | OUT | MATERIAL | air_mixer.mat_out |
| waste_out | Waste | OUT | MATERIAL | waste_mixer.mat_out |

## 4.5 Energy Closure Verification

Metabolism releases 121 W/person into the product stream
(adiabatic reactor, products at ~500K). body_hex transfers this
heat to the cooling air branch. Cooling air (92% of intake,
~0.155 mol/s per person) warms from T_room (~293K) to ~320K.
Q = 0.155 × 29 × 27 ≈ 121 W. ✓

Both branches merge in air_mixer. air_out carries all 121 W as
warm air (~315K blended) back to the room. Room absorbs heat
via normal enthalpy accounting on the incoming material stream.
Balance closed. No heat port. No abstract heat concept.

## 4.6 Biological Buffers

### Air Buffer (air_buffer)

| Parameter | Per person | Unit |
|-----------|-----------|------|
| Volume | 5.0 | L |
| Initial | 21% O₂, 79% N₂, 310K, 1 atm | — |
| O₂ content | 0.041 | mol |

**Alarm envelope (O₂ partial pressure):**

| Threshold | P_O₂ | Time from supply cut |
|-----------|------|---------------------|
| Normal | > 16 kPa | — |
| WARNING | 16 kPa | ~3 min |
| ERROR | 10 kPa | ~4.5 min |
| CRITICAL | 6 kPa | ~5.5 min |
| Death | < 4 kPa | ~6 min |

**CO₂ mirror (if exhaust blocked):**

| Threshold | P_CO₂ | Time from block |
|-----------|-------|-----------------|
| WARNING | 5 kPa | ~3 min |
| ERROR | 8 kPa | ~5 min |
| CRITICAL | 10 kPa | ~6 min |

### Water Buffer (water_buffer)

| Parameter | Per person | Unit |
|-----------|-----------|------|
| Volume | 6.3 | L |
| Content | 350 | mol H₂O |
| Net depletion (no intake) | 3.09 | mol/hr |

**Obligatory water losses:**

| Pathway | Rate | Notes |
|---------|------|-------|
| Minimum urine | 500 mL/day | Kidney function minimum |
| Respiratory | 400 mL/day | Exhaled humid air |
| Insensible (skin) | 400 mL/day | Transepidermal |
| Minimal sweat | 400 mL/day | At rest, temperate |
| **Total loss** | **1,700 mL/day** | 3.93 mol/hr |
| Metabolic production | −363 mL/day | −0.84 mol/hr |
| **Net loss** | **1,337 mL/day** | **3.09 mol/hr** |

**Alarm envelope (buffer level):**

| Threshold | Level | Body water lost | Time |
|-----------|-------|----------------|------|
| Normal | > 67% | < 5% | — |
| WARNING | 67% | 5% | ~36 hr (1.5 days) |
| ERROR | 33% | 10% | ~54 hr (2.3 days) |
| CRITICAL | 10% | 13.5% | ~68 hr (2.8 days) |
| Death | 0% | 15% | ~75 hr (3.1 days) |

### Food Buffer (food_buffer)

| Parameter | Per person | Unit |
|-----------|-----------|------|
| Volume | ~12 | L |
| Content | 424 | mol CH₂O |
| Depletion | 0.84 | mol/hr |
| Runway | 21 | days |

**Alarm envelope (buffer level):**

| Threshold | Level | Time without food |
|-----------|-------|-------------------|
| Normal | > 80% | — |
| WARNING | 80% | ~4.2 days |
| ERROR | 50% | ~10.5 days |
| CRITICAL | 20% | ~16.8 days |
| Death | 0% | 21 days |

## 4.7 Body Temperature — Not Modeled

Room temperature serves as the life condition proxy. Alarm
envelope on room T replaces body temperature tracking:

| Room T | Alarm | Condition |
|--------|-------|-----------|
| > 313 K | ERROR | Heat stroke risk |
| > 308 K | WARNING | Heat stress |
| 293–308 K | OK | Comfortable |
| 283–293 K | WARNING | Cold |
| < 283 K | ERROR | Hypothermia risk |
| < 273 K | CRITICAL | Severe hypothermia |

Rationale: modeling body temperature drift requires
thermoregulation physics (shivering, vasoconstriction) to avoid
unrealistic results. Room temperature creates M6 urgency without
the complexity.

## 4.8 Scalable Composite (Population)

See §11 (Generic Scaling Mechanism).

---

# 5. Greenhouse Composite — Final Design

need to update the human model in the appropriate document

## 5.1 Architecture

7 internal units, 7 boundary ports, 4×3 footprint.

Two fully separated stream paths — process and cooling never mix.

```
PROCESS PATH:
co2_in ──→ [nutrient_mix] ←── soil_buffer.mat_out
               ↓
         [photo_reactor] ← elec_in
         (reactor_electrochemical,
          R_PHOTOSYNTHESIS, η=0.02)
          mat_out_cat ↓    ↓ mat_out_ano
              [product_mixer]
                   ↓ (hot products)
              [cooling_hex hot side]
                   ↓ (cooled products)
              [leaf]
              (membrane, {CH2O:0.05, NH3:0.05})
              perm_out → air_out    ret_out → food_out

COOLING PATH (fully separate):
cool_in → [fan] → [cooling_hex cold side] → cool_out

NUTRIENT PATH:
nutrient_in → [soil_buffer] → nutrient_mix
               (50L tank)
```

## 5.2 Internal Units

| # | localId | defId | Key params | Role |
|---|---------|-------|-----------|------|
| 1 | soil_buffer | tank | 50L, liquid | Water + NH₃ nutrient reserve (~8.5 hr buffer) |
| 2 | nutrient_mix | mixer | — | Combines CO₂ gas + nutrient solution (from soil_buffer) |
| 3 | photo_reactor | reactor_electrochemical | R_PHOTOSYNTHESIS, η=0.02, conversion_max=0.95 | Adiabatic. Products exit hot. η editable (0.5–5%). |
| 4 | product_mixer | mixer | — | Merges cat + ano outlets into single stream |
| 5 | cooling_hex | hex | UA: sized for waste heat at η=0.02 | Hot: reactor products. Cold: ventilation air. Streams never mix. |
| 6 | fan | compressor | P_ratio: 1.001, ~50W | Drives ventilation cooling air |
| 7 | leaf | membrane_separator | { CH2O: 0.05, NH3: 0.05 } | Retains food + nitrogen. O₂ and gases permeate. |

## 5.3 Internal Connections

| From | To |
|------|-----|
| soil_buffer.mat_out | nutrient_mix.mat_in_B |
| nutrient_mix.mat_out | photo_reactor.mat_in |
| photo_reactor.mat_out_cat | product_mixer.mat_in_A |
| photo_reactor.mat_out_ano | product_mixer.mat_in_B |
| product_mixer.mat_out | cooling_hex.hot_in |
| fan.mat_out | cooling_hex.cold_in |
| cooling_hex.hot_out | leaf.mat_in |
| *(cooling_hex.cold_out → cool_out boundary)* | |

## 5.4 Boundary Ports (7)

| portId | Label | Dir | Type | Delegates to |
|--------|-------|-----|------|-------------|
| co2_in | CO₂ Feed | IN | MATERIAL | nutrient_mix.mat_in_A |
| nutrient_in | Nutrient Solution | IN | MATERIAL | soil_buffer.mat_in |
| elec_in | Grow Lights | IN | ELECTRICAL | photo_reactor.elec_in |
| cool_in | Cooling Air In | IN | MATERIAL | fan.mat_in |
| cool_out | Cooling Air Out | OUT | MATERIAL | cooling_hex.cold_out |
| air_out | O₂-rich Air | OUT | MATERIAL | leaf.perm_out |
| food_out | Food | OUT | MATERIAL | leaf.ret_out |

## 5.5 Stream Separation Verification

**Process stream species:** CO₂, H₂O, NH₃ (in via co2_in +
nutrient_in) → CH₂O, O₂ (produced) → leaf separates.

**Cooling stream species:** Atmospheric air (N₂/O₂/CO₂/Ar/H₂O).
Enters cool_in, absorbs heat through HEX wall, exits cool_out.

**The two paths share NO material.** The HEX transfers only energy
between them. The leaf separator sees only process-side species
(no atmospheric N₂ contamination in the food stream). The
cooling air sees no food species.

**Feed gas note:** co2_in receives CO₂-rich gas (from room exhaust
or atmosphere). This is NOT ambient air — it's CO₂-boosted
agriculture. No O₂ in the feed (O₂ is purely a product).

## 5.6 Leaf Selectivity Correction

**Before (S8 spec, Equipment Matrix):**
```
{ O2: 0.95, H2O: 0.80 }
```
This is wrong. CH₂O is unlisted → defaults to 1.0 → permeates →
food goes to air_out instead of food_out.

**After:**
```
{ CH2O: 0.05, NH3: 0.05 }
```
- CH₂O: 5% permeates (small loss), 95% retained → food_out ✓
- NH₃: 5% permeates, 95% retained → travels with food → human ✓
- O₂: unlisted → 1.0 → fully permeates → air_out ✓
- CO₂: unlisted → 1.0 → fully permeates (unreacted, recycles) ✓
- H₂O: unlisted → 1.0 → fully permeates ✓

## 5.7 Nitrogen Cycle Closure

NH₃ (from M7 Haber process) enters greenhouse via nutrient_in,
dissolved in water. Passes through reactor unreacted (not a
participant in R_PHOTOSYNTHESIS). Leaf retains it (selectivity
0.05). food_out carries CH₂O + NH₃ → human.food_in.

Inside human: NH₃ passes through metabolism (inert w.r.t.
R_METABOLISM). Kidney diverts NH₃ to retentate → waste_out.
Waste contains H₂O + NH₃. If player recycles wastewater (★★★
path), NH₃ returns to the nutrient system.

## 5.8 Water Cycle in the Biosphere

The photosynthesis reaction consumes water: CO₂ + H₂O → CH₂O + O₂.
At 5.88 mol/hr for 7 people, the greenhouse consumes 5.88 mol/hr
H₂O via nutrient_in.

**Where does this water come from?**

Human metabolism produces 0.84 mol/hr/person × 7 = 5.88 mol/hr
H₂O, exhaled as humid air → enters room. To close the loop, the
player must condense this moisture from room air and return it to
the greenhouse. A flash drum or air cooler on the room exhaust
recovers liquid water → pipes to greenhouse.nutrient_in.

This is exactly the ★★★ wastewater recycle criterion for M10.
Without water recovery, the player draws from the M1 water tank
(open-loop on water).

**Mass balance (closed biosphere):**

| Species | Human produces | Greenhouse consumes | Net |
|---------|---------------|--------------------|----|
| CO₂ | 5.88 mol/hr | 5.88 mol/hr | 0 ✓ |
| O₂ | −5.88 mol/hr | +5.88 mol/hr | 0 ✓ |
| H₂O | +5.88 mol/hr (metabolic) | −5.88 mol/hr | 0 ✓ |
| CH₂O | −5.88 mol/hr | +5.88 mol/hr | 0 ✓ |

Perfect stoichiometric closure. The biosphere is a closed loop
for all four species. External inputs needed: electricity (grow
lights), NH₃ (makeup from Haber), cooling air (ventilation).

## 5.9 Greenhouse Default η

Changed from 1% to **2%** (see §8, M10 Power Budget).

The `editableParams: ['efficiency']` remains — player can adjust
from 0.5% to 5%.

## 5.10 Scalable Composite (Racks)

See §11 (Generic Scaling Mechanism).

---

# 6. Splitter Manifold with Flow Control

## 6.1 Problem

Ratio-based splitting is impractical for life support. Real plants
use flow controllers.

## 6.2 Design: Flow Allocation Mode

The splitter gains a `mode` parameter. No Cv valves added to the
network — the splitter remains a passive flow divider operating on
the total inlet flow already determined by the upstream tank's Cv
valve.

**Modes:**

| Mode | Behavior | Outlet config |
|------|----------|---------------|
| `ratio` (existing) | Fixed split fractions, ΣR = 1.0 | `ratio` per outlet (0–1) |
| `flow_controlled` (new) | N−1 outlets have Q setpoints, last gets remainder | `Q_setpoint` (mol/s), `priority` (int 1–10), `isRemainder` (bool) |

**Curtailment strategies** when Σ(Q_setpoints) > Q_total:

| Strategy | Behavior |
|----------|----------|
| `proportional` | All controlled outlets scale by same factor |
| `priority` | Highest priority (1 = top) served first; lower shed |

The remainder outlet receives Q_total − Σ(allocated). If
negative, remainder = 0.

**No pressure iteration.** Consistent with S5 architecture: Cv
valves only inside tanks, dP valves everywhere else.

## 6.3 Splitter Progression (Option C)

| Mission | Equipment | Capability |
|---------|-----------|-----------|
| M3 | `splitter` (simple 2-outlet tee) | Ratio mode only. Enables ★★★ recycle. |
| M7 | `splitter_manifold` (N outlets, flow control) | flow_controlled mode, priority curtailment. |

**M3 star criteria:**

| Stars | Requirement | Needs recycle? |
|-------|------------|---------------|
| ★ | 20 mol CH₄ at any purity | No — single-pass at 92% conversion |
| ★★ | 20 mol CH₄ at ≥95% purity | Maybe — tuning reactor T helps |
| ★★★ | 20 mol CH₄ at ≥98% purity AND H₂ utilization ≥95% | Yes — recycle loop required |

Salvage: "Pipe tee salvaged from ISRU module" (same section as
Sabatier catalyst bed). Narratively natural.

## 6.4 Mixer Manifold

N inlets (2–10) merging into 1 outlet. Purely passive. Flows merge
at common node pressure. Enthalpy-averaged T. Molar-averaged
composition.

## 6.5 Shared Allocation Algorithm

Power dispatch (S2) and splitter manifold (S5c) use the same
curtailment logic:

```javascript
function allocateByPriority(supply, demands, strategy) {
  // demands: [{ id, amount, priority }]
  // strategy: 'proportional' | 'priority'
  // Returns: [{ id, allocated }]
  const total = demands.reduce((s, d) => s + d.amount, 0);
  if (total <= supply)
    return demands.map(d => ({ id: d.id, allocated: d.amount }));
  if (strategy === 'proportional') {
    const factor = supply / total;
    return demands.map(d => ({id: d.id, allocated: d.amount * factor}));
  }
  if (strategy === 'priority') {
    const sorted = [...demands].sort((a, b) => a.priority - b.priority);
    let remaining = supply;
    return sorted.map(d => {
      const alloc = Math.min(d.amount, remaining);
      remaining -= alloc;
      return { id: d.id, allocated: alloc };
    });
  }
}
```

## 6.6 Stage Definition

| Stage | Sessions | Tests | Description |
|-------|----------|-------|-------------|
| S5c — Flow Control | 1 | +4 | Splitter manifold (N-port, flow_controlled + ratio), mixer manifold (N-port passive), curtailment algorithm |

On critical path: S5b → S5c → S8.

## 6.7 Naming Convention

All units simulating a control loop use consistent mode names:

| Unit | Mode name | What it controls |
|------|-----------|-----------------|
| compressor | `pressure_controlled` | Outlet P |
| pump | `pressure_controlled` | Outlet P |
| valve | `pressure_controlled` | Outlet P |
| splitter_manifold | `flow_controlled` | Outlet Q |
| heater | `temperature_controlled` | Outlet T |
| air_cooler | `temperature_controlled` | Outlet T |

---

# 7. Room Model
to be updated in the appropriate document
## 7.1 Room as Tank with Wall Conduction

The room is a sealed tank (50 m³) with a wall conduction energy
term computed internally — not a port, not a connection.

```
dE_room/dt = Σ(Ḣ_streams_in) − Σ(Ḣ_streams_out)
           − UA_wall × (T_room − T_amb(t))
```

| Parameter | Value | Unit | Notes |
|-----------|-------|------|-------|
| volume | 50 | m³ | Sealed hangar section |
| UA_wall | 50 | W/K | Uninsulated (default) |
| UA_wall | 15 | W/K | After M6 insulation narrative |

**Occupant heat is NOT an internal bookkeeping term.** The human
composite's air_out stream carries 121 W/person as warm air. The
room absorbs this heat when the warm air enters. The room is a
dumb tank — it just does enthalpy accounting on its material
streams. No special occupant logic.

**The HVAC (M6):** The player builds a heat pump as an external
process loop. The condenser side circulates room air through a
HEX. This is material flow — a fan recirculates room air through
the heat pump condenser, warm air returns to the room. No heat
ports on the room.

## 7.2 Room Atmospheric Gauges

| Gauge | Computation | Green | Amber | Red |
|-------|-------------|-------|-------|-----|
| O₂ % | y_O₂ × 100 | 19–23% | 17–19% | <17% |
| CO₂ % | y_CO₂ × 100 | <0.5% | 0.5–2% | >2% |
| Temperature | T_room | 293–308 K | 283–293 K | <283 K |
| Humidity | y_H₂O × P / Psat(T) | 30–70% RH | 20–30% or 70–80% | <20% or >80% |
| Pressure | P_room | 0.85–1.05 atm | 0.80–0.85 | <0.80 atm |

Room temperature alarm doubles as life condition proxy (see §4.7).

## 7.3 Room Ports

| Port | Dir | Type | Connects to |
|------|-----|------|------------|
| air_supply | IN | MATERIAL | Clean air from M5, vent, bottles |
| o2_supply | IN | MATERIAL | O₂ from electrolyzer / bottles |
| water_supply | IN | MATERIAL | Water from M1 |
| exhaust | OUT | MATERIAL | To scrubber, greenhouse co2_in |
| elec_in | IN | ELECTRICAL | Lighting, base load |

The room is a 5-port unit (4 material + 1 electrical). Air
recirculation for HVAC uses exhaust → fan → HEX → air_supply.

---

# 8. Vent and Power Budget

## 8.1 Vents as Reservoir (Pressure-Driven)

Vents are `reservoir` units defined per mission (NOT in planet
registry). Flow emerges from ΔP across integrated Cv valve.

| Parameter | Vent 1 | Vent 2 | Deep Tap (M10) |
|-----------|--------|--------|---------------|
| T | 500 K | 500 K | 550 K |
| P | 3.0 bar | 4.0 bar | 8.0 bar |
| Composition | 30/35/25/10 (H₂O/CO₂/N₂/CH₄) | Same | Same |
| Cv | 0.5 | 1.2 | 5.0 |

## 8.2 Default Greenhouse η = 2%

At η=1%, greenhouse demands 85 kW. Deep tap provides ~41 kW
electric at 30% combined cycle. 15× shortfall.

At η=2%, greenhouse demands ~42 kW. Achievable with 2–3 combined
cycles. Player can chase η=1% for ★★★ challenge.

## 8.3 Planet Conditions Registry (No Vents)

```javascript
PlanetRegistry.register('planet_x', {
  name: 'Planet X',
  atmosphere: {
    composition: { N2: 0.693, O2: 0.208, CO2: 0.0792,
                   Ar: 0.0099, H2O: 0.0095 },
    P_surface_Pa: 89750,
    T_mean_K: 288
  },
  diurnal: {
    enabled: true,
    amplitude_K: 10,
    period_s: 86400,
    noise_K: 2
  }
});
```

Vents defined per mission in mission data, not here.

---

# 9. Initial Room State (Depletables)

## 9.1 Depletable Sizing (2 people)

| Depletable | Contents | Consumption | Runway |
|------------|----------|-------------|--------|
| Water jerricans | **0 mol (EMPTY)** | — | 0 — M1 urgent |
| O₂ bottles | 300 mol at 150 bar | 1.68 mol/hr | 7.4 days |
| LiOH cartridges | 268 mol CO₂ capacity | 1.68 mol/hr | 6.6 days |
| MRE crate | 3,000 mol CH₂O | Escalating | ~Day 37 |
| Battery | 75 kWh | ~200 W | 15.6 days |

## 9.2 LiOH Scrubber

3-port separator with internal sorbent counter. Looks like a
membrane_separator but with depleting internal capacity.

| Parameter | Value |
|-----------|-------|
| defId | `lioh_scrubber` |
| Ports | mat_in, perm_out (clean air), ret_out (CO₂) |
| Sorbent capacity | 268 mol CO₂ (20 cartridges × 13.4 mol) |
| Max rate | 5 mol CO₂/hr |
| H₂O production | Ignored (small: 18g per 44g CO₂ absorbed) |

When sorbent = 0: selectivity drops to 0, CO₂ passes through
unabsorbed. Alarm at sorbent < 20% → WARNING.

Mass balance closes on gas streams (CO₂ removed, same amount
appears in retentate). Minor H₂O mass imbalance accepted
(~0.4 g per g CO₂).

## 9.3 MRE Depletion Schedule

| Phase | Days | People | CH₂O consumed | Remaining |
|-------|------|--------|--------------|-----------|
| Day 0–10 | 10 | 2 | 403 | 2,597 |
| Day 10–22 | 12 | 3 | 726 | 1,871 |
| Day 22–27 | 5 | 5 | 1,008 | 863 |
| Day 27–37 | 10 | 7 | 1,411 | ~0 |
| Day 37+ | — | 7 | Body reserves | 21 days to death |

## 9.4 Depletable → Sustainable Transitions

| Tank | Starts as | Becomes | HUD |
|------|-----------|---------|-----|
| Water jerricans | Empty → M1 fills | Main storage | "EMPTY" → "✓ SUPPLIED" |
| O₂ bottles | Depleting | Electrolyzer output (M2) | "6.2 days" → "✓ SUPPLIED" |
| LiOH scrubber | Depleting sorbent | Replaced by M5 | "85%" → "✓ SUPPLIED" |
| MRE crate | Depleting food | Greenhouse output (M10) | "280 days" → "✓ SUPPLIED" |
| Battery | Depleting | Brayton charges (M4) | "14.8 days" → "5.0 kW ✓" |

## 9.5 HUD Runway Computation

```
runway = tank.inventory[species] / max(0, net_deficit_rate)
```

| Color | Runway |
|-------|--------|
| Green | > 48 hr or SUPPLIED |
| Amber | 12–48 hr |
| Red | < 12 hr |
| Flashing red | < 4 hr |

---

# 10. CH₂O Phase Behavior

**Decision:** Accept gas food. CH₂O (Tb = 254K) is a gas at room
temperature. Food tanks hold pressurized gas. Food pipes carry
invisible vapor.

Composites abstract this at boundaries. The MRE crate and
food_buffer display mass counters or pressure gauges rather than
liquid levels. The player never sees "food flowing through a pipe"
directly — it enters/exits locked composites.

Thermodynamic consistency is preserved. No species exceptions, no
phase overrides. WYSIWYG: CH₂O is what it is.

---

# 11. Generic Scaling Mechanism
to be added at the end of s8

## 11.1 Problem

Human population grows (2 → 3 → 5 → 7). Greenhouse racks scale
with population. Duplicating composite instances (7 copies × 11
units = 77 solver evaluations) is wasteful. Hardcoded population
parameters require per-composite logic.

## 11.2 Design: GroupTemplate `scale` Parameter

Any composite can opt into scaling. The template declares which
internal parameters scale and how:

```javascript
GroupTemplateRegistry.register('human', {
  // ...existing definition...
  scalable: true,
  scaleParam: 'population',   // inspector label
  scaleDefault: 2,            // initial value

  scaleRules: [
    { unitLocalId: 'metabolism',    param: 'rate_multiplier', factor: 1.0 },
    { unitLocalId: 'air_buffer',    param: 'volume_m3',      factor: 1.0 },
    { unitLocalId: 'food_buffer',   param: 'volume_m3',      factor: 1.0 },
    { unitLocalId: 'water_buffer',  param: 'volume_m3',      factor: 1.0 },
    { unitLocalId: 'body_hex',      param: 'UA',             factor: 1.0 },
    { unitLocalId: 'fan',           param: 'flowTarget',     factor: 1.0 },
    { unitLocalId: 'air_splitter',  param: 'flowTarget',     factor: 1.0 }
  ]
});
```

**How it works:** Solver reads `scale` from composite params.
For each scaleRule: `internalUnit.params[param] = baseValue × scale × factor`.
Internal units are unaware — they just see their params.

**Generic:** Human: `scaleParam: 'population'`. Greenhouse:
`scaleParam: 'racks'`. Future power block: `scaleParam: 'trains'`.
Same mechanism, different label.

**Campaign events:** Rescue events set
`setParam('human_1', 'population', 3)`. All internal rates
adjust next tick. One composite, one scaling parameter, no
duplication.

**Factor:** Default 1.0 (linear). Could support 0.75 for
sublinear scaling (shared overhead). Not needed for current
campaign.

**Lives in S8** (group template infrastructure). ~20–30 lines.

---

# 12. Ice / Solid Detection
to be added to S1

## 12.1 Detection

After flash calculation, check:

```javascript
if (T < 273.15 && x_H2O_liquid > 1e-6) {
  flashResult.solidRisk = true;
  flashResult.solidSpecies = 'H2O';
}
```

## 12.2 Consequences

| Unit | Alarm | Effect |
|------|-------|--------|
| HEX (cold side) | WARNING → ERROR | UA degrades (frost) |
| Pipe | WARNING → CRITICAL | Flow restriction → blockage |
| Valve/compressor | CRITICAL | Mechanical damage |
| Tank | INFO | Expansion risk |

## 12.3 Teaching

"Dehydrate before cryogenic processing." Player's M9 Linde cycle
freezes until upstream flash removes water. Natural ★★★ criterion
for M5: clean air with <100 ppm H₂O.

**Where:** S3b (flash flag) + alarm integration.

---

# 13. Day/Night Temperature Variation

## 13.1 Model

```
T_amb(t) = T_mean + A × sin(2π × t / t_day) + noise(t)
```

| Parameter | Value |
|-----------|-------|
| T_mean | 288 K |
| Amplitude | 10 K |
| Range | 278–298 K (never freezing) |
| Period | 24 hr game-time |
| Noise | ±2 K random walk, capped |

## 13.2 Toggle

Controlled by PlanetRegistry `diurnal.enabled`. Campaign: on.
Sandbox: off by default (fixed T_amb for debugging).

---

# 14. Level Display

Every inventory unit computes a display metric:

| Unit type | Display | Computation |
|-----------|---------|-------------|
| tank (liquid) | Liquid level % | V_liquid / V_total × 100 |
| tank (gas only) | Pressure | PV=nRT |
| flash_drum | Liquid level in lower section | V_liquid / V_separator |
| air_buffer | O₂ partial pressure bar | P_O₂ / P_O₂_normal |
| water_buffer | Hydration % | n / n_max × 100 |
| food_buffer | Body reserves % | n / n_max × 100 |
| room | Composition gauges | Per §7.2 |

---

# 15. Time-Series Monitoring (Recorder)

## 15.1 Design

Generic variable recorder, separate from performance maps (S7).
Use an existing JS charting library — do not reinvent zoom,
legends, series toggling, time aggregation.

**Candidate libraries** (already available in artifact environment):

| Library | Strengths | Weight |
|---------|----------|--------|
| Chart.js | Familiar, canvas, time axis, zoom plugin | ~60 kB |
| uPlot | Tiny, 60fps at 100k points, purpose-built for time series | ~30 kB |

**For validation gate:** Simple CSV logging + post-hoc
visualization. Polished embedded chart in S10a.

## 15.2 Recorder API

```javascript
Recorder {
  channels: [
    { unitId, path, label, unit, color }
  ]
  buffer: RingBuffer(maxPoints)
  timeWindow: configurable (seconds game-time)
}
```

Any numeric value from any unit can be recorded. Player toggles
"📈 Record" on inspector values. Multiple channels overlay on
shared chart.

---

# 16. Distillation Column — Campaign Status

Not required on critical path for 10 missions. Stays in S4 as
sandbox/educational. Optional ★★★ paths for M9 (O₂ > 99.5%
from air separation).

---

# 17. Validation Gate Structure

## 17.1 Composite Sub-Gate (V-0)

| Step | Test | Pass criteria |
|------|------|--------------|
| V-0a | Human standalone (air + food + water connected, 1 hr) | Rates match §4.6 |
| V-0b | Human air cut → buffer depletion | WARNING ~3 min, CRITICAL ~5.5 min |
| V-0c | Human water cut → dehydration | WARNING ~36 hr, CRITICAL ~68 hr |
| V-0d | Human food cut → starvation | WARNING ~4 days, CRITICAL ~17 days |
| V-0e | Greenhouse standalone (CO₂ + water + NH₃ + power, 1 hr) | O₂ and CH₂O at expected rates |
| V-0f | Greenhouse water cut → soil buffer depletion | WARNING ~4 hr |
| V-0g | Human + Greenhouse closed loop via room | O₂/CO₂ stabilize, mass balance closes |

## 17.2 Session Estimate

| Phase | Sessions |
|-------|----------|
| Composite sub-gate (V-0) | 1 |
| M1–M3 | 1 |
| M4–M6 | 1–2 |
| M7–M9 | 1–2 |
| M10 | 1 |
| **Total** | **5–7 sessions** |

---

# 18. Stream & Unit Visual Coding (UI Note)

> **Scope.** Pre-game-gate UI enhancement. Not a new stage — fits
> into an existing session as a visual polish pass.

## 18.1 Liquid Level Display

All units containing liquid shall display a visible fill level
in the 2D/3D view. This applies to any unit where the flash
calculation or inventory tracking yields a non-zero liquid
volume fraction:

- Tanks (tank, tank_cryo, reservoir in finite mode)
- Flash drums / LV separators
- Soil buffer, water buffer (inside composites, visible on Tab-in)
- Any future unit with liquid inventory

The level animates smoothly between ticks. Rapid fill/drain is
visually dramatic. Empty vessels show dry. Full vessels show
overflow alarm color.

## 18.2 Stream Line Styles

**Current:** Dashed = ELECTRICAL, Solid = MATERIAL. Already clear.
This leaves color and thickness unused.

**Proposed defaults:**

| Visual property | Encodes | Rationale |
|----------------|---------|-----------|
| Line style | Port type: solid = MATERIAL, dashed = ELECTRICAL | Existing, keep |
| **Color** | **Temperature** (cold → hot gradient) | Most intuitive. Blue (cryogenic) → white (ambient) → orange → red (hot). Immediately shows thermal structure of the plant. |
| **Thickness** | **Mass flow rate** (thin → thick) | Gives Sankey-like feel for free. Player sees where the mass goes. Dominant streams visually dominant. |

**Color scale (indicative):**

| T range | Color |
|---------|-------|
| < 150 K | Deep blue |
| 150–273 K | Light blue |
| 273–350 K | White/light grey |
| 350–500 K | Orange |
| > 500 K | Red |

**Thickness scale:** Logarithmic or capped linear. Minimum 1px
(trace flow), maximum ~6px (dominant stream). Zero-flow streams
render as thin grey (dormant).

**Configurability:** The player can switch color encoding via a
toolbar dropdown:

| Mode | Color encodes |
|------|--------------|
| Temperature (default) | T gradient as above |
| Phase | Blue = liquid, white = vapor, striped = two-phase |
| Pressure | Green (low) → yellow → red (high) |
| Species highlight | One species colored, rest grey (for tracing a component through the network) |

Thickness encoding switchable between mass flow rate (default)
and off (uniform width).

**ELECTRICAL streams:** Always dashed, fixed color (yellow/gold),
thickness encodes power (W). No temperature/phase meaning.

## 18.3 Implementation Note

This is a rendering concern, not physics. All data needed (T, P,
phase, ṁ, composition) is already computed per stream per tick.
The visual layer reads stream state and applies the mapping.
No solver changes. Estimate: 1 sub-session, no new tests (visual
only).

---

# 19. Summary of All Decisions

| # | Decision | Status |
|---|----------|--------|
| 1 | NNG-2: heating electrical, cooling material circuit | ✓ |
| 2 | NNG-3: no port without physical pipe/cable, no HEAT type | ✓ |
| 3 | NNG-3: no conditional port visibility | ✓ |
| 4 | Remove HEAT from port type enum (only MATERIAL + ELECTRICAL) | ✓ |
| 5 | heat_out purge from all specs (reactor_echem, fuel_cell, distillation, S10) | ✓ |
| 6 | reactor_equilibrium → split into reactor_adiabatic + reactor_jacketed + reactor_cooled | ✓ |
| 7 | reactor_electrochemical: remove heat_out, adiabatic, η default 0.90 | ✓ |
| 8 | fuel_cell: replace heat_out with cool_in/cool_out (material) | ✓ |
| 9 | Human composite: 11 internal units, 5 boundary ports, full energy closure via body_hex | ✓ |
| 10 | Human buffers: air 5L/pp, water 350mol/pp (3.1 days), food 424mol/pp (21 days) | ✓ |
| 11 | Body temperature: NOT modeled, room T as proxy | ✓ |
| 12 | Greenhouse composite: 7 internal units, 7 boundary ports, process/cooling fully separated | ✓ |
| 13 | Greenhouse leaf selectivity: { CH2O: 0.05, NH3: 0.05 } | ✓ |
| 14 | Greenhouse co2_in (not air_in), nutrient_in (H₂O + NH₃ combined) | ✓ |
| 15 | Default greenhouse η = 2% (was 1%) | ✓ |
| 16 | Splitter progression: simple tee in M3, manifold in M7 (Option C) | ✓ |
| 17 | Splitter manifold: flow_controlled mode, priority curtailment | ✓ |
| 18 | Shared allocation algorithm (S2 power + S5c flow) | ✓ |
| 19 | Mixer manifold: N-port passive merge | ✓ |
| 20 | Naming: pressure_controlled, flow_controlled, temperature_controlled | ✓ |
| 21 | CH₂O accepted as gas food | ✓ |
| 22 | Generic scaling: GroupTemplate scale param + scaleRules | ✓ |
| 23 | Room: tank with UA_wall, no smart occupant logic, no heat ports | ✓ |
| 24 | Room T alarm as life condition proxy | ✓ |
| 25 | Vents per mission (not in planet registry) | ✓ |
| 26 | Planet registry: atmosphere + diurnal only | ✓ |
| 27 | Deep tap: M10, P=8 bar, Cv=5.0 | ✓ |
| 28 | Ice detection: solidRisk flag in flash, alarms per unit | ✓ |
| 29 | Day/night: ±10K sinusoidal, toggleable via planet registry | ✓ |
| 30 | Distillation column: sandbox-only, not campaign-required | ✓ |
| 31 | LiOH scrubber: separator with finite sorbent counter | ✓ |
| 32 | Level display on all inventory units | ✓ |
| 33 | Time-series recorder: use existing charting library | ✓ |
| 34 | Validation gate: composite sub-gate + M1–M10, 5–7 sessions | ✓ |
| 35 | Depletables: O₂ 300mol, LiOH 268mol, MRE 3000mol, Battery 75kWh, Water EMPTY | ✓ |
| 36 | HUD runway gauges: green/amber/red/flashing | ✓ |
| 37 | Planet X atmosphere: 0.95% H₂O at 50% RH | ✓ |
| 38 | Stream visual coding: color=temperature, thickness=mass flow, configurable | ✓ |
| 39 | Liquid level display on all units with liquid inventory | ✓ |

---

# 20. Spec Propagation Map

| Decision(s) | Target document | Section |
|------------|----------------|---------|
| 1–4 | PTIS_S0_SPEC | NNG-2, NNG-3 updates |
| 5, 7 | PTIS_EQUIPMENT_MATRIX §3.1 | reactor_electrochemical ports |
| 5 | PTIS_EQUIPMENT_MATRIX §3.2 | distillation_column ports |
| 5, 8 | PTIS_EQUIPMENT_MATRIX §3.6 | fuel_cell ports |
| 6 | PTIS_EQUIPMENT_MATRIX §1.12 | Replace reactor_equilibrium with 3 new defIds |
| 6 | PTIS_S9_SPEC | Trunk table, reactor references |
| 8 | PTIS_S9_SPEC (fuel_cell) | New port layout |
| 9–11 | PTIS_S8_SPEC §S8c-5 | Human template rewrite |
| 12–15 | PTIS_S8_SPEC §S8c-4 | Greenhouse template rewrite |
| 13 | PTIS_EQUIPMENT_MATRIX §3.4 | Leaf selectivity correction |
| 16–20 | New PTIS_S5C_SPEC or S5 extension | Splitter/mixer manifold |
| 21 | PTIS_S9_SPEC (CH₂O) | Add note about gas-phase food |
| 22 | PTIS_S8_SPEC | Scale mechanism in GroupTemplate |
| 23–24 | PTIS_S10_SPEC §S10c | Room definition, room T alarms |
| 25–27 | PTIS_S10_SPEC, PTIS_MISSION_VALIDATION | Vent definitions per mission |
| 28 | PTIS_S3_SPEC | Flash solidRisk flag |
| 29, 26 | PTIS_S10_SPEC or S5a | Planet registry, T_amb |
| 31 | PTIS_S9_SPEC | New defId: lioh_scrubber |
| 34 | PTIS_ROADMAP, PTIS_MISSION_VALIDATION | Gate structure |
| 35–36 | PTIS_S10_SPEC §S10c | Depletables, HUD |
| 37 | PTIS_EQUIPMENT_MATRIX §7 | Atmosphere composition |
| 38–39 | PTIS_S10_SPEC or S8 (rendering) | Stream color/thickness mapping, liquid level display |
| 15 | PTIS_BIOSPHERE_POWER_RECONCILIATION | η default, waste heat path |
