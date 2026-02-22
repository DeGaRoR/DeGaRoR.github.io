# PTIS_S8_SPEC
## S8 — Game Layer
### processThis v13.7.0 → v14.0.0 (post-S7)

---

## Overview

**What:** Transform the simulator into a playable survival-engineering
game. Build/Run state machine with auto-checkpoint and revert.
MissionDefinition schema with 6 objective evaluator types. 10-mission
campaign on Planet X with equipment scarcity, narrative integration,
and progressive unlocks. Depletable supply units, room (shelter),
composites (greenhouse, human), 2 new species (CO, CH₂O), 2 new
reactions (R_PHOTOSYNTHESIS, R_METABOLISM). Sandbox mode preserved
for free-form engineering.

**Sub-sessions:** S8a (4), S8b (4), S8c (4) — 12 sessions total.

**Risk:** High. Largest stage by scope. Mitigated by clean separation:
S8a is pure state machine (no missions), S8b is mission framework
(no content), S8c is campaign content (data-driven). Each sub-session
is independently testable.

**Dependencies:** All of S1–S7. S8 is the consumer of every prior stage.

**Required by:** Nothing — S8 is the final stage.

**Baseline state (post-S7):** Full simulation engine with PR EOS,
distillation, pressure network, electrochemical reactor (2-outlet),
performance maps, 447 tests. No game state machine, no missions,
no scarcity system.

**After S8:** Playable 10-mission campaign + sandbox mode. ~477 tests
(447 + ~30 new).

---

## Governing Design

Game architecture defined in:
- `game_arch_part_1_to_3_description.md` (game philosophy, core loop)
- `game_arch_part_4_missions.md` (mission format, all 10 missions)
- `game_arch_part_7_equipment.md` (S-size equipment specs)
- `game_arch_part_8_ux.md` (3D view, UX, state machine)
- `processThis-game-spec-v2.md` (consolidated architecture)

This spec references those documents as authoritative. It does not
repeat their full content but provides the implementation-level detail
needed for each session.

---

# S8a — Build/Run State Machine (4 sessions)

## S8a-1. Game Modes

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

## S8a-2. Auto-Checkpoint

Every transition from BUILD → RUN auto-saves:
```javascript
function checkpoint() {
  const snap = {
    scene: serializeScene(),
    inventories: serializeInventories(),  // tank contents, battery SoC
    campaignState: CampaignState.serialize(),
    timestamp: Date.now()
  };
  CheckpointManager.push(snap);  // stack of up to 5
}
```

**Revert:** On CATASTROPHIC alarm or player request, restore from
checkpoint. Tank inventories, battery charge, timer all reset to
checkpoint state. Equipment layout preserved.

## S8a-3. Time Warp

```javascript
const TimeWarp = {
  speeds: [1, 2, 5, 10, 50],  // multipliers
  current: 0,  // index
  autoDecelerate(alarms) {
    // WARNING → clamp to 2×
    // ERROR → clamp to 1×
    // CATASTROPHIC → pause
    const maxSev = alarms.reduce((m, a) => Math.max(m, sevOrder[a.severity]), 0);
    if (maxSev >= sevOrder.CATASTROPHIC) PlayState.set('paused');
    else if (maxSev >= sevOrder.ERROR) this.current = Math.min(this.current, 0);
    else if (maxSev >= sevOrder.WARNING) this.current = Math.min(this.current, 1);
  }
};
```

TimeClock.dt multiplied by warp factor. Auto-decelerate on alarms.

## S8a-4. Topology Edit Guards

In RUN state:
- Adding/deleting units → blocked (toast: "Pause to edit layout")
- Connecting/disconnecting wires → blocked
- Parameter changes → allowed (live tuning)
- Valve opening changes → allowed (live)

In BUILD state: all edits allowed. World frozen (dt = 0).

## S8a Tests (~6)

| # | Test | Assert |
|---|------|--------|
| 1 | BUILD → RUN creates checkpoint | CheckpointManager.stack.length increases |
| 2 | Revert restores scene | scene matches checkpoint exactly |
| 3 | Revert restores inventories | tank.n matches checkpoint |
| 4 | Topology edit blocked in RUN | addUnit() returns false |
| 5 | Param edit allowed in RUN | setValue() succeeds |
| 6 | Time warp auto-decelerate on ERROR | warp.current ≤ 0 |

---

# S8b — Mission Framework (4 sessions)

## S8b-1. MissionDefinition Schema

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
 * @property {Object} rewards - { unlockedParts, unlockedMissions, unlockedSpecies, unlockedReactions }
 */
```

**Frozen on registration.** Missions are pure data — no code, no
closures. The MissionRegistry validates and freezes each definition.

## S8b-2. MissionRegistry

```javascript
const MissionRegistry = {
  _missions: new Map(),
  register(def) {
    // Validate schema
    // Validate species/reactions exist in ComponentRegistry/ReactionRegistry
    // Validate palette defIds exist in UnitRegistry
    // Freeze
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

## S8b-3. Objective Evaluators

6 types, each a pure function:

```javascript
const ObjectiveEvaluators = {
  convergence(obj, scene, runtime) {
    return runtime.converged === true;
  },

  store_component(obj, scene, runtime) {
    // Find target tank(s), check species moles, purity, phase
    const tanks = findUnits(scene, obj.targetUnit || 'tank');
    for (const tank of tanks) {
      const inv = tank.inventory;
      const moles = inv.n[obj.species] || 0;
      if (moles < obj.minMoles) continue;
      if (obj.minPurity) {
        const total = Object.values(inv.n).reduce((a,b) => a+b, 0);
        if (total < 1e-12 || moles / total < obj.minPurity) continue;
      }
      // Phase check via computeTankState if requiredPhase specified
      return true;
    }
    return false;
  },

  sustained_flow(obj, scene, runtime) {
    // Check flow of species at target exceeds minFlow for duration
    return runtime.sustainedTimers[obj.id] >= obj.duration_s;
  },

  maintain_conditions(obj, scene, runtime) {
    // Check T/P/composition bounds at target unit for duration
    return runtime.conditionTimers[obj.id] >= obj.duration_s;
  },

  power_output(obj, scene, runtime) {
    // Check net electrical output exceeds threshold for duration
    return runtime.powerTimers[obj.id] >= obj.duration_s;
  },

  parts_remaining(obj, scene, runtime) {
    const placed = countPlacedUnits(scene);
    const total = sumPalette(runtime.mission.palette);
    return (total - placed) >= obj.minCount;
  }
};
```

## S8b-4. Star Rating

```javascript
function evaluateStars(mission, scene, runtime) {
  let stars = 0;
  for (const criterion of mission.stars) {
    // Each criterion references an objective index or custom check
    const met = criterion.objectives
      ? criterion.objectives.every(i => runtime.objectiveResults[i])
      : ObjectiveEvaluators[criterion.type](criterion, scene, runtime);
    if (met) stars++;
    else break;  // Stars are cumulative — must earn ★ before ★★
  }
  return stars;
}
```

## S8b-5. Palette Scarcity

```javascript
function getPaletteForMission(mission, campaignState) {
  const palette = {};
  // Base palette from mission
  for (const [defId, count] of Object.entries(mission.palette)) {
    palette[defId] = (palette[defId] || 0) + count;
  }
  // Inherited parts from completed missions (if inheritParts)
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

## S8b-6. ParamLocks Enforcement

```javascript
// In inspector rendering:
function isParamLocked(unit, paramKey, mission) {
  if (!mission) return false;
  const locks = mission.paramLocks[unit.defId];
  return locks && paramKey in locks;
}
// Locked params: show value as read-only text with lock icon
// Source on hover: "Fixed by mission constraints"
```

## S8b-7. Progressive Hint System

```javascript
const HintManager = {
  shown: new Set(),
  check(mission, runtime) {
    for (const hint of mission.hints) {
      if (this.shown.has(hint.id)) continue;
      const triggered = this.evaluateTrigger(hint.after, runtime);
      if (triggered) {
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

## S8b-8. Mission Flow

```
1. Player selects mission from mission select screen
2. BRIEFING: NarrativeBeat[] plays (dialogue, images, objectives)
3. BUILD: Scene loaded (initial or inherited). Palette restricted.
   Player designs freely. No time passes.
4. Player presses COMMIT (Play button)
5. Auto-checkpoint. Transition to RUN.
6. RUN: World ticks. Objectives evaluated each tick.
   Time warp available. Hints check periodically.
   CATASTROPHIC → revert to checkpoint → BUILD.
7. All primary objectives met → EVALUATE
8. Star rating computed. DEBRIEF narrative plays.
9. Rewards applied to CampaignState. Next mission unlocked.
```

## S8b Tests (~8)

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

# S8c — Campaign Content (4 sessions)

## S8c-1. CampaignState

```javascript
const CampaignState = {
  completed: new Set(),      // mission IDs
  stars: {},                 // { missionId: 1|2|3 }
  accumulatedParts: {},      // { defId: count } from rewards
  accumulatedSpecies: new Set(['H2O','CO2','N2','CH4','Ar']),
  accumulatedReactions: new Set(),
  currentScene: null,        // serialized scene from last mission
  population: 2,             // survivors
  reserves: {                // depletable starting reserves
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

## S8c-2. New Species (S8c scope)

| Species | MW | hf0_Jmol | Tc | Pc | Registered |
|---------|-----|---------|-----|-----|------------|
| CO | 28.01 | −110,530 | 132.9 | 35.0e5 | S1 (data only, activated S8c) |
| CH₂O | 30.03 | −115,900 | 408 | 65.9e5 | New in S8c (food proxy) |

CO was registered in S1 as component data. CH₂O (formaldehyde, food
proxy) is new — simplified stand-in for carbohydrates in the biosphere
loop.

## S8c-3. New Reactions (S8c scope)

| Reaction | Equation | ΔH | Model | Mission |
|----------|----------|-----|-------|---------|
| R_PHOTOSYNTHESIS | CO₂ + H₂O → CH₂O + O₂ | +519 kJ/mol | ELECTROCHEMICAL | M10 |
| R_METABOLISM | CH₂O + O₂ → CO₂ + H₂O | −519 kJ/mol | POWER_LAW (A=∞) | M10 |

R_PHOTOSYNTHESIS uses ELECTROCHEMICAL model (light energy = electrical
input to greenhouse unit). R_METABOLISM uses POWER_LAW with very high
A (effectively complete conversion) — humans consume all food.

## S8c-3b. New Unit Registrations (S8c scope)

### Shared Tick Trunk Architecture (NNG-3, NNG-10)

Multiple defIds share identical physics via named trunk functions.
No frameworks, no inheritance — just shared function references
with per-defId config:

```javascript
function expanderTick(u, ports, par, ctx) {
  const config = UnitRegistry.get(u.defId).config || {};
  // Shared isentropic expansion logic
  if (config.moistureCheck && outletLiqFrac > config.maxWetness) {
    // Steam turbine only: wet exhaust warning
  }
}
```

Trunk inventory:

| Trunk | DefIds sharing it |
|---|---|
| `vesselTick` | tank, tank_cryo, reservoir |
| `heatExchangerTick` | hex, air_cooler |
| `expanderTick` | gas_turbine, steam_turbine |
| `compressorTick` | compressor |
| `electrochemicalTick` | reactor_electrochemical, fuel_cell |
| `reactorTick` | reactor_equilibrium |

**When to create a new defId (NNG-3 decision tree):**
- Different ports → new defId
- Different physics branching (config flags) → new defId, shared trunk
- Different ratings/limits only → same defId, mission paramLocks
- Different capacity only → same defId, different size (S/M/L)

**Future extension:** If variant count grows beyond paramLocks
(3+ rating variants × 3 sizes per trunk), a profile system could
layer on: `unit.profile` field, profile-specific limit overrides,
palette key `defId/profile`. Not needed for current 10 missions.

### steam_turbine (M8)

Separate defId sharing `expanderTick` trunk with `gas_turbine`.
Config: `{ moistureCheck: true, maxWetness: 0.12 }`.
Same ports as gas_turbine (mat_in, mat_out, elec_out).
Limits: T_HH=823K, P_HH=100 bar. WARNING if exhaust liquid > 12%.

### tank_cryo (M9)

Separate defId sharing `vesselTick` trunk with `tank`.
Same ports as tank (mat_in, mat_out).
Limits: T_LL=20K, T_HH=300K, P_HH=10 bar.
Physical: vacuum-insulated Dewar, multi-layer insulation, boil-off vent.

### fuel_cell (future — data registration only in S8c)

Separate defId sharing `electrochemicalTick` trunk with
`reactor_electrochemical`. Config: `{ direction: 'generate' }`.
Ports: mat_in_cat (label: Fuel), mat_in_ano (label: Oxidant),
mat_out (label: Exhaust), elec_out (label: Power out),
heat_out (label: Waste heat).
Reactions: R_H2_FUELCELL, R_CO_FUELCELL (registered in S1).
Trunk detects ΔH<0 → generate mode (power OUT).

## S8c-4. Composite Units

### Greenhouse

```javascript
UnitRegistry.register('greenhouse', {
  name: 'Greenhouse',
  category: UnitCategories.REACTOR,
  w: 3, h: 3,
  ports: [
    { portId: 'air_in',    dir: PortDir.IN,  type: StreamType.MATERIAL,   x: 0, y: 1 },
    { portId: 'water_in',  dir: PortDir.IN,  type: StreamType.MATERIAL,   x: 0, y: 2 },
    { portId: 'nh3_in',    dir: PortDir.IN,  type: StreamType.MATERIAL,   x: 1, y: 0 },
    { portId: 'elec_in',   dir: PortDir.IN,  type: StreamType.ELECTRICAL, x: 2, y: 0 },
    { portId: 'air_out',   dir: PortDir.OUT, type: StreamType.MATERIAL,   x: 3, y: 1 },
    { portId: 'food_out',  dir: PortDir.OUT, type: StreamType.MATERIAL,   x: 3, y: 2 }
  ],
  // Internally: reactor_electrochemical(R_PHOTOSYNTHESIS) + separation
  // air_out: enriched O₂ air (CO₂ consumed, O₂ produced)
  // food_out: CH₂O stream
  // Power: grow lights (drives photosynthesis rate)
});
```

### Human (Colonist Group)

```javascript
UnitRegistry.register('human', {
  name: 'Colonists',
  category: UnitCategories.REACTOR,
  w: 2, h: 2,
  ports: [
    { portId: 'air_in',   dir: PortDir.IN,  type: StreamType.MATERIAL,   x: 0, y: 0 },
    { portId: 'food_in',  dir: PortDir.IN,  type: StreamType.MATERIAL,   x: 0, y: 1 },
    { portId: 'water_in', dir: PortDir.IN,  type: StreamType.MATERIAL,   x: 0, y: 2 },
    { portId: 'air_out',  dir: PortDir.OUT, type: StreamType.MATERIAL,   x: 2, y: 0 },
    { portId: 'waste_out',dir: PortDir.OUT, type: StreamType.MATERIAL,   x: 2, y: 2 }
  ],
  // Internally: R_METABOLISM + metabolic heat + water consumption
  // Parameterized by population count
  // O₂ consumed: 0.39 mol/hr/person
  // CO₂ produced: 0.34 mol/hr/person
  // Water consumed: 11.6 mol/hr/person
  // Food consumed: 0.34 mol/hr/person (CH₂O)
  // Metabolic heat: 100W/person
});
```

## S8c-5. Room Unit (Shelter)

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
    { portId: 'air_supply',  dir: PortDir.IN,  type: StreamType.MATERIAL, x: 0, y: 1 },
    { portId: 'water_supply',dir: PortDir.IN,  type: StreamType.MATERIAL, x: 0, y: 2 },
    { portId: 'o2_supply',   dir: PortDir.IN,  type: StreamType.MATERIAL, x: 0, y: 3 },
    { portId: 'exhaust',     dir: PortDir.OUT, type: StreamType.MATERIAL, x: 4, y: 2 },
    { portId: 'heat_reject', dir: PortDir.OUT, type: StreamType.ELECTRICAL,x: 4, y: 3 }
  ],
  // Tracks: O₂%, CO₂%, T, P, humidity
  // Consumes: survival demands (O₂, water per occupant)
  // Produces: CO₂, waste heat per occupant
  // Alarm: CO₂ > 0.5% WARNING, > 2% ERROR, > 5% CRITICAL
  // Alarm: O₂ < 19% WARNING, < 16% ERROR, < 14% CRITICAL
});
```

## S8c-6. Survival Demands and Runway

```javascript
/**
 * Compute runway (hours until critical resource exhaustion).
 * @param {CampaignState} state
 * @param {Object} productionRates - { species: mol/s net production }
 * @returns {{ species: string, hours: number }[] } sorted ascending
 */
function computeRunway(state, productionRates) {
  const runways = [];
  for (const demand of state.activeDemands) {
    const rate = productionRates[demand.species] || 0;
    const reserve = state.reserves[demand.reserveKey] || 0;
    const consumption = demand.rate_molps;

    if (rate >= consumption) {
      runways.push({ species: demand.species, hours: Infinity });
    } else {
      const deficit = consumption - rate;  // mol/s net deficit
      const hours = reserve / (deficit * 3600);
      runways.push({ species: demand.species, hours });
    }
  }
  return runways.sort((a, b) => a.hours - b.hours);
}
```

**HUD display:** Most critical runway always visible. Color: green (>48h),
amber (12–48h), red (<12h), flashing red (<4h).

## S8c-7. The 10 Missions (Data Definitions)

Each mission is a pure data object registered via MissionRegistry.
Full details in `game_arch_part_4_missions.md` §20–§29. Summary:

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
- **Uses reactor_electrochemical with mat_out_cat (H₂) + mat_out_ano (O₂)**

**M3 Fuel** (px_m3_fuel)
- Palette: +mixer×1, +reactor_equilibrium×1, +hex×1 (inherited)
- Objective: store_component CH₄ ≥ 20 mol (purity ≥ 0.9)
- Teaching: Sabatier reaction, recycle loop, HEX cooling
- Stars: ★20mol ★★water recycle 10min ★★★≤85mol H₂ consumed

### Phase B — STABILIZE (M4–M6)

**M4 Power** (px_m4_power)
- Palette: +source(atm)×1, +source(vent2)×1, +compressor×1,
  +gas_turbine×1, +reactor_equilibrium×1 (locked: R_CH4_COMB, heatDemand:'none') (inherited)
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

**M10 Biosphere** (px_m10_biosphere)
- Palette: +greenhouse×1, +human×1, full accumulated inventory
- Species: +CH₂O. Reactions: +R_PHOTOSYNTHESIS, +R_METABOLISM
- Objective: maintain_conditions (CO₂<0.5%, O₂ 19–23%, food flow) for 3600s
- Teaching: closed ecosystem, plants as reactors, everything connects
- Stars: ★all objectives ★★sustain 4h ★★★wastewater recycle

## S8c-8. Save/Load + Home Screen

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

## S8c-9. Equipment Inheritance

Each mission's palette = mission.palette + Σ(rewards from completed
prerequisites). Scene inheritance: if `inheritScene`, load the final
committed scene from the previous mission. Existing units keep their
inventory state (tank contents, battery charge). New palette entries
appear in the toolbar.

## S8c-10. Population + Reserve Timeline

Per `game_arch_part_4_missions.md` §19:

| Day | Population | Event |
|-----|-----------|-------|
| 0 | 2 | Crash (Kael + Vasquez) |
| ~10 | 3 | +Jin (M4 salvage) |
| ~22 | 5 | +Amara, Tomás (M6 salvage) |
| ~27 | 7 | +Priya, Erik (M7 salvage) |

Population affects room O₂/CO₂ rates and food demand. Human unit
parameterized by `CampaignState.population`.

---

## Tests (~30 total across S8a/b/c)

### S8a Tests (6): State Machine
1–6 as listed in S8a section above.

### S8b Tests (8): Mission Framework
1–8 as listed in S8b section above.

### S8c Tests (~16): Campaign Content

| # | Test | Assert |
|---|------|--------|
| 1 | CH₂O species registered | ComponentRegistry.get('CH2O') exists |
| 2 | R_PHOTOSYNTHESIS registered | ReactionRegistry.get exists, ELECTROCHEMICAL model |
| 3 | R_METABOLISM registered | ReactionRegistry.get exists, POWER_LAW model |
| 4 | All 10 missions register | MissionRegistry.getAll().length === 10 |
| 5 | Mission dependency chain valid | M1 has no requires, M10 requires M9 |
| 6 | CampaignState.applyRewards accumulates parts | parts count increases |
| 7 | Palette scarcity with inheritance | M3 palette includes M1+M2 rewards |
| 8 | Room unit: CO₂ alarm at 2% | ERROR alarm fires |
| 9 | Room unit: O₂ alarm at 16% | ERROR alarm fires |
| 10 | Greenhouse: CO₂ consumed, O₂ + CH₂O produced | mass balance |
| 11 | Human: O₂ consumed, CO₂ produced | mass balance |
| 12 | computeRunway: deficit scenario | finite hours |
| 13 | computeRunway: surplus scenario | Infinity |
| 14 | Save/load round-trip | campaignState preserved |
| 15 | Scene inheritance: tank contents preserved | n_H2O matches |
| 16 | Full campaign regression | all S1–S7 tests still pass |

**Gate:** All previous (447) + 30 new → 477 cumulative.

---

## Implementation Checklist

```
S8a session 1 (state machine core):
  [ ] GameMode + PlayState enums
  [ ] State transition logic (BUILD ⇄ RUN ⇄ PAUSED)
  [ ] Topology edit guards (blocked in RUN)
  [ ] Param edit pass-through in RUN

S8a session 2 (checkpoint + revert):
  [ ] CheckpointManager (auto-save on BUILD→RUN)
  [ ] Revert to checkpoint (scene + inventories + campaign)
  [ ] CATASTROPHIC → auto-revert flow
  [ ] Tests S8a 1-3

S8a session 3 (time warp):
  [ ] TimeWarp speed multiplier array
  [ ] Auto-decelerate on alarm severity
  [ ] TimeClock.dt integration with warp factor
  [ ] Tests S8a 4-6

S8a session 4 (integration):
  [ ] PlayState UI controls (Build/Run/Pause buttons)
  [ ] State indicator in header
  [ ] Toast messages for blocked actions
  [ ] Sandbox mode (no restrictions)

S8b session 1 (mission schema + registry):
  [ ] MissionDefinition typedef + validation
  [ ] MissionRegistry.register() with freeze
  [ ] MissionRegistry.getAvailable()
  [ ] Tests S8b 1-2

S8b session 2 (objective evaluators):
  [ ] 6 evaluator types (convergence, store_component, sustained_flow, maintain_conditions, power_output, parts_remaining)
  [ ] Runtime timers for sustained/maintain objectives
  [ ] Tests S8b 3-5

S8b session 3 (scarcity + locks):
  [ ] getPaletteForMission() with inheritance
  [ ] Palette count badges + grey-out
  [ ] ParamLocks enforcement in inspector
  [ ] Tease entries with narrative tooltip
  [ ] Tests S8b 6-7

S8b session 4 (stars + hints + flow):
  [ ] evaluateStars()
  [ ] HintManager with trigger evaluation
  [ ] Mission flow: BRIEFING→BUILD→RUN→EVALUATE→DEBRIEF
  [ ] Narrative overlay (placeholder - text only)
  [ ] Test S8b 8

S8c session 1 (campaign state + new registrations):
  [ ] CampaignState object (completed, stars, parts, reserves)
  [ ] CH₂O species registration
  [ ] R_PHOTOSYNTHESIS, R_METABOLISM reaction registration
  [ ] CO species activation
  [ ] Tests S8c 1-3

S8c session 2 (composites + room):
  [ ] greenhouse unit registration + tick
  [ ] human unit registration + tick (parameterized by population)
  [ ] room unit registration + tick (atmospheric tracking)
  [ ] Survival demands + computeRunway()
  [ ] Tests S8c 8-13

S8c session 3 (10 missions):
  [ ] Register all 10 missions (M1-M10) as data objects
  [ ] Mission dependency chain
  [ ] Equipment inheritance logic
  [ ] Population timeline events
  [ ] Tests S8c 4-7

S8c session 4 (save/load + integration):
  [ ] SaveManager (save/load/list)
  [ ] Home screen (New Campaign, Continue, Sandbox, Load)
  [ ] Scene inheritance (tank contents, battery charge)
  [ ] HUD: runway display, population, game day
  [ ] Tests S8c 14-16
  [ ] Full regression

Total S8: ~30 new tests → 477 cumulative
```

---

## Open Questions (flagged, non-blocking for S8)

1. **M10 power requirement (~82 kW):** Dramatically exceeds 8 kW
   combined cycle. Options: (a) allow multiple power units, (b) add
   solar array as M10 equipment, (c) tunable LED efficiency parameter.
   Resolve during S8c session 3.

2. **3D view:** Game arch specifies Three.js 3D plant view as primary
   interface. S8 implements the game logic layer only. 3D visualization
   is a separate workstream (post-S8) that layers on top of the
   existing 2D flowsheet. The 2D SVG view remains fully functional
   for all gameplay.

3. **Narrative content:** S8 implements the narrative system (beat
   player, dialogue overlay). Actual narrative text (briefings, expert
   dialogue, debriefings) is content that can be iterated independently
   of the code. Placeholder text sufficient for S8.

---

## What S8 Delivers

The complete game: 10 missions teaching condensation, electrolysis,
Sabatier synthesis, Brayton power, multi-stage compression, heat pumps,
Haber synthesis with recycle/purge, Rankine bottoming cycle, cryogenic
liquefaction, and closed biosphere — all grounded in the real
thermodynamic engine built in S1–S7. A player who completes the
campaign has accidentally learned chemical engineering.
