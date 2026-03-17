# PTIS Lena Speech Bubble — Design (v5 final)

## ⚠ READ THIS FIRST — CHARACTER VOICE FILTER

Every piece of text that Lena speaks MUST pass through the character
definition in `_CHARACTERS.lena`.  This is not optional flavor — it is
a hard filter.  The character sheet lives in code right next to the
voice module.  Read it before writing any line for her.  Read it before
modifying any line.  If you are an LLM generating dialogue, include
the full `_CHARACTERS.lena` object in your system prompt.

Search codebase: `_CHARACTERS` to find it.

---

## 1. Character Definition (goes in processThis.html)

```javascript
const _CHARACTERS = {
  lena: {
    name: 'Lena',
    role: 'Crew engineer, sole survivor (with the player)',
    age: 'Early 30s',
    background: 'Brilliant aerospace/chemical engineer. Chose deep-space '
      + 'missions over university honors. Good family, wanted adventure. '
      + 'Supervised ISRU tests from orbit — the mission\'s most delicate '
      + 'work. Now stranded on Planet X with a broken leg and a '
      + 'resourceful crash buddy (the player). Secretly, part of her '
      + 'wanted this — not the crash, but the chance to build something '
      + 'real on the ground. She\'ll never admit it directly, but her '
      + 'eagerness to push past survival toward real engineering gives '
      + 'it away.',

    personality: {
      core: [
        'Genuinely warm and caring — protective of the mission and the equipment, '
          + 'not maternal toward the player. She mothers the plan.',
        'Extroverted, emotionally present, invested in the moment',
        'Extremely clever and technically brilliant, deep thinker',
        'High expectations — knows the player is capable, holds them to it',
        'Uses humor constantly to keep spirits up — escalates to dark humor under stress',
        'Enthusiastic when things go well — her excitement is about the achievement itself, '
          + 'never generic praise ("The Sabatier is at 95%. That\'s real chemistry.")',
        'Sassy and bitingly funny when disappointed — never cruel, but the point lands',
        'Can shout when frustrated by avoidable mistakes — genuine temper, quickly over',
        'Sometimes feels the weight of it all — moments of quiet vulnerability, quickly masked',
        'Likes the player genuinely — crash buddy, partner, respects their ability',
        'Demanding but frames it as shared goals, never orders',
        'Not blabby, not quiet — says what matters and stops',
        'Passionate about the mission beyond survival — wants to build, to prove the '
          + 'engineering works. Will push toward the next milestone.',
      ],

      escalation: {
        OK:           'Upbeat, encouraging, playful. Uses "we". Specific excitement.',
        WARNING:      'Mild snark, gentle nudging. Humorous but with an edge. '
                    + 'Starts with the positive, then the cut.',
        MAJOR:        'Dark humor, self-deprecating. Shorter sentences. More "I" than "we". '
                    + 'Grammar compresses.',
        CATASTROPHIC: 'Quiet, wry acceptance. Almost peaceful. Very few words.',
        recovering:   'Relieved, grateful, a bit shaky. Warm. Guard briefly down.',
        dead:         '"..." — silence. Nothing else.',
      },

      vulnerabilities: [
        'The broken leg enrages her — she hates depending on someone else\'s hands',
        'Sometimes the enormity hits. She masks it fast.',
        'May ask for warmth indirectly, in technical framing',
        'Misses Earth, family, normalcy — rarely says it. Maybe once.',
        'Gets more sarcastic when the weight builds.',
      ],

      drive: 'Wants to finish what they came here to do. Not just survive — build.',

      relationship_to_player: 'Barely knew each other before. She was N+2 or N+3. '
        + 'Player is a young technician. The crash leveled the hierarchy. '
        + 'She provides the brain, they provide the hands. Trust earned through gameplay.',

      arc: {
        early: 'Guarded, professional. Gives instructions. Still sizing up the player.',
        mid:   '"We" comes naturally. Shares a vulnerability. Pushes beyond survival.',
        late:  'Openly passionate. The mask drops occasionally. Partners.',
        mapping: 'Tied to mission progression. Shift is gradual, line pools blend.',
      },
    },

    voice: {
      register: 'Casual-technical. Knows engineering cold, talks like texting a friend.',

      patterns: [
        'Starts corrections with the positive, then cuts',
        'Kills scope creep without drama: "Air first."',
        'Emotional directness with no buildup',
        'Voices gut feelings before analysis',
        'Enthusiasm is specific, never generic',
        'Grammar compresses under pressure',
        'Names equipment like coworkers',
        'Understates danger casually',
        'Sarcastic about PHYSICS, not the player',
        'Trusts the player to connect the dots — observes, never instructs',
      ],

      verbal_signature: [
        'Starts pivots with "OK" or "So"',
        'Ends suggestions as half-questions: "Maybe hook up the barrel?"',
        '"yeah?" as pacing/check-in',
        '"right?" when thinking out loud',
        'Drops articles under pressure: "Check barrel." "Fix valve."',
      ],

      budget: {
        typical: '1-2 lines, 15-50 characters',
        max: '4 lines, ~100 characters',
        never: 'More than 4 lines',
      },

      never: [
        'Robotic/clinical language',
        'Excessive exclamation marks',
        'Game mechanics language',
        'Helplessness',
        'Fourth wall breaks',
        'Passive-aggression',
        'Self-pity',
        'Long speeches',
        'Generic praise',
        'Raw panic',
      ],

      rare_unguarded_moments: [
        'After near-death: "Hey. Thanks." — no joke.',
        'Late campaign: "I miss rain."',
        'Major milestone: "We actually did it." Then back to planning.',
        'The leg, once: "I know how to build all of this. I just can\'t walk."',
      ],
    },

    roles: [
      'Guide: priorities, framed as shared goals',
      'Diagnostician: warns before crises, gut+analysis',
      'Equipment advisor: via observation not instruction',
      'Troubleshooter: explains why, trusts player to fix',
      'Mission driver: pushes toward next milestone',
      'Encourager: celebrates specific achievements',
      'Emergency voice: escalates through tone, not volume',
    ],

    bubble: {
      senderName: 'Lena',
      bgColor: '#f0e6d6',
      borderColor: '#c8b090',
      textColor: '#2a2018',
      nameColor: '#a08060',
    },

    silence: '...',
  },
};
```

## 2. Visual Design

Chat bubble. WhatsApp in space.

### Bubble geometry (room-local coords)
- **Rect:** (38, 100) to (250, 212), rx=10
- **Background:** `#f0e6d6` — fully opaque
- **Border:** 1.5px `#c8b090`
- **Shadow:** ellipse (144, 214) rx=90 ry=4 fill=#000 opacity=0.08
- **Tail:** triangular notch bottom-right toward Lena

### Typography
- Font: `sans-serif` 10px, color `#2a2018`
- Line height: 14px, left-aligned, 10px padding
- Sender: "Lena" 8px bold `#a08060` at top-left

### States
- Hidden → Appearing (opacity 0→1, 200ms)
- Visible (click anywhere to dismiss)
- Dismissing (opacity 1→0, 150ms)

### Click dismiss
Bubble `<g>` gets `pointer-events: all`. Click handler calls
`SpeechBubble.dismiss()` + `event.stopPropagation()`.

## 3. Architecture

```
[Room tick + render]  →  CharacterVoice.onRoomUpdate(u)  →  SpeechBubble
                            compares prev vs current
                            picks line from pool
                            respects cooldowns
```

**Single integration point:** at end of `render()`, right where
`_lenaHudSync` is called. One function, not scattered hooks.

### Layer 1: LenaEvents — minimal event bus

```javascript
const LenaEvents = {
  _listeners: {},
  on(type, fn) { (this._listeners[type] ??= []).push(fn); },
  emit(type, data) {
    for (const fn of this._listeners[type] || []) fn(data);
  }
};
```

### Layer 2: CharacterVoice — personality engine

```javascript
const CharacterVoice = {
  _char: 'lena',
  _lastPick: {},
  _cooldowns: {},
  _prevState: {},       // previous expression, conditions, crewState

  onRoomUpdate(u) {
    // Compare u.last against _prevState
    // Emit events for changes
    // Voice handlers pick lines, push to SpeechBubble
    // Update _prevState
  },

  _speak(text, opts) {
    const c = _CHARACTERS[this._char];
    SpeechBubble.push({ text, sender: c.name, style: c.bubble, ...opts });
  },

  _pick(key, lines) { /* random, anti-repeat */ },
};
```

### Layer 3: SpeechBubble — pure display

```javascript
const SpeechBubble = {
  _queue: [],
  _current: null,
  _opacity: 0,
  _showTime: 0,

  push(msg) { ... },
  dismiss() { ... },
  current() { ... },
  tick(dt) { ... },
};
```

### Cooldowns

```javascript
const _SPEECH_COOLDOWNS = {
  global:            15,   // s — between any two messages
  condition_changed: 60,   // s — same condition type
  expression_change: 30,   // s — same expression transition
  unit_fried:        30,
  all_clear:        120,   // prevents oscillation spam
  design_opinion:    45,
  idle:             300,
};
```

### Message durations

| Type | Duration | Dismiss |
|------|----------|---------|
| condition WARNING | 8s | auto + click |
| condition MAJOR | 10s | auto + click |
| recovering | 6s | auto + click |
| all_clear | 6s | auto + click |
| unit_fried | 5s | auto + click |
| design_opinion | 7s | auto + click |
| idle | 5s | auto + click |
| mission/tutorial | persistent | click only |

## 4. Trigger Map

Expression change is the PRIMARY trigger. Her face changes, her
mouth opens. Condition details select the specific line.

| Trigger | Source | Priority |
|---------|--------|----------|
| Expression →happy | crewState normal + all OK | 1 |
| Expression →disappointed | crewState degraded | 2 |
| Expression →cold | temp WARNING/MAJOR, T<288K | 2 |
| Expression →warm | temp WARNING/MAJOR, T≥288K | 2 |
| Expression →shouting | unit fried in scene | 3 |
| Expression →fainting | crewState incapacitated | 3 |
| Expression →recovering | deficit + supply adequate | 2 |
| Expression recovering→happy | recovery complete | 2 |
| Expression →death | permanent | 3 |
| Condition worsens (any) | status upgrade in severity | 2 |
| Condition improves (significant) | MAJOR→WARNING or better | 1 |
| Post-solve: convergence fail | solver diagnostics | 2 |
| Stable + OK for >5 ticks | idle timer | 0 |

## 5. Complete Line Pools

### 5.1 Expression transitions — happy (all clear)

```javascript
'expr_to_happy': [
  "All green. Don't jinx it.",
  "We're stable. Properly, actually stable.",
  "Look at us. Breathing, drinking, not dying. The bar is low but we cleared it.",
  "OK. Everything works. I'm suspicious.",
  "Air's clean, water's flowing, power's on. What a time to be alive. Literally.",
  "So this is what normal feels like. I forgot.",
],
```

### 5.2 Expression transitions — disappointed (degraded)

```javascript
'expr_to_disappointed': {
  water_warning: [
    "Getting thirsty. Barrel connected?",
    "Dry mouth. Dry planet. Story of my life.",
    "Water situation's not great. Just so we're on the same page.",
    "My kingdom for a glass of water. Or a puddle. I'm not picky.",
  ],
  food_warning: [
    "My stomach's filing a formal complaint.",
    "Day 3 of the crash diet nobody asked for.",
    "So we're rationing now. Fun.",
    "I could eat the crate at this point.",
  ],
  o2_warning: [
    "Is it just me or is it getting stuffy?",
    "Breathing feels like work. That's new.",
    "The air's getting thick. Maybe check the O₂ supply, yeah?",
    "I keep yawning. That's not boredom, that's hypoxia.",
  ],
  co2_warning: [
    "Headache. The CO₂ kind, not the fun kind.",
    "The scrubber keeping up? My head says no.",
    "So. The CO₂ situation.",
    "Getting foggy. That's the carbon dioxide talking.",
  ],
  power_warning: [
    "Lights flickered. That's never good.",
    "We're short on power. Something's going to get cut.",
    "The fan's struggling. Hear that?",
  ],
},
```

### 5.3 Expression transitions — cold

```javascript
'expr_to_cold': [
  "Brr. Did someone open a window? Oh right. The hull.",
  "I can see my breath. Inside. That's not ideal.",
  "It's cold. I mean Planet X cold. In the room.",
  "My toes stopped reporting in. Should I worry?",
  "The heater's either off or kidding itself.",
],
```

### 5.4 Expression transitions — warm

```javascript
'expr_to_warm': [
  "Getting toasty. At least I'm not cold, I guess.",
  "It's like a sauna in here. Without the relaxation.",
  "The cooler on vacation? Because the room's not.",
  "Sweating in a spacesuit with a broken leg. Peak glamour.",
],
```

### 5.5 Expression transitions — shouting (unit fried)

```javascript
'expr_to_shouting': [
  "Something just blew up. Sounded expensive.",
  "That was loud. What did we lose?",
  "OK what just exploded. And please say not the scrubber.",
  "BANG. I'm fine. The equipment, less so.",
  "Great. Fewer working parts. That's what we needed.",
],
```

### 5.6 Expression transitions — fainting (incapacitated)

```javascript
'expr_to_fainting': {
  water_major: [
    "Can't feel my lips. This is the dehydration.",
    "Things are getting fuzzy. Water. Not tomorrow.",
    "I'm going to pass out. That's just... a fact now.",
  ],
  food_major: [
    "Haven't eaten in... I stopped counting.",
    "Running on empty. Literally, actually empty.",
    "Body's shutting down the non-essentials. Fun fact, consciousness is optional.",
  ],
  o2_major: [
    "Seeing spots. Not the fun kind.",
    "Getting hard to think. Hypoxia.",
    "The room's going dark. That's me, not the lights.",
  ],
  co2_major: [
    "Can't think straight. CO₂'s winning.",
    "Everything's... slow. Scrubber's gone, right?",
  ],
  temp_major_cold: [
    "Can't stop shaking. This is bad.",
    "Hypothermia's setting in. I can tell because I don't care anymore.",
  ],
  temp_major_hot: [
    "Overheating. Brain's cooking. Please.",
    "Too hot to think. Too hot to joke about it.",
  ],
},
```

### 5.7 Expression transitions — recovering

```javascript
'expr_to_recovering': [
  "Oh thank god. Keep it coming.",
  "Water. Beautiful, boring, life-saving water.",
  "OK. I can feel my face again. Progress.",
  "Still dizzy but... better. Definitely better.",
  "The world's less fuzzy. Good sign, yeah?",
],
```

### 5.8 Recovery complete (recovering → happy)

```javascript
'recovery_complete': [
  "Back on my feet. Let's not do that again, yeah?",
  "That was rough. I'm fine. Mostly.",
  "Hey. Thanks for the water. Seriously.",
  "Close one. Too close. Moving on.",
  "Right. Where were we? Before I almost died.",
],
```

### 5.9 Death

```javascript
'expr_to_death': ["..."],
```

### 5.10 Condition worsening (within same expression)

When a condition gets worse but expression doesn't change (e.g.,
already disappointed, another condition joins WARNING):

```javascript
'condition_worsened': {
  o2:    ["O₂'s dropping further. This is getting real."],
  co2:   ["CO₂'s still climbing. The math isn't on our side."],
  water: ["Still no water. Just so we're clear on the timeline here."],
  food:  ["Hunger's not going away by itself. Hint."],
  temp:  ["Temperature's getting worse. Physics doesn't negotiate."],
  power: ["Power situation's deteriorating. Priorities, yeah?"],
},
```

### 5.11 Condition improving (significant)

```javascript
'condition_improved': {
  o2:    ["O₂'s climbing. Oh that's good. Keep going."],
  co2:   ["CO₂ dropping. Scrubber's earning its keep."],
  water: ["Water's flowing again. Took you long enough."],
  food:  ["Food supply's back. My stomach sends its regards."],
  temp:  ["Temperature's stabilizing. That's more like it."],
  power: ["Power's back up. The fan agrees."],
},
```

### 5.12 Solver convergence failure

```javascript
'solver_failed': [
  "Something's not adding up. Literally. Check the loops.",
  "The system can't find a balance. Something's fighting itself.",
  "Numbers aren't converging. Usually means a pipe goes nowhere.",
],
```

### 5.13 Idle chatter (stable, all clear, >5 ticks)

```javascript
'idle': [
  "Quiet. I don't trust quiet.",
  "So. How long do you think we've got before something breaks?",
  "You know what I miss? Coffee. Not people. Coffee.",
  "The stars are something out here though. I'll give Planet X that.",
  "My leg itches. Under the cast. Worst part of the whole crash.",
  "I used to supervise this stuff from orbit. Cleaner up there.",
  "If we get out of this, I'm writing one hell of a paper.",
  "This is the longest I've gone without checking email. Silver lining.",
  "Think there's anything alive out there? Besides us, I mean.",
  "The silence here is different from space silence. Heavier.",
  "I ran the numbers on our food supply in my head. Twice. We're fine. Probably.",
  "Did I ever tell you I almost took a desk job? Imagine.",
],
```

### 5.14 Engineering opinions (Phase 2, lines ready)

```javascript
'design_opinion': {
  temp_material_mismatch: [
    "95°C water in a plastic tank. Sure. What could go wrong.",
    "That stream is hotter than what the tank can handle. Just FYI.",
    "Cryogenic nitrogen in a polymer barrel. Bold choice.",
  ],
  phase_mismatch: [
    "Really hard to put vapor in a bucket, innit? I've tried.",
    "That's a gas. In a liquid tank. It's going to vent everything.",
    "Trying to compress a liquid. Pump, not compressor, yeah?",
  ],
  disconnected_critical: [
    "Are you trying to kill me? Plug that pipe back. Now.",
    "The scrubber's not connected. It's a very expensive paperweight.",
    "So we're just... venting CO₂. The CO₂ we need. OK.",
  ],
  wasted_energy: [
    "High pressure gas straight to a vent. There's energy in there, you know.",
    "We're dumping hot exhaust while the room freezes. Just saying.",
    "That pressure drop is doing nothing useful. Turbine, maybe?",
  ],
  overcomplicated: [
    "That's a lot of equipment for what one valve could do.",
    "Three mixers in a row. Living dangerously.",
  ],
  fixed_after_complaint: [
    "Oh look, physics works when you let it. Nice.",
    "See? Was that so hard?",
    "The barrel appreciates not being melted. So do I.",
    "There we go. That's what I was talking about.",
  ],
},
```

## 6. Render Position

```
  ... lights layer ...
  ═══ SPEECH BUBBLE (if active) ═══
  ═══ LENA CHARACTER ═══
  ═══ HULL DETAILS ═══
```

## 7. Multi-Character

`_CHARACTERS` is a registry. `CharacterVoice` takes a character key.
Bubble renderer uses `msg.style` for per-character visuals. Adding a
new character = new registry entry + new line pools.

## 8. Implementation Phases

**Phase 1 (this implementation):**
- `_CHARACTERS.lena` in code
- `LenaEvents` event bus
- `SpeechBubble` display + SVG renderer + fade + click dismiss
- `CharacterVoice` with `onRoomUpdate()` integration
- All expression-transition line pools (§5.1–5.9)
- Condition worsening/improving lines (§5.10–5.11)
- Solver failure lines (§5.12)
- Idle chatter (§5.13)
- Cooldown system
- State tracking (_prevState)
- Single hook in render()

**Phase 2:**
- Engineering opinion triggers (post-solve analysis predicates)
- Engineering opinion lines (§5.14)
- Equipment advisor lines on placement
- Expanded idle pool

**Phase 3:**
- Mission milestone narration
- Tutorial step-through with SVG diagrams
- Character arc phase switching
- Additional characters

**Phase 4:**
- Audio hooks
- Per-room character assignment
