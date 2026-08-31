# THE UI MODEL — two interfaces, four surfaces, one tree
## (2026-08-30, from the user's design review after G76-G79)

This is the mental model the editor is being rebuilt against, and the spec for
the chantiers that get it there. It SUPERSEDES parts of the 9b design handoff
(`design_handoff_garage_editor_9b`) — that bundle stays the authority on
COLOUR, TYPE, SPACING and COPY, and this document is the authority on WHAT GOES
WHERE. Where they disagree, the disagreements are listed at the bottom with the
reason, because the handoff is high-fidelity and quietly ignoring it would be
the wrong kind of drift.

Numbers reserved for this arc: **G86-G91**. (G81-G85 are the GEN_ACCESS
session's; G80 is superseded — see below.)

---

## THE RULE, IN ONE LINE

**Two interfaces, one renderer. In the workshop: observe LEFT, change RIGHT,
select RIGHTMOST, look in the MIDDLE.**

---

## 1. TWO INTERFACES

FLIGHT and WORKSHOP are separate chrome layers over the same camera, scene and
renderer. Each owns its furniture; neither borrows.

| | FLIGHT | WORKSHOP |
|---|---|---|
| owns | PFD, phase rail, aircraft card, telemetry, minimap, from/to/conditions, reset/pause, skin/wire/UV | the four surfaces below |
| has none of | part selection, the tree, properties | airspeed, altitude, phase, telemetry |

THE USER'S OWN WORDS: *"I don't care about telemetry and speed/alt stats in
garage, and I don't care about part selection in flight mode. Different
interfaces entirely."*

This is not a set of `display:none` rules sprinkled across a shared screen —
that is what it is today and it is why the old aircraft card renders underneath
the new name chip. It is two top-level layers, switched by the mode, and the
overlap is checked by a gate: **no element may be visible in both.**

---

## 2. FOUR SURFACES IN THE WORKSHOP

    ┌──────────┬────────────────────────────┬───────────┬────────┐
    │   INFO   │           VIEW             │ PROPERTIES│  TREE  │
    │  280 px  │        free estate         │   390 px  │ 250 px │
    │  folds   │                            │           │ folds  │
    └──────────┴────────────────────────────┴───────────┴────────┘

Each has ONE JOB, and nothing appears on two of them.

### 2.1 INFO (left, new) — what this aeroplane IS

Answers *did it work?*. Permanent, not a sheet: the plaque is the feedback loop
of the whole game, and a plaque you have to open hides the consequence of the
slider you just moved.

- **the name and verdict** — the aeroplane's name, its one-line provenance, and
  the plaque's verdict chip. (This retires the G78 name chip: it was a door to
  a sheet that no longer exists.)
- **THE PLAQUE** — the certificate, grouped as `app.js` builds it today.
- **THE BENCH** — the declared tests with their verdicts, and a run control.
- **TEST FLIGHT** — the P3 row that is declared and unbuilt; it lives here when
  it lands.
- **THE FLEET** — save · save as · export · import, and `open the fleet ›`
  into the RACK, which stays a sheet. Watching the plaque wants persistence;
  browsing forty aeroplanes wants width.

**IT PUSHES THE RENDER.** Like the right panel since G77.1: the canvas is inset
by BOTH panels, so the orbit centre is the centre of what is actually visible.

### 2.2 VIEW (centre) — showing, and direct manipulation

Unchanged from G78/G79 and already built: the icon rail (camera · display ·
night · explode · measure) with its flyouts, the two verbs bottom left, the
part callout, click-to-select and hover.

What LEAVES it: the name chip (to INFO), and `#edStat` — 531 characters of
vertex counts and layer measurements, which is a DIAGNOSTIC and belongs behind
the `display` flyout, not on screen.

### 2.3 PROPERTIES (right) — editing the selection

Two tabs, and **they are two VIEWS OF THE SAME TREE, not two panels**:

    ┌─────────────┬─────────────┐
    │    SHAPE    │   FINISH    │
    └─────────────┴─────────────┘

The tree stays the only selector — the noun. The tab is the adjective: which
question you are asking about the thing you selected. Select `windscreen` and
see its shape rows, or its glazing finish. This keeps the tab from becoming a
third way to navigate, and it scales: a `systems` view later is another tab and
the tree does not change.

The join already exists: the part table carries each part's `sections`, and
AEROSKIN's finishes are keyed on exactly those section names.

**FINISH, per part**: the finish choice, the tint, and — the user's ask —
**tile scale, roughness × and normal/bump ×**. The room's own panel already has
this exact idiom (material · tile size · roughness × · normal ×); the finish
view borrows its shape rather than inventing one.

**FINISH, on the root**: the whole-aeroplane livery — scheme, base and trim,
registration, decals. This is the "full section on its own, with ample room"
the retexturing work has earned.

### 2.4 TREE (rightmost) — selecting

- **THREE ROOTS**, siblings: `✈ THE AEROPLANE` · `⌂ THE SHED` · `⛰ THE WORLD`.
  One selector for every object in the scene. This SUPERSEDES the G78 shed
  sheet, and reverses that chantier's ruling deliberately: one selector scales,
  two interfaces do not.
- **`Design & construction` is the first row under the aeroplane**, above
  Fuselage. It holds the ~8 discriminators that decide WHICH PARTS EXIST —
  construction (`intCons`), boom style, canopy/mirrored pod, seating starter,
  nose configuration, powertrain, gear layout, wing position/bracing.
  This is ROADMAP P8 §3's "configure THEN shape", preserved by ORDER rather
  than enforced by a mode — and it is the answer to the user's *"where is the
  conception slider?"*: it exists, at `Fuselage → Structure & skin →
  construction`, which is filed under one part of an aeroplane while deciding
  what ALL of it is made of.
- **COLLAPSE per assembly**, state persisted.
- **No help text at the foot.**

---

## 3. WHY THE TABS ARE NOT THREE

The user's own closing worry is that *"it gets complex quickly"*, and the
mechanism by which UIs get complex is ACCUMULATING NAVIGATION AXES. This model
has exactly one: **the tree**. The tabs filter one panel; the left panel is
always about the aeroplane; the view is always the view. A DESIGN tab was
considered and rejected in favour of a tree row for precisely this reason —
the tree row costs no axis and is one click from anywhere.

---

## 4. THE CHANTIERS

### G86 — TWO INTERFACES
Split the chrome. `#ui` becomes FLIGHT-only; a `#wsUI` layer owns the workshop.
Retire from the workshop by construction (not by CSS): the aircraft card, the
phase rail, the PFD, the telemetry, the minimap. Move `#edStat` into the
`display` flyout. **GATE**: no element visible in both modes; UISMOKE drives
both.

### G87 — THE INFORMATION PANEL
`#edInfo`, 280 px, left, foldable, pushing the render and its centring exactly
as G77.1 does on the right. It takes the plaque (`app.js` `drawPlaque`), the
bench (`bench.js` `#bTests`), the fleet section, and the aeroplane's name and
verdict. **`#edSheet` retires**; the RACK becomes the one remaining sheet.
The canvas inset becomes `left + right`, and `projectPoint` follows.

### G88 — THE TREE GROWS ROOTS
Three roots; `Design & construction` at the head of the aeroplane's branch,
taking `intCons` and the other discriminators off the parts that hold them
today; per-assembly collapse; the help text goes. The shed's rows move from the
G78 sheet into the shed branch, and the world's (the F5 atmosphere session's
conditions) into the world branch. **GATE PARTS extends** to cover all three
roots — every row of every object claimed exactly once.

### G89 — THE FINISH VIEW — **LANDED: the UI as G104, `spec.finish` as G105**
Both halves are in. The tabs, the per-part rows and the root's livery are on
screen, and the finish now belongs to the aeroplane rather than to the browser.
ONE CORRECTION to the paragraph in bold below: it landed WITHOUT a GEN_SPEC_V
bump and without a migrator, because there is nothing to migrate — an old spec
gets `finish: null`, which is "no overrides", which is what it meant. The 5 -> 6
bump belongs to the energy module. See HANDOVER `## G104` and `## G105`.

SHAPE/FINISH tabs over the properties panel. Per-part finish, tint, tile scale,
roughness ×, normal ×. Whole-aeroplane livery on the root: scheme, registration,
decals. **And the reservation that actually matters for a future material
manager is not UI**: move per-section finish and tint out of the localStorage
pref into a **`spec.finish` block, with a `GEN_SPEC_V` bump and its migrator**.
ROADMAP already lists this as owed from G67, and ruling 4 requires it before
liveried builds are shared. A manager is then a later UI over data that already
round-trips; scaffolding UI now would reserve the wrong thing.

### G90 — VIEW STATE NEVER FLIES — **LANDED as G106**
Landed, and the diagnosis below is superseded: the vertices were already fine,
and what flew exploded was the PROPELLER'S PIVOT, read out of the scene after
the restore had already put it back. Four more display controls were corrupting
the capture besides (the family alphas, wireframe, the surface field). The fix
is a declared table plus GATE VIEW; see HANDOVER `## G106`.

The original note, kept because its premise is the one to distrust:
**A real bug, found by the user**: `explodeD` is correctly declared out of the
spec (G63's `CAGE_VIEW_KEYS`), but `CAGE_JOIN.snapshot()` captures the meshes AS
DRAWN — so an aeroplane rolled out while exploded flies exploded, and one rolled
out with the fuselage alpha down flies half transparent.
Fix in `syncBuild()`, which is the one place both testing and rolling out go
through: neutralise explode, the family alphas, cutaway and the display modes;
rebuild; snapshot; restore. **GATE**: a snapshot taken at `explodeD 0.5` is
vertex-identical to one taken at `0`.

### G91 — THE PASS — **LANDED as G112** (the controls and the scrollbars),
### G108 (the headings). One sweep still owed, named at the foot.
- ~~**The controls get the palette.**~~ **DONE at G112.** Measured before: 111
  of 118 checkboxes and 485 of 518 ranges `appearance:auto`, painting in the OS
  accent. Measured after: 0 of 123 and 0 of 565, across both workshop roots.
  The scrollbars went with them — six scrollers, and there had been no
  scrollbar styling anywhere in the project outside `tools/_pwr.html`.
  **TWO THINGS THIS SECTION GOT SHORT, both found by measuring:**
  the workshop is TWO roots, `#wsUI` for the panels and `#edView` for the
  floating chrome — and `#edFly`, the surface this item was really about, is in
  the second, so `#wsUI` alone would have missed it; and the PALETTE has the
  same defect one level down (`--ed-off` lives on `#edWrap`, and `#edInfo` and
  `#edFly` are both outside it), so rescoping the rules alone gave the flyout
  `appearance:none` toggles with a transparent track. Both roots carry the
  control rules AND the tokens now.
  **THE RULE this section should have stated:** in a re-parenting architecture,
  a look keys off the ROW, not off the place the row is standing.
- ~~**Heading hierarchy in the properties panel.**~~ **DONE at G108** — one
  type ladder on `#edWrap`, used by both columns, uppercase reserved for group
  labels.
- **STILL OWED:** focus-visible, hover and `prefers-reduced-motion` swept once
  across every surface added since G77 (the top bar, the flyouts, the root
  panels, the information panel). `style.css` has the reduced-motion block;
  `editor.css` still covers only part of its own surface.

---

## 5. WHERE THIS DISAGREES WITH THE 9b HANDOFF, AND WHY

The handoff stays the authority on colour, type, spacing and copy. It loses on
three points of LAYOUT:

1. **The handoff puts everything about the aeroplane as an object behind its
   NAME, in a sheet.** This model puts it in a permanent left panel. Reason:
   the plaque is a feedback loop, and the handoff's own §6 makes the plaque
   respond to every slider — a response you cannot see is not a response. The
   sheet survives for the RACK only.
2. **The handoff has no left panel and no tabs.** It has one properties column.
   Reason: the livery work now needs room the shape rows would have to give up,
   and two views of one tree costs nothing that a single scrolling column does
   not already cost.
3. **The handoff's `night` rail item owns the shed's light, with the room
   otherwise gone.** This model gives the shed a tree branch. Reason: the world
   arrives next, and a second bespoke interface per object does not scale.

Unchanged and still binding: three greys, one accent, two alert colours; IBM
Plex Sans only, no monospace; the row grammar and its 34 px rhythm; separators
only under the tree's section leaves; one shadow; and the rule that every
surface has exactly one job.
