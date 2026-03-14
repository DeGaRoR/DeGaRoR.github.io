# PTIS Spec — Room Unit Implementation
## v1 — March 2026

---

> **Scope.** One new defId (`room`), one profile (`shelter`).
> Replaces the earlier PTIS_S_NEWROOM.md for implementation details.
> The room is a validated multi-species sink with atmospheric tracking,
> simplified inline metabolism, thermal dynamics, and exhaust output.
> Animated SVG characters (Lena, Kael) are specified as a foundation
> but implemented in a follow-up visual session.

---

## 1. Canonical Rates

All rates derived from R_METABOLISM stoichiometry (CH₂O + O₂ → CO₂ + H₂O,
ΔH = −519.4 kJ/mol) and NASA HIDH physiological data.

**The NEWROOM spec rates (2.07e-4) are SUPERSEDED.** The stoichiometric
rates below (2.33e-4) are canonical — they close the mass balance and
match the human composite model, the ineluctable scene, and R_METABOLISM.

### Per person per second

| Quantity | mol/s | kg/s | mol/day | kg/day |
|----------|-------|------|---------|--------|
| O₂ consumed | 2.33e-4 | 7.46e-6 | 20.1 | 0.644 |
| CO₂ produced | 2.33e-4 | 1.03e-5 | 20.1 | 0.886 |
| CH₂O consumed (food) | 2.33e-4 | 7.00e-6 | 20.1 | 0.606 |
| H₂O produced (metabolic) | 2.33e-4 | 4.20e-6 | 20.1 | 0.362 |
| H₂O consumed (drinking + hygiene) | 1.61e-3 | 2.89e-5 | 138.9 | 2.50 |
| H₂O net consumed (drink − metabolic) | 1.38e-3 | 2.47e-5 | 118.8 | 2.14 |
| Metabolic heat | 121 W | — | — | — |
| NH₃ produced (trace) | negligible | — | — | — |

**Derivation:** 0.84 mol/hr ÷ 3600 = 2.333e-4 mol/s.
Cross-check: 2.333e-4 mol/s × 519400 J/mol = 121.2 W ✓

### Room-level (N people)

| Quantity | Formula |
|----------|---------|
| O₂ demand | `2.33e-4 × N` mol/s |
| Food demand | `2.33e-4 × N` mol/s |
| H₂O demand (net) | `1.38e-3 × N` mol/s |
| CO₂ production | `2.33e-4 × N` mol/s |
| Metabolic heat | `121 × N` W |
| Air circulation | `0.004 × N` m³/s (≈ `0.168 × N` mol/s) |

---

## 2. Thermal Model

### Room thermal properties

| Property | Value | Note |
|----------|-------|------|
| Volume | 62.5 m³ | 5×5×2.5 m |
| Air inventory | ~2560 mol at 294K | PV/RT |
| Air thermal mass | ~74 kJ/K | n × Cp_air |
| Structure thermal mass | ~426 kJ/K | Walls, floor, furniture |
| **Total thermal mass C** | **500 kJ/K** | Lumped |
| Envelope UA | 60 W/K | To planet exterior |
| T setpoint | 294 K (21°C) | Comfort target |

### Heat balance (per timestep)

```
Q_in  = Q_metabolic + Q_lighting + Q_streams + Q_hot_water + Q_electric_heater
Q_out = Q_envelope + Q_circ_cooler

dT = (Q_in − Q_out) × dt / C_thermal
T_room += dT
```

### Circulation cooler (on CO₂ scrubber loop)

The air duct that carries room air to the CO₂ scrubber passes through
the hull. A thermostatically controlled damper opens above the comfort
setpoint, exposing the duct to outside air as a passive radiator.

```
Q_circ_cooler = (T_room > 294 && circ_flowing)
  ? UA_circ × (T_room − T_ext)    // UA_circ = 25 W/K
  : 0
```

| Property | Value |
|----------|-------|
| UA_circ | 25 W/K |
| Activation | T_room > 294K AND air_return connected with flow |
| Power draw | 0 (passive radiator, no fan — uses circulation loop fan) |
| Damper | Closed below 294K → no extra heating demand |

When active, effective total UA = 60 (envelope) + 25 (circ) = **85 W/K**.
This self-regulates moderate overheating without player intervention.

### Envelope loss (always active)

```
Q_envelope = UA_env × (T_room − T_ext)    // UA_env = 60 W/K, always
```

### Stream enthalpy contribution

Every material stream entering the room carries enthalpy. If a stream
arrives above room temperature, it heats the room. Below, it cools.

```
Q_stream = Σ (ṅ_species × Cp_species × (T_stream − T_room))
```

This is computed per-port for all material inputs. The room absorbs
the enthalpy difference — the stream is "thermalized" to room T.

### Why hot feeds don't instantly kill

With C = 500 kJ/K and the circulation cooler, even significant heat
inputs are self-correcting:

| Scenario (2 ppl) | Without cooler | With cooler |
|-------------------|---------------|-------------|
| 600W hot feed, night (273K) | Still needs 268W heating | Still needs 268W heating |
| 600W hot feed, mean (278K) | +0.4 K/hr (WARNING in 15h) | **Pulls back below 294K** ✓ |
| 600W hot feed, day (283K) | +1.4 K/hr | +0.4 K/hr (WARNING in 15h) |

The cooler absorbs moderate thermal upsets automatically. Only
sustained large heat loads (10 people + hot feeds on a warm day)
overwhelm it — and those develop over hours, not minutes.

### Thermal scenarios at Planet X 278K (recommended)

| Scenario | T_ext | Q_passive | Heating needed | Overheats? |
|----------|-------|-----------|---------------|------------|
| 2 ppl, night | 273K | 392W | **868W** | No |
| 2 ppl, day | 283K | 392W | **268W** | No |
| 2 ppl + 600W hot feed, night | 273K | 992W | 268W | No |
| 2 ppl + 600W hot feed, day | 283K | 992W | — | +0.4 K/hr (mild) |
| 5 ppl, night | 273K | 755W | 505W | No |
| 5 ppl, day | 283K | 755W | — | Cooler pulls back ✓ |
| 10 ppl, night | 273K | 1360W | — | Cooler pulls back ✓ |
| 10 ppl, day | 283K | 1360W | — | **+3.1 K/hr** (real problem) |

**Gameplay arc:**
- Early (2 ppl): always needs heating. Battery + hot water puzzle.
- Mid (5 ppl): balanced. Heating only at night.
- Late (10 ppl): **overheating** becomes the problem. Need active cooling.

### RECOMMENDATION: Reduce Planet X T to 278K mean

Change `planet_x` preset `T_K: 288.15` → `278.15` (5°C mean, sub-Arctic).
Diurnal swing ±5K → 273K night, 283K day.

This ensures heating is a real early-game concern, hot water is
emotionally and mechanically meaningful, and the thermal puzzle
evolves naturally with crew size. The 9% CO₂ remains the real danger
— the cold is just uncomfortable.

---

## 3. Hot Water Input — The Shower/Radiator Port

### Rationale

Denis identified this as emotionally resonant: the crew can afford
a shower, and the warm water doubles as space heating. It connects
the player's heat management (cooling process outputs) with the
crew's comfort. The water that cools your reactor also warms your crew.

### Mechanism

Port: `hot_water_in` (MATERIAL, IN). Expects liquid H₂O.

The room computes heat extracted:
```
Q_hw = ṅ_hw × Cp_water × max(0, T_water − T_room)
```

If T_water > T_room: water heats the room (radiator mode).
If T_water ≤ T_room: zero thermal contribution (cold wash).

**Critically:** Q_hw directly reduces P_heat_electric. Every watt
of hot water heating is a watt the electric heater doesn't draw.
Early game with battery power at ~900W total demand, 400W of hot
water heating cuts electric demand nearly in half — potentially
doubling battery life.

The water is consumed (enters waste stream, not recirculated from room).
It contributes to the H₂O supply: both `h2o_in` and `hot_water_in`
count toward hydration demand. But only `hot_water_in` contributes
to heating.

Port: `waste_water_out` (MATERIAL, OUT). Emits used water at room T.
Composition: H₂O + trace contaminants. This is the grey water loop —
player can route it back to a water treatment process.

### Inspector display

```
Hot water: 0.05 mol/s at 340K → 400W heating
           Saves 400W electric (868W need → 468W heater)
```

Without hot water connected:
```
Hot water: — (not connected)
           Full electric heating: 868W
```

---

## 4. Ports

| Port | Dir | Type | Label | Purpose |
|------|-----|------|-------|---------|
| `o2_in` | IN | MATERIAL | O₂ | Oxygen supply (expects O₂-rich gas) |
| `food_in` | IN | MATERIAL | food | Food supply (expects CH₂O) |
| `h2o_in` | IN | MATERIAL | water | Drinking water (expects H₂O liquid) |
| `hot_water_in` | IN | MATERIAL | hot H₂O | Shower/radiator (expects warm H₂O) |
| `air_return` | IN | MATERIAL | clean air | Scrubbed air return (validated) |
| `elec_in` | IN | ELECTRICAL | power | Heating + lighting + airloop |
| `air_exhaust` | OUT | MATERIAL | exhaust | Room air (CO₂-enriched, warm) |
| `waste_water_out` | OUT | MATERIAL | grey water | Used wash water at room T |

**8 ports total.** Large unit (6×4 tiles suggested).

---

## 5. Tick Logic

### 5.1 Read inputs

For each material input port, read the stream. If unconnected or
zero-flow, that service is absent. No rejection — everything that
arrives is accepted.

### 5.2 Validate services

Each service has a validation check. Results stored in `u.last.services`:

| Service | Check | WARNING | MAJOR | CATASTROPHIC |
|---------|-------|---------|-------|--------------|
| O₂ supply | O₂ mol fraction in `o2_in` | supply < demand | supply < 50% demand | 0 supply for > 1 hr |
| O₂ purity | non-O₂ species in `o2_in` | < 95% O₂ | < 90% O₂ | CO > 100 ppm |
| Food | CH₂O flow on `food_in` | supply < demand | supply < 50% demand | 0 for > 24 hr |
| Water | H₂O flow on `h2o_in` + `hot_water_in` | supply < demand | supply < 50% | 0 for > 6 hr |
| Air return | flow + composition on `air_return` | flow < circ demand | O₂ < 18% or CO₂ > 0.5% | O₂ < 14% or CO₂ > 5% |
| Power | `hubAllocated_W` ≥ demand | < 100% | < 50% | 0 |
| Temperature | T_room | < 288K or > 300K | < 283K or > 305K | < 273K or > 313K |

### 5.3 Compute metabolism (simplified, inline)

No reactor framework. Direct stoichiometry per timestep:

```javascript
const N = par.nPeople || 2;
const o2_demand = 2.33e-4 * N;    // mol/s
const food_demand = 2.33e-4 * N;  // mol/s
const h2o_demand = 1.38e-3 * N;   // mol/s (net: drinking − metabolic production)
const circ_demand = 0.168 * N;    // mol/s air circulation

// Actual consumption: min(demand, supply)
const o2_consumed = Math.min(o2_demand, o2_supply);
const food_consumed = Math.min(food_demand, food_supply);
const co2_produced = o2_consumed;  // 1:1 stoichiometry
const h2o_produced = o2_consumed;  // 1:1 stoichiometry (metabolic water)
const Q_metabolic = o2_consumed * 519400;  // W (enthalpy of combustion)
```

### 5.4 Update room atmosphere

The room tracks its internal atmosphere as a molar inventory
(like a tank's `inventory.n`). Updated each timestep:

```
Room O₂:  += o2_supply × dt − o2_consumed × dt
Room CO₂: += co2_produced × dt − co2_removed_by_scrubber × dt
Room N₂:  += n2_from_air_return × dt − n2_in_exhaust × dt
Room H₂O: += h2o_produced × dt  (vapor, from breathing)
```

Where `co2_removed_by_scrubber` is tracked by the air_return stream
quality: if the return air has low CO₂, the scrubber is working.
The room doesn't model the scrubber — it just reads the return air
composition and computes the net effect on its inventory.

**Total room moles stay ~constant** (sealed volume, small
in/out flows relative to 2560 mol inventory). Fractions shift slowly.

### 5.5 Compute temperature

```javascript
// Circulation cooler: passive radiator on CO₂ scrubber duct
const circ_flowing = air_return_rate > 1e-6;
const Q_circ_cool = (T_room > 294 && circ_flowing)
  ? 25 * (T_room - T_ext) : 0;   // UA_circ = 25 W/K

// Electric heater delivers P_heat_electric (curtailed if low power)
const Q_heater_actual = (power_supply >= u.powerDemand) ? P_heat_electric
  : P_heat_electric * (power_supply / u.powerDemand);  // proportional curtailment

const Q_in = Q_metabolic + Q_lighting + Q_streams + Q_hw + Q_heater_actual;
const Q_out = 60 * (T_room - T_ext) + Q_circ_cool;  // envelope + circ cooler
const dT = (Q_in - Q_out) * dt / 500000;  // C = 500 kJ/K
T_room = Math.max(200, Math.min(400, T_room + dT));  // physical clamps
```

Where:
- `Q_streams` = sum of (ṅ × Cp × (T_stream − T_room)) for all material inputs
  except hot_water_in (tracked separately as Q_hw)
- `Q_lighting = 10 + 140 × (1 − solarFactor)` (from diurnal)
- `Q_heater_actual` = electric heating, reduced if power is curtailed
- `Q_circ_cool` = circulation cooler, only above 294K with active air loop

**Key couplings:**
- Power loss → heater curtailed → room cools (urgency to restore power)
- Air loop disconnected → circ cooler inactive → overheating harder to self-correct
- Hot water connected → reduces P_heat_electric → extends battery life
- More people → more metabolic heat → eventually overheating (late game)

### 5.6 Compute power demand

Electric heating is the primary fallback. Hot water reduces electric
demand but never increases it. The circulation cooler draws no extra
power (passive radiator, uses existing airloop fan).

```javascript
// Total heating need (regardless of source)
// NOTE: only computed when T_room < setpoint (heater off above 294K)
const Q_loss = 60 * Math.max(0, 294 - T_ext);  // envelope only, no circ cooler
const Q_passive = 121 * N + Q_lighting + Q_streams;  // includes hot streams
const P_heat_total = Math.max(0, Q_loss - Q_passive);

// Hot water offsets electric heating
const Q_hw = hot_water_connected
  ? hot_water_flow * Cp_water * Math.max(0, T_water - T_room) : 0;
const P_heat_electric = Math.max(0, P_heat_total - Q_hw);

// Total electrical demand
const P_airloop = 15 + 3.4 * N;
const P_misc = 20;
u.powerDemand = P_heat_electric + Q_lighting + P_airloop + P_misc;
```

**Note on circ cooler vs heating:** The circ cooler's damper is closed
when T_room < 294K. Therefore it does NOT increase the heating demand.
The heater only sees envelope loss (UA_env = 60 W/K), not the combined
UA. When T_room rises above 294K, the heater turns off and the cooler
turns on — they never compete.

**Inspector shows the breakdown:**
```
── Power Demand ──
Electric heater:   468 W  (868W need − 400W hot water)
Lighting:          148 W
Air loop:           22 W  (2 people)
Misc:               20 W
Total demand:      658 W
Hot water offset:  400 W  ← savings from process heat!
```

### 5.7 Emit exhaust

```javascript
// Exhaust = room atmosphere sample at current room composition
// Flow rate = air_return rate + O₂ supply rate − consumed rates
// (mass balance: room volume stays constant)
const exhaust_rate = air_return_rate + o2_supply - o2_consumed + co2_produced;
// Composition = current room atmosphere fractions
ports.air_exhaust = {
  type: StreamType.MATERIAL,
  T: T_room,
  P: P_atm,
  n: { O2: room_x_O2 * exhaust_rate, CO2: room_x_CO2 * exhaust_rate, ... },
  phaseConstraint: 'V'
};
```

### 5.8 Emit waste water

All water from `hot_water_in` exits at room T:

```javascript
ports.waste_water_out = {
  type: StreamType.MATERIAL,
  T: T_room, P: P_atm,
  n: { H2O: hot_water_flow },
  phase: 'L', phaseConstraint: 'L'
};
```

### 5.9 Compute diagnostics

`u.last` contains the full room state for inspector and gauges:

```javascript
u.last = {
  // People
  nPeople: N,

  // Atmosphere
  T_room_K: T_room,
  T_ext_K: T_ext,
  room_x_O2, room_x_CO2, room_x_N2, room_x_H2O,
  room_n_total,

  // Per-service status
  services: {
    o2:    { demand, supply, pct, status, autonomy_hr },
    food:  { demand, supply, pct, status, autonomy_hr },
    water: { demand, supply, pct, status, autonomy_hr },
    air:   { demand, supply, pct, status, quality },
    power: { demand, supply, pct, status },
    temp:  { current: T_room, target: 294, status },
  },

  // Thermal
  Q_metabolic, Q_lighting, Q_streams, Q_hot_water, Q_loss,
  Q_balance: Q_in - Q_out,
  heating_status,  // 'OK' | 'cold' | 'hot'

  // Gauges (direct values for icon rendering)
  gauges: {
    o2_pct: room_x_O2 * 100,
    co2_pct: room_x_CO2 * 100,
    temp_K: T_room,
    water_days: water_autonomy,
    food_days: food_autonomy,
    power_pct: power_supply / power_demand * 100,
  },

  // Liveability score (0-100)
  liveability: computeLiveability(services),

  // Animation state for SVG characters
  animState: {
    lena: { expression: 'calm', pose: 'standing' },
    kael: { position: 'center', action: 'idle' },
    gaugeColors: { o2: 'green', co2: 'green', ... },
  },

  type: 'room'
};
```

---

## 6. Gauge Thresholds (from Mission Design V2 §16)

| Gauge | Green | Amber | Red | Flashing |
|-------|-------|-------|-----|----------|
| O₂ | 19–23% | 17–19% | <17% | <14% |
| CO₂ | <0.5% | 0.5–2% | 2–5% | >5% |
| Temperature | 288–300K | 283–288K or 300–305K | <283K or >305K | <273K or >313K |
| Water | >7 days | 3–7 days | 1–3 days | <1 day |
| Food | >7 days | 3–7 days | 1–3 days | <1 day |
| Power | supply ≥ demand | 80–100% | 50–80% | <50% |

**Autonomy computation:**
```
autonomy_hr = upstream_buffer_inventory / demand_rate / 3600
```

The room reads inventory from connected upstream tanks via their
`u.last.totalMol` and `u.last.n` fields. It doesn't reach into their
internal state — it uses the diagnostics they already publish. This
keeps the room decoupled from buffer implementation details.

Wait — that requires the room to know which upstream unit is the
buffer. Simpler: the room computes autonomy from the flow rate.
If supply > demand, autonomy = ∞. If supply < demand, the deficit
depletes whatever buffer exists upstream at the measured rate.
The room reports "supply: 80% of demand" and the buffer reports
its own "time to empty." Both are visible in the inspector. The
player combines them mentally. This is cleaner.

**Revised:** The room reports supply vs demand ratios and status
per service. Buffer tanks report their own autonomy. The room does
NOT attempt to read upstream tank inventories.

---

## 7. Inspector Layout

### Conditions section
```
T room:     294.2 K (21.1°C)
T outside:  283.5 K (10.4°C)
People:     3
Liveability: 87%
```

### Reference rates section (per Denis's request)
```
── Reference Rates (2 people, T_ext=273K) ──
O₂ demand:     4.66e-4 mol/s  (2.33e-4 × 2)
Food demand:   4.66e-4 mol/s  (2.33e-4 × 2)
H₂O demand:   2.76e-3 mol/s  (1.38e-3 × 2)
Air circ:      0.336 mol/s    (0.168 × 2)
Heating need:  868 W          (UA × ΔT − passive gains)
  Hot water:  -400 W          (offset from process heat!)
  Electric:    468 W          (fallback for remainder)
Power demand:  658 W          (heater + light + air + misc)
Metabolic:     242 W          (121 × 2)
```

### Service status section (KPIs with bars)
```
O₂ supply:    ████████░░  82%    ⚠ WARN
Food supply:  ██████████  100%   ✓ OK
Water supply: █████░░░░░  48%    ⚠ WARN
Air quality:  ██████████  OK     ✓ OK
Power:        ████████░░  78%    ⚠ WARN
Temperature:  ██████████  294K   ✓ OK
```

### Thermal section (detail)
```
── Heat Balance ──
Envelope loss: -868 W (out)     UA_env × (294−273)
Circ cooler:      0 W (off)     T_room ≤ setpoint
Metabolic:      242 W (in)      121 × 2 people
Lighting:       148 W (in)
Hot water:      400 W (in)      0.05 mol/s at 340K
Streams:         12 W (in)
Elec heater:    468 W (in)      ← fallback for gap
Net balance:    +2 W            → stable
```

When overheating (e.g. 10 people, daytime):
```
── Heat Balance ──
Envelope loss: -660 W (out)     UA_env × (300−283)
Circ cooler:   -425 W (out)     UA_circ × (300−283) ← active!
Metabolic:     1210 W (in)      121 × 10 people
Lighting:        10 W (in)
Elec heater:      0 W           ← off (T > setpoint)
Net balance:   +135 W           → warming slowly (+1.0 K/hr)
```

---

## 8. Inventory & InitInventory

The room tracks atmospheric inventory:

```javascript
initInventory(par) {
  const atm = SimSettings.getAtmosphere();
  const V = 62.5;  // m³, fixed
  const T = 294;   // K, initial room temperature
  const P = atm.P_Pa;
  const n_total = P * V / (8.314 * T);

  // Start with planet atmosphere composition
  const wetAir = SimSettings.getWetAir();
  const n = {};
  for (const [sp, frac] of Object.entries(wetAir)) {
    n[sp] = frac * n_total;
  }

  return { n, T_K: T };
}
```

### updateInventory

```javascript
updateInventory(inventory, resolvedPorts, dt) {
  // Update atmospheric composition from port flows
  // Add: o2_in, food metabolic products, air_return species
  // Remove: air_exhaust species, o2 consumed, food consumed
  // Thermal: update T_K from heat balance
  // (Actual implementation inline — same pattern as open_tank)
}
```

---

## 9. O₂ Bottle Sizing Note

A T1 Gas Bottle (10L, 300 bar) holds ~125 mol O₂.
For 2 people: 4.66e-4 mol/s → 40.3 mol/day → **3.1 days**.

Mission Design V2 §Day-0 specifies 500 mol O₂ (~13 days for 2 people).
This requires either:
- **4× T1 Gas Bottles** (4 × 125 = 500 mol)
- **1× T2 Gas Tank (50L) at 250 bar** (requires custom P_init, exceeds
  default P_HH of 50 bar — needs a dedicated "O₂ reserve" profile)
- **Mission pre-places a correctly-sized tank** with `P_init: 25000000`
  and the right initialComposition

**Recommendation:** The mission system pre-places an "Emergency O₂
Reserve" unit (simple_tank with custom params, locked by mission).
The player's job is to refill it, not to size it. Same for water
jerricans, MRE crate, LiOH scrubber. These are scenario furniture.

### Battery impact at 278K

Day-0 battery bank: 75 kWh (Mission Design V2). At 278K night:
- Without hot water: P_room ≈ 868 + 150 + 22 + 20 = 1060W
- Battery runway: 75000 / 1060 = **70.8 hr ≈ 3.0 days** (night only)
- Average over day/night cycle: ~700W → **107 hr ≈ 4.5 days**

This is tighter than the 288K scenario (~8 days at 400W). The player
feels the cold immediately through battery drain. Hot water connection
drops average to ~400W → battery lasts ~7.8 days. Meaningful savings.

---

## 10. Character Animation Foundation

The room icon is a multi-layer SVG with named groups for future animation:

### Layer structure
```
<g class="rt-room">
  <g class="rt-room-structure">    — walls, door, gauges, window
  <g class="rt-room-gauges">       — O₂/CO₂/T/H₂O/Food bars (driven by u.last.gauges)
  <g class="rt-room-lena">         — Lena character
    <g class="lena-body">          — torso, arms, legs (pose transforms)
    <g class="lena-head">          — head shape
    <g class="lena-face">          — eyes, mouth, brow (expression sub-groups)
    <g class="lena-hair">          — hair (static in v1)
  <g class="rt-room-kael">         — Kael character
    <g class="kael-body">          — body (position transforms)
    <g class="kael-head">
    <g class="kael-face">          — expression sub-groups
  <g class="rt-room-effects">      — breath vapor, cold shivers, alarm glow
```

### Animation state → visual mapping

| `animState` field | Visual effect |
|---|---|
| `lena.expression: 'calm'` | Neutral face, slight smile |
| `lena.expression: 'worried'` | Furrowed brow, tense mouth |
| `lena.expression: 'distressed'` | Wide eyes, open mouth |
| `lena.expression: 'critical'` | Closed eyes, collapsed posture |
| `kael.position: 'center'` | Standing center of room |
| `kael.position: 'gauges'` | At gauge panel, checking readings |
| `kael.action: 'idle'` | Subtle breathing animation |
| `kael.action: 'working'` | Arm movement, tool in hand |
| `gaugeColors.o2: 'green'` | O₂ bar fill green |
| `gaugeColors.o2: 'amber'` | O₂ bar fill amber + pulse |
| `gaugeColors.o2: 'red'` | O₂ bar fill red + fast pulse |

### Expression driver (computed in tick)

```javascript
const worstAutonomy = Math.min(o2_hr, food_hr, water_hr, ...);
const expression =
  worstAutonomy > 48 ? 'calm' :
  worstAutonomy > 12 ? 'worried' :
  worstAutonomy > 2  ? 'distressed' : 'critical';

// Kael's position driven by what needs attention
const worstService = getWorstService(services);
const kael_action =
  worstService === null ? 'idle' :
  worstService === 'temp' ? 'at_radiator' :
  worstService === 'power' ? 'at_panel' : 'checking_gauges';
```

### v1 scope

The icon renders structure + gauge bars. Lena and Kael are static
placeholder figures (standing, neutral expression). The `animState`
is computed and stored in `u.last` but only the gauges are visually
driven in v1. Character animation is a follow-up session.

---

## 11. What the Room is NOT

- NOT a reactor (no solver iteration, no reaction framework)
- NOT a pressure anchor (not in resolveDownstreamPressures)
- NOT a Cv-driven flow unit (accepts whatever flows in)
- NOT modeled for humidity dynamics (v1)
- NOT modeled for room pressure (v1, open vent assumed)
- NOT holding buffer inventories (buffers are separate tanks)
- NOT aware of upstream unit types (reads streams, not defIds)

---

## 12. Mass Balance Closure

The room must close mass balance to satisfy NNG-1.

**Inputs (per timestep):**
- O₂ from `o2_in`: adds O₂ to room atmosphere
- CH₂O from `food_in`: consumed by metabolism → CO₂ + H₂O produced
- H₂O from `h2o_in`: consumed (drinking), exits as waste_water
- H₂O from `hot_water_in`: passes through, exits as waste_water_out
- Air from `air_return`: mixed species enter room atmosphere

**Outputs (per timestep):**
- Air to `air_exhaust`: room atmosphere sample leaves
- Water to `waste_water_out`: hot_water + drinking excess at room T

**Internal reactions:**
- CH₂O + O₂ → CO₂ + H₂O (inline stoichiometry, not reactor)

**Conservation check:**
```
Σ(in_moles) − Σ(out_moles) − Σ(consumed) + Σ(produced) = Δ(room_inventory)
```

This is tracked in `computeSystemBalance` with a dedicated
`u.defId === 'room'` handler.

---

## 13. Profiles

### `shelter` (T1, pressureClass: 'simple')

```
defId: 'room'
name: 'Crew Shelter'
category: UnitCategories.LIFE_SUPPORT  (new category)
tiers: [1]
pressureClass: 'simple'
defaults: {
  1: { nPeople: 2 }
}
limits: {
  1: {
    T_LL: 263,    // -10°C structural
    T_HH: 323,    // 50°C structural
  }
}
```

### Parameters (inspector-editable)

| Param | Default | Range | Note |
|-------|---------|-------|------|
| `nPeople` | 2 | 0–10 | Integer, mission may lock |

Volume (62.5 m³), UA (60 W/K), thermal mass (500 kJ/K) are
internal constants, not player-editable.

---

## 14. Infrastructure Checklist

| Item | Details |
|------|---------|
| Planet X T_K: 288.15 → 278.15 | Required for heating to matter. Also update diurnal amplitude if needed |
| UnitRegistry.register('room', {...}) | Ports, limitParams, inventory, tick |
| ProfileRegistry.register('shelter', {...}) | pressureClass: 'simple' |
| _NO_GAUGE | Add 'room' |
| _BYPASS_PATHS | `room: []` (no material passthrough when fried) |
| _PARTICLE_BEHAVIORS | `room: null` (opaque) |
| _BODY_BBOX | Large bbox for 6×4 unit |
| _RAGTAG_SYMBOLS.room | Multi-layer icon function |
| UnitInspector.room | customParams + conditions + kpis + detail |
| computeSystemBalance | `defId === 'room'` handler |
| Template profile | `room_tpl` |
| UnitCategories.LIFE_SUPPORT | New category (order: 15, color: #22c55e) |

---

## 15. Tests

| # | Test | Validates |
|---|------|-----------|
| T657 | Registration, profile, ports | defId exists, 8 ports, pressureClass |
| T658 | initInventory — room starts with planet air | Correct moles, T=294K |
| T659 | Metabolism inline — O₂ consumed, CO₂ produced | Stoichiometric 1:1 |
| T660 | Service validation — full supply | All services green |
| T661 | Service validation — O₂ missing | O₂ status WARNING/MAJOR |
| T662 | Exhaust composition — CO₂ enriched | Room CO₂ > inlet CO₂ |
| T663 | Thermal — hot feed heats room | T_room rises with hot O₂ |
| T664 | Thermal — night cooling | T_room drops without heating |
| T665 | Hot water heating | Q_hot_water reduces heating deficit |
| T666 | Waste water output | hot_water_in → waste_water_out at room T |
| T667 | Power demand computation | Matches formula from §5.6 |
| T668 | Mass balance closure | NNG-1 residual < 1% |
| T669 | Reference rates in u.last | All demand values present and correct |
| T670 | Liveability score | Degrades with missing services |

---

## 16. Implementation Plan

### Session 1: Room defId + tick + tests (T657-T670)
- Register defId with all ports
- Implement initInventory, updateInventory, tick
- Simplified inline metabolism
- Thermal model
- Service validation
- Exhaust composition
- Power demand
- Inspector (reference rates, service status, thermal)
- computeSystemBalance handler
- All infrastructure hooks
- Tests

### Session 2: Room icon + gauges + character placeholders
- Multi-layer SVG icon (6×4 tiles)
- Gauge bar rendering driven by u.last.gauges
- Lena + Kael static placeholder figures
- Animation state computed but not visually driven
- Expression/pose sub-groups structured for future animation

### Session 3: Character animation (future)
- Lena facial expressions (calm → worried → distressed → critical)
- Kael position and action animations
- Breath vapor effect in cold room
- Alarm glow effects
- SimTime-driven animation cycle

---

## 17. Open Design Questions (Resolved)

**Q: How does the room consume the right amount?**
A: It consumes everything that arrives. If supply > demand, excess
O₂ accumulates in room atmosphere (fraction rises). If supply <
demand, room O₂ depletes. The player sees supply vs demand in the
inspector and adjusts buffer draw rates. (Denis: "it takes everything
that comes, it only checks and consumes all")

**Q: Exhaust mass balance?**
A: Room is a real inventory vessel. Air in − air out = Δinventory.
Exhaust rate computed to maintain roughly constant room moles.
No synthetic composition — it's the actual room atmosphere.

**Q: Missing service behavior?**
A: Partial service is better than total shutdown. Each service
validated independently. Missing O₂ depletes room O₂ inventory
(fraction drops over hours). Missing food → no metabolism → no CO₂
production → no metabolic heat → room cools. Missing power → no
heating → room cools at night. All coupled through real physics.

**Q: Temperature control?**
A: Electric heating is the primary fallback — always computed, always
available if power is connected. Hot water is an optimization that
reduces electric demand. With Planet X at 278K, 2 people need ~868W
of heating at night. Without hot water, the electric heater draws all
of it — potentially doubling battery drain. Connecting warm process
water (e.g. reactor cooling loop) offsets 400-600W of that, making
the battery last through the night. As crew grows to 10, metabolic
heat exceeds losses and overheating replaces cold as the problem.
The thermal puzzle evolves with the colony.
