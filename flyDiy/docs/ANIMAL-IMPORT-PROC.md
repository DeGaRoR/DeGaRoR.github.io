# ANIMAL IMPORT — procedure

How a downloaded animal becomes a herd on the island. Sister document to
`PROP-IMPORT-PROC.md` (rigid props) and `MODEL-IMPORT-PROC.md` (aeroplanes);
the four pipelines are deliberately separate and share only the philosophy and
the decimator.

    tools/animals_table.py       the declared table — the only authority
    assets/animals/<file>.glb    the delivered asset, byte-for-byte, never edited
    tools/animal_prep.py         the baker  (skins, clips, maps, manifests)
    tools/animal_lod.js          the cutter (the posed static levels)
    src/core/55_animal_codec.js  the decoder (pure JS: browser and node)
    src/viewer/animals.js        the ONE factory: instance, clip player, ladder
    src/viewer/animal_run.js     the behaviours: herd / pod / flock
    src/viewer/plume.js          the chimney's smoke recipe, made portable
    tools/_animal_check.js       GATE ANIMALS — table = payload = behaviour
    tools/_animals.html          the bench: shelf / one / ladder / run
    futureDesigns/ANIMALS-2026-09-22.md   why it is shaped this way

## THE THREE RULES

1. **Geometry is imported as-is.** The base mesh is every triangle the author
   shipped, with the author's own normals and uvs, in float32. The only
   geometry the pipeline *cuts* is the static LEVELS, and those are cut from a
   POSED COPY — the base is never touched.
2. **Textures are re-encoded**, exactly as the prop pipeline does and for the
   same reason: the delivered PNGs are 1–1.6 MB apiece and an elk is looked at
   from a wing. `tex` in the row is the budget (1024 here); raising it and
   re-baking brings the quality back, because `assets/animals/` is untouched.
3. **Nothing is scaled in the payload.** The row declares a real `length` in
   metres; the baker measures the rest mesh along the declared `axis` and
   ships the factor in the manifest. The SCENE applies it — one Object3D
   scale at the root, instead of a scaled rig, scaled inverse bind matrices,
   scaled clip translations and four chances to get one of them wrong.

## ADDING AN ANIMAL

1. Put the delivered `.glb` in `assets/animals/`, unmodified, and add the
   listing, author, licence and url to `CREDITS.md` and to the table's
   `SOURCES`. **A row with no provenance does not ship** — write the credit as
   `TODO-SOURCE` so the omission is visible in the payload itself.
2. Look at it before deciding anything:
   `python tools/animal_prep.py --report` prints the whole table without
   writing — joints, meshes, triangles, the measured scale, every clip with
   its duration, its grid and its measured ground speed.
3. Add the row to `ANIMALS`. What has to be decided by a person:
   - `key` — stable forever; a saved premises references it.
   - `kind` — `land` / `sea` / `air`. It picks the behaviour, the pivot rule
     and the level sheet; nothing else branches on the species.
   - `length` — the animal's real length in metres (a bird: its span). Check
     the report: a bear whose walk comes out at 0.42 m/s is at the right
     scale, one at 4 m/s is out by ten.
   - `forward` — `[dx, dz]`, which way it faces in its own frame. For anything
     with a gait the baker CHECKS it against the walk clip's own travel and
     refuses a row that disagrees; for the rest, read it off an orthographic
     render of the rest mesh with the small parts coloured (the whales' eyes
     are at +z, the gull's beak at −z).
   - `rootJoint` — the joint the locomotion clips walk forward on
     (`RigRoot_01` for the WildMesh rigs), or `None` for clips that run in
     place. The baker takes its travel out of the frames so the world moves
     the animal and the feet do not skate.
   - `clips` — role → the delivered clip's name, or a list (the behaviour
     picks one per bout, which is what makes six elk not one elk six times).
     Ask for a role, never for a name: the bear has `Stand_Idle_01`, the elk
     has only `Stand_Breathing_01`.
   - `lodPose` — the (clip, second) the STATIC levels are skinned at. Not the
     bind pose: a bind pose is often one the animal is never seen in.
   - `mood` / `sea` / `air` — the behaviour's own numbers for that species.
4. `python tools/animal_prep.py` (the whole table, then the cutter; a partial
   bake would rewrite the index with only part of it in, and the baker
   refuses). `--bake` stops before the cut, `--report` writes nothing.
5. `node tools/build.js && node tools/_animal_check.js` — GATE ANIMALS reads
   the declared table out of the python source and asserts the SHIPPED payload
   and the BEHAVIOURS against it (900 steps of a herd, a pod and a flock on a
   synthetic island, under the real vendor three).
6. Look at it, in the bench: serve the repo and open
   `/flyDiy/tools/_animals.html`. SHELF catches a wrong scale or a wrong
   facing; LADDER is where "a similar volume and colour" is judged by eye
   beside the numbers the gate asserts; RUN is the behaviour.

## PLACING THEM

An animal is placed as a HOTSPOT — one `objects` record of a premises, kind
`animal`: `{ key, x, z, n, r, yaw, dy }`. `n` animals of that species inside
`r` metres; `n: 1, r: 0` is one animal put down by hand. The world editor's
OBJECTS section has the tool; every individual is seeded from `(id, index)`,
so changing the count never moves the ones already standing.

## TRAPS THIS PIPELINE HAS ALREADY PAID FOR

- **A skinned mesh's node transform is a lie.** glTF says it is ignored, and
  these exports set it to 0.01 — so `glb_inspect`'s world bbox reports a bear
  2 cm tall. Every measurement here runs linear blend skinning first.
- **Bind with the identity, never `matrixWorld`** (the character layer's own
  lesson, G204): the inverse bind matrices already carry the armature, and
  binding with the node's world matrix applies it twice.
- **A glTF node may carry a `matrix` instead of TRS** — Sketchfab's exporter
  writes one on its root (the FBX y-up turn plus a 0.01 scale). The codec
  rebuilds the tree from TRS, so the baker decomposes it, and it measures
  through the same decompose, or the rest pose drifts between baker and page.
- **The root motion has to come out.** Left in, the animal walks away from the
  transform that places it and its LOD, its pick and its shadow stay behind.
- **The bird file is five birds.** `meshes` selects one; the flock is the
  runtime's business.
- **The water is opaque where it is deep.** A submerged animal drawn normally
  is simply not there — hence the LOOM (a second, unlit draw after the water,
  depth test off, fading over a few body depths). It is the only thing in the
  layer that draws over the scene, which is why it is bounded by that fade.
