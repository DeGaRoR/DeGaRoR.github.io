# THE GRASS RULING — the four cover types costed per effective coverage (B3, 2026-09-20)

The user: "the bench has 3 grass models; I need the most performance-friendly one at
similar visual densities — find similar density profiles and grass sizes, screenshot,
I'll judge, but have all your metrics ready. And is this still the right approach?"
and, this session: "a performance benchmarking of the different grass types per
effective coverage, and tell me if there is a good candidate for being tinted by the
terrain itself".

Instrument: `node tools/grass_perf.js` (headless Chrome on the RTX 3080, the tree
bench, each type ALONE on the flat plane within 80 m of the eye, no trees). The axis
is **effective coverage** — the share of ground pixels the type hides from an eye —
because a density dial is not comparable across a 6-triangle plate and a 1157-triangle
reed patch. Two eyes over the same patch: **flight** (35 m up, 40° down — short final
over a meadow) and **low** (1.7 m, along the ground — taxiing). Cost = a GPU timer
query around 20 frames at 1920×1080, min of three. Record: `tools/perf/grass_perf.json`;
pictures: `screenshots/grass_perf/` (ignored).

## 1. The sweep

| type | file | tris/inst | material | k | instances | flight cov | flight ms | low cov | low ms |
|---|---|---|---|---|---|---|---|---|---|
| grass_dry (tussocks) | dry_grass.glb | 8 | 7 × BLEND 1024² | 2 / 4 / 8 / 16 | 20k / 40k / 80k / 161k | 13.5 / 24.2 / 40.1 / 57.8 % | 0.90 / 0.85 / 1.51 / 2.67 | 53 / 75 / 90 / 94 % | 0.62 / 1.17 / 1.75 / 3.02 |
| grass_reed (patches) | grass_patches.glb | 1157 | 3 × BLEND 1024² | 0.5 / 1 / 2 / 4 | 1.2k / 2.4k / 4.8k / 9.7k | 17.5 / 30.4 / 47.2 / 64.1 % | 0.63 / 0.83 / 1.87 / 3.69 | 46 / 57 / 83 / 92 % | 0.80 / 0.93 / 1.72 / 2.99 |
| grass_plates (crossed cards) | realtime_grass.glb | 6 | 6 × MASK 512×256 | 0.1 / 0.2 / 0.4 / 1 | 5k / 10k / 20k / 50k | 20.5 / 35.0 / 53.3 / 70.0 % | 0.44 / 0.60 / 0.60 / 2.00 | 48 / 70 / 88 / 97 % | 0.42 / 0.75 / 0.89 / 2.79 |
| grass_scan (photogrammetry) | simple_grass_chunks.glb | 37 | 1 × BLEND 1024² | 2 / 4 / 8 / 16 | 40k / 80k / 161k / 322k | 14.5 / 26.4 / 42.8 / 59.8 % | 2.00 / 3.61 / 3.70 / 10.95 | 53 / 70 / 86 / 94 % | 2.13 / 3.29 / 4.16 / 12.55 |

(k = the stand's `cover` multiplier over the type's own `density`: dry 0.5, reed 0.12,
plates 2.5, scan 1 per m².)

## 2. At matched coverage (interpolated over k)

| type | flight 30 % | flight 50 % | low 50 % | texels (mean HSL of the cutout) |
|---|---|---|---|---|
| **grass_plates** | **0.55 ms** (8 k inst) | **0.60 ms** (18 k) | 0.45 ms (5.5 k) | h 0.17 s 0.30 l 0.26 — dark yellow-green |
| grass_reed | 0.82 ms (2.4 k) | 2.12 ms (5.5 k) | 0.85 ms (1.6 k) | h 0.10 s 0.40 l 0.30 — golden, the most saturated |
| grass_dry | 1.08 ms (54 k) | 2.13 ms (122 k) | ~0.53 ms (16 k) | h 0.12 s 0.27 l 0.47 — pale straw, the least saturated |
| grass_scan | 3.63 ms (97 k) | 6.12 ms (222 k) | ~1.77 ms (32 k) | h 0.13 s 0.31 l 0.41 |

**The plates win by 2× at 30 % and 3.5× at 50 %** from the flight eye, and they are
the only MASK (alpha-test) type: the other three ship as BLEND — sorted transparency,
which refuses the depth prepass and is the wrong mode at density (the bench's own
note). Their cost is fill-rate, not triangles: the reed's 1157 tris an instance are
twelve million triangles at k 4 and still cheaper than the scan's 37-triangle clumps
at the same coverage, because the patch is one big cutout drawn once where the clump
is eighty thousand small ones overdrawing each other.

## 3. The terrain-tint candidate

"Tinted by the terrain itself" = the cover takes the ground's albedo at its foot
(per instance, `instanceColor` — the woodland already does this) so a meadow, a
muskeg and a dry slope grow the same geometry in their own colour, and no cover
texture has to be authored per biome.

- **grass_plates is the candidate.** One 512×256 cutout, MASK (no sort, alpha-to-
  coverage on the G144 buffer), 6 triangles, the cheapest per covered pixel, and a
  texture whose colour is a plain dark yellow-green (s 0.30) that a multiply moves
  where the ground is. Better still: turn its map into a LUMINANCE sheet (blade
  shape + shading, no colour) at bake time and let the terrain colour BE the
  colour — the plate then matches the splat under it by construction.
- grass_dry is the palest and least saturated texel set (l 0.47, s 0.27) — it takes
  a colour well — but it is BLEND, seven materials (seven draws per field) and needs
  5-7× the instances of the plates for the same coverage. Keep it as the muskeg's
  SEDGE ACCENT at low density (tufts one sees, not a cover).
- grass_reed: a hero patch by the water, never a cover (1157 tris, golden by nature).
- grass_scan: the look reference only, as VEGETATION-2026-09-15 said.

## 4. Is scattered geometry still the right approach?

Half. From the flight eye a 30 % cover over an 80 m patch is 0.55 ms; the game's eye
wants cover to ~150 m (3.5× the area, ~2 ms) and at 1.7 m taxiing it wants density.
The honest split is the one the LOD ladder already makes for trees:

1. **Far / from the air: the cover is a TEXTURE** — C1's splat library (grass, heath,
   muskeg types) carries the meadow past ~80 m for nothing; it is what the flight eye
   mostly sees anyway.
2. **Near: plates, terrain-tinted, thinning with distance** — planted within a reach
   that scales with the eye's height (80 m on the ground, less from the air), density
   fading to zero at the reach so there is no edge; the plates' colour from the splat's
   own albedo so the two tiers meet.
3. The tussocks and the reed as PLACED accents where the biome says (muskeg pools,
   shorelines), at the densities the mixes hold.

Owed for the game (B4): the plates as a `cover` layer in `render_world.js` (an
InstancedMesh ring around the eye, `instanceColor` from the ground colour bake,
MASK + A2C), the luminance map bake in `tree_prep.py`, and a `cover` row on the
GRAPHICS menu (reach / density). GATE WORLDRENDER extended with the ring's count.
