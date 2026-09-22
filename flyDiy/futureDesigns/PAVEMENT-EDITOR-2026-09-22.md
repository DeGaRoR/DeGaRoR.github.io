# THE PAVEMENT IN THE WORLD EDITOR — an integration study (2026-09-22)

The bench (`tools/_pavement.html`, `src/viewer/pavement.js`, PAVEMENT-2026-09-21.md) is judged;
the user: "spend the next session studying how to integrate these new settings in the world
editor". This is that study: what the premises record and the editor carry today, what the
pavement needs from them, the smallest contract amendment that carries it, where each renderer
changes, what the gates hold, and the order of work. Nothing here is implemented.

## 1. What the record and the editor carry today

| entry | fields (27_premises.js) | the editor's rows (premises_ui.js) |
|---|---|---|
| ROAD | `id, pts, w, cls (gravel / paved / track / path → ROAD_CLS surface), graded, falloff, grade, ribbon, traffic` | width · class · graded · **"shoulder (m)" = `falloff`** (the TERRAFORMING feather) · steepest % · drawn as a ribbon · traffic |
| RUNWAY | `RUNWAY_DEF`: `len, wid, hdg, surface, look (RUNWAY_LOOKS: grass / none / asphalt / concrete / worn / gravel → a SET key), slope, crossfall, disp, papi, falloff, site, pattern, stand, taxiOut, profile, approach, hangar, circuit` | name · length · width · heading · **look** pills (propose the class) · wheels feel · approach · profile graph · **"shoulder (m)" = `runwayShoulder(e)`** (the terraforming feather, 40 + 6 % of the length) · lights · stand / taxi / hangar |
| MATERIAL polygon | `poly, set, tile, fade, z` (four slots, albedo only, mixed ahead of color_fragment) | set · tile · fade · priority |
| SURFACE polygon | `poly, surface, z` (what the wheels feel — physics) | surface · priority |

How they are drawn now: a road = a flat-tone Lambert ribbon (`render_premises.js` buildRoads,
ROAD_TONE per surface); a runway = a draped Lambert plane with `mkLook`'s one tiled diffuse and
`mkTex('marks')`'s canvas (`render_world.js` standStrip), or, in the bench renderer, its paint over
the composed ground; a taxiway is a road with `ribbon: false` under its own material polygon
(Jolene's `m_taxi_ne / m_taxi_e`, set `cracked`); Jolene's cleared bands are `m_sh13 / m_sh02`
material polygons (set `dry`) over `y_sh*` surface polygons (gravel, the wheels' class).

TWO WORDS COLLIDE. The editor already says "shoulder (m)" for the terraforming feather (`falloff`,
on roads and strips), and the bench says "shoulder" for the drawn band beside the pavement. They
are different things — one moves the ground, the other paints it — and the record must keep them
apart: the pavement's drawn band is called the BAND here and everywhere in the port.

## 2. What the pavement needs from a record entry

`PAVEMENT.make` wants a CLASS (concrete / asphalt / gravel / dirt / sand / grass), a SEED, the
MARKS (a runway's from `sitePaintStrip`, a road's by class), and the geometry wants `len / wid`
(or the polyRoad), a BAND width and the composed ground. Everything else is the RECIPE (63 knobs)
— and the bench showed that only a handful of them are ever per-entry: the paint's age, the crack
amount, the rubber, the lane width, the wet, the band. The rest are the material's own character
and belong to the premises (or the world), not to a strip.

Three levels, each a partial object laid over the one below (the garage's `resolveSpec` idiom —
nulls mean "the level below"):

1. `PAVEMENT.RECIPE` — the module's defaults (the bench's judged values).
2. `rec.pavement` — the PREMISES' recipe (Jolene's WWII concrete character; `wet` from the day
   later; a premises on the tundra with greyer gravel).
3. the entry's `pav` — a strip's or a road's own overrides (`paintAge 0.9`, `rubberK 0`,
   `laneW 6.1`, `band 40`).

## 3. The contract amendment — v1.16 (one amendment, all optional, no migrator needed)

```js
roads[]:   { ..., look: 'gravel' | 'asphalt' | 'concrete' | 'dirt' | 'sand' | 'grass' | null,   // null = derived from cls
             band: number | null,                       // the drawn band beside the pavement, m; null = the look's default
             pav: { paintAge, crackK, rubberK, laneW, wet, marks: 'auto' | 'none' | 'edges' | 'centre' } | null }
runways[]: { ..., look: <RUNWAY_LOOKS key, grows: 'dirt', 'sand'>,   // a look = a pavement CLASS + a recipe PRESET
             band: number | null,                       // the cleared / gravel band beside the strip; Jolene 13/31: 40
             pav: { ...same keys... } | null }
rec:       { ..., pavement: { ...partial PAVEMENT.RECIPE... } | null }
```

`RUNWAY_LOOKS` grow two fields and two rows:

```js
grass:    { name: 'grass strip',   surface: GRASS,  cls: 'grass',    preset: null },
none:     { name: 'markings only', surface: null,   cls: null,       preset: null },      // no pavement mesh: the marks alone (kept)
asphalt:  { name: 'asphalt',       surface: PAVED,  cls: 'asphalt',  preset: null },
concrete: { name: 'concrete',      surface: PAVED,  cls: 'concrete', preset: 'fresh' },   // crackK 0.1, paintAge 0.3, laneW 7.5
worn:     { name: 'old concrete',  surface: PAVED,  cls: 'concrete', preset: 'worn' },    // crackK 0.6, paintAge 0.9, mossK 0.7, rubberK 0 (WWII)
gravel:   { name: 'gravel',        surface: GRAVEL, cls: 'gravel',   preset: null },
dirt:     { name: 'dirt',          surface: GRAVEL, cls: 'dirt',     preset: null },      // no DIRT in the SURFACE enum: gravel's friction
sand:     { name: 'sand',          surface: SAND,   cls: 'sand',     preset: null },
```

`ROAD_CLS` stays the physics word; a road's look derives from it when null: `gravel → gravel`,
`paved → asphalt`, `track → grass` (a track is worn tracks in the world's grass — the bench's grass
class draws exactly that: transparent but the wheels' wear), `path → grass`. A `cls: 'paved'` road
that should be concrete (Jolene's taxiway V) says `look: 'concrete'`.

The `set` keys the old looks named (`brushed`, `cracked`, `pebble`) stop mattering: a look is a
class + preset now; `PAVEMENT.PRESETS` holds the presets (the bench's export shape).

The BAND's default is the class's (`CLASS_DEF[cls].band`: concrete 4, asphalt 1.5, gravel 2.5,
dirt 1.5, sand 1, grass 0; a road's is capped at 1.2 by `make`). The MESH shoulder is derived, not
authored: `shoulderW = band + fadeW` (the fade past the band), never wider than the terraforming
`falloff` — the alpha reaches the terrain exactly where the ground is the terrain's again.

The MARKS: a runway's stay `sitePaintStrip`'s rules through `marksOf` (the one source of truth;
`none` still means the marks alone on the bare ground, the mesh not stood); a road's are
`roadMarks(len, w, look)` unless `pav.marks` says otherwise.

## 4. The editor's rows

RUNWAY inspector (after `look`): the `look` pills grow `dirt` and `sand` (each proposes its
class through `surface` as today); a **band (m)** slider (0–60, "the cleared or gravelled band
beside the strip; 0 = the look's default"); a collapsed **WEAR** section with the five per-entry
knobs (paint age · cracks · rubber · lane width · wet), each "the premises'" until touched (the
`rules` idiom of the zones: touched → `pav.key`, a button "back to the premises'"). The
terraforming slider is relabelled **terraformed to (m)** so the two shoulders never share a word.

ROAD inspector: a **look** select (derived / gravel / asphalt / concrete / dirt / sand / grass),
**band (m)**, the same WEAR section (rubber hidden: a road has none), **marks** pills (auto /
none / edge lines / centre line); `drawn as a ribbon` stays (a `ribbon: false` road draws no
pavement — the taxiway-under-a-polygon case still exists for a hand-painted apron).

PREMISES panel (the record's own section): a **PAVEMENT** subsection = the bench's knob table,
generated from one shared `PAVEMENT.KNOBS` list (label, min, max, step — moved out of
`_pavement.html` into `pavement.js` so the bench and the editor cannot drift), writing
`rec.pavement`; `default` clears it; `paste a bench export` fills it (the bench's `export`
button prints exactly this object).

Every row edits through `edit(id, layer, mut, label, key)` as the others do: the undo stack and
the dirty tracking come for free; `dirty.layer === 'roads' | 'runways'` rebuilds that entry's
mesh alone (§5).

## 5. The renderers

`render_premises.js` (both the bench renderer and the game): `buildRoads` stands
`PAVEMENT.roadGeometry(THREE, { road: PG.polyRoad(rd.pts, rd.w), w, shoulderW, cls, seed:
hash(rd.id), toWorld: F.toWorld, heightAt })` + `PAVEMENT.make(THREE, { lib, cls, marks, road:
true, recipe })` in place of the ROAD_TONE ribbon; the wear canvas stays for the ground under it
(the game's `uWear` tints the patch — a road's own pavement now covers it; the tint remains the
"worn ground" beside a track). One mesh per road, `renderOrder` 3, the strip's 2; `shoulderK`
= 0 where a road crosses a strip's box (the bench's rule, from `runwayBox`). `buildRunways`
in the game does nothing today (the world paints every strip); the bench renderer's strip paint
becomes a PAVEMENT strip too, so the editor shows what the game will.

`render_world.js` standStrip: `PAVEMENT.stripGeometry` draped on `world.terrainH` (+ the W13.2
patch logic untouched) + `make({ lib, cls, marks: PAVEMENT.marksOf(siteRunway(a),
sitePaintStrip), recipe })` in place of the two Lambert meshes; `mkLook` and `texes.marks`
retire; `look === 'none'` keeps the marks-only mesh (the transparent canvas of today, or a
PAVEMENT strip whose base alpha is 0 — the grass class's construction already does that).
`repaintStrips` disposes through `PAVEMENT.dispose`. The lights, sock, PAPI, patch: untouched.

THE LIBRARY: `PAVEMENT.library(THREE, keys)` once per page from `keysFor(the classes the record
uses)` — Jolene: concrete + asphalt + gravel + grass = ~16 layers × 2 arrays × 1 MB. A record
edit that brings a NEW class rebuilds the arrays (rare; a second of decode). The two arrays are
the material's only samplers: its program is its own, the island's ground programs (10/14/15 of
16) are untouched — but `tools/sampler_census.js` runs on the Jolene page before the landing
regardless, and the premises patch's Lambert twin rule stands.

`build.js` MANIFEST: `pavement_tex.js`, `pavement.js` after `site_ground.js`, before
`render_premises.js`. `_media_check`: the manifest is listed already; the payload grows by the
two scripts (~48 KB) — the budget line moves.

THE RECIPE'S RESOLUTION lives in one place: `PAVEMENT.resolve(entry, rec)` → the merged recipe
+ class + band + marks, read by both renderers and by GATE PREMISES — never two copies of the
three-level rule.

## 6. Jolene (tools/jolene_author.py) after the port

13/31 and 02/20: `look: 'worn'`, `band: 40`, `pav: { rubberK: 0, laneW: 6.1 }` (the WWII lanes;
a jet never landed there); the `m_sh13 / m_sh02` material polygons RETIRE (the band draws the
cleared ground with its vehicle paths) — the `y_sh*` surface polygons STAY (the wheels still feel
gravel there). The taxiway V: `look: 'concrete'`, `ribbon: true` (the pavement), `band: 3`; the
`m_taxi_*` polygons retire; the `y_taxi_*` stay. Airport Rd: `look: 'asphalt'`? — it is gravel in
the photographs: stays `gravel`, `band: 1.5`. The village streets: gravel. The hill strip: `look:
'gravel'`, `band: 4`. `r_strip` (the track to the hill strip): `cls: 'track'` → grass with worn
tracks, as the photographs show a two-rut track through the muskeg.

## 7. What the gates hold

- GATE PREMISES (contract §6) grows three rules: a look names a class in `PAVEMENT.CLASSES`
  (or null on a road); `band` ≥ 0 and ≤ the terraforming `falloff` (a band past the feather
  would fade onto ungraded ground); every key in `pav` / `rec.pavement` is a `PAVEMENT.RECIPE`
  key with a finite value. `resolve` is what it reads.
- GATE PAVEMENT (core) stays as it is: the builders, the recorder, the hook rules, the recipe.
- GATE WORLDRENDER / SITE: the analytic HOME still stands (its own painter, no record), the
  premises strips through PAVEMENT — the stood-object census counts one mesh per strip, none per
  `none`.
- GATE MEDIA: the manifest already listed; the budget line.
- `_gfx_check`: a GFX preset row `pavement: full | plain` (plain = hex tiling off, the imprint
  off, the normal strength 0 — a cheap far-tier for the low preset; the bench's `hexOn` knob
  proved the plain path draws).
- The rig's `--gate` (tiling score, far-tier albedo) stays the bench's; the game is judged by
  `island_shot.js` at the taxiway-V junction and down 13/31 from the cockpit (the two shots the
  reference photographs are).

## 8. The order of work for the port session

1. `pavement.js`: `KNOBS` (the bench's table), `PRESETS` (the bench's exports for `worn`,
   `fresh`), `resolve(entry, rec)`; the bench reads `KNOBS` (no drift).
2. `27_premises.js`: `RUNWAY_LOOKS` rows (`cls`, `preset`, `dirt`, `sand`), `RUNWAY_DEF.band /
   pav`, the road's `look / band / pav`, `resolve`'s inputs published on the composed objects
   (`O.roads[].pav`, `O.runways[].pav`); contract v1.16 appended.
3. `render_premises.js` buildRoads → PAVEMENT; the bench renderer's strip → PAVEMENT; the
   library per page; `dirty.layer` rebuilds one entry.
4. `render_world.js` standStrip → PAVEMENT (mkLook / marks retire); `repaintStrips`.
5. `premises_ui.js`: the rows of §4; the relabel.
6. `jolene_author.py` §6; the fixture regenerated; `island_shot.js` at the two eyes.
7. `build.js` MANIFEST; `_media_check`; `sampler_census.js` on Jolene; `premises_perf` /
   `frame_perf` before and after (a 2.3 km strip is one draw of ~300 k triangles at 6 × 3 m —
   `resU 6` in the game, the bench's 4 × 2 was for the eye); GATE PREMISES rules; the battery.
8. HANDOVER's G-entry (this study's rulings in it); the memory.

## 9. What the bench taught that the editor must honour

- A road's band is not a runway's: capped (1.2 m) and crushed stone, or it reads as a halo.
- A concrete road is two lanes with one subtle centre joint; the runway's lane logic on a 6 m
  road drew a split.
- A grass road is the world's grass: the mesh is opaque only where wheels wore it.
- The alpha fade starts right past the band and always fits inside the shoulder; the ground
  under the fade is the world's, never a grass of the mesh's own.
- The soft construction is width-relative (a 2.5 m track keeps its ruts inside itself); the
  editor's sliders may go down to 1.5 m roads and 4 m strips.
- The far tier is the same set — the near/far albedo gate is the proof the port must keep
  green (`pavement_shot.js --gate`), and the game's log depth is what keeps a 7 cm decal drawn
  at 3 km.
- Loose sets need their scan's lean and tone drift removed at import (the importer does; a
  set added later must go through it, never straight into the manifest).
