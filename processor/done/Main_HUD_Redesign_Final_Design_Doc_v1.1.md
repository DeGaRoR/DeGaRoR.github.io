# Main HUD Redesign — Final Design Doc (v1.1)

## 1) Objectives
- Always-visible, real-time **survival telemetry** (planet + room + reserves).
- Minimal clutter: collapsed UI stays **one line** for top telemetry, and **one row** for bottom transport.
- Rich info without modals: use **expandable strips/drawers**, not blocking dialogs for core survival info.
- Bottom bar becomes **transport-first by default**, expandable into the current “full console”.

## 2) Global Layout
Persistent elements:
1) **Top App Bar** (identity + global menu + alerts)
2) **Top Survival Strip** (collapsed/expanded; always-on telemetry)
3) **Bottom Transport Bar** (collapsed/expanded; time + save controls)
4) **Left-edge “+” button** opening the palette drawer

---

## 3) Top App Bar

### 3.1 Contents (left → right)
**Left**
- ☰ Main menu
- **Process/Game name** (primary identity text)

**Right**
- 🔔 Alerts (badge)
- ? Help/shortcuts
- (optional) fullscreen

### 3.2 File/process/game name placement
The name lives here, always visible and stable regardless of strip expansions.

**Behavior**
- Truncate with ellipsis; tooltip shows full.
- Clicking name opens a small non-blocking “Project” panel (rename / metadata / save info).

---

## 4) Top Survival Strip

### 4.1 Collapsed (single line)
Exact intended format:

`Planet X 32°C 0.96b O2:16% CO2:9%  |  Room liveable  |  Reserves for 1d17h (power limited)  ▸`

**Rules**
- One line only, never wraps.
- “Room liveable” is color-coded (traffic-light logic).
- Reserves shows **limiting time-to-empty** + limiting cause in parentheses.
- Right chevron toggles expanded/collapsed.

### 4.2 Expanded (2–3 lines max)
Adds rates + reserve breakdown with `reserve net (TTE)` format.

**Planet line**
- `Planet X 32.0°C 0.96 bar  O2 16.0%  CO2 9.0%` (+ RH if relevant)

**Room line**
- `Room: LIVEABLE ● (GREEN/AMBER/RED)  O2 …  CO2 …  T …  RH …  Driver: …`

**Reserves line**
- `O2 40 +5 (12h) | H2O 18 -2 (9h) | NH3 8 +0 (∞) | ⚡ 4.2 -1.1 (1d17h)  Limiting: ⚡`

**Color rules**
- Net (+/-) colored by sign/magnitude (production vs consumption).
- TTE colored by urgency bands.
- Room verdict colored by status.

### 4.3 Interaction
Clicking each section opens its detail panel (drawer/popover). Live monitoring must not require a modal.

---

## 5) Bottom Transport Bar (strict control list)

### 5.1 Collapsed bottom bar (default)
**Control order is fixed and exactly:**
1) **Step forward**
2) **Play / Pause**
3) **Date & Time controls** (existing cluster)
4) **Revert**
5) **Save**
6) **Chevrons** (expand)

No other controls appear in collapsed mode.

**Sketch**
```
[Step] [Play/Pause]   [Date/Time controls…]   [Revert] [Save]   [»»]
```

### 5.2 Expanded bottom bar
Expands into “what it is today” (current full console and extra controls). Expanded content may be reorganized; collapsed stays sacred.

### 5.3 Interaction rules
- Chevrons toggle collapsed/expanded.
- Expanded panel height capped (e.g. max 35–40% viewport) to protect canvas.
- Expanded state remembers last internal section.

---

## 6) Palette Access (“+”)
- Floating **+** pinned to left edge.
- Opens palette drawer (search + categories + tiles).
- Drawer stays open after placement.

---

## 7) Anti-jitter real-time update rules
- UI refresh cadence capped (e.g. 4–10 Hz).
- Tabular numerals; fixed-width fields where possible.
- Optional display smoothing; never hide real values in detail panels.

---

## 8) Lane rules (prevents future creep)
- **Top App Bar:** identity + global nav + alerts only.
- **Top Survival Strip:** live survival telemetry only.
- **Bottom Collapsed:** only the 6 controls listed above.
- **Bottom Expanded:** everything else.
