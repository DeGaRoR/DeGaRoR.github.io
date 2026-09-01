# Handoff: flyDiy flight interface — rebaseline

## Overview

The workshop was rebaselined at G77–G108 around one rule and it worked. The
flight layer (`#ui` in `src/viewer/body.html`) never got the same pass: it is
four always-on panels (aircraft card, phase rail, PFD, minimap, telemetry
footer) plus a bottom bar carrying **eight selects and buttons, two spans and a
disabled placeholder** in one wrapping row — and it is still the amber-on-glass
palette in IBM Plex **Mono**, which is the typeface the editor dropped
deliberately.

This design makes the two screens one product.

> **The editor's rule is spatial: every surface has exactly one job.**
> Flight has a **before, during and after** the editor does not, so its rule is
> temporal: **the screen answers what am I flying · what is it doing · what
> happened, in the order the flight asks them, and nothing that answers one
> stays on screen while another is being asked.**

The plate grammar is the editor's, unchanged, and the **placement is now
literally the editor's too**: the object's own controls at the left of the top
bar, the primary verb at the far right of that same row, the look rail alone at
the bottom left.

## About the design files

These are **design references created in HTML** — prototypes of the intended
look and behaviour, not production code to lift. flyDiy is vanilla JS with a
build step (`tools/build.js` concatenating `src/` into `index.html`), so the
task is to rebuild these screens in that environment: markup in
`src/viewer/body.html`, styling in `src/viewer/style.css` (or a new
`flight.css` — see *Palette* below), wiring in `src/viewer/app.js`. No
framework, and do not copy the HTML: the mock is inline-styled and data-driven,
which is not idiomatic here.

## Fidelity

**High-fidelity.** Colours, type, spacing and geometry are final and exact.
Copy is final. The flight view itself is a gradient stand-in in the mock — the
real thing is the existing world render (`render_world.js`), unchanged.

## Files

- `Flight Interface.dc.html` — **the design**, four screens: before, during,
  during with panels called up, after.
- `explorations/Flight Interface — all turns.dc.html` — the full exploration,
  including **1a: today's flight screen recreated** from `body.html` /
  `style.css` / `app.js` (verbatim ids, copy, the 12 telemetry cells in order,
  the 14 phases, the three `.hudSec` groups, credit + hint). The before/after
  reference. Turn 1 also holds the superseded arrangement (verbs bottom-right,
  PFD top-right) — turn 2 is the one being implemented.

---

# The functional split

Four surfaces. Nothing appears in two of them.

### 1. The top bar — WHAT YOU FLY, and the verbs
Mirrors `#edTopBar` exactly: a plate at the left, the verbs at
`margin-left:auto` on the same row, the bar itself `left:22px; right:22px;
top:18px` with `flex-wrap:wrap`.

**The flight plate** (`#flPlate`, taking `#edFleet`'s place) — the brief, four
slots, one decision each, every slot opening a flyout:

| slot | replaces | source |
|---|---|---|
| aeroplane | `#selAc` | the fleet; `⚒ Garage build` is your own |
| pilot | `#selPilot` | auto / test pilot / autopilot |
| route | `#selFrom` + `#selDest` | one slot, `From → To`, `⟳ Circuit` as a destination |
| day | `#selCond` | the six standard days |

- Header line: `THE FLIGHT` + right-hand meta (`held · 794 kg all-up`).
- **It folds to one line the moment the phase leaves `HOLDING`** — name ·
  trip · day · `▾` — because nobody changes their aeroplane at 400 ft. That
  fold is most of how this screen gets quiet. Reopening it while airborne is
  allowed; it just is not the default.
- A **notice plate** sits under it when there is something to say
  (`NOT CERTIFIED — the bench has not passed since your last three changes`).
  Warn border, warn label, one line. This is where `#bGo.warn`'s meaning goes.

**The verbs** (`#flActs`, taking `#edActs`'s place) — far right, same row:

- before: `Fly the circuit` (pri) · `The shed`
- during: `Pause` · `Restart` · `The shed`
- after: `Fly on` (pri) · `The shed`

`Fly the circuit` lands on the same pixel as the editor's `Roll out & fly`, and
`Pause`/`Restart` never move between states. `#bHangar2` becomes `The shed`
(one name for one place). Like `Roll out`, the primary is **never disabled** —
flying something uncertified and finding out why is content, not error; it
changes its words, not its state.

### 2. The bottom-left rail — HOW YOU LOOK
Literally `#edRail`, in a plate at `left:22px; bottom:18px`. Five questions,
one glyph and one word each, `.edRailBtn`'s own metrics. Flyouts open **upward
from their own button** — `openFly()` unchanged, including its one stated rule
("UNDER ITS OWN BUTTON… an answer that always appears in the same place does not
say which question it answers") and its clamp to the free estate.

| button | flyout holds | replaces |
|---|---|---|
| `camera` | chase · orbit · cockpit · wing · tower; FOV, level horizon, lead the turn | nothing — flight has no camera UI today |
| `instruments` | which readouts the PFD carries (IAS/ALT/VS always, then AoA, bank, AGL, throttle, TAS, power) | 8 of the 12 telemetry cells |
| `map` | show, size, north-up / nose-up | `#mmp` + its N-up chip |
| `trace` | show, altitude, speed, peak strain | `#bTel` + the `#telp` footer |
| `air` | conditions, wind, gusts, **time of day (greyed)** | 4 telemetry cells + `#selTime` |

`camera` and `display`-family icons are `editor.js`'s **verbatim** paths;
`instruments`, `map`, `trace`, `air` are new, drawn to the same 18-box and 1.35
stroke.

`cockpit` is the pilot eye the editor already flies (`CAGE_CREW_EYE`,
`applyInterior`, `EYE_NEAR`/`EYE_PIVOT` in `app.js`) — one control, both
screens, not a second implementation.

### 3. The bottom-right PFD — WHAT IT IS DOING
The one always-on instrument, at `right:22px; bottom:18px`. Eyes down for
numbers, ahead for the aeroplane.

- Three readouts, `600 30px` Plex **Sans** (not Mono), right-aligned,
  `min-width:62px`, `gap:22px`: IAS, ALT, VS. Which three (and whether more)
  is the `instruments` flyout's business.
- **The phase rail lives inside this plate**, under a hairline: the phase name
  (`600 9.5px`, .18em, uppercase, accent) and the 14 `PHASES` as 3 px tracks,
  7 px each, the current one 14 px and accent, past ones
  `rgba(230,219,201,.45)`, future `--ed-off`. `#rail`'s own panel disappears —
  the progress is now where you were already looking.
- A readout goes `--ed-warn` when it is outside the plaque's envelope (stall,
  Vne, sink rate). No green: ok is simply the ink.

### 4. The summoned panels, and the arrival
- **The map** — `right:22px; top:92px` (under the verbs), 196 px, plate padding
  5 px. Bigger than the old 172 px because it is not permanent.
- **The trace** — `left:22px; right:366px; bottom:82px`, so it fills the bottom
  row up to the PFD and clears the rail. Graph + three legend keys.
  **Peak strain is a line on the graph**, not a cell in a grid.
- **The arrival card** (`#arrCard`) — the only panel that *appears*. Centred,
  520 px, on `--ed-panel` (opaque, not a plate: it is a document, not chrome),
  in the plaque's own two-column grammar so the flight's numbers and the
  bench's numbers read as the same kind of thing. Two buttons **on the card**,
  because they belong to the flight and not to the screen: `Log the flight` and
  `What went wrong` (the door to the teaching report the ROADMAP wants).

### What is cut, and where it went

| today | goes |
|---|---|
| `#card`'s `#brand` line ("Garage Flight Sim") | nowhere — you know what game you are in |
| `#card` name + spec | the flight plate's first slot / the folded line |
| `#rail` as a panel | inside the PFD plate |
| `#mmp` always-on | the `map` flyout |
| `#telp` (graph + 12 cells + legend) | `trace`, `instruments`, `air` |
| `Peak strain` cell | a line on the trace |
| `#bSkin` | a `display` row |
| `#credit` | the shed's about line (it is a credit, not a HUD element) |
| `#hint` ("drag to orbit") | shown once on the first flight, then gone |
| `#selTime` disabled | a row in `air`, greyed **there**; absent from the main screen |
| `.hudSec` × 3 + `#grp` + 2 buttons | four plate slots + the verbs |

---

# Interactions & behaviour

- **Open a slot / a rail flyout**: one flyout at a time, `openFly(k)`'s
  existing single-slot model. A second click on the same button closes it.
  `Esc` closes. Clicking the render closes.
- **The brief folds** when the phase leaves `HOLDING` (160 ms width/height, the
  editor's `.16s ease`), and unfolds on `STOPPED` only if the player opens it.
- **A decision mid-flight** that requires a reset (aeroplane, route origin,
  conditions) prompts inline inside the slot's flyout — never a browser dialog.
  `#selDest`'s existing "change while stopped → `nextLeg()`" behaviour is kept.
- **The arrival card** appears once on `STOPPED` with `tdInfo`/`report` and
  hides the moment the phase moves, exactly as `app.js` does today.
- **Hover**: rail buttons `rgba(255,255,255,.06)`; pills lift their border to
  `rgba(255,255,255,.3)`; nothing moves.
- **Focus**: `2px solid var(--ed-acc)`, `outline-offset:2px`.
- **Reduced motion**: no transitions, as both stylesheets already do.

# State

- `brief` — `{ acKey, pilot, fromId, destId, condKey }`; the plate renders it,
  and `app.js`'s existing `setAircraft` / `fromId` / `selCond` handlers are the
  writers. No new source of truth.
- `briefFolded` — derived from the phase, overridable by the player.
- `flyOpen` — `null | 'camera' | 'instruments' | 'map' | 'trace' | 'air'`;
  reuse `openFly`'s variable and mechanics.
- `panels` — `{ map, trace }` booleans, persisted (localStorage, beside
  `cageExpert`). These replace `#mmp.big` and `#telp.show`.
- `camera` — `{ mode, fov, levelHorizon, lead }`; `mode:'cockpit'` is the
  existing `edEye` path.
- `instruments` — which readouts the PFD carries; the other cells stop existing
  rather than being hidden.

# Palette and type

**Identical to the editor** — the Bone tokens of `editor.css`, no additions:

| token | value |
|---|---|
| `--ed-plate` | `rgba(32,29,26,.94)` (every floating plate) |
| `--ed-panel` | `#201d1a` (the arrival card) |
| `--ed-ink` / `--ed-dim` / `--ed-faint` | `#f4efe6` / `#c0b8ac` / `#97907f` |
| `--ed-acc` / `--ed-acc-ink` | `#e6dbc9` / `#221f1b` |
| `--ed-hair` / `--ed-border` | `rgba(255,248,236,.09)` / `rgba(255,248,236,.14)` |
| `--ed-btn-bg` / `--ed-btn-bd` | `rgba(255,255,255,.06)` / `rgba(255,255,255,.18)` |
| `--ed-track` / `--ed-off` / `--ed-off-bd` | `rgba(0,0,0,.3)` / `rgba(255,255,255,.12)` / `rgba(255,255,255,.22)` |
| `--ed-warn` / `--ed-bad` | `#d8a07a` / `#e08a5a` |

The amber-on-glass set (`--amber`, `--cyan`, `--glass`, `--edge`, `--ctl`) is
**retired from the flight HUD**. `--cyan` and `--amber` stay where they are
actually earning their keep: the telemetry canvas's own plotted lines and the
load-test viz.

> **Where to declare it.** `editor.css` declares the palette on
> `:is(#wsUI, #edView)` and its own comment says the flight layer "is a third
> sibling, owned by style.css, and is untouched by construction rather than by
> care." That is now wrong by intent: add `#ui` to that selector list, or
> declare the same block on `#ui` in `style.css`. Do **not** copy the hexes a
> third time — the file already carries a note about the two blocks that
> restate them.

**Type**: IBM Plex Sans only. `font-variant-numeric: tabular-nums` on the
layer. **Mono is dropped from the HUD** — `#brand`, `#acName`, `#acSpec`,
`#phName`, `.rd b`, `.rd i` and the telemetry cells are all Mono today, and it
is the face the editor removed on purpose.

| role | spec |
|---|---|
| PFD readout | `600 30px/1.02`, `letter-spacing:-.01em` |
| PFD unit | `500 8.5px/1`, `.15em`, uppercase, faint |
| phase name | `600 9.5px/1`, `.18em`, uppercase, accent |
| plate section label | `600 9.5px/1`, `.2em`, uppercase, faint |
| slot label | `500 8.5px/1`, `.16em`, uppercase, faint |
| slot value | `500 12px/1.2`, ink |
| folded brief name | `600 12px/1`, `.08em`, ink |
| rail label | `500 8px/1.2`, `.06em`, uppercase |
| verb | `500 12px/1` (`600` for pri), `.1em`, uppercase |
| flyout row label / value | `400 11.5px/1.3` dim / `500 11px/1` ink |
| arrival title | `600 17px/1`, `.06em` |
| arrival row | `400 11.5px` dim / `500 12.5px` ink |

**Geometry**: chrome inset 22 px; top bar `top:18px`, bottom plates
`bottom:18px`; plate padding 10–11 px × 12–14 px; radius **9 px** plate,
8 px verb, 7 px pill/slot, 6 px rail item, 11 px arrival card. Rail item
50 × (8 px 0), gap 6, svg 15 px. `backdrop-filter: blur(14px)` on plates (the
render behind moves, unlike the editor's). One shadow, on the arrival card
only: `0 24px 60px rgba(0,0,0,.55)`.

**`box-sizing: border-box`** — `style.css` already sets it globally; every
width above assumes it.

# Repo map

| design piece | today | file |
|---|---|---|
| the flight plate | `#card` + 3 × `.hudSec` | `body.html`, `style.css`, `app.js` |
| the verbs | `#grp`, `#bHangar2` | same |
| the notice | `#bGo.warn` | `app.js` (~3288) |
| the look rail + flyouts | — (new; port `#edRail`/`#edFly`) | `editor.js` `RAIL`/`buildRail`/`openFly` |
| the PFD | `#pfd`, `.rd` | `body.html`, `style.css` |
| the phase track | `#rail`, `#track`, `setRail` | `app.js` (~2158) |
| the map | `#mmp`, `#mm` | `app.js` (~3662) |
| the trace | `#telp`, `#tel`, `#grid`, `#legend`, `#bTel` | `app.js` (~2206, ~3515) |
| the arrival card | `#arrCard` | `app.js` (~2293) |
| retired | `#brand`, `#credit`, `#hint`, `#selTime`, `#bSkin`, `#grid` cells | `body.html`, `style.css` |

# Extensibility — what this has to absorb next

The rail is a table (`{k, label, icon, rows}`) and the plate is a list of
slots. Everything the ROADMAP has queued lands in one of them without a new
surface:

- **F4, the day cycle** → `time of day` in `air` stops being greyed. Already
  has its row.
- **F5, the atmosphere** → more rows in `air`; the numbers it produces are
  `instruments` checkboxes, not new cells.
- **F6 / the aerodrome** → the `route` slot's flyout grows a field list; the
  map flyout grows what it draws.
- **Cargo and contracts** → a **fifth plate slot** (`load`), which is why the
  plate wraps rather than being a fixed four.
- **Failures / wear** → the notice plate, which already exists and already has
  one job.
- **A second aeroplane in the air** → the folded brief line is per-aircraft;
  the plate is the one that is singular.

# Open questions

1. **Where the palette is declared.** Adding `#ui` to
   `:is(#wsUI, #edView)` is one line and correct, but that selector is named
   for the workshop. Renaming it (or adding a third root) is a judgement call
   for whoever owns `editor.css`.
2. **`GATE UISMOKE`** asserts ten flight ids inside `#ui` and eight workshop
   ids outside it. Retiring `#brand`, `#credit`, `#hint`, `#selTime`, `#bSkin`
   and moving the telemetry cells will move that gate's ground; it needs
   updating in the same commit, not after.
3. **Keyboard flying.** There is none today (the autopilot flies). If manual
   control is coming, the PFD plate is where a control-position strip belongs
   and it should be designed before, not after — say so and I will.
4. **The `instruments` default set.** Three readouts is right for watching;
   a builder debugging a wing may want six. Worth a default that changes with
   the pilot mode (`test pilot` → more).
