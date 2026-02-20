# PROCESS THIS IN SPACE — Parts V, VI, VII

---

# PART V — THE BIOSPHERE (M10 Deep Dive)

---

## 31. CH₂O as Food Proxy

The canonical biochemistry of life runs on glucose: C₆H₁₂O₆, which is (CH₂O)₆. The monomer unit CH₂O (formaldehyde) is the simplest carbohydrate proxy. Using it means every reaction in the biosphere is the real equation from a biology textbook.

**Photosynthesis:**
```
CO₂ + H₂O  →  CH₂O + O₂      ΔH = +519.4 kJ/mol
```

**Metabolism:**
```
CH₂O + O₂  →  CO₂ + H₂O      ΔH = −519.4 kJ/mol
```

These are exact reverses. Every atom balances. Every joule balances. The engine handles both with existing reactor types. No new chemistry framework needed.

### Why CH₂O and not CH₄

| Metric | CH₄ proxy | CH₂O proxy | Real human |
|--------|-----------|------------|------------|
| O₂ consumed (per 0.4 mol/hr CO₂) | 0.80 mol/hr | 0.40 mol/hr | 0.50 mol/hr |
| H₂O produced | 0.80 mol/hr | 0.40 mol/hr | 0.40 mol/hr |
| Heat | 99 W | 63 W | 100 W |

CH₂O matches H₂O production exactly and gets O₂ within 20%. Adjusting the food intake rate slightly upward (~0.46 mol/hr per person) hits 100 W metabolic heat and 0.46 mol/hr O₂ — close to the real 0.50.

### Calibration Strategy

Calibrate to CO₂ production (the most critical air-quality parameter). This gives exact CO₂, −13% O₂, +37% heat. These errors are acceptable for gameplay and pedagogy. The player learns the right stoichiometry, the right flow direction, and the right qualitative behavior. The decimals are off, but the physics is honest.

### Compound Registration

```
CH₂O (formaldehyde)
  CAS:     50-00-0
  MW:      30.026 g/mol
  Tb:      254.0 K (−19°C)
  Tc:      408.0 K
  Pc:      65.9 bar
  ΔHf°:   −115.9 kJ/mol (gas)
  S°:      218.8 J/mol·K
```

Standard gas-phase compound. Fits ComponentRegistry unchanged. NIST data available for Antoine coefficients and Cp(ig) polynomial.

CH₂O is a gas at 295 K (Tb = 254 K). On the pipe from greenhouse to human, "food" flows as vapor. Physically odd but thermodynamically consistent. The composite units abstract away this oddity at their boundaries — the player sees "food" flowing, not formaldehyde vapor.

---

## 32. The Two Reactions

The biosphere runs on one reaction and its reverse. Nothing else.

```
┌─────────────────────────────────────────────────────────────┐
│  PHOTOSYNTHESIS  (greenhouse reactor)                        │
│                                                              │
│  CO₂ + H₂O  →  CH₂O + O₂       ΔH = +519.4 kJ/mol         │
│                                                              │
│  Endothermic. Powered by electricity (grow lights).          │
│  Electrochemical reactor, same type as M2 electrolyzer.      │
│  All non-participating species (N₂, O₂, NH₃, Ar) pass       │
│  through unchanged.                                          │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  METABOLISM  (human reactor)                                 │
│                                                              │
│  CH₂O + O₂  →  CO₂ + H₂O       ΔH = −519.4 kJ/mol         │
│                                                              │
│  Exothermic. Complete conversion (fixed rate).               │
│  NH₃ in food stream passes through internally but is         │
│  diverted to liquid waste (kidney abstraction, §34).         │
└─────────────────────────────────────────────────────────────┘
```

The energy balance is perfect: the greenhouse absorbs 519.4 kJ/mol as light; the human releases 519.4 kJ/mol as body heat. The carbon cycles: atmosphere → plant → food → human → atmosphere. The oxygen cycles: plant produces it, human consumes it. The water cycles: plant consumes it, human produces it (respiration).

The player who looks at the numbers realizes: the biosphere is an energy-transfer system. Sunlight (or grow lights) powers the carbon cycle. Everything else conserves.

---

## 33. The Three Abstractions

The biosphere uses three operations inside composite units that don't correspond to standard thermodynamic unit operations. Each maps to a real biological process.

### Abstraction #1 — CH₂O Separation in Greenhouse

**What we model:** After the photosynthesis reactor, an internal separator pulls CH₂O (and NH₃) out of the mixed gas stream and routes it to the food output port.

**What it represents:** Photosynthesis produces solid glucose. Carbon leaves the gas phase and enters plant tissue. It never goes back into the air. A leaf is a gas-phase reactor with a solid product outlet.

**Thermodynamic honesty: HIGH.** The separation represents a real phase boundary. Biology produces a condensed-phase product from gas-phase reactants. The only simplification is mechanism, not outcome.

### Abstraction #2 — NH₃ Diversion in Human (the Kidney)

**What we model:** NH₃ enters the human in the food stream (gas phase). Inside the human unit, NH₃ is diverted from the gas exhaust to the liquid waste stream, mixed with drinking water.

**What it represents:** Humans ingest nitrogen as protein. The liver converts nitrogenous waste to urea. The kidneys dissolve urea in water and excrete it as urine. Almost zero nitrogen exits through the lungs.

**Why urea isn't modeled:** The actual biochemistry is: NH₃ → urea (liver) → dissolved in water → excreted → urea → NH₃ (hydrolysis). These are exact reverses. Net effect: zero. NH₃ → urea → NH₃. Since the round trip is thermodynamically neutral, skipping it and routing NH₃ directly to liquid waste is correct for mass and energy balance. We cannot model urea explicitly (solid at 295 K, requires aqueous-phase activity coefficients), but we don't need to — the round trip cancels.

**Thermodynamic honesty: HIGH.** Mass balance exact. Energy balance exact. Route (gas→liquid) biologically correct. Only the mechanism (kidney chemistry) is abstracted.

### Abstraction #3 — Wastewater Disposal (not Recycling)

**What we model:** Liquid wastewater (H₂O + NH₃) goes to a sink. No separation. No water recovery. Fresh water supplied continuously from the M1 vent condenser.

**What it represents:** On a planet with active geothermal vents producing abundant H₂O, recycling urine is unnecessary. Fresh water is plentiful. This is the opposite of the ISS approach because the resource context is different.

**Why not separate and recycle:** Dilute NH₃/H₂O at 1 atm has a bubble point around ~360 K. Nothing flashes at 295 K. Separating NH₃ from water at room temperature is not possible with a simple flash drum, and the Raoult model gives quantitatively wrong results for this strongly non-ideal system. Rather than introduce a thermodynamically dishonest separation, we accept the water loss.

**Thermodynamic honesty: HIGH (by avoidance).** We don't claim to separate something we can't separate with our engine. We use the planet's abundant resource instead. This is a real engineering decision, not a cheat.

### Hidden Achievement — Wastewater Recycle

A player who notices NH₃ leaving in the waste can attempt: Heater (→400 K) to boil the entire waste stream → vapor (H₂O + NH₃) → pipe to greenhouse inlet. The greenhouse consumes the H₂O (needs it for photosynthesis) and passes the NH₃ through to food. Nitrogen loop closes completely. Haber becomes startup-only.

This is thermodynamically valid with existing units (heater + mixer). The Raoult inaccuracy on NH₃+H₂O doesn't matter because there's no separation — everything boils together.

Achievement: **"CLOSED ECOSYSTEM — eliminated continuous Haber dependency."**

Counterintuitive, thermodynamically perfect, and exactly what real closed-loop life support research investigates.

---

## 34. Greenhouse — Full Specification

The greenhouse takes full room air, reacts away CO₂ and H₂O, separates food from clean air, and returns breathable air.

### External Ports

| Port | Type | Direction | Content |
|------|------|-----------|---------|
| room_air_in | MATERIAL | IN | Full room atmosphere (N₂+O₂+CO₂+H₂O+Ar) |
| nh3_in | MATERIAL | IN | NH₃ makeup from Haber (M7) |
| power_in | ELECTRICAL | IN | Grow light electricity |
| clean_air_out | MATERIAL | OUT | CO₂-depleted, O₂-enriched air |
| food_out | MATERIAL | OUT | CH₂O + NH₃ (biomass proxy) |

Five ports. No purge port. NH₃ exits the system through the human's liquid waste, not through the greenhouse air loop.

### Internal Structure

```
┌────────────────────────────────────────────────────────────┐
│                     GREENHOUSE UNIT                         │
│                                                             │
│  room_air_in ──→ MIXER ──→ REACTOR ──→ SEPARATOR           │
│  (N₂+O₂+CO₂+       ↑      CO₂+H₂O→     ↓       ↓        │
│   H₂O+Ar)           │      CH₂O+O₂     air     food       │
│                      │      all else   (clean)  (CH₂O      │
│                 NH₃ makeup  passes              + NH₃)      │
│                      IN     through                         │
│                                                      ⚡ IN  │
└────────────────────────────────────────────────────────────┘
```

### Internal tick() Sequence

1. Read room_air_in: {N₂, O₂, CO₂, H₂O, Ar, ...}
2. Mix NH₃ makeup (nh3_in) into room air stream
3. Run reaction: CO₂ + H₂O → CH₂O + O₂ (all non-participating species pass through)
4. Separate product: CH₂O + NH₃ → food_out; everything else → clean_air_out
5. Electrical consumption = reaction ΔH × moles converted / lighting efficiency

### Sizing (6 colonists)

| Parameter | Value | Unit |
|-----------|-------|------|
| CO₂ fixation rate | 5.68 | mol/hr |
| H₂O consumption | 5.68 | mol/hr |
| CH₂O production | 5.68 | mol/hr |
| O₂ production | 5.68 | mol/hr |
| Thermodynamic minimum power | 819 | W |
| Lighting efficiency η | 1.0% | (parameter, adjustable) |
| Electrical demand | 82 | kW |
| Waste heat (lighting) | 81.2 | kW |
| Air changes per hour | 0.69 | /hr (1420/2065 mol) |

### Lighting Efficiency Parameter

| η | Electrical demand | Corresponds to |
|---|-------------------|----------------|
| 0.3% | 273 kW | Conventional overhead LED |
| 0.5% | 164 kW | Optimized LED, proven operational |
| 1.0% | 82 kW | Best targeted close-canopy LED (NASA 2014) |
| 2.0% | 41 kW | Theoretical limit, not demonstrated |
| 100% | 819 W | Thermodynamic minimum (not physical) |

This parameter is a design lever. Setting η higher makes M10 easier (less power needed) but less realistic. Setting it lower makes M10 brutally hard but physically honest. Recommend 1.0% as default with the option for the player to improve it through optimization (better light positioning, spectral tuning) as a star criterion.

---

## 35. Human — Full Specification

The human eats, breathes, drinks, and excretes. Four material streams plus heat.

### External Ports

| Port | Type | Direction | Phase | Content |
|------|------|-----------|-------|---------|
| food_in | MATERIAL | IN | gas | CH₂O + NH₃ |
| air_in | MATERIAL | IN | gas | Room atmosphere |
| water_in | MATERIAL | IN | liquid | Drinking water |
| exhaust_out | MATERIAL | OUT | gas | CO₂ + H₂O vapor (clean — no NH₃) |
| waste_out | MATERIAL | OUT | liquid | H₂O + NH₃ ("urine") |
| heat_out | HEAT | OUT | — | Metabolic heat |

Six ports. The key design feature: NH₃ exits through waste_out (liquid), never through exhaust_out (gas). The room atmosphere never accumulates NH₃. This eliminates the need for a greenhouse purge and prevents inert accumulation in the air loop.

### Internal tick() Sequence

1. Mix food (CH₂O + NH₃) + breathing air (N₂ + O₂ + ...)
2. Reactor: CH₂O + O₂ → CO₂ + H₂O (complete conversion)
3. NH₃ DIVERSION (Abstraction #2): route NH₃ from gas to liquid stream
4. Mix NH₃ + drinking water → waste_out
5. Gas exhaust: CO₂ + H₂O + N₂ + residual O₂ → exhaust_out
6. Heat: colonist_count × metabolic_heat → heat_out

### Parameter: colonist_count

Default: 6. Range: 1-12. All rates scale linearly.

### Metabolic Rates (per person, calibrated)

| Parameter | Rate | Unit |
|-----------|------|------|
| CH₂O consumed | 0.95 | mol/hr |
| O₂ consumed | 0.95 | mol/hr |
| CO₂ produced | 0.95 | mol/hr |
| H₂O respiratory | 0.95 | mol/hr |
| H₂O perspiration | 0.56 | mol/hr |
| H₂O drinking | 4.63 | mol/hr |
| H₂O urine | 4.63 | mol/hr |
| NH₃ in food | 0.035 | mol/hr |
| NH₃ in urine | 0.035 | mol/hr |
| Heat | 137 | W |

For 6 colonists (multiply by 6):

| Parameter | Rate |
|-----------|------|
| CH₂O consumed | 5.68 mol/hr |
| O₂ consumed | 5.68 mol/hr |
| CO₂ produced | 5.68 mol/hr |
| H₂O drinking | 27.8 mol/hr |
| H₂O urine | 27.8 mol/hr |
| NH₃ in urine | 0.21 mol/hr |
| Heat | 820 W |

---

## 36. Closed Loop Balance

At steady state with 6 colonists, greenhouse matched to human demand:

### Gas Phase (Room ↔ Greenhouse ↔ Human)

```
                    CO₂: 5.68 mol/hr
Human  ──────────────────────────────────→  Room
       ←──────────────────────────────────        ↕  (well-mixed tank)
                    O₂:  enriched air             ↕
                                           Greenhouse
Room   ──────────────────────────────────→  Greenhouse
       ←──────────────────────────────────
                    clean air (CO₂↓, O₂↑)
```

CO₂ produced by humans = CO₂ consumed by greenhouse. **Exact balance.**
O₂ produced by greenhouse = O₂ consumed by humans. **Exact balance.**
H₂O produced by humans (respiratory) = H₂O consumed by greenhouse. **Exact balance.**

The gas-phase loop is perfectly closed. No external gas input or output needed.

### Liquid Phase

```
[M1 vent condenser] ──→ drinking water ──→ Human ──→ waste (H₂O + NH₃) ──→ [Sink]
                                                            ↑
[M7 Haber] ──→ NH₃ makeup ──→ Greenhouse ──→ food (CH₂O ──→ Human
                                              + NH₃)           │
                                                                └──→ urine NH₃ ──→ [Sink]
```

Liquid water is consumed (drinking) and discarded (urine). This is NOT recycled in the base design — the vent provides abundant fresh water.

NH₃ flows: Haber → greenhouse (mixed into food) → human (ingested) → urine → sink. This is a one-way flow requiring continuous Haber makeup at 0.21 mol/hr.

### External Dependencies at Steady State

| Resource | Rate | Source | Note |
|----------|------|--------|------|
| Drinking H₂O | 27.8 mol/hr (500 g/hr) | M1 vent condenser | Ample (condenser produces >60 mol/hr) |
| NH₃ makeup | 0.21 mol/hr (3.6 g/hr) | M7 Haber | One M7 batch (10 mol) = 48 hr supply |
| Electricity | ~84 kW | M8 combined cycle × several | The dominant constraint |
| Cooling | ~82 kW rejection | Air coolers to ambient | 7K ΔT, large surface area |

### What's Closed, What's Not

| Loop | Status | Notes |
|------|--------|-------|
| Carbon (CO₂ ↔ CH₂O) | **CLOSED** | Human exhales CO₂, plant fixes it |
| Oxygen (O₂) | **CLOSED** | Plant produces, human consumes |
| Gas-phase water | **CLOSED** | Human exhales, plant consumes |
| Liquid water | **OPEN** | Drinking → urine → sink. Vent replaces |
| Nitrogen | **OPEN** | Haber → food → urine → sink. Continuous makeup |
| Energy | **OPEN** | Grow lights powered externally. Heat rejected |

The hidden achievement (§33) closes the nitrogen and liquid water loops by boiling wastewater back to the greenhouse.

---

## 37. Failure Timescales

If the greenhouse stops operating (power loss, disconnection, damage), the room reverts to uncontrolled depletion:

| Event | Time after greenhouse failure (6 colonists) |
|-------|----------------------------------------------|
| CO₂ hits 0.5% (warning) | 1.8 hours |
| CO₂ hits 2.0% (critical) | 7.3 hours |
| CO₂ hits 5.0% (lethal) | 18.1 hours |
| O₂ hits 19% (warning) | 7.3 hours |
| O₂ hits 16% (critical) | 18.1 hours |
| Humidity hits 60% (comfort) | ~9.5 hours |

These timescales mean the player has hours, not minutes, to respond to a greenhouse failure. The M5 industrial air processor can serve as backup — it's still available in the equipment library. Redundancy and backup systems are a natural design evolution.

---

## 38. Hidden Achievement: Wastewater Recycle

The default design discards wastewater (H₂O + NH₃) to a sink and requires continuous Haber makeup and fresh vent water. A player who recognizes the opportunity can:

1. Route waste_out from the Human unit to a Heater (→400 K)
2. The entire waste stream boils (both H₂O and NH₃ vaporize)
3. Pipe the vapor to the Greenhouse's room_air_in or a mixer before it
4. The Greenhouse consumes the H₂O (needs it for photosynthesis)
5. NH₃ passes through to food_out → back to the Human

Result: nitrogen cycles indefinitely. Water recycles. Haber becomes startup-only (run once to charge the loop, then shut down). Drinking water from the vent is no longer needed.

This is thermodynamically valid with existing units. The Raoult inaccuracy on NH₃+H₂O doesn't matter because there's no separation — everything boils together and enters the greenhouse as mixed vapor.

Achievement unlocked: **"CLOSED ECOSYSTEM"**

---

# PART VI — THE ROOM (Survival System)

---

## 39. Room as Tank

The shelter is modeled as a pressurized, well-stirred tank. This is not a metaphor — it is physically accurate. A 50 m³ room with air circulation fans is a better-mixed vessel than most industrial stirred tanks. Species accumulate and deplete based on inlet and outlet flows. The ideal-gas, well-mixed assumption holds.

### Physical Parameters

| Parameter | Value |
|-----------|-------|
| Volume | 50 m³ |
| Initial pressure | 89,750 Pa (Planet X surface) |
| Initial temperature | 288 K (ambient — no heating yet) |
| Initial composition | Ship air: 78% N₂, 21% O₂, 1% Ar, 0.04% CO₂ |
| Total initial moles | PV/RT = 1,873 mol |

### Gas Inventory

| Species | Fraction | Moles |
|---------|----------|-------|
| N₂ | 78% | 1,461 |
| O₂ | 21% | 393 |
| Ar | 1% | 18.7 |
| CO₂ | 0.04% | 0.75 |

### The Room's Ports

The room has fixed connection points — physical ports that the player wires their processes to:

| Port | Type | Direction | Connected to (initial) | Replaced by |
|------|------|-----------|----------------------|-------------|
| o2_in | MATERIAL | IN | O₂ bottles (depletable) | M2 electrolyzer |
| water_in | MATERIAL | IN | Water jerricans (depletable) | M1 vent condenser |
| food_in | MATERIAL | IN | MRE crate (depletable) | M7/M8 greenhouse |
| air_out | MATERIAL | OUT | Exhaust vent (to outside) | M10 greenhouse air loop |
| air_in | MATERIAL | IN | — (none initially) | M5 clean air / M10 greenhouse return |
| elec_in | ELECTRICAL | IN | Battery bank (depletable) | M4 turbine |
| heat_in | HEAT | IN | — (body heat only) | M6 heat pump HEX |
| co2_scrub | SPECIAL | — | LiOH scrubber (depletable) | M5 air processor / M10 greenhouse |

### The Room's Internal Model

The room computes on every solver tick:
1. Sum all inlet flows (O₂ in, air in, etc.)
2. Sum all outlet flows (air out, CO₂ to scrubber, etc.)
3. Internal sources: Human unit exhales CO₂ + H₂O, consumes O₂ + food
4. Net accumulation: Δn = (inflows + internal production) − (outflows + internal consumption)
5. Update inventory: n[species] += Δn × dt
6. Update T, P from ideal gas law and energy balance

This model runs from Day 0. In early missions (M1-M5), the Human unit inside the room operates at fixed rates determined by population count. The player doesn't see the Human unit explicitly — they see the shelter dashboard with gauges.

---

## 40. Depletable Supplies

Five emergency supply units are pre-placed and connected to the room at game start. They are not buildable, not movable, not duplicatable. They can be inspected.

### O₂ Bottles

```
Type:       Depletable gas source
Inventory:  300 mol O₂ (4 × 75 mol pressurized bottles)
Output:     O₂ to room o2_in port
Draw rate:  Determined by room demand (24 mol/day for 2 people)
Lifetime:   12.5 days
Gauge:      "O₂ RESERVES: ███████░░░  72%  9.0 days"
```

### LiOH CO₂ Scrubber

```
Type:       Depletable CO₂ sink
Capacity:   268 mol CO₂ (20 cartridges × 13.4 mol each)
Input:      Room air (draws CO₂ selectively)
Max rate:   1.5 mol CO₂/hr (cartridge surface-area limited)
Lifetime:   13.4 days
Gauge:      "CO₂ SCRUBBER: 15/20 cartridges  10.1 days"
Note:       Black box — no chemistry modeled. Absorbs CO₂, ticks down.
```

### Water Jerricans

```
Type:       Depletable liquid source
Inventory:  2,222 mol H₂O (40 L in 4 × 10L cans)
Output:     H₂O to room water_in port
Draw rate:  166 mol/day for 2 people (3 L/day net)
Lifetime:   13.4 days
Gauge:      "WATER: ████████░░░  78%  10.4 days"
```

### MRE Crate

```
Type:       Depletable food source
Inventory:  200 MREs (each ~1,200 kcal, ~0.5 kg)
Output:     Food to room food_in port
Draw rate:  4 MREs/day for 2 people
Lifetime:   50 days
Gauge:      "FOOD: ████████████████  96%  48 days"
Note:       In M1-M9, food is modeled as a simple counter, not a species
            flow. At M10, when the Human composite appears, food becomes
            CH₂O flow from the greenhouse. The MRE counter transitions
            to a flow-based model.
```

### Battery Bank

```
Type:       Depletable electrical source
Capacity:   75 kWh (270 MJ)
Output:     Electricity to room elec_in port (and all connected equipment)
Discharge:  Variable — baseline 200W + process loads
Lifetime:   15.6 days at baseline, ~10 days with electrolyzer running
Gauge:      "POWER: ██████████░░░  64%  58.5 kWh  ~10 days"
```

### Schema

```
DepletableUnit {
  id            String
  defId         'depletable_source' | 'depletable_sink'
  resource      'O2' | 'CO2_scrub' | 'H2O' | 'food' | 'electrical'
  inventory     Number          Current remaining (mol, count, or J)
  capacity      Number          Starting maximum
  rate          Number          Current draw rate
  connectedTo   PortRef         Which room port it feeds
  depleted      Boolean         True when inventory ≤ 0
  gauge         { label, pct, remaining_time }
}
```

When a depletable is exhausted and no process replacement is connected: the room's corresponding gauge goes to zero, alarm triggers, and if the resource is critical (O₂, CO₂ scrubbing), the failure countdown begins.

---

## 41. Progressive Stream Substitution

This is the fundamental gameplay loop stated as a system design:

| Mission | Replaces | Room Port | Depletable → Sustainable |
|---------|----------|-----------|--------------------------|
| M1 | Water supply | water_in | Jerricans → vent condenser tank |
| M2 | O₂ supply | o2_in | Bottles → electrolyzer output |
| M4 | Power | elec_in | Battery → gas turbine |
| M5 | CO₂ removal | co2_scrub → air_out/air_in | LiOH cartridges → industrial air processor |
| M6 | Heating | heat_in | Body heat only → heat pump HEX |
| M7+M8 | Food | food_in | MRE crate → greenhouse |
| M10 | Air processing | air_out + air_in (loop) | M5 industrial → greenhouse biological |

When the player connects a process output to a room port that was previously fed by a depletable:
1. The depletable disconnects (or becomes backup)
2. The gauge switches from countdown to "SUPPLIED ✓"
3. Visual: port indicator LED goes from red to green
4. The depletable's remaining inventory becomes emergency backup

The room never changes its internal model. Only what's connected to its ports changes. The player who inspects the room in M1 and the player who inspects it in M10 see the same underlying tank — just with different things plugged in.

---

## 42. Sinks — Fixed Discharge Points

The colony has fixed-location waste discharge points in the 3D world. These are not buildable — they're features of the crash site.

### Gas Vent (Exhaust Nozzle)

A hole in the shelter wall, fitted with a one-way flap valve during the initial crash stabilization. Connects to the room's air_out port. Excess pressure and waste gas exit here.

In early missions: the room vents CO₂-laden air continuously (replaced by LiOH scrubbing internally, excess vented). After M5: the vent is less critical because air is being processed. After M10: the vent may be nearly unused if the biosphere loop is tight.

The vent also serves as the discharge point for any process waste gas (e.g., Ar purge from M7 Haber, CO₂ from M5 flash drum).

### Liquid Drain (Sump)

A low point in the hangar floor where liquid waste collects and drains to the subsurface. Wastewater from the Human unit (urine) and any process liquid waste exits here.

### Both sinks are:
- Pre-placed, fixed position in 3D
- Visible and inspectable
- Connectable via piping (player can route waste streams to them)
- Effectively infinite capacity (atmosphere is big, ground absorbs)

---

## 43. Inspector Layering

The room's inspector panel shows progressive detail as the player advances. The underlying simulation is always the full model — only the display changes.

### M1–M3: Simple Dashboard

```
┌─────────────────────────────────────┐
│  SHELTER STATUS                      │
│                                      │
│  O₂    ████████████░░░░  67%  12 d  │
│  H₂O   ██████████████░░  82%   9 d  │
│  CO₂   ████████░░░░░░░░  15/20       │
│  PWR    ██████████████░░  58 kWh     │
│  FOOD   █████████████████ 192 MREs   │
│  TEMP   17°C  (chilly but OK)        │
│                                      │
│  ● H₂O supply:  CONNECTED ✓         │
│  ● O₂ supply:   NOT CONNECTED       │
│  ● Air supply:   NOT CONNECTED       │
│  ● Power:        BATTERY (depleting) │
└─────────────────────────────────────┘
```

Big gauges, countdown timers, port status. No composition detail. No flow rates. The player sees what matters: am I running out, and what's connected.

### M4–M5: Power Budget + CO₂ Detail

Power consumption breakdown appears (baseline, electrolyzer, compressors). CO₂ scrubber detail shows cartridge-level depletion. The player starts seeing "why" behind the gauges.

### M6: Live Temperature

Temperature becomes a real number that responds to the heat pump output. The gauge shows actual T, not just "chilly." The thermal model (Q_loss, Q_pump, T_inside) becomes inspectable.

### M7–M8: Metabolic Flows

O₂ consumed, CO₂ produced, water consumed — per person and total. The food counter shows MRE depletion rate accounting for population. The player sees the Human-as-reactor model implicitly through flow rates.

### M10: Full Transparency

The room displays full composition dynamics: O₂%, CO₂%, H₂O%, N₂%, T, P. All internal flows visible. The Human and Greenhouse composites are explicit, inspectable units inside the room. The shelter dashboard becomes a process flow diagram. The player sees the biosphere as an engineer sees it — streams, balances, rates.

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
