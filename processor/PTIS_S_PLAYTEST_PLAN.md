# S-PLAYTEST Action Plan

**Origin:** Playtest #001 (March 2026, v16.9.1)  
**Goal:** Non-engineer completes Mission 1 unsupervised  
**Principle:** We teach through visible consequences, not messages.

---

## Mental Model

```
  VOICE          What the game says        (language audit)
  SIGHT          What the player sees      (icons, flow, destruction)
  FEEL           How the game responds     (catastrophe, trip/degrade/break)
  FIT            Whether T1 equipment works together  (sizing, defaults)
```

Everything ties to one question: **can the player look at the screen and understand what's happening without reading a single number?**

---

## Slice 0 — Bugfix (done)

- [x] Diurnal temperature inverted (sign bug in computeDiurnal)
- [x] Fried repair: re-solve + reinit inventory
- [x] Catastrophe revert: reinit inventory for fried vessels
- [x] applyLayout missing applyPlanetBg call

---

## Slice 1 — VOICE  
*Design session first, then implementation.*

### 1a. Design: Voice Guide (design session)

Establish the two-layer voice rules before touching any strings.

Deliverable: `PTIS_VOICE_GUIDE.md` containing:

- **Layer 1 rule:** Describe what the machine is doing, not what equation failed. No method names, no coefficients, no units. "(Fan at max speed)" is the template.
- **Layer 2 rule:** Engineering detail, expandable. For the player who wants to know why.
- **Name rules:** If a non-engineer can't picture the object from the name alone, rename it. "Air cooler" passes. "Flash drum" fails.
- **Material identity rule:** Every profile tier gets a one-line physical description. "Polypropylene tank — rated to 80°C, 5 bar." Shown in palette tooltip + inspector header.
- **Limit description rule:** Limits expressed as physical consequences, not parameter codes. "Melts above 80°C" not "T_HH = 353K."
- **Tone:** Scrappy workshop on alien planet. Not control room SCADA.

### 1b. Implementation: Full string audit (1 session)

Armed with the voice guide, sweep:

| Target | Count | Example before → after |
|---|---|---|
| Profile display names | ~30 | "Flash Drum" → "Vapor-Liquid Separator" |
| Profile descriptions | ~30 new | — → "Polypropylene tank — holds liquids up to 80°C" |
| Alarm messages (Layer 1) | ~40 | "UA-NTU limited: ε=0.82" → "Cooler at full power — can't reach target" |
| Palette tooltips | ~30 new | — → "Cools a stream using ambient air and a fan" |
| Inspector section headers | ~15 | "Thermodynamic output" → "What's happening" |
| Limit labels | ~20 | "T_HH" → "Max temperature (destruction)" |

---

## Slice 2 — SIGHT  
*Two sub-slices. Icons is implementation. Flow is design-first.*

### 2a. Implementation: Icons in palette (1 session)

Replace text-list palette with icon tiles. Each tile:
- Ragtag icon (primary visual, ~48×48)
- Name below (from voice guide)
- Tier badge if multi-tier

The 51 ragtag symbols already exist. This is layout + rendering, not asset creation.

### 2b. Design: Flow & alive feedback (design session)

Deliverable: `PTIS_S_ALIVE_SPEC.md` containing:

- **Pipe flow animation:** Dashes/particles moving along connection SVG paths. Speed ∝ flow magnitude. Direction from source→sink. Frozen when paused.
- **Flow magnitude signal:** Pipe thickness or particle density scaled to mol/s. Player sees "fire hose vs garden hose" at a glance.
- **Tank level indicator:** Fill line in tank/open_tank icon, keyed to inventory level_pct.
- **Equipment state cues:** Running = subtle vibration/hum. Bypassed = static + dashed. Off = dark + power icon. Fried = red + smoke (already exists).
- **Animation-simulation sync rule:** Cosmetic ambient (planet sky, stars) runs always. Equipment animation runs only when sim is playing. When paused, equipment looks frozen. Player can tell sim state from one glance.

### 2c. Implementation: Pipe flow + tank level (1 session)

Implement the two highest-impact items from the spec. Connection SVG paths get animated dashes. Tank icons get a fill rectangle.

---

## Slice 3 — FEEL  
*Design session first. This changes game rhythm.*

### 3a. Design: Catastrophe sequence + trip/degrade/break (design session)

Deliverable: `PTIS_S_CONSEQUENCE_SPEC.md` containing:

**Catastrophe sequence (replaces instant modal):**
1. **Drama phase (2-3s):** Auto-pause. Camera zooms to destroyed unit. Fried overlay, red flash, smoke play out. No modal.
2. **Debrief phase:** Semi-transparent panel slides in (not covering the unit). Plain-language cause from voice guide. Actual value vs limit. One-line fix hint. Affected unit list.
3. **Choice phase:** "⏪ Revert" / "Continue damaged." Clear, large buttons.

**Trip/degrade/break hierarchy (new NNG candidate):**
- **Trip:** Equipment auto-shuts-down safely. Flashing indicator. Player investigates. Restart is one click. (Example: compressor liquid detection → trip, not explosion.)
- **Degrade:** Equipment runs but poorly. Visual cue (amber glow, reduced animation speed). Performance numbers drop. Player sees "it's struggling" before it breaks.
- **Break:** Current fried system. Dramatic. Expensive to recover. The consequence the player learns to avoid.

Current game jumps from "working" to "break" with nothing in between. The middle layer (trip + degrade) is where learning happens.

### 3b. Implementation: Catastrophe sequence (1 session)

Phase 1: delay modal by 2.5s, call `zoomToUnit()` on first fried unit, let existing fried overlay + smoke render.
Phase 2: rebuild modal content with diagnostic from AlarmSystem (message, param, value, limit) formatted in voice guide Layer 1.
Phase 3: restyle buttons.

### 3c. Implementation: Trip mode for 3-4 key units (1 session)

Add `tripped` state (between `on` and `fried`) for units where it's physical:
- Compressor: liquid detected → trip (auto-off, not destruction)
- Pump: cavitation → trip
- Tank: P > P_relief but < P_HH → relief valve opens (trip, not break)

Tripped units show amber indicator, auto-bypass flow, one-click restart. This gives the player a warning beat before catastrophe.

---

## Slice 4 — FIT  
*Design session. Requires balancing spreadsheet work.*

### 4a. Design: T1 sizing harmony (design session)

Deliverable: sizing table showing that default T1 equipment works together.

| Source | Default flow | Downstream | Can handle? |
|---|---|---|---|
| Reservoir (T1) | ? mol/s | Air cooler (T1) | Must be yes |
| Air cooler (T1) out | ? mol/s | Open tank (T1) | Must be yes |
| Grid supply (T1) | ? kW | Air cooler (T1) | Must be yes |

Rules:
- T1 defaults must produce a working system with zero param changes.
- Cv and opening hidden or auto-calculated at T1. Exposed at T2+.
- Flow magnitude mismatch warning when stream >> equipment capacity.

### 4b. Implementation: T1 profile rebalance (1 session)

Adjust defaults for reservoir, air cooler, open tank, grid supply so Mission 1 works out of the box. Hide Cv/opening from T1 inspector (show at T2+).

---

## Execution Order

```
 Slice 0   done (bugfixes shipped in v16.9.1)
    │
    ▼
 Slice 1a  VOICE design session ◄── everything else depends on this
    │
    ├──► Slice 1b  string audit (uses voice guide)
    │
    ├──► Slice 2a  icons in palette (independent)
    │
    ▼
 Slice 3a  FEEL design session (catastrophe + trip/degrade/break)
    │
    ├──► Slice 3b  catastrophe sequence (uses voice guide for messages)
    │
    ├──► Slice 3c  trip mode (needs FEEL spec)
    │
    ▼
 Slice 2b  SIGHT design session (flow + alive spec)
    │
    └──► Slice 2c  pipe flow + tank level
    │
    ▼
 Slice 4a  FIT design session (T1 sizing)
    │
    └──► Slice 4b  T1 rebalance

 Target: re-test Mission 1 after Slice 3b
```

Voice first — it defines the language everything else uses.  
Feel next — it defines how failures work, which flow and sizing depend on.  
Sight after — it makes the system visible, but needs voice and feel settled.  
Fit last — balancing is meaningless until the feedback systems work.

---

## Session Inventory

| ID | Type | Slice | Description | Depends on |
|---|---|---|---|---|
| D-1 | Design | 1a | Voice guide | — |
| S-1 | Impl | 1b | Full string audit | D-1 |
| S-2 | Impl | 2a | Icons in palette | — |
| D-2 | Design | 2b | Flow & alive spec | — |
| S-3 | Impl | 2c | Pipe flow + tank level | D-2 |
| D-3 | Design | 3a | Catastrophe + trip/degrade/break | D-1 |
| S-4 | Impl | 3b | Catastrophe sequence | D-1, D-3 |
| S-5 | Impl | 3c | Trip mode (3-4 units) | D-3 |
| D-4 | Design | 4a | T1 sizing harmony | D-1, D-3 |
| S-6 | Impl | 4b | T1 profile rebalance | D-4 |

4 design sessions, 6 implementation sessions. Re-test after S-4.
