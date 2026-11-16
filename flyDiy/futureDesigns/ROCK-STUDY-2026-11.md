# ROCK-STUDY — making the rock look like rock (cliffs and rocky slopes), 13 Nov 2026

**The ask** (the user, 13 Nov): "The look of our rock faces is not awesome. That's basic alpha mapping, but it fails to
render the actual rocky relief, both CLIFFS and flatter rocky/mountainous terrain." The deliverable is a STUDY: research,
a bench of our own, a few tests with stills and costs, and a recommendation. **Nothing is landed in the game.**

**Branch.** `claude/rock-study-2026-11`, off the L39b build (23ce68c1). **Bench:** `tools/rock_study/`.
**Stills:** `reports/evidence/ROCK-STUDY/`. Cloud session, SwiftShader only: every picture and every millisecond here
comes from a CPU rasteriser (§7 says what that cannot show).

## 0. The short version

1. **What is wrong is the geometry, not the texture.** The ground is the 5 m IFSAR DEM, and radar smooths every ledge
   into a curve. Around Mount Ardent the rock is 40-55° smooth domes wearing a photograph. Today's splat already does
   the textbook texture work: height blending, hex tiling, triplanar, a slope switch and a macro tint. No texture trick
   can draw a shadow that the geometry does not cast.
2. **The texture-only tests changed little, and the user rejected them on sight.** Detail-on-macro, biplanar, exposure
   masks, shader strata, and a displaced "cliff skirt" with a computed ledge pattern were all tried. The user's verdict
   (13 Nov): *"It doesn't really change what you see"*. The skirt's ledge normals "have no relationship between the
   diffuse and the normal ... unacceptable", and the pattern "is not realistic". That verdict is recorded in §4. These
   could at most be a minor extra layer.
3. **The direction is the MESH WAY.** A procedural rock kit is placed on the cliffs and rocky slopes and scattered,
   instanced and LOD'd like the trees. The bench now has a first version of this (§5). It does change what you see:
   real rock relief, real shadows and broken skylines. Its first state is not finished:
   - the faces read as a **block field** more than a **cliff**;
   - it costs **0.9-3.0 M triangles** in a 1.4 km ring, against the ground's 0.32 M.

   §6 says what to build first, and how to make it a cliff and make it fit a phone.
4. **The most useful measured fact for the phone.** Hex tiling is **~2/3 of the ground's texture fetches** on a rock face:
   23.1 fetches/pixel with it against 7.7 without, at the near view, and 4.8 s against 1.4 s a frame on SwiftShader. Taking
   hex off the rock types once meshes cover them pays for the meshes' pixels several times over.

## 1. Why today's rock reads as paint (measured on Jolene and read in the code)

The splat (`src/viewer/splat_ground.js`, recipe in `src/core/28b_ground_fields.js`) is not naive. It has per-type sets,
a height blend (seam 0.34), Mikkelsen-style hex tiling, a triplanar whose side planes turn to the face (triK 8), the rock
to cliff switch at 32-42°, and the Landsat macro. The "alpha" look comes from four other things.

1. **The mesh has no relief under 5 m, and the DEM smooths the rest.** Rock (raster code 6) is 34 km², ~10 % of Jolene's
   land. Around Mount Ardent its slope is p50 **43°** and p90 **52°**, and 99 % of it is over 32°. These are smooth
   domes. `cliffs.js` (Sept, off) hit the same wall: a photoscan needs a step to sit in, and the DEM has none.
2. **The rock sets are seen from the wrong side, or at the wrong scale.**
   - Below 32°, rock wears the `cliff` photograph (natural repeat 6.86 m) drawn at **71.5 m** (10x stretched).
   - Above 32-42° (nearly all of Ardent) it wears `rocksB`. That is an **aerial** of outcrops: right for altitude, but a
     picture taken from above, laid on a face seen from the side, at ~0.1 m a texel in a 512 px layer. Its normal map
     carries almost nothing.
3. **The edges follow the 10 m land-cover raster**, voted and height-blended into a soft band tens of metres wide: the
   "alpha".
4. **The 3D rock stops at 220 m (reach) and 150 m AGL (aglOff).** The cover ring scatters rocks by biome density only
   (`conifer_steep` 12 per 1000 m²). Nothing reads slope foot, curvature or flow. No talus, no rock skyline from the air.

## 2. The research, condensed

Method: web search plus reading, no downloads. **Caveat: the proxy refused iquilezles.org, medium.com, gamedev.net and
80.lv.** For those pages the claims rest on search summaries of the cited page. Numbers in [brackets] point to §8.

| technique | cost | verdict for a WebGL2 phone build |
|---|---|---|
| triplanar [3][10] | 3 projections; with hex, 9 fetches a map | have it |
| biplanar [1] | 2 projections | measured −19 % fetches on a face, no visible change (§4) |
| one-plane dithered / stochastic [9][11][12] | 1 projection, but noise that needs TAA | no (no TAA on the phone) |
| hex / stochastic tiling [5][6][7][8] | 3 fetches a map | have it; **the ground's biggest single cost** (§4) |
| height blending [13][14][15] | ~0 fetches | have it |
| macro + detail [2][57] | +1 set | measured: small change (§4) |
| slope / curvature / flow masks [17][19][21][25] | 0-1 fetch | small visible change on its own; the right input for PLACEMENT (§5) |
| POM [50][62] | grows with steps, worst at grazing angles | no |
| shader strata, slope-line noise (FlightGear) [59] | ALU | tried; rejected by the user (no tie to the texture) |

**Geometry is where the AAA answers are.**
- **FC5's cliff tool** generates cliff geometry on the terrain's steep cells, writes a cliff mask, colour and strata
  back, and **transfers the cliff texture to the terrain under it** so the two match [17][19][20].
- **Rock kits:** Uncharted 4 built cliffs from a small kit [47]; the Kite demo shipped "2 types of cliffs" and 21 rocks
  [48].
- **Placement driven by flow and deposition maps:** Horizon Zero Dawn (500+ asset types, ~250 µs on the GPU, dithered
  density maps) [21]. Houdini's Slump puts "a typical debris mound around the base of the mountains" [42].
- **Blending meshes into the terrain:** UE's runtime virtual texture [35][73] and Star Citizen [50]. In WebGL the
  equivalent is to sample the same macro colour at the instance's position.
- **LOD and impostors:** instanced meshes plus octahedral impostors [44][45][46].
- **Flight sims** (MSFS, X-Plane, Outerra, FlightGear) lean on imagery for colour and still show stretched cliffs; few
  spend on geometry [53]-[59].
- **WebGL2 has no tessellation stage.** A near ring displaced through the vertex shader is the alternative [29]-[31][36].
- **Phone GPUs** (Mali): trilinear filtering runs at half rate. Fetch count x filter x cache locality is the bill [63]-[67].

## 3. The bench (`tools/rock_study/`)

| file | what it is |
|---|---|
| `export_patch.js` | Writes a 2 x 2 km patch of Jolene round Mount Ardent (centre 9540, -5140; 401² at the fine tiles' 5 m), using the game's own `terrainH`. Adds the raster's terrain types as per-vertex weights, curvature at 5 m and 20 m, a D8 flow accumulation and the Landsat albedo. Decodes the trees pack's rock kits with the game's codec, and lists the ground sets the bench reads. ~0.3 s. Output in `data/` (gitignored). |
| `bench.html` + `bench.js` | three r186 from `vendor/`; the ground sets packed in two texture arrays as the game does (colour + height, normal + rough). **BASE replicates today's rock path**: the same sets, scales, grades, slope switch, hex, triplanar, height blend, set normals x 3 and macro tint. Not replicated: the 5 x 5 vote (a 3 x 3 box instead), the hue-selection recolour, pools, banks, the far tier. The tests and the mesh way are URL switches, listed in its header. `window.BENCH` holds `measure`, `counts` (texture fetches per ground pixel), `info` and `setView`. |
| `rock_kit.js` | **The procedural rock kit** (§5). |
| `shot.js` | Headless Chromium on SwiftShader. Serves the repo, shoots each case and view, and writes `results.json`. `--timing` runs interleaved timing rounds. |

Run it:

```bash
node flyDiy/tools/rock_study/export_patch.js
```

```bash
node flyDiy/tools/rock_study/shot.js --only mesh,kit
```

**The views, in island coordinates, for a GPU shot of the real game** (yaw by `dir`). The face is the steepest 40 m
disc in the patch's middle, 57° mean.

| view | eye | dir |
|---|---|---|
| `face` (230 m off) | (9701, 835, -4793) | (0.285, -0.206, -0.936) |
| `near` (105 m) | (9745, 790, -4912) | (0.227, 0, -0.974) |
| `high` | (9341, 1368, -4626) | (0.525, -0.684, -0.507) |
| `slope` (70 m) | (9792, 747, -4891) | (0.524, -0.249, -0.814) |

Sun: (-0.845, 0.530, -0.067).

## 4. The texture and shader tests (a-e): measured, and rejected by the user

Every row is SwiftShader at 1280 x 720 with the shadow pass on. "fetch/px" is the mean texture fetches per ground pixel,
counted in the shader. "tris" includes the shadow pass, roughly 2x the main pass. The ms numbers jitter about ±15 %
between runs: read the fetch counts first.

| case | what | face ms | face fetch/px | near fetch/px | tris |
|---|---|---|---|---|---|
| base | today | 5123 | 38.6 | 23.1 | 640 k |
| a_detail | rock = rocksB macro + `cliff` photo at 7 m detail; crisper seam 0.12 | 4984 | 43.4 | 28.4 | 640 k |
| b_biplanar | 2 planes | 4195 | **31.4** | 20.8 | 640 k |
| b_oneplane | 1 plane, dithered | - | - | **15.3** (needs TAA) | 640 k |
| b_nohex | hex off | - | - | **7.7** (near ms 1437 vs 4773) | 640 k |
| c_expo | rock exposure by slope + curvature, macro variation, wet streaks | 4698 | 42.2 | - | 640 k |
| c_strata | shader strata (bands, bent normal) | 4973 | 38.6 | 23.1 | 640 k |
| d_scatter | the game's rock kits scattered by talus / outcrop / edge rules | 5545 | 37.5 | 22.3 | 2.9 M |
| e_skirt 1.25 / 2.5 m | steep cells re-meshed and displaced with bedding + joints | 6873 / 5113 | 37.8 / 37.3 | | 2.1 M / 0.92 M |

The stills are the sheets in `reports/evidence/ROCK-STUDY/shader_tests/` (each tile labelled with its case).

- **Look.** a, b and c change little at any of the four views. The skirt (e) gives real relief and shadows, but its
  ledge pattern reads as stripes and fingerprints, and its bent normals have no tie to the photograph. **The user
  rejected this family on 13 Nov** (§0.2).
- **What stays useful.** Biplanar on faces (−19 % fetches, no visible change) and hex off where meshes cover the rock
  (−2/3 of fetches) are **savings**, not looks. The exposure masks (curvature, flow, "a face uphill") are the right
  inputs for **placement** (§5), not for the colour.

## 5. The mesh way: the procedural rock kit on the faces and slopes (first state)

**The kit** (`rock_kit.js`). A rock is a closed shape over a sphere of directions: the soft minimum of an ellipsoid and
**K planes**. The planes are the joints, beds and cleavage a stone breaks along, which is what makes it read as a stone.
A little noise roughens it. The same shape is evaluated on icospheres of 5120 / 1280 / 320 / 80 triangles, so every
**LOD rung is the same rock**. Four archetypes, four seeds each:
- `cliff`: a shard with a flat back and base, joints across the front, tilted beds;
- `block`: jointed;
- `boulder`;
- `slab`.

Each vertex carries its crease depth (cheap AO) and its height in its own box. Picture: `mesh/kit.jpg`.

**The material** (the user's rule: the normal belongs to the diffuse):
- **One photograph does everything.** The game's `cliff` layer gives colour, normal map and height, read with the
  **same coordinates** on three object-space projections. The normal map's xy is swizzled onto each plane's axes
  (Golus' whiteout), so a crack in the colour is a crack in the light.
- Moss on the up-facing parts, height-blended by that photograph's own height map.
- The crease and the foot darken.
- The instance colour is the island's macro at the rock's foot (a third of its light, a tenth of its hue).
- **The face's ground switches to the same photograph at the same scale** (FC5's transfer), so ground and shards are
  one material and the shards only add relief.
- Cost: 6 fetches a rock pixel, +2 where moss.

**The placement** (one pass at load; a game would bake it per tile):
- **The cliff cover.** Random points (density ~1 per 25 m²), the steepest first. Probability rises with slope over 12 m
  (34-46°) and the raster's rock, broken by a 50 m noise. Each shard is 10-35 m wide (power law), **laid on the face** as
  a scale: x along the contour, y up the fall line, set 2-12° steeper than the ground, sunk so ~0.5 + 0.075 w metres
  stands proud. Each is turned ±20° about its face normal and ±25° about the vertical. Shards overlap: each claims a
  disc of a sixth of its width.
- **Outcrop, talus and edge blocks:**
  - talus: a face > 44° within 40 m uphill, in noise clusters;
  - outcrop: rock or scree code, 20-30°+, convex;
  - edge: the raster's rock edge, broken by a 9 m noise so the blocks do not stand in rows along it.

  Sizes follow a power law and blocks are sunk 22-50 %. Small blocks are culled beyond 300 m (150 m on eco).
- **The ladder:**
  - full: shards LOD0 < 140 m, small rocks < 60 m, LOD1 < 350 m, LOD2 < 800 m, LOD3 to 1400 m;
  - `?eco=1`: about half those distances.

  One InstancedMesh per (variant, rung).

**Stills** (`reports/evidence/ROCK-STUDY/mesh/`): `near_before_after.jpg`, `face_before_after.jpg`,
`high_before_after.jpg`, `kit.jpg`.

**Costs** (face view, 1280 x 720, shadows off, SwiftShader):

| case | ms | draws | triangles drawn | shards / blocks drawn |
|---|---|---|---|---|
| ground alone | 4323 | 2 | 0.32 M | - |
| mesh=1 | 4992 (+15 %) | 52 | 3.26 M (rocks 3.00 M) | 6243 / 765 |
| mesh=1, eco | 4874 (+13 %) | 39 | 1.23 M (rocks 0.92 M) | 6243 / 564 |

What the first state gets right and wrong (honest):
- **Right.** Relief that casts shadows and breaks the skyline, at every view. Ground and shards in one material. The
  normal tied to the colour. The scatter's talus and edge rules. Cheap per pixel: a rock pixel is ~6 fetches against
  the ground's 23-38.
- **Wrong.** The faces read as a **field of separate blocks**, not a continuous cliff: convex pieces scattered on a dome
  stay separate.
- **Wrong.** The cost is **triangles**: 0.9 M at eco is still several times what a phone should draw for one feature.
  Most of it is the far rungs: 4580 shards at 80 tris and 1486 at 320.
- **Bug found and fixed on the way:** the bench's first hash was one weak round, and consecutive seeds stood in columns
  (rows along the contours from the side). `bench.js hh` is murmur3's finaliser now. Any game placement must use a
  strong hash too.

### 5b. The density test (the user, 13 Nov: "4 times ... then double that ... size variation ... packs")

Switch: `?dens=1|4|8` in `bench.js`. Stills: `reports/evidence/ROCK-STUDY/density/{near,face,high}_1x_4x_8x.jpg` and
`top_4x_8x.jpg`. All with `eco=1`.

- **1x** (the last stills): ~1 point per 25 m², each shard claims 0.16 w. ~6 k shards.
- **4x** (the first correctly random density): 1 per 7 m², claim 0.08 w, 4 m occupancy cells. **15-20 k shards.**
- **8x + packs** (1 per 3.5 m², claim 0.05 w, 2.5 m cells): **28-37 k shards.**
  - **Packs:** pack centres ~1 per 2500 m² on ground over 32°, each 15-40 m in radius. The density falls to 20 % at a
    pack's rim and beyond.
  - **Size by distance to the pack's centre:** BIG shards (28-58 m, ~2 %) only in the inner third, MEDIUM (12-27 m,
    ~17 %) in the inner two thirds, SMALL (3-12 m) everywhere. The big ones are placed first, so the small ones pack
    round them.
  - **What stands proud:** big ones 0.25 w, medium 0.14 w, small 0.4 + 0.08 w. In the first pass the big ones were sunk
    like the small ones and read as low mounds.

Triangles drawn (rocks only, eco ladder):

| view | 1x | 4x | 8x + packs |
|---|---|---|---|
| near | ~2.4 M | 4.3 M | 7.8 M |
| face | 0.9 M | 2.7 M | 5.0 M |
| high | - | 4.4 M | 8.5 M |

- **Look.** 4x is a continuous blocky cover: every face is rock, but it reads as scales or cobbles of one size. **8x with
  packs reads best of all the tests so far:** big crags stand out of the face with their own shadows, with medium and
  small rock round them and thinner ground between packs. That is the "packs" structure, visible from the near view to
  the high one. The crags' moss reads a little too yellow from altitude.
- **Cost.** The look scales with the instance count, and the cost scales with it too: 5-8 M triangles is far over a phone
  (and over most desktops). Most of it is the many small shards at the far rungs. The way to keep the look and drop the
  cost is §6's: **bake each pack as ONE cluster mesh** (the big crag with its medium and small rocks merged and
  decimated), and an impostor beyond ~600 m. The pack layout is the right unit for that bake.

### 5c. The island's own rock: trondhjemite, weathered, in a mosaic, with Blender-style masses (15 Nov)

**The user's mission** (15 Nov):
- A normal-map pattern that makes sense for the island's geology, and a texture that makes sense at large scale.
- Displacement, normal and colour influencing each other ("crevices greyer").
- Then: weathering (sandstone-yellow, much dirtier), rock formations at medium scale, a denser vein network, and green
  growth in every crack.
- Then: no vast plain areas. Rock on the tops and ridges with vegetation cutting through it, as in their Google Maps view
  of Annette, and inspiration taken from their Blender rock generator.

Switch: `?trond=1&tskirt=1.25&scatter=1`. Stills: `reports/evidence/ROCK-STUDY/trond/`.

**The geology.** Jolene is Annette Island, and its rock is **trondhjemite**: a massive, light-grey plutonic rock with no
bedding. It breaks along joint sets, peels in sheets, weathers buff, carries dark water streaks on its faces, and fills its
cracks with dirt and moss. The two earlier generators the user attached (cliff-material, cliff-generator) were built on
sedimentary strata. That is why their pattern "did not make sense".

**The maps** (`tools/rock_study/trond_gen.py`, python + numpy, ~2 min). Every map is read off ONE height field per
material, so colour, normal and roughness agree:
- **slab**: 2048² over 24 m, 1.2 cm a texel, for rock under ~50°.
  - Long warped joints across the slope, at irregular spacing (2.5-6.5 m).
  - Cross joints down the slope, slanted and staggered band by band, so they END on the long ones: the T-junctions of
    the user's Yosemite photo.
  - A master gully, curved splits, rounded lips, peeled sheets.
- **face**: 2048² over 40 m, for the cliffs.
  - Smooth sheeting, gentle flutes, leaning sheet joints, rare short ledges.
  - Water streaks that rise out of their seeps and taper down.
- **Roughness everywhere**: spalled Voronoi flakes, pits, and a granular relief.
- **The weathering pass**, the town houses' recipe (`house_tarr.js`: age = desaturate + darken, dirt where it is occluded,
  a noise to break it up):
  - an uneven AGE film;
  - DIRT in the hollows at 0.3 m and 2 m;
  - GRIME drips from every lip;
  - a brown DIRT FILM;
  - crustose LICHENS as warped blotches in colonies (black, grey-green, map-yellow, the coast's orange).

  Colours lean sandstone-yellow, as asked.
- **macro**: world space over the patch's middle 1.6 km, 0.78 m a pixel. It is what the far view reads and what displaces
  the rock mesh.
  - Four joint sets: two regional (28-110 m) and two secondary (9-34 m), each staggered on the others.
  - FORMATIONS: every block the veins bound is its own mass, at its own height.
  - Medium knobs.
  - Wet streaks down the REAL fall line, by line-integral convolution along the DEM's downhill field. (A coordinate
    along the contour swirled into contour bands; this does not.)
  - A dirt line at the outcrop's margin.
  - **The EXPOSURE mosaic**: rock where the ground is high, convex and steep; vegetation down the drainage (the flow
    field), in the hollows and lower down; noise at 40 m, 8 m and 3 m, plus speckles of green at 2-5 m all over the rock.
    It comes to 27 % rock over the extent, mottled like the user's Google view.

**The Blender file** (`Mountain_rock.blend`, its "Cliff-Rock" node group). It was read without Blender: the `.blend`'s own
SDNA walked node by node, with `tools/rock_study/blend_nodes.py`.

Its HEIGHT path:

```
P  = object coords × Scale;  m = Musgrave fBm(P, scale 3.2, detail 15, dim 0.9);  Pw = P + m/10
d1 = Voronoi 4D F2 MANHATTAN(Pw, 2);   e1 = Voronoi distance-to-edge(Pw, 2)
b  = ((1-d1)/5 + (1-e1)/4)² + 0.5
e  = ((F2man(Pw, 2.5)^0.025 + F2man(P, 1.2)^0.2)² - 2) / 3.75
h  = (max(b, e) - log_0.05(d1) - m/40) ^ 1.2      (× Height)
```

Manhattan F2 gives the angular, faceted masses; distance-to-edge gives the fractures; ^0.025 flattens to plateaus with
sharp steps; the log sharpens the crests.

Its COLOUR path reads the same geometry: AO darkens the crevices, the up-facing and side-facing normals get their own
tints, fBm patches, and a high-frequency noise gives mineral speckle.

**We took the height path as is**, in 3D, at every vertex of the bench's rock mesh (one Blender unit = 12 m, no stretch
on a face). Its edge distance becomes a per-vertex CREVICE value, and the shader darkens and greens it.

**The bench** (`bench.js ?trond=1`):
- The slab is hex-tiled on the top projection, each tap's frame turned to the local fall line ABOUT ITS OWN VERTEX (no
  swirl).
- The face is a plain tile on the side planes, so the streaks stay vertical.
- The macro multiplies the colour, bends the normal off the displaced mesh, and drives the exposure.
- GREEN fills the low texels first, in this order: the macro's veins and hollows, the tile's cracks, the geometry's
  up-facing tops and ledges, the medium relief's crevices. It uses the ground's own grass set, darkened to moss where thin.
- The rock's edge into the other types is ragged, by noise in its margin.
- `?tskirt=1.25` re-meshes every cell with exposed rock at 1.25 m within 450 m. It displaces along the DEM normal by the
  macro height, plus a lift of 0.6 m and the Blender masses (1.5 m), where the SMOOTHED exposure says rock. Read raw, every
  speck of rock stood up as a tooth; smoothed over ~5 m, the outcrops rise out of the vegetation.
- `?rockk=` is a brightness knob for the user's eye.

**Costs** (SwiftShader, 1280 x 720, no shadows; texture reads per ground pixel, ms per frame, triangles):

| | face | near |
|---|---|---|
| today | 38.6 reads, 3658 ms, 0.32 M | 23.1, 3259 ms, 0.32 M |
| trondhjemite texture alone | **13.1, 2024 ms** | **10.7, 1984 ms** |
| + displaced rock mesh + game rocks (first state, before the mosaic) | 12.4, 2967 ms, 1.71 M | 9.9, 2791 ms, 1.97 M |
| **final** (mosaic + Blender masses + green + weathering + rocks) | 32.1, 3982 ms, 1.88 M | 29.6, 3890 ms, 2.20 M |

(Final row: the vegetation is back on about half the rock area, and its sets (hex x triplanar) cost more per pixel than the rock's. So the frame comes out about level with today (+9 % / +19 %), for a very different picture. Details in `trond/costs.txt`.)

The material is CHEAPER than today's, which stacks triplanar x hex x two maps per type. The cost of the look is the mesh:
0.4-0.6 M triangles for the rock ring at 1.25 m, plus the game's rock kits at ~1 M. A phone needs a coarser ring (2.5 m
past 150 m) and the kits' LOD.

**What it still lacks** (the user's next mission): the vegetation that GROWS in the green zones (tufts, shrubs, krummholz
from the cover ring, placed by the same masks), and calibration of the colours against the game's own grade on a GPU.

### 5d. The user's fourth pass (16 Nov)

**What they asked for:**
- A PBR rock texture blended in for close-range micro detail, with tiling you can't see.
- A vein network 2-3x denser.
- Something done about the close-up of a top, which looked "very blocky and pointy".
- The 3D rocks no longer shiny, keeping their own detail but in the cliff's colour.

Stills: `reports/evidence/ROCK-STUDY/trond2/`, 15 Nov above and 16 Nov below.

- **The PBR micro detail.** The game's own `cliff` layer (Poly Haven rock face, at its natural 6.86 m), hex-tiled and
  triplanar on the smooth normal.
  - Only its LUMINANCE over its mean and its NORMAL go onto our rock, so our colour stays ours.
  - It fades out between 60 and 180 m.
  - Cost: near view 29.6 -> 44.7 texture reads per ground pixel, 3890 -> 4354 ms (+12 %). Face 32.1 -> 34.5 reads,
    4621 ms.
- **Veins x3.** Every joint set at a third of its spacing (primaries 10-38 m, secondaries 3.5-12 m); the primaries 35 %
  narrower.
- **The blocky tops: a geology answer.** Trondhjemite weathers to ROUNDED masses (whalebacks, exfoliation domes) and
  stepped joint blocks, not spires.
  - The Blender masses' crest sharpening (the log term) is halved.
  - The value is soft-clipped (a peak compressed by z / (1 + 0.55 z)) and smoothed over the mesh (two Laplacian passes on
    the 1.25 m lattice).
  - The masses keep their 5-15 m facets and lose their 1-3 m needles. `trond2/ground_geometry_plain.jpg` is the
    geometry alone.
  - Real plants in the flats and pockets (the next mission) will cover much of what is left.
- **The 3D rocks** (the game's kits, scattered):
  - fully matte (roughness 1);
  - their map gives only its luminance over its own mean, and the colour is the trondhjemite slab's mean, x 0.62-0.82 to
    sit with the macro-darkened ground;
  - their up-facing faces take some moss.
  - Known flaw: one kit's UVs smear on the largest blocks (the ground view's right-hand rock). The fix is to give those
    the same triplanar material as the ground.

### 5e. More, bigger, seated rocks; vegetation maps; the final series (16 Nov)

**The user asked for:**
- more 3D rocks, plus a bigger class, "within reason";
- the rocks properly sunk on the new relief;
- the UV smear fixed;
- placement maps for the small vegetation, for the session working on a subalpine biome;
- a final render series.

The final series is in `reports/evidence/ROCK-STUDY/final/`: today against the final state from five views, and the
final state alone.

- **More and bigger.** Talus, outcrop and edge densities are +30 %. A BIG class sits in the outcrop packs: 7 % of
  candidates where the cluster noise is high, 2.5-5 m tall, drawn only from the kit's four BLOCKIEST subjects.
  - A first try at 3.5-8 m from any subject scaled the flat paving blocks to 24 m plates, which read as blades edge-on.
  - Every block is now held to at most 2.6x as wide as tall.
  - Draw ring: small blocks to 250 m, medium to 450 m, big to 700 m.
  - Near view: 3338 blocks drawn (2128 big, 755 medium, 455 small), 1.33 M triangles, 13 draws.
- **The seating rule.** Blocks used to stand on the DEM, not on the displaced rock mesh, so on the new relief they
  floated or drowned. `surfY()` now gives the drawn surface: the skirt's own displacement, without its smoothing.
  - The ground under a block's footprint is fitted as a PLANE.
  - Its bumps and hollows against that plane are measured at eight points.
  - The block leans 80 % into the slope. Its base goes to the deepest hollow, minus the stand-off its lean leaves
    downhill, minus a sink of 30-45 % of its height.
  - Where the relief under it exceeds half its height, the block GROWS (up to 1.3x) to cover it.
  - Only a block whose top would not clear the ground at its own centre is dropped.
  - A first version measured the slope as relief and dropped 93 % of the blocks; fitting the plane fixed that.
- **The UVs.** The kits are UV-mapped, on a shared atlas from the Sketchfab pack, and some of its faces smear. Under
  `?trond` the kits drop their UVs and wear the mesh way's TRIPLANAR material: the game's `cliff` photograph projected in
  the rock's own frame, its normal map on the same coordinates, tinted to the trondhjemite (0.85-1.15 per block). Nothing
  is left to smear.
- **The vegetation maps** are in `reports/evidence/ROCK-STUDY/vegmaps/`, with a README for the biome session.
  - The frame matches the macro bake: 1.6 km round Mount Ardent, 1024² at 1.56 m a pixel (full resolution 0.78 m from
    `trond_gen.py`).
  - RGBA: rock exposure, vegetation suitability, wetness, soil depth.
  - A class map: bare rock 22 %, crack flora 15 %, heath and dwarf shrubs 19 %, krummholz 24 %, muskeg 0.3 %, forest 19 %.
  - The other session was not reachable from here (no peer listed). The README is the hand-over.
- **Final cost** (SwiftShader, 1280 x 720, no shadows):

  | view | texture reads per ground pixel | ms | triangles | draws |
  |---|---|---|---|---|
  | near | 43.7 | 4406 | 2.21 M | 16 |
  | face | 33.1 | 4278 | 1.91 M | 16 |

  Today is 23-39 reads, ~3.5 s, 0.32 M triangles. The extra triangles are the rock mesh ring (0.5-0.6 M) and the blocks
  (1.1-1.3 M; on a phone they would need the kit's LOD rungs and a 150 m small-block ring).

### 5f. Roughness: bare stone shiny, the green matte (16 Nov)

**The user asked** for good roughness maps: whatever bare stone remains should be much shinier than the green parts,
above all on the flat cliff faces. **The game supports it.** The island's near ring is a `MeshStandardMaterial` with a
PMREM sky probe, and `splat_ground.js` writes each set's roughness into `roughnessFactor` (`glslRough`, the `sheen`
knob). The bench had the same wiring.

Stills: `reports/evidence/ROCK-STUDY/rough/`.

- **The maps** (`trond_gen.py`, from the same height field as everything else; `rough/rough_maps_slab_face.png`):
  - **slab** (the gentle rock): bare 0.50, abraded crowns down to 0.40. Crack fill, lichens, grime, the dirt film and the
    lips push it to 0.9-1.
  - **face** (the cliffs, shinier): water-polished sheets at 0.38, flute crests at 0.33, wet streaks down to about 0.2.
    Slits, ledges and grime are rough.
- **The shader:**
  - Green (moss, grass) is 0.97.
  - SPECULAR ANTI-ALIAS, as `splat_ground`'s: the roughness widened by the pixel's footprint, 0.75 √footprint. At 0.35
    the fine normals glittered.
  - The 3D rocks run their photograph's roughness through 0.42-0.7, and moss on them is 1.0.
- **The sky probe in the bench** (new). It had none, so a smooth surface had only the sun to reflect, and roughness
  barely showed. Now there is a gradient sky pre-filtered by PMREM: `scene.environment`, at intensity 0.55, with the
  hemisphere light at 0.6. This is the game's own probe in miniature, used under `?trond` or `?env=1`.
- `?showrough=1` draws the roughness as grey. `?sunoff=<deg>&sunel=<deg>` move the sun; sun high behind a face is where
  wet rock glints.
- **Cost:** none in texture reads (the roughness rides the normal map's alpha, as in the game). One PMREM bake at load.
- **Caveat:** the sky's reflection tints the stone a little cool on SwiftShader. On the GPU the game's own probe and grade
  decide, and the `sheen` knob is the lever if it reads too glossy.

### 5g. v1: ledges (first try), more rocks to 2 km, what it touches, the performance audit (16 Nov)

**v1 is saved:** branch `claude/rock-study-v1`, stills in `reports/evidence/ROCK-STUDY/v1/`. It is the state the user called
"looks great, maybe apart from the ledges", and the fall-back if the work after it goes nowhere. `?ledges=0` gives v1
without its first-try ledges.

**v1's ledges** (`bench.js stairDY`, first try, superseded in 5h):
- Patches of the exposed rock on 16-54°.
- The height quantised into 5-10 m steps (flat treads, risers in the last half of each step).
- Each 120 m cell has its own random dip, and steps break into segments.
- Treads take green and risers stay bare and darker (`aLedge` -> the shader).
- On faces over ~50° a step spans too few 1.25 m vertices: a comb, so they are left out there.
- The user's verdict: the orientation is random with respect to the slope, and the scale too small.

**More rocks, real geometry to 2 km:**
- +25 % density.
- A far grid (6 m, 9x the odds) out to the patch's edge, big blocks only.
- Each kit subject decimated by vertex clustering into rungs:

  | rung | from | tris/block |
  |---|---|---|
  | full | 0 | ~400 |
  | n = 7 | 200 m | ~245 |
  | n = 4 | 600 m to 2 km | ~100 |

- The triplanar material needs no UVs, so the rungs keep the look. No baking into the land texture (the user prefers
  geometry).
- Near view: 4624 blocks drawn, 1.05 M triangles (was 3338 and 1.33 M without LODs), 39 draws. Decimation takes 14 ms at
  load.

**What the modifications touch, and by what rule** (the user asked). Not "only cliffs": it is the ROCK, decided as follows.
1. **The rock material** (trondhjemite slab/face, weathering, micro detail, roughness) is drawn wherever the rock's weight
   is: the game's terrain types 6 (rock) and 12 (cliff, rock over 32-42°). It applies by WEIGHT, so it blends at the edges.
2. **On the macro extent** (the 1.6 km baked round Ardent in the bench), the EXPOSURE replaces the raster's rock share.
   The exposure is: height (250-760 m), slope (22-48°), convexity (20 m Laplacian), minus the flow field (drainage),
   + 0.3 x the raster's own rock, + noises at 2-40 m. Measured on the extent:
   - the raster says 40.5 % rock; the exposure keeps 28.3 %;
   - where the raster has rock (> 0.5), the exposure averages 0.50, so vegetation now cuts through half of it;
   - where the raster has no rock (< 0.1), 8.4 % of those cells become rock: the high convex steep ground the 10 m
     raster called heath (14 % of heath / scrub cells) or forest (3.9 %);
   - the freed rock area is drawn as heath + forest (0.3 / 0.7) where the raster had nothing else.
3. **The rock mesh** (the 1.25 m skirt, the masses, the ledges) covers the cells where the raster says rock (> 0.3) or the
   slope is over 40°, and on the macro extent wherever the exposure is over ~0.02. It is displaced only by the exposure
   (smoothed over ~5 m), so the green between stays at the DEM. Within 450 m of the eye.
4. **The scattered rocks** follow the talus (a face over 44° within 40 m uphill, concave), outcrop (rock, 20-30°+,
   convex), and edge (the rock's margin) rules, on rock and its surroundings only.
5. **Untouched:** forest, heath, muskeg, beach, shingle, built ground, water. They keep today's material, except at the
   rock's ragged edge.
6. **Island-wide**, the exposure must come from the island's own fields, not a bench bake: see the audit below.

**THE PERFORMANCE AUDIT** (the user: "big loads, big loading times, heavy shader compiles? Or can we keep it lightweight?")

*Runtime* (SwiftShader, 1280 x 720, no shadows):

| | reads/px | ms per frame | triangles drawn | draws |
|---|---|---|---|---|
| today, near | 23.1 | 3259 | 0.32 M | 2 |
| v1, near | 43.6 | 4643 | 1.92 M | 42 |
| v1, face | 32.7 | 4792 | 1.72 M | 42 |

- The rock material alone is CHEAPER than today's (13 vs 39 reads on a face). The extra reads in v1 are the PBR micro
  detail (hex x triplanar: ~15 reads, within 180 m only) and the vegetation's own sets on the half of the old rock now
  green.
- Triangles: the rock mesh is 0.5-0.6 M (1.25 m, 450 m ring) and the blocks ~1 M with LODs. The shadow pass draws them
  again.
- **A phone tier**, not measured on a device:
  - the rock mesh at 2.5 m in a 250 m ring: ~0.08 M;
  - blocks: full rung under 60 m, n = 7 under 200 m, n = 4 to 1 km, small blocks to 120 m: ~0.25 M;
  - no PBR micro detail.

  An estimated +0.3 M triangles and +5-10 reads/px over today.

*Load and build times* (the bench, on this machine's CPU, single thread):
- rock mesh (450 m ring at 1.25 m, the Blender masses and ledges per vertex): **0.8-2.2 s**;
- block placement: **0.6-0.9 s**;
- LODs: 14 ms;
- the bench page in total: 6-8 s, including 13 PNG decodes.

**In the game this must be CHUNKED in a worker**, like the cover ring: 64 m chunks at ~20-60 ms each, built as the eye
moves. As a one-shot build on the main thread it would be a visible hitch. The macro bake (`trond_gen.py`, 30-45 s for
1.6 km in numpy) is offline.

*Textures and memory:*
- The slab and face materials are 2048² x 4 maps: 64 MB uncompressed (85 MB with mips) on the GPU. That is too much for a
  phone; at **1024²** it is 21 MB, and as KTX2 (the game already ships KTX2 for the ground) ~5 MB.
- The macro is 2048² x 3 maps for 1.6 km. It **cannot scale to the island** (39 km at 0.78 m is 2.5 G pixels). Island-wide
  it has to be PROCEDURAL in the shader and in the mesh worker: the joints are warped line sets (a hash per band), and the
  exposure is a function of fields at 10 m. The island packs already carry most of them; flow and curvature would be one
  new 10 m channel (12 MB).

*Shader compile, the real risk:*
- The game's near-ring program is already the long pole on ANGLE/D3D11 (COLD-LINKS: fxc inlines every call; 144 inlined
  fetches were a 110-220 s cold compile; today's 27 fetch sites link in seconds).
- The trondhjemite path adds ~**33 fetch sites**, counted from the code (the bench can't read back the translated
  shader):

  | source | fetch sites |
  |---|---|
  | slab taps | 6 |
  | face planes | 4 |
  | macro | 4 |
  | green | 1 |
  | the PBR micro sSet (hex x 3 planes x 2 maps) | 18 |

  That roughly doubles the sites, which **would** risk the cold compile.
- On SwiftShader the first frame (compile + link) is 1.4-1.7 s for both today and v1, which proves nothing about D3D.
- **Mitigations:**
  - the micro detail as ONE plain-tile biplanar fetch pair (4 sites, not 18);
  - the macro packed into 2 textures;
  - a lean phone variant (`SPLAT_ONE`-style) without the micro detail;
  - measure it with `tools/perf/cold_links_bench.js` on the box before anything lands.

*Samplers, a hard limit:*
- The game's near ring uses **12 of 16** units, the outer ring 14, the premises patch 15 (`splat_ground.js` header, GATE
  SPLAT --gpu ratchet).
- The bench's trond path adds 7. In the game it must be **≤ 4**:
  - slab + face as two more layers in a separate pair of 1024² arrays (colour + height, normal + rough): 2 samplers;
  - the macro packed in 2: (normal xz, vegetation, height) and (colour multiplier, exposure);
  - or, island-wide, the procedural path with one new 10 m channel in the existing packs: **0-1 new samplers**.

**Verdict.** Lightweight is reachable. The material costs about what today's does. The cost is triangles (tiered: ~0.3 M
on a phone) and a chunked worker build. The two real risks are the D3D cold compile and the sampler budget; both have
known mitigations, and both must be measured on the box.

### 5h. v2 ledges: along the contours, big, broken, soft (16 Nov, work in progress over v1)

**The user on v1's ledges:** they "should all be in the direction of the slope", and the problems were "the random
orientation with regard to the slope, and the too small scale"; "break the pattern a lot, otherwise it looks like a
quarry". The reference was the early shader-strata still: contour-following bands. Stills: `reports/evidence/ROCK-STUDY/v2/`.
`?view=ledge` finds the densest ledge patch; `?ledgev=1` gives v1's law; `?ledges=0` none.

- **Orientation.** The steps follow the contours: a dip of 0-4° at most, drifting per 300 m cell, bent by two SMALL warps
  (±4 m at 120 m, ±0.8 m at 40 m).
  - A first v2 used ±8 m and ±3 m warps. A height profile measured down a face showed their gradient reaching ±1.2 m/m
    on a 1.5 m/m slope, squeezing the steps into lumps. Kept ≤ 0.25 m/m now.
- **Scale.** Steps of 8-16 m, up to x1.8 on steep ground, so a step spans 8+ vertices of the 1.25 m mesh. On 15-76°.
- **Broken at four scales:**
  - a 120 m patch mask (about half the exposed rock);
  - 70 % of the beds carry a ledge at all;
  - along a ledge, a 45 m noise cuts it into segments with gaps;
  - each segment has its own strength (0.45-1) and its own riser position (45-75 % of the step).
- **Soft:** the riser takes the last 25-55 % of the step, then two smoothing passes over the mesh.
- **Inside a ledge patch the Blender masses yield** (x0.3), or they drown the steps.
- **Colour follows:** treads take green, risers stay bare and darker.
- **Measured:** 15 % of the rock mesh's vertices are moved by more than 0.3 m, up to 7 m.

**Honest state.**
- In the ledge view the benches read as broken, curved, contour-following steps: no rings, no quarry.
- They are moderate, not bold, and the views of the steep south face show few, because the patches fell on the east face.
- The next lever, if the user wants more: patch coverage and per-bed odds (two numbers in `stairDY`), or a step height
  keyed to the regional joints rather than to noise.
- If v2 does not convince, `claude/rock-study-v1` is the fall-back.

## 6. Recommendation: what to build first, what it costs, what it changes

**Build first: rock clusters in the cover ring.** It changes the most of what an aeroplane sees, for the least risk.

1. **A baked rock kit, as a tree species.** `rock_kit.js`'s generator runs in a prep tool. It bakes ~16 variants x 4
   rungs into the trees pack's own format (`53_tree_codec`: positions, normals, AO byte), plus an **impostor** rung from
   the tree impostor bake (`bakeImpostorAtlasNow`) for > 600 m. The kit then rides everything the trees already have:
   warm, fade, LOD ladder, shadows.
2. **Placement rules in the cover ring, extended**, for talus, outcrop and edge (§5, reading the curvature, flow and
   "face uphill" fields baked per 10 m cell by `island_prep.py`). Beyond the ring's 220 m and above aglOff, an
   **outer rock ring** draws only blocks > 3 m, as impostors, to ~1.2 km. That is what gives a rock skyline from the air.
3. **The cliff cover as CLUSTERS, not single shards** (§5b: the 8x pack layout is the look to bake). This is the fix for the block-field look. Merge 4-8 overlapping
   shards offline into one **cluster mesh** per variant (a few big crag shapes, 3-6 k tris at LOD0), placed along the
   faces. That gives non-convex outlines and continuous faces, and 5-10x fewer instances and draws. The face's ground
   wears the cluster's photograph (the FC5 transfer, §5).
4. **Pay for it on the ground's side.** Hex off on the rock types under the cover (−2/3 of their fetches), biplanar on
   faces (−19 %).

**Its cost, the target to hold in the phone tier** (to be measured on the box, §7): ≤ 250 k rock triangles in view,
≤ 40 draws, impostors past 600 m. One load-time bake per tile. The ground's rock pixels get cheaper, not dearer.

**What it changes:** the rock stands out of the hill with its own shadows and skyline, from the wheels to ~1 km. The
smooth domes with a photograph on them go.

**Second, if the user wants the solver to feel it:** carve the shards' footprint into the DEM at bake (`cliffs.js`'s
"honest" option). That is a terrain-codec chantier, not part of this.

## 7. What SwiftShader cannot show, and what the box should do

- Absolute ms. SwiftShader's numbers are CPU-bound ratios, ±15 % between runs.
- The game's own grade, tone, haze and sky probe.
- MSAA and anisotropic filtering as a GPU does them.

For A0 / a GPU session:
1. Shoot the **real game** at the four eyes of §3, to calibrate BASE.
2. Open `tools/rock_study/bench.html?mesh=1&eco=1` on the box and a phone, and read `BENCH.measure()`.
3. Decide §6 with the user.

## 8. References

1. Quilez, "Biplanar mapping." https://iquilezles.org/articles/biplanar (summary only)
2. Quilez, "Texture repetition." https://iquilezles.org/articles/texturerepetition/ (link only)
3. Golus, "Normal Mapping for a Triplanar Shader." https://bgolus.medium.com/normal-mapping-for-a-triplanar-shader-10bf39dca05a
4. Barré-Brisebois & Hill, "Blending in Detail." https://blog.selfshadow.com/publications/blending-in-detail
5. Heitz & Neyret 2018, histogram-preserving blending. https://hal.archives-ouvertes.fr/LJK/hal-01824773v1
6. Mikkelsen, "Practical Real-Time Hex-Tiling," JCGT 11(3) 2022. https://jcgt.org/published/0011/03/05/paper.pdf
7. three-hex-tiling. https://www.npmjs.com/package/three-hex-tiling
8. "GPU-Friendly Laplacian Texture Blending." https://arxiv.org/pdf/2502.13945
9. "Stochastic Texture Filtering." https://arxiv.org/pdf/2305.05810
10. DowlingSoka, triplanar in UE (80.lv) https://80.lv/articles/a-deep-dive-into-triplanar-mapping-in-unreal-engine ; UE forum https://forums.unrealengine.com/t/how-expensive-is-world-aligned-textures-is-it-okay-to-used-it-in-my-case/1699597
11. Godot triplanar stochastic terrain. https://godotshaders.com/shader/triplanar-stochastic-terrain-shader/
12. Godot uniplanar dithered. https://godotshaders.com/shader/uniplanar-mapping-with-dithered-blending/
13. Mishkinis, "Advanced Terrain Texture Splatting." https://gamedeveloper.com/programming/advanced-terrain-texture-splatting
14. Epic, Landscape material expressions. https://dev.epicgames.com/documentation/unreal-engine/landscape-material-expressions-in-unreal-engine
15. Unity HDRP Terrain Lit. https://docs.unity3d.com/Packages/com.unity.render-pipelines.high-definition@12.1/manual/Terrain-Lit-Shader.html
17. Carrier, "Procedural World Generation of Far Cry 5," GDC 2018. https://gdcvault.com/play/1025557/Procedural-World-Generation-of-Far
19. FC5 talk notes. https://christianjmills.com/posts/procedural-tools-far-cry-5-notes/
20. Moore, "Terrain Rendering in Far Cry 5," GDC 2018. https://gdcvault.com/play/1025480/Terrain-Rendering-in-Far-Cry
21. van Muijden, "GPU-Based Run-Time Procedural Placement in Horizon Zero Dawn," GDC 2017. https://www.guerrilla-games.com/read/gpu-based-procedural-placement-in-horizon-zero-dawn
25. Werle & Martinez, "Ghost Recon Wildlands: Terrain Tools," GDC 2017. https://gdcvault.com/play/1024029/
29. Strugar, CDLOD, JGGT 14(4) 2009 (citation only).
30. Losasso & Hoppe, "Geometry Clipmaps." https://hhoppe.com/proj/geomclipmap/
31. Asirvatham & Hoppe, GPU Gems 2 ch. 2. https://developer.nvidia.com/gpugems/gpugems2/part-i-geometric-complexity/chapter-2-terrain-rendering-using-gpu-based-geometry
35. Epic, Runtime Virtual Texturing. https://dev.epicgames.com/documentation/unreal-engine/runtime-virtual-texturing-in-unreal-engine
36. Web3DSurvey, WebGL2 MAX_VERTEX_TEXTURE_IMAGE_UNITS. https://web3dsurvey.com/webgl2/parameters/MAX_VERTEX_TEXTURE_IMAGE_UNITS
42. Houdini Slump / Erosion / Scatter. https://www.sidefx.com/docs/houdini/heightfields_cop/slump.html
44. Brucks, "Octahedral Impostors." https://shaderbits.com/blog/octahedral-impostors
45. three.js octahedral impostors. https://discourse.threejs.org/t/octahedral-impostors-for-three-js/80318
46. three.js InstancedMesh. https://threejs.org/docs/api/en/objects/InstancedMesh.html
47. Sobotta, Uncharted 4 rock kit. https://jaredsobotta.artstation.com/projects/4965R1
48. Epic Kite demo assets. https://www.unrealengine.com/blog/marketplace-content-release-april-2
50. GamersNexus, Sean Tracy on POM (Star Citizen). https://gamersnexus.net/gg/2636-citizencon-parallax-occlusion-mapping-sean-tracy-interview
53. Fuentes, "Designing the Terrain System of Flight Simulator," GDC 2022. https://gdcvault.com/play/1027838/Advanced-Graphics-Summit-Designing-the
54. MSFS DevSupport, cliff mapping. https://devsupport.flightsimulator.com/t/sdk-what-controls-cliff-mapping/10753
55. MSFS forum, stretched cliff textures. https://forums.flightsimulator.com/t/stretched-textures-on-mountains-and-cliffs-walls/422633
57. X-Plane 12 material model. https://developer.x-plane.com/article/the-x-plane-12-material-model
58. Outerra, horizontal displacement. https://outerra.blogspot.com/2009/11/horizontal-displacement-2.html
59. FlightGear procedural texturing / ALS. https://wiki.flightgear.org/Procedural_texturing
62. POM cost (UE forum). https://forums.unrealengine.com/t/boost-your-parallax-occlusion-mapping-performance/215713
63. Arm forum, dependent texture reads. https://community.arm.com/support-forums/f/graphics-gaming-and-vr-forum/52704/dependent-texture-reads-performance
64. Arm, Bifrost shader core. https://developer.arm.com/community/arm-community-blogs/b/mobile-graphics-and-gaming-blog/posts/the-mali-gpu-an-abstract-machine-part-4---the-bifrost-shader-core
66. Harris, "Texture sampling tips." https://solidpixel.github.io/2022/03/27/texture_sampling_tips.html
73. Dowell, RVT mesh-terrain blending. https://andrewdowell.blogspot.com/2025/02/how-to-blend-assets-with-your-landscape.html

(The numbering follows the research pass's full list; numbers left out were not cited here.)
