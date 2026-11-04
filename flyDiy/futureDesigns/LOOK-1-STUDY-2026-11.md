# LOOK-1-STUDY — tree lighting: the night specks, diagnosis and methods (A0, 4 Nov 2026)

A STUDY: no game code changed. Branch `claude/look-1-study` (off origin/master c2ac56b3, train L31c). Evidence:
`reports/evidence/LOOK-1/` (README: one row a picture; `rig/`: the stages, run scripts and analysis). The one prototype
(`l1mip_prototype.patch`, a `?l1mip=1` dial) was applied to the working tree for two runs and is NOT in the branch's
code. Every frame here is SwiftShader. §5 says what that cannot show, and it matters more than usual: on a software
renderer the game bakes no sky probe.

## 0. The cause in six lines

1. **The specks are the moon key lighting the crown one leaf card at a time.** Each leaf card (geometry) and each
   texel (impostor: the baked normal) takes `N·L` from the moon on its own normal. Nothing inside the crown occludes it:
   the impostor never self-shadows, and the geometry does only inside the shadow map (none on potato / laptop / retro).
   The crown has almost no ambient to fill the rest: at night the hemisphere's ground half is derived ~black
   (0.003, 0.006, 0.004) and its sky half dim. So the cards that face the moon light up and the rest stay dark: "a dark
   tree with specks, as if sunlit through holes". Measured with the probe off (§1.3): the moon key is 85 % of the crown's
   median light; with the key held at 0 the crown goes uniformly dark and the specks go.
2. **Gold** is the key's own colour: at 22 deg the moon's light comes through the atmosphere's transmittance at
   (0.92, 0.78, 0.58) (`sky_light.js applyDay`, the moon key = 0.92 x T / max T). The night grade only keeps it gold
   (A0 on the GPU: the same blobs with the grade on, neutral or off).
3. **An amplifier: the leaf maps' mip chain.** `trees.js coverageMips` box-filters RGB straight off a 2D canvas, which
   returns RGB 0 under alpha 0. Black bleeds into every edge texel and the coverage rescale keeps them opaque, so at range
   the crowns darken to 0.40-0.68x (mip 6) and their texel contrast grows 2-3x. The impostor bake freezes that at its
   tile's mip (6-7), and the cards are composed from the sheets (G3184). TREES-FROM-TWIGS-2026-09-08 §3.3 named it in
   advance ("colour dilation under the alpha (MANDATORY) ... the canopy goes dirty and dark at range"); only the
   coverage half shipped.
4. **Not the cause** (each isolated): the night grade (A0, GPU), the premises lamps (0.00 levels), the leaf wrap + SSS
   (-2 %), exposure, gain and ambient (they scale the specks; they don't make them).
5. **It is in both tiers.** Geometry and impostors take the same key on per-card normals. The impostor lacks even the
   shadow map's occlusion, and the mips darken it most.
6. **By day the same mechanism reads as sun-dappled foliage**, because the sunlit land makes the hemisphere's ground half
   bright and the sky probe fills the crown. So the fix for the night must not touch the day (§3).

## 1. DIAGNOSIS

### 1.1 Every term that lights an impostor pixel, bake to screen

THE BAKE (`render_world.js bakeImpostorAtlasNow`, `trees.js LEAF_GLSL` with `uBakeAlb` 1):
1. the geometry's leaf texel, from the map at whatever mip the ortho footprint asks for: a ~20 m tree in a 128 px tile
   (64 on potato) is ~0.16 m a texel, mip 6-7 of a 1024 map. **The mip chain's darkening and contrast go in here (§1.4).**
2. alpha made binary at the part's cut, so an edge texel that passed the rescaled cut is written fully there;
3. albedo x AO^(ao x 0.5); no light, no tint;
4. the normal sheet: the per-texel normal of whichever card won the texel, the part's kind in its alpha (G2590). **This is
   the normal the moon lights, texel by texel (§1.3).** It is a card's normal, not the crown's.

THE DRAW (`impostorMat`):
5. three taps, un-premultiplied; the alpha curve; the hand-over stipple;
6. x the collection's tint (MASTER.light x the collection x SHADE.k, hue, sat, uFlat 1.30 about 0.05); trunk texels take
   the bark's light (G2590);
7. MeshStandardMaterial at roughness 1 on the baked normal: **the key** (sun, or the moon when `SKY_LIGHT.isMoon`,
   placed by `keyAim(day.moon)`), **the hemisphere** (sky colour above, the derived ground colour below), **the sky probe**
   (`scene.environment`, PMREM; Standard takes it IN ADDITION to the hemisphere, which the world's Lambert opts out of:
   render_world.js "THE WORLD'S LAMBERT STAYS OUT OF THE ENVIRONMENT"), the cloud shadow;
8. LEAF_TERMS: wrap 0.80 + translucency 1.12 (pow 5.75) off directional light 0;
9. x `_iLit` (uILit 0.9 shadowed presets / 1.242 others, x IMP_LEVEL; bark sheets barkLit 0.9);
10. the shadow map (receive only, inside the reach; the impostor never shadows ITSELF), fog, ATMO;
11. pre-exposure P (2^14-2^16 at night), exposure, tone map, the night eye, bloom.

By light: MIDDAY, the key's N·L per card plus the wrap; the hemisphere's ground half is sunlit land, bright; the probe fills. GOLDEN,
the key low and warm, the translucency carries the backlit crown (impostor darker than geometry into the sun, G1975: core
0.3-0.7). BLUE HOUR, no key (the moon at 7.8 deg: intensity 1e-5), the hemisphere and the probe alone, exposure x40. NIGHT,
the reddened moon key (0.31 x P units), a dim blue sky half, a black ground half, the probe of a night sky. The specks
need a strong key against a weak ambient, and only the night has that.

### 1.2 The reproduction

`tools/soft_still.js` + `rig/stage.js` / `rig/stage_lights.js`: Jolene, the HOME stand, the sim paused, the free eye on the
nearest cedar 28 m away from the moon's side (geometry) and over a forest 200 m away and 35 m up (geometry in front,
impostors behind), the 24 Dec 2026 full moon (22.5 deg, clear), `TREE_LOD.set([60,270,270])` (= `bands=far`). The renderer:
`ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver)`, the software rung = potato
(uILit 1.242, no tree shadows, 64 px tiles, no sky probe). Not the user's shore cottage or Twin_4b (neither is in the repo).
The mechanism is the crown, not the place.

### 1.3 Term by term (linear luma over the crown's pixels; each against the frame before it, same eye, same paused scene)

| term | how | result | verdict |
|---|---|---|---|
| the night grade | A0, GPU, ultra, `bands=far`: grade on / neutral / nightEye off | the same blobs at the same pixels | not the cause |
| the premises lamps | `WORLD.premises.lamps.mute()` (run 2) | 0.00 levels, the whole frame | not the cause at HOME (the cottage's own lamps untested; the specks are on lampless hills too) |
| leaf wrap + SSS | `uWrap = uSSS = 0` (run 2) | crown -2 % | not the cause |
| the sky probe | `scene.environment = null` (run 6) | crown 0.077 -> 0.0175 (on SwiftShader the "probe" is a static boot-time sky, see §5) | on the GPU it is the night's fill; its share there is unmeasured |
| **the moon key** | intensity held at 0 (run 7, the probe off) | near crown median 0.0022 -> 0.0003 (x7 darker), forest mean 0.0051 -> 0.0020; the lit card faces gone, the crown a uniform dark (`key_specks_near.jpg`, `key_specks_forest.jpg`) | **THE SPECKS** |
| the hemisphere's ground half | groundColor := sky colour (run 7) | the override did not stick (the light's ease rewrites it) | NOT TESTED |
| **the leaf mips** | `?l1mip=1` (runs 3/4, the leaf light x 0.69 to hold the level) | night crown x1.15-1.20 even after the x0.69, the texel spread down at the near tree (speck index 6.9 -> 5.9); the forest's specks barely move (15.0 -> 14.0) | an AMPLIFIER of the contrast at range, not the specks themselves |

### 1.4 The mip chain, measured off the maps (`rig/mips_canvas.py`: the game's chain replayed on each map as the canvas returns it)

Covered texels' mean linear luma over mip 0's, today (straight) and alpha-weighted, and their spread (p90/p10) at mip 6:

| map (cut) | mip 3 | mip 5 | mip 6 | mip 7 | spread mip 6, today -> weighted | weighted mip 6 |
|---|---|---|---|---|---|---|
| realistic fir (0.38) | 0.84 | 0.64 | **0.50** | 0.39 | 2.5 -> 2.1 | 0.83 |
| spruce (0.30) | 0.88 | 0.65 | **0.54** | 0.37 | 2.0 -> 1.4 | 0.89 |
| larch (0.08) | 0.80 | 0.62 | **0.49** | 0.34 | 2.3 -> 1.5 | 0.83 |
| pine_georgeous (0.22) | 0.76 | 0.62 | **0.52** | 0.37 | 2.3 -> 1.8 | 0.76 |
| pine_evolveduk (0.21) | 0.71 | 0.50 | **0.40** | 0.26 | 3.4 -> 1.1 | 0.94 |
| fir_georgeous (0.61) | 0.92 | 0.78 | **0.68** | 0.58 | 1.6 -> 1.3 | 0.89 |
| cedar (0.63) | 1.09 | 1.17 | 1.08 | 0.83 | 1.5 -> 1.3 | 0.94 |

Cedar is the exception: its authored half-transparent fringe carries the PNG's pale grey-beige fill (0.59 sRGB under
alpha 0, `map_cedar_rgb_alpha.jpg`), which lightens as much as the canvas's black darkens. The fill itself never
reaches the GPU on this load path (the canvas zeroes alpha-0 RGB); it would if the load moved to
`createImageBitmap({premultiplyAlpha:'none'})` or a KTX2 bake.

### 1.5 The tiers, and where the step shows

- **Near geometry has the specks** wherever the key reaches a card the shadow map does not cover. On shadowed presets
  the shadow map occludes the crown's inside within its reach. A 4096 map at
  moonlight leaves card-sized leaks, and the mips darken the crown from ~40 m out (`bands=far`: geometry to 270 m, mips 5-7).
  A0's "flat tan blocks, tens of pixels at 4K" fit lit card faces of mip-6 texels on a near tree.
- **The impostor has them by construction**: one baked normal a texel, no self-shadow ever, the deepest mips.
- **The step**: the levels were matched at the hand-over in daylight (IMP_LEVEL G2591, uILit G1975). No night row
  exists. At night the geometry gets the shadow map's crown occlusion (shadowed presets), and the impostor never does. So
  the impostor's speckle is the stronger one, and it is the step the user sees at night. By day it reads as foliage.
- **Cards** (G3184) = the sheets' texels and normals: the same.

## 2. METHODS

### 2.1 The specks: the crown is lit card by card

| | method | what engines do | draws | shader | programs | memory / bake / pack | day-look risk |
|---|---|---|---|---|---|---|---|
| **M1** | **crown normals at night**: blend each leaf normal toward the crown's outward normal (a sphere / ellipsoid about the tree's centre), by a dial `uCrownN` ramped in by the sun's elevation (0 by day, 1 under civil dusk). Geometry: in the leaf hook's vertex stage (the instance centre from instanceMatrix + the subject's bb). Impostor: per fragment, the quad's own sphere normal from `vUvI` and `vImpDir` (no bake change) | the standard foliage fix: "transfer normals from a sphere / hull" so a canopy lights as one volume (Polycount and UE forum practice, the Foliage Normals tool's "spherify"; SpeedTree authors do it in DCC) | 0 | a few ALU (a normalize and a mix) | 0 if the text is unconditional and the dial a uniform (the text is the program key) | 0 / 0 / 0 | none by construction (0 by day) - the dusk ramp to judge |
| M2 | **a night floor on the hemisphere's ground half for foliage** (the crown's inside sees leaves and sky, not black land) | a crown-interior ambient term (common practice; no source checked here) | 0 | 0 | 0 | 0 | every surface's underside if done in sky_light; trees only needs a tree uniform |
| M3 | the moon key's colour desaturated toward the night's blue-grey (the eye's mesopic shift, before the grade) | the night grade's job; the user is tuning it on claude/night-photo | 0 | 0 | 0 | 0 | the rock, the plane, every lit surface at night: the user's call |
| M4 | bake a crown-depth term into the sheet and apply it to the key on impostors | Amplify / UE impostor bakers carry extra G-buffer channels | 0 | +1 tap | 0 | sheet +33 %, bake +50 % | none, but heavy |

**Recommended: M1** (it fixes the cause where it lives, both tiers, zero cost, zero day risk), with M2 as a dial if the
crown's dark side reads too black once M1 rounds it. M3 is left to the night grade's owner. M4 is not worth it.

### 2.2 The amplifier: the mip colour

| | method | draws / shader / programs / memory | load | pack | day-look risk |
|---|---|---|---|---|---|
| **A1** | alpha-weight the box filter in `coverageMips` (RGB = sum(rgb x a) / sum(a); no weight keeps the plain mean) - premultiplied filtering, the standard for cutout mips (Golus 2017; lisyarus, "exploring ways to mipmap alpha-tested textures") | 0 / 0 / 0 / 0 | measured the same: 8.0 vs 7.7 ms a 1024 chain (node, this box) | 0 | **REAL**: crowns +15-20 % at range after a x0.69 compensation at near (needs a leaf-only factor measured on the GPU), the crown's inner contrast down. uFlat 1.30 and the "more bitty" call (23 Sep) were judged with the darkening in the picture |
| A2 | the chain offline (tree_prep.py / KTX2 with mips) | 0 | -8 ms a map | +1/3 the maps' bytes | as A1 |
| A3 | dilate RGB under alpha 0 offline (Unity's `alphaIsTransparency` does exactly this) | 0 | 0 | -10..-24 % (cedar 1.24 -> 1.10 MB) | none - and no effect on this load path (the canvas zeroes the fill). Insurance only |

The prototype (`?l1mip=1`) is a heavier push-pull (A1 + an in-browser A3, ~120 ms a map), not the proposal.

### 2.3 The old LOOK-1 list

| item | state | worth it? |
|---|---|---|
| tree edges softened (alpha-to-coverage) | **DONE**: impostorMat and the leaves `alphaToCoverage: true` + the EDGE_GLSL sharpen; real on MSAA (gamer, ultra); without MSAA it is the alpha test at the cut. Alpha hashing (Wyman & McGuire 2017) needs TAA, which the game lacks | no |
| model-to-impostor step recalibrated | done by day (G1975, G2591); **no night row ever** | yes: re-measure with `tools/perf/deadwood/match2.js` + a moon row, after M1 / A1 |
| trees a little darker in sun (midday) | uILit 0.9 + SHADE_K 1.38 (the user's column 3) | re-judge after A1, not before |
| trees lit right at golden hour (impostor darker into the sun, core 0.3-0.7) | open since G1975 | yes, cheap: an impostor-only gain on the existing translucency term (a uniform; 0 programs) |
| self-shadowing impostors | uILit's per-state value buys it at zero cost | no (a depth sheet + a shadow lookup a fragment over the forest) |
| swaying impostors no longer swapping | the card's shear phase (`hT`) differs from the geometry's sway at the hand-over | cheap (vertex only), last |
| thicker air, a better bloom | ATMO / postFX | not tree lighting |

Comparable engines light impostors as this game does, as a G-buffer impostor (albedo + normal, sometimes depth)
lit at draw: Brucks' octahedral impostors for UE4, Amplify, the Godot port. The canopy's smooth light comes from the
normals the artist transfers from a hull, not from the impostor. That is M1's job.

### 2.4 What must be measured on the GPU, and how

- **The probe's share at night** (the only fill the crown has on the GPU): A0's paused scene, `scene.environment = null`
  vs on, the crown's luma. SwiftShader has no probe (§5).
- **M1's look**: the circled frame (ultra, `bands=far`) with the dial at 0 / 0.5 / 1, and the dusk ramp (sun -2..-8 deg).
- **A1's level** on gamer with shadows: `match2.js` (the hand-over) + `alt.js` (300 m / 1 km), golden + noon. Sets the
  leaf-only compensation.
- **GATE CARDMATCH** after either (cards follow the sheets by construction, so the ratio should hold).
- Frame time: none expected from either; FRAMECOST `--census` for draws, programs and bytes. Never a SwiftShader time.

## 3. PLAN (landable steps; the first serves the night hero)

### Step 1: crown normals at night (M1) (S-M)
- **Files**: `src/viewer/trees.js` (the leaf hook: the normal blend in the vertex stage, `uCrownN` beside uWrap / uSSS in
  `TREE_LEAF.uniforms`, so the impostor shares it); `src/viewer/render_world.js` (impostorMat: blend `nBake` with the quad's
  sphere normal by the same uniform; `dayApply` sets it from the sun's elevation, 0 above -0.833 deg, 1 below -6).
- **Cost**: draws 0; a normalize + mix per vertex (geometry) and per fragment (impostor); **programs 0** (unconditional text,
  a uniform: check with GATE PROGRAMS); memory, bake, pack 0.
- **Gates**: PROGRAMS (counts unchanged), TREES, TREE, GFX, CARDMATCH (a day row: unmoved, since the dial is 0), LIGHT (the
  new writer is a dial, not a light), and a new row **CROWNN**: by day the uniform is 0 (the day bit-identical by
  construction), under -6 deg it is 1, the text has no `#if` on it.
- **Day-look risk**: none (0 by day). The dusk ramp is the thing to judge. Never preset-dependent.

### Step 2: the alpha-weighted leaf mips + a leaf-only level factor (A1) (S)
- **Files**: `src/viewer/trees.js` (`coverageMips` loop; a `MIPFIX_K` on the leaf parts in `retint`, beside SHADE.k, not on
  bark). The factor comes from the GPU measurement (§2.4); about 0.6 at range on SwiftShader.
- **Cost**: 0 draws, 0 shader, 0 programs, 0 memory, load the same (measured), pack 0.
- **Gates**: TREES, TREE, GFX, PROGRAMS, FRAMECOST census, CARDMATCH (GPU). A new node row **MIPCOLOR**: replay
  `coverageMips` on every coverage-mip map; covered texels' mean at mips 5-7 within 0.75-1.05 of mip 0; NEGATIVE CONTROL:
  the straight filter fails it (realistic fir 0.50 at mip 6).
- **Day-look risk**: REAL. The far forest's level and its inner contrast move. The user sees day stills before and after
  (`sheet_*_noon.jpg`, `sheet_*_golden.jpg` here are SwiftShader proxies) and decides; uFlat can buy the "bitty" back.

### Step 3: the tier match re-measured, with a night row (S, data only)
IMP_LEVEL per sheet, uILit both states, SHADE_K, on gamer + potato x golden + noon + the full moon (the deadwood rig). Rows
that move: none assert the values except CARDMATCH's ratio.

### Step 4: the backlit impostor at golden hour (S): one impostor-only translucency gain, measured into the sun to core ~0.9.

### Step 5 (optional): the sway phase shared at the hand-over (S, vertex only).

Not worth it now: a depth / thickness sheet, alpha hashing, larger tiles.

## 4. PICTURES

`reports/evidence/LOOK-1/README.md`: one row a still. All at the HOME stand on Jolene, potato on SwiftShader, 1280 x 720,
JPG q85. The three that show it best: `key_specks_near.jpg` (the moon key on / off: the specks are the key),
`sheet_near_night.jpg` (the mips: before / after A1), `swiftshader_env_artefact.jpg` (why the cloud's own night frames
look frosted and must not be judged as the game).

## 5. What SwiftShader cannot show

- **No sky probe.** On a software renderer the game bakes none (G1460: the PMREM blackened every Standard material) and
  lights Standard materials with a static environment made at boot. The trees (Standard) then take a fixed daylight sky:
  the frosted trees in every cloud night frame and the white trees at the blue hour (`swiftshader_env_artefact.jpg`;
  the probe-off frames are the closer stand-in). The probe's real share at night is the first GPU number to take.
- Only potato: no tree shadows (uILit 1.242; the shadow map's crown occlusion on shadowed presets is not seen), 64 px
  tiles, no MSAA (alpha-to-coverage inert), no 4K.
- No frame time, ever.
- The user's shore cottage, its lamps and Twin_4b: not in the repo.

## Sources

- Unity, `TextureImporter.alphaIsTransparency` (dilates colour into transparent texels against edge filtering):
  https://docs.unity3d.com/ScriptReference/TextureImporter-alphaIsTransparency.html
- B. Golus, "Anti-aliased Alpha Test: The Esoteric Alpha To Coverage" (2017):
  https://bgolus.medium.com/anti-aliased-alpha-test-the-esoteric-alpha-to-coverage-8b177335ae4f
- lisyarus, "Exploring ways to mipmap alpha-tested textures":
  https://lisyarus.github.io/blog/posts/exploring-ways-to-mipmap-alpha-tested-textures.html
- Octahedral impostors (Brucks' UE4 baker, as carried by its ports): https://80.lv/articles/impostor-baker-for-ue4/ ,
  https://github.com/SIsilicon/Godot-Octahedral-Impostors
- Foliage normals transferred from a sphere / hull: https://polycount.com/discussion/202402/tree-lighting-and-normals-problems-in-ue4 ,
  https://forums.unrealengine.com/t/spherical-normals-for-trees-blender/98732 , https://superhivemarket.com/products/foliage-normals
- Castano 2010 (coverage-preserving alpha mips): already cited in trees.js's header.
- In this repo: TREES-FROM-TWIGS-2026-09-08 §3.3; VEGETATION-2026-09-15; HANDOVER G1975 / G1975.1 / G2590-G2591 /
  G3180-G3186 / NIGHT-LOOK step 1 (G2600, G2620).
