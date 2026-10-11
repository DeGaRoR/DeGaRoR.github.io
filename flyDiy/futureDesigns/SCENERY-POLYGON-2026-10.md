# SCENERY-POLYGON — one polygon, attachable properties; the inspector apart from the palettes
### (2026-10-11, SCENERY-ED-1 G2890 — the brief for SCENERY-ED-2. Nothing here is built yet.)

**BUILT (SCENERY-ED-2 G2910-G2914, 11 Oct, contract v1.36, record v2)** - what differs from the brief below:
- §3 went straight to step 2 (no view-only phase): `unwrap` migrates, `expandAreas` is compose's first step; the props
  hold the v1 entries' own fields (lossless: `wheels: { surface, z, apron }`, not a word) and `src` keeps the ids and the
  places, so the expansion is the v1 record exactly (GATE PREMISES 20 on every fixture, Jolene and her parts).
- Jolene has NO `m_sh13`: the four `y_sh*` bands are areas with gravel wheels and no draw - the inspector now says "it
  draws NOTHING ... add a DRAW"; nothing of Jolene's content was changed (the user's call which bands should draw).
- §2 `draw: { kind: 'grass' }`, `life` on areas, the exclude words bushes / grass, the dock's `deck` - not built.
- §4 marks: parking / dock / hatch (`areaMarks`, in the pavement's frame; rules the shader already reads); `stands`
  stays the apron's own (draw.stands). §6: thumbnails, groups, search, ghost (R, Alt + wheel, level), scatter, `s`.

The user's notes (11 Oct): "The polygons saying 'gravel' around the main strip do not seem to draw anything, but to
remove trees. I would rather have a generic polygon type to which we can attach properties, like terraforming, biome
replacement, vegetation exclusion, draw surface, etc." · "Drawing concrete surfaces in a nice way, without texture
repetition, and placing parking weathered markings ... for docks. It could be a variation of the generic polygon." ·
"Unify the polygon concept, and provide more info on selection." · "The content of the right panel does not follow the
tab selection ... the tabs control the displayed action buttons, the right zone being a generic inspector." · "A
generic asset visualizer/placer to drop models from the available bank."

ED-1 (G2890) landed the unblockers this design builds on: the shape's hand (edge click = a corner, pick + Del,
subdivide, the round pad), the smooth road, the plots' ground, the trees' live regrowth (contract v1.35).

## 1. Why the user is confused today

Seven record kinds are "a polygon that does something", each in its own layer with its own inspector, and none says
what the others do at the same place:

| today's record | what it does | what it does NOT do (the surprise) |
|---|---|---|
| `surface` (gravel / paved / sand) | the wheels' class; **keeps trees and plots out** | draws nothing - Jolene's `y_sh*` "gravel" bands |
| `surface` + `apron: true` | the same, listed as an apron for the pilot | draws nothing |
| `material` + `set` | a PBR set painted on the ground (4 slots) | moves nothing, the wheels feel nothing |
| `material` + `look` (+ `round`) | a pavement drawn (the PAVEMENT module) | the wheels feel it only when round (v1.35) |
| `exclude` | keeps trees / plots / settle out | draws nothing |
| `zones` kind `clear` / `forest` / `airfield` | no trees / a wood / a strip's ground | a zone is otherwise a sowing area |
| `ttype` | stamps a terrain type; its vegetation (none / a biome / a new one) | - |
| `terrain` flatten / raise / ramp | moves the ground | paints nothing, excludes nothing |

So a "gravel apron" is today two or three records (a surface for the wheels, a material for the look, maybe a
flatten) that the author must keep aligned by hand - and the gravel band beside 13/31 looks like it "removes trees"
because that is the only visible effect a surface polygon has.

## 2. ONE polygon: an AREA with properties

```
 areas[] = { id, name, z,                                   z: priority among areas (the higher paints / wins)
             shape:  { poly: [[x,z]...] } | { round: { c, r, n } } | { rect: { c, hw, hd, yaw, radius } },
             props:  {                                        every key optional; an empty area is a sketch
               terraform: { kind: 'flatten'|'raise'|'ramp', level, dh, slope, hdg, abs, falloff },
               exclude:   { trees, bushes, grass, plots, settle },          booleans; the old `what`
               cover:     { code, from, clear, veg: { mode: 'none'|'biome'|'new', mix, species, density } },   the ttype's
               wheels:    'grass'|'gravel'|'paved'|'sand',                 the physics class (the old surface)
               draw:      { kind: 'set', set, tile, fade }                  a PBR set (the old material)
                        | { kind: 'pave', look, band, pav, yaw }            the pavement (concrete / asphalt / gravel / dirt)
                        | { kind: 'grass', h, density }                     a lawn (the plot grass rule),
               marks:     { kind: 'parking'|'dock'|'stands', rows, bay, age, yaw },   weathered paint on a draw
               life:      the SCENERY LIFE block, as on zones / sites } }
```

```
        AREA a12 "fuel apron"                     the inspector, selected:
   ┌──────────────────────────┐                  ┌──────────────────────────────┐
   │ ░░░░ concrete ░░░░░░░░░░ │ draw: pave       │ AREA a12 · fuel apron     ✕  │
   │ ░ ▯▯▯▯ parking marks ░░░ │ marks: parking   │ 1 240 m² · 146 m · 6 corners │
   │ ░░░░░░░░░░░░░░░░░░░░░░░░ │ wheels: paved    │ ▸ SHAPE   6 corners  [subdiv]│
   └──────────────────────────┘ terraform: flat  │ ▸ TERRAFORM  flatten 12.4 m  │
     no trees · no plots       exclude: trees    │ ▸ DRAW       concrete, worn  │
                                                 │ ▸ MARKS      parking, 8 bays │
                                                 │ ▸ WHEELS     paved           │
                                                 │ ▸ EXCLUDE    trees, plots    │
                                                 │ [+ add a property ▾]         │
                                                 └──────────────────────────────┘
```

Rules the composition keeps:
- **Defaults follow the draw**: picking `draw: pave concrete` proposes `wheels: paved` and `exclude: trees, plots`
  (the runway look's `surface` idiom); the author may overrule each. A property is shown as a chip on the outline.
- **One shape, many effects, one priority**: `z` orders areas against areas exactly as surface / material `z` did.
- **The round pad and the rect** are shapes, not kinds: `round` and `rect` (a rounded rectangle - a parking lot, a
  dock edge) write their `poly` in normalise (v1.35's rule), and "free corners" turns either into a plain poly.

## 3. How today's records migrate - and why every save keeps loading, bit for bit

A **view, then a migrator**, never a rewrite of the composer:

1. ED-2 step 1 (no record change): `areaOf(layer, entry)` / `entriesOf(area)` - a lossless two-way adapter. The
   inspector shows EVERY polygon-bearing entry as an area (its one property lit: a `surface` entry is an area with
   `wheels` + the derived `exclude`), and editing a property the legacy entry cannot hold (drawing on a gravel band)
   writes the area's other legacy entry beside it (a `material` with the same `poly` and id `<id>~d`). The record is
   still v1; the game and every gate are untouched.
2. ED-2 step 2: `layers.areas[]` + `PREMISES_MIGRATORS[1]` (v1 -> v2) folding each group of same-`poly` entries into
   one area. **Compose EXPANDS areas back into its internal lists** (`surf`, `mats`, `pavePolys`, `excl`, `mods`,
   `ttypes`) in the order the v1 layers had them - so a migrated record composes to the same heights, the same
   `surfaceAt`, the same excludes: GATE PREMISES gains "every fixture: compose(migrate(rec)) === compose(rec), every
   sample bit-equal", and GATE PREMCOOK's committed cook stays valid (no re-cook). `stageRestore` / `restorePlaces`
   carry areas by id like any entry.

| v1 entry | area props |
|---|---|
| `surface {surface, z}` | `wheels`, `exclude: {trees, plots}` when gravel / paved / sand (today's derived rule, made visible) |
| `surface {apron: true}` | + `marks: {kind: 'stands'}` reserved; listed in `aprons()` by `wheels: paved` + a name |
| `material {set, tile, fade, z}` | `draw: {kind: 'set'}` |
| `material {look, band, pav, yaw, stands, round}` | `draw: {kind: 'pave'}`, `marks` from `stands`, `shape.round` |
| `exclude {what}` | `exclude` |
| `zones clear` / `airfield` | `exclude: {trees}` / `{trees, plots}` (forest and the sowing kinds stay ZONES - they sow) |
| `ttype {code, veg, from, clear, cover}` | `cover` |
| `terrain flatten / raise / ramp` | `terraform` (grade stays a road's / a strip's - a line, not an area) |

Jolene's `y_sh13_*` + `m_sh13` pairs fold into one area each (wheels gravel + draw set `dry`), which is exactly the
"gravel band that draws" the user expected.

## 4. Concrete without repetition, and weathered marks (notes 5, docks)

`draw: pave` already has the anti-tiling the runways judged (PAVEMENT's hex tiling + the imprint, `hexOn`; the
far-tier albedo gate) - areas reuse it, never a plain tiled set. ED-2 adds `marks` generated in the area's own frame
(`yaw`): `parking` = bays (`bay` width, `rows`, the aisle) clipped to the shape with a 1 m inset; `dock` = an edge
line + bollard spots along the water side (the edge whose outside is water); `stands` = the apron stands of today.
Every mark wears the paint-age of the area's `pav.paintAge` (worn, chipped, rubbed off at the wheel tracks). A DOCK
over water needs a deck: ED-2 gives `draw` a `deck: { h, piles }` option that stands the pavement as the pier kit's
deck (the harbour's piles) instead of draping it on the seabed - else a dock is an area on reclaimed land.

## 5. The UI split (notes 7, 8): palettes in the tabs, ONE inspector on the right

```
 ┌ rail ┐┌──────────── view ──────────────────────────────┐┌──── INSPECTOR (its own plate) ────┐
 │TERRAIN││ [select][area][flatten][road]..  ← the tab's    ││ SELECTED · AREA a12 · fuel apron  │
 │AIRFLD ││  palette: tools + its pickers (catalogue,       ││ (always the selection, whatever   │
 │ROADS  ││  species, a model's thumbnail strip)            ││  tab is lit)                      │
 │AREAS  ││                                                 ││ ...property sections...           │
 │SITES  ││                                                 ││ nothing selected: the scenery's   │
 │ASSETS ││                       the scene                 ││ outline (every feature, by kind,  │
 │FILE   ││                                                 ││ click = select + frame)           │
 └───────┘└─────────────────────────────────────────────────┘└───────────────────────────────────┘
```
- The tab no longer empties the inspector (today `setSection` rebuilds it from the tab): the right plate is the
  SELECTION's, styled as a separate plate with its own header ("SELECTED · <kind> <id>"), so it reads as an inspector.
- What each tab put in the inspector with nothing selected (the building palette, the objects' pickers, the site
  themes) moves to the tab's strip as a PALETTE drawer under the tools.
- More info on selection (note 7): area / length, corners, the bbox, what the wheels feel at its centre, which
  other features overlap it (chips that select them), the plots / trees it removed (counts), its issues.

## 6. The asset placer (note 10) - the bank ASSETS-OCT G2900 prepares

The bank (A0, 11 Oct): a pier-style kit - rows in `tools/scenery_table.py`, packs `src/scenery/scenery_*.js`, meshes in
`media/geo/scenery`, textures in `media/tex/scenery`, LOD props with `lodOf` / `lodDist`, an `_asset_check` row. They
register into `PROP_REG` like every prop, so the editor reads them with NO key literal (contract rule 13).
ED-2's ASSETS tab: a thumbnail grid (an offscreen render per key at first show, cached by the pack's hash), search and
the registry's groups as pills, the ghost under the cursor (on the ground, tilted or level, `R` turns 15 degrees,
wheel + Alt scales where the row allows), click = one `objects[]` record (the `prop` record of today - nothing new in
the contract), and a SCATTER brush (n within a radius, seeded, one record per object so each stays editable).

## 7. ED-2's order of work and its gates

1. The inspector plate apart from the tabs (§5) and the selection info - no record change.
2. `areaOf` / `entriesOf` (§3.1): every polygon an AREA in the inspector, properties as sections, "+ add a property".
3. `areas[]`, the migrator and compose's expansion (§3.2); GATE PREMISES "migrated = original, bit for bit" on every
   fixture; PREMCOOK green with no re-cook.
4. `draw: pave` with `marks` (parking, dock) and the `rect` shape (§4); the deck after.
5. The ASSETS tab (§6) on whatever the bank holds that day.
Gates: PREMISES (the migrator rows), SCENERYED (the hand, extended to areas and the palette), PAVEMENT (the marks),
PREMCOOK, UISMOKE; island_shot at Jolene's 13/31 band to see the gravel finally drawn.

## 8. NEXT: the road bed and the road ribbons by piece (asked 11 Oct, after ED-2's scope)

The user (11 Oct, a screenshot of their island road): "the road is sunk in many places. Maybe build a little bank or
something, ensuring the paved surface is always visible?" What it is: a graded road (flat across, smoothed along, 6 m
nodes, falloff) is CUT into the hills; physics and the fine 2 m patch agree, but past the fine patch's reach the coarse
far ground (17-70 m cells) interpolates OVER a 4-7 m cut and hides the pavement. (Part of the user's sinking was the
record's extent - fixed in ED-2, G2919: the fine patch now covers the whole road.) The brief:
- **A road bed** (a road's `bed: { bank, grade }`): the ground under the paved width set to the road's own profile,
  filtered along (a max grade: the longitudinal envelope compose already has as `grade`), shoulders blending back over
  `bank` metres - an EMBANKMENT where the road fills (it rides over any coarse mesh), a cut slope where it digs. The
  composer's grade modifier already is this shape; the bed adds the bank width and the fill bias (a road that may sit
  up to N cm over the ground rather than in it).
- **The far ground's sink under the pavement** (render_world's rings): the patch sinks under a pavement's opaque interior
  (G660, PAVEMENT.SINK); the rings do not - past the patch a road needs the same sink (or the ribbon a distance lift).
- **The ribbons by piece**: a road's ribbon is rebuilt whole on every edit (and every other road's with it) - pieces
  between control points, global u kept (a cached piece shifts its u attribute when the line upstream grew or shrank),
  invalidated by a ground-dirty box over the piece; the table rows (G925) and the merges re-done per piece.
- Proof needs the GPU: stills of the island road near and far, a timed check of a drag on it (edit to quiet < 100 ms).
