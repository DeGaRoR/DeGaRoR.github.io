# processThis v10 — Implementation Plan

**Date:** 2026-02-16 · **Revision:** 4 (final)
**Baseline:** v10.0.1 · 23,598 lines · 189/189 tests passing
**Scope:** UI/UX overhaul. No engine/solver/thermo changes.

---

## Table of Contents

1. [NNG Compliance](#1-nng-compliance)
2. [Testing Strategy](#2-testing-strategy)
3. [Release Plan](#3-release-plan) — step-level IDs for instruction
4. [Design Specifications](#4-design-specifications) — survives across sessions
5. [Deferred Items](#5-deferred-items)
6. [Phase Tracker](#6-phase-tracker) — monitor progress

---

## 1. NNG Compliance

### Existing Rules — Conformance

All 35 existing NNG rules reviewed. UI work touches these:

| Rule | How we comply |
|------|---------------|
| NNG-A1 | Single file. No exceptions. |
| NNG-A2 | All UI code in script block 2. Animation, themes, stickers, groups — zero contamination of block 1. |
| NNG-A3 | Headless tests remain DOM-free. New "UI data contract" tests (§2) are also headless. |
| NNG-A4 | New structures (stickers, groups, route anchors) exported on PG for testability. |
| NNG-A5 | ValidationRules follows registry pattern. UnitAnimation follows colocation pattern (NNG-UI4). |
| NNG-C3 | No physics changes. Animations, themes, routing — visual-only. |
| NNG-T1 | Gate: 189/189 after every release. |
| NNG-V1/V2 | Gate: version bump + changelog per release. |
| NNG-UI1 | Inspector zone order preserved: Header → Status → Params → Props → Diag. |
| NNG-UI2 | Palette never closes on unit add. New features (utilities toggle, port feedback) don't close it. |
| NNG-UI3 | All new UI uses `ins-*` vocabulary. Migrations move old code to `ins-*`. |
| NNG-UI4 | UnitInspector colocated with UnitRegistry entries. UnitAnimation follows same pattern. |

### Explicit Exceptions

**E8 (overlap prevention):** UI-only enforcement. `scene.placeUnit()` unchanged — engine stays DOM-free (NNG-A2), tests pass (NNG-T1). Documented, intentional.

**Stickers/Groups (P1, P2):** Visual-only scene data. Solver ignores them (NNG-S1 unchanged). Serialize with scene (NNG-A4). No mass/energy impact (NNG-L1/L2).

**Routing (E10):** Changes only SVG path `d` attribute. Route metadata on connections is visual — solver never reads it (NNG-UI9).

### Proposed New NNG Rules

```
NNG-UI5   Animation isolation.  All animation code gated by
          SimSettings.animations.  When off, render output is identical
          to pre-animation versions.  Animations never alter solver
          state, stream data, or unit parameters.

NNG-UI6   Theme completeness.  A theme defines ALL CSS custom properties
          in the theme contract.  No fallthrough to hardcoded values.
          Icons use currentColor or CSS variables for recoloring.

NNG-UI7   Visual-only scene extensions.  Stickers, groups, annotations,
          route anchors must: (a) serialize with exportJSON/importJSON,
          (b) be invisible to solveScene(), (c) survive undo/redo,
          (d) degrade gracefully in old saves.

NNG-UI8   Keyboard shortcuts never conflict with browser defaults when
          preventable.  All documented in controls help.  Never fire
          when focus is in input/textarea/select.

NNG-UI9   Connection routing contract.  Data model stores logical
          endpoints only.  Route style + anchors are visual metadata.
          Renderer resolves pixel paths at draw time.  Changing style
          never alters stream physics.

NNG-UI10  Validation rules centralized in ValidationRules registry.
          Inspector params reference rules by key, never inline lambda.
```

---

## 2. Testing Strategy

### Current State
189 headless tests in script block 3. All engine/solver. Zero UI tests. Test coverage for user-facing data presentation: **none**.

### Problem
The `balance.mass.in` → `balance.mass.inItems` bug shipped because no test exercises the data structures that feed the UI. Inspector entries read `ud.last.*` fields but no test verifies those fields exist with correct types after a solve.

### Solution: UI Data Contract Tests (new test section T190+)

These are **headless tests** (NNG-A3 compliant) that verify the data contracts between engine output and UI consumers. They run in script block 3 alongside existing tests.

**What they test:**
```
T190–T199: Inspector data contracts
  T190: Every UnitInspector.X.properties(u, ud, grid) call returns
        without throwing for a solved unit with typical inputs.
  T191: computeSystemBalance(scene) returns correct shape:
        { mass: { inItems:[], outItems:[], totalIn, totalOut, ... },
          energy: { in:{items:[],...}, out:{items:[],...}, ... } }
  T192: _streamNames[type] returns string for all StreamType values.
  T193: fmt.kW / fmt.T / fmt.P / fmt.flow / fmt.pct / fmt.time
        return strings (not undefined) for typical and edge values.
  T194: renderStreamProperties data path: calculateStreamFlowrates(s)
        returns { nTotal, mTotal, vTotal } for valid material stream.
  T195: Sticker data model round-trip: serialize → deserialize → values match.
  T196: Group data model round-trip: serialize → deserialize → unitIds match.
  T197: ValidationRules.temperature(300) → null, ValidationRules.temperature(-1) → string.
  T198: UndoStack: push 3 snapshots, undo twice, redo once → correct state.
  T199: Reserved for routing contract tests.
```

**When to add:** Each release adds its corresponding contract tests. E.g., v10.0.2 adds T190–T193, M1 adds T198, P1 adds T195.

**Why this works:** These tests exercise the exact data shapes the UI reads, without touching the DOM. They catch property-name mismatches (the class of bug we hit) at test time.

---

## 3. Release Plan

Every release has a step ID (e.g., `0.1`, `2.3`) for instruction reference ("proceed with step 2.3"). Each release lists its exact scope, version, and test expectations.

---

### Step 0.1 — Bugs + Annoying → v10.0.2

**Scope:**
- B1: Stream click crash — add `_streamNames` lookup, replace `StreamType._name()`
- B2: Balance display scope — wrap in `if (!ui.selectedUnitId && !ui.selectedConnId)`
- B3: Checkbox styling — CSS `input[type="checkbox"]` + flex alignment
- A1: Shortcut help — remove R, add `/`, `Esc`, `Ctrl+Enter`, `Del`
- A2: `Ctrl+Enter` for Test — keydown handler
- A3: `source_air` icon → `ico-source`
- A4: Font/readability — CSS size/opacity/spacing bump
- A5: Zoom limits — clamp viewBox `[200, 10000]`
- A6: Dead code — delete `showUnitLibrary()`, rotation comments
- A7: Connection refusal feedback — specific messages per failure path
- A-extra: `btnAdd` inline style → use `.tbtn.add-unit` CSS class
- **Tests:** Add T190 (inspector no-throw), T191 (balance shape), T192 (stream names), T193 (fmt helpers)

**Estimated:** ~2 hr. **Gate:** 189+4 tests pass (193 total).

---

### Step 2.1 — Canvas Interaction → v10.1.0

**Scope:**
- E1: Zoom to fit + reset view
- E2: Hover highlight on units/streams
- E3: Flow direction arrows (SVG markers)
- E5: Delete buttons in inspector

**Estimated:** ~2 hr.

---

### Step 2.2 — Connection UX → v10.1.1

**Scope:**
- E4: Port connection feedback (green/dim during connect mode)
- E6: Port connection status display in inspector
- E7: Show/hide utilities toggle

**Estimated:** ~2 hr.

---

### Step 2.3 — Canvas Polish → v10.1.2

**Scope:**
- E8: Unit overlap prevention (UI only)
- E9: Balance report restructure + menu modal
- E-extra: `renderStreamProperties` migration to `ins-*` vocabulary
- **Tests:** Add T194 (stream flowrate data contract)

**Estimated:** ~2.5 hr.

---

### Step 2.4 — Connection Routing → v10.1.3

**Scope:**
- E10a: Orthogonal channel router + settings toggle
- E10b: Anchor points on connections
- E10c: Stream crossing bridge arcs

**Estimated:** ~5 hr. Split internally if needed.

---

### Step 3.1 — Animations → v10.2.0

**Scope:**
- AN-5: Animation settings + failure sub-toggle
- AN-1: Stream flow animation (CSS dash)
- AN-2: Unit activity indicators
- AN-3: Single-run solve pulse
- AN-4a: Failure shake + glow
- AN-4b: Failure particle burst

**Estimated:** ~5.5 hr.

---

### Step 3.2 — Undo/Redo → v10.2.1

**Scope:**
- M1a: Undo architecture + snapshots
- M1b: Testing + edge cases
- **Tests:** Add T198 (UndoStack round-trip)

**Estimated:** ~3.5 hr.

---

### Step 3.3 — Layout + Toast → v10.3.0

**Scope:**
- M2: Resizable side panel
- M3a: Top bar redesign (3-zone)
- M3b: Toast notification system

**Estimated:** ~4.5 hr.

---

### Step 3.4 — Validation → v10.3.1

**Scope:**
- M4a: Validation architecture + rules registry
- M4b: Apply to all 27 inspectors
- **Tests:** Add T197 (ValidationRules contract)

**Estimated:** ~2.5 hr.

---

### Step 3.5 — Theming → v10.4.0

**Scope:**
- M5a: CSS variable extraction (~30 vars)
- M5b: Theme presets (dark/light/engineering)
- M6: Menu styling consistency (modal unification)

**Estimated:** ~7.5 hr.

---

### Step 3.6 — Visualization + Persistence → v10.5.0

**Scope:**
- M7a: Composition bar charts
- M7b: Reactor T,P explorer (see §4.12)
- M8: Auto-save + beforeunload

**Estimated:** ~5 hr.

---

### Step 4.1 — Canvas Stickers → v10.6.0

**Scope:** P1a + P1b + P1c. **Tests:** T195.
**Estimated:** ~7.5 hr.

### Step 4.2 — Grouping → v10.7.0

**Scope:** P2a + P2b + P2c. **Tests:** T196.
**Estimated:** ~10 hr.

### Step 4.3 — Symbol Families → v10.8.0

**Scope:** P3a + P3b + P3c.
**Estimated:** ~8 hr.

### Step 4.4 — Port Layouts → v10.9.0

**Scope:** P4a + P4b.
**Estimated:** ~4.5 hr.

### Step 4.5 — Convergence Graph → v10.10.0

**Scope:** P5.
**Estimated:** ~2 hr.

---

## 4. Design Specifications

This section contains enough architectural detail to reconstruct each feature from scratch in a fresh session. Data structures, CSS classes, function signatures, and key decisions are documented here.

---

### 4.1 Stream Click Fix (B1)

```javascript
// Add after StreamType definition (line ~2607):
const _streamNames = ['Material', 'Heat', 'Mechanical', 'Electrical'];

// Replace in updatePropertiesPanel stream branch:
// OLD: StreamType._name(fromPort?.type)
// NEW: _streamNames[fromPort?.type] ?? 'Unknown'
```

---

### 4.2 Balance Display Scope (B2)

The balance rendering block (lines 15337–15430) moves inside the `else` (nothing selected) branch. The solver summary strip remains unconditional.

```
if (ui.selectedUnitId) { ... unit inspector ... }
else if (ui.selectedConnId) { ... stream inspector ... }
else {
  // Empty state hint
  // Compact balance badge strip (mass ✓/✗, energy ✓/✗)
  // Full balance detail (collapsible)
}
// Solver summary strip (always)
buildSolverSummary(propEditor);
```

---

### 4.3 Checkbox Styling (B3)

```css
input[type="checkbox"] {
  appearance: none;
  width: 16px; height: 16px;
  background: var(--bg-tertiary, #1e293b);
  border: 1.5px solid var(--border-secondary, #475569);
  border-radius: 3px;
  cursor: pointer;
  vertical-align: middle;
  position: relative;
  flex-shrink: 0;
}
input[type="checkbox"]:checked {
  background: var(--accent-blue, #2563eb);
  border-color: var(--accent-blue, #2563eb);
}
input[type="checkbox"]:checked::after {
  content: '✓';
  position: absolute; inset: 0;
  display: flex; align-items: center; justify-content: center;
  color: white; font-size: 11px; font-weight: 700;
}
```

Container flex fix: all checkbox rows use `display: flex; align-items: center; gap: 8px;`.

---

### 4.4 Zoom Limits (A5)

```javascript
// In wheel handler, after computing newW/newH:
const MIN_VIEW = 200, MAX_VIEW = 10000;
v.w = Math.max(MIN_VIEW, Math.min(MAX_VIEW, newW));
v.h = Math.max(MIN_VIEW, Math.min(MAX_VIEW, newH));
```

---

### 4.5 Zoom to Fit + Reset (E1)

```javascript
function fitView() {
  if (!scene.units.size) { resetView(); return; }
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [id, u] of scene.units) {
    const def = UnitRegistry.get(u.defId);
    minX = Math.min(minX, u.x * scene.tile);
    minY = Math.min(minY, u.y * scene.tile);
    maxX = Math.max(maxX, (u.x + def.w) * scene.tile);
    maxY = Math.max(maxY, (u.y + def.h) * scene.tile);
  }
  const pad = 0.1; // 10% padding
  const w = maxX - minX, h = maxY - minY;
  ui.view = { x: minX - w*pad, y: minY - h*pad, w: w*(1+2*pad), h: h*(1+2*pad) };
  render();
}
function resetView() {
  ui.view = { x: 0, y: 0, w: 1056, h: 672 };
  render();
}
```

Two toolbar buttons: `⊞ Fit` and `⊡ Reset`. Keyboard: no shortcut (avoid conflicts).

---

### 4.6 Hover Highlight (E2)

Strategy: apply CSS classes on SVG elements via JS `pointerenter`/`pointerleave`. SVG filter for brightness.

```xml
<!-- Add to <defs>: -->
<filter id="hover-brighten">
  <feComponentTransfer>
    <feFuncR type="linear" slope="1.3"/>
    <feFuncG type="linear" slope="1.3"/>
    <feFuncB type="linear" slope="1.3"/>
  </feComponentTransfer>
</filter>
```

```css
.unit-hover rect { filter: url(#hover-brighten); }
.conn-hover { stroke-width: 5 !important; filter: url(#hover-brighten); }
```

Applied in `drawUnits()` and `drawConnections()` via `pointerenter`/`pointerleave` on the group/path. Do NOT apply when dragging or in connect mode.

---

### 4.7 Flow Direction Arrows (E3)

```xml
<!-- One marker per stream type, in <defs>: -->
<marker id="flow-material" viewBox="0 0 8 6" refX="4" refY="3"
        markerWidth="8" markerHeight="6" orient="auto">
  <path d="M0,0 L8,3 L0,6 Z" fill="#94a3b8"/>
</marker>
<!-- Repeat for heat (#fbbf24), mechanical (#a855f7), electrical (#22c55e) -->
```

Applied as `marker-mid` on connection paths. For Bézier: midpoint at t=0.5. For orthogonal: midpoint of longest segment. Marker color uses `fill: var(--stream-{type})` once themes land (M5); hardcoded until then.

---

### 4.8 Port Connection Feedback (E4)

During connect mode (`ui.pendingFrom` set):

```javascript
// In drawUnits(), per port circle:
if (ui.pendingFrom) {
  const fromDef = UnitRegistry.get(scene.units.get(ui.pendingFrom.unitId).defId);
  const fromPort = fromDef.ports.find(p => p.portId === ui.pendingFrom.portId);
  const isCompatible = p.dir === PortDir.IN && p.type === fromPort.type;
  const isOccupied = scene.connections.some(
    c => c.to.unitId === u.id && c.to.portId === p.portId
  );
  if (isCompatible && !isOccupied) {
    // Green ring + pulse
    circle.setAttribute('stroke', '#22c55e');
    circle.setAttribute('stroke-width', '3');
    circle.classList.add('port-pulse');
  } else {
    circle.setAttribute('opacity', '0.3');
  }
}
```

```css
@keyframes port-pulse {
  0%, 100% { r: 10; }
  50% { r: 13; }
}
.port-pulse { animation: port-pulse 0.8s ease-in-out infinite; }
```

---

### 4.9 Orthogonal Channel Router (E10)

**Data model extension on connections:**
```javascript
// connection object gains:
{
  from: { unitId, portId },
  to: { unitId, portId },
  routeStyle: 'bezier' | 'orthogonal',  // default from SimSettings
  anchors: []  // [{x, y}] user-defined waypoints
}
```

**Router algorithm (orthogonal mode):**
1. Compute port exit points and directions (perpendicular to unit edge).
2. Build obstacle set: all unit bounding boxes (padded 0.5 grid cells).
3. Route: exit port → extend perpendicular by 1 cell → navigate H/V segments around obstacles to reach target port approach → enter port perpendicular.
4. If anchors defined: route through each anchor in order (as intermediate waypoints).
5. Path: series of `L` (line-to) commands forming right-angle segments.

**Stream crossing detection:**
At draw time, for each pair of connections, check segment intersections. If found, the later-drawn path gets a small semicircle bridge at the intersection point: `A 6,6 0 0,1 dx,0` replacing the straight segment through the crossing.

**Anchor interaction:**
When a connection is selected and orthogonal mode active, anchors render as small diamond SVG markers (◇, 6px). Draggable via the same pointer handler pattern. Double-click on a segment creates a new anchor at that point. Delete key on selected anchor removes it.

---

### 4.10 Animation System

**SimSettings additions:**
```javascript
SimSettings.animations = true;        // master toggle
SimSettings.failureAnimations = true;  // sub-toggle (only when master on)
```

**CSS keyframes (add to `<style>`):**
```css
/* Stream flow — dash march */
@keyframes stream-flow { to { stroke-dashoffset: -24; } }
.stream-flowing { stroke-dasharray: 12 12; animation: stream-flow 0.8s linear infinite; }
.stream-flowing.power { stroke-dasharray: 8 4; animation-duration: 0.4s; }
@keyframes stream-heat-pulse { 0%,100% { opacity:0.7; } 50% { opacity:1; } }
.stream-flowing.heat { animation: stream-heat-pulse 1.5s ease-in-out infinite; }

/* Unit activity */
@keyframes unit-vibrate { 0%,100% { transform: translate(0); } 25% { transform: translate(-1px,0.5px); } 75% { transform: translate(1px,-0.5px); } }
@keyframes unit-heat-glow { 0%,100% { filter: none; } 50% { filter: drop-shadow(0 0 4px #f59e0b); } }
@keyframes unit-react-pulse { 0%,100% { transform: scale(1); } 50% { transform: scale(1.02); } }
.unit-active-rotate { animation: unit-vibrate 0.15s linear infinite; transform-origin: center; }
.unit-active-heat { animation: unit-heat-glow 2s ease-in-out infinite; }
.unit-active-react { animation: unit-react-pulse 1s ease-in-out infinite; transform-origin: center; }

/* Solve flash */
@keyframes unit-flash { 0% { filter: brightness(1); transform: scale(1); } 50% { filter: brightness(1.5); transform: scale(1.03); } 100% { filter: brightness(1); transform: scale(1); } }
.unit-flash { animation: unit-flash 0.2s ease-out; }

/* Failure */
@keyframes unit-shake { 0%,100% { transform: translate(0); } 25% { transform: translate(-2px,1px); } 75% { transform: translate(2px,-1px); } }
.unit-warn-pulse { animation: unit-heat-glow 1.5s ease-in-out infinite; } /* reuse amber */
.unit-error-shake { animation: unit-shake 0.3s ease-in-out 3; transform-origin: center; }
.unit-catastrophic { animation: unit-shake 0.2s linear infinite; filter: drop-shadow(0 0 6px #ef4444); }
```

**Unit animation mapping** (colocated with UnitInspector):
```javascript
const UnitAnimation = {
  compressor: 'rotate', pump: 'rotate', gas_turbine: 'rotate',
  heater: 'heat', cooler: 'heat', electric_heater: 'heat',
  hex: 'heat',
  reactor_adiabatic: 'react', reactor_equilibrium: 'react',
  mixer: null, splitter: null, valve: null, // no activity animation
  tank: null, battery: null, // fill level is their visual feedback
  // sources/sinks: no animation
};
```

**Solve pulse** needs access to topological order. The solver already computes it internally. To expose: add `lastSolve.topoOrder: string[]` (array of unit IDs in solve order) to the solve result. This is a minor engine-side addition — it reads existing data, doesn't change solver behavior (NNG-C3 compliant).

**Particle burst (catastrophic):**
On detecting CATASTROPHIC error state change: create 6–8 SVG `<circle>` elements at unit center, each with random angle and animation:
```css
@keyframes particle-burst {
  0% { r: 2; opacity: 1; }
  100% { r: 0; opacity: 0; transform: translate(var(--dx), var(--dy)); }
}
```
Each circle gets `--dx` and `--dy` CSS custom properties set to random offsets (±20px). Animation duration: 600ms. Removed via `animationend`.

---

### 4.11 Undo / Redo

```javascript
class UndoStack {
  constructor(maxSize = 50) {
    this._stack = [];   // string[] (JSON snapshots)
    this._index = -1;   // current position
    this._max = maxSize;
  }
  snapshot(scene) {
    // Truncate any redo states
    this._stack = this._stack.slice(0, this._index + 1);
    this._stack.push(scene.exportJSON());
    if (this._stack.length > this._max) this._stack.shift();
    this._index = this._stack.length - 1;
  }
  undo(scene) {
    if (this._index <= 0) return false;
    this._index--;
    scene.importJSON(this._stack[this._index]);
    return true;
  }
  redo(scene) {
    if (this._index >= this._stack.length - 1) return false;
    this._index++;
    scene.importJSON(this._stack[this._index]);
    return true;
  }
  get canUndo() { return this._index > 0; }
  get canRedo() { return this._index < this._stack.length - 1; }
}
```

**Mutation hook points** (calls `undoStack.snapshot(scene)` before mutation):
`scene.placeUnit`, `scene.moveUnit` (debounced — only on pointerup), `scene.deleteUnit`, `scene.connect`, `scene.connections.splice` (disconnect), param `set()` calls (debounced 500ms).

**Keyboard:** `Ctrl+Z` → undo, `Ctrl+Shift+Z` → redo. If `TimeClock.mode === 'playing'`, pause first.

**Toolbar:** ↶ ↷ buttons, disabled when `!canUndo` / `!canRedo`.

---

### 4.12 Reactor T,P Explorer (M7b — new)

**Concept:** An interactive chart in the reactor inspector that helps users find optimal inlet T and P by visualizing equilibrium conversion as a function of temperature. This is a thermodynamic "feasibility map."

**What we have:** `ReactionRegistry.lnK(id, T_K)` computes ln(K_eq) via van't Hoff. We have `_dH0_Jmol`, `_dS0_JmolK`, `_delta_nu` per reaction. Reactor stores current `reactionId`, inlet T, and P.

**Visualization — "Conversion vs Temperature" curve:**

For a stoichiometric feed at pressure P:
```
K(T) = exp(lnK(id, T))
For gas-phase, Kp = K × (P₀/P)^Δν   where P₀ = 100000 Pa
For a single-reaction system: solve K = ξ_eq^(Σν_products) / (1−ξ_eq)^(Σν_reactants)
  → bisection for ξ_eq at each T
```

Rendered as an inline SVG chart (~200×140px) in the reactor inspector properties zone:
- **X-axis:** Temperature (from reaction `Tmin_K` to `Tmax_K`)
- **Y-axis:** Equilibrium conversion (0–100%)
- **Curve:** Blue line showing ξ_eq(T) at current pressure
- **Vertical marker:** Current inlet T (dashed red line)
- **Horizontal marker:** Current conversion (dashed green line)
- **Shaded region:** T range where conversion > 50% (subtle green fill)
- **Label:** "⇌ Equilibrium at P = {current P} bar"

**Interactivity (stretch):** Hovering the chart shows T and ξ values as tooltip. Clicking sets the reactor's inlet T parameter (direct feedback loop).

**Implementation:**
```javascript
// In UnitInspector.reactor_equilibrium.properties():
function drawEquilibriumCurve(container, rxnId, P_Pa, T_current) {
  const rxn = ReactionRegistry.get(rxnId);
  if (!rxn?._thermoComplete) return;
  const W = 200, H = 140, pad = { t:20, r:10, b:25, l:35 };
  // ... compute 50 points of ξ_eq(T) via bisection ...
  // ... render as SVG <polyline> with axes ...
}
```

**Future extension:** A second mode showing a 2D T-P heatmap (conversion as color). Also, once non-stoichiometric feeds are supported, add a composition slider.

---

### 4.13 Resizable Side Panel (M2)

```css
.app {
  display: grid;
  grid-template-columns: 1fr var(--panel-width, 360px);
}
.panel-drag-handle {
  width: 4px;
  cursor: col-resize;
  background: transparent;
  position: absolute; left: -2px; top: 0; bottom: 0;
  z-index: 10;
}
.panel-drag-handle:hover,
.panel-drag-handle.active {
  background: var(--accent-blue, #2563eb);
}
```

JS: pointer events on handle update `--panel-width` on `document.documentElement.style`. Clamp `[280, window.innerWidth * 0.5]`. Save to `localStorage('panelWidth')`.

---

### 4.14 Top Bar Redesign (M3a)

```
┌─────────────────────────────────────────────────────────────────┐
│ [⟳Test][▶Step][▶▶Play][⏸][↺]  t=0:45 f12 Δt=60s 2x          │
│                                                                 │
│         ──── Process Name Input (centered, wide) ────           │
│                                                                 │
│            [+ Add] [⚡Utils] [⊞Fit][⊡Reset] [☰Menu] [💾File]   │
└─────────────────────────────────────────────────────────────────┘
```

Three-zone flexbox: `justify-content: space-between`. Left zone gets subtle `background: rgba(255,255,255,0.03); border-radius: 8px; padding: 4px 8px;` to visually group transport.

---

### 4.15 Toast Notifications (M3b)

```javascript
function showToast(message, type = 'info', duration = 3000) {
  const toast = el('div', { class: `toast toast-${type}` });
  toast.textContent = message;
  toastContainer.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('visible'));
  setTimeout(() => {
    toast.classList.remove('visible');
    toast.addEventListener('transitionend', () => toast.remove());
  }, type === 'error' ? 5000 : duration);
}
```

```css
.toast-container {
  position: absolute; bottom: 16px; left: 50%; transform: translateX(-50%);
  display: flex; flex-direction: column-reverse; gap: 6px; z-index: 100;
  pointer-events: none;
}
.toast {
  padding: 8px 16px; border-radius: 8px; font-size: 12px; font-weight: 600;
  opacity: 0; transform: translateY(8px);
  transition: opacity 0.2s, transform 0.2s;
  pointer-events: auto;
}
.toast.visible { opacity: 1; transform: translateY(0); }
.toast-info { background: #1e3a5f; color: #93c5fd; }
.toast-success { background: #064e3b; color: #6ee7b7; }
.toast-warning { background: #78350f; color: #fbbf24; }
.toast-error { background: #7f1d1d; color: #fca5a5; }
```

Max 3 toasts visible. `setStatus()` becomes `showToast()`. Remove entire `statusSection`/`statusContent` infrastructure.

---

### 4.16 Validation Rules (M4a)

```javascript
const ValidationRules = {
  temperature:     v => v > 0 && v < 10000 ? null : 'Must be 0–10,000 K',
  pressure:        v => v > 0 && v < 1e9   ? null : 'Must be > 0 Pa',
  fraction:        v => v >= 0 && v <= 1    ? null : 'Must be 0–1',
  percentage:      v => v >= 0 && v <= 100  ? null : 'Must be 0–100%',
  positiveNumber:  v => v > 0               ? null : 'Must be > 0',
  nonNegative:     v => v >= 0              ? null : 'Must be ≥ 0',
  flowRate:        v => v >= 0 && v < 1e6   ? null : 'Must be 0–1,000,000 mol/s',
  power:           v => v >= 0 && v < 1e12  ? null : 'Must be ≥ 0 W',
  efficiency:      v => v > 0 && v <= 1     ? null : 'Must be 0–1',
  splitRatio:      v => v >= 0 && v <= 1    ? null : 'Must be 0–1',
};
```

**Inspector integration:** Param renderer attaches `input` listener:
```javascript
input.addEventListener('input', () => {
  const v = parseFloat(input.value);
  const err = param.validate ? param.validate(v) : null;
  errDiv.textContent = err || '';
  errDiv.style.display = err ? '' : 'none';
  if (!err) param.set(v);
});
```

```css
.ins-err-inline { color: #fca5a5; font-size: 10px; margin-top: 2px; }
```

---

### 4.17 Theme CSS Variables (M5a)

Core variable contract (every theme must define all):
```css
:root {
  /* Canvas */
  --canvas-bg: #0b0e14;
  --grid-line: #1e293b;
  --grid-line-opacity: 0.4;

  /* Surfaces */
  --bg-primary: #0b0e14;
  --bg-secondary: #111827;
  --bg-tertiary: #1e293b;
  --bg-card: #111827;

  /* Text */
  --text-primary: #e2e8f0;
  --text-secondary: #94a3b8;
  --text-muted: #64748b;

  /* Borders */
  --border-primary: #2a2f3a;
  --border-secondary: #475569;

  /* Accents */
  --accent-blue: #2563eb;
  --accent-blue-light: #60a5fa;
  --accent-green: #22c55e;
  --accent-red: #ef4444;
  --accent-yellow: #f59e0b;
  --accent-purple: #a855f7;
  --accent-cyan: #06b6d4;

  /* Streams */
  --stream-material: #94a3b8;
  --stream-heat: #fbbf24;
  --stream-mechanical: #a855f7;
  --stream-electrical: #22c55e;

  /* Unit selection */
  --unit-selected: #60a5fa;

  /* Semantic */
  --tone-good: #6ee7b7;
  --tone-warn: #fbbf24;
  --tone-bad: #fca5a5;
  --tone-info: #60a5fa;
}
```

SVG icons: replace `fill="#fff"` with `fill="currentColor"`. Set `color: var(--text-primary)` on icon container.

---

### 4.18 Show/Hide Utilities (E7)

```javascript
ui.showUtilities = true; // default

// In drawUnits():
if (!ui.showUtilities) {
  const cat = UnitRegistry.get(u.defId).category;
  if (cat === 'ELECTRICAL' || cat === 'UTILITY') continue;  // skip drawing
}

// In drawConnections():
if (!ui.showUtilities) {
  const fromPort = fromDef.ports.find(p => p.portId === c.from.portId);
  if (fromPort.type !== StreamType.MATERIAL) continue;  // skip non-material
}
```

Toolbar button: `⚡` toggle. Active state: bright. Inactive: dimmed. Keyboard: no shortcut.

---

### 4.19 Canvas Stickers (P1)

**Data model:**
```javascript
// On scene:
scene.stickers = new Map(); // id → Sticker

// Sticker:
{
  id: 'stk_001',
  sourceType: 'unit',        // 'unit' | 'stream'
  sourceId: 'u_abc',         // unit id or connection id
  key: 'T_out',              // property key in ud.last or stream
  x: 450, y: 200,            // world coordinates
  format: 'T',               // fmt helper key (T, P, kW, flow, pct)
  showLink: true             // draw dashed line to source
}
```

**Serialization:** `exportJSON` adds `stickers: [...]` array. `importJSON` restores. Old saves without stickers: `scene.stickers = new Map()` (NNG-UI7d).

**Rendering:** `drawStickers()` called in `render()` after `drawUnits()`:
```javascript
function drawStickers() {
  if (!scene.stickers.size) return;
  const g = svgEl('g', { id: 'stickers' });
  for (const [id, s] of scene.stickers) {
    const value = resolveSticker(s); // reads from runtime data
    // Background rect + text
    // If showLink: dashed line to source unit/stream center
  }
  svg.appendChild(g);
}
```

---

### 4.20 Visual Groups (P2)

**Data model:**
```javascript
scene.groups = new Map(); // id → Group

{
  id: 'grp_001',
  name: 'Feed Section',
  color: '#2563eb33',        // semi-transparent fill
  unitIds: new Set(['u_1', 'u_2', 'u_3']),
  type: 'visual',            // future: 'subassembly'
  parentGroupId: null,        // future: nesting support
  collapsed: false            // future: collapse to icon
}
```

**Bounding box:** Auto-computed from member units + 1 grid cell padding.

**Multi-select state:**
```javascript
ui.selectedUnitIds = new Set();  // replaces ui.selectedUnitId
// Compatibility: ui.selectedUnitId getter reads first element of set
```

---

## 5. Deferred Items

| Item | Reason |
|---|---|
| Full WCAG accessibility | Separate initiative — large scope |
| Responsive breakpoints / mobile | Different interaction paradigm |
| Touch/pinch-to-zoom | Mobile-specific |
| Cloud storage / URL sharing | Infrastructure dependency |
| Minimap | Not requested |
| Palette search tags + descriptions + tile icons | Low urgency |
| Animation intensity scaling | Requires unit capacity model (not yet built) |
| Nested groups / subassemblies | Foundation laid in P2, implementation deferred |
| 2D T-P heatmap for reactor | Stretch of 4.12, deferred to post-v10 |
| Stream value labels (always-on) | Subsumed by P1 stickers — user-placed |

---

## 6. Phase Tracker

Status: `[ ]` planned · `[~]` in progress · `[✓]` complete · `[x]` deferred

```
═══════════════════════════════════════════════════════════════════
 Step 0.1 — BUGS + ANNOYING                            → v10.0.2
═══════════════════════════════════════════════════════════════════
 [ ] B1    Stream click crash (StreamType._name)
 [ ] B2    Balance display scope fix
 [ ] B3    Checkbox styling + alignment
 [ ] A1    Shortcut help text update
 [ ] A2    Ctrl+Enter for Test
 [ ] A3    source_air icon mapping
 [ ] A4    Font size / readability pass
 [ ] A5    Zoom limits
 [ ] A6    Dead code removal
 [ ] A7    Connection refusal feedback
 [ ] A+    btnAdd inline style → CSS class
 [ ] T+    Add tests T190–T193 (UI data contracts)

═══════════════════════════════════════════════════════════════════
 Step 2.1 — CANVAS INTERACTION                          → v10.1.0
═══════════════════════════════════════════════════════════════════
 [ ] E1    Zoom to fit + reset view
 [ ] E2    Hover highlight on units/streams
 [ ] E3    Flow direction arrows (SVG markers)
 [ ] E5    Delete buttons in inspector

═══════════════════════════════════════════════════════════════════
 Step 2.2 — CONNECTION UX                               → v10.1.1
═══════════════════════════════════════════════════════════════════
 [ ] E4    Port connection feedback (green/dim)
 [ ] E6    Port connection status display
 [ ] E7    Show/hide utilities toggle

═══════════════════════════════════════════════════════════════════
 Step 2.3 — CANVAS POLISH                               → v10.1.2
═══════════════════════════════════════════════════════════════════
 [ ] E8    Unit overlap prevention (UI only)
 [ ] E9    Balance report restructure + modal
 [ ] E+    renderStreamProperties migration to ins-*
 [ ] T+    Add test T194 (stream flowrate contract)

═══════════════════════════════════════════════════════════════════
 Step 2.4 — CONNECTION ROUTING                          → v10.1.3
═══════════════════════════════════════════════════════════════════
 [ ] E10a  Orthogonal channel router + settings
 [ ] E10b  Anchor points on connections
 [ ] E10c  Stream crossing bridge arcs

═══════════════════════════════════════════════════════════════════
 Step 3.1 — ANIMATIONS                                  → v10.2.0
═══════════════════════════════════════════════════════════════════
 [ ] AN-5   Settings toggle + failure sub-toggle
 [ ] AN-1   Stream flow animation (CSS dash)
 [ ] AN-2   Unit activity indicators
 [ ] AN-3   Single-run solve pulse
 [ ] AN-4a  Failure shake + glow
 [ ] AN-4b  Failure particle burst

═══════════════════════════════════════════════════════════════════
 Step 3.2 — UNDO / REDO                                 → v10.2.1
═══════════════════════════════════════════════════════════════════
 [ ] M1a    Undo architecture + snapshots
 [ ] M1b    Undo testing + edge cases
 [ ] T+     Add test T198 (UndoStack contract)

═══════════════════════════════════════════════════════════════════
 Step 3.3 — LAYOUT + TOAST                              → v10.3.0
═══════════════════════════════════════════════════════════════════
 [ ] M2     Resizable side panel
 [ ] M3a    Top bar redesign (3-zone layout)
 [ ] M3b    Toast notification system

═══════════════════════════════════════════════════════════════════
 Step 3.4 — VALIDATION                                  → v10.3.1
═══════════════════════════════════════════════════════════════════
 [ ] M4a    Validation architecture + rules
 [ ] M4b    Apply to all 27 inspectors
 [ ] T+     Add test T197 (ValidationRules contract)

═══════════════════════════════════════════════════════════════════
 Step 3.5 — THEMING                                     → v10.4.0
═══════════════════════════════════════════════════════════════════
 [ ] M5a    CSS variable extraction (~30 vars)
 [ ] M5b    Theme presets (dark / light / engineering)
 [ ] M6     Menu styling consistency

═══════════════════════════════════════════════════════════════════
 Step 3.6 — VISUALIZATION + PERSISTENCE                 → v10.5.0
═══════════════════════════════════════════════════════════════════
 [ ] M7a    Composition bar charts
 [ ] M7b    Reactor T,P equilibrium explorer
 [ ] M8     Auto-save + beforeunload

═══════════════════════════════════════════════════════════════════
 Step 4.1 — CANVAS STICKERS                             → v10.6.0
═══════════════════════════════════════════════════════════════════
 [ ] P1a    Data model + rendering
 [ ] P1b    Drag-from-inspector interaction
 [ ] P1c    Sticker management
 [ ] T+     Add test T195 (sticker round-trip)

═══════════════════════════════════════════════════════════════════
 Step 4.2 — GROUPING                                    → v10.7.0
═══════════════════════════════════════════════════════════════════
 [ ] P2a    Multi-select (shift / rubber-band)
 [ ] P2b    Visual groups (flat, nesting-ready)
 [ ] P2c    Group interaction polish
 [ ] T+     Add test T196 (group round-trip)

═══════════════════════════════════════════════════════════════════
 Step 4.3 — SYMBOL FAMILIES                             → v10.8.0
═══════════════════════════════════════════════════════════════════
 [ ] P3a    Symbol family architecture
 [ ] P3b    ISO P&ID symbol set
 [ ] P3c    Simplified symbol set

═══════════════════════════════════════════════════════════════════
 Step 4.4 — PORT LAYOUTS                                → v10.9.0
═══════════════════════════════════════════════════════════════════
 [ ] P4a    Port positioning architecture
 [ ] P4b    Layout variants for key units

═══════════════════════════════════════════════════════════════════
 Step 4.5 — CONVERGENCE GRAPH                          → v10.10.0
═══════════════════════════════════════════════════════════════════
 [ ] P5     Solver convergence sparkline
```
