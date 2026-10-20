# CITY PACK FORMAT (v2): the cooked town (CITY-A, 20 Oct 2026, G3400 / G3405)

The contract between CITY-A (the cook, `claude/city-a`) and CITY-B (the runtime host, `claude/city-b`). Read with
`CITY-2.0-PLAN-2026-10-20.md` and `METLA-2.0-HANDOVER.md`. CITY-A owns this file. CITY-B proposes changes as a section at
its end, on its own branch, and A0 merges them.

**What the pack is.** One sown town is cooked into cells. Each cell carries everything the town draws there:
- **far:** one static merged mesh (the houses' shells and the landmarks' boxes), built at cook time: **1 draw a cell**;
- **near:**
  - the kit instance table (the TKIN rows `townkit.js` already draws);
  - the props;
  - **the lot pieces (v2)**: the fences, the gates, the posts and the worn ground of every plot, as instanced rows;
  - the list of the unique things (the landmarks) that keep the unique path.

Nothing in the pack is per plot at run time. A plot is rows, never an Object3D.

**What it is not.**
- The village, the editor's premises, piers with boats and procedural waterfronts stay on the procedural path. The pack
  holds only the sown towns of the `TOWNS` table (today: Metlakatla, the `mk_` zones of Jolene).
- It never holds a thing that the town-OFF record keeps (`TOWN_OFF`, section 10).
- **It draws no flat lot squares, anywhere** (the user, 20 Oct): a lot shows the terrain's own texture. Only the worn
  pieces (paths, the drive, the pad, the slab, the dry ground round the house) are drawn, near only (section 9).
- It holds no roads: the town's roads draw at every distance through render_premises' road batches and the pavement
  (CITY-B's proposal 1).

## 0. What changed from v1 (20 Oct)

| | v1 | v2 |
| --- | --- | --- |
| `v` | 1 | **2** (the host refuses any other: CITY-B's proposal 7) |
| far buckets | walls, roofs, roads, lots | **walls, roofs** (the roads and the flat lot squares are gone) |
| far draws a cell | 2 (`shell`, `ground`) | **1 (`shell`)** |
| far per-plot ranges | - | **`far.owners`**: per plot and per unique, its index range in each bucket (CITY-B's proposal 3) |
| far switch | `nearIn` 950 / `nearOut` 1050 | **`lod.far` = 1000 m, a dial** (the user: 1 km; 2 km is the fallback). `nearIn` / `nearOut` = `far` ∓ 50 |
| near lots | - | **the `lots` section and the town's lot kit** (section 9; the user's ruling, CITY-B's proposal 2) |
| props | the lot cars missing | **the lot cars** (a commercial lot's parked cars, `plot.lot.cars`) added, kind 1 |
| plots flag 8 | rows the cook assigned (11) | **none**: the kit table is re-sown against today's record (section 7) |

Not taken: CITY-B's proposal 4 (one bundle per town) is optional and left for a later version. The 13 cell files stay
13 fetches. Proposals 5 and 6 asked for nothing.

## 1. Files

| file | what |
| --- | --- |
| `tools/city_cook.js` | the cook. `node tools/city_cook.js --island jolene [--report]` |
| `tools/city_cook.js` exports | the reference decoders `decodeCell(raw)`, `decodeProps(buf)`, `decodeLots(buf)`, `decodeLotKit(raw)`; the kit section is read by `TOWNKIT.decodeInstances` |
| `tools/evidence/CITY-A-far.js` | the evidence: a node software raster of the committed pack (the far town; one cell far vs near, with its fences) |
| `src/core/city_packs.json` | the manifest (generated, do not edit): towns, their inputs, their cells, the prop keys, the lot kit |
| `media/city/<island>/<town>/c_<i>_<j>.<h8>.bin` | one cell: ONE gzip stream (level 9, mtime 0). `<h8>` = the first 8 hex of the sha256 of the gzip bytes (`_media_lib.writeMedia`) |
| `media/city/<island>/<town>/lotkit.<h8>.bin` | the town's lot kit: the fence, post and gate meshes the lot rows instance (section 9.2). ONE gzip stream |

The cook reads only committed inputs (section 11). It never writes `premises_packs.json`, `townkit_pack.json` or
anything under `media/world/` or `media/townkit/`.

## 2. The cell grid

- **The size:** `S = 512` m, in the WORLD frame (x east, z south, as `render_premises` LIVE_CELL). A city cell is 2 x 2
  stream cells of 256 m, aligned to them: city cell `(i, j)` holds stream cells `(2i..2i+1, 2j..2j+1)`.
- **The key:** `i = floor(x / 512)`, `j = floor(z / 512)`. The key string is `"i,j"`. The file stem is
  `c_<i>_<j>`, with `m` for a minus sign (`premises_cook.cellStem`, e.g. `c_m6_m17`).
- **Where a thing lands.** Every thing lands in exactly one cell, the cell of its ANCHOR (world x, z):
  - a plot: its house's centre (the places cook's `at`); a plot with no house uses its polygon's vertex mean;
  - an outbuilding, a prop, a lot piece of a plot: its plot's cell, not its own position, so a plot never straddles
    two cells;
  - a site item (landmark): its `at`;
  - a record object (a prop): its `at`.
- **Geometry may overhang its cell.** Each cell's `box` (section 4) is the true extent of its far mesh, not the square.
  The near rows are culled by the host per row, never by the square.

## 3. The manifest (`src/core/city_packs.json`)

```
{ "note": "GENERATED by tools/city_cook.js ...", "v": 2,
  "towns": [ {
    "id": "metlakatla", "island": "jolene", "prefix": "mk_", "variant": "town",
    "cell": 512, "frame": "world",
    "lod": { "far": 1000, "nearIn": 950, "nearOut": 1050, "kitE0": 150, "kitE1": 1200,
             "propFar": 600, "lotFar": 400, "castFar": 600, "farGain": 0.2 },
    "inputs": { "fixture": "<sha16>", "record": "<sha16 of the town record>", "places": "<premises_packs town places hash>",
                "kitPack": "<townkit pack sha256>", "kitTable": "<sha16 of the gunzipped instance file>",
                "cook": "<sha16 of tools/city_cook.js>", "means": "<sha16 of the finish mean table>",
                "lotKit": "<sha16 of the lot kit's raw bytes>" },
    "propKeys": [ "boat_tirola", "fence_old", "person_john", "pole_a", ... ],   // sorted; a prop / old-fence row indexes this
    "archetypes": 33,                                                           // the kit pack's count (row arch < this)
    "lotKit": { "src": "media/city/jolene/metlakatla/lotkit.1a2b3c4d.bin", "raw": bytes, "gz": bytes,
                "pieces": [ { "id": 0, "name": "post:rail:0", "kind": "post", ... } ] },   // the piece table, as in the file (9.2)
    "hash": "<sha16 over every cell: key + ':' + raw bytes, in key order>",
    "counts": { "cells": n, "plots": n, "kitRows": n, "props": n, "lots": n, "uniques": n, "objects": n, "farTris": n, "farVerts": n },
    "cells": [ { "c": [i, j], "src": "media/city/jolene/metlakatla/c_m6_m17.1a2b3c4d.bin", "raw": bytes, "gz": bytes,
                 "box": [x0, y0, z0, x1, y1, z1],
                 "plots": n, "kitRows": n, "props": n, "lots": n, "uniques": n, "objects": n, "farTris": n, "farVerts": n, "draws": 1 } ]
  } ] }
```

- The `cells` entries are sorted by `i`, then `j`.
- `box` repeats the cell header's `box`, so a host can cull and pick LOD before it fetches a cell.
- **`lod` holds the distances the cook assumed.** The host reads them and does not hardcode them (section 6).
  - `far` is THE DIAL: the far-shell switch (the user: 1 km; 2 km if 1 km looks bad on the box).
  - A host-side override (CITY-B's, e.g. `?cityfar=2000`) sets `far` and takes `nearIn` = `far` - 50 and
    `nearOut` = `far` + 50. Nothing in the pack depends on `far`: changing it needs no re-cook.

## 4. The cell file (raw = gunzipped)

```
 0  u32  magic 0x59544943 ('CITY' little-endian)
 4  u32  version (2)
 8  u32  H = the header's byte length
12  H B  the header, JSON, utf8
    pad to a multiple of 4
 B  the blobs. The header's `sec` gives each as [offset from B, byte length]; every offset is a multiple of 4.
```

The header:

```
{ "magic": "CITY", "v": 2, "town": "metlakatla", "cell": [i, j], "size": 512,
  "box": [x0, y0, z0, x1, y1, z1],            // world metres: the far mesh's quantization box (section 5)
  "far": { "verts": n, "tris": n, "stride": 12, "index": 16 | 32,
           "buckets": [ { "name": "walls", "id": 0, "first": 0, "count": c0 },     // first, count in INDICES
                        { "name": "roofs", "id": 1, "first": c0, "count": c1 } ],
           "draws": [ { "mat": "shell", "first": 0, "count": c0 + c1 } ],          // ONE draw
           "owners": [ [ kind, index, bucket, first, count ] ] },                   // kind 0 a plot, 1 a unique (5.1)
  "plots": [ [ "<plot id>", seed, house row | -1, outbuilding row | -1, flags ] ],  // every plot of this cell
  "uniques": [ [ "<item id>", "<gen>", x, y, z, yaw ] ],                            // the landmarks: the unique path near
  "objects": [ [ "<object id>", "<prop key>" ] ],                                   // the record's objects (drawn as props)
  "kit":   { "rows": n, "stride": 32 },
  "props": { "rows": n, "stride": 20 },
  "lots":  { "rows": n, "stride": 32 },
  "sec": { "vb": [off, len], "ib": [off, len], "kit": [off, len], "props": [off, len], "lots": [off, len] } }
```

- **`plots`** is sorted by id. Its `flags`:
  - 1: a kit plot (its house is a kit row);
  - 2: a unique plot (no kit row fits it; the unique path builds it near, and the far shell holds its box);
  - 4: a water plot;
  - 8: the house row was assigned by the city cook because the kit table does not know the plot. **v2 cooks none**
    (GATE CITYCOOK fails on any; re-sow the table, section 7).

  A plot's index in this array is its **plot index**, which the prop and lot rows use. The editor and the life systems
  use the id.
- **`uniques`** are the site items that are not plots: churches, the cannery, the school, named buildings. They keep
  `buildItem` near. Their far proxy is in the shell buckets.
- **An empty section** is `[off, 0]` and is still present.

## 5. The far merged mesh (`vb`, `ib`)

**One vertex buffer and one index buffer per cell, interleaved, 12 B a vertex:**

| bytes | field |
| --- | --- |
| 0-5 | u16 x 3 position, normalized in `box`: `x = x0 + q / 65535 * (x1 - x0)`, the same for y and z |
| 6-7 | i8 x 2 normal, octahedral (`town_kit.js octEnc` / `townkit.js octDec`, world space) |
| 8-10 | u8 x 3 colour, sRGB-encoded albedo (decode to linear: the host's LUT, or `SRGBToLinear` in the shader) |
| 11 | u8 the bucket id (0 walls, 1 roofs) |

- **The index** is u16 when `verts <= 65535`, else u32 (`far.index`). Triangles are counter-clockwise seen from
  outside (three's front face).
- **The buckets** are contiguous index ranges, walls then roofs. Inside each bucket the owners come in the cell's order
  (its things by id), each owner's triangles contiguous.
- **The material `shell`:** vertex colour x `lod.farGain`, a plain lit material (the G559 far-town rule: the colour is
  the finish's albedo mean and the gain is the runtime's). It receives shadows and casts none. **A far cell is ONE draw
  call.**
- **No textures and no atlas** at far: a far texel is sub-pixel. The colour IS the texture's mean.

### 5.1 The owners' ranges (`far.owners`)

`[kind, index, bucket, first, count]`:
- kind 0: a plot (`index` into `plots`);
- kind 1: a unique (`index` into `uniques`);
- `first` and `count` are in INDICES, inside that bucket's range.

A host that must leave one owner out of a far cell (an edited plot, WYSIWYG between an edit and the re-cook) draws the
shell as the ranges around it: at most 2 extra draws for that cell while the edit stands.

### 5.2 The shapes

- **A kit house or outbuilding:** its archetype's FAR SHELL, at its kit row's transform (section 7). It is cooked
  once per archetype from the archetype's lod-1 extent:
  - the walls: a box on the footprint, each foot corner on the row's own ground corner, up to the eave;
  - the roof: the family's prism (gable, saltbox and gambrel as a gable; shed as a mono-pitch; hip as a hip), ridge
    along the archetype's x (its L), at the archetype's ridge height;
  - at most 14 triangles.

  The colours:
  - the walls: `HOUSE_GEN.COLS[wallCol]` (the palette names the colour you get) where the wall set takes paint and the
    house is painted, else the wall set's mean;
  - the roof: the same rule on `roofCol` and the roof set.

  The means are measured once from the shipped `_diff` maps (`tools/city_cook.js` MEANS, with each map's file name as
  its key, so a re-shot texture shows as stale).
- **A unique plot, a landmark (unique item) and an item's outbuilding:** the box of its places-cook obstacle shape
  (`shape`: ox, oz, nx, nz, cell, top), at `at`, its foot on the composed ground, its top at 85 % of the shape's (the
  G594 box). The walls are coloured by `P.wallTint` or neutral, the roof neutral grey.

## 6. The LOD rule (the host's; the cook's numbers in `lod`)

- **A cell is NEAR** when the eye's horizontal distance to its `box` rectangle is below `nearIn` (`far` - 50). It goes
  back FAR above `nearOut` (`far` + 50). The test is per cell, over the ring.
- **A FAR cell** draws its 1 draw and nothing else: no kit rows, no props, no lot rows, no uniques, no per-plot JS.
- **A NEAR cell** draws:
  - its kit rows in the kit host (the rung band `kitE0` / `kitE1`: lod 0 / lod 1 / box);
  - its props within `propFar`;
  - its lot rows within `lotFar` (section 9), per cell or per row;
  - its uniques on the unique path.

  Its `shell` draw is off. **No ground stand-in is drawn** at any distance: the terrain's own texture is the lot.
- **Shadows, near only:**
  - kit rows cast within `castFar` when their flag 8 says they may (section 7);
  - props cast only with prop flag 2 and within `castFar`;
  - lot rows cast only with lot flag 1 and within `min(lotFar, castFar)`;
  - the far mesh never casts.
- **The swap from far to near** happens at `far` (1 km, where a house is about 10 px). A cross-fade is the host's
  choice (the G801 dither).

## 7. The kit rows (`kit`): the TKIN rows, in the world frame

**The section is a complete TKIN instance file.** `TOWNKIT.decodeInstances(bytes)` reads it unchanged. Its layout:
- 8 B: u32 the head length, u32 the stride;
- the JSON head: `{ magic: 'TKIN', v: 1, stride: 32, pack: <kit pack sha256>, frame: 'world', count, plots: [[plotId, out 0/1, seed]] }`;
- padding to 4;
- the rows.

**The 32 B row is town_kit.js INST, unchanged, with two differences:**
- **x, z and yaw are WORLD** (`frame: 'world'`). The cook applied `O.frame.toWorld` and `+ O.frame.yaw`, so the host
  adds nothing.
- **The flags byte (23)** keeps 1 = outbuilding, 2 = water plot, 4 = named preset, and adds **8 = may cast a shadow**.
  The cook sets 8 on every house and on every outbuilding whose far-shell ridge is 3 m or higher.

**The transform** is the kit host's: `compose((x, y, z), rotY(yaw), (scale, 1, 1))`, on the mirrored copy of the
archetype when `arch & 128`. `y` is the ground under the high corner. The four i16 corner offsets stretch the stance
weight.
- **The archetype id** is `arch & 127`. It must be below the manifest's `archetypes` and index the committed kit pack
  (`townkit_pack.json`).
- **The tint / variant** is the finish set (byte 15), the three paints (16-18), weather, dirt and lights (19-21), and the
  stretch (22), as in TOWNKIT.
- **The order:** the rows follow the cell's `plots` order, each plot's house row then its outbuilding row. `plots[k][2]`
  / `[3]` name them. The head's `plots` array is parallel to the rows, as in TKIN.
- **The outbuilding** is the one the places cook planned for the plot:
  - its kind gives the archetype (by the pack's `src.kind`);
  - its `at` gives the position, the yaw and the ground;
  - a kit-table outbuilding row is used only where it matches that plan (kind, 2 m, yaw).

  There is no hidden row: a plot plans one outbuilding or none, and the pack holds exactly that.
- **The table is sown from today's record** (v2). `node tools/town_kit.js --table` re-sows the instance table against
  the COMMITTED pack, so the 30 + 3 approved archetypes are unchanged and only the table moves. `--media` would
  re-cluster the archetypes themselves.

## 8. The props (`props`): 20 B a row

| bytes | field |
| --- | --- |
| 0-11 | f32 x, y, z (WORLD; y is the prop's base, as placed) |
| 12-13 | u16 yaw (2 pi / 65536) |
| 14-15 | u16 key: an index into the manifest town's `propKeys` |
| 16-17 | u16 owner: an index into the cell header's `plots` (kinds 0, 1, 2, 5), `uniques` (kind 4) or `objects` (kind 3) |
| 18 | u8 flags: 1 stands on the ground (`on: 'ground'`), 2 may cast a shadow, 4 on the water (a boat, a float) |
| 19 | u8 kind: 0 lot dressing (yard, people, lamp, pier module), 1 car (the plot's own and a lot's parked cars), 2 boat, 3 record object, 4 a unique item's prop, 5 an outbuilding's prop |

- **The source** is the places cook's own placements (`premises_cook.js` `props`, `plot.car`, `plot.lot.cars`,
  `plot.boat`, `plot.out.props`, the items' `props`, the record objects). They are taken from the house frame to the
  world by the owner's `at`, exactly as `placeBuilt` stands them.
- **The order:** as the cook meets the owners (the cell's things in id order), each owner's props in the source's
  order.
- **For a kit plot, the props are the unique plan's props:** the people, the yard, the pier and the lamps that the lot
  plans around a kit house of the same cluster (C3c's rule).

## 9. The lots (`lots`), v2: what Metlakatla bare took down, as instanced near-only rows

**Today's procedural plot** carries a fence round its edges, a gate in its front fence, its posts, and a ground patch
(`VILLAGE_GEN.lotGround`): worn paths, the drive and the car's pad, the dry ground round the house, a commercial lot's
concrete slab, and a lawn tone over the whole plot plus 5 m. G3210's "Metlakatla bare" took all of that down for `mk_`
plots.

**v2 brings it back as rows:**
- **The fence, the posts and the gates** are the village's own (`VILLAGE_GEN.buildFence` / `gateLeaf`, through
  `premises_build.js genFence`'s rules). Each piece is cooked once into the town's LOT KIT (9.2), and each stretch of
  each plot becomes rows of those pieces.
- **The ground is drawn only where it is WORN.** That is the paths, the drive, the pad, the slab and the dry ground at
  the house's foot. Each is a draped strip or rectangle with a soft, broken edge.
- **The lawn tone over the whole lot is NOT drawn.** That is the "flat lot square" the user ruled out: the terrain's own
  texture shows.

### 9.1 The lot row: 32 B

| bytes | field |
| --- | --- |
| 0-11 | f32 x, y, z: WORLD, the piece's ORIGIN on the ground (a post's foot; a bay's or a strip's start; a gate's hinge) |
| 12-13 | u16 yaw (2 pi / 65536): the piece's +x in the world, `rotY(yaw)` as the kit's |
| 14-15 | u16 length, cm, along +x (a bay: post to post; a gate: the leaf; a ground piece: its length) |
| 16-17 | u16 width, cm, across (+z), centred on the axis (a ground piece); 0 for a fence piece |
| 18 | u8 piece: an index into the lot kit's `pieces` (9.2) |
| 19 | u8 flags: 1 may cast a shadow (near only), 2 a ground piece (draped, no shadow), 4 an old-fence prop row (the piece names a prop key) |
| 20-21 | u16 owner: the cell's plot index |
| 22-23 | u16 seed: the row's own variation (a ground piece's edge noise, a hand-picked tint) |
| 24-31 | i16 x 4, cm: the ground under the piece's four corners, relative to y, in its own frame, in the order (0, -w/2), (L, -w/2), (L, +w/2), (0, +w/2). A fence piece (w = 0) has corners 0 = 3 and 1 = 2 |

**How a row is drawn:**
- **A mesh piece** (a post, a bay, a gate) is its lot-kit mesh at the transform
  `compose((x, y, z), rotY(yaw), (length / piece.len, 1, 1))`, then SHEARED: each vertex `y += (lx / piece.len) *
  rise`, where rise = corner 1 - corner 0 and lx is its unscaled x.
  - The rails follow the ground between their posts, as `buildFence` builds them on the terrain, and a post stays
    vertical: all of its vertices share one x.
  - A post or a gate leaf has `len` = 1, so its x scale is 1.
- **An old-fence row** (flag 4) is the prop `propKeys[piece.prop]` (`fence_old`, the scanned stretch) at
  `(x, y, z, yaw)`, scaled `length / piece.len` along its x. That is `placeFence`'s `ob.scale.x = q.sx`, and the prop
  stands on the ground under its middle.
- **A ground piece** (flag 2) is a rectangle `[0, L] x [-w/2, +w/2]`, draped bilinearly on its four corners, + 0.04 m.
  - It uses a polygon offset (-2, -2) and is textured with the lot's worn ground (lot_tex's `piece.tex`).
  - Its alpha fades over `piece.fade` metres from each edge, the fade broken by noise on `seed`, so a strip never reads
    as a ruled band.
  - It casts nothing.
- **The cook keeps each ground piece at most 8 m long and 8 m wide** (splitting a long path or a large slab), so the
  bilinear drape stays within a few centimetres of the composed ground.

**The order of the rows:** by owner (the cell's plots in order). Inside a plot: its fence stretches in the plan's
order, each stretch's posts, bays and gate, then its ground pieces.

### 9.2 The lot kit (`lotkit.<h8>.bin`, one per town; its piece table also in the manifest)

```
 0  u32  magic 0x544b544c ('LTKT' little-endian)
 4  u32  version (1)
 8  u32  H = the header's byte length
12  H B  the header, JSON: { magic: 'LTKT', v: 1, roles: ['post', 'deck'], vstride: 16, pieces: [...] }
    pad to 4, then the blobs (each piece's `vb` / `ib` as [offset from the blobs' start, byte length], 4-aligned)
```

**A piece:**
```
{ "id": n, "name": "bay:picket:2", "kind": "post" | "bay" | "gate" | "gatepost" | "old" | "ground",
  "style": "rail" | "picket" | "old" | <ground kind>, "variant": 0..3, "len": metres (the unscaled length along x),
  "tris": n, "verts": n, "box": [x0, y0, z0, x1, y1, z1], "uv": [u0, v0, u1, v1], "vb": [off, len], "ib": [off, len],
  "prop": <propKeys index> (kind "old"), "tex": "<lot_tex set>", "fade": metres (kind "ground") }
```
- **The kinds:**
  - `post`: a fence post, its foot at the origin; rail 1.15 m, picket 1.05 m;
  - `bay`: the rails (and the pickets, picket style) from x = 0 to `len` = 2.4 m, no posts;
  - `gate`: a leaf hung at the origin along +x, closed, `len` = 1. The row's yaw already carries its swing (the
    village's 0.45-0.75 rad into the plot, as `gateLeaf` draws it);
  - `gatepost`: the taller hinge and latch posts;
  - `old`: the scanned stretch (a prop, no mesh);
  - `ground`: a worn piece (no mesh).
- **The variants:** posts and bays come in 4 variants each, the village's hand at four seeds: a post's lean, a rail's
  sag, a picket short or gone. A row's variant is the piece it names.
- **The vertex, 16 B** (the kit pack's own vertex layout, `town_kit.js` encodeLod; bytes 14-15 unused):

  | bytes | field |
  | --- | --- |
  | 0-5 | u16 x 3 position in the piece's `box` |
  | 6-7 | i8 x 2 octahedral normal |
  | 8-11 | u16 x 2 UV in metres, in the piece's `uv` range |
  | 12 | u8 AO |
  | 13 | u8 role: 0 `post`, 1 `deck` (the fence finish's two materials, render_premises `fenceFinish`) |
  | 14-15 | 0 |

  The index is u16.
- **The material** is the fence finish (render_premises `fenceFinish()`: the premises' post and deck materials), by
  role. That gives one instanced draw per (piece, role) in the host, or one batch.

## 10. TOWN_OFF: the variant rule

- **The pack is the `town` variant's alone.** A page with the town OFF (`PREMISES_GEN.TOWN_OFF`, the default) fetches
  neither `city_packs.json` nor any cell, and nothing it draws changes.
- **The pack holds only what the town-OFF record does not.** A thing (plot, item, object) whose id is in the `default`
  places variant is never in the pack. These are:
  - the seaplane base: `mk_sea`, the `mk_mp_air` trestle and the `mk_mf_air` float;
  - everything else TOWN_OFF keeps.

  With the town ON these stay on the procedural path, as with the town OFF. So the base looks the same either way, and
  nothing is drawn twice.
- **The cook writes nothing** under `media/world/` and never touches `premises_packs.json`, so the `default` variant's
  manifest entry, places and raster are byte-identical before and after a city cook.

## 11. Inputs, determinism, the hash

**The inputs** (all committed; `inputs` names each by hash):
- the fixture `tools/fixtures/island_<id>.json`;
- the town variant's places cook (`premises_packs.json` → `media/world/<id>/premises/p_*`, the `town` variant);
- the kit pack and its instance table (`townkit_pack.json`);
- the composed record (`premises_cook.composeVariant`, for the ground under the shells and the lot pieces);
- the generators (VILLAGE_GEN's fence, for the lot kit);
- the MEANS table in the cook.

**Determinism:**
- no clock, no random number, no Map/Set iteration order that is not sorted first;
- numbers rounded before they are hashed;
- gzip level 9 with mtime 0.

A re-cook gives byte-identical raw cells. The gzip bytes are kept as shipped when the raw bytes are unchanged
(`premises_cook` keepShipped's rule), so a re-cook of an unchanged town writes nothing.

**The hash** is the manifest's `hash`: sha256 over every cell's `key + ':' + raw`, in key order, first 16 hex.

**The version:**
- `v` is 2. A layout change bumps it, and the host refuses a `v` it does not know.
- The kit rows' archetype ids are only valid against the kit pack named in `inputs.kitPack`, and the lot rows' piece
  ids against the lot kit named in `lotKit`. A host whose kit pack differs refuses the pack, and the town stays on
  today's path.

## 12. GATE CITYCOOK (`tools/_citycook_check.js`)

1. **Determinism:** two cooks in one process give the same raw cells and lot kit, byte for byte, and the same `hash`.
2. **Freshness:** the committed manifest, cells and lot kit equal a fresh cook, which is a red STALE.
3. **Coverage:** every plot of the town record (the `prefix` zones, minus the TOWN_OFF keep) is in exactly one cell's
   `plots`, in the cell of its anchor, and none of them was assigned by the cook. Every town item and object is in
   exactly one cell. Nothing in the `default` variant is in the pack.
4. **The draw bounds:** per cell, the 2 buckets in order and 1 draw. The owners' ranges tile each bucket. The shell is
   within 14 triangles a kit row and 10 a box.
5. **The ids:** every kit row's `arch & 127` is below the kit pack's count, through `townkit.js`'s own
   `decodeInstances`, and the kind of an outbuilding row matches its archetype. Every prop key is in `propKeys`. Every
   lot row's piece is in the lot kit, and its owner is a plot of the cell.
6. **The lots:**
   - every fenced edge of every plot's plan is covered by its rows: post to post, the gate's gap left for the gate;
   - every row's ground corners are the composed ground to 2 cm;
   - no ground piece is longer or wider than 8 m;
   - no row is a lawn (a ground piece over the whole lot).
7. **TOWN_OFF intact:**
   - `premises_packs.json`'s `default` variant is unchanged by the cook (its hash and cells);
   - `PREMISES_GEN.TOWN_OFF` is as recorded;
   - the kept ids are absent from the pack.
8. **Negative controls:** each of these is caught: a plot moved, a plot dropped, an archetype id past the pack, a
   second draw, a lot row on a missing piece, a fence bay taken out.

## 13. Metlakatla, as cooked

(Filled in by the v2 cook; v1's numbers: 13 cells, 380 plots, 435 kit rows, 3 695 props, 34 108 far triangles.)

## 14. Changes proposed by CITY-B

(CITY-B: add your proposals here, on your branch. A0 merges them. CITY-B's v1 proposals 1, 2, 3 and 7 are in v2, see
section 0.)
