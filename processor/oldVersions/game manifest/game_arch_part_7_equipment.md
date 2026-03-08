---

# PART VII — EQUIPMENT

---

## 44. Equipment Design Principles

### The Physical Equipment Rule (NNG-3 Extended)

Every unit in the game palette is a real, nameable, physically purchasable piece of equipment. You could walk into a pilot plant or process equipment catalog and point at one. "That's a diaphragm compressor." "That's a brazed-plate heat exchanger." "That's a vertical flash drum."

This rule exists because:
- It grounds the game in reality. Equipment has weight, size, failure modes, and limitations because real equipment does.
- It makes salvage narratively plausible. The ship carried real equipment, and the player finds real equipment.
- It teaches real engineering vocabulary. A player who completes the game can read a Process Flow Diagram.

### S-Size Scale

All equipment is sized for a pilot-plant scale serving 2-10 people:

| Parameter | Range |
|-----------|-------|
| Vessel volumes | 0.05–0.20 m³ (50-200 liters) |
| Piping | DN15-DN50 |
| Flow rates | 0.001–0.1 mol/s |
| Motor/compressor power | 0.5–5 kW |
| Heat transfer areas | 0.5–5 m² |

This scale means equipment is heavy but movable by 2-4 people. A 50L reactor with catalyst weighs ~65 kg. A compressor is ~45 kg. Realistic for crash salvage with improvised transport.

---

## 45. Canonical Equipment List

### 1. Air Cooler (Fin-Fan)

**Physical description:** Finned tube bank with an electric fan blowing ambient air across the fins. Ship radiator panels repurposed. Simple, rugged, no moving parts except the fan.

**What it does:** Cools a hot gas stream toward ambient temperature. Cannot cool below ambient (second law). The approach temperature (how close to ambient) depends on fin area and air flow.

**S-Size specs:**
- Max flow: 0.08 kg/s (mass-based)
- Approach temperature: ≥10 K above ambient (288 K → min outlet 298 K)
- Fan power: 50-100 W
- Heat rejection: up to 20 kW

**Ports:** material_in, material_out, electrical_in (fan)
**Key parameter:** T_approach (minimum ΔT above ambient)
**Introduced:** M1 (improvised from ship radiator)

**Salvage narrative:** Kael drags radiator panels from the hangar exterior (ship's waste heat rejection system). Mounts a cabin ventilation fan behind them. Crude but effective — the same principle as a car radiator.

---

### 2. Flash Drum (Vertical Separator)

**Physical description:** Vertical pressure vessel with an inlet nozzle, a mist eliminator pad near the top, liquid collection at the bottom, and separate vapor and liquid outlet nozzles. Gravity does the work.

**What it does:** Separates a two-phase (vapor+liquid) stream into its phases. Vapor exits the top, liquid exits the bottom. No energy input required.

**S-Size specs:**
- Volume: 0.05 m³ (50 liters)
- Max pressure: 100 bar
- Temperature range: 80-600 K

**Ports:** material_in, vapor_out, liquid_out
**Key parameter:** None (passive — operates at inlet conditions)
**Introduced:** M1 (damaged pressure vessel repurposed)

**Salvage narrative:** A ruptured hydraulic accumulator from the hangar's cargo handling system. Kael welds the rupture, adds inlet/outlet nozzles, installs a wire mesh as mist eliminator.

---

### 3. Tank (Storage Vessel)

**Physical description:** Cylindrical pressure vessel, horizontal or vertical, with inlet and outlet nozzles. Instrumented with pressure and temperature gauges. May have level indicator for liquid service.

**What it does:** Accumulates and stores gas or liquid. Has inventory (moles, temperature, pressure) that changes over time as material flows in and out.

**S-Size specs:**
- Volume: 0.15 m³ (150 liters) default, adjustable 0.01–1.0 m³
- Max pressure: 200 bar
- Temperature range: 80-600 K

**Ports:** material_in, material_out
**Key parameter:** volume_m3
**Introduced:** M1 (storage containers from hangar)
**Cryo variant (M9):** Dewar tank — vacuum-insulated, lower T_LL (20 K), lower P_HH (10 bar, fragile)

---

### 4. Electrolyzer

**Physical description:** PEM (Proton Exchange Membrane) electrochemical cell stack. Rectangular module with water inlet, O₂ outlet, H₂ outlet, and DC power terminals. Hums when operating.

**What it does:** Splits water into hydrogen and oxygen using electricity. 2 H₂O → 2 H₂ + O₂. Fixed cell voltage (1.8V practical).

**S-Size specs:**
- Power draw: up to 1 kW
- Production: 5.18 mol/hr O₂ at 1 kW
- Cell voltage: 1.8 V (includes overpotentials)

**Ports:** liquid_in (H₂O), gas_out_1 (O₂), gas_out_2 (H₂), electrical_in
**Key parameter:** power (draw, up to rated max)
**Introduced:** M2 (life support spare from ship stores)

**Salvage narrative:** Found in the shelter's emergency stores locker — a standard spare for any ship with Sabatier CO₂ recycling. Still sealed in its shipping crate. Vasquez recognizes it immediately.

---

### 5. Mixer (Static Inline)

**Physical description:** A short pipe section with internal baffles or helical elements that force two incoming streams to blend. No moving parts, no power.

**What it does:** Combines two (or more) inlet streams into one outlet stream. Mixing is ideal — outlet composition is the molar average, outlet enthalpy is conserved.

**S-Size specs:**
- Max flow: 0.1 mol/s per inlet
- Pressure drop: negligible
- No energy input

**Ports:** material_in_1, material_in_2, material_out
**Key parameter:** None (passive)
**Introduced:** M3 (static mixer section from chemical processing line)

---

### 6. Reactor — Equilibrium (Fixed-Bed Catalytic)

**Physical description:** Vertical cylindrical vessel packed with catalyst pellets. Insulated or jacketed depending on mode. Gas flows through the bed, reacts on the catalyst surface, exits at the bottom.

**What it does:** Drives a reversible reaction toward equilibrium at the operating temperature and pressure. Conversion depends on thermodynamic equilibrium, not kinetics (assumed fast with catalyst).

**S-Size specs:**
- Volume: 0.05 m³ (50 liters) — a vessel ~30 cm diameter × 70 cm height
- Catalyst mass: ~40 kg
- Max temperature: 923 K (catalyst sintering limit)
- Max pressure: 150 bar
- GHSV: 10,000-50,000 hr⁻¹ depending on reaction

**Ports:** material_in, material_out, electrical_in (optional, for heated mode)
**Key parameters:** reactionId (which reaction), mode (adiabatic/insulated/heated), volume
**Introduced:** M3 — Sabatier configuration. Reused M7 — Haber configuration.

**Salvage narrative (M3):** Catalyst bed from the Calypso's own Sabatier CO₂ recycler. The housing is cracked but the catalyst is intact. Kael transfers the pellets to a salvaged pressure vessel.

---

### 7. Heat Exchanger (Brazed Plate)

**Physical description:** Compact stack of corrugated stainless steel plates brazed together. Two fluid paths interleave — hot fluid in one set of channels, cold fluid in the other. Very high surface area per volume.

**What it does:** Transfers heat between two fluid streams without mixing them. Counter-current flow achieves close approach temperatures. No moving parts, no power.

**S-Size specs:**
- Heat transfer area: 2 m²
- UA: 500 W/K (typical for plate HEX at this size)
- Max pressure: 100 bar per side
- Min approach: 5 K

**Ports:** hot_in, hot_out, cold_in, cold_out
**Key parameter:** UA (overall heat transfer coefficient × area), approach T
**Introduced:** M3 (from ship cooling loop)

---

### 8. Compressor (Diaphragm)

**Physical description:** Metal-diaphragm compressor driven by an electric motor. The diaphragm flexes to compress gas without contamination — no lubricant in the gas path. Compact, reliable, limited flow rate.

**What it does:** Raises the pressure of a gas stream. Consumes shaft work (from motor). Discharge temperature rises with pressure ratio (adiabatic heating).

**S-Size specs:**
- Max mass flow: 0.03 kg/s
- Max outlet pressure: 150 bar
- Max pressure ratio per stage: ~10
- Isentropic efficiency: 0.70-0.85
- Motor power: up to 5 kW

**Ports:** material_in, material_out, electrical_in
**Key parameters:** P_out (target pressure), eta (efficiency)
**Introduced:** M4 (from ship's H₂ handling system)

**Salvage narrative:** Diaphragm compressors are standard for hydrogen service (no contamination). The ship's cryogenic propellant system had several. Jin helps Kael extract one from the propulsion wreckage.

---

### 9. Gas Turbine (Micro Radial Expander)

**Physical description:** Compact radial-inflow turbine with a single-stage impeller. Gas enters radially, expands through the impeller, exits axially. Coupled to a generator (electrical output) or a shaft (mechanical output).

**What it does:** Expands hot, high-pressure gas to lower pressure. The expansion generates shaft work. Used as power turbine (M4, M8) or as turboexpander for cooling (M9).

**S-Size specs:**
- Max inlet temperature: 1023 K (material limit)
- Max inlet pressure: 20 bar
- Isentropic efficiency: 0.75-0.85
- Power output: up to 10 kW
- Mass flow: up to 0.1 kg/s

**Ports:** material_in, material_out, electrical_out (or mechanical_out)
**Key parameters:** eta (efficiency)
**Introduced:** M4 (APU from ship's emergency power system)

---

### 10. Reactor — Adiabatic (Combustion Chamber)

**Physical description:** Same vessel type as the equilibrium reactor, but configured for irreversible, exothermic reactions with no heat removal. Heavily insulated. Flame arrestor at inlet.

**What it does:** Burns fuel in air (or other oxidizer) at complete conversion. Outlet temperature is determined by the heat of combustion and inlet conditions. Used for the Brayton cycle combustor.

**S-Size specs:**
- Volume: 0.01 m³ (combustion is fast — small volume suffices)
- Max outlet temperature: 1200 K
- Max pressure: 20 bar

**Ports:** material_in (premixed fuel+air), material_out (combustion products)
**Key parameter:** reactionId (which combustion reaction)
**Introduced:** M4 (combustion chamber from ship propulsion)

---

### 11. Valve (Globe Control)

**Physical description:** Globe-type control valve with a positioner. Adjustable flow restriction. The simplest way to reduce pressure in a flowing stream.

**What it does:** Reduces pressure of a flowing stream (isenthalpic expansion). Temperature changes according to Joule-Thomson effect (usually drops for gases). Flow rate determined by upstream/downstream pressure and valve position.

**S-Size specs:**
- Cv range: adjustable
- Max inlet pressure: 200 bar
- No power required

**Ports:** material_in, material_out
**Key parameter:** P_out (downstream pressure target)
**Introduced:** M5 (fabricated from spare parts in workshop)

**Salvage narrative:** The first piece of equipment Kael builds rather than finds. Assembled from a gate valve body, a control spring from the cargo winch, and seals cut from emergency suit material. Vasquez guides the machining. Workshop milestone.

---

### 12. Splitter (Pipe Tee)

**Physical description:** A pipe tee — literally a T-junction in the piping. One inlet, two outlets. Split ratio is adjustable (by valve position on each outlet, abstracted as a single parameter).

**What it does:** Divides a single stream into two outlet streams with identical composition and conditions. Only the flow rate differs.

**S-Size specs:**
- No pressure drop (ideal)
- No power required

**Ports:** material_in, material_out_1, material_out_2
**Key parameter:** split_fraction (fraction to outlet 1, remainder to outlet 2)
**Introduced:** M7 (pipe tee from chemistry lab salvage)

---

### 13. Heater (Inline Electric)

**Physical description:** An electric resistance heating element inside a pipe section. Like an industrial immersion heater. Converts electricity directly to heat in the flowing stream.

**What it does:** Raises the temperature of a gas or liquid stream using electrical power. Simple, precise, controllable.

**S-Size specs:**
- Max power: 5 kW
- Max outlet temperature: 923 K (element material limit)
- Efficiency: ~98% (resistive losses minimal)

**Ports:** material_in, material_out, electrical_in
**Key parameter:** T_out (target temperature) or Q (heat duty)
**Introduced:** M7 (from ship's chemistry lab — used for preheating reactant streams)

---

### 14. Pump (Gear/Metering)

**Physical description:** Small positive-displacement gear pump or metering pump. Electric motor driven. For liquid service only.

**What it does:** Raises the pressure of a liquid stream. Consumes very little power because liquids are nearly incompressible (this is the teaching moment — pump work ≈ 0 compared to compressor work).

**S-Size specs:**
- Max flow: 0.01 kg/s
- Max outlet pressure: 20 bar
- Power: typically < 10 W
- Efficiency: 0.70-0.85

**Ports:** liquid_in, liquid_out, electrical_in
**Key parameter:** P_out (target pressure)
**Introduced:** M8 (from ship's propellant transfer system)

---

### Infrastructure Units (non-process)

**Battery:** Stores and releases electrical energy. Charge/discharge via electrical ports. Tracks state of charge. Pre-placed as depletable; additional batteries may be salvaged.

**Power Hub:** Distributes electrical power from sources (turbines, batteries) to consumers (compressors, heaters, electrolyzer). Manages load balancing. Already exists in codebase.

---

## 46. Depletable Supply Units

Covered in §40. Schema and behavior defined there. Five types: O₂ bottles, LiOH scrubber, water jerricans, MRE crate, battery bank.

---

## 47. Composite Units (M10)

Covered in §34-35. Greenhouse and Human are composite units with internal structure (mixer + reactor + separator) hidden behind clean external port interfaces.

The composites are registered in UnitRegistry like any other unit. Their tick() functions implement the internal sequence. The player sees ports and parameters, not internal structure — unless they choose to inspect deeply (M10 full transparency).

---

## 48. Equipment Limits & Alarm Integration

Every piece of equipment has physical limits that generate alarms when approached or exceeded.

### Three-Layer Limit Resolution

1. **Definition limits** (in UnitRegistry): physical maxima inherent to the equipment type. A diaphragm compressor cannot exceed 150 bar. A gas turbine inlet cannot exceed 1023 K.
2. **Mission limits** (in MissionDefinition.paramLocks): narrative restrictions. "This compressor is damaged — max 5 bar." Applied on top of definition limits.
3. **Player limits** (via inspector): the player's chosen setpoints, which must fall within the narrower of definition and mission limits.

### Alarm Generation

The existing AlarmSystem evaluates limits and generates standard alarms:

| Condition | Severity |
|-----------|----------|
| Parameter approaching limit (within 10%) | WARNING |
| Parameter at limit (clamped) | ERROR |
| Parameter would exceed limit (physically impossible) | CATASTROPHIC |

Process-specific alarms:
- Compressor discharge temperature too high → diaphragm damage risk
- Reactor temperature exceeding catalyst sintering limit → deactivation
- Tank pressure exceeding design pressure → rupture
- Flash drum with no liquid phase → poor separation
- Turbine inlet temperature exceeding material limit → blade damage

Alarm messages include Expert hooks — Vasquez comments on what went wrong and suggests causes.

---

## 49. Salvage Realism

Every piece of equipment in the game has a plausible origin on the ISV Calypso:

| Equipment | Ship system | Plausibility |
|-----------|-------------|-------------|
| Air cooler | Radiator panels (thermal control) | High — every spacecraft has radiators |
| Flash drum | Hydraulic accumulator (cargo) | High — repurposed pressure vessel |
| Tank | Storage containers (various) | High — ships carry many vessels |
| Electrolyzer | Life support spare (ECLSS) | High — standard Sabatier backup |
| Mixer | Chemical processing (ISRU module) | High — static mixers in any process line |
| Reactor (eq) | Sabatier CO₂ recycler (ECLSS) | High — catalyst bed from life support |
| HEX | Cooling loops (throughout) | High — plate HEX in every thermal system |
| Compressor | H₂ handling (propulsion) | High — diaphragm standard for H₂ |
| Gas turbine | APU (emergency power) | High — every ship has backup power |
| Reactor (adi) | Propulsion combustor | Medium — repurposed from thruster |
| Valve | Fabricated (workshop) | High — first player-built equipment |
| Splitter | Pipe fittings (throughout) | High — T-junctions everywhere |
| Heater | Lab equipment (chemistry lab) | High — standard lab heater |
| Pump | Propellant transfer | High — gear pumps in fuel lines |
| Dewar tanks | Cryogenic storage (propellant) | High — the ship ran on cryo fuel |
| Greenhouse module | Agricultural research pod | Medium-High — part of ISRU evaluation kit |

The Calypso was specifically a resource-survey vessel with an ISRU module. It's not implausible that it carried pilot-scale chemical process equipment — that was its mission.

---

## 50. Visual Reference Board

Each equipment type needs a 3D model for the primary game view. Models should convey:
- **Scale:** relative to a human figure (equipment is waist-to-head height)
- **Function:** visually distinguishable at a glance (vertical drum vs horizontal tank vs turbine)
- **Condition:** salvaged look — scratched paint, welded patches, improvised fittings
- **State:** visual indicators for operating status (spinning fan, glowing heater, frost on cryo, vapor plumes)

### Visual Signatures (for 3D modeling reference)

| Unit | Key visual feature | Animation when running |
|------|-------------------|----------------------|
| Air cooler | Bank of vertical fins with axial fan | Fan spins, shimmer behind fins (hot air) |
| Flash drum | Tall vertical cylinder, small diameter | Liquid level visible through sight glass |
| Tank | Horizontal/vertical cylinder, larger | Pressure gauge needle, level indicator |
| Electrolyzer | Rectangular box with cable connections | LED indicator, faint hum |
| Mixer | Short pipe section with flanges | None (passive) — flow arrows on pipe |
| Reactor (eq) | Vertical cylinder, insulation wrap | Temperature glow (orange when hot) |
| HEX | Compact rectangular block, 4 pipe stubs | Condensation/frost on cold side |
| Compressor | Box with motor, discharge pipe up | Motor hum, vibration, discharge vapor |
| Gas turbine | Cylindrical with exhaust cone | Exhaust shimmer, whine sound |
| Reactor (adi) | Similar to eq but with flame viewport | Flame glow visible through port |
| Valve | Handwheel on pipe section | Handwheel position indicates opening |
| Splitter | Pipe T-junction | Flow direction arrows |
| Heater | Pipe section with electrical box | Red/orange glow, heat shimmer |
| Pump | Small box with inlet/outlet pipes | Quiet hum (barely audible vs compressor) |

Photo references for 3D artists should be gathered from industrial equipment catalogs: Alfa Laval (plate HEX), Howden (diaphragm compressors), Capstone (micro turbines), Swagelok (valves and fittings), Parker Hannifin (small pumps). The aesthetic should be "industrial pilot plant, slightly beat up, adapted for alien planet use."
