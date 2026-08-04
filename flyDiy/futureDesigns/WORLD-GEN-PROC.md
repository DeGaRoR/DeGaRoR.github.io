# WORLD-GEN-PROC — procedural world pipeline

Status: **draft for the world session**. Companion to WORLD-CONTRACT.md
(this document fills the contract's interior). Fully procedural, seed-driven,
no imported assets. ⚙ tunable · ⏳ deferred · stage order is dependency order.

## Architecture: bake + analytic compose

Stages 1–4 run **once at `makeWorld(seed)`** on coarse grids and emit compact
data (polylines, records, small fields). The continuous `terrainH` never reads
a stored heightmap; it composes:

```
terrainH(x,z) = base(x,z)                          // stage 0, analytic
              + Σ SDF modifiers (riverbed carve, lake fill, runway/road
                  grading, cliff sharpening)       // stages 1,3,4 data
```

— the same mechanism as today's meadow blend and runway carve, generalized.
This keeps physics/render identity, C¹ continuity, and the hot-path budget.

⚙ Init-time budget: ≤ 1.5 s on desktop for the full bake. If exceeded:
lower grid resolutions first, seed-cache payload second ⏳.
⚙ Domain: **24 × 24 km since W6 (2026-08-04)** — bounds ±12000, hydrology
512² (46.9 m cells, thresholds/widths normalized to physical drainage
area so the same rivers emerge at any resolution), tree grid ±12000,
settlement cap 9. Total bake ~0.55 s. The domain growth was the
proceduralness test: every stage re-ran on the new bounds unmodified
except grid parameters. Stage-0 shape additions, all EXACTLY zero inside
the home box + 1.5 km (x∈[−6300,600], z∈[−3300,2600] — covers every
validated circuit incl. the DC-3 turnback): mountain belt falls off
beyond z≈−6500 into northern highlands/plains, archipelago (gated
z>3800) in the far sea, ±65 m long-wave continental relief (5.2 km
noise). Meadow hash and all four anchors survived the growth unchanged.
Renderer: two-ring mesh (17.6 m polys over ±4500, ~100 m strips beyond,
tucked 2 m under the inner rim), per-ring baked colour maps, clouds
spread. STILL OPEN from the stage-0 sketch: domain WARPING + the extra
octave (the landform character pass) — that is its own session and a
conscious re-golden.

## Stage 0 — Base field (analytic)

Layered value-noise fBm with **domain warping** (IQ-style: warp coordinates
by a second fBm before sampling — this alone kills most of the "2000 look"
in the landform), a continental mask (sea to +z), a mountain belt with
ridged noise (−z), mid-ground hills. Current `h0` is the degenerate case;
keep its structure, add the warp and one octave.
Gate: range/percentile envelope of sampled heights; determinism.

## Stage 1 — HYDROLOGY (keystone) — DONE 2026-08-03

Implemented in `src/core/21_world_hydro.js` (`bakeHydrology(sample, cfg)`,
pure, exported for gates) on the CURRENT 9 km terrain per the session plan.
As-built (all ⚙ in the cfg literal in 20_world.js): grid 384² over ±4500
(23.4 m cells), A₀ 500 cells, w = min(45, 0.35·√acc), d = 0.4·ln(1+acc),
bank feather 1.4w smoothstep (C¹), lake threshold 1.5 m, lake bed clamp
spill −2 m (bilinear soft edge), DP ε 25 m, numeric-key segment grid 96 m
for allocation-free O(1) hot-path queries (terrainH measured 0.27 µs/call
WITH the carve — 4× under the contract budget). Bake ~120 ms (budget 1.5 s).
Seed-0 yield: 63 reaches / 24 km, 62 lakes. Trees re-laid (water rejection
added); WORLD goldens re-captured same-commit per procedure — meadow hash
and all 4 anchors unchanged.
Deviations from the sketch below, deliberate:
- **Drainage domes**: the bake sample adds +3 m bake-only domes over the
  runway pad and meadows so rivers route AROUND aerodromes; river water
  surfaces are dome-corrected back (wsAdjust). Stage 4's parameterized
  grading replaces this.
- The carve applies BEFORE the meadow blend and is masked to zero on the
  runway pad (padRamp) — pad stays exactly 0, meadow cores exactly flat.
- Sea is gated by the PRE-carve base sign: an inland riverbed carved below
  sea level is a dry trench, not sea.
- Termination classes: sea | lake | boundary (domain edge = outlet) |
  junction (confluence with an earlier-traced river).
- Water surface per vertex = filled height (already non-increasing along
  D8-on-filled flow), monotone-clamped after dome correction.
- Flats drain toward the earliest-flooded equal neighbour (priority-flood
  pop order) — deterministic, no iteration-order dependence; D8 ties break
  by hash-rotated neighbour scan.
- M2 quirk surfaced: that meadow has sat at −47.9 m in the sea basin since
  v0 — waterH now honestly reports sea over it; relocate/regrade at stage 4.
GATE HYDRO (appended): termination legality, per-reach ws monotonicity,
beds below water at unmasked centreline vertices, bank transect slope
< 1.0 (measured 0.40), wet fraction envelope, pad/meadow-core dryness,
full-hydrology same-seed determinism, A₀ sweep monotone (651≥421≥228
river cells at A₀ 125/250/500), bake budget.

Original sketch (grid ⚙ 384² over the domain, heights from stage 0):

1. **Depression filling** — priority-flood (Barnes 2014: flood inward from
   the boundary with a priority queue; cells raised to their spill level).
   Filled-vs-original difference > ⚙ 1.5 m marks **lake** cells; each lake
   records its spill height → `waterH`.
2. **Flow routing** — D8 directions on the filled surface; break ties
   deterministically (hash of cell index, not iteration order).
3. **Accumulation** — topological order; `acc(cell)` = 1 + upstream sum.
4. **River extraction** — trace cells with `acc > ⚙ A₀` downstream; simplify
   to polylines (Douglas-Peucker ⚙ 25 m); width `w ~ k·√acc`, depth
   `d ~ k'·log acc`; segment into reaches at lake entries/exits.
   Store per-tile for `W.tile()`.
5. **Carve modifiers** — riverbed: SDF along polylines, parabolic section,
   depth d, banks smoothstepped over 2–3 w; lakes: clamp terrain below spill
   − d_lake inside the lake polygon (soft edge). Water surface: reach-wise
   monotone interpolation of the filled heights (rivers must *look* like they
   descend); lakes flat at spill height.
6. **Sea**: waterH = 0 beyond the coast mask; estuaries where rivers cross it.

Gates (all on data):
- every traced river terminates in a lake or the sea (no dangling reaches);
- water surface monotone non-increasing downstream, ≤ terrain everywhere
  except carved beds;
- carve continuity: max |∇terrainH| across bank transitions bounded;
- determinism across two instances; A₀ sweep sanity (river count monotone).

## Stage 2 — Climate → biomes → forests — DONE 2026-08-03

Implemented in `src/core/22_world_biomes.js` (`makeBiomes(deps)`, analytic
recombination — no stored map) + a distance-to-water chamfer transform
added to the stage-1 bake (`distW`, bilinear, metres). As-built:
- `W.surface`: WATER · SAND (h<2.5, distW<70 — coast + estuary bars) ·
  ROCK (h>220 | slope>0.75 | h>treeline·slope>0.38) · SCREE (h>100,
  slope>0.45) · FOREST_FLOOR (forestness>0.48 below treeline 165) · GRASS.
  forestness = 0.55·stand(210 m noise) + 0.30·moisture + 0.15·altitude
  preference; moisture = fBm + water proximity. ~1 µs/call (not hot-path).
- Trees: deterministic jittered 64 m grid over ±4224, order-independent
  per point (replaced the v0 sequential LCG loop); keep-probability per
  biome (stand 0.85 / open 0.25 / riparian 0.85 / field 0.05 / alpine
  scrub ≤0.12·s×0.62); v0 exclusions kept verbatim (corridor, meadows
  0.8r, water, pad via h<2). Records gained `sp` (0 spruce · 1 pine ·
  2 oak · 3 birch · 4 willow), clustered by the stand noise. Seed-0:
  2336 trees, mix 9/16/37/28/10 %, close-pair same-species 43 %
  (random ≈ 29 %), riparian density 5.2× the grass background.
- Renderer consumption: species silhouettes (pine narrow/tall, birch
  slight, willow low/wide) + per-species colour ramps; neighbour clumps
  inherit the stand species (85 %); ground tint from surface class
  (forest-floor loam / sand / scree) in the colour bake.
- GATE BIOME: distribution envelope, classifier semantics, tree/surface
  consistency, diversity + clustering, riparian ratio > 2.5, exclusions,
  determinism, perf. TREES golden re-captured; GRID/MEADOWS/anchors
  identical — stage 2 is placement-only, terrain untouched.

Original sketch — inputs: height, slope (analytic ∇ of stage 0+1),
distance-to-water (coarse distance transform of stage 1 water cells), a
moisture fBm.

Biome = f(altitude, slope, moisture): meadow, mixed broadleaf, conifer,
alpine scrub, rock/scree above ⚙ treeline with slope cutoff, riparian strip
along rivers, sand at coast. Emit as the `W.surface` classifier (analytic
recombination, not a stored map) + per-tile tree placement: density and
**species mix per biome** (sp field → renderer picks silhouette/color;
"diverse forests" = 4–6 species, clustered by a species-scale noise so
stands read as stands, not confetti). Poisson-ish placement via jittered
grid per tile (deterministic per tile, replaces the global rejection loop).
Gate: no trees in water/paved/scree, density within envelope per biome,
riparian strips actually hug rivers.

## Stage 3 — Settlements & roads — DONE 2026-08-04

Implemented in `src/core/23_world_settle.js` (`bakeSettlements(deps)`,
consuming the stage-1 grids now exposed on the bake's `grids` field).
As-built:
- **Sites**: scored on a 2× decimated stage-1 grid (flat + near-water +
  low + confluence knots + coast), greedy min spacing 2.5 km, capped at
  6 incl. the fixed `Home Field` hamlet by the airfield (index 0 — the
  road network GROWS from the airfield). Towns are excluded from the
  circuit band (|z|<400, x∈(−3400,400)) and meadow surrounds; procedural
  syllable names; pop from score → r. Seed-0: 5 settlements.
- **Roads**: organic growth — each new settlement connects via Dijkstra
  to the NEAREST POINT of the existing network (multi-source seeding), so
  trunks are shared; k extra links ⚙ = 0 for now. Cost = dist·(1+8·slope²),
  water ×6 (⚙ — was 14, which dodged every river and produced zero
  bridges), pad zone ×60, meadows ×8. The decimated water mask ORs the
  full 2×2 fine block — 1-cell river lines must not leave sneak-through
  gaps (found the hard way). Wet cell runs become `bridge` pieces (2 pts);
  dry runs DP-simplify (ε 30) into `road`/`track` by pop.
- **Grading**: flat roadbed core 4.5 m half-width feathered to 12 m,
  toward a 3-tap-smoothed along-profile, delta clamped ±4 m, never on
  bridges; masked by padRamp and faded by the meadow blend weight —
  pad stays exactly 0, meadow centres exact. Residual cross-height at
  4 m ≈ 1.8 m max where the ±4 m clamp bites on steep hillsides.
- **Buildings**: two rows along the local road tangent per settlement
  (26 m pitch, jittered), rejecting water/road/out-of-radius; {x,z,w,l,
  hgt,rot,kind house|barn}. Seed-0: 76.
- **Surface**: `GRAVEL` is live within 3.5 m of a road centreline.
  Trees keep 12 m off roads and out of settlement cores (r·0.75).
- Renderer: dirt-band tint in the colour bake, instanced house/barn
  bodies + prism roofs, wooden bridge decks.
- HONEST CUT: buildings have no physics collision (trees do) — flying
  through a house is possible; revisit if it ever matters.
- GATE SETTLE: sanity/spacing/dry sites, geometric road-graph
  connectivity incl. every settlement, bridges on water, cross-slope
  bound, pad clearance, buildings sane + tiled, tree clearance,
  determinism, bake budget (~80 ms).

Original sketch:
- **Site scoring** on the stage-1 grid: flat + near water + low altitude +
  river confluence bonus + coast bonus; greedy pick with min spacing ⚙ 2.5 km;
  size (pop) from score. Buildings: per-tile procedural footprints inside
  the settlement radius (grid-with-jitter along local road tangents).
- **Roads**: least-cost paths between settlement pairs (MST + ⚙ k extra
  links) on the coarse grid; cost = distance · (1 + ⚙ 8·slope²) + water
  penalty; river crossings become explicit `bridge` segments at the narrowest
  local reach. Roads add a shallow grading SDF (flatten across, not along).
- Gate: road graph connected; every bridge lies on a river crossing; road
  max cross-slope bounded; settlements don't overlap water.

## Stage 4 — Aerodromes (the point of the exercise)

- **Main field** per settlement above ⚙ pop threshold: search near town for
  the best strip site — score = flatness along candidate heading (sample
  centerline ±, penalize carve volume) + clearance; length/width/surface by
  town size (paved ≥ ⚙ 900 m, else grass).
- **Backcountry strips**: independent search in high terrain — local
  benches/saddles with slope < ⚙ 4 %, 250–450 m, grass/gravel; today's
  meadows are the degenerate case (kind: meadow keeps the v0 shim honest).
- Each aerodrome emits a grading SDF (today's runway carve, parameterized),
  tree exclusion, `PAVED`/`GRAVEL` surface patch, and a registry record with
  heading + touchdown zone for the AP.
- Gate: per aerodrome — centerline slope profile < threshold, no trees in
  the box, reachable (≤ ⚙ 40 % grade on some line to the road graph or
  explicitly flagged fly-in only, which is the charm of backcountry strips).

## Stage 5 — Relief detail & cliffs (analytic, no bake)

Cliffs are a *classifier + sharpening*, not placed objects: where stage-0+1
slope exceeds ⚙ tan 50°, sharpen (terrace/step the height locally with a
strata-warped noise) and classify ROCK; scree fans (SCREE) below via a short
downslope falloff. Renderer gets strata banding for free from the surface
class + slope. Gate: classifier consistency (ROCK ⇒ slope above threshold),
continuity budget maintained.

## Explicitly out of scope here

- Renderer upgrade (chunked LOD, triplanar splat materials, water shader,
  tree impostors) — separate proc, consumes this data, decided later.
- Real-data seeding ⏳: OurAirports (public domain, tiny) could later pin
  real strip names/locations onto procedural terrain. Geometry stays
  procedural; steal statistics, not maps.
- Seasons, weather, day/night — contract-compatible later additions.

## Session plan (proposed)

1. ~~Extract world + v0 shim; battery green (WORLD-CONTRACT §5).~~ **DONE
   2026-08-03**: in-place reshape of `src/core/20_world.js` (no separate
   world_core.js — it was already its own build part), v1 contract + shim,
   GATE WORLD golden-freeze, battery byte-identical. v1-minimal interiors
   this pipeline replaces: `waterH` = sea-only (`terrainH<0 ? 0 : −Inf`) →
   stage 1; `surface` = WATER/ROCK(≥220)/GRASS → stages 2/5. Seed enters as
   `SALT = imul(seed, 0x9E3779B9)` into hash2 + tree-LCG; the stage-0
   rework MUST either preserve the seed-0 world or consciously re-capture
   the GATE WORLD goldens (snippet in WORLD-CONTRACT §4).
2. ~~Stage 1 on the *current* terrain, gates first.~~ **DONE 2026-08-03**
   (same session pattern: gates first, then tuning — see stage 1 as-built
   notes above). Rivers are LIVE in world data, and since the W3 water
   session (same day) rendered too: ribbons (Chaikin + width taper,
   creeks < 12 m dry) + lake cell surfaces with shallow-rim expansion
   (render-only), terrain mesh at 513². Contour-traced lake outlines and
   the animated water shader stay with the renderer overhaul.
3. Stage 0 rework (warp + domain growth) once hydrology gates hold.
4. Stages 2 → 4 in order; stage 5 opportunistic.
5. Renderer session only after the data exists to feed it.
