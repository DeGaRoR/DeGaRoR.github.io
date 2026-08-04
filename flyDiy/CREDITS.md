# Credits

## Piper PA-18 3D model (`assets/pa18/`, baked into the artifact)

- **Model**: Emmanuel BARANGER (helijah), created for FlightGear
  (Blender 2.77 / GIMP 2.8). Author's site: helijah.free.fr
- **Livery** (`texture.png`): Brett HARRISON, 2010.
- **License** — the author has published this model under two statements:
  - the FlightGear distribution's `Read-Me.txt` (kept verbatim in
    `assets/pa18/Read-Me.txt`): *"This files are GPL."*
  - the author's Sketchfab listing of the same model
    (https://skfb.ly/NvEt): **CC-BY 4.0**.

  Both statements originate from the author. This repo records both honestly:
  visible attribution is carried in the sim's footer (CC-BY's requirement),
  and the complete source model (OBJ + MTL + textures) ships in this public
  repository at `assets/pa18/` (GPL's source-availability requirement for the
  derived baked payload `src/models/pa18_model.js`).

- The baked payload and the built artifact carry a machine-readable
  provenance header (written by `tools/model_prep.py`).

## Cessna 172SP 3D model (`assetsSketchfab/`, `assets/c172/`, baked into the artifact)

- **Model**: "FREE Cessna 172SP" by **NLM** (https://sketchfab.com/NLM-Group).
  Source listing:
  https://sketchfab.com/3d-models/free-cessna-172sp-c9cadc2f026946da8cf9715a683739e9
- **License**: **CC-BY 4.0** (http://creativecommons.org/licenses/by/4.0/),
  as declared in the GLB's own `asset.extras` block.
- CC-BY requires visible attribution: it is carried in the sim's footer and in
  the provenance header of the baked payload `src/models/c172_model.js`
  (written by `tools/model_prep.py`).
- The GLB as delivered ships at `assetsSketchfab/free_cessna_172sp.glb` in this
  public repository. The model-frame OBJ + MTL + textures at `assets/c172/`
  are *generated* from it by `python tools/glb_extract.py c172` and are
  gitignored — regenerate rather than edit. (Contrast the PA-18, whose OBJ is
  the delivered source and is committed.)
- Modifications made, as CC-BY asks to be indicated: axis/scale conversion to
  the sim's model frame, removal of the "remove before flight" ribbons and
  ground tie-downs, splitting the fused flap and aileron meshes into left and
  right, and mirroring the (single, right-hand) wing strut to give the left
  one. The mesh and the textures are otherwise unaltered — no decimation and
  no re-encoding.

Note: this repository has no top-level LICENSE file; the statements above
apply to the PA-18 and C172 assets and their derivatives only.
