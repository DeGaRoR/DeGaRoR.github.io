# PTIS_EQUIPMENT_MATRIX
## Process This In Space — Equipment, Chemistry & Species Reference
### Baseline: v12.10.0 · S-Size Pilot Plant Scale (2–10 persons)

---

## 1. Process Units

### 1.1 Air Cooler (Fin-Fan)

| Field | Value |
|-------|-------|
| **defId** | `air_cooler` |
| **Category** | HEAT_EXCHANGE |
| **Footprint** | 2×2 |
| **Physical** | Finned tube bank with electric fan blowing ambient air across fins |
| **Game intro** | M1 — improvised from ship radiator panels |
| **Salvage** | ISV Calypso thermal control radiator panels + cabin ventilation fan |

**Ports**

| portId | Direction | Type | Position |
|--------|-----------|------|----------|
| mat_in | IN | MATERIAL | left |
| mat_out | OUT | MATERIAL | right |
| elec_in | IN | ELECTRICAL | bottom |

**Parameters**

| Param | Default | Unit | Inspector | Notes |
|-------|---------|------|-----------|-------|
| T_approach | 10 | K | Editable | Min ΔT above ambient. Cannot cool below T_amb. |

**S-Size Limits**

| Param | LL | L | H | HH | Unit | Alarm |
|-------|-----|---|---|-----|------|-------|
| T | 253 | 273 | 623 | 723 | K | Phase: — |
| P | 0.2 | — | — | 150 | bar | |
| ṁ | — | — | — | 0.12 | kg/s | |

**S-Size Specs** (game_arch §45.1): Max flow 0.08 kg/s, fan power 50–100 W, heat rejection up to 20 kW.

---

### 1.2 Flash Drum (Vertical Separator)

| Field | Value |
|-------|-------|
| **defId** | `flash_drum` |
| **Category** | SEPARATION |
| **Footprint** | 2×2 |
| **Physical** | Vertical pressure vessel with mist eliminator, gravity separation |
| **Game intro** | M1 — repurposed hydraulic accumulator |
| **Salvage** | Cargo handling hydraulic accumulator, welded + mist eliminator added |

**Ports**

| portId | Direction | Type | Position |
|--------|-----------|------|----------|
| mat_in | IN | MATERIAL | left |
| vap_out | OUT | MATERIAL | top |
| liq_out | OUT | MATERIAL | bottom |

**Parameters**

None — passive unit. Operates at inlet conditions.

**S-Size Limits**

| Param | LL | L | H | HH | Unit |
|-------|-----|---|---|-----|------|
| T | 243 | 263 | 523 | 623 | K |
| P | 0.2 | — | — | 150 | bar |
| ṁ | — | — | — | 0.15 | kg/s |

**S-Size Specs** (game_arch §45.2): Volume 0.05 m³, max pressure 100 bar, T range 80–600 K.

---

### 1.3 Tank (Storage Vessel)

| Field | Value |
|-------|-------|
| **defId** | `tank` |
| **Category** | VESSEL |
| **Footprint** | 2×3 |
| **Physical** | Cylindrical pressure vessel with inlet/outlet nozzles, P/T gauges |
| **Game intro** | M1 — storage containers from hangar |
| **Salvage** | Various ship storage containers |

**Ports**

| portId | Direction | Type | Position |
|--------|-----------|------|----------|
| mat_in | IN | MATERIAL | left |
| mat_out | OUT | MATERIAL | right |
| overflow | OUT | MATERIAL | top |

**Parameters**

| Param | Default | Corrected Default | Unit | Notes |
|-------|---------|-------------------|------|-------|
| volume_m3 | ~~50~~ | **0.15** | m³ | ⚠ Code says 50, must fix to 0.15 (S1c) |
| drawRate | 1.0 | 1.0 | mol/s | |

**Inventory**: Yes — tracks `{ n: {species: mol}, T, P }` per tick.

**S-Size Limits**

| Param | LL | L | H | HH | Unit |
|-------|-----|---|---|-----|------|
| T | 263 | 278 | 333 | 353 | K |
| P | 0.8 | — | — | 5 | bar |
| ṁ | — | — | — | 0.05 | kg/s |
| level | — | — | 90 | 100 | % |

**S-Size Specs** (game_arch §45.3): Volume 0.15 m³ default (adjustable 0.01–1.0 m³), max pressure 200 bar, T range 80–600 K.

**Variant — Dewar Tank (M9)**: Vacuum-insulated. T_LL = 20 K, P_HH = 10 bar. Same defId, distinguished by mission paramLocks or visual variant.

**Resolved**: Single `tank` defId with wide limits (P_HH = 200 bar). Missions use paramLocks to tighten P_HH for LP service (e.g., P_HH = 5 bar). Cryo Dewar is separate defId `tank_cryo` (vacuum-insulated, T_LL = 20K, P_HH = 10 bar) — physically distinct machine.

---

### 1.4 Compressor (Diaphragm)

| Field | Value |
|-------|-------|
| **defId** | `compressor` |
| **Category** | TURBOMACHINERY |
| **Footprint** | 2×2 |
| **Physical** | Metal-diaphragm compressor, electric motor driven, no lubricant in gas path |
| **Game intro** | M4 — from ship's H₂ handling system in propulsion section |
| **Salvage** | Cryogenic propellant system diaphragm compressor. Jin helps extract. |

**Ports**

| portId | Direction | Type | Position |
|--------|-----------|------|----------|
| mat_in | IN | MATERIAL | left |
| mat_out | OUT | MATERIAL | right |
| elec_in | IN | ELECTRICAL | bottom |

**Parameters**

| Param | Default | Unit | Notes |
|-------|---------|------|-------|
| Pout | 300,000 | Pa | Discharge pressure target |
| eta | 0.80 | — | Isentropic efficiency |

**S-Size Limits**

| Param | LL | L | H | HH | Unit | Notes |
|-------|-----|---|---|-----|------|-------|
| T | 243 | 263 | 333 | 353 | K | Discharge T |
| P | 0.5 | — | — | 150 | bar | Discharge P |
| ṁ | — | — | — | 0.05 | kg/s | |
| phase | — | — | — | — | — | REQUIRED: V (vapor only) |

**S-Size Specs** (game_arch §45.8): Max mass flow 0.03 kg/s, max P_out 150 bar, max ratio ~10/stage, η 0.70–0.85, motor up to 5 kW.

---

### 1.5 Gas Turbine (Micro Radial Expander)

| Field | Value |
|-------|-------|
| **defId** | `gas_turbine` |
| **Category** | TURBOMACHINERY |
| **Footprint** | 2×2 |
| **Physical** | Compact radial-inflow turbine with single-stage impeller, coupled to generator |
| **Game intro** | M4 — APU from ship's emergency power system |
| **Salvage** | Auxiliary power unit from propulsion section |

**Ports**

| portId | Direction | Type | Position |
|--------|-----------|------|----------|
| mat_in | IN | MATERIAL | left |
| mat_out | OUT | MATERIAL | right |
| elec_out | OUT | ELECTRICAL | bottom |

**Parameters**

| Param | Default | Unit | Notes |
|-------|---------|------|-------|
| Pout | 101,325 | Pa | Exhaust pressure |
| eta | 0.88 | — | Isentropic efficiency |

**S-Size Limits**

| Param | LL | L | H | HH | Unit | Notes |
|-------|-----|---|---|-----|------|-------|
| T | 323 | 373 | 873 | 1023 | K | Inlet T (blade material limit) |
| P | 1.5 | — | — | 150 | bar | Inlet P |
| ṁ | 0.005 | — | — | 0.12 | kg/s | Min flow for stable operation |
| phase | — | — | — | — | — | REQUIRED: V |

**S-Size Specs** (game_arch §45.9): Max inlet T 1023 K, max inlet P 20 bar, η 0.75–0.85, power up to 10 kW, mass flow up to 0.1 kg/s. Dual role: power turbine (M4/M8) or turboexpander for cooling (M9).

---

### 1.6 Pump (Gear/Metering)

| Field | Value |
|-------|-------|
| **defId** | `pump` |
| **Category** | TURBOMACHINERY |
| **Footprint** | 2×2 |
| **Physical** | Small positive-displacement gear pump, electric motor driven, liquid service only |
| **Game intro** | M8 — from ship's propellant transfer system |
| **Salvage** | Metering pump from propellant transfer line in propulsion section |

**Ports**

| portId | Direction | Type | Position |
|--------|-----------|------|----------|
| mat_in | IN | MATERIAL | left |
| mat_out | OUT | MATERIAL | right |
| elec_in | IN | ELECTRICAL | bottom |

**Parameters**

| Param | Default | Unit | Notes |
|-------|---------|------|-------|
| Pout | 500,000 | Pa | Discharge pressure |
| eta | 0.75 | — | Efficiency |

**S-Size Limits**

| Param | LL | L | H | HH | Unit | Notes |
|-------|-----|---|---|-----|------|-------|
| T | 263 | 278 | 353 | 393 | K | |
| P | 0.5 | — | — | 50 | bar | Discharge P |
| ṁ | — | — | — | 0.12 | kg/s | |
| phase | — | — | — | — | — | REQUIRED: L (liquid only) |

**S-Size Specs** (game_arch §45.14): Max flow 0.01 kg/s, max P_out 20 bar, power typically < 10 W, η 0.70–0.85. Teaching: pump work negligible vs compressor work (liquid incompressibility).

---

### 1.7 Valve (Globe Control)

| Field | Value |
|-------|-------|
| **defId** | `valve` |
| **Category** | PRESSURE_CHANGE |
| **Footprint** | 2×2 |
| **Physical** | Globe-type control valve with positioner. Isenthalpic expansion. |
| **Game intro** | M5 — first player-built equipment (fabricated in workshop) |
| **Salvage** | Gate valve body + control spring from cargo winch + emergency suit seals |

**Ports**

| portId | Direction | Type | Position |
|--------|-----------|------|----------|
| mat_in | IN | MATERIAL | left |
| mat_out | OUT | MATERIAL | right |

**Parameters**

| Param | Default | Unit | Notes |
|-------|---------|------|-------|
| Pout | 101,325 | Pa | Downstream pressure target |

**S-Size Limits**

| Param | LL | L | H | HH | Unit |
|-------|-----|---|---|-----|------|
| T | 243 | 263 | 523 | 623 | K |
| P | — | — | — | 150 | bar |
| ṁ | — | — | — | 0.25 | kg/s |

**S-Size Specs** (game_arch §45.11): Cv adjustable, max inlet P 200 bar. JT cooling architecture: H_target = H_in, PH-flash resolves T_out.

**S5 enhancement**: Cv parameter added, flow from ΔP.

---

### 1.8 Electric Heater (Inline)

| Field | Value |
|-------|-------|
| **defId** | `electric_heater` |
| **Category** | HEAT_EXCHANGE |
| **Footprint** | 2×2 |
| **Physical** | Resistance heating element inside a pipe section |
| **Game intro** | M7 — from ship's chemistry lab (reactant preheater) |
| **Salvage** | Standard lab heater from chemistry lab section |

**Ports**

| portId | Direction | Type | Position |
|--------|-----------|------|----------|
| mat_in | IN | MATERIAL | left |
| mat_out | OUT | MATERIAL | right |
| elec_in | IN | ELECTRICAL | bottom |

**Parameters**

| Param | Default | Unit | Notes |
|-------|---------|------|-------|
| T_out | 423.15 | K | Target outlet temperature |
| mode | 'T_setpoint' | — | 'T_setpoint' or 'Q_fixed' |

**S-Size Limits**

| Param | LL | L | H | HH | Unit |
|-------|-----|---|---|-----|------|
| T | 253 | 273 | 723 | 823 | K |
| P | 0.2 | — | — | 150 | bar |
| ṁ | 0.002 | — | — | 0.12 | kg/s |

**S-Size Specs** (game_arch §45.13): Max power 5 kW, max T_out 923 K (element limit), efficiency ~98%.

---

### 1.9 Heat Exchanger (Brazed Plate)

| Field | Value |
|-------|-------|
| **defId** | `hex` |
| **Category** | HEAT_EXCHANGE |
| **Footprint** | 2×2 |
| **Physical** | Compact corrugated stainless steel plate stack, counter-current flow |
| **Game intro** | M3 — from ship cooling loop |
| **Salvage** | Plate HEX from ship's thermal control system |

**Ports**

| portId | Direction | Type | Position |
|--------|-----------|------|----------|
| hot_in | IN | MATERIAL | top-left |
| hot_out | OUT | MATERIAL | bottom-left |
| cold_in | IN | MATERIAL | bottom-right |
| cold_out | OUT | MATERIAL | top-right |

**Parameters**

| Param | Default | Unit | Notes |
|-------|---------|------|-------|
| T_approach | 10 | K | Min approach ΔT (approach mode) |

Solve modes: approach (bisection with PH-flash), T_setpoint (fixed outlet), UA/NTU (effectiveness). Mode auto-selected or user-toggled.

**S-Size Limits**

| Param | LL | L | H | HH | Unit |
|-------|-----|---|---|-----|------|
| T | 243 | 263 | 573 | 673 | K |
| P | 0.2 | — | — | 150 | bar |
| ṁ | — | — | — | 0.12 | kg/s |

**S-Size Specs** (game_arch §45.7): Heat transfer area 2 m², UA 500 W/K, max P 100 bar/side, min approach 5 K.

**Known bug (S4b fix)**: `hxSolveUaNtu` uses sensible Cp (streamCp) which is wrong for two-phase streams. ~15-line fix to use effective Cp from ΔH/ΔT.

---

### 1.10 Mixer (Static Inline)

| Field | Value |
|-------|-------|
| **defId** | `mixer` |
| **Category** | TOPOLOGY |
| **Footprint** | 2×2, variants for port layout |
| **Physical** | Short pipe section with internal baffles or helical elements |
| **Game intro** | M3 — from chemical processing line |
| **Salvage** | Static mixer section from ISRU module |

**Ports**

| portId | Direction | Type | Position |
|--------|-----------|------|----------|
| mat_in_1 | IN | MATERIAL | left-top |
| mat_in_2 | IN | MATERIAL | left-bottom (or per variant) |
| mat_out | OUT | MATERIAL | right |

**Parameters**: None — passive. Outlet = molar average of inlets, enthalpy conserved.

**S-Size Limits**

| Param | LL | L | H | HH | Unit |
|-------|-----|---|---|-----|------|
| T | 243 | 263 | 623 | 723 | K |
| P | 0.2 | — | — | 150 | bar |
| ṁ | — | — | — | 0.25 | kg/s |

---

### 1.11 Splitter (Pipe Tee)

| Field | Value |
|-------|-------|
| **defId** | `splitter` |
| **Category** | TOPOLOGY |
| **Footprint** | 2×2 |
| **Physical** | Pipe T-junction with adjustable valve on each outlet |
| **Game intro** | M7 — pipe tee from chemistry lab salvage |
| **Salvage** | Pipe fittings from throughout the wreck |

**Ports**

| portId | Direction | Type | Position |
|--------|-----------|------|----------|
| mat_in | IN | MATERIAL | left |
| mat_out_1 | OUT | MATERIAL | right |
| mat_out_2 | OUT | MATERIAL | bottom |

**Parameters**

| Param | Default | Unit | Notes |
|-------|---------|------|-------|
| splitPct | 50 | % | Fraction to outlet 1 (remainder to outlet 2) |

**S-Size Limits**

| Param | LL | L | H | HH | Unit |
|-------|-----|---|---|-----|------|
| T | 243 | 263 | 623 | 723 | K |
| P | 0.2 | — | — | 150 | bar |
| ṁ | — | — | — | 0.25 | kg/s |

---

### 1.12 Reactor — Equilibrium (Fixed-Bed Catalytic)

| Field | Value |
|-------|-------|
| **defId** | `reactor_equilibrium` |
| **Category** | REACTION |
| **Footprint** | 2×2 |
| **Physical** | Vertical cylindrical vessel packed with catalyst pellets |
| **Game intro** | M3 (Sabatier), M4 (combustion, adiabatic mode), M7 (Haber) |
| **Salvage** | M3: Sabatier CO₂ recycler catalyst bed; M4: propulsion combustor |

**Ports**

| portId | Direction | Type | Position | Conditional |
|--------|-----------|------|----------|-------------|
| mat_in | IN | MATERIAL | left | Always |
| mat_out | OUT | MATERIAL | right | Always |
| elec_in | IN | ELECTRICAL | bottom | Only when heatDemand = 'isothermal' or 'fixed' |

**Parameters**

| Param | Default | Corrected Default | Unit | Notes |
|-------|---------|-------------------|------|-------|
| reactionId | 'R_H2_COMB' | — | — | Which reaction to drive |
| useKinetics | true | — | — | Use kinetic model |
| volume_m3 | ~~1.0~~ | **0.003** | m³ | ⚠ Code says 1.0, must fix (S1c) |
| alpha | 1.0 | — | — | Activity factor |
| heatDemand | 'none' | — | — | 'none' = adiabatic, 'isothermal', 'fixed' |
| variant | 'insulated' | — | — | Visual variant |

**Heat demand modes**:
- `'none'` — Adiabatic. Q_in = 0. T_out from energy balance. (Game's "combustion chamber")
- `'isothermal'` — T_out = T_in. Q_in computed. Needs elec_in.
- `'fixed'` — Q_in = fixed value. T_out from energy balance. Needs elec_in.

**S-Size Limits**

| Param | LL | L | H | HH | Unit | Notes |
|-------|-----|---|---|-----|------|-------|
| T | 323 | 373 | 773 | 923 | K | Catalyst sintering limit at HH |
| P | 0.5 | — | — | 150 | bar | |
| ṁ | 0.001 | — | — | 0.08 | kg/s | |
| phase | — | — | — | — | — | REQUIRED: V |

**S-Size Specs** (game_arch §45.6): Volume 0.05 m³, catalyst ~40 kg, max T 923 K, max P 150 bar, GHSV 10,000–50,000 hr⁻¹.

**Visual variants**: 'insulated' (catalytic bed + insulation wrap), 'combustion' (flame viewport). Same physics. Game arch lists "reactor_adi" as separate visual type for M4 combustion chamber — implemented as visualVariant, not separate defId.

---

## 2. Infrastructure Units

### 2.1 Battery

| Field | Value |
|-------|-------|
| **defId** | `battery` |
| **Footprint** | 2×2 |
| **Ports** | `elec` (bidirectional ELECTRICAL) |

**Parameters**

| Param | Default | Unit | Notes |
|-------|---------|------|-------|
| peakPower_kW | 20 | kW | Max charge/discharge rate |
| capacity_J | 36,000,000 | J | = 10 kWh |
| initialSOC | 0.9 | fraction | Starting state of charge |

**Inventory**: Yes — tracks SOC per tick. Game starting battery: 75 kWh.

---

### 2.2 Power Hub

| Field | Value |
|-------|-------|
| **defId** | `power_hub` |
| **Footprint** | 2×2 |
| **Ports** | Multiple ELECTRICAL IN + OUT |

**Parameters**: None. Distributes power from sources to consumers. S2 adds priority allocation logic.

---

### 2.3 Sources

| defId | Type | Default Params | Notes |
|-------|------|----------------|-------|
| `source` | MATERIAL out | `{ n, T, P, phaseConstraint }` | Single-species. Game: "geothermal vent" |
| `source_multi` | MATERIAL out | `{ n: {species: mol}, T, P, phaseConstraint }` | Multi-species. Game: "vent gas feed" |
| `source_air` | MATERIAL out | (atmosphere composition) | Ambient air at T_atm, P_atm |
| `grid_supply` | ELECTRICAL out | `{ P_kW }` | External power. Game: not used (no grid on planet) |

**Game mapping**: `source`/`source_multi` → "geothermal vent" (M1, M4). `source_air` → "atmosphere intake" (M4+). Narratively reframed but functionally unchanged. S5 introduces `reservoir` as replacement for sources in pressure-driven mode; existing sources kept for backward compat.

---

### 2.4 Sinks

| defId | Type | Ports | Notes |
|-------|------|-------|-------|
| `sink` | MATERIAL in | `in` (MATERIAL) | Accepts any flow. Game: exhaust, waste |
| `sink_electrical` | ELECTRICAL in | `in` (ELECTRICAL) | ⚠ Code: powerDemand = Infinity. S2 fix: add ratedPower_kW param |

---

## 3. Planned New Units (Engine Stages)

### 3.1 Reactor — Electrochemical (S6)

| Field | Value |
|-------|-------|
| **defId** | `reactor_electrochemical` |
| **Category** | REACTION |
| **Footprint** | 2×3 |
| **Physical** | Electrochemical cell stack, power-driven reaction, membrane-separated outlets |
| **Game intro** | M2 (as electrolyzer for water splitting) |
| **Salvage** | Life support spare from ship stores (PEM stack) |
| **Trunk** | `electrochemical` (shared with fuel_cell) |

**Ports**

| portId | Label | Direction | Type |
|--------|-------|-----------|------|
| mat_in | Feed | IN | MATERIAL |
| elec_in | Power in | IN | ELECTRICAL |
| mat_out_cat | Cathode | OUT | MATERIAL |
| mat_out_ano | Anode (O₂) | OUT | MATERIAL |
| heat_out | Waste heat | OUT | ELECTRICAL |

**Parameters**

| Param | Default | Unit | Notes |
|-------|---------|------|-------|
| reactionId | 'R_H2O_ELEC' | — | Electrochemical reaction to drive |
| efficiency | 0.70 | — | Electrical → chemical efficiency |
| conversion_max | 0.80 | — | Max single-pass conversion |

**Physics**: ξ = P_chemical / |ΔH_rxn|. Electrode separation: O₂ → anode, everything else → cathode. Waste heat Q = P_available − Q_chem.

**Resolved**: 2 outlets by design — electrode membrane physically separates products. No flash drum needed.

---

### 3.2 Distillation Column (S4)

| Field | Value |
|-------|-------|
| **defId** | `distillation_column` |
| **Category** | SEPARATION |
| **Footprint** | 2×3 |
| **Physical** | Trayed or packed column with condenser and reboiler |
| **Game usage** | Sandbox only — campaign M5 uses compression+flash for air separation |

**Ports**

| portId | Direction | Type |
|--------|-----------|------|
| mat_in | IN | MATERIAL |
| elec_in | IN | ELECTRICAL |
| mat_out_D | OUT | MATERIAL |
| mat_out_B | OUT | MATERIAL |
| heat_out | OUT | ELECTRICAL |

**Parameters**

| Param | Default | Unit |
|-------|---------|------|
| N_stages | 20 | — |
| R_over_Rmin | 1.3 | — |
| feed_stage_frac | 0.5 | — |
| P_column_bar | 5 | bar |
| lightKey | — | species ID |
| heavyKey | — | species ID |
| xD_lightKey | 0.95 | mol frac |
| xB_heavyKey | 0.95 | mol frac |

**Method**: Fenske → N_min, Underwood → R_min, Gilliland → N_actual.

---

### 3.3 Reservoir (S5)

| Field | Value |
|-------|-------|
| **defId** | `reservoir` |
| **Category** | VESSEL |
| **Footprint** | 2×3 (enhanced tank) |
| **Physical** | Tank with headspace pressure computation, 5-port |

Modes: `sealed` (P = P_charge), `vented` (P = P_atm), `finite` (P from gas law + PR density).

---

### 3.4 Membrane Separator (S8c)

| Field | Value |
|-------|-------|
| **defId** | `membrane_separator` |
| **Category** | SEPARATOR |
| **Footprint** | 1×2 |
| **Physical** | Selective permeation membrane — gas exchange or renal filtration |
| **Game intro** | M10 (internal to greenhouse and human group templates) |
| **Trunk** | `separatorTick` (new, dedicated) |

**Ports**

| portId | Label | Direction | Type |
|--------|-------|-----------|------|
| mat_in | Feed | IN | MATERIAL |
| perm_out | Permeate | OUT | MATERIAL |
| ret_out | Retentate | OUT | MATERIAL |

**Parameters**

| Param | Default | Unit | Notes |
|-------|---------|------|-------|
| membrane | 'gas_exchange' | enum | Membrane type (selectivity preset) |
| selectivity | `{ O2: 0.95 }` | — | Species → fraction passing to permeate |

**Physics**: Pure selectivity-map permeation (not VLE). Each species in
feed is split: `selectivity[sp]` fraction to permeate, remainder to
retentate. Unspecified species default to 0 (retentate). Mass and energy
balance close exactly.

**Configurations in campaign templates:**

| Template | membrane | selectivity | Physical analogue |
|----------|----------|------------|-------------------|
| Greenhouse (leaf) | gas_exchange | `{ O2: 0.95, H2O: 0.80 }` | Stomatal gas exchange |
| Human (kidney) | renal | `{ H2O: 0.99, CO2: 0.05 }` | Renal filtration |

Same defId, different operating parameters. NNG-3 compliant.

---

### 3.5 Composites (S8c via S7b Group Templates)

Composites are **locked group templates** registered via S7b
GroupTemplateRegistry — not opaque units with bespoke tick functions.
The player can Tab into any composite to see real units running real
physics (read-only wiring, selectively editable parameters).

| Template ID | Internal units | Boundary ports | Notes |
|-------------|---------------|----------------|-------|
| `greenhouse` | grid_supply, reactor_electrochemical (R_PHOTO), membrane_separator (leaf), mixer | air_in, water_in, elec_in, air_out, food_out | η editable (0.5–5%) |
| `human` | reactor_equilibrium (R_METABOLISM), membrane_separator (kidney) | air_in, food_in, air_out, waste_out | Parameterized by population |

Full template definitions in `PTIS_S7b_SPEC.md` §S7b Impact on S8 Spec.

**Greenhouse sizing (7 colonists):** 85 kW electrical at η=1%, 848 W
thermodynamic minimum, 84.2 kW waste heat.

**Human metabolic rates (2500 kcal/day/person):** 0.84 mol/hr/person
each of CH₂O, O₂ consumed and CO₂, H₂O produced. 121 W/person
metabolic heat (from reactor energy balance).

### 3.6 Fuel Cell (S8)

| Field | Value |
|-------|-------|
| **defId** | `fuel_cell` |
| **Category** | REACTION |
| **Footprint** | 2×3 |
| **Physical** | PEM/SOFC stack — reverse electrolysis, generates power |
| **Game intro** | Future (not in current 10 missions) |
| **Trunk** | `electrochemical` (shared with reactor_electrochemical) |

**Ports**

| portId | Label | Direction | Type |
|--------|-------|-----------|------|
| mat_in_cat | Fuel (H₂) | IN | MATERIAL |
| mat_in_ano | Oxidant (O₂) | IN | MATERIAL |
| mat_out | Exhaust | OUT | MATERIAL |
| elec_out | Power out | OUT | ELECTRICAL |
| heat_out | Waste heat | OUT | ELECTRICAL |

**Reactions**: R_H2_FUELCELL (2H₂+O₂→2H₂O), R_CO_FUELCELL (2CO+O₂→2CO₂). Trunk detects ΔH<0 → generate mode.

### 3.7 Steam Turbine (S8)

| Field | Value |
|-------|-------|
| **defId** | `steam_turbine` |
| **Category** | PRESSURE |
| **Footprint** | 2×2 |
| **Physical** | Axial steam expander with moisture tolerance limit |
| **Game intro** | M8 (Rankine bottoming cycle) |
| **Trunk** | `expander` (shared with gas_turbine) |

Same ports as gas_turbine. Config: `moistureCheck: true, maxWetness: 0.12`. Limits: T_HH=823K, P_HH=100 bar. WARNING if exhaust liquid fraction > 12%.

### 3.8 Cryo Dewar (S8)

| Field | Value |
|-------|-------|
| **defId** | `tank_cryo` |
| **Category** | VESSEL |
| **Footprint** | 2×2 |
| **Physical** | Vacuum-insulated storage vessel (multi-layer insulation) |
| **Game intro** | M9 (cryogenic reserves) |
| **Trunk** | `vessel` (shared with tank, reservoir) |

Same ports as tank. Limits: T_LL=20K, T_HH=300K, P_HH=10 bar (fragile vessel). Narratively distinct: vacuum jacket, boil-off vent, frost accumulation.

---

## 4. Species Registry

### 4.1 Current (v12.10.0 baseline — 9 species)

| ID | Formula | MW (g/mol) | Tc (K) | Pc (bar) | ω | Shomate ranges | Antoine |
|----|---------|-----------|--------|----------|---|----------------|---------|
| H2O | H₂O | 18.015 | 647.1 | 220.64 | 0.344 | ⚠ 500–1700 → **fix to 298–1700** | 255–373 K |
| O2 | O₂ | 31.999 | 154.6 | 50.43 | 0.022 | 100–700, 700–2000 | 54–154 K |
| H2 | H₂ | 2.016 | 33.2 | 12.97 | −0.217 | 298–1000, 1000–2500 | 14–33 K |
| N2 | N₂ | 28.014 | 126.2 | 33.94 | 0.037 | 100–500, 500–2000 | 63–126 K |
| Ar | Ar | 39.948 | 150.7 | 48.98 | 0.000 | 298–6000 | 81–151 K |
| CH4 | CH₄ | 16.043 | 190.6 | 45.99 | 0.011 | 298–1300, 1300–6000 | 91–190 K |
| He | He | 4.003 | 5.2 | 2.27 | −0.390 | 298–6000 | 2–5 K |
| CO2 | CO₂ | 44.010 | 304.1 | 73.77 | 0.224 | 298–1200, 1200–6000 | ⚠ 154–196 K only → **add 217–304 K** |
| NH3 | NH₃ | 17.031 | 405.4 | 113.53 | 0.253 | 298–1400, 1400–6000 | 164–240 K |

### 4.2 Added in S1a (1 species → 10 total)

| ID | Formula | MW | Tc (K) | Pc (bar) | ω | Shomate ranges |
|----|---------|-----|--------|----------|---|----------------|
| CO | CO | 28.010 | 132.9 | 34.99 | 0.048 | 298–1300, 1300–6000 |

### 4.3 Added in S8c (1 species → 11 total)

| ID | Formula | MW | Notes |
|----|---------|-----|-------|
| CH2O | CH₂O (formaldehyde) | 30.026 | Food proxy for M10 photosynthesis/metabolism |

---

## 5. Reaction Registry

### 5.1 Current Baseline (3 reactions)

| ID | Equation | ΔH° (J/mol) | Kinetics | Notes |
|----|----------|-------------|----------|-------|
| R_H2_COMB | 2H₂ + O₂ → 2H₂O | −483,600 | POWER_LAW | |
| R_SABATIER | CO₂ + 4H₂ → CH₄ + 2H₂O | −165,000 | POWER_LAW | |
| R_STEAM_REFORM | CH₄ + 2H₂O → CO₂ + 4H₂ | +165,000 | POWER_LAW | ⚠ Renamed to R_SMR_OVERALL in S1b |

### 5.2 After S1b (14 reactions)

| ID | Equation | ΔH° (J/mol) | Kinetics | Game mission | New/Changed |
|----|----------|-------------|----------|-------------|-------------|
| R_H2_COMB | 2H₂ + O₂ → 2H₂O | −483,600 | POWER_LAW | Sandbox | existing |
| R_SABATIER | CO₂ + 4H₂ → CH₄ + 2H₂O | −165,000 | POWER_LAW | M3 | existing |
| R_SMR_OVERALL | CH₄ + 2H₂O → CO₂ + 4H₂ | +165,000 | POWER_LAW | Sandbox | **renamed** |
| R_HABER | N₂ + 3H₂ ⇌ 2NH₃ | −91,796 | POWER_LAW | M7 | **new** |
| R_SMR | CH₄ + H₂O → CO + 3H₂ | +206,000 | POWER_LAW | Sandbox | **new** |
| R_WGS | CO + H₂O ⇌ CO₂ + H₂ | −41,200 | POWER_LAW | Sandbox | **new** |
| R_RWGS | CO₂ + H₂ → CO + H₂O | +41,200 | POWER_LAW | Sandbox | **new** |
| R_CH4_COMB | CH₄ + 2O₂ → CO₂ + 2H₂O | −802,600 | POWER_LAW | M4 | **new** |
| R_H2O_ELEC | 2H₂O → 2H₂ + O₂ | +483,600 | ELECTROCHEMICAL | M2 | **new** (data only until S6) |
| R_CO2_ELEC | 2CO₂ → 2CO + O₂ | +566,000 | ELECTROCHEMICAL | Sandbox | **new** (data only until S6) |
| R_COELEC | CO₂ + H₂O → CO + H₂ + O₂ | +524,806 | ELECTROCHEMICAL | Late-game unlock | **new** (co-electrolysis, data only until S6) |
| R_H2_FUELCELL | 2H₂ + O₂ → 2H₂O | −483,600 | ELECTROCHEMICAL | Future (fuel cell) | **new** (data only until fuel_cell unit) |
| R_CO_FUELCELL | 2CO + O₂ → 2CO₂ | −566,000 | ELECTROCHEMICAL | Future (fuel cell) | **new** (data only until fuel_cell unit) |

### 5.3 Added in S8c (16 reactions total)

| ID | Equation | ΔH° (J/mol) | Kinetics | Game mission |
|----|----------|-------------|----------|-------------|
| R_PHOTOSYNTHESIS | CO₂ + H₂O → CH₂O + O₂ | +519,000 | ELECTROCHEMICAL | M10 (greenhouse) |
| R_METABOLISM | CH₂O + O₂ → CO₂ + H₂O | −519,000 | POWER_LAW (complete) | M10 (human) |

---

## 6. Campaign Equipment Progression

| Unit | M1 | M2 | M3 | M4 | M5 | M6 | M7 | M8 | M9 | M10 |
|------|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:---:|
| source (vent) | ★ | · | · | +1 | · | · | · | · | · | · |
| source_air | | | | ★ | · | · | · | · | · | · |
| air_cooler | ★ | · | · | · | +1 | · | · | · | · | · |
| flash_drum | ★ | · | · | · | +1 | · | · | · | · | · |
| tank | ★★ | +1 | · | · | · | · | · | · | +2 | · |
| electrolyzer | | ★ | · | · | · | · | · | · | · | · |
| battery | | ★ | · | · | · | · | · | · | · | · |
| mixer | | | ★ | · | · | · | · | · | · | · |
| reactor_eq | | | ★ | +1 | · | · | · | · | · | · |
| hex | | | ★ | · | · | +1 | · | · | · | · |
| compressor | | | | ★ | +1 | · | · | · | · | · |
| gas_turbine | | | | ★ | · | · | · | · | · | · |
| valve | | | | | ★ | · | · | · | · | · |
| splitter | | | | | | | ★ | · | · | · |
| heater | | | | | | | ★ | · | · | · |
| pump | | | | | | | | ★ | · | · |
| steam_turbine | | | | | | | | ★ | · | · |
| tank_cryo | | | | | | | | | ★★ | · |
| membrane_separator | | | | | | | | | | ★★ |
| greenhouse | | | | | | | | | | ★ |
| human | | | | | | | | | | ★ |

★ = introduced  · = carried  +N = additional units of same type

Notes: M4 reactor_eq is a second unit (combustion chamber), locked to
R_CH4_COMB + heatDemand:'none' via paramLocks. M8 steam_turbine is a
separate defId from gas_turbine (shared expander trunk, moisture check).
M9 tank_cryo is a separate defId from tank (Dewar, vacuum-insulated).
M10 membrane_separator (★★) is internal to greenhouse and human group
templates — the player never places it directly, but sees it when
Tab-opening either composite. greenhouse and human are locked S7b group
templates with transparent internals.

**M10 fabrication unlock:** All previously introduced equipment becomes
available in unlimited quantities (∞). Player must build 4–5 combined
cycle power blocks to supply the greenhouse's ~85 kW demand.

---

## 7. Planet X Atmosphere

| Parameter | Value |
|-----------|-------|
| Composition | 70% N₂, 21% O₂, 8% CO₂, 1% Ar |
| Surface pressure | 0.885 atm (89,750 Pa) |
| Surface temperature | 288 K (15°C) |
| Geothermal vent gas | 500 K, ~1 atm, 30% H₂O / 35% CO₂ / 25% N₂ / 10% CH₄ |
| Single vent flow | 0.002 kg/s (0.068 mol/s) |
| Second vent (M4+) | 0.005 kg/s, same composition |

---

## 8. Limit Severity Mapping

All equipment limits follow the four-tier scheme:

| Zone | Condition | Severity | Game consequence |
|------|-----------|----------|-----------------|
| Below LL or above HH | Out of physical envelope | CRITICAL | Catastrophic failure (rupture, fry, blade loss) |
| Between LL–L or H–HH | Approaching limit | WARNING | Expert warns, time warp limited |
| Between L–H | Normal operating range | OK | — |
| Phase violation | Wrong phase for unit | CRITICAL | Immediate alarm (liquid in compressor, gas in pump) |

Limit evaluation: `evaluateLimits(def, unit, unitData, mission)` → pure function.
Three-layer merge: `getEffectiveLimits(def, unit, mission?)` → definition ∩ mission ∩ player.
