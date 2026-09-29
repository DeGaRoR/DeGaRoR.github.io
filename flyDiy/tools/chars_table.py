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

# THE TEXTURE BUDGET (AS6, G935; the user's yes 2026-09-29: "modifying texture
# sizes and formats is perfectly OK ... provided that a dedicated asset prep
# session is used"). What the GAME's copy of a character's maps may cost; the
# author's GLB under assets/chars/ and the 2048 maps char_prep writes from it
# stay as they are (the page's fallback, ?ktx2=0). tools/char_tex_budget.js
# cuts the budget set FROM those 2048 maps (the texels the page shows today, so
# the gate measures the new set against exactly that) into
# media/tex/ktx2/chars/ + src/chars/chars_ktx2.js; char_prep.py runs it last.
#   size    the largest side of a diffuse / normal plane: 1024 for the chase and
#           cockpit distance. A 2x2 box in the texture's own space (linear light
#           for the sRGB diffuse, stored values for the normal) - the plane IS the
#           2048 map's GPU mip 1, texel for texel, before the encoder.
#   color   the diffuse's role: ktx2-color in UASTC (codec 'uastc'): measured on
#           the six characters, ETC1S moved 32-px tiles of skin and cloth 2.7-5.8
#           codes (its shared luminance modifier: the far ground's blue, AS3);
#           UASTC holds them within 1.0 at 43-44 dB. RDO lambda 1 (2-3 saved 11 %
#           of the wire for -3 to -4 dB and 4x the encode).
#   normal  ktx2-normal (UASTC + RDO lambda 1, linear), RGB = the normal, A = gloss
#   gloss   'N.a': the material's Glossiness map (Blender's metallicRoughness
#           slot; its G channel is the only one that varies) rides in the
#           normal's alpha, and the separate map is gone
#   spec    'const': the flat white specular maps become a constant in the table
#           (the page never bound them: MeshStandardMaterial has no slot)
#   flat    a plane whose every channel's std is under this at 256 px is a
#           constant, not a texture (GATE ASSETS' FLAT: the census's FLAT_STD)
TEX_BUDGET = dict(size=1024, color='ktx2-color', colorCodec='auto',
                  normal='ktx2-normal', gloss='N.a', spec='const', flat=2)
