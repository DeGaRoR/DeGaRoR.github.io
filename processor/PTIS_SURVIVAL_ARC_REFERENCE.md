# PTIS Survival Arc — Consolidated Reference
## M1–M5 canonical values, ineluctable fate scenario, implementation plan
### March 2026

---

> **Scope.** This document locks down the numbers for the survival arc
> (Phase 1, missions M1–M5). It resolves inconsistencies between
> PTIS_GAME_DESIGN, PTIS_MISSION_DESIGN_V2, PTIS_COMPOSITE_MODELS,
> PTIS_PURITY_AND_VENT_DESIGN, and PTIS_BIOSPHERE_POWER_RECONCILIATION.
>
> M6+ is the "food ark" and is explicitly deferred.
>
> **Authority chain:** Where documents conflict, this document wins
> for M1–M5 values. It draws primarily from COMPOSITE_MODELS (human
> model), PURITY_AND_VENT (alarm thresholds, vent composition), and
> BIOSPHERE_POWER_RECONCILIATION (metabolic rates).

---

# 1. Locked Planet Parameters

| Parameter | Value | Source | Notes |
|-----------|-------|--------|-------|
| Surface temperature | **288 K (15°C)** | GAME_DESIGN §9, confirmed | Low T enables CO₂ condensation at M5 |
| Surface pressure | 89,750 Pa (0.885 atm) | GAME_DESIGN §9 | |
| Atmosphere | 70% N₂, 21% O₂, 8% CO₂, 1% Ar | GAME_DESIGN §9 | |
| Air cooler approach | 10 K | MISSION_V2 §M1 | Air cooler outlet = 298 K |
| CO₂ critical point | 304.2 K, 73.8 bar | Physical constant | 298 K < 304.2 K → subcritical condensation works |

**Resolution:** GAME_DESIGN said 288 K. MISSION_V2 used 305 K in
some paragraphs (M1, M6 descriptions). **288 K is canonical.** The
305 K references in MISSION_V2 are superseded.

**Consequence:** At 288 K ambient + 10 K approach = 298 K at the air
cooler outlet. CO₂ can be condensed at ~80 bar since 298 K < Tc.
This enables the elegant thermodynamic M5 path (compress → cool →
flash) alongside the membrane path, preserving player choice.

Room heating: UA_wall × (T_room − T_amb) = 50 × (293 − 288) = 250 W.
Two humans produce 242 W. Room barely self-heats. Feels cold,
desperate. At 7 people (847 W), surplus heat → need to vent. Good
progression.

---

# 2. Human Metabolic Rates (Locked)

Source: BIOSPHERE_POWER_RECONCILIATION §2.1.

Basis: 2500 kcal/day/person (NASA moderate activity).
Reaction: R_METABOLISM: CH₂O + O₂ → CO₂ + H₂O, ΔH = −519.4 kJ/mol.

| Parameter | Per person/hr | 2 people/hr | Unit |
|-----------|-------------|------------|------|
| CH₂O consumed (food) | 0.84 | 1.68 | mol/hr |
| O₂ consumed | 0.84 | 1.68 | mol/hr |
| CO₂ produced | 0.84 | 1.68 | mol/hr |
| H₂O produced (metabolic) | 0.84 | 1.68 | mol/hr |
| Drinking water consumed | 7.0 | 14.0 | mol/hr |
| Metabolic heat | 121 | 242 | W |

Metabolic heat emerges from the reactor energy balance (adiabatic
reactor, ΔH × ξ), not a separate parameter.

---

# 3. Day-0 Depletable Supplies (Locked)

Source: COMPOSITE_MODELS §4.1 (authoritative, supersedes MISSION_V2 §16).

| Supply | Unit type | Inventory | Rate (2 ppl) | Runway |
|--------|-----------|-----------|-------------|--------|
| Water jerricans | tank (liquid) | **0 mol (EMPTY)** | — | **0 — M1 urgent** |
| O₂ bottles | reservoir (gas) | 300 mol @ 150 bar | 1.68 mol/hr | **7.4 days** |
| LiOH cartridges | membrane_separator (depletable) | 268 mol CO₂ capacity | 1.68 mol/hr | **6.6 days** |
| MRE crate | reservoir (gas CH₂O) | 3,000 mol | 1.68 mol/hr | **74 days** |
| Battery | battery | 75 kWh | ~200 W base load | **15.6 days** |

**Water at zero** is the design decision that makes M1 immediately
urgent. The player has no grace period on water.

**LiOH scrubber mechanics:** membrane_separator with
`selectivity: { CO2: 0.01 }` (99% CO₂ to retentate). Finite
`sorbentCapacity: 268` mol. When sorbent reaches 0, selectivity
drops to 0 — CO₂ passes through unabsorbed. This uses the existing
membrane_separator with its consumable/sorbent tracking.

**O₂ bottles:** A reservoir with finite inventory. When inventory
reaches 0, flow stops. Existing reservoir physics — pressure drops
as gas is withdrawn, flow via Cv valve, no flow when P_reservoir
approaches P_downstream. The 300 mol at 150 bar in a small vessel
(~0.005 m³) gives high starting pressure that declines as gas is
withdrawn.

**MRE crate:** A reservoir containing 3000 mol gaseous CH₂O. Yes,
it's a stretch (formaldehyde gas in a tank), but the thermodynamics
are consistent and the species is inside a locked composite — the
player never sees "food flowing through a pipe" directly.

**Battery:** 75 kWh, ~200 W base load (lighting, comms, fan on
human composite, LiOH scrubber fan). 15.6 days at 200 W. The
electrolyzer (M2) accelerates battery drain significantly.

---

# 4. Room (Shelter)

Source: COMPOSITE_MODELS §3.

| Parameter | Value | Notes |
|-----------|-------|-------|
| Volume | 50 m³ | Sealed hangar section |
| Initial atmosphere | 21% O₂, 79% N₂ | Earth-normal air sealed in at crash |
| Initial T | 293 K | Slightly above ambient (residual hull heat) |
| Initial P | 101,325 Pa | Standard atmosphere |
| UA_wall | 50 W/K | Uninsulated metal hull |
| n_total (initial) | PV/RT = 50 × 101325 / (8.314 × 293) ≈ **2080 mol** |
| n_O₂ (initial) | 0.21 × 2080 ≈ **437 mol** |
| n_N₂ (initial) | 0.79 × 2080 ≈ **1643 mol** |

Ports: air_supply (IN), o2_supply (IN), water_supply (IN),
exhaust (OUT), elec_in (IN).

The room is a tank. Its existing physics (inventory tracking,
pressure computation, enthalpy accounting on material streams)
handles everything. The new behavior is alarm-checking on
composition each tick — see §6.

---

# 5. Vent Sources (M1–M5)

Source: PURITY_AND_VENT_DESIGN §4.2 (authoritative, supersedes
COMPOSITE_MODELS §6 which had old 4-species composition).

### Vent 1 (Primary — hangar floor, Day 0)

| Parameter | Value |
|-----------|-------|
| T | 500 K |
| P | 3.0 bar |
| Cv | 0.5 |

| Species | mol% |
|---------|------|
| H₂O | 30 |
| CO₂ | 28 |
| N₂ | 18 |
| CH₄ | 10 |
| H₂ | 7 |
| CO | 2 |
| NH₃ | 3 |
| Ar | 2 |

### Vent 2 (Jin's discovery, accessible M4+)

Same composition, T = 500 K, P = 4.0 bar, Cv = 1.2.

### Flash at 298 K (air cooler outlet at 288 K ambient + 10 K)

Approximate condensate (liquid phase from flash drum):
- ~96% H₂O, ~3% NH₃, ~0.8% CO₂, traces of everything else
- NH₃ triggers WARNING (>0.05%) on water quality if piped to room
- Soft lesson: buffer tank catches it, player learns about contamination

Approximate vapor overhead:
- CO₂ dominant (~35–40%), N₂ (~25%), CH₄ (~14%), H₂ (~10%),
  CO (~3%), Ar (~3%), H₂O (~5% vapor pressure), NH₃ (reduced)

Exact split computed by Peng-Robinson VLE in the flash drum tick.

---

# 6. Air Quality Alarm Thresholds (Locked for M1–M5)

Source: PURITY_AND_VENT_DESIGN §2 (authoritative, supersedes
MISSION_V2 §16 and ROADMAP_V2 which had earlier draft values).

| Species | NOMINAL | WARNING | MAJOR | CATASTROPHIC |
|---------|---------|---------|-------|--------------|
| O₂ | 19.5–23.5% | 18.0–19.5% | 16.0–18.0% | <14.0% |
| CO₂ | <0.5% | 0.5–1.5% | 1.5–3.0% | >5.0% |
| CO | <0.001% | 0.001–0.005% | 0.005–0.02% | >0.04% |
| NH₃ | <0.0003% | 0.0003–0.003% | 0.003–0.03% | >0.05% |
| CH₄ | <0.5% | 0.5–1.0% | 1.0–2.5% | >5.0% |
| H₂ | <0.4% | 0.4–1.0% | 1.0–2.0% | >4.0% |

### Water Quality

| Species | NOMINAL | WARNING | MAJOR |
|---------|---------|---------|-------|
| H₂O purity | >99.5% | 98–99.5% | <98% |
| NH₃ | <0.05% | 0.05–0.5% | >0.5% |
| CO₂ dissolved | <0.5% | 0.5–2% | >2% |

---

# 7. Human Composite — Full Model (11 Units)

Source: COMPOSITE_MODELS §1.2. No simplification. All units exist
in the engine today.

```
air_in → [fan] → [air_splitter]
             ├── 8% → [air_buffer] → [feed_mixer] ← [food_buffer] ← food_in
             │                             ↓
             │                        [metabolism]  (reactor_adiabatic, R_METABOLISM)
             │                             ↓
             └── 92% ──────→ [body_hex]  (cold side: bypass air)
                              (hot side: metabolism products)
                                  ↓ hot_out         ↓ cold_out
                              [kidney]           [air_mixer]
                              (membrane,              ↓
                               NH₃→retentate)      air_out
                                  ↓ ret_out
water_in → [water_buffer] → [waste_mixer]
                                  ↓
                              waste_out
```

| # | localId | defId | Key params |
|---|---------|-------|-----------|
| 1 | fan | compressor | P_ratio: 1.001, ~1W |
| 2 | air_splitter | splitter | splitPct: 8 |
| 3 | air_buffer | tank | 0.005 m³/pp, 310K, 1 atm |
| 4 | food_buffer | tank | 0.012 m³/pp, gas CH₂O |
| 5 | feed_mixer | mixer | — |
| 6 | metabolism | reactor_adiabatic | R_METABOLISM |
| 7 | body_hex | hex | UA: scaled per pop |
| 8 | kidney | membrane_separator | { NH3: 0.01 } |
| 9 | air_mixer | mixer | — |
| 10 | water_buffer | tank | 0.0063 m³/pp, liquid H₂O |
| 11 | waste_mixer | mixer | — |

5 boundary ports: air_in, food_in, water_in, air_out, waste_out.

For 2 people: double all buffer volumes and flow targets.

---

# 8. Biological Buffer Alarm Envelopes

Source: COMPOSITE_MODELS §1.3.

### Air Buffer (lungs — O₂ depletion if supply cut)

| Threshold | Time from supply cut |
|-----------|---------------------|
| WARNING | ~3 min |
| ERROR | ~4.5 min |
| CRITICAL | ~5.5 min |
| Death | ~6 min |

### Water Buffer (dehydration if supply cut)

| Threshold | Buffer level | Time |
|-----------|-------------|------|
| Normal | >67% | — |
| WARNING | 67% | ~36 hr (1.5 days) |
| ERROR | 33% | ~54 hr (2.3 days) |
| CRITICAL | 10% | ~68 hr (2.8 days) |
| Death | 0% | ~75 hr (3.1 days) |

### Food Buffer (starvation if supply cut)

| Threshold | Buffer level | Time |
|-----------|-------------|------|
| Normal | >80% | — |
| WARNING | 80% | ~4.2 days |
| ERROR | 50% | ~10.5 days |
| CRITICAL | 20% | ~16.8 days |
| Death | 0% | 21 days |

---

# 9. The Ineluctable Fate Scenario

## 9.1 Purpose

Two humans in a sealed room with finite supplies. No external
processes. Everything runs out. We validate:

1. Depletion timescales match real biology
2. Alarm thresholds trigger in the right order
3. Cause of death is identifiable
4. Game time is on the order of days

## 9.2 Setup

```
[O₂ bottles] ──→ Room (air_supply)
                   ↕
              [Human × 2] ←── [MRE crate] (food_in)
                   ↕              ←── [Water tank EMPTY] (water_in)
              [LiOH scrubber]
                   ↓
              (CO₂ to waste / atmosphere)
[Battery] ──→ Room (elec_in) + Human fan
```

The room air recirculates through the human composite:
- Room.exhaust → Human.air_in
- Human.air_out → Room.air_supply (returns warm, CO₂-enriched air)
- O₂ bottles → Room.o2_supply (makeup O₂)
- LiOH scrubber sits between room exhaust and human intake
  (or on a room exhaust bypass loop)

## 9.3 Expected Death Sequence

**Water kills first.**

| Time | Event | System |
|------|-------|--------|
| Hour 0 | Scenario starts | All nominal |
| Hour 36 (Day 1.5) | Water WARNING | 5% body water lost |
| Hour 54 (Day 2.3) | Water ERROR | 10% body water lost |
| Hour 68 (Day 2.8) | Water CRITICAL | 13.5% body water lost |
| **Hour 75 (Day 3.1)** | **DEATH: Dehydration** | Water buffer empty |

If we give them a small water reserve (say 200 mol in the
jerricans instead of 0), the timeline extends and CO₂ becomes
the killer:

| Time | Event | System |
|------|-------|--------|
| Hour 0 | Start | All nominal |
| Hour ~65 (Day 2.7) | Water WARNING | With 200 mol reserve |
| Hour 160 (Day 6.6) | LiOH exhausted | Sorbent = 0 |
| Hour 166 (Day 6.9) | CO₂ WARNING (0.5%) | Accumulating |
| Hour 178 (Day 7.4) | O₂ bottles empty | 300 mol consumed |
| Hour 179 (Day 7.5) | CO₂ MAJOR (1.5%) | 18 hr after scrubber death |
| Hour ~200 (Day 8.3) | Water DEATH | 200 mol reserve depleted |
| Hour 222 (Day 9.2) | CO₂ CATASTROPHIC (5%) | 62 hr after scrubber |
| Hour 265 (Day 11.0) | O₂ CATASTROPHIC (14%) | Room O₂ depleted |

**CO₂ kills before O₂ runs out.** This is physically realistic —
in a sealed room, CO₂ accumulation is the primary killer.

## 9.4 Validation Criteria

| Check | Expected | Tolerance |
|-------|----------|-----------|
| Water buffer reaches 0 | ~75 hr (0 reserve) | ±5 hr |
| O₂ bottles exhausted | ~178 hr | ±10 hr |
| LiOH sorbent exhausted | ~160 hr | ±10 hr |
| CO₂ reaches 0.5% after scrubber death | ~6 hr | ±2 hr |
| CO₂ reaches 5% after scrubber death | ~62 hr | ±10 hr |
| Room T trend | Slow decline toward 288 K | Monotonic |
| Metabolic heat in room | ~242 W via warm air_out | ±20 W |
| Food buffer depletion rate | 1.68 mol/hr | ±0.1 |
| Total O₂ consumption rate | 1.68 mol/hr | ±0.1 |

---

# 10. Implementation Plan

## 10.1 New Registrations (Cherry-picks from S9)

**CH₂O species:**

```javascript
ComponentRegistry.register('CH2O', {
  name: 'Formaldehyde',
  MW: 30.026,      // 12.011 + 2×1.008 + 15.999
  Tc: 408.0,       // K (NIST)
  Pc: 6590000,     // Pa (65.9 bar, NIST)
  omega: 0.282,    // Pitzer acentric factor
  Tb: 254.0,       // K (−19°C, gas at room T)
  phase298: 'gas',
  Hf0: -115900,    // J/mol, standard enthalpy of formation (gas)
  Cp_coeff: [...]  // NASA polynomial or use ideal gas Cp
});
```

**R_METABOLISM reaction:**

```javascript
ReactionRegistry.register('R_METABOLISM', {
  equation: 'CH2O + O2 → CO2 + H2O',
  species: {
    CH2O: -1, O2: -1, CO2: +1, H2O: +1
  },
  dH0_Jmol: -519400,  // exothermic (−519.4 kJ/mol)
  reversible: false,
  Keq: () => 1e50      // effectively irreversible at 310 K
});
```

## 10.2 Wiring the Scenario (Test or Demo Scene)

Place 17 units + 1 battery:

**Room:** 1× tank (50 m³, 21% O₂ / 79% N₂, 293 K, 1 atm)

**Human composite (11 units):**
fan, air_splitter, air_buffer, food_buffer, feed_mixer,
metabolism, body_hex, kidney, air_mixer, water_buffer, waste_mixer

**Depletable supplies (4 units):**
- O₂ bottles: 1× reservoir (300 mol, 150 bar, pure O₂)
- LiOH scrubber: 1× membrane_separator (consumable: 268 mol)
- MRE crate: 1× reservoir (3000 mol CH₂O gas)
- Water jerricans: 1× tank (empty, or small reserve for variant)

**Power:** 1× battery (75 kWh)

**Waste:** 1× sink (for waste_out and LiOH retentate)

Total: ~18 units, ~20 connections.

## 10.3 Build Sequence

| Step | What | Depends on |
|------|------|-----------|
| 1 | Register CH₂O species | Nothing |
| 2 | Register R_METABOLISM reaction | CH₂O species |
| 3 | Write test: place all 18 units + wire | Steps 1–2 |
| 4 | Solve one tick, verify mass balance | Step 3 |
| 5 | Run N ticks, verify depletion rates | Step 4 |
| 6 | Run to dehydration death, check timing | Step 5 |
| 7 | Run to CO₂ death variant, check timing | Step 5 |
| 8 | Add room composition alarms | Steps 5–7 validated |

Steps 1–2 are ~30 lines of registration code.
Step 3 is a test function (like existing T-series tests).
Steps 4–7 are assertions on that test.
Step 8 is the room alarm infrastructure (separate task, post-validation).

## 10.4 What We Do NOT Build Yet

- S8 GroupTemplateRegistry (UI chrome for composites)
- S10 mission framework (briefings, stars, palette scarcity)
- Vent processes (M1–M5 actual player-built processes)
- Room alarm UI (gauges on wall)
- Depletable → sustainable transition logic
- Buffer tank design pattern
- Vasquez dialogue system
- Anything M6+

The ineluctable fate scenario validates the PHYSICS. Once the
timescales check out, we build the game on top.

---

# 11. Missions M1–M5 Quick Reference

For context only — not building these yet. Locked values from
MISSION_DESIGN_V2, updated for 288 K.

| # | Mission | Player builds | Key physics |
|---|---------|--------------|-------------|
| M1 | Water | Vent → air cooler → flash drum → tank | Condensation at 298 K. NH₃ contamination. |
| M2 | Oxygen | Water tank → electrolyzer → O₂ buffer → room | Electrolysis. Battery drain. |
| M3 | Fuel | H₂ + CO₂ → Sabatier → flash → CH₄ tank + H₂O recycle | First recycle loop. |
| M4 | Power | Air → compressor → combustor → gas turbine → exhaust | Brayton cycle. Net power. |
| M5 | CO₂ Scrub | Atmosphere → compress → cool → flash (or membrane) → clean air | **Boss fight.** CO₂ condensation at 298 K < 304 K. System integration. |

Population: 2 (Kael + Vasquez) through M3. +Jin at M4 → 3 for M5.

---

# 12. Stale References — What's Superseded

| Document | Stale content | Superseded by |
|----------|--------------|---------------|
| GAME_DESIGN §9 | T = 288 K is correct, but some M5 text implies 305 K | This document: 288 K locked |
| MISSION_V2 §M1 | "305 K", "315 K outlet" | This document: 288 K, 298 K outlet |
| MISSION_V2 §M6 | "305 K (32°C)" | This document: 288 K |
| MISSION_V2 §16 | Depletable table (800 mol water, 500 mol O₂, etc.) | COMPOSITE_MODELS §4.1 (0 mol water, 300 mol O₂) |
| COMPOSITE_MODELS §6 | Vent composition (4-species) | PURITY_AND_VENT §4.2 (10-species) |
| COMPOSITE_MODELS §1.5 | Population day numbers | MISSION_V2 §18 (mission numbers authoritative) |
| ROADMAP_V2 | CO₂ WARNING >1%, MAJOR >3% | PURITY_AND_VENT §2.1 (WARNING 0.5–1.5%, MAJOR 1.5–3%) |
| ROADMAP_V2 | "Amara+Tomás at M6" | MISSION_V2: M7 |
