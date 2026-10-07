# THE GRASS STUDY: density, size, colour, distance (G2550, 2026-10-07)

A0's GRASS-STUDY, a cloud session (code reading, node measurements and web research; no GPU, nothing rendered). Branch
`claude/grass-study-g2550`, numbers G2550-G2559. The box session that implements this is GRASS-DENSE, G2560-G2579 (§6).

The user: *"The grass looks bad right now. Because it's too big, and there's not enough of it ... the grass takes the
ground color better, they generate variations in grass length according to the ground type, and they have a high density
of shorter grass. They also handle wild grass and cut grass ... We'll consider our grass MODEL is good enough, but our
density, coloration, size distribution are all wrong ... Under strict requirement of minimal performance impact, we should
have a lot more grass - I estimate a factor 10 in density. The color blending is essential for not having the feeling that
a jungle just grows in front of the plane when it gets close to the ground. Also study the optimal acceptable distance for
showing grass."*

**The hard rule this study keeps:** the MODEL stays. That means the reed's cards, their curved strips, the mask texture,
the material, the tint path and the shading (`GRASS-PORT-CONTRACT-2026-09-23.md`; the user rejected a shading rewrite). Everything
below changes **parameters and distribution**: how many cards stand where, at what size, wearing which colour, out to what
distance. One proposal (§4.2, the tuft) regroups the shipped cards into smaller instances. No card is redrawn, no vertex
moves inside a card, and no new texture is added. Where a proposal comes near the look of a card (the root blend, §4.5), it
is an editor dial that defaults to off (identity), and the user turns it on or not.

---

## 0. The answer in one table

| | today (gamer, the default preset) | proposed (gamer) | today (retro, the laptop) | proposed (retro) |
|---|---|---|---|---|
| what stands | 3 reed **patches**: 16 / 36 / 81 cards in a 1.5-2.9 m disc, **1.08-1.17 m tall** | **tufts** of 3 of the same cards, **~0.30 m** meadow (0.06-0.45 m by ground type) | same as gamer | same as gamer |
| cards per m² (in a grass biome, after the blotch) | ~23 | **~234 (x10)** | ~12 | ~141 (x12) |
| height spread | +-8 % (`coverSpread` 0.08, uniform) | lognormal sigma 0.10 (cut) - 0.40 (wild), plus a clump field | same | same |
| colour | the set's **mean** at a 4 m node x lift 0.29 (NOT the ground as drawn) | the **drawn ground's** mean at the foot (imagery + grade + normalisation), bilinear; root blend dial | same | same |
| full density to / gone at | 50 m / 220 m (3-D) | 15 m / 90 m (3-D), + screen-size fade | 50 m / 120 m | 8 m / 50 m |
| height term | full below 60 m AGL, gone at 150 m | full below 27 m, gone at 90 m (= the reach) | 60 / 150 | 15 / 50 |
| submitted triangles, the stand | **12.2 M** (model) | **6.9 M (-44 %)** | **3.02 M (measured, ?diag)** | **2.4 M (-21 %)** |
| card pixels, the stand (fragments the mask runs on) | 14.5 M (overdraw 7.0) | 9.2 M (-37 %) | 4.8 M | 2.9 M (-40 %) |
| grass draws, the stand | ~19 | ~36 (+17) | ~12 | ~17 (+5) |
| instances held (memory) | ~46 k (3.7 MB) | ~280 k (22 MB) | ~8 k (0.7 MB) | ~70 k (5.6 MB) |

So the proposal **costs less than today in every GPU unit** we can count: triangles, card pixels and opaque pixels, at every view.
It gives up **draws** (+5 retro, +17 gamer: the near grass needs smaller blocks), **memory** (+5 / +19 MB) and **planting CPU**
(more, smaller instances), and §5 names each. The headroom comes from three things. Today's ring submits every instance in
a visible 128 m block, including the ~70 % the fade has already shrunk to nothing. It plants 1.1 m patches out to 220 m,
where they are only clumps. And at 10-60 m AGL it still draws 11-12 M triangles that the eye barely resolves.

---

## 1. What the games do (sources)

The egress proxy refused most primary sources from this container (GDC Vault, Unity's and Epic's manuals, Guerrilla's PDF,
the DCS site, the three.js forum). What follows is what the search results quote from them, linked. Numbers that come from
memory or from a community reimplementation are marked **(guess)** or **(community)**.

### 1.1 Flight sims

| sim | what the grass is | numbers | cut vs wild | the approach |
|---|---|---|---|---|
| **DCS World** | procedural grass (since Caucasus 2.5). ED's January 2024 newsletter: "improvements to procedural grass diversity and shading", "grass blades now bend", better "grass distribution across terrain tiles", to ship in the Terrain Development Kit ([ED newsletter](https://www.digitalcombatsimulator.com/en/news/newsletters/63fca5e01582bca2164456d79b1f36fa)) | the **Clutter/Grass** slider is the grass **density** per the JP settings wiki ([wikiwiki](https://wikiwiki.jp/dcs-world/GameSetting)). In 1.2.0 the clutter distance "can now go to 1500 m" ([forum 2012](https://forum.dcs.world/topic/72746-dcs-world-high-density-grass/)). A 2020 bug report: grass only ~50 m round the aircraft ([forum](https://forum.dcs.world/topic/254866-cluttergrass-slider-has-no-effect/)) | players' standing complaint: airfield grass "way too tall", clipping through wings, and requests for "smooth, short, cut grass" in large airfields' infields ([shorter grass](https://forum.dcs.world/topic/284173-shorter-grass/), [Germany airfield grass](https://forum.dcs.world/topic/372497-minor-clean-up-of-germany-terrain-rocks-airfield-grass)) | short-range clutter plus the terrain texture beyond it. The cut / wild split is exactly what DCS users ask for and lack |
| **MSFS 2020 / 2024** | "Grass and Bushes" Off / Low / Medium / High / Ultra, one of the most frame-sensitive rows. Guides recommend Medium: "barren" when off ([FlyAwaySimulation](https://flyawaysimulation.com/ask/answers/best-graphics-settings-msfs-2020/), [VR guide](https://forums.flightsimulator.com/t/vr-bang-for-buck-performance-guide/315982)) | no official radius found. MSFS 2024's grass "seems to be drawn in clusters (or blocks)", so no sharp corners ([devsupport](https://devsupport.flightsimulator.com/t/grass-issues/12279/7)) | grass over runways and taxiways is a recurring bug class ([FACT](https://forums.flightsimulator.com/t/grass-on-runways-and-taxiways-cape-town-fact/726826), [EHLE](https://forums.flightsimulator.com/t/grass-across-taxiway-at-ehle/740099), [overgrown runway grass](https://devsupport.flightsimulator.com/t/overgrown-runway-grass/10462)), so its masks are by surface | **density grows as you approach**: "trees gradually as you approach ... until a maximum density is reached ... the ground textures at a distance give sufficient realism" ([tree LOD thread](https://forums.flightsimulator.com/t/tree-draw-distance-lod-issues/300672)). That is a fade **by density**, not by height pop |
| **X-Plane 12** | no native 3-D grass slider found. "Forests" sets all vegetation's density, and the sim caps a forest's distance by its own internal maximum ([forest .for spec](https://developer.x-plane.com/article/forest-for-file-format-specification)) | the 3Dgrass plugin's controls (vendor text): draw distance, density, spacing, **fade behaviour**, max instances, **grass height scaling**, slope tolerance, **road and pavement margins** ([3Dgrass](https://payhip.com/b/8RhFH)) | pavement margins | the plugin's dial list is close to the one §4 proposes |
| **IL-2 Great Battles** | `grass_distance` in startup.cfg, plus 4 grass presets (off / normal / distant / ultra) | **300 m** at ultra (community), 425-600 m tried, flicker past ~800 m ([forum](https://forum.il2sturmovik.com/topic/65392-increasing-the-draw-distance-for-grass-and-shadows), [preset request](https://forum.il2sturmovik.com/topic/70700-add-a-higher-quality-grass-preset/)) | - | a radius in metres, the cost the user's |

**What the sims agree on.** Grass is a NEAR effect. Its radius runs from tens to a few hundred metres, and the ground
texture carries the field beyond it. It fades in by **density** as the aircraft nears, and pavements and runways are
masked out. Every sim's users complain about tall wild grass at airfields. None of the sims publishes its blade height or
density numbers.

### 1.2 Open-world games and engines

| source | density / distance | height & clumps | colour from the ground | LOD / cost |
|---|---|---|---|---|
| **Ghost of Tsushima**, *Procedural Grass* (Eric Wohllaib, GDC 2021, [Vault](https://gdcvault.com/play/1027214/Advanced-Graphics-Summit-Procedural-Grass)) | blades generated on the GPU per render tile. A 2025 course deck that reproduces the talk (**community**, [GDL deck](https://projet.liris.cnrs.fr/origami/topics/gdl/gdl_talk_49/GDL26.03_2025.pdf)): "1M grass blades, 83k rendered, 2.5 ms (PS4)", tiles of 512x512, culled by distance, frustum and occlusion | **Voronoi clumps** drive the height, a direction per clump, an offset. "When grass is short, much denser" | per-blade **clump colour**, base-to-tip colour (Godot reimplementation, [GodotGrass](https://github.com/2Retr0/GodotGrass)) | high LOD 15 verts, low LOD 7 verts per blade, a blade removed before the transition |
| **Horizon Zero Dawn**, *GPU-Based Run-Time Procedural Placement* (van Muijden, GDC 2017, [slides](https://www.guerrilla-games.com/media/News/Files/GDC2017_VanMuijden_GPUBasedProceduralPlacementInHorizonZeroDawn.pdf), [80.lv](https://80.lv/articles/real-time-procedural-placement-in-horizon-zero-dawn)) | **density-based** placement generated around the player, data-driven, **deterministic, locally stable** (our cells already are) | from density maps per asset | the slides were not readable here | GPU placement per frame region |
| **Far Cry 5** ([PlayStation blog](https://blog.playstation.com/archive/2018/03/22/how-the-stunning-open-world-of-far-cry-5s-hope-county-montana-was-created)) | procedural biome recipes | "**terrain humidity reflected in the grass**", grass oriented along a wind vector map | humidity-driven | - |
| **Unreal** Landscape Grass Type ([FGrassVariety](https://dev.epicgames.com/documentation/unreal-engine/API/Runtime/Landscape/FGrassVariety), [open-world tips](https://dev.epicgames.com/documentation/unreal-engine/open-world-tools-tips-in-unreal-engine)) | density in "**instances per 10 m²**". Default 400 = 40 / m² **(guess, from memory)**. Start / End Cull Distance: the instances fade between them **only through PerInstanceFadeAmount** (a material term). Default end 10 000 cm = 100 m **(guess)**. Per-scalability-level density and cull (`GrassDensityQuality`, `EndCullDistanceQuality`). `Foliage.MinimumScreenSize` culls by **screen size** | per-variety scale ranges | the standard is the **Runtime Virtual Texture**: the landscape writes its colour, and grass and meshes read it to blend ([RVT](https://dev.epicgames.com/documentation/unreal-engine/runtime-virtual-texturing-in-unreal-engine), [RVT quick start](https://dev.epicgames.com/documentation/unreal-engine/runtimevirtual-texturing-quick-start-in-unreal-engine): "blending of non-Landscape Actors with your Landscape") | clusters culled whole past the end distance |
| **Unity** terrain details ([terrain grass](https://docs.unity3d.com/cn/2022.3/Manual/terrain-Grass.html), [other settings](https://docs.unity3d.com/2019.1/Documentation/Manual/terrain-OtherSettings.html), [DetailPrototype](https://docs.unity3d.com/kr/2023.1/ScriptReference/DetailPrototype.html)) | Detail Distance (culled past it). Default 80 m **(guess)**, a third-party range of 0-250 m. Detail Density (0-1, a global scale) | min / max width and height per prototype | **Healthy / Dry colour** blended by a noise and by the mesh's size (not under GPU instancing). Grass takes the terrain's normal underneath so its shading matches the ground | detail patches per batch |
| **three.js community** ([1 M blades](https://discourse.threejs.org/t/real-time-grass-simulation-in-the-browser-over-1-million-blades-at-60-fps/82808), [3 M instanced](https://discourse.threejs.org/t/performance-optimizing-3m-instanced-grass-in-three-js/81286), [WebGPU plugin](https://discourse.threejs.org/t/migrating-my-grass-system-to-webgpu-and-making-a-robust-grass-plugin/92893)) | ~1 M blades at 60 fps as ONE merged geometry. Tiles to "infinite" distance with LOD **crossfade** and per-blade frustum culling | - | base / tip colours | **(community)** |
| **NVIDIA Turf Effects** ([GameWorks](https://developer.nvidia.com/content/nvidia-turf-effects)) | - | - | - | continuous LOD, 3 to several hundred tris per blade |

### 1.3 What we take from them

1. **Short grass, many instances, near.** Every reference keeps grass short near the camera and thins it by **density**
   with distance. Ghost of Tsushima: "when grass is short, much denser". Unreal and Unity: a density per area and a cull
   distance. Ours is the opposite: 1.1 m patches, one per ~2 m², planted full out to 220 m.
2. **Length by ground type and by clump.** Ghost of Tsushima's Voronoi clumps set the height. Far Cry 5's humidity
   reaches the grass. Unity's healthy / dry colours vary with size. Ours: one height everywhere, +-8 %.
3. **The colour is the terrain's.** Unreal's RVT blend, Unity's terrain normal, Ghost of Tsushima's clump colour. The
   field emerges from the ground colour, so a meadow does not "stand up" as the aircraft descends.
4. **Distance by screen size.** `Foliage.MinimumScreenSize` and the sims' 50-300 m radii: grass is drawn while a blade is
   a few pixels tall and given back to the ground texture past that.
5. **Cut vs wild is a mask from the map.** MSFS by surface, X-Plane's pavement margins, DCS users asking for mown
   infields.

---

## 2. Our numbers today, measured from the code

All file references are to train 40 (`bcf6279`). Scripts: `tools/perf/grass_study/` (node only, see §7).

### 2.1 What is planted (`src/viewer/cover_ring.js` buildCell, `src/core/trees_pack.json`)

- **One grass species in every grass biome:** `grass_reed` (`grass_patches.glb`, DJMaesen CC-BY-4.0). Its mix row is
  `{ proportion 0.4, density 0.48, patch 0, size 0.75 }` in conifer, deciduous, muskeg, borders, conifer_young,
  conifer_steep, conifer_scrub, village and city_trees. **Grassland's own row is `{ proportion 0.85, density 0.48, size 0.6 }`.**
  Scree, shore and shingle carry no cover (`forest.cover 0`).
- **Count per m²** = row.density 0.48 x `forest.cover` 1 x the ring's `density` (full 2, lean 1; G484) = **0.96 / 0.48
  planted**. Then the **blotch**, `1 - 0.6 x (0.5 + 0.5 x vnoise(18 m))`, keeps 40-100 %, mean **0.55**: **0.53 / 0.26
  patches per m²**, in clearings and thickets of ~18 m. (No proportion on a cover, as the bench.)
- **The instance** is one of 3 patches, drawn with equal weight. Decoded off `media/geo/trees/grass_reed.6a745c82.gz.bin`
  (`reed_geo.js`, `reed_cards.js`), at the shipped scale 0.012 x 0.75 = 0.009:

  | subject | cards | tris | footprint | top | card top p10 / p50 / p90 | opaque blade area (side) | its median height |
  |---|---|---|---|---|---|---|---|
  | grasspatch3 | 81 | 1157 | 2.59 x 2.93 m | 1.17 m | 0.49 / 0.77 / 1.06 m | 2.03 m² | 0.35 m |
  | grasspatch1 | 36 | 517 | 2.12 x 2.15 m | 1.14 m | 0.43 / 0.66 / 1.06 m | 0.91 m² | 0.30 m |
  | grasspatch2 | 16 | 236 | 1.45 x 1.53 m | 1.08 m | 0.42 / 0.73 / 1.06 m | 0.31 m² | 0.32 m |
  | **mean** | **44** | **637** | | | | | |

  A card is a curved strip of **~14.4 triangles**, 0.63 m wide and ~0.76 m to its top at this scale: one tuft picture
  from the 1024² atlas (5 tufts in it). The mask keeps **~12 %** of a card's area (`reed_alpha.py`: alpha > 0.3, the
  material's cutoff). So most of the fragments the card costs are discarded texels. The atlas's kept texels average sRGB
  (0.45, 0.35, 0.20), the "golden" reed.
- **Size distribution:** `place.size x row.size x exp(U(-1, 1) x coverSpread 0.08)`. Every patch is the same height to
  +-8 %. There is no per-ground-type length (the village row's comment speaks of one, but no shipped mix uses it except
  grassland's 0.6) and no clump-level height.
- **Cards per m²** (in a grass biome, after the blotch): 0.53 x 44 = **~23**, each 0.6-1.1 m tall, in 2.6 m clusters.

### 2.2 The colour (`cover_ring.js` colAt / lifted, `trees.js` TINT_GLSL)

- Per instance, `instanceColor = lifted(G.col[node], lift 0.29)`. The max channel is capped at 0.7, then x (1 +- vary
  0.03). `G.col` is read at the **nearest node of a 4 m lattice** (`subGrid`, SG = 4) and is
  `GF.groundColor(the code row's two set means, sRGB-encoded (G551), by mixK) x GF.shade (hue turn, value)`.
  Code 10 (built) and points with no CODES row read the island imagery's colour (`imageryAt`).
- The material then multiplies the **texel**, tinted: hue 0, sat 0.15 x COVER_BASE 1.58, light 3 x 1.12 = 3.36, the
  texel pulled 65 % toward the map's own mean (`contrast` 0.35 = uFlat), then the kind's master (identity).
- **What the ground draws instead** (`splat_ground.js`): the same sets, but **graded** (uSGrade) and **normalised to the
  imagery** per set (`normGains`, 0.15-2.5 per channel). Near the eye they are then **blended toward the 10 m Landsat
  macro's colour AND brightness** (`macroNear` / `macroLum`: "mac x rel is the imagery's colour and brightness wearing
  that texture"), plus the wet margins and banks.
- **So the tuft and the ground under it come from two different sums.** The tuft carries the set's catalogue mean (one
  value per code and blend, at 4 m), while the ground near the eye carries the imagery's green valley and brown slope at
  10 m. This is the colour half of the "jungle". Where the imagery is darker, greener or browner than the set mean, the
  grass is a different colour from the ground it stands on, and from 10-60 m AGL a 1 m patch is a 10-30 px object of
  that colour.

### 2.3 Distance, height, the fades (`trees.js` FADE_VS, `cover_ring.js` update)

- `_fd` = the **3-D** distance from the instance's origin to the camera. `keep = (1 - t)^(1 + 2 taper)`,
  t = (d - near) / (reach - near), with **near 50 m, reach 220 m (lean 120), taper 0.5** (exponent 2), times the height
  term `1 - smoothstep(aglFull 60, aglOff 150, AGL)`.
- **The 2026-09-26 triage's "60 m / 40 %" rules, as the code has them.** Grass is at full strength only below **60 m
  AGL** (aglFull), fading to none at 150 m. A grass **track or grass road** keeps **40 %** of the cover at its centre line
  (`k x 0.6` in both coverAt's, `20_world.js` and `27_premises.js`), rising to 100 % over the 6 m fade. Since G665 a
  grass **strip's surface** keeps **0 %** (the user's "the runways should be able excluding the grass"). The "hard pop" was
  G670's target: the threshold is now a **shrink** through a band of 0.25 about the tuft's foot, and a new cell grows in
  over 0.8 s. (The brief calls A2-FADES a dithered fade-in. It is a shrink, not a dither.) The ring is planted below
  260 m AGL while hidden (G671, 2 ms a frame) and ordered by where the eye will be in 4 s.
- **The pop that remains** (playtest report line 271): at 100 m AGL the nearest tuft is 100 m away in 3-D, already half
  through the taper (`keep` ~0.5 x the height term 0.53). The field's density is set by the height dial, but what the
  eye sees is 1.1 m patches 10-30 px tall, in a colour that is not the ground's.

### 2.4 Cut and wild (`27_premises.js` coverAt / ZONE_GRASS, `20_world.js` coverAt)

| place | today |
|---|---|
| pavement (asphalt / concrete / gravel / dirt / sand) + its band (1.5-2.5 m) | kill 1 (none), falling to 0 over 6 m |
| the **verge**: 0-12 m past the band | a **boost** bump to +70 % (the user: grass encouraged on borders) |
| grass track / grass road | thinned to **40 %** at the centre (the wild reed, mown nowhere) |
| grass **strip** surface (premises) | **none** (G665) |
| analytic world's grass strips | thinned to 40 % |
| plot lawn: residential 0.12 m x1, commercial 0.15 x0.8, park 0.10 x1.2 | **grass_dry** tussocks (8-20 tris), `LAWN_D` 6 / m² x the rule's density, height 0.85-1.15 x the rule |
| industrial, harbour plots | none |
| airfield, forest, clear zones | 'meadow': the biome's wild reed, 1.1 m |

Two findings. (1) **The airfield's own grass is the biome's 1.1 m wild reed**, right up to the runway's 6 m fade, which
is the DCS complaint. (2) **The lawn plants `grass_dry`**, which the reed-only ruling (the contract §1) says is
"planted nowhere". It is a premises lawn, not a biome, so it may be intended, but it is a second species with a second
colour response, and it is the user's to confirm (§4.6).

### 2.5 The presets (`src/viewer/gfx_settings.js` :426, DEFAULT = 'gamer')

| preset | cover row | the ring set() |
|---|---|---|
| ultra, gamer, current | full | reach 220, density 2, castMinH 0.35 |
| retro | lean | reach 120, density 1, castMinH 1 |
| potato, laptop | off | - |

### 2.6 The cost today

- **Measured (the box, RTX 3080, retro 1632x918, the stand; `tools/perf/hwcov/diag_retro_1080_box.json`, ?diag):**
  base 6.05 M tris / 333 draws, `cover=off` **3.02 M / 295**. So the cover ring is **3.02 M triangles and 38 draws**
  (grass + flowers + rocks + debris + shrubs). The GPU delta is within the 3080's noise (12.8 vs 12.8 ms). The
  **laptop's** cover delta was never measured: the user's `?diag=quick` on the GTX 1660 Ti gives it in one row
  (`cover off`).
- **The model** (`cost_model.js`, calibrated on that one measurement: land share 0.44 at the stand) puts gamer's grass at
  **~12.2 M triangles** at the stand. That matches a stand total of 41.9 M triangles on the full preset (G505's visibility
  contract, HANDOVER, 2026-09-22) and G603's "66 000 tufts at the stand".
- **Where it goes.** The vertex shader runs for every instance of a visible block, including the ones the fade has
  collapsed to nothing (FADE_CUT_VS only throws the triangle off screen after the vertex work). Blocks are 128 m. Today's
  ring therefore pays for ~95 % of its area beyond 50 m, where `keep` is falling, and at 30 m AGL it still submits 12 M
  triangles for 0.2 Mpx of grass.
- The bench's sweep (GRASS-RULING-2026-09-20) measured the reed **alone** at 0.48 / m² in an 80 m disc: 3.7 ms (flight
  eye) / 3.0 ms (low eye) on the 3080. That was the bench (BLEND), not the game, and it is the only ms number for the reed
  in existence.

---

## 3. The diagnosis

1. **Too big.** The visible unit is a 2.6 m wide, 1.1 m tall patch. Each card is 0.6-1.1 m. From the cockpit at taxi a
   card fills 40-120 px. From 30 m AGL a patch is still 10-40 px, an object rather than texture.
2. **Not enough of it, unevenly.** 0.53 patches / m² in 2.6 m clusters, and the blotch takes 45 % away in 18 m holes.
   It reads as tall clumps with bare ground between.
3. **One length everywhere** (+-8 %). A forest floor, a muskeg, a verge, a lawn's edge and an airfield all grow the same
   1.1 m reed.
4. **The colour is not the ground's** (§2.2). It is the set mean, not the imagery-graded ground the eye sees, so the
   field arrives as a different colour, and arrives big: the "jungle".
5. **The cost is in the wrong place.** About 70 % of the triangles are instances the fade has already collapsed, and the
   reach (220 m) is ~2x the distance at which even today's 1.1 m patch is more than a few pixels of grass.

---

## 4. The proposal

### 4.1 The rule for distance (the "optimal acceptable distance")

A tuft is worth drawing while it is a few pixels tall, and worth drawing at full density while its blades read (~12 px).
With the game's camera (vertical FOV 46°, `app.js`), the focal length is f = H / (2 tan 23°) = **1272 px at 1080 rows**
(x the render scale):

| tuft height h | gone (3 px): f h / 3 | thin (4 px) | full (12 px): f h / 12 |
|---|---|---|---|
| 0.06 m (mown strip) | 25 m | 19 m | 6 m |
| 0.10 m (lawn) | 42 m | 32 m | 11 m |
| 0.20 m (forest floor) | 85 m | 64 m | 21 m |
| 0.30 m (meadow) | 127 m | 95 m | 32 m |
| 0.45 m (verge, sedge) | 191 m | 143 m | 48 m |
| 1.1 m (today's patch) | 466 m | 350 m | 117 m |

So **a reach of ~90-100 m for a 0.30 m meadow at 1080p is the pixel rule's answer**, and the ground carries everything past it.
That is the sims' 50-300 m, and Unreal's screen-size cull. Because the 3-D distance already contains the height, **the AGL at
which grass stops is the reach itself**: from 90 m up there is nothing within 90 m. The height term then only drops the
ring (`aglOff = reach`). It no longer decides the look, so the approach sees the field emerge by density (the shrink band, as
G670) over the last ~60 m of descent, in the ground's colour.

**The screen-size fade (new dial `sizeFade`, 0-1, default 1 on the new layer):** FADE_VS divides `_fd` by the instance's
own scale over a reference (`length(instanceMatrix[1].xyz) / hRef`). A lawn tuft then fades at a third of a meadow's
distance and a verge's at 1.5x, so per-ground-type distances fall out of the heights with no per-type distance dial. It is
vertex work only, one length per vertex. 0 = today's distance-only rule.

### 4.2 The tuft: the same cards, a smaller unit

Cut the three shipped patches into **tufts of 3 neighbouring cards** at load, in `protosOf`, from the bin already
decoded. `tufts.js`: 133 cards → 45 tufts, **42.4 triangles** each, 3 cards within ~0.2 x the patch radius. Each tuft's
vertices, normals, UVs and material are the patch's own, a subset of its index buffer. **No vertex is moved, no card
changed, no texture added.** Keep **3 tuft variants** (the three closest to the median tuft) per draw, as today's three
patches, so the variety per draw stays what it is, rotated and sized per instance.

*Why not just scale the patches down?* The patch is 637 triangles. Ten times the patches at a third of the height costs
10x the vertices for the same area of grass. The tuft has the patch's cards per m² at 15x fewer triangles per instance. Its
vertex density per m² of ground is the same as today's at equal cards, and its pixels per card drop with the square of
the size.

### 4.3 Density and the near band

- **Target: cards per m² x10 near the eye** (the user's factor). Today ~23 cards / m² at 0.6-1.1 m; proposed **~234 cards / m²
  = 78 tufts / m² at ~0.30 m** (meadow, after the blotch), with **full density to `near`**, then `(1 - t)^3` (taper 1)
  to `reach`.
  In tufts per m² (the visible clump) it is x150 the patches. In opaque blade area per m² it is ~1.0x today's (x10 cards
  x 0.32² of a card's area: the tuft's scale 0.0029 against 0.009), so the sward is **as much grass, ten times as many
  pieces, a third the height**, closing to the ground at 15-30 m from a 1.7 m eye where today's
  1 m patches are a wall at 10 m.
- **The blotch for grass: amount 0.6 → 0.3** (keeps 70-100 %). The 18 m holes are much of "not enough grass". It stays
  a dial per biome (TYPES > biome, the forest row), and the flowers and rocks keep theirs.
- **Clumps:** a height field per tuft, `1 + clumpAmp x (vnoise(x / clumpM, z / clumpM) - 0.5) x 2` (clumpM 4 m, clumpAmp
  0.3), from 28b's own noise. It is deterministic, and the bench's and the splat's fields stay untouched (GF.blotch's
  seed space is unused). This is the Ghost of Tsushima clump without the Voronoi: neighbouring tufts share a length.

**The machinery that makes x10 affordable (no look change in any of the first three):**

1. **The count truncation** (do this first, on today's grass, alone). Today `aRand` is the threshold: an instance is
   whole while `keep (1 + band) > aRand`. Sort each block's instances by `aRand` (a counting sort into 32 bins at
   buildBlock), then set `mesh.count = ceil(n x min(1, keep(dmin) (1 + band)))` per frame, where dmin is the block's
   nearest 3-D distance. Only the instances that would be collapsed are not submitted, so **the picture is identical to
   the pixel** (GATE COVER can hold it). The model: **gamer -30 % triangles, retro -16 %**, before anything else changes.
   `aBorn` and `instanceColor` are sorted with the matrices.
2. **Small blocks for the grass.** The near band must not submit a 128 m block whole. The grass layer gets its own cells
   (16 m) and blocks (2x2 = 32 m). Rocks, debris, shrubs and flowers stay on 32 m cells and their batches. Draws: ~36 for
   gamer and ~17 for retro at the stand, against ~19 / ~12 (§5).
3. **Tiered planting** (memory and CPU). Planting x10 at full density out to the reach would hold 1.2 M instances (97 MB)
   on gamer. Instead a cell keeps only the candidates whose `aRand < min(1, keep(its nearest distance) x 1.25)`. The
   candidate stream is fixed (hashed on the cell), so a tier is a prefix of the next, nested by construction. When the eye
   comes closer, the cell adds the next slice of the same stream rather than re-planting. The picture is the full
   planting's, and ~280 k instances are held on gamer (22 MB), ~70 k on retro (5.6 MB). The rand test comes before any
   lattice lookup, so a rejected candidate costs one hash.

### 4.4 Height by ground type (wild vs cut)

Heights are each tuft's **top** in metres. `s = h / 103.8 u` (the tuft's mean top in the patch's units).
Lognormal: `h x exp(sigma x N(0, 1))`, clipped at +-2.5 sigma, x the clump field. The density factor multiplies the
near density. The CODES and mixes are 28b's and trees_pack's.

| ground (code → mix) | today | proposed h | sigma | density x | notes |
|---|---|---|---|---|---|
| heath (2 → grassland) | 0.93 m patch (size 0.6) | **0.30** | 0.35 | 1.0 | the meadow, the reference |
| scrub (7), scrub dense (14) → muskeg / conifer_scrub | 1.17 m | 0.35 | 0.35 | 0.9 | |
| muskeg (3) | 1.17 m | **0.40** | 0.30 | 0.8 | sedge-like. x1.3 within 6 m of a pool (`poolAt` 0.2-0.6), clumpM 1.5 m (tussocks), clumpAmp 0.4 |
| forest (8), old forest (13), conifer_young / steep | 1.17 m | **0.20** | 0.30 | **0.35** | the forest floor: short, sparse, shaded. x1.5 density where the canopy shade field is open |
| deciduous | 1.17 m | 0.25 | 0.35 | 0.5 | |
| lush (15 → borders) | 1.17 m | **0.40** | 0.40 | 1.1 | the field edge, the verge-like |
| built (10 → village) | 1.17 m | 0.18 | 0.25 | 0.6 | |
| city trees (16) | 1.17 m | 0.15 | 0.25 | 0.5 | |
| sand (4), shingle (11), scree (5), rock (6), cliff (12), bank (17), snow (9) | none | none | - | 0 | as today. Option (default off): dune grass 0.45 m x0.15 inland of the wrack line (`coastAt` band) |
| **verge**: the boost band past a pavement | wild reed +70 % | first **2 m mown 0.10**, then **wild 0.45**, sigma 0.4, x(1 + boost) | | | what a road verge looks like |
| **grass track / grass road** | wild reed at 40 % | **mown 0.10**, sigma 0.12, x1.0, the two wheel ruts bare (kill in 0.5 m bands either side of the centre at +-0.8 m) | | | |
| **airfield zone** (kind 'meadow' today) | wild 1.1 m | new kind **'mown': 0.12 m**, sigma 0.12, x1.2 | | | the infield, the DCS users' request |
| **mow band** round any strip / taxiway / apron | wild, from 6 m | **mown 0.10 m for `mowBand` 15 m** past the band, then wild | | | dial per place |
| **grass strip surface** | none (G665) | **default none** (the user's ruling). Option 'mown': 0.06 m, sigma 0.08, x1.0, the strip's drawn colour | | | under the pixel rule it draws to ~25 m, so it is cheap |
| **plot lawn** (ZONE_GRASS) | grass_dry, 0.10-0.15 m, 6 / m² | **reed tufts at the rule's h**, sigma 0.08, x2.0 x the rule's density (§4.6) | | | the cut lawn |

The "cut" kinds share one rule: low sigma (uniform length), no clump field, high density, and the drawn ground's colour.
The "wild" kinds have a wide sigma, clumps and the biome's density. **The premises already know the place**
(coverAt's `kind`, `cls`, `kill`, `boost`, `dEdge`). The proposal adds one field to its answer, `cut: h | null`, and
'mown' to ZONE_GRASS's kinds (the core's table, GATE PREMISES holding the vocabulary).

### 4.5 Colour: the ground's, measured where it is drawn

1. **The drawn ground's mean at the foot (the fix; CPU, at plant time, free).** Add `SPLAT_GROUND.api.meanAt(x, z)`, a
   CPU mirror of what the splat draws **minus the texture's relative detail**: the code's sets by mixK, each graded
   (uSGrade) and normalised (`normGains` x albedoNorm), blended toward the macro imagery by `macroNear` / `macroLum`
   exactly as `glslMap` does (the macro read from `world.island.albedo`, the same raster normGains walks). The ring's lattice
   reads it in place of `colAt`, and **bilinearly** rather than at the nearest 4 m node (the imagery is 10 m: 4 m bilinear is
   exact enough). Cost: 25 nodes per 16 m cell, a few µs each. The tuft's root then stands on its own colour, the green
   valley green and the brown slope brown. A gate can hold the mirror against the GLSL at fixed points, as 28b's selfCheck
   does for the fields.
2. **The level match (a calibration, one number per ground set).** `lift` 0.29 was fitted on the bench's ground,
   multiplying the bench's means (the contract's §6 rule). With a new colour source it needs re-fitting **in the game**:
   the box measures, per biome, the rendered mean of tuft pixels over the rendered mean of the ground pixels beside them
   (same frame, same light, an ROI each), and sets `groundMatch` so the ratio is ~1.0 (a little above in sun). This is the
   one dial that makes the field "emerge from the ground". The editor shows the measured ratio live.
3. **Root-to-tip (dial `rootBlend` 0-1, default 0 = today; `rootH` 0.1-0.6 of the tuft's height, default 0.35).**
   `diffuse = mix(groundCol, tinted texel x instanceColor, smoothstep(0, rootH, y / h))`. The base of every card is then
   exactly the ground's colour, and only the upper blades carry the texel. It is a colour distribution along the height,
   not shading. It touches the fragment chain (one varying, one mix), so it is the user's to turn on, and at 0 it compiles
   out.
4. **Far flatten (dial `farFlat` 0-1, default 0.5).** The texel's contrast (`uFlat`) pulled further toward the map's mean
   over the last half of the fade, so a tuft about to vanish is ground-coloured as well as small.
5. **Rejected for now:** an RVT-style ortho bake of the drawn ground around the eye (exact, including the detail's
   local mean, but an extra ground render per 32 m of motion through the heaviest program in the game: G2075 measured it at
   6.6 ms a full frame on retro), and a vertex texture fetch of the macro in the cover program (an extra sampler on a
   program GATE SPLAT does not census). Both stay in reserve if the CPU mirror drifts.

### 4.6 Decisions that are the user's (asked, not assumed)

1. **The lawn's species:** grass_dry today against the reed-only ruling. Proposed: reed tufts (one species, one colour
   response). Keep grass_dry: one dial (`lawnSpecies`).
2. **The grass strip's surface:** none (G665) or mown 6 cm (a per-strip pill in the premises panel).
3. **Root blend:** off (identity) or on.
4. **The x10:** this study sizes x10 cards per m². The editor's density dial moves it from x2 to x15, and the cost tables
   in §5 hold from x1 to x10.

### 4.7 The parameter table, per preset, and where each dial lives

Presets: **U** ultra, **G** gamer (the default), **C** current, **R** retro (the laptop's), **P** potato / laptop (off
today. 'mini' is an option, not a default).

| dial | today | proposed U / G / C / R | why | editor (panel → range, default) |
|---|---|---|---|---|
| grass layer `on` | the ring's | on / on / on / on (P off) | | GRAPHICS 'ground cover' row |
| `near` (full density to) | 50 m | 25 / **15** / 10 / 8 m | the dense band where the eye sees blades. Its cost is the stand's | VEGETATION > the grass field → 4-60 m |
| `reach` (gone at, 3-D) | 220 / 120 m | 120 / **90** / 70 / 50 m | the pixel rule for 0.30 m (§4.1), x the render scale | → 30-250 m |
| `taper` | 0.5 (exp 2) | 1.0 (exp 3) | thins faster past near: density, not size | → 0-2 |
| `aglFull` / `aglOff` | 60 / 150 m | 35 / 120, **27 / 90**, 20 / 70, 15 / 50 | aglOff = reach: the 3-D fade decides, the height term only drops the ring | existing 'AGL full' / 'AGL off' |
| `aglPre` (plant while hidden) | 260 m | reach + 60 | G671's pre-grow, scaled | → 60-400 m |
| `density` (x the type's) | 2 / 1 | 1 / **1** / 1 / 0.6 | 78 tufts / m² near (x10 cards) at 1.0 | existing 'density' → 0-2 (x0-x20 cards) |
| `cell` / block (grass only) | 32 m / 4x4 | 16 m / 2x2 | the near band must not submit 128 m | not a dial (a constant) |
| count truncation | - | on | §4.3.1. No look change | debug toggle only |
| tiered planting | - | on | §4.3.3. No look change | debug toggle only |
| tuft (cards per instance) | patch (44) | 3 | §4.2 | not a dial |
| `blotch` (grass) | 0.6 / 18 m | 0.3 / 18 m | fewer bare holes | TYPES > biome forest row (existing) |
| height per type (h, sigma, density x) | size 0.75 / 0.6, +-8 % | §4.4 table | length by ground type | TYPES > biome > grass_reed card: 'height' 0.03-0.8 m, 'spread' 0-0.6, 'density' (existing) |
| `clumpM` / `clumpAmp` | - | 4 m / 0.3 (muskeg 1.5 / 0.4) | neighbours share a length | TYPES > biome forest row → 1-12 m, 0-0.6 |
| `sizeFade` | - | 1 | §4.1, distances follow heights | VEGETATION > the grass field → 0-1 |
| colour source | set means at a 4 m node | the drawn ground's mean, bilinear | §4.5.1 | (a constant; a 'source' pill for A/B: sets / drawn) |
| `groundMatch` (level) | lift 0.29 | fitted on the box per set (start 1.0 = the ground's own level) | §4.5.2 | VEGETATION > the grass field → 0.5-2, the measured ratio shown |
| `rootBlend` / `rootH` | - | **0** / 0.35 | §4.5.3: the user's | → 0-1 / 0.1-0.6 |
| `farFlat` | - | 0.5 | §4.5.4 | → 0-1 |
| the kind's colour (hue / sat / light) | identity | identity | G1385's | existing 'the grass' colour' |
| zone 'mown' kind, `h` | - | 0.12 m, x1.2 | the airfield infield | PREMISES > zone > 'plot grass' pills + lawn rows (existing) |
| `mowBand` (per place) | - | 15 m, h 0.10 | runways / taxiways mown | PREMISES > place → 0-60 m, 0.04-0.3 m |
| strip surface grass | none | none (option mown 0.06) | §4.6.2 | PREMISES > runway → pills none / mown |
| track grass | wild at 40 % | mown 0.10, ruts bare | | PREMISES > road (class track) → h |
| lawn | grass_dry 6 / m² | reed tufts x2 | §4.6.1 | PREMISES > zone (existing h / density) + `lawnSpecies` |

GRAPHICS' 'ground cover' row (`gfx_settings.js` :426) carries the per-preset column: `full` becomes U/G/C's row (near,
reach, aglFull, aglOff, density), `lean` R's. The world look (`world_rail` DEF.ring) saves the user's moves as today.

---

## 5. The cost model: proposed vs today, per preset and view

`node tools/perf/grass_study/final.js` (the model is `cost_model.js`). Counts per frame, averaged over 24 eye positions
and headings. **Triangles** = instances submitted x triangles, the vertex work (FADE_CUT only skips the raster).
**Card px** = the card area on screen inside the frustum and the fade, the fragments the mask runs on, opaque or not,
past 3 m from the eye (the nose and wing hide the nearer ground). **Draws** = the grass's InstancedMeshes. Views: stand and
taxi at 1.7 m (pitch -4 / -2°), approach at 10 / 30 / 60 / 150 m AGL (pitch -6 / -8°). Render scale per preset.
Calibrated on the one measured point (retro stand 3.02 M), land share 0.44, so the absolute numbers are the model's and
the ratios are the result.

| preset | view | today: tris M / card Mpx (overdraw) / draws | proposed: tris M / card Mpx (overdraw) / draws | tris | card px |
|---|---|---|---|---|---|
| ultra | stand | 12.19 / 14.53 (7.01) / 19 | 9.85 / 10.88 (5.25) / 54 | -19 % | -25 % |
| ultra | taxi | 12.19 / 14.50 (6.99) / 19 | 9.85 / 10.53 (5.08) / 54 | -19 % | -27 % |
| ultra | 10 m | 12.09 / 6.61 (3.19) / 19 | 9.56 / 3.15 (1.52) / 53 | -21 % | -52 % |
| ultra | 30 m | 12.03 / 2.09 (1.01) / 19 | 6.05 / 0.20 (0.10) / 47 | -50 % | -91 % |
| ultra | 60 m | 10.98 / 0.30 (0.15) / 17 | 0.44 / 0.00 (0.00) / 20 | -96 % | -100 % |
| ultra | 150 m | 0 / 0 / 0 | 0 / 0 / 0 | - | - |
| **gamer (default)** | **stand** | **12.19 / 14.53 (7.01) / 19** | **6.85 / 9.18 (4.43) / 36** | **-44 %** | **-37 %** |
| gamer | taxi | 12.19 / 14.50 (6.99) / 19 | 6.85 / 8.86 (4.27) / 36 | -44 % | -39 % |
| gamer | 10 m | 12.09 / 6.61 (3.19) / 19 | 6.47 / 1.69 (0.81) / 36 | -46 % | -75 % |
| gamer | 30 m | 12.03 / 2.09 (1.01) / 19 | 2.61 / 0.03 (0.01) / 29 | -78 % | -99 % |
| gamer | 60 m | 10.98 / 0.30 (0.15) / 17 | 0.06 / 0.00 (0.00) / 5 | -99 % | -100 % |
| gamer | 150 m | 0 / 0 / 0 | 0 / 0 / 0 | - | - |
| current | stand | 12.19 / 14.53 (7.01) / 19 | 5.19 / 7.81 (3.77) / 27 | -57 % | -46 % |
| current | taxi | 12.19 / 14.50 (6.99) / 19 | 5.19 / 7.49 (3.61) / 27 | -57 % | -48 % |
| current | 10 m | 12.09 / 6.61 (3.19) / 19 | 4.74 / 0.90 (0.43) / 26 | -61 % | -86 % |
| current | 30 m | 12.03 / 2.09 (1.01) / 19 | 1.02 / 0.00 (0.00) / 20 | -92 % | -100 % |
| current | 60 m | 10.98 / 0.30 (0.15) / 17 | 0.00 / 0.00 / 3 | -100 % | -100 % |
| **retro (laptop)** | **stand** | **3.02 / 4.76 (3.17) / 12** | **2.39 / 2.86 (1.91) / 17** | **-21 %** | **-40 %** |
| retro | taxi | 3.02 / 4.75 (3.17) / 12 | 2.39 / 2.71 (1.81) / 17 | -21 % | -43 % |
| retro | 10 m | 2.96 / 1.88 (1.25) / 12 | 2.09 / 0.15 (0.10) / 17 | -29 % | -92 % |
| retro | 30 m | 2.92 / 0.28 (0.19) / 11 | 0.10 / 0.00 (0.00) / 10 | -96 % | -100 % |
| retro | 60 m | 2.43 / 0.00 / 9 | 0 / 0 / 0 | -100 % | - |

**Reading it.**
- **GPU: within today's cost at every view of every preset**, triangles and card pixels both. The stand and the taxi,
  the views the laptop fails today (G1995), save 21-44 % of the grass's triangles and 37-43 % of its card pixels. The
  approach from 10 m up saves most of the grass's cost. The 30 m view is where today's ring is at its worst
  (12 M triangles for 2 Mpx), and the user's "jungle" view.
- **The near band is the whole cost.** The stand's triangles are the 32 m blocks within `near`, submitted at keep 1. If the box
  finds the stand short, `near` is the dial: gamer at near 12 / reach 80 is 5.9 M / 8.5 Mpx.
- **In ms (estimates, to be replaced by the box's and the laptop's measurements).** On the 3080 today's 3 M retro
  triangles are within the GPU timer's noise. The GTX 1660 Ti mobile has ~0.36x the 3080's geometry rate (3 against 7
  GPCs at lower clocks) and ~0.18x its shading (5.4 against 29.8 TFLOPS, diag.js's table). Retro's -0.6 M triangles and
  -1.9 Mpx are then worth very roughly **0.2-1 ms** on the laptop: a saving, not a cost. The user's `?diag=quick` 'cover
  off' row before and after is the real number.
- **What it costs, named.**
  - **Draws: +5 (retro), +17 (gamer), +35 (ultra)** grass draws at the stand. At three's per-draw cost, ~15-25 µs on the i5-9300H
    **(guess**: HANDOVER only gives the i7-8700's budget of ~1 500 draws) that is ~+0.1 ms of CPU on retro, ~+0.4 ms on gamer. **Claw-back:** the count truncation
    also drops a block from the draw list when its `keep` x the height term rounds to no instance (today a block
    draws whenever it is within the reach, even with the height term at 0.01). If more is needed: 2 variants per draw instead of 3 (-33 % grass draws) or 48 m
    blocks (B 3) on retro.
  - **FRAMECOST's draw rows** (stand / taxi `draws.main`) will rise by those counts. That is a **named re-baseline**
    (the strict gate allows no regression unless the user names it), and GRASS-DENSE asks for it.
  - **Memory: +5 MB (retro), +19 MB (gamer)** of instance buffers (held ~70 k / ~280 k tufts at 21 floats each).
    Optional halving: a vec4 (x, y, z, packed yaw+scale) instance attribute in place of three's 16-float matrix. That
    touches FADE_VS's origin read and nothing of the look.
  - **Planting CPU.** More, smaller instances. The candidate is rejected by its rand before any lookup (one hash). The
    kept ones cost the lattice read and a matrix compose (~1-2 µs, today's path). A fresh gamer ring is ~0.3-0.5 s of
    planting, spread over the existing `budgetMs` (4 ms a frame), nearest and lead first. At taxi (10 m/s) the near
    band's leading edge is ~10 k tufts a second, ~0.5 ms a frame at 30 fps. That is inside the budget but **measurable on
    the strict gate's taxi p99 rows**: the box watches them.
  - **Load:** the ring is built after the reveal (no load step moves), but the field fills over ~2-3 s. The pre-grow
    covers the approach. The roll-out's first seconds at the stand should be checked in the stills (§6.2: +2 s after the
    overlay).

---

## 6. The box plan: GRASS-DENSE, G2560-G2579 (local GPU)

### 6.1 Order of work (each step its own commit, strict gate per step where it says so)

| # | G | step | look change | gate |
|---|---|---|---|---|
| 0 | G2560 | **The baseline.** A game-side grass rig, `tools/perf/grass_cost.js`, on `tools/perf/ground_cost.js`'s pattern: a TIME_ELAPSED query around every draw whose `userData.coverKind === 'cover'`, the instances submitted, per view of §6.2. Plus the ?diag 'cover off' rows on retro / gamer, the stills (§6.2), and the strict gate on train 40. Ask the user for one `?diag=quick` on the laptop (retro and current): today's grass cost on their card | none | baseline |
| 1 | G2561 | **The count truncation** (§4.3.1) on today's ring | **none** (GATE COVER pixel-identical, new assertion) | strict gate: expect taxi / stand GPU down |
| 2 | G2562 | **The colour mirror** `SPLAT_GROUND.api.meanAt` + the bilinear lattice + `groundMatch`, fitted per set on the box (ROI ratios in the stills) | the colour only | GATE SPLAT (mirror vs GLSL at fixed points), GATE COVER |
| 3 | G2563 | **The tuft layer** (§4.2, §4.3.2-3): 3-card tufts cut at load, the grass on 16 m cells / 32 m blocks, tiered planting, the §4.4 heights and the clump field, the §4.7 per-preset column. **The big step. Stills at every view** | yes | strict gate + FRAMECOST draws (named re-baseline), GATE COVER / FADES / BIOME / WORLDRENDER |
| 4 | G2564 | **`sizeFade`** + the reach / near / AGL column per preset, tuned on the stills | distance only | strict gate |
| 5 | G2565 | **Cut vs wild:** coverAt's `cut`, the 'mown' zone kind (airfield), `mowBand`, tracks mown with ruts, verges mown then wild, the strip option (default none), the lawn's species per the user's answer | yes, at the premises | GATE PREMISES (vocabulary), GATE PAVEMENT §6 (nothing on a pavement), GATE COVER |
| 6 | G2566 | **The editor:** VEGETATION > 'the grass field' (world_rail.js, after 'the cover ring' :960), the grass_reed card's height / spread (TYPES > biome), the premises rows (premises_ui.js :838 / :864), the gfx column, the world look's save | none (dials) | GATE UISMOKE, the editor's own gates |
| 7 | G2567 | `rootBlend` / `farFlat` (default 0 / 0.5) for the user to try | dials | GATE COVER (0 = identity) |
| 8 | G2568 | The final stills and the user's review, the full strict gate, the laptop's `?diag` after | | |

G2569-G2579 are spare, for what the stills find.

### 6.2 The stills (the same frames before and after, every step that changes the look)

Rules: headed Chrome on the box, 1920x1080, the preset's own render scale, noon and golden hour. **Shoot only after the
loading overlay is gone + 2 s (never a loading screen)**, with the aircraft paused for the stand, taxi and lot views.
Validated aircraft only: the user's **Cub** (`builds/cub_2026-09-20_corrected.json`), the **Jodel**
(`builds/jodel_2026-09-20_corrected.json`), the **metal Cessna** (`bugReports/cessnaMetal (1).json`), the **Cessna floats**
(`bugReports/cessnaFloatsWOrks.json`), the **twin floats** (the validated build the box's rigs fly).

| id | where | eye | aircraft | what it judges |
|---|---|---|---|---|
| S1 | HOME, the roll-out stand (-154, 31.6, 712) | cockpit + chase | Cub | the near sward, the airfield's mown infield |
| S2 | HOME, the taxi pin, beside the taxiway | chase 1.7 m, looking along the grass | Cub | the verge: mown then wild |
| S3a-d | HOME final, the same heading, **10 / 30 / 60 / 150 m AGL**, the craft frozen on a 3° path | chase + cockpit | Cub, metal Cessna | **the jungle test**: no field standing up, the colour continuous with the ground |
| S4 | a residential plot lawn near HOME (the first residential zone's plot by id) | 1.7 m and 20 m | Jodel parked | the cut lawn against the wild beyond the fence |
| S5 | a grass strip: mn_strip (or w3 / nv_strip) | on the surface, 1.7 m, and 30 m over the threshold | Jodel | the strip (none / mown), its mow band |
| S6 | a muskeg lake shore | 1.7 m and 20 m | Cessna floats | the wetland's length, the pools |
| S7 | a conifer stand's floor | 1.7 m | Cub | the forest floor: short, sparse |
| S8 | a beach / shingle shore | 1.7 m | twin floats | no grass where none grows |

Each still gets its ROI measurement for §4.5.2: the tuft pixels' mean against the ground's beside them, per biome. Their
ratio is the `groundMatch` evidence.

### 6.3 The strict-gate rows to watch (`tools/perf/train_gate.js`)

- `rollout|HOME chase|*` and `rollout|HOME cockpit|*`, Cub and metal Cessna: **taxi p99, p99all, over15, taxiOver15**
  (the planting stream's cost shows here first) and the taxi fps.
- master_bench's **taxi at HOME and at mn_strip** (the remote stand) fps, and the **load seconds** (warm / cold): nothing
  should move, since the ring builds after the reveal.
- FRAMECOST (`tools/_framecost_check.js`): stand / taxi `draws.main` (expected up by the §5 counts; the named
  re-baseline), gl.calls, the buffer upload bytes (block rebuilds).
- GPU: the new grass rig's per-view ms, ?diag base vs 'cover off' on retro and gamer, before and after.
- Core gates: COVER (truncation identity; the planted picture; tiered = full), FADES (the shrink band, sizeFade at 0 =
  identity), BIOME, WORLDRENDER, PREMISES, PAVEMENT §6, SPLAT (the mirror), UISMOKE.

### 6.4 Traps known in advance

- `aRand` is also the **sway phase** (`swayOnce(vs, 'aRand x 6.2831')`). Sorting by it reorders instances and never
  changes an instance's own value, so the sway is untouched. Do not re-derive it.
- The batches (rocks, debris, shrubs) carry the rand in the colour's alpha (BATCH_RAND_VS). The truncation is for the
  InstancedMesh path (the grass) only.
- The lawn planter draws `n x 2` and rejects off the lawn nodes. On 16 m cells the lawn share per cell is coarser, so
  re-check the realised density.
- `FADE_VS`'s distance is 3-D from the instance's **origin** (its foot). sizeFade must read the scale from
  `instanceMatrix[1]`, after the lean's quaternion (the lean is only on rocks).
- The bench (`tools/_trees.html`, `grass_perf.js`, `tree_fit.js`) does not load cover_ring.js. Per the contract's §6
  rule, **no number fitted on the bench ships to the game** for this work: `groundMatch` is fitted in the game.

---

## 7. The scripts (node only, `tools/perf/grass_study/`)

| script | what it prints |
|---|---|
| `reed_geo.js` | the three patches: vertices, triangles, geometric and projected card areas (writes `reed_tris.json` to `$OUT` or the OS temp dir) |
| `reed_alpha.py` | the mask's kept share (alpha > 0.3) and the height distribution of the opaque blade area (reads `reed_tris.json`; PIL + numpy) |
| `reed_cards.js` | the cards per patch: triangles, width, top height, spread |
| `tufts.js K` | the patches cut into tufts of K cards: triangles, height, spread |
| `cost_model.js` | the model (today's patches / the proposed tufts, per view): submitted triangles, card pixels, draws |
| `final.js` | §5's table |
| `planted.js` | instances held and their memory, today vs tiered |

`node --check` passes on all of them. None requires a gate script, and none runs the battery.
