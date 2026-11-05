# LOOK-1-STUDY — the harsh look: tree lighting, the air, the night (A0, 4-5 Nov 2026)

THREE PASSES. Pass 1 (4 Nov, §0-§2): the night specks. Pass 2 (5 Nov, §B-§D): the 29 Oct pre-study's six picks, the
forest in volume, the blue hour, one landing plan. **Pass 3 (5 Nov, §E): the back-step - the flicker in motion, the
literature and the engines, a flicker measurement, and a NARROWER PHASE 2 (§E6), which supersedes §D's order.**

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
   bright and the sky probe fills the crown. So the fix for the night must not touch the day (§D).

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

## 3. PLAN: superseded by §D (one ordered landing plan for both passes)

## 4. PICTURES: see `reports/evidence/LOOK-1/README.md` (pass 1 and pass 2 rows)

---

# PASS 2 (5 Nov): THE 29 OCT PRE-STUDY, THE FOREST IN VOLUME, THE BLUE HOUR

The brief of pass 1 missed the starting point (A0, 5 Nov). The user, 29 Oct: *"the rendering keeps being harsh. Like it
tries to do everything crisp ... there's blur in reality, through fog, distance, air, FOV ... The trees too, when lit
under certain conditions, are very harsh and very pixely."* Six picks were agreed that day, each to be judged by eye on a
before / after still. The user's notes on pass 1 (5 Nov) add two things: **look at a FOREST** (mostly impostors, side-lit,
where every tree gets its own bright edge and the stand reads as "a forest of speckles"), and **treat the blue hour as a
bug**.

Rig for pass 2: the same `soft_still.js` stages (`rig/stage_lights.js`, `rig/views*.json`), Jolene, potato on SwiftShader,
plus three prototype dials in the working tree for the runs only (`rig/pass2_prototype.patch`, never in the branch's
code): `?softprobe=1` (the real sky probe forced on a software renderer), `L1U.crown` (impostor crown normals), `L1U.dirK`
(the impostor's key x k) and `L1U.far` (the impostors read the far cascade, B2).

## B. THE SIX PICKS (29 Oct) AND THE "ALSO" ITEMS

### B1. Alpha-to-coverage on the trees (pick 1)
- **The cause, in the code:** every leaf material and impostor asks for it (`trees.js` `alphaToCoverage: !!cutout`,
  `impostorMat` `alphaToCoverage: true`). But A2C only exists where the target has samples. `aa_resolve.js` tiers: `off`
  = "the canvas's 4x MSAA, none under the clouds" (G1250: once a pass asks for the target the clouds' needRT draws it at
  ZERO samples). **'current', the default preset, is `aa: 'off'` with `clouds: 'half'`**, so for most players every leaf
  and impostor edge is the hard cut that EDGE_GLSL's sharpen leaves. It is on only for gamer (msaa) and ultra (full), and
  potato / laptop (no clouds: the canvas's 4x). The TSL path cuts at a plain 0.5 (A0's read, render_world ~3390;
  WebGPU-only, not the shipped renderer).
- **Methods:** (a) the `off` tier keeps 4 samples under the clouds (= `msaa4` for 'current'): the frame's colour + depth x4
  at render scale (1080p RGBA16F ~ +50 MB), resolve cost, fill; (b) alpha hashing (Wyman & McGuire 2017) where there are
  no samples: a stochastic cut, needs TAA to be clean, so not without TAA; (c) a wider EDGE sharpen on a 0-sample target
  (a softer cut, blurrier at range, no AA): cheap, partial.
- **Cost / gate:** (a) is a memory and fill question for the strict-30 frame: **GPU only** (FRAMECOST census + a low
  flight over the forest, current preset, before / after). 0 programs (the tier's sample count is not a program key).
- **Still:** `pick1_aa.jpg` (potato, aa off / msaa4): a small softening. Potato has no clouds, so its 'off' may already
  draw at the canvas's 4x: **the default preset's case (clouds on, 0 samples) must be shot on the GPU**. No frame time here.

### B2. Trees lighting up on their sides in the forest, golden hour (pick 2) + the user's 5 Nov "forest of speckles"
- **The cause, in the code:** each impostor is lit alone: the key's `N·L` on its baked normals plus the leaf wrap (0.80)
  and the translucency (1.12) give every crown a bright sun side and a bright rim, and **nothing shades one tree from its
  neighbour at range**. The near shadow map reaches ~105-540 m round the aeroplane. Beyond, the game already renders a
  FAR CASCADE of the impostor quads (render_world.js W0c.19: ±1400 m about the eye, 2048², the trees' sun-facing
  silhouettes, every 4th frame), but by design **only the terrain samples it**: "Not a general cascade: trees do not read
  it". So in a stand every tree shows its own lit side: the speckle in volume, worst when the key is low and to the side.
- **What does not fix it:** crown normals (`L1U.crown`, pass 1's M1) make each impostor a lit ball; in volume that is a
  forest of lollipops, still one bright side per tree (`pick2_forest_crown.jpg`). Pass 1's M1 stays a near-tree / night
  method only. Halving the key (`L1U.dirK` 0.5) evens the stand only by darkening it.
- **Methods:**
  - **F1, the impostors read the far cascade** (prototype `L1U.far`): the existing map, four taps of packed depth like the
    terrain's, the receiver point moved toward the sun by ~0.35 x the crown's diameter so a tree does not shade itself.
    The trees upwind shade the trees behind them, as a canopy does. Cost: +1 sampler, 4 taps a fragment on the impostor
    tier, 0 memory (the map exists), 0 programs if the text is unconditional (a dial uniform). GPU: the impostor fragment
    cost over a dense stand (FRAMECOST low flight). Engines: a far / distance-field shadow cascade that the vegetation
    receives is the standard answer (UE's far cascades and distance-field shadows, a forest's "canopy shadow map").
  - **F2, canopy-density occlusion from the cover map** (`COVER`, the straight-down crown mask the terrain's floor already
    reads): one tap at the tree's root, darkening the crown's lower half and its key in dense cover. An AO for the stand,
    not a shadow. Cost: 1 tap, +1 sampler.
  - **F3, a crowding attribute at placement** (the fill knows each tree's neighbours): a per-instance "how enclosed" that
    lowers the wrap / translucency and the key on the inner trees. 0 taps, a float per instance.
- **Measured (prototype, SwiftShader, shadows 'full' switched on at runtime):** a stand of realistic fir side-lit by a
  LOW sun (~8 deg): today every crown carries its own bright orange side (the user's "forest of speckles", exactly);
  with F1 part of the inner crowns lose it, 8.4 % of the stand's pixels change, luma x0.96 (`pick2_far_stand8.jpg`).
  At ~30 deg: 2.3 %, x0.99 (`pick2_far_stand30.jpg`). Partial, untuned: the sunward offset (0.35 x the diameter), the
  cascade's 1.4 m texel and its depth bias are the dials, to tune on the GPU. **On potato the dial is inert**
  (`pick2_far_potato_inert.jpg`): the far cascade renders only where the preset has shadows (gfx_settings
  `farShadow: sh.on && sh.far`), so F1 serves current / gamer / ultra, and F2 / F3 the shadowless presets.
- **Recommended:** F1 first (it is the physical answer, the data already exists), F2 as its ambient half and the
  shadowless presets' answer. Crown normals and the key's gain: `pick2_forest_dials.jpg`.

### B3. Trees a little darker in plain sun (pick 3)
- **The cause, in the code: the trees count the sky twice.** Leaf materials and impostors are MeshStandardMaterial
  (`envMapIntensity` 1): they take the hemisphere light AND the sky probe's irradiance (`scene.environment`). The world's
  terrain is Lambert and opts out of the probe on purpose (render_world.js "THE WORLD'S LAMBERT STAYS OUT OF THE
  ENVIRONMENT": letting the IBL in "would count the sky a second time on every slope, tree and roof"). The trees were left
  with both. On top, `SHADE_K` 1.38 lifts both tiers where trees cast shadows (G1975.1, the user's column 3).
- **Methods:** (a) the trees take ONE sky term: the probe's diffuse share on leaf materials set to (1 - the hemisphere's
  share), or the hemisphere off on trees and the probe alone (the probe is the better ambient: directional, it carries
  the sky's colour gradient); a uniform each, 0 programs; (b) the simple dial: MASTER.light x 0.85 (`pick3_*`); (c) keep
  both and lower SHADE_K. (a) is the fix; it also changes the blue hour (C2), the night's fill and the step (B6). Each
  needs the re-measure of B6.
- **Still:** `pick3_trees085.jpg` (the dial). (a) needs the real probe: **GPU only** (SwiftShader's static environment, §5).

### B4. Thicker air (pick 4)
- **The cause, in the code:** the mechanism is complete (ATMO's Hillaire aerial perspective, Mie scaled by the day's
  turbidity; the mist layer F1/F2). It is set clear: `DAY_CLOCK GAME_DAY.turbidity` 2.8 ("~48 km: the hills keep their
  aerial depth") and the 'current' preset's mist 'on' (one flat layer); gamer 'land'.
- **Methods:** (a) the game's default turbidity 2.8 -> ~5 (a summer haze, visibility ~20-25 km), 0 cost (`pick4_air_t5`,
  `_t8`); (b) humidity: rh with the mist 'banks' (`pick4_mist`), a few tenths of a ms; (c) a "near haze" floor: a minimum
  AP in-scatter within the first km (the ground haze that real air always has), a uniform in ATMO's splice. The forward
  Mie glow round the sun ("diffusing lights at a distance") comes with (a). All are the user's eye; (a) is free. **Stills:** `pick4_air.jpg` (turbidity 2.8 / 5 / 8), `pick4_mist.jpg`.

### B5. A better bloom, not more (pick 5)
- **The cause, in the code:** `bloom: 'soft'` (gamer / current) is a thresholded 5-level pyramid: "the brightest pixels
  (the sun, lamps, highlights) bleed". A threshold makes bright edges halo and leaves the rest of the frame clinical.
- **Methods:** (a) the Call of Duty: Advanced Warfare bloom (Jimenez, SIGGRAPH 2014): no threshold, every pixel at a small
  weight (~0.04), a 13-tap downsample with a Karis average against fireflies, a tent upsample. It reads as air and lens
  scatter rather than glow, at the same pyramid's cost; (b) keep the threshold, widen the kernel and halve the weight.
  (a) is the "better". **Still:** `pick5_bloom.jpg` (potato's off / today's soft); (a) is not built here (code, not a dial).

### B6. The 3D model to impostor step recalibrated (pick 6)
- **The cause, in the code:** the match (G1975 uILit, G2591 IMP_LEVEL) was measured by day at the hand-over, before the
  probe followed the sun and before the night; three things move it since: the double sky (B3: both tiers take it, but the
  baked normal faces the sky more than a card does), the mip darkening (pass 1 §1.4: the sheet is baked at mip 6-7, the
  geometry at the hand-over draws mips 2-4), and the night (no row ever).
- **Method:** data only: the deadwood rig (`tools/perf/deadwood/match2.js`) re-run after B3 and A1 land, golden + noon +
  the full moon, gamer + potato; IMP_LEVEL / uILit / SHADE_K from it. **Still:** `pick6_hand.jpg` (geometry / impostor of
  the same stand at 40 m, potato, into the sun): the impostor 0.92x the geometry's luma, the hue the same to three
  decimals; the visible step is the shape (potato's 64 px tile) and the trunks (pale pink on the impostor, black on the
  backlit geometry: G1975's into-the-sun side finding, still open).

### B7. The "also" items
| item | the code today | method | cost | verdict |
|---|---|---|---|---|
| tone curve default | **Cineon** since the colour ruling (not ACES, as the 29 Oct reading assumed); AgX, neutral in the menu | AgX or Khronos neutral as default (`also_tone.jpg`) | 0 | the user's eye; neutral keeps the colours the world was tuned in, AgX softens highlights |
| specular AA | trees are roughness 1 (no specular); the water already turns its sub-pixel slope variance into roughness (water.js) | geometric specular AA (Tokuyoshi & Kaplanyan 2019) on the aeroplane skin and wet pavement | a few ALU | low: the trees do not sparkle, the water is done |
| shadow penumbra | impostorMat forces PCF over PCF_SOFT; the far cascade 4 taps at 1.4 m a texel | PCSS (a blocker search + a variable kernel) on the near map; a wider kernel with distance | 16+ taps a lit fragment: GPU only | after B2 (the far cascade on the trees changes what shadows are seen) |
| TAA | none | history + reprojection + motion vectors (the flexing aeroplane, the prop) | ~1-2 ms, 2 RGBA16F targets, ghosting risk | not now; it would make alpha hashing and specular AA cheap later |

## C. THE USER'S 5 NOV NOTES

### C1. The forest in volume: see B2 (the impostors read the far cascade). The impostors, not the near models, are what is
seen in volume, and they are where the method lands.

### C2. The blue hour, as a bug
- **What the cloud's frames show, judged critically:** at sun -5 deg SwiftShader drew the trees (and the water) near-white
  over dark land (`blue_*`). That is a RIG ARTEFACT: on a software renderer the game bakes no probe (G1460) and lights
  Standard materials with a static daylight sky made at boot (`swiftshader_env_artefact.jpg`), so at the blue hour's exposure (x40) the trees and the
  water, which read it, blow out, and the Lambert ground, which does not, stays dark. With the probe forced on
  (`?softprobe=1`) the blue-hour trees are dark, not white (`blue_softprobe.jpg`). But forcing the probe on SwiftShader
  blackens every material at noon (G1460's poisoning, `softprobe_poison_noon.jpg`), so the blue hour cannot be settled on SwiftShader either way.
- **What is real in the code, and fits "a shine from only one angle, at the blue hour and at night":**
  1. **The blue hour is the only time with no key.** The sun's key fades out by -1.5 deg, the moon takes the key at
     -1.2 deg (`sky_light.js`, the hysteresis) and is ~1e-5 until it is high; measured at -5.2 deg: key 1e-5, hemisphere
     0.034, exposure 40.7. The light is the sky alone.
  2. **The trees count that sky twice, the ground once (B3).** With no key to dominate, the second term is the trees'
     whole difference from the land.
  3. **The probe is directional.** At the blue hour the sky's radiance is concentrated in the sunset band; the probe
     lights the crown sides that face it, so trees glow from one azimuth. The hemisphere (the ground's only sky) has no
     azimuth. At night the moon key returns and masks it, partly.
  4. The pre-exposure switch sits in the same window (P 1 above -5.5, 2^14 under -6.5): the probe re-bakes at the switch
     (`preCut`), and the water's "~1 s glint toward the sun after the switch" from G2620 is still open: one more reason the
     blue hour can look out of line with the hours either side.
  The exposure ladder itself is smooth through it (light_rig `exposureFor`: 5.6 at -1, 36.8 at -5, 93 at -6.5, 148 at -7;
  no step at the switch).
- **The bug's GPU test (A0, 10 minutes):** the same forest at sun -2, -4, -6, -8 deg, four frames each: as is,
  `scene.environment = null`, the hemisphere at 0. Read the trees' and the ground's luma. If the trees / ground ratio
  jumps in the keyless window and the probe-off frame brings it in line with the other hours, B3 (a) is the fix and it is
  the same fix as pick 3.

## D. ONE ORDERED LANDING PLAN (both passes; cheapest with the biggest gain first, the night hero served first)

Each step: the files, the cost, the gate, the risk to the day look the user tuned. Rules held: strict perf (stable 30), no
new program where a uniform will do, never a look that only an unreachable preset gets.

| # | step | serves | files | cost | gates | day-look risk |
|---|---|---|---|---|---|---|
| **D0** | **A0's GPU test, 10 min** (C2): the forest at sun -2 / -4 / -6 / -8 deg and the full moon; as is / probe off / hemisphere 0; trees' and ground's luma; and the impostors with `L1U.far` 0 / 1 at golden hour on gamer (the prototype patch) | decides D1 and D2 | none (the patch, a scratch tree) | none | none | none |
| **D1** | **the trees count the sky once** (B3 a): a leaf-material uniform splitting the sky between the hemisphere and the probe (one term in all), the impostors through the same uniform | **the blue hour bug** (C2), pick 3 (darker in sun), the night's fill, feeds pick 6 | trees.js (the leaf hook), render_world.js impostorMat | 0 draws, 0 programs, 0 memory | PROGRAMS, LIGHT (a row: trees take one sky term), CARDMATCH (cards follow by construction), TREES | REAL and wanted: the trees darker in plain sun is the user's pick 3; level compensated only if the user asks |
| **D2** | **the impostors read the far cascade** (F1), the cover map's stand AO (F2) for the shadowless presets | **pick 2 + the forest of speckles** (C1); the night at range (the cascade follows the key: the moon at night) | render_world.js impostorMat (the terrain's own 4-tap lookup, the receiver moved sunward by the crown), farRender unchanged | +1-2 samplers, 4-5 taps an impostor fragment, 0 memory, 0 programs | PROGRAMS, FRAMECOST (low flight over the forest, current + gamer), CARDMATCH | stands darker on their shaded sides; the lone trees unchanged |
| **D3** | crown normals at night, near geometry only (pass 1 M1; NOT on the impostors: `pick2_forest_crown` shows why) | the hero shot's near specks | trees.js leaf hook (vertex), the dial from dayApply | a mix + normalize a vertex, 0 programs | PROGRAMS, a CROWNN row (0 by day) | none (0 by day) |
| **D4** | alpha-to-coverage for real on the default preset: the `off` tier keeps 4 samples under the clouds (B1 a) | pick 1 ("pixely") | aa_resolve.js (the tier's needRT sample count) | ~+50 MB at 1080p, fill: **GPU decides** | FRAMECOST, AA | edges softer everywhere: the asked-for change |
| **D5** | alpha-weighted leaf mips + a leaf-only level factor (pass 1 A1) | the specks' amplifier, "harsh" crowns at range, pick 6 | trees.js coverageMips, retint | 0 (load time measured the same) | MIPCOLOR (new, with the straight filter as its negative control), TREES, CARDMATCH | REAL: the far crowns' level and contrast; the user judges `sheet_*` |
| **D6** | the tier match re-measured, golden + noon + the full moon (a night row for the first time) | pick 6 | render_world.js IMP_LEVEL / TREE_SHADED numbers | data only | CARDMATCH, TREES | holds the approved level by construction |
| **D7** | thicker air: the default turbidity 2.8 -> the user's pick from `pick4_*`, a near-haze floor in ATMO's AP | pick 4 | day_clock.js GAME_DAY, atmo.js | 0 | ATMO, DAY, SKY | the whole picture: the user's eye |
| **D8** | a better bloom: thresholdless, energy-conserving (Jimenez 2014) | pick 5 | the post pass (aa_resolve / bloom) | the same pyramid; 0-1 program swapped, not added | POSTFX, PROGRAMS | the glow round lamps and the sun: the user's eye |
| **D9** | the tone curve trial: AgX / neutral as default (`also_tone_*`) | "also" | gfx_settings.js COLOUR | 0 | GFX | the whole picture: the user's eye |
| **D10** | later: the golden-hour backlit gain on impostors, the sway phase, specular AA on the skin, PCSS, TAA | pick 2 (backlit), "also" | | | | |

**Pass 1's steps against the six picks:** its crown normals serve the near trees and the night only, not pick 2 in volume
(D3); its mip fix (D5) serves the "harsh / pixely" crowns at range and pick 6; its tier re-measure is pick 6 (D6); its
backlit gain is pick 2's golden-hour half (D10). Pass 1's "step 1" moves down: the forest and the blue hour come first.


---

# PASS 3 (5 Nov): THE BACK-STEP — THE FLICKER IN MOTION, WHAT THE FIELD KNOWS, AND A NARROWER PHASE 2

The user, 5 Nov, after passes 1-2: "we didn't change much" (true: both passes are studies, no game code). And the
re-framing that narrows this study: *"what bothers me even more than the static picture ... is the constant flickering.
The clouds are one of the main culprits: they keep getting redrawn through that sort of smoke pattern, and particularly
the little ends where they are really thin and cut, these ones redraw as soon as the camera moves. And it's the same for
the trees: a canopy is a really jagged edge, so every time you move, this jagged edge moves with the clouds at the back
that are also jagged ... You don't look at the top of a tree and see it all jagged and pixely."* Statically: the
impostors look pixely and their shading is poor even far away. Asked: a back-step to the literature and the usual engines
(Unreal, MSFS, dedicated ones), people who describe the problem better, and a solution.

Sources below were gathered by web search; most primary decks and forum pages could not be opened from this session
(the network allowlist), so a claim marked [snippet] stands on the search engine's excerpt of the cited page.


## E0. THE USER'S REFERENCE FRAME (5 Nov, the night hero session): "the circled part looks wrong"

The frame: the floatplane on the lake at night, the aurora, the shore house. Circled: the NEAR hillside forest on the
left, every crown dusted with gold-tan specks along its upper, moon-facing edge; the farther hills on the right read calm
(dark blue, smooth). What the three passes say about that difference, from the code and the measurements:
1. **The specks are the moon key on each card's / texel's own normal** (pass 1 §1.3: the key held at 0 removes them), in
   the key's own reddened colour (0.92, 0.78, 0.58 - the gold), on a crown whose ambient is near zero (the hemisphere's
   ground half ~black at night). The left slope faces the moon; every crown's moon-facing top lights up.
2. **Nothing shades one tree from its neighbour** (pass 2 B2): each crown on the slope carries its own lit edge - the
   "very bright edge on every tree" of the user's 5 Nov note; the far cascade the impostors never read is the method
   (prototype: a low sun's stand loses part of those edges, `pick2_far_stand8.jpg`).
3. **The mips widen the crowns' texel contrast 2-3x at range** (pass 1 §1.4), which is why the specks read as pale blocks
   on dark crowns rather than a lit side.
4. **The right-hand hills are calm because they are FARTHER**: the aerial perspective has taken their contrast (and the
   slope may face away from the moon). That is Koschmieder in one picture: distance + air is the "selective blur" the user
   asks for, and the near slope has none of it.
5. And in motion, every one of those lit edges crawls (E4).
So the circled part is the meeting of all three findings, and phase 2's tree work (E6 2c: the far cascade on the
impostors, the impostor alpha rebuilt, the sky counted once, crown normals at night for the near trees) is aimed at
exactly that slope. The frame should be the A/B reference for that work (the user's own capture; it is not in the repo).

## E1. What the field says, in one paragraph

What bothers people is **the image changing from frame to frame, not the image being sharp or soft.** Hoffman, Meraz and
Turner (Google, J. SID 2018, "Limits of peripheral acuity and implications for VR system design") found temporally
STABLE rendering, "both blurred and aliased", "much less noticeable than temporally volatile approaches", and viewers
"highly sensitive to volatile" downsampling, most of all in the periphery, where vision is tuned to change. Real viewing
never flickers because the air lowers distant contrast (Koschmieder: C = C0 e^-βd) and blurs fine detail (the aerosol
MTF, Kopeika), the eye's optics blur at ~1 arcminute, and every edge is integrated over area and time. A renderer that
takes ONE sample a pixel a frame with crisp edges does none of that: sub-pixel leaf and canopy edges and noisy cloud
edges snap between pixels as the camera moves. **The cure the industry converged on is to filter before display: average
across frames (TAA / TSR / DLAA, Karis 2014 onward), make the per-frame samples stable (coverage-preserving alpha,
alpha-to-coverage, prefiltered impostors), and let physical haze take contrast from distant edges.** Frame interpolation
/ motion smoothing (DLSS-FG, FSR 3 FG, ASW) is NOT a cure: it adds no samples per pixel, it repeats the input's flicker at
a higher rate. Raising the render resolution only "reduces the size of the flickering pixels" (an MSFS player). The
user's "selective blurring like the eye does" is the right family; "interpolating between frames" is the wrong one.

## E2. People describing the same thing (quotes [snippet])

- MSFS 2024: "you see flickering of the cloud edges like they are clipped at a very low resolution."
  (forums.flightsimulator.com/t/1-6-22-0-heavy-cloud-cloud-edge-flickering/745887)
- MSFS 2024: "Many VFR obstacles beyond a certain view distance cause ghosting artifacts against clouds" (trees in front
  of clouds; forums.flightsimulator.com/t/.../681322).
- MSFS 2020: grainy, pixelated clouds came with a SHARPER TAA (1.10.7.0), went with "the old blurry TAA" (1.13.16.0),
  came back with 1.14.5.0 (forums.flightsimulator.com/t/.../375977): the clouds' dither shows the moment the temporal
  filter stops averaging it.
- X-Plane 12: "The trees shimmer, distant straight lines, roads shimmer and have a 'marching ant' effect"; with 8x MSAA
  "trees are still not great when moving" (avsim.com, topic 629745). Laminar added "better coverage for alpha-tested
  surfaces" in 12.1.0, and (second-hand) calls TAA its "endgame".
- DCS: "hideous shimmering ... equivalent to MSAA being almost off"; DLAA: "not a hint of shimmering in the entire
  cockpit", trees helped "a little" (forum.dcs.world, topic 353993).
- r/FuckTAA, the counter-view: "Shimmering is absolutely the most distracting thing" (trees in motion), and "anything with
  alpha needs some form of temporal stability"; what they hate is TAA's blur and ghosting, tuned badly or sharpened.
- Valve (Vlachos, GDC 2015, VR): players call aliasing "sparkling"; 4x MSAA minimum.

## E3. Our code against the field (read this session)

| what the field does | what flyDiy does today | where |
|---|---|---|
| a temporal history (TAA / TSR) that averages jittered samples | **none anywhere**: no history buffer, no TAA, no reprojection; every frame is one sample a pixel | aa_resolve.js, app.js |
| clouds: march low-res, **reproject + accumulate** (Nubis: 1 of 16 pixels a frame + reprojection; Frostbite: Halton jitter, ~5 % blend), blue-noise ray offsets that converge under the history | the march at half res, a per-pixel jitter **frozen in screen space** ("per frame it would shimmer (no history averages it yet - the temporal pass is owed)", `S.shimmer` 0); **so the grain is locked to the screen and the clouds slide under it: the "smoke pattern redrawn as the camera moves"** | clouds.js 16-22, 243-255, 944 |
| cloud edges: detail noise is an erosion AT the edge (Nubis), so edges are where sampling fails first; soften the remap, band-limit the detail with distance | the same Perlin-Worley erosion; the half-res buffer's 2x2 blocks at a thin edge, a 3x3 depth-aware tent upsample (a spatial blur, nothing temporal) | clouds.js 408-440 |
| leaf cards: alpha-to-coverage with MSAA, coverage-preserving mips | A2C asked for, coverage mips done (pass 1), but **0 samples on the default preset** (aa 'off' + clouds: aa_resolve G1250), and the leaf edge is sharpened to one pixel (`uSharp` 0.9) - a hard staircase that crawls | trees.js 588, 614-621; aa_resolve.js 136-140 |
| impostors: soft (supersampled) coverage, premultiplied + dilated colour, coverage mips, the sharp cut only when magnified; 3-frame octahedral blending (Brucks) | the 3-tap blend is there (good); the bake is BINARY alpha at the cut, the draw's alpha gain 6 makes a near-binary edge, the sheet is baked off the leaves' deepest mips (pass 1 §1.4), tiles 128 px (64 on potato) minified 2-6x at range: **the "pixely impostor"** | render_world.js bakeImpostorAtlasNow, impostorMat |
| far forest as a prefiltered aggregate (Bruneton & Neyret 2012: "without popping nor aliasing"; UE 5.7 Nanite Foliage voxelises the far canopy) | individual impostors to 9 km, then stand cards | render_world.js, stand_cards.js |
| no sharpening after the AA (the MSFS lesson) | no sharpen pass (good); the bicubic upscale of the low render scales (potato 0.67, laptop 0.5) | aa_resolve.js |
| haze takes contrast off distant edges | AP + mist complete but set clear (turbidity 2.8) | day_clock.js (pass 2 B4) |

## E4. Measured here: how much the trees flicker, and what each dial buys (SwiftShader, no frame time)

THE METHOD (`rig/stage_flicker.js`, `rig/flicker.py`): one paused scene drawn at six sub-pixel camera offsets (Halton 2,3
within ±0.5 px: what a slow pan samples) plus one exact repeat (the noise floor). Per pixel, the spread across the
offsets = what crawls when the camera moves; "flicker" = the share of pixels whose spread exceeds 4 display codes. The
offsets' MEAN is the image a temporal accumulation converges to. Two views: a canopy against the sky from the ground
(80 m from the trees: impostor-first bands, so impostors) and a stand from 350 m, 40 m up. Potato (render scale 0.67, no
clouds). **The clouds could not be measured**: switching them on under SwiftShader blacks the frame (the clouds' flicker
stands on the code reading and the literature, E3).

| view | dial | pixels that crawl (spread > 4 codes): whole frame / below the horizon | spread p99 (codes) | noise floor |
|---|---|---|---|---|
| canopy from the ground, 80 m (impostors) | today | 7.65 % / **13.4 %** | 22.8 | 0.0 % |
| | soft edges (leaf sharpen 0.9 -> 0.3, impostor alpha gain x0.5) | 7.49 % / 13.1 % | 22.5 | 0.0 % |
| stand from 350 m, 40 m up | today | 7.56 % / **13.8 %** | 16.7 | 0.0 % |
| | soft edges | 7.81 % / 14.2 % | 17.0 | 0.0 % |
| both | 4x MSAA (`GFX.set('aa','msaa4')` at runtime) | identical to today to the decimal: **the dial did not apply on SwiftShader** - NOT a result | | |

What it says: **one in seven pixels below the horizon crawls under a sub-pixel camera move, and they are the tree
outlines** (`flicker_stand_base.jpg`, `flicker_canopy_base.jpg`: the map lights every crown's edge). The noise floor is 0,
so it is the camera's motion alone. **Softening the edges per frame barely moves it** (-2 %): the crawl is not the cut's
sharpness, it is one sample a pixel a frame. The offsets' MEAN (the middle panel of each sheet) is the calm image: what a
temporal accumulation converges to. This is the literature's finding (E1), measured on this renderer.

## E5. The methods, ranked for this renderer (strict 30 fps; GPU costs are ESTIMATES until measured)

| # | method | cures | cost | risk | source |
|---|---|---|---|---|---|
| **T1** | **the clouds' temporal pass** (owed since C1): reproject the half-res cloud buffer with the previous view-projection and the cloud's own mean depth (the key the composite already writes), clamp the history to the current 3x3 neighbourhood (Salvi variance clip), blend ~0.1, the jitter made per-frame spatiotemporal blue noise (STBN) instead of screen-frozen; reject only off-screen / depth disagreement - never on camera motion | the cloud "smoke pattern" and the flickering thin edges; lets the march take fewer steps | 2 RGBA16F targets at half res (~8 MB at 1080p), 1 pass at half res (~0.2-0.5 ms est.), +1-2 programs | ghosting on fast cloud motion (clamp), the aeroplane in front (the composite's depth test already handles it) | Schneider & Vos 2015; Hillaire 2015/2016; Toft et al. 2016 ("TAA is unable to improve the appearance when an identical random offset is applied to every ray"); Heitz & Belcour 2019; Wolfe et al. 2022 |
| **T2** | **a frame TAA** (an `aa: 'taa'` tier): Halton jitter in the projection, history reprojected from depth + the previous camera (the world is static; the aeroplane / prop / water need a mask or velocity), 3x3 variance clip, feedback 0.88-0.95, luma weighting, NO sharpening; a port of three.js r186 `TRAANode`'s ~200 lines of resolve logic into aa_resolve's GLSL | the canopy crawl, the impostor shimmer, the clouds too (it subsumes much of T1), hashed alpha / dithered fades become usable | a full-res RGBA16F history (~16 MB at 1080p) + depth, 1 full-screen pass (~0.5-1.5 ms est.); excludes MSAA (A2C off on that tier) | blur and ghosting (prop, flexing wings, HUD/panel must stay out), the r/FuckTAA complaints: tune, never sharpen | Karis 2014; Salvi 2016; Pedersen 2016 (Playdead, MIT source); Yang et al. 2020 survey; three.js r186 TRAANode |
| **T3** | **the impostor alpha rebuilt**: bake SOFT coverage (supersampled, premultiplied, dilated into the gutters), coverage-preserving sheet mips, the sharp cut only when a tile is magnified; flatter far shading (prefiltered normals) | the static "pixely impostor" and its crawl | bake time; ~0 at draw | the far forest's level (re-measure, pass 2 B6) | Castaño; Brucks 2018; Green 2007 (alpha SDFs for impostors); Kaplanyan et al. 2016 |
| **T4** | **without TAA**: MSAA 4x + A2C for real on the default preset (pass 2 B1), the leaf sharpen relaxed with distance | the near leaf-card crawl | +~50 MB at 1080p, fill: GPU decides | none to the look but cost | Golus 2017; Valve 2015 |
| **T5** | **the air** (pass 2 B4): turbidity up, a near-haze floor | the distant edges' contrast, physically | 0 | the whole picture: the user's eye | Koschmieder; Kopeika |
| ✗ | frame interpolation / motion smoothing | nothing: no new samples | | adds its own artefacts | DLSS-FG / FSR 3 docs |
| ✗ | a higher render scale alone | shrinks the flicker, does not remove it | fill ~ scale^2 | | MSFS players |
| ✗ | FXAA / SMAA alone | static jaggies, not the sub-pixel crawl | | | UE docs |

## E6. A NARROWER PHASE 2 (proposed; the user decides)

The study's scope narrows to ONE question: **is the frame temporally stable?** Today it is not by construction (no
history anywhere, a screen-locked cloud jitter, binary edges). The lighting items of passes 1-2 (the sky counted twice,
the far cascade on impostors, the night specks) remain real, but they are static-picture items, and the user's main
complaint is motion.

- **Phase 2a - the clouds' temporal pass (T1).** Self-contained in clouds.js (the composite already has the cloud's
  depth key), owed since C1, the user's first culprit. Judged in motion on the GPU: a pan along a broken cumulus layer,
  before / after. Gate: CLOUD (+ a row: history is not dropped on camera motion), PROGRAMS (+1-2), FRAMECOST.
- **Phase 2b - a TAA tier, as a prototype the user can toggle (T2).** `aa: 'taa'` beside off / msaa4 / msaa / full: the
  canopy, the impostors and the clouds together; the cockpit, the HUD and the prop handled (masked or excluded). The user
  judges it in motion against `msaa4`; that judgement decides whether the default AA path is MSAA + A2C (T4) or TAA.
- **Phase 2c - the impostor alpha rebuilt (T3)**, with pass 2's D2 (the far cascade) and D1 (the sky once) in the same
  tree session - the static "pixely, badly shaded impostor".
- Then the rest of pass 2's plan (§D), re-ordered behind these.


## 5. What SwiftShader cannot show

- **No sky probe.** On a software renderer the game bakes none (G1460: the PMREM blackened every Standard material) and
  lights Standard materials with a static environment made at boot. The trees (Standard) then take a fixed daylight sky:
  the frosted trees in every cloud night frame and the white trees at the blue hour (`swiftshader_env_artefact.jpg`;
  the probe-off frames are the closer stand-in). The probe's real share at night is the first GPU number to take.
- Only potato: no tree shadows (uILit 1.242; the shadow map's crown occlusion on shadowed presets is not seen), 64 px
  tiles, no MSAA (alpha-to-coverage inert), no 4K.
- **Forcing the probe on (`?softprobe=1`, pass 2) does not help by day**: every material goes black at noon (G1460's
  poisoning); it draws at night and at golden hour only.
- **No far cascade on potato**: it needs world shadows; pass 2 switched shadows 'full' on at runtime to show B2.
- **The clouds cannot be drawn by the flicker rig** (switching them on blacks the frame), and the runtime MSAA switch did
  not apply in pass 3: both are GPU measurements.
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
- Pass 2 (cited by title; the methods are well known, no page was fetched for them): J. Jimenez, "Next Generation Post
  Processing in Call of Duty: Advanced Warfare", SIGGRAPH 2014 (the thresholdless bloom); C. Wyman, M. McGuire, "Hashed
  Alpha Testing", I3D 2017; Y. Tokuyoshi, A. Kaplanyan, "Improved Geometric Specular Antialiasing", I3D 2019.
