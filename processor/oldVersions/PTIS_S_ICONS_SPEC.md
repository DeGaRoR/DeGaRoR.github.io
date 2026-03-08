# PTIS S-ICONS — Themed Icon & Pipe System Implementation Spec

Version: 1.0 · Session: 2026-03-05

## Scope

Add two visual themes (ragtag, engineering) for unit icons, connection rendering, and port visuals. The existing boxman theme remains the default and is untouched. Theme selection via `ui.theme` setting ('boxman' | 'engineering' | 'ragtag').

---

## 1. Data Structures

### 1.1 Theme palette in constants block

```javascript
const THEME_PALETTES = {
  boxman:      { /* current def.color values — no change */ },
  ragtag:      { BOUNDARY:'#10b981', PRESSURE:'#8b5cf6', HEAT_TRANSFER:'#3b82f6',
                 SEPARATION:'#14b8a6', REACTOR:'#ef4444', STORAGE:'#06b6d4', POWER:'#eab308' },
  engineering: { /* same palette, applied as strokes at low opacity */ }
};
```

### 1.2 `symbolId` field in presentation entries

Each presentation entry gains a `symbolId` string identifying which SVG symbol to render. Variants sharing identical geometry share the same `symbolId`; only port positions and optional `stubs` differ.

51 distinct symbolIds per theme (see ptis_variant_classification.md).

### 1.3 `ui.theme` in LAYOUT_DEFAULTS

```javascript
theme: 'boxman',  // 'boxman' | 'engineering' | 'ragtag'
```

Persisted via layout save/restore. Added to the S-HUD view mode toggles.

---

## 2. Parametric Color System

### 2.1 Dynamic gradient generation

`_visUnitColor(u, def, islands)` already returns a single hex color for any `colorBy` mode. For themed rendering, this color feeds a gradient generator:

```javascript
function _makeUnitGradient(defsEl, unitId, baseColor) {
  // Creates <linearGradient> with 3 stops: darken(15%) → base → darken(10%)
  // Returns { fillUrl, stroke, rim }
}
```

Called per-unit inside `drawUnits()`. Gradient id = `ug-${unitId}`. Stroke = `darken(baseColor, 0.35)`. Viewport rim = `darken(baseColor, 0.45)`.

### 2.2 What recolors vs what stays fixed

**Recolors with `--unit-color`:** painted body, motor housing, category-tinted strokes.

**Always fixed:** bare metal pipes/flanges (#374151→#6b7280), bolts (#1f2937 fill, #6b7280 stroke), amber terminals (#eab308), viewport glass (#0f0820), cooling coil (#93c5fd), resistance zigzag (#fca5a5), glass highlights (white, low opacity), LED colors (data-driven).

### 2.3 Color snap

When `colorBy` changes, gradients regenerate on next `render()`. No animation, instant snap.

---

## 3. Unit Rendering

### 3.1 Branch in `drawUnits()`

After computing `unitFill` from `_visUnitColor()`:

```javascript
if (ui.theme === 'boxman') {
  // existing rect + icon rendering (unchanged)
} else {
  _drawThemedUnit(group, u, def, pres, unitFill, ui.theme);
}
```

### 3.2 `_drawThemedUnit()`

1. Generate dynamic gradient from `unitFill`
2. Look up `symbolId` from `pres`
3. Render the symbol inline (not `<use>` — gradient ids are per-unit, can't share)
4. Each symbol is a function: `_symbolPump(g, palette)`, `_symbolReactorAdiabatic(g, palette)`, etc.
5. `palette` = `{ fill, stroke, rim, light }` computed from the dynamic gradient
6. Alarm glow class applied to the main body element (`.unit-body`)

### 3.3 Symbol functions

Each returns SVG elements for one unit. Ragtag symbols include: painted body, paint chips, bolts, viewport with internals, seam lines, LED placeholder, nozzle stubs. Engineering symbols: tinted fill at low opacity, category-colored strokes, no wear details.

Start with 5 vertical-slice units: `pump`, `reactor_adiabatic`, `flash_drum`, `valve`, `grid_supply`. Remaining 23 in follow-up sessions.

---

## 4. Animation Engine

### 4.1 `animT` computation

```javascript
// In render loop:
const animT = TimeClock.t / SimSettings.dt;
```

This gives a smooth fractional frame counter. All animation rates expressed in "per animT unit" (= per simulation frame).

### 4.2 rAF loop during play

Add a lightweight `requestAnimationFrame` loop that runs ONLY when `TimeClock.mode === 'playing'` AND `SimSettings.animations` is true AND `ui.theme !== 'boxman'`. It calls a `_renderIconAnimations(animT)` function that updates only the animated SVG attributes (rotation angles, bubble positions, glow opacity) — NOT a full `render()`.

```javascript
let _iconAnimRafId = null;
function _iconAnimLoop() {
  if (TimeClock.mode !== 'playing' || !SimSettings.animations || ui.theme === 'boxman') {
    _iconAnimRafId = null; return;
  }
  const vt = TimeClock.t + _interpolateFraction() * SimSettings.dt;
  _renderIconAnimations(vt / SimSettings.dt);
  _iconAnimRafId = requestAnimationFrame(_iconAnimLoop);
}
```

Started by `startPlay()`, cancelled by `stopPlay()`.

### 4.3 Animation rates (per animT unit)

| Animation | Rate | Speed 0 (~5s/step) | Speed 2 (~1.5s/step) |
|-----------|------|---------------------|----------------------|
| Pump impeller rotation | 2.5 rev | ~0.5 rev/s | ~1.67 rev/s |
| Fan blades | 4.0 rev | ~0.8 rev/s | ~2.67 rev/s |
| Bubble cycle | 0.5–0.7 period | 2.5–3.5s | ~1s |
| Glow pulse (zigzag) | 0.8 period | ~4s | ~1.2s |
| Flow shimmer | 1.0 period | ~5s | ~1.5s |
| LED blink | 1.5 period | ~3.3s blink | ~1s blink |

### 4.4 Existing animation coexistence

No changes to existing systems. Flow arrows stay CSS `offset-path` with wall-clock timing. Smoke stays wall-clock CSS. Planet bg stays `syncPlanetBgTime()`. Icon animations are a new, fourth system using `animT` + rAF. They don't interact with the other three.

---

## 5. Connection Rendering (Pipes)

### 5.1 Current state: cubic Bézier

Connections are single `M...C...` curves. No orthogonal routing exists. The path is computed from port edge directions + control offset.

### 5.2 Ragtag pipe rendering

For `ui.theme === 'ragtag'`, the existing Bézier path is KEPT for hit-testing and arrow animation, but rendered differently:

**Phase 1 (minimum viable):** Render the same Bézier path as a thick stroke (14px) with the bare-metal pipe gradient, plus a thinner dark interior stroke (8px). Flow arrows ride the path as today. Flanges drawn at each port end. Curved sections follow the Bézier naturally. This requires zero routing changes.

**Phase 2 (future, optional):** Orthogonal router producing H/V segments + 90° elbows with bolted flanges at joints. Long segments auto-subdivide with mid-flanges. This is a significant routing rewrite and should be a separate spec.

### 5.3 Flange rendering at ports

For ragtag, each port gets a bolted flange instead of a circle:
- Flange band: rect perpendicular to pipe axis, slightly wider than pipe (overhang 3px each side)
- 3 circle bolts on the flange face (same bolt style as units: fill #1f2937, stroke #6b7280)
- Positioned at the port coordinates, oriented to port edge direction

### 5.4 Electrical cables (ragtag)

Rendered as wavy dual-stroke: 8px dark outer (#78350f), 4px amber inner (#eab308). Path modified with small sinusoidal perturbation along the Bézier. No flanges, no bolts.

### 5.5 Engineering/boxman connections

Unchanged. Engineering could add subtle dashing for electrical in future.

### 5.6 Color mapping

Pipe metal stays constant across all `colorBy` modes. Flow arrows inside pipes follow `_visStreamColor()` as today. Phase 2 liquid fill would also follow `_visStreamColor()`.

---

## 6. Port Rendering

### 6.1 Current ports

Circle, r=10, filled (OUT) or hollow (IN), silver or amber.

### 6.2 Ragtag ports

Replace with bolted flange face (see §5.3). Hit target remains r=10 circle (invisible, on top for clicks). Visual is the flange band + 3 bolts. Direction indicated by a small arrow inside (matching port direction).

### 6.3 Engineering ports

Circles with small directional arrow hints inside. Same colors, same hit targets.

---

## 7. Implementation Order

### Phase 1: Theme infrastructure + 5-unit vertical slice
1. Add `ui.theme` to LAYOUT_DEFAULTS, save/restore, S-HUD toggle
2. Add `_makeUnitGradient()` + `darken()`/`lighten()` helpers
3. Add branch in `drawUnits()` for themed rendering
4. Implement 5 ragtag symbol functions (pump, reactor_adiabatic, flash_drum, valve, grid_supply)
5. Implement 5 engineering symbol functions (same 5 units)
6. Add `_iconAnimLoop` rAF system for ragtag animations
7. Add ragtag pipe rendering (thick-stroke Bézier approach)
8. Add ragtag port flanges
9. Tests: verify all 521 existing tests still pass, add theme-toggle smoke test

### Phase 2: Complete unit set
10. Remaining 23 ragtag symbol functions
11. Remaining 23 engineering symbol functions
12. Variant classification: symbolId mapping in presentation entries

### Phase 3: Polish
13. Alarm glow on `.unit-body`
14. Fried state visuals (scorch marks ragtag, X overlay engineering)
15. Electrical cable wavy rendering
16. LED data-driven color (green/amber/red based on alarm severity)

### Phase 4 (future): Orthogonal pipe routing
17. H/V segment router
18. Elbow elements with bolted flanges
19. Long segment auto-subdivision
20. Cutout sight windows + liquid fill visualization

---

## 8. Files Changed

| File | Changes |
|------|---------|
| processThis.html §1 (constants) | `THEME_PALETTES`, `ui.theme` in LAYOUT_DEFAULTS |
| processThis.html §drawUnits | Theme branch, `_drawThemedUnit()`, symbol functions |
| processThis.html §drawConnections | Ragtag pipe rendering branch, flange drawing |
| processThis.html §port rendering | Ragtag flange ports, engineering arrow ports |
| processThis.html §play loop | `_iconAnimLoop` rAF start/stop |
| processThis.html §S-HUD | Theme toggle button |

---

## 10. Resolved Open Questions

1. **Theme toggle UI:** Next to show/hide world in the action bar + menu entry.
2. **Inline symbols vs `<use>`:** Inline for robustness. Document any NNG infraction.
3. **rAF loop scope:** Icon animations only. Future unification section below.
4. **Tier progression:** Procedural approach — no per-tier icon redesigns. Options: copper/silver/gold outline or boilerplate accents. Reuse annotated tier triangle as starting point. Color-shift or overlay effect on the existing icon, not a new symbol set.
5. **Port flange orientation:** All ports go straight H or V — no diagonal angles. Clean mapping from `getPortEdge()`.
6. **Performance:** Test early with 50+ unit stress scene. Budget ~200 DOM nodes per themed unit (symbol + gradient + bolts). Target: smooth on mid-range laptop.

---

## 11. Animation Unification (future, high-level)

Currently four independent animation systems exist:

| System | Clock | Mechanism | Syncs to sim? |
|--------|-------|-----------|---------------|
| Flow arrows | `Date.now() - _playStartedAt` | CSS `offset-path` + `animationDelay` | No (wall-clock, speed table) |
| Smoke puffs | `Date.now() - _playStartedAt` | CSS keyframes + budget cap | No (wall-clock, speed scale) |
| Planet bg | `TimeClock.t` | CSS vars `--px-cycle/offset` + force-restart | Yes |
| Icon anims (new) | `animT = vt/dt` | JS rAF + direct SVG attribute updates | Yes |

**Unification target:** Migrate flow arrows and smoke to `animT`-based JS computation during the rAF loop. This eliminates the wall-clock / sim-time split and makes all visual motion scale consistently with play speed.

**Work required:**
- Flow arrows: Replace CSS `offset-path` animation with JS-computed position along the Bézier path, using `animT` for phase. ~50 lines. The arrow `<g>` elements stay, their `transform` gets updated per frame instead of CSS driving it.
- Smoke puffs: Replace CSS `@keyframes smoke-rise` with JS-computed `cy` + `opacity` from `animT`. Smoke budget cap stays. ~30 lines.
- Planet bg: Already sim-time driven. Could move from CSS-var force-restart to direct JS updates for consistency, but low priority — it works.
- Remove `_playStartedAt`, `FLOW_ARROW_SPEEDS`, `SMOKE_SPEED_SCALE` — replaced by `animT` rates.

**Risk:** Low — all display-layer, no solver changes. But touch-points are spread across render(), startPlay(), stopPlay(), and CSS. Should be its own focused session.

**Recommendation:** Do after S-ICONS Phase 1 is stable. The four systems coexist fine for now.

---

## 12. NNG Compliance

- **NNG-3 (WYSIWYG):** Themed icons render at same tile positions. Port coordinates unchanged. Click targets unchanged.
- **NNG-5 (solver untouched):** Pure display-layer changes. Zero solver modifications.
- **NNG-9 (tick isolation):** Animations read `TimeClock.t` only, never write to it.
- **NNG-11 (render idempotent):** `render()` produces same output for same state. rAF loop only updates animation attributes, doesn't modify scene state.
