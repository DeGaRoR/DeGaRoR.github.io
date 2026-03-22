# PTIS_COMPOSITE_MODELS
## Biosphere Composite Models — Human, Greenhouse, Room
### Reference document for S8, S9, S9b, S10

---

> **Purpose.** Canonical engineering models for the three biosphere
> composites (human, greenhouse, room) and the Day-0 depletable
> configuration. Referenced by S8 (template infrastructure), S9
> (unit registrations), S9b (validation gate), S10 (game layer),
> Equipment Matrix, and Biosphere Power Reconciliation.
>
> Each composite is presented at two levels:
> - **Conceptual model** — topology and species flow only, no numbers.
>   Use for design discussions, mission briefings, and whiteboard
>   explanations.
> - **Implementation model** — full internal unit list, connections,
>   buffer sizing, alarm envelopes, energy closure, and scaling rules.
>   Source of truth for GroupTemplate registration code.
>
> **Supersedes:** Human, greenhouse, and room sections previously
> scattered across PTIS_S8_SPEC, PTIS_S10_SPEC, and
> PTIS_DESIGN_AMENDMENT_S2_FINAL.

---

# 1. Human Composite

## 1.1 Conceptual Model

The human composite converts food and oxygen into CO₂, water,
waste heat, and metabolic waste. Five boundary ports connect it
to the outside world.

```
                    food_in
                       ↓
air_in → [ METABOLISM ] → [ KIDNEY ] ──→ air_out
              (food + O₂ → CO₂ + H₂O     (exhaled air
               + body heat)                 carries waste heat
                                            back to room)
                                 ↓ waste
water_in ──────────────→ [ WASTE MIX ] → waste_out
                           (urine analogue:
                            H₂O + NH₃)
```

Species flow:
- **In:** O₂ and N₂ (via air_in), CH₂O (via food_in), H₂O (via water_in)
- **Reaction:** CH₂O + O₂ → CO₂ + H₂O (complete conversion)
- **Out (air):** CO₂, H₂O, N₂, residual O₂ — all as warm air
  carrying metabolic waste heat back to the room
- **Out (waste):** H₂O + NH₃ (kidney retentate + drinking water)

Metabolic heat is not a port or an abstract energy flow. The
reactor products exit hot; a heat exchanger transfers that energy
to passing room air. The warm air exits through air_out. The room
receives it as a normal material stream with elevated enthalpy.

Body temperature is NOT modeled. Room temperature serves as the
life-condition proxy (see §3.4).

---

## 1.2 Implementation Model

11 internal units, 5 boundary ports, 4×2 footprint.

```
air_in → [fan] → [air_splitter]
             ├── 8% → [air_buffer] → [feed_mixer] ← [food_buffer] ← food_in
             │          (lungs)        ↑              (body reserves)
             │                         │
             │                    [metabolism]
             │                    (reactor_adiabatic
             │                     R_METABOLISM)
             │                    products exit hot
             │                         ↓ (hot side)
             └── 92% ──────→ [body_hex] (cold side)
                                  ↓ hot out            ↓ cold out
                              [kidney]              [air_mixer]
                              (membrane,                 ↓
                               NH3→retentate)         air_out
                                  ↓ ret_out
water_in → [water_buffer] → [waste_mixer]
                                  ↓
                              waste_out
```

### Internal Units

| # | localId | defId | Key params | Role |
|---|---------|-------|-----------|------|
| 1 | fan | compressor | P_ratio: 1.001, ~1W | Respiratory muscles + body convection |
| 2 | air_splitter | splitter | splitPct: 8 | 8% to lungs (process), 92% to skin (cooling) |
| 3 | air_buffer | tank | 5L/pp, gas, T:310K, 1 atm | Lungs + blood O₂ reserve |
| 4 | food_buffer | tank | ~12L/pp, CH₂O gas | Body energy reserves |
| 5 | feed_mixer | mixer | — | Combines air (from buffer) + food (from buffer) |
| 6 | metabolism | reactor_adiabatic | R_METABOLISM, complete conversion | Products exit hot (all metabolic heat in stream) |
| 7 | body_hex | hex | UA: scaled per population | Hot: metabolism products. Cold: room air. |
| 8 | kidney | membrane_separator | { NH3: 0.01 } | NH₃ 99% to retentate. All gases permeate. |
| 9 | air_mixer | mixer | — | Merges kidney permeate + body_hex cold out |
| 10 | water_buffer | tank | 6.3L/pp, liquid H₂O | Hydration reserve |
| 11 | waste_mixer | mixer | — | Combines kidney retentate + water drainage |

### Internal Connections

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

### Boundary Ports (5)

| portId | Label | Dir | Type | Delegates to |
|--------|-------|-----|------|-------------|
| air_in | Air In | IN | MATERIAL | fan.mat_in |
| food_in | Food In | IN | MATERIAL | food_buffer.mat_in |
| water_in | Water In | IN | MATERIAL | water_buffer.mat_in |
| air_out | Exhaled Air | OUT | MATERIAL | air_mixer.mat_out |
| waste_out | Waste | OUT | MATERIAL | waste_mixer.mat_out |

### Template Registration

```javascript
GroupTemplateRegistry.register('human', {
  name: 'Colonists',
  category: 'CAMPAIGN',
  locked: true,
  showInPalette: true,
  w: 4, h: 2,

  scalable: true,
  scaleParam: 'population',
  scaleDefault: 2,
  scaleRules: [
    { unitLocalId: 'metabolism',    param: 'rate_multiplier', factor: 1.0 },
    { unitLocalId: 'air_buffer',    param: 'volume_m3',      factor: 1.0 },
    { unitLocalId: 'food_buffer',   param: 'volume_m3',      factor: 1.0 },
    { unitLocalId: 'water_buffer',  param: 'volume_m3',      factor: 1.0 },
    { unitLocalId: 'body_hex',      param: 'UA',             factor: 1.0 },
    { unitLocalId: 'fan',           param: 'flowTarget',     factor: 1.0 },
    { unitLocalId: 'air_splitter',  param: 'flowTarget',     factor: 1.0 }
  ],

  units: [
    { localId: 'fan',           defId: 'compressor',
      params: { P_ratio: 1.001 },
      paramLocked: true, editableParams: null },
    { localId: 'air_splitter',  defId: 'splitter',
      params: { splitPct: 8 },
      paramLocked: true, editableParams: null },
    { localId: 'air_buffer',    defId: 'tank',
      params: { volume_m3: 0.005, T: 310, P: 101325 },
      paramLocked: true, editableParams: null },
    { localId: 'food_buffer',   defId: 'tank',
      params: { volume_m3: 0.012 },
      paramLocked: true, editableParams: null },
    { localId: 'feed_mixer',    defId: 'mixer',
      params: {},
      paramLocked: true, editableParams: null },
    { localId: 'metabolism',    defId: 'reactor_adiabatic',
      params: { reactionId: 'R_METABOLISM' },
      paramLocked: true, editableParams: null },
    { localId: 'body_hex',      defId: 'hex',
      params: { UA: 10 },
      paramLocked: true, editableParams: null },
    { localId: 'kidney',        defId: 'membrane_separator',
      params: { membrane: 'renal', selectivity: { NH3: 0.01 } },
      paramLocked: true, editableParams: null },
    { localId: 'air_mixer',     defId: 'mixer',
      params: {},
      paramLocked: true, editableParams: null },
    { localId: 'water_buffer',  defId: 'tank',
      params: { volume_m3: 0.0063 },
      paramLocked: true, editableParams: null },
    { localId: 'waste_mixer',   defId: 'mixer',
      params: {},
      paramLocked: true, editableParams: null }
  ],

  connections: [
    { from: { localId: 'fan',          portId: 'mat_out' },
      to:   { localId: 'air_splitter', portId: 'mat_in' } },
    { from: { localId: 'air_splitter', portId: 'mat_out_1' },
      to:   { localId: 'air_buffer',   portId: 'mat_in' } },
    { from: { localId: 'air_splitter', portId: 'mat_out_2' },
      to:   { localId: 'body_hex',     portId: 'cold_in' } },
    { from: { localId: 'air_buffer',   portId: 'mat_out' },
      to:   { localId: 'feed_mixer',   portId: 'mat_in_A' } },
    { from: { localId: 'food_buffer',  portId: 'mat_out' },
      to:   { localId: 'feed_mixer',   portId: 'mat_in_B' } },
    { from: { localId: 'feed_mixer',   portId: 'mat_out' },
      to:   { localId: 'metabolism',   portId: 'mat_in' } },
    { from: { localId: 'metabolism',   portId: 'mat_out' },
      to:   { localId: 'body_hex',     portId: 'hot_in' } },
    { from: { localId: 'body_hex',     portId: 'hot_out' },
      to:   { localId: 'kidney',       portId: 'mat_in' } },
    { from: { localId: 'body_hex',     portId: 'cold_out' },
      to:   { localId: 'air_mixer',    portId: 'mat_in_A' } },
    { from: { localId: 'kidney',       portId: 'perm_out' },
      to:   { localId: 'air_mixer',    portId: 'mat_in_B' } },
    { from: { localId: 'kidney',       portId: 'ret_out' },
      to:   { localId: 'waste_mixer',  portId: 'mat_in_A' } },
    { from: { localId: 'water_buffer', portId: 'mat_out' },
      to:   { localId: 'waste_mixer',  portId: 'mat_in_B' } }
  ],

  boundaryPorts: [
    { portId: 'air_in',    label: 'Air In',      dir: 'IN',  type: 'MATERIAL',
      unitLocalId: 'fan',          unitPortId: 'mat_in' },
    { portId: 'food_in',   label: 'Food In',     dir: 'IN',  type: 'MATERIAL',
      unitLocalId: 'food_buffer',  unitPortId: 'mat_in' },
    { portId: 'water_in',  label: 'Water In',    dir: 'IN',  type: 'MATERIAL',
      unitLocalId: 'water_buffer', unitPortId: 'mat_in' },
    { portId: 'air_out',   label: 'Exhaled Air', dir: 'OUT', type: 'MATERIAL',
      unitLocalId: 'air_mixer',    unitPortId: 'mat_out' },
    { portId: 'waste_out', label: 'Waste',       dir: 'OUT', type: 'MATERIAL',
      unitLocalId: 'waste_mixer',  unitPortId: 'mat_out' }
  ]
});
```

---

## 1.3 Biological Buffers

All buffer sizing is per person. Scaling is handled by the
`scaleRules` mechanism — buffer volumes multiply by population.
Rates below are per person.

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

---

## 1.4 Energy Closure Verification

Metabolism releases 121 W/person into the product stream
(adiabatic reactor, products exit hot). body_hex transfers this
heat to the cooling air branch. Cooling air (92% of intake,
~0.155 mol/s per person) warms from T_room to ~320K.
Q = 0.155 × 29 × 27 ≈ 121 W. ✓

Both branches merge in air_mixer. air_out carries all 121 W as
warm air back to the room. Room absorbs heat via normal enthalpy
accounting on the incoming material stream. Balance closed. No
heat port. No abstract heat concept.

---

## 1.5 Scaling

The human composite scales via the generic GroupTemplate `scale`
mechanism (defined in S8). `scaleParam: 'population'`, default 2.
Campaign rescue events call `setParam('human_1', 'population', N)`.
All internal rates and buffer volumes adjust next tick.

Population timeline:

| Day | Population | Event |
|-----|-----------|-------|
| 0 | 2 | Crash (Kael + Vasquez) |
| ~10 | 3 | +Jin (M4 salvage) |
| ~22 | 5 | +Amara, Tomás (M6 salvage) |
| ~27 | 7 | +Priya, Erik (M7 salvage) |

---

# 2. Greenhouse Composite

## 2.1 Conceptual Model

The greenhouse converts CO₂, water, and electricity into food and
oxygen via photosynthesis. Two fully separated stream paths —
process and cooling never mix.

```
PROCESS PATH:
co2_in ──→ [ MIX ] ←── nutrient_in (H₂O + NH₃)
               ↓
         [ PHOTOSYNTHESIS ] ← elec_in (grow lights)
               ↓
         [ LEAF SEPARATOR ]
          ↓ permeate          ↓ retentate
        air_out              food_out
      (O₂-rich gas)        (CH₂O + NH₃)

COOLING PATH (fully separate):
cool_in → [ HEX cold side ] → cool_out
```

Species flow:
- **In (process):** CO₂ (via co2_in), H₂O + NH₃ (via nutrient_in)
- **In (energy):** Electricity (via elec_in)
- **In (cooling):** Atmospheric air (via cool_in)
- **Reaction:** CO₂ + H₂O → CH₂O + O₂ (photosynthesis, endothermic)
- **Out (air):** O₂, unreacted CO₂, H₂O — permeate through leaf
- **Out (food):** CH₂O + NH₃ — retained by leaf
- **Out (cooling):** Warm air (via cool_out) — absorbed waste heat
  through HEX wall, never contacts process stream

The process and cooling paths share NO material. The HEX transfers
only energy between them. The leaf separator sees only process-side
species. Cooling air sees no food species.

Feed gas note: co2_in receives CO₂-rich gas (from room exhaust or
atmosphere). This is NOT ambient air — it is CO₂-boosted
agriculture. No O₂ in the feed (O₂ is purely a product).

Lighting efficiency (η) is the ONE editable parameter on the
locked template. Default η = 2%. Player can adjust 0.5–5%.

---

## 2.2 Implementation Model

7 internal units, 7 boundary ports, 4×3 footprint.

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

### Internal Units

| # | localId | defId | Key params | Role |
|---|---------|-------|-----------|------|
| 1 | soil_buffer | tank | 50L, liquid | Water + NH₃ nutrient reserve |
| 2 | nutrient_mix | mixer | — | Combines CO₂ gas + nutrient solution |
| 3 | photo_reactor | reactor_electrochemical | R_PHOTOSYNTHESIS, η=0.02, conversion_max=0.95 | Adiabatic. η editable (0.5–5%). |
| 4 | product_mixer | mixer | — | Merges cat + ano outlets into single stream |
| 5 | cooling_hex | hex | UA: sized for waste heat at η=0.02 | Hot: reactor products. Cold: ventilation air. |
| 6 | fan | compressor | P_ratio: 1.001, ~50W | Drives ventilation cooling air |
| 7 | leaf | membrane_separator | { CH2O: 0.05, NH3: 0.05 } | Retains food + nitrogen. O₂ and gases permeate. |

### Internal Connections

| From | To |
|------|-----|
| soil_buffer.mat_out | nutrient_mix.mat_in_B |
| nutrient_mix.mat_out | photo_reactor.mat_in |
| photo_reactor.mat_out_cat | product_mixer.mat_in_A |
| photo_reactor.mat_out_ano | product_mixer.mat_in_B |
| product_mixer.mat_out | cooling_hex.hot_in |
| fan.mat_out | cooling_hex.cold_in |
| cooling_hex.hot_out | leaf.mat_in |

### Boundary Ports (7)

| portId | Label | Dir | Type | Delegates to |
|--------|-------|-----|------|-------------|
| co2_in | CO₂ Feed | IN | MATERIAL | nutrient_mix.mat_in_A |
| nutrient_in | Nutrient Solution | IN | MATERIAL | soil_buffer.mat_in |
| elec_in | Grow Lights | IN | ELECTRICAL | photo_reactor.elec_in |
| cool_in | Cooling Air In | IN | MATERIAL | fan.mat_in |
| cool_out | Cooling Air Out | OUT | MATERIAL | cooling_hex.cold_out |
| air_out | O₂-rich Air | OUT | MATERIAL | leaf.perm_out |
| food_out | Food | OUT | MATERIAL | leaf.ret_out |

### Template Registration

```javascript
GroupTemplateRegistry.register('greenhouse', {
  name: 'Greenhouse',
  category: 'CAMPAIGN',
  locked: true,
  showInPalette: true,
  w: 4, h: 3,

  scalable: true,
  scaleParam: 'racks',
  scaleDefault: 1,
  scaleRules: [
    { unitLocalId: 'photo_reactor', param: 'rate_multiplier', factor: 1.0 },
    { unitLocalId: 'soil_buffer',   param: 'volume_m3',       factor: 1.0 },
    { unitLocalId: 'cooling_hex',   param: 'UA',              factor: 1.0 },
    { unitLocalId: 'fan',           param: 'flowTarget',      factor: 1.0 }
  ],

  units: [
    { localId: 'soil_buffer',    defId: 'tank',
      params: { volume_m3: 0.05 },
      paramLocked: true, editableParams: null },
    { localId: 'nutrient_mix',   defId: 'mixer',
      params: {},
      paramLocked: true, editableParams: null },
    { localId: 'photo_reactor',  defId: 'reactor_electrochemical',
      params: { reactionId: 'R_PHOTOSYNTHESIS', efficiency: 0.02,
                conversion_max: 0.95 },
      paramLocked: true, editableParams: ['efficiency'] },
    { localId: 'product_mixer',  defId: 'mixer',
      params: {},
      paramLocked: true, editableParams: null },
    { localId: 'cooling_hex',    defId: 'hex',
      params: {},
      paramLocked: true, editableParams: null },
    { localId: 'fan',            defId: 'compressor',
      params: { P_ratio: 1.001 },
      paramLocked: true, editableParams: null },
    { localId: 'leaf',           defId: 'membrane_separator',
      params: { membrane: 'gas_exchange',
                selectivity: { CH2O: 0.05, NH3: 0.05 } },
      paramLocked: true, editableParams: null }
  ],

  connections: [
    { from: { localId: 'soil_buffer',   portId: 'mat_out' },
      to:   { localId: 'nutrient_mix',  portId: 'mat_in_B' } },
    { from: { localId: 'nutrient_mix',  portId: 'mat_out' },
      to:   { localId: 'photo_reactor', portId: 'mat_in' } },
    { from: { localId: 'photo_reactor', portId: 'mat_out_cat' },
      to:   { localId: 'product_mixer', portId: 'mat_in_A' } },
    { from: { localId: 'photo_reactor', portId: 'mat_out_ano' },
      to:   { localId: 'product_mixer', portId: 'mat_in_B' } },
    { from: { localId: 'product_mixer', portId: 'mat_out' },
      to:   { localId: 'cooling_hex',   portId: 'hot_in' } },
    { from: { localId: 'fan',           portId: 'mat_out' },
      to:   { localId: 'cooling_hex',   portId: 'cold_in' } },
    { from: { localId: 'cooling_hex',   portId: 'hot_out' },
      to:   { localId: 'leaf',          portId: 'mat_in' } }
  ],

  boundaryPorts: [
    { portId: 'co2_in',      label: 'CO₂ Feed',         dir: 'IN',  type: 'MATERIAL',
      unitLocalId: 'nutrient_mix',  unitPortId: 'mat_in_A' },
    { portId: 'nutrient_in', label: 'Nutrient Solution', dir: 'IN',  type: 'MATERIAL',
      unitLocalId: 'soil_buffer',   unitPortId: 'mat_in' },
    { portId: 'elec_in',     label: 'Grow Lights',       dir: 'IN',  type: 'ELECTRICAL',
      unitLocalId: 'photo_reactor', unitPortId: 'elec_in' },
    { portId: 'cool_in',     label: 'Cooling Air In',    dir: 'IN',  type: 'MATERIAL',
      unitLocalId: 'fan',           unitPortId: 'mat_in' },
    { portId: 'cool_out',    label: 'Cooling Air Out',   dir: 'OUT', type: 'MATERIAL',
      unitLocalId: 'cooling_hex',   unitPortId: 'cold_out' },
    { portId: 'air_out',     label: 'O₂-rich Air',      dir: 'OUT', type: 'MATERIAL',
      unitLocalId: 'leaf',          unitPortId: 'perm_out' },
    { portId: 'food_out',    label: 'Food',              dir: 'OUT', type: 'MATERIAL',
      unitLocalId: 'leaf',          unitPortId: 'ret_out' }
  ]
});
```

---

## 2.3 Leaf Selectivity

The leaf is a `membrane_separator` with selectivity map
`{ CH2O: 0.05, NH3: 0.05 }`. Unlisted species default to 1.0
(fully permeate).

| Species | Selectivity | Permeate (air_out) | Retentate (food_out) |
|---------|------------|-------------------|---------------------|
| CH₂O | 0.05 | 5% (small loss) | 95% (food) ✓ |
| NH₃ | 0.05 | 5% (small loss) | 95% (to human) ✓ |
| O₂ | 1.0 (default) | 100% | 0% ✓ |
| CO₂ | 1.0 (default) | 100% (unreacted, recycles) | 0% ✓ |
| H₂O | 1.0 (default) | 100% | 0% ✓ |

---

## 2.4 Soil Buffer

| Parameter | Value | Unit | Notes |
|-----------|-------|------|-------|
| Volume | 50 | L | Liquid H₂O + dissolved NH₃ |
| Buffer runway | ~8.5 | hr | At 5.88 mol/hr consumption |

Alarm at level < 20% → WARNING.

---

## 2.5 Scaling

`scaleParam: 'racks'`, default 1. More racks → proportionally more
photosynthesis rate, soil buffer volume, cooling HEX capacity,
ventilation flow. Campaign M10 may need multiple greenhouse
instances or rack scaling to feed 7 colonists.

---

# 3. Room

The room is NOT a composite — it is a single registered unit
(a vessel with atmospheric tracking and wall conduction). It is
documented here because it participates in the biosphere loop and
its design is tightly coupled to the human and greenhouse models.

## 3.1 Physics

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

Occupant heat is NOT an internal bookkeeping term. The human
composite's air_out stream carries metabolic heat as warm air.
The room absorbs this heat when the warm air enters through
normal enthalpy accounting on the incoming material stream.
The room is a dumb tank.

The HVAC (M6): The player builds a heat pump as an external
process loop. A fan recirculates room air through a HEX condenser;
warm air returns to the room. This is material flow, not a
heat port.

## 3.2 Ports

| portId | Label | Dir | Type | Connects to |
|--------|-------|-----|------|------------|
| air_supply | Air Supply | IN | MATERIAL | Clean air from M5, vent, bottles |
| o2_supply | O₂ Supply | IN | MATERIAL | O₂ from electrolyzer / bottles |
| water_supply | Water Supply | IN | MATERIAL | Water from M1 |
| exhaust | Exhaust | OUT | MATERIAL | To scrubber, greenhouse co2_in |
| elec_in | Power | IN | ELECTRICAL | Lighting, base load |

The room is a 5-port unit (4 material + 1 electrical). Air
recirculation for HVAC uses exhaust → fan → HEX → air_supply.

## 3.3 Atmospheric Gauges

| Gauge | Computation | Green | Amber | Red |
|-------|-------------|-------|-------|-----|
| O₂ % | y_O₂ × 100 | 19–23% | 17–19% | <17% |
| CO₂ % | y_CO₂ × 100 | <0.5% | 0.5–2% | >2% |
| Temperature | T_room | 293–308 K | 283–293 K | <283 K |
| Humidity | y_H₂O × P / Psat(T) | 30–70% RH | 20–30% or 70–80% | <20% or >80% |
| Pressure | P_room | 0.85–1.05 atm | 0.80–0.85 | <0.80 atm |

## 3.4 Room Temperature as Life-Condition Proxy

Body temperature is not modeled (thermoregulation physics —
shivering, vasoconstriction — would add complexity without
proportional teaching value). Room temperature creates M6
urgency without the complexity.

| Room T | Alarm | Condition |
|--------|-------|-----------|
| > 313 K | ERROR | Heat stroke risk |
| > 308 K | WARNING | Heat stress |
| 293–308 K | OK | Comfortable |
| 283–293 K | WARNING | Cold |
| < 283 K | ERROR | Hypothermia risk |
| < 273 K | CRITICAL | Severe hypothermia |

---

# 4. Initial Biosphere — Depletable Room (Day 0)

At game start, the room is pre-loaded with emergency supplies.
These are finite-capacity units that deplete as the colonists
consume resources. Each depletable creates an urgency timer —
the player must build sustainable replacements before supplies
run out.

## 4.1 Day-0 Configuration

Five supply units pre-placed and connected to the room. Not
buildable, not movable. Can be inspected.

| Depletable | Contents | Consumption (2 ppl) | Runway |
|------------|----------|---------------------|--------|
| Water jerricans | **0 mol (EMPTY)** | — | 0 — M1 urgent |
| O₂ bottles | 300 mol at 150 bar | 1.68 mol/hr | 7.4 days |
| LiOH cartridges | 268 mol CO₂ capacity | 1.68 mol/hr | 6.6 days |
| MRE crate | 3,000 mol CH₂O | Escalating | ~Day 37 |
| Battery | 75 kWh | ~200 W | 15.6 days |

## 4.2 LiOH Scrubber

The LiOH scrubber is a `membrane_separator` instance with
`depletable: true` and finite `sorbentCapacity`.

| Parameter | Value |
|-----------|-------|
| defId | `membrane_separator` |
| selectivity | `{ CO2: 0.01 }` (99% CO₂ to retentate) |
| depletable | `true` |
| sorbentCapacity | 268 mol CO₂ (20 cartridges × 13.4 mol) |
| sorbentRemaining | 268 mol (initial) |
| maxRate | 5 mol CO₂/hr |
| Ports | mat_in, perm_out (clean air), ret_out (CO₂) |

When sorbent = 0: selectivity drops to 0, CO₂ passes through
unabsorbed. Alarm at sorbent < 20% → WARNING.

Mass balance closes on gas streams (CO₂ removed, same amount
appears in retentate). Minor H₂O mass imbalance accepted
(~0.4 g per g CO₂).

## 4.3 MRE Depletion Schedule

| Phase | Days | People | CH₂O consumed | Remaining |
|-------|------|--------|--------------|-----------|
| Day 0–10 | 10 | 2 | 403 | 2,597 |
| Day 10–22 | 12 | 3 | 726 | 1,871 |
| Day 22–27 | 5 | 5 | 1,008 | 863 |
| Day 27–37 | 10 | 7 | 1,411 | ~0 |
| Day 37+ | — | 7 | Body reserves | 21 days to death |

## 4.4 Depletable → Sustainable Transitions

| Supply | Starts as | Replaced by | HUD transition |
|--------|-----------|-------------|----------------|
| Water jerricans | Empty → M1 fills | Main storage | "EMPTY" → "✓ SUPPLIED" |
| O₂ bottles | Depleting | Electrolyzer output (M2) | "6.2 days" → "✓ SUPPLIED" |
| LiOH scrubber | Depleting sorbent | Chemical scrubbing (M5) | "85%" → "✓ SUPPLIED" |
| MRE crate | Depleting food | Greenhouse output (M10) | "280 days" → "✓ SUPPLIED" |
| Battery | Depleting | Brayton charges (M4) | "14.8 days" → "5.0 kW ✓" |

## 4.5 HUD Runway Computation

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

# 5. Closed-Loop Biosphere Mass Balance

When both human and greenhouse composites are operating and
connected through the room, the biosphere forms a closed loop
on four species. External inputs needed: electricity (grow
lights), NH₃ (makeup from Haber), cooling air (ventilation).

## 5.1 Four-Species Closure (7 people)

| Species | Human produces | Greenhouse consumes | Net |
|---------|---------------|--------------------|----|
| CO₂ | +5.88 mol/hr | −5.88 mol/hr | 0 ✓ |
| O₂ | −5.88 mol/hr | +5.88 mol/hr | 0 ✓ |
| H₂O | +5.88 mol/hr (metabolic) | −5.88 mol/hr | 0 ✓ |
| CH₂O | −5.88 mol/hr | +5.88 mol/hr | 0 ✓ |

Perfect stoichiometric closure. R_METABOLISM and R_PHOTOSYNTHESIS
are exact reverses (ΔH = ±519.4 kJ/mol). The mass balance
closes by construction.

## 5.2 Nitrogen Cycle

NH₃ (from M7 Haber process) enters greenhouse via nutrient_in
dissolved in water. Passes through reactor unreacted (not a
participant in R_PHOTOSYNTHESIS). Leaf retains it (selectivity
0.05). food_out carries CH₂O + NH₃ → human.food_in.

Inside human: NH₃ passes through metabolism unreacted. Kidney
diverts NH₃ to retentate → waste_out. Waste contains H₂O + NH₃.
If player recycles wastewater (★★★ path), NH₃ returns to the
nutrient system.

## 5.3 Water Cycle

Photosynthesis consumes water: CO₂ + H₂O → CH₂O + O₂.
At 5.88 mol/hr for 7 people, the greenhouse consumes 5.88 mol/hr
H₂O via nutrient_in.

Human metabolism produces 0.84 mol/hr/person × 7 = 5.88 mol/hr
H₂O, exhaled as humid air → enters room. To close the loop, the
player must condense this moisture from room air and return it to
the greenhouse. A flash drum or air cooler on the room exhaust
recovers liquid water → pipes to greenhouse.nutrient_in.

This is exactly the ★★★ wastewater recycle criterion for M10.
Without water recovery, the player draws from the M1 water tank
(open-loop on water).

## 5.4 CH₂O Phase Behavior

CH₂O (Tb = 254K) is a gas at room temperature. Food tanks hold
pressurized gas. Food pipes carry invisible vapor. Physically odd
but thermodynamically consistent. Composites abstract this at
their boundaries. The MRE crate and food_buffer display mass
counters or pressure gauges rather than liquid levels. The player
never sees "food flowing through a pipe" directly — it enters
and exits locked composites.

No species exceptions, no phase overrides. WYSIWYG: CH₂O is
what it is.

---

# 6. Vent Sources

Vents are `reservoir` units defined per mission (NOT in planet
registry). Flow emerges from ΔP across the integrated Cv valve.

| Parameter | Vent 1 | Vent 2 | Deep Tap (M10) |
|-----------|--------|--------|---------------|
| T | 500 K | 500 K | 550 K |
| P | 3.0 bar | 4.0 bar | 8.0 bar |
| Composition | 30/35/25/10 (H₂O/CO₂/N₂/CH₄) | Same | Same |
| Cv | 0.5 | 1.2 | 5.0 |

---

# 7. Document Cross-References

| Topic | Canonical source |
|-------|-----------------|
| Metabolic rate derivation | PTIS_BIOSPHERE_POWER_RECONCILIATION §2.1 |
| Greenhouse power budget | PTIS_BIOSPHERE_POWER_RECONCILIATION §2.2 |
| NASA cross-validation | PTIS_BIOSPHERE_POWER_RECONCILIATION §2.1 |
| GroupTemplate infrastructure | PTIS_S8_SPEC |
| membrane_separator defId | PTIS_S9_SPEC |
| R_PHOTOSYNTHESIS, R_METABOLISM | PTIS_S9_SPEC §S9-2 |
| CH₂O species data | PTIS_S9_SPEC §S9-2 |
| Validation gate pass criteria | PTIS_ROADMAP (S9b) |
| Mission definitions | PTIS_S10_SPEC |
| Equipment canonical data | PTIS_EQUIPMENT_MATRIX |
