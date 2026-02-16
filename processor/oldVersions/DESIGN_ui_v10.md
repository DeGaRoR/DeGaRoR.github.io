# processThis UI Revamp — Design v10

## 1. Diagnosis

### What the specs get right

The two specs correctly identify the **structural** problem: the UI has no
schema, no component boundaries, no information architecture.  The inspector
is a 1,766-line function (`updatePropertiesPanel`) that switches on `defId`
48 times.  Adding a new unit requires touching that monolith.  The unit
palette replaces the inspector, punishing iterative building.  226 inline
style strings resist theming.  There is no progressive disclosure, no
consistent section ordering, no diagnostics zone.

These are all real.

### Where the specs over-specify

The specs introduce abstractions that exceed what a single-file vanilla-JS
application can sustain without a framework:

- **`InspectorModel` as a runtime data structure** — building a typed model
  object every frame only to immediately render it adds ceremony.  In a
  React/Svelte app this is natural; here it's overhead.
- **`UnitInspectorRegistry.register()` with five function callbacks** —
  adds a second parallel registry to `UnitRegistry`.  The metadata should
  live *in* the unit registration, not beside it.
- **`ControlModel` type unions** — TypeScript idiom.  In vanilla JS the
  existing `addNumberEditor` / `addSelectEditor` pattern is equivalent.
- **Ghost preview with dedicated SVG overlay group** — nice but a Phase 3
  polish item, not structural.
- **`uiPrefs.numbers` with basic/detailed toggle** — useful later, but the
  fundamental problem is that there's no structure to hang it on.

### The actual root causes (ordered by leverage)

| # | Root cause | Impact | Fix |
|---|-----------|--------|-----|
| 1 | No **unit UI descriptor** — display metadata is hardcoded in one giant function | Adding units requires editing a monolith; inconsistent inspector layout | `inspectorUI` property on UnitRegistry definitions |
| 2 | Unit palette **replaces** inspector | Can't add multiple units without repeated clicks | Separate left-side palette drawer |
| 3 | No **section schema** — each unit builds its own DOM tree | Inconsistent ordering, missing sections, no progressive disclosure | Standard section renderer with fixed zone order |
| 4 | **Inline styles** prevent theming and increase cognitive load | 226 style strings scattered across el() calls | CSS class vocabulary for data display |
| 5 | No **interaction state machine** — mode is implicit in scattered flags | Connecting, dragging, selecting blur together | Explicit `UIMode` with enter/exit/render |

This design addresses #1–#4 directly.  #5 is noted but deferred (it's a
phase 2 concern — the inspector rewrite is the highest-leverage change).

---

## 2. Design Principles

**P1 — Colocate unit UI metadata with unit registration.**
Not a second registry.  The `UnitRegistry.register()` call already has
`name`, `category`, `ports`, `tick`.  We add an `inspectorUI` descriptor
alongside them.  One place to look, one place to edit.

**P2 — Schema describes *what*, renderer decides *how*.**
A unit's `inspectorUI` is a declarative list of parameters and display
sections.  A single generic renderer turns that list into DOM.  Units that
need truly custom display (e.g., composition editor for `source_multi`) can
provide a `customSection` callback — but 80% of units use pure declaration.

**P3 — Fixed zones, stable order.**
The inspector always renders: **Header → Status → Parameters → Properties →
Ports → Diagnostics**.  A unit can omit sections (empty = hidden) but never
reorder them.

**P4 — Additive migration, not rewrite.**
Each phase delivers a working build.  The old `updatePropertiesPanel` shrinks
incrementally as units migrate to the schema.  At no point is the app broken.

**P5 — CSS classes for data display; inline styles only for computed geometry.**
We define a vocabulary of ~20 utility classes for the inspector (`kv-row`,
`kv-label`, `kv-value`, `section-box`, `badge-good`, `badge-warn`, etc.)
and migrate el() calls to use them.

---

## 3. Architecture

### 3.1  Unit Inspector Descriptor (on UnitRegistry)

```javascript
UnitRegistry.register('compressor', {
  name: 'Compressor',
  category: UnitCategories.GAS,
  w: 2, h: 2,
  ports: [ ... ],
  tick(u, ports, par, ctx) { ... },

  // NEW — UI descriptor (optional; fallback for unregistered units)
  inspectorUI: {
    summary: (u, ud) => [
      { label: 'P ratio', value: ud.last?.pressureRatio?.toFixed(2) ?? '—' },
      { label: 'Power', value: `${((ud.last?.W_shaft_W ?? 0)/1000).toFixed(1)} kW` },
    ],

    params: [
      { key: 'Pout', label: 'P outlet', unit: 'Pa', display: 'pressure',
        get: (u) => u.params.Pout,
        set: (u, v) => u.params.Pout = v,
        step: 10000 },
      { key: 'eta', label: 'Efficiency', unit: '-',
        get: (u) => u.params.eta,
        set: (u, v) => u.params.eta = v,
        min: 0.5, max: 1.0, step: 0.01 },
    ],

    properties: (u, ud) => [
      { label: 'Shaft work', value: fmt.kW(ud.last?.W_shaft_W), tone: 'normal' },
      { label: 'Heat loss', value: fmt.kW(ud.last?.Q_loss_W), tone: 'muted' },
      { label: 'T out', value: fmt.T(ud.last?.T_out), tone: 'normal' },
    ],

    // Optional: fully custom section for complex UIs
    // customSection: (container, u, ud, scene) => { ... }
  }
});
```

**Key points:**
- `summary` produces at-a-glance chips (always visible).
- `params` is a declarative array → the renderer creates editors automatically.
  The `display` field optionally refers to unit conversion keys.
- `properties` produces read-only key-value rows from solved state.
- `customSection` is the escape hatch for `source_multi`'s composition
  editor, `reactor_equilibrium`'s reaction selector, etc.
- Units without `inspectorUI` get a fallback: auto-discovered params + port list.

### 3.2  Inspector Renderer

```
function renderInspector(unitId | connId | null)
  ├── renderHeader(u, def)          // name input, category badge, defId
  ├── renderStatus(u, ud)           // error/warning chips, convergence
  ├── renderSummary(def.inspectorUI.summary(u, ud))   // at-a-glance cards
  ├── renderParams(def.inspectorUI.params, u)          // editable controls
  ├── renderProperties(def.inspectorUI.properties(u, ud))  // solved values
  ├── def.inspectorUI.customSection?.(container, u, ud, scene)  // escape hatch
  ├── renderPorts(u, ud, def)       // port list with stream preview
  └── renderDiagnostics(ud)         // errors, warnings, suggestions
```

Each `render*` function is independent, ~30–60 lines, uses CSS classes.
The old `updatePropertiesPanel` becomes a thin dispatcher that calls
`renderInspector`.

### 3.3  Palette Drawer

```
┌─────────────────────────────────────────────────────────┬─────────────┐
│                                                         │  Inspector  │
│  ┌──────────┐                                           │  (right)    │
│  │ Palette   │           Canvas (SVG)                   │             │
│  │ (left)    │                                          │  Header     │
│  │           │                                          │  Status     │
│  │ [Search]  │                                          │  Summary    │
│  │ [Cats]    │                                          │  Params     │
│  │ [Tiles]   │                                          │  Properties │
│  │           │                                          │  Ports      │
│  │           │                                          │  Diag       │
│  └──────────┘                                           │             │
└─────────────────────────────────────────────────────────┴─────────────┘
```

- Left overlay drawer, 260px wide, slides over canvas.
- Toggle via toolbar button ("+ Add") or `/` hotkey.
- **Never replaces** the inspector.  Both can be visible simultaneously.
- Search input at top, auto-focused on open.
- Category chip row for filtering.
- 2-column tile grid with icon, name, one-line description.
- Drag-to-canvas AND double-click-to-place (center of viewport).
- **Stays open** after placing a unit.  Closes on Esc or toggle.

### 3.4  CSS Class Vocabulary

Instead of 226 inline style strings, define ~25 semantic classes:

```css
/* Inspector zones */
.ins-header { ... }
.ins-status { ... }
.ins-section { ... }
.ins-section-title { ... }

/* Data display */
.kv-row { display: flex; justify-content: space-between; padding: 3px 0; }
.kv-label { opacity: 0.7; font-size: 11px; }
.kv-value { font-family: ui-monospace, ...; font-weight: 600; }
.kv-unit { opacity: 0.5; font-size: 10px; margin-left: 2px; }

/* Tones */
.tone-muted { opacity: 0.5; }
.tone-good { color: #6ee7b7; }
.tone-warn { color: #fbbf24; }
.tone-bad { color: #fca5a5; }

/* Badges */
.badge { padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: 600; }
.badge-good { background: #064e3b; color: #6ee7b7; }
.badge-warn { background: #78350f; color: #fbbf24; }
.badge-bad { background: #7f1d1d; color: #fca5a5; }

/* Palette */
.palette-drawer { ... }
.palette-search { ... }
.palette-chips { ... }
.palette-grid { ... }
.palette-tile { ... }
```

Migration: replace `el('div', { style: 'display:flex; ...' })` calls with
`el('div', { class: 'kv-row' })`.  Inline styles remain ONLY for computed
values (bar widths, dynamic colors from data).

---

## 4. What We're NOT Doing

| Spec suggestion | Decision | Reason |
|----------------|----------|--------|
| Full `InspectorModel` runtime object | Skip | Overhead without a framework; descriptor-on-registry achieves the same |
| Separate `UnitInspectorRegistry` | Merge into `UnitRegistry` | One source of truth, not two |
| `ControlModel` type unions | Use existing `addNumberEditor` pattern | Already works, just needs declarative wrapper |
| Ghost preview SVG overlay | Defer to Phase 3 | Polish, not structural |
| `UIMode` state machine | Defer to Phase 4 | Important but independent of inspector |
| Progressive disclosure toggle | Defer to Phase 3 | Needs inspector schema first |
| Touch-ready sizing | Defer | Desktop-first, but CSS classes make it easy later |
| Event delegation rewrite | Defer | Current 79 listeners is manageable |
| localStorage for recently-used | Phase 2 | Simple, but palette must exist first |

---

## 5. Implementation Phases

### Version Strategy

**v10.0.x** — UI Revamp (inspector + palette)
**v10.1.0** — Milestone (all units migrated, palette complete)

This is a major-version bump (v9 → v10) because:
- The inspector is the primary user-facing surface
- The layout changes (two-panel → three-zone)
- Every unit definition gains new metadata
- CSS vocabulary replaces inline styles

### Phase 0 — CSS Vocabulary + Inspector Renderer Skeleton (v10.0.1)

**Goal:** Infrastructure that all later phases build on.

1. Add ~25 CSS classes (section 3.4) to `<style>` block.
2. Add `fmt` helper namespace: `fmt.kW()`, `fmt.T()`, `fmt.P()`, `fmt.flow()`,
   `fmt.pct()`, `fmt.time()` — thin wrappers around unit conversion + formatting.
3. Write generic renderer functions:
   - `renderKV(container, label, value, opts)` — one key-value row
   - `renderBadge(container, text, tone)` — status chip
   - `renderSection(container, title, contentFn, opts)` — collapsible section
   - `renderParamEditor(container, paramDef, unit)` — auto-creates the right
     editor type from a param descriptor
   - `renderDiagnostics(container, ud)` — errors/warnings with tone badges
4. Write `renderInspector(unitId)` skeleton that calls the above in fixed
   zone order.  Initially it only handles the Header zone; the rest still
   falls through to legacy `updatePropertiesPanel` code.
5. Add `inspectorUI` to 2–3 simple units as proof of concept (e.g., `source`,
   `sink`, `grid_supply`).

**~250 lines added, ~0 lines removed.  No regression risk.**
Tests: visual inspection + existing 189 pass.

### Phase 1 — Unit Migration (v10.0.2)

**Goal:** All 34 unit types have `inspectorUI` descriptors.

Migrate in batches by complexity:

**Batch A — Trivial (no custom UI):** ~15 units
`sink`, `sink_heat`, `sink_electrical`, `source`, `source_electrical`,
`source_mechanical`, `grid_supply`, `mixer`, `splitter`, `valve`,
`compressor`, `pump`, `cooler`, `heater`, `gas_turbine`

Each unit gets a `params` array + `properties` function.  The generic
renderer handles everything.  ~5 lines of `inspectorUI` per unit.

**Batch B — Medium (small custom sections):** ~10 units
`motor`, `generator`, `electric_heater`, `power_hub`, `flash_drum`,
`heat_exchanger`, `separator`, `tank`, `battery`

These need `summary` functions and/or status displays (SOC bar, fill bar,
hub dispatch summary).  Some need `customSection` callbacks.

**Batch C — Complex (full custom sections):** ~5 units
`source_multi` (composition editor), `source_air` (atmosphere link),
`reactor_equilibrium` (reaction selector + kinetics toggle + diagnostics),
`absorber`, `distillation`

These keep `customSection` callbacks but still get standard Header/Status/
Diagnostics zones from the schema renderer.

**After Batch C:** The old 1,766-line `updatePropertiesPanel` is reduced
to ~100 lines (just the stream-selected and balance-selected branches,
plus the dispatcher).

**~400 lines of inspectorUI added across unit registrations.**
**~1,400 lines removed from updatePropertiesPanel.**
Net: ~1,000 lines smaller.

Tests: 189 existing + new T190 (inspector schema renders for source unit).

### Phase 2 — Palette Drawer (v10.0.3)

**Goal:** Left-side drawer with search, categories, persistent open state.

1. Add HTML structure: `<aside class="paletteDrawer" id="paletteDrawer">`.
2. Layout: change `.app` grid from `1fr 360px` to `auto 1fr 360px`
   (palette column is 0px when closed, 260px when open).
3. Drawer content:
   - Search input with auto-focus
   - Category chip row (from `UnitCategories`)
   - 2-column tile grid (icon placeholder, name, summary)
4. Filtering: case-insensitive match on `name`, `defId`, `category`,
   and a new optional `tags` array on unit definitions.
5. Add button: toolbar gets "+ Add" button, toggles drawer.
6. Keyboard: `/` opens drawer + focuses search; `Esc` closes.
7. Drag-to-canvas: reuse existing HTML5 drag logic from `showUnitLibrary`.
8. Double-click-to-place: place at viewport center, snap to grid.
9. **Critical:** adding a unit never closes the drawer, never clears search.
10. Remove old `showUnitLibrary` function and "Add Unit" panel-replacement.

**~200 lines added (HTML + CSS + JS), ~80 lines removed.**
Tests: T191 (palette open/close state), T192 (search filtering).

### Phase 3 — Polish + Interactions (v10.0.4)

**Goal:** Drag ghost, progressive disclosure, keyboard shortcuts.

1. Ghost preview: lightweight `<g>` in SVG overlay, follows pointer during
   drag, 50% opacity, snaps to grid.  `pointer-events: none`.
2. Progressive disclosure: `uiPrefs.inspectorDetail` toggle (compact/full).
   Compact hides `properties` section and shows only `summary` chips.
3. Keyboard parity: `Del` delete, `R` rotate, `Esc` cancel/close,
   `Ctrl+Z` undo-ready action structure (dispatch pattern, no undo yet).
4. Stream inspector migration: `renderStreamProperties` → schema-driven.
5. Balance report → schema-driven (already has structure, just needs CSS
   class migration).

**~150 lines, net neutral (replaces inline styles).**

### Phase 4 — Milestone (v10.1.0)

- All units on schema renderer
- Palette drawer complete
- Old `updatePropertiesPanel` reduced to dispatcher (~100 lines)
- 226 inline styles reduced to <30 (computed geometry only)
- Full regression
- Demo scene verification

---

## 6. NNG Amendments

### NNG-UI1: Inspector Zone Order (new)

The inspector panel renders zones in this fixed order for all selections:
1. **Header** — name, category, defId
2. **Status** — error/warning badges (from `ud.errors`)
3. **Summary** — at-a-glance key-value chips (from `inspectorUI.summary`)
4. **Parameters** — editable controls (from `inspectorUI.params`)
5. **Properties** — solved read-only values (from `inspectorUI.properties`)
6. **Custom** — unit-specific UI (from `inspectorUI.customSection`)
7. **Ports** — port list with connected stream preview
8. **Diagnostics** — warnings, errors, suggestions (always present)

Zones with no content are hidden.  Order is never changed.

### NNG-UI2: Palette Persistence (new)

Adding a unit to the canvas never changes the palette drawer's open/closed
state, search text, or category filter.  The palette is orthogonal to the
inspector: both can be visible simultaneously.

### NNG-UI3: CSS-First Styling (new)

Visual styling uses CSS classes from the defined vocabulary.  Inline style
strings are permitted ONLY for:
- Computed widths/heights (progress bars, fill indicators)
- Dynamic colors derived from data (SOC color, stream phase color)
- Position values for canvas elements (SVG transforms)

All other visual properties (padding, font, opacity, layout) must use classes.

### NNG-UI4: Unit UI Colocation (new)

UI metadata for the inspector lives in the `inspectorUI` property of the
`UnitRegistry.register()` call.  There is no separate UI registry.
Adding a new unit type requires:
1. `UnitRegistry.register(defId, { ..., inspectorUI: { ... } })`
2. (Optional) SVG icon in `<defs>`
3. Nothing else for the inspector.

---

## 7. Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|------------|
| Inspector regression (values disappear) | Medium | High | Migrate unit-by-unit; keep legacy fallback until all migrated |
| Layout breakage on small screens | Low | Medium | CSS grid handles gracefully; palette overlay doesn't shift canvas |
| Performance (rebuilding inspector each solve) | Low | Low | Already rebuilding; schema is same cost or cheaper |
| Drag-drop browser compat | Low | Low | Reuse existing HTML5 drag which already works |
| Scope creep into engine changes | Medium | High | Hard rule: inspectorUI is read-only; no engine changes in v10.0.x |

---

## 8. Success Metrics

After v10.1.0:

- **Adding a new unit to the inspector** requires only the `inspectorUI`
  descriptor in the `register()` call (< 20 lines).  Zero changes to
  any other function.
- **Inspector layout is predictable**: same zone order for all 34 units.
- **Palette stays open**: user can add 10 units without reopening.
- **Inline styles reduced** from 226 to < 30.
- **`updatePropertiesPanel` reduced** from 1,766 lines to ~100.
- **Zero test regressions** across all 189 existing tests.
- **Net line count** approximately neutral (metadata added ≈ monolith removed).

---

## 9. Estimated Effort

| Phase | Lines added | Lines removed | Net | Complexity |
|-------|-----------|-------------|-----|-----------|
| Phase 0: CSS + Renderer | ~250 | ~0 | +250 | Low |
| Phase 1: Unit Migration | ~400 | ~1,400 | −1,000 | Medium-high (breadth) |
| Phase 2: Palette Drawer | ~200 | ~80 | +120 | Medium |
| Phase 3: Polish | ~150 | ~150 | 0 | Low-medium |
| Phase 4: Milestone | ~20 | ~0 | +20 | Low |
| **Total** | **~1,020** | **~1,630** | **−610** | |

The revamp makes the file ~600 lines shorter while adding significant
new functionality.  This is because the schema-driven approach eliminates
massive duplication in the inspector monolith.
