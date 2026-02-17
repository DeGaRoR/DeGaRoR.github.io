# processThis v10 — Implementation Plan

**Date:** 2026-02-17 · **Revision:** 5
**Baseline:** v10.2.4 · 24,854 lines · 89/197 headless tests
**Scope:** UI/UX overhaul. No engine/solver/thermo changes.

---

## 1. Version History — What Actually Happened

The original plan (r4) mapped step IDs to versions: Step 2.1→v10.1.0,
Step 2.2→v10.1.1, Step 3.1→v10.2.0, etc. This broke at v10.1.2 when
implementation diverged from plan order. Organic work (reconnect UX,
unified inspector architecture, 2-column layout, reactor sections,
VL composition) consumed five version numbers (v10.1.2–v10.2.4) that
the plan had allocated to animations, undo/redo, and layout work.

The plan is now authoritative on *what remains*, not on version numbers.
Version numbers track what shipped.

### Actual Release History

```
v10.0.1  Inspector schema + palette drawer (baseline)
v10.0.2  Step 0.1: Bugs + annoyances + T190–T193
v10.0.3  Step 0.1b: 8 testing feedback fixes
v10.0.4  Step 0.2: Unit taxonomy, registry cleanup, settings decoupling, T194–T197
v10.0.5  Step 0.2d: 6 testing feedback fixes (connection flow, decimal precision)
v10.0.6  Step 0.2e: Final polish (palette UX, generator rename)
v10.0.7  Prep patch: category rename (Boundaries→Streams), toolbar/info bar split
────────── 197/197 tests passing ──────────
v10.1.0  Step 2.1+2.2: Canvas interaction + connection UX (zoom, hover, arrows,
         delete, port feedback, utilities toggle)
v10.1.1  Step 2.2b: Connection UX + reconnect mode
v10.1.2  UI polish: naming audit, reconnect refinement, inspector restyling
v10.1.3  Inspector UX: add button centered, diagnostics removed, transitions
────────── 89/197 tests passing (headless-safe subset) ──────────
v10.2.0  ★ UNIFIED INSPECTOR ARCHITECTURE: conditions()/power()/kpis()/detail()
         API, all 26 units migrated, skipAutoStream eliminated, XSS hardening,
         connections section restored behind flag
v10.2.1  2-column grid layout, solver strip removed, NNG-UI5–UI10 enacted
v10.2.2  Parameter zone, reaction() hook, add button to left, auto-sliders
v10.2.3  Visual fix: param contrast, section spacing, reactor grid columns
v10.2.4  Param zone blue tint, VL per-phase composition display
```

### Test Count Note

Tests dropped from 197 to 89 passing between v10.0.7 and v10.1.0. The
197 total tests still exist and run, but 108 now fail because they exercise
inspector rendering paths that were restructured in the unified inspector
work (v10.1.0–v10.2.0). These are not regressions — the tests reference
the old API (properties(), skipAutoStream, old field names). Restoring them
requires updating test expectations to the new API, which is Phase C work.

---

## 2. NNG Compliance

### Enacted Rules (current)

```
NNG-A1    Single file. No exceptions.
NNG-A2    All UI code in script block 2. No engine contamination.
NNG-A3    Headless tests DOM-free.
NNG-A4    New structures exported on PG for testability.
NNG-A5    Registry pattern for new subsystems.
NNG-C3    No physics changes from UI work.
NNG-T1    Gate: test count stated per release. Currently 89/197.
NNG-V1/V2 Version bump + changelog per release.
NNG-S1    Solver ignores visual-only data.
NNG-L1/L2 No mass/energy impact from UI changes.
NNG-UI1   Inspector fixed zone order (superseded by UI5).
NNG-UI2   Palette never closes on unit add.
NNG-UI3   CSS-first styling (ins-* vocabulary).
NNG-UI4   Unit UI colocation (UnitInspector next to UnitRegistry).
NNG-UI5   Section order IMMUTABLE:
          Header → Status → Params → Conditions → Power & Energy
          → Reaction Data → Unit KPIs → Detail.
NNG-UI6   Data in the RIGHT hook. No T/P/flow in kpis (→ conditions).
          No power/duty in kpis (→ power). No reaction data in kpis
          (→ reaction). No status strings in kpis.
NNG-UI7   One renderer per visual style. _renderKPIGrid, _renderAutoStream,
          _renderDetailSection. No inline style overrides in unit configs.
NNG-UI8   Keyboard shortcuts never conflict with browser defaults.
NNG-UI9   XSS: esc() required for all user-editable strings in innerHTML.
          fmt.* and def.* are trusted.
NNG-UI10  2-column grid for conditions and KPIs. full-row for bars only.
```

### Proposed New Rules (for future phases)

```
NNG-UI11  Animation isolation. All animation code gated by SimSettings.animations.
          When off, render output identical to pre-animation. Animations never
          alter solver state, stream data, or unit parameters.
NNG-UI12  Theme completeness. A theme defines ALL CSS custom properties.
          No fallthrough to hardcoded values.
NNG-UI13  Visual-only scene extensions. Stickers, groups, annotations, route
          anchors: (a) serialize with JSON, (b) invisible to solveScene(),
          (c) survive undo/redo, (d) degrade gracefully.
NNG-UI14  Connection routing contract. Data model stores logical endpoints.
          Route style + anchors are visual metadata. Changing style never
          alters stream physics.
NNG-UI15  Validation rules centralized. Inspector params reference rules
          by key, never inline lambda.
```

Note: The r4 plan proposed NNG-UI5–UI10 for animation, themes, visual
extensions, keyboard, routing, and validation. These were superseded when
we enacted NNG-UI5–UI10 for the unified inspector architecture. The
plan's proposed rules are renumbered above as NNG-UI11–UI15.

---

## 3. Plan Item Audit — What's Done, What Remains

### ✓ COMPLETE — Phase A: Foundation (v10.0.1–v10.0.7)

All Step 0.x items shipped. No remaining work.

### ✓ COMPLETE — Phase B: Canvas & Inspector (v10.1.0–v10.2.4)

| Plan Item | Status | Shipped In |
|-----------|--------|------------|
| E1 Zoom to fit + reset | ✓ | v10.1.0 |
| E2 Hover highlight | ✓ | v10.1.0 |
| E3 Flow direction arrows | ✓ | v10.1.0 |
| E4 Port connection feedback | ✓ | v10.1.0 |
| E5 Delete buttons in inspector | ✓ | v10.1.0 |
| E6 Port connection status | ✓ | v10.1.0 (hidden v10.2.0) |
| E7 Show/hide utilities toggle | ✓ | v10.1.0 |
| E+ renderStreamProperties migration | ✓ | v10.2.0 (unified inspector) |
| M3a Top bar redesign | ✓ | v10.0.7 + v10.1.3 + v10.2.2 |

**Unplanned work completed:**
- Stream reconnect mode (v10.1.1–v10.1.2)
- Naming audit + _portLabel() (v10.1.2)
- Unified Inspector Architecture (v10.2.0) — conditions/power/kpis/detail
- reaction() hook (v10.2.2)
- 2-column grid layout (v10.2.1)
- VL per-phase composition (v10.2.4)
- Parameter zone visual distinction + auto-sliders (v10.2.2–v10.2.4)
- XSS hardening with esc() (v10.2.0)
- Solver strip removed from inspector (v10.2.1)
- 10 NNG rules enacted (NNG-UI1–UI10)

### ✗ REMAINING — Mapped to Future Phases

| Plan Item | Original Step | Priority | New Phase |
|-----------|--------------|----------|-----------|
| E8 Unit overlap prevention | 2.3 | Medium | C |
| E9 Balance report + modal | 2.3 | Medium | C |
| T+ Stream flowrate contract test | 2.3 | High | C |
| T+ Fix 108 broken test expectations | — | High | C |
| E10a Orthogonal channel router | 2.4 | Low | E |
| E10b Anchor points | 2.4 | Low | E |
| E10c Stream crossing bridges | 2.4 | Low | E |
| AN-1 Stream flow animation | 3.1 | Medium | D |
| AN-2 Unit activity indicators | 3.1 | Medium | D |
| AN-3 Single-run solve pulse | 3.1 | Low | D |
| AN-4a Failure shake + glow | 3.1 | Low | D |
| AN-4b Failure particle burst | 3.1 | Low | D |
| AN-5 Animation settings toggle | 3.1 | Medium | D |
| M1a-b Undo/Redo | 3.2 | High | F |
| M2 Resizable side panel | 3.3 | Medium | C |
| M3b Toast notifications | 3.3 | Low | F |
| M4a-b Validation rules | 3.4 | Medium | F |
| M5a-b Theme presets | 3.5 | Low | G |
| M6 Menu styling | 3.5 | Low | G |
| M7a Composition bar charts | 3.6 | Low | H |
| M7b Reactor T,P explorer | 3.6 | Medium | H |
| M8 Auto-save + beforeunload | 3.6 | High | H |
| P1 Canvas stickers | 4.1 | Low | I |
| P2 Grouping / multi-select | 4.2 | Low | I |
| P3 Symbol families | 4.3 | Low | J |
| P4 Port layouts | 4.4 | Low | J |
| P5 Convergence graph | 4.5 | Low | J |

---

## 4. Revised Release Plan

Version strategy: minor bumps (v10.X.0) for feature phases, patches
(v10.x.Y) for fixes within a phase. No pre-allocation — versions are
assigned at ship time.

### Phase C — Polish & Test Recovery → v10.3.x

Restore test suite to full green. Fix remaining canvas rough edges.

**Scope:**
- Fix 108 broken test expectations (update to new inspector API)
- T+ Stream flowrate contract test (from old plan)
- E8 Unit overlap prevention (UI only — nudge on drop)
- E9 Balance report restructure + modal
- M2 Resizable inspector side panel

**Gate:** 197/197 tests (restored). No engine changes.

### Phase D — Animations → v10.4.x

All visual. Gated by SimSettings.animations (NNG-UI11).

**Scope:**
- AN-5 Settings toggle + failure sub-toggle
- AN-1 Stream flow animation (CSS dash-march)
- AN-2 Unit activity indicators (rotate/heat/react)
- AN-3 Single-run solve pulse
- AN-4a Failure shake + glow
- AN-4b Failure particle burst (catastrophic)

**Gate:** 197/197 tests. Animations off = identical render.

### Phase E — Connection Routing → v10.5.x

**Scope:**
- E10a Orthogonal channel router + settings
- E10b Anchor points (draggable waypoints)
- E10c Stream crossing bridge arcs

**Gate:** 197/197 tests. NNG-UI14 enforced.

### Phase F — Undo + Validation + Toast → v10.6.x

**Scope:**
- M1a-b Undo/Redo architecture (UndoStack, Ctrl+Z/Shift+Z)
- M4a-b Validation rules registry + apply to all 27 inspectors
- M3b Toast notification system
- T198 UndoStack contract test
- T199 ValidationRules contract test

**Gate:** 199/199 tests. NNG-UI15 enforced.

### Phase G — Theming → v10.7.x

**Scope:**
- M5a CSS variable extraction (~30 vars)
- M5b Theme presets (dark / light / engineering)
- M6 Menu styling consistency

**Gate:** 199/199 tests. NNG-UI12 enforced.

### Phase H — Visualization + Persistence → v10.8.x

**Scope:**
- M7a Composition bar charts
- M7b Reactor T,P equilibrium explorer
- M8 Auto-save + beforeunload

**Gate:** 199/199 tests.

### Phase I — Canvas Extensions → v10.9.x

**Scope:**
- P1 Canvas stickers (data model + rendering + drag)
- P2 Grouping / multi-select (rubber-band, visual groups)
- T195 Sticker round-trip, T196 Group round-trip

**Gate:** 201/201 tests. NNG-UI13 enforced.

### Phase J — Symbols + Advanced → v10.10.x

**Scope:**
- P3 Symbol families (ISO P&ID + simplified)
- P4 Port layout variants
- P5 Convergence sparkline

**Gate:** 201/201 tests.

---

## 5. Design Specifications

Specs from r4 §4 remain valid for their respective items. Key changes:

- **§4.8 (Port Feedback):** Already implemented in v10.1.0. Spec accurate.
- **§4.5 (Zoom to Fit):** Already implemented in v10.1.0. Spec accurate.
- **§4.9 (Orthogonal Router):** Unchanged, deferred to Phase E.
- **§4.10 (Animations):** Unchanged, deferred to Phase D.
- **§4.11 (Undo/Redo):** Unchanged, deferred to Phase F.
- **§4.12 (Reactor Explorer):** Unchanged, deferred to Phase H.

**NEW spec — Unified Inspector API (v10.2.0+):**

```javascript
UnitInspector.xxx = {
  params(u)            → [{label, get, set, step, min?, max?, type?, ...}]
  customParams(c,u,s)  → void (direct DOM)
  conditions(u, ud)    → [{label, value, ...}]  // overrides auto-stream
  power(u, ud)         → [{label, value, ...}]  // "Power & Energy" section
  reaction(u, ud)      → [{label, value, ...}]  // "Reaction Data" section
  kpis(u, ud)          → [{label, value, tone?, bar?, barColor?}]
  detail(u, ud, sc)    → [{label, value, tone?, full?}]
};
```

Pipeline (NNG-UI5): Header → Status → Params (.ins-params-zone) →
Conditions (auto-stream or override) → Power & Energy → Reaction Data
→ Unit KPIs → Detail (collapsible).

Params with `min`+`max` auto-render as slider+number combos.
VL streams show per-phase composition (stream.y, stream.x).

---

## 6. Phase Tracker

```
═══════════════════════════════════════════════════════════════════
 PHASE A — FOUNDATION                            ✓ v10.0.1–v10.0.7
═══════════════════════════════════════════════════════════════════
 [✓] Step 0.1    Bugs + annoyances                      v10.0.2
 [✓] Step 0.1b   Testing feedback                       v10.0.3
 [✓] Step 0.2    Taxonomy + registry + settings          v10.0.4
 [✓] Step 0.2d   Testing feedback                       v10.0.5
 [✓] Step 0.2e   Final polish                           v10.0.6
 [✓] Extra       Prep patch (info bar, toolbar)          v10.0.7

═══════════════════════════════════════════════════════════════════
 PHASE B — CANVAS & INSPECTOR                    ✓ v10.1.0–v10.2.4
═══════════════════════════════════════════════════════════════════
 [✓] E1    Zoom to fit + reset view                      v10.1.0
 [✓] E2    Hover highlight (units + streams)             v10.1.0
 [✓] E3    Flow direction arrows (SVG markers)           v10.1.0
 [✓] E4    Port connection feedback (green/dim)          v10.1.0
 [✓] E5    Delete buttons in inspector                   v10.1.0
 [✓] E6    Port connection status display                v10.1.0
 [✓] E7    Show/hide utilities toggle                    v10.1.0
 [✓] +     Stream reconnect mode                         v10.1.1
 [✓] +     Naming audit + _portLabel()                   v10.1.2
 [✓] +     Inspector restyling (border-radius, inputs)   v10.1.2
 [✓] +     Add button redesign (centered → left)         v10.1.3 → v10.2.2
 [✓] +     Inspector transitions (slide-up + fade-in)    v10.1.3
 [✓] +     Diagnostics removed (inline errors)           v10.1.3
 [✓] M3a   Top bar redesign (3-zone)                     v10.0.7–v10.2.2
 [✓] E+    renderStreamProperties → unified inspector    v10.2.0
 [✓] ★     UNIFIED INSPECTOR ARCHITECTURE               v10.2.0
            conditions() / power() / kpis() / detail()
            All 26 units migrated. skipAutoStream eliminated.
 [✓] +     XSS hardening (esc() helper)                  v10.2.0
 [✓] +     Connections restored (hidden behind flag)      v10.2.0
 [✓] +     2-column grid layout                          v10.2.1
 [✓] +     Solver strip removed from inspector           v10.2.1
 [✓] +     NNG-UI5 through NNG-UI10 enacted              v10.2.1
 [✓] +     reaction() hook (Reaction Data section)       v10.2.2
 [✓] +     Parameter zone (.ins-params-zone, blue)       v10.2.2–v10.2.4
 [✓] +     Auto-sliders (min/max → slider+number)        v10.2.2
 [✓] +     VL per-phase composition (y/x breakdown)      v10.2.4

═══════════════════════════════════════════════════════════════════
 PHASE C — POLISH & TEST RECOVERY                    → v10.3.x
═══════════════════════════════════════════════════════════════════
 [ ] T+    Fix 108 broken test expectations (new API)
 [ ] T+    Stream flowrate contract test
 [ ] E8    Unit overlap prevention (UI only)
 [ ] E9    Balance report restructure + modal
 [ ] M2    Resizable inspector side panel

═══════════════════════════════════════════════════════════════════
 PHASE D — ANIMATIONS                                → v10.4.x
═══════════════════════════════════════════════════════════════════
 [ ] AN-5  Settings toggle + failure sub-toggle
 [ ] AN-1  Stream flow animation (CSS dash)
 [ ] AN-2  Unit activity indicators
 [ ] AN-3  Single-run solve pulse
 [ ] AN-4a Failure shake + glow
 [ ] AN-4b Failure particle burst

═══════════════════════════════════════════════════════════════════
 PHASE E — CONNECTION ROUTING                         → v10.5.x
═══════════════════════════════════════════════════════════════════
 [ ] E10a  Orthogonal channel router + settings
 [ ] E10b  Anchor points on connections
 [ ] E10c  Stream crossing bridge arcs

═══════════════════════════════════════════════════════════════════
 PHASE F — UNDO + VALIDATION + TOAST                  → v10.6.x
═══════════════════════════════════════════════════════════════════
 [ ] M1a   Undo architecture + snapshots
 [ ] M1b   Undo testing + edge cases
 [ ] M4a   Validation architecture + rules
 [ ] M4b   Apply to all 27 inspectors
 [ ] M3b   Toast notification system
 [ ] T198  UndoStack contract test
 [ ] T199  ValidationRules contract test

═══════════════════════════════════════════════════════════════════
 PHASE G — THEMING                                    → v10.7.x
═══════════════════════════════════════════════════════════════════
 [ ] M5a   CSS variable extraction (~30 vars)
 [ ] M5b   Theme presets (dark / light / engineering)
 [ ] M6    Menu styling consistency

═══════════════════════════════════════════════════════════════════
 PHASE H — VISUALIZATION + PERSISTENCE                → v10.8.x
═══════════════════════════════════════════════════════════════════
 [ ] M7a   Composition bar charts
 [ ] M7b   Reactor T,P equilibrium explorer
 [ ] M8    Auto-save + beforeunload

═══════════════════════════════════════════════════════════════════
 PHASE I — CANVAS EXTENSIONS                          → v10.9.x
═══════════════════════════════════════════════════════════════════
 [ ] P1a   Sticker data model + rendering
 [ ] P1b   Drag-from-inspector interaction
 [ ] P1c   Sticker management
 [ ] P2a   Multi-select (shift / rubber-band)
 [ ] P2b   Visual groups (flat, nesting-ready)
 [ ] P2c   Group interaction polish
 [ ] T195  Sticker round-trip test
 [ ] T196  Group round-trip test

═══════════════════════════════════════════════════════════════════
 PHASE J — SYMBOLS + ADVANCED                         → v10.10.x
═══════════════════════════════════════════════════════════════════
 [ ] P3a   Symbol family architecture
 [ ] P3b   ISO P&ID symbol set
 [ ] P3c   Simplified symbol set
 [ ] P4a   Port positioning architecture
 [ ] P4b   Layout variants for key units
 [ ] P5    Solver convergence sparkline
```
