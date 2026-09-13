# PREMISES-CONTRACT — the record the world editor writes, and the entry every asset session delivers
### (2026-09-13, from the user's brief: "the asset detail sessions will provide their assets through a contract")

STATUS: **v1 — FROZEN at commit.** The cable-car, factory (the Kennecott mill extended) and
totems/props sessions build against this; the editor session consumes it. Changes after the freeze
are APPENDED as `v1.x` amendments in §9, never edits to the tables above them. The bench that reads
it: `tools/_premises.html` (PREMISES-EDITOR-2026-09-13.md).

THE USER'S ASK (2026-09-13): *"We'll need a structure for invoking these in game, an editor prototype,
where zones can be defined, and specific buildings placed, basic roads traced. […] decide a way we
can control the sowing of these accurately (the idea of dual system zoning with auto construction,
and dedicated buildings sounds good. Yet dedicated buildings are complex, since they involve
connected separate buildings, connected through conveyors in the case of the factory, and cables for
the cable car. This will need to be dynamic. […] the asset detail sessions will provide their assets
through a contract. Let's do first a bench of the editor, into its own session, and a contract
proposal."*

WHAT IT RELATES TO:
- `WORLD-CONTRACT.md` — the world is a pure, deterministic data API with no THREE types; this document
  keeps that rule for everything the editor writes.
- `WORLD-V2.md` §6 (the modifier layer: flatten / grade / ramp / surface / material / exclude /
  objects, live and baked modes that must agree) and §7 (zones are data) — the record's terrain layers
  ARE §6's typed list; §6.3's agreement is GATE PREMISES rule 12.
- `ROADMAP.md` Phase 4 (LITTLE AIRPORTS) items 1-3b — "the editor may only ever write modifier
  records; physics and renderer must agree in the same frame".
- `TRAM-MOTION-2026-09-13.md` (village-tram branch) — the first LINK solver, `tramLine`, and the
  `stats.station.hooks` it reads.
- `tools/_village_gen.js` — `THEMES` / `placeSite` (the seed of a SITE), `makePlots` (the seed of
  SOWING), `polyRoad` (the road frame), `mulberry32`; `tools/_totem_gen.js` — `totemPlan.footprint`
  ("the park publishes the shape; the world owns the height", the ruling every `flatten` entry follows).
- `src/core/25_airfield.js` — `AIRFIELD_SITES` (the null slots M1..M3 = the granting hook),
  `sitePattern` (an authored `site.pattern` returned verbatim = the editor's write slot),
  `sitePatternIssues` (the validator).
- `src/viewer/garage.js` `envelope`/`unwrap` and `src/core/60_gen_spec.js` `GEN_MIGRATORS` — the
  save/migrate pattern mirrored here.

---

## 0. THE PRINCIPLE, IN FIVE RULES

1. **The record is data.** No function, no THREE type, no mesh. Every height is RELATIVE to the base
   ground at the premises' anchor. A record is what the editor saves, what the game loads, what a
   gate composes headless.
2. **The editor writes records; it never mutates terrain.** Terrain, surface, trees, roads and
   runways are all reached through modifiers composed at ONE seam in `20_world.js`, dead when no
   premises is loaded — so GATE WORLD's goldens do not move (ROADMAP Phase 4 §3).
3. **A generator publishes; the world places.** A generator draws its building in its OWN frame from
   `P` and `P.ground(lx, lz)`; it publishes its footprint, its ground need, its hooks, its lights /
   smoke / people. Where it stands, what is flattened under it and what connects to it are the
   record's business, never the generator's.
4. **Connections are LINKS, and links are solved.** A link names two hooks by (item, hook name) and a
   kind; a solver per kind turns them into geometry and `P` patches; moving either end re-solves.
   `tramLine` (the cable) and the mill's `tramTo` (the conveyor) are the first two solvers, taken
   verbatim from the village.
5. **Everything is seeded per element**, so adding, moving or reordering one thing never reshuffles
   another — the author's hand is never undone by a re-sow.

---

## 1. THE PREMISES RECORD

### 1.1 The envelope (the garage's, verbatim in shape)

```js
{ what: 'flydiy-premises', v: PREMISES_V /* 1 */, name: 'kennecott' | null,
  premises: { ...the record... },
  plaque: null | { tris: [lod0, lod1, lod2, lod3], lights, smoke, people, plots, links, measuredV },
  log: { built: null, tests: [], flights: [] } }
```

Rulings carried over from the aeroplane's store (`garage.js` `envelope`/`unwrap`, G63, G190):
what is saved is the record, nulls and all (a null is "derived — keep deriving"); `plaque` and `log`
ride BESIDE the record, never inside it (a measurement is not a design decision); `name` is `null`
when there is no slot, never a placeholder; `unwrap` accepts a bare record; a load REPLACES.
`PREMISES_MIGRATORS = { fromVersion: rec => rec }` lifts one version each, runs before normalise, on
the raw shape the old bench actually saved (`60_gen_spec.js` `genMigrateSpec`'s walk).

### 1.2 The record

```js
premises = {
  v: 1, id: 'kennecott', name: 'Kennecott - the mine', seed: 3,

  frame: {
    kind: 'road' | 'free',
    // 'road' = placeSite's frame verbatim: x is arclength along the anchor road from the anchor,
    //          z is inland along the road's normal THERE (a bend bends the premises with it)
    // 'free' = a rigid frame (x, z, yaw): airfields, harbours, anything that brings its own roads
    extent: { x0, x1, z0, z1 },            // the premises' box in its own frame: the spatial index, the settle exclusion
    anchors: {                             // per WORLD id; the anchor dies with a world, the premises does not
      'W-24km': { x, z, yaw, road: { net: 'stage3', near: [x, z] } | null },
      'ursoy':  null,
    },
  },

  layers: {
    terrain: [                              // WORLD-V2 §6.2, authored; composition order = array order
      { id, kind: 'flatten', poly, level, falloff, abs: false, order },
      { id, kind: 'grade',   pts: [[x, z, y], ...], width, crossfall, falloff },
      { id, kind: 'ramp',    poly, plane: [a, b, c], falloff } ],
    surface:  [ { id, poly, surface: SURFACE.GRAVEL } ],                    // reaches physics (GROUND_SURF row)
    material: [ { id, poly, splat: { gravel: 0.8, grass: 0.2 } } ],         // paint only, never moves anything
    exclude:  [ { id, poly, what: ['trees', 'rocks', 'settle'] } ],
    roads:    [ { id, pts: [[x, z], ...], w: 3.6, cls: 'gravel', graded: true } ],
    runways:  [ { id, name, c: [x, z], hdg, len, wid, surface, elev, kind: 'strip',
                  profile: [[t, y], ...] | null,                            // longitudinal; null = flat (the strip is a PROFILE, ROADMAP P4 §2)
                  site: { hangar, apron, taxiway, fence, stand, taxiOut, ... } | null,  // AIRFIELD_SITES' shape (25_airfield.js)
                  pattern: null | { nodes, arcs, routes, stops, runway, approaches } } ],  // sitePattern's verbatim slot
    zones:    [ { id, kind, poly, density, seed: null, palette: null, rules: {} } ],   // §4
    sites:    [ { id, name, at: { x, z, yaw },
                  items: [ { id, key, x, z, yaw, P: {}, onRoad, bottomOnRoad } ],      // THEMES generalised: an item is a CATALOGUE KEY
                  yard: { x0, x1, z0, z1 } | null } ],
    links:    [ { id, kind, from: { item, hook }, to: { item, hook }, P: {}, dynamic: true } ],   // §3
    objects:  [ { id, key, x, z, yaw, y: null, P: {} },                     // one placed building / prop by hand
                { id, kind: 'tree', x, z, key, size, yaw } ],               // TREE_PLACE's own record (render_world.js)
  },

  budget: { tris: 400000, lights: 24, smoke: 6, people: 40 },               // declared targets; the plaque MEASURES
}
```

Field notes:
- `id`s are stable strings assigned at creation (`z3`, `s1`, `k2`), never re-indexed. Array order is
  composition precedence only.
- A site's `items[].x/z/yaw` are in the SITE's frame (`at`), which is in the premises' frame — two
  nesting levels, no more. Links refer to `(item, hook)`, never to coordinates.
- `runways[]` carries the `W.aerodromes` fields by their existing names so the pilot, `regSurf`,
  `sitePattern` and `placeAtAerodrome` read the composed record untouched.
- `surface` uses the `SURFACE` enum of `20_world.js` (GRASS 0 · ROCK 1 · SCREE 2 · FOREST_FLOOR 3 ·
  WATER 4 · PAVED 5 · GRAVEL 6 · SAND 7); the friction row is `GROUND_SURF[surface]`
  (`00_registry.js`).

### 1.3 The composition order (fixed; a later stage never feeds an earlier one)

```
T0   the host terrain (world.terrainH; on the bench the adapter { terrainH: T.h, waterH: () => T.waterY })
     y0 = T0(anchor); every relative height adds y0
1    AUTHORED terrain modifiers, in array order
2    roads      -> each `graded` road contributes a DERIVED grade (node heights = T1 at its points) + a surface strip of width w
3    runways    -> a DERIVED grade from the profile, a DERIVED surface, a DERIVED exclude(trees, 30 m), an aerodrome record
     = T1
4    surface / exclude polygons registered (queries, not heights)
5    PLACEMENT on T1: sites (placeItem = placeSite's item body, generalised to a catalogue entry)
                      -> zones sown (§4) -> objects
     every placed item whose entry says ground.need:'flatten' appends a DERIVED flatten (level by the entry's rule) + a DERIVED keepOut exclude
     = T2
6    one RE-GROUND pass: every record's y = T2(x, z); ground = T2(toWorld) - y; floorY by the entry's standing rule
     (no iteration: a flatten makes its footprint exactly `level`; two overlapping flattens at different levels are a VALIDATOR error, not a fixed point)
7    LINKS phase A  (needs:'placed'): conveyor, path, pier, roadThrough — they patch P before any build
8    BUILDS         (the caller's build(entry, P, lod): the bench's with a finish, the gate's plain)
9    LINKS phase B  (needs:'built'):  cable — reads built.stats hooks, rebuilds <= 3 passes (tramLine verbatim)
10   MATERIAL last (paint never moves anything)
```

DERIVED modifiers live in the overlay, never in the record. The editor writes ONLY authored records.

### 1.4 Seeding

`seedOf(premises.seed, layer, id) = hash32(seed, fnv(layer + ':' + id))`; each element gets its own
`mulberry32` stream (the village's, `_village_gen.js` ~:518, moved). Per plot:
`hash32(zoneSeed, road.id, plotIndex)`; per house: `1000 + plotSeed` into `placeHouse`'s `seed`.
Consequence: adding a zone or reordering layers never reshuffles another zone's houses (today's
`makeVillage` shares one `rnd`; the sower does not).

### 1.5 The local frame and the anchor — sound, with two constraints

`placeSite` already is it: THEMES items are authored in the road frame and stood on the world by
`road.at(S.t + it.x)`. Generalising that to the whole record answers ROADMAP Phase 4's honest cost
("coordinates authored on the 24 km world die at W5"): only `frame.anchors['W-24km']` dies; the
relative heights and the local coordinates survive; the island gets its own anchor entry.

Constraints: (a) the `'road'` frame shears on bends — it is injective only while `max|z|` over the
extent is below the anchor road's minimum bend radius; `premisesIssues` computes that radius and
REFUSES `'road'` when it is violated (use `'free'`). (b) `y0` is the BASE terrain at the anchor (`T0`,
before any premises modifier), so grading the anchor road later does not move the datum.

---

## 2. THE CATALOGUE ENTRY — what a generator exports

Each generator exports its own catalogue ON ITS EXISTING API OBJECT, so no file is shared between
parallel sessions: `HOUSE_GEN.CATALOGUE`, `BIG_GEN.CATALOGUE`, `SHED_GEN.CATALOGUE`,
`TRAM_GEN.CATALOGUE`, `TOTEM_GEN.CATALOGUE`, `FACTORY_GEN.CATALOGUE` (if the mill's extension ever
outgrows the house composite), each with `CATALOGUE_V = 1` and `CATALOGUE_ALIASES = { 'old key':
'new key' }`. The edit each session makes to a hot file is ONE block, appended immediately before its
own export line (`window.HOUSE_GEN = {`, `window.BIG_GEN = {`, `window.TOTEM_GEN = API`, …), as
separate `X.CATALOGUE = […]` assignments after the export where the export literal must not be edited.

```js
CATALOGUE = [ {
  key: 'house/kennecott mill',        // '<ns>/<preset>' — unique by construction; ns = the generator's
  kind: 'building' | 'complex' | 'park' | 'prop' | 'strip',
  gen: 'HOUSE_GEN', preset: 'kennecott mill', P: {},          // P = overrides the entry always applies

  frame: 'house' | 'park' | 'prop',
  // house: datum at the origin, +z the front / road side, x along L, y up; the world hands in
  //        P.ground(lx, lz) (terrain in this frame, relative to the datum), P.floorY, P.waterY
  // park:  totemPlan's frame + a *Plot(plot, T, o) stand function (the park stands itself on a plot)
  // prop:  propPlace(THREE, key, x, z, ry, y) — the baked origin is where it meets the world

  foot: P => [[x, z], ...],           // CONVEX, CCW, in the item frame, from P ALONE (no build):
                                      // the sower, the flatten and the keepOut need it before anything is built
  keepOut: 3,                         // metres of tree margin round `foot` (placeSite's +3), or a polygon function
  ground: { need: 'none' | 'flatten' | 'level',   // none = stands on posts/plinth over whatever P.ground says (the house)
            level: 'median' | 'high' | 'water',    // flatten = the world owns the height; the entry publishes the shape (the park)
            falloff: 6, standing: 'plinth' | 'piles' | 'slab' },
  size: P => ({ L: P.L, w: P.w }),    // for plot fitting (placeHouse's test)

  hooks:   P => [ { name: 'portal', kind: 'conveyor', p: [x, y, z], dir: [0, 0, 1] } ],   // known from P
  hooksOf: built => [ { name: 'track0', kind: 'cable', p, dir }, ... ],                    // known only after the build (tram: stats.station.hooks)

  lod: { dist: [0, 150, 500, 1500] }, // 4 rungs = the `lod` arg 0..3; triangles per rung are MEASURED by the gate, not declared
  slots: { lights: 'stats.lit.lights', smoke: 'stats.smoke', people: 'stats.people', sign: 'stats.sign', ao: 'stats.groundAO' },
  tags: ['industrial', 'mine'],        // the zone pickers select by tag (§4)
  headless: true, gate: 'HOUSE',
} ]
```

### 2.1 The eight rules a generator must obey (GATE PREMISES rule 3 holds each)

1. **FRAME.** The house convention or one of the two named others. Nothing reads the world — only
   `P.ground`, `P.waterY`, `P.floorY`, `P.*`.
2. **BUILD.** `build(P, lod, F)` for all four `lod` values, under the vm THREE stub
   (`_village_check.js` `makeTHREE()`), returning `{ bags, stats }` with no NaN and no degenerate
   triangle. The same `P` twice gives the same bags (hash).
3. **PUBLISH.** `foot(P)` and `size(P)` from `P` alone; `stats.tris`, `stats.bbox`, `stats.groundAO`
   and every slot the entry names, at the named path. (`stats.footprint` in the house generator is an
   AREA number — hence the polygon is called `foot`.)
4. **HOOKS.** `{ name, kind, p, dir }` in the item frame, names unique and stable across versions. A
   hook that moves with the build (the tram's `lineDeg`) is published by `hooksOf(built)`, never guessed.
5. **GROUND NEED, honestly.** `'none'` stands over whatever the ground does; `'flatten'` means the
   world owns the height and the entry publishes the shape; `'level'` is a flatten to one measured
   corner (a slab).
6. **LOD LADDER.** Four distances, ascending. The gate measures tris per rung; the plaque sums them
   against `budget`.
7. **LIGHTS / SMOKE / PEOPLE are published, not drawn.** `stats.lit.lights[] { p, col, reach }`,
   `stats.smoke { p, ... }`, `stats.people[] { key, x, z, ry }` — the viewer stands them, the budget
   counts them, one switch turns them all.
8. **KEYS NEVER DISAPPEAR.** A renamed preset adds a `CATALOGUE_ALIASES` line. An unresolved key in a
   record skips the item with a ghost box and an issue — never a crash.

### 2.2 Collection, and the derived entry

`PREMISES_GEN.collect(globals)` walks a FIXED generator list `['HOUSE_GEN', 'BIG_GEN', 'SHED_GEN',
'TRAM_GEN', 'TOTEM_GEN', 'FACTORY_GEN']`, reads `CATALOGUE` + aliases, throws on a key collision and
returns `{ entries: Map, byTag, aliases, issues }`. In the browser `globals = window`; in node the
gate's vm context. `catalogueIssues(entry)` validates the shape (convex CCW foot, unique hook names,
four ascending lod distances). The core never imports a generator: `composePremises` takes `cat` and
a `build` callback as parameters.

A generator WITHOUT a `CATALOGUE` yet gets a DERIVED entry per preset (`derived: true`: `foot` =
`P.L × P.w`, no hooks, `ground.need:'none'`, tris from a lod-3 headless build) — so the editor is
never blocked on a session, and a session's first real entry simply replaces the derived one.

---

## 3. LINKS

### 3.1 The solver interface (core, no THREE)

```js
LINK_SOLVERS[kind] = {
  needs: 'placed' | 'built',
  band: { minDeg, maxDeg, maxLen },                                  // where the solver is valid
  solve(link, A, B, ctx) => ({ ok, geom, patch: { [itemId]: { ...P overrides } }, issues: [] }),
  validate(link, sol, ctx) => issues[],
};
// A, B = { rec (the placed record), entry, hook (resolved: p, dir in the item frame), built? }
// ctx  = { T: the overlay terrain, frame: the premises frame, build, roads }
```

### 3.2 The kinds

| kind | needs | taken from | solve | band |
|---|---|---|---|---|
| **cable** | built | `VILLAGE_GEN.tramLine` (village-tram branch) | ≤ 3 passes: read `hooksOf(built)` `track0` of both in the world, take the angle, `patch.A.lineDeg = patch.B.lineDeg = angle`, rebuild; `geom = { angle, ropes: [{a, b, kind}], docks: [{p, yaw, dx, station}] }` — `vil.tram`'s shape verbatim, so `TRAM_RUN.make(geom, cabinsByDock)` (TRAM-MOTION §7) reads it unchanged | 15-45° |
| **conveyor** | placed | `placeSite` (the mill's `tramTo`) | `patch.A.tramTo = toLocalOf(A)(worldOf(B.hook))` with the target height `B.rec.y + B.P.floorY + (B.P.eaveH ‖ 5)`; the mill draws its gallery from `P.tramTo` at build | `|dx| ≤ 60`, `dy ∈ [-30, 40]` |
| **path** | placed | `planPath` | from A's `stair` / `door` hook to a road point (or B's hook); `geom.pts`; no patch | — |
| **roadThrough** | placed | `onRoad` / `bottomOnRoad` | the ROAD record (by id) is re-routed through the item's `in` / `out` hooks (derived pts; the authored road keeps its own) | — |
| **pier** | placed | `pierPlan` | from the stair-landing hook to `shoreDepth` along the item's +z; `geom` = the deck polyline | needs water |

### 3.3 Dynamic

Re-solve on move: the editor marks dirty every link whose `from.item` / `to.item` (or road) moved;
compose re-runs stage 7 for `placed` links (microseconds) and stage 9 for `built` links on drag END
(cable = 2 stations × 3 headless builds, ~100-200 ms, debounced). In the game links are solved once
at compose; nothing per frame except the cabins' motion. Out of band → `ok: false`, the last valid
`geom` kept and drawn greyed with the link red, `premisesIssues` non-empty → the record saves as a
draft, cannot publish, and GATE PREMISES refuses the fixture.

---

## 4. ZONES AND THE SOWING ENGINE

```js
zone = { id, kind: 'residential' | 'commercial' | 'industrial' | 'harbour' | 'park' | 'airfield' | 'forest' | 'clear',
         poly: [[x, z], ...] /* authored, may be concave */, density: 0..1, seed: null,
         palette: ['house/*', 'shed/*'] | null,
         rules: { plotMin: 20, plotMax: 34, plotDepth: 30, gapOdds: 0.18, sides: 'both' | 'left' | 'right' } }
```

`sowPlots(zone, roads, T, cat)` generalises `makePlots` from "one road, arclength" to "every road
inside a polygon":

1. `convexParts(zone.poly)` once (ear-clip → triangles → greedy merge); `inZone = parts.some(inPoly)`.
2. For each road (the premises' roads + the anchor road for a `'road'` frame): `clipPolylineToPoly` →
   arclength intervals `[t0, t1]` inside the zone.
3. Walk each interval EXACTLY as `makePlots` does (frontage `w ∈ [plotMin, plotMax]`, gap odds,
   `t += w + gap`), both sides; `side = 'water'` when `shoreDepth` finds water within `plotDepth`
   (the riparian rule kept), else `'land'`; the fold test, the `|be| < 9` test and the back-in loop verbatim.
4. Reject additionally: any corner outside the zone; inside any exclude / keepOut / runway box;
   overlapping ANY plot sown so far (all zones, in composition order).
5. Emit `makePlots`' record `{ id, side, s0, s1, poly, depth, n, front, tg, w }` + `{ zone, road, seed }`.

Auto-construction: `PICKERS[zone.kind](plots, cat, rnd)` returns `plot.id → catalogue key |
'sampler'`. residential = `HG.randomHouse(seed)` (the sampler, as today) + outbuilding / car / boat
odds; commercial = `civicPlots` + the G312 rule (store / workshop on the land plots nearest the
centroid, the cannery on the widest water plot) reading entries by TAG; industrial = warehouse /
workshop / mine shop / sheds by tag; harbour = water plots first (cannery, net loft, fish shack, over
the water, boat shed) with automatic `pier` links; park = `totemPlot(plot, T, o)`; airfield = no
plots — the runway's `site` items; forest = a DERIVED tree-density modifier; clear = a DERIVED
`exclude(trees)`. **A new generator joins a zone by TAGGING its entries, never by editing a picker.**
Density: `p(build) = density`, `gapOdds = rules.gapOdds + 0.6 · (1 − density)`. Determinism:
`zoneSeed = zone.seed ?? seedOf(premises.seed, 'zone', zone.id)`; per plot
`hash32(zoneSeed, road.id, k)`; per house its own stream into `placeHouse(T, V, plot, seed, rnd)`.

---

## 5. HOW THE RECORD REACHES PHYSICS

`makeWorld(seed, { premises: [rec...], catalogue })` composes an OVERLAY and wires three hooks in
`src/core/20_world.js`:

```js
overlay = { n, terrainH(x, z, h) /* h in, h out */, surfaceAt(x, z) /* -1 | SURFACE */,
            excludeAt(x, z, what), inExtent(x, z), aerodromes: [...], sites: { id: site },
            records: { plots, items, links, trees }, index: SpatialIndex, extents: [...] }
```

- **terrainH** (today `h = tV2(x,z); g = AERO.grade(x,z,h) − h; return h + g·(1 − min(1, _cd/1.5))`):
  becomes `... ; return PM.n ? PM.terrainH(x, z, h) : h;` — with no premises the branch is dead and
  GATE WORLD's goldens hold bit for bit. Modifier maths is C¹ by construction: flatten
  `h += (y0 + level − h) · (1 − smf01(max(0, sdPoly) / falloff))`; grade = `AERO.grade`'s oriented-SDF
  feather per segment with a per-node target height; ramp = a plane target. The spatial index is a
  `Map` keyed `${cx},${cz}` on 256 m cells (`treesNear`'s idiom), each cell listing the modifiers
  whose AABB + falloff touches it: one string key, one `Map.get`, AABB rejects; an empty cell costs
  ~50 ns. WORLD-CONTRACT rule 4 stands (10⁶ calls < 2500 ms), measured half inside, half outside.
- **surface**: `aeroSurfAll` becomes `PM.surfaceAt ?? regSurf ?? AERO.surfaceAt` — a declared polygon
  wins inside itself (the G130 ruling extended). Runways answer through `regSurf` unchanged because
  their record joins `aerodromes`. **Aprons and taxiways stop being decals**: as surface polygons they
  reach `GROUND_SURF`.
- **exclude**: the tree loop gains `if (PM.excludeAt(x, z, 'trees')) continue;`; stage-3 settlement
  boxes inside `PM.inExtent` are dropped from `roadNet.buildings`.
- **runways** → `W.aerodromes` in `24_world_aero.js`'s push shape (`id, name, kind, x, z, hdg, len,
  wid, surface, elev, tdz, spawn, flyIn, dx, dz, feather, bx0..bz1`), so `regSurf`, the decal loop,
  `sitePattern`, `placeAtAerodrome` and the pilots read them untouched; `site` → `AIRFIELD_SITES[id]`
  (the null-slot granting hook); `pattern` → `site.pattern`, checked by `sitePatternIssues` at compose.
- **buildings: NO collision** — the honest cut stays. The solver reads only `terrainH`; a height spike
  under a house would break C¹ and every landing near it. A future `collide` layer is the door.

---

## 6. GATE PREMISES (`tools/_premises_check.js`, headless, `--selftest` turns each red)

1. **ROUND TRIP** — `normalise(unwrap(envelope(rec)))` deep-equals `normalise(rec)`; nulls preserved;
   a bare record accepted.
2. **MIGRATION** — every vintage fixture under `tools/fixtures/premises_v*.json` walks to `PREMISES_V`
   and composes to its frozen record hash.
3. **CATALOGUE** — every listed generator exports `CATALOGUE`; keys unique across generators; aliases
   resolve; each entry's `foot` convex CCW; hook names unique; each entry builds at lod 0 and 3 on
   flat ground and on a 10° slope with no NaN / degenerate triangle and publishes its named slots;
   the same `P` builds to the same hash.
4. **DETERMINISM** — the fixture composes twice to the same records (mm); with the layer arrays
   permuted, each zone's plots and houses are unchanged.
5. **IDENTITY** — with no premises, GATE WORLD's `GOLDEN_GRID` / `GOLDEN_TREES` / `GOLDEN_MEADOWS`
   hold; with the fixture stood far from HOME, the 101² grid hash still holds outside the premises'
   extent and `terrainH` inside HOME's pad is 0.
6. **C¹ AND BUDGET** — finite-difference slope across every falloff band bounded; 10⁶ `terrainH` calls
   < 2500 ms with three premises loaded.
7. **FLATTEN** — every `'flatten'` item has `terrainH` within 1 cm of its level over its `foot`; every
   floor clears its corners.
8. **PLOTS** — no overlap, no fold, inside their zone, outside excludes / keepOuts / runway boxes;
   every item inside its plot (GATE VILLAGE 2-3 restated).
9. **LINKS** — every link `ok`; cable angle in band and rope ends within 1 cm of the hooks after the
   last pass; conveyor endpoint within 1 cm of the target hook in the mill's frame.
10. **RUNWAYS** — `W.surface` answers the runway's surface inside the strip;
    `sitePatternIssues(sitePattern(aero, site))` empty; `placeAtAerodrome(id)` finds it.
11. **EXCLUDE** — no `W.trees` entry inside an exclude / keepOut; no settlement box inside the extent.
12. **BAKED VS LIVE** (WORLD-V2 §6.3) — `bakePremises(overlay, extent, cell = 1 m)` rasters the extent
    to int16 at 1 cm; 10⁴ random points: `|live − bilinear(baked)| ≤ 0.02 + slope · cell / 2`. Today
    both meshes sample the live function; the gate exists now so the future quadtree bake can never
    diverge from it.
13. **THE CONTRACT HELD** (mechanical) — no catalogue key appears as a string literal in any
    `_premises_*` file (the MEDIA orphan-check idiom): the editor accepts a new asset without an edit.

---

## 7. THE WORKED EXAMPLE — Kennecott and the tram, as one record

The village's `THEMES.kennecott` + the branch's tram pair, rewritten in the record's words (the
numbers are the theme's own; `x` is arclength along the spur from the anchor, `z` inland):

```js
{ v: 1, id: 'kennecott', name: 'Kennecott - the mine', seed: 3,
  frame: { kind: 'road', extent: { x0: -60, x1: 60, z0: -20, z1: 130 },
           anchors: { 'village-bench': { x: 0, z: 0, yaw: 0, road: { net: 'shore', near: [0, 0] } } } },
  layers: {
    terrain: [ { id: 'f1', kind: 'flatten', poly: [[-48, -18], [48, -18], [48, 118], [-48, 118]], level: 0, falloff: 12, order: 0 } ],   // the works flat; the theme's `foot: 14` pin becomes this
    surface: [ { id: 'y1', poly: [[-48, -18], [48, -18], [48, 118], [-48, 118]], surface: 6 /* GRAVEL: the yard */ } ],
    roads:   [ { id: 'spur', pts: [[0, 0], [0, 68], [-60, 68], [46, 68]], w: 3.6, cls: 'gravel', graded: true } ],   // spur { in: 68, before: 60, after: 46 }
    sites: [ { id: 's1', name: 'the works', at: { x: 0, z: 0, yaw: 0 },
      items: [
        { id: 'mill',   key: 'house/kennecott mill',    x: -4,  z: 24,  yaw: 0, bottomOnRoad: true },
        { id: 'shop',   key: 'big/mine shop',           x: -34, z: 12,  yaw: 0 },
        { id: 'office', key: 'house/mine office',       x: 22,  z: 9,   yaw: -0.08 },
        { id: 'cot1',   key: 'house/mine cottage',      x: -22, z: 5,   yaw: 0.2 },
        { id: 'shed',   key: 'house/storage shed',      x: 8,   z: 7,   yaw: 0.4 },
        { id: 'bunk',   key: 'house/mine bunkhouse',    x: -32, z: -10, yaw: 3.20 },
        { id: 'hall',   key: 'house/mine dormer hall',  x: -4,  z: -11, yaw: 3.14 },
        { id: 'mess',   key: 'house/mine mess hall',    x: 24,  z: -10, yaw: 3.06 },
        { id: 'cot2',   key: 'house/mine cottage',      x: 40,  z: -9,  yaw: 3.24 },
        { id: 'rcv',    key: 'big/tram shed',           x: 0,   z: 0,   yaw: 0, onRoad: true },
        { id: 'base',   key: 'house/tram base station', x: 20,  z: -30, yaw: 3.14 },
        { id: 'top',    key: 'house/tram top station',  x: 20,  z: 110, yaw: 0 } ],
      yard: { x0: -48, x1: 48, z0: -18, z1: 118 } } ],
    links: [
      { id: 'l1', kind: 'conveyor',    from: { item: 'mill', hook: 'headframe' }, to: { item: 'rcv',  hook: 'gallery' } },
      { id: 'l2', kind: 'roadThrough', from: { item: 'rcv',  hook: 'in' },        to: { item: 'rcv',  hook: 'out' }, P: { road: 'spur' } },
      { id: 'l3', kind: 'cable',       from: { item: 'base', hook: 'track0' },    to: { item: 'top',  hook: 'track0' } } ],
    zones: [], objects: [], exclude: [], material: [], runways: [] },
  budget: { tris: 600000, lights: 40, smoke: 8, people: 30 } }
```

Through the stages: T0 the bench terrain → `f1` flattens the works (the theme's `foot` pin was a
terrain hack; here it is a modifier) → the spur is graded and gravelled → items placed in the site's
road frame (placeItem = placeSite's body) → the mill's entry says `ground.need:'none'` (it climbs the
hill by design) so no derived flatten → re-ground → `l1` patches `mill.P.tramTo` from the shed's
`gallery` hook (phase A), `l2` re-routes the spur through the shed → builds → `l3` reads both
stations' `hooksOf(built).track0`, solves the angle, sets `lineDeg`, rebuilds (phase B) → the plaque
counts. The mill session's extension (power house, crusher, ore bins, the tramway to the adit) is
new ITEMS with new hooks and new LINKS on this same record — the contract's proof.

---

## 8. WHAT EACH SESSION DELIVERS

| session | catalogue entries | hooks | link solver | gate rule |
|---|---|---|---|---|
| cable car (the house session now; a dedicated one after its landing) | `house/tram top station`, `house/tram base station` (kind `complex`) | `hooksOf(built)`: `track0/1`, `haul0..3`, `anchor0/1`, `dock` (from `stats.station.hooks`) | `cable` = `tramLine` moved into `LINK_SOLVERS` (a 4-line wrapper stays in the village) | VILLAGE 18 (the cabins on the ropes) + PREMISES 9 |
| factory = the mill extended (the house session now; a dedicated one after) | `house/kennecott mill` + its new parts (power house, crusher, ore bins, head frame, the adit terminal) as items of ONE site | `hooks(P)`: `headframe`, `powerhouse`, `bins`, `adit`; the receiving shed's `gallery`, `in`, `out` | `conveyor` (from `placeSite`'s `tramTo`) and `roadThrough`; the tramway to the adit is a second `cable` | HOUSE 37 (the staircase) + PREMISES 9 |
| totems + props | `totem/park` (kind `park`, `frame:'park'`, `ground.need:'flatten'`, `level:'median'`), every prop of the three tables as kind `prop` with its LOD ladder from `prop_lod.js` LEVELS, billboards | none (props have no links) | none | TOTEM 7-8 + PROPS + PREMISES 3 |
| editor | `PREMISES_GEN` (the record, compose, sow, links, validator), the bench, GATE PREMISES, the fixtures | — | the registry and the two generic kinds (`path`, `pier`) | PREMISES 1-13 |

Delivery = the block appended before the generator's export line + the gate green from a clean
worktree + a HANDOVER entry naming the keys added. Sessions write their `CATALOGUE` blocks LAST,
after the freeze, against this document.

---

## 9. AMENDMENTS (append-only; each dated, each a `v1.x`)

- **v1.1 (2026-09-13, at the first run of GATE PREMISES on the golden).** Rule 12's tolerance
  is `0.02 m + cell² / 8 · (|h_xx| + |h_zz| + 2 |h_xz|)`, the second differences taken at the cell
  spacing — bilinear interpolation is exact on a plane, so its error is CURVATURE, and a smoothstep
  feather has its maximum curvature exactly where its slope is zero; the `slope · cell / 2` term
  written in v1 was the wrong bound for a lattice-aligned raster. A genuine step still fails (its
  second difference is the step itself, and the bilinear error across it is half the step). Measured
  on the golden: the worst point is a graded road's shoulder (4 m wide, 6 m feather) at 0.12 m
  live-vs-baked at a 1 m cell — a number W2's baker must remember when it decides a road's depth.
- **v1.2 (2026-09-13, at the first strip with a taxi road).** §1.3 stages 2 and 3 swap: the RUNWAYS
  grade first and the ROADS after, with a road's node heights read from the ground the strip already
  graded. Written the other way, a road inside a strip's shoulder (its feather runs 40 m + 6 % of the
  length) was re-graded across by the strip and GATE PREMISES rule 9 found it 2.3 cm off flat; a taxi
  road is on the airfield's ground, not the other way round. The surface strips, the excludes and the
  aerodrome record are unchanged.
- **v1.3 (2026-09-13, from the village session's catalogue blocks on its branch).** Rule 5's
  'flatten' may PUBLISH THE SHAPE beyond the foot: `ground.shelf(P) -> { rect: [x0, zBack, x1, zFront],
  zLevel, marginF, marginB }` in the item's frame (the mill's pad from `millPlan`); the world cuts it with
  `withShelf`'s law - level inside the rect, the base beyond a front margin (front and sides) or a back
  margin, smoothstepped - at the ground `zLevel` ahead along the item's own z, BEFORE the item is placed
  (stage 5 -> T2), so the item's `P.ground` sees the pad. Without a shelf, 'flatten' is the foot at its
  median and 'level' the foot at its high corner (a slab), both with `ground.falloff` as the margin. The
  composer holds these as a derived `shelf` modifier (`makeModifier` kind 'shelf'); GATE PREMISES rule 5.
  A `link.cable = 'VILLAGE_GEN.tramLine'` on the stations names the phase-B solver the composer will call
  with a build callback once the branch lands.
- **v1.4 (2026-09-13, the user: "polygons do not mean squares").** A `foot(P)` is any SIMPLE
  polygon, as many corners as the building needs, concave allowed (an L-shaped house, a mill with its
  wing); "convex CCW" in §2 was the first draft's caution, not a rule. Containment is even-odd everywhere
  (`inPoly`), the keep-out is the foot's bbox + the margin, and GATE PREMISES rule 3 asks only
  `polySimple`. The same holds for every authored polygon: a zone, a flatten, an exclude, an apron are
  free shapes drawn corner by corner; only a sown PLOT is a quad, because a frontage is.
- **v1.5 (2026-09-13, at the village's landing - G366-G369.1 on master).** Three things the landed
  catalogue taught. (a) An entry's `P` is the COMPLETE parameter table `build()` takes - the generator's
  defaults merged with the preset's own - not `{}` with the name left on `preset`: the composer reads
  `P.station`, `P.mill`, `P.stance`, `P.L` before it builds, and a cable's first pass needs a finite
  `lineDeg` (an undefined one overrides the default in build's merge and every hook comes back NaN; the
  solver seeds the band's middle when the entry carries none). (b) A `park` entry does not build, it
  STANDS: `stand` names the function on its generator `(plot, T, o) -> plan` (totemPlot's shape: the
  plan's `lawn` polygon (else its `footprint`) and `level` in the frame T was given, its `house` slot, `centre`, `yaw`); the
  composer sows a park zone's plots at the kind's size (36-44 m, a 16 m gap between them), cuts the
  lawn as a DERIVED flatten at the plan's level whose falloff widens with the lawn's drop (never past
  3:1, never into the next lawn) and refuses a plot past a 10 m bank with the reason, then re-stands
  the park on the cut ground. (c) `fill: { <slot>: '<key>' }` names what stands in an entry's slot
  (`slots.<slot>` is the path in the plan to its place: x, z, ry, w, d); the composer places it as an
  ITEM in placeSite's shape, under the park's id, so the renderer builds it like a site's. The mill's
  standing follows the village's own law at G367: `floorY = ground(0, shelf.zLevel) + 0.5` from the
  entry's published `ground.shelf`. GATE PREMISES rules 3 (every landed entry built), 8c and 9c.
