# PTIS Biosphere Power Reconciliation
## Spec Amendments: S6, S7b, S8

---

## 1. The Problem

Three specs give contradictory numbers for the biosphere energy
budget:

| Source | Metabolic rate | Population | Efficiency | Power |
|--------|---------------|-----------|-----------|-------|
| S8 spec (current) | 0.34 mol CH₂O/hr/person | 6 | not specified | not computed |
| Biosphere validation (past chat) | 0.947 mol/hr/person | 6 | 1% | 82 kW |
| S7b greenhouse template (draft) | not specified | — | 28% | ~3 kW implied |

The S8 metabolic rate (0.34 mol/hr) gives only 1013 kcal/day — a
starvation diet. The S7b template's 28% efficiency is the theoretical
photosynthetic quantum yield, not the electricity-to-food chain. And
the validated 82 kW assumed 6 people, but M10 population is 7.

Additionally, the S6 efficiency parameter has an inspector floor of
0.30 (30%), which blocks setting the physically correct 1% for
greenhouse lighting.

---

## 2. Derivation from First Principles

### 2.1 Metabolic Rate

**Basis:** 2500 kcal/day/person (NASA moderate-activity planning
value for crewed missions).

**Reaction:** R_METABOLISM: CH₂O + O₂ → CO₂ + H₂O, ΔH = −519.4 kJ/mol

```
Energy per day:   2500 kcal × 4.184 kJ/kcal = 10,460 kJ/day
Reaction extent:  10,460 / 519.4 = 20.14 mol/day = 0.839 mol/hr
```

Round to **0.84 mol/hr/person**. All four species share this rate
(1:1:1:1 stoichiometry).

| Parameter | Per person/hr | 7 people/hr | Unit |
|-----------|--------------|------------|------|
| CH₂O consumed | 0.84 | 5.88 | mol/hr |
| O₂ consumed | 0.84 | 5.88 | mol/hr |
| CO₂ produced | 0.84 | 5.88 | mol/hr |
| H₂O produced (metabolic) | 0.84 | 5.88 | mol/hr |
| Drinking water consumed | 7.0 | 49.0 | mol/hr |
| Metabolic heat | 121 | 847 | W |

**Metabolic heat derivation:** ξ × |ΔH| = (0.84/3600) × 519,400 =
121 W/person. This emerges automatically from the reactor energy
balance — not a separate parameter.

**Drinking water:** 3.0 kg/day/person = 167 mol/day = 7.0 mol/hr
(NASA minimum for survival — excludes hygiene). Exits through
waste_out.

**Comparison to NASA data (HIDH Table 6.2.1):**

| Parameter | Our model | NASA | Ratio | Notes |
|-----------|----------|------|-------|-------|
| O₂ consumption | 645 g/day | 840 g/day | 0.77 | RQ=1.0 simplification |
| CO₂ production | 888 g/day | 1000 g/day | 0.89 | Consistent |
| Food energy | 2500 kcal | 2500 kcal | 1.00 | Anchored to this |
| Metabolic heat | 121 W | ~120 W | 1.01 | Excellent match |

The O₂ rate being 23% low is a known consequence of the CH₂O proxy
(all-carbohydrate diet has lower O₂ demand per calorie than a mixed
diet because real metabolism also oxidizes fats, RQ ≈ 0.7). The mass
balance closes exactly, and the power budget — which depends on food
energy, not O₂ — is correct.

### 2.2 Greenhouse Power

**Reaction:** R_PHOTOSYNTHESIS: CO₂ + H₂O → CH₂O + O₂, ΔH = +519.4 kJ/mol

At steady state, the greenhouse must fix CO₂ at the same rate
humans produce it.

```
For 7 people:
  ξ = 5.88 mol/hr = 0.001633 mol/s
  Q_thermodynamic_min = ξ × ΔH = 0.001633 × 519,400 = 848 W
```

**Lighting efficiency chain:**
```
Electricity → LED (50% → PAR) → Photosynthesis (2% of PAR → chemical)
Overall:  η ≈ 1% of electrical input → food energy
```

```
At η = 0.01 (1%):   P_greenhouse = 848 / 0.01 = 84,800 W ≈ 85 kW
At η = 0.02 (2%):   P_greenhouse = 848 / 0.02 = 42,400 W ≈ 42 kW
At η = 0.005 (0.5%): P_greenhouse = 848 / 0.005 = 169,600 W ≈ 170 kW
```

**Cross-validation against NASA literature (from biosphere
validation session):**

| Method | LED (mid) | LED (best) |
|--------|----------|-----------|
| BPC CO₂ scaling | 162 kW | 39 kW |
| Area × power density | 150 kW | 60 kW |
| kWh/g × production | 171 kW | 106 kW |
| Our model (η=1%) | — | 85 kW |

Our 85 kW sits at the optimistic end of best-case targeted LED
technology (NASA 2014 close-canopy study). This is physically
honest — bleeding edge but not fictional.

### 2.3 Waste Heat

At η = 0.01, the greenhouse dumps 99% of input as waste heat:
```
Q_waste = P_greenhouse × (1 − η) = 85,000 × 0.99 = 84,150 W ≈ 84 kW
```

This completely dominates the colony's thermal budget. The 847 W
of human metabolic heat is negligible by comparison. The
engineering challenge is cooling the greenhouse, not the humans.

### 2.4 Corrected Power Budget (M10)

| Load | Power (kW) | Notes |
|------|-----------|-------|
| Greenhouse (η=1%) | 85.0 | Dominant load |
| Compressors (air processing) | 4.0 | CO₂ scrubbing train |
| Heat pump (shelter heating) | 0.7 | From M6 |
| Haber synthesis | 0.7 | NH₃ makeup for fertilizer |
| Electrolyzer (O₂ backup) | 1.0 | Emergency top-up |
| Water recycling | 0.5 | Pump + distillation |
| Baseline (lighting, comms) | 0.2 | From M1 |
| **Total** | **~92** | |

Previous estimate: 82 kW (6 people). Corrected: **~92 kW (7 people)**
at η = 1%.

---

## 3. M10 Power Supply Resolution

### The Constraint

The S-size gas turbine produces ~20 kW net per combined cycle
(2 compressors at 0.05 kg/s each → 0.10 kg/s through turbine,
Brayton net ~15 kW + Rankine ~5 kW). The player needs **5 combined
cycles** to reach ~100 kW capacity.

Each combined cycle requires: 2× compressor, 1× reactor_equilibrium
(combustor), 1× gas_turbine, 1× HEX (HRSG), 1× steam_turbine,
1× pump, plus sources and sinks for fuel/air/exhaust. That's 8
process units per train.

### The Resolution

**M10 unlocks fabrication.** Narratively: "The engineering team
has restored the ship's fabrication workshop. You can now
manufacture copies of any equipment you've built before."

Mechanically: all equipment quantity limits are removed in M10.
The palette shows every previously available defId with unlimited
count (∞ badge). New equipment exclusive to M10: greenhouse ×1,
human ×1, room ×1 (if not already available).

**S7b makes this manageable.** The player:
1. Already has one combined cycle from M8
2. Saves it as a group template ("Power Block")
3. Instantiates 4 more from the palette
4. Connects fuel, air, and electrical distribution
5. The PFD shows 5 collapsed "Power Block" boxes + greenhouse + human

Without S7b, building 5× (8 units each) = 40 units on a flat
canvas would be unmanageable. With S7b, it's 5 group boxes plus
the biosphere loop — clean and navigable.

**Fuel supply:** The vent provides sufficient CH₄. At 20 kW net
per combined cycle (35% combined efficiency), each cycle burns:
```
P_thermal = 20,000 / 0.35 = 57,100 W
ṁ_CH₄ = 57,100 / 803,000 = 0.071 mol/s per cycle
5 cycles: 0.355 mol/s total CH₄
```
0.355 mol/s = 5.7 g/s — a modest geological vent output. M10
specifies the vent has sufficient capacity (or provides a second
vent source).

### Stars Redesign

| Star | Criterion | Teaching |
|------|----------|---------|
| ★ | All conditions maintained 1 hour | Basic integration |
| ★★ | Sustain 4 hours continuously | Steady-state stability |
| ★★★ | Wastewater recycle (≥50% water recovery) | Closed-loop design |

---

## 4. Spec Amendments

### 4.1 S6 — Electrochemical Reactor Efficiency Range

**Rationale:** The S6 efficiency parameter represents the ratio of
electrical input to chemical output. For direct electrochemistry
(PEM/SOEC), 30–95% is correct. For photochemical processes driven
by grow lights, the chain includes LED conversion (50%) and
photosynthetic quantum yield (2%), giving an overall efficiency of
~1%. The inspector must allow setting η in the 0.5–5% range for
greenhouse applications while keeping sane defaults for electrolysis.

**Change 1: Tick function floor (line ~215)**
```javascript
// BEFORE:
const eta = Math.max(0.01, Math.min(0.99, par.efficiency ?? 0.70));

// AFTER:
const eta = Math.max(0.001, Math.min(0.99, par.efficiency ?? 0.70));
```
Floor lowered from 0.01 to 0.001 (0.1%). Allows modeling
inefficient lighting systems. 0.001 gives 848 kW for 7 people —
extreme but physically representable.

**Change 2: Inspector set clamp (line ~532)**
```javascript
// BEFORE:
set: v => u.params.efficiency = Math.max(0.30, Math.min(0.95, v)),
step: 0.01, decimals: 2

// AFTER:
set: v => u.params.efficiency = Math.max(0.005, Math.min(0.99, v)),
step: 0.001, decimals: 3
```
Floor lowered from 0.30 to 0.005 (0.5%). Step reduced to 0.001
for fine control in the low range. Upper limit raised to 0.99.

**Change 3: Parameter table (§S6-2)**

| Parameter | Default | Min | Max | Notes |
|-----------|---------|-----|-----|-------|
| efficiency | 0.70 | 0.005 | 0.99 | Electrical → chemical. Electrolysis: 0.60–0.80. Photochemical (grow lights): 0.005–0.05 |

**Change 4: Inspector info box — reaction-aware context**
```javascript
{ type: 'info', html: () => {
  const rxn = ReactionRegistry.get(u.params.reactionId);
  if (!rxn) return '';
  const isPhoto = rxn.id === 'R_PHOTOSYNTHESIS';
  const etaNote = isPhoto
    ? 'η includes LED→PAR→photosynthesis chain. Typical: 0.5–2%.'
    : `η is direct electrochemical conversion. Typical: 60–80%.`;
  return `${rxn.equation}<br>ΔH° = ${(rxn._dH0_Jmol/1000).toFixed(1)} kJ/mol<br>${etaNote}`;
}}
```

---

### 4.2 S7b — Greenhouse Template Efficiency

**Change: greenhouse template in §S7b Impact on S8 Spec**

```javascript
// BEFORE (in S7b spec):
{ localId: 'photo_reactor', defId: 'reactor_electrochemical',
  x: 1, y: 0,
  params: { reaction: 'R_PHOTOSYNTHESIS', efficiency: 0.28 },
  paramLocked: true },

// AFTER:
{ localId: 'photo_reactor', defId: 'reactor_electrochemical',
  x: 1, y: 0,
  params: { reaction: 'R_PHOTOSYNTHESIS', efficiency: 0.01,
            conversion_max: 0.95 },
  paramLocked: false },
```

Key changes:
- `efficiency: 0.28` → `0.01` (1% — validated against NASA data)
- `paramLocked: false` — efficiency is the ONE parameter the player
  CAN tune on the locked greenhouse. The reaction ID and internal
  wiring are locked, but η is exposed as a gameplay lever. The
  inspector shows it prominently with the context note from S6.

**Design rationale:** Locking efficiency at 1% means the player
has zero agency over the biggest power consumer. Unlocking it
within the reactor's valid range (0.5–5%) lets the player
experiment. Setting η = 2% halves the power demand (42 kW) but
is flagged as "theoretical limit, not demonstrated" in the info
tooltip. The player trades realism for practicality — a real
engineering decision.

**Selective paramLock mechanism:** The greenhouse group template
is `locked: true` (can't rewire, can't delete internal units),
but individual parameters on internal units can be marked as
editable. New field on TemplateUnit:

```javascript
/**
 * @typedef {Object} TemplateUnit
 * @property ...existing fields...
 * @property {string[]|null} editableParams - If non-null, only these
 *   params are editable even in a locked group. All others greyed.
 *   null = all locked (default for locked groups).
 */

// Greenhouse photo_reactor:
{ localId: 'photo_reactor', defId: 'reactor_electrochemical',
  params: { reactionId: 'R_PHOTOSYNTHESIS', efficiency: 0.01,
            conversion_max: 0.95 },
  paramLocked: true,
  editableParams: ['efficiency'] }  // Only η exposed to player
```

When `group.locked === true` and the player clicks an internal
unit, the inspector shows all parameters but only those in
`editableParams` have active controls. Others are displayed as
read-only values.

---

### 4.3 S8 — Metabolic Rates, M10 Mission, Open Question

#### 4.3.1 Human Unit Metabolic Rates (§S8c-4)

Replace the human unit comment block:

```javascript
// BEFORE:
// Internally: R_METABOLISM + metabolic heat + water consumption
// Parameterized by population count
// O₂ consumed: 0.39 mol/hr/person
// CO₂ produced: 0.34 mol/hr/person
// Water consumed: 11.6 mol/hr/person
// Food consumed: 0.34 mol/hr/person (CH₂O)
// Metabolic heat: 100W/person

// AFTER:
// Internally: R_METABOLISM (reactor_equilibrium, complete conversion)
// Parameterized by CampaignState.population
//
// Metabolic rates (basis: 2500 kcal/day/person, NASA moderate activity):
//   CH₂O consumed:  0.84 mol/hr/person  (food)
//   O₂ consumed:    0.84 mol/hr/person  (1:1 stoichiometry)
//   CO₂ produced:   0.84 mol/hr/person  (1:1 stoichiometry)
//   H₂O produced:   0.84 mol/hr/person  (metabolic water, exhaled)
//   Water consumed:  7.0  mol/hr/person  (drinking, exits as waste)
//   Metabolic heat:  121  W/person       (from ΔH × ξ, automatic)
//
// All four species rates are identical because R_METABOLISM
// stoichiometry is 1:1:1:1 (CH₂O + O₂ → CO₂ + H₂O).
// Heat emerges from the reactor energy balance, not a separate term.
```

**Note:** The S7b human template uses `reactor_equilibrium` running
R_METABOLISM. Since R_METABOLISM has ΔH = −519 kJ/mol and the
equilibrium constant at 310K is astronomical (K >> 10^50), conversion
is effectively 100%. The `A=∞ POWER_LAW` model specified in §S8c-3
achieves the same result but `reactor_equilibrium` is more principled.
Either model works — the equilibrium approach is recommended because
it uses existing infrastructure without special-casing.

#### 4.3.2 Greenhouse Sizing Table (new, add to §S8c-4)

```
Greenhouse sizing (7 colonists, R_PHOTOSYNTHESIS):
  CO₂ fixation needed:   5.88 mol/hr
  O₂ production:         5.88 mol/hr
  CH₂O production:       5.88 mol/hr
  Water consumed:         5.88 mol/hr
  Thermodynamic minimum:  848 W
  Default η:              1.0% (combined LED + photosynthesis)
  Electrical demand:      85 kW
  Waste heat:             84.2 kW (exits heat_out port)
```

#### 4.3.3 M10 Mission (§S8c-7, Phase D)

Replace:
```
**M10 Biosphere** (px_m10_biosphere)
- Palette: +greenhouse×1, +human×1, full accumulated inventory
- Species: +CH₂O. Reactions: +R_PHOTOSYNTHESIS, +R_METABOLISM
- Objective: maintain_conditions (CO₂<0.5%, O₂ 19–23%, food flow) for 3600s
- Teaching: closed ecosystem, plants as reactors, everything connects
- Stars: ★all objectives ★★sustain 4h ★★★wastewater recycle
```

With:
```
**M10 Biosphere — The Final Boss** (px_m10_biosphere)
- Palette: +greenhouse×1, +human×1, +room×1
- Fabrication unlocked: all previously available equipment now
  unlimited count (∞). Narrative: "Engineering team restores
  the ship's fabrication workshop."
- Species: +CH₂O. Reactions: +R_PHOTOSYNTHESIS, +R_METABOLISM
- Vent capacity: sufficient CH₄ for ≥100 kW thermal input
  (additional vent or uprated existing vent)
- Objective: maintain_conditions (CO₂<0.5%, O₂ 19–23%, food
  flow ≥ 5.88 mol/hr CH₂O) for 3600s
- Teaching: closed ecosystem, plants as chemical reactors, power
  at scale, everything connects to everything
- Power challenge: greenhouse demands ~85 kW at default 1%
  efficiency. Player must build 4–5 combined cycle power blocks
  (using S7b templates for manageable PFD organization). The
  player can adjust greenhouse lighting efficiency (0.5–5%) as
  a design tradeoff — lower η is more realistic but needs more
  power. This IS the final engineering challenge.
- Stars: ★all conditions 1hr ★★sustain 4hr ★★★wastewater
  recycle (≥50% water recovery)
```

#### 4.3.4 Open Question #1 — RESOLVED

Replace §Open Questions item 1:

```
BEFORE:
1. **M10 power requirement (~82 kW):** Dramatically exceeds 8 kW
   combined cycle. Options: (a) allow multiple power units, (b) add
   solar array as M10 equipment, (c) tunable LED efficiency parameter.
   Resolve during S8c session 3.

AFTER:
1. **M10 power requirement (~85 kW) — RESOLVED:**
   Greenhouse η = 1% (validated against NASA data), 7 colonists,
   85 kW electrical demand. Resolution combines three mechanisms:
   (a) M10 unlocks fabrication — unlimited equipment counts,
   player builds 4–5 combined cycle power blocks at ~20 kW each;
   (b) S7b group templates make building at scale manageable —
   player saves one power block as template, instantiates copies;
   (c) greenhouse lighting efficiency (η) is an editable parameter
   on the locked greenhouse template, allowing the player to trade
   realism for practicality (η=2% halves power demand to ~42 kW).
   No new power equipment types needed. The vent provides sufficient
   CH₄. The challenge is infrastructure at scale — the final exam
   of everything the player has learned.
```

#### 4.3.5 Power Budget Table (§S8c-10, add after population timeline)

Add new subsection:

```
### Power Budget by Phase

| Phase | Available | Greenhouse | Other loads | Surplus | Notes |
|-------|-----------|-----------|------------|---------|-------|
| M1–M3 | Battery (75 kWh) | — | 0.2 kW | Depleting | Emergency only |
| M4 | ~5 kW (Brayton) | — | 1.2 kW | ~3.8 kW | First power |
| M5 | ~5 kW | — | 5.2 kW | −0.2 kW | Tight |
| M6 | ~5 kW | — | 5.9 kW | −0.9 kW | Power-limited |
| M7 | ~5 kW | — | 6.6 kW | −1.6 kW | Power-limited |
| M8 | ~10 kW (combined) | — | 6.6 kW | ~3.4 kW | Rankine adds ~5 kW |
| M9 | ~10 kW | — | 10.6 kW | −0.6 kW | Tight during cryo |
| M10 | ~100 kW (5× combined) | 85 kW | 7.0 kW | ~8 kW | Fabrication unlocked |

M10 represents a 10× step change in power infrastructure. This
is the intended design — the biosphere IS the final boss, and its
power demand forces the player to scale up everything they've
built. S7b group templates make this manageable.
```

---

## 5. Cross-Spec Consistency Check

| Claim | S6 | S7b | S8 | Validated |
|-------|-----|------|-----|-----------|
| η floor allows 1% | tick: 0.001 ✓ | template: 0.01 ✓ | — | ✓ |
| η editable on locked greenhouse | — | editableParams: ['efficiency'] ✓ | — | ✓ |
| Metabolic rate = 0.84 mol/hr/person | — | human template uses reactor | 0.84 in comments ✓ | ✓ |
| Food energy = 2500 kcal/day | — | — | derived from 0.84 × 519.4 × 24 = 10,470 kJ ✓ | ✓ |
| Greenhouse power = 85 kW | — | reactor at η=0.01, 5.88 mol/hr ✓ | M10 spec ✓ | ✓ |
| Metabolic heat = 121 W/person | — | from reactor ΔH × ξ ✓ | 121 in comments ✓ | ✓ |
| Population = 7 at M10 | — | — | timeline: +2+2+1 = 7 by M7 ✓ | ✓ |
| Power supply = 5× combined cycle | — | template instantiation ✓ | M10 palette (∞) ✓ | ✓ |
| M10 fuel supply sufficient | — | — | vent capacity spec ✓ | ✓ |

---

## 6. Implementation Impact

### Changes by file count

| Spec | Lines changed | Nature |
|------|-------------|--------|
| S6 | ~8 lines | Tick clamp, inspector clamp, parameter table, info tooltip |
| S7b | ~15 lines | Greenhouse template efficiency, editableParams field, human template rates |
| S8 | ~40 lines | Metabolic rates, M10 mission rewrite, power budget table, open question resolution |
| S0 (NNG) | 0 | No NNG changes (groups already covered in S7b amendment) |

### New S7b schema addition

The `editableParams` field on `TemplateUnit` is a small but important
addition to the S7b spec. It enables "locked group with selective
parameter exposure" — needed for the greenhouse (locked assembly,
editable efficiency) and potentially useful for other campaign
composites in the future (e.g., room temperature setpoint).

### Test implications

No new tests needed for these amendments. Existing test plans cover:
- S6 T-3: partial power → proportional ξ (works at any η)
- S6 T-5: energy balance exact (works at any η)
- S8 T-3: R_METABOLISM registered (rates are comments, not tested directly)
- S7b T-GR-INVARIANT: physics unchanged by grouping

The 85 kW number should be validated during S8c session 3 integration
testing: instantiate greenhouse template, set η = 0.01, supply
sufficient power, verify food production matches 5.88 mol/hr CH₂O.
