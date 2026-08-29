# PROP IMPORT — procedure

How a downloaded object becomes a hangar prop. Sister document to
`MODEL-IMPORT-PROC.md`, which covers AEROPLANES; the two pipelines are
deliberately separate and share nothing but the philosophy.

    tools/props_table.py     the declared table — the only authority
    assets/props/<src>/      the delivered asset, byte-for-byte, never edited
    tools/prop_prep.py       the baker
    src/props/props_<g>.js   the payload, one pack per editor group
    src/core/51_prop_codec.js the decoder (pure JS: browser and node)
    src/viewer/props.js      the ONE material factory + propMesh/propPlace
    tools/_prop_check.js     GATE PROPS — the baked payload vs the table
    tools/_props.html        the prop bench: shelf view, one view, facts

## THE TWO RULES

1. **Geometry is imported as-is.** No decimation, no welding, no clipping of
   "unseen" faces, and the author's own normals and uvs go into the payload.
   Payload size is a loading-screen problem, not a licence to degrade the
   asset. The only geometry transforms are the rigid ones a table row declares:
   `scale` (an export delivered in millimetres), `rot` (a quarter turn to stand
   something on the game's axis), and the origin move that `place` implies.
   Where one file holds several objects, `mats` selects WHOLE primitives into
   separate props — selection, never cutting.
2. **Textures are re-encoded, on purpose.** This is the one place the prop
   pipeline differs from the aeroplane one, and it is a user decision for this
   batch: 1k maps become 512 (256 under half a metre), a channel that turns out
   to be constant folds to a scalar, and an identity normal map is dropped. The
   delivered maps stay at full resolution in `assets/props/`, so the quality
   comes back by raising `tex` and re-running the baker.

## THE ONE MATERIAL

Every prop lands on the same MeshStandardMaterial recipe, so the viewer has one
factory and no per-asset branches:

| slot | space | content |
|---|---|---|
| `map` | sRGB | base colour, plus alpha where the author used it |
| `arm` | linear | **R** ambient occlusion, **G** roughness, **B** metalness |
| `nor` | linear | tangent-space normal, OpenGL convention |
| `emisMap` | sRGB | emissive, only where there is one (the pendant lamp) |

One image drives `aoMap`, `roughnessMap` and `metalnessMap`: three samplers,
one upload, one cache entry. That packing is Poly Haven's own "arm" convention
and it is what makes the recipe uniform.

**Occlusion is only read where the author declares it.** Two authors declare it
two ways: Poly Haven names the file `..._arm_...`, and the Sketchfab exports
point `occlusionTexture` at the same image as `metallicRoughnessTexture`, which
is the same statement in glTF's own words. Anything else has nothing in R, and
reading it as occlusion is how a prop ends up mysteriously dirty — so AO is
switched off rather than guessed at.

**aoMap reads uv2, always.** `propBuild` aliases `uv2` onto `uv` at build time.
A prop that skips this renders black under an ao map, with no error.

**The spec-gloss alpha trap.** Glossiness lives in the
`specularGlossinessTexture`'s ALPHA — and `PIL.convert('RGBA')` on a texture
that has no alpha synthesises 255, which inverts to roughness 0: a mirror. The
alpha is only believed when it is real (`mode in RGBA/LA/PA` and a minimum
below 255); otherwise the material's own `glossinessFactor` is used and no map
is written. Two backstops behind that: the baker clamps roughness under 0.04
with no map to 0.4 and logs it, and GATE PROPS fails on the same condition
(glass exempt — it is transparent and meant to be sharp). Nothing in this
library is a perfect mirror.

**Spec-gloss is converted, not supported.** `KHR_materials_pbrSpecularGlossiness`
(older Sketchfab exports) becomes the same recipe at bake time: diffuse to base
colour, `1 - glossiness` into the arm map's G. The viewer never sees it.

**Transmissive glass becomes a transparent standard material.** r128's
MeshStandardMaterial has no transmission and a gauge cover is two hundred
triangles; at hangar distance the difference is not visible and the cost is a
whole second material model.

## ADDING A PROP

1. Download it. Put the delivered files, unmodified, in
   `assets/props/<slug>/` — the folder name is the slug, the files keep their
   delivered names. Add a `SOURCES` entry in `tools/props_table.py` with the
   title, author, licence and url.
2. Look at it before deciding anything:
   `python tools/prop_prep.py --report` prints the whole table's inventory
   without writing; a new row appears there with its real dimensions, triangle
   count and per-map sizes, which is what the keep-or-discard call is made on.
3. Add the row to `PROPS`. Pick:
   - `key` — stable forever; a saved hangar layout will reference it.
   - `place` — `floor`/`surface` re-origin the prop (footprint centred,
     underside on y=0). `wall`/`ceiling`/`mount` keep the delivered origin,
     because for those the origin IS the mount point.
   - `scale`/`rot` — only if the delivered file is in the wrong units or on
     the wrong axis. Check the report's dimensions; a crate that comes out
     1009 m wide is millimetres.
   - `tex` — 512, or 256 under half a metre.
4. `python tools/prop_prep.py` (the whole table: a partial bake would rewrite a
   group pack with only part of it in, and the baker refuses).
5. `node tools/build.js && node tools/_prop_check.js` — GATE PROPS reads the
   declared table out of the python source and asserts the BAKED payload
   against it. It is the G48 lesson applied: an assertion that reads the object
   the code just wrote proves nothing.
6. Look at it again, in the bench: serve the repo root and open
   `/flyDiy/tools/_props.html`. SHELF catches a wrong scale, a wrong origin or
   a texture that did not survive; ONE shows the facts and the map chips.

## TRAPS THIS PIPELINE HAS ALREADY PAID FOR

- **glTF uv origin is top-left**, so prop textures are created with
  `flipY = false`, exactly as GLTFLoader does. A texture built the ordinary way
  is upside down and looks merely "wrong" rather than flipped.
- **Node scales are not always uniform.** Normals go through the inverse
  transpose of the upper 3×3, not the point matrix; the point matrix gives a
  surface that is subtly and unfixably mis-lit.
- **An author's emissive strength is a bloom number.** The pendant lamp asks
  for 25×. This renderer has no bloom, so the baker clamps to 3× — clearly a
  lit bulb, not a white disc.
- **Wall and ceiling props hang BELOW their origin**, which is the point of
  those origins. Anything that shows them on a floor has to lift them; the bake
  must not, or the hangar loses the mount point.
- **Texture decode is asynchronous**, and an untextured PBR material under a
  reflection probe is a mirror. Never judge a prop from a frame taken in the
  first second (the W18b trap, `MODEL-IMPORT-PROC.md` says the same).

## PLACING THEM IN THE HANGAR

`src/viewer/hangar.js` places props through one bridge:

    prop(key, x, z, ry, y)      -> the group, or null if the library is absent

It ASKS whether the library is there rather than assuming, exactly as the room
asks THREE whether it can be built at all, so a build without the packs still
stands — it is just an emptier shed. Two rules that placement sites live by:

- **Heights are measured, never guessed.** A prop that something else stands on
  gets its surface height read off its own decoded geometry (upward-facing
  triangle area, binned by height), not eyeballed. The measured set as of G51:
  bench 0.96, desk 0.78, table 0.68, cart_tool 0.90, cart_storage 1.28,
  crate 0.41, drum 0.90, and `rack_steel`'s shelves at 0.44 / 0.92 / 1.42 /
  1.90. A mug three centimetres above a bench top is the one mistake that makes
  a whole room look wrong.
- **A flat prop needs clearance.** `rug_persian` was baked with its underside on
  y = 0, and so is the floor slab: two coplanar double-sided faces are a
  z-fight, not a rug. It is placed 4 mm up.

The moods reach props through `propSetEnv`, not through hangar.js's `ENV0` map —
that captured only the materials that existed when it ran.

**The mobile kit follows the aeroplane.** Everything else in the room is nailed
to a wall, because that is what makes the middle of the floor read as the
aeroplane's. `hangar.placeMobile(bb)` takes the aeroplane's footprint in the
room's own frame and puts six props on a 1.15 m clearance ring outside it,
clamped to `HW - 2.2` so they never leave the shed; `applyEnv` calls it with a
`Box3.setFromObject(craft)` every time, which is the one door every way into
the room goes through. `hangar.mobile()` returns where they landed and
`hangar.mobileShow(on)` hides them — the editor offers both.

Verify it with the NUMBERS, not a screenshot of one aeroplane: at spans 6 / 10 /
17 the starboard group must sit at exactly half-span + 1.15, and the port group
at the mirror of it. That check is what caught `lim(v, m)` being handed a
negative limit, which put half the kit against the far wall on the wrong side —
invisible in any single view.

**The shed is a parameter.** `genHangarBuild(THREE, {HW, HD, EAVE})` builds a
different room; the editor's hangar section has sliders and `GARAGE_ENV.setDims`
drives them. A new size is a NEW ROOM — half of it is derived from the numbers —
so `disposeHangar()` tears the old one down first, and it must skip anything
marked `userData.sharedGeo`: the prop library caches one geometry and one
material per prop, so disposing a prop mesh's geometry takes out every future
instance of that prop too.

**Work in progress comes out of the generator, not the library.**
`src/viewer/workshop.js` runs the same `buildGen` → `genSkin` pipeline the flying
aeroplane comes out of, on canned specs, and shows the result in part: a wing
panel on trestles, a welded tube fuselage, a wooden hull on its own wheels. That
way the generator's improvements reach the half-built aeroplanes for free. Two
traps it paid for:

- `computeBoundingBox()` reads the **position attribute**, not the index. Cutting
  a piece by writing a shorter index over the original arrays leaves it
  reporting the whole aeroplane's box, and everything that grounds or centres it
  then does so against a box four times too big. `wsGeo` compacts.
- A wing panel is a **two-axis** cut: outboard of the root also takes the
  tailplane, which spans z as well. The aft bound comes from the resolved spec's
  own `xLE + chord`.

**Reflections have two sources.** `scene.environment` is baked from the room's
own cube pass by default; `the sky (HDRI)` PMREMs the equirect instead. The
equirect is a data-URI image and decode is asynchronous, so a bake asked for
before it lands falls back to the room and re-bakes on load.

## WHAT THE PIPELINE COSTS

Measured 2026-08-28, 39 props: 544 690 triangles, 76 draw-call parts, 189
unique textures, 11.6 MB of quantised geometry and 10.4 MB of maps — 25.5 MB of
payload, which is the whole shed's furniture at once. Nothing places all of it;
`propBuild` decodes and uploads per prop, on first use.

The heaviest rows, for when that matters: `cart_tool_cab` 80 k tris (1.8 MB, a
box on wheels with ten materials), `compressor` 79 k, `radio_bench` 42 k,
`weldingcart` and `cart_tool` 29 k each. The two `tools` props carry 24
materials between them, which is 24 draw calls — they are shadow boards covered
in individually-textured hand tools, and atlasing them is the only way that
number comes down.

**Look at the parts, not the total.** The Persian carpet arrived at 631 556
triangles and went in at 1 100: 630 456 of them were its two 3 cm fringes,
modelled thread by thread and untextured, and the carpet's own primitive held
the whole pattern. That was found by rendering the file SPLIT BY MATERIAL, not
by reading the totals — `--report` prints per-material counts for exactly this
reason.
