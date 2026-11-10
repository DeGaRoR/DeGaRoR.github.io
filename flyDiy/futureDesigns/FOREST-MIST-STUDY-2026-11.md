# FOREST MIST - pockets of mist hung in the trees (study + prototype, 2026-11-09)

The user (9 Nov), after the 13 concept-art pictures made as targets for the promo screenshots:
*"One thing that was present in almost all of them were little pockets of mist or clouds hung on the trees, and they
are very beautiful and they really do help to get a sense of layering in the landscape. Could we launch some study into
how to do that? My gut would say we could try to reuse the cloud system which is already running, but at a higher
resolution, and then I don't know exactly how you would have it hang over the forests. That would be awesome if it
could also move with the wind, but stay stuck in there, and isolate layers of forests to the eye. Or maybe we could do
something a lot more fakey, and simply have planes slowly moving through the forest with a procedurally animated
texture over it. So can we study this, please?"*

Session: FOREST-MIST (cloud, no GPU: every picture here is SwiftShader, every cost a COUNT or a bound, never a frame
time; A0 books the box for the real A/B). Branch `claude/forest-mist` off master `e789e77c` (train L36b).
Prototype behind `?fmist=` (off by default: nothing is created, uploaded or spliced, and the off path is byte-identical
- `tools/_fmist_check.js` section 1). Pictures: `reports/evidence/FOREST-MIST/`.


## 0. THE ANSWER FIRST (as it stands on 10 Nov, after the user's eight steering notes)

- **What the concept art shows is three mists**, each with its own place and clock (section 1): the valley POOL
  (radiation fog: a clear calm night, a flat top, burnt off two hours after the sun), the forest WISP (wet crowns
  steaming after rain), the cloud base on the slopes (OROGRAPHIC). They sit IN the forest at heights tied to the land,
  so each ridge stands out of the mist in front of it.
- **The game had the valley half** (FOG-MIST F2, Sept: `mist: land/banks`), a soft blanket at 94 m texels with no
  forest and no rain term, off under 70 % humidity - why the art's pockets were never in the game (section 2a).
- **Built: one pocket map + the weather's law + the veil** (sections 3, 5): the map says WHERE (512^2 over the island
  into the atmosphere atlas: no new sampler); the season's plan and the day say WHEN and HOW MUCH (the authored fog days,
  the rain through the soil's hours-dry, the low base and the cover); the noise drifts on the wind while the map stays,
  so the wisps stream through a pocket and fade at its edge - *"move with the wind but stay stuck in there"*.
- **The renderer picked by the user is THE VEIL** - the pockets inside the mist every fogged material already applies:
  no draw, no pass, no sampler, sorted with everything (trees, impostors, water) by construction. **THE MARCH** (the
  user's first idea: the same density in the clouds' pass) and **THE CARDS** (the user's second: drifting sheets) were
  built and judged (sections 3, 4); both stay flag-only. The cards lose on sorting (a hard line where a sheet meets a
  crown), on the cockpit and on far pockets; the march costs the clouds' pass, which the phone does not run.
- **The look** is the user's pick of 10 Nov (`reports/evidence/FOREST-MIST/s08_PICK_run11.jpg`): 110 m wisps eroded to
  ~2 m, the weather on both the amount and the density (0.003 /m at the heaviest, a quarter for the last wisps), lit by
  the sun's beam with a droplet forward lobe (backlit, it glows).
- **In the game** (READY for A0, `reports/evidence/FOREST-MIST/READY.md`): a GRAPHICS row **forest mist: off / on**
  (sky; OFF until the player turns it on - the desktop presets are frozen), **GATE FMIST** in the core battery, and the
  weather panel's **"the season"**: nine moments and the 42 crafted days, one click each, for screenshots.
- **When you see it** (section 5's table): heavy at dawn on the three authored fog days (gone by 10-11), cloud on the
  slopes through the storms, wisps the evening after, mist on the hills on the drizzle day, a thin breath at dawn on
  most calm days, nothing on windy days.
- **Owed to the box**: the veil's ms (budget <= 2 ms gamer, <= 1 ms laptop), FRAMECOST with the row on, then the
  presets' defaults and the offline bake (sections 6, 7).

---

## 1. WHAT REAL FOREST MIST IS

| kind | how it forms | where it sits | when | how it moves and goes | source |
|---|---|---|---|---|---|
| **Radiation / valley fog** (the POOL) | the ground radiates to a clear night sky, the air on it cools to its dew point; the cold, dense air drains down the slopes (katabatic) and piles up on the valley floor under a temperature inversion | the lowest part of each valley, a **flat top** at the inversion; ridges stand out of it; wet valleys (rivers, lakes, vegetation) saturate first | clear + calm + humid nights; deepest at dawn | barely drifts (it needs calm: wind mixes the inversion away); the sun warms the ground, the inversion erodes **from below**, it lifts into stratus and dissipates, usually by mid-morning; can last days in a winter valley | Met Office, *Types of fog*; Wikipedia, *Fog*; NASA Earth Observatory, valley fog image 79700; weatherandradar.co.uk, *Valley fog formation* |
| **Forest steam / transpiration mist** (the WISP) | after rain the crowns hold water; as the sun warms them it evaporates/transpires into near-saturated air and re-condenses in wisps; a forest also supplies moisture through transpiration on any humid day | **on and in the crowns**, rising from hollows and gullies, between successive ridges of forest | right after rain, especially when the first sun reaches the wet trees; humid mornings | rises and tears in the breeze, re-forms downwind; gone within hours of drying | NY Review of Books letter (1983) on the Smokies' transpiration; WSMV (Aug 2026) and Our State on the Smokies' "smoke"; regional guides on "rising mist, drifting fog" after storms |
| **Orographic / upslope cloud** (the ORO band) | moist air pushed up a slope cools adiabatically to saturation; a low deck's base meets rising ground | a **band at the cloud base**, wrapping the slopes and caught in the trees there ("cloud forest": the canopy intercepts the droplets) | humid, overcast, a low base; windy days make it (upslope flow), they do not clear it | streams over and around the terrain with the wind, stays anchored to the slope at the base's height | AMS Glossary, *orographic fog*, *upslope fog*, *orographic cloud*, *fog forest*; Holder 2003, fog precipitation in a Guatemalan cloud forest |
| (Advection / sea fog) | warm moist air over cold water | the sea, the shore | a plan's `fog.hold` | drifts in with the wind | already the F2 layer + WEATHER-SEASON's `fogHold`, not this study |

**What the concept art takes from these** (the brief's description of A0's 13 pictures): low banks and wisps caught on
forested slopes and between ridges (WISP + ORO), a sea of fog under a mountain (POOL, seen from above it), sun rays
through mist over a strip (any of them, lit from behind: the forward peak), mist on a lake at dusk (steam fog over warm
water - a lake POOL; see Q4). **The layering is the point**: each ridge's foot is washed out by the mist in the valley
in front of it while its top stands dark, so the eye reads depth plane by plane (aerial perspective in steps, not in a
gradient).

**Two physical facts the design keeps**:
1. **Pockets redistribute, they do not add** (F2's lesson, FOG-MIST SS3b.1): the day's humidity is the calibrated
   quantity; where the map says "nothing here" there must be clear air, or "pockets" become "haze everywhere".
2. **The wind takes the POOL and the WISP, it MAKES the ORO band**: calm is a condition of the first two
   (`mistCalm`, 3-10 kt, 07_day.js), upslope wind is the cause of the third.

---

## 2. THE GAME TODAY (read first)

### 2a. The mist we have (atmo.js, FOG-MIST F1-F3, 2026-09)

- **One splice** (`AP_APPLY` at the head of `tonemapping_fragment`, `atmo.js`) applies the aerial perspective and then
  `mistApply` on every fogged material, the dome and the clouds' composite. The mist is an exponential height layer
  (`uMist[0..3]`), closed form along the ray; **F2** adds a 256^2 field in the atmosphere atlas's free columns (the top
  = the valley floor or the water, a boundary-layer fade `exp(-floor/200 m)`, a wet bonus) and a 6-sample march with
  a drifting 2-octave value-noise bank (900 m) - `mist: on` (flat, laptop/potato/retro/current), `land` (gamer),
  `banks` (ultra).
- **Its density is the day's** (`07_day.js`): `mistRho0 = 0.0025 ((rh - 0.7)/0.3)^2 (1 - burn) mistCalm`, the burn
  from the LAGGED sun (two hours behind) times the clear sky (`mistBurn`), the calm from the wind. Under 70 % humidity
  there is no mist at all.
- **Measured cost** (FOG-MIST SS3b.1, A/B/A, RTX 3080, the stand): `land` +0.8 ms, `banks` +3.3 ms (the noise is the
  cost, not the field's tap), 12 samples +8.9 ms.
- **Why it is not the concept art**: 94 m texels and a 900 m bank are a blanket's scale, not a pocket's (the art's
  wisps are 50-200 m); it has no FOREST term (it lies on the land, not on the crowns) and no RAIN term (the art's
  after-rain wisps); it follows the valley FLOOR with no lid, so it has no flat top; and a fresh profile sees it only
  above 70 % humidity.

### 2b. The clouds (clouds.js, CLOUDS C1-C4 + LOOK-1 2a)

- Nubis-style: a weather map drives 3-D Perlin-Worley (128^3) and detail (64^3) noise; up to 3 decks; one ray a pixel
  at **half resolution** (`clouds: half`, gamer) or full (ultra), 48 steps + a 5-step light march, multi-scatter
  octaves, the SAME aerial perspective and mist at the cloud's mean distance; **temporal** (two RGBA16F history
  targets, reprojected); composited as a full-screen quad **inside the world scene** (`renderOrder 1e6`, depth-tested,
  writing `gl_FragDepth` from the march's key) through a depth-aware upsample.
- **The scene depth it reads is the PREVIOUS frame's** (G650): the march runs before the scene. A near silhouette is
  a frame stale; G650 marches "through" anything nearer than the first deck. **Pockets are nearer than every deck**,
  so the prototype turns that rule off while a pocket is live (section 3a's risk).
- Its own GPU timer (`CLOUDS.stats.gpuMs`): **0.67 ms** at cover 0.2 on the 3080 (FOG-MIST SS1a).
- **Off on laptop, potato and retro** (the phone is `laptop`); `half` on current/gamer, `full` on ultra. Its pass
  runs only while a deck has cover (`active()`); the prototype keeps it live while a pocket is (a clear dawn is the
  POOL's morning).
- On SwiftShader the cloud pass blacks the frame (LOOK-1's README) - checked again here, section 4.

### 2c. The weather (07_day.js, 07e_soil_wet.js, 09_climate.js)

Everything the law needs already exists and is pure: `rh`, `dewC`, `cloudBase = 125 (T - Td)`, `cloudCoverEff`,
`mistBurn` (the lagged sun x the clear sky), `mistCalm` (3-10 kt), `rain` (the plan's), `fogHold`/`fogWhere` (the
plan's advection fog; `fogWhere` read by no viewer file yet), **`SOIL_WET.at(day).hoursDry`** (time since rain, up to
96 h, from a stateless bucket over the plan - DIRT-STRIP's) and `rainNow`; `climate.sample(x, y, z, t)` is the wind
everyone but the solver reads (the F2 banks' drift is an integral of it); `climate.reliefAt` has a ridge/valley
prominence channel.

### 2d. LOOK-1's haze (L36a, `look1-haze-soft`)

`uApK` scales the aerial perspective's optical depth to the weather's column visibility (`ATMO.hazeK`: k = 3.912/vis
over the atlas's own extinction; ~3.3 on the default day, `?haze=` the dial) and the impostor/cloud shaders read it
through `apScaled`; trees soften with distance (`TREE_SOFT` 150-600 m). **That is the continuous gradient of aerial
perspective**; the pockets add the STEPS - and must not double it: the pocket term is applied after the haze, as the
mist is (a second medium), and is zero where the map is zero.

### 2e. The trees

Opaque (alpha-to-coverage leaves, `transparent: false`), L0 to 10 m, L1 to 30 m, octahedral impostors beyond, stand
cards from 4 km to 30 km, a canopy texture past `FAR_FILL` (9 km on the island); the streamer's ring at
`R_ACT = FAR_FILL + 100`, thinned over 3-4.5 km. Crowns 10-20 m (species 9-22 m x the island's canopy gain). The island
carries a 10 m canopy raster (`world.island.canopyAt`), which is what the pocket map reads. **Opaque trees are why the
veil and the march sort correctly and the cards do not** (section 3).

### 2f. The water

`MeshPhysicalMaterial`, `transparent: true, depthWrite: true`, the sea at `renderOrder -10` (the first transparent).
It takes the splice like any fogged material, so the veil reaches a lake; the clouds' composite (and the march) is
depth-tested against its surface; a card is alpha-blended after it.

### 2g. The performance rules

Stable 30 fps on the reference (gamer, RTX 3080 class, 53-60 fps at 1080p, the frame bound by the CPU's draw count);
the phone is S20-class on the `laptop` preset (half resolution, no clouds, forest x0.5, ~700 MB heap); GATE FRAMECOST
counts draws/programs/uploads per frame against `tools/perf/framecost_baseline.json` (1 %, 2 abs; no ms); GATE ASSETS
lets no material be made outside `matlib.js`; the timed gate (A0's box) is the ms. **Strict 30 per frame** (LOOK-1).

---

## 3. THE TECHNIQUES, JUDGED

All three read the SAME pocket map and the SAME law (`src/viewer/forest_mist.js`), so the comparison is of renderers,
not of tunings.

### 3.0 The pocket map (shared)

512^2 RGBA over the island's bounds (76 m texels on Jolene), baked once per world on the CPU from `terrainH`,
`waterH`, `island.canopyAt`: **R** the canopy top (ground + crowns), **G** POOL = valley-ness (how far down from the
ridges to the floor, 1 on the floor, 0 half-way up) x `exp(-floor/450 m)` (cold air pools low) x (forest or water
nearby), the open sea x0.12 (the F2 layer's), **B** WISP = forest x (hollow: the land under its own 600 m blur) x a
little water nearby, **A** the valley floor (the pool's lid is `floor + 25 m + 110 m x G`: a flat top per valley).
Drawn into the atlas at columns [768, 1280) of the tile rows (the clouds' tile owns [0, 512), F2's field [512, 768)):
**no new sampler**, the island ground's programs stay at 15 of 16.
Cost: 630-780 ms of CPU in node (once, under the roll-out screen), 2 MB of float32 for the upload, 0 per frame.
At landing it should be baked OFFLINE with the island (the island is data) or in a worker (Q6).

The density (`fmDens`, GLSL, one atlas tap + 3 value-noise taps):
`cov = pool_k G [y under the lid] + wisp_k B [band -12..+40 m about the canopy top] + oro_k [band -40..+140 m about the
cloud base, near the ground]`, then Schneider's coverage remap of a 3-octave value noise (160 m cell, a slow vertical
shear so a wisp leans), **the noise drifted by the integral of the wind at 40 m, the map not**: per metre
`rho(I) x d x cover-edge` - **as picked: 0.003 /m at the heaviest weather (~1.3 km visibility inside: a veil, never a
wall), a quarter of it for the last wisps**, 110 m cells, a three-octave erosion to ~2 m, a sin-free hash (section 4a).

### 3a. THE MARCH - the cloud system, lower and finer (`?fmist=a`, the user's first idea)

The pockets marched inside the clouds' pass, before the decks (they lie under all of them): 28 steps on a square law
to 3.5 km or the scene, a two-tap shadow toward the key, the clouds' sun/moon/sky colours and phase, then the clouds'
own aerial perspective at the mean distance, their temporal history and depth-aware upsample.

| | |
|---|---|
| look | the best: real volume, lit from inside (silver edges toward the sun, the forward peak), seen against the SKY as well as against the ridges, a bank you fly into |
| motion | wisps stream through the pocket with the wind and fade at its edges; the temporal pass smooths the 28-step grain |
| sorting | depth-correct against everything opaque; against the transparent water by its depth (the water writes depth) - correct. **Risk**: the scene depth is a frame stale (G650), so a tree crossing a pocket at speed can drag a one-frame halo; the history's reprojection is on the cloud's mean distance, a near pocket's parallax is large - **to be judged in motion on the box, never in a still** |
| night/moon | the clouds' moon term; the mist goes dark-blue grey, which is right |
| cockpit | inside a pocket the march starts at the eye: you fly into a white-out and out the other side |
| far | to 3.5 km; beyond it the veil (with `?fmist=ac`) |
| cost | the cloud pass's own timer will show it (`CLOUDS.stats.gpuMs`); EXPECTED like the clouds' own march at half resolution: ~0.3-1 ms on the 3080 (28 steps x 4 taps against the clouds' 48 x (2 3-D taps + 5 light steps)), 0 draws added (the pass already exists), **0 on the phone (the pass is off there)**. Turning the pass on for a cloudless dawn costs what the pass costs |

### 3b. THE CARDS - soft sheets drifting through the forest (`?fmist=b`, the user's second idea)

420 camera-facing sheets (one instanced draw, `renderOrder 3`, alpha-blended, depth-tested, not depth-written), dealt
from the map's pocket texels within 2.6 km of the eye every 20 frames, each a 3-octave noise drifting along the wind
and fading at its anchor's ends (born upwind, gone downwind - it streams and stays), coloured with the mist's own light.

| | |
|---|---|
| look | at a distance, believable puffs; near, they are cards: **a hard line where a sheet cuts a crown** (the main pass has no depth to read - a soft-particle fade needs the scene's depth in the pass that draws it, and the only depth we can read is the clouds' previous-frame copy), and the sheet turning as you pass it |
| motion | good drift; the deal pops a card in or out at the 2.6 km ring unless faded |
| sorting | the weakest: blended AFTER the water and the opaque trees, in instance order (no sort): two cards overlapping each other draw in the wrong order half the time; a card in front of the transparent water blends over it correctly, one behind it is hidden by the water's depth write |
| night | the mist colour follows the day; fine |
| cockpit | flying through one shows its edge and its plane (the classic sprite fail) |
| far | invisible beyond the deal radius - a pocket two ridges off simply is not there |
| cost | +1 draw, 1 program; the cost is **fill**: every card is a transparent quad over trees, 420 of them stacked along the view - the overdraw that mobile GPUs pay most for (NVIDIA *Soft Particles*, GPU Gems 3 ch. 23); and a CPU deal over ~40k candidates every 20 frames |

### 3c. THE VEIL - the pockets inside the mist we already apply (`?fmist=c`, the cheapest "better")

The same `fmDens` integrated INSIDE `mistApply` (atmo.js MIST_GLSL, the one splice): 4 taps over the last 450 m before
each fragment (the pocket its trees stand in) + 2 over the first 350 m after the eye (the pocket the eye is in).

| | |
|---|---|
| look | the pocket washes the crowns and the ground inside it toward the mist's colour, a ridge behind it stands dark - **exactly the layering** - and a valley seen from above fills with white under a flat lid; **no volume against the sky** (a pocket in front of open sky is not drawn: there is no surface to carry it), and a pocket hanging half-way between the eye and a far ridge, in neither 450 m end, is missed |
| motion | the same drift, per pixel, no popping (no deal) |
| sorting | perfect by construction: every material carries it in its own shader - trees, impostors, stand cards, terrain, water, the aeroplane, the houses |
| night/moon | the mist colour follows the moon's light (LOOK-1-MOON) |
| cockpit | the eye's 350 m: you see out of a pocket you are in; the white-out is the F2/C4 slab's |
| far | everywhere a surface is (to 25 km): the far ridges get their pockets too |
| cost | 0 draws, 0 programs added (the same programs, longer), 0 passes, 1 atlas tap + 3 value noises x 6 taps per fogged fragment where the map is not zero. By F2's measured scale (6 samples of field + noise = +3.3 ms at the stand on the 3080) **budget <= 2 ms on the 3080 at 4+2 taps, <= 1 ms at 2 taps**: the phone takes 2 (Q3) |

### 3d. The others, considered

| technique | verdict |
|---|---|
| **A froxel volume** (Wronski AC4, Hillaire's Frostbite 2015 "unified volumetric rendering"; UE's Volumetric Fog) | the AAA answer, and the one FOG-MIST SS3f already declined: a 3-D texture of the frustum re-integrated every frame is the clouds' cost again for the whole screen, WebGL2 has no compute, and its cost is set by the volume's resolution (Epic). Not at this budget; not on a phone |
| **UE's exponential height fog with a second layer** | what F2 is, plus a second height: the POOL's flat lid is our version of it (the lid per valley from the map instead of one world altitude) |
| **A baked mist map** driving any of them | **taken**: it is section 3.0 - the one thing every renderer here shares |
| **Impostor wisps** (pre-rendered volumetric wisps on cards) | the cards' sorting and intersection faults with a better texture; the faults are what lose |

---

## 4. THE PROTOTYPE, IN PICTURES (SwiftShader, `potato`: the trees are its blobs; judge the mist, never the forest)

Rig: `tools/soft_still.js --page dev.html --gfx potato --q fmist=abc --stage tools/forest_mist/stage.js` - one boot, many
stills, the variants switched live (`FMIST.use`, `FMIST.S.force`, `FMIST.S.rho`). The eyes were scouted in node on
Jolene for layered, forested, sun-facing frames. Dawn of 20 September (07:15 AKDT, sun 6 deg at az 95) unless a plan
day is named. The user's target: `target_concept.webp` (a bush plane on a strip at sunrise, wisps lying mid-slope
between tree layers, backlit). Every sheet is in `reports/evidence/FOREST-MIST/` (`sNN_*`).

**THE PICK: `s08_PICK_run11.jpg`** (the user, 10 Nov: *"this image was looking best, the ones after that are sort of
worse"*): the veil, 110 m cells with a three-octave erosion to ~2 m, a 450 m window before each surface, the threshold
at 0.9 x the cover, the weather on both the amount and the density (0.003 /m at the heaviest, a quarter of it for the
last wisps), the pockets lit by the key's beam. Slope off / 1 / 0.66 / 0.33, the ridges at 1, and the season's Valley
fog (Aug 17, 06:30) with nothing forced.

### 4a. How the look was found - eleven sheets, eight steering notes

| sheet | what it showed | what changed |
|---|---|---|
| `v1` (run 2) | nothing visible | the CPU mirror found it: the octaves' sum sits at 0.5 +- 0.13 and the coverage remap left od ~0.02 in a full valley. Stretched before the remap |
| `s02_*` | **the layering appears**: a band at the far hill's foot behind the near tree line; mist along the far slope at crown height, a pool at the valley's mouth; a sea of fog under the ridges from above. Lavender-grey, on a flat layer that already milks the "off"; the cards blank | the pockets' own forward lobe; the flat layer gives its share to the pockets (redistribute, never add); the cards' deal photographed an empty deck - fixed |
| user | *"the distribution starts to be good, but it lacks detail in the shape and the contours, it needs to be further cut through, and probably set less dense overall"* | the bands' edges ride the noise, a ~20 m erosion, the threshold up, 0.03 -> 0.018 /m |
| `s03_backlit_slope` | **broken wisps lying mid-slope along the contours between the near firs and the far forest** - the target's structure; but paper cut-outs, clipped white | a wide body ramp, an eased erosion edge, a lower lobe |
| user | *"still too dense, too milky, not aerial enough. Lower the density a lot, try /2, /4, /8, /16"* | the ladder |
| `s04_ladder_*` | backlit: /2 solid strips, /4 translucent, /8 airy, /16 nearly gone; front-lit (the ridges) far fainter at every step | - |
| user | *"they all look right to me in different conditions. The /2 would be really heavy morning mist, the others dissipating after rain ... could we piggyback on the weather schedule and the climate"* | **section 5**: the season's plan and the day drive the strength; the ladder is the intensity |
| user | on the ridges: *"too faint ... you're further multiplied by the weather factor ... it's not a /2 we need, rather a x2"* | it was: the cover multiplied the density a second time (/6-/10 at "/2"); the pockets were lit by the layer's HORIZONTAL irradiance (x sin 6 deg). The double count removed, x2, the key's beam |
| `s05_x2_flat_saturated` | strong, glowing, but flat | - |
| user | *"now it's all too thick ... lost definition ... the density could vary through the cloud itself, less dense on the borders ... controlling both together is lacking"* | the gradient mechanism (the weather on the amount only, thin edges, thick cores) |
| user | *"the simpler option: divide by 2 and keep the mechanism where the weather controls both - compare"* | `s06_ab_gradient_vs_flat2`: the gradient's cores clip to white; **flat /2 translucent, aerial, fades with the weather** |
| user | *"new is better, chase more resolution; the finer ones are best, the dense ones look bad: halve again?"* | 0.003 /m, finer cells and a third erosion octave |
| `s07_sin_hash_blobs` | bigger, smoother banks - the opposite of finer | **the `fract(sin(x) * 43758)` hash breaks in fp32 at the finer noise's arguments** (real GPUs too); the pockets got their own sin-free hash (Hoskins), the lattice wrapped to 512 cells. `tools/forest_mist/glsltest.js` then proved the GPU density equal to the CPU mirror (4096 points on SwiftShader, 21 % vs 23 % in mist, mean diff 0.05), so the CPU mirror became the fast rig (`raycpu.js`: the veil per pixel in seconds) |
| **`s08_PICK_run11`** | **the pick** | - |
| `s09_wind_stretch_rejected`, `sweep.png`, `contour_sweep.png` | a 200 m window, 70 m cells, the wisps drawn out along the wind: finer, but they lean down the slope like rain (*"reads too vertical, and the valley is too light"*); then drawn out along the baked contour with altitude layers (*"in my references they're rather horizontal layers"*) | **both kept as dials, off** (`elong`, `strat`, the contour map baked beside the pocket map); both compile out at their off values |

### 4b. The renderers side by side

- **The veil (`c`)** is every sheet above.
- **The cards (`b`)**: in every sheet they were the weakest - nearly invisible until boosted, then puffs that cannot sit
  between tree layers (no depth to fade against: a hard line where a sheet meets a crown), invisible beyond their deal
  radius. Shot again on the pick in `s10_*` (section 4c).
- **The march (`a`)**: the clouds' pass on SwiftShader - section 4c.

### 4c. The last load on the pick (cockpit, from above, far, cards and march, the evening after the storm)

<!-- R14 -->

## 5. THE WEATHER: WHEN, WHERE, HOW MUCH - piggybacked on the season's plan and the climate (forest_mist.js `strengths`)

The user, 9 Nov, on the density ladder: *"maybe that should scale with the mist up to divided by 2, because above that
this is really too much. How is the mist controlled ... we have this rotating schedule of weather in the story, and
the holistic climate manager, so I would assume that fog spawns automatically ... could we piggyback on that ... scale
the intensity ... heavy mist, things like that. Because actually they all look right to me in different conditions.
The divided by 2 would be like really, really heavy morning mist. And the other ones could be just dissipating after
rain ... And the /2 has this advantage of having like very clear definition and cuts."*

**What already drives fog** (nothing new is invented, the pockets read it):
- **The season's plan** (WEATHER-SEASON, `07d_weather_plan.js` + `07c_weather_days.js`): three blocks of 14 crafted
  days (early 20 May-2 Jul, high 3 Jul-15 Aug, late 16 Aug-30 Sep), each with authored tracks over its 04:00-28:00
  weather day. **Fog is authored**: `fog.hold` with a `where` - Valley fog, Morning fog on the sound and Valley fog late
  summer are `where: low` (0.85-0.9 at 04:00, burnt off by 10-11), the Sea fog bank is `where: sea`. **Rain is
  authored** (the storms, the gales, the showers, the drizzle) and **SOIL_WET** turns it into the hours since rain.
  **Low cloud is authored** (stratus/stratocumulus decks at 0.85-0.97 on the drizzle and storm days).
- **The day** (`07_day.js`) derives from it: `rh`, `cloudBase = 125 (T - Td)`, `cloudCoverEff`, `mistBurn` (the
  lagged sun x the clear sky), `mistCalm` (3-10 kt), `fogHold`, `fogWhere`, `rain`.
- **The climate** (`09_climate.js`): the wind every consumer reads (`climate.sample`) - the pockets' drift - and the
  haze's column (LOOK-1).

**The law** (one strength 0..1 per kind; the scale is the GAME's screen humidity at the club, ~0.75-0.79 at dawn even on
a mist morning, so the thresholds sit there and not on the forest floor's):

| term | law (`sm` = smoothstep) | the plan's word |
|---|---|---|
| **POOL** (valley fog) | `sm(0.70, 0.90, rh) x (1 - mistBurn) x mistCalm x (1 - 0.7 sm(0.4, 0.9, cover))` - a calm, humid, CLEAR night; the lagged sun burns it | **`max(law, fogHold)`** when the day declares `where: low`; `0.35 x fogHold` for `where: sea` (the sea itself is the F2 layer's); the authored burn-off is the plan's |
| **WISP** (the wet forest steaming) | `sm(0.55, 0.80, rh) x wet x (1 - burn/2) x (0.4 + 0.6 calm)`, `wet = 0.6 while it rains, else exp(-hoursDry/8 h)`, none past 36 h | the plan's rain, through SOIL_WET |
| **ORO** (the cloud on the slopes) | `sm(0.45, 0.8, cover) x (1 - sm(600, 1000 m, cloudBase)) x (0.5 + 0.5 sm(0.75, 0.95, rh))` - the base IS the saturation | the plan's low deck and its dew |

**The intensity is the user's ladder**: the density at a full pocket's heart falls an octave per third of the strength,
from **0.009 /m (/2 - the heaviest morning: clear definition and cuts)** through /4 and /8 to **/16 (the last wisps)**,
and the cover takes it to nothing below that (`rhoOf`); a named level for a forecast or the weather panel: `heavy`
(>= 0.75), `mist` (>= 0.4), `wisps` (>= 0.1).

**The season, tabulated** (node, every crafted day at seven hours; the level's initial and its divisor, and the kind:
p pool, w wisp, o oro; `reports/evidence/FOREST-MIST/season_table.txt`):

```
                                5h      7h      9h      11h     14h     18h     21h    
early  1 cool-northwesterly       .       .       .       .       .       .       .    
early  2 calm-and-bright        W/8 p     .       .       .       .       .       .    
early  3 first-cumulus          W/11p     .       .       .       .       .       .    
early  4 warm-spell             W/7 p     .       .       .       .       .       .    
early  5 valley-fog             H/2 p   M/3 p   W/9 p     .       .       .       .    
early  6 thickening-sky         W/11p     .       .       .       .       .       .    
early  7 grey-and-mild          W/10o   M/6 o   W/8 o   W/11o     .     W/10o   M/6 o  
early  8 spring-gale            H/2 o   H/2 o   H/2 o   H/2 o   H/2 o   W/9 w   W/10w  
early  9 spring-showers         W/11w     .       .       .       .       .       .    
early 10 crisp-dawn             W/10w     .       .       .       .       .       .    
early 11 breezy-westerly          .       .       .       .       .       .       .    
early 12 june-cumulus           W/9 p     .       .       .       .       .       .    
early 13 long-light-evening     W/9 p     .       .       .       .       .       .    
early 14 midsummer-blue         W/9 p     .       .       .       .       .       .    
high  1 fair-cumulus            W/10p     .       .       .       .       .       .    
high  2 clear-high              W/10p     .       .       .       .       .       .    
high  3 morning-fog             H/2 p   H/3 p   M/5 p     .       .       .       .    
high  4 warm-hazy               W/9 p     .       .       .       .       .       .    
high  5 high-cloud              M/6 p     .       .       .       .       .       .    
high  6 overcast-calm           W/11o   M/6 o   M/7 o   W/8 o   W/10o   W/8 o   M/6 o  
high  7 the-storm               H/3 o   H/3 o   H/3 o   H/2 o   H/2 o   W/11w   W/10w  
high  8 showers-sunshine        W/10w     .       .       .       .       .       .    
high  9 crisp-clear             W/9 w     .       .       .       .       .       .    
high 10 ridge-day                 .       .       .       .       .       .       .    
high 11 thermal-day             W/10p     .       .       .       .       .       .    
high 12 sea-fog                 H/2 p   H/2 p   W/8 p   W/9 p     .       .     W/8 p  
high 13 golden-evening          W/10p     .       .       .       .       .       .    
high 14 light-southerly         W/10p     .       .       .       .       .       .    
late  1 late-summer-high        W/7 p     .       .       .       .       .       .    
late  2 valley-fog-autumn       H/2 p   H/2 p   M/4 p     .       .       .       .    
late  3 golden-september        W/8 p     .       .       .       .       .       .    
late  4 southerly-freshening    W/7 p     .       .       .       .       .       .    
late  5 first-autumn-storm      H/3 o   H/2 o   H/2 o   H/2 o   H/2 o   W/11w   M/7 w  
late  6 clearing-showers        W/10w     .       .       .       .       .       .    
late  7 aurora-night            W/10w   W/13w     .       .       .       .       .    
late  8 still-and-fair          W/7 p     .       .       .       .       .       .    
late  9 grey-drizzle            W/10p   M/5 o   M/5 o   M/5 o   M/5 o   M/5 o   M/4 o  
late 10 southwest-ridge         W/12w     .       .       .       .       .       .    
late 11 indian-summer           W/11p     .       .       .       .       .       .    
late 12 equinox-signs           W/8 p   W/12p     .       .       .       .       .    
late 13 equinox-gale            H/2 o   H/2 o   H/2 o   H/2 o   H/2 o   W/11w   W/8 w  
late 14 bright-behind-the-gale  W/12w     .       .       .       .       .       .    
```

Read: the three authored fog days are heavy at dawn and gone by 11 as written; the storms and gales put heavy cloud on
the slopes while the front passes and leave dissipating wisps in the evening; the drizzle hangs mist on the hills all
day; most calm clear dawns carry a thin breath in the hollows that is gone by 07:00; the windy days have none.

**WHERE** is the map (section 3.0), **HOW IT MOVES** is the wind: the noise's offset is the integral of
`climate.sample(eye, 40 m)` (as the F2 banks' is: a position integrated, never `wind x t`, CLIMATE K4), the map is
fixed - so a pocket's wisps stream downwind across it and fade where its weight does, and a pocket never leaves its
valley. A stronger wind does not blow the pool away down the valley: it **thins** it (the calm term), as the
inversion does.

Not in the prototype, proposed for the landing: the POOL's lid rises as it burns (the inversion eroded from below:
`+60 m x burn` - the "lifts into stratus" stage); a lake's steam fog at dusk (water warmer than the air: the game has no
water temperature - lakes keep the POOL's law); the forecast and the weather panel naming the level.

---

## 6. PERFORMANCE - NAMED, NOT HIDDEN

Counted on SwiftShader (the draws, the triangles and the programs of one whole frame, `renderer.info` over every pass;
**no millisecond from this box is a number**). The streamer keeps moving between stills (the impostors arrive), so a
+-5 draw and a +-0.3 % triangle swing between two stills of the same state is the floor.

| still (the pick, run 11) | draws | triangles | programs |
|---|---|---|---|
| slope off | 950 | 10.49 M | 455 |
| slope I100 | 954 | 10.52 M | 455 |
| slope I066 | 954 | 10.52 M | 455 |
| slope I033 | 956 | 10.54 M | 455 |
| ridges I100 | 1308 | 11.80 M | 455 |
| vf_slope weather | 936 | 10.49 M | 455 |

The veil adds **no draw and no program** (the slope's off 950 against on 954-956: the impostors still arriving between
stills - the same drift appears between two OFF stills of earlier sheets; programs flat at 455). The march and the cards
were counted in the earlier sheets: the cards +1 draw / +1 program, the march +0 (the clouds' pass).

| technique | draws | programs | passes | samplers | per-fragment work | CPU |
|---|---|---|---|---|---|---|
| **veil** (`c`) | **+0** | **+0** (every fogged program is longer, not new) | +0 | +0 (the atlas) | where the map is not zero: 6 x (1 atlas tap + 3 value noises, + 2 more for the erosion where the body is live) - the F2 `banks` order of cost (+3.3 ms at 6 samples on the 3080, measured), budget **<= 2 ms gamer, <= 1 ms laptop at 2 taps** | ~0 per frame (5 lanes written); the bake once (below) |
| **march** (`a`) | +0 in the main pass | +0 (the clouds' march, longer) | the cloud pass kept live on a clear dawn (it is 0.67 ms whole at cover 0.2 on the 3080) | +0 | 28 steps x (1 tap + 5 noises + 2 shadow taps) at half resolution; expected 0.3-1 ms by `CLOUDS.stats.gpuMs` | ~0 |
| **cards** (`b`) | **+1** | **+1** | +0 | +0 | **fill**: up to 420 alpha-blended quads, each 120-240 m, layered along the view - the cost mobile GPUs pay most for | a deal over ~40 k candidates every 20 frames (~1-2 ms on the main thread at each deal, unmeasured here) |
| the map | - | - | - | - | - | **885 ms on the page under SwiftShader's CPU, 630-780 ms in node**, once per world under the roll-out screen; 2 MB upload. To bake offline with the island (Q6) |

What A0's box must answer (the timed gate's A/B/A, section 7.5): the veil's ms at the stand and in the forest at gamer
(4+2 taps) and at laptop (2 taps); the march's `CLOUDS.stats.gpuMs` with pockets forced on against off; the cards' ms
for the record only.

---

## 7. THE GATE FOR THE LANDING (GATE FMIST, core tier, node; `tools/_fmist_check.js` is its first half)

Never a picture diff (FOG-MIST SS1f: two frames of the same state differ in half their pixels). What it asserts:

1. **Off is identical** - with the GRAPHICS row `forest mist: off` (and on every preset where it is off) the mist's
   GLSL and the clouds' march carry no pocket code, the lanes' array is 28 floats, no texture is uploaded, the atlas's
   columns [768, 1280) are never written, no mesh is added (the prototype's section 1, from the flag to the row).
2. **The map**: deterministic (bit-identical twice), finite, weights in [0, 1], the hollows hold the pool and the
   ridges do not, the open sea nearly free of it (section 3 of the check); its region does not overlap the clouds'
   tile or F2's field (a layout assertion beside GATE ATMO's).
3. **The law**: zero in dry air; the pool monotone in the burn and killed by the wind; the wisps monotone in the hours
   since rain; the oro band only under a low covered sky (section 4 of the check); and **the pockets redistribute the
   day's mist, they never add a blanket**: the island-mean pocket optical depth on a dry, clear afternoon is zero.
4. **The cost bound, by count** (GATE FRAMECOST's own rows, re-pinned once with the reason): VEIL - draws +0,
   programs +0, uniform bytes + 80 per program (the 5 new lanes), texture uploads +0 per frame; MARCH - draws +0 in
   the main pass, +0 programs (the march's program is the clouds'), the cloud pass live on a clear dawn named as the
   one new pass-frame. A rise past those fails.
5. **The ms** (A0's box, the timed gate): the stand and the forest eye at the gamer preset, pockets forced on (`pool 1,
   wisp 1`), A/B/A against off: **VEIL <= 2.0 ms at 4+2 taps; MARCH <= 1.0 ms by `CLOUDS.stats.gpuMs`; laptop (the
   phone's preset) VEIL at 2 taps <= 1.0 ms equivalent**; steady frames held at 33.3 ms p50 on every flown row. Past
   it, the taps come down before the look goes up.

---

## 8. QUESTIONS FOR THE USER (each with the default this session would take)

1. ~~Which renderer?~~ **ANSWERED (10 Nov): the veil**, the user's pick sheet; the march stays flag-only (a later
   ultra-only option if the box shows room).
2. ~~The cards?~~ **ANSWERED: not landed** (hard crown cuts, sprite planes from the cockpit, no far pockets, the
   phone's fill rate). Kept in the branch as the comparison.
3. **The phone**: Default: **the veil at 2 taps** (the surface's only) on `laptop`/`potato`, 4+2 on `current`/`gamer`/
   `ultra`; a GRAPHICS row `forest mist: off / veil / volume` (volume = veil + march), `off` on potato if the box
   says the 2 taps cost more than 1 ms there.
4. **The lake at dusk** (the concept art's lodge): steam fog needs the water warmer than the air, which the game does
   not model. Default: **lakes keep the POOL's law** (a calm humid evening fills them as the night comes); a water
   temperature is a separate chantier.
5. **How often?** With the plan (section 5's table): heavy on the three authored fog days and through the storms,
   mist on the drizzle day, a thin breath at dawn on most calm days (gone by 07:00), nothing on windy days. Default:
   **as tabulated**; the dawn breath can be taken out (`sm(0.70, 0.90)` -> `sm(0.76, 0.92)` leaves only the humid
   dawns) if it reads as too frequent; Overcast calm's light cloud on the ridges can be held off by its deck type.
6. **The bake**: Default: **offline with the island** (the island is data: 512^2 x 4 half floats = 2 MB, ~0.5 MB
   gzipped, read at boot instead of 0.6-0.8 s of CPU under the roll-out screen); a worker bake for the analytic world.
7. ~~Strength~~ **ANSWERED (10 Nov)**: 0.003 /m at the heaviest, the weather on the amount and the density; one
   dial left for the box's eye, `FMIST.S.rhoMax`.
8. **The presets' default** (new): ON for current / gamer / ultra once the box has timed it? Default: **yes, if
   the veil holds its budget** - a change to the frozen desktop presets, so the user's word, then A0's FRAMECOST ALLOW.

---

## 9. SOURCES

- Met Office, *Types of fog* - https://weather.metoffice.gov.uk/learn-about/weather/types-of-weather/fog/types-of-fog
- Wikipedia, *Fog* - https://en.wikipedia.org/wiki/Fog
- NASA Earth Observatory, valley fog (image 79700) - https://earthobservatory.nasa.gov/IOTD/view.php?id=79700
- Weather and Radar, *Valley fog formation* - https://weatherandradar.co.uk/weather-news/valley-fog-formation--8b47c31e-f0eb-4a5d-aa61-0f9646b5ed06
- AMS Glossary of Meteorology: *orographic fog* (https://glossary.ametsoc.org/wiki/orographic-fog/), *orographic cloud*
  (https://glossary.ametsoc.org/wiki/orographic-cloud/), *upslope fog*, *fog forest*
- Holder, C. D. 2003, fog precipitation in a Guatemalan cloud forest - https://uon.sdsu.edu/holder_fog_precipitation.pdf
- The Smokies' "smoke" and transpiration: NY Review of Books letter (1983) - https://www.nybooks.com/articles/1983/02/17/why-the-smokies-are-smoky-contd/ ;
  WSMV (Aug 2026) - https://www.wsmv.com/2026/08/24/why-do-smoky-mountains-look-smoky-it-comes-trees/ ; Our State -
  https://www.ourstate.com/the-science-behind-the-smoke-of-the-great-smoky-mountains-north-carolina/
- Hillaire, S. 2015, *Physically Based and Unified Volumetric Rendering in Frostbite*, SIGGRAPH Advances -
  https://www.ea.com/news/physically-based-unified-volumetric-rendering-in-frostbite
- Kovalovs, *Volumetric Effects of The Last of Us: Part Two* (SIGGRAPH) - https://history.siggraph.org/learning/volumetric-effects-of-the-last-of-us-part-two-by-kovalovs
- Epic, *Exponential Height Fog* and *Volumetric Fog* -
  https://dev.epicgames.com/documentation/en-us/unreal-engine/exponential-height-fog-in-unreal-engine ,
  https://docs.unrealengine.com/4.27/BuildingWorlds/FogEffects/VolumetricFog/
- NVIDIA 2007, *Soft Particles* - https://developer.download.nvidia.com/whitepapers/2007/SDK10/SoftParticles_hi.pdf ;
  GPU Gems 3 ch. 23, *High-Speed, Off-Screen Particles* - https://developer.nvidia.com/gpugems/GPUGems3/gpugems3_ch23.html
- Schneider, A. 2015/2017, the Nubis cloud talks (the coverage remap and the base-minus-detail erosion used here)
- This tree: `futureDesigns/FOG-MIST-2026-09-21.md` (F1-F3), `CLOUDS-2026-09-15.md`, `LOOK-1-STUDY-2026-11.md`,
  HANDOVER G503 / G506 / G510 / G650, L36a (look1-haze-soft)
