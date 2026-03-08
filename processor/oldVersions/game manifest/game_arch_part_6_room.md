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
