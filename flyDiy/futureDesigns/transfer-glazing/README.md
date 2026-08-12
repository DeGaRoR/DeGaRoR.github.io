# Transfer bundle — G5 look pass + glazing/cabin pass

Delivered from a Claude Design session as `FlyDIY procedural plane generator.zip`.
Committed here **because `gen/orig/` is the only surviving copy of the merge base.**

The session forked from an *uncommitted* working-tree state. Measured:

| | `63_gen_skin.js` |
|---|---|
| commit `55866fb` | 47.9 kB |
| `gen/orig/` (the base the session edited) | 55.9 kB |
| working tree when the bundle arrived | 68.8 kB |

No git object matches `gen/orig/`. Without these files a three-way merge cannot
be reproduced — only a guess at one. Keep them until the merge is finished and
verified.

## Layout

| path | what it is |
|---|---|
| `TRANSFER-GLAZING.md` | the cabin/glazing pass — the main feature |
| `HANDOFF-G5-LOOK.md` | the earlier look pass — mesh, textures, materials |
| `gen/` | the session's edited files (`theirs`) |
| `gen/orig/` | pristine pre-session copies (`base`) |
| `plane-glazing.html`, `plane.html`, `plane-baseline.html` | prototype harnesses |
| `three-d-stage.js` | the harness's neutral studio stage |
| `hangar.html` | the hangar, arrived in a second bundle — the source `src/viewer/hangar.js` was ported from |

`uploads/` (session screenshots, ~2.5 MB) was not committed.

## Read the docs with these corrections

Both handoffs are careful documents, but they disagree with their own shipped
code in several places. Verified against the bundle, 2026-08-12:

1. **`cabin.wingBay` does not exist.** `TRANSFER-GLAZING.md` §2.1 and §3
   document it; there are zero occurrences in all four session files. The real
   path is **`wings[0].centre`**, enum **`solid|glass|open`** (not `skylight`).
2. **Reach (`cabin.canopy.x1`) is documented in absolute metres**, but
   `plane-glazing.html` wraps it in a fraction and explains why: *absolute x
   could not survive a cabin-length change.* Use the fraction.
3. **§5's sill invariant is inverted.** It claims the sill is a height plane;
   the code deliberately went back to a **ring index** at the user's request
   ("the plane-based cut makes it look ugly"). Following §5 would revert
   approved work. `hsOf()` is now a constant that still ignores a row argument
   at four call sites.
4. **"Take the propeller block verbatim from `gen/orig/`" is wrong now.**
   `orig` predates the trunk's own propeller rebuild. The trunk promoted `prop`
   to a top-level, physics-bearing group where `pitch` is a string enum
   (`'cruise'`); the session's is per-engine `engines[0].prop` with a numeric
   `pitch`. Restore the block from the **trunk**, not from `orig`.
5. **The two docs give different `COVER` visibility sets**, and neither accounts
   for the trunk's `rubber` group. Derive it from the returned `mats` keys.

`three-d-stage.js` and `hangar.html` target three **0.184 via CDN import maps**;
this repo pins **r128, vendored, offline**. The geometry transfers; the module
plumbing does not.

## The four things that bite when porting 0.184 → r128

Found the hard way while porting the hangar. Each is marked at its site in
`src/viewer/hangar.js`:

1. **Lights are physical in 0.184 and legacy in r128.** This is the big one.
   A `PointLight(colour, 90, 26, 2)` is a shop lamp under the physical model and
   a small sun under the legacy one — the first render of the ported hangar came
   out 255,255,255 in every pixel. r128 has `renderer.physicallyCorrectLights`;
   the room turns it on for itself and hands it back on the way out, because the
   world and the two mesh aircraft are calibrated under the legacy model.
2. **Colour space is an ENCODING**: `t.colorSpace = SRGBColorSpace` becomes
   `t.encoding = sRGBEncoding`, and data sheets must stay linear.
3. **`MeshPhysicalMaterial.thickness` is r132+**; r128 has `transmission` alone.
4. **There is no `scene.environmentIntensity`.** The mood presets scale each
   material's own `envMapIntensity` from the value it was authored with —
   captured once, or scaling a scaled value compounds every time the mood
   changes.

And one thing NOT to copy: the session sets `PCFShadowMap` because
PCFSoftShadowMap is deprecated in r184. In r128 soft PCF is fine and strictly
better, so the viewer's own shadow settings are left alone.
