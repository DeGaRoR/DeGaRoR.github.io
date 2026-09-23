# THE GRASS PORT CONTRACT — what the game owes the bench (2026-09-23, landed 2026-09-24)

The user, after three sessions of the game's grass getting worse: *"The bench had biomes with
satisfying grass settings, why reinventing? The grassland was good I think."* and *"We will
consider the mission over ONLY when we will have the same species, the same geometry, the same
density and the same shading in game ... modulated by the ground color, using the same methods
exactly as the bench."* Then narrowed to one species: the bench with **only `grass_reed`**, on
its exact panel (hue 0, sat .15, light 3, alpha .30, size .012, density .24, proportion .40,
patch 0, patchShare .35, vary .03, lift .29, contrast .35, noTint 0, aspect 0).

**Why this document exists.** `tools/_trees.html` does not load `src/viewer/trees.js` or
`src/viewer/cover_ring.js`. The bench and the game are two implementations of the same picture,
and nothing wrote down where they are allowed to differ. Every dial fitted on one was shipped to
the other, and the drift was invisible because both were judged by eye, separately. That is the
regression, not any one commit.

---

## 1. What ships (the user's rulings)

- **Reed is the only grass, in every biome that had grass** — conifer, deciduous, muskeg,
  grassland, borders, conifer_young, conifer_steep, conifer_scrub, village, city_trees. The user:
  *"replace the grass within the biomes. They can all feature reed grass, but no other grass"*,
  and *"keep the pines, the debris and the bushes"*. `grass_plates`, `grass_dry` and `grass_scan`
  stay in the pack, planted nowhere; the user: *"we may reintroduce plates at some point"*.
- **One reed row everywhere:** `{ proportion 0.4, density 0.48, patch 0, size 0.75 }` — *"twice
  the count in game today, and 75 % size"*. The bench's panel density is .24; the doubling is the
  user's, judged on the in-game picture.
- **Fireweed back in grassland**, in beds (`density 0.12, patch 9, size 0.85`), not tinted by the
  ground, a little taller than the reed, the beds *"a little less regular"* than the bench's discs.
- **The biome map is unchanged** (terrain code 2 heath -> `grassland`, and so on).

## 2. Where the game diverged from the bench, and what the port did

### 2.1 The ground-tint units — 9 to 10x  (PORTED)

The bench (`GROUND_MEANS`, `_trees.html`) measures a ground set by drawing it to a canvas and
averaging the **bytes**, then stores that through `new THREE.Color(r/255, g/255, b/255)`, which
reads its arguments in the **working (linear)** space. So the number a tuft is multiplied by is
the texture's **sRGB mean used as if it were linear**. Not colour-managed — and the number every
cover dial in the payload was fitted against.

`cover_ring.js` instead read `means.json`, which holds the **true linear** means, and applied the
splat's hand grade and G485's normalisation to the imagery on top:

| set | bench | game (before) | game was |
|---|---|---|---|
| `dry` | 0.581, 0.533, 0.383 | 0.3005 x 0.19 = 0.057 | **10.2x darker** |
| `grass` | 0.378, 0.426, 0.190 | 0.1190 x 0.37 = 0.044 | **8.6x darker** |

With the same `lift` that landed a tuft's `instanceColor` at **(0.005, 0.008, 0.003)** — dumped
live from the running game — an albedo of ~0.006 where grass is 0.10-0.20: *"no shading, no
texture beyond a mask"*. It is also why an A/B of `contrast` and `sat` moved nothing: both are
upstream of a multiply by zero.

**Now:** `meanOf` = `srgbEncode(linear mean)`, no grade, no imagery normalisation. It reproduces
the bench's `GROUND_MEANS` to within 1 % (dry 0.584 vs 0.581, grass 0.380 vs 0.378), so no
second table ships.

### 2.2 The master dials — 1.87x  (PORTED)

`trees.js` sets `MASTER = { hue: 0.045, sat: 1.2, light: 0.6 }`, and its own comment says the
number is the **conifer canopy's** fit to the imagery. The cover inherited it: `uLight = 3 x 0.6
= 1.8` where the bench renders `3 x 1.12 = 3.36`.

**Now:** cover materials take `COVER_MASTER = { sat 1.58, light 1.12 }` (the bench's committed
`master` in `_trees_tuning.json`); the trees keep the game's.

### 2.3 The normal override — half the tufts black  (PORTED)

The game hooked every cover and flower material with `LEAF.upHook` (G484's `UP_VS`), forcing the
**object** normal up on a `DoubleSide` material; three's `normal_fragment_begin` then flips it
to (0,-1,0) on every back face. Half the tufts went dark, by where the camera stood. The bench
has no override. **Now:** no hook on cover or flowers; the mesh's own normals.

### 2.4 Baked AO on the cover  (PORTED)

The bench forces a cover's `aoV` to 1 at load. `tree_prep.py` never learnt that, so `grass_reed`
ships 0.565..1.0, which at `uAoBake 4` is 0.10 of the ambient at its darkest vertices. **Now:**
`aoV` filled with 1 on every cover geometry the ring builds.

### 2.5 The density multiplier  (PORTED; the global dial kept)

The bench multiplies a cover's density by the mix's `forest.cover`; the game skipped it. **Now:**
honoured (it is 1 on every shipped mix, so nothing moves today). The ring's global `density 2`
(G484) stays — the user's density ruling was taken with it in place.

### 2.6 The beds and the flowers' size  (FIXED)

- The game thresholded one octave of value noise at `1 - bedFrac`. Bilinear value noise has thin
  tails, so the beds realised **7 %** of fireweed's intended area and **14 %** of foam's and
  bunchberry's — fireweed was never seen. **Now:** the bench's structure (one bed per square of
  side `patch x sqrt(pi/share)`, centre jittered, radius `patch` x its own 0.7-1.3 scale), each
  bed an oval of its own axis and stretch with weak low harmonics and a noisy, soft rim; realises
  the intended share within a few %.
- `flowerCards` was built at `size` **and** instanced at `size`: fireweed stood 1.7 x 1.7 = 2.75 m,
  bunchberry 0.19 m against the bench's 0.43. **Now:** built at unit height, sized once.
- Side effect, intended: foam and bunchberry under the forests now reach their full bed area and
  bench height — they were at a seventh of it.

### 2.7 The light rig — NOT ported (the user's ruling)

The bench: ACES, no hemisphere fill, sun #ffdca8 at ~34 deg. The game: Cineon, hemisphere 2.16
(#9bbefb), sun #fff3e0 at 46 deg; exposure 0.92 in both. The albedo path now agrees; the rest of
the difference (the game's reed reads paler) is the rig's, and the user chose *"Leave the rig,
accept the difference"*.

## 3. What was NOT wrong, so nobody re-tests it

- **The tuning.** Species, mix rows, per-species dials and the falloff (`keepAt(r)` vs
  `FADE_VS`, near 50 · reach 220 · taper 0.5) were already identical.
- **Density realisation** (outside beds). `grass_dry` planted 590 642 against a nominal 548 864.
  An earlier "48x short" on `grass_plates` was measuring in muskeg, where plates were not in the mix.
- **The geometry.** The reed is the shipped `grass_patches` mesh, as the bench draws it.

## 4. Open

- **Fireweed from above.** Beside a bed it fills ~4 % of the frame; from 30 m, ~0.03 % — a vertical
  card is edge-on to a high eye. Candidates: a top-facing card in the flower, or a ground tint
  under the beds. Not decided.

## 5. The reference pictures (local, `screenshots/` is gitignored)

In the grass worktree: `screenshots/grass_bench/grassland.png` (the bench, forest mode),
`screenshots/grass/reed_s1_h.png` (the first in-game reed the user accepted as the right species),
`BIOMES_LOW.png` / `BIOMES_30M.png` (every biome at the shipped density and size),
`FIREWEED.png`, `BEDS_MAP.png` (the game's beds beside the bench's discs at the same share),
`RIG_VS_BENCH.png`, `MASTER_AB.png`.

## 6. The standing rule this leaves

**A cover dial fitted on the bench may not be shipped to the game until the two agree on the
quantities the dial multiplies.** `lift` multiplies a ground mean; the two implementations
disagreed about what a ground mean *is* by a factor of ten, and the dial carried the error
across. Either port the bench's cover path into the viewer so there is one implementation, or
keep this table current.
