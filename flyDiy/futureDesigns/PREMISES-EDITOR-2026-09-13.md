# PREMISES-EDITOR — the world editor: zones, sites, roads, runways, polygons; a bench first, the game last
### (2026-09-13, from the user's brief on the premises of the world editor)

STATUS: **design; the bench v0 (G356: the ground, the record, a flatten) and v1 (roads traced and graded,
zones sown with the house generator on every plot, forest / clear zones, hand trees) and v2 (a strip placed by
two clicks on the flight world, graded to its slope, painted by the game's recipe, the pattern derived and
validated live) and v3 (a site from the catalogue - the Kennecott theme by one click, placeSite's rules, the
conveyor link solved, every derived entry built headless) and v4 (G372: a catalogue foot is any simple
polygon, the strip's HOLDS slide on the centreline and the validator answers live - the strip judged on its own
graded flat - pickers by tag, draw calls and triangles on the plaque) and v4.1 (G372.1: the village landed - the
real catalogue built by the gate, the real tramLine solving the cable, a park zone standing totem parks on its
plots with derived lawns and a filled slot, contract v1.5) and v5 (G378: the dressing per plot and park through the
village's plan functions, the lot material one keeper, lights counted, props and billboards placed by hand, contract v1.6)
and v6 (G379: the stand and its way out - the core's third pattern branch - the harbour, one bank law, the road that follows
the ground, the showcase record, contract v1.7) and v7 (G380: premises_perf.js - 17 ms and 4 551 draw calls at the
showcase overview on an RTX 3080; the draw calls are the budget's first problem) LANDED 2026-09-13. THE BENCH IS CLOSED.
THE PORT LANDED 2026-09-14 (G385 L1: the composer in the core, makeWorld(seed, { premises }) with the three hooks,
the world pack as refs; G386 L2: render_premises.js in game mode built by the world scene, the saved record composed at
the boot, ?premises=<fixture>; G387 L3: the WORLD rail entry opens the same module over the flight scene, the sim held,
premises_host.js one keeper of the cameras / pick / mouse for bench and game, every edit recomposed live with the
ground rings re-sampled; G390 L4: the full battery green from a clean worktree). THE EDITOR IS IN THE GAME: roll out,
open WORLD on the flight rail. What the port left for later is listed in section 7.** (`tools/_premises.html`, port
8401, GATE PREMISES, five fixtures). Companion
to `PREMISES-CONTRACT-2026-09-13.md` (the record and the asset contract, frozen v1). Appendix A is
THE SPLIT — how the parallel sessions divide the work, land, unify and port; every session reads it.

THE USER'S ASK (2026-09-13): *"We may want to fork in different sessions from now on for the
buildings editor; one on the cable car, one on the factory, and one on the integration of the totems
and other props. […] We'll need a structure for invoking these in game, an editor prototype, where
zones can be defined, and specific buildings placed, basic roads traced. That's why the port to the
game is last, we'll still design a few key places, like the harbor, some air taxi services and other
elements key to gameplay and scenery, then ensure a good performance of the mix, then decide a way we
can control the sowing of these accurately […] Let's get inspiration from the city builders I think
for the editor. That might be fun as well, rather than technical and boring, and these interfaces
should feature everything we need. […] It will also need to allow for more detailed edition, and it
may take some or all options back from the F8 menu. It may have different sections. We can also take
inspiration from the MSFS editor, in particular for the runway management, the use of polygons for
controlling vegetation, aprons, elevation and procedural generation."*

RULINGS TAKEN 2026-09-13: this session writes both documents then the bench v0; the tram and the
factory stay with the running "wooden house generator" session until it lands, then dedicated
sessions relaunch; **the factory is the Kennecott mill EXTENDED** (power house, crusher, ore bins, the
full aerial tramway to the mine adit); **the editor is a developer tool designed to become the
player's** (ISLAND-ADMIRALTY §9: the player develops the island) — one module, every section on the
bench now, the player surface a subset behind the same record later.

WHAT IT RELATES TO:
- `PREMISES-CONTRACT-2026-09-13.md` — the record this editor writes and the catalogue it reads.
- `WORLD-V2.md` §6 / §7 (the modifier layer, zones as data) and its W7 "the airfield editor — its own
  document": this is that document, widened to the whole premises.
- `ROADMAP.md` Phase 4 (LITTLE AIRPORTS) 1-3b: the modifier layer, the strip as a profile, the editor
  v0 that only writes records, the pattern editor over `sitePatternIssues`; and the ONE EDITOR ruling
  (no shipped control may live only on a bench page — hence the module boundary of §7).
- `GRAPHICS-SETTINGS-2026-09-12.md` / `src/viewer/gfx_settings.js` — the `mount(body, H)` host pattern
  the module copies; `src/viewer/dev_panel.js` — the F8 dials this editor takes some of.
- `tools/_village.html` / `_village_gen.js` — the bench this one is modelled on and the engine it reuses.
- `src/core/25_airfield.js` — `siteRunway`, `sitePaintStrip`, `sitePattern`, `sitePatternIssues`;
  `src/viewer/pattern_vis.js` — the PAPI and the pattern overlay.

---

## 0. WHAT IT IS, IN ONE PARAGRAPH — AND WHAT IT IS NOT

A city-builder-feeling editor over ONE data record (the premises), with the MSFS scenery editor's
capabilities where the ground meets the aeroplane: a runway OBJECT with a profile, polygons that
flatten / grade / surface / paint / exclude, aprons that reach the physics, a traced road that grows
plots, zones that sow themselves, dedicated sites placed from a catalogue with their connections
solved live. It writes RECORDS ONLY — nothing on screen exists that is not rebuilt from the record,
and no tool ever touches terrain, trees or meshes directly (ROADMAP Phase 4 §3). It is one MODULE
with two hosts: the bench page today, the game's rail tomorrow. It is not the F8 panel (which owns
nothing and stays), not the graphics menu (a saved player choice), not the aeroplane editor
(`editor.js`, whose name it must not reuse), and not the quadtree baker (W2 — the baked mode of the
modifier layer arrives with it; until then the editor composes live).

Where it stands (the survey of 2026-09-13): the shipped world is the 24 km analytic one
(`20_world.js` + `render_world.js`); every building generator lives ONLY on the bench pages under
`tools/` (village, house, tram, big, totems) — nothing in `index.html` references them. The editor
therefore starts on the bench, edits the village's terrain by default, and can switch to the game
world for airfield work; the port (Appendix A §6) is a hosting question because the bridge is the
record and the generators are modules.

---

## 1. LAYOUT

The module builds this inside its host: a **left rail** of SECTIONS (icons + labels — the flight
rail's idiom), a **tool strip** across the top of the view for the active section's tools (one active
tool, highlighted; the current snap glyphs and the last refusal's reason live here), the **inspector**
on the right (the selected record's DECLARED rows; sections collapsible by the aeroplane editor's rule
— open at ≤ 5 visible rows, the TRUNK `name / position / size` always open, only the user's choices
stored), the **`#chk` panel** bottom-left mirroring GATE PREMISES line for line, the **BUDGET plaque**
top-right, an **overlay picker** and a **camera-mode picker** top-left.

Two invariants: every tool writes ONE record kind into ONE layer, and the inspector shows THAT
record's rows with THAT record's handles; a red validity never commits.

---

## 2. THE SECTIONS AND THEIR TOOLS

| section | tools (top strip) | writes | inspector rows (declared `[key, label, lo, hi, step, names?, opts]`) | handles |
|---|---|---|---|---|
| **TERRAIN** | `flatten` (polygon → target height), `grade` (polyline + width + profile), `ramp` (polygon + plane), `raise / lower` (polygon ± m), `water level`, `probe` (click → elevation / slope readout) | `layers.terrain[]`; `water.level` | `h` (m), `falloff` (2..120 m), `order` (stepper), `plane dz/dx, dz/dz` (‰), a grade's per-vertex `h` | polygon vertices + midpoints (insert), a height stem at the centroid (drag up / down), the falloff ring |
| **AIRFIELD** | `runway` (click end0, click end1 → the object), `apron`, `taxiway` (surface polygons), `stand` (point + hdg), `taxi-out` (polyline from the stand), `pattern` (nodes / holds), `windsock`, `PAPI` | `layers.runways[]` = the `W.aerodromes` record + `profile {slope, crossfall, disp:[m,m], overrun:[m,m], markings, papi:[bool,bool], windsock}` + `site` + `pattern` | `len` 150..1400, `wid` 12..45, `surface` [GRASS, PAVED, GRAVEL, SAND], `slope` −3..3 %, `crossfall` 0..2 %, `disp0/1`, `overrun0/1`, `markings`, `papi0/1`, `gs` (`when: papi`), `windsockH` | end discs (drag one, the other stays; Alt = translate both; Shift = snap hdg to 5°), width bars at mid-length, threshold bars (slide along the axis only), pattern nodes (free), holds (on the centreline; the validator's "hold leaves N m of run" as a ruler while dragging), the stand arrow |
| **ROADS** | `trace` (click vertices, dbl-click ends), `extend`, `join` (an end to a road's nearest point), `bridge` (mark a span), `fillet` (radius at a vertex) | `layers.roads[]` → a `polyRoad` in the viewer, worn into the WEAR canvas (roads TINT, they never cut) | `w` 2.5..8, `cls`, `surface`, `fillet r` 4..30 (the hovered vertex), `frontage preview` (the plots a zone would cut along it, no houses) | vertices, midpoints, end caps; a snap glyph when 15° / grid / end-snap engages |
| **ZONES** | `zone` (polygon), `kind`, `re-sow` (also live on edit), `plot override` (click a sown plot → pin / forbid / preset) | `layers.zones[]` + `overrides {plotId: preset ‖ empty ‖ pinned}` | `kind`, `density` 0..1, `palette`, `seed` (stepper), `plotMin / plotMax / plotDepth` (expert) | vertices; the sown plots as outlines with their ids (click = override) |
| **SITES** | `catalogue` (a palette from the generators' exported CATALOGUEs, by tag), `place` (a ghost footprint follows the cursor), `rotate`, `anchor to road` (snap to the nearest road, yaw = facing), `link` (pick hook A, then hook B) | `layers.sites[]`, `layers.links[]` | the entry's own preset rows (the mill's `tiers`; a station's `lineDeg` read-only once linked), `yaw`, `anchor`, `seed`; a LINK shows its solver's verdict as a note row (the angle / "out of 15-45°") | footprint corners (read-only), a rotate ring, move by the centre; hook glyphs (a pin per hook; pick to link); the link as a ghost ribbon while picking |
| **VEGETATION** | `exclude`, `density` (polygon + factor), `species` (polygon + key), `tree` (hand-place one), `bush / grass` (disabled until the pipeline exists), the forest dials | `layers.exclude[]` (what: trees), vegetation polygons, `layers.objects[]` trees in `TREE_PLACE`'s shape | `what`, `factor` 0..2, `species` from `TREE_PLACE.keys()`, tree `size` 0.5..1.6, `yaw`; the **forest** group (from F8): fill density, L0 / L1 / L2 to, fade window, furnished, size spread | vertices; a tree = a disc + drag; the species overlay shows `speciesAt` |
| **OBJECTS** | `prop` (palette by group from `PROP_REG`), `place` (snap to ground, tilt to the slope), `rotate`, `billboard` (from `BIG_GEN.signKeys()`) | `layers.objects[]` | `key`, `ry`, `tilt`, `y offset` | a disc under the prop, a rotate ring |
| **WORLD / VIEW** | camera modes, overlays, `LOD force` | nothing in the record (view state → `flydiy.prem.view`) | **light** (from F8: rig row, sun elev / azimuth / intensity / warmth, hemisphere, exposure, environment, shadow reach, forest floor, far shadows, shadow map), **frame** (AA tier), **camera** (free-cam speed), `LOD force` [by distance, full, L1, L2, L3] over `PROP_LOD_FORCE`, `time of day` (disabled, "later: SKY-ATMOSPHERE S1") | — |
| **FILE** | `new`, `save`, `save as…`, `load`, `export json`, `import`, `world` [B, A], `size` (B only) | the envelope | `name`, `world`, `size` 320..1280, `anchor x / z / yaw` (expert) | the anchor's frame axes on the ground |
| **BUDGET** | a plaque, always visible, expands on click | nothing | triangles per LOD ring (0-60 / 60-132 / 132-270 / beyond), draw calls, textures + MB, trees planted / streamer state, rebuild ms per dirty layer, `__gl` counters when the probe hooks are present; `premises_perf.js` later | — |

---

## 3. WHAT MOVES OUT OF F8, AND WHAT STAYS

The rule: a row MOVES if its value is a property of the PLACE (saved in the record) or a VIEW the
author needs while authoring; it STAYS on F8 if it tunes an ASSET's look or a renderer internal.

- MOVES → VEGETATION / forest: fill density, L0 / L1 / L2 to, fade window, furnished, size spread.
- MOVES → WORLD / VIEW: the whole light block, frame (AA tier), camera (free-cam speed).
- STAYS on F8: leaf wrap / sss / sss power / ao bake / sharp, master hue / sat / light, the
  per-collection tints, imp lit / gain / solid, floor blur / edge, shadow snap.

Nothing is duplicated: neither panel owns state — both are `{get, set}` rows over the same live
handles (`TREE_FILL`, `TREE_LOD`, `TREE_MIX`, `WORLD_RIG`, `FLYDIY_AA`, `DEV_CAM`), so a value moved in
one is the value the other reads. `dev_panel.js` keeps working unchanged in the game.

---

## 4. THE INTERACTION MODEL

**Mouse.** MSFS's layout in every state: **left = act, right-drag = orbit, middle-drag = pan, wheel =
zoom.** (The village bench orbits with the left button; a tool cannot share the left button with the
camera, so the habit changes on purpose.)

**Tool state machine.** One `TOOL` at a time: `{ name, state: 'armed' | 'drawing' | 'dragging' |
'picking', ghost, pts }`. `select` is the idle tool; clicking a tool arms it; the first click enters
`drawing` (polylines / polygons) or commits at once (point tools); Enter / dbl-click commits, Esc
cancels back to `armed`, Esc again to `select`. Dragging a handle is a sub-state of `select` with a
snapshot of the record. `picking` is the link tool after hook A.

**Ghost and validity.** Every tool with a footprint draws its ghost from the record it WOULD commit,
through the same builder that draws committed records (`ghost(feature)` = build at 0.45 opacity, no
shadows). `validate(feature, record, world)` returns `{ errors, warnings }` per kind: runway → the
UNMODIFIED ground's slope along the centreline against the flatten's reach, water crossings, site
overlap; site → footprint against keep-outs, water, slope before the flatten; road → grade > 12 %,
water without a bridge; zone → self-intersection, overlap; pattern → `sitePatternIssues` verbatim.
Green none / amber warnings / red errors; **red refuses the click** and the first error shows in the
tool strip.

**Snapping** (Shift held = off; active snaps show as glyphs at the cursor): grid at 1 / 5 / 10 m by
zoom; polyline angle to 15° from the last segment (Ctrl); road ends (a 12 px radius in screen space);
a road's nearest centreline point + normal (anchored sites; `z` snaps to the theme's inland default);
runway ends to the pattern's holds; hooks to hooks. Radii are screen pixels, so map and orbit feel alike.

**Polygons.** Click vertices; the closing edge is previewed; dbl-click or Enter closes; Backspace
removes the last vertex; a self-intersecting closing edge is red and refuses. Concave is allowed
everywhere: even-odd containment and a signed edge distance in the core (`inPolyWinding`, `sdPoly`,
`convexParts`); triangulation only in the viewer (`THREE.ShapeUtils.triangulateShape`). Physics never
triangulates.

**Selection and the inspector.** Click = the nearest feature: 2D first (distance to a polyline /
inside a polygon, in metres from the ray's ground hit), then 3D for objects and sites by raycast
against meshes tagged `userData.premId`. The inspector shows the record's declared rows through the
host's builders; `when` discriminators reveal rows live; `level: 'expert'` behind the editor's own
switch (`flydiy.prem.expert`).

**The PIN.** Hovering a row lights the handle it moves — the point comes from the build's published
`handles` map, never re-derived: `len` → both end discs, `wid` → both width bars, `disp0` → threshold
bar 0, a pattern node's `r` → its fillet arc, a zone's `density` → every sown plot pulses once.

**Drag handles.** Discs on the ground, sized in screen space, `depthTest` off. A vertex drag = ground
raycast → set the vertex → dirty layer; a midpoint drag inserts. A runway end drag keeps the other
end fixed and recomputes `x, z, hdg, len` (the object stays the registry record). Threshold bars slide
along the axis only; holds along the centreline only. Hooks are pick targets, not draggable — the
site is. A drag is ONE undo command (coalesced on mouse-up).

**Keyboard.** `Esc` cancel / deselect · `Enter` commit · `Del` delete the selection and its
dependents (a runway's pattern, a site's links — listed in the tool strip, no modal) · `Ctrl+Z / Y` ·
**`G` grab, `R` rotate, `S` scale (Blender-modal: the mouse moves it, left click confirms, Esc reverts,
`X` / `Z` constrain, typed numbers apply — `R 90 Enter`)** · `Tab` map ⇄ orbit · `1..9` sections ·
`[` / `]` previous / next feature of the selected kind · `H` hide handles · `O` cycle overlays ·
`Space` held = pan with the left button · `F` frame the selection · `Ctrl+S` save · `Ctrl+D` duplicate.

---

## 5. OVERLAYS, CAMERAS, UNDO, FILES, THE CHECK PANEL

**Overlays (the city builder's info views).** A second canvas texture `uOverlay` beside `uWear` on the
terrain material, 1024² per site, drawn from the record + terrain samples on demand: `slope`
(gradient ramp + 1 m contours), `elevation` bands, `surface class` (the `GROUND_SURF` row per pixel AS
THE PHYSICS SEES IT: registry win → premises surface polygons → classifier), `keep-outs` (exclude
polygons, site keep-outs, the runway's tree-free box + 30 m), `tree density` (the fill's effective
density after factors), `plots` (the zones' sown plots with ids), `budget heat` (tris per 64 m chunk
from the last rebuild). One texture swap; no geometry.

**Cameras.** `orbit` (the village's yaw / pitch / zoom about a centre; `F` frames), `free` (WASD /
ZQSD, R / F, Shift ×5, drag to look — `DEV_CAM`'s bindings), `map` (an orthographic camera straight
down, north-up, a 10 / 50 / 100 m grid, a SCALE BAR in the corner from the ortho half-height, wheel
zooms about the cursor; handles at constant screen size, polygons as filled outlines). Mode and poses
persist to `flydiy.prem.view`.

**Undo / redo.** A command stack over the record: `{ layer, id, before, after, label }`; `do` applies
`after`, `undo` restores `before`, both mark the layer dirty; structural commands carry `null` on one
side; drags coalesce; slider edits coalesce per key until 600 ms of silence; cap 200; the label shows
in the tool strip ("undo: move runway end"); redo clears on a new command.

**Files.** Autosave (debounced 1 s) → `flydiy.premises.wip` as the envelope; named slots
`flydiy.premises.slot.<name>`; export = download JSON; import = file input or paste (`unwrap` accepts
a bare record); `normalise` fills defaults and runs the migrators; a load REPLACES.

**The `#chk` panel** mirrors GATE PREMISES, recomputed after each dirty rebuild (the cheap lines live,
the agreement check on a 500 ms debounce): the record round-trips; every polygon simple; runway
centrelines flat to the profile within 5 cm after modifiers; `sitePatternIssues` empty per airfield;
every site footprint inside its flatten's plateau; every link solved; sown plots do not overlap; chunk
vertex heights == `terrainH` to quantisation (live vs baked, WORLD-V2 §6.3); the budget under the
plaque's limits. Green / amber / red, `pointer-events: none`, the village's own box.

---

## 6. THE BENCH PAGE — `tools/_premises.html`

**Files.** `tools/_premises.html` (the page: layout, scene, cameras, the pump, screenshots) ·
`tools/_premises_gen.js` (the CORE: the record, normalise / migrate, polygon maths, the spatial
index, sow, compose, links, the validator, the checks — pure, no THREE, node-loadable; becomes
`src/core/27_premises.js` at the port) · `tools/_premises_draw.js` (the record → scene, per layer,
dirty tracking, ghosts, `handles` maps, stats; becomes `src/viewer/render_premises.js`) ·
`tools/_premises_ui.js` (the editor module: sections, tools, inspector, undo, `mount`; becomes
`src/viewer/premises_ui.js`) · `tools/_premises_check.js` (GATE PREMISES + `--sink`) ·
`tools/premises_perf.js` (later) · `tools/fixtures/premises_*.json` (the goldens).

**Script load order** — the village's, then the core, then the module:
```
../vendor/three.min.js
<script>window.FLYDIY_ASSET_BASE = '../'</script>
house_tex · 51_prop_codec · assets · props · the 6 pier packs · 53_tree_codec · trees_pack · trees ·
the props packs · totems_poles · site_tex · lot_tex · site_ground · hangar_walls · sign_tex ·
_house_kit · _house_gen · _big_gen · _shed_gen · _tram_gen · _totem_gen · _village_gen ·
flight_core.js            (makeWorld, siteRunway, sitePattern, sitePatternIssues, GROUND_SURF — always loaded, as _terrain.html does)
_premises_gen.js · pattern_vis.js · _premises_draw.js · _premises_ui.js
```

**Which world.** Default World B: `VG.makeTerrain(Object.assign({}, VG.VDEF, { size: 640 }))` (size
320..1280 in FILE), water at `T.waterY`, the shore from `shoreZ`. `?world=A` (or the FILE row):
`WORLD = makeWorld(seed)` from `flight_core.js`, terrain = `WORLD.terrainH`, water = `WORLD.waterH`,
the anchor defaults to HOME's pad centre, and the AIRFIELD section edits `W.aerodromes`-shaped
records that `sitePattern` and the pilot read unchanged. The module sees ONE world interface
`{ terrainH, waterH, surface, aerodromes, bounds }`; B's `T.h` is wrapped to it.

**Incremental rebuild.** The ground is **64 m chunks at 1 m** (a 640 m site ≈ 100 chunks; 2 m cells
beyond a 640 m focus ring at 1280). One `THREE.Group` per layer (`ground`, `water`, `wear`,
`overlay`, `airfields`, `roads`, `zones`, `sites`, `links`, `vegetation`, `objects`, `handles`). Each
edit marks `{ layer, bbox }`; `rebuild()` redoes only the ground chunks the bbox + falloff touches,
the wear canvas, the one zone touched (re-sown with its own seed), the one site, the links touching
it, the vegetation inside the bbox. Finishes, materials and textures are cached across rebuilds;
disposal is per replaced subtree. The plaque reports "rebuild: zones 180 ms".

**Hit-testing.** Never raycast the 1 m mesh: march the ray against `terrainH` analytically (2 m steps,
bisection refine, < 0.1 ms) — it works before the mesh exists and it is what the game will do; raycast
meshes only for objects and sites, with bbox pre-tests.

**The pump.** `requestAnimationFrame` is requested once; if no callback arrives within 400 ms a
`setInterval(tick, 50)` takes over (the trees bench's hand-pump, made automatic) — the Browser pane's
rAF is dead. `tick()` renders only when dirty (edits, camera, animation), so an idle bench costs
nothing. `?probe=1` installs `window.__pump(n)` and the GL counters for the check file's headless runs.

**Screenshots.** `PREMISES_UI.shot(name, w, h, port)` renders to a sized render target, flips the
rows, POSTs a PNG to `_premises_check.js --sink <port>` (a 30-line server writing
`screenshots/premises/<name>.png`); the on-screen canvas is never read (it is 0 × 0 when the pane is
hidden). `window.PREMISES_UI = { record, cmd(name, args), build, draw, setView, shot, load, save,
check }` mirrors `VILLAGE_UI` so the pane's javascript tool can author a place end to end.

**launch.json.** `{ "name": "flydiy-premises", "runtimeExecutable": "node", "runtimeArgs":
["flyDiy/tools/_serve.js", "8401"], "port": 8401 }` — inserted in the shared tree (LF), exact-string,
before the final `]`. Page: `http://localhost:8401/flyDiy/tools/_premises.html`. Gate row:
`{ id: 'PREMISES', file: '_premises_check.js', tier: 'core' }` after SITE.

---

## 7. THE MODULE BOUNDARY — the same editor in the game

```
PREMISES_UI.mount(host, ctx) -> handle
  host   the DOM element the editor lives in (the bench's aside + a view overlay; the game's WORLD flyout body)
  ctx = {
    THREE, scene, camera(), renderer,
    world: { terrainH, waterH, surface, aerodromes, bounds },
    ground(rayOrScreenXY) -> {x, y, z} | null,           // the host's raycast to ground (the analytic march)
    cameras: { mode(), set(mode), frame(bbox), free: DEV_CAM },
    rows: { row, pills, range, note, section, refresh },   // the host's builders (bench: the cage grammar's inference; game: flRow / flPills / flRange / flNote)
    handles: { TREE_PLACE, WORLD_RIG, TREE_FILL, TREE_LOD, TREE_MIX, FLYDIY_AA, PROP_LOD_FORCE },
    catalogue: [...entries from PREMISES_GEN.collect(window)],
    tick(fn), untick(fn),                                  // the host's frame (bench: the pump; game: worldUpdate)
    storage: localStorage }
  handle = { record(), load(rec), save(name), close(), select(id), cmd(name, args), dirty(), checks() }
```

**The module owns**: the tools and their state machine, the record (through `PREMISES_GEN`), the undo
stack, the inspector's declared row tables, the handle / ghost meshes (one `THREE.Group` named
`premises:ed`, removed on `close()`), autosave. **The host provides**: the scene and camera, the
ground raycast, the world interface, the row builders, the frame tick, and — in the game —
`render_premises.js` already mounted by `render_world.js` (the game draws premises whether or not the
editor is open; the editor only adds handles). The RENDERER is shared: `RENDER_PREMISES.make(THREE,
scene, world, record, opts) -> { rebuild(dirty), ghost(feature), handles(id), dispose, stats }`.

**The game host.** A `WORLD` entry beside `GRAPHICS` in the flight rail and the shed rail, whose
flyout body calls `PREMISES_UI.mount(body, {…the rail's flRow / flPills / flRange / flNote…})` exactly
as `graphics(body)` calls `GFX.mount`. The 3D sections (TERRAIN, ROADS, …) show an "open the world
editor" pill that pauses the sim and hands the module the flight camera; WORLD / VIEW and FILE work
from the flyout directly. The physics side is the contract's three hooks in `20_world.js`, no-ops
with no premises loaded.

**As landed (G385-G387 and G390, 2026-09-14).** The host is `src/viewer/premises_host.js` (the cameras, the analytic ground
pick, the mouse, the row builders, the site functions - the bench page and the game both stand on it); the WORLD
entry's flyout offers "open the world editor", which holds the sim, hangs a right-hand panel for the module's rail
and inspector and a transparent sheet over the canvas for the mouse, and lets the host place the game's own camera
(DEVCAM's precedent in placeCamera and the world update's eye). The record autosaves to `flydiy.premises.game`,
which app.js composes at the next boot (`?premises=<fixture>` loads one from tools/fixtures, `?premises=none` a bare
world). The world pack (the generators, their textures, the cabin, this module) rides the artifact as refs ahead of
app.js, outside the budget; the composer core is inside it (7.0 MiB). NOT YET: the F8 rows the design wanted moved
stay on F8; a strip edited in the game keeps its boot-time decal until a reload; the world's trees do not follow a
live edit (placed once, at the make); the premises' own forest and hand trees are not planted in the game (the
world's species vocabulary is an index, the bench's a pack key); the shed rail has no WORLD entry; the boot builds
every house whole (4.7 s for the showcase - a worker or a ladder is owed); the houses' draw calls (premises_perf).

**Why this satisfies the ONE EDITOR ruling.** Nothing lives only on the bench: the module has no
page-specific path (the bench is one host; `app.js` and `editor.js` are two more), the record is the
only output, the renderer is shared, the F8 rows it takes are the same `{get, set}` handles. The
bench-only things are the page shell, World B's terrain, the pump and the sink — none is a control.

---

## 8. STAGES, AND THE PLACES THAT PROVE THEM

- **v0 — the ground and the record.** `_premises_gen.js` (record, normalise, `inPoly` / `sdPoly`,
  flatten / ramp / raise compose with AERO's feather, the checks), chunked ground + dirty rebuild,
  orbit + map cameras with the scale bar, the pump, TERRAIN, FILE, undo / redo, `#chk` with the
  polygon and agreement lines, the launch entry, GATE PREMISES with one fixture. F8's light / frame /
  camera rows under WORLD / VIEW over the bench's own sun (a local rig with `WORLD_RIG`'s `get / set /
  row` shape stands in). *Demoable: draw a flatten, watch the hill go flat; undo; save; reload.*
- **v1 — roads, zones, vegetation.** ROADS with snapping + wear; ZONES → `sowPlots` along the record's
  roads + the village's house / fence / lot / car planning per zone with the zone's seed, plot
  overrides; VEGETATION polygons + hand trees + the forest dials; overlays slope / surface / keep-outs
  / plots; the frontage preview. *Demoable: trace a shore road, zone both sides, watch it sow; exclude
  a polygon and the trees leave it.*
- **v2 — airfield and pattern, on World A.** AIRFIELD over `W.aerodromes` + the profile,
  `sitePaintStrip` on the strip mesh, `pattern_vis` with editable nodes, surface polygons reaching
  `GROUND_SURF`, the runway-flat and pattern lines in `#chk`, screenshots via the sink. *Demoable: drag
  a runway onto a hillside, set a 2 % slope, see the flatten follow; drag a hold and watch
  `sitePatternIssues` go red / green; the pilot flies the authored pattern in the game's `patterns`
  flyout unchanged.*
- **v3 — sites, links, objects, budget.** The catalogue consumed (`collect`), the link solvers
  (`tramLine` first, the mill's `tramTo` second), OBJECTS, the BUDGET plaque with `__gl` counters and
  per-chunk heat, `premises_perf.js`; then the game host. *Demoable: the Kennecott complex on a spur,
  the two stations LINKED and the ropes solved; a totem park on a plot; props; the plaque.*

**The acceptance places** (each a fixture under `tools/fixtures/premises_<place>.json` + a screenshot
pair): **the harbour** (a shore road, a residential zone on the water side with riparian plots, the
cannery + boat shed + net loft as sites, a pier link, a gravel apron; every over-the-water house on
its plot, the pier in the water) · **the air-taxi base** (a 320 m grass strip with a 1.5 % slope, a
displaced threshold uphill, a stand + taxi-out + pattern by hand, a hangar anchored to the apron, a
windsock, PAPI on one end; `sitePatternIssues` empty, the pilot completes the circuit headless) ·
**the mine + tram** (the Kennecott theme on a spur, a flatten under the works, the two stations 30°
apart and LINKED, the mill's conveyor to the receiving shed astride the road; link solved, shed
straddling, yard flattened) · **a totem park** (a park zone on a plot, the footprint flattened to its
level, its treeline as a species polygon; poles on the plateau, no tree inside the arc) · **a
lakeside strip** (World A, one end 6 m above the other — the one-way strip; a lake polygon raising
the water locally; an approach exclude; live vs baked agreement, the approach clear 30 m either side).

---

## 9. RISKS, AND WHAT MEETS THEM

- **Live re-sow cost.** A zone re-plans plots, houses, fences, lots, trees; the village's full build is
  hundreds of ms. Re-sow only the touched zone; cache finishes and materials; show the plot outlines
  at once and let the houses arrive two per tick; the record's `overrides` keep a hand-fixed plot
  through any re-sow. Measured in the plaque.
- **Polygon editing UX.** One polygon tool shared by every section (the same handles, the same keys);
  self-intersection refused at draw time; constant-size handles in the map camera; brush painting
  deferred with bushes and grass.
- **Hit-testing on a 1 m mesh.** The analytic march, never the mesh; bbox pre-tests for objects.
- **The pane's dead rAF.** The watchdog pump and render-on-dirty; `?probe=1` for headless frames;
  the sink for screenshots.
- **GATE WORLD silence.** No terrain mutation anywhere; one seam, dead when empty; the `#chk`
  agreement line is a gate line, so a physics / picture drift fails loudly.
- **Coordinates die at W5.** The record's local frame + anchor (contract §1.5); GATE PREMISES
  re-anchors each fixture on load and asserts the place still sits on land.
- **The ONE EDITOR ruling.** §7.

---

# APPENDIX A — THE SPLIT: sessions, ownership, landings, unify, port

### A.1 The rulings (2026-09-13)

- The tram and the factory stay with the running session **"Wooden house generator for flydiy"**
  (the village-tram worktree `D:/Dev/wt-village`). It finishes its work on the tram AND the mill, then
  LANDS (A.3 is its landing), then the user stops it and relaunches dedicated sessions (cable-car
  motion, the mill continued) off the new master. Until that landing, nobody else touches
  `_house_gen.js`, `_village_gen.js`, `_tram_gen.js`, `_village.html`, `_village_check.js`.
- **The factory = the Kennecott mill extended**: power house, crusher, ore bins, the full aerial
  tramway to the mine adit — the conveyor and the cable links exercised on ONE site. Not a cannery,
  not a generic kit.
- What starts NOW in parallel: the totems + props session (a worktree off master; the "Totem mesh
  asset integration" session can be relaunched for it) and the editor session (the shared tree, new
  files only). Their CATALOGUE blocks in the hot generators wait for the landing; derived entries
  carry the editor until then.
- The contract freezes when `PREMISES-CONTRACT-2026-09-13.md` is committed (T1); sessions write their
  CATALOGUE blocks last, against v1.

### A.2 The sessions

| session | subject | where | branch / port | owns |
|---|---|---|---|---|
| **cable car** | NOW the house session. AFTER its landing, a dedicated one: `src/viewer/tram_run.js` per TRAM-MOTION §7 (pure `pose(line, s)` + a thin `attach`), the ropes drawn, GATE VILLAGE 18, `TRAM_GEN.CATALOGUE` (`hooksOf(built)`, the cable link) | worktree `D:/Dev/wt-village` | `village-tram` now; `tram-run` off the new master later / 8392 `flydiy-village-safe` (exists) | `_tram_gen.js`, `tram_run.js`, `_house.html`, `cabin.js`, `src/cabin/*`, TRAM-MOTION; `_house_gen.js` + `_village_gen.js` until the landing |
| **factory = the mill extended** | NOW the house session. AFTER the landing, a dedicated one: the mill gains its power house, crusher, ore bins and the tramway to the adit; the conveyor link (`tramTo` generalised) and the cable link both exercised; `HOUSE_GEN.CATALOGUE` entries for the mill's parts (kind `complex`); GATE HOUSE rules | the house worktree now; `git worktree add -b mill D:/Dev/wt-mill master` later | `mill` / 8395 `flydiy-mill` | `buildMill` / `buildComposite` in `_house_gen.js`, the `kennecott` THEME, `_big_gen.js` `mine shop`; no new generator file unless the tramway outgrows the composite |
| **totems + props** | the park on a plot (`totemPlot` wired into the village, VILLAGE 20), props / billboards / yard kits as placeables with LOD ladders (`prop_lod.js` LEVELS), `TOTEM_GEN.CATALOGUE` + prop entries | `git worktree add -b totem-park D:/Dev/wt-park master` (+ a junction for the gitignored `bench/`: `cmd /c mklink /J D:\Dev\wt-park\flyDiy\bench D:\Dev\DeGaRoR.github.io\flyDiy\bench`) | `totem-park` / 8398 `flydiy-park` | `_totem_gen.js`, `_totems.html`, `_totem_check.js`, `_props.html`, `_prop_check.js`, `props.js`, `prop_lod.js`, the python tables, `src/props|totems/*`, `_media_check.js` |
| **editor** | the two docs, then the bench (`_premises*`), GATE PREMISES, the showcase record, `premises_perf.js` | the SHARED tree (new files only) | master / 8401 `flydiy-premises` | `tools/_premises.html`, `_premises_gen.js`, `_premises_ui.js`, `_premises_draw.js`, `_premises_check.js`, `tools/premises_perf.js`, `tools/fixtures/premises_*.json`, both docs |

Shared hot files and the rule for each (exact-string edits at NAMED anchors; nobody rewrites):
- `_village_gen.js`: the mill inserts under `const THEMES = {`; the park inserts its call right after
  `if (site) placeSite(vil);` and new functions right before `window.VILLAGE_GEN = {`; exports as
  separate `window.VILLAGE_GEN.x = x;` lines; the export literal is never edited; `tramLine` is the
  cable car's.
- `_village.html`: every new `<script>` tag right before `<script src="_village_gen.js">`; one
  self-contained `if (window.X_GEN) { … }` block per session in `build()`; the two `h.gen === 'big'`
  dispatch lines become a table (the mill session).
- `_village_check.js`: sections assigned now — cable car 18, mill 19, park 20 — at distinct anchors;
  the vm loader list gains one entry per session before `'_village_gen.js'`.
- `run_gates.js`: one row each (`FACTORY` after VILLAGE if a `_factory_check.js` ever exists;
  `PREMISES` after SITE).
- `.claude/launch.json`: shared tree ONLY (worktrees are CRLF), one entry before the final `]`, never
  a rewrite, never from Python.
- `HANDOVER.md`: append-only at EOF, committed as HEAD blob + own append; provisional numbers never
  written as digits — session tokens `GTRAM / GMILL / GPARK / GPREM` in code and drafts, mapped at landing.
- Generated outputs (`flight_core.js`, `index.html`, `dev.html`): never in a source commit.

### A.3 The landing recipe (the house session first; every landing after it the same)

Not a fast-forward: on a shared checkout, moving master's ref alone leaves the working tree showing
the branch as N reverts and the shared index holding stale blobs. Instead — content into the working
copy first, the commit from those blobs, then the ref, then the index:

1. Read the number at that instant: `grep -n "^## G" flyDiy/HANDOVER.md | tail -1`, the same on
   `master:flyDiy/HANDOVER.md`, `grep -rn G<n> flyDiy/src flyDiy/tools`. (353 was free on 2026-09-13.)
2. `git diff <base> <branch> -- <the paths except HANDOVER.md> > <scratch>/x.patch`; renumber the
   provisional tokens on the `+` lines only.
3. `git status --short -- <paths>` in the shared tree must be empty (a user edit in one of them →
   that file is landed by hand-applied exact edits).
4. `git apply --check <scratch>/x.patch` then `git apply <scratch>/x.patch` (no `--index`, no `--3way`).
5. HANDOVER: append the renamed entry's text at EOF (never a blob copy; the file is 2.6 MB).
6. Screenshots: per-chantier folders during the work; the `lods/<letter><G>_` names only now.
7. The temp-index commit (SHARED-TREE-PRACTICES §2): `GIT_INDEX_FILE=<tmp> git read-tree HEAD`; per
   path `git hash-object -w --path=<p> <p>` + `git update-index --add --cacheinfo <mode>,<sha>,<p>`;
   `write-tree`; `commit-tree -p HEAD`; `git update-ref refs/heads/master <c> <expected-HEAD>`
   (guarded); `git reset -q -- <paths>`.
8. Prove the COMMIT from a fresh worktree: `git worktree add <tmp> master`, `node tools/build.js`,
   `node tools/run_gates.js --no-build --only=<the session's gates>`; `--all` only at the pre-step,
   UNIFY and PORT, one at a time (73 min for GEN alone under load — a timeout is not a verdict).
   `git worktree remove --force` + `prune` after.
9. Re-point the session's worktree to a fresh branch off the new master (never rebase the old
   branch: its patch-id differs by the renumber).

Landing order: the house session (tram + mill) → the park → the dedicated cable-car and mill sessions
in whichever order they finish → the editor's bench whenever green (new files only, never a conflict).

### A.4 UNIFY (the editor session, after the third landing)

Pull the union catalogue (`PREMISES_GEN.collect`) — no editor edit needed, and `git log` proves it
(contract rule 13); GATE PREMISES over every entry; the SHOWCASE record
(`tools/fixtures/premises_showcase.json`: the harbour + a village zone + the mine site + the tram
link + the park + a strip) authored in the bench with its screenshot pairs; `tools/premises_perf.js`
in the `tree_perf.js` style (headless Chrome via CDP, a fresh profile, the settle rule, 120 frames ×
station × LOD policy, `--compare`, `tools/perf/premises_perf.json`) — a measurement, not a gate, whose
numbers this document then quotes against the plaque; `--all` green on a proof worktree.

### A.5 PORT (one session, sequential, after UNIFY)

1. `src/world/`: the generators moved from `tools/` (`house_kit, house_gen, shed_gen, big_gen,
   tram_gen, totem_gen, village_gen` — no underscore, dual export kept); a `MANIFEST.world` slot in
   `build.js` emitted as `<script src>` refs like the props packs; the benches' and the gates' loader
   lists re-pointed. Gates BUILD, MEDIA, UISMOKE, HOUSE, VILLAGE, TOTEM, PROPS. Nothing renders yet.
2. `src/core/27_premises.js` = `_premises_gen.js` moved, in `MANIFEST.core` after `26_hangar_fit.js`;
   `90_node_exports.js` gains its exports; `makeWorld(seed, { premises, catalogue })` with the
   contract's three hooks — `premises == null` byte-identical (GATE WORLD's base golden must not move;
   a second golden for seed 0 + the showcase); `W.aerodromes` += premises runways; `AIRFIELD_SITES`
   slots fed from premises sites; `site.pattern` verbatim. Gates WORLD, HYDRO, BIOME, SETTLE, AERO,
   SITE, HONEST, TAKEOFF.
3. `src/viewer/render_premises.js` = `_premises_draw.js` moved: called from `buildWorldScene` after the
   settlements block, guarded by `world.premises`; the ropes via `tram_run.js` ticked from the world
   clock in `app.js`; lights / smoke / people from the published slots against the budget; the LOD
   ladders. Gates WORLDRENDER, UISMOKE, MEDIA, BUILD.
4. `src/viewer/premises_ui.js` mounted on the WORLD rail entry (both rails); the F8 sections it hosts
   move; `dev_panel.js` keeps the rest; the record in `flydiy.premises` + JSON. Gates GFX, UISMOKE.
5. GATE WORLD golden re-capture only for the new fixture; `--all` for the delivery.
6. Out of the port: the island data (U1), the quadtree (W2), the BAKED mode of the modifier layer
   (live only until W2; GATE PREMISES 12 already guards the agreement), island-scale nomination (W6).
   The honest cost at W5 is answered by the anchor (contract §1.5).

### A.6 Timeline and dependencies

T0 the house session lands (tram + mill) → T1 the contract freeze (this commit) → T2 the park lands
→ T3 / T4 the dedicated cable-car and mill sessions land → T5 UNIFY → T6 PORT. The editor's bench
lands whenever it is green, independent of T0-T4 (new files only). Each landing is sequential; the
guarded `update-ref` resolves any race by failing.

### A.7 Risks specific to parallel work

G-number races (tokens, the number at landing, the guard; a sibling's HANDOVER heading counts as
taken) · HANDOVER sweeps (the editor session is the only shared-tree session and commits HANDOVER as
HEAD blob + its own append; worktree sessions cannot sweep) · `launch.json` CRLF (shared tree only;
`git ls-files --eol` shows `w/lf` after an edit) · generated outputs dirty in every worktree (never
`git add`) · the battery under load (`--only=` during development; `tasklist | findstr node` before a
`--all`) · the pane's dead rAF (every bench pumps its own tick; the tram's "runs" toggle must not rely
on rAF) · same-anchor edits (worktrees isolate them; a `git apply --check` failure at landing is
re-derived as an exact-string edit, never a file overwrite) · `bench/` absent from worktrees (the
junction) · leftover worktrees (`wt350`, `wt351`, `aw352`, `wt5`, `zz-wt`, `strange-moser`: each owner
removes its own) · the headless stub (`_village_check.js`'s `makeTHREE()` has no Vector3 / Object3D —
the tram runner and every link solver stay pure so the gates stay headless, which is also the port's
precondition).

## 10. THE GAME UI (G398, as landed)

The user (2026-09-14): "a phase of UI polishing. Proper menus, in the current style. Treat this as game
interface and reuse the proven components. Nothing overflows, everything readable, consistent with the
existing." What landed:

- **Inside `#ui`.** `#premView` (the mouse sheet) and `#premPanel` (the plate) are children of the
  flight screen's `#ui`, so the flight's scoped resets and palette apply. Nothing is styled inline any
  more: flight.css section 9 owns the look. The panel is a plate standing the right edge (22 px in,
  18 px top and bottom, 392 px wide) with a header (WORLD EDITOR · the section · the way back as a pill),
  then the section rail and the inspector side by side; only the inspector scrolls.
- **The flight chrome steps aside.** `body.premOpen` hides the brief, the PFD, the verbs, the ribbon and
  its flyout while the editor is open - it pauses the flight and owns the mouse; the way back is the
  header's pill or the WORLD flyout's after it. Nothing shows through the sheet any more.
- **The flyout's grammar, reused.** The section rail wears `.flRailBtn`'s rules (50 px column, an svg
  icon in the ribbon's 18 x 18 stroked grammar - the module's `ICONS` - and an 8 px uppercase word; the
  lit one on `--ed-acc`). The inspector's rows are the flyout's `.fr` (11.5 px Plex, the key 104 px with
  an ellipsis, the value 48 px right). Every control is the flyout's own: the row builders in
  `premises_host.js` give the slider `.frng`, the select `.fsel`, the switch `.fsw` (with its on/off
  word), every button `.pill`; a new `rows.pills` is a pill row (the look, the theme, the palette's
  category). The tool strip is a plate of pills top-left; the checks and the plaque are glass plates
  (`--fl-glass`) that are read through; the camera word is a 9 px uppercase caption bottom-centre.
- **Nothing overflows.** Section heads, keys, the help and the status are single lines with an ellipsis;
  notes wrap anywhere; the profile graph is 100 % wide; long labels carry their full text in `title`;
  the strip's width is capped at the sheet's; the plaque and the checks at fractions of it.
- **The bench is unchanged in look**: the same classes, styled the bench's way by its page.
- **The theme, the categories, the look, the shoulder**: contract v1.10. The SITES palette groups by
  category (pills, then the select of that category's presets); a zone shows what it draws from as
  pills to toggle; the runway inspector has the look pills over the class it proposes; the selected
  strip is outlined with its shoulder - the radius of terraforming.
- **Owed**: the F8 rows the design gives the editor (forest fill / LOD, the light rig, frame, camera) are
  still on F8; the world's own trees do not follow a live edit; the premises' trees are not planted in the
  game; the shed rail has no WORLD entry; a polygon's falloff band is not outlined (the strip's is).
