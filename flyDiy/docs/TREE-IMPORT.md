# IMPORTING A TREE

How a tree gets from a download into the stand, and the rules that keep the
next one consistent with the last. Written after W0a, from the six collections
that went through it.

The bench is `tools/_trees.html` (port 8358, `.claude/launch.json` entry
`flydiy-trees`). The inspector is `tools/tree_inspect.js`. Nothing here touches
the game yet — see §7.

---

## 1. Licence first, before anything is looked at

`tree_inspect.js` reads the licence out of each file's `asset.extras` and
classifies it. A collection whose licence forbids redistribution is **dismissed
and deleted**, not parked — the standing ruling from the first pass, applied to
the SKETCHFAB Standard files.

`CREDITS.md` is **regenerated from `asset.extras`**, never transcribed by hand.
A CC-BY row goes in when the collection is chosen, not at the end. Poly Haven is
CC0 and still gets a provenance row.

## 2. Inventory before import

    node tools/tree_inspect.js            # -> tools/_trees_index.json
    node tools/tree_inspect.js --print    # and the per-group table

The inspector decides *what a file contains*; the bench only draws. It reports
per collection: subjects, triangles per subject, textures and their resolution,
alpha mode and cutoff, licence. Four kinds only: **tree, shrub, billboard,
terrain**.

Three traps it exists to handle, all met in practice:

- **A pack is not a scene.** One download held 944 nodes and 546 meshes that
  were ten geometries copied. Subjects are found by geometry signature, not by
  name.
- **Names lie.** Grouping by mesh name split trunks from their own foliage.
  Subjects come from the NODE GRAPH; parts merge by overlapping XZ box, guarded
  by *disjoint material sets* — a trunk and its foliage never share a material,
  two whole trees always do.
- **Regexes must be segment-anchored.** `Back*ground*_Tree_Atlas` matched
  `ground` and put 13 billboard cards in the terrain bucket.

Nothing is imported until that table exists.

## 3. Import as-is

Never decimate or re-encode an import. Several packs ship their own LOD chain —
use theirs. The triangle budget is a **selection** criterion, not permission to
decimate a scan. Every rung below LOD0 is *generated* by the bench (§5), from
the asset as shipped.

## 4. Curate in the bench, then tune

Open the bench, walk the shelf, decide what is in the mix. Then, per collection,
in the right-hand rail:

| dial | what it is |
|---|---|
| `hue` `sat` `light` `bark` | colour, **measured then corrected** — `suggest` brings every collection to the reference's measured hue/lightness; taste rides on top |
| `alpha` | the leaf cutout threshold. Packs sit on completely different alpha scales — cedar's leaves at 0.63, larch's at 0.08 — and this is the dial that says so |
| `sink` | how far the model is pushed into the ground to bury roots it was authored with |
| `size` `proportion` | its scale, and its **share of the forest** |
| `dead` | the fraction planted as standing snags |
| `stick` | the generated stem's base radius, as a fraction of the crown's footprint |
| `impa` `implight` | the impostor's alpha gain and its light trim (§6) |

`export json` → `tools/_trees_tuning.json`, committed. The bench reads it at
boot; localStorage holds the working copy on top. **The committed file must
carry the values actually fitted** — a stale one means a fresh browser sees a
different tree from the one that was signed off.

## 5. The ladder every collection gets

Generated, not authored. The woody decomposition measured it: branch structure
is more than half a tree and reads as almost nothing past the first rung.

| | L0 | L1 | L2 | L3 |
|---|---|---|---|---|
| **specimen** (clearing edge, furnished to the ground) | full mesh | stick + foliage | stick + half foliage | impostor |
| **stand** (top third only, stretched and widened) | full mesh | stick + crown | stick + half crown | impostor |
| **snag** | full mesh | impostor | impostor | impostor |

A snag has no ladder: thinning branches off a bare trunk gives a worse bare
trunk, not a cheaper one, so it goes straight to an impostor — baked at a finer
tile (`IMP_TILE_HI`) because it stands in from L1.

Which series an instance gets is **how far it stands from an edge** — the rim of
the stand, or the lip of a procedural glade — with a `furnished` fraction mixed
through the interior, because a stand where every inside tree is a bare pole
reads empty at density.

## 6. The impostor bake, and the five things that will bite

All five were met and fixed in W0a. They are listed because each one presents
as "the impostor is missing / wrong" and none of them looks like its cause.

1. **Cache the SIGNATURE, not the name.** An atlas keyed on the tree's name
   outlives every fix made after it. Measured: cached max alpha 0 over 0 texels
   where a fresh bake of the same tree gave 255 over 215 184.
2. **Wait for texture decode.** `imageTex` sets `tex.image` in `onload`; a bake
   that runs first writes a tree-shaped RGB with no alpha at all.
3. **The tile rect lives on the RENDER TARGET.** `renderer.setViewport` is
   overwritten by any pass that re-binds a target — the shadow map does, once —
   and every tile after it draws at 8× magnification, clipped to its tile.
4. **The cutout threshold is per collection.** A flat floor is an absolute
   number over packs on different alpha scales: at 0.15 the larch lost its whole
   canopy (1–3 % tile coverage against cedar's 15–24 %). The bake must take the
   same step the screen's sharpen takes, at the collection's own cutoff.
5. **Coverage-preserving mipmaps for the sheet**, per tile — the 64 views are
   not equally dense. Without them the larch held 32 % of its canopy at a
   16-texel tile where the preserved chain held 111 %.

Then: the silhouette is the **union** of the three blended views, not their
average (three binary masks averaged put a texel carried by one view at a third,
which the alpha test throws away); and the light trim is a **gamma**, not a
multiply, so lifting dark foliage does not blow a pale trunk white.

Fit `implight` by measuring the impostor against its own geometry at the same
camera and **bisecting** — the Newton step oscillates. All six land within 2 %.

## 7. What is NOT done here

The bench is a bench. `render_world.js` still draws a cone and an icosahedron.
Nothing in `tools/_trees.html` is wired into the game, no asset has been baked
into `media/`, and `tools/tree_prep.py` does not exist yet. See
`futureDesigns/WORLD-V2.md` §8.3 and the W0b–W0e rows of the staging plan.
