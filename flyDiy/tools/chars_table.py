#!/usr/bin/env python3
"""chars_table.py — THE DECLARED CHARACTER TABLE.

One row per rigged character the crew layer may seat in place of the ATD-01
crash-test dummy. This file is the single authority: `tools/char_prep.py`
bakes exactly these rows (GLB -> media/geo/chars + media/tex/chars + one
src/chars/<key>_char.js manifest each, plus src/chars/chars_index.json in
this order), and the editor's "pilot model" select lists them in this order
after the ATD. Nothing downstream discovers characters by scanning a dir.

The import path is FBX (Mixamo) -> GLB (tools/fbx_to_glb.py, Blender
headless, as-is) -> bake. `assets/chars/` is gitignored: the FBX and the GLB
are the source, the media store and the manifest are what ships.

Each row:
  key     game-side name, lowercase, stable forever (a saved spec's dumModel
          index counts through this table)
  label   what the editor shows a human
  glb     the converted GLB under assets/chars/
  src     the delivered file it came from (for the manifest's provenance line)
  credit  attribution text carried into the manifest and CREDITS.md
"""

CHARS = [
    dict(key='ch42', label='Mixamo Ch42', glb='assets/chars/ch42.glb',
         src='Ch42_nonPBR.fbx',
         credit='"Ch42" character by Adobe Mixamo (mixamo.com), Mixamo licence'),
    dict(key='ch02', label='Mixamo Ch02', glb='assets/chars/ch02.glb',
         src='Ch02_nonPBR.fbx',
         credit='"Ch02" character by Adobe Mixamo (mixamo.com), Mixamo licence'),
    dict(key='remy', label='Mixamo Remy', glb='assets/chars/remy.glb',
         src='Remy.fbx',
         credit='"Remy" character by Adobe Mixamo (mixamo.com), Mixamo licence'),
    dict(key='ch22', label='Mixamo Ch22', glb='assets/chars/ch22.glb',
         src='Ch22_nonPBR.fbx',
         credit='"Ch22" character by Adobe Mixamo (mixamo.com), Mixamo licence'),
    dict(key='ch01', label='Mixamo Ch01', glb='assets/chars/ch01.glb',
         src='Ch01_nonPBR.fbx',
         credit='"Ch01" character by Adobe Mixamo (mixamo.com), Mixamo licence'),
    # the preview character a Mixamo clip download carries ('with skin')
    dict(key='ch20', label='Mixamo Ch20', glb='assets/chars/ch20.glb',
         src='Sitting Idle.fbx',
         credit='"Ch20" character by Adobe Mixamo (mixamo.com), Mixamo licence'),
]

# THE CLIPS (G205): Mixamo animations on the standard rig, baked as sampled
# joint rotations (tools/fbx_to_glb.py --anim -> char_prep). They retarget
# by JOINT NAME onto every character above — Mixamo rigs share their joint
# frames, which is the whole point of the standard rig. Each row:
#   key/label/glb/src/credit as above; fps = the grid the baker resamples to
ANIMS = [
    dict(key='sitidle', label='Sitting idle', glb='assets/chars/anim_sitidle.glb',
         src='Sitting Idle.fbx', fps=15,
         credit='"Sitting Idle" animation by Adobe Mixamo (mixamo.com), Mixamo licence'),
    dict(key='piloting', label='Piloting', glb='assets/chars/anim_piloting.glb',
         src='Piloting.fbx', fps=15,
         credit='"Piloting" animation by Adobe Mixamo (mixamo.com), Mixamo licence'),
]
