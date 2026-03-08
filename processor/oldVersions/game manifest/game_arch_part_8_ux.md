# PROCESS THIS IN SPACE — Part VIII: USER EXPERIENCE

---

# PART VIII — USER EXPERIENCE

---

## 51. The 3D View (Primary Interface)

The 3D view is the game. Not an optional visualization mode, not a secondary rendering of a flowsheet — it is the world the player inhabits. Equipment has physical presence, pipes run between real ports on real machines, vapor plumes rise from vents, compressors vibrate, turbines whine. The player's first instinct should be to look around, walk up to something, and click it.

### Design Heritage

The 3D view draws from three genres simultaneously:

**City builder.** The base is a settlement that grows. Empty hangar floor → first equipment → piping → power plant → greenhouse dome → cryo section with frost and vapor. The visual density of the base IS the score. A player who pulls back the camera at M9 should see a complex, living facility and feel pride. This is the SimCity/Cities Skylines reward: "I made this."

**Factory builder.** Satisfactory proved that 3D pipe-laying is inherently satisfying. Routing a pipe from a compressor outlet to a reactor inlet, choosing the path, bending around other equipment, snapping to a rack — this is play, not work. Every connection the player makes is visible and physical. No abstract flowsheet wires. Real pipes.

**Survival game.** The planet is visible beyond the shelter walls. Alien landscape, hostile atmosphere, geothermal vents venting alien gas. After M5, the player can look outside through the airlock. The environment is beautiful and lethal. Contrast between the warm amber interior and the cold blue exterior.

### World Structure

```
┌──────────────────────────────────────────────────────────────────┐
│                         THE GAME WORLD                            │
│                                                                   │
│  [Hangar Module]  ══════  [Near Wreckage]  ═══  [Mid-field]      │
│   ┌────────────┐            scattered              scattered      │
│   │ SHELTER    │            debris 50-200m          debris 500m+  │
│   │ (playable  │                                                  │
│   │  interior) │          [Propulsion Wreck] ←── M4 expedition    │
│   │            │            500m-1km                               │
│   │ [VENT #1]  │                                                  │
│   └────────────┘          [Chemistry Lab] ←── M7 expedition       │
│   ┌────────────┐            800m                                  │
│   │ PROCESS    │                                                  │
│   │ FLOOR      │          [Cargo Hold] ←── M9 expedition          │
│   │ (buildable │            1.5km                                 │
│   │  area)     │                                                  │
│   │            │          [Bow Section] ←── M6 expedition          │
│   └────────────┘            2km NW                                │
│                                                                   │
│  ══ accessible path (grows with EVA capability)                   │
└──────────────────────────────────────────────────────────────────┘
```

The playable area is the hangar module's interior process floor (~20m × 30m). Equipment is placed here. The surrounding crash site is visible but not directly playable — salvage expeditions are narrative events (cutscenes + inventory rewards), not exploration gameplay. This keeps the scope tight: one room, one camera, one building challenge.

### Camera

Orbit camera (Three.js OrbitControls or equivalent). Center of orbit is the process floor center. The player can rotate, zoom, and pan. Camera bounds prevent going below ground or too far from the hangar.

Camera presets (keyboard shortcuts or UI buttons):
- **Overview:** pulled back, 45° angle, sees entire process floor
- **Equipment focus:** zoom to selected unit, centered
- **Ground level:** near-horizontal, walk-through feel
- **Exterior:** outside the hangar, looking at the shelter from the planet surface (available after M5 airlock activation)

### Equipment Placement

The player picks equipment from the palette (§54), then places it on the process floor by clicking a location. Equipment snaps to a coarse grid (1m resolution). Rotation in 90° increments. A ghost preview shows the footprint and port locations before placement.

Equipment cannot overlap. Equipment cannot be placed outside the process floor boundary. Clearance rules enforce minimum spacing (0.5m between units) for pipe routing.

Equipment placement is a **topology edit** — it pauses the world (§58).

### Pipe Laying

The core physical interaction. The player clicks an output port on one unit, then routes a pipe to an input port on another. The pipe is a physical 3D object — cylindrical geometry following a player-defined path.

Pipe routing options:
- **Auto-route:** click source port, click destination port. Engine finds a path avoiding obstacles. Quick, functional, but paths may be ugly.
- **Manual route:** click source port, then click waypoints on the ground or pipe rack to define the path. Click destination port to complete. More control, more satisfying, more time.
- **Rack snap:** pipes can snap to horizontal/vertical rack lines, creating organized routing that looks industrial.

Pipe colors indicate content: blue (water/liquid), red (hot gas), white (steam), yellow (fuel/CH₄), green (air/O₂), gray (inert/N₂), amber (NH₃). Color updates live based on what's flowing.

Pipe laying is a **topology edit** — it pauses the world (§58).

### Visual Feedback — The Life of the Plant

When the world is running, everything moves:

| State | Visual effect |
|-------|---------------|
| Fan spinning | Air cooler fin-fan rotates |
| Gas flowing | Faint particle streams along pipes (direction arrows) |
| Liquid flowing | Visible drip/stream at pipe bends |
| Compressor running | Vibration shimmer, motor hum |
| Turbine running | Exhaust shimmer, whine pitch tied to speed |
| Reactor hot | Orange/red glow through insulation |
| Heater active | Element glow visible |
| Tank filling | Level indicator rises |
| Flash drum separating | Liquid dribble at bottom, vapor swirl at top |
| Cryo equipment | Frost formation on cold surfaces, vapor plumes |
| Greenhouse | Green glow from grow lights, visible plant growth |

These are not cosmetic — they're diagnostic. A player who sees no shimmer behind the air cooler knows the fan isn't running. A player who sees the reactor not glowing knows it's cold. The visual state IS the process state (NNG-3 extended to 3D).

### Failure Animations

When something goes wrong, it should be spectacular and informative:

| Failure | Visual |
|---------|--------|
| Overpressure | Tank bulges, seams glow, then rupture → gas jet, debris, screen shake |
| Overtemperature (reactor) | Catalyst glows white, vessel deforms, smoke |
| Overtemperature (turbine) | Blade glow, grinding sound, disintegration sparks |
| Compressor surge | Violent shaking, reversal puff from inlet |
| Flash drum flooding | Liquid overflows from vapor port, spray |
| Dead-head pump | Vibration increases, motor overheats, smoke |
| Loss of seal (valve) | Gas leak jet, hissing sound |

These failures trigger a 3-5 second "disaster sequence" before the game offers the checkpoint reset. They teach — the player sees exactly what broke and can infer why. Kerbal's lesson: watching your rocket explode is the best teacher.

### Ambient Environment

The hangar interior starts dark and cold. As the colony progresses:

| Phase | Lighting | Atmosphere |
|-------|----------|------------|
| M1–M3 | Emergency red LEDs only | Cold, dark, cramped |
| M4 | White lights snap on (power!) | Still cold, but visible |
| M5 | Airlock LEDs green | First sense of control |
| M6 | Warm amber shift | Comfortable. Frost melts off walls |
| M7+ | Greenhouse green glow | Life. Growth. Hope |
| M10 | Full warm lighting, plants visible | Home |

Sound design follows the same arc: hissing vent gas → clicking equipment → humming machines → full industrial ambiance → birdsong (from greenhouse speakers? An audio easter egg).

### Dual Coordinate System (NNG-G7)

Every unit has two independent position fields:
- `u.x, u.y` — integer grid coordinates for the flowsheet (§52)
- `u.pos3d` — `{ x, y, z, rotY }` floating-point world meters for 3D

Moving equipment in 3D never affects its flowsheet position. Moving it on the flowsheet never affects its 3D position. They are independent representations of the same logical entity.

---

## 52. The Flowsheet (Secondary / Derived)

The flowsheet is a Process Flow Diagram (PFD) — the engineer's view. It shows the logical topology: units as symbols, connections as lines, flow direction, species labels, conditions. It is automatically generated from the 3D scene's connection topology and available whenever the player wants an analytical view.

### Why It Exists

Not every player will use the flowsheet. Many will play entirely in 3D, especially early on. But for players who want to optimize — understand recycle ratios, trace flow paths, debug mass balance issues — the flowsheet is indispensable. It shows information that 3D cannot: every stream composition, every temperature, every flow rate, in a format engineers have used for 150 years.

The flowsheet is also the fallback for early development phases. Before 3D pipe-laying is fully implemented, the flowsheet is where connections are made. This is pragmatic: the existing processThis SVG renderer is working and tested. Ship the game loop in 2D first, then layer 3D on top.

### Auto-Layout

When the player opens the flowsheet, units are automatically placed on a grid derived from their logical position in the connection graph. The layout algorithm:

1. Identify the longest path (source → ... → sink). Lay it out left to right.
2. Place side branches above/below the main path.
3. Recycle streams wrap from right to left with curved connectors.
4. Spacing: 2 grid cells between units minimum.

The auto-layout is functional, not beautiful. But this is a feature, not a bug — reorganizing a messy auto-layout into a clean, readable PFD is inherently satisfying. Drag-and-drop unit repositioning on the flowsheet grid, with connections re-routing automatically, is a mini-game of its own.

### Manual Reorganization

The player can drag any unit to a new grid position. Connections re-route automatically (Manhattan routing). The flowsheet arrangement is saved independently of 3D positions (NNG-G7). A player who carefully organizes their M7 Haber loop flowsheet will find it exactly as they left it next time they open it.

### Flowsheet Information Density

The flowsheet shows information that the 3D view cannot efficiently display:

| Information | Flowsheet display | 3D equivalent |
|-------------|------------------|---------------|
| Stream composition | Labels on each connection line | Only visible in inspector |
| Temperature/pressure | Annotated on connections | Color coding (approximate) |
| Flow rate | Numerical on connections | Particle speed (qualitative) |
| Recycle loops | Clearly visible as wraparound | Hard to trace in 3D spaghetti |
| Mass balance | Compare inlet/outlet numbers | Not visible |
| Power distribution | Electrical connections shown explicitly | Wire routing (if visible) |

### View Toggle

A single button (or keyboard shortcut) switches between 3D and flowsheet. The transition should be smooth — a brief crossfade, not a jarring cut. The currently selected unit remains selected across the switch. The inspector stays open.

### Flowsheet as Connection Tool (Development Phase)

During early development (before 3D pipe routing is complete), the flowsheet is where the player adds and removes connections. Equipment placement can be 3D-first, but "wire it up" happens on the flowsheet. This is acceptable — even Satisfactory uses a simplified schematic view for complex logistics. The flowsheet is not a lesser experience; it's a different tool.

---

## 53. The Inspector

The inspector is the player's primary information and control panel. Click any unit — in 3D or on the flowsheet — and the inspector opens on the right side of the screen. It is the same panel regardless of which view you're in.

### Inspector Layout (NNG-15 Extended)

The section order is fixed and immutable:

```
┌─────────────────────────────────────────┐
│ [Unit Icon] COMPRESSOR-2                 │
│ "Diaphragm Compressor"                   │
│ Mission: M4 — Power                      │
├─────────────────────────────────────────┤
│ ▸ PARAMETERS                             │
│   P_out:  ████████████░░  5.0 bar  [▼]  │
│   η:      0.75  [locked 🔒]             │
├─────────────────────────────────────────┤
│ ▸ CONDITIONS                             │
│   Inlet:  288 K,  0.9 atm               │
│   Outlet: 476 K,  5.0 bar               │
├─────────────────────────────────────────┤
│ ▸ FLOW RATES                             │
│   In:  0.030 kg/s  (0.97 mol/s)         │
│   Out: 0.030 kg/s  (0.97 mol/s)         │
├─────────────────────────────────────────┤
│ ▸ COMPOSITION                            │
│   O₂: 21.0%  N₂: 70.0%  CO₂: 8.0%      │
│   Ar: 1.0%                               │
├─────────────────────────────────────────┤
│ ▸ POWER & ENERGY                         │
│   Shaft work:  1,847 W                   │
│   Motor draw:  2,463 W (η_motor=0.75)    │
├─────────────────────────────────────────┤
│ ▸ ALARMS                                 │
│   ⚠ Discharge T approaching limit (476/500 K) │
│   "Hot discharge — consider intercooling" │
│     — Dr. Vasquez                         │
└─────────────────────────────────────────┘
```

### Section Behavior

**Parameters:** Editable fields. Sliders, dropdowns, or direct numeric input. Locked parameters show a lock icon and are greyed out (from `paramLocks` in mission definition). Allowed-value parameters show a dropdown instead of a free input (from `paramAllowed`). Parameter changes during run mode are **live** — the solver picks them up on the next tick. Parameter changes during build mode take effect on next play.

**Conditions:** Read-only. Shows current T, P, phase at each port. Updated every solver tick. Color-coded: green (normal), amber (approaching limit), red (at/over limit).

**Flow Rates:** Read-only. Total mass and molar flow at each port. Species breakdown available by expanding.

**Composition:** Read-only. Mole fraction of each species at the outlet. Phases annotated (V for vapor, L for liquid, VL for two-phase).

**Power & Energy:** For powered units (compressor, heater, electrolyzer, pump): shows power demand, actual power received, and curtailment factor if applicable. For power producers (turbine): shows power output.

**Alarms:** Any active alarms for this specific unit. Each alarm shows severity icon, message, and an Expert comment (if available). Clicking the Expert comment opens a dialogue window with the full hint.

### Empty Section Rule

Empty sections are omitted entirely — never shown hollow. A flash drum has no Power section. A tank has no Reaction section. The inspector only shows what's relevant (NNG-15).

### Expert Integration

The inspector's alarm section includes Expert commentary. Additionally, a small "Ask Dr. Vasquez" button at the bottom of any unit's inspector opens a contextual dialogue:

- For a flash drum: "Gravity does the work. Hot gas in, liquid falls, vapor rises."
- For a compressor near its limit: "That discharge temperature is getting hot. Two-stage with intercooling would keep things safer."
- For a reactor not converting: "Check the equilibrium. At this temperature, the reaction barely moves. You need heat — or more pressure."

These are pre-written contextual strings, not dynamic AI generation. They're keyed to unit type + operating conditions.

---

## 54. The Palette & Scarcity UI

The palette is where equipment comes from. It is the physical manifestation of scarcity — you can see everything that exists, but you can only use what you have.

### Palette Layout

```
┌─────────────────────────────────────────┐
│ SALVAGED EQUIPMENT                       │
│                                          │
│ [🌡 Air Cooler]  2× ██                  │
│ [⚗ Flash Drum]  1× █                    │
│ [📦 Tank]        3× ███                  │
│ [⚡ Electrolyzer] 1× █                  │
│ [🔄 Mixer]       1× █                   │
│ [⚙ Compressor]   0× ░░  (all placed)   │
│                                          │
│ ─── LOCKED ───                           │
│ [🔒 Heater]      "Found in chemistry lab │
│                    — not yet accessible"  │
│ [🔒 Splitter]    "Pipe tee from lab      │
│                    — need M7 expedition"  │
└─────────────────────────────────────────┘
```

### Count Badge Mechanics

Each equipment type shows `N×` where N = available (total owned minus placed). When N = 0, the entry is dimmed — all units are placed, none left in inventory. When N > 0, the entry is bright and clickable.

Placing a unit: N decreases by 1. Deleting a placed unit: N increases by 1. The palette updates immediately.

### Tease Entries

Equipment that will be available in future missions appears at the bottom of the palette, greyed and locked. Each shows a narrative reason it's unavailable: "Found in propulsion wreck — need EVA capability" or "Requires expedition to cargo hold." This serves two purposes: it shows the player what's coming (motivation to progress), and it explains why equipment is scarce (narrative coherence, not arbitrary limitation).

### Parameter Lock Indicators

When the player places a unit and opens its inspector, locked parameters are visually distinct:

- **Fixed value:** Grey background, lock icon, not editable. Tooltip: "This compressor's maximum outlet pressure is limited by damage."
- **Constrained range:** Editable within allowed range. Min/max indicators. Tooltip: "Operating range: 1-5 bar (damaged seals)."
- **Dropdown selection:** Only allowed values shown. "Available reactions: Sabatier, Haber."

### The "No Tech Tree" Principle

The palette does not show a technology tree, research points, or unlockable categories. There is no "research lab" that converts resources into capabilities. Equipment appears in the palette when the narrative says you found it in the wreckage. The salvage expedition is the unlock mechanism. This keeps progression physical and narrative — you got a compressor because you walked to the propulsion wreck and pulled one out of the debris, not because you accumulated enough XP.

---

## 55. The HUD

The HUD (Heads-Up Display) provides persistent at-a-glance information about colony survival status. It is always visible, minimal, and increasingly rich as the game progresses.

### Phase A HUD (M1–M3): Survival Dashboard

```
┌─────────────────────────────────────────────────────────────┐
│ DAY 3, 14:00  ▶ ×1                                          │
│                                                              │
│ O₂   ████████░░░  67%   9.0d  │  PWR  ██████░░░░  48 kWh   │
│ H₂O  ████████████  SUPPLY ✓   │  CO₂  16/20 carts  12.0d   │
│ FOOD  ████████████████  190/200 MREs   50d                   │
│                                                              │
│ 👤👤  2 survivors                                            │
└─────────────────────────────────────────────────────────────┘
```

Big gauges, big numbers, countdown timers. Colors: green (supplied/healthy), amber (<30% remaining), red (<10% remaining or not supplied). The dominant visual language is "how long until we die."

### Phase B HUD (M4–M6): Resource Network

```
┌─────────────────────────────────────────────────────────────┐
│ DAY 12, 08:00  ▶ ×10  ⚡ 5.0 kW                            │
│                                                              │
│ O₂   SUPPLY ✓     H₂O  SUPPLY ✓     AIR  SUPPLY ✓          │
│ PWR   GRID ✓ 5.0 kW  [█████████░]  draw: 4.8 kW            │
│ TEMP  22°C ✓       CO₂  <0.5% ✓      FOOD  132/200 MREs    │
│                                                              │
│ 👤👤👤  3 survivors                                          │
└─────────────────────────────────────────────────────────────┘
```

The countdowns have been replaced by "SUPPLY ✓" indicators. The power budget bar is new — shows available vs. consumed. The player now manages abundance, not scarcity.

### Phase C HUD (M7–M10): Industrial Dashboard

```
┌─────────────────────────────────────────────────────────────┐
│ DAY 30, 16:00  ▶ ×100  ⚡ 8.0 kW                           │
│                                                              │
│ O₂ ✓  H₂O ✓  AIR ✓  PWR ✓ 8kW  TEMP ✓  NH₃ ✓  FOOD 40%  │
│                                                              │
│ 🌱 Greenhouse: CO₂ fix 5.7 mol/hr  FOOD: SUPPLEMENTED      │
│ ❄ Cryo: liq O₂ 50 mol  liq CH₄ 50 mol  ROVER: READY       │
│                                                              │
│ 👤👤👤👤👤👤👤  7 survivors                                 │
└─────────────────────────────────────────────────────────────┘
```

Compact status indicators. New subsystem readouts (greenhouse, cryo). Food transitions from MRE count to greenhouse production percentage. The HUD tells a story of growing capability.

### Alarm Strip

Below the main HUD, a scrolling alarm strip shows the most recent/severe alarms:

```
⚠ COMPRESSOR-2: Discharge T 476 K (limit 500 K)
⚠ BATTERY: 35% — 6.2 hours remaining
```

Clicking any alarm selects the relevant unit and opens its inspector.

### Time Controls

Integrated into the HUD:

```
[⏸ Pause] [▶ Play ×1] [⏩ ×10] [⏩⏩ ×100] [⏩⏩⏩ ×1000]
```

- **Pause:** World frozen. Full editing available. This is build mode.
- **Play ×1:** Real-time. 1 solver tick = 1 in-game time step (configurable dt).
- **×10 / ×100 / ×1000:** Time warp. Solver runs multiple ticks per frame.

Auto-deceleration: if any alarm reaches ERROR or CATASTROPHIC severity during time warp, the game automatically slows to ×1 and plays a warning chime. The player has time to react before things break. If CATASTROPHIC persists for 5 ticks at ×1, the failure animation plays and the checkpoint reset is offered.

### Objective Tracker

During a mission, a small objective panel appears:

```
┌─────────────────────────────┐
│ MISSION 3 — FUEL             │
│                              │
│ ✓ Process converges          │
│ ◉ Store 20 mol CH₄ (12/20)  │
│ ○ Recycle water (bonus)      │
│                              │
│ ★☆☆                         │
└─────────────────────────────┘
```

Primary objectives: filled circle when met, empty circle when not. Progress bar for quantitative objectives. Bonus objectives shown with "bonus" tag. Star count updates as criteria are met.

---

## 56. The Expert Interface

Dr. Vasquez is the game's knowledge delivery system. She replaces the Thermo Bible concept from game-spec-v2 with something more human, more diegetic, and more appropriate for a game about survival.

### How the Player Interacts with the Expert

**Passive commentary.** When the player inspects a unit, Vasquez may offer an unsolicited comment if it's relevant — a tooltip-level annotation at the bottom of the inspector. "That Sabatier reactor is exothermic. You don't need to heat it — it makes its own heat." These are pre-written strings keyed to (unit type, operating state).

**Active consultation.** The player can "ask Vasquez" at any time via a button in the HUD or inspector. This opens a dialogue panel where Vasquez responds to the current situation:

- If the player asks while a unit is selected: Vasquez comments on that unit's state.
- If the player asks during an alarm: Vasquez diagnoses the alarm.
- If the player asks with nothing selected: Vasquez gives a general assessment of colony status.

**Mission briefings.** At the start of each mission, Vasquez delivers the concept briefing. She explains what the player needs to build, why it matters, and the physics principle involved. She does NOT give step-by-step instructions. "You need to cool the vent gas below water's boiling point. An air cooler gets you close to ambient. A flash drum separates the liquid." The player figures out the implementation.

**Progressive hints.** If the player is stuck (measured by: objectives not progressing after N minutes), Vasquez offers increasingly specific hints:

1. **Conceptual:** "Think about what temperature water condenses at."
2. **Directional:** "Check the cooler outlet temperature. Is it below 100°C?"
3. **Specific:** "Your air cooler approach temperature is 10 K. That means the coldest you can get the gas is 298 K. Water's saturation temperature at 1 atm is 373 K — wait, that's too hot. At the vent's partial pressure of water, saturation is much lower."
4. **Reference solution:** "Here's one way to set it up..." (shows a reference flowsheet as a diagram the player can study, not auto-build).

### What Vasquez Is NOT

- NOT omniscient. She doesn't know the "correct" answer for every situation. For non-standard configurations, she offers general principles, not solutions.
- NOT always right. In edge cases, she might suggest something that doesn't quite work. The player learns to test and verify.
- NOT a walkthrough. She never says "place the air cooler at position X, set temperature to Y, connect it to Z." She teaches principles; the player applies them.
- NOT a chatbot. Her responses are pre-written and keyed to game state. There is no AI text generation in the game — it's all authored content.
- NOT a narrator. She speaks as a character — tired, injured, sometimes dry, sometimes awed, always an engineer at heart.

### Vasquez's Arc

Vasquez has a character arc that parallels the colony's progression:

| Phase | Vasquez's State | Tone |
|-------|----------------|------|
| M1–M3 | Pinned, in pain, gives instructions through gritted teeth | Urgent, terse, focused |
| M4–M5 | Can sit up, more conversational, starts explaining "why" | Teaching, dry humor |
| M6 | Warmer (literally). Medical treatment begins (Tomás arrives) | Relaxing, warmer |
| M7–M8 | Recovering. Can move with help. More engaged, asks questions back | Collaborative |
| M9 | Mobile with a cane. Can visit equipment, point at things | Energized, curious |
| M10 | Standing at the greenhouse window. "This is what I came to prove." | Proud, quiet |

She begins as a voice in the dark giving emergency directions. She ends as a colleague standing beside you, looking at what you built together.

---

## 57. Narrative Delivery

The game's narrative is delivered through multiple channels, never breaking the fourth wall, never interrupting flow for too long.

### The Beat System

A narrative beat is a single moment of story delivery. Beats have layers that can be combined:

```
NarrativeBeat {
  visual    { type: 'image' | 'scene3d' | 'vignette' | 'none', src }
  text      { body: 'markdown', typewriter: Boolean }
  dialogue  { speaker: 'name', portrait: 'key', lines: ['...'] }
  audio     { music: 'key', sfx: 'key', ambiance: 'key' }
  layout    'cinematic' | 'corner' | 'banner' | 'overlay'
  duration  Number | null (null = advance on click)
  transition 'fade' | 'slide' | 'cut'
}
```

Beats are grouped into sequences. A sequence plays beats one after another. The game clock pauses during a sequence (except for ambient beats that play in the corner).

### Delivery Channels

**Mission briefings.** Full-screen cinematic sequences before each mission. Vasquez speaks, the camera shows relevant equipment or the salvage site, the objective appears. Duration: 30-90 seconds. Cannot be skipped on first play, skippable on replay.

**Mission completion.** A celebratory beat: the camera pulls back to show the new capability, Vasquez comments, the visual reward plays (lights coming on, frost melting, greenhouse glowing). Duration: 15-30 seconds.

**Mid-mission events.** Corner or banner beats that don't interrupt gameplay. A character portrait appears in the corner with a dialogue line. "That discharge temperature is climbing — watch it." "Hey, I think I see someone moving out there!" These pause the clock briefly (2-3 seconds) then dismiss automatically.

**Salvage vignettes.** Short narrative sequences during salvage expeditions (between missions). The player doesn't control salvage — it's a story beat. "Kael suits up, crosses 500 meters of broken terrain, finds the propulsion section..." These deliver new equipment, new survivors, and worldbuilding.

**Wreck lore.** Discoverable text fragments found during salvage. They appear as items in a "Log" tab in the HUD. Corporate memos, personal messages, Chief Engineer Tanaka's warnings, automated system alerts frozen mid-sentence. These are optional reading — they enrich the world but never block progress.

### Tone Control

Narrative beats follow the same progression arc as the game:

| Phase | Narrative tone | Audio |
|-------|---------------|-------|
| A (M1–M3) | Tense, urgent, survival stakes | Low drones, hissing vent, alarm beeps |
| B (M4–M6) | Stabilizing, first humor, relief | Equipment hum, lights buzz, quiet music |
| C (M7–M9) | Competent, collaborative, hopeful | Industrial ambiance, richer soundtrack |
| D (M10) | Reflective, proud, quiet | Full soundtrack, birdsong, wind |

### What We Don't Do

- No cutscene movies (too expensive, too static).
- No voice acting initially (too expensive; dialogue is text with portraits).
- No branching narrative (story is linear; missions are linear; no player choices that affect plot).
- No character relationship system (survivors are narrative characters, not game systems).
- No journal quests beyond the main mission chain.

---

## 58. Time & Failure Model

### Two Modes, One World

The game has exactly two states: **building** and **running.**

**Building (Paused):**
- World clock is frozen. No physics. No depletion. No production.
- Full editing: place/remove equipment, lay/remove pipes, adjust parameters.
- All topology changes happen here.
- The inspector shows last-computed values (from before pause).
- Camera moves freely. Full palette access.
- This is the "design" phase.

**Running (Live):**
- World clock advances. Solver runs every tick.
- Physics is live: fluids flow, temperatures change, tanks fill, depletables deplete.
- **Parameter edits are live.** The player can adjust compressor pressure, heater temperature, splitter ratio while running. Changes take effect on the next tick. This is the "tuning" phase.
- **Topology edits are NOT allowed** while running. Cannot place, remove, or reconnect equipment. Must pause first.
- Time warp available when stable.

### The Checkpoint System

**When the player presses Play:**
1. The current state is automatically checkpointed (full scene export: unit positions, connections, parameters, all tank inventories, battery charge, depletable levels, game clock).
2. The world begins running.
3. If the player presses Pause at any time, they can continue editing from the current state (which may have changed — tanks filled, resources consumed).
4. If a catastrophic failure occurs, the player is offered: "Revert to last design?" which restores the checkpoint from step 1.

**Why this works like Kerbal:**
- Press Play = "launch." Your design faces reality.
- If it works, great — time warp, watch objectives complete, proceed.
- If it fails, you see WHY it failed (spectacular animation), then revert.
- You learn from the failure and modify the design.
- Press Play again = "re-launch."

There is no penalty for failure except time. No resources permanently lost (the checkpoint restores everything). No equipment permanently damaged (the checkpoint restores everything). The cost of failure is watching your plant break and having to figure out what went wrong. This is the Kerbal magic: failure is education, not punishment.

### Time Warp Rules

| Condition | Maximum warp |
|-----------|-------------|
| All green (no alarms) | ×1000 |
| WARNING alarms present | ×100 |
| ERROR alarms present | ×1 (auto-decelerate) |
| CATASTROPHIC alarm | ×0 (auto-pause after failure animation) |

The auto-deceleration is critical. It prevents the player from time-warping through a disaster. When an alarm escalates to ERROR, the game slows down and gives the player a chance to pause, investigate, and fix. If they don't fix it and it reaches CATASTROPHIC, the failure animation plays and the checkpoint offer appears.

### Solver Tick and Game Time

The solver timestep `dt` is configurable (default: adjustable, perhaps 60s for Phase A missions, longer for Phase C when systems are larger). Each "Play ×1" frame advances the solver by one dt. Time warp multiplies the number of solver ticks per render frame.

At ×1: 1 tick per frame → real-time feel.
At ×10: 10 ticks per frame → hours pass in seconds.
At ×100: 100 ticks per frame → a full day in a few seconds.
At ×1000: 1000 ticks per frame → days pass quickly.

Frame rate is independent of tick rate. The game renders at display refresh rate; solver ticks are batched as needed. If the solver can't keep up (complex scenes at high warp), warp automatically caps at the achievable rate.

### The "Vasquez Takes Over" Safety Net

If a player is truly stuck — objectives not met, multiple failed attempts, hint system exhausted — a final option appears: "Dr. Vasquez offers to demonstrate one approach." This shows a pre-built reference solution (as a read-only flowsheet diagram and 3D view) that the player can study. It does NOT auto-build the solution. The player still has to build it themselves.

This is the absolute last resort. It preserves learning (the player sees the answer and must understand it enough to replicate it) while preventing permanent dead-ends. It's available only after the full hint progression is exhausted and a significant time has passed.

### Mission Completion Flow

```
1. Player is running. Objectives evaluating every tick.
2. All primary objectives met → "MISSION COMPLETE" banner (3 seconds).
3. World keeps running (objectives can continue improving toward stars).
4. Player can:
   a) Continue running (chase star criteria, optimize).
   b) Pause and end mission → completion screen shows stars earned.
5. Completion screen:
   - Star rating (1-3)
   - Statistics: time to complete, parts used, efficiency metrics
   - Visual reward beat plays
   - "Continue to next mission" or "Keep optimizing"
6. Mission state saved. Equipment and inventory carry forward to next mission.
```

### Save System

The game saves:
- Campaign state (which missions completed, star ratings, current mission)
- Full scene state (all equipment, connections, parameters, inventories)
- Depletable levels
- Game clock position
- Character state (which survivors rescued, Vasquez recovery level)

Saves happen automatically on: mission completion, manual save request, and periodically during gameplay (every N minutes). The player can maintain multiple save slots.

---

## 59. Sandbox Mode

Beyond the campaign, the game offers a Sandbox mode that is essentially the original processThis simulator with all equipment unlocked, all species and reactions available, no scarcity constraints, and no survival demands. It is the full engineering playground.

Sandbox mode:
- All 13 process unit types available, unlimited quantity
- All composites (greenhouse, human) available
- All species and reactions registered
- Any atmosphere preset (Earth, Mars, Titan, Venus, Planet X, custom)
- No depletable supplies (use infinite sources)
- No survival demands, no runway calculation
- No mission objectives, no star ratings
- Full inspector, full flowsheet, full 3D (when available)
- Named save slots, import/export JSON

Sandbox is where players go after the campaign to experiment. "What if I ran Haber synthesis on Titan?" "Can I design a closed biosphere with only 3 kW?" "What's the minimum equipment for cryogenic oxygen?" It's also where mission designers (including the developer) build and test new mission content using the mission editor tool.

The campaign teaches. Sandbox lets the player play.
