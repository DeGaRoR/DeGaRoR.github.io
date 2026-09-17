# VEGETATION — the second batch through the tree bench (2026-09-15)

The user: "we'll need to go back to the tree bench for integration of new
assets; deciduous trees and shrubs [one consistent pack]... a new Alaska biome
made of tortuous pine and waterlands [MUSKEG]: mostly dead straight sticks
with a couple of dead short branches, and tortuous pines... grass prototypes
as well, and we have to use them... another section of the bench, reusing
the spread mechanism, the lighting, the colouring options and the impostor
generation... The goal of the bench is to generate game-ready assets with
LODs and impostors, but before that do an asset selection, and a layer of
asset authoring and tests."

Three deliverables in that order: **SELECTION → AUTHORING + TESTS → BAKE**.
This document is the plan; `docs/TREE-IMPORT.md` stays the rulebook (§1
licence, §2 inventory, §3 as-is, §5 the ladder, §6 the bake, §7 the payload).

---

## 0. What is on the shelf (V0, done 2026-09-15)

`node tools/tree_inspect.js --print` walks TWO roots now — `assets/treesRaw`
(the W0a conifers) and `assets/vegetation/<kind>/` — and the bench rails by
folder. Every asset carries `file` (its path under assets/) and `folder`;
`_dismissed/` is skipped. A FIFTH kind, **cover**, joins tree / shrub /
billboard / terrain (grass, tufts, cards under ~1.2 m; a file under
`vegetation/grass` is cover by the user's own filing).

Three classification faults the new packs exposed, all "names lie":

- `CARD_MAT` matched `atlas` anywhere — every deciduous tree wears an
  `OakBranchAtlas` and fourteen real trees (one of 22 141 tris) went to the
  billboard rail. A card's atlas is not a branch's (lookbehind on branch /
  leaf / foliage).
- The part-merge (overlapping XZ + disjoint materials) fused NEIGHBOURS: the
  pack lays 30 trees on a grid tighter than their crowns, each in its own two
  materials. Oak "4 parts" was oak + apple + cherry. Two subjects that each
  already hold bark + foliage under one node are WHOLE and never merge; a lone
  part (Lampi's bark mesh beside its `stump → branch` node) still may.
- The merge keeps the SHORTER part name; `stump01_1` beat
  `bark04_0_bark04_0Mat_0`, and PROP's `stump` sent Lampi's whole pine to the
  terrain rail. Tree vocabulary in ANY part now outranks PROP.

The W0a packs' grouping is bit-identical to HEAD's after all three (checked
against `git show HEAD:…_trees_index.json`). GATE TREE / TREES pass; the
payload is untouched.

**Duplicates** are detected (binary SHA, or the same subject signatures under
another export) and shown dimmed with `=` in the rail:

| file | what it is |
|---|---|
| `pine/pine_tree (3).glb` | Georgeous "Pine tree", 14.3 m, 20 517 tris — byte-identical to `treesRaw/_dismissed/pine_tree_georgeous.glb` (tuned in W0a, proportion 0) |
| `pine/pine_tree (4).glb` | **identical bytes** to (3) |
| `pine/pine_tree (5).glb` | evolveduk "Pine Tree", 5.3 m, 5 627 tris — byte-identical to `treesRaw/_dismissed/pine_tree.glb` (dismissed "by the author's choice", W0a) |
| `pine/pine_tree (2).glb` | b4_cobra's re-upload of evolveduk's tree (same geometry, other bytes) — the attribution belongs to evolveduk |
| `pine/pine.glb` | Lampi "Pine" (Sosna), 10.9 m, 12 197 tris, bark + stump + MASK branches — **new**, the only genuinely new pine |

So the muskeg pine shelf holds THREE trees, not five. None of them is
tortuous: they are straight young pines. The tortuous shore pine is an
AUTHORING job (§2), not a download.

**The deciduous pack** (Dari, CC-BY-4.0, 38 MB, 35 images): 24 trees, 3
shrubs, 7 terrain pieces (boulders, logs). What it holds, at the scale it
ships:

| subject | h | tris | note |
|---|---|---|---|
| Birch1/2/3, BirchOrange1/2 | 16–22 m | 2.1–2.8 k | five birches, two in autumn |
| Maple, Oak, Ash | 14–20 m | 2.3–3.8 k | broadleaf, low count |
| Apple, Plum, Cherry | 10–13 m | 4.7–12.3 k | orchard trees (not wild Alaska) |
| PineTree, FirTree, NobleFir | 7.5–17.7 m | 6.6–8.7 k | the pack's own conifers (`BarkMat`/`BranchMat`, MASK) |
| **Coniferous Dead Tree / 2** | 16.2 / 9.8 m | 1 492 / 604 | **the muskeg's dead straight sticks** |
| **DeciduousDead1 / 2** | 14.3 / 13.5 m | 1 278 / 498 | dead broadleaf snags |
| DeciduousShrub / 2, HollyShrub, RaspberryShrub, ConiferousShrub | 4.5–14.8 m | 1.4–11.8 k | the shrubs — authored LARGE ("shrub2" is 14.8 m; raspberry 4.5 m) |
| Coniferous Sapling, DeciduousSapling / 2 | 3.4–4.6 m | 0.1–1.1 k | saplings |
| BoulderOutcrop ×4, Boulder ×2, logs ×2 | — | 0.3–7.7 k | terrain kind |

Every leaf material is BLEND (the bench converts to MASK at the collection's
`alpha`). One pack, one author, one light — the consistency the user chose it
for. Its sizes are NOT consistent (the shrubs), which is why §2 needs a
per-subject scale.

**The grass prototypes** — four shapes, and they answer different questions:

| file | shape | use |
|---|---|---|
| `dry_grass.glb` (Pixel-bit) | 7 clumps, 8–20 tris each, one BLEND map, 0.5–0.9 m, cm units with the scale node | **tussocks** — the muskeg's sedge, a card clump per instance |
| `grass_patches.glb` (DJMaesen) | 3 patches, 236–1 157 tris, 1.2 m — cm units WITHOUT the scale node (measures 120 m; the bench's scale hint brings it to a metre) | tall reeds / a wet-edge patch |
| `realtime_grass.glb` (mfhscoobydoo) | 2 013 nodes → 3 blade-card plates (6 tris, MASK) at two scales over a plane | **the dense fill** — the classic crossed-card grass; the 4.9 m "plates" are the scene's scaled copies, the 0.7–0.9 m ones the originals |
| `simple_grass_chunks.glb` (3dhdscan) | photogrammetry chunks: 52 k and 26 k tris WITH their ground, plus three 7–12-tri cards | a look reference; too heavy to scatter as-is (§3 rules out decimation) — the small `r12` cards are usable |

CREDITS.md carries all ten rows (`--credits=vegetation`).

## 1. SELECTION (the user's, on the bench)

What the bench must show for the ruling, and does:

- shelf per folder + kind (trees / shrubs / cover / billboards / terrain),
  the figure beside; ladder per subject; the forest with PICK.
- Open questions for the ruling:
  1. **Pines:** keep `pine.glb` (Lampi) + ONE Georgeous + ONE evolveduk;
     delete the byte-identical `(4)` and the re-upload `(2)`; rename the three
     to what they are (`pine_lampi.glb`, `pine_georgeous.glb`,
     `pine_evolveduk.glb`) — the media stems and tuning keys are the file
     names, and `pine_tree (5)` cannot be one. Georgeous' pine was tuned in
     W0a and parked; evolveduk's was dismissed — both are back on the user's
     say-so for the muskeg.
  2. **Deciduous:** which of the 24? The proposal: birches ×5, maple, oak,
     ash; the four dead; the pack's three conifers as mix; the orchard three
     OUT (not the biome); shrubs ×5 at a corrected size; saplings ×3.
  3. **Grass:** `realtime_grass`'s three plates as the fill, `dry_grass` as
     the tussock, `grass_patches` as the reed; `simple_grass_chunks` as
     reference only (its `r12` cards optional).
  4. **Biomes** as MIX PRESETS (§2.3): CONIFER (W0a, unchanged), MIXED
     (conifer + deciduous + shrubs + grass), MUSKEG (dead sticks + pines +
     tussocks over wet ground, sparse).

## 2. AUTHORING + TESTS (the new bench section) — BUILT 2026-09-15 (V1)

Status after the user's rulings (2026-09-15: pines kept as three files, the
pack's conifers dropped, one entry per species and per tree/shrub, the grass
as proposed, four mixes — conifer / muskeg / grassland / borders — and the
dead trees folded into their species' `dead` fraction): §2.1–2.3 are in
`tools/_trees.html`, documented in `docs/TREE-IMPORT.md` §4.1–4.4; §2.4's
gates are owed (the bake of §3 will carry them). Second pass (the user's eye): fruit trees + Lampi out; dead trees their
own `dead` kind (own bark/size, model → sheet) + the generated `dead_stick`;
bend at the base + `bendPct`; `leafScale` / `leafFill`. What the first stands
showed: the snag sheet at 224 texels draws a 16 m dead tree's twigs as texel
blocks between 60 and ~120 m (a resolution limit, not a bug — the same as
W0a's snags, whose branches were thicker); the impostor tier reads ~1.5x the
mesh on every family under the bench's rig (the fitter's 0.60–0.67), a tier
offset for `imp lit`, not a species number.

Not a fifth view: TWO additions to the views that exist, so the spread, the
rig, the tint hooks, the AO bake, the coverage mips and the G-buffer impostor
are reused as they are.

### 2.1 Per-subject authoring (`variants` view + the tuning)

The tuning is per COLLECTION today (`hue sat light bark alpha sink size
proportion dead stick impa implight`, `keepTop`). A pack of 24 needs
per-SUBJECT rows: `subjects: { "<name>": { size, sink, proportion, dead,
drop, ops } }` under the collection, defaulting to the collection's. `drop`
takes a subject out (the orchard) without touching the file — the `keepTop`
idea, by name.

The AUTHORING OPS, each a pure function on the built prototype (like
`cullFoliage`, `growCrown`, `stickFor` already are), applied in the tuning's
order and carried into the payload by `tree_prep.py`:

| op | what | for |
|---|---|---|
| `scale` | per-subject size (the shrubs) | the pack's inconsistent sizes |
| `bend` | the bole follows a seeded 2-D noise curve: a lateral offset by height, `amp` (m at the crown) + `freq` + `lean` (deg) — a lattice warp of every vertex by its height, foliage moving with the wood it hangs from | **the tortuous pine** — from Lampi's / Georgeous' straight one |
| `sparse` | keep a fraction of foliage cards, by a seeded per-card draw (`cullFoliage` keeps by height today) | the muskeg's starved crown; the stand series |
| `flatTop` | scale the crown's top `k` down toward a flat cap | shore pine's wind-cut crown |
| `strip` | dead (exists: `stripFoliage`), + `prune` a fraction of the remaining bark branches by island size | "a couple of dead short branches" |
| `tint` | per-subject hue/sat/light (exists per collection) | the two autumn birches |

The variants grid gets an `ops` cell per subject. The test: a subject with
ops is a NEW PROTOTYPE — its own AO bake, its own impostor signature (the ops
in the signature), its own ladder from `makeVariant`; GATE TREES decodes it
like any rung.

### 2.2 The UNDERSTORY layer (forest view)

A second scatter over the same ground, after the trees, with the same
`rng` / glades / edge / `spread` / `sink` / proportion draw:

- **shrubs** at `FOREST.under.density` (per 100 m²), rejected within `r` of
  a trunk, biased to the EDGE (a shrub is a light-gap plant: the same
  `edge` distance the series ladder reads, inverted); ladder = L0 → L1
  (`sparse` 0.5) → impostor at `IMP_TILE_HI` like a snag.
- **cover** at `FOREST.cover.density` (per m²), NEAR ONLY: drawn to
  `cover.reach` (60–120 m) with a dither fade over the last third, no
  impostor — beyond the reach the ground's own colour carries it (the game's
  forest-floor darkening, `uFloor`, already does this job for the canopy).
  Three placement rules by cover kind: `clump` (a card clump per instance,
  random yaw), `fill` (crossed-card plates on a jittered grid, the classic),
  `patch` (one per N m², on wet ground).
- **ground** for the muskeg: the forest view's `ground` gains a `wet` mode —
  the plane with a water colour under a `wetness` noise (pools), the
  planter rejecting trees inside a pool and cover preferring its edge. Not
  the game's water; a judging surface.
- Costs on the panel: instances, triangles, the frame — the same `tally()`.

### 2.3 MIX presets

`_trees_tuning.json` gains `mixes: { "<name>": { pick: [...], proportion
overrides, under, cover, ground, density, seed } }` and the forest panel a
selector; `export json` writes them. The three above are the first rows;
the game's `SPECIES_PREF` table is where a mix meets a place (§4).

### 2.4 Tests

- GATE TREES extends to the new series (shrub ladder, cover) and to
  authored prototypes (ops in the manifest, decoded rungs descend).
- A bench self-check (`_tree_check.js` or a sibling): every `mixes` row
  builds, every pick exists in the index, no subject row names a subject the
  inspector does not know (the pack's names carry `_NN` suffixes that a
  re-export would change).
- The impostor's parity measurement (§6 of the import doc, `implight`
  bisected against geometry) repeated for a shrub and a bent pine.

## 3. BAKE (game-ready)

`tree_prep.py` reads `subjects` and `ops`, emits the shrub series (`rungs`
+ `snag`, no `stand`), a `cover` series (L0 only + the placement rule),
and the mixes into `trees_pack.json`. The codec (`53_tree_codec.js`) is
unchanged: a rung is a rung. Media stems are file names — hence the renames.
Budget: the artefact is at 6.5 MiB with reason (W0c.29); the deciduous pack's
35 images (30 MB raw) will not fit as shipped — base colour at authored size
is the rule for cutouts, so the budget conversation is about WHICH subjects,
not about resizing (import as-is).

## 4. The game (after the bake)

- `render_world.js`: the understory planter beside the fill (same chunk
  walk, same `forestHere`), shrubs into the impostor ladder, cover into a
  near-only instanced layer with the reach fade; the muskeg by PLACE:
  `SPECIES_PREF` rows for the mix + a WET-FLAT predicate (`hydro.distW`,
  slope < 0.05, altitude band) that swaps the draw to the MUSKEG mix —
  Jolene (Annette Island) is muskeg over most of its lowland.
- F8 rows: understory density, cover reach, the mix at the eye.
- `tree_perf` re-baselined with the understory (the forest is 0.6 ms today;
  a near-only cover layer is fill-rate, so the AA tier decides).

## 5. Traps met on the way in

- The bench's rail listed only "tree sources": a grass pack was invisible.
- The tree shelf frames at 2.2 m columns / 14 m eye: a tuft is a speck.
  Cover has its own framing.
- `grass_patches` ships in cm with NO unit node (120 m grass); the scale
  hint is per folder kind now (cover is judged against a metre, not 22 m).
- Python heredocs in this shell strip backslashes — patch scripts go in a
  file.
