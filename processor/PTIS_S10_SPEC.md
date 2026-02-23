# PTIS_S10_SPEC
## S10 — Game Layer
### processThis v13.9.0 → v14.0.0 (post-S9)

---

## Overview

**What:** Transform the simulator into a playable survival-engineering
game. Build/Run state machine with auto-checkpoint and revert.
MissionDefinition schema with 6 objective evaluator types. 10-mission
campaign on Planet X with equipment scarcity, narrative integration,
and progressive unlocks. Depletable supply units, room (shelter),
composites (greenhouse, human) via S8 GroupTemplateRegistry using
S9-registered units. Sandbox mode preserved for free-form engineering.

**Sub-sessions:** S10a (3), S10b (4), S10c (3) — 10 sessions total.

**Risk:** Medium. Largest stage by scope. Mitigated by clean separation:
S10a is pure state machine (no missions), S10b is mission framework
(no content), S10c is campaign content (data-driven). Each sub-session
is independently testable.

**Dependencies:** All of S0–S9. S10 is the consumer of every prior
stage. S8 (GroupTemplateRegistry) required specifically by S10c for
greenhouse and human composite template registrations. S9 (all new
defIds, species, reactions) required by S10c composite definitions
and mission chemistry.

**Required by:** Nothing — S10 is the final stage.

**Baseline state (post-S9):** Full simulation engine with PR EOS,
distillation, pressure network, electrochemical reactor (2-outlet),
performance maps, unit grouping with templates, scaling mechanism,
all game-required units/species/reactions registered. Validation gate
(S9b) complete. 486 tests. No game state machine, no missions, no
scarcity system.

**After S10:** Playable 10-mission campaign + sandbox mode. ~508 tests
(486 + ~22 new).

---

## Governing Design

Game architecture defined in `PTIS_GAME_DESIGN.md` — the unified game
design document covering philosophy, narrative, missions (as player
experiences), equipment stories, biosphere concept, and UX vision.

This spec does not repeat design rationale. It provides the
implementation-level detail needed for each session: schemas, code
structures, data definitions, and test criteria.

For canonical equipment data (ports, limits, parameters), see
`PTIS_EQUIPMENT_MATRIX.md`.

For biosphere derivations (metabolic rates, greenhouse power,
NASA cross-validation), see `PTIS_BIOSPHERE_POWER_RECONCILIATION.md`.

For composite template designs (human, greenhouse, room, depletable
room), see `PTIS_COMPOSITE_MODELS.md`.

---

# S10a — Build/Run State Machine (3 sessions)

## S10a-1. Game Modes & State Transitions

```javascript
const GameMode = Object.freeze({
  SANDBOX: 'sandbox',     // Free-form, all equipment, no scarcity
  CAMPAIGN: 'campaign'    // Mission-driven, scarcity, narrative
});

const PlayState = Object.freeze({
  BUILD: 'build',         // World frozen. Topology editable. Params editable.
  RUN: 'run',             // World ticking. Topology locked. Params live.
  PAUSED: 'paused',       // World frozen. Topology locked. Resume available.
  EVALUATE: 'evaluate',   // Post-run. Checking objectives. Brief.
  BRIEFING: 'briefing',   // Pre-mission narrative overlay.
  DEBRIEF: 'debrief'      // Post-mission narrative overlay.
});
```

**State transitions:**

```
BRIEFING → BUILD → RUN ⇄ PAUSED → EVALUATE → DEBRIEF → (next mission)
                    ↓
              CATASTROPHIC → revert to checkpoint → BUILD
```

**Sandbox mode:** Uses BUILD ⇄ RUN ⇄ PAUSED only. No briefing,
evaluate, or debrief states. No scarcity. Full palette.

## S10a-2. Auto-Checkpoint & Revert

Every transition from BUILD → RUN auto-saves:
```javascript
function checkpoint() {
  const snap = {
    scene: serializeScene(),
    inventories: serializeInventories(),
    campaignState: CampaignState.serialize(),
    timestamp: Date.now()
  };
  CheckpointManager.push(snap);  // stack of up to 5
}
```

**Revert:** On CATASTROPHIC alarm or player request, restore from
checkpoint. Tank inventories, battery charge, timer all reset to
checkpoint state. Equipment layout preserved.

## S10a-3. Time Warp

```javascript
const TimeWarp = {
  speeds: [1, 2, 5, 10, 50],
  current: 0,
  autoDecelerate(alarms) {
    const maxSev = alarms.reduce((m, a) => Math.max(m, sevOrder[a.severity]), 0);
    if (maxSev >= sevOrder.CATASTROPHIC) PlayState.set('paused');
    else if (maxSev >= sevOrder.ERROR) this.current = Math.min(this.current, 0);
    else if (maxSev >= sevOrder.WARNING) this.current = Math.min(this.current, 1);
  }
};
```

TimeClock.dt multiplied by warp factor. Auto-decelerate on alarms.

## S10a-4. Topology Edit Guards

In RUN state:
- Adding/deleting units → blocked (toast: "Pause to edit layout")
- Connecting/disconnecting wires → blocked
- Parameter changes → allowed (live tuning)
- Valve opening changes → allowed (live)

In BUILD state: all edits allowed. World frozen (dt = 0).

## S10a Tests (~6)

| # | Test | Assert |
|---|------|--------|
| 1 | BUILD → RUN creates checkpoint | CheckpointManager.stack.length increases |
| 2 | Revert restores scene | scene matches checkpoint exactly |
| 3 | Revert restores inventories | tank.n matches checkpoint |
| 4 | Topology edit blocked in RUN | addUnit() returns false |
| 5 | Param edit allowed in RUN | setValue() succeeds |
| 6 | Time warp auto-decelerate on ERROR | warp.current ≤ 0 |

---

# S10b — Mission Framework (4 sessions)

## S10b-1. MissionDefinition Schema

```javascript
/**
 * @typedef {Object} MissionDefinition
 * @property {string} id - Unique ID ('px_m1_water')
 * @property {string} title
 * @property {string} description - One-line summary
 * @property {string} chapter - 'A'|'B'|'C'|'D'
 * @property {string} atmosphere - Atmosphere preset
 * @property {Object} palette - { defId: count }
 * @property {Object} paramLocks - { defId: { param: value } }
 * @property {string[]} species - Available species IDs
 * @property {string[]} reactions - Available reaction IDs
 * @property {Object|null} initialScene - Pre-built starting flowsheet
 * @property {boolean} inheritScene - Start from previous mission end state
 * @property {Objective[]} objectives - Win conditions
 * @property {StarCriterion[]} stars - 1-3 star thresholds
 * @property {NarrativeBeat[]} briefing
 * @property {NarrativeBeat[]} debriefing
 * @property {Hint[]} hints - Progressive hints
 * @property {string[]} requires - Prerequisite mission IDs
 * @property {Object} rewards
 */
```

**Frozen on registration.** Missions are pure data — no code, no
closures. The MissionRegistry validates and freezes each definition.

## S10b-2. MissionRegistry

```javascript
const MissionRegistry = {
  _missions: new Map(),
  register(def) {
    // Validate schema
    // Validate species/reactions exist
    // Validate palette defIds exist
    Object.freeze(def);
    this._missions.set(def.id, def);
  },
  get(id) { return this._missions.get(id); },
  getAll() { return [...this._missions.values()]; },
  getAvailable(campaignState) {
    return this.getAll().filter(m =>
      m.requires.every(r => campaignState.completed.has(r)));
  }
};
```

## S10b-3. Objective Evaluators

6 types, each a pure function:

```javascript
const ObjectiveEvaluators = {
  convergence(obj, scene, runtime) {
    return runtime.converged === true;
  },
  store_component(obj, scene, runtime) {
    const tanks = findUnits(scene, obj.targetUnit || 'tank');
    for (const tank of tanks) {
      const inv = tank.inventory;
      const moles = inv.n[obj.species] || 0;
      if (moles < obj.minMoles) continue;
      if (obj.minPurity) {
        const total = Object.values(inv.n).reduce((a,b) => a+b, 0);
        if (total < 1e-12 || moles / total < obj.minPurity) continue;
      }
      return true;
    }
    return false;
  },
  sustained_flow(obj, scene, runtime) {
    return runtime.sustainedTimers[obj.id] >= obj.duration_s;
  },
  maintain_conditions(obj, scene, runtime) {
    return runtime.conditionTimers[obj.id] >= obj.duration_s;
  },
  power_output(obj, scene, runtime) {
    return runtime.powerTimers[obj.id] >= obj.duration_s;
  },
  parts_remaining(obj, scene, runtime) {
    const placed = countPlacedUnits(scene);
    const total = sumPalette(runtime.mission.palette);
    return (total - placed) >= obj.minCount;
  }
};
```

## S10b-4. Star Rating

```javascript
function evaluateStars(mission, scene, runtime) {
  let stars = 0;
  for (const criterion of mission.stars) {
    const met = criterion.objectives
      ? criterion.objectives.every(i => runtime.objectiveResults[i])
      : ObjectiveEvaluators[criterion.type](criterion, scene, runtime);
    if (met) stars++;
    else break;  // Stars are cumulative
  }
  return stars;
}
```

## S10b-5. Palette Scarcity

```javascript
function getPaletteForMission(mission, campaignState) {
  const palette = {};
  for (const [defId, count] of Object.entries(mission.palette)) {
    palette[defId] = (palette[defId] || 0) + count;
  }
  if (mission.inheritParts && campaignState) {
    for (const [defId, count] of Object.entries(campaignState.accumulatedParts)) {
      palette[defId] = (palette[defId] || 0) + count;
    }
  }
  return palette;
}
```

**UI:** Count badge on each palette entry ("2×"). Grey when all placed.
Tease entries (greyed with narrative tooltip) for equipment the player
will find later.

## S10b-6. ParamLocks Enforcement

```javascript
function isParamLocked(unit, paramKey, mission) {
  if (!mission) return false;
  const locks = mission.paramLocks[unit.defId];
  return locks && paramKey in locks;
}
```

## S10b-7. Progressive Hint System

```javascript
const HintManager = {
  shown: new Set(),
  check(mission, runtime) {
    for (const hint of mission.hints) {
      if (this.shown.has(hint.id)) continue;
      if (this.evaluateTrigger(hint.after, runtime)) {
        this.shown.add(hint.id);
        NarrativeOverlay.showHint(hint.text, hint.speaker || 'vasquez');
      }
    }
  },
  evaluateTrigger(trigger, runtime) {
    // 'time:300' → 300s elapsed
    // 'fail:2' → 2 failed attempts
    // 'place:air_cooler' → unit type placed
    // 'alarm:severity:ERROR' → ERROR alarm active
  }
};
```

## S10b-8. Mission Flow

```
1. Player selects mission from mission select screen
2. BRIEFING: NarrativeBeat[] plays
3. BUILD: Scene loaded. Palette restricted. No time passes.
4. Player presses COMMIT (Play button)
5. Auto-checkpoint. Transition to RUN.
6. RUN: World ticks. Objectives evaluated each tick.
   CATASTROPHIC → revert to checkpoint → BUILD.
7. All primary objectives met → EVALUATE
8. Star rating computed. DEBRIEF narrative plays.
9. Rewards applied to CampaignState. Next mission unlocked.
```

## S10b Tests (~8)

| # | Test | Assert |
|---|------|--------|
| 1 | MissionRegistry validates schema | Bad mission → throws |
| 2 | MissionRegistry freezes definitions | Object.isFrozen(mission) |
| 3 | convergence evaluator | converged scene → true |
| 4 | store_component evaluator | tank with 100 mol H₂O → true |
| 5 | sustained_flow evaluator | timer reaches duration → true |
| 6 | Palette scarcity: count = 0 → blocked | addUnit returns false |
| 7 | ParamLocks: locked param read-only | setValue() no-op |
| 8 | Star evaluation: ★ but not ★★ | stars === 1 |

---

# S10c — Campaign Content (3 sessions)

## S10c-1. CampaignState & Room Unit

### CampaignState

```javascript
const CampaignState = {
  completed: new Set(),
  stars: {},
  accumulatedParts: {},
  accumulatedSpecies: new Set(['H2O','CO2','N2','CH4','Ar']),
  accumulatedReactions: new Set(),
  currentScene: null,
  population: 2,
  reserves: {
    O2_bottles_mol: 300,
    LiOH_cartridges: 20,
    water_mol: 2222,
    battery_kWh: 75,
    MREs: 200
  },
  gameDay: 0,

  applyRewards(mission) {
    this.completed.add(mission.id);
    const r = mission.rewards;
    if (r.unlockedParts) {
      for (const [k, v] of Object.entries(r.unlockedParts))
        this.accumulatedParts[k] = (this.accumulatedParts[k] || 0) + v;
    }
    if (r.unlockedSpecies) r.unlockedSpecies.forEach(s => this.accumulatedSpecies.add(s));
    if (r.unlockedReactions) r.unlockedReactions.forEach(r => this.accumulatedReactions.add(r));
  },

  serialize() { /* JSON-safe snapshot */ },
  deserialize(data) { /* restore from JSON */ }
};
```

### Room Unit (Shelter)

The shelter is modeled as a large sealed tank (50 m³) with atmospheric
composition tracking:

```javascript
UnitRegistry.register('room', {
  name: 'Shelter',
  category: UnitCategories.VESSEL,
  w: 4, h: 4,
  optionalPorts: true,
  inventory: true,
  ports: [
    { portId: 'air_supply',   dir: PortDir.IN,  type: StreamType.MATERIAL },
    { portId: 'water_supply', dir: PortDir.IN,  type: StreamType.MATERIAL },
    { portId: 'o2_supply',    dir: PortDir.IN,  type: StreamType.MATERIAL },
    { portId: 'exhaust',      dir: PortDir.OUT, type: StreamType.MATERIAL },
    { portId: 'elec_in',      dir: PortDir.IN,  type: StreamType.ELECTRICAL }
  ],
  // Tracks: O₂%, CO₂%, T, P, humidity
  // Alarm: CO₂ > 0.5% WARNING, > 2% ERROR, > 5% CRITICAL
  // Alarm: O₂ < 19% WARNING, < 16% ERROR, < 14% CRITICAL
});
```

### Survival Demands and Runway

```javascript
function computeRunway(state, productionRates) {
  const runways = [];
  for (const demand of state.activeDemands) {
    const rate = productionRates[demand.species] || 0;
    const reserve = state.reserves[demand.reserveKey] || 0;
    const consumption = demand.rate_molps;
    if (rate >= consumption) {
      runways.push({ species: demand.species, hours: Infinity });
    } else {
      const deficit = consumption - rate;
      const hours = reserve / (deficit * 3600);
      runways.push({ species: demand.species, hours });
    }
  }
  return runways.sort((a, b) => a.hours - b.hours);
}
```

**HUD display:** Most critical runway always visible. Color: green (>48h),
amber (12–48h), red (<12h), flashing red (<4h).

---

## S10c-2. Composite Templates & Depletables

### Greenhouse (S8 Locked Group Template)

Registered via S8 GroupTemplateRegistry using S9-registered units.
Full template definition in `PTIS_COMPOSITE_MODELS.md` §1.

Internal units: `mixer` (nutrient input), `reactor_electrochemical`
(R_PHOTOSYNTHESIS, η=0.02), `mixer` (product merge), `hex` (cooling),
`compressor` (fan), `membrane_separator` (leaf, CH₂O/NH₃ selectivity
0.05), `tank` (soil buffer). 7 units, 7 boundary ports.

Boundary ports: co2_in, nutrient_in, elec_in, cool_in, cool_out,
air_out (O₂-rich), food_out.

**Lighting efficiency is the ONE editable parameter** on the locked
template (via `editableParams: ['efficiency']` on the photo_reactor).

Greenhouse sizing (7 colonists, R_PHOTOSYNTHESIS):
```
CO₂ fixation needed:   5.88 mol/hr = 0.001633 mol/s
O₂ production:         5.88 mol/hr
CH₂O production:       5.88 mol/hr (food)
Water consumed:         5.88 mol/hr
Thermodynamic minimum:  848 W  (ξ × |ΔH|)
Default η:              2.0%   (combined LED + photosynthesis)
Electrical demand:      42 kW  (848 / 0.02)
Waste heat:             ~41 kW (exits via cooling circuit cool_out)
```

### Human (S8 Locked Group Template)

Full template definition in `PTIS_COMPOSITE_MODELS.md` §2.

Internal units: `compressor` (fan), `splitter` (air 8/92%), `tank`
(air buffer), `tank` (food buffer), `mixer` (feed), `reactor_adiabatic`
(R_METABOLISM, T=310K, complete conversion), `hex` (body heat exchange),
`membrane_separator` (kidney, NH₃: 0.01 selectivity), `mixer` (air merge),
`tank` (water buffer), `mixer` (waste). 11 units, 5 boundary ports.

Boundary ports: air_in, food_in, water_in, air_out (exhaled), waste_out.

Metabolic rates (basis: 2500 kcal/day/person, NASA moderate activity):
```
CH₂O consumed:  0.84 mol/hr/person  (food)
O₂ consumed:    0.84 mol/hr/person  (1:1 stoichiometry)
CO₂ produced:   0.84 mol/hr/person
H₂O produced:   0.84 mol/hr/person  (metabolic water, exhaled)
Water consumed:  7.0  mol/hr/person  (drinking, exits as waste)
Metabolic heat:  121  W/person       (from ΔH × ξ, automatic)
```

All four species rates are identical because R_METABOLISM stoichiometry
is 1:1:1:1 (CH₂O + O₂ → CO₂ + H₂O). Heat emerges from the reactor
energy balance, not a separate parameter. Parameterized by
`CampaignState.population`.

Drinking water enters via water_in (7.0 mol/hr/person), mixes with
kidney retentate (NH₃), exits as H₂O + NH₃ via waste_out. All carbon
is oxidized by R_METABOLISM — no biomass waste, only urine analogue.

### Depletable Supply Units

Five emergency supply units are pre-placed and connected to the room
at game start. Not buildable, not movable. Can be inspected.

| Unit | Inventory | Daily burn (2 ppl) | Lifetime |
|------|-----------|-------------------|----------|
| O₂ Bottles | 300 mol O₂ | 24 mol/day | 12.5 days |
| LiOH Scrubber | 268 mol CO₂ (20 cartridges) | 20 mol/day | 13.4 days |
| Water Jerricans | 2,222 mol H₂O (40 L) | 166 mol/day | 13.4 days |
| MRE Crate | 200 MREs | 4/day | 50 days |
| Battery Bank | 75 kWh | ~4.8 kWh/day baseline | 15.6 days |

When a depletable is exhausted and no process replacement is connected:
alarm triggers. If resource is critical (O₂, CO₂ scrubbing), failure
countdown begins.

### Population & Reserve Timeline

| Day | Population | Event |
|-----|-----------|-------|
| 0 | 2 | Crash (Kael + Vasquez) |
| ~10 | 3 | +Jin (M4 salvage) |
| ~22 | 5 | +Amara, Tomás (M6 salvage) |
| ~27 | 7 | +Priya, Erik (M7 salvage) |

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

---

## S10c-3. The 10 Missions (Data Definitions)

Each mission is a pure data object registered via MissionRegistry.
Narrative context and player experience described in `PTIS_GAME_DESIGN.md`.

### Phase A — SURVIVE (M1–M3)

**M1 Water** (px_m1_water)
- Palette: source(vent)×1, air_cooler×1, flash_drum×1, tank×2
- Objective: store_component H₂O ≥ 100 mol (liquid)
- Teaching: condensation, phase separation, second law (T_approach)
- Stars: ★100mol ★★200mol ★★★200mol with 1 tank

**M2 Oxygen** (px_m2_oxygen)
- Palette: +electrolyzer×1, +battery×1, +tank×1 (inherited from M1)
- Objective: store_component O₂ ≥ 50 mol
- Teaching: electrolysis, power consumption, electrode separation
- Stars: ★50mol O₂ ★★100mol H₂ ★★★≤10kWh battery
- Uses reactor_electrochemical with mat_out_cat (H₂) + mat_out_ano (O₂)

**M3 Fuel** (px_m3_fuel)
- Palette: +mixer×1, +reactor_adiabatic×1, +hex×1 (inherited)
- Objective: store_component CH₄ ≥ 20 mol (purity ≥ 0.9)
- Teaching: Sabatier reaction, recycle loop, HEX cooling
- Stars: ★20mol ★★water recycle 10min ★★★≤85mol H₂ consumed

### Phase B — STABILIZE (M4–M6)

**M4 Power** (px_m4_power)
- Palette: +source(atm)×1, +source(vent2)×1, +compressor×1,
  +gas_turbine×1, +reactor_adiabatic×1 (locked: R_CH4_COMB) (inherited)
- Objective: power_output ≥ 5kW for 300s
- Teaching: Brayton cycle, combustion, turbine work > compressor work
- Stars: ★5kW 5min ★★battery charging ★★★≤4 units in loop

**M5 Air** (px_m5_air)
- Palette: +compressor×1(total 2), +air_cooler×1(total 2),
  +valve×1, +flash_drum×1(total 2) (inherited)
- Objective: store_component N₂+O₂ ≥ 500 mol (<0.5% CO₂)
- Teaching: multi-stage compression, CO₂ liquefaction near critical point
- Stars: ★500mol <0.5%CO₂ ★★50mol liquid CO₂ ★★★<0.1%CO₂

**M6 Warmth** (px_m6_warmth)
- Palette: +hex×1(total 2), uses existing compressor+valve (inherited)
- Objective: maintain_conditions room T 293–300K for 1800s
- Teaching: heat pump, COP, closed cycle, power budgeting
- Stars: ★T sustained ★★COP≥2.5 ★★★COP≥3.0

### Phase C — EXPAND (M7–M9)

**M7 Fertilizer** (px_m7_fertilizer)
- Palette: +splitter×1, +heater×1 (inherited)
- Objective: store_component NH₃ ≥ 10 mol (liquid)
- Teaching: Haber synthesis, recycle + purge, inert accumulation
- Stars: ★10mol ★★Ar purge 10min ★★★>50% N₂ conversion

**M8 More Power** (px_m8_power2)
- Palette: +pump×1, +steam_turbine×1 (inherited)
- Objective: power_output ≥ 8kW for 300s
- Teaching: Rankine bottoming cycle, combined cycle, liquid compression
- Stars: ★8kW 5min ★★pump work <5W ★★★>35% combined efficiency

**M9 Reserves** (px_m9_reserves)
- Palette: +tank_cryo×2, uses accumulated inventory (inherited)
- Objective: store_component O₂ ≥ 50 mol (liquid) AND CH₄ ≥ 50 mol (liquid)
- Teaching: cryogenic liquefaction, Linde cycle, turboexpander
- Stars: ★both stored ★★single continuous run ★★★turboexpander work recovery

### Phase D — SUSTAIN (M10)

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
  (using S8 templates for manageable PFD organization). The
  player can adjust greenhouse lighting efficiency (0.5–5%) as
  a design tradeoff — lower η is more realistic but needs more
  power. This IS the final engineering challenge.
- Stars: ★all conditions 1hr ★★sustain 4hr ★★★wastewater
  recycle (≥50% water recovery)

---

## S10c-4. Save/Load & Home Screen

```javascript
const SaveManager = {
  save(slot) {
    const data = {
      version: SCENE_VERSION,
      gameMode: GameMode.current,
      campaignState: CampaignState.serialize(),
      scene: serializeScene(),
      checkpoints: CheckpointManager.serialize(),
      timestamp: Date.now()
    };
    localStorage.setItem(`ptis_save_${slot}`, JSON.stringify(data));
  },
  load(slot) { /* deserialize + validate version */ },
  listSlots() { /* return available saves with metadata */ }
};
```

**Home screen:**
- New Campaign (starts M1 briefing)
- Continue Campaign (loads last auto-save)
- Sandbox Mode (free-form, all equipment)
- Load Save (slot picker)

## S10c-5. Equipment Inheritance

Each mission's palette = mission.palette + Σ(rewards from completed
prerequisites). Scene inheritance: if `inheritScene`, load the final
committed scene from the previous mission. Existing units keep their
inventory state (tank contents, battery charge). New palette entries
appear in the toolbar.

---

## Tests (~22 total across S10a/b/c)

### S10a Tests (6): State Machine
1–6 as listed in S10a section above.

### S10b Tests (8): Mission Framework
1–8 as listed in S10b section above.

### S10c Tests (~8): Campaign Content

| # | Test | Assert |
|---|------|--------|
| 1 | All 10 missions register | MissionRegistry.getAll().length === 10 |
| 2 | Mission dependency chain valid | M1 has no requires, M10 requires M9 |
| 3 | CampaignState.applyRewards accumulates parts | parts count increases |
| 4 | Palette scarcity with inheritance | M3 palette includes M1+M2 rewards |
| 5 | Room unit: CO₂ alarm at 2% | ERROR alarm fires |
| 6 | Room unit: O₂ alarm at 16% | ERROR alarm fires |
| 7 | Greenhouse template: CO₂ consumed, O₂ + CH₂O produced | mass balance |
| 8 | Human template: O₂ consumed, CO₂ produced, waste = H₂O + NH₃ | mass balance + water_in flows to waste_out |

**Gate:** All previous (486) + 22 new → 508 cumulative.

---

## Implementation Checklist

```
S10a session 1 (state machine + checkpoint):
  [ ] GameMode + PlayState enums
  [ ] State transition logic (BUILD ⇄ RUN ⇄ PAUSED)
  [ ] Topology edit guards (blocked in RUN)
  [ ] CheckpointManager (auto-save on BUILD→RUN)
  [ ] Revert to checkpoint (scene + inventories + campaign)
  [ ] Tests S10a 1-5

S10a session 2 (time warp + integration):
  [ ] TimeWarp speed multiplier array
  [ ] Auto-decelerate on alarm severity
  [ ] PlayState UI controls (Build/Run/Pause buttons)
  [ ] Toast messages for blocked actions
  [ ] Sandbox mode (no restrictions)
  [ ] Test S10a 6

S10a session 3 (polish):
  [ ] State indicator in header
  [ ] CATASTROPHIC → auto-revert flow
  [ ] Scene serialization version bump

S10b session 1 (mission schema + registry):
  [ ] MissionDefinition typedef + validation
  [ ] MissionRegistry.register() with freeze
  [ ] MissionRegistry.getAvailable()
  [ ] Tests S10b 1-2

S10b session 2 (objective evaluators):
  [ ] 6 evaluator types
  [ ] Runtime timers for sustained/maintain objectives
  [ ] Tests S10b 3-5

S10b session 3 (scarcity + locks):
  [ ] getPaletteForMission() with inheritance
  [ ] Palette count badges + grey-out
  [ ] ParamLocks enforcement in inspector
  [ ] Tests S10b 6-7

S10b session 4 (stars + hints + flow):
  [ ] evaluateStars()
  [ ] HintManager with trigger evaluation
  [ ] Mission flow: BRIEFING→BUILD→RUN→EVALUATE→DEBRIEF
  [ ] Test S10b 8

S10c session 1 (campaign state + composites + room):
  [ ] CampaignState object
  [ ] Greenhouse group template registration (S8 GroupTemplateRegistry)
  [ ] Human group template registration (S8 GroupTemplateRegistry)
  [ ] room unit registration + tick
  [ ] Depletable supply units
  [ ] Survival demands + computeRunway()
  [ ] Tests S10c 5-8

S10c session 2 (10 missions + flow):
  [ ] Register all 10 missions as data objects
  [ ] Mission dependency chain
  [ ] Equipment inheritance logic
  [ ] Population timeline events
  [ ] Tests S10c 1-4

S10c session 3 (save/load + integration):
  [ ] SaveManager (save/load/list)
  [ ] Home screen (New Campaign, Continue, Sandbox, Load)
  [ ] Scene inheritance (tank contents, battery charge)
  [ ] HUD: runway display, population, game day
  [ ] Full regression

Total S10: ~22 new tests → 508 cumulative
```

---

## Open Questions (flagged, non-blocking for S10)

1. **M10 power requirement (~42 kW at η=2%) — RESOLVED:**
   See `PTIS_BIOSPHERE_POWER_RECONCILIATION.md` for full derivation
   and resolution via fabrication unlock + S8 templates + editable η.
   At default η=2%, greenhouse demands ~42 kW (achievable with 2–3
   combined cycles). Player can chase η=1% (~85 kW) for ★★★ challenge.

2. **3D view:** Game design specifies Three.js 3D plant view as primary
   interface. S10 implements the game logic layer only. 3D visualization
   is a separate workstream (post-S10) that layers on top of the
   existing 2D flowsheet. The 2D SVG view remains fully functional.

3. **Narrative content:** S10 implements the narrative system (beat
   player, dialogue overlay). Actual narrative text is content that
   can be iterated independently. Placeholder text sufficient for S10.

---

## What S10 Delivers

The complete game: 10 missions teaching condensation, electrolysis,
Sabatier synthesis, Brayton power, multi-stage compression, heat pumps,
Haber synthesis with recycle/purge, Rankine bottoming cycle, cryogenic
liquefaction, and closed biosphere — all grounded in the real
thermodynamic engine built in S0–S9. A player who completes the
campaign has accidentally learned chemical engineering.
