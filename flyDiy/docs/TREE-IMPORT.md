# IMPORTING A TREE

How a tree gets from a download into the stand, and the rules that keep the
next one consistent with the last. Written after W0a, from the six collections
that went through it.

The bench is `tools/_trees.html` (port 8358, `.claude/launch.json` entry
`flydiy-trees`). The inspector is `tools/tree_inspect.js`. The payload the game
will read is baked by `tools/tree_prep.py` — see §7 and §8.

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

## 6. The impostor bake, and the six things that will bite

All six were met and fixed in W0a. They are listed because each one presents
as "the impostor is missing / wrong" and none of them looks like its cause.

0. **BAKE A G-BUFFER, NOT A PHOTOGRAPH.** This is the one that matters and the
   one that was got wrong first. A sheet of final shaded RGB is 64 pictures of
   the tree taken under one sun: nothing can re-light a picture, so the far band
   does not answer to sunset, to night, to a moved light or to a shadow, and
   beside geometry that does it reads as cardboard. The atlas holds **albedo +
   opacity** in one sheet and the tree's **world normal** in a second, baked in
   the same loop over the same 64 camera bases so the two agree texel for texel;
   the billboard is then an ordinary `MeshStandardMaterial` whose `normal` comes
   out of the second sheet, and sun, hemisphere, environment and shadow map all
   reach it through the code path they reach the geometry through. This is what
   Epic's octahedral impostor baker writes and why SpeedTree ships a normal map
   beside every billboard diffuse. Two consequences worth writing down:
   - the **AO** has to go into the albedo, because there is no third channel for
     it — but the geometry SPLITS its occlusion (full exponent on the ambient,
     0.35 of it on the sun), and one albedo cannot. The sheet takes the middle,
     `pow(ao, aoBake * 0.5)`; with the full exponent the far band measured 0.82x
     the geometry's brightness.
   - the bake signature gets SHORTER, not longer. Sky, exposure and the leaf
     terms no longer reach the sheet, so they must stop invalidating it — a
     change of light used to cost fifteen rebakes. What does reach it now (and
     did not before) is the AO dial.
   - **the sheet is written in the TARGET's encoding, not the renderer's.**
     r128 picks it as `null !== target ? target.texture.encoding :
     renderer.outputEncoding`, and a `WebGLRenderTarget`'s texture is
     `LinearEncoding` by default. So an albedo pass under `outputEncoding =
     sRGBEncoding` lands LINEAR, and a draw that decodes it as sRGB is a flat
     2.2x too dark over the whole far band — which is exactly what the first
     G-buffer build shipped. Set `rt.texture.encoding = THREE.sRGBEncoding` on
     the albedo target, and keep sRGB rather than dropping the decode: eight
     bits of LINEAR is the wrong container for foliage, where an albedo near
     0.03–0.15 is eight to thirty-eight levels. The NORMAL target stays linear.

   Two dials come out of this and neither is a fudge. **`imp lit`** is the
   tier's own gain on everything the lights put in — and it must scale all FOUR
   reflected terms, because at roughness 1 the physical model's multiscatter
   term rides on the sky irradiance rather than on the albedo and measured 39.7
   of the band's 55.6 luminance; scaling only the diffuse left a floor that ate
   the dial. **`imp round`** blends the baked normal toward a hemisphere built
   from the quad's own uv; measured at MATCHED brightness it LOSES relief
   (sd 22.4 at 0 against 20.7 at 1, the geometry's being 26.4), so the default
   is 0 — the sheet's normals carry real per-card variation and smoothing them
   is a loss, whatever one expects of leaf cards. With the albedo right, every
   family's `implight` gamma goes back to 1.0 and ONE tier gain of 0.6 holds the
   far band within 7 % of the geometry across five skies.

   And a snag is not a crown. The alpha curve is centred on 0.40, which is right
   for a leaf texel only one of three views carries; a bare trunk's branch is
   one texel wide and arrives at 0.2–0.3 along its whole length, so it survives
   in places and is discarded in others and the branch comes and goes every few
   pixels. The snag series gets its own centre (0.10).

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
Refit it after ANY change to what the sheet holds — a trim fitted against an
older sheet is not a smaller error, it is a wrong number that looks like a tuned
one. That said, the better outcome is not needing it: under a correct G-buffer
the impostor's albedo IS the tree's albedo, and once the sheet's ENCODING was
right (§6 trap 0) every family came back to `implight` 1.0 with one global tier
gain carrying the difference. A big per-family spread is a smell — the first
refit produced 0.42 to 1.85 and every one of those numbers was compensating for
the same 2.2x encoding bug.

## 7. Bake it (W0b)

    python tools/tree_prep.py            # the collections _trees_tuning.json includes
    python tools/tree_prep.py --report   # inventory only, writes nothing
    node   tools/_tree_check.js          # GATE TREES

Writes `media/geo/trees/<collection>.<h8>.bin` (one binary per collection),
`media/tex/trees/*` (the maps) and `src/core/trees_pack.json` (the manifest).
Decoded by `src/core/53_tree_codec.js`, pure JS, no three.js.

**Geometry.** Positions int16 over the subject's box, normals int8, uvs uint16
over the part's own range, indices uint16 (uint32 where a subject passes 65 536
verts, which a tree does and a prop never did) — plus **one AO byte per
vertex**, with a foot-to-crown gradient on bark.

Every rung of a subject quantises over ONE box, and that box is the **union of
all of them**: a coarser rung is not a subset of the finest, and LOD1 overflowed
the int16 when the finest rung's box was used alone.

**Maps.** Base colour at the resolution the author shipped — a leaf map's ALPHA
IS THE TREE, and resizing a cutout thins its coverage. Normals at half. Metal /
roughness dropped: two collections ship none and the two that do ship a palette
or a bilevel image. Cutout maps are PNG because JPEG cannot carry alpha at all.

**The dials are not baked in.** `size`, `proportion`, `sink`, `dead` and the
colour corrections ride in the manifest as data, so a world editor moves them
without a re-bake.

**One thing the renderer still owes.** Every cutout material carries
`coverageMips: true` and its own `cutoff`. The viewer must build
coverage-preserving mips for those maps at load, or the canopy thins with every
level and the stand dissolves at distance — exactly as it did in the bench
before §6.5. The flag is in the manifest because only the material knows the
threshold the coverage has to be preserved against.

## 8. What is NOT done here

`render_world.js` still draws a cone and an icosahedron: the payload exists, and
nothing reads it yet. That is W0c, and it is now unblocked. The impostor tier
needs no new art — `bakeImpostorAtlas` already bakes from whatever near geometry
it is handed, which is the whole reason this payload ships no atlas.

Also outstanding: the larch impostor is thinner than its geometry (0.47x the
covered pixels, and the gain saturates — that one wants tile resolution), and
the stand's LOD rungs are assigned at build time rather than per frame, which
is fine for a bench and not for flight. See `futureDesigns/WORLD-V2.md` §8.3 and
the W0c–W0e rows of the staging plan.
