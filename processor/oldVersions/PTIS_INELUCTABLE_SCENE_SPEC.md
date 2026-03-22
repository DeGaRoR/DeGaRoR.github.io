# PTIS Ineluctable Fate Scene — Implementation Spec
## v15.0.0 — Second Example Scene (demo_ineluctable)

---

> **Purpose.** Build a playable Day-0 scene: a sealed room, 2 colonists,
> and depleting emergency supplies — with no player intervention possible.
> The scene validates the survival arc timeline: dehydration at ~75 hr,
> CO₂ poisoning at ~222 hr (if water were infinite). Registered as
> `demo_ineluctable` alongside existing `demo_v1`.
>
> **Constraints.** GroupTemplate (S8) does not exist yet. The 11-unit
> human composite must be placed as individual flat units. The room unit
> (COMPOSITE_MODELS §3) is not registered — use `tank` (50 m³ sealed
> vessel). All wiring is manual connections in the scene JSON.
>
> **Sources.** PTIS_COMPOSITE_MODELS §1.2, §4; PTIS_BIOSPHERE_POWER_
> RECONCILIATION §2.1; PTIS_MISSION_DESIGN_V2 §Day-0; conversation
> record (288K lock, ineluctable fate derivation).

---

# 1. Scene Overview

Two humans in a sealed room with emergency supplies. No player
action, no process equipment. Every resource depletes. The scene
is a death clock.

```
┌───────────────────────────────────────────────────────────────────┐
│ DEPLETABLE SUPPLIES                                               │
│                                                                   │
│  [O₂ Bottles]──→ (room air)                                      │
│  [MRE Crate]──→ (food for humans)                                 │
│  [Battery]──→ (lights — base load)                                │
│  [LiOH Scrubber] on room exhaust loop                             │
│  [Water Jerricans = EMPTY]                                        │
│                                                                   │
│ ROOM (50 m³ sealed tank)                                          │
│  ← air from humans (warm, CO₂-rich)                               │
│  → air to humans (room atmosphere)                                │
│  → exhaust to LiOH scrubber → clean air back to room              │
│                                                                   │
│ 2× HUMAN COMPOSITE (11 units each, flat)                          │
│  air_in ← room atmosphere                                        │
│  food_in ← MRE crate                                             │
│  water_in ← jerricans (empty → body reserve drains)               │
│  air_out → back to room                                           │
│  waste_out → waste sink (lost)                                    │
│                                                                   │
└───────────────────────────────────────────────────────────────────┘
```

---

# 2. Unit Inventory

## 2.1 Human Composite × 2 (22 units total)

Each human is 11 flat units per COMPOSITE_MODELS §1.2. Prefixed
`h1_` and `h2_` for the two colonists.

| # | localId | defId | profileId | Key params |
|---|---------|-------|-----------|-----------|
| 1 | fan | compressor | bio_fan | Pout: 101425 (ΔP≈100Pa), eta:0.99 |
| 2 | air_split | splitter | bio_splitter | splitPct: 8 |
| 3 | air_buf | reservoir | bio_lung | O₂/N₂ mix, 310K, Cv:0.5 |
| 4 | food_buf | reservoir | bio_stomach | CH₂O gas, 310K, Cv:0.5 |
| 5 | feed_mix | mixer | bio_mixer | — |
| 6 | metab | reactor_adiabatic | bio_metabolism | R_METABOLISM, volume: 0.01 |
| 7 | body_hex | hex | bio_hex | T_approach: 5 |
| 8 | kidney | membrane_separator | membrane_kidney | NH₃ extraction (existing profile) |
| 9 | air_mix | mixer | bio_mixer | — |
| 10 | water_buf | reservoir | bio_hydration | H₂O liquid, 310K, Cv:0.2 |
| 11 | waste_mix | mixer | bio_mixer | — |

### Design Decision: Reservoir vs Tank for body buffers

**Use `reservoir` (not `tank`) for body buffers** in v15.

Reason: Tanks are inventory-tracked (dynamic depletion via
`updateInventory`). Reservoirs are infinite steady-state sources
with Cv-controlled flow. For the *static solver* (no time stepping
in the demo), reservoirs produce correct steady-state flows.
When TimeClock runs, tank inventory depletion would model the
body reserves draining — but that requires careful initial
inventory setup and testing of the tank→reactor→hex chain under
time stepping, which is a separate validation.

For the v15 ineluctable scene: reservoirs model the steady-state
metabolic rate. The *timeline validation* (dehydration at 75 hr)
is computed from the net water balance at steady state, not from
dynamic tank simulation. This matches the spec derivation.

**Future (v15.1+):** Convert body buffers to `tank` with
`initInventory` for true dynamic depletion. Add alarm envelopes
from COMPOSITE_MODELS §1.3.

### Internal Connections (per human, 12 connections)

| # | From | Port | To | Port |
|---|------|------|----|------|
| 1 | fan | mat_out | air_split | mat_in |
| 2 | air_split | mat_out_1 | air_buf | — (see §2.1.1) |
| 3 | air_split | mat_out_2 | body_hex | cold_in |
| 4 | air_buf | mat_out | feed_mix | mat_in_1 |
| 5 | food_buf | mat_out | feed_mix | mat_in_2 |
| 6 | feed_mix | mat_out | metab | mat_in |
| 7 | metab | mat_out | body_hex | hot_in |
| 8 | body_hex | hot_out | kidney | mat_in |
| 9 | body_hex | cold_out | air_mix | mat_in_1 |
| 10 | kidney | perm_out | air_mix | mat_in_2 |
| 11 | kidney | ret_out | waste_mix | mat_in_1 |
| 12 | water_buf | mat_out | waste_mix | mat_in_2 |

### §2.1.1 Splitter → Reservoir Problem

The splitter's `mat_out_1` (8%, lungs) must feed a reservoir's
input. But **reservoir has no `mat_in` port** — it's a source-only
unit with a single `mat_out`.

**Resolution options (choose one during implementation):**

**(A) Use `source` instead of reservoir for air_buf.**
Configure `source` with `n: { O₂: 0.00047, N₂: 0.00177 }` at
310K, 101325 Pa. This models the lung output at 0.00224 mol/s
(8% of 0.028 mol/s breathing rate). The splitter's 8% output
goes to a sink (lung_exhale_sink — discarded). The source
independently provides lung-processed air to feed_mixer.

Problem: breaks mass balance — splitter sends air somewhere,
source creates air from nothing. Works for steady-state
demonstration but violates NNG-1.

**(B) Use `tank` for air_buf (with inventory).**
Tank has `mat_in`. Splitter→tank→feed_mixer works. Tank inventory
tracks lung reserves. This is the correct long-term approach but
requires inventory initialization and time-stepping validation.

**(C) Skip the splitter entirely for v15. Simplify topology.**
Route ALL room air through the metabolism path. No body cooling
split. The reactor produces hot products; body_hex cools them
against incoming air. This loses the 8/92 split but preserves
mass balance with fewer units. **9 units per human instead of 11.**

**Recommendation: Option C for v15.** The 8/92 split is a
refinement for body heat distribution. For the ineluctable fate
demonstration, the metabolic rate, species consumption, and
timeline validation don't depend on the split — they depend on
reaction stoichiometry and flow rates. The simplified topology:

```
air_in → [fan] → [feed_mixer] ← [food_source] ← food_in
                      ↓
                 [metabolism]
                      ↓ (hot products)
                 [body_hex] hot side
                      ↓
                 [kidney]
                  perm → [air_mixer] ← [body_hex] cold side ← (bypass air? NO)
                  ret  → [waste_mixer] ← [water_source] ← water_in
                              ↓
                          waste_out
```

Wait — without the split, where does the cold side of body_hex
come from? It needs a second air stream. This reintroduces the
split or requires a different cooling approach.

**Final recommendation: Option C-prime — No body_hex.**

The simplest correct topology for v15:

```
                  food_in
                     ↓
               [food_source]
                     ↓
air_in → [feed_mixer] ← (food)
              ↓
         [metabolism] (R_METABOLISM, adiabatic)
              ↓ (hot products: CO₂, H₂O, unreacted N₂/O₂)
         [kidney] (NH₃ → retentate)
          perm_out → air_out (warm exhaled air carries metabolic heat)
          ret_out → [waste_mixer] ← water_in via [water_source]
                         ↓
                     waste_out
```

**6 units per human.** Mass balance closed. Metabolic heat exits
via air_out as elevated-enthalpy material stream (COMPOSITE_MODELS
§1.4 principle: "warm air carries metabolic heat back to room").
No body_hex needed — the room itself is the heat sink.

The 121 W/person appears as a ~3K temperature rise on the exhaled
air stream. The room (large tank) absorbs it. Energy balance
closes through normal enthalpy accounting.

**This matches the spec's core principle:** "Body temperature is
NOT modeled. Room temperature serves as the life-condition proxy."

---

## 2.2 Simplified Human — 6 Units per Person

| # | localId | defId | profileId | Key params |
|---|---------|-------|-----------|-----------|
| 1 | feed_mix | mixer | bio_mixer | — |
| 2 | food_src | source | bio_food_source | CH₂O gas, 310K, 0.000233 mol/s |
| 3 | metab | reactor_adiabatic | bio_metabolism | R_METABOLISM, V=0.01 m³ |
| 4 | kidney | membrane_separator | membrane_kidney | NH₃→retentate, 99% |
| 5 | water_src | source | bio_water_source | H₂O liquid, 310K, 0.000858 mol/s |
| 6 | waste_mix | mixer | bio_mixer | — |

### Flow rates (per person, steady state)

From BIOSPHERE_POWER_RECONCILIATION §2.1:
- CH₂O consumed: 0.84 mol/hr = 0.000233 mol/s
- O₂ consumed: 0.84 mol/hr (from room air via feed_mixer)
- CO₂ produced: 0.84 mol/hr (via air_out)
- H₂O produced (metabolic): 0.84 mol/hr (via air_out)
- Drinking water: 3.09 mol/hr net loss = 0.000858 mol/s

### Boundary connections (per human)

| portId | Dir | Connects to |
|--------|-----|-------------|
| air_in | IN | feed_mix.mat_in_1 ← room air source |
| food_in | IN | food_src (internal source, rate-limited) |
| water_in | IN | water_src (internal source, rate-limited) |
| air_out | OUT | kidney.perm_out → room air return |
| waste_out | OUT | waste_mix.mat_out → waste sink |

### Internal connections (6 per human)

| From | Port | To | Port |
|------|------|----|------|
| food_src | mat_out | feed_mix | mat_in_2 |
| feed_mix | mat_out | metab | mat_in |
| metab | mat_out | kidney | mat_in |
| water_src | mat_out | waste_mix | mat_in_2 |
| kidney | ret_out | waste_mix | mat_in_1 |

Note: kidney.perm_out and feed_mix.mat_in_1 are boundary ports
(connected to infrastructure, not internal).

---

## 2.3 Infrastructure Units (shared)

| # | id | defId | profileId | Role | Key params |
|---|-----|-------|-----------|------|-----------|
| 1 | room_air | source | source_mix | Room atmosphere | n:{N₂:0.132, O₂:0.035, CO₂:0.0001}, T:288, P:101325 |
| 2 | o2_res | reservoir | reservoir | O₂ bottles | P:15 bar, T:288, comp:{O₂:1}, Cv:0.3 |
| 3 | room_mix | mixer | mixer | Merges O₂+room_air for humans | — |
| 4 | mre | source | source_pure | MRE crate supply | species:CH₂O, nDot: 0.000467 (2×0.84 mol/hr) |
| 5 | water_empty | source | source_pure | Empty jerricans | species:H₂O, nDot: 0 |
| 6 | lioh | membrane_separator | co2_scrubber | LiOH scrubber | consumable: {capacity:268, remaining:268, maxRate:5} |
| 7 | batt | battery | battery | Emergency battery | 75 kWh, 20 kW peak |
| 8 | grid | grid_supply | grid_supply | (none — batt only) | maxPower: 0.4 (lighting) |
| 9 | waste_snk | sink | sink | Waste disposal | — |
| 10 | exhaust_snk | sink | sink | CO₂ retentate | — |
| 11 | air_return | mixer | mixer | Merges human air_out streams | — |

### Wait — rethink the room

The room isn't a real unit yet (§3 of COMPOSITE_MODELS says it's
a future registered unit). For v15, model the room atmosphere as
**sources and sinks** that represent the room's current state:

- `room_air` source: emits room atmosphere composition (fixed for
  static solve; in time-stepping, this would be the tank's
  composition changing each tick)
- Human air returns go to a sink (representing "back to room")
- The LiOH scrubber operates on a separate recirculation: it
  takes room exhaust (from humans) and returns clean air

For the steady-state solver, sources and sinks are the correct
abstraction. The room as a dynamic tank is a v15.1+ feature.

---

## 2.4 Revised Infrastructure (Steady-State Model)

The scene represents one solver tick at steady state. Sources
model supply rates. Sinks model disposal. No dynamic inventory.

| # | id | defId | profileId | Purpose |
|---|-----|-------|-----------|---------|
| 1 | room_air | source | source_mix | Room air (21% O₂, 78% N₂, 1% CO₂) to humans |
| 2 | mre | source | source_pure | Food: CH₂O at 2×0.84 = 1.68 mol/hr total |
| 3 | h2o_src | source | source_pure | Water: zero flow (empty jerricans) |
| 4 | air_return | sink | sink | Exhaled air returns to room |
| 5 | waste_snk | sink | sink | Urine/waste |
| 6 | scrub_in | splitter | splitter | Splits exhaled air: 50% recirculates to scrubber |
| 7 | lioh | membrane_separator | co2_scrubber | CO₂ removal with LiOH consumable |
| 8 | clean_return | sink | sink | Scrubbed air back to room |
| 9 | co2_waste | sink | sink | CO₂ retentate from scrubber |

Hmm, this is getting complex because we don't have a room tank to
close the loop. Let me simplify further.

---

# 3. Final Scene Topology (v15 — Minimal Viable)

## 3.1 Design Philosophy

The ineluctable scene must demonstrate:
1. Metabolic reaction works (CH₂O + O₂ → CO₂ + H₂O)
2. Kidney separates NH₃
3. LiOH scrubber depletes consumable
4. All flows are mass-balanced
5. Timeline can be derived from steady-state rates

It does NOT need to dynamically simulate 75 hours of depletion.
That requires TimeClock stepping with tank inventory, which is
a separate validation.

## 3.2 Topology

```
[Room Air Source]──→[Air Splitter]─┬──→[Human 1 feed_mix]←[Food Splitter]←[MRE Source]
  (N₂/O₂/CO₂       (50/50 to    │         ↓                    ↑
   at 288K)          each human)  │    [Metabolism 1]        (split 50/50
                                  │         ↓                 for 2 humans)
                                  │    [Kidney 1]
                                  │     perm→──┐
                                  │     ret→─[Waste Mix 1]←[Water Src 1]
                                  │              ↓
                                  │          [Waste Sink]
                                  │
                                  └──→[Human 2 feed_mix]←[Food Splitter]
                                           ↓                 (mat_out_2)
                                      [Metabolism 2]
                                           ↓
                                      [Kidney 2]
                                       perm→──┐
                                       ret→─[Waste Mix 2]←[Water Src 2]
                                                ↓
                                            [Waste Sink 2]
                                  
[Kidney 1 perm + Kidney 2 perm]
         ↓            ↓
      [Exhale Mixer]
            ↓
      [LiOH Scrubber]
       perm→[Clean Air Sink]  (represents air returning to room)
       ret→[CO₂ Waste Sink]
```

## 3.3 Complete Unit List (19 units)

| # | id | defId | profileId | Name | Key params |
|---|-----|-------|-----------|------|-----------|
| **Infrastructure** | | | | | |
| 1 | room_air | source | source_mix | Room Air | n:{N₂:0.131, O₂:0.035, Ar:0.002}, T:288, P:101325 |
| 2 | air_split | splitter | splitter | Air to Humans | splitPct: 50 |
| 3 | mre | source | source_pure | MRE Crate | species:CH₂O, nDot:0.000467, T:288, P:101325, phaseConstraint:V |
| 4 | food_split | splitter | splitter | Food to Humans | splitPct: 50 |
| 5 | exhale_mix | mixer | mixer | Exhaled Air | — |
| 6 | lioh | membrane_separator | co2_scrubber | LiOH Scrubber | targetSpecies:CO2, extractionFrac:0.99, consumable:{name:'LiOH Cartridges',capacity:268,remaining:268,maxRate:5} |
| 7 | clean_snk | sink | sink | Clean Air Return | — |
| 8 | co2_snk | sink | sink | CO₂ Retentate | — |
| **Human 1 (Kael)** | | | | | |
| 9 | h1_feed | mixer | mixer | Kael — Lungs | — |
| 10 | h1_metab | reactor_adiabatic | bio_metabolism | Kael — Metabolism | reactionId:R_METABOLISM, volume_m3:0.01, useKinetics:true |
| 11 | h1_kidney | membrane_separator | membrane_kidney | Kael — Kidney | targetSpecies:NH3, extractionFrac:0.99 |
| 12 | h1_water | source | source_pure | Kael — Water In | species:H₂O, nDot:0.000858, T:310, P:101325, phaseConstraint:L |
| 13 | h1_waste | mixer | mixer | Kael — Waste | — |
| 14 | h1_wsnk | sink | sink | Kael — Waste Out | — |
| **Human 2 (Vasquez)** | | | | | |
| 15 | h2_feed | mixer | mixer | Vasquez — Lungs | — |
| 16 | h2_metab | reactor_adiabatic | bio_metabolism | Vasquez — Metabolism | reactionId:R_METABOLISM, volume_m3:0.01, useKinetics:true |
| 17 | h2_kidney | membrane_separator | membrane_kidney | Vasquez — Kidney | targetSpecies:NH3, extractionFrac:0.99 |
| 18 | h2_water | source | source_pure | Vasquez — Water In | species:H₂O, nDot:0.000858, T:310, P:101325, phaseConstraint:L |
| 19 | h2_waste | mixer | mixer | Vasquez — Waste | — |
| 20 | h2_wsnk | sink | sink | Vasquez — Waste Out | — |

**Total: 20 units, ~24 connections.**

## 3.4 Connection List (24 connections)

| # | id | From unit | From port | To unit | To port |
|---|-----|-----------|-----------|---------|---------|
| **Air distribution** |
| 1 | c_air1 | room_air | mat_out | air_split | mat_in |
| 2 | c_air2 | air_split | mat_out_1 | h1_feed | mat_in_1 |
| 3 | c_air3 | air_split | mat_out_2 | h2_feed | mat_in_1 |
| **Food distribution** |
| 4 | c_food1 | mre | mat_out | food_split | mat_in |
| 5 | c_food2 | food_split | mat_out_1 | h1_feed | mat_in_2 |
| 6 | c_food3 | food_split | mat_out_2 | h2_feed | mat_in_2 |
| **Human 1 internal** |
| 7 | c_h1m | h1_feed | mat_out | h1_metab | mat_in |
| 8 | c_h1k | h1_metab | mat_out | h1_kidney | mat_in |
| 9 | c_h1w1 | h1_kidney | ret_out | h1_waste | mat_in_1 |
| 10 | c_h1w2 | h1_water | mat_out | h1_waste | mat_in_2 |
| 11 | c_h1ws | h1_waste | mat_out | h1_wsnk | mat_in |
| **Human 2 internal** |
| 12 | c_h2m | h2_feed | mat_out | h2_metab | mat_in |
| 13 | c_h2k | h2_metab | mat_out | h2_kidney | mat_in |
| 14 | c_h2w1 | h2_kidney | ret_out | h2_waste | mat_in_1 |
| 15 | c_h2w2 | h2_water | mat_out | h2_waste | mat_in_2 |
| 16 | c_h2ws | h2_waste | mat_out | h2_wsnk | mat_in |
| **Exhaled air collection** |
| 17 | c_ex1 | h1_kidney | perm_out | exhale_mix | mat_in_1 |
| 18 | c_ex2 | h2_kidney | perm_out | exhale_mix | mat_in_2 |
| **CO₂ scrubbing** |
| 19 | c_scrub | exhale_mix | mat_out | lioh | mat_in |
| 20 | c_clean | lioh | perm_out | clean_snk | mat_in |
| 21 | c_co2 | lioh | ret_out | co2_snk | mat_in |

**Total: 21 connections** (3 fewer than estimated — waste sinks
are terminal, no return path needed).

---

# 4. New Profiles Required

## 4.1 bio_metabolism

Reactor profile with biological temperature limits. The reactor
must operate at body temperature (310K). Standard reactor profiles
have T_LL=323K which would alarm at 310K.

```javascript
ProfileRegistry.register('bio_metabolism', {
  defId: 'reactor_adiabatic',
  name: 'Metabolism',
  category: UnitCategories.REACTOR,
  tiers: [1],
  limits: {
    1: {
      T_LL: 293,    // hypothermia
      T_L:  298,    // cold body
      T_H:  316,    // fever
      T_HH: 320,    // lethal hyperthermia
      P_LL: 50000,
      P_HH: 200000,
      mass_HH: 0.01   // tiny flows
    }
  },
  defaults: {
    reactionId: 'R_METABOLISM',
    useKinetics: true,
    volume_m3: 0.01
  },
  config: { composite: true }
});
```

## 4.2 bio_mixer

Generic mixer for biological composite internals. Wider T range
than standard mixer (accepts body temp 310K; standard T_LL=243K
is fine). Mark as composite to hide from palette.

```javascript
ProfileRegistry.register('bio_mixer', {
  defId: 'mixer',
  name: 'Body Mixer',
  category: UnitCategories.TOPOLOGY,
  tiers: [1],
  limits: {
    1: {
      T_LL: 273, T_HH: 350,
      P_LL: 50000, P_HH: 200000,
      mass_HH: 0.05
    }
  },
  config: { composite: true }
});
```

## 4.3 No other new profiles needed

- `membrane_kidney` already exists (composite:true) ✓
- `co2_scrubber` already exists (composite:true, with consumable) ✓
- `source_mix`, `source_pure`, `sink` — boundary profiles, no limits ✓
- `splitter`, `mixer` — standard profiles work for infrastructure ✓

---

# 5. Room Air Source Calibration

The room_air source represents the initial room atmosphere at
Planet X conditions (288K, 101325 Pa). The total flow must equal
what 2 humans breathe:

**Breathing rate:** ~6 L/min per person at rest = 0.168 mol/s
per person (ideal gas at 288K, 101325 Pa). Total for 2 people:
0.336 mol/s.

Actually — the source doesn't set total flow directly. It sets
per-species molar flow. The humans' feed_mixer combines air + food.
The reactor consumes O₂ and produces CO₂ + H₂O. The net air flow
through the system is set by the source.

**Calibration approach:** Set room_air source to provide enough
O₂ for 2 humans' metabolism plus excess N₂ for realistic
composition.

Per person: 0.84 mol/hr O₂ consumed. Two people: 1.68 mol/hr =
0.000467 mol/s O₂ consumed.

At 21% O₂, total air flow = 0.000467 / 0.21 = 0.00222 mol/s.
This is ~8 L/min — a realistic resting breathing rate for 2
people combined.

```javascript
room_air.params = {
  n: {
    N₂: 0.001754,  // 79%
    O₂: 0.000467,  // 21% (exactly consumed by metabolism)
    Ar: 0.0000089   // 0.4%
  },
  T: 288,
  P: 101325,
  phaseConstraint: 'V'
};
```

Wait — if ALL the O₂ is consumed, the exhaled air has 0% O₂.
Real exhaled air is ~16% O₂ (not all is consumed). But in our
model, R_METABOLISM equilibrium is K≈10^86, so conversion is
essentially 100%. The reactor consumes ALL available O₂.

This is correct for the CH₂O proxy model. The source provides
exactly the O₂ that's consumed. The exhaled air contains the
products (CO₂, H₂O) plus inert N₂. This is thermodynamically
consistent even if physiologically simplified.

**Alternative:** Provide excess air (more O₂ than consumed) and
let the reactor run at equilibrium (consuming only what
stoichiometry allows, limited by CH₂O). The food source provides
0.000233 mol/s CH₂O per person. At 1:1 stoichiometry, this limits
O₂ consumption to 0.000233 mol/s per person regardless of how
much O₂ is in the air.

**Better approach — excess air:**
```javascript
room_air.params = {
  n: {
    N2: 0.00584,    // 78%
    O2: 0.00157,    // 21% (3.4× excess over consumption)
    Ar: 0.0000075   // 1%
  },
  T: 288,
  P: 101325,
  phaseConstraint: 'V'
};
```

Total: 0.00749 mol/s = ~11 L/min for 2 people (5.5 L/min each,
realistic resting ventilation).

The reactor is CH₂O-limited (limiting reactant), consuming
0.000233 mol/s each of CH₂O and O₂ per person. Unreacted O₂
passes through. Exhaled air: reduced O₂, increased CO₂, plus
metabolic H₂O. ✓

---

# 6. MRE Source Calibration

The MRE crate provides CH₂O to both humans via food_split (50/50).

Total rate: 2 × 0.84 mol/hr = 1.68 mol/hr = 0.000467 mol/s.

```javascript
mre.params = {
  species: 'CH2O',
  nDot: 0.000467,
  T: 288,
  P: 101325,
  phaseConstraint: 'V'
};
```

MRE initial stock: 3000 mol CH₂O.
Runway: 3000 / 1.68 = 1786 hr = 74.4 days. Effectively infinite
for the ineluctable scenario (water and O₂ run out first).

---

# 7. Water Source — Empty Jerricans

Water jerricans are empty at Day 0. Set nDot = 0.

```javascript
h1_water.params = { species: 'H2O', nDot: 0, T: 310, P: 101325, phaseConstraint: 'L' };
h2_water.params = { species: 'H2O', nDot: 0, T: 310, P: 101325, phaseConstraint: 'L' };
```

With zero water intake, internal body water (350 mol/person)
depletes at net 3.09 mol/hr/person. Both humans die of dehydration
at: 350 / 3.09 = 113 hr ≈ 4.7 days.

Wait — the earlier derivation said 75 hr. Let me re-derive:

From COMPOSITE_MODELS §1.3:
- Total water loss: 3.93 mol/hr (1700 mL/day)
- Metabolic production: −0.84 mol/hr
- Net loss: 3.09 mol/hr
- Body water: 350 mol
- Time to death (15% loss = ~53 mol): 53/3.09 = 17 hr... that
  doesn't match either.

Actually re-reading §1.3: Death at 0% buffer level means all
350 mol depleted. 350/3.09 = 113 hr ≈ 4.7 days. The 75 hr figure
from the conversation may have used different assumptions.

**For the spec, use the COMPOSITE_MODELS §1.3 derivation:**
- WARNING at 67% (117 mol remaining): (350−117)/3.09 = 75 hr ✓
- CRITICAL at 10% (35 mol): (350−35)/3.09 = 102 hr
- DEATH at 0%: 350/3.09 = 113 hr ≈ 4.7 days

The 75 hr figure is the WARNING threshold (5% body water lost),
not death. **Death is at ~113 hr.**

**In the static solver scene:** Water source provides 0 flow.
The mixer (waste_mix) receives kidney retentate (NH₃ + some H₂O)
plus 0 from water source. Steady state shows the flow imbalance.

---

# 8. LiOH Scrubber

Uses existing `co2_scrubber` profile. Connected after exhale_mix.

The scrubber consumes LiOH sorbent at the rate CO₂ arrives:
2 humans × 0.84 mol/hr = 1.68 mol/hr CO₂.

LiOH capacity: 268 mol.
Runway: 268/1.68 = 159.5 hr ≈ 6.6 days.

When sorbent = 0: CO₂ passes through unabsorbed. Room CO₂ rises.
At 2% CO₂ (WARNING): cognitive impairment.
At 5% CO₂ (CRITICAL): lethal.

---

# 9. Timeline Summary (2 people, no player action)

| Event | Time | Limiting factor |
|-------|------|----------------|
| Water WARNING (5% body loss) | ~75 hr (3.1 days) | Body water reserve |
| Water DEATH (0% body water) | ~113 hr (4.7 days) | Body water reserve |
| LiOH exhaustion | ~160 hr (6.6 days) | Sorbent capacity |
| CO₂ lethal (5%) in room | ~165 hr (6.9 days)* | Room volume + CO₂ rate |
| O₂ WARNING | — | Not modeled (source, not reservoir) |

*CO₂ timeline requires room-as-tank (dynamic). Estimated from:
room volume 50m³ → 2044 mol air. CO₂ accumulation after LiOH
exhausted: 1.68 mol/hr. Time to 5%: 0.05×2044/1.68 = 61 hr
after LiOH runs out = ~221 hr total. This matches the
conversation derivation (~222 hr).

---

# 10. Scene Layout (Grid Coordinates)

Target: visually clean left-to-right flow on the PTIS grid.

```
Y=-6:  [MRE Source] → [Food Split]
Y=-4:                    ├──→ H1 row
Y=-2:  [Room Air] → [Air Split]
Y= 0:                    ├──→ H1 feed → H1 metab → H1 kidney ──→┐
Y= 2:                    │                              │         │
Y= 4:                    │    H1 waste ← H1 waste_mix ←┘         │
Y= 6:                    │         ↓ [H1 Waste Sink]             │
Y= 8:                    └──→ H2 feed → H2 metab → H2 kidney ──→│
Y=10:                                                    │        │
Y=12:                         H2 waste ← H2 waste_mix ←┘        │
Y=14:                              ↓ [H2 Waste Sink]             │
Y=16:                                                             │
Y=18:                    [Exhale Mix] ← ──────────────────────────┘
Y=20:                         ↓
Y=22:                    [LiOH Scrubber]
Y=24:                     ↓ perm       ↓ ret
Y=26:               [Clean Sink]   [CO₂ Sink]
```

Approximate X coordinates: source at x=0, splits at x=6,
human rows at x=12–24, collection at x=12, scrubber at x=16.

---

# 11. DemoScenes Registration

```javascript
DemoScenes.register('demo_ineluctable',
  'Ineluctable Fate — 2 Colonists, Day 0 Depletables',
  JSON.stringify(sceneData)
);
```

The scene JSON follows the same format as demo_v1. Key differences:
- `settings.atmospherePreset: 'planet_x'`
- `settings.dt: 3600` (1-hour timestep)
- `processName: 'Ineluctable Fate — Day 0'`

On load, the default example should be changed to load
`demo_ineluctable` instead of `demo_v1`. The player can still
load `demo_v1` from the Examples menu.

---

# 12. New Profile Registrations (Code)

Two new profiles, both `composite: true`:

```javascript
// ── [v15.0.0] Biosphere-internal profiles ──
ProfileRegistry.register('bio_metabolism', {
  defId: 'reactor_adiabatic',
  name: 'Metabolism',
  category: UnitCategories.REACTOR,
  tiers: [1],
  limits: { 1: {
    T_LL: 293, T_L: 298, T_H: 316, T_HH: 320,
    P_LL: 50000, P_HH: 200000, mass_HH: 0.01
  }},
  defaults: { reactionId: 'R_METABOLISM', useKinetics: true, volume_m3: 0.01 },
  config: { composite: true }
});

ProfileRegistry.register('bio_mixer', {
  defId: 'mixer',
  name: 'Body Mixer',
  category: UnitCategories.TOPOLOGY,
  tiers: [1],
  limits: { 1: {
    T_LL: 273, T_HH: 350,
    P_LL: 50000, P_HH: 200000, mass_HH: 0.05
  }},
  config: { composite: true }
});
```

---

# 13. Tests

## 13.1 Profile registration tests

```
536: v15 — bio_metabolism profile registered, composite:true
537: v15 — bio_mixer profile registered, composite:true
538: v15 — bio profiles excluded from palette listing
```

## 13.2 Scene topology tests

```
539: v15 — demo_ineluctable registered in DemoScenes
540: v15 — demo_ineluctable loads and solves without error
541: v15 — demo_ineluctable unit count (20 units)
542: v15 — demo_ineluctable connection count (21 connections)
```

## 13.3 Metabolic rate validation

```
543: v15 — H1 metabolism: CO₂ production ≈ 0.000233 mol/s
544: v15 — H1 metabolism: O₂ consumed ≈ 0.000233 mol/s
545: v15 — Exhale mixer: total CO₂ ≈ 0.000467 mol/s (2 humans)
546: v15 — LiOH scrubber: CO₂ removal ≈ 99%
547: v15 — Mass balance: total in ≈ total out (within 0.1%)
```

---

# 14. Implementation Phases

## Phase A — Profiles + Scene JSON (this session)
1. Register `bio_metabolism` and `bio_mixer` profiles
2. Construct scene JSON with 20 units + 21 connections
3. Register as `demo_ineluctable`
4. Change default load to `demo_ineluctable`
5. Run solver — fix any issues

## Phase B — Tests (same or next session)
1. Add tests 536–547
2. Validate metabolic rates match spec
3. Validate mass balance

## Phase C — Timeline Validation (future, requires TimeClock)
1. Convert body buffers to tanks with inventory
2. Step scene for 75+ hours
3. Validate dehydration timeline
4. Validate CO₂ buildup timeline

---

# 15. Open Questions for Denis

1. **Default scene on load.** Change `loadExample('demo_v1')` to
   `loadExample('demo_ineluctable')`? Or keep demo_v1 as default
   and add a second menu entry? (Spec assumes: change default.)

2. **DEMO_VERSION bump.** Currently `'v14.10.5'`. Bump to
   `'v15.0.0'` so existing auto-saves don't conflict?

3. **Water source at nDot=0.** A source with zero flow may cause
   the mixer to receive only one input. Is this handled? (Need to
   verify mixer behavior with zero-flow input.)

4. **Membrane_kidney profile.** Currently has
   `defaults: { 1: { targetSpecies: 'NH3', ... } }`. The human's
   reactor produces negligible NH₃ (R_METABOLISM doesn't produce
   NH₃). Should kidney simply pass everything through (no NH₃ in
   feed → no separation needed)? Or should we add trace NH₃ to
   the food source as a gameplay element?

5. **Splitter at 50%.** Default `splitPct: 15` for purge/recycle.
   Need to set `splitPct: 50` for equal distribution. Verify
   splitter param name.

---

# 16. Cross-References

| Topic | Source |
|-------|--------|
| Human composite 11-unit model | PTIS_COMPOSITE_MODELS §1.2 |
| Simplified to 6 units | This document §2.2 |
| Metabolic rate 0.84 mol/hr | PTIS_BIOSPHERE_POWER §2.1 |
| R_METABOLISM registration | processThis.html v15.0.0 |
| CH₂O species data | processThis.html v15.0.0 |
| Day-0 depletables | PTIS_COMPOSITE_MODELS §4.1 |
| Dehydration timeline | PTIS_COMPOSITE_MODELS §1.3 |
| CO₂ poisoning timeline | Conversation derivation |
| LiOH scrubber | PTIS_COMPOSITE_MODELS §4.2 |
| Planet X atmosphere (288K) | PTIS_SURVIVAL_ARC_REFERENCE |
