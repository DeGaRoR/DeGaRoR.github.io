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

## 6. Recommendation: what to build first, what it costs, what it changes

**Build first: rock clusters in the cover ring.** It changes the most of what an aeroplane sees, for the least risk.

1. **A baked rock kit, as a tree species.** `rock_kit.js`'s generator runs in a prep tool. It bakes ~16 variants x 4
   rungs into the trees pack's own format (`53_tree_codec`: positions, normals, AO byte), plus an **impostor** rung from
   the tree impostor bake (`bakeImpostorAtlasNow`) for > 600 m. The kit then rides everything the trees already have:
   warm, fade, LOD ladder, shadows.
2. **Placement rules in the cover ring, extended**, for talus, outcrop and edge (§5, reading the curvature, flow and
   "face uphill" fields baked per 10 m cell by `island_prep.py`). Beyond the ring's 220 m and above aglOff, an
   **outer rock ring** draws only blocks > 3 m, as impostors, to ~1.2 km. That is what gives a rock skyline from the air.
3. **The cliff cover as CLUSTERS, not single shards.** This is the fix for the block-field look. Merge 4-8 overlapping
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
