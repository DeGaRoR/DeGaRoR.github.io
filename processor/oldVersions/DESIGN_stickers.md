# P1 — Canvas Stickers: Detailed Design & Implementation Plan

**Baseline:** v10.6.0 · 219/219 tests · 1498 checks

---

## 1. Concept

Stickers are floating data labels on the canvas, visually tethered to their
source unit. They display live solver output — the same badge data shown in
the inspector's conditions / power / reaction / kpis sections. Users populate
stickers by dragging badges from the inspector onto the canvas.

### Core rules
- **One sticker per unit** — all badges from a given unit collect into one
  floating container. No orphan stickers, no duplicate containers.
- **No duplicate data** — if a badge (identified by section + label) is
  already in the sticker, dragging it again is a no-op.
- **Relative positioning** — sticker offset is stored as `(dx, dy)` in grid
  cells from the unit center. Moving the unit moves its sticker.
- **Live refresh** — badge values re-evaluate on every `afterSolve()`.
  If a badge returns no data (unit disconnected, no solve yet), the row
  shows "—".
- **Tether line** — straight SVG line from unit center to sticker center.
  Toggle visibility via a bottom-bar button (global, all-or-nothing).

---

## 2. Data Model

### 2.1 Per-unit sticker state (on the unit object)

```javascript
u.sticker = {
  dx: 4,      // cell offset from unit center (x)
  dy: -2,     // cell offset from unit center (y)
  items: [
    { section: 'conditions', label: 'Temperature' },
    { section: 'power',      label: 'Shaft power' },
    { section: 'kpis',       label: 'SOC' },
    { section: 'reaction',   label: 'Conversion' },
  ]
};
```

- `section` ∈ `{ 'conditions', 'power', 'reaction', 'kpis' }`
- `label` = exact string from the inspector item's `.label` field
- The pair `(section, label)` is the unique key — prevents duplicates.
- `u.sticker = null` means no sticker (default).

### 2.2 Why section + label is sufficient

Inspector hooks return items like `{ label: 'Shaft power', value: '12.3kW' }`.
The label is already unique within each section (enforced by the hook author).
Cross-section collisions (e.g. "T setpoint" in both kpis and power) are
resolved by storing the section. This means we never need synthetic IDs.

### 2.3 Global toggle

```javascript
ui.showStickerLines = true;   // toggled by bottom-bar button
```

Not persisted (view state, like showUtilities).

---

## 3. Evaluating Badge Values at Render Time

At render (or afterSolve), for each unit with `u.sticker`:

```javascript
function _evaluateStickerItems(u) {
  const def = UnitRegistry.get(u.defId);
  const ud  = scene.runtime.unitData.get(u.id);
  const cfg = UnitInspector[u.defId];
  if (!ud || !cfg) return u.sticker.items.map(it => ({ ...it, value: '—' }));

  // Collect all available badges by section
  const pools = {};
  if (cfg.conditions) pools.conditions = cfg.conditions(u, ud) || [];
  else {
    // Auto-stream fallback: convert to labeled items
    const ps = _findPrimaryStream(ud, def);
    pools.conditions = ps ? _autoStreamToItems(ps) : [];
  }
  pools.power    = cfg.power    ? (cfg.power(u, ud)    || []) : [];
  pools.reaction = cfg.reaction ? (cfg.reaction(u, ud) || []) : [];
  pools.kpis     = cfg.kpis     ? (cfg.kpis(u, ud)     || []) : [];

  // Look up each sticker item
  return u.sticker.items.map(it => {
    const pool = pools[it.section] || [];
    const match = pool.find(p => p.label === it.label);
    return { ...it, value: match?.value ?? '—', tone: match?.tone, bar: match?.bar, barColor: match?.barColor, barValue: match?.value };
  });
}
```

New helper `_autoStreamToItems(stream)` converts the auto-stream (T, P,
Phase, Molar flow, Mass flow) into the same `{ label, value }` format used
by config hooks — so conditions badges from auto-stream units are also
draggable.

---

## 4. Inspector Drag Source

### 4.1 Which elements are draggable?

Every `.propItem` badge rendered by `_renderKPIGrid` and `_renderAutoStream`
gets a drag handle. Detail section items (insKV in collapsible) are NOT
draggable — they are secondary data.

### 4.2 Interaction

We use the HTML5 Drag API (already used for unit library → canvas):

- **dragstart** on each `.propItem`: sets `dataTransfer` with
  `application/x-sticker-badge` carrying `{ unitId, section, label }`.
  The badge gets a subtle "grabbing" cursor + opacity reduction.
- **dragover** on `<svg>`: accepts the sticker MIME type (already handles
  unit drops; we add a second path).
- **drop** on `<svg>`: reads payload, computes world position, creates or
  extends `u.sticker`, pushes undo, re-renders.

### 4.3 Badge identification during drag

When rendering each section, we tag each `propItem` with:
```javascript
badge.dataset.stickerSection = 'power';
badge.dataset.stickerLabel   = item.label;
badge.dataset.stickerUnit    = u.id;
badge.draggable = true;
```

### 4.4 Drop logic

```javascript
function _handleStickerDrop(ev, section, label, unitId) {
  const u = scene.units.get(unitId);
  if (!u) return;
  _pushUndo('Add sticker badge');

  const w = screenToWorld(ev.clientX, ev.clientY);
  const dx = Math.round(w.x / scene.tile) - u.x;
  const dy = Math.round(w.y / scene.tile) - u.y;

  if (!u.sticker) {
    u.sticker = { dx, dy, items: [] };
  }
  // Dedup
  if (u.sticker.items.some(it => it.section === section && it.label === label)) {
    showToast('Already in sticker');
    return;
  }
  u.sticker.items.push({ section, label });
  autoSave();
  render();
}
```

---

## 5. SVG Rendering

### 5.1 Sticker container

Rendered in the connections layer (after connections, before pending-line)
so stickers float above connections but below drag feedback.

For each unit with `u.sticker`:

```
stickerG = <g class="sticker" data-sticker-uid="...">
  // Tether line (optional)
  <line class="sticker-tether" x1="unitCx" y1="unitCy" x2="stickerCx" y2="stickerCy" />
  // Background rect with rounded corners
  <rect class="sticker-bg" rx="6" ... />
  // Badge rows
  <text class="sticker-label">Temperature</text>
  <text class="sticker-value">423.2 K</text>
  ...
</g>
```

### 5.2 Layout

- Fixed width: ~140px (enough for label + value).
- Each row: 18px height. Label left-aligned, value right-aligned.
- Background: semi-transparent dark card (`rgba(15,23,42,0.88)`) with
  1px border matching the unit's category color.
- Bar items (SOC): rendered as a small horizontal bar + % text.

### 5.3 Position computation

```javascript
const unitCx = (u.x + def.w / 2) * tile;
const unitCy = (u.y + def.h / 2) * tile;
const stickerX = unitCx + u.sticker.dx * tile;
const stickerY = unitCy + u.sticker.dy * tile;
```

### 5.4 Tether line

```javascript
if (ui.showStickerLines) {
  <line stroke="#475569" stroke-width="1" stroke-dasharray="4,3"
        x1="unitCx" y1="unitCy" x2="stickerCx" y2="stickerCy" />
}
```

Dashed, subtle grey, no pointer events.

---

## 6. Sticker Dragging (Repositioning)

Stickers are draggable to reposition. Since they're SVG `<g>` groups:

- **pointerdown** on `.sticker-bg`: capture, begin drag. Record initial
  offset from pointer to sticker position.
- **pointermove**: update `u.sticker.dx/dy` in real time, re-render the
  sticker group (just transform, no full re-render).
- **pointerup**: finalize, push undo, autoSave.

This mirrors the existing unit drag pattern.

---

## 7. Sticker Management

### 7.1 Remove a badge from sticker

Right-click (contextmenu) on a sticker row → remove that item.
If last item removed, `u.sticker = null` (sticker disappears).

OR: simpler — a tiny × button on each row that appears on hover.

### 7.2 Remove entire sticker

Select unit → delete key (when sticker is focused)? Too complex.
Simpler: add a small × in the sticker header corner.

### 7.3 Cursor feedback

- Drag badge from inspector: `cursor: grab` on hover, `grabbing` on drag.
- Drag sticker on canvas: same grab/grabbing.

---

## 8. Bottom Bar Toggle

Add a new `tbtn` next to the utilities toggle:

```html
<button class="tbtn" id="btnStickerLines" data-tip="Show/hide sticker lines"
        style="font-size:14px; border-radius:8px;">📌</button>
```

Click toggles `ui.showStickerLines` and opacity. Mirrors the utilities
toggle pattern.

---

## 9. Persistence

### 9.1 Export

`exportJSON()` already serializes `u.params`. We add `u.sticker` to the
unit serialization:

```javascript
data.units.push({
  id: u.id, defId: u.defId, name: u.name,
  x: u.x, y: u.y, rot: u.rot,
  params: u.params,
  sticker: u.sticker || undefined   // omit if null
});
```

### 9.2 Import

`importJSON()` restores `u.sticker` from the saved data. Unknown sections
or labels are kept (they'll just show "—" until the inspector hook exists).

---

## 10. Edge Cases

| Case | Behavior |
|------|----------|
| Unit deleted | sticker removed (deleteUnit clears u) |
| Unit not yet solved | all values show "—" |
| Inspector hook returns fewer items than before | missing items show "—" |
| Label renamed in future version | old label shows "—" (graceful degradation) |
| Drag badge when no solve exists | sticker created, values show "—" |
| Two badges with same label, different sections | both kept (section disambiguates) |
| Same badge dragged twice | toast "Already in sticker", no-op |
| Sticker moved off-screen | allowed (user can zoom to fit) |
| File import with stickers | round-trips correctly |

---

## 11. Implementation Plan

### v10.7.0 — Sticker Data Model + Rendering + Tether

| Step | Description | Risk |
|------|-------------|------|
| S1 | `_autoStreamToItems(stream)` helper | Low |
| S2 | `_evaluateStickerItems(u)` evaluation function | Low |
| S3 | CSS for `.sticker-bg`, `.sticker-label`, `.sticker-value`, `.sticker-tether` | Low |
| S4 | SVG rendering loop in `render()` — sticker groups with tether lines | Medium |
| S5 | `ui.showStickerLines` + bottom bar toggle button | Low |
| S6 | `exportJSON` / `importJSON` sticker round-trip | Low |
| S7 | Sticker drag (reposition) with undo | Medium |
| T220 | Sticker data model: create, dedup, evaluate | — |
| T221 | Sticker persistence round-trip | — |

### v10.7.1 — Drag-from-Inspector + Management

| Step | Description | Risk |
|------|-------------|------|
| S8 | Tag propItems with `data-sticker-*` + `draggable` in `_renderKPIGrid` and `_renderAutoStream` | Medium |
| S9 | dragstart/dragover/drop handlers for sticker badge drops | Medium |
| S10 | Remove badge: × button per row on hover | Low |
| S11 | Remove sticker: × header button or auto-remove when empty | Low |
| T222 | Inspector badge drag interaction (manual test notes) | — |

### Test gate: 222/222 tests.

---

## 12. What I changed from the v10 plan

- **Moved from Phase I (v10.9.x) to v10.7.x** — user requested it now.
- **Dropped P2 (Grouping)** from this scope — separate feature.
- **Two sub-versions** instead of three (P1a+P1b+P1c → v10.7.0+v10.7.1).
- **Dropped T195/T196** numbering — renumbered as T220-T222 to follow
  the current sequence (219 is the last test).
- **Added explicit evaluation model** (section + label lookup) not in
  original plan.
- **Added auto-stream → items conversion** for units without custom
  conditions hooks.
