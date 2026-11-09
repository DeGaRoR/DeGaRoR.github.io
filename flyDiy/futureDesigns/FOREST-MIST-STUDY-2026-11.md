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


## 0. THE ANSWER FIRST

- **What the concept art shows is three different mists**, and each has its own place and its own clock (section 1):
  the valley POOL (radiation fog: drains into hollows on a clear calm night, a flat top, burns off two hours after
  the sun), the forest WISP (wet crowns steaming after rain, strongest when the first sun warms them, gone after half a
  day dry) and the cloud base resting on the slopes (OROGRAPHIC: a low, near-saturated deck where it meets the hill).
  What they share is the thing that makes the art read: **they sit IN the forest, at a height tied to the ground**, so
  each ridge stands out of the mist that fills the valley in front of it.
- **The game already has the valley half of this, built and shipped**: FOG-MIST F2 (G503, Sept) gives the ground mist
  a top that follows the valley floors and drifting banks (`mist: land` on gamer, `banks` on ultra). It is a fog on
  surfaces at 94 m texels with a 900 m bank noise - a soft blanket, not pockets; it has no forest term and no rain
  term; and on a fresh profile it is off whenever the air is under 70 % (`mistRho0`), which is most of the playable
  day. That is why the concept art's pockets are not in the game (section 2a).
- **One baked map + the weather's law + two renderers** is the recommendation (sections 3, 5):
  - the **POCKET MAP** (512^2 over the island, into the atmosphere atlas's free columns: no new sampler) says WHERE
    mist can sit - valley floors under a lid, wet forest in hollows, the cloud base's band on the slopes - and the
    **weather** (humidity, the lagged sun, the wind's calm, the hours since rain, the cover and the base) says WHEN and
    HOW MUCH. The noise drifts on the wind while the map stays put: **the wisps stream through a pocket and dissolve at
    its edge - it moves with the wind and stays stuck in the valley**, which is the user's ask exactly;
  - **THE VEIL (`?fmist=c`)** - the pockets as a second term inside the mist every fogged material already applies:
    no draw, no pass, no sampler, every tier including the phone;
  - **THE MARCH (`?fmist=a`)** - the same density marched inside the clouds' pass (the user's first idea): lit, with
    volume against the sky and parallax, composited through the clouds' depth-aware upsample. Gamer and ultra only,
    because the clouds' pass is off on laptop/potato/retro (the phone is `laptop`).
  - **THE CARDS (`?fmist=b`, the user's second idea)** were built too and are **not recommended**: section 4 shows why.
- Prototype pictures: section 4. Performance: section 6 (counts here, the box's GPU numbers owed to A0). Questions,
  each with a default: section 8.

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
`0.018 x d x cov` (~220 m visibility inside a full pocket).

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
| cost | 0 draws, 0 programs added (the same programs, longer), 0 passes, 1 atlas tap + 3 value noises x 6 taps per fogged fragment where the map is not zero. By F2's measured scale (6 samples of field + noise = +3.3 ms at the stand on the 3080) **budget +2-3 ms on the 3080 at 6 taps, ~+1 ms at 2 taps**: the phone takes 2 (Q3) |

### 3d. The others, considered

| technique | verdict |
|---|---|
| **A froxel volume** (Wronski AC4, Hillaire's Frostbite 2015 "unified volumetric rendering"; UE's Volumetric Fog) | the AAA answer, and the one FOG-MIST SS3f already declined: a 3-D texture of the frustum re-integrated every frame is the clouds' cost again for the whole screen, WebGL2 has no compute, and its cost is set by the volume's resolution (Epic). Not at this budget; not on a phone |
| **UE's exponential height fog with a second layer** | what F2 is, plus a second height: the POOL's flat lid is our version of it (the lid per valley from the map instead of one world altitude) |
| **A baked mist map** driving any of them | **taken**: it is section 3.0 - the one thing every renderer here shares |
| **Impostor wisps** (pre-rendered volumetric wisps on cards) | the cards' sorting and intersection faults with a better texture; the faults are what lose |

---

<!-- RESULTS FOLLOW -->
<!-- 4 and 6 -->

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

1. **Which renderer?** Default: **the VEIL on every preset + the MARCH on gamer and ultra** (one map, one law).
   Alternatives: the veil alone everywhere (cheapest, no volume against the sky); the march alone (no phone mist).
2. **The cards?** Default: **not landed** (section 4: hard crown cuts, sprite planes from the cockpit, no far
   pockets, fill-rate on the phone). Kept in the branch as the comparison.
3. **The phone**: Default: **the veil at 2 taps** (the surface's only) on `laptop`/`potato`, 4+2 on `current`/`gamer`/
   `ultra`; a GRAPHICS row `forest mist: off / veil / volume` (volume = veil + march), `off` on potato if the box
   says the 2 taps cost more than 1 ms there.
4. **The lake at dusk** (the concept art's lodge): steam fog needs the water warmer than the air, which the game does
   not model. Default: **lakes keep the POOL's law** (a calm humid evening fills them as the night comes); a water
   temperature is a separate chantier.
5. **How often should the player see pockets?** The law makes them a MORNING and AFTER-RAIN thing (radiation fog
   burns off by mid-morning; wisps last hours after rain). Default: **the law as written** (they are an event, which
   is what makes them beautiful); a career/promo day can pin them (`FMIST.S.force`), and the weather plans already
   bring rain.
6. **The bake**: Default: **offline with the island** (the island is data: 512^2 x 4 half floats = 2 MB, ~0.5 MB
   gzipped, read at boot instead of 0.6-0.8 s of CPU under the roll-out screen); a worker bake for the analytic world.
7. **Strength**: the prototype's pocket is ~220 m visibility at its heart. Default: that; the user's eye on the box
   sheet decides (one dial, `FMIST.S.rho`).

---


## 5. THE WEATHER: WHEN AND WHERE (forest_mist.js `strengths`, held by `tools/_fmist_check.js` section 4)

Three strengths, 0..1 each, from the day the game already computes - no new state, nothing saved:

| term | law (`sm` = smoothstep) | what it does in a day |
|---|---|---|
| **POOL** | `sm(0.80, 0.97, rh) x (1 - mistBurn) x mistCalm` | builds through a humid calm night, deepest at dawn, **burns off as the lagged sun warms the ground** (mid-morning in September at 55 N), held all day under an overcast (the burn is 0 there), torn away by 3-10 kt of wind |
| **WISP** | `sm(0.72, 0.92, rh) x wet x (1 - burn/2) x (0.4 + 0.6 calm)`, `wet = 0.6 while it rains, else exp(-hoursDry / 5 h)` | **after rain**: the crowns steam, most when the first sun reaches them (the burn takes only half), a fifth left 8 h later, gone after a day dry (`SOIL_WET.hoursDry`) |
| **ORO** | `sm(0.86, 0.99, rh) x sm(0.35, 0.75, cover) x (1 - sm(700, 1100 m, cloudBase))` | a near-saturated, covered day whose base is under Jolene's summits: the band where the base meets the slopes. The wind does not take it |

**WHERE** is the map (section 3.0), **HOW IT MOVES** is the wind: the noise's offset is the integral of
`climate.sample(eye, 40 m)` (as the F2 banks' is: a position integrated, never `wind x t`, CLIMATE K4), the map is
fixed - so a pocket's wisps stream downwind across it and fade where its weight does, and a pocket never leaves its
valley. A stronger wind does not blow the pool away down the valley: it **thins** it (the calm term), which is what
the inversion does.

Not in the prototype, proposed for the landing (Q5): the POOL's lid rises and thins as it burns (the inversion
eroded from below: lift the lid by `+60 m x burn` while the strength falls - the "lifts into stratus" stage); a lake's
steam fog at dusk (cold air over warm water: `rh` and the water's own temperature, which the game does not model yet -
default: lakes keep the POOL's law); `fogWhere` (the plan's named advection fog) read here too.

---


