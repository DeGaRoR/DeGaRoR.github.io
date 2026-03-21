# PTIS S-MISSION Spec
## Mission System — Final Design Document
### March 2026

---

> **Single source of truth.** Supersedes all prior drafts.
> Companion docs: PTIS_ARC_A_MISSION_LIST.md, PTIS_S_HENRY_SPEC.md.

---

# Part I — Architecture

## 1. Hierarchy

```
Campaign
 └── Arc (1..N)
      └── Mission (1..N)
```

**Campaign** — top-level container. Own planet, characters,
species/reaction pools. Campaigns always start fresh.
At launch: one campaign ("Planet X").

**Arc** — chapter. Cinematic intro/conclusion. Crew changes.
Arcs inherit the player's exact end state from the previous arc.
The player's flowsheet is sacred — the system never modifies it.
Arc intro dialogue must avoid spatial references to unit positions.

**Mission** — the playable unit. Complex data object. Owns palette,
objectives, guidance, triggers, narrative, stars, rewards. Missions
inherit previous mission's end state. Palette is cumulative.

**Progression is strictly linear.** No mission select. No replay.

**Campaign intro merges with first arc intro** for single-campaign
releases. The crash sequence IS the Arc A intro.

---

## 2. Data Schemas

### 2.1 CampaignDefinition

```javascript
CampaignDefinition = {
  id:           'planet_x',
  title:        'Planet X',
  description:  'Crash-landed. Two survivors. Build everything.',
  version:      '1.0.0',

  planet: {
    id:               'planet_x',
    name:             'Planet X',
    atmospherePreset: 'planet_x_atm',
    T_ambient_K:      278,
    P_ambient_Pa:     101325,
    solarProfile:     'planet_x_solar',
    windProfile:      'planet_x_wind',
  },

  characters:   ['lena', 'k'],
  speciesPool:  ['H2O','O2','N2','CO2','Ar','H2','CH4','CO',
                 'NH3','CH2O','He','H2S','SO2','CH3OH','C2H5OH'],
  reactionPool: ['R_COMBUSTION_H2','R_COMBUSTION_CH4','R_ELECTROLYSIS',
                 'R_SABATIER','R_WGS','R_HABER','R_PHOTOSYNTHESIS',
                 'R_METABOLISM'],

  conclusion:   [ /* CinematicBeat[] */ ],
  arcs:         ['arc_a', 'arc_b', 'arc_c'],
  initialScene: null,
};
```

### 2.2 ArcDefinition

```javascript
ArcDefinition = {
  id:              'arc_a',
  campaignId:      'planet_x',
  title:           'Survival',
  subtitle:        'Stay alive long enough to close the carbon loop',
  index:           0,
  requires:        [],
  crewCount:       2,
  newCharacters:   [],
  intro:           [ /* CinematicBeat[] */ ],
  conclusion:      [ /* CinematicBeat[] */ ],
  missions:        ['arc_a_m1', ...],
  planetOverrides: null,
};
```

### 2.3 MissionDefinition

```javascript
MissionDefinition = {
  // ── Identity ──
  id:             'arc_a_m1',
  arcId:          'arc_a',
  index:          0,
  contentVersion: 1,           // bumped on objective/star changes
  title:          'Breathe',
  subtitle:       'The shelter has no utilities.',
  emergency:      'O₂ and battery disconnected.',

  // ── Equipment ──
  palette:         {},         // profileId → max count
  customProfiles:  [],         // mission-scoped ProfileRegistry entries
  customIcons:     {},         // profileId → icon function key
  paramLocks:      {},         // profileId → { param: lockedValue }

  // ── Chemistry gate ──
  species:         [],
  reactions:       [],

  // ── Scene ──
  inheritScene:    false,
  initialScene:    null,       // JSON string
  preplacedUnits:  [],         // unitIds player can't delete

  // ── Planet overrides ──
  planetOverrides: {},         // T_offset_K, solarMultiplier, windMultiplier

  // ── Characters ──
  narrator:        'lena',
  roomOccupants:   {},         // roomProfileId → [characterIds]

  // ── Narrative (references §MISSION-CONTENT constants) ──
  storyIntro:      [],         // CinematicBeat[]
  storyOutro:      [],         // CinematicBeat[]
  briefing:        [],         // MissionBeat[]
  victoryLine: {
    1: { speaker: 'lena', text: '...' },
    2: { speaker: 'lena', text: '...' },
    3: { speaker: 'lena', text: '...' },
  },

  // ── Objectives ──
  objectives:      [],

  // ── Stars ──
  stars: {
    1: { description: '...', criteria: [] },
    2: { description: '...', criteria: [] },
    3: { description: '...', criteria: [] },
  },

  // ── Tutorial ──
  guidanceSteps:   [],         // GuidanceStep[]

  // ── Mid-mission events ──
  triggers:        [],         // Trigger[]

  // ── Hints ──
  hints:           [],         // escalating, idle-triggered

  // ── Completion ──
  completionGated: true,       // button only when ★ achievable

  // ── Story mode UI ──
  storyUI: {
    visibleMenuItems:   ['reports', 'physicalUnits', 'clearStickers',
                         'home', 'saveCampaign'],
    hidePaletteFilter:  true,
    hidePressureSwitch: true,
    pressureMode:       'simple',
    hideDevTab:         true,
    showObjectivePanel: true,
    showStarTracker:    true,
    showRunway:         true,
  },

  // ── Rewards ──
  rewards: {
    palette:   {},
    species:   [],
    reactions: [],
  },
};
```

---

## 3. Narrative Beat Types

### 3.1 CinematicBeat

Full-screen overlay. Arc/story intro and outro. Player clicks to
advance. No game UI visible.

```javascript
CinematicBeat = {
  type: 'image' | 'title_card' | 'narrator' | 'pause',

  // image
  src:          'intro_1.webp',
  fallbackText: 'The ship breaks apart over Planet X.',
  alt:          'Crash landing',
  transition:   'fade',       // 'fade' | 'slide' | 'cut'
  duration_ms:  4000,         // null = wait for click

  // title_card
  title:        'Survival',
  subtitle:     'Two survivors. No help coming.',

  // narrator — text box, bottom of screen
  text:         'The ship hit atmosphere at 7 km/s.',
  style:        'typewriter', // 'typewriter' | 'fade' | 'instant'

  // pause
  duration_ms:  2000,

  // sound — no-op v1
  // src: '...', loop: false, volume: 0.8

  delay_ms:     0,
};
```

**Graceful degradation:** Every image beat has `fallbackText`.
Missing file → narrator text. Sound → silent. Standalone HTML
fully playable without external assets.

### 3.2 MissionBeat

Via SpeechBubble. Game visible behind (BUILD state).

```javascript
MissionBeat = {
  type: 'dialogue' | 'image' | 'system',

  // dialogue
  speaker:     'lena',
  text:        'OK so. No power, no air. Fun.',
  expression:  'disappointed',
  delay_ms:    1500,

  // Optional: adapt to current expression
  textByExpression: {
    cold:     'Still freezing. But bigger problems.',
    _default: 'Here\'s what we need to do.',
  },

  // image — inline in chat or lightbox
  src:          'story_intro_1.webp',
  fallbackText: 'The battered shelter module.',

  // system
  text:         'OBJECTIVE: Connect power to the shelter.',
  style:        'objective',  // 'objective' | 'info' | 'warning'
};
```

---

## 4. Guidance System (Tutorial)

Ordered sequential steps. Lena speaks, something highlights,
player acts, Lena reacts, next step.

### 4.1 GuidanceStep

```javascript
GuidanceStep = {
  id:         'connect_power',
  dialogue:   { speaker: 'lena', text: '...', expression: 'happy' },
  highlight:  { type: '...', /* params */ },
  completion: { type: '...', /* params */ },
  onComplete: { speaker: 'lena', text: '...' },
  delay_ms:   500,
};
```

### 4.2 Highlight Types

| Type | Visual | Params |
|------|--------|--------|
| `unit` | Glowing border | `profileId` or `unitId` |
| `port` | Pulsing indicator | `profileId`, `portId` |
| `connection` | Animated dashed guide | `fromProfile`, `fromPort`, `toProfile`, `toPort` |
| `param` | Inspector highlight | `profileId`, `paramName` |
| `palette_tile` | Glow on palette | `profileId` |
| `button` | Pulse on UI button | `buttonId` |
| `none` | Dialogue only | — |

### 4.3 Completion Types

| Type | Action | Params |
|------|--------|--------|
| `unit_selected` | Click unit | `profileId` |
| `unit_placed` | Place from palette | `profileId` |
| `connection` | Connect two units | `fromProfile`, `toProfile`, opt. ports |
| `param_value` | Set param to threshold | `profileId`, `paramName`, `min`/`max` |
| `param_changed` | Any param change | `profileId`, `paramName` |
| `play_pressed` | Press play | — |
| `pause_pressed` | Press pause | — |
| `objective_complete` | Objective met | `objectiveId` |
| `acknowledge` | Click OK | — |
| `palette_opened` | Palette drawer opened | — |
| `unit_inspected` | Inspector opened for unit | `profileId` |

### 4.4 Behavior

Steps run in order. Non-blocking — player can act freely. Optional
per mission (M1: many, M10: zero). Resets on revert/restart.
Compatible with triggers.

---

## 5. Trigger System

Condition-action pairs firing during gameplay.

### 5.1 Trigger

```javascript
Trigger = {
  id:        'scrubber_low',
  once:      true,
  delay_s:   0,
  condition: { type: '...', /* params */ },
  action:    { type: '...', /* params */ },
};
```

### 5.2 Condition Types

| Type | Params |
|------|--------|
| `time_elapsed` | `seconds` |
| `idle_seconds` | `seconds` (no player action for N s; resets on any canvas action) |
| `depletion_below` | `profileId`, `threshold` (0–1) |
| `species_above` | `species`, `location`, `threshold` (mol frac) |
| `species_below` | `species`, `location`, `threshold` |
| `temperature_above` | `location`, `T_K` |
| `temperature_below` | `location`, `T_K` |
| `power_deficit` | `seconds` |
| `alarm_active` | `severity` (WARNING/ERROR/CATASTROPHIC) |
| `crew_state` | `state` (fainting/recovering/death) |
| `inventory_below` | `profileId`, `species`, `threshold_mol` |
| `objective_complete` | `objectiveId` |
| `all_objectives_complete` | — |
| `unit_placed` | `profileId` |
| `connection_exists` | `fromProfile`, `toProfile`, `portType` |

### 5.3 Action Types

| Type | Params |
|------|--------|
| `dialogue` | `speaker`, `text`, `expression`, `autoPause` |
| `system_message` | `text`, `style` |
| `show_image` | `src`, `fallbackText`, `duration_ms` |
| `update_objective` | `objectiveId`, `description` |
| `unlock_palette` | `profileId`, `count` |
| `set_param` | `profileId`, `param`, `value` |

All declarative. No closures, no eval.

**`autoPause`:** When true on a dialogue or system_message action,
the game pauses when the trigger fires. Used for critical moments
(crisis warnings, near-death). Most triggers don't pause.

---

## 6. Objective Evaluators

10 types, each pure function `(params, scene, runtime) → { met, progress }`.

Return value includes `met` (boolean) and `progress` (human-readable
string describing current state vs target, shown in objective panel).

| Type | Description | Key params |
|------|-------------|------------|
| `convergence` | Steady state | — |
| `connection` | Ports connected | `fromProfile`, `toProfile`, `portType` |
| `connection_absent` | Ports NOT connected | `fromProfile`, `toProfile` |
| `store_component` | Moles in tank | `species`, `minMoles`, `minPurity` |
| `maintain_conditions` | Room held for duration | `unit`, `conditions`, `duration_s` |
| `power_output` | Power ≥ threshold | `min_W`, `duration_s` |
| `flow_rate` | Flow rate bounds | `species`, `min_molPerS`, `max_molPerS`, `targetProfile`, `portId` |
| `port_conditions` | Port stream T/P bounds | `targetProfile`, `portId`, `T_gte`, `T_lte`, `P_gte`, `P_lte` |
| `depletion_guard` | Resource above threshold | `species`, `minMoles`, `duration_s` |
| `inventory_trend` | Tank level direction | `targetProfile`, `species`, `trend` ('increasing'/'decreasing'), `duration_s` |

**`maintain_conditions` keys:**

```
T_K_gte, T_K_lte              Room temperature (K)
O2_pct_gte, O2_pct_lte        O₂ mol%
CO2_pct_gte, CO2_pct_lte      CO₂ mol%
curtailment_zero               No power consumer curtailed (boolean)
```

**Progress strings:** Each evaluator returns a progress description.
Examples:
- `connection`: "Not connected" / "Connected ✓"
- `maintain_conditions`: "T = 284K (need ≥ 288K)" / "T = 295K ✓ (12s / 120s)"
- `flow_rate`: "O₂ flow: 0 mol/s (need ≥ 0.001)" / "O₂ flow: 0.003 mol/s ✓"

Displayed in the objective panel so the player sees what's missing.

**Validation:** All condition keys, profile IDs, species IDs, and
port IDs validated at MissionRegistry.register() time. Unknown keys
produce a clear error: "M5 objective 'connect_food': unknown
profileId 'food_crte' — did you mean 'food_crate'?"

---

## 7. Star System

### 7.1 Criteria Types

All objective evaluator types plus:

| Type | Description |
|------|-------------|
| `all_objectives_complete` | All primary objectives met |
| `time_limit` | Within `maxSeconds` |
| `unit_count_limit` | ≤ N units |
| `efficiency_gte` | KPI ≥ threshold |

### 7.2 Progressive Feedback

Stars tracked live in HUD: `★ ☆ ☆` → `★ ★ ★`. Reflects current
state. Stars dim if conditions drift.

### 7.3 Player-Initiated Completion

No auto-complete. "Complete Mission" button appears when ★
achievable. Stars lock on click. Enables ★★★ pursuit.

### 7.4 Star Criteria Inspector (Dev Tool)

Available via keyboard shortcut. Shows for the current scene state:
each star criterion, its current measured value, its threshold, and
pass/fail. Works in both sandbox and campaign mode. Essential for
calibrating star thresholds during content authoring.

### 7.5 Content Authoring Rule

All star criteria in content docs are draft values requiring
playtesting. Each threshold should include a rationale comment:

```javascript
// ★★★ CO2 < 0.1% for 60s
//   Rationale: ISS target is 0.4%. 0.1% requires oversized
//   scrubber — rewards precise engineering.
```

---

# Part II — Characters

## 8. Character System

### 8.1 CharacterRegistry

NNG-10 pattern. Migrates `_CHARACTERS.lena`. K is silent, suited,
the player. K is NOT rendered in the room — the camera IS K. Lena
talks to the camera.

```javascript
CharacterRegistry.register('k', {
  name: 'K',
  role: 'Space mechanic. The player.',
  background: 'Unknown. Never leaves suit.',
  personality: { core: ['Silent', 'Resourceful', 'Present'] },
  voice: null, bubble: null, silence: null,
});
```

K can't die independently — same room conditions as Lena.

### 8.2 Mission Binding

```javascript
{ narrator: 'lena', roomOccupants: { 'shelter': ['lena', 'k'] } }
```

Different missions can use different narrators.

### 8.3 Arc B Characters

Arc B adds 4 characters. Each needs a full character sheet
(personality, voice rules, bubble colors) comparable to Lena's.
This is a content task, not an architecture change.

---

## 9. Speech Priority System

Lena has multiple speech sources that can collide. Priority
prevents her talking over herself.

### 9.1 Priority Levels

```javascript
const SpeechPriority = {
  BRIEFING:    100,
  GUIDANCE:     90,
  TRIGGER:      80,
  GAME_OVER:    80,
  HINT:         60,
  ROOM_DIAG:    40,  // existing CharacterVoice autonomous speech
  IDLE:         10,
};
```

### 9.2 Suppression Rules

- Higher-priority message suppresses lower for a cooldown window.
- During BRIEFING state: ROOM_DIAG and IDLE fully muted.
- After each guidance step: ROOM_DIAG suppressed for 5 seconds.
- TRIGGER dialogue suppresses IDLE but not GUIDANCE.

### 9.3 Source Tagging

Every SpeechBubble message carries a `source` field:

```javascript
SpeechBubble.push({
  text: '...',
  source: 'briefing' | 'guidance' | 'trigger' | 'hint' |
          'room_diag' | 'idle' | 'system',
  priority: 100,
  speaker: 'lena',
});
```

**Visual differentiation:** System messages (objectives) get a
distinct style. Briefing/guidance messages can have a subtle
indicator. Room diagnostics are the existing Lena chat style.

### 9.4 Poke System — Campaign Extension

Clicking Lena in campaign mode intercepts the existing poke system:

```
Poke 1:  Next undelivered hint (if available)
Poke 2:  Restate current objective
Poke 3:  Recap last guidance step (if guidance active)
Poke 4+: Existing personality escalation (annoyance tiers)
```

First pokes are always useful ("Lena, help"). The player doesn't
know the system — they click Lena when stuck, she helps. If they
keep clicking, she gets sassy. Natural, discoverable, no new UI.

Implementation: `CharacterVoice.onPoke()` checks campaign context
first, falls back to existing personality poke logic.

---

# Part III — Game Flow

## 10. Mission Phase Sequence

```
1. STORY_INTRO     CinematicBeat overlay. Can be empty.
2. BRIEFING        Lena speaks in BUILD state.
3. GAMEPLAY        Build, run, guidance, triggers, stars.
4. COMPLETION      Player clicks Complete. Evaluate. Lock stars.
5. VICTORY         Popup: stars, Lena, encouragement.
6. STORY_OUTRO     CinematicBeat overlay. Can be empty.
7. → Next STORY_INTRO (or ARC_CONCLUSION)
```

### 10.1 Story Intro vs Outro

| Phase | Purpose | Example |
|-------|---------|---------|
| Intro | Set up crisis | M9: "Scrubber gauge red." |
| Outro | Emotional payoff | M8: "Shower. Coffee." |

Either can be empty. System skips.

### 10.2 Cinematic Safety Rule

**On entering STORY_INTRO, STORY_OUTRO, ARC_INTRO, ARC_CONCLUSION,
CAMPAIGN_CONCLUSION, or VICTORY:** if `TimeClock.mode === 'playing'`,
call `stopPlay()`. Simulation frozen for duration of any overlay.
On exiting, transition to BUILD. Player must press play to resume.

The player's plant must never silently run while they're reading
narrative text.

### 10.3 Victory Screen

Modal overlay: title, animated stars, descriptions, Lena's HUD
portrait (current expression), victory line per star count,
"Continue" button.

### 10.4 Game Over

Lena dies (`crewState === 'death'`):
1. Auto-pause. 1–2s stillness.
2. Dark overlay. "Lena didn't make it."
3. "Revert" (last checkpoint) or "Restart Mission."
4. Career save NOT lost.

Safety: crewState fainting/death at briefing → game-over.

### 10.5 Beats and Pause/Play

- **Briefing:** BUILD state (paused). Correct.
- **Guidance:** Works in BUILD and RUN. No auto-pause. Dialogue in
  chat, highlight on canvas. Player in control.
- **Trigger dialogue:** No auto-pause by default. Set `autoPause: true`
  on action for critical moments (crisis, near-death).
- **Cinematics:** Full-screen overlay, simulation stopped (§10.2).

---

## 11. State Machine

### 11.1 Modes and States

```javascript
GameMode:  SANDBOX | CAMPAIGN
PlayState: TITLE | CAREER_LIST | ARC_INTRO | STORY_INTRO | BRIEFING |
           BUILD | RUN | PAUSED | EVALUATE | VICTORY | STORY_OUTRO |
           ARC_CONCLUSION | CAMPAIGN_CONCLUSION | GAME_OVER
```

### 11.2 Transitions

```
TITLE
  ├─ "Planet X"  → CAREER_LIST
  └─ "Sandbox"   → BUILD

CAREER_LIST
  ├─ "New Career" → name prompt → ARC_INTRO
  ├─ "Resume"     → BUILD
  └─ Back         → TITLE

ARC_INTRO      → STORY_INTRO (first mission)
STORY_INTRO    → BRIEFING
BRIEFING       → BUILD

BUILD  → RUN      (play; auto-checkpoint)
RUN    → PAUSED   (pause or alarm)
RUN    → BUILD    (stop)
PAUSED → RUN      (resume)
PAUSED → BUILD    (stop)

Any gameplay → EVALUATE  ("Complete Mission")
EVALUATE → VICTORY       (pass)
EVALUATE → BUILD         (fail; feedback)

VICTORY     → STORY_OUTRO
STORY_OUTRO → STORY_INTRO (next mission)
STORY_OUTRO → ARC_CONCLUSION (last in arc)

ARC_CONCLUSION → ARC_INTRO (next arc)
ARC_CONCLUSION → CAMPAIGN_CONCLUSION → TITLE

RUN       → GAME_OVER   (Lena dies)
GAME_OVER → BUILD       (revert or restart)

Any gameplay → TITLE     (Home; autosave)
```

### 11.3 Edit Guards

- **BUILD:** All edits. Frozen (dt = 0).
- **RUN/PAUSED:** No add/delete/connect. Params + valves live.
- **Preplaced units:** Can't delete/disconnect. Lock icon.

### 11.4 Checkpoints

Stack of 5. Resets at mission boundaries. CATASTROPHIC → auto-pause.
Resume → BUILD (never into running sim).

---

# Part IV — Equipment & Climate

## 12. Palette Scarcity

`effectivePalette = mission.palette + cumulative rewards`.

In `populatePalette()`: not in palette → hidden. Placed ≥ max →
greyed + "0 left". Else → count badge. Profiles in mission.palette
shown regardless of `composite: true`. Custom profiles flagged
`_missionScoped`, deregistered on exit. ParamLocks → read-only
in inspector with lock icon. Sandbox: fully unlocked.

## 13. Climate

Diurnal (S-DIURNAL) always active. `planetOverrides`:
`T_offset_K`, `solarMultiplier`, `windMultiplier`.

## 14. Thermodynamic Model

Ideal gas + Antoine for v1. S-HENRY required before M9.

---

# Part V — Completion Robustness

## 15. Inherited Health Checks

**Design rule:** Every mission from M3 onwards must include baseline
health objectives (water flowing, O₂ flowing, air loop intact)
alongside mission-specific objectives. The player must maintain
everything they've built while adding new systems.

This prevents: player breaks water supply to make room for food
crate, clicks "Complete Mission" for M5, advances to M6 with a
dying crew. With health check objectives, M5 won't complete unless
water is still flowing.

## 16. Completion Evaluation

On "Complete Mission" click:
1. Game pauses.
2. All objectives re-evaluated at that instant.
3. All star criteria checked.
4. If any primary objective fails → feedback with progress strings
   ("Water: not connected"), return to BUILD.
5. If all pass → stars locked, victory screen.

TOCTOU gap (conditions drift between button appearing and click) is
handled by re-evaluation at click time. Small gap, caught cleanly.

Career saves record `contentVersion` alongside stars. If mission
criteria change later, existing completions preserved.

---

# Part VI — Stuck Player Support

## 17. Hint Escalation

Hints use `idle_seconds` triggers — time since last player action,
not mission elapsed time. Resets on any canvas action (place, connect,
select, param change, play/pause).

```javascript
hints: [
  { trigger: { type: 'idle_seconds', seconds: 60 },
    text: 'The electrolyser splits water into H₂ and O₂.',
    speaker: 'lena' },
  { trigger: { type: 'idle_seconds', seconds: 120 },
    text: 'Connect the O₂ output to the shelter.',
    speaker: 'lena' },
  { trigger: { type: 'idle_seconds', seconds: 180 },
    text: 'The O₂ port is on the left side of the shelter.',
    speaker: 'lena' },
],
```

Each fires once. Escalates from conceptual to specific.

## 18. Ask Lena (Poke)

Click Lena → next undelivered hint → objective restate → guidance
recap → personality escalation. See §9.4.

## 19. Objective Panel

Shows each objective with progress string from evaluator:
"Connect water to shelter — water barrel not placed yet."
Player always knows what's missing.

---

# Part VII — Persistence

## 20. CampaignState

```javascript
CampaignState = {
  careerName, campaignId, careerVersion: 1,
  currentArcId, currentMissionId,
  completed: Map(missionId → { stars, contentVersion, timestamp }),
  arcCompleted: Set,
  cumulativePalette: {},
  unlockedSpecies: Set, unlockedReactions: Set,
  missionEndScenes: Map, arcEndScenes: Map,
  gameDay: 0,
  serialize(), deserialize(),
  applyRewards(), getEffectivePalette(),
  getEffectiveSpecies(), getEffectiveReactions(),
  getStartingScene(),
};
```

## 21. Save Format

```javascript
CareerSave = {
  careerVersion: 1,
  careerName, campaignId, campaignState, currentScene, timestamp
};
```

Scene carries own version (19). Up to 10 careers. JSON export/import.
Autosave on completion + periodic. Checkpoints reset per mission.
Resume → BUILD. Cloud-ready (single JSON blob).

---

# Part VIII — UI

## 22. Title Screen

**Planet X** (career list), **Sandbox**, **Scenarios** (coming soon).

## 23. Career List

New (name prompt), resume, delete. Name, mission, stars, date.

## 24. Story Mode

Menu: Reports, Physical Units, Clear Stickers, Save, Home.
Palette: scarcity badges, no filters.
HUD: objectives with progress, stars, "Complete Mission", runway,
guidance step indicator, day counter.

---

# Part IX — Assets

## 25. Naming Convention

```
assets/campaigns/planet_x/
  arc_a/
    intro_1.webp
    conclusion_1.webp
    m1/
      story_intro_1.webp
      story_outro_1.webp
    m2/ ...
```

Beat `src` is a filename. Resolved by convention relative to
arc or mission path. Missing → `fallbackText`. Graceful always.

---

# Part X — Dev Tools

## 26. Beat Preview

Keyboard shortcut (Ctrl+Shift+B). Sequence picker across all
registered beats. Prev/next/auto. Renders exactly as in-game.
Mock star count toggle for victory. Decoupled from game state.

## 27. Star Criteria Inspector

Keyboard shortcut. Shows per-criterion: current value, threshold,
pass/fail. Works in sandbox and campaign. For calibrating thresholds.

## 28. §MISSION-CONTENT Section

All narrative text in one marked section. Indexed in file header.
Visual dividers: `═══ M{N} — {Title}`. Constants referenced by
registrations. Separated from structural data.

```javascript
// ═══════════════════════════════════════════════════════════════
// §MISSION-CONTENT — All mission narrative text lives here.
//
// Edit directly. Image src resolved by naming convention.
// Read §LENA-SPEECH before writing Lena lines. K never speaks.
//
// ── Condition keys cheatsheet ─────────────────────────────────
// maintain_conditions:
//   T_K_gte, T_K_lte             Temperature (K)
//   O2_pct_gte, O2_pct_lte       O₂ mol%
//   CO2_pct_gte, CO2_pct_lte     CO₂ mol%
//   curtailment_zero              No power curtailment
// Objective types:
//   connection        { fromProfile, toProfile, portType }
//   connection_absent { fromProfile, toProfile }
//   maintain_conditions { unit, conditions, duration_s }
//   power_output      { min_W, duration_s }
//   flow_rate         { species, min_molPerS, max_molPerS, targetProfile }
//   port_conditions   { targetProfile, portId, T_gte, T_lte }
//   store_component   { species, minMoles, minPurity }
//   convergence       {}
//   depletion_guard   { species, minMoles, duration_s }
//   inventory_trend   { targetProfile, species, trend, duration_s }
// ═══════════════════════════════════════════════════════════════

// ─── Arc A Intro ──────────────────────────────────────────────
const _ARC_A_INTRO = [ /* CinematicBeat[] */ ];
const _ARC_A_CONCLUSION = [ /* CinematicBeat[] */ ];

// ═══ M1 — Breathe ═════════════════════════════════════════════
const _M1_STORY_INTRO = [ /* CinematicBeat[] */ ];
const _M1_BRIEFING    = [ /* MissionBeat[] */ ];
const _M1_VICTORY     = { 1: {...}, 2: {...}, 3: {...} };
const _M1_STORY_OUTRO = [ /* CinematicBeat[] */ ];

// ═══ M2 — Clear the Air ══════════════════════════════════════
// ...
```

## 29. Mission Editor

Deferred. Revisit after authoring M1–M3 manually. If editing
§MISSION-CONTENT + beat preview + validation is sufficient, no
editor needed. If frustrating, build a structured form tool that
generates copy-pasteable code.

---

# Part XI — Registries

## 30. New

`CampaignRegistry`, `ArcRegistry`, `MissionRegistry`,
`CharacterRegistry` — NNG-10 pattern, frozen on registration.

**Validation at registration:** species/reactions ⊆ campaign pool.
Palette profileIds exist. Objective types known. Condition keys
validated. Star criteria types known. Trigger condition/action types
known. **Clear error messages on failure** with suggestions for
typos.

## 31. Extended

ProfileRegistry: mission-scoped temp registration (`_missionScoped`).

---

# Part XII — Sequences

## 32. Mission Load

1. **stopPlay() if running.** (Cinematic safety.)
2. Play storyIntro (cinematic). Skip if empty.
3. Load starting scene.
4. Custom profiles/icons.
5. ParamLocks.
6. Effective palette.
7. Species/reaction gates.
8. Planet overrides.
9. Room occupants.
10. Preplaced unit flags.
11. StoryUI.
12. Clear checkpoint stack.
13. Init guidance, triggers, hints.
14. **Safety:** crewState fainting/death → game-over.
15. Play briefing (SpeechBubble).
16. "Start Building" → BUILD.

## 33. Mission Completion

1. Pause.
2. Evaluate objectives (all must pass).
3. Lock stars + contentVersion.
4. Victory screen.
5. "Continue."
6. Record end scene + stars in CampaignState.
7. Apply rewards.
8. Autosave.
9. **stopPlay().** Play storyOutro. Skip if empty.
10. → Next STORY_INTRO or ARC_CONCLUSION.

## 34. Quit to Title

1. Autosave.
2. Deregister mission-scoped.
3. Remove locks, overrides.
4. Restore UI.
5. → TITLE.

---

# Part XIII — Code Relationship

**Unchanged:** TimeClock, UnitRegistry, ComponentRegistry,
ReactionRegistry, solver, flash, ThermoAdapter, icons, particles,
smoke, NNG 1–15, tests, exportJSON/importJSON (v19), DemoScenes.

**Extended:** _CHARACTERS → CharacterRegistry. CharacterVoice →
parameterized + priority + campaign poke. SpeechBubble → source
tagging + priority suppression. populatePalette → scarcity.
enterGame/goHome → campaign. Title screen → buttons.
ProfileRegistry → temp. Inspector → locks.

**New:** All registries, CampaignState, GameMode/PlayState,
evaluators (10), stars, guidance + highlighter, triggers,
cinematic player, mission beat player, career list, save manager,
HUD (objectives + progress, stars, runway, guidance, Complete
button), palette scarcity, asset loader, victory/game-over screens,
speech priority system, beat preview, star inspector,
§MISSION-CONTENT section.

---

# Part XIV — Sound

No audio v1. Schema placeholders. No-ops. Ready for future.

---

# Part XV — Implementation

**Phase 1** — Registries, data layer, validation, evaluators (10),
CampaignState, palette computation. Tests.

**Phase 2** — State machine, career saves, checkpoint boundary,
cinematic safety (stopPlay on overlays). Tests.

**Phase 3** — Speech priority + source tagging. CharacterVoice
campaign poke. CinematicBeat player. MissionBeat player. Graceful
degradation. Trigger engine. Guidance + GuidanceHighlighter.
Beat preview. Star inspector. Tests.

**Phase 4** — Title screen. Career list. Palette scarcity badges.
Story mode menu/HUD (objectives + progress, stars, Complete button,
runway, guidance). ParamLock inspector. Victory screen. Game-over
overlay. Tests.

**Phase 5** — Arc A content. §MISSION-CONTENT text. 10 missions.
Custom profiles. Objectives with inherited health checks. Stars
with rationale comments. Triggers. Guidance. Hints with idle
escalation. Images. Initial scenes. Playtesting + star calibration.

**Prerequisite** — S-HENRY sprint before M9 content.
