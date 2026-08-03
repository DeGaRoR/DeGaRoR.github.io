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
⚙ Domain: 24 × 24 km (current is ~9 × 9), sea along +z as today.

## Stage 0 — Base field (analytic)

Layered value-noise fBm with **domain warping** (IQ-style: warp coordinates
by a second fBm before sampling — this alone kills most of the "2000 look"
in the landform), a continental mask (sea to +z), a mountain belt with
ridged noise (−z), mid-ground hills. Current `h0` is the degenerate case;
keep its structure, add the warp and one octave.
Gate: range/percentile envelope of sampled heights; determinism.

## Stage 1 — HYDROLOGY (keystone)

Everything downstream (biomes, towns, roads, strips) consumes this stage.

Grid: ⚙ 384² over the domain (~62 m cells), heights from stage 0.

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

## Stage 2 — Climate → biomes → forests

Inputs: height, slope (analytic ∇ of stage 0+1), distance-to-water
(coarse distance transform of stage 1 water cells), a moisture fBm.

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

## Stage 3 — Settlements & roads

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
2. Stage 1 on the *current* terrain, gates first — rivers on the existing
   9 km world prove the pipeline before the domain grows.
3. Stage 0 rework (warp + domain growth) once hydrology gates hold.
4. Stages 2 → 4 in order; stage 5 opportunistic.
5. Renderer session only after the data exists to feed it.
