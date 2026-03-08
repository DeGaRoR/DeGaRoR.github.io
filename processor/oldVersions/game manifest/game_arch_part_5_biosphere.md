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
