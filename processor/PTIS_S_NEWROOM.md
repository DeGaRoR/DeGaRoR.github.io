## PTIS Spec — Room + Life Support Buffers (v1)

### Scope

* Add a **Room** unit plus linked **life-support buffer** units with their own `defId`s.
* Purpose:

  * lower onboarding friction
  * make survival legible
  * keep plant-side engineering visible
  * provide a clear urgency loop through reserves and room condition

---

## 1) Units

### Room

* Large special unit, primarily **UI + survival logic**
* Contains occupants and Lena UI area
* Does **not** hold main inventories in v1
* Computes demand, validates supply, shows condition, emits room exhaust for CO₂ loop

### Linked life-support buffer units

Each is its own `defId`, visually readable, with large counters/gauges:

* **O₂ Buffer**
* **H₂O Buffer**
* **Food Buffer**
* **CO₂ Removal / Air Support Buffer**
* Electricity: separate handling, not a core reserve buffer in v1

These buffers are:

* tied to the Room conceptually/gameplay-wise
* may be scenario-placed / auto-provided rather than freely placeable
* the main urgency carriers of the game through visible reserve time

---

## 2) Recommended display priority

For gauges / counters / warnings:

1. **O₂**
2. **H₂O**
3. **Food**
4. **CO₂ removal / air circulation**
5. **Electricity**

Reason:

* this matches intuitive survival urgency better than a pure process order

---

## 3) Fixed reference sizing assumptions

### Room geometry

* Fixed room volume: **62.5 m³**
* Reference geometry: **5 m × 5 m × 2.5 m**
* Comfortable for few people, **cramped at 10**
* Occupancy parameter:

  * `nPeople ∈ [0..10]`

### Thermal assumptions

* Indoor setpoint: **21 °C**
* External reference case used for sizing: **15 °C**
* Reference ΔT: **6 K**
* Lumped envelope:

  * `UA = 60 W/K`
* Reference envelope loss at 15 °C outside:

  * `Q_loss = 360 W`

### Occupant assumptions

Per person:

* O₂ consumption: **0.30 L/min**
* CO₂ production: **0.24 L/min**
* Sensible heat release: **75 W**
* Water need: **2.5 kg/day**
* Food proxy: **formaldehyde CH₂O**
* Food stoichiometry proxy:

  * `CH₂O + O₂ -> CO₂ + H₂O`

### Lighting / internal electric assumptions

* Reference room lighting max: **150 W**
* Time-of-day model may modulate this
* Small misc indoor load may be assumed: **~20 W** if needed

---

## 4) Reference consumption values

Let `N = nPeople`.

### Oxygen demand

* `n_O2 = 2.07e-4 * N mol/s`
* `m_O2 = 6.63e-6 * N kg/s`

Per person per day:

* **17.9 mol/day**
* **0.573 kg/day**

### Food demand (CH₂O proxy)

* `n_food = 2.07e-4 * N mol/s`
* `m_food = 6.21e-6 * N kg/s`

Per person per day:

* **17.9 mol/day**
* **0.537 kg/day**

### Water demand

Gross draw:

* `n_H2O = 1.61e-3 * N mol/s`
* `m_H2O = 2.89e-5 * N kg/s`

Per person per day:

* **138.9 mol/day**
* **2.50 kg/day**

### CO₂ generation

* `n_CO2 = 1.66e-4 * N mol/s`
* `m_CO2 = 7.29e-6 * N kg/s`

Per person per day:

* **14.3 mol/day**
* **0.630 kg/day**

### Reference circulation rate for CO₂ loop

For room CO₂ target around **1000 ppm** with perfect remover:

* `Q_circ = 0.004 * N m³/s`
* `Q_circ = 14.4 * N m³/h`
* `m_air_circ ≈ 4.8e-3 * N kg/s`

---

## 5) Electricity reference model

### Heating

Use:

* external temperature `T_ext(t)`
* time of day `t`

Room heat loss:

* `Q_loss(t) = UA * (21 - T_ext(t))`

Indoor heat gains:

* people: `75 * N W`
* lights: `P_light(t)`
* optional misc indoor loads

Recommended heater formulation:

* `P_heat(t) = max(Q_loss(t) - 75*N - P_light(t) - P_misc_indoor, 0)`

### Time-of-day lighting

Simple acceptable v1 model:

* low in daytime
* high in evening/night
* can be piecewise or smooth

Example smooth form:

* `P_light(t) = 10 + 140 * (1 - daylightFactor(t))`

### Air-loop electric load

Reference:

* `P_airloop ≈ 15 + 3.4 * N W`
* includes fan + simple scrubber parasitic allowance

### Total room electrical load

Recommended:

* `P_room_elec(t) = P_heat(t) + P_light(t) + P_airloop(N) + P_misc`

Electricity reserve is **not** internal to Room in v1.

---

## 6) Architecture

### Room responsibilities

* compute demand from `nPeople`, `T_ext(t)`, `timeOfDay`
* validate service sufficiency
* validate breathable return air
* emit standard room exhaust
* compute liveability / reserve urgency / warnings
* host Lena and occupant UI

### Buffer responsibilities

* accept plant supply
* hold simple inventory
* expose reserve counters / gauges
* deliver regulated demand to Room
* report deficit / empty state clearly
* no DP-driven behavior, no pressure gameplay in v1

---

## 7) Ports and connected units

### Room inputs

* **O₂ service in**
* **H₂O service in**
* **Food service in**
* **Clean air circulation in**
* **Electricity in**

### Room outputs

* **Room air circulation out**

### Room exhaust behavior

* emits standardized room air / exhaust composition
* fixed room-side temperature/pressure assumptions in v1
* composition reflects occupant load

### Clean air circulation inlet validation

Must not accept “CO₂-free nothing”.

Minimum checks:

* gas phase present
* nonzero total flow
* flow ≥ required circulation
* O₂ mole fraction above minimum breathable threshold
* CO₂ mole fraction below maximum allowed threshold

Recommended v1 thresholds:

* `y_O2 >= 0.18`
* `y_CO2 <= 0.005`
* stricter thresholds may be tuned later

---

## 8) Buffer units

### O₂ Buffer

* own `defId`
* stores/delivers oxygen service to Room
* shows:

  * inventory
  * current draw
  * autonomy time
  * shortage state
* highest urgency visual priority

### H₂O Buffer

* own `defId`
* stores/delivers potable water
* same UI pattern

### Food Buffer

* own `defId`
* stores/delivers CH₂O proxy
* same UI pattern

### CO₂ Removal / Air Support Buffer

* own `defId`
* represents breathable air return support
* role:

  * accepts cleaned air from scrubber path
  * validates breathable-air service quality
  * supplies Room circulation return
* visibly shows:

  * circulation rate
  * air quality OK / bad
  * insufficiency / blockage state

### Electricity

* handled via power network or external battery logic
* not a life-support reserve buffer inside Room in v1

---

## 9) UI requirements

### Room UI

Top:

* liveability state
* indoor condition
* reserve summary
* occupants / capacity

Middle:

* O₂ / H₂O / Food / CO₂ loop / Power status
* warnings and autonomy times

Bottom:

* occupant sprites
* one is Lena
* Lena speech bubble area
* advisory only when relevant

### Buffer UI

Large, obvious counters/gauges:

* inventory
* demand
* autonomy remaining
* state color
* shortage/critical alarms

These should read almost like survival HUD elements, not ordinary process vessels.

---

## 10) Failure / degraded states

Room should detect and expose:

* insufficient O₂ supply
* insufficient water supply
* insufficient food supply
* insufficient circulation flow
* invalid return air quality
* no electricity / insufficient electricity
* cold room if heating unmet

The Room does not need fancy internal dynamics in v1:

* just service sufficiency + clear state transitions

---

## 11) v1 non-goals

Do **not** include in v1:

* room pressure management
* humidity dynamics
* detailed toxic species handling
* internal room storage tanks
* generic DP madness for life-support buffers
* sophisticated thermal transients
* internal electricity reserve in Room

---

## 12) Design choice summary

* **Do not** make one monolithic god-unit
* **Do not** feed raw survival resources directly into the Room as ordinary plant streams only
* **Do** use:

  * one large **Room** unit
  * several **special linked buffer units**
  * visible reserve gameplay
  * visible CO₂ circulation loop
  * Room as UI / survival / narrative anchor

---

## 13) Minimal implementation-ready formulas

For `N` people:

* `O2_mol_s = 2.07e-4 * N`

* `O2_kg_s = 6.63e-6 * N`

* `H2O_mol_s = 1.61e-3 * N`

* `H2O_kg_s = 2.89e-5 * N`

* `Food_mol_s = 2.07e-4 * N`

* `Food_kg_s = 6.21e-6 * N`

* `CO2_mol_s = 1.66e-4 * N`

* `CO2_kg_s = 7.29e-6 * N`

* `Qcirc_m3_s = 0.004 * N`

* `Qcirc_kg_s ≈ 4.8e-3 * N`

* `Qloss_W = 60 * (21 - Text_C)`

* `Pheat_W = max(Qloss_W - 75*N - Plight_W - PmiscIndoor_W, 0)`

* `Pairloop_W = 15 + 3.4*N`

* `ProomElec_W = Pheat_W + Plight_W + Pairloop_W + Pmisc_W`

---

## 14) Final intended gameplay effect

* player keeps support buffers filled
* Room shows whether humans are safe and comfortable
* urgency is visible through **autonomy time**
* Lena gives contextual advice without intruding
* engineering remains in the plant, not hidden inside the Room
